// 第 1＋2 批在 App（carid-pwa 的 build，0.8.<版號>）裡測：跟 test-b1.mjs 同一趟（出門是走路 → 走去上車 → 開鐵捲門 → 改車廠、車店買車 → 快速道路極速 → 賽道 → 開回家停上升降機 → 下車走 → 走去開別台 → 直接回車庫 → 重新整理 → 再出門）
//   也測走路：車庫的牆、關著的鐵捲門、停著的車擋人；下車（右邊的第二顆「下車」）、走回去上車；走路開鐵捲門、走遠了門自己關
//   升降停車格、小房子睡覺、車行送車、車庫頁 7 台車（第 10、11 段，跟 test-b1.mjs 一樣）；另外：標題旁的版本號、麥塊 → 汽車回到改車、亮色＋藍色主色（出門走路、上車）
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
  + '   DECK, DREV, sleep, gcam, liftSnd, deliver, offDeck, runLift, midCar, normPark, CABIN_EYE });'
  + ' window.__N = () => NPC; window.__NMAX = () => NPC_MAX;'
  + ' window.__pol = () => (typeof police !== "undefined" ? police : null);' // 第 3 批（b3-int）：警察（撞人的測試以後把星星清掉：警察的部分在 test-b3.mjs）
  + ' window.__IN = () => ({ indoor, doorFade, HOUSE_WARM, interiorFor, buildInterior, DEALER_DOOR });'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } else if (window.__npcKeep) { NPC = window.__npcKeep; window.__npcKeep = null; NPC.g.visible = DRIVE.on; } };'
  + ' window.__look = () => LOOKP; window.__cam = () => ({ camCap, maxD: controls.maxDistance, fitD, dist: camera.position.distanceTo(controls.target), pos: camera.position.toArray() }); window.__cea = createEngineAudio; window.__camera = () => camera;'
  + ' window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };'
  + ' window.__wstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return walker && walker.telemetry(); };';
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u.startsWith('/three/') ? path.join(three, u.slice(7)) : path.join(repo, u === '/' ? 'index.html' : u);
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
    chrome: ['.appbar', '.segbar', '.tabbar'].filter((s) => vis(q(s))).join(' '), btn: vis(q('#fsBtn')), pressed: q('#fsBtn').getAttribute('aria-pressed'),
    scrolls: document.documentElement.scrollHeight > innerHeight + 1, pref: localStorage.getItem('carid.tune.full'), calls: (window.__fsCalls || []).join(','),
    race: vis(q('#race')) ? [rc.left, rc.top, rc.width, rc.height].map(Math.round) : null, pedals: vis(q('#hud .pedals')), gauge: vis(q('#hud .gauge')) };
});
const shown = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }, sel);
const fullView = (f) => f.fs && f.html && f.pos === 'fixed' && f.stage.join() === `0,0,${f.vw},${f.vh}` && !f.chrome && !f.scrolls && f.btn;
// 畫面上的按鈕：開車的 HUD（多了「下車」）、走路的 HUD（搖桿、上車／升降機／睡覺的大按鈕、小地圖、換視角、右下角的圓按鈕）、疊在畫面上的去哪裡／直接回車庫／聲音、
//   全螢幕鈕、比賽的 HUD：看得到的兩兩不重疊；全螢幕的時候都在螢幕裡面（離邊邊至少 4 px）
const HUD_SEL = ['.dv-chip', '.dv-act', '.dv-act2', '.dv-map', '.dv-cam', '.dv-spd', '.dv-steer', '.dv-brk', '.dv-gas', '.dv-hb', '.wk-chip', '.wk-act', '.wk-map', '.wk-cam', '.wk-stick', '.wk-btns',
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
  if (!r.arrived && !r.stop) console.log('  last blocked by:', JSON.stringify(await p.evaluate(() => window.__pp.blk || null)), '| now', JSON.stringify(await p.evaluate(() => { const t = window.__D().drv?.telemetry(); return t && { x: +t.x.toFixed(1), z: +t.z.toFixed(1), h: +t.heading.toFixed(2), v: +t.v.toFixed(2), gear: t.gear, bumps: t.bumps }; })));
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
const lodAt = () => p.evaluate(() => { // 升降機上的車掛在平台（room.interior 底下）上：也算在車庫裡
  const D = window.__D(), R = window.__room(), under = (o, g) => { for (let q = o; q; q = q.parent) if (q === g) return true; return false; };
  return Object.fromEntries(Object.entries(D.LODS).map(([k, L]) => [k, !L.lod ? 'loading' : !L.lod.car.parent ? '-' : R && under(L.lod.car, R.interior) ? 'page' : D.GAR && under(L.lod.car, D.GAR.interior) ? 'town-garage' : L.lod.car.parent === D.VIL?.group ? 'town' : 'other']));
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

// ---- 1 車庫頁：YARIS 停在後面的升降機（1 號，跟地板平的上層；輕量車）；「出門」----
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
await p.waitForFunction(() => window.__D().LODS.yaris?.lod, null, { timeout: 300000 }); await p.waitForTimeout(800);
const bay0 = await p.evaluate(() => {
  const D = window.__D(), R = window.__room(), L = D.LODS.yaris.lod.car, b0 = R.spots.bays[0]; L.updateMatrixWorld(true); const e = L.matrixWorld.elements;
  return { parent: L.parent === R.lifts[0].platforms[1], pos: [+e[12].toFixed(6), +e[13].toFixed(6), +e[14].toFixed(6)], want: [b0.x, b0.z], sig: R.baySig, main: window.__S().car.position.toArray(), park: window.__G().park, levels: R.lifts.map((lf) => lf.level).join('') };
});
console.log('1', el(), 'car:', await txt('#carName'), '| wallet:', await txt('#wallet'), '| bays:', JSON.stringify(bay0), '| lods', JSON.stringify(await lodAt()));
check(bay0.parent && Math.abs(bay0.pos[0] - bay0.want[0]) < 1e-6 && bay0.pos[1] === 0 && Math.abs(bay0.pos[2] - bay0.want[1]) < 1e-6 && /YARIS/.test(bay0.sig) && bay0.main.every((v) => v === 0) && bay0.park?.mid === 'gc8' && bay0.park.decks[0] === 'yaris' && bay0.levels === '111111',
  'page garage: YARIS parked on lift 1 (top deck at the floor; a save without deck places fills them by price), GC8 on the turntable');
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

// ---- 2 出門：人站在你家（村子裡那棟）裡面，鐵捲門關著；GC8 停在中間（車頭朝門），YARIS 停在 1 號升降機上 ----
await p.evaluate(() => document.getElementById('driveOut').click());
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.waitForFunction(() => window.__D().LODS.yaris?.lod?.car.parent === window.__D().GAR.lifts[0].platforms[1], null, { timeout: 120000 });
const s2 = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker; H.step(10); const t = W.telemetry(), q = H.gl(t.x, t.z), sp = D.VIL.places.garage.spawn, c = D.tripS.car, sh = D.TR.scene.getObjectByName('park-shadow');
  return { mode: t.mode, local: [+q.x.toFixed(2), +q.z.toFixed(2)], drv: !!D.drv, dv: !!document.querySelector('#stage .dv'), wk: H.visible('#stage .wk'), door: D.GAR.door.t, dest: t.dest, hidden: t.hidden,
    carTown: c.parent === D.TR.scene && c.visible, carAt: Math.hypot(c.position.x - sp.x, c.position.z - sp.z), carH: Math.abs(c.rotation.y - sp.heading), shadow: !!sh?.visible, tripFull: D.tripFull,
    yarisBay: (() => { const p = D.tripPose.yaris, b = H.gw(D.GAR.spots.bays[0].x, D.GAR.spots.bays[0].z); return Math.hypot(p.x - b.x, p.z - b.z); })(), dests: [...document.querySelectorAll('#dests button')].map((x) => x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(' ') };
});
console.log('2', el(), 'on foot:', JSON.stringify(s2), '| lods', JSON.stringify(await lodAt()));
check(s2.mode === 'walk' && !s2.drv && !s2.dv && s2.wk && !s2.hidden && s2.door === 0 && s2.dest === 'shop' && s2.local[0] < 0 && Math.abs(s2.local[1]) < 12, 'starts ON FOOT inside the garage (door closed, no car being driven, walking HUD, destination shop)');
check(s2.carTown && s2.carAt < 1e-6 && s2.carH < 1e-6 && s2.shadow && s2.tripFull === 'gc8' && s2.yarisBay < 1e-6, 'GC8 parked in the middle facing the door (full model + shadow), YARIS on lift 1');
const me2 = await p.evaluate(() => { const C = window.__D().walker.character, L = window.__G().look; return { tris: C.info?.tris, bones: C.bones?.length, h: C.height, r: +C.radius.toFixed(3), same: ['hair', 'topColor', 'bottom', 'hat', 'hatColor'].every((k) => C.look[k] === L[k]) }; });
const np0 = await p.evaluate(() => { const N = window.__N(), D = window.__D(); if (!N) return null; return { load: N.load, max: window.__NMAX(), g: N.g.parent === D.TR.scene, vis: N.g.visible, tb: N.traffic.stats.built, pb: N.peds.stats.built, props: N.peds.props.colliders.length,
  pool: N.g.children.filter((o) => o.name.startsWith('lodcar-')).length, drivers: N.g.children.filter((o) => o.name.startsWith('lodcar-')).every((o) => o.getObjectByName('body').children.some((k) => k.isGroup || k.isBone || k.type === 'Group')) }; });
console.log('  npc (loading screen):', JSON.stringify(np0));
check(np0 && np0.g && np0.vis && np0.load.warmCars >= np0.max.cars && np0.pb >= np0.max.people && np0.props > 0 && np0.pool >= np0.max.cars,
  `路上的人和車 made on the loading screen: ${np0?.tb} cars/scooters (with drivers/riders) and ${np0?.pb} people ready (graphs ${np0?.load.graphs} ms, cars ${np0?.load.cars} ms, people ${np0?.load.people} ms); ${np0?.props} benches/chairs block walking and driving`);
check(me2.tris > 2000 && me2.bones === 29 && me2.same && me2.h === 1.74, `you walk around as the real character in your saved look (${me2.tris} triangles, ${me2.h} m, radius ${me2.r})`);
let cm = await carsMatch();
check(cm.keys.includes('gc8') && cm.keys.includes('yaris') && !cm.bad.length, `both cars can be boarded and the walking list matches where they are drawn (${cm.keys.join(', ')}${cm.bad.length ? ' — ' + cm.bad.join('; ') : ''})`);
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
  return { R, back: go(-8.5, -3.5, -1, 0).x, door: go(1.5, 2.2, 1, 0).x, car: go(0, -4, 0, 1, 4).z, hz: W.cars.find((c) => c.key === 'gc8').hz, doorT: D.GAR.door.t };
});
console.log('  collide:', JSON.stringify(col));
check(col.back >= -12.7 + col.R - 0.02 && col.back < -12.7 + col.R + 1, `garage back wall stops you (x ${col.back.toFixed(2)}, wall at −12.7)`);
check(col.door > 4.2 && col.door < 4.9 && col.doorT === 0, `closed roller door stops you from inside (x ${col.door.toFixed(2)}, door at 4.85–5.3)`);
check(col.car <= -(col.hz + col.R) + 0.03 && col.car > -(col.hz + col.R) - 0.25, `parked GC8 blocks you (stopped at z ${col.car.toFixed(2)}, car half width ${col.hz.toFixed(2)})`);
// 在車庫裡亂走：每一格人都不可以卡進東西（牆、車、門）、鏡頭不在東西裡面
const rnd = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker; let seed = 5; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cols = H.cols(), bad = []; let frames = 0;
  const spots = [[-5, -8], [-8, 0], [-3, 6], [2, 8], [3, -6], [-10, 10], [-10, -10], [1, -3], [-6, 3], [4, 3]];
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
const w2 = await p.evaluate(() => { const D = window.__D(), H = window.__H, W = D.walker, a = H.gw(-4.6, -7.7, -1.05); W.teleport(a); H.step(20); const r = H.walkLocal([[-2.6, -2.6], [-0.6, -2.3]]); return { r, act: H.actText(), near: W.telemetry().near }; });
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
fi = await fsInfo(); clash = await hudClash();
console.log('  fullscreen (in the car):', JSON.stringify(fi), '| clash:', clash || '-');
check(fullView(fi) && !fi.walking && !clash, `in the car: still fullscreen; 開鐵捲門, 下車, steering, pedals, map and the page buttons all on screen, none overlapping (${clash || 'ok'})`);
clash = await sizeSweep();
check(!clash, `in the car on other screens (landscape: 下車 moves into the row of round buttons): none overlapping (${clash || 'ok'})`);
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
check(gl.x < 5 - 1.5 && blocked > 0, 'closed roller door blocks the car');
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
check(cm.keys.includes('gc8(parked)') && cm.keys.includes('yaris') && !cm.bad.length, `the car you got out of is boardable where it stands (${cm.keys.join(', ')}${cm.bad.length ? ' — ' + cm.bad.join('; ') : ''})`);
await drawAndShot('5-got-out');
// 走路開鐵捲門（裡面）→ 走出去 → 走遠了門自己關 → 走回來（外面）開鐵捲門 → 走回車子旁邊
const dw = await p.evaluate(() => { const H = window.__H, r = H.walkLocal([[3.4, -1.7]]); return { ok: r.ok, act: H.actText() }; });
check(dw.ok && dw.act === '開鐵捲門', `on foot at the closed door (inside): 「${dw.act}」`);
clash = await hudClash(); const clashDoor = await sizeSweep();
check(!clash && !clashDoor, `on foot at the door (big 「開鐵捲門」): nothing overlapping on any screen (${[clash, clashDoor].filter(Boolean).join(' / ') || 'ok'})`);
await drawAndShot('6-door-on-foot');
const dop = await p.evaluate(() => { const D = window.__D(), H = window.__H, pressed = H.press(); H.step(10); const m = D.GAR.door.moving; H.step(160); return { pressed, m, t: D.GAR.door.t, act: H.actText() }; });
check(dop.pressed === '開鐵捲門' && dop.m && dop.t === 1 && !/鐵捲門/.test(dop.act || ''), `the roller door rolls up from the walking button; no door button once it is up (no 關鐵捲門 by default) (${JSON.stringify(dop)})`);
const wo = await p.evaluate(() => { const H = window.__H, r = H.walkLocal([[9, -1.5], [17, -1]]), t = window.__D().walker.telemetry(); return { ok: r.ok, local: H.gl(t.x, t.z) }; });
check(wo.ok && wo.local.x > 15, `walked out of the garage through the open door (local x ${wo.local.x.toFixed(1)})`);
await drawAndShot('7-walked-out');
const far = await p.evaluate(() => { const D = window.__D(), H = window.__H, r = H.walkPath([[-300, -74], [-290, -72.5], [-262, -72.5]], { m: 1, run: true }); H.step(200); return { ok: r.ok, door: D.GAR.door.t }; });
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
  const ds = W.doors.filter((d) => d.ref?.kind === 'house' && d.ref.floors >= 2 && /* 第 10 批：房子最多 2 層 */  X.interiorFor(d.ref) && !H.inside(cols, out(d).x, 1, out(d).z, R + 0.1)).sort((a, b) => Math.hypot(a.ax - t0.x, a.az - t0.z) - Math.hypot(b.ax - t0.x, b.az - t0.z));
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
check(hdoor.open >= 100 && hdoor.shut === 'gunshop,police' && !hdoor.dealer && hdoor.warm && hdoor.warm.compile >= 0, `every village door opens into a house/shop/store/temple/farmhouse (${hdoor.open} of ${hdoor.doors}; still shut: ${hdoor.shut}; the dealer's auto door is open, not a door); warmed up on the loading screen (${JSON.stringify(hdoor.warm)} ms)`);
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
// 樓梯口：上樓（黑掉 → 2F 的樓梯口）、再下樓
const hup = await p.evaluate(() => { const I = window.__IN().indoor.I, e = I.exits.find((x) => x.to === 1); window.__he = e; return e ? window.__H.toExit(e) : { none: true }; });
const hw1 = await doorDone();
const h2f = await p.evaluate(() => { const H = window.__H, I = window.__IN().indoor?.I, e = window.__he, q = H.inInfo(); return { ...q, at: I && e ? +Math.hypot(q.x - e.spawn.x, q.z - e.spawn.z).toFixed(3) : null, cols: I ? I.colliders === I.floors[1]?.colliders : false }; });
console.log('  upstairs:', JSON.stringify(hup), 'fade frames', hw1 * 2, '→', JSON.stringify(h2f));
check(hup.fade && h2f.in && h2f.floor === 1 && h2f.at < 0.05 && h2f.cols && h2f.doors && h2f.mode === 'walk' && /^2F/.test(h2f.toast), `walked into the stairs: black fade → upstairs 「${h2f.toast}」 at the top of the stairs (2F's walls, furniture and exits now)`);
await drawAndShot('6c-house-2f');
const hdn = await p.evaluate(() => { const I = window.__IN().indoor.I, e = I.exits.find((x) => x.to === 0); window.__he = e; return e ? window.__H.toExit(e) : { none: true }; });
await doorDone();
const h1f = await p.evaluate(() => { const H = window.__H, I = window.__IN().indoor?.I, e = window.__he, q = H.inInfo(); return { ...q, at: I && e ? +Math.hypot(q.x - e.spawn.x, q.z - e.spawn.z).toFixed(3) : null }; });
check(hdn.fade && h1f.in && h1f.floor === 0 && h1f.at < 0.05 && h1f.doors && /^1F/.test(h1f.toast), `and back down the stairs to 1F (「${h1f.toast}」)`);
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
const back = await p.evaluate(() => { const D = window.__D(), H = window.__H, a = H.gw(8, 0.5), r = H.walkPath([[-290, -72.5], [-300, -76], [a.x, a.z]], { m: 1, run: true }); const act = H.actText(); const pressed = H.press(); H.step(170); return { ok: r.ok, act, pressed, door: D.GAR.door.t }; });
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
check(dealer.list.length === 5 && /SUPRA\*/.test(dealer.list.join()) && /SUPRA/.test(dealer.buy), 'dealer lists the 5 unowned cars, SUPRA (affordable) selected');
await p.waitForFunction(() => Object.entries(window.__D().LODS).filter(([k, L]) => L.lod?.car.parent === window.__D().VIL.group).length === 5, null, { timeout: 180000 });
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
await p.waitForFunction(() => window.__D().LODS.gc8?.lod?.car.parent === window.__D().GAR.lifts[1].platforms[1], null, { timeout: 120000 });
di = await driveInfo();
const sw = await p.evaluate(() => { const D = window.__D(), H = window.__H, ex = D.VIL.places.dealer.exit, t = D.drv.telemetry(), b1 = H.gw(D.GAR.spots.bays[1].x, D.GAR.spots.bays[1].z), g = D.tripPose.gc8;
  return { money: window.__G().money, owned: [...window.__G().owned], atExit: Math.hypot(t.x - ex.x, t.z - ex.z) < 0.05, tripIsS: D.tripS === window.__S(), built: Object.keys(D.built), gc8Bay: Math.hypot(g.x - b1.x, g.z - b1.z), tripFull: D.tripFull, sig: D.GAR.baySig }; });
console.log('  bought:', JSON.stringify(sw), JSON.stringify(di), '| lods', JSON.stringify(await lodAt()));
check(sw.money === m0 - 200 && sw.owned.includes('supra') && sw.atExit && sw.tripIsS && di.cur === 'supra' && di.dest === 'garage' && di.voice && !di.paused && sw.tripFull === 'supra', 'bought SUPRA: new car waits at the dealer exit, destination home');
const la4 = await lodAt();
check(la4.gc8 === 'town-garage' && la4.yaris === 'town-garage' && sw.gc8Bay < 1e-6 && /GC8/.test(sw.sig) && /YARIS/.test(sw.sig) && !String(la4.supra).startsWith('town'), 'old GC8 went back to the first free deck (lift 2, top deck, name plate); SUPRA left the showroom');
await p.waitForFunction(() => /車行幫你送回車庫了/.test(document.querySelector('#stage .dv-toast')?.textContent || ''), null, { timeout: 15000 });
const dl = await p.evaluate(() => ({ toast: document.querySelector('#stage .dv-toast').textContent, deck: window.__D().DECK[1], park: window.__G().park?.decks[1] }));
check(/GC8 車行幫你送回車庫了：2 號升降機上層/.test(dl.toast) && dl.deck === 'gc8' && dl.park === 'gc8', `after the purchase a note says where the old car went: 「${dl.toast}」 (saved)`);
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

// ---- 7 開回家：開鐵捲門 → 開進去 → 開上 4 號升降機（跟地板平的上層）→ 下車（自己開正、掛到平台上）→ 走去開 YARIS（輕量車換成完整的車）→ 直接回車庫（停的地方都記著）----
await p.evaluate(() => { document.querySelector('#dests button[data-d="garage"]').click(); });
r = await leg('garage', "(() => { const D = window.__D(), t = D.drv.telemetry(); return window.__pp.inBox(D.VIL.places.garage.inside, t.x, t.z) && Math.abs(t.v) < 0.3; })()", { act: ['開鐵捲門'] }, 250);
check(r.arrived && r.acts.includes('開鐵捲門'), 'came home: opened the roller door from the car and drove into the garage');
const park = await p.evaluate(() => { const D = window.__D(), H = window.__H; D.drv.setInput(null); window.__dstep(40); const t = D.drv.telemetry(), q = H.gl(t.x, t.z); return { act: H.actText(), act2: H.act2(), v: +t.v.toFixed(3), local: [+q.x.toFixed(2), +q.z.toFixed(2)], paused: t.paused }; });
console.log('7', el(), 'home:', JSON.stringify(park));
check(park.act2 === '下車' && park.act == null && !park.paused && Math.abs(park.v) < 1, 'stopped inside the garage: only 下車 (no 停好熄火, no turntable spin)');
await drawAndShot('15-home-parked');
const hout = await p.evaluate(() => {
  const D = window.__D(), H = window.__H; D.drv.teleport(H.gw(-8.9, 9.45, 0.08)); window.__dstep(20); // 開到 4 號升降機前面（差一點點、歪一點點）
  const pressed = H.press2(); let n = 0; for (; n < 400 && window.__D().walker.mode !== 'walk'; n++) H.step(1); H.step(10);
  const D2 = window.__D(), c = D2.tripS.car, lf = D2.GAR.lifts[3], w = H.gw(D2.GAR.spots.bays[3].x, D2.GAR.spots.bays[3].z); c.updateMatrixWorld(true); const e = c.matrixWorld.elements;
  return { pressed, s: +(n / 60).toFixed(2), mode: D2.walker.mode, drv: !!D2.drv, deck: D2.DECK[3], onDeck: c.parent === lf.platforms[1], off: +Math.hypot(e[12] - w.x, e[14] - w.z).toFixed(4), hd: +H.wrapA(Math.atan2(e[8], e[10]) - w.heading).toFixed(4),
    voice: !!D2.dvoice, trip: D2.trip, on: D2.on, toast: document.querySelector('#stage .wk-toast.show')?.textContent || '', park: window.__G().park?.decks.slice(0, 4), cars: D2.walker.cars.map((x) => x.key) };
});
console.log('  parked on a lift:', JSON.stringify(hout));
check(hout.pressed === '下車' && hout.mode === 'walk' && !hout.drv && hout.deck === 'supra' && hout.onDeck && hout.off < 0.01 && Math.abs(hout.hd) < 0.01 && !hout.voice && hout.trip && hout.on && /SUPRA 停好了：4 號升降機上層/.test(hout.toast) && hout.park?.[3] === 'supra' && hout.cars.includes('supra'),
  `drove onto lift 4's deck and pressed 下車: SUPRA straightened itself onto the deck (${hout.s} s) and hangs on the platform (「${hout.toast}」, saved); still boardable; you walk on in the open world`);
await drawAndShot('16-home-on-foot');
// 走去 YARIS（1 號升降機，駕駛座在 −z 那邊）→ 上車：載入完整的 YARIS（「發動中⋯」），從平台開下來；SUPRA 換成輕量車停在 4 號升降機上
const toY = await p.evaluate(() => { const D = window.__D(), H = window.__H, y = D.GAR.spots.bays[0], r = H.walkLocal([[-6.2, 7.9], [-2.5, -1.9], [y.x + 1.6, y.z - 1.35], [y.x + 0.3, y.z - 1.3]]); return { ok: r.ok, act: H.actText(), at: r }; });
check(toY.ok && toY.act === '上車 · YARIS', `walked over to YARIS on lift 1 (upper deck at the floor): 「${toY.act}」 ${toY.ok ? '' : JSON.stringify(toY.at)}`);
await drawAndShot('17-near-yaris');
const sy = await p.evaluate(() => { const D = window.__D(), H = window.__H, pressed = H.press(), b = H.board(); const D2 = window.__D(); return { pressed, modes: b.modes, toast: document.getElementById('gtoast').textContent, boarding: !!D2.boarding, drv: !!D2.drv, tripFull: D2.tripFull }; });
console.log('  上車 YARIS:', JSON.stringify(sy));
await p.waitForFunction(() => window.__D().cur === 'yaris' && window.__D().drv && !window.__D().drv.telemetry().paused, null, { timeout: 300000 });
await p.evaluate(() => window.__H.step(40));
const yl = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, t = D.drv.telemetry(), b0 = H.gw(D.GAR.spots.bays[0].x, D.GAR.spots.bays[0].z), sp = D.tripPose.supra, L = D.LODS.supra.lod.car; L.updateMatrixWorld(true); const e = L.matrixWorld.elements;
  return { cur: D.cur, S: window.__S() === D.tripS, full: D.tripS.car.parent === D.TR.scene && D.tripS.car.visible, atBay: Math.hypot(t.x - b0.x, t.z - b0.z), paused: t.paused, voice: !!D.dvoice?.alive, act2: H.act2(), yarisLod: !!D.LODS.yaris.lod.car.parent,
    supraLod: Math.hypot(e[12] - sp.x, e[14] - sp.z), supraShadow: D.LODS.supra.shadow.visible, supraDeck: L.parent === D.GAR.lifts[3].platforms[1], yarisDeck: D.DECK[0], oldHidden: !D.built.supra || !D.built.supra.car.visible || D.built.supra.car.parent !== D.TR.scene, built: Object.keys(D.built), cars: D.walker.cars.map((c) => c.key) };
});
console.log('  switched:', JSON.stringify(yl), '| lods', JSON.stringify(await lodAt()));
check(sy.pressed === '上車 · YARIS' && sy.modes.join('>') === 'in>seat>off' && /YARIS 發動中/.test(sy.toast) && yl.cur === 'yaris' && yl.S && yl.full && yl.atBay < 0.01 && !yl.paused && yl.voice && yl.act2 === '下車' && !yl.yarisLod && yl.yarisDeck === null,
  'switched cars on foot: YARIS (light-weight on lift 1) became the full car and drives off its deck; engine on; 下車 available');
check(yl.supraLod < 0.01 && yl.supraDeck && !yl.supraShadow && yl.oldHidden && yl.cars.includes('supra') && yl.cars.includes('gc8') && !yl.cars.includes('yaris'), 'SUPRA stays on the lift deck you left it on (light-weight car, the deck draws its shadow), still boardable');
await drawAndShot('18-driving-yaris');
// 直接回車庫：回到車庫頁（現在開的 YARIS），GC8、SUPRA 停在剛剛停的升降機上（2 號、4 號）
await p.evaluate(() => document.getElementById('driveHome').click());
await p.evaluate(() => { window.__hold = false; window.__noDraw = false; }); await p.waitForTimeout(2500);
const home = await p.evaluate(() => { const S = window.__S(), c = S.car, D = window.__D(), R = window.__room(); return { cls: document.body.className, car: document.getElementById('carName').textContent, parent: c.parent === window.__scene(), pos: c.position.toArray(), rot: c.rotation.y, trip: D.trip, drv: D.drv, tripPose: D.tripPose, room: R?.group.visible, sig: R?.baySig, wk: !D.walker.hud.hidden, ch: D.walker.character.group.visible,
  park: window.__G().park, gc8: D.LODS.gc8.lod.car.parent === R.lifts[1].platforms[1], supra: D.LODS.supra.lod.car.parent === R.lifts[3].platforms[1], levels: R.lifts.map((lf) => lf.level).join('') }; });
console.log('  home:', JSON.stringify(home), '| lods', JSON.stringify(await lodAt()));
const np7 = await p.evaluate(() => { const N = window.__N(); return { vis: N.g.visible, avg: +N.avg.toFixed(3), max: +N.max.toFixed(2), n: N.n, hits: N.hits, carHits: N.carHits, built: N.traffic.stats.built + N.peds.stats.built }; });
console.log('  npc (whole trip):', JSON.stringify(np7));
check(!np7.vis && np7.avg < 1.5, `back on the garage page: traffic and residents hidden; over the trip npcStep took ${np7.avg} ms a frame on average (worst ${np7.max} ms, ${np7.n} frames; phones ≈3–5× slower)`);
check(home.cls === '' && /Yaris/.test(home.car) && home.parent && home.pos.every((v) => v === 0) && home.rot === 0 && !home.trip && home.drv === null && home.tripPose === null && home.room && !home.wk && !home.ch, '直接回車庫: back on the garage page with YARIS (the car you were driving) on the turntable; walking HUD + character put away');
const la7 = await lodAt();
check(la7.gc8 === 'page' && la7.supra === 'page' && /GC8/.test(home.sig) && /SUPRA/.test(home.sig) && home.gc8 && home.supra && home.levels === '111111' && home.park?.mid === 'yaris'
  && JSON.stringify(home.park.decks) === JSON.stringify([null, 'gc8', null, 'supra', null, null, null, null, null, null, null, null]), 'the page garage shows GC8 and SUPRA on the lifts they were left on (lift 2 and 4; lift 1 is empty now: YARIS is on the turntable)');
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
await p.screenshot({ path: `${prefix}-19-home.png` }); console.log('  shot', `${prefix}-19-home.png`, el());
fi = await fsInfo();
console.log('  fullscreen (home):', JSON.stringify(fi));
check(!fi.fs && !fi.html && !fi.btn && fi.scrolls && fi.pref === 'on' && (!APP || (fi.chrome === CHROME && fi.calls.endsWith(',false'))), 'back on the garage page: normal layout restored, no fullscreen button' + (APP ? ', CaridApp.setFullscreen(false)' : ''));

// ---- 8 重新整理：新車、錢、零件都在 ----
const keep = await p.evaluate(() => ({ look: JSON.stringify(window.__G().look), money: window.__G().money, owned: [...window.__G().owned].sort().join(), cur: window.__D().cur, park: JSON.stringify(window.__G().park) }));
await p.reload({ waitUntil: 'domcontentloaded' }); await ready(); await p.waitForTimeout(1000);
const re = await p.evaluate(() => ({ look: JSON.stringify(window.__G().look), money: window.__G().money, owned: [...window.__G().owned].sort().join(), cur: window.__D().cur, parts: (window.__G().parts.gc8 || []).length, park: JSON.stringify(window.__G().park) }));
console.log('8', el(), 'reload:', JSON.stringify(keep), '→', JSON.stringify(re));
check(re.money === keep.money && re.owned === keep.owned && re.cur === 'yaris' && re.parts === 1 && re.park === keep.park && re.look === keep.look && keep.look !== 'null', 'reload keeps the new car, money, parts, the car you drove last, which lift deck each car is on and your look');

// ---- 9 再出門一次：這台停中間，其他的在上次停的升降機上；直接回車庫 ----
await p.evaluate(() => document.getElementById('driveOut').click());
await p.waitForFunction(() => window.__D().on && window.__D().walker?.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.waitForFunction(() => { const D = window.__D(), L = D.GAR.lifts; return D.LODS.gc8?.lod?.car.parent === L[1].platforms[1] && D.LODS.supra?.lod?.car.parent === L[3].platforms[1]; }, null, { timeout: 120000 });
const t9 = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, sp = D.VIL.places.garage.spawn, bays = D.GAR.spots.bays.map((b) => H.gw(b.x, b.z)), inBay = (k) => bays.findIndex((b) => Math.hypot(b.x - D.tripPose[k].x, b.z - D.tripPose[k].z) < 1e-6);
  return { cur: D.cur, main: Math.hypot(D.tripPose.yaris.x - sp.x, D.tripPose.yaris.z - sp.z), gc8: inBay('gc8'), supra: inBay('supra'), door: D.GAR.door.t, drv: !!D.drv, walk: D.walker.mode, sig: D.GAR.baySig };
});
console.log('9', el(), 'second trip:', JSON.stringify(t9));
check(t9.cur === 'yaris' && t9.main < 1e-6 && t9.gc8 === 1 && t9.supra === 3 && t9.door === 0 && !t9.drv && t9.walk === 'walk', 'next trip starts on foot again: YARIS in the middle, GC8 and SUPRA on the lift decks they were left on (lift 2, lift 4)');
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

// ---- 10 升降停車格：操作柱按升降機（7 秒、馬達聲）→ 把車開上下層停好下車 → 降下去（車子到坑裡）→ 再升上來上車；有人、有車壓著不動；停中間自己開正；
//      小房子走進去（第一人稱）睡覺；車行送車（要動升降機就直接動好、車庫滿了）；馬達聲；回車庫頁停的都記著 ----
await p.evaluate(() => document.getElementById('driveOut').click()); // 第三趟（YARIS 停中間，GC8、SUPRA 在 2 號、4 號升降機上）
await p.waitForFunction(() => window.__D().on && window.__D().walker?.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.waitForFunction(() => window.__D().walker.cars.length >= 3, null, { timeout: 120000 });
await p.evaluate(() => window.__H.step(30));
// 上一趟在超商裡面按了直接回車庫：這一趟村子的牆照樣擋人、門照樣進得去（超商那棟）
const w10 = await p.evaluate(() => { const D = window.__D(), H = window.__H, W = D.walker, t0 = W.telemetry(), b = D.VIL.buildings.find((q) => q.kind === 'store'), r = H.wallHolds(b); W.teleport({ x: t0.x, z: t0.z, heading: t0.heading }); H.step(10); return { ...r, door: W.doors.some((d) => d.ref === b) }; });
check(w10.inside === false && w10.door, `next trip after leaving from inside the store: the village walls stop you again (moved ${w10.moved} m into the store wall), its door is a door again`);
const LI = 4; // 第 5 台（z −5.55）：上下兩層都空的
const sa = await p.evaluate((i) => {
  const D = window.__D(), H = window.__H, W = D.walker, G = D.GAR, st = G.lifts[i].stand;
  const r = H.walkLocal([[-5.3, -7.3], [st.x, st.z]], { tol: 0.2 }); H.step(5);
  return { ok: r.ok, act: H.actText(), level: G.lifts[i].level, busy: G.lifts[i].busy, cur: D.cur, DECK: D.DECK.slice() };
}, LI);
console.log('10', el(), 'lift post:', JSON.stringify(sa));
check(sa.ok && sa.act === '換下面的空位' && sa.level === 1 && !sa.busy, `at lift 5's control post the big button says 「${sa.act}」`);
clash = await hudClash(); const clashLift = await sizeSweep();
check(!clash && !clashLift, `at the lift post (big 「換下面的空位」, fullscreen): nothing overlapping on any screen (${[clash, clashLift].filter(Boolean).join(' / ') || 'ok'})`);
const sb = await p.evaluate((i) => {
  const D = window.__D(), H = window.__H, G = D.GAR, lf = G.lifts[i], W = D.walker;
  const pressed = H.press(); H.step(3);
  const D2 = window.__D(), snd = !!D2.liftSnd[i]?.alive, busy = lf.busy, act = H.actText();
  const pitCol = G.colliders(false).some((c) => c.t === 'box' && Math.abs(c.x - lf.x) < 0.01 && Math.abs(c.z - lf.z) < 0.01 && c.hx > 2.7 && c.h >= 2.5);
  // 在動的時候往平台走：過不去
  const deck = H.gw(lf.x, lf.z), t0 = W.telemetry(); let inPit = 0;
  for (let n = 0; n < 90; n++) { const t = W.telemetry(), a = Math.atan2(-(deck.z - t.z), deck.x - t.x) - t.camYaw; W.setInput({ x: -Math.sin(a), y: Math.cos(a) }); H.step(1); const q = H.gl(W.telemetry().x, W.telemetry().z); if (Math.abs(q.x - lf.x) < lf.pit.hx && Math.abs(q.z - lf.z) < lf.pit.hz) inPit++; }
  W.setInput(null);
  const walked = Math.hypot(W.telemetry().x - t0.x, W.telemetry().z - t0.z);
  const back = H.walkLocal([[lf.stand.x, lf.stand.z]], { tol: 0.2 });
  let n = 0; const y0 = lf.platforms[0].position.y; for (; n < 800 && lf.busy; n++) H.step(1);
  const D3 = window.__D();
  const cam = G.cameraColliders(false).filter((c) => Math.abs(c.x - lf.x) < 0.01 && Math.abs(c.z - lf.z) < 0.01);
  const posts = G.colliders(false).filter((c) => c.t === 'box' && Math.abs(Math.abs(c.x - lf.x) - 2.63) < 0.02 && Math.abs(Math.abs(c.z - lf.z) - 1.43) < 0.02).length;
  return { pressed, snd, busy, act, pitCol, inPit, walked: +walked.toFixed(2), back: back.ok, s: +(n / 60 + 3 / 60 + 1.5 + (back.s || 0)).toFixed(2), level: lf.level, floorDeck: lf.floorDeck, y0: +y0.toFixed(3), y1: +lf.platforms[0].position.y.toFixed(3), y1u: +lf.platforms[1].position.y.toFixed(3),
    sndAfter: !!D3.liftSnd[i], act2: H.actText(), cam: cam.map((c) => [c.y0, c.h]), posts };
}, LI);
console.log('  lift up:', JSON.stringify(sb));
check(sb.pressed === '換下面的空位' && sb.busy && sb.snd && sb.act === '升降機動作中⋯' && sb.pitCol, 'pressing it starts the lift: motor sound on, the whole pit blocks people and cars while it moves, button says 升降機動作中');
check(sb.inPit === 0 && sb.back, `could not walk onto the moving lift (${sb.walked} m, 0 frames inside the pit)`);
check(sb.level === 0 && sb.floorDeck === 0 && Math.abs(sb.y1) < 1e-3 && Math.abs(sb.y1u - 2.1) < 1e-3 && !sb.sndAfter && sb.act2 === '換上面的空位' && sb.posts === 4 && sb.cam.length === 1 && sb.cam[0][0] > 1.9,
  `after ~7 s the lower deck is at the floor, the upper deck overhead at 2.1 m (4 posts block, a camera-only box above), motor sound stopped (${sb.s} s)`);
await drawAndShot('24-lift-raised');
// 走去中間那台上車 → 開到第 5 台的下層（車頭朝裡面、差一點點）→「下車」：自己開正，車子掛到平台上
const sc = await p.evaluate((i) => {
  const D = window.__D(), H = window.__H, k = D.cur;
  const r = H.walkLocal([[-5.3, -3.2], [-0.6, -2.3]]), act = H.actText(), pressed = H.press(), b = H.board(); H.step(30);
  const D2 = window.__D(), d = D2.drv;
  d.teleport(H.gw(-9.35, -5.25, Math.PI + 0.1)); window.__dstep(20);
  const t0 = d.telemetry(), q0 = H.gl(t0.x, t0.z), out = H.press2(); window.__dstep(2);
  const auto = d.telemetry().auto, act2 = H.act2();
  let n = 0; for (; n < 400 && window.__D().walker.mode !== 'walk'; n++) H.step(1);
  H.step(10);
  const D3 = window.__D(), G = D3.GAR, lf = G.lifts[i], c = D3.tripS.car; c.updateMatrixWorld(true);
  const e = c.matrixWorld.elements, w = H.gw(lf.x, lf.z), hd = window.__H.wrapA(Math.atan2(e[8], e[10]) - (Math.PI + D3.VIL.places.garage.lot.heading));
  const toast = document.querySelector('#stage .wk-toast.show')?.textContent || '';
  return { k, walked: r.ok, act, pressed, modes: b.modes, before: [+q0.x.toFixed(2), +q0.z.toFixed(2)], out, auto, act2, s: +(n / 60).toFixed(2), mode: D3.walker.mode, drv: !!D3.drv, deck: D3.DECK[6 + i], rev: D3.DREV[6 + i],
    onDeck: c.parent === lf.platforms[0], off: +Math.hypot(e[12] - w.x, e[14] - w.z).toFixed(4), hd: +hd.toFixed(4), cars: D3.walker.cars.map((x) => x.key + (x.drive ? '(parked)' : '')), toast, pose: D3.tripPose[k], voice: !!D3.dvoice,
    camYaw: +H.wrapA(D3.walker.telemetry().camYaw - (D3.tripPose[k].heading + Math.PI)).toFixed(3) };
}, LI);
console.log('  park on the lower deck:', JSON.stringify(sc));
check(sc.walked && sc.pressed === sc.act && /^上車/.test(sc.act) && sc.modes.join('>') === 'in>seat>off', `got into ${sc.k} in the middle`);
check(sc.out === '下車' && sc.auto && sc.act2 == null && sc.mode === 'walk' && !sc.drv && !sc.voice, `下車 on the deck (${JSON.stringify(sc.before)} off-centre, nose in): the car first straightens itself onto the deck, then you get out (${sc.s} s)`);
check(sc.deck === sc.k && sc.rev === 1 && sc.onDeck && sc.off < 0.01 && Math.abs(sc.hd) < 0.01 && sc.pose?.deck === 6 + LI && sc.cars.includes(sc.k) && /停好了：5 號升降機下層/.test(sc.toast),
  `${sc.k} is parked ON lift 5's lower deck (hangs on the platform, nose in, still boardable): 「${sc.toast}」`);
check(Math.abs(sc.camYaw) < 0.3, `parked nose in: the camera turns round to look into the garage, not at the back wall (${sc.camYaw} rad from facing the door)`);
// 站在升起來的上層平台底下：第三人稱鏡頭還是拉得出去（看得到人），鏡頭在平台底下（不穿過去）
const scCam = await p.evaluate((i) => {
  const D = window.__D(), H = window.__H, W = D.walker, G = D.GAR, lf = G.lifts[i]; H.step(30);
  const t = W.telemetry(), q = H.gl(t.x, t.z), cp = D.dcam.position, cq = H.gl(cp.x, cp.z);
  return { hidden: t.hidden, cd: +t.camDist.toFixed(2), under: Math.abs(q.x - lf.x) < 2.72 && Math.abs(q.z - lf.z) < 1.52, ceil: +G.ceilingAt(q.x, q.z).toFixed(2), camY: +cp.y.toFixed(2), camCeil: +G.ceilingAt(cq.x, cq.z).toFixed(2) };
}, LI);
check(scCam.under && !scCam.hidden && scCam.cd > 1.5 && scCam.camY < Math.min(scCam.ceil, scCam.camCeil) - 0.1,
  `standing under the raised upper deck (${scCam.ceil} m overhead): the follow camera still pulls out behind you (${scCam.cd} m, you are visible) and stays below the deck (camera at ${scCam.camY} m)`);
await drawAndShot('25-parked-on-lift');
// 降下去：車子跟著平台到坑裡（看不到、走不到）
const sd = await p.evaluate((i) => {
  const D = window.__D(), H = window.__H, G = D.GAR, lf = G.lifts[i], k = D.cur;
  const r = H.walkLocal([[-9.8, -3.0], [-6.2, -3.0], [-6.2, -7.4], [lf.stand.x, lf.stand.z]], { tol: 0.2 }); H.step(3); const act = H.actText(), pressed = H.press(); H.step(3);
  const moving = { busy: lf.busy, cars: window.__D().walker.cars.map((x) => x.key) };
  let n = 0; for (; n < 800 && lf.busy; n++) H.step(1);
  H.step(5); const done = document.querySelector('#stage .wk-toast.show')?.textContent || '';
  const c = window.__D().tripS.car, w = c.getWorldPosition(c.position.clone());
  return { walked: r.ok, act, pressed, moving, level: lf.level, y: +w.y.toFixed(3), lowerVisible: lf.platforms[0].visible, cars: window.__D().walker.cars.map((x) => x.key), act2: H.actText(), k, done };
}, LI);
console.log('  lift down:', JSON.stringify(sd));
check(sd.walked && sd.pressed === '換上面的空位' && sd.moving.busy && !sd.moving.cars.includes(sd.k) && sd.level === 1 && sd.y < -2 && !sd.lowerVisible && !sd.cars.includes(sd.k) && sd.act2 === '換下面的車' && sd.done === '5 號升降機好了：空的平台可以停車',
  `lowered: ${sd.k} went down into the pit with its deck (y ${sd.y}, not drawn, not boardable); the button now says 「${sd.act2}」`);
// 有人站在平台上：不動
const se = await p.evaluate((i) => {
  const D = window.__D(), H = window.__H, G = D.GAR, lf = G.lifts[i], W = D.walker, back = W.telemetry();
  W.teleport(H.gw(lf.x + 1.2, lf.z + 0.4, 0)); H.step(5); D.runLift(i); H.step(2);
  const toast = document.querySelector('#stage .wk-toast.show')?.textContent || '', busy = lf.busy;
  W.teleport({ x: back.x, z: back.z, heading: back.heading }); H.step(5);
  return { toast, busy };
}, LI);
check(!se.busy && /站在升降機上/.test(se.toast), `a person standing on the deck: the lift does not move (「${se.toast}」)`);
// 升上來 → 走過去上車：從平台開下來
const sf = await p.evaluate((i) => {
  const D = window.__D(), H = window.__H, G = D.GAR, lf = G.lifts[i], k = D.cur;
  const pressed = H.press(); H.step(3); let n = 0; for (; n < 800 && lf.busy; n++) H.step(1); H.step(5);
  const cars = window.__D().walker.cars.map((x) => x.key), done = document.querySelector('#stage .wk-toast.show')?.textContent || '';
  const r = H.walkLocal([[-6.2, -7.4], [-6.2, -3.0], [-9.2, -3.0], [-9.2, -3.9]], { tol: 0.25 }); H.step(3); const act = H.actText(), p2 = H.press(), b = H.board(); H.step(30);
  const D2 = window.__D(), t = D2.drv?.telemetry(), w = H.gw(lf.x, lf.z);
  return { pressed, level: lf.level, cars, done, walked: r.ok, at: r, act, p2, modes: b.modes, drv: !!D2.drv, paused: t?.paused, off: t && +Math.hypot(t.x - w.x, t.z - w.z).toFixed(3), deck: D2.DECK[6 + i], parent: D2.tripS.car.parent === D2.TR.scene, voice: !!D2.dvoice?.alive, k };
}, LI);
console.log('  lift up again + get in:', JSON.stringify(sf));
check(sf.pressed === '換下面的車' && sf.level === 0 && sf.cars.includes(sf.k) && sf.done === `${sf.k.toUpperCase()} 升上來了，走過去按「上車」`, `raised again: ${sf.k} came back up to the floor and can be boarded (「${sf.done}」)`);
check(sf.walked && sf.p2 === `上車 · ${sf.k.toUpperCase()}` && sf.modes.join('>') === 'in>seat>off' && sf.drv && !sf.paused && sf.off < 0.01 && sf.deck === null && sf.parent && sf.voice,
  `walked to the lower car and got in: it drives off the deck from where it was parked (deck free again) ${sf.walked ? '' : JSON.stringify(sf.at)}`);

// 車子停在坑上（沒停上平台、沒掛在升降機上）：升降機不動
const sg = await p.evaluate((i) => {
  const D = window.__D(), H = window.__H, G = D.GAR, lf = G.lifts[i];
  D.drv.teleport(H.gw(-6.9, lf.z, Math.PI)); window.__dstep(20);
  const out = H.press2(); let n = 0; for (; n < 300 && window.__D().walker.mode !== 'walk'; n++) H.step(1); H.step(10);
  const D2 = window.__D(), W = D2.walker; W.teleport(H.gw(lf.stand.x, lf.stand.z, 0)); H.step(5);
  const act = H.actText(), pressed = H.press(); H.step(2);
  const toast = document.querySelector('#stage .wk-toast.show')?.textContent || '';
  return { out, mode: W.mode, drv: !!D2.drv, deck: D2.tripPose[D2.cur].deck ?? null, act, pressed, toast, busy: lf.busy, level: lf.level, snd: !!window.__D().liftSnd[i] };
}, LI);
console.log('  car over the pit:', JSON.stringify(sg));
check(sg.out === '下車' && sg.mode === 'walk' && sg.drv && sg.deck === null && sg.pressed === '換上面的空位' && !sg.busy && !sg.snd && sg.level === 0 && /壓在升降機上：先開走/.test(sg.toast),
  `a car standing over the pit but not parked on the deck: the lift does not move (「${sg.toast}」)`);
// 走回去上車 → 開到中間（差一點點、歪一點點）→「下車」：自己開正停在中間
const sh = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, k = D.cur;
  const r = H.walkLocal([[-6.0, -6.95]], { tol: 0.25 }); H.step(3);
  const act = H.actText(), pressed = H.press(), b = H.board(); H.step(20);
  const d = window.__D().drv;
  d.teleport(H.gw(0.45, 0.35, 0.18)); window.__dstep(20);
  const out = H.press2(); window.__dstep(2); const auto = d.telemetry().auto;
  let n = 0; for (; n < 400 && window.__D().walker.mode !== 'walk'; n++) H.step(1); H.step(10);
  const D3 = window.__D(), p = D3.tripPose[k], q = H.gl(p.x, p.z), c = D3.tripS.car, sp = D3.VIL.places.garage.spawn;
  return { k, walked: r.ok, act, pressed, modes: b.modes, out, auto, s: +(n / 60).toFixed(2), mode: D3.walker.mode, local: [+q.x.toFixed(3), +q.z.toFixed(3)], dh: +H.wrapA(p.heading - sp.heading).toFixed(4),
    mid: D3.midCar(), carAt: +Math.hypot(c.position.x - sp.x, c.position.z - sp.z).toFixed(4), deck: p.deck ?? null, park: window.__G().park?.mid };
});
console.log('  park in the middle:', JSON.stringify(sh));
check(sh.walked && /^上車/.test(sh.pressed) && sh.modes.join('>') === 'in>seat>off' && sh.out === '下車' && sh.auto && sh.mode === 'walk' && sh.carAt < 0.01 && Math.abs(sh.dh) < 0.01 && sh.mid === sh.k && sh.deck === null && sh.park === sh.k,
  `下車 a little off the middle spot: ${sh.k} straightens itself onto the turntable spot (${sh.s} s), then you get out; saved as the middle car`);
// 小房子「大便龍的家」：走進門（自動換第一人稱、鏡頭頭上有斜天花板）→ 床邊「睡覺」
const si = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, G = D.GAR, S = G.spots, B = G.zones.bedSide;
  const t0 = W.telemetry(), q0 = H.gl(t0.x, t0.z), pre = q0.z > 0 ? [[3.0, 1.9], [3.0, -2.2]] : [[q0.x, -1.9]];
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
  const r = H.walkLocal([[1.2, -9.3], [3.3, -9.35], [3.35, -10.1]], { tol: 0.2 }); H.step(5);
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
// 車行送車（你在車店看不到）：跟地板平的平台都滿了 → 直接把升降機動好（不用等 7 秒、沒有聲音）停到空的那層；那台升降機上面壓著車就換一台；13 格都滿了＝「車庫滿了」
const sm = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, G = D.GAR, ex = D.VIL.places.dealer.exit, fill = [], out = {};
  const put = (all) => { for (const lf of G.lifts) for (const dk of all ? [0, 1] : [lf.floorDeck]) { const id = dk ? lf.id : 6 + lf.id; if (!D.DECK[id] && !lf.cars[dk]) { lf.put(dk, 'TEST'); fill.push([lf.id, dk]); } } };
  const away = (k) => { D.offDeck(k); D.tripPose[k] = { x: ex.x, z: ex.z, heading: ex.heading }; }; // 開去車店了
  const snap = () => ({ levels: G.lifts.map((lf) => lf.level).join(''), busy: G.lifts.some((lf) => lf.busy), snd: Object.keys(window.__D().liftSnd).length });
  const k1 = D.DECK.find((k) => k && k !== D.cur), k2 = D.DECK.find((k) => k && k !== D.cur && k !== k1);
  out.k = [k1, k2]; out.before = snap();
  away(k1); put(false);
  const m1 = D.deliver(k1, k1.toUpperCase()), id1 = D.DECK.indexOf(k1), L1 = D.LODS[k1].lod.car, lf1 = G.lifts[id1 % 6], dk1 = id1 < 6 ? 1 : 0;
  out.one = { msg: m1, id: id1, ...snap(), onDeck: L1.parent === lf1.platforms[dk1], floor: lf1.floorDeck === dk1, cars: window.__D().walker.cars.map((c) => c.key) };
  // 第二台：第一個要動的那台（1 號）上面壓著車（中間那台的位置先假裝擋到它）→ 換下一台
  const mid = D.tripPose[D.cur], a0 = G.lifts[0]; away(k2); put(false);
  const block = H.gw(a0.x + 2.6, a0.z, 0); D.tripPose[D.cur] = { x: block.x, z: block.z, heading: block.heading };
  const m2 = D.deliver(k2, k2.toUpperCase()), id2 = D.DECK.indexOf(k2);
  D.tripPose[D.cur] = mid;
  out.two = { msg: m2, id: id2, ...snap(), l0: a0.level };
  // 13 格都滿了
  away(k2); put(true);
  const m3 = D.deliver(k2, k2.toUpperCase());
  out.full = { msg: m3, deck: D.tripPose[k2].deck ?? null };
  for (const [li, dk] of fill) G.lifts[li].take(dk);
  const m4 = D.deliver(k2, k2.toUpperCase()); out.again = { msg: m4, id: D.DECK.indexOf(k2) };
  H.step(5);
  out.decks = window.__D().DECK.slice(); out.park = window.__G().park.decks.slice();
  return out;
});
console.log('  dealer deliveries:', JSON.stringify(sm));
check(sm.one.id >= 0 && sm.one.onDeck && sm.one.floor && !sm.one.busy && sm.one.snd === 0 && sm.one.levels !== sm.before.levels && new RegExp(`${sm.k[0].toUpperCase()} 車行幫你送回車庫了：\\d 號升降機[上下]層`).test(sm.one.msg),
  `delivered while every floor-level deck was taken: the lift was moved at once (no 7 s, no motor sound; ${sm.before.levels} → ${sm.one.levels}) and the car put on the free deck: 「${sm.one.msg}」`);
check(sm.two.id === 7 && sm.two.l0 === 1 && /2 號升降機下層/.test(sm.two.msg), `a car standing over lift 1's pit: the delivery used the next lift instead (「${sm.two.msg}」)`);
check(/^車庫滿了/.test(sm.full.msg) && sm.full.deck === null && sm.again.id >= 0, `all 13 places taken: 「${sm.full.msg}」; with room again it goes on a deck (「${sm.again.msg}」)`);
check(JSON.stringify(sm.decks) === JSON.stringify(sm.park), 'the deck layout is saved as it changes');
// 升降機的馬達聲（OfflineAudioContext 算出來）：開鎖「喀」→ 馬達嗡嗡（有聲音）→ 停：落鎖「喀」→ 安靜
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
  `lift motor sound: unlock clunk ${sn.clunk}, quiet ${sn.gap}, motor hum ${sn.hum}, lock clunk ${sn.lock}, then silence ${sn.after} (peak ${sn.peak})`);
// 直接回車庫：升降機上停的都記著（下一趟、重新整理都還在）
const sp10 = await p.evaluate(() => ({ decks: window.__D().DECK.slice(), cur: window.__D().cur }));
await p.evaluate(() => document.getElementById('driveHome').click());
await p.evaluate(() => { window.__hold = false; window.__noDraw = false; }); await p.waitForTimeout(1500);
const hm10 = await p.evaluate(() => { const R = window.__room(), G = window.__G(), D = window.__D(); return { trip: D.trip, park: G.park, levels: R?.lifts.map((lf) => lf.level).join(''), saved: JSON.parse(localStorage.getItem('carid.tune')).park, cam: window.__cam() }; });
console.log('  home:', JSON.stringify(sp10), '→', JSON.stringify(hm10));
check(!hm10.trip && hm10.park.mid === sp10.cur && sp10.decks.every((k, i) => k === hm10.park.decks[i]) && JSON.stringify(hm10.saved.decks) === JSON.stringify(hm10.park.decks),
  'back on the garage page: every car stays on the deck it was left on (saved on the phone)');

// ---- 11 車庫頁：車子多了（7 台）：舊存檔（沒有 park）照價錢停六台的上層（跟以前一樣）；有車停在下層 → 那台升降機升起來（下層在地上、上層在頭上：兩台都看得到），鏡頭最遠 7 公尺 ----
const ALL7 = ['gc8', 'yaris', 'supra', 'gtr', 'p918', 'sp3', 'jesko'];
async function page7(park) { // 存檔換成 7 台（cur＝GC8）、重新整理，等 6 台輕量車都載好
  await p.waitForTimeout(800); // 頁面還沒存的（300 毫秒）先存完，才不會蓋掉
  await p.evaluate(([own, park]) => localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 5, owned: own, parts: {}, tyres: {}, wins: {}, cars: {}, ...(park ? { park } : {}) })), [ALL7, park]);
  await p.reload({ waitUntil: 'domcontentloaded' }); await ready();
  await p.waitForFunction((ks) => ks.every((k) => window.__D().LODS[k]?.lod), ALL7.slice(1), { timeout: 300000 }); await p.waitForTimeout(1000);
  return p.evaluate((ks) => {
    const R = window.__room(), G = window.__G(), D = window.__D();
    const where = (k) => { const o = D.LODS[k]?.lod?.car; for (const lf of R.lifts) for (const d of [0, 1]) if (o && o.parent === lf.platforms[d]) { o.updateMatrixWorld(true); const e = o.matrixWorld.elements; return [lf.id, d, +e[13].toFixed(2), o.visible && lf.platforms[d].visible]; } return null; };
    return { cur: D.cur, park: G.park, levels: R.lifts.map((lf) => lf.level).join(''), at: Object.fromEntries(ks.map((k) => [k, where(k)])), cam: window.__cam(), sig: R.baySig, main: window.__S()?.car.position.toArray() };
  }, ALL7.slice(1));
}
const s11a = await page7(null);
console.log('11', el(), '7 cars, old save (no park):', JSON.stringify(s11a));
check(s11a.cur === 'gc8' && JSON.stringify(s11a.park.decks) === JSON.stringify(['yaris', 'supra', 'gtr', 'p918', 'sp3', 'jesko', null, null, null, null, null, null]) && s11a.levels === '111111'
  && ALL7.slice(1).every((k, i) => JSON.stringify(s11a.at[k]) === JSON.stringify([i, 1, 0, true])) && !Number.isFinite(s11a.cam.camCap) && Math.abs(s11a.cam.maxD - s11a.cam.fitD * 1.4) < 1e-6,
  `old save with 7 cars: GC8 on the turntable, the other 6 on the six top decks by price (${s11a.park.decks.slice(0, 6).join(', ')}), no lift raised, camera as before (max ${s11a.cam.maxD.toFixed(2)} m)`);
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
await p.screenshot({ path: `${prefix}-30-page-7-cars.png` }); console.log('  shot', `${prefix}-30-page-7-cars.png`, el());
// JESKO 停在 1 號的下層（出門的時候停上去的）→ 車庫頁：1 號升起來，YARIS 在頭上、JESKO 在地上
const s11b = await page7({ mid: 'gc8', decks: ['yaris', 'supra', 'gtr', 'p918', 'sp3', null, 'jesko', null, null, null, null, null], rev: [] });
console.log('  JESKO on lift 1 lower deck:', JSON.stringify(s11b));
check(s11b.levels === '011111' && JSON.stringify(s11b.at.yaris) === JSON.stringify([0, 1, 2.1, true]) && JSON.stringify(s11b.at.jesko) === JSON.stringify([0, 0, 0, true]) && ['supra', 'gtr', 'p918', 'sp3'].every((k, i) => JSON.stringify(s11b.at[k]) === JSON.stringify([i + 1, 1, 0, true])),
  'a lift holding two cars is shown raised: the lower car (JESKO) at the floor, the upper car (YARIS) overhead at 2.1 m, both drawn; the other lifts as before');
check(s11b.cam.camCap === 7 && Math.abs(s11b.cam.maxD - 7) < 1e-6 && s11b.cam.dist <= 7.001, `with a raised lift the orbit camera is capped at 7 m (was ${(s11b.cam.fitD * 1.4).toFixed(2)}; now ${s11b.cam.dist.toFixed(2)} m)`);
const orb = await p.evaluate(() => { // 轉一圈、拉到最遠：鏡頭不會跑到升起來的平台底下
  const c = window.__camera(), ctl = window.__controls(), T = ctl.target, R = window.__room(), lf = R.lifts[0], p0 = c.position.clone(); let maxD = 0, minX = Infinity, under = 0, n = 0;
  for (let a = 0; a < 24; a++) for (const e of [0.12, 0.5, 1.0]) {
    const az = (a / 24) * Math.PI * 2; c.position.set(T.x + Math.cos(az) * Math.cos(e) * 40, T.y + Math.sin(e) * 40, T.z + Math.sin(az) * Math.cos(e) * 40); ctl.update(); n++;
    const q = c.position; maxD = Math.max(maxD, q.distanceTo(T)); minX = Math.min(minX, q.x);
    if (Math.abs(q.x - lf.x) < lf.pit.hx && Math.abs(q.z - lf.z) < lf.pit.hz && q.y < 2.3) under++;
  }
  c.position.copy(p0); ctl.update();
  return { n, maxD: +maxD.toFixed(3), minX: +minX.toFixed(2), under };
});
console.log('  orbit:', JSON.stringify(orb));
check(orb.maxD <= 7.001 && orb.under === 0 && orb.minX > -7.08, `orbiting all the way round at full zoom-out (${orb.n} positions): at most ${orb.maxD} m away, never under the raised deck (camera x ≥ ${orb.minX}, deck edge −7.08)`);
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
await p.screenshot({ path: `${prefix}-31-page-raised-lift.png` }); console.log('  shot', `${prefix}-31-page-raised-lift.png`, el());
// 從車頭前面看過去：車子後面就是升起來的 1 號（JESKO 在地上、YARIS 在頭上）
await p.evaluate(() => { const c = window.__camera(), ctl = window.__controls(); ctl.autoRotate = false; const T = ctl.target; c.position.set(T.x + 6.66, T.y + 0.95, T.z + 1.79); ctl.update(); });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${prefix}-32-page-lifts.png` }); console.log('  shot', `${prefix}-32-page-lifts.png`, el());
await p.evaluate(() => { window.__controls().autoRotate = true; });

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
await p.waitForFunction(() => window.__D().walker.cars.length >= 3, null, { timeout: 120000 });
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
