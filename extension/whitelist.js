// The list of extra sites the mod loads on. It is kept in chrome.storage and turned into one
// dynamically registered content script, which is what Chrome needs before it will run the
// mod's files on a site that is not in the manifest.
//
// Shared by the popup (index.html) and the service worker (background.js).
(function () {
  "use strict";

  const KEY = "ptWhitelist";
  const SCRIPT_ID = "pt-whitelist";
  // The official game is in the manifest's own content scripts; injecting it again from here
  // would load the mod twice.
  const BUILTIN = "app-polytrack.kodub.com";
  const FILES = ["src/compat.js", "src/gameapi.js", "src/api-base.js", "src/mod.js"];

  // Accepts "example.com", "https://example.com/game", "localhost:3000" and "*.example.com".
  // Everything is reduced to a host match pattern: a pattern without a port matches every port
  // on that host, and http and https are both covered by the * scheme.
  function normalizeSite(raw) {
    const text = String(raw == null ? "" : raw).trim();
    if (!text) return null;
    // Without the // this would read "localhost:3000" as a scheme.
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) && !/^https?:\/\//i.test(text)) return null;
    let host;
    if (text.indexOf("*.") === 0) {
      const rest = text.slice(2).split(/[/?#]/)[0].toLowerCase();
      if (!rest) return null;
      host = "*." + rest;
    } else {
      let url;
      try {
        url = new URL(/^https?:\/\//i.test(text) ? text : "https://" + text);
      } catch (err) {
        return null;
      }
      if (!/^https?:$/.test(url.protocol)) return null;
      host = url.hostname.toLowerCase();
    }
    if (!host) return null;
    if (!/^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(host)) return null;
    return { host: host, pattern: "*://" + host + "/*" };
  }

  async function readSites() {
    let stored = null;
    try {
      const data = await chrome.storage.local.get(KEY);
      stored = data && data[KEY];
    } catch (err) {
      stored = null;
    }
    if (!Array.isArray(stored)) return [];
    return stored.filter((site) => site && typeof site.pattern === "string" && typeof site.host === "string");
  }

  async function writeSites(sites) {
    await chrome.storage.local.set({ [KEY]: Array.isArray(sites) ? sites : [] });
  }

  async function hasAccess(pattern) {
    try {
      return !!(await chrome.permissions.contains({ origins: [pattern] }));
    } catch (err) {
      return false;
    }
  }

  // Chrome drops dynamically registered content scripts when the extension is updated or
  // reloaded, so this runs again from the service worker and rebuilds them from the list.
  async function sync() {
    const sites = await readSites();
    const matches = [];
    for (const site of sites) {
      if (site.host === BUILTIN || site.pattern === "*://" + BUILTIN + "/*") continue;
      if (matches.indexOf(site.pattern) >= 0) continue;
      if (!(await hasAccess(site.pattern))) continue;
      matches.push(site.pattern);
    }
    try {
      await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    } catch (err) {}
    if (!matches.length) return { matches: [] };
    await chrome.scripting.registerContentScripts([
      {
        id: SCRIPT_ID,
        matches: matches,
        js: FILES.slice(),
        runAt: "document_start",
        allFrames: true,
        world: "MAIN",
        persistAcrossSessions: true,
      },
    ]);
    return { matches: matches };
  }

  self.PTWhitelist = {
    KEY: KEY,
    SCRIPT_ID: SCRIPT_ID,
    BUILTIN: BUILTIN,
    FILES: FILES,
    normalizeSite: normalizeSite,
    readSites: readSites,
    writeSites: writeSites,
    hasAccess: hasAccess,
    sync: sync,
  };
})();
