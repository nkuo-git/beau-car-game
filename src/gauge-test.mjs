// 第 98 批（Nick 2026-11-17「去查每台車的儀表版長怎樣並把所有儀表板換成那台車的樣子…在做一個選項一樣放在選單裡可選要用現在這種儀表板還是那台車的」；
//   草稿 https://claude.ai/artifact/Kphfn8H9ekJ9PssyUJU9Ji 「儀表板」那一頁，卡片「照這樣做」）
//   每台車都有自己的儀表（cabin.js cabinHud）：轉速、時速各是哪一個（轉速表一個、時速一個）、指針順時針往上、橫條從左往右長
//   GC8 上車：預設「遊戲的」（圓的轉速表）；「⋯」→ 儀表的按鈕 →「儀表板 遊戲的／原車的」（6 種螢幕不壓到別的按鈕）→ 原車的（存 carid.gauge）
//   → 下面中間換成 GC8 真的儀表（canvas 有畫東西）→ 給油：指針動、熄火：暗下來 → 6 種螢幕都放得下、不壓到別的按鈕（「⋯」打開、🚓 不抓也一樣）
//   → 駕駛座視角只有時速（跟以前一樣）→ 沒全螢幕的小畫面用圓的 → 換回遊戲的 → 重新載入記得
//   → 每台車的儀表畫一張（-all.png）、畫一次多少毫秒 → 駕駛座的錶：GC8 指針、FK 橫條（cabin-fill）
// node gauge-test.mjs [prefix]（截圖：<prefix>-*.png；沒給＝../out/gauge/gg）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = '../out/gauge/gg'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__G = () => GAME; window.__CARS = () => CARS; window.__CH = (k) => cabinHud(k); window.__LC = (k) => loadCar(k);'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, tripS, cur, walker, gaugeK });'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } else if (window.__npcKeep) { NPC = window.__npcKeep; window.__npcKeep = null; NPC.g.visible = DRIVE.on; } };'
  + ' window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };'
  + ' window.__wstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return walker && walker.telemetry(); };'
  + ' window.__toast = () => { const e = document.getElementById("gtoast") || document.querySelector(".gtoast"); return e && e.textContent; };';
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') {
    let html = fs.readFileSync(path.join(dir, 'art/garage.html'), 'utf8').replaceAll('https://cdn.jsdelivr.net/npm/three@0.186.1/', '/three/');
    const a = 'const RACE = { on: false, frame: raceFrame };', d1 = '  driveStep(dt);\n  if (!DRIVE.on) return;', d2 = '  renderer.render(TR.scene, dcam);\n}';
    for (const x of [a, d1, d2]) if (html.split(x).length !== 2) throw new Error('hook anchor missing or not unique: ' + x);
    html = html.replace(a, `${a} ${hook}`).replace(d1, '  if (!window.__hold) driveStep(dt);\n  if (!DRIVE.on) return;')
      .replace(d2, '  if (!window.__noDraw) { renderer.render(TR.scene, dcam); window.__dframes = (window.__dframes || 0) + 1; }\n}')
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
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 500, owned: ['gc8'], parts: {}, tyres: {}, wins: {}, cars: {} }));
  localStorage.setItem('carid.tune.full', 'on');
});
await p.addInitScript(() => {
  const H = (window.__H = {}), W = () => window.__D().walker, step = (n = 1) => window.__wstep(n);
  const vis = (e) => !!e && !e.hidden && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getClientRects().length > 0;
  H.vis = (sel) => vis(document.querySelector(sel));
  H.board = (maxS = 10) => { const w = W(), modes = []; let n = 0; for (; n < maxS * 60; n++) { step(1); modes.push(w.mode); if (w.mode === 'off' && window.__D().drv) break; } return [...new Set(modes)]; };
  H.getIn = () => { const D = window.__D(), w = D.walker; let ok = false; for (let k = 0; k < 600 && !ok; k++) { ok = w.getIn(w.cars.find((c) => c.object === D.tripS.car)); if (!ok) step(1); } return { ok, modes: H.board() }; };
  H.start = () => { const d = window.__D().drv; d.setInput({ throttle: 1, brake: 1 }); window.__dstep(3); d.setInput({ throttle: 0, brake: 1 }); window.__dstep(80); d.setInput(null); window.__dstep(5); return d.engine; };
  // 下面中間那一格：class、canvas 的大小、畫了多少（不透明的點的比例）、一個簡單的雜湊（變了沒）
  H.cg = () => {
    const box = document.querySelector('#stage .dv-spd'), c = box.querySelector('canvas.dv-cg'), r = c.getBoundingClientRect(), rb = box.getBoundingClientRect();
    let ink = 0, hash = 0;
    if (c.width > 1 && c.height > 1) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) { ink++; hash = (hash * 31 + d[i - 3] * 7 + d[i - 2] * 3 + d[i - 1] + (i >> 2)) >>> 0; } ink /= c.width * c.height; }
    return { carg: box.classList.contains('carg'), tach: box.classList.contains('tach'), rootCarg: document.querySelector('#stage .dv').classList.contains('carg'), cw: c.width, ch: c.height, w: Math.round(r.width), h: Math.round(r.height), vis: vis(c), box: [rb.left, rb.top, rb.right, rb.bottom].map(Math.round), ink: +ink.toFixed(3), hash, gauge: window.__D().drv.gauge, rootH: document.querySelector('#stage .dv').clientHeight };
  };
});

await p.goto(base, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => document.getElementById('status').hidden, null, { timeout: 300000 });
console.log('0', el(), 'page ready');
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk');
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; window.__npcPause(true); });

// ---- 1 每台車都有自己的儀表：轉速、時速各一個；指針順時針往上、橫條從左往右長 ----
const all1 = await p.evaluate(() => {
  const keys = Object.keys(window.__CARS()), out = [];
  for (const k of keys) {
    const G = window.__CH(k); if (!G) { out.push({ k, none: true }); continue; }
    const P = G.parts, tach = P.filter((x) => x.k === 'tach'), spdNeedle = P.filter((x) => x.k === 'speed'), digits = P.filter((x) => x.t === 'digits');
    const cw = P.filter((x) => (x.t === 'needle' || x.t === 'arc') && !(x.a1 > x.a0)), bars = P.filter((x) => x.t === 'bar'), barBad = bars.filter((x) => !(x.len > 0));
    out.push({ k, aspect: +G.aspect.toFixed(2), tach: tach.length, speed: spdNeedle.length + digits.length, kinds: [...new Set(P.map((x) => x.t))].join('+'), ccw: cw.length, barBad: barBad.length, redOk: tach.every((x) => x.red > 0 && x.red <= x.max) });
  }
  return out;
});
console.log('1', el(), JSON.stringify(all1));
const bikes = new Set(['mtb', 'road']);
check(all1.every((x) => !x.none), `every car (${all1.length}) has its own cluster (cabinHud): ${all1.filter((x) => x.none).map((x) => x.k).join(' ') || 'none missing'}`);
check(all1.every((x) => (bikes.has(x.k) ? x.tach === 0 : x.tach === 1) && x.speed === 1 && x.redOk), `rpm and speed: one tach (red line inside its scale) and one speed reading per car; bicycles only speed (${all1.filter((x) => !((bikes.has(x.k) ? x.tach === 0 : x.tach === 1) && x.speed === 1 && x.redOk)).map((x) => `${x.k} t${x.tach} s${x.speed}`).join(' ') || 'all ok'})`);
check(all1.every((x) => !x.ccw && !x.barBad), `needles and arcs turn clockwise (left → up → right) and rpm bars grow left to right (${all1.filter((x) => x.ccw || x.barBad).map((x) => x.k).join(' ') || 'all'})`);

// ---- 2 GC8 上車、發動：預設「遊戲的」（圓的轉速表），「⋯」收著的時候看不到儀表的按鈕 ----
const in2 = await p.evaluate(() => { const r = window.__H.getIn(), eng = window.__H.start(); window.__dstep(35); return { ...r, eng, gk: window.__D().gaugeK, saved: localStorage.getItem('carid.gauge'), cg: window.__H.cg(), tog: window.__H.vis('#gaugeTog'), pop: window.__H.vis('#gaugePop') }; });
console.log('2', el(), JSON.stringify(in2));
check(in2.ok && in2.modes.join('>').endsWith('seat>off') && in2.eng, `got into the GC8 and started it`);
check(in2.gk === 'game' && in2.saved === null && in2.cg.tach && !in2.cg.carg && !in2.cg.vis && in2.cg.gauge === null && !in2.tog && !in2.pop, `default is 「遊戲的」 (nothing saved): the round tach, no car cluster; the gauge button hides while ⋯ is folded`);
const riGame = await shot('2-game');

// ---- 3 「⋯」→ 儀表的按鈕 →「儀表板 遊戲的／原車的」；6 種螢幕不壓到 ----
const HUD_SEL = ['.elpanel', '.dv-chip', '.dv-act', '.dv-act2', '.dv-map', '.dv-cam', '.dv-spd', '.dv-steer', '.dv-brk', '.dv-gas', '.dv-hb', '.dv-pop', '.dv-shf', '.dv-off', '#dests', '#destTog', '#moreTog', '#sizeTog', '#tiltTog', '#lookTog', '#musTog', '#gearTog', '#gaugeTog', '#copTog', '#gaugePop', '#dSndBtn', '#fsBtn'];
const clash = (edge = true) => p.evaluate(([S, edge]) => { // edge：也看有沒有跑出螢幕（沒全螢幕的時候頁面會捲，不看）
  const R = S.map((s) => [s, document.querySelector(s)]).filter(([, e]) => e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getClientRects().length).map(([s, e]) => [s, e.getBoundingClientRect()]), out = [];
  if (edge) for (const [s, r] of R) if (r.left < 4 || r.top < 4 || r.right > innerWidth - 4 || r.bottom > innerHeight - 4) out.push(`${s} off-screen ${[r.left, r.top, r.right, r.bottom].map(Math.round)}`);
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const a = R[i][1], b2 = R[j][1]; if (a.left < b2.right - 0.5 && b2.left < a.right - 0.5 && a.top < b2.bottom - 0.5 && b2.top < a.bottom - 0.5) out.push(`${R[i][0]} × ${R[j][0]}`); }
  return out.join(', ');
}, [HUD_SEL, edge]);
const SIZES = [[390, 844], [360, 800], [412, 915], [915, 412], [800, 360], [731, 338]];
// 每種螢幕：等 cgTick 重新量（0.5 秒一次），看壓到沒、原車的儀表有沒有畫出來
async function sweep(tag, shots = []) {
  const bad = [], cg = [];
  for (const [w, h] of SIZES) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(150);
    const c = await p.evaluate(() => { window.__dstep(34); return window.__H.cg(); }); cg.push({ w, h, ...c });
    const s = await clash(); if (s) { bad.push(`${w}x${h}: ${s}`); console.log('  clash', w, h, s); }
    if (shots.includes(w)) await shot(`${tag}-${w}x${h}`);
  }
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(150); await p.evaluate(() => window.__dstep(34));
  return { bad, cg };
}
const more = (on) => p.evaluate((on) => { if (document.body.classList.contains('moreopen') !== on) document.getElementById('moreTog').click(); }, on).then(() => p.waitForTimeout(100));
await more(true);
const row3 = await p.evaluate(() => ({ tog: window.__H.vis('#gaugeTog'), label: document.getElementById('gaugeTog').getAttribute('aria-label') }));
await p.evaluate(() => document.getElementById('gaugeTog').click()); await p.waitForTimeout(100);
const pop3 = await p.evaluate(() => ({ open: document.body.classList.contains('gaugeopen'), pop: window.__H.vis('#gaugePop'), text: document.getElementById('gaugePop').textContent, pressed: [...document.querySelectorAll('#gaugePop button')].map((x) => `${x.textContent}:${x.getAttribute('aria-pressed')}`), cam: window.__H.vis('#stage .dv-cam'), snd: window.__H.vis('#dSndBtn') }));
console.log('3', el(), JSON.stringify({ row3, pop3 }));
check(row3.tog && /儀表板/.test(row3.label), `⋯ open: the gauge button is in the row (「${row3.label}」)`);
check(pop3.open && pop3.pop && pop3.text === '儀表板遊戲的原車的' && pop3.pressed.join(' ') === '遊戲的:true 原車的:false', `tapping it opens 「儀表板 遊戲的／原車的」 with 遊戲的 picked (${pop3.pressed.join(' ')})`);
let sw = await sweep('3-pop', [390, 731]);
check(!sw.bad.length, `「儀表板」 choices open: nothing overlapping or off the screen on 6 screens (${sw.bad.join(' | ') || 'ok'})`);

// ---- 4 選「原車的」：存起來、下面中間換成 GC8 真的儀表 ----
const pick4 = await p.evaluate(() => { [...document.querySelectorAll('#gaugePop button')].find((x) => x.dataset.g === 'car').click(); window.__dstep(3); const t = window.__toast(); window.__dstep(35); return { t, saved: localStorage.getItem('carid.gauge'), gk: window.__D().gaugeK, open: document.body.classList.contains('gaugeopen'), more: document.body.classList.contains('moreopen'), cg: window.__H.cg() }; });
console.log('4', el(), JSON.stringify(pick4));
check(pick4.saved === 'car' && pick4.gk === 'car' && !pick4.open && /原車的/.test(pick4.t), `picked 「原車的」: saved on the phone (carid.gauge = car), the choices close, toast 「${pick4.t}」`);
await more(false);
const cg4 = await p.evaluate(() => window.__H.cg());
check(cg4.carg && cg4.rootCarg && !cg4.tach && cg4.gauge === 'gc8' && cg4.vis && cg4.cw === cg4.w && cg4.ch === cg4.h && cg4.w >= 180 && cg4.h >= 60 && cg4.ink > 0.3, `bottom middle is now the GC8's own cluster (${cg4.w}×${cg4.h}, ${Math.round(cg4.ink * 100)}% drawn)`);
const riCar = await shot('4-car-390');
await p.evaluate(() => window.__D().drv.setGauge(null)); const riGame4 = await shot('4-game-390'); // 同一個畫面換回圓的：draw calls 一樣（儀表是 2D canvas，不是 3D）
await p.evaluate(() => { window.__D().drv.setGauge(window.__CH('gc8')); window.__dstep(2); });

// ---- 5 給油：指針動、熄火：暗下來 ----
const run5 = await p.evaluate(() => {
  const d = window.__D().drv, H = window.__H, c0 = H.cg(); d.setInput({ throttle: 1, brake: 0 }); window.__dstep(90); const t = d.telemetry(), c1 = H.cg();
  d.setInput({ throttle: 0, brake: 1 }); window.__dstep(150); d.setInput(null); window.__dstep(5); const c2 = H.cg();
  d.stopEngine(); window.__dstep(40); const c3 = H.cg(), off = !d.engine;
  const dim = (() => { const c = document.querySelector('#stage .dv-cg'), D = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0, n = 0; for (let i = 0; i < D.length; i += 4) if (D[i + 3] > 40) { s += D[i] + D[i + 1] + D[i + 2]; n++; } return n ? s / n : 0; })();
  H.start(); window.__dstep(35); const c4 = H.cg();
  const bright = (() => { const c = document.querySelector('#stage .dv-cg'), D = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0, n = 0; for (let i = 0; i < D.length; i += 4) if (D[i + 3] > 40) { s += D[i] + D[i + 1] + D[i + 2]; n++; } return n ? s / n : 0; })();
  return { kmh: +t.kmh.toFixed(0), rpm: +t.rpm.toFixed(2), moved: c1.hash !== c0.hash, back: c2.hash !== c1.hash, off, offHash: c3.hash !== c2.hash, dim: Math.round(dim), bright: Math.round(bright), carg3: c3.carg, carg4: c4.carg, engine: d.engine };
});
console.log('5', el(), JSON.stringify(run5));
check(run5.kmh > 30 && run5.moved && run5.back, `full throttle (${run5.kmh} km/h, rpm ${run5.rpm}): the cluster redraws (needles move), and again when you stop`);
check(run5.off && run5.offHash && run5.carg3 && run5.dim < run5.bright * 0.75 && run5.engine && run5.carg4, `engine off: the cluster stays but goes dark (brightness ${run5.dim} vs ${run5.bright} running); started again it lights up`);

// ---- 6 6 種螢幕都放得下、不壓到；「⋯」打開、🚓 不抓也一樣 ----
sw = await sweep('6-car', [390, 800, 731]);
const notFit = sw.cg.filter((c) => !(c.carg && c.vis && c.cw === c.w && c.ch === c.h && c.h >= 56 && c.w >= 150 && c.ink > 0.3));
console.log('6', el(), JSON.stringify(sw.cg.map((c) => `${c.w}x${c.h}:${c.carg ? 'car' : 'round'} ${c.box} ${Math.round(c.ink * 100)}%`)));
check(!notFit.length, `the car's cluster shows on all 6 full-screen phones (${sw.cg.map((c) => `${c.w}x${c.h} → ${c.box[2] - c.box[0]}×${c.box[3] - c.box[1]}`).join(', ')})`);
check(!sw.bad.length, `with the car's cluster nothing overlaps or leaves the screen on 6 screens (${sw.bad.join(' | ') || 'ok'})`);
await more(true);
sw = await sweep('6-more', [731]);
check(!sw.bad.length, `⋯ row open (gauge button, 🚓, 下車): nothing overlapping on 6 screens (${sw.bad.join(' | ') || 'ok'})`);
const cop = await p.evaluate(() => { document.getElementById('copTog').click(); return document.getElementById('copTog').textContent; });
sw = await sweep('6-nocops', [731]);
await p.setViewportSize({ width: 731, height: 338 }); await p.waitForTimeout(150);
const a2 = await p.evaluate(() => { window.__dstep(2); const e = document.querySelector('#stage .dv-act2'), t = e.querySelector('span'); return { text: t.textContent, lines: Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).fontSize)), left: Math.round(e.getBoundingClientRect().left), vis: !e.hidden }; });
await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(150);
check(a2.vis && a2.text === '下車' && a2.lines === 1 && a2.left >= 4, `731×338 with ⋯ open and 「🚓 不抓」: 「下車」 stays on one line at the left (${a2.lines} line, x ${a2.left})`);
await p.evaluate(() => document.getElementById('copTog').click());
await more(false);
check(/不抓/.test(cop) && !sw.bad.length, `⋯ row open with 「${cop.trim()}」 (wider): nothing overlapping on 6 screens (${sw.bad.join(' | ') || 'ok'})`);

// 「去哪裡」打開：清單從「去哪裡」往上排，儀表先藏起來（跟換檔桿一樣）
const dest6 = await p.evaluate(() => { document.getElementById('destTog').click(); const a = { open: document.body.classList.contains('destsopen'), vis: getComputedStyle(document.querySelector('#stage .dv-spd')).visibility }; document.getElementById('destTog').click(); return { ...a, back: getComputedStyle(document.querySelector('#stage .dv-spd')).visibility }; });
check(dest6.open && dest6.vis === 'hidden' && dest6.back === 'visible', `「去哪裡」 open: the cluster hides under the list (${dest6.vis}), and comes back when it closes`);

// ---- 7 駕駛座視角只有時速（跟以前一樣）；回追車又是原車的 ----
const eye7 = await p.evaluate(() => { const d = window.__D().drv; d.setCameraMode('eye'); window.__dstep(35); const a = window.__H.cg(); d.setCameraMode('chase'); window.__dstep(35); return { eye: a, back: window.__H.cg() }; });
console.log('7', el(), JSON.stringify({ eye: { carg: eye7.eye.carg, tach: eye7.eye.tach, vis: eye7.eye.vis }, back: eye7.back.carg }));
check(!eye7.eye.carg && !eye7.eye.tach && !eye7.eye.vis && eye7.back.carg, `driver's-seat view: just the speed number as before (the real dials are in the cabin); back to the chase view: the car's cluster again`);

// ---- 8 沒全螢幕：放得下（舞台夠高）照樣是原車的、放不下（小舞台）用圓的；都不壓到別的按鈕；回全螢幕又是原車的 ----
await p.evaluate(() => { window.caridExitFullscreen(); });
const fs8 = [];
for (const [w, h] of [[390, 844], [1000, 700], [426, 320]]) {
  await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(150);
  const c = await p.evaluate(() => { window.__dstep(34); const c = window.__H.cg(), land = matchMedia('(max-height:560px)').matches; return { ...c, fits: land ? c.rootH > 300 : c.rootH >= 541, fs: document.body.classList.contains('fs') }; });
  const s = await clash(false); fs8.push({ w, h, rootH: c.rootH, fits: c.fits, carg: c.carg, tach: c.tach, fs: c.fs, s });
  if (w === 426) await shot(`8-small-${w}x${h}`);
}
await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(150);
const fsBack = await p.evaluate(() => { document.getElementById('fsBtn').click(); window.__dstep(35); return { fs: document.body.classList.contains('fs'), carg: window.__H.cg().carg }; });
console.log('8', el(), JSON.stringify({ fs8, fsBack }));
check(fs8.every((x) => !x.fs && x.carg === x.fits && x.tach === !x.fits) && fs8.some((x) => x.carg) && fs8.some((x) => x.tach), `not full screen: the car's cluster where the stage is tall enough, the round tach where it isn't (${fs8.map((x) => `${x.w}x${x.h} stage ${x.rootH} → ${x.carg ? 'car' : 'round'}`).join(', ')})`);
check(fs8.every((x) => !x.carg || !x.s), `not full screen, where the car's cluster shows: nothing overlapping (${fs8.filter((x) => x.carg).map((x) => `${x.w}x${x.h}: ${x.s || 'ok'}`).join(' | ')}; the round-tach stages are the old screen as it was)`);
check(fsBack.fs && fsBack.carg, `full screen again: the car's cluster`);

// ---- 9 換回「遊戲的」 ----
const back9 = await p.evaluate(() => { document.getElementById('moreTog').click(); document.getElementById('gaugeTog').click(); [...document.querySelectorAll('#gaugePop button')].find((x) => x.dataset.g === 'game').click(); window.__dstep(3); const t = window.__toast(); window.__dstep(35); if (document.body.classList.contains('moreopen')) document.getElementById('moreTog').click(); return { t, saved: localStorage.getItem('carid.gauge'), cg: window.__H.cg() }; });
console.log('9', el(), JSON.stringify({ ...back9, cg: { carg: back9.cg.carg, tach: back9.cg.tach, gauge: back9.cg.gauge } }));
check(back9.saved === 'game' && back9.cg.tach && !back9.cg.carg && back9.cg.gauge === null && /遊戲的/.test(back9.t), `back to 「遊戲的」: the round tach (saved game)`);

// ---- 10 每台車的儀表畫一張；畫一次多少毫秒 ----
await p.setViewportSize({ width: 1240, height: 1000 });
const all10 = await p.evaluate(() => {
  const keys = Object.keys(window.__CARS()), wrap = document.createElement('div'); wrap.id = '__all';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#3a3f47;display:grid;grid-template-columns:repeat(5,236px);gap:8px 8px;padding:10px;align-content:start;font:12px Arial;color:#ddd';
  const out = [];
  for (const [i, k] of keys.entries()) {
    const G = window.__CH(k), c = document.createElement('canvas'); c.width = 236; c.height = 92;
    const cell = document.createElement('div'), lab = document.createElement('div'); lab.textContent = `${k} · ${window.__CARS()[k].btn[0]}`; cell.append(c, lab); wrap.append(cell);
    if (!G) continue;
    const s = { rpm: 0.35 + 0.025 * i, kmh: 40 + 9 * i, gear: String(1 + (i % 6)), off: false, hp: 120 + i * 20 }, g = c.getContext('2d');
    const t0 = performance.now(); for (let n = 0; n < 30; n++) { s.rpm += 0.0005; G.draw(g, c.width, c.height, s); } const ms = (performance.now() - t0) / 30;
    const D = g.getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let j = 3; j < D.length; j += 4) if (D[j] > 40) ink++;
    out.push({ k, ms: +ms.toFixed(3), ink: +(ink / (c.width * c.height)).toFixed(2) });
  }
  document.body.append(wrap); return out;
});
await p.screenshot({ path: `${prefix}-all.png` }); console.log('  shot', `${prefix}-all.png`);
await p.evaluate(() => document.getElementById('__all').remove());
await p.setViewportSize({ width: 390, height: 844 });
const worst = all10.reduce((a, x) => (x.ms > a.ms ? x : a), all10[0]), empty = all10.filter((x) => x.ink < 0.25);
console.log('10', el(), JSON.stringify(all10));
check(!empty.length && all10.length === all1.length, `every car's cluster draws (${all10.length} cars; least filled ${Math.min(...all10.map((x) => x.ink))}): ${prefix}-all.png`);
check(worst.ms < 2, `one redraw costs at most ${worst.ms} ms (${worst.k}); it only redraws when rpm/speed/gear change`);

// ---- 11 駕駛座的錶也照真的車：GC8 指針（時速、轉速）、FK 數位（橫條＋數字） ----
const cab11 = await p.evaluate(async () => {
  const cab = window.__D().tripS.cabin, nd = cab.getObjectByName('cabin-needles'), P = nd.geometry.attributes.position.array;
  cab.userData.setGauges(0.1, 10); const a = P.slice(0, 12).join(','); cab.userData.setGauges(0.8, 150); const b2 = P.slice(0, 12).join(',');
  const fk = await window.__LC('civic'), fc = fk.cabin, fill = fc.getObjectByName('cabin-fill'), dig = fc.getObjectByName('cabin-digits'), fp = fill?.geometry.attributes.position.array;
  fc.userData.setGauges(0.2, 30); const w1 = fp ? Math.abs(fp[6] - fp[0]) + Math.abs(fp[7] - fp[1]) + Math.abs(fp[8] - fp[2]) : 0;
  fc.userData.setGauges(0.9, 160); const w2 = fp ? Math.abs(fp[6] - fp[0]) + Math.abs(fp[7] - fp[1]) + Math.abs(fp[8] - fp[2]) : 0;
  return { gc8: P.length / 12, moved: a !== b2, fill: !!fill, dig: !!dig, w1: +w1.toFixed(4), w2: +w2.toFixed(4) };
});
console.log('11', el(), JSON.stringify(cab11));
check(cab11.gc8 >= 2 && cab11.moved, `GC8 cockpit: ${cab11.gc8} needles (speedometer, tach) and they turn`);
check(cab11.fill && cab11.dig && cab11.w2 > cab11.w1 * 2.5, `FK cockpit: digital screen with a speed number and an rpm bar that grows left to right (${cab11.w1} → ${cab11.w2} m)`);

// ---- 12 重新載入：記得「原車的」 ----
await p.evaluate(() => localStorage.setItem('carid.gauge', 'car'));
await p.goto(base, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => document.getElementById('status').hidden, null, { timeout: 300000 });
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk');
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; window.__npcPause(true); });
const re12 = await p.evaluate(() => { const r = window.__H.getIn(); window.__dstep(35); return { ok: r.ok, gk: window.__D().gaugeK, pressed: [...document.querySelectorAll('#gaugePop button')].map((x) => `${x.textContent}:${x.getAttribute('aria-pressed')}`).join(' '), cg: window.__H.cg() }; });
console.log('12', el(), JSON.stringify({ ...re12, cg: { carg: re12.cg.carg, ink: re12.cg.ink, gauge: re12.cg.gauge } }));
check(re12.ok && re12.gk === 'car' && re12.pressed === '遊戲的:false 原車的:true' && re12.cg.carg && re12.cg.gauge === 'gc8' && re12.cg.ink > 0.3, `reloaded: still 「原車的」; getting in shows the GC8's cluster (engine off: dark)`);
const riOff = await shot('12-reload-off');
console.log('draw calls:', JSON.stringify({ game: riGame, car: riCar, game4: riGame4, off: riOff }));
check(riCar.calls === riGame4.calls && riCar.tris === riGame4.tris, `the cluster is a 2D canvas over the game, not 3D: same frame ${riGame4.calls} draw calls with the round tach, ${riCar.calls} with the car's cluster`);
check(!errs.length, `no page errors (${errs.length})`);
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS OK', el());
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
