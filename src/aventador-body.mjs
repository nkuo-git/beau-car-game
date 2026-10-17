// 3D Lamborghini Aventador S（2017）車身 SDF，做法跟 sp3-body.mjs 一樣：
// 中線側面輪廓、俯視輪廓拉成柱體取交集＋修圓，頂面用「高度差」做出前後葉子板，側面往內收（車門下半凹進去導風），
// 車艙（很斜的前擋、窄窄的車頂）另外做再接上；挖六角形的輪拱、車門後面的大進氣口、車尾的黑色大開口；車頭下半整圈往後縮（進氣口畫在貼圖上）。
// 座標（公尺）：x 往車頭（-2.3985 車尾、+2.3985 車頭）、y 往上、z 往車的右側。
// 尺寸：長 4.797、寬 2.030、高 1.136、軸距 2.700（前懸 1.25、後懸 0.85）、輪距前 1.720／後 1.680、
// 輪胎 255/30 R20（前，半徑 0.3305）、355/25 R21（後，半徑 0.3555）。
// 形狀照三張 Wikimedia Commons 的 Aventador S 照片（藍色左前、黑色右前、灰色右後）＋一張 LP700-4 正側面，相機從輪子、車牌反推（aventador3d/）。
import { curve, sdf2d, look, smin, smax } from './body.mjs';

export const AVENTADOR = { L: 4.797, W: 2.03, H: 1.136, xf: 1.15, xr: -1.55, RF: 0.3305, RR: 0.3555 };
export const BOUNDS = [-2.46, 0.04, 2.46, 1.20, 1.08];
const mirrorZ = (r) => [...r, ...r.slice(1, -1).reverse().map(([x, z, s]) => [x, -z, s])];

// 下半身中線側面：車頭尖 → 引擎蓋（一路斜上去）→ 車艙底下 → 引擎蓋板（往後斜下）→ 車尾上緣 → 車尾 → 擴散器 → 底盤 → 下巴
export const SIDE = [
  [2.43, 0.49, 0], [2.10, 0.598, 1], [1.70, 0.700, 1], [1.30, 0.785, 1], [0.95, 0.85, 1], [0.60, 0.88, 1],
  [0.00, 0.95, 1], [-0.80, 1.01, 1], [-1.15, 1.02, 1], [-1.55, 0.995, 1], [-1.95, 0.96, 1], [-2.22, 0.93, 1], [-2.35, 0.91, 1],
  [-2.40, 0.86, 1], [-2.405, 0.66, 1], [-2.38, 0.44, 1], [-2.31, 0.31, 1], [-2.20, 0.25, 0], [-1.90, 0.135, 0],
  [1.80, 0.12, 0], [2.30, 0.125, 0], [2.42, 0.15, 0], [2.40, 0.26, 1], [2.415, 0.40, 1],
];
// 俯視輪廓（最寬的地方，高度方向另外收）：車頭是一個扁扁的箭頭，前葉子板、車門、後葉子板最寬，車尾往內收
export const PLAN = mirrorZ([
  [2.42, 0, 1], [2.40, 0.19, 1], [2.352, 0.425, 1], [2.28, 0.615, 1], [2.175, 0.755, 1], [2.035, 0.86, 1], [1.85, 0.93, 1], [1.60, 0.97, 1],
  [1.30, 0.985, 1], [1.10, 0.99, 1], [0.80, 0.975, 1], [0.30, 0.958, 1], [-0.30, 0.968, 1], [-0.80, 0.995, 1], [-1.20, 1.012, 1], [-1.55, 1.015, 1],
  [-1.90, 0.985, 1], [-2.15, 0.90, 1], [-2.30, 0.80, 1], [-2.38, 0.66, 1], [-2.40, 0.40, 1], [-2.405, 0, 1],
]);
// 車艙側面（中線）：前擋（很斜，接著引擎蓋那條線）→ 車頂 → 往後慢慢斜下到引擎蓋板，下面伸進車身
export const CABIN_SIDE = [
  [1.00, 0.70, 0], [0.92, 0.85, 1], [0.70, 0.96, 1], [0.42, 1.09, 1], [0.15, 1.128, 1], [-0.25, 1.136, 1], [-0.60, 1.12, 1],
  [-0.95, 1.065, 1], [-1.25, 1.01, 1], [-1.45, 0.96, 0], [-1.45, 0.70, 0],
];
// 車艙俯視（腰線高度），越高越往內收
export const CABIN_PLAN = mirrorZ([
  [0.95, 0, 1], [0.93, 0.56, 1], [0.80, 0.76, 1], [0.45, 0.80, 1], [-0.30, 0.80, 1], [-0.80, 0.775, 1], [-1.15, 0.70, 1],
  [-1.40, 0.55, 1], [-1.50, 0, 1],
]);
export const CABIN_Y0 = 0.86, TUMBLE = 0.95;

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const win = (x, a, b, c, d) => sstep(a, b, x) * (1 - sstep(c, d, x)); // a→b 升、c→d 降
const bump = (t) => (Math.abs(t) >= 1 ? 0 : (1 - t * t) ** 2);
function tab(t, x) {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const a = t[i - 1], b = t[i], u = (x - a[0]) / (b[0] - a[0]), q = u * u * (3 - 2 * u); return a[1] + (b[1] - a[1]) * q; }
  return t[t.length - 1][1];
}
// 2D 多邊形（凸的，逆時針）的距離：每條邊往外的距離取最大（近似，夠挖洞用）
function convex(x, y, P) {
  let d = -1e9;
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length], ex = bx - ax, ey = by - ay, l = Math.hypot(ex, ey);
    d = Math.max(d, ((x - ax) * ey - (y - ay) * ex) / l);
  }
  return d;
}
// 兩側往下圓掉多少（x → 公尺，乘上 (|z|/1)^2）
const CROWN = [[-2.45, 0.06], [-2.0, 0.045], [-1.5, 0.04], [-1.0, 0.05], [0.0, 0.07], [0.9, 0.07], [1.6, 0.05], [2.1, 0.04], [2.45, 0.035]];
// 頂面加高多少：前葉子板（大燈後面）、後葉子板兩道隆起，引擎蓋中間一點點凸
export function lift(x, az) {
  const zz = az / 1.0;
  const fw = sstep(0.55, 1.0, x); // 前面（引擎蓋）用平的斜面，後面用圓的
  const crown = -(1 - fw) * tab(CROWN, x) * zz * zz - fw * 0.022 * az;
  // 前葉子板：一道利的稜線（三角形斷面），引擎蓋兩邊是平的斜面一路往上到稜線
  const ff = 0.075 * win(x, 0.75, 1.25, 2.20, 2.44) * Math.max(0, 1 - Math.abs(az - 0.76) / 0.24);
  const rr = 0.06 * win(x, -2.40, -2.05, -1.25, -0.85) * bump((az - 0.80) / 0.25); // 後葉子板
  const hw = 0.40 - 0.08 * (x - 1.0); // 引擎蓋中間凸起來的一塊（梯形，往前變窄，邊是利的）
  const hood = 0.025 * win(x, 0.95, 1.08, 2.22, 2.40) * (1 - sstep(hw - 0.025, hw + 0.01, az));
  const box = 0.07 * win(x, -1.55, -1.30, -0.75, -0.50) * bump((az - 0.72) / 0.22); // 車窗後面的進氣口（肩膀上的箱子）
  return crown + ff + rr + hood + box;
}
// 側面往內收：下面收（側裙以下）、上面收（肩線以上）、車門下半那片凹進去（斜的折線以下）
const crease = (x) => 0.30 + (x + 0.62) * 0.29; // 車門上的斜折線（前輪拱上面 → 往後下到進氣口前緣）
export function tuck(x, y) {
  const low = 0.06 * (1 - sstep(0.13, 0.30, y));
  const sk = 1.0 - 0.6 * win(x, 0.3, 0.7, 1.9, 2.3); // 前葉子板的肩膀又高又寬
  const shoulder = sk * Math.max(0, y - 0.60) ** 2 + 0.6 * Math.max(0, y - 0.80) ** 2;
  const door = 0.055 * win(x, -0.70, -0.55, 0.75, 1.0) * (1 - sstep(crease(x) - 0.03, crease(x) + 0.01, y)) * sstep(0.16, 0.26, y);
  const tail = 0.20 * sstep(-1.95, -2.4, x) * (1 - sstep(0.34, 0.62, y));
  const nose = 0.012 * sstep(1.85, 2.3, x) * (1 - sstep(0.18, 0.42, y));
  return low + shoulder + door + tail + nose;
}

// 輪拱開口：圓角八角形（Aventador 的輪拱是有角的）
const ARCH8 = (R) => { const P = []; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 + Math.PI / 8; P.push([Math.cos(a) * R, Math.sin(a) * R]); } return P; };
// 車門後面的大進氣口（側面看是往前斜的梯形；x, y）
const INTAKE = [[-0.80, 0.84], [-0.92, 0.84], [-1.06, 0.62], [-1.04, 0.29], [-0.40, 0.29]];

export function makeSDF(opt = {}) {
  const res = 0.005;
  const side = sdf2d(curve(SIDE), -2.5, -0.05, 2.5, 1.3, res);
  const plan = sdf2d(curve(PLAN), -2.5, -1.2, 2.5, 1.2, res);
  const cabS = sdf2d(curve(CABIN_SIDE), -1.6, 0.55, 1.1, 1.3, res);
  const cabP = sdf2d(curve(CABIN_PLAN), -1.6, -1.0, 1.1, 1.0, res);
  const R1 = 0.06, RC = 0.08, RU = 0.05;
  const a8F = ARCH8(0.425), a8R = ARCH8(0.445);
  const arches = [{ x: AVENTADOR.xf, y: AVENTADOR.RF, P: a8F, zIn: 0.62 }, { x: AVENTADOR.xr, y: AVENTADOR.RR, P: a8R, zIn: 0.60 }];
  return function f(x, y, z) {
    const az = Math.abs(z);
    const dS = look(side, x, y - lift(x, az));
    // 車頭下半（進氣口那一圈）整片往後縮 6 公分，上面的利邊蓋在上面（平滑的，不會鋸齒）
    const inset = 0.06 * sstep(1.75, 2.05, x) * win(y, 0.14, 0.19, 0.42, 0.47) * (1 - sstep(0.88, 0.98, az));
    const dP = look(plan, x + inset, az + tuck(x, y));
    let d = smax(dS, dP, R1 - 0.03 * sstep(1.4, 2.0, x)); // 車頭的邊比較利
    // 車艙
    const zc = az / 0.8;
    const cS = look(cabS, x, y + 0.05 * zc * zc);
    const cP = look(cabP, x, az + Math.max(0, y - CABIN_Y0) * TUMBLE);
    d = smin(d, smax(cS, cP, RC), RU);
    // 大燈那一塊：斜斜的一個平面（燈面朝前上方、往外），把葉子板前角削掉一點
    if (x > 1.55 && az > 0.36 && y > 0.45) {
      const w = win(x, 1.55, 1.75, 2.30, 2.40) * win(az, 0.36, 0.46, 0.92, 1.0) * sstep(0.45, 0.55, y);
      const pl = (x - 1.90) * 0.50 + (y - 0.70) * 0.62 + (az - 0.70) * 0.60;
      d = smax(d, pl - 0.3 * (1 - w), 0.03);
    }
    // 車門後面的大進氣口：往內挖 13 公分（底部是平的）
    if (x < -0.35 && x > -1.2 && y < 0.95) {
      const p = convex(x, y, INTAKE) - 0.015;
      const cut = Math.max(p, 0.84 - az);
      d = smax(d, -cut, 0.025);
    }
    // 車尾下面：黑色大開口往內凹 8 公分（Y 字尾燈下面一整片）
    if (x < -2.0) {
      const t = Math.max(az - 0.86, Math.abs(y - 0.53) - 0.20);
      d = smax(d, -Math.max(t, -(d + 0.08)), 0.02);
    }
    // 車尾下面：擴散器的通道往上斜
    if (x < -1.85) {
      const roof = 0.135 + 0.16 * Math.min(1, (-1.85 - x) / 0.5);
      d = smax(d, -Math.max(y - roof, az - 0.70), 0.03);
    }
    // 輪拱：挖八角形的洞（外面留一點邊）
    for (const a of arches) {
      if (Math.abs(x - a.x) < 0.7) {
        const dc = convex(x - a.x, y - a.y, a.P) - 0.02;
        d = smax(d, -smax(dc, a.zIn - az, 0.03), 0.03);
      }
    }
    return d;
  };
}
