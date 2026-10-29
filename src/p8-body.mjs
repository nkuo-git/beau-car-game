// 皮卡（P8，自己編的車，不是哪個牌子）的車身 SDF：四門的雙排座皮卡、高高平平的引擎蓋（中間一條凸起來）、後面一個開著的車斗
// 做法跟 jp4-body.mjs、k2-body.mjs 一樣：幾個方塊、側面輪廓拉成柱體取交集＋修圓，再挖方方的輪拱、水箱罩、大燈的凹槽、車斗，最後 make-car.mjs 切網格。
// 黑色的方輪弧、保桿、側踏、車斗內襯、後窗、後照鏡、車底都是另外的零件（p8-spec.js）。
// 座標（公尺，原廠高度）：x 往車頭、y 往上（地面 0）、z 往車的右側；軸距 3.10（前軸 +1.70、後軸 −1.40），輪距 1.58，33 吋輪胎（半徑 0.42＋胎紋 1.4 公分）。
// 尺寸：車身長 5.05（加保桿 5.28）、車身寬 1.85（加輪弧 1.97）、車頂 1.84、門檻離地 0.50；車艙到 x −0.70，車斗 x −0.74…−2.55（裡面長 1.71、寬 1.72、深 0.33）。
// 遮罩只認得 x ±2.35、y 0～1.4（車頭、車尾 0～1.3），所以網格存成「遮罩座標」（跟吉普車一樣）：xm = x·S、ym = (y − Y0)·S、zm = z·S。
import { curve, sdf2d, look, smin, smax } from './body.mjs';

export const P8 = { S: 0.90, Y0: 0.40, xf: 1.70, xr: -1.40, R: 0.42, T: 0.79 };
const { S, Y0 } = P8;
// 遮罩座標的範圍：[x0, y0, x1, y1, zmax]
export const BOUNDS = [-2.64 * S, (0.44 - Y0) * S, 2.58 * S, (1.92 - Y0) * S, 0.99 * S]; // 四周至少留 2 格（surface nets 最外面那一格不出面）

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const box2 = (px, py, hx, hy, r) => { const qx = Math.abs(px) - hx + r, qy = Math.abs(py) - hy + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };
// 等腰梯形（中心在原點、下面半寬 r1、上面半寬 r2、半高 he）的距離（iq 的 sdTrapezoid）
function trap(px, py, r1, r2, he) {
  px = Math.abs(px);
  const k2x = r2 - r1, k2y = 2 * he;
  const cax = px - Math.min(px, py < 0 ? r1 : r2), cay = Math.abs(py) - he;
  const t = Math.max(0, Math.min(1, ((r2 - px) * k2x + (he - py) * k2y) / (k2x * k2x + k2y * k2y)));
  const cbx = px - r2 + k2x * t, cby = py - he + k2y * t;
  return (cbx < 0 && cay < 0 ? -1 : 1) * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby));
}
// 方方的輪拱（梯形、角修圓）：下面半寬 0.58（y 0.30）、上面半寬 0.46（y 0.94）
export const P8_ARCH = { yc: 0.62, r1: 0.58, r2: 0.46, he: 0.32, rr: 0.14 };
export const archDist = (dx, dy) => { const a = P8_ARCH; return trap(dx, dy, a.r1 - a.rr, a.r2 - a.rr, a.he - a.rr) - a.rr; };

// 車艙的側面：前圍 → 前擋（約 43 度）→ 車頂（平的）→ 車艙後面（y 1.22…1.70 是平的、上面往前倒 4.8 度：後窗貼在這裡）→ 往下伸進車身
const CAB_SIDE = [
  [1.16, 1.15, 0], [1.12, 1.212, 1], [1.075, 1.235, 1], [0.50, 1.786, 1], [0.42, 1.83, 1], [0.30, 1.842, 1], [-0.45, 1.846, 1],
  [-0.585, 1.834, 1], [-0.645, 1.79, 1], [-0.66, 1.70, 0], [-0.70, 1.22, 0], [-0.70, 1.15, 0],
];

export function makeSDF() {
  const res = 0.004;
  const cab = sdf2d(curve(CAB_SIDE), -1.0, 1.0, 1.4, 2.0, res);
  const { xf, xr } = P8;
  function F(x, y, z) {
    const az = Math.abs(z);
    // 車頭到車艙（x −0.70 … 車頭）：俯視前面兩個角圓圓的；上面＝引擎蓋（往前低一點、中間一條凸起來）、駕駛座那段是腰線 1.17
    const gx = 2.50 - 0.045 * sstep(0.95, 1.17, y); // 車頭的面（上面往後倒一點）
    const hood = 1.205 - 0.035 * sstep(1.15, 2.45, x) + 0.022 * (1 - sstep(0.26, 0.44, az)) * sstep(1.18, 1.40, x) * (1 - sstep(2.18, 2.42, x));
    const top = 1.17 + (hood - 1.17) * sstep(1.00, 1.14, x);
    const zw = 0.925 - 0.02 * sstep(1.0, 1.17, y); // 側面：y 1.0 以上往內收 2 公分（腰線那一條折線）
    const cx = (gx - 0.70) / 2;
    let d = x > cx ? box2(x - cx, az, (gx + 0.70) / 2, zw, 0.12) : smax(az - zw, -0.70 - x, 0.04);
    d = smax(smax(d, y - top, 0.05), 0.50 - y, 0.03);
    // 車艙：側面輪廓 ∩ 俯視（越高越往內收，前擋那段再窄一點）
    const zc = 0.90 - 0.075 * sstep(1.20, 1.84, y) - 0.035 * sstep(0.55, 1.05, x);
    d = smin(d, smax(look(cab, x, y), az - zc, 0.06), 0.02);
    // 車斗（x −2.55 … −0.74，跟車艙中間 4 公分的縫）：外面一個盒子（側面跟車艙一樣有腰線），裡面挖掉（地板 y 0.84、牆 4～6.5 公分）
    let dB = smax(smax(box2(x + 1.645, az, 0.905, zw, 0.05), y - 1.17, 0.025), 0.50 - y, 0.03);
    dB = smax(dB, -smax(box2(x + 1.645, az, 0.855, 0.86, 0.02), 0.84 - y, 0.02), 0.012);
    d = Math.min(d, dB);
    // 輪拱：方方的梯形，挖到 z 0.62（裡面一道牆）
    for (const xa of [xf, xr]) d = smax(d, -smax(archDist(x - xa, y - P8_ARCH.yc), 0.62 - az, 0.03), 0.015);
    // 水箱罩那一塊凹進去 2.2 公分（z ±0.47、y 0.72…1.07）；大燈的凹槽 1.5 公分（z 0.54…0.87、y 0.995…1.085）
    const dg = box2(az, y - 0.895, 0.47, 0.175, 0.045);
    d = smax(d, -smax(dg, (gx - 0.022) - x, 0.006), 0.006);
    const dl = box2(az - 0.705, y - 1.04, 0.165, 0.045, 0.03);
    d = smax(d, -smax(dl, (gx - 0.015) - x, 0.005), 0.005);
    return d;
  }
  // 遮罩座標 → 公尺座標
  return (xm, ym, zm) => F(xm / S, ym / S + Y0, zm / S) * S;
}
