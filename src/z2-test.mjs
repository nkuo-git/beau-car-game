// 第 56 批（Nick 2026-10-30 看圖卡片「好，做進去」）：Z2 沙灘車＝騎的四輪沙灘車（terrain.js「offroad」那一級；很輕：不輾東西）
//   車庫頁：Z2 是你的車、沒有車內（騎的）、「車內」＝騎的人的眼睛 → 出門騎上 Z2：你的人坐在上面（戴安全帽、手握把手、腳踩腳踏板）
//   → 開鐵捲門、右轉開上斜坡到 3 樓（跟 jeep-test 同一條路線）→ 坐電梯去 B1、往前開進格子、下車（人拿下來）→ 上車、回 1 樓、開出鐵捲門
//   → 快速道路油門踩到底（極速 105）→ 手把跟著轉、手跟著把手 → 第一人稱（鏡頭在騎的人的眼睛、人不畫、沒有後照鏡）→ 泥巴池 → 撞路邊的小東西（不會扁、會擋）→ draw calls
// 開車、走路都不是真的即時：頁面自己的開車先停住（__hold）、不畫（__noDraw），測試在頁面裡一步一步開，要截圖才畫
// node z2-test.mjs [prefix]（截圖：<prefix>-*.png；沒給＝../out/z2/z2）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const K = 'z2', CAR = { name: 'Z2', what: 'Z2 ATV', price: 30, top: 105, hwMin: 85 };
const [prefix = '../out/z2/z2'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__G = () => GAME; window.__room = () => room; window.__CV = () => CABIN_VIEW; window.__P = () => PERF;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, trip, tripS, TR, LODS, cur, built, walker, tripPose, TWR, EL, elWho, padCars, TOWER_BAYS, towerFy, TOWER_RAMP, towerRampY, TRAMP, garLot, rampCeil, leaveCar, PW, S, crushFx, police, RIDER, dEye, Z2_RIDE, MIR, camera });'
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
async function gshot(name) { // 車庫頁（它自己的 loop 一直在畫）：等兩格再截圖
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await p.screenshot({ path: `${prefix}-${name}.png` });
  const ri = await p.evaluate(() => window.__rinfo());
  console.log('  shot', `${prefix}-${name}.png`, JSON.stringify(ri), el());
  return ri;
}
// 開局：Z2（開的，停在一樓電梯上）＋GC8（2 樓 1 號）
await p.addInitScript((k) => {
  window.__K = k;
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  const tower = Array(40).fill(null); tower[0] = 'gc8';
  localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: k, scene: 'room', money: 500, owned: ['gc8', k], parts: {}, tyres: {}, wins: {}, cars: {}, park: { mid: k, tower } }));
}, K);
// 開車的機器人（跟 ramp-test 一樣）：沿著路線（塔的本地座標）開，前面 la 公尺那一點；vmax(k, n)＝最快多快（m/s）；until() 到了就停；每 10 格叫 every(t)
await p.addInitScript(() => {
  window.__follow = (pts, frames, vmax, until, every) => {
    const D = window.__D(), d = D.drv; let k = 0, bumps = 0;
    for (let i = 0; i < frames; i++) {
      const t = d.telemetry(), q = window.__gl(t.x, t.z);
      let bj = k, bd = 1e9, bu = 0;
      for (let j = Math.max(0, k - 1); j < Math.min(pts.length - 1, k + 6); j++) { const A = pts[j], B = pts[j + 1], vx = B[0] - A[0], vz = B[1] - A[1], u = Math.max(0, Math.min(1, ((q.x - A[0]) * vx + (q.z - A[1]) * vz) / (vx * vx + vz * vz))), e = Math.hypot(q.x - A[0] - vx * u, q.z - A[1] - vz * u); if (e < bd) { bd = e; bj = j; bu = u; } }
      k = bj; let la = 2.2 + 0.35 * Math.abs(t.v), j = bj, px = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * bu, pz = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * bu;
      while (la > 0 && j < pts.length - 1) { const B = pts[j + 1], l = Math.hypot(B[0] - px, B[1] - pz); if (l >= la) { px += ((B[0] - px) * la) / l; pz += ((B[1] - pz) * la) / l; la = 0; } else { la -= l; px = B[0]; pz = B[1]; j++; } }
      const w = window.__gw(px, pz), a = Math.atan2(-(w.z - t.z), w.x - t.x) - t.heading, aa = Math.atan2(Math.sin(a), Math.cos(a)), vm = vmax(k, pts.length);
      let thr = 1, brk = 0; if (Math.abs(t.v) > vm + 0.5) { thr = 0; brk = 1; } else if (Math.abs(t.v) > vm - 0.5) thr = 0.3;
      d.setInput({ throttle: thr, brake: brk, steer: Math.max(-1, Math.min(1, -3 * aa)) }); window.__dstep(1);
      const t2 = d.telemetry(); if (t2.bumps > t.bumps) bumps++;
      if (every && i % 10 === 0) every(t2);
      if (until && until(t2)) { d.setInput(null); return { ok: true, i, bumps }; }
    }
    d.setInput(null); return { ok: false, i: frames, bumps };
  };
  window.__stop = (n = 60) => { const d = window.__D().drv; for (let i = 0; i < n; i++) { const v = d.telemetry().v; d.setInput(v > 0.15 ? { throttle: 0, brake: 1, steer: 0 } : v < -0.15 ? { throttle: 1, brake: 0, steer: 0 } : { throttle: 0, brake: 0, steer: 0, handbrake: 1 }); window.__dstep(1); } d.setInput(null); };
  window.__toast = () => [...document.querySelectorAll('#stage .dv-toast.show, #stage .wk-toast.show')].map((e) => e.textContent).join(' | ');
});

await p.goto(base, { waitUntil: 'domcontentloaded' });
await ready();
console.log('0', el(), 'page ready');
// 身體某個點（Object3D）在車身座標的位置
await p.addScriptTag({ content: 'window.__bodyAt = (o) => { const D = window.__D(), v = D.dcam.position.clone(); o.updateWorldMatrix(true, false); o.getWorldPosition(v); D.tripS.body.updateWorldMatrix(true, false); D.tripS.body.worldToLocal(v); return [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]; };' });
// ---- 0 車庫頁：Z2 是你的車、沒有車內（騎的）、手把是自己一組；「車內」＝騎的人的眼睛 ----
await p.waitForFunction(() => window.__D().built[window.__K]?.car, null, { timeout: 120000 });
const g0 = await p.evaluate(() => {
  const k = window.__K, D = window.__D(), C = D.built[k], btn = document.querySelector(`#cars button[data-car="${k}"]`), V = window.__CV()[k], P = window.__P()[k];
  return { cur: D.cur, btn: btn ? btn.querySelector('span').textContent : null, name: btn?.querySelector('b')?.textContent, cabin: !!C.cabin, interior: !!C.body.getObjectByName('interior'), bars: !!C.body.getObjectByName('bars'), eye: V?.eye, mid: window.__G().park.mid,
    perf: { price: P.price, hp: P.hp, vmax: P.vmax, top: P.top, offroad: P.offroad, light: P.light, big: !!P.big } };
});
console.log('  garage:', JSON.stringify(g0));
check(g0.cur === K && g0.name === CAR.name && g0.btn === '你的車' && g0.mid === K, `garage page: the ${CAR.what} is your car, parked on the lobby lift`);
check(!g0.cabin && !g0.interior && g0.bars && g0.eye && g0.eye[1] > 1.4, `you ride it: no car cockpit, no box interior; the handlebars are their own group (they turn); first-person eye ${g0.eye?.[1]} m up`);
check(g0.perf.price === CAR.price && g0.perf.offroad === 1 && g0.perf.light === 1 && !g0.perf.big && g0.perf.vmax === CAR.top && g0.perf.top === CAR.top, `sold at the 越野車行 for ${CAR.price} 萬: an off-road vehicle of normal size (fits the tower), light (does not crush things), top speed ${CAR.top} km/h even fully tuned`);
const riG = await gshot('0-garage');
const seat = await p.evaluate(async () => {
  document.getElementById('seatBtn').click(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const D = window.__D(), V = window.__CV()[window.__K], c = D.camera.position.clone(), e = c.clone().set(...V.eye); D.S.body.updateWorldMatrix(true, false); D.S.body.localToWorld(e);
  return { d: +c.distanceTo(e).toFixed(3), on: document.getElementById('seatBtn').getAttribute('aria-pressed') };
});
const riSeat = await gshot('0-seat');
await p.evaluate(() => document.getElementById('seatBtn').click());
check(seat.on === 'true' && seat.d < 0.05, `garage page 「車內」: the camera sits at the rider's eye point on the ATV (${seat.d} m)`);

// ---- 1 出門：騎上 Z2（你的人坐在上面、戴安全帽、手握把手、腳踩腳踏板）、開鐵捲門 ----
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk');
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.evaluate(() => {
  const D = window.__D(), L = D.garLot(), c = Math.cos(L.heading), s = Math.sin(L.heading);
  window.__gw = (lx, lz) => ({ x: L.x + lx * c + lz * s, z: L.z - lx * s + lz * c });
  window.__gl = (x, z) => { const dx = x - L.x, dz = z - L.z; return { x: dx * c - dz * s, z: dx * s + dz * c }; };
  window.__npcPause(true); // 路上的車、人先停掉（機器人不用讓）
});
const before = await p.evaluate(() => { const R = window.__D().RIDER; return { made: !!R.C, on: !!R.S }; });
const in1 = await p.evaluate(() => {
  const W = window.__D().walker; let ok = false, k = 0;
  for (; k < 600 && !ok; k++) { ok = W.getIn(W.cars.find((c) => c.key === window.__K)); if (!ok) window.__wstep(1); }
  let n = 0; for (; n < 1200 && !(window.__D().drv && W.mode === 'off'); n++) window.__wstep(1);
  const D = window.__D(); D.GAR.door.open(0.2); window.__dstep(40);
  const t = D.drv.telemetry(), y0 = D.GAR.group.position.y, R = D.RIDER, C = R.C, Z = D.Z2_RIDE;
  const foot = (nm) => window.__bodyAt(C.bones.find((b) => b.name === nm));
  return { ok, mode: W.mode, cur: D.cur, door: D.GAR.door.t, rideOn: t.rideOn, cls: t.cls, air: t.air, dy: +(t.y - y0).toFixed(3), wheels: t.wheels,
    rider: !!C && C.group.parent === D.tripS.body && C.group.visible && R.S === D.tripS, hat: C?.look.hat, walkerHidden: !W.character.group.visible, state: C?.state,
    handR: window.__bodyAt(C.hand), handL: window.__bodyAt(C.handL), grip: Z.grip, footR: foot('footR'), footL: foot('footL'), ft: Z.foot, eye: window.__bodyAt(C.eyes), dEye: D.dEye?.eye };
});
console.log('1', el(), JSON.stringify(in1));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
check(in1.mode === 'off' && in1.cur === K && in1.door === 1, `on the ${CAR.name} on the lobby turntable, door open`);
check(!before.on && in1.rider && in1.walkerHidden && in1.state === 'sit' && in1.hat === 'helmet', `you sit on the ATV (your person, sitting, wearing a helmet); the walking you is hidden; nobody was on it before you got on`);
const gR = dist(in1.handR, in1.grip), gL = dist(in1.handL, [in1.grip[0], in1.grip[1], -in1.grip[2]]), fR = dist(in1.footR, in1.ft), fL = dist(in1.footL, [in1.ft[0], in1.ft[1], -in1.ft[2]]);
check(gR < 0.04 && gL < 0.04 && fR < 0.06 && fL < 0.06, `hands on the grips (${gR.toFixed(3)} / ${gL.toFixed(3)} m off), feet on the footrests (${fR.toFixed(3)} / ${fL.toFixed(3)} m off)`);
check(in1.dEye && Math.abs(in1.dEye[0] - in1.eye[0] - 0.06) < 0.02 && Math.abs(in1.dEye[1] - in1.eye[1]) < 0.02, `the first-person camera is at the rider's eyes, 6 cm forward (eye ${in1.eye}, camera ${in1.dEye})`);
check(in1.rideOn === true && in1.cls === 'offroad' && !in1.air && Math.abs(in1.dy) < 0.02 && in1.wheels === 4, `the ${CAR.name} uses the off-road ride everywhere (class ${in1.cls}: suspension, off-road tyres), sitting on the lobby floor (${in1.dy} m, ${in1.wheels} wheels down)`);
const riOn = await shot('1-on');

// ---- 2 右轉開上斜坡到 3 樓（跟 jeep-test 同一條路線）----
const up = await p.evaluate(() => {
  const D = window.__D(), R = D.TOWER_RAMP, RM = R.RM, deg = Math.PI / 180, F = 2, e = R.ent(F), y0 = D.GAR.group.position.y;
  const pts = [[2, 0], [6, 0], [10, 0], [13, 0], [16, 0.6], [18, 2.5], [18.6, 5]];
  for (let a = 25 * deg; a <= e - 22 * deg; a += 5 * deg) { const r = a < 45 * deg ? RM + ((18.5 - RM) * (45 * deg - a)) / (20 * deg) : a > e - 60 * deg ? RM + (16 - RM) * Math.min(1, (a - e + 60 * deg) / (30 * deg)) : RM; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  const rho = 5; for (let ph = 0; ph <= 90; ph += 10) { const sx = -rho + rho * Math.sin(ph * deg), n = rho - rho * Math.cos(ph * deg), r = 16 - n, an = e + sx / 16; pts.push([r * Math.cos(an), r * Math.sin(an)]); }
  for (const r of [9, 8]) pts.push([r * Math.cos(e), r * Math.sin(e)]);
  const o = { maxErr: 0, air: 0, ys: [], toasts: new Set(), lands: 0, pitch: 0, roll: 0, uMax: 0 };
  const l0 = D.drv.telemetry().lands;
  const r = window.__follow(pts, 60 * 60, (k, n) => (k >= n - 13 ? 3 : 7), (t) => { const T = window.__D().TRAMP, G = window.__D().GAR; return !T.on && G.floor === F && Math.hypot(window.__gl(t.x, t.z).x, window.__gl(t.x, t.z).z) < 9.5; }, (t) => {
    const D2 = window.__D(), T = D2.TRAMP, ts = window.__toast(); if (ts) o.toasts.add(ts);
    if (t.air) o.air++;
    if (!T.on) return;
    o.uMax = Math.max(o.uMax, T.u); o.maxErr = Math.max(o.maxErr, Math.abs(t.y - (y0 + D2.towerRampY(T.u))));
    o.pitch = Math.max(o.pitch, Math.abs(t.pitch)); o.roll = Math.max(o.roll, Math.abs(t.roll));
    if (o.ys.length < 400) o.ys.push(+t.y.toFixed(2));
  });
  window.__stop(40);
  const t = D.drv.telemetry();
  let dec = 0; for (let i = 1; i < o.ys.length; i++) dec = Math.max(dec, o.ys[i - 1] - o.ys[i]);
  return { ...r, s: +(r.i / 60).toFixed(1), maxErr: +o.maxErr.toFixed(3), dec: +dec.toFixed(3), air: o.air, lands: t.lands - l0, pitch: +o.pitch.toFixed(3), roll: +o.roll.toFixed(3), uMax: +o.uMax.toFixed(2), toasts: [...o.toasts], floor: D.GAR.floor, on: D.TRAMP.on, y: +(t.y - y0).toFixed(2), crushed: D.crushFx ? D.crushFx.stats.props + D.crushFx.stats.cars + D.crushFx.stats.big : -1, crimes: D.police ? D.police.telemetry().crimes.length : -1, rider: D.RIDER.C.group.parent === D.tripS.body && D.RIDER.C.group.visible };
});
console.log('2', el(), 'up:', JSON.stringify(up));
check(up.ok && up.uMax > 6 && up.maxErr < 0.12 && up.dec < 0.02 && up.air === 0 && up.lands === 0, `rode out the door and up the ramp: the suspension follows the ramp (off by ≤ ${up.maxErr} m, never drops, never in the air), two half-laps in ${up.s} s`);
check(up.bumps === 0 && up.pitch < 0.2 && up.roll < 0.12 && up.rider, `no bumping into the low walls; leans at most ${up.pitch} rad (pitch), ${up.roll} rad (roll); you stay on it`);
check(up.crushed === 0 && up.crimes === 0, `flattened nothing on the way up (${up.crushed}), no police (${up.crimes})`);
check(up.floor === 2 && !up.on && Math.abs(up.y - 7.7) < 0.05 && up.toasts.some((x) => /3 樓/.test(x)), `turned in at the 3F entrance: on 3F (y ${up.y}) 「${up.toasts.join(' / ')}」`);
const lift1 = await p.evaluate(() => { const D = window.__D(); let n = 0; for (; n < 1800 && (D.GAR.lift.busy || D.EL.ride || D.GAR.lift.floor !== 2); n++) window.__dstep(1); return { n, lf: D.GAR.lift.floor }; });
check(lift1.lf === 2, `the lift came up to 3F (${(lift1.n / 60).toFixed(1)} s)`);
const ri3 = await shot('2-3f');

// ---- 3 開上電梯 → 按 B1：跟著電梯下去，到了穩穩停在 B1 的地板 ----
const onLift = await p.evaluate(() => {
  const D = window.__D(), e = D.TOWER_RAMP.ent(2), t0 = D.drv.telemetry(), q0 = window.__gl(t0.x, t0.z);
  const r = window.__follow([[q0.x, q0.z], [4 * Math.cos(e), 4 * Math.sin(e)], [0, 0], [-3 * Math.cos(e), -3 * Math.sin(e)]], 60 * 20, () => 2, (t) => { const q = window.__gl(t.x, t.z); return Math.hypot(q.x, q.z) < 0.6; });
  window.__stop(60);
  const P = document.querySelector('#stage .elpanel'), vis = (x) => !!x && !x.hidden && getComputedStyle(x).display !== 'none' && x.getBoundingClientRect().width > 0;
  return { ...r, who: D.elWho(), panel: vis(P), btns: P ? [...P.querySelectorAll('.elg button')].map((x) => x.textContent.trim()) : [] };
});
console.log('3', el(), 'onto the lift:', JSON.stringify(onLift));
check(onLift.ok && onLift.bumps === 0 && onLift.panel && onLift.btns.some((x) => /B1/.test(x)), `rode onto the lift on 3F: the panel opens (${onLift.btns.join(' ')})`);
await p.evaluate(() => document.querySelector('#stage .elpanel .elg button[data-f="4"]').click());
const b1 = await p.evaluate(() => {
  const D = window.__D(), G = D.GAR, y0 = G.group.position.y, l0 = D.drv.telemetry().lands; let n = 0, ride = false, toast = '', off = 0;
  for (; n < 60 && !D.EL.ride; n++) window.__dstep(1);
  ride = !!D.EL.ride;
  const V3 = D.dcam.position.constructor, v = new V3();
  for (n = 0; n < 1200 && (D.EL.ride || G.lift.busy); n++) { window.__dstep(1); if (D.EL.ride) { D.tripS.car.getWorldPosition(v); off = Math.max(off, Math.abs(v.y - (y0 + G.lift.y))); } }
  const ys = []; for (let i = 0; i < 90; i++) { const t = window.__dstep(1); ys.push(t.y - y0); toast = toast || window.__toast(); }
  const t = D.drv.telemetry();
  return { ride, n, floor: G.floor, lf: G.lift.floor, y: +(t.y - y0).toFixed(3), ymin: +Math.min(...ys).toFixed(3), ymax: +Math.max(...ys).toFixed(3), off: +off.toFixed(3), air: t.air, wheels: t.wheels, lands: t.lands - l0, carScene: D.tripS.car.parent === D.TR.scene, toast, rider: D.RIDER.C.group.parent === D.tripS.body && D.RIDER.C.group.visible };
});
console.log('  B1:', JSON.stringify(b1));
check(b1.ride && b1.off < 0.6 && b1.floor === 4 && b1.lf === 4 && b1.carScene && b1.rider && /B1/.test(b1.toast), `pressed B1: the ${CAR.name} rode the lift down with it, you still on it (stays on the platform: ${b1.off} m) and arrived on B1 「${b1.toast}」`);
check(Math.abs(b1.y + 3.2) < 0.03 && b1.ymax - b1.ymin < 0.02 && !b1.air && b1.wheels === 4 && b1.lands === 0, `on B1 it sits still on the floor (y ${b1.ymin}…${b1.ymax} m over 1.5 s, 4 wheels down, no drop or bounce)`);
const riB1 = await shot('3-b1');

// ---- 4 往前開進 B1 的空格子、下車（人拿下來、走路的你出來）；再騎上去、回到電梯上、回 1 樓、開出去 ----
const park4 = await p.evaluate(() => {
  const D = window.__D(), t0 = D.drv.telemetry(), hl = t0.heading - D.garLot().heading, ux = Math.cos(hl), uz = -Math.sin(hl);
  const r = window.__follow([[0, 0], [ux * 3, uz * 3], [ux * 7.6, uz * 7.6], [ux * 10, uz * 10]], 60 * 15, () => 2, (t) => { const q = window.__gl(t.x, t.z); return Math.hypot(q.x, q.z) > 7.3; });
  window.__stop(60);
  D.leaveCar(); let n = 0, toast = ''; for (; n < 240 && (D.walker.mode !== 'walk' || !toast); n++) { window.__dstep(1); toast = toast || window.__toast(); }
  const i = D.TWR.indexOf(window.__K), R = D.RIDER;
  return { ...r, mode: D.walker.mode, toast, bay: i, f: i >= 0 ? D.TOWER_BAYS[i].f : null, saved: window.__G().park.tower[i], riderOff: !R.S && !R.C.group.parent && !R.C.group.visible, walkerShown: D.walker.character.group.visible };
});
console.log('4', el(), JSON.stringify(park4));
check(park4.ok && park4.bumps === 0 && park4.mode === 'walk' && park4.f === 4 && park4.saved === K && new RegExp(`停好了：B1 ${park4.bay - 23} 號`).test(park4.toast), `rode into a B1 spot and got off: 「${park4.toast}」 (saved in spot ${park4.bay + 1})`);
check(park4.riderOff && park4.walkerShown, 'getting off: the rider comes off the ATV and you walk again (nobody left sitting on the parked ATV)');
const riPark = await shot('4-parked');
const back4 = await p.evaluate(async () => {
  const D = window.__D(), W = D.walker; let ok = false, k = 0;
  for (; k < 600 && !ok; k++) { ok = W.getIn(W.cars.find((c) => c.key === window.__K)); if (!ok) window.__wstep(1); }
  let n = 0; for (; n < 1200 && !(window.__D().drv && W.mode === 'off'); n++) window.__wstep(1);
  window.__dstep(2);
  const toast = window.__toast(), d = window.__D().drv, t = d.telemetry(), c = window.__gw(0, 0); let done = false, R = window.__D().RIDER;
  const rider = R.C.group.parent === window.__D().tripS.body && R.C.group.visible;
  d.parkAt({ x: c.x, z: c.z, heading: t.heading }, () => { done = true; }); // 倒回電梯上（自動停車）
  for (n = 0; n < 600 && !done; n++) window.__dstep(1); window.__dstep(10);
  const P = document.querySelector('#stage .elpanel');
  return { ok, mode: W.mode, toast, done, rider, panel: !!P && !P.hidden, who: window.__D().elWho() };
});
console.log('  back on the lift:', JSON.stringify(back4));
check(back4.ok && back4.mode === 'off' && back4.rider && back4.done && back4.panel && /倒車回到電梯上/.test(back4.toast), `got back on (you sit on it again; 「${back4.toast}」) and backed onto the lift: the panel is there`);
await p.evaluate(() => document.querySelector('#stage .elpanel .elg button[data-f="0"]').click());
const f1 = await p.evaluate(() => {
  const D = window.__D(), G = D.GAR, y0 = G.group.position.y; let n = 0;
  for (; n < 60 && !D.EL.ride; n++) window.__dstep(1);
  for (n = 0; n < 1500 && (D.EL.ride || G.lift.busy); n++) window.__dstep(1);
  window.__dstep(30);
  const t = D.drv.telemetry(), hl = Math.atan2(Math.sin(t.heading - D.garLot().heading), Math.cos(t.heading - D.garLot().heading));
  return { floor: G.floor, y: +(t.y - y0).toFixed(3), air: t.air, hl: +hl.toFixed(3), toast: window.__toast() };
});
console.log('  1F:', JSON.stringify(f1));
check(f1.floor === 0 && Math.abs(f1.y) < 0.03 && !f1.air && Math.abs(f1.hl) < 0.05, `rode back up to 1F (y ${f1.y}), turned to face the door 「${f1.toast}」`);
const out4 = await p.evaluate(() => {
  const D = window.__D(); D.GAR.door.open(0.2); window.__dstep(30);
  const r = window.__follow([[0, 0], [4, 0], [10, 0], [16, 0], [24, 0], [30, 0]], 60 * 15, () => 6, (t) => window.__gl(t.x, t.z).x > 26);
  window.__stop(60);
  const t = D.drv.telemetry();
  return { ...r, dy: +(t.y - D.VIL.heightAt(t.x, t.z)).toFixed(3), floor: D.GAR.floor };
});
console.log('  out the door:', JSON.stringify(out4));
check(out4.ok && out4.bumps === 0 && Math.abs(out4.dy) < 0.05 && out4.floor === 0, `rode out through the door onto the street (${out4.dy} m off the ground)`);

// ---- 5 快速道路：油門踩到底 20 秒（沿著外側車道）：最快 105；手把跟著轉、手跟著把手；第一人稱 ----
const hw = await p.evaluate(() => {
  const D = window.__D(), d = D.drv, H = D.VIL.places.highway, L = D.VIL.highway.out;
  d.teleport(H.spawn); window.__dstep(30);
  let k = 0, vmax = 0, air = 0, dy = 0, pitch = 0, roll = 0; const l0 = d.telemetry().lands, b0 = d.telemetry().bumps;
  for (let i = 0; i < 60 * 20; i++) {
    const t = d.telemetry();
    let bk = k, bd = 1e9; for (let j = k; j < Math.min(L.length, k + 8); j++) { const e = Math.hypot(L[j][0] - t.x, L[j][1] - t.z); if (e < bd) { bd = e; bk = j; } } k = bk;
    const g = L[Math.min(L.length - 1, k + 2)], a = Math.atan2(-(g[1] - t.z), g[0] - t.x) - t.heading, aa = Math.atan2(Math.sin(a), Math.cos(a));
    d.setInput({ throttle: 1, brake: 0, steer: Math.max(-1, Math.min(1, -2 * aa)) }); window.__dstep(1);
    const t2 = d.telemetry(); vmax = Math.max(vmax, t2.kmh); if (t2.air) air++;
    if (i > 30) { dy = Math.max(dy, Math.abs(t2.y - D.PW.heightAt(t2.x, t2.z))); pitch = Math.max(pitch, Math.abs(t2.pitch)); roll = Math.max(roll, Math.abs(t2.roll)); }
  }
  d.setInput(null); const t = d.telemetry();
  return { vmax: Math.round(vmax), air, dy: +dy.toFixed(3), pitch: +pitch.toFixed(3), roll: +roll.toFixed(3), lands: t.lands - l0, bumps: t.bumps - b0, surface: t.surface };
});
console.log('5', el(), 'highway:', JSON.stringify(hw));
check(hw.vmax > CAR.hwMin && hw.vmax <= CAR.top + 1 && hw.bumps === 0, `flat out on the expressway for 20 s: ${hw.vmax} km/h (top ${CAR.top}), no bumps`);
check(hw.air === 0 && hw.lands === 0 && hw.dy < 0.06 && hw.pitch < 0.08 && hw.roll < 0.08, `the suspension keeps it on the road at speed (≤ ${hw.dy} m off, pitch ≤ ${hw.pitch}, roll ≤ ${hw.roll} rad, never in the air)`);
const riHw = await shot('5-highway');
// 手把：直直的 → 打到底往右：手把繞龍頭轉、右手跟著往後、左手往前
const bars = await p.evaluate(() => {
  const D = window.__D(), d = D.drv, C = D.RIDER.C, b = D.tripS.body.getObjectByName('bars');
  const at = () => ({ s: +d.telemetry().steer.toFixed(2), ang: +(2 * Math.acos(Math.min(1, Math.abs(b.quaternion.w)))).toFixed(3), y: +b.quaternion.y.toFixed(3), R: window.__bodyAt(C.hand), L: window.__bodyAt(C.handL) });
  window.__stop(90); d.setInput({ throttle: 0, brake: 0, steer: 0, handbrake: 1 }); window.__dstep(40); const s0 = at();
  d.setInput({ throttle: 0, brake: 0, steer: 1, handbrake: 1 }); window.__dstep(40); const s1 = at();
  d.setInput({ throttle: 0, brake: 0, steer: -1, handbrake: 1 }); window.__dstep(60); const s2 = at();
  d.setInput(null); window.__dstep(40);
  return { s0, s1, s2 };
});
console.log('  bars:', JSON.stringify(bars));
check(Math.abs(bars.s0.ang) < 0.02 && bars.s1.s > 0.9 && Math.abs(bars.s1.ang - 0.5 * bars.s1.s) < 0.03 && bars.s1.y < 0 && bars.s2.s < -0.9 && bars.s2.y > 0, `the handlebars turn with the steering (straight ${bars.s0.ang} rad; full right ${bars.s1.ang} rad; full left the other way)`);
check(bars.s1.R[0] < bars.s0.R[0] - 0.08 && bars.s1.L[0] > bars.s0.L[0] + 0.08 && bars.s2.R[0] > bars.s0.R[0] + 0.08, `the hands follow the grips (right hand x ${bars.s0.R[0]} → ${bars.s1.R[0]} turning right, left hand ${bars.s0.L[0]} → ${bars.s1.L[0]})`);
await p.evaluate(() => { const d = window.__D().drv; d.setInput({ throttle: 0, brake: 0, steer: 1, handbrake: 1 }); window.__dstep(40); });
const riTurn = await shot('5-turn');
await p.evaluate(() => { const d = window.__D().drv; d.setInput(null); window.__dstep(40); d.setCameraMode('eye'); window.__dstep(2); });
const eye = await p.evaluate(() => { const D = window.__D(), c = D.dcam.position.clone(), e = c.clone().set(...D.dEye.eye); D.tripS.body.updateWorldMatrix(true, false); D.tripS.body.localToWorld(e); return { d: +c.distanceTo(e).toFixed(3), riderVis: D.RIDER.C.group.visible, mir: D.MIR.list.length, mirOn: D.MIR.on }; });
const riEye = await shot('5-eye');
check(eye.d < 0.05 && !eye.riderVis && eye.mir === 0, `first person: the camera sits at the rider's eyes (${eye.d} m), the rider is not drawn (no head in the way), no mirrors to draw (${eye.mir})`);
await p.evaluate(() => { window.__D().drv.setCameraMode('chase'); window.__dstep(2); });
const chase = await p.evaluate(() => window.__D().RIDER.C.group.visible);
check(chase, 'back to the chase camera: you are on the ATV again');
await p.evaluate(() => window.__stop(120));

// ---- 6 越野車場的泥巴池：越野胎在泥巴裡比一般的車快（一般的車最多 12 km/h）----
const mud = await p.evaluate(() => {
  const D = window.__D(), d = D.drv; d.teleport({ x: 396, z: 177, heading: 0 }); window.__dstep(30);
  let vmax = 0, inMud = 0, air = 0;
  for (let i = 0, out = 0; i < 60 * 6 && out < 20; i++) { d.setInput({ throttle: 1, brake: 0, steer: 0 }); window.__dstep(1); const t = d.telemetry(); if (t.surface === 6) { inMud++; vmax = Math.max(vmax, t.kmh); } else if (inMud) out++; if (t.air) air++; } // 開出泥巴池就停（前面是越野車場的圍籬）
  d.setInput(null); window.__stop(60); const t = d.telemetry();
  return { inMud: +(inMud / 60).toFixed(1), vmax: Math.round(vmax), air, x: +t.x.toFixed(1) };
});
console.log('6', el(), 'mud:', JSON.stringify(mud));
check(mud.inMud > 1 && mud.vmax > 20 && mud.vmax <= 41, `through the mud pit: up to ${mud.vmax} km/h in the mud (off-road tyres; a road car crawls at 12 km/h)`);
const riMud = await shot('6-mud');

// ---- 7 撞路邊輾得扁的小東西（垃圾桶、燈箱⋯）：沙灘車很輕，不輾（跟一般的車一樣撞到、擋住）----
const prop = await p.evaluate(() => {
  const D = window.__D(), C = D.crushFx, sp = D.VIL.places.garage.spawn; D.drv.teleport(sp); window.__dstep(20);
  const x = sp.x, z = sp.z, r = 160, cols = D.VIL.colliders, tall = [];
  for (const q of cols) if ((q.h ?? 9) >= 1.8 && Math.abs(q.x - x) < r + 60 && Math.abs(q.z - z) < r + 60) tall.push(q);
  const clearAt = (px, pz, m) => { for (const q of tall) { const d = q.t === 'box' ? Math.hypot(Math.max(0, Math.abs(px - q.x) - q.hx), Math.max(0, Math.abs(pz - q.z) - q.hz)) : Math.hypot(px - q.x, pz - q.z) - q.r; if (d < m) return false; } return true; };
  const cands = cols.filter((c) => C.can(c) && (c.h ?? 9) <= 1.6 && Math.hypot(c.x - x, c.z - z) < r).sort((a2, b2) => Math.hypot(a2.x - x, a2.z - z) - Math.hypot(b2.x - x, b2.z - z));
  for (const c of cands) for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, ux = Math.cos(a), uz = -Math.sin(a); let ok = true;
    for (const d of [2.5, 5, 8, 11, 13]) if (!clearAt(c.x - ux * d, c.z - uz * d, 2.4)) { ok = false; break; }
    if (!ok) continue;
    const st0 = { ...C.stats }, d = D.drv; d.teleport({ x: c.x - ux * 11, z: c.z - uz * 11, heading: a }); window.__dstep(10);
    const b0 = d.telemetry().bumps; let n = 0, maxKmh = 0;
    d.setInput({ throttle: 0.5, brake: 0, steer: 0 }); for (; n < 300 && d.telemetry().bumps === b0; n++) { window.__dstep(1); maxKmh = Math.max(maxKmh, d.telemetry().kmh); } d.setInput(null); window.__stop(60);
    return { t: c.t, h: c.h, x: +c.x.toFixed(1), z: +c.z.toFixed(1), can: C.can(c), crushed: !!c.crushed, props: C.stats.props - st0.props, big: C.stats.big - st0.big, bumps: d.telemetry().bumps - b0, maxKmh: Math.round(maxKmh), s: +(n / 60).toFixed(2), n: cands.length };
  }
  return { none: true, n: cands.length };
});
console.log('7', el(), 'roadside thing:', JSON.stringify(prop));
check(!prop.none && !prop.crushed && prop.props === 0 && prop.big === 0 && prop.bumps > 0, `rode into a crushable roadside thing (${prop.t}, ${prop.h} m high, at ${prop.maxKmh} km/h): the light ATV does not flatten it, it just bumps (${prop.bumps}) — only the heavier off-roaders crush things`);

console.log('draw calls:', JSON.stringify({ garage: riG, seat: riSeat, on: riOn, f3: ri3, b1: riB1, parked: riPark, highway: riHw, turn: riTurn, eye: riEye, mud: riMud }));
check(!errs.length, `no page errors (${errs.length})`);
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS OK', el());
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
