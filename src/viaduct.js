// ---- 第 91 批：圓環高架橋＋高架下面的超大停車場 ----
// Nick 2026-11-14「在原本的快速道路上搭建一個像這樣的圓環高架橋上高架也可以通到內湖最遠處有斜坡緩緩下高架 並且高架橋中間下面要有一個超大停車場有很多車車一樣從車店挑」
//   草稿 https://claude.ai/artifact/FAaQSJMuCUmvLgnfMcFRC2 ，Nick「好 做完直接上線」
// 座標跟 village.js 一樣：x 往東、y 往上、z 往南
// 路線（VD_PATH，每 2 公尺一點）：
//   圓環＝快速道路一圈裡面南邊那座山（hills.js 拿掉了）的地方：圓心 (−780, 250)、中線半徑 112（第 94 批；以前 105）；從北邊 (−780, 138) 地面往西出發，繞 1.5 圈（1056 公尺，坡度約 2.3%）到南邊 (−780, 362) 24 公尺高
//   → 往東跨過快速道路、內湖入口上面 → 沿著內湖北邊的山腳 (z 319；第 94 批以前 312) 往東 → 東北角轉往南 → 東邊的山腳 (x 1755) 往南、跨過捷運 → 慢慢下來（4%）→ 東南角轉往西 → 接到內湖最東南那條路的盡頭
//   一個方向四線（第 94 批；以前兩線）、中間分隔島、兩邊水泥護欄（1 公尺）、路燈（晚上亮，look.js 的 V.lampsX）、橋墩（30 公尺一支，不放在路上、房子上）；圓環兩圈疊在一起的地方：兩邊的柱子＋橫樑
//   離地不到 6 公尺的地方兩邊是實心的牆（引道）；高度照地面自己抬高（山腳、捷運上面至少留 6.5 公尺）
// 停車場：圓環中間（半徑 96.5 的柏油）：東西向 9 排、每排兩邊、中間一條南北向的走道；約 900 格、三分之二停了車（車店的車：便宜的多、超跑很少，跟內湖環山路一樣）
//   快速道路南邊彎道內圈的護欄開一個口（village.js VD_GAP），一條 10 公尺寬的路往北接到停車場；停車場北邊接圓環的起點（內側的護欄前 36 公尺沒有）
//   車：遠的是每一種車一個 InstancedMesh（第 92 批：farcars.js＝那台車自己的樣子，一台約 300 個三角形、照那台車的顏色），走近 26 公尺內的換成真的輕量車（town.src.js vdLotStep）
// 只有玩家開得上去（跟隧道、圓塔的斜坡一樣）：車流、警察、路人永遠在地上；town.src.js 每一格把玩家多高放在 VDV.st.py → at(x, z, py) 挑最接近的那一層
// 【API】
//   VD_PATH：{ X, Z, S, TX, TZ（Float32Array）, n, L, sH（圓環的終點）}；vdNear(x, z, pad)（離橋面的邊 pad 公尺以內：村子、內湖不放房子、樹）；vdInLot(x, z, pad)（停車場、連到快速道路的路）
//   vdEndDist(x, z)：離最後 420 公尺（下來那段）的中線多遠（80 公尺外 Infinity）：neihu.js 削平那裡的山
//   VD_LOT：{ x, z, r, spots: [[x, z, heading, n]…] }；VD_GAP：快速道路內圈的口（s、半寬）；VD_TEXT（牌子的字）
//   const VDV = buildViaduct(V, { renderer, lotCar(n) → { k, paint } | null, dims(k) → [長, 寬, 高] })   V＝buildVillage()（buildHills 之後）
//     VDV.st：{ py, px, pz, on, high }（town.src.js 每一格寫）；VDV.at(x, z, py) → 橋面高 | null；VDV.normal(x, z, py, out)；VDV.Q（上一次 at 的 s、u、坡度）
//     VDV.cols：只給玩家的碰撞（護欄、橋墩、柱子、停車場的車；off 自己看玩家在哪一層）；VDV.lot：{ cars, hide(j), show(j) }；VDV.info
import * as THREE from 'three';
import { restLayout, buildRestArea } from './vdrest.js'; // 第 92 批：休息站（大便龍服務區）
import { buildVdSigns } from './vdsign.js'; // 第 92 批：限速、前有大彎、門架、ETC

export const { VD_PATH, VD_LOT, VD_GAP, VD_TEXT, VD_REST, vdNear, vdInLot, vdEndDist, inRest, buildViaduct } = (() => {
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// 第 94 批（Nick 2026-11-15「高速公路兩邊各加寬成4道」）：一個方向 4 線（以前 2 線）：柏油半寬 7.4 → 14.3、護欄外 8 → 14.9；車道線（離中線）：黃線 0.55、白虛線 3.9／7.25／10.6、路邊白線 13.95
//   車道中心 2.2、5.55、8.9、12.25（vdtraffic.js LANE）；圓環半徑 105 → 112（停車場還是 96.5，裡面那一圈的護欄才不會壓到停車場）；北邊那段 z 312 → 319（休息站那邊的交流道照舊在 z 299）
const HW = 14.9, ROAD = 14.3, PLAT = 24, S_OPEN = 36, CLEAR = 6.5, DESC = 0.04, WALL = 6;
const FAR_CULL = 650, REST_CULL = 900; // 第 92 批：停車場、休息站遠的車，那一區的邊離鏡頭超過這麼遠就不畫
const C0 = { x: -780, z: 250 }, R = 112, TURNS = 1.5; // 第 94 批：105 → 112
const VD_GAP = { s: 1853.1, h: 7.5 }; // 快速道路 s（從路口往北算）：南邊半圓的中間（−780, 475），內圈的口
const CONN = { x: -780, hw: 5, z0: 330, z1: 466 }; // 快速道路內圈 → 停車場的路
const VD_TEXT = '超大停車場往內湖高架快速道路圓環';

// ---- 路線：細的折線 → 每 2 公尺一點 ----
function crPt(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t, f = (j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
  return [f(0), f(1)];
}
const VD_PATH = (() => {
  const F = [], nh = Math.ceil((TURNS * TAU * R) / 0.5);
  for (let i = 0; i <= nh; i++) { const th = -Math.PI / 2 - (i / nh) * TURNS * TAU; F.push([C0.x + R * Math.cos(th), C0.z + R * Math.sin(th)]); }
  const nH = F.length - 1;
  const cr = (Q) => { for (let i = 1; i < Q.length - 2; i++) for (let k = 1; k <= 60; k++) F.push(crPt(Q[i - 1], Q[i], Q[i + 1], Q[i + 2], k / 60)); };
  cr([[-860, 354], [-780, 362], [-700, 354], [-600, 345], [-420, 343], [-260, 348], [-150, 364], [-60, 364], [0, 350], [60, 328], [150, 319], [300, 319], [450, 319]]); // 圓環出來往東（頭尾多一點讓方向對）（第 94 批：圓環大一點、北邊那段 z 312 → 319）
  F.push([1690, 319]);
  for (let k = 1; k <= 40; k++) { const a = (-90 + (90 * k) / 40) * (Math.PI / 180); F.push([1690 + 65 * Math.cos(a), 384 + 65 * Math.sin(a)]); } // 東北角
  F.push([1755, 1640]);
  for (let k = 1; k <= 40; k++) { const a = ((90 * k) / 40) * (Math.PI / 180); F.push([1690 + 65 * Math.cos(a), 1640 + 65 * Math.sin(a)]); } // 東南角
  cr([[1730, 1705], [1690, 1705], [1645, 1705], [1612, 1702], [1593.4, 1688.8], [1572.7, 1667.1]]); // 接到內湖最東南那條路的盡頭（方向照那條路）
  const cum = [0]; for (let i = 1; i < F.length; i++) cum.push(cum[i - 1] + Math.hypot(F[i][0] - F[i - 1][0], F[i][1] - F[i - 1][1]));
  const L = cum[cum.length - 1], n = Math.floor(L / 2) + 1 + (L % 2 > 0.2 ? 1 : 0);
  const X = new Float32Array(n), Z = new Float32Array(n), S = new Float32Array(n), TX = new Float32Array(n), TZ = new Float32Array(n);
  let j = 1;
  for (let i = 0; i < n; i++) {
    const s = Math.min(L, i * 2); while (j < F.length - 1 && cum[j] < s) j++;
    const t = (s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1); X[i] = F[j - 1][0] + (F[j][0] - F[j - 1][0]) * t; Z[i] = F[j - 1][1] + (F[j][1] - F[j - 1][1]) * t; S[i] = s;
  }
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = X[b] - X[a], dz = Z[b] - Z[a], l = Math.hypot(dx, dz) || 1; TX[i] = dx / l; TZ[i] = dz / l; }
  return { X, Z, S, TX, TZ, n, L, sH: cum[nH] };
})();

// ---- 第 92 批：分岔的路（交流道）：一個方向一線（柏油半寬 3.9、護欄外 4.6）----
// Nick 2026-11-15「高速公路可以分岔到不同地方比如捷運站附近或市中心」
// 出口：從主線外側那一線（離中線 U0）慢慢往外（cos，T 公尺）到 U1，再照控制點（Catmull–Rom）開下去，接到內湖的路（T 字，從旁邊接上去）；入口反過來
// 台灣靠右開：往 +S 開的右手邊＝主線的 +u（n＝(−TZ, TX)）；往 −S 開的右手邊＝−u。出口、入口都在右手邊 → 交流道的左手邊（−u）永遠是主線
const RHW = 4.6, RROAD = 3.9, U0 = ROAD - RROAD, U1 = HW + 5, U_SEP = HW + RHW; // 第 94 批：主線變寬（以前 3.5、13、12.6） // U_SEP：兩邊的護欄分得開（中間的柏油接起來的那段到這裡為止）
function mainAt(s) { const P = VD_PATH, f = clamp(s / 2, 0, P.n - 1.0001), i = Math.floor(f), t = f - i; return { x: P.X[i] + (P.X[i + 1] - P.X[i]) * t, z: P.Z[i] + (P.Z[i + 1] - P.Z[i]) * t, tx: P.TX[i], tz: P.TZ[i], i, t }; }
const VD_RAMPS = [
  // A：往東開的出口（主線北邊那段 z 312）→ 往南彎下來，接到環山路二段（從北邊接上去）；往南走 737 巷到港墘、市中心
  { id: 'A', exit: true, s0: 2150, side: 1, dir: 1, T: 90, pts: [[520, 344], [580, 364], [630, 403], [662, 454], [680, 521], [688, 580]], end: [690, 614], endDir: [0, 1], to: ['環山路', '港墘站'] },
  // B：往南開的出口（東邊那段 x 1755）→ 西邊並排往南下來，接到內湖路二段（從北邊接上去）
  { id: 'B', exit: true, s0: 3578, side: 1, dir: 1, T: 90, pts: [], end: [1735, 873], endDir: [0, 1], to: ['內湖路二段', '市中心'] }, // 第 94 批：x 1742 → 1735（主線變寬）
];
// ---- 第 92 批：休息站（大便龍服務區）：主線北邊的山脊上鋪一塊平台（跟主線一樣高 24 公尺；neihu.js 的山照 VD_REST 削平／填平）----
// Nick 2026-11-15「在高速公路中段做一個休息站 請上網查南休的停車場樣式並照做 要有便利商店廁所…要有出口入口 要有人車…有那三隻動物跟人」
// 兩個方向共用（像南投服務區）：往西開的從右手邊直接進出（WX 出、WE 進）；往東開的從右手邊出去、爬高繞過主線上面進來（EX），出去也從上面繞回南邊（EE）
const VD_REST = { x0: 760, x1: 1240, z0: 165, z1: 302, y: 24, blend: 45, pave: [770, 168, 1230, 297] }; // 平的（山的格子在邊上多一條線）、鋪柏油的範圍
const inRest = (x, z, pad = 0) => x > VD_REST.pave[0] - pad && x < VD_REST.pave[2] + pad && z > VD_REST.pave[1] - pad && z < VD_REST.pave[3] + pad;
const RL = restLayout(VD_REST); // 休息站裡面的路、停車格、房子（vdrest.js）
VD_RAMPS.push(
  { id: 'WX', exit: true, s0: 3110, side: -1, dir: -1, T: 80, pts: [[1232, 294]], end: [1214, 287], endDir: [-1, 0], to: ['大便龍服務區'], rest: true },
  { id: 'WE', exit: false, start: [800, 286], startDir: [-1, 0], pts: [[778, 291]], s0: 2460, side: -1, dir: -1, T: 80, rest: true },
  { id: 'EX', exit: true, s0: 2330, side: 1, dir: 1, T: 80, pts: [[690, 340], [745, 340], [770, 332], [783, 300], [786, 270], [786, 230], [790, 205], [806, 189]], end: [830, 186], endDir: [1, 0], keys: [[781, 319, null]], to: ['大便龍服務區'], rest: true },
  { id: 'EE', exit: false, start: [1196, 186], startDir: [1, 0], pts: [[1222, 192], [1238, 212], [1241, 250], [1241, 300], [1242, 349], [1252, 376], [1278, 392], [1312, 386], [1340, 364]], s0: 3220, side: 1, dir: 1, T: 80, keys: [[1241, 319, null]], rest: true },
);
function rampPath(D) {
  const F = [], A = []; // A：這一點在不在主線旁邊（主線的 s），不在＝−1
  const tap = (ds) => { for (const d of ds) { const ms = D.exit ? D.s0 + D.dir * d : D.s0 - D.dir * d, m = mainAt(ms), u = D.side * (U0 + ((U1 - U0) * (1 - Math.cos((Math.PI * d) / D.T))) / 2); F.push([m.x - m.tz * u, m.z + m.tx * u]); A.push(ms); } };
  const cr = (Q) => { for (let i = 1; i < Q.length - 2; i++) for (let k = 1; k <= 40; k++) { F.push(crPt(Q[i - 1], Q[i], Q[i + 1], Q[i + 2], k / 40)); A.push(-1); } };
  const NT = Math.ceil(D.T / 1.5), ds = []; for (let k = 0; k <= NT; k++) ds.push((D.T * k) / NT);
  if (D.exit) {
    tap(ds); const a = F[F.length - 2], b = F[F.length - 1], e = D.end, ed = D.endDir;
    cr([a, b, ...D.pts, e, [e[0] + ed[0] * 20, e[1] + ed[1] * 20]]);
  } else {
    const s0 = D.start, sd = D.startDir, T = []; tap(ds.slice().reverse()); const tp = F.splice(0), ta = A.splice(0); void T;
    F.push(s0); A.push(-1); cr([[s0[0] - sd[0] * 20, s0[1] - sd[1] * 20], s0, ...D.pts, tp[0], tp[1]]); F.pop(); A.pop(); for (let k = 0; k < tp.length; k++) { F.push(tp[k]); A.push(ta[k]); }
  }
  const cum = [0]; for (let i = 1; i < F.length; i++) cum.push(cum[i - 1] + Math.hypot(F[i][0] - F[i - 1][0], F[i][1] - F[i - 1][1]));
  const L = cum[cum.length - 1], n = Math.ceil(L / 2) + 1;
  const X = new Float32Array(n), Z = new Float32Array(n), S = new Float32Array(n), TX = new Float32Array(n), TZ = new Float32Array(n), MS = new Float32Array(n), UC = new Float32Array(n);
  let j = 1;
  for (let i = 0; i < n; i++) {
    const s = Math.min(L, (i * L) / (n - 1)); while (j < F.length - 1 && cum[j] < s) j++;
    const t = (s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1); X[i] = F[j - 1][0] + (F[j][0] - F[j - 1][0]) * t; Z[i] = F[j - 1][1] + (F[j][1] - F[j - 1][1]) * t; S[i] = s;
    MS[i] = A[j - 1] >= 0 && A[j] >= 0 ? A[j - 1] + (A[j] - A[j - 1]) * t : -1;
  }
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = X[b] - X[a], dz = Z[b] - Z[a], l = Math.hypot(dx, dz) || 1; TX[i] = dx / l; TZ[i] = dz / l; }
  for (let i = 0; i < n; i++) { UC[i] = -1; if (MS[i] < 0) continue; const m = mainAt(MS[i]); UC[i] = Math.abs((X[i] - m.x) * -m.tz + (Z[i] - m.z) * m.tx); } // 離主線中線多遠（主線那一邊）
  return { X, Z, S, TX, TZ, n, L, MS, UC, def: D, hw: RHW, road: RROAD };
}
VD_PATH.hw = HW; VD_PATH.road = ROAD; VD_PATH.def = { id: 'main' };
const ROADS = [VD_PATH, ...VD_RAMPS.map(rampPath)];
// 全部的路接成一串（GX、GZ、GR＝第幾條路、GI＝那條路的第幾點）；GRID：16 公尺一格（每一段多 hw＋14 的邊）
const GN = ROADS.reduce((t, r) => t + r.n, 0);
const GX = new Float32Array(GN), GZ = new Float32Array(GN), GR = new Uint8Array(GN), GI = new Uint16Array(GN);
{ let o = 0; ROADS.forEach((r, k) => { r.id = k; r.o = o; for (let i = 0; i < r.n; i++) { GX[o + i] = r.X[i]; GZ[o + i] = r.Z[i]; GR[o + i] = k; GI[o + i] = i; } o += r.n; }); }
const CELL = 16, gkey = (i, j) => i * 65536 + j;
const GRID = (() => {
  const m = new Map();
  for (let i = 0; i < GN - 1; i++) {
    if (GR[i] !== GR[i + 1]) continue; const MARG = ROADS[GR[i]].hw + 14;
    const x0 = Math.min(GX[i], GX[i + 1]) - MARG, x1 = Math.max(GX[i], GX[i + 1]) + MARG, z0 = Math.min(GZ[i], GZ[i + 1]) - MARG, z1 = Math.max(GZ[i], GZ[i + 1]) + MARG;
    for (let a = Math.floor(x0 / CELL); a <= Math.floor(x1 / CELL); a++) for (let b = Math.floor(z0 / CELL); b <= Math.floor(z1 / CELL); b++) { const k = gkey(a, b); let L = m.get(k); if (!L) m.set(k, (L = [])); L.push(i); }
  }
  const out = new Map(); for (const [k, L] of m) out.set(k, Int32Array.from(L));
  return out;
})();
const SQ = { t: 0, d2: 0 };
function segQ(i, x, z) { // 第 i 段（全部的路接成一串的號碼；主線＝本來的號碼）：投影 t（0–1）、距離平方
  const ax = GX[i], az = GZ[i], dx = GX[i + 1] - ax, dz = GZ[i + 1] - az, l2 = dx * dx + dz * dz || 1;
  let t = ((x - ax) * dx + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + dx * t - x, pz = az + dz * t - z; SQ.t = t; SQ.d2 = px * px + pz * pz;
}
function vdEdge(x, z) { // 離最近的橋面邊幾公尺（負的＝在橋面上；遠的＝Infinity）
  const L = GRID.get(gkey(Math.floor(x / CELL), Math.floor(z / CELL))); if (!L) return Infinity;
  let b = Infinity; for (let k = 0; k < L.length; k++) { segQ(L[k], x, z); const e = Math.sqrt(SQ.d2) - ROADS[GR[L[k]]].hw; if (e < b) b = e; }
  return b;
}
const vdNear = (x, z, pad = 0) => vdEdge(x, z) < pad;
// 最後 END_S 公尺（從東南角往西下來那段）離中線多遠（範圍外 = Infinity）：neihu.js 把那裡的山（範圍南邊外面那圈）削平，橋才下得到巷子的高度
const END_S = 420, END_R = 80;
const END = (() => { const { X, Z, S, n, L } = VD_PATH; let i0 = 0; while (i0 < n - 1 && S[i0] < L - END_S) i0++; const bb = [Infinity, Infinity, -Infinity, -Infinity]; for (let i = i0; i < n; i++) { bb[0] = Math.min(bb[0], X[i] - END_R); bb[1] = Math.min(bb[1], Z[i] - END_R); bb[2] = Math.max(bb[2], X[i] + END_R); bb[3] = Math.max(bb[3], Z[i] + END_R); } return { i0, bb }; })();
function vdEndDist(x, z) {
  const b = END.bb; if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) return Infinity;
  let m = Infinity; for (let i = END.i0; i < VD_PATH.n - 1; i++) { segQ(i, x, z); if (SQ.d2 < m) m = SQ.d2; }
  return Math.sqrt(m);
}

// ---- 停車場的格子（東西向的排：每排兩邊車頭對著車頭；中間南北向的走道 7.2 公尺）----
const VD_LOT = (() => {
  const spots = [], CX = C0.x, CZ = C0.z, RS = 89, W = 2.6, D = 5, AIS = 3.6;
  for (let k = -4; k <= 4; k++) {
    const zc = CZ + 17 * k;
    for (const side of [-1, 1]) { // −1：北邊那半（車頭朝南）、1：南邊那半（車頭朝北）
      const z0 = side < 0 ? zc - D : zc, z1 = side < 0 ? zc : zc + D, dz = Math.max(Math.abs(z0 - CZ), Math.abs(z1 - CZ));
      if (dz >= RS) continue;
      const hw = Math.sqrt(RS * RS - dz * dz);
      for (const dir of [-1, 1]) for (let j = 0; ; j++) {
        const xa = CX + dir * (AIS + W * j), xb = xa + dir * W; if (Math.abs(xb - CX) > hw) break;
        spots.push([(xa + xb) / 2, (z0 + z1) / 2, side < 0 ? -Math.PI / 2 : Math.PI / 2, spots.length]);
      }
    }
  }
  return { x: CX, z: CZ, r: 96.5, rs: RS, w: W, d: D, ais: AIS, spots, conn: CONN };
})();
function vdInLot(x, z, pad = 0) {
  const dx = x - C0.x, dz = z - C0.z;
  if (dx * dx + dz * dz < (VD_LOT.r + pad) ** 2) return true;
  return Math.abs(x - CONN.x) < CONN.hw + pad && z > CONN.z0 - pad && z < CONN.z1 + pad;
}

// ---- 蓋：V＝buildVillage（buildHills 之後）----
function buildViaduct(V, opts = {}) {
  const T0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const { X, Z, S, TX, TZ, n, L, sH } = VD_PATH;
  const HL = V.hills, h0 = V.heightAt || (() => 0);
  const st = { py: 0, px: 1e9, pz: 1e9, on: false, high: false };
  // 1) 地面（中線、左右 ±HW 最高、最低）：隧道那段算山頂；捷運的橋算地面（上面至少 6.5 公尺）
  const groundAt = (x, z) => { let g = h0(x, z); if (HL && HL.tunAt && HL.tunAt(x, z) >= 0 && HL.topAt) g = Math.max(g, HL.topAt(x, z)); return g; };
  const MRTE = (V.neihu && V.neihu.data && V.neihu.data.elev) || [];
  const mrtTop = (x, z) => { let m = -1e9; for (const E of MRTE) { const P = E.P; for (let i = 1; i < P.length; i++) { const ax = P[i - 1][0], az = P[i - 1][1], dx = P[i][0] - ax, dz = P[i][1] - az, l2 = dx * dx + dz * dz || 1, t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), qx = ax + dx * t - x, qz = az + dz * t - z; if (qx * qx + qz * qz < (E.w / 2 + 3) ** 2) m = Math.max(m, E.y + 4.5); } } return m; };
  for (const r of ROADS) { // 每一條路：中線、左右 ±hw 的地面
    r.Gc = new Float32Array(r.n); r.Gmax = new Float32Array(r.n); r.Gmin = new Float32Array(r.n);
    for (let i = 0; i < r.n; i++) {
      const nx = -r.TZ[i], nz = r.TX[i], w = r.hw; let mx = -1e9, mn = 1e9;
      for (const u of [-w, -w / 2, 0, w / 2, w]) { const g = groundAt(r.X[i] + nx * u, r.Z[i] + nz * u); if (g > mx) mx = g; if (g < mn) mn = g; if (u === 0) r.Gc[i] = g; }
      r.Gmax[i] = Math.max(mx, mrtTop(r.X[i], r.Z[i])); r.Gmin[i] = mn;
    }
  }
  const Gc = VD_PATH.Gc, Gmax = VD_PATH.Gmax, Gmin = VD_PATH.Gmin;
  // 2) 高度：起點（停車場地面）→ 圓環爬到 24 → 平的（地面高的地方抬高）→ 最後 4% 下來到路的盡頭
  const g0 = Gc[0], gE = Gc[n - 1], sD = L - (PLAT - gE) / DESC;
  const Y = new Float32Array(n), lo = new Float32Array(n);
  const restSide = (i) => X[i] > VD_REST.x0 - 50 && X[i] < VD_REST.x1 + 50 && Z[i] < VD_REST.z1 + 30; // 第 92 批：休息站旁邊那段貼著平台（像路堤），不用離地 6.5
  for (let i = 0; i < n; i++) {
    const s = S[i];
    Y[i] = s <= S_OPEN ? g0 : s < sH ? g0 + ((PLAT - g0) * (s - S_OPEN)) / (sH - S_OPEN) : s < sD ? PLAT : PLAT + ((gE - PLAT) * (s - sD)) / (L - sD);
    lo[i] = s >= sH - 4 && s <= sD + 4 && !restSide(i) ? Gmax[i] + CLEAR : Gmax[i] + 0.05; // 平的那段：底下至少 6.5 公尺（第 92 批：休息站旁邊那段貼著平台、一樣高）
    if (Y[i] < lo[i]) Y[i] = lo[i];
  }
  for (let i = 1; i < n; i++) Y[i] = Math.max(Y[i], Y[i - 1] - DESC * 2); // 抬高的地方前後最陡 4%（往前、往後各掃一次）
  for (let i = n - 2; i >= 0; i--) Y[i] = Math.max(Y[i], Y[i + 1] - DESC * 2);
  { const W2 = 10, A = Float32Array.from(Y); // 轉角磨圓（20 公尺的平均，兩次）；頭尾不動
    for (let pass = 0; pass < 2; pass++) { const B = Float32Array.from(pass ? Y : A); for (let i = 0; i < n; i++) { if (S[i] < S_OPEN + 20 || S[i] > L - 20) continue; let t = 0, c = 0; for (let k = -W2; k <= W2; k++) { const j = i + k; if (j < 0 || j >= n) continue; t += B[j]; c++; } Y[i] = Math.max(t / c, lo[i]); } } } // 磨圓也不能比最低的還低（橋下至少 6.5 公尺）
  for (let i = 1; i < n; i++) Y[i] = Math.max(Y[i], Y[i - 1] - DESC * 2); // 磨圓以後再掃一次：最陡 4%（上面那行拉回最低的地方會有一小段比較陡）
  for (let i = n - 2; i >= 0; i--) Y[i] = Math.max(Y[i], Y[i + 1] - DESC * 2);
  for (let i = 0; i < n; i++) if (S[i] <= S_OPEN) Y[i] = g0 + 0.04; // 起點平的（停車場那一層，高 4 公分）
  Y[n - 1] = Math.max(Y[n - 1], gE + 0.04);
  const clearAt = (i) => Y[i] - Gmax[i];
  VD_PATH.Y = Y;
  // 2b) 交流道的高度：主線旁邊那段＝主線的高度；其他的點照「定點」（主線旁邊的頭尾、地面的那一頭、def.keys 的 [x, z, y]）之間直直的連起來 → 不比地面低 → 磨圓（主線旁邊不動）
  const mainY = (ms) => { const f = clamp(ms / 2, 0, n - 1.0001), i = Math.floor(f), t = f - i; return Y[i] + (Y[i + 1] - Y[i]) * t; };
  for (const r of ROADS) {
    if (r === VD_PATH) continue;
    const m = r.n, Yr = new Float32Array(m), fix = new Uint8Array(m), D = r.def;
    for (let i = 0; i < m; i++) if (r.MS[i] >= 0) { Yr[i] = mainY(r.MS[i]); fix[i] = 1; }
    if (r.MS[0] < 0) { Yr[0] = r.Gc[0] + 0.04; fix[0] = 2; }
    if (r.MS[m - 1] < 0) { Yr[m - 1] = r.Gc[m - 1] + 0.04; fix[m - 1] = 2; }
    for (const [kx, kz, ky] of D.keys || []) { let b = 0, bd = 1e18; for (let i = 0; i < m; i++) { const d = (r.X[i] - kx) ** 2 + (r.Z[i] - kz) ** 2; if (d < bd) { bd = d; b = i; } } if (fix[b]) continue; let y = ky; if (y == null) { let mb = 0, md = 1e18; for (let i = 0; i < n; i++) { const d = (X[i] - kx) ** 2 + (Z[i] - kz) ** 2; if (d < md) { md = d; mb = i; } } y = Y[mb] + 7.6; } Yr[b] = y; fix[b] = 3; } // y null＝從主線上面跨過去（主線＋7.6）
    // 兩個定點中間：坡度從旁邊的坡度慢慢變到 g（前後各 D 公尺的豎曲線），中間直直的（不會一下子折下去，車子不會飛起來）
    const slopeAt = (i, d) => (i + d >= 0 && i + d < m && fix[i + d] ? (Yr[i] - Yr[i + d]) / (r.S[i] - r.S[i + d]) : 0);
    let a = -1;
    for (let b = 0; b < m; b++) {
      if (!fix[b]) continue;
      if (a >= 0 && b - a > 1) {
        const span = r.S[b] - r.S[a], D = Math.min(40, span / 3), ga = slopeAt(a, -1), gb = slopeAt(b, 1), dY = Yr[b] - Yr[a], g = (dY - ((ga + gb) * D) / 2) / (span - D);
        for (let k = a + 1; k < b; k++) {
          const x = r.S[k] - r.S[a]; let y;
          if (x < D) y = ga * x + ((g - ga) * x * x) / (2 * D);
          else if (x < span - D) y = ((ga + g) * D) / 2 + g * (x - D);
          else { const q = x - (span - D); y = ((ga + g) * D) / 2 + g * (span - 2 * D) + g * q + ((gb - g) * q * q) / (2 * D); }
          Yr[k] = Yr[a] + y;
        }
      }
      a = b;
    }
    for (let i = 0; i < m; i++) if (fix[i] !== 1 && Yr[i] < r.Gmax[i] + 0.04) Yr[i] = r.Gmax[i] + 0.04; // 不鑽到地下
    r.Y = Yr; let g = 0; for (let i = 1; i < m; i++) g = Math.max(g, Math.abs(Yr[i] - Yr[i - 1]) / (r.S[i] - r.S[i - 1] || 1)); r.maxGrade = g;
  }
  const GY = new Float32Array(GN); for (const r of ROADS) GY.set(r.Y, r.o);
  const att = (r, i) => r !== VD_PATH && r.MS[i] >= 0; // 交流道接在主線旁邊的那段
  // 另一條路的柏油上面（高度差 1.5 公尺內）？：主線、交流道接起來的那段不放護欄、路燈
  const inOther = (r, x, z, y, pad = 0.2) => {
    const Lc = GRID.get(gkey(Math.floor(x / CELL), Math.floor(z / CELL))); if (!Lc) return false;
    for (let k = 0; k < Lc.length; k++) { const g = Lc[k], q = ROADS[GR[g]]; if (q === r) continue; segQ(g, x, z); if (SQ.d2 > (q.road + pad) ** 2) continue; const yy = GY[g] + (GY[g + 1] - GY[g]) * SQ.t; if (Math.abs(yy - y) < 1.5) return true; }
    return false;
  };

  // 3) 網格：橋面（柏油貼圖、role 'road'）、水泥（頂點色）；400 公尺一塊
  const group = new THREE.Group(); group.name = 'viaduct';
  const tex = deckTex(opts.renderer);
  const roadMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.93, metalness: 0 }); roadMat.userData.role = 'road'; roadMat.name = 'vd-road';
  const concMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }); concMat.name = 'vd-conc';
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.fillStyle = '#fff6dc'; g.fillRect(0, 0, 8, 8); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: glowTex, emissiveMap: glowTex, emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.4 }); glowMat.name = 'vd-lamp'; // look.js：晚上加亮（招牌那一套）
  const COL = { bar: [0.74, 0.73, 0.70], barTop: [0.80, 0.79, 0.76], side: [0.66, 0.65, 0.62], under: [0.42, 0.41, 0.40], pier: [0.62, 0.61, 0.58], cap: [0.68, 0.67, 0.64], wall: [0.6, 0.58, 0.54], pole: [0.55, 0.57, 0.6], lot: [0.16, 0.165, 0.17], line: [0.85, 0.85, 0.82], yel: [0.85, 0.66, 0.12], green: [0.08, 0.36, 0.2] };
  const nrmAt = (i) => [-TZ[i], TX[i]];
  const P3 = (i, u, y) => [X[i] - TZ[i] * u, y, Z[i] + TX[i] * u];
  const STEP = 2, CH = 200; // 網格每 4 公尺一段（點每 2 公尺）；一塊 200 點＝400 公尺
  const chunks = [];
  let tris = 0;
  const rb = qb(true), cb = qb(false);
  // 第 93 批（Nick 2026-11-15「高速公路做成雙向來回的中間用分隔島隔開」）：主線中間的分隔島＝紐澤西護欄（下寬上窄的水泥，0.82 公尺）＋上面綠色的防眩板（每 1 公尺一片、斜斜的）
  //   起點那段（停車場上來的開口、可以迴轉）和最後 4 公尺沒有；車道：中線往外 0.55 黃線、3.9／7.25／10.6 白虛線、13.95 白線（vdtraffic.js LANE 2.2、5.55、8.9、12.25；第 94 批一邊 4 線）
  const MED = { s0: S_OPEN + 4, s1: L - 4, hw: 0.3, h: 0.82, slat: 1.0 };
  const medOn = (i) => S[i] >= MED.s0 - 1e-6 && S[i] <= MED.s1 + 1e-6;
  const MPR = [[0.3, 0], [0.26, 0.08], [0.11, 0.33], [0.09, MED.h]];
  const medSeg = (i0, i1) => { // 一段（4 公尺）的分隔島：兩邊的斜面、頂、防眩板
    const ya = Y[i0], yb = Y[i1];
    for (const sd of [-1, 1]) { const hint = [-TZ[i0] * sd, 0.3, TX[i0] * sd]; for (let k = 0; k < 3; k++) cb.quad(P3(i0, sd * MPR[k][0], ya + MPR[k][1]), P3(i1, sd * MPR[k][0], yb + MPR[k][1]), P3(i1, sd * MPR[k + 1][0], yb + MPR[k + 1][1]), P3(i0, sd * MPR[k + 1][0], ya + MPR[k + 1][1]), k === 2 ? COL.barTop : COL.bar, null, hint); }
    cb.quad(P3(i0, -0.09, ya + MED.h), P3(i1, -0.09, yb + MED.h), P3(i1, 0.09, yb + MED.h), P3(i0, 0.09, ya + MED.h), COL.barTop, null, [0, 1, 0]);
    const s0 = S[i0], s1 = S[i1];
    for (let sv = Math.ceil(s0 / MED.slat - 1e-6) * MED.slat + 0.5 * MED.slat; sv < s1 - 1e-6; sv += MED.slat) {
      if (sv < MED.s0 + 0.5 || sv > MED.s1 - 0.5) continue;
      const t = (sv - s0) / (s1 - s0 || 1), x = X[i0] + (X[i1] - X[i0]) * t, z = Z[i0] + (Z[i1] - Z[i0]) * t, y = ya + (yb - ya) * t + MED.h, tx = TX[i0], tz = TZ[i0];
      const dx = tx * 0.82 - tz * 0.57, dz = tz * 0.82 + tx * 0.57, w = 0.11; // 板子跟路斜 35 度（擋對面的車燈）
      const a0 = [x - dx * w, y - 0.02, z - dz * w], a1 = [x + dx * w, y - 0.02, z + dz * w], b1 = [x + dx * w, y + 0.62, z + dz * w], b0 = [x - dx * w, y + 0.62, z - dz * w], nx = -dz, nz = dx;
      cb.quad(a0, a1, b1, b0, COL.green, null, [nx, 0, nz]); cb.quad(a0, a1, b1, b0, COL.green, null, [-nx, 0, -nz]);
    }
  };
  const medCap = (i, dir) => { const y = Y[i], f = [TX[i] * dir, 0, TZ[i] * dir]; cb.quad(P3(i, -0.3, y), P3(i, 0.3, y), P3(i, 0.09, y + MED.h), P3(i, -0.09, y + MED.h), COL.yel, null, f); };
  const flushChunk = () => {
    for (const [b, m, nm] of [[rb, roadMat, 'vd-road'], [cb, concMat, 'vd-conc']]) { if (!b.n) continue; const me = new THREE.Mesh(b.geo(), m); me.name = nm; me.matrixAutoUpdate = false; me.updateMatrix(); me.receiveShadow = true; me.castShadow = nm === 'vd-conc'; group.add(me); tris += b.nt; chunks.push(me); b.reset(); }
  };
  const elev = (i) => clearAt(i) >= WALL; // 下面是空的（不是引道的牆）
  const rampMat = new THREE.MeshStandardMaterial({ map: rampTex(opts.renderer), roughness: 0.93, metalness: 0 }); rampMat.userData.role = 'road'; rampMat.name = 'vd-ramp';
  const ramB = qb(true);
  // 護欄要不要畫（第 i 點、sd 那一邊）：主線起點內側的開口不畫；在別條路的柏油上面（交流道接起來那段）不畫
  const barOn = (r, i, sd) => {
    if (r === VD_PATH && sd < 0 && S[i] < S_OPEN - 0.1 && i < n / 2) return false;
    const u = sd * (r.road + 0.3); return !inOther(r, r.X[i] - r.TZ[i] * u, r.Z[i] + r.TX[i] * u, r.Y[i]);
  };
  // 交流道：離得近的幾條（內湖那兩條、休息站那四條）放在同一塊網格（一條一塊的話從內湖看過去多好幾個 draw call）
  const rampEnd = (k) => { const r = ROADS[k], q = ROADS[k + 1]; return !q || Math.hypot(q.X[0] - r.X[0], q.Z[0] - r.Z[0]) > 700; };
  for (let rk = 0; rk < ROADS.length; rk++) {
    const r = ROADS[rk];
    const RX = r.X, RZ = r.Z, RS = r.S, RTX = r.TX, RTZ = r.TZ, RY = r.Y, m = r.n, RD = r.road, W = r.hw, main = r === VD_PATH;
    const Pr = (i, u, y) => [RX[i] - RTZ[i] * u, y, RZ[i] + RTX[i] * u];
    const el = (i) => RY[i] - r.Gmax[i] >= WALL;
    const inner = (i) => (att(r, i) && r.UC[i] < U_SEP ? Math.min(RD, ROAD - r.UC[i]) : -RD); // 交流道的柏油從主線的柏油邊開始（主線旁邊那段）
    const innerU = (i) => (att(r, i) && r.UC[i] < U_SEP ? Math.min(W, HW - r.UC[i]) : -W);
    const pr = [[RD, 0], [RD + 0.1, 0.1], [RD + 0.32, 0.36], [RD + 0.38, 1.0]];
    const on = { '-1': null, '1': null }; // 上一段護欄有沒有（頭尾封起來）
    const cap = (i, sd, dir) => { const y = RY[i], t = [RTX[i] * dir, 0, RTZ[i] * dir]; cb.quad(Pr(i, sd * RD, y), Pr(i, sd * W, y), Pr(i, sd * W, y + 1), Pr(i, sd * (RD + 0.38), y + 1), COL.barTop, null, t); };
    for (let i0 = 0; i0 < m - 1; i0 += STEP) {
      const i1 = Math.min(m - 1, i0 + STEP);
      const v0 = RS[i0] / 12, v1 = RS[i1] / 12, ya = RY[i0], yb = RY[i1];
      // 路面
      if (main) { const ua = (W - RD) / (2 * W), ub = (W + RD) / (2 * W); rb.quad(Pr(i0, -RD, ya), Pr(i0, RD, ya), Pr(i1, RD, yb), Pr(i1, -RD, yb), null, [[ua, v0], [ub, v0], [ub, v1], [ua, v1]], [0, 1, 0]); }
      else { const e0 = inner(i0), e1 = inner(i1); if (e0 < RD - 0.01 || e1 < RD - 0.01) { const U = (u) => (u + W) / (2 * W); ramB.quad(Pr(i0, e0, ya), Pr(i0, RD, ya), Pr(i1, RD, yb), Pr(i1, e1, yb), null, [[U(e0), v0], [U(RD), v0], [U(RD), v1], [U(e1), v1]], [0, 1, 0]); } }
      // 護欄：內面（下面斜一點、上面陡）、頂、外面一直到橋面下面（引道：到地面）
      for (const sd of [-1, 1]) {
        const b = barOn(r, i0, sd) && barOn(r, i1, sd);
        if (on[sd] !== null && on[sd] !== b) cap(i0, sd, b ? -1 : 1); // 護欄開始、結束：頭封起來
        if (on[sd] === null && b && !main) cap(i0, sd, -1);
        on[sd] = b; if (!b) continue;
        const hint = [RTZ[i0] * sd, 0, -RTX[i0] * sd], out = [-RTZ[i0] * sd, 0, RTX[i0] * sd];
        for (let k = 0; k < 3; k++) cb.quad(Pr(i0, sd * pr[k][0], ya + pr[k][1]), Pr(i1, sd * pr[k][0], yb + pr[k][1]), Pr(i1, sd * pr[k + 1][0], yb + pr[k + 1][1]), Pr(i0, sd * pr[k + 1][0], ya + pr[k + 1][1]), k === 2 ? COL.barTop : COL.bar, null, [hint[0], 0.3, hint[2]]);
        cb.quad(Pr(i0, sd * pr[3][0], ya + 1), Pr(i1, sd * pr[3][0], yb + 1), Pr(i1, sd * W, yb + 1), Pr(i0, sd * W, ya + 1), COL.barTop, null, [0, 1, 0]);
        const ba = el(i0) ? ya - 1.1 : Math.min(ya - 1.1, r.Gmin[i0] - 0.4), bb = el(i0) ? yb - 1.1 : Math.min(yb - 1.1, r.Gmin[i1] - 0.4);
        cb.quad(Pr(i0, sd * W, ya + 1), Pr(i1, sd * W, yb + 1), Pr(i1, sd * W, bb), Pr(i0, sd * W, ba), el(i0) ? COL.side : COL.wall, null, out);
      }
      if (main && S[i0] < S_OPEN - 0.1) cb.quad(Pr(i0, -HW, ya - 0.02), Pr(i1, -HW, yb - 0.02), Pr(i1, -ROAD, yb - 0.02), Pr(i0, -ROAD, ya - 0.02), COL.under, null, [0, 1, 0]); // 開口那邊護欄的位子：鋪平
      if (el(i0)) { const a0 = main ? -W : innerU(i0), a1 = main ? -W : innerU(i1); if (a0 < W - 0.01 || a1 < W - 0.01) cb.quad(Pr(i0, a0, ya - 1.1), Pr(i1, a1, yb - 1.1), Pr(i1, W, yb - 1.1), Pr(i0, W, ya - 1.1), COL.under, null, [0, -1, 0]); } // 橋面底下
      if (i0 >= 2 && el(i0) !== el(i0 - STEP) && !att(r, i0)) { const j = i0, yj = RY[j], g = r.Gmin[j] - 0.4, t = [RTX[j], 0, RTZ[j]], f = el(j) ? t : [-t[0], 0, -t[2]]; cb.quad(Pr(j, -W, yj - 1.1), Pr(j, W, yj - 1.1), Pr(j, W, g), Pr(j, -W, g), COL.wall, null, f); } // 引道的牆到橋的地方：一面牆封起來
      if (main && medOn(i0) && medOn(i1)) { if (!medOn(i0 - 1)) medCap(i0, -1); medSeg(i0, i1); if (!medOn(i1 + 1) || i1 >= m - 1) medCap(i1, 1); } // 第 93 批：分隔島
      if (main ? (i0 + STEP) % CH < STEP || i1 >= m - 1 : i1 >= m - 1 && rampEnd(rk)) flushChunk();
    }
    if (main) cap(0, 1, -1); // 起點外側（內側開口的頭上面那行自己封）
    for (const sd of [-1, 1]) if (on[sd]) cap(m - 1, sd, 1); // 終點
  }
  if (ramB.n) { const me = new THREE.Mesh(ramB.geo(), rampMat); me.name = 'vd-ramp'; me.receiveShadow = true; me.matrixAutoUpdate = false; me.updateMatrix(); group.add(me); tris += ramB.nt; chunks.push(me); }

  // 4) 橋墩（30 公尺一支，不放在路上、房子、隧道、停車場）＋圓環兩邊的柱子、橫樑；碰撞只給玩家（在橋上的時候關掉）
  const cols = [], piers = [];
  const offWhenOn = (c) => { Object.defineProperty(c, 'off', { get: () => st.on, set: () => {}, enumerable: false, configurable: true }); return c; };
  const VCG = new Map(); for (const c of V.colliders) { if (!c || !isFinite(c.x)) continue; const r = c.t === 'box' ? Math.hypot(c.hx, c.hz) : c.r || 0; for (let a = Math.floor((c.x - r) / 16); a <= Math.floor((c.x + r) / 16); a++) for (let b = Math.floor((c.z - r) / 16); b <= Math.floor((c.z + r) / 16); b++) { const k = gkey(a, b); let Lc = VCG.get(k); if (!Lc) VCG.set(k, (Lc = [])); Lc.push(c); } }
  const hitCol = (x, z, m) => { const Lc = VCG.get(gkey(Math.floor(x / 16), Math.floor(z / 16))); if (!Lc) return false; for (const c of Lc) { if (c.t === 'box') { const dx = x - c.x, dz = z - c.z, co = Math.cos(c.rot || 0), si = Math.sin(c.rot || 0), lu = dx * co - dz * si, lw = dx * si + dz * co; if (Math.abs(lu) < c.hx + m && Math.abs(lw) < c.hz + m) return true; } else if (Math.hypot(x - c.x, z - c.z) < (c.r || 0) + m) return true; } return false; };
  const onRoad = (x, z) => { if (inRest(x, z)) return RL.roadAt(x, z); const s = V.surfaceAt ? V.surfaceAt(x, z) : 1; if (s === 0 || s === 4) return true; if (V.npcOnRoad && V.npcOnRoad(x, z)) return true; return s === 3 && x < 100; };
  const badSpot = (x, z, r) => { for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { const qx = x + dx, qz = z + dz; if (onRoad(qx, qz) || hitCol(qx, qz, 0.6) || vdInLot(qx, qz, 1.5) || (HL && HL.tunAt && HL.tunAt(qx, qz) >= 0)) return true; } return false; };
  const below = (x, z, y, rad, skipI) => { const Lc = GRID.get(gkey(Math.floor(x / CELL), Math.floor(z / CELL))); if (!Lc) return false; for (let k = 0; k < Lc.length; k++) { const i = Lc[k]; if (GR[i] === GR[skipI] && Math.abs(i - skipI) < 25) continue; segQ(i, x, z); if (SQ.d2 < (rad + ROADS[GR[i]].hw - HW) ** 2 && GY[i] < y - 2) return true; } return false; }; // 這裡下面還有別的橋面（skipI：全部接成一串的號碼）
  const box = (cx, cz, ry, hx, hz, y0, y1, col) => { // 立著的長方塊（本地 x 沿著 ry 的方向）
    const c = Math.cos(ry), s = Math.sin(ry), p = (lx, lz, y) => [cx + lx * c - lz * s, y, cz + lx * s + lz * c];
    const F = [[[-hx, -hz], [hx, -hz]], [[hx, -hz], [hx, hz]], [[hx, hz], [-hx, hz]], [[-hx, hz], [-hx, -hz]]];
    for (const [[ax, az], [bx, bz]] of F) { const mx = (ax + bx) / 2, mz = (az + bz) / 2; cb.quad(p(ax, az, y0), p(bx, bz, y0), p(bx, bz, y1), p(ax, az, y1), col, null, [mx * c - mz * s, 0, mx * s + mz * c]); }
    cb.quad(p(-hx, -hz, y1), p(hx, -hz, y1), p(hx, hz, y1), p(-hx, hz, y1), col, null, [0, 1, 0]);
    cb.quad(p(-hx, -hz, y0), p(hx, -hz, y0), p(hx, hz, y0), p(-hx, hz, y0), col, null, [0, -1, 0]);
  };
  const yawOf = (i) => Math.atan2(TZ[i], TX[i]); // 本地 x 沿著路（box 用的 ry：x' = x cos − z sin … 這裡用 [cos, sin] 當方向）
  let nPier = 0, nSkip = 0;
  for (let s0 = sH + 30; s0 < L - 10; s0 += 30) { // 平的那段、下來那段：中間一支
    let done = false;
    for (const ds of [0, 6, -6, 12, -12]) {
      const i = Math.round((s0 + ds) / 2); if (i < 1 || i >= n - 1) continue;
      if (clearAt(i) < WALL) { done = true; break; } // 引道（牆）
      const x = X[i], z = Z[i], g = Gmin[i] - 0.3, y = Y[i];
      if (below(x, z, y, HW + 2, i) || badSpot(x, z, 2.6)) continue;
      const ry = yawOf(i);
      box(x, z, ry, 1.0, 2.2, g, y - 2.2, COL.pier); box(x, z, ry, 1.1, HW - 1.6, y - 2.2, y - 1.1, COL.cap); // 柱子、上面的帽子（第 94 批：路變寬，柱子寬一點、帽子長一點）
      const c = offWhenOn({ t: 'box', x, z, hx: 1.0, hz: 2.2, rot: -ry, h: y - 1.1, y0: g, noCrush: true, vd: 'pier' }); cols.push(c); piers.push([x, z]); nPier++; done = true; break;
    }
    if (!done) nSkip++;
  }
  // 圓環：每 20 度兩支柱子（半徑 R ± (HW + 1.4)），到那個角度最上面那層；每一層下面一根橫樑；開口、連到快速道路的路、停車場不放
  let nCol = 0;
  const LC = TAU * R;
  for (let a = 0; a < 360; a += 20) {
    const th = (-90 - a) * (Math.PI / 180), cx = Math.cos(th), cz = Math.sin(th);
    const laps = []; for (let s = (a / 360) * LC; s <= sH + 0.01; s += LC) laps.push(s);
    const ys = laps.map((s) => Y[Math.min(n - 1, Math.round(s / 2))]); const top = Math.max(...ys);
    const ok = (rr) => { const x = C0.x + cx * rr, z = C0.z + cz * rr; return !(Math.abs(x - CONN.x) < CONN.hw + 2.5 && z > C0.z) && !(laps[0] < S_OPEN + 14 && rr < R) && !hitCol(x, z, 0.5) && !onRoad(x, z); };
    const g = Gmin[Math.min(n - 1, Math.round(laps[0] / 2))] - 0.3;
    if (top - g < WALL) continue;
    for (const rr of [R - HW - 1.4, R + HW + 1.4]) {
      if (!ok(rr)) continue;
      const x = C0.x + cx * rr, z = C0.z + cz * rr;
      box(x, z, th, 0.7, 0.7, g, top - 1.1, COL.pier);
      cols.push(offWhenOn({ t: 'circle', x, z, r: 0.75, h: top - 1.1, y0: g, noCrush: true, vd: 'col' })); nCol++;
    }
    for (let k = 0; k < laps.length; k++) if (ys[k] - g >= WALL) box(C0.x + cx * R, C0.z + cz * R, th, HW + 2.1, 0.6, ys[k] - 1.9, ys[k] - 1.1, COL.cap); // 橫樑（本地 x＝往外）
  }

  // 4b) 交流道的橋墩：26 公尺一支（中間一支、帽子窄一點）；接在主線旁邊那段、引道（牆）、下面還有別的橋面、路上、房子不放
  for (const r of ROADS) {
    if (r === VD_PATH) continue;
    for (let s0 = 13; s0 < r.L - 6; s0 += 26) {
      let done = false;
      for (const ds of [0, 5, -5, 10, -10]) {
        const i = Math.round(((s0 + ds) / r.L) * (r.n - 1)); if (i < 1 || i >= r.n - 1) continue;
        if (att(r, i) || r.Y[i] - r.Gmax[i] < WALL) { done = true; break; }
        const x = r.X[i], z = r.Z[i], g = r.Gmin[i] - 0.3, y = r.Y[i];
        if (below(x, z, y, RHW + 2, r.o + i) || inOther(r, x, z, y - 8, 1) || badSpot(x, z, 1.2)) continue;
        const ry = Math.atan2(r.TZ[i], r.TX[i]);
        box(x, z, ry, 0.8, 1.0, g, y - 2.0, COL.pier); box(x, z, ry, 0.9, 3.9, y - 2.0, y - 1.1, COL.cap);
        cols.push(offWhenOn({ t: 'box', x, z, hx: 0.8, hz: 1.0, rot: -ry, h: y - 1.1, y0: g, noCrush: true, vd: 'pier' })); piers.push([x, z]); nPier++; done = true; break;
      }
      if (!done) nSkip++;
    }
  }

  // 5) 路燈：48 公尺一支，左右輪流；燈頭晚上亮（look.js V.lampsX）
  const lb = qb(false), lampsX = [], lampK = [], GLOW = qb(false);
  { let side = 1;
    for (let s = 20; s < L - 10; s += 40, side = -side) { // 第 94 批：48 → 40 公尺（路寬了）
      const i = Math.round(s / 2), y = Y[i], base = P3(i, side * (HW - 0.1), y + 1), top = y + 10, arm = P3(i, side * (HW - 2), top), nr = nrmAt(i); // 第 94 批：路變寬：燈高一點、手臂長一點
      if (inOther(VD_PATH, base[0], base[2], y, 1.2) || !barOn(VD_PATH, i, side)) continue; // 第 92 批：交流道接在旁邊那段沒有護欄：不放
      boxAt(lb, base[0], base[2], 0.11, base[1], top, COL.pole);
      const tip = P3(i, side * (HW - 3.6), top - 0.05); lbar(lb, base[0], base[2], tip[0], tip[2], top - 0.25, top, 0.09, COL.pole);
      const head = P3(i, side * (HW - 4.0), top - 0.3); glowBox(head[0], head[2], top - 0.38, top - 0.18, nr);
      lampsX.push(head[0], top - 0.4, head[2]); lampK.push(1.4); void arm;
    }
  }
  for (const r of ROADS) { // 交流道：48 公尺一支，右手邊（外面）；接在主線旁邊那段不放
    if (r === VD_PATH) continue;
    for (let s = 30; s < r.L - 20; s += 48) {
      const i = Math.round((s / r.L) * (r.n - 1)); if (att(r, i) || !barOn(r, i, 1)) continue;
      const y = r.Y[i], P = (u, yy) => [r.X[i] - r.TZ[i] * u, yy, r.Z[i] + r.TX[i] * u], base = P(RHW - 0.12, y + 1), top = y + 8.5;
      if (inOther(r, base[0], base[2], y, 1.2)) continue;
      boxAt(lb, base[0], base[2], 0.1, base[1], top, COL.pole);
      const tip = P(RHW - 2.6, top - 0.05); lbar(lb, base[0], base[2], tip[0], tip[2], top - 0.25, top, 0.08, COL.pole);
      const head = P(RHW - 3.0, top - 0.3); glowBox(head[0], head[2], top - 0.38, top - 0.18); lampsX.push(head[0], top - 0.4, head[2]); lampK.push(1.2);
    }
  }
  if (lb.n) { const me = new THREE.Mesh(lb.geo(), concMat); me.name = 'vd-poles'; me.castShadow = true; group.add(me); tris += lb.nt; }
  function glowBox(x, z, y0, y1, nr) { GLOW.quad([x - 0.45, y0, z - 0.25], [x + 0.45, y0, z - 0.25], [x + 0.45, y0, z + 0.25], [x - 0.45, y0, z + 0.25], [1, 1, 1], null, [0, -1, 0]); GLOW.quad([x - 0.45, y1, z - 0.25], [x + 0.45, y1, z - 0.25], [x + 0.45, y1, z + 0.25], [x - 0.45, y1, z + 0.25], [0.5, 0.5, 0.5], null, [0, 1, 0]); void nr; }
  flushChunk();

  // 6) 停車場：柏油圓、白線、連到快速道路的路、走道的箭頭；燈（6 支）
  const lot = buildLot();
  group.add(lot.group); tris += lot.tris;
  for (let k = 0; k < lot.lamps.length; k += 3) { lampsX.push(lot.lamps[k], lot.lamps[k + 1], lot.lamps[k + 2]); lampK.push(1.3); }
  { const glow = new THREE.Mesh(GLOW.geo(), glowMat); glow.name = 'vd-lamp'; group.add(glow); tris += GLOW.nt; } // 燈頭（橋上＋停車場）

  // 7) 牌子：快速道路的口「超大停車場」、停車場往圓環「往內湖（高架）」、內湖那頭「往快速道路 超大停車場（高架）」
  const signs = buildSigns(); group.add(signs.mesh); tris += signs.tris;

  // 8) 碰撞：護欄（4 公尺一塊，兩邊；起點內側開口、交流道接在主線旁邊那段不放）——在同一層才擋；引道（離地不到 6 公尺）在地上的人也擋（牆）
  let nBar = 0;
  for (const r of ROADS) {
    const RX = r.X, RZ = r.Z, RY = r.Y, m = r.n;
    for (let i = 0; i < m - 1; i += 2) {
      const j = Math.min(m - 1, i + 2), x = (RX[i] + RX[j]) / 2, z = (RZ[i] + RZ[j]) / 2, y = Math.min(RY[i], RY[j]), yHi = Math.max(RY[i], RY[j]), len = Math.hypot(RX[j] - RX[i], RZ[j] - RZ[i]);
      if (len < 0.1) continue;
      const tx = (RX[j] - RX[i]) / len, tz = (RZ[j] - RZ[i]) / len, rot = Math.atan2(-tz, tx), wall = RY[i] - r.Gmax[i] < WALL || RY[j] - r.Gmax[j] < WALL, lo = wall ? -1e9 : y - 2.5;
      for (const sd of [-1, 1]) {
        if (!barOn(r, i, sd) || !barOn(r, j, sd)) continue;
        const u = sd * (r.hw - 0.3), c = { t: 'box', x: x - tz * u, z: z + tx * u, hx: len / 2 + 0.25, hz: 0.3, rot, h: yHi + 1.0, noCrush: true, lowCam: true, vd: 'bar' }; // h、y0＝絕對高度（walk.js）；牆（引道）沒有 y0＝走路的人在地上也擋；lowCam：開車的鏡頭不被護欄擋（drive.js tall）
        if (!wall) c.y0 = y;
        Object.defineProperty(c, 'off', { get: () => !(st.py > lo && st.py < yHi + 3), set: () => {}, enumerable: false, configurable: true });
        cols.push(c); nBar++;
      }
    }
  }
  // 8b) 第 93 批：分隔島（4 公尺一塊，中間）：在同一層才擋；開車的鏡頭不被擋
  let nMed = 0;
  for (let i = 0; i < n - 1; i += 2) {
    const j = Math.min(n - 1, i + 2); if (!medOn(i) || !medOn(j)) continue;
    const x = (X[i] + X[j]) / 2, z = (Z[i] + Z[j]) / 2, y = Math.min(Y[i], Y[j]), yHi = Math.max(Y[i], Y[j]), len = Math.hypot(X[j] - X[i], Z[j] - Z[i]); if (len < 0.1) continue;
    const c = { t: 'box', x, z, hx: len / 2 + 0.2, hz: 0.3, rot: Math.atan2(-(Z[j] - Z[i]) / len, (X[j] - X[i]) / len), h: yHi + MED.h + 0.62, y0: y, noCrush: true, lowCam: true, vd: 'med' };
    Object.defineProperty(c, 'off', { get: () => !(st.py > y - 2.5 && st.py < yHi + 3), set: () => {}, enumerable: false, configurable: true });
    cols.push(c); nMed++;
  }
  // 9) 停車場的車：遠的 InstancedMesh、碰撞（只給玩家）
  const lotCars = lotFar();
  // 太遠就不畫：停車場、休息站遠的車（每一區）、整個休息站（從內湖、山上看過去）
  const restCx = (RL.lot.x0 + RL.lot.x1) / 2, restCz = (RL.lot.z0 + RL.lot.z1) / 2;
  const cullFar = (x, y, z) => { lotCars.cull(x, y, z); const on = Math.hypot(x - restCx, z - restCz) < REST_CULL; if (on !== rest.group.visible) rest.group.visible = on; };
  group.add(...lotCars.meshes);
  for (const c of lotCars.cols) cols.push(c);
  // 9b) 第 92 批：休息站（vdrest.js）：地面、線、主建築（便利商店走得進去：V.buildings 一棟 store）、廁所、加油站、廣場、大車、山上的字、樹、路燈
  const rest = buildRestArea(RL, { V, qb, boxAt, lbar, renderer: opts.renderer });
  group.add(rest.group); tris += rest.tris; for (const c of rest.cols) cols.push(c);
  for (let k = 0; k < rest.lamps.length; k += 3) { lampsX.push(rest.lamps[k], rest.lamps[k + 1], rest.lamps[k + 2]); lampK.push(1.3); }
  // 9c) 第 92 批：牌子（vdsign.js）：限速、前有大彎、門架（橫過路中間）、ETC 門架、休息站的出口
  const sg2 = buildVdSigns({ roads: ROADS, main: VD_PATH, sH, sD, HW, qb, boxAt, lbar, inOther, barOn, concMat, COL, renderer: opts.renderer });
  group.add(sg2.group); tris += sg2.tris;
  for (const c of sg2.cols) { // 牌子的柱子：玩家在柱子那個高度（y0…h）才擋（上面的交流道、下面的地上都不擋）
    const lo = c.y0 - 0.5, hi = c.h - 1; Object.defineProperty(c, 'off', { get: () => !(st.py > lo && st.py < hi), set: () => {}, enumerable: false, configurable: true }); cols.push(c);
  }

  // 10) 被橋蓋到的地面碰撞（離橋面邊 6 公尺內、橋比地面高 3 公尺以上）：玩家在橋上的時候關掉（不然開在橋上撞到下面的房子、樹、隧道洞口的欄杆）
  const K0 = Symbol('vdOff'); let nGround = 0;
  const wrap = (c) => {
    if (!c || c[K0] !== undefined || c.vd) return;
    const d = Object.getOwnPropertyDescriptor(c, 'off'); if (d && (d.get || d.configurable === false)) return;
    Object.defineProperty(c, K0, { value: { v: c.off }, enumerable: false, writable: true });
    Object.defineProperty(c, 'off', { get() { return st.high || this[K0].v === true; }, set(v) { this[K0].v = v; }, enumerable: false, configurable: true });
    nGround++;
  };
  const coversCol = (c) => {
    const pts = [[c.x, c.z]];
    if (c.t === 'box') { const co = Math.cos(c.rot || 0), si = Math.sin(c.rot || 0); for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0]]) pts.push([c.x + a * c.hx * co + b * c.hz * si, c.z - a * c.hx * si + b * c.hz * co]); }
    for (const [x, z] of pts) if (vdEdge(x, z) < 6) return true;
    return false;
  };
  for (const c of [...V.colliders, ...(HL && HL.layerCols ? HL.layerCols : [])]) if (c && isFinite(c.x) && coversCol(c)) wrap(c);

  // 11) 高度（只給玩家）：at(x, z, py) 挑 py 附近（−3…+1.5）最近的那層（主線、交流道都算）；不配置記憶體；Q.r＝第幾條路（0＝主線）、Q.s、Q.u＝那條路的
  const Q = { y: 0, s: 0, u: 0, g: 0, tx: 1, tz: 0, i: -1, t: 0, r: 0 };
  function at(x, z, py) {
    const Lc = GRID.get(gkey(Math.floor(x / CELL), Math.floor(z / CELL))); if (!Lc) return null;
    let best = 1e9, by = 0, bi = -1, bt = 0;
    for (let k = 0; k < Lc.length; k++) {
      const i = Lc[k]; segQ(i, x, z); const w = ROADS[GR[i]].hw; if (SQ.d2 > w * w) continue;
      const y = GY[i] + (GY[i + 1] - GY[i]) * SQ.t; if (y < py - 3 || y > py + 1.5) continue;
      if (SQ.d2 < best) { best = SQ.d2; by = y; bi = i; bt = SQ.t; } // 那一層（高度窗）裡面最近的那段（挑高度最接近的話：上坡的時候會挑前面高一點的那段，地面一直往上跳，車子被彈飛）
    }
    if (bi < 0) return null;
    const r = ROADS[GR[bi]], li = GI[bi];
    Q.y = by; Q.i = bi; Q.t = bt; Q.r = r.id; Q.s = r.S[li] + (r.S[li + 1] - r.S[li]) * bt; Q.g = (GY[bi + 1] - GY[bi]) / (r.S[li + 1] - r.S[li] || 1); Q.tx = r.TX[li]; Q.tz = r.TZ[li];
    Q.u = (x - GX[bi]) * -Q.tz + (z - GZ[bi]) * Q.tx;
    return by;
  }
  function normal(x, z, py, out) { if (at(x, z, py) == null) return null; const k = 1 / Math.sqrt(1 + Q.g * Q.g); out[0] = -Q.tx * Q.g * k; out[1] = k; out[2] = -Q.tz * Q.g * k; return out; }

  // 12) 地面種類：停車場、連到快速道路的路＝柏油（不限速、不長草）
  const s0 = V.surfaceAt; V.surfaceAt = (x, z) => (vdInLot(x, z) || inRest(x, z) ? 0 : s0 ? s0(x, z) : 1);
  // 13) 小地圖：停車場（灰）、高架（淺藍灰的粗線）
  const prevDraw = V.mapDraw;
  V.mapDraw = (g) => {
    if (prevDraw) prevDraw(g);
    g.save();
    g.fillStyle = 'rgba(70,74,80,0.9)'; g.beginPath(); g.arc(C0.x, C0.z, VD_LOT.r, 0, TAU); g.fill(); g.fillRect(CONN.x - CONN.hw, CONN.z0, CONN.hw * 2, CONN.z1 - CONN.z0);
    g.strokeStyle = 'rgba(150,178,200,0.95)'; g.lineJoin = 'round'; g.lineCap = 'butt';
    g.fillStyle = 'rgba(70,74,80,0.9)'; for (const q of RL.roads) g.fillRect(q.x0, q.z0, q.x1 - q.x0, q.z1 - q.z0); g.fillRect(RL.lot.x0, RL.lot.z0, RL.lot.x1 - RL.lot.x0, RL.lot.z1 - RL.lot.z0); // 休息站
    g.fillStyle = 'rgba(150,120,100,0.95)'; for (const q of [RL.hall, ...RL.wcs]) g.fillRect(q.x0, q.z0, q.x1 - q.x0, q.z1 - q.z0);
    for (const r of ROADS) { g.lineWidth = 2 * r.hw; g.beginPath(); for (let i = 0; i < r.n; i += 4) (i ? g.lineTo(r.X[i], r.Z[i]) : g.moveTo(r.X[i], r.Z[i])); g.lineTo(r.X[r.n - 1], r.Z[r.n - 1]); g.stroke(); }
    g.restore();
  };
  V.lampsX = (V.lampsX || []).concat(lampsX); V.lampsK = (V.lampsK || []).concat(lampK);
  V.group.add(group);

  const API = {
    group, st, at, normal, Q, cols, Y, G: Gc, lot: lotCars, cull: cullFar, path: VD_PATH, HW, sD, roads: ROADS, median: MED, rest, restL: RL, signs: sg2, etc: sg2.etc, // roads[0]＝主線；交流道：{ X, Z, S, TX, TZ, n, L, Y, MS（接在主線旁邊那段的主線 s）, UC, def }
    near: vdNear, inLot: vdInLot, clearAt: (i) => clearAt(i),
    info: null,
  };
  const ramps = ROADS.slice(1).map((r) => ({ id: r.def.id, len: +r.L.toFixed(1), grade: +(r.maxGrade * 100).toFixed(1), yTop: +Math.max(...r.Y).toFixed(1), yEnd: +r.Y[r.n - 1].toFixed(2) }));
  API.info = { len: +L.toFixed(1), helix: +sH.toFixed(1), sD: +sD.toFixed(1), pts: n, tris, chunks: chunks.length, piers: nPier, pierSkip: nSkip, cols: nCol, bars: nBar, med: nMed, medS: [MED.s0, +MED.s1.toFixed(1)], ground: nGround, lamps: lampsX.length / 3, lotSpots: VD_LOT.spots.length, lotCars: lotCars.cars.length, signs: sg2.list.length, signSkip: sg2.list.filter((q) => q.skip).length, curves: sg2.curves, etc: sg2.etc.map((e) => e.s), restBays: RL.bays.length, restCars: lotCars.cars.filter((c) => c.area === 'r').length, restTris: rest.tris, ramps, yMax: +Math.max(...Y).toFixed(2),
    minClear: (() => { let m = 1e9, at2 = 0; for (let i = 0; i < n; i++) if (S[i] > sH && S[i] < sD && !restSide(i)) { const c = clearAt(i); if (c < m) { m = c; at2 = S[i]; } } return [+m.toFixed(2), +at2.toFixed(0)]; })(),
    restMain: (() => { let a = 1e9, b = -1e9, s0 = 1e9, s1 = -1e9; for (let i = 0; i < n; i++) if (restSide(i)) { a = Math.min(a, Y[i]); b = Math.max(b, Y[i]); s0 = Math.min(s0, S[i]); s1 = Math.max(s1, S[i]); } return { yLo: +a.toFixed(2), yHi: +b.toFixed(2), s0: Math.round(s0), s1: Math.round(s1) }; })(),
    ms: 0 };
  API.info.ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - T0);
  if (V.info) V.info.viaduct = API.info;
  V.viaduct = API;
  return API;

  // ---- 停車場的地面 ----
  function buildLot() {
    const b = qb(false), g = new THREE.Group(); g.name = 'vd-lot';
    const y = 0.025, NS = 96, lamps = [];
    for (let k = 0; k < NS; k++) { const a0 = (k / NS) * TAU, a1 = ((k + 1) / NS) * TAU; b.tri([C0.x, y, C0.z], [C0.x + Math.cos(a1) * VD_LOT.r, y, C0.z + Math.sin(a1) * VD_LOT.r], [C0.x + Math.cos(a0) * VD_LOT.r, y, C0.z + Math.sin(a0) * VD_LOT.r], COL.lot, [0, 1, 0]); }
    b.quad([CONN.x - CONN.hw, y, CONN.z0], [CONN.x + CONN.hw, y, CONN.z0], [CONN.x + CONN.hw, y, CONN.z1], [CONN.x - CONN.hw, y, CONN.z1], COL.lot, null, [0, 1, 0]);
    const ly = y + 0.012, ln = (x0, z0, x1, z1, w, col) => { const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, ox = (-dz / l) * w / 2, oz = (dx / l) * w / 2; b.quad([x0 - ox, ly, z0 - oz], [x0 + ox, ly, z0 + oz], [x1 + ox, ly, z1 + oz], [x1 - ox, ly, z1 - oz], col, null, [0, 1, 0]); };
    for (const p of VD_LOT.spots) { const hz = VD_LOT.d / 2, w = VD_LOT.w; for (const sx of [-1, 1]) ln(p[0] + sx * w / 2, p[1] - hz, p[0] + sx * w / 2, p[1] + hz, 0.12, COL.line); }
    for (let k = -4; k <= 4; k++) { const zc = C0.z + 17 * k, dz = Math.abs(zc - C0.z); if (dz < VD_LOT.rs) { const hw = Math.sqrt(VD_LOT.rs ** 2 - dz * dz); ln(C0.x - hw, zc, C0.x - VD_LOT.ais, zc, 0.12, COL.line); ln(C0.x + VD_LOT.ais, zc, C0.x + hw, zc, 0.12, COL.line); } }
    for (let z = C0.z - 80; z < CONN.z1 - 6; z += 6) if (!(z > C0.z - 2 && z < C0.z + 2)) ln(C0.x, z, C0.x, z + 3, 0.15, COL.yel); // 中間走道的中線（黃虛線）
    for (const [x, z] of [[C0.x - 45, C0.z - 70], [C0.x + 45, C0.z - 70], [C0.x - 80, C0.z], [C0.x + 80, C0.z], [C0.x - 45, C0.z + 70], [C0.x + 45, C0.z + 70]]) { // 停車場的燈（高 9 公尺）
      boxAt(b, x, z, 0.14, y, 9, COL.pole); glowBox(x, z, 8.6, 8.85); lamps.push(x, 8.5, z);
    }
    const lm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); lm.name = 'vd-lot';
    const me = new THREE.Mesh(b.geo(), lm); me.name = 'vd-lot'; me.receiveShadow = true; g.add(me);
    return { group: g, tris: b.nt, lamps };
  }
  // ---- 牌子（綠底白字，一張貼圖三面）----
  function buildSigns() {
    const W = 1024, H = 384, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
    const panel = (y0, lines, arrow) => {
      x.fillStyle = '#0f6a3c'; x.fillRect(0, y0, W, 128); x.strokeStyle = '#f2f2f2'; x.lineWidth = 6; x.strokeRect(8, y0 + 8, W - 16, 112);
      x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `700 ${lines.length > 1 ? 44 : 62}px ${SANS}`; lines.forEach((t, k) => x.fillText(t, W / 2 - (arrow ? 60 : 0), y0 + 64 + (k - (lines.length - 1) / 2) * 50));
      if (arrow) { x.save(); x.translate(W - 110, y0 + 64); x.rotate(arrow); x.beginPath(); x.moveTo(0, -42); x.lineTo(30, -8); x.lineTo(11, -8); x.lineTo(11, 40); x.lineTo(-11, 40); x.lineTo(-11, -8); x.lineTo(-30, -8); x.closePath(); x.fill(); x.restore(); }
    };
    panel(0, ['超大停車場'], 0.0001); panel(128, ['往內湖（高架）'], -Math.PI / 2); panel(256, ['往快速道路', '超大停車場（高架）'], 0.0001);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.6 }); m.name = 'vd-sign';
    const b = qb(true), post = qb(false);
    const sign = (cx, cz, face, row, wd, hgt, y0) => { // face：牌子朝哪個方向（往那邊看得到字）
      const rx = -face[1], rz = face[0], v0 = 1 - (row + 1) / 3, v1 = 1 - row / 3, p = (u, y) => [cx + rx * u + face[0] * 0.02, y, cz + rz * u + face[1] * 0.02];
      b.quad(p(-wd / 2, y0), p(wd / 2, y0), p(wd / 2, y0 + hgt), p(-wd / 2, y0 + hgt), null, [[0, v0], [1, v0], [1, v1], [0, v1]], [face[0], 0, face[1]]);
      const bk = (u, y) => [cx + rx * u - face[0] * 0.04, y, cz + rz * u - face[1] * 0.04];
      post.quad(bk(wd / 2, y0), bk(-wd / 2, y0), bk(-wd / 2, y0 + hgt), bk(wd / 2, y0 + hgt), COL.pole, null, [-face[0], 0, -face[1]]);
      for (const u of [-wd / 2 + 0.3, wd / 2 - 0.3]) boxAt(post, cx + rx * u - face[0] * 0.15, cz + rz * u - face[1] * 0.15, 0.09, (V.heightAt ? V.heightAt(cx, cz) : 0), y0 + hgt * 0.9, COL.pole);
    };
    sign(CONN.x + CONN.hw + 2.2, CONN.z1 - 14, [0, 1], 0, 4.4, 1.65, 2.2); // 快速道路的口（從快速道路轉進來看得到）
    sign(C0.x + 9, C0.z - 72, [0, 1], 1, 4.4, 1.65, 2.2); // 停車場北邊（往圓環的起點）
    { const i = n - 12, f = [-TX[i], -TZ[i]], g2 = Y[i]; sign(X[i] - TZ[i] * 10.5, Z[i] + TX[i] * 10.5, f, 2, 5, 1.9, g2 + 2.6); } // 內湖那頭（從那條路開過來看得到）
    const me = new THREE.Mesh(b.geo(), m); me.name = 'vd-sign';
    const pm = new THREE.Mesh(post.geo(), concMat); pm.name = 'vd-sign-post'; me.add(pm);
    return { mesh: me, tris: b.nt + post.nt };
  }
  // ---- 停車場的車（遠的）：第 92 批起每一種車一個 InstancedMesh（opts.far＝farcars.js：那台車自己的樣子，約 300 個三角形）；沒有資料的才用方塊（車身＋玻璃、輪子兩個 InstancedMesh，照長寬高放大）----
  function lotFar() {
    const cars = [], colsL = [];
    for (const p of VD_LOT.spots) { const o = opts.lotCar ? opts.lotCar(p[3]) : null; if (!o) continue; const d = (opts.dims && opts.dims(o.k)) || [4.5, 1.9, 1.4]; cars.push({ j: p[3], x: p[0], z: p[1], h: p[2], k: o.k, paint: o.paint, d, y: 0, area: '' }); }
    for (const b of RL.bays) { const j = 20000 + b.n, o = opts.lotCar ? opts.lotCar(j, b.kind ? 0.3 : 0.58) : null; if (!o) continue; const d = (opts.dims && opts.dims(o.k)) || [4.5, 1.9, 1.4]; cars.push({ j, x: b.x, z: b.z, h: b.h, k: o.k, paint: o.paint, d, y: RL.y, area: 'r' }); } // 第 92 批：休息站的停車格（約 58% 有車；婦幼、無障礙格 30%）
    const FAR = opts.far || {}, meshes = [], groups = new Map(); // k → { list, meshes[] }（'' ＝方塊）
    for (const c of cars) { const g = c.area + '|' + (FAR[c.k] ? c.k : ''); let G = groups.get(g); if (!G) groups.set(g, (G = { list: [], meshes: [], k: FAR[c.k] ? c.k : '' })); c.slot = G.list.length; c.grp = G; G.list.push(c); } // 停車場、休息站分開（各自的包圍球：看不到的那邊不畫）
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    let ftris = 0;
    for (const [, G] of groups) {
      const N = G.list.length, k = G.k;
      const parts = k ? [[farGeo(FAR[k]), farMaterial()]] : [[farCarGeo(false), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.25 })], [farCarGeo(true), new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.3, metalness: 0.1 })]];
      for (const [geo, mat] of parts) {
        const I = new THREE.InstancedMesh(geo, mat, N); I.name = k ? 'vd-far-' + k : 'vd-lotcars'; mat.name = k ? 'vd-far' : 'vd-lotcar';
        I.castShadow = false; I.receiveShadow = true; G.meshes.push(I); meshes.push(I); ftris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3 * N;
      }
      G.mats = [];
      G.list.forEach((c, i) => {
        q.setFromAxisAngle(up, c.h); pos.set(c.x, c.y + 0.03, c.z); if (k) sc.set(1, 1, 1); else sc.set(c.d[0], c.d[2], c.d[1] * 0.92); M4.compose(pos, q, sc); G.mats.push(M4.clone());
        col.set(c.paint); for (const I of G.meshes) { I.setMatrixAt(i, M4); if (I.material.name !== 'vd-lotcar' || I === G.meshes[0]) I.setColorAt(i, col); }
      });
      for (const I of G.meshes) { I.instanceMatrix.needsUpdate = true; if (I.instanceColor) I.instanceColor.needsUpdate = true; I.computeBoundingSphere(); }
    }
    for (const c of cars) colsL.push({ t: 'box', x: c.x, z: c.z, hx: c.d[0] / 2, hz: (c.d[1] * 0.92) / 2, rot: c.h, h: c.y + c.d[2], ...(c.y ? { y0: c.y } : {}), noCrush: true, vd: 'lotcar' });
    cars.forEach((c, i) => { c.inst = i; });
    const set = (i, on) => { const c = cars[i], G = c.grp, m = on ? G.mats[c.slot] : ZERO; for (const I of G.meshes) { I.setMatrixAt(c.slot, m); I.instanceMatrix.needsUpdate = true; } };
    const M5 = new THREE.Matrix4(), hidden = (i) => { const c = cars[i]; c.grp.meshes[0].getMatrixAt(c.slot, M5); return M5.elements[0] === 0; };
    // 遠的車：那一區（停車場、休息站）離鏡頭太遠就整區不畫（從內湖、山上看過去只剩一兩個點，一種車一個 draw call 太多）
    const GL = [...groups.values()].map((G) => { const S = G.meshes[0].boundingSphere; return { G, x: S.center.x, y: S.center.y, z: S.center.z, r: S.radius, on: true }; });
    const cull = (x, y, z, far = FAR_CULL) => { let n = 0; for (const g of GL) { const on = Math.hypot(g.x - x, g.y - y, g.z - z) - g.r < far; if (on !== g.on) { g.on = on; for (const I of g.G.meshes) I.visible = on; } if (on) n++; } return n; };
    return { cars, cols: colsL, meshes, hide: (i) => set(i, false), show: (i) => set(i, true), hidden, tris: ftris, kinds: groups.size, cull };
  }
}

// ---- 第 92 批：遠的車的網格（farcars.js 的一台：位置是公釐 Int16、每個點的分類、三角形）----
const FAR_COL = [[1, 1, 1, 1], [0.07, 0.08, 0.09, 0], [0.09, 0.09, 0.1, 0], [0.82, 0.82, 0.8, 0], [0.6, 0.06, 0.05, 0], [0.05, 0.05, 0.055, 0], [0.55, 0.56, 0.58, 0]]; // 車漆（乘上那台車的顏色）、玻璃、黑飾條、燈、尾燈、輪胎、輪框
const FAR_GEO = new WeakMap();
function farGeo(F) {
  let g = FAR_GEO.get(F); if (g) return g;
  const dec = (s, T) => { const b = typeof atob === 'function' ? Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0)) : Uint8Array.from(Buffer.from(s, 'base64')); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
  const Pq = dec(F.p, Int16Array), Cc = dec(F.c, Uint8Array), I = dec(F.i, Uint16Array), n = Cc.length;
  const P = new Float32Array(n * 3), C = new Float32Array(n * 3), W = new Float32Array(n);
  for (let i = 0; i < n; i++) { P[i * 3] = Pq[i * 3] / 1000; P[i * 3 + 1] = Pq[i * 3 + 1] / 1000; P[i * 3 + 2] = Pq[i * 3 + 2] / 1000; const c = FAR_COL[Cc[i]] || FAR_COL[2]; C[i * 3] = c[0]; C[i * 3 + 1] = c[1]; C[i * 3 + 2] = c[2]; W[i] = c[3]; }
  g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('farPw', new THREE.BufferAttribute(W, 1)); g.setIndex(new THREE.BufferAttribute(Uint16Array.from(I), 1));
  g.computeVertexNormals(); g.computeBoundingSphere(); FAR_GEO.set(F, g); return g;
}
let FAR_MAT = null;
function farMaterial() { // 一種材質大家共用：車漆的點（farPw＝1）乘上那台車的顏色，玻璃、輪子不乘
  if (FAR_MAT) return FAR_MAT;
  FAR_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.2 });
  FAR_MAT.onBeforeCompile = (sh) => { sh.vertexShader = 'attribute float farPw;\n' + sh.vertexShader.replace('vColor.xyz *= instanceColor.xyz;', 'vColor.xyz *= mix(vec3(1.0), instanceColor.xyz, farPw);'); };
  FAR_MAT.customProgramCacheKey = () => 'vdfar';
  return FAR_MAT;
}

// ---- 一台車的簡單樣子（長寬高都是 1：x −0.5…0.5 往前、y 0…1、z −0.5…0.5）----
function farCarGeo(dark) {
  const b = qb(false), c = [1, 1, 1];
  const bx = (x0, x1, y0, y1, z0, z1, xt0 = x0, xt1 = x1, zt = z1) => { // 下面 x0…x1、上面 xt0…xt1（前後斜）、上面寬 ±zt
    const p = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [xt0, y1, -zt], [xt1, y1, -zt], [xt1, y1, zt], [xt0, y1, zt]];
    const f = (a, bb, cc, d, h) => b.quad(p[a], p[bb], p[cc], p[d], c, null, h);
    f(4, 5, 6, 7, [0, 1, 0]); f(0, 1, 5, 4, [0, 0, -1]); f(3, 7, 6, 2, [0, 0, 1]); f(1, 2, 6, 5, [1, 0.3, 0]); f(0, 4, 7, 3, [-1, 0.3, 0]); f(0, 3, 2, 1, [0, -1, 0]);
  };
  if (!dark) {
    bx(-0.5, 0.5, 0.17, 0.5, -0.47, 0.47, -0.49, 0.44, 0.46); // 車身
    bx(-0.19, 0.12, 0.86, 0.9, -0.36, 0.36, -0.18, 0.11, 0.35); // 車頂
  } else {
    bx(-0.33, 0.27, 0.5, 0.86, -0.43, 0.43, -0.2, 0.12, 0.36); // 玻璃那一段
    for (const [x, z] of [[0.31, -0.45], [0.31, 0.45], [-0.31, -0.45], [-0.31, 0.45]]) bx(x - 0.12, x + 0.12, 0, 0.3, z - 0.05, z + 0.05, x - 0.12, x + 0.12, z + 0.05); // 輪子
  }
  return b.geo();
}

// ---- 小工具：四邊形一個一個加（法線照 hint 那一邊）----
function qb(uv) {
  let P = [], N = [], Cc = [], U = [], I = [];
  const o = {
    n: 0, nt: 0, // nt：幾個三角形（tri 是畫一個三角形）
    quad(a, b, c, d, col, uvs, hint) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return;
      nx /= l; ny /= l; nz /= l;
      let q = [a, b, c, d], qu = uvs;
      if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { q = [a, d, c, b]; qu = uvs && [uvs[0], uvs[3], uvs[2], uvs[1]]; nx = -nx; ny = -ny; nz = -nz; }
      const k = o.n;
      for (let m = 0; m < 4; m++) { P.push(q[m][0], q[m][1], q[m][2]); N.push(nx, ny, nz); if (uv) U.push(qu ? qu[m][0] : 0, qu ? qu[m][1] : 0); else Cc.push(col[0], col[1], col[2]); }
      I.push(k, k + 1, k + 2, k, k + 2, k + 3); o.n += 4; o.nt += 2;
    },
    tri(a, b, c, col, hint) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return; nx /= l; ny /= l; nz /= l;
      let q = [a, b, c]; if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { q = [a, c, b]; nx = -nx; ny = -ny; nz = -nz; }
      const k = o.n; for (let m = 0; m < 3; m++) { P.push(q[m][0], q[m][1], q[m][2]); N.push(nx, ny, nz); if (uv) U.push(0, 0); else Cc.push(col[0], col[1], col[2]); }
      I.push(k, k + 1, k + 2); o.n += 3; o.nt += 1;
    },
    geo() {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); else g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
      g.setIndex(o.n > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1)); g.computeBoundingSphere(); g.computeBoundingBox(); return g;
    },
    reset() { P = []; N = []; Cc = []; U = []; I = []; o.n = 0; o.nt = 0; },
  };
  return o;
}
function boxAt(b, x, z, r, y0, y1, col) { // 細的方柱
  const p = (a, c, y) => [x + a, y, z + c];
  b.quad(p(-r, -r, y0), p(r, -r, y0), p(r, -r, y1), p(-r, -r, y1), col, null, [0, 0, -1]); b.quad(p(r, -r, y0), p(r, r, y0), p(r, r, y1), p(r, -r, y1), col, null, [1, 0, 0]);
  b.quad(p(r, r, y0), p(-r, r, y0), p(-r, r, y1), p(r, r, y1), col, null, [0, 0, 1]); b.quad(p(-r, r, y0), p(-r, -r, y0), p(-r, -r, y1), p(-r, r, y1), col, null, [-1, 0, 0]);
  b.quad(p(-r, -r, y1), p(r, -r, y1), p(r, r, y1), p(-r, r, y1), col, null, [0, 1, 0]);
}
function lbar(b, x0, z0, x1, z1, y0, y1, w, col) { // 橫的細條（燈的手臂）
  const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, ox = (-dz / l) * w, oz = (dx / l) * w;
  b.quad([x0 - ox, y1, z0 - oz], [x1 - ox, y1, z1 - oz], [x1 + ox, y1, z1 + oz], [x0 + ox, y1, z0 + oz], col, null, [0, 1, 0]);
  b.quad([x0 - ox, y0, z0 - oz], [x1 - ox, y0, z1 - oz], [x1 - ox, y1, z1 - oz], [x0 - ox, y1, z0 - oz], col, null, [-ox, 0, -oz]);
  b.quad([x0 + ox, y0, z0 + oz], [x1 + ox, y0, z1 + oz], [x1 + ox, y1, z1 + oz], [x0 + ox, y1, z0 + oz], col, null, [ox, 0, oz]);
  b.quad([x0 - ox, y0, z0 - oz], [x1 - ox, y0, z1 - oz], [x1 + ox, y0, z1 + oz], [x0 + ox, y0, z0 + oz], col, null, [0, -1, 0]);
}
// ---- 橋面的柏油：中間雙黃線、兩邊白虛線（6 公尺線、6 公尺空）、路邊白線；u 0–1＝−HW…HW 公尺、v 一圈＝12 公尺 ----
function deckTex(renderer) {
  const W = 512, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); // 第 94 批：路寬了：256 → 512
  g.fillStyle = '#45474a'; g.fillRect(0, 0, W, H);
  let s = 91; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < 5200; k++) { const v = 52 + rnd() * 34; g.fillStyle = `rgba(${v},${v},${v + 2},${0.25 + rnd() * 0.35})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
  const px = (m) => ((m + HW) / (2 * HW)) * W, lw = (m) => (m / (2 * HW)) * W;
  g.fillStyle = '#e2b437'; for (const o of [-0.55, 0.55]) g.fillRect(px(o) - lw(0.06), 0, lw(0.12), H); // 第 93 批：分隔島兩邊的黃線（以前中間是雙黃線）
  g.fillStyle = '#ecece6'; for (const o of [-10.6, -7.25, -3.9, 3.9, 7.25, 10.6]) g.fillRect(px(o) - lw(0.075), 0, lw(0.15), H / 2); // 白虛線（6 公尺）（第 94 批：一邊 4 線）
  for (const o of [-13.95, 13.95]) g.fillRect(px(o) - lw(0.075), 0, lw(0.15), H); // 路邊白線
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer && renderer.capabilities ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  return t;
}
// ---- 第 92 批：交流道的柏油（一線）：兩邊白線；u 0–1＝−4.6…4.6 公尺（u 超過 0–1：照邊上那一格＝柏油）----
function rampTex(renderer) {
  const W = 128, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#45474a'; g.fillRect(0, 0, W, H);
  let s = 37; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < 1300; k++) { const v = 52 + rnd() * 34; g.fillStyle = `rgba(${v},${v},${v + 2},${0.25 + rnd() * 0.35})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
  const px = (m) => ((m + 4.6) / 9.2) * W, lw = (m) => (m / 9.2) * W;
  g.fillStyle = '#ecece6'; for (const o of [-3.55, 3.55]) g.fillRect(px(o) - lw(0.075), 0, lw(0.15), H);
  g.fillStyle = '#45474a'; g.fillRect(0, 0, 2, H); g.fillRect(W - 2, 0, 2, H); // 邊上那一格是柏油（主線旁邊那段照它延伸）
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer && renderer.capabilities ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  return t;
}

return { VD_PATH, VD_LOT, VD_GAP, VD_TEXT, VD_REST, vdNear, vdInLot, vdEndDist, inRest, buildViaduct };
})();
