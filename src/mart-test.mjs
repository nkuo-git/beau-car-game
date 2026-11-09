// 第 81 批：超商買東西＋後車廂（mart.src.js、interiors.js storeFloor 的 spots.shop／till、town.src.js）
// node mart-test.mjs [prefix]；MCAR=yaris（掀背的尾門）／p918（前車廂）／jp4（側開的尾門）／p8（皮卡的尾門）只跑後車廂那一段
// 走進村口超商 → 每個貨架前面「拿 · 洋芋片 39 元」→ 左上「🛒 籃子 9 樣 · 458 元」、清單「放回」→ 錢不夠 → 櫃台「結帳」（萬拆成元、嗶嗶）→ 袋子
// → 拿了沒付錢走出大門＝1★、「嗶嗶嗶！還沒結帳！」→ 被抓：偷的還回去 → 走到車子後面「打開後車廂」（蓋子翻起來）→「放進去」→「關後車廂」→ 存檔、重新載入還在；截圖＋draw calls
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = 'mart'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__R = () => race; window.__G = () => GAME; window.__S = () => S; window.__snd = () => snd; window.__room = () => room; window.__scene = () => scene; window.__controls = () => controls;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }); window.__renderer = () => renderer;'
  + ' window.__money = (n) => { GAME.money = n; save(true); renderWallet(); renderOptions(); refreshCarBtns(); };'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, dvoice, trip, tripS, home, bayLock, snooze, TR, LODS, camGo, cur, built, walker, tripPose, tripFull, boarding, room, liftAnim,'
  + '   TWR, EL, PW, elWho, elFree, poseF, padCars, sleep, gcam, liftSnd, deliver, offTower, normPark, CABIN_EYE, setDest, CARS, PERF, TOWER_BAYS, towerFy, TOWER });'
  + ' window.__HOME = () => HOME; window.__N = () => NPC; window.__NMAX = () => NPC_MAX;'
  + ' window.__pol = () => (typeof police !== "undefined" ? police : null);' // 第 3 批（b3-int）：警察（撞人的測試以後把星星清掉：警察的部分在 test-b3.mjs）
  + ' window.__IN = () => ({ LDR, indoor, doorFade, HOUSE_WARM, interiorFor, buildInterior, DEALER_DOOR, LD, LD_AT, ldAct, ldStyle });'
  + ' window.__APT = () => ({ APTU, A: APTU.A, aptLotOf, APT, aptW });'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } else if (window.__npcKeep) { NPC = window.__npcKeep; window.__npcKeep = null; NPC.g.visible = DRIVE.on; } };'
  + ' window.__look = () => LOOKP; window.__cam = () => ({ maxD: controls.maxDistance, fitD, dist: camera.position.distanceTo(controls.target), pos: camera.position.toArray() }); window.__cea = createEngineAudio; window.__camera = () => camera;'
  + ' window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };'
  + ' window.__T3 = THREE; window.__LK = () => LOOK; window.__box = (o) => new THREE.Box3().setFromObject(o); window.__GH = () => GH; window.__ghostUnpack = (g) => ghostUnpack(g); window.__ghostAt = (G, t, o) => ghostAt(G, t, o);' // 鬼影車排行榜（ghost.src.js）
  + ' window.__MT = () => ({ MART, MART_ITEMS, trunkProbe, trunkVis, trunkRear, trunkItems, martInStore, tripS, cur, GAME, martArrest, indoor });'
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
const K = process.env.MCAR || 'gc8', FULL = K === 'gc8'; // 超商那一段只在 GC8 跑
await p.addInitScript((k) => {
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: k, scene: 'room', money: 470, owned: [...new Set(['gc8', 'yaris', k])], parts: {}, tyres: {}, wins: {}, cars: {} }));
  }
}, K);
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
// ---- 小工具 ----
await p.addInitScript(() => {
  const H0 = () => window.__H;
  window.__L = {
    bw: (b, lx, lz) => { const c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0); return [b.x + lx * c + lz * s, b.z - lx * s + lz * c]; },
    loc: (b, x, z) => { const dx = x - b.x, dz = z - b.z, c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0); return [dx * c - dz * s, dx * s + dz * c]; },
    info: () => { const X = window.__IN(), L = X.LD, D = window.__D(), W = D.walker, t = W.telemetry(); return { b: L.b ? X.interiorFor(L.b).name : null, t: +L.t.toFixed(2), want: L.want, style: L.style, at: X.LD_AT ? X.interiorFor(X.LD_AT).name : null, act: H0().actText(), indoor: !!X.indoor, live: !!X.indoor?.live, kind: X.indoor?.I?.kind, fade: !!X.doorFade, x: +t.x.toFixed(2), z: +t.z.toFixed(2), y: +W.character.group.position.y.toFixed(3), inWorld: W.character.group.parent === D.TR.scene, inHouse: !!X.indoor && W.character.group.parent === X.indoor.scene, fl: X.indoor?.I?.floor ?? null, mode: W.mode, doors: W.doors.length }; },
    // 站在門口前面 d 公尺、面朝門
    approach: (b, d = 1.8, aside = 0) => { const W = window.__D().walker, e = window.__IN().interiorFor(b).enter, nx = Math.sin(b.rot || 0), nz = Math.cos(b.rot || 0), h = Math.atan2(nz, -nx);
      W.teleport({ x: e.x + nx * d, z: e.z + nz * d, heading: h }); W.setCamera({ yaw: h + aside, pitch: 0.12 }); H0().step(30); return window.__L.info(); },
    // 走到門口裡面（外面 → 裡面 d 公尺）：每一格看有沒有黑掉
    walkIn: (b, d = 3) => { const L = window.__L, e = window.__IN().interiorFor(b).enter, nx = Math.sin(b.rot || 0), nz = Math.cos(b.rot || 0); let fade = 0; const W = window.__D().walker, H = H0();
      const tx = e.x - nx * d, tz = e.z - nz * d; for (let n = 0; n < 360; n++) { const t = W.telemetry(); if (Math.hypot(tx - t.x, tz - t.z) < 0.3) break; const a = Math.atan2(-(tz - t.z), tx - t.x) - t.camYaw; W.setInput({ x: -Math.sin(a) * 0.7, y: Math.cos(a) * 0.7 }); H.step(1); if (window.__IN().doorFade) fade++; }
      W.setInput(null); H.step(10); return { ...L.info(), fadeFrames: fade }; },
    walkOut: (b, d = 3) => { const L = window.__L, e = window.__IN().interiorFor(b).enter, nx = Math.sin(b.rot || 0), nz = Math.cos(b.rot || 0); let fade = 0; const W = window.__D().walker, H = H0();
      const tx = e.x + nx * d, tz = e.z + nz * d; for (let n = 0; n < 480; n++) { const t = W.telemetry(); if (Math.hypot(tx - t.x, tz - t.z) < 0.3) break; const a = Math.atan2(-(tz - t.z), tx - t.x) - t.camYaw; W.setInput({ x: -Math.sin(a) * 0.7, y: Math.cos(a) * 0.7 }); H.step(1); if (window.__IN().doorFade) fade++; }
      W.setInput(null); H.step(10); return { ...L.info(), fadeFrames: fade }; },
    faceOut: (b, pitch = 0.05, aside = 0) => { const W = window.__D().walker, nx = Math.sin(b.rot || 0), nz = Math.cos(b.rot || 0); W.setCamera({ yaw: Math.atan2(-nz, nx) + aside, pitch }); H0().step(25); },
    faceIn: (b, pitch = 0.05) => { const W = window.__D().walker, nx = Math.sin(b.rot || 0), nz = Math.cos(b.rot || 0); W.setCamera({ yaw: Math.atan2(nz, -nx), pitch }); H0().step(25); },
    // 門洞中間（世界，高 1.2）投影到畫面（0–1，左上 0）
    doorUV: () => { const X = window.__IN(), L = X.LD, P = L.I.portals[0], cam = window.__D().dcam, y = (L.b.y || 0) + (X.indoor?.live ? 0 : 0) + 1.15;
      const v = new window.__T3.Vector3((P.a[0] + P.b[0]) / 2, y, (P.a[1] + P.b[1]) / 2);
      if (X.indoor?.live) v.y -= (L.b.y || 0); // 在裡面：鏡頭是房子的高度（裡面地板 0）
      v.project(cam); return { u: (v.x + 1) / 2, v: (1 - v.y) / 2, z: v.z }; },
    // 自己畫一次（村子：鏡頭搬到真的高度；裡面：洋紅色的底），拿畫面的點
    alone: async (which, uv) => { const D = window.__D(), X = window.__IN(), L = X.LD, R = window.__renderer(), cam = D.dcam, T3 = window.__T3;
      const yoff = X.indoor?.live ? (L.b.y || 0) + X.indoor.I.floor * 3.3 : 0, cc = R.getClearColor(new T3.Color()), ca = R.getClearAlpha(), ac = R.autoClear;
      const me = D.walker.character.group; me.traverse((o) => o.layers.set(1)); R.setRenderTarget(null); R.autoClear = true;
      if (which === 'world') { cam.position.y += yoff; cam.updateMatrixWorld(); R.render(D.TR.scene, cam); cam.position.y -= yoff; cam.updateMatrixWorld(); }
      else { const base = X.indoor?.live ? 0 : X.LDR?.on ? X.LDR.y : (L.b.y || 0); cam.position.y -= base; cam.updateMatrixWorld(); R.setClearColor(0xff00ff, 1); R.clear(); R.autoClear = false; R.render(L.sc, cam); cam.position.y += base; cam.updateMatrixWorld(); }
      const url = R.domElement.toDataURL(); R.setClearColor(cc, ca); R.autoClear = ac; me.traverse((o) => o.layers.set(0)); window.__hold = false;
      return window.__L.sample(url, uv); },
    sample: (url, uv) => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const out = []; for (const [du, dv] of [[0, 0], [-0.02, 0], [0.02, 0], [0, -0.02], [0, 0.02]]) { const d = g.getImageData(Math.round((uv.u + du) * (im.width - 1)), Math.round((uv.v + dv) * (im.height - 1)), 1, 1).data; out.push([d[0], d[1], d[2]]); } res(out); }; im.src = url; }),
  };
});
const L = (f, a) => p.evaluate(f, a);
// 畫面上的點（截圖，畫布在哪裡照比例）
async function shotPx(uv) { // 你先換到看不到的那一層（walk.js 每一格都會把 visible、大小設回來）（站在門前面會擋住門洞）
  // 畫的那兩格遊戲先停住（__hold：車、人、鏡頭都不動），等一下 alone 自己畫的才是同一個畫面（alone 畫完再放開）
  const n0 = await p.evaluate(() => { window.__hold = true; window.__D().walker.character.group.traverse((o) => o.layers.set(1)); window.__noDraw = false; return window.__dframes || 0; });
  await p.waitForFunction((n) => (window.__dframes || 0) >= n + 2, n0, { timeout: 300000 });
  await p.evaluate(() => { window.__noDraw = true; });
  const r = await p.evaluate(() => { const e = window.__renderer().domElement.getBoundingClientRect(); return [e.left, e.top, e.width, e.height]; });
  const buf = await p.screenshot({ clip: { x: r[0], y: r[1], width: r[2], height: r[3] } });
  return p.evaluate(([b64, uv]) => window.__L.sample('data:image/png;base64,' + b64, uv).then((r) => { window.__D().walker.character.group.traverse((o) => o.layers.set(0)); return r; }), [buf.toString('base64'), uv]);
}
const near = (a, b, tol = 40) => a.filter((q, i) => Math.abs(q[0] - b[i][0]) + Math.abs(q[1] - b[i][1]) + Math.abs(q[2] - b[i][2]) <= tol).length;
const magenta = (a) => a.filter((q) => q[0] > 240 && q[1] < 20 && q[2] > 240).length;
// 一格裡面全部的 draw calls（村子＋裡面＋門洞的圖），平均 n 格
async function frameInfo(n = 4) {
  return p.evaluate(async (n) => { const R = window.__renderer(); window.__noDraw = false; const f0 = window.__dframes || 0; await new Promise((r) => requestAnimationFrame(r));
    R.info.autoReset = false; R.info.reset(); const f1 = window.__dframes || 0;
    while ((window.__dframes || 0) < f1 + n) await new Promise((r) => requestAnimationFrame(r));
    const k = (window.__dframes || 0) - f1, a = { calls: Math.round(R.info.render.calls / k), tris: Math.round(R.info.render.triangles / k) }; R.info.autoReset = true; window.__noDraw = true; return a; }, n);
}
// ---- 0 出門（走路）→ 上車 → 車子搬到超商門口的路上 → 下車 ----
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().tripS, null, { timeout: 300000 });
await p.evaluate(() => { window.__noDraw = true; window.__H.step(30); });
const b0 = await L(() => { const D = window.__D(), H = window.__H, W = D.walker, c = D.tripS.car; c.updateMatrixWorld(); let act = null;
  for (const s of [1, -1]) { const q = new window.__T3.Vector3(0.2, 0, s * 1.45).applyMatrix4(c.matrixWorld); W.teleport({ x: q.x, z: q.z, heading: 0 }); H.step(20); act = H.actText(); if (/^上車/.test(act || '')) break; }
  const pressed = H.press(), r = H.board(); H.step(30); return { act, pressed, ...r, drv: !!window.__D().drv, cur: window.__D().cur }; });
console.log('0', el(), JSON.stringify(b0));
const c0 = await L(() => { const D = window.__D(), b = D.VIL.buildings.find((q) => window.__IN().interiorFor(q)?.kind === 'store'); window.__sb = b; const e = window.__IN().interiorFor(b).enter, r = b.rot || 0, nx = Math.sin(r), nz = Math.cos(r);
  const x = e.x + nx * 7 + Math.cos(r) * 6, z = e.z + nz * 7 - Math.sin(r) * 6; D.drv.teleport({ x, z, heading: r }); window.__dstep(60);
  const H = window.__H, pressed = H.press2(); let m = 0; for (; m < 400 && window.__D().walker.mode !== 'walk'; m++) H.step(1); H.step(20);
  const t = window.__D().drv.telemetry(); return { store: b.name, x: +t.x.toFixed(1), z: +t.z.toFixed(1), paused: t.paused, pressed, mode: window.__D().walker.mode, near: D.drv.colsNear ? D.drv.colsNear(x, z, 2.5).map((c) => c.t + (c.name ? ':' + c.name : '')).join(' ') : '' }; });
console.log('  car parked', JSON.stringify(c0));
check(/^上車/.test(b0.pressed || '') && b0.drv && b0.cur === K && c0.pressed === '下車' && c0.mode === 'walk' && c0.paused, `got in the ${K}, moved it to the street in front of 「${c0.store}」, got out (it stays parked)`);
// 走到車子後面
const rear = () => L(() => { const D = window.__D(), M = window.__MT(), H = window.__H, S = M.tripS, P = M.trunkProbe(S), c = S.car; c.updateMatrixWorld(); const fr = P.front ? -1 : 1; // 前車廂（超跑）：走到車頭前面
  const q = new window.__T3.Vector3(P.front ? P.x1 + 0.55 : P.x0 - 0.55, 0, 0).applyMatrix4(c.matrixWorld), q2 = new window.__T3.Vector3(P.front ? P.x1 + 2.2 : P.x0 - 2.2, 0, 0.6).applyMatrix4(c.matrixWorld);
  D.walker.teleport({ x: q2.x, z: q2.z, heading: 0 }); H.step(10); const r = H.walkTo(q.x, q.z, { tol: 0.25 }); H.step(5);
  const f = new window.__T3.Vector3(fr, 0, 0).transformDirection(c.matrixWorld); D.walker.setCamera({ yaw: Math.atan2(-f.z, f.x) + 0.5, pitch: 0.28 }); H.step(20);
  const R = (v) => +v.toFixed(2); return { P: { kind: P.kind, x0: R(P.x0), x1: R(P.x1), xh: R(P.xh), xr: R(P.xr), y: R(P.y), yB: R(P.yB), W: R(P.W), H: R(P.H), hinge: P.hinge?.map(R), hatch: P.hatch, bed: P.bed }, r: r.ok, act: H.actText(), act2: window.__D().walker.action2 }; });
// 第 83 批：蓋子是車身切下來的那一塊（不是另外加的板子）：幾個網格、幾個三角形；關好了車身換回原本的網格
const lid = () => L(() => { const V = window.__MT().MART.vis; if (!V) return null; const C = V.S._lidCut;
  return { rot: +(V.hinge ? V.hinge.rotation[V.P.axis] : 0).toFixed(2), axis: V.P.axis, t: +V.t.toFixed(2), bags: V.bags.filter((b) => b.visible).length, cav: !!V.cav?.visible,
    lids: V.lids.length, tris: V.lids.reduce((n, m) => n + m.geometry.index.count / 3, 0), moved: (V.moved || []).length, restored: C ? C.parts.every((p) => p.mesh.geometry === p.g0) : null, parts: C ? C.parts.length : 0 }; });
const pressAnd = (n = 50) => L((n) => { const H = window.__H, s = H.press(); H.step(n); return { s, act: H.actText(), act2: window.__D().walker.action2, vis2: H.visible('#stage .wk-act2'), toast: H.toast() }; }, n);
const tr0 = await rear();
console.log('  rear', JSON.stringify(tr0));
if (FULL) {
  check(tr0.r && tr0.act === '打開後車廂' && !tr0.P.hatch && !tr0.P.bed && tr0.P.xh > tr0.P.x0 + 0.5, `walked behind the GC8: 「${tr0.act}」 (a sedan boot: rear ${tr0.P.x0}, lid to ${tr0.P.xh}, deck ${tr0.P.y} m)`);
  const o1 = await pressAnd(), l1 = await lid();
  console.log('  open', JSON.stringify(o1), JSON.stringify(l1));
  check(o1.s === '打開後車廂' && /後車廂是空的/.test(o1.toast) && l1 && l1.rot < -1.1 && l1.cav && l1.bags === 0 && o1.act === '關後車廂', `opened it: the lid swung up (${l1?.rot} rad), 「後車廂是空的」, the button says 「關後車廂」`);
  check(l1.lids > 0 && l1.tris > 300 && !l1.restored, `the lid is the GC8's own boot lid cut out of the body (${l1.lids} meshes, ${l1.tris} triangles; the body shows the rest), not an added plate`);
  await drawAndShot('0-trunk-empty');
  const o2 = await pressAnd(), l2 = await lid();
  check(o2.s === '關後車廂' && l2.rot === 0 && !l2.cav && o2.act === '打開後車廂' && l2.restored && l2.lids === 0, 'closed it again (lid flat, the body is back to its original mesh)');
}
// ---- 1 走進超商：每個貨架前面「拿」 ----
if (FULL) {
  const s0 = await L(() => { const L = window.__L, b = window.__sb; L.approach(b, 1.6); window.__H.step(40); const r = L.walkIn(b, 3); const M = window.__MT(); return { ...r, inStore: M.martInStore(), shop: M.indoor?.I?.spots?.shop?.length, till: M.indoor?.I?.spots?.till?.length, pill: window.__H.visible('.mt-pill') }; });
  console.log('1', el(), JSON.stringify(s0));
  check(s0.inStore && s0.shop === 9 && s0.till === 1 && !s0.pill, `walked into the store: 9 shelf spots and the till; no basket yet`);
  const s1 = await L(() => { const M = window.__MT(), H = window.__H, W = window.__D().walker, out = [];
    for (const s of M.indoor.I.spots.shop) { W.teleport({ x: s.x, z: s.z, heading: s.heading || 0 }); H.step(15); const t = W.telemetry(), act = H.actText(), it = M.MART_ITEMS[s.item];
      out.push({ k: s.item, off: +Math.hypot(t.x - s.x, t.z - s.z).toFixed(2), ok: act === `拿 · ${it.n} ${it.p} 元`, act, took: H.press() }); H.step(5); }
    return { out, basket: M.MART.basket.join(), pill: document.querySelector('.mt-pill')?.textContent, pillVis: H.visible('.mt-pill'), toast: H.toast() }; });
  console.log('  shelves', JSON.stringify(s1));
  check(s1.out.every((q) => q.ok && q.off < 0.3), `every shelf spot is free floor and shows 「拿 · 名字 價錢 元」 (${s1.out.filter((q) => q.ok && q.off < 0.3).length}/9; ${s1.out.filter((q) => !q.ok || q.off >= 0.3).map((q) => q.k + ' ' + q.act + ' off ' + q.off).join(', ')})`);
  check(s1.pillVis && s1.pill === '🛒 籃子 9 樣 · 458 元' && s1.basket.split(',').length === 9, `took one of each: top-left 「${s1.pill}」`);
  // 走得到嗎：裡面走路的格子（interiors.js walkInit：碰撞物往外 GRAD）從大門口 flood fill，每個貨架的點、櫃台都要連得到
  const s1w = await L(() => { const M = window.__MT(), I = M.indoor.I, N = I.floors[0].nav, G = I.group, T3 = window.__T3, b = window.__sb, e = window.__IN().interiorFor(b).enter; if (!N) return { nav: false };
    G.updateMatrixWorld(true); const loc = (x, z) => G.worldToLocal(new T3.Vector3(x, G.position.y, z)), cell = (v) => { const i = Math.floor((v.x - N.x0) / N.gs), j = Math.floor((v.z - N.z0) / N.gs); return i < 0 || j < 0 || i >= N.nx || j >= N.nz ? -1 : i * N.nz + j; };
    const seen = new Uint8Array(N.nx * N.nz), st = []; const s0 = cell(loc(e.x - Math.sin(b.rot) * 1.2, e.z - Math.cos(b.rot) * 1.2)); if (s0 >= 0 && !N.cells[s0]) { seen[s0] = 1; st.push(s0); }
    while (st.length) { const k = st.pop(), i = (k / N.nz) | 0, j = k - i * N.nz; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, c = j + dj; if (a < 0 || c < 0 || a >= N.nx || c >= N.nz) continue; const q = a * N.nz + c; if (!N.cells[q] && !seen[q]) { seen[q] = 1; st.push(q); } } }
    const near = (v) => { const k = cell(v); if (k < 0) return false; const i = (k / N.nz) | 0, j = k - i * N.nz; for (let a = -2; a <= 2; a++) for (let c = -2; c <= 2; c++) { const q = (i + a) * N.nz + j + c; if (i + a >= 0 && j + c >= 0 && i + a < N.nx && j + c < N.nz && seen[q]) return true; } return false; };
    return { nav: true, start: s0 >= 0 && !!seen[s0], bad: [...I.spots.shop, ...I.spots.till].filter((s) => !near(loc(s.x, s.z))).map((s) => s.item || 'till') }; });
  console.log('  reach', JSON.stringify(s1w));
  check(s1w.nav && s1w.start && !s1w.bad.length, `every shelf spot and the till can be walked to from the door (${s1w.bad?.join(', ') || 'all'})`);
  await L(() => { const M = window.__MT(), s = M.indoor.I.spots.shop.find((q) => q.item === 'chips'), W = window.__D().walker; W.teleport({ x: s.x, z: s.z, heading: s.heading || 0 }); W.setCamera({ yaw: (s.heading || 0) + Math.PI, pitch: 0.2 }); window.__H.step(30); });
  await drawAndShot('1-shelf');
  // 清單、放回
  const s2 = await L(() => { const H = window.__H; document.querySelector('.mt-pill').click(); H.step(3); const rows = [...document.querySelectorAll('.mt-list div')].map((d) => d.textContent); const vis = H.visible('.mt-list');
    const btn = [...document.querySelectorAll('.mt-list div')].find((d) => /玩具小車/.test(d.textContent))?.querySelector('button'); btn?.click(); H.step(3);
    const pill = document.querySelector('.mt-pill').textContent, rows2 = document.querySelectorAll('.mt-list div').length; document.querySelector('.mt-pill').click(); H.step(3); return { vis, rows: rows.length, first: rows[0], pill, rows2, closed: !H.visible('.mt-list'), toast: H.toast() }; });
  console.log('  list', JSON.stringify(s2));
  check(s2.vis && s2.rows === 9 && s2.rows2 === 8 && s2.pill === '🛒 籃子 8 樣 · 259 元' && s2.closed && /放回/.test(s2.toast), `tapped the basket: list of 9 with 「放回」; put the toy car back → 「${s2.pill}」; tapped again: list closed`);
  await L(() => { document.querySelector('.mt-pill').click(); window.__H.step(3); }); await drawAndShot('1-basket-list'); await L(() => { document.querySelector('.mt-pill').click(); window.__H.step(3); });
  // ---- 2 櫃台：錢不夠 → 結帳 ----
  const s3 = await L(() => { const M = window.__MT(), H = window.__H, W = window.__D().walker, s = M.indoor.I.spots.till[0]; window.__money(0); M.GAME.yuan = 10;
    W.teleport({ x: s.x, z: s.z, heading: s.heading || 0 }); H.step(15); const t = W.telemetry(), act = H.actText(), pressed = H.press(); H.step(10);
    return { off: +Math.hypot(t.x - s.x, t.z - s.z).toFixed(2), act, pressed, toast: H.toast(), basket: M.MART.basket.length, money: M.GAME.money, yuan: M.GAME.yuan }; });
  console.log('2', el(), JSON.stringify(s3));
  check(s3.off < 0.3 && s3.act === '結帳 · 259 元' && /錢不夠/.test(s3.toast) && s3.basket === 8 && s3.money === 0 && s3.yuan === 10, `at the till 「${s3.act}」 with only 10 元: 「店員：錢不夠喔⋯」, nothing taken`);
  const s4 = await L(() => { const M = window.__MT(), H = window.__H; window.__money(470); M.GAME.yuan = 0; H.step(130); const pressed = H.press(); H.step(10);
    const sv = JSON.parse(localStorage.getItem('carid.tune')); return { pressed, toast: H.toast(), basket: M.MART.basket.length, bag: M.MART.bag.length, money: M.GAME.money, yuan: M.GAME.yuan, saved: [sv.money, sv.yuan], pill: document.querySelector('.mt-pill')?.textContent, act: H.actText() }; });
  console.log('  paid', JSON.stringify(s4));
  check(s4.pressed === '結帳 · 259 元' && /一共 259 元/.test(s4.toast) && s4.basket === 0 && s4.bag === 8 && s4.money === 469 && s4.yuan === 9741 && s4.saved[0] === 469 && s4.saved[1] === 9741 && s4.pill === '🛍 袋子 8 樣', `paid: 「${s4.toast}」; 1 萬 broken into change (469 萬 + 9741 元, saved); 「${s4.pill}」`);
  await L(() => { const M = window.__MT(), s = M.indoor.I.spots.till[0], W = window.__D().walker; W.setCamera({ yaw: (s.heading || 0) + Math.PI + 0.4, pitch: 0.15 }); window.__H.step(20); });
  await drawAndShot('2-till'); const fi2 = await frameInfo(); console.log('  till frame', JSON.stringify(fi2));
  // ---- 3 沒付錢走出去 ----
  const s5 = await L(() => { const M = window.__MT(), H = window.__H, W = window.__D().walker; for (const k of ['chips', 'drink']) { const s = M.indoor.I.spots.shop.find((q) => q.item === k); W.teleport({ x: s.x, z: s.z, heading: 0 }); H.step(10); H.press(); H.step(5); }
    const n = M.MART.basket.length, b = window.__sb, e = window.__IN().interiorFor(b).enter; W.teleport({ x: e.x - Math.sin(b.rot) * 1.6, z: e.z - Math.cos(b.rot) * 1.6, heading: 0 }); H.step(10); const r = window.__L.walkOut(b, 4); return { n, r, stolen: M.MART.stolen.length, bag: M.MART.bag.length, basket: M.MART.basket.length }; });
  await p.waitForTimeout(400);
  const s5b = await L(() => { const t = window.__pol().telemetry(); return { wanted: t.wanted, crimes: t.crimes.map((c) => c.type).join(), toast: window.__H.toast(), pill: document.querySelector('.mt-pill')?.textContent }; });
  console.log('3', el(), JSON.stringify(s5), JSON.stringify(s5b));
  check(s5.n === 2 && !s5.r.indoor && s5.stolen === 2 && s5.bag === 10 && s5.basket === 0 && s5b.wanted >= 1 && /steal/.test(s5b.crimes) && /還沒結帳/.test(s5b.toast), `took 2 more and walked out without paying: 「${s5b.toast}」, ${s5b.wanted}★ (steal)`);
  const s6 = await L(() => { const M = window.__MT(); M.martArrest(); window.__pol().clear(); window.__H.step(5); return { bag: M.MART.bag.length, stolen: M.MART.stolen.length }; });
  check(s6.bag === 8 && s6.stolen === 0, 'caught: the stolen things go back to the store (the 8 you paid for stay in the bag)');
  // ---- 4 放進後車廂 ----
  const t4 = await rear();
  console.log('4', el(), JSON.stringify(t4));
  const o4 = await pressAnd(), l4 = await lid();
  console.log('  open', JSON.stringify(o4), JSON.stringify(l4));
  check(t4.act === '打開後車廂' && o4.s === '打開後車廂' && o4.act === '放進去' && o4.act2 === '關後車廂' && o4.vis2 && l4.rot < -1.1, 'behind the car with a bag: 「打開後車廂」 → open; the big button is 「放進去」, the second 「關後車廂」');
  const o5 = await pressAnd(20), l5 = await lid(), sv5 = await L(() => { const M = window.__MT(), sv = JSON.parse(localStorage.getItem('carid.tune')); return { trunk: M.GAME.trunk.gc8?.length, saved: sv.trunk?.gc8?.length, bag: M.MART.bag.length, pill: window.__H.visible('.mt-pill') }; });
  console.log('  put', JSON.stringify(o5), JSON.stringify(l5), JSON.stringify(sv5));
  check(o5.s === '放進去' && /放進後車廂了/.test(o5.toast) && sv5.trunk === 8 && sv5.saved === 8 && sv5.bag === 0 && !sv5.pill && l5.bags === 3 && o5.act === '關後車廂', `「放進去」: 「${o5.toast}」; 8 things in the GC8's boot (saved), 3 bags visible, the bag pill is gone`);
  await drawAndShot('4-trunk-bags'); const fi4 = await frameInfo(); console.log('  trunk frame', JSON.stringify(fi4));
  check(fi4.calls < 400, `trunk open next to the store: ${fi4.calls} calls / ${fi4.tris} triangles`);
  const o6 = await pressAnd(), l6 = await lid();
  check(o6.s === '關後車廂' && l6.rot === 0 && l6.bags === 0, 'closed the boot (bags hidden inside)');
  // 開著走遠：自己關
  const o7 = await L(() => { const H = window.__H, D = window.__D(); H.press(); H.step(50); const V = window.__MT().MART.vis, a = V.t; const t = D.walker.telemetry(), c = window.__MT().tripS.car.position; H.walkTo(t.x + (t.x - c.x) * 4, t.z + (t.z - c.z) * 4, { max: 10 }); H.step(60); return { a: +a.toFixed(2), b: +V.t.toFixed(2), want: V.want }; });
  check(o7.a === 1 && o7.b === 0 && o7.want === 0, `opened and walked away: it shut by itself (${o7.a} → ${o7.b})`);
  // 重新載入：後車廂的東西還在
  await p.reload({ waitUntil: 'domcontentloaded' }); await ready();
  await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
  await p.waitForFunction(() => window.__D().on && window.__D().walker, null, { timeout: 300000 });
  const r8 = await L(() => { window.__noDraw = true; window.__H.step(10); const M = window.__MT(); return { trunk: M.GAME.trunk.gc8?.join(), yuan: M.GAME.yuan, money: M.GAME.money, bag: M.MART.bag.length }; });
  console.log('5', el(), JSON.stringify(r8));
  check(r8.trunk?.split(',').length === 8 && r8.yuan === 9741 && r8.money === 469 && r8.bag === 0, `reloaded: the GC8's boot still has ${r8.trunk?.split(',').length} things, change 9741 元`);
} else {
  // ---- 別的車：照真的車怎麼開（第 83 批）：YARIS 掀背、918 前車廂、J4 側開、P8 尾門往下 ----
  const KIND = { yaris: 'hatch', supra: 'hatch', rx7: 'hatch', ae86: 'hatch', civic: 'hatch', p918: 'frunk', sp3: 'frunk', jesko: 'frunk', chiron: 'frunk', aventador: 'frunk', huayra: 'frunk', laferrari: 'frunk', jp4: 'swing', k2: 'swing', p8: 'drop' }[K] || 'trunk'; // 照真的車（中置引擎的超跑放前面）
  const nm = KIND === 'frunk' ? '前車廂' : '後車廂', openTxt = KIND === 'drop' ? '放下尾門' : `打開${nm}`, closeTxt = KIND === 'drop' ? '關尾門' : `關${nm}`, putTxt = KIND === 'drop' ? '放進車斗' : '放進去';
  check(tr0.r && tr0.P.kind === KIND && tr0.act === openTxt, `${K}: opens like the real car (${KIND}): 「${tr0.act}」 (${JSON.stringify(tr0.P)})`);
  const o1 = await pressAnd(), l1 = await lid();
  console.log('  open', JSON.stringify(o1), JSON.stringify(l1));
  const angOK = { hatch: l1.rot < -1.2 && l1.axis === 'z', frunk: l1.rot > 1.0 && l1.axis === 'z', swing: l1.rot > 1.6 && l1.axis === 'y', drop: l1.rot > 1.4 && l1.axis === 'z', trunk: l1.rot < -1.1 }[KIND];
  check(angOK && l1.lids > 0 && l1.tris > 200 && !l1.restored && (KIND === 'drop' || l1.cav), `the ${KIND === 'frunk' ? 'front lid' : KIND === 'swing' ? 'side-hinged rear door' : KIND === 'trunk' ? 'boot lid' : 'tailgate'} cut out of the body swung open (${l1.axis} ${l1.rot} rad; ${l1.lids} meshes, ${l1.tris} triangles${l1.moved ? `, ${l1.moved} parts riding on it` : ''})`);
  await drawAndShot(`${K}-open`);
  await L(() => { window.__MT().MART.bag.push('chips', 'water', 'noodle', 'egg'); window.__H.step(5); });
  const o2 = await pressAnd(20), l2 = await lid(), sv = await L((k) => window.__MT().GAME.trunk[k]?.length, K);
  console.log('  put', JSON.stringify(o2), JSON.stringify(l2), sv);
  check(o2.s === putTxt && l2.bags === 2 && sv === 4 && o2.act === closeTxt, `「${putTxt}」: 2 bags inside (${sv} things saved); the button says 「${o2.act}」`);
  await drawAndShot(`${K}-bags`);
  const o3 = await pressAnd(60), l3 = await lid();
  check(o3.s === closeTxt && l3.rot === 0 && l3.restored && l3.lids === 0 && (KIND === 'drop' ? l3.bags === 2 : l3.bags === 0), `「${closeTxt}」: shut, the body is whole again${KIND === 'drop' ? ' (bags still visible in the bed)' : ''}`);
}
check(errs.length === 0, `no page errors (${errs.length})`);
console.log(fails.length ? `FAILED (${fails.length}):\n  ${fails.join('\n  ')}` : 'ALL CHECKS OK', el());
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
