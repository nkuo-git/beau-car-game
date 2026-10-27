// 第 47 批（Nick 2026-10-27「做下雨 偶爾可以讓它下雨 但這樣跑得動嗎?」）：下雨（look.js）
// 什麼時候下（照時鐘、25%、接得起來）；普通沒有雨；高／超高：雨絲（一個 draw call）、天空變灰、太陽變弱、霧近一點、路變濕（高＝變暗變亮滑、超高＝倒影）；
// 雨聲、鳥不叫；開車雨往你斜；駕駛座裡面沒有雨；慢慢乾；晚上看不到星星、大燈照到的雨亮；隧道裡沒有雨；換回普通全部還原；試做頁出門 15 秒就下；draw calls、截圖
// 用法：node rain-test.mjs ../out/rain/rn   （先 node build-art.mjs --yaris && node make-free.mjs）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const prefix = process.argv[2] || '../out/rain/rn';
fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__THREE = THREE;'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, tripS, TR, walker, renderer, LOOK, NPC, S, AMB, AMB_S, engineAudio, leaveCar });'
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
p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/ERR_CERT|404|GPU stall|AudioContext|ERR_TUNNEL|ERR_NAME|ERR_CONNECTION|fonts\.g|Failed to load resource/.test(t)) { errs.push(t); console.log('console error', t.slice(0, 300)); } else if (/THREE\.|look:/.test(t) && !/already non-indexed|KHR_parallel/.test(t)) console.log('console', m.type(), t.slice(0, 300)); });
let ok = 0, bad = 0;
const check = (c, msg) => { if (c) ok++; else bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${msg}`); };
const save = (n, u) => fs.writeFileSync(`${prefix}-${n}.jpg`, Buffer.from(u.split(',')[1], 'base64'));
const SAVE = { v: 2, cur: 'gtr', scene: 'room', money: 500, owned: ['gc8', 'gtr'], parts: {}, tyres: {}, wins: {}, cars: {}, park: { mid: 'gtr', tower: Array(40).fill(null) } };
await p.addInitScript((s) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('carid.tune', s); }, JSON.stringify(SAVE));

// ---- 0 試做頁：出門 15 秒就下雨（make-free.mjs 做的頁面把 TRIAL_FREE 打開，傳給 createLook）----
{ const fr = fs.readFileSync(path.join(dir, 'art/garage-free.html'), 'utf8'), nm = fs.readFileSync(path.join(dir, 'art/garage.html'), 'utf8');
  check(/const TRIAL_FREE = true;/.test(fr) && fr.includes('trialRain: TRIAL_FREE') && /const TRIAL_FREE = false;/.test(nm), 'trial page: garage-free.html turns TRIAL_FREE on and passes it to createLook as trialRain (the normal page keeps it off)'); }

await p.goto(base, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => document.getElementById('status').hidden, null, { timeout: 300000 });
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk');
const g1 = await p.evaluate(() => { const W = window.__D().walker; let ok = false; for (let k = 0; k < 600 && !ok; k++) { ok = W.getIn((W.cars.find((c) => c.key === 'gtr') || W.cars[0])); if (!ok) window.__dstep(1); } for (let i = 0; i < 200 && !(window.__D().drv && window.__D().walker.mode === 'off'); i++) window.__dstep(1); return { ok, mode: window.__D().walker.mode }; });
console.log('out', el(), JSON.stringify(g1));
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; });
await p.evaluate(() => {
  const D = window.__D(), R = D.renderer, THREE = window.__THREE;
  window.__view = (W = 960, H = 576, shot = true) => {
    const c = D.dcam, sz = R.getSize(new THREE.Vector2()), pr = R.getPixelRatio(), asp = c.aspect;
    R.setPixelRatio(1); R.setSize(W, H, false); c.aspect = W / H; c.updateProjectionMatrix();
    D.GAR.cull(c); R.setRenderTarget(null); R.render(D.TR.scene, c);
    const info = { calls: R.info.render.calls, tris: R.info.render.triangles, wet: D.LOOK.stats.wetCalls || 0 }, url = shot ? R.domElement.toDataURL('image/jpeg', 0.85) : null;
    R.setSize(sz.x, sz.y, false); R.setPixelRatio(pr); c.aspect = asp; c.updateProjectionMatrix(); return { url, info };
  };
  window.__place = (x, z, h, n = 90) => { const d = D.drv; d.teleport({ x, z, heading: h }); d.setInput({ throttle: 0, brake: 1, steer: 0 }); window.__dstep(n); d.setInput(null); };
  window.__go = (w, n = 3) => { if (Array.isArray(w)) window.__place(w[0], w[1], w[2]); else if (w) { const sp = D.VIL.places[w].spawn; window.__place(sp.x, sp.z, sp.heading); } for (let i = 0; i < n; i++) window.__view(320, 192, false); return window.__view(); };
  window.__warm = (n = 6) => { for (let i = 0; i < n; i++) { window.__dstep(1); window.__view(320, 192, false); } };
  // 畫面：上面 18%（天空）平均亮度、飽和度；下面中間（車子前面的路）平均亮度
  window.__pix = async (u) => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const reg = (x0, y0, x1, y1) => { const d = x.getImageData(x0 * c.width | 0, y0 * c.height | 0, (x1 - x0) * c.width | 0, (y1 - y0) * c.height | 0).data; let L = 0, S = 0, n = 0; for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); L += 0.299 * r + 0.587 * g + 0.114 * b; S += mx ? (mx - mn) / mx : 0; n++; } return { L: +(L / n).toFixed(1), S: +(S / n).toFixed(3) }; };
    return { sky: reg(0.05, 0.0, 0.95, 0.18), road: reg(0.3, 0.82, 0.7, 0.98) }; };
  window.__st = () => { const sc = D.TR.scene; let dl = null, hemi = null, rain = null; sc.traverse((o) => { if (o.isDirectionalLight && !dl) dl = o; if (o.isHemisphereLight && !hemi) hemi = o; if (o.name === 'lk-rain') rain = o; });
    const u = rain ? rain.material.uniforms : null;
    return { info: D.LOOK.info(), rain: +D.LOOK.rain.toFixed(3), wet: +D.LOOK.wet.toFixed(3), dl: +dl.intensity.toFixed(3), hemi: +hemi.intensity.toFixed(3), hemiC: hemi.color.getHexString(), fogC: sc.fog.color.getHexString(), fogNear: Math.round(sc.fog.near), fogFar: Math.round(sc.fog.far), exp: +R.toneMappingExposure.toFixed(3), ms: +D.LOOK.stats.ms.toFixed(3),
      mesh: rain ? { vis: rain.visible, n: rain.geometry.drawRange.count / 6, op: +u.uOp.value.toFixed(3), near: u.uNear.value, camV: u.uCamV.value.toArray().map((v) => +v.toFixed(2)), head: +u.uHeadK.value.toFixed(2), col: u.uCol.value.getHexString() } : null }; };
});
const pix = (u) => p.evaluate((u) => window.__pix(u), u);

// ---- 1 什麼時候下雨：照時鐘（每支手機一樣），一週裡面算 ----
const sch = await p.evaluate(() => { const L = window.__D().LOOK, t0 = Date.UTC(2026, 9, 27); let rain = 0, maxD = 0, prev = L.rainAt(t0), mx = 0, spells = 0, wet = false, gap = 0, maxGap = 0, plateau = 1;
  for (let s = 1; s <= 7 * 86400; s++) { const k = L.rainAt(t0 + s * 1000); maxD = Math.max(maxD, Math.abs(k - prev)); prev = k; mx = Math.max(mx, k); if (k > 0.05) rain++;
    const w = k > 0.05; if (w && !wet) { spells++; maxGap = Math.max(maxGap, gap); gap = 0; } if (!w) gap++; wet = w; if (k > 0.05 && s % 240 === 120) plateau = Math.min(plateau, k); }
  const same = [0, 1e6, 3.3e7].every((d) => L.rainAt(t0 + d) === L.rainAt(t0 + d));
  return { frac: +(rain / (7 * 86400)).toFixed(3), maxD: +maxD.toFixed(4), max: +mx.toFixed(3), perDay: +(spells / 7).toFixed(1), maxGapMin: +(maxGap / 60).toFixed(0), plateau: +plateau.toFixed(2), same,
    trial: [0, 14, 40, 210, 260].map((t) => +L._trialK(t).toFixed(2)) }; });
console.log('1 schedule', JSON.stringify(sch));
check(sch.frac > 0.18 && sch.frac < 0.36 && sch.max <= 1 && sch.maxD < 0.05 && sch.perDay >= 10 && sch.maxGapMin < 240 && sch.same,
  `rain now and then by the clock: rains ${(sch.frac * 100).toFixed(0)}% of the time, ${sch.perDay} times a day, longest dry spell ${sch.maxGapMin} min, never jumps (max ${sch.maxD}/s), same answer every time`);
check(sch.trial[0] === 0 && sch.trial[1] === 0 && sch.trial[2] === 0.9 && sch.trial[3] === 0.9 && sch.trial[4] === 0, `trial page curve: dry at 0 / 14 s, raining 0.9 at 40 s and 210 s, stopped at 260 s (${sch.trial.join(', ')})`);

// ---- 2 普通：沒有雨 ----
await p.evaluate(() => { const L = window.__D().LOOK; L.setHour(13); L.setRain(0); });
const n0 = await p.evaluate(() => { const a = window.__go('dealer'); return { a: a.info, st: window.__st() }; });
await p.evaluate(() => window.__D().LOOK.setRain(1));
const n1 = await p.evaluate(() => { window.__warm(3); const a = window.__view(); return { a: a.info, st: window.__st() }; });
console.log('2 普通', JSON.stringify({ n0, n1 }));
check(n1.st.info.level === 0 && n1.st.rain === 0 && n1.st.wet === 0 && !n1.st.mesh && n1.a.calls === n0.a.calls && n1.a.tris === n0.a.tris && n1.st.fogFar === 1500,
  `普通: no rain at all (no raindrops, no wet road, fog still ${n1.st.fogFar} m, draw calls ${n0.a.calls} → ${n1.a.calls})`);

// ---- 3 高：白天下雨 ----
await p.evaluate(async () => { const L = window.__D().LOOK; L.setRain(0); await L.set(1); });
await p.waitForFunction(() => window.__D().LOOK.level === 1 && !window.__D().LOOK.busy, null, { timeout: 180000 });
const perf = {};
const pair = async (lv, tag, place, hour) => {
  await p.evaluate((h) => { const L = window.__D().LOOK; L.setHour(h); L.setRain(0); }, hour);
  // 乾的、下雨的畫同一格（中間不走：路上的車不會動，draw calls 只差雨）
  const d = await p.evaluate((w) => { window.__go(w); window.__warm(4); window.__view(320, 192, false); const v2 = window.__view(); return { v: v2, st: window.__st() }; }, place);
  await p.evaluate(() => window.__D().LOOK.setRain(1));
  const r = await p.evaluate(() => { for (let i = 0; i < 3; i++) window.__view(320, 192, false); const v = window.__view(); return { v, st: window.__st() }; });
  save(`${tag}-dry`, d.v.url); save(`${tag}-rain`, r.v.url);
  const pd = await pix(d.v.url), pr = await pix(r.v.url);
  perf[tag] = { dry: d.v.info, rain: r.v.info };
  console.log(tag, el(), JSON.stringify({ dry: { ...d.v.info, px: pd, st: d.st }, rain: { ...r.v.info, px: pr, st: r.st } }));
  return { d, r, pd, pr };
};
const h1 = await pair(1, 'hi-day', 'dealer', 13);
const h2 = await pair(1, 'hi-hwy', 'highway', 13);
const h3 = await pair(1, 'hi-night', 'dealer', 22);
check(h3.d.st.info.stars > 0.5 && h3.r.st.info.stars === 0 && h3.r.st.mesh.head > 0.9, `高 night: stars ${h3.d.st.info.stars} → ${h3.r.st.info.stars} behind the rain clouds; headlights light up the rain (${h3.r.st.mesh.head})`);
const h4 = await pair(1, 'hi-dusk', 'highway', 17.6);
await p.evaluate(() => { const L = window.__D().LOOK; L.setHour(13); window.__go('dealer'); L.setRain(1); window.__warm(3); });
// 柏油的材质（畫過的、為「高」編的那幾個）都有 lkWet；順便量 60 格的 JS
const prog = await p.evaluate(() => { const D = window.__D(), R = D.renderer, roads = new Set(); D.TR.scene.traverse((o) => { if (o.isMesh && o.material && o.material.userData && o.material.userData.role === 'road' && o.material.userData.lk) roads.add(o.material); });
  const hi = [...roads].map((m) => R.properties.get(m).currentProgram).filter((pr) => pr && /\|lk1/.test(pr.cacheKey));
  for (let i = 0; i < 60; i++) window.__view(160, 96, false); const L = D.LOOK.info(); return { roads: roads.size, hi: hi.length, lkWet: hi.length > 0 && hi.every((pr) => !!pr.getUniforms().map.lkWet), ms: +D.LOOK.stats.ms.toFixed(3), rainMs: L.rainMs }; });
console.log('3 program', JSON.stringify(prog));
{ const { d, r, pd, pr } = h1;
  check(r.st.mesh && r.st.mesh.vis && r.st.mesh.n === 3000 && r.st.mesh.op > 0.2 && r.v.info.calls - d.v.info.calls >= 1 && r.v.info.calls - d.v.info.calls <= 2 && r.v.info.tris - d.v.info.tris >= 5900 && r.v.info.tris - d.v.info.tris <= 6400,
    `高 rain: ${r.st.mesh.n} raindrops in one draw call (calls ${d.v.info.calls} → ${r.v.info.calls}, triangles +${r.v.info.tris - d.v.info.tris})`);
  check(r.st.dl < d.st.dl * 0.3 && r.st.hemi > d.st.hemi + 0.3 && r.st.fogFar === 600 && r.st.fogNear === 60 && pr.sky.S < pd.sky.S * 0.6 && pr.sky.L < pd.sky.L,
    `高 rain sky: sun ${d.st.dl} → ${r.st.dl}, sky light ${d.st.hemi} → ${r.st.hemi} (gray ${r.st.hemiC}), fog ${d.st.fogFar} → ${r.st.fogFar} m, sky grayer (saturation ${pd.sky.S} → ${pr.sky.S}) and darker (${pd.sky.L} → ${pr.sky.L})`);
  check(r.st.info.wetL === 1 && d.st.info.wetL === 0 && prog.lkWet && pr.road.L < pd.road.L, `高 wet road: the road shaders built for 高 have the wet part (lkWet, ${prog.hi} of ${prog.roads}), wet ${r.st.info.wetL}, the ground in front is darker (${pd.road.L} → ${pr.road.L})`);
  check(prog.rainMs < 0.1 && prog.ms < 0.5, `高: the rain's per-frame JS is tiny (${prog.rainMs} ms; all of look ${prog.ms} ms, dry ${d.st.ms})`); }

// ---- 4 雨聲、鳥不叫 ----
const snd = await p.evaluate(() => { window.__dstep(13); const D = window.__D(); return { rain: +D.AMB_S.rain.toFixed(2), birds: +D.AMB_S.birds.toFixed(2), rainIn: D.AMB_S.rainIn, amb: !!D.AMB, last: D.AMB && D.AMB.last ? +(D.AMB.last.rain || 0).toFixed(2) : null }; });
await p.evaluate(() => window.__D().LOOK.setRain(0));
const snd0 = await p.evaluate(() => { window.__warm(2); window.__dstep(13); const D = window.__D(); return { rain: +D.AMB_S.rain.toFixed(2), birds: +D.AMB_S.birds.toFixed(2) }; });
console.log('4 sound', JSON.stringify({ snd, snd0 }));
check(snd.amb && snd.rain === 1 && snd.last === 1 && snd.birds === 0 && snd.rainIn === true && snd0.rain === 0 && snd0.birds === 1, `rain sound on while it rains (${snd.rain}, muffled in the car ${snd.rainIn}), birds stop (${snd.birds}); dry again: rain sound ${snd0.rain}, birds ${snd0.birds}`);

// ---- 5 慢慢乾、慢慢濕（不會一下子）----
const dry = await p.evaluate(() => { const L = window.__D().LOOK; L.setRain(1); window.__warm(2); L.setRain(0, false); for (let i = 0; i < 20; i++) window.__view(160, 96, false); const a = L.wet; L.setRain(0); L.setRain(1, false); for (let i = 0; i < 20; i++) window.__view(160, 96, false); return { afterStop: +a.toFixed(3), afterStart: +L.wet.toFixed(3) }; });
console.log('5 wet', JSON.stringify(dry));
check(dry.afterStop > 0.97 && dry.afterStop < 1 && dry.afterStart > 0 && dry.afterStart < 0.1, `the road dries slowly after the rain stops (${dry.afterStop} after 20 frames) and gets wet over half a minute (${dry.afterStart})`);

// ---- 6 開車的時候雨往你斜；駕駛座裡面沒有雨 ----
const mv = await p.evaluate(() => { const D = window.__D(), d = D.drv, L = D.LOOK; L.setRain(1); const sp = D.VIL.places.highway.spawn; window.__place(sp.x, sp.z, sp.heading, 30);
  for (let i = 0; i < 90; i++) { d.setInput({ throttle: 1, brake: 0, steer: 0 }); window.__dstep(2); window.__view(160, 96, false); }
  const t = d.telemetry(), st = window.__st(), v = st.mesh.camV, fx = Math.cos(t.heading), fz = -Math.sin(t.heading), len = Math.hypot(v[0], v[2]), dot = len ? (v[0] * fx + v[2] * fz) / len : 0;
  d.setCameraMode('eye'); window.__dstep(2); window.__warm(3); const eye = window.__st().mesh.near, shot = window.__view().url; d.setCameraMode('chase'); window.__dstep(2); window.__warm(2); const chase = window.__st().mesh.near;
  d.setInput({ throttle: 0, brake: 1, steer: 0 }); window.__dstep(90); d.setInput(null);
  return { kmh: Math.round(t.kmh), camV: v, dot: +dot.toFixed(2), eye, chase, shot }; });
save('hi-eye', mv.shot); delete mv.shot;
console.log('6 moving', JSON.stringify(mv));
check(mv.kmh > 40 && mv.dot > 0.9 && mv.eye === 2.6 && mv.chase === 0.7, `driving ${mv.kmh} km/h: the rain slants toward you (camera velocity along the car ${mv.dot}); driver's seat: no rain inside the car (near ${mv.eye} m, chase ${mv.chase} m)`);

// ---- 7 隧道裡面沒有雨 ----
const tun = await p.evaluate(() => { const L = window.__D().LOOK; L.setRain(1); window.__place(-1033.2, -150, -Math.PI / 2); for (let i = 0; i < 40; i++) { window.__dstep(1); window.__view(160, 96, false); } const a = window.__st(), sh = window.__view().url;
  window.__place(-1033.2, -330, -Math.PI / 2); for (let i = 0; i < 40; i++) { window.__dstep(1); window.__view(160, 96, false); } const b2 = window.__st(); return { in: { rain: a.rain, vis: a.mesh.vis, wetL: a.info.wetL }, out: { rain: b2.rain, vis: b2.mesh.vis, wetL: b2.info.wetL }, sh }; });
save('hi-tunnel', tun.sh); delete tun.sh;
console.log('7 tunnel', JSON.stringify(tun));
check(tun.in.rain < 0.05 && !tun.in.vis && tun.in.wetL < 0.05 && tun.out.rain > 0.95 && tun.out.vis && tun.out.wetL > 0.95, `tunnel: no rain and a dry road inside (rain ${tun.in.rain}), raining again outside (${tun.out.rain})`);

// ---- 8 超高：白天（濕路倒影）、晚上（看不到星星、大燈照到的雨） ----
await p.evaluate(async () => { const L = window.__D().LOOK; L.setRain(0); await L.set(2); });
await p.waitForFunction(() => window.__D().LOOK.level === 2 && !window.__D().LOOK.busy, null, { timeout: 300000 });
const u1 = await pair(2, 'max-day', 'dealer', 13);
{ const { d, r, pd, pr } = u1;
  check(r.st.mesh.n === 5000 && r.st.mesh.op > 0.2 && r.st.info.wetK === 1 && d.st.info.wetK === 0 && r.v.info.wet > 10 && d.v.info.wet === 0 && r.st.info.expPost === r.st.info.exp && pr.sky.S < pd.sky.S * 0.6,
    `超高 rain: ${r.st.mesh.n} raindrops, the road gets the wet reflections in the daytime too (reflection pass ${d.v.info.wet} → ${r.v.info.wet} calls), sky grayer (${pd.sky.S} → ${pr.sky.S}); exposure really used (${r.st.info.expPost} = ${r.st.info.exp})`); }
const u2 = await pair(2, 'max-hwy', 'highway', 13);
const u3 = await pair(2, 'max-night', 'dealer', 22);
{ const { d, r } = u3;
  check(d.st.info.stars > 0.5 && r.st.info.stars === 0 && r.st.info.moon === 0 && r.st.mesh.head > 0.9 && r.st.info.expPost === r.st.info.exp,
    `超高 night: stars ${d.st.info.stars} → ${r.st.info.stars} and moon → ${r.st.info.moon} behind the rain clouds; headlights light up the rain (${r.st.mesh.head}); exposure ${r.st.info.expPost}`); }
const u4 = await pair(2, 'max-dusk', 'highway', 17.6);

// ---- 9 換回普通：全部還原 ----
await p.evaluate(async () => { const L = window.__D().LOOK; L.setRain(1); window.__warm(3); await L.set(0); });
// （「換回普通跟原本一模一樣」的整張比對在 look-test；這裡看雨留下來的東西）
const back = await p.evaluate(() => { window.__warm(3); window.__view(); let rain = false; const lk = []; window.__D().TR.scene.traverse((o) => { if (o.name === 'lk-rain') rain = true; if (/^lk-/.test(o.name) && o.visible) lk.push(o.name); }); const s = window.__st(); return { rain, lk, fogFar: s.fogFar, fogNear: s.fogNear, fogC: s.fogC, exp: s.exp, r: s.rain, wetL: s.info.wetL }; });
console.log('9 back', JSON.stringify({ back, n0: n0.st.fogC }));
check(!back.rain && !back.lk.length && back.fogFar === 1500 && back.fogNear === 150 && back.fogC === n0.st.fogC && back.r === 0 && back.wetL === 0, `back to 普通 while raining: rain mesh gone (nothing of look left: ${back.lk.join(',') || 'none'}), fog back to ${back.fogNear}–${back.fogFar} m, color ${back.fogC}`);

console.log('perf', JSON.stringify(perf));
check(!errs.length, `no page errors (${errs.slice(0, 3).join(' | ')})`);
console.log(`\n${ok} ok, ${bad} failed (${el()})`);
console.log(bad ? 'SOME CHECKS FAILED' : 'ALL CHECKS OK');
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
