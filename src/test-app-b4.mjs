// 第 4 批（越野車場）在 App（carid-pwa 的 build，0.8.<版號>）裡測：跟 test-b4.mjs 同一趟（怪獸卡車用 App 的 tune/monster.glb）
//   車庫頁（怪獸卡車的按鈕說在越野車行）→ 出門（走路；去哪裡六個）走去上 GC8 → 開鐵捲門自己開到越野車場（路上有車、有人）
//   → 越野車行：下車走去展示台（人走不上去、腳踩在地形上）、走回去上車 → 開進買車區買怪獸卡車（GC8 車行送回車庫：停上升降機；怪獸卡車不停升降機、沒有名牌）
//   → 從怪獸卡車下車（站在大輪胎外面）、繞到另一邊再上車（同一台接著開）→ 開到起跑區比第一場越野賽 → 領獎金、按「開走」→ 撞牆（凹、存起來）
//   → 開去改車廠修好、裝引擎零件 → 開回家（開鐵捲門開進去）→ 停在升降機上下車（不停上去）→ 停中間 → 走去開 GC8（怪獸卡車完整的車停在原地）→ 走回去開怪獸卡車 → 直接回車庫
//   → 車庫頁看怪獸卡車（鏡頭拉遠、升降機不升）、換顏色、換拉花 → 重新整理（車、錢、獎、零件、停車位都在）
//   → 開 GC8 出門：怪獸卡車（輕量車）停在車庫西邊「越野車車庫」自己的格子（第 6 批 orbay.js）→ 走路開兩道鐵捲門走過去上車、開出來
//   → 開去阿財車行買一台：車行把怪獸卡車送回越野車車庫的格子；一般的車進不去（牆擋著）、也佔不到格子
// 開車的機器人：照路線、靠右、前面有車就等；大車（怪獸卡車）看到對向來車先往右靠、慢下來讓牠過；跟停下來等你的對向車僵住了就從旁邊慢慢過去（倒車前看後面有沒有車、人）
// 開車、走路都不是真的即時（SwiftShader 一格要一兩秒）：頁面自己的開車先停住（__hold）、不畫（__noDraw），測試在頁面裡一步一步開、走，要截圖才畫
// node test-app-b4.mjs <repo> [prefix]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [repo, prefix = 'b4-shots/app'] = process.argv.slice(2);
if (!repo) throw new Error('用法：node test-app-b4.mjs <repo> [prefix]');
// <repo>：改車遊戲自己的網站（docs/：index.html＋game.js，外殼 BeauCarApp）或萬能軟體的 repo（tune.html＋tune.js，外殼 CaridApp）
const SITE = !fs.existsSync(path.join(repo, 'tune.html')), JS = SITE ? '/game.js' : '/tune.js', SHELL = SITE ? 'BeauCarApp' : 'CaridApp';
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const hook = 'window.__R = () => race; window.__G = () => GAME; window.__S = () => S; window.__snd = () => snd; window.__room = () => room; window.__scene = () => scene; window.__controls = () => controls;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__money = (n) => { GAME.money = n; save(true); renderWallet(); renderOptions(); refreshCarBtns(); };'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, dvoice, trip, tripS, home, bayLock, snooze, TR, LODS, camGo, cur, built, walker, tripPose, tripFull, boarding,'
  + '   DECK, DREV, sleep, gcam, liftSnd, deliver, offDeck, runLift, midCar, normPark, CABIN_EYE, OB, orbaySpot, parkSpot, baySpot });' // 第 6 批：越野車車庫（orbay.js）
  + ' window.__N = () => NPC; window.__NMAX = () => NPC_MAX;'
  + ' window.__pol = () => (typeof police !== "undefined" ? police : null);' // 第 3 批（b3-int）：警察（開車的機器人不小心撞到人：星星清掉，見 leg）
  + ' window.__IN = () => ({ indoor, doorFade, HOUSE_WARM, interiorFor, buildInterior, DEALER_DOOR });'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } else if (window.__npcKeep) { NPC = window.__npcKeep; window.__npcKeep = null; NPC.g.visible = DRIVE.on; } };'
  + ' window.__look = () => LOOKP; window.__cam = () => ({ camCap, maxD: controls.maxDistance, fitD, dist: camera.position.distanceTo(controls.target), pos: camera.position.toArray() }); window.__cea = createEngineAudio; window.__camera = () => camera;'
  + ' window.__O = () => ({ orRace, oDisp, oLoading, dealerAt, trophies: trophyCount(), bigCam, lvl: orLevel(), PFULL });' // 第 4 批：越野賽、越野車行展示台、鏡頭、停在村子裡的完整的車（沒有輕量車的）
  + ' window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };'
  + ' window.__wstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return walker && walker.telemetry(); };';
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let f = u.startsWith('/three/') ? path.join(three, u.slice(7)) : path.join(repo, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f) && path.basename(repo) === 'try' && u.startsWith('/tune/')) f = path.join(repo, '..', u); // 試玩頁 docs/try：車身檔用正式網站的（'../tune/…'，從根目錄看就是 /tune/）
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  let body = fs.readFileSync(f);
  if (f.endsWith('.html')) body = body.toString('utf8').replaceAll('https://cdn.jsdelivr.net/npm/three@0.186.1/', '/three/');
  if (u === JS) {
    let js = body.toString('utf8');
    const a = 'const RACE = { on: false, frame: raceFrame };', r = '  renderer.render(TR.scene, rcam);\n}', d1 = '  driveStep(dt);\n  if (!DRIVE.on) return;', d2 = '  renderer.render(TR.scene, dcam);\n}', d3 = '  if (indoor) { renderer.render(indoor.scene, dcam); return; }';
    for (const x of [a, r, d1, d2, d3]) if (js.split(x).length !== 2) throw new Error('hook anchor missing or not unique in tune.js: ' + x);
    js = js.replace(a, `${a} ${hook}`).replace(r, '  if (!window.__fast || ++window.__fn % 12 === 0) renderer.render(TR.scene, rcam);\n}')
      .replace(d1, '  if (!window.__hold) driveStep(dt);\n  if (!DRIVE.on) return;')
      .replace(d2, '  if (!window.__noDraw) { renderer.render(TR.scene, dcam); window.__dframes = (window.__dframes || 0) + 1; }\n}')
      .replace(d3, '  if (indoor) { if (!window.__noDraw) { renderer.render(indoor.scene, dcam); window.__dframes = (window.__dframes || 0) + 1; } return; }');
    body = js;
  }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  res.end(body);
}).listen(0);
const root = `http://127.0.0.1:${srv.address().port}`, base = `${root}/${SITE ? '' : 'tune.html'}`;
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: 'block', userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 ' + SHELL + '/8' });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort()); // 不連外面
await ctx.addInitScript(() => { window.__roomWatch = false; });
// 新版 APK 的外殼：CaridApp.setFullscreen(true/false)（只放在改車頁：汽車、麥塊那兩頁照舊）
await ctx.addInitScript(({ site, shell }) => { if (!(site ? /\/(index\.html)?$/ : /\/tune\.html$/).test(location.pathname)) return; window.__fsCalls = []; window[shell] = { ready() {}, openMail() { return false; }, setFullscreen(on) { window.__fsCalls.push(on); } }; }, { site: SITE, shell: SHELL });
const p = await ctx.newPage();
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
// 開局：GC8＋YARIS、NT$ 1000 萬（買得起怪獸卡車 100 萬）；只有第一次載入才放（重新整理要看存的）
await p.addInitScript(() => {
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 1000, owned: ['gc8', 'yaris'], parts: {}, tyres: {}, wins: {}, cars: {} }));
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
const summary = [];

// ---- 1 車庫頁：怪獸卡車的按鈕說「越野車行」----
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
await p.waitForFunction(() => window.__D().LODS.yaris?.lod, null, { timeout: 300000 }); await p.waitForTimeout(800);
const mBtn = await p.evaluate(() => { const b = document.querySelector('#cars button[data-car="monster"]'); return b ? { name: b.querySelector('b')?.textContent, span: b.querySelector('span').textContent } : null; });
console.log('1', el(), 'car:', await txt('#carName'), '| wallet:', await txt('#wallet'), '| monster button:', JSON.stringify(mBtn));
check(!!mBtn && /越野車行/.test(mBtn.span) && /100 萬/.test(mBtn.span), `monster truck button says it is sold at 越野車行 for 100 萬 (${mBtn?.span})`);
check(await p.evaluate(() => /車店/.test(document.querySelector('#cars button[data-car="supra"] span').textContent)), 'road cars still say 車店');
await p.evaluate(() => document.querySelector('#cars button[data-car="monster"]').click());
check(await p.evaluate(() => window.__D().cur === 'gc8' && /越野車行/.test(document.getElementById('gtoast').textContent)), 'tapping the unowned monster truck says to buy it at the off-road park');
check(await p.evaluate(() => window.__O().trophies === 0 && !!document.querySelector('#dests button[data-d="offroad"]')), 'no trophies yet; destination bar has 去越野車場');
await p.evaluate(() => { document.querySelector('#cars button[data-car="monster"]').scrollIntoView({ inline: 'center', block: 'center' }); }); await p.waitForTimeout(1200);
await p.screenshot({ path: `${prefix}-1-page.png` }); console.log('  shot', `${prefix}-1-page.png`, el());

// ---- 2 出門（走路）：去哪裡多了一個（六個）；走去上 GC8；去越野車場 ----
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.waitForFunction(() => window.__D().LODS.yaris?.lod?.car.parent === window.__D().GAR.lifts[0].platforms[1], null, { timeout: 120000 });
const pillsAbove = (sel) => p.evaluate((s) => { const d = [...document.querySelectorAll('#dests button')].map((x) => { const r = x.getBoundingClientRect(); return { t: x.textContent, p: x.getAttribute('aria-pressed'), x: Math.round(r.x), y: Math.round(r.y), b: Math.round(r.bottom), w: Math.round(r.width) }; });
  const e = document.querySelector(s); return { d, top: e ? Math.round(e.getBoundingClientRect().top) : null, fs: document.body.classList.contains('fs') }; }, sel);
const pw1 = await pillsAbove('#stage .wk-stick');
console.log('2', el(), 'on foot, dests:', JSON.stringify(pw1));
check(pw1.fs && pw1.d.length === 8 && new Set(pw1.d.map((q) => q.x)).size === 1 && new Set(pw1.d.map((q) => q.y)).size === 8 && pw1.top != null && Math.max(...pw1.d.map((q) => q.b)) <= pw1.top,
  `on foot (fullscreen): eight destination pills (內湖, 山頂 added) in one column above the joystick (last pill ends ${Math.max(...pw1.d.map((q) => q.b))}, joystick at ${pw1.top})`);
let clash = await hudClash() || await sizeSweep();
check(!clash, `on foot with eight destinations: nothing overlapping or off-screen on any screen size (${clash || 'ok'})`);
const w2 = await p.evaluate(() => { const D = window.__D(), H = window.__H, W = D.walker; W.teleport(H.gw(-4.6, -7.7, -1.05)); H.step(20); const r = H.walkLocal([[-2.6, -2.6], [-0.6, -2.3]]); return { ok: r.ok, act: H.actText() }; });
const bd2 = await p.evaluate(() => { const H = window.__H, pressed = H.press(), r = H.board(); H.step(40); const D = window.__D(); return { pressed, modes: r.modes, drv: !!D.drv, cur: D.cur, act: H.actText(), act2: H.act2() }; });
console.log('  上車 GC8:', JSON.stringify(w2), JSON.stringify(bd2));
check(w2.ok && w2.act === '上車 · GC8' && bd2.pressed === '上車 · GC8' && bd2.modes.join('>') === 'in>seat>off' && bd2.drv && bd2.cur === 'gc8' && bd2.act === '開鐵捲門' && bd2.act2 === '下車', 'walked to GC8 in the middle of the garage and got in (開鐵捲門 + 下車)');
// 全螢幕開車：「去哪裡」平常收起來（Nick 2026-10-10）：按「📍 去哪裡 ▾」打開 → 選了收起來 → 再打開量排法
const fold2 = await p.evaluate(() => { const B = document.body.classList, sh = B.contains('destsopen'), list0 = getComputedStyle(document.getElementById('dests')).display; document.getElementById('destTog').click(); const op = B.contains('destsopen');
  document.querySelector('#dests button[data-d="offroad"]').click(); const picked = B.contains('destsopen'); document.getElementById('destTog').click(); return { sh, list0, op, picked, again: B.contains('destsopen') }; });
console.log('  去哪裡 folded:', JSON.stringify(fold2));
check(!fold2.sh && fold2.list0 === 'none' && fold2.op && !fold2.picked && fold2.again, 'in the car (fullscreen) the destinations are folded into 「📍 去哪裡 ▾」: tap opens, picking one folds it, tap opens again');
const pd2 = await pillsAbove('#stage .dv-steer');
console.log('  in the car, dests:', JSON.stringify(pd2));
check(pd2.fs && pd2.d.length === 8 && new Set(pd2.d.map((q) => q.x)).size === 1 && new Set(pd2.d.map((q) => q.y)).size === 8 && pd2.top != null && Math.max(...pd2.d.map((q) => q.b)) <= pd2.top,
  `driving (fullscreen): eight destination pills (內湖, 山頂 added) in one column above the steering buttons (last pill ends ${Math.max(...pd2.d.map((q) => q.b))}, steering at ${pd2.top})`);
clash = await hudClash() || await sizeSweep();
check(!clash, `driving with eight destinations: nothing overlapping or off-screen on any screen size (${clash || 'ok'})`);
await p.evaluate(() => document.getElementById('fsBtn').click()); await p.waitForTimeout(400); // 離開全螢幕：畫面下面的「去哪裡」
const dests2 = await p.evaluate(() => [...document.querySelectorAll('#dests button')].map((x) => { const r = x.getBoundingClientRect(); return { t: x.textContent, y: Math.round(r.y), w: Math.round(r.width) }; }));
const rows = [...new Set(dests2.map((d) => d.y))];
console.log('  not fullscreen:', JSON.stringify(dests2));
check(!(await p.evaluate(() => document.body.classList.contains('fs'))) && rows.length === 2 && dests2.filter((d) => d.y === rows[0]).length === 4 && dests2.length === 8 && Math.max(...dests2.map((d) => d.w)) - Math.min(...dests2.map((d) => d.w)) <= 2, 'not fullscreen: destination bar is two rows (four + four, 內湖, 山頂 added), same width');
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('fsBtn').click(); }); await p.waitForTimeout(400);
check(await p.evaluate(() => document.body.classList.contains('fs')), 'back to fullscreen');
check(pd2.d.find((d) => d.t === '去越野車場')?.p === 'true' && (await driveInfo()).dest === 'offroad', '去越野車場 pressed: drive destination is the off-road park');
let r = await leg('offroad', 'window.__D().home && window.__D().home.or', { act: ['開鐵捲門'] }, 300);
let di = await driveInfo();
console.log('  arrived:', JSON.stringify(di));
check(r.arrived && r.stuck === 0 && r.out2 === 0 && r.acts.includes('開鐵捲門') && /到越野車場了/.test(di.toast), `GC8 opened the roller door and drove from home to the off-road park by road through the traffic (${(r.t).toFixed(0)} s sim), arrival toast shown`);
summary.push(`GC8 home → park: ${r.arrived ? 'arrived' : 'NOT'} · max ${r.max.toFixed(0)} km/h · bumps ${r.bumps} · ${r.ms.toFixed(2)} ms/step · waited ${(r.yields / 60).toFixed(1)} s for traffic`);
let ri = await drawAndShot('2-park-gate');
summary.push(`park gate (GC8, chase cam): ${ri.calls} calls, ${ri.tris} tris`);
check(await p.evaluate(() => { const N = window.__N(), V = window.__D().VIL; return !!N && N.traffic.cars.every((c) => V.offroad.fenceDist(c.x, c.z) < -3) && N.peds.people.filter((q) => !q.gone).every((q) => V.offroad.fenceDist(q.x, q.z) < -3); }), 'no village traffic or residents inside the off-road park (its access road is not a traffic road)');

// ---- 3 越野車行：展示台上的怪獸卡車（走路也擋人）→ 開進買車區 → 同一個面板（只擺越野車）----
await p.evaluate(() => window.__D().drv.setDestination('odealer'));
r = await leg('odealer', 'Math.hypot(window.__D().drv.telemetry().x - window.__D().VIL.places.odealer.display[0].x, window.__D().drv.telemetry().z - window.__D().VIL.places.odealer.display[0].z) < 40', {}, 200);
await p.waitForFunction(() => window.__O().oDisp?.k === 'monster', null, { timeout: 240000 });
// 停下來、下車：走去展示台推（擋住）、腳踩在地形上；走回去上車（同一台接著開）
const pod = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, d = D.drv; window.__drvG = d;
  d.setInput({ throttle: 0, brake: 1, steer: 0 }); for (let i = 0; i < 400 && Math.abs(d.telemetry().v) > 0.2; i++) window.__dstep(1); d.setInput(null); window.__dstep(3);
  const pressed = H.press2(); let n = 0; for (; n < 300 && window.__D().walker.mode !== 'walk'; n++) H.step(1); H.step(10);
  const D2 = window.__D(), W = D2.walker, pad = D2.VIL.places.odealer.display[0], PR = 5; // 門口的大圓台（半徑 5 公尺、高 0.66：人走不上去）＋上面的怪獸卡車
  const t0 = W.telemetry(), a0 = Math.atan2(-(pad.z - t0.z), pad.x - t0.x), sx = pad.x - Math.cos(a0) * (PR + 4), sz = pad.z + Math.sin(a0) * (PR + 4); // 從車子這邊、離台子 4 公尺推過去
  W.teleport({ x: sx, z: sz, heading: a0 }); H.step(20);
  const ph = H.push(a0, 4, 1, false); H.step(10);
  const t = W.telemetry(), R = W.character.radius, gap = Math.hypot(t.x - pad.x, t.z - pad.z) - PR;
  const gy = D2.VIL.heightAt(t.x, t.z), cy = W.character.group.position.y, cam = D2.dcam.position, camG = D2.VIL.heightAt(cam.x, cam.z);
  return { pressed, s: +(n / 60).toFixed(2), moved: +ph.d.toFixed(2), gap: +gap.toFixed(3), R: +R.toFixed(3), gy: +gy.toFixed(3), cy: +cy.toFixed(3), camAbove: +(cam.y - camG).toFixed(2) };
});
console.log('3', el(), 'podium on foot:', JSON.stringify(pod));
check(pod.pressed === '下車' && pod.moved > 1 && pod.gap >= pod.R - 0.05 && pod.gap < pod.R + 0.3, `on foot at 越野車行: walking at the podium with the monster truck on it stops you at its edge (gap ${pod.gap} m, radius ${pod.R})`);
check(Math.abs(pod.cy - pod.gy) < 0.01 && pod.camAbove > 0.3, `on foot in the off-road park you stand on the ground (feet at ${pod.cy}, ground ${pod.gy}); camera ${pod.camAbove} m above the ground`);
await drawAndShot('3a-podium-on-foot');
const bk = await p.evaluate(() => { const D = window.__D(), H = window.__H, W = D.walker, d = window.__drvG, t = d.telemetry(), ci = d.carInfo, c0 = (ci.nose + ci.tail) / 2, f = [Math.cos(t.heading), -Math.sin(t.heading)], rt = [Math.sin(t.heading), Math.cos(t.heading)], cx = t.x + f[0] * c0, cz = t.z + f[1] * c0;
  const at = (u, w) => [cx + f[0] * u + rt[0] * w, cz + f[1] * u + rt[1] * w];
  W.teleport({ x: at(-ci.len / 2 - 2, 0)[0], z: at(-ci.len / 2 - 2, 0)[1], heading: t.heading }); H.step(10);
  const r = H.walkPath([at(-ci.len / 2 - 1.2, -(ci.halfW + 1)), at(0, -(ci.halfW + 0.6))]); const act = H.actText(), pressed = H.press(), b = H.board(); H.step(20);
  const D2 = window.__D(); return { ok: r.ok, act, pressed, modes: b.modes, same: D2.drv === d, paused: D2.drv?.telemetry().paused }; });
console.log('  back in GC8:', JSON.stringify(bk));
check(bk.ok && bk.act === '上車 · GC8' && bk.modes.join('>') === 'in>seat>off' && bk.same && !bk.paused, 'walked back to GC8 on the dirt and got in: the same car carries on');
const oBay = await p.evaluate(() => window.__D().VIL.places.odealer.bay);
r = await leg('odealer', "!document.getElementById('dealer').hidden", { bay: oBay }, 250);
check(r.arrived, 'drove into the 越野車行 bay and the dealer panel opened');
const od = await p.evaluate(() => ({ list: [...document.querySelectorAll('#dealerCars .part')].map((x) => x.querySelector('b').textContent + (x.classList.contains('sel') ? '*' : '') + ':' + x.className.replace('part ', '')),
  buy: document.getElementById('dealerBuyHead').textContent, msg: document.getElementById('dealerMsg').textContent, name: document.getElementById('dealerName').textContent, at: window.__O().dealerAt }));
console.log('  odealer:', JSON.stringify(od));
check(od.at === 'odealer' && od.name === '越野車行' && od.list.length === 1 && /^怪獸卡車\*/.test(od.list[0]) && /買 怪獸卡車/.test(od.buy), '越野車行 lists only off-road vehicles: the monster truck, selected and affordable');
const disp = await p.evaluate(() => { const O = window.__O(), D = window.__D(), pad = D.VIL.places.odealer.display[0], c = O.oDisp.S.car; return { parent: c.parent === D.VIL.group, vis: c.visible, pos: c.position.toArray().map((v) => +v.toFixed(2)), pad: [pad.x, pad.y || 0, pad.z] }; });
console.log('  display:', JSON.stringify(disp));
check(disp.parent && disp.vis && Math.abs(disp.pos[0] - disp.pad[0]) < 0.01 && Math.abs(disp.pos[2] - disp.pad[2]) < 0.01, 'the unbought monster truck stands on the showroom podium');
ri = await drawAndShot('3-odealer');
summary.push(`越野車行 panel (display monster): ${ri.calls} calls, ${ri.tris} tris`);

// ---- 4 買怪獸卡車：停在車行門口，開它；GC8 車行送回車庫（停上升降機；怪獸卡車不停升降機、沒有名牌）----
const m0 = await p.evaluate(() => window.__G().money);
await p.evaluate(() => { const bb = document.getElementById('dealerBuy'); bb.click(); bb.click(); });
await p.waitForFunction(() => window.__D().cur === 'monster' && window.__D().drv && !window.__D().drv.telemetry().paused, null, { timeout: 300000 });
await p.waitForFunction(() => window.__D().LODS.gc8?.lod, null, { timeout: 120000 });
await p.evaluate(() => window.__dstep(2));
di = await driveInfo();
const sw = await p.evaluate(() => { const D = window.__D(), ex = D.VIL.places.odealer.exit, t = D.drv.telemetry(); return { money: window.__G().money, owned: [...window.__G().owned], atExit: Math.hypot(t.x - ex.x, t.z - ex.z) < 0.05, tripIsS: D.tripS === window.__S(), oDisp: window.__O().oDisp, halfW: D.drv.carInfo.halfW,
  deck: D.DECK.indexOf('gc8'), decks: D.DECK.join(), park: window.__G().park, gc8Pose: D.tripPose.gc8?.deck ?? null, dmg: !!D.tripS.dmg, dmgH: D.tripS.dmg?.health }; });
console.log('4', el(), 'bought:', JSON.stringify(sw), JSON.stringify(di), '| lods', JSON.stringify(await lodAt()), '| plates', JSON.stringify(await plates('town')));
check(sw.money === m0 - 100 && sw.owned.includes('monster') && sw.atExit && sw.tripIsS && di.cur === 'monster' && !di.paused && di.voice, 'bought the monster truck (−100 萬): it waits at the 越野車行 exit, engine running');
check(di.dest === 'orace' && /起跑區/.test(di.toast), `next stop: the off-road race start (dest ${di.dest}, toast "${di.toast}")`);
check(sw.oDisp === null && (await lodAt()).gc8 === 'town-garage' && sw.deck >= 0 && sw.gc8Pose === sw.deck, `podium cleared (nothing left to sell); old GC8 was delivered onto a lift deck at home (deck ${sw.deck})`);
check(!sw.decks.includes('monster') && !sw.park.decks.includes('monster') && !(await plates('town')).length, 'the monster truck (3.81 m wide: too wide for a 3.7 m lift) is never put on a lift deck, and no lift shows a name plate without a car');
check(di.rideOn === true && sw.halfW === 1.905, `off-road vehicle uses the terrain ride everywhere (cls ${di.rcls}); collision half width is the tyres (${sw.halfW} m)`);
check(!sw.dmg, 'no crash damage attached to the monster truck (撞爛 is off)');
ri = await drawAndShot('4-monster-bought');

// ---- 5 下車：站在輪胎外面、踩在地形上；繞到另一邊（副駕駛那邊）再上車：同一台接著開 ----
const o5 = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, d = D.drv; window.__drvM = d;
  const act2 = H.act2(), pressed = H.press2(); let n = 0; for (; n < 300 && window.__D().walker.mode !== 'walk'; n++) H.step(1); H.step(20);
  const D2 = window.__D(), W = D2.walker, t = W.telemetry(), ct = d.telemetry(), ci = d.carInfo, c0 = (ci.nose + ci.tail) / 2, f = [Math.cos(ct.heading), -Math.sin(ct.heading)], rt = [Math.sin(ct.heading), Math.cos(ct.heading)], cx = ct.x + f[0] * c0, cz = ct.z + f[1] * c0;
  const dx = t.x - cx, dz = t.z - cz, along = dx * f[0] + dz * f[1], side = dx * rt[0] + dz * rt[1];
  return { act2, pressed, s: +(n / 60).toFixed(2), mode: t.mode, side: +side.toFixed(2), along: +along.toFixed(2), halfW: ci.halfW, R: +W.character.radius.toFixed(3), gy: +D2.VIL.heightAt(t.x, t.z).toFixed(3), cy: +W.character.group.position.y.toFixed(3), paused: ct.paused, voice: !!D2.dvoice, cars: W.cars.map((c) => c.key) };
});
console.log('5', el(), '下車 (monster):', JSON.stringify(o5));
check(o5.act2 === '下車' && o5.pressed === '下車' && o5.mode === 'walk' && o5.paused && !o5.voice && o5.side <= -(o5.halfW + o5.R - 0.05) && Math.abs(o5.along) < 1.5,
  `下車 from the monster truck: you step out on the driver side outside the big tyres (${Math.abs(o5.side)} m from the middle, tyres ${o5.halfW} m), engine off`);
check(Math.abs(o5.cy - o5.gy) < 0.01, `standing on the dirt next to it (feet ${o5.cy}, ground ${o5.gy})`);
await drawAndShot('5a-monster-out');
const i5 = await p.evaluate(() => { // 從車頭繞到另一邊（每一步腳都踩在地面上）、按上車
  const D = window.__D(), H = window.__H, W = D.walker, d = window.__drvM, t = d.telemetry(), ci = d.carInfo, c0 = (ci.nose + ci.tail) / 2, f = [Math.cos(t.heading), -Math.sin(t.heading)], rt = [Math.sin(t.heading), Math.cos(t.heading)], cx = t.x + f[0] * c0, cz = t.z + f[1] * c0;
  const at = (u, w) => [cx + f[0] * u + rt[0] * w, cz + f[1] * u + rt[1] * w];
  let worst = 0; const ws = window.__wstep; // 每走一步都量：腳（角色的原點）跟地面差多少
  window.__wstep = (k = 1, dt) => { let out; for (let i = 0; i < k; i++) { out = ws(1, dt); const q = W.telemetry(); worst = Math.max(worst, Math.abs(W.character.group.position.y - D.VIL.heightAt(q.x, q.z))); } return out; };
  let r; try { r = H.walkPath([at(ci.len / 2 + 1.4, -(ci.halfW + 0.9)), at(ci.len / 2 + 1.4, ci.halfW + 0.9), at(0.2, ci.halfW + 0.7)]); } finally { window.__wstep = ws; }
  const act = H.actText(), pressed = H.press(), b = H.board(); H.step(40);
  const D2 = window.__D(); return { ok: r.ok, at: r.at, worst: +worst.toFixed(4), act, pressed, modes: b.modes, same: D2.drv === d, paused: D2.drv?.telemetry().paused, voice: !!D2.dvoice?.alive, hidden: D2.walker.telemetry().hidden, act2: H.act2() };
});
console.log('  around and in again:', JSON.stringify(i5));
check(i5.ok && i5.worst < 0.01 && i5.act === '上車 · 怪獸卡車' && i5.modes.join('>') === 'in>seat>off' && i5.same && !i5.paused && i5.voice && i5.hidden,
  `walked around the front of the monster truck on the dirt (feet on the ground every step, worst ${i5.worst} m) and got in from the passenger side: the same truck carries on`);

// ---- 6 開怪獸卡車到起跑區：自己停到起跑位置 → 倒數 → 越野賽（第一場）----
r = await leg('orace', 'window.__O().orRace !== null', { prop: true, vmax: 14 }, 250);
check(r.arrived, 'monster truck drove to the race start; the game parked it on the grid and started the race');
const lvl = await p.evaluate(() => { const R = window.__O().orRace; return { state: R.state, id: R.def.id, name: R.def.name, laps: R.def.laps, ais: R.ais.length, prize: R.def.prize }; });
console.log('6', el(), 'race:', JSON.stringify(lvl));
check(lvl.state === 'count' && lvl.id === 'mud1' && lvl.ais >= 1 && lvl.ais <= 3, `first unwon race starts with a countdown (${lvl.name}, ${lvl.ais} opponents, ${lvl.laps} laps)`);
await p.evaluate(() => window.__dstep(30));
ri = await drawAndShot('6-race-grid');
summary.push(`race grid (monster + ${lvl.ais} AI): ${ri.calls} calls, ${ri.tris} tris`);
await resetP();
await p.evaluate(() => { window.__raceShotAt = 25; });
let rr = null;
for (let i = 0; i < 400; i++) {
  rr = await p.evaluate(() => window.__pp.race(300, { vcap: 31, lat: 6.5 }));
  if (rr.pause) {
    ri = await drawAndShot('6b-race-mid'); summary.push(`mid race: ${ri.calls} calls, ${ri.tris} tris`);
    check(await p.evaluate(() => document.body.classList.contains('orracing') && getComputedStyle(document.getElementById('dests')).display === 'none'), 'destination pills hidden during the race');
    continue;
  }
  if (rr.end) break;
}
const rs = await pStats();
const res = await p.evaluate(() => { const R = window.__O().orRace; return R && { state: R.state, result: R.result, standings: R.standings().map((c) => `${c.name} ${c.fin != null ? c.fin.toFixed(1) : '-'}`), panel: document.querySelector('.orr-r')?.innerText.replace(/\n+/g, ' | ') }; });
const g1 = await p.evaluate(() => ({ money: window.__G().money, wins: { ...window.__G().wins }, trophies: window.__O().trophies }));
const sv1 = await saved();
console.log('  race end:', JSON.stringify(res), JSON.stringify(g1), `· ${rs.ms.toFixed(2)} ms/step (${rs.n}) · air ${rs.air.toFixed(1)} s · lands ${JSON.stringify(rs.lands)} · pen ${rs.pen.toFixed(3)}`);
check(res?.state === 'done' && res.result?.won && res.result.place === 1, `won the race (${res?.result ? res.result.time.toFixed(1) + ' s' : '-'}; ${res?.standings?.join(', ')})`);
check(g1.money === sw.money + lvl.prize && g1.wins['or:mud1'] === 1 && sv1.wins?.['or:mud1'] === 1 && sv1.money === g1.money, `prize paid (+${lvl.prize} 萬) and the win saved as wins['or:mud1']`);
check(g1.trophies === 0, 'off-road wins do not count as garage trophies (trophy case holds drag-race wins)');
check(/第 1 名/.test(res?.panel || '') && /獎金/.test(res?.panel || '') && /再比一次/.test(res?.panel || '') && /開走/.test(res?.panel || ''), `result panel: 第 1 名, prize line, 再比一次 / 開走 (${res?.panel})`);
check(!rs.lands.some((l) => l.hard), `no hard landings in the race (${rs.lands.length} landings, max ${rs.lands.length ? Math.max(...rs.lands.map((l) => l.speed)).toFixed(1) : 0} m/s)`);
summary.push(`race mud1 (monster): ${res?.result ? res.result.time.toFixed(1) + ' s, place ' + res.result.place + '/' + res.result.n : '-'} · ${rs.ms.toFixed(2)} ms/step JS (drive + race + AI) · ${rs.lands.length} landings`);
await p.evaluate(() => window.__dstep(20)); ri = await drawAndShot('7-race-result');
// 按「開走」：比賽收掉、煞車放開、目的地（買不起別台越野車 → 回車庫）
await p.evaluate(() => document.querySelector('.orr-r button.a').click());
await p.evaluate(() => window.__dstep(40));
di = await driveInfo();
const aft = await p.evaluate(() => ({ race: window.__O().orRace, hud: !!document.querySelector('.orr'), orcp: !!window.__D().VIL.places.orcp }));
console.log('  after 開走:', JSON.stringify(aft), JSON.stringify(di));
check(aft.race === null && !aft.hud && !aft.orcp && di.brake < 0.05 && !di.paused && di.dest === 'garage', `開走: race cleared, brake released (${di.brake}), destination home`);
check(await p.evaluate(() => { const B = document.body.classList, tog = getComputedStyle(document.getElementById('destTog')).display !== 'none'; if (!B.contains('destsopen')) document.getElementById('destTog').click();
  const list = getComputedStyle(document.getElementById('dests')).display !== 'none'; document.getElementById('destTog').click(); return !B.contains('orracing') && tog && list && !B.contains('destsopen'); }), 'destination pills back after the race (「📍 去哪裡 ▾」 opens them)');
await p.evaluate(() => { const d = window.__D().drv; d.setInput({ throttle: 0, brake: 1, steer: 0 }); for (let i = 0; i < 400 && Math.abs(d.telemetry().v) > 0.3; i++) window.__dstep(1); d.setInput(null); }); // 開走：先停下來（跟玩的人一樣）

// ---- 6b 走路爬坡：下車，走上賽道最陡的那段（跳台）：每一步腳都踩在地面上、鏡頭不會鑽進地底；走回來上車 ----
const sl = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, V = D.VIL, CR = V.offroad.course, d = D.drv; window.__drvM = d;
  let best = null; // 賽道上最陡的上坡（照開的方向）
  for (let s = 0; s < CR.len; s += 2) { const c = CR.at(s), c2 = CR.at(s + 2), g = (V.heightAt(c2.x, c2.z) - V.heightAt(c.x, c.z)) / 2; if (!best || g > best.g) best = { s, g, x: c.x, z: c.z, tx: c.tx, tz: c.tz }; }
  const pressed = H.press2(); let n = 0; for (; n < 300 && window.__D().walker.mode !== 'walk'; n++) H.step(1); H.step(10);
  const W = window.__D().walker, a = Math.atan2(-best.tz, best.tx);
  W.teleport({ x: best.x - best.tx * 5, z: best.z - best.tz * 5, heading: a }); H.step(10);
  const y0 = W.character.group.position.y;
  let worst = 0, camLow = Infinity, steps = 0; const ws = window.__wstep;
  window.__wstep = (k = 1, dt) => { let out; for (let i = 0; i < k; i++) { out = ws(1, dt); steps++; const q = W.telemetry(); worst = Math.max(worst, Math.abs(W.character.group.position.y - V.heightAt(q.x, q.z))); const cp = window.__D().dcam.position; camLow = Math.min(camLow, cp.y - V.heightAt(cp.x, cp.z)); } return out; };
  let r; try { r = H.walkTo(best.x + best.tx * 6, best.z + best.tz * 6, { max: 15 }); } finally { window.__wstep = ws; }
  const y1 = W.character.group.position.y;
  return { pressed, grade: +best.g.toFixed(2), at: [Math.round(best.x), Math.round(best.z)], ok: r.ok, climbed: +(y1 - y0).toFixed(2), worst: +worst.toFixed(4), camLow: +camLow.toFixed(2), steps };
});
console.log('6b', el(), 'walk up the steepest ramp:', JSON.stringify(sl));
check(sl.pressed === '下車' && sl.ok && sl.climbed > 0.5 && sl.worst < 0.01 && sl.camLow > 0.2, `on foot up the steepest ramp of the course (grade ${sl.grade}): climbed ${sl.climbed} m with the feet on the ground every step (worst ${sl.worst} m), camera always above the ground (lowest ${sl.camLow} m)`);
await drawAndShot('6c-walk-ramp');
const sb = await p.evaluate(() => { const D = window.__D(), H = window.__H, W = D.walker, d = window.__drvM, t = d.telemetry(), ci = d.carInfo, c0 = (ci.nose + ci.tail) / 2, f = [Math.cos(t.heading), -Math.sin(t.heading)], rt = [Math.sin(t.heading), Math.cos(t.heading)];
  const x = t.x + f[0] * c0 - rt[0] * (ci.halfW + 1.6), z = t.z + f[1] * c0 - rt[1] * (ci.halfW + 1.6); W.teleport({ x, z, heading: t.heading }); H.step(10);
  const r = H.walkTo(t.x + f[0] * c0 - rt[0] * (ci.halfW + 0.6), t.z + f[1] * c0 - rt[1] * (ci.halfW + 0.6)); const act = H.actText(), pressed = H.press(), b = H.board(); H.step(20);
  const D2 = window.__D(); return { ok: r.ok, act, pressed, modes: b.modes, same: D2.drv === d, paused: D2.drv?.telemetry().paused }; });
check(sb.ok && sb.act === '上車 · 怪獸卡車' && sb.modes.join('>') === 'in>seat>off' && sb.same && !sb.paused, 'back at the truck: got in again (same truck)');

// ---- 7 撞牆：怪獸卡車油門踩到底撞牆（前面放一道牆）→ 撞到了，但不會凹（撞爛拿掉了）----
const c7 = await p.evaluate(() => {
  const D = window.__D(), d = D.drv, t = d.telemetry(), f = [Math.cos(t.heading), -Math.sin(t.heading)], m = D.tripS.dmg, h0 = m ? m.health : null, b0 = t.bumps;
  d.addColliders([{ t: 'box', x: t.x + f[0] * 18, z: t.z + f[1] * 18, hx: 0.3, hz: 6, rot: t.heading, h: 3 }], 'test-wall');
  d.setInput({ throttle: 1, brake: 0, steer: 0 }); let vmax = 0, n = 0; const c = performance.now();
  for (; n < 900 && d.telemetry().bumps === b0; n++) { window.__dstep(1); vmax = Math.max(vmax, d.telemetry().kmh); }
  const ms = performance.now() - c;
  d.setInput({ throttle: 0, brake: 1, steer: 0 }); window.__dstep(60); d.setInput(null); d.removeColliders('test-wall'); window.__dstep(2);
  const G = window.__G(), sv = JSON.parse(localStorage.getItem('carid.tune') || '{}');
  return { h0, h1: m && +m.health.toFixed(3), power: m && +m.perf.power.toFixed(3), vmax: +vmax.toFixed(1), s: +(n / 60).toFixed(2), hits: G.dmg?.monster?.h?.length || 0, saved: !!sv.dmg?.monster, hitMs: m?.lastMs, frameMs: +(ms / Math.max(1, n)).toFixed(2), toast: document.querySelector('#stage .dv-toast')?.textContent || '' };
});
await p.waitForTimeout(700); c7.saved = !!(await saved()).dmg?.monster; // save() 等 0.3 秒才寫
console.log('7', el(), 'crash:', JSON.stringify(c7));
check(c7.s < 15 && c7.h0 === null && c7.hits === 0 && !c7.saved, `the monster truck hits a wall at ${c7.vmax} km/h: no damage, nothing saved`);
ri = await drawAndShot('7b-monster-crashed');

// ---- 8 改車廠：修好、裝引擎零件 ----
await p.evaluate(() => document.querySelector('#dests button[data-d="shop"]').click());
const shopBay = await p.evaluate(() => window.__D().VIL.places.shop.bay);
r = await leg('shop', "!document.getElementById('shop').hidden", { bay: shopBay, prop: true }, 300);
check(r.arrived && r.stuck === 0 && r.out2 === 0, `monster truck drove from the park through the village traffic to the tuning shop and parked (${r.t.toFixed(0)} s sim)`);
summary.push(`monster park → shop: ${r.arrived ? 'arrived' : 'NOT'} · max ${r.max.toFixed(0)} km/h · bumps ${r.bumps} · ${r.ms.toFixed(2)} ms/step · waited ${(r.yields / 60).toFixed(1)} s for traffic`);
const fx = await p.evaluate(() => { const g = document.getElementById('shopFixG'), b = document.querySelector('#shopFix .part'); if (!b) return { shown: !g.hidden }; const m0 = window.__G().money, price = b.querySelector('.p').textContent; b.click(); b.click(); const D = window.__D(); return { shown: true, price, m0, m1: window.__G().money, left: window.__G().dmg?.monster ?? null, health: D.tripS?.dmg?.health, after: !g.hidden }; });
console.log('8', el(), 'repair:', JSON.stringify(fx));
check(!fx.shown, '改車廠 has nothing to repair (crash damage is off)');
const eng0 = await txt('#shopEng');
const part = await p.evaluate(() => { const bb = document.querySelector('#shopParts .part.can'), m = window.__G().money; if (!bb) return null; const name = bb.querySelector('b').textContent; bb.click(); bb.click(); return { name, m0: m, m1: window.__G().money, parts: [...(window.__G().parts.monster || [])] }; });
const eng1 = await txt('#shopEng');
console.log('  shop:', eng0, '→', eng1, JSON.stringify(part));
check(/機械增壓 V8/.test(eng0 || '') && part && part.m1 < part.m0 && part.parts.length === 1 && eng0 !== eng1, `engine upgrade for the monster truck (${part?.name}: ${eng0} → ${eng1})`);
await p.evaluate(() => window.scrollTo(0, 0)); await drawAndShot('8-shop-monster');
await p.evaluate(() => document.getElementById('shopGo').click());
check(await p.evaluate(() => !window.__D().tripS?.dmg), 'the monster truck drives away with no damage object');

// ---- 9 開回家：開鐵捲門 → 開進去 → 下車（升降機上不停：沒有輕量車）→ 走去開 GC8（怪獸卡車照停著）→ 走回去開怪獸卡車 → 直接回車庫 ----
await p.evaluate(() => document.querySelector('#dests button[data-d="garage"]').click());
r = await leg('garage', "(() => { const D = window.__D(), t = D.drv.telemetry(); return window.__pp.inBox(D.VIL.places.garage.inside, t.x, t.z) && Math.abs(t.v) < 0.3; })()", { act: ['開鐵捲門'], prop: true }, 300);
check(r.arrived && r.acts.includes('開鐵捲門'), `the monster truck came home: opened the roller door from the truck and drove into the garage (${r.t.toFixed(0)} s sim)`);
summary.push(`monster shop → home: ${r.arrived ? 'arrived' : 'NOT'} · max ${r.max.toFixed(0)} km/h · bumps ${r.bumps} · ${r.ms.toFixed(2)} ms/step`);
const pk = await p.evaluate(() => { const D = window.__D(), H = window.__H; D.drv.setInput(null); window.__dstep(40); const t = D.drv.telemetry(), q = H.gl(t.x, t.z); return { act: H.actText(), act2: H.act2(), v: +t.v.toFixed(3), local: [+q.x.toFixed(2), +q.z.toFixed(2)], paused: t.paused }; });
console.log('9', el(), 'home:', JSON.stringify(pk));
check(pk.act2 === '下車' && pk.act == null && !pk.paused && Math.abs(pk.v) < 1, 'stopped inside the garage: only 下車 (no 停好熄火)');
await drawAndShot('9-home-inside');
// 開到 3 號升降機（跟地板平的空平台）上下車：不停上去（沒有輕量車），車子就停在那裡、平台照樣空的；再上車開到中間停好
const dk9 = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, lf = D.GAR.lifts[2], id = lf.floorDeck ? lf.id : 6 + lf.id; window.__drvH = D.drv;
  D.drv.teleport(H.gw(lf.x + 0.2, lf.z + 0.1, 0.04)); window.__dstep(5);
  const pressed = H.press2(); let n = 0; for (; n < 300 && window.__D().walker.mode !== 'walk'; n++) H.step(1); H.step(20);
  const D2 = window.__D(), c = D2.tripS.car, q = H.gl(c.position.x, c.position.z);
  return { pressed, mode: D2.walker.mode, id, deck: D2.DECK[id], onDeck: c.parent === lf.platforms[lf.floorDeck], car: [+q.x.toFixed(2), +q.z.toFixed(2)], pose: D2.tripPose.monster.deck ?? null, park: window.__G().park.decks.join(), drv: !!D2.drv, act: H.actText(), toast: document.querySelector('#stage .wk-toast.show')?.textContent || '' };
});
console.log('  下車 on lift 3:', JSON.stringify(dk9), '| plates', JSON.stringify(await plates('town')));
check(dk9.pressed === '下車' && dk9.mode === 'walk' && dk9.deck === null && !dk9.onDeck && dk9.pose === null && !dk9.park.includes('monster') && dk9.drv && !(await plates('town')).length && !/升降機/.test(dk9.toast),
  'getting out of the monster truck on an empty lift deck does not park it on the lift (too wide for the lift): it just stays there, the deck stays empty, no name plate');
const mid9 = await p.evaluate(() => { const D = window.__D(), H = window.__H; const act = H.actText(), pressed = H.press(), b = H.board(); H.step(20); const D2 = window.__D(), same = D2.drv === window.__drvH; D2.drv.teleport(H.gw(0.25, 0.15, 0.04)); window.__dstep(5);
  const p2 = H.press2(); let n = 0; for (; n < 300 && window.__D().walker.mode !== 'walk'; n++) H.step(1); H.step(20); const D3 = window.__D(), c = D3.tripS.car, q = H.gl(c.position.x, c.position.z), t = D3.walker.telemetry(), me = H.gl(t.x, t.z);
  return { act, pressed, modes: b.modes, same, p2, car: [+q.x.toFixed(3), +q.z.toFixed(3)], me: [+me.x.toFixed(2), +me.z.toFixed(2)], mid: D3.midCar(), parkMid: window.__G().park.mid }; });
console.log('  parked in the middle:', JSON.stringify(mid9));
check(mid9.act === '上車 · 怪獸卡車' && mid9.same && mid9.p2 === '下車' && Math.abs(mid9.car[0]) < 0.01 && Math.abs(mid9.car[1]) < 0.01 && mid9.mid === 'monster' && mid9.parkMid === 'monster', 'got back in, drove to the middle and got out: the monster truck straightens itself onto the turntable spot');
// 走去 GC8（車行送回來停在升降機上）→ 上車：怪獸卡車（完整的車）停在原地、看得到、擋人、可以再上
const toG = await p.evaluate(() => { const D = window.__D(), H = window.__H, id = D.DECK.indexOf('gc8'), lf = D.GAR.lifts[id % 6];
  const r = H.walkLocal([[-3.9, -2.5], [-3.9, lf.z - 1.35], [lf.x + 1.6, lf.z - 1.35], [lf.x + 0.3, lf.z - 1.3]]); return { id, ok: r.ok, at: r.at, act: H.actText() }; });
console.log('  to GC8:', JSON.stringify(toG));
check(toG.ok && toG.act === '上車 · GC8', `walked around the monster truck to GC8 on its lift deck (deck ${toG.id}): 「${toG.act}」`);
const sg = await p.evaluate(() => { const H = window.__H, pressed = H.press(), b = H.board(); return { pressed, modes: b.modes }; });
await p.waitForFunction(() => window.__D().cur === 'gc8' && window.__D().drv && !window.__D().drv.telemetry().paused, null, { timeout: 300000 });
await p.evaluate(() => window.__H.step(40));
const pf = await p.evaluate(() => { const D = window.__D(), O = window.__O(), F = O.PFULL.monster, ps = D.tripPose.monster, c = F?.S.car, H = window.__H, q = c && H.gl(c.position.x, c.position.z); return { pf: Object.keys(O.PFULL), vis: !!c?.visible, inScene: c?.parent === D.TR.scene, at: c ? +Math.hypot(c.position.x - ps.x, c.position.z - ps.z).toFixed(4) : null, dh: c ? +H.wrapA(c.rotation.y - ps.heading).toFixed(4) : null, local: q && [+q.x.toFixed(3), +q.z.toFixed(3)], sd: !!F?.sd?.visible, cars: D.walker.cars.map((x) => x.key), cur: D.cur, gc8Deck: D.DECK.indexOf('gc8'), full: D.tripS.car.parent === D.TR.scene, built: Object.keys(D.built) }; });
console.log('  switched to GC8:', JSON.stringify(sg), JSON.stringify(pf));
check(sg.pressed === '上車 · GC8' && sg.modes.join('>') === 'in>seat>off' && pf.cur === 'gc8' && pf.gc8Deck === -1 && pf.full, 'switched to GC8 on foot: it became the full car and drives off its lift deck');
check(pf.pf.join() === 'monster' && pf.vis && pf.inScene && pf.at < 0.001 && Math.abs(pf.dh) < 0.001 && pf.sd && pf.cars.includes('monster'), `the monster truck (big: its light model would sit flat at y 0) stays parked where you left it as the full model, with its shadow, and can be boarded again (${JSON.stringify(pf.local)})`);
await drawAndShot('10-gc8-monster-parked');
// GC8 開到後面一點下車，走回怪獸卡車上車：換回怪獸卡車（GC8 換成輕量車停著）
const bm = await p.evaluate(() => { const D = window.__D(), H = window.__H; D.drv.teleport(H.gw(-6.6, -0.2, 0)); window.__dstep(5); const pressed = H.press2(); let n = 0; for (; n < 300 && window.__D().walker.mode !== 'walk'; n++) H.step(1); H.step(20);
  const r = H.walkLocal([[-4.0, -2.6], [-0.3, -2.5]]); return { pressed, ok: r.ok, at: r.at, act: H.actText() }; });
const bm2 = await p.evaluate(() => { const H = window.__H, pressed = H.press(), b = H.board(); return { pressed, modes: b.modes }; });
await p.waitForFunction(() => window.__D().cur === 'monster' && window.__D().drv && !window.__D().drv.telemetry().paused, null, { timeout: 300000 });
await p.evaluate(() => window.__H.step(40));
const bm3 = await p.evaluate(() => { const D = window.__D(), O = window.__O(); return { pf: Object.keys(O.PFULL), cur: D.cur, S: window.__S() === D.tripS, voice: !!D.dvoice?.alive, gc8: D.tripPose.gc8 && D.tripPose.gc8.deck == null, lod: !!D.LODS.gc8?.lod?.car.parent, cars: D.walker.cars.map((x) => x.key), part: (window.__G().parts.monster || []).length }; });
console.log('  back in the monster truck:', JSON.stringify(bm), JSON.stringify(bm2), JSON.stringify(bm3), JSON.stringify(await lodAt()));
check(bm.pressed === '下車' && bm.ok && bm.act === '上車 · 怪獸卡車' && bm2.modes.join('>') === 'in>seat>off' && bm3.cur === 'monster' && bm3.S && !bm3.pf.length && bm3.voice && bm3.gc8 && bm3.lod && bm3.cars.includes('gc8'),
  'walked back to the parked monster truck and drove it again (GC8 stays where you left it, as the light-weight car)');
await drawAndShot('11-monster-again');
await p.evaluate(() => document.getElementById('driveHome').click());
await p.evaluate(() => { window.__hold = false; window.__noDraw = false; }); await p.waitForTimeout(2500);

// ---- 10 車庫頁：怪獸卡車（鏡頭拉遠、升降機不升）、換顏色、換拉花 ----
const home = await p.evaluate(() => { const S = window.__S(), D = window.__D(), O = window.__O(), R = window.__room(), cam = window.__cam(); return { cls: document.body.className, car: document.getElementById('carName').textContent, parent: S.car.parent === window.__scene(), trip: D.trip, big: O.bigCam, ty: +window.__controls().target.y.toFixed(2), sig: R?.baySig, opts: !document.getElementById('opts').hidden, paints: document.querySelectorAll('#paints .chip').length, paint0: document.querySelector('#paints .chip')?.title,
  levels: R.lifts.map((lf) => lf.level).join(''), cap: cam.camCap, maxD: +cam.maxD.toFixed(2), dist: +cam.dist.toFixed(2), fitD: +cam.fitD.toFixed(2), park: window.__G().park, pf: Object.keys(O.PFULL) }; });
console.log('10', el(), 'home:', JSON.stringify(home), '| lods', JSON.stringify(await lodAt()), '| plates', JSON.stringify(await plates('page')));
check(home.cls === '' && home.car === '怪獸卡車' && home.parent && !home.trip && home.opts && home.paints >= 9 && home.paint0 === '怪獸桃紅' && !home.pf.length, `garage page shows the monster truck with its own options (${home.paints} paints: its 9 + the shared extras)`);
check(home.big === 1.55 && home.ty === 1.45 && home.cap === Infinity && home.levels === '111111' && home.dist >= home.fitD, `big-vehicle camera: pulled back 1.55× (${home.dist} m), looking higher; lifts not raised so nothing caps the camera`);
check(/GC8/.test(home.sig || '') && /YARIS/.test(home.sig || '') && !/怪獸/.test(home.sig || '') && (await lodAt()).gc8 === 'page' && home.park.mid === 'monster' && !home.park.decks.includes('monster') && !(await plates('page')).length, 'GC8 and YARIS on the page garage lifts; the monster truck only on the turntable; no empty-deck name plates');
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1200);
await p.screenshot({ path: `${prefix}-12-garage-monster.png` }); console.log('  shot', `${prefix}-12-garage-monster.png`, el());
await p.evaluate(() => { document.querySelectorAll('#paints .chip')[1].click(); document.querySelector('.seg[data-opt="livery"] button[data-v="fire"]').click(); document.querySelector('.seg[data-opt="height"] button[data-v="0.3"]').click(); });
await p.waitForTimeout(2500);
const look = await p.evaluate(() => { const st = window.__G ? JSON.parse(localStorage.getItem('carid.tune')).cars?.monster : null; return st; });
console.log('  look saved:', JSON.stringify(look));
check(look && look.paint === '#1d4fd8' && look.livery === 'fire' && look.height === '0.3', 'custom look (寶藍, 怪獸火焰, 超高) applied and saved');
await p.screenshot({ path: `${prefix}-13-garage-monster-look.png` }); console.log('  shot', `${prefix}-13-garage-monster-look.png`, el());

// ---- 11 重新整理：怪獸卡車、錢、贏過的越野賽、零件、外觀都在 ----
const keep = await p.evaluate(() => ({ money: window.__G().money, owned: [...window.__G().owned].sort().join(), cur: window.__D().cur, park: JSON.stringify(window.__G().park), dmg: JSON.stringify(window.__G().dmg?.monster ?? null) }));
await p.reload({ waitUntil: 'domcontentloaded' }); await ready(); await p.waitForTimeout(1500);
const re = await p.evaluate(() => ({ money: window.__G().money, owned: [...window.__G().owned].sort().join(), cur: window.__D().cur, parts: (window.__G().parts.monster || []).length, win: window.__G().wins['or:mud1'], lvl: window.__O().lvl, paint: window.__S().car && JSON.parse(localStorage.getItem('carid.tune')).cars?.monster?.paint, big: window.__O().bigCam, trophies: window.__O().trophies, park: JSON.stringify(window.__G().park), dmg: JSON.stringify(window.__G().dmg?.monster ?? null) }));
console.log('11', el(), 'reload:', JSON.stringify(keep), '→', JSON.stringify(re));
check(re.money === keep.money && re.owned === keep.owned && re.cur === 'monster' && re.parts === 1 && re.win === 1 && re.lvl === 1 && re.paint === '#1d4fd8' && re.big === 1.55 && re.trophies === 0 && re.park === keep.park && re.dmg === keep.dmg,
  `reload keeps the monster truck, money, the off-road win (next race: level 2), engine part, look, lift parking and its condition (${keep.dmg === 'null' ? 'as repaired' : 'dented again on the way home'})`);
await p.evaluate(() => document.querySelector('#cars button[data-car="gc8"]').click()); await p.waitForTimeout(3000);
const back = await p.evaluate(() => ({ cur: window.__D().cur, big: window.__O().bigCam, ty: +window.__controls().target.y.toFixed(2), sig: window.__room().baySig, dist: +window.__cam().dist.toFixed(2), maxD: +window.__cam().maxD.toFixed(2) }));
check(back.cur === 'gc8' && back.big === 1 && back.ty === 0.55 && !/GC8/.test(back.sig) && back.dist <= back.maxD + 1e-6, `switching back to GC8 restores the normal camera (${JSON.stringify(back)})`);

// ---- 12 越野車專屬位（orbay.js）：開別台（GC8）出門的時候，怪獸卡車停在越野車車庫自己的格子；走過去開鐵捲門、上車、再開出來 ----
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.waitForFunction(() => window.__D().LODS.monster?.lod?.car.parent === window.__D().VIL.group && window.__D().LODS.gc8 && window.__D().tripS, null, { timeout: 120000 });
const bs = await p.evaluate(() => {
  const D = window.__D(), OB = D.OB, L = D.LODS.monster, c = L.lod.car, b0 = OB.bays[0];
  const wc = D.walker.cars.find((q) => q.key === 'monster'), sg = OB.group.getObjectByName('orbay-sign');
  return { cur: D.cur, at: +Math.hypot(c.position.x - b0.x, c.position.z - b0.z).toFixed(3), dh: +window.__H.wrapA(c.rotation.y - b0.heading).toFixed(3), y: c.position.y,
    bay: D.baySpot('monster')?.bay, bays: OB.bays.length, size: OB.size, mark: !!D.VIL.group.getObjectByName('bigspot'), place: !!D.VIL.places.orbay,
    sign: OB.signs.wall, bayText: OB.signs.bay, signTris: sg ? sg.geometry.attributes.position.count / 3 : 0, meshes: OB.info.meshes, obTris: OB.info.tris,
    walk: wc ? { h: wc.h, hz: +wc.hz.toFixed(2) } : null, decks: D.DECK.map((k) => k || '-').join(','), tris: L.lod.tris, draws: L.lod.draws, shadow: L.shadow.visible,
    pf: Object.keys(window.__O().PFULL), mini: D.VIL.buildings.filter((b) => b.name === '越野車車庫').length, face: +window.__H.wrapA(b0.heading - OB.rot).toFixed(3) };
});
console.log('12', el(), 'orbay:', JSON.stringify(bs), '| plates', JSON.stringify(await plates('town')));
check(bs.cur === 'gc8' && bs.at < 0.05 && Math.abs(bs.dh) < 0.01 && Math.abs(bs.face + Math.PI / 2) < 0.01 && bs.y === 0 && bs.bay === 0 && !bs.mark && bs.shadow && !bs.decks.includes('monster') && !(await plates('town')).length && !bs.pf.length,
  'going out in GC8: the monster truck waits as the light-weight model in bay 1 of the 越野車車庫 annex, nose out towards the aisle (the old apron 大車位 marks are gone), not on a lift, no name plates');
check(bs.bays === 4 && bs.size.bayW === 5.4 && bs.size.bayD === 8 && bs.size.ceil >= 6.5 && bs.size.doorH >= 5.6 && bs.size.doorW >= 9 && bs.sign === '越野車專用' && bs.bayText === '越野車' && bs.signTris > 0 && bs.meshes <= 8 && bs.place && bs.mini === 1,
  `the annex: ${bs.bays} bays of ${bs.size.bayW} × ${bs.size.bayD} m, ${bs.size.ceil} m inside, a ${bs.size.doorH} m roller door, the 「${bs.sign}」 sign over it, ${bs.meshes} merged meshes / ${bs.obTris} triangles, and it draws on the mini-map like the garage`);
check(bs.walk && bs.walk.h === 3 && bs.walk.hz >= 1.9 && bs.tris < 40000 && bs.draws <= 5, `its light model is phone-light (${bs.draws} draw calls, ${bs.tris} triangles) and walkable-to like the other parked cars (camera height ${bs.walk?.h} m)`);
// 第 10 批：越野車車庫搬到車庫前面左邊、鐵捲門對著北邊那條路（orbay.js PLACE），下面的位置都用越野車車庫的「設計座標」算（H.ow：設計 → 世界、H.od：世界 → 設計）
//   設計座標：門在 +x 那面牆（X1）、停車格靠 −z 那面牆，格口 BZ1、通道到 IZ1、門的中間 z＝ZC
await p.evaluate(() => { const H = window.__H; H.ow = (x, z, h = 0) => { const OB = window.__D().OB, w = OB.toWorld(x, z); return { x: w[0], z: w[1], heading: h + OB.rot }; };
  H.od = (x, z) => window.__D().OB.toDesign(x, z); H.oww = (pts) => pts.map(([x, z]) => { const w = H.ow(x, z); return [w.x, w.z]; });
  const g = window.__D().OB.design; H.OD = { ...g, ZC: (g.DZ0 + g.DZ1) / 2, B0X: g.IX0 + g.BW / 2, B0Z: (g.IZ0 + g.BZ1) / 2 }; });
// 走到鐵捲門（裡面）→ 開鐵捲門 → 走出前庭 → 沿著路邊往西走到越野車車庫門口
const bw = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, G = D.GAR, O = H.OD; const r0 = H.walkLocal([[-2.6, -2.6], [3.0, -2.4], [3.6, -0.8]]); const a0 = H.actText(), p0 = H.press(); // r0：從休息區前面繞過中間的 GC8 到鐵捲門裡面
  let n = 0; for (; n < 900 && G.door.t < 0.98; n++) H.step(1); const gd = G.door.t; // 走遠了車庫的門會自己關（遙控器）：開好的時候先記下來
  const r1 = H.walkLocal([[8, 0.2], [11.5, -1.6]]); // 走出前庭
  const r2 = H.walkPath([[-305, -82], [-306, -76.6], ...H.oww([[O.X1 + 2.6, O.ZC], [O.X1 + 1.6, O.ZC]])]); // 往南走到路邊、往西走到越野車車庫門口
  return { r0: r0.ok, a0, p0, door: +gd.toFixed(2), s: +(n / 60).toFixed(1), r1: r1.ok, r2: r2.ok, at: r2.at, act: H.actText(), ob: +D.OB.door.t.toFixed(2) };
});
console.log('  walk out:', JSON.stringify(bw));
check(bw.r0 && bw.a0 === '開鐵捲門' && bw.p0 === '開鐵捲門' && bw.door >= 0.98 && bw.r1 && bw.r2 && bw.ob === 0 && bw.act === '開鐵捲門',
  `on foot: opened the garage roller door from inside (${bw.s} s), walked out and along the road to the annex door (in front of the garage, on the left), which is closed: 「開鐵捲門」`);
// 退到路上、鏡頭朝門：整棟（鐵捲門、門上的「越野車專用」招牌）拍得到
await p.evaluate(() => { const H = window.__H, W = window.__D().walker, O = H.OD, q = H.ow(O.X1 + 9, O.ZC + 2, Math.PI + 0.25); W.teleport(q); W.setCamera({ yaw: q.heading }); H.step(40); });
await drawAndShot('14-orbay-outside');
const bi = await p.evaluate(() => { const D = window.__D(), H = window.__H, OB = D.OB, O = H.OD;
  const rA = H.walkPath(H.oww([[O.X1 + 2.6, O.ZC], [O.X1 + 1.6, O.ZC]])); const pressed = H.press(); // 走回鐵捲門口
  let n = 0; for (; n < 900 && OB.door.t < 0.98; n++) H.step(1);
  const r0 = H.walkPath(H.oww([[O.X1 - 4, O.ZC]])); // 進門口（通道），鏡頭朝裡面看四格
  return { rA: rA.ok, pressed, door: +OB.door.t.toFixed(2), s: +(n / 60).toFixed(1), r0: r0.ok }; });
await p.evaluate(() => { const H = window.__H, W = window.__D().walker; W.setCamera({ yaw: window.__D().OB.rot + Math.PI / 2 + 0.75 }); H.step(30); }); // 鏡頭朝停車格（設計的 −z 那邊，偏向裡面）
await drawAndShot('15-orbay-inside');
const bi2 = await p.evaluate(() => { const D = window.__D(), H = window.__H, OB = D.OB, O = H.OD;
  const wc = D.walker.cars.find((q) => q.key === 'monster'), h = wc.heading, c = Math.cos(h), s = Math.sin(h), bx = wc.x + (wc.cx || 0) * c + (wc.cz || 0) * s, bz = wc.z - (wc.cx || 0) * s + (wc.cz || 0) * c, f = wc.hx + 0.7;
  const r = H.walkPath([...H.oww([[O.IX1 - 9, O.ZC]]), [bx + c * f, bz - s * f]]); // 走到怪獸卡車前面（車頭前 0.7 公尺；修 6 以後車頭朝通道）
  return { ok: r.ok, at: r.at, inside: OB.inside(r.x, r.z), act: H.actText(), bad: H.checkFrame(H.cols()), maxY: +D.gcam.maxY.toFixed(2) }; });
console.log('  into the annex:', JSON.stringify(bi), JSON.stringify(bi2));
check(bi.rA && bi.pressed === '開鐵捲門' && bi.door >= 0.98 && bi.r0 && bi2.ok && bi2.inside && bi2.act === '上車 · 怪獸卡車' && !bi2.bad.length && bi2.maxY < 6.5,
  `the annex roller door opens on foot too (${bi.s} s): walked inside to the truck in its bay, nothing clips the walker and the camera stays under the ceiling`);
const miniEl = await p.$('#stage .wk-map');
if (miniEl) { await miniEl.screenshot({ path: `${prefix}-16-orbay-minimap.png` }); console.log('  shot', `${prefix}-16-orbay-minimap.png`, el()); }
check(!!miniEl, 'the mini-map is on screen on foot at the annex (it draws the annex like the garage)');
const bb2 = await p.evaluate(() => { const H = window.__H, act = H.actText(), pressed = H.press(), b = H.board(); return { act, pressed, modes: b.modes }; });
for (let i = 0; i < 200; i++) { const ok = await p.evaluate(() => { window.__H.step(10); const D = window.__D(); return D.cur === 'monster' && !!D.drv && !D.drv.telemetry().paused; }); if (ok) break; await p.waitForTimeout(500); } // 換成完整的車（載入要真的時間，也要一格一格走）
const bb3 = await p.evaluate(() => { const D = window.__D(), H = window.__H; window.__dstep(40); const L = D.LODS;
  return { cur: D.cur, drv: !!D.drv, full: D.tripFull, halfW: D.drv?.carInfo.halfW, mLod: L.monster?.lod?.car.parent ? 'shown' : 'hidden', gc8: L.gc8?.lod?.car.parent === D.GAR.interior ? 'garage-middle' : String(L.gc8?.lod?.car.parent?.name), act2: H.act2() }; });
console.log('  上車（越野車車庫）:', JSON.stringify(bb2), JSON.stringify(bb3));
check(bb2.act === '上車 · 怪獸卡車' && bb2.pressed === '上車 · 怪獸卡車' && bb2.modes.join('>') === 'in>seat>off' && bb3.cur === 'monster' && bb3.drv && bb3.full === 'monster' && bb3.halfW === 1.905 && bb3.mLod === 'hidden' && bb3.gc8 === 'garage-middle' && bb3.act2 === '下車',
  'walked into the annex to the monster truck in its bay and got in: it became the full model and drives; GC8 stays in the middle of the garage as the light-weight car');
await drawAndShot('17-monster-in-bay');
// 開車的機器人（設計座標）：倒車（停著按煞車 0.25 秒換倒車、倒車時煞車踏板就是油門）、前進（倒車中用力踩油門換前進）、照路點開（目標在後面就倒車）
await p.evaluate(() => {
  const H = window.__H;
  H.obBot = () => { const D = window.__D(), d = D.drv, tel = () => { const t = d.telemetry(), q = H.od(t.x, t.z); return { ...t, dx: q[0], dz: q[1], dh: H.wrapA(t.heading - D.OB.rot) }; }, log = []; let nb = 0; // nb：倒車了幾格
    const rev = (steer, until, maxS) => { for (let i = 0; i < maxS * 60; i++) { const t = tel(); if (until(t)) break;
        if (t.gear !== -1) d.setInput({ throttle: 0, brake: 1, steer: 0 }); else d.setInput({ throttle: 0, brake: t.v > -1.3 ? 0.3 : 0, steer }); window.__dstep(1); nb++; } };
    const fwd = (steer, until, maxS) => { for (let i = 0; i < maxS * 60; i++) { const t = tel(); if (until(t)) break;
        d.setInput({ throttle: t.gear === -1 ? 0.8 : Math.abs(t.v) < 1.6 ? 0.35 : 0, brake: 0, steer }); window.__dstep(1); } };
    const goW = (tx, tz, maxS) => { let n = 0; for (; n < maxS * 60; n++) { const t = d.telemetry(), dx = tx - t.x, dz = tz - t.z;
        if (Math.hypot(dx, dz) < 2.2) break;
        const want = Math.atan2(-dz, dx), err = H.wrapA(want - t.heading), back = Math.abs(err) > 1.9;
        if (back) { const st = Math.max(-1, Math.min(1, H.wrapA(want - t.heading - Math.PI) * 1.5));
          if (t.gear !== -1) d.setInput({ throttle: 0, brake: 1, steer: 0 }); else d.setInput({ throttle: 0, brake: t.v > -1.5 ? 0.3 : 0, steer: st }); nb++; }
        else d.setInput({ throttle: t.gear === -1 ? 0.8 : Math.abs(t.v) < 2.3 ? 0.35 : 0, brake: 0, steer: Math.max(-1, Math.min(1, -err * 1.5)) });
        window.__dstep(1); }
      log.push([+tx.toFixed(1), +tz.toFixed(1), +(n / 60).toFixed(1)]); return n / 60; };
    const go = (x, z, maxS) => { const w = H.ow(x, z); return goW(w.x, w.z, maxS); };
    // 修 6：格子裡車頭朝外（通道）＝直接往前開、轉向鐵捲門開出去（不用倒車）；車頭朝裡面停的才倒車出格 → 前進打右滿舵轉身 → 開出去
    const out = () => { const O = H.OD, t0 = tel(); let s = 0;
      if (Math.abs(H.wrapA(t0.dh - Math.PI / 2)) < 0.6) {
        rev(0, (t) => t.dz > O.BZ1 + 1.9, 10); log.push(['倒車出格', +tel().dz.toFixed(1)]);
        fwd(1, (t) => Math.abs(t.dh) < 0.3 || t.dz < O.BZ1 - 1.8 || t.dx > O.X1 - 2.5, 15); log.push(['打右滿舵轉身', +tel().dh.toFixed(2)]);
      } else { log.push(['往前開出格', +t0.dh.toFixed(2)]); s += go(O.B0X + 4, O.BZ1 + 4, 15); }
      return s + go(O.X1 - 9, O.ZC - 1, 20) + go(O.X1 - 3, O.ZC + 0.1, 20) + go(O.X1 + 6, O.ZC + 0.2, 25); };
    return { d, tel, rev, fwd, go, goW, out, log, nb: () => nb };
  };
});
const ex = await p.evaluate(() => { const D = window.__D(), OB = D.OB, d = D.drv, H = window.__H, B = H.obBot();
  const s1 = B.out(); window.__dstep(40); d.setInput(null); const t = d.telemetry(), q = H.od(t.x, t.z), P = window.__pol(), pol = P ? { wanted: P.wanted, state: P.state } : null; if (P?.wanted) P.clear(); // 開到路上不小心撞到人／車 → 警察會來抓（警察在 test-b3.mjs 測）：清掉、記下來
  return { log: B.log, nb: B.nb(), s: +s1.toFixed(1), x: +t.x.toFixed(2), z: +t.z.toFixed(2), dx: +q[0].toFixed(2), h: +t.heading.toFixed(2), inside: OB.inside(t.x, t.z), door: +OB.door.t.toFixed(2), pol, drvAfter: !!window.__D().drv };
});
console.log('  drove out of the bay:', JSON.stringify(ex));
check(!ex.inside && ex.dx > 14.6 && ex.door >= 0.98 && ex.log[0][0] === '往前開出格' && ex.nb === 0, `drove straight out of bay 1 (nose out, no reversing, no three-point turn: ${ex.s} s) and out through the annex roller door onto the road`);
await drawAndShot('18-monster-out');
// 門關起來：車開不進去 → 坐在車上按「開鐵捲門」→ 開進去停回 1 號格 → 下車
const ob3 = await p.evaluate(() => { const D = window.__D(), OB = D.OB, d = D.drv, H = window.__H, O = H.OD, dX = () => { const t = d.telemetry(); return H.od(t.x, t.z)[0]; };
  d.teleport(H.ow(O.X1 - 10, O.ZC, 0)); window.__dstep(10); OB.door.t = 0; OB.door.close(0.001); window.__dstep(30); // 通道上、車頭朝門；門關起來
  let n = 0; for (; n < 600; n++) { const t = d.telemetry(); if (dX() > O.X1 + 2) break; d.setInput({ throttle: Math.abs(t.v) < 2 ? 0.4 : 0, brake: 0, steer: 0 }); window.__dstep(1); }
  window.__dstep(60); const t1 = dX(); // 煞車不按住（停著按住＝換倒車）
  const tq = d.telemetry(), dbg = { paused: tq.paused, v: +tq.v.toFixed(2), wanted: window.__pol()?.wanted, moving: OB.door.moving, on: window.__D().on, drv: !!window.__D().drv, mode: window.__D().walker?.mode };
  const act = H.actText(), pressed = H.press();
  let m = 0; for (; m < 900 && OB.door.t < 0.98; m++) window.__dstep(1);
  let k = 0; for (; k < 900; k++) { const t = d.telemetry(); if (dX() > O.X1 + 4) break; d.setInput({ throttle: Math.abs(t.v) < 3 ? 0.4 : 0, brake: 0, steer: 0 }); window.__dstep(1); }
  window.__dstep(30); d.setInput(null); const t2 = d.telemetry();
  return { blocked: +t1.toFixed(2), act, pressed, door: +OB.door.t.toFixed(2), out: +dX().toFixed(2), inside: OB.inside(t2.x, t2.z), X1: O.X1, dbg, drvEnd: !!window.__D().drv }; });
console.log('  door blocks the truck:', JSON.stringify(ob3));
check(ob3.blocked < ob3.X1 - 0.3 && ob3.act === '開鐵捲門' && ob3.pressed === '開鐵捲門' && ob3.door >= 0.98 && ob3.out > ob3.X1 + 4 && !ob3.inside,
  `the closed annex door stops the truck inside (x ${ob3.blocked} in the annex's own frame, door at ${ob3.X1}); 「開鐵捲門」 from the driver seat opens it and the truck drives out again`);
// 修 7：在越野車車庫裡面、門關著，按「去哪裡」：鐵捲門自己打開，照著路線開出去不會卡在門上
const ob7 = await p.evaluate(() => { const D = window.__D(), OB = D.OB, d = D.drv, H = window.__H, O = H.OD, dX = () => { const t = d.telemetry(); return H.od(t.x, t.z)[0]; };
  d.teleport(H.ow(O.X1 - 10, O.ZC, 0)); window.__dstep(10); OB.door.t = 0; OB.door.close(0.001); window.__dstep(30);
  const shut = +OB.door.t.toFixed(2), btn = document.querySelector('#dests button[data-d="shop"]'); btn.click(); window.__dstep(2);
  const moving = OB.door.moving;
  let n = 0; for (; n < 900 && OB.door.t < 0.98; n++) window.__dstep(1);
  let k = 0; for (; k < 900; k++) { const t = d.telemetry(); if (dX() > O.X1 + 4) break; d.setInput({ throttle: Math.abs(t.v) < 3 ? 0.4 : 0, brake: 0, steer: 0 }); window.__dstep(1); }
  d.setInput(null); window.__dstep(30); const t2 = d.telemetry();
  return { shut, moving, door: +OB.door.t.toFixed(2), s: +(n / 60).toFixed(1), out: +dX().toFixed(2), inside: OB.inside(t2.x, t2.z), dest: t2.dest, X1: O.X1 }; });
console.log('  destination from inside the annex:', JSON.stringify(ob7));
check(ob7.shut === 0 && ob7.moving && ob7.door >= 0.98 && ob7.dest === 'shop' && ob7.out > ob7.X1 + 4 && !ob7.inside,
  `inside the annex with the door shut, picking 「去改車廠」 opens the roller door by itself (${ob7.s} s) and the truck drives out along the route`);
await p.evaluate(() => window.__D().drv.setDestination(null));
const ob4 = await p.evaluate(() => { const D = window.__D(), OB = D.OB, d = D.drv, H = window.__H, O = H.OD;
  d.teleport(H.ow(O.B0X, O.BZ1 + 2.7, -Math.PI / 2)); window.__dstep(10); // 1 號格的格口，車頭朝外（修 6：倒車停進去，下次直接開出來）
  let n = 0; for (; n < 900; n++) { const t = d.telemetry(), stop = H.od(t.x, t.z)[1] < O.B0Z + 1.3; // 倒車：停著按煞車換倒車、倒車的時候煞車踏板是油門；到了踩油門＝煞車
    d.setInput(stop ? { throttle: 1, brake: 0, steer: 0 } : t.gear !== -1 ? { throttle: 0, brake: 1, steer: 0 } : { throttle: 0, brake: t.v > -2.5 ? 0.35 : 0, steer: 0 }); window.__dstep(1);
    if (stop && Math.abs(d.telemetry().v) < 0.15) break; }
  d.setInput(null); window.__dstep(30);
  const t = d.telemetry(), sp = D.orbaySpot(t);
  return { s: +(n / 60).toFixed(1), bay: sp?.bay, act2: H.act2() }; });
const ob5 = await p.evaluate(() => { const H = window.__H, pressed = H.press2(); let n = 0; for (; n < 420 && window.__D().walker.mode !== 'walk'; n++) H.step(1); H.step(60);
  const D = window.__D(), tp = D.tripPose.monster, b0 = D.OB.bays[0];
  return { pressed, mode: D.walker.mode, at: tp && +Math.hypot(tp.x - b0.x, tp.z - b0.z).toFixed(2), dh: tp && +window.__H.wrapA(tp.heading - b0.heading).toFixed(3), toast: document.querySelector('#stage .wk-toast.show')?.textContent || '', act: H.actText() }; });
console.log('  parked in bay 1 and got out:', JSON.stringify(ob4), JSON.stringify(ob5));
check(ob4.bay === 0 && ob4.act2 === '下車' && ob5.pressed === '下車' && ob5.mode === 'walk' && ob5.at < 0.2 && Math.abs(ob5.dh) < 0.01 && /越野車車庫 1 號格/.test(ob5.toast) && ob5.act === '上車 · 怪獸卡車',
  `drove into bay 1, 下車 straightened it onto the yellow-line spot and said 「${ob5.toast}」; it stays there and can be boarded again`);
await drawAndShot('19-monster-parked');
// 走開幾步再上車 → 開出越野車車庫到路上，往東開回前庭（接下一段去阿財車行）
const ob6a = await p.evaluate(() => { const H = window.__H, O = H.OD; const r = H.walkPath(H.oww([[O.B0X, O.B0Z + 4.35]])); // 退到格子口再按「上車」（才走得到車門）
  const act = H.actText(), pressed = H.press(), b = H.board(); H.step(30); return { ok: r.ok, act, pressed, modes: b.modes, cur: window.__D().cur }; });
const ob6 = await p.evaluate(() => { const D = window.__D(), OB = D.OB, d = D.drv, H = window.__H, B = H.obBot();
  const S = H.gw(14, -5); // 以前的大車位（鐵捲門前面的水泥地）：停回同一個地方，下一段去阿財車行就跟以前一樣
  const s1 = B.out() + B.goW(-312, -72.5, 25) + B.goW(-300.5, -76, 20) + B.goW(S.x, S.z, 25);
  d.setInput(null); window.__dstep(240); const t = d.telemetry(); // 放開油門滑到停（不按煞車：停著按住會換倒車）
  return { log: B.log, s: +s1.toFixed(1), x: +t.x.toFixed(1), z: +t.z.toFixed(1), inside: OB.inside(t.x, t.z) };
});
console.log('  back in the truck, out to the front yard:', JSON.stringify(ob6a), JSON.stringify(ob6));
check(ob6a.ok && ob6a.act === '上車 · 怪獸卡車' && ob6a.modes.join('>') === 'in>seat>off' && ob6a.cur === 'monster' && !ob6.inside && ob6.x > -306 && ob6.z < -78,
  `got back into the truck in its bay, drove it out of the annex onto the road and east into the front yard (${ob6.s} s sim)`);

// ---- 13 開怪獸卡車去阿財車行買一台（錢給夠）：車行把怪獸卡車送回越野車車庫自己的格子（不是升降機、沒有名牌）----
const dealerBay = await p.evaluate(() => window.__D().VIL.places.dealer.bay);
await p.evaluate(() => { window.__money(5000); window.__D().drv.setDestination('dealer'); });
r = await leg('dealer', "!document.getElementById('dealer').hidden", { bay: dealerBay, prop: true }, 300);
check(r.arrived && r.stuck === 0, `the monster truck drove home from the annex and on to 阿財車行 (${r.t.toFixed(0)} s sim)`);
const k13 = await p.evaluate(() => { const b = document.getElementById('dealerBuy'); b.click(); b.click(); return window.__D().cur; });
await p.waitForFunction((k0) => window.__D().cur !== k0 && window.__D().drv && !window.__D().drv.telemetry().paused, k13, { timeout: 300000 });
await p.waitForFunction(() => window.__D().LODS.monster?.lod?.car.parent === window.__D().VIL.group, null, { timeout: 120000 });
await p.waitForTimeout(3600); // 車行送車的那句話（買完 3.2 秒後、說 3 秒：真的時間）
const dv = await p.evaluate(() => {
  const D = window.__D(), c = D.LODS.monster.lod.car, b0 = D.OB.bays[0], tp = D.tripPose.monster;
  return { cur: D.cur, owned: [...window.__G().owned].join(), at: +Math.hypot(c.position.x - b0.x, c.position.z - b0.z).toFixed(3), dh: +window.__H.wrapA(c.rotation.y - b0.heading).toFixed(3),
    tp: tp && [+tp.x.toFixed(2), +tp.z.toFixed(2), tp.deck ?? null, tp.bay ?? null], decks: D.DECK.map((k) => k || '-').join(','), park: window.__G().park,
    toast: document.querySelector('#stage .dv-toast')?.textContent || '', pf: Object.keys(window.__O().PFULL), walk: D.walker.cars.some((q) => q.key === 'monster') };
});
console.log('13', el(), 'bought at 阿財車行:', JSON.stringify(dv), '| plates', JSON.stringify(await plates('town')));
check(dv.cur !== 'monster' && dv.at < 0.05 && Math.abs(dv.dh) < 0.01 && dv.tp && dv.tp[2] === null && dv.tp[3] === 0 && !dv.decks.includes('monster') && !dv.park.decks.includes('monster') && !(await plates('town')).length && !dv.pf.length && dv.walk && /越野車車庫/.test(dv.toast),
  `bought ${dv.cur} at 阿財車行 while driving the monster truck: the dealer takes the truck home to bay 1 of the 越野車車庫 (toast "${dv.toast}"), no lift, no name plate`);
// 一般的車（剛買的那台）：牆擋得住、停不進越野車的格子（格子只給越野車）
const nc = await p.evaluate(() => { const D = window.__D(), OB = D.OB, d = D.drv, b0 = OB.bays[0];
  d.teleport({ x: -347, z: -95, heading: 0 }); window.__dstep(20); // 越野車車庫西牆外面（稻田），車頭朝東（朝牆）
  let n = 0; for (; n < 600; n++) { const t = d.telemetry(); if (t.x > -337) break; d.setInput({ throttle: Math.abs(t.v) < 4 ? 0.6 : 0, brake: 0, steer: 0 }); window.__dstep(1); }
  window.__dstep(60); const wall = d.telemetry().x;
  d.teleport({ x: b0.x, z: b0.z, heading: b0.heading }); window.__dstep(20); // 直接擺到 1 號格裡面
  const t = d.telemetry(), sp = D.orbaySpot(t), ps = D.parkSpot(t); d.setInput(null);
  return { wall: +wall.toFixed(2), x0: OB.box.x0, inside: OB.inside(wall, -95), bay: sp ? sp.bay : null, park: ps ? (ps.deck ?? ps.bay ?? 'mid') : null, lift: !!D.LODS[D.cur]?.lod }; });
console.log('  a normal car at the annex:', JSON.stringify(nc));
check(nc.wall < nc.x0 && !nc.inside && nc.bay === null && nc.park === null,
  `a normal car (${dv.cur}) is stopped by the annex wall from outside (x ${nc.wall}, outside ${nc.x0}) and cannot take a bay: the bays are only for off-road vehicles`);
await b.close(); srv.close();
console.log('==== summary ====');
for (const s of summary) console.log(s);
console.log(errs.length ? `ERRORS ${errs.length}` : 'no page errors');
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS OK', el());
process.exit(errs.length || fails.length ? 1 : 0);
