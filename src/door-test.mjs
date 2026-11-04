// 第 65 批：房子窗戶看得到外面、門自己開（interiors.js live、town.src.js LD）
// node door-test.mjs [prefix]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = 'door'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__R = () => race; window.__G = () => GAME; window.__S = () => S; window.__snd = () => snd; window.__room = () => room; window.__scene = () => scene; window.__controls = () => controls;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }); window.__renderer = () => renderer;'
  + ' window.__money = (n) => { GAME.money = n; save(true); renderWallet(); renderOptions(); refreshCarBtns(); };'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, dvoice, trip, tripS, home, bayLock, snooze, TR, LODS, camGo, cur, built, walker, tripPose, tripFull, boarding, room, liftAnim,'
  + '   TWR, EL, PW, elWho, elFree, poseF, padCars, sleep, gcam, liftSnd, deliver, offTower, normPark, CABIN_EYE, setDest, CARS, PERF, TOWER_BAYS, towerFy, TOWER });'
  + ' window.__HOME = () => HOME; window.__N = () => NPC; window.__NMAX = () => NPC_MAX;'
  + ' window.__pol = () => (typeof police !== "undefined" ? police : null);' // 第 3 批（b3-int）：警察（撞人的測試以後把星星清掉：警察的部分在 test-b3.mjs）
  + ' window.__IN = () => ({ indoor, doorFade, HOUSE_WARM, interiorFor, buildInterior, DEALER_DOOR, LD, LD_AT, ldAct, ldStyle });'
  + ' window.__APT = () => ({ APTU, A: APTU.A, aptLotOf, APT, aptW });'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } else if (window.__npcKeep) { NPC = window.__npcKeep; window.__npcKeep = null; NPC.g.visible = DRIVE.on; } };'
  + ' window.__look = () => LOOKP; window.__cam = () => ({ maxD: controls.maxDistance, fitD, dist: camera.position.distanceTo(controls.target), pos: camera.position.toArray() }); window.__cea = createEngineAudio; window.__camera = () => camera;'
  + ' window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };'
  + ' window.__T3 = THREE; window.__LK = () => LOOK; window.__box = (o) => new THREE.Box3().setFromObject(o); window.__GH = () => GH; window.__ghostUnpack = (g) => ghostUnpack(g); window.__ghostAt = (G, t, o) => ghostAt(G, t, o);' // 鬼影車排行榜（ghost.src.js）
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
// 開局：GC8＋YARIS、NT$ 470 萬（買得起 SUPRA 200 萬＋零件；車子半價以後）；只有第一次載入才放（重新整理要看存的）
await p.addInitScript(() => {
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 470, owned: ['gc8', 'yaris'], parts: {}, tyres: {}, wins: {}, cars: {},
      dmg: { gc8: { v: 1, h: [[0, 2.1, 0, 1, 9, 0, 0.6, 0.5, 1, 0.4]], x: 0, hp: 0.2, gl: 0, lp: 0, pt: 0 } } })); // 舊存檔：GC8 撞過（撞爛拿掉了：一載入就當作好的）
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
      else { const base = X.indoor?.live ? 0 : (L.b.y || 0); cam.position.y -= base; cam.updateMatrixWorld(); R.setClearColor(0xff00ff, 1); R.clear(); R.autoClear = false; R.render(L.sc, cam); cam.position.y += base; cam.updateMatrixWorld(); }
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
// ---- 0 出門（走路） ----
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker, null, { timeout: 300000 });
await p.evaluate(() => { window.__noDraw = true; window.__H.step(30); });
const k0 = await L(() => { const D = window.__D(), X = window.__IN(), out = {}; for (const b of D.VIL.buildings) { const I = X.interiorFor(b); if (!I) continue; const k = I.kind + (b.front === 'shop' ? '-shop' : ''); (out[k] ||= 0); out[k]++; }
  return { kinds: out, styles: [...new Set(D.VIL.buildings.filter((b) => X.interiorFor(b)).map((b) => `${X.interiorFor(b).kind}${b.front === 'shop' ? '-shop' : ''}:${X.ldStyle(b)}`))].sort(), offs: D.VIL.colliders.filter((c) => c.off === true).length }; });
console.log('0', el(), JSON.stringify(k0));
check(/apt:hinge/.test(k0.styles) && /farmhouse:hinge/.test(k0.styles) && /house:hinge/.test(k0.styles) && /house-shop:open/.test(k0.styles) && /store:auto/.test(k0.styles) && /temple:open/.test(k0.styles),
  `door kinds: houses, farmhouse and apartments open with 「開門」, the store's door slides by itself, shop fronts and the temple are open (${k0.styles.join(' ')})`);
// ---- 1 透天厝：門關著擋人 → 按「開門」→ 門打開（不黑掉）→ 門洞看得到裡面 ----
const h0 = await L(() => { const D = window.__D(), X = window.__IN(), W = D.walker, t = W.telemetry();
  const b = D.VIL.buildings.filter((q) => X.interiorFor(q)?.kind === 'house' && q.front !== 'shop').sort((a, c) => Math.hypot(a.x - t.x, a.z - t.z) - Math.hypot(c.x - t.x, c.z - t.z))[0]; window.__hb = b;
  const a = window.__L.approach(b);
  // 門關著：往門推 1.5 秒（沒按開門）
  const r = window.__H.push(Math.atan2(Math.cos(b.rot), -Math.sin(b.rot)), 1.5, 0.8), [, lz] = window.__L.loc(b, r.x, r.z);
  return { name: X.interiorFor(b).name, a, lz: +lz.toFixed(2), hz: b.hz, after: window.__L.info() }; });
console.log('1', el(), JSON.stringify(h0));
check(h0.a.act === '開門' && h0.a.b === null && !h0.a.indoor && h0.lz > h0.hz && !h0.after.indoor && !h0.after.fade, `at a house door (${h0.name}): the button says 「開門」; pushing into the closed door keeps you outside (${h0.lz} m from the middle, wall at ${h0.hz}), no fade`);
const h1 = await L(() => { const L = window.__L; L.approach(window.__hb); const pressed = window.__H.press(); let n = 0; for (; n < 120 && window.__IN().LD.t < 1; n++) window.__H.step(1); return { pressed, s: +(n / 60).toFixed(2), ...L.info() }; });
console.log('  open:', JSON.stringify(h1));
check(h1.pressed === '開門' && h1.t === 1 && h1.s <= 0.8 && !h1.fade && !h1.indoor && h1.b === h0.name && h1.act === null && h1.inWorld, `pressed 「開門」: the door swings open in ${h1.s} s (no fade), you are still outside`);
await L(() => { window.__D().walker.setCamera({ yaw: window.__D().walker.telemetry().camYaw + 0.5 }); window.__H.step(25); });
const uv1 = await L(() => window.__L.doorUV());
const px1 = await shotPx(uv1), in1 = await L((uv) => window.__L.alone('in', uv), uv1);
await drawAndShot('1-house-open');
console.log('  door px', JSON.stringify(uv1), JSON.stringify(px1), 'inside alone', JSON.stringify(in1));
check(uv1.z < 1 && near(px1, in1) >= 4 && magenta(in1) <= 1, `through the open door you see the real inside of the house (screen ≈ the inside drawn alone at ${near(px1, in1)}/5 points around the doorway)`);
// ---- 2 走進去：不黑掉，就在裡面；回頭從門看出去＝真的街 ----
const h2 = await L(() => window.__L.walkIn(window.__hb, 3));
console.log('2', el(), JSON.stringify(h2));
check(h2.live && h2.indoor && h2.kind === 'house' && h2.inHouse && h2.fadeFrames === 0 && Math.abs(h2.y) < 0.01 && h2.mode === 'walk', `walked in through the door: inside the house with no fade at all (${h2.fadeFrames} fade frames), standing on the floor`);
await L(() => window.__L.faceOut(window.__hb));
const uv2 = await L(() => window.__L.doorUV());
const px2 = await shotPx(uv2), w2 = await L((uv) => window.__L.alone('world', uv), uv2), i2 = await L((uv) => window.__L.alone('in', uv), uv2);
await drawAndShot('2-house-lookout');
console.log('  look out px', JSON.stringify(uv2), JSON.stringify(px2), 'world', JSON.stringify(w2), 'inside', JSON.stringify(i2));
check(uv2.z < 1 && magenta(i2) >= 4 && near(px2, w2) >= 4, `looking back out of the door from inside: the doorway is open (the inside has nothing there) and shows the real street (screen ≈ the village drawn alone at ${near(px2, w2)}/5 points)`);
const ri2 = await L(() => window.__rinfo()), r2 = await frameInfo();
console.log(`  draw calls inside the house: house ${ri2.calls}/${ri2.tris}, whole frame (village + house) ${r2.calls}/${r2.tris}`);
check(ri2.calls < 40 && r2.calls < 420, `inside the house: the house is ${ri2.calls} draw calls, the whole frame with the village through the windows ${r2.calls} calls / ${r2.tris} triangles`);
// ---- 3 走出去：不黑掉、回到村子；走遠了門自己關、收掉；門關著牆擋人 ----
const h3 = await L(() => window.__L.walkOut(window.__hb, 2.5));
console.log('3', el(), JSON.stringify(h3));
check(!h3.indoor && h3.inWorld && h3.fadeFrames === 0 && Math.abs(h3.y) < 0.05 && h3.doors > 20 && h3.mode === 'walk', `walked back out: in the village again with no fade (village doors back: ${h3.doors})`);
const h4 = await L(() => { const L = window.__L, b = window.__hb, e = window.__IN().interiorFor(b).enter, nx = Math.sin(b.rot), nz = Math.cos(b.rot); const r = window.__H.walkTo(e.x + nx * 8, e.z + nz * 8); window.__H.step(90);
  const a = L.info(), offs = window.__D().VIL.colliders.filter((c) => c.off === true).length; const wall = window.__H.wallHolds({ ...b, door: { ...b.door, x: e.x, z: e.z, ry: Math.atan2(-nx, -nz) } }); return { ...a, walked: r.ok, offs, wall }; });
console.log('  away:', JSON.stringify(h4));
check(h4.walked && h4.b === null && h4.t === 0 && h4.offs === k0.offs && h4.wall.inside === false, `walked 8 m away: the door closed by itself and the house is put away (its wall box is back: pushing into the wall stops you after ${h4.wall.moved} m)`);
// ---- 4 超商：自動門（走近就開、走開就關），走進去、從玻璃看出去 ----
const s0 = await L(() => { const D = window.__D(), b = D.VIL.buildings.find((q) => window.__IN().interiorFor(q)?.kind === 'store'); window.__sb = b; const a = window.__L.approach(b, 1.6); window.__H.step(40); return { name: b.name, a, now: window.__L.info() }; });
console.log('4', el(), JSON.stringify(s0));
check(s0.now.b === s0.name && s0.now.style === 'auto' && s0.now.t === 1 && s0.now.act !== '開門' && !s0.now.fade, `walked up to 「${s0.name}」: its glass door slid open by itself (no button)`);
const s1 = await L(() => window.__L.walkIn(window.__sb, 3));
check(s1.live && s1.kind === 'store' && s1.inHouse && s1.fadeFrames === 0, `walked into the store, no fade`);
await L(() => window.__L.faceOut(window.__sb, 0.05, 0.45));
const uv4 = await L(() => window.__L.doorUV()), px4 = await shotPx(uv4), w4 = await L((uv) => window.__L.alone('world', uv), uv4);
await drawAndShot('4-store-lookout');
console.log('  store px', JSON.stringify(px4), JSON.stringify(w4));
check(near(px4, w4) >= 4, `from inside the store you see the street through the door (${near(px4, w4)}/5)`);
const s2 = await L(() => { const L = window.__L, r = L.walkOut(window.__sb, 4); window.__H.step(60); return { ...r, later: L.info() }; });
const s3 = await L(() => { const W = window.__D().walker, b = window.__sb, e = window.__IN().interiorFor(b).enter, nx = Math.sin(b.rot), nz = Math.cos(b.rot), tx = Math.cos(b.rot), tz = -Math.sin(b.rot); W.teleport({ x: e.x + nx * 4 + tx * 24, z: e.z + nz * 4 + tz * 24, heading: 0 }); window.__H.step(30); return window.__L.info(); });
console.log('  store out:', JSON.stringify(s2), JSON.stringify(s3));
check(!s2.indoor && s2.fadeFrames === 0 && s2.later.t === 0 && s3.b === null, `walked out: the auto door closed behind you (t ${s2.later.t}); 25 m away the store is put away`);
// ---- 5 店面（整面開著）：走近就蓋好、門洞一直開著，走得進去 ----
const o0 = await L(() => { const D = window.__D(), W = D.walker, t = W.telemetry(), b = D.VIL.buildings.filter((q) => window.__IN().interiorFor(q)?.kind === 'house' && q.front === 'shop').sort((a, c) => Math.hypot(a.x - t.x, a.z - t.z) - Math.hypot(c.x - t.x, c.z - t.z))[0]; window.__ob = b;
  const a = window.__L.approach(b, 1.6); const r = window.__L.walkIn(b, 1.2); return { name: b.name, a, r }; });
console.log('5', el(), JSON.stringify(o0));
check(o0.a.b === o0.name && o0.a.style === 'open' && o0.a.t === 1 && o0.a.act !== '開門' && o0.r.live && o0.r.fadeFrames === 0, `a shop front (${o0.name}) is open: walked straight in, no button, no fade`);
const o1 = await L(() => window.__L.walkOut(window.__ob, 3));
check(!o1.indoor && o1.inWorld && o1.fadeFrames === 0, 'and straight back out');
// ---- 6 公寓：開門、走進大廳（沒有人）、大門的玻璃藏起來；出來、走遠了玻璃回來 ----
const a0 = await L(() => { const D = window.__D(), HM = window.__HOME(), b = D.VIL.buildings.find((q) => q.kind === 'apt' && q.slot === HM.slot); window.__ab = b; const L = window.__L, a = L.approach(b); const pressed = window.__H.press(); window.__H.step(50); return { name: b.name, a, pressed, now: L.info() }; });
const a1 = await L(() => { const L = window.__L, r = L.walkIn(window.__ab, 3), X = window.__IN(), A = window.__APT(), D = window.__D();
  const sc = (k) => { const m = D.TR.scene.children.find((o) => o.name === k), M = new window.__T3.Matrix4(); m.getMatrixAt(window.__ab.slot, M); return +M.elements[0].toFixed(2); };
  return { ...r, folks: X.indoor?.folks?.length ?? -1, door: sc('apt-door'), glass: sc('apt-glass'), tile: sc('apt-tile') }; });
console.log('6', el(), JSON.stringify(a0), JSON.stringify(a1));
check(a0.pressed === '開門' && a0.now.t === 1 && a1.live && a1.kind === 'apt' && a1.fl === 0 && a1.fadeFrames === 0 && a1.folks === 0, `the apartment: 「開門」, walked into the lobby with no fade, and nobody else lives there (${a1.folks} people)`);
check(a1.door === 0 && a1.glass === 0 && Math.abs(Math.abs(a1.tile) - 1) < 0.01, `inside, this apartment's dark door glass and window glass are hidden (the windows look out); the walls stay`);
await L(() => window.__L.faceOut(window.__ab, 0.05, 0.45));
const uv6 = await L(() => window.__L.doorUV()), px6 = await shotPx(uv6), w6 = await L((uv) => window.__L.alone('world', uv), uv6);
await drawAndShot('6-apt-lookout');
check(near(px6, w6) >= 4, `from the lobby you see the street through the open glass door (${near(px6, w6)}/5)`);
const a2 = await L(() => { const L = window.__L, b = window.__ab, r = L.walkOut(b, 2.5), e = window.__IN().interiorFor(b).enter, nx = Math.sin(b.rot), nz = Math.cos(b.rot); window.__H.walkTo(e.x + nx * 9, e.z + nz * 9); window.__H.step(90);
  const D = window.__D(), sc = (k) => { const m = D.TR.scene.children.find((o) => o.name === k), M = new window.__T3.Matrix4(); m.getMatrixAt(b.slot, M); return +Math.abs(M.elements[0]).toFixed(2); };
  return { r, later: L.info(), door: sc('apt-door'), glass: sc('apt-glass') }; });
console.log('  apt out:', JSON.stringify(a2));
check(!a2.r.indoor && a2.r.fadeFrames === 0 && a2.later.b === null && a2.door === 1 && a2.glass === 1, `out of the apartment with no fade; walked away: door closed, the glass is back`);
// ---- 7 山頂的公寓（2 號家，蓋在山頂的高度）：開門、走進去，窗外的村子高度對 ----
const m0 = await L(() => { const D = window.__D(), b = D.VIL.buildings.find((q) => q.kind === 'apt' && q.slot === 1); window.__mb = b; const L = window.__L, a = L.approach(b); const pressed = window.__H.press(); window.__H.step(50); return { y: b.y, a, pressed, now: L.info() }; });
const uv7 = await L(() => window.__L.doorUV()), px7 = await shotPx(uv7), in7 = await L((uv) => window.__L.alone('in', uv), uv7);
await drawAndShot('7-summit-open'); console.log('  uv7', JSON.stringify(uv7));
const m1 = await L(() => window.__L.walkIn(window.__mb, 3));
await L(() => window.__L.faceOut(window.__mb, 0.05, 0.45));
const uv7b = await L(() => window.__L.doorUV()), px7b = await shotPx(uv7b), w7 = await L((uv) => window.__L.alone('world', uv), uv7b);
await drawAndShot('7-summit-lookout');
console.log('7', el(), JSON.stringify(m0), JSON.stringify(m1), JSON.stringify(px7), JSON.stringify(in7), JSON.stringify(px7b), JSON.stringify(w7));
check(m0.y > 90 && m0.pressed === '開門' && near(px7, in7) >= 4 && m1.live && m1.fadeFrames === 0 && Math.abs(m1.y) < 0.01 && near(px7b, w7) >= 4,
  `the summit apartment (${m0.y?.toFixed(1)} m up): through its open door you see its lobby (${near(px7, in7)}/5), walked in with no fade, and from inside the door shows the summit outside at the right height (${near(px7b, w7)}/5)`);
await L(() => window.__L.walkOut(window.__mb, 3));
// ---- 8 畫質 高、超高（手機的超高）：一樣從房子裡面看得到外面；晚上窗外的路燈 ----
for (const [lv, nm] of [[1, '高'], [2, '超高']]) {
  await L((lv) => { const K = window.__LK(); K.setHour(13); K.setRain(0); if (lv === 2) K.setMax(false); [...document.querySelectorAll('#lookPop button')].find((b) => b.dataset.l === String(lv)).click(); }, lv);
  await p.waitForFunction((lv) => window.__LK().level === lv && !window.__LK().busy, lv, { timeout: 300000 });
  const g0 = await L(() => { const L = window.__L, b = window.__hb; L.approach(b); const pressed = window.__H.press(); window.__H.step(50); const r = L.walkIn(b, 3); L.faceOut(b, 0.05); return { pressed, ...r }; }); // 正對門（斜看的話開著的門片會擋在門洞中間）
  const uv = await L(() => window.__L.doorUV()), px = await shotPx(uv), w = await L((uv) => window.__L.alone('world', uv), uv);
  await drawAndShot(`8-lookout-lv${lv}`);
  const fi = lv === 1 ? await frameInfo() : await L(() => ({ calls: window.__LK().stats.calls, tris: window.__LK().stats.tris })); // 超高的後製自己會清 renderer.info：用 look 記的（村子那一遍）
  console.log(`8 ${nm}`, el(), JSON.stringify(g0), JSON.stringify(px), JSON.stringify(w), JSON.stringify(fi));
  check(g0.pressed === '開門' && g0.live && g0.fadeFrames === 0 && near(px, w, 60) >= 4, `畫質 ${nm}: opened the door and walked in, and the doorway shows the street (${near(px, w, 60)}/5); whole frame ${fi.calls} calls / ${fi.tris} triangles`);
  if (lv === 2) { await L(() => { window.__LK().setHour(21.5); window.__H.step(30); }); await drawAndShot('8-night-lv2'); await L(() => window.__LK().setHour(13)); }
  await L(() => { const L = window.__L, b = window.__hb; L.walkOut(b, 2.5); const e = window.__IN().interiorFor(b).enter; window.__H.walkTo(e.x + Math.sin(b.rot) * 8, e.z + Math.cos(b.rot) * 8); window.__H.step(90); });
}
check(errs.length === 0, `no page errors (${errs.length})`);
console.log(fails.length ? `FAILED (${fails.length}):\n  ${fails.join('\n  ')}` : 'ALL CHECKS OK', el());
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
