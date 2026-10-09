// 第 7 批（輾扁）：怪獸卡車開上去把東西壓扁（art/garage.html 整頁跑一次）
// 第 9 批（路變大）：越野車什麼都輾（6）：房子、樹／路燈、警車（+2★，警察先跑掉）、內湖的大樓；人、車庫、店、警察局、捷運的橋墩不輾；路上的人撲開；離開一陣子長回來
//   7 路變寬（村子、內湖）、車流照跑、內湖左上角的路名；1 也多一個：GC8 撞房子只是撞到
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
    const down = N.peds.people.filter((q) => !q.gone && !q.dive && (q.mode === 'fall' || q.mode === 'lie' || q.mode === 'getup')).length; // 第 9 批：自己撲開的（dive）不算受傷
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
    const cands = cols.filter((c) => C.can(c) && (c.h ?? 9) <= 1.6 && Math.hypot(c.x - x, c.z - z) < r) // 第 9 批：小東西（越野車現在什麼都輾：房子另外測）.sort((a2, b2) => Math.hypot(a2.x - x, a2.z - z) - Math.hypot(b2.x - x, b2.z - z));
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
// 第 9 批：一般的車（GC8）撞房子：只是撞到（不會扁）
await p.evaluate(() => { const H = window.__H; H.step(1); });
await p.evaluate(() => {
  const H = window.__H;
  H.pickBig = (x, z, pred, r = 260, useCan = true) => { // useCan＝false：一般的車（不管輾不輾得到）
    const D = window.__D(), C = window.__C(), cols = D.VIL.colliders, tall = cols.filter((q) => (q.h ?? 9) >= 1.0 && Math.abs(q.x - x) < r + 60 && Math.abs(q.z - z) < r + 60);
    const clearAt = (px, pz, m, self) => {
      for (const q of tall) {
        if (q === self || q.crushed) continue;
        const cs = Math.cos(q.rot || 0), sn = Math.sin(q.rot || 0), dx = px - q.x, dz = pz - q.z;
        const d = q.t === 'box' ? Math.hypot(Math.max(0, Math.abs(dx * cs - dz * sn) - q.hx), Math.max(0, Math.abs(dx * sn + dz * cs) - q.hz)) : Math.hypot(dx, dz) - q.r;
        if (d < m) return false;
      }
      return true;
    };
    const cands = cols.filter((c) => !c.crushed && !c.noCrush && pred(c) && (!useCan || C.can(c)) && Math.hypot(c.x - x, c.z - z) < r).sort((a2, b2) => Math.hypot(a2.x - x, a2.z - z) - Math.hypot(b2.x - x, b2.z - z));
    for (const c of cands.slice(0, 80)) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, ux = Math.cos(a), uz = -Math.sin(a), e = c.t === 'box' ? Math.abs(ux * Math.cos(c.rot || 0) - uz * Math.sin(c.rot || 0)) * c.hx + Math.abs(ux * Math.sin(c.rot || 0) + uz * Math.cos(c.rot || 0)) * c.hz : c.r;
        let ok = true;
        for (const d of [2.5, 5, 8, 11, 14]) if (!clearAt(c.x - ux * (e + d), c.z - uz * (e + d), 2.3, c)) { ok = false; break; }
        if (!ok) continue;
        return { c, x: c.x, z: c.z, e: +e.toFixed(2), a: +a.toFixed(3), h: c.h, t: c.t, hx: c.hx, hz: c.hz, r: c.r, g: c.g ?? null, n: cands.length };
      }
    }
    return { none: true, n: cands.length };
  };
  H.ram = (c, km = 0.5, s = 4) => { // 從 e＋14 公尺外對著它直直開過去
    const D = window.__D(), a = c.a, d = c.e + 14;
    D.drv.teleport({ x: c.x - Math.cos(a) * d, z: c.z + Math.sin(a) * d, heading: a }); H.step(10);
    return H.drive({ throttle: km, brake: 0, steer: 0 }, s, null);
  };
  H.bigInfo = () => { const C = window.__C(); return C.big.map((j) => ({ phase: j.phase, n: j.grp.length, segs: j.segs.length, verts: j.segs.reduce((a, s) => a + s.idx.length, 0), k: +j.k.toFixed(3), rub: j.rub, top: j.top, bld: j.bld.length, inst: !!j.inst, chunks: j.chunks.length })); };
  H.segMaxY = (j) => { let m = 0; for (const s of j.segs) { const P = s.A.array; for (let i = 0; i < s.idx.length; i++) m = Math.max(m, P[s.idx[i] * 3 + 1] + s.ty); } return +m.toFixed(2); };
});
const gcHouse = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, C = window.__C();
  const q = H.pickBig(-262, -40, (c) => c.t === 'box' && (c.h ?? 9) >= 5 && c.hx >= 2.5 && c.hz >= 2.5 && c.hx < 10 && c.hz < 10 && c.g == null, 260, false); if (q.none) return null;
  const c = q.c; delete q.c; const big0 = C.stats.big;
  const r = H.ram(q, 0.5, 4);
  return { q, r, big: C.stats.big - big0, crushed: !!c.crushed, can: C.can(c) };
});
console.log('  GC8 into a house:', JSON.stringify(gcHouse));
check(!!gcHouse && gcHouse.big === 0 && !gcHouse.crushed && !gcHouse.can && (gcHouse.r.bumps > 0 || gcHouse.r.kmh < 12), `GC8 into a house: it just hits it (bumps ${gcHouse?.r?.bumps}), nothing flattened — normal cars cannot crush anything`);
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

console.log('6', el(), 'off-road truck crushes anything');
// 6a 房子（村子裡的透天厝）
const hs = await p.evaluate(() => { const D = window.__D(), H = window.__H; window.__pol()?.clear(); D.drv.teleport({ x: -262, z: 0, heading: 0 }); H.step(20); const r = H.pickBig(-262, -40, (c) => c.t === 'box' && (c.h ?? 9) >= 5 && c.hx >= 2.5 && c.hz >= 2.5 && c.hx < 10 && c.hz < 10 && c.g == null); delete r.c; return r; });
console.log('  house target:', JSON.stringify(hs));
const house = !hs.none ? await p.evaluate((q) => {
  const D = window.__D(), H = window.__H, C = window.__C();
  const c = D.VIL.colliders.find((k) => k.t === 'box' && k.x === q.x && k.z === q.z && !k.crushed);
  const b = D.VIL.buildings.find((k) => Math.abs(k.x - c.x) < Math.max(c.hx, c.hz) && Math.abs(k.z - c.z) < Math.max(c.hx, c.hz)) || null;
  const big0 = C.stats.big, n0 = window.__N().peds.stats.knocks;
  const r = H.ram({ ...q }, 0.55, 5);
  H.step(60);
  const j = C.big.find((k) => k.grp.includes(c));
  return { r, crushed: !!c.crushed, big: C.stats.big - big0, info: j ? H.bigInfo()[C.big.indexOf(j)] : null, maxY: j ? H.segMaxY(j) : null, door: b ? !!b.crushed : null, bname: b ? b.kind : null,
    pol: H.pol(), tele: D.drv.telemetry(), past: j ? +(((D.drv.telemetry().x - c.x) * Math.cos(q.a) - (D.drv.telemetry().z - c.z) * Math.sin(q.a))).toFixed(1) : null, knocks: window.__N().peds.stats.knocks - n0, ms: +C.stats.bigMs.toFixed(2) };
}, hs) : null;
console.log('  monster truck into a house:', JSON.stringify(house));
check(!!house && house.crushed && house.big >= 1 && house.info && house.info.phase === 2 && house.info.verts > 30, `the off-road truck flattened a village house (${house?.info?.verts} vertices of ${house?.info?.segs} meshes pressed down, ${house?.info?.n} colliders gone)`);
check(!!house && house.maxY !== null && house.maxY <= house.info.rub + 0.6, `the house is a low pile of rubble now (highest point ${house?.maxY} m, was ${house?.info?.top} m)`);
check(!!house && house.past > 0 && house.r.maxKmh > 15, `the truck drove straight through it and kept going (${house?.past} m past the middle, up to ${house?.r?.maxKmh} km/h)`);
check(!!house && house.pol.types.includes('crush') && house.pol.wanted >= 1 && house.pol.wanted <= 3, `crushing a house is a crime (${house?.pol?.wanted}★)`);
await drawAndShot('8-flat-house');
// 6b 樹、路燈（圓的、高的）
const tr = await p.evaluate(() => { const D = window.__D(), H = window.__H; const r = H.pickBig(-262, -40, (c) => c.t === 'circle' && (c.h ?? 9) >= 3.5); delete r.c; return r; });
const tree = !tr.none ? await p.evaluate((q) => {
  const D = window.__D(), H = window.__H, C = window.__C();
  const c = D.VIL.colliders.find((k) => k.t === 'circle' && k.x === q.x && k.z === q.z && !k.crushed);
  const r = H.ram({ ...q }, 0.5, 4); H.step(60);
  const j = C.big.find((k) => k.grp.includes(c));
  return { r, crushed: !!c.crushed, verts: j ? j.segs.reduce((a, s) => a + s.idx.length, 0) : 0, maxY: j ? H.segMaxY(j) : null, types: C.stats.types.slice(-4) };
}, tr) : null;
console.log('  tree / lamp:', JSON.stringify(tr), JSON.stringify(tree));
check(!!tree && tree.crushed && tree.verts > 6 && tree.maxY <= 1.2, `the truck flattened a ${tr.h} m tall ${tree?.types?.slice(-1)[0]} (${tree?.verts} vertices, now ${tree?.maxY} m high)`);
// 6c 警車：警察先下車（從另一邊）跑掉，車子扁掉，+2★
const cop = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, P = window.__pol(), C = window.__C(), N = window.__N();
  P.clear(); D.drv.teleport(D.VIL.places.garage.spawn); H.step(20);
  const t = D.drv.telemetry(); P.crime('punch', { x: t.x, z: t.z });
  let c = null; for (let i = 0; i < 60 * 40 && !c; i++) { H.step(1); c = P._dbg.cars.find((k) => k.on && k.mode !== 'home' && k.d < 120) || null; }
  if (!c) return { err: 'no police car came' };
  const w0 = P.wanted, k0 = N.peds.stats.knocks;
  const fx = Math.cos(c.th), fz = -Math.sin(c.th), x = c.x + fx * 13, z = c.z + fz * 13;
  D.drv.teleport({ x, z, heading: c.th + Math.PI }); H.step(2);
  const r = H.drive({ throttle: 0.7, brake: 0, steer: 0 }, 4, 'window.__C().stats.cops > 0');
  H.drive({ throttle: 0, brake: 1, steer: 0 }, 1.5, null);
  const f = c.officer, tel = P.telemetry();
  return { r, wreck: c.wreckT > 0, scaleY: +c.group.scale.y.toFixed(2), officer: f.on ? f.st : 'in', down: f.st === 'down' || f.st === 'getup', od: +Math.hypot(f.x - c.x, f.z - c.z).toFixed(1),
    w0, w1: P.wanted, crimes: tel.crimes.map((q) => q.type), cops: C.stats.cops, cols: P.colliders(c.x, c.z, 5).length, knocks: N.peds.stats.knocks - k0 };
});
console.log('  monster truck vs police car:', JSON.stringify(cop));
check(!!cop && cop.wreck && cop.cops === 1 && cop.scaleY <= 0.6 && cop.cols === 0, `the truck crushed a police car (squashed to ${cop?.scaleY}, no longer solid)`);
check(!!cop && cop.crimes.includes('crushCop') && cop.w1 === Math.min(3, cop.w0 + 2), `crushing a police car is a bigger crime: +2★ (${cop?.w0}★ → ${cop?.w1}★, max 3)`);
check(!!cop && cop.officer === 'flee' && !cop.down && cop.od > 2, `the officer jumped out the far side and ran off unharmed (${cop?.officer}, ${cop?.od} m from the wreck)`);
await drawAndShot('9-flat-police-car');
// 6d 不輾的地方：人、你的車庫、改車廠、車店、槍店、警察局、捷運的橋墩、賽道；一般的車也不會
const prot = await p.evaluate(() => {
  const D = window.__D(), C = window.__C(), V = D.VIL, P = V.places, N = window.__N();
  const inB = (b, c, m = 0) => { const cs = Math.cos(b.rot || 0), sn = Math.sin(b.rot || 0), dx = c.x - b.x, dz = c.z - b.z; return Math.abs(dx * cs - dz * sn) <= b.hx + m && Math.abs(dx * sn + dz * cs) <= b.hz + m; };
  const bOf = (k) => V.buildings.find((b) => b.kind === k && (k !== 'shop' || b.name === P.shop.name));
  const at = (b) => V.colliders.filter((c) => (c.h ?? 9) >= 2.5 && inB(b, c));
  const out = {};
  for (const [k, b] of [['garageZone', P.garage.inside], ['orbayZone', P.orbay.inside], ['odealer', P.odealer.zone]]) out[k] = { n: 1, can: C.can({ t: 'box', x: b.x, z: b.z, hx: 2, hz: 2, rot: 0, h: 6 }) ? 1 : 0 }; // 車庫裡面的東西是車庫模組的（不在 V.colliders）
  for (const [k, b] of [['garage', bOf('garage')], ['shop', bOf('shop')], ['dealer', bOf('dealer')], ['gunshop', bOf('gunshop')], ['police', bOf('police')], ['temple', bOf('temple')], ['orbay', { ...P.orbay.inside }]]) { const L = b ? at(b) : []; out[k] = { n: L.length, can: L.filter((c) => C.can(c)).length }; }
  const piers = V.colliders.filter((c) => c.noCrush && c.t === 'box' && (c.h ?? 0) > 6); out.mrt = { n: piers.length, can: piers.filter((c) => C.can(c)).length };
  const strip = V.colliders.filter((c) => c.circuit && (c.h ?? 9) > 1.6).slice(0, 50); // 賽車場（小的三角錐以前就輾得到：照舊） out.circuit = { n: strip.length, can: strip.filter((c) => C.can(c)).length };
  const peds = N.peds.colliders(); out.people = { n: peds.length, can: peds.filter((c) => C.can(c)).length };
  const offs = window.__pol().movers.filter((m) => m.t === 'circle'); out.officers = { n: offs.length, can: offs.filter((c) => C.can({ ...c, r: 0.3 })).length };
  return out;
});
console.log('  protected:', JSON.stringify(prot));
check(Object.entries(prot).every(([k, v]) => v.can === 0) && prot.shop.n > 0 && prot.police.n > 0 && prot.gunshop.n > 0 && prot.mrt.n > 0 && prot.people.n > 0,
  `never crushed: people, your garage, the off-road garage, the tuning shop, the dealer, the gun shop, the police station, the temple, the MRT piers, the race track (${Object.entries(prot).map(([k, v]) => k + ' ' + v.n).join(', ')})`);
const gsb = await p.evaluate(() => { // 槍店的正面：撞到（不會扁）
  const D = window.__D(), H = window.__H, C = window.__C(), b = D.VIL.places.gunshop.building, big0 = C.stats.big;
  window.__pol().clear();
  D.drv.teleport({ x: b.x, z: b.z - b.hz - 12, heading: -Math.PI / 2 }); H.step(10);
  const r = H.drive({ throttle: 0.5, brake: 0, steer: 0 }, 4, null);
  const t = D.drv.telemetry();
  return { r, big: C.stats.big - big0, z: +t.z.toFixed(1), front: +(b.z - b.hz).toFixed(1) };
});
console.log('  into the gun shop:', JSON.stringify(gsb));
check(gsb.big === 0 && gsb.z < gsb.front + 0.5, `driving into the gun shop: it just blocks the truck (stopped at z ${gsb.z}, front ${gsb.front}), nothing flattened`);
// 6e 路上的人：越野車衝過去 → 大叫、往旁邊撲倒、爬起來跑掉（大人、小孩都一樣；不會被輾、不會被撞）
const dive = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, N = window.__N(), C = window.__C(), P = window.__pol(), out = [];
  for (const kid of [false, true]) {
    P.clear();
    const x0 = -228, z0 = -3.3; D.drv.teleport({ x: x0, z: z0, heading: 0 }); H.step(30); // 村子的大路（超商前面往東，右邊的車道）
    const q = N.peds.people.find((k) => k.active && !k.gone && (kid ? k.age === 'kid' : k.age !== 'kid') && (k.mode === 'walk' || k.mode === 'idle' || k.mode === 'wait' || k.mode === 'return'));
    if (!q) { out.push({ kid, none: true }); continue; }
    if (q.seat && q.seat.by === q.id) q.seat.by = -1; q.seat = null; q.partner = null;
    q.x = x0 + 22; q.z = z0 + (kid ? -0.3 : 0.4); q.y = 0; q.mode = 'idle'; q.timer = 30; q.v = 0; q.rn = 0;
    const d0 = N.peds.stats.dives, k0 = N.peds.stats.knocks, ci = D.drv.carInfo, hz = ci.halfW;
    let under = 0, minLat = 9, saw = new Set(); const t0 = D.drv.telemetry(); D.drv.setInput({ throttle: 0.6, brake: 0, steer: 0 });
    for (let i = 0; i < 60 * 4; i++) {
      H.step(1); const t = D.drv.telemetry(), CX = (ci.nose + ci.tail) / 2, cx = t.x + Math.cos(t.heading) * CX, cz = t.z - Math.sin(t.heading) * CX;
      const dx = q.x - cx, dz = q.z - cz, lon = dx * Math.cos(t.heading) - dz * Math.sin(t.heading), lat = dx * Math.sin(t.heading) + dz * Math.cos(t.heading);
      if (Math.abs(lon) < ci.len / 2 - 0.3 && Math.abs(lat) < hz - 0.3) under++;
      if (Math.abs(lon) < ci.len / 2) minLat = Math.min(minLat, Math.abs(lat));
      saw.add(q.mode);
    }
    D.drv.setInput({ throttle: 0, brake: 1, steer: 0 });
    const tA = D.drv.telemetry();
    let stood = -1; for (let i = 0; i < 60 * 6; i++) { H.step(1); saw.add(q.mode); if (stood < 0 && q.mode !== 'fall' && q.mode !== 'lie' && q.mode !== 'getup' && saw.has('getup')) stood = +(i / 60).toFixed(1); }
    D.drv.setInput(null);
    out.push({ kid, age: q.age, dives: N.peds.stats.dives - d0, knocks: N.peds.stats.knocks - k0, under, minLat: +minLat.toFixed(2), hz, modes: [...saw], mode: q.mode, stood, passed: +(tA.x - (x0 + 22)).toFixed(1), crimes: P.telemetry().crimes.map((c) => c.type), gone: q.gone });
  }
  return out;
});
console.log('  pedestrian in the path:', JSON.stringify(dive));
for (const d of dive) {
  if (d.none) { console.log(`  (no ${d.kid ? 'child' : 'adult'} around to test)`); continue; }
  check(d.dives >= 1 && d.under === 0 && d.minLat >= d.hz && d.passed > 3 && d.knocks === 0 && !d.crimes.includes('hit'),
    `${d.kid ? 'a child' : 'a person'} in the truck's path shouted and dived aside (never under it: closest ${d.minLat} m from the middle, truck half width ${d.hz}; not knocked, no crime)`);
  check(d.stood >= 0 && !['fall', 'lie', 'getup'].includes(d.mode), `${d.kid ? 'the child' : 'the person'} got up again after ${d.stood} s and ran off (${d.modes.join('→')})`);
}
// 6f 內湖的大樓（好幾個盒子的那種）：整棟一起扁
const nh = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, C = window.__C(), V = D.VIL;
  window.__pol().clear();
  D.drv.teleport(V.places.neihu.spawn); H.step(60);
  const t = D.drv.telemetry(), q = H.pickBig(t.x, t.z, (c) => c.g != null && c.t === 'box' && (c.h ?? 0) >= 9 && V.colliders.filter((k) => k.g === c.g).length >= 2, 400);
  if (q.none) return { none: true, n: q.n };
  const g = q.c.g, grp = V.colliders.filter((k) => k.g === g); delete q.c;
  const r = H.ram(q, 0.6, 5); H.step(60);
  const j = C.big.find((k) => k.grp.some((c) => c.g === g));
  return { q, r, n: grp.length, crushed: grp.filter((k) => k.crushed).length, verts: j ? j.segs.reduce((a, s) => a + s.idx.length, 0) : 0, maxY: j ? H.segMaxY(j) : null, top: j ? j.top : null, ms: +C.stats.bigMs.toFixed(2), hit: +C.stats.hitMs.toFixed(2) };
});
console.log('  neihu building:', JSON.stringify(nh));
check(!nh.none && nh.crushed === nh.n && nh.verts > 50 && nh.maxY <= 1.5, `a ${nh.top} m building in 內湖 (${nh.n} collider boxes) went flat all at once (${nh.verts} vertices, now ${nh.maxY} m)`);
await drawAndShot('10-flat-neihu');
// 6g 長回來：離開 140 公尺以上 25 秒
const back9 = await p.evaluate((hq) => {
  const D = window.__D(), H = window.__H, C = window.__C(), V = D.VIL;
  const c = hq ? V.colliders.find((k) => k.t === 'box' && k.x === hq.x && k.z === hq.z) : null, n0 = C.big.length;
  D.drv.teleport(V.places.circuit.spawn); H.step(30); // 賽車場（離村子、越野車場、內湖都很遠）
  H.step(900, 1 / 30); // 30 秒
  return { n0, n1: C.big.length, crushed: c ? !!c.crushed : null, doors: V.buildings.filter((b) => b.crushed).length, restored: C.stats.restored, nhCrushed: V.colliders.filter((k) => k.g != null && k.crushed).length };
}, hs.none ? null : hs);
console.log('  after being away:', JSON.stringify(back9));
check(back9.n0 >= 2 && back9.n1 === 0 && back9.crushed === false && back9.doors === 0 && back9.nhCrushed === 0, `everything flattened came back after being away for a while (${back9.restored} things restored; the house blocks again, its door works again)`);
summary.push(`off-road truck: house ${house?.info?.verts} verts, ${tr.t} ${tree?.verts} verts, police car +${cop ? cop.w1 - cop.w0 : '?'}★, neihu ${nh.n} boxes; picking triangles max ${nh.ms} ms/frame, the hit itself max ${nh.hit} ms`);

// ================= 7 第 9 批（路變大）：路變寬（村子、內湖）、車流照跑、內湖左上角的路名 =================
const wide = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, N = V.neihu, H = window.__H, ws = {};
  for (const r of V.roads) if (r.kind === 'main' || r.kind === 'street' || r.kind === 'farm') (ws[r.kind] = ws[r.kind] || new Set()).add(Array.isArray(r.w) ? Math.max(...r.w) : r.w);
  const surf = [V.surfaceAt(-250, 6.2), V.surfaceAt(-250, -6.2), V.surfaceAt(-250, 7.4)];
  const nr = N.data.roads.find((r) => r.nm >= 0 && N.names[r.nm][0] === '內湖路一段'), ND = N.data.nodes;
  let k = 1, best = 0; for (let i = 1; i < nr.n.length; i++) { const l = Math.hypot(ND[nr.n[i] * 2] - ND[nr.n[i - 1] * 2], ND[nr.n[i] * 2 + 1] - ND[nr.n[i - 1] * 2 + 1]); if (l > best) { best = l; k = i; } }
  const a = nr.n[k - 1], b = nr.n[k], ax = ND[a * 2], az = ND[a * 2 + 1], bx = ND[b * 2], bz = ND[b * 2 + 1], l = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / l, uz = (bz - az) / l, mx = (ax + bx) / 2, mz = (az + bz) / 2;
  const off = nr.w * 0.42, px = mx - uz * off, pz = mz + ux * off;
  window.__pol().clear();
  D.drv.teleport({ x: mx - uz * nr.w * 0.25, z: mz + ux * nr.w * 0.25, heading: Math.atan2(-uz, ux) }); H.step(40);
  const e = document.querySelector('.nh-road');
  return { ws: Object.fromEntries(Object.entries(ws).map(([q, v]) => [q, [...v].sort((x, y) => x - y)])), surf, wide: N.data.wide, nw: nr.w, name: N.roadName(px, pz), off: +off.toFixed(1), hud: e && !e.hidden ? e.textContent : null };
});
console.log('7', el(), 'wider roads:', JSON.stringify(wide));
check(wide.ws.main.every((w) => w >= 13.5) && wide.ws.street.every((w) => w >= 10.5) && wide.ws.farm.every((w) => w >= 9) && wide.surf[0] === 0 && wide.surf[1] === 0,
  `village roads are 1.5× wider (main ${wide.ws.main.join('/')} m, streets ${wide.ws.street.join('/')} m, farm road ${wide.ws.farm.join('/')} m; 6.2 m from the middle of the main road is still road)`);
check(wide.wide === 1.5 && wide.nw >= 15 && wide.name === '內湖路一段', `內湖 roads are 1.5× wider too (內湖路一段 ${wide.nw} m; ${wide.off} m from its middle is still 「${wide.name}」)`);
check(wide.hud === '內湖路一段', `the road name still shows top left in 內湖 (「${wide.hud}」)`);
const traf = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, N = window.__N(), s0 = { ...N.traffic.stats };
  D.drv.teleport(D.VIL.places.garage.spawn); H.step(30); H.step(900, 1 / 30); // 村子裡 30 秒（停在車庫前面，不擋路）
  const cars = N.traffic.cars; return { n: cars.length, moving: cars.filter((c) => Math.abs(c.v) > 2).length, spawned: N.traffic.stats.spawned - s0.spawned, stuck: N.traffic.stats.stuckGone - s0.stuckGone };
});
console.log('  village traffic:', JSON.stringify(traf));
check(traf.n >= 4 && traf.moving >= 2, `traffic still runs on the wider village roads (${traf.n} cars around, ${traf.moving} moving, ${traf.stuck} stuck ones removed in 30 s)`);

console.log('==== summary ====');
for (const s of summary) console.log(' -', s);
console.log('page errors:', errs.length);
check(errs.length === 0, 'no page errors');
await b.close(); srv.close();
console.log(fails.length ? `FAILED ${fails.length}:\n - ${fails.join('\n - ')}` : 'ALL OK');
process.exit(fails.length ? 1 : 0);
