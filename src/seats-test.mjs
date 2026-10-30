// 第 57 批（Nick 2026-10-30「車子的每個位子都可以坐」；草稿 /mnt/project-files/car-game/seats/seats-v1.jpg，卡片「好，照圖做」）：自己的車（一個人玩的那一半；朋友的車在 world-test 10）
//   出門走路到 GC8 旁邊：「上車」下面多一顆「選位子」→ 畫面「要坐哪裡？」（5 個位子、駕駛座寫（開車）、左右照真的那一邊）→ 點副駕駛座：走過去坐進去
//   → 坐著：車子不動（油門沒用）、第一人稱在那個位子的眼睛、後照鏡照後面、👁 換成從外面看（看得到你坐在車裡）、拖畫面繞著車
//   → 「換位子」→ 後座右 → 換到駕駛座＝開車（第一人稱）→ 追車視角看得到你坐在駕駛座、手握方向盤跟著轉 → 再坐副駕駛座 →「下車」（人拿下來、走路）→「上車」照舊開
//   → 兩人座（RX-7）的畫面只有前面一排；沙灘車、怪獸卡車沒有「選位子」→ 開出鐵捲門（有你坐在裡面）→ draw calls
// 開車、走路都不是真的即時：頁面自己的開車先停住（__hold）、不畫（__noDraw），測試在頁面裡一步一步開，要截圖才畫
// node seats-test.mjs [prefix]（截圖：<prefix>-*.png；沒給＝../out/seats/st）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const K = 'gc8';
const [prefix = '../out/seats/st'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__G = () => GAME; window.__room = () => room; window.__CV = () => CABIN_VIEW; window.__P = () => PERF;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, trip, tripS, TR, cur, built, walker, tripPose, TWR, garLot, leaveCar, PW, S, MIR, dEye, dvoice, camera, RIDER });'
  + ' window.__SEAT = () => ({ PAX, HOP, SCAM, MYSIT, SEATN, SEATUI, SBL, seatsOf, seatPickOpen, seatPickClose });'
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
p.setDefaultTimeout(300000);
const errs = [], fails = [];
p.on('pageerror', (e) => { errs.push(e.message); console.log('pageerror', e.message); });
p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_CERT|404|GPU stall|AudioContext was not allowed|ScriptProcessorNode|worklet timeout|ERR_TUNNEL|ERR_NAME|ERR_CONNECTION|fonts\.g/.test(m.text())) console.log('console', m.type(), m.text().slice(0, 240)); });
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
// 開局：GC8（開的，停在一樓電梯上）＋RX-7（兩人座，2 樓 1 號）
await p.addInitScript((k) => {
  window.__K = k;
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  const tower = Array(40).fill(null); tower[0] = 'rx7';
  localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: k, scene: 'room', money: 500, owned: ['gc8', 'rx7'], parts: {}, tyres: {}, wins: {}, cars: {}, park: { mid: k, tower } }));
}, K);
await p.addInitScript(() => {
  window.__toast = () => [...document.querySelectorAll('#stage .dv-toast.show, #stage .wk-toast.show, #stage .ps-toast.show')].map((e) => e.textContent).join(' | ');
  window.__vis = (sel) => { const x = document.querySelector(sel); return !!x && !x.hidden && !x.closest('[hidden]') && getComputedStyle(x).display !== 'none' && x.getBoundingClientRect().width > 0; };
  window.__stop = (n = 60) => { const d = window.__D().drv; for (let i = 0; i < n; i++) { const v = d.telemetry().v; d.setInput(v > 0.15 ? { throttle: 0, brake: 1, steer: 0 } : v < -0.15 ? { throttle: 1, brake: 0, steer: 0 } : { throttle: 0, brake: 0, steer: 0, handbrake: 1 }); window.__dstep(1); } d.setInput(null); };
  // 身體某個點（Object3D）在車身座標的位置；鏡頭離那個位子的眼睛多遠
  window.__bodyAt = (o) => { const D = window.__D(), v = D.dcam.position.clone(); o.updateWorldMatrix(true, false); o.getWorldPosition(v); D.tripS.body.updateWorldMatrix(true, false); D.tripS.body.worldToLocal(v); return [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]; };
  window.__eyeD = (i) => { const D = window.__D(), s = window.__SEAT().seatsOf(D.cur)[i], e = D.dcam.position.clone().set(s.eye[0] + 0.05, s.eye[1], s.eye[2]); D.tripS.body.updateWorldMatrix(true, false); D.tripS.body.localToWorld(e); return +D.dcam.position.distanceTo(e).toFixed(3); };
  window.__carD = () => { const D = window.__D(), c = D.dcam.position.clone(); D.tripS.body.updateWorldMatrix(true, false); const m = c.clone().set(0, 0.85, 0); D.tripS.body.localToWorld(m); return +c.distanceTo(m).toFixed(2); };
  window.__me = () => { const D = window.__D(), M = window.__SEAT().MYSIT, C = M.C; return { made: !!C, on: !!C && C.group.parent === D.tripS?.body, vis: !!C && C.group.visible && !!C.group.parent, k: M.k, i: M.i, state: C?.state, walkerVis: !!D.walker?.character?.group.visible }; };
  window.__picker = () => { const U = window.__SEAT().SEATUI; if (!U || U.sp.hidden) return null; return { title: U.h3.textContent, note: U.note.textContent, two: U.car.classList.contains('two'), seats: [...U.car.querySelectorAll('.sp-seat')].map((b) => ({ i: +b.dataset.i, t: b.textContent.replace(/\s+/g, ''), left: parseFloat(b.style.left), top: parseFloat(b.style.top), tk: b.classList.contains('tk'), me: b.classList.contains('me'), dis: b.disabled })) }; };
});

await p.goto(base, { waitUntil: 'domcontentloaded' });
await ready();
console.log('0', el(), 'page ready');
await p.waitForFunction(() => window.__D().built[window.__K]?.car, null, { timeout: 120000 });
const seats = await p.evaluate(() => { const f = window.__SEAT().seatsOf; return Object.fromEntries(['gc8', 'rx7', 'yaris', 'supra', 'z2', 'monster', 'p8', 'jp4'].map((k) => [k, f(k).map((s) => `${s.n}${s.side < 0 ? 'L' : s.side > 0 ? 'R' : 'M'}`)])); });
console.log('  seats:', JSON.stringify(seats));
check(seats.gc8.length === 5 && seats.rx7.length === 2 && seats.yaris.length === 4 && seats.supra.length === 4 && seats.p8.length === 5 && seats.jp4.length === 4 && seats.z2.length === 0 && seats.monster.length === 0, 'seat counts follow the real cars: GC8 5, RX-7 2, Yaris 4, Supra 2+2, P8 5, J4 4; the ATV and the monster truck have no seats to pick');
check(seats.gc8[0] === '駕駛座R' && seats.gc8[1] === '副駕駛座L' && seats.gc8[2] === '後座左L' && seats.gc8[3] === '後座中M' && seats.gc8[4] === '後座右R' && seats.supra[0] === '駕駛座L', `GC8: ${seats.gc8.join(' ')} (right-hand drive, like the real one); Supra left-hand drive`);

// ---- 1 出門：走到 GC8 旁邊 →「上車」下面多一顆「選位子」 ----
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk');
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; window.__npcPause(true); });
const near1 = await p.evaluate(() => {
  const D = window.__D(), W = D.walker, car = W.cars.find((c) => c.key === window.__K);
  // 走到車門旁邊（右邊 1.6 公尺）
  const cs = Math.cos(car.heading), sn = Math.sin(car.heading);
  W.teleport({ x: car.x + sn * (car.hz + 1.0), z: car.z + cs * (car.hz + 1.0), heading: car.heading + Math.PI / 2 }, { keepCamera: false });
  window.__wstep(40); // 剛出門的 0.35 秒按鍵不算（walk.js lockT）
  const S = window.__SEAT();
  return { act: W.action, act2: W.action2, near: W.nearCar === car, own: S.SEATN.own === car, btn: window.__vis('#stage .wk-act2'), txt: document.querySelector('#stage .wk-act2 span')?.textContent, me: window.__me() };
});
console.log('1', el(), JSON.stringify(near1));
check(/^上車/.test(near1.act) && near1.act2 === '選位子' && near1.near && near1.own && near1.btn && near1.txt === '選位子', `next to your GC8: 「上車」 and, below it, the dark 「選位子」 button`);
check(!near1.me.vis && near1.me.walkerVis, 'walking: nobody sits in the parked car (you are the one walking)');
const riWalk = await shot('1-walk');

// ---- 2 「選位子」→ 畫面「要坐哪裡？」：5 個位子，駕駛座寫（開車），左右照真的那一邊（車頭朝上） ----
await p.evaluate(() => document.querySelector('#stage .wk-act2').click());
const pick2 = await p.evaluate(() => window.__picker());
console.log('2', el(), JSON.stringify(pick2));
const byI = (i) => pick2?.seats.find((s) => s.i === i);
check(pick2 && pick2.title === '要坐哪裡？' && pick2.note === '點一個位子就走過去坐' && pick2.seats.length === 5 && !pick2.two, 'the picker opens: 「要坐哪裡？」 with 5 seats');
check(byI(0)?.t.includes('駕駛座') && byI(0)?.t.includes('（開車）') && byI(1)?.t.includes('副駕駛座') && !byI(0)?.dis && !byI(1)?.dis, `driver's seat says （開車）: 「${byI(0)?.t}」; nobody is in any seat`);
check(byI(1)?.left < byI(0)?.left && byI(0)?.top === byI(1)?.top && byI(2)?.left < byI(3)?.left && byI(3)?.left < byI(4)?.left && byI(2)?.top > byI(0)?.top, 'seen from above with the nose up: the GC8 driver sits on the right, passenger left; rear row below, left/middle/right in order');
const riPick = await shot('2-picker');
// 點外面＝關掉；再開
await p.evaluate(() => window.__SEAT().SEATUI.sp.click());
const closed = await p.evaluate(() => window.__picker());
check(closed === null, 'tap outside the card: it closes');
await p.evaluate(() => document.querySelector('#stage .wk-act2').click());

// ---- 3 點副駕駛座：走過去坐進去。車子不動、第一人稱在副駕駛座的眼睛、後照鏡照後面 ----
const sit3 = await p.evaluate(() => {
  const D = window.__D(), W = D.walker, S = window.__SEAT();
  document.querySelector('#stage .sp-seat[data-i="1"]').click();
  const picked = !window.__picker(), goes = W.mode;
  let n = 0; for (; n < 1200 && !(S.PAX.on && W.mode === 'off'); n++) window.__wstep(1);
  window.__dstep(70); // 鏡頭移過去
  const d = window.__D().drv, t0 = d.telemetry(); // 開車的（drv）是坐進去才做的
  d.setInput({ throttle: 1, brake: 0, steer: 0 }); window.__dstep(90); d.setInput(null);
  const t1 = d.telemetry();
  return { picked, goes, n, pax: S.PAX.on, i: S.PAX.i, mode: W.mode, paused: t1.paused, moved: +Math.hypot(t1.x - t0.x, t1.z - t0.z).toFixed(3), v: +t1.v.toFixed(3), cam: S.SCAM.mode, eyeD: window.__eyeD(1), near: D.dcam.near, hud: window.__vis('#stage .ps'), swap: window.__vis('#stage .ps-swap'), out: window.__vis('#stage .ps-out'), eye: document.querySelector('#stage .ps-eye')?.getAttribute('aria-pressed'), who: window.__vis('#stage .ps-who'), act2: window.__vis('#stage .wk-act2'), toast: window.__toast(), voice: !!window.__D().dvoice, me: window.__me() };
});
const mirOf = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => { const D = window.__D(); r(D.MIR.on && D.MIR.S === D.tripS); })))); // 後照鏡是畫面那一格（mirrorStep）才決定的
sit3.mir = await mirOf();
console.log('3', el(), JSON.stringify(sit3));
check(sit3.picked && (sit3.goes === 'in' || sit3.goes === 'walk') && sit3.pax && sit3.i === 1 && sit3.mode === 'off', `tapped 副駕駛座: you walked to the door and sat down (${(sit3.n / 60).toFixed(1)} s) 「${sit3.toast}」`);
check(sit3.paused && sit3.moved < 0.01 && Math.abs(sit3.v) < 0.01 && !sit3.voice, `in the passenger seat the car does not move (throttle for 1.5 s: ${sit3.moved} m), engine off`);
check(sit3.cam === 'eye' && sit3.eyeD < 0.02 && sit3.near <= 0.05 && sit3.mir, `first person from the passenger seat's eyes (${sit3.eyeD} m off), mirrors show what is behind`);
check(sit3.hud && sit3.swap && sit3.out && sit3.eye === 'true' && !sit3.who && !sit3.act2, 'seated HUD: 換位子, 下車, the eye button (pressed = first person); no 「坐在 X 的車上」 pill in your own car; the walking buttons are gone');
check(sit3.me.made && sit3.me.on && !sit3.me.vis && sit3.me.i === 1 && !sit3.me.walkerVis, 'your sitting self is in the passenger seat but not drawn in first person (no head in the way); the walking you is hidden');
const riEye = await shot('3-pax-eye');

// ---- 4 👁 → 從外面看：看得到你坐在車裡；拖畫面繞著車 ----
const out4 = await p.evaluate(() => {
  const D = window.__D(), S = window.__SEAT(), U = S.SEATUI;
  U.eye.click(); window.__dstep(70);
  const d0 = window.__carD(), p0 = D.dcam.position.clone(), me = window.__me();
  U.look.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: 200, clientY: 400, button: 0, bubbles: true }));
  U.look.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 320, clientY: 400, bubbles: true }));
  U.look.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: 320, clientY: 400, bubbles: true }));
  window.__dstep(5);
  const p1 = D.dcam.position.clone();
  return { cam: S.SCAM.mode, pref: S.SCAM.pref, eye: U.eye.getAttribute('aria-pressed'), d: d0, near: D.dcam.near, me, turned: +p0.distanceTo(p1).toFixed(2), d1: window.__carD(), yaw: +S.SCAM.oyaw.toFixed(2) };
});
out4.mir = await mirOf();
console.log('4', el(), JSON.stringify(out4));
check(out4.cam === 'out' && out4.pref === 'out' && out4.eye === 'false' && out4.d > 3 && out4.d < 7 && out4.near > 0.1 && !out4.mir, `eye button: the camera steps out of the car (${out4.d} m away; remembered for next time), mirrors off`);
check(out4.me.vis && out4.me.i === 1 && out4.me.state === 'sit', 'from outside you can see yourself sitting in the passenger seat');
check(out4.turned > 0.5 && Math.abs(out4.d1 - out4.d) < 0.3 && out4.yaw < -0.5, `dragging the screen orbits around the car (moved ${out4.turned} m, still ${out4.d1} m away)`);
const riOut = await shot('4-pax-out');

// ---- 5 「換位子」→ 後座右（你坐的那格黃色、不能點）→ 換到駕駛座＝開車（第一人稱）；追車視角看得到你坐在駕駛座、手握方向盤跟著轉 ----
const swap5 = await p.evaluate(() => {
  const S = window.__SEAT(), U = S.SEATUI;
  U.swap.click(); const P = window.__picker();
  document.querySelector('#stage .sp-seat[data-i="4"]').click(); window.__dstep(70);
  const after = { i: S.PAX.i, cam: S.SCAM.mode, me: window.__me(), toast: window.__toast() };
  U.eye.click(); window.__dstep(70); // 回第一人稱：後座右的眼睛
  return { P, after, eyeD: window.__eyeD(4), cam: S.SCAM.mode };
});
console.log('5', el(), JSON.stringify(swap5));
const me5 = swap5.P?.seats.find((s) => s.me);
check(swap5.P && swap5.P.title === '換到哪裡？' && me5?.i === 1 && me5.dis && me5.t.includes('你'), `「換位子」 opens the picker: your seat is yellow and says 你 (${me5?.t})`);
check(swap5.after.i === 4 && swap5.after.me.vis && swap5.after.me.i === 4 && /後座右/.test(swap5.after.toast), `moved to 後座右 「${swap5.after.toast}」`);
check(swap5.cam === 'eye' && swap5.eyeD < 0.02, `first person from the rear right seat (${swap5.eyeD} m off)`);
const riRear = await shot('5-rear-eye');
const drv6 = await p.evaluate(() => {
  const D = window.__D(), S = window.__SEAT(), U = S.SEATUI;
  U.swap.click(); document.querySelector('#stage .sp-seat[data-i="0"]').click(); window.__dstep(70);
  const d = D.drv, t = d.telemetry();
  const eye = { pax: S.PAX.on, paused: t.paused, cam: d.cameraMode, voice: !!window.__D().dvoice, hud: window.__vis('#stage .ps'), me: window.__me(), toast: window.__toast(), dEyeD: (() => { const e = D.dcam.position.clone().set(...D.dEye.eye); D.tripS.body.updateWorldMatrix(true, false); D.tripS.body.localToWorld(e); return +D.dcam.position.distanceTo(e).toFixed(3); })() };
  d.setCameraMode('chase'); window.__dstep(30);
  const C = S.MYSIT.C, at = () => ({ s: +d.telemetry().steer.toFixed(2), R: window.__bodyAt(C.hand), L: window.__bodyAt(C.handL) });
  d.setInput({ throttle: 0, brake: 0, steer: 0, handbrake: 1 }); window.__dstep(40); const s0 = at();
  d.setInput({ throttle: 0, brake: 0, steer: 1, handbrake: 1 }); window.__dstep(40); const s1 = at();
  d.setInput(null); window.__dstep(5);
  return { eye, chase: window.__me(), wheel: !!S.MYSIT.P.s?.wheel, s0, s1 };
});
console.log('6', el(), JSON.stringify(drv6));
check(!drv6.eye.pax && !drv6.eye.paused && drv6.eye.cam === 'eye' && drv6.eye.voice && !drv6.eye.hud && drv6.eye.dEyeD < 0.02 && /駕駛座/.test(drv6.eye.toast), `swapped into the driver's seat: you can drive (engine on, first person at the driver's eyes) 「${drv6.eye.toast}」`);
check(!drv6.eye.me.vis && drv6.chase.vis && drv6.chase.i === 0 && drv6.chase.state === 'sit', 'driving: not drawn in first person, but the chase camera shows you in the driver\'s seat');
const dR = Math.hypot(drv6.s1.R[1] - drv6.s0.R[1], drv6.s1.R[2] - drv6.s0.R[2]), dL = Math.hypot(drv6.s1.L[1] - drv6.s0.L[1], drv6.s1.L[2] - drv6.s0.L[2]);
check(drv6.wheel && drv6.s1.s > 0.9 && dR > 0.04 && dL > 0.04, `hands on the wheel and they turn with it (right hand moved ${dR.toFixed(3)} m, left ${dL.toFixed(3)} m at full lock)`);
await p.evaluate(() => { const d = window.__D().drv; d.setInput({ throttle: 0, brake: 0, steer: 1, handbrake: 1 }); window.__dstep(30); });
const riDrv = await shot('6-driver');
await p.evaluate(() => { const d = window.__D().drv; d.setInput(null); window.__dstep(30); });

// ---- 7 下車 → 再「選位子」坐副駕駛座（剛下來那台）→「下車」：人拿下來、走路；「上車」照舊開 ----
const out7 = await p.evaluate(() => {
  const D = window.__D(), W = D.walker, S = window.__SEAT();
  D.leaveCar(); let n = 0; for (; n < 300 && W.mode !== 'walk'; n++) window.__dstep(1); window.__wstep(30);
  const walk = { mode: W.mode, me: window.__me(), paused: D.drv.telemetry().paused, act2: W.action2 };
  document.querySelector('#stage .wk-act2').click(); document.querySelector('#stage .sp-seat[data-i="1"]').click();
  for (n = 0; n < 1200 && !(S.PAX.on && W.mode === 'off'); n++) window.__wstep(1);
  window.__dstep(70);
  const back = { pax: S.PAX.on, i: S.PAX.i, paused: D.drv.telemetry().paused, me: window.__me(), cam: S.SCAM.mode, carD: window.__carD() };
  S.SEATUI.out.click(); for (n = 0; n < 300 && W.mode !== 'walk'; n++) window.__dstep(1); window.__wstep(30);
  const t = W.telemetry(), car = W.cars.find((c) => c.drive);
  const out = { mode: W.mode, pax: S.PAX.on, hud: window.__vis('#stage .ps'), me: window.__me(), paused: D.drv.telemetry().paused, drive: !!car, want: Math.sign(S.seatsOf(D.cur)[1].side), side: car ? Math.sign((t.x - car.x) * Math.sin(car.heading) + (t.z - car.z) * Math.cos(car.heading)) : 0, act: W.action, act2: W.action2 };
  let ok = false; for (n = 0; n < 600 && !ok; n++) { ok = W.getIn(car); if (!ok) window.__wstep(1); }
  for (n = 0; n < 1200 && !(W.mode === 'off' && !D.drv.telemetry().paused); n++) window.__wstep(1);
  window.__dstep(5);
  return { walk, back, out, again: { ok, mode: W.mode, paused: D.drv.telemetry().paused, voice: !!D.dvoice, pax: S.PAX.on } };
});
console.log('7', el(), JSON.stringify(out7));
check(out7.walk.mode === 'walk' && !out7.walk.me.vis && out7.walk.me.walkerVis && out7.walk.paused && out7.walk.act2 === '選位子', 'got out as the driver: the sitting you comes off the car, 「選位子」 is back');
check(out7.back.pax && out7.back.i === 1 && out7.back.paused && out7.back.cam === 'eye' && !out7.back.me.vis && out7.back.carD < 1.5, `sat in the passenger seat of the car you just left (camera remembered: first person, ${out7.back.carD} m from the middle of the car)`);
check(out7.out.mode === 'walk' && !out7.out.pax && !out7.out.hud && !out7.out.me.vis && out7.out.me.walkerVis && out7.out.paused && out7.out.drive && out7.out.side === out7.out.want && /^上車/.test(out7.out.act), `tapped 下車: you stand on the passenger side (${out7.out.side < 0 ? 'left' : 'right'} for the GC8), the car stays put (still your car to get back into)`);
check(out7.again.ok && out7.again.mode === 'off' && !out7.again.paused && out7.again.voice && !out7.again.pax, '「上車」 after that drives as before (engine on)');

// ---- 8 兩人座（RX-7）的畫面只有前面一排；沙灘車、怪獸卡車沒有位子可以選 ----
const two8 = await p.evaluate(() => {
  const S = window.__SEAT();
  S.seatPickOpen({ k: 'rx7', own: true, taken: [], me: -1, valid: () => true, pick: () => {} });
  const P = window.__picker(); S.seatPickClose();
  return P;
});
console.log('8', el(), JSON.stringify(two8));
check(two8 && two8.two && two8.seats.length === 2 && two8.seats[0].top === two8.seats[1].top, 'two-seater (RX-7): a shorter car with only the front row');

// ---- 9 開出鐵捲門（追車視角：你坐在駕駛座）→ draw calls ----
const drive9 = await p.evaluate(() => {
  const D = window.__D(), d = D.drv; D.GAR.door.open(0.2); window.__dstep(40);
  d.setCameraMode('chase');
  for (let i = 0; i < 60 * 6; i++) { d.setInput({ throttle: 0.6, brake: 0, steer: 0 }); window.__dstep(1); }
  d.setInput(null); window.__stop(60);
  const t = d.telemetry(), L = D.garLot(), q = { x: (t.x - L.x) * Math.cos(L.heading) - (t.z - L.z) * Math.sin(L.heading) };
  return { out: q.x > 14, kmh: Math.round(t.kmh), me: window.__me(), bumps: t.bumps };
});
console.log('9', el(), JSON.stringify(drive9));
check(drive9.out && drive9.me.vis && drive9.me.i === 0 && drive9.bumps === 0, 'drove out through the door with you visible at the wheel');
const riStreet = await shot('9-street');
const riNoMe = await p.evaluate(() => { window.__SEAT().MYSIT.C.group.visible = false; return 1; }).then(() => shot('9-street-nome'));
await p.evaluate(() => { window.__dstep(1); });
console.log('  driver in the chase view costs', riStreet.calls - riNoMe.calls, 'draw calls /', riStreet.tris - riNoMe.tris, 'triangles');

console.log('draw calls:', JSON.stringify({ walk: riWalk, picker: riPick, paxEye: riEye, paxOut: riOut, rearEye: riRear, driver: riDrv, street: riStreet, streetNoMe: riNoMe }));
check(!errs.length, `no page errors (${errs.length})`);
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS OK', el());
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
