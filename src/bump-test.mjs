// 比賽撞到前車（Nick 2026-10-10「比賽時撞到前車 要考量物理慣性合理的減速 不是整個完全停住」）：drive.js 會動的碰撞（vx、vz、m）
// Node（不開瀏覽器，一秒內）：平平的空地上一台會動的「對手」（盒子），用 addColliders 每一格搬一次（跟 circuit.js 一樣）
//   1) 120 km/h 追撞 80 km/h 的前車：你掉到差不多它的速度（不是停住、不倒退），它被推快一點；兩台加起來的動量差不多（只少一點）
//   2) 一樣 120 km/h 撞不會動的牆：照舊停住（舊的撞牆沒改）
//   3) 你 60 km/h，後面 110 km/h 的車撞上來：你被推快、它變慢
//   4) 擦到旁邊（並排、它快一點）：你的速度幾乎不變
// node bump-test.mjs
import './village-node-stub.mjs';
import * as THREE from 'three';
import { createDrive } from './drive.js';
const fails = [];
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const PERF = { hp: 500, kg: 1560, awd: 1, red: 8000, vmax: 290, cda: 0.66 }; // GT-R
const W = { xf: 1.33, xr: -1.335, R: 0.33, trackF: 0.75, trackR: 0.75, wF: 0.245, wR: 0.245 };
function fakeCar() {
  const car = new THREE.Group(), body = new THREE.Group(), len = W.xf - W.xr + 1.9; body.name = 'body';
  const shell = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 1.85)); shell.position.set((W.xf + W.xr) / 2, 0.72, 0); body.add(shell); car.add(body);
  const wheels = [];
  for (const [x, tr] of [[W.xf, W.trackF], [W.xr, W.trackR]]) for (const s of [-1, 1]) { const hub = new THREE.Group(); hub.position.set(x, W.R, s * tr); const wh = new THREE.Group(); hub.add(wh); car.add(hub); wheels.push(wh); }
  return { car, body, wheels, spec: { wheels: W, interior: { wheelZ: 0.37 } } };
}
const dt = 1 / 60;
function rig() {
  const S = fakeCar(), scene = new THREE.Scene(); scene.add(S.car);
  const d = createDrive({ car: S, scene, camera: null, perf: PERF, world: { surfaceAt: () => 0, colliders: [], places: {} }, keyboard: false });
  d.teleport({ x: 0, z: 0, heading: 0 });
  return d;
}
const hold = (k) => (te) => ({ throttle: te.kmh < k ? Math.min(1, (k - te.kmh) / 6 + 0.25) : 0, brake: 0, steer: 0 });
// 對手：長 4.6、寬 1.9 的盒子，照自己的速度往 +x 走（被撞的 dvx 加到自己的速度，像 circuit.js），move＝false 就是牆
function opp(x, z, kmh, move = true) { return { c: { t: 'box', x, z, hx: 2.3, hz: 0.95, rot: 0, h: 1.4, ...(move ? { vx: kmh / 3.6, vz: 0, m: 1, dvx: 0, dvz: 0 } : {}) }, v: kmh / 3.6, move }; }
function step(d, o, inp) {
  if (o.move) { o.v = Math.max(0, o.v + o.c.dvx); o.c.dvx = o.c.dvz = 0; o.c.x += o.v * dt; o.c.vx = o.v; }
  d.removeColliders('t'); d.addColliders([o.c], 't');
  d.setInput(inp(d.telemetry())); d.update(dt);
}
// 先在前面（遠遠的）把速度加到 k，再讓它出現在前面 gap 公尺
function crash({ me, them, gap = 6, lat = 0, wall = false, secs = 3, meHold = me }) {
  const d = rig(), far = opp(5000, 0, 0, false);
  for (let i = 0; i < 60 * 20 && d.telemetry().kmh < me - 0.5; i++) step(d, far, hold(me));
  const t0 = d.telemetry(), nose = t0.x + 2.6;
  const o = opp(gap >= 0 ? nose + gap + 2.3 : t0.x - 2.6 + gap - 2.3, lat, them, !wall);
  let hitAt = null, minMe = 1e9, maxMe = 0, back = false;
  const before = { me: t0.v, them: o.v };
  for (let i = 0; i < secs * 60; i++) {
    step(d, o, hold(meHold));
    const te = d.telemetry();
    if (hitAt == null && te.bumps > t0.bumps) hitAt = i;
    if (hitAt != null) { minMe = Math.min(minMe, te.v); maxMe = Math.max(maxMe, te.v); if (te.v < -0.2) back = true; }
    if (hitAt != null && i === hitAt + 6) { before.after = { me: te.v, them: o.v }; }
  }
  return { hit: hitAt != null, before, after: before.after, min: minMe, max: maxMe, back, d, o };
}
const kmh = (v) => Math.round(v * 3.6);

// 1) 追撞
const r1 = crash({ me: 120, them: 80, meHold: 0 });
console.log('  rear-end:', JSON.stringify({ hit: r1.hit, me: [kmh(r1.before.me), kmh(r1.after?.me ?? 0)], them: [kmh(r1.before.them), kmh(r1.after?.them ?? 0)], min: kmh(r1.min), back: r1.back }));
check(r1.hit && r1.after, 'rear-ending the car in front at 120 km/h counts as a bump');
check(r1.after && kmh(r1.after.me) >= 70 && kmh(r1.after.me) <= 100 && r1.min > 15 && !r1.back, `you drop to about its speed (${kmh(r1.after?.me ?? 0)} km/h, 70–100) — not a dead stop, never backwards (lowest ${kmh(r1.min)} km/h)`);
check(r1.after && kmh(r1.after.them) > 80 && kmh(r1.after.them) <= 110, `the car you hit gets pushed faster (80 → ${kmh(r1.after?.them ?? 0)} km/h)`);
const p0 = r1.before.me + r1.before.them, p1 = r1.after ? r1.after.me + r1.after.them : 0;
check(r1.after && p1 <= p0 + 0.5 && p1 >= p0 * 0.9, `momentum is about kept (${kmh(p0)} → ${kmh(p1)} km/h added up; only a little lost)`);

// 2) 撞牆照舊
const r2 = crash({ me: 120, them: 0, wall: true, meHold: 0, secs: 1.5 });
console.log('  wall:', JSON.stringify({ hit: r2.hit, after: kmh(r2.after?.me ?? 0) }));
check(r2.hit && r2.after && kmh(r2.after.me) < 15, `a wall that doesn't move still stops you like before (120 → ${kmh(r2.after?.me ?? 0)} km/h)`);

// 3) 後面撞上來
const r3 = crash({ me: 60, them: 110, gap: -4, meHold: 60 });
console.log('  hit from behind:', JSON.stringify({ hit: r3.hit, me: [kmh(r3.before.me), kmh(r3.after?.me ?? 0)], them: [kmh(r3.before.them), kmh(r3.after?.them ?? 0)] }));
check(r3.hit && r3.after && kmh(r3.after.me) > 75 && kmh(r3.after.them) < 100 && !r3.back, `a faster car hitting you from behind pushes you faster (60 → ${kmh(r3.after?.me ?? 0)} km/h) and slows itself (110 → ${kmh(r3.after?.them ?? 0)})`);

// 4) 擦到旁邊
const r4 = crash({ me: 100, them: 106, gap: -2.3, lat: 1.8, meHold: 100, secs: 1.5 });
console.log('  side rub:', JSON.stringify({ hit: r4.hit, me: [kmh(r4.before.me), kmh(r4.after?.me ?? r4.d.telemetry().v)], min: kmh(r4.min) }));
check(r4.hit && r4.min * 3.6 >= 85 && !r4.back, `rubbing side by side barely changes your speed (lowest ${r4.hit ? kmh(r4.min) : 'no touch'} km/h)`);

console.log(fails.length ? `FAILED ${fails.length}` : 'ALL OK');
process.exit(fails.length ? 1 : 0);
