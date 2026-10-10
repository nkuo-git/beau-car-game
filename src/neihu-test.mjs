// 內湖（neihu.js）的測試：node neihu-test.mjs [截圖前綴 neihu-shots/nh]（要先 node build-art.mjs --yaris）
//   0 轉換程式再跑一次＝一模一樣的 neihu-data.js；1 載入（內湖蓋好了：房子、車站、路名）；2 出門上 GC8、七個目的地有「去內湖」；
//   3 機器人從車庫照「去內湖」的路線開到港墘站（直線加速賽道南邊的口、聯外道路、山谷、內湖路一段）、地圖資料的出處；
//   4 沿著內湖路一段往東、港墘路往北、再整條往南開（不卡住、大部分在那條路上）；4b 內湖的車流和走路的人（修 10）；5 房子擋車；6 下車走路（人行道、騎樓、房子擋人）；
//   7 截圖（路上、駕駛座、空拍、車站、學校、山邊、七個地標）＋ draw call／三角形；8 直接回車庫：小村莊放回來、出處、路名收起來）
//   地標（碧湖公園、內湖國小、麗山國中、港墘站、湖光教會、西湖圖書館、大港墘公園）的位置照 OSM、牌子、擋得住；大路的路名牌、HUD 的路名
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = 'neihu-shots/nh'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__R = () => race; window.__G = () => GAME; window.__S = () => S; window.__snd = () => snd; window.__room = () => room; window.__scene = () => scene; window.__controls = () => controls;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__money = (n) => { GAME.money = n; save(true); renderWallet(); renderOptions(); refreshCarBtns(); };'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, dvoice, trip, tripS, home, bayLock, snooze, TR, LODS, camGo, cur, built, walker, tripPose, tripFull, boarding,'
  + '   DECK, DREV, sleep, gcam, liftSnd, deliver, offDeck, runLift, midCar, normPark, CABIN_EYE });'
  + ' window.__N = () => NPC; window.__NMAX = () => NPC_MAX;'
  + ' window.__pol = () => (typeof police !== "undefined" ? police : null);' // 第 3 批（b3-int）：警察（開車的機器人不小心撞到人：星星清掉，見 leg）
  + ' window.__IN = () => ({ indoor, doorFade, HOUSE_WARM, interiorFor, buildInterior, DEALER_DOOR });'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } else if (window.__npcKeep) { NPC = window.__npcKeep; window.__npcKeep = null; NPC.g.visible = DRIVE.on; } };'
  + ' window.__look = () => LOOKP; window.__cam = () => ({ camCap, maxD: controls.maxDistance, fitD, dist: camera.position.distanceTo(controls.target), pos: camera.position.toArray() }); window.__cea = createEngineAudio; window.__camera = () => camera;'
  + ' window.__O = () => ({ orRace, oDisp, oLoading, dealerAt, trophies: trophyCount(), bigCam, lvl: orLevel(), PFULL });' // 第 4 批：越野賽、越野車行展示台、鏡頭、停在村子裡的完整的車（沒有輕量車的）
  + ' window.__CI = () => ({ race: ciRace, menu: ciMenuEl, cars: ciCars, sel: ciSel, P: VIL?.circuit, prof: circuitProfile, car: circuitCar, PERF, hp: hpOf(cur) });' // 賽車場
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
const txt = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, sel);
const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('carid.tune') || '{}'));
async function drawAndShot(name, fullPage = false) { // 畫兩格再截圖（開車、走路停住的時候畫的是現在的樣子）
  const n0 = await p.evaluate(() => { window.__noDraw = false; return window.__dframes || 0; });
  await p.waitForFunction((n) => (window.__dframes || 0) >= n + 2, n0, { timeout: 300000 });
  await p.evaluate(() => { window.__noDraw = true; });
  await p.screenshot({ path: `${prefix}-${name}.png`, fullPage });
  const ri = await p.evaluate(() => window.__rinfo());
  console.log('  shot', `${prefix}-${name}.png`, JSON.stringify(ri), el());
  return ri;
}
// 畫面上的按鈕：開車的 HUD（多了「下車」）、走路的 HUD（搖桿、上車／升降機／睡覺的大按鈕、小地圖、換視角、右下角的圓按鈕）、疊在畫面上的去哪裡／直接回車庫／聲音、
//   全螢幕鈕、比賽的 HUD：看得到的兩兩不重疊；全螢幕的時候都在螢幕裡面（離邊邊至少 4 px）
const HUD_SEL = ['.dv-chip', '.dv-act', '.dv-act2', '.dv-map', '.dv-cam', '.dv-spd', '.dv-steer', '.dv-brk', '.dv-gas', '.wk-chip', '.wk-act', '.wk-map', '.wk-cam', '.wk-stick', '.wk-btns', '.nh-road',
  '#dests', '#driveHome', '#dSndBtn', '#fsBtn', '#hud .trackbar', '#hud .tree', '#hud .clock', '#hud .gauge', '#hud .pedals', '#race'];
const hudClash = (inView = true) => p.evaluate(([inView, S]) => {
  const R = S.map((s) => [s, document.querySelector(s)]).filter(([, e]) => e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getClientRects().length)
    .map(([s, e]) => [s, e.getBoundingClientRect()]), out = [];
  if (inView) for (const [s, r] of R) if (s !== '#race' && (r.left < 4 || r.top < 4 || r.right > innerWidth - 4 || r.bottom > innerHeight - 4)) out.push(`${s} off-screen ${[r.left, r.top, r.right, r.bottom].map(Math.round)}`);
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const a = R[i][1], b = R[j][1]; if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) out.push(`${R[i][0]} × ${R[j][0]}`); }
  return out.join(' | ');
}, [inView, HUD_SEL]);
// 換幾種螢幕大小（窄的手機、大的手機、手機橫拿、電腦）量一次 hudClash（等兩格：搖桿、畫面跟著新的大小擺好），最後回到 390×844；only 只看跟這些有關的重疊
const SIZES = [[360, 800], [412, 915], [915, 412], [800, 360], [1280, 720]];
async function sizeSweep(inView = true, only = null) {
  const bad = [];
  for (const [w, h] of SIZES) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(250); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const c = (await hudClash(inView)).split(' | ').filter((x) => x && (!only || only.some((o) => x.includes(o))));
    if (c.length) bad.push(`${w}x${h}: ${c.join(', ')}`);
  }
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(250); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return bad.join(' / ');
}
// 開局：GC8＋YARIS、NT$ 1000 萬（買得起怪獸卡車 800 萬）；只有第一次載入才放（重新整理要看存的）
await p.addInitScript(() => {
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 0, owned: ['gc8', 'yaris'], parts: {}, tyres: {}, wins: {}, cars: {} }));
  }
});
// 開車的機器人（test-b1.mjs 的：照路線、彎道前煞車、路的盡頭停下來、路上有車靠右開、前面有車就煞車等）＋第 4 批的：
//   倒車（要去的方向在後面、頂到東西卡住了）、落地／飛多久／輪子壓進地面多少（有地形的時候 telemetry 才有）、越野賽（照賽道中線）；每一步花多久也記下來
await p.addInitScript(() => {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapA = (a) => { a = (a + Math.PI) % (2 * Math.PI); return a < 0 ? a + Math.PI : a - Math.PI; };
  const along = (pts, d) => { for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d <= l && l > 0) return [pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * d) / l, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * d) / l]; d -= l; } return pts[pts.length - 1]; };
  const plen = (pts) => pts.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0), 0);
  const inBox = (r, x, z, m = 0) => { const dx = x - r.x, dz = z - r.z, c = Math.cos(r.rot || 0), s = Math.sin(r.rot || 0); return Math.abs(dx * c - dz * s) <= r.hx + m && Math.abs(dx * s + dz * c) <= r.hz + m; };
  function targetSpeed(pts) { // 前面 250 公尺的彎：抓地 8 m/s²、煞車 6 m/s²；路的盡頭要停
    let prev = null; pts = pts.filter((q) => { if (prev && Math.hypot(q[0] - prev[0], q[1] - prev[1]) < 1) return false; prev = q; return true; });
    if (pts.length < 2) return 3;
    let best = Infinity, d = 0;
    for (let i = 1; i < pts.length - 1 && d < 250; i++) {
      const a = [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]], b = [pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]];
      d += Math.hypot(a[0], a[1]);
      const th = Math.abs(wrapA(Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0])));
      if (th < 0.06) continue;
      const R = Math.max(7, Math.min(Math.hypot(a[0], a[1]), Math.hypot(b[0], b[1])) / 2 / Math.tan(th / 2)), vc = Math.sqrt(8 * R);
      best = Math.min(best, Math.sqrt(vc * vc + 2 * 6 * Math.max(0, d - 4)));
    }
    return Math.min(best, Math.sqrt(3 * 3 + 2 * 5 * Math.max(0, plen(pts) - 2)));
  }
  const keepRight = (pts, off = 1.6, s0 = 15, s1 = 30) => { // 路上有別人的車：靠右開（路線是路中間）；出發 s0、終點 s1 公尺內慢慢回到路線上
    if (pts.length > 2 && Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) < 4.5) pts = pts.slice(1);
    const L = plen(pts); if (L < s0 + s1 + 10) return pts;
    const out = []; let acc = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const k = off * Math.min(1, s0 > 0 ? Math.max(0, (acc - s0) / 10) : 1, Math.max(0, (L - acc - s1) / 10));
      out.push([pts[i][0] - dz * k, pts[i][1] + dx * k]);
    }
    return out;
  };
  // 從停著的車旁邊過去（pass）：路線往 side 那邊（1 右、−1 左）多移 off 公尺，車身那一側的邊往前 len 公尺有沒有撞到村子的東西（房子、圍籬、電線桿、樹）
  const sideFree = (V, pts, o, hw, side, len = 16) => {
    const cols = V.colliders || [];
    for (let s = 0; s <= len; s += 1) {
      const a = along(pts, s), b = along(pts, s + 1); let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      for (const e of [o + side * hw, o + side * (hw - 0.6)]) {
        const x = a[0] - dz * e, z = a[1] + dx * e;
        for (const c of cols) if (c.t === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + 0.15 : inBox(c, x, z, 0.15)) return false;
      }
    }
    return true;
  };
  // 點 (x, z) 投影到路線 pts（前面 maxS 公尺內最近的一段）：{ s 沿著路線多遠, lat 離中線多少（右正，跟 keepRight 一樣）, dx, dz 那一段的方向 }
  const routeProj = (pts, x, z, maxS = 60) => {
    let best = null, acc = 0;
    for (let i = 1; i < pts.length && acc < maxS; i++) {
      const a = pts[i - 1], b = pts[i], ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez); if (L < 1e-6) continue;
      const dx = ex / L, dz = ez / L, u = Math.max(0, Math.min(L, (x - a[0]) * dx + (z - a[1]) * dz)), px = a[0] + dx * u, pz = a[1] + dz * u, e = Math.hypot(x - px, z - pz);
      if (!best || e < best.e) best = { e, s: acc + u, lat: (x - px) * -dz + (z - pz) * dx, dx, dz };
      acc += L;
    }
    return best;
  };
  const P = (window.__pp = { steer: 0, t: 0, maxKmh: 0, stuck: 0, lastT: 0, lx: 0, lz: 0, acts: [], bumps: 0, bumpAt: [], ms: 0, n: 0, lands: [], air: 0, pen: 0, rev: 0, revSteer: 0, revs: 0, slowT: 0, out2: 0, yields: 0, pass: null, passes: 0, passLog: [], thrMax: 0, lastT2: 0, lx2: 1e9, lz2: 1e9, pressed: 0 });
  P.inBox = inBox; P.plen = plen;
  // 倒車的後面有沒有空（路上的車、走路的人）：跟在你後面的車會停在你後面等，倒車不可以撞上去
  P.revFree = (t) => {
    const NP = window.__N && window.__N(); if (!NP || !NP.g.visible) return true;
    const ci = window.__D().drv.carInfo, f0 = Math.cos(t.heading), f1 = -Math.sin(t.heading), rx = t.x + f0 * ci.tail, rz = t.z + f1 * ci.tail, need = 1.5 + Math.max(0, -t.v) * 0.8;
    for (const c of NP.traffic.cars) { const dx = c.x - rx, dz = c.z - rz, al = -(dx * f0 + dz * f1), la = -dx * f1 + dz * f0; if (al > 0 && al - c.hx < need && Math.abs(la) < ci.halfW + c.hz + 0.3) return false; }
    for (const q of NP.peds.people) { if (q.gone) continue; const dx = q.x - rx, dz = q.z - rz, al = -(dx * f0 + dz * f1), la = -dx * f1 + dz * f0; if (al > -0.3 && al < need + 0.5 && Math.abs(la) < ci.halfW + 0.6) return false; }
    return true;
  };
  P.ev = []; P.ev1 = (what, t) => { P.ev.push([what, +P.t.toFixed(2), +t.x.toFixed(1), +t.z.toFixed(1), +t.heading.toFixed(2), +t.v.toFixed(1)]); if (P.ev.length > 40) P.ev.shift(); }; // 倒車、從旁邊過、撞到：什麼時候、在哪裡（看紀錄用）
  const step1 = () => { const c = performance.now(); window.__dstep(1); P.ms += performance.now() - c; P.n++; P.t += 1 / 60; };
  const watch = (t0, t2) => { // 落地、飛多久、輪子壓進地面多少
    if (!t2) return;
    if (t2.air) P.air += 1 / 60;
    if (t2.lands > (t0.lands || 0) && t2.land) P.lands.push({ speed: +t2.land.speed.toFixed(2), air: +t2.land.air.toFixed(2), hard: !!t2.land.hard, x: Math.round(t2.land.x), z: Math.round(t2.land.z) });
    if (t2.pen > P.pen) P.pen = t2.pen;
  };
  function drive1(d, t, pts, opt, tsPts = pts) {
    const ci = d.carInfo, c0 = (ci.nose + ci.tail) / 2, cx = t.x + Math.cos(t.heading) * c0, cz = t.z - Math.sin(t.heading) * c0;
    const la = along(pts, 5 + 0.45 * Math.abs(t.v)), a = wrapA(Math.atan2(-(la[1] - cz), la[0] - cx) - t.heading);
    // 倒車（停住了按著煞車會倒車）：要去的方向在後面（掉頭）、或頂到東西卡住了（樹、圍籬）：倒一段再往前
    if (P.rev > 0) { if (!P.revFree(t)) { P.rev = 0; P.ev1('rev-stop', t); } else { P.rev -= 1 / 60; P.steer = P.revSteer; return [0, 1]; } } // 後面有車、有人：不倒了
    if (Math.abs(a) > 1.9 && Math.abs(t.v) < 1.5 && P.revFree(t)) { P.rev = 2.4; P.revSteer = a > 0 ? 1 : -1; P.steer = P.revSteer; P.revs++; P.ev1('rev-turn', t); return [0, 1]; }
    if (opt.prop) P.steer = clamp(-2.5 * a, -1, 1); // 比例（大車、快速道路：不要左右甩）
    else if (a > 0.07) P.steer = -1; else if (a < -0.07) P.steer = 1; else if (Math.abs(a) < 0.025) P.steer = 0;
    let thr = 1, brk = 0; let vt = Math.min(targetSpeed(tsPts), opt.vmax || Infinity);
    if (Math.abs(a) > 1.1) vt = Math.min(vt, 4); // 要掉頭：先慢下來
    if (Math.abs(t.v) > vt + 1) { thr = 0; brk = 1; } else if (Math.abs(t.v) > vt - 1) thr = 0.3;
    return [thr, brk];
  }
  P.run = (dest, frames, until, opt = {}) => {
    for (let i = 0; i < frames; i++) {
      const D = window.__D(); if (!D.on || !D.drv) return { stop: true, t: P.t };
      const d = D.drv, V = D.VIL, t = d.telemetry();
      if (until()) { d.setInput(null); return { arrived: true, t: P.t }; }
      if (t.paused || t.auto) { d.setInput(null); step1(); watch(t, d.telemetry()); continue; }
      const act = d.action;
      if (act && (opt.act || []).includes(act) && P.t - (P.actT ?? -9) > 0.5) { P.actT = P.t; P.acts.push(act); document.querySelector('#stage .dv-act').click(); continue; }
      const ci = d.carInfo, c0 = (ci.nose + ci.tail) / 2, r = V.route(t.x + Math.cos(t.heading) * c0, t.z - Math.sin(t.heading) * c0, dest);
      const NP0 = window.__N && window.__N(), GL = V.places.garage.lot, gx = (t.x - GL.x) * Math.cos(GL.heading) - (t.z - GL.z) * Math.sin(GL.heading), gz = (t.x - GL.x) * Math.sin(GL.heading) + (t.z - GL.z) * Math.cos(GL.heading);
      const nearHome = gx > -14 && gx < 30 && Math.abs(gz) < 14; // 在你家、剛開出鐵捲門：路線照走（門窄），靠右慢慢來
      const off = V.offroad?.fenceDist ? V.offroad.fenceDist(t.x, t.z) > -5 : false; // 越野車場裡面（沒有路上的車）：照路線走
      const offR = Math.max(0.3, Math.min(1.6, 2.6 - ci.halfW)); // 靠右多少：寬的車（怪獸卡車 3.8 公尺）靠一點點就好，不然擦到路邊的房子
      const oPass = P.pass ? P.pass.side * P.pass.off : 0; // 正在從停著的車旁邊過：多靠過去一點
      const rp = NP0 && NP0.g.visible && !opt.center && !off ? keepRight(r.pts, offR + oPass, nearHome ? 15 : 0) : r.pts;
      let [thr, brk] = drive1(d, t, rp, opt);
      if (P.pass && P.rev <= 0) { if (t.v > (P.pass.pre ? 3.5 : 2.5)) { thr = 0; brk = 1; } else if (t.v < -0.3) { thr = 0.6; brk = 0; } else thr = Math.min(thr, 0.6); } // 從旁邊過：慢慢來（2.5 m/s）；剛倒完車還在往後滑：踩油門（倒車的時候油門＝煞車）停下來換前進
      const G = D.GAR, L = V.places.garage.lot;
      if (G && (opt.act || []).includes('開鐵捲門')) { // 鐵捲門還沒全開：在車庫裡、門前面等
        const c = Math.cos(L.heading), s = Math.sin(L.heading), dx = t.x - L.x, dz = t.z - L.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (G.door.t < 0.95 && lx > -13 && lx < 16 && Math.abs(lz) < 13) { thr = 0; brk = 1; }
      }
      if ((opt.bay && inBox(opt.bay, t.x, t.z)) || (opt.stopEnd !== false && r.len < 2.5)) { thr = 0; brk = 1; }
      const NP = window.__N && window.__N();
      if (NP && NP.g.visible && !opt.noYield && P.rev <= 0) { // 路上的車：車頭前面有車就煞車等（AI 車會開走、路口會讓你）
        const f0 = Math.cos(t.heading), f1 = -Math.sin(t.heading), ci2 = d.carInfo, c2 = (ci2.nose + ci2.tail) / 2, mx = t.x + f0 * c2, mz = t.z + f1 * c2, look = ci2.len / 2 + 5 + Math.abs(t.v) * 1.3;
        const long = P.waitT != null && P.t - P.waitT < 0.1 && P.t - (P.wait0 ?? P.t) > 6; let hit = null, hAl = Infinity;
        if (P.pass) { // 正在從停著的車旁邊過：牠到後面了、不見了、20 秒了 → 回到平常
          const c = P.pass.c, al = (c.x - mx) * f0 + (c.z - mz) * f1;
          let gone = false; // 先靠邊的：照路線量（跟開始的時候一樣）牠轉走了（不是對向）、離開這條路、離很遠了
          if (P.pass.pre) { const q = routeProj(r.pts, c.x, c.z, 70); gone = !q || q.s > 60 || q.lat > 0.3 || q.lat < -7 || Math.cos(c.heading - Math.atan2(-q.dz, q.dx)) > -0.5; }
          if (!NP.traffic.cars.includes(c) || gone || al < -(ci2.len / 2 + c.hx + 0.5) || P.t - P.pass.t0 > 20) { P.passLog.push({ key: c.key, s: +(P.t - P.pass.t0).toFixed(1), done: al < 0 }); P.pass = null; P.ev1('pass-end', t); }
        }
        // 大車（怪獸卡車）看到對向來車（還在開、45 公尺內）：會佔到牠那一線（牠會停下來等你、兩台僵住）→ 先往右靠、慢下來讓牠過（像人開大車）
        if (!P.pass && ci2.halfW > 1.3) for (const c of NP.traffic.cars) {
          if (Math.abs(c.v) < 0.5 || Math.hypot(c.x - mx, c.z - mz) > 50) continue;
          const q = routeProj(r.pts, c.x, c.z, 50); // 照路線量（彎道上用車頭方向量不準）：牠在路線前面多遠、離路中線多少（右正）、方向跟路線相反
          if (!q || q.s < ci2.len / 2 || q.s > 45 || q.lat > -0.5 || q.lat < -6 || Math.cos(c.heading - Math.atan2(-q.dz, q.dx)) > -0.8) continue;
          let need = ci2.halfW + c.hz + 0.6 + q.lat - offR; if (need <= 0.05) continue; // 你的左邊（offR＋need−半寬）要離牠那一線（q.lat）牠的半寬＋0.6
          const ok0 = ci2.halfW + c.hz + 0.15 + q.lat - offR; // 至少不會擦到（身體隔 0.15 公尺）
          while (need > 0.3 && !sideFree(V, r.pts, offR + need, ci2.halfW, 1, Math.min(40, q.s + 10))) need -= 0.2;
          if (need > Math.max(0.3, ok0) && need < 2.2) { P.pass = { c, side: 1, off: need, t0: P.t, pre: true }; P.passes++; P.ev1('pass-pre', t); P.passLog.push({ key: c.key, pre: 1, lat: +q.lat.toFixed(2), off: +need.toFixed(2), s: +q.s.toFixed(1), at: [+t.x.toFixed(1), +t.z.toFixed(1)] }); }
          break;
        }
        for (const c of NP.traffic.cars) {
          const dx = c.x - mx, dz = c.z - mz, al = dx * f0 + dz * f1, la = -dx * f1 + dz * f0, moving = Math.abs(c.v || 0) > 0.5; if (!moving && long) continue;
          if (P.pass && !moving && la * P.pass.side < 0) continue; // 正在從旁邊過：那一邊停著的車（停下來等你過的、排在牠後面的）不用等
          if (al > 0 && al < (moving ? look : ci2.len / 2 + 2 + Math.abs(t.v) * 1.3) + c.hx && Math.abs(la) < ci2.halfW + c.hz + (moving ? 0.5 : 0.2) && al < hAl) { hit = c; hAl = al; }
        }
        // 僵住了：前面斜對面的車停下來等你（你的車太寬（怪獸卡車 3.8 公尺），佔到牠那一線：blockedBy 1）、你也在等牠 → 像人一樣往另一邊靠（右邊：寬的車開上路肩），慢慢從旁邊過去
        //   只有對向的車（同方向的是排隊、橫的是路口：照等）；別的停著的對向車（不是等你的）等 4 秒；要移太多不過去；那一邊有東西（村子的碰撞）就少移一點；離太近先倒一段
        if (hit && !P.pass && Math.abs(hit.v) < 0.5 && Math.abs(t.v) < 0.5 && Math.cos(hit.heading - t.heading) < -0.5 && (P.waitT != null && P.t - P.waitT <= 0.5 ? P.t - P.wait0 : 0) > (hit.blockedBy === 1 ? 1.5 : 4)) {
          const dx = hit.x - mx, dz = hit.z - mz, al = dx * f0 + dz * f1, la = -dx * f1 + dz * f0, side = la < 0 ? 1 : -1, o0 = offR;
          let need = ci2.halfW + hit.hz + 0.6 - Math.abs(la);
          while (need > 0.3 && !sideFree(V, r.pts, o0 + side * need, ci2.halfW, side)) need -= 0.2;
          if (need > Math.max(0.3, ci2.halfW + hit.hz + 0.15 - Math.abs(la)) && need < 2.8 && Math.abs(la) > 0.4) {
            const gap = al - ci2.len / 2 - hit.hx;
            P.pass = { c: hit, side, off: need, t0: P.t }; P.passes++; hit = null;
            P.ev1('pass', t); P.passLog.push({ key: P.pass.c.key, by: P.pass.c.blockedBy, la: +la.toFixed(2), off: +need.toFixed(2), gap: +gap.toFixed(1), at: [+t.x.toFixed(1), +t.z.toFixed(1)] });
            if (gap < 6 && P.revFree(t)) { P.rev = 2.4; P.revSteer = 0; P.revs++; P.ev1('rev-pass', t); } // 離太近：先倒一段（才轉得過去）
          }
        }
        if (hit) { thr = 0; brk = Math.abs(t.v) > 0.3 ? 1 : 0; if (P.waitT == null || P.t - P.waitT > 0.5) P.wait0 = P.t; P.waitT = P.t; P.yields++;
          const dx = hit.x - mx, dz = hit.z - mz; P.blk = { key: hit.key, kind: hit.kind, x: +hit.x.toFixed(1), z: +hit.z.toFixed(1), v: +hit.v.toFixed(2), al: +(dx * f0 + dz * f1).toFixed(1), la: +(-dx * f1 + dz * f0).toFixed(1), by: hit.blockedBy, t: +P.t.toFixed(1), me: [+t.x.toFixed(1), +t.z.toFixed(1), +t.heading.toFixed(2)], long }; }
        else if (long || P.t - (P.waitT ?? -99) < 1) { thr = Math.abs(t.v) > 3 ? 0 : Math.min(thr, 0.35); } // 剛等完：慢慢起步
      }
      const bb = t.bumps;
      d.setInput({ throttle: thr, brake: brk, steer: P.steer }); step1();
      const t2 = window.__D().drv?.telemetry(); if (!t2) return { stop: true, t: P.t };
      watch(t, t2);
      const waiting = P.t - (P.waitT ?? -99) < 3;
      P.thrMax = Math.max(P.thrMax, thr);
      if (P.t - P.lastT2 > 4) { // 慢慢起步（等完了、從旁邊過）卻 4 秒沒動：頂到東西了（停著的車、圍籬）→ 倒一段再來
        if (Math.hypot(t2.x - P.lx2, t2.z - P.lz2) < 0.3 && P.thrMax > 0.2 && P.rev <= 0 && !(G && G.door.moving)) { P.rev = 1.6; P.revSteer = 0; P.revs++; P.pressed++; P.ev1('rev-pressed', t2); }
        P.lastT2 = P.t; P.lx2 = t2.x; P.lz2 = t2.z; P.thrMax = 0;
      }
      if (thr > 0.5 && Math.abs(t2.v) < 0.3 && !waiting) { if ((P.slowT += 1 / 60) > 1.2) { P.slowT = 0; P.rev = 1.6; P.revSteer = P.steer > 0.2 ? -1 : 1; P.revs++; P.ev1('rev-slow', t2); } } else P.slowT = 0; // 踩油門卻不動：頂到東西了
      P.maxKmh = Math.max(P.maxKmh, t2.kmh);
      if (t2.bumps > bb) { P.bumps++; const NB = window.__N && window.__N(); let nd = Infinity; if (NB) for (const c of NB.traffic.cars) nd = Math.min(nd, Math.hypot(c.x - t2.x, c.z - t2.z)); P.bumpAt.push({ x: +t2.x.toFixed(1), z: +t2.z.toFixed(1), v: +t.v.toFixed(1), npc: +nd.toFixed(1) }); P.ev1('bump', t2); } // 撞到哪裡（旁邊最近的路上的車多遠）
      if (Math.abs(t2.v) > 1.5 && window.__D().drv.action2) P.out2++; // 開著的時候不可以有「下車」
      if (P.t - P.lastT > 3) { if (Math.hypot(t2.x - P.lx, t2.z - P.lz) < 1.5 && !(G && G.door.moving) && !waiting) P.stuck++; P.lastT = P.t; P.lx = t2.x; P.lz = t2.z; }
    }
    return { arrived: false, t: P.t };
  };
  // 越野賽：倒數的時候不踩；出發了照賽道中線（前面 45 公尺的彎決定開多快）；跑完（done）、取消（off）就停
  P.race = (frames, o) => {
    for (let i = 0; i < frames; i++) {
      const D = window.__D(), R = window.__O().orRace; if (!R || R.state === 'done' || R.state === 'off' || !D.drv) return { end: R ? R.state : 'gone', t: P.t };
      const d = D.drv, t = d.telemetry(), CR = D.VIL.offroad.course;
      if (R.state === 'run' && !t.paused && !t.auto) {
        const ci = d.carInfo, c0 = (ci.nose + ci.tail) / 2, cx = t.x + Math.cos(t.heading) * c0, cz = t.z - Math.sin(t.heading) * c0;
        const pr = CR.project(cx, cz, P.hint ?? -1); P.hint = pr.i;
        const c = CR.at(pr.s + 7 + 0.45 * Math.abs(t.v)); let vm = o.vcap;
        for (let s = 0; s < 45; s += 3) { const k = Math.abs(CR.at(pr.s + s).k); if (k > 1e-4) vm = Math.min(vm, Math.sqrt(o.lat / k) + s * 0.35); }
        const a = wrapA(Math.atan2(-(c.z - cz), c.x - cx) - t.heading), e = vm - t.v;
        d.setInput({ throttle: e > 0 ? clamp(e * 0.5, 0, 1) : 0, brake: e < -1.5 ? clamp(-e * 0.25, 0, 1) : 0, steer: clamp(-a * 2.2, -1, 1) });
      }
      step1(); const t2 = window.__D().drv?.telemetry(); watch(t, t2);
      if (t2) P.maxKmh = Math.max(P.maxKmh, t2.kmh);
      if (window.__raceShotAt && R.time >= window.__raceShotAt) { window.__raceShotAt = 0; return { pause: true, t: P.t }; }
    }
    return { end: null, t: P.t };
  };
});
// 走路的小工具（在頁面跑；跟 walk-test.mjs 一樣的走法：setInput 跟著鏡頭轉，一格一格走）
// 注意：window.__D() 是叫的那一刻的快照（dvoice、drv、boarding⋯）：按了按鈕、走了幾格以後要再叫一次
await p.addInitScript(() => {
  const wrapA = (a) => { a = (a + Math.PI) % (2 * Math.PI); return a < 0 ? a + Math.PI : a - Math.PI; };
  const H = (window.__H = { wrapA }), W = () => window.__D().walker, step = (n = 1) => window.__wstep(n);
  H.step = step;
  // 走到 (x, z)（世界）：m＝推多少；到了 tol 以內停；卡住 3 秒就放棄
  H.walkTo = (x, z, { m = 0.7, run = undefined, tol = 0.35, max = 40 } = {}) => {
    const w = W(); let t = w.telemetry(), n = 0, stuck = 0, lx = t.x, lz = t.z;
    for (; n < max * 60; n++) {
      t = w.telemetry(); const dx = x - t.x, dz = z - t.z, d = Math.hypot(dx, dz);
      if (d < tol) break;
      const a = Math.atan2(-dz, dx) - t.camYaw; // 鏡頭座標：往前＝cos、往右＝−sin
      w.setInput({ x: -Math.sin(a) * m, y: Math.cos(a) * m, run });
      step(1);
      if (n % 60 === 59) { if (Math.hypot(t.x - lx, t.z - lz) < 0.2) stuck++; else stuck = 0; lx = t.x; lz = t.z; if (stuck >= 3) break; }
    }
    w.setInput({ x: 0, y: 0 }); step(20); w.setInput(null);
    t = w.telemetry(); return { ok: Math.hypot(x - t.x, z - t.z) < tol + 0.3, x: t.x, z: t.z, s: n / 60, stuck };
  };
  H.walkPath = (pts, o) => { let r = null; for (const q of pts) { r = H.walkTo(q[0], q[1], o); if (!r.ok) return { ...r, at: q }; } return r; };
  // 村子的房子 b：站在正面外面（離門 1.4 公尺：門的觸發範圍外面），往房子推 1.5 秒 → 最後在不在房子的長方形裡面（村子的碰撞在＝擋在牆外）
  H.wallHolds = (b) => {
    const w = W(), d = b.door, nx = -Math.sin(d.ry), nz = -Math.cos(d.ry), tx = Math.cos(d.ry), tz = -Math.sin(d.ry);
    const side = (b.x - d.x) * tx + (b.z - d.z) * tz >= 0 ? 1 : -1, off = Math.min(1.4, b.hx - 0.5), sx = d.x + tx * off * side - nx, sz = d.z + tz * off * side - nz, dir = Math.atan2(-nz, nx);
    w.teleport({ x: sx, z: sz, heading: dir }); step(5);
    const r = H.push(dir, 1.5, 0.8), dx = r.x - b.x, dz = r.z - b.z, c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0);
    return { moved: +r.d.toFixed(2), inside: Math.abs(dx * c - dz * s) < b.hx && Math.abs(dx * s + dz * c) < b.hz };
  };
  // 在房子裡面：這一層的出口 e 前面 1.4 公尺（房間這邊）朝出口推，推到門口開始黑掉為止
  H.toExit = (e) => {
    const w = W(), d = e.door, nx = -Math.sin(d.ry), nz = -Math.cos(d.ry), dir = Math.atan2(-nz, nx);
    w.teleport({ x: d.x - nx * 1.4, z: d.z - nz * 1.4, heading: dir }); step(5);
    let n = 0; for (; n < 240 && !window.__IN().doorFade; n++) { const t = w.telemetry(), a = dir - t.camYaw; w.setInput({ x: -Math.sin(a) * 0.6, y: Math.cos(a) * 0.6 }); step(1); }
    w.setInput(null); return { s: +(n / 60).toFixed(2), fade: !!window.__IN().doorFade };
  };
  // 村子裡的門（walker.doors 的一個）：站到門外 2 公尺朝門推，推到開始黑掉為止
  H.toDoor = (d) => {
    const w = W(), nx = -Math.sin(d.ry), nz = -Math.cos(d.ry), dir = Math.atan2(-nz, nx);
    w.teleport({ x: d.ax - nx * 2, z: d.az - nz * 2, heading: dir }); step(20);
    let n = 0; for (; n < 240 && !window.__IN().doorFade; n++) { const t = w.telemetry(), a = dir - t.camYaw; w.setInput({ x: -Math.sin(a) * 0.7, y: Math.cos(a) * 0.7 }); step(1); }
    w.setInput(null); return { s: +(n / 60).toFixed(2), fade: !!window.__IN().doorFade };
  };
  // 在房子裡面的樣子（這一層）
  H.inInfo = () => {
    const D = window.__D(), X = window.__IN(), w = W(), I = X.indoor?.I, t = w.telemetry(), N = window.__N && window.__N();
    if (!I) return { in: false, mode: t.mode, mine: w.character.group.parent === D.TR.scene, fade: !!X.doorFade };
    const e = document.querySelector('#stage .wk-toast'), f = document.querySelector('#stage .sleep-fade');
    return { in: true, name: I.name, kind: I.kind, floors: I.floors.length, floor: I.floor, x: t.x, z: t.z, mode: t.mode, paused: t.paused, hud: H.visible('#stage .wk'), near: t.near,
      mine: w.character.group.parent === X.indoor.scene, doors: w.doors.length === I.exits.length && w.doors.every((d) => I.exits.some((x) => x.door === d.ref)),
      toast: e && e.classList.contains('show') ? e.textContent : '', fadeShown: !!f && getComputedStyle(f).display !== 'none', mov: N ? N.MOV.length : 0, meFar: N ? N.me.x === 1e6 : true, info: I.info, cam: I.camera, dist: w.cameraDist };
  };
  // 一直往某個世界方向推 s 秒
  H.push = (dirA, s, m = 1, run) => {
    const w = W(), t0 = w.telemetry(); let vmax = 0;
    for (let i = 0; i < s * 60; i++) { const t = w.telemetry(), a = dirA - t.camYaw; w.setInput({ x: -Math.sin(a) * m, y: Math.cos(a) * m, run }); step(1); vmax = Math.max(vmax, w.telemetry().speed); }
    w.setInput(null); const t1 = w.telemetry();
    return { d: Math.hypot(t1.x - t0.x, t1.z - t0.z), vmax, x: t1.x, z: t1.z };
  };
  // 車庫本地 ↔ 世界
  H.gl = (x, z) => { const L = window.__D().VIL.places.garage.lot, c = Math.cos(L.heading), s = Math.sin(L.heading), dx = x - L.x, dz = z - L.z; return { x: dx * c - dz * s, z: dx * s + dz * c }; };
  H.gw = (x, z, h = 0) => { const L = window.__D().VIL.places.garage.lot, c = Math.cos(L.heading), s = Math.sin(L.heading); return { x: L.x + x * c + z * s, z: L.z - x * s + z * c, heading: h + L.heading }; };
  H.walkLocal = (pts, o) => H.walkPath(pts.map(([x, z]) => { const w = H.gw(x, z); return [w.x, w.z]; }), o);
  // HUD：看得到的大按鈕（走路的或開車的）、開車的第二顆（下車）
  const vis = (e) => !!e && !e.hidden && !e.closest('[hidden]') && e.getClientRects().length > 0;
  H.visible = (sel) => vis(document.querySelector(sel));
  const act = () => [...document.querySelectorAll('#stage .wk-act, #stage .dv-act')].find(vis);
  H.actText = () => { const e = act(); return e ? e.querySelector('span').textContent : null; };
  H.press = () => { const e = act(); if (!e) return null; const s = e.querySelector('span').textContent; e.click(); return s; };
  H.act2 = () => { const e = document.querySelector('#stage .dv-act2'); return vis(e) ? e.querySelector('span').textContent : null; };
  H.press2 = () => { const e = document.querySelector('#stage .dv-act2'); if (!vis(e)) return null; const s = e.querySelector('span').textContent; e.click(); return s; };
  // 按了「上車」：等走到車門、坐進去（walk.js mode off）
  H.board = (maxS = 8) => { const w = W(), modes = []; let n = 0; for (; n < maxS * 60; n++) { step(1); modes.push(w.mode); if (w.mode === 'off') break; } return { modes: [...new Set(modes)], s: n / 60 }; };
  // 碰撞物（測試自己算）：村子＋車庫（照門）＋走路可以上的車（walk.js 的清單：跟畫面上的車比過）＋透天厝正面凸出來的（只擋鏡頭）
  H.cols = () => {
    const D = window.__D(), G = D.GAR, V = D.VIL;
    const cars = W().cars.map((c) => { const hc = Math.cos(c.heading), hs = Math.sin(c.heading), cx = c.cx || 0, cz = c.cz || 0; return { t: 'box', x: c.x + cx * hc + cz * hs, z: c.z - cx * hs + cz * hc, hx: c.hx, hz: c.hz, rot: c.heading, h: 1.4 }; });
    const fr = V.buildings.filter((b) => b.floors >= 2 && (b.kind === 'house' || b.kind === 'shop')).map((b) => ({ t: 'box', x: b.x + Math.sin(b.rot) * (b.hz + 0.56), z: b.z + Math.cos(b.rot) * (b.hz + 0.56), hx: b.hx, hz: 0.56, rot: b.rot, y0: 2.7, h: b.h }));
    return [...V.colliders, ...G.colliders(G.door.t >= 0.55, true), ...cars, ...fr];
  };
  H.inside = (cols, x, y, z, m = 0) => { // 點在不在碰撞物裡面（xz 往外 m、高度 y0…h）
    for (const c of cols) {
      if (y > (c.h ?? 9) + m || y < (c.y0 || 0) - m) continue;
      if (c.t === 'box') { const dx = x - c.x, dz = z - c.z, r = c.rot || 0, u = Math.abs(dx * Math.cos(r) - dz * Math.sin(r)), w = Math.abs(dx * Math.sin(r) + dz * Math.cos(r)); if (m > 0 ? Math.hypot(Math.max(0, u - c.hx), Math.max(0, w - c.hz)) < m : u < c.hx + m && w < c.hz + m) return c; }
      else if (Math.hypot(x - c.x, z - c.z) < c.r + m) return c;
    }
    return null;
  };
  H.checkFrame = (cols) => { // 人卡進擋人的東西、鏡頭在東西裡面、頭到鏡頭中間有牆
    const w = W(), t = w.telemetry(), cam = window.__D().dcam, R = w.character.radius, bad = [];
    const body = cols.find((c) => (c.y0 || 0) < 1.7 && H.inside([c], t.x, 1, t.z, R - 0.03));
    if (body) bad.push(`body in ${body.t} (${body.x.toFixed(1)},${body.z.toFixed(1)}) h${body.h}`);
    const q = cam.position, hit = H.inside(cols, q.x, q.y, q.z, 0.1);
    if (hit) bad.push(`camera in ${hit.t} (${hit.x.toFixed(1)},${hit.z.toFixed(1)}) h${hit.h}`);
    if (t.camMode === 'follow' && !hit) {
      const ax = t.x, ay = Math.min(w.character.height * 0.9 + 0.2, 1.78), az = t.z; // walk.js：鏡頭繞的那一點最高 AY_MAX 1.78
      for (let k = 1; k < 20; k++) { const f = k / 20, c = H.inside(cols, ax + (q.x - ax) * f, ay + (q.y - ay) * f, az + (q.z - az) * f, -0.05); if (c && (c.h ?? 9) > 1.9) { bad.push(`wall between head and camera (${c.x.toFixed(1)},${c.z.toFixed(1)})`); break; } }
    }
    return bad;
  };
});
const resetP = () => p.evaluate(() => { const P = window.__pp; P.maxKmh = 0; P.stuck = 0; P.bumps = 0; P.bumpAt = []; P.acts = []; P.ms = 0; P.n = 0; P.lands = []; P.air = 0; P.pen = 0; P.revs = 0; P.rev = 0; P.slowT = 0; P.out2 = 0; P.yields = 0; P.pass = null; P.passes = 0; P.passLog = []; P.pressed = 0; P.lastT2 = P.t; P.lx2 = 1e9; P.lz2 = 1e9; P.thrMax = 0; return P.t; });
const pStats = () => p.evaluate(() => { const P = window.__pp, N = window.__N && window.__N(); return { stuck: P.stuck, max: P.maxKmh, bumps: P.bumps, bumpAt: P.bumpAt, acts: P.acts, ms: P.n ? P.ms / P.n : 0, n: P.n, lands: P.lands, air: P.air, pen: P.pen, revs: P.revs, out2: P.out2, yields: P.yields, passes: P.passes, passLog: P.passLog, pressed: P.pressed,
  npc: N ? `${N.traffic.cars.length} cars, ${N.peds.people.filter((q) => !q.gone).length} people` : 'off' }; });
let polClr = 0; // 第 3 批（b3-int）：開車的時候警察的星星清掉幾次
async function leg(dest, untilSrc, opt = {}, maxS = 200) {
  const t0 = await resetP();
  let r = null;
  for (let s = 0; s < maxS; s++) {
    r = await p.evaluate(([d, u, o]) => window.__pp.run(d, 60, new Function(`return (${u})`), o), [dest, untilSrc, opt]);
    polClr += await p.evaluate(() => { const P = window.__pol?.(); if (!P || !P.wanted) return 0; P.clear(); return 1; }); // 第 3 批（b3-int）：機器人不小心撞到人 → 警察會來抓（警察在 test-b3.mjs 測）：這裡清掉、記下來
    if (r.arrived || r.stop) break;
  }
  await p.evaluate(() => window.__D().drv?.setInput(null));
  const s = await pStats();
  if (!r.arrived && !r.stop) console.log('  last blocked by:', JSON.stringify(await p.evaluate(() => window.__pp.blk || null)), '| now', JSON.stringify(await p.evaluate(() => { const t = window.__D().drv?.telemetry(); return t && { x: +t.x.toFixed(1), z: +t.z.toFixed(1), h: +t.heading.toFixed(2), v: +t.v.toFixed(2), gear: t.gear, bumps: t.bumps }; })));
  console.log(`  leg → ${dest}: ${r.arrived ? 'arrived' : r.stop ? 'stopped (drive handed over)' : 'NOT ARRIVED'} after ${(r.t - t0).toFixed(1)} s sim${polClr ? ` · police stars cleared ${polClr}× so far (robot hit someone)` : ''} · max ${s.max.toFixed(0)} km/h · bumps ${s.bumps} · stuck ${s.stuck} · waited for traffic ${(s.yields / 60).toFixed(1)} s (${s.npc}) · pressed ${s.acts.join(',') || '-'}${s.bumpAt.length ? ' · bumped at ' + JSON.stringify(s.bumpAt) : ''} · reversed ${s.revs}×${s.passes ? ` · passed a stopped car ${s.passes}× ${JSON.stringify(s.passLog)}` : ''}${s.pressed ? ` · pressed against something ${s.pressed}×` : ''} · 下車 while moving ${s.out2} · ${s.ms.toFixed(2)} ms/step (${s.n}) · air ${s.air.toFixed(1)} s · lands ${s.lands.length}${s.lands.length ? ' max ' + Math.max(...s.lands.map((l) => l.speed)).toFixed(1) + ' m/s' : ''} · pen ${s.pen.toFixed(3)}`, el());
  return { ...r, ...s };
}
const driveInfo = () => p.evaluate(() => {
  const D = window.__D(), t = D.drv?.telemetry(), S = window.__S();
  return { on: D.on, trip: D.trip, cls: document.body.className, cur: D.cur, dest: t?.dest, paused: t?.paused, x: t && +t.x.toFixed(2), z: t && +t.z.toFixed(2), h: t && +t.heading.toFixed(3), kmh: t && Math.round(t.kmh),
    carParent: S.car.parent === D.TR?.scene ? 'town' : S.car.parent === window.__scene() ? 'garage' : String(S.car.parent?.type), voice: !!D.dvoice?.alive, action: D.drv?.action ?? null, action2: D.drv?.action2 ?? null,
    rideOn: t?.rideOn ?? null, rcls: t?.cls ?? null, brake: t && +t.brake.toFixed(3), walk: D.walker?.mode, toast: document.querySelector('#stage .dv-toast')?.textContent || '' };
});
const lodAt = () => p.evaluate(() => { // 升降機上的車掛在平台（room.interior 底下）上：也算在車庫裡
  const D = window.__D(), R = window.__room(), under = (o, g) => { for (let q = o; q; q = q.parent) if (q === g) return true; return false; };
  return Object.fromEntries(Object.entries(D.LODS).map(([k, L]) => [k, !L.lod ? 'loading' : !L.lod.car.parent ? '-' : R && under(L.lod.car, R.interior) ? 'page' : D.GAR && under(L.lod.car, D.GAR.interior) ? 'town-garage' : L.lod.car.parent === D.VIL?.group ? 'dealer' : 'other']));
});
// 升降機的平台上掛了什麼（room.js 的 lf.cars：Object3D＝車子、字串＝名牌、null＝空的）：沒有輕量車的車不可以變成空平台上的名牌
const plates = (where) => p.evaluate((w) => { const D = window.__D(), R = w === 'page' ? window.__room() : D.GAR; return R.lifts.flatMap((lf) => lf.cars.map((c) => (c == null ? null : typeof c === 'string' ? 'plate:' + c : c.isObject3D ? 'car' : String(c)))).filter((c) => c && c !== 'car'); }, where);
const shotAt = async (name, pose, cam = 'chase', o = {}) => { // 車子放到 pose（世界），鏡頭照 cam 擺好（走幾格），截圖
  await p.evaluate(([pose, cam, o]) => { const D = window.__D(), d = D.drv; if (pose) d.teleport(pose); d.setCameraMode(cam === 'air' ? 'none' : cam); if (o.v) d.setInput({ throttle: 0, brake: 0, steer: 0 }); window.__dstep(o.steps ?? 40);
    if (cam === 'air') { const c = D.dcam; c.position.set(...o.at); c.lookAt(...o.look); c.updateMatrixWorld(true); } }, [pose, cam, o]);
  const ri = await drawAndShot(name);
  await p.evaluate(() => window.__D().drv.setCameraMode('chase'));
  return ri;
};


// ==== 0 轉換程式（node）：再跑一次＝一樣的資料（日期不算）====
{
  const osm = path.join(dir, 'data/neihu3.osm.gz');
  if (!fs.existsSync(osm)) console.log('0 skip: no', osm);
  else {
    const out = path.join(os.tmpdir(), `neihu-data-${process.pid}.js`), t = Date.now();
    const log = execFileSync(process.execPath, [path.join(dir, 'neihu-conv.mjs'), osm, '--out', out], { encoding: 'utf8' });
    const norm = (f) => fs.readFileSync(f, 'utf8').replace(/（\d{4}-\d\d-\d\d 轉換）/, '').replace(/"made":"[\d-]+",/, '');
    const same = norm(out) === norm(path.join(dir, 'neihu-data.js')); fs.rmSync(out, { force: true });
    console.log('0 converter:', log.trim().split('\n').slice(-1)[0]);
    check(same, `converter re-run on neihu3.osm reproduces neihu-data.js (${Date.now() - t} ms)`);
  }
}

// ==== 1 載入 ====
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
await p.waitForFunction(() => window.__D().LODS.yaris?.lod, null, { timeout: 300000 }); await p.waitForTimeout(500);
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
const I1 = await p.evaluate(() => { const V = window.__D().VIL, N = V.neihu, I = V.info.neihu;
  const lm = {}; for (const [k, v] of Object.entries(N.data.lm)) { let x = 0, z = 0; for (const q of v.p) { x += q[0]; z += q[1]; }
    const c = [x / v.p.length - I.at[0], z / v.p.length - I.at[1]]; // 本地座標（跟 OSM 比）
    const near = V.colliders.filter((q) => Math.hypot(q.x - (c[0] + I.at[0]), q.z - (c[1] + I.at[1])) < 90).length;
    lm[k] = { nm: v.nm, c: [Math.round(c[0] * 10) / 10, Math.round(c[1] * 10) / 10], sign: !!v.sign, parts: Object.keys(v).filter((q) => q !== 'nm' && q !== 'sign' && q !== 'p').length, cols: near }; }
  return { info: I, st: N.data.stations.map((s) => s.nm), nsigns: N.data.nsigns.map((s) => s.nm), names: N.names.length, hasRoads: ['港墘路', '內湖路一段', '文德路', '環山路二段'].filter((n) => N.names.some((q) => q[0] === n)),
    place: V.places.neihu, box: I.box, bounds: V.bounds, mapBounds: V.mapBounds, credit: !!document.querySelector('.nh-credit'), lm,
    bigRoads: [...new Set(N.data.roads.filter((r) => r.nm >= 0 && r.w + 2 * r.sw >= 10).map((r) => N.names[r.nm][0]))] }; });
console.log('1', el(), JSON.stringify(I1));
check(I1.info && I1.info.buildings > 3000 && I1.info.meshes < 260 && I1.info.colliders > 5000, `neihu built: ${I1.info?.buildings} buildings, ${I1.info?.meshes} meshes, ${I1.info?.tris} tris, ${I1.info?.colliders} colliders, ${I1.info?.ms} ms`);
check(I1.st.includes('港墘') && I1.st.includes('文德') && I1.hasRoads.length === 4 && I1.nsigns.some((n) => /麗山高中/.test(n)), `stations ${I1.st.join('、')}; street names ${I1.hasRoads.join('、')} (+${I1.names - 4}); school/park signs incl. 麗山高中 (${I1.nsigns.length})`);
// 七個地標：位置跟 OSM 一樣（±3 公尺）、有牌子、擋得住（neihu3.osm 量出來的本地座標，見 land-work/cent.mjs）
const LM_OSM = { bihu: [682.3, -304.4], nhps: [384.7, -41.8], lishan: [-146.7, -307.3], dgq: [-326.5, 114.1], lib: [46.2, 76.6], church: [157, 106.8], mrt: [-174.3, -67.9] };
{
  const miss = [], far = [], noSign = [], noCol = [];
  for (const [k, q] of Object.entries(LM_OSM)) { const L = I1.lm[k];
    if (!L) { miss.push(k); continue; }
    const d = Math.hypot(L.c[0] - q[0], L.c[1] - q[1]); if (d > 3) far.push(`${k} ${d.toFixed(1)} m`);
    if (!L.sign) noSign.push(k); if (L.cols < 3) noCol.push(k); }
  check(!miss.length && !far.length, `seven landmarks at their OSM places (max off ${far.length ? far.join(', ') : '≤3 m'}${miss.length ? '; missing ' + miss.join(',') : ''})`);
  check(!noSign.length && !noCol.length, `每個地標都有名字的牌子、擋得住${noSign.length ? '; no sign: ' + noSign.join(',') : ''}${noCol.length ? '; no colliders: ' + noCol.join(',') : ''}`);
  console.log('  landmarks', JSON.stringify(I1.lm));
}
check(I1.info.bigSigns > 60 && I1.bigRoads.length >= 10 && I1.bigRoads.includes('港墘路') && I1.bigRoads.includes('內湖路一段'), `big road-name signs: ${I1.info.bigSigns} on ${I1.bigRoads.length} roads ≥ 10 m wide (${I1.bigRoads.slice(0, 6).join('、')}…)`);
check(I1.box[2] - I1.box[0] > 1700 && I1.box[3] - I1.box[1] > 1300 && I1.mapBounds && I1.mapBounds.x1 < 1300, `whole export used: ${(I1.box[2] - I1.box[0]).toFixed(0)} × ${(I1.box[3] - I1.box[1]).toFixed(0)} m; minimap base layer keeps the old bounds`);

// ==== 2 上 GC8、去內湖 ====
const w2 = await p.evaluate(() => { const D = window.__D(), H = window.__H, W = D.walker; W.teleport(H.gw(-4.6, -7.7, -1.05)); H.step(20); const r = H.walkLocal([[-2.6, -2.6], [-0.6, -2.3]]); return { ok: r.ok, act: H.actText() }; });
const bd2 = await p.evaluate(() => { const H = window.__H, pressed = H.press(), r = H.board(); H.step(40); const D = window.__D(); return { pressed, modes: r.modes, drv: !!D.drv, act: H.actText() }; });
console.log('2', el(), JSON.stringify(w2), JSON.stringify(bd2));
check(w2.ok && bd2.drv && bd2.act === '開鐵捲門', 'walked to GC8 and got in');
const pills = await p.evaluate(() => [...document.querySelectorAll('#dests button')].map((b) => b.dataset.d + ':' + b.textContent));
check(pills.length === 8 && pills.includes('neihu:去內湖') && pills.includes('mountain:去山頂') && pills[pills.length - 1] === 'garage:回車庫', `eight destination pills with 去內湖 and 去山頂 (${pills.join(' ')})`);
await p.evaluate(() => document.querySelector('#dests button[data-d="neihu"]').click());
await p.evaluate(() => window.__dstep(5));
const d2 = await p.evaluate(() => { const t = window.__D().drv.telemetry(); return { dest: t.dest, dist: t.destDist, chip: document.querySelector('#stage .dv-chip')?.textContent, pressed: document.querySelector('#dests button[data-d="neihu"]').getAttribute('aria-pressed') }; });
console.log('  dest', JSON.stringify(d2));
check(d2.dest === 'neihu' && d2.pressed === 'true' && d2.dist > 1200 && d2.dist < 2800 && /內湖/.test(d2.chip), `去內湖 selected: route ${(d2.dist / 1000).toFixed(2)} km, chip 「${d2.chip}」`);

// ==== 3 開到內湖（港墘站）====
const shots = {};
const L3 = await leg('neihu', '(() => { const t = window.__D().drv.telemetry(); return t.zone === "neihu" && Math.abs(t.v) < 3; })()', { act: ['開鐵捲門'] }, 600);
const a3 = await p.evaluate(() => { const D = window.__D(), t = D.drv.telemetry(), c = document.querySelector('.nh-credit'), N = D.VIL.neihu;
  return { x: t.x, z: t.z, zone: t.zone, inside: N.inside(t.x, t.z), road: N.roadName(t.x, t.z), credit: c && !c.hidden ? c.textContent : null, seen: !!D.home?.nh, said: !!D.home?.nhs, hidden: D.VIL.group.children.filter((o) => !o.visible).map((o) => o.name) }; });
console.log('3', el(), JSON.stringify(a3));
check(L3.arrived && L3.stuck === 0, `drove from the garage to 內湖 by itself (${L3.t.toFixed(0)} s sim, max ${L3.max.toFixed(0)} km/h, stuck ${L3.stuck}, bumps ${L3.bumps}, ${L3.ms.toFixed(2)} ms/step)`);
check(a3.inside && a3.credit === '地圖資料 © OpenStreetMap 貢獻者' && a3.seen && a3.said, `in 內湖 at 港墘站 (${a3.road}): 「${a3.credit}」 shown, arrival toasts said`);
check(a3.hidden.length > 10, `far world (village tiles ${a3.hidden.length}) not drawn while in 內湖`);
shots.arrive = await drawAndShot('3-arrive-gangqian');

// ==== 4 內湖路一段往東、回到港墘路南端、港墘路整條往北 ====
const T4 = await p.evaluate(() => {
  const V = window.__D().VIL, N = V.neihu, nm = (s) => N.names.findIndex((q) => q[0] === s), ND = N.data.nodes, nx = (i) => ND[i * 2], nz = (i) => ND[i * 2 + 1];
  const nodesOf = (s) => { const k = nm(s); return N.data.roads.filter((r) => r.nm === k).flatMap((r) => r.n).filter((i) => N.inBox(nx(i), nz(i), 40)).map((i) => [nx(i), nz(i)]); };
  const g = nodesOf('港墘路'), e = nodesOf('內湖路一段');
  const T = { 'nh:e': e.reduce((a, b) => (b[0] > a[0] ? b : a)), 'nh:n': g.reduce((a, b) => (b[1] < a[1] ? b : a)), 'nh:s': g.reduce((a, b) => (b[1] > a[1] ? b : a)) };
  window.__nhT = T; const r0 = V.route; V.__route0 = r0;
  V.route = (x, z, d) => (d && d.startsWith('nh:') ? N.routeTo(x, z, T[d][0], T[d][1]) : r0(x, z, d)); // 測試用的目的地
  // 開的時候每半秒記一下在哪條路上
  const P = window.__pp, run0 = P.run; window.__roadLog = [];
  P.run = (d, f, u, o) => { const r = run0(d, f, u, o); const t = window.__D().drv.telemetry(); window.__roadLog.push(N.roadName(t.x, t.z)); return r; };
  return T;
});
console.log('4 targets', JSON.stringify(T4));
// 內湖路一段往東開到底 → 放回港墘站（港墘路口旁邊）→ 港墘路往南開到底 → 港墘路整條往北開
for (const [k, road, label] of [['nh:e', '內湖路一段', 'east along 內湖路一段'], ['nh:s', '港墘路|內湖路一段', 'from 港墘站 south to the end of 港墘路'], ['nh:n', '港墘路', 'north along the whole 港墘路']]) {
  if (k === 'nh:s') await p.evaluate(() => { const D = window.__D(), sp = D.VIL.places.neihu.spawn; D.drv.teleport({ x: sp.x, z: sp.z, heading: sp.heading }); window.__dstep(30); });
  await p.evaluate(() => { window.__roadLog = []; });
  const L = await leg(k, `(() => { const t = window.__D().drv.telemetry(), q = window.__nhT['${k}']; return Math.hypot(t.x - q[0], t.z - q[1]) < 14; })()`, {}, 300);
  const log = await p.evaluate(() => window.__roadLog), on = log.filter((r) => road.split('|').includes(r)).length / Math.max(1, log.length), ri = await drawAndShot(`4-${k.slice(3)}-${road.split("|")[0]}`);
  console.log(`  ${label}: ${log.length} samples, on ${road} ${(on * 100).toFixed(0)}%, roads ${[...new Set(log)].join(',')}`, JSON.stringify(ri));
  check(L.arrived && L.stuck === 0 && on > 0.5, `drove ${label} (${L.t.toFixed(0)} s, max ${L.max.toFixed(0)} km/h, stuck ${L.stuck}, bumps ${L.bumps}, ${(on * 100).toFixed(0)}% on ${road})`);
  // HUD 的路名（.nh-road）：停下來的地方在哪條路上就寫哪條（最多 0.25 秒更新一次）
  await p.evaluate(() => new Promise((r) => setTimeout(r, 320)));
  await p.evaluate(() => window.__dstep(2));
  const hr = await p.evaluate(() => { const e = document.querySelector('.nh-road'), t = window.__D().drv.telemetry(); return { txt: e && !e.hidden ? e.textContent : null, road: window.__D().VIL.neihu.roadName(t.x, t.z) }; });
  check(hr.txt === hr.road && !!hr.txt, `HUD road label 「${hr.txt}」 matches the road under the car (${hr.road})`);
}
// HUD 的路名在開車、走路、各種螢幕大小都不會壓到別的東西
const sw4 = await sizeSweep(true);
check(!sw4, `HUD (incl. the road-name label) does not overlap at any size: ${sw4 || 'none'}`);

// ==== 4b 修 10（2026-10-10）：內湖的車流、走路的人（npc.js 用 neihu.js 的 V.npcRoads：單行道一條車道、人走人行道）====
const G4 = await p.evaluate(() => {
  const N = window.__N(), V = window.__D().VIL, E = N.traffic.graph.edges, W = N.peds.graph;
  const pre = E.filter((e) => e.pre), live = pre.filter((e) => !e.dead), lanes = live.filter((e) => !e.conn);
  const noNext = live.filter((e) => !e.next.length).length, toDead = E.filter((e) => e.next.some((q) => q.dead)).length;
  const ow = V.npcRoads.filter((r) => r.ow).length;
  const nhSide = W.edges.filter((e) => e.kind === 'side' && V.neihu.inside(e.pts[0][0], e.pts[0][1])).length;
  const onCar = W.edges.filter((e) => e.kind === 'side' && V.neihu.inside(e.pts[0][0], e.pts[0][1]) && e.pts.some((q) => V.npcOnRoad(q[0], q[1]))).length;
  return { roads: V.npcRoads.length, ow, pre: pre.length, live: live.length, lanes: lanes.length, km: +(lanes.reduce((a, e) => a + e.len, 0) / 1000).toFixed(1), noNext, toDead, nhSide, onCar, load: N.load };
});
console.log('4b graph', JSON.stringify(G4));
check(G4.roads > 150 && G4.ow > 10 && G4.lanes > 300 && G4.km > 25 && G4.noNext === 0 && G4.toDead === 0 && G4.live > G4.pre * 0.8,
  `內湖 roads for traffic: ${G4.roads} (${G4.ow} one-way), ${G4.lanes} lanes / ${G4.km} km kept (${G4.pre - G4.live} dead-end lanes dropped); every kept lane leads on, none into a dropped one; graphs ${G4.load.graphs} ms`);
check(G4.nhSide > 500 && G4.onCar === 0, `內湖 sidewalks for people: ${G4.nhSide} pieces, none on a car lane (also where a big road is drawn as two one-way halves)`);
const A4 = await p.evaluate(() => {
  const D = window.__D(), N = window.__N(), V = D.VIL, W = N.peds.graph, sp = V.places.neihu.spawn; window.__pol()?.clear();
  D.drv.teleport({ x: sp.x, z: sp.z, heading: sp.heading }); window.__dstep(5);
  const k0 = N.peds.stats.knocks, h0 = N.hits; let vs = 0, vn = 0, offRoad = 0, cars = 0, ppl = 0, onLane = 0, minC = 99, minP = 99, avg = 0;
  for (let k = 0; k < 10; k++) { window.__dstep(120);
    const cs = N.traffic.cars.filter((c) => c.active && V.neihu.inside(c.x, c.z)), ps = N.peds.people.filter((q) => V.neihu.inside(q.x, q.z));
    if (k >= 4) { minC = Math.min(minC, cs.length); minP = Math.min(minP, ps.length); }
    cars += cs.length; ppl += ps.length;
    for (const c of cs) { vs += c.v; vn++; const s = V.surfaceAt(c.x, c.z); if (s !== 0 && s !== 3) offRoad++; }
    for (const q of ps) if (q.mode === 'walk' && q.rn && W.edges[q.route[q.ri]].kind === 'side' && V.npcOnRoad(q.x, q.z)) onLane++;
  }
  avg = N.avg;
  return { minC, minP, kmh: +(vs / Math.max(1, vn) * 3.6).toFixed(1), offRoad, onLane, samples: [cars, ppl], knocks: N.peds.stats.knocks - k0, hits: N.hits - h0, avg: +avg.toFixed(2), max: +N.max.toFixed(1), stuckGone: N.traffic.stats.stuckGone };
});
console.log('4b in 內湖', JSON.stringify(A4));
check(A4.minC >= 4 && A4.kmh > 15 && A4.offRoad === 0, `cars drive in 內湖 now (at least ${A4.minC} around you, ${A4.kmh} km/h on average, ${A4.offRoad} off the road)`);
check(A4.minP >= 5 && A4.onLane === 0, `people walk in 內湖 now (at least ${A4.minP} around you), on the sidewalks (${A4.onLane} walking in a car lane; they only step on the road at crossings)`);
check(A4.knocks === 0 && A4.hits === 0 && A4.avg < 1.5, `nobody gets hit while you wait (knocks ${A4.knocks}); cars + people ${A4.avg} ms/frame on average (max ${A4.max} ms)`);
shots.nhTraffic = await drawAndShot('4b-neihu-traffic');
const B4 = await p.evaluate(() => { // 回村子：內湖的車和人收掉，村子的車又出來
  const D = window.__D(), N = window.__N(), V = D.VIL; D.drv.teleport(V.places.garage.spawn); window.__dstep(600);
  return { nh: N.traffic.cars.filter((c) => c.active && V.neihu.inside(c.x, c.z)).length + N.peds.people.filter((q) => V.neihu.inside(q.x, q.z)).length, vil: N.traffic.cars.filter((c) => c.active).length };
});
console.log('4b back home', JSON.stringify(B4));
check(B4.nh === 0 && B4.vil >= 4, `back in the village: 內湖's cars and people are put away (${B4.nh} left) and the village has traffic again (${B4.vil} cars)`);
await p.evaluate(() => { const D = window.__D(), sp = D.VIL.places.neihu.spawn; D.drv.teleport({ x: sp.x, z: sp.z, heading: sp.heading }); window.__dstep(30); window.__pol()?.clear(); });

// ==== 5 房子擋車：找一面臨路的牆（中間沒有別的東西），對著開過去油門踩到底 ====
const b5 = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, N = V.neihu, d = D.drv, ci = d.carInfo, t0 = d.telemetry(), cols = V.colliders;
  const inC = (c, x, z, m) => c.t === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + m : (() => { const dx = x - c.x, dz = z - c.z, r = c.rot || 0; return Math.abs(dx * Math.cos(r) - dz * Math.sin(r)) < c.hx + m && Math.abs(dx * Math.sin(r) + dz * Math.cos(r)) < c.hz + m; })();
  let pick = null;
  for (const b of N.data.bld) {
    if (b.back || !b.col || b.core || b.f < 3) continue; const P = b.P, n = P.length;
    for (let i = 0; i < n && !pick; i++) {
      if (b.e[i] !== 1) continue; const a = P[i], c = P[(i + 1) % n], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 9) continue;
      const ox = (c[1] - a[1]) / L, oz = -(c[0] - a[0]) / L, mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, sx = mx + ox * 16, sz = mz + oz * 16;
      if (Math.hypot(sx - t0.x, sz - t0.z) > 900) continue;
      let clear = true; // 車身寬 2.4 公尺的走廊：中間不可以有別的碰撞物（樹、柱子、牌子）
      for (let s = 0.6; s < 16 && clear; s += 0.5) for (const w of [-1.2, 0, 1.2]) { const x = mx + ox * s - oz * w * -1, z = mz + oz * s + ox * w * -1; for (const k of cols) { if (Math.abs(k.x - x) > 30 || Math.abs(k.z - z) > 30) continue; if (inC(k, x, z, 0.1)) { clear = false; break; } } if (!clear) break; }
      if (clear) pick = { mx, mz, ox, oz, sx, sz, a, c, hdg: Math.atan2(oz, -ox) }; // heading：前進＝(cos h, −sin h)＝往牆（−o）
    }
    if (pick) break;
  }
  if (!pick) return null;
  d.teleport({ x: pick.sx, z: pick.sz, heading: pick.hdg }); window.__dstep(10);
  const bumps0 = d.telemetry().bumps; let vmax = 0;
  for (let i = 0; i < 300; i++) { d.setInput({ throttle: 1, brake: 0, steer: 0 }); window.__dstep(1); vmax = Math.max(vmax, Math.abs(d.telemetry().v)); }
  d.setInput(null); window.__dstep(30); const t = d.telemetry();
  const nose = [t.x + Math.cos(t.heading) * ci.nose, t.z - Math.sin(t.heading) * ci.nose], depth = (nose[0] - pick.mx) * pick.ox + (nose[1] - pick.mz) * pick.oz; // 車頭在牆外多遠（＞0＝外面）
  return { pick: [+pick.mx.toFixed(1), +pick.mz.toFixed(1)], vmax: +vmax.toFixed(1), v: +t.v.toFixed(2), depth: +depth.toFixed(2), bumps: t.bumps - bumps0, road: N.roadName(pick.sx, pick.sz) };
});
console.log('5', el(), JSON.stringify(b5));
check(!!b5 && b5.vmax > 8 && b5.depth > -0.6 && b5.depth < 1.6 && Math.abs(b5.v) < 1.5 && b5.bumps > 0, `building wall stops the car (hit at ${b5?.vmax} m/s, nose ${b5?.depth} m outside the wall, bumped ${b5?.bumps}×)`);
shots.wall = await drawAndShot('5-building-blocks');

// ==== 6 下車走路：人行道、騎樓、房子擋人 ====
const w6 = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, N = V.neihu, H = window.__H, d = D.drv, out = {};
  // 港墘站前（內湖路一段的人行道）停好下車
  const st = N.data.stations.find((s) => s.nm === '港墘'), sp = V.places.neihu.spawn; d.teleport({ x: sp.x, z: sp.z, heading: sp.heading }); window.__dstep(30);
  out.out = H.press2(); H.step(90); const W = D.walker; out.mode = W.mode;
  // (a) 走 40 公尺（照路網，路邊）
  const t0 = W.telemetry(), r = N.routeTo(t0.x, t0.z, t0.x + Math.cos(sp.heading) * 45, t0.z - Math.sin(sp.heading) * 45);
  const pts = r.pts.slice(2).filter((q) => Math.hypot(q[0] - sp.x, q[1] - sp.z) > 6); out.walk = H.walkPath(pts, { m: 1, max: 40 }); out.walkLen = +r.len.toFixed(1); // 車子旁邊那幾點不要（車子擋人）
  // (b) 騎樓：找最近一棟有騎樓的，沿著騎樓中間走 8 公尺
  let arc = null, bd = Infinity; const t1 = W.telemetry();
  for (const b of N.data.bld) { if (!b.core || b.back) continue; const n = b.P.length; for (let i = 0; i < n; i++) { if (b.e[i] !== 2) continue; const a = b.P[i], c = b.P[(i + 1) % n], ca = b.core[i], cc = b.core[(i + 1) % n], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 12) continue; const m = [(a[0] + c[0] + ca[0] + cc[0]) / 4, (a[1] + c[1] + ca[1] + cc[1]) / 4], dd = Math.hypot(m[0] - t1.x, m[1] - t1.z); if (dd < bd) { bd = dd; arc = { a, c, ca, cc, L }; } } }
  if (arc) {
    const mid = (u) => [(arc.a[0] + (arc.c[0] - arc.a[0]) * u + arc.ca[0] + (arc.cc[0] - arc.ca[0]) * u) / 2, (arc.a[1] + (arc.c[1] - arc.a[1]) * u + arc.ca[1] + (arc.cc[1] - arc.ca[1]) * u) / 2];
    const u0 = 0.5 - 4 / arc.L, u1 = 0.5 + 4 / arc.L, p0 = mid(u0), p1 = mid(u1);
    W.teleport({ x: p0[0], z: p0[1], heading: Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]) }); H.step(30);
    out.arcade = H.walkTo(p1[0], p1[1], { m: 0.8, max: 15 }); out.arcDist = +bd.toFixed(0);
    out.arcFrame = H.checkFrame(V.colliders);
  }
  // (c) 房子擋人：最近一個房子的碰撞盒，站在長邊外面 1.5 公尺往裡面推 2 秒
  const t2 = W.telemetry(); let box = null, sx = 0, sz = 0, nx = 0, nz = 0;
  const cand = V.colliders.filter((c) => c.t === 'box' && c.hx >= 4 && c.hz >= 4 && c.h >= 6 && N.inBox(c.x, c.z, 20)).sort((a, b) => Math.hypot(a.x - t2.x, a.z - t2.z) - Math.hypot(b.x - t2.x, b.z - t2.z));
  for (const c of cand.slice(0, 60)) { for (const sg of [1, -1]) { const ux = Math.sin(c.rot) * sg, uz = Math.cos(c.rot) * sg, x = c.x + ux * (c.hz + 1.5), z = c.z + uz * (c.hz + 1.5); if (!H.inside(V.colliders, x, 1, z, 0.5)) { box = c; sx = x; sz = z; nx = ux; nz = uz; break; } } if (box) break; } // 盒子本地 ±z 那一面外面 1.5 公尺（要是空的）
  if (box) { W.teleport({ x: sx, z: sz, heading: 0 }); H.step(20); const r2 = H.push(Math.atan2(nz, -nx), 2, 1); /* 往盒子中間推（方向 −n） */ out.push = { moved: +r2.d.toFixed(2), inside: !!H.inside([box], r2.x, 1, r2.z, 0) }; }
  else out.push = { skipped: true };
  out.frame = H.checkFrame(V.colliders);
  return out;
});
console.log('6', el(), JSON.stringify(w6));
check(w6.out === '下車' && w6.mode === 'walk', 'got out of the car at 港墘站');
check(w6.walk.ok, `walked ${w6.walkLen} m along the street (stuck ${w6.walk.stuck})`);
check(!!w6.arcade && w6.arcade.ok && !w6.arcFrame.length, `walked 8 m under a 騎樓 arcade ${w6.arcDist} m away (${w6.arcFrame?.join(',') || 'no clipping'})`);
check(w6.push.skipped || (!w6.push.inside && w6.push.moved < 2), `building wall stops the walker (${JSON.stringify(w6.push)}); ${w6.frame.join(',') || 'camera/body ok'}`);
shots.walk = await drawAndShot('6-walk');

// ==== 7 截圖、draw call ====
const back = await p.evaluate(() => { const D = window.__D(), H = window.__H, W = D.walker; const car = D.tripPose[D.cur]; let r = null;
  for (const sg of [1, -1]) { const x = car.x + 2.0 * sg * Math.sin(car.heading), z = car.z + 2.0 * sg * Math.cos(car.heading); if (H.inside(D.VIL.colliders, x, 1, z, 0.3)) continue; W.teleport({ x, z, heading: car.heading }); H.step(20); if (H.actText()) break; } // 車子旁邊（左或右，空的那邊）
  const a = H.actText(), pr = H.press(); r = H.board(); H.step(30); return { a, pr, modes: r.modes, mode: W.mode }; });
console.log('7 back in the car', JSON.stringify(back));
check(/^上車/.test(back.pr || '') && back.mode === 'off', `walked back to the car and got in again (${back.pr})`);
const S7 = await p.evaluate(() => { const V = window.__D().VIL, N = V.neihu, sp = V.places.neihu.spawn, st = N.data.stations, ns = N.data.nsigns, box = N.info.box;
  const sch = ns.find((s) => /麗山高中/.test(s.nm)), wd = st.find((s) => s.nm === '文德'), lk = N.link.pts, E = lk[lk.length - 1];
  return { sp, sch: sch && { x: sch.p[0], z: sch.p[1], a: sch.ang }, wd: wd && { x: wd.p[0], z: wd.p[1], a: wd.ang }, E, E2: lk[lk.length - 12], box }; });
const perf = {};
const head = (from, to) => Math.atan2(-(to[1] - from[1]), to[0] - from[0]);
perf.street = await shotAt('7a-street-gangqian', S7.sp);
perf.eye = await shotAt('7b-eye-gangqian', S7.sp, 'eye');
perf.rev = await shotAt('7c-street-west', { ...S7.sp, heading: S7.sp.heading + Math.PI });
perf.drone = await shotAt('7d-drone-gangqian', S7.sp, 'air', { at: [S7.sp.x - 160, 130, S7.sp.z + 160], look: [S7.sp.x + 80, 0, S7.sp.z - 80] });
perf.high = await shotAt('7e-drone-high', S7.sp, 'air', { at: [S7.box[0] - 250, 650, S7.box[3] + 350], look: [(S7.box[0] + S7.box[2]) / 2, 0, (S7.box[1] + S7.box[3]) / 2] });
const snap = (x, z) => p.evaluate(([x, z]) => { const r = window.__D().VIL.neihu.routeTo(x, z, x, z); return r ? r.pts[1] : [x, z]; }, [x, z]); // 最近的路上那一點
if (S7.wd) { const q = await snap(S7.wd.x - 70 * Math.cos(S7.wd.a), S7.wd.z - 70 * Math.sin(S7.wd.a)); perf.wende = await shotAt('7f-wende-station', { x: q[0], z: q[1], heading: head(q, [S7.wd.x, S7.wd.z]) }); }
if (S7.sch) { const q = await snap(S7.sch.x, S7.sch.z); const b = [q[0] - (S7.sch.x - q[0]) * 2 + Math.cos(S7.sch.a) * 12, q[1] - (S7.sch.z - q[1]) * 2 + Math.sin(S7.sch.a) * 12]; perf.school = await shotAt('7g-lishan-school', { x: q[0] + Math.cos(S7.sch.a) * 14, z: q[1] + Math.sin(S7.sch.a) * 14, heading: head([q[0] + Math.cos(S7.sch.a) * 14, q[1] + Math.sin(S7.sch.a) * 14], [S7.sch.x, S7.sch.z]) }); }
perf.entry = await shotAt('7h-entry-valley', { x: S7.E2[0], z: S7.E2[1], heading: head(S7.E2, S7.E) });
// 七個地標：路邊一張（從牌子那邊看過去）＋空拍一張；大路的路名牌：從開過來的方向看一張
const LM7 = await p.evaluate(() => { const N = window.__D().VIL.neihu, out = [];
  const cen = (P) => { let x = 0, z = 0; for (const q of P) { x += q[0]; z += q[1]; } return [x / P.length, z / P.length]; };
  for (const [k, v] of Object.entries(N.data.lm)) { const c = cen(v.p), s = v.sign ? v.sign.p : [c[0] + 40, c[1]], ux = c[0] - s[0], uz = c[1] - s[1], l = Math.hypot(ux, uz) || 1;
    out.push([k, s[0] - (ux / l) * 22, s[1] - (uz / l) * 22, c[0], c[1]]); }
  const bs = N.bigSigns, i = Math.floor(bs.length / 2); out.push(['bigsign', bs[i][0] - bs[i][2] * 38, bs[i][1] - bs[i][3] * 38, bs[i][0], bs[i][1], bs[i][4]]);
  return out; });
for (const [k, cx, cz, lx, lz, nm] of LM7) {
  perf['lm_' + k] = await shotAt(`7j-${k}`, { x: cx, z: cz, heading: head([cx, cz], [lx, lz]) }, 'air', { at: [cx, k === 'bigsign' ? 2.4 : 6, cz], look: [lx, k === 'bigsign' ? 5 : 8, lz] });
  if (k !== 'bigsign') perf['lmair_' + k] = await shotAt(`7k-${k}-air`, { x: cx, z: cz, heading: 0 }, 'air', { at: [lx - 110, 85, lz + 110], look: [lx, 0, lz] });
  console.log(`  landmark shot ${k}${nm ? ' (' + nm + ')' : ''}`, JSON.stringify(perf['lm_' + k]));
}
perf.edge = await shotAt('7i-hills-edge', S7.sp, 'air', { at: [S7.box[2] - 60, 25, (S7.box[1] + S7.box[3]) / 2], look: [S7.box[2] + 300, 40, (S7.box[1] + S7.box[3]) / 2 - 100] });
console.log('7 perf', JSON.stringify(perf));
const maxCalls = Math.max(...['street', 'eye', 'rev', 'drone', 'entry', 'wende', 'school'].filter((k) => perf[k]).map((k) => perf[k].calls));
check(maxCalls < 260, `draw calls at street level / drone in 內湖 ≤ ${maxCalls} (street ${perf.street.calls}, west ${perf.rev.calls}, drone ${perf.drone.calls})`);

// ==== 8 直接回車庫：小村莊放回來、出處收起來 ====
await p.evaluate(() => document.getElementById('driveHome').click());
await p.waitForTimeout(400); await p.evaluate(() => window.__dstep(60));
const h8 = await p.evaluate(() => { const D = window.__D(), c = document.querySelector('.nh-credit'); return { on: D.on, hidden: D.VIL.group.children.filter((o) => !o.visible).map((o) => o.name), credit: c ? !c.hidden : false, t: D.drv?.telemetry() && [Math.round(D.drv.telemetry().x), Math.round(D.drv.telemetry().z)] }; });
console.log('8', el(), JSON.stringify(h8));
const r8 = await p.evaluate(() => { const e = document.querySelector('.nh-road'); return !e || e.hidden; });
check(r8, 'HUD road-name label hidden back at the garage');
check(h8.hidden.filter((n) => n !== 'neihu').length === 0 && !h8.credit, `back home: village drawn again (hidden: ${h8.hidden.join(',') || 'none'}), map credit hidden`);
await p.screenshot({ path: `${prefix}-8-home.png` }); // 回到車庫頁（不是開車的畫面）

console.log(`\n${fails.length ? 'FAILED' : 'ALL OK'}: ${fails.length} failed${fails.length ? ' — ' + fails.join(' | ') : ''}; page errors ${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}; ${el()}`);
await b.close(); srv.close();
process.exit(fails.length || errs.length ? 1 : 0);
