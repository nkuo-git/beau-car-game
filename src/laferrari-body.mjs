// 3D 法拉利 LaFerrari（2013）車身 SDF，做法跟 gtr-body.mjs／sp3-body.mjs 一樣：
// 中線側面輪廓、俯視輪廓拉成柱體取交集＋修圓，頂面用「高度差」做出中間的鳥嘴、兩邊的溝、高高的前葉子板和後葉子板，
// 車艙（水滴形的車窗）另外做再接上；挖輪拱、車門後面的大凹槽和進氣口、車頭兩個大鼻孔、車尾黑色的大開口。
// 座標（公尺）：x 往車頭（-2.351 車尾、+2.351 車頭）、y 往上、z 往車的右側。
// 尺寸：長 4.702、寬 1.992、高 1.116、軸距 2.650、輪距前 1.660／後 1.600、輪胎 265/30 R19（前）、345/30 R20（後）。
// 形狀照四張紅色 LaFerrari 照片（左前方兩張、右後方兩張），相機從輪子和車牌反推（laferrari3d/fit*.mjs），再疊圖修輪廓。
import { curve, sdf2d, look, smin, smax } from './body.mjs';

export const LAFERRARI = { L: 4.702, W: 1.992, H: 1.116, xf: 1.265, xr: -1.385, RF: 0.3208, RR: 0.3575 };
export const BOUNDS = [-2.40, 0.04, 2.42, 1.17, 1.05];
const mirrorZ = (r) => [...r, ...r.slice(1, -1).reverse().map(([x, z, s]) => [x, -z, s])];

// 下半身中線側面：鳥嘴前端 → 引擎蓋 → 前擋下緣 → （車艙底下）→ 引擎蓋玻璃 → 尾翼板 → 車尾 → 擴散器 → 底盤 → 前下巴
export const SIDE = [
  [2.335, 0.455, 1], [2.29, 0.51, 1], [2.15, 0.55, 1], [1.90, 0.595, 1], [1.55, 0.645, 1], [1.20, 0.69, 1], [0.86, 0.73, 1],
  [0.40, 0.80, 1], [-0.30, 0.86, 1], [-0.95, 0.90, 1], [-1.40, 0.885, 1], [-1.80, 0.855, 1], [-2.05, 0.825, 1], [-2.17, 0.80, 1],
  [-2.215, 0.775, 1], [-2.225, 0.70, 1], [-2.225, 0.50, 1], [-2.265, 0.42, 1], [-2.28, 0.33, 1], [-2.25, 0.27, 1], [-2.10, 0.235, 0],
  [-1.70, 0.15, 0], [-1.30, 0.12, 0], [1.60, 0.11, 0], [2.25, 0.14, 1], [2.39, 0.15, 1], [2.40, 0.19, 1], [2.35, 0.225, 1], [2.33, 0.33, 1],
];
// 俯視輪廓（最寬的地方）：前下巴寬、前葉子板、車門收窄、後葉子板最寬，車尾往內收
export const PLAN = mirrorZ([
  [2.40, 0, 1], [2.385, 0.22, 1], [2.33, 0.42, 1], [2.22, 0.60, 1], [2.06, 0.75, 1], [1.86, 0.865, 1], [1.62, 0.94, 1],
  [1.30, 0.978, 1], [0.95, 0.97, 1], [0.50, 0.93, 1], [0.0, 0.925, 1], [-0.45, 0.95, 1], [-0.90, 0.985, 1], [-1.35, 0.996, 1],
  [-1.70, 0.985, 1], [-1.90, 0.955, 1], [-2.02, 0.905, 1], [-2.10, 0.84, 1], [-2.16, 0.75, 1], [-2.21, 0.60, 1], [-2.24, 0.40, 1], [-2.27, 0.2, 1], [-2.28, 0, 1],
]);
// 車艙側面（中線）：前擋 → 車頂 → 小小的後窗 → 接到引擎蓋玻璃，下面伸進車身
export const CABIN_SIDE = [
  [0.98, 0.62, 0], [0.86, 0.73, 1], [0.62, 0.92, 1], [0.38, 1.075, 1], [0.12, 1.112, 1], [-0.15, 1.116, 1], [-0.45, 1.098, 1],
  [-0.72, 1.048, 1], [-1.00, 0.99, 1], [-1.30, 0.94, 1], [-1.60, 0.893, 1], [-1.90, 0.85, 1], [-2.02, 0.80, 1], [-2.05, 0.62, 0],
];
// 車艙俯視（腰線高度），越高越往內收
export const CABIN_PLAN = mirrorZ([
  [0.98, 0, 1], [0.95, 0.42, 1], [0.84, 0.66, 1], [0.55, 0.76, 1], [0.10, 0.78, 1], [-0.40, 0.765, 1], [-0.80, 0.70, 1],
  [-1.05, 0.59, 1], [-1.35, 0.51, 1], [-1.65, 0.41, 1], [-1.95, 0.30, 1], [-2.06, 0.20, 1], [-2.09, 0, 1],
]);
export const CABIN_Y0 = 0.80, TUMBLE = 0.50;

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const win = (x, a, b, c, d) => sstep(a, b, x) * (1 - sstep(c, d, x)); // a→b 升、c→d 降
const bump = (t) => (Math.abs(t) >= 1 ? 0 : (1 - t * t) ** 2);
function tab(t, x) {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const a = t[i - 1], b = t[i], u = (x - a[0]) / (b[0] - a[0]), q = u * u * (3 - 2 * u); return a[1] + (b[1] - a[1]) * q; }
  return t[t.length - 1][1];
}
// 前葉子板頂比中線高多少（沿 x）：車頭很低，往後越來越高，輪子上面最高，接到車門腰線
const FF_LIFT = [[0.0, 0.0], [0.30, 0.0], [0.60, 0.02], [0.90, 0.05], [1.06, 0.07], [1.30, 0.125], [1.50, 0.12], [1.72, 0.06], [2.00, 0.02], [2.25, 0.0], [2.40, -0.02]];
// 後葉子板頂比中線高多少：從車門後面升起，後輪上方最高，往車尾的尾燈下垂
const RR_LIFT = [[-2.35, -0.02], [-2.15, 0.0], [-1.90, 0.03], [-1.55, 0.045], [-1.20, 0.04], [-0.90, 0.02], [-0.60, 0.0], [0.0, 0.0]];
// 中間鳥嘴兩邊的溝有多深
const CH = [[0.85, 0.0], [1.10, 0.025], [1.50, 0.045], [1.95, 0.045], [2.20, 0.02], [2.40, 0.0]];
// 鳥嘴（中間高起來那一條）半寬：往車頭越來越窄（V 形）
const BW = [[0.90, 0.31], [1.50, 0.27], [2.00, 0.18], [2.36, 0.08]];
// 前葉子板最高的那條稜線在哪（|z|）：往車頭往內收
const ZC = [[0.90, 0.80], [1.40, 0.80], [2.00, 0.73], [2.36, 0.63]];
// 頂面加高多少（正＝往上）
export function lift(x, az) {
  const crown = -0.02 * (az / 0.9) ** 2;
  let f = 0;
  if (x > 0.8) {
    const bw = tab(BW, x), zc = tab(ZC, x);
    const ch = -tab(CH, x) * sstep(bw - 0.02, bw + 0.04, az) * (1 - sstep(zc - 0.24, zc - 0.03, az)); // 鳥嘴邊很利，旁邊是溝
    const ff = tab(FF_LIFT, x) * sstep(zc - 0.26, zc - 0.01, az) * (1 - 0.7 * sstep(zc + 0.02, zc + 0.20, az)); // 葉子板稜線，外面往下掉
    f = ch + ff;
  } else f = tab(FF_LIFT, x) * sstep(0.48, 0.74, az) * (1 - sstep(0.90, 1.02, az) * 0.6);
  const rr = tab(RR_LIFT, x) * sstep(0.46, 0.76, az);                  // 後葉子板
  return crown + f + rr;
}
// 車門後面的大凹槽：下緣是一條往後升高的折線（0.6→0.33、-1.1→0.49），上緣是肩線（0.685），越往後越深，接到後輪前面的進氣口
export function scoop(x, y) {
  if (x > 0.75 || x < -1.2) return 0;
  const yl = 0.33 + (0.6 - x) * 0.094, yu = 0.69;
  const band = sstep(yl - 0.012, yl + 0.025, y) * (1 - sstep(yu - 0.05, yu + 0.005, y));
  const dep = 0.115 * sstep(0.35, -0.45, x) * (1 - sstep(-0.95, -1.15, x));
  return dep * band;
}
// 側面往內收：下面收（側裙以下）、上面收（肩線以上）、凹槽
function tuck(x, y) {
  const low = 0.06 * (1 - sstep(0.13, 0.32, y));
  const yw = 0.60 + 0.12 * win(x, -2.4, -2.1, -0.6, -0.2);
  const shoulder = 1.3 * Math.max(0, y - yw) ** 2;
  return low + shoulder + scoop(x, y);
}

export function makeSDF(opt = {}) {
  const res = 0.005;
  const side = sdf2d(curve(SIDE), -2.5, -0.05, 2.5, 1.3, res);
  const plan = sdf2d(curve(PLAN), -2.5, -1.2, 2.5, 1.2, res);
  const cabS = sdf2d(curve(CABIN_SIDE), -2.3, 0.5, 1.2, 1.3, res);
  const cabP = sdf2d(curve(CABIN_PLAN), -2.3, -1.0, 1.2, 1.0, res);
  const R1 = 0.08, RC = 0.10, RU = 0.05;
  const L = LAFERRARI;
  const arches = [{ x: L.xf, y: L.RF, R: 0.375, zIn: 0.67 }, { x: L.xr, y: L.RR, R: 0.42, zIn: 0.62 }];
  return function f(x, y, z) {
    const az = Math.abs(z);
    const dS = look(side, x, y - lift(x, az));
    const dP = look(plan, x, az + tuck(x, y));
    let d = smax(dS, dP, R1);
    // 車艙
    const zc = az / 0.78;
    const cS = look(cabS, x, y + 0.04 * zc * zc);
    const cP = look(cabP, x, az + Math.max(0, y - CABIN_Y0) * TUMBLE);
    d = smin(d, smax(cS, cP, RC), RU);
    // 車頭：兩個大鼻孔（中間紅色 V 形柱子、下面紅色前翼板），往裡挖深
    if (x > 1.95) {
      const k = Math.min(1, Math.max(0, az - 0.05) / 0.5);
      const yt = 0.395 + 0.03 * k, yb = 0.19 + 0.045 * k;          // 上緣、下緣（紅色前翼）都是往外升高
      const pw = 0.022 + Math.max(0, y - 0.19) * 0.24;                // 中間紅色柱子：下面細、上面寬（V 形）
      const g = Math.max(pw - az, az - 0.565, y - yt, yb - y);
      d = smax(d, -Math.max(g, 2.16 - x), 0.02);
      // 兩邊角落直的小進氣口
      const g2 = Math.max(Math.abs(az - 0.665) - 0.075, Math.max(y - 0.47, 0.205 - y));
      d = smax(d, -Math.max(g2, 2.10 - x + (az - 0.59) * 0.5), 0.02);
    }
    // 引擎蓋前面中間的大出風口（鳥嘴上面，往前開）
    if (x > 1.65 && x < 2.15 && az < 0.32) {
      const hw = 0.25 - (x - 1.72) * 0.08;
      const g = Math.max(Math.max(az - hw, 1.74 - x), x - 2.08);
      d = smax(d, -Math.max(g, -(d + 0.012 + Math.max(0, x - 1.74) * 0.26)), 0.02);
    }
    // 尾燈的圓筒（後葉子板尾端，圓燈面在 x≈-2.07）
    {
      const r = Math.hypot(y - 0.742, az - 0.785) - 0.088;
      const pod = smax(r, Math.max(-2.075 - x, x + 1.85), 0.02);
      d = smin(d, pod, 0.03);
      d = smax(d, -Math.max(r + 0.088 - 0.092, x + 2.078), 0.008); // 圓燈面（燈本身是零件）
    }
    // 車尾：尾翼板下面、中間柱子兩邊往內凹（黑色網子），下面黑色保桿
    if (x < -1.95) {
      const qz = Math.abs(az - 0.395) - 0.25, qy = Math.abs(y - 0.615) - 0.12, rr = 0.06; // 圓角的開口
      const g = Math.hypot(Math.max(qz + rr, 0), Math.max(qy + rr, 0)) + Math.min(Math.max(qz + rr, qy + rr), 0) - rr;
      d = smax(d, -Math.max(g, x + 2.10), 0.025);
    }
    // 排氣管的凹洞（兩邊各兩根）
    if (x < -1.95) {
      const g = Math.max(Math.abs(az - 0.555) - 0.115, Math.abs(y - 0.335) - 0.065);
      d = smax(d, -Math.max(g, x + 2.10), 0.02);
    }
    // 側面進氣口（後輪前面，凹槽最深的地方再往裡挖）
    if (x < 0.0 && x > -1.0 && az > 0.6) {
      const t = Math.max(-0.08 - x, 0) / 0.72;
      const yt = 0.62 - 0.02 * t, yb = 0.60 - 0.2 * Math.min(1, t * 1.3);
      const g = Math.max(y - yt, yb - y, x + 0.08, -0.85 - x);
      d = smax(d, -Math.max(g, 0.80 - az), 0.02);
    }
    // 輪拱：外緣一圈、挖洞
    for (const a of arches) {
      const dc = Math.hypot(x - a.x, y - a.y) - a.R;
      d = smax(d, -smax(dc, a.zIn - az, 0.03), 0.02);
    }
    return d;
  };
}
