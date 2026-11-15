// vdtraffic.js — 第 92 批（Nick 2026-11-15「高速公路要有少許的車」「比較厲害的跑車開快一點這樣比較真」
//   「休息站…要有人車 車一樣從車店挑 有車進來有車離開」）
// 高架橋（viaduct.js）自己的車流：只有幾台、從車店挑（town.src.js 的 lotKind／lotLook）；跑車、超跑開快一點、走內線。
//   主線一個方向四線（第 94 批；中線往外 2.2、5.55、8.9、12.25；往 +S 的在 +u 那邊）；最外面那線的車有的從交流道下去：
//     A（環山路）、B（內湖路二段）：開到地上再一段；EX、WX：進休息站找空的格子停，停一陣子倒車出來，從 EE、WE 回主線。
//   休息站本來就停著的車（viaduct.js lot.cars area 'r'）有時候也倒車出來開走（那一格就空了，進來的車可以停）。
//   兩頭：往 +S 的開到內湖的大馬路上一段、往 −S 的開進超大停車場中間的走道往南到快速道路的口；超大停車場也有車從快速道路進來上橋。
//   只算玩家附近（離主線或休息站不遠）；新的車在 420 公尺外才出現（Nick「車子不要靠近才變出來」）；開到盡頭的車玩家在附近就停著等（不會在面前不見）。
// 用法：const T = createVdTraffic(VDV, { pick(n) → { k, look, fast, d: [長, 寬, 高] } | null, lotPick(c) → 同上（休息站停著的那台）, heightAt(x, z), onTake(c), rnd })
//   T.update(dt, me)：me＝{ x, y, z, on }（玩家；同一層、在車前面就停下來等）
//   T.cars：[{ id, x, y, z, h（npc 的方向：前面＝(cos h, −sin h)）, pitch, v, k, look, roll, rev, obj }]（town 放輕量車）；T.gone：這一格不見的（town 收回輕量車）
//   T.colliders(x, z, r, y) → 同一層（±2.5 公尺）的車（npc.js 的格式；drive.js addColliders、走路的 movers）
//   T.depart()、T.spawnAt(lineId, d, k)：測試用；T.info
// 第 93 批（Nick 2026-11-15「高速公路有額外的警用追逐車用GC8去查國道警車塗裝並採用」）：國道警察（c.cop；town 用 police.js makePoliceCar('hwy')＝GC8 白底紅條）
//   平常主線上有 1 台巡邏（跟一般的車一樣開在線上、不下交流道）；你被通緝（o.wanted() > 0）又在主線上（me.r＝0、分隔島兩邊的路）：追你
//   追的時候自己照主線的 s、u 開（c.cs、c.cu；只在你那一邊，分隔島擋住），前面有車就換一線、閃不過就跟著；路上的車看到後面有閃燈的警車會讓（換到旁邊那一線）
//   COP_SEE 公尺內＝o.copSeen()（警察知道你在哪：星星不會掉）；你停下來（或走路）、牠在 10 公尺內 1.2 秒＝o.caught()（被國道警察抓到）；你撞牠＝o.copHit()（+1★）
//   你離開主線（交流道、休息站、下橋）、沒有星星了、太遠：不追了（關燈；方向對就回到線上巡邏，不對就停在路邊，看不到就收掉）
//   me 多 r、s、u（主線上的位置；不在主線 r＝−1）、v（車速）、walk（走路）
//   c.needObj＝town 把輕量車放好以前不動、不擋（新生的車：生在 420 公尺外，做好才開；休息站開走的那台：c.lot＝停著的那台（lot.cars），放好了 town 藏起停著的那台、清掉 needObj）；o.onGive(lc)：放回去
export const { createVdTraffic } = (() => {
const LANE = [2.2, 5.55, 8.9, 12.25]; // 每一線離中線多遠（第 93 批：中間有分隔島，內線往外移；以前 1.85）（第 94 批：一邊 4 線，以前 [2.2, 5.55]）
const NL = LANE.length, OUT = NL - 1; // 最外面那一線：下交流道、從交流道上來
// 第 94 批：最後那段（成功路二段456巷的大馬路一邊只有 2 線）：外面兩線（k 2、3）在 DROP0…DROP1（離終點幾公尺）慢慢併到裡面兩線（k 0、1）的位置；車子在那以前就換到裡面
const DROP0 = 330, DROP1 = 170, DROP_GO = 520;
const COP_TOP = 50, COP_SEE = 90; // 第 93 批：國道警察追你最快 50 m/s（180 公里）；90 公尺內（同一層）看得到你
const KMH = 1 / 3.6;
function createVdTraffic(V, o = {}) {
  const P = V.path, MAIN = V.roads[0], RL = V.restL, LOT = V.lot, rnd = o.rnd || Math.random, hAt = o.heightAt || (() => 0);
  const n = P.n, mS = P.S, sH = P.sH, sD = V.sD, L = P.L, Yd = V.Y;
  // ---- 線：點（x、y、z）、累積距離、方向、曲率 → 每一點最快多少（底：側向 1 m/s²、煞車 0.7 m/s²；每台車再乘 √側向加速度）、速限 ----
  const mkLine = (id, X, Y, Z, lim, extra = {}) => {
    const m = X.length, S = new Float32Array(m), TX = new Float32Array(m), TZ = new Float32Array(m), G = new Float32Array(m), VB = new Float32Array(m), LS = new Float32Array(m);
    for (let i = 1; i < m; i++) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]);
    for (let i = 0; i < m; i++) { const a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1), dx = X[b] - X[a], dz = Z[b] - Z[a], l = Math.hypot(dx, dz) || 1; TX[i] = dx / l; TZ[i] = dz / l; G[i] = (Y[b] - Y[a]) / (S[b] - S[a] || 1); }
    for (let i = 0; i < m; i++) { // 曲率：前後 3 點的方向差
      const a = Math.max(0, i - 3), b = Math.min(m - 1, i + 3); let da = Math.atan2(TZ[b], TX[b]) - Math.atan2(TZ[a], TX[a]); while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const k = Math.abs(da) / Math.max(0.5, S[b] - S[a]); VB[i] = k > 1e-4 ? Math.sqrt(1 / k) : 100; LS[i] = lim[i];
    }
    for (let i = m - 2; i >= 0; i--) { const ds = S[i + 1] - S[i]; VB[i] = Math.min(VB[i], Math.sqrt(VB[i + 1] * VB[i + 1] + 2 * 0.7 * ds)); LS[i] = Math.min(LS[i], Math.sqrt(LS[i + 1] * LS[i + 1] + 2 * 2.2 * ds)); }
    return { id, X, Y, Z, S, TX, TZ, G, VB, LS, m, L: S[m - 1], ...extra };
  };
  const fill = (m, v) => new Float32Array(m).fill(v);
  // 主線的速限：圓環（60）、下來那段（50）、中間（80）
  const mainLim = (s) => (s < sH + 40 ? 60 : s > sD - 20 ? 50 : 80) * KMH;
  const lines = new Map(), LN = (l) => (lines.set(l.id, l), l);
  // 主線八條：dir ±1（+1＝往 +S）、lane 0…3；點跟主線的點對齊（反方向的倒過來）；兩頭各接一段（內湖的大馬路；超大停車場的走道）
  const uAt = (k, s) => { if (k < 2) return LANE[k]; const t = Math.max(0, Math.min(1, (s - (L - DROP0)) / (DROP0 - DROP1))); return LANE[k] + (LANE[k - 2] - LANE[k]) * t * t * (3 - 2 * t); }; // 第 94 批：外面兩線最後併進來
  const mainLine = (dir, k) => {
    const u = dir * LANE[k], X = [], Y = [], Z = [], lim = [], ms = [];
    const push = (x, y, z, l, s) => { X.push(x); Y.push(y); Z.push(z); lim.push(l); ms.push(s); };
    const at = (i) => { const uu = dir * uAt(k, mS[i]); push(P.X[i] - P.TZ[i] * uu, Yd[i], P.Z[i] + P.TX[i] * uu, mainLim(mS[i]), mS[i]); };
    if (dir > 0) {
      for (const q of lotIn(k)) push(q[0], hAt(q[0], q[1]) + 0.02, q[1], 25 * KMH, -1);
      for (let i = 7; i < n; i++) at(i); // 前面 7 點（14 公尺）給停車場那段轉彎
      const e = n - 1, ue = dir * uAt(k, L); for (let d = 4; d <= 120; d += 4) { const x = P.X[e] - P.TZ[e] * ue + P.TX[e] * d, z = P.Z[e] + P.TX[e] * ue + P.TZ[e] * d; push(x, hAt(x, z) + 0.02, z, 50 * KMH, -1); } // 內湖的大馬路
    } else {
      const e = n - 1, ue = dir * uAt(k, L); for (let d = 120; d >= 4; d -= 4) { const x = P.X[e] - P.TZ[e] * ue + P.TX[e] * d, z = P.Z[e] + P.TX[e] * ue + P.TZ[e] * d; push(x, hAt(x, z) + 0.02, z, 50 * KMH, -1); }
      for (let i = n - 1; i >= 7; i--) at(i);
      for (const q of lotOut(k)) push(q[0], hAt(q[0], q[1]) + 0.02, q[1], 25 * KMH, -1);
    }
    return LN(mkLine(`M${dir > 0 ? '+' : '-'}${k}`, Float32Array.from(X), Float32Array.from(Y), Float32Array.from(Z), Float32Array.from(lim), { dir, k, ms: Float32Array.from(ms) }));
  };
  // 超大停車場中間的走道（x −780，往北的靠東 1.8、往南的靠西 1.8）⇄ 主線的頭（−780, 145 往西）；南邊停在連到快速道路那條路的 z 452（不要停到快速道路上）
  function lotIn(k) { // 從快速道路的口往北，左轉上主線（+S 那邊在北邊）；回傳到主線第 7 點前面
    const u = LANE[k], i7 = 7, ex = P.X[i7] - P.TZ[i7] * u, ez = P.Z[i7] + P.TX[i7] * u;
    return rounded([[-778.2, 452], [-778.2, ez], [ex, ez]], 7, 2).slice(0, -1);
  }
  function lotOut(k) { // 主線第 7 點之後（往東）右轉進走道往南
    const u = -LANE[k], i7 = 7, ex = P.X[i7] - P.TZ[i7] * u, ez = P.Z[i7] + P.TX[i7] * u;
    return rounded([[ex, ez], [-781.8, ez], [-781.8, 452]], 7, 2).slice(1);
  }
  const ML = {}; for (const dir of [1, -1]) for (let k = 0; k < NL; k++) ML[`${dir},${k}`] = mainLine(dir, k);
  // 主線的 s → 某條主線上的距離（找最接近的那一點：ms 是單調的）
  const dOfMs = (l, s) => { const M = l.ms; let lo = 0, hi = l.m - 1; const up = l.dir > 0; // ms＝−1 的（兩頭接的）不算
    let a = -1; for (let i = 0; i < l.m; i++) if (M[i] >= 0) { a = i; break; } let b = -1; for (let i = l.m - 1; i >= 0; i--) if (M[i] >= 0) { b = i; break; }
    lo = a; hi = b; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (up ? M[mid] <= s : M[mid] >= s) lo = mid; else hi = mid; }
    const t = (s - M[lo]) / (M[hi] - M[lo] || 1); return l.S[lo] + (l.S[hi] - l.S[lo]) * Math.max(0, Math.min(1, t)); };
  // ---- 交流道：出口從主線最外面那線離開（離中線 12.25 以外那段才走交流道）、入口在最外面那線接回主線 ----
  const junc = new Map(); for (const l of Object.values(ML)) junc.set(l.id, []);
  const ramps = {};
  for (const r of V.roads.slice(1)) {
    const D = r.def, m = r.n; if (!r.Y) continue;
    const lim = D.rest ? (D.exit ? 40 : 60) : 50, out = [];
    let i0 = 0, i1 = m - 1;
    if (D.exit) { for (i0 = 0; i0 < m - 1 && r.MS[i0] >= 0 && r.UC[i0] < LANE[OUT]; i0++); }
    else { for (i1 = m - 1; i1 > 0 && r.MS[i1] >= 0 && r.UC[i1] < LANE[OUT]; i1--); }
    const X = [], Y = [], Z = [], LM = [];
    for (let i = i0; i <= i1; i++) { X.push(r.X[i]); Y.push(r.Y[i]); Z.push(r.Z[i]); LM.push(lim * KMH); }
    if (D.exit && !D.rest) { const e = m - 1, ed = D.endDir || [r.TX[e], r.TZ[e]]; for (let d = 4; d <= 80; d += 4) { const x = r.X[e] + ed[0] * d, z = r.Z[e] + ed[1] * d; X.push(x); Y.push(hAt(x, z) + 0.02); Z.push(z); LM.push(40 * KMH); } } // 下去以後在地上的路再開一段
    const rl = LN(mkLine('R' + D.id, Float32Array.from(X), Float32Array.from(Y), Float32Array.from(Z), Float32Array.from(LM), { ramp: D }));
    ramps[D.id] = rl;
    const ml = ML[`${D.dir},${OUT}`];
    if (D.exit) junc.get(ml.id).push({ d: dOfMs(ml, r.MS[i0]), ramp: rl, id: D.id, rest: !!D.rest });
    else rl.merge = { line: ml, d: dOfMs(ml, r.MS[i1]) };
  }
  for (const a of junc.values()) a.sort((p, q) => p.d - q.d);
  // ---- 休息站裡面的路（vdrest.js restLayout）：圓角的折線、進格子（二次貝茲曲線）、倒車出來 ----
  const yR = (RL ? RL.y : 24) + 0.02;
  function rounded(W, R, step = 1) { // W：[[x, z]…]；轉角切 R（不超過兩邊的一半）、中間用二次貝茲；每 step 公尺一點
    const out = [W[0]];
    const seg = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(l / step)); for (let j = 1; j <= k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]); };
    let cur = W[0];
    for (let i = 1; i < W.length - 1; i++) {
      const a = W[i - 1], b = W[i], c = W[i + 1], l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const u1 = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1], u2 = [(c[0] - b[0]) / l2, (c[1] - b[1]) / l2], th = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])));
      const cut = Math.min(R * Math.tan(th / 2), l1 / 2, l2 / 2); if (cut < 0.05) { seg(cur, b); cur = b; continue; }
      const p0 = [b[0] - u1[0] * cut, b[1] - u1[1] * cut], p2 = [b[0] + u2[0] * cut, b[1] + u2[1] * cut]; seg(cur, p0);
      const k = Math.max(3, Math.round((cut * th) / step) + 2); for (let j = 1; j <= k; j++) { const t = j / k, s = 1 - t; out.push([s * s * p0[0] + 2 * s * t * b[0] + t * t * p2[0], s * s * p0[1] + 2 * s * t * b[1] + t * t * p2[1]]); }
      cur = p2;
    }
    seg(cur, W[W.length - 1]); return out;
  }
  const bez = (p0, p1, p2, k = 10) => { const out = []; for (let j = 0; j <= k; j++) { const t = j / k, s = 1 - t; out.push([s * s * p0[0] + 2 * s * t * p1[0] + t * t * p2[0], s * s * p0[1] + 2 * s * t * p1[1] + t * t * p2[1]]); } return out; };
  let restN = 0;
  const flat = (pts, v, id) => { const m = pts.length, X = new Float32Array(m), Z = new Float32Array(m); pts.forEach((q, i) => { X[i] = q[0]; Z[i] = q[1]; }); return mkLine(id || 'r' + restN++, X, fill(m, yR), Z, fill(m, v)); };
  const AISLE = (row) => (row < 2 ? RL.lanes.A1 : RL.lanes.A2); // 第 0、1 排在走道 1；第 2、3 排在走道 2
  const NE = RL ? RL.lanes.N[1] : 0, SW = RL ? RL.lanes.S[0] : 0; // 北邊那條往東的右線、南邊那條往西的右線
  const CWs = RL ? RL.lanes.CW - 2 : 0, CEn = RL ? RL.lanes.CE + 2 : 0; // 西邊那條往南（靠西）、東邊那條往北（靠東）
  // 進來：EX（往東，北邊那條）→ 西邊那條往南 → 走道往東 → 格子；WX（往西，南邊那條）→ 東邊那條往北 → 走道往西 → 格子
  function arrive(side, bay) {
    const aZ = AISLE(bay.row), east = side > 0, lz = east ? aZ + 1.75 : aZ - 1.75, ax = bay.x - (east ? 6 : -6);
    const W = east ? [[830, 186], [CWs, 186], [CWs, lz], [ax, lz]] : [[1214, 287], [1196, SW], [CEn, SW], [CEn, lz], [ax, lz]];
    const road = rounded(W, 5);
    return [{ line: flat(road, 7) }, { line: flat(bez([ax, lz], [bay.x, lz], [bay.x, bay.z]), 2), stop: true }];
  }
  // 出去：倒車出來（車頭朝要去的方向）→ 走道 → 往東：東邊那條往北、北邊那條到 EE；往西：西邊那條往南、南邊那條到 WE
  function leave(side, bay) {
    const aZ = AISLE(bay.row), east = side > 0, lz = east ? aZ + 1.75 : aZ - 1.75, ax = bay.x - (east ? 6 : -6);
    const back = bez([bay.x, bay.z], [bay.x, lz], [ax, lz]);
    const W = east ? [[ax, lz], [CEn, lz], [CEn, 186], [1196, 186]] : [[ax, lz], [CWs, lz], [CWs, 286], [800, 286]];
    return [{ line: flat(back, 1.3), rev: true, stop: true }, { line: flat(rounded(W, 5), 7) }, { line: ramps[east ? 'EE' : 'WE'] }];
  }
  function through(side) { // 沒有空的格子：直接開過去
    const W = side > 0 ? [[830, 186], [845, NE], [1185, NE], [1196, 186]] : [[1214, 287], [1200, SW], [815, SW], [800, 286]];
    return [{ line: flat(rounded(W, 5), 8) }, { line: ramps[side > 0 ? 'EE' : 'WE'] }];
  }
  // ---- 休息站的格子：誰停著（本來就停著的、我們的車）----
  const bays = RL ? RL.bays : [];
  const lotOf = new Map(); if (LOT) for (const c of LOT.cars) if (c.area === 'r') lotOf.set(c.j - 20000, c);
  const bayFree = (b) => { if (b.res) return false; const c = lotOf.get(b.n); return !c || c.taken; };
  const restC = RL ? [(RL.lot.x0 + RL.lot.x1) / 2, (RL.lot.z0 + RL.lot.z1) / 2] : [0, 0];
  // ---- 車 ----
  const cars = [], gone = [], st = { lanes: 0, gave: 0, spawned: 0, despawned: 0, exits: 0, arrived: 0, parked: 0, departed: 0, merged: 0, waits: 0, took: 0, lost: 0, active: false };
  let nid = 1, seed = 1;
  const newCar = (p) => { const f = p.fast | 0; return { id: nid++, k: p.k, look: p.look, fast: f, len: p.d[0], wid: p.d[1], hgt: p.d[2], x: 0, y: 0, z: 0, h: 0, pitch: 0, v: 0, roll: 0, rev: false, obj: null,
    top: (f === 2 ? 33 : f === 1 ? 28 : 22.5) + (rnd() - 0.5) * 2.4, mul: f === 2 ? 1.5 : f === 1 ? 1.25 : 1 + (rnd() - 0.5) * 0.1, alat: f === 2 ? 5 : f === 1 ? 4.2 : 3.4,
    route: [], si: 0, line: null, d: 0, hint: 0, lk: 0, ox: 0, oz: 0, lcT: 0, stop: false, state: 'drive', t: 0, bay: null, wait: 0, rest: false }; };
  const begin = (c, steps) => { c.route = steps; c.si = 0; enter(c, 0); };
  function enter(c, d) { const s = c.route[c.si]; c.line = s.line; c.d = d; c.hint = 0; c.rev = !!s.rev; c.stop = !!s.stop; place(c); }
  function place(c) {
    const l = c.line; let i = Math.min(c.hint, l.m - 2); while (i > 0 && l.S[i] > c.d) i--; while (i < l.m - 2 && l.S[i + 1] < c.d) i++; c.hint = i;
    const t = Math.max(0, Math.min(1, (c.d - l.S[i]) / (l.S[i + 1] - l.S[i] || 1)));
    c.x = l.X[i] + (l.X[i + 1] - l.X[i]) * t; c.y = l.Y[i] + (l.Y[i + 1] - l.Y[i]) * t; c.z = l.Z[i] + (l.Z[i + 1] - l.Z[i]) * t;
    const tx = l.TX[i] + (l.TX[i + 1] - l.TX[i]) * t, tz = l.TZ[i] + (l.TZ[i + 1] - l.TZ[i]) * t, g = l.G[i];
    c.h = Math.atan2(-tz, tx) + (c.rev ? Math.PI : 0); c.pitch = Math.atan(g) * (c.rev ? -1 : 1);
    c.vb = l.VB[i]; c.ls = l.LS[i]; c.lx = c.x; c.lz = c.z; c.lh = c.h; // 線上的位置（換線的時候畫的位置會偏，前後車照這個算）
  }
  // 主線上：要不要下交流道（最外面那線的車、前面的出口：休息站 30%、A／B 各 22%）
  function planMain(c, line, d) {
    const steps = [{ line }]; c.rest = false;
    if (line.k === OUT && !c.noExit) for (const j of junc.get(line.id)) { if (j.d < d + 60) continue; if (rnd() < (j.rest ? 0.3 : 0.22)) { steps[0].end = j.d; steps.push({ line: j.ramp, exit: j }); break; } }
    c.route = steps; c.si = 0; c.line = line; c.d = d; c.hint = 0; c.rev = false; c.stop = false; place(c);
  }
  // 換線（主線上，同一個方向旁邊那一線）：那一線前後沒有車、沒有你；有要下交流道的不換
  //   第 94 批：一邊 4 線：先試裡面那線（超車），不行再試外面那線；inward＝只往裡面（最後那段外面兩線要併進來）
  const LC_T = 2.4;
  function laneChange(c, me, inward = false) {
    c.lcT = 1.5; const l = c.line; if (!l.ms || c.rev || c.lk > 0 || c.route.length > 1 || c.route[c.si].end != null) return false;
    const s = l.ms[c.hint]; if (!(s > 0)) return false;
    for (const k2 of inward ? [l.k - 1] : [l.k - 1, l.k + 1]) {
      if (k2 < 0 || k2 >= NL || (k2 >= 2 && s > L - DROP_GO)) continue; // 快到終點：不換到外面兩線
      if (tryLane(c, me, ML[`${l.dir},${k2}`], s)) return true;
    }
    return false;
  }
  function tryLane(c, me, ol, s) {
    const d2 = dOfMs(ol, s); if (d2 < 10 || d2 > ol.L - 60) return false;
    for (const q of cars) if (q !== c && q.line === ol && q.d > d2 - 22 && q.d < d2 + 40) return false;
    const i = Math.min(ol.m - 1, Math.max(0, Math.round((d2 / ol.L) * (ol.m - 1)))); // 大約的點（換到那一線的位置）
    if (Math.abs(me.y - ol.Y[i]) < 2.5 && Math.hypot(me.x - ol.X[i], me.z - ol.Z[i]) < 30) { // 你在那一線：不換
      const ex = me.x - ol.X[i], ez = me.z - ol.Z[i]; if (Math.abs(-ex * ol.TZ[i] + ez * ol.TX[i]) < 2.4) return false; }
    const x0 = c.x, z0 = c.z; c.route = [{ line: ol }]; c.si = 0; c.line = ol; c.d = d2; c.hint = 0; place(c);
    c.ox = x0 - c.x; c.oz = z0 - c.z; c.lk = 1; c.lcT = 8; st.lanes++; return true;
  }
  // 一段走完：下一段；沒有了＝盡頭（玩家在附近就停著等，不然不見）
  function next(c, me) {
    const s = c.route[c.si];
    if (s.line.merge && c.si === c.route.length - 1) { st.merged++; const m = s.line.merge; c.noExit = false; planMain(c, m.line, m.d); return true; } // 入口接回主線
    if (s.exit && s.exit.rest && c.si === c.route.length - 1) { // 休息站的出口下來了：找空的格子
      st.exits++; const side = s.exit.id === 'EX' ? 1 : -1, free = bays.filter(bayFree);
      if (free.length && cars.filter((q) => q.rest && q.state !== 'gone').length < 7) { const b = free[Math.floor(rnd() * free.length)]; b.res = c.id; c.bay = b; c.side = side; c.route = arrive(side, b); } else c.route = through(side);
      c.rest = true; c.si = 0; enter(c, 0); return true;
    }
    if (c.si < c.route.length - 1) { c.si++; enter(c, 0); return true; }
    if (c.bay && c.state === 'drive' && c.stop) { c.state = 'park'; c.t = 40 + rnd() * 80; c.v = 0; st.parked++; return true; } // 停好了
    return false;
  }
  const dist = (c, me) => Math.hypot(c.x - me.x, c.z - me.z);
  // 生一台：在主線（四條）或停車場的口、離玩家 420～800 公尺
  function spawnMain(me, minD = 420) { // 第 94 批：外面兩線最後那段（快要併進來）不生
    const ls = Object.values(ML);
    for (let k = 0; k < 14; k++) {
      const l = ls[Math.floor(rnd() * ls.length)], d = 20 + rnd() * (l.L - 160);
      const i = Math.min(l.m - 1, Math.max(0, Math.round((d / l.L) * (l.m - 1)))), dd = Math.hypot(l.X[i] - me.x, l.Z[i] - me.z);
      if (dd < minD || dd > 820) continue;
      if (cars.some((q) => q.line === l && Math.abs(q.d - d) < 40)) continue;
      const p = o.pick(++seed * 7919 + 13); if (!p) continue;
      if (l.k >= 2 && (l.ms[i] < 0 || l.ms[i] > L - DROP_GO)) continue;
      if ((p.fast > 0 ? l.k > 1 : l.k === 0) && rnd() < 0.8) continue; // 跑車、超跑大多走裡面兩線；普通的車大多不走最裡面那線
      const c = newCar(p); planMain(c, l, d); c.v = Math.min(c.top, c.vb * Math.sqrt(c.alat), c.ls * c.mul) * 0.9; c.needObj = true; cars.push(c); st.spawned++; return c; // 輕量車做好才開始動（不會開到近的地方才變出來）
    }
    return null;
  }
  // 休息站本來就停著的一台開走（倒車出來）：那一格空出來
  function depart(side) {
    const cand = [...lotOf.values()].filter((c) => !c.taken && !bays[c.j - 20000].res);
    if (!cand.length) return null;
    const lc = cand[Math.floor(rnd() * cand.length)], b = bays[lc.j - 20000], p = o.lotPick ? o.lotPick(lc) : null; if (!p) return null;
    lc.taken = true; o.onTake?.(lc); st.took++;
    const c = newCar(p); c.lot = lc; c.needObj = true; c.bay = b; b.res = c.id; c.side = side ?? (rnd() < 0.5 ? 1 : -1); c.rest = true; c.state = 'park'; c.t = 0.8 + rnd() * 1.5; c.x = b.x; c.z = b.z; c.y = yR; c.h = b.h; c.v = 0; c.line = null;
    cars.push(c); st.spawned++; return c;
  }
  // ---- 第 93 批：國道警察 ----
  const MED = V.median || { s0: 40, s1: L - 4 }, PX = P.X, PZ = P.Z, PTX = P.TX, PTZ = P.TZ;
  const VBm = new Float32Array(n); for (let i = 0; i < n; i++) { const a = Math.max(0, i - 3), b = Math.min(n - 1, i + 3); let da = Math.atan2(PTZ[b], PTX[b]) - Math.atan2(PTZ[a], PTX[a]); while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; const k = Math.abs(da) / Math.max(0.5, mS[b] - mS[a]); VBm[i] = k > 1e-4 ? Math.sqrt(1 / k) : 100; }
  const copSt = { patrol: 0, chase: 0, chasers: 0, seen: 0, caught: 0, hits: 0, gaveUp: 0, joined: 0 };
  let copT = 3, chaseT = 0, meS = NaN, meVs = 0;
  const copDims = () => (o.copDims ? o.copDims() : [4.35, 1.69, 1.41]);
  const newCop = () => { const c = newCar({ k: 'gc8', look: null, fast: 1, d: copDims() }); c.cop = true; c.lights = false; c.chase = false; c.hold = 0; c.hitCool = 0; c.noExit = true; c.top = 24 + rnd() * 2; c.mul = 1.05; return c; };
  function copPose(c, du) { // c.cs、c.cu → 位置、方向（往 c.cdir 開；du＝這一格往旁邊移多少）、坡度
    const f = Math.max(0, Math.min(n - 1.001, c.cs / 2)), i = Math.floor(f), t = f - i;
    const tx = PTX[i] + (PTX[i + 1] - PTX[i]) * t, tz = PTZ[i] + (PTZ[i + 1] - PTZ[i]) * t;
    c.x = PX[i] + (PX[i + 1] - PX[i]) * t - tz * c.cu; c.z = PZ[i] + (PZ[i + 1] - PZ[i]) * t + tx * c.cu; c.y = Yd[i] + (Yd[i + 1] - Yd[i]) * t + 0.02;
    const vs = Math.max(0.5, c.v) * c.cdir, vx = tx * vs - tz * du, vz = tz * vs + tx * du;
    c.h = Math.atan2(-vz, vx); c.pitch = Math.atan((Yd[i + 1] - Yd[i]) / 2) * c.cdir; c.vb = VBm[i];
  }
  function spawnPatrol(me) { // 巡邏的：跟一般的車一樣（420 公尺外、在線上）
    const ls = Object.values(ML);
    for (let k = 0; k < 14; k++) {
      const l = ls[Math.floor(rnd() * ls.length)], d = 60 + rnd() * (l.L - 260), i = Math.min(l.m - 1, Math.max(0, Math.round((d / l.L) * (l.m - 1))));
      if (!(l.ms[i] > MED.s0)) continue;
      const dd = Math.hypot(l.X[i] - me.x, l.Z[i] - me.z); if (dd < 420 || dd > 820) continue;
      if (cars.some((q) => q.line === l && Math.abs(q.d - d) < 40)) continue;
      const c = newCop(); planMain(c, l, d); c.v = Math.min(c.top, c.ls) * 0.9; c.needObj = true; cars.push(c); st.spawned++; copSt.patrol++; return c;
    }
    return null;
  }
  function chaseStart(c) { // 巡邏的那台 → 追你（在主線上、你那一邊）
    const l = c.line; if (!l || !l.ms || c.lk > 0) return false; const s = l.ms[c.hint]; if (!(s > MED.s0 && s < MED.s1)) return false;
    c.cs = s; c.cu = l.dir * LANE[l.k]; c.cdir = l.dir; c.line = null; c.route = []; c.state = 'cop'; c.chase = true; c.lights = true; c.hold = 0; c.laneT = 0; copSt.chase++; return true;
  }
  function spawnChaser(me, side, dm) { // 新的一台：你後面 300 公尺（你開的方向的後面；那邊沒路了就前面）
    for (const back of [300, 340, 380, -300, -340]) {
      const s = me.s - dm * back; if (s < MED.s0 + 10 || s > MED.s1 - 10) continue;
      const u = side * LANE[back > 0 ? 0 : 1];
      if (cars.some((q) => q.cop && q.chase && Math.abs(q.cs - s) < 25)) continue;
      const c = newCop(); c.state = 'cop'; c.chase = true; c.lights = true; c.cs = s; c.cu = u; c.cdir = back > 0 ? dm : -dm; c.v = Math.min(COP_TOP, Math.abs(meVs) + 6); c.hold = 0; c.laneT = 0; c.line = null;
      copPose(c, 0); c.needObj = true; cars.push(c); st.spawned++; copSt.chasers++; copSt.chase++; return c;
    }
    return null;
  }
  function copGiveUp(c) { // 不追了：方向對（往那一邊的車道的方向）就回到線上；不然停在路邊（看不到就收掉）
    c.chase = false; c.lights = false; c.hold = 0; copSt.gaveUp++;
    const side = c.cu >= 0 ? 1 : -1;
    if (c.cdir === side && c.cs > MED.s0 && c.cs < MED.s1 - 30) { const k = nearLane(c.cu), l = ML[`${side},${k}`]; c.state = 'drive'; planMain(c, l, dOfMs(l, c.cs)); c.v = Math.min(c.v, c.ls); copSt.joined++; return; }
    c.state = 'end'; c.v = 0;
  }
  const nearLane = (u) => { let b = 0; for (let k = 1; k < NL; k++) if (Math.abs(Math.abs(u) - LANE[k]) < Math.abs(Math.abs(u) - LANE[b])) b = k; return b; }; // 第 94 批：離 u 最近的那一線
  const U_MAX = V.path && V.path.road ? V.path.road + 0.3 : LANE[OUT] + 2.2; // 主線柏油的邊（第 94 批：以前寫死 7.6）
  const meOnMain = (me) => me.on && me.r === 0 && me.s > MED.s0 && me.s < MED.s1 && Math.abs(me.u) > 0.45 && Math.abs(me.u) < U_MAX;
  function copStep(c, dt, me) {
    c.hitCool -= dt;
    const want = o.wanted ? o.wanted() : 0, ds = me.s - c.cs, adist = Math.abs(ds);
    if (!want || !meOnMain(me) || (me.u >= 0) !== (c.cu >= 0) || adist > 1100) { copGiveUp(c); return; }
    const dirTo = ds >= 0 ? 1 : -1, side = c.cu >= 0 ? 1 : -1;
    if (dirTo !== c.cdir && c.v > 3) { c.v = Math.max(0, c.v - 10 * dt); } else c.cdir = dirTo; // 跑過頭：先煞車再掉頭
    const away = meVs * c.cdir, back = me.walk ? 5 : 7 + Math.max(0, away) * 0.3; // 你在跑（往前離開牠多快）、停在你後面幾公尺
    let vw = adist > 60 ? COP_TOP : Math.min(COP_TOP, Math.max(0, away + (adist - back) * 0.8));
    vw = Math.min(vw, c.vb * Math.sqrt(7));
    // 前面的車（同一邊、往前、左右 1.9 公尺內）；離你遠的時候挑前面比較空的那一線
    const fx = Math.cos(c.h), fz = -Math.sin(c.h); let gap = 1e9, gv = 0; const ahead2 = LANE.map(() => 1e9);
    for (const q of cars) {
      if (q === c || q.needObj || q.state === 'gone' || Math.abs(q.y - c.y) > 2.5) continue;
      const dx = q.x - c.x, dz = q.z - c.z; if (Math.abs(dx) > 90 || Math.abs(dz) > 90) continue;
      const ah = dx * fx + dz * fz; if (ah < 0.5 || ah > 90) continue;
      const lat = -dx * fz + dz * fx; // 右手邊＝＋
      const qu = c.cu + lat * c.cdir; for (let k = 0; k < NL; k++) if (Math.abs(qu - side * LANE[k]) < 1.9) ahead2[k] = Math.min(ahead2[k], ah);
      if (Math.abs(lat) < 1.9) { const g = ah - (c.len + q.len) / 2; if (g < gap) { gap = g; gv = Math.max(0, q.v * (Math.cos(q.h) * fx - Math.sin(q.h) * fz)); } }
    }
    let tu;
    if (adist < 30 && !me.walk) tu = me.u; // 近了：咬在你後面（同一線）
    else if (adist < 30) tu = side * Math.max(1.4, Math.min(LANE[OUT] + 0.15, Math.abs(me.u) + (Math.abs(me.u) < LANE[OUT] - 1 ? 3.35 : -3.35))); // 你在走路：停在你旁邊那一線
    else { if ((c.laneT -= dt) <= 0) { c.laneT = 0.6; const cur = c.lane ?? nearLane(c.cu); let b = cur; for (let k = Math.max(0, cur - 1); k <= Math.min(OUT, cur + 1); k++) if (ahead2[k] > ahead2[b] + 5) b = k; c.lane = b; if (ahead2.every((a) => a > 70)) c.lane = nearLane(me.u); /* 第 94 批：旁邊比較空的那一線（一次換一線） */ } tu = side * LANE[c.lane ?? 0]; }
    tu = side * Math.max(1.2, Math.min(LANE[OUT] + 0.3, Math.abs(tu))); // 不會壓到分隔島（中間 ±0.3）、外面的護欄
    if (gap < 1e8) vw = Math.min(vw, Math.max(0, gv + (gap - 4) * 0.5), Math.max(0, (gap - 3) / 1.4));
    const acc = vw > c.v ? Math.min(7, (vw - c.v) / dt) : Math.max(-10, (vw - c.v) / dt);
    c.v = Math.max(0, c.v + acc * dt);
    const du = Math.max(-2.4, Math.min(2.4, (tu - c.cu) / Math.max(dt, 0.4))) * Math.min(1, c.v / 4 + 0.2);
    c.cu += du * dt; c.cs += c.v * dt * c.cdir; c.cs = Math.max(MED.s0, Math.min(MED.s1, c.cs)); c.roll += c.v * dt;
    copPose(c, du);
    // 看得到你、抓到你
    const d3 = Math.hypot(me.x - c.x, me.z - c.z, me.y - c.y);
    if (d3 < COP_SEE && Math.abs(me.y - c.y) < 3) { copSt.seen++; o.copSeen?.(c); }
    const slow = me.walk || me.v < 2.5;
    if (slow && d3 < (me.walk ? 7 : 11)) { c.hold += dt; if (c.hold > 1.2) { c.hold = 0; if (o.caught?.(c)) copSt.caught++; } } else c.hold = Math.max(0, c.hold - dt);
  }
  // 每一格：你被通緝、在主線上 → 要幾台追（1★ 1 台，3★ 以上 2 台）；先叫巡邏的那台（同一邊、700 公尺內），不夠就生
  function copsThink(dt, me) {
    if (me.on && me.r === 0 && isFinite(meS)) { const v = (me.s - meS) / Math.max(dt, 1e-3); if (Math.abs(v) < 120) meVs += (v - meVs) * Math.min(1, dt * 6); } else meVs = 0;
    meS = me.on && me.r === 0 ? me.s : NaN;
    const want = o.wanted ? o.wanted() : 0;
    if (!want || !meOnMain(me)) return;
    if ((chaseT -= dt) > 0) return; chaseT = 0.5;
    const side = me.u >= 0 ? 1 : -1, need = want >= 3 ? 2 : 1;
    let have = 0; for (const c of cars) if (c.cop && c.chase) have++;
    if (have >= need) return;
    for (const c of cars) { if (!c.cop || c.chase || c.state !== 'drive' || c.needObj || !c.line || !c.line.ms || c.line.dir !== side) continue; const s = c.line.ms[c.hint]; if (Math.abs(s - me.s) < 700 && chaseStart(c)) return; }
    const dm = Math.abs(meVs) > 2 ? Math.sign(meVs) : side; spawnChaser(me, side, dm);
  }
  let spawnT = 0, departT = 6, tick = 0;
  const near = (me) => { // 玩家離主線（每 10 點看一點）、休息站多遠
    let m = 1e9; for (let i = 0; i < n; i += 10) { const d = Math.hypot(P.X[i] - me.x, P.Z[i] - me.z); if (d < m) m = d; }
    return [m, Math.hypot(restC[0] - me.x, restC[1] - me.z)];
  };
  let nearM = 1e9, nearR = 1e9;
  function update(dt, me) {
    gone.length = 0; dt = Math.min(dt, 0.1);
    if (!me.on) return;
    if ((tick -= dt) <= 0) { tick = 0.5; [nearM, nearR] = near(me);
      if (nearR > 760 && !cars.some((c) => c.rest)) for (const lc of lotOf.values()) if (lc.taken) { lc.taken = false; o.onGive?.(lc); st.gave++; } } // 休息站很遠：開走的那幾台放回去（看不到的時候），休息站不會越來越空
    st.active = nearM < 900 || nearR < 700;
    // 不在附近：全部不見
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i], dd = dist(c, me), far = c.rest ? nearR > 750 : dd > 900;
      if (!st.active || far || c.state === 'gone') { if (c.bay && c.bay.res === c.id) c.bay.res = 0; cars.splice(i, 1); gone.push(c); st.despawned++; }
    }
    if (!st.active) return;
    // 生車：主線上（含停車場的口、內湖那頭）最多 8 台；休息站每 15～35 秒一台倒車出來
    let nMain = cars.filter((c) => !c.rest).length; // 第 94 批：生了一台就 +1（同一格又生巡邏的警車，不會變 7 台）
    if ((spawnT -= dt) <= 0) { spawnT = 0.6; if (nMain < (o.max || 6) && spawnMain(me, st.spawned - (st.spawned0 || 0) < 3 && nearM < 900 ? 250 : 420)) nMain++; }
    if (nearR < 600 && (departT -= dt) <= 0) { departT = 15 + rnd() * 20; if (cars.filter((c) => c.rest).length < 6) depart(); }
    if (o.copDims && (copT -= dt) <= 0) { copT = 3; if (nearM < 900 && nMain < (o.max || 6) && !cars.some((c) => c.cop)) spawnPatrol(me); } // 第 93 批：主線上有 1 台國道警察巡邏
    copsThink(dt, me);
    let nChase = 0; for (const c of cars) if (c.cop && c.chase) nChase++;
    copSt.chasing = nChase;
    // 開：目標速度（自己最快、彎道、速限）→ 前面的車、玩家（同一層、在前面、左右 1.8 公尺內）→ 加速／煞車
    for (const c of cars) {
      if (c.state === 'park') { if (!c.needObj && (c.t -= dt) <= 0) { c.state = 'drive'; st.departed++; begin(c, leave(c.side, c.bay)); c.v = 0; } continue; }
      if (c.needObj) { if ((c.ht = (c.ht || 0) + dt) > 6) { c.state = 'gone'; st.lost++; } continue; } // 剛生出來：town 把輕量車放好以前停在原地（看不到、不擋）；做不出來就收掉
      if (c.cop && c.chase) { copStep(c, dt, me); continue; } // 第 93 批：國道警察在追你（自己照 s、u 開）
      if (c.state === 'end') { if (dist(c, me) > 170 || (o.seen && !o.seen(c))) c.state = 'gone'; c.v = 0; continue; } // 盡頭：你看得到就停著等，看不到就收掉
      const s = c.route[c.si], end = s.end ?? c.line.L, left = end - c.d;
      let want = c.rev ? c.line.LS[c.hint] : Math.min(c.top, c.vb * Math.sqrt(c.alat), c.ls * c.mul);
      const fin = c.stop || (c.si === c.route.length - 1 && !s.line.merge && !(s.exit && s.exit.rest) && !c.bay); // 要停在這段的盡頭
      if (fin) want = Math.min(want, Math.sqrt(Math.max(0, 2 * 2.5 * (left - 0.3))));
      const ch = c.line ? c.lh : c.h, fx = Math.cos(ch) * (c.rev ? -1 : 1), fz = -Math.sin(ch) * (c.rev ? -1 : 1), cX = c.line ? c.lx : c.x, cZ = c.line ? c.lz : c.z; // 往前走的方向（倒車＝車尾）
      if (nChase && !c.cop && c.line.ms && c.lk <= 0 && c.lcT <= 0) for (const q of cars) { if (!q.cop || !q.chase) continue; const dx = q.x - cX, dz = q.z - cZ, ah = dx * fx + dz * fz; if (ah < -2 && ah > -70 && Math.abs(-dx * fz + dz * fx) < 1.9 && Math.abs(q.y - c.y) < 2.5) { laneChange(c, me); break; } } // 後面有閃燈的警車：讓到旁邊那一線
      let gap = 1e9, gv = 0;
      for (const q of cars) { if (q === c) continue; const dx = (q.line ? q.lx : q.x) - cX, dz = (q.line ? q.lz : q.z) - cZ, dy = q.y - c.y; if (Math.abs(dy) > 2 || Math.abs(dx) > 70 || Math.abs(dz) > 70) continue;
        const ahead = dx * fx + dz * fz, side = Math.abs(dx * -fz + dz * fx); if (ahead > 0.5 && ahead < 70 && side < 1.9) { const g = ahead - (c.len + q.len) / 2; if (g < gap) { gap = g; gv = q.needObj ? 0 : q.state === 'drive' ? q.v : q.state === 'cop' ? Math.max(0, q.v * (Math.cos(q.h) * fx - Math.sin(q.h) * fz)) : 0; } } }
      { const dx = me.x - cX, dz = me.z - cZ, dy = me.y - c.y; if (Math.abs(dy) < 2.5) { const ahead = dx * fx + dz * fz, side = Math.abs(dx * -fz + dz * fx); if (ahead > 0 && ahead < 70 && side < 2.2) { const g = ahead - c.len / 2 - 2.3; if (g < gap) { gap = g; gv = 0; c.wait += dt; } } } }
      if (c.line.ms && c.line.k >= 2 && c.line.dir > 0 && c.lk <= 0 && (c.mgT = (c.mgT || 0) - dt) <= 0) { const s = c.line.ms[c.hint]; if (s > L - DROP_GO) { c.mgT = 0.8; if (laneChange(c, me, true)) gap = 1e9; } } // 第 94 批：快到終點（一邊只剩 2 線）：外面兩線的車換到裡面
      if (gap < 45 && gv < want - 3 && (c.lcT -= dt) <= 0 && laneChange(c, me)) { gap = 1e9; } // 前面比較慢（或停著的你）：換到旁邊那一線超過去
      if (gap < 1e8) want = Math.min(want, Math.max(0, gv + (gap - 4) * 0.5), Math.max(0, (gap - 3) / 1.4));
      const acc = want > c.v ? Math.min(2.6, (want - c.v) / dt) : Math.max(-7, (want - c.v) / dt);
      c.v = Math.max(0, c.v + acc * dt);
      c.d += c.v * dt; c.roll += c.v * dt * (c.rev ? -1 : 1);
      if (c.d >= end - 0.05 || (fin && left < 0.4 && c.v < 0.3)) { // 要停的：差一點點（煞車煞到 0）也算到了
        if (c.stop) { c.d = end; c.v = 0; }
        if (!next(c, me)) { if (dist(c, me) < 170 && (!o.seen || o.seen(c))) { c.state = 'end'; c.v = 0; st.waits++; } else c.state = 'gone'; c.d = Math.min(c.d, end); place(c); continue; }
        if (c.state !== 'drive') continue;
      }
      if (c.line) place(c);
      if (c.lk > 0) { // 換線：畫的位置從舊的那一線慢慢移過來、車頭往那邊偏一點
        c.lk = Math.max(0, c.lk - dt / LC_T); const k = c.lk * c.lk * (3 - 2 * c.lk); c.x += c.ox * k; c.z += c.oz * k;
        const dk = (6 * c.lk * (1 - c.lk)) / LC_T, fx = Math.cos(c.h) * c.v - c.ox * dk, fz = -Math.sin(c.h) * c.v - c.oz * dk; if (c.v > 0.5) c.h = Math.atan2(-fz, fx);
      }
    }
    // 撞到（drive.js 推了一下）：照推的方向改速度
    for (const b of colOut) { const c = b.car; if (!c || (!b.dvx && !b.dvz)) continue; if (c.cop && Math.hypot(b.dvx, b.dvz) > 1.2 && c.hitCool <= 0) { c.hitCool = 3; copSt.hits++; o.copHit?.(c); } if (c.cop && c.chase) { b.dvx = b.dvz = 0; continue; } if (c.state === 'drive') c.v = Math.min(36, Math.max(0, c.v + b.dvx * Math.cos(c.h) - b.dvz * Math.sin(c.h))); b.dvx = b.dvz = 0; }
  }
  const colPool = [], colOut = [];
  function colliders(x, z, r, y) {
    colOut.length = 0;
    for (const c of cars) {
      if (c.needObj || Math.abs(c.y - y) > 2.5 || Math.abs(c.x - x) > r + c.len || Math.abs(c.z - z) > r + c.len) continue;
      const b = colPool[colOut.length] || (colPool[colOut.length] = { t: 'box', x: 0, z: 0, hx: 2.2, hz: 0.9, rot: 0, h: 1.4, npc: true, vx: 0, vz: 0, m: 1, dvx: 0, dvz: 0, car: null, vdt: true });
      const sp = c.state === 'drive' ? c.v * (c.rev ? -1 : 1) : 0;
      b.x = c.x; b.z = c.z; b.hx = c.len / 2; b.hz = (c.wid * 0.92) / 2; b.rot = c.h; b.vx = Math.cos(c.h) * sp; b.vz = -Math.sin(c.h) * sp; b.m = 1; b.dvx = b.dvz = 0; b.car = c; colOut.push(b);
    }
    return colOut;
  }
  const info = () => ({ cops: { ...copSt, n: cars.filter((c) => c.cop).length, chasing: cars.filter((c) => c.cop && c.chase).length }, lines: [...lines.keys()], junc: [...junc.entries()].map(([k, a]) => [k, a.map((j) => [j.id, Math.round(j.d)])]), merges: Object.values(ramps).filter((r) => r.merge).map((r) => [r.id, r.merge.line.id, Math.round(r.merge.d)]), cars: cars.length, rest: cars.filter((c) => c.rest).length, nearM: Math.round(nearM), nearR: Math.round(nearR), ...st });
  const spawnAt = (id, d, k) => { const l = lines.get(id); if (!l) return null; const p = o.pick(++seed * 7919 + 13, k); if (!p) return null; const c = newCar(p); if (ML[`${l.dir},${l.k}`] === l) planMain(c, l, d); else { begin(c, [{ line: l, ...(l.ramp && l.ramp.exit ? { exit: { id: l.ramp.id, rest: !!l.ramp.rest } } : {}) }]); c.d = d; place(c); } c.needObj = true; cars.push(c); st.spawned++; return c; };
  function clear() { // 回家、換場景：全部收掉（town 收回 gone 的輕量車）、開走的那幾台放回去
    gone.length = 0; for (const c of cars) { if (c.bay && c.bay.res === c.id) c.bay.res = 0; gone.push(c); } cars.length = 0;
    for (const lc of lotOf.values()) if (lc.taken) { lc.taken = false; o.onGive?.(lc); st.gave++; }
    spawnT = 0; departT = 6; tick = 0; st.spawned0 = st.spawned; copT = 3; chaseT = 0; meS = NaN; meVs = 0;
  }
  return { cars, gone, update, colliders, info, depart, spawnAt, clear, lines, ramps, ML, bays, st, spawnPatrol, spawnChaser: (me, side, dm) => spawnChaser(me, side, dm), copSt };
}
return { createVdTraffic };
})();
