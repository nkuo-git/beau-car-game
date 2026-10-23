// 山、隧道、海邊（hills.js，第 27 批）：每座山都開得上去、兩個隧道、沒有看不到的牆、最外面一圈沙灘和海（art/garage.html 整頁跑一次）
//   1 開局：幾座山、兩個隧道；村子南北邊、400 公尺盡頭的看不到的牆拿掉了；山的網格跟高度一樣；山都不會太陡；
//     6 個家、快速道路、往內湖的路都沒有被山蓋到；路面（沙地、沙灘、淺水、深水）
//   2 GC8 開上快速道路一圈裡面的山（48 公尺）：貼著地面、不會卡住
//   3 穿過快速道路隧道、內湖隧道：路是平的、不會撞到、鏡頭不會跑出隧道頂、裡面暗一點，出來亮回來
//   4 從東邊開上快速道路隧道那座山、開過隧道上面、從西邊下來：上面那層（山的地面）、不會撞到下面的護欄；洞口上面的欄杆擋住（不會掉下去）
//   5 開進海裡：慢慢停下來、「前面是海，倒車回去」、倒車開得出來
//   6 下車走路：走到深水就走不過去
//   7 400 公尺後面：沒有牆、開到沙地上慢下來
//   8 從村子往南、往北開出去：沒有牆
//   9 效能（隧道口、隧道裡、山頂、海邊、4 號家門口、400 公尺後面的沙地）、hills.update 花多少時間
// node hills-test.mjs [prefix]（截圖 <prefix>-… .png）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [prefix = 'hills'] = process.argv.slice(2);
if (path.dirname(prefix) !== '.') fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const hook = 'window.__THREE = THREE; window.__G = () => GAME; window.__S = () => S;'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__D = () => ({ on: DRIVE.on, drv, VIL, GAR, dcam, trip, tripS, tripPose, cur, walker, TR, indoor, TOWER_RAMP });'
  + ' window.__strip = () => stripColliders(); window.__leave = () => leaveCar(); window.__pol = () => (typeof police !== "undefined" ? police : null);'
  + ' window.__npcPause = (off) => { if (off) { if (!NPC) return; window.__npcKeep = NPC; NPC.g.visible = false; NPC.MOV.length = 0; drv?.removeColliders(\'traffic\'); NPC = null; } else if (window.__npcKeep) { NPC = window.__npcKeep; window.__npcKeep = null; NPC.g.visible = DRIVE.on; } };'
  + ' window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };';
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
async function drawAndShot(name) { // 畫兩格再截圖（停住的時候畫的是現在的樣子）
  const n0 = await p.evaluate(() => { window.__noDraw = false; return window.__dframes || 0; });
  await p.waitForFunction((n) => (window.__dframes || 0) >= n + 2, n0, { timeout: 300000 });
  await p.evaluate(() => { window.__noDraw = true; });
  await p.screenshot({ path: `${prefix}-${name}.png` });
  const ri = await p.evaluate(() => window.__rinfo());
  console.log('  shot', `${prefix}-${name}.png`, JSON.stringify(ri), el());
  return ri;
}
await p.addInitScript(() => {
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', scene: 'room', money: 1000, owned: ['gc8'], parts: {}, tyres: {}, wins: {}, cars: {} }));
  }
});
// 小幫手：上車、照著一條線開、放到某個地方、量離地多高（隧道那段：玩家在上面那層＝山的地面）
await p.addInitScript(() => {
  const H = {};
  window.__H = H;
  H.step = (n, dt = 1 / 60) => { const D = window.__D(); for (let i = 0; i < n && D.on; i++) window.__dstep(1, dt); };
  const vis = (e) => !!e && !e.hidden && !e.closest('[hidden]') && e.getClientRects().length > 0;
  const act = () => [...document.querySelectorAll('#stage .wk-act, #stage .dv-act')].find(vis);
  H.actText = () => { const e = act(); return e ? e.querySelector('span').textContent : null; };
  H.boardCar = () => {
    const D = window.__D(), W = D.walker, q = D.tripPose[D.cur];
    if (!q) return { err: 'no pose' };
    const c = Math.cos(q.heading), s = Math.sin(q.heading);
    let a = null;
    for (const d of [2.0, 2.6, 1.5, 3.2]) {
      for (const sd of [1, -1]) {
        W.teleport({ x: q.x + s * d * sd, z: q.z + c * d * sd, heading: q.heading + sd * Math.PI / 2 });
        H.step(12);
        a = H.actText();
        if (a && a.indexOf('上車') === 0) break;
        a = null;
      }
      if (a) break;
    }
    H.step(30);
    W.getIn();
    for (let i = 0; i < 900 && W.mode !== 'off'; i++) H.step(1);
    H.step(30);
    return { act: a, mode: W.mode, cur: window.__D().cur, drv: !!window.__D().drv };
  };
  H.groundAt = (x, z) => { const V = window.__D().VIL, Hl = V.hills; return Hl.high && Hl.tunAt(x, z) >= 0 ? Hl.topAt(x, z) : V.heightAt(x, z); };
  H.put = (x, z, heading, n = 40) => { const D = window.__D(); D.drv.teleport({ x, z, heading }); window.__pol()?.clear(); H.step(n); return D.drv.telemetry(); };
  // 一條線上離所有會擋的東西多遠（村子、賽道、樹、隧道的牆；沒開的不算）
  H.cols = () => { const D = window.__D(), V = D.VIL; return [...V.colliders, ...window.__strip(), ...(D.TR.trees || []), ...V.hills.layerCols].filter((c) => !c.off && !c.crushed); };
  H.clear = (ax, az, bx, bz, cols) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L)); let m = Infinity;
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
      for (const c of cols) {
        const dx = x - c.x, dz = z - c.z; let d;
        if (c.t === 'box') { const r = c.rot || 0, u = dx * Math.cos(r) - dz * Math.sin(r), w = dx * Math.sin(r) + dz * Math.cos(r); d = Math.hypot(Math.max(0, Math.abs(u) - c.hx), Math.max(0, Math.abs(w) - c.hz)); }
        else d = Math.hypot(dx, dz) - (c.r || 0);
        if (d < m) m = d;
      }
    }
    return m;
  };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // pts：[[x, z]…]；開 secs 秒或開到最後一點（o.until(t) 提早停）；量離地多高（不在空中的時候）、在空中多久、卡住幾次、撞到幾次
  H.follow = (pts, secs, o = {}) => {
    const D = window.__D(), d = D.drv, V = D.VIL, N = pts.length, t0 = d.telemetry();
    const r = { s: 0, maxKmh: 0, maxDY: 0, airT: 0, bumps0: t0.bumps, stuck: 0, end: false, maxY: -99, minY: 99, airAt: [] };
    let i0 = 0, lx = t0.x, lz = t0.z, lt = 0;
    for (let n = 0; n < secs * 60; n++) {
      const t = d.telemetry();
      if (o.until && o.until(t)) { r.until = true; break; }
      let bi = i0, bd = Infinity;
      for (let k = i0; k < Math.min(N, i0 + 80); k++) { const e = (pts[k][0] - t.x) ** 2 + (pts[k][1] - t.z) ** 2; if (e < bd) { bd = e; bi = k; } }
      i0 = bi;
      if (i0 >= N - 2 && !o.until) { r.end = true; break; }
      const la = 5 + 0.45 * Math.abs(t.v); let acc = 0, k = i0;
      while (k < N - 1 && acc < la) { acc += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]); k++; }
      const a = wrap(Math.atan2(-(pts[k][1] - t.z), pts[k][0] - t.x) - t.heading);
      const steer = Math.max(-1, Math.min(1, -2.6 * a)), vmax = o.vmax || 20;
      let thr = 1, brk = 0;
      if (t.v > vmax + 1) { thr = 0; brk = 1; } else if (t.v > vmax - 1) thr = 0.35;
      d.setInput({ throttle: thr, brake: brk, steer }); H.step(1);
      const q = d.telemetry();
      r.maxKmh = Math.max(r.maxKmh, q.kmh); if (q.air) { r.airT += 1 / 60; if (r.airAt.length < 6 && (!r.airAt.length || r.s - r.airAt[r.airAt.length - 1][0] > 0.5)) r.airAt.push([+r.s.toFixed(1), Math.round(q.x), Math.round(q.z), +D.tripS.car.position.y.toFixed(1), +H.groundAt(q.x, q.z).toFixed(1)]); }
      const y = D.tripS.car.position.y, Hl = V.hills, terr = (Hl.high && Hl.tunAt(q.x, q.z) >= 0) || V.terrainAt(q.x, q.z); // 車子在哪個高度（平的路上 telemetry 的 y 不會更新）
      r.maxY = Math.max(r.maxY, y); r.minY = Math.min(r.minY, y); if (!q.air && terr) { const dy = Math.abs(y - H.groundAt(q.x, q.z)); if (dy > r.maxDY) { r.maxDY = dy; r.dyAt = [Math.round(q.x), Math.round(q.z), +y.toFixed(2), +H.groundAt(q.x, q.z).toFixed(2), Hl.high, Hl.tunAt(q.x, q.z)]; } }
      if (o.each) o.each(q);
      r.s += 1 / 60;
      if (r.s - lt > 4) { if (Math.hypot(q.x - lx, q.z - lz) < 2) r.stuck++; lt = r.s; lx = q.x; lz = q.z; }
    }
    d.setInput(null);
    const q = d.telemetry();
    Object.assign(r, { s: +r.s.toFixed(1), x: +q.x.toFixed(1), z: +q.z.toFixed(1), y: +D.tripS.car.position.y.toFixed(2), kmh: Math.round(q.kmh), bumps: q.bumps - r.bumps0, maxKmh: Math.round(r.maxKmh), maxDY: +r.maxDY.toFixed(2), airT: +r.airT.toFixed(2), maxY: +r.maxY.toFixed(2), minY: +r.minY.toFixed(2) });
    delete r.bumps0;
    return r;
  };
  // 快速道路的一條車道（中線往外 off 公尺），z 在 z0…z1 那段（西邊那條直線＋兩頭的彎）
  H.hwyLane = (z0, z1, off) => {
    const r = window.__D().VIL.roads.find((q) => q.kind === 'highway'), P = r.pts, out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1]; if (ax > -900 || az < z0 || az > z1) continue;
      const L = Math.hypot(bx - ax, bz - az) || 1; let nx = (bz - az) / L, nz = -(bx - ax) / L; if (nx > 0) { nx = -nx; nz = -nz; } // 往西（外面）
      out.push([ax + nx * off, az + nz * off]);
    }
    return out[0][1] < out[out.length - 1][1] ? out : out.reverse(); // 往南開
  };
  H.line = (ax, az, bx, bz, step = 2) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / step)), P = []; for (let k = 0; k <= n; k++) P.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]); return P; };
  H.stop = () => { const d = window.__D().drv; d.setInput({ throttle: 0, brake: 1, steer: 0 }); for (let i = 0; i < 400 && Math.abs(d.telemetry().v) > 0.05; i++) H.step(1); d.setInput(null); H.step(20); return d.telemetry(); };
});

// ================= 1 開局 =================
await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready();
await p.waitForFunction(() => !!window.__S() && !window.__D().trip, null, { timeout: 300000 }); await p.waitForTimeout(2500);
await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('driveOut').click(); });
await p.waitForFunction(() => window.__D().on && window.__D().walker && window.__D().walker.mode === 'walk', null, { timeout: 300000 });
await p.evaluate(() => { window.__hold = true; window.__noDraw = true; window.__npcPause(true); });
await p.waitForFunction(() => window.__D().tripPose && window.__D().tripPose[window.__D().cur], null, { timeout: 120000 });
const bd1 = await p.evaluate(() => window.__H.boardCar());
check(bd1.mode === 'off' && bd1.drv && bd1.cur === 'gc8', `got into the GC8 (${bd1.act})`);
if (process.env.HT_EVAL) { // 查問題用：上車以後跑這個檔案就結束
  console.log(JSON.stringify(await p.evaluate(fs.readFileSync(process.env.HT_EVAL, 'utf8'))));
  await b.close(); srv.close(); process.exit(0);
}
const w1 = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, Hl = V.hills, I = Hl.info, T = window.__THREE;
  // 看不到的牆：村子北邊（z −114.5）、南邊（z 94）的長條、400 公尺盡頭（x 761）
  const walls = V.colliders.filter((c) => c.t === 'box' && c.hx >= 13 && Math.abs(c.hz - 1.5) < 0.01 && (Math.abs(c.z + 114.5) < 0.01 || Math.abs(c.z - 94) < 0.01)).length;
  const stripEnd = window.__strip().filter((c) => c.t === 'box' && c.x > 740 && c.x < 780).length;
  // 山的網格（畫出來的）跟 V.heightAt（車子、人踩的）一樣高
  const meshes = []; Hl.group.traverse((o) => { if (o.isMesh && /^hl-hill-/.test(o.name)) meshes.push(o); });
  let nh = null; V.group.traverse((o) => { if (o.name === 'nh-hill') nh = o; });
  const rc = new T.Raycaster(), O = new T.Vector3(), DN = new T.Vector3(0, -1, 0);
  let n = 0, maxD = 0, worst = null;
  for (const h of Hl.list) {
    const rx = h.rx || h.r, rz = h.rz || h.r;
    for (let a = 0.2; a < 6.28; a += 0.7) for (const f of [0, 0.25, 0.5, 0.75, 0.95]) {
      const x = h.x + Math.cos(a) * rx * f, z = h.z + Math.sin(a) * rz * f;
      if (Hl.corrAt(x, z) >= 0 || Hl.lift(x, z) < 0.5) continue;
      O.set(x, 400, z); rc.set(O, DN); const hit = rc.intersectObjects(nh ? [...meshes, nh] : meshes, false)[0]; // 最上面的那一張（山、內湖外面的山）
      const d = hit ? Math.abs(hit.point.y - V.heightAt(x, z)) : 99; n++;
      if (d > maxD) { maxD = d; worst = [Math.round(x), Math.round(z), hit ? +hit.point.y.toFixed(2) : null, +V.heightAt(x, z).toFixed(2)]; }
    }
  }
  // 內湖外面那圈山（neihu.js）也是：網格＝高度
  const RB = V.neihu?.ringBox; let rn = 0, rMax = 0;
  if (nh && V.neihu && V.neihu.ringAt) for (let x = RB[0] + 40; x < RB[2]; x += 157) for (let z = RB[1] + 40; z < RB[3]; z += 163) {
    const v = V.neihu.ringAt(x, z); if (!(v > 1) || Hl.lift(x, z) < 0.5) continue;
    O.set(x, 400, z); rc.set(O, DN); const hit = rc.intersectObjects([...meshes, nh], false)[0]; rn++;
    rMax = Math.max(rMax, hit ? Math.abs(hit.point.y - V.heightAt(x, z)) : 99);
  }
  // 最陡的地方（每座山）
  let steep = 0, steepAt = null;
  for (const h of Hl.list) { const rx = h.rx || h.r, rz = h.rz || h.r; for (let a = 0; a < 6.283; a += 0.13) for (let f = 0.05; f < 1.12; f += 0.03) { const x = h.x + Math.cos(a) * rx * f, z = h.z + Math.sin(a) * rz * f; if (Hl.corrAt(x, z) >= 0) continue; const deg = Math.acos(V.normalAt(x, z)[1]) * 57.2958; if (deg > steep) { steep = deg; steepAt = [Math.round(x), Math.round(z)]; } } }
  // 6 個家：門口、塔、外面的斜坡都在平地上
  const R1 = D.TOWER_RAMP.R1, homes = (V.homeSites || []).map((s) => {
    let m = 0; for (let a = 0; a < 6.283; a += 0.1) for (const r of [0, R1 * 0.5, R1, R1 + 1.5]) m = Math.max(m, Hl.lift(s.x + Math.cos(a) * r, s.z + Math.sin(a) * r)); // 塔、外面的斜坡
    const fx = Math.cos(s.heading), fz = -Math.sin(s.heading); for (let d = R1; d < R1 + 12; d += 1) for (const o of [-5, 0, 5]) m = Math.max(m, Hl.lift(s.x + fx * d - fz * o, s.z + fz * d + fx * o)); // 門口外面
    return +m.toFixed(2);
  });
  // 快速道路（中線左右 9 公尺）、往內湖的路（中線左右 5 公尺）：沒有山（隧道那段＝路的高度 0）
  const roadLift = (kind, pred, off) => { let m = 0, cnt = 0, tunH = 0; for (const r of V.roads) { if (r.kind !== kind || !pred(r)) continue; for (let i = 0; i < r.pts.length - 1; i++) { const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L; for (let s = 0; s < L; s += 2) for (const o of [-off, 0, off]) { const x = ax + ((bx - ax) * s) / L + nx * o, z = az + ((bz - az) * s) / L + nz * o; cnt++; m = Math.max(m, Hl.lift(x, z)); if (Hl.corrAt(x, z) >= 0) tunH = Math.max(tunH, Math.abs(V.heightAt(x, z))); } } } return { m: +m.toFixed(3), cnt, tunH: +tunH.toFixed(3) }; };
  const hwy = roadLift('highway', () => true, 9), link = roadLift('main', (r) => r.pts.some((q) => Math.abs(q[0] + 112) < 1 && q[1] > 200), 5);
  // 沿著 z 0 往西：草地 → 沙灘 → 淺水 → 深水
  const seq = []; for (let x = -1650; x >= -2000; x -= 1) { const s = V.surfaceAt(x, 0); if (seq[seq.length - 1]?.[0] !== s) seq.push([s, x]); }
  return { info: { hills: I.hills, meshes: I.meshes, tris: I.tris, trees: I.trees, tunCols: I.tunCols, ms: I.ms, tunnels: I.tunnels }, walls, stripEnd, n, maxD: +maxD.toFixed(3), worst, rn, rMax: +rMax.toFixed(3), steep: +steep.toFixed(1), steepAt, homes, hwy, link, seq,
    run: [V.surfaceAt(770, 0), V.surfaceAt(900, 5), V.surfaceAt(1005, 0), V.terrainAt(900, 0)], hillT: V.terrainAt(-805, 185), hillS: V.surfaceAt(-805, 185) };
});
console.log('1', el(), JSON.stringify(w1));
check(w1.info.hills === 24 && w1.info.tunnels.length === 2 && w1.info.tunnels[0].name === '快速道路隧道' && w1.info.tunnels[1].name === '內湖隧道' && w1.info.tunnels.every((t) => t.len > 50),
  `24 hills, two tunnels (${w1.info.tunnels.map((t) => `${t.name} ${Math.round(t.len)} m`).join(', ')}); built in ${w1.info.ms} ms, ${w1.info.meshes} meshes, ${w1.info.tris} triangles`);
check(w1.walls === 0 && w1.stripEnd === 0, `no invisible walls: village north/south edge ${w1.walls}, end of the 400 m strip ${w1.stripEnd}`);
check(w1.n > 300 && w1.maxD < 0.05, `the hill meshes match the ground height (${w1.n} points, max ${w1.maxD} m off${w1.maxD >= 0.05 ? ' at ' + JSON.stringify(w1.worst) : ''})`);
check(w1.rn > 20 && w1.rMax < 0.05, `the hills round Neihu match the ground height too (${w1.rn} points, max ${w1.rMax} m off)`);
check(w1.steep < 35, `no hill is steeper than 35° (steepest ${w1.steep}° at ${JSON.stringify(w1.steepAt)})`);
check(w1.homes.length === 6 && w1.homes.every((v) => v < 0.01), `all 6 homes (tower, the ramp round it, in front of the door) are on flat ground (${JSON.stringify(w1.homes)})`);
check(w1.hwy.cnt > 1000 && w1.hwy.m < 0.01 && w1.link.cnt > 100 && w1.link.m < 0.01 && w1.hwy.tunH < 0.01 && w1.link.tunH < 0.01,
  `no hill on the highway (${w1.hwy.cnt} points) or the road to Neihu (${w1.link.cnt}); through the tunnels the road stays at 0 m`);
const seqS = w1.seq.map((q) => q[0]);
check(seqS.indexOf(7) >= 0 && seqS.indexOf(7) < seqS.indexOf(9) && seqS.indexOf(9) < seqS.indexOf(10) && seqS[seqS.length - 1] === 10, `going west at z 0: ${w1.seq.map((q) => `${q[0]}@${q[1]}`).join(' → ')} (sand, shallow, deep water)`);
check(w1.run[0] === 7 && w1.run[1] === 7 && w1.run[2] === 7 && w1.run[3], `past the 400 m strip: sand run-off (${JSON.stringify(w1.run)})`);
check(w1.hillT === true && w1.hillS === 1, 'a hill is terrain with grass on it');

// ================= 2 GC8 開上山 =================
const climb = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, Hl = V.hills, H = window.__H, h = Hl.list.find((q) => q.x === -805 && q.z === 185), cols = H.cols();
  // 找一條沒有樹、沒有護欄的路線：從山外面平地直直開到山頂
  let best = null;
  for (let a = 0; a < 6.283; a += Math.PI / 18) {
    const R = h.r * 1.12 + 14, sx = h.x + Math.cos(a) * R, sz = h.z + Math.sin(a) * R, ex = h.x + Math.cos(a) * 6, ez = h.z + Math.sin(a) * 6;
    if (Hl.lift(sx, sz) > 0.01 || V.surfaceAt(sx, sz) >= 7) continue;
    const c = H.clear(sx, sz, ex, ez, cols); if (c > 4 && (!best || c > best.c)) best = { a, sx, sz, ex, ez, c };
  }
  if (!best) return { err: 'no clear line' };
  const head = Math.atan2(-(best.ez - best.sz), best.ex - best.sx);
  H.put(best.sx, best.sz, head);
  const r = H.follow(H.line(best.sx, best.sz, best.ex, best.ez), 60, { vmax: 14 });
  const st = H.stop();
  return { a: +best.a.toFixed(2), c: +best.c.toFixed(1), r, top: h.h, y: +st.y.toFixed(2), gy: +V.heightAt(st.x, st.z).toFixed(2) };
});
console.log('2', el(), JSON.stringify(climb));
check(!climb.err && climb.r.end && climb.y > climb.top * 0.75, `the GC8 drives up the hill inside the highway loop to ${climb.y} m (top ${climb.top} m; ${climb.r.s} s, ${climb.r.maxKmh} km/h max)`);
check(!climb.err && climb.r.maxDY < 0.6 && climb.r.airT < 0.5 && climb.r.stuck === 0 && climb.r.bumps === 0, `it stays on the ground all the way (max ${climb.r.maxDY} m off, ${climb.r.airT} s in the air, stuck ${climb.r.stuck}, bumps ${climb.r.bumps})`);
const perf = {};
perf.hilltop = await drawAndShot('2-hilltop');
// 開下山（另外一邊）：下坡 50 多公里也一直貼著地面（terrain.js 第 27 批：落地以後跟著地面往下，不會一直彈起來）
const down = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, Hl = V.hills, H = window.__H, h = Hl.list.find((q) => q.x === -805 && q.z === 185), cols = H.cols(), t = D.drv.telemetry();
  let best = null; const R = h.r * 1.15;
  for (let a = 0; a < 6.283; a += Math.PI / 18) { const ex = h.x + Math.cos(a) * R, ez = h.z + Math.sin(a) * R; if (V.surfaceAt(ex, ez) >= 7 || Hl.lift(ex, ez) > 0.01) continue; const c = H.clear(t.x, t.z, ex, ez, cols); if (c > 4 && (!best || c > best.c)) best = { a, ex, ez, c }; }
  if (!best) return { err: 'no clear line' };
  const r = H.follow(H.line(t.x, t.z, best.ex, best.ez), 60, { vmax: 16 });
  return { a: +best.a.toFixed(2), r };
});
console.log('2b', el(), JSON.stringify(down));
check(!down.err && down.r.end && down.r.airT < 0.5 && down.r.maxDY < 0.6 && down.r.bumps === 0, `driving down the other side at ${down.r?.maxKmh} km/h the car stays on the ground (${down.r?.airT} s in the air, max ${down.r?.maxDY} m off)`);

// ================= 3 穿過隧道 =================
const tun = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, Hl = V.hills, H = window.__H, out = {};
  const dir = (k) => { const L = (Hl.lights || []).find(([o]) => o.isDirectionalLight); return L ? +(L[0].intensity / L[1]).toFixed(3) : null; };
  for (const [k, T, pts] of [['t1', Hl.tunnels[0], H.hwyLane(-330, 40, 3.175)], ['t2', Hl.tunnels[1], H.line(-115.4, 165, -115.4, 296)]]) {
    const [x, z0] = pts[0]; H.put(x, z0, Math.atan2(-(pts[1][1] - z0), pts[1][0] - x), 60);
    const s = { high: false, camMax: -99, dimMin: 1, inside: 0, light: 1 };
    const r = H.follow(pts, 60, { vmax: 22, each: (q) => {
      if (Hl.high) s.high = true;
      if (Hl.tunAt(q.x, q.z) >= 0) { s.inside++; if (q.z > T.z0 + 25 && q.z < T.z1 - 25) { s.camMax = Math.max(s.camMax, D.dcam.position.y); s.dimMin = Math.min(s.dimMin, Hl.dimK); s.light = Math.min(s.light, dir() ?? 1); } }
    } });
    H.step(120);
    out[k] = { r, ...s, camMax: +s.camMax.toFixed(2), dimMin: +s.dimMin.toFixed(2), light: +s.light.toFixed(2), after: +Hl.dimK.toFixed(3), lightAfter: dir(), ceil: Hl.ceil };
  }
  return out;
});
console.log('3', el(), JSON.stringify(tun));
for (const [k, n] of [['t1', '快速道路隧道'], ['t2', '內湖隧道']]) {
  const t = tun[k];
  check(t.r.end && t.inside > 60 && t.r.bumps === 0 && t.r.stuck === 0, `drove through 「${n}」 without hitting anything (${t.inside} frames inside, ${t.r.maxKmh} km/h, bumps ${t.r.bumps})`);
  check(Math.abs(t.r.maxY) < 0.15 && Math.abs(t.r.minY) < 0.15 && !t.high && t.r.airT === 0, `  the road through it is flat (y ${t.r.minY}…${t.r.maxY} m) and you stay on the lower level`);
  check(t.camMax < t.ceil + 0.05, `  the chase camera stays under the tunnel roof (max ${t.camMax} m, roof ${t.ceil} m)`);
  check(t.dimMin < 0.5 && t.light < 0.5 && t.after === 1 && t.lightAfter === 1, `  inside it is darker (sun ×${t.light}), outside bright again (×${t.lightAfter})`);
}
await p.evaluate(() => { window.__H.put(-1033.2, -150, -Math.PI / 2, 90); });
perf.t1in = await drawAndShot('3-in-tunnel');
await p.evaluate(() => { window.__H.put(-1033.2, -262, -Math.PI / 2, 90); });
perf.t1portal = await drawAndShot('3-tunnel-portal');

// ================= 4 開上隧道那座山、開過隧道上面 =================
const over = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, Hl = V.hills, H = window.__H, T = Hl.tunnels[0], h = Hl.list.find((q) => q.tun === 0), cols = H.cols();
  // 找一條（東→西）沒有樹的線，在隧道那段的中間
  let zc = null, cBest = 0;
  for (let z = T.z0 + 30; z <= T.z1 - 30; z += 3) { Hl.level(9); const c = H.clear(h.x + h.r * 1.12 + 25, z, h.x - h.r * 1.12 - 15, z, H.cols()); Hl.level(0); if (c > cBest) { cBest = c; zc = z; } }
  if (zc == null || cBest < 3) return { err: 'no clear line', cBest };
  const x0 = h.x + h.r * 1.12 + 25, x1 = h.x - h.r * 1.12 - 15;
  H.put(x0, zc, Math.PI, 60);
  const s = { onTop: 0, hiOver: true, minYover: 99, dyHill: 0 };
  const r = H.follow(H.line(x0, zc, x1, zc), 90, { vmax: 13, each: (q) => {
    if (q.x > T.x0 + 1 && q.x < T.x1 - 1) { s.onTop++; if (!Hl.high) s.hiOver = false; s.minYover = Math.min(s.minYover, q.y); }
    if (Math.abs(q.x - h.x) < h.r * 0.85 && !q.air) s.dyHill = Math.max(s.dyHill, Math.abs(D.tripS.car.position.y - H.groundAt(q.x, q.z))); // 這座山上（山跟山中間的山谷是 V 字形：車子中間會比最低點高一點，不算）
  } });
  H.step(30);
  const end = D.drv.telemetry(); end.y = D.tripS.car.position.y; end.high = Hl.high;
  // 洞口上面的欄杆：在山上往北開向挖開的路（下面是隧道口），會被擋住、不會掉下去
  const P = Hl.list.find((q) => q.tun === 0);
  Hl.level(9); H.put(T.x0 + 7, T.z0 + 22, Math.PI / 2, 60); // 放到山上（上面那層）
  const y0 = D.tripS.car.position.y, hi0 = Hl.high;
  const r2 = H.follow(H.line(T.x0 + 7, T.z0 + 22, T.x0 + 7, T.z0 - 30), 8, { vmax: 9 });
  const st = H.stop();
  return { zc, c: +cBest.toFixed(1), r, ...s, minYover: +s.minYover.toFixed(2), dyHill: +s.dyHill.toFixed(2), top: +(Hl.ceil + 0.6).toFixed(1), endHigh: end.high, endY: +end.y.toFixed(2), endX: +end.x.toFixed(1),
    edge: { y0: +y0.toFixed(2), hi0, bumps: r2.bumps, z: +st.z.toFixed(1), y: +D.tripS.car.position.y.toFixed(2), minY: r2.minY, z0: T.z0 }, hillH: P.h };
});
console.log('4', el(), JSON.stringify(over));
check(!over.err && over.r.end && over.onTop > 30 && over.r.stuck === 0, `drove up the tunnel hill from the east, over the top and down the west side (${over.r.s} s; top ${over.r.maxY} m)`);
check(!over.err && over.hiOver && over.minYover > over.top + 1, `over the tunnel you drive on the hill (upper level the whole way, at least ${over.minYover} m; the tunnel roof is ${over.top} m)`);
check(!over.err && over.r.bumps === 0 && over.dyHill < 0.6 && over.r.airT < 0.5, `nothing below (highway rails, tunnel walls) gets in the way up there (bumps ${over.r.bumps}, max ${over.dyHill} m off the ground on the hill, ${over.r.airT} s in the air)`);
check(!over.err && !over.endHigh && over.endY < 0.5, `back down on the flat: lower level again (y ${over.endY} m)`);
check(!over.err && over.edge.hi0 && over.edge.bumps > 0 && over.edge.z > over.edge.z0 - 1 && over.edge.minY > 7, `the railing above the tunnel mouth stops you (stopped at z ${over.edge.z}, never below ${over.edge.minY} m)`);

// ================= 5 開進海裡 =================
const sea = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, Hl = V.hills, H = window.__H, d = D.drv;
  H.put(-1700, 0, Math.PI, 60);
  let toast = '', maxDepth = 0, minX = 0;
  d.setInput({ throttle: 1, brake: 0, steer: 0 });
  for (let i = 0; i < 20 * 60; i++) { H.step(1); const t = d.telemetry(); minX = Math.min(minX, t.x); maxDepth = Math.max(maxDepth, Hl.depth(t.x, t.z)); const e = [...document.querySelectorAll('#stage .dv-toast.show')].map((q) => q.textContent).join('|'); if (/海/.test(e)) toast = e; }
  const t1 = d.telemetry();
  d.setInput({ throttle: 0, brake: 1, steer: 0 }); // 停住了再踩煞車＝倒車
  for (let i = 0; i < 14 * 60; i++) H.step(1);
  d.setInput(null); const t2 = H.stop();
  return { minX: +minX.toFixed(1), maxDepth: +maxDepth.toFixed(2), x1: +t1.x.toFixed(1), v1: +t1.v.toFixed(2), s1: t1.surface, toast, x2: +t2.x.toFixed(1), depth2: +Hl.depth(t2.x, t2.z).toFixed(2), y1: +t1.y.toFixed(2) };
});
console.log('5', el(), JSON.stringify(sea));
check(Math.abs(sea.v1) < 0.5 && sea.minX > -1900 && sea.maxDepth > 0.4, `full throttle into the sea: the car slows down and stops in the water (x ${sea.x1}, ${sea.maxDepth} m deep, ${sea.v1} m/s)`);
check(/前面是海/.test(sea.toast), `it says 「${sea.toast}」`);
check(sea.x2 > sea.x1 + 15 && sea.depth2 < 0.1, `reversing gets you back out (x ${sea.x1} → ${sea.x2}, ${sea.depth2} m deep)`);

// ================= 6 走路：深水走不過去 =================
const wk = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, Hl = V.hills, H = window.__H;
  H.put(-1760, 30, Math.PI, 40); H.stop();
  window.__leave(); for (let i = 0; i < 300 && D.walker.mode !== 'walk'; i++) H.step(1); H.step(20);
  const W = D.walker; let minX = 0, maxDepth = 0, moved = 0; const t0 = W.telemetry();
  for (let i = 0; i < 30 * 60; i++) { const t = W.telemetry(), a = Math.PI - t.camYaw; W.setInput({ x: -Math.sin(a), y: Math.cos(a), run: true }); H.step(1); const q = W.telemetry(); minX = Math.min(minX, q.x); maxDepth = Math.max(maxDepth, Hl.depth(q.x, q.z)); }
  const deepOk = maxDepth < 0.55; // walk.js：水深 0.55 公尺以上走不進去
  W.setInput(null); H.step(10);
  const t = W.telemetry(), ok = V.walkable(t.x, t.z), gy = V.heightAt(t.x, t.z), y = W.character.group.position.y;
  const back = H.boardCar();
  return { mode0: t0.mode, x0: +t0.x.toFixed(1), x: +t.x.toFixed(1), minX: +minX.toFixed(1), maxDepth: +maxDepth.toFixed(2), ok, deepOk, y: +y.toFixed(2), gy: +gy.toFixed(2), back: back.mode };
});
console.log('6', el(), JSON.stringify(wk));
check(wk.mode0 === 'walk' && wk.x < wk.x0 - 20, `walked out of the car onto the beach and toward the sea (x ${wk.x0} → ${wk.x})`);
check(wk.ok && wk.deepOk && Math.abs(wk.y - wk.gy) < 0.3, `the walker stops where the water gets deep (deepest ${wk.maxDepth} m; feet at ${wk.y} m, ground ${wk.gy} m)`);
check(wk.back === 'off', 'back in the car');

// ================= 7 400 公尺後面：沙地 =================
const run = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, H = window.__H, d = D.drv;
  H.put(560, -3.5, 0, 40);
  const t0 = d.telemetry(); let kAt = 0, kSand = 999, xPass = null;
  d.setInput({ throttle: 1, brake: 0, steer: 0 });
  for (let i = 0; i < 25 * 60; i++) { H.step(1); const t = d.telemetry(); if (t.x < 761) kAt = t.kmh; if (t.x > 900 && t.x < 960) kSand = Math.min(kSand, t.kmh); if (t.x > 980) { xPass = t.x; break; } }
  const t1 = d.telemetry(); d.setInput(null); H.stop();
  return { bumps: t1.bumps - t0.bumps, kAt: Math.round(kAt), kSand: Math.round(kSand), xPass: xPass && +xPass.toFixed(1), surf: V.surfaceAt(t1.x, t1.z) };
});
console.log('7', el(), JSON.stringify(run));
check(run.xPass != null && run.bumps === 0, `the 400 m strip has no wall at its end: drove past x 761 onto the sand (bumps ${run.bumps})`);
check(run.kAt > 80 && run.kSand < 45, `on the sand the car slows down (${run.kAt} km/h at the end of the asphalt, ${run.kSand} km/h on the sand)`);
perf.runoff = await drawAndShot('7-runoff');

// ================= 8 從村子往南、往北開出去 =================
const edge = await p.evaluate(() => {
  const D = window.__D(), V = D.VIL, H = window.__H, cols = H.cols(), out = {};
  for (const [k, za, zb, xs] of [['south', 72, 128, [-480, -140]], ['north', -100, -150, [-500, -70]]]) {
    let x = null;
    for (let q = xs[0]; q <= xs[1]; q += 4) if (H.clear(q, za, q, zb, cols) > 3 && V.heightAt(q, za) === 0) { x = q; break; }
    if (x == null) { out[k] = { err: 'no clear line' }; continue; }
    H.put(x, za, zb > za ? -Math.PI / 2 : Math.PI / 2, 40);
    const r = H.follow(H.line(x, za, x, zb), 30, { vmax: 14 });
    out[k] = { x, end: r.end, bumps: r.bumps, z: r.z };
  }
  return out;
});
console.log('8', el(), JSON.stringify(edge));
check(edge.south.end && edge.south.bumps === 0, `drove south out of the village across z 94 with no wall (x ${edge.south.x})`);
check(edge.north.end && edge.north.bumps === 0, `drove north out of the village across z −114.5 with no wall (x ${edge.north.x})`);

// ================= 9 效能 =================
await p.evaluate(() => window.__npcPause(false));
await p.evaluate(() => { window.__H.put(-1765, 20, Math.PI, 90); });
perf.beach = await drawAndShot('9-beach');
await p.evaluate(() => { window.__H.put(-115.4, 172, -Math.PI / 2, 90); });
perf.home4 = await drawAndShot('9-home4-tunnel');
await p.evaluate(() => { window.__H.put(-1033.2, -262, -Math.PI / 2, 90); });
perf.portalTraffic = await drawAndShot('9-portal-traffic');
const upd = await p.evaluate(() => {
  const D = window.__D(), Hl = D.VIL.hills, cam = D.dcam, sc = D.TR.scene, N = 3000;
  const t0 = performance.now(); for (let i = 0; i < N; i++) { Hl.level(i % 2 ? 0.4 : 0.5); Hl.update(1 / 60, cam, sc); } const ms = (performance.now() - t0) / N;
  const tH = performance.now(); let s = 0; for (let i = 0; i < N; i++) s += D.VIL.heightAt(-1000 + (i % 300), -200 + (i % 97)); const hms = (performance.now() - tH) / N;
  return { ms: +ms.toFixed(4), heightAt: +hms.toFixed(5), s: s > 0 };
});
console.log('9', el(), 'perf', JSON.stringify(perf), 'update', JSON.stringify(upd));
check(upd.ms < 0.05 && upd.heightAt < 0.01, `hills.update takes ${upd.ms} ms a frame; one height lookup ${upd.heightAt} ms`);
check(Object.values(perf).every((q) => q && q.calls < 420 && q.tris < 2.2e6), `draw calls / triangles: ${Object.entries(perf).map(([k, q]) => `${k} ${q.calls}/${(q.tris / 1e6).toFixed(2)}M`).join(', ')}`);

await b.close(); srv.close();
console.log(errs.length ? `page errors: ${errs.length}` : 'no page errors');
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' / ')}` : 'ALL CHECKS OK');
process.exit(fails.length || errs.length ? 1 : 0);
