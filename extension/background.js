// Chrome removes dynamically registered content scripts when the extension is updated or
// reloaded, so the list is turned back into a content script here as well.
importScripts("whitelist.js");

function sync() {
  self.PTWhitelist.sync().catch((err) => console.warn("PolyMod: whitelist sync failed", err));
}

chrome.runtime.onInstalled.addListener(sync);
chrome.runtime.onStartup.addListener(sync);
sync();
