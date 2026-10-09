// 3D 法拉利 Daytona SP3 車身 SDF。
// 座標（公尺）：x 往車頭（-2.343 車尾、+2.343 車頭）、y 往上、z 往車的右側。
// 尺寸：長 4.686、寬 2.050、高 1.142、軸距 2.651、輪距前 1.691／後 1.631、輪胎 265/30 R20（前）、345/30 R21（後）。
// 形狀照 Nick 2026-09-27 傳的紅色 SP3 照片（前 3/4、後 3/4），相機從輪子和車牌反推（sp3d/cams.mjs）。
// 做法跟 GT-R 一樣：中線側面輪廓、俯視輪廓拉成柱體取交集＋修圓，只是頂面用「高度差」做出前後葉子板的隆起
// （SP3 的引擎蓋夾在兩個高高的前葉子板中間、車尾兩個大後葉子板中間是引擎蓋），車艙（整片護目鏡式的車窗）另外做再接上。
import { curve, sdf2d, look, smin, smax, rbox } from './body.mjs';

export const SP3 = { L: 4.686, W: 2.05, H: 1.142, xf: 1.21, xr: -1.441, RF: 0.3335, RR: 0.370 };
export const BOUNDS = [-2.40, 0.04, 2.40, 1.20, 1.06];
const mirrorZ = (r) => [...r, ...r.slice(1, -1).reverse().map(([x, z, s]) => [x, -z, s])];

// 下半身中線側面：車頭 → 引擎蓋 → 前擋下緣 → （車艙底下）→ 引擎蓋板 → 車尾上緣 → 車尾（百葉）→ 下面黑色擴散器 → 底盤 → 前下巴
export const SIDE = [
  [2.305, 0.49, 1], [2.26, 0.535, 1], [2.14, 0.565, 1], [1.95, 0.597, 1], [1.55, 0.655, 1], [1.15, 0.702, 1], [0.795, 0.745, 1],
  [0.30, 0.79, 1], [-0.40, 0.85, 1], [-0.85, 0.915, 1], [-1.05, 0.95, 1], [-1.50, 0.945, 1], [-1.90, 0.945, 1], [-2.16, 0.945, 1],
  [-2.25, 0.93, 1], [-2.285, 0.87, 1], [-2.29, 0.70, 1], [-2.29, 0.45, 1], [-2.27, 0.26, 1], [-2.18, 0.16, 0],
  [-1.60, 0.13, 0], [1.70, 0.115, 0], [2.20, 0.10, 1], [2.30, 0.112, 1], [2.318, 0.20, 1], [2.315, 0.34, 1], [2.31, 0.43, 1],
];
// 俯視輪廓（最寬的地方，高度方向另外收）：前葉子板寬、車門窄、後葉子板最寬，車尾往內收
export const PLAN = mirrorZ([
  [2.32, 0, 1], [2.31, 0.25, 1], [2.27, 0.48, 1], [2.19, 0.68, 1], [2.08, 0.84, 1], [1.93, 0.95, 1], [1.70, 1.0, 1],
  [1.25, 1.005, 1], [0.85, 0.99, 1], [0.50, 0.955, 1], [0.10, 0.935, 1], [-0.40, 0.95, 1], [-0.90, 1.01, 1], [-1.35, 1.025, 1],
  [-1.70, 1.0, 1], [-1.95, 0.93, 1], [-2.14, 0.84, 1], [-2.27, 0.72, 1], [-2.31, 0.45, 1], [-2.31, 0, 1],
]);
// 車艙側面（中線）：前擋 → 車頂 → 後面，下面伸進車身
export const CABIN_SIDE = [
  [0.90, 0.66, 0], [0.795, 0.745, 1], [0.56, 0.93, 1], [0.345, 1.10, 1], [0.10, 1.135, 1], [-0.25, 1.142, 1], [-0.60, 1.13, 1],
  [-0.88, 1.095, 1], [-1.00, 1.04, 1], [-1.05, 0.95, 0], [-1.05, 0.66, 0],
];
// 車艙俯視（腰線高度），越高越往內收
export const CABIN_PLAN = mirrorZ([
  [0.90, 0, 1], [0.87, 0.45, 1], [0.76, 0.70, 1], [0.50, 0.785, 1], [0.05, 0.80, 1], [-0.45, 0.79, 1], [-0.85, 0.74, 1],
  [-1.03, 0.60, 1], [-1.07, 0, 1],
]);
export const CABIN_Y0 = 0.80, TUMBLE = 0.62;

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const win = (x, a, b, c, d) => sstep(a, b, x) * (1 - sstep(c, d, x)); // a→b 升、c→d 降
const bump = (t) => (Math.abs(t) >= 1 ? 0 : (1 - t * t) ** 2);
// 點到線段的距離（3D）
function seg3(x, y, z, ax, ay, az, bx, by, bz) {
  const vx = bx - ax, vy = by - ay, vz = bz - az, wx = x - ax, wy = y - ay, wz = z - az;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy + wz * vz) / (vx * vx + vy * vy + vz * vz)));
  return Math.hypot(wx - vx * t, wy - vy * t, wz - vz * t);
}
const box2 = (x, y, hx, hy, r) => { const qx = Math.abs(x) - hx + r, qy = Math.abs(y) - hy + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };

// 後葉子板頂比中線高多少（沿 x）：輪子上方最高，往車尾下垂
const RR_LIFT = [[-2.35, 0.0], [-2.28, 0.035], [-2.18, 0.09], [-2.0, 0.145], [-1.8, 0.17], [-1.55, 0.155], [-1.3, 0.11], [-1.05, 0.05], [-0.75, 0.0]];
function tab(t, x) {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const a = t[i - 1], b = t[i], u = (x - a[0]) / (b[0] - a[0]), q = u * u * (3 - 2 * u); return a[1] + (b[1] - a[1]) * q; }
  return t[t.length - 1][1];
}
// 頂面加高多少（正＝往上）：前葉子板、後葉子板兩道隆起，中間微微拱
export function lift(x, az) {
  const zz = az / 1.0;
  const crown = -0.035 * zz * zz;
  const ff = 0.20 * win(x, 0.45, 0.90, 1.85, 2.26) * bump((az - 0.76) / 0.30);   // 前葉子板
  const rr = tab(RR_LIFT, x) * bump((az - 0.77) / 0.33); // 後葉子板（圓圓的一大塊）
  return crown + ff + rr;
}
// 側面往內收：下面收（側裙以下）、上面收（肩線以上）；後葉子板最寬的地方比較高，下面整個往內收（側面大進氣口）
function tuck(x, y) {
  const low = 0.07 * (1 - sstep(0.14, 0.34, y));
  const rearW = win(x, -2.5, -2.2, -0.75, -0.45);
  const yw = 0.56 + 0.20 * rearW;
  const shoulder = 1.1 * Math.max(0, y - yw) ** 2;
  const under = rearW * 0.06 * (1 - sstep(0.40, yw, y));
  return low + shoulder + under;
}

export function makeSDF(opt = {}) {
  const res = 0.005;
  const side = sdf2d(curve(SIDE), -2.5, -0.05, 2.5, 1.3, res);
  const plan = sdf2d(curve(PLAN), -2.5, -1.2, 2.5, 1.2, res);
  const cabS = sdf2d(curve(CABIN_SIDE), -1.2, 0.55, 1.1, 1.3, res);
  const cabP = sdf2d(curve(CABIN_PLAN), -1.2, -1.0, 1.1, 1.0, res);
  const R1 = 0.09, RC = 0.10, RU = 0.05;
  const arches = [{ x: SP3.xf, y: SP3.RF, R: 0.395, zIn: 0.62 }, { x: SP3.xr, y: SP3.RR, R: 0.43, zIn: 0.60 }];
  return function f(x, y, z) {
    const az = Math.abs(z);
    const dS = look(side, x, y - lift(x, az));
    const dP = look(plan, x, az + tuck(x, y));
    let d = smax(dS, dP, R1);
    // 車艙
    const zc = az / 0.8;
    const cS = look(cabS, x, y + 0.03 * zc * zc);
    const cP = look(cabP, x, az + Math.max(0, y - CABIN_Y0) * TUMBLE);
    d = smin(d, smax(cS, cP, RC), RU);
    // 車頭：鼻子下面整片水箱罩往內凹 9 公分、下面是開的（碳纖維下巴是另外的零件）；兩邊大燈下面的角落留著（紅色橫鰭）
    if (x > 1.9) {
      const g = Math.max(box2(az, y - 0.255, 0.64, 0.20, 0.04), 2.05 - x);
      d = smax(d, -Math.max(g, -(d + 0.09)), 0.02);
    }
    // 引擎蓋兩道通風口：在前葉子板內側斜坡上，從大燈內側往後上方斜
    if (x > 1.65 && x < 2.2 && az > 0.55) {
      const v = Math.min(seg3(x, y, az, 2.08, 0.635, 0.672, 1.95, 0.738, 0.80), seg3(x, y, az, 1.95, 0.738, 0.80, 1.76, 0.79, 0.817)) - 0.032;
      d = smax(d, -Math.max(v, -(d + 0.03)), 0.012);
    }
    // 車尾下面：擴散器的通道往上斜（從後輪後面 y 0.13 升到車尾 y 0.30）
    if (x < -1.85) {
      const roof = 0.13 + 0.17 * Math.min(1, (-1.85 - x) / 0.43);
      d = smax(d, -Math.max(y - roof, az - 0.62), 0.03);
    }
    // 車尾：百葉那一片往內凹 6 公分（橫鰭、中間排氣管那條黑帶是另外的零件，sp3-spec.js）
    if (x < -1.9 && !opt.noTail) {
      const t = box2(az, y - 0.76, 0.86, 0.18, 0.05);
      d = smax(d, -Math.max(t, -(d + 0.06)), 0.02);
    }
    // 輪拱：外緣一圈、挖洞
    for (const a of arches) {
      if (y > 0.12 && Math.abs(x - a.x) < a.R + 0.2) {
        const q = Math.hypot(x - a.x, y - a.y) - (a.R + 0.01);
        d = smin(d, Math.hypot(q, az - 0.965) - 0.018, 0.03);
      }
      const dc = Math.hypot(x - a.x, y - a.y) - a.R;
      d = smax(d, -smax(dc, a.zIn - az, 0.03), 0.02);
    }
    return d;
  };
}
