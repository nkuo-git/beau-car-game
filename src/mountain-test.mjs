// 山（mountain.js）：開車上山、爬山計時賽、山頂走路、下山、越野車走捷徑、輾扁山上的東西、警察追上山（art/garage.html 整頁跑一次）
//   1 開局：「去山頂」的按鈕、山的大小（高度、山路多長）、路線、路面、警察的路網接上山路
//   2 GC8 從山腳開上山：爬山計時賽開始、到山頂停、記最快的（存檔）；車子貼著路面（高度）；看效能（山腳、半山、山頂）
//   3 山頂下車走路：腳下的高度、走到涼亭、觀景台的欄杆擋人
//   4 開下山：一路貼著路面、不會飛出去
//   5 換怪獸卡車：從泥土捷徑直接爬上山頂；輾扁山上的樹、護欄（扁在地上、不報警）；涼亭不輾
//   6 警察：通緝的時候警車追上山（車子貼著山坡）
// node mountain-test.mjs [prefix]（截圖 <prefix>-… .png）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = 'mountain'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__G = () => GAME; window.__S = () => S; window.__scene = () => scene;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__money = (n) => { GAME.money = n; save(true); renderWallet(); renderOptions(); refreshCarBtns(); };'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, trip, tripS, tripPose, tripFull, cur, walker, LODS, TR, PERF, indoor });'
  + ' window.__N = () => NPC; window.__C = () => crushFx; window.__pol = () => (typeof police !== "undefined" ? police : null);'
  + ' window.__HILL = () => HILL;'
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
// 開局：GC8＋怪獸卡車都有，1000 萬
await p.addInitScript(() => {
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 1000, owned: ['gc8', 'monster'], parts: {}, tyres: {}, wins: {}, cars: {} }));
  }
});
// 小幫手：上車、照著一條線開（看前面幾公尺的點轉方向盤，彎道前先慢下來）
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
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const dirAt = (P, k) => { const a = P[Math.max(0, k - 1)], b = P[Math.min(P.length - 1, k + 1)]; return Math.atan2(-(b[1] - a[1]), b[0] - a[0]); };
  // pts：[[x, z]…]（照開的方向）；開 secs 秒或開到最後一點（o.until(t) 提早停）
  H.follow = (pts, secs, o = {}) => {
    const D = window.__D(), d = D.drv, V = D.VIL, N = pts.length, t0 = d.telemetry();
    const r = { s: 0, maxKmh: 0, maxDY: 0, airT: 0, bumps0: t0.bumps, stuck: 0, end: false, minV: 99 };
    let i0 = 0, lx = t0.x, lz = t0.z, lt = 0;
    for (let n = 0; n < secs * 60; n++) {
      const t = d.telemetry();
      if (o.until && o.until(t)) { r.until = true; break; }
      let bi = i0, bd = Infinity;
      for (let k = i0; k < Math.min(N, i0 + 80); k++) { const e = (pts[k][0] - t.x) ** 2 + (pts[k][1] - t.z) ** 2; if (e < bd) { bd = e; bi = k; } }
      i0 = bi;
      if (i0 >= N - 2 && !o.until) { r.end = true; break; } // 有 until：開到最後一點附近繞，等 until
      const la = 5 + 0.45 * Math.abs(t.v); let acc = 0, k = i0;
      while (k < N - 1 && acc < la) { acc += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]); k++; }
      const a = wrap(Math.atan2(-(pts[k][1] - t.z), pts[k][0] - t.x) - t.heading);
      const steer = Math.max(-1, Math.min(1, -2.6 * a));
      let acc2 = 0, k2 = i0, turn = 0; const d0 = dirAt(pts, i0);
      while (k2 < N - 1 && acc2 < 10 + Math.abs(t.v) * 1.8) { acc2 += Math.hypot(pts[k2 + 1][0] - pts[k2][0], pts[k2 + 1][1] - pts[k2][1]); k2++; turn = Math.max(turn, Math.abs(wrap(dirAt(pts, k2) - d0))); }
      const vmax = o.vmax || 26, vt = turn > 1.3 ? 6.5 : turn > 0.8 ? 9 : turn > 0.4 ? 13 : turn > 0.2 ? 18 : vmax;
      let thr = 1, brk = 0;
      if (t.v > Math.min(vt, vmax) + 1) { thr = 0; brk = 1; } else if (t.v > Math.min(vt, vmax) - 1) thr = 0.35;
      d.setInput({ throttle: thr, brake: brk, steer }); H.step(1);
      const q = d.telemetry();
      r.maxKmh = Math.max(r.maxKmh, q.kmh); if (q.air) r.airT += 1 / 60;
      if (q.y != null && V.terrainAt(q.x, q.z)) { const dy = Math.abs(q.y - V.heightAt(q.x, q.z)); if (!q.air && dy > r.maxDY) r.maxDY = dy; }
      if (n > 120) r.minV = Math.min(r.minV, Math.abs(q.v));
      r.s += 1 / 60;
      if (r.s - lt > 4) { if (Math.hypot(q.x - lx, q.z - lz) < 2) r.stuck++; lt = r.s; lx = q.x; lz = q.z; }
    }
    d.setInput(null);
    const q = d.telemetry();
    Object.assign(r, { s: +r.s.toFixed(1), x: +q.x.toFixed(1), z: +q.z.toFixed(1), y: q.y != null ? +q.y.toFixed(2) : null, kmh: Math.round(q.kmh), bumps: q.bumps - r.bumps0, maxKmh: Math.round(r.maxKmh), maxDY: +r.maxDY.toFixed(2), airT: +r.airT.toFixed(2), i: i0, n: N });
    return r;
  };
  H.stop = () => { const d = window.__D().drv; d.setInput({ throttle: 0, brake: 1, steer: 0 }); for (let i = 0; i < 300 && Math.abs(d.telemetry().v) > 0.05; i++) H.step(1); d.setInput(null); H.step(20); return d.telemetry(); };
});

const summary = [];
// ================= 1 開局 =================
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
await p.waitForFunction(() => !!window.__S() && !window.__D().trip, null, { timeout: 300000 }); await p.waitForTimeout(2500);
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.waitForFunction(() => window.__D().tripPose && window.__D().tripPose[window.__D().cur], null, { timeout: 120000 });
const bd1 = await p.evaluate(() => window.__H.boardCar());
check(bd1.mode === 'off' && bd1.drv && bd1.cur === 'gc8', `got into the GC8 (${bd1.act})`);
const info = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, M = V.mountain, P = V.places.mountain, pk = M.park, pc = [(pk.x0 + pk.x1) / 2, (pk.z0 + pk.z1) / 2];
  const btn = document.querySelector('#dests button[data-d="mountain"]');
  const r = V.route(V.places.garage.spawn.x, V.places.garage.spawn.z, 'mountain'), last = r.pts[r.pts.length - 1];
  const rd = V.roads.find((q) => q.kind === 'mount'), mid = M.road.at(M.road.len / 2);
  const g = window.__pol()?.telemetry().graph;
  return { top: +M.top.toFixed(1), len: Math.round(M.road.len), place: P && P.name, btn: btn ? btn.textContent : null, rlen: Math.round(r.len), last: last.map((v) => +v.toFixed(1)), pos: P.pos,
    hTop: +V.heightAt(pc[0], pc[1]).toFixed(1), sRoad: V.surfaceAt(mid.x, mid.z), sPark: V.surfaceAt(pc[0], pc[1]), sTrail: V.surfaceAt(M.trail[4][0], M.trail[4][1]), sGrass: V.surfaceAt(mid.x + mid.tz * 14, mid.z - mid.tx * 14),
    road: rd ? { n: rd.pts.length, w: rd.w, noNpc: rd.noNpc } : null, graph: g, info: M.info, hVillage: V.heightAt(-250, -40), tVillage: V.terrainAt(-250, -40) };
});
console.log('1', el(), JSON.stringify(info));
check(info.btn === '去山頂', `the 「去山頂」 button is in the where-to list (${info.btn})`);
check(info.top >= 90 && info.top <= 130 && info.len >= 900, `the mountain is ${info.top} m high with ${info.len} m of road up`);
check(Math.abs(info.hTop - info.top) < 2, `the summit parking is at the top (${info.hTop} m)`);
check(info.place === '山頂' && Math.hypot(info.last[0] - info.pos[0], info.last[1] - info.pos[1]) < 1 && info.rlen > info.len, `「去山頂」 route from the garage ends at the summit (${info.rlen} m)`);
check(info.sRoad === 3 && info.sPark === 3 && info.sTrail === 5 && info.sGrass === 1, `surfaces: road/parking asphalt, dirt shortcut, grass (${info.sRoad}/${info.sPark}/${info.sTrail}/${info.sGrass})`);
check(!!info.road && info.road.noNpc === true && info.road.w === 9, 'the mountain road is in the road list (minimap, police) without traffic');
check(info.hVillage === 0 && !info.tVillage, 'the village is still flat (height 0, no terrain) next to the mountain');

// ================= 2 GC8 開上山：爬山計時賽 =================
const up = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, M = V.mountain, H = window.__H, R = M.road;
  let i = 0; while (R.s[i] < 20) i++;
  const p0 = R.at(20); D.drv.teleport({ x: p0.x, z: p0.z, heading: Math.atan2(-p0.tz, p0.tx) }); H.step(30); window.__pol()?.clear();
  document.querySelector('#dests button[data-d="mountain"]').click(); H.step(2);
  const t1 = D.drv.telemetry(), y0 = t1.y;
  const pts = V.route(t1.x, t1.z, 'mountain').pts;
  const pk = M.park, hill0 = { ...window.__HILL() };
  let started = null, fin = null;
  const r = H.follow(pts, 240, { vmax: 24, until: (t) => { const Hl = window.__HILL(); if (Hl.on && !started) started = { x: +t.x.toFixed(1), z: +t.z.toFixed(1) }; if (started && !Hl.on && !fin) fin = { vis: !!Hl.el && !Hl.el.hidden, txt: Hl.el ? Hl.el.textContent : null }; return !!started && !Hl.on && t.x > pk.x0 && t.x < pk.x1 && t.z > pk.z0 && t.z < pk.z1; } });
  const st = H.stop(), Hl = window.__HILL();
  return { r, dest: t1.dest, destDist: Math.round(t1.destDist), y0, started, on: Hl.on, t: +Hl.t.toFixed(2), best: window.__G().best.hill.gc8, el: fin && fin.txt, elVis: !!fin && fin.vis,
    y: +(st.y ?? -1).toFixed(2), hy: +V.heightAt(st.x, st.z).toFixed(2), zone: st.zone, hill0: hill0.on };
});
await p.waitForTimeout(800); up.saved = await p.evaluate(() => JSON.parse(localStorage.getItem('carid.tune')).best); // save() 等 0.3 秒才寫
console.log('2', el(), JSON.stringify(up));
check(up.dest === 'mountain' && up.destDist > 600, `「去山頂」 shows the way (${up.destDist} m to go)`);
check(!!up.started && up.r.until && up.best > 20 && up.best < 200, `hill-climb time trial: started at the gate, finished at the top in ${up.best} s (${up.r.maxKmh} km/h max, ${up.r.bumps} bumps)`);
check(up.saved && up.saved.hill && up.saved.hill.gc8 === up.best, 'the best time is saved');
check(/爬山計時賽/.test(up.el || '') && up.elVis, `the timer shows the result (${up.el})`);
check(up.r.maxDY < 0.6 && up.r.airT < 0.5 && up.r.stuck === 0, `the GC8 stays on the road surface all the way up (max ${up.r.maxDY} m off, ${up.r.airT} s in the air, stuck ${up.r.stuck})`);
check(up.y > 90 && Math.abs(up.y - up.hy) < 0.6, `parked at the summit at ${up.y} m (ground ${up.hy} m)`);
check(up.zone === 'mountain', `the summit zone is 「山頂」 (${up.zone})`);
// 效能：山頂往下看、半山、山腳（追車鏡頭）
const perf = {};
perf.top = await drawAndShot('1-summit');
// 再跑一次（比較慢）：不是新紀錄
const again = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, M = V.mountain, H = window.__H, R = M.road, p0 = R.at(30);
  D.drv.teleport({ x: p0.x, z: p0.z, heading: Math.atan2(-p0.tz, p0.tx) }); H.step(30);
  const p1 = R.at(10); D.drv.teleport({ x: p1.x, z: p1.z, heading: Math.atan2(-p1.tz, p1.tx) }); H.step(30);
  const t1 = D.drv.telemetry(), pts = V.route(t1.x, t1.z, 'mountain').pts, pk = M.park; let started = false;
  const r = H.follow(pts, 300, { vmax: 12, until: (t) => { const Hl = window.__HILL(); if (Hl.on) started = true; return started && !Hl.on; } });
  H.stop(); const Hl = window.__HILL();
  return { r, t: +Hl.t.toFixed(2), best: window.__G().best.hill.gc8, el: Hl.el.textContent };
});
console.log('  again (slow):', JSON.stringify(again));
check(again.r.until && again.t > up.best && again.best === up.best && /最快/.test(again.el), `a slower climb (${again.t} s) keeps the best time (${again.best} s)`);

// ================= 3 山頂下車走路 =================
const walk = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, M = V.mountain, H = window.__H, W = D.walker;
  const a2 = document.querySelector('#stage .dv-act2'); if (a2) a2.click();
  for (let i = 0; i < 600 && W.mode !== 'walk'; i++) H.step(1);
  const pv = M.pavilion, out = { mode: W.mode, hudHidden: window.__HILL().el.hidden };
  const gy = () => +W.character.group.position.y.toFixed(2);
  const t0 = W.telemetry(); out.y0 = gy(); out.h0 = +V.heightAt(t0.x, t0.z).toFixed(2);
  W.teleport({ x: pv.x - 9, z: pv.z, heading: 0 }); H.step(20);
  for (let i = 0; i < 300; i++) { const t = W.telemetry(), a = Math.atan2(-(pv.z - t.z), pv.x - t.x) - t.camYaw; W.setInput({ x: -Math.sin(a) * 0.7, y: Math.cos(a) * 0.7 }); H.step(1); }
  W.setInput(null); H.step(10);
  const t1 = W.telemetry(); out.pav = +Math.hypot(t1.x - pv.x, t1.z - pv.z).toFixed(1); out.y1 = gy(); out.h1 = +V.heightAt(t1.x, t1.z).toFixed(2);
  // 觀景台的欄杆：往南（下面是村子）一直走：會被擋住
  const s = M.summit; W.teleport({ x: (s.x0 + s.x1) / 2 - 10, z: s.z1 - 6, heading: -Math.PI / 2 }); H.step(20);
  for (let i = 0; i < 360; i++) { const t = W.telemetry(), a = -Math.PI / 2 - t.camYaw; W.setInput({ x: -Math.sin(a) * 1, y: Math.cos(a) * 1, run: true }); H.step(1); }
  W.setInput(null); H.step(10);
  const t2 = W.telemetry(); out.railZ = +t2.z.toFixed(1); out.edge = s.z1; out.yRail = gy();
  return out;
});
console.log('3', el(), JSON.stringify(walk));
check(walk.mode === 'walk' && Math.abs(walk.y0 - walk.h0) < 0.3 && walk.y0 > 90, `got out at the summit and stands on the ground (${walk.y0} m)`);
check(walk.hudHidden, 'the time-trial result goes away when you get out');
check(walk.pav < 4 && Math.abs(walk.y1 - walk.h1) < 0.3, `walked to the pavilion (${walk.pav} m from its middle)`);
check(walk.railZ < walk.edge + 1.5, `the viewpoint railing stops you at the edge (z ${walk.railZ}, edge ${walk.edge})`);
await p.evaluate(() => { const D = window.__D(), W = D.walker, c = D.dcam; window.__H.step(5); });
perf.view = await drawAndShot('2-viewpoint');

// ================= 4 開下山 =================
const bd2 = await p.evaluate(() => window.__H.boardCar());
check(bd2.mode === 'off' && bd2.drv, 'got back into the GC8 at the summit');
const down = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, M = V.mountain, H = window.__H, R = M.road;
  const t0 = D.drv.telemetry(), pr = R.project(t0.x, t0.z, 80);
  const pts = []; for (let i = R.n - 1; i >= 0; i -= 2) pts.push([R.x[i], R.z[i]]);
  const p0 = R.at(R.len - 8); D.drv.teleport({ x: p0.x, z: p0.z, heading: Math.atan2(p0.tz, -p0.tx) }); H.step(30);
  let mid = null;
  const r = H.follow(pts, 300, { vmax: 22, until: (t) => { if (!mid && R.project(t.x, t.z, 12).s < R.len * 0.5) { mid = true; window.__midShot = true; return true; } return false; } });
  return { r, mid };
});
console.log('4', el(), 'down to the middle:', JSON.stringify(down));
perf.mid = await drawAndShot('3-halfway');
const down2 = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, M = V.mountain, H = window.__H, R = M.road, t0 = D.drv.telemetry(), s0 = R.project(t0.x, t0.z, 12).s;
  const pts = []; for (let i = R.n - 1; i >= 0; i -= 2) if (R.s[i] <= s0 + 2) pts.push([R.x[i], R.z[i]]);
  const r = H.follow(pts, 300, { vmax: 22 }); const st = H.stop();
  return { r, x: +st.x.toFixed(1), z: +st.z.toFixed(1), y: st.y, hill: window.__HILL().on };
});
console.log('  down to the bottom:', JSON.stringify(down2));
check(down.r.until && down2.r.end && down2.z > -100, `drove down to the village (${down.r.s + down2.r.s} s, ${Math.max(down.r.maxKmh, down2.r.maxKmh)} km/h max)`);
check(Math.max(down.r.maxDY, down2.r.maxDY) < 0.6 && down.r.airT + down2.r.airT < 0.5 && down.r.stuck + down2.r.stuck === 0, `stays on the road going down too (max ${Math.max(down.r.maxDY, down2.r.maxDY)} m off, ${(down.r.airT + down2.r.airT).toFixed(2)} s in the air)`);
check(!down2.hill, 'driving down does not start the time trial');
perf.foot = await p.evaluate(() => { const D = window.__D(), H = window.__H; H.step(5); return null; });
perf.foot = await drawAndShot('4-foot');
summary.push(`GC8 up in ${up.best} s; perf summit ${JSON.stringify(perf.top)}, view ${JSON.stringify(perf.view)}, halfway ${JSON.stringify(perf.mid)}, foot ${JSON.stringify(perf.foot)}`);

// ================= 5 怪獸卡車：泥土捷徑、輾扁山上的東西 =================
await p.evaluate(() => { window.__hold = false; document.getElementById('driveHome').click(); });
await p.waitForFunction(() => !window.__D().on && !window.__D().trip, null, { timeout: 300000 });
await p.waitForTimeout(1500);
await p.evaluate(() => document.querySelector('#cars button[data-car="monster"]').click());
await p.waitForFunction(() => window.__D().cur === 'monster' && !!window.__S(), null, { timeout: 120000 });
await p.waitForTimeout(4000);
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.waitForFunction(() => window.__D().tripPose && window.__D().tripPose.monster && window.__C(), null, { timeout: 120000 });
const bd3 = await p.evaluate(() => window.__H.boardCar());
check(bd3.mode === 'off' && bd3.cur === 'monster' && bd3.drv, 'got into the monster truck');
const trail = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, M = V.mountain, H = window.__H, T = M.trail, s = M.summit;
  const pts = []; for (let i = 1; i < T.length; i++) { const l = Math.hypot(T[i][0] - T[i - 1][0], T[i][1] - T[i - 1][1]), n = Math.ceil(l / 2); for (let k = i === 1 ? 0 : 1; k <= n; k++) pts.push([T[i - 1][0] + (T[i][0] - T[i - 1][0]) * k / n, T[i - 1][1] + (T[i][1] - T[i - 1][1]) * k / n]); }
  const pk = M.park; pts.push([(pk.x0 + pk.x1) / 2, (pk.z0 + pk.z1) / 2]);
  D.drv.teleport({ x: T[0][0], z: T[0][1] + 6, heading: Math.atan2(-(T[1][1] - T[0][1]), T[1][0] - T[0][0]) }); H.step(30); window.__pol()?.clear();
  const C = window.__C(), c0 = { ...C.stats }, w0 = window.__pol()?.wanted || 0;
  const r = H.follow(pts, 200, { vmax: 16, until: (t) => t.x > s.x0 && t.x < s.x1 && t.z > s.z0 && t.z < s.z1 });
  const st = H.stop();
  return { r, y: +(st.y ?? -1).toFixed(1), surf: st.surface, big: C.stats.big - c0.big, wanted: (window.__pol()?.wanted || 0) - w0, hill: window.__HILL().on, best: window.__G().best.hill.monster ?? null };
});
console.log('5', el(), 'shortcut:', JSON.stringify(trail));
check(trail.r.until && trail.y > 90, `the monster truck climbs the dirt shortcut to the top (${trail.r.s} s, min speed ${trail.r.minV.toFixed ? trail.r.minV.toFixed(1) : trail.r.minV} m/s)`);
check(trail.wanted === 0, `crushing on the mountain is not a crime (${trail.big} things flattened on the way, stars +${trail.wanted})`);
const crush = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, M = V.mountain, H = window.__H, C = window.__C();
  const out = {};
  const ram = (kind) => {
    const t0 = D.drv.telemetry();
    const others = V.colliders.filter((q) => (q.h ?? 9) > 0.3 && Math.abs(q.x - t0.x) < 400 && Math.abs(q.z - t0.z) < 400);
    const clear = (c, sx, sz) => { // 開過去的那條線旁邊 2.6 公尺沒有別的東西
      for (const q of others) { if (q === c) continue; const vx = c.x - sx, vz = c.z - sz, l2 = vx * vx + vz * vz, u = Math.max(0, Math.min(1, ((q.x - sx) * vx + (q.z - sz) * vz) / l2)); const d = Math.hypot(sx + vx * u - q.x, sz + vz * u - q.z) - (q.t === 'circle' ? q.r : Math.max(q.hx, q.hz)); if (d < 2.6) return false; }
      return true;
    };
    let c = null, sx = 0, sz = 0;
    for (const q of M.colliders) {
      if (q.mt !== kind || q.crushed || q.noCrush) continue;
      const pr = M.road.project(q.x, q.z, 30); if (kind === 'rail' ? !(pr.d < 7) : !(pr.d > 12 && pr.d < 30)) continue;
      const a = M.road.at(pr.s), ux = q.x - a.x, uz = q.z - a.z, l = Math.hypot(ux, uz) || 1;
      const x = kind === 'rail' ? a.x - (ux / l) * 2 : q.x - (ux / l) * 8, z = kind === 'rail' ? a.z - (uz / l) * 2 : q.z - (uz / l) * 8;
      if (clear(q, x, z)) { c = q; sx = x; sz = z; break; }
    }
    if (!c) return { none: true };
    D.drv.teleport({ x: sx, z: sz, heading: Math.atan2(-(c.z - sz), c.x - sx) }); H.step(20);
    const b0 = C.stats.big + C.stats.props, w0 = window.__pol()?.wanted || 0;
    D.drv.setInput({ throttle: 0.8, brake: 0, steer: 0 }); for (let i = 0; i < 300 && !c.crushed; i++) H.step(1);
    D.drv.setInput({ throttle: 0, brake: 1, steer: 0 }); H.step(90); D.drv.setInput(null); H.step(120); // 壓下去（分幾幀）
    // 壓扁的頂點：最高的離地面多高（附近、在網格裡）
    let top = -9, low = 9, n = 0;
    V.group.getObjectByName('mountain').traverse((m) => {
      if (!m.isMesh || /mt-(hill|road|trail)/.test(m.name)) return; const P = m.geometry.attributes.position.array;
      for (let i = 0; i < P.length; i += 3) { const x = P[i], z = P[i + 2]; if (Math.hypot(x - c.x, z - c.z) > (kind === 'tree' ? 0.25 : 0.6)) continue; const g = V.heightAt(x, z), y = P[i + 1] - g; n++; if (y > top) top = y; if (y < low) low = y; }
    });
    const job = C.big.find((j) => j.grp.includes(c)); const jb = job ? { phase: job.phase, k: +job.k.toFixed(3), cand: job.cand.map((q) => q.m.name).join(','), segs: job.segs.map((g) => g.idx.length).join(','), grp: job.grp.length } : null;
    return { kind, job: jb, x: +c.x.toFixed(1), z: +c.z.toFixed(1), h: c.h, crushed: !!c.crushed, flat: C.stats.big + C.stats.props - b0, top: +top.toFixed(2), low: +low.toFixed(2), n, stars: (window.__pol()?.wanted || 0) - w0 };
  };
  out.tree = ram('tree'); out.rail = ram('rail');
  // 涼亭的柱子：輾不倒
  const pil = M.colliders.find((q) => q.mt === 'pavilion'); out.pavCan = C.can({ ...pil }); out.pavNoCrush = !!pil.noCrush;
  return out;
});
console.log('  crush:', JSON.stringify(crush));
check(crush.tree.crushed && crush.tree.flat > 0 && crush.tree.n > 0 && crush.tree.top < 1.2 && crush.tree.low > -0.4, `a mountain tree gets flattened onto the slope (top ${crush.tree.top} m above the ground, lowest ${crush.tree.low} m)`);
check(crush.rail.crushed && crush.rail.flat > 0 && crush.rail.top < 0.5 && crush.rail.low > -0.4, `a guardrail gets flattened onto the road (top ${crush.rail.top} m, lowest ${crush.rail.low} m)`);
check(crush.tree.stars === 0 && crush.rail.stars === 0, 'no stars for crushing on the mountain');
check(crush.pavNoCrush && !crush.pavCan, 'the pavilion cannot be crushed');
await drawAndShot('5-crushed');

// ================= 6 警察追上山 =================
const pol = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, M = V.mountain, H = window.__H, P = window.__pol(), R = M.road;
  const a = R.at(R.len * 0.35); D.drv.teleport({ x: a.x, z: a.z, heading: Math.atan2(-a.tz, a.tx) }); H.step(20);
  P.clear(); P.crime('hit', { x: a.x, z: a.z }); H.step(5);
  let best = Infinity, maxDY = 0, onM = 0, seen = 0;
  for (let i = 0; i < 60 * 45; i++) {
    H.step(1);
    if (i % 15) continue;
    const T = P.telemetry();
    for (const c of T.cars) {
      best = Math.min(best, Math.hypot(c.x - a.x, c.z - a.z));
      if (!M.inMountain(c.x, c.z)) continue;
      onM++;
      for (let k = 0; k < 3; k++) { const o = P.carObject(k); if (!o || Math.hypot(o.position.x - c.x, o.position.z - c.z) > 0.5) continue; seen++; maxDY = Math.max(maxDY, Math.abs(o.position.y - V.heightAt(o.position.x, o.position.z))); }
    }
  }
  const T = P.telemetry(); P.clear();
  return { wanted: T.wanted, state: T.state, best: +best.toFixed(1), onM, seen, maxDY: +maxDY.toFixed(2), graph: T.graph };
});
console.log('6', el(), 'police:', JSON.stringify(pol));
check(pol.onM > 0 && pol.best < 40, `police cars drive up the mountain road (closest ${pol.best} m, ${pol.onM} samples on the mountain)`);
check(pol.seen > 20 && pol.maxDY < 0.3, `police cars follow the slope (max ${pol.maxDY} m off the ground, ${pol.seen} samples)`);

console.log('==== summary ====');
for (const s of summary) console.log(' -', s);
console.log('page errors:', errs.length);
check(errs.length === 0, 'no page errors');
await b.close(); srv.close();
console.log(fails.length ? `FAILED ${fails.length}:\n - ${fails.join('\n - ')}` : 'ALL OK');
process.exit(fails.length ? 1 : 0);
