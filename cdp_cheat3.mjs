const port = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function tg() { try { return await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { return null; } }
let page = null; const t0 = Date.now();
while (Date.now() - t0 < 25000) { const l = await tg(); page = l && l.find(t => t.type === 'page' && t.url); if (page) break; await sleep(400); }
if (!page) { console.log('NO_PAGE'); process.exit(2); }
let ws = null;
for (let a = 0; a < 10 && !ws; a++) {
  try { const c = new WebSocket(page.webSocketDebuggerUrl); await new Promise((res, rej) => { c.onopen = res; c.onerror = () => rej(new Error('ws')); setTimeout(() => rej(new Error('t')), 4000); }); ws = c; } catch { await sleep(700); }
}
if (!ws) { console.log('WS_FAIL'); process.exit(2); }
let id = 0; const pending = new Map(); const errs = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errs.push('EXC ' + String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 160));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push('ERR ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 160));
};
const call = (m, p) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async x => (await call('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
await call('Runtime.enable', {});
for (let i = 0; i < 40; i++) { if (await ev('!!document.getElementById("pt-mod-panel")')) break; await sleep(500); }
await sleep(9000);
const P = '#pt-mod-panel';
const tab = n => `[...document.querySelectorAll("${P} .pt-tab")].find(b=>b.textContent==='${n}').click()`;
const setSlider = (i, v) => `(()=>{const e=document.querySelectorAll("${P} input[type=range]")[${i}];e.value="${v}";e.dispatchEvent(new Event('input',{bubbles:true}));return e.value})()`;
await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftRight',bubbles:true}))`); await sleep(200);
await ev(tab('Cheats')); await sleep(400);
console.log('labels:', await ev(`JSON.stringify([...document.querySelectorAll("${P} .pt-row .pt-label")].map(s=>s.textContent))`));
console.log('ranges:', await ev(`JSON.stringify([...document.querySelectorAll("${P} input[type=range]")].map(i=>i.min+'-'+i.max))`));
console.log('hook installed:', await ev(`!!(window.Worker&&Worker.prototype.__ptCheatHooked)`));
console.log('set speed 2:', await ev(setSlider(0, 2)));
console.log('set grip 1.5:', await ev(setSlider(1, 1.5)));
await sleep(300);
console.log('ghost toggle:', await ev(`(()=>{const r=[...document.querySelectorAll("${P} .pt-row")].find(r=>r.querySelector(".pt-label")&&r.querySelector(".pt-label").textContent==="Ghosts also get cheats");const b=r&&r.querySelector(".pt-toggle");if(!b)return "missing";const b4=b.textContent;b.click();return b4+" -> "+b.textContent})()`));
await sleep(400);
await ev(tab('Replays')); await sleep(300);
await ev(`(()=>{const b=document.querySelector("${P} .pt-play");if(!b)return 'none';b.click();return 'clicked'})()`);
await sleep(9000);
console.log('sim worker seen:', await ev(`!!window.__ptSimWorker`));
console.log('last payload:', await ev(`JSON.stringify(window.__ptLastWorkerMsg&&window.__ptLastWorkerMsg.ptCheat)`));
console.log('stored:', await ev(`localStorage.getItem('ptCheats')`));
console.log('ack stats:', await ev(`JSON.stringify(window.__ptAckStats||null)`));
console.log('stat line:', await ev(`(()=>{const h=[...document.querySelectorAll("${P} .pt-hint")];return h.length?h[h.length-1].textContent:null})()`));
console.log('race running:', await ev(`!!document.querySelector('.checkpoint-ui')`));
console.log('errors:', errs.slice(0, 8));
await ev(`localStorage.removeItem('ptCheats')`);
ws.close();
