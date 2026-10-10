// 第 3 批（b3-int）：警察（police-ai.js）＋槍（guns.js）＋槍店（gunshop.js）＋警察局裡面（police.js）接進整個遊戲的測試（Nick 2026-10-04：「警察追人抓人、槍店買槍射擊繼續做」）
//   揍人 → 星星 → 警車從警察局開出來 → 警察下車用跑的追 → 被抓 → 拘留室 → 繳罰款出來；開車撞人 → 2★ → 警車包圍 → 被抓 → 關 30 秒 → 放出來（車在警察局停車場）
//   小孩揍不到、撞不到、打不到；躲進房子、關上自己的鐵捲門星星清掉；槍店：櫃台買槍、子彈，靶場第一次全部打倒拿 2 萬；拿槍到外面打人 → 3★；警察不開槍；
//   存檔重新整理槍還在（舊存檔沒有 guns 也讀得起來）；開車不能用槍；全螢幕、一般的版面（360×800、412×915、915×412、800×360、1280×720）按鈕不重疊；效能（draw call、三角形、一幀幾毫秒）
// 開車、走路都不是真的即時（SwiftShader 一格要一兩秒）：跟 test-b1.mjs 一樣頁面自己的開車先停住（__hold）、不畫（__noDraw），測試在頁面裡一步一步走、開，要截圖才畫
//   （上面的工具：伺服器、hook、開車的機器人 __pp、走路的小工具 __H、hudClash、sizeSweep 從 test-b1.mjs 抄過來的）
// node test-b3.mjs [prefix]（截圖：<prefix>-1-….png …）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = 'b3'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__R = () => race; window.__G = () => GAME; window.__S = () => S; window.__snd = () => snd; window.__room = () => room; window.__scene = () => scene; window.__controls = () => controls;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__money = (n) => { GAME.money = n; save(true); renderWallet(); renderOptions(); refreshCarBtns(); };'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, dvoice, trip, tripS, home, bayLock, snooze, TR, LODS, camGo, cur, built, walker, tripPose, tripFull, boarding,'
  + '   DECK, DREV, sleep, gcam, liftSnd, deliver, offDeck, runLift, midCar, normPark, CABIN_EYE });'
  + ' window.__N = () => NPC; window.__NMAX = () => NPC_MAX;'
  + ' window.__IN = () => ({ indoor, doorFade, HOUSE_WARM, interiorFor, buildInterior, DEALER_DOOR });'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } else if (window.__npcKeep) { NPC = window.__npcKeep; window.__npcKeep = null; NPC.g.visible = DRIVE.on; } };'
  + ' window.__look = () => LOOKP; window.__cam = () => ({ camCap, maxD: controls.maxDistance, fitD, dist: camera.position.distanceTo(controls.target), pos: camera.position.toArray() }); window.__cea = createEngineAudio; window.__camera = () => camera;'
  + ' window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };'
  + ' window.__wstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return walker && walker.telemetry(); };'
  + ' window.__P3 = () => ({ ciRace, ciMenuEl, polRace, police, gunner, PI, PSC, GS, GSC, gsDesk, indoor, impounded, townWorld, townTargets, shopWorld, jailed: jailed(), hideAct, polPlayer, gunParked, CLOSE_ACT, PUNCH_BTN, NPC });';
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
// 畫面上的按鈕：開車的 HUD（多了「下車」）、走路的 HUD（搖桿、上車／升降機／睡覺的大按鈕、小地圖、換視角、右下角的圓按鈕）、疊在畫面上的去哪裡／直接回車庫／聲音、
//   全螢幕鈕、比賽的 HUD：看得到的兩兩不重疊；全螢幕的時候都在螢幕裡面（離邊邊至少 4 px）
const HUD_SEL = ['.dv-chip', '.dv-act', '.dv-act2', '.dv-map', '.dv-cam', '.dv-spd', '.dv-steer', '.dv-brk', '.dv-gas', '.dv-hb', '.wk-chip', '.wk-act', '.wk-map', '.wk-cam', '.wk-stick', '.wk-btns',
  '#dests', '#driveHome', '#dSndBtn', '#fsBtn', '#hud .trackbar', '#hud .tree', '#hud .clock', '#hud .gauge', '#hud .pedals', '#race',
  '.pw-want', '.pw-catch', '.gn-pill', '.gn-fire', '.gn-aim', '.gn-rel', '.gn-wheel', '.cir-p', '.cir-l']; // 第 3 批：通緝的星星、快被抓的條、槍的子彈膠囊、開槍／瞄準／換彈匣、換槍的清單；甩尾的手煞車；賽車場的名次、紅燈
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
// 開局：GC8＋YARIS、NT$ 470 萬（買得起 SUPRA 400 萬＋零件）；只有第一次載入才放（重新整理要看存的）
await p.addInitScript(() => {
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 470, owned: ['gc8', 'yaris'], parts: {}, tyres: {}, wins: {}, cars: {} }));
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
// ---- 第 3 批的小工具（在頁面跑）----
await p.addInitScript(() => {
  const H = () => window.__H, W = () => window.__D().walker, P3 = () => window.__P3();
  const X = (window.__X = {});
  const TS = ['#stage .pw-toast', '#stage .wk-toast', '#stage .dv-toast'];
  X.peek = () => { for (const sel of TS) { const e = document.querySelector(sel); if (e && e.textContent && e.classList.contains('show') && X.toasts[X.toasts.length - 1] !== e.textContent) X.toasts.push(e.textContent); } };
  X.step = (n = 1) => { let t = null; for (let i = 0; i < n; i++) { t = window.__wstep(1); X.peek(); } return t; }; // 每一格看一下說了什麼（提示的 setTimeout 是真的時間）
  // 鏡頭轉到準星對著 (x, y, z)（guns-test.html 的 aimAt：轉幾次，每次走一格讓鏡頭跟上）
  const V3 = { x: 0, y: 0, z: 0 };
  X.aimAt = (x, y, z, n = 12) => {
    const cam = window.__D().dcam; let err = 0;
    for (let i = 0; i < n; i++) {
      cam.updateMatrixWorld(); const e = cam.matrixWorld.elements; V3.x = e[12]; V3.y = e[13]; V3.z = e[14];
      let fx = -e[8], fy = -e[9], fz = -e[10]; const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
      const dx = x - V3.x, dy = y - V3.y, dz = z - V3.z, want = Math.atan2(-dz, dx), have = Math.atan2(-fz, fx);
      const wantP = Math.atan2(dy, Math.hypot(dx, dz)), haveP = Math.asin(Math.max(-1, Math.min(1, fy)));
      let dyaw = want - have; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      const t = W().telemetry(); err = Math.hypot(dyaw, wantP - haveP);
      W().setCamera({ yaw: t.camYaw + dyaw, pitch: t.camPitch - (wantP - haveP), hold: 3 });
      X.step(1);
    }
    return err;
  };
  X.fire = () => { const g = P3().gunner, s0 = g.telemetry().shots; g.setTrigger(true); for (let i = 0; i < 30 && g.telemetry().shots === s0; i++) X.step(1); g.setTrigger(false); X.step(2); return g.telemetry().shots - s0; };
  // 圓按鈕（揍）：walk.js 用 pointerdown
  X.punchBtn = () => { const b = document.querySelector('#stage .wk-btns b'); if (!b || b.closest('[hidden]')) return null; const s = b.textContent; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); return s; };
  // 站到那個人前面 0.75 公尺、面對他（周圍找站得到的地方）；人先停住（不要走掉）
  X.faceTo = (q, d = 0.75) => {
    const w = W();
    for (let a = 0; a < 16; a++) {
      const ang = (a * Math.PI) / 8, x = q.x + Math.cos(ang) * d, z = q.z - Math.sin(ang) * d;
      w.teleport({ x, z, heading: ang + Math.PI }); X.step(1); const t = w.telemetry();
      if (Math.hypot(t.x - x, t.z - z) < 0.12) { w.teleport({ x: q.x + Math.cos(ang) * d, z: q.z - Math.sin(ang) * d, heading: ang + Math.PI }); return true; }
    }
    return false;
  };
  // 路人走去哪裡每次不一樣：「離警察局遠一點」揍人的時候，挑從警車出來的地方看不到的（房子擋住；不要剛好挑到警察局門口那條直路上的人）
  X.farFromPolice = (q) => { const D = P3().police._dbg, st = D.station.spawn || window.__D().VIL.places.police?.spawn; return !st || (Math.hypot(q.x - st.x, q.z - st.z) > 60 && D.tall.blocked(st.x, st.z, q.x, q.z, 0)); };
  // 離 (x, z) 最近的人（age：'adult' | 'kid'；站著、走著的）
  X.person = (x, z, age, maxD = 200, ok = null) => { // ok(q)：另外的條件（例如離警察局夠遠）
    let best = null, bd = maxD;
    for (const q of P3().NPC.peds.people) { if ((ok && !ok(q)) || q.gone || q.active === false || (age === 'adult' ? q.age === 'kid' : q.age !== age) || !['walk', 'idle', 'stand', 'talk', 'wait'].includes(q.mode) || q.y > 0.1) continue; const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q; } }
    return best;
  };
  X.pol = () => { const t = P3().police.telemetry(); return { wanted: t.wanted, state: t.state, seen: t.seen, everSeen: t.everSeen, heat: t.heat, cars: t.cars.map((c) => `${c.id}:${c.mode}:${c.d}:${c.officer}`).join(' '), crimes: t.crimes.map((c) => c.type).join(','), arrests: t.arrests, escapes: t.escapes, jail: t.jail, player: t.player }; };
  X.toast = () => { for (const sel of ['#stage .pw-toast', '#stage .wk-toast', '#stage .dv-toast']) { const e = document.querySelector(sel); if (e && e.classList.contains('show') && !e.closest('[hidden]') && e.textContent) return e.textContent; } return ''; };
  X.toasts = []; // 說過的話（setTimeout 是真的時間：測試一格一格走，提示一下子就被下一句蓋掉）
  X.said = (re) => X.toasts.some((t) => re.test(t));
  X.vis = (sel) => { const e = document.querySelector(sel); return !!e && !e.hidden && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; };
  X.where = () => { const i = P3().indoor; return i ? i.kind + (i.jail ? ':jail' : '') : 'out'; };
});

const ev = (f, a) => p.evaluate(f, a);
const UNTIL = +(process.env.B3_UNTIL || 99);
async function finish() {
  console.log(`\n${fails.length ? 'FAILED' : 'ALL OK'}: ${fails.length} failed${fails.length ? ' — ' + fails.join(' / ') : ''}; page errors ${errs.length}${errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''}`, el());
  await b.close(); srv.close(); process.exit(fails.length || errs.length ? 1 : 0);
}

// ---- 1 車庫頁 → 出門（載入畫面多一步「警察局、槍店準備中⋯」：警察、警察局裡面先做好）；舊存檔（沒有 guns）讀得起來 ----
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
const s1 = await ev(() => ({ guns: JSON.stringify(window.__G().guns), saved: 'guns' in JSON.parse(localStorage.getItem('carid.tune') || '{}') }));
console.log('1', el(), JSON.stringify(s1));
check(s1.saved && s1.guns === JSON.stringify({ owned: [], ammo: {}, mag: {}, cur: null, range: { best: {}, time: {}, paid: {} } }), 'an old save without guns (seeded) loads: GAME.guns is empty (gunSave.fresh) and is written back into the save');
const msgs = [];
await p.exposeFunction('__msg', (m) => msgs.push(m));
await ev(() => { const m = document.getElementById('msg'); new MutationObserver(() => window.__msg(m.textContent)).observe(m, { childList: true, characterData: true, subtree: true }); window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
await ev(() => { window.__hold = true; window.__noDraw = true; });
const s1b = await ev(() => {
  const X = window.__P3(), pol = X.police, t = pol.telemetry();
  return { police: !!pol, state: pol.state, wanted: pol.wanted, graph: t.graph, PI: !!X.PI, PSC: !!X.PSC, GS: !!X.GS, gunner: !!X.gunner, btn: [...document.querySelectorAll('#stage .wk-btns b')].map((b) => b.textContent).join(), btnVis: window.__X.vis('#stage .wk-btns'),
    want: window.__X.vis('#stage .pw-want'), pill: window.__X.vis('#stage .gn-pill'), fire: window.__X.vis('#stage .gn-fire'), cell: X.PI.cellOpen, markers: pol.markers.length, mov: X.NPC ? X.NPC.OBS.length : -1, pcars: X.NPC ? X.NPC.PCARS.length : -1 };
});
console.log('  out:', JSON.stringify(s1b), '| loading:', JSON.stringify([...new Set(msgs)]));
check(s1b.police && s1b.state === 'free' && s1b.wanted === 0 && s1b.PI && s1b.PSC && !s1b.GS && s1b.gunner && msgs.includes('警察局、槍店準備中⋯'), 'loading screen made the police (cars + officers preloaded), the police-station interior; the gun shop waits until you walk in');
check(s1b.btn === '揍' && s1b.btnVis && !s1b.want && !s1b.pill && !s1b.fire, 'walking: the round 揍 button is there; no stars, no gun HUD (no guns yet)');
check(s1b.cell === true && s1b.mov === 4 && s1b.pcars === 3, 'cell door open when visiting; police cars are obstacles for traffic and pedestrians (npc.js)');
if (UNTIL <= 1) await finish();

// ---- 2 走路揍人：小孩揍不到；大人倒下去 → 1★ → 警車從警察局開出來（警笛、燈、小地圖）→ 下車用跑的追 → 被抓 → 拘留室 → 繳罰款出來 ----
const s2 = await ev(() => {
  const X = window.__X, D = window.__D(), w = D.walker, P3 = window.__P3();
  w.teleport(window.__H.gw(14, 2, 0)); X.step(30); // 先走出車庫（門口外面）：附近才有人
  D.GAR.door.open(0.1); X.step(30);
  const t = w.telemetry(), kid = X.person(t.x, t.z, 'kid'), out = { kid: null };
  if (kid) { X.faceTo(kid); const m0 = kid.mode, btn = X.punchBtn(); X.step(2); out.kid = { btn, m0, m1: kid.mode, wanted: P3.police.wanted, crimes: P3.police.telemetry().crimes.length, age: kid.age }; X.step(40); }
  const ad = X.person(t.x, t.z, 'adult');
  if (!ad) return out;
  X.faceTo(ad); const m0 = ad.mode, btn = X.punchBtn(); X.step(2);
  out.adult = { btn, m0, m1: ad.mode, age: ad.age, ...X.pol(), toast: X.toast(), stars: document.querySelector('#stage .pw-want .st')?.textContent, want: X.vis('#stage .pw-want'), anim: w.telemetry().state };
  return out;
});
console.log('2', el(), JSON.stringify(s2));
check(!!s2.kid && s2.kid.btn === '揍' && s2.kid.age === 'kid' && !['fall', 'lie'].includes(s2.kid.m1) && s2.kid.wanted === 0 && s2.kid.crimes === 0, 'punching a kid: nobody is hit, no stars (kids can never be hit)');
check(!!s2.adult && ['fall', 'lie'].includes(s2.adult.m1) && s2.adult.wanted === 1 && s2.adult.state === 'wanted' && s2.adult.crimes === 'punch' && s2.adult.want, 'punching an adult: they fall over (cartoon, gets back up), 1 star, 通緝中 shows');
await drawAndShot('2-punch-1star');
// 警察來：站著不動等（最多 150 秒）；記下警車（從警察局開出來）、警察下車、跑過來、抓到
const s2b = await ev(() => {
  const X = window.__X, P3 = window.__P3(), pol = P3.police, DBG = pol._dbg, D = window.__D(), st = new Set(), log = [];
  let firstCar = null, out = 0, siren = false, lights = false, marks = 0, minD = 1e9;
  for (let i = 0; i < 150 * 60 && pol.state === 'wanted'; i++) {
    X.step(1);
    for (const c of DBG.cars) if (c.on) { if (!firstCar) firstCar = { x: +c.x.toFixed(1), z: +c.z.toFixed(1), home: Math.hypot(c.x - DBG.station.spawn.x, c.z - DBG.station.spawn.z) }; if (c.siren) siren = true; if (c.lights) lights = true; minD = Math.min(minD, c.d); }
    for (const f of DBG.offs) if (f.on) { out++; st.add(f.pose.state); }
    marks = Math.max(marks, pol.markers.filter((m) => m && m.on !== false).length);
    if (i % 600 === 0) log.push(`${(i / 60).toFixed(0)}s ${X.pol().cars}`);
  }
  return { ...X.pol(), firstCar, out: out / 60, states: [...st].join(), siren, lights, marks, minD: +minD.toFixed(1), log: log.join(' | '), toast: X.toast(), catchBar: X.vis('#stage .pw-catch'), walk: D.walker.mode };
});
console.log('  chase:', JSON.stringify(s2b));
check(!!s2b.firstCar && s2b.firstCar.home < 30 && s2b.lights && s2b.marks >= 1, `a police car came out of the police station (${s2b.firstCar && s2b.firstCar.home.toFixed(1)} m from its gate) with lights on, shown on the minimap`);
check(s2b.out > 0.5 && /run/.test(s2b.states) && !/aim|shoot/.test(s2b.states), `an officer got out and ran after you (${s2b.out.toFixed(1)} s on foot; poses ${s2b.states}): police never aim or shoot`);
check(s2b.state === 'caught' && /被警察抓到了！/.test(s2b.toast) && s2b.walk === 'off', 'caught on foot: 「被警察抓到了！」, walking stops');
await drawAndShot('2b-caught');
const s2c = await ev(() => {
  const X = window.__X, P3 = window.__P3(), D = window.__D(), w = D.walker; let n = 0;
  for (; n < 6 * 60 && P3.police.state !== 'jail'; n++) X.step(1);
  X.step(30);
  const Q = window.__P3(), t = w.telemetry(), c = Q.PI.zones.cell, dx = t.x - c.x, dz = t.z - c.z, r = c.rot || 0, inCell = (x, z) => Math.abs((x - c.x) * Math.cos(r) - (z - c.z) * Math.sin(r)) < c.hx + 0.1 && Math.abs((x - c.x) * Math.sin(r) + (z - c.z) * Math.cos(r)) < c.hz + 0.1;
  const a = { s: n / 60, where: X.where(), inCell: inCell(t.x, t.z), mode: t.mode, cellOpen: Q.PI.cellOpen, jailCard: X.vis('#stage .pw-jail'), pay: document.querySelector('#stage .pw-pay')?.textContent, cnt: document.querySelector('#stage .pw-jail .cnt')?.textContent, doors: w.doors.length, gunOn: Q.gunner.telemetry ? true : false, impounded: Q.impounded, mine: w.character.group.parent === Q.PSC };
  // 想走出去：往拘留室的鐵門推 3 秒、往四面推
  const H = window.__H; for (const dir of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) H.push(dir, 0.8, 1);
  const t2 = w.telemetry(); a.stillIn = inCell(t2.x, t2.z); a.punch = X.vis('#stage .wk-btns');
  w.teleport(Q.PI.cell); X.step(30); // 截圖：回到拘留室中間、面對鐵門
  return a;
});
console.log('  jail:', JSON.stringify(s2c));
check(s2c.where === 'police:jail' && s2c.inCell && s2c.mode === 'walk' && s2c.mine && !s2c.cellOpen && s2c.doors === 0 && !s2c.punch, 'fade → inside the police station, locked in the cell (cell door closed; you can walk around inside the cell; no 揍 button)');
check(s2c.jailCard && /30|2[0-9]/.test(s2c.cnt) && /繳罰款 NT\$ 2 萬/.test(s2c.pay) && s2c.stillIn, `jail card: count-down + 「${s2c.pay}」; pushing every way you stay inside the cell`);
await drawAndShot('2c-jail');
const s2d = await ev(() => {
  const X = window.__X, P3 = window.__P3(), D = window.__D(), m0 = window.__G().money;
  document.querySelector('#stage .pw-pay').click();
  let n = 0; for (; n < 4 * 60 && P3.police.state !== 'free'; n++) X.step(1);
  X.step(200);
  const Q = window.__P3(), t = D.walker.telemetry(), door = D.VIL.places.police.door;
  return { s: n / 60, state: Q.police.state, wanted: Q.police.wanted, paid: m0 - window.__G().money, where: X.where(), mode: t.mode, atDoor: +Math.hypot(t.x - door.x, t.z - door.z).toFixed(2), said: X.toasts.slice(-3), cellOpen: Q.PI.cellOpen, jailCard: X.vis('#stage .pw-jail'), mine: D.walker.character.group.parent === D.TR.scene, btn: X.vis('#stage .wk-btns') };
});
console.log('  paid:', JSON.stringify(s2d));
check(s2d.state === 'free' && s2d.wanted === 0 && s2d.paid === 2 && s2d.where === 'out' && s2d.mode === 'walk' && s2d.atDoor < 0.5 && s2d.mine && !s2d.jailCard && s2d.btn, `paid the 2 萬 fine → released at the police-station door (${s2d.atDoor} m), back outside, walking, 揍 back`);
check(s2d.said.some((x) => /繳了 2 萬罰款，放你出去了/.test(x)) && !s2d.said.some((x) => /停車場/.test(x)) && s2d.cellOpen, `release message 「繳了 2 萬罰款，放你出去了」 (arrested on foot: no 'car in the yard' line); cell door opens again`);
if (UNTIL <= 2) await finish();

// ---- 3 開車撞人：小孩撞不到（跳開／被推開）；大人 → 2★ → 兩台警車追、包圍 → 被抓（手煞車停住）→ 關 30 秒 → 時間到放出來：車停在警察局的停車場 ----
const s3a = await ev(() => {
  const X = window.__X, D = window.__D(), H = window.__H, w = D.walker;
  w.teleport(H.gw(-2.6, -2.6, 0)); X.step(10);
  const r = H.walkLocal([[-0.6, -2.3]]); const act = H.actText(), pressed = H.press(), b = H.board();
  return { ok: r.ok, act, pressed, modes: b.modes, drv: !!window.__D().drv, gunOff: !X.vis('#stage .gn-fire') };
});
console.log('3', el(), JSON.stringify(s3a));
check(s3a.pressed === '上車 · GC8' && s3a.modes.includes('off') && s3a.drv, 'walked back to GC8 in the garage and got in');
const s3b = await ev(() => {
  const X = window.__X, D = window.__D(), d = D.drv, V = D.VIL, N = window.__N();
  // 一條直的路（往賽道的路線上 40 公尺以上、離你家 80 公尺以上的一段），車子放在一開始
  const t0 = d.telemetry(), r = V.route(t0.x, t0.z, 'track'), G = V.places.garage.lot; let seg = null;
  for (let i = 0; i < r.pts.length - 1 && !seg; i++) { const A = r.pts[i], B = r.pts[i + 1], L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L > 45 && Math.hypot(A[0] - G.x, A[1] - G.z) > 80) seg = [A, B, L]; }
  if (!seg) return { err: 'no straight road' };
  const [A, B] = seg, hd = Math.atan2(-(B[1] - A[1]), B[0] - A[0]);
  d.teleport({ x: A[0], z: A[1], heading: hd }); X.step(5);
  const drive = (kmh) => { for (let i = 0; i < 400 && d.telemetry().kmh < kmh; i++) { d.setInput({ throttle: 1, brake: 0, steer: 0 }); X.step(1); } d.setInput({ throttle: 0.25, brake: 0, steer: 0 }); };
  const ahead = (q, m) => { const t = d.telemetry(), ci = d.carInfo; q.x = t.x + Math.cos(t.heading) * (ci.nose + m); q.z = t.z - Math.sin(t.heading) * (ci.nose + m); q.mode = q.mode === 'sit' ? 'walk' : q.mode; };
  const h0 = N.hits, w0 = window.__P3().police.wanted;
  drive(28);
  const kid = X.person(A[0], A[1], 'kid', 400) || X.person(A[0], A[1], 'kid', 3000), out = {}; // 附近沒有小孩（這段路人少）：遠一點的也行（等一下放到車前面）
  if (kid) { ahead(kid, 1.6); const m0 = kid.mode; for (let i = 0; i < 40; i++) X.step(1); out.kid = { m0, m1: kid.mode, hits: N.hits - h0, wanted: window.__P3().police.wanted - w0, y: +kid.y.toFixed(2), kmh: d.telemetry().kmh }; }
  for (let i = 0; i < 30; i++) X.step(1);
  drive(28);
  const ad = X.person(d.telemetry().x, d.telemetry().z, 'adult', 400);
  if (ad) { ahead(ad, 1.2); for (let i = 0; i < 30; i++) X.step(1); out.adult = { m1: ad.mode, hits: N.hits - h0, kmh: d.telemetry().kmh, ...X.pol() }; }
  for (let i = 0; i < 120; i++) { d.setInput({ throttle: 0, brake: 1, steer: 0 }); X.step(1); if (d.telemetry().kmh < 1) break; }
  d.setInput({ throttle: 0, brake: 0, steer: 0 });
  out.said = X.toasts.slice(-4);
  return out;
});
console.log('  hit:', JSON.stringify(s3b));
check(!!s3b.kid && !['fall', 'lie'].includes(s3b.kid.m1) && s3b.kid.hits === 0 && s3b.kid.wanted === 0, `a kid in front of the car at ${s3b.kid?.kmh} km/h is never hit (dodges / pushed aside), no stars`);
check(!!s3b.adult && s3b.adult.hits === 1 && ['fall', 'lie', 'getup'].includes(s3b.adult.m1) && s3b.adult.wanted === 2 && /hit/.test(s3b.adult.crimes), 'the car hits an adult: they fall (cartoon), 2 stars');
await drawAndShot('3-hit-2stars');
// 停著等：兩台警車追過來、夾住 → 被抓（手煞車）
const s3c = await ev(() => {
  const X = window.__X, P3 = window.__P3(), pol = P3.police, DBG = pol._dbg, D = window.__D(), log = []; let maxOn = 0, input = null, carColl = 0, sirenN = 0, camLift = 0;
  for (let i = 0; i < 150 * 60 && pol.state === 'wanted'; i++) {
    X.step(1);
    const on = DBG.cars.filter((c) => c.on && c.mode !== 'home'); maxOn = Math.max(maxOn, on.length); sirenN = Math.max(sirenN, DBG.cars.filter((c) => c.siren).length);
    if (i % 600 === 0) log.push(`${(i / 60).toFixed(0)}s ${X.pol().cars} catch ${pol.telemetry().catch}`);
  }
  for (let i = 0; i < 20; i++) X.step(1);
  const d = window.__D().drv;
  return { ...X.pol(), maxOn, sirenN, log: log.join(' | '), said: X.toasts.slice(-3), act: d?.action ?? null, act2: d?.action2 ?? null, kmh: d?.telemetry().kmh };
});
console.log('  boxed in:', JSON.stringify(s3c));
check(s3c.maxOn >= 2 && s3c.state === 'caught' && s3c.act === null && s3c.act2 === null, `two police cars chased (max ${s3c.maxOn} out, ${s3c.sirenN} sirens) and boxed you in: caught in the car, no 下車 button`);
await drawAndShot('3b-boxed-in');
const s3d = await ev(() => {
  const X = window.__X, P3 = window.__P3(), D = window.__D(); let n = 0;
  for (; n < 6 * 60 && P3.police.state !== 'jail'; n++) X.step(1);
  const Q = window.__P3(), yard = D.VIL.places.police.yard, p = window.__D().tripPose.gc8;
  const a = { where: X.where(), drv: !!window.__D().drv, impounded: Q.impounded, yard: p && +Math.hypot(p.x - yard.x, p.z - yard.z).toFixed(2), carAt: (() => { const c = window.__D().tripS.car; return +Math.hypot(c.position.x - yard.x, c.position.z - yard.z).toFixed(2); })(), jailCard: X.vis('#stage .pw-jail'), drivebar: getComputedStyle(document.getElementById('drivebar')).visibility, jailed: document.body.classList.contains('jailed') };
  for (n = 0; n < 32 * 60 && window.__P3().police.state !== 'free'; n++) X.step(1);
  for (let i = 0; i < 200; i++) X.step(1);
  const w = window.__D().walker, t = w.telemetry(), door = D.VIL.places.police.door;
  a.after = { s: +(n / 60).toFixed(1), state: window.__P3().police.state, where: X.where(), atDoor: +Math.hypot(t.x - door.x, t.z - door.z).toFixed(2), said: X.toasts.slice(-4), cars: w.cars.map((c) => c.key + '@' + Math.hypot(c.x - yard.x, c.z - yard.z).toFixed(1)).join(), drivebar: getComputedStyle(document.getElementById('drivebar')).visibility };
  return a;
});
console.log('  jail 30 s:', JSON.stringify(s3d));
check(s3d.where === 'police:jail' && !s3d.drv && s3d.impounded && s3d.yard < 0.01 && s3d.carAt < 0.01 && s3d.jailCard && s3d.jailed && s3d.drivebar === 'hidden', 'jailed: your car was towed to the police-station yard; destination bar hidden while locked up');
check(s3d.after.state === 'free' && s3d.after.where === 'out' && s3d.after.atDoor < 0.6 && s3d.after.s > 25 && s3d.after.s < 31.5 && s3d.after.said.some((x) => /時間到/.test(x)) && s3d.after.said.some((x) => /你的車停在警察局的停車場/.test(x)) && /gc8@0\.0/.test(s3d.after.cars) && s3d.after.drivebar === 'visible',
  `waited it out (${s3d.after.s} s): released at the door, 「時間到」 + 「你的車停在警察局的停車場」, GC8 is there to get in`);
await drawAndShot('3c-released-yard');
if (UNTIL <= 3) await finish();

// ---- 4 甩開：警察還沒看到你不算；躲進房子（看不到）→ 25 秒掉一顆星 → 甩掉；開回／走回自己的車庫關上鐵捲門 → 星星清掉 ----
// 門口黑掉再亮起來要等 Promise（蓋好、編譯好）：測試一格一格走的時候 Promise 不會在同一個 evaluate 裡面好 → 分開幾次 evaluate
async function settleFade() {
  for (let k = 0; k < 6; k++) {
    const busy = await ev(() => { const X = window.__X; for (let i = 0; i < 120 && window.__IN().doorFade; i++) X.step(1); return !!window.__IN().doorFade; });
    if (!busy) return true;
    await p.waitForTimeout(50);
  }
  return false;
}
const s4a = await ev(() => {
  const X = window.__X, D = window.__D(), H = window.__H, w = D.walker, P3 = window.__P3(), pol = P3.police;
  // 離警察局遠一點（你家門口外面）揍一個大人
  w.teleport(H.gw(16, 4, 0)); X.step(60);
  const t = w.telemetry(), ad = X.person(t.x, t.z, 'adult', 300, X.farFromPolice); if (!ad) return { err: 'no adult' };
  X.faceTo(ad); X.punchBtn(); X.step(2);
  const a = { wanted: pol.wanted };
  X.step(180); const t3 = pol.telemetry(); a.at3 = { heat: t3.heat, everSeen: t3.everSeen, seen: t3.seen, hunt: t3.hunt, cars: X.pol().cars };
  // 最近的透天厝（走得進去的）
  const me = w.telemetry(), X2 = window.__IN();
  const doors = w.doors.filter((d) => d.ref && d.ref.kind === 'house' && X2.interiorFor(d.ref)).sort((p, q) => Math.hypot(p.ax - me.x, p.az - me.z) - Math.hypot(q.ax - me.x, q.az - me.z));
  a.door = H.toDoor(doors[0]);
  return a;
});
await settleFade();
const s4h = await ev(() => {
  const X = window.__X, pol = window.__P3().police, a = { where: X.where(), name: window.__IN().indoor?.I.name, hidden: pol.telemetry().player.hidden, gunOff: !X.vis('#stage .gn-pill'), heat0: pol.telemetry().heat, wanted0: pol.wanted };
  const e0 = pol.telemetry().escapes; let s = 0;
  for (; s < 40 * 60 && pol.wanted > 0; s++) X.step(1);
  a.lost = { s: +(s / 60).toFixed(1), wanted: pol.wanted, state: pol.state, escapes: pol.telemetry().escapes - e0, said: X.toasts.slice(-2) };
  const I = window.__IN().indoor; if (I) a.exit = window.__H.toExit((I.exits || I.I.exits).find((x) => x.to === 'outside'));
  return a;
});
await settleFade();
s4h.out = await ev(() => window.__X.where());
console.log('4', el(), JSON.stringify(s4a), JSON.stringify(s4h));
check(s4a.wanted === 1 && s4a.at3 && s4a.at3.heat === 0 && !s4a.at3.everSeen, `3 s after the crime the police have not seen you yet: the escape timer has not started (heat ${s4a.at3?.heat})`);
check(s4h.where === 'house' && s4h.hidden && s4h.gunOff, `walked into ${s4h.name}: hidden from the police (guns off indoors)`);
const hidT = s4h.lost.s + s4h.heat0;
check(s4h.lost.wanted === 0 && s4h.lost.state === 'free' && s4h.lost.escapes === 1 && hidT > 24 && hidT < 26.5 && s4h.lost.said.some((x) => /甩掉警察了/.test(x)), `hiding in the house ${hidT.toFixed(1)} s (25 s rule) cleared the star (「甩掉警察了！」)`);
check(s4h.out === 'out', 'walked back out of the house');
const s4b = await ev(() => {
  const X = window.__X, D = window.__D(), H = window.__H, w = D.walker, P3 = window.__P3(), pol = P3.police, G = D.GAR;
  // 先走到鐵捲門前面：門關著就按「開鐵捲門」（等一下要馬上躲進去）
  const a = { door0: G.door.t };
  w.teleport(H.gw(7.5, 0, Math.PI)); X.step(20);
  if (G.door.t === 0) { a.open = H.press(); for (let i = 0; i < 200 && G.door.t < 1; i++) X.step(1); }
  w.teleport(H.gw(16, 4, 0)); X.step(30);
  const t = w.telemetry(), ad = X.person(t.x, t.z, 'adult', 300, X.farFromPolice); if (!ad) return { err: 'no adult' };
  X.faceTo(ad); X.punchBtn(); X.step(2);
  a.wanted = pol.wanted;
  // 馬上跑回車庫裡面
  w.teleport(H.gw(5, 0.5, Math.PI)); X.step(5);
  a.walk = H.walkLocal([[2.5, 0.5]]); X.step(5);
  a.act = H.actText(); a.press = H.press(); let n = 0; for (; n < 300 && pol.wanted > 0; n++) X.step(1);
  a.after = { s: +(n / 60).toFixed(1), door: G.door.t, wanted: pol.wanted, state: pol.state, said: X.toasts.slice(-2), safe: pol.telemetry().player.safe };
  // 再開門走出去（星星沒了，門口照樣是「開鐵捲門」）
  w.teleport(H.gw(3, 0, 0)); X.step(10); a.reopen = H.actText();
  return a;
});
console.log('  garage:', JSON.stringify(s4b));
check(s4b.wanted === 1 && s4b.act === '關鐵捲門' && s4b.press === '關鐵捲門', 'wanted, walking inside your garage with the door open: 「關鐵捲門」');
check(s4b.after && s4b.after.wanted === 0 && s4b.after.door === 0 && s4b.after.said.some((x) => /躲回車庫/.test(x)), `closed the garage door: stars cleared in ${s4b.after?.s} s (「躲回車庫了，警察找不到你！」)`);
check(s4b.reopen === '開鐵捲門', 'afterwards the door button is the normal 「開鐵捲門」 again');
await ev(() => { const pol = window.__P3().police; if (pol.state !== 'free') pol.clear(); }); // 沒過的話：下一段從乾淨的開始
if (UNTIL <= 4) await finish();

// ---- 5 槍店：走進去（第一次才蓋）→ 櫃台買手槍、子彈 → 店裡不能開槍 → 靶場練習（第一次全部打倒拿 2 萬）→ 走出去 ----
const s5a = await ev(() => {
  const X = window.__X, D = window.__D(), H = window.__H, w = D.walker;
  const d = w.doors.find((q) => q.ref && q.ref.kind === 'gunshop');
  return { door: !!d, r: d ? H.toDoor(d) : null };
});
await settleFade();
const s5b = await ev(() => {
  const X = window.__X, D = window.__D(), H = window.__H, w = D.walker, Q = window.__P3(), GS = Q.GS, g = Q.gunner;
  const a = { where: X.where(), GS: !!GS, world: null, hidden: Q.police.telemetry().player.hidden, info: GS && GS.info };
  const z = GS.zones.counter; w.teleport({ x: z.x, z: z.z, heading: 0 }); X.step(10);
  a.act = H.actText(); a.press = H.press(); X.step(2);
  const panel = document.querySelector('.gs');
  a.desk = { open: !!window.__P3().gsDesk, shopping: document.body.classList.contains('shopping'), panel: !!panel && X.vis('.gs'), walk: w.mode, pmode: Q.police.telemetry().player.mode, fs: document.body.classList.contains('fs') };
  return a;
});
console.log('5', el(), JSON.stringify(s5a), JSON.stringify(s5b));
check(s5a.door && s5a.r.fade && s5b.where === 'gunshop' && s5b.GS && s5b.hidden, `walked into the gun shop (built on first entry: ${JSON.stringify(s5b.info)})`);
check(s5b.act === '買槍、子彈' && s5b.desk.open && s5b.desk.shopping && s5b.desk.panel && s5b.desk.walk === 'off' && s5b.desk.pmode === 'off', 'at the counter: 「買槍、子彈」 opens the shop panel under the picture (like the tuning shop); walking paused');
await p.waitForTimeout(300);
await p.screenshot({ path: `${prefix}-5-counter.png`, fullPage: true }); console.log('  shot', `${prefix}-5-counter.png`, el());
const s5c = await ev(() => {
  const X = window.__X, G = window.__G(), m0 = G.money, click = (sel) => { const b = document.querySelector(sel); b.click(); return b.querySelector('.p')?.textContent; };
  const p1 = click('.gs .gs-gun[data-id="pistol"]'), p2 = click('.gs .gs-gun[data-id="pistol"]');
  const a1 = click('.gs .gs-ammo[data-id="pistol"]'), a2 = click('.gs .gs-ammo[data-id="pistol"]');
  const saved = JSON.parse(localStorage.getItem('carid.tune')).guns;
  const out = { p1, p2, a1, a2, spent: m0 - G.money, guns: JSON.parse(JSON.stringify(G.guns)), saved: saved && saved.owned.join(), msg: document.querySelector('.gs .shop-msg').textContent, wallet: document.getElementById('wallet')?.textContent };
  document.querySelector('.gs .gs-leave').click(); X.step(20);
  const Q = window.__P3(), t = Q.gunner.telemetry();
  out.after = { desk: !!Q.gsDesk, panel: !!document.querySelector('.gs'), shopping: document.body.classList.contains('shopping'), walk: window.__D().walker.mode, drawn: t.drawn, cur: t.cur, mag: t.mag, reserve: t.reserve, btns: X.vis('#stage .wk-btns'), fire: X.vis('#stage .gn-fire'), pill: X.vis('#stage .gn-pill') };
  return out;
});
console.log('  bought:', JSON.stringify(s5c));
check(s5c.p2 === '再按一次' && s5c.spent === 4 && s5c.guns.owned.join() === 'pistol' && s5c.guns.ammo.pistol === 48 && s5c.guns.mag.pistol === 12 && s5c.saved === 'pistol', 'bought a 手槍 (3 萬, tap twice) + a box of 48 bullets (1 萬): GAME.guns updated and saved');
check(!s5c.after.desk && !s5c.after.panel && !s5c.after.shopping && s5c.after.walk === 'walk' && s5c.after.drawn && s5c.after.cur === 'pistol' && !s5c.after.btns && s5c.after.fire && s5c.after.pill, '離開櫃台: walking again with the pistol in hand; 揍 replaced by 開槍 (plus 瞄準, 換彈匣, ammo pill)');
const s5d = await ev(() => {
  const X = window.__X, Q = window.__P3(), g = Q.gunner, GS = Q.GS, w = window.__D().walker, H = window.__H;
  const s0 = g.telemetry().shots, c0 = Q.police.telemetry().crimes.length; g.setTrigger(true); X.step(20); g.setTrigger(false); X.step(5);
  const a = { shopShots: g.telemetry().shots - s0, crimes: Q.police.telemetry().crimes.length - c0, said: X.toasts.slice(-1) };
  const z = GS.zones.range; w.teleport({ x: z.x, z: z.z, heading: Math.atan2(-(GS.views.range.look[2] - z.z), GS.views.range.look[0] - z.x) }); X.step(10);
  a.act = H.actText(); a.press = H.press(); X.step(2); a.st0 = GS.range.state; X.step(200); a.st1 = GS.range.state;
  const m0 = window.__G().money; let shots = 0;
  g.setAim(true); X.step(30);
  for (let i = 0; i < 6 && GS.range.state === 'run'; i++) for (let k = 0; k < 6 && !GS.range.targets[i].down && GS.range.state === 'run'; k++) { const tg = GS.range.targets[i]; X.aimAt(tg.x, tg.y + 0.05, tg.z, 8); shots += X.fire(); if (g.telemetry().mag === 0) { g.reload(); X.step(150); } }
  X.step(30); g.setAim(false); X.step(10);
  return { ...a, st2: GS.range.state, hits: GS.range.hits, time: +GS.range.time.toFixed(1), shots, reward: window.__G().money - m0, range: JSON.parse(JSON.stringify(window.__G().guns.range)), said2: X.toasts.slice(-1), crimes2: Q.police.telemetry().crimes.length - c0, wanted: Q.police.wanted };
});
console.log('  range:', JSON.stringify(s5d));
check(s5d.shopShots === 0 && s5d.crimes === 0 && s5d.said.some((x) => /店裡不可以開槍/.test(x)), 'in the shop (not the range) the gun does not fire: 「店裡不可以開槍⋯」');
check(s5d.act === '開始練習' && s5d.st0 === 'count' && s5d.st1 === 'run', 'behind the range bench: 「開始練習」 → countdown → run');
check(s5d.st2 === 'done' && s5d.hits === 6 && s5d.reward === 2 && s5d.range.paid.pistol === 1 && s5d.range.best.pistol === 6 && s5d.crimes2 === 0 && s5d.wanted === 0, `all 6 targets down in ${s5d.time} s (${s5d.shots} shots): perfect-round reward 2 萬 paid once, best saved; shooting at the range is never a crime`);
await drawAndShot('5b-range');
// 再一輪完美：不會再給錢
const s5e = await ev(() => {
  const X = window.__X, Q = window.__P3(), g = Q.gunner, GS = Q.GS; window.__H.press(); X.step(200);
  const m0 = window.__G().money; g.setAim(true); X.step(30);
  for (let i = 0; i < 6 && GS.range.state === 'run'; i++) for (let k = 0; k < 6 && !GS.range.targets[i].down && GS.range.state === 'run'; k++) { const tg = GS.range.targets[i]; X.aimAt(tg.x, tg.y + 0.05, tg.z, 8); X.fire(); if (g.telemetry().mag === 0) { g.reload(); X.step(150); } }
  X.step(30); g.setAim(false); X.step(10);
  return { st: GS.range.state, hits: GS.range.hits, reward: window.__G().money - m0 };
});
check(s5e.hits === 6 && s5e.reward === 0, `second perfect round: no second reward (${JSON.stringify(s5e)})`);
const s5f = await ev(() => { const Q = window.__P3(), I = Q.indoor; return window.__H.toExit(I.exits.find((x) => x.to === 'outside')); });
await settleFade();
const s5g = await ev(() => { const X = window.__X, Q = window.__P3(), D = window.__D(), t = D.walker.telemetry(), d = D.VIL.places.gunshop.door; return { where: X.where(), d: +Math.hypot(t.x - d.x, t.z - d.z).toFixed(2), drawn: Q.gunner.telemetry().drawn, mine: D.walker.character.group.parent === D.TR.scene }; });
console.log('  out:', JSON.stringify(s5f), JSON.stringify(s5g));
check(s5g.where === 'out' && s5g.d < 2.5 && s5g.drawn && s5g.mine, 'walked out of the gun shop door, still holding the pistol');
if (UNTIL <= 5) await finish();

// ---- 6 拿槍走在外面：小孩打不到；打倒警察 +1★；打倒大人 → 3★；警察從來不開槍；被抓也不會拿走槍、子彈；開車的時候不能用槍；存檔重新整理槍還在 ----
await ev(() => { const pol = window.__P3().police; if (pol.state !== 'free') pol.clear(); });
const POSE = [];
const s6a = await ev(() => {
  const X = window.__X, D = window.__D(), w = D.walker, Q = window.__P3(), g = Q.gunner, pol = Q.police;
  const a = { drawn: g.telemetry().drawn, mag0: g.telemetry().mag, res0: g.telemetry().reserve };
  if (!a.drawn) g.draw('pistol');
  X.step(30);
  // 小孩：5 公尺，瞄準肚子（往下打：沒打到就打在後面的地上）
  const t = w.telemetry(), kid = X.person(t.x, t.z, 'kid', 300);
  if (!kid) return { ...a, err: 'no kid' };
  X.faceTo(kid, 5); X.step(5); g.setAim(true); X.step(20);
  const k0 = g.telemetry().knocks, c0 = pol.telemetry().crimes.length, m0 = kid.mode; let shots = 0;
  for (let i = 0; i < 3; i++) { X.aimAt(kid.x, 0.7, kid.z, 8); shots += X.fire(); }
  X.step(10); g.setAim(false); X.step(10);
  a.kid = { m0, m1: kid.mode, y: +kid.y.toFixed(2), shots, knocks: g.telemetry().knocks - k0, crimes: pol.telemetry().crimes.slice(c0).map((c) => c.type).join(), wanted: pol.wanted, aimKind: g.telemetry().aimKind };
  return a;
});
console.log('6', el(), JSON.stringify(s6a));
check(!!s6a.kid && s6a.kid.shots === 3 && s6a.kid.knocks === 0 && !['fall', 'lie'].includes(s6a.kid.m1) && !/shoot/.test(s6a.kid.crimes), `shooting at a kid 3 times from 5 m: never hit (bullets pass; no 'shoot' crime: ${s6a.kid?.crimes || 'none'})`);
// 1★（報一個揍人）→ 等警察下車跑過來 → 開槍打倒他 → +1★（'shootCop'），他倒下去再爬起來，照樣追
const s6b = await ev(() => {
  const X = window.__X, D = window.__D(), w = D.walker, Q = window.__P3(), g = Q.gunner, pol = Q.police, DBG = pol._dbg, st = new Set();
  pol.clear(); X.step(2);
  const t = w.telemetry(); pol.crime('punch', { x: t.x, z: t.z }); X.step(2);
  const a = { w0: pol.wanted }; let cop = null, n = 0;
  for (; n < 150 * 60 && pol.state === 'wanted' && !cop; n++) {
    X.step(1);
    for (const f of DBG.offs) if (f.on) { st.add(f.pose.state); if (f.st === 'out' && Math.hypot(f.x - w.telemetry().x, f.z - w.telemetry().z) < 14) cop = f; }
  }
  a.wait = +(n / 60).toFixed(1); a.state = pol.state; if (!cop) return { ...a, err: 'no officer came', poses: [...st].join() };
  const k0 = g.telemetry().knocks, c0 = pol.telemetry().crimes.length; let shots = 0, down = false;
  g.setAim(true); X.step(10);
  for (let i = 0; i < 8 && !down && pol.state === 'wanted'; i++) {
    X.aimAt(cop.x, 1.1, cop.z, 6); shots += X.fire(); for (const f of DBG.offs) if (f.on) st.add(f.pose.state);
    if (cop.st === 'down' || cop.pose.state === 'fall') down = true;
    if (g.telemetry().mag === 0) { g.reload(); X.step(90); }
  }
  g.setAim(false);
  a.cop = { shots, down, st: cop.st, pose: cop.pose.state, crimes: pol.telemetry().crimes.slice(c0).map((c) => c.type).join(), wanted: pol.wanted, knocks: g.telemetry().knocks - k0 };
  let up = false; for (let i = 0; i < 8 * 60 && !up; i++) { X.step(1); for (const f of DBG.offs) if (f.on) st.add(f.pose.state); if (cop.st === 'out' && cop.pose.state !== 'fall' && cop.pose.state !== 'getup') up = true; }
  a.up = up; a.poses = [...st].join(); a.state2 = pol.state;
  return a;
});
console.log('  cop:', JSON.stringify(s6b));
check(s6b.w0 === 1 && !!s6b.cop && s6b.cop.down && /shootCop/.test(s6b.cop.crimes) && s6b.cop.wanted === 2, `shot the officer running at you: he falls over (cartoon), +1 star → ${s6b.cop?.wanted}★ ('${s6b.cop?.crimes}')`);
check(!!s6b.cop && s6b.up && !/aim|shoot/.test(s6b.poses), `he gets back up and keeps chasing; police poses seen: ${s6b.poses} (never aim or shoot)`);
await drawAndShot('6-shot-cop');
// 打大人：6 公尺 → 倒下去、3★（'shoot'）
const s6c = await ev(() => {
  const X = window.__X, D = window.__D(), w = D.walker, Q = window.__P3(), g = Q.gunner, pol = Q.police;
  // 先甩開附近的警察（測試：直接清掉，重新來）
  pol.clear(); X.step(2);
  const t = w.telemetry(), ad = X.person(t.x, t.z, 'adult', 300); if (!ad) return { err: 'no adult' };
  X.faceTo(ad, 6); X.step(5); g.setAim(true); X.step(20);
  const k0 = g.telemetry().knocks, c0 = pol.telemetry().crimes.length; let shots = 0;
  for (let i = 0; i < 4 && !['fall', 'lie', 'getup'].includes(ad.mode); i++) { X.aimAt(ad.x, 1.1, ad.z, 8); shots += X.fire(); }
  X.step(3);
  const a = { shots, m1: ad.mode, age: ad.age, knocks: g.telemetry().knocks - k0, crimes: pol.telemetry().crimes.slice(c0).map((c) => c.type).join(), wanted: pol.wanted, state: pol.state, said: X.toasts.slice(-2), mag: g.telemetry().mag };
  g.setAim(false); X.step(5);
  return a;
});
console.log('  adult:', JSON.stringify(s6c));
check(['fall', 'lie', 'getup'].includes(s6c.m1) && s6c.knocks >= 1 && /shoot/.test(s6c.crimes) && s6c.wanted === 3 && s6c.state === 'wanted' && s6c.said.some((x) => /開槍打人/.test(x)), `shot an adult from 6 m (${s6c.shots} shots): they fall over (no blood), straight to 3 stars 「你開槍打人了！警察全部出動」`);
await drawAndShot('6b-shot-3stars');
// 版面：走路＋3★＋拿槍（全螢幕／一般；換槍的清單打開）
const fs6 = await ev(() => document.body.classList.contains('fs'));
let clash6 = await sizeSweep();
check(fs6 && !clash6, `fullscreen, walking with 3 stars and a gun drawn (開槍, 瞄準, 換彈匣, ammo pill, stars): nothing overlaps at 360×800, 412×915, 915×412, 800×360, 1280×720 (${clash6 || 'ok'})`);
await ev(() => document.querySelector('#stage .gn-pill').click());
const wheel6 = await ev(() => ({ open: window.__X.vis('#stage .gn-wheel'), items: [...document.querySelectorAll('#stage .gn-wheel button span')].map((s) => s.textContent).join() }));
let clashW = await sizeSweep();
await drawAndShot('6c-wheel');
await ev(() => { const b = [...document.querySelectorAll('#stage .gn-wheel button')].find((x) => /手槍/.test(x.textContent)); b && b.click(); window.__X.step(5); });
check(wheel6.open && wheel6.items === '手槍,收起來（空手）' && !clashW, `weapon wheel (tap the ammo pill): 「${wheel6.items}」, no overlaps on any screen (${clashW || 'ok'})`);
await p.evaluate(() => document.getElementById('fsBtn').click()); await p.waitForTimeout(300);
const clashN = await sizeSweep(false);
await drawAndShot('6d-normal-layout');
await p.evaluate(() => document.getElementById('fsBtn').click()); await p.waitForTimeout(300);
check(!clashN && (await ev(() => document.body.classList.contains('fs'))), `normal (not fullscreen) layout, walking + 3★ + gun: no overlaps (${clashN || 'ok'}); fullscreen back on`);
// 3★ 的追：警察很多、從來不開槍（看每一格的動作）→ 被抓 → 拘留室（槍、子彈都還在）→ 繳 6 萬出來
const s6d = await ev(() => {
  const X = window.__X, Q = window.__P3(), pol = Q.police, DBG = pol._dbg, g = Q.gunner, st = new Set(); let maxCars = 0, maxOut = 0, n = 0;
  const own0 = JSON.stringify({ o: window.__G().guns.owned, a: window.__G().guns.ammo, m: window.__G().guns.mag });
  for (; n < 150 * 60 && pol.state === 'wanted'; n++) {
    X.step(1);
    maxCars = Math.max(maxCars, DBG.cars.filter((c) => c.on && c.mode !== 'home').length);
    let o = 0; for (const f of DBG.offs) if (f.on) { o++; st.add(f.pose.state); } maxOut = Math.max(maxOut, o);
  }
  const a = { s: +(n / 60).toFixed(1), state: pol.state, maxCars, maxOut, poses: [...st].join(), drawnCaught: g.telemetry().drawn };
  for (n = 0; n < 6 * 60 && pol.state !== 'jail'; n++) X.step(1);
  X.step(30);
  a.where = X.where(); a.gunHud = X.vis('#stage .gn-pill'); a.fire = X.vis('#stage .gn-fire');
  a.keep = JSON.stringify({ o: window.__G().guns.owned, a: window.__G().guns.ammo, m: window.__G().guns.mag }) === own0;
  a.pay = document.querySelector('#stage .pw-pay')?.textContent;
  const m0 = window.__G().money; document.querySelector('#stage .pw-pay').click();
  for (n = 0; n < 4 * 60 && pol.state !== 'free'; n++) X.step(1);
  X.step(200);
  a.paid = m0 - window.__G().money; a.out = X.where(); a.state2 = pol.state;
  a.keep2 = JSON.stringify({ o: window.__G().guns.owned, a: window.__G().guns.ammo, m: window.__G().guns.mag }) === own0;
  a.btns = [...document.querySelectorAll('#stage .wk-btns b')].map((b) => b.textContent).join(); a.pill = X.vis('#stage .gn-pill');
  return a;
});
console.log('  3★ chase:', JSON.stringify(s6d));
check(s6d.maxCars >= 3 && s6d.state === 'caught' && !/aim|shoot/.test(s6d.poses) && !s6d.drawnCaught, `3 stars: ${s6d.maxCars} police cars (${s6d.maxOut} officers on foot), poses ${s6d.poses}: they never shoot; caught after ${s6d.s} s (gun put away)`);
check(s6d.where === 'police:jail' && !s6d.gunHud && !s6d.fire && s6d.keep && /繳罰款 NT\$ 6 萬/.test(s6d.pay), `jail: no gun buttons in the cell; guns and bullets are NOT taken away; 「${s6d.pay}」`);
check(s6d.paid === 6 && s6d.out === 'out' && s6d.state2 === 'free' && s6d.keep2 && s6d.pill, 'paid 6 萬 → out of the station door, guns all still there (ammo pill back)');
// 開車的時候不能用槍：拿著槍走到停車場的 GC8 → 上車（槍收起來）→ HUD 不見、按 F／扣扳機都不會開槍 → 下車：揍、子彈膠囊回來
const s6e = await ev(() => {
  const X = window.__X, D = window.__D(), H = window.__H, w = D.walker, Q = window.__P3(), g = Q.gunner;
  g.draw('pistol'); X.step(30);
  const a = { drawn0: g.telemetry().drawn, fire0: X.vis('#stage .gn-fire') };
  const car = w.cars.find((c) => c.key === 'gc8'); if (!car) return { ...a, err: 'no gc8', cars: w.cars.map((c) => c.key).join() };
  for (let k = 0; k < 16 && !/上車/.test(H.actText() || ''); k++) { const ang = (k * Math.PI) / 8; w.teleport({ x: car.x + Math.cos(ang) * 2.4, z: car.z - Math.sin(ang) * 2.4, heading: ang + Math.PI }); X.step(4); }
  a.act = H.actText(); a.press = H.press(); a.board = H.board(); X.step(30);
  const d = window.__D().drv; a.drv = !!d;
  const t = g.telemetry(); a.in = { drawn: t.drawn, hud: t.hud, pill: X.vis('#stage .gn-pill'), fire: X.vis('#stage .gn-fire'), aim: X.vis('#stage .gn-aim'), pmode: Q.police.telemetry().player.mode };
  const s0 = g.telemetry().shots;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true })); X.step(10); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF', key: 'f', bubbles: true }));
  g.setTrigger(true); X.step(20); g.setTrigger(false);
  for (const code of ['Digit1', 'KeyQ', 'KeyR', 'KeyV']) { window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })); X.step(2); window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })); } // 選槍、換槍、換彈匣、瞄準的鍵也都沒反應
  X.step(10); a.in.shots = g.telemetry().shots - s0; a.in.drawn2 = g.telemetry().drawn || X.vis('#stage .gn-fire');
  return a;
});
console.log('  drive:', JSON.stringify(s6e));
check(s6e.drawn0 && /上車 · GC8/.test(s6e.press) && s6e.drv && !s6e.in.drawn && !s6e.in.hud && !s6e.in.pill && !s6e.in.fire && s6e.in.shots === 0 && !s6e.in.drawn2 && s6e.in.pmode === 'drive', 'walked to GC8 in the station yard with the pistol out and got in: gun put away, no gun HUD, F / trigger / 1 / Q never fire or draw while driving');
// 版面：開車＋2★（沒全螢幕的手機橫拿：主幹本來就有的重疊（沒通緝也有）不算，只看通緝多出來的）
await p.evaluate(() => document.getElementById('fsBtn').click()); await p.waitForTimeout(300);
const baseN2 = await sizeSweep(false);
const s6f = await ev(() => { const Q = window.__P3(), t = window.__D().drv.telemetry(); Q.police.crime('hit', { x: t.x, z: t.z }); window.__X.step(5); return Q.police.wanted; });
await p.waitForTimeout(400);
const clashN2 = await sizeSweep(false), split = (x) => x.split(' / ').flatMap((r) => { const [sz, l] = r.split(': '); return l ? l.split(', ').map((c) => `${sz}: ${c}`) : []; });
const newN2 = split(clashN2).filter((c) => !split(baseN2).includes(c)).join(', ');
await p.evaluate(() => document.getElementById('fsBtn').click()); await p.waitForTimeout(300);
clash6 = await sizeSweep();
await drawAndShot('6e-driving-2stars');
check(s6f === 2 && !clash6 && !newN2, `driving with 2 stars: fullscreen nothing overlaps on any screen (${clash6 || 'ok'}); normal layout: stars add no overlap (${newN2 || 'ok'}; already in the trunk without stars: ${baseN2 || 'none'})`);
const s6g = await ev(() => {
  const X = window.__X, H = window.__H, D = window.__D(), Q = window.__P3(), g = Q.gunner; Q.police.clear(); X.step(5);
  const out = H.press2(); let n = 0; for (; n < 400 && D.walker.mode !== 'walk'; n++) X.step(1); X.step(20);
  return { out, mode: D.walker.mode, hud: g.telemetry().hud, pill: X.vis('#stage .gn-pill'), btns: [...document.querySelectorAll('#stage .wk-btns b')].map((b) => b.textContent).join(), btnVis: X.vis('#stage .wk-btns'), drawn: g.telemetry().drawn };
});
console.log('  out of car:', JSON.stringify(s6g));
check(s6g.out === '下車' && s6g.mode === 'walk' && s6g.pill && s6g.btns === '揍' && s6g.btnVis && !s6g.drawn, 'got out: walking, 揍 back, ammo pill back (gun stays put away until you pick it)');
// 自首：通緝中自己走進警察局 → 直接關進拘留室（「自首：警察帶你去拘留室」）→ 繳罰款出來
const s6s = await ev(() => {
  const X = window.__X, D = window.__D(), w = D.walker, Q = window.__P3(), t = w.telemetry(); Q.police.crime('punch', { x: t.x, z: t.z }); X.step(5);
  const d = w.doors.find((q) => q.ref && q.ref.kind === 'police'); return { wanted: Q.police.wanted, r: d ? window.__H.toDoor(d) : null };
});
await settleFade();
const s6t = await ev(() => {
  const X = window.__X, Q = window.__P3(), pol = Q.police; let n = 0; for (; n < 6 * 60 && pol.state !== 'jail'; n++) X.step(1); X.step(20);
  const a = { where: X.where(), state: pol.state, said: X.toasts.slice(-3), arrests: pol.telemetry().arrests };
  const m0 = window.__G().money; document.querySelector('#stage .pw-pay')?.click(); for (n = 0; n < 4 * 60 && pol.state !== 'free'; n++) X.step(1); X.step(200);
  a.paid = m0 - window.__G().money; a.out = X.where(); a.state2 = pol.state; return a;
});
console.log('  surrender:', JSON.stringify(s6s), JSON.stringify(s6t));
check(s6s.wanted === 1 && !!s6s.r && s6t.where === 'police:jail' && s6t.said.some((x) => /自首/.test(x)) && s6t.paid === 2 && s6t.out === 'out' && s6t.state2 === 'free', 'wanted, walked into the police station door yourself (the arrest fade, not the door fade): 「自首：警察帶你去拘留室」 → cell → paid 2 萬 → out');
// ---- 7 賽車場（b3-circuit）＋甩尾（b3-drift）＋警察：通緝中不能報名 → 甩掉 → 報名、比賽：警察藏起來、撞人也不算 → 版面（紅燈、名次、手煞車）→ 主直線上手煞車甩尾、胎痕 → 放棄比賽 → 警察回來 ----
const s7a = await ev(() => {
  const X = window.__X, D = window.__D(), H = window.__H, w = D.walker, Q = window.__P3();
  const car = w.cars.find((c) => c.key === 'gc8'); if (!car) return { err: 'no gc8' };
  for (let k = 0; k < 16 && !/上車/.test(H.actText() || ''); k++) { const ang = (k * Math.PI) / 8; w.teleport({ x: car.x + Math.cos(ang) * 2.4, z: car.z - Math.sin(ang) * 2.4, heading: ang + Math.PI }); X.step(4); }
  const press = H.press(); H.board(); X.step(30);
  const d = window.__D().drv, P = D.VIL.places.circuit, t = d.telemetry();
  Q.police.crime('hit', { x: t.x, z: t.z }); X.step(5);
  d.teleport({ x: P.zone.x, z: P.zone.z, heading: P.park.heading }); X.step(90);
  const a = { press, wanted: Q.police.wanted, menu: !!Q.ciMenuEl, said: X.toasts.slice(-3) };
  Q.police.clear(); let n = 0; for (; n < 25 * 60 && !window.__P3().ciMenuEl; n++) X.step(1);
  a.after = { s: +(n / 60).toFixed(1), menu: !!window.__P3().ciMenuEl, opp: document.querySelector('#stage .cir-m .list button[aria-pressed="true"] b')?.textContent };
  return a;
});
console.log('7', el(), JSON.stringify(s7a));
check(s7a.press === '上車 · GC8' && s7a.wanted === 2 && !s7a.menu && s7a.said.some((x) => /警察在追你/.test(x)), 'circuit pit box while wanted (2★): no sign-up, 「警察在追你：先甩掉警察才能報名」');
check(s7a.after.menu, `stars gone: the car parks itself in the pit box and the opponent menu opens (${s7a.after.s} s, ${s7a.after.opp})`);
await ev(() => document.querySelector('#stage .cir-m .row button.a').click());
await p.waitForFunction(() => !!window.__P3().ciRace, null, { timeout: 120000 });
const s7b = await ev(() => {
  const X = window.__X, Q = window.__P3(), pol = Q.police, R = Q.ciRace, t = window.__D().drv.telemetry();
  const a = { st: R.state, en: pol.telemetry().enabled, polRace: !!Q.polRace.on };
  a.w = pol.crime('hit', { x: t.x, z: t.z }); X.step(2); a.w2 = pol.wanted; a.wantCls = document.body.classList.contains('wanted');
  for (let i = 0; i < 160 && R.lights < 3; i++) X.step(1);
  a.lights = R.lights; a.hb = X.vis('#stage .dv-hb'); a.panel = X.vis('#stage .cir-p'); a.lamps = X.vis('#stage .cir-l');
  return a;
});
console.log('  race:', JSON.stringify(s7b));
check(s7b.st === 'grid' && !s7b.en && s7b.polRace && s7b.w === 0 && s7b.w2 === 0 && !s7b.wantCls, 'circuit race: police switched off (hidden), a crime during the race does not count (0★)');
let clash7 = await sizeSweep();
await p.evaluate(() => document.getElementById('fsBtn').click()); await p.waitForTimeout(300);
const clash7n = await sizeSweep(false);
await p.evaluate(() => document.getElementById('fsBtn').click()); await p.waitForTimeout(300);
check(s7b.hb && s7b.panel && s7b.lamps && !clash7 && !clash7n, `race HUD (名次／圈數 panel, red lights) + 手煞車 + driving controls: no overlaps, fullscreen and normal, all 5 sizes (${clash7 || 'ok'} / ${clash7n || 'ok'})`);
const s7c = await ev(() => { const X = window.__X, R = window.__P3().ciRace; let n = 0; for (; n < 12 * 60 && R.state !== 'run'; n++) X.step(1); return { st: R.state, s: +(n / 60).toFixed(1) }; });
await drawAndShot('7-circuit-race-start');
// 主直線：全油門 4 秒 → 手煞車＋方向盤打到底 → 甩尾（胎痕、煙）
const s7d = await ev(() => {
  const X = window.__X, d = window.__D().drv; let maxSlip = 0, maxKmh = 0;
  for (let i = 0; i < 240; i++) { d.setInput({ throttle: 1, brake: 0, steer: 0 }); X.step(1); maxKmh = Math.max(maxKmh, d.telemetry().kmh); }
  const t0 = d.telemetry(); const m0 = t0.marks || 0, n0 = t0.drifts || 0;
  for (let i = 0; i < 45; i++) { d.setInput({ throttle: 0.6, brake: 0, steer: 1, handbrake: 1 }); X.step(1); maxSlip = Math.max(maxSlip, Math.abs(d.telemetry().slip || 0)); }
  for (let i = 0; i < 25; i++) { d.setInput({ throttle: 0.7, brake: 0, steer: 0.4, handbrake: 0 }); X.step(1); maxSlip = Math.max(maxSlip, Math.abs(d.telemetry().slip || 0)); }
  const t = d.telemetry();
  return { kmh: Math.round(maxKmh), slip: +(maxSlip * 180 / Math.PI).toFixed(1), drifts: (t.drifts || 0) - n0, marks: t.marks, smoke: t.smoke, pill: window.__X.vis('#stage .dv-spd i'), onCircuit: window.__D().VIL.circuit.inside(t.x, t.z) };
});
console.log('  drift:', JSON.stringify(s7c), JSON.stringify(s7d));
await drawAndShot('7b-circuit-drift');
check(s7c.st === 'run' && s7d.onCircuit && s7d.slip > 15 && s7d.drifts >= 1 && s7d.marks > 0, `lights out, main straight at ${s7d.kmh} km/h → handbrake + full lock: drift ${s7d.slip}° with ${s7d.marks} skid-mark pieces on the circuit asphalt (marks at 0.04 m: above the asphalt 0.03, under the white lines / curbs 0.042–0.045)`);
await ev(() => {
  const X = window.__X, d = window.__D().drv; d.setInput(null);
  [...document.querySelectorAll('#stage .cir-p button')].find((b) => /放棄/.test(b.textContent))?.click(); X.step(5);
});
await p.waitForTimeout(100); // circuit.src.js：放棄 → setTimeout(ciEnd, 0)
const s7e = await ev(() => {
  const X = window.__X, Q = window.__P3(), d = window.__D().drv; X.step(20);
  const t = d.telemetry(), a = { race: !!window.__P3().ciRace, en: Q.police.telemetry().enabled, polRace: !!Q.polRace.on };
  a.w = Q.police.crime('punch', { x: t.x, z: t.z }); Q.police.clear(); X.step(2); return a;
});
console.log('  quit:', JSON.stringify(s7e));
check(!s7e.race && s7e.en && !s7e.polRace && s7e.w === 1, '放棄比賽: race gone, police back on (crimes count again)');
// 效能（走路、開車都跑過了）
const perf6 = await ev(() => { const Q = window.__P3(), t = Q.police.telemetry(); return { police: t.ms, gs: Q.GS && Q.GS.info }; });
console.log('  perf:', JSON.stringify(perf6));
// 存檔 → 重新整理：槍、子彈、靶場的紀錄都還在
const g6 = await ev(() => JSON.parse(JSON.stringify(window.__G().guns)));
await p.reload({ waitUntil: 'domcontentloaded' }); await ready();
const g6b = await ev(() => JSON.parse(JSON.stringify(window.__G().guns)));
console.log('  reload:', JSON.stringify(g6), JSON.stringify(g6b));
check(g6b.owned.join() === 'pistol' && JSON.stringify(g6b.ammo) === JSON.stringify(g6.ammo) && JSON.stringify(g6b.mag) === JSON.stringify(g6.mag) && g6b.range.paid.pistol === 1 && g6b.range.best.pistol === 6, `save + reload: the pistol, bullets (${g6b.mag.pistol} + ${g6b.ammo.pistol}) and range record are kept`);
await finish();
