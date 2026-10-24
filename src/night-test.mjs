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
const hook = 'window.__THREE = THREE; window.__PN = PAINT_NIGHT;'
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
  window.__state = () => { const sc = D.TR.scene; let dl = null, hemi = null; const pl = [], sp = []; let signM = null; const car = D.tripS?.car;
    sc.traverse((o) => { if (o.isDirectionalLight && !dl) dl = o; if (o.isHemisphereLight && !hemi) hemi = o; if (o.name === 'lk-lamp') pl.push(o); if (o.name === 'lk-head') sp.push(o);
      if (!signM && o.isMesh && o.material && o.material.emissiveMap && o.material.emissiveMap === o.material.map && /sign/.test(o.name)) signM = o.material; });
    const cp = D.dcam.position, cx = car ? new THREE.Vector3().setFromMatrixPosition(car.matrixWorld) : null;
    const tr = D.NPC?.traffic?.cars?.find((c) => c.lod && c.lod._E) || null; let lodE = 0; if (tr) for (const v of tr.lod._E) lodE += v;
    const NS = D.LOOK._ns ? D.LOOK._ns() : null, TC = (D.NPC?.traffic?.cars || []).filter((c) => c.active && c.kind === 'car' && !c.crushed), PC = (D.police?.npcCars || []).filter((c) => c.x < 1e5); // 第 32 批：大燈照路的光斑：鏡頭 110 公尺內的車（路上的、警車）
    const near = [...TC, ...PC].map((c) => ({ c, d: Math.hypot(c.x - cp.x, c.z - cp.z) })).filter((o) => o.d < 110).sort((a, b) => a.d - b.d); let pool0 = null;
    if (NS && NS.pool.count && near.length) { const m = new THREE.Matrix4(), v = new THREE.Vector3(); NS.pool.getMatrixAt(0, m); v.setFromMatrixPosition(m); const c = near[0].c, hx = c.hx || 2.2; pool0 = { d: +Math.hypot(v.x - (c.x + Math.cos(c.heading) * (hx + 0.3)), v.z - (c.z - Math.sin(c.heading) * (hx + 0.3))).toFixed(2), y: +v.y.toFixed(2) }; }
    const ns = NS ? { stars: NS.stars.geometry.attributes.position.count, starsOp: +NS.stars.material.opacity.toFixed(2), moonOp: +NS.moon.material.opacity.toFixed(2), moonY: +new THREE.Vector3().setFromMatrixPosition(NS.moon.matrixWorld).sub(cp).normalize().y.toFixed(2), winN: NS.lit, winOp: +NS.win.material.opacity.toFixed(2), winVis: NS.win.visible, pools: NS.pool.count, beamVis: NS.beam.visible, beamOp: +NS.beam.material.opacity.toFixed(2), beamD: cx ? +NS.beam.position.distanceTo(cx).toFixed(2) : null, beamY: +NS.beam.position.y.toFixed(2), poolOp: +NS.pool.material.opacity.toFixed(3), poolVis: NS.pool.visible, pol: +NS.pol.intensity.toFixed(1), polC: NS.pol.color.getHexString(), polY: +NS.pol.position.y.toFixed(2) } : null;
    return { info: D.LOOK.info(), hour: +D.LOOK.hour.toFixed(2), sun: +D.LOOK.sun.toFixed(1), night: +D.LOOK.night.toFixed(2), exp: R.toneMappingExposure, ns, nearCars: Math.min(12, near.length), pool0,
      dl: { I: +dl.intensity.toFixed(3), c: dl.color.getHexString(), y: +dl.position.y.toFixed(0), dirY: +(dl.position.y - dl.target.position.y).toFixed(0) }, hemi: { I: +hemi.intensity.toFixed(3), c: hemi.color.getHexString() }, fog: sc.fog ? sc.fog.color.getHexString() : null, envI: +sc.environmentIntensity.toFixed(3),
      pl: pl.map((l) => ({ I: +l.intensity.toFixed(1), d: +Math.hypot(l.position.x - cp.x, l.position.z - cp.z).toFixed(0), y: +l.position.y.toFixed(1) })), sp: sp.map((l) => ({ I: +l.intensity.toFixed(0), d: cx ? +l.position.distanceTo(cx).toFixed(2) : null, y: +l.position.y.toFixed(2), decay: l.decay, distance: l.distance, aim: +l.position.distanceTo(l.target.position).toFixed(1) })),
      paintN: window.__PN.value, sign: signM ? +signM.emissiveIntensity.toFixed(2) : null, lodE: +lodE.toFixed(2), lodK: D.buildLodCar.nightK(), lodCars: D.NPC?.traffic?.cars?.length || 0, wet: D.LOOK.stats.wetCalls || 0 }; };
});

await p.goto(base, { waitUntil: 'domcontentloaded' });
await ready();
const g1 = await goOut();
console.log('out', el(), JSON.stringify(g1));
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await helpers();
// ---- 1 順：時間照時鐘，但什麼都不動 ----
const s0 = await p.evaluate(() => { const D = window.__D(); const h0 = D.LOOK.hour, h1 = (((Date.now() / 60000) % 12) / 12) * 24; return { lv: D.LOOK.level, hour: h0, clock: h1, st: window.__state() }; });
console.log('1 順', JSON.stringify(s0));
check(s0.lv === 0 && s0.hour >= 0 && s0.hour < 24 && Math.abs(s0.hour - s0.clock) < 0.05 && s0.st.pl.length === 0 && s0.st.sp.length === 0 && s0.st.paintN === 0 && s0.st.dl.I === 1.4,
  `順: clock hour ${s0.hour.toFixed(2)} (= (minutes % 12) / 12 × 24: a 12-minute day, 第 34 批), nothing changes (no lamps, sun 1.4, paint night 0)`);
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
check(n.sun < -20 && n.night === 1 && n.dl.I === 0.5 && n.dl.c === '9fb4d8' && n.dl.dirY > 150 && n.hemi.c === '34405e' && n.fog === '0a0d15' && n.info.band === 'n' && n.exp === 1,
  `22:00: sun ${n.sun}° (below), moon light 0.5 #${n.dl.c} with shadows, night hemi/fog, night reflection map`);
check(near.length >= 2 && near.every((l) => l.I > 0 && l.I <= 396 && l.d < 90 && l.y > 5) && near.some((l) => l.I === 396 && l.y > 10) && near.filter((l) => l.d > 55).every((l) => l.I < 396) && n.info.lamps > 100,
  `22:00 highway: ${near.length} nearest street lamps lit (${near.map((l) => l.I + '@' + l.d + 'm').join(', ')}: 180 × 2.2 = 396 on the 11 m highway heads so the road is lit like the village, fading past 50 m so a swap never pops) of ${n.info.lamps} lamp heads (poles, highway, parking)`);
check(n.ns.beamVis && n.ns.beamOp === 0.65 && n.ns.beamD > 1.5 && n.ns.beamD < 3.5 && n.ns.beamY > -0.2 && n.ns.beamY < 0.4, `22:00: the own car's headlight beam patch lies on the road from its nose (${n.ns.beamD} m from the centre, y ${n.ns.beamY}), opacity ${n.ns.beamOp} (第 34 批: lights the road 0–70 m ahead; off by day)`);
check(n.ns.starsOp === 1 && n.ns.moonOp === 1 && n.ns.moonY > 0.6 && n.ns.moonY < 0.85 && n.ns.winVis && n.ns.winOp === 1, `22:00: stars and the moon disc are out (moon high in the sky, y ${n.ns.moonY} ≈ sin 48°), lit windows at full`);
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
check(n.sp.length === 2 && n.sp.every((l) => l.I === 18 && l.decay === 0.6 && l.distance === 150 && l.d > 1.5 && l.d < 3.5 && l.y > 0.3 && l.y < 1.2 && l.aim > 55 && l.aim < 65), `22:00: two headlights on the car's nose (${n.sp.map((l) => l.d + ' m').join(', ')} from its centre, ${n.sp.map((l) => l.y).join('/')} m high), 18 with decay 0.6 to 150 m aimed ${n.sp.map((l) => l.aim).join('/')} m ahead (第 34 批: lights the road far ahead; was 150 / decay 2: dark past 25 m)`);
check(k.lodE > d.lodE + 0.5 && k.lodE < n.lodE - 0.5 && k.paintN > 0.3 && k.paintN < 0.6, `17:45: traffic cars' lamps part-way on (E sum ${d.lodE} → ${k.lodE} → ${n.lodE}), own car's lamps at ${k.paintN}: lights come on gradually, not with a switch`);
// 第 31 批：角落的時間、環境聲
const clk = await p.evaluate(() => { const D = window.__D(), e = document.querySelector('#stage .dv-mapt'), A = D.AMB; return { hidden: e ? e.hidden : null, txt: e ? e.textContent : null, amb: !!(A && A.alive), mus: !!(D.MUS && D.MUS.alive), musBar: D.MUS ? D.MUS.bar : -1, musLv: D.MUS ? D.MUS.level : null, last: A && A.last ? { wind: A.last.wind, birds: A.last.birds, crickets: A.last.crickets, cars: A.last.cars.map((c) => +c.d.toFixed(0)) } : null, voices: D.engineAudio.input ? 1 : 0 }; });
await p.evaluate(() => window.__view(960, 576, false)); await p.screenshot({ path: `${prefix}-hud-22.png` }); // 給人看的：HUD 上的時間
check(clk.hidden === false && clk.txt === '🌙 22:00', `clock above the minimap reads 「${clk.txt}」 at 22:00`);
check(clk.mus && clk.musBar >= 2 && clk.musLv === 1, `第 34 批: background music is playing (bar ${clk.musBar}, level ${clk.musLv}; program-made, starts with the ambient sound)`);
const msw = await p.evaluate(() => { const D = window.__D(), b = document.getElementById('musTog'); b.click(); const off = { pressed: b.getAttribute('aria-pressed'), lv: D.MUS.level, ls: localStorage.getItem('carid.music') }; b.click(); return { off, on: { pressed: b.getAttribute('aria-pressed'), lv: D.MUS.level, ls: localStorage.getItem('carid.music') } }; });
check(msw.off.pressed === 'false' && msw.off.lv === 0 && msw.off.ls === 'off' && msw.on.pressed === 'true' && msw.on.lv === 1 && msw.on.ls === 'on', `第 35 批: 🎵 switch: off → level 0, saved 'off'; on again → level 1 (${JSON.stringify(msw)})`);
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
check(b1.night === 1 && b1.pl.some((l) => l.I > 0) && b1.sp.every((l) => l.I === 18) && b1.paintN === 1 && Object.values(perf['22-b']).every((v) => v.wet === 0) && b1.dl.I === 0.5,
  `漂亮 at 22:00: lamps, headlights, car lamps, moon light; no wet reflection pass`);
// ---- 6 換回順：燈拿掉、招牌、車燈回去 ----
const signBase = await p.evaluate(() => { let m = null; window.__D().TR.scene.traverse((o) => { if (!m && o.isMesh && o.material && o.material.emissiveMap && /sign/.test(o.name)) m = o.material; }); return m ? m.emissiveIntensity : null; });
await p.evaluate(() => window.__D().LOOK.set(0));
await p.waitForFunction(() => window.__D().LOOK.level === 0 && !window.__D().LOOK.busy);
const z = await p.evaluate(() => { const v = window.__view(320, 192, false); return { st: window.__state(), info: v.info }; });
console.log('6 順', JSON.stringify(z));
check(z.st.pl.length === 0 && z.st.sp.length === 0 && z.st.paintN === 0 && z.st.lodK === 0 && z.st.lodE < n.lodE - 5 && z.st.sign === 0.3 && signBase > 0.7 && z.st.dl.I === 1.4 && z.st.dl.c === 'fff4e0' && z.st.exp === 1 && z.info.wet === 0,
  `back to 順 at 22:00: lamps removed, car lamps off (night 0; E ${z.st.lodE}, brake lights may stay), signs back to 0.3 (were ${signBase}), original sun, no reflection`);
const z2 = await p.evaluate(() => { window.__dstep(20); const D = window.__D(), e = document.querySelector('#stage .dv-mapt'), A = D.AMB; return { hidden: e.hidden, last: A && A.last ? { birds: A.last.birds, crickets: A.last.crickets } : null }; });
check(z2.hidden === true && z2.last && z2.last.birds === 1 && z2.last.crickets === 0, `順: no clock (no day and night), ambient sound is daytime (birds, no crickets)`);
// 下車走路：環境聲還在（風大一點）、時間照樣顯示在走路的小地圖上面
await p.evaluate(() => window.__D().LOOK.set(2));
await p.waitForFunction(() => window.__D().LOOK.level === 2 && !window.__D().LOOK.busy);
const wk = await p.evaluate(() => { const D = window.__D(); D.LOOK.setHour(13); window.__go('dealer', 0); D.drv.setInput({ throttle: 0, brake: 0, steer: 0, handbrake: 1 }); window.__dstep(90); D.drv.setInput(null); window.__dstep(2); const a0 = D.AMB; const t0 = D.drv.telemetry(), act2 = JSON.stringify({ act2: D.drv.action2 && D.drv.action2.label, paused: t0.paused, auto: t0.auto, v: +t0.v.toFixed(2) }); D.leaveCar(); for (let i = 0; i < 300 && !(D.walker && D.walker.mode === 'walk'); i++) window.__dstep(1); window.__dstep(30);
  const e = document.querySelector('#stage .wk-mapt'), A = D.AMB; return { act2, mode: D.walker.mode, same: A === a0, amb: !!(A && A.alive), last: A && A.last ? { wind: A.last.wind, birds: A.last.birds, crickets: A.last.crickets } : null, hidden: e ? e.hidden : null, txt: e ? e.textContent : null, dvHidden: document.querySelector('#stage .dv-mapt').hidden }; });
await p.evaluate(() => window.__view(960, 576, false)); await p.screenshot({ path: `${prefix}-hud-walk.png` });
check(wk.mode === 'walk' && wk.amb && wk.same && wk.last && wk.last.wind === 1 && wk.last.birds === 1 && wk.hidden === false && wk.txt === '☀ 13:00', `got out of the car (${wk.act2} → ${wk.mode}): ambient sound keeps running (wind ${wk.last && wk.last.wind}, birds), clock 「${wk.txt}」 on the walking minimap`);
// ---- 7 回到時鐘 ----
const c2 = await p.evaluate(() => { const D = window.__D(); D.LOOK.setHour(null); return { h: D.LOOK.hour, c: (((Date.now() / 60000) % 12) / 12) * 24 }; });
check(Math.abs(c2.h - c2.c) < 0.05, `setHour(null): back to the clock (${c2.h.toFixed(2)})`);
// ---- 效能 ----
console.log('perf', JSON.stringify(perf));
console.log(`\n${ok} ok, ${bad} failed, ${errs.length} page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(bad === 0 && errs.length === 0 ? 'ALL CHECKS OK' : 'SOME CHECKS FAILED');
await b.close(); srv.close();
process.exit(bad === 0 && errs.length === 0 ? 0 : 1);
