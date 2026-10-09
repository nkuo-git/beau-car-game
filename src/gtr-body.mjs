// 3D Nissan Skyline GT-R R34（BNR34）車身 SDF，做法跟 body.mjs 的 Supra 一樣：
// 側面、俯視、正面輪廓拉成柱體取交集＋修圓，加上前後方形輪弧外擴、挖輪拱、保桿進氣口，最後切網格。
// 座標（公尺）：x 往車頭（-2.30 車尾、+2.30 車頭）、y 往上、z 往車的右側。
// 尺寸：長 4.60、寬 1.785、高 1.36、軸距 2.665、輪距前 1.48／後 1.49、245/40R18。
// 形狀照 Nick 2026-09-26 傳的藍色 R34 照片（相機從兩個輪子反推，再把照片上的點投回車身量出來）。
import { curve, sdf2d, look, smin, smax, rbox } from './body.mjs';

export const GTR = { L: 4.60, W: 1.785, H: 1.36, xr: -1.375, xf: 1.29, R: 0.327 };
const mirrorZ = (r) => [...r, ...r.slice(1, -1).reverse().map(([x, z, s]) => [x, -z, s])];

// 下半身側面（中線）：車尾下 → 車尾 → 行李箱 → 腰線 → 引擎蓋 → 車頭 → 下巴 → 底盤
export const LOWER_SIDE = [
  [-2.08, 0.155, 0], [-2.25, 0.20, 1], [-2.29, 0.32, 1], [-2.30, 0.55, 1], [-2.296, 0.80, 1], [-2.282, 0.915, 1], [-2.235, 0.968, 1],
  [-2.12, 0.993, 1], [-1.98, 1.0, 1], [-1.62, 1.01, 1], [-1.20, 1.002, 1], [-0.40, 0.975, 1], [0.40, 0.95, 1], [0.85, 0.925, 1],
  [1.40, 0.872, 1], [1.90, 0.80, 1], [2.10, 0.758, 1], [2.19, 0.71, 1], [2.25, 0.63, 1], [2.29, 0.53, 1], [2.305, 0.40, 1],
  [2.292, 0.26, 1], [2.245, 0.155, 1], [2.12, 0.12, 0], [1.70, 0.115, 0], [-1.70, 0.13, 0],
];
// 車艙側面：前擋 → 車頂 → 後擋，下面伸進車身
export const CABIN_SIDE = [
  [0.97, 0.84, 0], [0.62, 1.085, 1], [0.36, 1.275, 1], [0.12, 1.34, 1], [-0.30, 1.36, 1], [-0.72, 1.338, 1], [-1.06, 1.225, 1],
  [-1.42, 1.075, 1], [-1.62, 1.005, 0], [-1.66, 0.78, 0], [1.00, 0.78, 0],
];
// 俯視輪廓：車頭、車尾都很方，輪弧那段最寬（外擴另外加）
export const PLAN = mirrorZ([
  [2.305, 0, 1], [2.295, 0.30, 1], [2.27, 0.47, 1], [2.22, 0.62, 1], [2.13, 0.75, 1], [1.99, 0.83, 1], [1.78, 0.862, 1],
  [1.40, 0.866, 1], [0.80, 0.858, 1], [0.00, 0.853, 1], [-0.80, 0.858, 1], [-1.40, 0.866, 1], [-1.85, 0.862, 1], [-2.08, 0.842, 1],
  [-2.20, 0.785, 1], [-2.27, 0.66, 1], [-2.295, 0.45, 1], [-2.30, 0, 1],
]);
// 車艙俯視（腰線高度），越高越往內收
export const CABIN_PLAN = mirrorZ([
  [0.98, 0, 1], [0.94, 0.40, 1], [0.80, 0.63, 1], [0.55, 0.735, 1], [0.00, 0.758, 1], [-0.60, 0.758, 1], [-1.10, 0.735, 1],
  [-1.42, 0.665, 1], [-1.60, 0.50, 1], [-1.67, 0, 1],
]);
export const CABIN_Y0 = 0.90, TUMBLE = 0.34;
// 下半身正面輪廓（z, y）
export const FRONT = [
  [0, 0.10, 0], [0.72, 0.10, 0], [0.845, 0.15, 1], [0.884, 0.28, 1], [0.8925, 0.46, 1], [0.888, 0.62, 1], [0.872, 0.76, 1],
  [0.838, 0.865, 1], [0.79, 0.935, 1], [0.70, 1.0, 0], [0, 1.0, 0],
].concat([[-0.70, 1.0, 0], [-0.79, 0.935, 1], [-0.838, 0.865, 1], [-0.872, 0.76, 1], [-0.888, 0.62, 1], [-0.8925, 0.46, 1], [-0.884, 0.28, 1], [-0.845, 0.15, 1], [-0.72, 0.10, 0]]);

const CROWN = [[-2.4, 0.045], [-1.6, 0.05], [-1.0, 0.06], [0.8, 0.06], [1.4, 0.05], [2.4, 0.05]];
const CABIN_CROWN = 0.045;
function lerpTable(t, x) {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const a = t[i - 1], b = t[i], u = (x - a[0]) / (b[0] - a[0]), s = u * u * (3 - 2 * u); return a[1] + (b[1] - a[1]) * s; }
  return t[t.length - 1][1];
}
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gau = (a, m, s) => Math.exp(-(((a - m) / s) ** 2));
// 2D 圓角方塊的距離
const box2 = (x, y, hx, hy, r) => { const qx = Math.abs(x) - hx + r, qy = Math.abs(y) - hy + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };

export const NOSE_X = 1.5; // 跟 Supra 同樣的接口（GT-R 只有一種車頭，套件都是外掛的零件）
export function makeSDF(opt = {}) {
  const res = 0.005;
  const side = sdf2d(curve(LOWER_SIDE), -2.45, -0.05, 2.45, 1.2, res);
  const cabS = sdf2d(curve(CABIN_SIDE), -1.8, 0.7, 1.2, 1.45, res);
  const plan = sdf2d(curve(PLAN), -2.45, -1.1, 2.45, 1.1, res);
  const cabP = sdf2d(curve(CABIN_PLAN), -1.9, -1.0, 1.2, 1.0, res);
  const front = sdf2d(curve(FRONT), -1.1, -0.05, 1.1, 1.2, res);
  const R1 = opt.R1 ?? 0.075, R2 = opt.R2 ?? 0.07, RC = opt.RC ?? 0.10, RU = opt.RU ?? 0.04;
  const arch = { R: 0.372, zIn: 0.60 };
  // 前後方形外擴輪弧（GT-R 的招牌）：圓角方塊，跟車身平順接起來，上緣不超過腰線
  const flares = [
    { x: GTR.xf + 0.02, y: 0.50, hx: 0.50, hy: 0.215, k: 0.07 },
    { x: GTR.xr - 0.03, y: 0.53, hx: 0.56, hy: 0.235, k: 0.11 },
  ];
  return function f(x, y, z) {
    const az = Math.abs(z);
    const zz = az / 0.9;
    // 引擎蓋中間微微隆起、兩側各一道折線
    const hood = sstep(0.95, 1.2, x) * (1 - sstep(2.0, 2.2, x));
    const cr = lerpTable(CROWN, x) * zz * zz + hood * (-0.010 * gau(az, 0, 0.30) + 0.006 * gau(az, 0.50, 0.06));
    const dS = look(side, x, y + cr);
    const dP = look(plan, x, az);
    const dF = look(front, az, y);
    let d = smax(dS, dP, R1 * (1 - 0.4 * sstep(-1.8, -2.0, x)));
    d = smax(d, dF, R2);
    for (const fl of flares) {
      const b = rbox(x - fl.x, y - fl.y, az - 0.80, fl.hx, fl.hy, 0.0925, 0.07);
      d = smin(d, smax(b, dS + 0.01, 0.05), fl.k);
    }
    // 車艙
    const zc = az / 0.75;
    const cS = look(cabS, x, y + CABIN_CROWN * zc * zc);
    const cP = look(cabP, x, az + Math.max(0, y - CABIN_Y0) * TUMBLE);
    d = smin(d, smax(cS, cP, RC), RU);
    // 側裙
    if (x > -1.0 && x < 0.95 && y < 0.32) {
      const sk = smax(smax(az - 0.872, Math.max(y - 0.25, 0.13 - y), 0.03), Math.max(-0.96 - x, x - 0.82), 0.05);
      d = smin(d, sk, 0.02);
    }
    // 前保桿：大燈中間的水箱罩、下面的中冷器開口、兩側的進氣口（沿著保桿的弧度挖）、輪子前面的導風口
    if (x > 1.9) {
      d = smax(d, -rbox(x - 2.30, y - 0.653, az, 0.075, 0.041, 0.34, 0.012), 0.01);
      d = smax(d, -rbox(x - 2.36, y - 0.385, az, 0.12, 0.101, 0.31, 0.03), 0.012);
      for (const [z0, z1, y0, y1, dep] of [[0.466, 0.74, 0.302, 0.395, 0.03], [0.36, 0.754, 0.197, 0.258, 0.025], [0.516, 0.632, 0.454, 0.522, 0.02]]) {
        const win = box2(az - (z0 + z1) / 2, y - (y0 + y1) / 2, (z1 - z0) / 2, (y1 - y0) / 2, 0.01);
        d = smax(d, -Math.max(win, -(dP + dep)), 0.012);
      }
    }
    if (x > 1.6 && x < 2.2) d = smax(d, -rbox(x - 1.845, y - 0.382, az - 0.90, 0.075, 0.11, 0.06, 0.012), 0.008);
    // 輪拱：外緣一圈、挖洞
    for (const [xa, zl] of [[GTR.xr, 0.862], [GTR.xf, 0.862]]) {
      if (y > 0.18 && Math.abs(x - xa) < 0.62) {
        const q = Math.hypot(x - xa, y - GTR.R) - (arch.R + 0.012);
        d = smin(d, Math.hypot(q, az - zl) - 0.024, 0.03);
      }
    }
    for (const xa of [GTR.xr, GTR.xf]) {
      const dc = Math.hypot(x - xa, y - GTR.R) - arch.R;
      d = smax(d, -smax(dc, arch.zIn - az, 0.03), 0.025);
    }
    return d;
  };
}
