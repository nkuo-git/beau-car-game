// 第 7 批（輾扁）：怪獸卡車開上去把東西壓扁（art/garage.html 整頁跑一次）
//   1 開 GC8 出門 → 撞路上的車（只是撞到、彈開，不會扁）、撞垃圾桶（也不會扁）
//   2 直接回車庫 → 換怪獸卡車 → 出門 → 輾路上的車：車頂壓扁、玻璃破、車上的人跳車跑掉（沒人受傷）、警察 +1★、接著還開得動
//   3 輾路邊的東西（垃圾桶、燈箱、機車、板凳⋯）：扁掉、再 +1★
//   4 越野車場的表演場：土坡＋一排五台舊車：輾爆不會報警、第一次說「輾扁了！」、過一會兒自己回來
//   5 輾扁的車在路邊留 20 秒再收回車流的池子
// node crush-test.mjs [prefix]（截圖 <prefix>-1-… .png）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = 'crush'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__G = () => GAME; window.__S = () => S; window.__scene = () => scene;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__money = (n) => { GAME.money = n; save(true); renderWallet(); renderOptions(); refreshCarBtns(); };'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, trip, tripS, tripPose, tripFull, cur, walker, LODS, TR, PERF, indoor });'
  + ' window.__N = () => NPC; window.__C = () => crushFx; window.__pol = () => (typeof police !== "undefined" ? police : null);'
  + ' window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };';
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
async function drawAndShot(name) { // 畫兩格再截圖（開車停住的時候畫的是現在的樣子）
  const n0 = await p.evaluate(() => { window.__noDraw = false; return window.__dframes || 0; });
  await p.waitForFunction((n) => (window.__dframes || 0) >= n + 2, n0, { timeout: 300000 });
  await p.evaluate(() => { window.__noDraw = true; });
  await p.screenshot({ path: `${prefix}-${name}.png` });
  const ri = await p.evaluate(() => window.__rinfo());
  console.log('  shot', `${prefix}-${name}.png`, JSON.stringify(ri), el());
  return ri;
}
// 開局：GC8＋怪獸卡車都有，1000 萬（不用去買）
await p.addInitScript(() => {
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 1000, owned: ['gc8', 'monster'], parts: {}, tyres: {}, wins: {}, cars: {} }));
  }
});
// 小幫手：走去上車、停住的車子程式開車
await p.addInitScript(() => {
  const H = {};
  window.__H = H;
  H.step = (n, dt = 1 / 60) => { const D = window.__D(); for (let i = 0; i < n && D.on; i++) window.__dstep(1, dt); };
  const vis = (e) => !!e && !e.hidden && !e.closest('[hidden]') && e.getClientRects().length > 0;
  const act = () => [...document.querySelectorAll('#stage .wk-act, #stage .dv-act')].find(vis);
  H.actText = () => { const e = act(); return e ? e.querySelector('span').textContent : null; };
  H.press = () => { const e = act(); if (!e) return null; const s = e.querySelector('span').textContent; e.click(); return s; };
  // 車子旁邊 2.6 公尺站好 → 按「上車」→ 坐進去
  H.boardCar = () => {
    const D = window.__D(), W = D.walker, q = D.tripPose[D.cur];
    if (!q) return { err: 'no pose' };
    const c = Math.cos(q.heading), s = Math.sin(q.heading);
    let a = null, spot = null;
    for (const d of [2.0, 2.6, 1.5, 3.2]) { // 車身旁邊幾公尺（walk.js：離車身 1.6 公尺以內才給「上車」）
      for (const sd of [1, -1]) {
        W.teleport({ x: q.x + s * d * sd, z: q.z + c * d * sd, heading: q.heading + sd * Math.PI / 2 });
        H.step(12);
        a = H.actText();
        if (a && a.indexOf('上車') === 0) { spot = [d, sd]; break; }
        a = null;
      }
      if (a) break;
    }
    H.step(30);
    const pressed = W.getIn(); // walk.js：走到車門、坐進去（HUD 的「上車」按鈕就是叫這個）
    const modes = []; for (let i = 0; i < 900 && W.mode !== 'off'; i++) { H.step(1); modes.push(W.mode); }
    H.step(30);
    const t = W.telemetry();
    return { act: a, spot, pressed, mode: W.mode, modes: [...new Set(modes)], cur: window.__D().cur, drv: !!window.__D().drv, cars: W.cars.map((k) => k.key), w: [+t.x.toFixed(1), +t.z.toFixed(1)], paused: t.paused };
  };
  // 程式開車：油門／煞車／方向，開到 until() 或 s 秒
  H.drive = (inp, s, untilSrc) => {
    const D = window.__D(), d = D.drv, f = untilSrc ? new Function(`return (${untilSrc});`) : null;
    let n = 0, hit = false, maxY = 0, maxKmh = 0;
    const t0 = d.telemetry(), x0 = t0.x, z0 = t0.z;
    d.setInput(inp);
    for (; n < s * 60; n++) { H.step(1); const q = d.telemetry(); if (q.y > maxY) maxY = q.y; if (q.kmh > maxKmh) maxKmh = q.kmh; if (f && f()) { hit = true; break; } }
    d.setInput(null);
    const t = d.telemetry();
    return { s: +(n / 60).toFixed(2), hit, kmh: Math.round(t.kmh), x: +t.x.toFixed(1), z: +t.z.toFixed(1), bumps: t.bumps, pen: t.pen, air: t.air, y: t.y != null ? +t.y.toFixed(2) : null, maxY: +maxY.toFixed(2), maxKmh: Math.round(maxKmh), moved: +Math.hypot(t.x - x0, t.z - z0).toFixed(1) };
  };
  H.hurt = () => { // 有沒有人受傷（倒地、躺著、爬起來）
    const N = window.__N(); if (!N) return { peds: 0, down: 0, knocks: 0 };
    const down = N.peds.people.filter((q) => !q.gone && (q.mode === 'fall' || q.mode === 'lie' || q.mode === 'getup')).length;
    return { peds: N.peds.people.filter((q) => !q.gone).length, down, knocks: N.peds.stats.knocks, flee: N.peds.people.filter((q) => !q.gone && q.mode === 'flee').length };
  };
  H.pol = () => { const P = window.__pol(); return P ? { wanted: P.wanted, types: P.telemetry().crimes.map((c) => c.type) } : null; };
  H.cst = () => { const C = window.__C(); return C ? { ...C.stats, types: C.stats.types.slice(), junk: C.stats.junk, pads: C.pads.filter((q) => q.on).length, junkCars: C.junk.length } : null; };
  // 路上的車：最近的一台汽車（不是機車）；停住它（測試用：stun），回它的位置
  H.pickTraffic = (r = 70) => {
    const D = window.__D(), N = window.__N(), t = D.drv.telemetry();
    let best = null, bd = r;
    for (const c of N.traffic.cars) {
      if (c.kind !== 'car') continue;
      const d = Math.hypot(c.x - t.x, c.z - t.z); if (d > bd) continue;
      let busy = false; // 後面 10 公尺要空（怪獸卡車要放在那裡）
      const bx = c.x - Math.cos(c.heading) * 10, bz = c.z + Math.sin(c.heading) * 10;
      for (const q of N.traffic.cars) if (q !== c && Math.hypot(q.x - bx, q.z - bz) < 7) busy = true;
      if (busy) continue;
      bd = d; best = c;
    }
    if (!best) return null;
    best.stun = 40; // 測試：讓它停著不動（不然要追著跑）
    return { id: best.id, key: best.key, x: +best.x.toFixed(1), z: +best.z.toFixed(1), heading: +best.heading.toFixed(3), hx: best.hx, hz: best.hz,
      bx: best.x - Math.cos(best.heading) * 10, bz: best.z + Math.sin(best.heading) * 10 };
  };
  H.carState = (id) => { // 那一台現在怎麼樣（扁了沒、在車流裡還是 wrecks 裡）
    const N = window.__N();
    const inA = N.traffic.cars.find((c) => c.id === id), inW = N.traffic.wrecks.find((c) => c.id === id), c = inA || inW;
    return { live: !!inA, wreck: !!inW, crushed: !!(c && c.crushed), scaleY: c && c.lod ? +c.lod.body.scale.y.toFixed(3) : null,
      glass: c && c.lod ? c.lod.meshes.glass.visible : null, driver: c && c.lod && c.lod.driver ? c.lod.driver.group.visible : null, v: c ? +c.v.toFixed(2) : null };
  };
  // 輾得過去的路邊東西：離 (x, z) 最近的一個（旁邊 3 公尺沒有高的東西，怪獸卡車開得到）
  H.pickProp = (x, z, r = 140) => { // 輾得過去的路邊東西：離 (x, z) 最近、而且有一個方向開得過去（怪獸卡車 3.8 公尺寬）
    const D = window.__D(), C = window.__C(), cols = D.VIL.colliders, tall = [];
    for (const q of cols) if ((q.h ?? 9) >= 1.8 && Math.abs(q.x - x) < r + 60 && Math.abs(q.z - z) < r + 60) tall.push(q);
    const clearAt = (px, pz, m) => {
      for (const q of tall) {
        const d = q.t === 'box' ? Math.hypot(Math.max(0, Math.abs(px - q.x) - q.hx), Math.max(0, Math.abs(pz - q.z) - q.hz)) : Math.hypot(px - q.x, pz - q.z) - q.r;
        if (d < m) return false;
      }
      return true;
    };
    const cands = cols.filter((c) => C.can(c) && Math.hypot(c.x - x, c.z - z) < r).sort((a2, b2) => Math.hypot(a2.x - x, a2.z - z) - Math.hypot(b2.x - x, b2.z - z));
    for (const c of cands) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, ux = Math.cos(a), uz = -Math.sin(a);
        let ok = true;
        for (const d of [2.5, 5, 8, 11, 13]) if (!clearAt(c.x - ux * d, c.z - uz * d, 2.4)) { ok = false; break; }
        if (!ok) continue;
        return { t: c.t, x: c.x, z: c.z, r: c.r ?? null, hx: c.hx ?? null, hz: c.hz ?? null, h: c.h, a: +a.toFixed(3), d: +Math.hypot(c.x - x, c.z - z).toFixed(1), n: cands.length };
      }
    }
    return { none: true, n: cands.length };
  };
});

const summary = [];
// ================= 1 開 GC8 出門：撞路上的車、撞垃圾桶：只是撞到（不會扁）=================
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
await p.waitForFunction(() => !!window.__S() && !window.__D().trip, null, { timeout: 300000 }); await p.waitForTimeout(2500); // 車子進車庫了（車庫頁的怪獸卡車沒有車位，不等輕量車）
console.log('1', el(), 'garage page, car:', await p.evaluate(() => window.__D().cur));
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.waitForFunction(() => window.__D().tripPose && window.__D().tripPose[window.__D().cur] && window.__C(), null, { timeout: 120000 });
const bd1 = await p.evaluate(() => window.__H.boardCar());
console.log('  board GC8:', JSON.stringify(bd1));
check(bd1.mode === 'off' && bd1.drv && bd1.cur === 'gc8', `walked to the GC8 and got in (${bd1.act}, ${JSON.stringify(bd1.modes)})`);
// 開到路上、找一台停著的車撞上去
await p.evaluate(() => { const D = window.__D(), H = window.__H; D.drv.teleport(D.VIL.places.garage.spawn); H.step(20); window.__pol()?.clear(); }); // 車庫前面的空地（路上的車開始生）
let tgt = null;
for (let i = 0; i < 20 && !tgt; i++) { await p.evaluate(() => window.__H.step(90)); tgt = await p.evaluate(() => window.__H.pickTraffic(90)); }
console.log('  traffic target:', JSON.stringify(tgt), '| after', el());
check(!!tgt, 'found a traffic car to ram with the GC8');
const ram1 = await p.evaluate((q) => {
  const D = window.__D(), H = window.__H;
  D.drv.teleport({ x: q.bx, z: q.bz, heading: q.heading }); H.step(10);
  const r = H.drive({ throttle: 0.55, brake: 0, steer: 0 }, 4, 'window.__D().drv.telemetry().bumps > 0');
  H.step(60);
  return { r, car: H.carState(q.id), cst: H.cst(), hurt: H.hurt(), pol: H.pol(), npcHits: window.__N().traffic.stats.hits };
}, tgt);
console.log('  GC8 rams a traffic car:', JSON.stringify(ram1));
check(ram1.cst.cars === 0 && !ram1.car.crushed && ram1.car.scaleY === 1 && ram1.car.live, 'GC8 ramming a traffic car: it is NOT crushed (still in the traffic flow, body not squashed)');
check(ram1.r.bumps > 0 || ram1.npcHits > 0, `GC8 ramming a traffic car: a normal collision and a bump (bumps ${ram1.r.bumps}, npc hits ${ram1.npcHits})`);
await drawAndShot('1-gc8-bump');
// GC8 撞垃圾桶：也不會扁
const prop1 = await p.evaluate(() => { const D = window.__D(), t = D.drv.telemetry(); return window.__H.pickProp(t.x, t.z, 140); });
console.log('  prop near the GC8:', JSON.stringify(prop1));
const gcProp = prop1 && !prop1.none ? await p.evaluate((c) => {
  const D = window.__D(), H = window.__H, a = c.a;
  D.drv.teleport({ x: c.x - Math.cos(a) * 11, z: c.z + Math.sin(a) * 11, heading: a }); H.step(10);
  const r = H.drive({ throttle: 0.5, brake: 0, steer: 0 }, 5, 'window.__D().drv.telemetry().bumps > 0');
  return { r, cst: H.cst() };
}, prop1) : { r: { bumps: 0, kmh: 0 }, cst: { props: -1 } };
console.log('  GC8 into a roadside thing:', JSON.stringify(gcProp));
check(!!prop1 && !prop1.none && gcProp.cst.props === 0 && (gcProp.r.bumps > 0 || gcProp.r.kmh < 12), `GC8 into a crushable roadside thing (${JSON.stringify(prop1)}): nothing crushed, it still blocks (bumps ${gcProp.r.bumps}, ${gcProp.r.kmh} km/h)`);
summary.push(`GC8: 0 crushes (${gcProp.r.bumps + ram1.r.bumps} bumps)`);

// ================= 2 換怪獸卡車：輾路上的車 =================
await p.evaluate(() => { window.__hold = false; document.getElementById('driveHome').click(); });
await p.waitForFunction(() => !window.__D().on && !window.__D().trip, null, { timeout: 300000 });
await p.waitForTimeout(1500);
await p.evaluate(() => document.querySelector('#cars button[data-car="monster"]').click());
await p.waitForFunction(() => window.__D().cur === 'monster' && !!window.__S(), null, { timeout: 120000 });
await p.waitForTimeout(4000);
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.waitForFunction(() => window.__D().tripPose && window.__D().tripPose.monster, null, { timeout: 120000 });
const bd2 = await p.evaluate(() => window.__H.boardCar());
console.log('2', el(), 'board the monster truck:', JSON.stringify(bd2));
check(bd2.mode === 'off' && bd2.cur === 'monster' && bd2.drv, `walked to the monster truck and got in (${bd2.act})`);
check(await p.evaluate(() => !!window.__D().drv.telemetry().rideOn && window.__D().drv.carInfo.halfW === 1.905), 'the monster truck drives with the terrain ride on (half width 1.905)');
await p.evaluate(() => { const D = window.__D(), H = window.__H; D.drv.teleport(D.VIL.places.garage.spawn); H.step(20); window.__pol()?.clear(); });
let tgt2 = null;
for (let i = 0; i < 20 && !tgt2; i++) { await p.evaluate(() => window.__H.step(90)); tgt2 = await p.evaluate(() => window.__H.pickTraffic(90)); }
console.log('  traffic target:', JSON.stringify(tgt2));
check(!!tgt2, 'found a traffic car for the monster truck');
const crush2 = await p.evaluate((q) => {
  const D = window.__D(), H = window.__H;
  window.__pol()?.clear();
  const n0 = window.__N().peds.stats.knocks;
  D.drv.teleport({ x: q.bx, z: q.bz, heading: q.heading }); H.step(10);
  const r = H.drive({ throttle: 0.45, brake: 0, steer: 0 }, 6, 'window.__C().stats.cars > 0');
  const mid = { car: H.carState(q.id), hurt: H.hurt(), y: D.drv.telemetry().y };
  const r2 = H.drive({ throttle: 0.45, brake: 0, steer: 0 }, 2.5, null); // 開上去、壓過去
  return { r, r2, mid, car: H.carState(q.id), cst: H.cst(), hurt: H.hurt(), pol: H.pol(), knocks0: n0, tele: D.drv.telemetry() };
}, tgt2);
console.log('  monster truck crushes a traffic car:', JSON.stringify({ r: crush2.r, r2: crush2.r2, car: crush2.car, cst: crush2.cst, hurt: crush2.hurt, pol: crush2.pol }));
check(crush2.cst.cars === 1 && crush2.car.crushed && crush2.car.wreck, 'the monster truck crushed the traffic car (taken out of the traffic flow)');
check(crush2.car.scaleY <= 0.45 && crush2.car.glass === false, `the car body is squashed flat and the glass is broken (body scale y ${crush2.car.scaleY})`);
check(crush2.cst.bails >= 1 && crush2.car.driver === false, `the driver (and passengers) got out before it was crushed (${crush2.cst.bails} out, driver gone from the cab)`);
check(crush2.hurt.down === 0 && crush2.hurt.knocks === crush2.knocks0 && !crush2.pol.types.includes('hit'), `nobody was hurt (nobody down, knocks still ${crush2.hurt.knocks})`);
check(crush2.pol.wanted === 1 && crush2.pol.types.includes('crush'), `a police star was given on the village streets (${crush2.pol.wanted}★, crimes ${crush2.pol.types.join(',')})`);
check(Math.max(crush2.r.maxY, crush2.r2.maxY) > 0.25, `the truck climbed up onto the car (body height ${Math.max(crush2.r.maxY, crush2.r2.maxY)} m above the road, ${crush2.r2.y} m when it was back down)`);
await drawAndShot('2-crushed-car');
const on2 = await p.evaluate(() => { const H = window.__H; const r = H.drive({ throttle: 0.6, brake: 0, steer: 0 }, 5, null); return { r, cst: H.cst(), tele: window.__D().drv.telemetry() }; });
console.log('  drives on:', JSON.stringify(on2.r));
check(on2.r.maxKmh > 18 && on2.r.moved > 40 && Math.abs(on2.tele.y) < 0.3, `the truck drives on afterwards (${on2.r.moved} m further at up to ${on2.r.maxKmh} km/h, back down on the road)`);
summary.push(`monster vs traffic car: squashed to ${crush2.car.scaleY}, ${crush2.cst.bails} people out, ${crush2.pol.wanted}★`);
await drawAndShot('3-drives-on');

// ================= 3 輾路邊的東西 =================
const prop3 = await p.evaluate(() => { const t = window.__D().drv.telemetry(); return window.__H.pickProp(t.x, t.z, 160); });
const crush3 = prop3 && !prop3.none ? await p.evaluate((c) => {
  const D = window.__D(), H = window.__H, a = c.a;
  window.__pol()?.clear();
  D.drv.teleport({ x: c.x - Math.cos(a) * 12, z: c.z + Math.sin(a) * 12, heading: a }); H.step(10);
  const r = H.drive({ throttle: 0.45, brake: 0, steer: 0 }, 6, 'window.__C().stats.props > 0');
  const r2 = H.drive({ throttle: 0.4, brake: 0, steer: 0 }, 2, null);
  return { r, r2, cst: H.cst(), pol: H.pol(), hurt: H.hurt() };
}, prop3) : { r: { bumps: 0 }, r2: { bumps: 0 }, cst: { props: 0, flats: 0, types: [] }, pol: { wanted: 0, types: [] } };
console.log('3', el(), 'roadside thing:', JSON.stringify(prop3), JSON.stringify(crush3));
check(!!prop3 && !prop3.none && crush3.cst.props >= 1 && crush3.cst.flats > 0, `the monster truck flattened a roadside thing (${prop3 && prop3.t} h ${prop3 && prop3.h}: ${crush3.cst.flats} vertices pressed down, types ${crush3.cst.types.join(',')})`);
check(crush3.pol.wanted >= 1 && crush3.pol.types.includes('crush'), `crushing a roadside thing on the village streets also gives a star (${crush3.pol.wanted}★)`);
check(crush3.r.bumps === 0 || crush3.r.bumps <= crush3.r2.bumps, 'the truck did not get stopped by it');
await drawAndShot('4-flat-prop');
summary.push(`roadside things: ${crush3.cst.props} crushed (${crush3.cst.types.join(',')})`);

// ================= 4 越野車場的表演場 =================
const show = await p.evaluate(() => window.__D().VIL.offroad.show);
console.log('4', el(), 'show arena:', JSON.stringify(show));
await p.evaluate((sh) => { const D = window.__D(), H = window.__H; D.drv.teleport({ x: sh.ramp[0] - 16, z: sh.cz, heading: 0 }); H.step(20); window.__pol()?.clear(); }, show);
let nJunk = 0;
for (let i = 0; i < 90 && nJunk < show.cars.length; i++) { await p.evaluate(() => window.__H.step(12)); nJunk = await p.evaluate(() => window.__C().junk.length); }
const junkInfo = await p.evaluate(() => { const C = window.__C(); return { n: C.junk.length, pads: C.pads.filter((q) => q.on && q.kind === 'junk').length, pos: C.junk.map((j) => [+j.x.toFixed(1), +j.z.toFixed(1)]), h: C.pads.filter((q) => q.on && q.kind === 'junk').map((q) => +q.h.toFixed(2)) }; });
console.log('  junk cars:', JSON.stringify(junkInfo));
check(junkInfo.n >= 4 && junkInfo.n === junkInfo.pads, `${junkInfo.n} junk cars stand in a row next to the ramp in the off-road park, each with a drive-over pad`);
await drawAndShot('5-junk-row');
const show4 = await p.evaluate(() => {
  const H = window.__H, D = window.__D();
  window.__pol()?.clear();
  const r = H.drive({ throttle: 0.4, brake: 0, steer: 0 }, 12, 'window.__C().stats.junk >= 3');
  const toast = document.querySelector('#stage .dv-toast');
  return { r, cst: H.cst(), pol: H.pol(), toast: toast ? toast.textContent : '', air: D.drv.telemetry().lands,
    sq: window.__C().pads.filter((q) => q.on && q.kind === 'junk').map((q) => +q.sq.toFixed(2)) };
});
console.log('  crushing the junk cars:', JSON.stringify(show4));
check(show4.cst.junk >= 3, `drove over the row and crushed ${show4.cst.junk} junk cars`);
check(show4.pol.wanted === 0, `crushing junk cars in the off-road park gives NO police star (${show4.pol.wanted}★)`);
check(/輾扁了/.test(show4.toast), `a small toast the first time (「${show4.toast}」)`);
await drawAndShot('6-junk-crushed');
// 回來（離開 → 再回來／等一下）
const back = await p.evaluate((sh) => {
  const D = window.__D(), H = window.__H;
  D.drv.teleport({ x: sh.cx - 60, z: sh.cz - 40, heading: 0 }); H.step(30);
  H.step(1200, 1 / 30); // 40 秒
  const C = window.__C();
  return { sq: C.pads.filter((q) => q.on && q.kind === 'junk').map((q) => +q.sq.toFixed(2)), scale: C.junk.map((j) => +j.lod.body.scale.y.toFixed(2)), cst: H.cst() };
}, show);
console.log('  after driving away:', JSON.stringify(back));
check(back.sq.every((q) => q === 0) && back.scale.every((q) => q === 1), 'the junk cars come back (all of them standing again) after a while / when you come back');
summary.push(`park: ${show4.cst.junk} junk cars crushed free of police, respawn ok`);

// ================= 5 輾扁的車在路邊留 20 秒 =================
const recyc = await p.evaluate(() => {
  const H = window.__H, N = window.__N();
  const w0 = N.traffic.wrecks.length, c0 = N.traffic.cars.length;
  H.step(900, 1 / 30); // 30 秒
  return { w0, c0, w1: N.traffic.wrecks.length, c1: N.traffic.cars.length, crushed: N.traffic.stats.crushed, cst: H.cst() };
});
console.log('5', el(), 'recycling:', JSON.stringify(recyc));
check(recyc.w1 === 0 && recyc.crushed >= 1, `the crushed traffic car is recycled back into the NPC pool after about 20 s (wrecks ${recyc.w0} → ${recyc.w1})`);
check(recyc.c1 >= 3, `the traffic flow is still healthy afterwards (${recyc.c1} cars around)`);
const perf = await p.evaluate(() => { const C = window.__C(), N = window.__N(); return { crush: { avg: +(C.stats.ms / Math.max(1, C.stats.frames)).toFixed(4), max: +C.stats.maxMs.toFixed(3), frames: C.stats.frames }, npc: { avg: +N.avg.toFixed(3), max: +N.max.toFixed(2) }, types: C.stats.types.slice(-12) }; });
console.log('  perf:', JSON.stringify(perf));
check(perf.crush.avg < 0.12, `crush.js update costs ${perf.crush.avg} ms per frame on average (max ${perf.crush.max} ms, the one-off vertex flatten is in there)`);
summary.push(`crush.js ${perf.crush.avg} ms/frame avg, max ${perf.crush.max} ms`);
await drawAndShot('7-park-after');

console.log('==== summary ====');
for (const s of summary) console.log(' -', s);
console.log('page errors:', errs.length);
check(errs.length === 0, 'no page errors');
await b.close(); srv.close();
console.log(fails.length ? `FAILED ${fails.length}:\n - ${fails.join('\n - ')}` : 'ALL OK');
process.exit(fails.length ? 1 : 0);
