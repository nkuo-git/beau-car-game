// 3D 吉普車（J4）的表面細節（投影貼圖），做法跟 monster-look.js 一樣：
// 車身網格存成「遮罩座標」（jp4-body.mjs：xm＝x·0.92、ym＝(y−0.44)·0.92、zm＝z·0.92），這裡的點都用公尺寫，畫的時候整張圖先縮放、平移。
// 自己設計的車（沒有照片、沒有真的車標）：圓的大燈、水箱罩是橫條（不是直條）、黑色硬頂、方形尾燈。
import { BOX, layers, poly, smooth, line, text, canvas } from './masks.js';

export const JP4_M = { S: 0.92, X0: 0, Y0: 0.44 }; // 遮罩座標的縮放、平移（跟 jp4-body.mjs 的 JP4 一樣）
export const JP4_LOOK = (() => {
  const { S, X0, Y0 } = JP4_M;
  const real = (fn, dx, dy) => (g) => { g.save(); g.translate(-dx * S, -dy * S); g.scale(S, S); fn(g); g.restore(); };
  const side = (fn) => real(fn, X0, Y0), face = (fn) => real(fn, 0, Y0), plan = (fn) => real(fn, X0, 0);
  const rr = (g, x0, y0, x1, y1, r) => { g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, r); };
  const circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
  const both = (pts) => [...pts, ...pts.slice().reverse().map(([x, z]) => [x, -z])]; // 上面：半邊 → 整個

  // ---- 側面（x, y）----
  // 前擋框的後緣（A 柱）：x = 0.60 − 0.635·(y − 1.255)；前擋框（車身色）後面整個硬頂是黑的
  const AP = (y) => 0.60 - 0.635 * (y - 1.255);
  const DOOR_W = [[0.545, 1.27], [0.262, 1.728], [0.235, 1.748], [-0.345, 1.748], [-0.36, 1.733], [-0.36, 1.284], [-0.345, 1.27]];
  const QTR_W = [[-0.47, 1.284], [-0.455, 1.27], [-1.80, 1.27], [-1.845, 1.305], [-1.845, 1.70], [-1.80, 1.748], [-0.485, 1.748], [-0.47, 1.733]];
  function sideTex() {
    return layers(BOX.side, [
      side((g) => { poly(g, DOOR_W); g.fill(); poly(g, QTR_W); g.fill(); }), // R：側窗
      side((g) => { // G：黑（硬頂、窗框、門把）
        poly(g, [[-2.3, 1.214], [AP(1.214), 1.214], [AP(1.95), 1.95], [-2.3, 1.95]]); g.fill();
        g.fillStyle = '#000'; poly(g, DOOR_W); g.fill(); poly(g, QTR_W); g.fill(); g.fillStyle = '#fff'; // 窗戶挖掉（黑的地方玻璃不會透明）
        g.lineWidth = 0.022; g.lineJoin = 'round'; poly(g, DOOR_W); g.stroke(); poly(g, QTR_W); g.stroke(); // 窗框膠條
        rr(g, -0.235, 1.105, -0.105, 1.135, 0.012); g.fill(); // 門把
      }),
      side((g) => { // B：縫
        line(g, [[0.655, 1.208], [0.655, 0.565], [-0.42, 0.565], [-0.42, 1.208]], 0.006); // 車門
        line(g, [[0.655, 1.211], [-0.42, 1.211]], 0.005); // 車門上緣（跟硬頂中間）
        line(g, [[0.62, 1.062], [1.90, 1.032]], 0.004); // 葉子板上面那道摺線
        g.lineWidth = 0.005; g.beginPath(); g.arc(-1.52, 1.08, 0.055, 0, Math.PI * 2); g.stroke(); // 油箱蓋
      }),
      null,
    ]);
  }

  // ---- 正面（u＝z，畫的時候左右都畫；y）：圓的大燈、中間三條橫的水箱罩、大燈下面圓的方向燈 ----
  const LZ = 0.505, LY = 0.985, LR = 0.112;
  function front() {
    return layers(BOX.front, [
      face((g) => { for (const s of [1, -1]) { circle(g, s * LZ, LY, LR); g.fill(); } }), // R：大燈（鍍鉻反光碗）
      face((g) => { // G：黑（水箱罩橫條中間的縫、大燈凹槽的內壁、保桿上面一條）
        rr(g, -0.345, 0.752, 0.345, 1.118, 0.028); g.fill();
        g.fillStyle = '#000'; for (const y of [0.818, 0.918, 1.018]) rr(g, -0.33, y, 0.33, y + 0.042, 0.012), g.fill(); g.fillStyle = '#fff'; // 三條橫條（車身色）
        for (const s of [1, -1]) { g.lineWidth = 0.016; circle(g, s * LZ, LY, LR + 0.008); g.stroke(); }
        poly(g, [[-0.70, 0.60], [0.70, 0.60], [0.70, 0.705], [-0.70, 0.705]]); g.fill();
      }),
      face((g) => { for (const s of [1, -1]) { circle(g, s * LZ, 0.80, 0.036); g.fill(); } }), // B：橘色方向燈
      face((g) => { // A：燈裡暗的部分（中間的投射鏡、一圈 LED 的縫）
        for (const s of [1, -1]) {
          g.fillStyle = 'rgb(255,255,255)'; circle(g, s * LZ, LY, 0.046); g.fill();
          g.lineWidth = 0.008; g.strokeStyle = 'rgb(150,150,150)'; circle(g, s * LZ, LY, 0.083); g.stroke();
          g.strokeStyle = '#fff';
        }
      }),
    ]);
  }

  // ---- 後面（u＝z，y）：直的方形尾燈在兩個角（上紅、下白倒車燈），尾門、空白車牌，硬頂後面整片黑（後窗是深色的玻璃）----
  const TL = [0.665, 0.82, 0.835, 1.10];
  function rear() {
    const lamp = (g, s, y0, y1) => rr(g, s > 0 ? TL[0] : -TL[2], y0, s > 0 ? TL[2] : -TL[0], y1, 0.018);
    return layers(BOX.rear, [
      face((g) => { for (const s of [1, -1]) { lamp(g, s, 0.915, TL[3]); g.fill(); } }), // R：紅色尾燈
      face((g) => { // G：黑（硬頂後面、尾燈框）
        poly(g, [[-1.1, 1.213], [1.1, 1.213], [1.1, 1.95], [-1.1, 1.95]]); g.fill();
        g.lineWidth = 0.014; for (const s of [1, -1]) { lamp(g, s, TL[1], TL[3]); g.stroke(); }
        rr(g, -0.09, 1.07, 0.09, 1.10, 0.01); g.fill(); // 尾門把手
      }),
      face((g) => { for (const s of [1, -1]) { lamp(g, s, TL[1], 0.905); g.fill(); } }), // B：倒車燈
      face((g) => { // A：縫（尾門、車牌框）
        g.lineWidth = 0.006; rr(g, -0.70, 0.555, 0.70, 1.205, 0.03); g.stroke();
        g.lineWidth = 0.005; rr(g, -0.17, 0.62, 0.17, 0.79, 0.012); g.stroke();
      }),
    ]);
  }

  // ---- 上面（x, z）：前擋玻璃、硬頂（黑）、雨刷那條黑、引擎蓋的縫 ----
  const WS = [[0.648, 0], [0.648, 0.66], [0.64, 0.70], [0.61, 0.712], [0.39, 0.712], [0.362, 0.70], [0.355, 0.66], [0.355, 0]];
  function top() {
    return layers(BOX.top, [
      null,
      plan((g) => { // G：黑
        poly(g, [[0.243, -1], [0.243, 1], [-2.3, 1], [-2.3, -1]]); g.fill(); // 硬頂
        rr(g, 0.665, -0.72, 0.712, 0.72, 0.01); g.fill(); // 雨刷那條（前擋下緣）
        g.lineWidth = 0.012; smooth(g, both(WS)); g.stroke(); // 前擋膠條
      }),
      plan((g) => { // B：縫
        line(g, [[0.712, 0.668], [1.96, 0.668]], 0.005); line(g, [[0.712, -0.668], [1.96, -0.668]], 0.005);
        line(g, [[0.712, 0.668], [0.712, -0.668]], 0.005);
      }),
      plan((g) => { smooth(g, both(WS)); g.fill(); }), // A：前擋玻璃
    ]);
  }

  // ---- 拉花：stripe＝側面兩條粗條紋（越野車的老樣子）；none＝不要 ----
  function livery(sd, style = 'stripe') {
    const { c, g } = canvas(BOX.side);
    g.clearRect(-3, -1, 6, 3);
    if (style === 'none') return c;
    side((q) => {
      q.fillStyle = '#16171a';
      poly(q, [[-1.95, 1.06], [0.60, 1.06], [0.60, 1.10], [-1.95, 1.10]]); q.fill();
      poly(q, [[-1.95, 1.005], [0.60, 1.005], [0.60, 1.025], [-1.95, 1.025]]); q.fill();
      q.fillStyle = '#f4f5f6'; text(q, '4×4', -1.79, 0.935, 0.12, { mirror: sd < 0, italic: true }); // 在後輪弧和條紋中間（離輪弧 4 公分以上，斜前面看也不會被輪弧擋到）
    })(g);
    return c;
  }
  function frontLivery() { const { c, g } = canvas(BOX.front); g.clearRect(-2, -1, 4, 3); return c; }

  const X = (x) => (x - X0) * S, Y = (y) => (y - Y0) * S;
  return {
    side: sideTex, rear, top,
    fronts: { base: front },
    livery, frontLivery,
    livDefault: 1,
    nose: () => 'base',
    // 前後軸、車頭面、車尾面、玻璃高度（遮罩座標）；輪拱內側：圓心、半徑、|z| 小於多少塗黑
    U: { uXr: X(-1.20), uXf: X(1.22), uFx: [X(1.88), X(1.925)], uRx: [X(-1.985), X(-2.01)], uWell: [Y(0.42), 0.54 * S, 0.84 * S], uWellR: [Y(0.42), 0.53 * S, 0.84 * S], uGlassY: Y(1.25) },
  };
})();
