// 圓環高架橋＋超大停車場（viaduct.js，第 91 批；Nick 2026-11-14「在原本的快速道路上搭建一個像這樣的圓環高架橋…高架橋中間下面要有一個超大停車場有很多車車一樣從車店挑」）
//   1 開局：路線多長、圓環、多高、橋下至少 6.5 公尺、坡度、橋墩、路燈；南邊那座山拿掉了、停車場的地是平的；三分之二的格子有車（便宜的多、超跑少）；橋下沒有房子
//   2 快速道路內圈的口：連到停車場的路上沒有東西擋；口外面的護欄照舊擋
//   3 GC8 從快速道路開進口、停車場、上圓環（1.5 圈到 24 公尺）、跨過快速道路、開到內湖最遠那頭下來：一直貼著橋面、沒有卡住、沒有撞到；在橋上：地上的車不擋、警察看不到
//   4 開在橋下（圓環下面、往內湖那段下面）：在地上、不會撞到橋面上的護欄
//   5 在橋上下車走路：人在橋面上、走到邊邊護欄擋住、跳一下還在橋上；上車開走
//   6 停車場走路：附近的車換成真的輕量車（最多 8 台）、遠的那台藏起來；走遠了換回去
//   7 晚上：橋上、停車場的路燈加進 look.js 的燈
//   8 截圖＋draw calls（停車場、圓環上面、跨過快速道路、內湖那頭、橋下）；VDV.at 多快
//   10 第 93 批：雙向中間有分隔島（每一段都擋、開不過去、車子不會開到上面、方向對）；街上的警車＝小黃的車身＋警車塗裝＋警示燈；高架上的國道警察（GC8 白底紅條）：巡邏、你被通緝就來追（亮燈、警笛）、看到你星星不掉、沒星星就不追、撞到牠 1★、停下來被抓（最後一段，關進拘留室）
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
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, trip, tripS, tripPose, cur, walker, TR, indoor, TOWER_RAMP, VDV, VDL, PW, LOOK, NPC: NPC || window.__npcKeep, HILL_LIST, VDT, VDTR, RCROWD, RCR }); window.__vdt = (on) => { VDT_ON = on; }; window.__polP = () => polPlayer({}); window.__P = () => PERF;'
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
  H.putRamp = (id, s, n = 90) => { const V = window.__D().VDV, r = V.roads.find((q) => q.def.id === id), i = Math.max(0, Math.min(r.n - 1, Math.round((s / r.L) * (r.n - 1)))); V.st.py = r.Y[i]; V.st.px = r.X[i]; V.st.pz = r.Z[i]; return window.__H.put(r.X[i], r.Z[i], Math.atan2(-r.TZ[i], r.TX[i]), n); }; // 第 92 批：放到交流道上
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
await p.evaluate(() => window.__vdt(false)); // 第 92 批：高架上的車先關掉（第 3～6 段只看路；第 9 段再開）
const s1 = await p.evaluate(() => {
  const D = window.__D(), V = D.VDV, VIL = D.VIL; if (!V) return { err: 'no VDV' };
  const I = V.info, P = V.path, Y = V.Y;
  let maxG = 0, gAt = 0; for (let i = 20; i < P.n - 20; i++) { const g = Math.abs(Y[i + 1] - Y[i]) / 2; if (g > maxG) { maxG = g; gAt = Math.round(P.S[i]); } }
  const lotH = []; for (const [dx, dz] of [[0, 0], [60, 0], [-60, 0], [0, 60], [0, -60], [45, 70], [-45, -70], [0, 120], [0, 200]]) lotH.push(+VIL.heightAt(-780 + dx, 250 + dz).toFixed(3));
  const lotS = VIL.surfaceAt(-760, 250), connS = VIL.surfaceAt(-780, 420);
  const hill = D.HILL_LIST.some((h) => h.x === -805 && h.z === 185), nHill = D.HILL_LIST.length;
  const cars = V.lot.cars.filter((c) => c.area !== 'r'), kinds = {}; // 第 92 批：休息站的車（area 'r'）另外算 for (const c of cars) kinds[c.k] = (kinds[c.k] || 0) + 1;
  const PERF = window.__P(); let cheap = 0, sup = 0; for (const c of cars) { const pr = PERF[c.k].price; if (pr <= 100) cheap++; if (pr >= 1000) sup++; }
  // 橋下的房子：橋面邊上 2 公尺內、比橋面下面高的（村子、內湖）
  let under = 0, ex = null; for (const b of VIL.buildings || []) { if (!isFinite(b.x)) continue; for (const [dx, dz] of [[0, 0], [b.hx || 0, 0], [-(b.hx || 0), 0], [0, b.hz || 0], [0, -(b.hz || 0)]]) { const x = b.x + dx, z = b.z + dz; if (!V.near(x, z, 0)) continue; let lo = 1e9; for (let i = 0; i < P.n; i += 1) { const d = Math.hypot(P.X[i] - x, P.Z[i] - z); if (d < 8.5) lo = Math.min(lo, Y[i] - 1.1); } if ((b.h || 3) + VIL.heightAt(x, z) > lo - 0.5) { under++; ex = ex || [b.kind, Math.round(x), Math.round(z), b.h]; } break; } }
  const meshes = []; V.group.traverse((o) => { if (o.isMesh) meshes.push(o.name); });
  return { I, maxG: +maxG.toFixed(3), gAt, lotH, lotS, connS, hill, nHill, cheap, sup, nCars: cars.length, kinds, under, ex, meshes: meshes.length, lampsX: (VIL.lampsX || []).length / 3, vdGone: VIL.neihu?.info?.vdGone ?? null, sg: V.signs.list.map((q) => q.why + (q.skip ? '（沒放）' : '')), sgTris: V.signs.tris, sgMesh: V.signs.group.children.length, etcS: V.etc.map((e) => e.s), curves: I.curves };
});
console.log('1', el(), JSON.stringify(s1));
check(!s1.err, 'the viaduct is built (VDV)');
check(s1.I.len > 4500 && s1.I.len < 5600 && Math.abs(s1.I.helix - 3 * Math.PI * 112) < 15, `the route is ${s1.I.len} m long, the roundabout ${s1.I.helix} m (1.5 turns of radius 112; batch 94, was 105)`);
check(s1.I.yMax >= 24 && s1.I.yMax < 40 && s1.I.minClear[0] >= 6.45, `24 m high (highest ${s1.I.yMax} m); at least ${s1.I.minClear[0]} m under the deck (s ${s1.I.minClear[1]})`);
{ const R = s1.I.restMain; check(R && R.s1 - R.s0 > 400 && R.yLo >= 23.9 && R.yHi <= 24.5, `next to the rest area the road is level with the rest-area ground (within 0.5 m) (s ${R && R.s0}–${R && R.s1}, y ${R && R.yLo}–${R && R.yHi})`); }
check(s1.maxG < 0.06, `never steeper than 6% (steepest ${(s1.maxG * 100).toFixed(1)}% at s ${s1.gAt})`);
check(s1.I.piers >= 80 && s1.I.cols >= 20 && s1.I.lamps >= 100, `${s1.I.piers} piers (${s1.I.pierSkip} spots skipped: road, house, tunnel), ${s1.I.cols} roundabout columns, ${s1.I.lamps} lamps`);
check(s1.hill === false && s1.nHill === 23, `the hill inside the south half of the freeway loop is gone (${s1.nHill} hills)`);
check(s1.lotH.every((h) => Math.abs(h) < 0.06), `the parking lot ground is flat (${s1.lotH.join(', ')})`);
check(s1.lotS === 0 && s1.connS === 0, 'parking lot and the road to it are asphalt');
check(s1.I.lotSpots >= 800 && s1.nCars / s1.I.lotSpots > 0.55 && s1.nCars / s1.I.lotSpots < 0.77, `${s1.nCars} cars in ${s1.I.lotSpots} bays`);
check(s1.sup < s1.nCars * 0.04 && s1.cheap > s1.nCars * 0.5, `dealer cars, cheap ones common (${s1.cheap} up to 100 萬), supercars rare (${s1.sup}); ${JSON.stringify(s1.kinds)}`);
check(s1.I.restBays >= 400 && s1.I.restCars > s1.I.restBays * 0.3 && s1.I.restCars < s1.I.restBays * 0.95, `rest-area parking: ${s1.I.restCars} dealer cars in ${s1.I.restBays} bays`);
check(s1.under === 0, `no house under the deck (${s1.under}${s1.ex ? ' ' + JSON.stringify(s1.ex) : ''})`);
check(s1.lampsX >= s1.I.lamps, `the deck and lot lamps are in the world's lamp list (${s1.lampsX})`);
// 第 92 批：牌子（Nick「要交通號誌比如前有大灣或限速 / 有牌子橫過路中間寫到哪裡」）
{ const n = (re) => s1.sg.filter((w) => re.test(w)).length, last = s1.curves[s1.curves.length - 2];
  check(n(/沒放/) === 0 && n(/^限速/) >= 10 && n(/^前有大彎/) >= 3, `speed-limit and curve-warning signs on the barriers (${n(/^限速/)} limits, ${n(/^前有大彎/)} curve warnings, ${n(/沒放/)} skipped)`);
  check(n(/門架/) === 5 && s1.sgMesh === 2 && s1.sgTris < 4000, `5 gantries across the road with destinations (${s1.sg.filter((w) => /門架/.test(w)).join('、')}); all signs = ${s1.sgMesh} meshes, ${s1.sgTris} triangles`);
  check(s1.etcS.length === 1 && last && s1.etcS[0] > last.s1 && s1.etcS[0] < s1.I.len - 40, `an ETC gantry on the way down, on the straight after the last big curve (s ${s1.etcS[0]}; curve ends ${last && last.s1})`); }

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
  for (const q of H.deck(20, P.L - 2, 3.9)) pts.push(q); // 第 93 批：中間有分隔島了＝開在這個方向那兩線的中間（以前沒分隔島，開 2）
  { const i = P.n - 1; for (let k = 4; k <= 60; k += 4) pts.push([P.X[i] + P.TX[i] * k - P.TZ[i] * 2, P.Z[i] + P.TZ[i] * k + P.TX[i] * 2]); } // 下來以後在內湖的路上再開一段
  const t0 = Math.atan2(-(pts[1][1] - pts[0][1]), pts[1][0] - pts[0][0]);
  H.put(pts[0][0], pts[0][1], t0, 60);
  const etc0 = V.st.etcN || 0, r = { off: 0, maxDY: 0, hi: 0, hiPol: 0, maxY: 0, dyAt: null, sMax: 0, bumpAt: [], offAt: [] }; let nb = d.telemetry().bumps;
  const res = H.follow(pts, 520, { vmax: 22, each: (q) => {
    const y = D.tripS.car.position.y, st = V.st, Q = V.Q, yd = V.at(q.x, q.z, y);
    if (yd != null) { const dy = Math.abs(y - yd); if (dy > r.maxDY && !q.air) { r.maxDY = dy; r.dyAt = [Math.round(q.x), Math.round(q.z), +y.toFixed(2), +yd.toFixed(2), Math.round(Q.s)]; } r.sMax = Math.max(r.sMax, Q.s); }
    else if (r.sMax > 40 && r.sMax < P.L - 30) { r.off++; if (r.offAt.length < 4) r.offAt.push([Math.round(q.x), Math.round(q.z), +y.toFixed(1), Math.round(r.sMax)]); }
    r.maxY = Math.max(r.maxY, y);
    if (q.bumps > nb) { nb = q.bumps; if (r.bumpAt.length < 8) { const near = D.drv.colsNear ? D.drv.colsNear(q.x, q.z, 4).map((c) => `${c.tag}:${c.t}:${c.name || ''}:${c.h != null ? (+c.h).toFixed(1) : ''}`).slice(0, 5) : []; r.bumpAt.push([Math.round(q.x), Math.round(q.z), +y.toFixed(1), Math.round(V.Q.s), near]); } }
    if (st.high) { r.hi++; if (window.__polP().hidden) r.hiPol++; }
  } });
  const t = d.telemetry(), y = D.tripS.car.position.y, g = D.VIL.heightAt(t.x, t.z);
  return { ...res, ...r, etcN: (V.st.etcN || 0) - etc0, maxDY: +r.maxDY.toFixed(3), maxY: +r.maxY.toFixed(2), sMax: Math.round(r.sMax), L: Math.round(P.L), endY: +y.toFixed(2), endG: +g.toFixed(2), on: V.st.on, n: pts.length };
});
console.log('3', el(), JSON.stringify(s3));
if (process.env.VD_STOP === '3') { await b.close(); srv.close(); console.log(fails.length ? `FAILED ${fails.length}` : 'ok so far'); process.exit(0); }
check(s3.end && s3.stuck === 0, `drove the whole way (freeway → opening → lot → roundabout → to Neihu → down) without getting stuck (${s3.s} s, top ${s3.maxKmh} km/h)`);
check(s3.sMax > s3.L - 30 && s3.off === 0, `stayed on the deck from the start to the end (reached s ${s3.sMax} of ${s3.L}; ${s3.off} frames off it)`);
check(s3.maxDY < 0.25, `the car sits on the deck surface all the way (max ${s3.maxDY} m${s3.dyAt ? ' at ' + JSON.stringify(s3.dyAt) : ''})`);
check(s3.maxY > 23.5, `went up to ${s3.maxY} m`);
check(s3.bumps <= 1, `hit nothing on the way (${s3.bumps} bumps)`);
check(s3.hi > 600 && s3.hiPol === s3.hi, `up on the deck the police on the ground can't see you (${s3.hiPol}/${s3.hi} frames hidden)`);
check(s3.etcN === 1, `drove through the ETC gantry: one beep (${s3.etcN})`);
check(!s3.on && Math.abs(s3.endY - s3.endG) < 0.2, `back on the Neihu road at the end (y ${s3.endY}, ground ${s3.endG})`);

// ================= 3b 第 92 批：交流道（分岔到別的地方）：從主線外側那一線開下去、到內湖的路上 =================
const s3b = await p.evaluate(() => {
  const D = window.__D(), V = D.VDV, P = V.path, H = window.__H, d = D.drv, out = [];
  for (const r of V.roads.slice(1)) {
    const Df = r.def, pts = [];
    if (Df.exit) { const sd = Df.side * 5.3; for (let s = Df.s0 - Df.dir * 60; Df.dir > 0 ? s < Df.s0 : s > Df.s0; s += Df.dir * 4) { const i = Math.round(s / 2); pts.push([P.X[i] - P.TZ[i] * sd, P.Z[i] + P.TX[i] * sd]); } }
    for (let i = 0; i < r.n; i += 2) pts.push([r.X[i], r.Z[i]]);
    { const i = r.n - 1; for (let k = 2; k <= 10; k += 2) pts.push([r.X[i] + r.TX[i] * k, r.Z[i] + r.TZ[i] * k]); } // 下來以後開到內湖的路上（T 字：再過去是房子）
    const q0 = pts[0], t0 = Math.atan2(-(pts[1][1] - q0[1]), pts[1][0] - q0[0]), y0 = Df.exit ? V.Y[Math.round((Df.s0 - Df.dir * 60) / 2)] : r.Y[0];
    V.st.py = y0; V.st.px = q0[0]; V.st.pz = q0[1]; H.put(q0[0], q0[1], t0, 60);
    const o = { id: Df.id, off: 0, maxDY: 0, rampMax: 0, dyAt: null, bumpAt: [] }; let nb = d.telemetry().bumps, seen = false;
    const res = H.follow(pts, 200, { vmax: 18, each: (q) => {
      const y = D.tripS.car.position.y, yd = V.at(q.x, q.z, y);
      if (yd != null) { if (V.Q.r === r.id) { seen = true; o.rampMax = Math.max(o.rampMax, V.Q.s); } const dy = Math.abs(y - yd); if (dy > o.maxDY && !q.air) { o.maxDY = dy; o.dyAt = [Math.round(q.x), Math.round(q.z), +y.toFixed(2), +yd.toFixed(2), V.Q.r, Math.round(V.Q.s)]; } }
      else if (seen && o.rampMax < r.L - 8) o.off++;
      if (q.bumps > nb) { nb = q.bumps; if (o.bumpAt.length < 6) o.bumpAt.push([Math.round(q.x), Math.round(q.z), +y.toFixed(1), V.Q.r, Math.round(V.Q.s), (D.drv.colsNear ? D.drv.colsNear(q.x, q.z, 4).map((c) => `${c.vd || c.tag || ''}:${c.t}`).slice(0, 4) : [])]); }
    } });
    const t = d.telemetry(), y = D.tripS.car.position.y, g = Df.exit ? D.VIL.heightAt(t.x, t.z) : V.at(t.x, t.z, y) ?? -99; // 出口：下到地面（內湖的路、休息站的平台）；入口：開上主線
    out.push({ ...o, exit: !!Df.exit, end: res.end, stuck: res.stuck, bumps: res.bumps, s: res.s, maxKmh: res.maxKmh, L: Math.round(r.L), rampMax: Math.round(o.rampMax), maxDY: +o.maxDY.toFixed(3), endY: +y.toFixed(2), endG: +g.toFixed(2), onDeck: V.st.on, grade: +(r.maxGrade * 100).toFixed(1), x: Math.round(t.x), z: Math.round(t.z) });
  }
  return out;
});
console.log('3b', el(), JSON.stringify(s3b));
for (const r of s3b) {
  check(r.end && r.stuck === 0 && r.rampMax > r.L - 10 && r.off === 0, `ramp ${r.id}: drove the whole ${r.L} m ramp to its end (reached ${r.rampMax}; ${r.off} frames off the deck, ${r.s} s)`);
  check(r.maxDY < 0.25 && r.bumps <= 1, `ramp ${r.id}: sat on the deck (max ${r.maxDY} m${r.dyAt ? ' at ' + JSON.stringify(r.dyAt) : ''}), ${r.bumps} bumps${r.bumpAt.length ? ' ' + JSON.stringify(r.bumpAt) : ''}`);
  check((r.exit ? !r.onDeck : r.onDeck) && Math.abs(r.endY - r.endG) < 0.2 && r.grade <= 7, `ramp ${r.id}: ${r.exit ? 'ends on the ground (Neihu road / rest area)' : 'merges onto the main road'} (y ${r.endY}, ${r.exit ? 'ground' : 'deck'} ${r.endG}; steepest ${r.grade}%)`);
}
if (process.env.VD_STOP === '3b') { await b.close(); srv.close(); console.log(fails.length ? `FAILED ${fails.length}` : 'ok so far'); process.exit(0); }

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
  const q = H.at(P.sH + 280, V.HW - 5), i = q.i, hOut = Math.atan2(-P.TX[i], -P.TZ[i]); // 第 94 批：路寬了，從外線走過去
  W.teleport({ x: q.x, z: q.z, heading: hOut }); H.step(60);
  const g = W.character.group.position; let uMax = -9, yMin = 99;
  W.setInput({ x: 0, y: 1 });
  for (let k = 0; k < 200; k++) { H.step(1); V.at(g.x, g.z, g.y); if (V.Q.u > uMax) uMax = V.Q.u; yMin = Math.min(yMin, g.y); }
  W.setInput(null); H.step(20);
  V.at(g.x, g.z, g.y); const u = V.Q.u;
  // 跳一下（還在橋上）
  const y0 = g.y, j = W.jump(); let top = y0; for (let k = 0; k < 80; k++) { H.step(1); top = Math.max(top, g.y); } H.step(30);
  return { HW: V.HW, uMax: +uMax.toFixed(2), u: +u.toFixed(2), yMin: +yMin.toFixed(2), deckY: +q.y.toFixed(2), jumped: j, top: +(top - y0).toFixed(2), y1: +g.y.toFixed(2), on: V.st.on, mode: W.mode };
});
console.log('5b', el(), JSON.stringify(s5b));
check(s5b.uMax > s5b.HW - 1.6 && s5b.uMax < s5b.HW - 0.4 && s5b.yMin > s5b.deckY - 0.2, `walking into the side barrier: it stops you (got to ${s5b.uMax} m from the middle; the barrier is at ${s5b.HW - 0.6}–${s5b.HW}), never fell off (lowest ${s5b.yMin} m)`);
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
  const D = window.__D(), V = D.VDV, g = D.walker.character.group.position;
  const L = [...D.VDL.live].map(([c, e]) => { return { k: c.k, d: +Math.hypot(c.x - g.x, c.z - g.z).toFixed(1), hid: V.lot.hidden(c.inst), vis: e.l.car.visible && !!e.l.car.parent, at: Math.hypot(e.l.car.position.x - c.x, e.l.car.position.z - c.z) < 0.01 }; });
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
for (let k = 0; k < 20; k++) { s6d = await p.evaluate(() => { window.__H.step(20); const D = window.__D(), V = D.VDV; let hid = 0; for (const c of V.lot.cars) if (V.lot.hidden(c.inst)) hid++; let vis = 0; D.TR.scene.traverse((o) => { if (o.name && o.name.startsWith('vdlot-') && o.visible) vis++; }); return { live: D.VDL.live.size, hid, vis }; }); if (s6d.live === 0 && s6d.hid === 0) break; await p.waitForTimeout(250); }
console.log('6d', el(), JSON.stringify(s6d));
check(s6d.live === 0 && s6d.hid === 0 && s6d.vis === 0, `walked away: the real cars are put away and every far copy is back (${s6d.live} live, ${s6d.hid} hidden, ${s6d.vis} shown)`);

// ================= 9 第 92 批：高架上的車、休息站的車進出、停車場和休息站的人和動物 =================
// Nick 2026-11-15「高速公路要有少許的車」「比較厲害的跑車開快一點」「車子不要靠近才變出來」「休息站…要有人車 車一樣從車店挑有車進來有車離開有那三隻動物跟人」「圓環中間要有人走來走去」
const bd9 = await p.evaluate(() => window.__H.boardCar());
check(bd9.mode === 'off' && bd9.drv, 'back in the car (traffic on)');
await p.evaluate(() => { window.__vdt(true); window.__H.putDeck(2200, 12.25, 30); window.__H.stop(); window.__s9 = /* 第 94 批：最外面那線 12.25（以前外線 5.55） */ { seen: new Map(), b0: window.__D().drv.telemetry().bumps, maxMain: 0, minGap: 1e9, noObj: 0 }; });
const step9 = (secs) => p.evaluate((secs) => { // 一秒 20 格（每秒一次讓輕量車做好）
  const D = window.__D(), T = D.VDT, S = window.__s9, t = D.drv.telemetry(), cy = D.tripS.car.position.y;
  for (let k = 0; k < secs * 20; k++) {
    window.__dstep(1, 1 / 20);
    let nm = 0;
    for (const c of T.cars) {
      const d = Math.hypot(c.x - t.x, c.z - t.z); let e = S.seen.get(c.id);
      if (!e) { e = { k: c.k, fast: c.fast, d0: d, rest: c.rest, from: c.lot ? 'lot' : c.line?.id, vmax: 0, st: new Set() }; S.seen.set(c.id, e); }
      e.vmax = Math.max(e.vmax, c.v * 3.6); e.st.add(c.state + ':' + (c.line?.ramp ? c.line.id : c.line?.ms ? 'M' : c.line ? 'r' : ''));
      if (!c.rest) nm++;
      if (Math.abs(c.y - cy) < 2.5) { const ex = c.x - t.x, ez = c.z - t.z, fx = Math.cos(c.h), fz = -Math.sin(c.h), a = Math.abs(ex * fx + ez * fz) - c.len / 2 - 2.2, b = Math.abs(-ex * fz + ez * fx) - c.wid / 2 - 0.95; S.minGap = Math.min(S.minGap, Math.max(a, b)); }
      if (d < 600 && !c.obj && !c.needObj && k === secs * 20 - 1) S.noObj++; // 還在等輕量車的（停在原地、看不到、不擋）不算
      if (c.needObj) S.hold = Math.max(S.hold || 0, c.ht || 0);
    }
    S.maxMain = Math.max(S.maxMain, nm);
  }
  return T.cars.length;
}, secs);
for (let k = 0; k < 60; k++) { await step9(1); await p.waitForTimeout(40); }
const s9a = await p.evaluate(() => {
  const D = window.__D(), T = D.VDT, S = window.__s9, L = [...S.seen.values()], main = L.filter((e) => !e.rest && e.from !== 'lot');
  const vm = (f) => { const a = main.filter((e) => e.fast === f && e.vmax > 20).map((e) => e.vmax); return a.length ? Math.max(...a) : 0; };
  const live = T.cars.filter((c) => c.obj && !c.cop && c.obj.car.visible); /* 國道警察（第 93 批）是另外的物件，第 10 段測 */ const t = D.drv.telemetry();
  const kinds = [...new Set(L.map((e) => e.k))];
  return { n: L.length, main: main.length, d0: main.map((e) => Math.round(e.d0)).sort((a, b) => a - b), v0: Math.round(vm(0)), v1: Math.round(vm(1)), v2: Math.round(vm(2)), kinds, maxMain: S.maxMain, bumps: t.bumps - S.b0, minGap: +S.minGap.toFixed(2), info: T.info(), live: live.length, noObj: S.noObj, hold: +(S.hold || 0).toFixed(2), at: live.every((c) => Math.hypot(c.obj.car.position.x - c.x, c.obj.car.position.z - c.z) < 0.01), ms: +D.VDTR.avg.toFixed(3) };
});
console.log('9a', el(), JSON.stringify(s9a).slice(0, 1500));
check(s9a.main >= 4 && s9a.maxMain <= 6, `a few cars on the viaduct: ${s9a.main} came by in a minute, at most ${s9a.maxMain} on the main road at once (${s9a.kinds.join(', ')})`);
check(s9a.d0.slice(3).every((d) => d >= 400) && s9a.d0.every((d) => d >= 240), `cars appear far away, not next to you: nearest spawns ${s9a.d0.slice(0, 5).join(', ')} m`);
check(s9a.v0 >= 70 && s9a.v0 <= 86 && s9a.v1 > s9a.v0 + 8 && (!s9a.v2 || s9a.v2 > s9a.v1 + 8), `sports cars go faster: ordinary ${s9a.v0} km/h, sports ${s9a.v1}, supercars ${s9a.v2 || '-'}`);
check(s9a.bumps === 0 && s9a.minGap > 0, `nobody hits your stopped car in the outer lane: ${s9a.bumps} bumps, closest ${s9a.minGap} m (${s9a.info.lanes} lane changes to pass you, ${s9a.info.waits} waited)`);
check(s9a.live >= 1 && s9a.at && s9a.noObj === 0 && s9a.info.lost === 0, `the cars near you are real cars (${s9a.live} drawn, every one within 600 m that moves has its car; longest wait for a car ${s9a.hold} s, ${s9a.info.lost} given up)`);
// 休息站：停在東邊那條路上；車從 EX、WX 下來停進空的格子；停著的車倒車出來、從 EE、WE 開回主線
const s9b0 = await p.evaluate(() => {
  const D = window.__D(), V = D.VDV, T = D.VDT, H = window.__H; V.st.py = 24; H.put(900, 196, 0, 30); H.stop(); // 遊覽車那一區（車進出不會經過）
  const a = T.spawnAt('REX', 5), b = T.spawnAt('RWX', 5), c = T.depart(1), d = T.depart(-1);
  window.__s9b = { ids: [a, b, c, d].filter(Boolean).map((q) => q.id), lot: [c, d].filter(Boolean).map((q) => q.lot.inst), st0: { ...T.st } };
  return { ok: !!(a && b && c && d), y: +D.tripS.car.position.y.toFixed(2) };
});
check(s9b0.ok && Math.abs(s9b0.y - 24) < 0.2, `parked in the rest area's bus lot (y ${s9b0.y}); two cars took the rest-area exits, two parked cars start to leave`);
let s9b = null, lotHid = null;
for (let k = 0; k < 150; k++) {
  await step9(1); await p.waitForTimeout(40);
  if (k === 12) lotHid = await p.evaluate(() => { const V = window.__D().VDV; return window.__s9b.lot.map((i) => [V.lot.hidden(i), V.lot.cols[i].off === true]); });
  s9b = await p.evaluate(() => { const T = window.__D().VDT, S = window.__s9b, st = T.st; return { states: S.ids.map((id) => { const c = T.cars.find((q) => q.id === id); return c ? c.state + ':' + (c.line?.ramp ? c.line.id : c.line?.ms ? 'M' : c.line ? 'r' : '') : 'gone'; }), parked: st.parked - S.st0.parked, departed: st.departed - S.st0.departed, merged: st.merged - S.st0.merged, exits: st.exits - S.st0.exits }; });
  if (s9b.parked >= 2 && s9b.merged >= 2) break;
}
console.log('9b', el(), JSON.stringify(s9b), JSON.stringify(lotHid));
check(lotHid && lotHid.every((q) => q[0] && q[1]), `a parked car that drives off: the parked copy is hidden and stops blocking (${JSON.stringify(lotHid)})`);
check(s9b.exits >= 2 && s9b.parked >= 2, `cars come in: ${s9b.exits} came down the rest-area exits, ${s9b.parked} parked in empty bays`);
check(s9b.departed >= 2 && s9b.merged >= 2, `cars leave: ${s9b.departed} backed out of their bays, ${s9b.merged} drove back up onto the viaduct`);
// 人和動物：休息站的廣場、停車場的走道
const s9c = await p.evaluate(() => {
  const D = window.__D(), K = D.RCROWD, H = window.__H; if (!K) return { err: 'no crowd' };
  for (let k = 0; k < 30; k++) H.step(20, 1 / 20);
  const Z = K.zones.find((q) => q.id === 'rest'), A = Z.agents, p0 = A.map((a) => [a.x, a.z]); let bad = 0;
  for (let k = 0; k < 40; k++) { H.step(20, 1 / 20); for (const a of A) if (!K.ok(Z, a.x, a.z)) bad++; }
  const moved = A.filter((a, i) => Math.hypot(a.x - p0[i][0], a.z - p0[i][1]) > 2).length;
  const kinds = [...new Set(A.filter((a) => a.animal).map((a) => a.kind))];
  return { info: K.info(), n: A.length, people: A.filter((a) => !a.animal).length, animals: A.filter((a) => a.animal).length, kinds, moved, bad, y: A.map((a) => +a.C.group.position.y.toFixed(2)).filter((y) => Math.abs(y - 24) > 0.05).length, vis: A.every((a) => a.C.group.visible && !!a.C.group.parent) };
});
console.log('9c', el(), JSON.stringify(s9c).slice(0, 900));
check(s9c.n >= 10 && s9c.people >= 5 && s9c.animals >= 5 && s9c.kinds.length >= 2 && s9c.vis, `rest area: ${s9c.people} people and ${s9c.animals} animals (${s9c.kinds.join(', ')}) walking around`);
check(s9c.moved >= Math.ceil(s9c.n / 2) && s9c.bad === 0 && s9c.y === 0, `they walk on the plaza (${s9c.moved}/${s9c.n} moved in 40 s), never into walls, benches or the pond (${s9c.bad}), feet on the deck (${s9c.y} off)`);
// 停車場：開車往一個人（動物）開過去：跳開，不會被壓到
const s9d = await p.evaluate(() => {
  const D = window.__D(), K = D.RCROWD, H = window.__H, V = D.VDV; V.st.py = 0; H.put(-777.6, 330, Math.PI / 2, 30); H.stop();
  for (let k = 0; k < 40; k++) H.step(20, 1 / 20); // 走近才做（一格做一個）
  const Z = K.zones.find((q) => q.id === 'lot'), A = Z.agents; if (!A.length) return { err: 'no lot agents', info: K.info() };
  const a = A.find((q) => !q.kid) || A[0], x0 = a.x, z0 = a.z, d0 = K.info().dives, h0 = K.info().hits;
  // 車放在他東邊 14 公尺（同一條走道）、朝他開（4 m/s）
  a.path = null; a.wait = 99; const ex = x0 + (x0 < -780 ? 14 : -14), hd = x0 < -780 ? Math.PI : 0; // 車在他和中間的大走道之間，朝他開
  H.put(ex, z0, hd, 20); let minC = 1e9;
  const dr = D.drv; dr.setInput({ throttle: 0.25, brake: 0, steer: 0 });
  for (let k = 0; k < 240; k++) { H.step(1, 1 / 30); const t = dr.telemetry(); dr.setInput({ throttle: t.v < 3.6 ? 0.3 : 0, brake: 0, steer: 0 }); /* 定速約 4 m/s（放開油門會被引擎煞車停下來） */ const ci = dr.carInfo, CX = (ci.nose + ci.tail) / 2, cx = t.x + Math.cos(t.heading) * CX, cz = t.z - Math.sin(t.heading) * CX, fx = Math.cos(t.heading), fz = -Math.sin(t.heading), dx = a.x - cx, dz = a.z - cz; const ga = Math.abs(dx * fx + dz * fz) - ci.len / 2, gb = Math.abs(-dx * fz + dz * fx) - ci.halfW; minC = Math.min(minC, Math.max(ga, gb)); if (Math.hypot(t.x - x0, t.z - z0) > 20) break; }
  dr.setInput(null); H.stop();
  return { info: K.info(), people: A.filter((q) => !q.animal).length, animals: A.filter((q) => q.animal).length, dove: K.info().dives - d0, hits: K.info().hits - h0, minC: +minC.toFixed(2), kid: !!a.kid };
});
console.log('9d', el(), JSON.stringify(s9d).slice(0, 900));
check(s9d.people >= 5 && s9d.animals >= 5, `the big lot under the roundabout: ${s9d.people} people and ${s9d.animals} animals walking between the rows`);
check(s9d.dove >= 1 && s9d.hits === 0 && s9d.minC > -0.05, `drive slowly at one of them: it jumps aside (${s9d.dove} dives, ${s9d.hits} knocked down, never under the car: closest ${s9d.minC} m)`);

// ================= 9e 第 94 批：南休的廁所、大市集、路面 =================
// Nick「南休廁所沒有入口進去裡面沒有馬桶」「南休便利商店要長得跟改車廠旁的完全不一樣裡面大一點南休路面真一點」
await p.evaluate(() => {
  const H = window.__H, vis = (e) => !!e && !e.hidden && !e.closest('[hidden]') && e.getClientRects().length > 0;
  H.press = () => { const e = [...document.querySelectorAll('#stage .wk-act, #stage .dv-act')].find(vis); if (!e) return null; const s = e.querySelector('span').textContent; e.click(); return s; };
  H.walkTo = (pts, maxN = 900, sp = 0.7) => { // 照著一串點走（推搖桿：鏡頭的前面 (cos yaw, −sin yaw)、右邊 (sin yaw, cos yaw)）；回傳最後離終點多遠
    const W = window.__D().walker, g = W.character.group.position; let k = 0, n = 0;
    while (k < pts.length && n < maxN) {
      const [x, z] = pts[k], dx = x - g.x, dz = z - g.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { k++; continue; }
      const ps = W.telemetry().camYaw, wx = dx / d, wz = dz / d; W.setInput({ x: (wx * Math.sin(ps) + wz * Math.cos(ps)) * sp, y: (wx * Math.cos(ps) - wz * Math.sin(ps)) * sp }); H.step(1); n++;
    }
    W.setInput(null); H.step(10);
    const [lx, lz] = pts[pts.length - 1];
    return { reached: k, of: pts.length, n, d: +Math.hypot(lx - g.x, lz - g.z).toFixed(2), at: [+g.x.toFixed(2), +g.y.toFixed(2), +g.z.toFixed(2)] };
  };
});
const s9e = await p.evaluate(() => {
  const D = window.__D(), V = D.VDV, H = window.__H, R = V.rest; if (!R) return { err: 'no VDV.rest' };
  V.st.py = 24; H.put(985, 246.5, 0, 40); H.stop();
  window.__leave(); for (let i = 0; i < 600 && !(D.walker && D.walker.mode === 'walk'); i++) H.step(1); H.step(30);
  const W = D.walker, W0 = R.wcs[0], xm = (W0.x0 + W0.x1) / 2, zm = (W0.z0 + W0.z1) / 2, out = { mode: W.mode, rooms: [] };
  // 三個門口走進去、繞過擋視線的牆（男：西邊、女：東邊、親子：南邊）
  const rooms = { men: [[W0.x0 - 4, zm], [W0.x0 + 1.4, zm], [W0.x0 + 1.4, zm - 4.6], [W0.x0 + 6, zm - 4.6]], fam: [[xm, W0.z1 + 4], [xm, W0.z1 - 1.6], [xm + 3.2, W0.z1 - 1.6], [xm + 3.2, W0.z1 - 6]], wom: [[W0.x1 + 4, zm], [W0.x1 - 1.4, zm], [W0.x1 - 1.4, zm - 4.6], [W0.x1 - 6, zm - 4.6]] };
  for (const [k, pts] of Object.entries(rooms)) {
    W.teleport({ x: pts[0][0], z: pts[0][1], heading: 0 }); H.step(30);
    const r = H.walkTo(pts.slice(1), 900); H.step(40);
    const c = D.dcam.position;
    out.rooms.push({ k, d: r.d, y: r.at[1], cam: [+c.x.toFixed(1), +c.y.toFixed(2), +c.z.toFixed(1)], camIn: c.x > W0.x0 && c.x < W0.x1 && c.z > W0.z0 && c.z < W0.z1 && c.y < 24 + 3.9 });
  }
  const pA = xm - 4, pB = xm + 4, inW = (f) => f[1] > W0.x0 && f[1] < W0.x1 && f[2] > W0.z0 && f[2] < W0.z1;
  const cnt = (lo, hi) => { const o = { toilet: 0, urinal: 0, sink: 0 }; for (const f of R.fixtures) if (inW(f) && f[1] > lo && f[1] < hi) o[f[0]]++; return o; };
  out.fix = { men: cnt(W0.x0, pA), fam: cnt(pA, pB), wom: cnt(pB, W0.x1) }; out.both = R.fixtures.filter((f) => f[0] === 'toilet').length;
  return out;
});
console.log('9e', el(), JSON.stringify(s9e));
for (const r of s9e.rooms || []) check(r.d < 0.5 && Math.abs(r.y - 24) < 0.1 && r.camIn, `rest-area toilet (${r.k}): walked in through the open doorway and around the screen wall (${r.d} m from the end, feet at ${r.y}); the camera stays inside, under the ceiling (${r.cam.join(', ')})`);
check(s9e.fix && s9e.fix.men.toilet >= 6 && s9e.fix.men.urinal >= 4 && s9e.fix.men.sink >= 2 && s9e.fix.wom.toilet >= 10 && s9e.fix.wom.sink >= 2 && s9e.fix.fam.toilet >= 2 && s9e.fix.fam.sink >= 1 && s9e.both >= 2 * (s9e.fix.men.toilet + s9e.fix.wom.toilet + s9e.fix.fam.toilet), `toilets inside: men ${JSON.stringify(s9e.fix?.men)}, family ${JSON.stringify(s9e.fix?.fam)}, women ${JSON.stringify(s9e.fix?.wom)} (both buildings: ${s9e.both} toilets)`);
const s9f = await p.evaluate(() => {
  const D = window.__D(), V = D.VDV, H = window.__H, W = D.walker, S = V.rest.store, out = {};
  const vs = D.VIL.buildings.find((b) => b.kind === 'store' && !b.rest); out.village = vs ? [vs.name, vs.hx * 2, vs.hz * 2] : null;
  W.teleport({ x: S.x, z: S.z + S.hz + 6, heading: Math.PI }); H.step(30);
  const r = H.walkTo([[S.x, S.z + S.hz - 4]], 600); H.step(20);
  const In = window.__D().indoor; out.walk = r.d; out.in = !!In?.live; out.name = In?.I?.name; out.size = [S.hx * 2, S.hz * 2];
  if (!In) return out;
  const I = In.I, N = I.floors[0].nav; out.nav = N ? [+(N.nx * N.gs).toFixed(1), +(N.nz * N.gs).toFixed(1)] : null;
  out.spots = [];
  for (const q of I.spots.shop) { W.teleport({ x: q.x, z: q.z, heading: q.heading || 0 }); H.step(20); out.spots.push([q.item, H.actText()]); }
  const ch = I.spots.shop.find((q) => q.item === 'chips'); W.teleport({ x: ch.x, z: ch.z, heading: ch.heading || 0 }); H.step(20); out.took = H.press(); H.step(10);
  const tl = I.spots.till[0]; W.teleport({ x: tl.x, z: tl.z, heading: tl.heading || 0 }); H.step(20); out.till = H.actText(); out.paid = H.press(); H.step(30);
  out.bag = document.querySelector('.mt-pill')?.textContent || null;
  W.teleport({ x: S.x, z: S.z + S.hz - 2, heading: 0 }); H.step(20); out.out = H.walkTo([[S.x, S.z + S.hz + 5]], 600).d; out.outside = !window.__D().indoor;
  let road = null; V.group?.traverse?.((o) => { if (o.name === 'rest-road') road = o; }); if (!road) D.TR.scene.traverse((o) => { if (o.name === 'rest-road') road = o; });
  out.road = road ? { map: !!road.material.map, role: road.material.userData.role, w: road.material.map?.image?.width } : null;
  return out;
});
console.log('9f', el(), JSON.stringify(s9f));
check(s9f.in && s9f.name === '大便龍市集' && s9f.size[0] === 26 && s9f.size[1] === 16 && s9f.nav && s9f.nav[0] >= 25 && s9f.nav[1] >= 15 && s9f.village && s9f.village[0] !== s9f.name && s9f.size[0] * s9f.size[1] > 1.5 * s9f.village[1] * s9f.village[2], `walked into 「${s9f.name}」: ${s9f.size?.join(' × ')} m (the village store 「${s9f.village?.[0]}」 is ${s9f.village?.[1]} × ${s9f.village?.[2]})`);
check(s9f.spots?.length === 9 && s9f.spots.every((q) => /^拿 · /.test(q[1] || '')) && /^拿 · 洋芋片/.test(s9f.took || '') && /^結帳/.test(s9f.till || '') && /袋子 1 樣/.test(s9f.bag || ''), `every shelf in the big store works (${s9f.spots?.map((q) => q[0]).join(', ')}), took chips, paid at the till (${s9f.till}) → ${s9f.bag}`);
check(s9f.outside && s9f.out < 0.5, 'walked back out of the door');
check(s9f.road && s9f.road.map && s9f.road.role === 'road' && s9f.road.w >= 512, `the rest area's asphalt has a texture (${JSON.stringify(s9f.road)})`);

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
await view('ramp-a', () => { const D = window.__D(), V = D.VDV, H = window.__H, Df = V.roads[1].def, P = V.path, i = Math.round((Df.s0 - 30) / 2), u = 5.3; H.putDeck(Df.s0 - 30, u, 90); void i; void P; }); // 第 92 批：主線上，前面分岔
await view('ramp-a-down', () => window.__H.putRamp('A', 300));
await view('ramp-a-land', () => window.__H.putRamp('A', 470));
await view('ramp-b-land', () => window.__H.putRamp('B', 440));
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


// ================= 10 第 93 批：雙向（分隔島）、警車、國道警察 =================
// Nick 2026-11-15「高速公路做成雙向來回的中間用分隔島隔開」「一般街上的警車用小黃 但塗裝是警車塗裝加警燈」「高速公路有額外的警用追逐車用GC8去查國道警車塗裝並採用」
await p.evaluate(() => {
  const H = window.__H, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // 照著主線開（往 +s，右手邊 u 公尺）：每一格看自己在哪個 s（VDV.st.s），往前看一點點
  H.drive = (secs, vmax, u = 2.2, each) => {
    const D = window.__D(), d = D.drv, V = D.VDV;
    for (let n = 0; n < secs * 60; n++) {
      const t = d.telemetry(), q = H.at(V.st.s + 6 + 0.5 * Math.abs(t.v), u), a = wrap(Math.atan2(-(q.z - t.z), q.x - t.x) - t.heading);
      d.setInput({ throttle: t.v > vmax + 1 ? 0 : t.v > vmax - 1 ? 0.35 : 1, brake: t.v > vmax + 1 ? 1 : 0, steer: Math.max(-1, Math.min(1, -2.6 * a)) }); H.step(1);
      if (each) each(d.telemetry());
    }
    d.setInput(null);
  };
  // 主線上的車（不算休息站、交流道上的）：離中線多遠、方向對不對（右手邊往 +s）
  H.medWatch = (S) => {
    const D = window.__D(), T = D.VDT, V = D.VDV, P = V.path, M = V.median;
    for (const c of T.cars) {
      if (c.rest || c.needObj || (c.line && c.line.ramp)) continue;
      if (V.at(c.x, c.z, c.y) == null || V.Q.r !== 0) continue;
      const s = V.Q.s, u = V.Q.u; if (s < M.s0 + 5 || s > M.s1 - 5) continue;
      S.n++; if (Math.abs(u) < S.minU) { S.minU = Math.abs(u); S.minAt = [c.k, c.cop ? 'cop' : c.state, Math.round(s), +u.toFixed(2)]; }
      const i = Math.min(P.n - 1, Math.round(s / 2)), fwd = Math.cos(c.h) * P.TX[i] - Math.sin(c.h) * P.TZ[i];
      if (!c.cop && c.v > 2 && fwd * Math.sign(u) < 0) { S.wrong++; S.wrongAt = S.wrongAt || [c.k, Math.round(s), +u.toFixed(2)]; }
    }
  };
  H.cam = (obj, lx, ly, lz, ty = 0.7) => { const D = window.__D(), Tm = window.__THREE, v = obj.localToWorld(new Tm.Vector3(lx, ly, lz)), w = obj.localToWorld(new Tm.Vector3(0, ty, 0)); D.dcam.position.copy(v); D.dcam.lookAt(w); D.dcam.updateMatrixWorld(true); };
});
await p.evaluate(() => { const L = window.__D().LOOK; L.set(0); L.setHour(13); window.__pol()?.clear(); });
// 10a 分隔島：主線上每一段都有、擋得住
const s10a = await p.evaluate(() => {
  const D = window.__D(), V = D.VDV, M = V.median, P = V.path, H = window.__H, d = D.drv;
  const cols = V.cols.filter((c) => c.vd === 'med');
  const inBox = (c, x, z) => { const r = c.rot || 0, dx = x - c.x, dz = z - c.z, u = dx * Math.cos(r) - dz * Math.sin(r), w = dx * Math.sin(r) + dz * Math.cos(r); return Math.abs(u) <= c.hx && Math.abs(w) <= c.hz; };
  let miss = 0, n = 0, missAt = null;
  for (let s = M.s0 + 2; s < M.s1 - 2; s += 6) { n++; const i = Math.round(s / 2); if (!cols.some((c) => inBox(c, P.X[i], P.Z[i]))) { miss++; missAt = missAt || Math.round(s); } }
  const tall = cols.every((c) => c.h - c.y0 > 1.3 && c.hz >= 0.25), mesh = []; V.group.traverse((o) => { if (o.isMesh) mesh.push(o.name); });
  // 往中間開（右邊那一線、往左斜）：被分隔島擋住，不會開到對面
  window.__vdt(false);
  const out = [];
  for (const [ds, ang] of [[300, 0.35], [1500, 0.45]]) { // 從外線斜斜開過去（衝一段，撞得到）
    const q = H.at(P.sH + ds, 5.55); V.st.py = q.y; V.st.px = q.x; V.st.pz = q.z; H.put(q.x, q.z, q.h + ang, 40);
    const b0 = d.telemetry().bumps; let minU = 99, onMain = 0;
    for (let k = 0; k < 240; k++) { d.setInput({ throttle: 0.55, brake: 0, steer: 0 }); H.step(1); const t = d.telemetry(), y = D.tripS.car.position.y; if (V.at(t.x, t.z, y) != null && V.Q.r === 0) { onMain++; minU = Math.min(minU, V.Q.u); } }
    d.setInput(null); H.stop();
    out.push({ s: Math.round(P.sH + ds), minU: +minU.toFixed(2), onMain, bumps: d.telemetry().bumps - b0 });
  }
  return { s0: M.s0, s1: Math.round(M.s1), L: Math.round(P.L), med: V.info.med, cols: cols.length, n, miss, missAt, tall, meshes: mesh.length, out };
});
console.log('10a', el(), JSON.stringify(s10a));
check(s10a.s0 <= 45 && s10a.s1 >= s10a.L - 10 && s10a.cols >= (s10a.s1 - s10a.s0) / 4 - 3 && s10a.miss === 0 && s10a.tall, `a median down the middle of the whole main road (s ${s10a.s0}–${s10a.s1} of ${s10a.L}; ${s10a.cols} blocks, ${s10a.miss}/${s10a.n} gaps; 0.82 m wall + anti-glare panels)`);
check(s10a.out.every((q) => q.bumps >= 1 && q.minU > 0.5 && q.onMain > 200), `driving at the median: it stops you, you never get to the other side (${s10a.out.map((q) => `s ${q.s}: closest ${q.minU} m from the middle, ${q.bumps} bumps`).join('; ')})`);

// 10b 街上的警車（小黃）、國道警察（GC8）的樣子：都是輕量車＋塗裝＋警示燈（沒有方塊車）
const s10b = await p.evaluate(() => {
  const D = window.__D(), out = { city: 0, box: 0, hwy: 0, other: [], draws: [], bar: 0, taxi: 0 };
  D.TR.scene.traverse((o) => {
    if (o.name !== 'police-car' && o.name !== 'hwy-police') return;
    const k = o.children.map((c) => c.name);
    if (k.includes('police-altis')) out.city++; else if (k.includes('police-gc8')) out.hwy++; else if (k.includes('police-car-box')) out.box++; else out.other.push(k.join('+'));
    let bar = 0; o.traverse((q) => { if (q.name === 'police-bar') bar++; }); if (bar === 1) out.bar++;
  });
  return out;
});
console.log('10b', el(), JSON.stringify(s10b));
check(s10b.city >= 3 && s10b.box === 0 && !s10b.other.length && s10b.bar === s10b.city + s10b.hwy, `street police cars are the 小黃 body in police colours with a light bar (${s10b.city} cars, ${s10b.box} old box cars)`);

// 10c 國道警察巡邏：主線上 1 台 GC8（白底紅條），沒有亮燈
await p.evaluate(() => { window.__vdt(true); window.__pol()?.clear(); const H = window.__H, P = window.__D().VDV.path; H.putDeck(P.sH + 900, 2.2, 30); H.stop(); window.__s10 = { minU: 99, wrong: 0, n: 0 }; });
let s10c = null;
for (let k = 0; k < 90; k++) {
  s10c = await p.evaluate(() => { const D = window.__D(), T = D.VDT, H = window.__H; for (let i = 0; i < 20; i++) { window.__dstep(1, 1 / 20); if (i % 4 === 0) H.medWatch(window.__s10); }
    const c = T.cars.find((q) => q.cop); if (!c) return { n: 0 };
    const o = c.obj, kid = o ? o.group.children.map((q) => q.name) : []; return { n: T.cars.filter((q) => q.cop).length, k: c.k, state: c.state, chase: c.chase, lights: !!c.lights, obj: !!o, kid, vis: !!o && o.group.visible && !!o.group.parent, kmh: Math.round(c.v * 3.6), info: T.info().cops };
  });
  await p.waitForTimeout(40);
  if (s10c.vis) break; // 生在 420～820 公尺外：700 公尺內才畫
}
console.log('10c', el(), JSON.stringify(s10c));
check(s10c.n === 1 && s10c.k === 'gc8' && s10c.state === 'drive' && !s10c.chase && !s10c.lights && s10c.kid.includes('police-gc8') && s10c.vis, `a highway police GC8 patrols the viaduct (${s10c.state}, ${s10c.kmh} km/h, lights off; ${s10c.kid.join('+')})`);
// 照一張巡邏車（旁邊、斜前面）
await p.evaluate(() => { const D = window.__D(), c = D.VDT.cars.find((q) => q.cop); window.__H.cam(c.obj.group, 4.6, 1.5, 3.4); });
perf.hwyPatrol = await drawAndShot('hwy-patrol');
await p.evaluate(() => { const D = window.__D(), c = D.VDT.cars.find((q) => q.cop); window.__H.cam(c.obj.group, -3.2, 3.6, -3.6); });
perf.hwyTop = await drawAndShot('hwy-patrol-top');

// 10d 被通緝（1★）→ 國道警察來追：亮燈、越來越近、看到你星星不會掉
await p.evaluate(() => { const D = window.__D(), t = D.drv.telemetry(); window.__pol().crime('cop', { x: t.x, z: t.z }); window.__s10d = { chase0: null, dMin: 1e9, dAt: [], lights: 0, wantedMin: 9, states: new Set() }; });
let s10d = null;
for (let k = 0; k < 24; k++) {
  s10d = await p.evaluate(() => {
    const D = window.__D(), T = D.VDT, V = D.VDV, pol = window.__pol(), H = window.__H, S = window.__s10d;
    H.drive(1, 20, 2.2, () => { const t = D.drv.telemetry(); for (const c of T.cars) { if (!c.cop || !c.chase) continue; const d = Math.hypot(c.x - t.x, c.z - t.z); if (d < S.dMin) S.dMin = d; if (c.lights) S.lights++; } S.wantedMin = Math.min(S.wantedMin, pol.state === 'wanted' ? pol.wanted : 0); S.states.add(pol.state); });
    H.medWatch(window.__s10);
    const ch = T.cars.filter((c) => c.cop && c.chase), t = D.drv.telemetry(), near = ch.length ? Math.min(...ch.map((c) => Math.hypot(c.x - t.x, c.z - t.z))) : null;
    if (S.chase0 == null && ch.length) S.chase0 = Math.round(near);
    S.dAt.push(near == null ? null : Math.round(near));
    return { n: ch.length, near: near == null ? null : Math.round(near), chase0: S.chase0, dMin: Math.round(S.dMin), lights: S.lights, wantedMin: S.wantedMin, wanted: pol.wanted, state: pol.state, states: [...S.states], info: T.info().cops, dAt: S.dAt, kmh: Math.round(t.kmh), s: Math.round(V.st.s)};
  });
  await p.waitForTimeout(40);
  if (s10d.near != null && s10d.near < 30 && k >= 6) break;
}
console.log('10d', el(), JSON.stringify(s10d));
check(s10d.info.chasing >= 1 && s10d.chase0 >= 150 && s10d.lights > 0, `wanted on the viaduct: a highway police GC8 comes after you with its lights on (first ${s10d.chase0} m away; ${s10d.info.chasers} new, ${s10d.info.chase} chases started)`);
check(s10d.near != null && s10d.near < 40 && s10d.dMin < 40, `it catches up with you while you drive at ${s10d.kmh} km/h (distance ${s10d.dAt.join(', ')} m)`);
check(s10d.info.seen > 0 && s10d.wantedMin >= 1 && s10d.states.length === 1 && s10d.state === 'wanted', `it can see you, so the stars stay (${s10d.wanted}★, lowest ${s10d.wantedMin}★; seen ${s10d.info.seen} frames)`);
// 照一張追你的警車（從你的車後面往後看）
await p.evaluate(() => { const D = window.__D(), T = D.VDT, t = D.drv.telemetry(), c = T.cars.filter((q) => q.cop && q.chase).sort((a, b) => Math.hypot(a.x - t.x, a.z - t.z) - Math.hypot(b.x - t.x, b.z - t.z))[0]; window.__H.cam(c.obj.group, 7.5, 2.2, 2.8); });
perf.hwyChase = await drawAndShot('hwy-chase');

// 10e 星星沒了：不追了（燈關掉、回到線上或停在旁邊）
const s10e = await p.evaluate(() => {
  const D = window.__D(), T = D.VDT, V = D.VDV, pol = window.__pol(), H = window.__H, g0 = T.copSt.gaveUp; pol.clear();
  H.drive(2, 20, 2.2);
  const cops = T.cars.filter((c) => c.cop), t = D.drv.telemetry();
  return { gave: T.copSt.gaveUp - g0, chasing: cops.filter((c) => c.chase).length, lit: cops.filter((c) => c.lights).length, states: cops.map((c) => c.state), joined: T.copSt.joined, cops: cops.map((c) => [c.state, c.chase, Math.round(c.cs ?? -1), +(c.cu ?? 0).toFixed(1), c.cdir, Math.round(Math.hypot(c.x - t.x, c.z - t.z))]), me: [Math.round(V.st.s), +V.st.u.toFixed(1)], crimes: pol.telemetry().crimes?.slice(-2), hits: T.copSt.hits };
});
console.log('10e', el(), JSON.stringify(s10e));
check(s10e.gave >= 1 && s10e.chasing === 0 && s10e.lit === 0, `stars cleared: it stops chasing, lights off (${s10e.gave} gave up; now ${s10e.states.join(', ')})`);

// 10f 撞到國道警察的車：1★
const s10f = await p.evaluate(() => {
  const D = window.__D(), T = D.VDT, V = D.VDV, pol = window.__pol(), H = window.__H, d = D.drv; pol.clear();
  H.stop(); const s = V.st.s, me = { x: d.telemetry().x, z: d.telemetry().z };
  let c = T.cars.find((q) => q.cop); if (!c) return { err: 'no cop' };
  const q = H.at(s + 30, 2.2); c.state = 'end'; c.chase = false; c.lights = false; c.line = null; c.v = 0; c.x = q.x; c.z = q.z; c.y = q.y + 0.02; c.h = q.h; c.pitch = 0;
  const h0 = T.copSt.hits; let k = 0, kmh = 0;
  for (; k < 300 && T.copSt.hits === h0; k++) { d.setInput({ throttle: 1, brake: 0, steer: 0 }); H.step(1); kmh = d.telemetry().kmh; }
  d.setInput(null); H.stop();
  return { hits: T.copSt.hits - h0, wanted: pol.wanted, state: pol.state, kmh: Math.round(kmh), crimes: pol.telemetry().crimes?.slice(-1), k, me };
});
console.log('10f', el(), JSON.stringify(s10f));
check(s10f.hits === 1 && s10f.wanted >= 1 && s10f.state === 'wanted', `crashing into a highway police car = ${s10f.wanted}★ (hit at ${s10f.kmh} km/h)`);

// 10g 你停下來、國道警察停在旁邊：被抓（「被國道警察抓到了！」），去拘留室
let s10g = null;
for (let k = 0; k < 30; k++) {
  s10g = await p.evaluate(() => {
    const D = window.__D(), T = D.VDT, pol = window.__pol(), H = window.__H;
    for (let i = 0; i < 20; i++) H.step(3, 1 / 60);
    const t = D.drv ? D.drv.telemetry() : null, ch = T.cars.filter((c) => c.cop && c.chase), near = t && ch.length ? Math.round(Math.min(...ch.map((c) => Math.hypot(c.x - t.x, c.z - t.z)))) : null;
    const txt = document.getElementById('stage')?.innerText || '';
    return { state: pol.state, wanted: pol.wanted, near, caught: T.copSt.caught, msg: /被國道警察抓到了/.test(txt) || /被國道警察抓到了/.test(document.body.innerText) };
  });
  await p.waitForTimeout(40);
  if (s10g.state !== 'wanted') break;
}
console.log('10g', el(), JSON.stringify(s10g));
check(s10g.caught >= 1 && s10g.state !== 'wanted' && s10g.msg, `stopped with the highway police next to you: caught (「被國道警察抓到了！」, police state ${s10g.state})`);
const s10 = await p.evaluate(() => window.__s10);
check(s10.minU >= 1.15 && s10.wrong === 0 && s10.n > 50, `cars on the main road never drive on the median (closest ${s10.minU} m from the middle${s10.minAt ? ' ' + JSON.stringify(s10.minAt) : ''}; ${s10.n} samples) and drive on the right side (${s10.wrong} going the wrong way${s10.wrongAt ? ' ' + JSON.stringify(s10.wrongAt) : ''})`);
console.log('10 perf', JSON.stringify({ hwyPatrol: perf.hwyPatrol, hwyTop: perf.hwyTop, hwyChase: perf.hwyChase }));

await b.close(); srv.close();
console.log(errs.length ? `page errors: ${errs.length}` : 'no page errors');
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' / ')}` : 'ALL CHECKS OK');
process.exit(fails.length || errs.length ? 1 : 0);
