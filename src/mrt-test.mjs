// 第 78 批（Nick 2026-11-08「內湖的捷運站要從地面建起 要有正反方向的捷運開來開去 要真的可以搭…要可以自己走進捷運站並等車 每過一段時間來一班車」）：捷運站
// 瀏覽器（SwiftShader）：港墘站、文德站蓋好（三層）、街上的柱子和樓梯都不在車道上、時刻（兩個方向、90 秒一班、停 15 秒）；
//   走上出口 1 的樓梯（高度 0 → 6、換成大廳那一層的碰撞）→ 天橋 → 大廳 → 走過閘門（嗶）→ 斜坡上月台（12.6）→ 月台的牌子；
//   時間跳到往文德的車快到：叮咚、車停好、門開（車門、月台門一起）→ 走進車廂 → 門關了＝上車了、跟著車走 → 「下一站 文德」→ 到了（終點站）→「下車」在月台上 →
//   走下斜坡、過閘門、天橋、出口 2 的樓梯回到街上（碰撞換回來）；車還停在港墘；截圖（街上、大廳、月台、車上、晚上）＋draw calls
// 第 87 批 11：捷運站裡的小動物（大廳、月台、走路不穿牆、擋人、上車坐車到文德下車、從隧道來的下車、看得到）；列車的 key 過 180 秒不換
// node mrt-test.mjs [../out/mrt/mt]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const fails = [];
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const r1 = (x) => +(+x).toFixed(1);

const pw = (await import('/opt/node22/lib/node_modules/playwright/index.js')).default;
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = '../out/mrt/mt'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__G = () => GAME;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, tripS, cur, built, walker, LOOK, MRTS, NPC, trip, indoor, M: VIL && VIL.mrt, leaveCar, tripPose });'
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
const p = await b.newPage({ viewport: { width: 960, height: 576 }, deviceScaleFactor: 1 });
p.setDefaultTimeout(300000);
const errs = [];
p.on('pageerror', (e) => { errs.push(e.message); console.log('pageerror', e.message); });
p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_CERT|404|GPU stall|AudioContext|ScriptProcessorNode|worklet|ERR_TUNNEL|ERR_NAME|ERR_CONNECTION|fonts\.g|車道盡頭|KHR_parallel/.test(m.text())) console.log('console', m.type(), m.text().slice(0, 240)); });
const T0 = Date.now(), el = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`;
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
  localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 500, owned: ['gc8'], parts: {}, tyres: {}, wins: {}, cars: {}, park: { mid: 'gc8', tower: Array(40).fill(null) } }));
  localStorage.setItem('carid.look', '1'); // 高：牌子晚上會亮
});
await p.goto(base, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => document.getElementById('status').hidden, null, { timeout: 300000 });
await p.waitForFunction(() => window.__D().built.gc8?.car, null, { timeout: 120000 });
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk');
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; window.__npcPause(true); const D = window.__D(); D.LOOK?.setHour?.(13); D.LOOK?.setRain?.(0); });
console.log('0', el(), 'out on foot');

// ---- 1 蓋好了：兩個站、三層、時刻、街上的柱子不在車道上 ----
console.log('== 1 站蓋好了 ==');
const info = await p.evaluate(() => { const D = window.__D(), M = D.M; if (!M) return null; const NH = D.VIL.neihu;
  const onRoad = M.street.map((c) => { const r = NH.roadAt(c.x, c.z); if (!(r && r.d < r.w / 2 - 0.05)) return null; const si = M.at(c.x, c.z), [u, v] = si >= 0 ? M.loc(si, c.x, c.z) : [null, null]; return { x: +c.x.toFixed(1), z: +c.z.toFixed(1), d: +r.d.toFixed(1), w: r.w, nm: r.nm, si, u: u == null ? null : +u.toFixed(1), v: v == null ? null : +v.toFixed(1), hx: +c.hx.toFixed(2), hz: +c.hz.toFixed(2) }; }).filter(Boolean);
  return { info: M.info, YT: M.YT, YP: M.YP, YC: M.YC, st: M.stations.map((s) => ({ nm: s.nm, en: s.en, s: +s.s.toFixed(1), x: +s.x.toFixed(1), z: +s.z.toFixed(1), rot: +s.rot.toFixed(3), ent: s.ent.map((e) => ({ n: e.n, s: e.s, dir: e.dir, u0: e.u0, uS: e.uS, u1: e.u1, v0: e.v0, v1: e.v1, bu0: e.bu0, bu1: e.bu1 })), gates: s.gates, cols1: s.cols[1].length, cols2: s.cols[2].length })), street: M.street.length, onRoad }; });
console.log('1', el(), JSON.stringify(info));
check(!!info, 'VIL.mrt built (buildMrt returned the station API)');
if (!info) { await b.close(); srv.close(); console.log('\n1 FAIL'); process.exit(1); }
const I = info.info, ST = info.st;
check(I.stations.join('/') === '港墘/文德' && ST[0].nm === '港墘' && ST[1].nm === '文德' && ST[1].s > ST[0].s + 900, `two stations on the Wenhu line: ${ST.map((s) => `${s.nm} s=${s.s}`).join(', ')} (文德 is ${r1(ST[1].s - ST[0].s)} m east)`);
check(info.YT === 11.5 && info.YP === 12.6 && info.YC === 6 && I.meshes >= 10 && I.tris > 15000 && I.tris < 80000, `three levels: street 0, concourse ${info.YC}, platform ${info.YP} (track ${info.YT}); ${I.meshes} meshes, ${I.tris} triangles, built in ${I.ms} ms`);
check(I.T === 180 && I.H === 90 && I.dwell === 15 && I.dirs.length === 2 && I.dirs.every((d) => d.dwells.length === 2 && d.dwells.every((w) => Math.abs(w.t1 - w.t0 - 15) < 0.01)) && I.maxTrains === 4,
  `timetable: both directions, a train every ${I.H} s (cycle ${I.T}), dwell ${I.dwell} s at both stations, up to ${I.maxTrains} trains at once (dir +1 phase ${I.dirs[0].phase}, dir −1 phase ${I.dirs[1].phase})`);
check(ST.every((s) => s.ent.length === 2 && s.cols1 > 20 && s.cols2 > 20) && ST[0].gates.length === 1 && ST[1].gates.length === 2, `each station has 2 entrances and colliders for the concourse (${ST.map((s) => s.cols1).join('/')}) and platform (${ST.map((s) => s.cols2).join('/')}); gates ${ST.map((s) => s.gates.join('+')).join(', ')}`);
check(info.street >= 20 && info.onRoad.length === 0, `${info.street} street colliders (columns, stair walls), none on a carriageway (${info.onRoad.length ? JSON.stringify(info.onRoad) : 'ok'})`);

// 上車，開到港墘站旁邊（街上看）；再下車
await p.evaluate(() => { const W = window.__D().walker; let ok = false; for (let k = 0; k < 600 && !ok; k++) { ok = W.getIn(W.cars.find((c) => c.key === 'gc8')); if (!ok) window.__wstep(1); } for (let n = 0; n < 1200 && !(window.__D().drv && W.mode === 'off'); n++) window.__wstep(1); });
const pos = (u, v, si = 0) => p.evaluate(([u, v, si]) => { const M = window.__D().M, S = M.stations[si], [x, z] = S.toW(u, v); return { x, z, h: S.rot }; }, [u, v, si]);
let q = await pos(-75, -9); await p.evaluate((q) => { const D = window.__D(); D.drv.teleport({ x: q.x, z: q.z, heading: q.h }); window.__dstep(40); }, q);
const s1 = await shot('1-street-west');
q = await pos(60, 12); await p.evaluate((q) => { const D = window.__D(); D.drv.teleport({ x: q.x, z: q.z, heading: q.h + Math.PI }); window.__dstep(40); }, q);
const s1b = await shot('1-street-east');
check(s1.calls > 60 && s1.calls < 400 && s1b.calls > 60 && s1b.calls < 400, `street view draw calls: west ${s1.calls} / ${s1.tris} tris, east ${s1b.calls} / ${s1b.tris} tris (高)`);
const out = await p.evaluate(() => { const D = window.__D(); for (let i = 0; i < 900 && Math.abs(D.drv.telemetry().v) > 0.3; i++) { D.drv.setInput({ brake: 1 }); window.__dstep(1); } D.drv.setInput({ brake: 0 }); window.__dstep(5); D.leaveCar(); for (let i = 0; i < 400 && !(D.walker.mode === 'walk'); i++) window.__wstep(1);
  const D2 = window.__D(); window.__T = []; const W = D2.walker, orig = W.toast; W.toast = (s, ms) => { window.__T.push(s); return orig.call(W, s, ms); }; // 記下所有跳出來的字
  return { mode: D2.walker.mode, lvl: D2.MRTS.lvl, car: D2.tripPose.gc8 && [+D2.tripPose.gc8.x.toFixed(1), +D2.tripPose.gc8.z.toFixed(1)] }; });
console.log('  out of car', JSON.stringify(out));
check(out.mode === 'walk' && out.lvl === 0, `got out of the GC8 on the street by 港墘站 (car parked at ${out.car})`);

// ---- 2 走進站：出口 1 的樓梯 → 天橋 → 大廳 → 閘門 → 斜坡 → 月台 ----
console.log('== 2 走進港墘站 ==');
const st = () => p.evaluate(() => { const D = window.__D(), t = D.walker.telemetry(), M = D.M, S = M.stations[Math.max(0, D.MRTS.si)], [u, v] = D.MRTS.si >= 0 ? S.loc(t.x, t.z) : [null, null];
  return { x: +t.x.toFixed(1), z: +t.z.toFixed(1), y: +D.walker.character.group.position.y.toFixed(2), u: u == null ? null : +u.toFixed(1), v: v == null ? null : +v.toFixed(1), lvl: D.MRTS.lvl, si: D.MRTS.si, ride: !!M.ride, act: t.action, tags: D.walker.colliderTags ? D.walker.colliderTags() : null }; });
const walkTo = async (u, v, si, py, heading) => { await p.evaluate(([u, v, si, py, heading]) => { const D = window.__D(), M = D.M, S = M.stations[si], [x, z] = S.toW(u, v); M.py = py; D.walker.teleport({ x, z, heading: S.rot + heading }); window.__wstep(3); }, [u, v, si, py, heading]); return st(); };
const walk = async (frames, y = 1, x = 0) => { await p.evaluate(([n, y, x]) => { const D = window.__D(); D.walker.setInput({ x, y }); for (let i = 0; i < n; i++) window.__wstep(1); D.walker.setInput(null); }, [frames, y, x]); return st(); };
const toasts = () => p.evaluate(() => window.__T.splice(0));
const e1 = ST[0].ent[0]; // 港墘 出口 1：+v 那邊（第 80 批：樓梯往 +u 上去（dir −1：u1 在門口、u0 在平台）；帶子靠翼那一邊 2.6 公尺是樓梯、外面是電扶梯）
let w = await walkTo(e1.u1 + 3 * e1.dir, e1.v0 + e1.s * 1.3, 0, 0, e1.dir > 0 ? Math.PI : 0); // 門口外面，面向樓梯
const ys = await p.evaluate(() => { const D = window.__D(); D.walker.setInput({ x: 0, y: 1 }); const ys = []; for (let i = 0; i < 60 * 9; i++) { window.__wstep(1); if (i % 30 === 0) ys.push(+D.walker.character.group.position.y.toFixed(2)); } D.walker.setInput(null); return ys; });
w = await st();
console.log('2', el(), 'stairs', JSON.stringify(ys), JSON.stringify(w));
const mono = ys.every((y, i) => i === 0 || y >= ys[i - 1] - 0.01);
check(w.y === 6 && w.lvl === 1 && w.si === 0 && mono && ys.some((y) => y > 1 && y < 5), `walked up 出口 1: height 0 → ${w.y} step by step (${ys.filter((y, i) => i % 3 === 0).join(' ')}), now on the concourse level (lvl ${w.lvl}, station ${w.si})`);
await shot('2-stairs-top');
w = await walkTo(e1.u0 + 1.5 * e1.dir, e1.v0, 0, 6, (Math.PI / 2) * e1.s); // 平台上，面向大廳（−v）
w = await walk(60 * 6);
console.log('  bridge → hall', JSON.stringify(w));
check(w.y === 6 && w.lvl === 1 && Math.abs(w.v) < 10, `over the footbridge into the concourse (v ${w.v}, still ${w.y} m up)`);
const s3 = await shot('3-hall');
w = await walkTo(-16, 0.825, 0, 6, 0); await toasts(); w = await walk(60 * 8); const tg = await toasts(); // 走過閘門（u −8）
console.log('  gates', JSON.stringify(w), JSON.stringify(tg));
if (!(w.u > -8)) console.log('  animals near the gates', JSON.stringify((await p.evaluate(() => window.__D().M.animals())).filter((q) => q.si === 0 && q.lvl === 1 && Math.abs(q.u + 8) < 3))); // 第 89 批：偶爾走不過閘門（大概是小動物站在閘門口）：印出來
check(w.u > -8 && w.lvl === 1 && tg.some((s) => /嗶/.test(s)), `walked through the gate row at u −8 (now u ${w.u}): toast ${JSON.stringify(tg.find((s) => /嗶/.test(s)))}`);
w = await walkTo(-3, 5.5, 0, 6, 0); // 斜坡下面（u 0…12 往上到月台）
const ysr = await p.evaluate(() => { const D = window.__D(); D.walker.setInput({ x: 0, y: 1 }); const ys = []; for (let i = 0; i < 60 * 4; i++) { window.__wstep(1); if (i % 30 === 0) ys.push(+D.walker.character.group.position.y.toFixed(2)); } D.walker.setInput(null); return ys; });
w = await st();
console.log('  ramp', JSON.stringify(ysr), JSON.stringify(w));
check(w.y === 12.6 && w.lvl === 2 && ysr.some((y) => y > 7 && y < 12) && ysr.every((y, i) => i === 0 || y >= ysr[i - 1] - 0.01), `up the stairs to the platform: ${ysr[0]} → ${w.y} (lvl ${w.lvl})`);
const s4 = await shot('4-platform');
check(s3.calls > 40 && s3.calls < 400 && s4.calls > 40 && s4.calls < 400, `concourse ${s3.calls} calls / ${s3.tris} tris, platform ${s4.calls} / ${s4.tris}`);

// ---- 3 等車、上車 ----
console.log('== 3 等往文德的車 ==');
const dwell = I.dirs.find((d) => d.dir === 1), dw0 = dwell.dwells.find((d) => d.si === 0);
await p.evaluate(([ph, t0]) => { window.__D().M.setTime(ph + t0 - 6); }, [dwell.phase, dw0.t0]);
w = await walkTo(-10.8, 5.0, 0, 12.6, Math.PI / 2); await toasts(); // 第 3 個車門前面，面向軌道
const wait = await p.evaluate(() => { const D = window.__D(), M = D.M; const log = []; let firstOpen = null, psdClosedBefore = null; const psdN = () => M.movers.filter((m) => Math.abs(m.h - (M.YP + 3.3)) < 0.01).length;
  for (let i = 0; i < 60 * 9; i++) { window.__wstep(1); const tr = M.trains().find((t) => t.dir === 1 && t.si === 0); if (i === 0) psdClosedBefore = psdN();
    if (tr && tr.open > 0 && firstOpen == null) firstOpen = { t: +M.time.toFixed(1), v: +tr.v.toFixed(2) }; if (i % 60 === 0) log.push({ t: +M.time.toFixed(1), tr: M.trains().filter((t) => t.dir === 1).map((t) => `${t.si}/${t.open.toFixed(1)}/${t.v.toFixed(0)}`) }); }
  const tr = M.trains().find((t) => t.dir === 1 && t.si === 0); return { log, firstOpen, psdClosedBefore, movers: psdN(), all: M.movers.length, open: tr && tr.open, v: tr && tr.v, cars: tr && tr.cars.length, stop: tr && tr.si }; });
const tw = await toasts();
console.log('3', el(), JSON.stringify(wait), JSON.stringify(tw));
check(wait.open === 1 && wait.v === 0 && wait.cars === 4 && wait.stop === 0 && wait.firstOpen && wait.firstOpen.v === 0, `the eastbound (往文德) 4-car train pulled in, stopped (v ${wait.v}) and opened its doors (opened at t ${wait.firstOpen?.t}, speed then ${wait.firstOpen?.v})`);
check(tw.some((s) => /叮咚.*往文德.*進站/.test(s)), `叮咚 toast: ${JSON.stringify(tw)}`);
check(wait.psdClosedBefore === 32 && wait.movers === 16 && wait.all > 40, `platform doors open with the train: door-leaf movers ${wait.psdClosedBefore} (all 16 doors closed) → ${wait.movers} (the 8 on the train's side open); ${wait.all} movers in all with the car walls`);
const s5 = await shot('5-train');
await p.evaluate(() => { window.__D().walker.setCamera({ mode: 'eye' }); window.__wstep(4); }); await shot('5-train-eye');
await p.evaluate(() => { window.__D().walker.setCamera({ mode: 'follow' }); window.__wstep(4); });
w = await walk(60 * 3); // 走進車廂
const inCar = await p.evaluate(() => { const D = window.__D(), M = D.M, t = D.walker.telemetry(), tr = M.trains().find((t) => t.dir === 1 && t.si === 0); if (!tr) return null;
  for (const c of tr.cars) { const dx = t.x - c.x, dz = t.z - c.z, lu = dx * c.ux + dz * c.uz, lv = -dx * c.uz + dz * c.ux; if (Math.abs(lu) <= 6.9 && Math.abs(lv) <= 1.28) return { lu: +lu.toFixed(2), lv: +lv.toFixed(2) }; } return { lu: null }; });
console.log('  in car', JSON.stringify(w), JSON.stringify(inCar));
check(inCar && inCar.lu != null && w.y === 12.6 && w.lvl === 2 && !w.ride, `walked through the doors into the car (car-local ${JSON.stringify(inCar)}), floor at ${w.y}; not counted as boarded until the doors close`);
await shot('6-in-car');
const ride = await p.evaluate(() => { const D = window.__D(), M = D.M; const log = []; let boardedAt = null, p0 = null, lvls = new Set();
  for (let i = 0; i < 60 * 30; i++) { window.__wstep(1); const t = D.walker.telemetry(); lvls.add(D.MRTS.lvl); if (M.ride && boardedAt == null) { boardedAt = +M.time.toFixed(1); p0 = [t.x, t.z]; } if (i % 300 === 0) log.push({ t: +M.time.toFixed(0), x: +t.x.toFixed(0), z: +t.z.toFixed(0), y: +D.walker.character.group.position.y.toFixed(1), lvl: D.MRTS.lvl, ride: !!M.ride }); }
  const t = D.walker.telemetry(); return { log, boardedAt, moved: p0 ? +Math.hypot(t.x - p0[0], t.z - p0[1]).toFixed(0) : 0, lvl: D.MRTS.lvl, ride: !!M.ride, y: +D.walker.character.group.position.y.toFixed(2), lvls: [...lvls] }; });
const tr3 = await toasts();
console.log('  ride', JSON.stringify(ride), JSON.stringify(tr3));
check(ride.ride && ride.lvl === 3 && ride.boardedAt != null && Math.abs(ride.boardedAt - (dwell.phase + dw0.t1)) < 1.5 && ride.moved > 150 && ride.y === 12.6, `doors closed at t ${ride.boardedAt} (timetable ${dwell.phase + dw0.t1}) = boarded (lvl 3); 30 s later the walker has moved ${ride.moved} m with the train, floor still ${ride.y}`);
check(tr3.some((s) => /上車了.*往文德/.test(s)) && tr3.some((s) => /下一站.*文德/.test(s)), `toasts on the way: ${JSON.stringify(tr3)}`);
const s7 = await shot('7-riding');
await p.evaluate(() => { window.__D().walker.setCamera({ mode: 'eye' }); window.__wstep(4); }); await shot('7-riding-eye');
await p.evaluate(() => { window.__D().walker.setCamera({ mode: 'follow' }); window.__wstep(4); });
// 第 82 批（Nick「開到一半我就突然跑到地面」）：坐車的時候停一下（換視角、跳出來的東西）、被推到車廂的牆外面：還是在車上、地板 12.6、拉回車廂裡
const hold = await p.evaluate(() => { const D = window.__D(), M = D.M, W = D.walker;
  const where = () => { const t = W.telemetry(); for (const tr of M.trains()) for (const c of tr.cars) { const dx = t.x - c.x, dz = t.z - c.z, lu = dx * c.ux + dz * c.uz, lv = -dx * c.uz + dz * c.ux; if (Math.abs(lu) <= 6.9 && Math.abs(lv) <= 1.28) return { lu: +lu.toFixed(2), lv: +lv.toFixed(2) }; } return null; };
  W.pause(); for (let i = 0; i < 120; i++) window.__wstep(1); W.resume(); window.__wstep(3);
  const a = { ride: !!M.ride, y: +W.character.group.position.y.toFixed(2), in: where() };
  const tr = M.trains().find((t) => t.dir === 1), c = tr.cars[0]; W.shift(-c.uz * 2.2, c.ux * 2.2, 0); window.__wstep(1, 1 / 8); window.__wstep(4);
  const b = { ride: !!M.ride, y: +W.character.group.position.y.toFixed(2), in: where() };
  const car = D.VIL.mrt.group.getObjectByName('mrt-cars'), gls = D.VIL.mrt.group.getObjectByName('mrt-car-glass'), wall = D.VIL.mrt.stations[0].group.getObjectByName('mrt-walls');
  return { a, b, keys: [car.material.customProgramCacheKey?.(), wall.material.customProgramCacheKey?.()], glass: gls.material.opacity };
});
console.log('  hold', JSON.stringify(hold));
check(hold.a.ride && hold.a.y === 12.6 && hold.a.in && hold.b.ride && hold.b.y === 12.6 && hold.b.in, `riding survives a 2 s pause (${JSON.stringify(hold.a)}) and being pushed 2.2 m through the car wall (pulled back inside: ${JSON.stringify(hold.b)}), floor stays 12.6`);
check(/^mrt-self-train/.test(hold.keys[0]) && /^mrt-self-wall/.test(hold.keys[1]) && hold.glass < 0.3, `station and train are self-lit (fluorescent fill: ${hold.keys.join(', ')}), train windows light (opacity ${hold.glass})`);

// ---- 4 到文德、下車 ----
console.log('== 4 文德到了 ==');
const arr = await p.evaluate(() => { const D = window.__D(), M = D.M; let off = null, actAt = null; const log = [];
  for (let i = 0; i < 60 * 70; i++) { window.__wstep(1); const t = D.walker.telemetry(); if (t.action === '下車' && actAt == null) { actAt = +M.time.toFixed(1); document.querySelector('#stage .wk-act').click(); window.__wstep(30); off = { x: +D.walker.telemetry().x.toFixed(1), z: +D.walker.telemetry().z.toFixed(1), y: +D.walker.character.group.position.y.toFixed(2), lvl: D.MRTS.lvl, si: D.MRTS.si, ride: !!M.ride }; break; }
    if (i % 600 === 0) log.push({ t: +M.time.toFixed(0), x: +t.x.toFixed(0), ride: !!M.ride, si: D.MRTS.si }); }
  const S = M.stations[1], [u, v] = off ? S.loc(off.x, off.z) : [null, null]; return { log, actAt, off, u: u == null ? null : +u.toFixed(1), v: v == null ? null : +v.toFixed(1) }; });
const t4 = await toasts();
console.log('4', el(), JSON.stringify(arr), JSON.stringify(t4));
const dw1 = dwell.dwells.find((d) => d.si === 1);
check(arr.actAt != null && arr.actAt >= dwell.phase + dw1.t0 && arr.actAt < dwell.phase + dw1.t0 + 4, `「下車」 button appears when the train has stopped at 文德 and opened its doors (t ${arr.actAt}, timetable ${dwell.phase + dw1.t0})`);
check(arr.off && !arr.off.ride && arr.off.lvl === 2 && arr.off.si === 1 && arr.off.y === 12.6 && arr.v > 3.3 && arr.v < 7.8 && Math.abs(arr.u) < 30, `pressed 下車: standing on the 文德 platform (u ${arr.u}, v ${arr.v}, y ${arr.off.y}), no longer riding`);
check(t4.some((s) => /叮咚.*文德.*終點站/.test(s)) && t4.some((s) => /文德.*下車了/.test(s)), `toasts: ${JSON.stringify(t4)}`);
const s8 = await shot('8-wende');
await p.evaluate(() => { window.__D().LOOK?.setHour?.(22); window.__wstep(40); }); const s8n = await shot('8-wende-night');
await p.evaluate(() => { window.__D().LOOK?.setHour?.(13); window.__wstep(4); });
check(s7.calls > 40 && s7.calls < 400 && s8.calls > 40 && s8.calls < 400 && s8n.calls > 40 && s8n.calls < 450, `riding ${s7.calls} calls / ${s7.tris} tris; 文德 platform ${s8.calls} / ${s8.tris}, at night ${s8n.calls} / ${s8n.tris}`);

// ---- 5 走出文德站（出口 2：+v 那邊，u 17…22 的翼，第 80 批起樓梯往 −u 下去）；車還在港墘 ----
console.log('== 5 走出文德站 ==');
const e2 = ST[1].ent.find((e) => e.s === 1) || ST[1].ent[1];
w = await walkTo(12.5, 5.5, 1, 12.6, Math.PI); // 斜坡上面，面向 −u 走下去
const ysd = await p.evaluate(() => { const D = window.__D(); D.walker.setInput({ x: 0, y: 1 }); const ys = []; for (let i = 0; i < 60 * 4; i++) { window.__wstep(1); if (i % 30 === 0) ys.push(+D.walker.character.group.position.y.toFixed(2)); } D.walker.setInput(null); return ys; });
w = await st();
console.log('5', el(), 'down ramp', JSON.stringify(ysd), JSON.stringify(w));
check(w.y === 6 && w.lvl === 1 && w.si === 1 && ysd.every((y, i) => i === 0 || y <= ysd[i - 1] + 0.01), `down the platform stairs to the 文德 concourse: ${ysd[0]} → ${w.y}`);
w = await walkTo(12, 0.825, 1, 6, 0); await toasts(); w = await walk(60 * 5); const tg2 = await toasts(); // 第二排閘門（u 16）
check(w.u > 16 && tg2.some((s) => /嗶/.test(s)), `through the second gate row at u 16 (u ${w.u}): ${JSON.stringify(tg2)}`);
w = await walkTo((e2.bu0 + e2.bu1) / 2, 8.5, 1, 6, -Math.PI / 2); w = await walk(60 * 7); // 天橋往 +v 到平台
console.log('  bridge', JSON.stringify(w));
check(w.y === 6 && w.lvl === 1 && w.v > Math.min(e2.v0, e2.v1) - 0.5, `across the 出口 2 footbridge to the stair landing (v ${w.v})`);
w = await walkTo(e2.uS - 0.5 * e2.dir, e2.v0 + e2.s * 1.3, 1, 6, e2.dir > 0 ? 0 : Math.PI); // 樓梯頭（靠翼那一邊是樓梯），面向樓梯往下
const ysx = await p.evaluate(() => { const D = window.__D(); D.walker.setInput({ x: 0, y: 1 }); const ys = []; for (let i = 0; i < 60 * 9; i++) { window.__wstep(1); if (i % 30 === 0) ys.push(+D.walker.character.group.position.y.toFixed(2)); } D.walker.setInput(null); return ys; });
w = await st();
console.log('  exit stairs', JSON.stringify(ysx), JSON.stringify(w));
check(w.y === 0 && w.lvl === 0 && ysx.every((y, i) => i === 0 || y <= ysx[i - 1] + 0.01), `down 出口 2 to the street: ${ysx[0]} → ${w.y}, back on street level (lvl 0, world colliders back)`);
const back = await p.evaluate(() => { const D = window.__D(), M = D.M, S0 = M.stations[0], car = D.walker.cars.find((c) => c.key === 'gc8'); const d0 = car ? Math.hypot(car.x - S0.x, car.z - S0.z) : null; const t = D.walker.telemetry(); const d1 = Math.hypot(t.x - M.stations[1].x, t.z - M.stations[1].z);
  return { carAt港墘: d0 == null ? null : +d0.toFixed(0), meAt文德: +d1.toFixed(0), blocked: D.walker.colsNear ? D.walker.colsNear(t.x, t.z, 30).length : null, act: t.action }; });
console.log('  back on the street', JSON.stringify(back));
check(back.carAt港墘 != null && back.carAt港墘 < 80 && back.meAt文德 < 60, `the GC8 is still parked by 港墘站 (${back.carAt港墘} m from it) while you are at 文德 (${back.meAt文德} m)`);
await shot('9-wende-street');

// ---- 10 第 80 批：電扶梯、地上的標示和路線圖、新的車頭、跟車站重疊的房子拿掉 ----
console.log('== 10 電扶梯、標示、房子 ==');
const b80 = await p.evaluate(() => { const D = window.__D(), M = D.M; let deco = 0, noses = null, steps = null, carN = 0; M.group.traverse((o) => { if (o.name === 'mrt-deco') deco++; if (o.name === 'mrt-noses') noses = o; if (o.name === 'mrt-cars') carN = o.count; if (o.name === 'mrt-esc-steps') steps = o; });
  const tex = M.group.children.flatMap((g) => g.children || []).find((o) => o.name === 'mrt-deco')?.material?.map?.image;
  return { esc: M.info.esc, escSteps: M.info.escSteps, deco, noseN: noses ? noses.count : -1, carN, stepN: steps ? steps.count : -1, texW: tex ? tex.width : 0, gone: D.VIL.neihu.data.mrtGone }; });
console.log('  b80', JSON.stringify(b80));
check(b80.esc >= 8 && b80.escSteps > 150 && b80.stepN === b80.escSteps, `escalators: ${b80.esc} (platform ↔ concourse, street ↔ exit), ${b80.escSteps} moving steps in one InstancedMesh`);
check(b80.deco === 2 && b80.texW === 1024, `each station has its own decoration mesh (route map, posters, floor marks 下車／排隊／禁止跨越): ${b80.deco} meshes, atlas ${b80.texW}px`);
// 第 89 批（Nick「捷運站的等候線不要懸空在樓梯上」）：月台地上的線（下車、排隊）沒有一個點在樓梯、電扶梯的洞上面
const b89 = await p.evaluate(() => { const M = window.__D().M, Hh = M.info.hole, v = { x: 0, y: 0, z: 0, fromBufferAttribute(a, i) { this.x = a.getX(i); this.y = a.getY(i); this.z = a.getZ(i); return this; } }; let over = 0, floor = 0, yp = null;
  M.group.traverse((o) => { if (o.name !== 'mrt-deco') return; const pos = o.geometry.attributes.position, ys = new Map();
    for (let i = 0; i < pos.count; i++) { const y = +pos.getY(i).toFixed(3); ys.set(y, (ys.get(y) || 0) + 1); }
    yp = [...ys.entries()].sort((a, b) => b[1] - a[1])[0][0]; // 地上的線那一層（點最多的高度）
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); if (Math.abs(v.y - yp) > 0.02) continue; floor++; const av = Math.abs(v.z); if (v.x > Hh.u0 + 0.01 && v.x < Hh.u1 - 0.01 && av > Hh.v0 + 0.01 && av < Hh.v1 - 0.01) over++; } });
  return { over, floor, yp, hole: Hh }; });
console.log('  floor marks', JSON.stringify(b89));
check(b89.floor > 100 && b89.over === 0, `the platform floor marks (下車／排隊) stay on the floor: none of the ${b89.floor} points is over the stair/escalator hole (u ${b89.hole.u0}…${b89.hole.u1}, |v| ${b89.hole.v0}…${b89.hole.v1})`);
check(b80.carN >= 4 && b80.noseN === b80.carN / 2, `train noses at both ends of every train: ${b80.noseN} noses for ${b80.carN / 4} trains on the line now`);
check(b80.gone >= 1 && b80.gone < 30, `${b80.gone} Neihu houses overlapping the stations were removed`);
const escR = await p.evaluate(() => { const D = window.__D(), M = D.M, S = M.stations[0], e = S.ent[0]; const vE = e.v0 + e.s * 3.7, [x, z] = S.toW(e.u1 + 1.5 * e.dir, vE); M.py = 0; D.walker.teleport({ x, z, heading: S.rot + (e.dir > 0 ? Math.PI : 0) }); window.__wstep(3);
  const ys = []; D.walker.setInput({ x: 0, y: 0.35 }); for (let i = 0; i < 60 * 14; i++) { window.__wstep(1); if (i % 60 === 0) ys.push(+D.walker.character.group.position.y.toFixed(2)); } D.walker.setInput(null); for (let i = 0; i < 60 * 4; i++) window.__wstep(1); ys.push(+D.walker.character.group.position.y.toFixed(2)); return { ys, lvl: D.MRTS.lvl }; });
console.log('  escalator', JSON.stringify(escR));
check(escR.ys[0] === 0 && escR.ys[escR.ys.length - 1] === 6 && escR.lvl === 1 && escR.ys.every((y, i) => i === 0 || y >= escR.ys[i - 1] - 0.01), `slow walk onto the 出口 1 escalator carries you up 0 → 6 (${escR.ys.join(' ')}), concourse level`);
await shot('10-escalator');

// ---- 11 第 87 批（Nick「捷運站也要有生物」）：捷運站裡的小動物；列車的 key 過 180 秒不會換（以前坐車剛好碰到就被當成開進隧道） ----
console.log('== 11 捷運站的小動物 ==');
const wrap = await p.evaluate(() => { const M = window.__D().M; M.setTime(178.5); window.__wstep(2); const a = M.trains().map((t) => ({ key: t.key, dir: t.dir, s: t.s }));
  for (let i = 0; i < 150; i++) window.__wstep(1); const b = M.trains().map((t) => ({ key: t.key, dir: t.dir, s: t.s }));
  return { t: +M.time.toFixed(1), a, same: a.filter((x) => b.some((y) => y.key === x.key && y.dir === x.dir && Math.abs(y.s - x.s) < 90)).length, gone: a.filter((x) => !b.some((y) => y.key === x.key)).map((x) => x.key + '@' + x.s) }; });
console.log('  wrap', JSON.stringify(wrap));
check(wrap.t < 10 && wrap.a.length >= 2 && wrap.gone.every((g) => { const s = +g.split('@')[1]; return s < I.sA + 150 || s > I.sB - 150; }) && wrap.same >= wrap.a.length - wrap.gone.length,
  `the clock wrapped 180 → ${wrap.t} s and every train between the tunnels kept its key (${wrap.same}/${wrap.a.length}; gone only into a tunnel: ${JSON.stringify(wrap.gone)}) — a rider is not dropped halfway`);
w = await walkTo(-16, 0.825, 0, 6, 0); // 港墘的大廳
const zooAt = () => p.evaluate(() => { const D = window.__D(), M = D.M, A = M.animals(), bad = [];
  for (const a of A) { if (a.lvl !== 1 && a.lvl !== 2) continue; if (!['idle', 'walk', 'queue'].includes(a.st)) continue; const S = M.stations[a.si];
    const yOk = a.y === (a.lvl === 2 ? M.YP : M.YC), floor = a.lvl === 2 ? Math.abs(a.v) > 3.3 && Math.abs(a.v) < 10.4 && Math.sign(a.v) === a.sd && Math.abs(a.u) < 60 : Math.abs(a.v) < 11 && Math.abs(a.u) < 40;
    const inCol = M.cols(a.si, a.lvl).some((c) => { const [cu, cv] = S.loc(c.x, c.z); return Math.abs(a.u - cu) < c.hx - 0.02 && Math.abs(a.v - cv) < c.hz - 0.02; });
    if (!yOk || !floor || inCol) bad.push({ ...a, yOk, floor, inCol }); }
  return { A, bad }; });
let z = await zooAt();
const nOf = (A, f) => A.filter(f).length;
const zs = { n: z.A.length, built: nOf(z.A, (a) => a.built), kinds: [...new Set(z.A.map((a) => a.k))].sort().join(','), hall: [0, 1].map((si) => nOf(z.A, (a) => a.si === si && a.lvl === 1)), plat: [0, 1].map((si) => [-1, 1].map((sd) => nOf(z.A, (a) => a.si === si && a.lvl === 2 && a.sd === sd))) };
console.log('11', el(), JSON.stringify(zs), 'bad', JSON.stringify(z.bad));
check(zs.n >= 12 && zs.built === zs.n && zs.kinds === 'cham,pig,pinky' && zs.hall.every((n) => n === 4) && zs.plat.every((s) => s.every((n) => n >= 1 && n <= 7)),
  `animals live in both stations: ${zs.n} in all (pig, pinky, chameleon all there), concourse ${zs.hall.join('/')} (2 outside + 2 inside the gates), platforms ${zs.plat.map((s) => s.join('+')).join(' / ')} (each side)`);
check(z.bad.length === 0, `every standing / walking animal is on its floor (concourse y 6, platform y 12.6 on its own side of the tracks) and not inside a wall, gate or bench (${z.bad.length ? JSON.stringify(z.bad.slice(0, 3)) : 'ok'})`);
const mv = await p.evaluate(() => { const D = window.__D(), M = D.M, Z = M.zoo; const live = Z.list.filter((a) => !a.free && (a.lvl === 1 || a.lvl === 2) && a.si >= 0);
  const p0 = live.map((a) => [a.x, a.z]); let fast = 0, wrong = 0, maxSp = 0, walking = 0; let last = live.map((a) => [a.x, a.z, a.st]);
  for (let i = 0; i < 60 * 14; i++) { window.__wstep(1); if (i % 15 !== 14) continue;
    live.forEach((a, j) => { const [x, z, st] = last[j]; if (st === 'ride' || a.st === 'ride' || a.free) { last[j] = [a.x, a.z, a.st]; return; } const sp = Math.hypot(a.x - x, a.z - z) / 0.25; maxSp = Math.max(maxSp, sp); if (sp > 1.4) fast++; if (a.st === 'walk') walking++; last[j] = [a.x, a.z, a.st]; }); }
  const moved = live.filter((a, j) => !a.free && Math.hypot(a.x - p0[j][0], a.z - p0[j][1]) > 1).length;
  return { live: live.length, moved, fast, maxSp: +maxSp.toFixed(2), walking }; });
z = await zooAt();
console.log('  14 s later', JSON.stringify(mv), 'bad', JSON.stringify(z.bad));
check(mv.moved >= 4 && mv.walking > 10 && mv.fast === 0 && mv.maxSp < 1.2 && z.bad.length === 0, `14 s later ${mv.moved}/${mv.live} animals have walked somewhere else, never faster than ${mv.maxSp} m/s (slow animal walk), still on their floors and out of the walls`);
// 擋路：一隻站著不動，你走過去會被擋住（走路的人撞得到）
const blk = await p.evaluate(() => { const D = window.__D(), M = D.M, Z = M.zoo, W = D.walker;
  const a = Z.list.find((a) => !a.free && a.si === 0 && a.lvl === 1 && a.C && (a.st === 'idle' || a.st === 'walk')); if (!a) return null;
  a.st = 'idle'; a.t = 60; a.wp = null; a.v = 0; const N = a.N, S = N.S, [au, av] = S.loc(a.x, a.z);
  let spot = null; for (let r = 2.4; r < 4 && !spot; r += 0.3) for (let k = 0; k < 16 && !spot; k++) { const an = (k / 16) * Math.PI * 2, u = au + Math.cos(an) * r, v = av + Math.sin(an) * r; let ok = true; for (let t = 0; t <= 1.0001 && ok; t += 0.05) { const i = Math.floor((au + (u - au) * t - N.U0) / 0.25), j = Math.floor((av + (v - av) * t - N.V0) / 0.25); ok = N.free[j * N.nu + i] === 1; } if (ok) spot = [u, v]; }
  if (!spot) return { noSpot: true }; const [x, z] = S.toW(spot[0], spot[1]); M.py = 6; W.teleport({ x, z, heading: Math.atan2(-(a.z - z), a.x - x) }); window.__wstep(3);
  const movers = M.movers.filter((m) => m.t === 'circle').length; let dmin = Infinity; W.setInput({ x: 0, y: 1 });
  for (let i = 0; i < 60 * 5; i++) { window.__wstep(1); const t = W.telemetry(); dmin = Math.min(dmin, Math.hypot(t.x - a.x, t.z - a.z)); } W.setInput(null); a.t = 1;
  return { kind: a.kind, r: +Math.min(0.42, a.C.radius || 0.35).toFixed(2), dmin: +dmin.toFixed(2), movers }; });
console.log('  blocked', JSON.stringify(blk));
check(blk && blk.movers >= 4 && blk.dmin > blk.r + 0.15, `walking straight at a standing ${blk && blk.kind}: you stop ${blk && blk.dmin} m from it (its radius ${blk && blk.r}); ${blk && blk.movers} animal colliders on this concourse`);
// 截圖：站在一隻小動物前面 d 公尺、看著牠旁邊一點（鏡頭在你後面，人才不會擋住牠）
const faceAnimal = (si, lvl, sd, d) => p.evaluate(([si, lvl, sd, d]) => { const D = window.__D(), M = D.M, Z = M.zoo, W = D.walker;
  const list = Z.list.filter((a) => !a.free && a.C && a.si === si && a.lvl === lvl && (sd == null || a.sd === sd) && (a.st === 'idle' || a.st === 'queue' || a.st === 'walk'));
  for (const a of list) { const N = a.N, S = N.S, [au, av] = S.loc(a.x, a.z);
    for (const an of [0, Math.PI, 0.6, -0.6, Math.PI + 0.6, Math.PI - 0.6, Math.PI / 2, -Math.PI / 2]) { const u = au + Math.cos(an) * d, v = av + Math.sin(an) * d; let ok = true;
      for (let t = 0; t <= 1.0001 && ok; t += 0.05) { const i = Math.floor((au + (u - au) * t - N.U0) / 0.25), j = Math.floor((av + (v - av) * t - N.V0) / 0.25); ok = i >= 0 && j >= 0 && i < N.nu && j < N.nv && N.free[j * N.nu + i] === 1; }
      if (!ok) continue; a.st = 'idle'; a.t = 3; a.wp = null; a.v = 0; const [x, z] = S.toW(u, v); M.py = N.y; W.teleport({ x, z, heading: Math.atan2(-(a.z - z), a.x - x) + 0.45 }); window.__wstep(20); return a.kind; } }
  return null; }, [si, lvl, sd, d]);
const fa1 = await faceAnimal(0, 1, null, 3.2); console.log('  face', fa1);
const sz1 = await shot('11-hall-animals');
// 往文德的車進港墘：有的上車、坐車跟著車走（站在車廂裡、12.6）、到文德走出來站在月台上；從隧道開出來的車也帶小動物下車
const zb = await p.evaluate(([ph, t0, t1, t0b]) => { const D = window.__D(), M = D.M, Z = M.zoo;
  M.setTime(ph + t0 - 4); window.__wstep(1);
  const on = (a) => !a.free && a.si === 0 && a.lvl === 2 && a.sd === 1 && a.st !== 'board' && a.st !== 'alight';
  const before = Z.list.filter(on).length, pre = new Set(Z.list.filter((a) => !a.free));
  const boarded = new Set(), rode = new Set(), fromTunnel = new Set(); let key = null, rideN = 0, rideBad = [], arrive = null;
  for (let i = 0; i < 60 * (t0b - t0 + 24); i++) { window.__wstep(1);
    for (const a of Z.list) { if (a.free) continue;
      if (a.st === 'board' && a.si === 0 && a.sd === 1 && pre.has(a)) boarded.add(a); // 往文德那一邊（另一邊上的車往西開，開進隧道就不見了）
      if (a.st === 'alight' && a.si === 0 && !pre.has(a)) fromTunnel.add(a);
      if (a.st === 'ride' && boarded.has(a)) { rode.add(a); key = a.ride.key; rideN++; const tr = M.trains().find((t) => t.key === a.ride.key); const c = tr && tr.cars[a.ride.ci];
        if (!c) rideBad.push('no car'); else { const dx = a.x - c.x, dz = a.z - c.z, lu = dx * c.ux + dz * c.uz, lv = -dx * c.uz + dz * c.ux; if (Math.abs(lu) > 6.9 || Math.abs(lv) > 1.28 || a.y !== M.YP) rideBad.push([+lu.toFixed(2), +lv.toFixed(2), a.y]); } } }
    if (arrive == null && key) { const tr = M.trains().find((t) => t.key === key); if (tr && tr.si === 1 && tr.open > 0.7) arrive = +M.time.toFixed(1); }
  }
  const B = [...rode], end = B.map((a) => { const [u, v] = a.si >= 0 ? M.stations[a.si].loc(a.x, a.z) : [0, 0]; return { k: a.kind, st: a.st, si: a.si, lvl: a.lvl, y: +a.y.toFixed(2), u: +u.toFixed(1), v: +v.toFixed(1) }; });
  const T = [...fromTunnel].map((a) => { const [u, v] = M.stations[0].loc(a.x, a.z); return { k: a.kind, st: a.st, lvl: a.lvl, y: +a.y.toFixed(2), u: +u.toFixed(1), v: +v.toFixed(1) }; });
  return { before, boarded: boarded.size, rode: B.length, key, rideN, rideBad: rideBad.slice(0, 4), rideBadN: rideBad.length, arrive, end, T }; }, [dwell.phase, dw0.t0, dw0.t1, dw1.t0]);
console.log('  ride', JSON.stringify(zb));
check(zb.before >= 1 && zb.rode >= 1 && zb.key && zb.rideN > 600 && zb.rideBadN === 0, `the 往文德 train at 港墘: ${zb.rode} of the ${zb.before} animals waiting walked in through the doors and rode it (${zb.boarded} started to) (${zb.rideN} animal-frames inside their car, at floor 12.6, ${zb.rideBadN} outside)`);
check(zb.arrive != null && zb.end.length >= 1 && zb.end.every((e) => e.si === 1 && e.lvl === 2 && e.y === 12.6 && e.v > 3.3 && e.v < 10.4 && ['idle', 'walk', 'queue'].includes(e.st)), `at 文德 (t ${zb.arrive}) they walked out onto the platform: ${JSON.stringify(zb.end)}`);
check(zb.T.length >= (zb.before < 4 ? 1 : 0) && zb.T.every((e) => e.lvl === 2 && e.y === 12.6 && e.v > 3.3 && e.v < 10.4 && ['idle', 'walk', 'queue'].includes(e.st)), `the train coming out of the tunnel brought ${zb.T.length} animal(s) who got off at 港墘 and stand on the platform (${JSON.stringify(zb.T)})`);
// 月台上（白天）：排隊、看得到；draw calls
w = await walkTo(-14, 6.2, 0, 12.6, Math.PI / 2 + 0.5); await p.evaluate(() => window.__wstep(20)); const fa2 = await faceAnimal(0, 2, 1, 3.2); console.log('  face', fa2);
const vis = await p.evaluate(() => { const D = window.__D(), M = D.M; let groups = 0, meshes = 0; M.group.traverse((o) => { if (/^mrt-animal-/.test(o.name) && o.visible) { groups++; o.traverse((m) => { if (m.isMesh) meshes++; }); } }); return { groups, meshes, near: M.animals().filter((a) => a.vis).length }; });
const sz2 = await shot('11-platform-animals');
console.log('  visible', JSON.stringify(vis));
check(vis.groups >= 4 && vis.meshes === vis.groups * 2 && vis.near === vis.groups, `${vis.groups} animals drawn near you (2 meshes each = ${vis.meshes}), the far ones hidden`);
check(sz1.calls > 40 && sz1.calls < 400 && sz2.calls > 40 && sz2.calls < 400, `with animals: concourse ${sz1.calls} calls / ${sz1.tris} tris, platform ${sz2.calls} / ${sz2.tris}`);

check(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
await b.close(); srv.close();
console.log(fails.length ? `\n${fails.length} FAIL:\n  ${fails.join('\n  ')}` : '\nALL CHECKS OK', el());
process.exit(fails.length ? 1 : 0);
