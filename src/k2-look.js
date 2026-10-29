// 小越野車（K2）的表面細節（投影貼圖），做法跟 jp4-look.js 一樣：
// 車身網格存成「遮罩座標」（k2-body.mjs：xm＝x·0.92、ym＝(y−0.40)·0.92、zm＝z·0.92），這裡的點都用公尺寫，畫的時候整張圖先縮放、平移。
// 自己設計的車（沒有照片、沒有真的車標）：圓角長方形的大燈、兩條橫的水箱罩開口（中間一條車身色）、黑色 B 柱、下面一圈黑色護板、直的尾燈在兩個角。
import { BOX, layers, poly, smooth, line, text, canvas } from './masks.js';

export const K2_M = { S: 0.92, X0: 0, Y0: 0.40 }; // 遮罩座標的縮放、平移（跟 k2-body.mjs 的 K2 一樣）
export const K2_LOOK = (() => {
  const { S, X0, Y0 } = K2_M;
  const real = (fn, dx, dy) => (g) => { g.save(); g.translate(-dx * S, -dy * S); g.scale(S, S); fn(g); g.restore(); };
  const side = (fn) => real(fn, X0, Y0), face = (fn) => real(fn, 0, Y0), plan = (fn) => real(fn, X0, 0);
  const rr = (g, x0, y0, x1, y1, r) => { g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, r); };
  const circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
  const both = (pts) => [...pts, ...pts.slice().reverse().map(([x, z]) => [x, -z])]; // 上面：半邊 → 整個

  // ---- 側面（x, y）----
  // 前擋框的後緣（A 柱）：前擋下緣 (0.63, 1.095) → 上緣 (0.18, 1.685)
  const AP = (y) => 0.63 - 0.763 * (y - 1.095);
  const DOOR_W = [[0.525, 1.135], [0.103, 1.688], [0.08, 1.705], [-0.355, 1.705], [-0.375, 1.688], [-0.375, 1.155], [-0.355, 1.135]];
  const QTR_W = [[-0.49, 1.155], [-0.47, 1.135], [-1.46, 1.135], [-1.53, 1.17], [-1.56, 1.25], [-1.56, 1.62], [-1.50, 1.705], [-0.47, 1.705], [-0.49, 1.688]];
  function sideTex() {
    return layers(BOX.side, [
      side((g) => { poly(g, DOOR_W); g.fill(); poly(g, QTR_W); g.fill(); }), // R：側窗
      side((g) => { // G：黑（B 柱、窗框膠條、門把、下面一圈護板）
        poly(g, [[-0.375, 1.12], [-0.49, 1.12], [-0.49, 1.72], [-0.375, 1.72]]); g.fill(); // B 柱
        g.fillStyle = '#000'; poly(g, DOOR_W); g.fill(); poly(g, QTR_W); g.fill(); g.fillStyle = '#fff'; // 窗戶挖掉（黑的地方玻璃不會透明）
        g.lineWidth = 0.02; g.lineJoin = 'round'; poly(g, DOOR_W); g.stroke(); poly(g, QTR_W); g.stroke(); // 窗框膠條
        rr(g, -0.27, 1.035, -0.14, 1.062, 0.012); g.fill(); // 門把
        poly(g, [[-1.80, 0.40], [1.85, 0.40], [1.85, 0.565], [-1.80, 0.565]]); g.fill(); // 下面一圈黑色護板（輪拱那裡本來就挖掉了）
      }),
      side((g) => { // B：縫
        line(g, [[0.625, 0.565], [0.625, 1.10], [AP(1.12) - 0.035, 1.12], [AP(1.70) - 0.035, 1.70], [0.06, 1.728], [-0.42, 1.728], [-0.42, 0.565]], 0.006); // 車門（窗框跟著門）
        line(g, [[0.70, 1.075], [1.68, 1.03]], 0.004); // 蛤殼引擎蓋的邊（側面看）
        g.lineWidth = 0.005; g.beginPath(); g.arc(-1.30, 0.98, 0.05, 0, Math.PI * 2); g.stroke(); // 油箱蓋
      }),
      null,
    ]);
  }

  // ---- 正面（u＝z，左右都畫；y）：圓角長方形的大燈、中間兩條橫的開口（裡面黑網）、大燈下面的橘色方向燈 ----
  const LZ = 0.545, LY = 0.915;
  function front() {
    const lamp = (g, s, e = 0) => rr(g, s * LZ - 0.098 - e, LY - 0.055 - e, s * LZ + 0.098 + e, LY + 0.055 + e, 0.038 + e);
    return layers(BOX.front, [
      face((g) => { for (const s of [1, -1]) { lamp(g, s); g.fill(); } }), // R：大燈（鍍鉻反光碗）
      face((g) => { // G：黑（兩條開口、大燈的框、保桿後面）
        for (const y of [0.85, 0.918]) { rr(g, -0.32, y, 0.32, y + 0.042, 0.016); g.fill(); }
        g.lineWidth = 0.014; for (const s of [1, -1]) { lamp(g, s, 0.006); g.stroke(); }
        poly(g, [[-0.80, 0.40], [0.80, 0.40], [0.80, 0.70], [-0.80, 0.70]]); g.fill();
      }),
      face((g) => { for (const s of [1, -1]) { rr(g, s * 0.585 - 0.055, 0.818, s * 0.585 + 0.055, 0.84, 0.01); g.fill(); } }), // B：橘色方向燈
      face((g) => { // A：燈裡暗的部分（圓的投射鏡、裡面那頭一條 LED）；開口裡的網子（一格一格的點）
        for (const s of [1, -1]) {
          g.fillStyle = 'rgb(255,255,255)'; circle(g, s * (LZ + 0.035), LY, 0.034); g.fill();
          g.lineWidth = 0.007; g.strokeStyle = 'rgb(150,150,150)'; circle(g, s * (LZ + 0.035), LY, 0.05); g.stroke();
          rr(g, s * (LZ - 0.075) - 0.012, LY - 0.035, s * (LZ - 0.075) + 0.012, LY + 0.035, 0.01); g.fill();
          g.strokeStyle = '#fff';
        }
        g.fillStyle = '#fff';
        for (const y0 of [0.85, 0.918]) for (let k = 0; k < 3; k++) for (let i = -15; i <= 15; i++) { const z = i * 0.02 + (k % 2) * 0.01, y = y0 + 0.009 + k * 0.012; if (Math.abs(z) < 0.305) { circle(g, z, y, 0.0045); g.fill(); } }
      }),
    ]);
  }

  // ---- 後面（u＝z，y）：直的圓角尾燈在兩個角（上紅、下白倒車燈），側開的尾門、後窗（黑，上面再蓋一片玻璃）----
  const TL = [0.632, 0.83, 0.768, 1.10];
  function rear() {
    const lamp = (g, s, y0, y1) => rr(g, s > 0 ? TL[0] : -TL[2], y0, s > 0 ? TL[2] : -TL[0], y1, 0.03);
    return layers(BOX.rear, [
      face((g) => { for (const s of [1, -1]) { lamp(g, s, 0.905, TL[3]); g.fill(); } }), // R：紅色尾燈
      face((g) => { // G：黑（後窗、尾燈框、尾門把手）
        rr(g, -0.60, 1.28, 0.60, 1.60, 0.05); g.fill();
        g.lineWidth = 0.014; for (const s of [1, -1]) { lamp(g, s, TL[1], TL[3]); g.stroke(); }
        rr(g, -0.50, 1.20, -0.36, 1.23, 0.01); g.fill(); // 尾門把手（側開的門，把手在左邊）
        poly(g, [[-0.85, 0.40], [0.85, 0.40], [0.85, 0.565], [-0.85, 0.565]]); g.fill(); // 下面一圈黑色護板
      }),
      face((g) => { for (const s of [1, -1]) { lamp(g, s, TL[1], 0.895); g.fill(); } }), // B：倒車燈
      face((g) => { g.lineWidth = 0.006; rr(g, -0.60, 0.575, 0.60, 1.725, 0.05); g.stroke(); }), // A：縫（尾門）
    ]);
  }

  // ---- 上面（x, z）：前擋玻璃、雨刷那條黑、蛤殼引擎蓋的縫 ----
  const WS = [[0.625, 0], [0.625, 0.62], [0.615, 0.655], [0.585, 0.668], [0.215, 0.668], [0.19, 0.655], [0.185, 0.62], [0.185, 0]];
  function top() {
    return layers(BOX.top, [
      null,
      plan((g) => { // G：黑
        rr(g, 0.64, -0.70, 0.69, 0.70, 0.01); g.fill(); // 雨刷那條（前擋下緣）
        g.lineWidth = 0.012; smooth(g, both(WS)); g.stroke(); // 前擋膠條
      }),
      plan((g) => { // B：縫
        line(g, [[0.70, 0.70], [1.69, 0.70]], 0.005); line(g, [[0.70, -0.70], [1.69, -0.70]], 0.005);
        line(g, [[0.70, 0.70], [0.70, -0.70]], 0.005);
      }),
      plan((g) => { smooth(g, both(WS)); g.fill(); }), // A：前擋玻璃
    ]);
  }

  // ---- 拉花：stripe＝側面下面兩條細條紋＋門上 K2 4WD；mountain＝門上一排山（深灰、山頂白雪）＋後面 K2；none＝不要 ----
  // （輪拱上面只到 y 0.905、下面 0.565 以下是黑色護板，所以字和圖都放在門上、後輪拱上面那一塊）
  function livery(sd, style = 'stripe') {
    const { c, g } = canvas(BOX.side);
    g.clearRect(-3, -1, 6, 3);
    if (style === 'none') return c;
    side((q) => {
      if (style === 'mountain') {
        q.fillStyle = 'rgba(38,41,46,0.92)';
        poly(q, [[-0.40, 0.585], [-0.40, 0.66], [-0.30, 0.70], [-0.18, 0.66], [-0.02, 0.84], [0.10, 0.74], [0.20, 0.78], [0.36, 0.64], [0.48, 0.68], [0.60, 0.62], [0.60, 0.585]]); q.fill();
        q.fillStyle = '#f6f7f8'; // 山頂的雪
        poly(q, [[-0.02, 0.84], [0.04, 0.79], [0.012, 0.80], [-0.018, 0.785], [-0.064, 0.79]]); q.fill();
        poly(q, [[0.20, 0.78], [0.224, 0.76], [0.20, 0.765], [0.18, 0.755], [0.167, 0.76]]); q.fill();
        q.fillStyle = 'rgba(38,41,46,0.92)'; text(q, 'K2', -0.86, 1.0, 0.10, { mirror: sd < 0, italic: true });
      } else {
        q.fillStyle = '#16171a';
        poly(q, [[-1.62, 0.60], [1.50, 0.60], [1.50, 0.625], [-1.62, 0.625]]); q.fill();
        poly(q, [[-1.62, 0.645], [1.50, 0.645], [1.50, 0.655], [-1.62, 0.655]]); q.fill();
        text(q, 'K2 4WD', 0.06, 0.715, 0.085, { mirror: sd < 0, italic: true });
      }
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
    U: { uXr: X(-1.14), uXf: X(1.10), uFx: [X(1.64), X(1.68)], uRx: [X(-1.655), X(-1.68)], uWell: [Y(0.37), 0.475 * S, 0.78 * S], uWellR: [Y(0.37), 0.475 * S, 0.78 * S], uGlassY: Y(1.12) },
  };
})();
