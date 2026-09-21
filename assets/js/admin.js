/* ============================================================
   ADMIN PANEL JS
   - Local password gate (deterrent only; keep it business-side)
   - GitHub token: writes data/site-settings.json for this customer's
     repo (never any photos/videos — just which folders map to which
     sections)
   - Apps Script URL: reads this customer's Drive folder listings
   ============================================================ */

(function () {
  "use strict";

  const LS_PW_HASH = "wedding_admin_pwhash";
  const LS_PAT = "wedding_admin_pat";
  const SS_UNLOCKED = "wedding_admin_unlocked";

  let settings = { appsScriptUrl: "", hero: { backgroundDriveId: null }, sections: [] };

  /* ---------------- utils ---------------- */
  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  function toast(msg, isError = false) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.toggle("is-error", isError);
    el.classList.add("is-visible");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("is-visible"), 3800);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------------- GitHub Contents API (settings file only) ---------------- */
  function pat() { return localStorage.getItem(LS_PAT) || ""; }

  async function ghGet(path) {
    const res = await fetch(`${REPO_API_BASE}/${path}?ref=${SITE_CONFIG.github.branch}&_=${Date.now()}`, {
      headers: { Authorization: `Bearer ${pat()}`, Accept: "application/vnd.github+json" },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub GET failed (${res.status}) for ${path}`);
    return res.json();
  }
  async function ghPut(path, base64Content, message) {
    const existing = await ghGet(path);
    const body = { message, content: base64Content, branch: SITE_CONFIG.github.branch };
    if (existing) body.sha = existing.sha;
    const res = await fetch(`${REPO_API_BASE}/${path}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${pat()}`, Accept: "application/vnd.github+json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`GitHub PUT failed (${res.status}): ${(await res.json()).message || ""}`);
    return res.json();
  }
  async function readJSONFile(path, fallback) {
    const file = await ghGet(path);
    if (!file) return fallback;
    const decoded = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ""))));
    try { return JSON.parse(decoded); } catch { return fallback; }
  }
  async function writeJSONFile(path, data, message) {
    const json = JSON.stringify(data, null, 2);
    const base64 = btoa(unescape(encodeURIComponent(json)));
    await ghPut(path, base64, message);
  }

  async function saveSettings(message) {
    try {
      await writeJSONFile(SETTINGS_PATH, settings, message);
      toast("Saved.");
    } catch (e) {
      toast(e.message, true);
    }
  }

  /* ============================================================
     GATE (local password) -- same pattern as before
     ============================================================ */
  function initGate() {
    const hasHash = !!localStorage.getItem(LS_PW_HASH);
    const title = document.getElementById("gate-title");
    const sub = document.getElementById("gate-sub");
    const pw2Field = document.getElementById("pw2-field");
    const submitBtn = document.getElementById("gate-submit");
    const errEl = document.getElementById("gate-error");

    if (hasHash) {
      title.textContent = "Enter admin password";
      sub.textContent = "This admin panel is password-protected on this device.";
      pw2Field.hidden = true;
      submitBtn.textContent = "Unlock";
    }
    if (sessionStorage.getItem(SS_UNLOCKED) === "1") { showAdminShell(); return; }

    submitBtn.addEventListener("click", async () => {
      errEl.textContent = "";
      const pw1 = document.getElementById("pw1").value;
      if (!pw1) { errEl.textContent = "Enter a password."; return; }

      if (!hasHash) {
        const pw2 = document.getElementById("pw2").value;
        if (pw1 !== pw2) { errEl.textContent = "Passwords don't match."; return; }
        if (pw1.length < 6) { errEl.textContent = "Use at least 6 characters."; return; }
        localStorage.setItem(LS_PW_HASH, await sha256Hex(pw1));
        sessionStorage.setItem(SS_UNLOCKED, "1");
        showAdminShell();
        return;
      }
      const hash = await sha256Hex(pw1);
      if (hash === localStorage.getItem(LS_PW_HASH)) {
        sessionStorage.setItem(SS_UNLOCKED, "1");
        showAdminShell();
      } else {
        errEl.textContent = "Wrong password.";
      }
    });
  }

  function showAdminShell() {
    document.getElementById("gate").hidden = true;
    document.getElementById("admin-shell").hidden = false;
    initAdminShell();
  }

  /* ============================================================
     ADMIN SHELL
     ============================================================ */
  async function initAdminShell() {
    wirePatControls();
    wireAppsScriptControls();
    wireHeroControls();
    wireSectionControls();

    if (pat()) {
      try {
        settings = await readJSONFile(SETTINGS_PATH, settings);
      } catch (e) {
        toast(e.message, true);
      }
      renderAll();
      refreshFolderSuggestions();
    }

    document.getElementById("lock-again").addEventListener("click", () => {
      sessionStorage.removeItem(SS_UNLOCKED);
      location.reload();
    });
  }

  function renderAll() {
    document.getElementById("apps-script-url").value = settings.appsScriptUrl || "";
    renderHeroPreview();
    renderSectionList();
  }

  /* ---------------- token ---------------- */
  function wirePatControls() {
    const status = document.getElementById("pat-status");
    function refresh() {
      status.textContent = pat() ? "Token saved on this device." : "No token saved yet — nothing can be read or saved until you add one.";
    }
    refresh();
    document.getElementById("save-pat").addEventListener("click", async () => {
      const val = document.getElementById("pat-input").value.trim();
      if (!val) return;
      localStorage.setItem(LS_PAT, val);
      document.getElementById("pat-input").value = "";
      refresh();
      toast("Token saved to this browser.");
      settings = await readJSONFile(SETTINGS_PATH, settings);
      renderAll();
      refreshFolderSuggestions();
    });
    document.getElementById("clear-pat").addEventListener("click", () => {
      localStorage.removeItem(LS_PAT);
      refresh();
      toast("Token forgotten.");
    });
  }

  /* ---------------- Apps Script connection ---------------- */
  function wireAppsScriptControls() {
    document.getElementById("save-apps-script").addEventListener("click", async () => {
      if (!pat()) { toast("Add your GitHub token first.", true); return; }
      const val = document.getElementById("apps-script-url").value.trim();
      settings.appsScriptUrl = val;
      await saveSettings("Connect Google Drive bridge");
      refreshFolderSuggestions();
    });
  }

  async function refreshFolderSuggestions() {
    if (!settings.appsScriptUrl) return;
    try {
      const res = await fetch(`${settings.appsScriptUrl}?action=listFolders`, { cache: "no-store" });
      const data = await res.json();
      const list = document.getElementById("folder-suggestions");
      list.innerHTML = (data.folders || []).map(name => `<option value="${name}"></option>`).join("");
    } catch (e) {
      console.warn("Couldn't fetch folder list", e);
    }
  }

  /* ---------------- hero background ---------------- */
  function renderHeroPreview() {
    const wrap = document.getElementById("hero-preview");
    const img = document.getElementById("hero-preview-img");
    if (settings.hero && settings.hero.backgroundDriveId) {
      img.src = driveThumbUrl(settings.hero.backgroundDriveId, 400);
      wrap.hidden = false;
    } else {
      wrap.hidden = true;
    }
  }
  function wireHeroControls() {
    document.getElementById("save-hero").addEventListener("click", async () => {
      if (!pat()) { toast("Add your GitHub token first.", true); return; }
      const link = document.getElementById("hero-link").value.trim();
      const id = extractDriveId(link);
      if (!id) { toast("Couldn't read a Drive link from that.", true); return; }
      settings.hero = { backgroundDriveId: id };
      await saveSettings("Set homepage background");
      document.getElementById("hero-link").value = "";
      renderHeroPreview();
    });
    document.getElementById("clear-hero").addEventListener("click", async () => {
      settings.hero = { backgroundDriveId: null };
      await saveSettings("Remove homepage background");
      renderHeroPreview();
    });
  }

  /* ---------------- sections ---------------- */
  function renderSectionList() {
    const wrap = document.getElementById("section-list");
    if (!settings.sections.length) {
      wrap.innerHTML = `<p class="hint">No sections yet — add one below.</p>`;
      return;
    }
    const typeLabel = { gallery: "Gallery", video: "Video", reels: "Reels" };
    wrap.innerHTML = settings.sections.map((s, i) => `
      <div class="section-row" data-id="${s.id}">
        <span class="stype">${typeLabel[s.type] || s.type}</span>
        <span class="stitle">${s.title}</span>
        <span class="sfolder">folder: <code>${s.folder}</code></span>
        <div class="sactions">
          <button data-action="up" title="Move up" ${i === 0 ? "disabled" : ""}>&#8593;</button>
          <button data-action="down" title="Move down" ${i === settings.sections.length - 1 ? "disabled" : ""}>&#8595;</button>
          <button data-action="test" title="Test folder">&#128269;</button>
          <button data-action="remove" title="Remove">&times;</button>
        </div>
        <span class="sstatus" data-role="test-status"></span>
      </div>`).join("");

    wrap.querySelectorAll(".section-row").forEach(row => {
      const id = row.dataset.id;
      row.querySelector('[data-action="up"]')?.addEventListener("click", () => moveSection(id, -1));
      row.querySelector('[data-action="down"]')?.addEventListener("click", () => moveSection(id, 1));
      row.querySelector('[data-action="remove"]').addEventListener("click", () => removeSection(id));
      row.querySelector('[data-action="test"]').addEventListener("click", () => testSection(id, row));
    });
  }

  function wireSectionControls() {
    document.getElementById("refresh-folders").addEventListener("click", refreshFolderSuggestions);

    document.getElementById("add-section").addEventListener("click", async () => {
      if (!pat()) { toast("Add your GitHub token first.", true); return; }
      const title = document.getElementById("new-section-title").value.trim();
      const type = document.getElementById("new-section-type").value;
      const folder = document.getElementById("new-section-folder").value.trim();
      if (!title || !folder) { toast("Give the section a title and a folder name.", true); return; }

      settings.sections.push({ id: `sec_${uid()}`, type, title, folder });
      await saveSettings(`Add section: ${title}`);
      renderSectionList();
      document.getElementById("new-section-title").value = "";
      document.getElementById("new-section-folder").value = "";
      toast(`Added "${title}".`);
    });
  }

  async function moveSection(id, delta) {
    const idx = settings.sections.findIndex(s => s.id === id);
    const swapWith = idx + delta;
    if (idx < 0 || swapWith < 0 || swapWith >= settings.sections.length) return;
    [settings.sections[idx], settings.sections[swapWith]] = [settings.sections[swapWith], settings.sections[idx]];
    await saveSettings("Reorder sections");
    renderSectionList();
  }

  async function removeSection(id) {
    const section = settings.sections.find(s => s.id === id);
    if (!section) return;
    if (!confirm(`Remove the "${section.title}" section from the site?`)) return;
    settings.sections = settings.sections.filter(s => s.id !== id);
    await saveSettings(`Remove section: ${section.title}`);
    renderSectionList();
  }

  async function testSection(id, row) {
    const section = settings.sections.find(s => s.id === id);
    const statusEl = row.querySelector('[data-role="test-status"]');
    if (!settings.appsScriptUrl) { statusEl.textContent = "Connect Google Drive first (step 2)."; return; }
    statusEl.textContent = "Checking…";
    try {
      const res = await fetch(`${settings.appsScriptUrl}?folder=${encodeURIComponent(section.folder)}`, { cache: "no-store" });
      const data = await res.json();
      if (data.error) statusEl.textContent = `⚠ ${data.error}`;
      else statusEl.textContent = `✓ Found ${data.count} file(s) in "${data.folder}".`;
    } catch (e) {
      statusEl.textContent = "⚠ Couldn't reach the Drive bridge.";
    }
  }

  /* ---------------- boot ---------------- */
  document.addEventListener("DOMContentLoaded", initGate);
})();
