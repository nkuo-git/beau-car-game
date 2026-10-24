// 畫質（look.js，第 29 批）：三種畫質換來換去、⋯ → ✨ 選單、存在 carid.look、最真實的影子／草／樹葉／後製、隧道和圓塔裡面補光、
// 後照鏡、樹葉卡片跟著扁、回車庫頁車漆換回來、換回「順」什麼都回到原本的樣子、重新載入記得選的、draw calls
// 用法：node look-test.mjs ../out/look/lt   （先 node build-art.mjs --yaris）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const prefix = process.argv[2] || '../out/look/lt';
fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__THREE = THREE;'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, tripS, TR, walker, renderer, LOOK, crushFx, MIR, mirrorStep, S });'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } else if (window.__npcKeep) { NPC = window.__npcKeep; window.__npcKeep = null; NPC.g.visible = DRIVE.on; } };'
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
p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/ERR_CERT|404|GPU stall|AudioContext|ERR_TUNNEL|ERR_NAME|ERR_CONNECTION|fonts\.g|Failed to load resource/.test(t)) { errs.push(t.slice(0, 300)); console.log('console error', t.slice(0, 300)); } });
let ok = 0, bad = 0;
const check = (c, msg) => { if (c) ok++; else bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${msg}`); };
const save = (n, u) => fs.writeFileSync(`${prefix}-${n}.jpg`, Buffer.from(u.split(',')[1], 'base64'));
const SAVE = { v: 2, cur: 'gtr', scene: 'room', money: 500, owned: ['gc8', 'gtr', 'monster'], parts: {}, tyres: {}, wins: {}, cars: {}, park: { mid: 'gtr', tower: Array(40).fill(null) } };
await p.addInitScript((s) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('carid.tune', s); }, JSON.stringify(SAVE));

const ready = async () => { await p.waitForFunction(() => document.getElementById('status').hidden, null, { timeout: 300000 }); };
const goOut = async () => {
  await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
  await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk');
  return p.evaluate(() => { const W = window.__D().walker; let ok = false; for (let k = 0; k < 600 && !ok; k++) { ok = W.getIn((W.cars.find((c) => c.key === 'gtr') || W.cars[0])); if (!ok) window.__dstep(1); } for (let i = 0; i < 200 && !(window.__D().drv && W.mode === 'off'); i++) window.__dstep(1); return { ok, mode: W.mode }; });
};
const helpers = () => p.evaluate(() => {
  const D = window.__D(), R = D.renderer, THREE = window.__THREE;
  window.__view = (W = 960, H = 576, shot = true) => {
    const c = D.dcam, sz = R.getSize(new THREE.Vector2()), pr = R.getPixelRatio(), asp = c.aspect;
    R.setPixelRatio(1); R.setSize(W, H, false); c.aspect = W / H; c.updateProjectionMatrix();
    D.GAR.cull(c); R.setRenderTarget(null); R.render(D.TR.scene, c);
    const info = { calls: R.info.render.calls, tris: R.info.render.triangles }, url = shot ? R.domElement.toDataURL('image/jpeg', 0.85) : null;
    R.setSize(sz.x, sz.y, false); R.setPixelRatio(pr); c.aspect = asp; c.updateProjectionMatrix(); return { url, info };
  };
  window.__place = (x, z, h, n = 90) => { const d = D.drv; d.teleport({ x, z, heading: h }); d.setInput({ throttle: 0, brake: 1, steer: 0 }); window.__dstep(n); d.setInput(null); };
  window.__go = (w, n = 3) => { if (Array.isArray(w)) window.__place(w[0], w[1], w[2]); else if (w) { const sp = D.VIL.places[w].spawn; window.__place(sp.x, sp.z, sp.heading); } for (let i = 0; i < n; i++) window.__view(320, 192, false); return window.__view(); };
  window.__lights = () => { const sc = D.TR.scene; let dl = null, hemi = null; for (const c of sc.children) { if (!dl && c.isDirectionalLight) dl = c; if (!hemi && c.isHemisphereLight) hemi = c; }
    return { dl: +dl.intensity.toFixed(3), dlC: dl.color.getHexString(), dlCast: dl.castShadow, hemi: +hemi.intensity.toFixed(3), hemiC: hemi.color.getHexString(), env: !!sc.environment, envI: +sc.environmentIntensity.toFixed(3), fog: sc.fog && sc.fog.color.getHexString(), sky: sc.getObjectByName('sky')?.material?.type, sh: R.shadowMap.enabled, exp: R.toneMappingExposure }; };
  window.__badProgs = () => (R.info.programs || []).filter((pr) => pr.diagnostics && pr.diagnostics.runnable === false).map((pr) => pr.name || pr.cacheKey.slice(0, 40));
  window.__geoSum = () => { let s = 0, n = 0; D.VIL.group.traverse((o) => { if (!o.isMesh || !o.geometry.attributes.position) return; const a = o.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 97) s += a[i] * ((i % 7) + 1); const nn = o.geometry.attributes.normal; if (nn) { const q = nn.array; for (let i = 0; i < q.length; i += 89) s += q[i] * 3; } n++; }); return [n, +s.toFixed(1)]; };
});

// ---- 1 一開始：電腦模擬的（SwiftShader）沒選過＝順；什麼都沒改 ----
await p.goto(base, { waitUntil: 'domcontentloaded' });
await ready();
const g1 = await goOut();
console.log('1 out', el(), JSON.stringify(g1));
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; window.__npcPause(true); });
await helpers();
const s1 = await p.evaluate(() => { const D = window.__D(); return { lv: D.LOOK.level, pref: D.LOOK.pref, can: D.LOOK.can, half: D.LOOK.half, key: localStorage.getItem('carid.look'), L: window.__lights(), geo: window.__geoSum(), pressed: [...document.querySelectorAll('#lookPop button')].map((b) => b.dataset.l + ':' + b.getAttribute('aria-pressed')).join(','), mats: D.LOOK.info().mats }; });
console.log('1', JSON.stringify(s1));
check(s1.lv === 0 && s1.pref === 0 && s1.can.soft && s1.key === null && !s1.L.sh && s1.mats === 0 && s1.pressed === '2:false,1:false,0:true',
  `software GPU, never picked: starts on 順 (level 0, no shadows, no materials touched; ✨ menu shows 順 pressed: ${s1.pressed})`);
const v0 = await p.evaluate(() => window.__go('highway'));
save('0-hwy', v0.url);
console.log('  順 highway', JSON.stringify(v0.info));

// ---- 2 ⋯ → ✨ → 最真實 ----
await p.evaluate(() => { if (!document.body.classList.contains('fs')) document.getElementById('fsBtn').click(); });
await p.waitForTimeout(300);
const ui = () => p.evaluate(() => { const v = (s) => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; };
  return { tog: v('#lookTog'), pop: v('#lookPop'), btns: [...document.querySelectorAll('#lookPop button')].map((b) => b.textContent).join('/'), toast: document.getElementById('gtoast')?.textContent || '' }; });
const u0 = await ui();
await p.evaluate(() => document.getElementById('moreTog').click()); await p.waitForTimeout(100);
const u1 = await ui();
// ✨ 不壓到別的按鈕（直拿、橫拿）
const HUD = ['.dv-chip', '.dv-act', '.dv-act2', '.dv-map', '.dv-cam', '.dv-spd', '.dv-steer', '.dv-brk', '.dv-gas', '.dv-hb', '#dests', '#driveHome', '#dSndBtn', '#fsBtn', '#moreTog', '#sizeTog', '#tiltTog', '#destTog'];
const overlaps = [];
for (const [w, h] of [[844, 390], [390, 844], [360, 800], [915, 412], [800, 360]]) {
  await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(250); await p.screenshot({ path: `${prefix}-hud-${w}x${h}.png` });
  const r = await p.evaluate((HUD) => { const t = document.getElementById('lookTog'); if (!t.getClientRects().length) return ['no ✨']; const a = t.getBoundingClientRect(), out = [];
    if (a.left < 0 || a.top < 0 || a.right > innerWidth || a.bottom > innerHeight) out.push('✨ off screen');
    for (const s of HUD) for (const e of document.querySelectorAll(s)) { if (e.closest('[hidden]') || !e.getClientRects().length || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden') continue; const q = e.getBoundingClientRect(); if (a.left < q.right - 0.5 && q.left < a.right - 0.5 && a.top < q.bottom - 0.5 && q.top < a.bottom - 0.5) out.push(s); }
    return out; }, HUD);
  if (r.length) overlaps.push(`${w}x${h}: ${r.join(',')}`);
}
if (process.env.HUD_ONLY) { console.log('hud', overlaps.join(' / ') || 'ok'); await b.close(); srv.close(); process.exit(0); }
await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(250);
await p.evaluate(() => document.getElementById('lookTog').click()); await p.waitForTimeout(100);
const u2 = await ui();
check(!u0.tog && u1.tog && !u1.pop && u2.pop && !u2.tog && u2.btns === '最真實/漂亮/順', `fullscreen driving: ✨ only after ⋯; ✨ opens 「畫質 ${u2.btns}」`);
check(!overlaps.length, `✨ is on screen and covers no other button (844×390, 390×844, 360×800, 915×412, 800×360${overlaps.length ? ': ' + overlaps.join(' / ') : ''})`);
const t2 = Date.now();
await p.evaluate(() => window.__D().LOOK.setHour(13)); // 第 30 批：太陽會動（24 分鐘一天）：測試固定下午 1 點
await p.evaluate(() => [...document.querySelectorAll('#lookPop button')].find((b) => b.dataset.l === '2').click());
const toastA = (await ui()).toast;
await p.waitForFunction(() => window.__D().LOOK.level === 2 && !window.__D().LOOK.busy, null, { timeout: 120000 });
const setMs = Date.now() - t2;
await p.waitForTimeout(200);
const s2 = await p.evaluate(() => { const D = window.__D(), st = D.LOOK.stats; let leaf = 0, grass = null, cards = 0; D.TR.scene.traverse((o) => { if (/^lk-trees-/.test(o.name)) cards++; if (o.name === 'lk-grass') grass = o; });
  return { lv: D.LOOK.level, key: localStorage.getItem('carid.look'), toast: document.getElementById('gtoast')?.textContent || '', pressed: [...document.querySelectorAll('#lookPop button')].map((b) => b.dataset.l + ':' + b.getAttribute('aria-pressed')).join(','), L: window.__lights(), info: D.LOOK.info(), st: { prepMs: st.prepMs, texMs: st.texMs }, cards, grassVis: grass && grass.visible, pop: getComputedStyle(document.getElementById('lookPop')).display }; });
console.log('2', el(), `${setMs} ms`, JSON.stringify(s2));
check(s2.lv === 2 && s2.key === '2' && /最真實/.test(toastA) && /最真實/.test(s2.toast) && s2.pressed === '2:true,1:false,0:false' && s2.pop === 'none',
  `tap 最真實: level 2, saved carid.look=2, toast 「${toastA}」 → 「${s2.toast}」, menu closes (${setMs} ms; textures ${s2.st.texMs} ms, trees ${s2.st.prepMs} ms)`);
check(s2.L.sh && s2.L.dlCast && s2.L.dl === 4.6 && s2.L.env && s2.L.sky === 'ShaderMaterial' && s2.info.mats > 30 && s2.info.crowns > 1000 && s2.cards > 30 && s2.info.grass > 10000 && s2.grassVis,
  `最真實 is on: sun shadows, sky + reflections, ${s2.info.mats} materials with detail, ${s2.info.crowns} old tree crowns → ${s2.cards} leaf-card meshes, ${s2.info.grass} grass tufts`);

// ---- 3 最真實：幾個地方看起來、draw calls、沒有壞掉的 shader ----
const PLACES = { hwy: 'highway', vil: 'dealer', top: 'mountain', nh: 'neihu', tun: [-1033.2, -150, -Math.PI / 2] };
const perf2 = {};
for (const [k, w] of Object.entries(PLACES)) { const r = await p.evaluate((w) => window.__go(w), w); save('2-' + k, r.url); perf2[k] = r.info; }
console.log('3 最真實', el(), JSON.stringify(perf2));
const bad3 = await p.evaluate(() => window.__badProgs());
check(!bad3.length && !errs.length, `最真實 at highway / village / mountain top / Neihu / tunnel: every shader compiles, no errors (${bad3.join(',') || 'ok'}${errs.length ? '; ' + errs.slice(0, 2).join(' | ') : ''})`);
const shadowDiff = await p.evaluate(() => { // 車子的影子真的有畫出來：開影子／關影子，車子旁邊的地上差多少
  const D = window.__D(), R = D.renderer, sc = D.TR.scene, c = D.dcam, t = D.drv.telemetry(), p0 = c.position.clone(), q0 = c.quaternion.clone();
  window.__place(-200, 0, 0, 30); const t2 = D.drv.telemetry();
  c.position.set(t2.x + 6, 9, t2.z + 6); c.lookAt(t2.x, 0, t2.z); c.updateMatrixWorld();
  const shot = () => { const r = window.__view(240, 180); return r.url; };
  const a = shot(); R.shadowMap.enabled = false; sc.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); }); const b2 = shot(); R.shadowMap.enabled = true; sc.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
  c.position.copy(p0); c.quaternion.copy(q0); c.updateMatrixWorld(); return [a, b2];
});
const img = async (u) => p.evaluate(async (u) => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return Array.from(x.getImageData(0, 0, c.width, c.height).data); }, u);
const [pa, pb] = [await img(shadowDiff[0]), await img(shadowDiff[1])];
let darker = 0; for (let i = 0; i < pa.length; i += 4) { const la = pa[i] + pa[i + 1] + pa[i + 2], lb = pb[i] + pb[i + 1] + pb[i + 2]; if (lb - la > 45) darker++; }
save('2-shadow-on', shadowDiff[0]); save('2-shadow-off', shadowDiff[1]);
check(darker > 400, `shadows really draw: looking down at the car, ${darker} pixels are clearly darker with shadows on than off`);

// ---- 4 隧道裡面、圓塔裡面：補光 ----
const cave = await p.evaluate(() => { window.__place(-1033.2, -150, -Math.PI / 2); for (let i = 0; i < 40; i++) { window.__dstep(1); window.__view(160, 96, false); } const a = window.__lights(); window.__place(-1033.2, -330, -Math.PI / 2); for (let i = 0; i < 40; i++) { window.__dstep(1); window.__view(160, 96, false); } return [a, window.__lights()]; });
console.log('4 tunnel', JSON.stringify(cave));
check(cave[0].hemi > 1.0 && cave[0].envI > 0.35 && cave[1].hemi < 0.3 && Math.abs(cave[1].envI - 0.3) < 0.02, `tunnel: sky light fills in inside (hemi ${cave[0].hemi}, reflections ${cave[0].envI}) and goes back outside (hemi ${cave[1].hemi}, ${cave[1].envI})`);

// ---- 5 後照鏡（駕駛座視角）：最真實也照得到後面 ----
const mir = await p.evaluate(() => { const D = window.__D(), THREE = window.__THREE; window.__place(-200, 0, 0, 30); D.drv.setCameraMode('eye'); window.__dstep(1); D.mirrorStep(); D.MIR.n = 0; D.mirrorStep(); window.__view(320, 192, false);
  const M = D.MIR, W = M.rt.width, H = M.rt.height, px = new Uint16Array(W * H * 4); D.renderer.readRenderTargetPixels(M.rt, 0, 0, W, H, px); let lit = 0; for (let i = 0; i < px.length; i += 4) if (THREE.DataUtils.fromHalfFloat(px[i]) + THREE.DataUtils.fromHalfFloat(px[i + 1]) > 0.05) lit++;
  const r = { on: M.on, type: M.rt.texture.type === THREE.HalfFloatType ? 'half' : 'byte', lit: lit / (W * H), calls: M.calls }; D.drv.setCameraMode('chase'); window.__dstep(1); D.mirrorStep(); return r; });
console.log('5 mirror', JSON.stringify(mir));
check(mir.on && mir.type === 'half' && mir.lit > 0.5 && mir.calls > 20 && !(await p.evaluate(() => window.__badProgs())).length, `driver's view on 最真實: mirrors draw the road behind into a half-float picture (${(mir.lit * 100).toFixed(0)}% lit, ${mir.calls} calls)`);

// ---- 6 樹葉卡片跟著扁、長回來 ----
const tk = await p.evaluate(() => { const D = window.__D(), L = D.LOOK, V = D.VIL; let best = null;
  for (const c of V.colliders) { if (c.t !== 'circle' || c.r > 1.5) continue; const j = { tree: 1, grp: [c] }; L.treeK(j, 1); if (j.lk === null) { const j2 = { tree: 1, grp: [c] }; L.treeK(j2, 0.999); if (j2.lk && j2.lk.length) { best = { j: j2, c }; break; } } }
  if (!best) return null; const q = best.j.lk[0], E = q.m.instanceMatrix.array, o = q.i * 16, sy = () => Math.hypot(E[o + 4], E[o + 5], E[o + 6]), y0 = q.e[13];
  const s1 = Math.hypot(q.e[4], q.e[5], q.e[6]); L.treeK(best.j, 0.2); const s2 = sy(), y2 = E[o + 13]; L.treeK(best.j, 1); const s3 = sy(), y3 = E[o + 13];
  return { n: best.j.lk === null ? 'done' : best.j.lk.length, s1: +s1.toFixed(3), s2: +s2.toFixed(3), s3: +s3.toFixed(3), y0: +y0.toFixed(2), y2: +y2.toFixed(2), y3: +y3.toFixed(2), at: [best.c.x, best.c.z].map(Math.round) }; });
console.log('6 treeK', JSON.stringify(tk));
check(tk && tk.s2 < tk.s1 * 0.3 && tk.y2 < tk.y0 && Math.abs(tk.s3 - tk.s1) < 1e-3 && Math.abs(tk.y3 - tk.y0) < 1e-3, `a crushed tree's leaf cards squash down with it (height ×${tk && (tk.s2 / tk.s1).toFixed(2)}) and grow back exactly (tree at ${tk && tk.at})`);

// ---- 7 回車庫頁：車漆換回來；再出門照舊 ----
const env7 = await p.evaluate(async () => { const D = window.__D(), car = D.tripS.car; let m = null; car.traverse((o) => { if (!m && o.isMesh && o.material && o.material.isMeshPhysicalMaterial) m = o.material; });
  window.__view(320, 192, false); const during = !!m && !!m.envMap; document.getElementById('driveHome')?.click(); return { during, has: !!m }; });
await p.waitForFunction(() => !window.__D().on, null, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(800);
const env7b = await p.evaluate(() => { const D = window.__D(), envOf = (car) => { let n = 0, lk = 0; car?.traverse((o) => { if (o.isMesh && o.material) for (const m of [].concat(o.material)) { n++; if (m.envMap && m.envMap === D.TR.scene.environment) lk++; } }); return n ? (lk ? 'look' : 'own') : 'no car'; };
  return { on: D.on, trip: envOf(D.tripS?.car), page: envOf(D.S?.car), bad: window.__badProgs() }; });
console.log('7 garage page', JSON.stringify(env7), JSON.stringify(env7b));
check(env7.during && !env7b.on && env7b.trip !== 'look' && env7b.page === 'own' && !env7b.bad.length, `back on the garage page: the car paint no longer uses the outdoor sky reflection (garage car ${env7b.page}, trip car ${env7b.trip})`);
await p.evaluate(() => { window.__hold = false; window.__noDraw = false; });
const g7 = await goOut();
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; window.__npcPause(true); });
await helpers();
const lobby = await p.evaluate(() => { for (let i = 0; i < 40; i++) { window.__dstep(1); window.__view(160, 96, false); } const r = window.__view(); return { L: window.__lights(), r }; });
save('2-lobby', lobby.r.url);
check(g7.ok && lobby.L.hemi > 1.0 && lobby.L.envI > 0.35, `out again on 最真實, inside the round tower: indoor light fills in (hemi ${lobby.L.hemi}, reflections ${lobby.L.envI}; ${lobby.r.info.calls} calls)`);
const fr = await p.evaluate(() => { const D = window.__D(), st = D.LOOK.stats; window.__place(-200, 0, 0, 10); st.ms = 0; st.maxMs = 0; D.drv.setInput({ throttle: 1, brake: 0, steer: 0.15 }); for (let i = 0; i < 150; i++) { window.__dstep(1); window.__view(160, 96, false); } D.drv.setInput(null); return { ms: +st.ms.toFixed(2), max: +st.maxMs.toFixed(1) }; });
console.log('  frame JS while driving', JSON.stringify(fr));

// ---- 8 漂亮（沒有後製、沒有草）----
await p.evaluate(() => { if (!document.body.classList.contains('moreopen')) document.getElementById('moreTog').click(); }); await p.waitForTimeout(100);
await p.evaluate(() => document.getElementById('lookTog').click()); await p.waitForTimeout(100);
await p.evaluate(() => [...document.querySelectorAll('#lookPop button')].find((b) => b.dataset.l === '1').click());
await p.waitForFunction(() => window.__D().LOOK.level === 1 && !window.__D().LOOK.busy, null, { timeout: 60000 });
const perf1 = {};
for (const [k, w] of Object.entries(PLACES)) { const r = await p.evaluate((w) => window.__go(w), w); save('1-' + k, r.url); perf1[k] = r.info; }
const s8 = await p.evaluate(() => { const D = window.__D(); let grass = null; D.TR.scene.traverse((o) => { if (o.name === 'lk-grass') grass = o; }); return { key: localStorage.getItem('carid.look'), L: window.__lights(), grassVis: grass && grass.visible, toast: document.getElementById('gtoast')?.textContent || '', bad: window.__badProgs() }; });
console.log('8 漂亮', el(), JSON.stringify(perf1), JSON.stringify(s8));
check(s8.key === '1' && s8.L.sh && !s8.grassVis && /漂亮/.test(s8.toast) && !s8.bad.length && perf1.hwy.calls < perf2.hwy.calls, `漂亮: shadows + sky, no grass tufts or post-processing (highway ${perf1.hwy.calls} calls vs 最真實 ${perf2.hwy.calls}), saved carid.look=1`);

// ---- 9 順：全部回到原本的樣子 ----
await p.evaluate(() => { if (!document.body.classList.contains('moreopen')) document.getElementById('moreTog').click(); }); await p.waitForTimeout(100);
await p.evaluate(() => document.getElementById('lookTog').click()); await p.waitForTimeout(100);
await p.evaluate(() => [...document.querySelectorAll('#lookPop button')].find((b) => b.dataset.l === '0').click());
await p.waitForFunction(() => window.__D().LOOK.level === 0 && !window.__D().LOOK.busy, null, { timeout: 60000 });
const v9 = await p.evaluate(() => window.__go('highway'));
save('0b-hwy', v9.url);
const s9 = await p.evaluate(() => { const D = window.__D(); let cards = 0, grass = null, hid = 0; D.TR.scene.traverse((o) => { if (/^lk-trees-/.test(o.name) && o.visible) cards++; if (o.name === 'lk-grass') grass = o; if (o.name === 'st-shadow' && !o.visible) hid++; });
  return { key: localStorage.getItem('carid.look'), L: window.__lights(), info: D.LOOK.info(), cards, grassVis: grass && grass.visible, hid, geo: window.__geoSum() }; });
console.log('9 順', JSON.stringify(s9), JSON.stringify(v9.info));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check(s9.key === '0' && same(s9.L, s1.L) && s9.info.mats === 0 && s9.info.shad === 0 && s9.cards === 0 && !s9.grassVis && s9.hid === 0,
  `back to 順: lights, sky, fog, shadows exactly as before (${same(s9.L, s1.L) ? 'same' : JSON.stringify(s9.L) + ' vs ' + JSON.stringify(s1.L)}), no material/shadow changes left, leaf cards and grass hidden, painted shadows back`);
check(same(s9.geo, s1.geo) && Math.abs(v9.info.calls - v0.info.calls) <= 4 && Math.abs(v9.info.tris - v0.info.tris) / v0.info.tris < 0.01,
  `順 again: tree crowns and smoothed normals put back exactly (checksum ${s9.geo[1]} = ${s1.geo[1]}); highway ${v9.info.calls} calls / ${(v9.info.tris / 1e6).toFixed(2)}M (before ${v0.info.calls} / ${(v0.info.tris / 1e6).toFixed(2)}M)`);

// ---- 10 重新載入：記得選的（漂亮）----
await p.evaluate(() => localStorage.setItem('carid.look', '1'));
await p.reload({ waitUntil: 'domcontentloaded' });
await ready();
const s10 = await p.evaluate(() => { const D = window.__D(); return { lv: D.LOOK ? D.LOOK.level : null, pressed: [...document.querySelectorAll('#lookPop button')].map((b) => b.dataset.l + ':' + b.getAttribute('aria-pressed')).join(',') }; });
const g10 = await goOut();
await helpers();
const s10b = await p.evaluate(() => { const D = window.__D(); D.renderer.render(D.TR.scene, D.dcam); return { lv: D.LOOK.level, sh: D.renderer.shadowMap.enabled, bad: window.__badProgs() }; });
check(s10.lv === null && s10.pressed === '2:false,1:true,0:false' && g10.ok && s10b.lv === 1 && s10b.sh && !s10b.bad.length && !errs.length, `reload with 漂亮 saved: the game starts on 漂亮 (menu shows it) and drives out fine${errs.length ? ' — errors: ' + errs.slice(0, 2).join(' | ') : ''}`);

console.log('perf', JSON.stringify({ 順: v0.info, 最真實: perf2, 漂亮: perf1, lobby: lobby.r.info }));
console.log(`${ok} ok, ${bad} failed`);
console.log(bad ? 'SOME CHECKS FAILED' : 'ALL CHECKS OK');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
