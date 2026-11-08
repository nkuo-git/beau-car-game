// 第 77 批（Nick 2026-11-08「改車廠裡要有一個馬力機 可以自己把車開上去 車就跟原本一樣快 換檔啥的都一樣 只是在原地 旁邊要有一個螢幕顯示剛的車速跟馬力曲線圖」）：馬力機
// 第 1 段 Node（不開瀏覽器，一秒內）：drive.js setDyno：綁著車不動（x、z、方向都不變，方向盤不算）、速度和檔位照舊、輪上馬力 ≈ 0.88 × 馬力、放開就會動
// 第 2 段 瀏覽器：改車廠東邊的門開著（開得進去、沒撞到）、台子上「上馬力機」、綁好了（dyno、「下車」收起來）、油門到底 6 秒：車不動、滾筒轉、螢幕畫了曲線（最大馬力）、
//   截圖（追車、駕駛座、晚上）＋draw calls、「下馬力機」：倒車退到門口、存檔 best.dyno（48 格）、重新載入還在、再開上去又問
// node dyno-test.mjs [../out/dyno/dy]   （只跑 Node：NODE_ONLY=1）
import './village-node-stub.mjs';
import * as THREE from 'three';
import { createDrive } from './drive.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const fails = [];
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const r1 = (x) => +x.toFixed(1);

console.log('== 1 Node：綁在滾筒上 ==');
{
  const PERF = { hp: 280, kg: 1270, awd: 1, red: 7000, vmax: 250, cda: 0.65 };
  const W = { xf: 1.25, xr: -1.27, R: 0.31, trackF: 0.73, trackR: 0.73, wF: 0.2, wR: 0.2 };
  const car = new THREE.Group(), body = new THREE.Group(); body.name = 'body'; const shell = new THREE.Mesh(new THREE.BoxGeometry(W.xf - W.xr + 1.8, 1.1, 1.75)); shell.position.set((W.xf + W.xr) / 2, 0.7, 0); body.add(shell); car.add(body);
  const wheels = []; for (const [x, tr] of [[W.xf, W.trackF], [W.xr, W.trackR]]) for (const s of [-1, 1]) { const hub = new THREE.Group(); hub.position.set(x, W.R, s * tr); const wh = new THREE.Group(); hub.add(wh); car.add(hub); wheels.push(wh); }
  const scene = new THREE.Scene(); scene.add(car);
  const d = createDrive({ car: { car, body, wheels, spec: { wheels: W, interior: { wheelZ: 0.37 } } }, scene, camera: null, perf: PERF, world: { surfaceAt: () => 0, colliders: [], places: {} }, keyboard: false });
  d.teleport({ x: 5, z: 7, heading: 0.3 }); d.setDyno({ x: 5, z: 7, heading: 0.3 });
  let peak = 0, px = 0, drift = 0, gears = new Set(), rpmMax = 0;
  for (let i = 0; i < 60 * 12; i++) { d.setInput({ throttle: 1, steer: 1, handbrake: 1 }); d.update(1 / 60); const t = d.telemetry(); if (t.whp > peak) { peak = t.whp; px = t.whpX; } drift = Math.max(drift, Math.abs(t.x - 5), Math.abs(t.z - 7), Math.abs(t.heading - 0.3), Math.abs(t.steer)); gears.add(t.gear); rpmMax = Math.max(rpmMax, t.rpm); }
  const t = d.telemetry();
  check(t.dyno && drift < 1e-9, `setDyno：油門到底 12 秒（方向盤打死、手煞車也按著）車還在原地、方向沒變（最多偏 ${drift}）`);
  check(t.kmh > 150 && gears.size >= 4 && t.gear >= 4, `速度表照跑：${Math.round(t.kmh)} km/h、換到 ${t.gear} 檔（經過 ${[...gears].join(' ')}）`);
  check(Math.abs(peak - PERF.hp * 0.88) < PERF.hp * 0.03 && px > 0.9 && px <= 1.02, `輪上馬力最大 ${r1(peak)} hp（＝0.88 × ${PERF.hp} ＝ ${r1(PERF.hp * 0.88)}）在轉速 ${r1(px * 100)}%、紅線 ${t.redline}`);
  check(Math.abs(wheels[0].rotation.z) > 100, `輪子有在轉（${r1(wheels[0].rotation.z)} 弧度）`);
  d.setDyno(null); for (let i = 0; i < 60; i++) { d.setInput({ throttle: 1 }); d.update(1 / 60); }
  check(!d.telemetry().dyno && d.telemetry().x - 5 > 20, `setDyno(null)：放開以後 1 秒開出去 ${r1(d.telemetry().x - 5)} 公尺`);
}
if (process.env.NODE_ONLY) { console.log(fails.length ? `\n${fails.length} FAIL` : '\nALL CHECKS OK'); process.exit(fails.length ? 1 : 0); }

console.log('== 2 瀏覽器：改車廠的馬力機 ==');
const pw = (await import('/opt/node22/lib/node_modules/playwright/index.js')).default;
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = '../out/dyno/dy'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__G = () => GAME; window.__P = () => PERF;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, tripS, TR, cur, built, walker, LOOK, DYNO, bayLock, CARS, hpOf });'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } };'
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
const errs = [];
p.on('pageerror', (e) => { errs.push(e.message); console.log('pageerror', e.message); });
p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_CERT|404|GPU stall|AudioContext was not allowed|ScriptProcessorNode|worklet timeout|ERR_TUNNEL|ERR_NAME|ERR_CONNECTION|fonts\.g/.test(m.text())) console.log('console', m.type(), m.text().slice(0, 240)); });
const T0 = Date.now(), el = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`;
const ready = () => p.waitForFunction(() => document.getElementById('status').hidden, null, { timeout: 300000 });
async function shot(name) { // 開車：畫兩格再截圖
  const n0 = await p.evaluate(() => { window.__noDraw = false; return window.__dframes || 0; });
  await p.waitForFunction((n) => (window.__dframes || 0) >= n + 2, n0, { timeout: 300000 });
  await p.evaluate(() => { window.__noDraw = true; });
  await p.screenshot({ path: `${prefix}-${name}.png` });
  const ri = await p.evaluate(() => window.__rinfo());
  console.log('  shot', `${prefix}-${name}.png`, JSON.stringify(ri), el());
  return ri;
}
await p.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 500, owned: ['gc8'], parts: {}, tyres: {}, wins: {}, cars: {}, park: { mid: 'gc8', tower: Array(40).fill(null) } }));
});
await p.goto(base, { waitUntil: 'domcontentloaded' });
await ready();
await p.waitForFunction(() => window.__D().built.gc8?.car, null, { timeout: 120000 });
console.log('0', el(), 'page ready');
// ---- 出門、上 GC8 ----
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk');
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; window.__npcPause(true); });
const got = await p.evaluate(() => {
  const W = window.__D().walker; let ok = false, k = 0;
  for (; k < 600 && !ok; k++) { ok = W.getIn(W.cars.find((c) => c.key === 'gc8')); if (!ok) window.__wstep(1); }
  let n = 0; for (; n < 1200 && !(window.__D().drv && W.mode === 'off'); n++) window.__wstep(1);
  return { ok, mode: W.mode };
});
check(got.ok && got.mode === 'off', `in the GC8 (${JSON.stringify(got)})`);
// ---- 2a 東邊的門開著：門口前面開進去（沒撞到）；台子上才有「上馬力機」 ----
const R2 = Math.PI / 2;
const door = await p.evaluate((R2) => {
  const D = window.__D(), d = D.drv, P = D.VIL.places.shop.dyno;
  d.teleport({ x: -148.5, z: -16, heading: R2 }); window.__dstep(5);
  const near = d.colsNear(-148.5, -26, 1.2).filter((c) => c.t === 'box' && Math.abs(c.z + 26) < 0.6 && Math.abs(c.x + 148.5) < c.hx + 1.2); // 以前這裡是關著的鐵捲門（牆：x −151.5…−145.5 一塊）
  const a0 = d.action; const b0 = d.telemetry().bumps;
  let acts = []; for (let i = 0; i < 60 * 8; i++) { const t = d.telemetry(); d.setInput({ throttle: t.z > -30.5 ? 0.3 : 0, brake: t.z <= -30.5 && t.v > 0.3 ? 1 : 0 }); window.__dstep(1); if (t.z < -27 && !acts.includes(d.action)) acts.push(d.action); if (t.z <= -30.5 && t.v <= 0.3) break; }
  for (let i = 0; i < 10; i++) { d.setInput({ throttle: 0, brake: 0 }); window.__dstep(1); }
  const t = d.telemetry();
  return { near, wall: near.length, a0, bumps: t.bumps - b0, z: +t.z.toFixed(1), x: +t.x.toFixed(1), kmh: +t.kmh.toFixed(1), acts, pad: P.pad, onPad: Math.abs(t.x - P.pad.x) <= P.pad.hx && Math.abs(t.z - P.pad.z) <= P.pad.hz, act: d.action, act2: d.action2 };
}, R2);
console.log('2a', el(), JSON.stringify(door));
check(door.wall === 0 && door.bumps === 0 && door.z < -27 && door.a0 === null && door.acts.includes('上馬力機'), `east roller door is open: drove in from the forecourt without a bump (z ${door.z}), no wall collider at the door, no button outside`);
check(door.onPad && door.act === '上馬力機' && door.act2 === '下車', `stopped on the dyno pad: big button 「上馬力機」, 「下車」 still there`);
// ---- 2b 上馬力機：自己開正、綁好；油門到底 6 秒：車不動、滾筒轉、螢幕有曲線 ----
const on = await p.evaluate(() => {
  const D = window.__D(), d = D.drv, P = D.VIL.places.shop.dyno;
  document.querySelector('#stage .dv-act').click();
  let k = 0; for (; k < 600 && !d.telemetry().dyno; k++) { d.setInput({ throttle: 0, brake: 0 }); window.__dstep(1); }
  const t0 = d.telemetry();
  const mid = { act2: d.action2, act: d.action, auto: t0.auto }; window.__dstep(5);
  return { k, dyno: t0.dyno, x: +t0.x.toFixed(2), z: +t0.z.toFixed(2), h: +t0.heading.toFixed(3), pose: P.pose, on: D.DYNO.on, ax: D.DYNO.ax.map((v) => +v.toFixed(2)), w: +D.DYNO.w.toFixed(2), ...mid, hidden: !!document.querySelector('#stage .dv-act2.on') === false };
});
console.log('2b', el(), JSON.stringify(on));
check(on.dyno && on.on && Math.abs(on.x - on.pose.x) < 0.01 && Math.abs(on.z - on.pose.z) < 0.01 && Math.abs(on.h - on.pose.heading) < 0.01, `「上馬力機」: drove onto the rollers by itself (${on.k} frames) and is strapped at the pose`);
check(on.act === '下馬力機' && on.act2 === null && on.ax[0] > 1 && on.ax[1] < -1 && on.w > 1.5, `on the dyno: button 「下馬力機」, no 「下車」; rollers under the GC8's axles (${on.ax.join(' / ')} m, ${on.w} m wide)`);
const ri0 = await shot('2-on-chase');
const run = await p.evaluate(() => {
  const D = window.__D(), d = D.drv, P = D.VIL.places.shop.dyno;
  const a0 = D.DYNO.ang, f0 = D.DYNO.fr; let gears = new Set(), kmh = 0, drift = 0;
  for (let i = 0; i < 360; i++) { d.setInput({ throttle: 1, steer: 1 }); window.__dstep(1); const t = d.telemetry(); gears.add(t.gear); kmh = Math.max(kmh, t.kmh); drift = Math.max(drift, Math.abs(t.x - P.pose.x), Math.abs(t.z - P.pose.z), Math.abs(t.heading - P.pose.heading), Math.abs(t.steer)); }
  const bins = Array.from(D.DYNO.bins), nz = bins.filter((v) => v > 0).length;
  const px = D.DYNO.ctx.getImageData(0, 0, 768, 432).data; let orange = 0, dark = 0; for (let i = 0; i < px.length; i += 4) { if (px[i] > 200 && px[i + 1] > 80 && px[i + 1] < 140 && px[i + 2] < 80) orange++; if (px[i] < 20 && px[i + 1] < 24 && px[i + 2] < 32) dark++; }
  return { kmh: +kmh.toFixed(1), gears: [...gears], drift, peak: +D.DYNO.peak.toFixed(1), peakX: +D.DYNO.peakX.toFixed(3), hp: D.hpOf(D.cur), nz, spun: +(D.DYNO.ang - a0).toFixed(1), frames: D.DYNO.fr - f0, orange, dark, tex: D.DYNO.tex.image === D.DYNO.cv, car: D.tripS.car.position.x };
});
console.log('2c', el(), JSON.stringify(run));
check(run.drift < 1e-6 && run.kmh > 100 && run.gears.length >= 3, `full throttle 6 s with the wheel turned: car stays put, speedo ${run.kmh} km/h, gears ${run.gears.join(' ')}`);
check(Math.abs(run.peak - run.hp * 0.88) < run.hp * 0.04 && run.peakX > 0.85 && run.nz > 20, `curve: peak ${run.peak} hp at ${Math.round(run.peakX * 100)} % revs (0.88 × ${run.hp} hp), ${run.nz} of 48 bins filled`);
check(run.spun > 500 && run.frames >= 100 && run.orange > 1500 && run.dark > 100000 && run.tex, `rollers spun ${run.spun} rad, screen redrawn ${run.frames} times, orange curve drawn (${run.orange} px)`);
const ri1 = await shot('2-run-chase');
await p.evaluate(() => { const d = window.__D().drv; d.setCameraMode('eye'); for (let i = 0; i < 40; i++) { d.setInput({ throttle: 1 }); window.__dstep(1); } }); // 鏡頭要跑幾格才會到駕駛座
const ri2 = await shot('2-run-eye');
await p.evaluate(() => { const D = window.__D(); D.drv.setCameraMode('chase'); D.LOOK?.set?.(1); D.LOOK?.setHour?.(22); D.LOOK?.setRain?.(0); for (let i = 0; i < 40; i++) { D.drv.setInput({ throttle: 1 }); window.__dstep(1); } });
const ri3 = await shot('2-run-night');
await p.evaluate(() => { const D = window.__D(); D.LOOK?.setHour?.(13); D.LOOK?.set?.(0); window.__dstep(3); });
console.log('  draw calls: strapped', ri0.calls, 'running', ri1.calls, 'eye', ri2.calls, 'night(high)', ri3.calls);
// ---- 2d 下馬力機：記下來、倒車退到門口；存檔；bayLock ----
const off = await p.evaluate(() => {
  const D = window.__D(), d = D.drv, P = D.VIL.places.shop.dyno;
  for (let i = 0; i < 60; i++) { d.setInput({ throttle: 0, brake: 1 }); window.__dstep(1); }
  const peak = D.DYNO.peak;
  document.querySelector('#stage .dv-act').click();
  let k = 0, minV = 0; for (; k < 900; k++) { d.setInput({ throttle: 0, brake: 0 }); window.__dstep(1); const t = d.telemetry(); minV = Math.min(minV, t.v); if (!t.auto && !t.dyno && k > 5) break; }
  window.__dstep(3);
  const t = d.telemetry(), rec = window.__G().best.dyno.gc8, saved = JSON.parse(localStorage.getItem('carid.tune')).best.dyno.gc8;
  const px = D.DYNO.ctx.getImageData(0, 0, 768, 432).data; let grey = 0; for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - 0x6b) < 6 && Math.abs(px[i + 1] - 0x72) < 6 && Math.abs(px[i + 2] - 0x80) < 6) grey++;
  return { k, dyno: t.dyno, on: D.DYNO.on, z: +t.z.toFixed(1), x: +t.x.toFixed(2), off: P.off, minV: +minV.toFixed(1), act: d.action, act2: d.action2, lock: D.bayLock.dyno, peak: +peak.toFixed(1), rec, savedHp: saved?.hp, savedN: saved?.c?.length, grey };
});
console.log('2d', el(), JSON.stringify({ ...off, rec: off.rec && { hp: off.rec.hp, rpm: off.rec.rpm, kmh: off.rec.kmh, n: off.rec.c.length } }));
check(!off.dyno && !off.on && Math.abs(off.z - off.off.z) < 0.05 && Math.abs(off.x - off.off.x) < 0.05 && off.minV < -1, `「下馬力機」: released and reversed back to the door by itself (z ${off.z}, slowest ${off.minV} m/s)`);
check(off.rec && off.rec.hp === Math.round(off.peak) && off.rec.c.length === 48 && off.rec.rpm > 5000 && off.savedHp === off.rec.hp && off.savedN === 48, `best.dyno.gc8 saved: ${off.rec?.hp} hp @ ${off.rec?.rpm} rpm, 48 bins, in localStorage`);
check(off.act === null && off.act2 === '下車' && off.lock === false && off.grey > 300, `after: backed out past the pad (no button here, lock already cleared), 「下車」 back, screen shows the grey 上次 line (${off.grey} px)`);
const ri4 = await shot('2-off');
const again = await p.evaluate(() => {
  const D = window.__D(), d = D.drv, P = D.VIL.places.shop.dyno;
  d.teleport({ x: -148.5, z: -12, heading: Math.PI / 2 }); window.__dstep(5); const lock1 = D.bayLock.dyno;
  d.teleport({ x: P.pose.x, z: P.pose.z + 1, heading: Math.PI / 2 }); window.__dstep(5);
  return { lock1, act: d.action };
});
check(again.lock1 === false && again.act === '上馬力機', `drive away and back onto the pad: 「上馬力機」 offered again`);
// ---- 2e 重新載入：上次的紀錄還在 ----
await p.reload({ waitUntil: 'domcontentloaded' }); await ready();
const rec2 = await p.evaluate(() => window.__G().best.dyno.gc8);
check(rec2 && rec2.hp === off.rec.hp && rec2.c.length === 48, `reload: best.dyno.gc8 still ${rec2?.hp} hp`);
check(errs.length === 0, `no page errors (${errs.length})`);
await b.close(); srv.close();
console.log(fails.length ? `\n${fails.length} FAIL:\n  ${fails.join('\n  ')}` : '\nALL CHECKS OK');
process.exit(fails.length ? 1 : 0);
