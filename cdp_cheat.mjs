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
const setSlider = (idx, val) => `(()=>{const i=document.querySelectorAll("${P} input[type=range]")[${idx}];i.value="${val}";i.dispatchEvent(new Event('input',{bubbles:true}));return i.value})()`;
await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftRight',bubbles:true}))`);
await sleep(200);
console.log('tabs:', await ev(`JSON.stringify([...document.querySelectorAll("${P} .pt-tab")].map(b=>b.textContent))`));
await ev(tab('Cheats')); await sleep(300);
console.log('cheat rows:', await ev(`JSON.stringify([...document.querySelectorAll("${P} .pt-pane")].map(p=>p.style.display).map((d,i)=>i).join(',')), JSON.stringify([...document.querySelectorAll("${P} .pt-sliderwrap input")].map(i=>({min:i.min,max:i.max,step:i.step,val:i.value})))`));
console.log('cheat labels:', await ev(`JSON.stringify([...document.querySelectorAll("${P} .pt-row .pt-label")].map(s=>s.textContent))`));
console.log('hint:', await ev(`(()=>{const h=document.querySelector("${P} .pt-hint");return h?h.textContent:null})()`));
console.log('set speed 2 ->', await ev(setSlider(0, 2)));
console.log('localStorage:', await ev(`localStorage.getItem('ptCheats')`));
await ev(tab('Replays')); await sleep(300);
console.log('play:', await ev(`(()=>{const b=document.querySelector("${P} .pt-play");if(!b)return 'none';b.click();return 'clicked'})()`));
await sleep(8000);
console.log('sim worker captured:', await ev(`!!window.__ptSimWorker`));
console.log('ack:', await ev(`JSON.stringify(window.__ptCheatAck)`));
await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftRight',bubbles:true}))`);
await sleep(200);
await ev(tab('Cheats')); await sleep(200);
console.log('set friction 1.5 ->', await ev(setSlider(1, 1.5)));
await sleep(800);
console.log('ack after friction:', await ev(`JSON.stringify(window.__ptCheatAck)`));
console.log('stored:', await ev(`localStorage.getItem('ptCheats')`));
console.log('menu text:', await ev(`document.body.innerText.replace(/\\s+/g,' ').slice(0,240)`));
console.log('errors:', errs.slice(0, 8));
ws.close();
