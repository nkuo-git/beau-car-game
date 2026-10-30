// GC8 的高細節車身（第 49 批）：用剖面曲線拉出平滑的車身（loft），挖窗、輪拱、大燈、水箱罩；門縫用法線貼圖；細節、輪子、車內另外做
// 只在烘焙的時候用（node gc8-bake.mjs → body-gc8-q.glb；輕量車再用 make-lod.mjs 做）；遊戲裡不跑這個檔（太慢：一台約 9 秒、825 個 draw call）
// window.__CAR2.build(THREE, opt) → { group, info }；車子座標跟遊戲一樣：x 往車頭、y 往上、z 往右，腳底 y=0
//   opt.bake：烘焙用：漆面貼圖只有門縫（白底、2048×1024、沒有亮片）、沒有車內、沒有輪子（遊戲用自己的車內 cabin.js、輪子 parts.js）
//   每個材質的 userData.slot＝烘焙時併到哪一組（paint、glass、trim、dark、bright、smoke、reflector、frost、bulb、lens、amber、tail、net、netF、mirror；interior 不要）
window.__CAR2 = (() => {
const PI = Math.PI;
let rs = 4242; const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
// ---- 剖面：每一站 14 個點 (z, y)，從底盤中線 → 側裙 → 車門 → 腰線(7) → 玻璃／引擎蓋 → 雨槽(10) → 車頂中線 ----
// 擋風玻璃那幾站：腰線以下跟車頂那站一樣；上面那半（8–13）從前圍（COWL）混到車頂前緣（0.25 站），混的比例照中線高度
const ROOF0 = [[0, 0.15], [0.70, 0.15], [0.82, 0.19], [0.845, 0.30], [0.855, 0.45], [0.852, 0.62], [0.835, 0.78], [0.79, 0.93], [0.755, 0.968], [0.70, 1.14], [0.632, 1.325], [0.48, 1.37], [0.25, 1.383], [0, 1.386]];
const COWL = [[0, 0.15], [0.70, 0.15], [0.82, 0.19], [0.845, 0.29], [0.856, 0.45], [0.852, 0.62], [0.835, 0.77], [0.80, 0.885], [0.755, 0.912], [0.70, 0.918], [0.60, 0.922], [0.42, 0.925], [0.21, 0.926], [0, 0.926]];
const WS_X0 = 0.84, WS_X1 = 0.27; // 擋風玻璃中線：下緣 x、上緣 x
const WS = (x) => { const t = (WS_X0 - x) / (WS_X0 - WS_X1), h = COWL[13][1] + t * (ROOF0[13][1] - COWL[13][1]) + 0.05 * t * (1 - t), f = (h - COWL[13][1]) / (ROOF0[13][1] - COWL[13][1]);
  return ROOF0.map((p, k) => k < 8 ? p.slice() : [COWL[k][0] + f * (p[0] - COWL[k][0]), COWL[k][1] + f * (p[1] - COWL[k][1])]); };
const ST = [
  [-2.11, [[0, 0.28], [0.40, 0.28], [0.60, 0.29], [0.70, 0.33], [0.73, 0.40], [0.72, 0.47], [0.68, 0.52], [0.60, 0.545], [0.50, 0.55], [0.40, 0.55], [0.30, 0.55], [0.20, 0.55], [0.10, 0.55], [0, 0.55]]],
  [-2.07, [[0, 0.235], [0.55, 0.235], [0.70, 0.25], [0.76, 0.31], [0.78, 0.40], [0.775, 0.49], [0.75, 0.55], [0.70, 0.58], [0.60, 0.60], [0.46, 0.61], [0.34, 0.615], [0.22, 0.617], [0.11, 0.617], [0, 0.617]]],
  [-2.03, [[0, 0.22], [0.58, 0.22], [0.72, 0.25], [0.77, 0.31], [0.79, 0.42], [0.785, 0.55], [0.775, 0.66], [0.75, 0.78], [0.70, 0.86], [0.58, 0.885], [0.44, 0.89], [0.30, 0.892], [0.15, 0.893], [0, 0.893]]],
  [-1.95, [[0, 0.19], [0.64, 0.19], [0.78, 0.22], [0.815, 0.30], [0.83, 0.42], [0.825, 0.56], [0.81, 0.70], [0.78, 0.84], [0.72, 0.88], [0.58, 0.895], [0.44, 0.90], [0.30, 0.90], [0.15, 0.90], [0, 0.90]]],
  [-1.70, [[0, 0.17], [0.68, 0.17], [0.80, 0.21], [0.83, 0.30], [0.845, 0.45], [0.84, 0.62], [0.825, 0.78], [0.79, 0.90], [0.74, 0.925], [0.60, 0.93], [0.45, 0.933], [0.30, 0.935], [0.15, 0.935], [0, 0.935]]],
  [-1.45, [[0, 0.16], [0.70, 0.16], [0.82, 0.20], [0.845, 0.30], [0.855, 0.45], [0.852, 0.62], [0.835, 0.78], [0.79, 0.92], [0.745, 0.945], [0.60, 0.95], [0.45, 0.953], [0.30, 0.955], [0.15, 0.955], [0, 0.955]]],
  [-1.20, [[0, 0.15], [0.70, 0.15], [0.82, 0.19], [0.845, 0.30], [0.855, 0.45], [0.852, 0.62], [0.835, 0.78], [0.795, 0.94], [0.75, 0.975], [0.70, 1.07], [0.62, 1.16], [0.45, 1.19], [0.22, 1.197], [0, 1.198]]],
  [-0.95, [[0, 0.15], [0.70, 0.15], [0.82, 0.19], [0.845, 0.30], [0.855, 0.45], [0.852, 0.62], [0.835, 0.78], [0.79, 0.935], [0.75, 0.97], [0.70, 1.14], [0.62, 1.32], [0.47, 1.365], [0.24, 1.383], [0, 1.387]]],
  [-0.45, [[0, 0.15], [0.70, 0.15], [0.82, 0.19], [0.845, 0.30], [0.855, 0.45], [0.852, 0.62], [0.835, 0.78], [0.79, 0.93], [0.755, 0.97], [0.70, 1.15], [0.63, 1.34], [0.48, 1.385], [0.25, 1.40], [0, 1.405]]],
  [0.00, [[0, 0.15], [0.70, 0.15], [0.82, 0.19], [0.845, 0.30], [0.855, 0.45], [0.852, 0.62], [0.835, 0.78], [0.79, 0.93], [0.755, 0.97], [0.70, 1.15], [0.63, 1.34], [0.48, 1.38], [0.25, 1.392], [0, 1.395]]],
  [0.25, [[0, 0.15], [0.70, 0.15], [0.82, 0.19], [0.845, 0.30], [0.855, 0.45], [0.852, 0.62], [0.835, 0.78], [0.79, 0.93], [0.755, 0.968], [0.70, 1.14], [0.632, 1.325], [0.48, 1.37], [0.25, 1.383], [0, 1.386]]], // 車頂前緣（擋風玻璃上緣）：照片量的，比以前前面 12 公分
  [0.40, WS(0.40)], [0.65, WS(0.65)], // 擋風玻璃：車頂 → 前圍，照一條微凸的線（WS）
  [0.86, COWL], // 前圍（擋風玻璃下緣）
  [1.20, [[0, 0.15], [0.70, 0.15], [0.82, 0.19], [0.845, 0.29], [0.856, 0.45], [0.852, 0.62], [0.835, 0.75], [0.80, 0.815], [0.75, 0.835], [0.62, 0.852], [0.47, 0.862], [0.32, 0.868], [0.16, 0.871], [0, 0.872]]], // 引擎蓋中間鼓起來、兩邊葉子板低一點（照片：遠邊的葉子板比以前低 5 公分）
  [1.60, [[0, 0.15], [0.69, 0.15], [0.81, 0.19], [0.835, 0.29], [0.845, 0.45], [0.842, 0.60], [0.828, 0.70], [0.795, 0.765], [0.74, 0.786], [0.60, 0.805], [0.45, 0.815], [0.30, 0.821], [0.15, 0.824], [0, 0.825]]],
  [1.90, [[0, 0.17], [0.66, 0.17], [0.78, 0.20], [0.815, 0.29], [0.828, 0.43], [0.825, 0.56], [0.815, 0.665], [0.795, 0.738], [0.745, 0.762], [0.60, 0.779], [0.45, 0.788], [0.30, 0.793], [0.15, 0.796], [0, 0.797]]],
  [2.03, [[0, 0.19], [0.63, 0.19], [0.75, 0.22], [0.795, 0.29], [0.812, 0.42], [0.808, 0.55], [0.80, 0.645], [0.785, 0.715], [0.735, 0.748], [0.59, 0.768], [0.45, 0.778], [0.30, 0.783], [0.15, 0.785], [0, 0.786]]],
  [2.09, [[0, 0.20], [0.64, 0.20], [0.75, 0.23], [0.79, 0.29], [0.805, 0.42], [0.80, 0.54], [0.79, 0.63], [0.77, 0.715], [0.725, 0.745], [0.58, 0.760], [0.44, 0.767], [0.29, 0.771], [0.14, 0.773], [0, 0.774]]], // 引擎蓋前緣：車頭是鈍的（照片：車頭比以前高 6～13 公分）
  [2.13, [[0, 0.21], [0.65, 0.21], [0.75, 0.24], [0.785, 0.30], [0.80, 0.41], [0.795, 0.52], [0.78, 0.61], [0.755, 0.685], [0.705, 0.718], [0.57, 0.733], [0.43, 0.740], [0.29, 0.743], [0.14, 0.745], [0, 0.745]]], // 臉：大燈、水箱罩這一片幾乎是直的
  [2.16, [[0, 0.22], [0.64, 0.22], [0.73, 0.25], [0.765, 0.30], [0.78, 0.40], [0.775, 0.49], [0.755, 0.56], [0.72, 0.60], [0.66, 0.625], [0.54, 0.640], [0.40, 0.648], [0.27, 0.652], [0.13, 0.654], [0, 0.654]]],
  [2.19, [[0, 0.235], [0.62, 0.235], [0.70, 0.26], [0.735, 0.30], [0.75, 0.39], [0.745, 0.47], [0.72, 0.525], [0.67, 0.552], [0.57, 0.562], [0.45, 0.566], [0.32, 0.568], [0.19, 0.569], [0.09, 0.569], [0, 0.569]]], // 保桿上面的平台
  [2.215, [[0, 0.25], [0.58, 0.25], [0.66, 0.27], [0.70, 0.31], [0.715, 0.38], [0.71, 0.45], [0.685, 0.50], [0.63, 0.53], [0.52, 0.542], [0.40, 0.546], [0.28, 0.548], [0.17, 0.548], [0.08, 0.547], [0, 0.547]]],
  [2.235, [[0, 0.27], [0.52, 0.27], [0.58, 0.285], [0.615, 0.31], [0.63, 0.37], [0.625, 0.43], [0.60, 0.47], [0.55, 0.495], [0.45, 0.51], [0.34, 0.517], [0.24, 0.52], [0.15, 0.52], [0.07, 0.52], [0, 0.52]]], // 保桿正面：比以前寬（照片：保桿正面平的那片很寬，角比較小）；下面用 Shape 封起來，進氣口、霧燈蓋挖在這片上
];
const NP = 14, KINKS = [7, 10]; // 腰線、雨槽：剖面在這裡有稜線
const XF = 1.28, XR = -1.24, RW = 0.312, TRACK = 0.735, TW = 0.215, RIM = 0.216; // 照片：17 吋輪框、輪胎外面跟車身齊
// ---- 曲線 ----
// Hermite（Catmull-Rom 切線、不等距）：xs 遞增，回傳 f(x)
function hermite(xs, ys) {
  const n = xs.length, m = new Array(n);
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); m[i] = (ys[b] - ys[a]) / (xs[b] - xs[a]); }
  return (x) => { if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1]; let i = 0; while (xs[i + 1] < x) i++; const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]; };
}
// 剖面：Catmull-Rom，稜線（腰線 7、雨槽 10）可以切開（尖）或不切（圓），w7、w10 = 0..1 混合
function crCurve(P, kinks) {
  const segs = []; let s0 = 0; for (const k of kinks.concat([NP - 1])) { segs.push([s0, k]); s0 = k; }
  const ev = (a, b, t) => { // a..b 這段，t 在 [a, b]
    const i = Math.min(b - 1, Math.max(a, Math.floor(t))), u = t - i, p0 = P[Math.max(a, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(b, i + 2)];
    const cr = (c) => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u * u + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u * u * u);
    return [cr(0), cr(1)]; };
  return (t) => { for (const [a, b] of segs) if (t <= b + 1e-9) return ev(a, b, Math.max(a, t)); return P[NP - 1]; };
}
function profileCurve(P, w7 = 1, w10 = 1) {
  const c0 = crCurve(P, []), c7 = crCurve(P, [KINKS[0]]), c10 = crCurve(P, [KINKS[1]]);
  return (t) => { const a = c0(t), b = c7(t), c = c10(t); return [a[0] + w7 * (b[0] - a[0]) + w10 * (c[0] - a[0]), a[1] + w7 * (b[1] - a[1]) + w10 * (c[1] - a[1])]; };
}
const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const kinkW7 = (x) => 0.35 + 0.65 * Math.min(ramp(x, -1.80, -1.50), 1 - ramp(x, 0.80, 1.10)); // 腰線：車門那段最尖，前後比較圓
const kinkW10 = (x) => Math.min(ramp(x, -1.60, -1.40), 1 - ramp(x, 0.65, 0.85)); // 雨槽：只有車頂那段
// ---- 車身格子 ----
function loft(dx = 0.015, M = 160) {
  const xs = ST.map((s) => s[0]), longi = []; // 每個點沿 x 的曲線
  for (let k = 0; k < NP; k++) longi.push([hermite(xs, ST.map((s) => s[1][k][0])), hermite(xs, ST.map((s) => s[1][k][1]))]);
  const X = []; for (let x = xs[0]; x < xs[xs.length - 1] - 1e-6; x += (x > 1.99 || x < -1.99) ? dx / 3 : dx) X.push(x); X.push(xs[xs.length - 1]); // 車頭車尾比較密
  // B 柱那段再密 3 倍（細的柱子兩邊都要有格子點）；原本的站不動。貼圖的 u 照原本的站算（加的站在中間），漆的貼圖跟以前一樣：
  // u 照站的號碼的話這段的貼圖會被擠 3 倍，烘焙簡化以後大三角形跨過去，門縫、門把的線變成鋸齒
  const VI = X.map((x, k) => k), nV = X.length;
  for (let k = X.length - 2; k >= 0; k--) if (X[k] > -0.60 && X[k + 1] < -0.38) { X.splice(k + 1, 0, X[k] + (X[k + 1] - X[k]) / 3, X[k] + (2 * (X[k + 1] - X[k])) / 3); VI.splice(k + 1, 0, VI[k] + 1 / 3, VI[k] + 2 / 3); }
  const U = VI.map((k) => k / (nV - 1));
  const G = []; // G[i][j] = { x, y, z, idx }
  for (const x of X) {
    const P = longi.map(([fz, fy]) => [fz(x), fy(x)]), f = profileCurve(P, kinkW7(x), kinkW10(x)), S = 600, pts = [], len = [0];
    for (let s = 0; s <= S; s++) { const t = (s / S) * (NP - 1), [z, y] = f(t); pts.push([z, y, t]); if (s) len.push(len[s - 1] + Math.hypot(z - pts[s - 1][0], y - pts[s - 1][1])); }
    const L = len[S], row = []; let s = 0;
    for (let j = 0; j < M; j++) { const d = (j / (M - 1)) * L; while (s < S - 1 && len[s + 1] < d) s++; const u = len[s + 1] > len[s] ? (d - len[s]) / (len[s + 1] - len[s]) : 0; const a = pts[s], b = pts[s + 1];
      row.push({ x, y: a[1] + (b[1] - a[1]) * u, z: a[0] + (b[0] - a[0]) * u, idx: a[2] + (b[2] - a[2]) * u }); }
    row[0].z = 0; row[M - 1].z = 0; G.push(row);
  }
  return { G, X, M, U };
}
// ---- 區域（材質）----
// A 柱（v63，Nick「a柱稍微改明顯一點 不用太多」）：側窗前緣往後 5 公分、擋風玻璃兩邊窄 1 公分 → 中間一條約 4～5 公分的車身色（加兩邊黑膠條）；以前兩塊玻璃連在一起，看不到柱子
// B 柱（v65，Nick「加上b柱 要比a柱更細一點」）：照片上是黑色細細的一條、上面往前斜；側窗在這裡斷開 2.4 公分（整條黑的）＋兩邊玻璃的黑邊各 3 公釐 ≈ 3 公分（A 柱約 7 公分）
const xA = (y) => 0.75 - (y - 0.95) * 1.35, xC = (y) => -1.24 + (y - 0.95) * 0.55, xB = (y) => -0.50 + (y - 0.95) * 0.12, BW = 0.012;
const inWin = (v) => v.idx > 7.55 && v.idx < 10.3 && v.y > 0.955 && v.z > 0.55;
const sideGlass = (v) => inWin(v) && v.x < xA(v.y) && v.x > xC(v.y) && Math.abs(v.x - xB(v.y)) > BW;
const bPillar = (v) => inWin(v) && Math.abs(v.x - xB(v.y)) <= BW;
const windGlass = (v) => v.idx > 7.6 && v.x > 0.29 + 0.05 * (v.z / 0.6) ** 2 && v.x < 0.82 - 0.06 * (v.z / 0.7) ** 2 && v.z < 0.65 - (0.82 - v.x) * 0.09;
const rearGlass = (v) => v.idx > 7.6 && v.x > -1.48 + 0.05 * (v.z / 0.6) ** 2 && v.x < -1.02 - 0.05 * (v.z / 0.6) ** 2 && v.z < 0.58 + (-1.02 - v.x) * 0.1;
const isGlass = (v) => sideGlass(v) || windGlass(v) || rearGlass(v);
const HEAD = [[0.30, 0.724], [0.46, 0.729], [0.62, 0.730], [0.735, 0.725], [0.778, 0.71], [0.795, 0.684], [0.80, 0.64], [0.79, 0.606], [0.76, 0.594], [0.60, 0.592], [0.385, 0.595], [0.36, 0.606], [0.33, 0.664]]; // 大燈（照片）：梯形，上緣直直的貼著引擎蓋，裡面那頭斜斜的（上面靠水箱罩、下面往外），外面那頭圓圓的包到側面
const TURN = [[0.632, 0.495], [0.722, 0.49], [0.75, 0.475], [0.752, 0.432], [0.728, 0.42], [0.632, 0.422]]; // 保桿角上的橘色方向燈（照片：霧燈蓋外面、上半那麼高）
const DUCT = [[0.642, 0.392], [0.728, 0.388], [0.748, 0.376], [0.748, 0.346], [0.725, 0.336], [0.642, 0.338]]; // 方向燈下面一格一格的導風口
const FOG = [[0.39, 0.45], [0.56, 0.45], [0.585, 0.43], [0.585, 0.33], [0.56, 0.305], [0.39, 0.305], [0.37, 0.325], [0.37, 0.43]]; // 霧燈的蓋板（圓角長方形，車身色）：在保桿正面那片上，進氣口兩邊
const TAIL = [[0.44, 0.81], [0.62, 0.81], [0.78, 0.80], [0.82, 0.77], [0.83, 0.70], [0.82, 0.645], [0.79, 0.63], [0.60, 0.63], [0.45, 0.635], [0.43, 0.66], [0.43, 0.78]]; // 尾燈：橫的長方形（上紅、下白＋橘）
const GRILLE = [[0.0, 0.716], [0.262, 0.714], [0.288, 0.70], [0.31, 0.655], [0.322, 0.627], [0.302, 0.610], [0.0, 0.610]]; // 水箱罩（照片）：兩個大燈中間，外面那頭跟著大燈裡面那頭斜（上寬下窄），差不多大燈 3/4 高
const MOUTH = [[0.0, 0.475], [0.31, 0.475], [0.335, 0.46], [0.335, 0.33], [0.315, 0.30], [0.0, 0.30]]; // 保桿正面中間的大開口（車牌在裡面；右半邊；要在最後一站的輪廓裡面）
const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const nearPoly = (P, x, y) => { let best = null, bd = 1e9; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy || 1e-9; let t = ((x - a[0]) * vx + (y - a[1]) * vy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const px = a[0] + vx * t, py = a[1] + vy * t, d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; best = [px, py]; } } return best; };
const ARCH_R = 0.35; // 輪胎上面的縫約 4 公分（照片）
// 要挖掉的洞：回傳 { cut(v) 在洞裡?, snap(v) 把邊上的點推到洞的邊 }
const HOLES = [
  { name: 'archF', cut: (v) => v.z > 0.55 && v.idx > 1.4 && v.idx < 7.4 && Math.hypot(v.x - XF, v.y - RW) < ARCH_R, snap: (v) => { const a = Math.atan2(v.y - RW, v.x - XF); v.x = XF + ARCH_R * Math.cos(a); v.y = RW + ARCH_R * Math.sin(a); } },
  { name: 'archR', cut: (v) => v.z > 0.55 && v.idx > 1.4 && v.idx < 7.4 && Math.hypot(v.x - XR, v.y - RW) < ARCH_R, snap: (v) => { const a = Math.atan2(v.y - RW, v.x - XR); v.x = XR + ARCH_R * Math.cos(a); v.y = RW + ARCH_R * Math.sin(a); } },
  { name: 'head', cut: (v) => v.x > 1.98 && inPoly(HEAD, v.z, v.y), snap: (v) => { const p = nearPoly(HEAD, v.z, v.y); v.z = p[0]; v.y = p[1]; } },
  { name: 'tail', cut: (v) => v.x < -1.95 && inPoly(TAIL, v.z, v.y), snap: (v) => { const p = nearPoly(TAIL, v.z, v.y); v.z = p[0]; v.y = p[1]; } },
  { name: 'grille', cut: (v) => v.x > 2.01 && inPoly(GRILLE, Math.max(v.z, 0.002), v.y), snap: (v) => { const p = nearPoly(GRILLE, v.z, v.y); v.z = Math.max(0, p[0]); v.y = p[1]; } },
  { name: 'fog', cut: () => false, snap: () => {} }, // 霧燈蓋現在挖在保桿正面那片（Shape）上，不在車身格子上
  { name: 'turn', cut: (v) => v.x > 2.10 && v.idx < 7.5 && inPoly(TURN, v.z, v.y), snap: (v) => { const p = nearPoly(TURN, v.z, v.y); v.z = p[0]; v.y = p[1]; } },
  { name: 'duct', cut: (v) => v.x > 2.10 && v.idx < 7.5 && inPoly(DUCT, v.z, v.y), snap: (v) => { const p = nearPoly(DUCT, v.z, v.y); v.z = p[0]; v.y = p[1]; } },
];
// 一圈（z, y）每一段切到不超過 h 公尺（彎成圓弧的時候邊才會跟著彎）
const dens = (P, h) => { const out = []; for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / h)); for (let s = 0; s < n; s++) out.push([a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n]); } return out; };
// ---- 貼圖（門縫、亮片）----
const SEAMS_SIDE = [ // (x, y)，只在側面（z > 0.5）
  [[0.70, 0.935], [0.80, 0.84], [0.832, 0.78], [0.83, 0.64], [0.824, 0.53], [0.834, 0.40], [0.84, 0.30]],
  [[-0.50, 0.945], [-0.505, 0.84], [-0.52, 0.728], [-0.53, 0.558], [-0.52, 0.38], [-0.50, 0.30]],
  [[-0.50, 0.30], [0.84, 0.29]],
  [[-1.76, 0.58], [-1.75, 0.45], [-1.72, 0.28]], [[-1.76, 0.58], [-2.0, 0.578]],
  [[1.73, 0.56], [1.75, 0.40], [1.71, 0.24]], [[1.73, 0.555], [2.3, 0.55]],
  [[-1.60, 0.71], [-1.42, 0.71], [-1.42, 0.84], [-1.60, 0.84], [-1.60, 0.71]],
  [[-0.45, 0.775], [-0.27, 0.775], [-0.27, 0.825], [-0.45, 0.825], [-0.45, 0.775]],
];
const SEAMS_TOP = [ // (x, z)，只在上面（y > 0.74、z < 0.82）
  [[0.90, 0], [0.90, 0.5], [0.94, 0.74]], [[0.94, 0.74], [1.30, 0.755], [1.70, 0.75], [1.98, 0.735], [2.08, 0.70], [2.118, 0.58], [2.128, 0.40], [2.132, 0]], // 引擎蓋前緣：貼著大燈、水箱罩的上緣（照片）
  [[-1.52, 0], [-1.52, 0.55], [-1.56, 0.70]], [[-1.56, 0.70], [-1.78, 0.72], [-2.0, 0.705]], // 行李廂蓋：兩邊的縫到後緣就轉下去（後面那段在 SEAMS_REAR）
];
const SEAMS_REAR = [ // (z, y)，只在車尾（x < −2.0）：行李廂蓋兩邊往下到尾燈上面、保桿上緣一條橫的
  [[0.705, 0.895], [0.66, 0.812]], [[0, 0.603], [0.45, 0.598], [0.62, 0.59], [0.72, 0.582], [0.86, 0.578]],
];
const dseg = (px, py, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy || 1e-9; let t = ((px - a[0]) * vx + (py - a[1]) * vy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(px - a[0] - vx * t, py - a[1] - vy * t); };
const dpoly = (L, px, py) => { let d = 1e9; for (let i = 1; i < L.length; i++) d = Math.min(d, dseg(px, py, L[i - 1], L[i])); return d; };
// 平面上一圈（可以有洞）切成小三角形：裡面撒格子點（earcut 的單點洞＝Steiner 點），彎成圓弧以後還是平滑的
// outer、holes：[[a, b]…]（最後一點不要重複第一點）；回傳 { P: [[a, b]…]（outer、holes、格子點照順序）, T: [[i, j, k]…] }
const steinerTri = (THREE, outer0, holes0, step) => {
  const cl = (L) => (L.length > 2 && Math.abs(L[0][0] - L[L.length - 1][0]) < 1e-9 && Math.abs(L[0][1] - L[L.length - 1][1]) < 1e-9 ? L.slice(0, -1) : L), outer = cl(outer0), holes = holes0.map(cl);
  const loops = [outer, ...holes]; let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
  for (const [a, b] of outer) { a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
  const near = (a, b) => loops.some((L) => L.some((p, k) => dseg(a, b, p, L[(k + 1) % L.length]) < step * 0.45)), st = [];
  for (let r = 0, b = b0 + step / 2; b < b1; b += step * 0.866, r++) for (let a = a0 + step / 2 + (r % 2) * step * 0.5; a < a1; a += step) if (inPoly(outer, a, b) && !holes.some((h) => inPoly(h, a, b)) && !near(a, b)) st.push([a, b]); // 格子點一排錯開半格（三角形比較胖）
  // 切的時候每一點錯開一點點（±0.01 公釐，固定的亂數）：earcut 不會把一直線上的點丟掉（彎了以後邊才跟著彎）；翻邊的時候沒有三點共線（共線的地方翻不動，會留下一排一排扁長的扇形）
  const P = outer.concat(...holes, st), J = P.map(([a, b], i) => { const h = Math.sin(i * 12.9898 + 1.7) * 43758.5453, g = Math.sin(i * 78.233 + 0.3) * 24634.6345; return [a + (h - Math.floor(h) - 0.5) * 2e-5, b + (g - Math.floor(g) - 0.5) * 2e-5]; });
  const V = (k0, len) => J.slice(k0, k0 + len).map(([a, b]) => new THREE.Vector2(a, b)), HV = []; let o = outer.length;
  for (const h of holes) { HV.push(V(o, h.length)); o += h.length; }
  for (let k = 0; k < st.length; k++) HV.push(V(o + k, 1));
  return { P, T: lawson(J, THREE.ShapeUtils.triangulateShape(V(0, outer.length), HV), loops), n: outer.length };
};
// 切好的三角形翻邊（Lawson，外圈、洞的邊不動）：earcut 加格子點會切出一排三點共線的扁三角形，平的時候看不到；
// 車尾彎成圓弧、保桿鼓起來以後，它們變成一條一條朝上朝下的橫條（後保桿上的亮線）。共線的翻掉最長邊，其他的翻成 Delaunay（最胖）
const lawson = (P, T0, loops) => {
  const n = P.length, fixed = new Set(), key = (a, b) => (a < b ? a * n + b : b * n + a);
  let o = 0; for (const L of loops) { for (let k = 0; k < L.length; k++) fixed.add(key(o + k, o + ((k + 1) % L.length))); o += L.length; }
  const cr = (a, b, c) => (P[b][0] - P[a][0]) * (P[c][1] - P[a][1]) - (P[b][1] - P[a][1]) * (P[c][0] - P[a][0]);
  const d2 = (a, b) => (P[a][0] - P[b][0]) ** 2 + (P[a][1] - P[b][1]) ** 2;
  const ccw = (t) => { if (cr(t[0], t[1], t[2]) < 0) { const s = t[1]; t[1] = t[2]; t[2] = s; } return t; };
  const flat = (t) => Math.abs(cr(t[0], t[1], t[2])) < 1e-10 * Math.max(d2(t[0], t[1]), d2(t[1], t[2]), d2(t[2], t[0]));
  const longest = (t, u, v) => { const l = d2(u, v); return l >= d2(t[0], t[1]) && l >= d2(t[1], t[2]) && l >= d2(t[2], t[0]); };
  const inC = (a, b, c, d) => { const ax = P[a][0] - P[d][0], ay = P[a][1] - P[d][1], bx = P[b][0] - P[d][0], by = P[b][1] - P[d][1], cx = P[c][0] - P[d][0], cy = P[c][1] - P[d][1];
    return (ax * ax + ay * ay) * (bx * cy - cx * by) - (bx * bx + by * by) * (ax * cy - cx * ay) + (cx * cx + cy * cy) * (ax * by - bx * ay); };
  const T = T0.map((t) => ccw(t.slice()));
  for (let pass = 0; pass < 200; pass++) {
    const E = new Map(), busy = new Uint8Array(T.length); let flips = 0;
    T.forEach((t, i) => { for (let k = 0; k < 3; k++) { const kk = key(t[k], t[(k + 1) % 3]), e = E.get(kk); if (e) e.push(i); else E.set(kk, [i]); } });
    for (const [kk, e] of E) {
      if (e.length !== 2 || fixed.has(kk) || busy[e[0]] || busy[e[1]]) continue;
      const t1 = T[e[0]], t2 = T[e[1]], u = Math.floor(kk / n), v = kk % n, p = t1.find((x) => x !== u && x !== v), q = t2.find((x) => x !== u && x !== v);
      if (p === q) continue;
      const f1 = flat(t1), f2 = flat(t2);
      if (!(f1 || f2 ? (f1 && longest(t1, u, v)) || (f2 && longest(t2, u, v)) : inC(t1[0], t1[1], t1[2], q) > 1e-14)) continue;
      if (!(cr(p, q, u) * cr(p, q, v) < 0)) continue; // 四邊形要是凸的
      const n1 = ccw([p, u, q]), n2 = ccw([q, v, p]);
      if (flat(n1) || flat(n2)) continue;
      T[e[0]] = n1; T[e[1]] = n2; busy[e[0]] = busy[e[1]] = 1; flips++;
    }
    if (!flips) break;
  }
  return T;
};
function paintMaps(THREE, G, X, U, M, color, bake = false) { // bake：白底（顏色交給材質的 color）、2048×1024、沒有亮片、沒有粗糙度圖；U：每一站的貼圖 u
  const W = bake ? 2048 : 4096, H = bake ? 1024 : 2048, nx = X.length;
  const CI = new Int32Array(W), CU = new Float32Array(W); for (let u = 0, i = 0; u < W; u++) { const t = u / (W - 1); while (i < nx - 2 && U[i + 1] <= t) i++; CI[u] = i; CU[u] = Math.min(1, (t - U[i]) / (U[i + 1] - U[i])); } // 貼圖的每一行在哪兩站中間
  const alb = document.createElement('canvas'), nrm = document.createElement('canvas'), rgh = document.createElement('canvas');
  alb.width = nrm.width = rgh.width = W; alb.height = nrm.height = rgh.height = H;
  const ga = alb.getContext('2d'), gn = nrm.getContext('2d'), gr = rgh.getContext('2d');
  const IA = ga.createImageData(W, H), IN = gn.createImageData(W, H), IR = gr.createImageData(W, H), A = IA.data, N = IN.data, R = IR.data;
  const hgt = new Float32Array(W * H), c = bake ? new THREE.Color(1, 1, 1) : new THREE.Color(color).convertLinearToSRGB(); // 縫的高度（0 平、1 凹）；貼圖是 sRGB，要寫 sRGB 的數字（以前寫成線性的值，藍色太深太紫）
  const px = [], py = [], pz = [];
  for (let v = 0; v < H; v++) { const fj = (v / (H - 1)) * (M - 1), j = Math.min(M - 2, Math.floor(fj)), uj = fj - j;
    for (let u = 0; u < W; u++) { const i = CI[u], ui = CU[u];
      const a = G[i][j], b = G[i + 1][j], cc = G[i][j + 1], d = G[i + 1][j + 1], o = v * W + u;
      px[o] = (a.x * (1 - ui) + b.x * ui) * (1 - uj) + (cc.x * (1 - ui) + d.x * ui) * uj; py[o] = (a.y * (1 - ui) + b.y * ui) * (1 - uj) + (cc.y * (1 - ui) + d.y * ui) * uj; pz[o] = (a.z * (1 - ui) + b.z * ui) * (1 - uj) + (cc.z * (1 - ui) + d.z * ui) * uj; } }
  // 第 55 批（Nick「縫隙有點太明顯 修飾的細一點 少一點鋸齒」）：縫 3.4 公釐（以前 8 公釐＋1.5 公釐的斜邊，一格一格的硬邊），兩邊各 2.5 公釐的圓角；
  // 縫附近的格子切 5×5 個點算（反鋸齒）：顏色＝蓋到縫的比例，法線＝圓角斜度的平均（照真的方向：縫的邊往縫裡面彎）
  const SW = 0.0017, BV = 0.0025, NS = 5, FP = 1.25, KN = 0.8, D = new Float32Array(W * H);
  for (let o = 0; o < W * H; o++) { const x = px[o], y = py[o], z = pz[o]; let d = 1e9;
    if (z > 0.5) for (const L of SEAMS_SIDE) d = Math.min(d, dpoly(L, x, y));
    if (y > 0.728 && z < 0.82 && x > -2.0) for (const L of SEAMS_TOP) d = Math.min(d, dpoly(L, x, z));
    if (x < -2.0) for (const L of SEAMS_REAR) d = Math.min(d, dpoly(L, z, y));
    D[o] = d; }
  // 最近的縫：距離＋離開縫的方向（世界座標）；三個投影面：側面 (x, y)、上面 (x, z)、車尾 (z, y)
  const SR = { d: 0, gx: 0, gy: 0, gz: 0 };
  const segN = (L, a0, b0, ia, ib) => { for (let i = 1; i < L.length; i++) { const a = L[i - 1], b = L[i], vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy || 1e-9; let t = ((a0 - a[0]) * vx + (b0 - a[1]) * vy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const e0 = a0 - a[0] - vx * t, e1 = b0 - a[1] - vy * t, d = Math.hypot(e0, e1); if (d < SR.d) { SR.d = d; const q = d > 1e-9 ? 1 / d : 0; SR.gx = SR.gy = SR.gz = 0; SR[ia] = e0 * q; SR[ib] = e1 * q; } } };
  const seamAt = (x, y, z) => { SR.d = 1e9; SR.gx = SR.gy = SR.gz = 0;
    if (z > 0.5) for (const L of SEAMS_SIDE) segN(L, x, y, 'gx', 'gy');
    if (y > 0.728 && z < 0.82 && x > -2.0) for (const L of SEAMS_TOP) segN(L, x, z, 'gx', 'gz');
    if (x < -2.0) for (const L of SEAMS_REAR) segN(L, z, y, 'gz', 'gy');
    return SR; };
  const SUB = []; for (let k = 0; k < NS; k++) SUB.push(((k + 0.5) / NS - 0.5) * FP);
  const near = SW + BV + 0.008; // 這麼近才切小點算（一格最大約 3.3 公釐 × 1.25）
  for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) { const o = v * W + u;
    let nX = 0, nY = 0, dk = 1;
    if (D[o] < near) {
      const u1 = Math.min(W - 1, u + 1), u0 = Math.max(0, u - 1), v1 = Math.min(H - 1, v + 1), v0 = Math.max(0, v - 1), a1 = v * W + u1, a0 = v * W + u0, b1 = v1 * W + u, b0 = v0 * W + u;
      const ux = (px[a1] - px[a0]) / (u1 - u0), uy = (py[a1] - py[a0]) / (u1 - u0), uz = (pz[a1] - pz[a0]) / (u1 - u0), vx = (px[b1] - px[b0]) / (v1 - v0), vy = (py[b1] - py[b0]) / (v1 - v0), vz = (pz[b1] - pz[b0]) / (v1 - v0); // 一格是世界的哪個方向、多長
      const lu = Math.hypot(ux, uy, uz) || 1e-6, lv = Math.hypot(vx, vy, vz) || 1e-6;
      let cov = 0, ao = 0, sx = 0, sy = 0;
      for (const a of SUB) for (const b of SUB) { const r = seamAt(px[o] + a * ux + b * vx, py[o] + a * uy + b * vy, pz[o] + a * uz + b * vz);
        if (r.d < SW) { cov++; continue; }
        if (r.d >= SW + BV) continue;
        const t = (SW + BV - r.d) / BV, m = Math.min(2.5, t / Math.sqrt(Math.max(0.0256, 1 - t * t))); // 圓角：越靠近縫越斜（最斜約 68 度）
        ao += t * t; sx -= (m * (r.gx * ux + r.gy * uy + r.gz * uz)) / lu; sy -= (m * (r.gx * vx + r.gy * vy + r.gz * vz)) / lv; } // 斜度往縫裡面（每公尺）
      const n2 = NS * NS, gu = 1 / (lu * (W - 1)), gv = 1 / (lv * (H - 1)), gm = Math.max(gu, gv); // shader 的切線空間：T＝∇u、B＝∇v，除以比較大的那個
      cov /= n2; ao /= n2; nX = ((KN * sx) / n2) * (gm / gu); nY = ((KN * sy) / n2) * (gm / gv);
      dk = 1 - 0.82 * cov - 0.22 * ao;
      hgt[o] = cov; }
    const fx = bake ? 0 : (rnd() - 0.5) * 0.10, fy = bake ? 0 : (rnd() - 0.5) * 0.10; // 金屬亮片：每個點的法線亂一點點（烘焙的沒有：遊戲的漆面有自己的亮片）
    nX += fx; nY += fy; let nZ = 1; const l = Math.hypot(nX, nY, nZ); nX /= l; nY /= l; nZ /= l;
    N[o * 4] = (nX * 0.5 + 0.5) * 255; N[o * 4 + 1] = (nY * 0.5 + 0.5) * 255; N[o * 4 + 2] = (nZ * 0.5 + 0.5) * 255; N[o * 4 + 3] = 255;
    A[o * 4] = c.r * 255 * dk; A[o * 4 + 1] = c.g * 255 * dk; A[o * 4 + 2] = c.b * 255 * dk; A[o * 4 + 3] = 255;
    const r = 0.30 + 0.5 * hgt[o] + (rnd() - 0.5) * 0.06; R[o * 4] = R[o * 4 + 1] = R[o * 4 + 2] = r * 255; R[o * 4 + 3] = 255; }
  ga.putImageData(IA, 0, 0); gn.putImageData(IN, 0, 0); gr.putImageData(IR, 0, 0);
  const T = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.anisotropy = 16; t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
  return bake ? { map: T(alb, true), normalMap: T(nrm, false) } : { map: T(alb, true), normalMap: T(nrm, false), roughnessMap: T(rgh, false) };
}
// ---- 車牌（第 54 批，Nick「細節做多一點」）：自己編的號碼，白底黑字（台灣的樣子），字、邊、螺絲是凸的；一張高度圖 → 顏色＋法線（前後共用）----
function plateTex(THREE) {
  const W = 512, H = 256, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const hc = mk(), h = hc.getContext('2d'), cc = mk(), c = cc.getContext('2d');
  const TXT = 'BEA-8888', font = 'bold 170px "Liberation Sans", "DejaVu Sans", sans-serif';
  h.font = font; const mt = h.measureText(TXT), sx = Math.min(0.62, 432 / mt.width), cy = H * 0.56 + (mt.actualBoundingBoxAscent - mt.actualBoundingBoxDescent) / 2; // 字寬 432、字的中間在 56% 的高度（上面留螺絲）
  const draw = (g, bg, ink, scr) => {
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.roundRect(13, 13, W - 26, H - 26, 18); g.stroke(); // 壓出來的邊（一圈黑線）
    g.fillStyle = ink; g.font = font; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.save(); g.translate(W / 2, cy); g.scale(sx, 1); g.fillText(TXT, 0, 0); g.restore();
    for (const x of [W * 0.2, W * 0.8]) { g.fillStyle = scr; g.beginPath(); g.arc(x, H * 0.155, 11, 0, 2 * PI); g.fill(); } }; // 上面兩顆螺絲
  draw(h, '#000', '#fff', '#fff');
  const grd = c.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#f1f0eb'); grd.addColorStop(1, '#dddbd3'); // 下面髒一點點
  draw(c, grd, '#151515', '#8d9094');
  for (const x of [W * 0.2, W * 0.8]) { c.strokeStyle = '#3a3c40'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 7, H * 0.155); c.lineTo(x + 7, H * 0.155); c.stroke(); } // 螺絲的一字槽
  const src = (() => { const b = mk(), g = b.getContext('2d'); g.filter = 'blur(1.6px)'; g.drawImage(hc, 0, 0); return g.getImageData(0, 0, W, H).data; })(); // 模糊一點：凸起來的邊是斜的
  const nc = mk(), nx = nc.getContext('2d'), nd = nx.createImageData(W, H), N = nd.data, K = 3.2, hv = (x, y) => src[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4] / 255;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const du = (hv(x + 1, y) - hv(x - 1, y)) * K, dv = (hv(x, y - 1) - hv(x, y + 1)) * K, l = Math.hypot(du, dv, 1), o = (y * W + x) * 4; // flipY：畫布往上＝v 往上
    N[o] = ((-du / l) * 0.5 + 0.5) * 255; N[o + 1] = ((-dv / l) * 0.5 + 0.5) * 255; N[o + 2] = ((1 / l) * 0.5 + 0.5) * 255; N[o + 3] = 255; }
  nx.putImageData(nd, 0, 0);
  const T = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: T(cc, true), normalMap: T(nc, false), roughness: 0.42, metalness: 0.15 }); m.userData.slot = 'plate';
  return m;
}
// 只讓網格朝裡面（三角形反過來、法線反過來）：從管子裡面看得到
function inward(geo) { const I = geo.index.array; for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; } const n = geo.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); return geo; }
// ---- 建材質 ----
function materials(THREE, color) {
  const M = {
    paint: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.0, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.0, normalScale: new THREE.Vector2(1, 1) }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x5f6d75, metalness: 0, roughness: 0.02, transmission: 0.92, ior: 1.5, thickness: 0.004, transparent: true, side: THREE.DoubleSide, envMapIntensity: 1.0 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x121315, roughness: 0.55, metalness: 0.1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.95 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.06, metalness: 1 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xb5b8bc, roughness: 0.3, metalness: 0.9 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.28, metalness: 0.9 }),
    red: new THREE.MeshStandardMaterial({ color: 0xb3121a, roughness: 0.4, metalness: 0.2 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x6d6f73, roughness: 0.45, metalness: 0.85 }),
    lensRed: new THREE.MeshPhysicalMaterial({ color: 0xd0101c, roughness: 0.05, transmission: 0.6, ior: 1.5, thickness: 0.01, transparent: true, side: THREE.DoubleSide }),
    lensAmber: new THREE.MeshPhysicalMaterial({ color: 0xe47c12, roughness: 0.05, transmission: 0.6, ior: 1.5, thickness: 0.01, transparent: true, side: THREE.DoubleSide }),
    lensClear: new THREE.MeshPhysicalMaterial({ color: 0xdce8ef, roughness: 0.04, transmission: 0.82, ior: 1.5, thickness: 0.02, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, side: THREE.DoubleSide }),
    bulb: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 0.6, roughness: 0.3 }),
    smoke: new THREE.MeshPhysicalMaterial({ color: 0x1a1c20, roughness: 0.1, metalness: 0.3, clearcoat: 1 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x1d1e22, roughness: 0.95, envMapIntensity: 0.4 }), // 車裡面：天空的反光弱一點（以前太亮）
    plastic: new THREE.MeshStandardMaterial({ color: 0x232428, roughness: 0.7, envMapIntensity: 0.4 }),
    liner: new THREE.MeshStandardMaterial({ color: 0x8c8a84, roughness: 0.95, envMapIntensity: 0.4 }),
  };
  const SLOT = { paint: 'paint', glass: 'glass', trim: 'trim', rubber: 'dark', dark: 'dark', chrome: 'bright', alu: 'bright', gold: 'bright', red: 'tail', steel: 'bright', lensRed: 'tail', lensAmber: 'amber', lensClear: 'lens', bulb: 'bulb', smoke: 'smoke', cloth: 'interior', plastic: 'interior', liner: 'interior' };
  for (const [k, m] of Object.entries(M)) m.userData.slot = SLOT[k]; // 烘焙時併到哪一組（clone 出來的跟著）
  return M;
}
// ---- 主體 ----
function build(THREE, opt = {}) {
  const t0 = performance.now(), color = opt.color ?? 0x1c3fb0, Mt = materials(THREE, color), plateM = plateTex(THREE), g = new THREE.Group(); g.name = 'car2';
  const paint2 = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04 }); paint2.userData.slot = 'paint'; // 另外加的鈑件（尾翼、後視鏡、進氣口）：沒有車身的貼圖
  const crease = (geo, a = 0.7) => { const B = window.__BGU; return B && B.toCreasedNormals ? B.toCreasedNormals(geo, a) : geo; }; // 擠出來的東西：圓角那邊平滑、真的角還是尖的
  const { G, X, M, U } = loft(opt.dx ?? 0.015, opt.M ?? 160), nx = X.length;
  const topY = (x, z) => { let bi = 0; for (let i = 1; i < nx; i++) if (Math.abs(X[i] - x) < Math.abs(X[bi] - x)) bi = i; let best = null; for (const v of G[bi]) if (v.idx >= 8 && (!best || Math.abs(v.z - z) < Math.abs(best.z - z))) best = v; return best.y; }; // 上面（引擎蓋、車頂）在 (x, z) 的高度
  const nearI = (x) => { let i = 0; for (let k = 1; k < nx; k++) if (Math.abs(X[k] - x) < Math.abs(X[i] - x)) i = k; return i; };
  const rowY = (row, z) => { for (let j = M - 1; j > 0; j--) { const a = row[j], b = row[j - 1]; if (b.idx < 7.5) break; if ((a.z - z) * (b.z - z) <= 0 && a.z !== b.z) return a.y + ((b.y - a.y) * (z - a.z)) / (b.z - a.z); } return null; };
  const hoodY = (x, z) => { z = Math.abs(z); const i = nearI(x), i2 = X[i] > x ? Math.max(0, i - 1) : Math.min(nx - 1, i + 1), a = rowY(G[i], z); const b = i2 === i ? a : rowY(G[i2], z); if (a === null || b === null) return topY(x, z); return i2 === i ? a : a + ((b - a) * (x - X[i])) / (X[i2] - X[i]); }; // 同上，但兩站、兩點之間內插（跟畫出來的面一樣高，貼上去的鈑件才不會浮起來或陷進去）
  const sideZ = (x, y) => { const row = G[nearI(x)]; for (let j = 1; j < M; j++) { const a = row[j - 1], b = row[j]; if (a.idx < 3 || b.idx > 7.5) continue; if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return a.z + ((b.z - a.z) * (y - a.y)) / (b.y - a.y); } return 0.84; }; // 側面在 (x, y) 的 z
  // 玻璃往裡面凹
  for (const row of G) for (const v of row) { v.glass = isGlass(v); v.bp = bPillar(v); }
  const O = G.map((row) => row.map((v) => ({ x: v.x, y: v.y, z: v.z }))); // 原本的格子（B 柱旁邊的玻璃點照這個放）
  // 法線（先用格子算）、玻璃凹進去
  const nrm = (i, j) => { const a = G[Math.max(0, i - 1)][j], b = G[Math.min(nx - 1, i + 1)][j], c = G[i][Math.max(0, j - 1)], d = G[i][Math.min(M - 1, j + 1)];
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = d.x - c.x, vy = d.y - c.y, vz = d.z - c.z; let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const NR = G.map((row, i) => row.map((v, j) => nrm(i, j)));
  // 法線要朝外：檢查中段最寬的點
  { const n = NR[Math.floor(nx / 2)][Math.floor(M * 0.3)]; if (n[2] < 0) for (const row of NR) for (const n of row) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; } }
  // B 柱的上下兩頭：柱子下面（車門）、上面（車頂）的點推到柱子的邊（窗的下緣、上緣），黑色才會剛好停在玻璃黑邊那條線上（旁邊有玻璃的點下面玻璃那一圈會推）
  for (let i = 0; i < nx; i++) for (let j = 0; j < M; j++) { const v = G[i][j]; if (v.glass || v.bp) continue;
    const nb = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < nx && b < M).map(([a, b]) => G[a][b]);
    if (nb.some((w) => w.glass) || !nb.some((w) => w.bp)) continue; let best = null, bd = 1e9;
    for (const w of nb) { if (!w.bp) continue;
      let lo = 0, hi = 1; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2, p = { x: v.x + (w.x - v.x) * m, y: v.y + (w.y - v.y) * m, z: v.z + (w.z - v.z) * m, idx: v.idx + (w.idx - v.idx) * m }; if (bPillar(p)) hi = m; else lo = m; }
      if (lo < bd) { bd = lo; best = { x: v.x + (w.x - v.x) * lo, y: v.y + (w.y - v.y) * lo, z: v.z + (w.z - v.z) * lo, idx: v.idx + (w.idx - v.idx) * lo }; } }
    if (best) { v.x = best.x; v.y = best.y; v.z = best.z; v.idx = best.idx; } }
  // 玻璃邊：不是玻璃、旁邊有玻璃的點，推到玻璃的邊界上（沿著格子線二分），邊才不會鋸齒
  for (let i = 0; i < nx; i++) for (let j = 0; j < M; j++) { const v = G[i][j]; if (v.glass) continue; let best = null, bd = 1e9;
    for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) { if (a < 0 || b < 0 || a >= nx || b >= M) continue; const w = G[a][b]; if (!w.glass) continue;
      let lo = 0, hi = 1; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2, p = { x: v.x + (w.x - v.x) * m, y: v.y + (w.y - v.y) * m, z: v.z + (w.z - v.z) * m, idx: v.idx + (w.idx - v.idx) * m }; if (isGlass(p)) hi = m; else lo = m; }
      if (lo < bd) { bd = lo; best = { x: v.x + (w.x - v.x) * lo, y: v.y + (w.y - v.y) * lo, z: v.z + (w.z - v.z) * lo, idx: v.idx + (w.idx - v.idx) * lo }; } }
    if (best) { v.x = best.x; v.y = best.y; v.z = best.z; v.idx = best.idx; v.edge = true; } }
  // 玻璃邊上的玻璃點：放在邊界往裡面 1.4 公分的地方（黑色膠條一樣寬，不然裡面那條邊是格子的鋸齒）；B 柱兩邊 3 公釐（那裡的格子 5 公釐一站，柱子本身就是黑的）
  const TRIMW = 0.014, TRIMB = 0.003, mv = [], at = (P, Q, m) => ({ x: P.x + (Q.x - P.x) * m, y: P.y + (Q.y - P.y) * m, z: P.z + (Q.z - P.z) * m });
  for (let i = 0; i < nx; i++) for (let j = 0; j < M; j++) { const w = G[i][j]; if (!w.glass) continue; let best = null, bd = 1e9;
    const nb = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < nx && b < M).map(([a, b]) => G[a][b]);
    if (nb.some((v) => v.bp)) { // B 柱旁邊：沿著這一排（原本的格子）放在離柱子中線 BW＋TRIMB 的地方（柱子是斜的，跟著最近的點放的話每隔幾排凸一格，從車裡看像鋸齒）
      const P0 = O[i][j], s = Math.sign(P0.x - xB(P0.y)) || 1, f = (p) => s * (p.x - xB(p.y)) - BW - TRIMB, Pa = O[i - s]?.[j], Pb = O[i + s]?.[j];
      // 柱子的兩頭（窗的上緣、下緣也在旁邊）：先沿著格子線從邊往原本的點放 1.4 公分（跟別的玻璃點一樣），再沿著這一排找柱子那條線
      // （先找柱子的線、再從邊往那裡量的話：原本的點離窗的上緣只有 0.3 公釐，方向幾乎是橫的，點被推到旁邊 1.4 公分，折到隔壁的三角形，從車裡看是亮亮的縫）
      const e = nb.find((v) => !v.glass && v.edge && !v.bp), q = e ? at(e, P0, TRIMW / (Math.hypot(P0.x - e.x, P0.y - e.y, P0.z - e.z) || 1e-6)) : P0;
      if (Pa && Pb) { const A = { x: q.x + 2 * (Pa.x - P0.x), y: q.y + 2 * (Pa.y - P0.y), z: q.z + 2 * (Pa.z - P0.z) }, B = { x: q.x + 2 * (Pb.x - P0.x), y: q.y + 2 * (Pb.y - P0.y), z: q.z + 2 * (Pb.z - P0.z) };
        if (f(A) <= 0 && f(B) > 0) { let lo = 0, hi = 1; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (f(at(A, B, m)) > 0) hi = m; else lo = m; }
          const p = at(A, B, hi); mv.push([w, p.x, p.y, p.z]); continue; } } }
    for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) { if (a < 0 || b < 0 || a >= nx || b >= M) continue; const v = G[a][b]; if (v.glass || !v.edge) continue; const d = Math.hypot(w.x - v.x, w.y - v.y, w.z - v.z); if (d < bd) { bd = d; best = v; } }
    if (best) { const d = bd || 1e-6, tw = best.bp ? TRIMB : TRIMW; mv.push([w, best.x + (w.x - best.x) / d * tw, best.y + (w.y - best.y) / d * tw, best.z + (w.z - best.z) / d * tw]); } }
  for (const [w, x, y, z] of mv) { w.x = x; w.y = y; w.z = z; }
  for (let i = 0; i < nx; i++) for (let j = 0; j < M; j++) { const v = G[i][j]; if (v.glass) { const n = NR[i][j]; v.x -= n[0] * 0.007; v.y -= n[1] * 0.007; v.z -= n[2] * 0.007; } }
  for (const row of G) { row[0].z = 0; row[M - 1].z = 0; }
  // 洞：格子裡在洞裡的點標起來；有留下來的面用到的點推到洞邊
  for (const row of G) for (const v of row) { v.hole = null; for (const h of HOLES) if (h.cut(v)) { v.hole = h; break; } }
  const MESHH = []; for (const row of G) for (const v of row) if (v.hole && MESHH.includes(v.hole) && !v.hsnap) v.x -= 0.025; // 網子的洞裡面的點：往裡面 2.5 公分（這些點只有網子用）
  const quadMat = new Int8Array((nx - 1) * (M - 1)); // -1 挖掉、0 漆、1 玻璃、2 邊（有玻璃的三角形才是邊）、3 黑網（水箱罩、進氣口的洞裡）、4 B 柱（有 B 柱點的三角形是黑的）
  for (let i = 0; i < nx - 1; i++) for (let j = 0; j < M - 1; j++) { const vs = [G[i][j], G[i + 1][j], G[i][j + 1], G[i + 1][j + 1]]; const nh = vs.filter((v) => v.hole).length, ng = vs.filter((v) => v.glass).length;
    quadMat[i * (M - 1) + j] = nh === 4 ? (vs.every((v) => v.hole === vs[0].hole && MESHH.includes(v.hole)) ? 3 : -1) : ng === 4 ? 1 : ng > 0 ? 2 : vs.some((v) => v.bp) ? 4 : 0; }
  // 洞邊上的點：在洞裡、旁邊（格子線上）有不在洞裡的點 → 沿格子線二分，推到洞的邊界（跟玻璃一樣的做法）
  for (let i = 0; i < nx; i++) for (let j = 0; j < M; j++) { const v = G[i][j]; v.hsnap = false; if (!v.hole) continue; let best = null, bd = 1e9; const h = v.hole;
    for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) { if (a < 0 || b < 0 || a >= nx || b >= M) continue; const w = G[a][b]; if (w.hole) continue;
      let lo = 0, hi = 1; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2, p = { x: v.x + (w.x - v.x) * m, y: v.y + (w.y - v.y) * m, z: v.z + (w.z - v.z) * m, idx: v.idx + (w.idx - v.idx) * m }; if (h.cut(p)) lo = m; else hi = m; }
      if (hi < bd) { bd = hi; best = { x: v.x + (w.x - v.x) * hi, y: v.y + (w.y - v.y) * hi, z: v.z + (w.z - v.z) * hi, idx: v.idx + (w.idx - v.idx) * hi }; } }
    if (best) { v.nx = best.x; v.ny = best.y; v.nz = best.z; v.nidx = best.idx; v.hsnap = true; } }
  for (const row of G) for (const v of row) if (v.hsnap) { v.x = v.nx; v.y = v.ny; v.z = v.nz; v.idx = v.nidx; if (Math.abs(v.z) < 1e-3) v.z = 0; }
  // 做成 BufferGeometry（左右兩半），uv：u＝x 方向、v＝剖面方向；每個三角形自己決定材質；碰到洞裡沒推到邊的點的三角形丟掉
  const pos = [], uv = [], idxBy = [[], [], [], []], vid = (i, j, s) => ((s * nx + i) * M + j);
  for (let s = 0; s < 2; s++) for (let i = 0; i < nx; i++) for (let j = 0; j < M; j++) { const v = G[i][j]; pos.push(v.x, v.y, s ? -v.z : v.z); uv.push(U[i], j / (M - 1)); }
  for (let s = 0; s < 2; s++) for (let i = 0; i < nx - 1; i++) for (let j = 0; j < M - 1; j++) { const m = quadMat[i * (M - 1) + j]; if (m < 0) continue; const a = vid(i, j, s), b = vid(i + 1, j, s), c = vid(i, j + 1, s), d = vid(i + 1, j + 1, s);
    if (m === 3) { if (s) idxBy[3].push(a, c, b, b, c, d); else idxBy[3].push(a, b, c, b, d, c); continue; }
    const A = G[i][j], B = G[i + 1][j], C = G[i][j + 1], D = G[i + 1][j + 1], ga = A.glass, gb = B.glass, gc = C.glass, gd = D.glass, bad = (v) => v.hole && !v.hsnap;
    const tri = (p, q, r, P, Q, R) => { if (bad(P) || bad(Q) || bad(R)) return; if (P.hole && Q.hole && R.hole) return; const gp = P.glass, gq = Q.glass, gr = R.glass; const mm = m === 2 || m === 4 ? ((gp && gq && gr) ? 1 : (gp || gq || gr || P.bp || Q.bp || R.bp) ? 2 : 0) : m; if (s) idxBy[mm].push(p, r, q); else idxBy[mm].push(p, q, r); };
    const oneGlassBC = m === 2 && (gb !== gc) && !ga && !gd && (gb || gc), outs = [A, B, C, D].filter((v) => !v.hole).length, oneOutBC = outs === 1 && (!B.hole || !C.hole);
    const oneBBC = m === 2 && ga && gd && ((C.bp && gb) || (B.bp && gc)); // B 柱斜過去的那幾排：只有一點是柱子（b 或 c），黑色才只有窄窄一條
    if (oneGlassBC || oneOutBC || oneBBC) { tri(a, b, d, A, B, D); tri(a, d, c, A, D, C); } // 只有 b 或 c 特別：對角線換成 a–d
    else { tri(a, b, c, A, B, C); tri(b, d, c, B, D, C); } }
  // 兩頭封起來（車尾那一圈是開的洞；車頭那圈被進氣口挖掉就不用）：從中間一點扇形接到最後一圈
  for (const end of [0]) { const row = G[end], js = []; for (let j = 0; j < M; j++) if (!row[j].hole || row[j].hsnap) js.push(j); if (js.length < M * 0.5) continue; // 洞裡沒推到邊的點跳過（燈的洞），其他接起來
    // 以前是從中間一點扇形接過去；現在裡面撒格子點再切三角形（車尾彎成圓弧以後，這一片才是圓的，不會變成尖尖的錐子）
    const ids = js.map((j) => vid(end, j, 0)).concat(js.slice(1, -1).reverse().map((j) => vid(end, j, 1))), loop = js.map((j) => [row[j].z, row[j].y]).concat(js.slice(1, -1).reverse().map((j) => [-row[j].z, row[j].y]));
    const ct = steinerTri(THREE, loop, [], 0.025), x0 = row[0].x + (end === 0 ? -0.004 : 0.004), base = pos.length / 3;
    for (let k = ct.n; k < ct.P.length; k++) { pos.push(x0, ct.P[k][1], ct.P[k][0]); uv.push(U[end], 0.5); }
    const idOf = (k) => (k < ct.n ? ids[k] : base + k - ct.n);
    for (const t of ct.T) { const [a, b, c] = t.map(idOf), nxx = (pos[b * 3 + 1] - pos[a * 3 + 1]) * (pos[c * 3 + 2] - pos[a * 3 + 2]) - (pos[b * 3 + 2] - pos[a * 3 + 2]) * (pos[c * 3 + 1] - pos[a * 3 + 1]); // 法線的 x
      if ((nxx < 0) === (end === 0)) idxBy[0].push(a, b, c); else idxBy[0].push(a, c, b); } }
  let body = new THREE.BufferGeometry(); body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); body.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const index = [].concat(idxBy[0], idxBy[1], idxBy[2], idxBy[3]); body.setIndex(index); let o = 0; for (let m = 0; m < 4; m++) { body.addGroup(o, idxBy[m].length, m); o += idxBy[m].length; }
  const BGU = window.__BGU; if (BGU) { body = BGU.mergeVertices(body, 1e-5); }
  body.computeVertexNormals();
  { // 車漆的點：法線只算車漆的三角形（玻璃邊上的黑膠條往裡面斜，混進來的話窄的地方（A 柱）亮光會一段一段的）
    const p = body.attributes.position, n = body.attributes.normal, I = body.index.array, gr = body.groups[0], acc = new Float32Array(p.count * 3), has = new Uint8Array(p.count);
    for (let t = gr.start; t < gr.start + gr.count; t += 3) { const a = I[t], b = I[t + 1], c = I[t + 2]; const ux = p.getX(b) - p.getX(a), uy = p.getY(b) - p.getY(a), uz = p.getZ(b) - p.getZ(a), vx = p.getX(c) - p.getX(a), vy = p.getY(c) - p.getY(a), vz = p.getZ(c) - p.getZ(a); const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const k of [a, b, c]) { acc[k * 3] += nx; acc[k * 3 + 1] += ny; acc[k * 3 + 2] += nz; has[k] = 1; } }
    for (let i = 0; i < p.count; i++) if (has[i]) { const l = Math.hypot(acc[i * 3], acc[i * 3 + 1], acc[i * 3 + 2]); if (l > 0) n.setXYZ(i, acc[i * 3] / l, acc[i * 3 + 1] / l, acc[i * 3 + 2] / l); } }
  { const n = body.attributes.normal, p = body.attributes.position; for (let i = 0; i < n.count; i++) if (Math.abs(p.getZ(i)) < 1e-4) { n.setZ(i, 0); } }
  const maps = paintMaps(THREE, G, X, U, M, color, !!opt.bake); Object.assign(Mt.paint, maps); Mt.paint.needsUpdate = true;
  const bodyMesh = new THREE.Mesh(body, [Mt.paint, Mt.glass, Mt.trim]); bodyMesh.name = 'car2-body'; bodyMesh.castShadow = bodyMesh.receiveShadow = true; g.add(bodyMesh);
  // 後擋的除霧線（第 54 批）：後擋玻璃（玻璃那一組裡 x＜−0.9、朝上的三角形）往裡 1.5 公釐複製一層，貼一張透明底的線（14 條咖啡色細線＋兩邊的匯流條）
  // 線畫在貼圖上（不是細細的網格）：遠的時候 mipmap 淡成一點點顏色，不會一閃一閃；v＝沿著玻璃往上（照 x），u＝每一排從左邊到右邊（照那一排玻璃的寬度）
  { const I = body.index.array, gr = body.groups[1], p = body.attributes.position, n = body.attributes.normal, keep = [];
    for (let t = gr.start; t < gr.start + gr.count; t += 3) { const a = I[t], b = I[t + 1], c = I[t + 2]; if ((p.getX(a) + p.getX(b) + p.getX(c)) / 3 < -0.9 && (n.getY(a) + n.getY(b) + n.getY(c)) / 3 > 0.4) keep.push(a, b, c); }
    const ids = [...new Set(keep)], zm = new Map(), bin = (x) => Math.round(x * 200); let x0 = 1e9, x1 = -1e9;
    for (const i of ids) { const x = p.getX(i), k = bin(x); x0 = Math.min(x0, x); x1 = Math.max(x1, x); zm.set(k, Math.max(zm.get(k) || 0, Math.abs(p.getZ(i)))); }
    const half = (x) => { let m = 0; for (let d = -2; d <= 2; d++) m = Math.max(m, zm.get(bin(x) + d) || 0); return m || 1; };
    const re = new Map(ids.map((i, k) => [i, k])), pp = [], nn = [], uu = [];
    for (const i of ids) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i); pp.push(x - nx * 0.0015, y - ny * 0.0015, z - nz * 0.0015); nn.push(nx, ny, nz); uu.push(0.5 + z / (2 * half(x)), (x - x0) / (x1 - x0)); }
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const c2 = cv.getContext('2d'); c2.fillStyle = 'rgba(74, 42, 26, 0.88)';
    for (let k = 0; k < 14; k++) c2.fillRect(256 * 0.03, 512 * (0.07 + (0.86 * k) / 13) - 1, 256 * 0.94, 2); // 線（2 像素≈2 公釐）
    for (const u of [0.022, 0.962]) c2.fillRect(256 * u, 512 * 0.05, 4, 512 * 0.9); // 匯流條
    const dt = new THREE.CanvasTexture(cv); dt.anisotropy = 8; dt.colorSpace = THREE.SRGBColorSpace;
    const dm = new THREE.MeshStandardMaterial({ color: 0xffffff, map: dt, transparent: true, depthWrite: false, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }); dm.userData.slot = 'defrost';
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); dg.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3)); dg.setAttribute('uv', new THREE.Float32BufferAttribute(uu, 2)); dg.setIndex(keep.map((i) => re.get(i)));
    const dmesh = new THREE.Mesh(dg, dm); dmesh.name = 'defrost'; dmesh.renderOrder = 1; g.add(dmesh); }
  // ---- 洞的邊：輪拱外緣、輪拱內壁；大燈、尾燈、水箱罩、下面的進氣口 ----
  const ring = (h) => { const pts = []; for (let i = 0; i < nx; i++) for (let j = 0; j < M; j++) { const v = G[i][j]; if (v.hole === h && v.hsnap) pts.push(v); } return pts; };
  const addMesh = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const mirrorGeo = (geo) => { const g2 = geo.clone(); const p = g2.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -p.getZ(i)); const I = g2.index; if (I) { const a = I.array; for (let k = 0; k < a.length; k += 3) { const t = a[k + 1]; a[k + 1] = a[k + 2]; a[k + 2] = t; } g2.computeVertexNormals(); return g2; }
    const nr = g2.attributes.normal; if (nr) for (let i = 0; i < nr.count; i++) nr.setZ(i, -nr.getZ(i)); // 沒有 index 的（擠出來的、圓角法線）：每個三角形第 2、3 點對調，法線 z 反過來（不重算，圓角才還是圓的）
    for (const at of Object.values(g2.attributes)) { const n = at.itemSize, A = at.array; for (let k = 0; k + 2 < at.count; k += 3) for (let c = 0; c < n; c++) { const t = A[(k + 1) * n + c]; A[(k + 1) * n + c] = A[(k + 2) * n + c]; A[(k + 2) * n + c] = t; } }
    return g2; };
  const both = (geo, mat, name) => { addMesh(geo, mat, name); addMesh(mirrorGeo(geo), mat, name + 'L'); };
  // 輪拱：邊上的點照角度排序 → 外緣一圈小管子、內壁（往裡面一片黑的筒）、擋泥板
  for (const [h, xa] of [[HOLES[0], XF], [HOLES[1], XR]]) {
    // 從輪拱最下面開始照角度排（往前、往上、往後）；底下那一段（車底板切開的邊）不做邊緣、內壁：以前有一條橫過輪胎的線、輪心後面還留一條縫
    const all = ring(h).map((v) => ({ a: Math.atan2(v.y - RW, v.x - xa), v })), yb = Math.min(...all.map((p) => p.v.y));
    const pts = all.filter((p) => p.v.y > yb + 0.012).sort((p, q) => ((p.a + 2.5 * PI) % (2 * PI)) - ((q.a + 2.5 * PI) % (2 * PI)));
    if (pts.length < 8) continue;
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.v.x, p.v.y, p.v.z - 0.004)));
    both(new THREE.TubeGeometry(curve, 160, 0.008, 10, false), Mt.paint, 'archLip'); // 輪拱邊緣捲一圈（鈑金有厚度）
    const wp = [], wi = [], n = pts.length; // 內壁
    for (let k = 0; k < n; k++) { const v = pts[k].v; wp.push(v.x, v.y, v.z, xa + (ARCH_R + 0.015) * Math.cos(pts[k].a), RW + (ARCH_R + 0.015) * Math.sin(pts[k].a), 0.50); if (k < n - 1) wi.push(k * 2, k * 2 + 2, k * 2 + 1, k * 2 + 1, k * 2 + 2, k * 2 + 3); }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setIndex(wi); wg.computeVertexNormals();
    const wm = new THREE.Mesh(wg, Mt.dark); wm.material = Mt.dark.clone(); wm.material.side = THREE.DoubleSide; addMesh(wg, wm.material, 'well'); addMesh(mirrorGeo(wg), wm.material, 'wellL');
    // 內壁的底（z＝0.5，看不穿）：圓的下面切到輪拱最低的點（以前轉錯方向，變成一片橫在輪心的板子、還垂到地下）
    const rc = ARCH_R + 0.025, a0 = Math.asin(Math.max(-1, (yb - RW) / rc)), cap = new THREE.Shape();
    cap.absarc(0, 0, rc, a0, PI - a0, false); cap.closePath();
    const disk = new THREE.ShapeGeometry(cap, 24); disk.translate(xa, RW, 0.50); both(disk, wm.material, 'wellCap');
  }
  // 燈／進氣口的殼：從洞真正的邊（格子上的點）往裡面縮成筒＋底；燈罩也從洞的邊往中間做（稍微凸），跟車身一定接得起來
  // hole: HOLES 的那個；depth: 往裡面幾公尺（負＝往 −x，車頭用）；back(p, c) 把邊上的點變成底的點；lensMat: 燈罩材質（null 不做）；lensUV(z, y) → [u, v]
  const lampBox = (hole, depth, back, lensMat, inner, lensUV, bulge = 0.012, flat, rel = false) => { // rel：殼的深度照每個邊上的點自己算（洞跨過圓圓的車頭：中間的點比旁邊前面 20 公分，殼的牆才不會變成一個 V） // flat：燈罩（網子）做成平的一片，在洞最裡面那點再往裡 flat 公尺（進氣口、水箱罩：洞跨過圓圓的車頭，扇形會變成 V）
    const pts = ring(hole); if (pts.length < 6) return; const cz = pts.reduce((a, v) => a + v.z, 0) / pts.length, cy = pts.reduce((a, v) => a + v.y, 0) / pts.length, cx = pts.reduce((a, v) => a + v.x, 0) / pts.length;
    const ord = pts.map((v) => ({ a: Math.atan2(v.y - cy, v.z - cz), v })).sort((p, q) => p.a - q.a).map((p) => p.v), n = ord.length;
    const bk = ord.map((v) => back(v, { x: (rel ? v.x : cx) + depth, y: cy, z: cz })); const bx = rel ? (depth < 0 ? Math.min(...bk.map((b) => b.x)) : Math.max(...bk.map((b) => b.x))) : cx + depth;
    const wp = [], wi = []; for (let k = 0; k < n; k++) { const v = ord[k], b = bk[k]; wp.push(v.x, v.y, v.z, b.x, b.y, b.z); const k2 = (k + 1) % n; if (ord[k].z < 0.012 && ord[k2].z < 0.012 && Math.abs(ord[k].y - ord[k2].y) > 0.03) continue; /* 只跳過沿著中線那一段（上下兩邊靠中線的那一小段牆要留著，不然中間看得到外面） */ wi.push(k * 2, k2 * 2, k * 2 + 1, k * 2 + 1, k2 * 2, k2 * 2 + 1); }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setIndex(wi); wg.computeVertexNormals(); const dm = Mt.dark.clone(); dm.side = THREE.DoubleSide; both(wg, dm, 'lampWall');
    const bp = [bx, cy, cz], bi = []; for (const b of bk) bp.push(b.x, b.y, b.z); for (let k = 0; k < n; k++) bi.push(0, 1 + k, 1 + ((k + 1) % n));
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setIndex(bi); bg.computeVertexNormals(); both(bg, dm, 'lampBack');
    inner(cx, depth, cy, cz);
    if (lensMat) { const sgn = depth < 0 ? 1 : -1, xl = flat !== undefined ? (depth < 0 ? Math.min(...ord.map((v) => v.x)) : Math.max(...ord.map((v) => v.x))) + flat : null, lp = [xl !== null ? xl : cx + sgn * bulge, cy, cz], lu = [], li = []; const uvf = lensUV || ((z, y) => [z, y]); lu.push(...uvf(cz, cy));
      for (const v of ord) { lp.push(xl !== null ? xl : v.x, v.y, v.z); lu.push(...uvf(v.z, v.y)); } for (let k = 0; k < n; k++) li.push(0, 1 + ((k + 1) % n), 1 + k);
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(lu, 2)); lg.setIndex(li); lg.computeVertexNormals(); both(lg, lensMat, 'lens'); }
  };
  const shrink = (f) => (v, c) => ({ x: c.x, y: c.y + (v.y - c.y) * f, z: c.z + (v.z - c.z) * f });
  const shrinkMid = (f) => (v, c) => ({ x: c.x, y: c.y + (v.y - c.y) * f, z: v.z * 0.9 }); // 中間的洞（水箱罩、進氣口）：z 不能跨過中線
  // 洞的邊框：大燈鍍鉻細框、其他的黑色細框（鈑金的邊）
  const edgeTube = (h, mat, r, name, dz = 0) => { const pts = ring(h); if (pts.length < 8) return; const cz = pts.reduce((s, v) => s + v.z, 0) / pts.length, cy = pts.reduce((s, v) => s + v.y, 0) / pts.length;
    const ord = pts.map((v) => ({ a: Math.atan2(v.y - cy, v.z - cz), v })).sort((p, q) => p.a - q.a); const curve = new THREE.CatmullRomCurve3(ord.map((p) => new THREE.Vector3(p.v.x, p.v.y, p.v.z + dz)), true); both(new THREE.TubeGeometry(curve, 120, r, 8, true), mat, name); };
  edgeTube(HOLES[2], Mt.trim, 0.0042, 'headBezel'); edgeTube(HOLES[3], Mt.trim, 0.005, 'tailBezel');
  // 大燈（照片 5b061c63）：主燈＝透明燈罩（細細的格子線）後面一個橢圓的反光碗（一片一片的鍍鉻小鏡面）＋旁邊鍍鉻的直條紋＋下面一條霧白；外角＝霧白的角燈（直的細紋）；中間深灰色隔板；燈泡前面六角的小遮罩
  // 反光鏡、燈罩的貼圖：u＝z 0.30…0.698，v＝y 0.590…0.732（主燈那一格）
  const HU = (z, y) => [(z - 0.30) / 0.398, (y - 0.590) / 0.142];
  // 第 55 批（Nick「車燈可以再做更好一點」）：照片的反光鏡是一大片一大片斜斜的鍍鉻小鏡面（照到的東西一塊亮一塊暗），旁邊是一條一條圓的直槽；
  // 以前一圈一圈小格子＋灰色深淺不一＋白天自己發光 → 看起來像一張灰色的圖。現在：顏色都是亮的鍍鉻，亮暗交給反光（每一片斜的方向不一樣，片裡面也有一點彎）
  const HT = (() => {
    const W = 1024, H = 384, rr = (k) => { const s = Math.sin(k * 91.345 + 7.13) * 43758.5453; return s - Math.floor(s); };
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), IA = c.createImageData(W, H), A = IA.data;
    const nv = document.createElement('canvas'); nv.width = W; nv.height = H; const n = nv.getContext('2d'), IN = n.createImageData(W, H), N = IN.data;
    const put = (o, b, tx, ty) => { const v = Math.round(255 * Math.max(0, Math.min(1, b))), l = Math.hypot(tx, ty, 1); A[o] = A[o + 1] = A[o + 2] = v; A[o + 3] = 255; N[o] = 127.5 + (tx / l) * 127; N[o + 1] = 127.5 + (ty / l) * 127; N[o + 2] = 127.5 + (1 / l) * 127; N[o + 3] = 255; }; // tx：往 u（車外），ty：往上
    const FX = [0]; for (let k = 1; FX[FX.length - 1] < W; k++) FX.push(FX[FX.length - 1] + 9 + rr(k) * 8); // 直槽：一條 9–17 像素（3.5–6.6 公釐）
    const BR = [H * 0.34, H * 0.7]; // 直槽橫的斷開兩條
    const X0 = W * 0.5025, Y0 = H * (1 - 0.507), EA = W * 0.339, EB = H * 0.366, RIN = [0.15, 0.38]; // 反光碗：橢圓（中心 z 0.50、y 0.662）
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4, ex = (x + 0.5 - X0) / EA, ey = (Y0 - y - 0.5) / EB, r = Math.hypot(ex, ey), th = Math.atan2(ey, ex);
      if (r < 1.02) { const rw = r < 1 ? r + 0.035 * Math.sin(3 * th + 1.3) + 0.025 * Math.sin(5 * th + 0.4) : r; // 一圈一圈的邊歪歪的（不是正圓）
        if (r >= 1) { put(o, r < 1.011 ? 0.97 : 0.45, ex * 0.6, ey * 0.6); continue; } // 碗的邊：亮的一圈＋外面一條暗線
        if (rw < RIN[0]) { const e = (RIN[0] - rw) * Math.hypot(EA * Math.cos(th), EB * Math.sin(th)); put(o, e < 1.6 ? 0.95 : 0.2, Math.cos(th) * 0.5, Math.sin(th) * 0.5); continue; } // 中間燈泡的洞
        let q, de, fx, fy;
        if (rw < RIN[1]) { const ns = 8, st = ((((th - 0.2) / (2 * Math.PI)) * ns) % ns + ns) % ns, s = Math.floor(st); fx = st - s - 0.5; fy = (rw - RIN[0]) / (RIN[1] - RIN[0]) - 0.5; q = s; // 燈泡旁邊一圈：8 片放射狀
          de = Math.min((0.5 - Math.abs(fy)) * (RIN[1] - RIN[0]) * Math.hypot(EA * Math.cos(th), EB * Math.sin(th)), (0.5 - Math.abs(fx)) * ((2 * Math.PI) / ns) * rw * Math.hypot(EA * Math.sin(th), EB * Math.cos(th)));
        } else { const NC = 9, NR = 5, gx = ex * (1 + 0.14 * ey * ey), gy = ey * (1 + 0.1 * ex * ex), cx = ((gx + 1) / 2) * NC, cy = ((gy + 1) / 2) * NR, ci = Math.floor(cx), cj = Math.floor(cy); // 外面：一格一格（照片：直的、橫的分隔線，稍微跟著碗彎）
          fx = cx - ci - 0.5; fy = cy - cj - 0.5; q = 50 + cj * 16 + ci; de = Math.min((0.5 - Math.abs(fx)) * (2 / NC) * EA, (0.5 - Math.abs(fy)) * (2 / NR) * EB); }
        const tx = (rr(q + 700) - 0.5) * 1.0 + fx * 0.15, ty = (rr(q + 900) - 0.5) * 1.0 + fy * 0.15; // 每一片平平的、斜的方向不一樣（照片：一塊亮一塊暗）
        put(o, de < 0.9 ? 0.42 : de < 2.0 ? 0.98 : 0.84 + 0.12 * rr(q + 500), tx, ty); continue; }
      let k = 0; while (FX[k + 1] <= x) k++; const t = (x + 0.5 - FX[k]) / (FX[k + 1] - FX[k]), b = y < BR[0] ? 0 : y < BR[1] ? 1 : 2; // 直槽：圓的（一條裡面從左斜到右）
      if (Math.abs(y + 0.5 - BR[0]) < 1 || Math.abs(y + 0.5 - BR[1]) < 1) { put(o, 0.5, 0, b === 1 ? 0.5 : -0.5); continue; }
      put(o, t < 0.07 || t > 0.93 ? 0.55 : 0.86 + 0.08 * rr(k + 50 + b * 13) - 0.08 * Math.abs(t - 0.5), (t - 0.5) * 1.2 + (rr(k + 99 + b * 7) - 0.5) * 0.25, (rr(k * 3 + b * 11) - 0.5) * 0.35); }
    c.putImageData(IA, 0, 0); n.putImageData(IN, 0, 0);
    // 燈罩：細細的格子線（直 12 條、橫 3 條），透明底（遊戲裡：線比較不透明，看得到燈罩上的格子）
    const lv = document.createElement('canvas'); lv.width = 512; lv.height = 128; const l2 = lv.getContext('2d'); l2.fillStyle = 'rgba(13,15,17,0.05)'; l2.fillRect(0, 0, 512, 128); l2.fillStyle = 'rgba(120,124,128,0.3)';
    for (let i = 1; i < 13; i++) l2.fillRect(Math.round((i * 512) / 13), 0, 2, 128);
    for (const v of [0.3, 0.55, 0.8]) l2.fillRect(0, Math.round(128 * (1 - v)), 512, 1.5);
    // 霧白（角燈、下面那條）：直的圓凹槽（像玻璃的直紋，24 條）
    const fv = document.createElement('canvas'); fv.width = 256; fv.height = 4; const f2 = fv.getContext('2d'), FI = f2.createImageData(256, 4);
    for (let x = 0; x < 256; x++) { const t = ((x + 0.5) * 24) / 256 % 1, tx = (t - 0.5) * 1.3, l = Math.hypot(tx, 1); for (let y = 0; y < 4; y++) { const o = (y * 256 + x) * 4; FI.data[o] = 127.5 + (tx / l) * 127; FI.data[o + 1] = 127.5; FI.data[o + 2] = 127.5 + (1 / l) * 127; FI.data[o + 3] = 255; } }
    f2.putImageData(FI, 0, 0);
    const T = (cvs, srgb, rep) => { const t = new THREE.CanvasTexture(cvs); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
    return { map: T(cv, true), nrm: T(nv, false), lens: T(lv, true), rib: T(fv, false, true) }; })();
  { const hl = Mt.lensClear; hl.map = HT.lens; hl.color.set(0xffffff); hl.transmission = 0.94; hl.roughness = 0.02; hl.needsUpdate = true; } // 第 55 批：燈罩的貼圖有透明度（底是深色、幾乎透明）
  lampBox(HOLES[2], -0.13, shrink(0.8), Mt.lensClear, () => {
    const RP = ring(HOLES[2]), xl = (z) => { let s = 0, n = 0, best = null; for (const v of RP) { if (Math.abs(v.z - z) < 0.025) { s += v.x; n++; } if (!best || Math.abs(v.z - z) < Math.abs(best.z - z)) best = v; } return n ? s / n : best.x; }; // 燈罩在 z 那邊的 x
    const xs = (z, y) => { let s = 0, w = 0; for (const v of RP) { const q = 1 / ((v.z - z) ** 2 + (v.y - y) ** 2 + 1e-6); s += v.x * q; w += q; } return s / w; }; // 燈罩在 (z, y) 的 x：邊上的點照距離平均
    const hc = HEAD.reduce((s, p) => [s[0] + p[0] / HEAD.length, s[1] + p[1] / HEAD.length], [0, 0]), P96 = HEAD.map(([pz, py]) => [hc[0] + (pz - hc[0]) * 0.965, hc[1] + (py - hc[1]) * 0.965]);
    const span = (y) => { let lo = 9, hi = -9; for (let k = 0; k < P96.length; k++) { const [z1, y1] = P96[k], [z2, y2] = P96[(k + 1) % P96.length]; if (y1 !== y2 && (y1 - y) * (y2 - y) <= 0) { const z = z1 + ((y - y1) / (y2 - y1)) * (z2 - z1); lo = Math.min(lo, z); hi = Math.max(hi, z); } } return [lo, hi]; };
    const yB = Math.min(...P96.map((p) => p[1])) + 0.0004, yT = Math.max(...P96.map((p) => p[1])) - 0.0004;
    // 一片貼著燈罩形狀的網格：每一列從洞的左邊到右邊（z 夾在 zA…zB），dep(z, y) 往裡面幾公尺
    const sheet = (zA, zB, ya, yb, nz, ny, dep, uvf) => { const pp = [], uu = [], ii = [];
      for (let j = 0; j <= ny; j++) { const y = ya + ((yb - ya) * j) / ny, [lo, hi] = span(y), a = Math.max(lo, zA), b = Math.min(hi, zB);
        for (let i = 0; i <= nz; i++) { const z = a + ((b - a) * i) / nz; pp.push(xs(z, y) - dep(z, y), y, z); uu.push(...uvf(z, y)); } }
      for (let j = 0; j < ny; j++) for (let i = 0; i < nz; i++) { const a = j * (nz + 1) + i, b = a + 1, c2 = a + nz + 1, d = c2 + 1; ii.push(a, d, b, a, c2, d); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uu, 2)); sg.setIndex(ii); sg.computeVertexNormals(); return sg; };
    const rm = new THREE.MeshStandardMaterial({ color: 0xffffff, map: HT.map, normalMap: HT.nrm, metalness: 1, roughness: 0.06, emissive: 0xffffff, emissiveMap: HT.map, emissiveIntensity: 0.03, side: THREE.DoubleSide }); rm.userData.slot = 'reflector'; // 第 55 批：白天幾乎不發光（以前 0.14：一片白）
    const frost = new THREE.MeshStandardMaterial({ color: 0xdfe5ea, roughness: 0.16, metalness: 0.55, normalMap: HT.rib, emissive: 0xffffff, emissiveIntensity: 0.03, side: THREE.DoubleSide }); frost.userData.slot = 'frost';
    const bowl = (z, y) => { const r2 = ((z - 0.50) / 0.135) ** 2 + ((y - 0.662) / 0.052) ** 2; return 0.016 + 0.05 * Math.max(0, 1 - r2); };
    both(sheet(0, 0.698, yB, yT, 72, 28, bowl, HU), rm, 'reflector');
    both(sheet(0, 0.698, yB, yB + 0.012, 40, 2, () => 0.008, (z, y) => [(z - 0.30) / 0.1, y]), frost, 'headStrip'); // 下面一條霧白
    both(sheet(0.705, 0.80, yB, yT, 12, 16, () => 0.012, (z, y) => [(z - 0.705) / 0.095, y]), frost, 'headCorner'); // 外角的角燈
    const cm = Mt.chrome.clone(); cm.side = THREE.DoubleSide; cm.roughness = 0.04;
    const xb0 = xl(0.50) - 0.078, bulb = new THREE.SphereGeometry(0.011, 14, 10); bulb.translate(xb0 + 0.032, 0.662, 0.50); both(bulb, Mt.bulb, 'bulb');
    const cap = new THREE.SphereGeometry(0.019, 6, 3, 0, 2 * PI, 0, PI / 2).toNonIndexed(); cap.computeVertexNormals(); cap.rotateZ(-PI / 2); cap.translate(xb0 + 0.05, 0.662, 0.50); both(cap, cm, 'bulbCap'); // 燈泡前面的小遮罩：六角、一面一面的
    const dm = new THREE.MeshStandardMaterial({ color: 0x3b3f44, roughness: 0.35, metalness: 0.2 }), dv = new THREE.BoxGeometry(0.028, 0.128, 0.006); dm.userData.slot = 'trim'; dv.translate(xs(0.701, 0.66) - 0.016, 0.660, 0.701); both(dv, dm, 'lampDiv'); // 隔板：深灰（照片）
  }, HU);
  // 保桿角上（照片）：橘色方向燈（燈罩跟著角彎、後面一片亮的反光）＋下面導風口（黑的殼、三條橘色橫條）；都挖在車身格子上，車頭彎圓的時候一起彎
  const chord = (R, yk) => { const ps = R.filter((v) => Math.abs(v.y - yk) < 0.012); if (ps.length < 2) return null; const a = ps.reduce((m, v) => (v.z < m.z ? v : m)), b = ps.reduce((m, v) => (v.z > m.z ? v : m)); return { a, b, L: Math.hypot(b.x - a.x, b.z - a.z), r: -Math.atan2(b.z - a.z, b.x - a.x) }; }; // 洞的邊在 y 那一條：最裡面、最外面兩點
  const bar = (c, w, h, d, y, back, mat, name) => { const g2 = new THREE.BoxGeometry(c.L * w, h, d); g2.rotateY(c.r); g2.translate((c.a.x + c.b.x) / 2 - back, y, (c.a.z + c.b.z) / 2); both(g2, mat, name); };
  // 第 55 批：橘色燈罩裡面一格一格的小稜鏡（照片：約 3 公釐的小方格，每格四面斜的）；方向燈、側邊的小燈共用（燈罩的 uv＝公尺，一張圖 4×4 格＝1.2 公分）
  { const S = 128, K = 4, cs = S / K, mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; }, ca = mk(), cn = mk(), ga = ca.getContext('2d'), gn = cn.getContext('2d'), IA = ga.createImageData(S, S), IN = gn.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const o = (y * S + x) * 4, dx = ((x + 0.5) % cs) / cs - 0.5, dy = 0.5 - ((y + 0.5) % cs) / cs, edge = Math.max(Math.abs(dx), Math.abs(dy)) > 0.44; // dy 往上
      const tx = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) * 0.42 : 0, ty = Math.abs(dx) > Math.abs(dy) ? 0 : Math.sign(dy) * 0.42, l = Math.hypot(tx, ty, 1);
      const b = edge ? 200 : 255; IA.data[o] = IA.data[o + 1] = IA.data[o + 2] = b; IA.data[o + 3] = 255; IN.data[o] = 127.5 + (tx / l) * 127; IN.data[o + 1] = 127.5 + (ty / l) * 127; IN.data[o + 2] = 127.5 + (1 / l) * 127; IN.data[o + 3] = 255; }
    ga.putImageData(IA, 0, 0); gn.putImageData(IN, 0, 0);
    const T = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 0.012, 1 / 0.012); t.anisotropy = 8; return t; };
    Mt.lensAmber.map = T(ca, true); Mt.lensAmber.normalMap = T(cn, false); Mt.lensAmber.needsUpdate = true; }
  lampBox(HOLES[6], -0.03, shrink(0.85), Mt.lensAmber, (cx, d, cy) => { const c = chord(ring(HOLES[6]), cy); if (c) bar(c, 0.9, 0.04, 0.004, cy, 0.016, Mt.chrome, 'turnRefl'); }, null, 0.006);
  { const R6 = ring(HOLES[6]), p = R6.reduce((m, v) => (Math.hypot(v.z - 0.643, v.y - 0.478) < Math.hypot(m.z - 0.643, m.y - 0.478) ? v : m)), sc = new THREE.CylinderGeometry(0.0034, 0.0034, 0.003, 16); // 燈罩裡面那頭上角的小螺絲（照片）
    sc.rotateZ(PI / 2); sc.translate(p.x + 0.0025, 0.478, 0.643); both(sc, Mt.chrome, 'turnScrew'); }
  { const slat = new THREE.MeshStandardMaterial({ color: 0xd98a2e, roughness: 0.45, metalness: 0.05 }); slat.userData.slot = 'trim'; // 導風口：6 片斜斜的橘色塑膠百葉（照片；以前 3 條透明橘色的棒子）
    lampBox(HOLES[7], -0.035, shrink(0.85), null, () => { const R7 = ring(HOLES[7]); for (let k = 0; k < 6; k++) { const yk = 0.3435 + k * 0.0078, c = chord(R7, yk); if (!c) continue;
      const g2 = new THREE.BoxGeometry(c.L * 0.93, 0.0035, 0.016); g2.rotateX(-0.45); g2.rotateY(c.r); g2.translate((c.a.x + c.b.x) / 2 - 0.012, yk, (c.a.z + c.b.z) / 2); both(g2, slat, 'ductSlat'); } }); }
  // 尾燈：一片燈罩，上面紅、下面一條透明（照片）＋橫的紋路；裡面一格一格的反光
  // 尾燈：一片燈罩，上面紅、下面一條透明（照片）；第 55 批：紅色裡面兩塊暗一點的長方形（反光片）、透明那條裡面一個圓角的倒車燈框，整片細細的小稜鏡（以前一條一條橫線）
  const tailMat = (() => { const W = 512, H = 128, mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }, cv = mk(W, H), c2 = cv.getContext('2d');
    c2.fillStyle = '#c80c18'; c2.fillRect(0, 0, W, H);
    c2.fillStyle = '#9a0811'; for (const [y0, y1] of [[12, 32], [40, 60]]) { c2.beginPath(); c2.roundRect(34, y0, 270, y1 - y0, 4); c2.fill(); } // 反光片（裡面那半邊）
    c2.fillStyle = '#5e0a10'; c2.fillRect(0, 70, W, 4); // 紅跟透明中間的線
    const gr = c2.createLinearGradient(0, 74, 0, H); gr.addColorStop(0, '#d9dcde'); gr.addColorStop(1, '#c3c7ca'); c2.fillStyle = gr; c2.fillRect(0, 74, W, H - 74); // 照片：下面一條透明（銀白），沒有橘色
    c2.strokeStyle = '#8e9296'; c2.lineWidth = 3; c2.beginPath(); c2.roundRect(22, 84, 190, 34, 7); c2.stroke(); c2.fillStyle = '#e6e8ea'; c2.beginPath(); c2.roundRect(26, 88, 182, 26, 5); c2.fill(); // 倒車燈的框
    c2.fillStyle = 'rgba(0,0,0,0.07)'; for (let x = 0; x < W; x += 6) c2.fillRect(x, 0, 1, H); for (let y = 0; y < H; y += 5) c2.fillRect(0, y, W, 1); // 小稜鏡的細格子
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const nc = mk(W, H), n2 = nc.getContext('2d'), img = n2.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = ((x + 0.5) % 6) / 6 - 0.5, dy = 0.5 - ((y + 0.5) % 5) / 5, tx = Math.abs(dx) * 5 > Math.abs(dy) * 6 ? Math.sign(dx) * 0.35 : 0, ty = tx ? 0 : Math.sign(dy) * 0.35, l = Math.hypot(tx, ty, 1), o = (y * W + x) * 4; // 一格四面斜的（小金字塔）
      img.data[o] = 127.5 + (tx / l) * 127; img.data[o + 1] = 127.5 + (ty / l) * 127; img.data[o + 2] = 127.5 + (1 / l) * 127; img.data[o + 3] = 255; }
    n2.putImageData(img, 0, 0); const nt = new THREE.CanvasTexture(nc);
    const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: t, normalMap: nt, roughness: 0.08, transmission: 0.45, ior: 1.5, thickness: 0.02, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, side: THREE.DoubleSide }); m.userData.slot = 'tail'; return m; })();
  lampBox(HOLES[3], 0.10, shrink(0.6), tailMat, (xf, d) => {
    for (let k = 0; k < 7; k++) for (let m = 0; m < 2; m++) { const cube = new THREE.BoxGeometry(0.02, 0.05, 0.05); cube.translate(xf + d - 0.005, 0.68 + m * 0.075, 0.46 + k * 0.05); both(cube, Mt.chrome, 'reflCube'); } }, (z, y) => [(z - 0.43) / 0.40, (y - 0.63) / 0.18], 0.008);
  // 水箱罩、下面的進氣口：凹進去＋黑網子＋邊框
  const meshTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c2 = cv.getContext('2d'); c2.clearRect(0, 0, 256, 256); c2.strokeStyle = '#000'; c2.lineWidth = 7; for (let y = 0; y < 256; y += 32) for (let x = 0; x < 256; x += 32) { const ox = (y / 32) % 2 ? 16 : 0; c2.beginPath(); for (let k = 0; k < 6; k++) { const a = k * PI / 3 + PI / 6; c2[k ? 'lineTo' : 'moveTo'](x + ox + 16 + 16 * Math.cos(a), y + 16 + 16 * Math.sin(a)); } c2.closePath(); c2.stroke(); } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const hexFlat = (lw) => { const W = 256, H = 148, R = W / 3, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); c.strokeStyle = '#000'; c.lineWidth = lw; c.lineJoin = 'round'; // 平頂的六角網（一張圖＝兩行），長的那邊在 u；lw：網的粗細（圖的像素）
    for (const [hx, hy] of [[0, 0], [W, 0], [0, H], [W, H], [W / 2, H / 2]]) { c.beginPath(); for (let k = 0; k < 6; k++) { const a = (k * PI) / 3; c[k ? 'lineTo' : 'moveTo'](hx + R * Math.cos(a), hy + R * Math.sin(a)); } c.closePath(); c.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  const meshMat = new THREE.MeshStandardMaterial({ map: meshTex, transparent: true, alphaTest: 0.5, color: 0x0a0a0a, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide }); meshMat.userData.slot = 'net';
  { const bm = meshMat.clone(); bm.map = meshTex.clone(); bm.map.repeat.set(27, 21); bm.map.needsUpdate = true; bodyMesh.material.push(bm); } // 車身 uv：u 一格＝4.35 公尺、v＝3.4 公尺 → 六角格約 2 公分
  lampBox(HOLES[4], -0.07, shrinkMid(0.6), null, () => {}, null, 0, undefined, true); // 水箱罩：殼
  { // 水箱罩的網子（照片）：扁扁的六角形（平的那邊在上下，一格約 6.7×2.7 公分），在洞後面 2.5 公分；洞的邊一圈黑色粗框
    const RG = ring(HOLES[4]), xs = (z, y) => { let s = 0, w = 0; for (const v of RG) { const q = 1 / ((v.z - z) ** 2 + (v.y - y) ** 2 + 1e-6); s += v.x * q; w += q; } return s / w; };
    const ht = hexFlat(18);
    const nm = new THREE.MeshStandardMaterial({ map: ht, transparent: true, alphaTest: 0.5, color: 0x0c0c0d, roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide }); nm.userData.slot = 'netF';
    const span = (y) => { let lo = 9, hi = -9; for (let k = 0; k < GRILLE.length; k++) { const [z1, y1] = GRILLE[k], [z2, y2] = GRILLE[(k + 1) % GRILLE.length]; if (y1 !== y2 && (y1 - y) * (y2 - y) <= 0) { const z = z1 + ((y - y1) / (y2 - y1)) * (z2 - z1); lo = Math.min(lo, z); hi = Math.max(hi, z); } } return [Math.max(0, lo), hi]; };
    const ys = GRILLE.map((p) => p[1]), ya = Math.min(...ys) + 0.0005, yb = Math.max(...ys) - 0.0005, nz = 40, ny = 12, pp = [], uu = [], ii = [];
    for (let j = 0; j <= ny; j++) { const y = ya + ((yb - ya) * j) / ny, [lo, hi] = span(y); for (let i = 0; i <= nz; i++) { const z = lo + ((hi - lo) * i) / nz; pp.push(xs(z, y) - 0.025, y, z); uu.push(z / 0.10, (y - 0.61) / 0.027); } }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nz; i++) { const a = j * (nz + 1) + i, b = a + 1, c2 = a + nz + 1, d = c2 + 1; ii.push(a, d, b, a, c2, d); }
    const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); ng.setAttribute('uv', new THREE.Float32BufferAttribute(uu, 2)); ng.setIndex(ii); ng.computeVertexNormals(); both(ng, nm, 'grilleNet');
    const fp = []; for (let k = 0; k < GRILLE.length - 1; k++) { const [z1, y1] = GRILLE[k], [z2, y2] = GRILLE[k + 1], n = Math.max(1, Math.ceil(Math.hypot(z2 - z1, y2 - y1) / 0.01)); for (let s2 = 0; s2 < n; s2++) fp.push([z1 + ((z2 - z1) * s2) / n, y1 + ((y2 - y1) * s2) / n]); } fp.push(GRILLE[GRILLE.length - 1]);
    const curve = new THREE.CatmullRomCurve3(fp.map(([z, y]) => new THREE.Vector3(xs(z, y) - 0.004, y, z)), false); both(new THREE.TubeGeometry(curve, 160, 0.0065, 8, false), Mt.trim, 'grilleFrame'); }
  { // 保桿正面：最後一站的輪廓（左右）封成一片，中間挖進氣口；進氣口：黑網（凹 2 公分）＋黑色的殼
    const last = G[nx - 1], xf = last[0].x, full = (P) => { const A = P.concat(P.slice().reverse().map(([z, y]) => [-z, y])).filter((p, k, B) => !k || Math.abs(p[0] - B[k - 1][0]) > 1e-6 || Math.abs(p[1] - B[k - 1][1]) > 1e-6); if (A.length > 2 && Math.abs(A[0][0] - A[A.length - 1][0]) < 1e-6 && Math.abs(A[0][1] - A[A.length - 1][1]) < 1e-6) A.pop(); return A; };
    const outer = full(last.map((v) => [v.z, v.y])), hole = dens(full(MOUTH), 0.02); // 右半邊從下面到上面，接左半邊（鏡射、反過來）→ 一圈；洞的邊切細（彎成圓弧的時候跟著彎）
    const toShape = (P) => { const sh = new THREE.Shape(); P.forEach(([z, y], k) => sh[k ? 'lineTo' : 'moveTo'](-z, y)); sh.closePath(); return sh; }; // shape 的 x＝−z，轉 90 度以後法線朝車頭
    const fogR = dens(FOG, 0.02), fogL = fogR.map(([z, y]) => [-z, y]).reverse();
    const flat = (L, x, step, mat, name, uvf, face = 1) => { const T = steinerTri(THREE, L[0], L.slice(1), step), pp = [], uu = [], ii = []; for (const [z, y] of T.P) { pp.push(x, y, z); if (uvf) uu.push(...uvf(z, y)); } // 一片平的（x 固定）：格子點切小三角形，法線朝 +x（face −1 朝 −x）
      for (const [a, b, c] of T.T) { const nxx = (pp[b * 3 + 1] - pp[a * 3 + 1]) * (pp[c * 3 + 2] - pp[a * 3 + 2]) - (pp[b * 3 + 2] - pp[a * 3 + 2]) * (pp[c * 3 + 1] - pp[a * 3 + 1]); if (nxx * face > 0) ii.push(a, b, c); else ii.push(a, c, b); }
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); if (uvf) fg.setAttribute('uv', new THREE.Float32BufferAttribute(uu, 2)); fg.setIndex(ii); fg.computeVertexNormals(); return addMesh(fg, mat, name); };
    flat([outer, hole, fogR, fogL], xf, 0.02, Mt.paint, 'noseCap', (z, y) => [0.5 + z / 4.3, 0.002 + (y - 0.25) / 3.4]); // 貼圖的 uv 借車底那一條（沒有縫）
    { const coverMat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide }), dmf = Mt.dark.clone(); coverMat.userData.slot = 'paint'; dmf.side = THREE.DoubleSide; // 霧燈蓋：凹 8 公釐的車身色板子＋一圈黑縫
      for (const F of [fogR, fogL]) { const fcy = F.reduce((a, p) => a + p[1], 0) / F.length, fcz = F.reduce((a, p) => a + p[0], 0) / F.length, sh2 = F.map(([z, y]) => [fcz + (z - fcz) * 0.93, fcy + (y - fcy) * 0.9]);
        flat([sh2], xf - 0.008, 0.025, coverMat, 'fogCover');
        const wp = [], wi = [], n = F.length; for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; wp.push(xf, F[k][1], F[k][0], xf - 0.012, sh2[k][1], sh2[k][0]); wi.push(k * 2, k2 * 2, k * 2 + 1, k * 2 + 1, k2 * 2, k2 * 2 + 1); }
        const fw = new THREE.BufferGeometry(); fw.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); fw.setIndex(wi); fw.computeVertexNormals(); addMesh(fw, dmf, 'fogGap'); } }
    { const pf = new THREE.BoxGeometry(0.012, 0.175, 0.345, 1, 8, 16); pf.translate(xf - 0.026, 0.385, 0); addMesh(pf, Mt.dark, 'plateFrameF'); const pl = new THREE.BoxGeometry(0.006, 0.165, 0.33, 1, 8, 16); pl.translate(xf - 0.016, 0.385, 0); addMesh(pl, plateM, 'plateF'); } // 前面的車牌（第 54 批：有號碼，以前空白）
    { const lip = new THREE.BoxGeometry(0.06, 0.018, 1.22, 1, 1, 48); lip.translate(xf - 0.01, 0.262, 0); const lu = lip.attributes.uv; for (let k = 0; k < lu.count; k++) lu.setXY(k, 0.5, 0.01); addMesh(lip, Mt.paint, 'lip'); } // 下面一條唇：車身色（照片），uv 對到漆的貼圖沒有縫的地方（切 48 段，跟著彎）
    flat([hole], xf - 0.02, 0.03, meshMat, 'mouthNet', (z, y) => [-z * 6.25, y * 6.25]);
    const H = hole, n = H.length, cy = H.reduce((a, p) => a + p[1], 0) / n, wp = [], wi = [], bk = []; // 殼：牆（洞的邊 → 往裡 12 公分、縮小一點）＋底
    for (let k = 0; k < n; k++) { const [z, y] = H[k], bz = z * 0.85, by = cy + (y - cy) * 0.85, k2 = (k + 1) % n; wp.push(xf, y, z, xf - 0.12, by, bz); wi.push(k * 2, k2 * 2, k * 2 + 1, k * 2 + 1, k2 * 2, k2 * 2 + 1); bk.push([bz, by]); }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setIndex(wi); wg.computeVertexNormals(); const dm2 = Mt.dark.clone(); dm2.side = THREE.DoubleSide; addMesh(wg, dm2, 'mouthWall');
    flat([bk], xf - 0.12, 0.03, dm2, 'mouthBack'); }
  // 霧燈：洞＋殼＋煙燻色燈罩＋裡面的反光碗；車牌：後面一塊凹框＋牌子
  { const fr = new THREE.BoxGeometry(0.012, 0.19, 0.38, 1, 4, 16); fr.translate(-2.112, 0.40, 0); addMesh(fr, Mt.dark, 'plateFrame'); const pl = new THREE.BoxGeometry(0.006, 0.17, 0.34, 1, 8, 16); pl.translate(-2.12, 0.40, 0); addMesh(pl, plateM, 'plate'); } // 後面的車牌：跟前面同一張圖（2:1）
  // 車頂、窗框的橡膠條：玻璃邊上（quadMat 2 已經是黑邊），再加雨槽
  // 引擎蓋上的鈑件（進氣口、導風口）：上面一片（引擎蓋的高度＋H，可以有洞）＋外圈往外往下的圓邊和牆（插進引擎蓋）＋洞往下的圓邊；都是同一個網格，邊才是圓滑的
  // shape：本地 (u, v)；map(u, v) → [x, z]；Hf(x, z)：上面離引擎蓋多高；out(H, nx, nz)：外圈的環 [[o, h]…]（o 往外、h 離引擎蓋）；hole(H)：洞的環（o 往洞裡）
  // inset：上面那片先往裡多一圈（法線才不會在大三角形上拉出條紋）；scale：再往中心縮的幾圈（中間鼓起來）；skip(k, k2, r, N)：外圈這一格不要（開口；N＝每個點往外的方向）
  const hoodPart = (shape, map, Hf, out, hole, { inset = [0.012], scale = [], skip = null, segs = 12 } = {}) => {
    const ex = shape.extractPoints(segs), dd = (A) => { A = A.slice(); if (A.length > 2 && A[0].distanceTo(A[A.length - 1]) < 1e-9) A.pop(); return A; };
    const C = dd(ex.shape), HS = ex.holes.map(dd), pos = [], idx = [], area = (L) => L.reduce((s, p, k) => { const q = L[(k + 1) % L.length]; return s + p.x * q.y - q.x * p.y; }, 0);
    const put = (u, v, h) => { const [x, z] = map(u, v); pos.push(x, hoodY(x, z) + h, z); return pos.length / 3 - 1; };
    const hAt = (u, v) => { const [x, z] = map(u, v); return Hf(x, z); };
    const tri = (a, b, c, e) => { const P = pos, ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      const d = (uy * vz - uz * vy) * e[0] + (uz * vx - ux * vz) * e[1] + (ux * vy - uy * vx) * e[2]; if (d >= 0) idx.push(a, b, c); else idx.push(a, c, b); }; // 三角形朝 e 那邊
    const norms = (L, sg) => { const m = L.length, s = Math.sign(area(L)) * sg; return L.map((p, k) => { const a = L[(k + m - 1) % m], b = L[(k + 1) % m]; const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1; return [(ty / l) * s, (-tx / l) * s]; }); }; // sg 1：外圈往外；−1：洞往洞裡
    const wn = (u, v, nu, nv) => { const [x0, z0] = map(u, v), [x1, z1] = map(u + nu * 1e-3, v + nv * 1e-3); return [(x1 - x0) * 1e3, (z1 - z0) * 1e3]; };
    const strip = (A, B, ef) => { const m = A.length; for (let k = 0; k < m; k++) { const k2 = (k + 1) % m, e = ef(k, k2); if (!e) continue; tri(A[k], A[k2], B[k], e); tri(A[k2], B[k2], B[k], e); } };
    // 外圈：圓邊、牆
    const nC = norms(C, 1), r0 = C.map((p) => put(p.x, p.y, hAt(p.x, p.y))), W = C.map((p, k) => wn(p.x, p.y, nC[k][0], nC[k][1])), R = C.map((p, k) => out(hAt(p.x, p.y), W[k][0], W[k][1]));
    let prev = r0;
    for (let r = 0; r < R[0].length; r++) { const cur = C.map((p, k) => put(p.x + nC[k][0] * R[k][r][0], p.y + nC[k][1] * R[k][r][0], R[k][r][1]));
      strip(prev, cur, (k, k2) => (skip && skip(k, k2, r, nC) ? null : [(W[k][0] + W[k2][0]) / 2, 1, (W[k][1] + W[k2][1]) / 2])); prev = cur; }
    // 上面往裡的幾圈
    let inner = C, ring = r0;
    for (const o of inset) { const pts = C.map((p, k) => new THREE.Vector2(p.x - nC[k][0] * o, p.y - nC[k][1] * o)), cur = pts.map((p) => put(p.x, p.y, hAt(p.x, p.y))); strip(ring, cur, () => [0, 1, 0]); ring = cur; inner = pts; }
    const cu = C.reduce((s, p) => s + p.x, 0) / C.length, cv = C.reduce((s, p) => s + p.y, 0) / C.length, base = inner;
    for (const s of scale) { const pts = base.map((p) => new THREE.Vector2(cu + (p.x - cu) * s, cv + (p.y - cv) * s)), cur = pts.map((p) => put(p.x, p.y, hAt(p.x, p.y))); strip(ring, cur, () => [0, 1, 0]); ring = cur; inner = pts; }
    // 洞：往下的圓邊
    const hr0 = HS.map((L) => L.map((p) => put(p.x, p.y, hAt(p.x, p.y))));
    HS.forEach((L, li) => { const nH = norms(L, -1), WH = L.map((p, k) => wn(p.x, p.y, nH[k][0], nH[k][1])), RH = L.map((p) => hole(hAt(p.x, p.y))); let pv = hr0[li];
      for (let r = 0; r < RH[0].length; r++) { const cur = L.map((p, k) => put(p.x + nH[k][0] * RH[k][r][0], p.y + nH[k][1] * RH[k][r][0], RH[k][r][1])); strip(pv, cur, (k, k2) => [(WH[k][0] + WH[k2][0]) / 2, 1, (WH[k][1] + WH[k2][1]) / 2]); pv = cur; } });
    // 中間那片
    const ids = [...ring, ...hr0.flat()]; for (const f of THREE.ShapeUtils.triangulateShape(inner.map((p) => p.clone()), HS.map((L) => L.map((p) => p.clone())))) tri(ids[f[0]], ids[f[1]], ids[f[2]], [0, 1, 0]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  };
  // 引擎蓋進氣口（照片：側面量 x 1.18–1.47、就在前輪正上面；寬約 0.66；上面差不多平，所以前面比後面高）：圓角的枕頭，後面斜斜的長出來、前面直的
  // 前面整條直邊開一個大嘴巴：裡面黑（盒子）＋5 片直的隔片（車身色）＋後面一片網子；嘴巴一圈車身色的圓唇
  { const xr = 1.23, xf = 1.47, B = 0.33, R0 = 0.012, rr = 0.085, rf = 0.05, a = xr + R0, b = xf - R0, w = B - R0, zE = w - rf;
    const s = new THREE.Shape(); s.moveTo(a + rr, -w); s.lineTo(b - rf, -w); s.absarc(b - rf, -w + rf, rf, -PI / 2, 0, false); s.lineTo(b, w - rf); s.absarc(b - rf, w - rf, rf, 0, PI / 2, false); s.lineTo(a + rr, w); s.absarc(a + rr, w - rr, rr, PI / 2, PI, false); s.lineTo(a, -w + rr); s.absarc(a + rr, -w + rr, rr, PI, 1.5 * PI, false);
    const Hf = (x, z) => 0.026 + 0.024 * Math.min(1, Math.max(0, (x - xr) / (xf - xr))) + 0.007 * (1 - (z / B) ** 2); // 上面離引擎蓋：後 2.6、前 5.0 公分＋中間鼓 0.7（照片側面：比以前低約 1.3 公分）
    const slF = 1.0, amF = Math.atan2(1, slF); // 前面的嘴巴往前斜（照片：從上面看得到嘴巴裡面黑黑的一條）
    const out = (H, nx) => { const sl = nx >= 0 ? 0.25 * (1 - nx * nx) + slF * nx ** 8 : 0.25 + 1.75 * nx * nx, Rb = 0.012 + 0.018 * Math.max(0, -nx), am = Math.atan2(1, sl), Q = []; // sl：牆往外斜（前 0、旁邊 0.25、後面 2.0：照片後面是慢慢長出來的）；Rb：上面的圓邊
      for (let k = 1; k <= 4; k++) { const al = (k / 4) * am; Q.push([Rb * Math.sin(al), H - Rb * (1 - Math.cos(al))]); }
      const [o4, h4] = Q[3]; for (const f of [0.6, 0.25]) Q.push([o4 + sl * (1 - f) * h4, f * h4]); Q.push([o4 + sl * (h4 + 0.008), -0.008]); return Q; }; // 環 4＝圓邊的底（嘴巴上緣）、環 6＝嘴巴下緣、環 7 在引擎蓋下面
    const geo = hoodPart(s, (u, v) => [u, v], Hf, out, null, { inset: [0.015], scale: [0.72, 0.42], segs: 14, skip: (k, k2, r, N) => (r === 4 || r === 5) && N[k][0] > 0.995 && N[k2][0] > 0.995 });
    addMesh(geo, paint2, 'scoop');
    const h4 = (z) => Hf(b, z) - R0 * (1 - Math.cos(amF)), xT = b + R0 * Math.sin(amF), xB = (z) => xT + slF * 0.75 * h4(z), yb = (x, z) => hoodY(x, z) + 0.25 * h4(z) - 0.0015, yt = (z) => hoodY(xT, z) + h4(z) + 0.0012, xb = xf - 0.10, zb = zE + 0.004; // 嘴巴的上緣 h4（x＝xT）、下緣 0.25·h4（x＝xB，往前斜）；裡面的盒子
    const bp = [], bi = [], q = (A, Bq, Cq, Dq) => { const n0 = bp.length / 3; bp.push(...A, ...Bq, ...Cq, ...Dq); bi.push(n0, n0 + 1, n0 + 2, n0, n0 + 2, n0 + 3); };
    for (let k = 0; k < 12; k++) { const z0 = -zb + (2 * zb * k) / 12, z1 = -zb + (2 * zb * (k + 1)) / 12, xe = xT - 0.0008, e0 = xB(z0) - 0.0008, e1 = xB(z1) - 0.0008;
      q([xb, yb(xb, z0), z0], [e0, yb(e0, z0), z0], [e1, yb(e1, z1), z1], [xb, yb(xb, z1), z1]); q([xb, yt(z0), z0], [xe, yt(z0), z0], [xe, yt(z1), z1], [xb, yt(z1), z1]); q([xb, yb(xb, z0), z0], [xb, yt(z0), z0], [xb, yt(z1), z1], [xb, yb(xb, z1), z1]); }
    for (const zz of [-zb, zb]) { const xe = xT - 0.0008, eb = xB(zz) - 0.0008; q([xb, yb(xb, zz), zz], [eb, yb(eb, zz), zz], [xe, yt(zz), zz], [xb, yt(zz), zz]); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setIndex(bi); bg.computeVertexNormals(); const dk = Mt.dark.clone(); dk.side = THREE.DoubleSide; addMesh(bg, dk, 'scoopIn');
    for (let k = -2; k <= 2; k++) { const zz = k * 0.115, fs = new THREE.Shape(); fs.moveTo(xb + 0.004, yb(xb + 0.004, zz) - 0.001); fs.lineTo(xB(zz) - 0.014, yb(xB(zz) - 0.014, zz) - 0.001); fs.lineTo(xT - 0.014, yt(zz) + 0.0005); fs.lineTo(xb + 0.004, yt(zz) + 0.0005); fs.closePath(); // 直的隔片
      const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.004, bevelEnabled: false }); fg.translate(0, 0, zz - 0.002); addMesh(fg, paint2, 'scoopFin'); } // 隔片：5 片、車身色（照片）
    { const nm = meshMat.clone(); nm.map = meshTex.clone(); nm.map.repeat.set(1 / 0.07, 1 / 0.07); nm.map.needsUpdate = true; nm.color = new THREE.Color(0x34363a); const mp = [], mi = [], mu = []; // 最裡面一片網子
      for (let k = 0; k <= 12; k++) { const zz = -zE + (2 * zE * k) / 12; mp.push(xb + 0.003, yb(xb + 0.003, zz), zz, xb + 0.003, yt(zz), zz); mu.push(zz, 0, zz, yt(zz) - yb(xb, zz)); if (k) { const n0 = (k - 1) * 2; mi.push(n0, n0 + 2, n0 + 1, n0 + 1, n0 + 2, n0 + 3); } }
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3)); mg.setAttribute('uv', new THREE.Float32BufferAttribute(mu, 2)); mg.setIndex(mi); mg.computeVertexNormals(); addMesh(mg, nm, 'scoopNet'); }
    { const rc = 0.009, hb = (z) => 0.25 * h4(z), H4 = h4(zE), HB = hb(zE), pts = [], arc = (cz, ch, a0) => { for (let k = 0; k <= 6; k++) { const al = a0 + (k / 6) * (PI / 2); pts.push([cz + rc * Math.cos(al), ch + rc * Math.sin(al)]); } }; // 嘴巴的唇：沿著開口一圈，角是圓的
      arc(zE - rc, H4 - rc, 0); for (let k = 1; k < 24; k++) { const z = zE - rc - (2 * (zE - rc) * k) / 24; pts.push([z, h4(z)]); } arc(-zE + rc, H4 - rc, PI / 2);
      arc(-zE + rc, HB + rc, PI); for (let k = 1; k < 24; k++) { const z = -zE + rc + (2 * (zE - rc) * k) / 24; pts.push([z, hb(z)]); } arc(zE - rc, HB + rc, 1.5 * PI);
      const crv = new THREE.CatmullRomCurve3(pts.map(([z, h]) => { const x = xT + (xB(z) - xT) * Math.min(1, Math.max(0, (h4(z) - h) / (0.75 * h4(z)))) + 0.001; return new THREE.Vector3(x, hoodY(x, z) + h, z); }), true); addMesh(new THREE.TubeGeometry(crv, 260, 0.0042, 8, true), paint2, 'scoopLip'); } }
  // 導風口（照片 799a5c7f、ce7d28d4：進氣口前面、兩邊靠外，x 約 1.55–1.74、z 約 0.43–0.62）：低低的車身色框（兩個洞外面一圈約 1.2 公分，外形把兩個洞包起來）＋兩個圓角的洞（黑色扁六角網）；裡面那個大、往前長，外面那個小、往後一點
  { const rrP = (u0, v0, u1, v1, r, n = 8) => { const P = []; for (const [cu, cv, a0] of [[u1 - r, v0 + r, -PI / 2], [u1 - r, v1 - r, 0], [u0 + r, v1 - r, PI / 2], [u0 + r, v0 + r, PI]]) for (let k = 0; k <= n; k++) { const a = a0 + (k / n) * (PI / 2); P.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]); } return P; }; // 圓角長方形一圈（逆時針）
    const hull = (P) => { const S = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = []; for (const p of S) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } for (const p of S.slice().reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); }; // 凸包（逆時針）
    const HO = [[-0.073, -0.073, 0.089, 0.001, 0.024], [-0.082, 0.033, 0.063, 0.093, 0.022]], FL = 0.012; // 兩個洞：u0 v0 u1 v1 圓角（u＝往前、v＝往外；照片：裡面 7.4×16 公分、外面 6×14.5、中間隔 3.2）
    const V2 = (P) => P.map(([u, v]) => new THREE.Vector2(u, v)), s = new THREE.Shape(V2(hull(HO.flatMap(([u0, v0, u1, v1, r]) => rrP(u0 - FL, v0 - FL, u1 + FL, v1 + FL, r + FL)))));
    for (const [u0, v0, u1, v1, r] of HO) s.holes.push(new THREE.Path(V2(rrP(u0, v0, u1, v1, r))));
    const cx = 1.64, cz = 0.51, map = (u, v) => [cx + u, cz + v], FH = 0.009;
    const geo = hoodPart(s, map, () => FH, (H) => [[0.0022, H - 0.0006], [0.004, H - 0.0022], [0.0048, H - 0.0045], [0.0052, -0.003]], (H) => [[0.0018, H - 0.0005], [0.0032, H - 0.002], [0.0038, H - 0.0045], [0.004, 0.0012]], { inset: [0.004], segs: 10 });
    both(geo, paint2, 'vent');
    const nm = new THREE.MeshStandardMaterial({ map: hexFlat(14), transparent: true, alphaTest: 0.5, color: 0x101112, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }); nm.userData.slot = 'netF'; nm.map.repeat.set(1 / 0.03, 1 / 0.0135); // 扁六角：長的那邊橫著（z），一格約 2×1.35 公分
    for (const [u0, v0, u1, v1, r] of HO) { const L = rrP(u0, v0, u1, v1, r);
      for (const [lift, mat, nmn] of [[0.0006, Mt.dark, 'ventBack'], [0.0011, nm, 'ventNet']]) { const hg = new THREE.ShapeGeometry(new THREE.Shape(V2(L)), 1), p = hg.attributes.position, uv = hg.attributes.uv; for (let k = 0; k < p.count; k++) { const u = p.getX(k), v = p.getY(k), [x, z] = map(u, v); uv.setXY(k, v, u); p.setXYZ(k, x, hoodY(x, z) + lift, z); }
        const I = hg.index.array; for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; } hg.computeVertexNormals(); both(hg, mat, nmn); } } } // shape 的 y → 世界的 z：三角形要翻過來才朝上；uv 對調：六角長的那邊橫著
  // 洗窗器的噴嘴（照片：進氣口後面兩個小黑點）
  for (const z of [0.25, -0.25]) { const ng = new THREE.SphereGeometry(0.007, 14, 8, 0, 2 * PI, 0, PI / 2); ng.scale(1.3, 0.75, 1); ng.translate(1.07, hoodY(1.07, z) - 0.0005, z); addMesh(ng, Mt.dark, 'washer'); }
  // 車頂的導風罩（照片：車頂前面、擋風玻璃上緣後面，煙燻黑色，前面翹起來 4 公分、寬約 0.34）
  { const xa = -0.115, xc = 0.07, ry = (x) => hoodY(x, 0), sh = new THREE.Shape(); sh.moveTo(xa, ry(xa) - 0.004); sh.lineTo(xc, ry(xc) - 0.004); sh.lineTo(xc + 0.004, ry(xc) + 0.036); sh.quadraticCurveTo(xc - 0.01, ry(xc) + 0.044, xc - 0.05, ry(xc - 0.05) + 0.036); sh.quadraticCurveTo(xa + 0.03, ry(xa + 0.03) + 0.012, xa, ry(xa) + 0.002); sh.closePath();
    const rg = new THREE.ExtrudeGeometry(sh, { depth: 0.33, curveSegments: 10, steps: 6, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3 }); rg.translate(0, 0, -0.165);
    const p = rg.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k); p.setY(k, p.getY(k) + hoodY(x, z) - ry(x)); } // 車頂兩邊比較低：跟著彎
    addMesh(crease(rg), Mt.smoke, 'roofVent');
    const og = new THREE.PlaneGeometry(0.30, 0.024); og.rotateY(PI / 2); og.translate(xc + 0.0105, ry(xc) + 0.016, 0); addMesh(og, Mt.dark, 'roofVentIn'); } // 前面的開口
  // 側燈（照片：前葉子板、門縫前面，橘色的長圓形）
  { const xm = 0.95, ym = 0.732, zs = sideZ(xm, ym), n = new THREE.Vector3(sideZ(xm - 0.01, ym) - sideZ(xm + 0.01, ym), sideZ(xm, ym - 0.01) - sideZ(xm, ym + 0.01), 0.02).normalize(), qn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    const pill = (L, Hh) => { const p = new THREE.Shape(), r = Hh / 2; p.moveTo(-L / 2 + r, -r); p.lineTo(L / 2 - r, -r); p.absarc(L / 2 - r, 0, r, -PI / 2, PI / 2, false); p.lineTo(-L / 2 + r, r); p.absarc(-L / 2 + r, 0, r, PI / 2, 1.5 * PI, false); return p; };
    const rim = new THREE.ExtrudeGeometry(pill(0.10, 0.034), { depth: 0.002, bevelEnabled: false, curveSegments: 16 }); rim.applyQuaternion(qn); rim.translate(xm, ym, zs - 0.0005); both(rim, Mt.trim, 'markerRim');
    const ln = new THREE.ExtrudeGeometry(pill(0.094, 0.028), { depth: 0.002, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 3, curveSegments: 16 }); ln.applyQuaternion(qn); ln.translate(xm, ym, zs + 0.0012); both(crease(ln), Mt.lensAmber, 'marker'); }
  // 後視鏡（照片）：車窗前下角一塊三角形的座（車身色）＋圓圓的殼（前面像子彈頭、後面平的放鏡子）
  for (const s of [1, -1]) {
    const tri = new THREE.Shape(); tri.moveTo(0.795, 0.952); tri.lineTo(0.625, 0.952); tri.quadraticCurveTo(0.655, 1.0, 0.69, 1.032); tri.closePath(); // 三角座（側面看）
    const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 }); tg.translate(0, 0, s > 0 ? 0.748 : -0.748 - 0.022); addMesh(crease(tg), paint2, 'mirrorSail');
    const W = 0.165, Hh = 0.052, rO = 0.046, rI = 0.022, D = 0.05, BT = 0.022, sh = new THREE.Shape(); // 殼的正面輪廓（u＝往外、v＝上下）
    sh.moveTo(0, -Hh + rI); sh.quadraticCurveTo(0, -Hh, rI, -Hh); for (const [x1, y1, cx, cy, x2, y2] of [[W - rO, -Hh, W, -Hh, W, -Hh + rO], [W, Hh - rO, W, Hh, W - rO, Hh], [rI, Hh, 0, Hh, 0, Hh - rI]]) { sh.lineTo(x1, y1); sh.quadraticCurveTo(cx, cy, x2, y2); } sh.closePath();
    const hg = new THREE.ExtrudeGeometry(sh, { depth: D, curveSegments: 10, bevelEnabled: true, bevelThickness: BT, bevelSize: 0.016, bevelSegments: 5 });
    { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) { const zz = p.getZ(i); if (zz < D * 0.6) { const t = (D * 0.6 - zz) / (D * 0.6 + BT), f = 1 - 0.30 * t * t; p.setX(i, W * 0.5 + (p.getX(i) - W * 0.5) * f); p.setY(i, (p.getY(i)) * (1 - 0.18 * t * t)); } } } // 前面收圓（子彈頭）
    hg.rotateY(-PI / 2); hg.computeVertexNormals(); // shape 的 x（往外）→ 車的 z、擠出的方向 → 往車尾
    if (s < 0) { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -p.getZ(i)); for (let i = 0; i < p.count; i += 3) { for (const attr of [p, hg.attributes.normal, hg.attributes.uv]) { if (!attr) continue; const n = attr.itemSize; for (let c = 0; c < n; c++) { const t1 = attr.array[(i + 1) * n + c]; attr.array[(i + 1) * n + c] = attr.array[(i + 2) * n + c]; attr.array[(i + 2) * n + c] = t1; } } } hg.computeVertexNormals(); }
    hg.translate(0.742, 0.998, 0.772 * s); addMesh(crease(hg, 0.9), paint2, 'mirrorShell');
    const fs = new THREE.Shape(); fs.moveTo(0.012, -0.036); fs.lineTo(W - 0.04, -0.036); fs.quadraticCurveTo(W - 0.008, -0.036, W - 0.008, -0.004); fs.lineTo(W - 0.008, 0.012); fs.quadraticCurveTo(W - 0.008, 0.04, W - 0.04, 0.04); fs.lineTo(0.012, 0.04); fs.closePath();
    const fg = new THREE.ShapeGeometry(fs, 8); if (s < 0) { const p = fg.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, -p.getX(i)); const I = fg.index.array; for (let k = 0; k < I.length; k += 3) { const t1 = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t1; } }
    fg.rotateY(-PI / 2); fg.translate(0.742 - D - BT - 0.002, 0.998, 0.772 * s); // 鏡子朝後（−x）
    const fm = Mt.chrome.clone(); fm.color.set(0x9aa3aa); fm.roughness = 0.03; fm.userData.slot = 'mirror'; addMesh(fg, fm, 'mirrorGlass'); }
  // 門把：凹槽＋把手
  for (const s of [1, -1]) { const pocket = new THREE.BoxGeometry(0.17, 0.05, 0.02); pocket.translate(-0.36, 0.80, 0.826 * s); addMesh(pocket, Mt.dark, 'pocket'); const bar = new THREE.BoxGeometry(0.11, 0.022, 0.018); bar.translate(-0.35, 0.80, 0.84 * s); addMesh(bar, Mt.trim, 'handle'); }
  // 雨刷：停著的時候橫躺在擋風玻璃最下面、貼著玻璃，兩支都往左躺（右邊駕駛座那支長一點）；以前立在玻璃上，從駕駛座看會擋在前面
  { const x = 0.80, t = (WS_X0 - x) / (WS_X0 - WS_X1), y = COWL[13][1] + t * (ROOF0[13][1] - COWL[13][1]) + 0.05 * t * (1 - t), a = -0.72, nx = Math.sin(-a), ny = Math.cos(a); // 玻璃中線在 x 的高度；(nx, ny)＝玻璃的法線
    for (const [z0, L] of [[0.52, 0.50], [-0.02, 0.44]]) { const zc = z0 - L / 2;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, L), Mt.trim); arm.position.set(x + nx * 0.016, y + ny * 0.016, zc); arm.rotation.z = a; arm.castShadow = true; g.add(arm);
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.008, L - 0.04), Mt.rubber); bl.position.set(x + nx * 0.006, y + ny * 0.006, zc - 0.01); bl.rotation.z = a; g.add(bl); } }
  // 尾翼（照片）：一整片：翼片橫過整個行李廂蓋，兩頭往下接寬寬薄薄、往後斜的腳（腳在最外面），腳底一塊座；第三煞車燈在行李廂蓋前面（後擋風玻璃下面）
  { const ZW = 0.705, LT = 0.045; // 翼片半寬（＝腳的外面）、腳的厚度
    const af = new THREE.Shape(); // 翼片剖面（x 往車頭、y 往上）：前緣圓、後緣薄
    af.moveTo(0.114, 0.004); af.bezierCurveTo(0.12, 0.022, 0.09, 0.031, 0.04, 0.032); af.bezierCurveTo(-0.03, 0.033, -0.09, 0.029, -0.114, 0.025); af.lineTo(-0.116, 0.013); af.bezierCurveTo(-0.08, 0.004, -0.02, -0.006, 0.05, -0.008); af.bezierCurveTo(0.095, -0.009, 0.112, -0.004, 0.114, 0.004);
    const bg = new THREE.ExtrudeGeometry(af, { depth: 2 * ZW - 0.008, curveSegments: 16, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3 });
    bg.translate(0, 0, -ZW + 0.004); bg.scale(1, 1.3, 1); bg.rotateZ(-0.09); bg.translate(-1.965, 1.232, 0); addMesh(crease(bg), paint2, 'wing'); // 後面翹一點
    const yb = (x) => topY(x, ZW - 0.03) - 0.012; // 腳底貼著行李廂蓋
    const xr0 = -2.05, xf0 = -1.878, xr1 = -1.975, xf1 = -1.735; // 腳：上緣（翼片下面）後、前；下緣（腳底）後、前 → 往後斜、下面比較寬
    for (const s of [1, -1]) { const zl = s * (ZW - LT / 2);
      const ls = new THREE.Shape(); ls.moveTo(xr1, yb(xr1)); ls.lineTo(xf1, yb(xf1)); ls.quadraticCurveTo(-1.835, 1.10, xf0, 1.236); ls.lineTo(xr0, 1.242); ls.quadraticCurveTo(-2.03, 1.06, xr1, yb(xr1));
      const lg = new THREE.ExtrudeGeometry(ls, { depth: LT - 0.012, curveSegments: 12, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3 }); lg.translate(0, 0, zl - (LT - 0.012) / 2); addMesh(crease(lg), paint2, 'wingLeg');
      const fa = -1.995, fb = -1.565, fp = new THREE.Shape(); fp.moveTo(fa, yb(fa) - 0.004); fp.lineTo(fb, yb(fb) - 0.004); fp.lineTo(fb - 0.02, yb(fb) + 0.032); fp.lineTo(fa + 0.025, yb(fa) + 0.036); fp.closePath();
      const fg2 = new THREE.ExtrudeGeometry(fp, { depth: 0.044, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3 }); fg2.translate(0, 0, zl - 0.022); addMesh(crease(fg2), paint2, 'wingFoot'); }
    { // 腳底中間一條橫的座（照片：後擋風玻璃下面，從左腳接到右腳，車身色），第三煞車燈在座的後面中間（煙燻的燈罩）
      const xc = -1.588, hw = 0.032, H = 0.03, Z = ZW - 0.006, sec = [], ns = 24, nz = 48; for (let k = 0; k < ns; k++) { const a = (k / ns) * 2 * PI; sec.push([hw * Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.35, H * (0.5 + 0.5 * Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.35)]); } // 剖面：圓角的方塊（超橢圓）
      const pp = [], ii = []; for (let j = 0; j <= nz; j++) { const z = -Z + (2 * Z * j) / nz, y0 = topY(xc, z) - 0.006; for (const [dx, dy] of sec) pp.push(xc + dx, y0 + dy, z); }
      for (let j = 0; j < nz; j++) for (let k = 0; k < ns; k++) { const a = j * ns + k, b = j * ns + ((k + 1) % ns), c2 = a + ns, d = b + ns; ii.push(a, b, d, a, d, c2); }
      for (const [j, sg] of [[0, 1], [nz, -1]]) { const c0 = pp.length / 3, z = -Z + (2 * Z * j) / nz; pp.push(xc, topY(xc, z) - 0.006 + H / 2, z); for (let k = 0; k < ns; k++) { const a = j * ns + k, b = j * ns + ((k + 1) % ns); if (sg > 0) ii.push(c0, b, a); else ii.push(c0, a, b); } }
      const bg2 = new THREE.BufferGeometry(); bg2.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); bg2.setIndex(ii); bg2.computeVertexNormals(); addMesh(bg2, paint2, 'wingBase');
      const sy = topY(xc, 0) - 0.006; const hb = new THREE.BoxGeometry(0.008, 0.016, 0.34); hb.translate(xc - hw - 0.001, sy + H * 0.55, 0); addMesh(hb, Mt.smoke, 'stopBox');
      const sl = new THREE.BoxGeometry(0.004, 0.008, 0.30); sl.translate(xc - hw - 0.004, sy + H * 0.55, 0); addMesh(sl, Mt.lensRed, 'stopLamp'); } }
  // 排氣管（左後，照片）：亮亮的不鏽鋼尾管＋捲邊；裡面一層燻黑的套管（第 54 批：以前管子裡面也是亮的）、更裡面黑的底
  { const z = -0.40, xe = -2.06, tm = new THREE.MeshStandardMaterial({ color: 0xd4d6d8, roughness: 0.16, metalness: 1, side: THREE.DoubleSide }); tm.userData.slot = 'bright';
    const tip = new THREE.CylinderGeometry(0.047, 0.047, 0.20, 40, 1, true); tip.rotateZ(PI / 2); tip.translate(xe - 0.06, 0.255, z); addMesh(tip, tm, 'exhaust');
    const lip = new THREE.TorusGeometry(0.044, 0.004, 10, 40); lip.rotateY(PI / 2); lip.translate(xe - 0.16, 0.255, z); addMesh(lip, tm, 'exhaustLip');
    const soot = new THREE.MeshStandardMaterial({ color: 0x1e1c1a, roughness: 0.9 }); soot.userData.slot = 'dark';
    const sl = new THREE.CylinderGeometry(0.0435, 0.0435, 0.15, 32, 1, true); sl.rotateZ(PI / 2); sl.translate(xe - 0.08, 0.255, z); addMesh(inward(sl), soot, 'exhaustSoot'); // 套管：從管口往裡 15 公分
    const inn = new THREE.CircleGeometry(0.044, 32); inn.rotateY(-PI / 2); inn.translate(xe - 0.01, 0.255, z); addMesh(inn, Mt.dark, 'exhaustIn'); }
  // 車底（第 54 批）：消音器、排氣管、觸媒、中段消音器、傳動軸、後差速器、油箱、下擺臂、引擎下護板；從後面、旁邊低低的看得到
  // 都放在「under」那一組（烘焙成一組、輕量車不要）；最低 12 公分（車身最低 12.5）
  { const um = (c, r = 0.75, mt = 0.35) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: mt }); m.userData.slot = 'under'; return m; };
    const steel = um(0x5b5853, 0.6, 0.6), pipe = um(0x48443f, 0.65, 0.55), black = um(0x1b1c1e, 0.8, 0.2), cast = um(0x34353a, 0.7, 0.45), plast = um(0x161719, 0.9, 0);
    const tube = (pts, r, m, name, seg = 48) => addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, zz]) => new THREE.Vector3(x, y, zz))), seg, r, 12, false), m, name);
    const can = (x0, x1, ry, rz, y, zz, m, name, cap = true) => { const c = new THREE.CylinderGeometry(1, 1, x1 - x0, 24, 1, !cap); c.rotateZ(PI / 2); c.scale(1, ry, rz); c.translate((x0 + x1) / 2, y, zz); return addMesh(c, m, name); }; // 橢圓的罐子（沿著 x）
    const box = (x, y, zz, sx, sy, sz, m, name, ry = 0) => { const b = new THREE.BoxGeometry(sx, sy, sz); if (ry) b.rotateY(ry); b.translate(x, y, zz); return addMesh(b, m, name); };
    // 後消音器（左後、保桿下面看得到）＋兩條吊帶；出口接到尾管
    can(-1.98, -1.60, 0.052, 0.105, 0.178, -0.42, steel, 'muffler'); // z −0.525…−0.315：賽道套件的擴散器（z ±0.31）旁邊
    for (const x of [-1.66, -1.92]) can(x - 0.012, x + 0.012, 0.055, 0.108, 0.178, -0.42, black, 'mufflerBand', false);
    tube([[-1.95, 0.20, -0.42], [-1.99, 0.215, -0.415], [-2.02, 0.245, -0.40], [-2.05, 0.255, -0.40]], 0.03, pipe, 'tailPipe', 16);
    // 排氣管：從引擎（前面）沿著地板左邊到消音器；前面一顆觸媒、中間一顆中段消音器
    tube([[1.02, 0.162, -0.11], [0.85, 0.153, -0.14], [0.6, 0.151, -0.15], [0.0, 0.151, -0.17], [-0.7, 0.151, -0.20], [-1.25, 0.152, -0.30], [-1.50, 0.16, -0.40], [-1.62, 0.17, -0.42]], 0.026, pipe, 'exhaustPipe', 96); // 前面從引擎下護板後面出來
    can(0.58, 0.86, 0.033, 0.055, 0.153, -0.15, steel, 'cat');
    can(-0.48, -0.10, 0.031, 0.062, 0.152, -0.185, steel, 'resonator');
    // 傳動軸（四輪傳動：前面到後差速器）＋中間的軸承座、萬向節；後差速器（半軸在地板上面，看不到）
    can(-1.10, 0.70, 0.032, 0.032, 0.17, 0, black, 'driveshaft');
    for (const x of [0.66, -0.18, -1.06]) can(x - 0.03, x + 0.03, 0.04, 0.04, 0.17, 0, cast, 'ujoint');
    box(-0.18, 0.152, 0, 0.07, 0.03, 0.16, cast, 'shaftMount');
    { const d = new THREE.SphereGeometry(1, 20, 12); d.scale(0.12, 0.055, 0.13); d.translate(-1.24, 0.185, 0); addMesh(d, cast, 'diff'); }
    // 油箱（右邊、後座下面）＋兩條固定帶
    { const sh = new THREE.Shape(); sh.moveTo(-0.60, -0.02); sh.lineTo(-0.60, 0.56); sh.quadraticCurveTo(-0.60, 0.60, -0.64, 0.60); sh.lineTo(-1.04, 0.60); sh.quadraticCurveTo(-1.08, 0.60, -1.08, 0.56); sh.lineTo(-1.08, -0.02); sh.quadraticCurveTo(-1.08, -0.06, -1.04, -0.06); sh.lineTo(-0.64, -0.06); sh.quadraticCurveTo(-0.60, -0.06, -0.60, -0.02);
      const tg = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 2, curveSegments: 6 }); tg.rotateX(PI / 2); tg.translate(0, 0.149, 0); addMesh(crease(tg), black, 'fuelTank'); } // x–z 平面的圓角板子，往下厚 2.8 公分
    for (const x of [-0.70, -0.98]) box(x, 0.1275, 0.27, 0.035, 0.003, 0.70, cast, 'tankStrap');
    // 下擺臂（前、後；靠輪子那一段，車底是平的：高過 15 公分的都在車身裡面看不到）、引擎下護板（黑塑膠，蓋住前面的橫樑）
    for (const s of [1, -1]) { box(-1.17, 0.14, 0.51 * s, 0.05, 0.03, 0.20, cast, 'armR'); box(-1.33, 0.14, 0.51 * s, 0.04, 0.025, 0.20, cast, 'armR2');
      box(1.24, 0.14, 0.45 * s, 0.05, 0.03, 0.26, cast, 'armF', 0.25 * s); }
    { const sh = new THREE.Shape(); sh.moveTo(0.95, -0.36); sh.lineTo(1.72, -0.30); sh.lineTo(1.72, 0.30); sh.lineTo(0.95, 0.36); sh.closePath();
      const pg = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.008, bevelSegments: 1 }); pg.rotateX(PI / 2); pg.translate(0, 0.142, 0); addMesh(pg, plast, 'underTray'); } }
  // 車內（透過玻璃看得到）：儀表板（側面輪廓拉出來）、儀表罩、方向盤、兩張桶椅（側面輪廓拉出來）、後座、門板、地板、天篷（烘焙的不要：遊戲用 cabin.js 的車內）
  if (!opt.bake) { const ds = new THREE.Shape(); ds.moveTo(0.38, 0.66); ds.lineTo(0.38, 0.84); ds.quadraticCurveTo(0.53, 0.93, 0.83, 0.91); ds.lineTo(0.84, 0.66); ds.closePath();
    const dg = new THREE.ExtrudeGeometry(ds, { depth: 1.36, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }); dg.translate(0, 0, -0.68); addMesh(dg, Mt.plastic, 'dash');
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.30, 32, 1, false, 0, PI), Mt.plastic); bin.geometry.rotateZ(PI / 2); bin.geometry.rotateY(PI / 2); bin.position.set(0.50, 0.93, 0.37); g.add(bin); // 儀表罩
    const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.06, 32), Mt.dark); gauge.geometry.rotateY(-PI / 2); gauge.position.set(0.43, 0.92, 0.37); g.add(gauge);
    const sw = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 16, 64), Mt.plastic); sw.position.set(0.31, 0.86, 0.37); sw.rotation.y = PI / 2; sw.rotation.x = 0.35; g.add(sw); for (const a of [0, 2.1, -2.1]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.17, 0.04), Mt.plastic); sp.position.set(0, 0.085, 0); const pv = new THREE.Group(); pv.add(sp); pv.rotation.z = a; const h2 = new THREE.Group(); h2.add(pv); h2.position.copy(sw.position); h2.rotation.copy(sw.rotation); g.add(h2); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 24), Mt.plastic); hub.position.copy(sw.position); hub.rotation.z = PI / 2; hub.rotation.y = 0.35; g.add(hub);
    const seatM = new THREE.MeshStandardMaterial({ color: 0x24407f, roughness: 0.92, envMapIntensity: 0.4 }), seatD = new THREE.MeshStandardMaterial({ color: 0x16285a, roughness: 0.9, envMapIntensity: 0.4 }); seatM.userData.slot = seatD.userData.slot = 'interior'; // 椅子（照片）：藍色的布、旁邊深一點
    const ss = new THREE.Shape(); ss.moveTo(0.25, 0.40); ss.lineTo(0.25, 0.54); ss.quadraticCurveTo(0.07, 0.58, -0.13, 0.56); ss.lineTo(-0.33, 1.08); ss.quadraticCurveTo(-0.37, 1.15, -0.45, 1.12); ss.lineTo(-0.49, 0.40); ss.closePath();
    for (const z of [0.37, -0.37]) { const sg = new THREE.ExtrudeGeometry(ss, { depth: 0.46, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 4 }); sg.translate(0, 0, z - 0.23); addMesh(sg, seatM, 'seat');
      const bol = new THREE.BoxGeometry(0.14, 0.50, 0.06); for (const zz of [z - 0.24, z + 0.24]) { const b2 = bol.clone(); b2.translate(-0.35, 0.85, zz); addMesh(b2, seatD, 'bolster'); }
      const hr = new THREE.ExtrudeGeometry((() => { const h = new THREE.Shape(); h.moveTo(-0.05, 0); h.lineTo(0.05, 0); h.lineTo(0.05, 0.14); h.lineTo(-0.05, 0.14); h.closePath(); return h; })(), { depth: 0.20, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }); hr.translate(-0.49, 1.16, z - 0.10); addMesh(hr, seatM, 'headrest'); }
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 1.30), seatM); bench.position.set(-1.05, 0.54, 0); g.add(bench); const bb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.50, 1.30), seatD); bb.position.set(-1.36, 0.78, 0); bb.rotation.z = -0.3; g.add(bb);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.02, 1.55), Mt.cloth); floor.position.set(-0.6, 0.33, 0); g.add(floor); const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 1.4), Mt.cloth); shelf.position.set(-1.48, 0.905, 0); g.add(shelf);
    const tun = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.26), Mt.plastic); tun.position.set(0.0, 0.44, 0); g.add(tun); const shift = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 12), Mt.alu); shift.position.set(0.12, 0.64, 0); g.add(shift); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), Mt.plastic); knob.position.set(0.12, 0.74, 0); g.add(knob);
    for (const s of [1, -1]) { const card = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.50, 0.03), Mt.plastic); card.position.set(0.12, 0.60, 0.745 * s); g.add(card); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.05, 0.06), Mt.plastic); arm.position.set(0.08, 0.74, 0.72 * s); g.add(arm); }
    const liner = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 1.1), Mt.liner); liner.position.set(-0.45, 1.31, 0); g.add(liner);
  }
  { const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.006, 1.40), Mt.trim); cowl.position.set(0.86, 0.928, 0); g.add(cowl); } // 擋風玻璃下面的黑條（車外，烘焙也要）
  // 車頭短一點（照片：前懸比後懸短，兩張側面照都是）：前輪拱前面（x > 1.66）往後壓 17%，前懸 0.955 → 0.855；輪拱還是圓的
  { const X0 = 1.66, K = 0.826, done = new Set(); g.updateMatrixWorld(true);
    g.traverse((o) => { if (!o.isMesh || done.has(o.geometry)) return; const geo = o.geometry; geo.computeBoundingBox(); const bb = geo.boundingBox.clone().applyMatrix4(o.matrixWorld); if (bb.max.x <= X0) return;
      if (o.parent !== g) return; if (!o.matrix.equals(new THREE.Matrix4())) { geo.applyMatrix4(o.matrix); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); }
      done.add(geo); const P = geo.attributes.position, N = geo.attributes.normal;
      for (let i = 0; i < P.count; i++) { const x = P.getX(i); if (x <= X0) continue; P.setX(i, X0 + (x - X0) * K); if (N) { const nx2 = N.getX(i) / K, ny2 = N.getY(i), nz2 = N.getZ(i), l = Math.hypot(nx2, ny2, nz2) || 1; N.setXYZ(i, nx2 / l, ny2 / l, nz2 / l); } }
      P.needsUpdate = true; if (N) N.needsUpdate = true; geo.computeBoundingBox(); geo.computeBoundingSphere(); }); }
  // 車頭、車尾從上面看是圓弧（照片：保桿的角是圓的，大燈、尾燈包到側面）：前輪拱前面、後輪拱後面的東西繞一根直立的軸彎（車頭半徑 2.3 公尺、車尾 2.6），越靠近頭（尾）彎越多；尾翼上面不彎
  // 整台車的變形：fn(x, y, z, out) 搬點；法線乘上 Jacobian 的反轉置（三個偏微分兩兩外積）再變成長度 1；inR(x) 是 false 的點不動
  const deformAll = (fn, inR) => { const e = 1e-4, o = [0, 0, 0], A = [0, 0, 0], B = [0, 0, 0], c0 = [0, 0, 0], c1 = [0, 0, 0], c2 = [0, 0, 0], done = new Set();
    const col = (c, x, y, z, dx, dy, dz) => { fn(x + dx, y + dy, z + dz, A); fn(x - dx, y - dy, z - dz, B); for (let k = 0; k < 3; k++) c[k] = (A[k] - B[k]) / (2 * e); };
    const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    g.updateMatrixWorld(true);
    g.traverse((m) => { if (!m.isMesh || m.parent !== g || done.has(m.geometry)) return; const geo = m.geometry; geo.computeBoundingBox(); const bb = geo.boundingBox.clone().applyMatrix4(m.matrixWorld); if (!inR(bb.max.x) && !inR(bb.min.x)) return;
      if (!m.matrix.equals(new THREE.Matrix4())) { geo.applyMatrix4(m.matrix); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1); m.updateMatrix(); }
      done.add(geo); const P = geo.attributes.position, N = geo.attributes.normal;
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (!inR(x)) continue;
        if (N) { col(c0, x, y, z, e, 0, 0); col(c1, x, y, z, 0, e, 0); col(c2, x, y, z, 0, 0, e); const a = cr(c1, c2), b = cr(c2, c0), c = cr(c0, c1), n0 = N.getX(i), n1 = N.getY(i), n2 = N.getZ(i);
          const X2 = a[0] * n0 + b[0] * n1 + c[0] * n2, Y2 = a[1] * n0 + b[1] * n1 + c[1] * n2, Z2 = a[2] * n0 + b[2] * n1 + c[2] * n2, l = Math.hypot(X2, Y2, Z2) || 1; N.setXYZ(i, X2 / l, Y2 / l, Z2 / l); }
        fn(x, y, z, o); P.setXYZ(i, o[0], o[1], o[2]); }
      P.needsUpdate = true; if (N) N.needsUpdate = true; geo.computeBoundingBox(); geo.computeBoundingSphere(); }); };
  { const FX = 2.135, FR = 2.3, F0 = 1.70, F1 = 2.10, RX = -2.122, RR = 2.6, R0 = -1.72, R1 = -2.08, ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
    const bend = (x, y, z, o) => { o[1] = y;
      if (x > F0) { const w = ss((x - F0) / (F1 - F0)), r = FR - FX + x, t = z / FR; o[0] = x + w * (FX - FR + r * Math.cos(t) - x); o[2] = z + w * (r * Math.sin(t) - z); }
      else if (x < R0) { const w = ss((R0 - x) / (R0 - R1)) * (1 - ss((y - 0.98) / 0.2)), r = RR + RX - x, t = z / RR; o[0] = x + w * (RX + RR - r * Math.cos(t) - x); o[2] = z + w * (r * Math.sin(t) - z); }
      else { o[0] = x; o[2] = z; }
      return o; };
    // 保桿正面鼓起來（照片：側面看保桿是圓的，中間高度往前凸 3.5 公分，上下收回去）：先鼓、再彎
    const bulge = (x, y, z, o) => { const t = (y - 0.40) / 0.17, by = Math.abs(t) < 1 ? (1 - t * t) ** 2 : 0, bz = 1 - ss((Math.abs(z) - 0.35) / 0.40); o[0] = x + 0.035 * by * bz * ss((x - 2.06) / 0.075); o[1] = y; o[2] = z; return o; };
    deformAll(bulge, (x) => x > 2.06); deformAll(bend, (x) => x > F0 || x < R0); }
  // ---- 輪子 ----
  const wheelInfo = [];
  if (!opt.bake) for (const [xa, s] of [[XF, 1], [XF, -1], [XR, 1], [XR, -1]]) { const w = wheel(THREE, Mt); w.position.set(xa, RW, TRACK * s); if (s < 0) w.rotation.y = PI; g.add(w); wheelInfo.push(w); } // 烘焙的不要：遊戲用 parts.js 的輪子
  let tris = 0; g.traverse((o) => { if (o.isMesh) { const gg = o.geometry; tris += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; } });
  window.__CAR2G = G; // 除錯用：格子（變形前的座標）
  return { group: g, info: { tris: Math.round(tris), bodyTris: index.length / 3, ms: Math.round(performance.now() - t0), nx, M }, mats: Mt };
}
// ---- 輪子（外側朝 +z）：有胎紋的輪胎、六輻金色輪框、輪唇、輪轂、螺絲、煞車碟盤＋紅色卡鉗 ----
function wheel(THREE, Mt) {
  const g = new THREE.Group(), R = RW, w = TW, rim = RIM;
  // 輪胎
  { const prof = [[rim - 0.002, -w / 2 + 0.012], [rim + 0.016, -w / 2 + 0.002], [R - 0.045, -w / 2], [R - 0.016, -w / 2 + 0.008], [R - 0.003, -w / 2 + 0.028], [R, -w / 2 + 0.05]];
    const z0 = -w / 2 + 0.05, z1 = w / 2 - 0.05, nz = Math.round((z1 - z0) / 0.0025); for (let k = 1; k <= nz; k++) prof.push([R, z0 + (z1 - z0) * k / nz]);
    prof.push([R - 0.003, w / 2 - 0.028], [R - 0.016, w / 2 - 0.008], [R - 0.045, w / 2], [rim + 0.016, w / 2 - 0.002], [rim - 0.002, w / 2 - 0.012]);
    const NA = 720, np = prof.length, pos = new Float32Array((NA + 1) * np * 3), idx = [], tw = z1 - z0;
    const groove = (th, z) => { const s = (z - z0) / tw; let d = 0; for (const gc of [0.22, 0.5, 0.78]) { const dd = Math.abs(s - gc) * tw; if (dd < 0.0045) d = Math.max(d, 0.0075 * Math.min(1, (0.0045 - dd) / 0.0015)); }
      const rib = s < 0.22 ? 0 : s < 0.5 ? 1 : s < 0.78 ? 2 : 3, per = 2 * PI / 64, ph = th + (rib % 2 ? per / 2 : 0) + s * 0.35, f = ((ph % per) + per) % per; if (f < 0.0032 / R) d = Math.max(d, 0.005);
      if ((s < 0.07 || s > 0.93) && ((th * 48 / PI) % 2) < 0.35) d = Math.max(d, 0.004); return d; };
    for (let i = 0; i <= NA; i++) { const th = i / NA * 2 * PI, cs = Math.cos(th), sn = Math.sin(th); for (let j = 0; j < np; j++) { let [r, z] = prof[j]; if (r >= R - 1e-6 && z > z0 - 1e-6 && z < z1 + 1e-6) r -= groove(th, z); const o = (i * np + j) * 3; pos[o] = r * cs; pos[o + 1] = r * sn; pos[o + 2] = z; } }
    for (let i = 0; i < NA; i++) for (let j = 0; j < np - 1; j++) { const a = i * np + j, b = a + np; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setIndex(idx); tg.computeVertexNormals();
    { const n0 = tg.attributes.normal, mid = Math.floor(np / 2); if (n0.getX(mid) * pos[mid * 3] + n0.getY(mid) * pos[mid * 3 + 1] < 0) { const I2 = tg.index.array; for (let k = 0; k < I2.length; k += 3) { const s = I2[k + 1]; I2[k + 1] = I2[k + 2]; I2[k + 2] = s; } tg.computeVertexNormals(); } }
    const tire = new THREE.Mesh(tg, Mt.rubber); tire.castShadow = tire.receiveShadow = true; g.add(tire); }
  // 輪框：筒（內側暗）、輪唇、六根輻條（往裡面凹）、輪轂、螺絲、中心蓋
  { const bp = [[rim - 0.012, -w / 2 + 0.01], [rim + 0.006, -w / 2 + 0.006], [rim + 0.006, -w / 2 + 0.02], [rim - 0.01, -w / 2 + 0.03], [rim - 0.01, w / 2 - 0.035], [rim + 0.004, w / 2 - 0.022], [rim + 0.012, w / 2 - 0.012], [rim + 0.012, w / 2 - 0.004], [rim + 0.002, w / 2 + 0.002], [rim - 0.012, w / 2 - 0.004], [rim - 0.018, w / 2 - 0.02]].map(([r, y]) => new THREE.Vector2(r, y));
    const barrel = new THREE.Mesh(new THREE.LatheGeometry(bp, 96), Mt.gold); barrel.geometry.rotateX(PI / 2); g.add(barrel);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(rim + 0.004, 0.007, 10, 96), Mt.chrome); lip.position.z = w / 2 - 0.006; g.add(lip);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(rim - 0.018, rim - 0.018, w * 0.8, 64, 1, true), Mt.dark); inner.geometry.rotateX(PI / 2); inner.material = Mt.dark.clone(); inner.material.side = THREE.DoubleSide; g.add(inner);
    const zo = w / 2 - 0.024, zi = w / 2 - 0.08; // 輻條：外面那頭在輪唇裡面、中間往裡面凹很多（照片）
    for (let k = 0; k < 6; k++) { const a = k * PI / 3 + PI / 6, sh = new THREE.Shape(), r0 = 0.07, r1 = rim - 0.004; // 六根細細的、一樣寬，接輪圈那頭圓圓的變寬
      sh.moveTo(r0, -0.0195); sh.lineTo(r1 - 0.055, -0.018); sh.quadraticCurveTo(r1 - 0.014, -0.018, r1, -0.032); sh.lineTo(r1, 0.032); sh.quadraticCurveTo(r1 - 0.014, 0.018, r1 - 0.055, 0.018); sh.lineTo(r0, 0.0195); sh.closePath();
      const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.018, curveSegments: 8, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3 }); const p = sg.attributes.position;
      for (let i = 0; i < p.count; i++) { const t = Math.min(1, Math.max(0, (p.getX(i) - r0) / (r1 - r0))); p.setZ(i, p.getZ(i) + zi + (zo - zi) * t); } sg.computeVertexNormals(); sg.rotateZ(a);
      const B = window.__BGU, sp = new THREE.Mesh(B && B.toCreasedNormals ? B.toCreasedNormals(sg, 0.7) : sg, Mt.gold); sp.castShadow = true; g.add(sp); }
    const hp = [[0.09, -0.01], [0.088, 0.016], [0.078, 0.028], [0.05, 0.034], [0, 0.036]].map(([r, y]) => new THREE.Vector2(r, y)); // 輪轂：平平的圓盤，邊圓圓的
    const hub = new THREE.Mesh(new THREE.LatheGeometry(hp, 64), Mt.gold); hub.geometry.rotateX(PI / 2); hub.position.z = zi + 0.004; g.add(hub);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.012, 40), new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.35, metalness: 0.3 })); cap.geometry.rotateX(PI / 2); cap.position.z = zi + 0.044; g.add(cap); // 中心蓋：黑的（沒有字）
    const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.029, 0.0025, 8, 40), Mt.chrome); capRing.position.z = zi + 0.05; g.add(capRing);
    for (let k = 0; k < 5; k++) { const a = k * 2 * PI / 5 + PI / 2, nut = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.016, 6), Mt.chrome); nut.geometry.rotateX(PI / 2); nut.position.set(0.05 * Math.cos(a), 0.05 * Math.sin(a), zi + 0.046); g.add(nut);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 12, 8), Mt.chrome); tip.position.set(0.05 * Math.cos(a), 0.05 * Math.sin(a), zi + 0.054); g.add(tip); }
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 8), Mt.dark); valve.position.set(Math.cos(-2.2) * (rim - 0.02), Math.sin(-2.2) * (rim - 0.02), w / 2 - 0.03); valve.rotation.z = -2.2 + PI / 2; g.add(valve); } // 氣嘴
  // 煞車：碟盤（有一圈圈的紋）、碟盤中心、卡鉗（紅色、圓角）
  { const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.026, 96), Mt.steel); disc.geometry.rotateX(PI / 2); disc.position.z = -0.01; g.add(disc);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 48), Mt.dark); hat.geometry.rotateX(PI / 2); hat.position.z = 0.0; g.add(hat);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.065), new THREE.MeshStandardMaterial({ color: 0x7c7f85, roughness: 0.55, metalness: 0.55 })); cal.position.set(0.09, 0.115, -0.01); cal.rotation.z = 0.5; g.add(cal); // 卡鉗：灰色鑄鐵（照片）
    const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.2, 0.08), Mt.dark); knuckle.position.set(0, 0, -0.07); g.add(knuckle); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
return { build, loft, ST, HOLES, isGlass, XF, XR, RW, TRACK, TW, RIM };
})();
