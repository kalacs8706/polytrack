(function () {
  "use strict";

  const WL = self.PTWhitelist;
  const form = document.getElementById("add-form");
  const input = document.getElementById("site");
  const statusEl = document.getElementById("status");
  const listEl = document.getElementById("sites");

  function say(text, bad) {
    statusEl.textContent = text || "";
    statusEl.classList.toggle("on", !!text);
    statusEl.classList.toggle("bad", !!bad);
  }

  function row(site, note, bad, onRemove) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.className = "site";
    name.textContent = site.host;
    name.title = site.host;
    item.appendChild(name);
    if (note) {
      const meta = document.createElement("span");
      meta.className = "meta" + (bad ? " warn" : "");
      meta.textContent = note;
      item.appendChild(meta);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.title = "Stop loading the mod on " + site.host;
    remove.addEventListener("click", () => onRemove(site, remove));
    item.appendChild(remove);
    return item;
  }

  async function removeSite(site, button) {
    button.disabled = true;
    const sites = (await WL.readSites()).filter((other) => other.pattern !== site.pattern);
    await WL.writeSites(sites);
    try {
      await chrome.permissions.remove({ origins: [site.pattern] });
    } catch (err) {}
    try {
      await WL.sync();
    } catch (err) {
      say("Could not update the injected sites: " + err.message, true);
    }
    say("Removed " + site.host + ".", false);
    paint();
  }

  async function paint() {
    const sites = await WL.readSites();
    listEl.textContent = "";
    for (const site of sites) {
      const allowed = await WL.hasAccess(site.pattern);
      listEl.appendChild(
        row(site, allowed ? "all ports" : "access revoked", !allowed, removeSite)
      );
    }
    if (!sites.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "No other sites yet.";
      listEl.appendChild(empty);
    }
    const builtin = document.createElement("li");
    const name = document.createElement("span");
    name.className = "site";
    name.textContent = WL.BUILTIN;
    builtin.appendChild(name);
    const note = document.createElement("span");
    note.className = "meta";
    note.textContent = "built in";
    builtin.appendChild(note);
    listEl.appendChild(builtin);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const site = WL.normalizeSite(input.value);
    if (!site) {
      say("Enter a site like example.com or https://example.com/game.", true);
      return;
    }
    if (site.host === WL.BUILTIN || site.host === "*." + WL.BUILTIN) {
      say("The official game already has the mod built in.", true);
      return;
    }
    // The permission prompt needs the click's user gesture, so it is the first thing asked.
    let granted = false;
    try {
      granted = await chrome.permissions.request({ origins: [site.pattern] });
    } catch (err) {
      say("Chrome refused the request: " + err.message, true);
      return;
    }
    if (!granted) {
      say("Chrome did not grant access to " + site.host + ".", true);
      return;
    }
    const sites = (await WL.readSites()).filter((other) => other.pattern !== site.pattern);
    sites.unshift({ host: site.host, pattern: site.pattern, added: Date.now() });
    await WL.writeSites(sites);
    try {
      await WL.sync();
    } catch (err) {
      say("Saved, but Chrome would not start the mod there: " + err.message, true);
      return;
    }
    input.value = "";
    say("Added " + site.host + ". Reload an open tab of it.", false);
    paint();
  });

  paint();
})();
