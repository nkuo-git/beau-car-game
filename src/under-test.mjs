// 第 26 批（Nick 2026-10-21「看可以的話加在地下室然後地下室有幾樓樓上就剪掉幾樓」；草稿 https://claude.ai/artifact/36fLvpmhQmAd2LCwaaeBH2，Nick 選「坐電梯」）：圓塔的地下室
//   數字（樓上 2F–4F、B1 −3.2、B2 −6.4、斜坡到 4F、37 格）、舊存檔停在五樓、六樓的車＝B1、B2 → 開 GC8 坐電梯去 B1（電梯的洞看得下去、不會被草地蓋住）
//   → B1 往前開進格子停好、下車（「B1 N 號」）、走路走不出水泥牆、鏡頭在天花板下面 → 走路坐電梯去 B2（看得到停在那裡的 SUPRA）→ 回 1 樓
//   → 電梯在 B2 的時候從一樓看下去（洞、地下室；外面看不到）；draw calls、三角形
// node under-test.mjs [prefix]（截圖：<prefix>-*.png）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = '../out/under/ug'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__THREE = THREE; window.__G = () => GAME; window.__room = () => room;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, trip, tripS, TR, LODS, cur, walker, tripPose, TWR, EL, elWho, elFree, padCars, normPark, TOWER_BAYS, towerFy, towerUnder, towerFlName, TOWER, TOWER_RAMP, towerRampY, TRAMP, garLot, HOME, leaveCar, liftChanged, elCallAct, elCall });'
  + ' window.__frame = (noHole, w, h) => { GAR.cull(dcam); if (noHole && GAR.hole) GAR.hole.visible = false; renderer.setRenderTarget(null); renderer.render(TR.scene, dcam); const info = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles }, c = renderer.domElement, url = c.toDataURL(), gl = renderer.getContext(), px = new Uint8Array(w * h * 4); gl.readPixels((c.width - w) >> 1, (c.height - h) >> 1, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); return { url, px: Array.from(px), info }; };'
  + ' window.__N = () => NPC;'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } else if (window.__npcKeep) { NPC = window.__npcKeep; window.__npcKeep = null; NPC.g.visible = DRIVE.on; } };'
  + ' window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };'
  + ' window.__wstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return walker && walker.telemetry(); };';
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
await p.addInitScript(() => {
  window.__follow = (pts, frames, vmax, until, every) => {
    const D = window.__D(), d = D.drv; let k = 0, bumps = 0; const bumpAt = [];
    for (let i = 0; i < frames; i++) {
      const t = d.telemetry(), q = window.__gl(t.x, t.z);
      let bj = k, bd = 1e9, bu = 0;
      for (let j = Math.max(0, k - 1); j < Math.min(pts.length - 1, k + 6); j++) { const A = pts[j], B = pts[j + 1], vx = B[0] - A[0], vz = B[1] - A[1], u = Math.max(0, Math.min(1, ((q.x - A[0]) * vx + (q.z - A[1]) * vz) / (vx * vx + vz * vz))), e = Math.hypot(q.x - A[0] - vx * u, q.z - A[1] - vz * u); if (e < bd) { bd = e; bj = j; bu = u; } }
      k = bj; let la = 2.2 + 0.35 * Math.abs(t.v), j = bj, px = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * bu, pz = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * bu;
      while (la > 0 && j < pts.length - 1) { const B = pts[j + 1], l = Math.hypot(B[0] - px, B[1] - pz); if (l >= la) { px += ((B[0] - px) * la) / l; pz += ((B[1] - pz) * la) / l; la = 0; } else { la -= l; px = B[0]; pz = B[1]; j++; } }
      const w = window.__gw(px, pz), a = Math.atan2(-(w.z - t.z), w.x - t.x) - t.heading, aa = Math.atan2(Math.sin(a), Math.cos(a)), vm = vmax(k, pts.length);
      let thr = 1, brk = 0; if (Math.abs(t.v) > vm + 0.5) { thr = 0; brk = 1; } else if (Math.abs(t.v) > vm - 0.5) thr = 0.3;
      d.setInput({ throttle: thr, brake: brk, steer: Math.max(-1, Math.min(1, -3 * aa)) }); window.__dstep(1);
      const t2 = d.telemetry(); if (t2.bumps > t.bumps) { bumps++; const q2 = window.__gl(t2.x, t2.z), T = window.__D().TRAMP; bumpAt.push({ i, r: +Math.hypot(q2.x, q2.z).toFixed(2), a: +Math.atan2(q2.z, q2.x).toFixed(3), hl: +Math.atan2(Math.sin(t2.heading - window.__D().garLot().heading), Math.cos(t2.heading - window.__D().garLot().heading)).toFixed(2), v: +t2.v.toFixed(2), on: T.on, u: +T.u.toFixed(2), f: window.__D().GAR.floor }); }
      if (every && i % 10 === 0) every(t2);
      if (until && until(t2)) { d.setInput(null); return { ok: true, i, bumps, bumpAt }; }
    }
    d.setInput(null); return { ok: false, i: frames, bumps, bumpAt };
  };
  // 停住（煞車到停）
  window.__stop = (n = 60) => { const d = window.__D().drv; for (let i = 0; i < n; i++) { const v = d.telemetry().v; d.setInput(v > 0.15 ? { throttle: 0, brake: 1, steer: 0 } : v < -0.15 ? { throttle: 1, brake: 0, steer: 0 } : { throttle: 0, brake: 0, steer: 0, handbrake: 1 }); window.__dstep(1); } d.setInput(null); }; // 停住了就放開煞車（踩著煞車會倒車）
  window.__toast = () => [...document.querySelectorAll('#stage .dv-toast.show, #stage .wk-toast.show')].map((e) => e.textContent).join(' | ');
});

// 自己畫一格（noHole：電梯的洞不挖＝原本那樣被地面蓋住）：存成圖、回傳中間 w × h 的點
async function frame(name, noHole = false, w = 120, h = 120) {
  const r = await p.evaluate(([n, w, h]) => window.__frame(n, w, h), [noHole, w, h]);
  fs.writeFileSync(`${prefix}-${name}.png`, Buffer.from(r.url.split(',')[1], 'base64'));
  console.log('  frame', `${prefix}-${name}.png`, JSON.stringify(r.info), el());
  return r;
}
const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / (a.length / 4) / 3; };
// 開局：GC8（開的，停在一樓電梯上）＋舊存檔（內容 17）：GT-R 二樓 1 號、YARIS 五樓 1 號（24＝現在的 B1 1 號）、SUPRA 六樓 6 號（37：內容 18 試做是斜坡的路，現在是 B2 6 號）
await p.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  const tower = Array(40).fill(null); tower[0] = 'gtr'; tower[24] = 'yaris'; tower[37] = 'supra';
  localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 500, owned: ['gc8', 'yaris', 'supra', 'gtr'], parts: {}, tyres: {}, wins: {}, cars: {}, park: { mid: 'gc8', tower } }));
});
await p.addInitScript(() => { window.__toast = () => [...document.querySelectorAll('#stage .dv-toast.show, #stage .wk-toast.show')].map((e) => e.textContent).join(' | '); });

await p.goto(base, { waitUntil: 'domcontentloaded' });
await ready();
console.log('0', el(), 'page ready');
// ---- 0 數字；舊存檔的格子不變 ----
const st0 = await p.evaluate(() => {
  const D = window.__D(), R = D.TOWER_RAMP, B = D.TOWER_BAYS;
  return { fy: [0, 1, 2, 3, 4, 5].map((f) => +D.towerFy(f).toFixed(3)), top: D.TOWER.TOP, ne: R.NE, rampTop: +(D.towerRampY(R.UEND) - D.towerFy(R.NE)).toFixed(6), roads: B.filter((b) => b.road).map((b) => b.id),
    free: B.filter((b) => !b.road).length, under: B.filter((b) => D.towerUnder(b.f)).map((b) => b.id), names: [0, 1, 2, 3, 4, 5].map(D.towerFlName), park: window.__G().park };
});
console.log('  ', JSON.stringify({ ...st0, park: undefined }));
check(JSON.stringify(st0.fy) === '[0,4.5,7.7,10.9,-3.2,-6.4]' && st0.top === 14.1 && JSON.stringify(st0.names) === '["1F","2F","3F","4F","B1","B2"]', `floors: 1F 0, 2F–4F up to 10.9 m, B1 −3.2, B2 −6.4; roof at ${st0.top} m (2 floors lower)`);
check(st0.ne === 3 && st0.rampTop === 0 && JSON.stringify(st0.roads) === '[5,9,21]', `the outside ramp ends level with 4F; ramp mouths only on 2F–4F (road spots ${st0.roads})`);
check(st0.free === 37 && st0.under.length === 16 && st0.under[0] === 24 && st0.under[15] === 39, `37 parking spots (B1 = spots 25–32, B2 = 33–40: the old 5F, 6F)`);
const tw0 = st0.park.tower;
check(tw0[0] === 'gtr' && tw0[24] === 'yaris' && tw0[37] === 'supra' && tw0.filter(Boolean).length === 3, `old save: the car on 5F is now on B1, the one on 6F (spot 38, a ramp road in the last trial) is on B2; none moved, none lost`);

// ---- 1 出門：上 GC8（停在電梯上）→ 面板：2F 3F 4F／B2 B1 1F（地下室藍色），每層空幾格 ----
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk');
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.evaluate(() => {
  const D = window.__D(), L = D.garLot(), c = Math.cos(L.heading), s = Math.sin(L.heading);
  window.__gw = (lx, lz) => ({ x: L.x + lx * c + lz * s, z: L.z - lx * s + lz * c });
  window.__gl = (x, z) => { const dx = x - L.x, dz = z - L.z; return { x: dx * c - dz * s, z: dx * s + dz * c }; };
  window.__npcPause(true);
});
const in1 = await p.evaluate(() => {
  const W = window.__D().walker; let ok = false, k = 0;
  for (; k < 600 && !ok; k++) { ok = W.getIn(W.cars.find((c) => c.key === 'gc8')); if (!ok) window.__wstep(1); }
  let n = 0; for (; n < 1200 && !(window.__D().drv && W.mode === 'off'); n++) window.__wstep(1);
  window.__dstep(30);
  const D = window.__D(), P = document.querySelector('#stage .elpanel'), vis = (b) => !!b && !b.hidden && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width > 0;
  const btns = P ? [...P.querySelectorAll('.elg button')].map((b) => [b.firstChild.textContent.trim(), b.querySelector('small')?.textContent || '', b.classList.contains('ug'), getComputedStyle(b).backgroundColor]) : [];
  return { ok, mode: W.mode, who: D.elWho(), panel: vis(P), btns, mat: (() => { const g = D.VIL.group.getObjectByName('ground'); return g ? [g.material.stencilWrite, g.material.stencilFunc, g.material.stencilWriteMask] : null; })() };
});
console.log('1', el(), JSON.stringify(in1));
check(in1.mode === 'off' && in1.who === 1 && in1.panel, 'in GC8 on the lift at 1F: the lift panel is up');
check(JSON.stringify(in1.btns.map((b) => b[0])) === '["2F","3F","4F","B2","B1","1F"]' && in1.btns.every((b) => b[2] === (b[0][0] === 'B')) && in1.btns[3][3] === 'rgb(44, 51, 84)', `panel: top row 2F 3F 4F, bottom row B2 B1 1F; the basement buttons are blue (${in1.btns.map((b) => `${b[0]}${b[1] ? ' ' + b[1] : ''}`).join(' · ')})`);
check(JSON.stringify(in1.btns.map((b) => b[1])) === '["空 6","空 7","空 7","空 7","空 7",""]', 'free spots: 2F 6 (GT-R + ramp mouth), 3F 7, 4F 7, B1 7 (YARIS), B2 7 (SUPRA)');
check(!!in1.mat && in1.mat[0] === true && in1.mat[1] === 517 && in1.mat[2] === 0, `the grass under the tower does not draw where the lift hole is (stencil not-equal, never writes): ${JSON.stringify(in1.mat)}`);
const ri1 = await (async () => { await p.evaluate(() => window.__dstep(1)); return shot('1-panel'); })();

// ---- 2 按 B1：電梯連車往下；半路從上面看：洞看得下去（不挖洞＝被草地蓋住，畫面不一樣）----
await p.evaluate(() => document.querySelector('#stage .elpanel .elg button[data-f="4"]').click());
const mid = await p.evaluate(() => {
  const D = window.__D(), G = D.GAR, y0 = G.group.position.y; let n = 0, toast = '';
  for (; n < 600 && !(D.EL.ride && G.platform.position.y < -1.6); n++) { window.__dstep(1); toast = toast || window.__toast(); }
  const c = new window.__THREE.Vector3(); D.dcam.getWorldPosition(c); G.cull(D.dcam); // 畫的時候才開關（driveFrame）
  return { n, ride: !!D.EL.ride, py: +G.platform.position.y.toFixed(2), camY: +(c.y - y0).toFixed(2), toast, hole: G.hole.visible, under: G.under.visible };
});
console.log('2', el(), JSON.stringify(mid));
const fa = await frame('2-ride'), fb = await frame('2-ride-nohole', true);
const dRide = diff(fa.px, fb.px);
check(mid.ride && mid.py < -1.5 && mid.camY > 0.3 && /電梯去 B1/.test(mid.toast), `pressed B1: the lift goes down with the car; the camera is still above the 1F floor (${mid.camY} m) while the car is ${mid.py} m down 「${mid.toast}」`);
check(mid.hole && mid.under && dRide > 12, `looking down the lift shaft from above: the hole is open and the basement shows (center differs by ${dRide.toFixed(1)} from the old covered-by-grass picture)`);
const arr1 = await p.evaluate(() => {
  const D = window.__D(), G = D.GAR, y0 = G.group.position.y; let n = 0, toast = '', camHi = -9;
  for (; n < 900 && (D.EL.ride || G.lift.busy); n++) window.__dstep(1);
  for (let i = 0; i < 40; i++) { window.__dstep(1); toast = toast || window.__toast(); camHi = Math.max(camHi, D.dcam.position.y - y0); }
  const t = D.drv.telemetry(), q = window.__gl(t.x, t.z), hl = Math.atan2(Math.sin(t.heading - D.garLot().heading), Math.cos(t.heading - D.garLot().heading));
  const bay = D.TOWER_BAYS.find((b) => b.f === 4 && Math.abs(Math.atan2(Math.sin(b.heading - hl), Math.cos(b.heading - hl))) < 0.05);
  return { n, floor: G.floor, lf: G.lift.floor, y: +(t.y - y0).toFixed(3), r: +Math.hypot(q.x, q.z).toFixed(2), toast, camHi: +camHi.toFixed(2), bay: bay && { id: bay.id, free: !D.TWR[bay.id] }, under: G.under.visible, vis: G.floors.map((g) => g.visible), carScene: D.tripS.car.parent === D.TR.scene };
});
console.log('  B1:', JSON.stringify(arr1));
check(arr1.floor === 4 && arr1.lf === 4 && Math.abs(arr1.y + 3.2) < 0.03 && arr1.carScene && /B1：往前開進空的格子/.test(arr1.toast), `arrived at B1 (car at ${arr1.y} m) 「${arr1.toast}」`);
check(!!arr1.bay && arr1.bay.free, `the lift turned the car to face a free spot (B1 ${arr1.bay && arr1.bay.id - 23} 號)`);
check(arr1.under && arr1.vis[4] && !arr1.vis[1] && !arr1.vis[5] && arr1.camHi < -0.3 - 0.4, `on B1: the basement is drawn, only B1's cars; the chase camera stays under the B1 ceiling (highest ${arr1.camHi} m)`);
const riB1 = await (async () => { await p.evaluate(() => window.__dstep(1)); return shot('3-b1'); })();

// ---- 3 往前開進格子、下車：「停好了：B1 N 號」；走路走不出水泥牆、鏡頭在天花板下面 ----
const park3 = await p.evaluate(() => {
  const D = window.__D(), t0 = D.drv.telemetry(), hl = t0.heading - D.garLot().heading, ux = Math.cos(hl), uz = -Math.sin(hl);
  const pts = [[0, 0], [ux * 3, uz * 3], [ux * 7.6, uz * 7.6], [ux * 10, uz * 10]];
  const r = window.__follow(pts, 60 * 15, () => 2, (t) => { const q = window.__gl(t.x, t.z); return Math.hypot(q.x, q.z) > 7.3; });
  window.__stop(60);
  const t = D.drv.telemetry(), q = window.__gl(t.x, t.z);
  D.leaveCar(); let n = 0, toast = ''; for (; n < 240 && (D.walker.mode !== 'walk' || !toast); n++) { window.__dstep(1); toast = toast || window.__toast(); }
  const i = D.TWR.indexOf('gc8');
  return { ...r, r: +Math.hypot(q.x, q.z).toFixed(2), mode: D.walker.mode, toast, bay: i, f: i >= 0 ? D.TOWER_BAYS[i].f : null, park: window.__G().park.tower[i] };
});
console.log('3', el(), JSON.stringify(park3));
check(park3.ok && park3.bumps === 0 && park3.mode === 'walk' && park3.f === 4 && park3.park === 'gc8' && new RegExp(`停好了：B1 ${park3.bay - 23} 號`).test(park3.toast), `drove forward into the spot, got out: parked 「${park3.toast}」 (saved in spot ${park3.bay + 1})`);
const wall3 = await p.evaluate(() => {
  const D = window.__D(), W = D.walker, y0 = D.GAR.group.position.y, a = Math.PI / 8, s = window.__gw(9 * Math.cos(a), 9 * Math.sin(a)), g = window.__gw(16 * Math.cos(a), 16 * Math.sin(a));
  W.teleport({ x: s.x, z: s.z, heading: 0 }); window.__wstep(5);
  let camR = 0, camY = -9;
  for (let i = 0; i < 300; i++) { const t = W.telemetry(), aa = Math.atan2(-(g.z - t.z), g.x - t.x) - t.camYaw; W.setInput({ x: -Math.sin(aa) * 0.8, y: Math.cos(aa) * 0.8 }); window.__wstep(1); const c = D.dcam.position, q = window.__gl(c.x, c.z); camR = Math.max(camR, Math.hypot(q.x, q.z)); camY = Math.max(camY, c.y - y0); }
  W.setInput(null); window.__wstep(10);
  // 轉過身看牆（鏡頭在人跟牆中間）
  const t = W.telemetry(), q = window.__gl(t.x, t.z);
  return { r: +Math.hypot(q.x, q.z).toFixed(2), y: +(W.character.group.position.y - y0).toFixed(2), camR: +camR.toFixed(2), camY: +camY.toFixed(2), floor: D.GAR.floor };
});
console.log('  wall:', JSON.stringify(wall3));
check(wall3.r < 11.9 && wall3.r > 10.5 && Math.abs(wall3.y + 3.2) < 0.05 && wall3.floor === 4, `walking out toward the concrete wall on B1: stopped at ${wall3.r} m (wall at 12), still on the B1 floor`);
check(wall3.camR < 11.95 && wall3.camY < -0.3, `the walking camera stays inside the wall (${wall3.camR} m) and under the ceiling (${wall3.camY} m)`);
await p.evaluate(() => { const D = window.__D(), W = D.walker, a = Math.PI / 8 + Math.PI, s = window.__gw(5 * Math.cos(a), 5 * Math.sin(a)); W.teleport({ x: s.x, z: s.z, heading: D.garLot().heading - a + Math.PI }); window.__wstep(30); });
const riW = await shot('4-b1-walk');

// ---- 4 走到電梯上 → 按 B2：看得到停在 B2 的 SUPRA → 回 1 樓 ----
const b2 = await p.evaluate(() => {
  const D = window.__D(), W = D.walker, c = window.__gw(0.3, 0); W.teleport({ x: c.x, z: c.z, heading: D.garLot().heading }); window.__wstep(20);
  const who = D.elWho(); document.querySelector('#stage .elpanel .elg button[data-f="5"]').click();
  let n = 0; const ts = new Set(); for (; n < 60 && !D.EL.ride; n++) window.__wstep(1);
  for (n = 0; n < 900 && (D.EL.ride || D.GAR.lift.busy); n++) { window.__wstep(1); ts.add(window.__toast()); }
  for (let i = 0; i < 30; i++) { window.__wstep(1); ts.add(window.__toast()); }
  ts.delete(''); const toast = [...ts].join(' / ');
  const y0 = D.GAR.group.position.y, L = D.LODS.supra?.lod?.car; D.GAR.cull(D.dcam); let vis = !!L, o = L; while (o) { if (!o.visible) vis = false; o = o.parent; }
  return { who, floor: D.GAR.floor, y: +(W.character.group.position.y - y0).toFixed(2), toast, supra: L?.parent?.name, supraVis: vis, vis: D.GAR.floors.map((g) => g.visible) };
});
console.log('4', el(), JSON.stringify(b2));
check(b2.who === 3 && b2.floor === 5 && Math.abs(b2.y + 6.4) < 0.05 && / \/ B2$/.test(b2.toast) && /電梯去 B2/.test(b2.toast), `walked onto the lift, pressed B2: rode down to B2 (${b2.y} m) 「${b2.toast}」`);
check(b2.supra === 'towerBay38' && b2.supraVis && b2.vis[5] && !b2.vis[4], `on B2: the SUPRA parked there is drawn in its spot (${b2.supra}); B1's cars are not`);
await p.evaluate(() => { const D = window.__D(), W = D.walker, a = 0.3, s = window.__gw(-6 * Math.cos(a), -6 * Math.sin(a)); W.teleport({ x: s.x, z: s.z, heading: D.garLot().heading + Math.PI }); window.__wstep(30); });
const riB2 = await shot('5-b2');
const up1 = await p.evaluate(() => {
  const D = window.__D(), W = D.walker, c = window.__gw(0.3, 0); W.teleport({ x: c.x, z: c.z, heading: D.garLot().heading }); window.__wstep(20);
  document.querySelector('#stage .elpanel .elg button[data-f="0"]').click();
  let n = 0; const ts = new Set(); for (; n < 60 && !D.EL.ride; n++) window.__wstep(1);
  for (n = 0; n < 1200 && (D.EL.ride || D.GAR.lift.busy); n++) { window.__wstep(1); ts.add(window.__toast()); }
  for (let i = 0; i < 30; i++) { window.__wstep(1); ts.add(window.__toast()); }
  ts.delete(''); const toast = [...ts].join(' / ');
  return { floor: D.GAR.floor, y: +(W.character.group.position.y - D.GAR.group.position.y).toFixed(2), toast };
});
console.log('  1F:', JSON.stringify(up1));
check(up1.floor === 0 && Math.abs(up1.y) < 0.05 && /電梯去 1 樓⋯ \/ 1 樓$/.test(up1.toast), `pressed 1F: back up in the lobby 「${up1.toast}」`);

// ---- 5 電梯在 B2 的時候站在一樓看下去：洞、地下室（不挖洞＝被草地蓋住）；在塔外面看不到地下室 ----
const look = await p.evaluate(() => {
  const D = window.__D(), G = D.GAR, W = D.walker, s = window.__gw(6, 2); W.teleport({ x: s.x, z: s.z, heading: 0 }); window.__wstep(10);
  G.liftSnap(5, 0); D.liftChanged(); window.__wstep(2);
  const y0 = G.group.position.y, a = window.__gw(4.2, 3.2), b = window.__gw(0, -0.3);
  D.dcam.position.set(a.x, y0 + 3.4, a.z); D.dcam.lookAt(b.x, y0 - 6.4, b.z); D.dcam.updateMatrixWorld();
  return { lf: G.lift.floor };
});
const la = await frame('6-look-down'), lb = await frame('6-look-down-nohole', true);
const dLook = diff(la.px, lb.px);
const st6 = await p.evaluate(() => { const G = window.__D().GAR; return { hole: G.hole.visible, under: G.under.visible, pit: G.scene ? null : G.interior.getObjectByName('towerPit').visible }; });
check(look.lf === 5 && st6.hole && st6.under && !st6.pit && dLook > 12, `from 1F with the lift down at B2: looking down the open shaft into the basement (differs by ${dLook.toFixed(1)} from grass over the hole)`);
const out6 = await p.evaluate(() => {
  const D = window.__D(), G = D.GAR, y0 = G.group.position.y, a = window.__gw(40, 18), b = window.__gw(0, 0);
  D.dcam.position.set(a.x, y0 + 9, a.z); D.dcam.lookAt(b.x, y0 + 2, b.z); D.dcam.updateMatrixWorld();
  G.cull(D.dcam); return { hole: G.hole.visible, under: G.under.visible, pit: G.interior.getObjectByName('towerPit').visible, vis: G.floors.map((g) => g.visible) };
});
await frame('7-outside');
console.log('5', el(), JSON.stringify({ look, st6, out6 }));
check(!out6.hole && !out6.under && out6.pit && out6.vis[1] && out6.vis[3] && !out6.vis[4] && !out6.vis[5], `from outside: no basement drawn (B1, B2 cars hidden), the lift pit is a dark cover again; 2F–4F cars still drawn`);
// 電梯還在 B2、人在一樓：電梯井旁邊「叫電梯」→ 電梯「上來」（地下室的號碼比較大，照高度算）
const call6 = await p.evaluate(() => {
  const D = window.__D(), G = D.GAR, W = D.walker, c = window.__gw(4.6, 0.6); W.teleport({ x: c.x, z: c.z, heading: 0 }); window.__wstep(5);
  const t = W.telemetry(), act = D.elCallAct(t.x, t.z)?.label || null, lf0 = G.lift.floor; D.elCall();
  const ts = new Set([window.__toast()]); for (let n = 0; n < 1500 && (D.EL.ride || G.lift.busy); n++) { window.__wstep(1); ts.add(window.__toast()); }
  ts.delete(''); return { act, lf0, lf: G.lift.floor, floor: G.floor, toast: [...ts].join(' / ') };
});
console.log('  call:', JSON.stringify(call6));
check(call6.act === '叫電梯' && call6.lf0 === 5 && call6.lf === 0 && call6.floor === 0 && /電梯上來了/.test(call6.toast) && !/電梯下來了/.test(call6.toast), `on 1F with the lift at B2: 「叫電梯」 brings it up 「${call6.toast}」`);

console.log('perf', JSON.stringify({ panel1F: ri1, ride: fa.info, b1: riB1, b1walk: riW, b2: riB2, lookDown: la.info }));
check(riB1.calls < 260 && riB2.calls < 260, `draw calls in the basement: B1 ${riB1.calls} (${(riB1.tris / 1e6).toFixed(2)}M tris), B2 ${riB2.calls} (${(riB2.tris / 1e6).toFixed(2)}M tris)`);
check(errs.length === 0, `no page errors (${errs.length})`);
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS OK', el());
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
