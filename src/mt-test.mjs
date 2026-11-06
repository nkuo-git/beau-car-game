// 手排（第 68 批；Nick 2026-11-06「車子做手排的」，卡片「要有離合器」→ 草稿第 2 版「照這樣做」）
// 第 1 段 Node（不開瀏覽器，一秒內）：drive.js 的手排模式：空檔、離合器、▲ ▼、咔咔、熄火、重新發動、紅線不自己升檔、太早降檔的引擎煞車、R 檔、停住按煞車 R ↔ 1
// 第 2 段 瀏覽器：「⋯」→「自排／手排」切換（每支手機自己記 carid.gear）、▲ ▼ 離合器按鈕、轉速表 N／檔位、提示、5 種手機大小不壓到別的按鈕；自排完全照舊
// node mt-test.mjs [../out/mt/mt]   （只跑 Node：NODE_ONLY=1）
import './village-node-stub.mjs';
import * as THREE from 'three';
import { createDrive } from './drive.js';
const fails = [];
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const PERF = { hp: 280, kg: 1270, awd: 1, red: 7000, vmax: 250, cda: 0.65 }; // GC8 差不多
const W = { xf: 1.25, xr: -1.27, R: 0.31, trackF: 0.73, trackR: 0.73, wF: 0.2, wR: 0.2 };
function fakeCar() {
  const car = new THREE.Group(), body = new THREE.Group(), len = W.xf - W.xr + 1.8; body.name = 'body';
  const shell = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 1.75)); shell.position.set((W.xf + W.xr) / 2, 0.7, 0); body.add(shell); car.add(body);
  const wheels = [];
  for (const [x, tr] of [[W.xf, W.trackF], [W.xr, W.trackR]]) for (const s of [-1, 1]) { const hub = new THREE.Group(); hub.position.set(x, W.R, s * tr); const wh = new THREE.Group(); hub.add(wh); car.add(hub); wheels.push(wh); }
  return { car, body, wheels, spec: { wheels: W, interior: { wheelZ: 0.37 } } };
}
const dt = 1 / 60, ev = { shifts: [], engine: [], grind: [] };
function rig() {
  const S = fakeCar(), scene = new THREE.Scene(); scene.add(S.car);
  const d = createDrive({ car: S, scene, camera: null, perf: PERF, world: { surfaceAt: () => 0, colliders: [], places: {} }, keyboard: false,
    onShift: (g) => ev.shifts.push(g), onEngine: (on) => ev.engine.push(on), onGrind: (w) => ev.grind.push(w) });
  d.teleport({ x: 0, z: 0, heading: 0 });
  return d;
}
// 跑 s 秒：inp 可以是物件或 (te) => 物件
const run = (d, s, inp) => { let te = d.telemetry(); for (let i = 0; i < s * 60; i++) { d.setInput(typeof inp === 'function' ? inp(te) : inp); d.update(dt); te = d.telemetry(); } return te; };
const r2 = (x) => +x.toFixed(2);

console.log('== 1 Node：手排的物理 ==');
// ---- 自排照舊 ----
let d = rig();
let t = run(d, 8, { throttle: 1 });
check(!t.mt && t.mgear === null && t.gear >= 3 && t.shifts >= 2 && t.kmh > 120, `自排照舊：油門到底 8 秒 ${Math.round(t.kmh)} km/h、自己升到 ${t.gear} 檔（換了 ${t.shifts} 次）`);
// ---- 手排：空檔 ----
d = rig(); d.setGearbox('mt'); ev.shifts.length = 0;
t = run(d, 3, { throttle: 1 });
check(d.gearbox === 'mt' && t.mt && t.mgear === 0 && t.kmh < 0.1 && t.rpm > 0.85 && !t.stalled, `手排一開始是空檔 N：踩油門車不動（${r2(t.kmh)} km/h）、引擎空催到 ${r2(t.rpm)}`);
// ---- 沒按離合器排不進去 ----
d.shift(1); t = run(d, 0.5, { throttle: 0 });
check(t.mgear === 0 && t.grind === 1 && ev.grind.join() === '1', `沒按離合器按 ▲：咔咔（grind ${t.grind}）、還是 N`);
// ---- 按住離合器排 1 檔，放開沒給油 → 熄火；按油門重新發動 ----
run(d, 0.3, { clutch: 1 }); d.shift(1); t = run(d, 0.3, { clutch: 1 });
check(t.mgear === 1 && t.gear === 1 && t.clutch > 0.99 && t.kmh < 0.1, `按住離合器按 ▲：排進 1 檔（離合器 ${t.clutch}，車還沒動）`);
t = run(d, 1.5, { clutch: 0, throttle: 0 });
check(t.stalled && t.rpm < 0.05 && t.mgear === 1 && t.kmh < 0.1 && ev.engine.join() === 'false', `放開離合器、沒給油：熄火（轉速 ${r2(t.rpm)}，還在 1 檔，車沒動）、onEngine(false)`);
t = run(d, 0.3, { throttle: 1 });
check(t.stalled && t.cranking && t.rpm < 0.2, `按油門：發動中（轉速 ${r2(t.rpm)}）`);
t = run(d, 2, { throttle: 1 });
check(!t.stalled && !t.cranking && t.kmh > 15 && ev.engine.join() === 'false,true', `0.6 秒後發動好了、1 檔開走 ${Math.round(t.kmh)} km/h、onEngine(true)`);
// ---- 起步給油不熄火；紅線不自己升檔、斷油噠噠噠 ----
d = rig(); d.setGearbox('mt'); ev.shifts.length = 0; ev.engine.length = 0;
run(d, 0.2, { clutch: 1 }); d.shift(1); run(d, 0.2, { clutch: 1 });
t = run(d, 1, { clutch: 0, throttle: 0.6 });
check(!t.stalled && t.kmh > 8 && t.mgear === 1, `放離合器的時候給油：不熄火、開走了 ${Math.round(t.kmh)} km/h`);
const lim = { n: 0, rpmMin: 9, rpmMax: 0, kmhMax: 0 };
for (let i = 0; i < 60 * 12; i++) { d.setInput({ throttle: 1 }); d.update(dt); const te = d.telemetry(); if (i > 60 * 8) { if (te.limiter) lim.n++; lim.rpmMin = Math.min(lim.rpmMin, te.rpm); lim.rpmMax = Math.max(lim.rpmMax, te.rpm); lim.kmhMax = Math.max(lim.kmhMax, te.kmh); } }
t = d.telemetry();
check(t.mgear === 1 && ev.shifts.length === 0 && lim.n > 60 * 3 && lim.rpmMin > 0.9 && lim.rpmMax > 1.0 && lim.kmhMax < 75, `油門到底 12 秒還在 1 檔（沒自己升檔、沒 onShift）：撞紅線斷油噠噠噠（轉速 ${r2(lim.rpmMin)}–${r2(lim.rpmMax)}，最多 ${Math.round(lim.kmhMax)} km/h）`);
// ---- 升到 2、3 檔：換檔聲；速度上去 ----
run(d, 0.2, { clutch: 1, throttle: 0 }); d.shift(1); run(d, 0.2, { clutch: 1 });
t = run(d, 4, { throttle: 1 });
check(t.mgear === 2 && ev.shifts.join() === '2' && t.kmh > lim.kmhMax + 10, `按住離合器 ▲ → 2 檔（onShift 2）、放開催到 ${Math.round(t.kmh)} km/h`);
run(d, 0.2, { clutch: 1, throttle: 0 }); d.shift(1); run(d, 0.2, { clutch: 1 }); run(d, 0.2, { clutch: 1 }); d.shift(1); run(d, 0.2, { clutch: 1 });
t = run(d, 6, { throttle: 1 }); const k4 = t.kmh;
check(t.mgear === 4 && ev.shifts.join() === '2,3,4' && k4 > 150, `再升到 4 檔（onShift 3、4）：${Math.round(k4)} km/h`);
// ---- 太早降檔：轉速衝過紅線、引擎煞車很重 ----
const dC = rig(); dC.setGearbox('mt'); // 對照：同樣速度 4 檔放油門滑行
run(dC, 0.2, { clutch: 1 }); for (let g = 0; g < 4; g++) { dC.shift(1); run(dC, 0.1, { clutch: 1 }); } run(dC, 0.1, { clutch: 0 });
run(dC, 60, (te) => ({ throttle: te.kmh < k4 ? 1 : 0 })); const c0 = run(dC, 3, { throttle: 0 }).kmh, coast = k4 - c0;
run(d, 0.2, { clutch: 1 }); d.shift(-1); run(d, 0.1, { clutch: 1 }); d.shift(-1); run(d, 0.1, { clutch: 1 });
t = run(d, 3, { throttle: 0 }); const drop = k4 - t.kmh;
check(t.mgear === 2 && drop > coast * 1.6 && t.rpm > 0.9, `${Math.round(k4)} km/h 從 4 檔降到 2 檔放開：轉速 ${r2(t.rpm)}、3 秒掉 ${Math.round(drop)} km/h（4 檔滑行只掉 ${Math.round(coast)}）`);
// ---- 開著不能排 R；停住才能；R 檔油門往後走、煞車是煞車 ----
ev.grind.length = 0; run(d, 0.2, { clutch: 1 }); d.shift(-1); d.shift(-1); d.shift(-1); run(d, 0.2, { clutch: 1 });
t = run(d, 0.1, { clutch: 1 });
check(t.mgear === 0 && t.grind === 2 && ev.grind.join() === '2', `開著（${Math.round(t.kmh)} km/h）▼ ▼ ▼：到 N 以後排不進 R（咔咔，grind 2）`);
t = run(d, 20, { brake: 1 });
check(t.kmh < 0.1 && t.mgear === -1 && t.gear === -1 && t.reversing, `煞車煞到停、一直按著：跟自排一樣換成 R（只換一次，不會 R、1 一直跳）`);
t = run(d, 0.3, { brake: 0 }); t = run(d, 0.4, { brake: 1 });
check(t.mgear === 1 && !t.reversing, `放開再按著煞車：換回 1 檔（照舊，不用離合器）`);
run(d, 0.3, { clutch: 1 }); d.shift(-1); d.shift(-1); t = run(d, 0.2, { clutch: 1 });
check(t.kmh < 0.1 && t.mgear === -1 && t.gear === -1, `停住了按住離合器 ▼ ▼：N → R`);
t = run(d, 2, { throttle: 1 });
check(t.v < -1.5 && t.reversing, `R 檔踩油門：往後走 ${r2(-t.v * 3.6)} km/h`);
t = run(d, 2, { brake: 1 });
check(Math.abs(t.v) < 0.1 && t.mgear === 1 && !t.reversing, `R 檔踩煞車：停下來（煞車不是「倒車」）；停住了還按著＝換回 1 檔（照舊）`);
run(d, 0.3, { clutch: 1 }); d.shift(-1); d.shift(-1); t = run(d, 0.2, { clutch: 1 }); const gR = t.mgear; d.shift(1); d.shift(1); t = run(d, 0.2, { clutch: 1 });
check(gR === -1 && t.mgear === 1 && !t.reversing, `按住離合器 ▼ ▼ → R（${gR}），▲ ▲ → N → 1 檔（${t.mgear}）`);
// ---- 檔太高沒力（不熄火） ----
d = rig(); d.setGearbox('mt'); run(d, 0.2, { clutch: 1 }); d.shift(1); d.shift(1); d.shift(1); run(d, 0.2, { clutch: 1 });
t = run(d, 1, { clutch: 0, throttle: 1 }); const k3 = t.kmh; t = run(d, 3, { throttle: 1 });
check(!t.stalled && t.mgear === 3 && t.kmh > k3 && t.kmh < 60, `停著排 3 檔給油放離合器：沒熄火、慢慢加速（4 秒 ${Math.round(t.kmh)} km/h）`);
// ---- 換回自排 ----
d.setGearbox('at'); t = run(d, 6, { throttle: 1 });
check(!t.mt && t.mgear === null && t.gear >= 3 && t.kmh > 100, `換回自排：自己升檔（${t.gear} 檔、${Math.round(t.kmh)} km/h）`);
// ---- 開著換成手排＝現在這一檔 ----
d.setGearbox('mt'); t = d.telemetry();
check(t.mt && t.mgear === t.gear && t.mgear >= 3, `開著換成手排：排在現在這一檔（${t.mgear}）`);
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS OK (Node)');
if (process.env.NODE_ONLY || fails.length) process.exit(fails.length ? 1 : 0);

// ================= 2 瀏覽器 =================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname), prefix = process.argv.slice(2).find((a) => !a.startsWith('--')) || '../out/mt/mt';
fs.mkdirSync(path.dirname(prefix), { recursive: true });
const T0 = Date.now(), el = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`;
console.log('== 2 瀏覽器 ==', el());
const { default: pw } = await import('/opt/node22/lib/node_modules/playwright/index.js');
const three = path.join(dir, '../node_modules/three');
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__G = () => GAME; window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, dvoice, tripS, cur, walker, gearK });'
  + ' window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };'
  + ' window.__wstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return walker && walker.telemetry(); };'
  + ' window.__toast = () => { const e = document.getElementById("gtoast") || document.querySelector(".gtoast"); return e && e.textContent; };';
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') {
    let html = fs.readFileSync(path.join(dir, 'art/garage.html'), 'utf8').replaceAll('https://cdn.jsdelivr.net/npm/three@0.186.1/', '/three/');
    const a = 'const RACE = { on: false, frame: raceFrame };', d1 = '  driveStep(dt);\n  if (!DRIVE.on) return;', d2 = '  renderer.render(TR.scene, dcam);\n}';
    for (const x of [a, d1, d2]) if (html.split(x).length !== 2) throw new Error('hook anchor missing or not unique: ' + x);
    html = html.replace(a, `${a} ${hook}`).replace(d1, '  if (!window.__hold) driveStep(dt);\n  if (!DRIVE.on) return;')
      .replace(d2, '  if (!window.__noDraw) { renderer.render(TR.scene, dcam); window.__dframes = (window.__dframes || 0) + 1; }\n}')
      .replace('<script type="module">', '<script>window.__roomWatch = false;</script><script type="module">');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${html}</body></html>`);
    return;
  }
  const f = u.startsWith('/three/') ? path.join(three, u.slice(7)) : path.join(dir, 'art', u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}/`;
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
const p = await ctx.newPage(); p.setDefaultTimeout(300000);
const errs = [];
p.on('pageerror', (e) => { errs.push(e.message); console.log('pageerror', e.message); });
p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_CERT|404|GPU stall|AudioContext was not allowed|ScriptProcessorNode|worklet timeout|ERR_TUNNEL|ERR_NAME|ERR_CONNECTION|fonts\.g/.test(m.text())) console.log('console', m.type(), m.text().slice(0, 240)); });
const cdp = await ctx.newCDPSession(p);
async function shot(name) {
  const n0 = await p.evaluate(() => { window.__noDraw = false; return window.__dframes || 0; });
  await p.waitForFunction((n) => (window.__dframes || 0) >= n + 2, n0, { timeout: 300000 });
  await p.evaluate(() => { window.__noDraw = true; });
  await p.screenshot({ path: `${prefix}-${name}.png` });
  const ri = await p.evaluate(() => window.__rinfo()); console.log('  shot', `${prefix}-${name}.png`, JSON.stringify(ri), el()); return ri;
}
await p.addInitScript(() => {
  if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 100, owned: ['gc8'], parts: {}, tyres: {}, wins: {}, cars: {} })); localStorage.setItem('carid.tune.full', 'on'); }
});
await p.addInitScript(() => { // 走路的小幫手（drift-test 的）
  const H = (window.__H = {}), W = () => window.__D().walker, step = (n = 1) => window.__wstep(n);
  H.walkTo = (x, z, { m = 0.7, tol = 0.35, max = 40 } = {}) => {
    const w = W(); let t = w.telemetry(), n = 0, stuck = 0, lx = t.x, lz = t.z;
    for (; n < max * 60; n++) {
      t = w.telemetry(); const dx = x - t.x, dz = z - t.z; if (Math.hypot(dx, dz) < tol) break;
      const a = Math.atan2(-dz, dx) - t.camYaw; w.setInput({ x: -Math.sin(a) * m, y: Math.cos(a) * m }); step(1);
      if (n % 60 === 59) { if (Math.hypot(t.x - lx, t.z - lz) < 0.2) stuck++; else stuck = 0; lx = t.x; lz = t.z; if (stuck >= 3) break; }
    }
    w.setInput({ x: 0, y: 0 }); step(20); w.setInput(null); t = w.telemetry(); return { ok: Math.hypot(x - t.x, z - t.z) < tol + 0.3 };
  };
  H.gw = (x, z, h = 0) => { const L = window.__D().VIL.places.garage.lot, c = Math.cos(L.heading), s = Math.sin(L.heading); return { x: L.x + x * c + z * s, z: L.z - x * s + z * c, heading: h + L.heading }; };
  H.walkLocal = (pts) => { let r = null; for (const [x, z] of pts) { const w = H.gw(x, z); r = H.walkTo(w.x, w.z); if (!r.ok) return r; } return r; };
  const vis = (e) => !!e && !e.hidden && !e.closest('[hidden]') && e.getClientRects().length > 0;
  const act = () => [...document.querySelectorAll('#stage .wk-act, #stage .dv-act')].find(vis);
  H.press = () => { const e = act(); if (!e) return null; const s = e.querySelector('span').textContent; e.click(); return s; };
  H.board = (maxS = 8) => { const w = W(), modes = []; for (let n = 0; n < maxS * 60; n++) { step(1); modes.push(w.mode); if (w.mode === 'off') break; } return [...new Set(modes)]; };
});
async function getIn() {
  await p.goto(base, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.getElementById('status').hidden, null, { timeout: 300000 });
  await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
  await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
  await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
  return p.evaluate(() => { const D = window.__D(), H = window.__H; D.walker.teleport(H.gw(-4.5, -4, -1.05)); window.__wstep(20); const r = H.walkLocal([[-2.6, -2.6], [-0.6, -2.3]]); const pressed = H.press(), modes = H.board(); window.__wstep(40); const D2 = window.__D(); return { walk: r?.ok, pressed, modes, drv: !!D2.drv, cur: D2.cur, gearK: D2.gearK, fs: document.body.classList.contains('fs') }; });
}
const ui = () => p.evaluate(() => {
  const q = (s) => document.querySelector(s), vis = (e) => !!e && !e.hidden && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0, D = window.__D(), t = D.drv.telemetry();
  return { gearbox: D.drv.gearbox, key: localStorage.getItem('carid.gear'), tog: vis(q('#gearTog')), togText: q('#gearTog').textContent, pressed: q('#gearTog').getAttribute('aria-pressed'), mt: q('#stage .dv').classList.contains('mt'),
    up: vis(q('#stage .dv-up')), dn: vis(q('#stage .dv-dn')), clu: vis(q('#stage .dv-clu')), gear: q('#stage .dv-spd em').textContent, gearCls: q('#stage .dv-spd em').className, brk: q('#stage .dv-brk').textContent,
    mth: q('#stage .dv-mth').classList.contains('show') ? q('#stage .dv-mth').textContent : '', mthWarn: q('#stage .dv-mth').classList.contains('warn'), upCls: q('#stage .dv-up').className, dnCls: q('#stage .dv-dn').className, cluOn: q('#stage .dv-clu').classList.contains('on'),
    mgear: t.mgear, kmh: +t.kmh.toFixed(1), rpm: +t.rpm.toFixed(2), stalled: t.stalled, cranking: t.cranking, voice: !!D.dvoice, more: document.body.classList.contains('moreopen'), toast: q('#stage .dv-toast').textContent };
});
const HUD_SEL = ['.dv-chip', '.dv-act', '.dv-act2', '.dv-map', '.dv-cam', '.dv-spd', '.dv-steer', '.dv-brk', '.dv-gas', '.dv-hb', '.dv-up', '.dv-dn', '.dv-clu', '#dests', '#destTog', '#moreTog', '#sizeTog', '#tiltTog', '#lookTog', '#musTog', '#gearTog', '#dSndBtn', '#fsBtn'];
const clash = () => p.evaluate((S) => {
  const R = S.map((s) => [s, document.querySelector(s)]).filter(([, e]) => e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getClientRects().length).map(([s, e]) => [s, e.getBoundingClientRect()]), out = [];
  for (const [s, r] of R) if (r.left < 4 || r.top < 4 || r.right > innerWidth - 4 || r.bottom > innerHeight - 4) out.push(`${s} off-screen ${[r.left, r.top, r.right, r.bottom].map(Math.round)}`);
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const a = R[i][1], b2 = R[j][1]; if (a.left < b2.right - 0.5 && b2.left < a.right - 0.5 && a.top < b2.bottom - 0.5 && b2.top < a.bottom - 0.5) out.push(`${R[i][0]} × ${R[j][0]}`); }
  return out.join(', ');
}, HUD_SEL);
const SIZES = [[390, 844], [360, 800], [412, 915], [915, 412], [800, 360], [731, 338]];
async function sweep(tag) { const bad = []; for (const [w, h] of SIZES) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(200); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); const c = await clash(); if (c) { bad.push(`${w}x${h}: ${c}`); console.log('    rects', w, h, await p.evaluate(() => ['.dv-spd', '.dv-up', '.dv-dn', '.dv-clu', '.dv-act2', '.dv-cam', '#gearTog'].map((s) => { const e = document.querySelector('#stage ' + s) || document.querySelector(s); if (!e) return s + ' -'; const r = e.getBoundingClientRect(); return s + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(',') + ' z' + getComputedStyle(e).zoom; }).join(' | '))); } if (tag && (w === 390 || w === 800)) await shot(`${tag}-${w}x${h}`); } await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200); return bad; }
const center = (sel, dx = 0) => p.evaluate(([s, dx]) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2 + dx, y: r.top + r.height / 2 }; }, [sel, dx]);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });

const bd = await getIn();
console.log('  上車:', JSON.stringify(bd), el());
check(bd.drv && bd.cur === 'gc8' && /上車 · GC8/.test(bd.pressed) && bd.fs, `walked to the GC8 and got in, full screen (${bd.pressed})`);
// 測試場：村子西北邊的空地（沒有碰撞物），路面照柏油算；路上的車先停
await p.evaluate(() => { const D = window.__D(), V = D.VIL, f0 = V.surfaceAt; V.surfaceAt = (x, z) => (Math.abs(x + 660) < 45 && Math.abs(z - 285) < 45 ? 0 : f0(x, z)); D.drv.setInput(null); D.drv.teleport({ x: -698, z: 305, heading: 0 }); window.__dstep(5); });
let u = await ui(); console.log('  自排:', JSON.stringify(u));
check(u.gearbox === 'at' && u.key === null && !u.mt && !u.up && !u.dn && !u.clu && u.gear === '1' && u.brk === '煞車' && !u.tog, `default is 自排 (nothing saved): no ▲ ▼ 離合器 buttons, tach shows gear 1, gearTog hidden while the ⋯ row is folded`);
await p.evaluate(() => document.getElementById('moreTog').click()); await p.waitForTimeout(100);
u = await ui();
check(u.more && u.tog && u.togText === '自排' && u.pressed === 'false', `tapping ⋯ shows the new 「自排」 button in the row (${u.togText})`);
let bad = await sweep('1-row-at');
check(!bad.length, `⋯ row with 「自排」: nothing overlapping on 6 screens (${bad.join(' | ') || 'ok'})`);
const gt = await p.evaluate(() => { document.getElementById('gearTog').click(); window.__dstep(3); return window.__toast(); });
u = await ui(); console.log('  手排:', JSON.stringify(u), gt);
check(u.gearbox === 'mt' && u.key === 'mt' && u.togText === '手排' && u.pressed === 'true' && u.mt && u.mgear === 0, `tapping it: 手排 (saved carid.gear = mt), drive.js in manual, neutral`);
check(/手排：按住「離合器」再按 ▲ ▼ 換檔/.test(gt), `toast tells how to shift (「${gt}」)`);
await p.evaluate(() => { if (document.body.classList.contains('moreopen')) document.getElementById('moreTog').click(); }); await p.waitForTimeout(100);
u = await ui();
check(u.up && u.dn && u.clu && u.gear === 'N' && /\bn\b/.test(u.gearCls) && !u.more, `folded: ▲升檔 ▼降檔 above the brake, 「離合器」 above ◀ ▶, tach shows N`);
bad = await sweep('2-mt');
check(!bad.length, `手排 buttons: nothing overlapping on 6 screens (${bad.join(' | ') || 'ok'})`);
// ⋯ 打開的時候也不壓到
await p.evaluate(() => document.getElementById('moreTog').click()); await p.waitForTimeout(100);
bad = await sweep(null); await p.evaluate(() => { if (document.body.classList.contains('moreopen')) document.getElementById('moreTog').click(); }); await p.waitForTimeout(100);
check(!bad.length, `手排 buttons with the ⋯ row open: nothing overlapping (${bad.join(' | ') || 'ok'})`);
// 空檔踩油門：提示
const gasC = await center('#stage .dv-gas'), cluC = await center('#stage .dv-clu'), upC = await center('#stage .dv-up'), dnC = await center('#stage .dv-dn');
const TG = { ...gasC, id: 1 }, TC = { ...cluC, id: 2 }, TU = { ...upC, id: 3 }, TD = { ...dnC, id: 4 };
await touch('touchStart', [TG]); await p.evaluate(() => window.__dstep(40)); u = await ui(); await touch('touchEnd', []); await p.evaluate(() => window.__dstep(5));
check(u.kmh < 0.5 && u.rpm > 0.7 && /空檔/.test(u.mth) && u.mthWarn, `gas in neutral: car stays, engine revs (${u.rpm}), orange hint 「${u.mth}」`);
// 沒按離合器按 ▲：咔咔
await touch('touchStart', [TU]); await touch('touchEnd', []); await p.evaluate(() => window.__dstep(5)); u = await ui();
check(u.mgear === 0 && /咔咔.*離合器/.test(u.mth) && !u.mthWarn, `▲ without the clutch: stays N, red hint 「${u.mth}」`);
await p.evaluate(() => window.__dstep(60));
// 按住離合器 ▲：1 檔；放開沒給油：熄火；引擎聲停
await touch('touchStart', [TC]); await p.evaluate(() => window.__dstep(3)); u = await ui(); const cluHeld = u.cluOn;
await touch('touchStart', [TC, TU]); await touch('touchEnd', [TU]); await p.evaluate(() => window.__dstep(5)); u = await ui(); // touchEnd 列的是放開的那幾根（只放 ▲、離合器還按著）
check(cluHeld && u.mgear === 1 && u.gear === '1' && u.cluOn, `holding 「離合器」 (lit ${cluHeld}) and tapping ▲: 1st gear (${JSON.stringify({ mgear: u.mgear, gear: u.gear, cluOn: u.cluOn, mth: u.mth })})`);
await touch('touchEnd', []); await p.evaluate(() => window.__dstep(90)); u = await ui(); await shot('3-stall');
check(u.stalled && u.gear === '熄' && /熄火/.test(u.mth) && !u.voice && u.rpm < 0.05, `letting the clutch go with no gas: stalled — tach 「熄」, hint 「${u.mth}」, engine sound off`);
await touch('touchStart', [TG]); await p.evaluate(() => window.__dstep(20)); u = await ui(); const crank = { cranking: u.cranking, mth: u.mth };
await p.evaluate(() => window.__dstep(100)); u = await ui(); await touch('touchEnd', []);
check(crank.cranking && /發動中/.test(crank.mth) && !u.stalled && u.voice && u.kmh > 5 && u.mgear === 1, `gas again: 「發動中⋯」 then the engine is back (sound on) and the car pulls away in 1st (${u.kmh} km/h)`);
// 紅線：▲ 亮橘、斷油噠噠噠（紅）
await touch('touchStart', [TG]); let hot = false, limHit = false, limMsg = '';
for (let i = 0; i < 150; i++) { await p.evaluate(() => window.__dstep(5)); const v = await ui(); if (/hot/.test(v.upCls)) hot = true; if (/lim/.test(v.upCls)) limHit = true; if (/噠噠噠/.test(v.mth)) limMsg = v.mth; if (limHit && limMsg) break; }
u = await ui(); await shot('4-redline');
check(hot && limHit && /噠噠噠/.test(limMsg) && u.mgear === 1 && u.rpm > 0.9, `full gas in 1st: ▲ turns orange near the red line, then red flashing + 「${limMsg}」 at the limiter, no auto upshift (still 1st, ${u.kmh} km/h)`);
// 鍵盤：Shift＋Q 升檔
await p.keyboard.down('ShiftLeft'); await p.evaluate(() => window.__dstep(3)); await p.keyboard.press('KeyQ'); await p.evaluate(() => window.__dstep(3)); await p.keyboard.up('ShiftLeft'); await p.evaluate(() => window.__dstep(30)); u = await ui();
check(u.mgear === 2 && u.gear === '2', `keyboard: Shift (clutch) + Q → 2nd gear`);
await touch('touchStart', [TG, TC, TU]); await touch('touchEnd', [TU]); await p.evaluate(() => window.__dstep(5)); await touch('touchEnd', []); await p.evaluate(() => window.__dstep(60)); u = await ui();
check(u.mgear === 3 && u.gear === '3', `touch: clutch + ▲ while driving → 3rd (${u.kmh} km/h)`);
// 檔太高：3 檔慢速踩油門 → ▼ 亮、「檔太高了」
await touch('touchStart', [TG]); await p.evaluate(() => { for (let i = 0; i < 300 && window.__D().drv.telemetry().kmh > 12; i++) { window.__D().drv.setInput({ brake: 1 }); window.__dstep(1); } window.__D().drv.setInput(null); window.__dstep(10); }); u = await ui(); await touch('touchEnd', []);
check(u.mgear === 3 && /檔太高/.test(u.mth) && /hot/.test(u.dnCls), `3rd gear at ${u.kmh} km/h with gas: 「${u.mth}」, ▼ lit`);
// 換回自排：按鈕收掉、照舊
await p.evaluate(() => document.getElementById('moreTog').click()); await p.waitForTimeout(100); await p.evaluate(() => document.getElementById('gearTog').click()); await p.evaluate(() => window.__dstep(3));
await p.evaluate(() => { if (document.body.classList.contains('moreopen')) document.getElementById('moreTog').click(); }); await p.waitForTimeout(100); u = await ui();
check(u.gearbox === 'at' && u.key === 'at' && !u.mt && !u.up && !u.dn && !u.clu && /^[1-6]$/.test(u.gear) && u.togText === '自排', `tapping 「手排」 again → 自排: buttons gone, tach back to the gear number`);
// 重新載入：記得手排
await p.evaluate(() => { localStorage.setItem('carid.gear', 'mt'); });
const re = await getIn(); u = await ui();
check(re.drv && re.gearK === 'mt' && u.gearbox === 'mt' && u.mt && u.clu && u.gear === 'N', `reload with carid.gear = mt: the car starts in manual (N, buttons shown)`);
check(!errs.length, `no page errors (${errs.length})`);
await b.close(); srv.close();
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS OK', el());
process.exit(fails.length ? 1 : 0);
