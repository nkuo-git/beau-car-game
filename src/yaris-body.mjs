// 3D Toyota GR Yaris 車身 SDF，做法跟 gtr-body.mjs 一樣：
// 側面、俯視、正面輪廓拉成柱體取交集＋修圓，加上車艙（掀背，車頂後段往下掉）、前後葉子板鼓包、挖輪拱，最後切網格。
// 水箱罩、進氣口、通風口都只是貼圖（yaris-look.js），沒有挖凹。
// 座標（公尺）：x 往車頭（-1.9975 車尾、+1.9975 車頭）、y 往上、z 往車的右側。
// 尺寸：長 3.995、寬 1.805、高 1.455、軸距 2.56、輪距前 1.535／後 1.565、225/40R18。
// 形狀照 Nick 2026-09-27 傳的兩張白色 GR Yaris 照片（相機從輪子、車牌反推，再把照片上的點投回車身量出來）。
import { curve, sdf2d, look, smin, smax, rbox } from './body.mjs';

export const YARIS = { L: 3.995, W: 1.805, H: 1.455, xr: -1.39, xf: 1.17, R: 0.319 };
export const BOUNDS = [-2.08, 0.0, 2.08, 1.52, 0.97];
const mirrorZ = (r) => [...r, ...r.slice(1, -1).reverse().map(([x, z, s]) => [x, -z, s])];

// 下半身側面（中線）：車尾下 → 後保桿 → 尾門 → 尾燈上緣 → 腰線 → 引擎蓋 → 車頭 → 下巴 → 底盤
export const LOWER_SIDE = [
  [-1.70, 0.22, 0], [-1.93, 0.27, 1], [-1.982, 0.335, 1], [-1.9975, 0.45, 1], [-1.993, 0.58, 1], [-1.965, 0.632, 1], [-1.90, 0.652, 1],
  [-1.892, 0.68, 1], [-1.866, 0.80, 1], [-1.826, 0.92, 1], [-1.82, 1.03, 1], [-1.805, 1.092, 1], [-1.60, 1.078, 1], [-1.20, 1.05, 1],
  [-0.40, 1.03, 1], [0.30, 1.04, 1], [0.85, 1.065, 1], [1.20, 1.005, 1], [1.50, 0.945, 1], [1.75, 0.885, 1], [1.90, 0.838, 1],
  [1.965, 0.795, 1], [1.99, 0.72, 1], [1.9975, 0.60, 1], [1.995, 0.42, 1], [1.985, 0.27, 1], [1.955, 0.175, 1], [1.86, 0.14, 0],
  [1.60, 0.135, 0], [-1.50, 0.15, 0],
];
// 車艙側面：前擋 → 車頂 → 尾擾流 → 後擋 → 尾門上段，下面伸進車身
export const CABIN_SIDE = [
  [1.02, 0.90, 0], [0.88, 1.05, 1], [0.50, 1.235, 1], [0.15, 1.395, 1], [-0.10, 1.443, 1], [-0.45, 1.456, 1], [-0.80, 1.447, 1],
  [-1.10, 1.422, 1], [-1.40, 1.375, 1], [-1.60, 1.33, 1], [-1.68, 1.295, 1], [-1.73, 1.25, 1], [-1.80, 1.11, 1], [-1.826, 1.03, 0],
  [-1.826, 0.85, 0], [1.02, 0.85, 0],
];
// 俯視輪廓（車身本體，葉子板鼓包另外加）
export const PLAN = mirrorZ([
  [1.9975, 0, 1], [1.994, 0.30, 1], [1.982, 0.50, 1], [1.96, 0.62, 1], [1.925, 0.715, 1], [1.87, 0.79, 1], [1.79, 0.842, 1],
  [1.66, 0.866, 1], [1.30, 0.872, 1], [1.00, 0.868, 1], [0.60, 0.858, 1], [0.00, 0.853, 1], [-0.50, 0.856, 1], [-1.00, 0.864, 1], [-1.50, 0.866, 1],
  [-1.72, 0.855, 1], [-1.85, 0.81, 1], [-1.935, 0.715, 1], [-1.978, 0.54, 1], [-1.9975, 0, 1],
]);
// 車艙俯視（腰線高度），越高越往內收
export const CABIN_PLAN = mirrorZ([
  [1.02, 0, 1], [0.99, 0.42, 1], [0.91, 0.64, 1], [0.78, 0.752, 1], [0.55, 0.772, 1], [0.00, 0.775, 1], [-0.50, 0.77, 1],
  [-0.90, 0.745, 1], [-1.20, 0.705, 1], [-1.50, 0.645, 1], [-1.72, 0.565, 1], [-1.84, 0.43, 1], [-1.87, 0, 1],
]);
export const CABIN_Y0 = 1.0, TUMBLE = 0.36;
// 下半身正面輪廓（z, y）
export const FRONT = [
  [0, 0.12, 0], [0.74, 0.12, 0], [0.84, 0.17, 1], [0.866, 0.28, 1], [0.874, 0.46, 1], [0.868, 0.64, 1], [0.85, 0.80, 1],
  [0.82, 0.92, 1], [0.77, 1.01, 1], [0.68, 1.075, 0], [0, 1.085, 0],
].concat([[-0.68, 1.075, 0], [-0.77, 1.01, 1], [-0.82, 0.92, 1], [-0.85, 0.80, 1], [-0.868, 0.64, 1], [-0.874, 0.46, 1], [-0.866, 0.28, 1], [-0.84, 0.17, 1], [-0.74, 0.12, 0]]);

// 拱形（中線高 → 兩側低多少）
const CROWN = [[-2.1, 0.05], [-1.7, 0.06], [-1.0, 0.07], [0.8, 0.07], [1.4, 0.06], [2.1, 0.07]];
const CABIN_CROWN = 0.022;
function lerpTable(t, x) {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const a = t[i - 1], b = t[i], u = (x - a[0]) / (b[0] - a[0]), s = u * u * (3 - 2 * u); return a[1] + (b[1] - a[1]) * s; }
  return t[t.length - 1][1];
}
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gau = (a, m, s) => Math.exp(-(((a - m) / s) ** 2));
const box2 = (x, y, hx, hy, r) => { const qx = Math.abs(x) - hx + r, qy = Math.abs(y) - hy + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };
const ell = (x, y, z, e) => {
  const dx = (x - e.x) / e.rx, dy = (y - e.y) / e.ry, dz = (z - e.z) / e.rz;
  return (Math.sqrt(dx * dx + dy * dy + dz * dz) - 1) * Math.min(e.rx, e.ry, e.rz);
};

export const NOSE_X = 1.5;
export function makeSDF(opt = {}) {
  const res = 0.005;
  const side = sdf2d(curve(LOWER_SIDE), -2.15, -0.05, 2.15, 1.25, res);
  const cabS = sdf2d(curve(CABIN_SIDE), -2.0, 0.7, 1.2, 1.55, res);
  const plan = sdf2d(curve(PLAN), -2.15, -1.1, 2.15, 1.1, res);
  const cabP = sdf2d(curve(CABIN_PLAN), -2.0, -1.0, 1.2, 1.0, res);
  const front = sdf2d(curve(FRONT), -1.1, -0.05, 1.1, 1.2, res);
  const R1 = opt.R1 ?? 0.08, R2 = opt.R2 ?? 0.07, RC = opt.RC ?? 0.085, RU = opt.RU ?? 0.05;
  const arch = { R: 0.36, zIn: 0.60 }, archR = { R: 0.375, zIn: 0.62 };
  // 後葉子板大鼓包（GR Yaris 的招牌），前葉子板小一點
  const hau = { x: YARIS.xr + 0.10, y: 0.62, z: 0.50, rx: 0.78, ry: 0.46, rz: 0.382, k: 0.16 }; // 加上融合鼓出來的 2 公分，最寬剛好 1.805
  const fen = { x: YARIS.xf - 0.02, y: 0.56, z: 0.50, rx: 0.62, ry: 0.36, rz: 0.385, k: 0.12 };
  return function f(x, y, z) {
    const az = Math.abs(z);
    const zz = az / 0.9;
    const cr = lerpTable(CROWN, x) * zz * zz;
    const dS = look(side, x, y + cr);
    const dP = look(plan, x, az);
    const dF = look(front, az, y);
    let d = smax(dS, dP, R1);
    d = smax(d, dF, R2);
    d = smin(d, smax(smax(ell(x, y, az, hau), dS, 0.08), -1.90 - x, 0.12), 0.05 + (hau.k - 0.05) * sstep(-1.82, -1.55, x)); // 車尾那邊融合半徑變小，尾門才不會被鼓包往後推
    d = smin(d, smax(ell(x, y, az, fen), dS, 0.08), fen.k);
    // 車艙
    const zc = az / 0.75;
    const cS = look(cabS, x, y + CABIN_CROWN * zc * zc);
    const cP = look(cabP, x, az + Math.max(0, y - CABIN_Y0) * TUMBLE);
    d = smin(d, smax(cS, cP, RC), RU);
    // 輪拱：直接挖洞（GR Yaris 的葉子板是圓鼓的，固定 z 的捲邊會浮在外面，所以不加）
    for (const [xa, A] of [[YARIS.xr, archR], [YARIS.xf, arch]]) {
      const dc = Math.hypot(x - xa, y - YARIS.R) - A.R;
      d = smax(d, -smax(dc, A.zIn - az, 0.03), 0.025);
    }
    return d;
  };
}
