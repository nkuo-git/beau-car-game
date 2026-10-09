// 3D Subaru Impreza WRX STI coupe（GC8，Version 5/6 22B 風格的 STI Type R）車身 SDF，做法跟 gtr-body.mjs 一樣：
// 側面、俯視、正面輪廓拉成柱體取交集＋修圓，另外一個車艙，挖輪拱、加輪弧外緣，保桿挖進氣口，引擎蓋加大進氣口。
// 座標（公尺）：x 往車頭（-2.175 車尾、+2.175 車頭）、y 往上、z 往車的右側。
// 尺寸：長 4.35、寬 1.69、高 1.405、軸距 2.52；輪子 225/35R18（照片那台的金色 Speedline 六輻）。
// 形狀照 Nick 2026-09-27 傳的兩張藍色 GC8 照片（相機從輪框橢圓和接地點反推，再把車身投回照片疊圖修）。
import { curve, sdf2d, look, smin, smax, rbox } from './body.mjs';

export const GC8 = { L: 4.35, W: 1.69, H: 1.405, xr: -1.24, xf: 1.28, R: 0.307 };
export const BOUNDS = [-2.3, -0.02, 2.3, 1.5, 1.0];
const mirrorZ = (r) => [...r, ...r.slice(1, -1).reverse().map(([x, z, s]) => [x, -z, s])];

// 下半身側面（中線）：車尾下 → 車尾 → 行李箱 → 腰線 → 引擎蓋 → 車頭 → 下巴 → 底盤
export const LOWER_SIDE = [
  [-1.85, 0.25, 0], [-2.08, 0.27, 1], [-2.14, 0.315, 1], [-2.163, 0.42, 1], [-2.166, 0.52, 1], [-2.155, 0.60, 1], [-2.135, 0.70, 1],
  [-2.118, 0.86, 1], [-2.10, 0.94, 1], [-2.05, 0.982, 1], [-1.90, 0.997, 1], [-1.60, 1.0, 1], [-1.40, 0.995, 1], [-0.80, 0.965, 1],
  [0.0, 0.945, 1], [0.70, 0.915, 1], [1.10, 0.878, 1], [1.40, 0.848, 1], [1.65, 0.812, 1], [1.85, 0.776, 1], [1.98, 0.742, 1],
  [2.05, 0.705, 1], [2.078, 0.668, 1], [2.088, 0.60, 1], [2.10, 0.54, 1], [2.13, 0.48, 1], [2.146, 0.40, 1], [2.146, 0.30, 1],
  [2.132, 0.225, 1], [2.08, 0.195, 1], [1.90, 0.175, 0], [1.60, 0.165, 0], [-1.60, 0.19, 0],
];
// 車艙側面：前擋 → 車頂 → 後擋，下面伸進車身
export const CABIN_SIDE = [
  [0.90, 0.84, 0], [0.80, 0.90, 1], [0.50, 1.13, 1], [0.24, 1.335, 1], [0.05, 1.385, 1], [-0.30, 1.398, 1], [-0.65, 1.39, 1],
  [-0.92, 1.355, 1], [-1.10, 1.25, 1], [-1.30, 1.10, 1], [-1.46, 0.995, 0], [-1.50, 0.80, 0], [0.92, 0.80, 0],
];
// 俯視輪廓：車頭圓、車尾也圓，輪拱那段最寬
export const PLAN = mirrorZ([
  [2.15, 0, 1], [2.138, 0.30, 1], [2.10, 0.50, 1], [2.03, 0.66, 1], [1.93, 0.77, 1], [1.78, 0.832, 1], [1.55, 0.85, 1],
  [1.20, 0.853, 1], [0.80, 0.847, 1], [0.00, 0.845, 1], [-0.80, 0.847, 1], [-1.25, 0.853, 1], [-1.60, 0.845, 1], [-1.85, 0.815, 1],
  [-2.00, 0.755, 1], [-2.10, 0.64, 1], [-2.15, 0.46, 1], [-2.166, 0.22, 1], [-2.168, 0, 1],
]);
// 車艙俯視（腰線高度），越高越往內收
export const CABIN_PLAN = mirrorZ([
  [0.90, 0, 1], [0.88, 0.35, 1], [0.80, 0.58, 1], [0.67, 0.72, 1], [0.40, 0.755, 1], [0.00, 0.76, 1], [-0.60, 0.76, 1], [-1.00, 0.755, 1],
  [-1.25, 0.725, 1], [-1.42, 0.64, 1], [-1.49, 0.45, 1], [-1.52, 0, 1],
]);
export const CABIN_Y0 = 0.93, TUMBLE = 0.44;
// 下半身正面輪廓（z, y）
export const FRONT = [
  [0, 0.12, 0], [0.70, 0.12, 0], [0.815, 0.16, 1], [0.848, 0.28, 1], [0.857, 0.45, 1], [0.853, 0.62, 1], [0.838, 0.76, 1],
  [0.805, 0.87, 1], [0.76, 0.94, 1], [0.68, 1.01, 0], [0, 1.01, 0],
].concat([[-0.68, 1.01, 0], [-0.76, 0.94, 1], [-0.805, 0.87, 1], [-0.838, 0.76, 1], [-0.853, 0.62, 1], [-0.857, 0.45, 1], [-0.848, 0.28, 1], [-0.815, 0.16, 1], [-0.70, 0.12, 0]]);

const CROWN = [[-2.4, 0.05], [-1.6, 0.055], [-1.0, 0.06], [0.8, 0.05], [1.4, 0.045], [2.4, 0.05]];
const CABIN_CROWN = 0.05;
function lerpTable(t, x) {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const a = t[i - 1], b = t[i], u = (x - a[0]) / (b[0] - a[0]), s = u * u * (3 - 2 * u); return a[1] + (b[1] - a[1]) * s; }
  return t[t.length - 1][1];
}
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gau = (a, m, s) => Math.exp(-(((a - m) / s) ** 2));
// 2D 圓角方塊的距離
const box2 = (x, y, hx, hy, r) => { const qx = Math.abs(x) - hx + r, qy = Math.abs(y) - hy + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };

export const NOSE_X = 1.5;
export function makeSDF(opt = {}) {
  const res = 0.005;
  const side = sdf2d(curve(LOWER_SIDE), -2.4, -0.05, 2.4, 1.2, res);
  const cabS = sdf2d(curve(CABIN_SIDE), -1.8, 0.7, 1.0, 1.5, res);
  const plan = sdf2d(curve(PLAN), -2.4, -1.1, 2.4, 1.1, res);
  const cabP = sdf2d(curve(CABIN_PLAN), -1.9, -1.0, 1.0, 1.0, res);
  const front = sdf2d(curve(FRONT), -1.1, -0.05, 1.1, 1.2, res);
  const R1 = opt.R1 ?? 0.10, R2 = opt.R2 ?? 0.09, RC = opt.RC ?? 0.12, RU = opt.RU ?? 0.05;
  const arch = { R: 0.357, y: 0.295, zIn: 0.60 };
  return function f(x, y, z) {
    const az = Math.abs(z);
    const zz = az / 0.9;
    const cr = lerpTable(CROWN, x) * zz * zz;
    const dS = look(side, x, y + cr);
    const dP = look(plan, x, az);
    const dF = look(front, az, y);
    let d = smax(dS, dP, R1 * (1 + 0.5 * sstep(-1.85, -2.05, x)));
    d = smax(d, dF, R2);
    // 車艙
    const zc = az / 0.75;
    const cS = look(cabS, x, y + CABIN_CROWN * zc * zc);
    const cP = look(cabP, x, az + Math.max(0, y - CABIN_Y0) * TUMBLE);
    d = smin(d, smax(cS, cP, RC), RU);
    // 側裙：車門下面凸出一條（STI 側裙）
    if (x > -0.95 && x < 0.92 && y < 0.34) {
      const sk = smax(smax(az - 0.862, Math.max(y - 0.30, 0.185 - y), 0.03), Math.max(-0.88 - x, x - 0.85), 0.06);
      d = smin(d, sk, 0.03);
    }
    // 引擎蓋大進氣口：前面高、往後斜斜地融進引擎蓋，前面挖一個開口
    if (x > 0.95 && x < 1.5 && az < 0.45) {
      const hood = 0.878 - (x - 1.10) * 0.1; // 引擎蓋中間的高度（大約）
      const t = sstep(1.05, 1.36, x);        // 越前面越高
      const top = hood + 0.012 + 0.048 * t;
      const sc = smax(rbox(x - 1.215, 0, az, 0.16, 1, 0.30, 0.0), y - top, 0.05);
      d = smin(d, smax(sc, -(y - hood + 0.05), 0.02), 0.03);
      // 開口（往後挖）
      const op = rbox(x - 1.40, y - (hood + 0.034), az, 0.07, 0.019, 0.245, 0.012);
      d = smax(d, -op, 0.008);
    }
    // 兩個小導風口（左右各一，在大進氣口的斜前方）
    {
      const vx = 1.63, vz = 0.485;
      if (Math.abs(x - vx) < 0.2 && Math.abs(az - vz) < 0.16) {
        const hood = 0.812 - 0.012;
        const v = smax(rbox(x - vx, 0, az - vz, 0.10, 1, 0.075, 0.03), y - (hood + 0.022 * sstep(1.52, 1.70, x)), 0.02);
        d = smin(d, smax(v, -(y - hood + 0.04), 0.01), 0.02);
        d = smax(d, -rbox(x - 1.72, y - (hood + 0.012), az - vz, 0.05, 0.009, 0.06, 0.006), 0.005);
      }
    }
    // 前保桿：中間的大開口（車牌在前面）；霧燈蓋是平的，畫在貼圖上
    if (x > 1.95) {
      d = smax(d, -rbox(x - 2.20, y - 0.366, az, 0.12, 0.12, 0.40, 0.04), 0.012);
    }
    // 輪拱：外緣一圈（小小的翻邊）、挖洞
    for (const xa of [GC8.xr, GC8.xf]) {
      if (y > 0.16 && Math.abs(x - xa) < 0.6) {
        const q = Math.hypot(x - xa, y - arch.y) - (arch.R + 0.004);
        d = smin(d, Math.hypot(q, az - 0.838) - 0.02, 0.04);
      }
    }
    for (const xa of [GC8.xr, GC8.xf]) {
      const dc = Math.hypot(x - xa, y - arch.y) - arch.R;
      d = smax(d, -smax(dc, arch.zIn - az, 0.03), 0.02);
    }
    return d;
  };
}
