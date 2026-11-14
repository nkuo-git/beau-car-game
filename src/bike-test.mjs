// 第 67 批（Nick 2026-11-06「加自行車」「還有越野腳踏車」，卡片「兩台都做」）：腳踏車＝騎的、用腳踩（沒有引擎聲）；越野腳踏車（mtb）走越野那一級的懸吊但不輾東西、一般腳踏車（road）是路車；兩台都在阿財車行賣
//   跟 n4-test 同一趟（BIKE=mtb 或 road）：車庫頁：是你的車、沒有車內、兩個輪子（bikeBuild 的，前輪在把手那組）、「車內」＝騎的人的眼睛 → 阿財車行有賣（還沒買的時候）
//   → 出門騎上去：你的人坐在上面（戴安全帽、手握把手、腳踩腳踏）→ 開鐵捲門、右轉騎上斜坡到 3 樓（往彎裡面倒）→ 坐電梯去 B1、騎進格子、下車 → 上車、回 1 樓、騎出鐵捲門
//   → 快速道路踩到底 20 秒（極速 30／35）、腳踏跟著後輪轉、腳跟著腳踏 → 把手跟著轉、手跟著把手 → 第一人稱（沒有後照鏡；第 90 批起騎的人照畫、頭藏起來，看得到手握把手）→ 轉彎往裡面倒（停下來就正的）→ 輕量車只有兩個輪子 → 沒有引擎聲 → draw calls
// 開車、走路都不是真的即時：頁面自己的開車先停住（__hold）、不畫（__noDraw），測試在頁面裡一步一步開，要截圖才畫
// BIKE=mtb node bike-test.mjs [prefix]（截圖：<prefix>-*.png；沒給＝../out/bike/<BIKE>）；BIKE=road 測一般腳踏車
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const K = process.env.BIKE === 'road' ? 'road' : 'mtb';
const CAR = K === 'mtb' ? { name: '越野腳踏車', what: 'mountain bike', price: 3, vmax: 55, top: 60, hwMin: 26, off: true, wx: 0.9, hx: 0.08 } : { name: '一般腳踏車', what: 'road bike', price: 2, vmax: 58, top: 60, hwMin: 30, off: false, wx: 0.8, hx: 0.03 }; // hwMin：20 秒要踩到的速度；wx：輕量車的輪子最前最後（公尺）
const [prefix = `../out/bike/${K}`] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__G = () => GAME; window.__room = () => room; window.__CV = () => CABIN_VIEW; window.__P = () => PERF;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, trip, tripS, TR, LODS, cur, built, walker, tripPose, TWR, EL, elWho, padCars, TOWER_BAYS, towerFy, TOWER_RAMP, towerRampY, TRAMP, garLot, rampCeil, leaveCar, PW, S, crushFx, police, RIDER, dEye, BIKE_RIDE, BIKE, MIR, SNDC: createEngineAudio.cars, dvoice, camera, saleOf, buildLodCar, LOD_CARS, CARS });'
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
// 開局：腳踏車（騎的，停在一樓電梯上）＋GC8（2 樓 1 號）
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
// ---- 0 車庫頁：腳踏車是你的車、沒有車內（騎的）、把手是自己一組、兩個輪子；「車內」＝騎的人的眼睛 ----
await p.waitForFunction(() => window.__D().built[window.__K]?.car, null, { timeout: 120000 });
const g0 = await p.evaluate(() => {
  const k = window.__K, D = window.__D(), C = D.built[k], btn = document.querySelector(`#cars button[data-car="${k}"]`), V = window.__CV()[k], P = window.__P()[k];
  return { cur: D.cur, btn: btn ? btn.querySelector('span').textContent : null, name: btn?.querySelector('b')?.textContent, cabin: !!C.cabin, interior: !!C.body.getObjectByName('interior'), bars: !!C.body.getObjectByName('bars'), eye: V?.eye, mid: window.__G().park.mid,
    perf: { price: P.price, hp: P.hp, vmax: P.vmax, top: P.top, offroad: !!P.offroad, light: !!P.light, lean: P.lean, big: !!P.big, bike: !!P.bike, shop: P.shop }, snd: window.__D().SNDC[k], crush: !!window.__D().crushFx && typeof window.__D().crushK === 'function' ? window.__D().crushK(k) : null,
    wheels: { n: C.wheels.length, front: C.wheels[1].rotation === C.body.getObjectByName('wheelF')?.rotation, rear: C.wheels[3].rotation === C.body.getObjectByName('wheelR')?.rotation, inBars: C.body.getObjectByName('bars').getObjectByName('wheelF') != null,
      hubMeshes: C.wheels.reduce((a, w) => { let m = 0; w.parent.traverse((o) => { if (o.isMesh) m++; }); return a + m; }, 0), tyres: (() => { let n = 0; C.car.traverse((o) => { if (o.isMesh && o.parent && /^wheel[FR]$/.test(o.parent.name) && o.material === C.mats.rubber) n++; }); return n; })() } };
});
console.log('  garage:', JSON.stringify(g0));
check(g0.cur === K && g0.name === CAR.name && g0.btn === '你的車' && g0.mid === K, `garage page: the ${CAR.what} is your car, parked on the lobby lift`);
check(!g0.cabin && !g0.interior && g0.bars && g0.eye && g0.eye[1] > 1.1, `you ride it: no car cockpit, no box interior; the handlebars are their own group (they turn); first-person eye ${g0.eye?.[1]} m up`);
check(g0.perf.price === CAR.price && g0.perf.offroad === CAR.off && g0.perf.light === CAR.off && g0.perf.lean === 1 && !g0.perf.big && g0.perf.bike && g0.perf.shop === 'dealer' && g0.perf.vmax === CAR.vmax && g0.perf.top === CAR.top && g0.perf.hp < 3, `${CAR.price} 萬, ${CAR.off ? 'off-road suspension but light (never crushes things)' : 'a road vehicle'}, normal size (fits the tower), leans into turns, pedalled by you (${g0.perf.hp} hp), top ${CAR.vmax} km/h (${CAR.top} fully tuned), sold at 阿財車行`);
check(g0.snd && g0.snd.gain === 0 && g0.snd.idleGain === 0, `no engine sound at all (a bicycle): sound profile 「${g0.snd?.name}」 gain ${g0.snd?.gain}`);
check(g0.wheels.n === 4 && g0.wheels.front && g0.wheels.rear && g0.wheels.inBars && g0.wheels.hubMeshes === 0 && g0.wheels.tyres === 2, `two wheels (${g0.wheels.tyres} tyres; the front one in the handlebar group, so it steers); the four wheel slots drive.js spins are invisible points sharing the real wheels' rotation`);
const sale = await p.evaluate(() => { const D = window.__D(), G = window.__G(); G.owned.delete(window.__K); const s = D.saleOf('dealer'), o = D.saleOf('odealer'); G.owned.add(window.__K); return { dealer: s.includes(window.__K), first: s[0], odealer: o.includes(window.__K) }; });
check(sale.dealer && !sale.odealer && (sale.first === K || sale.first === (K === 'mtb' ? 'road' : 'mtb')), `before you own it, 阿財車行 (not the off-road dealer) sells it, the two bikes cheapest first (${sale.first})`);
const riG = await gshot('0-garage');
const seat = await p.evaluate(async () => {
  document.getElementById('seatBtn').click(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const D = window.__D(), V = window.__CV()[window.__K], c = D.camera.position.clone(), e = c.clone().set(...V.eye); D.S.body.updateWorldMatrix(true, false); D.S.body.localToWorld(e);
  return { d: +c.distanceTo(e).toFixed(3), on: document.getElementById('seatBtn').getAttribute('aria-pressed') };
});
const riSeat = await gshot('0-seat');
await p.evaluate(() => document.getElementById('seatBtn').click());
check(seat.on === 'true' && seat.d < 0.05, `garage page 「車內」: the camera sits at the rider's eye point on the bike (${seat.d} m)`);

// ---- 1 出門：騎上去（你的人坐在上面、戴安全帽、手握把手、腳踩腳踏）、開鐵捲門 ----
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
  const t = D.drv.telemetry(), y0 = D.GAR.group.position.y, R = D.RIDER, C = R.C, Z = D.BIKE_RIDE[window.__K], S = D.BIKE[window.__K], B = D.tripS.body.userData.bike;
  const foot = (nm) => window.__bodyAt(C.bones.find((b) => b.name === nm));
  const a = B.crank.rotation.z, ped = (sd) => { const dx = sd * S.crank; return [S.bb[0] + dx * Math.cos(a) - 0.01, S.bb[1] + dx * Math.sin(a) + 0.07, sd * 0.11 * 0.85]; }; // 腳踝該在哪（bikeRide 一樣的算法）
  return { ok, mode: W.mode, cur: D.cur, door: D.GAR.door.t, rideOn: t.rideOn, cls: t.cls, air: t.air, dy: +(t.y - y0).toFixed(3), wheels: t.wheels,
    rider: !!C && C.group.parent === D.tripS.body && C.group.visible && R.S === D.tripS, hat: C?.look.hat, walkerHidden: !W.character.group.visible, state: C?.state,
    handR: window.__bodyAt(C.hand), handL: window.__bodyAt(C.handL), grip: Z.grip, footR: foot('footR'), footL: foot('footL'), ftR: ped(1), ftL: ped(-1), dvoice: !!D.dvoice, eye: window.__bodyAt(C.eyes), dEye: D.dEye?.eye };
});
console.log('1', el(), JSON.stringify(in1));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
check(in1.mode === 'off' && in1.cur === K && in1.door === 1, `on the ${CAR.name} on the lobby turntable, door open`);
check(!before.on && in1.rider && in1.walkerHidden && in1.state === 'sit' && in1.hat === 'helmet', `you sit on the bike (your person, sitting, wearing a helmet); the walking you is hidden; nobody was on it before you got on`);
const gR = dist(in1.handR, in1.grip), gL = dist(in1.handL, [in1.grip[0], in1.grip[1], -in1.grip[2]]), fR = dist(in1.footR, in1.ftR), fL = dist(in1.footL, in1.ftL);
check(gR < 0.04 && gL < 0.04 && fR < 0.06 && fL < 0.06, `hands on the grips (${gR.toFixed(3)} / ${gL.toFixed(3)} m off), feet on the pedals (${fR.toFixed(3)} / ${fL.toFixed(3)} m off)`);
const FP = K === 'mtb' ? [0.22, 0.05] : [0.15, 0.05]; // 第 90 批：第一人稱的鏡頭從眼睛往後、往上一點（town.src.js RIDES[k].fp），看得到手握把手
check(in1.dEye && Math.abs(in1.dEye[0] - in1.eye[0] - (0.06 - FP[0])) < 0.02 && Math.abs(in1.dEye[1] - in1.eye[1] - FP[1]) < 0.02, `the first-person camera is at the rider's eyes, ${Math.round((FP[0] - 0.06) * 100)} cm back and ${Math.round(FP[1] * 100)} cm up so the hands on the bars are in view (eye ${in1.eye}, camera ${in1.dEye})`);
check((CAR.off ? in1.cls === 'offroad' : in1.cls !== 'offroad') && !in1.air && Math.abs(in1.dy) < 0.03, `the ${CAR.name} rides on the ${CAR.off ? 'off-road' : 'road'} suspension (class ${in1.cls}), sitting on the lobby floor (${in1.dy} m)`);
const riOn = await shot('1-on');

// ---- 2 右轉開上斜坡到 3 樓（跟 jeep-test 同一條路線）----
const up = await p.evaluate(() => {
  const D = window.__D(), R = D.TOWER_RAMP, RM = R.RM, deg = Math.PI / 180, F = 2, e = R.ent(F), y0 = D.GAR.group.position.y;
  const pts = [[2, 0], [6, 0], [10, 0], [13, 0], [16, 0.6], [18, 2.5], [18.6, 5]];
  for (let a = 25 * deg; a <= e - 22 * deg; a += 5 * deg) { const r = a < 45 * deg ? RM + ((18.5 - RM) * (45 * deg - a)) / (20 * deg) : a > e - 60 * deg ? RM + (16 - RM) * Math.min(1, (a - e + 60 * deg) / (30 * deg)) : RM; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  const rho = 5; for (let ph = 0; ph <= 90; ph += 10) { const sx = -rho + rho * Math.sin(ph * deg), n = rho - rho * Math.cos(ph * deg), r = 16 - n, an = e + sx / 16; pts.push([r * Math.cos(an), r * Math.sin(an)]); }
  for (const r of [9, 8]) pts.push([r * Math.cos(e), r * Math.sin(e)]);
  const o = { maxErr: 0, air: 0, ys: [], toasts: new Set(), lands: 0, pitch: 0, roll: 0, uMax: 0, lean: 0, leanL: 0 };
  const l0 = D.drv.telemetry().lands;
  const r = window.__follow(pts, 60 * 60, (k, n) => (k >= n - 13 ? 3 : 7), (t) => { const T = window.__D().TRAMP, G = window.__D().GAR; return !T.on && G.floor === F && Math.hypot(window.__gl(t.x, t.z).x, window.__gl(t.x, t.z).z) < 9.5; }, (t) => {
    const D2 = window.__D(), T = D2.TRAMP, ts = window.__toast(); if (ts) o.toasts.add(ts);
    if (t.air) o.air++;
    if (!T.on) return;
    o.uMax = Math.max(o.uMax, T.u); o.maxErr = Math.max(o.maxErr, Math.abs(t.y - (y0 + D2.towerRampY(T.u))));
    o.pitch = Math.max(o.pitch, Math.abs(t.pitch)); o.roll = Math.max(o.roll, Math.abs(t.roll)); const bx = D2.tripS.body.rotation.x; o.lean = Math.max(o.lean, bx); o.leanL = Math.min(o.leanL, bx);
    if (o.ys.length < 400) o.ys.push(+t.y.toFixed(2));
  });
  window.__stop(40);
  const t = D.drv.telemetry();
  let dec = 0; for (let i = 1; i < o.ys.length; i++) dec = Math.max(dec, o.ys[i - 1] - o.ys[i]);
  return { ...r, s: +(r.i / 60).toFixed(1), maxErr: +o.maxErr.toFixed(3), dec: +dec.toFixed(3), air: o.air, lands: t.lands - l0, pitch: +o.pitch.toFixed(3), roll: +o.roll.toFixed(3), uMax: +o.uMax.toFixed(2), lean: +o.lean.toFixed(3), leanL: +o.leanL.toFixed(3), toasts: [...o.toasts], floor: D.GAR.floor, on: D.TRAMP.on, y: +(t.y - y0).toFixed(2), crushed: D.crushFx ? D.crushFx.stats.props + D.crushFx.stats.cars + D.crushFx.stats.big : -1, crimes: D.police ? D.police.telemetry().crimes.length : -1, rider: D.RIDER.C.group.parent === D.tripS.body && D.RIDER.C.group.visible };
});
console.log('2', el(), 'up:', JSON.stringify(up));
check(up.ok && up.uMax > 6 && up.maxErr < 0.12 && up.dec < 0.02 && up.air === 0 && up.lands === 0, `rode out the door and up the ramp: the suspension follows the ramp (off by ≤ ${up.maxErr} m, never drops, never in the air), two half-laps in ${up.s} s`);
check(up.bumps === 0 && up.pitch < 0.2 && up.roll < 0.12 && up.rider, `no bumping into the low walls; the ramp tilts it at most ${up.pitch} rad (pitch), ${up.roll} rad (roll); you stay on it`);
check(up.lean > 0.1 && up.lean < 0.71 && up.leanL > -0.71, `going round the tower (a right-hand turn) the bike leans into the turn: up to ${up.lean} rad to the right (${(up.lean * 180 / Math.PI).toFixed(0)}°; never past 40°)`);
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
  D.leaveCar(); let n = 0; const ts = new Set(); for (; n < 300 && (D.walker.mode !== 'walk' || n < 200); n++) { window.__dstep(1); const t = window.__toast(); if (t) ts.add(t); } const toast = [...ts].join(' / '); // 停好的提示跟在「往前開進空的格子」後面（腳踏車慢，舊的還沒退）：收一段時間的提示
  const i = D.TWR.indexOf(window.__K), R = D.RIDER;
  return { ...r, mode: D.walker.mode, toast, bay: i, f: i >= 0 ? D.TOWER_BAYS[i].f : null, saved: window.__G().park.tower[i], riderOff: !R.S && !R.C.group.parent && !R.C.group.visible, walkerShown: D.walker.character.group.visible };
});
console.log('4', el(), JSON.stringify(park4));
check(park4.ok && park4.bumps === 0 && park4.mode === 'walk' && park4.f === 4 && park4.saved === K && new RegExp(`停好了：B1 ${park4.bay - 23} 號`).test(park4.toast), `rode into a B1 spot and got off: 「${park4.toast}」 (saved in spot ${park4.bay + 1})`);
check(park4.riderOff && park4.walkerShown, 'getting off: the rider comes off the bike and you walk again (nobody left sitting on the parked bike)');
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
  return { floor: G.floor, y: +(D.tripS.car.position.y - y0).toFixed(3), rideOn: t.rideOn, air: t.air, hl: +hl.toFixed(3), toast: window.__toast() }; // 一般的路車：塔的一樓不是地形（ride 關著，telemetry 的 y 是上一次的），看車子真的高度
});
console.log('  1F:', JSON.stringify(f1));
check(f1.floor === 0 && Math.abs(f1.y) < 0.03 && !f1.air && Math.abs(f1.hl) < 0.05, `rode back up to 1F (y ${f1.y}), turned to face the door 「${f1.toast}」`);
const out4 = await p.evaluate(() => {
  const D = window.__D(); D.GAR.door.open(0.2); window.__dstep(30);
  const r = window.__follow([[0, 0], [4, 0], [10, 0], [16, 0], [24, 0], [30, 0]], 60 * 15, () => 6, (t) => window.__gl(t.x, t.z).x > 26);
  window.__stop(60);
  const t = D.drv.telemetry();
  return { ...r, dy: +(D.tripS.car.position.y - D.VIL.heightAt(t.x, t.z)).toFixed(3), floor: D.GAR.floor };
});
console.log('  out the door:', JSON.stringify(out4));
check(out4.ok && out4.bumps === 0 && Math.abs(out4.dy) < 0.05 && out4.floor === 0, `rode out through the door onto the street (${out4.dy} m off the ground)`);

// ---- 5 快速道路：踩到底 20 秒（沿著外側車道）：最快 30／35；腳踏跟著後輪轉、腳跟著腳踏；把手跟著轉、手跟著把手；第一人稱 ----
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
    if (i > 30) { dy = Math.max(dy, Math.abs(D.tripS.car.position.y - D.PW.heightAt(t2.x, t2.z))); pitch = Math.max(pitch, Math.abs(t2.pitch)); roll = Math.max(roll, Math.abs(t2.roll)); }
  }
  const B = D.tripS.body.userData.bike, S = D.BIKE[window.__K], R = D.BIKE_RIDE[window.__K], C = D.RIDER.C, a = B.crank.rotation.z, wz = B.wheels[0].rotation.z; // 踩著的時候量：曲柄＝後輪÷齒比、腳踏保持水平、腳踝在腳踏上
  const foot = (nm) => window.__bodyAt(C.bones.find((b) => b.name === nm)), ped = (sd) => { const dx = sd * S.crank; return [S.bb[0] + dx * Math.cos(a) - 0.01, S.bb[1] + dx * Math.sin(a) + 0.07, sd * 0.11 * 0.85]; };
  const crank = { a: +a.toFixed(2), turns: +(Math.abs(a) / (2 * Math.PI)).toFixed(1), ratioOk: Math.abs(a - wz / R.ratio) < 1e-6, level: B.peds.every((p) => Math.abs(p.rotation.z + a) < 1e-6), footR: foot('footR'), footL: foot('footL'), ftR: ped(1), ftL: ped(-1) };
  d.setInput(null); const t = d.telemetry();
  return { vmax: Math.round(vmax), air, dy: +dy.toFixed(3), pitch: +pitch.toFixed(3), roll: +roll.toFixed(3), lands: t.lands - l0, bumps: t.bumps - b0, surface: t.surface, crank };
});
console.log('5', el(), 'highway:', JSON.stringify(hw));
check(hw.vmax > CAR.hwMin && hw.vmax <= CAR.vmax + 1 && hw.bumps === 0, `pedalling flat out on the expressway for 20 s: ${hw.vmax} km/h (top ${CAR.vmax}), no bumps`);
const cfR = dist(hw.crank.footR, hw.crank.ftR), cfL = dist(hw.crank.footL, hw.crank.ftL);
check(hw.crank.turns > 20 && hw.crank.ratioOk && hw.crank.level && cfR < 0.06 && cfL < 0.06, `the pedals turn with the rear wheel (crank ${hw.crank.turns} turns, = wheel ÷ gear ratio), the pedals stay level, and your feet stay on them (${cfR.toFixed(3)} / ${cfL.toFixed(3)} m off)`);
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
  return { s0, s1, s2, max: D.BIKE_RIDE[window.__K].max };
});
console.log('  bars:', JSON.stringify(bars));
check(Math.abs(bars.s0.ang) < 0.02 && bars.s1.s > 0.9 && Math.abs(bars.s1.ang - bars.max * bars.s1.s) < 0.03 && bars.s1.y < 0 && bars.s2.s < -0.9 && bars.s2.y > 0, `the handlebars turn with the steering (straight ${bars.s0.ang} rad; full right ${bars.s1.ang} rad; full left the other way)`);
check(bars.s1.R[0] < bars.s0.R[0] - CAR.hx && bars.s1.L[0] > bars.s0.L[0] + CAR.hx && bars.s2.R[0] > bars.s0.R[0] + CAR.hx, `the hands follow the grips (right hand x ${bars.s0.R[0]} → ${bars.s1.R[0]} turning right, left hand ${bars.s0.L[0]} → ${bars.s1.L[0]})`);
await p.evaluate(() => { const d = window.__D().drv; d.setInput({ throttle: 0, brake: 0, steer: 1, handbrake: 1 }); window.__dstep(40); });
const riTurn = await shot('5-turn');
await p.evaluate(() => { const d = window.__D().drv; d.setInput(null); window.__dstep(40); d.setCameraMode('eye'); window.__dstep(2); });
const eye = await p.evaluate(() => { const D = window.__D(), C = D.RIDER.C, c = D.dcam.position.clone(), e = c.clone().set(...D.dEye.eye); D.tripS.body.updateWorldMatrix(true, false); D.tripS.body.localToWorld(e);
  // 第 90 批：第一人稱也畫騎的人（頭縮到看不見），兩隻手握把手在畫面裡
  D.dcam.updateMatrixWorld(); const ndc = (o) => { const v = c.clone(); o.updateWorldMatrix(true, false); o.getWorldPosition(v); v.project(D.dcam); return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(3)]; };
  const best = (os) => os.map(ndc).sort((a, b) => Math.max(Math.abs(a[0]), Math.abs(a[1])) - Math.max(Math.abs(b[0]), Math.abs(b[1])))[0]; // 手腕、手指、指尖、大拇指：最裡面那一點（直拿的畫面窄：手指在兩邊）
  const hd = C.skeleton.getBoneByName('head'), hv = c.clone(); hd.updateWorldMatrix(true, false); hd.getWorldScale(hv);
  return { d: +c.distanceTo(e).toFixed(3), riderVis: C.group.visible && !!C.group.parent, fp: !!C.fpOn, head: +hv.x.toExponential(1), R: best([C.hand, ...[17, 18, 19].map((i) => C.bones[i])]), L: best([C.handL, ...[10, 11, 12].map((i) => C.bones[i])]), mir: D.MIR.list.length, mirOn: D.MIR.on }; });
console.log('  eye:', JSON.stringify(eye));
const onScr = (v) => Math.abs(v[0]) < 1 && Math.abs(v[1]) < 1 && v[2] > -1 && v[2] < 1;
const riEye = await shot('5-eye');
check(eye.d < 0.05 && eye.mir === 0, `first person: the camera sits at the rider's eyes (${eye.d} m), no mirrors to draw (${eye.mir})`);
check(eye.riderVis && eye.fp && eye.head < 0.01 && onScr(eye.R) && onScr(eye.L), `first person shows your own hands on the grips (right ${eye.R.slice(0, 2)}, left ${eye.L.slice(0, 2)} on screen); the head is shrunk away (scale ${eye.head}) so it is not in the way`);
const back = await p.evaluate(() => { window.__D().drv.setCameraMode('chase'); window.__dstep(2); const C = window.__D().RIDER.C, v = C.group.position.clone(); const hd = C.skeleton.getBoneByName('head'); hd.updateWorldMatrix(true, false); hd.getWorldScale(v); return { fp: !!C.fpOn, head: +v.x.toFixed(3), vis: C.group.visible }; });
check(!back.fp && back.head > 0.99 && back.vis, `back to the chase camera: the rider has a head again (scale ${back.head})`);
const chase = await p.evaluate(() => window.__D().RIDER.C.group.visible);
check(chase, 'back to the chase camera: you are on the bike again');
await p.evaluate(() => window.__stop(120));

// ---- 6 轉彎往裡面倒：快速道路上直直騎到約 20 公里，打一點方向：車身往彎裡面倒（騎的人跟著）；停下來就正的 ----
const lean = await p.evaluate(() => {
  const D = window.__D(), d = D.drv, H = D.VIL.places.highway, body = D.tripS.body, C = D.RIDER.C;
  d.teleport(H.spawn); window.__dstep(30);
  const tilt = (o) => { const q = o.getWorldQuaternion(new body.quaternion.constructor()), u = new body.position.constructor(0, 1, 0).applyQuaternion(q); return Math.acos(Math.min(1, u.y)); };
  let n = 0; for (; n < 900 && d.telemetry().kmh < 20; n++) { d.setInput({ throttle: 1, brake: 0, steer: 0 }); window.__dstep(1); }
  const v0 = d.telemetry().kmh, b0 = d.telemetry().bumps, straight = +body.rotation.x.toFixed(3);
  const res = { R: { lean: 0 }, L: { lean: 0 } }; // 右 35 格、左 70 格、右 35 格：方向轉回來，不會騎到護欄；第 79 批起腳踏車最快 60：轉彎的時候速度留在 24 公里左右（不然越騎越快、彎變大，騎到護欄）
  for (const [sg, n2] of [[1, 50], [-1, 100], [1, 50]]) {
    const o = res[sg > 0 ? 'R' : 'L'];
    for (let i = 0; i < n2; i++) { d.setInput({ throttle: d.telemetry().kmh < 24 ? 1 : 0, brake: 0, steer: 0.35 * sg }); window.__dstep(1); const t = d.telemetry(); if (sg * body.rotation.x > sg * o.lean) Object.assign(o, { lean: +body.rotation.x.toFixed(3), rider: +tilt(C.group).toFixed(3), kmh: Math.round(t.kmh), steer: +t.steer.toFixed(2) }); }
  }
  d.setInput(null); window.__stop(240); window.__dstep(60);
  return { v0: Math.round(v0), straight, ...res, bumps: d.telemetry().bumps - b0, stopKmh: +d.telemetry().kmh.toFixed(1), stopped: +body.rotation.x.toFixed(3), riderStopped: +tilt(C.group).toFixed(3), riderChild: C.group.parent === body };
});
console.log('6', el(), 'lean:', JSON.stringify(lean));
check(lean.v0 >= 18 && Math.abs(lean.straight) < 0.03 && lean.bumps === 0, `riding straight at ${lean.v0} km/h the bike is upright (${lean.straight} rad)`);
check(lean.R.steer > 0.25 && lean.R.lean > 0.05 && lean.R.lean < 0.71 && lean.L.steer < -0.25 && lean.L.lean < -0.05 && lean.L.lean > -0.71, `steering right it leans right (${lean.R.lean} rad at ${lean.R.kmh} km/h), steering left it leans left (${lean.L.lean} rad); never past 40°`);
check(lean.riderChild && Math.abs(lean.R.rider - Math.abs(lean.R.lean)) < 0.08 && Math.abs(lean.L.rider - Math.abs(lean.L.lean)) < 0.08, `the rider leans with the bike (rider tilts ${lean.R.rider} / ${lean.L.rider} rad)`);
check(lean.stopKmh < 1 && Math.abs(lean.stopped) < 0.02 && lean.riderStopped < 0.05, `stopped (${lean.stopKmh} km/h): the bike is upright again (${lean.stopped} rad)`);
const riLean = await shot('6-stopped');

// ---- 7 輕量車（停車格、朋友騎的）：只有兩個輪子，都在中間 ----
const lod = await p.evaluate(async () => {
  const D = window.__D(), k = window.__K, sc = await D.LOD_CARS[k].load(), l = D.buildLodCar(k, sc, D.CARS[k].state), car = l.car;
  car.updateMatrixWorld(true);
  const B = (m) => { const b = new D.camera.position.constructor(), bx = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }, a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++) { b.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); const v = [b.x, b.y, b.z]; for (let k = 0; k < 3; k++) { bx.min[k] = Math.min(bx.min[k], v[k]); bx.max[k] = Math.max(bx.max[k], v[k]); } } return bx; };
  const wm = car.getObjectByName('lod-wheels'), rm = car.getObjectByName('lod-rims');
  let draws = 0, tris = 0; car.traverse((o) => { if (o.isMesh && o.visible) { draws++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  const wb = wm ? B(wm) : null;
  return { wheels: !!wm, z: wb ? [+wb.min[2].toFixed(3), +wb.max[2].toFixed(3)] : null, x: wb ? [+wb.min[0].toFixed(2), +wb.max[0].toFixed(2)] : null, rims: rm ? rm.visible : null, draws, tris: Math.round(tris) };
});
console.log('7', el(), 'LOD:', JSON.stringify(lod));
check(lod.wheels && lod.z[0] > -0.15 && lod.z[1] < 0.15 && lod.x[0] < -CAR.wx && lod.x[1] > CAR.wx && !lod.rims, `the light-weight bike (parking spots, a friend riding) has just two wheels in the middle (wheels z ${lod.z}, x ${lod.x}): ${lod.draws} draws, ${lod.tris} triangles`);

console.log('draw calls:', JSON.stringify({ garage: riG, seat: riSeat, on: riOn, f3: ri3, b1: riB1, parked: riPark, highway: riHw, turn: riTurn, eye: riEye, stopped: riLean }));
check(!errs.length, `no page errors (${errs.length})`);
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS OK', el());
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
