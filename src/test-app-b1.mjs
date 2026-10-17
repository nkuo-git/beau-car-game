// 第 1＋2 批在 App（carid-pwa 的 build，0.8.<版號>）裡測：跟 test-b1.mjs 同一趟（出門是走路 → 走去上車 → 開鐵捲門 → 改車廠、車店買車 → 快速道路極速 → 賽道 → 開回家坐電梯上 3 樓停進格子 → 下車走 → 坐電梯去 2 樓開別台 → 倒車回電梯下樓 → 直接回車庫 → 重新整理 → 再出門）
//   也測走路：車庫的牆、關著的鐵捲門、停著的車擋人；下車（右邊的第二顆「下車」）、走回去上車；走路開鐵捲門、走遠了門自己關
//   圓塔的電梯、小房子睡覺、車行送車、車庫頁 7 台車（第 7、10、11 段，跟 test-b1.mjs 一樣）；另外：標題旁的版本號、麥塊 → 汽車回到改車、亮色＋藍色主色（出門走路、上車）
//   全螢幕（跟 test-b1.mjs 一樣：出門走路、開車、比賽蓋滿螢幕，按鈕在五種螢幕大小都不重疊；改車廠、車店、車庫頁照舊可以捲）：假的 CaridApp.setFullscreen 收到 true／false、App 的標題／切換／分頁藏起來；舊版 APK（沒有 setFullscreen）也照樣全螢幕
// node test-app-b1.mjs <repo> [prefix]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [repo, prefix = 'b2-shots/app'] = process.argv.slice(2);
if (!repo) throw new Error('用法：node test-app-b1.mjs <repo> [prefix]');
// <repo>：改車遊戲自己的網站（docs/：index.html＋game.js，外殼 BeauCarApp）或萬能軟體的 repo（tune.html＋tune.js，外殼 CaridApp）
const SITE = !fs.existsSync(path.join(repo, 'tune.html')), JS = SITE ? '/game.js' : '/tune.js', SHELL = SITE ? 'BeauCarApp' : 'CaridApp';
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const hook = 'window.__R = () => race; window.__G = () => GAME; window.__S = () => S; window.__snd = () => snd; window.__room = () => room; window.__scene = () => scene; window.__controls = () => controls;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__money = (n) => { GAME.money = n; save(true); renderWallet(); renderOptions(); refreshCarBtns(); };'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, dvoice, trip, tripS, home, bayLock, snooze, TR, LODS, camGo, cur, built, walker, tripPose, tripFull, boarding,'
  + '   TWR, EL, PW, elWho, elFree, poseF, padCars, sleep, gcam, liftSnd, deliver, offTower, normPark, CABIN_EYE, setDest, CARS, PERF, TOWER_BAYS, towerFy, TOWER });'
  + ' window.__HOME = () => HOME; window.__N = () => NPC; window.__NMAX = () => NPC_MAX;'
  + ' window.__pol = () => (typeof police !== "undefined" ? police : null);' // 第 3 批（b3-int）：警察（撞人的測試以後把星星清掉：警察的部分在 test-b3.mjs）
  + ' window.__IN = () => ({ indoor, doorFade, HOUSE_WARM, interiorFor, buildInterior, DEALER_DOOR });'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } else if (window.__npcKeep) { NPC = window.__npcKeep; window.__npcKeep = null; NPC.g.visible = DRIVE.on; } };'
  + ' window.__look = () => LOOKP; window.__cam = () => ({ maxD: controls.maxDistance, fitD, dist: camera.position.distanceTo(controls.target), pos: camera.position.toArray() }); window.__cea = createEngineAudio; window.__camera = () => camera;'
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
async function drawAndShot(name, fullPage = false) { // 畫兩格再截圖（開車、走路停住的時候畫的是現在的樣子）
  const n0 = await p.evaluate(() => { window.__noDraw = false; return window.__dframes || 0; });
  await p.waitForFunction((n) => (window.__dframes || 0) >= n + 2, n0, { timeout: 300000 });
  await p.evaluate(() => { window.__noDraw = true; });
  await p.screenshot({ path: `${prefix}-${name}.png`, fullPage });
  console.log('  shot', `${prefix}-${name}.png`, JSON.stringify(await p.evaluate(() => window.__rinfo())), el());
}
// ---- 全螢幕（主幹的，Nick：「可以全螢幕」）：出門（走路、開車）、比賽蓋滿整個螢幕；改車廠、車店照舊可以捲；回車庫頁恢復 ----
//   APP：test-app-b1.mjs（App 裡）才有 App 的標題、切換、分頁、外殼（假的 CaridApp.setFullscreen 記下收到的 true／false）
const APP = typeof repo !== 'undefined', CHROME = SITE ? '.appbar' : '.appbar .segbar .tabbar'; // 改車遊戲的網站只有標題列（沒有萬能軟體的切換、分頁）
const fsInfo = () => p.evaluate(() => {
  const q = (s) => document.querySelector(s), vis = (e) => !!e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getClientRects().length > 0;
  const st = q('#stage').getBoundingClientRect(), rc = q('#race').getBoundingClientRect();
  return { fs: document.body.classList.contains('fs'), html: document.documentElement.classList.contains('fs'), live: document.body.classList.contains('race-live'), walking: document.body.classList.contains('walking'),
    stage: [st.left, st.top, st.width, st.height].map(Math.round), vw: innerWidth, vh: innerHeight, pos: getComputedStyle(q('#stage')).position,
    chrome: ['.appbar', '.segbar', '.tabbar'].filter((s) => vis(q(s))).join(' '), btn: vis(q('#fsBtn')), more: vis(q('#moreTog')), pressed: q('#fsBtn').getAttribute('aria-pressed'),
    scrolls: document.documentElement.scrollHeight > innerHeight + 1, pref: localStorage.getItem('carid.tune.full'), calls: (window.__fsCalls || []).join(','),
    race: vis(q('#race')) ? [rc.left, rc.top, rc.width, rc.height].map(Math.round) : null, pedals: vis(q('#hud .pedals')), gauge: vis(q('#hud .gauge')) };
});
const shown = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }, sel);
const fullView = (f) => f.fs && f.html && f.pos === 'fixed' && f.stage.join() === `0,0,${f.vw},${f.vh}` && !f.chrome && !f.scrolls && (f.btn || f.more); // 全螢幕開車：全螢幕鈕收在「⋯」裡
// 畫面上的按鈕：開車的 HUD（多了「下車」）、走路的 HUD（搖桿、上車／升降機／睡覺的大按鈕、小地圖、換視角、右下角的圓按鈕）、疊在畫面上的去哪裡／直接回車庫／聲音、
//   全螢幕鈕、比賽的 HUD：看得到的兩兩不重疊；全螢幕的時候都在螢幕裡面（離邊邊至少 4 px）
const HUD_SEL = ['.dv-chip', '.dv-act', '.dv-act2', '.dv-map', '.dv-cam', '.dv-spd', '.dv-steer', '.dv-brk', '.dv-gas', '.dv-hb', '.wk-chip', '.wk-act', '.wk-map', '.wk-cam', '.wk-stick', '.wk-btns',
  '#dests', '#destTog', '#moreTog', '#sizeTog', '#sizePop', '.elpanel', '#driveHome', '#dSndBtn', '#fsBtn', '#hud .trackbar', '#hud .tree', '#hud .clock', '#hud .gauge', '#hud .pedals', '#race'];
const hudClash = (inView = true) => p.evaluate(([inView, S]) => {
  // 橫拿打開的「去哪裡」：#dests 是 display: contents（按鈕直接排在 #drivebar 的格子裡）→ 裡面看得到的按鈕一個一個量
  const R = S.map((s) => [s, document.querySelector(s)]).filter(([, e]) => e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden')
    .flatMap(([s, e]) => getComputedStyle(e).display === 'contents' ? [...e.children].filter((c) => !c.hidden && getComputedStyle(c).display !== 'none' && c.getClientRects().length).map((c, i) => [`${s}>${i + 1}`, c.getBoundingClientRect()])
      : e.getClientRects().length ? [[s, e.getBoundingClientRect()]] : []), out = [];
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
// 開局：GC8＋YARIS、NT$ 470 萬（買得起 SUPRA 200 萬＋零件；車子半價以後）；只有第一次載入才放（重新整理要看存的）
await p.addInitScript(() => {
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 470, owned: ['gc8', 'yaris'], parts: {}, tyres: {}, wins: {}, cars: {},
      dmg: { gc8: { v: 1, h: [[0, 2.1, 0, 1, 9, 0, 0.6, 0.5, 1, 0.4]], x: 0, hp: 0.2, gl: 0, lp: 0, pt: 0 } } })); // 舊存檔：GC8 撞過（撞爛拿掉了：一載入就當作好的）
  }
});
// 開車的機器人（在頁面裡跑：一次開很多步才回來）：照路線、彎道前煞車、路的盡頭停下來；opt.act：看到這些大按鈕就按；opt.bay：開進這個長方形就煞車停好
await p.addInitScript(() => {
  const wrapA = (a) => { a = (a + Math.PI) % (2 * Math.PI); return a < 0 ? a + Math.PI : a - Math.PI; };
  const along = (pts, d) => { for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d <= l && l > 0) return [pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * d) / l, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * d) / l]; d -= l; } return pts[pts.length - 1]; };
  const plen = (pts) => pts.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0), 0);
  const inBox = (r, x, z, m = 0) => { const dx = x - r.x, dz = z - r.z, c = Math.cos(r.rot || 0), s = Math.sin(r.rot || 0); return Math.abs(dx * c - dz * s) <= r.hx + m && Math.abs(dx * s + dz * c) <= r.hz + m; };
  function targetSpeed(pts) { // 前面 250 公尺的彎：抓地 8 m/s²、煞車 6 m/s²；路的盡頭要停
    let prev = null; pts = pts.filter((q) => { if (prev && Math.hypot(q[0] - prev[0], q[1] - prev[1]) < 1) return false; prev = q; return true; }); // 太近的點（車就在路線上時第一段是 0）算不出彎
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
  const P = (window.__pp = { steer: 0, t: 0, maxKmh: 0, stuck: 0, lastT: 0, lx: 0, lz: 0, acts: [], bumps: 0, inside: 0, out2: 0 });
  const keepRight = (pts, off = 1.6, s0 = 15, s1 = 30) => {
    if (pts.length > 2 && Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) < 4.5) pts = pts.slice(1); // 車子 → 路中間那一小段：不要 // 路上有別人的車：靠右開（路線是路中間）；出發 15 公尺、終點 30 公尺內慢慢回到路線上（進車庫、停車格要對準）
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
  P.inBox = inBox; P.plen = plen; P.keepRight = keepRight;
  // 每 step 公尺取一點（細的曲線一點只轉 1.5 度，彎道看不出來：取疏一點才算得出半徑）
  const resample = (pts, step) => { const out = [pts[0]]; let acc = 0; for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc >= step) { out.push(pts[i]); acc = 0; } } if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]); return out; };
  function drive1(d, t, pts, opt, tsPts = pts) {
    const ci = d.carInfo, c0 = (ci.nose + ci.tail) / 2, cx = t.x + Math.cos(t.heading) * c0, cz = t.z - Math.sin(t.heading) * c0;
    const la = along(pts, 5 + 0.45 * Math.abs(t.v)), a = wrapA(Math.atan2(-(la[1] - cz), la[0] - cx) - t.heading);
    if (opt.prop) P.steer = Math.max(-1, Math.min(1, -2.5 * a)); // 比例（快速道路：不要左右甩）
    else if (a > 0.07) P.steer = -1; else if (a < -0.07) P.steer = 1; else if (Math.abs(a) < 0.025) P.steer = 0;
    let thr = 1, brk = 0; const vt = Math.min(targetSpeed(tsPts), opt.vmax || Infinity);
    if (Math.abs(t.v) > vt + 1) { thr = 0; brk = 1; } else if (Math.abs(t.v) > vt - 1) thr = 0.3;
    return [thr, brk];
  }
  P.run = (dest, frames, until, opt = {}) => {
    for (let i = 0; i < frames; i++) {
      const D = window.__D(); if (!D.on || !D.drv) return { stop: true, t: P.t };
      const d = D.drv, V = D.VIL, t = d.telemetry();
      if (until()) { d.setInput(null); return { arrived: true, t: P.t }; }
      if (t.paused || t.auto) { d.setInput(null); window.__dstep(1); P.t += 1 / 60; continue; }
      const act = d.action;
      if (act && (opt.act || []).includes(act) && P.t - (P.actT ?? -9) > 0.5) { P.actT = P.t; P.acts.push(act); document.querySelector('#stage .dv-act').click(); continue; }
      const ci = d.carInfo, c0 = (ci.nose + ci.tail) / 2, r = V.route(t.x + Math.cos(t.heading) * c0, t.z - Math.sin(t.heading) * c0, dest);
      const NP0 = window.__N && window.__N(), GL = V.places.garage.lot, gx = (t.x - GL.x) * Math.cos(GL.heading) - (t.z - GL.z) * Math.sin(GL.heading), gz = (t.x - GL.x) * Math.sin(GL.heading) + (t.z - GL.z) * Math.cos(GL.heading);
      const nearHome = gx > -14 && gx < 30 && Math.abs(gz) < 14; // 在你家、剛開出鐵捲門：路線照走（門窄），靠右慢慢來
      const rp = NP0 && NP0.g.visible && !opt.center ? keepRight(r.pts, 1.6, nearHome ? 15 : 0) : r.pts;
      let [thr, brk] = drive1(d, t, rp, opt);
      const G = D.GAR, L = V.places.garage.lot;
      if (G && (opt.act || []).includes('開鐵捲門')) { // 鐵捲門還沒全開：在車庫裡、門前面等
        const c = Math.cos(L.heading), s = Math.sin(L.heading), dx = t.x - L.x, dz = t.z - L.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (G.door.t < 0.95 && lx > -13 && lx < 16 && Math.abs(lz) < 13) { thr = 0; brk = 1; }
      }
      if ((opt.bay && inBox(opt.bay, t.x, t.z)) || (opt.stopEnd !== false && r.len < 2.5)) { thr = 0; brk = 1; }
      const NP = window.__N && window.__N();
      if (NP && NP.g.visible && !opt.noYield) { // 路上的車：車頭前面（車身寬＋那台的半寬＋0.5 公尺、5 公尺＋1.3 秒內）有車就煞車等（AI 車會開走、路口會讓你）
        const f0 = Math.cos(t.heading), f1 = -Math.sin(t.heading), ci2 = d.carInfo, c2 = (ci2.nose + ci2.tail) / 2, mx = t.x + f0 * c2, mz = t.z + f1 * c2, look = ci2.len / 2 + 5 + Math.abs(t.v) * 1.3;
        // 開著的車：前面 5 公尺＋1.3 秒內；停著的車（多半是停下來讓你）：正前方 2 公尺＋1.3 秒內才等；連續等超過 6 秒（互相讓）：停著的不管，慢慢開過去
        const long = P.waitT != null && P.t - P.waitT < 0.1 && P.t - (P.wait0 ?? P.t) > 6; let hit = null;
        for (const c of NP.traffic.cars) {
          const dx = c.x - mx, dz = c.z - mz, al = dx * f0 + dz * f1, la = -dx * f1 + dz * f0, moving = Math.abs(c.v || 0) > 0.5; if (!moving && long) continue;
          if (al > 0 && al < (moving ? look : ci2.len / 2 + 2 + Math.abs(t.v) * 1.3) + c.hx && Math.abs(la) < ci2.halfW + c.hz + (moving ? 0.5 : 0.2)) { hit = c; break; }
        }
        if (hit) { thr = 0; brk = Math.abs(t.v) > 0.3 ? 1 : 0; if (P.waitT == null || P.t - P.waitT > 0.5) P.wait0 = P.t; P.waitT = P.t; P.yields = (P.yields || 0) + 1; // 停住了就放開煞車（踩著煞車會倒車）
          const dx = hit.x - mx, dz = hit.z - mz; P.blk = { key: hit.key, kind: hit.kind, x: +hit.x.toFixed(1), z: +hit.z.toFixed(1), h: +hit.heading.toFixed(2), v: +hit.v.toFixed(2), al: +(dx * f0 + dz * f1).toFixed(1), la: +(-dx * f1 + dz * f0).toFixed(1), by: hit.blockedBy, stun: +(hit.stun || 0).toFixed(1), t: +P.t.toFixed(1), me: [+t.x.toFixed(1), +t.z.toFixed(1), +t.heading.toFixed(2)], long }; }
        else if (long || P.t - (P.waitT ?? -99) < 1) { thr = Math.abs(t.v) > 3 ? 0 : Math.min(thr, 0.35); } // 剛等完：慢慢起步
      }
      const bb = t.bumps;
      d.setInput({ throttle: thr, brake: brk, steer: P.steer }); window.__dstep(1); P.t += 1 / 60;
      const t2 = window.__D().drv?.telemetry(); if (!t2) return { stop: true, t: P.t };
      P.maxKmh = Math.max(P.maxKmh, t2.kmh); if (t2.bumps > bb) P.bumps++;
      if (Math.abs(t2.v) > 1.5 && window.__D().drv.action2) P.out2++; // 開著的時候不可以有「下車」
      if (P.t - P.lastT > 3) { if (Math.hypot(t2.x - P.lx, t2.z - P.lz) < 1.5 && !(G && G.door.moving) && !(P.t - (P.waitT ?? -99) < 3)) P.stuck++; P.lastT = P.t; P.lx = t2.x; P.lz = t2.z; }
    }
    return { arrived: false, t: P.t };
  };
  // 快速道路：沿著外圈車道的中間（V.highway.out，照開的方向、一圈）開兩圈，看開到多快
  P.cruise = (frames) => {
    const D = window.__D(), V = D.VIL, d = D.drv, hw = V.highway?.out;
    if (!hw || hw.length < 2) return { err: 'no V.highway.out' };
    let seq = null, enter = false, maxK = 0, t0 = P.t, dist = 0, last = d.telemetry();
    for (let i = 0; i < frames; i++) {
      const t = d.telemetry();
      if (!seq || i % 30 === 0) {
        let bj = 0, bd = Infinity, bq = null; // 車投影到車道線上（最近的那一段）：前面的點才是要去的
        for (let j = 0; j < hw.length - 1; j++) { const A = hw[j], B = hw[j + 1], vx = B[0] - A[0], vz = B[1] - A[1], u = Math.max(0, Math.min(1, ((t.x - A[0]) * vx + (t.z - A[1]) * vz) / (vx * vx + vz * vz))), qx = A[0] + vx * u, qz = A[1] + vz * u, e = Math.hypot(t.x - qx, t.z - qz); if (e < bd) { bd = e; bj = j; bq = [qx, qz]; } }
        enter = bd > 4; seq = [[t.x, t.z], ...(enter ? [bq] : []), ...hw.slice(bj + 1), ...hw, ...hw.slice(0, bj + 1)]; // 還沒上車道：先開到車道線上最近那一點（不要斜切過分隔島）
      }
      const [thr, brk] = drive1(d, t, seq, { prop: true }, enter ? [seq[0], ...resample(seq.slice(1, 120), 30)] : resample(seq.slice(0, 120), 30)); // 上車道那個轉角要留著（取疏的時候會被跳過）
      d.setInput({ throttle: thr, brake: brk, steer: P.steer }); window.__dstep(1); P.t += 1 / 60;
      const t2 = d.telemetry(); maxK = Math.max(maxK, t2.kmh); dist += Math.hypot(t2.x - last.x, t2.z - last.z); last = t2;
      if (window.__cruiseShotAt && t2.kmh >= window.__cruiseShotAt) { window.__cruiseShotAt = 0; d.setInput(null); return { pause: true, max: maxK, t: P.t - t0, dist }; }
    }
    d.setInput(null);
    return { max: maxK, t: P.t - t0, dist, surface: d.telemetry().surface };
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
  // 電梯的面板（town.src.js elPanel）：看得到嗎、按鈕的字（4F 空 8…）、哪一層亮著、◀ ▶ 那一排；按一顆（字開頭是 label）
  H.elPanel = () => { const e = document.querySelector('#stage .elpanel'); if (!vis(e)) return { shown: false }; const b = [...e.querySelectorAll('.elg button')];
    return { shown: true, btns: b.map((x) => x.textContent.replace(/(\d)F/, '$1F ').replace(/\s+/g, ' ').trim()), on: b.filter((x) => x.classList.contains('on')).map((x) => x.textContent.slice(0, 2)).join(), row: vis(e.querySelector('.elr')) }; };
  H.elClick = (label) => { const e = [...document.querySelectorAll('#stage .elpanel button')].find((b) => vis(b) && b.textContent.trim().startsWith(label)); if (!e) return null; e.click(); return label; };
  // 等電梯：先等它開始動（開車的要先開到正中間），再等它停好
  H.elWait = () => { const D = window.__D; let n = 0; for (; n < 300 && !D().EL.ride; n++) step(1); let m = 0; for (; m < 2400 && (D().EL.ride || D().GAR.lift.busy); m++) step(1); return { started: n, s: +(m / 60).toFixed(2) }; };
  H.toast = () => [...document.querySelectorAll('#stage .dv-toast.show, #stage .wk-toast.show')].map((e) => e.textContent).join(' | ');
  // 按了「上車」：等走到車門、坐進去（walk.js mode off）
  H.board = (maxS = 8) => { const w = W(), modes = []; let n = 0; for (; n < maxS * 60; n++) { step(1); modes.push(w.mode); if (w.mode === 'off') break; } return { modes: [...new Set(modes)], s: n / 60 }; };
  // 碰撞物（測試自己算）：村子＋車庫（照門）＋走路可以上的車（walk.js 的清單：跟畫面上的車比過）＋透天厝正面凸出來的（只擋鏡頭）
  H.cols = () => {
    const D = window.__D(), G = D.GAR, V = D.VIL;
    const cars = W().cars.map((c) => { const hc = Math.cos(c.heading), hs = Math.sin(c.heading), cx = c.cx || 0, cz = c.cz || 0; return { t: 'box', x: c.x + cx * hc + cz * hs, z: c.z - cx * hs + cz * hc, hx: c.hx, hz: c.hz, rot: c.heading, h: 1.4 }; });
    const fr = V.buildings.filter((b) => b.floors >= 2 && (b.kind === 'house' || b.kind === 'shop')).map((b) => ({ t: 'box', x: b.x + Math.sin(b.rot) * (b.hz + 0.56), z: b.z + Math.cos(b.rot) * (b.hz + 0.56), hx: b.hx, hz: 0.56, rot: b.rot, y0: 2.7, h: b.h }));
    return [...V.colliders.filter((c) => c.off !== true), ...G.colliders(G.door.t >= 0.55, true), ...cars, ...fr]; // off：車庫街你那間的外殼盒子（裡面是 GAR）
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
let polClr = 0; // 第 3 批（b3-int）：開車的時候警察的星星清掉幾次
async function leg(dest, untilSrc, opt = {}, maxS = 200, shots = []) {
  const t0 = await p.evaluate(() => { const P = window.__pp; P.maxKmh = 0; P.stuck = 0; P.bumps = 0; P.acts = []; P.out2 = 0; P.yields = 0; return P.t; });
  let r = null, done = 0;
  for (let s = 0; s < maxS; s++) {
    r = await p.evaluate(([d, u, o]) => window.__pp.run(d, 60, new Function(`return (${u})`), o), [dest, untilSrc, opt]);
    polClr += await p.evaluate(() => { const P = window.__pol?.(); if (!P || !P.wanted) return 0; P.clear(); return 1; }); // 第 3 批（b3-int）：機器人不小心撞到人 → 警察會來抓（警察在 test-b3.mjs 測）：這裡清掉、記下來
    while (done < shots.length && r.t - t0 >= shots[done][0]) { await drawAndShot(shots[done][1]); done++; }
    if (r.arrived || r.stop) break;
  }
  await p.evaluate(() => window.__D().drv?.setInput(null));
  const s = await p.evaluate(() => ({ stuck: window.__pp.stuck, max: window.__pp.maxKmh, bumps: window.__pp.bumps, acts: window.__pp.acts, out2: window.__pp.out2, yields: window.__pp.yields || 0, npc: (() => { const N = window.__N && window.__N(); return N ? `${N.traffic.cars.length} cars, ${N.peds.people.filter((q) => !q.gone).length} people, npcStep avg ${N.avg.toFixed(2)} ms` : 'off'; })() }));
  if (!r.arrived && !r.stop) console.log('  near cars:', JSON.stringify(await p.evaluate(() => { const t = window.__D().drv?.telemetry(), N = window.__N && window.__N(); if (!t || !N) return null; const E = (e) => e && { id: e.id, c: e.conn ? 1 : 0, p: e.prio, tn: e.turn, L: +e.len.toFixed(1), j: e.junc ? [e.junc.id, +e.junc.x.toFixed(1), +e.junc.z.toFixed(1)] : null }; return N.traffic.cars.filter((c) => Math.hypot(c.x - t.x, c.z - t.z) < 45).map((c) => ({ id: c.id, k: c.key, x: +c.x.toFixed(1), z: +c.z.toFixed(1), h: +c.heading.toFixed(2), v: +c.v.toFixed(2), by: c.blockedBy, st: +(c.stun || 0).toFixed(1), s: +c.s.toFixed(1), e: E(c.edge), p0: E(c.plan && c.plan[0]), cm: c.commit ? c.commit.id : null, w: +(c.waitT || 0).toFixed(1) })); })));
  if (!r.arrived && !r.stop) console.log('  last blocked by:', JSON.stringify(await p.evaluate(() => window.__pp.blk || null)), '| now', JSON.stringify(await p.evaluate(() => { const t = window.__D().drv?.telemetry(); const D = window.__D(), HM = window.__HOME(); return t && { x: +t.x.toFixed(1), z: +t.z.toFixed(1), h: +t.heading.toFixed(2), v: +t.v.toFixed(2), gear: t.gear, bumps: t.bumps, paused: t.paused, auto: t.auto, dest: t.dest, act: D.drv.action, act2: D.drv.action2, home: { in: HM.in, slot: HM.slot }, route: (() => { const r = D.VIL.route(t.x, t.z, t.dest || 'garage'); return [+r.len.toFixed(1), r.pts[r.pts.length - 1]]; })() }; })));
  console.log(`  leg → ${dest}: ${r.arrived ? 'arrived' : r.stop ? 'stopped (drive handed over)' : 'NOT ARRIVED'} after ${(r.t - t0).toFixed(1)} s sim${polClr ? ` · police stars cleared ${polClr}× so far (robot hit someone)` : ''} · max ${s.max.toFixed(0)} km/h · bumps ${s.bumps} · stuck ${s.stuck} · waited for traffic ${(s.yields / 60).toFixed(1)} s (${s.npc}) · pressed ${s.acts.join(',') || '-'} · 下車 while moving ${s.out2}`, el());
  return { ...r, ...s };
}
const driveInfo = () => p.evaluate(() => {
  const D = window.__D(), t = D.drv?.telemetry(), S = window.__S();
  return { on: D.on, trip: D.trip, cls: document.body.className, cur: D.cur, dest: t?.dest, paused: t?.paused, x: t && +t.x.toFixed(2), z: t && +t.z.toFixed(2), h: t && +t.heading.toFixed(3), kmh: t && Math.round(t.kmh),
    carParent: S.car.parent === D.TR?.scene ? 'town' : S.car.parent === window.__scene() ? 'garage' : String(S.car.parent?.type), voice: !!D.dvoice?.alive, action: D.drv?.action ?? null, action2: D.drv?.action2 ?? null,
    door: D.GAR && +D.GAR.door.t.toFixed(2), walk: D.walker?.mode, hud: !!document.querySelector('#stage .dv') && !document.querySelector('#stage .dv').hidden, drivebar: !document.getElementById('drivebar').hidden,
    dests: [...document.querySelectorAll('#dests button')].map((x) => x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(' ') };
});
const garLocal = () => p.evaluate(() => { const D = window.__D(), L = D.VIL.places.garage.lot, t = D.drv.telemetry(), c = Math.cos(L.heading), s = Math.sin(L.heading), dx = t.x - L.x, dz = t.z - L.z; return { x: +(dx * c - dz * s).toFixed(2), z: +(dx * s + dz * c).toFixed(2), h: +(t.heading - L.heading).toFixed(3) }; });
const lodAt = () => p.evaluate(() => { // 圓塔格子裡的車掛在那一格（room.group 底下）上：也算在車庫裡
  const D = window.__D(), R = window.__room(), under = (o, g) => { for (let q = o; q; q = q.parent) if (q === g) return true; return false; };
  return Object.fromEntries(Object.entries(D.LODS).map(([k, L]) => [k, !L.lod ? 'loading' : !L.lod.car.parent ? '-' : R && under(L.lod.car, R.group) ? 'page' : D.GAR && under(L.lod.car, D.GAR.group) ? 'town-garage' : L.lod.car.parent === D.VIL?.group ? 'town' : 'other']));
});
// 走路可以上的車（walk.js 的清單）跟畫面上的車（輕量車、完整的車）是不是同一個地方
const carsMatch = () => p.evaluate(() => {
  const D = window.__D(), out = [];
  for (const c of D.walker.cars) {
    const o = c.object; if (!o) { out.push(`${c.key}: no object`); continue; }
    o.updateMatrixWorld(true); const e = o.matrixWorld.elements, h = Math.atan2(e[8], e[10]);
    const dp = Math.hypot(e[12] - c.x, e[14] - c.z), dh = Math.abs(window.__H.wrapA(h - c.heading));
    if (dp > 0.01 || dh > 0.01 || !o.visible) out.push(`${c.key}: drawn ${dp.toFixed(3)} m / ${dh.toFixed(3)} rad off${o.visible ? '' : ' (hidden)'}`);
  }
  return { keys: D.walker.cars.map((c) => c.key + (c.drive ? '(parked)' : '')), bad: out };
});

// ---- 1 車庫頁（圓塔一樓）：YARIS 停在 2 樓 1 號（輕量車）；「出門」----
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
await p.waitForFunction(() => window.__D().LODS.yaris?.lod, null, { timeout: 300000 }); await p.waitForTimeout(800);
const bay0 = await p.evaluate(() => {
  const D = window.__D(), R = window.__room(), L = D.LODS.yaris.lod.car, b0 = D.TOWER_BAYS[0]; L.updateMatrixWorld(true); const e = L.matrixWorld.elements;
  return { on: L.parent?.name, pos: [+e[12].toFixed(6), +e[13].toFixed(6), +e[14].toFixed(6)], want: [b0.x, b0.y, b0.z], round: R.size.round, main: window.__S().car.position.toArray(), park: window.__G().park };
});
console.log('1', el(), 'car:', await txt('#carName'), '| wallet:', await txt('#wallet'), '| tower:', JSON.stringify(bay0), '| lods', JSON.stringify(await lodAt()));
check(bay0.on === 'towerBay1' && bay0.round && bay0.pos.every((v, i) => Math.abs(v - bay0.want[i]) < 1e-5) && bay0.main.every((v) => v === 0) && bay0.park?.mid === 'gc8' && bay0.park.tower?.[0] === 'yaris' && bay0.park.tower.length === 40,
  'page garage is the round tower: GC8 on the turntable, YARIS parked upstairs in 2 樓 1 號 (a save without park fills the spots by price)');
check(await p.evaluate(() => /車店/.test(document.querySelector('#cars button[data-car="supra"] span').textContent)), 'unowned car buttons say 車店');
await p.evaluate(() => { document.querySelector('#cars button[data-car="supra"]').click(); });
check(await p.evaluate(() => window.__D().cur === 'gc8' && /車店/.test(document.getElementById('gtoast').textContent)), 'tapping an unowned car only says it is at the car dealer');
const outBtn = await txt('#driveOut b');
check(outBtn === '出門', `the garage page button is 出門 (was 開車出門): 「${outBtn}」`);
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
await p.screenshot({ path: `${prefix}-1-page.png` }); console.log('  shot', `${prefix}-1-page.png`, el());
const ver = await p.evaluate(() => document.getElementById('brandVer').textContent);
const wantVer = '0.8.' + (SITE ? JSON.parse(fs.readFileSync(path.join(repo, 'version.json'), 'utf8')).build : (/const WEB_BUILD = (\d+);/.exec(fs.readFileSync(path.join(repo, 'app.js'), 'utf8')) || [])[1]);
check(ver === wantVer, `version next to the title is ${wantVer} (${ver})`);
let fi = await fsInfo(), clash = '';
console.log('  fullscreen (garage page):', JSON.stringify(fi));
check(!fi.fs && !fi.html && !fi.btn && fi.scrolls && (!APP || (fi.chrome === CHROME && fi.calls === '')), 'garage page: normal scrolling layout, no fullscreen button' + (APP ? ', the App header/switcher/tabs visible' : ''));
// ---- 自訂角色（車庫頁「出門」下面）：蓋滿畫面，上面 3D 預覽（真的人在轉盤上）、下面選項（身體／頭髮／衣服／配件）；隨機、取消、返回鍵都不存；完成才存 ----
const LOOK_KEYS = 'body,age,height,build,skin,face,hair,hairColor,top,topColor,bottom,bottomColor,shoes,shoesColor,hat,glasses,mask';
const lk1 = await p.evaluate(() => {
  const btn = document.getElementById('lookBtn'), br = btn.getBoundingClientRect(), out = document.getElementById('driveOut').getBoundingClientRect(); btn.click();
  const P = window.__look(), el = P.el, r = el.getBoundingClientRect();
  return { btn: btn.querySelector('b').textContent, below: br.top >= out.bottom - 1, open: P.isOpen, pos: getComputedStyle(el).position, rect: [r.left, r.top, r.width, r.height].map(Math.round), vw: innerWidth, vh: innerHeight, lock: document.documentElement.classList.contains('lk-open'),
    groups: [...el.querySelectorAll('.lk-g')].filter((g) => !g.hidden).map((g) => g.dataset.k).join(), secs: [...el.querySelectorAll('.optsub')].map((h) => h.textContent).join(), look: P.look };
});
await p.waitForFunction(() => !!window.__look().character, null, { timeout: 120000 });
const lkC = await p.evaluate(() => { const C = window.__look().character; return { tris: C.info.tris, h: C.height, bones: C.bones?.length, parent: !!C.group.parent }; });
console.log('  自訂角色:', JSON.stringify(lk1), JSON.stringify(lkC));
check(lk1.btn === '自訂角色' && lk1.below && lk1.open && lk1.pos === 'fixed' && lk1.rect.join() === `0,0,${lk1.vw},${lk1.vh}` && lk1.lock && lk1.groups === LOOK_KEYS && lk1.secs === '身體,頭髮,衣服,配件' && lk1.look.height === 1.74 && lk1.look.topColor === '#e8742c',
  '自訂角色 (below 出門) opens over the whole screen: preview + options in 4 sections (colour rows only when they apply), starting from the default player look');
check(lkC.tris > 2000 && lkC.bones === 29 && lkC.h === 1.74 && lkC.parent, `the preview shows the real character (${lkC.tris} triangles, 29 bones), not the box stand-in`);
const lk2 = await p.evaluate(() => {
  const P = window.__look(), el = P.el, g = (k) => el.querySelector(`.lk-g[data-k="${k}"]`), click = (k, label) => [...g(k).querySelectorAll('button')].find((b) => b.textContent === label || b.getAttribute('aria-label') === label).click();
  click('hat', '棒球帽'); const hatColor = !g('hatColor').hidden;
  click('mask', '戴口罩'); const maskColor = !g('maskColor').hidden;
  click('hair', '光頭'); const noHairColor = g('hairColor').hidden;
  click('shoes', '藍白拖'); const noShoeColor = g('shoesColor').hidden;
  click('age', '小孩'); const kid = [P.look.height, +g('height').querySelector('input').max, [...g('height').querySelectorAll('.lk-presets button')].filter((b) => !b.hidden).length];
  click('age', '大人');
  const rng = g('height').querySelector('input'); rng.value = '2'; rng.dispatchEvent(new Event('input', { bubbles: true }));
  click('topColor', '紅色');
  return { hatColor, maskColor, noHairColor, noShoeColor, kid, tall: P.look.height, max: +rng.max, label: g('height').querySelector('b').textContent, look: P.look, pressed: g('topColor').querySelector('[aria-pressed="true"]')?.getAttribute('aria-label') };
});
await p.waitForTimeout(700);
const lk2c = await p.evaluate(() => { const C = window.__look().character; return { h: C.height, hat: C.look.hat, mask: C.look.mask, top: C.look.topColor }; });
console.log('  choices:', JSON.stringify(lk2), JSON.stringify(lk2c));
check(lk2.hatColor && lk2.maskColor && lk2.noHairColor && lk2.noShoeColor && lk2.kid.join() === '1.3,1.6,0' && lk2.tall === 1.9 && lk2.max === 1.9 && lk2.label === '1.90 公尺' && lk2.pressed === '紅色',
  `choices: cap → 帽子顏色 appears, 戴口罩 → 口罩顏色, 光頭 hides 髮色, 藍白拖 hides 鞋子顏色; 小孩 → 1.30 m (slider up to 1.60, no adult presets); height slider stops at 1.90 m (lift decks); 紅色 highlighted`);
check(lk2c.h === 1.9 && lk2c.hat === 'cap' && lk2c.mask === true && lk2c.top === '#c8322c', 'the preview person changes right away (1.90 m, cap, mask, red top)');
await p.screenshot({ path: `${prefix}-1b-look.png` }); console.log('  shot', `${prefix}-1b-look.png`, el());
// 隨機：換成村子裡隨便一個人（還是在範圍裡）；取消：不存
const lk3 = await p.evaluate(() => { const P = window.__look(), a = JSON.stringify(P.look); P.el.querySelector('.lk-rand').click(); const L = P.look; P.el.querySelector('.lk-cancel').click();
  return { changed: JSON.stringify(L) !== a, h: L.height, type: 'type' in L, open: P.isOpen, lock: document.documentElement.classList.contains('lk-open'), look: window.__G().look, saved: JSON.parse(localStorage.getItem('carid.tune') || '{}').look ?? null }; });
check(lk3.changed && lk3.h >= 1 && lk3.h <= 1.9 && !lk3.type && !lk3.open && !lk3.lock && lk3.look === null && lk3.saved === null, `隨機 gives a random villager look (${lk3.h} m); 取消 closes without saving`);
// 返回鍵（App 的外殼叫 caridExitFullscreen）：先關自訂角色（不存），再按一次才是原本的（不在全螢幕：false）
const lk4 = await p.evaluate(() => { document.getElementById('lookBtn').click(); const P = window.__look(); P.set('hair', 'long'); const b1 = window.caridExitFullscreen(), open = P.isOpen, b2 = window.caridExitFullscreen(); return { b1, open, b2, look: window.__G().look }; });
check(lk4.b1 === true && !lk4.open && lk4.b2 === false && lk4.look === null, 'Android back with 自訂角色 open closes it (not saved); pressed again it is the page\'s normal back (false)');
// 在每一種螢幕大小：上面一排（取消、自訂角色、隨機、完成）都在畫面裡、不重疊；預覽、選項都有位置
await p.evaluate(() => document.getElementById('lookBtn').click());
const lkBad = [];
for (const [w, h] of [...SIZES, [390, 844]]) {
  await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(250);
  const m = await p.evaluate(() => { const el = window.__look().el, R = ['.lk-cancel', '.lk-title', '.lk-rand', '.lk-done'].map((s) => [s, el.querySelector(s).getBoundingClientRect()]), bad = [];
    for (const [s, r] of R) if (r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight) bad.push(s + ' off-screen');
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const a = R[i][1], b = R[j][1]; if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) bad.push(R[i][0] + ' × ' + R[j][0]); }
    const v = el.querySelector('.lk-view').getBoundingClientRect(), o = el.querySelector('.lk-opts').getBoundingClientRect();
    if (v.height < 150 || v.width < 200) bad.push(`preview ${Math.round(v.width)}×${Math.round(v.height)}`); if (o.height < 150 || o.width < 250) bad.push(`options ${Math.round(o.width)}×${Math.round(o.height)}`);
    return bad.join(', '); });
  if (m) lkBad.push(`${w}x${h}: ${m}`);
}
check(!lkBad.length, `自訂角色 on 360×800, 412×915, 915×412, 800×360, 1280×720: top buttons on screen and apart, preview and options both get room (${lkBad.join(' / ') || 'ok'})`);
// 完成：存起來（重新整理也在）
const lk5 = await p.evaluate(() => { const P = window.__look(); P.set('hair', 'short'); P.set('topColor', '#2f6fd6'); P.set('bottom', 'shorts'); P.set('hat', 'cap'); P.set('hatColor', '#c8322c');
  P.el.querySelector('.lk-done').click(); const sv = JSON.parse(localStorage.getItem('carid.tune') || '{}').look; return { open: P.isOpen, look: window.__G().look, saved: sv, toast: document.getElementById('gtoast').textContent }; });
console.log('  完成:', JSON.stringify(lk5));
check(!lk5.open && lk5.look?.hair === 'short' && lk5.look.topColor === '#2f6fd6' && lk5.look.hat === 'cap' && lk5.look.height === 1.74 && JSON.stringify(lk5.saved) === JSON.stringify(lk5.look) && /換好了/.test(lk5.toast), `完成 saves your look (GAME.look in the save): 「${lk5.toast}」`);

// ---- 2 出門：人站在你家（圓塔）一樓，鐵捲門關著；GC8 停在電梯的圓台上（車頭朝門），YARIS 停在 2 樓 1 號 ----
await p.evaluate(() => document.getElementById('driveOut').click());
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.waitForFunction(() => window.__D().LODS.yaris?.lod?.car.parent?.name === 'towerBay1', null, { timeout: 120000 });
const s2 = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker; H.step(10); const t = W.telemetry(), q = H.gl(t.x, t.z), sp = D.VIL.places.garage.spawn, c = D.tripS.car, sh = D.TR.scene.getObjectByName('park-shadow');
  return { mode: t.mode, local: [+q.x.toFixed(2), +q.z.toFixed(2)], drv: !!D.drv, dv: !!document.querySelector('#stage .dv'), wk: H.visible('#stage .wk'), door: D.GAR.door.t, dest: t.dest, hidden: t.hidden,
    carTown: c.parent === D.TR.scene && c.visible, carAt: Math.hypot(c.position.x - sp.x, c.position.z - sp.z), carH: Math.abs(c.rotation.y - sp.heading), shadow: !!sh?.visible, tripFull: D.tripFull,
    yarisBay: (() => { const p = D.tripPose.yaris, b = H.gw(D.TOWER_BAYS[0].x, D.TOWER_BAYS[0].z); return p.tw === 0 ? Math.hypot(p.x - b.x, p.z - b.z) : 99; })(), floor: D.GAR.floor, dests: [...document.querySelectorAll('#dests button')].map((x) => x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(' ') };
});
console.log('2', el(), 'on foot:', JSON.stringify(s2), '| lods', JSON.stringify(await lodAt()));
check(s2.mode === 'walk' && !s2.drv && !s2.dv && s2.wk && !s2.hidden && s2.door === 0 && s2.dest === 'shop' && s2.floor === 0 && Math.hypot(...s2.local) > 3.3 && Math.hypot(...s2.local) < 11, 'starts ON FOOT on the tower\'s ground floor, off the lift (door closed, no car being driven, walking HUD, destination shop)');
check(s2.carTown && s2.carAt < 1e-6 && s2.carH < 1e-6 && s2.shadow && s2.tripFull === 'gc8' && s2.yarisBay < 1e-6, 'GC8 parked on the round lift facing the door (full model + shadow), YARIS upstairs in 2 樓 1 號');
const me2 = await p.evaluate(() => { const C = window.__D().walker.character, L = window.__G().look; return { tris: C.info?.tris, bones: C.bones?.length, h: C.height, r: +C.radius.toFixed(3), same: ['hair', 'topColor', 'bottom', 'hat', 'hatColor'].every((k) => C.look[k] === L[k]) }; });
const np0 = await p.evaluate(() => { const N = window.__N(), D = window.__D(); if (!N) return null; return { load: N.load, max: window.__NMAX(), g: N.g.parent === D.TR.scene, vis: N.g.visible, tb: N.traffic.stats.built, pb: N.peds.stats.built, props: N.peds.props.colliders.length,
  pool: N.g.children.filter((o) => o.name.startsWith('lodcar-')).length, drivers: N.g.children.filter((o) => o.name.startsWith('lodcar-')).every((o) => o.getObjectByName('body').children.some((k) => k.isGroup || k.isBone || k.type === 'Group')) }; });
console.log('  npc (loading screen):', JSON.stringify(np0));
check(np0 && np0.g && np0.vis && np0.load.warmCars >= np0.max.cars && np0.pb >= np0.max.people && np0.props > 0 && np0.pool >= np0.max.cars,
  `路上的人和車 made on the loading screen: ${np0?.tb} cars/scooters (with drivers/riders) and ${np0?.pb} people ready (graphs ${np0?.load.graphs} ms, cars ${np0?.load.cars} ms, people ${np0?.load.people} ms); ${np0?.props} benches/chairs block walking and driving`);
check(me2.tris > 2000 && me2.bones === 29 && me2.same && me2.h === 1.74, `you walk around as the real character in your saved look (${me2.tris} triangles, ${me2.h} m, radius ${me2.r})`);
let cm = await carsMatch();
check(cm.keys.join() === 'gc8' && !cm.bad.length, `GC8 can be boarded (YARIS is upstairs: not from the ground floor) and the walking list matches where it is drawn (${cm.keys.join(', ')}${cm.bad.length ? ' — ' + cm.bad.join('; ') : ''})`);
await drawAndShot('2-on-foot');
// 全螢幕：出門（走路）就蓋滿整個螢幕；搖桿、目的地、小地圖、換視角、去哪裡、直接回車庫、聲音、全螢幕鈕都在螢幕裡、不重疊（五種螢幕大小也一樣）
fi = await fsInfo(); clash = await hudClash();
console.log('  fullscreen (on foot):', JSON.stringify(fi), '| clash:', clash || '-');
check(fullView(fi) && fi.walking && fi.pressed === 'true' && fi.pref === null && (!APP || fi.calls === 'true'),
  'on foot after 出門: fullscreen by default (stage fixed over the whole viewport, page does not scroll' + (APP ? ', App header/switcher/tabs hidden, CaridApp.setFullscreen(true)' : '') + ')');
check(!clash, `on foot: joystick, destination chip, map, eye, destination buttons, 直接回車庫, sound and fullscreen buttons all on screen, none overlapping (${clash || 'ok'})`);
clash = await sizeSweep();
check(!clash, `on foot on other screens (360×800, 412×915, landscape 915×412 and 800×360, 1280×720): all on screen, none overlapping (${clash || 'ok'})`);
// 碰撞：後牆、關著的鐵捲門（裡面）、停著的車（GC8）
const col = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, R = W.character.radius;
  const go = (x, z, ux, uz, s = 10) => { const a = H.gw(x, z), d = H.gw(x + ux, z + uz); W.teleport({ x: a.x, z: a.z, heading: 0 }); H.step(30); H.push(Math.atan2(-(d.z - a.z), d.x - a.x), s, 1, false); H.step(10); const t = W.telemetry(); return H.gl(t.x, t.z); };
  const bk = go(-5, 5, -1, 0); return { R, back: Math.hypot(bk.x, bk.z), wall: D.TOWER.RO + 0.1 - 0.18, door: go(6, 1, 1, 0).x, doorAt: (D.TOWER.DX0 + D.TOWER.DX1) / 2 + 0.03 - 0.25, car: go(0, -4, 0, 1, 4).z, hz: W.cars.find((c) => c.key === 'gc8').hz, doorT: D.GAR.door.t };
});
console.log('  collide:', JSON.stringify(col));
check(col.back <= col.wall - col.R + 0.08 && col.back > col.wall - col.R - 0.3, `the round glass wall stops you (${col.back.toFixed(2)} m from the middle, wall inside at ${col.wall.toFixed(2)})`);
check(col.door <= col.doorAt - col.R + 0.03 && col.door > col.doorAt - col.R - 0.3 && col.doorT === 0, `closed roller door stops you from inside (x ${col.door.toFixed(2)}, door inside at ${col.doorAt.toFixed(2)})`);
check(col.car <= -(col.hz + col.R) + 0.03 && col.car > -(col.hz + col.R) - 0.25, `parked GC8 blocks you (stopped at z ${col.car.toFixed(2)}, car half width ${col.hz.toFixed(2)})`);
// 在車庫裡亂走：每一格人都不可以卡進東西（牆、車、門）、鏡頭不在東西裡面
const rnd = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker; let seed = 5; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cols = H.cols(), bad = []; let frames = 0;
  const spots = [[-5, -5], [-7, 1], [-3, 5], [3, 7], [6, -5], [-6, 6], [7, 3], [1, -3.5], [0.5, -8], [9, 1]]; // 圓塔一樓（半徑 12）：大廳、電梯旁邊、小房子裡面
  for (const [lx, lz] of spots) {
    const w = H.gw(lx, lz); W.teleport({ x: w.x, z: w.z, heading: r() * 6.28 }); H.step(3);
    let a = r() * 6.28;
    for (let i = 0; i < 180; i++) {
      if (i % 45 === 0) { a = r() * 6.28; if (r() < 0.4) W.setCamera({ yaw: r() * 6.28, pitch: -0.2 + r() * 1.1 }); }
      const t = W.telemetry(), rel = a - t.camYaw, m = 0.5 + r() * 0.5; W.setInput({ x: -Math.sin(rel) * m, y: Math.cos(rel) * m, run: i % 90 > 50 });
      H.step(1); frames++;
      const b = H.checkFrame(cols); if (b.length && bad.length < 6) bad.push(`(${lx},${lz}) f${i}: ${b.join('; ')}`);
    }
  }
  W.setInput(null); W.setCamera({ hold: 0 });
  return { frames, bad };
});
check(!rnd.bad.length, `random walking inside the garage (10 × 3 s, walk/run, random camera): never inside a wall/car/door, camera never inside or behind a wall (${rnd.frames} frames${rnd.bad.length ? ' — ' + rnd.bad.join(' | ') : ''})`);
// 走去 GC8 的駕駛座（車子左邊＝車庫本地 −z）：「上車 · GC8」
const w2 = await p.evaluate(() => { const D = window.__D(), H = window.__H, W = D.walker, a = H.gw(-4.5, -4, -1.05); W.teleport(a); H.step(20); const r = H.walkLocal([[-2.6, -2.6], [-0.6, -2.3]]); return { r, act: H.actText(), near: W.telemetry().near }; });
check(w2.r.ok && w2.act === '上車 · GC8' && w2.near === 'gc8', `walk up to GC8: 「${w2.act}」 (walked ${w2.r.s?.toFixed(1)} s)`);
// 車子旁邊：大按鈕「上車 · GC8」＋右下角的圓按鈕（第 3 批的「揍」，先放一顆一樣大的）也都不重疊
await p.evaluate(() => window.__D().walker.setButtons([{ id: 'punch', label: '揍', key: 'KeyF', onClick() {} }]));
clash = await hudClash(); const clashNear = await sizeSweep();
await p.evaluate(() => window.__D().walker.setButtons(null));
check(!clash && !clashNear, `on foot next to a car (big 「上車 · GC8」 + a round button bottom right): nothing overlapping on any screen (${[clash, clashNear].filter(Boolean).join(' / ') || 'ok'})`);
await drawAndShot('3-near-car');
const bd = await p.evaluate(() => { const H = window.__H, pressed = H.press(), r = H.board(); return { pressed, ...r }; });
await p.evaluate(() => window.__H.step(40));
const inCar = await p.evaluate(() => { const D = window.__D(), H = window.__H, t = D.drv?.telemetry(), sp = D.VIL.places.garage.spawn; return { drv: !!D.drv, act: H.actText(), act2: H.act2(), paused: t?.paused, at: t && Math.hypot(t.x - sp.x, t.z - sp.z), hidden: D.walker.telemetry().hidden, wk: H.visible('#stage .wk'), dv: H.visible('#stage .dv'), voice: !!D.dvoice?.alive, cur: D.cur, shadow: !!D.TR.scene.getObjectByName('park-shadow')?.visible, dshadow: !!D.TR.scene.getObjectByName('drive-shadow')?.visible }; });
console.log('  上車:', JSON.stringify(bd), JSON.stringify(inCar));
check(bd.pressed === '上車 · GC8' && bd.modes.join('>') === 'in>seat>off' && inCar.drv && !inCar.paused && inCar.at < 0.01 && inCar.hidden && !inCar.wk && inCar.dv && inCar.voice && inCar.cur === 'gc8' && !inCar.shadow && inCar.dshadow, '上車: walks to the door, sits, character hidden, GC8 drives from where it was parked (engine on, drive HUD, one shadow)');
check(inCar.act === '開鐵捲門' && inCar.act2 === '下車', `in the car with the door closed BOTH buttons show: big 「${inCar.act}」 and the separate 「${inCar.act2}」`);
// Nick 2026-10-14「第一人稱方向盤要轉」：駕駛座的方向盤跟著 steer 轉（右轉＝從駕駛看順時針，打到底 90 度）；轉向柱不轉
const swh = await p.evaluate(() => { const D = window.__D(), c = D.tripS?.cabin, g = c?.getObjectByName('cabin-wheel'), H = window.__H; if (!g) return { g: false };
  const ang = () => { const q = g.quaternion, a = 2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180 / Math.PI, n = Math.hypot(q.x, q.y, q.z); return n < 1e-6 ? 0 : +(a * Math.sign(q.x / n * Math.sign(q.w))).toFixed(1); }; // 轉軸大約往後（−x）：右轉 x 分量 > 0
  const out = { g: true, kids: g.children.length, a0: ang() };
  D.drv.setInput({ throttle: 0, brake: 0, steer: 1 }); H.step(60); out.R = ang(); out.tR = +D.drv.telemetry().steer.toFixed(2);
  D.drv.setInput({ throttle: 0, brake: 0, steer: -1 }); H.step(60); out.L = ang();
  D.drv.setInput(null); H.step(60); out.back = ang(); out.col = !!c.getObjectByName('cabin-trim'); return out; });
console.log('  steering wheel:', JSON.stringify(swh));
check(swh.g && swh.kids >= 1 && swh.a0 === 0 && swh.tR === 1 && Math.abs(swh.R - 90) < 1 && Math.abs(swh.L + 90) < 1 && swh.back === 0 && swh.col, `first person: the steering wheel turns with the steering (right +${swh.R}°, left ${swh.L}°, back to ${swh.back}°)`);
fi = await fsInfo(); clash = await hudClash();
console.log('  fullscreen (in the car):', JSON.stringify(fi), '| clash:', clash || '-');
check(fullView(fi) && !fi.walking && !clash, `in the car: still fullscreen; 開鐵捲門, 下車, steering, pedals, map and the page buttons all on screen, none overlapping (${clash || 'ok'})`);
clash = await sizeSweep();
check(!clash, `in the car on other screens (landscape: 下車 moves into the row of round buttons): none overlapping (${clash || 'ok'})`);
// 修 11＋Nick 2026-10-10「按鈕不用總是全部顯示…點了再列出來 再點一次就收起來」「加個遊戲設定的選項 可以讓他自訂想看到的大小」：
//   全螢幕開車（直拿、橫拿）＝一顆「📍 去哪裡 ▾」＋一顆「⋯」（聲音、全螢幕、換視角、Aa 按鈕大小），按了打開、再按收起來、選了地方收起來；「手煞車」一行
//   731×338＝2340×1080 的手機「顯示大小」調大（約 3.2 倍）
const dtog = [];
for (const [w, h] of [[390, 844], [360, 740], [915, 412], [800, 360], [731, 338]]) {
  await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(250); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const st = () => p.evaluate(() => { const H = window.__H, hb = document.querySelector('#stage .dv-hb'), rg = document.createRange(); rg.selectNodeContents(hb);
    const lines = new Set([...rg.getClientRects()].map((r) => Math.round(r.top))).size, B = document.body.classList;
    return { tog: H.visible('#destTog'), dests: H.visible('#dests button[data-d="shop"]'), home: H.visible('#driveHome'), hbLines: lines, open: B.contains('destsopen'),
      more: H.visible('#moreTog'), snd: H.visible('#dSndBtn'), fs: H.visible('#fsBtn'), cam: H.visible('#stage .dv-cam'), aa: H.visible('#sizeTog'), pop: H.visible('#sizePop'), mopen: B.contains('moreopen'),
      gas: Math.round(document.querySelector('#stage .dv-gas').getBoundingClientRect().height), z: getComputedStyle(document.documentElement).getPropertyValue('--hudz').trim(), saved: localStorage.getItem('carid.btnsize') }; });
  const shut = await st(), c0 = await hudClash();
  await p.click('#destTog'); await p.waitForTimeout(80);
  const open = await st(), c1 = await hudClash();
  await p.click('#dests button[data-d="shop"]'); await p.waitForTimeout(80);
  const picked = await st(), dest = await p.evaluate(() => window.__D().drv.telemetry().dest);
  await p.evaluate(() => window.__D().setDest(null));
  await p.click('#moreTog'); await p.waitForTimeout(80);
  const more = await st(), c2 = await hudClash();
  await p.click('#sizeTog'); await p.waitForTimeout(80);
  const pop = await st(), c3 = await hudClash();
  await p.click('#sizePop button[data-z="s"]'); await p.waitForTimeout(150);
  const small = await st(), c4 = await hudClash();
  await p.click('#sizeTog'); await p.waitForTimeout(80); await p.click('#sizePop button[data-z="l"]'); await p.waitForTimeout(150);
  const large = await st(), c5 = await hudClash();
  await p.click('#sizeTog'); await p.waitForTimeout(80); await p.click('#sizePop button[data-z="m"]'); await p.waitForTimeout(150);
  await p.click('#moreTog'); await p.waitForTimeout(80);
  const back = await st();
  dtog.push({ w, h, shut, open, picked, dest, more, pop, small, large, back, c0, c1, c2, c3, c4, c5 });
}
await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(250); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
console.log('  去哪裡 / ⋯ / 按鈕大小:', JSON.stringify(dtog));
// 「大」放大到排得下為止：直拿 390 寬、橫拿 340 高＝1 倍（不會比「中」小）；915×412 這種夠大的畫面就是 1.15
const bigZ = (w, h) => +Math.max(1, Math.min(1.15, h <= 560 ? h / 340 : w / 390)).toFixed(2);
check(dtog.every((d) => d.shut.tog && !d.shut.dests && !d.shut.home && !d.shut.open && d.shut.more && !d.shut.snd && !d.shut.fs && !d.shut.cam && !d.shut.aa && !d.c0),
  `full screen in the car (portrait 390×844, 360×740; landscape 915×412, 800×360, big-display 731×338): only 「📍 去哪裡 ▾」 and 「⋯」 show (no list over the road, no row of round buttons), nothing overlapping`);
check(dtog.every((d) => d.open.dests && d.open.home && d.open.open && !d.c1 && d.dest === 'shop' && !d.picked.open && !d.picked.dests),
  `tapping 去哪裡 opens the list (with 直接回車庫), nothing overlapping (${dtog.map((d) => d.c1 || 'ok').join(', ')}); picking 「去改車廠」 sets the route and folds it again`);
check(dtog.every((d) => d.more.mopen && d.more.snd && d.more.fs && d.more.cam && d.more.aa && !d.c2 && !d.back.mopen && !d.back.snd && !d.back.fs && !d.back.cam),
  `tapping 「⋯」 shows sound, full screen, camera and 「Aa」 in one row, nothing overlapping (${dtog.map((d) => d.c2 || 'ok').join(', ')}); tapping it again folds them`);
check(dtog.every((d) => d.pop.pop && !d.pop.snd && !d.c3 && d.small.z === '0.8' && d.small.saved === 's' && !d.small.pop && Math.abs(d.small.gas / d.shut.gas - 0.8) < 0.05 && !d.c4 && +d.large.z === bigZ(d.w, d.h) && d.large.saved === 'l' && Math.abs(d.large.gas / d.shut.gas - bigZ(d.w, d.h)) < 0.05 && !d.c5 && d.back.z === '1' && d.back.saved === 'm') && dtog.find((d) => d.w === 915).large.z === '1.15',
  `「Aa」 → 「按鈕大小 小 中 大」: 小 makes the buttons 0.8× (gas ${dtog.map((d) => d.shut.gas + '→' + d.small.gas).join(', ')} px), 大 up to 1.15× where it still fits (${dtog.map((d) => d.large.z).join(', ')}), saved on this phone; nothing overlapping at any size (${dtog.map((d) => (d.c4 || 'ok') + '/' + (d.c5 || 'ok')).join(', ')})`);
check(dtog.every((d) => d.shut.hbLines === 1), `「手煞車」 stays on one line on every size (${dtog.map((d) => d.shut.hbLines).join(', ')} line)`);
// 右上的鈕：離開全螢幕（畫面回到頁面裡，下面那排大按鈕回來）→ 再按一次回到全螢幕；返回鍵（外殼叫 window.caridExitFullscreen）只離開這一趟
await p.evaluate(() => document.getElementById('fsBtn').click()); await p.waitForTimeout(300);
const off1 = await fsInfo(), offBar = await p.evaluate(() => { const r = document.getElementById('drivebar').getBoundingClientRect(), s = document.getElementById('stage').getBoundingClientRect(); return { below: r.top >= s.bottom - 1, h: Math.round(s.height) }; });
clash = await hudClash(false);
console.log('  fullscreen off:', JSON.stringify(off1), JSON.stringify(offBar), '| clash:', clash || '-');
await drawAndShot('4b-fullscreen-off');
check(!off1.fs && !off1.html && off1.pos !== 'fixed' && off1.btn && off1.pressed === 'false' && off1.pref === 'off' && offBar.below && off1.scrolls && !clash && (!APP || ((SITE || (/\.segbar/.test(off1.chrome) && /\.tabbar/.test(off1.chrome))) && off1.calls === 'true,false')),
  'fullscreen button: back to the normal layout (drive bar under the stage), remembered as off' + (APP ? ', CaridApp.setFullscreen(false)' : ''));
clash = await sizeSweep(false, ['#fsBtn']);
check(!clash, `fullscreen off on other screens: the fullscreen button does not cover any other button (${clash || 'ok'})`);
await p.evaluate(() => document.getElementById('fsBtn').click()); await p.waitForTimeout(300);
fi = await fsInfo();
check(fullView(fi) && fi.pref === 'on' && (!APP || fi.calls === 'true,false,true'), 'fullscreen button again: fullscreen, remembered as on');
const back1 = await p.evaluate(() => window.caridExitFullscreen()); fi = await fsInfo();
const back2 = await p.evaluate(() => window.caridExitFullscreen());
check(back1 === true && back2 === false && !fi.fs && fi.pref === 'on' && fi.pressed === 'false' && (!APP || (fi.calls === 'true,false,true,false' && (SITE ? new URL(p.url()).pathname === '/' : /tune\.html/.test(p.url())))),
  'Android back (caridExitFullscreen) leaves fullscreen for this trip only (setting stays on); when not fullscreen it returns false');
await p.evaluate(() => document.getElementById('fsBtn').click()); await p.waitForTimeout(300);
fi = await fsInfo();
check(fullView(fi) && fi.pref === 'on' && (!APP || fi.calls === 'true,false,true,false,true'), 'fullscreen on again (button after back)');
await drawAndShot('4-in-car-two-buttons');
// 門關著直直開：撞到門，出不去
const blocked = await p.evaluate(() => { const d = window.__D().drv; d.setInput({ throttle: 1, brake: 0, steer: 0 }); window.__dstep(240); d.setInput({ throttle: 0, brake: 1, steer: 0 }); window.__dstep(90); d.setInput(null); return d.telemetry().bumps; });
const gl = await garLocal();
console.log('  door closed, full throttle 4 s →', JSON.stringify(gl), 'bumps', blocked);
check(gl.x < 11.95 - 1.5 && blocked > 0, `closed roller door blocks the car (x ${gl.x})`);
// 撞爛拿掉了：油門踩到底撞上關著的鐵捲門 → 不會凹、不會沒力；舊存檔裡 GC8 撞過的也清掉了
const dd = await p.evaluate(() => { const D = window.__D(), m = D.tripS?.dmg, G = window.__G(), sv = JSON.parse(localStorage.getItem('carid.tune') || '{}');
  return { has: !!m, health: m && +m.health.toFixed(3), power: m && +m.perf.power.toFixed(3), n: G.dmg?.gc8?.h?.length || 0, saved: !!sv.dmg?.gc8 || !!G.dmg?.gc8 }; });
console.log('  crash damage:', JSON.stringify(dd));
check(!dd.has && dd.n === 0 && !dd.saved, 'no crash damage: hitting the closed door leaves GC8 as it was, and the old save\'s dented GC8 was dropped on load');
// 倒回來停好 → 下車（右邊那顆）：從駕駛座那邊走出來，車子停在原地
const out1 = await p.evaluate(() => {
  const D = window.__D(), H = window.__H; D.drv.teleport(D.VIL.places.garage.spawn); window.__dstep(3); window.__drv0 = D.drv;
  const pressed = H.press2(); H.step(2); const m1 = D.walker.mode; H.step(40);
  const t = D.walker.telemetry(), q = H.gl(t.x, t.z), c = D.tripS.car, sp = D.VIL.places.garage.spawn;
  return { pressed, m1, mode: t.mode, local: [+q.x.toFixed(2), +q.z.toFixed(2)], paused: D.drv.telemetry().paused, car: Math.hypot(c.position.x - sp.x, c.position.z - sp.z), voice: !!window.__D().dvoice, dshadow: !!D.TR.scene.getObjectByName('drive-shadow')?.visible, dv: H.visible('#stage .dv'), wk: H.visible('#stage .wk') };
});
console.log('  下車:', JSON.stringify(out1));
check(out1.pressed === '下車' && out1.m1 === 'out' && out1.mode === 'walk' && out1.paused && out1.car < 1e-6 && !out1.voice && out1.dshadow && !out1.dv && out1.wk && out1.local[1] < -1.0, '下車 → steps out on the driver side (left), engine off, the car stays where it stopped (with its shadow), walking HUD back');
cm = await carsMatch();
check(cm.keys.join() === 'gc8(parked)' && !cm.bad.length, `the car you got out of is boardable where it stands (${cm.keys.join(', ')}${cm.bad.length ? ' — ' + cm.bad.join('; ') : ''})`);
await drawAndShot('5-got-out');
// 走路開鐵捲門（裡面）→ 走出去 → 走遠了門自己關 → 走回來（外面）開鐵捲門 → 走回車子旁邊
const dw = await p.evaluate(() => { const H = window.__H, r = H.walkLocal([[10.4, -1.7]]); return { ok: r.ok, act: H.actText() }; });
check(dw.ok && dw.act === '開鐵捲門', `on foot at the closed door (inside): 「${dw.act}」`);
clash = await hudClash(); const clashDoor = await sizeSweep();
check(!clash && !clashDoor, `on foot at the door (big 「開鐵捲門」): nothing overlapping on any screen (${[clash, clashDoor].filter(Boolean).join(' / ') || 'ok'})`);
await drawAndShot('6-door-on-foot');
const dop = await p.evaluate(() => { const D = window.__D(), H = window.__H, pressed = H.press(); H.step(10); const m = D.GAR.door.moving; H.step(160); return { pressed, m, t: D.GAR.door.t, act: H.actText() }; });
check(dop.pressed === '開鐵捲門' && dop.m && dop.t === 1 && !/鐵捲門/.test(dop.act || ''), `the roller door rolls up from the walking button; no door button once it is up (no 關鐵捲門 by default) (${JSON.stringify(dop)})`);
// Nick 2026-10-13「順著開出車庫」：你家就在車庫街你那間（沒連線＝1 號）：走出鐵捲門就在車庫街的路上
const wo = await p.evaluate(() => { const D = window.__D(), H = window.__H, r = H.walkLocal([[14, -1.5], [22, -1]]), t = window.__D().walker.telemetry(), q = D.VIL.places.garst.slots[0].lot; return { ok: r.ok, local: H.gl(t.x, t.z), slot: window.__HOME().slot, lot: Math.hypot(D.VIL.places.garage.lot.x - q.x, D.VIL.places.garage.lot.z - q.z), z: +t.z.toFixed(1) }; });
check(wo.ok && wo.local.x > 20 && wo.slot === 0 && wo.lot < 1e-6 && Math.abs(wo.z + 72) < 4, `walked out of the garage through the open door straight onto the garage street (#1 offline; local x ${wo.local.x.toFixed(1)}, z ${wo.z})`);
await drawAndShot('7-walked-out');
const far = await p.evaluate(() => { const D = window.__D(), H = window.__H, r = H.walkPath([[-345, -72], [-300, -72.5], [-262, -72.5]], { m: 1, run: true }); H.step(200); return { ok: r.ok, door: D.GAR.door.t }; });
check(far.ok && far.door === 0, `walked away (> 30 m): the door closed by itself (GC8 is not under it) — door ${far.door}`);
const wn = await p.evaluate(() => {
  const N = window.__N(), D = window.__D(), H = window.__H, W = D.walker, t0 = W.telemetry(); H.step(30);
  const q = N.peds.people.filter((o) => !o.gone && o.mode !== 'lie' && o.mode !== 'fall').sort((a, b) => Math.hypot(a.x - t0.x, a.z - t0.z) - Math.hypot(b.x - t0.x, b.z - t0.z))[0];
  if (!q) return { people: 0 };
  const d0 = Math.hypot(q.x - t0.x, q.z - t0.z), a = Math.atan2(-(q.z - t0.z), q.x - t0.x);
  W.teleport({ x: q.x - Math.cos(a) * 1.3, z: q.z + Math.sin(a) * 1.3, heading: a }); H.step(1);
  const inMov = N.MOV.some((c) => c.person === q), me = { hx: N.me.hx, x: +(N.me.x - W.telemetry().x).toFixed(3) };
  let minGap = Infinity; for (let i = 0; i < 40; i++) { const t = W.telemetry(), g = Math.hypot(q.x - t.x, q.z - t.z) - q.r - W.character.radius; minGap = Math.min(minGap, g); const b = Math.atan2(-(q.z - t.z), q.x - t.x); W.setInput({ x: -Math.sin(b - t.camYaw) * 0.8, y: Math.cos(b - t.camYaw) * 0.8 }); H.step(1); }
  W.setInput(null); H.step(5); W.teleport({ x: t0.x, z: t0.z, heading: t0.heading }); H.step(10);
  return { people: N.peds.people.filter((o) => !o.gone).length, cars: N.traffic.cars.length, d0: +d0.toFixed(1), mode: q.mode, inMov, me, minGap: +minGap.toFixed(3) };
});
console.log('  on foot in the village:', JSON.stringify(wn));
check(wn.people > 0 && wn.inMov && wn.me.hx === 0.3 && wn.minGap > -0.06, `on foot in the village: ${wn.people} residents around (and ${wn.cars} cars); walking into one, they block you like a wall (closest gap ${wn.minGap} m) — you count as a person for the traffic`);
// ---- 走進房子（interiors.js）：透天厝的門口往裡面推 → 黑掉 → 在房子裡面（自己的場景：只畫你和房子；村子的碰撞拿掉、換這一層的）→ 走來走去 → 上樓、下樓 → 走出大門回到外面門口 ----
const doorDone = async () => { // 門口的淡出淡入跑完（第一次進門等 shader 編譯：幾格幾格走，中間讓頁面跑 Promise）
  for (let i = 0; i < 900; i++) { if (!(await p.evaluate(() => { window.__H.step(2); return !!window.__IN().doorFade; }))) return i; }
  return -1;
};
const hdoor = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, X = window.__IN(), t0 = W.telemetry(), cols = H.cols(), R = W.character.radius;
  const out = (d) => { const nx = -Math.sin(d.ry), nz = -Math.cos(d.ry); return { x: d.ax - nx * 2, z: d.az - nz * 2 }; };
  const all = W.doors.map((d) => d.ref).filter(Boolean), open = all.filter((b) => X.interiorFor(b)).length, shut = all.filter((b) => !X.interiorFor(b)).map((b) => b.kind).sort().join(',');
  const ds = W.doors.filter((d) => d.ref?.kind === 'house' && d.ref.floors >= 1 && /* 第 10 批：房子最多 2 層；第 18 批：1 層 */  X.interiorFor(d.ref) && !H.inside(cols, out(d).x, 1, out(d).z, R + 0.1)).sort((a, b) => Math.hypot(a.ax - t0.x, a.az - t0.z) - Math.hypot(b.ax - t0.x, b.az - t0.z));
  const d = ds[0]; if (!d) return { n: 0 };
  window.__hb = d.ref; window.__hback = { x: t0.x, z: t0.z, heading: t0.heading };
  const dist0 = W.cameraDist, r = H.toDoor(d), info = X.interiorFor(d.ref);
  return { n: ds.length, doors: all.length, open, shut, dealer: all.some((b) => b.kind === 'dealer'), ...r, name: info.name, floors: info.floors, warm: X.HOUSE_WARM, dist0 };
});
const hw0 = await doorDone();
const hin = await p.evaluate(() => { const H = window.__H, X = window.__IN(), I = X.indoor?.I, q = H.inInfo(); return { ...q, at: I ? +Math.hypot(q.x - I.spawn.x, q.z - I.spawn.z).toFixed(3) : null, kids: X.indoor?.scene.children.length }; });
console.log('  into a house:', JSON.stringify(hdoor), 'fade frames', hw0 * 2, '→', JSON.stringify(hin));
check(hdoor.n > 0 && hdoor.fade && hin.in && hin.name === hdoor.name && hin.floors === hdoor.floors && hin.mode === 'walk' && !hin.paused && hin.hud && hin.at < 0.05 && hin.mine && hin.doors && !hin.fadeShown && hin.toast === hin.name && hin.mov === 0 && hin.meFar,
  `walked into a house door (pushed ${hdoor.s} s): screen goes black → inside 「${hin.name}」 (${hin.floors} floors) just inside the door, walking HUD back, its own scene (you + the house: ${hin.kids} objects), its exits are the doors now, the traffic and people outside don't count here; built in ${hin.info?.ms} ms`);
check(hdoor.open >= 80 && hdoor.open === hdoor.doors - 2 && hdoor.shut === 'gunshop,police' && !hdoor.dealer && hdoor.warm && hdoor.warm.compile >= 0, `every village door opens into a house/shop/store/temple/farmhouse (${hdoor.open} of ${hdoor.doors}; still shut: ${hdoor.shut}; the dealer's auto door is open, not a door); warmed up on the loading screen (${JSON.stringify(hdoor.warm)} ms)`);
await drawAndShot('6b-house-inside');
const hr0 = await p.evaluate(() => window.__rinfo());
check(hr0.calls < 40, `inside only the house and you are drawn (${hr0.calls} draw calls, ${hr0.tris} triangles; the village is ~150)`);
// 走來走去（每一間的中間出發，隨便走、隨便轉鏡頭）：不會卡進牆、家具；鏡頭不會在牆裡面、天花板上面、房子外面（出口先關掉：不要走一走就上樓）
const hwalk = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, I = window.__IN().indoor.I; let seed = 11; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const B = I.bounds, inB = (x, z, m) => { const dx = x - B.x, dz = z - B.z, c = Math.cos(B.rot), s = Math.sin(B.rot); return Math.abs(dx * c - dz * s) <= B.hx + m && Math.abs(dx * s + dz * c) <= B.hz + m; };
  W.setDoors(null);
  const bad = []; let frames = 0, camTop = 0, dmax = 0;
  for (const room of I.rooms) {
    W.teleport({ x: room.probe.x, z: room.probe.z, heading: r() * 6.28 }); H.step(3);
    let a = r() * 6.28;
    for (let i = 0; i < 150; i++) {
      if (i % 50 === 0) { a = r() * 6.28; if (r() < 0.4) W.setCamera({ yaw: r() * 6.28, pitch: -0.2 + r() * 1.1 }); }
      const t = W.telemetry(), rel = a - t.camYaw, m = 0.5 + r() * 0.5; W.setInput({ x: -Math.sin(rel) * m, y: Math.cos(rel) * m, run: i % 75 > 50 });
      H.step(1); frames++;
      const q = D.dcam.position, b = H.checkFrame(I.colliders);
      if (q.y > I.camera.ceiling + 0.02) b.push(`camera above the ceiling (${q.y.toFixed(2)} > ${I.camera.ceiling})`);
      if (!inB(q.x, q.z, 0.05)) b.push('camera outside the house');
      if (!inB(W.telemetry().x, W.telemetry().z, 0)) b.push('walked out of the house');
      camTop = Math.max(camTop, q.y); dmax = Math.max(dmax, W.telemetry().camDist);
      if (b.length && bad.length < 6) bad.push(`${room.name} f${i}: ${b.join('; ')}`);
    }
  }
  W.setInput(null); W.setCamera({ hold: 0 }); W.setDoors(I.exits.map((e) => e.door));
  return { frames, rooms: I.rooms.map((q) => q.name).join(','), bad, camTop: +camTop.toFixed(2), ceiling: I.camera.ceiling, dmax: +dmax.toFixed(2), maxDist: I.camera.maxDist };
});
check(!hwalk.bad.length && hwalk.dmax <= hwalk.maxDist + 0.01, `random walking in every room downstairs (${hwalk.rooms}; ${hwalk.frames} frames, random camera): never inside a wall or furniture, camera never in a wall, above the ceiling (highest ${hwalk.camTop} m, ceiling ${hwalk.ceiling}) or outside the house, camera at most ${hwalk.dmax} m away (room fits ${hwalk.maxDist})${hwalk.bad.length ? ' — ' + hwalk.bad.join(' | ') : ''}`);
// 第 18 批（Nick 2026-10-14「對 把房子變矮」）：透天厝只剩 1 層：沒有樓梯（出口只有大門），名字寫一樓
const h1 = await p.evaluate(() => { const I = window.__IN().indoor.I, V = window.__D().VIL, hs = V.buildings.filter((b) => b.kind === 'house' || (b.kind === 'shop' && b.front));
  return { floors: I.floors.length, exits: I.exits.map((e) => e.to), name: I.name, maxFl: Math.max(...hs.map((b) => b.floors)), maxH: Math.max(...hs.map((b) => b.h)), n: hs.length }; });
console.log('  one floor:', JSON.stringify(h1));
check(h1.floors === 1 && h1.exits.length && h1.exits.every((t) => t === 'outside') && /一樓/.test(h1.name) && h1.maxFl === 1 && h1.maxH <= 3.31, `houses are one floor now: inside 「${h1.name}」 there are no stairs (exits: ${h1.exits}); every village house/shop row is 1 floor (${h1.n} buildings, highest ${h1.maxH} m)`);
// 第 18 批（Nick 2026-10-14「把一些房子弄掉然後在那邊弄一個平面大停車場」）：x −339.75…−305.25、z −66.75…−6.75 整塊是路面，沒有房子；裡面只有 5 支路燈擋路
//   （四邊 1 公尺內是路邊本來就有的電線桿、路牌、紅綠燈：以前站在騎樓前面，不算）
const pk = await p.evaluate(() => { const V = window.__D().VIL, P = V.parking; if (!P) return null; const inP = (x, z, m = 0) => Math.abs(x - P.x) < P.hx - m && Math.abs(z - P.z) < P.hz - m;
  let grass = 0, n = 0; for (let x = P.x - P.hx + 0.5; x < P.x + P.hx; x += 1.5) for (let z = P.z - P.hz + 0.5; z < P.z + P.hz; z += 1.5) { n++; if (V.surfaceAt(x, z) === 1 || V.surfaceAt(x, z) === 2) grass++; }
  const cols = V.colliders.filter((c) => c.off !== true && inP(c.x, c.z, 1)), lamps = cols.filter((c) => c.t === 'circle' && c.h > 6);
  return { ...P, grass, n, cols: cols.length, lamps: lamps.length, other: cols.filter((c) => !lamps.includes(c)).map((c) => `${c.t}@${c.x.toFixed(1)},${c.z.toFixed(1)}`), houses: V.buildings.filter((b) => inP(b.x, b.z)).length }; });
console.log('  parking lot:', JSON.stringify(pk));
check(pk && pk.stalls === 72 && pk.hx * 2 > 34 && pk.hz * 2 >= 60 && pk.grass === 0 && pk.houses === 0 && pk.lamps === 5 && pk.cols === 5, `big flat parking lot (${pk && (pk.hx * 2).toFixed(1)} × ${pk && pk.hz * 2} m, ${pk?.stalls} stalls): all paved (${pk?.n} points, ${pk?.grass} grass), no houses, only its ${pk?.lamps} lamps in the way ${pk?.other?.length ? JSON.stringify(pk.other) : ''}`);
// 走出大門：回到外面門口（面朝外），村子的碰撞、門回來，你搬回村子的場景
const hex = await p.evaluate(() => { const I = window.__IN().indoor.I, e = I.exits.find((x) => x.to === 'outside'); return e ? window.__H.toExit(e) : { none: true }; });
await doorDone();
const hoff = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, X = window.__IN(), b = window.__hb, o = X.interiorFor(b).outside, t = W.telemetry(), q = H.inInfo();
  const vd = W.doors.length > 50 && W.doors.every((d) => d.ref && d.ref.door === d.ref.door && d.ref.kind);
  const wall = H.wallHolds(b); W.teleport(window.__hback); H.step(10);
  return { ...q, at: +Math.hypot(t.x - o.x, t.z - o.z).toFixed(3), dh: +Math.abs(H.wrapA(t.heading - o.heading)).toFixed(3), vd, wall, dist: W.cameraDist };
});
console.log('  out again:', JSON.stringify(hex), JSON.stringify(hoff));
check(hex.fade && !hoff.in && hoff.mode === 'walk' && hoff.at < 0.05 && hoff.dh < 0.01 && hoff.mine && hoff.vd && hoff.wall.inside === false && hoff.dist === hdoor.dist0 && hin.dist <= hin.cam.maxDist + 1e-6,
  `walked out of the front door: black fade → outside the door facing the street, back in the village scene, village doors and walls back (pushing into the house wall stops you: moved ${hoff.wall.moved} m), camera distance back to ${hoff.dist} m (${hin.dist?.toFixed(2)} m inside: the room fits ${hin.cam?.maxDist?.toFixed(2)})`);
// 警察局（第 3 批 b3-int 開門了）：推門 → 黑掉 → 警察局裡面（跟透天厝一樣；拘留室在後面，開著）→ 從門口走出去 → 外面警察局門口
const pol = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, t0 = W.telemetry(), d = W.doors.find((q) => q.ref?.kind === 'police'); if (!d) return { none: true };
  const nx = -Math.sin(d.ry), nz = -Math.cos(d.ry), dir = Math.atan2(-nz, nx); window.__pt0 = { x: t0.x, z: t0.z, heading: t0.heading };
  W.teleport({ x: d.ax - nx * 2, z: d.az - nz * 2, heading: dir }); H.step(20);
  let fade = false; for (let n = 0; n < 240 && !fade; n++) { const t = W.telemetry(), a = dir - t.camYaw; W.setInput({ x: -Math.sin(a) * 0.7, y: Math.cos(a) * 0.7 }); H.step(1); fade = !!window.__IN().doorFade; }
  W.setInput(null); return { fade };
});
await doorDone();
const polIn = await p.evaluate(() => {
  const I = window.__IN().indoor, W = window.__D().walker, e = I && (I.exits || I.I.exits || []).find((x) => x.to === 'outside');
  const a = { kind: I?.kind, jail: !!I?.jail, mine: W.character.group.parent === I?.scene, mode: W.mode, exits: (I?.exits || []).length, doors: W.doors.length, toast: document.querySelector('#stage .wk-toast')?.textContent };
  a.exit = e ? window.__H.toExit(e) : null; return a;
});
await doorDone();
const polOut = await p.evaluate(() => {
  const D = window.__D(), W = D.walker, t = W.telemetry(), door = D.VIL.places.police.door, a = { in: !!window.__IN().indoor, mode: W.mode, mine: W.character.group.parent === D.TR.scene, atDoor: +Math.hypot(t.x - door.x, t.z - door.z).toFixed(2) };
  W.teleport(window.__pt0); window.__H.step(10); return a;
});
console.log('  police station:', JSON.stringify(pol), JSON.stringify(polIn), JSON.stringify(polOut));
check(pol.fade && polIn.kind === 'police' && !polIn.jail && polIn.mine && polIn.mode === 'walk' && polIn.doors >= 1 && polIn.exit?.fade && !polOut.in && polOut.mode === 'walk' && polOut.mine && polOut.atDoor < 2.5,
  `the police station (batch 3) is open now: walked in (black fade → inside, 「${polIn.toast}」), walked back out at its door (${polOut.atDoor} m)`);
// 阿財車行的展示間：自動門開著，走得進去（玻璃別的地方擋人）
const shw = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, t0 = W.telemetry();
  W.teleport({ x: -437.4, z: -21.5, heading: Math.PI / 2 }); H.step(10);
  const a = H.push(Math.PI / 2, 6, 0.8), fa = !!window.__IN().doorFade;
  W.teleport({ x: -445, z: -21.5, heading: Math.PI / 2 }); H.step(10);
  const g = H.push(Math.PI / 2, 3, 0.8);
  W.teleport({ x: t0.x, z: t0.z, heading: t0.heading }); H.step(10);
  return { inZ: +a.z.toFixed(2), fade: fa, glassZ: +g.z.toFixed(2) };
});
check(shw.inZ < -28 && !shw.fade && shw.glassZ > -26 + 0.2, `the dealer's showroom: walked in through the open auto door (to z ${shw.inZ}; no fade, it is part of the village), the glass next to it stops you (z ${shw.glassZ})`);
const back = await p.evaluate(() => { const D = window.__D(), H = window.__H, a = H.gw(14.5, 0.5), r = H.walkPath([[-290, -72.5], [-345, -72], [a.x, -72], [a.x, a.z]], { m: 1, run: true }); const act = H.actText(); const pressed = H.press(); H.step(170); return { ok: r.ok, act, pressed, door: D.GAR.door.t }; });
check(back.ok && back.act === '開鐵捲門' && back.door === 1, `walked back: 「${back.act}」 outside opens the door again (door ${back.door})`);
// 走回 GC8 上車：同一台接著開（walk.js 接回開車；不是重新做一個）
const again = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, r = H.walkLocal([[4, -2.2], [-0.6, -2.3]]), act = H.actText(), pressed = H.press(), b = H.board(); H.step(30);
  const t = D.drv.telemetry(), sp = D.VIL.places.garage.spawn;
  return { ok: r.ok, act, pressed, modes: b.modes, same: D.drv === window.__drv0, paused: t.paused, at: Math.hypot(t.x - sp.x, t.z - sp.z), voice: !!window.__D().dvoice?.alive, hidden: D.walker.telemetry().hidden, act2: H.act2(), act1: H.actText() };
});
console.log('  上車 again:', JSON.stringify(again));
check(again.ok && again.act === '上車 · GC8' && again.modes.join('>') === 'in>seat>off' && again.same && !again.paused && again.at < 1e-6 && again.voice && again.hidden && again.act2 === '下車' && again.act1 == null, 'walked back to GC8 and got in: the same car carries on from where it was parked (engine back on); door open → only 下車 shows');
// 開著的時候沒有「下車」，停住才有
const mv = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, d = D.drv; d.setInput({ throttle: 0.5, brake: 0, steer: 0 }); window.__dstep(45);
  const moving = { v: +d.telemetry().v.toFixed(2), act2: H.act2() };
  for (let n = 0; n < 300 && Math.abs(d.telemetry().v) > 0.4; n++) { d.setInput({ throttle: 0, brake: 1, steer: 0 }); window.__dstep(1); }
  d.setInput(null); window.__dstep(30);
  return { moving, stopped: { v: +d.telemetry().v.toFixed(2), act2: H.act2() } };
});
check(Math.abs(mv.moving.v) > 1 && mv.moving.act2 == null && Math.abs(mv.stopped.v) < 1 && mv.stopped.act2 === '下車', `下車 only when stopped (${JSON.stringify(mv)})`);
const kn = await p.evaluate(() => {
  const N = window.__N(), D = window.__D(), f = N.focus, h0 = N.hits;
  const q = N.peds.people.filter((o) => !o.gone && o.mode === 'walk').sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z))[0]; if (!q) return null;
  q.freeze = 3; // 嚇呆了（不會跳開）
  const fx = Math.cos(q.heading), fz = -Math.sin(q.heading), car = { id: 'test', x: q.x + fx * (2.2 + q.r + 0.4), z: q.z + fz * (2.2 + q.r + 0.4), heading: q.heading + Math.PI, v: 9, hx: 2.2, hz: 0.9, ai: false };
  for (let i = 0; i < 30 && N.hits === h0; i++) { car.x -= fx * 9 / 60; car.z -= fz * 9 / 60; N.peds.update(1 / 60, f, [car], N.NONE); }
  const hitMode = q.mode; window.__dstep(3);
  const toast = [...document.querySelectorAll('#stage .dv-toast, #stage .dv [class*=toast]')].map((e) => e.textContent).join('|');
  const cars = N.traffic.cars, withDriver = cars.filter((c) => c.kind === 'car'), sc = cars.filter((c) => c.kind === 'scooter');
  return { hits: N.hits - h0, hitMode, toast, cars: cars.length, drivers: withDriver.length && withDriver.every((c) => c.lod?.driver && c.lod.driver.group.parent === c.lod.body && c.lod.driver.anim?.hands === 'wheel' && !c.lod.driver.shadow),
    riders: sc.every((c) => c.rider?.rider && c.rider.rider.anim?.hands === 'bars' && !c.rider.rider.shadow), nScoot: sc.length,
    dims: Object.fromEntries(withDriver.map((c) => [c.key, [+c.hx.toFixed(2), +c.hz.toFixed(2)]])) };
});
console.log('  hit a person:', JSON.stringify(kn));
check(kn && kn.hits === 1 && kn.hitMode === 'fall' && /撞到人/.test(kn.toast), `driving into a person (9 m/s): they fall over (${kn?.hitMode}), onHit counted once, 「${kn?.toast}」`);
await p.evaluate(() => window.__pol?.()?.clear()); // 第 3 批（b3-int）：撞到人 → 2★ 警察會來抓（test-b3.mjs 測）；這裡接著測開車去改車廠，先把星星清掉
check(kn && kn.cars > 0 && kn.drivers && kn.riders, `other people's cars have someone at the wheel (hands on the wheel), scooter riders hold the handlebars (${kn?.cars} on the road, ${kn?.nScoot} scooters)`);
check(kn && Object.keys(kn.dims).length && Object.values(kn.dims).every(([hx, hz]) => hx > 1.7 && hx < 2.6 && hz > 0.7 && hz < 1.15), `other people's cars are measured without the driver in them (half length × half width: ${JSON.stringify(kn?.dims)})`);

// ---- 3 開出去，開去改車廠：自己開進改車區停好 → 改車廠打開 ----
const shopBay = await p.evaluate(() => window.__D().VIL.places.shop.bay);
let r = await leg('shop', "!document.getElementById('shop').hidden", { act: ['開鐵捲門'], bay: shopBay }, 200, [[1.6, '8-drive-out'], [12, '9-street']]);
check(r.arrived, 'drove into the tuning shop bay and the shop opened');
const np3 = await p.evaluate(() => { const N = window.__N(); return { cars: N.traffic.cars.length, people: N.peds.people.filter((q) => !q.gone).length, spawned: N.traffic.stats.spawned, avg: +N.avg.toFixed(3), max: +N.max.toFixed(2), n: N.n, hits: N.hits, carHits: N.carHits }; });
console.log('  npc (driving to the shop):', JSON.stringify(np3));
check(np3.cars > 0 && np3.people > 0 && np3.spawned >= np3.cars, `driving through the village: ${np3.cars} other cars/scooters on the road and ${np3.people} residents about (npcStep avg ${np3.avg} ms, worst ${np3.max} ms)`);
check(r.out2 === 0, `no 下車 button while driving (${r.out2} frames)`);
let di = await driveInfo();
console.log('3', el(), 'shop:', JSON.stringify(di), '| door', await p.evaluate(() => window.__D().GAR.door.t));
check(di.paused && !di.voice && !di.drivebar && di.cls.includes('shopping') && await p.evaluate(() => { const k = window.__D().VIL.places.shop.park, t = window.__D().drv.telemetry(); return Math.hypot(t.x - k.x, t.z - k.z) < 0.05; }), 'parked on the shop bay, engine off, panel open');
check(await p.evaluate(() => window.__D().GAR.door.t === 0), 'garage door closed itself after driving away');
fi = await fsInfo();
console.log('  fullscreen (shop):', JSON.stringify(fi));
check(!fi.fs && fi.pos !== 'fixed' && fi.scrolls && (!APP || ((SITE || /\.segbar/.test(fi.chrome)) && fi.calls.endsWith(',false'))), 'shop panel open: normal scrolling layout (not fullscreen)' + (APP ? ', CaridApp.setFullscreen(false)' : ''));
await p.evaluate(() => window.scrollTo(0, 0)); await drawAndShot('10-shop');
// 撞爛拿掉了：改車廠沒有「修車」，上面的說明也不提修車
const fix = await p.evaluate(() => ({ hidden: document.getElementById('shopFixG').hidden, n: document.querySelectorAll('#shopFix button').length, head: document.querySelector('#shop .shop-head .who span')?.textContent || '' }));
console.log('  修車:', JSON.stringify(fix));
check(fix.hidden && fix.n === 0 && !/修/.test(fix.head), `shop: no 修車 group (crash damage is off); subtitle 「${fix.head}」`);
const buy = await p.evaluate(() => { const b = document.querySelector('#shopParts .part.can'), m0 = window.__G().money; b.click(); b.click(); return { m0, m1: window.__G().money, parts: [...(window.__G().parts.gc8 || [])] }; });
console.log('  bought part:', JSON.stringify(buy));
check(buy.m1 < buy.m0 && buy.parts.length === 1, 'bought an engine part in the shop');
const before = await p.evaluate(() => window.__D().drv.telemetry());
await p.evaluate(() => document.getElementById('shopGo').click());
fi = await fsInfo();
check(fullView(fi) && (!APP || fi.calls.endsWith(',false,true')), 'driving away from the shop: fullscreen again');
di = await driveInfo();
console.log('  開走:', JSON.stringify(di));
check(!di.paused && di.drivebar && di.voice && Math.abs(di.x - before.x) < 0.01 && Math.abs(di.z - before.z) < 0.01 && di.dest === 'dealer', 'leave the shop from where the car stands (no teleport), next stop the car dealer');
check(await p.evaluate(() => window.__D().drv.telemetry().paused === false && window.__D().bayLock.shop === true), 'shop bay locked until the car drives out');
check(await p.evaluate(() => !window.__D().tripS?.dmg && !Object.keys(window.__G().dmg || {}).length), 'no crash damage attached to GC8 and nothing in the save');

// ---- 4 開去車店：開進買車區 → 車店打開，展示還沒買的車 ----
const dealerBay = await p.evaluate(() => window.__D().VIL.places.dealer.bay);
r = await leg('dealer', "!document.getElementById('dealer').hidden", { bay: dealerBay }, 200, [[3, '11-shop-exit']]);
check(r.arrived, 'drove into the dealer bay and the dealer opened');
const dealer = await p.evaluate(() => ({ list: [...document.querySelectorAll('#dealerCars .part')].map((x) => x.querySelector('b').textContent + (x.classList.contains('sel') ? '*' : '') + ':' + x.className.replace('part ', '')),
  buy: document.getElementById('dealerBuyHead').textContent, msg: document.getElementById('dealerMsg').textContent, name: document.getElementById('dealerName').textContent, cash: document.getElementById('dealerCash').textContent }));
console.log('4', el(), 'dealer:', JSON.stringify(dealer), '| lods', JSON.stringify(await lodAt()));
// 2026-10-17：多了 10 台新車（一般的車 17 台）→ 車行擺所有還沒買的（便宜的在前面），先選買得起最便宜的那台；轉盤 6 個（多的按到才換一批）
const dWant = await p.evaluate(() => { const D = window.__D(), G = window.__G(), sale = Object.keys(D.CARS).filter((k) => !G.owned.has(k) && !D.PERF[k].offroad).sort((a, b) => D.PERF[a].price - D.PERF[b].price);
  return { n: sale.length, names: sale.map((k) => D.CARS[k].btn[0]), sel: D.CARS[sale.find((k) => G.money >= D.PERF[k].price)].btn[0] }; });
check(dealer.list.length === dWant.n && dWant.n >= 15 && dealer.list.map((x) => x.split(/[*:]/)[0]).join() === dWant.names.join() && dealer.list.some((x) => x.startsWith(dWant.sel + '*')) && dealer.buy.includes(dWant.sel), `dealer lists the ${dWant.n} unowned cars cheapest first, ${dWant.sel} (cheapest affordable) selected`);
await p.waitForFunction(() => Object.entries(window.__D().LODS).filter(([k, L]) => L.lod?.car.parent === window.__D().VIL.group).length === 6, null, { timeout: 180000 });
await p.evaluate(() => window.scrollTo(0, 0)); await drawAndShot('12-dealer');
await p.evaluate(() => [...document.querySelectorAll('#dealerCars .part')].find((x) => /JESKO/.test(x.textContent)).click());
await p.waitForTimeout(1500);
const jesko = await p.evaluate(() => ({ buy: document.getElementById('dealerBuyHead').textContent, dis: document.getElementById('dealerBuy').disabled }));
check(/還差/.test(jesko.buy) && jesko.dis, `too expensive car cannot be bought (${JSON.stringify(jesko)})`);
await p.evaluate(() => [...document.querySelectorAll('#dealerCars .part')].find((x) => /SUPRA/.test(x.textContent)).click());
await p.waitForTimeout(1200);
const m0 = await p.evaluate(() => window.__G().money);
await p.evaluate(() => { const b = document.getElementById('dealerBuy'); b.click(); b.click(); });
await p.waitForFunction(() => window.__D().cur === 'supra' && window.__D().drv && !window.__D().drv.telemetry().paused, null, { timeout: 300000 });
await p.waitForFunction(() => window.__D().LODS.gc8?.lod?.car.parent?.name === 'towerBay2', null, { timeout: 120000 });
di = await driveInfo();
const sw = await p.evaluate(() => { const D = window.__D(), H = window.__H, ex = D.VIL.places.dealer.exit, t = D.drv.telemetry(), b1 = H.gw(D.TOWER_BAYS[1].x, D.TOWER_BAYS[1].z), g = D.tripPose.gc8;
  return { money: window.__G().money, owned: [...window.__G().owned], atExit: Math.hypot(t.x - ex.x, t.z - ex.z) < 0.05, tripIsS: D.tripS === window.__S(), built: Object.keys(D.built), gc8Bay: g.tw === 1 ? Math.hypot(g.x - b1.x, g.z - b1.z) : 99, tripFull: D.tripFull, on: D.LODS.gc8.lod.car.parent?.name }; });
console.log('  bought:', JSON.stringify(sw), JSON.stringify(di), '| lods', JSON.stringify(await lodAt()));
check(sw.money === m0 - 200 && sw.owned.includes('supra') && sw.atExit && sw.tripIsS && di.cur === 'supra' && di.dest === 'garage' && di.voice && !di.paused && sw.tripFull === 'supra', 'bought SUPRA: new car waits at the dealer exit, destination home');
const la4 = await lodAt();
check(la4.gc8 === 'town-garage' && la4.yaris === 'town-garage' && sw.gc8Bay < 1e-6 && sw.on === 'towerBay2' && !String(la4.supra).startsWith('town'), 'old GC8 went to the first free spot in the tower (2 樓 2 號, next to YARIS); SUPRA left the showroom');
await p.waitForFunction(() => /車行幫你送回車庫了/.test(document.querySelector('#stage .dv-toast')?.textContent || ''), null, { timeout: 15000 });
const dl = await p.evaluate(() => ({ toast: document.querySelector('#stage .dv-toast').textContent, deck: window.__D().TWR[1], park: window.__G().park?.tower[1] }));
check(/GC8 車行幫你送回車庫了：停在 2 樓 2 號/.test(dl.toast) && dl.deck === 'gc8' && dl.park === 'gc8', `after the purchase a note says where the old car went: 「${dl.toast}」 (saved)`);
// 車行的自動門開著（人走得進去）：車子開不進展示間（門口有一片只給開車的碰撞）；慢慢頂上去，不會撞凹
const ddoor = await p.evaluate(() => {
  const D = window.__D(), d = D.drv, ci = d.carInfo, ex = D.VIL.places.dealer.exit, h0 = D.tripS?.dmg?.health ?? 1;
  d.teleport({ x: -437.4, z: -26.3 + 0.6 + ci.nose, heading: Math.PI / 2 }); window.__dstep(5);
  let vmax = 0; for (let i = 0; i < 240; i++) { d.setInput({ throttle: 0.18, brake: 0, steer: 0 }); window.__dstep(1); vmax = Math.max(vmax, Math.abs(d.telemetry().v)); }
  const t = d.telemetry(), nose = t.z - Math.sin(t.heading) * ci.nose;
  d.setInput(null); d.teleport(ex); window.__dstep(5);
  return { nose: +nose.toFixed(2), vmax: +vmax.toFixed(2), h0, h1: D.tripS?.dmg?.health ?? 1, back: Math.hypot(d.telemetry().x - ex.x, d.telemetry().z - ex.z) < 0.05 };
});
check(ddoor.nose > -26.05 && ddoor.h1 === ddoor.h0 && ddoor.back, `a car can't drive into the showroom through the open auto door (nose stops at z ${ddoor.nose}; the door line is z −25.95…−26.3; crept at ${ddoor.vmax} m/s, no dent)`);
await p.evaluate(() => window.__dstep(2)); await drawAndShot('13-new-car'); // 頁面的開車停住了：先走兩格，HUD（目的地、小地圖、下車）才是現在的樣子

// ---- 5 快速道路：開到極速 ----
r = await leg('highway', "window.__pp.inBox(window.__D().VIL.places.highway.zone, window.__D().drv.telemetry().x, window.__D().drv.telemetry().z)", { stopEnd: false }, 200);
check(r.arrived, 'reached the highway');
await p.evaluate(() => window.__npcPause(true)); // 極速：機器人不會超車，路上的車先拿掉（測完放回來）
await p.evaluate(() => { window.__cruiseShotAt = 200; }); // 開到 200 截圖（一圈 2.5 km：直路 450 公尺，機器人開不到 250）
let cr = await p.evaluate(() => window.__pp.cruise(60 * 90));
if (cr.pause) { await drawAndShot('14-highway'); cr = await p.evaluate(() => window.__pp.cruise(60 * 60)); }
console.log('5', el(), 'highway cruise:', JSON.stringify(cr));
await p.evaluate(() => window.__npcPause(false));
check(cr.max >= 230, `SUPRA gets fast on the highway (${cr.max?.toFixed?.(0)} km/h; 2.5 km loop, 450 m straights: the test bot tops out ≈240, the old 4.7 km loop reached ≈300)`); // Nick：「高速公路太長了」→ 一圈改成 2.5 km，機器人（彎道 8 m/s²）開不到 270 了

// ---- 6 賽道：開進起跑區（慢）自己停到起跑線，比一場，開回村子 ----
r = await leg('track', 'window.__R() !== null', {}, 250);
await p.waitForFunction(() => window.__R() && window.__R().phase === 'idle' && document.getElementById('status').hidden, null, { timeout: 300000 });
check(await p.evaluate(() => !window.__D().on && document.body.className.includes('racing')), 'handed over to the race at the start line');
check(await p.evaluate(() => window.__N().g.visible === false), 'racing: the village traffic and residents are hidden (and stand still)');
await p.evaluate(() => {
  window.__fast = true; window.__fn = 0;
  const press = (id) => document.getElementById(id).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  const tick = () => { const r = window.__R(); if (r && r.phase === 'run' && r.me.fin == null) { const c = r.me; if (c.go == null) { if (r.t - r.green > 0.25) press('goBtn'); } else if (c.rpm >= 0.93 && c.shiftT <= 0 && c.gear < 5) press('goBtn'); if (c.go != null && !c.nitroUsed && r.t - c.go > 1.5) press('nitroBtn'); } if (window.__R()) requestAnimationFrame(tick); };
  tick();
});
fi = await fsInfo(); clash = await hudClash();
console.log('  fullscreen (race, before the start):', JSON.stringify(fi), '| clash:', clash || '-');
check(fullView(fi) && fi.race && Math.abs(fi.race[1] + fi.race[3] - fi.vh) <= 1 && fi.race[1] > fi.vh * 0.3 && !fi.pedals && !fi.gauge && !clash, `race: fullscreen, 開始比賽／選對手 in a sheet over the bottom of the screen (${clash || 'no overlap'})`);
clash = await sizeSweep();
await p.evaluate(() => document.body.classList.add('race-live')); // 跑的時候的版面
const clashLive = await sizeSweep();
await p.evaluate(() => document.body.classList.remove('race-live'));
check(!clash && !clashLive, `race fullscreen on other screens, before the start and while running: none overlapping (${[clash, clashLive].filter(Boolean).join(' / ') || 'ok'})`);
await p.evaluate(() => document.getElementById('raceGo').click());
await p.waitForFunction(() => { const r = window.__R(); return r && r.phase === 'run'; }, null, { timeout: 300000 });
fi = await fsInfo(); clash = await hudClash();
console.log('  fullscreen (race running):', JSON.stringify(fi), '| clash:', clash || '-');
check(fullView(fi) && fi.live && !fi.race && fi.pedals && fi.gauge && !clash, `race running: the sheet is out of the way, gauge and 起步／換檔／氮氣 visible, nothing overlapping (${clash || 'ok'})`);
await p.waitForFunction(() => { const r = window.__R(); return r && r.phase === 'done'; }, null, { timeout: 900000 });
await p.evaluate(() => { window.__fast = false; }); await p.waitForTimeout(1000);
console.log('6', el(), 'race:', await txt('#result'));
await p.waitForFunction(() => !document.body.classList.contains('race-live'), null, { timeout: 60000 });
fi = await fsInfo();
check(fullView(fi) && fi.race && await shown('#result'), 'race done: the result comes back up in the sheet');
await p.evaluate(() => document.getElementById('raceBack').click());
di = await driveInfo();
console.log('  back to village:', JSON.stringify(di));
check(fullView(await fsInfo()), 'back in the village: still fullscreen');
check(di.on && di.cls.includes('driving') && !di.cls.includes('racing') && di.voice && !di.paused && di.carParent === 'town' && di.walk === 'off', 'driving again after the race');
check(await p.evaluate(() => window.__N().g.visible === true), 'back in the village: traffic and residents are back');

// ---- 7 開回家：開鐵捲門 → 開進去 → 開上電梯 → 3F → 轉 ▶ → 開進格子 → 下車（自己開正）→ 走回電梯 2F → 走去開 YARIS（輕量車換成完整的車）→ 倒車回電梯 ◀ 1F（自己轉回車頭朝門）→ 直接回車庫（停的地方都記著）----
await p.evaluate(() => { document.querySelector('#dests button[data-d="garage"]').click(); });
r = await leg('garage', "(() => { const D = window.__D(), t = D.drv.telemetry(); return window.__pp.inBox(D.VIL.places.garage.inside, t.x, t.z) && Math.abs(t.v) < 0.3; })()", { act: ['開鐵捲門'] }, 250); // 你家在車庫街 1 號（圓塔）：開到門前、開鐵捲門、開進去
check(r.arrived && r.acts.includes('開鐵捲門'), 'came home: drove down the garage street, opened the roller door from the car and drove into the garage');
const park = await p.evaluate(() => { const D = window.__D(), H = window.__H; D.drv.setInput(null); window.__dstep(40); const t = D.drv.telemetry(), q = H.gl(t.x, t.z); return { act: H.actText(), act2: H.act2(), v: +t.v.toFixed(3), local: [+q.x.toFixed(2), +q.z.toFixed(2)], paused: t.paused }; });
console.log('7', el(), 'home:', JSON.stringify(park));
check(park.act2 === '下車' && park.act == null && !park.paused && Math.abs(park.v) < 1, 'stopped inside the garage: only 下車 (no 停好熄火, no turntable spin)');
await drawAndShot('15-home-parked');
// 開上電梯的圓台（差一點點、歪一點點）→ 面板（一樓：1F 亮著、每層寫還有幾格空的）→ 按 3F：先開到正中間，電梯連車帶鏡頭一起上去，自己轉到最近的空格子
const pn7 = await p.evaluate(() => { const D = window.__D(), H = window.__H; D.drv.teleport(H.gw(-0.4, 0.3, 0.06)); window.__dstep(30); return { panel: H.elPanel(), who: window.__D().elWho(), act: H.actText(), act2: H.act2() }; });
console.log('  on the lift:', JSON.stringify(pn7));
check(pn7.panel.shown && pn7.panel.btns.join() === '4F 空 8,5F 空 8,6F 空 8,1F,2F 空 6,3F 空 8' && pn7.panel.on === '1F' && !pn7.panel.row && pn7.who === 1 && pn7.act2 === '下車',
  `driving onto the round lift shows the elevator panel: 3×2 floor buttons, 1F lit, free spots per floor (2F has YARIS and GC8: 空 6); no ◀ ▶ downstairs (${pn7.panel.btns?.join(' / ')})`);
clash = await hudClash(); const clashEl = await sizeSweep(true, ['.elpanel']);
check(!clash && !clashEl, `elevator panel in the car (fullscreen): nothing overlapping, on every screen size (${[clash, clashEl].filter(Boolean).join(' / ') || 'ok'})`);
await drawAndShot('16-lift-panel');
const up7 = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, G = D.GAR, pressed = H.elClick('3F');
  let n = 0; for (; n < 300 && !window.__D().EL.ride; n++) H.step(1);
  const t0 = window.__D().drv.telemetry(), q0 = H.gl(t0.x, t0.z); H.step(30);
  const R = window.__D().EL.ride, mid = { busy: G.lift.busy, y: +G.lift.y.toFixed(2), car: D.tripS.car.parent === G.platform, cam: window.__D().dcam.parent === G.platform, panel: H.elPanel().shown, snd: !!window.__D().liftSnd.tower, act2: H.act2(), toast: H.toast() };
  const w = H.elWait(); const D2 = window.__D(), t = D2.drv.telemetry(), q = H.gl(t.x, t.z), c = D2.tripS.car; c.updateMatrixWorld(true);
  const h = H.wrapA(t.heading - D2.VIL.places.garage.lot.heading), bay = D2.TOWER_BAYS.find((b) => b.f === 2 && Math.abs(H.wrapA(b.heading - h)) < 1e-3);
  return { pressed, center: +Math.hypot(q0.x, q0.z).toFixed(3), mid, s: w.s, floor: G.floor, lift: { ...G.lift }, q: [+q.x.toFixed(3), +q.z.toFixed(3)], h: +h.toFixed(4), bay: bay?.id ?? null, free: bay ? !D2.TWR[bay.id] : null,
    y: +c.matrixWorld.elements[13].toFixed(3), fy: D2.towerFy(2), carScene: c.parent === D2.TR.scene, cam: D2.dcam.parent === D2.TR.scene || !D2.dcam.parent, paused: t.paused, snd: !!D2.liftSnd.tower, toast: H.toast(), panel: H.elPanel(), pose: D2.tripPose[D2.cur] };
});
console.log('  up to 3F:', JSON.stringify(up7));
check(up7.pressed === '3F' && up7.center < 0.05 && up7.mid.busy && up7.mid.y > 0.05 && up7.mid.car && up7.mid.cam && !up7.mid.panel && up7.mid.snd && up7.mid.act2 == null && /電梯去 3 樓/.test(up7.mid.toast),
  `3F: the car first rolls to the middle of the lift, then rides up with the camera (motor sound, panel and 下車 put away while moving: 「${up7.mid.toast}」)`);
check(up7.floor === 2 && !up7.lift.busy && Math.abs(up7.y - up7.fy) < 0.01 && up7.carScene && up7.cam && !up7.paused && !up7.snd && up7.bay != null && up7.free && up7.pose?.f === 2 && Math.hypot(...up7.q) < 0.05,
  `arrived on 3F after ${up7.s} s: the car is on the 3F floor (y ${up7.y}), turned to face a free spot (3 樓 ${up7.bay - 7} 號), drivable again, motor quiet`);
check(up7.panel.shown && up7.panel.on === '3F' && up7.panel.row && /3 樓：往前開進空的格子/.test(up7.toast), `upstairs the panel lights 3F and adds ◀ ▶ to turn to another spot (「${up7.toast}」)`);
await drawAndShot('17-lift-3f');
// ▶：電梯在這一層轉 45 度（車頭對著下一格）
const tn7 = await p.evaluate(() => { const D = window.__D(), H = window.__H, h0 = D.drv.telemetry().heading, pressed = H.elClick('▶'), w = H.elWait(), D2 = window.__D(); return { pressed, s: w.s, dh: +H.wrapA(D2.drv.telemetry().heading - h0).toFixed(4), floor: D2.GAR.floor, rot: +D2.GAR.lift.rot.toFixed(4) }; });
console.log('  ▶:', JSON.stringify(tn7));
check(tn7.pressed === '▶' && Math.abs(tn7.dh + Math.PI / 4) < 1e-3 && tn7.floor === 2, `▶ turns the lift (and the car) 45° to the right, to the next spot (${tn7.dh} rad, ${tn7.s} s)`);
// 往前開進格子（開到車頭快碰到玻璃）→ 下車：自己開正、停進格子（掛在那一格上；存檔記著）
const pk7 = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, d = D.drv; let n = 0;
  for (; n < 600; n++) { const t = d.telemetry(), q = H.gl(t.x, t.z), r = Math.hypot(q.x, q.z); d.setInput(r < 9.2 ? { throttle: 0.3 } : { brake: 1 }); window.__dstep(1); if (r >= 9.2 && Math.abs(t.v) < 0.05) break; }
  d.setInput(null); window.__dstep(10); const t1 = d.telemetry(), q1 = H.gl(t1.x, t1.z), bumps = t1.bumps;
  const pressed = H.press2(); let m = 0; for (; m < 400 && window.__D().walker.mode !== 'walk'; m++) H.step(1); H.step(10);
  const D2 = window.__D(), i = D2.TWR.indexOf('supra'), b = D2.TOWER_BAYS[i], L = D2.tripFull === 'supra' ? D2.tripS.car : D2.LODS.supra.lod?.car; // 剛開的那台：完整的車直接掛上去（換開別台才換成輕量車）
  return { r: +Math.hypot(q1.x, q1.z).toFixed(2), pressed, s: +(m / 60).toFixed(2), mode: D2.walker.mode, drv: !!D2.drv, i, f: b?.f, on: L?.parent?.name, lodVis: !!L?.visible, full: D2.tripFull === 'supra', pose: D2.tripPose.supra, toast: H.toast(), saved: window.__G().park?.tower?.[i], cars: D2.walker.cars.map((c) => c.key), wy: +D2.walker.character.group.position.y.toFixed(2), voice: !!D2.dvoice };
});
console.log('  parked in a spot:', JSON.stringify(pk7), '| lods', JSON.stringify(await lodAt()));
check(pk7.r > 8 && pk7.pressed === '下車' && pk7.mode === 'walk' && !pk7.drv && !pk7.voice && pk7.f === 2 && pk7.on === `towerBay${pk7.i + 1}` && pk7.lodVis && pk7.pose?.tw === pk7.i && pk7.saved === 'supra' && pk7.cars.includes('supra') && Math.abs(pk7.wy - 7.7) < 0.05
  && new RegExp(`SUPRA 停好了：3 樓 ${pk7.i - 7} 號`).test(pk7.toast), `drove into the spot and pressed 下車: SUPRA straightened itself into 3 樓 ${pk7.i - 7} 號 (${pk7.s} s; 「${pk7.toast}」, saved), you stand on 3F, it can still be boarded`);
await drawAndShot('18-parked-3f');
// 走回電梯（站上圓台：面板出來）→ 按 2F → 人坐電梯下去
const wb7 = await p.evaluate(() => { const D = window.__D(), H = window.__H, r = H.walkLocal([[4.5, 0], [0.4, 0.4]]); const panel = H.elPanel(), who = window.__D().elWho(); const pressed = H.elClick('2F'), w = H.elWait(), D2 = window.__D();
  return { ok: r.ok, panel, who, pressed, s: w.s, floor: D2.GAR.floor, mode: D2.walker.mode, wy: +D2.walker.character.group.position.y.toFixed(2), cars: D2.walker.cars.map((c) => c.key), toast: H.toast() }; });
console.log('  walked onto the lift → 2F:', JSON.stringify(wb7));
check(wb7.ok && wb7.who === 3 && wb7.panel.shown && wb7.panel.on === '3F' && !wb7.panel.row && wb7.pressed === '2F' && wb7.floor === 1 && wb7.mode === 'walk' && Math.abs(wb7.wy - 4.5) < 0.05 && wb7.cars.includes('yaris') && wb7.cars.includes('gc8') && !wb7.cars.includes('supra'),
  `walked back onto the lift: the panel comes up on foot too (no ◀ ▶); 2F takes you down to 2F, where YARIS and GC8 are parked (${wb7.s} s)`);
await drawAndShot('19-walk-2f');
// 走去 YARIS（2 樓 1 號：車頭朝外，駕駛座在 −z 那邊）→ 上車：完整的 YARIS；SUPRA 照樣停在 3 樓
const toY = await p.evaluate(() => { const D = window.__D(), H = window.__H, y = D.TOWER_BAYS[0], r = H.walkLocal([[3.6, -2.2], [y.x, y.z - 2.0]]); return { ok: r.ok, act: H.actText(), at: r }; });
check(toY.ok && toY.act === '上車 · YARIS', `walked over to YARIS in 2 樓 1 號: 「${toY.act}」 ${toY.ok ? '' : JSON.stringify(toY.at)}`);
const sy = await p.evaluate(() => { const D = window.__D(), H = window.__H, pressed = H.press(), b = H.board(); const D2 = window.__D(); return { pressed, modes: b.modes, toast: document.getElementById('gtoast').textContent, boarding: !!D2.boarding, drv: !!D2.drv, tripFull: D2.tripFull }; });
console.log('  上車 YARIS:', JSON.stringify(sy));
await p.waitForFunction(() => window.__D().cur === 'yaris' && window.__D().drv && !window.__D().drv.telemetry().paused, null, { timeout: 300000 });
await p.evaluate(() => window.__H.step(40));
const yl = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, t = D.drv.telemetry(), b0 = H.gw(D.TOWER_BAYS[0].x, D.TOWER_BAYS[0].z), L = D.LODS.supra.lod.car, c = D.tripS.car; c.updateMatrixWorld(true);
  return { cur: D.cur, S: window.__S() === D.tripS, full: c.parent === D.TR.scene && c.visible, atBay: Math.hypot(t.x - b0.x, t.z - b0.z), y: +c.matrixWorld.elements[13].toFixed(2), paused: t.paused, voice: !!D.dvoice?.alive, act2: H.act2(), yarisLod: !!D.LODS.yaris.lod.car.parent,
    supraOn: L.parent?.name, twr0: D.TWR[0], oldHidden: !D.built.supra || !D.built.supra.car.visible || D.built.supra.car.parent !== D.TR.scene, toast: H.toast() };
});
console.log('  switched:', JSON.stringify(yl), '| lods', JSON.stringify(await lodAt()));
check(sy.pressed === '上車 · YARIS' && sy.modes.join('>') === 'in>seat>off' && /YARIS 發動中/.test(sy.toast) && yl.cur === 'yaris' && yl.S && yl.full && yl.atBay < 0.01 && Math.abs(yl.y - 4.5) < 0.02 && !yl.paused && yl.voice && yl.act2 === '下車' && !yl.yarisLod && yl.twr0 === null,
  'switched cars on foot upstairs: YARIS (light-weight in 2 樓 1 號) became the full car on the 2F floor; its spot is free now; engine on; 下車 available');
check(yl.supraOn?.startsWith('towerBay') && yl.oldHidden && /倒車回到電梯上，按 1F/.test(yl.toast), `SUPRA stays in its 3F spot (light-weight); a hint says how to get down: 「${yl.toast}」`);
// 倒車回到電梯上 → 1F：電梯下去，自己轉到車頭朝鐵捲門
const dn7 = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, d = D.drv; let n = 0;
  for (; n < 900; n++) { const t = d.telemetry(), q = H.gl(t.x, t.z), r = Math.hypot(q.x, q.z); d.setInput(n < 30 ? { brake: 1 } : r > 1.0 ? { brake: 0.5 } : { throttle: 1 }); window.__dstep(1); if (n > 40 && r <= 1.0 && Math.abs(t.v) < 0.05) break; }
  d.setInput(null); window.__dstep(20); const panel = H.elPanel(), h0 = D.drv.telemetry().heading, left = H.elClick('◀'); H.elWait(); const dh = +H.wrapA(window.__D().drv.telemetry().heading - h0).toFixed(4); // 先往左轉一格：下樓的時候要自己轉回來
  const pressed = H.elClick('1F'), w = H.elWait(), D2 = window.__D(), t = D2.drv.telemetry(), q = H.gl(t.x, t.z), c = D2.tripS.car; c.updateMatrixWorld(true);
  return { n, panel, left, dh, pressed, s: w.s, floor: D2.GAR.floor, h: +H.wrapA(t.heading - D2.VIL.places.garage.lot.heading).toFixed(4), q: [+q.x.toFixed(3), +q.z.toFixed(3)], y: +c.matrixWorld.elements[13].toFixed(3), act: H.actText(), act2: H.act2(), toast: H.toast(), pose: D2.tripPose.yaris };
});
console.log('  back down:', JSON.stringify(dn7));
check(dn7.panel.shown && dn7.panel.on === '2F' && dn7.panel.row && dn7.left === '◀' && Math.abs(dn7.dh - Math.PI / 4) < 1e-3 && dn7.pressed === '1F' && dn7.floor === 0 && Math.abs(dn7.h) < 1e-3 && Math.hypot(...dn7.q) < 0.05 && Math.abs(dn7.y) < 0.01 && dn7.pose?.f === 0
  && dn7.act == null && dn7.act2 === '下車' && /^1 樓$/.test(dn7.toast), `reversed onto the lift, turned it ◀ 45°, pressed 1F: down to the lobby (${dn7.s} s), turned back by itself so the nose faces the roller door (open: no 開鐵捲門 hint, 「${dn7.toast}」)`);
await drawAndShot('20-back-1f');
// 直接回車庫：回到車庫頁（現在開的 YARIS），GC8（2 樓 2 號）、SUPRA（3 樓）停在剛剛停的格子
await p.evaluate(() => document.getElementById('driveHome').click());
await p.evaluate(() => { window.__hold = false; window.__noDraw = false; }); await p.waitForTimeout(2500);
const home = await p.evaluate(() => { const S = window.__S(), c = S.car, D = window.__D(), R = window.__room(); return { cls: document.body.className, car: document.getElementById('carName').textContent, parent: c.parent === window.__scene(), pos: c.position.toArray(), rot: c.rotation.y, trip: D.trip, drv: D.drv, tripPose: D.tripPose, room: R?.group.visible, round: R?.size.round, wk: !D.walker.hud.hidden, ch: D.walker.character.group.visible,
  park: window.__G().park, gc8: D.LODS.gc8.lod.car.parent?.name, supra: D.LODS.supra.lod.car.parent?.name }; });
console.log('  home:', JSON.stringify(home), '| lods', JSON.stringify(await lodAt()));
const np7 = await p.evaluate(() => { const N = window.__N(); return { vis: N.g.visible, avg: +N.avg.toFixed(3), max: +N.max.toFixed(2), n: N.n, hits: N.hits, carHits: N.carHits, built: N.traffic.stats.built + N.peds.stats.built }; });
console.log('  npc (whole trip):', JSON.stringify(np7));
check(!np7.vis && np7.avg < 1.5, `back on the garage page: traffic and residents hidden; over the trip npcStep took ${np7.avg} ms a frame on average (worst ${np7.max} ms, ${np7.n} frames; phones ≈3–5× slower)`);
check(home.cls === '' && /Yaris/.test(home.car) && home.parent && home.pos.every((v) => v === 0) && home.rot === 0 && !home.trip && home.drv === null && home.tripPose === null && home.room && home.round && !home.wk && !home.ch, '直接回車庫: back on the garage page (the round tower) with YARIS (the car you were driving) on the turntable; walking HUD + character put away');
const la7 = await lodAt(), si7 = home.park?.tower?.indexOf('supra');
check(la7.gc8 === 'page' && la7.supra === 'page' && home.gc8 === 'towerBay2' && home.supra === `towerBay${si7 + 1}` && home.park?.mid === 'yaris' && home.park.tower.length === 40 && home.park.tower[1] === 'gc8' && home.park.tower[0] === null && home.park.tower.filter(Boolean).length === 2,
  `the page garage shows GC8 and SUPRA in the tower spots they were left in (2 樓 2 號, 3 樓 ${si7 - 7} 號; 2 樓 1 號 is empty now: YARIS is on the turntable)`);
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
await p.screenshot({ path: `${prefix}-21-home.png` }); console.log('  shot', `${prefix}-21-home.png`, el());
fi = await fsInfo();
console.log('  fullscreen (home):', JSON.stringify(fi));
check(!fi.fs && !fi.html && !fi.btn && fi.scrolls && fi.pref === 'on' && (!APP || (fi.chrome === CHROME && fi.calls.endsWith(',false'))), 'back on the garage page: normal layout restored, no fullscreen button' + (APP ? ', CaridApp.setFullscreen(false)' : ''));

// ---- 8 重新整理：新車、錢、零件都在 ----
const keep = await p.evaluate(() => ({ look: JSON.stringify(window.__G().look), money: window.__G().money, owned: [...window.__G().owned].sort().join(), cur: window.__D().cur, park: JSON.stringify(window.__G().park) }));
await p.reload({ waitUntil: 'domcontentloaded' }); await ready(); await p.waitForTimeout(1000);
const re = await p.evaluate(() => ({ look: JSON.stringify(window.__G().look), money: window.__G().money, owned: [...window.__G().owned].sort().join(), cur: window.__D().cur, parts: (window.__G().parts.gc8 || []).length, park: JSON.stringify(window.__G().park) }));
console.log('8', el(), 'reload:', JSON.stringify(keep), '→', JSON.stringify(re));
check(re.money === keep.money && re.owned === keep.owned && re.cur === 'yaris' && re.parts === 1 && re.park === keep.park && re.look === keep.look && keep.look !== 'null', 'reload keeps the new car, money, parts, the car you drove last, which tower spot each car is in and your look');

// ---- 9 再出門一次：這台停電梯的圓台上，其他的在上次停的格子；直接回車庫 ----
await p.evaluate(() => document.getElementById('driveOut').click());
await p.waitForFunction(() => window.__D().on && window.__D().walker?.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.waitForFunction(() => { const D = window.__D(); return D.LODS.gc8?.lod?.car.parent?.name === 'towerBay2' && D.LODS.supra?.lod?.car.parent?.name?.startsWith('towerBay'); }, null, { timeout: 120000 });
const t9 = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, sp = D.VIL.places.garage.spawn, bays = D.TOWER_BAYS.map((b) => H.gw(b.x, b.z)), inBay = (k) => bays.findIndex((b, i) => D.tripPose[k].tw === i && Math.hypot(b.x - D.tripPose[k].x, b.z - D.tripPose[k].z) < 1e-6);
  return { cur: D.cur, main: Math.hypot(D.tripPose.yaris.x - sp.x, D.tripPose.yaris.z - sp.z), gc8: inBay('gc8'), supra: inBay('supra'), want: window.__G().park.tower.indexOf('supra'), door: D.GAR.door.t, drv: !!D.drv, walk: D.walker.mode, floor: D.GAR.floor };
});
console.log('9', el(), 'second trip:', JSON.stringify(t9));
check(t9.cur === 'yaris' && t9.main < 1e-6 && t9.gc8 === 1 && t9.supra === t9.want && t9.supra >= 8 && t9.supra < 16 && t9.door === 0 && !t9.drv && t9.walk === 'walk' && t9.floor === 0, 'next trip starts on foot on the ground floor again: YARIS on the lift, GC8 and SUPRA in the spots they were left in (2 樓 2 號, 3 樓)');
await drawAndShot('20-second-trip');
// 走進村口超商（不是透天厝：一層、收銀台），在裡面按「直接回車庫」
const st9 = await p.evaluate(() => { const W = window.__D().walker, d = W.doors.find((q) => q.ref?.kind === 'store'); return d ? { ...window.__H.toDoor(d), name: d.ref.name } : { none: true }; });
await doorDone();
const in9 = await p.evaluate(() => window.__H.inInfo());
check(st9.fade && in9.in && in9.kind === 'store' && in9.floors === 1 && in9.mode === 'walk', `walked into the village store (${in9.name}: ${in9.floors} floor)`);
await drawAndShot('20b-store-inside');
await p.evaluate(() => document.getElementById('driveHome').click()); await p.waitForTimeout(1200);
const h9 = await p.evaluate(() => { const D = window.__D(), X = window.__IN(), W = D.walker; return { page: document.body.className === '' && !D.trip && D.GAR.door.t === 0 && W.mode === 'off', indoor: !!X.indoor, fade: !!X.doorFade, mine: W.character.group.parent === D.TR.scene, doors: W.doors.length > 50 }; });
check(h9.page && !h9.indoor && !h9.fade && h9.mine && h9.doors, `直接回車庫 from inside the store works too: back on the garage page, the store is put away (you are back in the village scene, village doors back) (${JSON.stringify(h9)})`);
// 舊版 APK（外殼沒有 setFullscreen）：頁面裡照樣全螢幕，不會出錯；之後換回新版的外殼
await p.evaluate((nm) => { window.__ca0 = window[nm]; window[nm] = { ready() {}, openMail() { return false; } }; document.getElementById('driveOut').click(); }, SHELL);
await p.waitForFunction(() => window.__D().on && window.__D().walker?.mode === 'walk', null, { timeout: 300000 });
fi = await fsInfo();
check(fullView(fi), 'older APK without CaridApp.setFullscreen: in-page fullscreen still works');
await p.evaluate((nm) => { document.getElementById('driveHome').click(); window[nm] = window.__ca0; }, SHELL); await p.waitForTimeout(1200);
check(await p.evaluate(() => document.body.className === '' && !window.__D().trip && window.__D().walker.mode === 'off'), 'older APK: 直接回車庫 back to the normal page');

// ---- 10 圓塔的電梯（第 21 批）：走路站上圓台（停在上面的車一起坐）、去 4 樓再下來；叫電梯；面板在每種螢幕都不重疊；
//      小房子（一樓）走進去（第一人稱）睡覺、換衣服；車行送車（停樓上空的格子、滿了停一樓大廳）；馬達聲；回車庫頁停的都記著 ----
await p.evaluate(() => document.getElementById('driveOut').click()); // 第三趟（YARIS 停圓台上，GC8 在 2 樓 2 號、SUPRA 在 3 樓）
await p.waitForFunction(() => window.__D().on && window.__D().walker?.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.waitForFunction(() => window.__D().walker.cars.length >= 1 && ['gc8', 'supra'].every((k) => window.__D().LODS[k]?.lod?.car.parent?.name?.startsWith('towerBay')), null, { timeout: 120000 });
await p.evaluate(() => window.__H.step(30));
// 上一趟在超商裡面按了直接回車庫：這一趟村子的牆照樣擋人、門照樣進得去（超商那棟）
const w10 = await p.evaluate(() => { const D = window.__D(), H = window.__H, W = D.walker, t0 = W.telemetry(), b = D.VIL.buildings.find((q) => q.kind === 'store'), r = H.wallHolds(b); W.teleport({ x: t0.x, z: t0.z, heading: t0.heading }); H.step(10); return { ...r, door: W.doors.some((d) => d.ref === b) }; });
check(w10.inside === false && w10.door, `next trip after leaving from inside the store: the village walls stop you again (moved ${w10.moved} m into the store wall), its door is a door again`);
// 走路站上圓台（YARIS 停在上面）：面板出來 → 4F：你跟 YARIS 一起上去
const ew = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, r = H.walkLocal([[2.4, 2.4], [1.2, 1.9]], { tol: 0.2 }); H.step(5); // YARIS 旁邊、整個人站在圓台上
  const panel = H.elPanel(), who = window.__D().elWho(), pressed = H.elClick('4F'); H.step(40);
  const R = window.__D().EL.ride, mid = { riders: R?.riders.length, me: R?.me, yaris: R?.riders.some((q) => q.o === D.tripS.car), wk: H.visible('#stage .wk-act'), act: H.actText() };
  const w = H.elWait(), D2 = window.__D(), y = D2.tripS.car; y.updateMatrixWorld(true);
  return { ok: r.ok, panel, who, pressed, mid, s: w.s, floor: D2.GAR.floor, wy: +D2.walker.character.group.position.y.toFixed(2), yy: +y.matrixWorld.elements[13].toFixed(2), yf: D2.tripPose.yaris?.f, cars: D2.walker.cars.map((c) => c.key), mode: D2.walker.mode, toast: H.toast() };
});
console.log('10', el(), 'walk onto the lift → 4F:', JSON.stringify(ew));
check(ew.ok && ew.who === 3 && ew.panel.shown && ew.panel.on === '1F' && !ew.panel.row && ew.pressed === '4F' && ew.mid.riders === 2 && ew.mid.me && ew.mid.yaris,
  'on foot on the round lift (YARIS parked on it): the panel comes up; 4F takes you AND the parked YARIS up together');
check(ew.floor === 3 && ew.mode === 'walk' && Math.abs(ew.wy - 10.9) < 0.05 && Math.abs(ew.yy - 10.9) < 0.05 && ew.yf === 3 && ew.cars.includes('yaris') && /4 樓/.test(ew.toast), `on 4F (${ew.s} s): you and YARIS stand on the 4F floor (y ${ew.wy}), YARIS still boardable there (「${ew.toast}」)`);
clash = await hudClash(); const clashWalkEl = await sizeSweep(true, ['.elpanel']);
check(!clash && !clashWalkEl, `elevator panel on foot (fullscreen): nothing overlapping, on every screen size (${[clash, clashWalkEl].filter(Boolean).join(' / ') || 'ok'})`);
await drawAndShot('22-walk-4f');
const ed = await p.evaluate(() => { const D = window.__D(), H = window.__H, pressed = H.elClick('1F'), w = H.elWait(), D2 = window.__D(), y = D2.tripS.car; y.updateMatrixWorld(true);
  return { pressed, s: w.s, floor: D2.GAR.floor, wy: +D2.walker.character.group.position.y.toFixed(2), yy: +y.matrixWorld.elements[13].toFixed(3), yf: D2.tripPose.yaris?.f, h: +H.wrapA(D2.tripPose.yaris.heading - D2.VIL.places.garage.lot.heading).toFixed(4) }; });
check(ed.pressed === '1F' && ed.floor === 0 && Math.abs(ed.wy) < 0.02 && Math.abs(ed.yy) < 0.01 && ed.yf === 0 && Math.abs(ed.h) < 1e-3, `1F: both back down to the lobby, YARIS nose to the door again (${ed.s} s)`);
// 叫電梯：電梯不在你這層（車庫頁送車下來到一半之類）→ 站在電梯口「叫電梯」→ 電梯開過來
const ec = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, G = D.GAR, W = D.walker, a = H.gw(-2.6, -4.2);
  W.teleport({ x: a.x, z: a.z, heading: 0 }); H.step(5);
  G.liftTo(5, 0); for (let n = 0; n < 2400 && G.lift.busy; n++) H.step(1);
  const away = { floor: G.lift.floor, here: G.liftHere(G.floor) }; H.step(5); const act = H.actText(), panel = H.elPanel();
  const pressed = H.press(); H.step(10); const busy = G.lift.busy, act2 = H.actText(); for (let n = 0; n < 2400 && G.lift.busy; n++) H.step(1); H.step(5);
  return { away, act, panel, pressed, busy, act2, floor: G.lift.floor, here: G.liftHere(G.floor), act3: H.actText(), toast: H.toast() };
});
console.log('  叫電梯:', JSON.stringify(ec));
check(ec.away.floor === 5 && !ec.away.here && ec.act === '叫電梯' && !ec.panel.shown && ec.pressed === '叫電梯' && ec.busy && ec.act2 === '電梯動作中⋯' && ec.floor === 0 && ec.here && ec.act3 !== '叫電梯' && /電梯下來了/.test(ec.toast),
  `the lift is up on 6F: next to the shaft the big button says 「${ec.act}」; pressed, it comes down (「${ec.act2}」 while moving; 「${ec.toast}」)`);
// 小房子「大便龍的家」：走進門（自動換第一人稱、鏡頭頭上有斜天花板）→ 床邊「睡覺」
const si = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, G = D.GAR, S = G.spots, B = G.zones.bedSide;
  const pre = [];
  const r = H.walkLocal([...pre, [0.3, -4.5], [S.houseOut.x, S.houseOut.z], [S.houseIn.x, S.houseIn.z], [B.x, B.z]], { tol: 0.2 }); H.step(5);
  const t = W.telemetry(), g = window.__D().gcam;
  return { walked: r.ok, at: r, act: H.actText(), cam: t.camMode, auto: g.auto, house: g.house, maxY: g.maxY, ceil: G.zones.house.ceil, ridge: G.zones.house.ridge, eye: window.__D().CABIN_EYE };
});
console.log('  into the cabin:', JSON.stringify(si));
check(si.walked && si.act === '睡覺' && si.house && (!si.eye || (si.cam === 'eye' && si.auto)) && si.maxY >= si.ceil - 0.01 && si.maxY <= si.ridge + 0.01,
  `walked in through the cabin door to the bed: 「${si.act}」, camera ${si.cam}${si.auto ? ' (switched by itself)' : ''}, ceiling over the head at ${si.maxY?.toFixed?.(2)} m ${si.walked ? '' : JSON.stringify(si.at)}`);
clash = await hudClash(); const clashBed = await sizeSweep();
check(!clash && !clashBed, `by the bed (big 「睡覺」, fullscreen): nothing overlapping on any screen (${[clash, clashBed].filter(Boolean).join(' / ') || 'ok'})`);
await drawAndShot('26-cabin-eye');
await p.evaluate(() => { const H = window.__H, W = window.__D().walker; W.setCamera({ mode: 'follow' }); H.step(90); });
await drawAndShot('27-cabin-follow');
await p.evaluate(() => { const H = window.__H, W = window.__D().walker; W.setCamera({ mode: 'eye' }); H.step(5); });
const sj = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, G = D.GAR, B = G.spots.bed;
  const pressed = H.press(); H.step(20);
  const f = document.querySelector('#stage .sleep-fade'), ch = W.character.group, w = H.gw(B.feet.x, B.feet.z);
  return { pressed, sleep: !!window.__D().sleep, mode: W.mode, op: f ? +f.style.opacity : null, hud: H.visible('#stage .wk'), lie: +Math.hypot(ch.position.x - w.x, ch.position.z - w.z).toFixed(3), y: +ch.position.y.toFixed(3), by: B.y, vis: ch.visible };
});
console.log('  睡覺:', JSON.stringify(sj));
check(sj.pressed === '睡覺' && sj.sleep && sj.mode === 'off' && sj.op > 0.1 && sj.op < 0.6 && !sj.hud && sj.lie < 0.01 && Math.abs(sj.y - sj.by) < 0.01 && sj.vis, `睡覺: you lie down on the bed (walking HUD away) and the screen starts going dark (${sj.op})`);
await drawAndShot('28-sleep');
const sk = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, G = D.GAR, f = document.querySelector('#stage .sleep-fade');
  let n = 0, dark = 0, toast = ''; for (; n < 600 && !window.__D().sleep?.woke; n++) { H.step(1); if (+f.style.opacity >= 0.999) dark++; }
  toast = document.querySelector('#stage .wk-toast.show')?.textContent || '';
  const t = W.telemetry(), q = H.gl(t.x, t.z), wk = G.spots.wake, mode = W.mode, op = +f.style.opacity;
  let m = 0; for (; m < 300 && window.__D().sleep; m++) H.step(1);
  return { s: +(n / 60).toFixed(2), dark, toast, mode, at: +Math.hypot(q.x - wk.x, q.z - wk.z).toFixed(3), op, after: +(m / 60).toFixed(2), gone: f.style.display === 'none', hud: H.visible('#stage .wk'), act: H.actText(), cam: W.telemetry().camMode };
});
console.log('  woke up:', JSON.stringify(sk));
check(sk.dark > 30 && sk.toast === '睡飽了！' && sk.mode === 'walk' && sk.at < 0.01 && sk.gone && sk.hud && sk.act === '睡覺',
  `black for ${(sk.dark / 60).toFixed(1)} s, then 「${sk.toast}」 standing by the bed, the picture fades back in (${sk.after} s) and you can walk again`);
await drawAndShot('29-woke-up');
// 在小房子裡亂走（第三人稱、第一人稱）：人不卡進牆、床；鏡頭不在牆裡面、不穿過斜天花板
const sl = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, G = D.GAR, Z = G.zones.house, R = W.character.radius; let seed = 9; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const hd = G.zones.houseDoor, lw = H.gw(hd.x, hd.z), cols = [...H.cols(), ...G.cameraColliders(true), { t: 'box', x: lw.x, z: lw.z, hx: hd.hx, hz: hd.hz, rot: lw.heading, y0: hd.h, h: Z.ridge }], bad = []; let frames = 0, maxCam = 0;
  for (let j = 0; j < 8; j++) {
    let w = null; for (let tries = 0; tries < 50 && !w; tries++) { const c = H.gw(Z.x - Z.hx + 0.4 + r() * (2 * Z.hx - 0.8), Z.z - Z.hz + 0.4 + r() * (2 * Z.hz - 0.8)); if (!H.inside(cols, c.x, 1, c.z, R + 0.05)) w = c; }
    W.teleport({ x: w.x, z: w.z, heading: r() * 6.28 }); H.step(2); W.setCamera({ mode: j % 4 === 3 ? 'eye' : 'follow' }); H.step(2);
    let a = r() * 6.28;
    for (let i = 0; i < 150; i++) {
      if (i % 50 === 0) { a = r() * 6.28; if (r() < 0.5) W.setCamera({ yaw: r() * 6.28, pitch: -0.2 + r() * 1.1 }); }
      const t = W.telemetry(), rel = a - t.camYaw, m = 0.5 + r() * 0.5; W.setInput({ x: -Math.sin(rel) * m, y: Math.cos(rel) * m, run: i % 60 > 40 });
      H.step(1); frames++;
      const b = H.checkFrame(cols), cp = D.dcam.position, q = H.gl(cp.x, cp.z), ce = G.ceilingAt(q.x, q.z);
      if (cp.y > ce - 0.05) b.push(`camera above the ceiling (${cp.y.toFixed(2)} > ${ce.toFixed(2)})`);
      maxCam = Math.max(maxCam, cp.y);
      if (b.length && bad.length < 6) bad.push(`#${j} f${i}: ${b.join('; ')}`);
    }
  }
  W.setInput(null); W.setCamera({ mode: 'eye', hold: 0 });
  return { frames, bad, maxCam: +maxCam.toFixed(2) };
});
check(!sl.bad.length, `random walking inside the cabin (8 × 2.5 s, mostly third person, random camera): never inside a wall or the bed, camera never inside a wall or above the sloping ceiling (${sl.frames} frames, camera up to ${sl.maxCam} m${sl.bad.length ? ' — ' + sl.bad.join(' | ') : ''})`);
// 衣櫃前面（床尾、書桌的椅子旁邊）：「換衣服」→ 自訂角色（走路的停住）→ 換成 1.9 公尺、壯 → 完成：接著走，走路的人換好了（身高、半徑）
const wd = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, S = D.GAR.spots;
  W.teleport(H.gw(S.wake.x, S.wake.z, S.wake.heading)); H.step(5);
  const r = H.walkLocal([[0.2, -9.3], [D.GAR.zones.dress.x, D.GAR.zones.dress.z]], { tol: 0.2 }); H.step(5);
  const act = H.actText(), pressed = H.press(), P = window.__look();
  return { walked: r.ok, act, pressed, open: P.isOpen, mode: W.mode, hud: H.visible('#stage .wk'), from: P.look.hair };
});
console.log('  wardrobe:', JSON.stringify(wd));
check(wd.walked && wd.act === '換衣服' && wd.pressed === '換衣服' && wd.open && wd.mode === 'off' && !wd.hud && wd.from === 'short', 'in the cabin by the wardrobe the big button says 換衣服: it opens 自訂角色 (with your look) and walking pauses');
await p.evaluate(() => { const P = window.__look(); P.set('height', 1.9); P.set('build', 'big'); P.set('top', 'hoodie'); });
await p.waitForTimeout(800); await p.screenshot({ path: `${prefix}-29b-wardrobe.png` }); console.log('  shot', `${prefix}-29b-wardrobe.png`, el());
const we = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, P = window.__look(); P.el.querySelector('.lk-done').click(); H.step(5);
  const C = W.character, toast = document.querySelector('#stage .wk-toast.show')?.textContent || '';
  return { open: P.isOpen, mode: W.mode, hud: H.visible('#stage .wk'), h: C.height, r: +C.radius.toFixed(3), top: C.look.top, saved: JSON.parse(localStorage.getItem('carid.tune') || '{}').look?.height, toast, act: H.actText() };
});
console.log('  dressed:', JSON.stringify(we));
check(!we.open && we.mode === 'walk' && we.hud && we.h === 1.9 && we.r > 0.3 && we.top === 'hoodie' && we.saved === 1.9 && we.toast === '換好了！' && we.act === '換衣服', `完成: back to walking as the new you (1.90 m, radius ${we.r}, hoodie; saved) — 「${we.toast}」`);
await drawAndShot('29c-dressed');
// 走出來：換回第三人稱
const so = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, S = D.GAR.spots;
  W.teleport(H.gw(S.wake.x, S.wake.z, S.wake.heading)); H.step(5);
  const inCam = W.telemetry().camMode;
  const r = H.walkLocal([[S.houseIn.x, S.houseIn.z], [S.houseOut.x, S.houseOut.z], [0.3, -4.5]], { tol: 0.2 }); H.step(5);
  const g = window.__D().gcam;
  return { walked: r.ok, inCam, cam: W.telemetry().camMode, auto: g.auto, house: g.house, maxY: g.maxY };
});
console.log('  out of the cabin:', JSON.stringify(so));
check(so.walked && so.inCam === 'eye' && so.cam === 'follow' && !so.auto && !so.house, `walked back out of the cabin: third-person camera again (${so.inCam} → ${so.cam})`);
// 車行送車（你在車店看不到）：停到樓上第一個空的格子（電梯不用動、沒有聲音）；40 格都滿了＝先停一樓大廳
const sm = await p.evaluate(() => {
  const D = window.__D(), G = D.GAR, ex = D.VIL.places.dealer.exit, out = {}, away = (k) => { D.offTower(k); D.tripPose[k] = { x: ex.x, z: ex.z, heading: ex.heading }; }; // 開去車店了
  const snap = () => ({ lift: G.lift.floor, busy: G.lift.busy, snd: Object.keys(window.__D().liftSnd).length });
  out.before = snap(); away('gc8');
  const m1 = D.deliver('gc8', 'GC8'), i1 = window.__D().TWR.indexOf('gc8');
  out.one = { msg: m1, i: i1, ...snap(), on: D.LODS.gc8.lod.car.parent?.name, pose: D.tripPose.gc8?.tw, cars: window.__D().walker.cars.map((c) => c.key) };
  away('gc8'); const T = window.__D().TWR, fill = []; for (let i = 0; i < T.length; i++) if (!T[i]) { T[i] = 'jesko'; fill.push(i); } // 開走以後，空的格子先假裝停滿（JESKO 只是名字）
  const m2 = D.deliver('gc8', 'GC8'), q = window.__H.gl(D.tripPose.gc8.x, D.tripPose.gc8.z);
  out.full = { msg: m2, tw: D.tripPose.gc8.tw ?? null, f: D.tripPose.gc8.f, q: [+q.x.toFixed(2), +q.z.toFixed(2)], inT: G.isInside(q.x, q.z), lod: D.LODS.gc8.lod.car.parent === G.interior };
  for (const i of fill) T[i] = null;
  const m3 = D.deliver('gc8', 'GC8'); out.again = { msg: m3, i: window.__D().TWR.indexOf('gc8'), jesko: window.__D().TWR.includes('jesko') };
  window.__H.step(5);
  out.tower = window.__D().TWR.slice(); out.park = window.__G().park.tower.slice();
  return out;
});
console.log('  dealer deliveries:', JSON.stringify(sm));
check(sm.one.i === 0 && sm.one.on === 'towerBay1' && sm.one.pose === 0 && sm.one.lift === sm.before.lift && !sm.one.busy && sm.one.snd === 0 && /GC8 車行幫你送回車庫了：停在 2 樓 1 號/.test(sm.one.msg),
  `delivered: the car goes into the first free spot upstairs, the lift does not move, no motor sound: 「${sm.one.msg}」`);
check(sm.full.msg === '車庫滿了：GC8 先停在一樓大廳' && sm.full.tw === null && sm.full.f === 0 && sm.full.inT && Math.hypot(sm.full.q[0], sm.full.q[1]) > 6 && sm.full.lod && sm.again.i === 0 && !sm.again.jesko,
  `all 40 spots taken: the dealer leaves it in the lobby (「${sm.full.msg}」, local ${sm.full.q.join(', ')}); with room again it goes back upstairs (「${sm.again.msg}」)`);
check(JSON.stringify(sm.tower) === JSON.stringify(sm.park), 'the tower layout is saved as it changes');
// 電梯的馬達聲（OfflineAudioContext 算出來）：開鎖「喀」→ 馬達嗡嗡（有聲音）→ 停：落鎖「喀」→ 安靜
const sn = await p.evaluate(async () => {
  const sr = 44100, ctx = new OfflineAudioContext(1, sr * 3, sr), A = window.__cea({ context: ctx, worklet: false, script: false }), h = A.lift();
  const alive = h.alive; h.stop(1.6);
  const d = (await ctx.startRendering()).getChannelData(0);
  const rms = (a, b) => { let s = 0; const i0 = Math.round(a * sr), i1 = Math.round(b * sr); for (let i = i0; i < i1; i++) s += d[i] * d[i]; return +Math.sqrt(s / (i1 - i0)).toFixed(4); };
  let peak = 0, bad = 0; for (const x of d) { if (!Number.isFinite(x)) bad++; else peak = Math.max(peak, Math.abs(x)); }
  return { alive, clunk: rms(0.01, 0.12), gap: rms(0.36, 0.48), hum: rms(1.0, 1.55), lock: rms(1.9, 2.05), after: rms(2.45, 2.95), peak: +peak.toFixed(3), bad, dead: !h.alive };
});
console.log('  lift sound:', JSON.stringify(sn));
check(sn.alive && sn.dead && !sn.bad && sn.peak < 1 && sn.clunk > 0.02 && sn.gap < sn.clunk / 4 && sn.hum > 0.02 && sn.lock > 0.02 && sn.after < 0.002,
  `elevator motor sound: unlock clunk ${sn.clunk}, quiet ${sn.gap}, motor hum ${sn.hum}, lock clunk ${sn.lock}, then silence ${sn.after} (peak ${sn.peak})`);
// 直接回車庫：圓塔裡停的都記著（下一趟、重新整理都還在）
const sp10 = await p.evaluate(() => ({ tower: window.__D().TWR.slice(), cur: window.__D().cur }));
await p.evaluate(() => document.getElementById('driveHome').click());
await p.evaluate(() => { window.__hold = false; window.__noDraw = false; }); await p.waitForTimeout(1500);
const hm10 = await p.evaluate(() => { const G = window.__G(), D = window.__D(); return { trip: D.trip, park: G.park, saved: JSON.parse(localStorage.getItem('carid.tune')).park, cam: window.__cam() }; });
console.log('  home:', JSON.stringify(sp10), '→', JSON.stringify(hm10));
check(!hm10.trip && hm10.park.mid === sp10.cur && sp10.tower.every((k, i) => k === hm10.park.tower[i]) && JSON.stringify(hm10.saved.tower) === JSON.stringify(hm10.park.tower) && !('decks' in hm10.saved) && !('ring' in hm10.saved),
  'back on the garage page: every car stays in the tower spot it was left in (saved on the phone as park.tower)');

// ---- 11 車庫頁：車子多了（7 台）：舊存檔（沒有 park）照價錢停圓塔 2 樓；舊的升降機（decks）、圓環車庫（ring）存檔搬進圓塔；選樓上的車：電梯送下來；鏡頭留在塔裡面 ----
const ALL7 = ['gc8', 'yaris', 'supra', 'gtr', 'p918', 'sp3', 'jesko'];
async function page7(park) { // 存檔換成 7 台（cur＝GC8）、重新整理，等 6 台輕量車都載好
  await p.waitForTimeout(800); // 頁面還沒存的（300 毫秒）先存完，才不會蓋掉
  await p.evaluate(([own, park]) => localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 5, owned: own, parts: {}, tyres: {}, wins: {}, cars: {}, ...(park ? { park } : {}) })), [ALL7, park]);
  await p.reload({ waitUntil: 'domcontentloaded' }); await ready();
  await p.waitForFunction((ks) => ks.every((k) => window.__D().LODS[k]?.lod), ALL7.slice(1), { timeout: 300000 }); await p.waitForTimeout(1000);
  return p.evaluate((ks) => {
    const R = window.__room(), G = window.__G(), D = window.__D(), T = D.TOWER_BAYS;
    const where = (k) => { const o = D.LODS[k]?.lod?.car, n = o?.parent?.name || ''; if (!n.startsWith('towerBay')) return null; const i = +n.slice(8) - 1, b = T[i]; o.updateMatrixWorld(true); const e = o.matrixWorld.elements;
      return [i, +Math.hypot(e[12] - b.x, e[14] - b.z).toFixed(4), +(e[13] - b.y).toFixed(4), o.visible]; };
    return { cur: D.cur, park: G.park, at: Object.fromEntries(ks.map((k) => [k, where(k)])), cam: window.__cam(), round: R.size.round, gpos: R.group.position.toArray(), main: window.__S()?.car.position.toArray() };
  }, ALL7.slice(1));
}
const s11a = await page7(null);
console.log('11', el(), '7 cars, old save (no park):', JSON.stringify(s11a));
check(s11a.cur === 'gc8' && s11a.round && s11a.gpos.every((v) => v === 0) && JSON.stringify(s11a.park.tower.slice(0, 8)) === JSON.stringify(['yaris', 'supra', 'gtr', 'p918', 'sp3', 'jesko', null, null]) && s11a.park.tower.length === 40
  && ALL7.slice(1).every((k, i) => JSON.stringify(s11a.at[k]) === JSON.stringify([i, 0, 0, true])) && Math.abs(s11a.cam.maxD - s11a.cam.fitD * 1.4) < 1e-6,
  `old save with 7 cars: GC8 on the turntable, the other 6 parked by price in 2 樓 1–6 號 (${s11a.park.tower.slice(0, 6).join(', ')}), camera as before (max ${s11a.cam.maxD.toFixed(2)} m)`);
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
await p.screenshot({ path: `${prefix}-30-page-7-cars.png` }); console.log('  shot', `${prefix}-30-page-7-cars.png`, el());
// 舊的存檔：升降機（decks，上層 0–5、下層 6–11）、圓環車庫（ring）→ 照順序搬進圓塔（不認得的、重複的不要），沒寫到的照價錢補
const s11b = await page7({ mid: 'gc8', decks: ['yaris', 'supra', 'gtr', null, null, null, 'jesko', null, null, null, null, null], rev: [], ring: ['sp3', null, 'p918', null, null, null, null, null, 'bogus', 'yaris'] });
console.log('  old decks + ring save:', JSON.stringify(s11b));
check(JSON.stringify(s11b.park.tower.slice(0, 7)) === JSON.stringify(['yaris', 'supra', 'gtr', 'jesko', 'sp3', 'p918', null]) && s11b.park.mid === 'gc8' && !('decks' in s11b.park) && !('ring' in s11b.park)
  && ['yaris', 'supra', 'gtr', 'jesko', 'sp3', 'p918'].every((k, i) => JSON.stringify(s11b.at[k]) === JSON.stringify([i, 0, 0, true])),
  `an old save with lift decks and the 4-floor ring garage moves into the tower in the same order (unknown and repeated cars dropped): ${s11b.park.tower.slice(0, 6).join(', ')}`);
// 轉一圈、拉到最遠：鏡頭照樣在塔裡面（玻璃牆裡面、二樓的樓板下面）
const orb = await p.evaluate(async () => {
  const c = window.__camera(), ctl = window.__controls(), T = ctl.target, p0 = c.position.clone(), fr = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let maxR = 0, maxY = 0, n = 0, maxD = 0; ctl.autoRotate = false;
  for (let a = 0; a < 12; a++) for (const e of [0.12, 0.6, 1.2]) {
    const az = (a / 12) * Math.PI * 2; c.position.set(T.x + Math.cos(az) * Math.cos(e) * 40, T.y + Math.sin(e) * 40, T.z + Math.sin(az) * Math.cos(e) * 40); ctl.update(); await fr(); n++;
    const q = c.position; maxR = Math.max(maxR, Math.hypot(q.x, q.z)); maxY = Math.max(maxY, q.y); maxD = Math.max(maxD, q.distanceTo(T));
  }
  c.position.copy(p0); ctl.update(); ctl.autoRotate = true;
  return { n, maxR: +maxR.toFixed(2), maxY: +maxY.toFixed(2), maxD: +maxD.toFixed(2), ceil: window.__D().towerFy(1) - 0.3 };
});
console.log('  orbit:', JSON.stringify(orb));
check(orb.maxR < 10.65 && orb.maxY < orb.ceil - 0.3 && orb.maxD > 4, `orbiting all the way round at full zoom-out (${orb.n} positions): the camera stays inside the glass (r ≤ ${orb.maxR} m) and under the 2F floor (y ≤ ${orb.maxY} m)`);
// 選停在樓上的車（SP3，2 樓 5 號）：電梯送下來（說一聲），GC8 停去 SP3 那格
const pk11 = await p.evaluate(async () => { document.querySelector('#cars button[data-car="sp3"]').click(); await new Promise((r) => setTimeout(r, 600)); const G = window.__G(); return { cur: window.__D().cur, toast: document.getElementById('gtoast').textContent, mid: G.park.mid, t4: G.park.tower[4] }; });
await p.waitForFunction(() => window.__D().LODS.gc8?.lod?.car.parent?.name === 'towerBay5', null, { timeout: 60000 });
console.log('  pick SP3 upstairs:', JSON.stringify(pk11));
check(pk11.cur === 'sp3' && /SP3 坐電梯從 2 樓下來了/.test(pk11.toast) && pk11.mid === 'sp3' && pk11.t4 === 'gc8', `picking SP3 (parked upstairs) on the garage page: 「${pk11.toast}」, and GC8 takes SP3's spot (2 樓 5 號)`);
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
await p.screenshot({ path: `${prefix}-31-page-tower.png` }); console.log('  shot', `${prefix}-31-page-tower.png`, el());

// ---- 12 麥塊 → 汽車：回到改車 ----
if (SITE) { // 改車遊戲的網站沒有麥塊、汽車分頁：重新整理還是遊戲
  await p.reload({ waitUntil: 'domcontentloaded' }); await ready();
  check(new URL(p.url()).pathname === '/' && await p.evaluate(() => typeof window.__D === 'function' && !!document.getElementById('cars').children.length), `reload: the game page comes back by itself (${p.url().replace(root, '')})`);
} else {
await p.click('.tabbar a[href="./mc.html"]'); await p.waitForURL(/mc\.html/, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800);
await p.click('.tabbar a[href="./index.html"]'); await p.waitForURL(/tune\.html/, { waitUntil: 'domcontentloaded' });
await ready();
check(/tune\.html/.test(p.url()), `麥塊 → 汽車 returns to 改車 (${p.url().replace(root, '')})`);
}

// ---- 13 亮色＋藍色主色：車庫頁、出門（走路，在你家車庫裡）、上車，再直接回車庫 ----
await p.evaluate(() => { localStorage.setItem('carid.theme', 'light'); localStorage.setItem('carid.accent', '#4C9AFF'); });
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready(); await p.waitForTimeout(1500);
await p.screenshot({ path: `${prefix}-21-light.png`, fullPage: true }); console.log('  shot', `${prefix}-21-light.png`, el());
await p.evaluate(() => document.getElementById('driveOut').click());
await p.waitForFunction(() => window.__D().on && window.__D().walker?.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.waitForFunction(() => window.__D().walker.cars.length >= 1, null, { timeout: 120000 });
await p.evaluate(() => window.__H.step(20)); await drawAndShot('22-light-on-foot');
check(fullView(await fsInfo()), 'light theme: on foot is fullscreen too');
// 剛開始走的 0.35 秒內不能上車（walk.js 的 lockT）：先走半秒
const lt = await p.evaluate(() => { const D = window.__D(), W = D.walker; window.__H.step(30); const ok = W.getIn(W.cars.find((c) => c.key === D.cur)), b = window.__H.board(); window.__H.step(5); const D2 = window.__D(); return { ok: !!ok, modes: b.modes, drv: !!D2.drv, act: window.__H.actText(), act2: window.__H.act2() }; });
console.log('13', el(), 'light:', JSON.stringify(lt));
await drawAndShot('23-light-in-car');
await p.evaluate(() => document.getElementById('driveHome').click());
await p.evaluate(() => { window.__hold = false; window.__noDraw = false; }); await p.waitForTimeout(1200);
check(lt.drv && lt.act === '開鐵捲門' && lt.act2 === '下車' && await p.evaluate(() => document.body.className === '' && !window.__D().trip && window.__D().walker.mode === 'off'), 'light theme: go out on foot, get in (開鐵捲門 + 下車), and back');

await b.close(); srv.close();
console.log(errs.length ? `ERRORS ${errs.length}` : 'no page errors');
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS OK', el());
process.exit(errs.length || fails.length ? 1 : 0);
