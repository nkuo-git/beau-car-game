// 第 24 批（Nick 2026-10-20「車庫外圍的那個外面那一圈的路可以弄了」，草稿 https://claude.ai/artifact/Xbe4taBBqkM6gL9VDyV3xb，Nick 選「照草稿」）：圓塔外面繞圈的斜坡
//   舊存檔停在變成路的那幾格（第 26 批：上面兩層搬到地下室，剩 3 格）→ 搬到空的格子；出門上 GC8 → 開鐵捲門開出去、右轉開上斜坡（高度照斜坡、不撞、鏡頭在上面那一圈底下）→ 3 樓的口開進去（電梯自己叫上來，不會把你的車載走）
//   → 斜坡上不能下車；3 樓裡面可以下車、走路走不出口 → 上車開到電梯上、轉到黃線 → 開出去、左轉開下斜坡到地上
//   → 走路、怪獸卡車都上不去（起點那一道擋著、跟你說）；draw calls、三角形
// 開車、走路都不是真的即時：頁面自己的開車先停住（__hold）、不畫（__noDraw），測試在頁面裡一步一步開，要截圖才畫
// node ramp-test.mjs [prefix]（截圖：<prefix>-1-aerial.png …）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = 'b4'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__G = () => GAME; window.__room = () => room;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, trip, tripS, home, TR, LODS, cur, built, walker, tripPose, tripFull,'
  + '   TWR, EL, elWho, elFree, poseF, padCars, deliver, offTower, normPark, TOWER_BAYS, towerFy, TOWER, TOWER_RAMP, towerRampY, TRAMP, garLot, HOME, GV, rampOK, rampCeil, leaveCar, switchCar, liftOK, PW });'
  + ' window.__N = () => NPC;'
  + ' window.__pol = () => (typeof police !== "undefined" ? police : null);'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } else if (window.__npcKeep) { NPC = window.__npcKeep; window.__npcKeep = null; NPC.g.visible = DRIVE.on; } };'
  + ' window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };'
  + ' window.__wstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return walker && walker.telemetry(); };';
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') {
    let html = fs.readFileSync(path.join(dir, 'art/garage.html'), 'utf8').replaceAll('https://cdn.jsdelivr.net/npm/three@0.186.1/', '/three/');
    const a = 'const RACE = { on: false, frame: raceFrame };', r = '  renderer.render(TR.scene, rcam);\n}', d1 = '  driveStep(dt);\n  if (!DRIVE.on) return;', d2 = '  renderer.render(TR.scene, dcam);\n}', d3 = '  if (indoor) { renderer.render(indoor.scene, dcam); return; }';
    for (const x of [a, r, d1, d2, d3]) if (html.split(x).length !== 2) throw new Error('hook anchor missing or not unique: ' + x);
    html = html.replace(a, `${a} ${hook}`).replace(r, '  if (!window.__fast || ++window.__fn % 12 === 0) renderer.render(TR.scene, rcam);\n}')
      .replace(d1, '  if (!window.__hold) driveStep(dt);\n  if (!DRIVE.on) return;')
      .replace(d2, '  if (!window.__noDraw) { renderer.render(TR.scene, dcam); window.__dframes = (window.__dframes || 0) + 1; }\n}')
      .replace(d3, '  if (indoor) { if (!window.__noDraw) { renderer.render(indoor.scene, dcam); window.__dframes = (window.__dframes || 0) + 1; } return; }')
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
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
p.setDefaultTimeout(300000);
const errs = [], fails = [];
p.on('pageerror', (e) => { errs.push(e.message); console.log('pageerror', e.message); });
p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_CERT|404|GPU stall|AudioContext was not allowed|ScriptProcessorNode|worklet timeout|ERR_TUNNEL|ERR_NAME|ERR_CONNECTION|fonts\.g/.test(m.text())) console.log('console', m.type(), m.text().slice(0, 240)); });
const T0 = Date.now(), el = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`;
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const ready = () => p.waitForFunction(() => document.getElementById('status').hidden, null, { timeout: 300000 });
async function shot(name) { // 畫兩格再截圖
  const n0 = await p.evaluate(() => { window.__noDraw = false; return window.__dframes || 0; });
  await p.waitForFunction((n) => (window.__dframes || 0) >= n + 2, n0, { timeout: 300000 });
  await p.evaluate(() => { window.__noDraw = true; });
  await p.screenshot({ path: `${prefix}-${name}.png` });
  const ri = await p.evaluate(() => window.__rinfo());
  console.log('  shot', `${prefix}-${name}.png`, JSON.stringify(ri), el());
  return ri;
}
// 從旁邊看（鏡頭不跟車）：cam、at＝塔的本地座標 [x, y, z]
async function freeShot(name, cam, at) {
  await p.evaluate(([cam, at]) => { const D = window.__D(), y0 = D.GAR.group.position.y, a = window.__gw(cam[0], cam[2]), b = window.__gw(at[0], at[2]); D.drv.setCameraMode('none'); D.dcam.position.set(a.x, y0 + cam[1], a.z); D.dcam.lookAt(b.x, y0 + at[1], b.z); }, [cam, at]);
  const ri = await shot(name);
  await p.evaluate(() => window.__D().drv.setCameraMode('chase'));
  return ri;
}
// 開局：GC8（開的）＋YARIS、SUPRA、GT-R；舊存檔（內容 17 以前）：YARIS 停在 2 樓 6 號、SUPRA 停在 3 樓 2 號＝第 24 批變成斜坡的路的那兩格
await p.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  const tower = Array(40).fill(null); tower[0] = 'gtr'; tower[5] = 'yaris'; tower[9] = 'supra';
  localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 500, owned: ['gc8', 'yaris', 'supra', 'gtr'], parts: {}, tyres: {}, wins: {}, cars: {}, park: { mid: 'gc8', tower } }));
});
// 開車的機器人：沿著路線（塔的本地座標）開，前面 la 公尺那一點；vmax(k, n)＝最快多快（m/s）；until() 到了就停；每 10 格叫 every(t)
await p.addInitScript(() => {
  window.__follow = (pts, frames, vmax, until, every) => {
    const D = window.__D(), d = D.drv; let k = 0, bumps = 0; const bumpAt = [];
    for (let i = 0; i < frames; i++) {
      const t = d.telemetry(), q = window.__gl(t.x, t.z);
      let bj = k, bd = 1e9, bu = 0;
      for (let j = Math.max(0, k - 1); j < Math.min(pts.length - 1, k + 6); j++) { const A = pts[j], B = pts[j + 1], vx = B[0] - A[0], vz = B[1] - A[1], u = Math.max(0, Math.min(1, ((q.x - A[0]) * vx + (q.z - A[1]) * vz) / (vx * vx + vz * vz))), e = Math.hypot(q.x - A[0] - vx * u, q.z - A[1] - vz * u); if (e < bd) { bd = e; bj = j; bu = u; } }
      k = bj; let la = 2.2 + 0.35 * Math.abs(t.v), j = bj, px = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * bu, pz = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * bu;
      while (la > 0 && j < pts.length - 1) { const B = pts[j + 1], l = Math.hypot(B[0] - px, B[1] - pz); if (l >= la) { px += ((B[0] - px) * la) / l; pz += ((B[1] - pz) * la) / l; la = 0; } else { la -= l; px = B[0]; pz = B[1]; j++; } }
      const w = window.__gw(px, pz), a = Math.atan2(-(w.z - t.z), w.x - t.x) - t.heading, aa = Math.atan2(Math.sin(a), Math.cos(a)), vm = vmax(k, pts.length);
      let thr = 1, brk = 0; if (Math.abs(t.v) > vm + 0.5) { thr = 0; brk = 1; } else if (Math.abs(t.v) > vm - 0.5) thr = 0.3;
      d.setInput({ throttle: thr, brake: brk, steer: Math.max(-1, Math.min(1, -3 * aa)) }); window.__dstep(1);
      const t2 = d.telemetry(); if (t2.bumps > t.bumps) { bumps++; const q2 = window.__gl(t2.x, t2.z), T = window.__D().TRAMP; bumpAt.push({ i, r: +Math.hypot(q2.x, q2.z).toFixed(2), a: +Math.atan2(q2.z, q2.x).toFixed(3), hl: +Math.atan2(Math.sin(t2.heading - window.__D().garLot().heading), Math.cos(t2.heading - window.__D().garLot().heading)).toFixed(2), v: +t2.v.toFixed(2), on: T.on, u: +T.u.toFixed(2), f: window.__D().GAR.floor }); }
      if (every && i % 10 === 0) every(t2);
      if (until && until(t2)) { d.setInput(null); return { ok: true, i, bumps, bumpAt }; }
    }
    d.setInput(null); return { ok: false, i: frames, bumps, bumpAt };
  };
  // 停住（煞車到停）
  window.__stop = (n = 60) => { const d = window.__D().drv; for (let i = 0; i < n; i++) { const v = d.telemetry().v; d.setInput(v > 0.15 ? { throttle: 0, brake: 1, steer: 0 } : v < -0.15 ? { throttle: 1, brake: 0, steer: 0 } : { throttle: 0, brake: 0, steer: 0, handbrake: 1 }); window.__dstep(1); } d.setInput(null); }; // 停住了就放開煞車（踩著煞車會倒車）
  window.__toast = () => [...document.querySelectorAll('#stage .dv-toast.show, #stage .wk-toast.show')].map((e) => e.textContent).join(' | ');
});

await p.goto(base, { waitUntil: 'domcontentloaded' });
await ready();
console.log('0', el(), 'page ready');
// ---- 0 塔、斜坡的數字；舊存檔停在路上的車搬走 ----
const st0 = await p.evaluate(() => {
  const D = window.__D(), R = D.TOWER_RAMP, B = D.TOWER_BAYS, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const roads = B.filter((b) => b.road), at = roads.map((b) => +wrap(Math.atan2(b.z, b.x) - R.ent(b.f)).toFixed(4));
  const fy = [0, 1, 2, 3].map((k) => +(D.towerRampY(k * Math.PI) - D.towerFy(k)).toFixed(6)); // 第 26 批：斜坡到 4F（再上去沒有了）
  let grade = 0; for (let u = 0; u < R.UEND; u += 0.01) grade = Math.max(grade, (D.towerRampY(u + 0.01) - D.towerRampY(u)) / (0.01 * R.RM));
  return { roads: roads.map((b) => b.id), floors: roads.map((b) => b.f), at, fy, top: +(D.towerRampY(R.UEND) - D.towerFy(R.NE)).toFixed(6), ne: R.NE, grade: +grade.toFixed(4), park: window.__G().park };
});
console.log('  ', JSON.stringify({ ...st0, park: undefined }));
check(JSON.stringify(st0.roads) === '[5,9,21]' && JSON.stringify(st0.floors) === '[1,2,3]' && st0.at.every((a) => Math.abs(a) < 0.01), `one spot per floor (2F–4F; the basement has no ramp) became the ramp's road, right at that floor's entrance (${st0.roads})`);
check(st0.fy.every((d) => d === 0) && st0.top === 0 && st0.ne === 3 && st0.grade < 0.16, `the ramp is level with each floor at its entrance and with 4F at the top; steepest ${(st0.grade * 100).toFixed(1)}%`);
const tw0 = st0.park.tower;
check(tw0.length === 40 && tw0[0] === 'gtr' && st0.roads.every((i) => !tw0[i]) && ['yaris', 'supra', 'gtr'].every((k) => tw0.filter((x) => x === k).length === 1) && st0.park.mid === 'gc8',
  `old save with YARIS and SUPRA in spots that are now road: both moved to free spots, GT-R kept its spot (${tw0.map((k, i) => (k ? `${i}:${k}` : '')).filter(Boolean).join(' ')})`);

// ---- 1 出門：上 GC8、開鐵捲門，開上斜坡到 3 樓 ----
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk');
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.evaluate(() => {
  const D = window.__D(), L = D.garLot(), c = Math.cos(L.heading), s = Math.sin(L.heading);
  window.__gw = (lx, lz) => ({ x: L.x + lx * c + lz * s, z: L.z - lx * s + lz * c });
  window.__gl = (x, z) => { const dx = x - L.x, dz = z - L.z; return { x: dx * c - dz * s, z: dx * s + dz * c }; };
  window.__npcPause(true); // 路上的車、人先停掉（機器人不用讓）
});
const in1 = await p.evaluate(() => {
  const W = window.__D().walker; let ok = false, k = 0;
  for (; k < 600 && !ok; k++) { ok = W.getIn(W.cars.find((c) => c.key === 'gc8')); if (!ok) window.__wstep(1); }
  let n = 0; for (; n < 1200 && !(window.__D().drv && W.mode === 'off'); n++) window.__wstep(1);
  const D = window.__D(); D.GAR.door.open(0.2); window.__dstep(40);
  const t = D.drv.telemetry(), q = window.__gl(t.x, t.z);
  return { ok, mode: W.mode, cur: D.cur, door: D.GAR.door.t, q: [+q.x.toFixed(2), +q.z.toFixed(2)], hl: +Math.atan2(Math.sin(t.heading - D.garLot().heading), Math.cos(t.heading - D.garLot().heading)).toFixed(3), ramp: D.TRAMP.on };
});
console.log('1', el(), JSON.stringify(in1));
check(in1.mode === 'off' && in1.cur === 'gc8' && in1.door === 1 && !in1.ramp, 'in GC8 on the lobby turntable, door open');
const up = await p.evaluate(() => {
  const D = window.__D(), R = D.TOWER_RAMP, RM = R.RM, deg = Math.PI / 180, F = 2, e = R.ent(F), y0 = D.GAR.group.position.y;
  const pts = [[2, 0], [6, 0], [10, 0], [13, 0], [16, 0.6], [18, 2.5], [18.6, 5]];
  for (let a = 25 * deg; a <= e - 22 * deg; a += 5 * deg) { const r = a < 45 * deg ? RM + ((18.5 - RM) * (45 * deg - a)) / (20 * deg) : a > e - 60 * deg ? RM + (16 - RM) * Math.min(1, (a - e + 60 * deg) / (30 * deg)) : RM; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  const rho = 5; for (let ph = 0; ph <= 90; ph += 10) { const sx = -rho + rho * Math.sin(ph * deg), n = rho - rho * Math.cos(ph * deg), r = 16 - n, an = e + sx / 16; pts.push([r * Math.cos(an), r * Math.sin(an)]); }
  for (const r of [9, 8]) pts.push([r * Math.cos(e), r * Math.sin(e)]);
  const o = { on0: null, maxErr: 0, camOver: -9, camN: 0, uMax: 0, ys: [], toasts: new Set(), carried: false, floors: new Set() };
  const r = window.__follow(pts, 60 * 60, (k, n) => (k >= n - 13 ? 3 : 7), (t) => { const T = window.__D().TRAMP, G = window.__D().GAR; return !T.on && G.floor === F && Math.hypot(window.__gl(t.x, t.z).x, window.__gl(t.x, t.z).z) < 9.5; }, (t) => {
    const D2 = window.__D(), T = D2.TRAMP;
    o.floors.add(D2.GAR.floor); const ts = window.__toast(); if (ts) o.toasts.add(ts);
    if (D2.tripS.car.parent !== D2.TR.scene) o.carried = true;
    if (!T.on) return;
    if (o.on0 == null) o.on0 = +T.u.toFixed(3);
    o.uMax = Math.max(o.uMax, T.u); o.maxErr = Math.max(o.maxErr, Math.abs(t.y - (y0 + D2.towerRampY(T.u))));
    if (o.ys.length < 400) o.ys.push(+t.y.toFixed(2));
    const cp = D2.dcam.position, ce = D2.rampCeil(cp.x, cp.z); if (Number.isFinite(ce)) { o.camN++; o.camOver = Math.max(o.camOver, cp.y - ce); }
    if (!window.__shotU && T.u > 4.2) { window.__shotU = true; window.__midPose = { u: T.u }; }
  });
  window.__stop(40);
  const t = D.drv.telemetry(), q = window.__gl(t.x, t.z);
  let dec = 0; for (let i = 1; i < o.ys.length; i++) dec = Math.max(dec, o.ys[i - 1] - o.ys[i]);
  return { ...r, s: +(r.i / 60).toFixed(1), on0: o.on0, maxErr: +o.maxErr.toFixed(3), camOver: +o.camOver.toFixed(2), camN: o.camN, uMax: +o.uMax.toFixed(2), dec: +dec.toFixed(3), toasts: [...o.toasts], carried: o.carried, floors: [...o.floors], floor: D.GAR.floor, on: D.TRAMP.on, y: +t.y.toFixed(2), q: [+q.x.toFixed(2), +q.z.toFixed(2)] };
});
console.log('  up:', JSON.stringify(up));
check(up.ok && up.on0 != null && up.on0 < 0.6 && up.maxErr < 0.12 && up.dec < 0.02 && up.uMax > 6, `drove out the door, turned right and up the ramp (got on at u ${up.on0}), the car stays on the road surface the whole way (off by ≤ ${up.maxErr} m, never drops), two half-laps up in ${up.s} s`);
check(up.bumps === 0, `no bumping into the low walls on the way up (${up.bumps})`);
check(up.camN > 50 && up.camOver <= 0.02, `chase camera stays under the lap above (${up.camN} samples, worst ${up.camOver} m over)`);
check(up.floor === 2 && !up.on && Math.abs(up.y - 7.7) < 0.05 && up.toasts.some((x) => /3 樓/.test(x)), `turned in at the 3F entrance: on 3F (floor ${up.floor}, y ${up.y}) 「${up.toasts.join(' / ')}」`);
const lift1 = await p.evaluate(() => { const D = window.__D(); let n = 0; for (; n < 1800 && (D.GAR.lift.busy || D.EL.ride || D.GAR.lift.floor !== 2); n++) window.__dstep(1); return { n, lf: D.GAR.lift.floor, busy: D.GAR.lift.busy, carScene: D.tripS.car.parent === D.TR.scene, toast: window.__toast() }; });
console.log('  lift:', JSON.stringify(lift1));
check(lift1.lf === 2 && !lift1.busy && lift1.carScene && !up.carried && up.toasts.some((x) => /電梯上來了/.test(x)), `the lift was not on 3F, so it came up by itself (${(lift1.n / 60).toFixed(1)} s) and did not take your car along`);
const ri3 = await shot('2-3f-entrance');
// ---- 2 3 樓裡面：下車、走不出口；上車開到電梯上、轉到黃線 ----
const out2 = await p.evaluate(() => {
  const D = window.__D(), W = D.walker; D.leaveCar(); let n = 0; for (; n < 200 && W.mode !== 'walk'; n++) window.__dstep(1);
  const p0 = D.tripPose.gc8, R = D.TOWER_RAMP, e = R.ent(2), a = window.__gw(10 * Math.cos(e), 10 * Math.sin(e)), b = window.__gw(20 * Math.cos(e), 20 * Math.sin(e));
  W.teleport({ x: a.x, z: a.z, heading: 0 }); window.__dstep(5);
  for (let i = 0; i < 240; i++) { const t = W.telemetry(), aa = Math.atan2(-(b.z - t.z), b.x - t.x) - t.camYaw; W.setInput({ x: -Math.sin(aa) * 0.8, y: Math.cos(aa) * 0.8 }); window.__wstep(1); }
  W.setInput(null); window.__wstep(10);
  const t = W.telemetry(), q = window.__gl(t.x, t.z);
  return { mode: W.mode, f: p0?.f, floor: D.GAR.floor, r: +Math.hypot(q.x, q.z).toFixed(2), ramp: D.TRAMP.on, y: +(t.y ?? -1).toFixed(2) };
});
console.log('2', el(), JSON.stringify(out2));
check(out2.mode === 'walk' && out2.f === 2 && out2.floor === 2 && out2.r < 12.1 && !out2.ramp, `got out on 3F (GC8 parked on floor ${out2.f}); walking out through the entrance stops at the glass (r ${out2.r} m): no walking on the ramp`);
const in2 = await p.evaluate(() => {
  const D = window.__D(), W = D.walker; let ok = false, k = 0;
  for (; k < 600 && !ok; k++) { ok = W.getIn(W.cars.find((c) => c.key === 'gc8')); if (!ok) window.__wstep(1); }
  let n = 0; for (; n < 1200 && !(window.__D().drv && W.mode === 'off'); n++) window.__wstep(1);
  return { ok, mode: W.mode, toast: window.__toast() };
});
// 開到電梯上（正中間附近）停好 → 面板（樓上開車多 ◀ ▶）→ 轉 4 下（180 度）車頭對著黃線（口）
const onLift = await p.evaluate(() => {
  const D = window.__D(), e = D.TOWER_RAMP.ent(2), t0 = D.drv.telemetry(), q0 = window.__gl(t0.x, t0.z);
  const r = window.__follow([[q0.x, q0.z], [4 * Math.cos(e), 4 * Math.sin(e)], [0, 0], [-3 * Math.cos(e), -3 * Math.sin(e)]], 60 * 20, () => 2, (t) => { const q = window.__gl(t.x, t.z); return Math.hypot(q.x, q.z) < 0.6; });
  window.__stop(60);
  const P = document.querySelector('#stage .elpanel'), vis = (b) => !!b && !b.hidden && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width > 0;
  const t = D.drv.telemetry(), q = window.__gl(t.x, t.z); return { ...r, who: D.elWho(), lh: D.GAR.liftHere(D.GAR.floor), lf: D.GAR.lift.floor, r: +Math.hypot(q.x, q.z).toFixed(2), v: +t.v.toFixed(2), paused: t.paused, auto: t.auto, panel: vis(P), row: vis(P?.querySelector('.elr')), btns: P ? [...P.querySelectorAll('.elg button')].map((b) => b.textContent.trim()) : [] };
});
console.log('  back in + onto the lift:', JSON.stringify(in2), JSON.stringify(onLift));
check(in2.mode === 'off' && onLift.ok && onLift.panel && onLift.row, `got back in, drove onto the lift: panel with ◀ ▶ (${onLift.btns.join(' ')})`);
for (let i = 0; i < 4; i++) {
  await p.evaluate(() => document.querySelector('#stage .elpanel .elr button[data-r="1"]').click());
  await p.evaluate(() => { const D = window.__D(); let n = 0; for (; n < 60 && !D.EL.ride; n++) window.__dstep(1); for (n = 0; n < 1200 && (D.EL.ride || D.GAR.lift.busy); n++) window.__dstep(1); window.__dstep(5); });
}
const turned = await p.evaluate(() => { const D = window.__D(), t = D.drv.telemetry(), e = D.TOWER_RAMP.ent(2), hl = t.heading - D.garLot().heading; return { dh: +Math.atan2(Math.sin(hl + e), Math.cos(hl + e)).toFixed(3), floor: D.GAR.floor }; });
check(Math.abs(turned.dh) < 0.05 && turned.floor === 2, `turned the lift 4 × 45°: the car points out along the yellow lines to the entrance (off by ${turned.dh} rad)`);
const riSign = await freeShot('2-3f-sign', [17 * Math.cos(Math.PI / 4 - 0.45), 9.4, 17 * Math.sin(Math.PI / 4 - 0.45)], [12.4 * Math.cos(Math.PI / 4), 9.6, 12.4 * Math.sin(Math.PI / 4)]); // 斜坡上看 3 樓的口（招牌）
// ---- 3 開出口、左轉開下斜坡（斜坡上不能下車）→ 到地上 ----
const down = await p.evaluate(() => {
  const D = window.__D(), R = D.TOWER_RAMP, RM = R.RM, deg = Math.PI / 180, e = R.ent(2), y0 = D.GAR.group.position.y, pts = [];
  const ex = Math.cos(e), ez = Math.sin(e), lx = Math.sin(e), lz = -Math.cos(e), at = (rad, lat) => [rad * ex + lat * lx, rad * ez + lat * lz]; // 往外、往左（往下開的方向）
  for (const r of [1, 6, 9]) pts.push(at(r, 0));
  const rho = 4.5; for (let ph = 10; ph <= 90; ph += 10) pts.push(at(9 + rho * Math.sin(ph * deg), rho * (1 - Math.cos(ph * deg)))); // 從塔裡面就開始左轉，斜斜地穿過口
  for (let a = e - 22 * deg; a >= 25 * deg; a -= 5 * deg) { const r = a < e - 60 * deg ? RM : 14.2 + (RM - 14.2) * Math.min(1, (e - 22 * deg - a) / (38 * deg)); pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  for (const [x, z] of [[16, 5.5], [18, 2], [20, -2], [23, -5], [27, -7]]) pts.push([x, z]);
  const o = { trans: [], tried: null, maxErr: 0, last: null };
  const r = window.__follow(pts, 60 * 60, (k) => (k < 13 ? 2.5 : 6), (t) => window.__gl(t.x, t.z).x > 25, (t) => {
    const D2 = window.__D(), T = D2.TRAMP, s = `${T.on ? 'ramp' : 'off'}:${D2.GAR.floor}`;
    if (s !== o.last) { o.trans.push(`${s}@${T.u.toFixed(2)}`); o.last = s; }
    if (T.on) o.maxErr = Math.max(o.maxErr, Math.abs(t.y - (y0 + D2.towerRampY(T.u))));
    if (T.on && T.u < 5 && !o.tried) { D2.drv.setInput(null); D2.leaveCar(); o.tried = { u: +T.u.toFixed(2), mode: D2.walker.mode, toast: window.__toast() }; }
  });
  window.__stop(60);
  const t = D.drv.telemetry(), q = window.__gl(t.x, t.z), sl = D.VIL.places.garst.slots[D.HOME.gs];
  return { ...r, s: +(r.i / 60).toFixed(1), trans: o.trans, tried: o.tried, maxErr: +o.maxErr.toFixed(3), floor: D.GAR.floor, on: D.TRAMP.on, dy: +(t.y - D.VIL.heightAt(t.x, t.z)).toFixed(3), q: [+q.x.toFixed(1), +q.z.toFixed(1)], mcol: sl.mcol.off, rcol: sl.rcol.every((c) => c.off === false) };
});
console.log('3', el(), JSON.stringify(down));
check(down.tried && down.tried.mode === 'off' && /在斜坡上不能下車/.test(down.tried.toast), `on the ramp you can't get out: 「${down.tried?.toast}」 (u ${down.tried?.u})`);
check(down.ok && down.trans[0].startsWith('off:2') && down.trans.some((s) => s.startsWith('ramp:2')) && down.trans.some((s) => s.startsWith('ramp:1')) && down.trans.some((s) => s.startsWith('ramp:0')) && down.trans[down.trans.length - 1].startsWith('off:0') && down.maxErr < 0.12,
  `drove out of 3F, turned left and down the ramp past 2F to the ground (${down.trans.join(' → ')}, ${down.s} s; on the road surface ±${down.maxErr} m)`);
check(down.bumps === 0 && down.floor === 0 && !down.on && Math.abs(down.dy) < 0.05 && down.mcol && down.rcol, `back on the ground outside (floor ${down.floor}, ${down.dy} m off the ground, no bumps); the ramp's ground walls are back (solid low half-lap), its start open for a car that can go up`);
const riOut = await shot('3-down-outside');
// ---- 4 從旁邊看（截圖、draw calls）----
const riAir = await freeShot('4-aerial', [42, 30, 30], [0, 8, 0]);
const riBack = await freeShot('4-back', [-40, 22, -35], [0, 8, 0]);
const riDoor = await freeShot('4-door', [26, 1.7, 8], [0, 5, 0]);
// ---- 5 走路上不去：起點那一道擋著 ----
const walk5 = await p.evaluate(() => {
  const D = window.__D(), W = D.walker, R = D.TOWER_RAMP; D.leaveCar(); let n = 0; for (; n < 200 && W.mode !== 'walk'; n++) window.__dstep(1);
  const a = window.__gw(15 * Math.cos(0.35), 15 * Math.sin(0.35)), b = window.__gw(15 * Math.cos(1.4), 15 * Math.sin(1.4)); W.teleport({ x: a.x, z: a.z, heading: 0 }); window.__dstep(5);
  for (let i = 0; i < 360; i++) { const t = W.telemetry(), aa = Math.atan2(-(b.z - t.z), b.x - t.x) - t.camYaw; W.setInput({ x: -Math.sin(aa) * 0.8, y: Math.cos(aa) * 0.8 }); window.__wstep(1); }
  W.setInput(null); window.__wstep(10);
  const t = W.telemetry(), q = window.__gl(t.x, t.z);
  return { mode: W.mode, ang: +Math.atan2(q.z, q.x).toFixed(3), a0: R.A0, r: +Math.hypot(q.x, q.z).toFixed(2), ramp: D.TRAMP.on };
});
console.log('5', el(), JSON.stringify(walk5));
check(walk5.mode === 'walk' && walk5.ang < walk5.a0 && !walk5.ramp, `walking along the ring toward the ramp: stopped at its start (angle ${walk5.ang} < ${walk5.a0.toFixed(3)}): people don't walk up`);
// ---- 6 怪獸卡車開不上去：起點擋著、跟你說 ----
const mon6 = await p.evaluate(async () => {
  const D = window.__D(), W = D.walker, g = D.tripPose.gc8; let ok = false, k = 0;
  W.teleport({ x: g.x + Math.sin(g.heading) * 2.3, z: g.z + Math.cos(g.heading) * 2.3, heading: g.heading }); window.__wstep(5); // 走回 GC8 旁邊
  for (; k < 600 && !ok; k++) { ok = W.getIn(W.cars.find((c) => c.key === 'gc8')); if (!ok) window.__wstep(1); }
  let n = 0; for (; n < 1200 && !(window.__D().drv && W.mode === 'off'); n++) window.__wstep(1);
  const G = window.__G(), a = window.__gw(15.6 * Math.cos(0.2), 15.6 * Math.sin(0.2));
  G.owned.add('monster'); D.tripPose.monster = { x: a.x, z: a.z, heading: D.garLot().heading - 0.2 - Math.PI / 2 };
  await D.switchCar('monster');
  for (let i = 0; i < 600 && !(window.__D().cur === 'monster' && window.__D().drv); i++) await new Promise((r) => setTimeout(r, 100));
  const D2 = window.__D(); window.__dstep(10);
  const seen = new Set(); let maxA = -9;
  for (let i = 0; i < 480; i++) { const t = D2.drv.telemetry(), q = window.__gl(t.x, t.z), an = Math.atan2(q.z, q.x), w = window.__gw(15.6 * Math.cos(an + 0.4), 15.6 * Math.sin(an + 0.4)), e = Math.atan2(-(w.z - t.z), w.x - t.x) - t.heading, ee = Math.atan2(Math.sin(e), Math.cos(e));
    D2.drv.setInput({ throttle: Math.abs(t.v) > 3 ? 0 : 0.6, brake: 0, steer: Math.max(-1, Math.min(1, -3 * ee)) }); window.__dstep(1); const ts = window.__toast(); if (ts) seen.add(ts); maxA = Math.max(maxA, an); }
  window.__stop(60);
  const t = D2.drv.telemetry(), q = window.__gl(t.x, t.z);
  return { getIn: k, mode: W.mode, cur: D2.cur, ok: D2.rampOK(), ramp: D2.TRAMP.on, maxA: +maxA.toFixed(3), a0: D2.TOWER_RAMP.A0, dy: +(t.y - D2.VIL.heightAt(t.x, t.z)).toFixed(3), toasts: [...seen], mcol: D2.VIL.places.garst.slots[D2.HOME.gs].mcol.off };
});
console.log('6', el(), JSON.stringify(mon6));
check(mon6.mode === 'off' && mon6.cur === 'monster' && !mon6.ok && !mon6.ramp && mon6.maxA < mon6.a0 && !mon6.mcol && mon6.toasts.some((x) => /這台太大了，不能開上斜坡/.test(x)), `the monster truck can't go up: stopped at the start (${mon6.maxA} < ${mon6.a0.toFixed(3)}), 「${mon6.toasts.join(' / ')}」`);
await shot('6-monster');

console.log('ext parts (one other home):', JSON.stringify(await p.evaluate(() => { const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3; const P = window.__D().GAR.parts; return { tris: P.reduce((s, q) => s + tri(q.geometry), 0), parts: P.map((q) => [q.name, tri(q.geometry)]) }; })));
console.log('draw calls:', JSON.stringify({ entrance3F: ri3, sign3F: riSign, outside: riOut, aerial: riAir, back: riBack, door: riDoor }));
check(!errs.length, `no page errors (${errs.length})`);
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS OK', el());
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
