/* ============================================================
   SITE CONFIG
   Per-customer basics live here. Everything about which Drive
   folders power which sections lives in data/site-settings.json
   instead (edited through admin.html, not by hand).
   ============================================================ */

const SITE_CONFIG = {
  // This customer's GitHub repo (hosts the code + the tiny settings
  // file only — never photos or videos).
  github: {
    owner: "onkar-ux",
    repo: "wedding-smaple-v1",
    branch: "main",
  },

  couple: {
    partnerA: "Ava",
    partnerB: "Noah",
  },

  weddingDateISO: "2027-06-12T16:00:00",
  venueName: "Willowmere Garden",
  venueCity: "Nagpur, Maharashtra",

  story:
    "We met on a rainy Tuesday, argued about the best filter coffee " +
    "in town, and somehow never stopped talking after that. Years, " +
    "one very patient dog, and a lot of terrible karaoke later — " +
    "we're finally making it official, and we'd love for you to be " +
    "there when we do.",

  schedule: [
    { time: "4:00 PM", title: "Guests arrive", desc: "Tea, sun, and settling in." },
    { time: "4:30 PM", title: "Ceremony", desc: "Under the old banyan tree." },
    { time: "6:00 PM", title: "Cocktail hour", desc: "Music and mingling on the lawn." },
    { time: "7:30 PM", title: "Dinner", desc: "Long tables, family style." },
    { time: "9:00 PM", title: "Dancing", desc: "Until someone loses a shoe." },
  ],
};

/* ---------- derived / helpers ---------- */
const REPO_API_BASE = `https://api.github.com/repos/${SITE_CONFIG.github.owner}/${SITE_CONFIG.github.repo}/contents`;
const SETTINGS_PATH = "data/site-settings.json";

/* ---------- Google Drive URL helpers (used across admin + public) ---------- */
function driveThumbUrl(id, width) {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${width || 480}`;
}
function driveViewUrl(id) {
  // Full-resolution direct view -- used for lightbox / large images.
  return `https://drive.google.com/uc?export=view&id=${id}`;
}
function driveDirectVideoUrl(id) {
  return `https://drive.google.com/uc?export=download&id=${id}`;
}
function driveEmbedUrl(id) {
  return `https://drive.google.com/file/d/${id}/preview`;
}
function extractDriveId(link) {
  const patterns = [/\/d\/([a-zA-Z0-9_-]{10,})/, /[?&]id=([a-zA-Z0-9_-]{10,})/];
  for (const re of patterns) {
    const m = link.match(re);
    if (m) return m[1];
  }
  return null;
}
