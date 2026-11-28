// Runs in the page (MAIN world) before the game bundle and tells PolyMod where its
// self-hosted API lives: window.__ptMPBase. A value the page already set wins, so the
// extension stays harmless on any build that repoints the API itself.
try {
  if (!window.__ptMPBase) {
    window.__ptMPBase = "https://site-ba117be33b694461992db987ce77b70d.freebuff.page";
  }
} catch (e) {}
