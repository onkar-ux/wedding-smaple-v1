/* ============================================================
   PUBLIC SITE JS
   Reads data/site-settings.json (written by admin.html) to find:
     - the homepage background photo
     - a list of sections, each mapped to a Google Drive folder
   Every section's actual photo/video list is fetched live from the
   Apps Script bridge running in that customer's Google account.
   ============================================================ */

(function () {
  "use strict";

  /* ---------- static content (couple names, story, schedule) ---------- */
  function hydrateStaticContent() {
    document.getElementById("name-a").textContent = SITE_CONFIG.couple.partnerA;
    document.getElementById("name-b").textContent = SITE_CONFIG.couple.partnerB;
    document.getElementById("story-text").textContent = SITE_CONFIG.story;
    document.title = `${SITE_CONFIG.couple.partnerA} & ${SITE_CONFIG.couple.partnerB} — We're Getting Married`;

    const d = new Date(SITE_CONFIG.weddingDateISO);
    const dateStr = isNaN(d) ? "" : d.toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    document.getElementById("hero-meta").textContent =
      `${dateStr} · ${SITE_CONFIG.venueName}, ${SITE_CONFIG.venueCity}`;

    document.getElementById("schedule-list").innerHTML = SITE_CONFIG.schedule.map(item => `
      <li>
        <time>${item.time}</time>
        <div><h3>${item.title}</h3><p>${item.desc}</p></div>
      </li>`).join("");
  }

  async function fetchSiteSettings() {
    try {
      const res = await fetch(`./${SETTINGS_PATH}?_=${Date.now()}`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch (e) { /* fall through */ }
    return { sections: [] };
  }

  async function fetchFolder(appsScriptUrl, section) {
    const param = section.folderId
      ? `folderId=${encodeURIComponent(section.folderId)}`
      : `folder=${encodeURIComponent(section.folder)}`;
    try {
      const res = await fetch(`${appsScriptUrl}?${param}`, { cache: "no-store" });
      const data = await res.json();
      return Array.isArray(data.files) ? data.files : [];
    } catch (e) {
      console.error("Couldn't load folder for section", section, e);
      return [];
    }
  }

  function setHeroBackground(hero) {
    if (!hero || !hero.backgroundDriveId) return;
    const img = document.getElementById("hero-bg-img");
    img.src = driveThumbUrl(hero.backgroundDriveId, 1920);
    img.addEventListener("load", () => {
      img.classList.add("is-loaded");
      document.getElementById("hero").classList.add("has-photo");
    }, { once: true });
  }

  /* ============================================================
     SCROLL REVEAL (works for both static and dynamically-added .reveal)
     ============================================================ */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

  function observeReveal(root = document) {
    root.querySelectorAll(".reveal:not(.is-visible)").forEach(el => revealObserver.observe(el));
    root.querySelectorAll(".divider:not(.is-drawn)").forEach(el => {
      const dio = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) { entry.target.classList.add("is-drawn"); dio.unobserve(entry.target); }
        });
      }, { threshold: 0.4 });
      dio.observe(el);
    });
  }

  function lazyInitSection(el, initFn) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { initFn(); io.unobserve(entry.target); }
      });
    }, { rootMargin: "300px 0px" }); // start just before it scrolls into view
    io.observe(el);
  }

  /* ============================================================
     LIGHTBOX (shared, but takes whichever gallery's photo list is active)
     ============================================================ */
  let lbPhotos = [];
  let lbIndex = 0;

  function openLightbox(photos, index) {
    lbPhotos = photos;
    lbIndex = index;
    renderLightboxImage(true);
    document.getElementById("lightbox").classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    document.getElementById("lightbox").classList.remove("is-open");
    document.body.style.overflow = "";
  }
  function renderLightboxImage(firstOpen) {
    const p = lbPhotos[lbIndex];
    if (!p) return;
    const img = document.getElementById("lb-img");
    document.getElementById("lb-count").textContent = `${lbIndex + 1} / ${lbPhotos.length}`;
    if (firstOpen) {
      img.classList.remove("is-shown");
      img.src = driveViewUrl(p.id);
      img.onload = () => img.classList.add("is-shown");
      return;
    }
    // Crossfade: fade out, swap src once loaded, fade back in.
    img.classList.remove("is-shown");
    const next = new Image();
    next.onload = () => {
      img.src = next.src;
      requestAnimationFrame(() => img.classList.add("is-shown"));
    };
    next.src = driveViewUrl(p.id);
  }
  function lightboxNav(delta) {
    lbIndex = (lbIndex + delta + lbPhotos.length) % lbPhotos.length;
    renderLightboxImage(false);
  }
  function setupLightboxControls() {
    document.getElementById("lb-close").addEventListener("click", closeLightbox);
    document.getElementById("lb-prev").addEventListener("click", () => lightboxNav(-1));
    document.getElementById("lb-next").addEventListener("click", () => lightboxNav(1));
    document.getElementById("lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") closeLightbox(); });
    document.addEventListener("keydown", (e) => {
      if (!document.getElementById("lightbox").classList.contains("is-open")) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") lightboxNav(-1);
      if (e.key === "ArrowRight") lightboxNav(1);
    });
  }

  /* ============================================================
     SECTION BUILDERS
     ============================================================ */
  function sectionShell(section, eyebrow, bodyHtml) {
    const el = document.createElement("section");
    el.className = "section";
    el.id = section.id;
    el.innerHTML = `
      <div class="reveal"><p class="eyebrow">${eyebrow}</p><h2>${section.title}</h2></div>
      ${bodyHtml}
      <p class="section-skeleton" data-role="status">Loading…</p>`;
    return el;
  }

  function buildGallerySection(section) {
    return sectionShell(section, "Photos", `<div class="gallery-grid reveal" data-role="grid"></div>`);
  }
  function buildVideoSection(section) {
    return sectionShell(section, "Video", `
      <div class="video-player reveal" data-role="player" hidden>
        <div class="video-stage" data-role="stage">
          <div class="stage-controls">
            <button type="button" data-role="prev" aria-label="Previous video">&#8592;</button>
            <button type="button" data-role="playpause" aria-label="Play or pause">&#9658;</button>
            <span class="title" data-role="title"></span>
            <button type="button" data-role="next" aria-label="Next video">&#8594;</button>
          </div>
        </div>
        <div class="video-thumbs" data-role="thumbs"></div>
      </div>`);
  }
  function buildReelsSection(section) {
    return sectionShell(section, "Reels", `<div class="reels-strip reveal" data-role="strip"></div>`);
  }

  /* ---------- gallery behavior ---------- */
  async function initGallery(el, section, appsScriptUrl) {
    const status = el.querySelector('[data-role="status"]');
    const grid = el.querySelector('[data-role="grid"]');
    const files = await fetchFolder(appsScriptUrl, section);
    const photos = files.filter(f => f.mimeType && f.mimeType.startsWith("image/"));

    if (!photos.length) { status.textContent = "No photos yet — check back soon."; return; }
    status.remove();

    grid.innerHTML = photos.map((p, i) => `
      <button class="gallery-item" data-index="${i}" aria-label="Open photo ${i + 1}">
        <img data-src="${driveThumbUrl(p.id, 480)}" alt="" />
      </button>`).join("");

    const imgObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        img.src = img.dataset.src;
        img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
        imgObserver.unobserve(img);
      });
    }, { rootMargin: "200px 0px" });
    grid.querySelectorAll("img[data-src]").forEach(img => imgObserver.observe(img));

    grid.querySelectorAll(".gallery-item").forEach(btn => {
      btn.addEventListener("click", () => openLightbox(photos, Number(btn.dataset.index)));
    });
  }

  /* ---------- video-folder behavior ---------- */
  async function initVideoSection(el, section, appsScriptUrl) {
    const status = el.querySelector('[data-role="status"]');
    const player = el.querySelector('[data-role="player"]');
    const files = await fetchFolder(appsScriptUrl, section);
    const videos = files.filter(f => f.mimeType && f.mimeType.startsWith("video/"));

    if (!videos.length) { status.textContent = "No videos yet — check back soon."; return; }
    status.remove();
    player.hidden = false;

    const stage = el.querySelector('[data-role="stage"]');
    const controls = stage.querySelector(".stage-controls");
    const thumbs = el.querySelector('[data-role="thumbs"]');
    const titleEl = el.querySelector('[data-role="title"]');
    const playBtn = el.querySelector('[data-role="playpause"]');
    let current = 0;

    thumbs.innerHTML = videos.map((v, i) => `
      <button class="video-thumb" data-index="${i}" aria-label="Play ${v.name}">
        <span class="idx">${String(i + 1).padStart(2, "0")}</span>
        <img src="${driveThumbUrl(v.id, 300)}" alt="" loading="lazy" />
      </button>`).join("");

    function setPlayIcon(isPlaying) {
      playBtn.style.display = "";
      playBtn.innerHTML = isPlaying ? "&#10074;&#10074;" : "&#9658;";
    }
    function useEmbedFallback(v) {
      stage.querySelectorAll("video, iframe").forEach(node => node.remove());
      const iframe = document.createElement("iframe");
      iframe.src = driveEmbedUrl(v.id);
      iframe.allow = "autoplay";
      iframe.allowFullscreen = true;
      stage.insertBefore(iframe, controls);
      playBtn.style.display = "none"; // Drive's own player has its own controls
    }
    function load(index) {
      current = index;
      const v = videos[index];
      titleEl.textContent = v.name || `Video ${index + 1}`;
      stage.querySelectorAll("video, iframe").forEach(node => node.remove());

      // Real <video> tag first (true custom controls); auto-falls back
      // to Drive's embedded player if direct streaming is refused.
      const videoEl = document.createElement("video");
      videoEl.src = driveDirectVideoUrl(v.id);
      videoEl.playsInline = true;
      videoEl.preload = "metadata"; // don't fetch the whole file just for the list
      videoEl.addEventListener("error", () => useEmbedFallback(v), { once: true });
      videoEl.addEventListener("play", () => setPlayIcon(true));
      videoEl.addEventListener("pause", () => setPlayIcon(false));
      stage.insertBefore(videoEl, controls);

      thumbs.querySelectorAll(".video-thumb").forEach((t, i) => t.classList.toggle("is-active", i === index));
      setPlayIcon(false);
    }

    thumbs.querySelectorAll(".video-thumb").forEach(btn => {
      btn.addEventListener("click", () => load(Number(btn.dataset.index)));
    });
    el.querySelector('[data-role="prev"]').addEventListener("click", () => load((current - 1 + videos.length) % videos.length));
    el.querySelector('[data-role="next"]').addEventListener("click", () => load((current + 1) % videos.length));
    playBtn.addEventListener("click", () => {
      const v = stage.querySelector("video");
      if (!v) return;
      v.paused ? v.play() : v.pause();
    });

    load(0);
  }

  /* ---------- reels behavior (loads one video at a time) ---------- */
  async function initReelsSection(el, section, appsScriptUrl) {
    const status = el.querySelector('[data-role="status"]');
    const strip = el.querySelector('[data-role="strip"]');
    const files = await fetchFolder(appsScriptUrl, section);
    const reels = files.filter(f => f.mimeType && f.mimeType.startsWith("video/"));

    if (!reels.length) { status.textContent = "No reels yet — check back soon."; return; }
    status.remove();

    strip.innerHTML = reels.map((r, i) => `
      <button class="reel-card" data-index="${i}" aria-label="Play ${r.name}">
        <img class="poster" src="${driveThumbUrl(r.id, 300)}" alt="" loading="lazy" />
        <span class="reel-play"><span>&#9658;</span></span>
        <span class="reel-title">${r.name}</span>
      </button>`).join("");

    let activeCard = null;
    function stopActive() {
      if (!activeCard) return;
      activeCard.querySelectorAll("video, iframe").forEach(n => n.remove());
      activeCard.classList.remove("is-active");
      activeCard = null;
    }

    strip.querySelectorAll(".reel-card").forEach((card, i) => {
      card.addEventListener("click", () => {
        const existingVideo = card.querySelector("video");
        if (existingVideo) { existingVideo.paused ? existingVideo.play() : existingVideo.pause(); return; }
        if (activeCard && activeCard !== card) stopActive();

        card.classList.add("is-active");
        activeCard = card;
        const reel = reels[i];
        const videoEl = document.createElement("video");
        videoEl.src = driveDirectVideoUrl(reel.id);
        videoEl.playsInline = true;
        videoEl.muted = true; // most browsers require this for autoplay
        videoEl.controls = true;
        videoEl.preload = "metadata"; // only this one loads now -- others stay as posters
        videoEl.addEventListener("error", () => {
          card.querySelectorAll("video").forEach(n => n.remove());
          const iframe = document.createElement("iframe");
          iframe.src = driveEmbedUrl(reel.id);
          iframe.allow = "autoplay";
          card.appendChild(iframe);
        }, { once: true });
        card.appendChild(videoEl);
        videoEl.play().catch(() => {});
      });
    });
  }

  /* ============================================================
     BOOT
     ============================================================ */
  async function buildDynamicSections(settings) {
    const container = document.getElementById("dynamic-sections");
    const appsScriptUrl = settings.appsScriptUrl;
    const sections = Array.isArray(settings.sections) ? settings.sections : [];

    sections.forEach(section => {
      let el;
      if (section.type === "video") el = buildVideoSection(section);
      else if (section.type === "reels") el = buildReelsSection(section);
      else el = buildGallerySection(section);

      container.appendChild(el);
      observeReveal(el);

      if (!appsScriptUrl) {
        el.querySelector('[data-role="status"]').textContent = "This section isn't connected yet.";
        return;
      }
      lazyInitSection(el, () => {
        if (section.type === "video") initVideoSection(el, section, appsScriptUrl);
        else if (section.type === "reels") initReelsSection(el, section, appsScriptUrl);
        else initGallery(el, section, appsScriptUrl);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    hydrateStaticContent();
    setupLightboxControls();
    observeReveal();

    const settings = await fetchSiteSettings();
    setHeroBackground(settings.hero);
    await buildDynamicSections(settings);
  });
})();
