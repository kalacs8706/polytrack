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
  if (m.method === 'Runtime.exceptionThrown') errs.push('EXC ' + String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 120));
};
const call = (m, p) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async x => (await call('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
await call('Runtime.enable', {});
for (let i = 0; i < 44; i++) { if (await ev('!!document.getElementById("pt-mod-panel")')) break; await sleep(500); }
await sleep(7000);
const P = '#pt-mod-panel';
const setS = (i, v) => `(()=>{const e=document.querySelectorAll("${P} input[type=range]")[${i}];e.value="${v}";e.dispatchEvent(new Event('input',{bubbles:true}));return e.value})()`;
await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftRight',bubbles:true}))`); await sleep(150);
await ev(`[...document.querySelectorAll("${P} .pt-tab")].find(b=>b.textContent==='Cheats').click()`); await sleep(300);
await ev(setS(0, 2)); await sleep(400);
console.log('buttons:', await ev(`JSON.stringify([...document.querySelectorAll('body > div button, body > button')].map(b=>(b.className||'')+'|'+(b.textContent||'').trim().slice(0,18)).slice(0,25))`));
console.log('clicked:', await ev(`(()=>{const c=[...document.querySelectorAll('button')].filter(b=>!b.closest("${P}"));const t=c.find(b=>/^(play|start|race|time trial|continue|go)$/i.test((b.textContent||'').trim()))||c[0];if(!t)return 'none';const s=(t.textContent||'').trim();t.click();return s})()`));
await sleep(6000);
await ev(setS(0, 1.95)); await sleep(600);
console.log('race ui:', await ev(`!!document.querySelector('.checkpoint-ui')`));
console.log('ack after race:', await ev(`JSON.stringify(window.__ptAckStats||null)`));
console.log('stat line:', await ev(`(()=>{const h=[...document.querySelectorAll("${P} .pt-hint")];return h.length?h[h.length-1].textContent:null})()`));
console.log('errors:', errs.slice(0, 6));
await ev(`localStorage.removeItem('ptCheats')`); await ev(setS(0, 1)); await ev(setS(1, 1));
ws.close();
