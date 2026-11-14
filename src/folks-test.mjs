// 第 70 批：房子裡的人會動、會進出（folks.js、town.src.js LD.folks、npc.js spawnAt／onEnter）
// 第 90 批：第 9 段：別的透天厝（沒蓋裡面的）路上的人走出來、走進去，門真的打開（npc.js dfOpen）
// node folks-test.mjs [prefix]（前面的小工具跟 door-test.mjs 一樣）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = 'folks'] = process.argv.slice(2);
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
  + ' window.__FK = () => ({ createFolks, buildCharacter, randomLook, LDF_HOOKS, npcEnter });'
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
// ---- 0 出門（走路） ----
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker, null, { timeout: 300000 });
await p.evaluate(() => { window.__noDraw = true; window.__H.step(30); });
// ---- 0b 每一棟（不用走過去）：蓋裡面、放人：透天厝／店 1～3 個、廟 0～2 個拜拜的、有櫃台的有老闆、公寓沒有人；站著的人都在走得到的格子上、每個人都走得到大門 ----
const all = await L(() => { const D = window.__D(), X = window.__IN(), K = window.__FK(), T3 = window.__T3, out = { n: 0, kinds: {}, bad: [], noNav: [], nav: 0, ms: 0 };
  for (const b of D.VIL.buildings) { const I0 = X.interiorFor(b); if (!I0) continue;
    const I = X.buildInterior(b, { live: true, quality: 'low' }), t0 = performance.now(); const F = K.createFolks({ I, b, scene: new T3.Scene(), makeCharacter: K.buildCharacter, randomLook: K.randomLook, hooks: { door: () => 1 } });
    out.ms += performance.now() - t0; out.n++;
    const k = I.kind + (I.floors[0].spots.counter?.length ? '-counter' : ''); (out.kinds[k] ||= []).push(F.count);
    if (!I.floors[0].nav && I.kind !== 'apt') out.noNav.push(I.name);
    else out.nav++;
    const dp = F.doorPts(), list = F.list;
    if (I.kind === 'apt' ? F.count !== 0 : I.kind === 'temple' ? F.count > 2 : F.count < 1 || F.count > 3) out.bad.push([I.name, I.kind, 'count', F.count]);
    if (I.floors[0].spots.counter?.length && !list.some((f) => f.boss && f.t === 1e9 && f.st !== 'sit')) out.bad.push([I.name, I.kind, 'no boss at the counter']);
    for (const f of list) {
      if (f.st !== 'sit' && F._nearFree(0, f.x, f.z, 0.3) === false) out.bad.push([I.name, I.kind, 'standing in a wall/furniture', +f.x.toFixed(2), +f.z.toFixed(2)]); // 站的點離走得到的格子 0.4 公尺以內（interiors.js reach）：人的中心離空格子 0.3 以內
      if (f.C.group.parent == null || !f.C.group.visible) out.bad.push([I.name, I.kind, 'not in the scene']);
      if (dp && !f.boss && !F._route(0, f.x, f.z, dp.inX, dp.inZ)) out.bad.push([I.name, I.kind, 'cannot reach the front door', f.st]);
      if (f.st === 'pray' && I.kind !== 'temple' && !I.floors[0].spots.pray.length) out.bad.push([I.name, 'pray without a spot']);
    }
    F.dispose(); I.dispose(); }
  for (const k in out.kinds) { const a = out.kinds[k]; out.kinds[k] = { n: a.length, min: Math.min(...a), max: Math.max(...a), avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) }; }
  out.ms = +(out.ms / out.n).toFixed(1); return out; });
console.log('0b', el(), JSON.stringify(all));
check(all.n >= 80 && all.bad.length === 0 && all.noNav.length === 0 && all.kinds.house && all.kinds.house.min >= 1 && all.kinds.apt && all.kinds.apt.max === 0,
  `every village building got residents (${all.n} buildings, ${all.ms} ms each): houses 1–3 (avg ${all.kinds.house?.avg}), temple 0–2, a boss behind every counter, apartments none; nobody stands in a wall and everyone can reach the front door`);
// ---- 1 最近的透天厝：開門、走進去：裡面有人（在房子的場景裡、擋你） ----
const h1 = await L(() => { const D = window.__D(), X = window.__IN(), W = D.walker, t = W.telemetry();
  const b = D.VIL.buildings.filter((q) => X.interiorFor(q)?.kind === 'house' && q.front !== 'shop').sort((a, c) => Math.hypot(a.x - t.x, a.z - t.z) - Math.hypot(c.x - t.x, c.z - t.z))[0]; window.__hb = b;
  window.__L.approach(b); window.__H.press(); let n = 0; for (; n < 120 && window.__IN().LD.t < 1; n++) window.__H.step(1);
  const r = window.__L.walkIn(b, 3), X2 = window.__IN(), F = X2.LD.folks, I = X2.LD.I;
  const list = F ? F.list.map((f) => ({ st: f.st, inScene: f.C.group.parent === window.__IN().LD.sc, vis: f.C.group.visible, x: +f.x.toFixed(2), z: +f.z.toFixed(2), boss: f.boss, age: f.look.age })) : null;
  return { name: X.interiorFor(b).name, ...r, hasFolks: !!F, count: F ? F.count : 0, list, stand: list ? list.filter((f) => f.st !== 'sit').length : 0, mov: window.__H.inInfo().mov, indoorFolks: X2.indoor?.folks.length, floor: F?.floor, iFloor: I?.floor }; });
console.log('1', el(), JSON.stringify(h1));
check(h1.live && h1.indoor && h1.kind === 'house' && h1.fadeFrames === 0 && h1.hasFolks && h1.count >= 1 && h1.count <= 3 && h1.list.every((f) => f.inScene && f.vis) && h1.indoorFolks === 0 && h1.floor === 0,
  `walked into ${h1.name}: ${h1.count} resident(s) in the house scene (${h1.list.map((f) => f.st + (f.boss ? '/boss' : '')).join(', ')})`);
check(h1.mov >= h1.stand, `the standing ones are in the walker's movers list (blocks you): ${h1.mov} movers for ${h1.stand} standing`);
await L(() => { const F = window.__IN().LD.folks, f = F.list[0], w = window.__IN().LD.I.world(f.x, f.z), W = window.__D().walker, t = W.telemetry(); W.setCamera({ yaw: Math.atan2(-(w[1] - t.z), w[0] - t.x), pitch: 0.1 }); window.__H.step(20); });
await drawAndShot('1-house-folks');
// ---- 2 他們會動：叫大家「站夠了」→ 有人走去別的位子；一路上都在走得到的格子上、沒有卡住；走到了坐下／站著 ----
const m2 = await L(() => { const X = window.__IN(), F = X.LD.folks, H = window.__H, I = X.LD.I; const start = F.list.map((f) => [f.x, f.z]);
  for (const f of F.list) if (!f.boss) f.t = 0.01;
  let walked = 0, bad = [], frames = 0, maxV = 0, states = new Set(); const moved = F.list.map(() => 0);
  for (let n = 0; n < 60 * 30; n++) { H.step(1); frames++;
    F.list.forEach((f, i) => { states.add(f.st); maxV = Math.max(maxV, f.v || 0); if (f.st === 'walk') walked++; if (start[i]) moved[i] = Math.max(moved[i], Math.hypot(f.x - start[i][0], f.z - start[i][1]));
      if (n % 5 === 0 && f.st !== 'sit' && F._nearFree(0, f.x, f.z, 0.3) === false && (f.st !== 'walk' || (Math.hypot(f.x - start[i][0], f.z - start[i][1]) > 1.2 && f.path && Math.hypot(f.x - f.path[f.path.length - 1][0], f.z - f.path[f.path.length - 1][1]) > 1.2))) bad.push([n, +f.x.toFixed(2), +f.z.toFixed(2), f.st]); }); // 位子離走得到的格子可以到 1 公尺（沙發）：頭尾 1.2 公尺不算 // 牆的格子帶至少 0.75 公尺寬：穿牆一定抓得到；從沙發站起來那幾步離空格子 0.3 以內
    if (n > 60 * 3 && F.list.every((f) => f.st !== 'walk')) break; }
  return { walkedFrames: walked, moved: moved.map((m) => +m.toFixed(2)), bad: bad.slice(0, 5), badN: bad.length, s: +(frames / 60).toFixed(1), maxV: +maxV.toFixed(2), states: [...states], end: F.list.map((f) => f.st), stats: { ...F.stats, pathMs: +F.stats.pathMs.toFixed(1), waits: +F.stats.waits.toFixed(2) }, y: F.list.map((f) => +f.C.group.position.y.toFixed(2)) }; });
console.log('2', el(), JSON.stringify(m2));
check(m2.walkedFrames > 30 && m2.moved.some((m) => m > 0.8) && m2.badN === 0 && m2.end.every((s) => s === 'sit' || s === 'idle' || s === 'pray') && m2.maxV > 0.6 && m2.maxV < 1.3 && m2.stats.paths >= 1,
  `told to move: someone walked (${m2.walkedFrames} frames, farthest ${Math.max(...m2.moved)} m, ${m2.stats.paths} path(s) in ${m2.stats.pathMs} ms), never through a wall or furniture, and everyone settled again (${m2.end.join(', ')}) in ${m2.s} s`);
// ---- 3 讓路：你站在他要走的路上，他停下來等（不會穿過你）；你走開他再走 ----
const y3 = await L(() => { const X = window.__IN(), F = X.LD.folks, I = X.LD.I, H = window.__H, W = window.__D().walker, dp = F.doorPts();
  const f = F.list.find((q) => !q.boss); if (!f) return { none: true };
  window.__fl = f.look; // 等一下看走出去的人是不是同一個樣子
  // 站在門裡面那一點（他要走去的地方）前面一點
  const N = I.floors[0].nav; let best = null, bd = Infinity; const dx0 = dp.inX - f.x, dz0 = dp.inZ - f.z, d0 = Math.hypot(dx0, dz0);
  for (let i = 0; i < N.nx; i++) for (let j = 0; j < N.nz; j++) { if (N.cells[i * N.nz + j]) continue; const x = N.x0 + (i + 0.5) * N.gs, z = N.z0 + (j + 0.5) * N.gs; const d = Math.hypot(x - dp.inX, z - dp.inZ); if (d > 0.5 && d < 1.0 && Math.abs(d - 0.75) < bd && Math.hypot(x - f.x, z - f.z) < d0) { bd = Math.abs(d - 0.75); best = [x, z]; } }
  if (!best) return { nospot: true };
  const w = I.world(best[0], best[1]); W.teleport({ x: w[0], z: w[1], heading: 0 }); H.step(5);
  const ok = F._leave(f); let minD = 9, waited = 0, passed = false, n = 0; const dbg = [];
  for (; n < 60 * 20; n++) { H.step(1); const d = Math.hypot(f.x - best[0], f.z - best[1]); minD = Math.min(minD, d); if (n > 60 * 6 && waited > 90) break; if (f.st === 'walk' && (f.v || 0) === 0 && d < 1.6) waited++; if (n % 120 === 0) dbg.push([+d.toFixed(2), +(f.v || 0).toFixed(2), f.st, f.pi, f.path?.length, +f.wait.toFixed(1), +f.h.toFixed(2), +f.hd.toFixed(2)]); if (f.st !== 'walk') { passed = true; break; } }
  return { ok, minD: +minD.toFixed(2), waitedFrames: waited, passed, st: f.st, s: +(n / 60).toFixed(1), waits: +F.stats.waits.toFixed(2), me: best.map((v) => +v.toFixed(2)), f: [+f.x.toFixed(2), +f.z.toFixed(2)], door: [+dp.inX.toFixed(2), +dp.inZ.toFixed(2)], dbg }; });
console.log('3', el(), JSON.stringify(y3));
check(y3.ok && y3.minD >= 0.45 && y3.waitedFrames > 90 && !y3.passed && y3.st === 'walk', `you stand in his way: he stops and waits (${y3.waitedFrames} frames waiting, never closer than ${y3.minD} m, still on his way after ${y3.s} s)`);
// ---- 4 走出大門：你走開 → 他走到門口，門自己開（你沒按）→ 走出去 → 變成路上走的人（同一個樣子）；門再自己關 ----
const o4 = await L(() => { const X = window.__IN(), F = X.LD.folks, I = X.LD.I, H = window.__H, W = window.__D().walker, N = window.__N(), dp = F.doorPts(), b = X.LD.b;
  // 你走到離門最遠的格子（門才會關）
  const nv = I.floors[0].nav; let far = null, fd = 0; for (let i = 0; i < nv.nx; i += 2) for (let j = 0; j < nv.nz; j += 2) { if (nv.cells[i * nv.nz + j]) continue; const x = nv.x0 + (i + 0.5) * nv.gs, z = nv.z0 + (j + 0.5) * nv.gs, d = Math.hypot(x - dp.inX, z - dp.inZ); if (d > fd) { fd = d; far = [x, z]; } }
  const w = I.world(far[0], far[1]); W.teleport({ x: w[0], z: w[1], heading: 0 }); H.step(5);
  const f = F.list.find((q) => q.st === 'walk') || F.list.find((q) => !q.boss), c0 = F.count, fh0 = N.peds.stats.fromHome || 0, t0 = X.LD.t, pressed = window.__H.actText();
  let tMax = 0, seen = new Set(), n = 0, left = false, outPt = null, ped = null, doorT = [];
  for (; n < 60 * 25; n++) { H.step(1); tMax = Math.max(tMax, X.LD.t); seen.add(f.st); if (n % 30 === 0) doorT.push(+X.LD.t.toFixed(2));
    if (!F.list.includes(f)) { left = true; break; } }
  const wo = I.world(dp.outX, dp.outZ); outPt = wo;
  for (const q of N.peds.people) { if (q.gone) continue; const d = Math.hypot(q.x - wo[0], q.z - wo[1]); if (d < 2.5 && JSON.stringify(q.ch?.look) === JSON.stringify(window.__fl)) ped = { d: +d.toFixed(2), mode: q.mode }; }
  const anyNear = N.peds.people.filter((q) => !q.gone && Math.hypot(q.x - wo[0], q.z - wo[1]) < 2.5).length;
  // 門再自己關：他走遠、hold 過了
  let m = 0; for (; m < 60 * 8 && X.LD.t > 0; m++) H.step(1);
  return { farFromDoor: +fd.toFixed(1), t0: +t0.toFixed(2), pressed, left, fail: N.peds.stats.lastFail, recycled: N.peds.stats.recycled, people: N.peds.people.length, s: +(n / 60).toFixed(1), tMax: +tMax.toFixed(2), seen: [...seen], doorT, count: F.count, c0, leaves: F.stats.leaves, fromHome: (N.peds.stats.fromHome || 0) - fh0, ped, anyNear, closedIn: +(m / 60).toFixed(1), tEnd: +X.LD.t.toFixed(2), hold: +X.LD.hold.toFixed(2) }; });
console.log('4', el(), JSON.stringify(o4));
check(o4.left && o4.tMax === 1 && o4.pressed === null && o4.seen.includes('door') && o4.seen.includes('out') && o4.count === o4.c0 - 1 && o4.leaves === 1 && o4.fromHome === 1 && o4.ped && o4.ped.d < 2.5,
  `he walked to the front door, it opened by itself (you were ${o4.farFromDoor} m away, no button), he walked out in ${o4.s} s and became a pedestrian with the same look ${o4.ped?.d} m outside the door (${o4.ped?.mode})`);
check(o4.tEnd === 0 && o4.closedIn < 8, `the door closed by itself again ${o4.closedIn} s later`);
// ---- 5 路上的人走進來：門口外面生一個人走去敲門 → 門自己開 → 走進來變成裡面的人（同一個樣子）→ 去找位子 ----
const a5 = await L(() => { const X = window.__IN(), F = X.LD.folks, I = X.LD.I, H = window.__H, N = window.__N(), K = window.__FK(), dp = F.doorPts();
  const look = K.randomLook(Math.random), p = N.peds.spawnHome(look, 6); if (!p) return { spawned: false, home: !!N.peds.home, fail: N.peds.stats.lastFail, people: N.peds.people.length };
  const c0 = F.count, ar0 = F.stats.arrivals, wo = I.world(dp.outX, dp.outZ); let n = 0, tAt = -1, dAtOpen = -1, modes = new Set(), tMax = 0, dMin = 99, waited = 0;
  for (; n < 60 * 30; n++) { H.step(1); modes.add(p.mode); tMax = Math.max(tMax, X.LD.t); const d = Math.hypot(p.x - wo[0], p.z - wo[1]); dMin = Math.min(dMin, d); if (p.waitDoor) waited++;
    if (tAt < 0 && X.LD.t > 0.7) { tAt = n; dAtOpen = d; }
    if (F.stats.arrivals > ar0) break; }
  const nf = F.list[F.list.length - 1];
  const same = nf && JSON.stringify(nf.look) === JSON.stringify(look);
  let walked = false; for (let k = 0; k < 60 * 15; k++) { H.step(1); if (nf && nf.st === 'walk') { walked = true; break; } }
  return { spawned: true, arrived: F.stats.arrivals - ar0, s: +(n / 60).toFixed(1), modes: [...modes], tMax: +tMax.toFixed(2), openAtD: +dAtOpen.toFixed(2), dMin: +dMin.toFixed(2), waited, gone: !N.peds.people.some((q) => !q.gone && Math.hypot(q.x - wo[0], q.z - wo[1]) < 2 && JSON.stringify(q.ch?.look) === JSON.stringify(look)), count: F.count, c0, same, nfSt: nf?.st, walked, handed: N.peds.stats.handed || 0 }; });
console.log('5', el(), JSON.stringify(a5));
check(a5.spawned && a5.arrived === 1 && a5.tMax === 1 && a5.openAtD > 0.5 && a5.openAtD < 4 && a5.gone && a5.count === a5.c0 + 1 && a5.same && a5.handed >= 1,
  `a pedestrian walked up to the door: it opened by itself ${a5.openAtD} m before he got there, he came in and is now a resident with the same look (${a5.count} inside, took ${a5.s} s)`);
check(a5.walked, `the newcomer then walked off to find a spot (${a5.nfSt})`);
const ri5 = await L(() => window.__rinfo()), fr5 = await frameInfo(), js5 = await L(() => { const F = window.__IN().LD.folks; const t0 = performance.now(); for (let i = 0; i < 600; i++) F.update(1 / 60); return +((performance.now() - t0) / 600).toFixed(3); });
console.log(`  draw calls inside with residents: house ${ri5.calls}/${ri5.tris}, whole frame ${fr5.calls}/${fr5.tris}; folks.update ${js5} ms/frame`);
check(ri5.calls < 60 && fr5.calls < 440 && js5 < 0.3, `inside with ${await L(() => window.__IN().LD.folks.count)} residents: house ${ri5.calls} draw calls, whole frame ${fr5.calls} calls / ${fr5.tris} triangles, folks.update ${js5} ms per frame`);
await L(() => { const F = window.__IN().LD.folks, f = F.list[F.list.length - 1], w = window.__IN().LD.I.world(f.x, f.z), W = window.__D().walker, t = W.telemetry(); W.setCamera({ yaw: Math.atan2(-(w[1] - t.z), w[0] - t.x), pitch: 0.1 }); window.__H.step(20); });
await drawAndShot('5-newcomer');
// ---- 6 走出去、走遠：房子收掉（人也收掉）；再回來：同樣的人在 ----
const g6 = await L(() => { const X = window.__IN(), H = window.__H, I = X.LD.I, b = window.__hb, dp = X.LD.folks.doorPts(), W = window.__D().walker;
  // 有人正要走進這一家（門口 8 公尺內、要來這個門），門會自己開著：先等他進來、門關好，才站到門裡面按「開門」（第 86 批：路人的亂數變了才碰到）
  const N = window.__N(), wo = I.world(dp.outX, dp.outZ), coming = () => N.peds.people.filter((q) => !q.gone && q.door && q.door === N.peds.home && Math.hypot(q.x - wo[0], q.z - wo[1]) < 8).length;
  let waitF = 0, sawComing = 0; for (; waitF < 60 * 30 && (X.LD.t > 0 || X.LD.hold > 0 || coming()); waitF++) { sawComing = Math.max(sawComing, coming()); H.step(1); }
  const wi = I.world(dp.inX, dp.inZ); W.teleport({ x: wi[0], z: wi[1], heading: 0 }); H.step(5); // 站到門裡面：按「開門」走出去
  const dbg = { waited: +(waitF / 60).toFixed(1), sawComing, t: +X.LD.t.toFixed(2), hold: +X.LD.hold.toFixed(2), near: N.peds.people.filter((q) => !q.gone && Math.hypot(q.x - wo[0], q.z - wo[1]) < 5).map((q) => [q.animal || 'h', q.mode, q.door === N.peds.home, +Math.hypot(q.x - wo[0], q.z - wo[1]).toFixed(2)]), folks: X.LD.folks.list.map((f) => [f.st, +Math.hypot(f.x - dp.inX, f.z - dp.inZ).toFixed(2)]) };
  const act = H.press(); let n = 0; for (; n < 120 && X.LD.t < 1; n++) H.step(1);
  const r = window.__L.walkOut(b, 2.5), e = X.interiorFor(b).enter, nx = Math.sin(b.rot), nz = Math.cos(b.rot); const far = H.walkTo(e.x + nx * 8, e.z + nz * 8); H.step(90);
  const gone = { b: X.LD.b, folks: X.LD.folks, t: X.LD.t };
  window.__L.approach(b); H.press(); for (n = 0; n < 120 && X.LD.t < 1; n++) H.step(1); const r2 = window.__L.walkIn(b, 3); const F = window.__IN().LD.folks;
  return { act, dbg, out: !r.indoor && r.inWorld, far: far.ok, gone: gone.b === null && gone.folks === null && gone.t === 0, back: r2.indoor && r2.live, count: F?.count, sts: F?.list.map((f) => f.st) }; });
console.log('6', el(), JSON.stringify(g6));
check(g6.act === '開門' && g6.out && g6.far && g6.gone && g6.back && g6.count === h1.count, `walked out and 8 m away: the house and its residents are put away; came back in: the same ${g6.count} resident(s) are home again (${g6.sts?.join(', ')})`);
// ---- 7 店（有櫃台）：老闆站櫃台不走 ----
const s7 = await L(() => { const D = window.__D(), X = window.__IN(), W = D.walker, t = W.telemetry(), H = window.__H;
  const bs = D.VIL.buildings.filter((q) => { const I = X.interiorFor(q); return I && (q.front === 'shop' || I.kind === 'store'); }).sort((a, c) => Math.hypot(a.x - t.x, a.z - t.z) - Math.hypot(c.x - t.x, c.z - t.z));
  const b = bs[0]; if (!b) return { none: true };
  // 先離開現在這一棟
  { const dp = X.LD.folks.doorPts(), I = X.LD.I, wi = I.world(dp.inX, dp.inZ); W.teleport({ x: wi[0], z: wi[1], heading: 0 }); H.step(5); H.press(); for (let n = 0; n < 120 && X.LD.t < 1; n++) H.step(1); window.__L.walkOut(window.__hb, 2.5); }
  window.__L.approach(b); H.step(30); if (H.actText() === '開門') { H.press(); for (let n = 0; n < 120 && X.LD.t < 1; n++) H.step(1); }
  const r = window.__L.walkIn(b, 3), F = X.LD.folks, I = X.LD.I, sp = I?.floors[0].spots.counter, boss = F?.list.find((f) => f.boss);
  const at = boss && sp.length ? Math.min(...sp.map((s) => { const q = I.local(s.x, s.z); return Math.hypot(q[0] - boss.x, q[1] - boss.z); })) : 9;
  const x0 = boss?.x, z0 = boss?.z; for (const f of F?.list || []) f.t = Math.min(f.t, 0.01); for (let n = 0; n < 60 * 12; n++) H.step(1);
  return { name: X.interiorFor(b).name, kind: I?.kind, front: b.front, ...r, counters: sp?.length, hasBoss: !!boss, at: +at.toFixed(2), moved: boss ? +Math.hypot(boss.x - x0, boss.z - z0).toFixed(3) : null, bossSt: boss?.st, bossT: boss?.t, count: F?.count, style: X.ldStyle(b) }; });
console.log('7', el(), JSON.stringify(s7));
check(!s7.none && s7.indoor && s7.counters >= 1 && s7.hasBoss && s7.at < 0.3 && s7.moved === 0 && s7.bossT > 1e8 && s7.bossSt !== 'sit' && s7.count <= 3, `in ${s7.name} (${s7.kind}, ${s7.style}): the boss stands at the counter (${s7.at} m) and stays there (12 s, moved ${s7.moved} m)`);
// ---- 8 公寓：沒有人 ----
const a8 = await L(() => { const D = window.__D(), X = window.__IN(), W = D.walker, H = window.__H, t = W.telemetry();
  const b = D.VIL.buildings.filter((q) => X.interiorFor(q)?.kind === 'apt').sort((a, c) => Math.hypot(a.x - t.x, a.z - t.z) - Math.hypot(c.x - t.x, c.z - t.z))[0]; if (!b) return { none: true };
  { const L0 = X.LD; if (L0.b) { const e = X.interiorFor(L0.b).enter, nx = Math.sin(L0.b.rot), nz = Math.cos(L0.b.rot); W.teleport({ x: e.x + nx * 1.5, z: e.z + nz * 1.5, heading: 0 }); H.step(5); window.__L.walkOut(L0.b, 2.5); } }
  window.__L.approach(b); H.step(30); const act = H.press(); for (let n = 0; n < 120 && X.LD.t < 1; n++) H.step(1);
  const r = window.__L.walkIn(b, 3); for (let n = 0; n < 120; n++) H.step(1);
  const X2 = window.__IN(); return { ...r, act, folks: X2.LD.folks, indoorFolks: X2.indoor?.folks.length, mov: H.inInfo().mov, home: !!window.__N().peds.home }; });
console.log('8', el(), JSON.stringify(a8));
check(!a8.none && a8.indoor && a8.kind === 'apt' && a8.folks === null && a8.indoorFolks === 0 && a8.mov === 0 && a8.home === false, `apartment: nobody inside (no folks object, no movers) and pedestrians are not sent to its door`);
// ---- 9 第 90 批（Nick「房子裡的人會進出」）：別的透天厝（沒有蓋裡面的那幾棟）：路上的人走出來、走進去的時候門真的打開 ----
//   你站在一間（門 1.6 公尺兩片）前面 9 公尺看著：有人開門走出來（門洞暗暗的、兩片門往外開）→ 走到門口外面接上路 → 門自己關；
//   路上一個人走過來 → 快到門口門先開 → 走進去（過了牆就看不到）→ 門再關；開著的時候多 2 個 draw call、關了 0
const d9 = await L(() => { const D = window.__D(), X = window.__IN(), W = D.walker, H = window.__H, N = window.__N();
  { const L0 = X.LD; if (L0.b) { const e = X.interiorFor(L0.b).enter, nx = Math.sin(L0.b.rot), nz = Math.cos(L0.b.rot); W.teleport({ x: e.x + nx * 1.5, z: e.z + nz * 1.5, heading: 0 }); H.step(5); window.__L.walkOut(L0.b, 2.5); } }
  const t = W.telemetry(), all = D.VIL.buildings.filter((q) => q.kind === 'house' && q.dw > 0);
  const bs = all.filter((q) => q.dw > 1.45 && q !== X.LD.b && Math.hypot(q.door.x - t.x, q.door.z - t.z) > 12).sort((a, c) => Math.hypot(a.door.x - t.x, a.door.z - t.z) - Math.hypot(c.door.x - t.x, c.door.z - t.z));
  const b = bs[0]; if (!b) return { none: true };
  const fx = Math.sin(b.door.ry), fz = Math.cos(b.door.ry), sx = b.door.x + fx * 8.4, sz = b.door.z + fz * 8.4;
  W.teleport({ x: sx, z: sz, heading: Math.atan2(fz, -fx) }); W.setCamera({ mode: 'follow', yaw: Math.atan2(fz, -fx), pitch: 0.12 }); H.step(30);
  window.__b9 = b; window.__f9 = [fx, fz];
  return { n: all.length, two: all.filter((q) => q.dw > 1.45).length, one: all.filter((q) => q.dw > 1 && q.dw < 1.45).length, shops: D.VIL.buildings.filter((q) => q.dw === -1).length, dw: b.dw, d: +Math.hypot(b.door.x - t.x, b.door.z - t.z).toFixed(1), fx0: N.peds.doorFx.open.length, draws0: N.peds.doorFx.draws }; });
console.log('9', el(), JSON.stringify(d9));
check(!d9.none && d9.n > 20 && d9.two > 5 && d9.one > 5 && d9.shops > 3 && d9.fx0 === 0 && d9.draws0 === 0, `village houses know their front door: ${d9.two} big doors (1.6 m, two leaves), ${d9.one} small doors next to a shutter (1.3 m), ${d9.shops} open shop fronts; nothing open yet (0 draw calls)`);
const o9 = await L(() => { const D = window.__D(), H = window.__H, N = window.__N(), b = window.__b9, [fx, fz] = window.__f9;
  const out = (p) => (p.x - (b.door.x - fx * 0.6)) * fx + (p.z - (b.door.z - fz * 0.6)) * fz; // 離牆多遠（外面＋）
  const p = N.peds.spawnOut(b); if (!p) return { spawned: false, fail: N.peds.stats.lastFail }; window.__po9 = p;
  const o0 = out(p), m0 = p.mode; let n = 0, tAtGo = -1, tMax = 0, draws = 0, modes = new Set(), shot = null;
  for (; n < 60 * 8; n++) { H.step(1); modes.add(p.mode); const f = N.peds.doorFx.open[0]; const tt = f ? f.t : 0; tMax = Math.max(tMax, tt); draws = Math.max(draws, N.peds.doorFx.draws);
    if (tAtGo < 0 && p.mode === 'exit' && !p.waitDoor) tAtGo = tt;
    if (!shot && p.mode === 'exit' && !p.waitDoor && out(p) > -0.15) { shot = { o: +out(p).toFixed(2), t: tt }; break; } }
  return { spawned: true, o0: +o0.toFixed(2), m0, tAtGo, shot, draws, s: +(n / 60).toFixed(2) }; });
console.log('  out', JSON.stringify(o9));
await drawAndShot('9-out');
const o9b = await L(() => { const H = window.__H, N = window.__N(), b = window.__b9, [fx, fz] = window.__f9, p = window.__po9;
  const out = (q) => (q.x - (b.door.x - fx * 0.6)) * fx + (q.z - (b.door.z - fz * 0.6)) * fz; let n = 0, walkAt = -1;
  for (; n < 60 * 10; n++) { H.step(1); if (walkAt < 0 && p.mode === 'walk') walkAt = +out(p).toFixed(2); if (walkAt >= 0 && !N.peds.doorFx.open.length) break; }
  return { mode: p.mode, gone: p.gone, walkAt, closedIn: +(n / 60).toFixed(1), open: N.peds.doorFx.open.length, draws: N.peds.doorFx.draws, outs: N.peds.stats.walkedOut || 0, opens: N.peds.stats.doorOpens || 0 }; });
console.log('  out2', JSON.stringify(o9b));
check(o9.spawned && o9.o0 < 0 && o9.m0 === 'exit' && o9.tAtGo >= 0.7 && o9.draws === 2 && o9.shot, `someone opens the door from inside (starts ${o9.o0} m behind the wall, waits until the door is ${Math.round(o9.tAtGo * 100)}% open) and walks out through the doorway; +2 draw calls while it is open`);
check(o9b.walkAt > 0.4 && !o9b.gone && o9b.mode === 'walk' && o9b.open === 0 && o9b.draws === 0 && o9b.closedIn < 6, `outside (${o9b.walkAt} m from the wall) they walk on down the street; the door shuts by itself ${o9b.closedIn} s later (0 draw calls again)`);
const i9 = await L(() => { const H = window.__H, N = window.__N(), K = window.__FK(), b = window.__b9, [fx, fz] = window.__f9;
  const out = (q) => (q.x - (b.door.x - fx * 0.6)) * fx + (q.z - (b.door.z - fz * 0.6)) * fz;
  const p = N.peds.spawnIn(b, K.randomLook(Math.random), 6); if (!p) return { spawned: false, fail: N.peds.stats.lastFail };
  const in0 = N.peds.stats.walkedIn || 0; let n = 0, dOpen = -1, tAtWall = -1, minOut = 9, modes = new Set(), shot = false;
  for (; n < 60 * 40; n++) { H.step(1); if (p.gone) break; modes.add(p.mode); const f = N.peds.doorFx.open[0], o = out(p);
    if (dOpen < 0 && f) dOpen = +Math.hypot(p.x - (b.door.x - fx * 0.6), p.z - (b.door.z - fz * 0.6)).toFixed(2);
    if (tAtWall < 0 && o < 0.05) tAtWall = f ? f.t : 0; minOut = Math.min(minOut, o);
    if (!shot && p.mode === 'enter' && !p.waitDoor && o < 0.35) { shot = true; window.__shot9 = true; break; } }
  window.__p9 = p; return { spawned: true, dOpen, s: +(n / 60).toFixed(1), modes: [...modes], in0 }; });
console.log('  in', JSON.stringify(i9));
await drawAndShot('9-in');
const i9b = await L(() => { const H = window.__H, N = window.__N(), b = window.__b9, [fx, fz] = window.__f9, p = window.__p9;
  const out = (q) => (q.x - (b.door.x - fx * 0.6)) * fx + (q.z - (b.door.z - fz * 0.6)) * fz; let n = 0, minOut = 9, tAtWall = -1, gone = false;
  for (; n < 60 * 10; n++) { if (!p.gone) { const o = out(p), f = N.peds.doorFx.open[0]; if (tAtWall < 0 && o < 0.05) tAtWall = f ? f.t : 0; minOut = Math.min(minOut, o); } H.step(1); if (p.gone) gone = true; if (gone && !N.peds.doorFx.open.length) break; }
  return { gone, minOut: +minOut.toFixed(2), tAtWall, walkedIn: N.peds.stats.walkedIn || 0, open: N.peds.doorFx.open.length, s: +(n / 60).toFixed(1) }; });
console.log('  in2', JSON.stringify(i9b));
check(i9.spawned && i9.dOpen > 1.2 && i9.dOpen < 4.2 && i9.modes.includes('walk') && i9.modes.includes('enter'), `someone walks up from down the street; the door opens before they reach it (${i9.dOpen} m away)`);
check(i9b.gone && i9b.tAtWall >= 0.7 && i9b.minOut < -0.2 && i9b.walkedIn === i9.in0 + 1 && i9b.open === 0, `they walk in through the open doorway (past the wall: ${i9b.minOut} m) and are gone inside; the door shuts behind them (${i9b.s} s)`);
// ---- 結果 ----
console.log(`\n${fails.length ? 'FAILED ' + fails.length : 'ALL CHECKS OK'}; page errors: ${errs.length}`, el());
for (const f of fails) console.log('  FAIL', f);
for (const e of errs) console.log('  pageerror', e);
await b.close(); srv.close();
process.exit(fails.length || errs.length ? 1 : 0);
