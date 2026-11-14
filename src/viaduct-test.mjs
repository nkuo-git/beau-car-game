// 圓環高架橋＋超大停車場（viaduct.js，第 91 批；Nick 2026-11-14「在原本的快速道路上搭建一個像這樣的圓環高架橋…高架橋中間下面要有一個超大停車場有很多車車一樣從車店挑」）
//   1 開局：路線多長、圓環、多高、橋下至少 6.5 公尺、坡度、橋墩、路燈；南邊那座山拿掉了、停車場的地是平的；三分之二的格子有車（便宜的多、超跑少）；橋下沒有房子
//   2 快速道路內圈的口：連到停車場的路上沒有東西擋；口外面的護欄照舊擋
//   3 GC8 從快速道路開進口、停車場、上圓環（1.5 圈到 24 公尺）、跨過快速道路、開到內湖最遠那頭下來：一直貼著橋面、沒有卡住、沒有撞到；在橋上：地上的車不擋、警察看不到
//   4 開在橋下（圓環下面、往內湖那段下面）：在地上、不會撞到橋面上的護欄
//   5 在橋上下車走路：人在橋面上、走到邊邊護欄擋住、跳一下還在橋上；上車開走
//   6 停車場走路：附近的車換成真的輕量車（最多 8 台）、遠的那台藏起來；走遠了換回去
//   7 晚上：橋上、停車場的路燈加進 look.js 的燈
//   8 截圖＋draw calls（停車場、圓環上面、跨過快速道路、內湖那頭、橋下）；VDV.at 多快
// node viaduct-test.mjs [prefix]（截圖 <prefix>-… .png）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = 'viaduct'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__THREE = THREE; window.__G = () => GAME; window.__S = () => S;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, trip, tripS, tripPose, cur, walker, TR, indoor, TOWER_RAMP, VDV, VDL, PW, LOOK, NPC: NPC || window.__npcKeep, HILL_LIST }); window.__polP = () => polPlayer({}); window.__P = () => PERF;'
  + ' window.__strip = () => stripColliders(); window.__leave = () => leaveCar(); window.__pol = () => (typeof police !== "undefined" ? police : null);'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } else if (window.__npcKeep) { NPC = window.__npcKeep; window.__npcKeep = null; NPC.g.visible = DRIVE.on; } };'
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
async function drawAndShot(name) { // 畫兩格再截圖（停住的時候畫的是現在的樣子）
  const n0 = await p.evaluate(() => { window.__noDraw = false; return window.__dframes || 0; });
  await p.waitForFunction((n) => (window.__dframes || 0) >= n + 2, n0, { timeout: 300000 });
  await p.evaluate(() => { window.__noDraw = true; });
  await p.screenshot({ path: `${prefix}-${name}.png` });
  const ri = await p.evaluate(() => window.__rinfo());
  console.log('  shot', `${prefix}-${name}.png`, JSON.stringify(ri), el());
  return ri;
}
await p.addInitScript(() => {
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 1000, owned: ['gc8'], parts: {}, tyres: {}, wins: {}, cars: {} }));
  }
});
// 小幫手：上車、照著一條線開、放到某個地方、量離地多高（隧道那段：玩家在上面那層＝山的地面）
await p.addInitScript(() => {
  const H = {};
  window.__H = H;
  H.step = (n, dt = 1 / 60) => { const D = window.__D(); for (let i = 0; i < n && D.on; i++) window.__dstep(1, dt); };
  const vis = (e) => !!e && !e.hidden && !e.closest('[hidden]') && e.getClientRects().length > 0;
  const act = () => [...document.querySelectorAll('#stage .wk-act, #stage .dv-act')].find(vis);
  H.actText = () => { const e = act(); return e ? e.querySelector('span').textContent : null; };
  H.boardCar = () => {
    const D = window.__D(), W = D.walker, q = D.tripPose[D.cur];
    if (!q) return { err: 'no pose' };
    const c = Math.cos(q.heading), s = Math.sin(q.heading);
    let a = null;
    for (const d of [2.0, 2.6, 1.5, 3.2]) {
      for (const sd of [1, -1]) {
        W.teleport({ x: q.x + s * d * sd, z: q.z + c * d * sd, heading: q.heading + sd * Math.PI / 2 });
        H.step(12);
        a = H.actText();
        if (a && a.indexOf('上車') === 0) break;
        a = null;
      }
      if (a) break;
    }
    H.step(30);
    W.getIn();
    for (let i = 0; i < 900 && W.mode !== 'off'; i++) H.step(1);
    H.step(30);
    return { act: a, mode: W.mode, cur: window.__D().cur, drv: !!window.__D().drv };
  };
  H.groundAt = (x, z) => { const V = window.__D().VIL, Hl = V.hills; return Hl.high && Hl.tunAt(x, z) >= 0 ? Hl.topAt(x, z) : V.heightAt(x, z); };
  H.put = (x, z, heading, n = 40) => { const D = window.__D(); D.drv.teleport({ x, z, heading }); window.__pol()?.clear(); H.step(n); return D.drv.telemetry(); };
  // 一條線上離所有會擋的東西多遠（村子、賽道、樹、隧道的牆；沒開的不算）
  H.cols = () => { const D = window.__D(), V = D.VIL; return [...V.colliders, ...window.__strip(), ...(D.TR.trees || []), ...V.hills.layerCols].filter((c) => !c.off && !c.crushed); };
  H.clear = (ax, az, bx, bz, cols) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L)); let m = Infinity;
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
      for (const c of cols) {
        const dx = x - c.x, dz = z - c.z; let d;
        if (c.t === 'box') { const r = c.rot || 0, u = dx * Math.cos(r) - dz * Math.sin(r), w = dx * Math.sin(r) + dz * Math.cos(r); d = Math.hypot(Math.max(0, Math.abs(u) - c.hx), Math.max(0, Math.abs(w) - c.hz)); }
        else d = Math.hypot(dx, dz) - (c.r || 0);
        if (d < m) m = d;
      }
    }
    return m;
  };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // pts：[[x, z]…]；開 secs 秒或開到最後一點（o.until(t) 提早停）；量離地多高（不在空中的時候）、在空中多久、卡住幾次、撞到幾次
  H.follow = (pts, secs, o = {}) => {
    const D = window.__D(), d = D.drv, V = D.VIL, N = pts.length, t0 = d.telemetry();
    const r = { s: 0, maxKmh: 0, maxDY: 0, airT: 0, bumps0: t0.bumps, stuck: 0, end: false, maxY: -99, minY: 99, airAt: [] };
    let i0 = 0, lx = t0.x, lz = t0.z, lt = 0;
    for (let n = 0; n < secs * 60; n++) {
      const t = d.telemetry();
      if (o.until && o.until(t)) { r.until = true; break; }
      let bi = i0, bd = Infinity;
      for (let k = i0; k < Math.min(N, i0 + 80); k++) { const e = (pts[k][0] - t.x) ** 2 + (pts[k][1] - t.z) ** 2; if (e < bd) { bd = e; bi = k; } }
      i0 = bi;
      if (i0 >= N - 2 && !o.until) { r.end = true; break; }
      const la = 5 + 0.45 * Math.abs(t.v); let acc = 0, k = i0;
      while (k < N - 1 && acc < la) { acc += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]); k++; }
      const a = wrap(Math.atan2(-(pts[k][1] - t.z), pts[k][0] - t.x) - t.heading);
      const steer = Math.max(-1, Math.min(1, -2.6 * a)), vmax = o.vmax || 20;
      let thr = 1, brk = 0;
      if (t.v > vmax + 1) { thr = 0; brk = 1; } else if (t.v > vmax - 1) thr = 0.35;
      d.setInput({ throttle: thr, brake: brk, steer }); H.step(1);
      const q = d.telemetry();
      r.maxKmh = Math.max(r.maxKmh, q.kmh); if (q.air) { r.airT += 1 / 60; if (r.airAt.length < 6 && (!r.airAt.length || r.s - r.airAt[r.airAt.length - 1][0] > 0.5)) r.airAt.push([+r.s.toFixed(1), Math.round(q.x), Math.round(q.z), +D.tripS.car.position.y.toFixed(1), +H.groundAt(q.x, q.z).toFixed(1)]); }
      const y = D.tripS.car.position.y, Hl = V.hills, terr = (Hl.high && Hl.tunAt(q.x, q.z) >= 0) || V.terrainAt(q.x, q.z); // 車子在哪個高度（平的路上 telemetry 的 y 不會更新）
      r.maxY = Math.max(r.maxY, y); r.minY = Math.min(r.minY, y); if (!q.air && terr) { const dy = Math.abs(y - H.groundAt(q.x, q.z)); if (dy > r.maxDY) { r.maxDY = dy; r.dyAt = [Math.round(q.x), Math.round(q.z), +y.toFixed(2), +H.groundAt(q.x, q.z).toFixed(2), Hl.high, Hl.tunAt(q.x, q.z)]; } }
      if (o.each) o.each(q);
      r.s += 1 / 60;
      if (r.s - lt > 4) { if (Math.hypot(q.x - lx, q.z - lz) < 2) r.stuck++; lt = r.s; lx = q.x; lz = q.z; }
    }
    d.setInput(null);
    const q = d.telemetry();
    Object.assign(r, { s: +r.s.toFixed(1), x: +q.x.toFixed(1), z: +q.z.toFixed(1), y: +D.tripS.car.position.y.toFixed(2), kmh: Math.round(q.kmh), bumps: q.bumps - r.bumps0, maxKmh: Math.round(r.maxKmh), maxDY: +r.maxDY.toFixed(2), airT: +r.airT.toFixed(2), maxY: +r.maxY.toFixed(2), minY: +r.minY.toFixed(2) });
    delete r.bumps0;
    return r;
  };
  // 快速道路的一條車道（中線往外 off 公尺），z 在 z0…z1 那段（西邊那條直線＋兩頭的彎）
  H.hwyLane = (z0, z1, off) => {
    const r = window.__D().VIL.roads.find((q) => q.kind === 'highway'), P = r.pts, out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1]; if (ax > -900 || az < z0 || az > z1) continue;
      const L = Math.hypot(bx - ax, bz - az) || 1; let nx = (bz - az) / L, nz = -(bx - ax) / L; if (nx > 0) { nx = -nx; nz = -nz; } // 往西（外面）
      out.push([ax + nx * off, az + nz * off]);
    }
    return out[0][1] < out[out.length - 1][1] ? out : out.reverse(); // 往南開
  };
  H.lane = (T, s0, s1, off, step = 2) => { const P = [], f = {}; for (let s = s0; s <= s1 + 1e-6; s += step) { T.frame(s, f); P.push([f.x - f.tz * off, f.z + f.tx * off]); } return P; }; // 第 85 批：沿著隧道（直的、彎的）第 s0…s1 公尺，往前開的右手邊 off 公尺
  H.line = (ax, az, bx, bz, step = 2) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / step)), P = []; for (let k = 0; k <= n; k++) P.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]); return P; };
  H.stop = () => { const d = window.__D().drv; d.setInput({ throttle: 0, brake: 1, steer: 0 }); for (let i = 0; i < 400 && Math.abs(d.telemetry().v) > 0.05; i++) H.step(1); d.setInput(null); H.step(20); return d.telemetry(); };
});

// 第 91 批的小幫手：沿著高架橋（s0…s1，右手邊 u 公尺）的點、某個 s 的位置
await p.addInitScript(() => {
  const H = window.__H;
  H.deck = (s0, s1, u, step = 4) => { const P = window.__D().VDV.path, out = []; for (let s = s0; s <= s1 + 1e-6; s += step) { const i = Math.min(P.n - 1, Math.round(s / 2)); out.push([P.X[i] - P.TZ[i] * u, P.Z[i] + P.TX[i] * u]); } return out; };
  H.at = (s, u = 0) => { const D = window.__D(), V = D.VDV, P = V.path, i = Math.min(P.n - 1, Math.round(s / 2)); return { x: P.X[i] - P.TZ[i] * u, z: P.Z[i] + P.TX[i] * u, y: V.Y[i], h: Math.atan2(-P.TZ[i], P.TX[i]), i }; };
  H.putDeck = (s, u = 2, n = 60) => { const q = H.at(s, u), D = window.__D(); D.VDV.st.py = q.y; D.VDV.st.px = q.x; D.VDV.st.pz = q.z; return H.put(q.x, q.z, q.h, n); }; // 放到橋上（先跟 PW 說玩家在那一層）
  H.deckY = (x, z, y) => window.__D().VDV.at(x, z, y);
});

// ================= 1 開局 =================
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
await p.waitForFunction(() => !!window.__S() && !window.__D().trip, null, { timeout: 300000 }); await p.waitForTimeout(2500);
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.waitForFunction(() => window.__D().tripPose && window.__D().tripPose[window.__D().cur], null, { timeout: 120000 });
const bd1 = await p.evaluate(() => window.__H.boardCar());
check(bd1.mode === 'off' && bd1.drv && bd1.cur === 'gc8', `got into the GC8 (${bd1.act})`);
const s1 = await p.evaluate(() => {
  const D = window.__D(), V = D.VDV, VIL = D.VIL; if (!V) return { err: 'no VDV' };
  const I = V.info, P = V.path, Y = V.Y;
  let maxG = 0, gAt = 0; for (let i = 20; i < P.n - 20; i++) { const g = Math.abs(Y[i + 1] - Y[i]) / 2; if (g > maxG) { maxG = g; gAt = Math.round(P.S[i]); } }
  const lotH = []; for (const [dx, dz] of [[0, 0], [60, 0], [-60, 0], [0, 60], [0, -60], [45, 70], [-45, -70], [0, 120], [0, 200]]) lotH.push(+VIL.heightAt(-780 + dx, 250 + dz).toFixed(3));
  const lotS = VIL.surfaceAt(-760, 250), connS = VIL.surfaceAt(-780, 420);
  const hill = D.HILL_LIST.some((h) => h.x === -805 && h.z === 185), nHill = D.HILL_LIST.length;
  const cars = V.lot.cars, kinds = {}; for (const c of cars) kinds[c.k] = (kinds[c.k] || 0) + 1;
  const PERF = window.__P(); let cheap = 0, sup = 0; for (const c of cars) { const pr = PERF[c.k].price; if (pr <= 100) cheap++; if (pr >= 1000) sup++; }
  // 橋下的房子：橋面邊上 2 公尺內、比橋面下面高的（村子、內湖）
  let under = 0, ex = null; for (const b of VIL.buildings || []) { if (!isFinite(b.x)) continue; for (const [dx, dz] of [[0, 0], [b.hx || 0, 0], [-(b.hx || 0), 0], [0, b.hz || 0], [0, -(b.hz || 0)]]) { const x = b.x + dx, z = b.z + dz; if (!V.near(x, z, 0)) continue; let lo = 1e9; for (let i = 0; i < P.n; i += 1) { const d = Math.hypot(P.X[i] - x, P.Z[i] - z); if (d < 8.5) lo = Math.min(lo, Y[i] - 1.1); } if ((b.h || 3) + VIL.heightAt(x, z) > lo - 0.5) { under++; ex = ex || [b.kind, Math.round(x), Math.round(z), b.h]; } break; } }
  const meshes = []; V.group.traverse((o) => { if (o.isMesh) meshes.push(o.name); });
  return { I, maxG: +maxG.toFixed(3), gAt, lotH, lotS, connS, hill, nHill, cheap, sup, nCars: cars.length, kinds, under, ex, meshes: meshes.length, lampsX: (VIL.lampsX || []).length / 3, vdGone: VIL.neihu?.info?.vdGone ?? null };
});
console.log('1', el(), JSON.stringify(s1));
check(!s1.err, 'the viaduct is built (VDV)');
check(s1.I.len > 4500 && s1.I.len < 5600 && Math.abs(s1.I.helix - 990) < 15, `the route is ${s1.I.len} m long, the roundabout ${s1.I.helix} m (1.5 turns)`);
check(s1.I.yMax >= 24 && s1.I.yMax < 40 && s1.I.minClear[0] >= 6.45, `24 m high (highest ${s1.I.yMax} m); at least ${s1.I.minClear[0]} m under the deck (s ${s1.I.minClear[1]})`);
check(s1.maxG < 0.06, `never steeper than 6% (steepest ${(s1.maxG * 100).toFixed(1)}% at s ${s1.gAt})`);
check(s1.I.piers >= 80 && s1.I.cols >= 20 && s1.I.lamps >= 100, `${s1.I.piers} piers (${s1.I.pierSkip} spots skipped: road, house, tunnel), ${s1.I.cols} roundabout columns, ${s1.I.lamps} lamps`);
check(s1.hill === false && s1.nHill === 23, `the hill inside the south half of the freeway loop is gone (${s1.nHill} hills)`);
check(s1.lotH.every((h) => Math.abs(h) < 0.06), `the parking lot ground is flat (${s1.lotH.join(', ')})`);
check(s1.lotS === 0 && s1.connS === 0, 'parking lot and the road to it are asphalt');
check(s1.I.lotSpots >= 800 && s1.nCars / s1.I.lotSpots > 0.55 && s1.nCars / s1.I.lotSpots < 0.77, `${s1.nCars} cars in ${s1.I.lotSpots} bays`);
check(s1.sup < s1.nCars * 0.04 && s1.cheap > s1.nCars * 0.5, `dealer cars, cheap ones common (${s1.cheap} up to 100 萬), supercars rare (${s1.sup}); ${JSON.stringify(s1.kinds)}`);
check(s1.under === 0, `no house under the deck (${s1.under}${s1.ex ? ' ' + JSON.stringify(s1.ex) : ''})`);
check(s1.lampsX >= s1.I.lamps, `the deck and lot lamps are in the world's lamp list (${s1.lampsX})`);

// ================= 2 快速道路內圈的口 =================
const s2 = await p.evaluate(() => {
  const D = window.__D(), V = D.VDV, H = window.__H, st = V.st, keep = { ...st };
  Object.assign(st, { py: 0, on: false, high: false, px: -780, pz: 400 }); // 當作玩家在地上
  const cols = [...H.cols(), ...V.cols.filter((c) => !c.off)];
  const conn = H.clear(-778, 470, -778, 160, cols), conn2 = H.clear(-782, 470, -782, 160, cols);
  const R = 250 - 12.6, a = 26 / 250, railE = H.clear(-780 + R * Math.sin(a), 225 + R * Math.cos(a), -780 + R * Math.sin(a) + 0.01, 225 + R * Math.cos(a), cols), railW = H.clear(-780 - R * Math.sin(a), 225 + R * Math.cos(a), -780 - R * Math.sin(a) + 0.01, 225 + R * Math.cos(a), cols), gap = H.clear(-780, 225 + R, -779.99, 225 + R, cols);
  Object.assign(st, keep);
  return { conn: +conn.toFixed(2), conn2: +conn2.toFixed(2), railE: +railE.toFixed(2), railW: +railW.toFixed(2), gap: +gap.toFixed(2) };
});
console.log('2', el(), JSON.stringify(s2));
check(s2.gap > 3 && s2.conn > 0.8 && s2.conn2 > 0.8, `the inner freeway rail has an opening and nothing blocks the road to the lot (opening ${s2.gap} m, road ${s2.conn} / ${s2.conn2} m clear)`);
check(s2.railE < 0.05 && s2.railW < 0.05, `the rail is still there on both sides of the opening (${s2.railE}, ${s2.railW})`);

// ================= 3 開一趟：快速道路 → 口 → 停車場 → 圓環 → 往內湖 → 下來 =================
const s3 = await p.evaluate(() => {
  const D = window.__D(), V = D.VDV, P = V.path, H = window.__H, d = D.drv;
  window.__pol()?.clear();
  const pts = [];
  for (let th = 0.3; th > 0.02; th -= 0.01) pts.push([-780 + 243.1 * Math.sin(th), 225 + 243.1 * Math.cos(th)]); // 快速道路內圈的車道（往西）
  for (let z = 452; z >= 172; z -= 4) pts.push([-777.6, z]); // 往北：連到停車場的路、停車場中間的走道
  for (let k = 1; k <= 12; k++) { const a = (k / 12) * (Math.PI / 2); pts.push([-777.6 - 16 + 16 * Math.cos(a), 168 - 16 * Math.sin(a) - 4 * (k / 12)]); } // 左轉上圓環的起點
  for (const q of H.deck(20, P.L - 2, 2)) pts.push(q);
  { const i = P.n - 1; for (let k = 4; k <= 60; k += 4) pts.push([P.X[i] + P.TX[i] * k - P.TZ[i] * 2, P.Z[i] + P.TZ[i] * k + P.TX[i] * 2]); } // 下來以後在內湖的路上再開一段
  const t0 = Math.atan2(-(pts[1][1] - pts[0][1]), pts[1][0] - pts[0][0]);
  H.put(pts[0][0], pts[0][1], t0, 60);
  const r = { off: 0, maxDY: 0, hi: 0, hiPol: 0, maxY: 0, dyAt: null, sMax: 0, bumpAt: [], offAt: [] }; let nb = d.telemetry().bumps;
  const res = H.follow(pts, 520, { vmax: 22, each: (q) => {
    const y = D.tripS.car.position.y, st = V.st, Q = V.Q, yd = V.at(q.x, q.z, y);
    if (yd != null) { const dy = Math.abs(y - yd); if (dy > r.maxDY && !q.air) { r.maxDY = dy; r.dyAt = [Math.round(q.x), Math.round(q.z), +y.toFixed(2), +yd.toFixed(2), Math.round(Q.s)]; } r.sMax = Math.max(r.sMax, Q.s); }
    else if (r.sMax > 40 && r.sMax < P.L - 30) { r.off++; if (r.offAt.length < 4) r.offAt.push([Math.round(q.x), Math.round(q.z), +y.toFixed(1), Math.round(r.sMax)]); }
    r.maxY = Math.max(r.maxY, y);
    if (q.bumps > nb) { nb = q.bumps; if (r.bumpAt.length < 8) { const near = D.drv.colsNear ? D.drv.colsNear(q.x, q.z, 4).map((c) => `${c.tag}:${c.t}:${c.name || ''}:${c.h != null ? (+c.h).toFixed(1) : ''}`).slice(0, 5) : []; r.bumpAt.push([Math.round(q.x), Math.round(q.z), +y.toFixed(1), Math.round(V.Q.s), near]); } }
    if (st.high) { r.hi++; if (window.__polP().hidden) r.hiPol++; }
  } });
  const t = d.telemetry(), y = D.tripS.car.position.y, g = D.VIL.heightAt(t.x, t.z);
  return { ...res, ...r, maxDY: +r.maxDY.toFixed(3), maxY: +r.maxY.toFixed(2), sMax: Math.round(r.sMax), L: Math.round(P.L), endY: +y.toFixed(2), endG: +g.toFixed(2), on: V.st.on, n: pts.length };
});
console.log('3', el(), JSON.stringify(s3));
if (process.env.VD_STOP === '3') { await b.close(); srv.close(); console.log(fails.length ? `FAILED ${fails.length}` : 'ok so far'); process.exit(0); }
check(s3.end && s3.stuck === 0, `drove the whole way (freeway → opening → lot → roundabout → to Neihu → down) without getting stuck (${s3.s} s, top ${s3.maxKmh} km/h)`);
check(s3.sMax > s3.L - 30 && s3.off === 0, `stayed on the deck from the start to the end (reached s ${s3.sMax} of ${s3.L}; ${s3.off} frames off it)`);
check(s3.maxDY < 0.25, `the car sits on the deck surface all the way (max ${s3.maxDY} m${s3.dyAt ? ' at ' + JSON.stringify(s3.dyAt) : ''})`);
check(s3.maxY > 23.5, `went up to ${s3.maxY} m`);
check(s3.bumps <= 1, `hit nothing on the way (${s3.bumps} bumps)`);
check(s3.hi > 600 && s3.hiPol === s3.hi, `up on the deck the police on the ground can't see you (${s3.hiPol}/${s3.hi} frames hidden)`);
check(!s3.on && Math.abs(s3.endY - s3.endG) < 0.2, `back on the Neihu road at the end (y ${s3.endY}, ground ${s3.endG})`);

// ================= 4 開在橋下：連到停車場的路（圓環下面兩層）、快速道路外圈（往內湖那段下面）=================
await p.evaluate(() => window.__npcPause(true)); // 車流先停（只看橋）
const s4 = await p.evaluate(() => {
  const D = window.__D(), V = D.VDV, H = window.__H, out = {};
  const run = (pts, secs) => {
    V.st.py = 0; window.__pol()?.clear();
    const t0 = Math.atan2(-(pts[1][1] - pts[0][1]), pts[1][0] - pts[0][0]); H.put(pts[0][0], pts[0][1], t0, 60);
    const r = { under: 0, on: 0, maxUp: 0 };
    const res = H.follow(pts, 120, { vmax: 18, each: (q) => {
      const y = D.tripS.car.position.y, g = D.PW.groundAt(q.x, q.z); r.maxUp = Math.max(r.maxUp, y - g);
      if (V.near(q.x, q.z, 0)) r.under++;
      if (V.st.on) r.on++;
    } });
    return { ...res, ...r, maxUp: +r.maxUp.toFixed(3) };
  };
  const conn = []; for (let z = 462; z >= 300; z -= 4) conn.push([-777.6, z]);
  out.conn = run(conn, 120);
  const fw = []; for (let th = 0.78; th <= 1.4; th += 0.01) fw.push([-780 + 256.9 * Math.sin(th), 225 + 256.9 * Math.cos(th)]); // 快速道路外圈的車道（往東北）
  out.fw = run(fw, 120);
  return out;
});
console.log('4', el(), JSON.stringify(s4));
for (const [k, w] of [['conn', 'the road to the lot, under the two roundabout layers'], ['fw', 'the freeway outer lane, under the deck to Neihu']]) {
  const q = s4[k];
  check(q.end && q.stuck === 0 && q.bumps === 0 && q.under > 20 && q.on === 0 && q.maxUp < 0.2, `drove ${w}: stayed on the ground (${q.under} frames under the deck, at most ${q.maxUp} m above the ground, never on it), hit nothing (${q.bumps}), ${q.s} s`);
}

// ================= 5 在橋上下車走路 =================
const s5a = await p.evaluate(() => {
  const D = window.__D(), V = D.VDV, H = window.__H, s = V.path.sH + 260, q = H.at(s, 2);
  H.putDeck(s, 2, 90); H.stop();
  const t = D.drv.telemetry(), cy = D.tripS.car.position.y;
  window.__leave(); for (let i = 0; i < 600 && !(D.walker && D.walker.mode === 'walk'); i++) H.step(1); H.step(60);
  const g = D.walker.character.group.position;
  return { s: Math.round(s), deckY: +q.y.toFixed(2), carY: +cy.toFixed(2), mode: D.walker.mode, wy: +g.y.toFixed(2), on: V.st.on, high: V.st.high, pol: window.__polP().hidden, ground: +D.PW.groundAt(g.x, g.z).toFixed(2) };
});
console.log('5a', el(), JSON.stringify(s5a));
check(s5a.mode === 'walk' && Math.abs(s5a.wy - s5a.deckY) < 0.15 && s5a.on && s5a.high, `got out on the deck (s ${s5a.s}): standing on it at ${s5a.wy} m (deck ${s5a.deckY}, ground ${s5a.ground})`);
check(s5a.pol === true, 'walking up on the deck: the police on the ground can\'t see you');
// 走到右邊的護欄：一直往外推 3 秒
const s5b = await p.evaluate(() => {
  const D = window.__D(), V = D.VDV, H = window.__H, W = D.walker, P = V.path;
  const q = H.at(P.sH + 280, 3), i = q.i, hOut = Math.atan2(-P.TX[i], -P.TZ[i]);
  W.teleport({ x: q.x, z: q.z, heading: hOut }); H.step(60);
  const g = W.character.group.position; let uMax = -9, yMin = 99;
  W.setInput({ x: 0, y: 1 });
  for (let k = 0; k < 200; k++) { H.step(1); V.at(g.x, g.z, g.y); if (V.Q.u > uMax) uMax = V.Q.u; yMin = Math.min(yMin, g.y); }
  W.setInput(null); H.step(20);
  V.at(g.x, g.z, g.y); const u = V.Q.u;
  // 跳一下（還在橋上）
  const y0 = g.y, j = W.jump(); let top = y0; for (let k = 0; k < 80; k++) { H.step(1); top = Math.max(top, g.y); } H.step(30);
  return { uMax: +uMax.toFixed(2), u: +u.toFixed(2), yMin: +yMin.toFixed(2), deckY: +q.y.toFixed(2), jumped: j, top: +(top - y0).toFixed(2), y1: +g.y.toFixed(2), on: V.st.on, mode: W.mode };
});
console.log('5b', el(), JSON.stringify(s5b));
check(s5b.uMax < 7.6 && s5b.yMin > s5b.deckY - 0.2, `walking into the side barrier: it stops you (got to ${s5b.uMax} m from the middle; the barrier is at 7.5–8), never fell off (lowest ${s5b.yMin} m)`);
check(s5b.jumped && s5b.top > 0.4 && Math.abs(s5b.y1 - s5b.deckY) < 0.15 && s5b.on, `jumped next to the barrier (up ${s5b.top} m) and landed back on the deck (${s5b.y1} m)`);
const bd5 = await p.evaluate(() => window.__H.boardCar());
const s5c = await p.evaluate(() => {
  const D = window.__D(), V = D.VDV, H = window.__H, s = V.path.sH + 262;
  const r = H.follow(H.deck(s, s + 120, 2), 40, { vmax: 14 });
  return { ...r, on: V.st.on };
});
console.log('5c', el(), JSON.stringify(bd5), JSON.stringify(s5c));
check(bd5.mode === 'off' && bd5.drv && s5c.end && s5c.on && s5c.bumps === 0, `got back in on the deck and drove on (${s5c.s} s, still on the deck, ${s5c.bumps} bumps)`);

// ================= 6 停車場走路：附近的車換成真的輕量車 =================
const s6a = await p.evaluate(() => {
  const D = window.__D(), V = D.VDV, H = window.__H;
  V.st.py = 0; H.put(-777.6, 300, Math.PI / 2, 60); H.stop();
  window.__leave(); for (let i = 0; i < 600 && !(D.walker && D.walker.mode === 'walk'); i++) H.step(1);
  D.walker.teleport({ x: -776.5, z: 250, heading: Math.PI / 2 }); H.step(30);
  return { mode: D.walker.mode, live: D.VDL.live.size };
});
let s6 = null;
for (let k = 0; k < 120; k++) {
  s6 = await p.evaluate(() => { window.__H.step(20); const D = window.__D(); return { live: D.VDL.live.size, built: D.VDL.built, busy: D.VDL.busy }; });
  if (s6.live >= 8) break;
  await p.waitForTimeout(250);
}
const s6b = await p.evaluate(() => {
  const D = window.__D(), V = D.VDV, IB = V.lot.meshes[0], M = new (window.__THREE.Matrix4)(), g = D.walker.character.group.position;
  const L = [...D.VDL.live].map(([c, e]) => { IB.getMatrixAt(c.inst, M); return { k: c.k, d: +Math.hypot(c.x - g.x, c.z - g.z).toFixed(1), hid: M.elements[0] === 0, vis: e.l.car.visible && !!e.l.car.parent, at: Math.hypot(e.l.car.position.x - c.x, e.l.car.position.z - c.z) < 0.01 }; });
  // 停著的車擋人：往最近那台走
  const c0 = V.lot.cars.reduce((a, c) => (Math.hypot(c.x - g.x, c.z - g.z) < Math.hypot(a.x - g.x, a.z - g.z) ? c : a));
  return { L, wy: +g.y.toFixed(2), cols: V.lot.cols.length, cars: V.lot.cars.length, c0: { x: c0.x, z: c0.z, k: c0.k } };
});
console.log('6', el(), JSON.stringify(s6), JSON.stringify(s6b).slice(0, 900));
check(s6b.L.length >= 1 && s6b.L.length <= 8 && s6b.L.every((q) => q.d < 27 && q.hid && q.vis && q.at), `walking in the lot: the ${s6b.L.length} nearest cars became real cars (${[...new Set(s6b.L.map((q) => q.k))].join(', ')}; ${s6.built} built), each within 26 m, the far copy hidden`);
check(s6b.cols === s6b.cars && Math.abs(s6b.wy) < 0.1, `every parked car blocks (${s6b.cols} colliders), walking on the lot ground (${s6b.wy} m)`);
const s6c = await p.evaluate(() => {
  const D = window.__D(), H = window.__H; D.walker.teleport({ x: -777.6, z: 455, heading: Math.PI / 2 }); H.step(30);
  return { mode: D.walker.mode };
});
let s6d = null;
for (let k = 0; k < 20; k++) { s6d = await p.evaluate(() => { window.__H.step(20); const D = window.__D(), V = D.VDV, IB = V.lot.meshes[0], M = new (window.__THREE.Matrix4)(); let hid = 0; for (const c of V.lot.cars) { IB.getMatrixAt(c.inst, M); if (M.elements[0] === 0) hid++; } let vis = 0; D.TR.scene.traverse((o) => { if (o.name && o.name.startsWith('vdlot-') && o.visible) vis++; }); return { live: D.VDL.live.size, hid, vis }; }); if (s6d.live === 0 && s6d.hid === 0) break; await p.waitForTimeout(250); }
console.log('6d', el(), JSON.stringify(s6d));
check(s6d.live === 0 && s6d.hid === 0 && s6d.vis === 0, `walked away: the real cars are put away and every far copy is back (${s6d.live} live, ${s6d.hid} hidden, ${s6d.vis} shown)`);

// ================= 8 截圖＋draw calls =================
const bd8 = await p.evaluate(() => window.__H.boardCar());
check(bd8.mode === 'off' && bd8.drv, 'back in the car in the lot');
const perf = {};
const view = async (name, fn) => { await p.evaluate(fn); perf[name] = await drawAndShot(name); };
const sX = await p.evaluate(() => { const P = window.__D().VDV.path; let b = 0, bd = 1e9; for (let i = 0; i < P.n; i++) { const d = Math.hypot(P.X[i] + 557, P.Z[i] - 338); if (d < bd) { bd = d; b = i; } } return P.S[b]; });
await view('lot', () => { const D = window.__D(), H = window.__H; D.VDV.st.py = 0; H.put(-777.6, 330, Math.PI / 2, 90); });
await view('roundabout', () => { const H = window.__H, P = window.__D().VDV.path; H.putDeck(P.sH - 60, 2, 90); });
await view('crossing', () => { window.__H.putDeck(window.__sX - 50, 2, 90); }, await p.evaluate((s) => { window.__sX = s; }, sX));
await view('neihu-end', () => { const H = window.__H, P = window.__D().VDV.path; H.putDeck(P.L - 70, 2, 90); });
await view('under', () => { const D = window.__D(), H = window.__H; D.VDV.st.py = 0; const th = 1.02; H.put(-780 + 256.9 * Math.sin(th), 225 + 256.9 * Math.cos(th), Math.atan2(-(-Math.sin(th)), Math.cos(th)), 90); });
const tAt = await p.evaluate(() => {
  const V = window.__D().VDV, P = V.path, N = 200000; let s = 0; const t0 = performance.now();
  for (let k = 0; k < N; k++) { const i = (k * 7919) % P.n, u = ((k % 17) - 8) * 1.1; const y = V.at(P.X[i] - P.TZ[i] * u + (k % 5) * 3, P.Z[i] + P.TX[i] * u, 10); if (y != null) s++; }
  const t1 = performance.now(); let s2 = 0; for (let k = 0; k < N; k++) if (V.at(-1200 + (k % 600), -600 + (k % 211), 0) != null) s2++;
  return { on: +((t1 - t0) / N).toFixed(5), far: +((performance.now() - t1) / N).toFixed(5), hits: s, s2 };
});
console.log('8', el(), 'perf', JSON.stringify(perf), 'at', JSON.stringify(tAt));
check(tAt.on < 0.01 && tAt.far < 0.003, `VDV.at: ${tAt.on} ms near the deck, ${tAt.far} ms away from it`);
check(Object.values(perf).every((q) => q && q.calls < 420 && q.tris < 2.2e6), `draw calls / triangles: ${Object.entries(perf).map(([k, q]) => `${k} ${q.calls}/${(q.tris / 1e6).toFixed(2)}M`).join(', ')}`);

// ================= 7 晚上（高）：橋上的路燈真的亮 =================
await p.evaluate(() => {
  const D = window.__D(), H = window.__H, L = D.LOOK; L.set(1); L.setRain(0); L.setHour(22);
  const P = D.VDV.path; H.putDeck(P.sH + 420, 2, 30); for (let k = 0; k < 6; k++) H.step(40);
  window.__n7 = window.__dframes || 0; window.__noDraw = false; // look.js 的燈在畫的時候才算（畫 20 格：燈慢慢亮 1.2 秒）
});
await p.waitForFunction(() => (window.__dframes || 0) >= window.__n7 + 20, null, { timeout: 600000 });
const s7 = await p.evaluate(() => {
  window.__noDraw = true; const D = window.__D(), L = D.LOOK;
  const t = D.drv.telemetry(), cy = D.tripS.car.position.y, lit = [];
  D.TR.scene.traverse((o) => { if (o.name === 'lk-lamp' && o.intensity > 0) lit.push({ d: Math.round(Math.hypot(o.position.x - t.x, o.position.z - t.z)), y: Math.round(o.position.y), I: Math.round(o.intensity) }); });
  return { lit, cy: +cy.toFixed(1), lamps: L.info().lamps, night: L.info().night };
});
console.log('7', el(), JSON.stringify(s7));
check(s7.night > 0.9 && s7.lit.some((l) => l.y > s7.cy + 3 && l.d < 60), `22:00 高 up on the deck: the deck lamps are lit (${s7.lit.map((l) => `${l.I}@${l.d}m/${l.y}m`).join(', ')}; ${s7.lamps} lamp heads)`);
perf.night = await drawAndShot('night');

await b.close(); srv.close();
console.log(errs.length ? `page errors: ${errs.length}` : 'no page errors');
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' / ')}` : 'ALL CHECKS OK');
process.exit(fails.length || errs.length ? 1 : 0);
