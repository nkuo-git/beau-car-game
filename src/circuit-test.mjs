// 賽車場（circuit.js＋circuit.src.js）：整個遊戲（art/garage.html）從車庫出門開去賽車場比一場
//   車庫頁（直線加速的說明）→ 出門走去上 GC8（去哪裡：去賽車場、預設就是它）→ 小地圖畫得到賽車場 → 自己開過去（開鐵捲門 → 村子 → 直線加速賽道入口往北的路 → 維修區）
//   → 報名處停好、選對手（9 個，只有第一個開著）→ 起跑格、五顆紅燈 → 機器人照跑線開兩圈 → 第 1 名、獎金、新對手 → 對手自己跑完
//   → 再比一次：只在起終點來回不算圈、開反了會說、放棄比賽 → 截圖（主直線、第 1 彎、髮夾彎、減速彎、S 彎、駕駛座、維修道、空中、聯外道路、從村子看）、畫了多少
//   → 路面（柏油、草地、碎石）、護欄擋得住 → 開去直線加速（還在；對手名單跟著賽車場）→ 直接回車庫 → 重新整理（錢、贏過的都在）
// 開車、走路都不是真的即時（SwiftShader 一格要一兩秒）：頁面自己的開車先停住（__hold）、不畫（__noDraw），測試在頁面裡一步一步開，要截圖才畫
// node circuit-test.mjs [prefix]（截圖：<prefix>-01-menu.png …；預設 ci-shots/ci）
// node test-b4.mjs [prefix]（截圖：<prefix>-1-page.png …）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = 'ci-shots/ci'] = process.argv.slice(2);
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
const HUD_SEL = ['.dv-chip', '.dv-act', '.dv-act2', '.dv-map', '.dv-cam', '.dv-spd', '.dv-steer', '.dv-brk', '.dv-gas', '.wk-chip', '.wk-act', '.wk-map', '.wk-cam', '.wk-stick', '.wk-btns',
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
// ==== 賽車場的機器人：照跑線開（看前面 7＋0.5×速度公尺那一點轉方向盤），速度照 circuit.js 的 speedProfile（你的車、功力 lat）====
await p.addInitScript(() => {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapA = (a) => { a = (a + Math.PI) % (2 * Math.PI); return a < 0 ? a + Math.PI : a - Math.PI; };
  const C = (window.__ci = { hint: -1, prof: null, key: null, t: 0, ms: 0, n: 0, maxKmh: 0, bumps: 0, off: 0 });
  C.profile = (lat) => { const X = window.__CI(), D = window.__D(), P = X.P, perf = { ...X.PERF[D.cur], hp: X.hp }; C.prof = X.prof(P.course, X.car(perf), { lat, brk: lat }); C.key = D.cur + lat; return C.prof; };
  // 開 frames 格（1/60 秒）：比賽中才開；o.lat＝過彎多用力（1＝最快）、o.line＝跑線用多少（0＝中線）
  C.drive = (frames, o = {}) => {
    const lat = o.lat ?? 0.8, line = o.line ?? 1;
    for (let i = 0; i < frames; i++) {
      const D = window.__D(), X = window.__CI(), R = X.race; if (!R || R.state === 'off' || !D.drv) return { end: R ? R.state : 'gone', t: C.t };
      if (R.state === 'done' && !o.after) return { end: 'done', t: C.t };
      const d = D.drv, t = d.telemetry(), CO = X.P.course;
      if (!C.prof || C.key !== D.cur + lat) C.profile(lat);
      if (R.state === 'run' && !t.paused && !t.auto) {
        const ci = d.carInfo, c0 = (ci.nose + ci.tail) / 2, cx = t.x + Math.cos(t.heading) * c0, cz = t.z - Math.sin(t.heading) * c0;
        const pr = CO.project(cx, cz, C.hint); C.hint = pr.i; if (Math.abs(pr.d) > 6.5) C.off++;
        const sA = pr.s + 7 + 0.5 * Math.abs(t.v), c = CO.at(sA);
        let li = CO.line[c.i] * line, vt = Infinity; for (let q = 0; q < 4; q++) vt = Math.min(vt, C.prof[(pr.i + q) % CO.n]);
        // 前面有對手：換邊超過去（太近就先跟著）
        let bl = null, bg = 1e9; for (const a of R.ais) { const g = a.p - R.me.p; if (g > -2 && g < 50 && Math.abs(a.d - pr.d) < 3.6 && g < bg) { bg = g; bl = a; } }
        if (bl) { let w = bl.d + (bl.d > 0 ? -3.8 : 3.8); if (Math.abs(w) > 5.2) w = bl.d - Math.sign(w - bl.d) * 3.8; li = clamp(w, -5.2, 5.2); if (bg > 0 && bg < 10 && Math.abs(bl.d - pr.d) < 2.3) vt = Math.min(vt, bl.v - 0.3); }
        const tx = c.x - c.tz * li, tz = c.z + c.tx * li;
        const a = wrapA(Math.atan2(-(tz - cz), tx - cx) - t.heading), e = vt - t.v;
        d.setInput({ throttle: e > 0 ? clamp(e * 0.6, 0.15, 1) : 0, brake: e < -0.8 ? clamp(-e * 0.35, 0, 1) : 0, steer: clamp(-a * 2.4, -1, 1) });
      }
      const b0 = t.bumps, c1 = performance.now(); window.__dstep(1); C.ms += performance.now() - c1; C.n++; C.t += 1 / 60;
      const t2 = window.__D().drv?.telemetry(); if (t2) { C.maxKmh = Math.max(C.maxKmh, t2.kmh); if (t2.bumps > b0) C.bumps++; }
      if (window.__ciShotAt && X.race && X.race.time >= window.__ciShotAt) { window.__ciShotAt = 0; return { pause: true, t: C.t }; }
    }
    return { end: null, t: C.t };
  };
});
const ci = () => p.evaluate(() => { const X = window.__CI(), R = X.race, D = window.__D(), t = D.drv?.telemetry();
  return { race: R ? R.state : null, menu: !!X.menu, lights: R ? R.lights : null, time: R ? +R.time.toFixed(1) : null, laps: R?.laps, me: R ? { lapsDone: R.me.lapsDone, next: R.me.next, p: Math.round(R.me.p), fin: R.me.fin, best: R.me.best } : null,
    ais: R ? R.ais.map((a) => ({ name: a.name, p: Math.round(a.p), fin: a.fin && +a.fin.toFixed(1), v: Math.round(a.v * 3.6) })) : [], x: t && Math.round(t.x), z: t && Math.round(t.z), kmh: t && Math.round(t.kmh), cls: document.body.className,
    hud: document.querySelector('#stage .cir-p')?.innerText.replace(/\s+/g, ' ') || null, res: (() => { const r = document.querySelector('#stage .cir-r'); return r && !r.hidden ? r.innerText.replace(/\s+/g, ' ') : null; })(), money: window.__G().money, wins: { ...window.__G().wins } }; });
const shotAt = async (name, pose, cam = 'chase', o = {}) => { // 車子放到 pose（世界），鏡頭照 cam 擺好（走幾格），截圖
  await p.evaluate(([pose, cam, o]) => { const D = window.__D(), d = D.drv; if (pose) d.teleport(pose); d.setCameraMode(cam === 'air' ? 'none' : cam); if (o.v) d.setInput({ throttle: 0, brake: 0, steer: 0 }); window.__dstep(o.steps ?? 40);
    if (cam === 'air') { const c = D.dcam; c.position.set(...o.at); c.lookAt(...o.look); c.updateMatrixWorld(true); } }, [pose, cam, o]);
  const ri = await drawAndShot(name);
  await p.evaluate(() => window.__D().drv.setCameraMode('chase'));
  return ri;
};

// ---- 1 車庫頁 → 出門（走路）→ 上 GC8：去哪裡有「去賽車場」，預設就是賽車場（沒錢）----
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
await p.waitForFunction(() => window.__D().LODS.yaris?.lod, null, { timeout: 300000 }); await p.waitForTimeout(500);
check(await p.evaluate(() => /在賽車場贏過/.test(document.querySelector('#race h2 small').textContent) && document.getElementById('race').getAttribute('aria-label') === '直線加速'), 'drag race section is now 直線加速 and says new opponents come from the circuit');
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
const b1 = await p.evaluate(() => { const D = window.__D(), V = D.VIL, I = V.info.circuit, pills = [...document.querySelectorAll('#dests button')].map((x) => `${x.dataset.d}:${x.textContent}${x.getAttribute('aria-pressed') === 'true' ? '*' : ''}`);
  return { info: I, pills, place: !!V.places.circuit, track: !!V.places.track, roads: V.roads.filter((r) => r.kind === 'circuit').length, bounds: V.bounds }; });
console.log('1', el(), 'circuit built:', JSON.stringify(b1));
check(b1.info && b1.info.lap > 3500 && b1.info.lap < 5000 && b1.place && b1.track && b1.roads >= 2, `circuit built into the village (lap ${b1.info?.lap} m, ${b1.info?.meshes} meshes, ${b1.info?.tris} tris, ${b1.info?.colliders} colliders, ${b1.info?.ms} ms); drag strip place still there`);
check(b1.pills.length === 8 && b1.pills.includes('neihu:去內湖') && b1.pills.includes('mountain:去山頂') && b1.pills.includes('circuit:去賽車場*') && !b1.pills.some((q) => q.startsWith('track:')), `eight destination pills (內湖, 山頂 added), 去賽車場 replaces 去賽道 and is the default with no money (${b1.pills.join(' ')})`);
const w2 = await p.evaluate(() => { const D = window.__D(), H = window.__H, W = D.walker; W.teleport(H.gw(-4.6, -7.7, -1.05)); H.step(20); const r = H.walkLocal([[-2.6, -2.6], [-0.6, -2.3]]); return { ok: r.ok, act: H.actText() }; });
const bd2 = await p.evaluate(() => { const H = window.__H, pressed = H.press(), r = H.board(); H.step(40); const D = window.__D(); return { pressed, modes: r.modes, drv: !!D.drv, cur: D.cur, dest: D.drv?.telemetry().dest }; });
console.log('  上車:', JSON.stringify(w2), JSON.stringify(bd2));
check(bd2.drv && bd2.cur === 'gc8' && bd2.dest === 'circuit', `got in GC8; driving destination is the circuit (${bd2.dest})`);
// 小地圖：賽車場畫在上面（主直線、後直線那一點是路的顏色）
const mp = await p.evaluate(() => { const L = window.__D().walker.mapLayer, g = L.c.getContext('2d'), px = (x, z) => [...g.getImageData(Math.round((x - L.x0) * L.ms), Math.round((z - L.z0) * L.ms), 1, 1).data]; return { size: [L.c.width, L.c.height], ms: +L.ms.toFixed(2), main: px(800, -160), back: px(450, -740), grass: px(600, -400) }; });
console.log('  minimap:', JSON.stringify(mp));
check(mp.main[3] > 200 && mp.back[3] > 200 && mp.grass[3] < 60, `minimap shows the circuit outline (main straight ${mp.main}, back straight ${mp.back}, infield ${mp.grass}; ${mp.size.join('×')} px)`);

// ---- 2 開去賽車場：開鐵捲門 → 村子 → 直線加速賽道入口往北的路 → 維修區 → 報名處自己停好 → 選對手 ----
let r = await leg('circuit', '!!window.__CI().menu', { act: ['開鐵捲門'] }, 400);
let s2 = await ci();
console.log('2', el(), 'at the pit:', JSON.stringify(s2));
check(r.arrived && s2.menu && s2.cls.includes('ciracing') && r.stuck === 0, `drove from the garage to the circuit pit box by itself and parked; the opponent menu opened (${r.t?.toFixed?.(0)} s sim, max ${r.max?.toFixed?.(0)} km/h, bumps ${r.bumps}, stuck ${r.stuck})`);
const menu = await p.evaluate(() => [...document.querySelectorAll('#stage .cir-m .list button')].map((b) => ({ t: b.querySelector('b').textContent, d: b.disabled, p: b.getAttribute('aria-pressed'), s: b.querySelector('small').textContent })));
console.log('  menu:', JSON.stringify(menu));
check(menu.length === 9 && menu[0].t === '隔壁同學' && !menu[0].d && menu[0].p === 'true' && /5 萬/.test(menu[0].s) && menu.slice(1).every((q) => q.d && q.t === '？？？'), 'menu: the same 9 opponents as the drag race; only 隔壁同學 (5 萬, 2 圈) is open, the rest are ？？？');
await drawAndShot('01-menu');
const mClash = await p.evaluate(() => { const vis = (e) => e && getComputedStyle(e).display !== 'none' && e.getClientRects().length; const m = document.querySelector('#stage .cir-m').getBoundingClientRect(); return { inView: m.top >= 0 && m.bottom <= innerHeight && m.left >= 0 && m.right <= innerWidth, dests: vis(document.getElementById('dests')) ? 'shown' : 'hidden' }; });
check(mClash.inView && mClash.dests === 'hidden', `menu fits on screen; destination pills hidden while choosing (${JSON.stringify(mClash)})`);

// ---- 3 比賽：開始 → 起跑格（你最後）、五顆紅燈 → 熄燈出發 → 照跑線開兩圈 → 第 1 名、獎金 ----
await p.evaluate(() => document.querySelector('#stage .cir-m .row button.a').click());
await p.waitForFunction(() => !!window.__CI().race, null, { timeout: 120000 });
let s3 = await ci();
const grid = await p.evaluate(() => { const X = window.__CI(), R = X.race, D = window.__D(), t = D.drv.telemetry(); return { me: [+t.x.toFixed(1), +t.z.toFixed(1)], ais: R.ais.map((a) => [+a.x.toFixed(1), +a.z.toFixed(1), a.name]), lod: R.ais.every((a) => a.car.parent === D.TR.scene && a.obj.draws <= 6), toast: document.querySelector('#stage .dv-toast')?.textContent || '' }; });
console.log('3', el(), 'grid:', JSON.stringify(grid), JSON.stringify(s3));
check(s3.race === 'grid' && s3.laps === 2 && s3.ais.length === 3 && s3.ais[0].name === '隔壁同學' && grid.ais.every((a) => a[0] > grid.me[0] + 4) && grid.lod && !s3.menu, `race set up: you start at the back of the grid behind 3 light (LOD) opponents (隔壁同學 on pole), 2 laps`);
// 紅燈：一顆一顆亮，熄掉才可以開（踩油門也不會動）
await p.keyboard.down('ArrowUp'); // 踩油門（鍵盤＝手指）：熄燈前不會動
const lamps = []; let moved = 0;
for (let k = 0; k < 14; k++) { const q = await p.evaluate(() => { window.__dstep(30); const R = window.__CI().race, D = window.__D(); return { st: R.state, l: R.lights, on: document.querySelectorAll('#stage .cir-l i.on').length, gl: (() => { const c = D.VIL.circuit.group.getObjectByName('ci-lamps').geometry.attributes.color; let n = 0; for (let i = 0; i < c.count; i += 4) if (c.getX(i) > 0.5) n++; return n; })(), v: D.drv.telemetry().v }; }); lamps.push(`${q.st}:${q.l}/${q.on}/${q.gl}`); if (q.st === 'grid' && Math.abs(q.v) > 0.3) moved++; if (k === 6) await drawAndShot('02-grid-lights'); if (q.st === 'run') break; }
await p.keyboard.up('ArrowUp');
console.log('  lights:', lamps.join(' '));
check(lamps.some((q) => q.startsWith('grid:5/5/10')) && lamps.some((q) => q.startsWith('grid:3/3/6')) && lamps[lamps.length - 1].startsWith('run:-1/0/0') && moved === 0, 'start lights: 5 red lights come on one by one (HUD and the gantry), all go out = GO; throttle before that does nothing');
const rs0 = await p.evaluate(() => { window.__ciShotAt = 9; const C = window.__ci; C.t = 0; C.ms = 0; C.n = 0; return C.profile(0.82).length; });
let rr = await p.evaluate(() => window.__ci.drive(60 * 30, { lat: 0.82 }));
await drawAndShot('03-race-start'); rr.pause = false; // 第 1 彎前面：對手在前面
const hudC = await p.evaluate(() => { const S = ['.cir-p', '.dv-map', '.dv-cam', '.dv-spd', '.dv-steer', '.dv-brk', '.dv-gas', '.dv-chip', '.dv-act', '.dv-act2', '#driveHome', '#dSndBtn', '#fsBtn'];
  const R = S.map((s) => [s, document.querySelector('#stage ' + s) || document.querySelector(s)]).filter(([, e]) => e && getComputedStyle(e).display !== 'none' && e.getClientRects().length && !e.closest('[hidden]')).map(([s, e]) => [s, e.getBoundingClientRect()]);
  const out = []; const a = R.find((q) => q[0] === '.cir-p'); if (!a) return 'no panel'; for (const [s, b] of R) if (s !== '.cir-p' && a[1].left < b.right && b.left < a[1].right && a[1].top < b.bottom && b.top < a[1].bottom) out.push(s); return out.join(' '); });
check(!hudC, `race HUD (名次、圈數、時間) does not cover the driving controls (${hudC || 'ok'})`);
for (let k = 0; k < 40 && !rr.end; k++) {
  if (rr.pause) { await drawAndShot('04-race-eye'); }
  if (k === 2) await p.evaluate(() => { window.__D().drv.setCameraMode('eye'); window.__ciShotAt = (window.__CI().race?.time || 0) + 2; });
  if (k === 4) await p.evaluate(() => window.__D().drv.setCameraMode('chase'));
  rr = await p.evaluate(() => window.__ci.drive(60 * 30, { lat: 0.82 }));
  if (k % 4 === 0) console.log('  ...', el(), JSON.stringify((({ time, me, ais, kmh, hud }) => ({ time, me, ais, kmh, hud }))(await ci())));
}
let s4 = await ci();
const rstat = await p.evaluate(() => { const C = window.__ci; return { off: C.off, bumps: C.bumps, max: Math.round(C.maxKmh), ms: +(C.ms / Math.max(1, C.n)).toFixed(2), n: C.n }; });
console.log('4', el(), 'race end:', JSON.stringify(s4), JSON.stringify(rstat));
check(s4.race === 'done' && s4.me.lapsDone === 2 && s4.me.fin > 150 && s4.me.best > 80, `you drove 2 laps (checkpoints in order) and finished: ${s4.me.fin?.toFixed?.(1)} s, best lap ${s4.me.best?.toFixed?.(1)} s (robot: off track ${rstat.off} steps, ${rstat.bumps} bumps, max ${rstat.max} km/h)`);
check(/第 1 名/.test(s4.res || '') && /獎金 \+5 萬/.test(s4.res || '') && /新對手出現了：巷口阿伯/.test(s4.res || '') && s4.money === 5 && s4.wins.classmate === 1, `results: 1st place, prize +5 萬 paid, next opponent unlocked (${s4.res})`);
const sv = await saved();
check(sv.money === 5 && sv.wins?.classmate === 1, 'prize and win saved');
await drawAndShot('05-results');
// 對手跑完：比完以後再等一下，三台都過終點（照自己的速度跑完）
const aiF = await p.evaluate(() => { const R = window.__CI().race; for (let i = 0; i < 60 * 90 && R.ais.some((a) => a.fin == null); i++) window.__dstep(1); return R.ais.map((a) => ({ n: a.name, fin: a.fin && +a.fin.toFixed(1), p: Math.round(a.p), best: a.best && +a.best.toFixed(1) })); });
console.log('  opponents:', JSON.stringify(aiF));
check(aiF.every((a) => a.fin > s4.me.fin && a.p >= 2 * 3600), `all 3 opponents drive their 2 laps on their own and finish after you (${aiF.map((a) => `${a.n} ${a.fin}s`).join(', ')})`);
const perfUpd = await p.evaluate(() => { const R = window.__CI().race; const t0 = performance.now(); for (let i = 0; i < 120; i++) R.update(1 / 60); return +((performance.now() - t0) / 120).toFixed(3); });
console.log('  race.update (3 opponents):', perfUpd, 'ms/frame');

// ---- 5 再比一次：放到起跑格；只開過起終點來回不算一圈（要照檢查點）；開反了會說；放棄比賽 ----
await p.evaluate(() => [...document.querySelectorAll('#stage .cir-r button')].find((b) => b.textContent === '再比一次').click());
await p.waitForFunction(() => window.__CI().race && window.__CI().race.state === 'grid', null, { timeout: 120000 });
await p.evaluate(() => { const R = window.__CI().race; for (let i = 0; i < 60 * 8 && R.state === 'grid'; i++) window.__dstep(1); });
const cheat = await p.evaluate(() => {
  const D = window.__D(), d = D.drv, R = window.__CI().race, sf = D.VIL.circuit.gates.at(-1), ci = d.carInfo, c0 = (ci.nose + ci.tail) / 2, out = [];
  for (let k = 0; k < 3; k++) { d.teleport({ x: sf.x - 12 - c0, z: -160, heading: 0 }); d.setInput({ throttle: 1, brake: 0, steer: 0 }); for (let i = 0; i < 120; i++) window.__dstep(1); out.push(R.me.lapsDone); }
  // 開反了：掉頭往西開
  d.teleport({ x: 900 - c0, z: -160, heading: Math.PI }); d.setInput({ throttle: 0.6, brake: 0, steer: 0 }); let warn = ''; for (let i = 0; i < 200; i++) { window.__dstep(1); const c = document.querySelector('#stage .cir-c'); if (c && !c.hidden && /開反/.test(c.textContent)) warn = c.textContent; }
  d.setInput(null);
  return { laps: out, warn, next: R.me.next };
});
console.log('5', el(), 'shortcut / wrong way:', JSON.stringify(cheat));
check(cheat.laps.join() === '0,0,0' && cheat.next === 0, 'crossing the start/finish line again and again without driving the lap does not count laps (checkpoints)');
check(/開反了/.test(cheat.warn), `driving the wrong way: 「${cheat.warn}」`);
await p.evaluate(() => [...document.querySelectorAll('#stage .cir-p button')].find((b) => b.textContent === '放棄比賽').click());
await p.evaluate(() => window.__dstep(5));
const ab = await ci();
check(ab.race === null && !ab.cls.includes('ciracing') && await p.evaluate(() => !window.__D().TR.scene.children.some((o) => o.name === 'ci-racer-shadows') && window.__D().drv.telemetry().brake < 0.05), '放棄比賽: race cleared (opponents, shadows, HUD), controls back to you');

// ---- 6 賽道的樣子：幾個地方截圖（追車、駕駛座、空中）、每個地方畫了多少 ----
await p.evaluate(() => window.__npcPause(true));
const perf = {};
// 照跑道量：第幾公尺、離中線多少（右正）→ 車子的位置、車頭方向；空中鏡頭：車後面上方看前面的彎
const PZ = await p.evaluate(() => { const CO = window.__CI().P.course, C = (k) => CO.corners.find((c) => c.idx === k).s0;
  const at = (s, d = 0) => { const c = CO.at(((s % CO.len) + CO.len) % CO.len, {}); return { x: c.x - c.tz * d, z: c.z + c.tx * d, heading: Math.atan2(-c.tz, c.tx), tx: c.tx, tz: c.tz }; };
  const drone = (s, back, up, fwd, d = 0) => { const q = at(s, d); return { pose: { x: q.x, z: q.z, heading: q.heading }, at: [q.x - q.tx * back, up, q.z - q.tz * back], look: [q.x + q.tx * fwd, 0, q.z + q.tz * fwd] }; };
  const pose = (s, d) => { const q = at(s, d); return { x: q.x, z: q.z, heading: q.heading }; };
  return { t1: pose(C(1) - 70, -2), t1d: drone(C(1) - 40, 30, 22, 70), hair: pose(C(11) - 35, 2), haird: drone(C(11) - 30, 35, 30, 50), chic: pose(C(7) - 40, 0), chicd: drone(C(7) - 25, 30, 26, 60), ess: pose(C(18) - 25, 0), essd: drone(C(17) + 20, 40, 34, 120), eye: pose(C(4) - 60, 0) }; });
perf.grid = await shotAt('06-main-straight', { x: 560, z: -158, heading: 0 });
perf.t1 = await shotAt('07-turn1-braking', PZ.t1);
perf.t1d = await shotAt('07b-turn1-drone', PZ.t1d.pose, 'air', PZ.t1d);
perf.hair = await shotAt('08-hairpin', PZ.hair);
perf.haird = await shotAt('08b-hairpin-drone', PZ.haird.pose, 'air', PZ.haird);
perf.chic = await shotAt('09-chicane', PZ.chic);
perf.chicd = await shotAt('09b-chicane-drone', PZ.chicd.pose, 'air', PZ.chicd);
perf.ess = await shotAt('10-s-curves', PZ.ess);
perf.essd = await shotAt('10b-s-curves-drone', PZ.essd.pose, 'air', PZ.essd);
perf.eye = await shotAt('11-driver-seat', PZ.eye, 'eye');
perf.pit = await shotAt('12-pit-lane', { x: 420, z: -144, heading: 0 });
perf.air = await shotAt('13-aerial', { x: 446, z: -144, heading: 0 }, 'air', { at: [380, 260, 120], look: [690, 0, -450] });
perf.air2 = await shotAt('14-aerial-top', { x: 446, z: -144, heading: 0 }, 'air', { at: [700, 650, -200], look: [700, 0, -450] });
perf.acc = await shotAt('15-access-road', { x: -51, z: -12, heading: Math.PI / 2 });
perf.village = await shotAt('16-from-village', { x: -95, z: 0, heading: 0 });
console.log('6', el(), 'draws/tris:', JSON.stringify(perf));
await p.evaluate(() => window.__npcPause(false));
// 草地、碎石、柏油：路面
const sf = await p.evaluate(() => { const V = window.__D().VIL, s = (x, z) => V.surfaceAt(x, z); return { track: s(800, -160), grass: s(800, -170.5), gravelT1: s(1180, -190), pit: s(600, -144), access: s(-51, -50), village: s(-200, 0), strip: s(300, 0) }; });
check(sf.track === 0 && sf.grass === 1 && sf.gravelT1 === 2 && sf.pit === 0 && sf.access === 0 && sf.strip === 0, `surfaces: track/pit/access road asphalt, run-off grass, gravel outside turn 1 (${JSON.stringify(sf)})`);
// 護欄擋得住：往外直直開
const wall = await p.evaluate(() => { const d = window.__D().drv; d.teleport({ x: 800, z: -165, heading: Math.PI / 2 }); d.setInput({ throttle: 1, brake: 0, steer: 0 }); let zmin = 0; for (let i = 0; i < 300; i++) { window.__dstep(1); zmin = Math.min(zmin, d.telemetry().z); } d.setInput(null); window.__dstep(30); return { zmin: +zmin.toFixed(1), bumps: d.telemetry().bumps }; });
check(wall.zmin > -176 && wall.bumps > 0, `barriers stop you (drove north into the infield wall: stopped at z ${wall.zmin})`);

// ---- 7 直線加速還在：從賽車場開到旁邊的起跑區 → 直線加速的畫面（對手名單：隔壁同學贏過了、巷口阿伯開了）→ 開回村子 ----
const lv = await p.evaluate(() => { const d = window.__D().drv; d.teleport({ x: 420, z: -144, heading: 0 }); d.setInput({ throttle: 0.3, brake: 0, steer: 0 }); for (let i = 0; i < 900 && !window.__CI().menu; i++) window.__dstep(1); d.setInput(null);
  const m = !!window.__CI().menu, hid = getComputedStyle(document.getElementById('drivebar')).visibility, toast = document.querySelector('#stage .dv-toast.show')?.textContent || '';
  document.querySelector('#stage .cir-m .row button.b').click(); window.__dstep(5);
  return { m, hid, toast, after: !!window.__CI().menu, cls: document.body.className, vis: getComputedStyle(document.getElementById('drivebar')).visibility, forced: window.__D().drv.telemetry().brake }; });
console.log('  leave menu:', JSON.stringify(lv));
check(lv.m && lv.hid === 'hidden' && !lv.after && !/ciracing|cimenu/.test(lv.cls) && lv.vis === 'visible', '報名處: 離開 closes the opponent menu (直接回車庫 hidden while choosing, back after)');
r = await leg('track', 'window.__R() !== null', {}, 300);
await p.waitForFunction(() => window.__R() && window.__R().phase === 'idle' && document.getElementById('status').hidden, null, { timeout: 300000 });
const dr = await p.evaluate(() => ({ racing: document.body.className.includes('racing'), opps: [...document.querySelectorAll('#opps button')].map((b) => `${b.querySelector('b').textContent}${b.disabled ? '(x)' : ''}`).join(' ') }));
console.log('7', el(), 'drag strip:', JSON.stringify(dr));
check((r.arrived || r.stop) && dr.racing && /隔壁同學 巷口阿伯 /.test(dr.opps + ' ') && /？？？\(x\)/.test(dr.opps), `drag race (直線加速) still reachable from the circuit; its opponent list follows the circuit wins (${dr.opps})`);
await p.evaluate(() => { window.__noDraw = false; }); await p.waitForTimeout(2500); await p.screenshot({ path: `${prefix}-17-drag-strip.png` }); await p.evaluate(() => { window.__noDraw = true; }); console.log('  shot', `${prefix}-17-drag-strip.png`, el()); // 直線加速的畫面（不是開車：自己畫）
await p.evaluate(() => document.getElementById('raceBack').click());
const back = await p.evaluate(() => ({ on: window.__D().on, dest: window.__D().drv?.telemetry().dest }));
check(back.on, 'back to driving after the drag race screen');

// ---- 8 直接回車庫 → 重新整理：錢、贏過的都在 ----
await p.evaluate(() => document.getElementById('driveHome').click());
await p.waitForFunction(() => !window.__D().on, null, { timeout: 60000 });
await p.reload({ waitUntil: 'domcontentloaded' }); await ready();
const rl = await p.evaluate(() => ({ money: window.__G().money, wins: window.__G().wins, trophies: window.__O().trophies }));
check(rl.money === 5 && rl.wins.classmate === 1 && rl.trophies === 1, `after reload: money ${rl.money} 萬, classmate win kept, 1 trophy`);

console.log(`\n${fails.length ? 'FAILED' : 'PASSED'}: ${fails.length} failed, page errors ${errs.length}`);
for (const f of fails) console.log('  - ' + f);
if (errs.length) check(false, `page errors: ${errs.slice(0, 3).join(' | ')}`);
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
