// 小越野車（K2，自己編的車，不是哪個牌子）的車身 SDF：短短的三門小越野車、圓一點的蛤殼引擎蓋、立起來的前擋、車身色的硬頂
// 做法跟 jp4-body.mjs 一樣：幾個方塊、側面輪廓拉成柱體取交集＋修圓，再挖輪拱、大燈、水箱罩的凹槽，最後 make-car.mjs 切網格。
// 黑色的圓輪弧、保桿、霧燈、備胎（硬殼蓋）、後照鏡、車底都是另外的零件（k2-spec.js）。
// 座標（公尺，原廠高度）：x 往車頭、y 往上（地面 0）、z 往車的右側；軸距 2.24（前軸 +1.10、後軸 −1.14），輪距 1.40，輪胎半徑 0.36（＋胎紋 1.2 公分）。
// 尺寸：車身長 3.44（加保桿 3.62、加備胎 3.86）、車身寬 1.60（加輪弧 1.72）、車頂 1.77、門檻離地 0.47。
// 遮罩只認得 y 0～1.4（車頭、車尾 0～1.3），所以網格存成「遮罩座標」（跟吉普車一樣）：xm = x·S、ym = (y − Y0)·S、zm = z·S。
import { curve, sdf2d, look, smin, smax, rbox } from './body.mjs';

export const K2 = { S: 0.92, Y0: 0.40, xf: 1.10, xr: -1.14, R: 0.36, T: 0.70 };
const { S, Y0 } = K2;
// 遮罩座標的範圍：[x0, y0, x1, y1, zmax]
export const BOUNDS = [-1.76 * S, (0.44 - Y0) * S, 1.80 * S, (1.82 - Y0) * S, 0.84 * S];

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const box2 = (px, py, hx, hy, r) => { const qx = Math.abs(px) - hx + r, qy = Math.abs(py) - hy + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };

// 車艙的側面：前圍 → 前擋（約 53 度）→ 車頂（中間拱一點點）→ 車尾（直的，上面圓圓的）→ 往下伸進車身
const CAB_SIDE = [
  [0.70, 1.02, 0], [0.672, 1.075, 1], [0.63, 1.095, 1], [0.18, 1.685, 1], [0.13, 1.735, 1], [0.05, 1.758, 1], [-0.70, 1.768, 1],
  [-1.52, 1.758, 1], [-1.625, 1.735, 1], [-1.675, 1.68, 1], [-1.69, 1.55, 1], [-1.695, 1.02, 0],
];

export function makeSDF() {
  const res = 0.004;
  const cab = sdf2d(curve(CAB_SIDE), -2.0, 0.9, 1.0, 1.9, res);
  const { xf, xr } = K2, AY = 0.37; // 輪拱圓心（輪子中心 0.36）
  function F(x, y, z) {
    const az = Math.abs(z);
    // 車身下半（駕駛座以後）：x −1.70…0.64、y 0.47…1.10，側面直的、四邊圓一點
    let d = rbox(x + 0.53, y - 0.785, az, 1.17, 0.315, 0.80, 0.07);
    // 車頭：蛤殼引擎蓋（往前低一點、中間拱一點、兩邊圓圓的包下去）＋水箱罩那面（上面往後倒一點）
    const hoodY = 1.078 - 0.05 * sstep(0.6, 1.74, x) - 0.026 * (az / 0.78) ** 2;
    const gx = 1.735 - 0.035 * sstep(0.62, 1.06, y);
    d = smin(d, smax(smax(smax(x - gx, y - hoodY, 0.07), smax(az - 0.785, 0.50 - y, 0.03), 0.07), 0.55 - x, 0.01), 0.02);
    // 車艙：側面輪廓 ∩ 俯視（越高越往內收，前擋那段再窄一點）
    const zc = 0.785 - 0.065 * sstep(1.12, 1.76, y) - 0.03 * sstep(0.25, 0.66, x);
    d = smin(d, smax(look(cab, x, y), az - zc, 0.06), 0.025);
    // 輪拱：前後一樣大的圓，挖到 z 0.58（裡面一道牆）
    for (const xa of [xf, xr]) {
      const dc = Math.hypot(x - xa, y - AY) - 0.445;
      d = smax(d, -smax(dc, 0.58 - az, 0.03), 0.015);
    }
    // 大燈：圓角長方形的凹槽（2.5 公分深）；水箱罩兩條橫的開口那一塊凹進去 1.8 公分
    const dl = box2(az - 0.545, y - 0.915, 0.105, 0.062, 0.042);
    d = smax(d, -smax(dl, (gx - 0.025) - x, 0.006), 0.006);
    const dg = box2(az, y - 0.905, 0.34, 0.07, 0.028);
    d = smax(d, -smax(dg, (gx - 0.018) - x, 0.005), 0.005);
    return d;
  }
  // 遮罩座標 → 公尺座標
  return (xm, ym, zm) => F(xm / S, ym / S + Y0, zm / S) * S;
}
