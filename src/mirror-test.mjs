// 第 25 批（Nick 2026-10-21「第一人稱駕駛的時候 後照鏡要真的顯示後方景色 有車子也要顯示出來 且會跟著開車方向移動」）：駕駛座的後照鏡
//   追車視角：不畫鏡子、照後鏡是原本的材質 → 駕駛座視角：車內後照鏡＋左右照後鏡換成往後看的畫面（uv：車內看正後面、左邊看左後方、右邊看右後方，左右相反）
//   → 後面那台路上的車照得到（藏起來畫面就不一樣）→ 車子轉個方向畫面跟著變 → 自己的車不在鏡子裡、畫完車子還是看得到 → 三格畫一次
//   → 換開 YARIS（圓的照後鏡）也一樣 → 回追車視角全部換回來；draw calls、三角形
// node mirror-test.mjs [prefix]（截圖：<prefix>-eye.png、<prefix>-rt.png …）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = '../out/mirror/mr'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__G = () => GAME; window.__room = () => room;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, TR, tripS, cur, walker, tripPose, GAR, garLot, MIR, mirrorStep, switchCar, dEye });'
  + ' window.__mainPass = () => { renderer.render(TR.scene, dcam); return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; };'
  + ' window.__mirPx = () => { const W = MIR.rt.width, H = MIR.rt.height, px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(MIR.rt, 0, 0, W, H, px); return Array.from(px); };'
  + ' window.__mirPng = () => { const W = MIR.rt.width, H = MIR.rt.height, px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(MIR.rt, 0, 0, W, H, px); const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"), im = x.createImageData(W, H); for (let y = 0; y < H; y++) im.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); x.putImageData(im, 0, 0); return c.toDataURL(); };'
  + ' window.__N = () => NPC;'
  + ' window.__pol = () => (typeof police !== "undefined" ? police : null);'
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

const mirShot = async (name) => { const du = await p.evaluate(() => window.__mirPng()); fs.writeFileSync(`${prefix}-${name}.png`, Buffer.from(du.split(',')[1], 'base64')); };
// 兩張鏡子畫面差多少（每個點 RGB 差的平均；只看中間那一塊 u 0.25～0.75、v 0.25～0.75）
const diff = (a, b, W, H) => { let s = 0, n = 0; for (let y = Math.floor(H * 0.25); y < H * 0.75; y++) for (let x = Math.floor(W * 0.25); x < W * 0.75; x++) { const i = (y * W + x) * 4; s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); n++; } return s / n / 3; };
await p.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  const tower = Array(40).fill(null); tower[0] = 'yaris';
  localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 500, owned: ['gc8', 'yaris'], parts: {}, tyres: {}, wins: {}, cars: {}, park: { mid: 'gc8', tower } }));
});
await p.goto(base, { waitUntil: 'domcontentloaded' });
await ready();
console.log('0', el(), 'page ready');
// ---- 1 出門：上 GC8、開出鐵捲門；追車視角不畫鏡子 ----
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk');
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
const in1 = await p.evaluate(() => {
  const W = window.__D().walker; let ok = false, k = 0;
  for (; k < 600 && !ok; k++) { ok = W.getIn(W.cars.find((c) => c.key === 'gc8')); if (!ok) window.__wstep(1); }
  let n = 0; for (; n < 1200 && !(window.__D().drv && W.mode === 'off'); n++) window.__wstep(1);
  const D = window.__D(); D.GAR.door.open(0.2); window.__dstep(40);
  const d = D.drv, L = D.garLot(); for (let i = 0; i < 400; i++) { const t = d.telemetry(), dx = t.x - L.x, dz = t.z - L.z; if (Math.hypot(dx, dz) > 24) break; d.setInput({ throttle: Math.abs(t.v) > 5 ? 0 : 0.6 }); window.__dstep(1); }
  for (let i = 0; i < 120 && Math.abs(d.telemetry().v) > 0.1; i++) { d.setInput({ brake: 1 }); window.__dstep(1); } d.setInput(null); window.__dstep(3);
  const S = D.tripS, gl = S.mats.mirrorGlass; let side = 0; S.body.traverse((o) => { if (o.isMesh && o.material === gl) side++; });
  return { ok, mode: W.mode, cur: D.cur, cam: d.cameraMode, mir: D.MIR.on, n: D.MIR.n, side, cabHidden: !S.cabin.userData.mirror.visible };
});
console.log('1', el(), JSON.stringify(in1));
check(in1.mode === 'off' && in1.cur === 'gc8' && in1.cam === 'chase' && !in1.mir && in1.n === 0 && in1.side === 2 && in1.cabHidden,
  `chase view: no mirror drawing, GC8's two side mirrors keep their normal glass, the real inside mirror is hidden (${in1.side} side mirrors)`);
// ---- 2 駕駛座視角：三面鏡子換成往後看的畫面 ----
const nc = await p.evaluate(() => { // 路上最近的一台汽車：我的車放在它前面 12 公尺、同方向（它在我後面）
  const T = window.__N().traffic, D = window.__D(), me = D.drv.telemetry();
  const cs = T.cars.filter((c) => c.kind === 'car' && !c.stun).sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z)); const c = cs[0]; if (!c) return null;
  D.drv.teleport({ x: c.x + Math.cos(c.heading) * 12, z: c.z - Math.sin(c.heading) * 12, heading: c.heading }); window.__dstep(2);
  return { key: c.key, id: c.id };
});
console.log('  car behind:', JSON.stringify(nc));
const e2 = await p.evaluate(() => {
  const D = window.__D(); D.drv.setCameraMode('eye'); window.__dstep(1); D.mirrorStep(); // 下一格（頁面自己畫的時候）就換
  const M = D.MIR, S = D.tripS, cm = S.cabin.userData.mirror, gl = S.mats.mirrorGlass, uvs = [];
  for (const e of M.list) { const a = e.o.geometry.attributes.uv.array; let u0 = 1, u1 = 0, v0 = 1, v1 = 0; for (let i = 0; i < a.length; i += 2) { u0 = Math.min(u0, a[i]); u1 = Math.max(u1, a[i]); v0 = Math.min(v0, a[i + 1]); v1 = Math.max(v1, a[i + 1]); }
    const w = e.o.getWorldPosition(M.w.clone()); S.body.worldToLocal(w); uvs.push({ cab: !!e.cab, z: +w.z.toFixed(2), u: [+u0.toFixed(3), +u1.toFixed(3)], v: [+v0.toFixed(3), +v1.toFixed(3)], mat: e.o.material === M.mat }); }
  // 鏡子左右相反：車內那面越往右（z 大）看的越右邊（u 小）
  const a = cm.geometry.attributes.uv.array, p = cm.geometry.attributes.position.array; let flip = true; for (let i = 0; i < a.length / 2; i++) for (let j = 0; j < a.length / 2; j++) if (p[i * 3 + 2] > p[j * 3 + 2] + 0.01 && !(a[i * 2] < a[j * 2])) flip = false;
  let side = 0; S.body.traverse((o) => { if (o.isMesh && o.material === gl) side++; });
  return { on: M.on, n: M.list.length, uvs, cabVis: cm.visible, flip, side, carVis: S.car.visible, rt: [M.rt.width, M.rt.height], calls: M.calls };
});
console.log('2', el(), JSON.stringify(e2));
const cab2 = e2.uvs.find((q) => q.cab), L2 = e2.uvs.find((q) => !q.cab && q.z < 0), R2 = e2.uvs.find((q) => !q.cab && q.z > 0);
check(e2.on && e2.n === 3 && e2.cabVis && e2.uvs.every((q) => q.mat) && e2.side === 0 && cab2 && L2 && R2,
  `first-person view: the inside mirror and both side mirrors show the backward picture (${e2.rt.join('×')} picture, ${e2.n} mirrors)`);
check(cab2 && cab2.u[0] > 0.2 && cab2.u[1] < 0.8 && cab2.u[0] < 0.5 && cab2.u[1] > 0.5 && L2.u[0] >= 0.5 && L2.u[1] <= 1.001 && R2.u[1] <= 0.5 && R2.u[0] >= -0.001 && e2.flip
  && e2.uvs.every((q) => q.v[0] >= -0.001 && q.v[1] <= 1.001),
  `each mirror looks the right way: inside = straight back (u ${cab2?.u}), left = behind on the left (u ${L2?.u}), right = behind on the right (u ${R2?.u}); left and right swapped like a real mirror`);
const px0 = await p.evaluate(() => { const D = window.__D(); D.MIR.n = 0; D.mirrorStep(); return { px: window.__mirPx(), calls: D.MIR.calls, tris: D.MIR.tris, carVis: D.tripS.car.visible }; });
await mirShot('rt-behind');
const px1 = await p.evaluate((id) => { const D = window.__D(), c = window.__N().traffic.cars.find((q) => q.id === id), o = c?.obj; if (o) o.visible = false; D.MIR.n = 0; D.mirrorStep(); const px = window.__mirPx(); if (o) o.visible = true; return { px, hid: !!o }; }, nc?.id); // 後面那台車藏起來再畫一次
await mirShot('rt-nocars');
const W = e2.rt[0], H = e2.rt[1], dCar = diff(px0.px, px1.px, W, H);
console.log('  mirror pass:', px0.calls, 'calls', px0.tris, 'tris; picture change without the car behind', dCar.toFixed(2));
check(nc && px1.hid && dCar > 3, `the car on the road behind (${nc?.key}) shows up in the mirror (the picture changes by ${dCar.toFixed(2)} when just that car is hidden)`);
check(px0.carVis && px0.calls > 10 && px0.calls < 200, `my own car is hidden only while the mirror is drawn (visible again after), mirror pass ${px0.calls} calls / ${(px0.tris / 1e6).toFixed(2)}M triangles`);
// 轉 90 度：鏡子裡的東西跟著變
const px2 = await p.evaluate(() => { const D = window.__D(), t = D.drv.telemetry(); D.drv.teleport({ x: t.x, z: t.z, heading: t.heading + Math.PI / 2 }); window.__dstep(1); D.MIR.n = 0; D.mirrorStep(); return { px: window.__mirPx() }; });
await mirShot('rt-turned');
const dTurn = diff(px0.px, px2.px, W, H);
check(dTurn > 8, `turn the car 90°: the mirror shows the new view behind (changed by ${dTurn.toFixed(2)})`);
// 三格畫一次
const every = await p.evaluate(() => { const D = window.__D(), M = D.MIR; let n = 0; for (let i = 0; i < 9; i++) { M.calls = -1; D.mirrorStep(); if (M.calls >= 0) n++; } return n; }); // 畫了才會寫 calls
check(every === 3, `the mirror is drawn every 3rd frame (${every} of 9)`);
await p.evaluate(() => { const D = window.__D(), t = D.drv.telemetry(); D.drv.teleport({ x: t.x, z: t.z, heading: t.heading - Math.PI / 2 }); window.__dstep(1); });
const sh = await shot('eye');
const main = await p.evaluate(() => window.__mainPass());
console.log('  first-person main view:', JSON.stringify(main), '+ mirror', px0.calls, 'calls /', (px0.tris / 1e6).toFixed(2), 'M every 3rd frame');
await p.setViewportSize({ width: 844, height: 390 });
const shL = await shot('eye-landscape');
await p.setViewportSize({ width: 390, height: 844 });
// ---- 3 換開 YARIS（圓的照後鏡）----
const y3 = await p.evaluate(async () => {
  const D = window.__D(); await D.switchCar('yaris'); let n = 0; while (n < 600 && !(window.__D().drv && window.__D().cur === 'yaris')) { await new Promise((r) => setTimeout(r, 50)); n++; }
  const D2 = window.__D(); D2.drv.setCameraMode('eye'); window.__dstep(1); D2.mirrorStep();
  const M = D2.MIR, S = D2.tripS, gl = S.mats.mirrorGlass; let side = 0; S.body.traverse((o) => { if (o.isMesh && o.material === gl) side++; });
  return { cur: D2.cur, on: M.on, S: M.S === S, n: M.list.length, side, cab: S.cabin.userData.mirror.visible };
});
console.log('3', el(), JSON.stringify(y3));
check(y3.cur === 'yaris' && y3.on && y3.S && y3.n === 3 && y3.side === 0 && y3.cab, `switched to YARIS (round side mirrors): its three mirrors show the backward picture too`);
// ---- 4 回追車視角：全部換回來 ----
const b4 = await p.evaluate(() => {
  const D = window.__D(); D.drv.setCameraMode('chase'); window.__dstep(2); D.mirrorStep();
  const M = D.MIR, S = D.tripS, gl = S.mats.mirrorGlass; let side = 0; S.body.traverse((o) => { if (o.isMesh && o.material === gl) side++; });
  const n0 = M.n; for (let i = 0; i < 6; i++) D.mirrorStep();
  return { on: M.on, n: M.list.length, side, cab: S.cabin.userData.mirror.visible, still: M.n === n0 };
});
console.log('4', el(), JSON.stringify(b4));
check(!b4.on && b4.n === 0 && b4.side === 2 && !b4.cab && b4.still, 'back to the chase view: side mirrors get their normal glass back, the inside mirror is hidden again, no more mirror drawing');
check(!errs.length, `no page errors (${errs.length})`);
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' / ')}` : `ALL CHECKS OK ${el()}`);
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
