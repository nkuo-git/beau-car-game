// 第 3 批（甩尾，Nick 2026-10-04「可以甩尾」）：drive.js 的甩尾、手煞車、胎痕、煙、輪胎叫
// 一、Node（不開瀏覽器，幾秒）：每台車 60 km/h 手煞車甩、後驅油門甩、四驅比較穩、停車的速度一點都不甩、沒在甩的時候跟主幹的 drive.js 一模一樣、
//     胎痕／煙、撞牆、越野車場（越野車不甩、跳、落地）、自動停車、傳送
// 二、瀏覽器（SUPRA 走去上車 → 測試場）：真的手指按（同時按油門、右轉、手煞車）、「甩尾 35°」、胎痕和煙畫出來、輪胎叫、鏡頭、
//     手煞車按鈕在 5 種螢幕（全螢幕、沒全螢幕）都不壓到別的按鈕、效能（draw calls、三角形、一步幾毫秒）、截圖
// node drift-test.mjs [prefix]（截圖：<prefix>-*.png；Node 部分：node drift-test.mjs --node）；TRUNK＝主幹的資料夾（比對用，預設 test-fixtures/trunk-0.8.35）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import './village-node-stub.mjs';
import * as THREE from 'three';
import { buildVillage, stripColliders } from './village.js';
import { buildOffroad } from './offroad.js';
import { createDrive } from './drive.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2), nodeOnly = args.includes('--node'), prefix = args.find((a) => !a.startsWith('--')) || 'drift';
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const fails = [], T0 = Date.now(), el = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`;
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const deg = (r) => Math.round((r * 180) / Math.PI);

// ================= 一、Node =================
const PERF = {
  gc8: { hp: 280, kg: 1260, awd: 1, red: 8000, vmax: 250, cda: 0.62 }, yaris: { hp: 300, kg: 1280, awd: 1, red: 7000, vmax: 230, cda: 0.66 },
  supra: { hp: 550, kg: 1520, awd: 0, drive: 0.7, red: 7200, vmax: 300, cda: 0.62 }, gtr: { hp: 500, kg: 1560, awd: 1, red: 8000, vmax: 290, cda: 0.66 },
  p918: { hp: 887, kg: 1675, awd: 1, red: 9150, vmax: 345, cda: 0.62 }, sp3: { hp: 829, kg: 1485, awd: 0, drive: 0.8, red: 9500, vmax: 340, cda: 0.62 },
  jesko: { hp: 1280, kg: 1420, awd: 0, drive: 0.8, red: 8500, vmax: 330, cda: 0.72 }, offr: { hp: 450, kg: 1700, awd: 1, red: 7000, vmax: 180, cda: 0.9, offroad: 1 },
};
const WH = { // 每台車的輪子（spec.wheels）
  gc8: { xf: 1.28, xr: -1.24, R: 0.307, trackF: 0.7625, trackR: 0.7575, wF: 0.225, wR: 0.225 }, yaris: { xf: 1.17, xr: -1.39, R: 0.319, trackF: 0.7675, trackR: 0.7825, wF: 0.225, wR: 0.225 },
  supra: { xf: 1.2125, xr: -1.3375, R: 0.325, trackF: 0.76, trackR: 0.765, wF: 0.235, wR: 0.265 }, gtr: { xf: 1.33, xr: -1.335, R: 0.33, trackF: 0.75, trackR: 0.75, wF: 0.245, wR: 0.245 },
  p918: { xf: 1.3135, xr: -1.4165, RF: 0.347, RR: 0.364, trackF: 0.832, trackR: 0.806, wF: 0.265, wR: 0.325 }, sp3: { xf: 1.21, xr: -1.441, RF: 0.3335, RR: 0.37, trackF: 0.8455, trackR: 0.8155, wF: 0.265, wR: 0.345 },
  jesko: { xf: 1.35, xr: -1.35, RF: 0.347, RR: 0.364, trackF: 0.85, trackR: 0.825, wF: 0.265, wR: 0.325 },
};
WH.offr = WH.gc8;
function fakeCar(key) { // buildCar 的樣子：car > body（車殼）、car > hub > wheel
  const car = new THREE.Group(), body = new THREE.Group(), W = WH[key], len = W.xf - W.xr + 1.9; body.name = 'body';
  const shell = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 1.85)); shell.position.set((W.xf + W.xr) / 2, 0.72, 0); body.add(shell); car.add(body);
  const wheels = [];
  for (const [x, tr] of [[W.xf, W.trackF], [W.xr, W.trackR]]) for (const s of [-1, 1]) { const hub = new THREE.Group(); hub.position.set(x, W.R ?? W.RF, s * tr); if (s < 0) hub.rotation.y = Math.PI; const wh = new THREE.Group(); hub.add(wh); car.add(hub); wheels.push(wh); }
  return { car, body, wheels, spec: { wheels: W, interior: { wheelZ: 0.37 } } };
}
const dt = 1 / 60;
function rig(key, surf = 0, extra = {}, mk = createDrive) { // 平平的空地（surf：路面）
  const S = fakeCar(key), scene = new THREE.Scene(); scene.add(S.car);
  const world = { surfaceAt: typeof surf === 'function' ? surf : () => surf, colliders: [], places: {}, ...extra };
  const d = mk({ car: S, scene, camera: null, perf: PERF[key], world, keyboard: false, ...(extra.opt || {}) });
  d.teleport({ x: 0, z: 0, heading: 0 });
  return { d, S, scene };
}
function run(d, secs, f, log) { let t = 0; for (let i = 0; i < Math.round(secs / dt); i++) { d.setInput(f(t, d.telemetry())); d.update(dt); t += dt; if (log) log(t, d.telemetry()); } }
const holdKmh = (k) => (t, te) => ({ throttle: te.kmh < k ? Math.min(1, (k - te.kmh) / 6 + 0.25) : 0, brake: 0, steer: 0 });
const ALL = ['supra', 'sp3', 'jesko', 'gc8', 'yaris', 'gtr', 'p918'], RWD = ['supra', 'sp3', 'jesko'];
console.log('一、Node', el());

// 1) 60 km/h 方向打滿＋手煞車 0.6 秒、方向再按 1 秒，然後放開：甩出去、抓回來（角度回到剛好 0）
const hb60 = {};
for (const key of ALL) {
  const { d } = rig(key); run(d, 12, holdKmh(60));
  const h0 = d.telemetry().heading; let mx = 0, rec = null, maxSkid = 0, ind = 0, smoke = 0;
  run(d, 5, (t) => ({ throttle: 0, brake: 0, steer: t < 1.6 ? 1 : 0, handbrake: t < 0.6 ? 1 : 0 }), (t, te) => {
    mx = Math.max(mx, Math.abs(te.slip)); maxSkid = Math.max(maxSkid, te.skid); smoke = Math.max(smoke, te.smoke); if (te.drifting) ind++;
    if (t > 1.6 && rec == null && te.slip === 0) rec = t - 1.6;
  });
  const te = d.telemetry();
  hb60[key] = { max: deg(mx), rec, turned: deg(Math.abs(te.heading - h0)), drifts: te.drifts, marks: te.marks, smoke, skid: +maxSkid.toFixed(2), kmh: Math.round(te.kmh), travelOk: Math.abs(te.travel - te.heading) < 1e-9 };
}
console.log('  60 km/h handbrake:', JSON.stringify(hb60));
for (const key of RWD) check(hb60[key].max >= 30 && hb60[key].max <= 50 && hb60[key].rec != null && hb60[key].rec < 2.5 && hb60[key].drifts === 1, `${key} (RWD): handbrake turn at 60 km/h slides ${hb60[key].max}° (30–50°) and grips again ${hb60[key].rec?.toFixed(2)} s after letting go of the steering (one drift counted)`);
for (const key of ['gc8', 'yaris', 'gtr', 'p918']) check(hb60[key].max >= 18 && hb60[key].max <= 32 && hb60[key].max < hb60.supra.max && hb60[key].rec != null && hb60[key].rec <= hb60.supra.rec, `${key} (AWD): handbrake turn slides less (${hb60[key].max}° vs SUPRA ${hb60.supra.max}°) and grips again sooner (${hb60[key].rec?.toFixed(2)} s)`);
check(ALL.every((k) => hb60[k].marks > 10 && hb60[k].smoke > 0 && hb60[k].skid > 0.5 && hb60[k].travelOk), `every car leaves skid marks, smoke and tyre squeal (${ALL.map((k) => `${k} ${hb60[k].marks}/${hb60[k].smoke}`).join(', ')}); after the slide travel direction == heading again`);
check(ALL.every((k) => hb60[k].turned >= 60 && hb60[k].turned <= 140), `handbrake turn swings the car round 60–140° (${ALL.map((k) => hb60[k].turned).join(', ')}) — no spin-outs`);

// 2) 油門到底＋方向打滿（從 45 km/h，3 秒）：後驅甩、四驅只有一點點；放開方向就抓回來
const pow = {};
for (const key of ALL) {
  const { d } = rig(key); run(d, 8, holdKmh(45)); let mx = 0, sum = 0, n = 0;
  run(d, 3, () => ({ throttle: 1, brake: 0, steer: 1 }), (t, te) => { mx = Math.max(mx, Math.abs(te.slip)); if (t > 1) { sum += Math.abs(te.slip); n++; } });
  let rec = null; run(d, 3, () => ({ throttle: 0, brake: 0, steer: 0 }), (t, te) => { if (rec == null && te.slip === 0) rec = t; });
  pow[key] = { max: deg(mx), avg: deg(sum / n), rec: rec && +rec.toFixed(2) };
}
console.log('  full throttle + full lock from 45 km/h:', JSON.stringify(pow));
check(RWD.every((k) => pow[k].avg >= 25 && pow[k].rec != null && pow[k].rec < 2.5), `power oversteer: RWD cars hold a slide with full throttle (${RWD.map((k) => `${k} ${pow[k].avg}°`).join(', ')}) and grip again after letting go`);
check(['gc8', 'yaris', 'gtr'].every((k) => pow[k].max <= 8) && pow.p918.max <= 15, `AWD cars stay controlled with full throttle (${['gc8', 'yaris', 'gtr', 'p918'].map((k) => `${k} ${pow[k].max}°`).join(', ')})`);
// 點一下（0.2 秒）不算
{ const { d } = rig('supra'); run(d, 8, holdKmh(45)); let mx = 0; run(d, 2, (t) => ({ throttle: 1, brake: 0, steer: t < 0.2 ? 1 : 0 }), (t, te) => { mx = Math.max(mx, Math.abs(te.slip)); });
  check(mx === 0, `SUPRA: a short tap of the steering with full throttle does not start a slide (max ${deg(mx)}°)`); }

// 3) 停車的速度（22 km/h 以下）：方向打滿、手煞車、油門、倒車怎麼按都不甩
const slow = {};
for (const key of ALL) {
  const { d } = rig(key); let mx = 0, frames = 0;
  const lg = (t, te) => { if (te.kmh < 22) { frames++; mx = Math.max(mx, Math.abs(te.slip)); } };
  for (const [k, steer, hb, thr] of [[18, 1, 1, 0.3], [15, -1, 0, 1], [20, 1, 0, 1], [12, -1, 1, 1], [20, 1, 1, 0]]) {
    run(d, 3, (t, te) => ({ throttle: te.kmh < k ? Math.max(thr, 0.3) : 0, brake: 0, steer, handbrake: hb }), lg);
  }
  run(d, 2, () => ({ throttle: 0, brake: 1, steer: 0 }), lg); run(d, 3, () => ({ throttle: 0, brake: 1, steer: 1, handbrake: 0 }), lg); // 倒車
  run(d, 2, () => ({ throttle: 0, brake: 1, steer: -1, handbrake: 1 }), lg);
  slow[key] = { mx, frames, drifts: d.telemetry().drifts };
}
check(ALL.every((k) => slow[k].mx === 0 && slow[k].drifts === 0 && slow[k].frames > 1000), `below 22 km/h no car ever slides: full lock, handbrake, throttle, reversing (${ALL.map((k) => `${k} ${slow[k].frames} frames`).join(', ')})`);

// 4) 沒在甩的時候跟主幹的 drive.js 一模一樣（同樣的輸入，最後的位置、方向、速度、轉速一點都不差）
const trunk = process.env.TRUNK || path.join(dir, 'test-fixtures/trunk-0.8.35'); // 0.8.35 的 drive.js＋terrain.js（甩尾以前的主幹）
if (fs.existsSync(path.join(trunk, 'drive.js'))) {
  const { createDrive: oldDrive } = await import(path.join(trunk, 'drive.js'));
  const script = [[holdKmh(50), 6], [() => ({ throttle: 0.6, brake: 0, steer: 0.5 }), 3], [() => ({ throttle: 0, brake: 1, steer: 0 }), 4], [() => ({ throttle: 0, brake: 1, steer: -1 }), 3],
    [() => ({ throttle: 1, brake: 0, steer: 0 }), 4], [() => ({ throttle: 0.8, brake: 0, steer: -0.6 }), 4], [() => ({ throttle: 1, brake: 0, steer: 1 }), 0.2], [() => ({ throttle: 0.3, brake: 0, steer: 0.4 }), 3],
    [(t, te) => ({ throttle: te.kmh < 15 ? 0.4 : 0, brake: 0, steer: 1 }), 5], [() => ({ throttle: 0, brake: 0.5, steer: 0 }), 4]];
  const same = [];
  for (const key of ALL) {
    const a = rig(key), b = rig(key, 0, {}, oldDrive);
    for (const [f, s] of script) { run(a.d, s, f); run(b.d, s, f); }
    const A = a.d.telemetry(), B = b.d.telemetry();
    same.push(['x', 'z', 'heading', 'v', 'rpm', 'gear'].every((k) => A[k] === B[k]) && A.drifts === 0 ? key : `${key}≠ (${A.x} vs ${B.x})`);
  }
  check(same.every((s) => !s.includes('≠')), `normal driving (no slide: gentle steering, braking, reversing, full lock at parking speed, a short full-throttle tap) is bit-identical to the trunk drive.js (${same.join(', ')})`);
} else console.log('  (no trunk drive.js at', trunk, '— skipped the bit-identical comparison)');

// 5) 反打很快拉直、往甩的方向按著油門撐得住（按鈕就玩得了）
{
  const res = {};
  for (const [nm, s2] of [['hold', 1], ['neutral', 0], ['counter', -1]]) {
    const { d } = rig('supra'); run(d, 10, holdKmh(55)); let t3 = null, at2 = 0;
    run(d, 3, (t) => ({ throttle: t < 0.5 ? 0 : 1, brake: 0, steer: t < 0.9 ? 1 : s2, handbrake: t < 0.5 ? 1 : 0 }), (t, te) => { if (t > 0.9 && t3 == null && Math.abs(te.slip) < 0.05) t3 = t - 0.9; if (Math.abs(t - 2.5) < 1e-6) at2 = deg(Math.abs(te.slip)); });
    res[nm] = { straight: t3 && +t3.toFixed(2), at2_5: at2 };
  }
  console.log('  SUPRA after the handbrake (full throttle):', JSON.stringify(res));
  check(res.hold.at2_5 >= 25 && res.counter.straight != null && res.counter.straight < 0.8 && res.neutral.straight != null && res.counter.straight <= res.neutral.straight, `SUPRA: keep pressing into the slide with throttle holds it (${res.hold.at2_5}° at 2.5 s); the other way straightens it in ${res.counter.straight} s; letting go ${res.neutral.straight} s`);
}

// 6) 其他的甩法：用力煞車馬上方向打滿（80 km/h）、很快過彎突然放油門（140 km/h）、150 km/h 手煞車（甩得不大、抓得回來）
{
  const fl = {}, hi = {};
  for (const key of ['supra', 'jesko', 'gc8']) {
    let { d } = rig(key); run(d, 14, holdKmh(80)); let mx = 0;
    run(d, 3, (t) => ({ throttle: t > 0.6 ? 0.6 : 0, brake: t < 0.35 ? 1 : 0, steer: t > 0.3 && t < 1.6 ? 1 : 0 }), (t, te) => { mx = Math.max(mx, Math.abs(te.slip)); }); fl[key] = deg(mx);
    ({ d } = rig(key)); run(d, 25, holdKmh(150)); mx = 0; let rec = null; const h0 = d.telemetry().heading;
    run(d, 4, (t) => ({ throttle: t > 0.4 ? 0.7 : 0, brake: 0, steer: t < 1.5 ? 0.8 : 0, handbrake: t < 0.4 ? 1 : 0 }), (t, te) => { mx = Math.max(mx, Math.abs(te.slip)); if (t > 1.5 && rec == null && te.slip === 0) rec = t - 1.5; });
    hi[key] = { max: deg(mx), rec: rec && +rec.toFixed(2), kmh: Math.round(d.telemetry().kmh) };
  }
  const lift = {};
  for (const key of ['supra', 'sp3']) { const { d } = rig(key); run(d, 25, holdKmh(140)); let mx = 0; run(d, 3, (t) => ({ throttle: t < 1.2 ? 1 : 0, brake: 0, steer: t < 2.5 ? 0.85 : 0 }), (t, te) => { if (t > 1.2) mx = Math.max(mx, Math.abs(te.slip)); }); lift[key] = deg(mx); }
  console.log('  brake-flick at 80:', JSON.stringify(fl), '| handbrake at 150:', JSON.stringify(hi), '| lift-off at 140:', JSON.stringify(lift));
  check(fl.supra >= 12 && fl.jesko >= 12 && fl.gc8 >= 5 && fl.gc8 < fl.supra, `brake then full lock at 80 km/h flicks the tail out (SUPRA ${fl.supra}°, JESKO ${fl.jesko}°, GC8 ${fl.gc8}°)`);
  check(Object.values(hi).every((q) => q.max >= 8 && q.max <= 30 && q.rec != null && q.rec < 2 && q.kmh > 100), `handbrake at 150 km/h: a smaller, controllable slide that grips again (${Object.entries(hi).map(([k, q]) => `${k} ${q.max}° grip ${q.rec} s`).join(', ')})`);
  check(lift.supra >= 5 && lift.sp3 >= 5, `fast sweeper at 140 km/h, lift off the throttle: the tail steps out (SUPRA ${lift.supra}°, SP3 ${lift.sp3}°)`);
}

// 7) 草地比柏油好甩
{
  const g = {};
  for (const key of ['supra', 'gc8']) for (const s of [0, 1]) { const { d } = rig(key, s); run(d, 10, holdKmh(48)); let mx = 0; run(d, 3, (t) => ({ throttle: 0.6, brake: 0, steer: t < 1.2 ? 1 : 0, handbrake: t < 0.4 ? 1 : 0 }), (t, te) => { mx = Math.max(mx, Math.abs(te.slip)); }); g[key + (s ? '-grass' : '-road')] = deg(mx); }
  check(g['supra-grass'] > g['supra-road'] && g['gc8-grass'] > g['gc8-road'], `grass slides more than asphalt (${JSON.stringify(g)})`);
}

// 8) 甩著撞牆：不會穿過去、有撞到（onImpact）、撞完不甩了
{
  const imps = []; const { d } = rig('supra', 0, { colliders: [{ t: 'box', x: 32, z: 0, hx: 1, hz: 40, rot: 0, h: 3 }], opt: { onImpact: (e) => imps.push(e.speed) } });
  run(d, 6, holdKmh(55)); let maxX = -99, mx = 0;
  run(d, 4, (t) => ({ throttle: 0.7, brake: 0, steer: 1, handbrake: t < 0.4 ? 1 : 0 }), (t, te) => { mx = Math.max(mx, Math.abs(te.slip)); });
  d.teleport({ x: 0, z: 0, heading: 0 }); run(d, 5, holdKmh(55));
  run(d, 3, (t) => ({ throttle: 0.5, brake: 0, steer: t < 0.6 ? 0.6 : 0, handbrake: t < 0.4 ? 1 : 0 }), (t, te) => { const c = te.x + Math.cos(te.heading) * 0; maxX = Math.max(maxX, c); });
  const te = d.telemetry();
  check(imps.length > 0 && maxX < 31 && Math.abs(te.slip) < 0.2, `sliding into a wall: stops at the wall (car origin x ≤ ${maxX.toFixed(2)} < 31), impact reported (${imps.map((v) => v.toFixed(1)).join(', ')} m/s), slide ends (slip ${deg(te.slip)}°)`);
}

// 9) 自動停車、傳送：不甩
{
  const { d } = rig('supra'); run(d, 10, holdKmh(55)); run(d, 0.7, (t) => ({ throttle: 1, brake: 0, steer: 1, handbrake: 1 }));
  const s1 = d.telemetry().slip; let done = false; d.parkAt({ x: d.telemetry().x + 6, z: d.telemetry().z, heading: 0 }, () => (done = true)); let mx = 0;
  for (let i = 0; i < 300 && !done; i++) { d.update(dt); mx = Math.max(mx, Math.abs(d.telemetry().slip)); }
  run(d, 0.4, (t) => ({ throttle: 1, brake: 0, steer: 1, handbrake: 1 })); d.teleport({ x: 5, z: 5, heading: 1 }); const t2 = d.telemetry();
  check(Math.abs(s1) > 0.2 && done && mx === 0 && t2.slip === 0 && t2.skid === 0 && t2.handbrake === 0 && t2.heading === 1, `parkAt in the middle of a slide (${deg(s1)}°) parks without sliding; teleport clears the slide`);
}

// 10) 胎痕過 18 秒淡掉
{
  const { d } = rig('supra'); run(d, 10, holdKmh(60)); run(d, 1.5, (t) => ({ throttle: 0, brake: 0, steer: 1, handbrake: t < 0.6 ? 1 : 0 }));
  const m1 = d.telemetry().marks; run(d, 20, () => ({ throttle: 0, brake: 1, steer: 0 })); const m2 = d.telemetry().marks, sm = d.telemetry().smoke;
  check(m1 > 10 && m2 === 0 && sm === 0, `skid marks fade after ~18 s (${m1} → ${m2}), smoke gone`);
}

// 11) 越野車場（村子＋越野車場、賽道一圈）：越野車不按手煞車一點都不甩、按了也甩得不大、跳起來落地都正常；SUPRA 在泥土路上甩得比較多也跑得完
{
  const V = buildVillage({}), OP = buildOffroad(V, {}), wrapA = (a) => { a = (a + Math.PI) % (2 * Math.PI); return a < 0 ? a + Math.PI : a - Math.PI; }, out = {};
  for (const [key, useHb] of [['offr', 0], ['offr', 1], ['supra', 0], ['gc8', 1]]) {
    const S = fakeCar(key), scene = new THREE.Scene(); scene.add(S.car); const lands = [];
    const d = createDrive({ car: S, scene, camera: null, perf: PERF[key], world: V, colliders: stripColliders(), keyboard: false, onLand: (e) => lands.push(e) });
    const g = OP.grid[0]; d.teleport({ x: g.x, z: g.z, heading: g.heading });
    let T = 0, mx = 0, bad = 0, lap = null, prevS = OP.course.project(g.x, g.z).s, dist = 0;
    for (let i = 0; i < 60 * 150; i++) {
      const t = d.telemetry(), pr = OP.course.project(t.x, t.z), la = OP.course.at((pr.s + 6 + 0.4 * Math.abs(t.v)) % OP.course.len), a = wrapA(Math.atan2(-(la.z - t.z), la.x - t.x) - t.heading);
      const k = Math.abs(OP.course.at((pr.s + 15 + Math.abs(t.v)) % OP.course.len).k), vt = Math.sqrt(7 / Math.max(k, 1e-3)), hb = useHb && k > 0.03 && t.kmh > 40;
      d.setInput({ throttle: Math.abs(t.v) < vt ? 1 : 0.2, brake: Math.abs(t.v) > vt + 3 ? 1 : 0, steer: Math.max(-1, Math.min(1, -2.5 * a)), handbrake: hb ? 1 : 0 });
      d.update(dt); T += dt;
      const t2 = d.telemetry(); if (!isFinite(t2.x) || !isFinite(t2.heading) || !isFinite(t2.y)) bad++; mx = Math.max(mx, Math.abs(t2.slip));
      dist += (wrapA(((pr.s - prevS) / OP.course.len) * 2 * Math.PI) / (2 * Math.PI)) * OP.course.len; prevS = pr.s;
      if (dist > OP.course.len) { lap = T; break; }
    }
    out[key + (useHb ? '+hb' : '')] = { lap: lap && +lap.toFixed(1), max: deg(mx), lands: lands.length, hard: lands.filter((e) => e.hard).length, bad, drifts: d.telemetry().drifts };
  }
  console.log('  off-road course lap:', JSON.stringify(out));
  check(out.offr.max === 0 && out.offr.lap > 0 && out.offr.bad === 0 && out.offr.lands > 0, `off-road car without handbrake: never slides on the dirt course, jumps and lands as before (${JSON.stringify(out.offr)})`);
  check(out['offr+hb'].max <= 20 && out['offr+hb'].lap > 0 && out['offr+hb'].bad === 0 && out['offr+hb'].hard <= out.offr.hard && out['offr+hb'].lands >= out.offr.lands, `off-road car with the handbrake in every bend: small slides only (${out['offr+hb'].max}° ≤ 20°), lap done, jumps/landings like without (${out['offr+hb'].lands} landings, ${out['offr+hb'].hard} hard vs ${out.offr.lands}/${out.offr.hard})`);
  check(out.supra.lap > 0 && out.supra.bad === 0 && out['gc8+hb'].lap > 0 && out['gc8+hb'].bad === 0, `road cars on the dirt course slide more and still finish the lap (SUPRA ${out.supra.max}°, GC8 with handbrake ${out['gc8+hb'].max}°)`);
}

// 12) 一步多久（Node，同一台電腦：甩的時候 vs 平常）
{
  const { d } = rig('supra'); run(d, 8, holdKmh(55));
  const t0 = performance.now(); run(d, 4, () => ({ throttle: 0.5, brake: 0, steer: 0.3 })); const tN = (performance.now() - t0) / 240;
  const t1 = performance.now(); run(d, 4, (t) => ({ throttle: 1, brake: 0, steer: 1, handbrake: t < 0.5 ? 1 : 0 })); const tD = (performance.now() - t1) / 240;
  console.log(`  update(1/60) in Node: ${tN.toFixed(3)} ms normal, ${tD.toFixed(3)} ms drifting (skid marks + smoke + squeal)`);
  check(tD < 1, `drive.update while drifting stays cheap (${tD.toFixed(3)} ms per frame in Node)`);
}
console.log(`Node: ${fails.length ? fails.length + ' FAILED' : 'all ok'}`, el());
if (nodeOnly) { console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join('\n- ')}` : '\nALL OK'); process.exit(fails.length ? 1 : 0); }

// ================= 二、瀏覽器 =================
console.log('二、瀏覽器', el());
const { default: pw } = await import('/opt/node22/lib/node_modules/playwright/index.js');
const three = path.join(dir, '../node_modules/three');
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__G = () => GAME; window.__S = () => S; window.__scene = () => scene; window.__eA = () => engineAudio;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, dvoice, trip, tripS, TR, LODS, cur, built, walker });'
  + ' window.__N = () => NPC;'
  + ' window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };'
  + ' window.__wstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return walker && walker.telemetry(); };';
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
async function drawAndShot(name) {
  const n0 = await p.evaluate(() => { window.__noDraw = false; return window.__dframes || 0; });
  await p.waitForFunction((n) => (window.__dframes || 0) >= n + 2, n0, { timeout: 300000 });
  await p.evaluate(() => { window.__noDraw = true; });
  await p.screenshot({ path: `${prefix}-${name}.png` });
  const ri = await p.evaluate(() => window.__rinfo()); console.log('  shot', `${prefix}-${name}.png`, JSON.stringify(ri), el()); return ri;
}
// 開局：GC8＋YARIS＋SUPRA，開 SUPRA（停在車庫中間）
await p.addInitScript(() => {
  if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'supra', scene: 'room', money: 100, owned: ['gc8', 'yaris', 'supra'], parts: {}, tyres: {}, wins: {}, cars: {} })); }
});
await p.addInitScript(() => { // 走路的小幫手（test-b4.mjs 的 walkTo／walkLocal／press／board）
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
  H.actText = () => { const e = act(); return e ? e.querySelector('span').textContent : null; };
  H.press = () => { const e = act(); if (!e) return null; const s = e.querySelector('span').textContent; e.click(); return s; };
  H.board = (maxS = 8) => { const w = W(), modes = []; for (let n = 0; n < maxS * 60; n++) { step(1); modes.push(w.mode); if (w.mode === 'off') break; } return [...new Set(modes)]; };
});
await p.goto(base, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => document.getElementById('status').hidden, null, { timeout: 300000 });
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
const bd = await p.evaluate(() => { const D = window.__D(), H = window.__H; D.walker.teleport(H.gw(-4.6, -7.7, -1.05)); H.step = (n) => window.__wstep(n); window.__wstep(20); const r = H.walkLocal([[-2.6, -2.6], [-0.6, -2.3]]); const pressed = H.press(), modes = H.board(); window.__wstep(40); const D2 = window.__D(); return { walk: r?.ok, pressed, modes, drv: !!D2.drv, cur: D2.cur }; });
console.log('  上車:', JSON.stringify(bd), el());
check(bd.drv && bd.cur === 'supra' && /上車 · SUPRA/.test(bd.pressed), `walked to the SUPRA and got in (${bd.pressed})`);
// 「手煞車」按鈕：在 HUD 裡、跟油門煞車一樣的樣子
const hbUi = await p.evaluate(() => { const e = document.querySelector('#stage .dv-hb'), cs = e && getComputedStyle(e), r = e && e.getBoundingClientRect(); return e && { text: e.textContent, label: e.getAttribute('aria-label'), bg: cs.backgroundColor, color: cs.color, radius: cs.borderRadius, r: [r.left, r.top, r.width, r.height].map(Math.round), how: [...document.querySelectorAll('.how')].some((h) => /按「手煞車」可以甩尾/.test(h.textContent) && /空白鍵手煞車/.test(h.textContent)) }; });
console.log('  手煞車 button:', JSON.stringify(hbUi));
check(hbUi && hbUi.text === '手煞車' && hbUi.label === '手煞車' && hbUi.bg === 'rgb(43, 46, 53)' && hbUi.color === 'rgb(255, 106, 31)' && hbUi.how, '手煞車 button in the driving HUD (dark rounded button, orange text, like the pedals); help text says 空白鍵手煞車 and how to drift');

// 測試場：村子西北邊的空地（沒有碰撞物）鋪一塊 90×90 的柏油（路面照柏油算）；路上的車、人先拿掉
const pad = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, X = -660, Z = 285, R = 45, f0 = V.surfaceAt;
  window.__surf0 = f0; V.surfaceAt = (x, z) => (Math.abs(x - X) < R && Math.abs(z - Z) < R ? 0 : f0(x, z));
  const THREE = D.TR.scene.constructor; // 用 scene 的 three（同一份）
  return { X, Z, R };
});
await p.evaluate(({ X, Z, R }) => { // 畫一塊灰色的柏油（只有測試用）
  const D = window.__D(), sc = D.TR.scene, any = D.drv && sc.getObjectByName('drive-skidmarks'), T = any.geometry.constructor;
  const g = new T(); const s = R; g.setAttribute('position', new any.geometry.attributes.position.constructor(new Float32Array([X - s, 0.02, Z - s, X + s, 0.02, Z - s, X - s, 0.02, Z + s, X + s, 0.02, Z + s]), 3)); g.setIndex([0, 2, 1, 1, 2, 3]);
  const m = any.material.clone(); m.vertexColors = false; m.alphaMap = null; m.transparent = false; m.depthWrite = true; m.polygonOffset = false; m.color.setRGB(0.3, 0.3, 0.31); m.onBeforeCompile = () => {};
  const mesh = new any.constructor(g, m); mesh.name = 'test-pad'; mesh.renderOrder = 0; mesh.frustumCulled = false; sc.add(mesh);
}, pad);
await p.evaluate(() => window.__N && window.__N() && (window.__N().g.visible = false));
// 輪胎叫：包一層記下 drive.js 送了什麼
await p.evaluate(() => { const A = window.__eA(), f = A.skid; window.__sq = []; A.skid = (...a) => { window.__sq.push(a); return f.apply(A, a); }; });
// 手指：CDP 的多點觸控（油門、右轉、手煞車同時按）
const center = (sel, dx = 0) => p.evaluate(([s, dx]) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2 + dx, y: r.top + r.height / 2 }; }, [sel, dx]);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const gas = await center('#stage .dv-gas'), right = await center('#stage .dv-steer', 30), hbB = await center('#stage .dv-hb');
const T1 = { ...gas, id: 1 }, T2 = { ...right, id: 2 }, T3 = { ...hbB, id: 3 };
await p.evaluate(({ X, Z }) => { const d = window.__D().drv; d.setInput(null); d.teleport({ x: X - 38, z: Z + 20, heading: 0 }); window.__dstep(5); }, pad);
await touch('touchStart', [T1]); await p.evaluate(() => { for (let i = 0; i < 420 && window.__D().drv.telemetry().kmh < 62; i++) window.__dstep(1); });
const v0 = await p.evaluate(() => window.__D().drv.telemetry().kmh);
await touch('touchStart', [T1, T2]); await touch('touchStart', [T1, T2, T3]);
const during = await p.evaluate(() => { let mx = 0, t = null, ind = null; for (let i = 0; i < 36; i++) { t = window.__dstep(1); mx = Math.max(mx, Math.abs(t.slip)); } const e = document.querySelector('#stage .dv-spd i'); ind = { shown: !e.hidden && e.getClientRects().length > 0, text: e.textContent }; return { mx, hb: t.handbrake, steer: t.steer, thr: t.throttle, ind, on: document.querySelector('#stage .dv-hb').classList.contains('on') }; });
const indHit = await p.evaluate(() => { const r = document.querySelector('#stage .dv-spd i').getBoundingClientRect(); return ['.dv-chip', '.dv-act', '.dv-act2', '.dv-map', '.dv-cam', '.dv-steer', '.dv-brk', '.dv-gas', '.dv-hb', '#dests', '#driveHome', '#dSndBtn', '#fsBtn'].filter((sel) => { const e = document.querySelector(sel); if (!e || e.closest('[hidden]') || !e.getClientRects().length || getComputedStyle(e).display === 'none') return false; const q = e.getBoundingClientRect(); return r.left < q.right - 0.5 && q.left < r.right - 0.5 && r.top < q.bottom - 0.5 && q.top < r.bottom - 0.5; }); });
check(!indHit.length, `「甩尾 N°」 does not cover any button (${indHit.join(', ') || 'ok'})`);
await touch('touchEnd', [T3]); // 放開手煞車（油門、右轉還按著；touchEnd 列的是放開的手指）
const after = await p.evaluate(() => { let mx = 0, t = null; for (let i = 0; i < 20; i++) { t = window.__dstep(1); mx = Math.max(mx, Math.abs(t.slip)); } const e = document.querySelector('#stage .dv-spd i'); return { mx, hb: t.handbrake, steer: t.steer, kmh: t.kmh, drifting: t.drifting, ind: !e.hidden ? e.textContent : null, on: document.querySelector('#stage .dv-hb').classList.contains('on'), marks: t.marks, smoke: t.smoke, skid: t.skid }; });
console.log('  touch drift:', JSON.stringify({ v0, during, after }), el());
check(during.hb === 1 && during.steer > 0.9 && during.on && during.mx > 0.3, `multi-touch: holding 油門 + 右轉 + 手煞車 together works (handbrake ${during.hb}, steer ${during.steer.toFixed(2)}, slide ${deg(during.mx)}° from ${Math.round(v0)} km/h)`);
check(after.hb === 0 && !after.on && after.steer > 0.9 && after.drifting && after.marks > 0 && after.smoke > 0 && after.skid > 0.3, `let go of 手煞車 only: steering and throttle stay pressed, still sliding (${deg(after.mx)}°), ${after.marks} skid-mark pieces, ${after.smoke} smoke puffs, squeal ${after.skid.toFixed(2)}`);
check(during.ind.shown && /^甩尾\d+°$/.test(during.ind.text.replace(/\s/g, '')) || /^甩尾\d+°$/.test((after.ind || '').replace(/\s/g, '')), `「甩尾 N°」 shows above the speedometer while sliding (${during.ind.text || after.ind})`);
const camYaw = await p.evaluate(() => { const D = window.__D(), t = D.drv.telemetry(), c = D.dcam, f = new c.position.constructor(); c.getWorldDirection(f); const yaw = Math.atan2(-f.z, f.x), w = (a) => { a = (a + Math.PI) % (2 * Math.PI); return a < 0 ? a + Math.PI : a - Math.PI; }; return { toHead: w(yaw - t.heading), toTravel: w(yaw - t.travel), slip: t.slip }; });
check(Math.abs(camYaw.slip) > 0.15 && Math.abs(camYaw.toTravel) < Math.abs(camYaw.toHead) + 0.5 && Math.abs(camYaw.toHead) > 0.05, `chase camera turns part of the way toward where the car is going (camera vs heading ${deg(camYaw.toHead)}°, vs travel ${deg(camYaw.toTravel)}°, slip ${deg(camYaw.slip)}°)`);
const shotDrift = await drawAndShot('1-drift');
const sq = await p.evaluate(() => window.__sq.slice());
check(sq.length > 3 && sq.some((a) => a[0] > 0.3) && sq.every((a) => a[0] >= 0 && a[0] <= 1 && a[1] >= 0 && a[1] <= 1), `tyre squeal follows the slide through engineAudio.skid (${sq.length} updates, max level ${Math.max(...sq.map((a) => a[0]))})`);
// 再甩一次（左邊）給截圖：煙、胎痕
await touch('touchEnd', [T1, T2]);
await p.evaluate(({ X, Z }) => { const d = window.__D().drv; d.teleport({ x: X + 25, z: Z + 42, heading: Math.PI / 2 }); window.__dstep(5); d.setInput({ throttle: 1, brake: 0, steer: 0 }); for (let i = 0; i < 400 && d.telemetry().kmh < 60; i++) window.__dstep(1); d.setInput({ throttle: 1, brake: 0, steer: -1, handbrake: 1 }); window.__dstep(25); d.setInput({ throttle: 1, brake: 0, steer: -1 }); window.__dstep(40); }, pad);
await drawAndShot('2-drift-left');
await p.evaluate(() => { const d = window.__D().drv; d.setInput({ throttle: 0, brake: 1, steer: 0 }); window.__dstep(150); d.setInput(null); window.__dstep(5); });
const rest = await drawAndShot('3-marks');
const st3 = await p.evaluate(() => { const t = window.__D().drv.telemetry(), sm = window.__D().TR.scene.getObjectByName('drive-smoke'), mk = window.__D().TR.scene.getObjectByName('drive-skidmarks'); return { slip: t.slip, kmh: t.kmh, marks: t.marks, smokeVis: sm.visible, marksVis: mk.visible, ind: document.querySelector('#stage .dv-spd i').hidden }; });
// 從上面看胎痕（鏡頭擺在測試場上面；__hold：頁面不會把鏡頭改回去）
await p.evaluate(({ X, Z }) => { const c = window.__D().dcam; c.position.set(X - 5, 34, Z + 40); c.lookAt(X, 0, Z + 2); c.updateMatrixWorld(); }, pad);
await drawAndShot('3b-marks-above');
check(st3.slip === 0 && st3.marksVis && st3.marks > 20 && st3.ind, `stopped: grip again (slip 0), indicator hidden, ${st3.marks} skid-mark pieces still on the ground`);

// 效能：同一個地方，沒有胎痕／煙 vs 有（draw calls、三角形）；一步（update＋town 的 driveStep）幾毫秒
const perf = await p.evaluate(({ X, Z }) => {
  const D = window.__D(), d = D.drv, ms = (f, n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) f(); return (performance.now() - t0) / n; };
  d.teleport({ x: X - 30, z: Z - 30, heading: 0 }); d.setInput({ throttle: 0.5, brake: 0, steer: 0.2 }); window.__dstep(20);
  const normal = ms(() => window.__dstep(1), 60);
  d.setInput({ throttle: 1, brake: 0, steer: 1, handbrake: 1 }); window.__dstep(20); d.setInput({ throttle: 1, brake: 0, steer: 1 });
  const drift = ms(() => window.__dstep(1), 60); const t = d.telemetry(); d.setInput(null);
  return { normal: +normal.toFixed(2), drift: +drift.toFixed(2), slip: t.slip, smoke: t.smoke, marks: t.marks };
}, pad);
const riD = await drawAndShot('4-perf-drift');
console.log('  perf (ms per driveStep incl. town/NPC; SwiftShader machine):', JSON.stringify(perf), 'render', JSON.stringify(riD));
check(perf.drift < perf.normal * 1.6 + 1, `per-frame cost while drifting ≈ normal (${perf.drift} vs ${perf.normal} ms per driveStep)`);
// 胎痕、煙都淡掉了：0 個 draw call（藏起來）
await p.evaluate(({ X, Z }) => { const d = window.__D().drv; d.setInput({ throttle: 0, brake: 0, steer: 0 }); window.__dstep(60 * 20); d.setInput(null); }, pad);
const vis5 = await p.evaluate(() => ({ m: window.__D().TR.scene.getObjectByName('drive-skidmarks').visible, s: window.__D().TR.scene.getObjectByName('drive-smoke').visible }));
const riC = await drawAndShot('5-clean');
const fxCost = await p.evaluate(async () => { // 同一個畫面：胎痕＋煙打開畫一次、關掉畫一次（__hold：頁面只畫不走，fxTick 不會改回去）
  const sc = window.__D().TR.scene, mk = sc.getObjectByName('drive-skidmarks'), sm = sc.getObjectByName('drive-smoke'), frame = async () => { const n = window.__dframes || 0; window.__noDraw = false; while ((window.__dframes || 0) < n + 2) await new Promise((r) => requestAnimationFrame(r)); window.__noDraw = true; return window.__rinfo(); };
  mk.visible = sm.visible = true; const on = await frame(); mk.visible = sm.visible = false; const off = await frame(); return { on, off };
});
console.log('  render after marks faded:', JSON.stringify(riC), JSON.stringify(vis5), 'fx on/off same view:', JSON.stringify(fxCost));
check(!vis5.m && !vis5.s && fxCost.on.calls - fxCost.off.calls === 2, `skid marks + smoke: hidden once faded (0 draw calls); when showing they cost exactly 2 draw calls (${fxCost.on.calls} vs ${fxCost.off.calls}, +${fxCost.on.tris - fxCost.off.tris} triangles)`);

// 手煞車按鈕：5 種螢幕、全螢幕／沒全螢幕都不壓到別的按鈕（停著：有「下車」）
const HUD_SEL = ['.dv-chip', '.dv-act', '.dv-act2', '.dv-map', '.dv-cam', '.dv-spd', '.dv-steer', '.dv-brk', '.dv-gas', '.dv-hb', '#dests', '#driveHome', '#dSndBtn', '#fsBtn'];
const clash = (only, inView) => p.evaluate(([S, only, inView]) => {
  const R = S.map((s) => [s, document.querySelector(s)]).filter(([, e]) => e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getClientRects().length).map(([s, e]) => [s, e.getBoundingClientRect()]), out = [];
  for (const [s, r] of R) if (inView && s === only && (r.left < 4 || r.top < 4 || r.right > innerWidth - 4 || r.bottom > innerHeight - 4)) out.push(`${s} off-screen`);
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { if (only && R[i][0] !== only && R[j][0] !== only) continue; const a = R[i][1], b2 = R[j][1]; if (a.left < b2.right - 0.5 && b2.left < a.right - 0.5 && a.top < b2.bottom - 0.5 && b2.top < a.bottom - 0.5) out.push(`${R[i][0]} × ${R[j][0]}`); }
  return out.join(', ');
}, [HUD_SEL, only, inView]);
await p.evaluate(({ X, Z }) => { const d = window.__D().drv; d.setInput(null); d.teleport({ x: X, z: Z, heading: 0 }); window.__dstep(10); }, pad);
const act2 = await p.evaluate(() => window.__D().drv.action2);
const sizes = [[360, 800], [412, 915], [915, 412], [800, 360], [1280, 720]], bad = [], badOff = [], rects = {};
for (const fsOn of [true, false]) {
  const isFs = await p.evaluate(() => document.body.classList.contains('fs'));
  if (isFs !== fsOn) { await p.evaluate(() => document.getElementById('fsBtn').click()); await p.waitForTimeout(300); }
  for (const [w, h] of sizes) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(250); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const c = await clash(fsOn ? null : '.dv-hb', fsOn);
    rects[`${fsOn ? 'fs' : 'page'} ${w}x${h}`] = await p.evaluate(() => { const r = document.querySelector('#stage .dv-hb').getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round).join(','); });
    if (c) (fsOn ? bad : badOff).push(`${w}x${h}: ${c}`);
    if (w === 800) await drawAndShot(fsOn ? '6-landscape-fs' : '6b-landscape-page');
  }
}
await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(250);
if (!(await p.evaluate(() => document.body.classList.contains('fs')))) { await p.evaluate(() => document.getElementById('fsBtn').click()); await p.waitForTimeout(300); }
console.log('  手煞車 rects:', JSON.stringify(rects));
check(act2 === '下車' && !bad.length, `fullscreen, stopped (下車 showing): the whole HUD incl. 手煞車 on screen and nothing overlapping at 360×800, 412×915, 915×412, 800×360, 1280×720 (${bad.join(' / ') || 'ok'})`);
check(!badOff.length, `not fullscreen: 手煞車 does not cover any other button on the same 5 screens (${badOff.join(' / ') || 'ok'})`);
await p.evaluate(() => window.__dstep(2)); await drawAndShot('7-hud-portrait');
// 鍵盤：空白鍵＝手煞車
await p.keyboard.down('Space'); const kb = await p.evaluate(() => window.__dstep(2).handbrake); await p.keyboard.up('Space'); const kb2 = await p.evaluate(() => window.__dstep(2).handbrake);
check(kb === 1 && kb2 === 0, 'keyboard: Space is the handbrake (telemetry.handbrake 1 while held)');
// 下車：煙藏起來、輪胎不叫、手煞車放開
const pre = await p.evaluate(({ X, Z }) => { const d = window.__D().drv; d.teleport({ x: X - 38, z: Z + 20, heading: 0 }); d.setInput({ throttle: 1, brake: 0, steer: 0 }); for (let i = 0; i < 420 && d.telemetry().kmh < 60; i++) window.__dstep(1); d.setInput({ throttle: 1, brake: 0, steer: 1, handbrake: 1 }); window.__dstep(30); const t = d.telemetry(), v = window.__D().TR.scene.getObjectByName('drive-smoke').visible; window.__sq.length = 0; d.pause(); return { skid: t.skid, smoke: v }; }, pad);
const paused = await p.evaluate(() => ({ smoke: window.__D().TR.scene.getObjectByName('drive-smoke').visible, sq: window.__sq.slice(), hb: window.__D().drv.telemetry().handbrake }));
check(pre.skid > 0.3 && pre.smoke && !paused.smoke && paused.sq.some((a) => a[0] === 0) && paused.hb === 0, `drive.pause() (getting out): smoke hidden, squeal off (${JSON.stringify(paused.sq)}), handbrake released`);
await p.evaluate(() => { const d = window.__D().drv; d.setInput(null); d.resume(); window.__dstep(5); });
check(!errs.length, `no page errors (${errs.join(' | ') || 'none'})`);
await b.close(); srv.close();
console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join('\n- ')}` : '\nALL OK', el());
process.exit(fails.length ? 1 : 0);
