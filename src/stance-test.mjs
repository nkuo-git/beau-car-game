// 第 64 批（Nick 2026-11-02「改裝要可以改海拉風」，看了圖 car-game/stance/hellaflush-v1.jpg 說「直接做」）：車身高度多一格「海拉風」
//   車身比「貼地」再低 1.5 公分、輪子外八 9 度、往外推 3.5 公分、輪胎拉窄 0.8 倍（看得到輪框邊）；只是外觀：免費、不影響速度、朋友看得到（輕量車也有）
//   0 每台車的選項（有「貼地」的才有、越野車和摩托車沒有）→ 1 車庫頁按「海拉風」（高度、外八、往外、拉胎；draw calls 一樣）→ 2 存檔、重新載入還在
//   → 3 舊存檔（沒有 stance：照高度那一格；stance 對不上高度：修好）→ 4 輕量車（停車格、朋友的車）也外八、往外 → 5 出門開車：轉彎外八還在、快速道路照常跑 → draw calls
// node stance-test.mjs [prefix]（截圖：<prefix>-*.png；沒給＝../out/stance/st）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = '../out/stance/st'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__G = () => GAME; window.__P = () => PERF;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, trip, tripS, TR, cur, built, walker, PW, S, camera, buildLodCar, LOD_CARS, CARS, STANCE, LODS });'
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
const errs = [], fails = [];
p.on('pageerror', (e) => { errs.push(e.message); console.log('pageerror', e.message); });
p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_CERT|404|GPU stall|AudioContext was not allowed|ScriptProcessorNode|worklet timeout|ERR_TUNNEL|ERR_NAME|ERR_CONNECTION|fonts\.g/.test(m.text())) console.log('console', m.type(), m.text().slice(0, 240)); });
const T0 = Date.now(), el = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`;
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
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
async function gshot(name) { // 車庫頁（它自己的 loop 一直在畫）：等兩格再截圖
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await p.screenshot({ path: `${prefix}-${name}.png` });
  const ri = await p.evaluate(() => window.__rinfo());
  console.log('  shot', `${prefix}-${name}.png`, JSON.stringify(ri), el());
  return ri;
}
// 開局：GC8（一樓電梯上）＋SUPRA（2 樓 1 號）
await p.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  const tower = Array(40).fill(null); tower[0] = 'supra';
  localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 500, owned: ['gc8', 'supra'], parts: {}, tyres: {}, wins: {}, cars: {}, park: { mid: 'gc8', tower } }));
});
// 車庫頁那台車的輪子：每個輪子 [外八（度，上面往裡＝正）、離中線多遠、輪胎寬的倍數]
await p.addInitScript(() => {
  window.__hubs = (S) => S.wheels.map((w) => { const h = w.parent, s = Math.sign(h.position.z), t = w.getObjectByName('tire'); return [+((s * -h.rotation.x * 180) / Math.PI).toFixed(2), +Math.abs(h.position.z).toFixed(4), t ? +t.scale.z.toFixed(3) : null]; });
  window.__seg = (key, label) => { const b = [...document.querySelectorAll(`.seg[data-opt="${key}"] button`)].find((x) => x.textContent === label); if (b) b.click(); return !!b; };
  window.__settle = () => new Promise((r) => { const t0 = performance.now(); const f = () => { const D = window.__D(); if (Math.abs(D.S.body.position.y - +D.CARS[D.cur].state.height) < 3e-4 || performance.now() - t0 > 120000) r(); else requestAnimationFrame(f); }; f(); });
});

await p.goto(base, { waitUntil: 'domcontentloaded' });
await ready();
await p.waitForFunction(() => window.__D().built.gc8?.car, null, { timeout: 120000 });
console.log('0', el(), 'page ready');

// ---- 0 每台車的選項：有「貼地」的車多一格「海拉風」（比貼地低 1.5 公分）；越野車、怪獸卡車、摩托車沒有 ----
const opts = await p.evaluate(() => {
  const D = window.__D(), P = window.__P(), out = { has: [], not: [], bad: [] };
  for (const [k, C] of Object.entries(D.CARS)) {
    const H = C.opts.height || [], low = H.find((o) => o[1] === '貼地'), hf = H.find((o) => o[1] === '海拉風');
    (hf ? out.has : out.not).push(k);
    if (!!low !== !!hf || (hf && Math.abs(+hf[0] - (+low[0] - D.STANCE.drop)) > 1e-6) || (hf && H[H.length - 1] !== hf) || (hf && (P[k].offroad || P[k].lean))) out.bad.push(k);
  }
  out.seg = [...document.querySelectorAll('.seg[data-opt="height"] button')].map((b) => b.textContent);
  out.state = D.CARS.gc8.state.stance;
  return out;
});
console.log('  options:', JSON.stringify(opts));
check(!opts.bad.length && opts.has.length >= 17 && ['jp4', 'k2', 'p8', 'z2', 'monster', 'n4'].every((k) => opts.not.includes(k)), `every car with 「貼地」 gets 「海拉風」 last, 1.5 cm lower (${opts.has.length} cars); the off-road cars, monster truck and N4 don't (${opts.not.join(' ')})`);
check(opts.seg.join(',') === '原廠,降低,貼地,海拉風' && opts.state === 'off', `GC8 車身高度 shows 原廠 降低 貼地 海拉風; a new save starts without it`);

// ---- 1 車庫頁：貼地 → 海拉風 ----
await p.evaluate(() => window.__seg('height', '貼地')); await p.evaluate(() => window.__settle());
const low = await p.evaluate(() => { const D = window.__D(); return { y: +D.S.body.position.y.toFixed(4), hubs: window.__hubs(D.S), st: D.CARS.gc8.state.stance }; });
const riLow = await gshot('1-low');
await p.evaluate(() => window.__seg('height', '海拉風')); await p.evaluate(() => window.__settle());
const hf = await p.evaluate(() => { const D = window.__D(), st = D.CARS.gc8.state, s = D.S.spec.wheels; return { y: +D.S.body.position.y.toFixed(4), hubs: window.__hubs(D.S), st: st.stance, h: st.height, track: [s.trackF, s.trackF, s.trackR, s.trackR], pressed: document.querySelector('.seg[data-opt="height"] button[aria-pressed="true"]')?.textContent, money: window.__G().money }; });
const riHf = await gshot('1-hellaflush');
console.log('1', el(), JSON.stringify({ low, hf }));
check(low.st === 'off' && low.hubs.every((h) => Math.abs(h[0]) < 0.01 && h[2] === 1), `貼地: wheels straight, normal tyres (${JSON.stringify(low.hubs[0])})`);
check(hf.st === 'on' && hf.h === '-0.065' && hf.pressed === '海拉風' && Math.abs(hf.y - (low.y - 0.015)) < 0.001, `海拉風: the body sits 1.5 cm lower than 貼地 (${low.y} → ${hf.y} m) and the button stays pressed`);
check(hf.hubs.every((h, i) => Math.abs(h[0] - 9) < 0.01 && Math.abs(h[1] - (hf.track[i] + 0.035)) < 1e-3 && h[2] === 0.8), `all four wheels lean in at the top 9° (camber), pushed out 3.5 cm, tyres stretched to 0.8 (${JSON.stringify(hf.hubs)})`);
check(hf.money === 500 && riHf.calls === riLow.calls, `free (money still ${hf.money}), and no extra draw calls (${riLow.calls} → ${riHf.calls})`);

// ---- 2 存檔、重新載入：還是海拉風 ----
const saved = await p.evaluate(() => new Promise((r) => setTimeout(() => r(JSON.parse(localStorage.getItem('carid.tune')).cars.gc8), 600)));
await p.reload({ waitUntil: 'domcontentloaded' }); await ready();
await p.waitForFunction(() => window.__D().built.gc8?.car, null, { timeout: 120000 }); await p.evaluate(() => window.__settle());
const re = await p.evaluate(() => { const D = window.__D(); return { st: D.CARS.gc8.state.stance, h: D.CARS.gc8.state.height, y: +D.S.body.position.y.toFixed(4), hubs: window.__hubs(D.S), pressed: document.querySelector('.seg[data-opt="height"] button[aria-pressed="true"]')?.textContent }; });
console.log('2', el(), JSON.stringify({ saved: { h: saved.height, st: saved.stance }, re }));
check(saved.stance === 'on' && saved.height === '-0.065' && re.st === 'on' && re.pressed === '海拉風' && re.hubs.every((h) => Math.abs(h[0] - 9) < 0.01 && h[2] === 0.8) && Math.abs(re.y + 0.065) < 0.001, `saved (stance on, height -0.065); after reloading the GC8 is still 海拉風 with the wheels cambered`);

// ---- 3 舊存檔：沒有 stance 但高度是海拉風那一格 → 海拉風；stance on 但高度是原廠 → 不是；回到 貼地 → 輪子正回來 ----
await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('carid.tune')); d.cars.gc8 = { ...d.cars.gc8, height: '0', stance: 'on' }; d.cars.supra = { height: '-0.037' }; localStorage.setItem('carid.tune', JSON.stringify(d)); });
await p.reload({ waitUntil: 'domcontentloaded' }); await ready();
await p.waitForFunction(() => window.__D().built.gc8?.car, null, { timeout: 120000 }); await p.evaluate(() => window.__settle());
const old = await p.evaluate(() => { const D = window.__D(); return { gc8: D.CARS.gc8.state.stance, gc8h: D.CARS.gc8.state.height, supra: D.CARS.supra.state.stance, supraH: D.CARS.supra.state.height, hubs: window.__hubs(D.S) }; });
console.log('3', el(), JSON.stringify(old));
check(old.gc8 === 'off' && old.gc8h === '0' && old.hubs.every((h) => Math.abs(h[0]) < 0.01 && h[2] === 1), `a save saying stance on but height 原廠 is repaired: wheels straight`);
check(old.supra === 'on' && old.supraH === '-0.037', `an old save without stance whose height is the 海拉風 step (SUPRA -0.037) loads as 海拉風`);
await p.evaluate(() => window.__seg('height', '海拉風')); await p.evaluate(() => window.__settle());
await p.evaluate(() => window.__seg('height', '貼地')); await p.evaluate(() => window.__settle());
const back = await p.evaluate(() => { const D = window.__D(); return { st: D.CARS.gc8.state.stance, hubs: window.__hubs(D.S) }; });
check(back.st === 'off' && back.hubs.every((h, i) => Math.abs(h[0]) < 0.01 && h[2] === 1 && Math.abs(h[1] - low.hubs[i][1]) < 1e-4), `back to 貼地: wheels straight and back in place`);
await p.evaluate(() => window.__seg('height', '海拉風')); await p.evaluate(() => window.__settle());

// ---- 4 輕量車（停車格、車行、朋友的車）：外八、往外推、拉胎也有；三角形、draw calls 一樣 ----
const lod = await p.evaluate(async () => {
  const D = window.__D(), sc = await D.LOD_CARS.gc8.load();
  const meas = (l) => {
    const m = l.car.getObjectByName('lod-wheels'), r = l.car.getObjectByName('lod-rims'); l.car.updateMatrixWorld(true);
    const box = (mm, yt, yb) => { const a = mm.geometry.attributes.position, v = new D.camera.position.constructor(); let zt = -1e9, zb = -1e9, zmax = -1e9; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i); if (v.z < 0.3) continue; zmax = Math.max(zmax, v.z); if (v.y > yt) zt = Math.max(zt, v.z); if (v.y < yb) zb = Math.max(zb, v.z); } return { zmax: +zmax.toFixed(3), top: +zt.toFixed(3), bot: +zb.toFixed(3) }; }; // 右邊的輪子：上面那一段、下面那一段最外面的 z
    return { w: box(m, 0.6, 0.05), r: box(r, 0.5, 0.15), tris: l.tris, draws: l.draws }; // 輪胎半徑 0.32、輪框 0.23（GC8）
  };
  const off = D.buildLodCar('gc8', sc, { ...D.CARS.gc8.state, stance: 'off' }), a = meas(off);
  off.setLook({ stance: 'on' }); const b = meas(off);
  off.setLook({ stance: 'off' }); const c = meas(off); off.dispose();
  return { off: a, on: b, back: c };
});
console.log('4', el(), 'LOD:', JSON.stringify(lod));
const tilt = (k) => +((lod.on[k].bot - lod.off[k].bot) - (lod.on[k].top - lod.off[k].top)).toFixed(3), push = +((lod.on.r.bot - lod.off.r.bot + lod.on.r.top - lod.off.r.top) / 2).toFixed(3); // 往外推、拉胎上下一樣（相減就沒了），剩外八：下面往外、上面往裡
check(tilt('w') > 0.05 && tilt('r') > 0.05 && Math.abs(push - 0.035) < 0.01, `light-weight car: tyres and rims lean in at the top (bottom moves out more than the top: ${tilt('w')} / ${tilt('r')} m) and the rims are pushed out ${push} m`);
check(lod.on.tris === lod.off.tris && lod.on.draws === lod.off.draws && JSON.stringify(lod.back) === JSON.stringify(lod.off), `same triangles (${lod.on.tris}) and draw calls (${lod.on.draws}); switching back gives exactly the straight wheels again`);

// ---- 5 出門開車：外八還在、轉彎也在（drive.js 只改轉向）、快速道路照常跑 ----
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk');
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; window.__npcPause(true); });
const out = await p.evaluate(() => {
  const W = window.__D().walker; let ok = false, k = 0;
  for (; k < 600 && !ok; k++) { ok = W.getIn(W.cars.find((c) => c.key === 'gc8')); if (!ok) window.__wstep(1); }
  let n = 0; for (; n < 1200 && !(window.__D().drv && W.mode === 'off'); n++) window.__wstep(1);
  const D = window.__D(); D.GAR.door.open(0.2); window.__dstep(40);
  return { ok, mode: W.mode, same: D.tripS === D.built.gc8, y: +D.tripS.body.position.y.toFixed(4), hubs: window.__hubs(D.tripS) };
});
console.log('5', el(), JSON.stringify(out));
check(out.ok && out.mode === 'off' && out.hubs.every((h) => Math.abs(h[0] - 9) < 0.01 && h[2] === 0.8), `in the GC8 on the lobby lift: still cambered, stretched tyres`);
const riOn = await shot('5-on');
await p.evaluate(() => { window.__hwRun = () => {
  const D = window.__D(), d = D.drv, H = D.VIL.places.highway, L = D.VIL.highway.out;
  d.teleport(H.spawn); window.__dstep(30);
  let k = 0, vmax = 0, air = 0; const b0 = d.telemetry().bumps, l0 = d.telemetry().lands;
  for (let i = 0; i < 60 * 15; i++) {
    const t = d.telemetry();
    let bk = k, bd = 1e9; for (let j = k; j < Math.min(L.length, k + 8); j++) { const e = Math.hypot(L[j][0] - t.x, L[j][1] - t.z); if (e < bd) { bd = e; bk = j; } } k = bk;
    const g = L[Math.min(L.length - 1, k + 2)], a = Math.atan2(-(g[1] - t.z), g[0] - t.x) - t.heading, aa = Math.atan2(Math.sin(a), Math.cos(a));
    d.setInput({ throttle: 1, brake: 0, steer: Math.max(-1, Math.min(1, -2 * aa)) }); window.__dstep(1);
    const t2 = d.telemetry(); vmax = Math.max(vmax, t2.kmh); if (t2.air) air++;
  }
  // 打方向：前輪轉向（rotation.y）＋外八（rotation.x）都在
  for (let i = 0; i < 30; i++) { d.setInput({ throttle: 0.3, brake: 0, steer: 1 }); window.__dstep(1); }
  const hubs = window.__hubs(D.tripS), yaw = D.tripS.wheels.slice(0, 2).map((w) => +w.parent.rotation.y.toFixed(3));
  d.setInput(null); const t = d.telemetry();
  return { vmax: Math.round(vmax), air, bumps: t.bumps - b0, lands: t.lands - l0, hubs, yaw };
}; });
const hw = await p.evaluate(() => window.__hwRun());
// 一樣的路、一樣的開法，輪子換回正的（車身照舊）：速度、撞到幾次要一樣（只是外觀）
const hw0 = await p.evaluate(() => { const S = window.__D().tripS; S.setStance(false); const r = window.__hwRun(); S.setStance(true); return r; });
console.log('  highway:', JSON.stringify(hw), 'straight wheels:', JSON.stringify(hw0));
check(hw.vmax > 180 && hw.air === 0 && hw.lands === 0 && hw.vmax === hw0.vmax && hw.bumps === hw0.bumps, `flat out on the expressway for 15 s: ${hw.vmax} km/h, never in the air; the same run with straight wheels: ${hw0.vmax} km/h, bumps ${hw.bumps} / ${hw0.bumps} (looks only, no speed change)`);
check(hw.hubs.every((h) => Math.abs(h[0] - 9) < 0.01) && hw.yaw.every((y, i) => Math.abs(y - (i === 0 ? Math.PI : 0)) > 0.05), `steering: the front wheels turn (${hw.yaw}) and keep their camber`);
const riHw = await shot('5-highway');

console.log('draw calls:', JSON.stringify({ low: riLow, hellaflush: riHf, on: riOn, highway: riHw }));
check(!errs.length, `no page errors (${errs.length})`);
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS OK', el());
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
