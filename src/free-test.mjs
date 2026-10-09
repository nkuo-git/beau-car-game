// 試做頁「不用錢」：art/garage-free.html 載入 → 錢 9999999 萬、花了不會少、買得起最貴的車（JESKO）；art/garage.html 照舊（存檔的錢）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname), three = path.join(dir, '../node_modules/three');
let page = 'garage-free.html';
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') {
    const a = 'const RACE = { on: false, frame: raceFrame };';
    let html = fs.readFileSync(path.join(dir, 'art', page), 'utf8').replaceAll('https://cdn.jsdelivr.net/npm/three@0.186.1/', '/three/');
    if (html.split(a).length !== 2) throw new Error('hook anchor');
    html = html.replace(a, `${a} window.__G = () => GAME; window.__wallet = () => document.getElementById('cash').textContent; window.__PERF = PERF;`);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${html}</body></html>`); return;
  }
  const f = u.startsWith('/three/') ? path.join(three, u.slice(7)) : path.join(dir, 'art', u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/plain; charset=utf-8' }); res.end(fs.readFileSync(f));
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}/`;
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const fails = [], check = (ok, w) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${w}`); if (!ok) fails.push(w); };
for (const [pg, free] of [['garage-free.html', true], ['garage.html', false]]) {
  page = pg;
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 470, owned: ['gc8'], parts: {}, tyres: {}, wins: {}, cars: {} })));
  await p.goto(base, { timeout: 300000 });
  await p.waitForFunction(() => window.__G && document.getElementById('cash')?.textContent !== 'NT$ 0 萬', null, { timeout: 300000 });
  const r = await p.evaluate(() => { const G = window.__G(), m0 = G.money, w0 = window.__wallet(), top = Math.max(...Object.values(window.__PERF).map((x) => x.price || 0)); G.money -= 400; const m1 = G.money; Object.assign(G, { money: 0 }); return { m0, m1, m2: G.money, w0, top }; });
  console.log(pg, JSON.stringify(r), errs.length ? 'errors: ' + errs.join(' | ') : '');
  if (free) check(r.m0 === 9999999 && r.m1 === 9999999 && r.m2 === 9999999 && r.top <= r.m0 && /億/.test(r.w0) && !errs.length, `trial page: money ${r.w0}, never goes down, can buy the most expensive car (${r.top} 萬)`);
  else check(r.m0 === 470 && r.m1 === 70 && r.m2 === 0 && !errs.length, 'normal build: money from the save (470), spending works');
  await ctx.close();
}
await b.close(); srv.close();
console.log(fails.length ? `FAILED ${fails.length}` : 'ALL OK');
process.exit(fails.length ? 1 : 0);
