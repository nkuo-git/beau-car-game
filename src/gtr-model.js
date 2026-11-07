// GT-R（R34）的高細節車身（第 71 批）：Nick 2026-11-07 給了一台 1:64 小車的環景影片「有辦法依此把它畫得更真嗎」→ 卡片「好，整台重做」
// 跟 GC8（gc8-model.js）一樣：剖面曲線拉出平滑的車身（loft），挖窗、輪拱、大燈、水箱罩；門縫用法線貼圖；細節、輪子、車內另外做
// 只在烘焙的時候用（node gc8-bake.mjs gtr → body-gtr-q.glb；輕量車再用 make-lod.mjs gtr 做）；影片只拿來看（不放進遊戲、repo）
// window.__CAR2.build(THREE, opt) → { group, info, mats }；座標跟遊戲一樣：x 往車頭、y 往上、z 往右，腳底 y=0；opt.bake 同 GC8
// 跟 GC8 不一樣的地方：
//   剖面不是一站一站寫死，是照 x 用幾條曲線算（Wb 車寬、YB 車底、HCH 引擎蓋中線、DC 行李廂蓋、HC 車頂中線、YG 腰線、YT 雨槽）→ prof(x)
//   車頭（XN）、車尾（XB）各一片平的面（R34 的屁股、保桿正面是平平直直的）：最後 4／9 公分照四分之一橢圓把剖面收到那一片的輪廓（FACE_F、FACE_R）→ 圓角
//   車尾那一片在車身網格裡（漆的貼圖下面多 256 行給它：行李廂蓋、保桿的縫），四顆圓尾燈挖在上面；車頭那一片（noseCap）跟 GC8 一樣自己一塊
//   車頭、車尾從上面看的圓弧照弧長彎（z 不會變窄）；尾翼最後才加（不彎）
window.__CAR2 = (() => {
const PI = Math.PI;
let rs = 4242; const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
const NP = 14, KINKS = [7, 10]; // 剖面 14 點：底盤中線 → 側裙 → 車門 → 肩線(7) → 玻璃／引擎蓋 → 雨槽(10) → 車頂中線
const XF = 1.29, XR = -1.375, RW = 0.327, TRACK = 0.74, TW = 0.245, RIM = 0.2286, ARCH_R = 0.372; // 軸距 2.665、18 吋、245/40
const XB = -2.30, XN = 2.305, DR = 0.09, DF = 0.04; // 車尾那一片、車頭那一片；收圓角的長度
// ---- 曲線 ----
// Hermite（Catmull-Rom 切線、不等距）：xs 遞增，回傳 f(x)
function hermite(xs, ys) {
  const n = xs.length, m = new Array(n);
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); m[i] = (ys[b] - ys[a]) / (xs[b] - xs[a]); }
  return (x) => { if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1]; let i = 0; while (xs[i + 1] < x) i++; const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]; };
}
const curve = (P) => hermite(P.map((p) => p[0]), P.map((p) => p[1]));
const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const band = (x, a, b, c, d) => ss((x - a) / (b - a)) * (1 - ss((x - c) / (d - c)));
const gq = (t) => { t = Math.min(1, Math.max(0, t)); return Math.sqrt(t * (2 - t)); }; // 四分之一橢圓（0→0、1→1，0 那頭垂直）
// ---- 車身的尺寸（影片：側面、前後、斜看量的；R34 是直直的線、方方的肩）----
const Wb = curve([[-2.23, 0.840], [-2.18, 0.849], [-2.10, 0.855], [-2.0, 0.858], [-1.6, 0.860], [-0.8, 0.856], [0, 0.853], [0.8, 0.856], [1.6, 0.860], [1.95, 0.858], [2.05, 0.853], [2.12, 0.843], [2.18, 0.830], [2.245, 0.812], [2.265, 0.806]]); // 半寬（不含輪拱）
const FA = 0.036, flare = (x) => FA * (band(x, 0.78, 0.98, 1.75, 2.15) + band(x, -2.21, -1.95, -0.92, -0.62)); // 輪拱鼓出來（R34 方方的葉子板）
const YB = curve([[-2.21, 0.18], [-2.12, 0.165], [-2.0, 0.152], [-1.85, 0.142], [-1.6, 0.133], [-1.0, 0.128], [0, 0.126], [1.2, 0.126], [1.75, 0.13], [2.0, 0.137], [2.12, 0.145], [2.245, 0.158], [2.265, 0.162]]); // 車底
const HCH = curve([[0.70, 0.95], [0.86, 0.926], [1.0, 0.915], [1.29, 0.896], [1.6, 0.86], [1.9, 0.814], [2.05, 0.788], [2.10, 0.775], [2.13, 0.764], [2.155, 0.745], [2.18, 0.718], [2.20, 0.69], [2.215, 0.662], [2.228, 0.632], [2.238, 0.610], [2.25, 0.599], [2.265, 0.596]]); // 引擎蓋中線（前面往下折成斜的臉：大燈、水箱罩在這裡）
const kc = (x) => 1 - ss((x - 2.20) / 0.07);
const hoodH = (x, z) => HCH(x) - kc(x) * 0.032 * (z / 0.72) ** 2; // 引擎蓋：中間高、兩邊低 3.2 公分
const hoodTop = (x, w) => { const z8 = w - 0.07; return [1, 0.91, 0.70, 0.50, 0.25, 0].map((f) => [z8 * f, hoodH(x, z8 * f)]); };
const DC = curve([[-2.21, 0.978], [-2.12, 0.99], [-2.0, 0.998], [-1.80, 1.003], [-1.62, 1.005], [-1.45, 1.01]]); // 行李廂蓋中線
const deckH = (x, z) => DC(x) - 0.012 * (z / 0.75) ** 2;
const deckTop = (x, w) => { const z8 = w - 0.07; return [1, 0.88, 0.66, 0.45, 0.22, 0].map((f) => [z8 * f, deckH(x, z8 * f)]); };
const HC = curve([[-1.75, 1.008], [-1.62, 1.005], [-1.585, 1.012], [-1.42, 1.075], [-1.24, 1.152], [-1.06, 1.225], [-0.90, 1.29], [-0.72, 1.338], [-0.50, 1.355], [-0.30, 1.36], [0.0, 1.352], [0.17, 1.335], [0.30, 1.29], [0.40, 1.25], [0.55, 1.168], [0.70, 1.035], [0.86, 0.926], [0.95, 0.92]]); // 車頂中線（含前後擋風玻璃）
const YG = curve([[-1.75, 1.003], [-1.62, 1.003], [-1.30, 1.0], [-1.07, 0.992], [-0.80, 0.962], [-0.45, 0.942], [0.06, 0.932], [0.30, 0.933], [0.57, 0.936], [0.86, 0.93], [1.0, 0.928]].map(([x, y]) => [x, y - 0.006])); // 腰線（側窗下緣下面 6 公釐）
const YT = curve([[-0.80, 1.235], [-0.72, 1.245], [-0.566, 1.255], [-0.27, 1.262], [0.05, 1.252], [0.17, 1.242], [0.25, 1.235]]); // 雨槽
const roofTop = (x, w) => { const h = HC(x), p8 = [w - 0.06, YG(x)], p10 = [0.665, YT(x)], p9 = [(p8[0] + p10[0]) / 2 + 0.006, (p8[1] + p10[1]) / 2]; return [p8, p9, p10, [0.555, h - 0.036], [0.29, h - 0.0065], [0, h]]; };
const mixP = (A, B, f) => A.map((p, k) => [p[0] + f * (B[k][0] - p[0]), p[1] + f * (B[k][1] - p[1])]);
const COWLP = hoodTop(0.86, Wb(0.86)), RFP = roofTop(0.17, Wb(0.17)), DECKP = deckTop(-1.62, Wb(-1.62)), RRP = roofTop(-0.72, Wb(-0.72));
// 前後擋風玻璃那幾站：上面那半（8–13）從前圍（行李廂蓋）混到車頂前緣（後緣），混的比例照中線高度
const green = (x, w) => (x > 0.17 ? mixP(COWLP, RFP, (HC(x) - COWLP[5][1]) / (RFP[5][1] - COWLP[5][1])) : x < -0.72 ? mixP(DECKP, RRP, (HC(x) - DECKP[5][1]) / (RRP[5][1] - DECKP[5][1])) : roofTop(x, w));
const ysAt = (x, w) => { const gy = YG(x) - 0.042, h = hoodH(x, w - 0.024) - 0.012, d = deckH(x, w - 0.024) - 0.022; // 肩線的高度：車窗那段在腰線下面 4.2 公分；引擎蓋、行李廂蓋那段在蓋子下面一點
  if (x >= 0.95) return h; if (x <= -1.75) return d;
  if (x > 0.70) return gy + ss((x - 0.70) / 0.25) * (h - gy);
  if (x < -1.45) return gy + ss((-1.45 - x) / 0.30) * (d - gy);
  return gy; };
const body = (x) => { const w = Wb(x), F = flare(x), yb = YB(x), ys = ysAt(x, w), dy = ys - yb;
  return [[0, yb], [w - 0.16, yb], [w - 0.032, yb + 0.028], [w - 0.006 + 0.5 * F, yb + 0.17 * dy], [w + 0.9 * F, yb + 0.39 * dy], [w - 0.002 + F, yb + 0.62 * dy], [w - 0.010 + 0.55 * F, yb + 0.85 * dy], [w - 0.024 + 0.15 * F, ys]]
    .concat(x >= 0.86 ? hoodTop(x, w) : x <= -1.62 ? deckTop(x, w) : green(x, w)); };
// 車尾、車頭那一片的輪廓（右半邊，從下面中線到上面中線，14 點）
const FACE_R = [[0, 0.325], [0.60, 0.325], [0.728, 0.345], [0.762, 0.41], [0.77, 0.53], [0.769, 0.66], [0.763, 0.785], [0.748, 0.872], [0.705, 0.903], [0.62, 0.911], [0.47, 0.914], [0.32, 0.916], [0.16, 0.917], [0, 0.917]];
const FACE_F = [[0, 0.235], [0.60, 0.235], [0.728, 0.255], [0.762, 0.30], [0.77, 0.37], [0.769, 0.44], [0.763, 0.505], [0.748, 0.545], [0.705, 0.556], [0.62, 0.558], [0.47, 0.559], [0.32, 0.56], [0.16, 0.56], [0, 0.56]];
const BR0 = body(XB + DR), BF0 = body(XN - DF);
const prof = (x) => (x < XB + DR ? mixP(FACE_R, BR0, gq((x - XB) / DR)) : x > XN - DF ? mixP(FACE_F, BF0, gq((XN - x) / DF)) : body(x));
// 剖面：Catmull-Rom，稜線（肩線 7、雨槽 10）可以切開（尖）或不切（圓），w7、w10 = 0..1 混合
function crCurve(P, kinks) {
  const segs = []; let s0 = 0; for (const k of kinks.concat([NP - 1])) { segs.push([s0, k]); s0 = k; }
  const ev = (a, b, t) => {
    const i = Math.min(b - 1, Math.max(a, Math.floor(t))), u = t - i, p0 = P[Math.max(a, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(b, i + 2)];
    const cr = (c) => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u * u + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u * u * u);
    return [cr(0), cr(1)]; };
  return (t) => { for (const [a, b] of segs) if (t <= b + 1e-9) return ev(a, b, Math.max(a, t)); return P[NP - 1]; };
}
function profileCurve(P, w7 = 1, w10 = 1) {
  const c0 = crCurve(P, []), c7 = crCurve(P, [KINKS[0]]), c10 = crCurve(P, [KINKS[1]]);
  return (t) => { const a = c0(t), b = c7(t), c = c10(t); return [a[0] + w7 * (b[0] - a[0]) + w10 * (c[0] - a[0]), a[1] + w7 * (b[1] - a[1]) + w10 * (c[1] - a[1])]; };
}
const kinkW7 = (x) => 0.5 + 0.5 * band(x, XB, XB + DR, XN - DF, XN); // 肩線：一路都是尖的（R34），只有頭尾那一片收圓
const kinkW10 = (x) => band(x, -1.62, -1.35, 0.70, 0.86); // 雨槽：只有車頂那段
// ---- 車身格子 ----
function loft(dx = 0.015, M = 160) {
  const X = []; for (let x = XB; x < XN - 1e-6;) { X.push(x); const a = Math.abs(x); x += a > 2.24 ? dx / 6 : a > 1.99 ? dx / 3 : dx; } // 頭尾比較密（圓角）
  if (XN - X[X.length - 1] < dx / 12) X.pop(); X.push(XN);
  // B 柱那段再密 3 倍；貼圖的 u 照原本的站算（同 GC8）
  const VI = X.map((x, k) => k), nV = X.length;
  for (let k = X.length - 2; k >= 0; k--) if (X[k] > -0.48 && X[k + 1] < -0.33) { X.splice(k + 1, 0, X[k] + (X[k + 1] - X[k]) / 3, X[k] + (2 * (X[k + 1] - X[k])) / 3); VI.splice(k + 1, 0, VI[k] + 1 / 3, VI[k] + 2 / 3); }
  const U = VI.map((k) => k / (nV - 1));
  const G = []; // G[i][j] = { x, y, z, idx }
  for (const x of X) {
    const P = prof(x), f = profileCurve(P, kinkW7(x), kinkW10(x)), S = 600, pts = [], len = [0];
    for (let s = 0; s <= S; s++) { const t = (s / S) * (NP - 1), [z, y] = f(t); pts.push([z, y, t]); if (s) len.push(len[s - 1] + Math.hypot(z - pts[s - 1][0], y - pts[s - 1][1])); }
    const L = len[S], row = []; let s = 0;
    for (let j = 0; j < M; j++) { const d = (j / (M - 1)) * L; while (s < S - 1 && len[s + 1] < d) s++; const u = len[s + 1] > len[s] ? (d - len[s]) / (len[s + 1] - len[s]) : 0; const a = pts[s], b = pts[s + 1];
      row.push({ x, y: a[1] + (b[1] - a[1]) * u, z: a[0] + (b[0] - a[0]) * u, idx: a[2] + (b[2] - a[2]) * u }); }
    row[0].z = 0; row[M - 1].z = 0; G.push(row);
  }
  return { G, X, M, U };
}
// ---- 區域（材質）----
// 側窗（影片：前門一大片＋後面一小片三角窗，中間黑色細細的 B 柱、上面往前斜）
const DLO = [[-1.10, 1.004], [-0.96, 1.083], [-0.834, 1.16], [-0.72, 1.212], [-0.658, 1.23], [-0.566, 1.246], [-0.466, 1.253], [-0.269, 1.254], [-0.079, 1.249], [0.05, 1.244], [0.106, 1.24], [0.165, 1.232], [0.217, 1.216], [0.265, 1.19], [0.306, 1.163], [0.399, 1.084], [0.493, 1.007], [0.54, 0.965], [0.555, 0.945], [0.50, 0.937], [0.30, 0.933], [0.06, 0.932], [-0.45, 0.942], [-0.80, 0.962], [-1.0, 0.985], [-1.06, 0.994]];
const xB = (y) => -0.431 + 0.194 * (y - 0.925), BW = 0.012;
const WSP = [[0.85, 0], [0.846, 0.30], [0.832, 0.46], [0.805, 0.555], [0.76, 0.615], [0.70, 0.648], [0.62, 0.664], [0.52, 0.668], [0.44, 0.663], [0.38, 0.652], [0.33, 0.632], [0.28, 0.598], [0.235, 0.545], [0.20, 0.46], [0.178, 0.33], [0.168, 0.16], [0.165, 0]]; // 擋風玻璃（上面看 x, z）
const BLP = [[-0.705, 0], [-0.707, 0.30], [-0.715, 0.44], [-0.745, 0.505], [-0.85, 0.52], [-1.0, 0.53], [-1.15, 0.535], [-1.30, 0.525], [-1.40, 0.51], [-1.48, 0.48], [-1.54, 0.43], [-1.57, 0.30], [-1.585, 0]]; // 後擋
const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const nearPoly = (P, x, y) => { let best = null, bd = 1e9; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy || 1e-9; let t = ((x - a[0]) * vx + (y - a[1]) * vy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const px = a[0] + vx * t, py = a[1] + vy * t, d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; best = [px, py]; } } return best; };
const inWin = (v) => v.idx > 7.5 && v.idx < 10.4 && v.z > 0.5 && inPoly(DLO, v.x, v.y);
const sideGlass = (v) => inWin(v) && Math.abs(v.x - xB(v.y)) > BW;
const bPillar = (v) => inWin(v) && Math.abs(v.x - xB(v.y)) <= BW;
const windGlass = (v) => v.idx > 7.6 && v.y > 0.9 && inPoly(WSP, v.x, Math.max(v.z, 0.002));
const rearGlass = (v) => v.idx > 7.6 && v.y > 0.98 && inPoly(BLP, v.x, Math.max(v.z, 0.002));
const isGlass = (v) => sideGlass(v) || windGlass(v) || rearGlass(v);
// 大燈（影片：斜斜的臉上，外面那頭包到側面一點）、水箱罩（兩個大燈中間，跟大燈差不多高）
const HEAD = [[0.36, 0.726], [0.46, 0.737], [0.58, 0.743], [0.70, 0.743], [0.79, 0.737], [0.822, 0.71], [0.832, 0.672], [0.828, 0.632], [0.80, 0.623], [0.68, 0.618], [0.56, 0.614], [0.41, 0.611], [0.385, 0.64]];
const GRILLE = [[0, 0.705], [0.305, 0.705], [0.335, 0.693], [0.35, 0.65], [0.355, 0.607], [0, 0.607]];
const HOLES = [
  { name: 'archF', cut: (v) => v.z > 0.55 && v.idx > 1.4 && v.idx < 7.4 && Math.hypot(v.x - XF, v.y - RW) < ARCH_R, snap: (v) => { const a = Math.atan2(v.y - RW, v.x - XF); v.x = XF + ARCH_R * Math.cos(a); v.y = RW + ARCH_R * Math.sin(a); } },
  { name: 'archR', cut: (v) => v.z > 0.55 && v.idx > 1.4 && v.idx < 7.4 && Math.hypot(v.x - XR, v.y - RW) < ARCH_R, snap: (v) => { const a = Math.atan2(v.y - RW, v.x - XR); v.x = XR + ARCH_R * Math.cos(a); v.y = RW + ARCH_R * Math.sin(a); } },
  { name: 'head', cut: (v) => v.x > 1.98 && v.idx > 3 && inPoly(HEAD, v.z, v.y), snap: (v) => { const p = nearPoly(HEAD, v.z, v.y); v.z = p[0]; v.y = p[1]; } },
  { name: 'grille', cut: (v) => v.x > 2.10 && inPoly(GRILLE, Math.max(v.z, 0.002), v.y), snap: (v) => { const p = nearPoly(GRILLE, v.z, v.y); v.z = Math.max(0, p[0]); v.y = p[1]; } },
];
// 下面黑色的一圈（車頭下巴、車尾下面的擴散器）：quadMat 5 → 黑飾條那一組
const VAL = (v) => v.idx < 3.6 && ((v.x < XB + 0.20 && v.y < 0.27 && v.z < 0.70) || (v.x > 1.68 && v.y < 0.205 + 0.035 * ss((v.x - 1.95) / 0.13))); // 車頭的黑唇包過角、一直到前輪拱（影片）
const dens = (P, h) => { const out = []; for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / h)); for (let s = 0; s < n; s++) out.push([a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n]); } return out; };
const rrect = (z0, y0, z1, y1, r, n = 6) => { const P = []; for (const [cz, cy, a0] of [[z1 - r, y0 + r, -PI / 2], [z1 - r, y1 - r, 0], [z0 + r, y1 - r, PI / 2], [z0 + r, y0 + r, PI]]) for (let k = 0; k <= n; k++) { const a = a0 + (k / n) * (PI / 2); P.push([cz + r * Math.cos(a), cy + r * Math.sin(a)]); } return P; }; // 圓角長方形（逆時針）
const mirrorLoop = (L) => L.map(([z, y]) => [-z, y]).reverse();
const circ = (zc, yc, r, n = 48) => { const P = []; for (let k = 0; k < n; k++) { const a = (k / n) * 2 * PI; P.push([zc + r * Math.cos(a), yc + r * Math.sin(a)]); } return P; };
// 車尾那一片上的洞：四顆圓尾燈（外面大、裡面小）、保桿上的倒車燈（左）／後霧燈（右）
const TL = [[0.64, 0.805, 0.088, 0], [0.45, 0.787, 0.071, 1]]; // z, y, 半徑, 燈罩的花樣
const REV = dens(rrect(0.175, 0.487, 0.33, 0.54, 0.008), 0.01);
const CAP_HOLES = [...TL.flatMap(([z, y, r]) => [circ(z, y, r), circ(-z, y, r)]), REV, mirrorLoop(REV)];
// 車頭那一片上的洞：中間大開口、兩邊角上小白燈、下面兩邊的進氣口
const MOUTH = dens(rrect(-0.365, 0.27, 0.365, 0.49, 0.035), 0.02);
const SMALL = dens(rrect(0.52, 0.455, 0.635, 0.52, 0.012), 0.012);
const LOWER = dens([[0.43, 0.30], [0.715, 0.30], [0.73, 0.37], [0.715, 0.40], [0.43, 0.40]], 0.015);
// ---- 漆的貼圖：上面 1024 行＝車身格子（u＝站、v＝剖面），下面 256 行＝車尾那一片（u＝z、v＝y）----
const TXW = 2048, TXH = 1280, LH = 1024, VLR = (LH - 1) / (TXH - 1), CZ = 1.70, CY0 = 0.28, CY1 = 0.93;
const capUV = (z, y) => [0.5 + z / CZ, (LH + ((y - CY0) / (CY1 - CY0)) * (TXH - 1 - LH)) / (TXH - 1)];
const noseUV = (z, y) => [0.5 + z / 4.3, (0.002 + (y - 0.2) / 3.4) * VLR]; // 保桿正面：借車底那一條（沒有縫）
// ---- 門縫 ----
const SEAMS_SIDE = [ // (x, y)：側面（z > 0.5、−2.25 < x < 2.27）
  [[0.562, 0.925], [0.66, 0.88], [0.731, 0.817], [0.76, 0.70], [0.767, 0.636], [0.769, 0.415], [0.765, 0.30]], // 車門前緣
  [[-0.627, 0.925], [-0.621, 0.777], [-0.620, 0.591], [-0.569, 0.428], [-0.46, 0.324], [-0.40, 0.30]], // 車門後緣（下面往前彎）
  [[-0.40, 0.30], [0.765, 0.30]], // 車門下緣
  [[1.62, 0.45], [1.66, 0.60], [1.75, 0.625], [2.05, 0.622], [2.27, 0.615]], // 前保桿
  [[-1.645, 0.58], [-2.0, 0.597], [-2.32, 0.615]], // 後保桿
  [[-1.62, 0.78], [-1.47, 0.78], [-1.47, 0.87], [-1.62, 0.87], [-1.62, 0.78]], // 油箱蓋
  [[-0.48, 0.785], [-0.30, 0.785], [-0.30, 0.828], [-0.48, 0.828], [-0.48, 0.785]], // 門把的凹槽
];
const SEAMS_TOP = [ // (x, z)：上面（x > −2.27、z < 0.82、夠高）
  [[0.915, 0], [0.915, 0.55], [0.905, 0.70]], [[0.905, 0.70], [1.30, 0.735], [1.75, 0.745], [2.06, 0.745], [2.085, 0.70], [2.105, 0.62], [2.125, 0.50], [2.145, 0.42], [2.16, 0.37], [2.185, 0.34], [2.19, 0]], // 引擎蓋
  [[-1.63, 0], [-1.63, 0.645]], [[-1.63, 0.645], [-1.90, 0.665], [-2.14, 0.66], [-2.22, 0.62], [-2.255, 0.52], [-2.27, 0.43]], // 行李廂蓋
];
const SEAMS_REAR = [ // (z, y)：車尾（x < −2.24）：行李廂蓋兩邊往下、底下一條橫的；保桿上緣一條橫的
  [[0.43, 0.97], [0.43, 0.893], [0.36, 0.86], [0.355, 0.715], [0, 0.715]], [[0, 0.615], [0.86, 0.615]],
];
const SEAMS_FRONT = [ // (z, y)：車頭（x > 2.22）：保桿上緣（大燈、水箱罩下面）
  [[0, 0.602], [0.78, 0.606], [0.86, 0.615]],
];
const dseg = (px, py, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy || 1e-9; let t = ((px - a[0]) * vx + (py - a[1]) * vy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(px - a[0] - vx * t, py - a[1] - vy * t); };
const dpoly = (L, px, py) => { let d = 1e9; for (let i = 1; i < L.length; i++) d = Math.min(d, dseg(px, py, L[i - 1], L[i])); return d; };
const sideOK = (x, z) => z > 0.5 && x > -2.25 && x < 2.27;
const topOK = (x, y, z) => x > -2.27 && z < 0.82 && y > (x > 2.0 ? 0.66 : 0.74);
// 平面上一圈（可以有洞）切成小三角形（同 GC8）
const steinerTri = (THREE, outer0, holes0, step) => {
  const cl = (L) => (L.length > 2 && Math.abs(L[0][0] - L[L.length - 1][0]) < 1e-9 && Math.abs(L[0][1] - L[L.length - 1][1]) < 1e-9 ? L.slice(0, -1) : L), outer = cl(outer0), holes = holes0.map(cl);
  const loops = [outer, ...holes]; let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
  for (const [a, b] of outer) { a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
  const near = (a, b) => loops.some((L) => L.some((p, k) => dseg(a, b, p, L[(k + 1) % L.length]) < step * 0.45)), st = [];
  for (let r = 0, b = b0 + step / 2; b < b1; b += step * 0.866, r++) for (let a = a0 + step / 2 + (r % 2) * step * 0.5; a < a1; a += step) if (inPoly(outer, a, b) && !holes.some((h) => inPoly(h, a, b)) && !near(a, b)) st.push([a, b]);
  const P = outer.concat(...holes, st), J = P.map(([a, b], i) => { const h = Math.sin(i * 12.9898 + 1.7) * 43758.5453, g = Math.sin(i * 78.233 + 0.3) * 24634.6345; return [a + (h - Math.floor(h) - 0.5) * 2e-5, b + (g - Math.floor(g) - 0.5) * 2e-5]; });
  const V = (k0, len) => J.slice(k0, k0 + len).map(([a, b]) => new THREE.Vector2(a, b)), HV = []; let o = outer.length;
  for (const h of holes) { HV.push(V(o, h.length)); o += h.length; }
  for (let k = 0; k < st.length; k++) HV.push(V(o + k, 1));
  return { P, T: lawson(J, THREE.ShapeUtils.triangulateShape(V(0, outer.length), HV), loops), n: outer.length };
};
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
      if (!(cr(p, q, u) * cr(p, q, v) < 0)) continue;
      const n1 = ccw([p, u, q]), n2 = ccw([q, v, p]);
      if (flat(n1) || flat(n2)) continue;
      T[e[0]] = n1; T[e[1]] = n2; busy[e[0]] = busy[e[1]] = 1; flips++;
    }
    if (!flips) break;
  }
  return T;
};
// 漆的貼圖（白底、門縫的顏色＋法線；同 GC8 第 55 批：3.4 公釐的縫、兩邊 2.5 公釐圓角、縫附近 5×5 反鋸齒）
function paintMaps(THREE, G, X, U, M, color, bake = false) {
  const W = TXW, H = TXH, nx = X.length;
  const CI = new Int32Array(W), CU = new Float32Array(W); for (let u = 0, i = 0; u < W; u++) { const t = u / (W - 1); while (i < nx - 2 && U[i + 1] <= t) i++; CI[u] = i; CU[u] = Math.min(1, (t - U[i]) / (U[i + 1] - U[i])); }
  const alb = document.createElement('canvas'), nrm = document.createElement('canvas'), rgh = document.createElement('canvas');
  alb.width = nrm.width = rgh.width = W; alb.height = nrm.height = rgh.height = H;
  const ga = alb.getContext('2d'), gn = nrm.getContext('2d'), gr = rgh.getContext('2d');
  const IA = ga.createImageData(W, H), IN = gn.createImageData(W, H), IR = gr.createImageData(W, H), A = IA.data, N = IN.data, R = IR.data;
  const hgt = new Float32Array(W * H), c = bake ? new THREE.Color(1, 1, 1) : new THREE.Color(color).convertLinearToSRGB();
  const px = new Float32Array(W * H), py = new Float32Array(W * H), pz = new Float32Array(W * H);
  for (let v = 0; v < H; v++) {
    if (v < LH) { const fj = (v / (LH - 1)) * (M - 1), j = Math.min(M - 2, Math.floor(fj)), uj = fj - j;
      for (let u = 0; u < W; u++) { const i = CI[u], ui = CU[u], a = G[i][j], b = G[i + 1][j], cc = G[i][j + 1], d = G[i + 1][j + 1], o = v * W + u;
        px[o] = (a.x * (1 - ui) + b.x * ui) * (1 - uj) + (cc.x * (1 - ui) + d.x * ui) * uj; py[o] = (a.y * (1 - ui) + b.y * ui) * (1 - uj) + (cc.y * (1 - ui) + d.y * ui) * uj; pz[o] = (a.z * (1 - ui) + b.z * ui) * (1 - uj) + (cc.z * (1 - ui) + d.z * ui) * uj; }
    } else { const y = CY0 + ((v - LH) / (H - 1 - LH)) * (CY1 - CY0); for (let u = 0; u < W; u++) { const o = v * W + u; px[o] = XB; py[o] = y; pz[o] = (u / (W - 1) - 0.5) * CZ; } }
  }
  const SW = 0.0017, BV = 0.0025, NS = 5, FP = 1.25, KN = 0.8, D = new Float32Array(W * H);
  const dist = (x, y, z) => { let d = 1e9;
    if (sideOK(x, z)) for (const L of SEAMS_SIDE) d = Math.min(d, dpoly(L, x, y));
    if (topOK(x, y, z)) for (const L of SEAMS_TOP) d = Math.min(d, dpoly(L, x, z));
    if (x < -2.24) { const az = Math.abs(z); for (const L of SEAMS_REAR) d = Math.min(d, dpoly(L, az, y)); }
    if (x > 2.22) for (const L of SEAMS_FRONT) d = Math.min(d, dpoly(L, z, y));
    return d; };
  for (let o = 0; o < W * H; o++) D[o] = dist(px[o], py[o], pz[o]);
  // 最近的縫：距離＋離開縫的方向（世界座標）；四個投影面：側面 (x, y)、上面 (x, z)、車尾、車頭 (z, y)；車尾那一片 z < 0 的點照 |z| 算、方向的 z 反過來
  const SR = { d: 0, gx: 0, gy: 0, gz: 0 };
  const segN = (L, a0, b0, ia, ib, sz = 1) => { let hit = false; for (let i = 1; i < L.length; i++) { const a = L[i - 1], b = L[i], vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy || 1e-9; let t = ((a0 - a[0]) * vx + (b0 - a[1]) * vy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const e0 = a0 - a[0] - vx * t, e1 = b0 - a[1] - vy * t, d = Math.hypot(e0, e1); if (d < SR.d) { SR.d = d; const q = d > 1e-9 ? 1 / d : 0; SR.gx = SR.gy = SR.gz = 0; SR[ia] = e0 * q * (ia === 'gz' ? sz : 1); SR[ib] = e1 * q; hit = true; } } return hit; };
  const seamAt = (x, y, z) => { SR.d = 1e9; SR.gx = SR.gy = SR.gz = 0;
    if (sideOK(x, z)) for (const L of SEAMS_SIDE) segN(L, x, y, 'gx', 'gy');
    if (topOK(x, y, z)) for (const L of SEAMS_TOP) segN(L, x, z, 'gx', 'gz');
    if (x < -2.24) { const az = Math.abs(z), sz = z < 0 ? -1 : 1; for (const L of SEAMS_REAR) segN(L, az, y, 'gz', 'gy', sz); }
    if (x > 2.22) for (const L of SEAMS_FRONT) segN(L, z, y, 'gz', 'gy');
    return SR; };
  const SUB = []; for (let k = 0; k < NS; k++) SUB.push(((k + 0.5) / NS - 0.5) * FP);
  const near = SW + BV + 0.008;
  for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) { const o = v * W + u;
    let nX = 0, nY = 0, dk = 1;
    if (D[o] < near) {
      const vlo = v < LH ? 0 : LH, vhi = v < LH ? LH - 1 : H - 1; // 一格的方向只在自己那一塊裡面算
      const u1 = Math.min(W - 1, u + 1), u0 = Math.max(0, u - 1), v1 = Math.min(vhi, v + 1), v0 = Math.max(vlo, v - 1), a1 = v * W + u1, a0 = v * W + u0, b1 = v1 * W + u, b0 = v0 * W + u;
      const ux = (px[a1] - px[a0]) / (u1 - u0), uy = (py[a1] - py[a0]) / (u1 - u0), uz = (pz[a1] - pz[a0]) / (u1 - u0), vx = (px[b1] - px[b0]) / (v1 - v0), vy = (py[b1] - py[b0]) / (v1 - v0), vz = (pz[b1] - pz[b0]) / (v1 - v0);
      const lu = Math.hypot(ux, uy, uz) || 1e-6, lv = Math.hypot(vx, vy, vz) || 1e-6;
      let cov = 0, ao = 0, sx = 0, sy = 0;
      for (const a of SUB) for (const b of SUB) { const r = seamAt(px[o] + a * ux + b * vx, py[o] + a * uy + b * vy, pz[o] + a * uz + b * vz);
        if (r.d < SW) { cov++; continue; }
        if (r.d >= SW + BV) continue;
        const t = (SW + BV - r.d) / BV, m = Math.min(2.5, t / Math.sqrt(Math.max(0.0256, 1 - t * t)));
        ao += t * t; sx -= (m * (r.gx * ux + r.gy * uy + r.gz * uz)) / lu; sy -= (m * (r.gx * vx + r.gy * vy + r.gz * vz)) / lv; }
      const n2 = NS * NS, gu = 1 / (lu * (W - 1)), gv = 1 / (lv * (H - 1)), gm = Math.max(gu, gv);
      cov /= n2; ao /= n2; nX = ((KN * sx) / n2) * (gm / gu); nY = ((KN * sy) / n2) * (gm / gv);
      dk = 1 - 0.82 * cov - 0.22 * ao;
      hgt[o] = cov; }
    const fx = bake ? 0 : (rnd() - 0.5) * 0.10, fy = bake ? 0 : (rnd() - 0.5) * 0.10;
    nX += fx; nY += fy; let nZ = 1; const l = Math.hypot(nX, nY, nZ); nX /= l; nY /= l; nZ /= l;
    N[o * 4] = (nX * 0.5 + 0.5) * 255; N[o * 4 + 1] = (nY * 0.5 + 0.5) * 255; N[o * 4 + 2] = (nZ * 0.5 + 0.5) * 255; N[o * 4 + 3] = 255;
    A[o * 4] = c.r * 255 * dk; A[o * 4 + 1] = c.g * 255 * dk; A[o * 4 + 2] = c.b * 255 * dk; A[o * 4 + 3] = 255;
    const r = 0.30 + 0.5 * hgt[o] + (rnd() - 0.5) * 0.06; R[o * 4] = R[o * 4 + 1] = R[o * 4 + 2] = r * 255; R[o * 4 + 3] = 255; }
  ga.putImageData(IA, 0, 0); gn.putImageData(IN, 0, 0); gr.putImageData(IR, 0, 0);
  const T = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.anisotropy = 16; t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
  return bake ? { map: T(alb, true), normalMap: T(nrm, false) } : { map: T(alb, true), normalMap: T(nrm, false), roughnessMap: T(rgh, false) };
}
// 車牌：自己編的號碼，白底黑字，字、邊、螺絲是凸的（同 GC8 第 54 批）
function plateTex(THREE, TXT) {
  const W = 512, H = 256, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const hc = mk(), h = hc.getContext('2d'), cc = mk(), c = cc.getContext('2d');
  const font = 'bold 170px "Liberation Sans", "DejaVu Sans", sans-serif';
  h.font = font; const mt = h.measureText(TXT), sx = Math.min(0.62, 432 / mt.width), cy = H * 0.56 + (mt.actualBoundingBoxAscent - mt.actualBoundingBoxDescent) / 2;
  const draw = (g, bg, ink, scr) => {
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.roundRect(13, 13, W - 26, H - 26, 18); g.stroke();
    g.fillStyle = ink; g.font = font; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.save(); g.translate(W / 2, cy); g.scale(sx, 1); g.fillText(TXT, 0, 0); g.restore();
    for (const x of [W * 0.2, W * 0.8]) { g.fillStyle = scr; g.beginPath(); g.arc(x, H * 0.155, 11, 0, 2 * PI); g.fill(); } };
  draw(h, '#000', '#fff', '#fff');
  const grd = c.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#f1f0eb'); grd.addColorStop(1, '#dddbd3');
  draw(c, grd, '#151515', '#8d9094');
  for (const x of [W * 0.2, W * 0.8]) { c.strokeStyle = '#3a3c40'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 7, H * 0.155); c.lineTo(x + 7, H * 0.155); c.stroke(); }
  const src = (() => { const b = mk(), g = b.getContext('2d'); g.filter = 'blur(1.6px)'; g.drawImage(hc, 0, 0); return g.getImageData(0, 0, W, H).data; })();
  const nc = mk(), nx = nc.getContext('2d'), nd = nx.createImageData(W, H), N = nd.data, K = 3.2, hv = (x, y) => src[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4] / 255;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const du = (hv(x + 1, y) - hv(x - 1, y)) * K, dv = (hv(x, y - 1) - hv(x, y + 1)) * K, l = Math.hypot(du, dv, 1), o = (y * W + x) * 4;
    N[o] = ((-du / l) * 0.5 + 0.5) * 255; N[o + 1] = ((-dv / l) * 0.5 + 0.5) * 255; N[o + 2] = ((1 / l) * 0.5 + 0.5) * 255; N[o + 3] = 255; }
  nx.putImageData(nd, 0, 0);
  const T = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: T(cc, true), normalMap: T(nc, false), roughness: 0.42, metalness: 0.15 }); m.userData.slot = 'plate';
  return m;
}
// 圓尾燈的燈罩貼圖（768×256＝三格）：0 外面那顆（紅、一圈一圈的菲涅耳紋、中間亮一點）、1 裡面那顆（外圈紅、中間橘）、2 一片紅＋小稜鏡（後霧燈、第三煞車燈）
function tailTex(THREE) {
  const W = 768, H = 256, R = 118, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cv = mk(), c = cv.getContext('2d'), hc = mk(), h = hc.getContext('2d'), I = c.createImageData(W, H), HI = h.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const cell = Math.floor(x / 256), dx = x + 0.5 - (cell * 256 + 128), dy = y + 0.5 - 128, r = Math.hypot(dx, dy) / R, o = (y * W + x) * 4;
    let col = [196, 16, 26], ht = 0.5;
    if (cell < 2) { const ring = ((r * 13) % 1); ht = ring; // 一圈一圈（約 3 公釐一圈）
      if (cell === 0) { col = r < 0.42 ? [214, 30, 38] : r < 0.47 ? [150, 8, 16] : [188, 14, 24]; if (r > 0.97) col = [120, 6, 12]; }
      else { col = r < 0.50 ? [240, 150, 40] : r < 0.56 ? [120, 30, 10] : [188, 14, 24]; if (r > 0.97) col = [120, 6, 12]; if (r < 0.5) ht = ((r * 18) % 1); }
      const k = 0.9 + 0.1 * Math.sin(ring * 2 * PI); col = col.map((v) => Math.min(255, v * k));
    } else { const gx = ((x + 0.5) % 6) / 6 - 0.5, gy = ((y + 0.5) % 6) / 6 - 0.5; ht = 1 - 2 * Math.max(Math.abs(gx), Math.abs(gy)); col = Math.max(Math.abs(gx), Math.abs(gy)) > 0.44 ? [160, 10, 18] : [200, 18, 28]; }
    I.data[o] = col[0]; I.data[o + 1] = col[1]; I.data[o + 2] = col[2]; I.data[o + 3] = 255; HI.data[o] = HI.data[o + 1] = HI.data[o + 2] = ht * 255; HI.data[o + 3] = 255; }
  c.putImageData(I, 0, 0); h.putImageData(HI, 0, 0);
  const src = HI.data, hv = (x, y) => src[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4] / 255, nc = mk(), n2 = nc.getContext('2d'), nd = n2.createImageData(W, H), K = 1.6;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const du = (hv(x + 1, y) - hv(x - 1, y)) * K, dv = (hv(x, y - 1) - hv(x, y + 1)) * K, l = Math.hypot(du, dv, 1), o = (y * W + x) * 4;
    nd.data[o] = ((-du / l) * 0.5 + 0.5) * 255; nd.data[o + 1] = ((-dv / l) * 0.5 + 0.5) * 255; nd.data[o + 2] = ((1 / l) * 0.5 + 0.5) * 255; nd.data[o + 3] = 255; }
  n2.putImageData(nd, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; const nt = new THREE.CanvasTexture(nc); nt.anisotropy = 8;
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: t, normalMap: nt, roughness: 0.08, transmission: 0.3, ior: 1.5, thickness: 0.02, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, side: THREE.DoubleSide }); m.userData.slot = 'tail';
  return m;
}
// 燈罩的 uv：那一格的中心 ± 半徑（flipY：畫布往上＝v 往上）
const cellUV = (cell, dz, dy, r) => [(cell * 256 + 128 + (dz / r) * 118) / 768, (128 + (dy / r) * 118) / 256];
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
    red: new THREE.MeshStandardMaterial({ color: 0xb3121a, roughness: 0.4, metalness: 0.2 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x6d6f73, roughness: 0.45, metalness: 0.85 }),
    lensRed: new THREE.MeshPhysicalMaterial({ color: 0xd0101c, roughness: 0.05, transmission: 0.6, ior: 1.5, thickness: 0.01, transparent: true, side: THREE.DoubleSide }),
    lensAmber: new THREE.MeshPhysicalMaterial({ color: 0xe47c12, roughness: 0.05, transmission: 0.6, ior: 1.5, thickness: 0.01, transparent: true, side: THREE.DoubleSide }),
    lensClear: new THREE.MeshPhysicalMaterial({ color: 0xdce8ef, roughness: 0.04, transmission: 0.82, ior: 1.5, thickness: 0.02, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, side: THREE.DoubleSide }),
    bulb: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 0.6, roughness: 0.3 }),
    smoke: new THREE.MeshPhysicalMaterial({ color: 0x1a1c20, roughness: 0.1, metalness: 0.3, clearcoat: 1 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x1d1e22, roughness: 0.95, envMapIntensity: 0.4 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x232428, roughness: 0.7, envMapIntensity: 0.4 }),
    liner: new THREE.MeshStandardMaterial({ color: 0x8c8a84, roughness: 0.95, envMapIntensity: 0.4 }),
  };
  const SLOT = { paint: 'paint', glass: 'glass', trim: 'trim', rubber: 'dark', dark: 'dark', chrome: 'bright', alu: 'bright', red: 'tail', steel: 'bright', lensRed: 'tail', lensAmber: 'amber', lensClear: 'lens', bulb: 'bulb', smoke: 'smoke', cloth: 'interior', plastic: 'interior', liner: 'interior' };
  for (const [k, m] of Object.entries(M)) m.userData.slot = SLOT[k];
  return M;
}
// ---- 主體 ----
function build(THREE, opt = {}) {
  const t0 = performance.now(), color = opt.color ?? 0x1d4fc9, Mt = materials(THREE, color), plateM = plateTex(THREE, 'BEA-3434'), tailM = tailTex(THREE), g = new THREE.Group(); g.name = 'car2';
  const paint2 = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04 }); paint2.userData.slot = 'paint'; // 另外加的鈑件（尾翼、後視鏡）：沒有車身的貼圖
  const crease = (geo, a = 0.7) => { const B = window.__BGU; return B && B.toCreasedNormals ? B.toCreasedNormals(geo, a) : geo; };
  const darkDS = Mt.dark.clone(); darkDS.side = THREE.DoubleSide;
  const chromeDS = Mt.chrome.clone(); chromeDS.side = THREE.DoubleSide;
  const frostM = (() => { // 透明燈罩裡面霧白的反光（前保桿的方向燈、倒車燈；影片：白白的小方塊）：直的圓凹槽（同 GC8 的角燈）
    const fv = document.createElement('canvas'); fv.width = 256; fv.height = 4; const f2 = fv.getContext('2d'), FI = f2.createImageData(256, 4);
    for (let x = 0; x < 256; x++) { const t = ((x + 0.5) * 24) / 256 % 1, tx = (t - 0.5) * 1.3, l = Math.hypot(tx, 1); for (let y = 0; y < 4; y++) { const o = (y * 256 + x) * 4; FI.data[o] = 127.5 + (tx / l) * 127; FI.data[o + 1] = 127.5; FI.data[o + 2] = 127.5 + (1 / l) * 127; FI.data[o + 3] = 255; } }
    f2.putImageData(FI, 0, 0); const t = new THREE.CanvasTexture(fv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    const m = new THREE.MeshStandardMaterial({ color: 0xdfe5ea, roughness: 0.16, metalness: 0.55, normalMap: t, emissive: 0xffffff, emissiveIntensity: 0.03, side: THREE.DoubleSide }); m.userData.slot = 'frost'; return m; })();
  const lgM = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide }); lgM.userData.slot = 'trim'; // 透明燈裡面的牆：淺灰
  const revM = new THREE.MeshStandardMaterial({ color: 0xe2e5e8, roughness: 0.3, metalness: 0.1, side: THREE.DoubleSide }); revM.userData.slot = 'trim'; // 倒車燈裡面：白白的（不用霧白那組：那組晚上會亮）
  { // 燈罩：透明（遊戲裡的「lens」組要一張有透明度的貼圖：深色、幾乎透明）；GC8 的細格線不要（R34 的燈罩是平滑的）
    const cv = document.createElement('canvas'); cv.width = cv.height = 16; const c2 = cv.getContext('2d'); c2.fillStyle = 'rgba(13,15,17,0.05)'; c2.fillRect(0, 0, 16, 16);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const hl = Mt.lensClear; hl.map = t; hl.color.set(0xffffff); hl.transmission = 0.94; hl.roughness = 0.02; hl.needsUpdate = true; }
  { // 橘色燈罩裡面一格一格的小稜鏡（同 GC8 第 55 批）
    const S = 128, K = 4, cs = S / K, mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; }, ca = mk(), cn = mk(), ga = ca.getContext('2d'), gn = cn.getContext('2d'), IA = ga.createImageData(S, S), IN = gn.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const o = (y * S + x) * 4, dx = ((x + 0.5) % cs) / cs - 0.5, dy = 0.5 - ((y + 0.5) % cs) / cs, edge = Math.max(Math.abs(dx), Math.abs(dy)) > 0.44;
      const tx = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) * 0.42 : 0, ty = Math.abs(dx) > Math.abs(dy) ? 0 : Math.sign(dy) * 0.42, l = Math.hypot(tx, ty, 1);
      const b = edge ? 200 : 255; IA.data[o] = IA.data[o + 1] = IA.data[o + 2] = b; IA.data[o + 3] = 255; IN.data[o] = 127.5 + (tx / l) * 127; IN.data[o + 1] = 127.5 + (ty / l) * 127; IN.data[o + 2] = 127.5 + (1 / l) * 127; IN.data[o + 3] = 255; }
    ga.putImageData(IA, 0, 0); gn.putImageData(IN, 0, 0);
    const T = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 0.012, 1 / 0.012); t.anisotropy = 8; return t; };
    Mt.lensAmber.map = T(ca, true); Mt.lensAmber.normalMap = T(cn, false); Mt.lensAmber.needsUpdate = true; }
  const { G, X, M, U } = loft(opt.dx ?? 0.015, opt.M ?? 160), nx = X.length;
  const topY = (x, z) => { let bi = 0; for (let i = 1; i < nx; i++) if (Math.abs(X[i] - x) < Math.abs(X[bi] - x)) bi = i; let best = null; for (const v of G[bi]) if (v.idx >= 8 && (!best || Math.abs(v.z - z) < Math.abs(best.z - z))) best = v; return best.y; };
  const nearI = (x) => { let i = 0; for (let k = 1; k < nx; k++) if (Math.abs(X[k] - x) < Math.abs(X[i] - x)) i = k; return i; };
  const rowY = (row, z) => { for (let j = M - 1; j > 0; j--) { const a = row[j], b = row[j - 1]; if (b.idx < 7.5) break; if ((a.z - z) * (b.z - z) <= 0 && a.z !== b.z) return a.y + ((b.y - a.y) * (z - a.z)) / (b.z - a.z); } return null; };
  const hoodY = (x, z) => { z = Math.abs(z); const i = nearI(x), i2 = X[i] > x ? Math.max(0, i - 1) : Math.min(nx - 1, i + 1), a = rowY(G[i], z); const b = i2 === i ? a : rowY(G[i2], z); if (a === null || b === null) return topY(x, z); return i2 === i ? a : a + ((b - a) * (x - X[i])) / (X[i2] - X[i]); };
  const sideZ = (x, y) => { const row = G[nearI(x)]; for (let j = 1; j < M; j++) { const a = row[j - 1], b = row[j]; if (a.idx < 3 || b.idx > 7.5) continue; if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return a.z + ((b.z - a.z) * (y - a.y)) / (b.y - a.y); } return 0.85; };
  for (const row of G) for (const v of row) { v.glass = isGlass(v); v.bp = bPillar(v); }
  const O = G.map((row) => row.map((v) => ({ x: v.x, y: v.y, z: v.z })));
  const nrm = (i, j) => { const a = G[Math.max(0, i - 1)][j], b = G[Math.min(nx - 1, i + 1)][j], c = G[i][Math.max(0, j - 1)], d = G[i][Math.min(M - 1, j + 1)];
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = d.x - c.x, vy = d.y - c.y, vz = d.z - c.z; let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const NR = G.map((row, i) => row.map((v, j) => nrm(i, j)));
  { const n = NR[Math.floor(nx / 2)][Math.floor(M * 0.3)]; if (n[2] < 0) for (const row of NR) for (const n of row) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; } }
  // B 柱的上下兩頭、玻璃邊、玻璃邊上的黑膠條、玻璃往裡凹（同 GC8）
  for (let i = 0; i < nx; i++) for (let j = 0; j < M; j++) { const v = G[i][j]; if (v.glass || v.bp) continue;
    const nb = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < nx && b < M).map(([a, b]) => G[a][b]);
    if (nb.some((w) => w.glass) || !nb.some((w) => w.bp)) continue; let best = null, bd = 1e9;
    for (const w of nb) { if (!w.bp) continue;
      let lo = 0, hi = 1; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2, p = { x: v.x + (w.x - v.x) * m, y: v.y + (w.y - v.y) * m, z: v.z + (w.z - v.z) * m, idx: v.idx + (w.idx - v.idx) * m }; if (bPillar(p)) hi = m; else lo = m; }
      if (lo < bd) { bd = lo; best = { x: v.x + (w.x - v.x) * lo, y: v.y + (w.y - v.y) * lo, z: v.z + (w.z - v.z) * lo, idx: v.idx + (w.idx - v.idx) * lo }; } }
    if (best) { v.x = best.x; v.y = best.y; v.z = best.z; v.idx = best.idx; } }
  for (let i = 0; i < nx; i++) for (let j = 0; j < M; j++) { const v = G[i][j]; if (v.glass) continue; let best = null, bd = 1e9;
    for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) { if (a < 0 || b < 0 || a >= nx || b >= M) continue; const w = G[a][b]; if (!w.glass) continue;
      let lo = 0, hi = 1; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2, p = { x: v.x + (w.x - v.x) * m, y: v.y + (w.y - v.y) * m, z: v.z + (w.z - v.z) * m, idx: v.idx + (w.idx - v.idx) * m }; if (isGlass(p)) hi = m; else lo = m; }
      if (lo < bd) { bd = lo; best = { x: v.x + (w.x - v.x) * lo, y: v.y + (w.y - v.y) * lo, z: v.z + (w.z - v.z) * lo, idx: v.idx + (w.idx - v.idx) * lo }; } }
    if (best) { v.x = best.x; v.y = best.y; v.z = best.z; v.idx = best.idx; v.edge = true; } }
  const TRIMW = 0.014, TRIMB = 0.003, mv = [], at = (P, Q, m) => ({ x: P.x + (Q.x - P.x) * m, y: P.y + (Q.y - P.y) * m, z: P.z + (Q.z - P.z) * m });
  for (let i = 0; i < nx; i++) for (let j = 0; j < M; j++) { const w = G[i][j]; if (!w.glass) continue; let best = null, bd = 1e9;
    const nb = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < nx && b < M).map(([a, b]) => G[a][b]);
    if (nb.some((v) => v.bp)) {
      const P0 = O[i][j], s = Math.sign(P0.x - xB(P0.y)) || 1, f = (p) => s * (p.x - xB(p.y)) - BW - TRIMB, Pa = O[i - s]?.[j], Pb = O[i + s]?.[j];
      const e = nb.find((v) => !v.glass && v.edge && !v.bp), q = e ? at(e, P0, TRIMW / (Math.hypot(P0.x - e.x, P0.y - e.y, P0.z - e.z) || 1e-6)) : P0;
      if (Pa && Pb) { const A = { x: q.x + 2 * (Pa.x - P0.x), y: q.y + 2 * (Pa.y - P0.y), z: q.z + 2 * (Pa.z - P0.z) }, B = { x: q.x + 2 * (Pb.x - P0.x), y: q.y + 2 * (Pb.y - P0.y), z: q.z + 2 * (Pb.z - P0.z) };
        if (f(A) <= 0 && f(B) > 0) { let lo = 0, hi = 1; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (f(at(A, B, m)) > 0) hi = m; else lo = m; }
          const p = at(A, B, hi); mv.push([w, p.x, p.y, p.z]); continue; } } }
    for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) { if (a < 0 || b < 0 || a >= nx || b >= M) continue; const v = G[a][b]; if (v.glass || !v.edge) continue; const d = Math.hypot(w.x - v.x, w.y - v.y, w.z - v.z); if (d < bd) { bd = d; best = v; } }
    if (best) { const d = bd || 1e-6, tw = best.bp ? TRIMB : TRIMW; mv.push([w, best.x + (w.x - best.x) / d * tw, best.y + (w.y - best.y) / d * tw, best.z + (w.z - best.z) / d * tw]); } }
  for (const [w, x, y, z] of mv) { w.x = x; w.y = y; w.z = z; }
  for (let i = 0; i < nx; i++) for (let j = 0; j < M; j++) { const v = G[i][j]; if (v.glass) { const n = NR[i][j]; v.x -= n[0] * 0.007; v.y -= n[1] * 0.007; v.z -= n[2] * 0.007; } }
  for (const row of G) { row[0].z = 0; row[M - 1].z = 0; }
  // 下面黑色那圈：不是黑的、旁邊有黑的點推到邊界上（同玻璃邊的做法），邊才不會是格子的鋸齒
  for (const row of G) for (const v of row) v.val = VAL(v);
  { const mv2 = []; for (let i = 1; i < nx; i++) for (let j = 0; j < M; j++) { const v = G[i][j]; if (v.val) continue; let best = null, bd = 1e9;
      for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) { if (a < 1 || b < 0 || a >= nx || b >= M) continue; const w = G[a][b]; if (!w.val) continue;
        let lo = 0, hi = 1; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2, p = { x: v.x + (w.x - v.x) * m, y: v.y + (w.y - v.y) * m, z: v.z + (w.z - v.z) * m, idx: v.idx + (w.idx - v.idx) * m }; if (VAL(p)) hi = m; else lo = m; }
        if (lo < bd) { bd = lo; best = { x: v.x + (w.x - v.x) * lo, y: v.y + (w.y - v.y) * lo, z: v.z + (w.z - v.z) * lo, idx: v.idx + (w.idx - v.idx) * lo }; } }
      if (best) mv2.push([v, best]); }
    for (const [v, b] of mv2) { v.x = b.x; v.y = b.y; v.z = b.z; v.idx = b.idx; v.vb = true; } } // 第 0 站（車尾那一片的邊）不動
  // 洞（同 GC8）
  for (const row of G) for (const v of row) { v.hole = null; for (const h of HOLES) if (h.cut(v)) { v.hole = h; break; } }
  const quadMat = new Int8Array((nx - 1) * (M - 1)); // -1 挖掉、0 漆、1 玻璃、2 邊、4 B 柱、5 下面黑色那圈
  const isV = (v) => v.val || v.vb;
  for (let i = 0; i < nx - 1; i++) for (let j = 0; j < M - 1; j++) { const vs = [G[i][j], G[i + 1][j], G[i][j + 1], G[i + 1][j + 1]]; const nh = vs.filter((v) => v.hole).length, ng = vs.filter((v) => v.glass).length;
    quadMat[i * (M - 1) + j] = nh === 4 ? -1 : ng === 4 ? 1 : ng > 0 ? 2 : vs.some((v) => v.bp) ? 4 : vs.some((v) => v.val) ? 5 : 0; }
  for (let i = 0; i < nx; i++) for (let j = 0; j < M; j++) { const v = G[i][j]; v.hsnap = false; if (!v.hole) continue; let best = null, bd = 1e9; const h = v.hole;
    for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) { if (a < 0 || b < 0 || a >= nx || b >= M) continue; const w = G[a][b]; if (w.hole) continue;
      let lo = 0, hi = 1; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2, p = { x: v.x + (w.x - v.x) * m, y: v.y + (w.y - v.y) * m, z: v.z + (w.z - v.z) * m, idx: v.idx + (w.idx - v.idx) * m }; if (h.cut(p)) lo = m; else hi = m; }
      if (hi < bd) { bd = hi; best = { x: v.x + (w.x - v.x) * hi, y: v.y + (w.y - v.y) * hi, z: v.z + (w.z - v.z) * hi, idx: v.idx + (w.idx - v.idx) * hi }; } }
    if (best) { v.nx = best.x; v.ny = best.y; v.nz = best.z; v.nidx = best.idx; v.hsnap = true; } }
  for (const row of G) for (const v of row) if (v.hsnap) { v.x = v.nx; v.y = v.ny; v.z = v.nz; v.idx = v.nidx; if (Math.abs(v.z) < 1e-3) v.z = 0; }
  // 做成 BufferGeometry（左右兩半）
  const pos = [], uv = [], idxBy = [[], [], [], []], vid = (i, j, s) => ((s * nx + i) * M + j);
  for (let s = 0; s < 2; s++) for (let i = 0; i < nx; i++) for (let j = 0; j < M; j++) { const v = G[i][j]; pos.push(v.x, v.y, s ? -v.z : v.z); uv.push(U[i], (j / (M - 1)) * VLR); }
  for (let s = 0; s < 2; s++) for (let i = 0; i < nx - 1; i++) for (let j = 0; j < M - 1; j++) { const m = quadMat[i * (M - 1) + j]; if (m < 0) continue; const a = vid(i, j, s), b = vid(i + 1, j, s), c = vid(i, j + 1, s), d = vid(i + 1, j + 1, s);
    const A = G[i][j], B = G[i + 1][j], C = G[i][j + 1], D = G[i + 1][j + 1], ga = A.glass, gb = B.glass, gc = C.glass, gd = D.glass, bad = (v) => v.hole && !v.hsnap;
    const tri = (p, q, r, P, Q, R) => { if (bad(P) || bad(Q) || bad(R)) return; if (P.hole && Q.hole && R.hole) return; const gp = P.glass, gq = Q.glass, gr = R.glass;
      const mm = m === 2 || m === 4 ? ((gp && gq && gr) ? 1 : (gp || gq || gr || P.bp || Q.bp || R.bp) ? 2 : 0) : m === 5 ? (isV(P) && isV(Q) && isV(R) ? 2 : 0) : m; if (s) idxBy[mm].push(p, r, q); else idxBy[mm].push(p, q, r); };
    const oneGlassBC = m === 2 && (gb !== gc) && !ga && !gd && (gb || gc), outs = [A, B, C, D].filter((v) => !v.hole).length, oneOutBC = outs === 1 && (!B.hole || !C.hole);
    const oneBBC = m === 2 && ga && gd && ((C.bp && gb) || (B.bp && gc)), oneVBC = m === 5 && isV(B) !== isV(C) && isV(A) === isV(D) && isV(A) !== isV(B);
    if (oneGlassBC || oneOutBC || oneBBC || oneVBC) { tri(a, b, d, A, B, D); tri(a, d, c, A, D, C); }
    else { tri(a, b, c, A, B, C); tri(b, d, c, B, D, C); } }
  // 車尾那一片：第 0 站那一圈（左右）封成平的一片，四顆尾燈、倒車燈、後霧燈挖洞；自己的頂點（貼圖在漆的下面那 256 行）
  { const row = G[0], half = row.map((v) => [v.z, v.y]), outer = half.concat(half.slice(1, -1).reverse().map(([z, y]) => [-z, y]));
    const ct = steinerTri(THREE, outer, CAP_HOLES, 0.022), base = pos.length / 3;
    for (const [z, y] of ct.P) { pos.push(XB, y, z); uv.push(...capUV(z, y)); }
    for (const t of ct.T) { const [a, b, c] = t.map((k) => base + k), nxx = (pos[b * 3 + 1] - pos[a * 3 + 1]) * (pos[c * 3 + 2] - pos[a * 3 + 2]) - (pos[b * 3 + 2] - pos[a * 3 + 2]) * (pos[c * 3 + 1] - pos[a * 3 + 1]);
      if (nxx < 0) idxBy[0].push(a, b, c); else idxBy[0].push(a, c, b); } }
  let body = new THREE.BufferGeometry(); body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); body.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const index = [].concat(idxBy[0], idxBy[1], idxBy[2], idxBy[3]); body.setIndex(index); let o = 0; for (let m = 0; m < 4; m++) { body.addGroup(o, idxBy[m].length, m); o += idxBy[m].length; }
  const BGU = window.__BGU; if (BGU) { body = BGU.mergeVertices(body, 1e-5); }
  body.computeVertexNormals();
  { // 車漆的點：法線只算車漆的三角形（同 GC8）
    const p = body.attributes.position, n = body.attributes.normal, I = body.index.array, gr = body.groups[0], acc = new Float32Array(p.count * 3), has = new Uint8Array(p.count);
    for (let t = gr.start; t < gr.start + gr.count; t += 3) { const a = I[t], b = I[t + 1], c = I[t + 2]; const ux = p.getX(b) - p.getX(a), uy = p.getY(b) - p.getY(a), uz = p.getZ(b) - p.getZ(a), vx = p.getX(c) - p.getX(a), vy = p.getY(c) - p.getY(a), vz = p.getZ(c) - p.getZ(a); const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const k of [a, b, c]) { acc[k * 3] += nx; acc[k * 3 + 1] += ny; acc[k * 3 + 2] += nz; has[k] = 1; } }
    for (let i = 0; i < p.count; i++) if (has[i]) { const l = Math.hypot(acc[i * 3], acc[i * 3 + 1], acc[i * 3 + 2]); if (l > 0) n.setXYZ(i, acc[i * 3] / l, acc[i * 3 + 1] / l, acc[i * 3 + 2] / l); } }
  { const n = body.attributes.normal, p = body.attributes.position; for (let i = 0; i < n.count; i++) if (Math.abs(p.getZ(i)) < 1e-4 && Math.abs(p.getX(i) - XB) > 1e-6) { n.setZ(i, 0); } }
  const maps = paintMaps(THREE, G, X, U, M, color, !!opt.bake); Object.assign(Mt.paint, maps); Mt.paint.needsUpdate = true;
  const bodyMesh = new THREE.Mesh(body, [Mt.paint, Mt.glass, Mt.trim]); bodyMesh.name = 'car2-body'; bodyMesh.castShadow = bodyMesh.receiveShadow = true; g.add(bodyMesh);
  // 後擋的除霧線（同 GC8 第 54 批）
  { const I = body.index.array, gr = body.groups[1], p = body.attributes.position, n = body.attributes.normal, keep = [];
    for (let t = gr.start; t < gr.start + gr.count; t += 3) { const a = I[t], b = I[t + 1], c = I[t + 2]; if ((p.getX(a) + p.getX(b) + p.getX(c)) / 3 < -0.70 && (n.getY(a) + n.getY(b) + n.getY(c)) / 3 > 0.6) keep.push(a, b, c); }
    const ids = [...new Set(keep)], zm = new Map(), bin = (x) => Math.round(x * 200); let x0 = 1e9, x1 = -1e9;
    for (const i of ids) { const x = p.getX(i), k = bin(x); x0 = Math.min(x0, x); x1 = Math.max(x1, x); zm.set(k, Math.max(zm.get(k) || 0, Math.abs(p.getZ(i)))); }
    const half = (x) => { let m = 0; for (let d = -2; d <= 2; d++) m = Math.max(m, zm.get(bin(x) + d) || 0); return m || 1; };
    const re = new Map(ids.map((i, k) => [i, k])), pp = [], nn = [], uu = [];
    for (const i of ids) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i); pp.push(x - nx * 0.0015, y - ny * 0.0015, z - nz * 0.0015); nn.push(nx, ny, nz); uu.push(0.5 + z / (2 * half(x)), (x - x0) / (x1 - x0)); }
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const c2 = cv.getContext('2d'); c2.fillStyle = 'rgba(74, 42, 26, 0.88)';
    for (let k = 0; k < 14; k++) c2.fillRect(256 * 0.03, 512 * (0.07 + (0.86 * k) / 13) - 1, 256 * 0.94, 2);
    for (const u of [0.022, 0.962]) c2.fillRect(256 * u, 512 * 0.05, 4, 512 * 0.9);
    const dt = new THREE.CanvasTexture(cv); dt.anisotropy = 8; dt.colorSpace = THREE.SRGBColorSpace;
    const dm = new THREE.MeshStandardMaterial({ color: 0xffffff, map: dt, transparent: true, depthWrite: false, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }); dm.userData.slot = 'defrost';
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); dg.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3)); dg.setAttribute('uv', new THREE.Float32BufferAttribute(uu, 2)); dg.setIndex(keep.map((i) => re.get(i)));
    const dmesh = new THREE.Mesh(dg, dm); dmesh.name = 'defrost'; dmesh.renderOrder = 1; g.add(dmesh); }
  // ---- 洞的邊、燈 ----
  const ring = (h) => { const pts = []; for (let i = 0; i < nx; i++) for (let j = 0; j < M; j++) { const v = G[i][j]; if (v.hole === h && v.hsnap) pts.push(v); } return pts; };
  const addMesh = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const mirrorGeo = (geo) => { const g2 = geo.clone(); const p = g2.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -p.getZ(i)); const I = g2.index; if (I) { const a = I.array; for (let k = 0; k < a.length; k += 3) { const t = a[k + 1]; a[k + 1] = a[k + 2]; a[k + 2] = t; } g2.computeVertexNormals(); return g2; }
    const nr = g2.attributes.normal; if (nr) for (let i = 0; i < nr.count; i++) nr.setZ(i, -nr.getZ(i));
    for (const at of Object.values(g2.attributes)) { const n = at.itemSize, A = at.array; for (let k = 0; k + 2 < at.count; k += 3) for (let c = 0; c < n; c++) { const t = A[(k + 1) * n + c]; A[(k + 1) * n + c] = A[(k + 2) * n + c]; A[(k + 2) * n + c] = t; } }
    return g2; };
  const both = (geo, mat, name) => { addMesh(geo, mat, name); addMesh(mirrorGeo(geo), mat, name + 'L'); };
  const faceX = (geo, sgn) => { const p = geo.attributes.position, I = geo.index.array; let s = 0; // 三角形全部朝 ±x
    for (let t = 0; t < I.length; t += 3) { const a = I[t], b = I[t + 1], c = I[t + 2]; s += (p.getY(b) - p.getY(a)) * (p.getZ(c) - p.getZ(a)) - (p.getZ(b) - p.getZ(a)) * (p.getY(c) - p.getY(a)); }
    if (s * sgn < 0) for (let t = 0; t < I.length; t += 3) { const u = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = u; }
    geo.computeVertexNormals(); return geo; };
  // 平的一片（x 固定）：格子點切小三角形，法線朝 +x（face −1 朝 −x）
  const flatPlate = (L, x, step, mat, name, uvf, face = 1) => { const T = steinerTri(THREE, L[0], L.slice(1), step), pp = [], uu = [], ii = []; for (const [z, y] of T.P) { pp.push(x, y, z); if (uvf) uu.push(...uvf(z, y)); }
    for (const [a, b, c] of T.T) { const nxx = (pp[b * 3 + 1] - pp[a * 3 + 1]) * (pp[c * 3 + 2] - pp[a * 3 + 2]) - (pp[b * 3 + 2] - pp[a * 3 + 2]) * (pp[c * 3 + 1] - pp[a * 3 + 1]); if (nxx * face > 0) ii.push(a, b, c); else ii.push(a, c, b); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); if (uvf) fg.setAttribute('uv', new THREE.Float32BufferAttribute(uu, 2)); fg.setIndex(ii); fg.computeVertexNormals(); return addMesh(fg, mat, name); };
  // 平的一片上的洞往裡面凹：牆（洞的邊 → 往裡 D、縮 k）＋底（bm 沒有就不做）；dir：+1 車頭（往 −x）、−1 車尾（往 +x）
  const pocket = (L, x0, dir, D, k, wm, bm, name, buv = null) => { const n = L.length, cy = L.reduce((a, p) => a + p[1], 0) / n, cz = L.reduce((a, p) => a + p[0], 0) / n, x1 = x0 - dir * D, wp = [], wi = [], bk = [];
    for (let i = 0; i < n; i++) { const [z, y] = L[i], bz = cz + (z - cz) * k, by = cy + (y - cy) * k, i2 = (i + 1) % n; wp.push(x0, y, z, x1, by, bz); wi.push(i * 2, i2 * 2, i * 2 + 1, i * 2 + 1, i2 * 2, i2 * 2 + 1); bk.push([bz, by]); }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setIndex(wi); wg.computeVertexNormals(); addMesh(wg, wm, name + 'Wall');
    if (bm) flatPlate([bk], x1, 0.02, bm, name + 'Back', buv, dir);
    return { bk, cy, cz, x1 }; };
  // 輪拱：外緣一圈小管子（鈑金的厚度）、內壁、內壁的底（同 GC8）
  for (const [h, xa] of [[HOLES[0], XF], [HOLES[1], XR]]) {
    const all = ring(h).map((v) => ({ a: Math.atan2(v.y - RW, v.x - xa), v })), yb = Math.min(...all.map((p) => p.v.y));
    const pts = all.filter((p) => p.v.y > yb + 0.012).sort((p, q) => ((p.a + 2.5 * PI) % (2 * PI)) - ((q.a + 2.5 * PI) % (2 * PI)));
    if (pts.length < 8) continue;
    const crv = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.v.x, p.v.y, p.v.z - 0.004)));
    both(new THREE.TubeGeometry(crv, 160, 0.008, 10, false), Mt.paint, 'archLip');
    const wp = [], wi = [], n = pts.length;
    for (let k = 0; k < n; k++) { const v = pts[k].v; wp.push(v.x, v.y, v.z, xa + (ARCH_R + 0.015) * Math.cos(pts[k].a), RW + (ARCH_R + 0.015) * Math.sin(pts[k].a), 0.50); if (k < n - 1) wi.push(k * 2, k * 2 + 2, k * 2 + 1, k * 2 + 1, k * 2 + 2, k * 2 + 3); }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setIndex(wi); wg.computeVertexNormals();
    addMesh(wg, darkDS, 'well'); addMesh(mirrorGeo(wg), darkDS, 'wellL');
    const rc = ARCH_R + 0.025, a0 = Math.asin(Math.max(-1, (yb - RW) / rc)), cap = new THREE.Shape();
    cap.absarc(0, 0, rc, a0, PI - a0, false); cap.closePath();
    const disk = new THREE.ShapeGeometry(cap, 24); disk.translate(xa, RW, 0.50); both(disk, darkDS, 'wellCap');
  }
  // 燈／進氣口的殼（同 GC8）；wm：牆的材質
  const lampBox = (hole, depth, back, lensMat, inner, lensUV, bulge = 0.012, flat, rel = false, wm = darkDS) => {
    const pts = ring(hole); if (pts.length < 6) return; const cz = pts.reduce((a, v) => a + v.z, 0) / pts.length, cy = pts.reduce((a, v) => a + v.y, 0) / pts.length, cx = pts.reduce((a, v) => a + v.x, 0) / pts.length;
    const ord = pts.map((v) => ({ a: Math.atan2(v.y - cy, v.z - cz), v })).sort((p, q) => p.a - q.a).map((p) => p.v), n = ord.length;
    const bk = ord.map((v) => back(v, { x: (rel ? v.x : cx) + depth, y: cy, z: cz })); const bx = rel ? (depth < 0 ? Math.min(...bk.map((b) => b.x)) : Math.max(...bk.map((b) => b.x))) : cx + depth;
    const wp = [], wi = []; for (let k = 0; k < n; k++) { const v = ord[k], b = bk[k]; wp.push(v.x, v.y, v.z, b.x, b.y, b.z); const k2 = (k + 1) % n; if (ord[k].z < 0.012 && ord[k2].z < 0.012 && Math.abs(ord[k].y - ord[k2].y) > 0.03) continue; wi.push(k * 2, k2 * 2, k * 2 + 1, k * 2 + 1, k2 * 2, k2 * 2 + 1); }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setIndex(wi); wg.computeVertexNormals(); both(wg, wm, 'lampWall');
    const bp = [bx, cy, cz], bi = []; for (const b of bk) bp.push(b.x, b.y, b.z); for (let k = 0; k < n; k++) bi.push(0, 1 + k, 1 + ((k + 1) % n));
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setIndex(bi); bg.computeVertexNormals(); both(bg, wm, 'lampBack');
    inner(cx, depth, cy, cz);
    if (lensMat) { const sgn = depth < 0 ? 1 : -1, xl = flat !== undefined ? (depth < 0 ? Math.min(...ord.map((v) => v.x)) : Math.max(...ord.map((v) => v.x))) + flat : null, lp = [xl !== null ? xl : cx + sgn * bulge, cy, cz], lu = [], li = []; const uvf = lensUV || ((z, y) => [z, y]); lu.push(...uvf(cz, cy));
      for (const v of ord) { lp.push(xl !== null ? xl : v.x, v.y, v.z); lu.push(...uvf(v.z, v.y)); } for (let k = 0; k < n; k++) li.push(0, 1 + ((k + 1) % n), 1 + k);
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(lu, 2)); lg.setIndex(li); lg.computeVertexNormals(); both(lg, lensMat, 'lens'); }
  };
  const shrink = (f) => (v, c) => ({ x: c.x, y: c.y + (v.y - c.y) * f, z: c.z + (v.z - c.z) * f });
  const shrinkMid = (f) => (v, c) => ({ x: c.x, y: c.y + (v.y - c.y) * f, z: v.z * 0.9 });
  const edgeTube = (h, mat, r, name, dz = 0) => { const pts = ring(h); if (pts.length < 8) return; const cz = pts.reduce((s, v) => s + v.z, 0) / pts.length, cy = pts.reduce((s, v) => s + v.y, 0) / pts.length;
    const ord = pts.map((v) => ({ a: Math.atan2(v.y - cy, v.z - cz), v })).sort((p, q) => p.a - q.a); const crv = new THREE.CatmullRomCurve3(ord.map((p) => new THREE.Vector3(p.v.x, p.v.y, p.v.z + dz)), true); both(new THREE.TubeGeometry(crv, 120, r, 8, true), mat, name); };
  edgeTube(HOLES[2], Mt.trim, 0.0042, 'headBezel');
  // 大燈（影片：深色的燈殼裡兩個圓的反光碗：外面那個大燈、裡面那個遠燈）：殼＝深鐵灰；碗朝前（+x），碗口在燈罩後面
  const gunM = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.45, metalness: 0.5, side: THREE.DoubleSide }); gunM.userData.slot = 'trim';
  lampBox(HOLES[2], -0.13, shrink(0.8), Mt.lensClear, () => {
    const RP = ring(HOLES[2]), xs = (z, y) => { let s = 0, w = 0; for (const v of RP) { const q = 1 / ((v.z - z) ** 2 + (v.y - y) ** 2 + 1e-6) ** 1.5; s += v.x * q; w += q; } return s / w; }; // 燈罩在 (z, y) 的 x
    const rm = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.06, emissive: 0xffffff, emissiveIntensity: 0.03, side: THREE.DoubleSide }); rm.userData.slot = 'reflector';
    const pm = new THREE.MeshStandardMaterial({ color: 0x14171b, metalness: 1, roughness: 0.04, emissive: 0xffffff, emissiveIntensity: 0.03, side: THREE.DoubleSide }); pm.userData.slot = 'reflector'; // 投射燈的鏡片：白天深色亮亮的，晚上跟反光碗一起亮
    for (const [zc, yc, r, proj] of [[0.745, 0.677, 0.043, true], [0.47, 0.674, 0.046, false]]) { // 外面：投射燈（深色圓鏡片）；裡面：遠燈的反光碗＋燈泡
      let xr = 9; for (let k = 0; k <= 16; k++) { const a = (k / 16) * PI; xr = Math.min(xr, xs(zc + r * Math.cos(a), yc + r * Math.sin(a))); } xr -= 0.008; // 碗口：上半圈燈罩最裡面那點再往裡 8 公釐
      const d = proj ? 0.018 : 0.026, Rb = (r * r + d * d) / (2 * d), th = Math.asin(Math.min(1, r / Rb));
      const bw = new THREE.SphereGeometry(Rb, 40, 12, 0, 2 * PI, 0, th); bw.rotateZ(PI / 2); bw.translate(xr + Rb * Math.cos(th), yc, zc); both(bw, rm, 'headBowl');
      if (proj) { const ln = new THREE.SphereGeometry(0.028, 36, 12, 0, 2 * PI, 0, PI / 2); ln.rotateZ(-PI / 2); ln.scale(0.5, 1, 1); ln.translate(xr - 0.010, yc, zc); both(ln, pm, 'projLens');
        const cr = new THREE.TorusGeometry(0.0295, 0.0025, 8, 40); cr.rotateY(PI / 2); cr.translate(xr - 0.010, yc, zc); both(cr, chromeDS, 'projRing'); }
      else { const bulb = new THREE.SphereGeometry(0.009, 14, 10); bulb.translate(xr - d + 0.014, yc, zc); both(bulb, Mt.bulb, 'bulb');
        const cap = new THREE.SphereGeometry(0.016, 6, 3, 0, 2 * PI, 0, PI / 2).toNonIndexed(); cap.computeVertexNormals(); cap.rotateZ(-PI / 2); cap.translate(xr - d + 0.028, yc, zc); both(cap, chromeDS, 'bulbCap'); }
      const rg = new THREE.TorusGeometry(r + 0.002, 0.0028, 8, 48); rg.rotateY(PI / 2); rg.translate(xr + 0.001, yc, zc); both(rg, chromeDS, 'bowlRing'); }
  }, (z, y) => [z * 4, y * 4], 0.012, undefined, false, gunM);
  // 水箱罩：殼＋黑色六角網（後面 2.5 公分）＋一圈黑框（同 GC8）
  const meshTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c2 = cv.getContext('2d'); c2.clearRect(0, 0, 256, 256); c2.strokeStyle = '#000'; c2.lineWidth = 7; for (let y = 0; y < 256; y += 32) for (let x = 0; x < 256; x += 32) { const ox = (y / 32) % 2 ? 16 : 0; c2.beginPath(); for (let k = 0; k < 6; k++) { const a = k * PI / 3 + PI / 6; c2[k ? 'lineTo' : 'moveTo'](x + ox + 16 + 16 * Math.cos(a), y + 16 + 16 * Math.sin(a)); } c2.closePath(); c2.stroke(); } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const hexFlat = (lw) => { const W = 256, H = 148, R = W / 3, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); c.strokeStyle = '#000'; c.lineWidth = lw; c.lineJoin = 'round';
    for (const [hx, hy] of [[0, 0], [W, 0], [0, H], [W, H], [W / 2, H / 2]]) { c.beginPath(); for (let k = 0; k < 6; k++) { const a = (k * PI) / 3; c[k ? 'lineTo' : 'moveTo'](hx + R * Math.cos(a), hy + R * Math.sin(a)); } c.closePath(); c.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  const meshMat = new THREE.MeshStandardMaterial({ map: meshTex, transparent: true, alphaTest: 0.5, color: 0x0a0a0a, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide }); meshMat.userData.slot = 'net';
  { const bm = meshMat.clone(); bm.map = meshTex.clone(); bm.map.repeat.set(27, 21); bm.map.needsUpdate = true; bodyMesh.material.push(bm); }
  lampBox(HOLES[3], -0.07, shrinkMid(0.6), null, () => {}, null, 0, undefined, true);
  { const RG = ring(HOLES[3]), xs = (z, y) => { let s = 0, w = 0; for (const v of RG) { const q = 1 / ((v.z - z) ** 2 + (v.y - y) ** 2 + 1e-6); s += v.x * q; w += q; } return s / w; };
    const nm = new THREE.MeshStandardMaterial({ map: hexFlat(18), transparent: true, alphaTest: 0.5, color: 0x0c0c0d, roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide }); nm.userData.slot = 'netF';
    const span = (y) => { let lo = 9, hi = -9; for (let k = 0; k < GRILLE.length; k++) { const [z1, y1] = GRILLE[k], [z2, y2] = GRILLE[(k + 1) % GRILLE.length]; if (y1 !== y2 && (y1 - y) * (y2 - y) <= 0) { const z = z1 + ((y - y1) / (y2 - y1)) * (z2 - z1); lo = Math.min(lo, z); hi = Math.max(hi, z); } } return [Math.max(0, lo), hi]; };
    const ys = GRILLE.map((p) => p[1]), ya = Math.min(...ys) + 0.0005, yb = Math.max(...ys) - 0.0005, nz = 40, ny = 12, pp = [], uu = [], ii = [];
    for (let j = 0; j <= ny; j++) { const y = ya + ((yb - ya) * j) / ny, [lo, hi] = span(y); for (let i = 0; i <= nz; i++) { const z = lo + ((hi - lo) * i) / nz; pp.push(xs(z, y) - 0.025, y, z); uu.push(z / 0.10, (y - 0.607) / 0.027); } }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nz; i++) { const a = j * (nz + 1) + i, b = a + 1, c2 = a + nz + 1, d = c2 + 1; ii.push(a, d, b, a, c2, d); }
    const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); ng.setAttribute('uv', new THREE.Float32BufferAttribute(uu, 2)); ng.setIndex(ii); ng.computeVertexNormals(); both(ng, nm, 'grilleNet');
    const fp = []; for (let k = 0; k < GRILLE.length - 1; k++) { const [z1, y1] = GRILLE[k], [z2, y2] = GRILLE[k + 1], n = Math.max(1, Math.ceil(Math.hypot(z2 - z1, y2 - y1) / 0.01)); for (let s2 = 0; s2 < n; s2++) fp.push([z1 + ((z2 - z1) * s2) / n, y1 + ((y2 - y1) * s2) / n]); } fp.push(GRILLE[GRILLE.length - 1]);
    const crv = new THREE.CatmullRomCurve3(fp.map(([z, y]) => new THREE.Vector3(xs(z, y) - 0.004, y, z)), false); both(new THREE.TubeGeometry(crv, 160, 0.0065, 8, false), Mt.trim, 'grilleFrame'); }
  // 保桿正面（車頭那一片）：中間大開口（黑網＋後面深灰的中冷器）、角上兩顆小白燈、下面兩邊的進氣口（黑網）
  let noseGeo = null;
  { const last = G[nx - 1], xf = last[0].x, half = last.map((v) => [v.z, v.y]), outer = half.concat(half.slice(1, -1).reverse().map(([z, y]) => [-z, y]));
    const SL = mirrorLoop(SMALL), LL = mirrorLoop(LOWER);
    noseGeo = flatPlate([outer, MOUTH, SMALL, SL, LOWER, LL], xf, 0.02, Mt.paint, 'noseCap', noseUV).geometry;
    const icM = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.4 }); icM.userData.slot = 'trim';
    const mp = pocket(MOUTH, xf, 1, 0.07, 0.94, darkDS, null, 'mouth'); flatPlate([mp.bk], mp.x1, 0.03, icM, 'intercooler', null, 1);
    flatPlate([MOUTH], xf - 0.02, 0.03, meshMat, 'mouthNet', (z, y) => [-z * 6.25, y * 6.25]);
    for (const L of [SMALL, SL]) { const p = pocket(L, xf, 1, 0.022, 0.85, lgM, frostM, 'small', (z, y) => [z / 0.096, y / 0.096]); const b = new THREE.SphereGeometry(0.007, 12, 8); b.translate(xf - 0.012, p.cy, p.cz); addMesh(b, Mt.bulb, 'smallBulb');
      flatPlate([L], xf + 0.001, 0.01, Mt.lensClear, 'smallLens', (z, y) => [z * 4, y * 4]); }
    for (const L of [LOWER, LL]) { pocket(L, xf, 1, 0.05, 0.8, darkDS, Mt.dark, 'lower'); flatPlate([L], xf - 0.015, 0.02, meshMat, 'lowerNet', (z, y) => [-z * 6.25, y * 6.25]); }
    // 下面黑色的唇（影片：保桿下面一片黑的，往前凸一點）
    const sh = new THREE.Shape(), x0 = 2.08, x1 = 2.335, zw = 0.80, rr = 0.12;
    sh.moveTo(x0, -zw); sh.lineTo(x1 - rr, -zw); sh.quadraticCurveTo(x1, -zw, x1, -zw + rr); sh.lineTo(x1, zw - rr); sh.quadraticCurveTo(x1, zw, x1 - rr, zw); sh.lineTo(x0, zw); sh.closePath();
    const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 8 }); sg.rotateX(PI / 2); sg.translate(0, 0.152, 0); addMesh(crease(sg), Mt.trim, 'splitter'); }
  // 車尾：四顆圓尾燈（燈罩往外鼓 6 公釐、一圈黑框）、倒車燈（左，透明）、後霧燈（右，紅）、第三煞車燈（上緣中間）、車牌
  for (const [z0, yc, r, cell] of TL) for (const zc of [z0, -z0]) {
    const K = 6, S = 48, pp = [], uu = [], ii = [];
    pp.push(XB - 0.006, yc, zc); uu.push(...cellUV(cell, 0, 0, r));
    for (let k = 1; k <= K; k++) { const rho = (r * k) / K; for (let s = 0; s < S; s++) { const a = (s / S) * 2 * PI, dz = rho * Math.cos(a), dy = rho * Math.sin(a); pp.push(XB - 0.006 * (1 - (rho / r) ** 2), yc + dy, zc + dz); uu.push(...cellUV(cell, dz, dy, r)); } }
    for (let s = 0; s < S; s++) ii.push(0, 1 + s, 1 + ((s + 1) % S));
    for (let k = 1; k < K; k++) for (let s = 0; s < S; s++) { const a = 1 + (k - 1) * S + s, b = 1 + (k - 1) * S + ((s + 1) % S); ii.push(a, a + S, b, b, a + S, b + S); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(uu, 2)); lg.setIndex(ii); addMesh(faceX(lg, -1), tailM, 'tailLens');
    const bz = new THREE.TorusGeometry(r + 0.0005, 0.0032, 8, 48); bz.rotateY(PI / 2); bz.translate(XB - 0.0012, yc, zc); addMesh(bz, Mt.trim, 'tailBezel'); }
  { const RL = mirrorLoop(REV);
    pocket(REV, XB, -1, 0.012, 0.9, darkDS, null, 'fog'); flatPlate([REV], XB - 0.002, 0.01, tailM, 'fogLens', (z, y) => cellUV(2, z - 0.2525, y - 0.5135, 0.08), -1);
    const p = pocket(RL, XB, -1, 0.022, 0.85, lgM, revM, 'rev'); const b = new THREE.SphereGeometry(0.008, 12, 8); b.translate(XB + 0.012, p.cy, p.cz); addMesh(b, Mt.bulb, 'revBulb');
    flatPlate([RL], XB - 0.002, 0.01, Mt.lensClear, 'revLens', (z, y) => [z * 4, y * 4], -1); }
  { const hb = new THREE.BoxGeometry(0.012, 0.03, 0.26, 1, 1, 12), hm = new THREE.MeshStandardMaterial({ color: 0xbfc3c8, roughness: 0.35, metalness: 0.3 }); hm.userData.slot = 'trim'; // 第三煞車燈：淺灰的框＋中間一條紅（影片）
    hb.translate(XB - 0.004, 0.889, 0); addMesh(crease(hb), hm, 'stop3');
    const sl = new THREE.BoxGeometry(0.004, 0.012, 0.22, 1, 1, 12), su = sl.attributes.uv; for (let k = 0; k < su.count; k++) su.setXY(k, ...cellUV(2, (su.getX(k) - 0.5) * 0.12, (su.getY(k) - 0.5) * 0.04, 0.08)); sl.translate(XB - 0.011, 0.889, 0); addMesh(sl, tailM, 'stop3Lens'); }
  { const fr = new THREE.BoxGeometry(0.012, 0.165, 0.345, 1, 4, 16); fr.translate(XB - 0.004, 0.4375, 0); addMesh(fr, Mt.dark, 'plateFrame');
    const pl = new THREE.BoxGeometry(0.006, 0.15, 0.33, 1, 8, 16); pl.translate(XB - 0.011, 0.4375, 0); addMesh(pl, plateM, 'plate'); }
  // 後視鏡（影片：車窗前下角一塊三角座（車身色）＋圓圓的殼；同 GC8，往後 21 公分）
  for (const s of [1, -1]) {
    const tri = new THREE.Shape(); tri.moveTo(0.585, 0.935); tri.lineTo(0.415, 0.935); tri.quadraticCurveTo(0.44, 0.985, 0.48, 1.015); tri.closePath();
    const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 }); tg.translate(0, 0, s > 0 ? 0.783 : -0.783 - 0.012); addMesh(crease(tg), paint2, 'mirrorSail');
    const W = 0.16, Hh = 0.05, rO = 0.044, rI = 0.022, D = 0.05, BT = 0.022, sh = new THREE.Shape();
    sh.moveTo(0, -Hh + rI); sh.quadraticCurveTo(0, -Hh, rI, -Hh); for (const [x1, y1, cx, cy, x2, y2] of [[W - rO, -Hh, W, -Hh, W, -Hh + rO], [W, Hh - rO, W, Hh, W - rO, Hh], [rI, Hh, 0, Hh, 0, Hh - rI]]) { sh.lineTo(x1, y1); sh.quadraticCurveTo(cx, cy, x2, y2); } sh.closePath();
    const hg = new THREE.ExtrudeGeometry(sh, { depth: D, curveSegments: 10, bevelEnabled: true, bevelThickness: BT, bevelSize: 0.016, bevelSegments: 5 });
    { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) { const zz = p.getZ(i); if (zz < D * 0.6) { const t = (D * 0.6 - zz) / (D * 0.6 + BT), f = 1 - 0.30 * t * t; p.setX(i, W * 0.5 + (p.getX(i) - W * 0.5) * f); p.setY(i, (p.getY(i)) * (1 - 0.18 * t * t)); } } }
    hg.rotateY(-PI / 2); hg.computeVertexNormals();
    if (s < 0) { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -p.getZ(i)); for (let i = 0; i < p.count; i += 3) { for (const attr of [p, hg.attributes.normal, hg.attributes.uv]) { if (!attr) continue; const n = attr.itemSize; for (let c = 0; c < n; c++) { const t1 = attr.array[(i + 1) * n + c]; attr.array[(i + 1) * n + c] = attr.array[(i + 2) * n + c]; attr.array[(i + 2) * n + c] = t1; } } } hg.computeVertexNormals(); }
    hg.translate(0.53, 0.995, 0.80 * s); addMesh(crease(hg, 0.9), paint2, 'mirrorShell');
    const fs = new THREE.Shape(); fs.moveTo(0.012, -0.034); fs.lineTo(W - 0.04, -0.034); fs.quadraticCurveTo(W - 0.008, -0.034, W - 0.008, -0.004); fs.lineTo(W - 0.008, 0.012); fs.quadraticCurveTo(W - 0.008, 0.038, W - 0.04, 0.038); fs.lineTo(0.012, 0.038); fs.closePath();
    const fg = new THREE.ShapeGeometry(fs, 8); if (s < 0) { const p = fg.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, -p.getX(i)); const I = fg.index.array; for (let k = 0; k < I.length; k += 3) { const t1 = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t1; } }
    fg.rotateY(-PI / 2); fg.translate(0.53 - D - BT - 0.002, 0.995, 0.80 * s);
    const fm = Mt.chrome.clone(); fm.color.set(0x9aa3aa); fm.roughness = 0.03; fm.userData.slot = 'mirror'; addMesh(fg, fm, 'mirrorGlass'); }
  // 門把（車門後面、窗戶下面）：凹槽（黑）＋把手（黑飾條）；側面的橘色小燈（前葉子板、前輪後面）
  for (const s of [1, -1]) { const zs = sideZ(-0.39, 0.806); const pocketG = new THREE.BoxGeometry(0.16, 0.034, 0.012); pocketG.translate(-0.39, 0.806, (zs - 0.004) * s); addMesh(pocketG, Mt.dark, 'pocket');
    const bar = new THREE.BoxGeometry(0.11, 0.018, 0.012); bar.translate(-0.385, 0.806, (zs + 0.003) * s); addMesh(crease(bar), Mt.trim, 'handle'); }
  { const xm = 0.82, ym = 0.46, zs = sideZ(xm, ym), n = new THREE.Vector3(sideZ(xm - 0.01, ym) - sideZ(xm + 0.01, ym), sideZ(xm, ym - 0.01) - sideZ(xm, ym + 0.01), 0.02).normalize(), qn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    const pill = (L, Hh) => { const p = new THREE.Shape(), r = Hh / 2; p.moveTo(-L / 2 + r, -r); p.lineTo(L / 2 - r, -r); p.absarc(L / 2 - r, 0, r, -PI / 2, PI / 2, false); p.lineTo(-L / 2 + r, r); p.absarc(-L / 2 + r, 0, r, PI / 2, 1.5 * PI, false); return p; };
    const rim = new THREE.ExtrudeGeometry(pill(0.064, 0.024), { depth: 0.002, bevelEnabled: false, curveSegments: 16 }); rim.applyQuaternion(qn); rim.translate(xm, ym, zs - 0.0005); both(rim, Mt.trim, 'markerRim');
    const ln = new THREE.ExtrudeGeometry(pill(0.058, 0.018), { depth: 0.002, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 3, curveSegments: 16 }); ln.applyQuaternion(qn); ln.translate(xm, ym, zs + 0.0012); both(crease(ln), Mt.lensAmber, 'marker'); }
  // 雨刷：躺在擋風玻璃最下面、貼著玻璃（兩支都往左躺）；擋風玻璃下面的黑條（前圍）
  { const x = 0.80, sl = Math.atan2(HC(x - 0.03) - HC(x + 0.03), 0.06); // 玻璃的斜度
    for (const [z0, L] of [[0.55, 0.52], [-0.02, 0.46]]) { const z1 = z0 - L, p0 = new THREE.Vector3(x, hoodY(x, z0), z0), p1 = new THREE.Vector3(x, hoodY(x, z1), z1), dz = p1.clone().sub(p0).normalize(), nn = new THREE.Vector3(Math.sin(sl), Math.cos(sl), 0);
      const yA = nn.clone().sub(dz.clone().multiplyScalar(nn.dot(dz))).normalize(), xA = new THREE.Vector3().crossVectors(yA, dz), mb = new THREE.Matrix4().makeBasis(xA, yA, dz), cen = p0.clone().add(p1).multiplyScalar(0.5);
      const arm = new THREE.BoxGeometry(0.012, 0.012, L); arm.applyMatrix4(mb); arm.translate(cen.x + yA.x * 0.016, cen.y + yA.y * 0.016, cen.z + yA.z * 0.016); addMesh(arm, Mt.trim, 'wiperArm');
      const bl = new THREE.BoxGeometry(0.018, 0.008, L - 0.04); bl.applyMatrix4(mb); bl.translate(cen.x + yA.x * 0.006, cen.y + yA.y * 0.006, cen.z + yA.z * 0.006 - dz.z * 0.01); addMesh(bl, Mt.rubber, 'wiperBlade'); } }
  { const pp = [], ii = [], nz = 28, xa = 0.852, xb = 0.912; for (let k = 0; k <= nz; k++) { const z = -0.70 + (1.40 * k) / nz; pp.push(xa, hoodY(xa, z) + 0.002, z, xb, hoodY(xb, z) + 0.002, z); if (k) { const b = (k - 1) * 2; ii.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); cg.setIndex(ii); cg.computeVertexNormals(); if (cg.attributes.normal.getY(0) < 0) { const I = cg.index.array; for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; } cg.computeVertexNormals(); }
    addMesh(cg, Mt.trim, 'cowl'); }
  // 車底（同 GC8 第 54 批，照 GT-R 的軸距搬）：消音器、排氣管、觸媒、中段消音器、傳動軸、後差速器、油箱、下擺臂、引擎下護板
  { const um = (c, r = 0.75, mt = 0.35) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: mt }); m.userData.slot = 'under'; return m; };
    const steel = um(0x5b5853, 0.6, 0.6), pipe = um(0x48443f, 0.65, 0.55), black = um(0x1b1c1e, 0.8, 0.2), cast = um(0x34353a, 0.7, 0.45), plast = um(0x161719, 0.9, 0);
    const tube = (pts, r, m, name, seg = 48) => addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, zz]) => new THREE.Vector3(x, y, zz))), seg, r, 12, false), m, name);
    const can = (x0, x1, ry, rz, y, zz, m, name, cap = true) => { const c = new THREE.CylinderGeometry(1, 1, x1 - x0, 24, 1, !cap); c.rotateZ(PI / 2); c.scale(1, ry, rz); c.translate((x0 + x1) / 2, y, zz); return addMesh(c, m, name); };
    const box = (x, y, zz, sx, sy, sz, m, name, ry = 0) => { const b = new THREE.BoxGeometry(sx, sy, sz); if (ry) b.rotateY(ry); b.translate(x, y, zz); return addMesh(b, m, name); };
    can(-2.06, -1.68, 0.052, 0.105, 0.178, -0.42, steel, 'muffler');
    for (const x of [-1.74, -2.0]) can(x - 0.012, x + 0.012, 0.055, 0.108, 0.178, -0.42, black, 'mufflerBand', false);
    tube([[1.02, 0.162, -0.11], [0.85, 0.153, -0.14], [0.6, 0.151, -0.15], [0.0, 0.151, -0.17], [-0.7, 0.151, -0.20], [-1.38, 0.152, -0.30], [-1.60, 0.16, -0.40], [-1.70, 0.17, -0.42]], 0.026, pipe, 'exhaustPipe', 96);
    can(0.58, 0.86, 0.033, 0.055, 0.153, -0.15, steel, 'cat');
    can(-0.48, -0.10, 0.031, 0.062, 0.152, -0.185, steel, 'resonator');
    can(-1.235, 0.70, 0.032, 0.032, 0.17, 0, black, 'driveshaft');
    for (const x of [0.66, -0.18, -1.195]) can(x - 0.03, x + 0.03, 0.04, 0.04, 0.17, 0, cast, 'ujoint');
    box(-0.18, 0.152, 0, 0.07, 0.03, 0.16, cast, 'shaftMount');
    { const d = new THREE.SphereGeometry(1, 20, 12); d.scale(0.12, 0.055, 0.13); d.translate(XR, 0.185, 0); addMesh(d, cast, 'diff'); }
    { const sh = new THREE.Shape(); sh.moveTo(-0.70, -0.02); sh.lineTo(-0.70, 0.56); sh.quadraticCurveTo(-0.70, 0.60, -0.74, 0.60); sh.lineTo(-1.14, 0.60); sh.quadraticCurveTo(-1.18, 0.60, -1.18, 0.56); sh.lineTo(-1.18, -0.02); sh.quadraticCurveTo(-1.18, -0.06, -1.14, -0.06); sh.lineTo(-0.74, -0.06); sh.quadraticCurveTo(-0.70, -0.06, -0.70, -0.02);
      const tg = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 2, curveSegments: 6 }); tg.rotateX(PI / 2); tg.translate(0, 0.149, 0); addMesh(crease(tg), black, 'fuelTank'); }
    for (const x of [-0.80, -1.08]) box(x, 0.1275, 0.27, 0.035, 0.003, 0.70, cast, 'tankStrap');
    for (const s of [1, -1]) { box(XR + 0.07, 0.14, 0.51 * s, 0.05, 0.03, 0.20, cast, 'armR'); box(XR - 0.09, 0.14, 0.51 * s, 0.04, 0.025, 0.20, cast, 'armR2');
      box(XF - 0.04, 0.14, 0.45 * s, 0.05, 0.03, 0.26, cast, 'armF', 0.25 * s); }
    { const sh = new THREE.Shape(); sh.moveTo(0.96, -0.36); sh.lineTo(1.73, -0.30); sh.lineTo(1.73, 0.30); sh.lineTo(0.96, 0.36); sh.closePath();
      const pg = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.008, bevelSegments: 1 }); pg.rotateX(PI / 2); pg.translate(0, 0.142, 0); addMesh(pg, plast, 'underTray'); }
    tube([[-2.04, 0.19, -0.42], [-2.09, 0.205, -0.43], [-2.15, 0.215, -0.437]], 0.03, pipe, 'tailPipe', 16); }
  // 車內（透過玻璃看得到；烘焙的不要：遊戲用 cabin.js 的車內）（同 GC8）
  if (!opt.bake) { const ds = new THREE.Shape(); ds.moveTo(0.38, 0.66); ds.lineTo(0.38, 0.84); ds.quadraticCurveTo(0.53, 0.93, 0.83, 0.91); ds.lineTo(0.84, 0.66); ds.closePath();
    const dg = new THREE.ExtrudeGeometry(ds, { depth: 1.36, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }); dg.translate(0, 0, -0.68); addMesh(dg, Mt.plastic, 'dash');
    const sw = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 16, 64), Mt.plastic); sw.position.set(0.31, 0.86, 0.37); sw.rotation.y = PI / 2; sw.rotation.x = 0.35; g.add(sw);
    const seatM = new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.92, envMapIntensity: 0.4 }); seatM.userData.slot = 'interior';
    const ss2 = new THREE.Shape(); ss2.moveTo(0.25, 0.40); ss2.lineTo(0.25, 0.54); ss2.quadraticCurveTo(0.07, 0.58, -0.13, 0.56); ss2.lineTo(-0.33, 1.08); ss2.quadraticCurveTo(-0.37, 1.15, -0.45, 1.12); ss2.lineTo(-0.49, 0.40); ss2.closePath();
    for (const z of [0.37, -0.37]) { const sg = new THREE.ExtrudeGeometry(ss2, { depth: 0.46, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 4 }); sg.translate(0, 0, z - 0.23); addMesh(sg, seatM, 'seat'); }
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 1.30), seatM); bench.position.set(-1.05, 0.54, 0); g.add(bench);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.02, 1.55), Mt.cloth); floor.position.set(-0.6, 0.33, 0); g.add(floor);
    for (const s of [1, -1]) { const card = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.50, 0.03), Mt.plastic); card.position.set(0.12, 0.60, 0.76 * s); g.add(card); }
    const liner = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.015, 0.90), Mt.liner); liner.position.set(-0.28, 1.285, 0); g.add(liner); }
  // 車頭、車尾那一片跟車身接的那一圈：兩邊的法線平均（貼圖的 uv 不一樣，頂點沒有併在一起）
  const mendEdge = (geos, xp) => { const key = (y, z) => `${Math.round(y * 1e5)},${Math.round(z * 1e5)}`, acc = new Map();
    for (const geo of geos) { const p = geo.attributes.position, n = geo.attributes.normal; for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - xp) < 1e-6) { const k = key(p.getY(i), p.getZ(i)); let a = acc.get(k); if (!a) acc.set(k, (a = [0, 0, 0, 0])); a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); a[3]++; } }
    for (const geo of geos) { const p = geo.attributes.position, n = geo.attributes.normal; for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - xp) < 1e-6) { const a = acc.get(key(p.getY(i), p.getZ(i))); if (a[3] < 2) continue; const l = Math.hypot(a[0], a[1], a[2]) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); } n.needsUpdate = true; } };
  mendEdge([body], XB); mendEdge([body, noseGeo], XN);
  // 車頭、車尾從上面看是圓弧：繞一根直立的軸彎（照弧長：z 不會變窄），越靠近頭（尾）彎越多（同 GC8 的 deformAll）
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
  { const FX = XN, FR = 6.0, F0 = 2.0, F1 = 2.22, RX = XB, RR = 7.0, R0 = -2.12, R1 = -2.27;
    const bend = (x, y, z, o) => { o[1] = y;
      if (x > F0) { const w = ss((x - F0) / (F1 - F0)), r = FR - FX + x, t = z / r; o[0] = x + w * (FX - FR + r * Math.cos(t) - x); o[2] = z + w * (r * Math.sin(t) - z); }
      else if (x < R0) { const w = ss((R0 - x) / (R0 - R1)), r = RR + RX - x, t = z / r; o[0] = x + w * (RX + RR - r * Math.cos(t) - x); o[2] = z + w * (r * Math.sin(t) - z); }
      else { o[0] = x; o[2] = z; }
      return o; };
    deformAll(bend, (x) => x > F0 || x < R0); }
  // 排氣管（左後，影片：一支大的、橢圓的不鏽鋼尾管）：彎完才加
  { const z = -0.437, y = 0.215, L = 0.20, xe = -2.335, tm = new THREE.MeshStandardMaterial({ color: 0xd0d2d5, roughness: 0.18, metalness: 1, side: THREE.DoubleSide }); tm.userData.slot = 'bright';
    const tip = new THREE.CylinderGeometry(0.05, 0.05, L, 40, 1, true); tip.rotateZ(PI / 2); tip.scale(1, 0.82, 1); tip.translate(xe + L / 2, y, z); addMesh(tip, tm, 'exhaust');
    const lip = new THREE.TorusGeometry(0.047, 0.0045, 10, 40); lip.rotateY(PI / 2); lip.scale(1, 0.82, 1); lip.translate(xe, y, z); addMesh(lip, tm, 'exhaustLip');
    const soot = new THREE.MeshStandardMaterial({ color: 0x1e1c1a, roughness: 0.9 }); soot.userData.slot = 'dark';
    const sl = new THREE.CylinderGeometry(0.0465, 0.0465, 0.15, 32, 1, true); sl.rotateZ(PI / 2); sl.scale(1, 0.82, 1); sl.translate(xe + 0.08, y, z); addMesh(inward(sl), soot, 'exhaustSoot');
    const inn = new THREE.CircleGeometry(0.047, 32); inn.rotateY(-PI / 2); inn.scale(1, 0.82, 1); inn.translate(xe + 0.155, y, z); addMesh(inn, Mt.dark, 'exhaustIn'); }
  // 尾翼（影片：兩支車身色的立柱，上面圓圓的、比翼片高；中間車身色的主翼＋上面後半一片黑色的副翼）：彎完才加（不彎）
  { const ZO = 0.665, LT = 0.062, ZL = ZO - LT / 2, yb = (x) => hoodY(x, ZL) - 0.012;
    for (const s of [1, -1]) { const ls = new THREE.Shape(); // 立柱的側面 (x, y)：細細的、往後一點點，上面接到圓頭裡面
      ls.moveTo(-1.93, yb(-1.93)); ls.quadraticCurveTo(-1.945, 1.10, -1.968, 1.20); ls.lineTo(-2.138, 1.20); ls.quadraticCurveTo(-2.112, 1.10, -2.10, yb(-2.10)); ls.closePath();
      const lg = new THREE.ExtrudeGeometry(ls, { depth: LT - 0.014, curveSegments: 14, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.007, bevelSegments: 4 }); lg.translate(0, 0, s * ZL - (LT - 0.014) / 2); addMesh(crease(lg), paint2, 'wingLeg');
      const kn = new THREE.CapsuleGeometry(0.048, 0.17, 10, 28); kn.rotateZ(PI / 2); kn.scale(1, 0.95, 0.85); kn.rotateZ(-0.06); kn.translate(-2.045, 1.212, s * (ZO - 0.041)); addMesh(kn, paint2, 'wingKnob'); } // 立柱上面圓圓的頭（影片：比翼片高）
    const af = new THREE.Shape(); // 主翼剖面（x 往車頭）：前緣圓、後緣薄；弦長 25 公分
    af.moveTo(0.125, 0.0); af.bezierCurveTo(0.128, 0.016, 0.10, 0.026, 0.05, 0.028); af.bezierCurveTo(-0.03, 0.029, -0.10, 0.024, -0.125, 0.018); af.lineTo(-0.126, 0.008); af.bezierCurveTo(-0.08, 0.0, -0.02, -0.006, 0.05, -0.007); af.bezierCurveTo(0.10, -0.008, 0.122, -0.005, 0.125, 0.0);
    const zi = ZO - LT + 0.006, wg = new THREE.ExtrudeGeometry(af, { depth: 2 * zi, curveSegments: 16, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });
    wg.translate(0, 0, -zi); wg.rotateZ(-0.06); wg.translate(-2.045, 1.168, 0); addMesh(crease(wg), paint2, 'wing');
    const fl = new THREE.Shape(); fl.moveTo(0.08, 0.0); fl.bezierCurveTo(0.08, 0.008, 0.05, 0.012, 0.0, 0.012); fl.lineTo(-0.08, 0.008); fl.lineTo(-0.081, 0.0); fl.bezierCurveTo(-0.02, -0.004, 0.05, -0.004, 0.08, 0.0); // 副翼（黑）
    const zf = ZO - LT + 0.004, fg = new THREE.ExtrudeGeometry(fl, { depth: 2 * zf, curveSegments: 10, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
    fg.translate(0, 0, -zf); fg.rotateZ(-0.30); fg.translate(-2.105, 1.198, 0); const fm = Mt.trim.clone(); fm.color.set(0x0e0f11); fm.roughness = 0.35; addMesh(crease(fg), fm, 'wingFlap'); }
  // ---- 輪子 ----
  if (!opt.bake) for (const [xa, s] of [[XF, 1], [XF, -1], [XR, 1], [XR, -1]]) { const w = wheel(THREE, Mt); w.position.set(xa, RW, TRACK * s); if (s < 0) w.rotation.y = PI; g.add(w); }
  let tris = 0; g.traverse((o) => { if (o.isMesh) { const gg = o.geometry; tris += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; } });
  window.__CAR2G = G;
  return { group: g, info: { tris: Math.round(tris), bodyTris: index.length / 3, ms: Math.round(performance.now() - t0), nx, M }, mats: Mt };
}
// ---- 輪子（外側朝 +z；只有看的時候用，遊戲用 parts.js 的）：胎紋輪胎、六輻鐵灰輪框（影片）----
function wheel(THREE, Mt) {
  const g = new THREE.Group(), R = RW, w = TW, rim = RIM, gun = new THREE.MeshStandardMaterial({ color: 0x5a5d62, roughness: 0.32, metalness: 0.85 });
  { const prof = [[rim - 0.002, -w / 2 + 0.012], [rim + 0.016, -w / 2 + 0.002], [R - 0.045, -w / 2], [R - 0.016, -w / 2 + 0.008], [R - 0.003, -w / 2 + 0.028], [R, -w / 2 + 0.05]];
    const z0 = -w / 2 + 0.05, z1 = w / 2 - 0.05, nz = Math.round((z1 - z0) / 0.004); for (let k = 1; k <= nz; k++) prof.push([R, z0 + (z1 - z0) * k / nz]);
    prof.push([R - 0.003, w / 2 - 0.028], [R - 0.016, w / 2 - 0.008], [R - 0.045, w / 2], [rim + 0.016, w / 2 - 0.002], [rim - 0.002, w / 2 - 0.012]);
    const NA = 360, np = prof.length, pos = new Float32Array((NA + 1) * np * 3), idx = [];
    for (let i = 0; i <= NA; i++) { const th = i / NA * 2 * PI, cs = Math.cos(th), sn = Math.sin(th); for (let j = 0; j < np; j++) { const [r, z] = prof[j], o = (i * np + j) * 3; pos[o] = r * cs; pos[o + 1] = r * sn; pos[o + 2] = z; } }
    for (let i = 0; i < NA; i++) for (let j = 0; j < np - 1; j++) { const a = i * np + j, b = a + np; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setIndex(idx); tg.computeVertexNormals();
    { const n0 = tg.attributes.normal, mid = Math.floor(np / 2); if (n0.getX(mid) * pos[mid * 3] + n0.getY(mid) * pos[mid * 3 + 1] < 0) { const I2 = tg.index.array; for (let k = 0; k < I2.length; k += 3) { const s = I2[k + 1]; I2[k + 1] = I2[k + 2]; I2[k + 2] = s; } tg.computeVertexNormals(); } }
    g.add(new THREE.Mesh(tg, Mt.rubber)); }
  { const bp = [[rim - 0.012, -w / 2 + 0.01], [rim + 0.006, -w / 2 + 0.006], [rim + 0.006, -w / 2 + 0.02], [rim - 0.01, -w / 2 + 0.03], [rim - 0.01, w / 2 - 0.035], [rim + 0.004, w / 2 - 0.022], [rim + 0.012, w / 2 - 0.012], [rim + 0.012, w / 2 - 0.004], [rim + 0.002, w / 2 + 0.002], [rim - 0.012, w / 2 - 0.004], [rim - 0.018, w / 2 - 0.02]].map(([r, y]) => new THREE.Vector2(r, y));
    const barrel = new THREE.Mesh(new THREE.LatheGeometry(bp, 96), gun); barrel.geometry.rotateX(PI / 2); g.add(barrel);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(rim - 0.018, rim - 0.018, w * 0.8, 64, 1, true), Mt.dark.clone()); inner.geometry.rotateX(PI / 2); inner.material.side = THREE.DoubleSide; g.add(inner);
    const zo = w / 2 - 0.024, zi = w / 2 - 0.07;
    for (let k = 0; k < 6; k++) { const a = k * PI / 3 + PI / 6, sh = new THREE.Shape(), r0 = 0.07, r1 = rim - 0.004;
      sh.moveTo(r0, -0.026); sh.lineTo(r1 - 0.05, -0.024); sh.quadraticCurveTo(r1 - 0.012, -0.024, r1, -0.04); sh.lineTo(r1, 0.04); sh.quadraticCurveTo(r1 - 0.012, 0.024, r1 - 0.05, 0.024); sh.lineTo(r0, 0.026); sh.closePath();
      const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.02, curveSegments: 8, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3 }); const p = sg.attributes.position;
      for (let i = 0; i < p.count; i++) { const t = Math.min(1, Math.max(0, (p.getX(i) - r0) / (r1 - r0))); p.setZ(i, p.getZ(i) + zi + (zo - zi) * t); } sg.computeVertexNormals(); sg.rotateZ(a);
      const B = window.__BGU; g.add(new THREE.Mesh(B && B.toCreasedNormals ? B.toCreasedNormals(sg, 0.7) : sg, gun)); }
    const hp = [[0.09, -0.01], [0.088, 0.016], [0.078, 0.028], [0.05, 0.034], [0, 0.036]].map(([r, y]) => new THREE.Vector2(r, y));
    const hub = new THREE.Mesh(new THREE.LatheGeometry(hp, 64), gun); hub.geometry.rotateX(PI / 2); hub.position.z = zi + 0.004; g.add(hub);
    for (let k = 0; k < 5; k++) { const a = k * 2 * PI / 5 + PI / 2, nut = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.016, 6), Mt.chrome); nut.geometry.rotateX(PI / 2); nut.position.set(0.05 * Math.cos(a), 0.05 * Math.sin(a), zi + 0.046); g.add(nut); } }
  { const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.028, 96), Mt.steel); disc.geometry.rotateX(PI / 2); disc.position.z = -0.01; g.add(disc);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.07), new THREE.MeshStandardMaterial({ color: 0x9a7f2a, roughness: 0.45, metalness: 0.5 })); cal.position.set(0.095, 0.12, -0.01); cal.rotation.z = 0.5; g.add(cal); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
return { build, loft, HOLES, isGlass, XF, XR, RW, TRACK, TW, RIM };
})();
