// 第 98 批（Nick 2026-11-17「車門做成是可自己打開關起來的…像AV12是剪刀門上開的」；草稿 https://claude.ai/artifact/Kphfn8H9ekJ9PssyUJU9Ji 「車門」那一頁）
//   GC8（右駕）：走路上車（不是按門）門自己打開、坐好門還開著；發動、開出鐵捲門：開快了門自己甩上
//   → 街上「下車」：門先開、人走出來、門開著、引擎還發動著 →「上車」＋第二顆「關車門」→ 關好（車身換回原本的網格）→「開車門 · GC8」
//   → 打開（0.6 秒、門往外轉、車身切開）→「上車」開車、停著左上「關車門」→ 副駕駛座那邊的門：上車＝坐副駕駛座、坐好 1 秒門自己關
//   → 後車廂和車門不能一起開 → 從車頭按「上車」：走過去駕駛座的門自己打開 → 每一格多少毫秒、draw calls
// DCAR=<車> node cardoor-test.mjs [prefix]：只跑那台車的開門（照真的車：AV12 剪刀門往上、SP3 蝴蝶門、HY 鷗翼門、JESKO 往上往外轉）、上車，四門的車多後門＝後座
// node cardoor-test.mjs [prefix]（截圖：<prefix>-*.png；沒給＝../out/cardoor/cd）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const K = process.env.DCAR || 'gc8', FULL = K === 'gc8';
const [prefix = `../out/cardoor/${FULL ? 'cd' : K}`] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__G = () => GAME; window.__THREE = THREE; window.__P = () => PERF; window.__CARS = () => CARS;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, trip, tripS, TR, cur, built, walker, leaveCar, dvoice, garLot, MART });'
  + ' window.__SEAT = () => ({ PAX, SEATUI, seatsOf });'
  + ' window.__CDX = () => ({ CD, cdRig, cdNear, cdStep, cdOK, cdSeatOf, doorKind });'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } else if (window.__npcKeep) { NPC = window.__npcKeep; window.__npcKeep = null; NPC.g.visible = DRIVE.on; } };'
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
p.setDefaultTimeout(600000);
const errs = [], fails = [];
p.on('pageerror', (e) => { errs.push(e.message); console.log('pageerror', e.message); });
p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_CERT|404|GPU stall|AudioContext was not allowed|ScriptProcessorNode|worklet timeout|ERR_TUNNEL|ERR_NAME|ERR_CONNECTION|fonts\.g|npc: |non-indexed|KHR_parallel/.test(m.text())) console.log('console', m.type(), m.text().slice(0, 240)); });
const T0 = Date.now(), el = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`;
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const ready = () => p.waitForFunction(() => document.getElementById('status').hidden, null, { timeout: 300000 });
async function shot(name) { // 畫兩格再截圖
  const n0 = await p.evaluate(() => { window.__noDraw = false; return window.__dframes || 0; });
  await p.waitForFunction((n) => (window.__dframes || 0) >= n + 2, n0, { timeout: 300000 });
  await p.evaluate(() => { window.__noDraw = true; });
  await p.screenshot({ path: `${prefix}-${name}.png` });
  const ri = await p.evaluate(() => window.__rinfo());
  console.log('  shot', `${prefix}-${name}.png`, JSON.stringify(ri), el());
  return ri;
}
await p.addInitScript((k) => {
  window.__K = k;
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: k, scene: 'room', money: 500, owned: [...new Set(['gc8', k])], parts: {}, tyres: {}, wins: {}, cars: {} }));
}, K);
await p.addInitScript(() => {
  const H = (window.__H = {}), W = () => window.__D().walker, step = (n = 1) => window.__wstep(n);
  H.step = step;
  const vis = (e) => !!e && !e.hidden && !e.closest('[hidden]') && e.getClientRects().length > 0;
  H.visible = (sel) => vis(document.querySelector(sel));
  const act = () => [...document.querySelectorAll('#stage .wk-act, #stage .dv-act')].find(vis);
  H.actText = () => { const e = act(); return e ? e.querySelector('span').textContent : null; };
  H.press = () => { const e = act(); if (!e) return null; const s = e.querySelector('span').textContent; e.click(); return s; };
  H.act2 = () => { const e = [...document.querySelectorAll('#stage .wk-act2, #stage .dv-act2')].find(vis); return e ? e.querySelector('span').textContent : null; };
  H.press2 = () => { const e = [...document.querySelectorAll('#stage .wk-act2, #stage .dv-act2')].find(vis); if (!e) return null; const s = e.querySelector('span').textContent; e.click(); return s; };
  H.toast = () => [...document.querySelectorAll('#stage .dv-toast.show, #stage .wk-toast.show')].map((e) => e.textContent).join(' | ');
  H.rig = () => window.__CDX().CD.rig;
  H.doors = () => { const R = H.rig(); return R ? R.doors.map((d) => +d.t.toFixed(2)) : null; };
  H.nm = () => window.__CARS()[window.__D().cur].btn[0];
  // 車身的網格（不算車門那一組）：每個網格現在用哪一份 geometry
  H.geo = () => { const B = window.__D().tripS.body, out = []; const wk = (o) => { if (o.name === 'door-rig' || o.userData.seated) return; if (o.isMesh) out.push(o.geometry.uuid); for (const c of o.children) wk(c); }; wk(B); return out; };
  // 第 i 個門外面（離門 0.75 公尺）站好、看著車
  H.toDoor = (i, off = 0.75) => {
    const D = window.__D(), R = window.__CDX().cdRig(), d = R.doors[i].D, B = D.tripS.body, T = window.__THREE;
    B.updateMatrixWorld(true); const v = new T.Vector3((d.m.xf + d.m.xr) / 2, 0, d.side * (d.zOut + off)); B.localToWorld(v);
    const c = D.tripS.car.position; W().teleport({ x: v.x, z: v.z, heading: Math.atan2(-(c.z - v.z), c.x - v.x) }, { keepCamera: false }); step(30);
    const t = W().telemetry(); return { i, at: window.__CDX().cdNear(t.x, t.z, 1.25), act: H.actText(), act2: H.act2() };
  };
  // 車子座標（x 往前、y 往上、z 往右）裡第 i 個門那一塊（切下來翻開的）的範圍
  H.lidBox = (i) => {
    const D = window.__D(), R = H.rig(), d = R.doors[i], T = window.__THREE, B = D.tripS.body, v = new T.Vector3(), inv = new T.Matrix4(), M = new T.Matrix4();
    B.updateMatrixWorld(true); inv.copy(B.matrixWorld).invert();
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; let n = 0;
    for (const m of d.lids) {
      M.multiplyMatrices(inv, m.matrixWorld); const P = m.geometry.attributes.position, I = m.geometry.index, cnt = I ? I.count : P.count;
      for (let k = 0; k < cnt; k++) { v.fromBufferAttribute(P, I ? I.getX(k) : k).applyMatrix4(M); for (let a = 0; a < 3; a++) { const x = v.getComponent(a); if (x < mn[a]) mn[a] = x; if (x > mx[a]) mx[a] = x; } n++; }
    }
    const s = d.D.side, out = s > 0 ? mx[2] : -mn[2];
    return { n: d.lids.length, verts: n, top: +mx[1].toFixed(2), out: +out.toFixed(2), xr: +mn[0].toFixed(2), xf: +mx[0].toFixed(2), zOut: d.D.zOut, yt: d.D.m.yt, roof: d.D.m.roof, kind: d.D.kind, side: s, row: d.D.row };
  };
  // 開著（want）到 t＝1 要幾格
  H.openFrames = (i) => { const R = H.rig(); let n = 0; for (; n < 120 && R.doors[i].t < 1; n++) step(1); return n; };
  H.shutFrames = (i) => { const R = H.rig(); let n = 0; for (; n < 120 && (R.doors[i].t > 0 || R.doors[i].on); n++) step(1); return n; };
  H.board = (maxS = 10) => { const w = W(), modes = [], R = H.rig(); let n = 0, mx = 0; for (; n < maxS * 60; n++) { step(1); modes.push(w.mode); const r = H.rig(); if (r) for (const d of r.doors) mx = Math.max(mx, d.t); if (w.mode === 'off' && window.__D().drv) break; } return { modes: [...new Set(modes)], s: +(n / 60).toFixed(1), maxT: +mx.toFixed(2) }; };
  H.out = () => { const w = W(); let n = 0; for (; n < 600 && w.mode !== 'walk'; n++) step(1); step(10); return n; };
  H.start = () => { const d = window.__D().drv; d.setInput({ throttle: 1, brake: 1 }); window.__dstep(3); d.setInput({ throttle: 0, brake: 1 }); window.__dstep(80); d.setInput(null); window.__dstep(5); return d.engine; }; // AV12 要踩著煞車
  H.stop = (n = 90) => { const d = window.__D().drv; for (let i = 0; i < n; i++) { const v = d.telemetry().v; d.setInput(v > 0.15 ? { throttle: 0, brake: 1 } : v < -0.15 ? { throttle: 1, brake: 0 } : { throttle: 0, brake: 0, handbrake: 1 }); window.__dstep(1); } d.setInput(null); window.__dstep(2); };
  H.ms = (f, n = 60) => { const t0 = performance.now(); for (let i = 0; i < n; i++) f(); return +((performance.now() - t0) / n).toFixed(3); };
});

await p.goto(base, { waitUntil: 'domcontentloaded' });
await ready();
console.log('0', el(), 'page ready', K);
await p.waitForFunction(() => window.__D().built[window.__K]?.car, null, { timeout: 300000 });
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk');
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; window.__npcPause(true); });
const info0 = await p.evaluate(() => {
  const X = window.__CDX(), D = window.__D(), t0 = performance.now(), R = X.cdRig(), ms = performance.now() - t0;
  return { ok: X.cdOK(D.cur), kind: X.doorKind(D.cur), n: R?.doors.length, sides: R?.doors.map((d) => `${d.D.side < 0 ? 'L' : 'R'}${d.D.row}`), seats: R?.doors.map((d) => X.cdSeatOf(D.cur, d.D)), ms: Math.round(ms), geo: window.__H.geo().join(','), noDoor: ['z2', 'mtb', 'n4', 'monster'].map((k) => X.cdOK(k)) };
});
const GEO0 = info0.geo; delete info0.geo;
console.log('0b', el(), JSON.stringify(info0));
check(info0.ok && info0.n >= 2 && info0.sides.includes('L0') && info0.sides.includes('R0') && info0.noDoor.every((x) => !x), `${K}: ${info0.n} doors (${info0.sides.join(' ')}, kind ${info0.kind}; seats ${info0.seats.join(' ')}), ready in ${info0.ms} ms; the ATV, bicycle, street bike and monster truck have none`);
check(info0.ms < 400, `the door measurements come precomputed (door-fit.mjs): the rig is made in ${info0.ms} ms`);
const DRV = info0.seats.indexOf(0), PASS = info0.seats.findIndex((s, i) => s !== 0 && info0.sides[i].endsWith('0'));
const REAR = info0.sides.findIndex((s) => s.endsWith('1'));
await p.evaluate(([a, b, c, g]) => { window.__DRV = a; window.__PASS = b; window.__REAR = c; window.__GEO0 = g.split(','); }, [DRV, PASS, REAR, GEO0]);

if (FULL) {
  // ---- 1 走路上車（walker.getIn，像按車頭、車尾的「上車」）：走到駕駛座的門口，門自己打開；坐好門還開著 ----
  const in1 = await p.evaluate(() => {
    const D = window.__D(), W = D.walker, H = window.__H; let ok = false, k = 0;
    for (; k < 600 && !ok; k++) { ok = W.getIn(W.cars.find((c) => c.object === D.tripS.car)); if (!ok) H.step(1); }
    const b = H.board(); return { ok, b, doors: H.doors(), drv: !!D.drv, engine: D.drv?.engine };
  });
  console.log('1', el(), JSON.stringify(in1));
  check(in1.ok && in1.b.modes.join('>') === 'in>seat>off' && in1.b.maxT === 1 && in1.doors[DRV] === 1 && in1.drv && !in1.engine, `walking up to get in: the driver's door opened by itself, you sat down, the door is still open (doors ${JSON.stringify(in1.doors)}); engine off`);
  // ---- 2 發動、開出鐵捲門：時速 9 公里門自己甩上 ----
  const slam2 = await p.evaluate(() => {
    const D = window.__D(), d = D.drv, H = window.__H, R = H.rig(); const eng = H.start();
    D.GAR.door.open(0.2); window.__dstep(40);
    const L0 = D.garLot(), qx = () => { const t = d.telemetry(); return (t.x - L0.x) * Math.cos(L0.heading) - (t.z - L0.z) * Math.sin(L0.heading); };
    let fast = -1, shut = -1, i = 0;
    for (; i < 60 * 8 && qx() < 24; i++) { d.setInput({ throttle: 0.6, brake: 0, steer: 0 }); window.__dstep(1); const t = d.telemetry(); if (fast < 0 && Math.abs(t.v) > 2.5) fast = i; if (fast >= 0 && shut < 0 && R.doors.every((x) => x.t === 0)) shut = i; }
    d.setInput(null); H.stop(90);
    const t = d.telemetry(); return { eng, fast, shut, frames: shut - fast, doors: H.doors(), on: R.doors.some((x) => x.on), geo: H.geo().join(','), out: qx() > 14, v: +t.v.toFixed(2), act: H.actText() };
  });
  console.log('2', el(), JSON.stringify({ ...slam2, geo: undefined }));
  check(slam2.eng && slam2.fast > 0 && slam2.shut >= slam2.fast && slam2.frames <= 15 && !slam2.on && slam2.geo === GEO0 && slam2.out, `started the engine and drove out the roller door: past 9 km/h the open door slammed shut in ${slam2.frames} frames (car body back to its own meshes)`);
  // ---- 3 街上「下車」：門先開、人走出來、門開著；引擎還發動著。站在門旁邊：「上車 · GC8」＋「關車門」 ----
  const out3 = await p.evaluate(() => {
    const D = window.__D(), H = window.__H, W = D.walker; const pressed = H.press2(); let mx = 0, n = 0;
    for (; n < 600 && W.mode !== 'walk'; n++) { H.step(1); for (const d of H.rig().doors) mx = Math.max(mx, d.t); }
    H.step(120); // 走出來以後 2 秒：門還開著
    return { pressed, s: +(n / 60).toFixed(1), mx: +mx.toFixed(2), doors: H.doors(), voice: !!D.dvoice?.alive, engine: D.drv.engine, act: H.actText(), act2: H.act2(), near: window.__CDX().CD.near };
  });
  console.log('3', el(), JSON.stringify(out3));
  check(out3.pressed === '下車' && out3.doors[DRV] === 1 && out3.voice && out3.engine, `下車: the driver's door opened, you stepped out (${out3.s} s) and it stays open; the engine keeps running`);
  check(out3.act === `上車 · ${await p.evaluate(() => window.__H.nm())}` && out3.act2 === '關車門' && out3.near === DRV, `next to the open door: 「${out3.act}」 and 「${out3.act2}」`);
  const riOpen = await shot('3-open-out');
  // ---- 4 「關車門」：關好、車身換回原本的網格 →「開車門」 ----
  const shut4 = await p.evaluate(() => {
    const H = window.__H, pressed = H.press2(), n = H.shutFrames(window.__DRV);
    H.step(5); return { pressed, n, doors: H.doors(), on: H.rig().doors.some((x) => x.on), lids: H.rig().doors.reduce((a, d) => a + d.lids.length, 0), geo: H.geo().join(','), act: H.actText(), act2: H.act2() };
  });
  console.log('4', el(), JSON.stringify({ ...shut4, geo: undefined }));
  check(shut4.pressed === '關車門' && shut4.n > 15 && shut4.n < 45 && !shut4.on && shut4.lids === 0 && shut4.geo === GEO0, `「關車門」: closed in ${(shut4.n / 60).toFixed(2)} s, the car body is back to its own meshes (no extra pieces)`);
  check(/^開車門 · /.test(shut4.act) && shut4.act2 === null, `closed door: 「${shut4.act}」, no second button (no 「選位子」 for your own car with doors)`);
  const riClosed = await shot('4-closed');
  // ---- 5 「開車門」：0.6 秒打開、往外轉；車身切開 ----
  const open5 = await p.evaluate(() => {
    const H = window.__H, t0 = performance.now(), pressed = H.press(); H.step(1); const ms = performance.now() - t0;
    const n = H.openFrames(window.__DRV) + 1, cut = H.geo().filter((g, i) => g !== window.__GEO0[i]).length;
    return { pressed, ms: Math.round(ms), n, cut, box: H.lidBox(window.__DRV), act: H.actText(), act2: H.act2() };
  });
  console.log('5', el(), JSON.stringify(open5));
  check(/^開車門/.test(open5.pressed) && open5.n >= 33 && open5.n <= 40 && open5.cut > 0 && open5.box.n > 0, `「開車門」: the door opens in ${(open5.n / 60).toFixed(2)} s; ${open5.cut} meshes of the body are cut, the door piece (${open5.box.n} meshes) swings on its hinge (first cut ${open5.ms} ms)`);
  check(open5.box.kind === 'conv' && open5.box.out > open5.box.zOut + 0.5 && open5.box.top < open5.box.roof + 0.1, `a normal door swings out sideways (${open5.box.out} m out from the middle; the body side is ${open5.box.zOut}), not up`);
  check(open5.act === shut4.act.replace('開車門', '上車') && open5.act2 === '關車門', `open: 「${open5.act}」 + 「${open5.act2}」`);
  const riOpen5 = await shot('5-open');
  // ---- 6 「上車」開車；停著左上「關車門」→ 關好 ----
  const in6 = await p.evaluate(() => {
    const D = window.__D(), H = window.__H, pressed = H.press(), b = H.board();
    D.drv.setInput(null); window.__dstep(20);
    const act = H.actText(), pressed2 = H.press(), n = H.shutFrames(window.__DRV);
    window.__dstep(5); return { pressed, b, pax: window.__SEAT().PAX.on, act, pressed2, n, doors: H.doors(), after: H.actText(), engine: D.drv.engine };
  });
  console.log('6', el(), JSON.stringify(in6));
  check(/^上車/.test(in6.pressed) && in6.b.modes.join('>') === 'in>seat>off' && !in6.pax && in6.engine, `「上車」: you sit in the driver's seat and drive (engine still running)`);
  check(in6.act === '關車門' && in6.pressed2 === '關車門' && in6.doors.every((x) => x === 0) && in6.after !== '關車門', `stopped with the door open: top-left 「關車門」, pressed: closed in ${(in6.n / 60).toFixed(2)} s, the button goes away`);
  // ---- 7 副駕駛座那邊的門：上車＝坐副駕駛座；坐好 1 秒門自己關 ----
  const pax7 = await p.evaluate(() => {
    const D = window.__D(), H = window.__H, W = D.walker; D.leaveCar(); H.out();
    const at = H.toDoor(window.__PASS), pressed = H.press(); H.openFrames(window.__PASS);
    const act = H.actText(), pressed2 = H.press(), b = H.board(), S = window.__SEAT();
    const sat = { pax: S.PAX.on, i: S.PAX.i, doors: H.doors() };
    let n = 0; for (; n < 240 && !H.rig().doors.every((x) => x.t === 0); n++) window.__dstep(1);
    return { at, pressed, act, pressed2, b, sat, n, doors: H.doors() };
  });
  console.log('7', el(), JSON.stringify(pax7));
  check(pax7.at.at === PASS && /^開車門/.test(pax7.at.act) && /^開車門/.test(pax7.pressed) && /^上車/.test(pax7.act) && /^上車/.test(pax7.pressed2), `walked round to the passenger door: 「${pax7.at.act}」 → 「${pax7.act}」`);
  check(pax7.b.modes.join('>') === 'in>seat>off' && pax7.sat.pax && pax7.sat.i === info0.seats[PASS] && pax7.sat.doors[PASS] === 1, `got in through the passenger door: you sit in the passenger seat (seat ${pax7.sat.i}), the door still open`);
  check(pax7.n >= 50 && pax7.n <= 120 && pax7.doors.every((x) => x === 0), `sitting there, every door closes by itself after a second (all shut ${(pax7.n / 60).toFixed(1)} s after sitting down)`);
  const riPax = await shot('7-pax');
  // ---- 8 後車廂和車門不能一起開（都會切車身）：開後車廂＝門先關好；開車門＝後車廂先關 ----
  const tr8 = await p.evaluate(() => {
    const D = window.__D(), H = window.__H, W = D.walker, S = window.__SEAT(); S.SEATUI.out.click(); H.out(); // 下車：副駕駛座的門開了
    const open0 = H.doors(), B = D.tripS.body, T = window.__THREE, v = new T.Vector3(-3.2, 0, 0); B.updateMatrixWorld(true); B.localToWorld(v);
    const c = D.tripS.car.position; W.teleport({ x: v.x, z: v.z, heading: Math.atan2(-(c.z - v.z), c.x - v.x) }, { keepCamera: false }); H.step(30);
    const act = H.actText(), pressed = H.press(); H.step(2);
    const mid = { doors: H.doors(), on: H.rig().doors.some((x) => x.on), trunk: D.MART.vis?.want };
    H.step(60); H.toDoor(window.__DRV); const act2 = H.actText(), pressed2 = H.press(); H.step(2);
    const end = { trunk: D.MART.vis?.want, tt: D.MART.vis?.t, doors: H.doors(), want: H.rig().doors[window.__DRV].want };
    H.openFrames(window.__DRV); return { open0, act, pressed, mid, act2, pressed2, end };
  });
  console.log('8', el(), JSON.stringify(tr8));
  check(tr8.open0[PASS] === 1 && /後車廂/.test(tr8.pressed) && tr8.mid.doors.every((x) => x === 0) && !tr8.mid.on && tr8.mid.trunk === 1, `「${tr8.pressed}」 with a door open: the door shuts first (both cut the body), then the trunk opens`);
  check(/^開車門/.test(tr8.pressed2) && tr8.end.trunk === 0 && tr8.end.tt === 0 && tr8.end.want === 1, `「開車門」 with the trunk open: the trunk lid shuts first, then the door opens`);
  // ---- 9 從車頭按「上車」（沒有站在門旁邊）：走到駕駛座的門，門自己打開 ----
  const nose9 = await p.evaluate(() => {
    const D = window.__D(), H = window.__H, W = D.walker, R = H.rig();
    H.press2(); H.shutFrames(window.__DRV); // 先把門關好
    const B = D.tripS.body, T = window.__THREE, v = new T.Vector3(3.4, 0, 0); B.updateMatrixWorld(true); B.localToWorld(v);
    const c = D.tripS.car.position; W.teleport({ x: v.x, z: v.z, heading: Math.atan2(-(c.z - v.z), c.x - v.x) }, { keepCamera: false }); H.step(30);
    const doors0 = H.doors(), act = H.actText(), pressed = H.press(), b = H.board();
    return { doors0, act, pressed, b, doors: H.doors(), pax: window.__SEAT().PAX.on };
  });
  console.log('9', el(), JSON.stringify(nose9));
  check(nose9.doors0.every((x) => x === 0) && /^上車/.test(nose9.act) && nose9.b.modes.join('>') === 'in>seat>off' && nose9.b.maxT === 1 && nose9.doors[DRV] === 1 && !nose9.pax, `in front of the car 「${nose9.act}」: you walk to the driver's door, it opens by itself, you sit down`);
  // ---- 10 每一格多少毫秒、draw calls ----
  const ms10 = await p.evaluate(() => {
    const X = window.__CDX(), H = window.__H, D = window.__D(); D.drv.setInput(null);
    const open = H.ms(() => X.cdStep(1 / 60), 120); H.press(); H.shutFrames(window.__DRV);
    const closed = H.ms(() => X.cdStep(1 / 60), 120);
    return { open, closed };
  });
  console.log('10', el(), JSON.stringify(ms10), JSON.stringify({ openOut: riOpen, closed: riClosed, open: riOpen5, pax: riPax }));
  check(ms10.open < 0.3 && ms10.closed < 0.3, `cdStep costs ${ms10.open} ms a frame with a door open, ${ms10.closed} ms with them shut`);
  check(riOpen5.calls - riClosed.calls <= 12, `an open door adds ${riOpen5.calls - riClosed.calls} draw calls (the cut-off pieces), ${riOpen5.tris - riClosed.tris} triangles`);
} else {
  // ---- 別台車：駕駛座的門照真的車的開法打開、關好換回原本的網格、上車；四門的車後門＝後座 ----
  await p.evaluate(() => { const D = window.__D(); D.GAR.door.open(0.2); window.__dstep(40); });
  const at = await p.evaluate(() => window.__H.toDoor(window.__DRV));
  const riClosed = await shot('1-closed');
  const op = await p.evaluate(() => { const H = window.__H, pressed = H.press(), n = H.openFrames(window.__DRV) + 1; return { pressed, n, box: H.lidBox(window.__DRV), act: H.actText(), act2: H.act2() }; });
  console.log('1', el(), JSON.stringify({ at, op }));
  const B = op.box;
  const dirOk = { conv: B.out > B.zOut + 0.5 && B.top < B.roof + 0.1, scissor: B.top > B.roof + 0.35 && B.out < B.zOut + 0.45, butterfly: B.top > B.roof + 0.15 && B.out > B.zOut + 0.15, gull: B.top > B.roof + 0.05 && B.out > B.zOut + 0.1, dihedral: B.top > B.roof + 0.2 && B.out > B.zOut + 0.1 }[B.kind];
  check(/^開車門/.test(at.act) && at.at === DRV && /^開車門/.test(op.pressed) && op.n >= 33 && op.n <= 40, `${K}: at the driver's door 「${at.act}」, pressed: opens in ${(op.n / 60).toFixed(2)} s`);
  check(dirOk, `${K}: the ${B.kind} door opens like the real car (top ${B.top} m vs roof ${B.roof}; ${B.out} m out vs body side ${B.zOut})`);
  const riOpen = await shot('2-open');
  const all = await p.evaluate(() => { const R = window.__H.rig(); for (let i = 0; i < R.doors.length; i++) R.set(i, 1); window.__H.step(45); return window.__H.doors(); });
  await shot('3-all-open');
  const sh = await p.evaluate(() => { const H = window.__H, R = H.rig(); for (let i = 0; i < R.doors.length; i++) R.set(i, 0); let n = 0; for (; n < 120 && R.doors.some((d) => d.on); n++) H.step(1); return { n, geo: H.geo().join(',') === window.__GEO0.join(','), act: H.actText() }; });
  check(all.every((x) => x === 1) && sh.geo && /^開車門/.test(sh.act), `${K}: every door opens together and closes back to the car's own meshes (${JSON.stringify(all)})`);
  if (REAR >= 0) {
    const rr = await p.evaluate(() => { const H = window.__H, at = H.toDoor(window.__REAR); H.press(); H.openFrames(window.__REAR); const act = H.actText(); H.press(); const b = H.board(); const S = window.__SEAT(); const r = { at, act, b, pax: S.PAX.on, i: S.PAX.i, row: S.seatsOf(window.__D().cur)[S.PAX.i]?.n }; S.SEATUI.out.click(); H.out(); return r; });
    console.log('1r', el(), JSON.stringify(rr));
    check(rr.at.at === REAR && rr.b.modes.join('>') === 'in>seat>off' && rr.pax && /後座/.test(rr.row), `${K}: the rear door gets you into the back seat (${rr.row})`);
  }
  const dv = await p.evaluate(() => { const H = window.__H, at = H.toDoor(window.__DRV); if (/^開車門/.test(H.actText())) { H.press(); H.openFrames(window.__DRV); } const act = H.actText(); H.press(); const b = H.board(); return { at, act, b, drv: !!window.__D().drv, pax: window.__SEAT().PAX.on }; });
  console.log('1d', el(), JSON.stringify(dv));
  check(/^上車/.test(dv.act) && dv.b.modes.join('>') === 'in>seat>off' && dv.drv && !dv.pax, `${K}: 「上車」 at the open driver's door: you drive`);
  console.log('draw calls:', JSON.stringify({ closed: riClosed, open: riOpen }), 'open adds', riOpen.calls - riClosed.calls);
}
check(!errs.length, `no page errors (${errs.length})`);
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS OK', el());
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
