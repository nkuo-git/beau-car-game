// 第 30 批：一天的時間（look.js）：白天／傍晚／晚上的太陽、天空光、霧、反射的圖；路燈（最近 4 支）、自己的車的大燈、招牌、完整的車和輕量車的車燈；
// 最真實的濕路倒影（漂亮沒有）；換回順什麼都關掉；照時鐘；白天／晚上的 draw calls；截圖
// 用法：node night-test.mjs ../out/night/nt   （先 node build-art.mjs --yaris）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const prefix = process.argv[2] || '../out/night/nt';
fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__THREE = THREE; window.__PN = PAINT_NIGHT; window.__pxLow = () => pxLow; window.__pxHigh = () => pxHigh;'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, tripS, TR, walker, renderer, LOOK, NPC, S, AMB, AMB_S, MUS, engineAudio, leaveCar, police, buildLodCar });'
  + ' window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };';
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') {
    let html = fs.readFileSync(path.join(dir, 'art/garage.html'), 'utf8').replaceAll('https://cdn.jsdelivr.net/npm/three@0.186.1/', '/three/');
    const a = 'const RACE = { on: false, frame: raceFrame };', d1 = '  driveStep(dt);\n  if (!DRIVE.on) return;', d2 = '  renderer.render(TR.scene, dcam);\n}';
    for (const x of [a, d1, d2]) if (html.split(x).length !== 2) throw new Error('hook anchor missing: ' + x);
    html = html.replace(a, `${a} ${hook}`).replace(d1, '  if (!window.__hold) driveStep(dt);\n  if (!DRIVE.on) return;').replace(d2, '  if (!window.__noDraw) renderer.render(TR.scene, dcam);\n}')
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
const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
p.setDefaultTimeout(600000);
const T0 = Date.now(), el = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`;
const errs = [];
p.on('pageerror', (e) => { errs.push(e.message); console.log('pageerror', e.message); });
p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/ERR_CERT|404|GPU stall|AudioContext|ERR_TUNNEL|ERR_NAME|ERR_CONNECTION|fonts\.g|Failed to load resource/.test(t)) { errs.push(t); console.log('console error', t.slice(0, 300)); } else if (/THREE\./.test(t) && !/already non-indexed|KHR_parallel/.test(t)) console.log('console', m.type(), t.slice(0, 300)); });
let ok = 0, bad = 0;
const check = (c, msg) => { if (c) ok++; else bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${msg}`); };
const save = (n, u) => fs.writeFileSync(`${prefix}-${n}.jpg`, Buffer.from(u.split(',')[1], 'base64'));
const SAVE = { v: 2, cur: 'gtr', scene: 'room', money: 500, owned: ['gc8', 'gtr'], parts: {}, tyres: {}, wins: {}, cars: {}, park: { mid: 'gtr', tower: Array(40).fill(null) } };
await p.addInitScript((s) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('carid.tune', s); }, JSON.stringify(SAVE));
const ready = async () => { await p.waitForFunction(() => document.getElementById('status').hidden, null, { timeout: 300000 }); };
const goOut = async () => {
  await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
  await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk');
  return p.evaluate(() => { const W = window.__D().walker; let ok = false; for (let k = 0; k < 600 && !ok; k++) { ok = W.getIn((W.cars.find((c) => c.key === 'gtr') || W.cars[0])); if (!ok) window.__dstep(1); } for (let i = 0; i < 200 && !(window.__D().drv && window.__D().walker.mode === 'off'); i++) window.__dstep(1); return { ok, mode: window.__D().walker.mode }; });
};
const helpers = () => p.evaluate(() => {
  const D = window.__D(), R = D.renderer, THREE = window.__THREE;
  window.__view = (W = 960, H = 576, shot = true) => {
    const c = D.dcam, sz = R.getSize(new THREE.Vector2()), pr = R.getPixelRatio(), asp = c.aspect;
    R.setPixelRatio(1); R.setSize(W, H, false); c.aspect = W / H; c.updateProjectionMatrix();
    D.GAR.cull(c); R.setRenderTarget(null); R.render(D.TR.scene, c);
    const info = { calls: R.info.render.calls, tris: R.info.render.triangles, wet: D.LOOK.stats.wetCalls || 0 }, url = shot ? R.domElement.toDataURL('image/jpeg', 0.85) : null;
    R.setSize(sz.x, sz.y, false); R.setPixelRatio(pr); c.aspect = asp; c.updateProjectionMatrix(); return { url, info };
  };
  window.__place = (x, z, h, n = 90) => { const d = D.drv; d.teleport({ x, z, heading: h }); d.setInput({ throttle: 0, brake: 1, steer: 0 }); window.__dstep(n); d.setInput(null); };
  window.__go = (w, n = 2) => { if (Array.isArray(w)) window.__place(w[0], w[1], w[2]); else if (w) { const sp = D.VIL.places[w].spawn; window.__place(sp.x, sp.z, sp.heading); } for (let i = 0; i < n; i++) window.__view(320, 192, false); return window.__view(); };
  window.__lampDrive = (frames = 100) => { const sp = D.VIL.places.highway.spawn, d = D.drv; window.__place(sp.x, sp.z, sp.heading, 30); window.__view(320, 192, false); window.__view(320, 192, false); // 第 44 批：沿著快速道路慢慢開，一格一格記每一支路燈的亮度
    const lit = () => { const cur = new Map(); D.TR.scene.traverse((o) => { if (o.name === 'lk-lamp' && o.intensity > 0) { const key = Math.round(o.position.x) + ',' + Math.round(o.position.z); cur.set(key, (cur.get(key) || 0) + o.intensity); } }); return cur; };
    const prev = lit(); let maxRise = 0, maxRiseAt = null, entered = 0, frames2 = 0, dtMax = 0, last = performance.now(); const seen = new Map(), t0 = d.telemetry(); let vmax = 0; for (const [key, I] of prev) seen.set(key, { first: 0, startI: I, max: I });
    for (let f = 0; f < frames; f++) { const kmh = d.telemetry().kmh; vmax = Math.max(vmax, kmh); d.setInput({ throttle: kmh < 70 ? 0.8 : 0, brake: 0, steer: 0 }); window.__dstep(4); const a = performance.now(); dtMax = Math.max(dtMax, Math.min(0.1, (a - last) / 1000)); last = a; window.__view(320, 192, false); frames2++;
      const cur = lit();
      for (const [key, I] of cur) { const r = I - (prev.get(key) || 0); if (r > maxRise) { maxRise = r; maxRiseAt = key + '@' + f; } const s = seen.get(key) || { first: f + 1, startI: I, max: 0 }; s.max = Math.max(s.max, I); seen.set(key, s); }
      prev.clear(); for (const [key, I] of cur) prev.set(key, I); }
    for (const s of seen.values()) if (s.first > 0 && s.startI < 60 && s.max > 300) entered++;
    const t1 = d.telemetry(); d.setInput({ throttle: 0, brake: 1, steer: 0 }); window.__dstep(60); d.setInput(null);
    const gl = D.renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); // 等軟體 GPU 把排隊的 100 格畫完（不然後面換視窗大小要等十幾秒才有下一格）
    return { maxRise: +maxRise.toFixed(1), maxRiseAt, entered, lamps: seen.size, frames: frames2, dist: +Math.hypot(t1.x - t0.x, t1.z - t0.z).toFixed(0), kmh: Math.round(vmax), dtMax: +dtMax.toFixed(3) }; };
  window.__state = () => { const sc = D.TR.scene; let dl = null, hemi = null; const pl = [], sp = []; let signM = null; const car = D.tripS?.car;
    sc.traverse((o) => { if (o.isDirectionalLight && !dl) dl = o; if (o.isHemisphereLight && !hemi) hemi = o; if (o.name === 'lk-lamp') pl.push(o); if (o.name === 'lk-head') sp.push(o);
      if (!signM && o.isMesh && o.material && o.material.emissiveMap && o.material.emissiveMap === o.material.map && /sign/.test(o.name)) signM = o.material; });
    const cp = D.dcam.position, cx = car ? new THREE.Vector3().setFromMatrixPosition(car.matrixWorld) : null;
    const tr = D.NPC?.traffic?.cars?.find((c) => c.lod && c.lod._E) || null; let lodE = 0; if (tr) for (const v of tr.lod._E) lodE += v;
    const NS = D.LOOK._ns ? D.LOOK._ns() : null, TC = (D.NPC?.traffic?.cars || []).filter((c) => c.active && c.kind === 'car' && !c.crushed), PC = (D.police?.npcCars || []).filter((c) => c.x < 1e5); // 第 32 批：大燈照路的光斑：鏡頭 110 公尺內的車（路上的、警車）
    const near = [...TC, ...PC].map((c) => ({ c, d: Math.hypot(c.x - cp.x, c.z - cp.z) })).filter((o) => o.d < 110).sort((a, b) => a.d - b.d); let pool0 = null;
    if (NS && NS.pool.count && near.length) { const m = new THREE.Matrix4(), v = new THREE.Vector3(); NS.pool.getMatrixAt(0, m); v.setFromMatrixPosition(m); const c = near[0].c, hx = c.hx || 2.2; pool0 = { d: +Math.hypot(v.x - (c.x + Math.cos(c.heading) * (hx + 0.3)), v.z - (c.z - Math.sin(c.heading) * (hx + 0.3))).toFixed(2), y: +v.y.toFixed(2) }; }
    const ns = NS ? { stars: NS.stars.geometry.attributes.position.count, starsOp: +NS.stars.material.opacity.toFixed(2), moonOp: +NS.moon.material.opacity.toFixed(2), moonY: +new THREE.Vector3().setFromMatrixPosition(NS.moon.matrixWorld).sub(cp).normalize().y.toFixed(2), winN: NS.lit, winOp: +NS.win.material.opacity.toFixed(2), winVis: NS.win.visible, pools: NS.pool.count, beamVis: NS.beam.visible, beamOp: +NS.beam.material.opacity.toFixed(2), beamL: NS.beam.geometry.parameters.width, beamW: NS.beam.geometry.parameters.height, beamD: cx ? +NS.beam.position.distanceTo(cx).toFixed(2) : null, beamY: +NS.beam.position.y.toFixed(2), poolOp: +NS.pool.material.opacity.toFixed(3), poolVis: NS.pool.visible, pol: NS.pol ? +NS.pol.intensity.toFixed(1) : null, polC: NS.pol ? NS.pol.color.getHexString() : null, polY: NS.pol ? +NS.pol.position.y.toFixed(2) : null } : null;
    return { info: D.LOOK.info(), hour: +D.LOOK.hour.toFixed(2), sun: +D.LOOK.sun.toFixed(1), night: +D.LOOK.night.toFixed(2), exp: R.toneMappingExposure, ns, nearCars: Math.min(12, near.length), pool0,
      dl: { I: +dl.intensity.toFixed(3), c: dl.color.getHexString(), y: +dl.position.y.toFixed(0), dirY: +(dl.position.y - dl.target.position.y).toFixed(0) }, hemi: { I: +hemi.intensity.toFixed(3), c: hemi.color.getHexString() }, fog: sc.fog ? sc.fog.color.getHexString() : null, envI: +sc.environmentIntensity.toFixed(3),
      pl: pl.map((l) => ({ I: +l.intensity.toFixed(1), d: +Math.hypot(l.position.x - cp.x, l.position.z - cp.z).toFixed(0), y: +l.position.y.toFixed(1) })), sp: sp.map((l) => ({ I: +l.intensity.toFixed(0), d: cx ? +l.position.distanceTo(cx).toFixed(2) : null, y: +l.position.y.toFixed(2), decay: l.decay, distance: l.distance, angle: +l.angle.toFixed(2), aim: +l.position.distanceTo(l.target.position).toFixed(1) })),
      paintN: window.__PN.value, sign: signM ? +signM.emissiveIntensity.toFixed(2) : null, lodE: +lodE.toFixed(2), lodK: D.buildLodCar.nightK(), lodCars: D.NPC?.traffic?.cars?.length || 0, wet: D.LOOK.stats.wetCalls || 0 }; };
});

await p.goto(base, { waitUntil: 'domcontentloaded' });
await ready();
// ---- 0 第 42 批（Nick「在這個頁面就要可以改畫質」）：車庫頁「出門」下面那一格：還沒出門就能選（記下來，出門照這個做）----
const rowSt = () => p.evaluate(() => { const r = document.getElementById('lookRow'), q = (s) => [...document.querySelectorAll(s + ' button')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.l).join(',');
  let v = null; try { v = localStorage.getItem('carid.look'); } catch {} return { vis: !!r && r.offsetParent !== null && r.getBoundingClientRect().height > 40, row: q('#lookRow'), pop: q('#lookPop'), tip: document.getElementById('lookTip').textContent, v, toast: document.getElementById('gtoast').textContent, look: !!window.__D().LOOK }; });
const r0 = await rowSt();
await p.evaluate(() => document.querySelector('#lookRow button[data-l="1"]').click());
const r1 = await rowSt();
await p.evaluate(() => document.querySelector('#lookRow button[data-l="0"]').click());
const r2 = await rowSt();
console.log('0 lookRow', JSON.stringify({ r0, r1, r2 }));
check(r0.vis && !r0.look && r0.row === '0' && r0.pop === '0' && r0.v === null && /最順/.test(r0.tip) && r1.row === '1' && r1.pop === '1' && r1.v === '1' && /高/.test(r1.toast) && /漂亮/.test(r1.tip) && r2.row === '0' && r2.v === '0',
  `第 42 批: the garage page shows 畫質 超高／高／普通 before going out (never chosen on a software GPU = 普通 ${r0.row}); tapping 高 saves ${r1.v} and lights both rows; back to 普通 saves ${r2.v}`);
const g1 = await goOut();
const r3 = await rowSt();
check(!r3.vis && r3.look && r3.row === '0' && r3.pop === '0', `第 42 批: the garage-page 畫質 row is hidden while out, the trip used the saved choice (LOOK built, level row ${r3.row})`);
console.log('out', el(), JSON.stringify(g1));
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await helpers();
// ---- 1 順：時間照時鐘，但什麼都不動 ----
const s0 = await p.evaluate(() => { const D = window.__D(); const h0 = D.LOOK.hour, h1 = (() => { const u = (((Date.now() / 60000) % 12) / 12) * 24, h = u - 0.65 * (6 / Math.PI) * Math.sin((Math.PI * (u - 6)) / 6); return ((h % 24) + 24) % 24; })(); return { lv: D.LOOK.level, hour: h0, clock: h1, st: window.__state() }; });
console.log('1 順', JSON.stringify(s0));
check(s0.lv === 0 && s0.hour >= 0 && s0.hour < 24 && Math.abs(s0.hour - s0.clock) < 0.05 && s0.st.pl.length === 0 && s0.st.sp.length === 0 && s0.st.paintN === 0 && s0.st.dl.I === 1.4,
  `順: clock hour ${s0.hour.toFixed(2)} (a 12-minute day, 第 34 批; 第 40 批: slower round sunrise/sunset), nothing changes (no lamps, sun 1.4, paint night 0)`);
await p.evaluate(() => window.__D().LOOK.setHour(22));
const s0n = await p.evaluate(() => window.__state());
check(s0n.hour === 22 && s0n.dl.I === 1.4 && s0n.pl.length === 0 && s0n.paintN === 0 && s0n.lodE === 0, `順 at 22:00: still daytime look (sun 1.4, no lamps, LOD car lamps off)`);

// ---- 2 最真實：白天 13:00 ----
await p.evaluate(() => window.__D().LOOK.setHour(13));
await p.evaluate(() => window.__D().LOOK.set(2));
await p.waitForFunction(() => window.__D().LOOK.level === 2 && !window.__D().LOOK.busy, null, { timeout: 180000 });
const PLACES = ['dealer', 'shop', 'highway'];
const perf = {};
const at = async (tag, hour) => {
  await p.evaluate((h) => window.__D().LOOK.setHour(h), hour);
  const out = {};
  for (const w of PLACES) { const v = await p.evaluate((w) => window.__go(w), w); save(`${tag}-${w}`, v.url); out[w] = v.info; }
  const st = await p.evaluate(() => window.__state());
  perf[tag] = out; console.log(tag, el(), JSON.stringify(out), JSON.stringify(st));
  return st;
};
const d = await at('13', 13);
check(d.sun > 45 && d.night === 0 && d.dl.I === 4.6 && d.dl.c === 'fff0dc' && d.dl.dirY > 200 && d.pl.length === 4 && d.pl.every((l) => l.I === 0) && d.sp.length === 2 && d.sp.every((l) => l.I === 0) && d.paintN === 0 && d.wet === 0 && d.info.band === 'b10' && d.fog === 'c3ccd3',
  `13:00 最真實: sun ${d.sun}° (4.6, white), 4 street lamps + 2 headlights in the scene but off, cars' lamps off, no wet reflection, fog day colour`);
check(d.ns && !d.ns.beamVis && d.ns.stars === 900 && d.ns.starsOp === 0 && d.ns.moonOp === 0 && d.ns.winN > 30 && d.ns.winOp === 0 && !d.ns.winVis && d.ns.pools === 0 && !d.ns.poolVis && d.ns.pol === 0, `13:00: stars (${d.ns && d.ns.stars}), moon, ${d.ns && d.ns.winN} lit windows/shop fronts, headlight pools and the police light are in the scene but all off by day`);
// ---- 3 傍晚 17:45 ----
const k = await at('17-45', 17.75);
check(k.sun > 0 && k.sun < 10 && k.night > 0.3 && k.night < 1 && k.dl.I < 2 && k.dl.I > 1 && k.dl.c !== 'fff0dc' && k.pl.some((l) => l.I > 0) && k.sp.every((l) => l.I > 0 && l.I < 150) && k.paintN > 0.3 && k.paintN < 1 && k.fog !== 'c3ccd3' && k.info.band === 'b0' && k.envI < 0.45,
  `17:45: low orange sun ${k.sun}° weakened to ${k.dl.I} (#${k.dl.c}, env ${k.envI}), lamps coming on (${k.night}), warm fog #${k.fog}, lowest reflection band`);
check(k.ns.starsOp === 0 && k.ns.moonOp === 0 && k.ns.winVis && k.ns.winOp > 0.3 && k.ns.winOp < 1 && Math.abs(k.ns.winOp - k.night) < 0.02, `17:45: windows coming on with the lamps (${k.ns.winOp}), no stars or moon yet`);
// ---- 4 晚上 22:00 ----
const n = await at('22', 22);
const near = n.pl.filter((l) => l.I > 0);
// 第 39 批（Nick「做1234 只做在最真實」）：最真實畫兩倍再縮小、自己的車反射旁邊（方塊相機）
const rx = await p.evaluate(() => { window.__dstep(1); const D = window.__D(), R = D.renderer, v = new window.__THREE.Vector2(); R.getDrawingBufferSize(v); return { pxHigh: window.__pxHigh(), px: v.x * v.y, css: innerWidth * innerHeight, info: D.LOOK.info() }; });
check(rx.pxHigh && rx.px > rx.css * 1.9 && rx.info.cube > 0 && rx.info.carCube && rx.info.cubeCalls > 0, `第 39 批 最真實: drawn at ${(rx.px / rx.css).toFixed(1)}× the screen pixels (${rx.px}), own car reflects a live cube of the surroundings (${rx.info.cube} cycles, ${rx.info.cubeCalls} calls per face pair)`);
// 第 41 批（Nick「最真實好像超過我手機能耐了」）：手機（LOOK.max false）的最真實＝第 39 批以前：影子 2048／60 公尺、不畫兩倍、沒有方塊反射、沒有牆的材質
const ph = await p.evaluate(() => { const D = window.__D(), L = D.LOOK, R = D.renderer, v = new window.__THREE.Vector2(), max0 = L.max; L.setMax(false); window.__dstep(1); const c0 = L.info().cube; for (let i = 0; i < 12; i++) { window.__dstep(1); R.render(D.TR.scene, D.dcam); } R.getDrawingBufferSize(v);
  const i1 = L.info(), out = { max0, pxHigh: window.__pxHigh(), px: v.x * v.y, css: innerWidth * innerHeight, sh: i1.sh, shR: i1.shR, shRad: i1.shRad, cubeGrow: i1.cube - c0, carCube: i1.carCube };
  L.setMax(true); window.__dstep(1); R.render(D.TR.scene, D.dcam); const i2 = L.info(); out.back = { sh: i2.sh, pxHigh: window.__pxHigh() }; return out; });
check(ph.max0 === true && !ph.pxHigh && ph.px <= ph.css * 1.01 && ph.sh === 2048 && ph.shR === 60 && ph.shRad === 1 && ph.cubeGrow === 0 && !ph.carCube && ph.back.sh === 4096 && ph.back.pxHigh, `第 41 批: phone 最真實 (max off) = the pre-batch-39 one: shadow ${ph.sh} / ${ph.shR} m / radius ${ph.shRad}, ${(ph.px / ph.css).toFixed(2)}× pixels, no live cube (+${ph.cubeGrow} cycles), car uses the sky reflection; back on: ${ph.back.sh}, 2× again`);
check(n.sun < -20 && n.night === 1 && n.dl.I === 0.8 && n.dl.c === '9fb4d8' && n.dl.dirY > 150 && n.hemi.c === '46536f' && n.hemi.I === 0.95 && n.fog === '161c29' && n.info.band === 'n' && n.exp === 1,
  `22:00: sun ${n.sun}° (below), moon light 0.8 #${n.dl.c} with shadows, night hemi ${n.hemi.I}/fog (第 37 批: brighter night), night reflection map`);
check(near.length >= 2 && near.every((l) => l.I > 0 && l.I <= 396 && l.d < 90 && l.y > 5) && near.some((l) => l.I === 396 && l.y > 10) && near.filter((l) => l.d > 55).every((l) => l.I < 396) && n.info.lamps > 100,
  `22:00 highway: ${near.length} nearest street lamps lit (${near.map((l) => l.I + '@' + l.d + 'm').join(', ')}: 180 × 2.2 = 396 on the 11 m highway heads so the road is lit like the village, fading past 50 m so a swap never pops) of ${n.info.lamps} lamp heads (poles, highway, parking)`);
check(n.ns.beamVis && n.ns.beamOp === 0.8 && n.ns.beamL === 150 && n.ns.beamW === 40 && n.ns.beamD > 1.5 && n.ns.beamD < 3.5 && n.ns.beamY > -0.2 && n.ns.beamY < 0.4, `22:00: the own car's headlight beam patch lies on the road from its nose (${n.ns.beamD} m from the centre, y ${n.ns.beamY}), opacity ${n.ns.beamOp}, ${n.ns.beamL} m long × ${n.ns.beamW} m wide (第 34 批: lights the road ahead; 第 37 批: 0–100 m, 30 m wide; 第 44 批: 0–150 m, 40 m wide; off by day)`);
check(n.ns.starsOp === 1 && n.ns.moonOp === 1 && n.ns.moonY > 0.6 && n.ns.moonY < 0.85 && n.ns.winVis && n.ns.winOp === 1, `22:00: stars and the moon disc are out (moon high in the sky, y ${n.ns.moonY} ≈ sin 48°), lit windows at full`);
// 第 44 批（Nick「路燈照到的時候要漸漸的變亮 不要突然變亮」）：沿著快速道路開，新的路燈一格一格慢慢亮（以前剛進最近 4 支就一下子亮到 150 以上）
const ld = await p.evaluate(() => window.__lampDrive());
console.log('   lamp drive 最真實', JSON.stringify(ld));
check(ld.entered >= 1 && ld.dist > 50 && ld.maxRise < 99 && ld.maxRise > 0, `22:00 highway drive (${ld.dist} m, ${ld.frames} frames, up to ${ld.kmh} km/h): ${ld.entered} street lamps came on along the way and no lamp got brighter by more than ${ld.maxRise} (of 396) from one frame to the next (${ld.maxRiseAt}; frame step ≤ ${ld.dtMax} s): they fade in over 1.2 s instead of popping on`);
const n2 = await p.evaluate(() => { window.__go('dealer', 1); return window.__state(); }); // 村子：電線桿的路燈 180、窗戶、路上的車的大燈照路
const near2 = n2.pl.filter((l) => l.I > 0);
check(near2.some((l) => l.I === 180 && l.y < 8) && near2.every((l) => l.I <= 396), `22:00 village (the dealer is next to the highway): pole lamps at 180 on 7.3 m heads, highway heads 396 (${near2.map((l) => l.I + '@' + l.d + 'm').join(', ')})`);
check(n2.ns.pools === n2.nearCars && n2.ns.poolVis === n2.nearCars > 0 && n2.ns.poolOp > 0.3 && n2.ns.poolOp < 0.4 && (!n2.pool0 || (n2.pool0.d < 0.3 && n2.pool0.y > 0 && n2.pool0.y < 0.2)), `22:00 village: a headlight pool on the road in front of each of the ${n2.nearCars} cars within 110 m (${n2.ns.pools} pools${n2.pool0 ? ', the nearest ' + n2.pool0.d + ' m off its spot, ' + n2.pool0.y + ' m up' : ''})`);
// 警車的紅藍燈：沒有警車在追＝0；假裝一台警車開著燈停在 10 公尺外 → 一顆燈紅／藍輪流、在車頂
const pol = await p.evaluate(async () => { const D = window.__D(), PC = D.police.npcCars, t = D.drv.telemetry(), c = PC[0], was = { x: c.x, z: c.z, lights: c.lights }; const out = { before: D.LOOK._ns().pol.intensity };
  c.x = t.x + 10; c.z = t.z; c.heading = 0; c.lights = true; const seen = new Set(); for (let i = 0; i < 12; i++) { window.__view(320, 192, false); const N = D.LOOK._ns(); seen.add(N.pol.color.getHexString()); out.I = +N.pol.intensity.toFixed(1); out.y = +N.pol.position.y.toFixed(2); out.d = +Math.hypot(N.pol.position.x - c.x, N.pol.position.z - c.z).toFixed(2); out.polD = D.LOOK.info().polD; out.camD = +Math.hypot(c.x - D.dcam.position.x, c.z - D.dcam.position.z).toFixed(1); out.pools = N.pool.count; { const T3 = window.__THREE, m = new T3.Matrix4(), v = new T3.Vector3(); N.pool.getMatrixAt(0, m); v.setFromMatrixPosition(m); out.poolD = +Math.hypot(v.x - (c.x + c.hx + 0.3), v.z - c.z).toFixed(2); out.poolY = +v.y.toFixed(2); } await new Promise((r) => setTimeout(r, 90)); }
  out.colors = [...seen].sort(); c.x = was.x; c.z = was.z; c.lights = was.lights; window.__view(320, 192, false); out.after = D.LOOK._ns().pol.intensity; out.poolsAfter = D.LOOK._ns().pool.count; return out; });
console.log('   police light', JSON.stringify(pol));
check(pol.before === 0 && pol.I === 70 && pol.y > 1.8 && pol.y < 2.3 && pol.d < 0.6 && Math.abs(pol.polD - pol.camD) < 0.11 && pol.colors.length === 2 && pol.colors.includes('ff2a1a') && pol.colors.includes('2a60ff') && pol.after === 0, `police light: off with no chase; a police car with its lights on 10 m away → one light on its roof flashing red/blue (${pol.colors.join('/')}), 70; off again when it leaves`);
check(pol.pools === n2.nearCars + 1 && pol.poolD < 0.3 && pol.poolY > 0 && pol.poolY < 0.2 && pol.poolsAfter === n2.nearCars, `headlight pool: the police car gets one on the road in front of its nose (${pol.pools} pools, ${pol.poolD} m off, ${pol.poolY} m up); gone when it leaves`);
check(n.sp.length === 2 && n.sp.every((l) => l.I === 18 && l.decay === 0.5 && l.distance === 280 && l.angle === 0.95 && l.d > 1.5 && l.d < 3.5 && l.y > 0.3 && l.y < 1.2 && l.aim > 85 && l.aim < 95), `22:00: two headlights on the car's nose (${n.sp.map((l) => l.d + ' m').join(', ')} from its centre, ${n.sp.map((l) => l.y).join('/')} m high), 18 with decay ${n.sp[0] && n.sp[0].decay} to ${n.sp[0] && n.sp[0].distance} m, cone ${n.sp[0] && n.sp[0].angle} rad, aimed ${n.sp.map((l) => l.aim).join('/')} m ahead (第 34 批: lights the road far ahead; was 150 / decay 2: dark past 25 m; 第 37 批: 150 → 200 m, aimed 60 → 70 m, wider cone; 第 44 批 Nick「車燈可以再廣再遠一點」: decay 0.6 → 0.5, 200 → 280 m, aimed 90 m, cone 0.72 → 0.95)`);
check(k.lodE > d.lodE + 0.5 && k.lodE < n.lodE - 0.5 && k.paintN > 0.3 && k.paintN < 0.6, `17:45: traffic cars' lamps part-way on (E sum ${d.lodE} → ${k.lodE} → ${n.lodE}), own car's lamps at ${k.paintN}: lights come on gradually, not with a switch`);
// 第 31 批：角落的時間、環境聲
const clk = await p.evaluate(() => { const D = window.__D(), e = document.querySelector('#stage .dv-mapt'), A = D.AMB; return { hidden: e ? e.hidden : null, txt: e ? e.textContent : null, amb: !!(A && A.alive), mus: !!(D.MUS && D.MUS.alive), musBar: D.MUS ? D.MUS.bar : -1, musLv: D.MUS ? D.MUS.level : null, musSt: D.MUS ? D.MUS.style : null, last: A && A.last ? { wind: A.last.wind, birds: A.last.birds, crickets: A.last.crickets, cars: A.last.cars.map((c) => +c.d.toFixed(0)) } : null, voices: D.engineAudio.input ? 1 : 0 }; });
await p.evaluate(() => window.__view(960, 576, false)); await p.screenshot({ path: `${prefix}-hud-22.png` }); // 給人看的：HUD 上的時間
check(clk.hidden === false && clk.txt === '🌙 22:00', `clock above the minimap reads 「${clk.txt}」 at 22:00`);
check(clk.mus && clk.musBar >= 2 && clk.musLv === 1.6 && clk.musSt === 'drive', `第 34 批: background music is playing (bar ${clk.musBar}, level ${clk.musLv} (第 41 批: default 中 = 1.6), style ${clk.musSt}; program-made, starts with the ambient sound; 第 36 批: driving = the racing tune)`);
const msw = await p.evaluate(() => { const D = window.__D(), b = document.getElementById('musTog'), pop = document.getElementById('musPop'), st = () => ({ pressed: b.getAttribute('aria-pressed'), lv: D.MUS.level, ls: localStorage.getItem('carid.music'), open: document.body.classList.contains('musopen'), on: [...pop.querySelectorAll('button[aria-pressed="true"]')].map((x) => x.textContent).join('') });
  const pick = (t) => { b.click(); const o = document.body.classList.contains('musopen'); [...pop.querySelectorAll('button')].find((x) => x.textContent === t).click(); return { ...st(), opened: o }; };
  return { start: st(), off: pick('關'), s: pick('小'), l: pick('大'), m: pick('中') }; });
check(msw.start.on === '中' && msw.off.opened && !msw.off.open && msw.off.pressed === 'false' && msw.off.lv === 0 && msw.off.ls === 'off' && msw.s.lv === 1 && msw.s.ls === 's' && msw.s.pressed === 'true' && msw.l.lv === 2.4 && msw.l.ls === 'l' && msw.m.lv === 1.6 && msw.m.ls === 'm' && msw.m.on === '中', `第 39 批: 🎵 opens 背景音樂 關/小/中/大 (starts 中): 關 → level 0, 🎵 grey, saved 'off'; 第 41 批 one step louder: 小 1; 大 2.4; 中 1.6; picking closes it (${JSON.stringify(msw)})`);
check(clk.amb && clk.last && clk.last.crickets === 1 && clk.last.birds === 0 && clk.last.wind > 0 && clk.last.cars.length === 3, `ambient sound running while driving: crickets at night, no birds, wind ${clk.last && clk.last.wind}, 3 traffic voices (nearest ${clk.last && clk.last.cars.join('/')} m)`);
check(n.paintN === 1 && n.lodCars > 0 && n.lodE > d.lodE + 5 && n.sign > 0.7 && n.info.signs > 3, `22:00: own car's lamps glow (paint night 1), ${n.lodCars} traffic cars' lamps lit (E sum ${d.lodE} → ${n.lodE}), ${n.info.signs} sign materials brighter (${n.sign})`);
check(n.wet > 50 && Object.values(perf['22']).every((v) => v.wet > 50), `22:00 最真實: wet road reflection pass (${Object.values(perf['22']).map((v) => v.wet).join('/')} extra calls at ${PLACES.join('/')})`);
// 夜裡的畫面真的暗、燈的地方亮
const px = await p.evaluate(() => { const R = window.__D().renderer; const v = window.__view(240, 144, false); const gl = R.getContext(); const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, buf = new Uint8Array(W * H * 4); R.render(window.__D().TR.scene, window.__D().dcam); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let sum = 0, mx = 0; for (let i = 0; i < W * H; i++) { const l = (buf[i * 4] + buf[i * 4 + 1] + buf[i * 4 + 2]) / 3; sum += l; if (l > mx) mx = l; } return { mean: +(sum / (W * H)).toFixed(1), max: mx, W, H }; });
console.log('night pixels', JSON.stringify(px));
check(px.mean < 90 && px.max > 200, `22:00 picture is dark on average (${px.mean}/255) with bright lamps (max ${px.max})`);
// ---- 5 漂亮：晚上有燈、沒有倒影 ----
await p.evaluate(() => window.__D().LOOK.set(1));
await p.waitForFunction(() => window.__D().LOOK.level === 1 && !window.__D().LOOK.busy);
const b1 = await at('22-b', 22);
check(b1.night === 1 && b1.pl.some((l) => l.I > 0) && b1.sp.every((l) => l.I === 18) && b1.paintN === 1 && Object.values(perf['22-b']).every((v) => v.wet === 0) && b1.dl.I === 0.8,
  `漂亮 at 22:00: lamps, headlights, car lamps, moon light; no wet reflection pass`);
check(b1.pl.length === 2 && b1.sp.length === 1 && b1.ns.pol === null && !b1.info.polOn && b1.info.sh === 0 && b1.info.shR === 0 && b1.ns.beamVis && n.info.sh === 4096 && n.info.shR === 110 && n.info.shRad === 3.5 && n.pl.length === 4 && n.sp.length === 2 && n.info.polOn,
  `第 37 批 漂亮 is lighter: ${b1.pl.length} street lamps (最真實 ${n.pl.length}), ${b1.sp.length} headlight spot (最真實 ${n.sp.length}), no police roof light, shadow map ${b1.info.sh} / ${b1.info.shR} m (第 43 批: 高 has none; 最真實 ${n.info.sh} / ${n.info.shR} m); the road beam stays`);
const ldb = await p.evaluate(() => window.__lampDrive());
console.log('   lamp drive 高', JSON.stringify(ldb));
check(ldb.entered >= 1 && ldb.dist > 50 && ldb.maxRise < 99 && ldb.maxRise > 0, `第 44 批 高 (2 street lamps): along the highway ${ldb.entered} lamps came on, the biggest one-frame rise ${ldb.maxRise} of 396 (${ldb.maxRiseAt}): fades in, no pop`);
const pxl = await p.evaluate(() => { window.__dstep(1); const v = new window.__THREE.Vector2(); window.__D().renderer.getDrawingBufferSize(v); return { on: window.__pxLow() && !window.__pxHigh(), px: v.x * v.y, css: innerWidth * innerHeight }; });
check(pxl.on && pxl.px <= Math.max(0.35e6, pxl.css * 0.5625) * 1.01, `第 37 批: driving at 漂亮（高） caps the drawing buffer (第 43 批: 0.35 M pixels, down to 0.75× the screen; ${pxl.px} px for a ${pxl.css} px window)`);
{ // 第 43 批：大視窗（1280×720＝92 萬點）：畫的點可以比螢幕少（最少 0.75 倍），再放大給螢幕
  const bufPx = () => p.evaluate(() => { const v = new window.__THREE.Vector2(); window.__D().renderer.getDrawingBufferSize(v); return v.x * v.y; });
  const resized = async (w, h) => { const before = await bufPx(); await p.setViewportSize({ width: w, height: h }); // 等 ResizeObserver 真的叫到 resize()（以前固定等 300 毫秒，機器忙的時候還沒換）
    await p.waitForFunction((b) => { const v = new window.__THREE.Vector2(); window.__D().renderer.getDrawingBufferSize(v); return v.x * v.y !== b; }, before, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(100); };
  await resized(1280, 720);
  const big = await p.evaluate(() => { window.__dstep(1); const v = new window.__THREE.Vector2(); window.__D().renderer.getDrawingBufferSize(v); return { px: v.x * v.y, css: innerWidth * innerHeight, pr: window.__D().renderer.getPixelRatio() }; });
  await resized(844, 390);
  check(big.pr < 1 && big.pr >= 0.75 && big.px < big.css * 0.6, `第 43 批: 高 in a big window draws fewer pixels than the screen (ratio ${big.pr.toFixed(3)}, ${big.px} px for ${big.css})`);
}
// ---- 6 換回順：燈拿掉、招牌、車燈回去 ----
const signBase = await p.evaluate(() => { let m = null; window.__D().TR.scene.traverse((o) => { if (!m && o.isMesh && o.material && o.material.emissiveMap && /sign/.test(o.name)) m = o.material; }); return m ? m.emissiveIntensity : null; });
await p.evaluate(() => window.__D().LOOK.set(0));
await p.waitForFunction(() => window.__D().LOOK.level === 0 && !window.__D().LOOK.busy);
const z = await p.evaluate(() => { window.__dstep(1); const v = window.__view(320, 192, false); return { st: window.__state(), info: v.info, pxLow: window.__pxLow() }; });
console.log('6 順', JSON.stringify(z));
check(z.st.pl.length === 0 && z.st.sp.length === 0 && z.st.paintN === 0 && z.st.lodK === 0 && z.st.lodE < n.lodE - 5 && z.st.sign === 0.3 && signBase > 0.7 && z.st.dl.I === 1.4 && z.st.dl.c === 'fff4e0' && z.st.exp === 1 && z.info.wet === 0 && z.pxLow === false,
  `back to 順 at 22:00: lamps removed, car lamps off (night 0; E ${z.st.lodE}, brake lights may stay), signs back to 0.3 (were ${signBase}), original sun, no reflection`);
const z2 = await p.evaluate(() => { window.__dstep(20); const D = window.__D(), e = document.querySelector('#stage .dv-mapt'), A = D.AMB; return { hidden: e.hidden, last: A && A.last ? { birds: A.last.birds, crickets: A.last.crickets } : null }; });
check(z2.hidden === true && z2.last && z2.last.birds === 1 && z2.last.crickets === 0, `順: no clock (no day and night), ambient sound is daytime (birds, no crickets)`);
// 下車走路：環境聲還在（風大一點）、時間照樣顯示在走路的小地圖上面
await p.evaluate(() => window.__D().LOOK.set(2));
await p.waitForFunction(() => window.__D().LOOK.level === 2 && !window.__D().LOOK.busy);
const wk = await p.evaluate(() => { const D = window.__D(); D.LOOK.setHour(13); window.__go('dealer', 0); D.drv.setInput({ throttle: 0, brake: 0, steer: 0, handbrake: 1 }); window.__dstep(90); D.drv.setInput(null); window.__dstep(2); const a0 = D.AMB; const t0 = D.drv.telemetry(), act2 = JSON.stringify({ act2: D.drv.action2 && D.drv.action2.label, paused: t0.paused, auto: t0.auto, v: +t0.v.toFixed(2) }); D.leaveCar(); for (let i = 0; i < 300 && !(D.walker && D.walker.mode === 'walk'); i++) window.__dstep(1); window.__dstep(30);
  const e = document.querySelector('#stage .wk-mapt'), A = D.AMB; return { act2, mode: D.walker.mode, same: A === a0, amb: !!(A && A.alive), last: A && A.last ? { wind: A.last.wind, birds: A.last.birds, crickets: A.last.crickets } : null, hidden: e ? e.hidden : null, txt: e ? e.textContent : null, dvHidden: document.querySelector('#stage .dv-mapt').hidden }; });
await p.evaluate(() => window.__view(960, 576, false)); await p.screenshot({ path: `${prefix}-hud-walk.png` });
wk.mus = await p.waitForFunction(() => window.__D().MUS && window.__D().MUS.style === 'walk', null, { timeout: 8000 }).then(() => 'walk').catch(() => p.evaluate(() => (window.__D().MUS ? window.__D().MUS.style : null))); // 第 36 批：走路換成輕鬆的那首（真的時間：下一小節，最多約 2.6 秒）
check(wk.mode === 'walk' && wk.amb && wk.same && wk.last && wk.last.wind === 1 && wk.last.birds === 1 && wk.hidden === false && wk.txt === '☀ 13:00' && wk.mus === 'walk', `got out of the car (${wk.act2} → ${wk.mode}): ambient sound keeps running (wind ${wk.last && wk.last.wind}, birds), clock 「${wk.txt}」 on the walking minimap; 第 36 批: music switched to the walking tune (${wk.mus})`);
// ---- 7 回到時鐘 ----
const c2 = await p.evaluate(() => { const D = window.__D(); D.LOOK.setHour(null); return { h: D.LOOK.hour, c: (() => { const u = (((Date.now() / 60000) % 12) / 12) * 24, h = u - 0.65 * (6 / Math.PI) * Math.sin((Math.PI * (u - 6)) / 6); return ((h % 24) + 24) % 24; })() }; });
check(Math.abs(c2.h - c2.c) < 0.05, `setHour(null): back to the clock (${c2.h.toFixed(2)})`);
// 第 40 批（Nick「傍晚變晚上天色變黑的太快」）：一天還是 12 分鐘、白天 6 分鐘，但日落那段走慢：太陽 8° → 晚上全黑（-10°）要多久
const dk = await p.evaluate(() => { const L = window.__D().LOOK, el = (h) => 55 * Math.sin(Math.PI * ((((h - 6) / 12) % 2 + 2) % 2)); let a = null, b = null, day = 0;
  for (let ms = 0; ms < 12 * 60000; ms += 250) { const h = L.hourAt(ms), e = el(h); if (h > 12 && h < 24 && a === null && e < 8) a = ms; if (h > 12 && a !== null && b === null && e < -10) b = ms; if (h >= 6 && h < 18) day += 250; }
  return { dusk: (b - a) / 1000, day: day / 60000, h6: +L.hourAt(3 * 60000).toFixed(3), h18: +L.hourAt(9 * 60000).toFixed(3), h12: +L.hourAt(6 * 60000).toFixed(3) }; });
check(dk.dusk > 80 && dk.dusk < 120 && Math.abs(dk.day - 6) < 0.02 && dk.h6 === 6 && dk.h18 === 18 && dk.h12 === 12, `第 40 批: dusk (sun 8° → full night) takes ${dk.dusk} s of real time (was ≈ 37 s); daytime still ${dk.day} min of the 12; 3/6/9 min = ${dk.h6}/${dk.h12}/${dk.h18} h`);
// ---- 8 第 42 批：回車庫頁（畫質已經做好了）再從那一格換：馬上換，出門就是那個 ----
await p.evaluate(() => { window.__hold = false; window.__noDraw = false; document.getElementById('driveHome').click(); });
await p.waitForFunction(() => !window.__D().on && document.getElementById('lookRow').offsetParent !== null, null, { timeout: 60000 });
await p.evaluate(() => document.querySelector('#lookRow button[data-l="1"]').click());
await p.waitForFunction(() => window.__D().LOOK.level === 1 && !window.__D().LOOK.busy, null, { timeout: 120000 });
const r4 = await rowSt();
console.log('8 lookRow home', JSON.stringify(r4));
check(r4.vis && r4.row === '1' && r4.pop === '1' && r4.v === '1', `第 42 批: back on the garage page the row switches the built look right away (level 1, saved ${r4.v}, ✨ row matches)`);
// ---- 效能 ----
console.log('perf', JSON.stringify(perf));
console.log(`\n${ok} ok, ${bad} failed, ${errs.length} page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(bad === 0 && errs.length === 0 ? 'ALL CHECKS OK' : 'SOME CHECKS FAILED');
await b.close(); srv.close();
process.exit(bad === 0 && errs.length === 0 ? 0 : 1);
