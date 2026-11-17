// 第 95 批：寵物＋不會被抓（pet.src.js、petshop.js、police-ai.js setLenient）
// node pet-test.mjs [prefix]
//   「⋯」裡的 🚓：按了變「🚓 不抓」（橘色）、警察不抓（撞人、揍人都沒有星星，有的星星清掉）；再按變回抓
//   走進大便龍寵物店（大停車場西邊）→ 圓台前面「買 · 小豬 200 萬」→ 錢扣掉、存檔 → 小豬跟著你（店裡、出來、走、跑、跳）、頭上「🐾 小豬」
//   「揍」下面「🐾上」：撲前面的人（倒下去再爬起來）、不算你犯罪；小孩、路上的小動物不撲；你揍到的人牠也撲
//   上車開走：牠戴安全帽騎沙灘車跟在後面；下車：跳下來跑到你旁邊
//   再買一隻：圓塔一樓大廳走來走去、「🐾 帶X出門」＝兩隻一起出門（第 97 批）、地毯上「🐾 讓X在家玩」；兩隻排隊跟著、「🐾上」各撲一個、
//   開車兩台沙灘車一台接一台、下車都跑回來；車庫頁也看得到；重新載入還在
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = '/home/claude/beau-car-game/src';
const three = path.join(dir, '../node_modules/three');
const [prefix = 'pet'] = process.argv.slice(2);
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
  + ' window.__PET = () => ({ PET: PETS[0] || PET0, PETS, petTake, petStay, petsOut, LOBBY, PAGEP, PSI: PETSI, copsOff, mode: petModeNow(), petNear, petPedOK, petWithMe, doPunch, petGo, HOP, OB, MRTS, leaveCar, petMount, petHelmet, atvEnsure, PET_RIDE, PET_HELM });'
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
// 開局：GC8＋YARIS；只有第一次載入才放（重新整理要看存的）
await p.addInitScript(() => {
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 650, owned: ['gc8', 'yaris'], parts: {}, tyres: {}, wins: {}, cars: {} })); // 650 萬：買得起小豬＋粉紅（400），變色龍（300）就不夠（第 96 批：便宜 10 倍）
  }
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
// ---- 寵物的小工具 ----
await p.addInitScript(() => {
  const H = () => window.__H;
  window.__Q = {
    pet: () => { const X = window.__PET(), P = X.PET, D = window.__D(), W = D.walker, t = W.telemetry(), g = P.C?.group, ch = W.character.group;
      const root = (o) => { while (o && o.parent) o = o.parent; return o; };
      return { k: P.k, mode: P.mode, want: X.mode, vis: !!g && g.visible && !!g.parent, scene: g ? root(g).name || root(g).type : null, same: !!g && root(g) === root(ch),
        d: g ? +Math.hypot(P.x - ch.position.x, P.z - ch.position.z).toFixed(2) : null, dy: g ? +(P.y - (ch.position.y - (t.jy || 0))).toFixed(2) : null, jy: +P.jy.toFixed(3), v: +P.v.toFixed(2),
        atk: P.atk ? (P.atk.cop ? 'cop' : 'ped') : null, onAtv: P.onAtv, tag: !!g && !!g.getObjectByName('pet-tag'), helm: !!g && !!g.getObjectByName('pet-helmet'),
        atv: P.A.car ? { vis: P.A.car.visible && !!P.A.car.parent, x: +P.A.x.toFixed(1), z: +P.A.z.toFixed(1), v: +P.A.v.toFixed(1), pend: P.A.pend, free: P.A.free } : null,
        wmode: W.mode, x: +t.x.toFixed(1), z: +t.z.toFixed(1), pets: window.__G().pets.slice(), cur: (window.__G().petsOut || []).join(), money: window.__G().money };
    },
    btns: () => [...document.querySelectorAll('#stage .wk-btns b')].filter((e) => !e.closest('[hidden]') && e.getClientRects().length).map((e) => e.textContent.trim()),
    walkFor: (dir, s, run) => { const r = H().push(dir, s, 1, run); return r; },
    // 跟著走：走 s 秒、每 0.5 秒記一次距離
    follow: (dir, s, run) => { const W = window.__D().walker, out = []; for (let i = 0; i < s * 2; i++) { const t = W.telemetry(), a = dir - t.camYaw; for (let k = 0; k < 30; k++) { W.setInput({ x: -Math.sin(a), y: Math.cos(a), run }); H().step(1); } out.push(window.__Q.pet().d); } W.setInput(null); H().step(60); return { ds: out, end: window.__Q.pet() }; },
    adult: (r = 40, x, z) => { const N = window.__N(), t = window.__D().walker.telemetry(); x ??= t.x; z ??= t.z; let best = null, bd = r;
      for (const q of N.peds.people) { if (!window.__PET().petPedOK(q) || q.down || q.mode === 'fall' || q.mode === 'lie') continue; const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q; } } return best; },
  };
});
const Q = (f, a) => p.evaluate(f, a);

// ---- 0 出門 ----
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
await p.waitForFunction(() => !!window.__S() && !window.__D().trip, null, { timeout: 300000 }); await p.waitForTimeout(1500);
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__noDraw = true; window.__H.step(30); });
const p0 = await Q(() => ({ ...window.__Q.pet(), shop: !!window.__D().VIL.places.petshop, b: window.__D().VIL.buildings.filter((b) => b.kind === 'petshop').length, btns: window.__Q.btns() }));
console.log('0', el(), JSON.stringify(p0));
check(p0.shop && p0.b === 1 && !p0.vis && p0.pets.length === 0 && !p0.btns.includes('🐾上'), 'out in the village: one 大便龍寵物店 building, no pet yet, no 🐾上 button');

// ---- 1 「⋯」的 🚓：抓／不抓 ----
const c1 = await Q(() => { const vis = (e) => !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0, b = document.getElementById('copTog'), m = document.getElementById('moreTog'), r = (e) => { const q = e.getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom].map(Math.round); };
  const before = vis(b); m.click(); window.__H.step(2); const open = vis(b), rr = r(b);
  const others = [...document.querySelectorAll('#drivebar button, #stage .wk-btns b, #stage .wk-act, #stage .wk-map, #stage .wk-cam')].filter((e) => e !== b && vis(e)).map((e) => ({ id: e.id || e.className, r: r(e) })).filter((o) => !(o.r[2] <= rr[0] || o.r[0] >= rr[2] || o.r[3] <= rr[1] || o.r[1] >= rr[3]));
  b.click(); window.__H.step(2);
  const pol = window.__pol();
  return { before, open, txt: b.textContent, pressed: b.getAttribute('aria-pressed'), bg: getComputedStyle(b).backgroundColor, lenient: pol.lenient, stored: localStorage.getItem('carid.cops'), toast: window.__H.toast(), overlap: others, rect: rr }; });
console.log('1', el(), JSON.stringify(c1));
check(!c1.before && c1.open && c1.overlap.length === 0, `🚓 only shows when 「⋯」 is open, and it covers no other button (${JSON.stringify(c1.rect)})`);
check(c1.txt === '🚓 不抓' && c1.pressed === 'true' && c1.lenient && c1.stored === 'off' && /不會抓你/.test(c1.toast), `tapped 🚓: it reads 「🚓 不抓」 (${c1.bg}), police lenient, saved on this phone, toast 「${c1.toast}」`);
await drawAndShot('1-cops-off');
const c1b = await Q(() => { const pol = window.__pol(), N = window.__N(), q = window.__Q.adult(60); pol.crime('hit', q ? { x: q.x, z: q.z } : {}); pol.crime('punch', {}); window.__H.step(30); const w1 = pol.wanted;
  document.getElementById('copTog').click(); window.__H.step(2); pol.crime('punch', {}); window.__H.step(10); const w2 = pol.wanted;
  document.getElementById('copTog').click(); window.__H.step(2); const w3 = pol.wanted, st = pol.state;
  document.getElementById('copTog').click(); window.__H.step(2); /* 回到抓 */ pol.clear?.();
  return { w1, w2, w3, st, txt: document.getElementById('copTog').textContent, lenient: pol.lenient }; });
console.log('  crimes:', JSON.stringify(c1b));
check(c1b.w1 === 0 && c1b.w2 > 0 && c1b.w3 === 0 && c1b.txt === '🚓' && !c1b.lenient, `不抓: hitting and punching give no stars (${c1b.w1}); 抓 again: a punch gives ${c1b.w2}★; switching to 不抓 clears them (${c1b.w3}, ${c1b.st})`);
await Q(() => { document.getElementById('moreTog').click(); window.__H.step(2); });

// ---- 2 走進寵物店、買小豬 ----
const s2 = await Q(() => { const D = window.__D(), W = D.walker, d = W.doors.find((q) => q.ref?.kind === 'petshop' || q.kind === 'petshop' || q.b?.kind === 'petshop') || null; return { n: W.doors.length, d: d ? { x: d.x, z: d.z, ax: d.ax, az: d.az, ry: d.ry } : null, keys: W.doors[0] ? Object.keys(W.doors[0]) : [] }; });
console.log('2', el(), JSON.stringify(s2));
const s2b = await Q(() => { const D = window.__D(), W = D.walker, d = W.doors.find((q) => q.ref?.kind === 'petshop' || q.kind === 'petshop' || q.b?.kind === 'petshop');
  const r = window.__H.toDoor(d); let n = 0; for (; n < 400 && window.__IN().doorFade; n++) window.__H.step(1); return { ...r, after: n, indoor: window.__IN().indoor?.kind, toast: window.__H.toast() }; });
await p.waitForTimeout(300); await Q(() => window.__H.step(30));
console.log('  door:', JSON.stringify(s2b));
check(s2b.fade && s2b.indoor === 'petshop', `walked into the pet shop's door: fade, inside 大便龍寵物店 (${s2b.toast})`);
await Q(() => { const W = window.__D().walker, z = window.__PET().PSI.zones[0]; W.setCamera({ mode: 'follow' }); window.__H.walkTo(z.x + 0.5, z.z + 1.6); W.setCamera({ yaw: Math.PI * 0.75, pitch: 0.25 }); window.__H.step(30); });
await drawAndShot('2-shop-inside');
const b2 = await Q(() => { const z = window.__PET().PSI.zones[0], r = window.__H.walkTo(z.x, z.z); window.__H.step(10); const a = window.__H.actText(), m0 = window.__G().money; const pr = window.__H.press(); window.__H.step(30);
  let saved = null; try { saved = JSON.parse(localStorage.getItem('carid.tune')); } catch {} return { r, a, pr, m0, ...window.__Q.pet(), act2: window.__H.actText(), toast: window.__H.toast(), saved: saved && { pets: saved.pets, pet: saved.pet, money: saved.money } }; });
console.log('  buy:', JSON.stringify(b2));
check(b2.a === '買 · 小豬 200 萬' && b2.pr === b2.a, `in front of the pig's stand: 「${b2.a}」`);
check(b2.m0 - b2.money === 200 && b2.pets.join() === 'pig' && b2.cur === 'pig' && b2.saved?.pets?.join() === 'pig' && b2.saved?.pet === 'pig' && /買了小豬/.test(b2.toast), `bought: −200 萬 (${b2.m0} → ${b2.money}), saved pets [pig], toast 「${b2.toast}」`);
check(b2.vis && b2.same && b2.d < 2.5 && b2.tag && /^已經有小豬/.test(b2.act2 || ''), `the pig appears next to you in the shop (${b2.d} m), name tag on; the stand now says 「${b2.act2}」`);
const b2c = await Q(() => { const z = window.__PET().PSI.zones[2]; window.__H.walkTo(z.x, z.z); window.__H.step(10); const a = window.__H.actText(), m0 = window.__G().money; window.__G().money = 250; const pr = window.__H.press(); window.__H.step(10); const r = { a, pr, toast: window.__H.toast(), pets: window.__G().pets.slice(), money: window.__G().money }; window.__G().money = m0; return r; });
console.log('  cham, not enough money:', JSON.stringify(b2c));
check(b2c.a === '買 · 變色龍 300 萬' && /錢不夠/.test(b2c.toast) && b2c.pets.join() === 'pig' && b2c.money === 250, `the chameleon costs 300 萬: with 250 萬 「${b2c.toast}」, nothing bought`);
// 店裡走一圈：跟著
const f2 = await Q(() => { const z = window.__PET().PSI.zones[0]; window.__H.walkTo(z.x + 2.5, z.z + 4); window.__H.step(90); return window.__Q.pet(); });
console.log('  follow in shop:', JSON.stringify(f2));
check(f2.vis && f2.d > 0.6 && f2.d < 2.4 && Math.abs(f2.dy) < 0.05, `walking in the shop: the pig follows ${f2.d} m behind, on the floor`);
// 出去
const o2 = await Q(() => { const e = window.__IN().indoor.exits[0]; const r = window.__H.toExit(e); let n = 0; for (; n < 400 && window.__IN().doorFade; n++) window.__H.step(1); window.__H.step(40); return { r, indoor: !!window.__IN().indoor, ...window.__Q.pet(), btns: window.__Q.btns() }; });
console.log('  out:', JSON.stringify(o2));
check(!o2.indoor && o2.vis && o2.same && o2.scene !== 'petshop' && o2.d < 2 && o2.btns.join() === '跳,揍,🐾上', `walked out: the pig comes out with you (${o2.d} m); the walking buttons are 跳 / 揍 / 🐾上 (${o2.btns.join(' ')})`);

// ---- 3 走、跑、跳 ----
const f3 = await Q(() => { const d = window.__D(), t = d.walker.telemetry(), dir = Math.PI / 2; /* 往北走（停車場） */ const a = window.__Q.follow(dir, 4); const b = window.__Q.follow(dir - 0.6, 3, true); return { a, b }; });
console.log('3', el(), JSON.stringify({ a: f3.a.ds, b: f3.b.ds, end: f3.b.end }));
const mx = (a) => Math.max(...a);
check(mx(f3.a.ds) < 3.2 && f3.a.end.d > 0.5 && f3.a.end.d < 2.2 && Math.abs(f3.a.end.dy) < 0.1, `walking 4 s: the pig stays behind you (most ${mx(f3.a.ds)} m), stops ${f3.a.end.d} m away`);
check(mx(f3.b.ds) < 4.5 && f3.b.end.d < 2.6, `running 3 s: it keeps up (most ${mx(f3.b.ds)} m)`);
await Q(() => { const W = window.__D().walker, t = W.telemetry(); W.setCamera({ yaw: t.heading + 2.4, pitch: 0.18 }); window.__H.step(40); });
await drawAndShot('3-follow');
const j3 = await Q(() => { const W = window.__D().walker; W.jump(); let mj = 0, mp = 0; for (let i = 0; i < 50; i++) { window.__H.step(1); mj = Math.max(mj, W.telemetry().jy || 0); mp = Math.max(mp, window.__PET().PET.jy); } window.__H.step(30); return { mj: +mj.toFixed(2), mp: +mp.toFixed(2), end: window.__Q.pet().jy }; });
console.log('  jump:', JSON.stringify(j3));
check(j3.mj > 0.4 && j3.mp > 0.25 && j3.end === 0, `you jump (${j3.mj} m): the pig hops too (${j3.mp} m) and lands`);
const t3 = await Q(() => { const W = window.__D().walker, t = W.telemetry(); W.teleport({ x: t.x + 30, z: t.z, heading: 0 }); window.__H.step(5); return window.__Q.pet(); });
check(t3.vis && t3.d < 1, `teleported 30 m away: the pig is right at your feet (${t3.d} m)`);

// ---- 4 🐾上：撲人（不算你犯罪）、小孩不撲 ----
const a4 = await Q(() => { const pol = window.__pol(); pol.clear?.(); const W = window.__D().walker, N = window.__N();
  let q = window.__Q.adult(200); if (!q) return { none: true };
  /* 站到他後面 4 公尺、面對他 */ const ang = Math.atan2(-(q.z - W.telemetry().z), q.x - W.telemetry().x);
  W.teleport({ x: q.x - Math.cos(ang) * 4, z: q.z + Math.sin(ang) * 4, heading: ang }); window.__H.step(4);
  q = window.__Q.adult(8) || q; const ang2 = Math.atan2(-(q.z - W.telemetry().z), q.x - W.telemetry().x); W.teleport({ x: W.telemetry().x, z: W.telemetry().z, heading: ang2 }); window.__H.step(2);
  const b = [...document.querySelectorAll('#stage .wk-btns b')].find((e) => e.textContent.trim() === '🐾上'); b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  const atk0 = window.__Q.pet().atk; let hit = -1, mode = null;
  for (let i = 0; i < 360; i++) { window.__H.step(1); if (hit < 0 && (q.mode === 'fall' || q.mode === 'lie' || q.down)) { hit = i; mode = q.mode; } if (hit >= 0 && i > hit + 30) break; }
  const w = pol.wanted; let up = false; for (let i = 0; i < 60 * 8 && !up; i++) { window.__H.step(1); up = !(q.mode === 'fall' || q.mode === 'lie' || q.mode === 'getup' || q.down); }
  return { atk0, hit: +(hit / 60).toFixed(2), mode, w, up, kid: q.age, after: window.__Q.pet() }; });
console.log('4', el(), JSON.stringify(a4));
check(a4.atk0 === 'ped' && a4.hit > 0 && a4.hit < 4 && a4.mode, `🐾上: the pig runs at the nearest grown-up and knocks them down in ${a4.hit} s (${a4.mode})`);
check(a4.w === 0 && a4.up && a4.after.atk === null, `that is not your crime (${a4.w}★); they get back up; the pig comes back to you (${a4.after.d} m)`);
const k4 = await Q(() => { const N = window.__N(), ok = window.__PET().petPedOK; const kids = N.peds.people.filter((q) => q.active && q.age === 'kid'), an = N.peds.people.filter((q) => q.active && q.animal);
  return { kids: kids.length, kidOK: kids.some(ok), an: an.length, anOK: an.some(ok) }; });
console.log('  kids/animals:', JSON.stringify(k4));
check(!k4.kidOK && !k4.anOK && k4.an > 0, `kids (${k4.kids}) and the street animals (${k4.an}) are never targets`);
// 你揍人：牠也撲那一個
const h4 = await Q(() => { const pol = window.__pol(); pol.clear?.(); const W = window.__D().walker; let q = window.__Q.adult(200); if (!q) return { none: true };
  for (let i = 0; i < 60 && q.mode !== 'walk' && q.mode !== 'idle'; i++) window.__H.step(1);
  const ang = Math.atan2(-(q.z - W.telemetry().z), q.x - W.telemetry().x); W.teleport({ x: q.x - Math.cos(ang) * 0.85, z: q.z + Math.sin(ang) * 0.85, heading: ang }); window.__H.step(1);
  window.__PET().doPunch(); const a = window.__Q.pet().atk; window.__H.step(120); const r = { a, w: pol.wanted, mode: q.mode }; pol.clear?.(); return r; });
console.log('  punch:', JSON.stringify(h4));
check(h4.a === 'ped' && h4.w === 1, `you punch someone: the pig goes for the same person (${h4.a}); only your punch counts (${h4.w}★)`);
await Q(() => { window.__H.step(240); });

// ---- 5 開車：騎沙灘車、戴安全帽 ----
const v5 = await Q(() => { const D = window.__D(), W = D.walker, q = D.tripPose[D.cur]; W.teleport({ x: q.x, z: q.z + 3, heading: 0 }); window.__H.step(20); return null; });
await p.evaluate(() => { const H = window.__H, D = window.__D(), W = D.walker, q = D.tripPose[D.cur];
  window.__H.boardCar = () => { const c = Math.cos(q.heading), s = Math.sin(q.heading); let a = null;
    for (const d of [2.0, 2.6, 1.5, 3.2]) { for (const sd of [1, -1]) { W.teleport({ x: q.x + s * d * sd, z: q.z + c * d * sd, heading: q.heading + sd * Math.PI / 2 }); H.step(12); a = H.actText(); if (/^(上車|開車門)/.test(a || '') /* 第 98 批：車門旁邊是「開車門」；getIn() 照樣走去駕駛座的門、門自己打開 */) break; a = null; } if (a) break; }
    H.step(30); W.getIn(); for (let i = 0; i < 900 && W.mode !== 'off'; i++) H.step(1); H.step(30); return { a, mode: W.mode }; }; });
const bd5 = await Q(() => window.__H.boardCar());
console.log('5', el(), JSON.stringify(bd5), JSON.stringify(await Q(() => window.__Q.pet())));
await p.waitForFunction(() => { window.__H.step(2); return !!window.__PET().PET.A.car; }, null, { timeout: 60000, polling: 200 }); // 沙灘車的輕量車載好（要讓出來給 fetch）
const v5b = await Q(() => { const D = window.__D(), d = D.drv; window.__pol()?.clear?.(); d.teleport({ x: 25, z: 2.4, heading: 0 }); window.__H.step(20); /* 400 公尺的直線（往 +x）*/
  const s0 = window.__Q.pet(); const out = []; for (let i = 0; i < 60 * 9; i++) { d.setInput({ throttle: i < 60 * 6 ? 0.7 : 0, brake: i < 60 * 6 ? 0 : 0.6, steer: 0 }); window.__dstep(1); if (i % 30 === 29) { const P = window.__PET().PET, car = D.tripS.car; out.push([+Math.hypot(P.A.x - car.position.x, P.A.z - car.position.z).toFixed(1), +d.telemetry().v.toFixed(1), P.A.car.visible ? 1 : 0]); } }
  d.setInput(null); window.__H.step(60);
  const P = window.__PET().PET, car = D.tripS.car, fx = Math.cos(car.rotation.y), fz = -Math.sin(car.rotation.y), behind = (P.A.x - car.position.x) * fx + (P.A.z - car.position.z) * fz;
  return { s0, out, end: window.__Q.pet(), behind: +behind.toFixed(1), sit: P.C.group.parent === P.A.car }; });
console.log('  drive:', JSON.stringify(v5b));
check(bd5.mode === 'off' && v5b.end.mode === 'car' && v5b.end.onAtv && v5b.end.helm && v5b.sit && v5b.end.atv?.vis, `got in the GC8: the pig sits on its ATV with a helmet on`);
const gaps = v5b.out.filter((q) => q[2]).map((q) => q[0]);
check(gaps.length >= 12 && mx(gaps) < 60 && v5b.behind < -3 && v5b.behind > -14, `driving 6 s then braking: the ATV follows (gaps ${gaps.join(' ')} m), stopped ${-v5b.behind} m behind the car`);
await Q(() => { const W = window.__D().walker; window.__D().drv.setCameraMode?.('chase'); window.__H.step(20); });
await drawAndShot('5-atv');
// 近照：鏡頭擺到沙灘車旁邊
await Q(() => { const D = window.__D(), A = window.__PET().PET.A, cam = D.dcam; window.__hold = true; const c = Math.cos(A.th), s = Math.sin(A.th); cam.position.set(A.x + c * 1.5 - s * 1.6, A.y + 1.05, A.z - s * 1.5 - c * 1.6); cam.lookAt(A.x, A.y + 0.6, A.z); cam.updateMatrixWorld(); });
await drawAndShot('5-atv-close');
await Q(() => { window.__hold = false; });
const dc5 = await frameInfo(4);
console.log('  draw (driving with the ATV):', JSON.stringify(dc5));

// ---- 6 下車：跳下來跑到你旁邊 ----
const o6 = await Q(() => { const H = window.__H, D = window.__D(), W = D.walker; const pr = '下車'; window.__PET().leaveCar(); for (let i = 0; i < 400 && W.mode !== 'walk'; i++) H.step(1); H.step(5); const a = window.__Q.pet(); H.step(120); return { pr, a, b: window.__Q.pet() }; });
console.log('6', el(), JSON.stringify(o6));
check(o6.b.mode === 'walk' && !o6.b.onAtv && !o6.b.helm && o6.b.vis && o6.b.d < 2.5 && o6.b.atv?.vis, `got out (${o6.pr}): the pig hops off (helmet off), runs to you (${o6.b.d} m); the ATV stays parked`);

// ---- 7 再買粉紅：大廳、「🐾 帶粉紅出門」＝兩隻一起出門（第 97 批）、「🐾 讓粉紅在家玩」、排隊跟著、一起撲、兩台沙灘車 ----
const l7 = await Q(() => { const G = window.__G(); G.pets.push('pinky'); /* 測試直接放進去（沒有帶出門）：在大廳玩 */
  const H = window.__H, D = window.__D(), W = D.walker; W.teleport(H.gw(0, 7, 0)); H.step(20); W.teleport(H.gw(-1.5, 5.8, Math.PI)); H.step(90);
  const X = window.__PET(); return { lobby: X.LOBBY.map((L) => L.k), vis: X.LOBBY.map((L) => L.C.group.visible), loc: X.LOBBY.map((L) => [+L.x.toFixed(1), +L.z.toFixed(1)]), pet: window.__Q.pet(), out: X.PETS.map((P) => P.k) }; });
console.log('7', el(), JSON.stringify(l7));
check(l7.lobby.join() === 'pinky' && l7.vis[0] && l7.pet.vis && l7.pet.k === 'pig' && l7.out.join() === 'pig', `bought 粉紅 too: it plays in the tower's lobby; the pig still follows you`);
await Q(() => { const W = window.__D().walker, L = window.__PET().LOBBY[0], w = window.__D().GAR.group.localToWorld(new window.__T3.Vector3(L.x, 0, L.z)); const t = W.telemetry(); W.setCamera({ yaw: Math.atan2(-(w.z - t.z), w.x - t.x), pitch: 0.3 }); window.__H.step(20); });
await drawAndShot('7-lobby');
const take7 = () => Q(() => { const H = window.__H, D = window.__D(), W = D.walker, X = window.__PET(); let a = null;
  for (let i = 0; i < 30 && a !== '🐾 帶粉紅出門'; i++) { const L = X.LOBBY[0]; if (!L) break; const w = D.GAR.group.localToWorld(new window.__T3.Vector3(L.x, 0, L.z)); H.walkTo(w.x, w.z, { tol: 0.8, max: 3 }); H.step(2); a = H.actText(); }
  const pr = H.press(); H.step(30); const sv = JSON.parse(localStorage.getItem('carid.tune'));
  return { a, pr, toast: H.toast(), lobby: X.LOBBY.map((L) => L.k), out: X.PETS.map((P) => P.k), vis: X.PETS.map((P) => !!P.C?.group.visible), saved: { out: sv.petsOut, pet: sv.pet }, btns: window.__Q.btns() }; });
const s7 = await take7();
console.log('  take:', JSON.stringify(s7));
check(s7.a === '🐾 帶粉紅出門' && s7.out.join() === 'pig,pinky' && s7.vis.every(Boolean) && s7.saved.out?.join() === 'pig,pinky' && s7.saved.pet === 'pig' && s7.lobby.length === 0 && /也跟你出門/.test(s7.toast) && s7.btns.includes('🐾上'),
  `next to 粉紅: 「🐾 帶粉紅出門」 → now both go out (${s7.toast}); saved petsOut [pig, pinky], the lobby is empty`);
// 地毯上：「🐾 讓粉紅在家玩」（排最後那一隻），再帶出來
const st7 = await Q(() => { const H = window.__H, D = window.__D(), W = D.walker, X = window.__PET(); W.teleport(H.gw(-2.5, 6.0, Math.PI)); H.step(10); const a = H.actText();
  const pr = H.press(); H.step(30); const sv = JSON.parse(localStorage.getItem('carid.tune'));
  return { a, pr, toast: H.toast(), lobby: X.LOBBY.map((L) => L.k), lvis: X.LOBBY.map((L) => L.C.group.visible), out: X.PETS.map((P) => P.k), saved: sv.petsOut, a2: H.actText() }; });
console.log('  stay:', JSON.stringify(st7));
check(st7.a === '🐾 讓粉紅在家玩' && st7.out.join() === 'pig' && st7.lobby.join() === 'pinky' && st7.lvis[0] && st7.saved?.join() === 'pig' && /在大廳玩/.test(st7.toast), `on the lobby rug: 「${st7.a}」 → 粉紅 stays to play in the lobby, the pig still follows (${st7.toast})`);
const s7b = await take7();
check(s7b.a === '🐾 帶粉紅出門' && s7b.out.join() === 'pig,pinky' && s7b.lobby.length === 0, `and 「🐾 帶粉紅出門」 again: both follow you`);
// 走出去：排隊跟著
const f7 = await Q(() => { const H = window.__H, D = window.__D(), W = D.walker, car = D.tripS.car; W.teleport({ x: car.position.x - 8, z: car.position.z + 6, heading: 0 }); H.step(30);
  const X = window.__PET(), ch = W.character.group, out = [];
  const snap = () => { const [A, B] = X.PETS; return [+Math.hypot(A.x - ch.position.x, A.z - ch.position.z).toFixed(2), +Math.hypot(B.x - ch.position.x, B.z - ch.position.z).toFixed(2), +Math.hypot(A.x - B.x, A.z - B.z).toFixed(2)]; };
  for (let i = 0; i < 8; i++) { const t = W.telemetry(), a = (i < 4 ? 0 : 0.7) - t.camYaw; for (let k = 0; k < 30; k++) { W.setInput({ x: -Math.sin(a), y: Math.cos(a) }); H.step(1); } out.push(snap()); }
  W.setInput(null); H.step(90); return { out, end: snap(), vis: X.PETS.map((P) => P.C.group.visible && P.mode === 'walk'), dy: X.PETS.map((P) => +(P.y - ch.position.y).toFixed(2)) }; });
console.log('  line:', JSON.stringify(f7));
check(f7.vis.every(Boolean) && f7.out.every((q) => q[2] > 0.4) && f7.end[0] < f7.end[1] && f7.end[1] < 4.2 && f7.end[2] > 0.5 && Math.max(...f7.out.map((q) => q[1])) < 6 && f7.dy.every((y) => Math.abs(y) < 0.15),
  `walking: both follow in a line (pig ${f7.end[0]} m, 粉紅 ${f7.end[1]} m behind you; never closer than ${Math.min(...f7.out.map((q) => q[2]))} m to each other)`);
await Q(() => { const W = window.__D().walker, t = W.telemetry(); W.setCamera({ yaw: t.heading + 2.5, pitch: 0.2 }); window.__H.step(30); });
await drawAndShot('7-two-follow');
// 🐾上：兩隻各撲一個（附近有兩個大人的話）
const a7 = await Q(() => { const pol = window.__pol(); pol.clear?.(); const W = window.__D().walker, N = window.__N(), X = window.__PET();
  const ok = (q) => X.petPedOK(q) && !(q.down || q.mode === 'fall' || q.mode === 'lie'); let best = null, bd = 1e9;
  /* 先回到村子的路上（第 4 段撲人的地方；賽車場門口那裡沒有走路的人），等人走出來；兩隻寵物離太遠會跳到腳邊 */
  W.teleport({ x: -309.6, z: -31.5, heading: 0 }); window.__H.step(240);
  /* 兩個站著的大人相距 12 公尺內（人會走動：找不到就等一下再找）；站在兩個人中間旁邊 3 公尺、面對中間 */
  let tries = 0;
  for (; tries < 8 && !best; tries++) {
    if (tries) window.__H.step(120);
    const t = W.telemetry(), ad = N.peds.people.filter((q) => ok(q) && Math.hypot(q.x - t.x, q.z - t.z) < 400);
    for (let i = 0; i < ad.length; i++) for (let j = i + 1; j < ad.length; j++) { const d = Math.hypot(ad[i].x - ad[j].x, ad[i].z - ad[j].z); if (d < 12 && d < bd) { bd = d; best = [ad[i], ad[j]]; } }
  }
  if (!best) return { none: true, people: N.peds.people.length, adults: N.peds.people.filter(ok).length };
  const [qa, qb] = best, mx = (qa.x + qb.x) / 2, mz = (qa.z + qb.z) / 2, ux = qb.x - qa.x, uz = qb.z - qa.z, ul = Math.hypot(ux, uz) || 1, sx = mx - uz / ul * 3, sz = mz + ux / ul * 3;
  const ang = Math.atan2(-(mz - sz), mx - sx); W.teleport({ x: sx, z: sz, heading: ang }); window.__H.step(4);
  const b = [...document.querySelectorAll('#stage .wk-btns b')].find((e) => e.textContent.trim() === '🐾上'); b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  const atk = X.PETS.map((P) => P.atk?.o || null), down = atk.map(() => -1);
  for (let i = 0; i < 400; i++) { window.__H.step(1); atk.forEach((q, j) => { if (q && down[j] < 0 && (q.down || q.mode === 'fall' || q.mode === 'lie')) down[j] = i; }); if (down.every((d, j) => !atk[j] || d >= 0)) break; }
  window.__H.step(200); return { n: atk.filter(Boolean).length, diff: !!atk[0] && !!atk[1] && atk[0] !== atk[1], pair: atk.every((q) => q === qa || q === qb), gap: +bd.toFixed(1), tries, down: down.map((d) => +(d / 60).toFixed(2)), w: pol.wanted }; });
console.log('  both pounce:', JSON.stringify(a7));
check(a7.n === 2 && a7.diff && a7.down?.every((d) => d > 0 && d < 6) && a7.w === 0, `🐾上 with two pets: each one goes for a different grown-up and knocks them down (${a7.down?.join(' / ')} s), not your crime`);
// 上車：兩台沙灘車一台接一台
const bd7 = await Q(() => { const H = window.__H, D = window.__D(), W = D.walker, car = D.tripS.car, q = { x: car.position.x, z: car.position.z, heading: car.rotation.y }, c = Math.cos(q.heading), s = Math.sin(q.heading); let a = null;
  for (const d of [2.0, 2.6, 1.5, 3.2]) { for (const sd of [1, -1]) { W.teleport({ x: q.x + s * d * sd, z: q.z + c * d * sd, heading: q.heading + sd * Math.PI / 2 }); H.step(12); a = H.actText(); if (/^(上車|開車門)/.test(a || '') /* 第 98 批：車門旁邊是「開車門」；getIn() 照樣走去駕駛座的門、門自己打開 */) break; a = null; } if (a) break; }
  H.step(30); W.getIn(); for (let i = 0; i < 900 && W.mode !== 'off'; i++) H.step(1); H.step(30); return { a, mode: W.mode }; });
await p.waitForFunction(() => { window.__H.step(2); return window.__PET().PETS.every((P) => !!P.A.car); }, null, { timeout: 60000, polling: 200 });
const v7 = await Q(() => { const D = window.__D(), d = D.drv, X = window.__PET(); window.__pol()?.clear?.(); d.teleport({ x: 25, z: 2.4, heading: 0 }); window.__H.step(20);
  const car = D.tripS.car, out = [], along = (A) => (A.x - car.position.x) * Math.cos(car.rotation.y) + (A.z - car.position.z) * -Math.sin(car.rotation.y);
  let minGap = 1e9;
  for (let i = 0; i < 60 * 9; i++) { d.setInput({ throttle: i < 60 * 6 ? 0.7 : 0, brake: i < 60 * 6 ? 0 : 0.6, steer: 0 }); window.__dstep(1);
    const [A, B] = X.PETS.map((P) => P.A); if (A.car.visible && B.car.visible) minGap = Math.min(minGap, Math.hypot(A.x - B.x, A.z - B.z));
    if (i % 60 === 59) out.push([+along(A).toFixed(1), +along(B).toFixed(1), A.car.visible ? 1 : 0, B.car.visible ? 1 : 0, +d.telemetry().v.toFixed(1)]); }
  d.setInput(null); window.__H.step(90);
  const [A, B] = X.PETS.map((P) => P.A);
  return { out, end: [+along(A).toFixed(1), +along(B).toFixed(1)], vis: [A.car.visible, B.car.visible], sit: X.PETS.map((P) => P.C.group.parent === P.A.car), minGap: +minGap.toFixed(2), cars: X.PETS.map((P) => P.A.car.name) }; });
console.log('  convoy:', JSON.stringify(bd7), JSON.stringify(v7));
check(bd7.mode === 'off' && v7.vis.every(Boolean) && v7.sit.every(Boolean) && v7.cars[0] !== v7.cars[1], `got in the GC8: the pig and 粉紅 each ride their own ATV (${v7.cars.join(', ')})`);
check(v7.end[0] < -3 && v7.end[1] < v7.end[0] - 2 && v7.end[1] > -24 && v7.minGap > 1.8 && v7.out.filter((q) => q[2] && q[3]).length >= 5, `driving then braking: one ATV after the other (${v7.end[0]} m and ${v7.end[1]} m behind the car; never closer than ${v7.minGap} m)`);
await Q(() => { window.__D().drv.setCameraMode?.('chase'); window.__H.step(20); });
await drawAndShot('7-convoy');
const dc7 = await frameInfo(4);
console.log('  draw (driving with two ATVs):', JSON.stringify(dc7), 'one ATV:', JSON.stringify(dc5));
// 從後面看兩台沙灘車和車子（追車視角看不到後面）
await Q(() => { const D = window.__D(), [A, B] = window.__PET().PETS.map((P) => P.A), car = D.tripS.car, cam = D.dcam; window.__hold = true;
  const c = Math.cos(car.rotation.y), s = Math.sin(car.rotation.y); cam.position.set(B.x - c * 6 + s * 2.5, B.y + 2.6, B.z + s * 6 + c * 2.5); cam.lookAt((A.x + car.position.x) / 2, A.y + 0.6, (A.z + car.position.z) / 2); cam.updateMatrixWorld(); });
await drawAndShot('7-convoy-back');
await Q(() => { window.__hold = false; });
const o7 = await Q(() => { const H = window.__H, W = window.__D().walker, X = window.__PET(); window.__PET().leaveCar(); for (let i = 0; i < 400 && W.mode !== 'walk'; i++) H.step(1); H.step(150);
  const ch = W.character.group; return { d: X.PETS.map((P) => +Math.hypot(P.x - ch.position.x, P.z - ch.position.z).toFixed(2)), mode: X.PETS.map((P) => P.mode), helm: X.PETS.map((P) => !!P.C.group.getObjectByName('pet-helmet')) }; });
console.log('  out:', JSON.stringify(o7));
check(o7.mode.every((m) => m === 'walk') && o7.d.every((d) => d < 5) && !o7.helm.some(Boolean), `got out: both hop off and run to you (${o7.d.join(' / ')} m)`);

// ---- 8 回車庫頁：全部的寵物在大廳；重新載入還在 ----
const g8 = await Q(() => { const b = document.getElementById('driveHome'); b?.click(); return !!b; });
await p.evaluate(() => { window.__hold = false; window.__noDraw = false; });
await p.waitForFunction(() => !window.__D().trip && window.__PET().PAGEP.length >= 2, null, { timeout: 60000, polling: 200 }); await p.waitForTimeout(800);
const g8b = await Q(() => { const X = window.__PET(); return { page: X.PAGEP.map((L) => L.k), par: X.PAGEP.every((L) => L.C.group.parent === window.__room().group), petGone: !X.PET.C?.group.parent }; });
console.log('8', el(), g8, JSON.stringify(g8b));
check(g8 && g8b.page.sort().join() === 'pig,pinky' && g8b.par && g8b.petGone, `back on the garage page: both pets play in the lobby (${g8b.page.join(' ')}); the following pet is put away`);
await p.evaluate(() => { window.__noDraw = false; });
await p.screenshot({ path: `${prefix}-8-garage.png` });
await p.reload({ waitUntil: 'domcontentloaded' }); await ready(); await p.waitForTimeout(1500);
await p.waitForFunction(() => window.__PET().PAGEP.length >= 2, null, { timeout: 60000, polling: 200 }).catch(() => {});
const r8 = await Q(() => ({ pets: window.__G().pets.slice(), out: (window.__G().petsOut || []).slice(), page: window.__PET().PAGEP.map((L) => L.k), cops: localStorage.getItem('carid.cops') }));
console.log('  reload:', JSON.stringify(r8));
check(r8.pets.join() === 'pig,pinky' && r8.out.join() === 'pig,pinky' && r8.page.length === 2, 'reloaded: still own the pig and 粉紅, both go out with you');

console.log(errs.length ? `page errors: ${errs.join(' | ')}` : 'no page errors');
if (errs.length) fails.push('page errors');
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' / ')}` : 'ALL CHECKS OK', el());
await b.close(); srv.close(); process.exit(fails.length ? 1 : 0);
