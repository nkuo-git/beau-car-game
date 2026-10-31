// 第 60 批：公寓的家（apt.js、interiors.js kind 'apt'、town.src.js APTU）：6 個家旁邊各一棟 5 層公寓；走進大門 → 1 樓大廳 → 站進電梯出面板 → 4 樓你的家（客廳、房間、廚房、廁所、玄關）
//   床邊「睡覺」（躺下、黑掉、醒來在床邊）、衣櫃前面「換衣服」；客廳的落地門走到陽台（真的在外面：高度 9.9、女兒牆擋人、看得到街上）、回客廳；電梯按「頂樓」（高度 16.5、女兒牆擋人）、走回 5 樓；
//   1 樓走出大門回到街上；山頂那座蓋在山頂的高度；draw calls
// node apt-test.mjs [prefix]
// node test-b1.mjs [prefix]（截圖：<prefix>-1-page.png …）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = 'apt'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__R = () => race; window.__G = () => GAME; window.__S = () => S; window.__snd = () => snd; window.__room = () => room; window.__scene = () => scene; window.__controls = () => controls;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }); window.__renderer = () => renderer;'
  + ' window.__money = (n) => { GAME.money = n; save(true); renderWallet(); renderOptions(); refreshCarBtns(); };'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, dvoice, trip, tripS, home, bayLock, snooze, TR, LODS, camGo, cur, built, walker, tripPose, tripFull, boarding, room, liftAnim,'
  + '   TWR, EL, PW, elWho, elFree, poseF, padCars, sleep, gcam, liftSnd, deliver, offTower, normPark, CABIN_EYE, setDest, CARS, PERF, TOWER_BAYS, towerFy, TOWER });'
  + ' window.__HOME = () => HOME; window.__N = () => NPC; window.__NMAX = () => NPC_MAX;'
  + ' window.__pol = () => (typeof police !== "undefined" ? police : null);' // 第 3 批（b3-int）：警察（撞人的測試以後把星星清掉：警察的部分在 test-b3.mjs）
  + ' window.__IN = () => ({ indoor, doorFade, HOUSE_WARM, interiorFor, buildInterior, DEALER_DOOR });'
  + ' window.__APT = () => ({ APTU, A: APTU.A, aptLotOf, APT, aptW });'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } else if (window.__npcKeep) { NPC = window.__npcKeep; window.__npcKeep = null; NPC.g.visible = DRIVE.on; } };'
  + ' window.__look = () => LOOKP; window.__cam = () => ({ maxD: controls.maxDistance, fitD, dist: camera.position.distanceTo(controls.target), pos: camera.position.toArray() }); window.__cea = createEngineAudio; window.__camera = () => camera;'
  + ' window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };'
  + ' window.__box = (o) => new THREE.Box3().setFromObject(o); window.__GH = () => GH; window.__ghostUnpack = (g) => ghostUnpack(g); window.__ghostAt = (G, t, o) => ghostAt(G, t, o);' // 鬼影車排行榜（ghost.src.js）
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
async function drawAndShot(name, fullPage = false) { // 畫兩格再截圖（開車、走路停住的時候畫的是現在的樣子）
  const n0 = await p.evaluate(() => { window.__noDraw = false; return window.__dframes || 0; });
  await p.waitForFunction((n) => (window.__dframes || 0) >= n + 2, n0, { timeout: 300000 });
  await p.evaluate(() => { window.__noDraw = true; });
  await p.screenshot({ path: `${prefix}-${name}.png`, fullPage });
  console.log('  shot', `${prefix}-${name}.png`, JSON.stringify(await p.evaluate(() => window.__rinfo())), el());
}
// ---- 全螢幕（主幹的，Nick：「可以全螢幕」）：出門（走路、開車）、比賽蓋滿整個螢幕；改車廠、車店照舊可以捲；回車庫頁恢復 ----
//   APP：test-app-b1.mjs（App 裡）才有 App 的標題、切換、分頁、外殼（假的 CaridApp.setFullscreen 記下收到的 true／false）
const APP = typeof repo !== 'undefined';
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
// 畫面上的按鈕：開車的 HUD（多了「下車」）、走路的 HUD（搖桿、上車／叫電梯／睡覺的大按鈕、小地圖、換視角、右下角的圓按鈕）、疊在畫面上的去哪裡／直接回車庫／聲音、
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
    return { shown: true, btns: b.map((x) => x.textContent.replace(/^(\dF|B\d)/, '$1 ').replace(/\s+/g, ' ').trim()), on: b.filter((x) => x.classList.contains('on')).map((x) => x.textContent.slice(0, 2)).join(), row: vis(e.querySelector('.elr')) }; };
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

// 頂樓、陽台回裡面的門（walker.doors 只有這一扇）：站到門外 0.85 公尺（陽台只有 1.4 公尺深：toDoor 的 2 公尺會站到欄杆外面）朝門推到黑掉
const toBack = () => p.evaluate(() => { const H = window.__H, W = window.__D().walker, d = W.doors[0]; if (!d) return { none: true }; const nx = -Math.sin(d.ry), nz = -Math.cos(d.ry), tx = Math.cos(d.ry), tz = -Math.sin(d.ry), dir = Math.atan2(-nz, nx); W.teleport({ x: d.ax - nx * 0.5 + tx * 2.3, z: d.az - nz * 0.5 + tz * 2.3, heading: dir }); H.step(10); const wk = H.walkTo(d.ax - nx * 0.5, d.az - nz * 0.5, { tol: 0.25 }); // 門的範圍很淺（整個陽台都在裡面）：傳送到門的旁邊（範圍外面），走過去再推（傳送進範圍裡面的門不觸發：walk.js armDoors）
  let n = 0; for (; n < 240 && !window.__IN().doorFade; n++) { const t = W.telemetry(), a = dir - t.camYaw; W.setInput({ x: -Math.sin(a) * 0.7, y: Math.cos(a) * 0.7 }); H.step(1); } W.setInput(null); return { s: +(n / 60).toFixed(2), fade: !!window.__IN().doorFade, walked: wk.ok, az: +d.az.toFixed(2), ax: +d.ax.toFixed(2) }; });
const doorDone = async () => { for (let i = 0; i < 900; i++) { if (!(await p.evaluate(() => { window.__H.step(2); return !!window.__IN().doorFade; }))) return i; } return -1; };
const inInfo = () => p.evaluate(() => window.__H.inInfo());
// ---- 1 出門（走路，圓塔一樓）：6 座公寓都在、外殼 5 個 InstancedMesh、山頂那座在山頂的高度 ----
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker, null, { timeout: 300000 });
await p.evaluate(() => { window.__noDraw = true; window.__H.step(30); });
const a1 = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, X = window.__APT(), HM = window.__HOME(), SL = V.places.garst.slots, apts = V.buildings.filter((b) => b.kind === 'apt');
  const ext = D.TR.scene.children.filter((o) => /^apt-/.test(o.name)), mine = apts.find((b) => b.slot === HM.slot);
  const mats = ext.map((m) => { const M = new (m.matrix.constructor)(); m.getMatrixAt(1, M); return +M.elements[13].toFixed(2); });
  const cols = V.colliders.filter((c) => c.t === 'box' && c.noCrush && Math.abs(c.hx - 6) < 0.01 && Math.abs(c.hz - 7.5) < 0.01);
  const L = X.aptLotOf(V.homeSites[mine.slot], mine.slot), tower = SL[mine.slot];
  const dT = Math.hypot(mine.x - tower.x, mine.z - tower.z), lx = (mine.x - tower.x) * Math.cos(tower.ry) - (mine.z - tower.z) * Math.sin(tower.ry);
  return { n: apts.length, names: apts.map((b) => b.name), ext: ext.map((o) => `${o.name}:${o.count}`), y2: apts.find((b) => b.slot === 1)?.y, slotY: SL[1].y, matY: mats, cols: cols.length, mine: { x: +mine.x.toFixed(2), z: +mine.z.toFixed(2), rot: +mine.rot.toFixed(3), h: mine.h, door: mine.door }, lot: { x: +L.x.toFixed(2), z: +L.z.toFixed(2), heading: +L.heading.toFixed(3) }, dT: +dT.toFixed(2), lx: +lx.toFixed(2), slot: HM.slot, walker: D.walker.mode, tris: X.A?.tris };
});
console.log('1', el(), JSON.stringify(a1));
check(a1.n === 6 && a1.names.every((n) => /的公寓$/.test(n)) && a1.ext.length === 5 && a1.ext.every((s) => /:6$/.test(s)) && a1.cols === 6, `6 apartments (one per home, kind 'apt', ${a1.names.join('、')}), shells are 5 InstancedMesh × 6, 6 solid footprint colliders`);
check(a1.y2 > 90 && Math.abs(a1.y2 - a1.slotY) < 1e-6 && a1.matY.every((y) => Math.abs(y - a1.y2) < 0.01), `the 山頂 apartment sits at the summit height (${a1.y2} m) like its tower`);
check(Math.abs(a1.mine.x - a1.lot.x) < 1e-6 && Math.abs(a1.mine.z - a1.lot.z) < 1e-6 && Math.abs(a1.mine.rot - a1.lot.heading) < 1e-6 && a1.dT > 24 && a1.dT < 28 && a1.lx > 2 && a1.lx < 6 && a1.walker === 'walk', `my apartment is ${a1.dT} m beside my tower (home ${a1.slot + 1}), facing the same street (${a1.lx} m toward the door line); I start on foot in the tower`);
// 走到公寓門口（村子的門：walker.doors 裡 kind 'apt' 那扇）→ 推進去 → 黑掉 → 1 樓大廳
const d1 = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, HM = window.__HOME(), X = window.__IN();
  const d = W.doors.find((q) => q.ref?.kind === 'apt' && q.ref.slot === HM.slot); if (!d) return { none: true, doors: W.doors.filter((q) => q.ref?.kind === 'apt').length };
  window.__ad = d.ref; const dist0 = W.cameraDist, r = H.toDoor(d), info = X.interiorFor(d.ref);
  return { ...r, name: info?.name, floors: info?.floors, dist0 };
});
const f1 = await doorDone(); const i1 = await inInfo();
console.log('  into the apartment:', JSON.stringify(d1), 'fade frames', f1 * 2, '→', JSON.stringify(i1));
check(!d1.none && d1.fade && i1.in && i1.kind === 'apt' && i1.floors === 5 && i1.floor === 0 && i1.name === d1.name && i1.mode === 'walk' && !i1.paused && i1.hud && i1.mine && i1.doors && !i1.fadeShown,
  `pushed into the apartment door (${d1.s} s): inside 「${i1.name}」 (5 floors), 1F lobby, walking HUD, its own scene; built in ${i1.info?.ms} ms`);
await drawAndShot('1-lobby');
const r1 = await p.evaluate(() => window.__rinfo());
check(r1.calls < 60, `lobby: ${r1.calls} draw calls / ${r1.tris} triangles`);
const lob = await p.evaluate(() => { const I = window.__IN().indoor.I, F = I.floors[0]; return { rooms: F.rooms.map((r) => r.name), lift: !!I.lift, label: F.label, exits: F.exits.map((e) => e.to) }; });
console.log('  1F:', JSON.stringify(lob));
check(lob.rooms.includes('大廳') && lob.lift && lob.exits.includes('outside') && lob.exits.filter((e) => e === 1).length >= 1, `1F has the lobby, the lift and the stairs up (exits: ${lob.exits.join(',')})`);
// ---- 2 電梯：站進去 → 面板（4F 5F 頂樓／1F 2F 3F，1F 亮）→ 按 4F → 黑掉 → 4 樓（玄關）----
const e1 = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, I = window.__IN().indoor.I, L = I.lift;
  W.teleport({ x: L.x, z: L.z, heading: L.rot }); H.step(40);
  const P = H.elPanel(), apt = !!document.querySelector('#stage .elpanel.apt:not([hidden])');
  const out = { ...P, apt };
  W.teleport({ x: L.x + 3 * Math.sin(L.rot + Math.PI / 2), z: L.z + 3 * Math.cos(L.rot + Math.PI / 2), heading: L.rot }); H.step(20); out.away = H.elPanel().shown; // 走出電梯：面板收起來
  W.teleport({ x: L.x, z: L.z, heading: L.rot }); H.step(20); out.back = H.elPanel().shown;
  out.clicked = H.elClick('4F'); return out;
});
const f2 = await doorDone(); const i2 = await inInfo();
console.log('  lift:', JSON.stringify(e1), '→', JSON.stringify(i2));
check(e1.shown && e1.apt && e1.btns.join() === '4F,5F,頂樓,1F,2F,3F' && e1.on === '1F' && !e1.row && !e1.away && e1.back && e1.clicked === '4F' && f2 >= 0 && i2.in && i2.floor === 3 && i2.mode === 'walk' && !i2.paused && i2.doors,
  `standing in the lift shows the apartment panel (4F 5F 頂樓 / 1F 2F 3F, 1F lit; gone when you step out); 4F → fade → 4 樓 「${i2.toast}」`);
const fl4 = await p.evaluate(() => { const I = window.__IN().indoor.I, F = I.floors[3]; return { rooms: F.rooms.map((r) => r.name), exits: F.exits.map((e) => e.to), sleep: I.spots.sleep?.length, dress: I.spots.dress?.length, label: F.label }; });
console.log('  4F:', JSON.stringify(fl4));
check(['玄關', '客廳', '房間', '廚房', '廁所'].every((r) => fl4.rooms.includes(r)) && fl4.exits.includes('balc') && fl4.sleep === 1 && fl4.dress === 1, `4F is my flat: ${fl4.rooms.join('、')}; a balcony door, a bed and a wardrobe`);
await drawAndShot('2-flat');
// 走來走去（4 樓每一間）：不卡進牆、家具，鏡頭不穿天花板、不出房子
const hw = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, I = window.__IN().indoor.I; let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const B = I.bounds, inB = (x, z, m) => { const dx = x - B.x, dz = z - B.z, c = Math.cos(B.rot), s = Math.sin(B.rot); return Math.abs(dx * c - dz * s) <= B.hx + m && Math.abs(dx * s + dz * c) <= B.hz + m; };
  W.setDoors(null); const bad = []; let frames = 0;
  for (const room of I.rooms) {
    W.teleport({ x: room.probe.x, z: room.probe.z, heading: r() * 6.28 }); H.step(3); let a = r() * 6.28;
    for (let i = 0; i < 120; i++) {
      if (i % 40 === 0) { a = r() * 6.28; if (r() < 0.4) W.setCamera({ yaw: r() * 6.28, pitch: -0.2 + r() * 1.1 }); }
      const t = W.telemetry(), rel = a - t.camYaw, m = 0.5 + r() * 0.5; W.setInput({ x: -Math.sin(rel) * m, y: Math.cos(rel) * m, run: i % 60 > 40 }); H.step(1); frames++;
      const q = D.dcam.position, b = H.checkFrame(I.colliders);
      if (q.y > I.camera.ceiling + 0.02) b.push(`camera above the ceiling (${q.y.toFixed(2)} > ${I.camera.ceiling})`);
      if (!inB(q.x, q.z, 0.05)) b.push('camera outside the flat');
      if (b.length && bad.length < 8) bad.push(`${room.name} f${i}: ${b.join('; ')}`);
    }
  }
  W.setInput(null); W.setDoors(I.exits.map((e) => e.door));
  return { rooms: I.rooms.length, frames, bad };
});
console.log('  walk 4F:', JSON.stringify(hw));
check(hw.bad.length === 0, `walking around every room on 4F (${hw.rooms} rooms, ${hw.frames} frames): never stuck in a wall or furniture, camera never through the ceiling${hw.bad.length ? ': ' + hw.bad.join(' / ') : ''}`);
// ---- 3 床邊「睡覺」：躺下、黑掉、醒來在床邊；衣櫃前面「換衣服」 ----
const sl = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, I = window.__IN().indoor.I, s = I.spots.sleep[0], c = Math.cos(s.heading), d = -Math.sin(s.heading);
  W.teleport({ x: s.x - c * 1.5, z: s.z - d * 1.5, heading: s.heading }); H.step(20);
  const act = H.actText(), pressed = H.press(); H.step(12);
  const f = document.querySelector('#stage .sleep-fade'), ch = W.character.group;
  const o = { act, pressed, sleep: !!window.__D().sleep, mode: W.mode, op: f ? +f.style.opacity : null, hud: H.visible('#stage .wk'), y: +ch.position.y.toFixed(2), vis: ch.visible, onBed: +Math.hypot(ch.position.x - s.x, ch.position.z - s.z).toFixed(2) };
  let n = 0; for (; n < 600 && !window.__D().sleep?.woke; n++) H.step(1);
  o.toast = document.querySelector('#stage .wk-toast.show')?.textContent || ''; for (let k = 0; k < 120 && window.__D().sleep; k++) H.step(1);
  const t = W.telemetry(); o.awake = { mode: W.mode, in: !!window.__IN().indoor, floor: window.__IN().indoor?.I.floor, near: +Math.hypot(t.x - s.x, t.z - s.z).toFixed(2), act: H.actText(), sleep: !!window.__D().sleep };
  return o;
});
console.log('  睡覺:', JSON.stringify(sl));
check(sl.act === '睡覺' && sl.pressed === '睡覺' && sl.sleep && sl.mode === 'off' && sl.op > 0.05 && !sl.hud && sl.vis && sl.onBed < 1.2 && sl.y > 0.3 && sl.y < 0.9 && sl.toast === '睡飽了！' && sl.awake.mode === 'walk' && sl.awake.in && sl.awake.floor === 3 && sl.awake.near < 2.2 && !sl.awake.sleep,
  `by the bed the big button is 睡覺: you lie on the bed, screen goes dark, 「${sl.toast}」, back on your feet beside the bed (${sl.awake.near} m) with 「${sl.awake.act}」 offered again`);
const dr = await p.evaluate(() => { const D = window.__D(), H = window.__H, W = D.walker, I = window.__IN().indoor.I, d = I.spots.dress[0]; W.teleport({ x: d.x, z: d.z, heading: d.heading ?? 0 }); H.step(20); const act = H.actText(); W.teleport({ x: d.x + 2.5 * Math.cos(d.heading ?? 0), z: d.z - 2.5 * Math.sin(d.heading ?? 0), heading: 0 }); H.step(20); return { act, away: H.actText() }; });
check(dr.act === '換衣服' && dr.away !== '換衣服', `in front of the wardrobe: 「${dr.act}」 (away from it: ${dr.away || 'nothing'})`);
// ---- 4 陽台：客廳的落地門 → 真的在外面（世界的場景、高度 9.9、女兒牆擋住、鏡頭不高過天花板）→ 回客廳 ----
const b1 = await p.evaluate(() => { const I = window.__IN().indoor.I, e = I.exits.find((x) => x.to === 'balc'); return e ? window.__H.toExit(e) : { none: true }; });
const f4 = await doorDone();
const b2 = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, X = window.__APT(), U = X.APTU, b = U.b, t = W.telemetry(), by = (b.y || 0) + 9.9, gy = () => W.character.group.position.y;
  const o = { on: U.on, floor: U.floor, in: !!window.__IN().indoor, mine: W.character.group.parent === D.TR.scene, y: +gy().toFixed(2), want: +by.toFixed(2), mode: W.mode, doors: W.doors.length, aptIn: !!W.doors[0]?.ref?.aptIn, cam: +D.dcam.position.y.toFixed(2), ceil: +((b.y || 0) + 13.06).toFixed(2) };
  // 往欄杆推（公寓本地 +z＝街那邊）：被女兒牆擋住、不掉下去
  const dir = Math.atan2(-Math.cos(b.rot), Math.sin(b.rot)), r = H.push(dir, 2.5, 1), t2 = W.telemetry(); // 世界方向＝本地 +z＝(sin rot, cos rot)
  const lz = (t2.x - b.x) * Math.sin(b.rot) + (t2.z - b.z) * Math.cos(b.rot);
  o.pushed = { d: +r.d.toFixed(2), lz: +lz.toFixed(2), y: +gy().toFixed(2), cam: +D.dcam.position.y.toFixed(2) };
  const dir2 = dir + Math.PI / 2, r2 = H.push(dir2, 2.5, 1), t3 = W.telemetry(); const lx = (t3.x - b.x) * Math.cos(b.rot) - (t3.z - b.z) * Math.sin(b.rot);
  o.side = { d: +r2.d.toFixed(2), lx: +lx.toFixed(2), y: +gy().toFixed(2) };
  return o;
});
console.log('  balcony:', JSON.stringify(b1), f4 * 2, JSON.stringify(b2));
check(!b1.none && b1.fade && b2.on && b2.floor === 3 && !b2.in && b2.mine && Math.abs(b2.y - b2.want) < 0.05 && b2.mode === 'walk' && b2.doors === 1 && b2.aptIn && b2.cam <= b2.ceil + 0.05,
  `through the living-room door onto the balcony: back in the world scene at ${b2.y} m (4F), one door back inside, camera under the balcony ceiling`);
check(b2.pushed.lz < 7.6 && b2.pushed.lz > 6.0 && Math.abs(b2.pushed.y - b2.want) < 0.05 && b2.side.lx < 6.1 && b2.side.lx > 4.5 && Math.abs(b2.side.y - b2.want) < 0.05, `the parapet and the side wall hold you on the balcony (front lz ${b2.pushed.lz}, side lx ${b2.side.lx}; still at ${b2.pushed.y} m)`);
await drawAndShot('3-balcony');
const bk = await toBack();
const f5 = await doorDone(); const i5 = await inInfo();
console.log('  back in:', JSON.stringify(bk), f5 * 2, JSON.stringify(i5));
check(bk.fade && i5.in && i5.kind === 'apt' && i5.floor === 3 && i5.mode === 'walk' && !i5.paused && !(await p.evaluate(() => window.__APT().APTU.on)), 'walking into the balcony door brings you back into the living room (4F)');
// ---- 5 頂樓：電梯按「頂樓」→ 真的在外面（16.5 公尺、女兒牆擋人、水塔、晒衣架）→ 門走回 5 樓 → 5 樓的樓梯上去也到頂樓 ----
const rf = await p.evaluate(() => { const D = window.__D(), H = window.__H, W = D.walker, L = window.__IN().indoor.I.lift; W.teleport({ x: L.x, z: L.z, heading: L.rot }); H.step(30); return { panel: H.elPanel(), clicked: H.elClick('頂樓') }; });
const f6 = await doorDone();
const r6 = await p.evaluate(() => {
  const D = window.__D(), H = window.__H, W = D.walker, X = window.__APT(), U = X.APTU, b = U.b, t = W.telemetry(), by = (b.y || 0) + 16.5, gy = () => W.character.group.position.y;
  const o = { on: U.on, floor: U.floor, in: !!window.__IN().indoor, y: +gy().toFixed(2), want: +by.toFixed(2), mode: W.mode, doors: W.doors.length, panel: H.elPanel().shown };
  const loc = (q) => ({ lx: +((q.x - b.x) * Math.cos(b.rot) - (q.z - b.z) * Math.sin(b.rot)).toFixed(2), lz: +((q.x - b.x) * Math.sin(b.rot) + (q.z - b.z) * Math.cos(b.rot)).toFixed(2) });
  o.at = loc(t);
  const dirZ = Math.atan2(-Math.cos(b.rot), Math.sin(b.rot)); // 本地 +z
  const pushes = [[dirZ, 'front'], [dirZ + Math.PI, 'back'], [dirZ - Math.PI / 2, 'right(+x)'], [dirZ + Math.PI / 2, 'left(-x)']], res = {};
  for (const [a, k] of pushes) { W.teleport({ x: b.x + 2 * Math.sin(b.rot), z: b.z + 2 * Math.cos(b.rot), heading: a }); H.step(5); const r = H.push(a, 4, 1, true); const q = loc(W.telemetry()); res[k] = { ...q, y: +gy().toFixed(2) }; }
  o.push = res; o.inside = Object.values(res).every((q) => Math.abs(q.lx) < 6 && Math.abs(q.lz) < 7.5 && Math.abs(q.y - by) < 0.05);
  return o;
});
console.log('  roof:', JSON.stringify(rf.panel), rf.clicked, f6 * 2, JSON.stringify(r6));
check(rf.clicked === '頂樓' && r6.on && r6.floor === 4 && !r6.in && Math.abs(r6.y - r6.want) < 0.05 && r6.mode === 'walk' && r6.doors === 1 && !r6.panel && r6.inside,
  `lift 頂樓 → on the roof at ${r6.y} m; pushing hard toward every edge the parapet holds you (${JSON.stringify(r6.push)})`);
await drawAndShot('4-roof');
const rr = await p.evaluate(() => window.__rinfo());
const rk = await toBack();
const f7 = await doorDone(); const i7 = await inInfo();
console.log('  roof door:', JSON.stringify(rk), f7 * 2, JSON.stringify(i7));
check(rk.fade && i7.in && i7.floor === 4 && i7.mode === 'walk', `the roof door takes you back inside to 5F (${i7.toast})`);
const st = await p.evaluate(() => { const I = window.__IN().indoor.I, e = I.floors[4].exits.find((x) => x.to === 'roof'); return e ? window.__H.toExit(e) : { none: true }; });
const f8 = await doorDone();
const s8 = await p.evaluate(() => { const U = window.__APT().APTU, W = window.__D().walker; return { on: U.on, floor: U.floor, y: +W.character.group.position.y.toFixed(2) }; });
console.log('  stairs to roof:', JSON.stringify(st), f8 * 2, JSON.stringify(s8));
check(!st.none && st.fade && s8.on && s8.floor === 4 && Math.abs(s8.y - r6.want) < 0.05, 'the 5F stairs also lead up to the roof');
// 回 5 樓 → 電梯 1F → 走出大門：回到街上（公寓門口），高度、場景、門都回來
await toBack(); await doorDone();
const l1 = await p.evaluate(() => { const D = window.__D(), H = window.__H, W = D.walker, L = window.__IN().indoor.I.lift; W.teleport({ x: L.x, z: L.z, heading: L.rot }); H.step(30); return H.elClick('1F'); });
await doorDone(); const i9 = await inInfo();
const ex = await p.evaluate(() => { const I = window.__IN().indoor.I, e = I.exits.find((x) => x.to === 'outside'); return e ? window.__H.toExit(e) : { none: true }; });
const f9 = await doorDone();
const o9 = await p.evaluate(() => { const D = window.__D(), W = D.walker, t = W.telemetry(), b = window.__ad, U = window.__APT().APTU; return { in: !!window.__IN().indoor, on: U.on, mode: W.mode, mine: W.character.group.parent === D.TR.scene, y: +W.character.group.position.y.toFixed(2), d: +Math.hypot(t.x - b.door.x, t.z - b.door.z).toFixed(2), doors: W.doors.length }; });
console.log('  out:', l1, JSON.stringify(i9), JSON.stringify(ex), f9 * 2, JSON.stringify(o9));
check(l1 === '1F' && i9.floor === 0 && ex.fade && !o9.in && !o9.on && o9.mode === 'walk' && o9.mine && Math.abs(o9.y) < 0.05 && o9.d < 3 && o9.doors > 20, `lift 1F → out the front door: back on the street by the apartment door (${o9.d} m), ground level, the village doors are back`);
await drawAndShot('5-outside');
const ro = await p.evaluate(() => window.__rinfo());
console.log(`  draw calls: lobby ${r1.calls}/${r1.tris}, roof ${rr.calls}/${rr.tris}, outside by the door ${ro.calls}/${ro.tris}`);
check(errs.length === 0, `no page errors (${errs.length})`);
console.log(fails.length ? `FAILED (${fails.length}):\n  ${fails.join('\n  ')}` : 'ALL CHECKS OK', el());
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
