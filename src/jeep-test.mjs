// 第 48 批（Nick 2026-10-28「可以開始做 更多越野車」→ J4 吉普車，卡片「好，做進去」）：吉普車＝第一台用 terrain.js「offroad」那一級的車（懸吊、越野胎、底盤高；不是大車）
//   車庫頁：J4 是你的車、有 3D 駕駛座 → 出門上 J4（一樓電梯上）→ 開鐵捲門、右轉開上斜坡到 3 樓（貼著坡面、不撞、不飛起來）
//   → 3 樓開上電梯 → 坐電梯去 B1（到了穩穩停在 B1 的地板，不彈、不掉）→ 往前開進格子、下車（「停好了：B1 N 號」）→ 上車、回到電梯上 → 回 1 樓、開出鐵捲門
//   → 快速道路油門踩到底（貼著路面、不跳；最快多快）→ 越野車場的泥巴池（越野胎：比一般的車快很多）→ 駕駛座視角截圖、draw calls
// 開車、走路都不是真的即時：頁面自己的開車先停住（__hold）、不畫（__noDraw），測試在頁面裡一步一步開，要截圖才畫
// node jeep-test.mjs [prefix]（截圖：<prefix>-*.png）；OFFCAR=k2 node jeep-test.mjs ＝ K2 小越野車（k2-test.mjs）；OFFCAR=p8 ＝ P8 皮卡（p8-test.mjs）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
// 第 51 批：同一趟也測 K2 小越野車（k2-test.mjs 設 OFFCAR=k2）：K＝哪台車，CAR＝那台的名字、價錢、極速、快速道路 20 秒至少要到多快
const K = process.env.OFFCAR || 'jp4', CAR = { jp4: { name: 'J4', what: 'J4 jeep', price: 80, top: 180, hwMin: 130 }, k2: { name: 'K2', what: 'K2 mini off-roader', price: 60, top: 145, hwMin: 100 }, p8: { name: 'P8', what: 'P8 pickup', price: 90, top: 180, hwMin: 130, tight: true } }[K]; // 第 53 批：P8 皮卡（tight：開上斜坡走裡面那條，見第 2 段）
const [prefix = K === 'jp4' ? '../out/jeep/jp' : `../out/${K}/${K}`] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__G = () => GAME; window.__room = () => room; window.__CV = () => CABIN_VIEW; window.__P = () => PERF;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, trip, tripS, TR, LODS, cur, built, walker, tripPose, TWR, EL, elWho, padCars, TOWER_BAYS, towerFy, TOWER_RAMP, towerRampY, TRAMP, garLot, rampCeil, leaveCar, PW, S, crushFx, police });'
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
// 開局：J4（K2）（開的，停在一樓電梯上）＋GC8（2 樓 1 號）
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
// ---- 0 車庫頁：J4 是你的車、車內是 3D 駕駛座（儀表、方向盤、座椅）、停在一樓電梯上 ----
await p.waitForFunction(() => window.__D().built[window.__K]?.car, null, { timeout: 120000 });
const g0 = await p.evaluate(() => {
  const k = window.__K, D = window.__D(), C = D.built[k], btn = document.querySelector(`#cars button[data-car="${k}"]`), V = window.__CV()[k], P = window.__P()[k];
  let tris = 0; C.cabin?.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return { cur: D.cur, btn: btn ? btn.querySelector('span').textContent : null, name: btn?.querySelector('b')?.textContent, cabin: C.cabin?.children.length || 0, cabTris: Math.round(tris), interior: !!C.body.getObjectByName('interior'), eye: V?.eye, mid: window.__G().park.mid, perf: { price: P.price, hp: P.hp, vmax: P.vmax, offroad: P.offroad, big: !!P.big } };
});
console.log('  garage:', JSON.stringify(g0));
check(g0.cur === K && g0.name === CAR.name && g0.btn === '你的車' && g0.mid === K, `garage page: the ${CAR.what} is your car, parked on the lobby lift`);
check(g0.cabin >= 4 && !g0.interior && g0.cabTris > 5000 && g0.cabTris < 20000 && g0.eye && g0.eye[1] > 1.4 && g0.eye[2] < 0, `it has a 3D cockpit instead of the simple box (${g0.cabin} meshes, ${g0.cabTris} triangles; left-hand drive, eyes ${g0.eye?.[1]} m up: sits high)`);
check(g0.perf.price === CAR.price && g0.perf.offroad === 1 && !g0.perf.big && g0.perf.vmax === CAR.top, `sold at the 越野車行 for ${CAR.price} 萬, an off-road car of normal size (not big: fits the tower)`);
const riG = await gshot('0-garage');

// ---- 1 出門：上 J4、開鐵捲門 ----
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
  for (; k < 600 && !ok; k++) { ok = W.getIn(W.cars.find((c) => c.key === window.__K)); if (!ok) window.__wstep(1); }
  let n = 0; for (; n < 1200 && !(window.__D().drv && W.mode === 'off'); n++) window.__wstep(1);
  const D = window.__D(); D.GAR.door.open(0.2); window.__dstep(40);
  const t = D.drv.telemetry(), y0 = D.GAR.group.position.y;
  return { ok, mode: W.mode, cur: D.cur, door: D.GAR.door.t, rideOn: t.rideOn, cls: t.cls, air: t.air, dy: +(t.y - y0).toFixed(3), wheels: t.wheels, halfW: D.drv.carInfo.halfW };
});
console.log('1', el(), JSON.stringify(in1));
check(in1.mode === 'off' && in1.cur === K && in1.door === 1, `in the ${CAR.name} on the lobby turntable, door open`);
check(in1.rideOn === true && in1.cls === 'offroad' && !in1.air && Math.abs(in1.dy) < 0.02 && in1.wheels === 4, `the ${CAR.name} uses the off-road ride everywhere (class ${in1.cls}: suspension, off-road tyres), sitting on the lobby floor (${in1.dy} m, ${in1.wheels} wheels down)`);

// ---- 2 右轉開上斜坡到 3 樓（跟 ramp-test 同一條路線）----
//   第 53 批：皮卡（CAR.tight）走裡面那條：出鐵捲門就右轉、直接對著斜坡的口（半徑 RM 那一圈）開。小車那條先繞到外面（18.5 公尺，比斜坡的外緣 17.2、門口的水泥地 17.5 還外面）
//   再急急切進來（S 彎），5.3 公尺長的皮卡跟不上，車頭會擦到護欄的頭；開大車本來就是出門就轉（J4、K2 照舊測原本那條）
const up = await p.evaluate((tight) => {
  const D = window.__D(), R = D.TOWER_RAMP, RM = R.RM, deg = Math.PI / 180, F = 2, e = R.ent(F), y0 = D.GAR.group.position.y;
  const pts = tight ? [[2, 0], [6, 0], [10, 0], [12.6, 0]] : [[2, 0], [6, 0], [10, 0], [13, 0], [16, 0.6], [18, 2.5], [18.6, 5]];
  for (let a = (tight ? 12 : 25) * deg; a <= e - 22 * deg; a += 5 * deg) { const r = a < 45 * deg && !tight ? RM + ((18.5 - RM) * (45 * deg - a)) / (20 * deg) : a > e - 60 * deg ? RM + (16 - RM) * Math.min(1, (a - e + 60 * deg) / (30 * deg)) : RM; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
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
  return { ...r, s: +(r.i / 60).toFixed(1), maxErr: +o.maxErr.toFixed(3), dec: +dec.toFixed(3), air: o.air, lands: t.lands - l0, pitch: +o.pitch.toFixed(3), roll: +o.roll.toFixed(3), uMax: +o.uMax.toFixed(2), toasts: [...o.toasts], floor: D.GAR.floor, on: D.TRAMP.on, y: +(t.y - y0).toFixed(2), crushed: D.crushFx ? D.crushFx.stats.props + D.crushFx.stats.cars + D.crushFx.stats.big : -1, crimes: D.police ? D.police.telemetry().crimes.length : -1 };
}, !!CAR.tight);
console.log('2', el(), 'up:', JSON.stringify(up));
check(up.ok && up.uMax > 6 && up.maxErr < 0.12 && up.dec < 0.02 && up.air === 0 && up.lands === 0, `drove out the door and up the ramp: the suspension follows the ramp (off by ≤ ${up.maxErr} m, never drops, never in the air), two half-laps in ${up.s} s`);
check(up.bumps === 0 && up.pitch < 0.2 && up.roll < 0.12, `no bumping into the low walls${CAR.tight ? ' (the long pickup turns right as soon as it is out of the door, straight at the ramp)' : ''}; leans at most ${up.pitch} rad (pitch), ${up.roll} rad (roll)`);
check(up.crushed === 0 && up.crimes === 0, `the ramp's walls are not crushable and there is no invisible wall before the start: the ${CAR.name} (an off-road car that crushes things) flattened nothing on the way up (${up.crushed}), no police (${up.crimes})`);
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
check(onLift.ok && onLift.bumps === 0 && onLift.panel && onLift.btns.some((x) => /B1/.test(x)), `drove onto the lift on 3F: the panel opens (${onLift.btns.join(' ')}) — the ${CAR.name} is not too big for the lift`);
await p.evaluate(() => document.querySelector('#stage .elpanel .elg button[data-f="4"]').click());
const b1 = await p.evaluate(() => {
  const D = window.__D(), G = D.GAR, y0 = G.group.position.y, l0 = D.drv.telemetry().lands; let n = 0, ride = false, toast = '', off = 0;
  for (; n < 60 && !D.EL.ride; n++) window.__dstep(1);
  ride = !!D.EL.ride;
  const V3 = D.dcam.position.constructor, v = new V3();
  for (n = 0; n < 1200 && (D.EL.ride || G.lift.busy); n++) { window.__dstep(1); if (D.EL.ride) { D.tripS.car.getWorldPosition(v); off = Math.max(off, Math.abs(v.y - (y0 + G.lift.y))); } }
  const ys = []; for (let i = 0; i < 90; i++) { const t = window.__dstep(1); ys.push(t.y - y0); toast = toast || window.__toast(); }
  const t = D.drv.telemetry(), q = window.__gl(t.x, t.z), hl = Math.atan2(Math.sin(t.heading - D.garLot().heading), Math.cos(t.heading - D.garLot().heading));
  const bay = D.TOWER_BAYS.find((x) => x.f === 4 && Math.abs(Math.atan2(Math.sin(x.heading - hl), Math.cos(x.heading - hl))) < 0.05);
  return { ride, n, floor: G.floor, lf: G.lift.floor, y: +(t.y - y0).toFixed(3), ymin: +Math.min(...ys).toFixed(3), ymax: +Math.max(...ys).toFixed(3), off: +off.toFixed(3), air: t.air, wheels: t.wheels, lands: t.lands - l0, carScene: D.tripS.car.parent === D.TR.scene, r: +Math.hypot(q.x, q.z).toFixed(2), toast, bay: bay && { id: bay.id, free: !D.TWR[bay.id] } };
});
console.log('  B1:', JSON.stringify(b1));
check(b1.ride && b1.off < 0.6 && b1.floor === 4 && b1.lf === 4 && b1.carScene && /B1/.test(b1.toast), `pressed B1: the ${CAR.name} rode the lift down with it (stays on the platform: ${b1.off} m) and arrived on B1 「${b1.toast}」`);
check(Math.abs(b1.y + 3.2) < 0.03 && b1.ymax - b1.ymin < 0.02 && !b1.air && b1.wheels === 4 && b1.lands === 0, `on B1 it sits still on the floor (y ${b1.ymin}…${b1.ymax} m over 1.5 s, 4 wheels down, no drop or bounce)`);
const riB1 = await shot('3-b1');

// ---- 4 往前開進 B1 的空格子、下車：「停好了：B1 N 號」；再上車、回到電梯上、回 1 樓 ----
const park4 = await p.evaluate(() => {
  const D = window.__D(), t0 = D.drv.telemetry(), hl = t0.heading - D.garLot().heading, ux = Math.cos(hl), uz = -Math.sin(hl);
  const r = window.__follow([[0, 0], [ux * 3, uz * 3], [ux * 7.6, uz * 7.6], [ux * 10, uz * 10]], 60 * 15, () => 2, (t) => { const q = window.__gl(t.x, t.z); return Math.hypot(q.x, q.z) > 7.3; });
  window.__stop(60);
  D.leaveCar(); let n = 0, toast = ''; for (; n < 240 && (D.walker.mode !== 'walk' || !toast); n++) { window.__dstep(1); toast = toast || window.__toast(); }
  const i = D.TWR.indexOf(window.__K);
  return { ...r, mode: D.walker.mode, toast, bay: i, f: i >= 0 ? D.TOWER_BAYS[i].f : null, saved: window.__G().park.tower[i] };
});
console.log('4', el(), JSON.stringify(park4));
check(park4.ok && park4.bumps === 0 && park4.mode === 'walk' && park4.f === 4 && park4.saved === K && new RegExp(`停好了：B1 ${park4.bay - 23} 號`).test(park4.toast), `drove into a B1 spot and got out: 「${park4.toast}」 (saved in spot ${park4.bay + 1})`);
const back4 = await p.evaluate(async () => {
  const D = window.__D(), W = D.walker; let ok = false, k = 0;
  for (; k < 600 && !ok; k++) { ok = W.getIn(W.cars.find((c) => c.key === window.__K)); if (!ok) window.__wstep(1); }
  let n = 0; for (; n < 1200 && !(window.__D().drv && W.mode === 'off'); n++) window.__wstep(1);
  const toast = window.__toast(), d = window.__D().drv, t = d.telemetry(), c = window.__gw(0, 0); let done = false;
  d.parkAt({ x: c.x, z: c.z, heading: t.heading }, () => { done = true; }); // 倒回電梯上（自動停車）
  for (n = 0; n < 600 && !done; n++) window.__dstep(1); window.__dstep(10);
  const P = document.querySelector('#stage .elpanel');
  return { ok, mode: W.mode, toast, done, panel: !!P && !P.hidden, who: window.__D().elWho() };
});
console.log('  back on the lift:', JSON.stringify(back4));
check(back4.ok && back4.mode === 'off' && back4.done && back4.panel && /倒車回到電梯上/.test(back4.toast), `got back in (「${back4.toast}」) and backed onto the lift: the panel is there`);
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
check(out4.ok && out4.bumps === 0 && Math.abs(out4.dy) < 0.05 && out4.floor === 0, `drove out through the door onto the street (${out4.dy} m off the ground)`);

// ---- 5 快速道路：油門踩到底 20 秒（沿著外側車道）：貼著路面、不跳；最快多快 ----
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
await p.evaluate(() => { window.__D().drv.setCameraMode('eye'); window.__dstep(2); });
const eye = await p.evaluate(() => { const D = window.__D(), V = window.__CV()[window.__K], c = D.dcam.position.clone(), m = D.tripS.body.matrixWorld, e = new c.constructor(...V.eye).applyMatrix4(m); return { d: +c.distanceTo(e).toFixed(3), cab: !!D.tripS.cabin && D.tripS.cabin.visible !== false }; });
const riEye = await shot('5-eye');
check(eye.cab && eye.d < 0.05, `driver's seat view: the camera sits at the ${CAR.name}'s eye point (${eye.d} m) inside the 3D cockpit`);
await p.evaluate(() => { window.__D().drv.setCameraMode('chase'); window.__stop(120); });

// ---- 6 越野車場的泥巴池：越野胎在泥巴裡比一般的車快很多（一般的車最多 12 km/h）----
const mud = await p.evaluate(() => {
  const D = window.__D(), d = D.drv; d.teleport({ x: 396, z: 177, heading: 0 }); window.__dstep(30);
  let vmax = 0, inMud = 0, air = 0;
  for (let i = 0, out = 0; i < 60 * 6 && out < 20; i++) { d.setInput({ throttle: 1, brake: 0, steer: 0 }); window.__dstep(1); const t = d.telemetry(); if (t.surface === 6) { inMud++; vmax = Math.max(vmax, t.kmh); } else if (inMud) out++; if (t.air) air++; } // 開出泥巴池就停（前面是越野車場的圍籬）
  d.setInput(null); window.__stop(60); const t = d.telemetry();
  return { inMud: +(inMud / 60).toFixed(1), vmax: Math.round(vmax), air, x: +t.x.toFixed(1) };
});
console.log('6', el(), 'mud:', JSON.stringify(mud));
check(mud.inMud > 1 && mud.vmax > 25 && mud.vmax <= 41, `through the mud pit: up to ${mud.vmax} km/h in the mud (off-road tyres; a road car crawls at 12 km/h)`);
const riMud = await shot('6-mud');

console.log('draw calls:', JSON.stringify({ garage: riG, f3: ri3, b1: riB1, highway: riHw, eye: riEye, mud: riMud }));
check(!errs.length, `no page errors (${errs.length})`);
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS OK', el());
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
