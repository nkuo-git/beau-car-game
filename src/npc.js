// ---- 路上的人和車（第 2 批）：別人開的車、騎機車的、快速道路上的車流；村子裡走來走去的居民 ----
// Nick 2026-09-28：「要有居民也要有別人在開車」「城市做越真越好」
// 全部程式做：汽車用 carlod.js 的輕量車（LOD，照路上常見的比例、真的車色）、騎機車的人和走路的人用 buildCharacter（character.js；現在先用 charstub.js 替身，API 一樣）
//   機車、板凳（廟前大榕樹的樹圍椅、超商門口的長椅、幾戶門口的塑膠椅）這裡做（機車一台一個 draw call、板凳全部一個）
// 座標跟 village.js、drive.js 一樣：公尺；x 往東、y 往上、z 往南；heading＝rotation.y（0 朝 +x、π/2 朝北 −z）；前進 (cos h, −sin h)、右邊 (sin h, cos h)；靠右開
//
// 【API】
//   npcGraphs(V) → { lanes, walk }        路線圖（同一個 V 只做一次；約 150–250 ms）：載入畫面先叫一次，不然第一個 createTraffic／createPedestrians 會做
//     lanes：每條路每個方向一條車道（村子的路、大路、農路；快速道路雙向各兩線），路口的轉彎線（誰讓誰、會交叉的線）、閃開路上障礙物的那段（zone）
//     walk：人走的線：路兩邊（路邊再往外 0.75 公尺，避開電線桿、樹、機車）、路口轉角、斑馬線（每個路口每一支＋長的路中間）、每一戶的大門、板凳
//
//   const traffic = createTraffic({
//     world: V, scene,
//     lod: { keys, load(key) → Promise<gltf scene>, build(key, scene, look) → { car, body, setLook, setRoll, dispose } },  // 接 carlod.js（見下面【接法】）
//     makeCharacter, randomLook,            騎機車的人（沒給就沒有機車）
//     camera,                               生車／收車：看得到的地方不生、不收（沒給就用 focus.heading 前面 ±75°）
//     max = 10, radius = 350, seed,         同時最多幾台；離 focus 多遠以外收掉
//     sound: { ctx, out, gain, muted() },   喇叭（可以不給；ctx 可以是函式）
//     onHonk(car), onCarHit(car, speed),    按喇叭、被玩家撞到的時候叫
//   })
//   await traffic.prewarm()                 載入畫面：等車的模型載好、先做好 max 台車＋幾台機車放在池子裡（沒做的話之後一幀最多做一台，第一次補滿會慢慢來）
//   traffic.update(dt, focus = { x, z, heading }, obstacles = [玩家的車], people = peds.people)     每幀叫
//     obstacles：{ x, z, heading, v, hx, hz }（車身中心、方向、速度 m/s、半長、半寬）：AI 車停在後面（不撞上去）、路口讓它、
//                被擋住按喇叭（最多三次）、被撞到停下來（2–4 秒）按喇叭再開走；hx ≤ 0.5 的（走路的玩家）只當成走路的人
//   traffic.cars：現在路上的車 [{ id, ai: true, kind: 'car' | 'scooter', key, x, z, heading, v, hx, hz, edge, stun, … }]（唯讀）
//   traffic.colliders(x, z, r) → [{ t: 'box', x, z, hx, hz, rot, h, npc: true }]   給 drive.js addColliders（每幀換；重複用同一批物件，不要留著）
//   第 7 批（輾扁）：obstacles 裡 crush 是 true 的（怪獸卡車）靠到汽車身上 → 那台車從 traffic.cars 拿出來放到 traffic.wrecks（停住、別的車不理它、碰撞也沒有了）、叫 onCrush(car)；
//     crush.js 畫面（car.lod.setSquash）、地形（墊子）接手，過一會兒叫 traffic.recycle(car) 收回池子（車頂、駕駛、高度都回原狀）
//   traffic.stats、traffic.time、traffic.dispose()
//
//   const peds = createPedestrians({ world: V, scene, makeCharacter, randomLook, camera, max = 20, radius = 150, visible = 125, seed, animNear = 45, animMid = 90,
//                                    onHit(person, speed, car) })     被車撞倒的時候叫（car.ai 是 true＝路上的 AI 車：不會發生，AI 車會停，最多輕輕推開）
//   peds.prewarm(n = max + 4)             載入畫面：先做好角色（沒做的話第一次補滿一次做完，之後一幀最多做一個）
//   peds.update(dt, focus, cars = [玩家的車, traffic.cars], walkers = [走路的玩家 { x, z, r }])   每幀叫；cars 裡可以放陣列（會攤開）
//     cars：{ x, z, heading, v, hx, hz, ai }：ai 不是 true 的（玩家、之後的警車）開快（> 2.2 m/s）撞到人 → 撞飛、onHit；慢慢碰到 → 推開、生氣；
//           開過來 → 1.3 秒內會撞到的人往旁邊跳開（嚇呆的不會）；停著的車（停在人行道上）→ 繞過去
//   peds.people：[{ id, x, z, y, heading, v, r, mode, age: 'kid' | 'adult' | 'elder', ch（buildCharacter 的角色）, … }]（唯讀）
//     mode：walk 走路、wait 路邊等過馬路、talk 聊天、sitdown／sit／standup 坐板凳、enter 進門、idle 站一下、dodge 跳開、flee 嚇跑、
//           fall 撞飛、lie 躺著、getup 爬起來、angry 生氣揮手、return 走回人行道
//   peds.colliders(x, z, r) → [{ t: 'circle', x, z, r, h, npc: 'ped', person }]   給走路的玩家擋（不要加到開車的碰撞：開車撞人用 onHit）
//   peds.knock(person, dirX, dirZ, speed = 6, car = null)   揍人、撞人：往那個方向倒（倒地→躺→爬起來→生氣→走開；卡通的，沒有血）
//   peds.scare(x, z, r = 12)              附近的人跑開（喇叭、撞車、之後的槍聲）
//   peds.bail(x, z, dx, dz, n = 1)        第 7 批（輾扁）：車上的人跳車往 (dx, dz) 跑掉（大人、沒受傷：嚇跑幾秒再走回人行道）→ 幾個人出來
//   peds.nearest(x, z, r = 1.5) → 最近的人（揍人用）
//   peds.props.colliders                  板凳、塑膠椅的碰撞（加到 drive.js 一次）；peds.props.seats
//   peds.stats、peds.time、peds.dispose()
//
// 【接法（遊戲迴圈）】
//   載入：npcGraphs(V); const lod = { keys: Object.keys(LOD_CARS), load: (k) => LOD_CARS[k].load(), build: (k, sc, look) => buildLodCar(k, sc, look) };
//         traffic = createTraffic({ world: V, scene, lod, camera, makeCharacter: buildCharacter, randomLook, sound }); await traffic.prewarm();
//         peds = createPedestrians({ world: V, scene, camera, makeCharacter: buildCharacter, randomLook, onHit }); peds.prewarm();
//         drv.addColliders(peds.props.colliders, 'npc-props')
//         物件、陣列做一次重複用（每幀不要 new）：const me = { x: 0, z: 0, heading: 0, v: 0, hx: 2.2, hz: 0.9 }, focus = { x: 0, z: 0, heading: 0 }, OBS = [me], PCARS = [me, traffic.cars];
//   每幀（開車）：const t = drv.telemetry(), ci = drv.carInfo, CX = (ci.nose + ci.tail) / 2;
//         me.x = t.x + Math.cos(t.heading) * CX; me.z = t.z - Math.sin(t.heading) * CX; me.heading = t.heading; me.v = t.v; me.hx = ci.len / 2; me.hz = ci.halfW;
//         focus.x = t.x; focus.z = t.z; focus.heading = t.heading;
//         traffic.update(dt, focus, OBS, peds.people); peds.update(dt, focus, PCARS);
//         drv.removeColliders('traffic'); drv.addColliders(traffic.colliders(t.x, t.z, 30), 'traffic');
//         peds 的 onHit(person, speed, car)：car.ai 不是 true 就是玩家撞的（之後第 3 批：被抓去關）
//   每幀（走路）：me 改成走路的人（hx = hz = 0.3、v = 0，放在 OBS 裡 AI 車會停、按喇叭，路口不用讓）；traffic.update(dt, focus, OBS, peds.people)；
//         peds.update(dt, focus, [traffic.cars], WALK)（WALK = [walker { x, z, r }]，陣列也做一次）；走路的碰撞：traffic.colliders(x, z, 10)、peds.colliders(x, z, 3)
//   打包：build-art.mjs／build-app.mjs 的檔案清單 npc.js 放在 carlod.js（和 character.js）後面；這個檔只露出 createTraffic、createPedestrians、npcGraphs
// 【效能】update 一幀：車流約 0.03 ms、居民約 0.05 ms（node、替身角色；真的 character.js 的 update 比較貴，居民會變成約 0.4 ms，要省就把 animNear／animMid 調小）；
//   每幀不配置新的物件（V8 自己的 boxing 約 4 KB）；遠的人 4 幀動一次、45／90 公尺外動畫隔幀、125 公尺外不畫；看不到的地方才生、收；
//   機車最多三成（機車不上快速道路）；人在快速道路上的時候快速道路上多生一點車
import * as THREE from 'three';

export const { createTraffic, createPedestrians, npcGraphs } = (() => {
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hyp = (a, b) => Math.sqrt(a * a + b * b); // 每幀用的（Math.hypot 會配置記憶體）
const wrapA = (a) => { a = (a + Math.PI) % TAU; return a < 0 ? a + Math.PI : a - Math.PI; };
function rngOf(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function pickW(r, list) { let t = 0; for (const it of list) t += it.w; let x = r() * t; for (const it of list) { x -= it.w; if (x <= 0) return it; } return list[list.length - 1]; }

// ---- 折線（x, z 交錯的 Float64Array；cum＝累積長度）----
function dedupe(pts, eps = 0.05) { const out = []; for (const p of pts) if (!out.length || Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) > eps) out.push([p[0], p[1]]); return out; }
function plen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function mkLine(pts) {
  const n = pts.length, P = new Float64Array(n * 2), cum = new Float64Array(n);
  for (let i = 0; i < n; i++) { P[i * 2] = pts[i][0]; P[i * 2 + 1] = pts[i][1]; if (i) cum[i] = cum[i - 1] + Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]); }
  return { P, cum, n, len: cum[n - 1] };
}
function segOf(L, s) { // cum[i] ≤ s < cum[i+1] 的那一段（超出兩頭就用頭尾那段）
  const c = L.cum; let lo = 0, hi = L.n - 2;
  if (s <= 0) return 0;
  if (s >= c[hi]) return hi;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (c[m] <= s) lo = m; else hi = m - 1; }
  return lo;
}
const pt = () => ({ x: -0, z: -0, dx: -0, dz: -0, i: 0, t: -0, ri: 0, rem: -0 }); // lineAt 的輸出（全部同一個形狀，JIT 才不會一直重來）
function lineAt(L, s, out) { // 距離 s 的點＋方向（超出兩頭照頭尾那段直直延伸）；out.i、out.t＝哪一段、段內比例
  const i = segOf(L, s), P = L.P, sl = L.cum[i + 1] - L.cum[i] || 1e-9, t = (s - L.cum[i]) / sl;
  const x0 = P[i * 2], z0 = P[i * 2 + 1], ex = P[i * 2 + 2] - x0, ez = P[i * 2 + 3] - z0;
  out.x = x0 + ex * t; out.z = z0 + ez * t; out.dx = ex / sl; out.dz = ez / sl; out.i = i; out.t = t;
  return out;
}
// 往右（行進方向的右手邊＝(−dz, dx)）平移 d 公尺（轉角斜接）
function offsetPts(pts, d) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    let k = 1;
    if (i > 0 && i < n - 1) { const sx = pts[i][0] - pts[i - 1][0], sz = pts[i][1] - pts[i - 1][1], sl = Math.hypot(sx, sz) || 1; k = 1 / Math.max(0.5, (sx * tx + sz * tz) / sl); }
    out.push([pts[i][0] - tz * d * k, pts[i][1] + tx * d * k]);
  }
  return out;
}
function subPts(pts, s0, s1) { // 折線上 s0…s1 那一段
  const out = []; let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), e0 = acc, e1 = acc + l; acc = e1;
    if (l <= 0 || e1 < s0 || e0 > s1) continue;
    if (!out.length) { const t = clamp((s0 - e0) / l, 0, 1); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    if (e1 <= s1) out.push([b[0], b[1]]);
    else { const t = clamp((s1 - e0) / l, 0, 1); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); break; }
  }
  return dedupe(out, 0.02);
}
function resample(pts, step) { // 大約每 step 公尺一點（頭尾都留）
  const L = plen(pts), n = Math.max(1, Math.round(L / step)), line = mkLine(pts), o = pt(), out = [];
  for (let i = 0; i <= n; i++) { lineAt(line, (L * i) / n, o); out.push([o.x, o.z]); }
  return out;
}
// 點到線段的距離平方（不配置記憶體）
function segD2(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-12; let t = ((px - ax) * dx + (pz - az) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t; const ex = px - ax - dx * t, ez = pz - az - dz * t; return ex * ex + ez * ez; }
function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-12; const t = clamp(((px - ax) * dx + (pz - az) * dz) / L2, 0, 1); return [Math.hypot(px - ax - dx * t, pz - az - dz * t), t]; }
function bezier(p0, p1, p2, p3, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t; out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]); }
  return out;
}
// 轉彎的路線：從 p0（方向 d0）到 p3（方向 d3）。兩條切線交在 Q：把手＝到 Q 的距離 ×（圓弧的比例），不對稱的轉角也順
function turnCurve(p0, d0, p3, d3, step = 1.2) {
  const rx = p3[0] - p0[0], rz = p3[1] - p0[1], ch = Math.hypot(rx, rz), det = d0[0] * d3[1] - d0[1] * d3[0];
  let k0 = ch / 3, k3 = ch / 3;
  if (Math.abs(det) > 0.08) {
    const a = (rx * d3[1] - rz * d3[0]) / det, b = (d0[0] * rz - d0[1] * rx) / det;
    const th = Math.acos(clamp(d0[0] * d3[0] + d0[1] * d3[1], -1, 1)), ratio = th > 1e-3 ? ((4 / 3) * Math.tan(th / 4)) / Math.tan(th / 2) : 2 / 3;
    if (a > 0.3 && b > 0.3) { k0 = a * ratio; k3 = b * ratio; }
  }
  const p1 = [p0[0] + d0[0] * k0, p0[1] + d0[1] * k0], p2 = [p3[0] - d3[0] * k3, p3[1] - d3[1] * k3];
  return bezier(p0, p1, p2, p3, clamp(Math.ceil((k0 + k3 + ch) / 2 / step), 4, 40));
}
// 圓角轉彎：直線 → 半徑 R 的圓弧（貝茲近似）→ 直線（快速道路路口：穿過中間護欄開口的地方要在開口正中間）
function filletCurve(p0, d0, p3, d3, R, step = 1.2) {
  const rx = p3[0] - p0[0], rz = p3[1] - p0[1], det = d0[0] * d3[1] - d0[1] * d3[0];
  if (Math.abs(det) < 0.08) return turnCurve(p0, d0, p3, d3, step);
  const a = (rx * d3[1] - rz * d3[0]) / det, b = (d0[0] * rz - d0[1] * rx) / det, Q = [p0[0] + d0[0] * a, p0[1] + d0[1] * a];
  const th = Math.acos(clamp(d0[0] * d3[0] + d0[1] * d3[1], -1, 1)), T = Math.min(R * Math.tan(th / 2), a * 0.98, b * 0.98), k = T * (((4 / 3) * Math.tan(th / 4)) / Math.tan(th / 2));
  const s0 = [Q[0] - d0[0] * T, Q[1] - d0[1] * T], s3 = [Q[0] + d3[0] * T, Q[1] + d3[1] * T];
  const arc = bezier(s0, [s0[0] + d0[0] * k, s0[1] + d0[1] * k], [s3[0] - d3[0] * k, s3[1] - d3[1] * k], s3, clamp(Math.ceil((2 * T) / step), 6, 40));
  return dedupe(resample([p0, s0], 4).concat(arc.slice(1), resample([s3, p3], 4).slice(1)), 0.02);
}
const headOf = (dx, dz) => Math.atan2(-dz, dx); // 方向 → heading（rotation.y）

// ---- 碰撞物的格子（xz 平面）：{ t: 'box', x, z, hx, hz, rot } | { t: 'circle', x, z, r }；near() 回傳同一個陣列（下一次會蓋掉）----
function colliderGrid(list, cell = 8) {
  const grid = new Map(), big = [], key = (i, j) => i * 100003 + j, out = [];
  let stamp = 0;
  const add = (c0) => {
    const box = c0.t === 'box', c = box ? { t: 'box', x: c0.x, z: c0.z, hx: c0.hx, hz: c0.hz, cs: Math.cos(c0.rot || 0), sn: Math.sin(c0.rot || 0), h: c0.h, src: c0, _s: 0 } : { t: 'circle', x: c0.x, z: c0.z, r: c0.r, h: c0.h, src: c0, _s: 0 };
    const ex = box ? Math.abs(c.cs) * c.hx + Math.abs(c.sn) * c.hz : c.r, ez = box ? Math.abs(c.sn) * c.hx + Math.abs(c.cs) * c.hz : c.r;
    c.ex = ex; c.ez = ez;
    if (ex > 60 || ez > 60) { big.push(c); return; }
    for (let i = Math.floor((c.x - ex) / cell); i <= Math.floor((c.x + ex) / cell); i++) for (let j = Math.floor((c.z - ez) / cell); j <= Math.floor((c.z + ez) / cell); j++) { let a = grid.get(key(i, j)); if (!a) grid.set(key(i, j), (a = [])); a.push(c); }
  };
  for (const c of list || []) if (c && isFinite(c.x) && isFinite(c.z)) add(c);
  return {
    add,
    near(x0, z0, x1, z1) {
      stamp++; out.length = 0;
      for (const c of big) if (c.x + c.ex >= x0 && c.x - c.ex <= x1 && c.z + c.ez >= z0 && c.z - c.ez <= z1) out.push(c);
      for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
        const a = grid.get(key(i, j)); if (!a) continue;
        for (const c of a) if (c._s !== stamp) { c._s = stamp; out.push(c); }
      }
      return out;
    },
  };
}
// 有方向的長方形（中心 x, z、方向 (dx, dz)、半長 hl、半寬 hw）碰不碰得到碰撞物 c
function rectHits(c, x, z, dx, dz, hl, hw, m = 0) {
  const ox = x - c.x, oz = z - c.z;
  if (c.t === 'circle') { const lx = ox * dx + oz * dz, lz = -ox * dz + oz * dx, ex = Math.abs(lx) - hl, ez = Math.abs(lz) - hw, qx = ex > 0 ? ex : 0, qz = ez > 0 ? ez : 0, r = c.r + m; return qx * qx + qz * qz < r * r; }
  const ux = c.cs, uz = -c.sn, wx = c.sn, wz = c.cs, rx = -dz, rz = dx;
  const ax = [dx, dz, rx, rz, ux, uz, wx, wz];
  for (let k = 0; k < 8; k += 2) {
    const px = ax[k], pz = ax[k + 1], d = Math.abs(ox * px + oz * pz);
    const ra = hl * Math.abs(dx * px + dz * pz) + hw * Math.abs(rx * px + rz * pz), rb = c.hx * Math.abs(ux * px + uz * pz) + c.hz * Math.abs(wx * px + wz * pz);
    if (d >= ra + rb + m) return false;
  }
  return true;
}
// 車子的腳印放得下嗎：不碰到碰撞物、四個角都在路面上（路面：0 大路、3 小路水泥地、4 快速道路）
function footprintClear(cg, V, x, z, dx, dz, hl, hw) {
  const r = Math.hypot(hl, hw);
  for (const c of cg.near(x - r, z - r, x + r, z + r)) if (rectHits(c, x, z, dx, dz, hl, hw, 0.12)) return false;
  for (let sx = -1; sx <= 1; sx += 2) for (let sz = -1; sz <= 1; sz += 2) { const s = V.surfaceAt(x + dx * sx * (hl - 0.15) - dz * sz * (hw - 0.15), z + dz * sx * (hl - 0.15) + dx * sz * (hw - 0.15)); if (s === 1 || s === 2) return false; }
  return true;
}
function projectOn(L, x, z) { // 折線上離 (x, z) 最近的點的距離 s
  let best = Infinity, bs = 0; const P = L.P;
  for (let i = 0; i < L.n - 1; i++) {
    const ax = P[i * 2], az = P[i * 2 + 1], dx = P[i * 2 + 2] - ax, dz = P[i * 2 + 3] - az, L2 = dx * dx + dz * dz || 1e-12;
    let t = ((x - ax) * dx + (z - az) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = x - ax - dx * t, ez = z - az - dz * t, d = ex * ex + ez * ez;
    if (d < best) { best = d; bs = L.cum[i] + t * (L.cum[i + 1] - L.cum[i]); }
  }
  return bs;
}

// ---- 路網：V.roads 的大路、村子的路、農路 → 節點（路口、端點）＋路（兩個節點之間的折線）----
// cars：開車用的（死路剪掉，除了接快速道路的那頭）；不是 cars：走路用的（全部的路都留著）
const KIND = { main: { v: 50 / 3.6, rank: 3, spawn: 1 }, street: { v: 30 / 3.6, rank: 2, spawn: 0.9 }, farm: { v: 25 / 3.6, rank: 1, spawn: 0.3 } };
function roadNet(V, cars) {
  let roads = [];
  for (const r of V.roads) if (KIND[r.kind] && !r.noNpc) { const pts = dedupe(r.pts); if (pts.length >= 2) roads.push({ kind: r.kind, w: r.w, pts }); } // noNpc：不給車流、居民走的路（越野車場的聯外水泥路：盡頭是大門）
  // 丁字路口：一條路的端點在另一條路中間 → 那條路切成兩段
  for (let guard = 0; guard < 50; guard++) {
    let hit = null;
    for (const A of roads) {
      for (const e of [A.pts[0], A.pts[A.pts.length - 1]]) {
        for (const B of roads) {
          if (B === A) continue;
          const L = plen(B.pts); let acc = 0;
          for (let i = 0; i < B.pts.length - 1 && !hit; i++) {
            const a = B.pts[i], b = B.pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), [d, t] = segDist(e[0], e[1], a[0], a[1], b[0], b[1]);
            if (d < 0.6 && acc + t * l > 1 && acc + t * l < L - 1) hit = { B, s: acc + t * l };
            acc += l;
          }
          if (hit) break;
        }
        if (hit) break;
      }
      if (hit) break;
    }
    if (!hit) break;
    const L = plen(hit.B.pts), p1 = subPts(hit.B.pts, 0, hit.s), p2 = subPts(hit.B.pts, hit.s, L);
    roads = roads.filter((r) => r !== hit.B).concat([{ ...hit.B, pts: p1 }, { ...hit.B, pts: p2 }]);
  }
  const H = V.highway, hc = H && H.center ? H.center : null;
  const nearHwy = (x, z) => { if (!hc) return Infinity; let best = Infinity; for (let i = 0; i < hc.length - 1; i++) best = Math.min(best, segDist(x, z, hc[i][0], hc[i][1], hc[i + 1][0], hc[i + 1][1])[0]); return best; };
  let nodes = [];
  const build = () => {
    nodes = [];
    const nodeAt = (p) => { for (const n of nodes) if (Math.hypot(n.x - p[0], n.z - p[1]) < 0.6) return n; const n = { id: nodes.length, x: p[0], z: p[1], arms: [] }; nodes.push(n); return n; };
    for (const r of roads) {
      r.a = nodeAt(r.pts[0]); r.b = nodeAt(r.pts[r.pts.length - 1]);
      r.pts[0] = [r.a.x, r.a.z]; r.pts[r.pts.length - 1] = [r.b.x, r.b.z]; r.len = plen(r.pts);
    }
    for (const r of roads) for (const end of [0, 1]) {
      const n = end ? r.b : r.a, q = end ? r.pts.slice().reverse() : r.pts, o = pt(); lineAt(mkLine(q), Math.min(3, r.len * 0.5), o);
      const dx = o.x - n.x, dz = o.z - n.z, l = Math.hypot(dx, dz) || 1;
      n.arms.push({ road: r, end, dir: [dx / l, dz / l], hw: r.w / 2, ang: Math.atan2(dz, dx) });
    }
    for (const n of nodes) n.arms.sort((a, b) => a.ang - b.ang);
  };
  build();
  // 接快速道路的死路：端點離快速道路中線不到半寬＋3 公尺
  for (const n of nodes) n.hwy = n.arms.length === 1 && nearHwy(n.x, n.z) < (H ? H.half + 3 : 0);
  if (cars) { // 死路剪掉（賽道入口那段）
    for (let guard = 0; guard < 20; guard++) {
      const dead = nodes.filter((n) => n.arms.length === 1 && !n.hwy);
      if (!dead.length) break;
      const drop = new Set(dead.map((n) => n.arms[0].road));
      roads = roads.filter((r) => !drop.has(r));
      const hw = new Set(nodes.filter((n) => n.hwy).map((n) => `${n.x},${n.z}`));
      build(); for (const n of nodes) n.hwy = hw.has(`${n.x},${n.z}`);
    }
  }
  // 兩條路直直接在一起（同一種、一樣寬）：併成一條
  for (let guard = 0; guard < 100; guard++) {
    const n = nodes.find((m) => m.arms.length === 2 && m.arms[0].road !== m.arms[1].road && m.arms[0].road.kind === m.arms[1].road.kind && Math.abs(m.arms[0].road.w - m.arms[1].road.w) < 0.01 && m.arms[0].dir[0] * m.arms[1].dir[0] + m.arms[0].dir[1] * m.arms[1].dir[1] < -0.985);
    if (!n) break;
    const [A, B] = n.arms, pa = A.end ? A.road.pts : A.road.pts.slice().reverse(), pb = B.end ? B.road.pts.slice().reverse() : B.road.pts; // pa 走到 n、pb 從 n 出去
    const merged = { kind: A.road.kind, w: A.road.w, pts: dedupe(pa.concat(pb.slice(1))) };
    const hw = new Set(nodes.filter((m) => m.hwy).map((m) => `${m.x},${m.z}`));
    roads = roads.filter((r) => r !== A.road && r !== B.road).concat([merged]);
    build(); for (const m of nodes) m.hwy = hw.has(`${m.x},${m.z}`);
  }
  return { roads, nodes };
}

// ---- 車道圖：每條路兩個方向各一條車道（靠右）；路口有轉彎的路線（connector）；快速道路一圈兩線 ----
// edge：{ id, conn（路口裡的轉彎路線）, road（main|street|farm|highway）, line, len, vmax, cap（每個點的彎道速限）, next: [edge], node（車道盡頭的路口）,
//         from, to（connector 從哪條車道來、接到哪條）, prio（2 幹道直行／右轉、1 幹道左轉、0 支道）, conf: [{ e, s2 }]（會撞到的其他 connector、在它上面第幾公尺）,
//         gapT（等空檔要幾秒）, turn（S 直、L 左、R 右）, sib（快速道路旁邊那一線：換車道）, spawn（生車的權重／公尺）}
const A_LAT = 3.0, B_COMF = 2.4;
function laneGraph(V) {
  const net = roadNet(V, true), edges = [], juncs = [];
  const E = (o) => { // 全部欄位先放好（同一個形狀）
    const e = { id: edges.length, conn: false, road: '', pts: null, line: null, len: 0, vmax: 0, w: 0, spawn: 0, cap: null, next: [], node: null, from: null, to: null, prio: 2, turn: 'S', gapT: 4, junc: null,
      conf: null, dense: null, bb: null, sib: null, hwy: '', lane: -1, link: false, zone: false, shift: 0, fromNode: null, toNode: null, hwyOnly: false };
    for (const k in o) { if (!(k in e)) throw new Error('npc: edge 欄位 ' + k); e[k] = o[k]; }
    e.line = mkLine(e.pts); e.len = e.line.len; edges.push(e); return e;
  };
  // 每個路口每個方向的停止線：交叉那條路的半寬＋2.5 公尺（直直接過去的那條不算）
  const setback = (n, arm) => {
    if (n.hwy) return 8;
    let m = 0; for (const b of n.arms) if (b !== arm && arm.dir[0] * b.dir[0] + arm.dir[1] * b.dir[1] > -0.87) m = Math.max(m, b.hw);
    return m > 0 ? m + 2.5 : n.arms.length > 1 ? 3 : 0;
  };
  // 車道：路中線往右 w/4；兩頭照停止線剪掉
  // 車道上有東西擋住（例如農路上的樹）：那一段變成「窄路段」＝一個小路口：擋住的那一線往旁邊閃（閃會壓到對向就讓對向先過）
  const cg = colliderGrid(V.colliders), RAMP = 7, zones = [];
  const fits = (x, z, dx, dz) => footprintClear(cg, V, x, z, dx, dz, 2.25, 0.95);
  // 車身方向＝前後 1.3 公尺兩點的連線（跟車子真的開的時候一樣；折線轉角不會突然轉）
  const QA = pt(), QB = pt();
  const fitsOn = (line, s, sh, q) => {
    lineAt(line, s, q); lineAt(line, s - 1.3, QA); lineAt(line, s + 1.3, QB);
    const hx = QB.x - QA.x, hz = QB.z - QA.z, hl = Math.hypot(hx, hz) || 1, dx = hx / hl, dz = hz / hl;
    return fits(q.x - dz * sh, q.z + dx * sh, dx, dz);
  };
  for (const r of net.roads) {
    const armA = r.a.arms.find((a) => a.road === r && a.end === 0), armB = r.b.arms.find((a) => a.road === r && a.end === 1);
    const s0 = setback(r.a, armA), s1 = setback(r.b, armB);
    if (r.len - s0 - s1 < 4) continue;
    const L = [];
    for (const dir of [1, -1]) {
      const c = dir > 0 ? r.pts : r.pts.slice().reverse(), off = offsetPts(c, r.w / 4), cut = dir > 0 ? [s0, r.len - s1] : [s1, r.len - s0];
      const pts = subPts(off, cut[0], cut[1] + (plen(off) - r.len));
      L.push({ dir, pts, line: mkLine(pts), from: dir > 0 ? r.a : r.b, to: dir > 0 ? r.b : r.a, armOut: dir > 0 ? armA : armB, armIn: dir > 0 ? armB : armA });
    }
    // 每 1 公尺看車子放不放得下 → 擋住的區間（換成第一條車道的距離）
    const iv = [], o = pt();
    for (const l of L) {
      let a = -1;
      for (let s = 0; s <= l.line.len + 0.01; s += 1) {
        const bad = !fitsOn(l.line, s, 0, o);
        if (bad && a < 0) a = s;
        if ((!bad || s + 1 > l.line.len) && a >= 0) {
          const b = bad ? s : s - 1, pa = lineAt(l.line, a, pt()), pb = lineAt(l.line, b, pt());
          let x0 = l === L[0] ? a : projectOn(L[0].line, pb.x, pb.z), x1 = l === L[0] ? b : projectOn(L[0].line, pa.x, pa.z);
          if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
          iv.push([x0 - 1 - RAMP, x1 + 1 + RAMP]); a = -1;
        }
      }
    }
    iv.sort((p, q) => p[0] - q[0]);
    const zs = []; for (const v of iv) { if (zs.length && v[0] <= zs[zs.length - 1][1] + 2) zs[zs.length - 1][1] = Math.max(zs[zs.length - 1][1], v[1]); else zs.push(v.slice()); }
    const len0 = L[0].line.len, good = zs.filter((z) => z[0] > 1 && z[1] < len0 - 1);
    if (good.length !== zs.length) console.warn('npc: 車道盡頭被擋住（沒辦法閃）', r.kind, zs);
    // 切段：第一條照 good 的區間，第二條照投影回來的區間
    const cuts = L.map((l, li) => good.map((z) => { if (!li) return z; const p0 = lineAt(L[0].line, z[0], pt()), p1 = lineAt(L[0].line, z[1], pt()); const a = projectOn(l.line, p1.x, p1.z), b = projectOn(l.line, p0.x, p0.z); return [Math.min(a, b), Math.max(a, b)]; }).sort((p, q) => p[0] - q[0]));
    const pieces = L.map((l, li) => {
      const out = []; let s = 0;
      for (const z of cuts[li]) { out.push({ lane: true, pts: subPts(l.pts, s, z[0]) }); out.push({ lane: false, pts: subPts(l.pts, z[0], z[1]), z }); s = z[1]; }
      out.push({ lane: true, pts: subPts(l.pts, s, l.line.len) });
      return out;
    });
    const edgesOf = pieces.map((ps, li) => ps.map((pc) => {
      if (pc.lane) return E({ conn: false, road: r.kind, pts: pc.pts, vmax: KIND[r.kind].v, w: r.w, spawn: KIND[r.kind].spawn, node: null });
      // 窄路段：擋住就往旁邊閃（左右都試，選閃比較少的那邊），頭尾 RAMP 公尺慢慢閃出去、閃回來
      const zl = mkLine(resample(pc.pts, 1)), n = zl.n, q = pt(), need = [0, 0], ok = [true, true];
      for (let i = 0; i < n; i++) {
        const s = zl.cum[i]; if (s < RAMP - 0.5 || s > zl.len - RAMP + 0.5) continue;
        if (fitsOn(zl, s, 0, q)) continue;
        for (let side = 0; side < 2; side++) {
          let found = false; const sg = side ? 1 : -1; // −1：往左（往路中間）、1：往右
          for (let sh = 0.2; sh <= 2.61; sh += 0.1) if (fitsOn(zl, s, sh * sg, q)) { need[side] = Math.max(need[side], sh); found = true; break; }
          if (!found) ok[side] = false;
        }
      }
      const side = ok[0] && (!ok[1] || need[0] <= need[1]) ? 0 : ok[1] ? 1 : -1, shift = side < 0 ? 0 : need[side] * (side ? 1 : -1);
      if (side < 0) console.warn('npc: 窄路段閃不過去', r.kind, pc.z);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const s = zl.cum[i], u = Math.min(clamp(s / RAMP, 0, 1), clamp((zl.len - s) / RAMP, 0, 1)), k = shift * u * u * (3 - 2 * u);
        lineAt(zl, s, q); pts.push([q.x - q.dz * k, q.z + q.dx * k]);
      }
      return E({ conn: true, road: r.kind, pts, vmax: KIND[r.kind].v * (Math.abs(shift) > 0.45 ? 0.75 : 1), w: r.w, spawn: 0, prio: Math.abs(shift) > 0.45 ? 0 : 2, turn: 'S', gapT: 4.5, zone: true, shift });
    }));
    // 接起來；每個窄路段一個小路口
    const nz = cuts[0].length;
    for (let zi = 0; zi < nz; zi++) {
      const p = lineAt(L[0].line, (good[zi][0] + good[zi][1]) / 2, pt()), J = { id: juncs.length, x: p.x, z: p.z, conns: [], hwy: false, zone: true }; juncs.push(J); zones.push(J);
      for (let li = 0; li < 2; li++) {
        const ci = li ? nz - 1 - zi : zi, before = edgesOf[li][ci * 2], z = edgesOf[li][ci * 2 + 1], after = edgesOf[li][ci * 2 + 2];
        z.from = before; z.to = after; z.junc = J; z.next.push(after); before.next.push(z); before.node = J; J.conns.push(z);
      }
    }
    for (let li = 0; li < 2; li++) {
      const l = L[li], first = edgesOf[li][0], last = edgesOf[li][edgesOf[li].length - 1];
      first.fromNode = l.from; last.toNode = l.to;
      (l.to.inL ||= []).push({ e: last, arm: l.armIn }); (l.from.outL ||= []).push({ e: first, arm: l.armOut });
    }
  }
  // 路口：每一條進來的車道 → 每一條出去的車道（不迴轉）
  for (const n of net.nodes) {
    if (n.hwy || !n.inL || !n.outL) continue;
    const J = { id: juncs.length, x: n.x, z: n.z, conns: [], hwy: false, zone: false }; juncs.push(J);
    // 幹道：最直、等級最高的那一對
    let major = null, best = -1;
    for (let i = 0; i < n.arms.length; i++) for (let j = i + 1; j < n.arms.length; j++) {
      const a = n.arms[i], b = n.arms[j], d = a.dir[0] * b.dir[0] + a.dir[1] * b.dir[1];
      if (d > -0.87) continue;
      const sc = KIND[a.road.kind].rank + KIND[b.road.kind].rank + (a.hw + b.hw) * 0.01;
      if (sc > best) { best = sc; major = [a, b]; }
    }
    for (const I of n.inL) for (const O of n.outL) {
      if (I.arm === O.arm) continue;
      const ie = I.e, oe = O.e, p0 = [ie.pts[ie.pts.length - 1][0], ie.pts[ie.pts.length - 1][1]], p3 = [oe.pts[0][0], oe.pts[0][1]];
      const a = ie.pts[ie.pts.length - 2], b = oe.pts[1], d0 = [p0[0] - a[0], p0[1] - a[1]], d3 = [b[0] - p3[0], b[1] - p3[1]];
      const l0 = Math.hypot(...d0), l3 = Math.hypot(...d3); d0[0] /= l0; d0[1] /= l0; d3[0] /= l3; d3[1] /= l3;
      const dh = wrapA(headOf(d3[0], d3[1]) - headOf(d0[0], d0[1])), turn = dh > 0.45 ? 'L' : dh < -0.45 ? 'R' : 'S';
      const onMajor = major && (I.arm === major[0] || I.arm === major[1]);
      const prio = n.arms.length <= 2 ? 2 : onMajor ? (turn === 'L' ? 1 : 2) : 0;
      const c = E({ conn: true, road: ie.road, pts: turnCurve(p0, d0, p3, d3), vmax: Math.min(ie.vmax, oe.vmax), w: Math.min(ie.w, oe.w), spawn: 0, from: ie, to: oe, prio, turn, gapT: 4, junc: J });
      c.next.push(oe); ie.next.push(c); ie.node = J; J.conns.push(c);
    }
  }
  // ---- 快速道路：一圈，兩個方向各兩線（內線快、外線慢）；路口（平面 T 字）：大路右轉上外圈外線、左轉穿過中間護欄開口上內圈內線，反過來也一樣 ----
  const H = V.highway, hn = net.nodes.find((n) => n.hwy);
  const hwyE = { out: [], in: [] };
  if (H && H.center && H.center.length > 3) {
    const C0 = dedupe(H.center, 0.02), CL = mkLine(C0), HL = CL.len, S = 22; // 路口前後 S 公尺是路口裡的直行路線
    const lanes = H.lanes || [3.175, 6.925], hv = [118 / 3.6, 100 / 3.6]; // 內線、外線的速限（每台車自己再亂一點）
    const cut = (a, b) => subPts(C0, a, b);
    const loop = cut(S, HL - S), thruA = cut(HL - S, HL), thruB = cut(0, S);
    const thru = dedupe(thruA.concat(thruB));
    let J = null;
    if (hn) { J = { id: juncs.length, x: hn.x, z: hn.z, conns: [], hwy: true, zone: false }; juncs.push(J); }
    for (let k = 0; k < lanes.length; k++) {
      const oLoop = E({ conn: false, road: 'highway', pts: offsetPts(loop, lanes[k]), vmax: hv[k] ?? hv[1], w: 7.5, spawn: 0.22, hwy: 'out', lane: k });
      const iLoop = E({ conn: false, road: 'highway', pts: offsetPts(loop.slice().reverse(), lanes[k]), vmax: hv[k] ?? hv[1], w: 7.5, spawn: 0.22, hwy: 'in', lane: k });
      hwyE.out.push(oLoop); hwyE.in.push(iLoop);
      if (J) {
        const oThru = E({ conn: true, road: 'highway', pts: offsetPts(thru, lanes[k]), vmax: oLoop.vmax, w: 7.5, spawn: 0, from: oLoop, to: oLoop, prio: 2, turn: 'S', gapT: 6, junc: J, hwy: 'out' });
        const iThru = E({ conn: true, road: 'highway', pts: offsetPts(thru.slice().reverse(), lanes[k]), vmax: iLoop.vmax, w: 7.5, spawn: 0, from: iLoop, to: iLoop, prio: 2, turn: 'S', gapT: 6, junc: J, hwy: 'in' });
        oLoop.next.push(oThru); oThru.next.push(oLoop); oLoop.node = J; J.conns.push(oThru);
        iLoop.next.push(iThru); iThru.next.push(iLoop); iLoop.node = J; J.conns.push(iThru);
      } else { oLoop.next.push(oLoop); iLoop.next.push(iLoop); }
    }
    // 兩線互相是旁邊那一線（同一條中線平移的，點一樣多：換車道用同一段、同一個比例）
    for (const L of [hwyE.out, hwyE.in]) for (const e of L) e.sib = L.filter((x) => x !== e);
    if (J && hn.inL && hn.outL) {
      const inMain = hn.inL[0].e, outMain = hn.outL[0].e; // 大路往西（到路口）、往東（離開路口）
      const endOf = (e) => { const p = e.pts, n = p.length, d = [p[n - 1][0] - p[n - 2][0], p[n - 1][1] - p[n - 2][1]], l = Math.hypot(...d); return [p[n - 1], [d[0] / l, d[1] / l]]; };
      const startOf = (e) => { const p = e.pts, d = [p[1][0] - p[0][0], p[1][1] - p[0][1]], l = Math.hypot(...d); return [p[0], [d[0] / l, d[1] / l]]; };
      const mk = (from, to, prio, turn, gapT, R) => {
        const [p0, d0] = endOf(from), [p3, d3] = startOf(to);
        const c = E({ conn: true, road: from.road === 'highway' ? 'highway' : 'main', pts: filletCurve(p0, d0, p3, d3, R), vmax: 60 / 3.6, w: 7.5, spawn: 0, from, to, prio, turn, gapT, junc: J, link: true });
        c.next.push(to); from.next.push(c); from.node = J; J.conns.push(c); return c;
      };
      const oOut = hwyE.out[hwyE.out.length - 1], iIn = hwyE.in[0]; // 外圈外線（往北、右轉出去）、內圈內線（往南、左轉出去）
      mk(oOut, outMain, 2, 'R', 6, 10);  // 快速道路往北 → 右轉下大路
      mk(iIn, outMain, 1, 'L', 6.5, 12); // 快速道路往南 → 左轉穿過開口下大路
      mk(inMain, oOut, 0, 'R', 7, 10);   // 大路 → 右轉上往北外線
      mk(inMain, iIn, 0, 'L', 7.5, 12);  // 大路 → 左轉穿過開口上往南內線
    }
  }
  // ---- 會撞到的 connector：同一個路口、不是從同一條車道來的，出去是同一條（匯入）或路線靠太近（交叉）----
  const bbox = (P) => { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const p of P) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); } return [x0, z0, x1, z1]; };
  for (const J of juncs) {
    for (const c of J.conns) { c.conf = []; c.dense = resample(c.pts, 0.5); c.bb = bbox(c.dense); }
    for (let i = 0; i < J.conns.length; i++) for (let j = 0; j < J.conns.length; j++) {
      if (i === j) continue;
      const a = J.conns[i], b = J.conns[j];
      if (a.from === b.from) continue;
      let s2 = -1; // b 上面第一個離 a 不到 2.3 公尺的點（交叉）；出去是同一條（匯入）又沒靠近：b 的盡頭
      const P = b.dense, Q = a.dense, st = b.len / (P.length - 1), A = a.bb, B = b.bb;
      if (A[0] - 2.3 <= B[2] && B[0] - 2.3 <= A[2] && A[1] - 2.3 <= B[3] && B[1] - 2.3 <= A[3]) {
        for (let k = 0; k < P.length && s2 < 0; k++) {
          const px = P[k][0], pz = P[k][1]; if (px < A[0] - 2.3 || px > A[2] + 2.3 || pz < A[1] - 2.3 || pz > A[3] + 2.3) continue;
          for (let m = 0; m < Q.length - 1; m++) if (segD2(px, pz, Q[m][0], Q[m][1], Q[m + 1][0], Q[m + 1][1]) < 2.3 * 2.3) { s2 = k * st; break; }
        }
      }
      if (s2 < 0 && a.to === b.to) s2 = b.len;
      if (s2 >= 0) a.conf.push({ e: b, s2 });
    }
  }
  // ---- 彎道速限：每個點照三點算的半徑 √(A_LAT·R)，再往回推（煞得下來）----
  for (const e of edges) {
    const n = e.line.n, P = e.line.P, cap = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (i === 0 || i === n - 1) { cap[i] = Infinity; continue; }
      const ax = P[i * 2 - 2], az = P[i * 2 - 1], bx = P[i * 2], bz = P[i * 2 + 1], cx = P[i * 2 + 2], cz = P[i * 2 + 3];
      const la = Math.hypot(bx - ax, bz - az), lb = Math.hypot(cx - bx, cz - bz), lc = Math.hypot(cx - ax, cz - az), area2 = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax));
      const R = area2 > 1e-9 ? (la * lb * lc) / (2 * area2) : Infinity;
      cap[i] = Math.sqrt((e.road === 'highway' ? 3.6 : A_LAT) * R);
    }
    if (n > 2) { cap[0] = cap[1]; cap[n - 1] = cap[n - 2]; }
    for (let i = n - 2; i >= 0; i--) cap[i] = Math.min(cap[i], Math.sqrt(cap[i + 1] * cap[i + 1] + 2 * B_COMF * (e.line.cum[i + 1] - e.line.cum[i])));
    e.cap = cap;
  }
  // 開到底只能上快速道路的車道（大路西段）：機車不要開進去（台灣的快速道路機車不能上）
  const toOf = (q) => q.to || (q.next.length === 1 ? q.next[0] : null); // 閃開障礙物的那段（zone）沒有 to：接下去的那條
  for (let more = true; more;) {
    more = false;
    for (const e of edges) if (!e.conn && e.road !== 'highway' && !e.hwyOnly && e.next.length && e.next.every((q) => { const t = toOf(q); return t && (t.road === 'highway' || t.hwyOnly); })) { e.hwyOnly = true; more = true; }
  }
  return { edges, juncs, net, hwy: hwyE, zones };
}

// ---- 走路的路網（人行）：每條路兩邊、路邊再外面 0.75 公尺（鄉下沒有人行道：走在騎樓前、路邊）；
//      路口的轉角接起來、路口每一支路口都有斑馬線（長的路中間也有）、每一戶的大門、板凳 ----
// node：{ id, x, z, e: [edge id], door?, seat? }；edge：{ id, a, b, pts, line, len, kind: side | corner | cross | door | seat, road }
const WALK_OFF = 0.75, WALK_CLR = 0.36, WALK_ST = 0.5, SEAT_FWD = 0.58;
// 圓（x, z, r）碰到碰撞格子裡的東西嗎（盒子用本地座標；不配置記憶體）
function circleHits(c, x, z, r) {
  const dx = x - c.x, dz = z - c.z;
  if (c.t === 'circle') { const rr = c.r + r; return dx * dx + dz * dz < rr * rr; }
  const lx = dx * c.cs - dz * c.sn, lz = dx * c.sn + dz * c.cs, ex = Math.abs(lx) - c.hx, ez = Math.abs(lz) - c.hz, qx = ex > 0 ? ex : 0, qz = ez > 0 ? ez : 0;
  return qx * qx + qz * qz < r * r;
}
function circleFree(cg, x, z, r) { const a = cg.near(x - r - 0.05, z - r - 0.05, x + r + 0.05, z + r + 0.05); for (let i = 0; i < a.length; i++) if (circleHits(a[i], x, z, r)) return false; return true; }
const facingOf = (b) => [Math.sin(b.door.ry), Math.cos(b.door.ry)]; // 房子正面朝的方向
// 大門離房子外框多遠（外框外面是正的）
function doorOut(b, x, z) { const f = facingOf(b), c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0), ext = b.hx * Math.abs(c * f[0] - s * f[1]) + b.hz * Math.abs(s * f[0] + c * f[1]); return (x - b.x) * f[0] + (z - b.z) * f[1] - ext; }

// ---- 板凳、椅子：廟前大榕樹的樹圍椅、超商門口的長椅（村子本來就有，只加座位）、幾戶人家門口的塑膠椅 ----
// seat：{ x, z（屁股的位置）, fx, fz（坐著面向）, kind, by（誰坐了）}；parts：畫出來的東西；colliders：給開車用（跟村子的碰撞一樣格式）
function makeProps(V, cg, net) {
  const seats = [], colliders = [], parts = [], R = rngOf(9127), B = V.buildings || [];
  const roadGap = (x, z) => { let best = Infinity; for (const r of net.roads) for (let i = 0; i < r.pts.length - 1; i++) best = Math.min(best, Math.sqrt(segD2(x, z, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1])) - r.w / 2); return best; };
  // 大榕樹（廟附近最大的圓形碰撞）：一圈樹圍椅
  const temple = B.find((b) => b.kind === 'temple' && b.door);
  if (temple) {
    let tree = null;
    for (const c of V.colliders) if (c.t === 'circle' && c.r >= 0.9 && Math.hypot(c.x - temple.door.x, c.z - temple.door.z) < 30 && (!tree || c.r > tree.r)) tree = c;
    if (tree) {
      const ri = tree.r + 0.08, ro = tree.r + 0.62;
      parts.push({ t: 'ring', x: tree.x, z: tree.z, ri, ro });
      colliders.push({ t: 'circle', x: tree.x, z: tree.z, r: ro, h: 0.45, npc: 'bench' });
      for (let k = 0; k < 8; k++) { const a = ((k + 0.5) / 8) * TAU, fx = Math.cos(a), fz = Math.sin(a), rr = (ri + ro) / 2 + 0.05; seats.push({ x: tree.x + fx * rr, z: tree.z + fz * rr, fx, fz, kind: 'ring' }); }
    }
  }
  // 超商門口的長椅（村子做好的：高 0.5 的長方形碰撞）
  const store = B.find((b) => b.kind === 'store' && b.door);
  if (store) {
    const [fx, fz] = facingOf(store);
    for (const c of V.colliders) {
      if (c.t !== 'box' || Math.abs((c.h ?? 0) - 0.5) > 0.06 || c.hx < 0.8 || c.hz > 0.4 || Math.hypot(c.x - store.door.x, c.z - store.door.z) > 12) continue;
      const ux = Math.cos(c.rot || 0), uz = -Math.sin(c.rot || 0), n = Math.max(1, Math.floor((c.hx * 2) / 0.75));
      for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * 0.75; seats.push({ x: c.x + ux * a + fx * 0.05, z: c.z + uz * a + fz * 0.05, fx, fz, kind: 'bench' }); }
    }
  }
  // 塑膠椅：隨便幾戶人家門口旁邊（靠牆、面向馬路；離路邊至少 1 公尺；互相離 20 公尺以上）
  const cand = B.filter((b) => b.door && (b.kind === 'house' || (b.kind === 'shop' && !b.name)));
  for (let i = cand.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0, t = cand[i]; cand[i] = cand[j]; cand[j] = t; }
  const STOOL = ['#c8281e', '#2f6fd6', '#e8c33a', '#2e8b57', '#c8281e', '#2f6fd6'];
  let nStool = 0;
  for (const b of cand) {
    if (nStool >= 9) break;
    const [fx, fz] = facingOf(b), ax = -fz, az = fx, out = doorOut(b, b.door.x, b.door.z);
    if (out < 0.3) continue;
    const px = b.door.x - fx * (out - 0.34), pz = b.door.z - fz * (out - 0.34);
    for (const side of R() < 0.5 ? [1, -1] : [-1, 1]) {
      const x = px + ax * side * 1.05, z = pz + az * side * 1.05;
      if (seats.some((q) => Math.hypot(q.x - x, q.z - z) < 20)) break;
      if (!circleFree(cg, x, z, 0.24) || !circleFree(cg, x + fx * SEAT_FWD, z + fz * SEAT_FWD, 0.3) || roadGap(x, z) < 1.0) continue;
      const col = STOOL[(R() * STOOL.length) | 0];
      parts.push({ t: 'stool', x, z, rot: headOf(fx, fz), col });
      const cc = { t: 'circle', x, z, r: 0.2, h: 0.45, npc: 'stool' }; colliders.push(cc); cg.add(cc);
      seats.push({ x, z, fx, fz, kind: 'stool' }); nStool++;
      break;
    }
  }
  for (const s of seats) { s.by = -1; s.ax = s.x + s.fx * SEAT_FWD; s.az = s.z + s.fz * SEAT_FWD; s.node = -1; }
  return { seats, colliders, parts, geo: null };
}
// 板凳的網格（一個 draw call，頂點色）
function propsGeo(parts) {
  const P = [], N = [], Cc = [];
  const tri = (a, b, c, k, want) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (want && nx * want[0] + ny * want[1] + nz * want[2] < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
    for (const p of [a, b, c]) { P.push(p[0], p[1], p[2]); N.push(nx, ny, nz); Cc.push(k.r, k.g, k.b); }
  };
  const quad = (a, b, c, d, k, want) => { tri(a, b, c, k, want); tri(a, c, d, k, want); };
  for (const q of parts) {
    if (q.t === 'ring') { // 八角形的樹圍椅：上面木頭、旁邊洗石子
      const n = 12, top = new THREE.Color('#9b7653'), side = new THREE.Color('#bdb5a6');
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * TAU, a1 = ((k + 1) / n) * TAU, am = (a0 + a1) / 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        const p = (r, c, s, y) => [q.x + c * r, y, q.z + s * r];
        quad(p(q.ri, c0, s0, 0.45), p(q.ro, c0, s0, 0.45), p(q.ro, c1, s1, 0.45), p(q.ri, c1, s1, 0.45), top, [0, 1, 0]);
        quad(p(q.ro, c0, s0, 0), p(q.ro, c1, s1, 0), p(q.ro, c1, s1, 0.45), p(q.ro, c0, s0, 0.45), side, [Math.cos(am), 0, Math.sin(am)]);
        quad(p(q.ri, c0, s0, 0), p(q.ri, c1, s1, 0), p(q.ri, c1, s1, 0.45), p(q.ri, c0, s0, 0.45), side, [-Math.cos(am), 0, -Math.sin(am)]);
      }
    } else if (q.t === 'stool') { // 塑膠椅：上面小、下面大的方塊
      const k = new THREE.Color(q.col), c = Math.cos(q.rot), s = Math.sin(q.rot);
      const p = (lx, y, lz) => [q.x + lx * c + lz * s, y, q.z - lx * s + lz * c];
      const b = 0.19, t = 0.16, h = 0.45;
      const B0 = [p(-b, 0, -b), p(b, 0, -b), p(b, 0, b), p(-b, 0, b)], T0 = [p(-t, h, -t), p(t, h, -t), p(t, h, t), p(-t, h, t)];
      quad(T0[0], T0[1], T0[2], T0[3], k, [0, 1, 0]);
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, mx = (B0[i][0] + B0[j][0]) / 2 - q.x, mz = (B0[i][2] + B0[j][2]) / 2 - q.z; quad(B0[i], B0[j], T0[j], T0[i], k, [mx, 0, mz]); }
    }
  }
  if (!P.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  g.computeBoundingSphere();
  return g;
}

function walkGraph(V) {
  const net = roadNet(V, false), cg = colliderGrid(V.colliders), props = makeProps(V, cg, net);
  for (const c of props.colliders) if (c.npc !== 'stool') cg.add(c);
  // 快速道路旁邊不走（路口、匝道）
  const H = V.highway, hc = H && H.center ? H.center : null; let hb = null;
  if (hc) { hb = [Infinity, Infinity, -Infinity, -Infinity]; for (const p of hc) { hb[0] = Math.min(hb[0], p[0]); hb[1] = Math.min(hb[1], p[1]); hb[2] = Math.max(hb[2], p[0]); hb[3] = Math.max(hb[3], p[1]); } }
  const HR2 = H ? (H.half + 22) * (H.half + 22) : 0;
  const nearHwy = (x, z) => { if (!hb || x < hb[0] - 40 || x > hb[2] + 40 || z < hb[1] - 40 || z > hb[3] + 40) return false; for (let i = 0; i < hc.length - 1; i++) if (segD2(x, z, hc[i][0], hc[i][1], hc[i + 1][0], hc[i + 1][1]) < HR2) return true; return false; };
  const clearAt = (x, z, r = WALK_CLR) => { if (!circleFree(cg, x, z, r)) return false; const s = V.surfaceAt(x, z); if (s === 2 || s === 4) return false; return !nearHwy(x, z); };
  const segClear = (x0, z0, x1, z1, r = 0.3) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 0.3)); for (let i = 0; i <= n; i++) if (!clearAt(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n, r)) return false; return true; };
  const crossesRoad = (x0, z0, x1, z1) => {
    for (const r of net.roads) for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], d1 = (bx - ax) * (z0 - az) - (bz - az) * (x0 - ax), d2 = (bx - ax) * (z1 - az) - (bz - az) * (x1 - ax), d3 = (x1 - x0) * (az - z0) - (z1 - z0) * (ax - x0), d4 = (x1 - x0) * (bz - z0) - (z1 - z0) * (bx - x0);
      if (d1 * d2 < 0 && d3 * d4 < 0) return true;
    }
    return false;
  };
  // 1) 每條路兩邊的側線（sd 1：路的右邊、−1：左邊）
  const SL = [];
  for (const r of net.roads) { r.side = {}; for (const sd of [1, -1]) { const pts = offsetPts(r.pts, sd * (r.w / 2 + WALK_OFF)), line = mkLine(pts); const L = { id: SL.length, r, sd, pts, line, t0: 0, t1: line.len, n: 0, marks: [] }; SL.push(L); r.side[sd] = L; } }
  // 2) 路口的轉角：相鄰兩支路的側線接起來（內角：兩條側線交叉的地方；幾乎直的：中間；外角：繞一個圓弧）
  const corners = [], trim = (L, end, st) => { if (end === 0) L.t0 = Math.max(L.t0, st); else L.t1 = Math.min(L.t1, st); };
  for (const n of net.nodes) {
    const k = n.arms.length; if (k < 2) continue;
    for (let i = 0; i < k; i++) {
      const A = n.arms[i], B = n.arms[(i + 1) % k], sA = A.road.side[A.end === 0 ? 1 : -1], sB = B.road.side[B.end === 0 ? -1 : 1];
      let d = B.ang - A.ang; if (d <= 1e-6) d += TAU;
      const oA = A.hw + WALK_OFF, oB = B.hw + WALK_OFF, rA = [-A.dir[1], A.dir[0]], lB = [B.dir[1], -B.dir[0]];
      let pts;
      if (d < Math.PI * 0.9) {
        const cx = lB[0] * oB - rA[0] * oA, cz = lB[1] * oB - rA[1] * oA, det = -A.dir[0] * B.dir[1] + A.dir[1] * B.dir[0], t = (-cx * B.dir[1] + cz * B.dir[0]) / det;
        pts = [[n.x + rA[0] * oA + A.dir[0] * t, n.z + rA[1] * oA + A.dir[1] * t]];
      } else if (d <= Math.PI * 1.1) pts = [[n.x + (rA[0] * oA + lB[0] * oB) / 2, n.z + (rA[1] * oA + lB[1] * oB) / 2]];
      else { pts = []; const a0 = Math.atan2(rA[1], rA[0]), span = d - Math.PI, m = Math.max(2, Math.ceil(span / 0.3)), rr = (oA + oB) / 2; for (let j = 1; j < m; j++) { const a = a0 + (span * j) / m; pts.push([n.x + Math.cos(a) * rr, n.z + Math.sin(a) * rr]); } }
      const eA = A.end === 0 ? 0 : 1, eB = B.end === 0 ? 0 : 1;
      if (d < Math.PI * 1.1) { const q = pts[0]; trim(sA, eA, projectOn(sA.line, q[0], q[1])); trim(sB, eB, projectOn(sB.line, q[0], q[1])); }
      corners.push({ n, sA, eA, sB, eB, pts, deg: k });
    }
  }
  // 3) 側線每 0.5 公尺一點：擋到東西（電線桿、樹、郵筒、長椅、機車⋯）就往旁邊閃（先試往外、再試往路上，最多 1.6 公尺），閃不過就切斷
  //    死路（往賽道、往快速道路的路）最後 30 公尺不走
  const deadEnds = net.nodes.filter((n) => n.arms.length === 1);
  for (const L of SL) {
    const len = L.t1 - L.t0; if (len < 1) continue;
    const n = Math.max(2, Math.round(len / WALK_ST) + 1), st = len / (n - 1), o = pt();
    Object.assign(L, { n, st, bx: new Float64Array(n), bz: new Float64Array(n), nx: new Float64Array(n), nz: new Float64Array(n), fx: new Float64Array(n), fz: new Float64Array(n), ok: new Uint8Array(n), edge: new Int32Array(n).fill(-1), est: new Float32Array(n), node: new Int32Array(n).fill(-1) });
    for (let i = 0; i < n; i++) { lineAt(L.line, L.t0 + i * st, o); L.bx[i] = o.x; L.bz[i] = o.z; L.nx[i] = -o.dz * L.sd; L.nz[i] = o.dx * L.sd; }
    const need = new Float32Array(n), bad = new Uint8Array(n), d = new Float32Array(n);
    // 每一點：往外要閃多少（needA）、往路上要閃多少（needR）；一整段擋住的地方選同一邊（兩邊混著閃會卡住）
    const needA = new Float32Array(n), needR = new Float32Array(n), blk = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (deadEnds.some((q) => Math.hypot(q.x - L.bx[i], q.z - L.bz[i]) < 30)) { bad[i] = 1; continue; }
      if (clearAt(L.bx[i], L.bz[i])) continue;
      blk[i] = 1; needA[i] = needR[i] = Infinity;
      for (let k = 1; k <= 25; k++) if (clearAt(L.bx[i] + L.nx[i] * k * 0.1, L.bz[i] + L.nz[i] * k * 0.1)) { needA[i] = k * 0.1; break; }
      for (let k = 1; k <= 16; k++) if (clearAt(L.bx[i] - L.nx[i] * k * 0.1, L.bz[i] - L.nz[i] * k * 0.1)) { needR[i] = k * 0.1; break; }
    }
    for (let i = 0; i < n; i++) {
      if (!blk[i]) continue;
      let j = i, gap = 0; for (let k = i + 1; k < n && gap <= 3; k++) { if (blk[k]) { j = k; gap = 0; } else if (bad[k]) break; else gap++; }
      let mA = 0, mR = 0; for (let k = i; k <= j; k++) if (blk[k]) { mA = Math.max(mA, needA[k]); mR = Math.max(mR, needR[k]); }
      const side = mA <= mR * 1.25 && mA < Infinity ? 1 : mR < Infinity ? -1 : 0;
      for (let k = i; k <= j; k++) if (blk[k]) { if (side) need[k] = side * (side > 0 ? needA[k] : needR[k]); else bad[k] = 1; }
      i = j;
    }
    for (let i = 0; i < n; i++) if (need[i]) { const m = Math.abs(need[i]), sg = Math.sign(need[i]), K = Math.ceil(m / (0.5 * st)); for (let j = Math.max(0, i - K); j <= Math.min(n - 1, i + K); j++) { const v = m - 0.5 * st * Math.abs(i - j); if (v > Math.abs(d[j])) d[j] = sg * v; } }
    for (let i = 0; i < n; i++) { L.fx[i] = L.bx[i] + L.nx[i] * d[i]; L.fz[i] = L.bz[i] + L.nz[i] * d[i]; L.ok[i] = !bad[i] && clearAt(L.fx[i], L.fz[i], WALK_CLR - 0.04) ? 1 : 0; }
  }
  const sampleNear = (L, x, z) => { if (!L.n) return -1; const s = projectOn(L.line, x, z); return clamp(Math.round((s - L.t0) / L.st), 0, L.n - 1); };
  // 4) 斑馬線：路口每一支路（轉角再往外 1.2 公尺）；大路、村子的路很長的話中間每 55 公尺
  const crossings = [];
  for (const r of net.roads) {
    const A = r.side[1], Bs = r.side[-1]; if (!A.n || !Bs.n) continue;
    const rl = mkLine(r.pts), sts = [];
    if (r.a.arms.length >= 3) sts.push(Math.max(A.t0, Bs.t0) + 1.2);
    if (r.b.arms.length >= 3) sts.push(rl.len - Math.max(A.line.len - A.t1, Bs.line.len - Bs.t1) - 1.2);
    if ((r.kind === 'street' || r.kind === 'main') && rl.len > 80) for (let c = 35; c < rl.len - 35; c += 55) if (sts.every((q) => Math.abs(q - c) > 20)) sts.push(c);
    const o = pt();
    for (const c of sts) {
      if (c < 0.5 || c > rl.len - 0.5) continue;
      lineAt(rl, c, o); const off = r.w / 2 + WALK_OFF, ia = sampleNear(A, o.x - o.dz * off, o.z + o.dx * off), ib = sampleNear(Bs, o.x + o.dz * off, o.z - o.dx * off);
      if (ia < 0 || ib < 0 || !A.ok[ia] || !Bs.ok[ib]) continue;
      if (!segClear(A.fx[ia], A.fz[ia], Bs.fx[ib], Bs.fz[ib], 0.3)) continue;
      A.marks.push(ia); Bs.marks.push(ib); crossings.push({ r, A, ia, B: Bs, ib });
    }
  }
  // 側線上的點放進 10 公尺的格子（找最近的點用）
  const SG = new Map(), gk = (i, j) => i * 100003 + j;
  for (const L of SL) for (let i = 0; i < L.n; i++) if (L.ok[i]) { const k = gk(Math.floor(L.fx[i] / 10), Math.floor(L.fz[i] / 10)); let a = SG.get(k); if (!a) SG.set(k, (a = [])); a.push(L, i); }
  const nearestLink = (x, z, maxD) => { // 最近、直直走得到、不用過馬路的側線點
    const c = []; const R0 = Math.ceil(maxD / 10);
    for (let i = Math.floor(x / 10) - R0; i <= Math.floor(x / 10) + R0; i++) for (let j = Math.floor(z / 10) - R0; j <= Math.floor(z / 10) + R0; j++) { const a = SG.get(gk(i, j)); if (a) for (let k = 0; k < a.length; k += 2) { const L = a[k], ii = a[k + 1], d = Math.hypot(L.fx[ii] - x, L.fz[ii] - z); if (d <= maxD) c.push([d, L, ii]); } }
    c.sort((p, q) => p[0] - q[0]);
    for (let k = 0; k < c.length && k < 60; k++) { const [, L, i] = c[k]; if (segClear(x, z, L.fx[i], L.fz[i], 0.3) && !crossesRoad(x, z, L.fx[i], L.fz[i])) return [L, i]; }
    return null;
  };
  // 5) 大門（自己的車庫、改車廠、車行不算）：門口往外一點；門口在碰撞裡面（廟的前廊）就往外推到外面
  const doors = [];
  for (const b of V.buildings || []) {
    if (!b.door || b.kind === 'garage' || b.kind === 'dealer' || (b.kind === 'shop' && b.name)) continue;
    const [fx, fz] = facingOf(b); let x = b.door.x, z = b.door.z, k = 0;
    while (!clearAt(x, z, 0.32) && k < 30) { x += fx * 0.25; z += fz * 0.25; k++; }
    if (k >= 30) continue;
    const out = doorOut(b, x, z), dep = clamp(out - 0.32, 0.1, 0.5);
    const link = nearestLink(x, z, k ? 26 : 14); if (!link) continue;
    link[0].marks.push(link[1]); doors.push({ b, x, z, fx, fz, hx: x - fx * dep, hz: z - fz * dep, L: link[0], i: link[1], node: -1 });
  }
  // 板凳：面前的地方接到最近的側線
  const seatLinks = [];
  for (const s of props.seats) {
    if (!clearAt(s.ax, s.az, 0.3)) continue;
    const link = nearestLink(s.ax, s.az, 20); if (!link) continue;
    link[0].marks.push(link[1]); seatLinks.push({ s, L: link[0], i: link[1] });
  }
  // 6) 點、線
  const nodes = [], edges = [];
  const node = (x, z) => { const q = { id: nodes.length, x, z, e: [], door: null, seat: null }; nodes.push(q); return q; };
  const edge = (a, b, pts, kind, road = '') => { const e = { id: edges.length, a: a.id, b: b.id, pts, line: mkLine(pts), len: 0, kind, road, hw: 0 }; e.len = e.line.len; edges.push(e); a.e.push(e.id); b.e.push(e.id); return e; };
  for (const L of SL) {
    if (!L.n) continue;
    const mark = new Uint8Array(L.n); for (const i of L.marks) mark[i] = 1;
    let i = 0;
    while (i < L.n) {
      if (!L.ok[i]) { i++; continue; }
      let j = i; while (j + 1 < L.n && L.ok[j + 1]) j++;
      if (j - i >= 2) {
        let prev = i; L.node[i] = node(L.fx[i], L.fz[i]).id;
        for (let k = i + 1; k <= j; k++) if (mark[k] || k === j) {
          L.node[k] = node(L.fx[k], L.fz[k]).id;
          const pts = []; for (let m = prev; m <= k; m++) pts.push([L.fx[m], L.fz[m]]);
          const e = edge(nodes[L.node[prev]], nodes[L.node[k]], pts, 'side', L.r.kind);
          for (let m = prev; m <= k; m++) { if (L.edge[m] < 0 || m > prev) { L.edge[m] = e.id; L.est[m] = e.line.cum[m - prev]; } }
          prev = k;
        }
      }
      i = j + 1;
    }
  }
  // 轉角：兩條側線靠路口那頭（最後一個有點的地方，最多往回找 4 公尺）接起來；轉角那一點擋住（電線桿）就往裡、往外移一點
  const endNode = (L, e) => { if (!L.n) return -1; for (let k = 0; k < 9; k++) { const i = e === 0 ? k : L.n - 1 - k; if (i < 0 || i >= L.n) break; if (L.node[i] >= 0) return i; } return -1; };
  for (const c of corners) {
    const ia = endNode(c.sA, c.eA), ib = endNode(c.sB, c.eB);
    if (ia < 0 || ib < 0 || c.sA.node[ia] === c.sB.node[ib]) continue;
    const q = c.pts.length === 1 ? c.pts[0] : null, bx = q ? q[0] - c.n.x : 0, bz = q ? q[1] - c.n.z : 0, bl = Math.hypot(bx, bz) || 1;
    let got = null;
    for (const k of q ? [0, -0.4, 0.4, -0.8, 0.8, -1.2, 1.2, -1.6] : [0]) {
      const mid = q ? [[q[0] + (bx / bl) * k, q[1] + (bz / bl) * k]] : c.pts;
      const P2 = dedupe([[c.sA.fx[ia], c.sA.fz[ia]], ...mid, [c.sB.fx[ib], c.sB.fz[ib]]], 0.05);
      let ok = P2.length >= 2; for (let j = 0; j < P2.length - 1 && ok; j++) ok = segClear(P2[j][0], P2[j][1], P2[j + 1][0], P2[j + 1][1], 0.3);
      if (ok) { got = P2; break; }
    }
    if (got) edge(nodes[c.sA.node[ia]], nodes[c.sB.node[ib]], got, 'corner', c.sA.r.kind);
  }
  for (const c of crossings) {
    const a = c.A.node[c.ia], b = c.B.node[c.ib]; if (a < 0 || b < 0 || a === b) continue;
    const e = edge(nodes[a], nodes[b], [[c.A.fx[c.ia], c.A.fz[c.ia]], [c.B.fx[c.ib], c.B.fz[c.ib]]], 'cross', c.r.kind);
    e.hw = c.r.w / 2;
  }
  for (const d of doors) {
    const s = d.L.node[d.i]; if (s < 0) continue;
    const q = node(d.x, d.z); q.door = d; d.node = q.id;
    edge(q, nodes[s], dedupe([[d.x, d.z], [d.L.fx[d.i], d.L.fz[d.i]]], 0.01).length > 1 ? [[d.x, d.z], [d.L.fx[d.i], d.L.fz[d.i]]] : [[d.x, d.z], [d.x + 0.01, d.z]], 'door');
  }
  for (const k of seatLinks) {
    const s = k.L.node[k.i]; if (s < 0) continue;
    const q = node(k.s.ax, k.s.az); q.seat = k.s; k.s.node = q.id;
    edge(q, nodes[s], [[k.s.ax, k.s.az], [k.L.fx[k.i], k.L.fz[k.i]]], 'seat');
  }
  // 連在一起的區塊（不同區塊之間走不過去）
  const comp = new Int32Array(nodes.length).fill(-1); let nc = 0; const csize = [];
  for (const s of nodes) {
    if (comp[s.id] >= 0) continue;
    const st = [s.id]; comp[s.id] = nc; let sz = 0;
    while (st.length) { const u = st.pop(); sz++; for (const ei of nodes[u].e) { const e = edges[ei], v = e.a === u ? e.b : e.a; if (comp[v] < 0) { comp[v] = nc; st.push(v); } } }
    csize.push(sz); nc++;
  }
  // 生人的地方：側線（村子的路多、大路少一點、農路很少）×附近有幾戶
  const doorsNear = (x, z) => { let k = 0; for (const d of doors) if (Math.abs(d.x - x) < 40 && Math.abs(d.z - z) < 40) k++; return k; };
  const slots = [];
  for (const e of edges) if (e.kind === 'side' && e.len > 2 && csize[comp[e.a]] > 30) {
    const m = e.pts[(e.pts.length / 2) | 0], w = e.len * ({ street: 1, main: 0.6, farm: 0.15 }[e.road] ?? 0.3) * (0.25 + Math.min(1, doorsNear(m[0], m[1]) / 8));
    slots.push({ e: e.id, w, x: m[0], z: m[1] });
  }
  const seats = props.seats.filter((s) => s.node >= 0);
  return { nodes, edges, doors: doors.filter((d) => d.node >= 0), seats, props, comp, csize, slots, SL, cg, clearAt, segClear, net };
}


// ---- 圖的快取：同一個村子（V）只算一次 ----
const GRAPHS = new WeakMap();
function graphsOf(V) { let g = GRAPHS.get(V); if (!g) GRAPHS.set(V, (g = {})); return g; }
function npcGraphs(V) { const g = graphsOf(V); if (!g.lanes) g.lanes = laneGraph(V); if (!g.walk) g.walk = walkGraph(V); return g; }

// ---- 小工具：看得到嗎（鏡頭的視錐＋房子擋住）----
function makeViewTest(V, camera) {
  const m = new THREE.Matrix4(), v = new THREE.Vector3(), cp = new THREE.Vector3();
  // 房子（高的碰撞物）放進 16 公尺的格子，射線擋住就算看不到
  const CELL = 16, grid = new Map(), key = (i, j) => i * 100003 + j;
  for (const b of V.buildings || []) {
    if ((b.h ?? 9) < 2.5) continue;
    const q = { x: b.x, z: b.z, hx: b.hx, hz: b.hz, c: Math.cos(b.rot || 0), s: Math.sin(b.rot || 0), stamp: 0 }, ex = Math.abs(q.c) * b.hx + Math.abs(q.s) * b.hz, ez = Math.abs(q.s) * b.hx + Math.abs(q.c) * b.hz;
    for (let i = Math.floor((b.x - ex) / CELL); i <= Math.floor((b.x + ex) / CELL); i++) for (let j = Math.floor((b.z - ez) / CELL); j <= Math.floor((b.z + ez) / CELL); j++) { let a = grid.get(key(i, j)); if (!a) grid.set(key(i, j), (a = [])); a.push(q); }
  }
  let stamp = 0;
  function blocked(x0, z0, x1, z1) { // 從 (x0, z0) 看 (x1, z1)：中間有沒有房子
    stamp++;
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), n = Math.ceil(L / (CELL * 0.5));
    for (let k = 0; k <= n; k++) {
      const a = grid.get(key(Math.floor((x0 + (dx * k) / n) / CELL), Math.floor((z0 + (dz * k) / n) / CELL))); if (!a) continue;
      for (const q of a) {
        if (q.stamp === stamp) continue; q.stamp = stamp;
        // 射線對長方形（本地座標）
        const ox = x0 - q.x, oz = z0 - q.z, px = ox * q.c - oz * q.s, pz = ox * q.s + oz * q.c, ux = dx * q.c - dz * q.s, uz = dx * q.s + dz * q.c;
        let t0 = 0, t1 = 0.97;
        if (Math.abs(ux) < 1e-9) { if (Math.abs(px) > q.hx) continue; } else { let a1 = (-q.hx - px) / ux, b1 = (q.hx - px) / ux; if (a1 > b1) { const t = a1; a1 = b1; b1 = t; } t0 = Math.max(t0, a1); t1 = Math.min(t1, b1); }
        if (t0 > t1) continue;
        if (Math.abs(uz) < 1e-9) { if (Math.abs(pz) > q.hz) continue; } else { let a1 = (-q.hz - pz) / uz, b1 = (q.hz - pz) / uz; if (a1 > b1) { const t = a1; a1 = b1; b1 = t; } t0 = Math.max(t0, a1); t1 = Math.min(t1, b1); }
        if (t0 <= t1 && t1 > 0.02) return true;
      }
    }
    return false;
  }
  return {
    blocked,
    frame() { if (camera) { m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); cp.setFromMatrixPosition(camera.matrixWorld); } },
    // 看得到：在畫面裡（鏡頭有給）或在前面 ±75°（只有 focus.heading）、近、沒被房子擋住
    seen(x, z, fx, fz, fh, far = 260) {
      if (camera) {
        if (Math.hypot(x - cp.x, z - cp.z) > far) return false;
        v.set(x, 1.2, z).applyMatrix4(m);
        if (v.z > 1 || Math.abs(v.x) > 1.15 || Math.abs(v.y) > 1.2) return false;
        return !blocked(cp.x, cp.z, x, z);
      }
      const d = Math.hypot(x - fx, z - fz); if (d > far) return false;
      if (fh != null && d > 8) { const a = Math.abs(wrapA(Math.atan2(-(z - fz), x - fx) - fh)); if (a > 1.3) return false; }
      return !blocked(fx, fz, x, z);
    },
  };
}

// ---- 機車（程式做的，一台一個 draw call；騎士是 buildCharacter 坐著）----
const SCOOT_COL = ['#f2f3f5', '#c9ccd0', '#1d1f23', '#c8281e', '#2f6fd6', '#ff8fb5', '#f2c230', '#6d7f5a'];
const SCOOT_GEO = new Map();
function scooterGeo(hex) {
  let g = SCOOT_GEO.get(hex); if (g) return g;
  const P = [], N = [], Cc = [], body = new THREE.Color(hex), col = (h) => new THREE.Color(h);
  const tri = (a, b, c, k) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; for (const p of [a, b, c]) { P.push(p[0], p[1], p[2]); N.push(nx, ny, nz); Cc.push(k.r, k.g, k.b); } };
  const quad = (a, b, c, d, k) => { tri(a, b, c, k); tri(a, c, d, k); };
  const box = (x0, y0, z0, x1, y1, z1, k) => {
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], k); quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], k);
    quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], k); quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], k);
    quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], k); quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], k);
  };
  const wheel = (x, r, w, k, kh) => { const n = 10; for (let i = 0; i < n; i++) { const a = (i / n) * TAU, b = ((i + 1) / n) * TAU, p = (t, z) => [x + Math.cos(t) * r, r + Math.sin(t) * r, z]; quad(p(a, w), p(b, w), p(b, -w), p(a, -w), k); tri([x, r, w], p(b, w), p(a, w), kh); tri([x, r, -w], p(a, -w), p(b, -w), kh); } };
  const dk = col('#1c1d20'), gr = col('#3a3c40'), ru = col('#151618');
  box(-0.78, 0.3, -0.19, -0.02, 0.7, 0.19, body); box(-0.72, 0.7, -0.16, -0.05, 0.79, 0.16, dk); box(-0.1, 0.22, -0.2, 0.38, 0.3, 0.2, gr);
  box(0.36, 0.25, -0.21, 0.5, 0.98, 0.21, body); box(0.5, 0.55, -0.05, 0.6, 1.02, 0.05, dk); box(0.52, 1.0, -0.34, 0.6, 1.05, 0.34, dk);
  box(0.6, 0.9, -0.08, 0.65, 1.01, 0.08, col('#f5f1e0')); box(0.48, 0.47, -0.08, 0.8, 0.53, 0.08, body); box(-0.81, 0.55, -0.1, -0.77, 0.63, 0.1, col('#c01818'));
  box(-0.8, 0.25, -0.12, -0.45, 0.33, 0.12, dk); box(-0.83, 0.37, -0.08, -0.8, 0.47, 0.08, col('#f2f2ee'));
  for (const s of [1, -1]) box(0.54, 1.05, s > 0 ? 0.28 : -0.32, 0.57, 1.16, s > 0 ? 0.32 : -0.28, dk);
  wheel(0.62, 0.24, 0.055, ru, gr); wheel(-0.62, 0.24, 0.055, ru, gr);
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  g.computeBoundingSphere(); SCOOT_GEO.set(hex, g);
  return g;
}
let SCOOT_MAT = null, HELMET_GEO = null;
const HELMET_MATS = new Map();

// ---- 車流 ----
const PAINTS = [ // 路上真的車：白、銀、黑、灰、深藍最多，偶爾紅、香檳、藍、綠、黃、橘
  { c: '#f2f3f1', f: 'stock', w: 24 }, { c: '#ebe8df', f: 'pearl', w: 6 }, { c: '#b9bdc1', f: 'metal', w: 14 }, { c: '#737980', f: 'metal', w: 10 },
  { c: '#464a50', f: 'metal', w: 6 }, { c: '#141619', f: 'gloss', w: 14 }, { c: '#1d2c52', f: 'metal', w: 7 }, { c: '#a3141b', f: 'stock', w: 4 },
  { c: '#5a1418', f: 'metal', w: 2 }, { c: '#c8b796', f: 'metal', w: 3 }, { c: '#7fa3c4', f: 'stock', w: 2 }, { c: '#2b4a3a', f: 'metal', w: 2 },
  { c: '#e5bf1c', f: 'stock', w: 1 }, { c: '#d9651e', f: 'stock', w: 1 }, { c: '#5b4535', f: 'metal', w: 2 },
];
const CAR_W = { yaris: 5, gc8: 4, supra: 1.3, gtr: 1.3, p918: 0.2, sp3: 0.12, jesko: 0.12 }; // 哪台常見（超跑很少）
const CAR_WING = { gc8: 'none', yaris: 'stock', supra: 'stock', gtr: 'stock', p918: 'stock', sp3: 'none', jesko: 'stock' };
const CAR_DIM = { yaris: [2.0, 0.9], gc8: [2.18, 0.86], supra: [2.26, 0.91], gtr: [2.3, 0.9], p918: [2.32, 0.97], sp3: [2.35, 1.03], jesko: [2.44, 1.02] }; // 半長、半寬（量不到的時候）
const NONE = [], SIT = { speed: 0, state: 'sit' };
const IDM = { A: 1.6, AH: 2.0, T: 1.2, TH: 1.5, S0: 2.2, B: 2.6 };

function createTraffic(o = {}) {
  const V = o.world, scene = o.scene, max = o.max ?? 10, radius = o.radius ?? 350, R = rngOf(o.seed ?? 20260928);
  const G = npcGraphs(V).lanes, EDGES = G.edges, lod = o.lod || null, mkChar = o.makeCharacter || null, rLook = o.randomLook || null;
  const view = makeViewTest(V, o.camera || null), snd = o.sound || null;
  const keys = lod ? (lod.keys || Object.keys(CAR_W)).filter((k) => CAR_W[k] != null) : [];
  const loaded = {}, dims = {}, pool = {}, scootPool = [];
  let built = 0, alive = true, budget = 1; // budget：這一幀還可以做幾台新的（做一台 LOD 車、機車要幾毫秒～幾十毫秒：一幀最多一台，其他的等下一幀；prewarm 不限）
  for (const k of keys) Promise.resolve().then(() => lod.load(k)).then((sc) => { if (alive) loaded[k] = sc; }).catch((e) => console.warn('npc: 載不到車', k, e));
  // 生車的地方：每條車道切成 25 公尺一段（中心點、權重＝長度×那種路的權重）
  const SLOTS = [];
  for (const e of EDGES) if (!e.conn && e.spawn > 0) {
    const n = Math.max(1, Math.round(e.len / 25)), st = e.len / n, p = pt();
    for (let i = 0; i < n; i++) { lineAt(e.line, (i + 0.5) * st, p); SLOTS.push({ e, s0: i * st, s1: (i + 1) * st, x: p.x, z: p.z, w: st * e.spawn }); }
  }
  const cand = [];
  // 一台車（池子裡重複用）；wrecks＝被怪獸卡車輾扁的（第 7 批）：從 act 拿出來（別的車、警察、居民都不管它），crush.js 收回來
  const cars = [], act = [], wrecks = [], WRMAX = 3;
  const mk = (id) => ({ id, ai: true, active: false, kind: 'car', key: null, lod: null, obj: null, rider: null, x: -0, z: -0, heading: -0, v: -0, hx: 2.2, hz: 0.9, cx: -0, braking: false,
    edge: null, prev: null, s: -0, a: -0, plan: [], lat0: -0, latFrom: -0, latT: 1.5, vf: 1.5, hv: 30.5, dist: -0, commit: null, arr: -1.5, waitT: -0, stuckT: -0, stun: -0, hitCool: -0,
    honkT: -0, honks: 0, blockT: -0, kx: -0, kz: -0, kyaw: -0, lean: -0, exitHwy: false, leave: false, crushed: false, lcT: -0, cor: new Float32Array(64), corN: 0, corStep: 1.5, dx: 1.5, dz: -0, lastH: -0, frames: 0, blockedBy: 0 }); // 小數欄位：-0、x.5 開始（V8 一開始就當 double）
  for (let i = 0; i < max; i++) cars.push(mk(i));
  const T = pt(), TA = pt(), TB = pt();
  const st = { spawned: 0, despawned: 0, stuckGone: 0, hits: 0, honks: 0, crushed: 0, built: 0, ms: 0, maxMs: 0, frames: 0, lanes: 0, active: 0 };

  // ---- 路線上的點（目前這條＋接下來的，負的往回看前一條）----
  function pathPoint(c, d, out) {
    let s = c.s + d; const e = c.edge;
    if (s < 0) return c.prev ? lineAt(c.prev.line, c.prev.len + s, out) : lineAt(e.line, s, out);
    if (s <= e.len) return lineAt(e.line, s, out);
    s -= e.len;
    for (let i = 0; i < c.plan.length; i++) { const q = c.plan[i]; if (s <= q.len || i === c.plan.length - 1) return lineAt(q.line, s, out); s -= q.len; }
    return lineAt(e.line, e.len + s, out);
  }
  const capAt = (e, s) => { const i = segOf(e.line, s), c1 = e.cap[i + 1]; return Math.min(e.cap[i], Math.sqrt(c1 * c1 + 2 * B_COMF * Math.max(0, e.line.cum[i + 1] - s))); };
  // 接下來要走哪一條：路口照直走／右轉／左轉的機率選；快速道路要下去的走外線（往北）、內線（往南）
  function choose(c, e) {
    const nx = e.next; if (nx.length === 1) return nx[0];
    let tot = 0; const W = cand; W.length = 0;
    for (const q of nx) {
      let w = q.turn === 'S' ? 0.45 : q.turn === 'R' ? 0.3 : 0.25;
      if (q.link && q.from.road === 'highway') w = c.exitHwy ? 1 : 0; // 快速道路：要下去才轉
      else if (e.road === 'highway' && !q.link) w = c.exitHwy ? 0 : 1;
      const qt = q.to || (q.next.length === 1 ? q.next[0] : null);
      if (c.kind === 'scooter' && qt && (qt.road === 'highway' || qt.hwyOnly)) w = 0; // 機車不上快速道路（也不開進只能上快速道路的那段）
      W.push(w); tot += w;
    }
    if (tot <= 0) { for (const q of nx) if (!(c.kind === 'scooter' && q.to && q.to.road === 'highway')) return q; c.leave = true; return nx[0]; } // 機車沒路走：看不到的時候收掉
    let x = R() * tot; for (let i = 0; i < nx.length; i++) { x -= W[i]; if (x <= 0) return nx[i]; }
    return nx[nx.length - 1];
  }
  function ensurePlan(c) { while (c.plan.length < 3) { const last = c.plan.length ? c.plan[c.plan.length - 1] : c.edge; c.plan.push(choose(c, last)); } }

  // ---- 路口：能不能過（優先權、看空檔、先到先走）----
  function canGo(c, k, obstacles) {
    for (let i = 0; i < k.conf.length; i++) {
      const cf = k.conf[i], k2 = cf.e;
      for (let j = 0; j < act.length; j++) {
        const q = act[j]; if (q === c) continue;
        if (q.edge === k2) { if (q.s - q.hx < cf.s2 + 1.5) return false; continue; } // 在裡面、還沒過交叉點
        if (q.commit === k2) return false; // 已經要進去了
        if (q.edge === k2.from && q.plan[0] === k2) { // 正要開過來
          const rem = k2.from.len - q.s - q.hx;
          if (k2.prio > k.prio) { if (rem + cf.s2 < Math.max(10, q.v * k.gapT) && !(q.v < 0.5 && rem > 6)) return false; }
          else if (k2.prio === k.prio && q.arr >= 0 && q.arr < c.arr) return false;
        }
      }
    }
    if (k.prio < 2) { // 玩家（不照規矩的車）：在路口裡、或快開到路口了
      const J = k.junc, rad = J.hwy ? 30 : 14;
      for (let i = 0; i < obstacles.length; i++) {
        const b = obstacles[i]; if (!(b.hx > 0.5)) continue; // 走路的玩家：走廊裡看到才停（不用整個路口讓他）
        const bl = (b.x - c.x) * c.dx + (b.z - c.z) * c.dz, bt = (b.x - c.x) * c.dz - (b.z - c.z) * c.dx;
        if (bl < -(c.hx + 0.5) && Math.abs(bt) < 2.5) continue; // 玩家排在我後面（同一條車道等我走）：不用讓他，不然兩個都卡住
        const dx = J.x - b.x, dz = J.z - b.z, d = hyp(dx, dz);
        if (d < rad) return false;
        const v = Math.abs(b.v || 0); if (v < 1 || d > 120) continue;
        const fx = Math.cos(b.heading || 0), fz = -Math.sin(b.heading || 0), toward = (dx * fx + dz * fz) / d;
        if (toward > 0.5 && (d - rad) / v < k.gapT) return false;
      }
    }
    return true;
  }

  // ---- 跟車（IDM）----
  function idm(v, v0, gap, dv, a, T) {
    const s = IDM.S0 + Math.max(0, v * T + (v * dv) / (2 * Math.sqrt(a * IDM.B)));
    const g = Math.max(gap, 0.05);
    return a * (1 - Math.pow(Math.min(v / Math.max(v0, 0.1), 2), 4) - (s / g) * (s / g));
  }
  // 點到有方向的長方形的距離（b：x, z, heading, hx, hz）
  function obbDist(px, pz, bx, bz, h, hx, hz) {
    const c = Math.cos(h), s = Math.sin(h), dx = px - bx, dz = pz - bz, lx = dx * c - dz * s, lz = dx * s + dz * c;
    const ex = Math.max(0, Math.abs(lx) - hx), ez = Math.max(0, Math.abs(lz) - hz); return hyp(ex, ez);
  }

  function accel(c, h, obstacles, people) {
    const e = c.edge, hw = e.road === 'highway', A = hw ? IDM.AH : IDM.A, Th = hw ? IDM.TH : IDM.T;
    if (c.stun > 0) return c.v > 0 ? -10 : 0;
    // 想開多快：車道速限×自己的個性（快速道路：自己的速度）、彎道、接下來的路口
    let v0 = hw && !e.conn ? c.hv : e.vmax * c.vf;
    v0 = Math.min(v0, capAt(e, c.s));
    let d = e.len - c.s;
    for (let i = 0; i < c.plan.length && d < 160; i++) {
      const q = c.plan[i], dd = Math.max(0, d - c.hx * 0.5);
      v0 = Math.min(v0, Math.sqrt(q.cap[0] * q.cap[0] + 2 * B_COMF * dd), Math.sqrt(q.vmax * q.vmax * (hw && q.road === 'highway' ? 1.3 : 1.15) + 2 * B_COMF * dd));
      if (i === 0 && q.conn && q.prio === 0 && c.commit !== q) v0 = Math.min(v0, Math.sqrt(16 + 2 * 1.6 * Math.max(0, dd - 3))); // 支道：慢慢靠近路口
      d += q.len;
    }
    let acc = idm(c.v, v0, 1e9, 0, A, Th);
    if (c.v > v0) acc = Math.min(acc, (v0 - c.v) * 1.5);
    c.blockedBy = 0;
    // 前面的車（同一條、接下來幾條）
    let best = Infinity, bv = 0;
    for (let j = 0; j < act.length; j++) {
      const q = act[j]; if (q === c) continue;
      let dist = -1;
      if (q.edge === e) { if (q.s > c.s) dist = q.s - c.s; }
      else { let acc2 = e.len - c.s; for (let i = 0; i < c.plan.length && acc2 < 250; i++) { if (q.edge === c.plan[i]) { dist = acc2 + q.s; break; } acc2 += c.plan[i].len; } }
      if (dist >= 0) { const g = dist - c.hx - q.hx; if (g < best) { best = g; bv = q.v; } }
    }
    if (best < 250) acc = Math.min(acc, idm(c.v, v0, best, c.v - bv, A, Th));
    // 前面一段路（走廊）上的東西：玩家的車、走路的人、別的車（路口裡橫過來的、換車道的）
    const n = c.corN, stp = c.corStep, rad = c.hz + (c.kind === 'scooter' ? 0.2 : 0.28), cor = c.cor, reach = c.hx + 0.3 + n * stp;
    let cg = Infinity, cv = 0, who = 0;
    for (let j = 0; j < obstacles.length; j++) { // 玩家的車（或走路的玩家）
      const b = obstacles[j], bh = b.hx || 0.3, bz = b.hz || 0.3; if (Math.abs(b.x - c.x) > reach + bh + 2 || Math.abs(b.z - c.z) > reach + bh + 2) continue;
      for (let k = 0; k < n; k++) if (obbDist(cor[k * 2], cor[k * 2 + 1], b.x, b.z, b.heading || 0, bh, bz) < rad) {
        const g = Math.max(0, 0.3 + (k - 0.5) * stp); if (g < cg) { cg = g; cv = (b.v || 0) * (Math.cos(b.heading || 0) * c.dx - Math.sin(b.heading || 0) * c.dz); who = 1; }
        break;
      }
    }
    for (let j = 0; j < people.length; j++) { // 車頭正前面（很近）有人：停（轉彎的時候車角會掃到路線外面）
      const b = people[j]; if (b.gone) continue;
      const dx = b.x - c.x, dz = b.z - c.z; if (dx * dx + dz * dz > 49) continue;
      const bmx = b.mx || 0, bmz = b.mz || 0, still = bmx * bmx + bmz * bmz < 0.01; // 站著不動的（等過馬路、聊天）：不要擦到就好
      const ch = Math.cos(c.heading), sh = Math.sin(c.heading), lon = dx * ch - dz * sh, la = dx * sh + dz * ch, br = (b.r || 0.3) + (still ? 0.08 : 0.2);
      if (lon > c.hx - 0.3 && lon < c.hx + br + 0.6 + c.v * 0.35 && Math.abs(la) < c.hz + br) { const g = Math.max(0, lon - c.hx - br); if (g < cg) { cg = g; cv = 0; who = 2; } }
    }
    for (let j = 0; j < people.length; j++) { // 走路的人（現在的位置、還有 0.9 秒後會走到的地方）
      const b = people[j]; if (b.gone || Math.abs(b.x - c.x) > reach + 2 || Math.abs(b.z - c.z) > reach + 2) continue;
      const mx = (b.mx || 0) * 0.9, mz = (b.mz || 0) * 0.9, mv = mx * mx + mz * mz > 0.09, pr = (mx * mx + mz * mz < 0.008 ? c.hz + 0.1 : rad) + (b.r || 0.3) - 0.05;
      for (let k = 0; k < n; k++) {
        const dx = cor[k * 2] - b.x, dz = cor[k * 2 + 1] - b.z, ex = dx - mx, ez = dz - mz;
        if (dx * dx + dz * dz < pr * pr || (mv && ex * ex + ez * ez < pr * pr)) { const g = Math.max(0, 0.3 + (k - 0.5) * stp - 0.5); if (g < cg) { cg = g; cv = 0; who = 2; } break; }
      }
    }
    for (let j = 0; j < act.length; j++) { // 別的車
      const q = act[j]; if (q === c || Math.abs(q.x - c.x) > reach + 3 || Math.abs(q.z - c.z) > reach + 3) continue;
      // 在我後面的不算（跟在後面的車頭可能碰到我的走廊起點）
      if ((q.x - c.x) * c.dx + (q.z - c.z) * c.dz < 0) continue;
      for (let k = 0; k < n; k++) if (obbDist(cor[k * 2], cor[k * 2 + 1], q.x, q.z, q.heading, q.hx, q.hz) < rad) {
        const g = Math.max(0, 0.3 + (k - 0.5) * stp); if (g < cg) { cg = g; cv = q.v * (Math.cos(q.heading) * c.dx - Math.sin(q.heading) * c.dz); who = 3; }
        break;
      }
    }
    if (cg < Infinity) { acc = Math.min(acc, idm(c.v, v0, cg, c.v - Math.max(0, cv), A, Th * 0.8)); c.blockedBy = who; }
    // 路口：還沒拿到通行就停在停止線
    const k0 = c.plan[0];
    if (!e.conn && k0 && k0.conn && k0.conf && c.commit !== k0) {
      const rem = e.len - c.s - c.hx - 0.4;
      if (rem < 3 && c.v < 1.2 && c.arr < 0) c.arr = TM[0];
      const need = c.v * c.v / (2 * 3) + 8;
      if (rem < Math.max(need, 30)) {
        if (canGo(c, k0, obstacles)) { c.commit = k0; c.waitT = 0; }
        else { acc = Math.min(acc, rem < 0.2 ? -9 : idm(c.v, v0, rem + IDM.S0 * 0.9, c.v, A, 0.6)); if (c.v < 0.5) c.waitT += h; }
      }
    }
    return clamp(acc, -9, A);
  }

  // ---- 走廊：車頭前面一路取點（照車速，快速道路看比較遠）----
  function corridor(c) {
    const stp = clamp(0.8 + c.v * 0.1, 0.9, 2), n = clamp(Math.ceil((4 + c.v * 2.2) / stp), 5, 32);
    c.corStep = stp; c.corN = n;
    const lat = c.lat0 + c.latFrom * (1 - smoothT(c.latT));
    for (let k = 0; k < n; k++) { pathPoint(c, c.hx + 0.3 + k * stp, T); c.cor[k * 2] = T.x - T.dz * lat; c.cor[k * 2 + 1] = T.z + T.dx * lat; }
  }
  const smoothT = (t) => (t >= 1 ? 1 : t <= 0 ? 0 : t * t * (3 - 2 * t));

  // ---- 位置、方向：車身中心在路線上，方向＝前後 1.3 公尺那兩點的連線（像前後輪都在路線上）；換車道、被撞的偏移 ----
  function pose(c) {
    pathPoint(c, 0, T); pathPoint(c, -1.3, TA); pathPoint(c, 1.3, TB);
    const hdx = TB.x - TA.x, hdz = TB.z - TA.z, hl = hyp(hdx, hdz) || 1;
    const lt = smoothT(c.latT), lat = c.lat0 + c.latFrom * (1 - lt);
    let h = Math.atan2(-hdz, hdx);
    if (c.latT < 1) h += Math.atan((c.latFrom * 6 * c.latT * (1 - c.latT)) / (3 * Math.max(c.v, 2)));
    c.x = T.x - T.dz * lat + c.kx; c.z = T.z + T.dx * lat + c.kz; c.heading = h + c.kyaw; c.dx = hdx / hl; c.dz = hdz / hl;
  }

  // ---- 換車道（快速道路）：前面慢、旁邊有空就超車；超完回外線；要下快速道路先換到出口那一線 ----
  function laneChange(c, h) {
    const e = c.edge; c.lcT -= h;
    if (e.conn || !e.sib || !e.sib.length || c.latT < 1 || c.lcT > 0 || c.s < 60 || e.len - c.s < 80) return;
    const rem = e.len - c.s, exitLane = e.hwy === 'out' ? 1 : 0; // 往北從外線（右轉）下、往南從內線（左轉）下
    let want = -1;
    if (c.exitHwy && e.lane !== exitLane) { if (rem < 1200) want = exitLane; if (rem < 250) { c.exitHwy = false; want = -1; } }
    if (want < 0 && !(c.exitHwy && e.lane === exitLane)) {
      let lead = null, g = Infinity; for (const q of act) if (q !== c && q.edge === e && q.s > c.s && q.s - c.s < g) { g = q.s - c.s; lead = q; }
      if (lead && g < 70 && lead.v < c.hv - 2.5) want = e.lane === 0 ? 1 : 0; // 超車（內線慢就從外線超也可以，台灣很常見）
      else if (e.lane === 0 && c.hv < 30.5 && R() < 0.02) want = 1; // 慢的回外線
    }
    if (want < 0 || want === e.lane) return;
    const tgt = e.sib.find((q) => q.lane === want); if (!tgt) return;
    lineAt(e.line, c.s, T); const i = T.i, t = T.t, s2 = tgt.line.cum[i] + t * (tgt.line.cum[i + 1] - tgt.line.cum[i]);
    for (const q of act) { // 旁邊那一線的空檔
      if (q === c || q.edge !== tgt) continue;
      const d = q.s - s2;
      if (d > 0 && d - c.hx - q.hx < Math.max(14, c.v * 0.9 + (c.v - q.v) * 2)) { c.lcT = 1.5; return; }
      if (d <= 0 && -d - c.hx - q.hx < Math.max(12, q.v * 0.7 + (q.v - c.v) * 3)) { c.lcT = 1.5; return; }
    }
    lineAt(tgt.line, s2, TA);
    const ox = T.x - TA.x, oz = T.z - TA.z, side = ox * -TA.dz + oz * TA.dx; // 原來那一線在新的一線的右邊多少
    c.edge = tgt; c.s = s2; c.latFrom = side; c.latT = 0; c.lcT = 6 + R() * 6; c.plan.length = 0; ensurePlan(c);
  }

  // ---- 生車、收車 ----
  const TM = new Float64Array(2); // [0] 現在幾秒、[1] 下一台車還要等幾秒
  function pickKey() {
    let tot = 0; for (const k of keys) if (loaded[k]) tot += CAR_W[k];
    if (tot <= 0) return null;
    let x = R() * tot; for (const k of keys) if (loaded[k]) { x -= CAR_W[k]; if (x <= 0) return k; }
    return null;
  }
  function takeCar(key) { // 池子裡拿一台（沒有就做一台）
    const p = pool[key] || (pool[key] = []);
    if (p.length) return p.pop();
    if (built >= max + 3) { for (const k in pool) if (pool[k].length) { const l = pool[k].pop(); return l; } return null; }
    if (budget <= 0) return null;
    budget--;
    const look = { kit: 'stock', wing: CAR_WING[key] || 'stock', livery: 'none', rim: '#aeb2b6', caliper: '#55585c', height: '0', wide: 'off', glow: 'none', rimStyle: 'stock', tint: 'light', finish: 'stock', paint: '#f2f3f1' };
    const l = lod.build(key, loaded[key], look); built++; st.built++;
    l.car.position.set(0, 0, 0); l.car.rotation.set(0, 0, 0); l.car.updateMatrixWorld(true);
    if (!dims[key]) { // 車身的大小：不算坐在裡面的駕駛（character.js 的 SkinnedMesh 包圍盒故意放大到 ±1.2×身高，一起算的話車變成 4 公尺多寬：走廊太寬、隔壁車道的車也當成擋路的，路口會卡死）
      const b = new THREE.Box3(), bb = new THREE.Box3();
      l.car.traverse((o) => {
        if (!o.geometry || o.isSkinnedMesh) return;
        if (o.isInstancedMesh) { if (!o.boundingBox) o.computeBoundingBox(); bb.copy(o.boundingBox); } else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); bb.copy(o.geometry.boundingBox); }
        b.union(bb.applyMatrix4(o.matrixWorld));
      });
      dims[key] = isFinite(b.max.x) ? [(b.max.x - b.min.x) / 2, Math.max(b.max.z, -b.min.z), (b.max.x + b.min.x) / 2] : [...(CAR_DIM[key] || [2.2, 0.9]), 0]; }
    l.car.matrixAutoUpdate = true; l.npcKey = key;
    if (scene) scene.add(l.car);
    return l;
  }
  function takeScooter() {
    if (scootPool.length) return scootPool.pop();
    if (!mkChar || budget <= 0) return null;
    budget--; st.built++;
    if (!SCOOT_MAT) SCOOT_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 });
    const hex = SCOOT_COL[(R() * SCOOT_COL.length) | 0], g = new THREE.Group(), lean = new THREE.Group(); g.add(lean);
    const m = new THREE.Mesh(scooterGeo(hex), SCOOT_MAT); lean.add(m);
    const look = { ...(rLook ? rLook(R) : {}), age: 'adult', hat: 'none', glasses: 'none', mask: R() < 0.4 }; // 騎機車：大人、戴口罩的很多
    // 第 2 批（接真的 character.js）：不要腳下的影子；手握把手（hands 'bars'：拳頭在屁股前面 0.61、高 0.8 公尺）→ 人坐前面一點（屁股在座墊前半、膝蓋在前面的擋板後面），手才握得到把手（x 0.54–0.57）
    const rider = mkChar(look, { shadow: false, state: 'sit' });
    rider.group.position.set(-0.06, 0.78 - 0.45, 0); lean.add(rider.group);
    rider.update(0, { speed: 0, state: 'sit', hands: 'bars' }); rider.update(0.05, { speed: 0, state: 'sit' });
    // 安全帽：量騎士坐著的頭頂（最上面 0.28 公尺的點）
    lean.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(lean.matrixWorld).invert(), v = new THREE.Vector3(), mm = new THREE.Matrix4();
    let top = -Infinity, helm = null; const pts = [];
    rider.group.traverse((ob) => { if (!ob.isMesh || !ob.geometry.attributes.position) return; mm.multiplyMatrices(inv, ob.matrixWorld); const n = ob.geometry.attributes.position.count; for (let i = 0; i < n; i++) { if (ob.getVertexPosition) ob.getVertexPosition(i, v); else v.fromBufferAttribute(ob.geometry.attributes.position, i); v.applyMatrix4(mm); pts.push(v.x, v.y, v.z); if (v.y > top) top = v.y; } });
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < pts.length; i += 3) if (pts[i + 1] > top - 0.28) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); z0 = Math.min(z0, pts[i + 2]); z1 = Math.max(z1, pts[i + 2]); }
    if (isFinite(top) && o.helmet !== false) {
      if (!HELMET_GEO) HELMET_GEO = new THREE.SphereGeometry(1, 10, 6, 0, TAU, 0, Math.PI * 0.55);
      const hc = ['#f2f3f5', '#c8281e', '#1d1f23', '#2f6fd6', '#f2c230', '#ff8fb5'][(R() * 6) | 0];
      let hm = HELMET_MATS.get(hc); if (!hm) HELMET_MATS.set(hc, (hm = new THREE.MeshStandardMaterial({ color: hc, roughness: 0.35, metalness: 0.05 })));
      helm = new THREE.Mesh(HELMET_GEO, hm); const sx = Math.max(0.2, x1 - x0) * 0.62, sz = Math.max(0.18, z1 - z0) * 0.66;
      helm.scale.set(sx, 0.2, sz); helm.position.set((x0 + x1) / 2, top - 0.13, (z0 + z1) / 2); lean.add(helm);
    }
    if (scene) scene.add(g);
    // 第 13 批（越野車輾機車）：被輾到的時候騎士跳車（藏起來、peds.bail 生一個人跑掉）、機車壓扁（crush.js 當它是一台車：setSquash）
    const sq = {
      car: g,
      driver: { group: { set visible(v) { rider.group.visible = v; if (helm) helm.visible = v; }, get visible() { return rider.group.visible; } } },
      setSquash(k) { lean.rotation.x = 0; lean.scale.set(1 + 0.25 * k, 1 - 0.8 * k, 1 + 0.35 * k); },
    };
    return { g, lean, rider, hex, sq };
  }
  function spawn(fx, fz, fh, obstacles, initial) {
    const c = cars.find((q) => !q.active); if (!c) return false;
    // 人在快速道路上：快速道路上的車多生一點（不然車都在村子裡）
    let hwNear = false; for (const q of SLOTS) if (q.e.road === 'highway' && Math.abs(q.x - fx) < 45 && Math.abs(q.z - fz) < 45) { hwNear = true; break; }
    const wOf = (q) => (hwNear && q.e.road === 'highway' ? q.w * 3 : q.w);
    let tot = 0; cand.length = 0;
    for (const q of SLOTS) { const d = hyp(q.x - fx, q.z - fz); if (d > radius || d < 30) continue; cand.push(q); tot += wOf(q); }
    if (!cand.length) return false;
    let nSc = 0; for (let i = 0; i < act.length; i++) if (act[i].kind === 'scooter') nSc++;
    for (let attempt = 0; attempt < 6; attempt++) {
      let x = R() * tot, q = cand[cand.length - 1]; for (const s of cand) { x -= wOf(s); if (x <= 0) { q = s; break; } }
      const e = q.e, s = clamp(q.s0 + R() * (q.s1 - q.s0), 8, e.len - 30); if (s < 8) continue;
      lineAt(e.line, s, T);
      const d = hyp(T.x - fx, T.z - fz), hw = e.road === 'highway', minD = hw ? 150 : initial ? 45 : 70;
      if (d < minD || d > radius) continue;
      if (view.seen(T.x, T.z, fx, fz, fh, hw ? 260 : 240)) continue; // 快速道路：看得到的話要 260 公尺以外（霧裡幾個像素）
      let ok = true;
      for (const p of act) { if (hyp(p.x - T.x, p.z - T.z) < (hw ? 45 : 22) || (p.edge === e && Math.abs(p.s - s) < (hw ? 90 : 30))) { ok = false; break; } }
      for (const b of obstacles) if (hyp(b.x - T.x, b.z - T.z) < 30) ok = false;
      if (!ok) continue;
      // 機車（村子的路、大路）或汽車
      // 機車（村子的路、大路）或汽車；車的模型還沒載好：先不要生（不然一開始全部都是機車）
      const scoot = !hw && !e.hwyOnly && mkChar && (!lod || (R() < 0.3 && nSc < Math.ceil(max * 0.3))); // 機車最多三成（機車不上快速道路，不然會越積越多）
      let key = null, l = null, sc = null;
      if (scoot) { sc = takeScooter(); if (!sc) return false; }
      else { key = pickKey(); if (!key) return false; l = takeCar(key); if (!l) return false; key = l.npcKey; }
      Object.assign(c, { active: true, edge: e, prev: null, s, a: 0, latFrom: 0, latT: 1, commit: null, arr: -1, waitT: 0, stuckT: 0, stun: 0, hitCool: 0, honkT: 0, honks: 0, blockT: 0, kx: 0, kz: 0, kyaw: 0, lean: 0, lcT: 3, dist: R() * 10, braking: false, frames: 0, leave: false });
      c.plan.length = 0;
      if (sc) {
        Object.assign(c, { kind: 'scooter', key: 'scooter', lod: null, obj: sc.g, rider: sc, hx: 0.95, hz: 0.36, cx: 0, lat0: 0.75, vf: 0.95 + R() * 0.25 });
        sc.g.visible = true;
      } else {
        const dm = dims[key] || [...(CAR_DIM[key] || [2.2, 0.9]), 0], p = pickW(R, PAINTS);
        Object.assign(c, { kind: 'car', key, lod: l, obj: l.car, rider: null, hx: dm[0], hz: dm[1], cx: dm[2], lat0: 0, vf: 0.88 + R() * 0.24 });
        l.setLook({ paint: p.c, finish: p.f, tint: R() < 0.25 ? 'dark' : 'light', brake: false });
        l.car.visible = true;
      }
      c.hv = (hw && e.lane === 0 ? 112 + R() * 20 : 98 + R() * 22) / 3.6; // 快速道路的速度（時速 100～130）：內線快、外線慢（村子開上去的也是外線那種）
      c.exitHwy = hw ? R() < 0.35 : R() < 0.5;
      ensurePlan(c);
      c.v = Math.min(hw ? c.hv : e.vmax * c.vf, capAt(e, s)) * 0.85;
      act.push(c); pose(c); corridor(c); c.lastH = c.heading;
      st.spawned++;
      return true;
    }
    return false;
  }
  function despawn(c) {
    c.active = false; const i = act.indexOf(c); if (i >= 0) act.splice(i, 1);
    if (c.crushed) { const j = wrecks.indexOf(c); if (j >= 0) wrecks.splice(j, 1); c.crushed = false; } // 第 7 批（輾扁）：收回來的時候車頂、駕駛、高度都回原狀
    if (c.lod) { if (c.lod.setSquash) c.lod.setSquash(0); if (c.lod.driver) c.lod.driver.group.visible = true; c.lod.car.position.y = 0;
      c.lod.car.visible = false; if (c.braking) c.lod.setLook({ brake: false }); c.braking = false; (pool[c.lod.npcKey] ||= []).push(c.lod); }
    if (c.rider) { c.rider.sq.setSquash(0); c.rider.sq.driver.group.visible = true; c.rider.g.position.y = 0; c.rider.g.visible = false; scootPool.push(c.rider); }
    c.squash = null; c.lod = null; c.rider = null; c.obj = null; c.edge = null; c.prev = null; c.plan.length = 0; c.commit = null;
    st.despawned++;
  }

  // ---- 第 7 批（輾扁）：被怪獸卡車輾到：從車流裡拿出來、停在那裡（crush.js 畫面、地形接手；別的車不會在它後面排隊，警察、居民也不管它）----
  function wreck(c) {
    if (c.rider) c.squash = c.rider.sq; // 機車：crush.js 用 squash（跟輕量車的 setSquash、driver 一樣用法）
    c.crushed = true; c.v = 0; c.a = 0; c.stun = 1e9; c.braking = false;
    const i = act.indexOf(c); if (i >= 0) act.splice(i, 1);
    wrecks.push(c); st.crushed++;
    if (o.onCrush) try { o.onCrush(c); } catch (e) { console.warn(e); }
    while (wrecks.length > WRMAX) despawn(wrecks[0]); // 太多了：最早的收回池子（不然車流的車不夠用）
  }
  const recycle = (c) => { if (c && c.crushed) despawn(c); };

  // ---- 喇叭（輕輕的，可以不要）----
  function honk(c, fx, fz) {
    c.honkT = 5 + R() * 3; c.honks++; st.honks++;
    if (o.onHonk) o.onHonk(c);
    if (!snd) return;
    try {
      const ctx = typeof snd.ctx === 'function' ? snd.ctx() : snd.ctx; if (!ctx || ctx.state !== 'running' || (snd.muted && snd.muted())) return;
      const d = hyp(c.x - fx, c.z - fz), g0 = (snd.gain ?? 0.18) * Math.pow(clamp(1 - d / 90, 0, 1), 2); if (g0 < 0.005) return;
      const t = ctx.currentTime, g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1900;
      const two = R() < 0.5, len = two ? 0.16 : 0.34;
      g.gain.setValueAtTime(0, t);
      for (let k = 0; k < (two ? 2 : 1); k++) { const t0 = t + k * 0.24; g.gain.linearRampToValueAtTime(g0, t0 + 0.015); g.gain.setValueAtTime(g0, t0 + len - 0.03); g.gain.linearRampToValueAtTime(0, t0 + len); }
      for (const hz of [392 + R() * 40, 494 + R() * 40]) { const os = ctx.createOscillator(); os.type = 'square'; os.frequency.value = hz; os.connect(f); os.start(t); os.stop(t + (two ? 0.45 : len) + 0.05); }
      f.connect(g); g.connect(snd.out || ctx.destination);
    } catch { /* 沒有聲音就算了 */ }
  }

  // ---- 玩家的車撞到：停下來、等一下、按喇叭，再開走（車被推開一點點，慢慢回來）----
  function hitTest(c, obstacles) {
    if (c.hitCool > 0) return;
    for (let j = 0; j < obstacles.length; j++) {
      const b = obstacles[j]; if (!(b.hx > 0.5)) continue; // 走路的人不算撞車
      const dx = c.x - b.x, dz = c.z - b.z; if (dx * dx + dz * dz > (c.hx + b.hx + 1) * (c.hx + b.hx + 1)) continue;
      // 第 7 批（輾扁）：怪獸卡車（b.crush）靠到汽車身上 → 不是撞到，是輾過去（早 0.6 公尺就算，下一格那台車就不擋了）
      // 第 13 批（Nick 2026-10-09「越野車可以碾摩托車」）：機車也是（騎士先跳車跑掉，只有機車被壓扁）
      if (b.crush === true && (c.kind === 'car' || (c.kind === 'scooter' && c.rider))) { if (obbOverlap(c.x, c.z, c.heading, c.hx + 0.6, c.hz + 0.6, b.x, b.z, b.heading || 0, b.hx, b.hz)) { wreck(c); return; } continue; }
      if (!obbOverlap(c.x, c.z, c.heading, c.hx + 0.12, c.hz + 0.12, b.x, b.z, b.heading || 0, b.hx, b.hz)) continue;
      const vb = Math.abs(b.v || 0); if (vb < 1.2 && c.v < 1.2) continue;
      const d = hyp(dx, dz) || 1, push = Math.min(0.4, 0.04 * vb + 0.05);
      c.kx += (dx / d) * push; c.kz += (dz / d) * push; c.kyaw += (R() < 0.5 ? -1 : 1) * Math.min(0.08, 0.008 * vb);
      c.stun = 2.2 + R() * 2; c.hitCool = 2; c.honkT = Math.min(c.honkT, 0.7); c.honks = 0; st.hits++;
      if (o.onCarHit) o.onCarHit(c, vb);
      return;
    }
  }
  function obbOverlap(ax, az, ah, ahx, ahz, bx, bz, bh, bhx, bhz) {
    const ac = Math.cos(ah), as = -Math.sin(ah), bc = Math.cos(bh), bs = -Math.sin(bh), dx = bx - ax, dz = bz - az;
    const axes = [ac, as, -as, ac, bc, bs, -bs, bc];
    for (let k = 0; k < 8; k += 2) {
      const ux = axes[k], uz = axes[k + 1], d = Math.abs(dx * ux + dz * uz);
      const ra = ahx * Math.abs(ac * ux + as * uz) + ahz * Math.abs(-as * ux + ac * uz), rb = bhx * Math.abs(bc * ux + bs * uz) + bhz * Math.abs(-bs * ux + bc * uz);
      if (d > ra + rb) return false;
    }
    return true;
  }

  // ---- 一步（h 秒）----
  function step(h, obstacles, people) {
    TM[0] += h;
    for (let i = 0; i < act.length; i++) { const c = act[i]; ensurePlan(c); corridor(c); }
    for (let i = 0; i < act.length; i++) act[i].a = accel(act[i], h, obstacles, people);
    for (let i = 0; i < act.length; i++) {
      const c = act[i];
      c.v = Math.max(0, c.v + c.a * h); if (c.stun > 0) { c.stun -= h; if (c.v < 0.05) c.v = 0; }
      c.hitCool -= h;
      const ds = c.v * h; c.s += ds; c.dist += ds;
      while (c.s > c.edge.len) {
        const nx = c.plan.shift(); if (!nx) { c.s = c.edge.len; c.v = 0; break; }
        if (!c.edge.conn && nx.conn && nx.conf && c.commit !== nx) c.commit = nx; // 衝過停止線了：就當拿到了
        c.s -= c.edge.len; c.prev = c.edge; c.edge = nx; if (c.commit === nx) c.commit = null; c.arr = -1; ensurePlan(c);
      }
      if (c.latT < 1) c.latT = Math.min(1, c.latT + h / 3);
      laneChange(c, h);
      // 被撞開的偏移慢慢回來
      const k = Math.exp(-h / 0.9); c.kx *= k; c.kz *= k; c.kyaw *= k;
      pose(c);
      c.stuckT = c.v < 0.2 ? c.stuckT + h : 0;
      hitTest(c, obstacles);
      // 被玩家擋住很久：按喇叭（最多三次）
      if (c.blockedBy === 1 && c.v < 0.5) c.blockT += h; else if (c.v > 2) { c.blockT = 0; c.honks = 0; }
      c.honkT -= h;
    }
  }

  // ---- 每一幀 ----
  let frame = 0, filled = false;
  function update(dt, focus = {}, obstacles = NONE, people = NONE) {
    if (!alive || !(dt > 0)) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    dt = Math.min(dt, 0.1); frame++; budget = 1;
    const fx = focus.x ?? 0, fz = focus.z ?? 0, fh = focus.heading;
    view.frame();
    // 收掉太遠的、卡住很久又看不到的
    for (let i = act.length - 1; i >= 0; i--) {
      const c = act[i], d = hyp(c.x - fx, c.z - fz);
      if (d > radius + 30 || ((c.stuckT > 40 || c.leave) && !view.seen(c.x, c.z, fx, fz, fh))) { if (c.stuckT > 40) st.stuckGone++; despawn(c); }
    }
    // 補車：車的模型載好的第一幀一次補滿（可以在看得到的地方、近一點），之後一幀最多一台（每 0.25 秒）
    TM[1] -= dt;
    if (!filled && (!lod || keys.some((k) => loaded[k]))) {
      filled = true;
      for (let k = 0; k < max * 3 && act.length < max; k++) spawn(fx, fz, fh, obstacles, true);
      TM[1] = 0.25;
    } else if (filled && act.length < max && TM[1] <= 0) { spawn(fx, fz, fh, obstacles, false); TM[1] = 0.25; }
    const n = Math.ceil(dt / (1 / 30) - 1e-6), h = dt / n;
    for (let k = 0; k < n; k++) step(h, obstacles, people);
    // 畫面
    for (let i = 0; i < act.length; i++) {
      const c = act[i];
      if (c.honkT <= 0 && c.blockT > 2.5 && c.honks < 3) honk(c, fx, fz);
      if (c.stun > 0 && c.honkT <= 0 && c.honks < 1) honk(c, fx, fz);
      const obj = c.obj; if (!obj) continue;
      const ch = Math.cos(c.heading), sh = Math.sin(c.heading);
      obj.position.set(c.x - ch * c.cx, 0, c.z + sh * c.cx); obj.rotation.set(0, c.heading, 0);
      const far = hyp(c.x - fx, c.z - fz);
      if (c.lod) {
        c.lod.setRoll(c.dist);
        const br = c.a < -1.2 || (c.v < 0.3 && c.a <= 0.05) || c.stun > 0;
        if (br !== c.braking && (br || c.a > -0.3)) { c.braking = br; c.lod.setLook({ brake: br }); }
        c.lod.body.rotation.z = clamp(c.a * 0.0035, -0.025, 0.02); // 煞車點頭、加速抬頭
      } else if (c.rider) {
        const w = wrapA(c.heading - c.lastH) / dt; c.lean += (clamp(-Math.atan((c.v * w) / 9.81), -0.4, 0.4) - c.lean) * Math.min(1, dt * 6);
        c.rider.lean.rotation.x = c.lean;
        if (far < 80 && (frame + c.id) % 3 === 0) c.rider.rider.update(dt * 3, SIT);
      }
      c.lastH = c.heading;
      obj.visible = far < radius + 20;
    }
    const ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    st.ms += ms; st.maxMs = Math.max(st.maxMs, ms); st.frames++; st.active = act.length;
  }

  // ---- 給開車（drive.js addColliders）、走路的碰撞：現在的車（重複用同一批物件，不要留著）----
  const colOut = [], colPool = [];
  function colliders(x, z, r) {
    colOut.length = 0;
    for (let i = 0; i < act.length; i++) {
      const c = act[i]; if (x != null && hyp(c.x - x, c.z - z) > r + c.hx) continue;
      const b = colPool[colOut.length] || (colPool[colOut.length] = { t: 'box', x: -0, z: -0, hx: 1.5, hz: 1.5, rot: -0, h: 1.4, npc: true });
      b.x = c.x; b.z = c.z; b.hx = c.hx; b.hz = c.hz; b.rot = c.heading; b.h = c.kind === 'scooter' ? 1.2 : 1.4; colOut.push(b);
    }
    return colOut;
  }
  function dispose() {
    alive = false;
    for (const c of act.slice()) despawn(c);
    for (const k in pool) for (const l of pool[k]) l.dispose();
    for (const s of scootPool) { s.rider.dispose(); s.g.removeFromParent(); }
  }
  // ---- 載入畫面先做好：等車的模型載好，照常見的比例做 n 台車＋幾台機車放在池子裡（之後生車不用再做，不會頓）----
  async function prewarm(n = max) {
    await Promise.all(keys.map((k) => Promise.resolve().then(() => lod.load(k)).then((sc) => { if (alive) loaded[k] = sc; }).catch(() => {})));
    if (!alive) return 0;
    const cs = [], ss = []; budget = Infinity;
    for (let i = 0; i < n && lod && built < max + 3; i++) { const k = pickKey(); if (!k) break; const l = takeCar(k); if (!l) break; l.car.visible = false; cs.push(l); }
    for (let i = 0; i < Math.ceil(n * 0.4); i++) { const s = takeScooter(); if (!s) break; s.g.visible = false; ss.push(s); }
    budget = 1;
    for (const l of cs) (pool[l.npcKey] ||= []).push(l);
    for (const s of ss) scootPool.push(s);
    return cs.length + ss.length;
  }
  return { update, cars: act, colliders, prewarm, dispose, graph: G, stats: st, wrecks, recycle, get time() { return TM[0]; }, _pathPoint: pathPoint };
}
// ---- 走路的人 ----
let PROP_MAT = null;
const RMAX = 400;
function createPedestrians(o = {}) {
  const V = o.world, scene = o.scene || null, max = o.max ?? 20, radius = o.radius ?? 150, R = rngOf(o.seed ?? 4242);
  const mkChar = o.makeCharacter || null, rLook = o.randomLook || null, visR = o.visible ?? 125;
  const AN = new Float64Array([o.animNear ?? 45, o.animMid ?? 90]); // 動畫：這麼近每幀、再遠一點隔一幀、更遠四幀一次（角色的 update 比較貴的話調小）
  const W = npcGraphs(V).walk, NODES = W.nodes, EDGES = W.edges, NN = NODES.length, cg = W.cg;
  const view = makeViewTest(V, o.camera || null);
  let alive = true, frame = 0, filled = false;
  const TM = new Float64Array(2); // [0] 現在幾秒、[1] 下一個人還要等幾秒
  // 板凳（一個 draw call）
  let propMesh = null;
  if (scene && W.props.parts.length) {
    if (!W.props.geo) W.props.geo = propsGeo(W.props.parts);
    if (!PROP_MAT) PROP_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
    if (W.props.geo) { propMesh = new THREE.Mesh(W.props.geo, PROP_MAT); propMesh.name = 'npc-props'; propMesh.matrixAutoUpdate = false; scene.add(propMesh); }
  }
  const st = { spawned: 0, despawned: 0, entered: 0, knocks: 0, shoves: 0, aiShoves: 0, dodges: 0, dives: 0, crossings: 0, waitMax: 0, sits: 0, talks: 0, stuckGone: 0, noRoute: 0, ms: 0, maxMs: 0, frames: 0, active: 0, built: 0 };

  // ---- 一個人（池子裡重複用）----
  const P = [], people = [], chFree = [];
  for (let i = 0; i < max; i++) P.push({ id: i, active: false, gone: false, ch: null, age: 'adult', x: -0, z: -0, y: -0, r: 0.3, heading: -0, hd: -0, v: -0, baseV: 1.3, run: false,
    mode: 'idle', state: 'idle', sent: '', timer: -0, t2: -0, route: new Int32Array(RMAX), rdir: new Int8Array(RMAX), cum: new Float64Array(RMAX + 1), rn: 0, ri: 0, s: -0, lim: 0, goal: -1, gk: '',
    lat: -0, latT: -0, latHold: -0, vx: -0, vz: -0, vy: -0, mx: -0, mz: -0, seat: null, door: null, partner: null, talkCool: -0, hitCool: -0, react: 0.35, freeze: -0, from: null, tx: -0, tz: -0, te: -1, ts: -0,
    fx: -0, fz: -0, lookT: -0, waitT: -0, clearT: -0, stuck: -0, lastD: -0, prog: -0, far: -0, animAcc: -0, animT: -0, knockBy: null, dive: 0 }); // dive：第 9 批（撲開越野車） // 小數欄位用 -0 開始（見 createTraffic）
  const T = pt(), T2 = pt();
  const CARS = [], NONE2 = [], ARG = { speed: 0, state: 'idle' };

  // ---- 找路（A*，陣列先配好）----
  const gS = new Float64Array(NN), came = new Int32Array(NN), cameE = new Int32Array(NN), mk = new Uint32Array(NN), done = new Uint32Array(NN), path = new Int32Array(RMAX);
  let stamp = 0, hn = 0; const HN = new Int32Array(NN * 8), HK = new Float64Array(NN * 8);
  const hpush = (n, k) => { if (hn >= HN.length) return; let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (HK[p] <= k) break; HN[i] = HN[p]; HK[i] = HK[p]; i = p; } HN[i] = n; HK[i] = k; };
  const hpop = () => { const top = HN[0], ln = HN[--hn], lk = HK[hn]; let i = 0; for (;;) { let c = i * 2 + 1; if (c >= hn) break; if (c + 1 < hn && HK[c + 1] < HK[c]) c++; if (HK[c] >= lk) break; HN[i] = HN[c]; HK[i] = HK[c]; i = c; } HN[i] = ln; HK[i] = lk; return top; };
  // 從 edge eid 上距離起點 st 的地方走到 goal 那個點：p.route、p.cum、p.s
  function plan(p, eid, st0, goal) {
    const e = EDGES[eid], G = NODES[goal]; stamp++; hn = 0;
    const h = (n) => hyp(NODES[n].x - G.x, NODES[n].z - G.z);
    mk[e.a] = stamp; gS[e.a] = st0; came[e.a] = -1; cameE[e.a] = eid; hpush(e.a, st0 + h(e.a));
    if (mk[e.b] !== stamp || e.len - st0 < gS[e.b]) { mk[e.b] = stamp; gS[e.b] = e.len - st0; came[e.b] = -1; cameE[e.b] = eid; hpush(e.b, e.len - st0 + h(e.b)); }
    let found = false;
    while (hn) {
      const u = hpop(); if (done[u] === stamp) continue; done[u] = stamp;
      if (u === goal) { found = true; break; }
      const nu = NODES[u]; if ((nu.door || nu.seat) && came[u] >= 0) continue; // 不穿過別人家門口、板凳
      for (let k = 0; k < nu.e.length; k++) {
        const ei = nu.e[k]; if (ei === cameE[u]) continue;
        const q = EDGES[ei], v = q.a === u ? q.b : q.a; if (done[v] === stamp) continue;
        const c = gS[u] + q.len + (q.kind === 'cross' ? 8 : 0);
        if (mk[v] !== stamp || c < gS[v]) { mk[v] = stamp; gS[v] = c; came[v] = u; cameE[v] = ei; hpush(v, c + h(v)); }
      }
    }
    if (!found) return false;
    let n = 0, u = goal; while (came[u] >= 0 && n < RMAX - 2) { path[n++] = cameE[u]; u = came[u]; }
    if (came[u] >= 0) return false;
    // u＝起點那條線的其中一頭
    p.route[0] = eid; p.rdir[0] = u === e.b ? 1 : -1; p.s = p.rdir[0] > 0 ? st0 : e.len - st0;
    let at = u, m = 1;
    for (let k = n - 1; k >= 0; k--) { const q = EDGES[path[k]]; p.route[m] = path[k]; p.rdir[m] = q.a === at ? 1 : -1; at = q.a === at ? q.b : q.a; m++; }
    p.rn = m; p.ri = 0; p.cum[0] = 0; for (let k = 0; k < m; k++) p.cum[k + 1] = p.cum[k] + EDGES[p.route[k]].len;
    p.goal = goal; p.lim = nextCross(p, 1); p.prog = p.s; p.t2 = 0;
    return true;
  }
  const nextCross = (p, from) => { for (let k = Math.max(from, p.ri + 1); k < p.rn; k++) if (EDGES[p.route[k]].kind === 'cross') return k; return p.rn; };
  // 路線上 s 再往前 d 公尺（不超過 lim 那條的開頭）
  function ppoint(p, d, out) {
    const pos = p.cum[p.ri] + p.s, lim = p.cum[p.lim], D = Math.min(pos + d, lim);
    let i = p.ri; while (i < p.rn - 1 && D > p.cum[i + 1]) i++;
    const e = EDGES[p.route[i]], a = clamp(D - p.cum[i], 0, e.len);
    lineAt(e.line, p.rdir[i] > 0 ? a : e.len - a, out);
    if (p.rdir[i] < 0) { out.dx = -out.dx; out.dz = -out.dz; }
    out.ri = i; out.rem = lim - pos;
    return out;
  }

  // ---- 角色 ----
  let budget = 1; // 這一幀還可以做幾個新的角色（一幀最多一個；第一次補滿、prewarm 不限）
  function takeChar() {
    if (chFree.length) return chFree.pop();
    if (!mkChar || budget <= 0) return null;
    budget--;
    const ch = mkChar(rLook ? rLook(R) : {}); st.built++;
    ch.group.matrixAutoUpdate = true; if (scene) scene.add(ch.group);
    return ch;
  }
  function prewarm(n = max + 4) { budget = Infinity; const a = []; for (let i = 0; i < n; i++) { const ch = takeChar(); if (!ch) break; ch.group.visible = false; a.push(ch); } budget = 1; for (const ch of a) chFree.push(ch); return a.length; }
  function send(p, state, speed, dt) { // 叫角色的 update（一次性的動作只送一次）
    p.state = state;
    const s = (state === 'getup' || state === 'wave' || state === 'punch') && p.sent === state ? 'idle' : state;
    ARG.speed = speed; ARG.state = s; p.ch.update(dt, ARG); p.sent = state;
  }

  // ---- 目標：回家（進門）、去坐板凳、隨便走走 ----
  function nodeOf(p) { return p.rn ? NODES[p.rdir[p.ri] > 0 ? EDGES[p.route[p.ri]].b : EDGES[p.route[p.ri]].a].id : -1; }
  function newGoal(p, eid, st0) { // 從 edge eid 的 st0 出發
    const e = EDGES[eid], cp = W.comp[e.a], x = p.x, z = p.z, r = R(), elder = p.age === 'elder';
    if (r < (elder ? 0.5 : 0.16)) { // 板凳
      for (let k = 0; k < 6; k++) {
        const s = W.seats[(R() * W.seats.length) | 0]; if (!s || s.by >= 0 || W.comp[s.node] !== cp || hyp(s.x - x, s.z - z) > 130) continue;
        if (plan(p, eid, st0, s.node)) { p.gk = 'seat'; p.seat = s; s.by = p.id; return true; }
      }
    }
    if (r < 0.62) { // 回家／去別人家
      for (let k = 0; k < 8; k++) {
        const d = W.doors[(R() * W.doors.length) | 0], dd = hyp(d.x - x, d.z - z); if (W.comp[d.node] !== cp || dd < 20 || dd > 150) continue;
        if (plan(p, eid, st0, d.node)) { p.gk = 'door'; p.door = d; return true; }
      }
    }
    for (let k = 0; k < 10; k++) { // 隨便走走（走到某個路邊，看一看再走）
      const q = NODES[(R() * NN) | 0], dd = hyp(q.x - x, q.z - z); if (q.door || q.seat || W.comp[q.id] !== cp || dd < 25 || dd > 110) continue;
      if (plan(p, eid, st0, q.id)) { p.gk = 'wander'; return true; }
    }
    for (let k = 0; k < 12; k++) { const d = W.doors[(R() * W.doors.length) | 0]; if (W.comp[d.node] === cp && plan(p, eid, st0, d.node)) { p.gk = 'door'; p.door = d; return true; } }
    st.noRoute++;
    return false;
  }
  function setWalk(p) { p.mode = 'walk'; p.run = p.age === 'kid' && R() < 0.45; p.lat = 0; p.latT = 0; }
  // 從現在的位置回到路網上（被撞、閃車、嚇跑之後）：最近、直直走得到的側線點
  function reattach(p) {
    let best = -1, bd = Infinity;
    for (let pass = 0; pass < 2 && best < 0; pass++) {
      const R0 = pass ? 25 : 10;
      for (let k = 0; k < W.SL.length; k++) {
        const L = W.SL[k]; if (!L.n) continue;
        for (let i = 0; i < L.n; i += 2) {
          if (!L.ok[i] || L.edge[i] < 0) continue;
          const d = Math.abs(L.fx[i] - p.x) + Math.abs(L.fz[i] - p.z); if (d > R0 || d >= bd) continue;
          if (!W.segClear(p.x, p.z, L.fx[i], L.fz[i], 0.28)) continue;
          bd = d; best = k * 100000 + i;
        }
      }
    }
    if (best < 0) return false;
    const L = W.SL[(best / 100000) | 0], i = best % 100000;
    p.te = L.edge[i]; p.ts = L.est[i]; p.tx = L.fx[i]; p.tz = L.fz[i]; p.mode = 'return'; p.stuck = 0; p.lastD = Infinity;
    return true;
  }

  // ---- 生人、收人 ----
  function activate(p, ch, x, z, heading) {
    const look = ch.look || {};
    Object.assign(p, { active: true, gone: false, ch, age: look.age || 'adult', x, z, y: 0, heading, hd: heading, v: 0, r: Math.max(0.24, Math.min(0.34, ch.radius || 0.3)), lat: 0, latT: 0, latHold: 0,
      seat: null, door: null, partner: null, talkCool: 5 + R() * 20, hitCool: 0, react: 0.25 + R() * 0.3, freeze: 0, knockBy: null, dive: 0, sent: '', timer: 0, rn: 0, ri: 0, s: 0, lim: 0, stuck: 0, lookT: 0, waitT: 0, clearT: 0, vy: 0, vx: 0, vz: 0, mx: 0, mz: 0, animAcc: 0 });
    p.baseV = p.age === 'kid' ? 1.45 + R() * 0.25 : p.age === 'elder' ? 0.82 + R() * 0.2 : 1.2 + R() * 0.3;
    if (p.age === 'elder') p.react += 0.25;
    ch.group.visible = true; ch.group.position.set(x, 0, z); ch.group.rotation.set(0, heading, 0);
    people.push(p); st.spawned++;
  }
  function release(p) {
    if (!p.active) return;
    if (p.seat && p.seat.by === p.id) p.seat.by = -1;
    if (p.partner && p.partner.partner === p) { p.partner.partner = null; if (p.partner.mode === 'talk') p.partner.timer = Math.min(p.partner.timer, 0.5); }
    p.active = false; p.gone = true; p.seat = null; p.partner = null;
    const i = people.indexOf(p); if (i >= 0) people.splice(i, 1);
    if (p.ch) { p.ch.group.visible = false; p.ch.update(0.01, { speed: 0, state: 'idle' }); chFree.push(p.ch); p.ch = null; }
    st.despawned++;
  }
  const free = () => { for (let i = 0; i < P.length; i++) if (!P[i].active) return P[i]; return null; };
  const seenAt = (x, z, fx, fz, fh) => view.seen(x, z, fx, fz, fh, 190);
  function pickSlot(fx, fz, minD, fh, hidden) {
    let tot = 0; const c = cand; c.length = 0;
    for (const s of W.slots) { const d = Math.abs(s.x - fx) + Math.abs(s.z - fz); if (d > radius * 1.3) continue; const dd = hyp(s.x - fx, s.z - fz); if (dd > radius - 10) continue; c.push(s); tot += s.w; }
    for (let k = 0; k < 8 && c.length; k++) {
      let x = R() * tot, s = c[c.length - 1]; for (const q of c) { x -= q.w; if (x <= 0) { s = q; break; } }
      const e = EDGES[s.e], a = R() * e.len; lineAt(e.line, a, T);
      if (hyp(T.x - fx, T.z - fz) < minD) continue;
      if (hidden && seenAt(T.x, T.z, fx, fz, fh)) continue;
      let ok = true; for (const q of people) if (Math.abs(q.x - T.x) + Math.abs(q.z - T.z) < 3) { ok = false; break; }
      if (!ok) continue;
      return [e.id, a, T.x, T.z, headOf(T.dx, T.dz)];
    }
    return null;
  }
  const cand = [];
  function spawnWalk(fx, fz, fh, initial) {
    const p = free(); if (!p) return false;
    const sl = pickSlot(fx, fz, initial ? 10 : 40, fh, !initial); if (!sl) return false;
    const ch = takeChar(); if (!ch) return false;
    const back = R() < 0.5; activate(p, ch, sl[2], sl[3], sl[4] + (back ? Math.PI : 0));
    if (!newGoal(p, sl[0], sl[1])) { release(p); return false; }
    setWalk(p); return true;
  }
  function spawnDoor(fx, fz, fh) { // 從家裡走出來（看得到也沒關係）
    const p = free(); if (!p) return false;
    for (let k = 0; k < 8; k++) {
      const d = W.doors[(R() * W.doors.length) | 0], dd = hyp(d.x - fx, d.z - fz);
      if (dd > radius * 0.85 || dd < 8) continue;
      let busy = false; for (const q of people) if (Math.abs(q.x - d.x) + Math.abs(q.z - d.z) < 2.5) { busy = true; break; } if (busy) continue;
      const ch = takeChar(); if (!ch) return false;
      activate(p, ch, d.hx, d.hz, headOf(d.fx, d.fz));
      const e = EDGES[NODES[d.node].e[0]];
      if (!newGoal(p, e.id, e.a === d.node ? 0 : e.len) || p.goal === d.node) { release(p); continue; }
      setWalk(p); p.run = false; return true;
    }
    return false;
  }
  function spawnSeat(fx, fz, fh, initial) {
    const p = free(); if (!p) return false;
    for (let k = 0; k < 6; k++) {
      const s = W.seats[(R() * W.seats.length) | 0]; if (!s || s.by >= 0) continue;
      const d = hyp(s.x - fx, s.z - fz); if (d > radius - 10 || d < (initial ? 6 : 30)) continue;
      if (!initial && seenAt(s.x, s.z, fx, fz, fh)) continue;
      const ch = takeChar(); if (!ch) return false;
      activate(p, ch, s.x, s.z, headOf(s.fx, s.fz)); s.by = p.id; p.seat = s; p.mode = 'sit'; p.timer = 20 + R() * 80; st.sits++;
      return true;
    }
    return false;
  }
  function spawnTalk(fx, fz, fh, initial) { // 兩個人站在路邊聊天
    const a = free(); if (!a) return false; a.active = true; const b = free(); a.active = false; if (!b) return false;
    const sl = pickSlot(fx, fz, initial ? 10 : 40, fh, !initial); if (!sl) return false;
    const e = EDGES[sl[0]], s2 = sl[1] + 1.1; if (s2 > e.len) return false;
    lineAt(e.line, s2, T2);
    const c1 = takeChar(); if (!c1) return false; const c2 = takeChar(); if (!c2) { chFree.push(c1); return false; }
    activate(a, c1, sl[2], sl[3], headOf(T2.x - sl[2], T2.z - sl[3])); activate(b, c2, T2.x, T2.z, headOf(sl[2] - T2.x, sl[3] - T2.z));
    for (const [p, q, st0] of [[a, b, sl[1]], [b, a, s2]]) { p.mode = 'talk'; p.partner = q; p.timer = 12 + R() * 30; p.te = e.id; p.ts = st0; p.rn = 0; }
    b.timer = a.timer + R() * 2; st.talks++;
    return true;
  }

  // ---- 過馬路：看兩邊，車子來不及開到才走 ----
  function crossClear(p, e, dir) {
    const ax = e.pts[0][0], az = e.pts[0][1], bx = e.pts[e.pts.length - 1][0], bz = e.pts[e.pts.length - 1][1];
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, Lc = e.len || 1, ux = (bx - ax) / Lc, uz = (bz - az) / Lc, nx = -uz, nz = ux;
    const Tc = Lc / (p.baseV * 1.15) + 0.6;
    for (let j = 0; j < CARS.length; j++) {
      const c = CARS[j], rx = c.x - mx, rz = c.z - mz; if (Math.abs(rx) > 90 || Math.abs(rz) > 90) continue;
      const hx = c.hx || 2.2, v = c.v || 0, cvx = v * Math.cos(c.heading || 0), cvz = -v * Math.sin(c.heading || 0);
      const dn = rx * nx + rz * nz, vn = cvx * nx + cvz * nz, along = rx * ux + rz * uz;
      if (Math.abs(vn) < 0.4) { if (Math.abs(dn) < hx + 1.3 && Math.abs(along) < Lc / 2 + hx) return false; if (Math.abs(v) > 1 && rx * rx + rz * rz < 196) return false; continue; } // 停在斑馬線上；路口裡在轉彎的車（等它過）
      if (dn * vn >= 0) { if (Math.abs(dn) < hx + 1 && Math.abs(along) < Lc / 2 + 1.5) return false; continue; } // 正在開過去
      const t0 = (Math.abs(dn) - hx - 0.8) / Math.abs(vn), al = along + (cvx * ux + cvz * uz) * Math.max(0, t0);
      if (Math.abs(al) > Lc / 2 + 4) continue; // 開到的時候不在斑馬線上（別條路）
      if (t0 < Tc + 1.8) return false;
    }
    return true;
  }

  // ---- 被車撞：往車子開的方向飛出去、倒在地上、躺一下、爬起來 ----
  function knock(p, dx, dz, speed = 6, car = null) {
    if (!p || !p.active || p.gone) return;
    const l = hyp(dx, dz) || 1; dx /= l; dz /= l;
    if (p.seat && p.seat.by === p.id) p.seat.by = -1; p.seat = null;
    if (p.partner) { const q = p.partner; p.partner = null; if (q.partner === p) { q.partner = null; if (q.mode === 'talk') q.timer = Math.min(q.timer, 0.3); } }
    const hv = clamp(speed * 0.72, 2.2, 10);
    p.vx = dx * hv; p.vz = dz * hv; p.vy = clamp(speed * 0.16, 0.9, 3.4); p.y = Math.max(p.y, 0.02);
    p.mode = 'fall'; p.heading = p.hd = headOf(-dx, -dz); p.v = 0; p.hitCool = 0.6; p.knockBy = car; p.rn = 0;
    st.knocks++;
  }
  // ---- 第 7 批（輾扁）：車上的人跳車跑掉（往 (dx, dz)）：大人（小孩不會開車）、沒有受傷（不是被撞倒：不會倒地）----
  function bail(x, z, dx, dz, n = 1) {
    const l = hyp(dx, dz) || 1; dx /= l; dz /= l;
    let out = 0;
    for (let k = 0; k < n + (R() < 0.45 ? 1 : 0); k++) { // 有時候還有一個乘客
      let p = free();
      if (!p) { // 人滿了：把最遠的那個（看不到）收起來，車上的人一定下得來
        let far = null, fd = 25;
        for (let i = 0; i < people.length; i++) {
          const q = people[i];
          if (q.gone || q.mode === 'fall' || q.mode === 'lie' || q.mode === 'getup' || q.mode === 'enter') continue;
          const d = hyp(q.x - x, q.z - z); if (d > fd) { fd = d; far = q; }
        }
        if (far) { release(far); p = free(); }
      }
      if (!p) break;
      let ch = null; // 池子裡找一個大人（開車的不是小孩）
      for (let i = chFree.length - 1; i >= 0; i--) if ((chFree[i].look || {}).age !== 'kid') { ch = chFree.splice(i, 1)[0]; break; }
      if (!ch) { ch = takeChar(); if (!ch) break; }
      const px = x + dx * (0.9 + k * 0.9) + dz * (k ? 0.8 : 0), pz = z + dz * (0.9 + k * 0.9) - dx * (k ? 0.8 : 0);
      activate(p, ch, px, pz, headOf(dx, dz));
      if (p.age === 'kid') { p.age = 'adult'; p.baseV = 1.3; }
      p.mode = 'flee'; p.fx = dx; p.fz = dz; p.timer = 3.6 + R() * 1.6; p.rn = 0; p.hitCool = 1.5; // 嚇跑（跑一下再走回人行道）
      out++;
    }
    return out;
  }
  function scare(x, z, r = 12) {
    for (const p of people) {
      if (p.gone || p.mode === 'fall' || p.mode === 'lie' || p.mode === 'getup' || p.mode === 'enter') continue;
      const dx = p.x - x, dz = p.z - z, d = hyp(dx, dz); if (d > r) continue;
      if (p.seat && p.seat.by === p.id) p.seat.by = -1; p.seat = null;
      if (p.partner) { p.partner.partner = null; p.partner = null; }
      const a = d > 0.1 ? Math.atan2(dz, dx) : R() * TAU, j = (R() - 0.5) * 0.8;
      p.fx = Math.cos(a + j); p.fz = Math.sin(a + j); p.mode = 'flee'; p.timer = 2.2 + R() * 1.8; p.rn = 0;
    }
  }

  // ---- 一個人一步 ----
  const LK = 0.85;
  // 前面最近的人（walkStep 用；不要每幀做新的函式）
  const WS = new Float64Array(13); let bQ = null; // [0] 最近的距離 [1] 橫向 [2] 速度 [3..10] 方向、右邊、位置、半徑 [11] 擋住的東西的半徑 [12] 是車的話車速（閉包變數存小數會配置記憶體）
  function testQ(qx, qz, qr, qvx, qvz, q) { // 前面的人（或停著的車的一段：大的圓，距離用表面算，跟人一樣是 0.3 的時候一樣）
    const dx = qx - WS[7], dz = qz - WS[8], rr = 3 + qr; if (dx * dx + dz * dz > rr * rr) return;
    const lon = dx * WS[3] + dz * WS[4] - (qr > 0.3 ? qr - 0.3 : 0), la = dx * WS[5] + dz * WS[6]; if (lon < 0.05 || lon > 2.6 || Math.abs(la) > WS[9] + qr + 0.12) return;
    if (lon < WS[0]) { WS[0] = lon; WS[1] = la; WS[2] = qvx * WS[3] + qvz * WS[4]; WS[11] = qr; WS[12] = 0; bQ = q; }
  }
  function testCar(c) { // 停著（或很慢）的車、機車：沿著車身拆成幾個圓（人要繞過去）
    const hx = c.hx || 2.2, hz = c.hz || 0.9, dx = c.x - WS[7], dz = c.z - WS[8], R0 = hx + 3; if (dx * dx + dz * dz > R0 * R0) return;
    const ch = Math.cos(c.heading || 0), sh = -Math.sin(c.heading || 0), L = Math.max(0, hx - hz), n = L > 0 ? Math.ceil((2 * L) / (0.9 * hz)) + 1 : 1, r = hz + 0.05;
    const w0 = WS[0], v = c.v || 0;
    for (let k = 0; k < n; k++) { const a = n > 1 ? -L + (2 * L * k) / (n - 1) : 0; testQ(c.x + ch * a, c.z + sh * a, r, ch * v, sh * v, null); }
    if (WS[0] < w0) WS[12] = v < 0 ? -v : v;
  }
  function moveToward(p, tx, tz, v, h) { const dx = tx - p.x, dz = tz - p.z, d = hyp(dx, dz); if (d < 1e-4) return 0; const m = Math.min(v * h, d); p.x += (dx / d) * m; p.z += (dz / d) * m; p.mx = (dx / d) * (m / h); p.mz = (dz / d) * (m / h); if (m > 0.02 * h) p.hd = Math.atan2(-dz, dx); return d - m; }
  // (x, z) 這一點：1.6 秒內會被哪台車開過去嗎（照車頭方向直直往前算）
  function carComing(x, z, r) {
    for (let j = 0; j < CARS.length; j++) {
      const c = CARS[j], dx = x - c.x, dz = z - c.z; if (Math.abs(dx) > 45 || Math.abs(dz) > 45) continue;
      const hh = c.heading || 0, ch = Math.cos(hh), sh = Math.sin(hh), v = c.v || 0, hx = c.hx || 2.2, hz = c.hz || 0.9;
      const lon = (dx * ch - dz * sh) * (v >= 0 ? 1 : -1), lat = dx * sh + dz * ch;
      if (Math.abs(lat) > hz + r + 0.35) continue;
      if (lon > -hx - r - 0.2 && lon < hx + r + (v > 0.3 || v < -0.3 ? 0.4 + Math.abs(v) * 1.6 : 0.1)) return true; // 停著的車（在停止線等）不算，碰到了才算
    }
    return false;
  }
  function walkStep(p, h) {
    // 前面的人：讓一下（往旁邊）、跟在後面、超過去；被擋住就停一下
    const pos = ppoint(p, LK, T); let tx = T.x, tz = T.z;
    const fx0 = T.dx, fz0 = T.dz, rx = -fz0, rz = fx0;
    let vt = p.run ? 3.1 : p.baseV;
    if (EDGES[p.route[p.ri]].kind === 'cross') {
      vt = Math.max(vt, p.baseV * 1.15);
      if (carComing(p.x, p.z, p.r)) vt = Math.max(vt, p.baseV * 1.5); // 車子來了、人已經在前面：快走過去
      else if (carComing(T.x, T.z, p.r)) vt = 0; // 下一步會走到車子前面：在路中間等一下
    }
    WS[0] = Infinity; WS[1] = 0; WS[2] = 0; bQ = null; WS[3] = fx0; WS[4] = fz0; WS[5] = rx; WS[6] = rz; WS[7] = p.x; WS[8] = p.z; WS[9] = p.r; WS[11] = 0.3; WS[12] = 0;
    for (let j = 0; j < people.length; j++) { const q = people[j]; if (q === p || q.gone) continue; if (q.mode === 'sit') testQ(q.x + q.seat.fx * 0.3, q.z + q.seat.fz * 0.3, 0.45, 0, 0, q); else testQ(q.x, q.z, q.r, q.mx, q.mz, q); }
    for (let j = 0; j < WALKERS.length; j++) { const q = WALKERS[j]; if (q) testQ(q.x, q.z, q.r || 0.3, 0, 0, null); }
    for (let j = 0; j < CARS.length; j++) { const c = CARS[j], v = c.v || 0; if (v < 1 && v > -1) testCar(c); } // 停在人行道上的車（玩家常常這樣停）
    const blockL = WS[0], blockLat = WS[1], blockV = WS[2], oncoming = WS[2] < -0.2, q0 = bQ;
    if (blockL < Infinity) {
      p.latHold = 0.8;
      const same = !oncoming && blockV > 0.2, car = WS[11] > 0.35;
      if (car && WS[12] > 0.2) vt = Math.min(vt, blockL < 1.2 ? 0 : 0.4); // 慢慢在動的車：等它過去（不要從旁邊繞）
      else if (same && (p.baseV < blockV + 0.25 || blockL > 1.6)) vt = Math.min(vt, Math.max(0, blockV + (blockL - 1.1) * 0.8));
      else {
        let side = blockLat > 0.05 ? -1 : blockLat < -0.05 ? 1 : 1; // 往沒有人的那邊（對面來的都往自己的右邊）
        const gap = p.r + WS[11] + 0.12, lm = car ? 1.7 : 0.95; // 停著的車比較寬：可以讓遠一點（走到馬路上繞過去，那邊沒有車過來才走）
        const want = clamp(p.lat + side * (gap - Math.abs(blockLat)), -lm, lm);
        const cx = T.x + rx * want, cz = T.z + rz * want;
        if (W.clearAt(cx, cz, 0.28) && !(car && carComing(cx, cz, p.r + 0.3))) p.latT = want;
        else { const w2 = clamp(p.lat - side * (gap + Math.abs(blockLat)), -lm, lm), x2 = T.x + rx * w2, z2 = T.z + rz * w2; if (W.clearAt(x2, z2, 0.28) && !(car && carComing(x2, z2, p.r + 0.3))) p.latT = w2; else vt = Math.min(vt, blockL < 1 ? 0 : 0.4); }
        if (blockL < 0.75) vt = Math.min(vt, 0.25);
      }
      // 迎面遇到認識的人：停下來聊天
      if (oncoming && q0 && q0.mode === 'walk' && p.talkCool <= 0 && q0.talkCool <= 0 && blockL < 2.2 && p.age !== 'kid' && q0.age !== 'kid' && EDGES[p.route[p.ri]].kind === 'side' && q0.rn && EDGES[q0.route[q0.ri]].kind === 'side') {
        p.talkCool = q0.talkCool = 25 + R() * 30;
        if (R() < 0.3) { for (const [a, b] of [[p, q0], [q0, p]]) { a.mode = 'talk'; a.partner = b; a.timer = 8 + R() * 18; a.v = 0; } st.talks++; return; }
      }
    } else if ((p.latHold -= h) <= 0) p.latT = 0;
    // 在動的車（轉彎過來、從前面開過去）：車身就在前面 0.8 公尺內的話先停，不要走去撞它的側面
    for (let j = 0; j < CARS.length; j++) {
      const c = CARS[j], v = c.v || 0; if (v < 0.3 && v > -0.3) continue;
      const hx = c.hx || 2.2, hz = c.hz || 0.9, ax = p.x + fx0 * 0.8 - c.x, az = p.z + fz0 * 0.8 - c.z, R2 = hx + 2; if (ax * ax + az * az > R2 * R2) continue;
      const ch = Math.cos(c.heading || 0), sh = Math.sin(c.heading || 0), lx = ax * ch - az * sh, lz = ax * sh + az * ch, ex = Math.max(0, Math.abs(lx) - hx), ez = Math.max(0, Math.abs(lz) - hz), m = p.r + 0.3;
      if (ex * ex + ez * ez < m * m) { vt = 0; break; }
    }
    p.lat += clamp(p.latT - p.lat, -0.9 * h, 0.9 * h);
    if (p.lat !== 0) { // 往旁邊讓：不能讓到牆裡、樹裡（每一幀都看，讓不過去就少讓一點）
      let la = p.lat; for (let k = 0; k < 6 && !W.clearAt(tx + rx * la, tz + rz * la, p.r); k++) la *= 0.55;
      if (la !== p.lat) { if (la > -0.03 && la < 0.03) la = 0; p.lat = la; if (p.latT * la >= 0 && Math.abs(p.latT) > Math.abs(la)) p.latT = la; }
    }
    tx += rx * p.lat; tz += rz * p.lat;
    p.v += clamp(vt - p.v, -3 * h, 1.6 * h);
    const d = hyp(tx - p.x, tz - p.z), left = moveToward(p, tx, tz, p.v, h);
    pushOut(p, false);
    // 前進（人跟不上就不要跑太前面）
    let adv = p.v * h * clamp((LK + 0.25 - d) / 0.25, 0, 1); adv = Math.min(adv, Math.max(0, pos.rem - LK));
    p.s += adv; while (p.ri < p.rn - 1 && p.s > EDGES[p.route[p.ri]].len) { p.s -= EDGES[p.route[p.ri]].len; p.ri++; }
    if (pos.rem <= LK + 0.01 && left < 0.06) { // 到了：路邊（要過馬路）或終點
      if (p.lim < p.rn) enterWait(p);
      else arrive(p);
      return;
    }
    // 走不動（被擋住）：6 秒沒前進 0.4 公尺就換一個目標（多半會往回走）；一直這樣就算卡住（看不到的時候收掉）
    const at = p.cum[p.ri] + p.s;
    if (at > p.prog + 0.4) { p.prog = at; p.t2 = 0; p.stuck = 0; }
    else if ((p.t2 += h) > 6) { p.t2 = 0; p.stuck += 4; if (edgeHere(p)) goOn(p); }
  }
  // 走到路邊要過馬路：站在斑馬線的起點；有人站了就沿著路邊排開（不要擠到馬路上，車子才過得去）
  function enterWait(p) {
    p.mode = 'wait'; p.waitT = 0; p.lookT = 0; p.clearT = 0; p.v = 0;
    const e = EDGES[p.route[p.lim]], dir = p.rdir[p.lim], a = dir > 0 ? e.pts[0] : e.pts[e.pts.length - 1], b = dir > 0 ? e.pts[e.pts.length - 1] : e.pts[0];
    let ux = b[0] - a[0], uz = b[1] - a[1]; const l = hyp(ux, uz) || 1; ux /= l; uz /= l;
    p.fx = -uz; p.fz = ux; p.tx = p.x; p.tz = p.z; // fx、fz：沿著路邊；tx、tz：站的地方
    for (let k = 0; k < 7; k++) {
      const off = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.62, x = a[0] + p.fx * off - ux * (k ? 0.12 : 0), z = a[1] + p.fz * off - uz * (k ? 0.12 : 0);
      let free = true;
      for (let j = 0; j < people.length; j++) { const q = people[j]; if (q !== p && !q.gone && ((q.mode === 'wait' && hyp(q.tx - x, q.tz - z) < 0.55) || hyp(q.x - x, q.z - z) < q.r + p.r)) { free = false; break; } }
      if (free && W.clearAt(x, z, p.r)) { p.tx = x; p.tz = z; break; }
    }
  }
  function arrive(p) {
    const i = p.rn - 1, e = EDGES[p.route[i]]; p.te = e.id; p.ts = p.rdir[i] > 0 ? e.len : 0;
    p.v = 0; p.rn = 0;
    if (p.gk === 'door' && p.door) { p.mode = 'enter'; p.timer = 0; return; }
    if (p.gk === 'seat' && p.seat && p.seat.by === p.id) { p.mode = 'sitdown'; p.timer = 0; return; }
    p.mode = 'idle'; p.timer = 1.5 + R() * 5;
  }
  function goOn(p) { // 在路網上的某個點（p.te、p.ts）重新找一個目標
    if (p.te < 0 || !newGoal(p, p.te, p.ts)) { p.mode = 'idle'; p.timer = 3 + R() * 4; p.stuck += 3; return; }
    setWalk(p);
  }
  function edgeHere(p) { // 現在在哪條線、哪裡（停下來的人要再出發用）
    if (p.rn) { const i = p.ri, e = EDGES[p.route[i]]; p.te = e.id; p.ts = clamp(p.rdir[i] > 0 ? p.s : e.len - p.s, 0, e.len); return true; }
    return p.te >= 0;
  }

  function stepPerson(p, h) {
    p.talkCool -= h; p.hitCool -= h; p.mx = 0; p.mz = 0; // mx、mz：這一步的速度（車子用來預測）
    switch (p.mode) {
      case 'walk': walkStep(p, h); break;
      case 'wait': { // 路邊：左右看、等空檔
        p.waitT += h; p.lookT += h; st.waitMax = Math.max(st.waitMax, p.waitT);
        { const dx = p.tx - p.x, dz = p.tz - p.z; if (dx * dx + dz * dz > 0.0025) { moveToward(p, p.tx, p.tz, p.baseV * 0.7, h); pushOut(p, false); } } // 走到排隊的位置
        const e = EDGES[p.route[p.lim]], dir = p.rdir[p.lim], u0 = e.pts[0], u1 = e.pts[e.pts.length - 1], ux = (u1[0] - u0[0]) * dir, uz = (u1[1] - u0[1]) * dir, base = Math.atan2(-uz, ux);
        p.hd = base + (p.lookT % 2.4 < 1.2 ? 0.75 : -0.75) * (p.waitT < 3.6 || p.clearT > 0 ? 1 : 0.6);
        if (crossClear(p, e, dir)) p.clearT += h; else p.clearT = 0;
        if (p.clearT > 0.35 && p.waitT > 1.1) { p.lim = nextCross(p, p.lim + 1); p.mode = 'walk'; p.hd = base; st.crossings++; }
        p.v = 0; break;
      }
      case 'enter': { // 進門：走到門裡面一點就不見了
        // 門口有東西（花台、機車）擋住、走不到門裡面：4 秒以後就算進去了（不然會一直卡在門口，那個人永遠不會換）
        const d = p.door; if (moveToward(p, d.hx, d.hz, p.baseV * 0.8, h) < 0.05 || (p.timer += h) > 4) { st.entered++; release(p); } else pushOut(p, false); break;
      }
      case 'sitdown': { // 轉身、往後坐下
        const s = p.seat; p.timer += h; p.hd = headOf(s.fx, s.fz);
        if (p.timer > 0.45) { moveToward(p, s.x, s.z, 1.2, h); p.hd = headOf(s.fx, s.fz); }
        if (p.timer > 1.1) { p.x = s.x; p.z = s.z; p.mode = 'sit'; p.timer = 25 + R() * (p.age === 'elder' ? 120 : 50); st.sits++; }
        p.v = 0; break;
      }
      case 'sit': p.v = 0; p.hd = headOf(p.seat.fx, p.seat.fz); if ((p.timer -= h) <= 0) { p.mode = 'standup'; p.timer = 0; } break;
      case 'standup': {
        const s = p.seat; p.timer += h;
        if (p.timer > 0.35 && moveToward(p, s.ax, s.az, 1.0, h) < 0.03) { s.by = -1; p.seat = null; const ei = NODES[s.node].e[0], e = EDGES[ei]; p.te = ei; p.ts = e.a === s.node ? 0 : e.len; goOn(p); }
        p.hd = headOf(s.fx, s.fz); p.v = 0; break;
      }
      case 'talk': {
        const q = p.partner; p.v = 0;
        if (q && q.active) { const hq = Math.atan2(-(q.z - p.z), q.x - p.x); p.hd = hq; }
        if ((p.timer -= h) <= 0 || !q || !q.active || q.partner !== p) {
          if (q && q.partner === p) q.partner = null;
          p.partner = null;
          if (p.rn) setWalk(p); else if (edgeHere(p)) goOn(p); else if (!reattach(p)) p.stuck += 5;
        }
        break;
      }
      case 'idle': p.v = 0; if ((p.timer -= h) <= 0) { if (edgeHere(p)) goOn(p); else if (!reattach(p)) p.stuck += 5; } break;
      case 'fall': { // 飛出去、滑一下
        p.x += p.vx * h; p.z += p.vz * h; p.mx = p.vx; p.mz = p.vz;
        if (p.y > 0 || p.vy > 0) { p.vy -= 9.8 * h; p.y += p.vy * h; if (p.y <= 0) { p.y = 0; p.vy = 0; } }
        if (p.y <= 0) { const sp = hyp(p.vx, p.vz), k = sp > 1e-3 ? Math.max(0, sp - 7 * h) / sp : 0; p.vx *= k; p.vz *= k; }
        pushOut(p, true);
        if (p.y <= 0 && hyp(p.vx, p.vz) < 0.08) { p.mode = 'lie'; p.timer = p.dive ? 0.45 + R() * 0.4 : 1.8 + R() * 1.8; } // 第 9 批：撲開的躺一下下就好
        p.v = 0; break;
      }
      case 'lie': p.v = 0; if ((p.timer -= h) <= 0) { p.mode = 'getup'; p.timer = 1.25; } break;
      case 'getup': p.v = 0; if ((p.timer -= h) <= 0) { if (p.dive) fleeFrom(p, p.from); else angry(p, p.knockBy); } break; // 第 9 批：撲開的爬起來跑掉
      case 'angry': { // 對車子揮手（生氣）
        p.v = 0; const c = p.from; if (c) p.hd = Math.atan2(-(c.z - p.z), c.x - p.x);
        if ((p.timer -= h) <= 0) { p.from = null; if (!reattach(p)) p.stuck += 5; }
        break;
      }
      case 'dodge': case 'flee': { // 跳開、跑走
        const sp = p.mode === 'dodge' ? 4.6 : 3.6; p.v = sp;
        p.x += p.fx * sp * h; p.z += p.fz * sp * h; p.mx = p.fx * sp; p.mz = p.fz * sp; p.hd = Math.atan2(-p.fz, p.fx);
        pushOut(p, false);
        if ((p.timer -= h) <= 0) { if (p.mode === 'dodge') angry(p, p.from); else { p.v = 0; if (!reattach(p)) p.stuck += 5; } }
        break;
      }
      case 'return': { // 走回路網上
        const left = moveToward(p, p.tx, p.tz, p.baseV, h); p.v = p.baseV; pushOut(p, false);
        if (left < 0.1) { p.x = p.tx; p.z = p.tz; goOn(p); break; }
        if (left > p.lastD - 0.2 * h) p.stuck += h; else p.stuck = Math.max(0, p.stuck - h);
        p.lastD = left;
        if (p.stuck > 2.5) { p.stuck = 0; if (!reattach(p)) p.stuck = 99; }
        break;
      }
    }
  }
  function angry(p, car) {
    p.from = car && hyp(car.x - p.x, car.z - p.z) < 30 ? car : null;
    if (p.from && R() < 0.8) { p.mode = 'angry'; p.timer = 1.6; p.sent = ''; }
    else { p.from = null; if (!reattach(p)) p.stuck += 5; }
  }
  // 推出碰撞物（房子、樹、電線桿⋯）；fly：撞到反彈
  function pushOut(p, fly) {
    const r = p.r;
    for (const c of cg.near(p.x - r - 0.1, p.z - r - 0.1, p.x + r + 0.1, p.z + r + 0.1)) {
      let nx, nz, pen;
      if (c.t === 'circle') { const dx = p.x - c.x, dz = p.z - c.z, d = hyp(dx, dz); pen = c.r + r - d; if (pen <= 0) continue; nx = d > 1e-6 ? dx / d : 1; nz = d > 1e-6 ? dz / d : 0; }
      else {
        const dx = p.x - c.x, dz = p.z - c.z, lx = dx * c.cs - dz * c.sn, lz = dx * c.sn + dz * c.cs; // 盒子本地（hx 沿 (cos, −sin)）
        const qx = clamp(lx, -c.hx, c.hx), qz = clamp(lz, -c.hz, c.hz), ex = lx - qx, ez = lz - qz, d = hyp(ex, ez);
        let lnx, lnz;
        if (d > 1e-6) { pen = r - d; if (pen <= 0) continue; lnx = ex / d; lnz = ez / d; }
        else { const ax = c.hx - Math.abs(lx), az = c.hz - Math.abs(lz); if (ax < az) { lnx = Math.sign(lx) || 1; lnz = 0; pen = ax + r; } else { lnx = 0; lnz = Math.sign(lz) || 1; pen = az + r; } }
        nx = lnx * c.cs + lnz * c.sn; nz = -lnx * c.sn + lnz * c.cs;
      }
      p.x += nx * pen; p.z += nz * pen;
      if (fly) { const vn = p.vx * nx + p.vz * nz; if (vn < 0) { p.vx -= 1.4 * vn * nx; p.vz -= 1.4 * vn * nz; p.vx *= 0.6; p.vz *= 0.6; } }
    }
  }

  // ---- 車子：撞到（飛出去／被推開）、快撞到了（跳開）----
  function carCheck(p, h) {
    if (p.gone) return;
    for (let j = 0; j < CARS.length; j++) {
      const c = CARS[j], dx = p.x - c.x, dz = p.z - c.z; if (Math.abs(dx) > 28 || Math.abs(dz) > 28) continue;
      const hh = c.heading || 0, ch = Math.cos(hh), sh = Math.sin(hh), hx = c.hx || 2.2, hz = c.hz || 0.9, v = c.v || 0, av = Math.abs(v);
      const lon = dx * ch - dz * sh, lat = dx * sh + dz * ch; // 車頭方向 (cos, −sin)、右邊 (sin, cos)
      const ex = Math.max(0, Math.abs(lon) - hx), ez = Math.max(0, Math.abs(lat) - hz);
      if (ex * ex + ez * ez < p.r * p.r && p.y < 0.6) { // 撞到了
        if (av > 2.2 && p.hitCool <= 0 && !c.ai && p.age !== 'kid') { // 玩家（或以後的警車）撞到：飛出去；路上的 AI 車只會輕輕推開；第 3 批（b3-int）：小孩永遠撞不到（只被推開）
          const s = v >= 0 ? 1 : -1, side = lat >= 0 ? 1 : -1, k = 0.35 * clamp(Math.abs(lat) / hz, 0.2, 1);
          const kx = ch * s + sh * side * k, kz = -sh * s + ch * side * k;
          knock(p, kx, kz, av, c); if (o.onHit) o.onHit(p, av, c);
        } else if (p.mode !== 'fall' && p.mode !== 'lie') { // 慢慢碰到：推開一點，生氣
          const ox = Math.abs(lon) - hx, oz = Math.abs(lat) - hz;
          if (ox > oz) { const s = lon >= 0 ? 1 : -1, m = hx + p.r + 0.02 - Math.abs(lon); p.x += ch * s * m; p.z -= sh * s * m; } else { const s = lat >= 0 ? 1 : -1, m = hz + p.r + 0.02 - Math.abs(lat); p.x += sh * s * m; p.z += ch * s * m; }
          pushOut(p, false);
          if (av > 0.3 && p.mode !== 'angry' && p.mode !== 'getup' && p.hitCool <= 0) { if (p.seat && p.seat.by === p.id) p.seat.by = -1; p.seat = null; if (p.partner) { p.partner.partner = null; p.partner = null; } p.rn = 0; p.hitCool = 1.2; st.shoves++; if (c.ai) st.aiShoves++; p.mode = 'angry'; p.from = c; p.timer = 1.4; p.sent = ''; }
        }
        continue;
      }
      // 第 9 批（路變大）：越野車（c.crush，什麼都輾）衝過來：8 公尺內（快的時候看 0.9 秒）、2 秒內會到 → 大叫、往旁邊撲倒、爬起來跑掉
      //（小孩也一定躲得開，不會嚇呆；還是被碰到的話照舊推開／撞倒（上面那段），永遠不會被輾）
      if (c.crush === true) {
        if (av < 1.5 || p.mode === 'fall' || p.mode === 'lie' || p.mode === 'getup' || p.dive) continue;
        const s = v >= 0 ? 1 : -1, ahead = lon * s - hx - p.r;
        if (ahead < -0.3 || ahead > Math.max(8.5, av * 0.9) || ahead / av > 2 || Math.abs(lat) > hz + p.r + 1.4) continue;
        dive(p, lat, sh, ch, hz, c); continue;
      }
      // 快撞到：車子往這邊開、1.3 秒內會到、在車子前面的路線上 → 往旁邊跳開
      //（路上的 AI 車會自己煞車：煞不住才跳；往旁邊跳不過去（牆）的話不要反過來跳到車子前面）
      if (av < 3 || p.mode === 'fall' || p.mode === 'lie' || p.mode === 'getup' || p.mode === 'dodge' || p.freeze > 0) continue;
      const s = v >= 0 ? 1 : -1, ahead = lon * s - hx - p.r; if (ahead < -0.2) continue;
      const t = ahead / av; if (t > 1.3 || Math.abs(lat) > hz + p.r + (c.ai ? 0.1 : 0.55)) continue;
      if (c.ai && ahead > (av * av) / 10 + 0.5) continue;
      if ((t < p.react * 0.6 || R() < 0.12) && p.age !== 'kid') { p.freeze = 1; continue; } // 來不及／嚇呆了（小孩一定會跳開）
      let side = lat >= 0 ? 1 : -1; if (Math.abs(lat) < 0.15 && R() < 0.5) side = -side;
      let fx = sh * side, fz = ch * side;
      if (!W.clearAt(p.x + fx * 1.8, p.z + fz * 1.8, 0.28)) { if (c.ai || Math.abs(lat) > hz * 0.5) { p.freeze = 1; continue; } fx = -fx; fz = -fz; if (!W.clearAt(p.x + fx * 1.8, p.z + fz * 1.8, 0.28)) { p.freeze = 1; continue; } }
      if (p.seat && p.seat.by === p.id) p.seat.by = -1; p.seat = null;
      if (p.partner) { p.partner.partner = null; p.partner = null; }
      p.fx = fx; p.fz = fz; p.mode = 'dodge'; p.timer = clamp((hz + p.r + 0.5 - Math.abs(lat)) / 4.6 + 0.12, 0.25, 0.7); p.from = c; p.rn = 0; st.dodges++;
    }
  }

  // 第 9 批：撲開（往車子的旁邊飛出去、倒地；沒有受傷：不算被撞、不報警）
  function dive(p, lat, sh, ch, hz, c) {
    let side = lat >= 0 ? 1 : -1; if (Math.abs(lat) < 0.2 && R() < 0.5) side = -side;
    let fx = sh * side, fz = ch * side;
    if (Math.abs(lat) < hz && !W.clearAt(p.x + fx * 2.4, p.z + fz * 2.4, 0.28) && W.clearAt(p.x - fx * 2.4, p.z - fz * 2.4, 0.28)) { fx = -fx; fz = -fz; } // 那邊是牆：往另一邊
    if (p.seat && p.seat.by === p.id) p.seat.by = -1; p.seat = null;
    if (p.partner) { const q = p.partner; p.partner = null; if (q.partner === p) q.partner = null; }
    const sp = 6.4 - Math.min(1.2, Math.abs(lat) * 0.5);
    p.vx = fx * sp; p.vz = fz * sp; p.vy = 2.4; p.y = Math.max(p.y, 0.02);
    p.mode = 'fall'; p.heading = p.hd = headOf(-fx, -fz); p.v = 0; p.hitCool = 1.2; p.knockBy = null; p.from = c; p.rn = 0; p.dive = 1; p.freeze = 0;
    st.dives++; shout(p);
    if (o.onDive) try { o.onDive(p, c); } catch (e) { console.warn(e); }
  }
  function fleeFrom(p, c) { // 爬起來，往離車子遠的那邊跑
    let dx = c ? p.x - c.x : R() - 0.5, dz = c ? p.z - c.z : R() - 0.5; const l = hyp(dx, dz) || 1; dx /= l; dz /= l;
    p.dive = 0; p.from = null; p.fx = dx; p.fz = dz; p.mode = 'flee'; p.timer = 2.2 + R() * 1.4; p.rn = 0;
  }
  // 「哇！」：頭上一個小字（4 個重複用；第一次用到才做）
  const SH = []; let shTex = null;
  function shout(p) {
    if (!scene || typeof document === 'undefined') return;
    if (!shTex) {
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.strokeStyle = '#222'; g.lineWidth = 4; g.beginPath(); g.roundRect ? g.roundRect(4, 4, 120, 50, 18) : g.rect(4, 4, 120, 50); g.fill(); g.stroke();
      g.fillStyle = '#e0302a'; g.font = 'bold 34px "Noto Sans TC", "PingFang TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('哇！', 64, 31);
      shTex = new THREE.CanvasTexture(cv); shTex.colorSpace = THREE.SRGBColorSpace;
      for (let i = 0; i < 4; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: shTex, depthTest: false, transparent: true })); m.scale.set(1.1, 0.55, 1); m.visible = false; m.renderOrder = 5; scene.add(m); SH.push({ m, p: null, t: 0 }); }
    }
    let q = SH[0]; for (const k of SH) { if (!k.p) { q = k; break; } if (k.t > q.t) q = k; }
    q.p = p; q.t = 0; q.m.visible = true;
  }
  function shoutTick(dt) {
    for (const q of SH) { if (!q.p) continue; q.t += dt; const p = q.p; if (q.t > 1.1 || p.gone || !p.active) { q.p = null; q.m.visible = false; continue; } q.m.position.set(p.x, 2.15 + p.y + Math.min(0.25, q.t * 0.6), p.z); }
  }
  // ---- 每一幀 ----
  let WALKERS = NONE2;
  function update(dt, focus = {}, cars = NONE2, walkers = NONE2) {
    if (!alive || !(dt > 0)) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    dt = Math.min(dt, 0.1); frame++; TM[0] += dt; budget = filled ? 1 : Infinity;
    const fx = focus.x ?? 0, fz = focus.z ?? 0, fh = focus.heading;
    view.frame();
    CARS.length = 0; for (let i = 0; i < cars.length; i++) { const c = cars[i]; if (!c) continue; if (Array.isArray(c)) { for (let k = 0; k < c.length; k++) if (c[k] && !c[k].gone) CARS.push(c[k]); } else if (!c.gone) CARS.push(c); }
    WALKERS = walkers;
    // 收掉太遠的、卡住的
    for (let i = people.length - 1; i >= 0; i--) {
      const p = people[i], d = hyp(p.x - fx, p.z - fz);
      if (d > radius + 15 || (p.stuck > 12 && !seenAt(p.x, p.z, fx, fz, fh))) { if (p.stuck > 12) st.stuckGone++; release(p); }
    }
    // 補人：第一幀一次補滿（坐著的、聊天的、走路的），之後每 0.6 秒一個（大多從家裡走出來）
    TM[1] -= dt;
    if (!filled) {
      filled = true;
      for (let k = 0; k < max * 4 && people.length < max; k++) { const r = R(); if (r < 0.22) spawnSeat(fx, fz, fh, true); else if (r < 0.36 && people.length < max - 1) spawnTalk(fx, fz, fh, true); else spawnWalk(fx, fz, fh, true); }
    } else if (people.length < max && TM[1] <= 0) {
      const r = R(); let ok = false;
      if (r < 0.55) ok = spawnDoor(fx, fz, fh); else if (r < 0.63) ok = spawnSeat(fx, fz, fh, false); else if (r < 0.7 && people.length < max - 1) ok = spawnTalk(fx, fz, fh, false);
      if (!ok) spawnWalk(fx, fz, fh, false);
      TM[1] = 0.6;
    }
    // 動（倒著跑：進門的人會從陣列拿掉）
    for (let i = people.length - 1; i >= 0; i--) {
      const p = people[i];
      p.far = hyp(p.x - fx, p.z - fz);
      const k = p.far > 100 && p.mode !== 'fall' ? 4 : 1; // 很遠的：四幀動一次
      p.animAcc += dt; if ((frame + p.id) % k) continue;
      const h = p.animAcc; p.animAcc = 0; p.freeze -= h;
      const n = Math.ceil(h / 0.05 - 1e-6), hh = h / n;
      for (let s = 0; s < n && p.active; s++) { stepPerson(p, hh); if (p.active) carCheck(p, hh); }
    }
    // 人跟人不要重疊（坐著的不動）
    for (let i = 0; i < people.length; i++) {
      const a = people[i]; if (a.gone || a.mode === 'fall') continue;
      for (let j = i + 1; j < people.length; j++) {
        const b = people[j]; if (b.gone || b.mode === 'fall') continue;
        const dx = b.x - a.x, dz = b.z - a.z, rr = a.r + b.r; if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
        const d = hyp(dx, dz); if (d >= rr || d < 1e-5) continue;
        const pen = rr - d, am = a.mode === 'sit' || a.mode === 'sitdown' ? 0 : 1, bm = b.mode === 'sit' || b.mode === 'sitdown' ? 0 : 1; if (!am && !bm) continue;
        const ka = (am / (am + bm)) * pen, kb = (bm / (am + bm)) * pen;
        if (a.mode === 'wait') { let k = -(dx * a.fx + dz * a.fz) / d; if (k < 0.3 && k > -0.3) k = a.id < b.id ? -1 : 1; a.x += a.fx * k * ka; a.z += a.fz * k * ka; a.tx = a.x; a.tz = a.z; } // 等過馬路的：只沿著路邊推
        else { a.x -= (dx / d) * ka; a.z -= (dz / d) * ka; }
        if (b.mode === 'wait') { let k = (dx * b.fx + dz * b.fz) / d; if (k < 0.3 && k > -0.3) k = b.id < a.id ? -1 : 1; b.x += b.fx * k * kb; b.z += b.fz * k * kb; b.tx = b.x; b.tz = b.z; }
        else { b.x += (dx / d) * kb; b.z += (dz / d) * kb; }
        if (ka > 0.01) pushOut(a, false); if (kb > 0.01) pushOut(b, false);
      }
    }
    // 畫面
    for (let i = 0; i < people.length; i++) {
      const p = people[i]; if (!p.ch) continue;
      const g = p.ch.group, vis = p.far < visR; g.visible = vis;
      // 轉身：慢慢轉
      const da = wrapA(p.hd - p.heading), turn = (p.mode === 'dodge' || p.mode === 'flee' || p.mode === 'fall' ? 14 : 6) * dt; p.heading += clamp(da, -turn, turn);
      g.position.set(p.x, p.y, p.z); g.rotation.y = p.heading;
      if (!vis) continue;
      const k = p.far < AN[0] ? 1 : p.far < AN[1] ? 2 : 4; p.animT += dt; if ((frame + p.id) % k) continue;
      const adt = p.animT; p.animT = 0;
      let s = 'idle';
      switch (p.mode) {
        case 'walk': case 'return': s = p.v > 2.2 ? 'run' : p.v > 0.12 ? 'walk' : 'idle'; break;
        case 'wait': s = p.mx * p.mx + p.mz * p.mz > 0.01 ? 'walk' : 'idle'; break; // 走到路邊排隊的位置
        case 'dodge': case 'flee': s = 'run'; break;
        case 'talk': s = 'talk'; break;
        case 'sit': case 'sitdown': s = p.mode === 'sitdown' && p.timer < 0.45 ? 'idle' : 'sit'; break;
        case 'standup': s = p.timer < 0.35 ? 'sit' : 'idle'; break;
        case 'fall': case 'lie': s = 'fall'; break;
        case 'getup': s = 'getup'; break;
        case 'angry': s = 'wave'; break;
        case 'enter': s = 'walk'; break;
      }
      send(p, s, p.mode === 'enter' ? p.baseV * 0.8 : p.mode === 'wait' ? hyp(p.mx, p.mz) : p.v, adt);
    }
    if (SH.length) shoutTick(dt); // 第 9 批：「哇！」
    const ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    st.ms += ms; st.maxMs = Math.max(st.maxMs, ms); st.frames++; st.active = people.length;
  }

  // ---- 給走路的玩家用的碰撞（圓柱；重複用同一批物件）----
  const colOut = [], colPool = [];
  function colliders(x, z, r) {
    colOut.length = 0;
    for (let i = 0; i < people.length; i++) {
      const p = people[i]; if (p.gone || (x != null && hyp(p.x - x, p.z - z) > r + 0.5)) continue;
      const c = colPool[colOut.length] || (colPool[colOut.length] = { t: 'circle', x: -0, z: -0, r: 0.3, h: 1.7, npc: 'ped', person: null });
      c.x = p.x; c.z = p.z; c.r = p.r; c.person = p; c.h = p.mode === 'fall' || p.mode === 'lie' ? 0.35 : p.mode === 'sit' ? 1.3 : 1.7; colOut.push(c);
    }
    return colOut;
  }
  function nearest(x, z, r = 1.5) { let best = null, bd = r; for (const p of people) { if (p.gone) continue; const d = hyp(p.x - x, p.z - z) - p.r; if (d < bd) { bd = d; best = p; } } return best; }
  function dispose() {
    alive = false;
    for (const p of people.slice()) release(p);
    for (const ch of chFree) ch.dispose();
    chFree.length = 0;
    if (propMesh) { propMesh.removeFromParent(); propMesh = null; }
    for (const q of SH) { q.m.removeFromParent(); q.m.material.dispose(); } SH.length = 0; if (shTex) { shTex.dispose(); shTex = null; }
  }
  return { update, people, colliders, scare, knock, bail, nearest, prewarm, dispose, graph: W, props: { colliders: W.props.colliders, seats: W.props.seats }, stats: st, get time() { return TM[0]; } };
}

return { createTraffic, createPedestrians, npcGraphs };
})();
