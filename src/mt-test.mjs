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
function rig(perf = PERF) {
  const S = fakeCar(), scene = new THREE.Scene(); scene.add(S.car);
  const d = createDrive({ car: S, scene, camera: null, perf, world: { surfaceAt: () => 0, colliders: [], places: {} }, keyboard: false,
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
check(t.kmh < 0.1 && t.mgear === 0 && !t.reversing, `N 檔煞車煞到停、一直按著：還是 N（手排沒有「按著煞車＝倒車」，R 在換檔桿上）`);
run(d, 0.3, { clutch: 1 }); d.shift(-1); d.shift(-1); t = run(d, 0.2, { clutch: 1 });
check(t.kmh < 0.1 && t.mgear === -1 && t.gear === -1, `停住了按住離合器 ▼ ▼：N → R`);
t = run(d, 2, { throttle: 1 });
check(t.v < -1.5 && t.reversing, `R 檔踩油門：往後走 ${r2(-t.v * 3.6)} km/h`);
t = run(d, 2, { brake: 1 });
check(Math.abs(t.v) < 0.1 && t.mgear === -1 && t.reversing, `R 檔踩煞車：停下來（煞車不是「倒車」）、還是 R`);
run(d, 0.3, { clutch: 1 }); d.shift(1); t = run(d, 0.2, { clutch: 1 }); const gN = t.mgear; d.shift(1); t = run(d, 0.2, { clutch: 1 });
check(gN === 0 && t.mgear === 1 && !t.reversing, `按住離合器 ▲ → N（${gN}），再 ▲ → 1 檔（${t.mgear}）`);
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
// ---- 第 69 批：幾檔照真的車（PERF.ng）----
d = rig({ ...PERF, ng: 5 }); d.setGearbox('mt'); run(d, 0.2, { clutch: 1 }); for (let i = 0; i < 8; i++) d.shift(1); t = run(d, 0.2, { clutch: 1 });
check(t.ngears === 5 && t.mgear === 5, `5 檔的車（ng: 5）：按 8 次 ▲ 最多到 5 檔（${t.mgear}）、telemetry.ngears ${t.ngears}`);
d = rig({ ...PERF, ng: 5 }); t = run(d, 15, { throttle: 1 });
check(!t.mt && t.gear === 5 && t.shifts === 4 && t.kmh > 180, `5 檔的車自排：油門到底 15 秒升到 5 檔（${t.gear}、換了 ${t.shifts} 次、${Math.round(t.kmh)} km/h）`);
d = rig({ ...PERF, ng: 2, gears: [2.1, 0.86] }); t = run(d, 8, { throttle: 1 });
check(t.ngears === 2 && t.gear === 2 && t.shifts === 1, `2 速（怪獸卡車那種 gears: [2.1, 0.86]）：自排只換一次檔（${t.gear} 檔、換了 ${t.shifts} 次）`);
// ---- 第 69 批：開著突然降一檔，轉速瞬間衝上去（放開離合器那一下就到，不是慢慢爬）----
d = rig(); run(d, 6, { throttle: 1 }); d.setGearbox('mt'); t = run(d, 0.5, { throttle: 0 }); const g0 = t.mgear, r3 = t.rpm;
run(d, 0.5, { clutch: 1 }); const rC = d.telemetry().rpm; d.shift(-1); run(d, 0.1, { clutch: 1 }); const r1 = run(d, 6 / 60, { throttle: 0 }).rpm, rEnd = run(d, 0.5, { throttle: 0 }).rpm, t2 = d.telemetry();
check(g0 >= 3 && t2.mgear === g0 - 1 && rC < r3 - 0.1 && r1 > r3 + 0.1 && r1 > rEnd * 0.9 && t.kmh > 80, `${g0} 檔 ${Math.round(t.kmh)} km/h 收油（轉速 ${r2(r3)}）、踩離合器轉速掉到 ${r2(rC)}、降到 ${t2.mgear} 檔放開：0.1 秒就衝到 ${r2(r1)}（0.5 秒後 ${r2(rEnd)}）`);
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
  const shf = q('#stage .dv-shf'), slots = [...shf.children].map((b) => ({ g: +b.dataset.g, t: b.textContent, c: b.className })), by = (cls) => slots.find((x) => new RegExp(`\\b${cls}\\b`).test(x.c))?.t ?? null;
  return { gearbox: D.drv.gearbox, key: localStorage.getItem('carid.gear'), tog: vis(q('#gearTog')), togText: q('#gearTog').textContent, pressed: q('#gearTog').getAttribute('aria-pressed'), mt: q('#stage .dv').classList.contains('mt'),
    shf: vis(shf), shfOn: shf.classList.contains('on'), slots: slots.map((x) => x.t).join(''), cur: by('cur'), hot: by('hot'), lim: by('lim'), stallSlot: by('stall'), gear: q('#stage .dv-spd em').textContent, gearCls: q('#stage .dv-spd em').className, brk: q('#stage .dv-brk').textContent,
    mth: q('#stage .dv-mth').classList.contains('show') ? q('#stage .dv-mth').textContent : '', mthWarn: q('#stage .dv-mth').classList.contains('warn'), mthSize: getComputedStyle(q('#stage .dv-mth')).fontSize,
    mgear: t.mgear, ngears: t.ngears, kmh: +t.kmh.toFixed(1), v: +t.v.toFixed(2), rpm: +t.rpm.toFixed(2), stalled: t.stalled, cranking: t.cranking, voice: !!D.dvoice, more: document.body.classList.contains('moreopen'), mtgear: document.body.classList.contains('mtgear'),
    toast: q('#stage .dv-toast').textContent, toastSize: getComputedStyle(q('#stage .dv-toast')).fontSize, toastTop: Math.round(q('#stage .dv-toast').getBoundingClientRect().top) };
});
const HUD_SEL = ['.dv-chip', '.dv-act', '.dv-act2', '.dv-map', '.dv-cam', '.dv-spd', '.dv-steer', '.dv-brk', '.dv-gas', '.dv-hb', '.dv-shf', '#dests', '#destTog', '#moreTog', '#sizeTog', '#tiltTog', '#lookTog', '#musTog', '#gearTog', '#dSndBtn', '#fsBtn'];
const clash = () => p.evaluate((S) => {
  const R = S.map((s) => [s, document.querySelector(s)]).filter(([, e]) => e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getClientRects().length).map(([s, e]) => [s, e.getBoundingClientRect()]), out = [];
  for (const [s, r] of R) if (r.left < 4 || r.top < 4 || r.right > innerWidth - 4 || r.bottom > innerHeight - 4) out.push(`${s} off-screen ${[r.left, r.top, r.right, r.bottom].map(Math.round)}`);
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const a = R[i][1], b2 = R[j][1]; if (a.left < b2.right - 0.5 && b2.left < a.right - 0.5 && a.top < b2.bottom - 0.5 && b2.top < a.bottom - 0.5) out.push(`${R[i][0]} × ${R[j][0]}`); }
  return out.join(', ');
}, HUD_SEL);
const SIZES = [[390, 844], [360, 800], [412, 915], [915, 412], [800, 360], [731, 338]];
async function sweep(tag) { const bad = []; for (const [w, h] of SIZES) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(200); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); const c = await clash(); if (c) { bad.push(`${w}x${h}: ${c}`); console.log('  clash', w, h, c); } if (tag && (w === 390 || w === 800)) await shot(`${tag}-${w}x${h}`); } await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200); return bad; }
const center = (sel, dx = 0) => p.evaluate(([s, dx]) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2 + dx, y: r.top + r.height / 2 }; }, [sel, dx]);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const stepN = (n) => p.evaluate((n) => window.__dstep(n), n);
// 換檔桿：一根手指（id 9）按在中間、往上（dir 1）或往下滑 px 像素；others＝別的還按著的手指；release＝要不要放開
async function swipe(dir, { others = [], px = 40, release = true } = {}) {
  const c = await center('#stage .dv-shf'), S = { ...c, id: 9 };
  await touch('touchStart', [...others, S]); await stepN(3);
  await touch('touchMove', [...others, { ...S, y: S.y - dir * px }]); await stepN(3);
  if (release) { await touch('touchEnd', [S]); await stepN(6); } // touchEnd 列的是放開的手指；放開 0.12 秒接上，過半（0.06 秒）那一下算放開
  return S;
}

let bd = await getIn();
console.log('  上車:', JSON.stringify(bd), el());
check(bd.drv && bd.cur === 'gc8' && /上車 · GC8/.test(bd.pressed) && bd.fs, `walked to the GC8 and got in, full screen (${bd.pressed})`);
// 測試場：村子西北邊的空地（沒有碰撞物），路面照柏油算；路上的車先停
await p.evaluate(() => { const D = window.__D(), V = D.VIL, f0 = V.surfaceAt; V.surfaceAt = (x, z) => (Math.abs(x + 660) < 45 && Math.abs(z - 285) < 45 ? 0 : f0(x, z)); D.drv.setInput(null); D.drv.teleport({ x: -698, z: 305, heading: 0 }); window.__dstep(5); });
let u = await ui(); console.log('  AT:', JSON.stringify(u));
check(u.gearbox === 'at' && u.key === null && !u.mt && !u.shf && u.gear === '1' && u.brk === '煞車' && !u.tog && !u.mtgear, `default is AT (nothing saved): no shifter, tach shows gear 1, gearTog hidden while the ⋯ row is folded`);
await p.evaluate(() => { window.__D().drv.toast('到內湖了！這裡的路、房子、捷運都照真的地圖做的', 3000); }); u = await ui();
check(u.toastSize === '13px' && u.toastTop > 100 && u.toastTop < 160, `pop-up text is small (${u.toastSize}) and sits up under the map (top ${u.toastTop}px), not in the middle of the view`);
await p.evaluate(() => document.getElementById('moreTog').click()); await p.waitForTimeout(100);
u = await ui();
check(u.more && u.tog && u.togText === 'AT' && u.pressed === 'false', `tapping ⋯ shows the 「AT」 button in the row (${u.togText})`);
let bad = await sweep('1-row-at');
check(!bad.length, `⋯ row with 「AT」: nothing overlapping on 6 screens (${bad.join(' | ') || 'ok'})`);
const gt = await p.evaluate(() => { document.getElementById('gearTog').click(); window.__dstep(3); return window.__toast(); });
u = await ui(); console.log('  MT:', JSON.stringify(u), gt);
check(u.gearbox === 'mt' && u.key === 'mt' && u.togText === 'MT' && u.pressed === 'true' && u.mt && u.mgear === 0 && u.mtgear, `tapping it: MT (saved carid.gear = mt), drive.js in manual, neutral`);
check(/MT.*換檔桿.*往上滑/.test(gt), `toast tells how to shift (「${gt}」)`);
await p.evaluate(() => { if (document.body.classList.contains('moreopen')) document.getElementById('moreTog').click(); }); await p.waitForTimeout(100);
u = await ui();
check(u.shf && u.slots === '54321NR' && u.cur === 'N' && u.gear === 'N' && /\bn\b/.test(u.gearCls) && u.ngears === 5 && !u.more, `folded: shifter on the left with GC8's 5 gears (${u.slots}), N lit, tach shows N`);
bad = await sweep('2-mt');
check(!bad.length, `shifter: nothing overlapping on 6 screens (${bad.join(' | ') || 'ok'})`);
// ⋯ 打開的時候也不壓到
await p.evaluate(() => document.getElementById('moreTog').click()); await p.waitForTimeout(100);
bad = await sweep(null); await p.evaluate(() => { if (document.body.classList.contains('moreopen')) document.getElementById('moreTog').click(); }); await p.waitForTimeout(100);
check(!bad.length, `shifter with the ⋯ row open: nothing overlapping (${bad.join(' | ') || 'ok'})`);
// 「去哪裡」打開：換檔桿藏起來，不壓到清單
await p.evaluate(() => document.getElementById('destTog').click()); await p.waitForTimeout(100);
const dOpen = await p.evaluate(() => ({ open: document.body.classList.contains('destsopen'), vis: getComputedStyle(document.querySelector('#stage .dv-shf')).visibility }));
await p.evaluate(() => { if (document.body.classList.contains('destsopen')) document.getElementById('destTog').click(); }); await p.waitForTimeout(100);
check(dOpen.open && dOpen.vis === 'hidden', `「去哪裡」 open: the shifter hides (${dOpen.vis})`);
// 空檔踩油門：提示、引擎空催、車不動
const gasC = await center('#stage .dv-gas'), TG = { ...gasC, id: 1 };
await touch('touchStart', [TG]); await stepN(40); u = await ui(); await touch('touchEnd', [TG]); await stepN(5);
check(u.kmh < 0.5 && u.rpm > 0.7 && /空檔.*往上滑/.test(u.mth) && u.mthWarn && u.mthSize === '13px', `gas in neutral: car stays, engine revs (${u.rpm}), small orange hint 「${u.mth}」`);
// 鍵盤沒按 Shift 按 Q：咔咔
await p.keyboard.press('KeyQ'); await stepN(5); u = await ui();
check(u.mgear === 0 && /咔咔/.test(u.mth) && !u.mthWarn, `Q without the clutch (Shift): stays N, red hint 「${u.mth}」`);
await stepN(60);
// 按著換檔桿往上滑：1 檔（手指還按著＝離合器）；再滑更多也只換這一檔；放開沒給油：熄火
let S = await swipe(1, { release: false }); u = await ui(); const held = { on: u.shfOn, mgear: u.mgear, gear: u.gear, cur: u.cur };
await touch('touchMove', [{ ...S, y: S.y - 120 }]); await stepN(3); u = await ui(); const more = u.mgear;
await touch('touchEnd', [S]); await stepN(90); u = await ui(); await shot('3-stall');
check(held.on && held.mgear === 1 && held.gear === '1' && held.cur === '1', `finger on the shifter, swipe up: 1st gear while held (${JSON.stringify(held)})`);
check(more === 1, `swiping further in the same touch changes nothing (still ${more})`);
check(u.stalled && u.gear === '熄' && u.stallSlot === '1' && /熄火/.test(u.mth) && !u.voice && u.rpm < 0.05 && !u.shfOn, `letting go with no gas: stalled — tach 「熄」, slot 1 grey, hint 「${u.mth}」, engine sound off`);
await touch('touchStart', [TG]); await stepN(20); u = await ui(); const crank = { cranking: u.cranking, mth: u.mth };
await stepN(100); u = await ui(); await touch('touchEnd', [TG]);
check(crank.cranking && /發動中/.test(crank.mth) && !u.stalled && u.voice && u.kmh > 5 && u.mgear === 1, `gas again: 「發動中⋯」 then the engine is back (sound on) and the car pulls away in 1st (${u.kmh} km/h)`);
// 紅線：上面那一格亮橘、斷油噠噠噠（閃紅）
await touch('touchStart', [TG]); let hot = false, limHit = false, limMsg = '';
for (let i = 0; i < 150; i++) { await stepN(5); const v = await ui(); if (v.hot === '2') hot = true; if (v.lim === '2') limHit = true; if (/噠噠噠/.test(v.mth)) limMsg = v.mth; if (limHit && limMsg) break; }
u = await ui(); await shot('4-redline');
check(hot && limHit && /噠噠噠.*往上滑/.test(limMsg) && u.mgear === 1 && u.rpm > 0.9, `full gas in 1st: slot 2 turns orange near the red line, then flashes red + 「${limMsg}」 at the limiter, no auto upshift (still 1st, ${u.kmh} km/h)`);
// 鍵盤：Shift＋Q 升檔
await p.keyboard.down('ShiftLeft'); await stepN(3); await p.keyboard.press('KeyQ'); await stepN(3); await p.keyboard.up('ShiftLeft'); await stepN(30); u = await ui();
check(u.mgear === 2 && u.gear === '2', `keyboard: Shift (clutch) + Q → 2nd gear`);
// 油門按著、另一根手指滑換檔桿：3 檔
await swipe(1, { others: [TG] }); await stepN(60); u = await ui();
check(u.mgear === 3 && u.gear === '3' && u.cur === '3', `gas held + swipe up with another finger → 3rd (${u.kmh} km/h)`);
// 開著突然降一檔：放開那一下轉速衝上去
await stepN(60); await touch('touchEnd', [TG]); await stepN(30); u = await ui(); const b3 = u.rpm, kb3 = u.kmh;
S = await swipe(-1, { release: false }); u = await ui(); const bC = u.rpm; await touch('touchEnd', [S]); await stepN(6); u = await ui(); const b1 = u.rpm; await stepN(30); const bEnd = (await ui()).rpm;
check(u.mgear === 2 && bC < b3 - 0.1 && b1 > b3 + 0.1 && b1 > bEnd * 0.9, `coasting in 3rd at ${kb3} km/h (rpm ${b3}), finger down drops it to ${bC}, swipe down + let go → 2nd, rpm jumps to ${b1} at once (${bEnd} after 0.5 s)`);
await swipe(1); u = await ui(); check(u.mgear === 3, `swipe up again → back to 3rd`);
// 檔太高：3 檔慢速踩油門 → 下面那一格亮、「檔太高了」
await touch('touchStart', [TG]); await p.evaluate(() => { for (let i = 0; i < 300 && window.__D().drv.telemetry().kmh > 12; i++) { window.__D().drv.setInput({ brake: 1 }); window.__dstep(1); } window.__D().drv.setInput(null); window.__dstep(10); }); u = await ui(); await touch('touchEnd', [TG]);
check(u.mgear === 3 && /檔太高.*往下滑/.test(u.mth) && u.hot === '2', `3rd gear at ${u.kmh} km/h with gas: 「${u.mth}」, slot 2 lit`);
// 停住：3 → 2 → 1 → N（N 踩油門不動）→ R（倒車，油門往後走）
await p.evaluate(() => { for (let i = 0; i < 400 && window.__D().drv.telemetry().kmh > 0.3; i++) { window.__D().drv.setInput({ brake: 1 }); window.__dstep(1); } window.__D().drv.setInput(null); window.__dstep(10); });
await touch('touchStart', [TG]); await swipe(-1, { others: [TG] }); await swipe(-1, { others: [TG] }); await swipe(-1, { others: [TG] }); await touch('touchEnd', [TG]); // 輕輕滾著換（停住放離合器沒油會熄火，那是對的）
await p.evaluate(() => { for (let i = 0; i < 400 && window.__D().drv.telemetry().kmh > 0.3; i++) { window.__D().drv.setInput({ brake: 1 }); window.__dstep(1); } window.__D().drv.setInput(null); window.__dstep(10); });
u = await ui(); const atN = { mgear: u.mgear, gear: u.gear, cur: u.cur, stalled: u.stalled };
await touch('touchStart', [TG]); await stepN(40); u = await ui(); await touch('touchEnd', [TG]); await stepN(5); const nGas = { kmh: u.kmh, rpm: u.rpm };
check(atN.mgear === 0 && atN.gear === 'N' && atN.cur === 'N' && !atN.stalled && nGas.kmh < 0.5 && nGas.rpm > 0.7, `three swipes down from 3rd (gas on) → N, braking to a stop stays N (${JSON.stringify(atN)}); gas in N revs (${nGas.rpm}) but the car stays`);
await swipe(-1); u = await ui(); const atR = { mgear: u.mgear, gear: u.gear, cur: u.cur, cls: u.gearCls };
await touch('touchStart', [TG]); await stepN(60); u = await ui(); await touch('touchEnd', [TG]); await stepN(5);
check(atR.mgear === -1 && atR.gear === 'R' && atR.cur === 'R' && /\br\b/.test(atR.cls) && u.v < -0.5, `one more swipe down at a standstill → R (red); gas drives backwards (${u.kmh} km/h, v ${u.v})`);
await p.evaluate(() => { for (let i = 0; i < 400 && window.__D().drv.telemetry().kmh > 0.3; i++) { window.__D().drv.setInput({ brake: 1 }); window.__dstep(1); } window.__D().drv.setInput(null); window.__dstep(10); });
u = await ui(); const stillR = u.mgear; await swipe(1); await swipe(1); u = await ui();
check(stillR === -1 && u.mgear === 1 && u.stalled, `braking to a stop in R stays R; swipe up twice → N → 1st (letting go in 1st with no gas stalls, as it should)`);
// 換回自排：換檔桿收掉、照舊（熄火也清掉）
await p.evaluate(() => document.getElementById('moreTog').click()); await p.waitForTimeout(100); await p.evaluate(() => document.getElementById('gearTog').click()); await stepN(3);
await p.evaluate(() => { if (document.body.classList.contains('moreopen')) document.getElementById('moreTog').click(); }); await p.waitForTimeout(100); u = await ui();
check(u.gearbox === 'at' && u.key === 'at' && !u.mt && !u.shf && !u.mtgear && /^[1-6]$/.test(u.gear) && u.togText === 'AT', `tapping 「MT」 again → AT: shifter gone, tach back to the gear number`);
// 重新載入：記得手排
await p.evaluate(() => { localStorage.setItem('carid.gear', 'mt'); });
let re = await getIn(); u = await ui();
check(re.drv && re.gearK === 'mt' && u.gearbox === 'mt' && u.mt && u.shf && u.gear === 'N', `reload with carid.gear = mt: the car starts in manual (N, shifter shown)`);
// 自排車（918：7 速雙離合器）：沒有 MT 那一格、carid.gear 是 mt 也還是自排、7 檔
await p.evaluate(() => { const t = JSON.parse(localStorage.getItem('carid.tune')); t.cur = 'p918'; t.owned = ['gc8', 'p918']; localStorage.setItem('carid.tune', JSON.stringify(t)); });
re = await getIn(); await p.evaluate(() => document.getElementById('moreTog').click()); await p.waitForTimeout(100); u = await ui(); console.log('  918:', JSON.stringify(bd = re), JSON.stringify(u));
check(re.drv && re.cur === 'p918' && u.more && !u.tog && u.gearbox === 'at' && !u.mt && !u.shf && u.ngears === 7, `an automatic car (918, 7-speed): no AT／MT button in the ⋯ row, stays AT even though carid.gear = mt, 7 gears`);
check(!errs.length, `no page errors (${errs.length})`);
await b.close(); srv.close();
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS OK', el());
process.exit(fails.length ? 1 : 0);
