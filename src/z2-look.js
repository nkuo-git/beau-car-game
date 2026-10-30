// 沙灘車（Z2）的表面細節（投影貼圖）：車身網格就是公尺座標（z2-body.mjs，車子小，不用縮放）。
// 自己設計的四輪沙灘車（沒有照片、沒有真的車標）：車頭兩個斜斜的長條大燈、中間一塊黑網的水箱罩、車尾中間一條紅色尾燈、側蓋下半部黑色。
import { BOX, layers, poly, line, text, canvas } from './masks.js';

export const Z2_LOOK = (() => {
  const rr = (g, x0, y0, x1, y1, r) => { g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, r); };
  const circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
  const id = (fn) => (g) => fn(g); // 遮罩座標＝公尺：直接畫

  // ---- 側面（x, y）：側蓋下半部黑色（看起來是引擎那一塊）、葉子板跟油箱蓋中間的縫 ----
  function sideTex() {
    return layers(BOX.side, [
      null, // R：側窗（沒有）
      id((g) => { // G：黑
        poly(g, [[-0.43, 0.40], [0.48, 0.40], [0.48, 0.665], [0.30, 0.685], [-0.43, 0.685]]); g.fill(); // 側蓋下半部、腳踏板前後的擋板
      }),
      id((g) => { // B：縫
        line(g, [[0.47, 0.665], [0.47, 0.80], [0.44, 0.87]], 0.005); // 前葉子板／油箱蓋
        line(g, [[-0.42, 0.685], [-0.42, 0.80]], 0.005); // 後葉子板／側蓋
        line(g, [[-0.43, 0.685], [0.48, 0.665]], 0.004); // 側蓋上下兩塊
      }),
      null,
    ]);
  }

  // ---- 正面（u＝z，左右都畫；y）：斜的長條大燈（外面高）、中間水箱罩（黑網）、下面一圈黑 ----
  const LY = (z) => 0.635 + 0.22 * (Math.abs(z) - 0.455); // 大燈的中線（外面高；跟 z2-body.mjs 的凹槽一樣斜）
  const lampPts = (s, e = 0) => { const z0 = 0.372, z1 = 0.538, h = 0.023;
    return [[s * (z0 - e), LY(z0) - h - e], [s * (z1 + e), LY(z1) - h - e], [s * (z1 + e), LY(z1) + h + e], [s * (z0 - e), LY(z0) + h + e]]; };
  function front() {
    return layers(BOX.front, [
      id((g) => { for (const s of [1, -1]) { poly(g, lampPts(s)); g.fill(); } }), // R：大燈（反光碗）
      id((g) => { // G：黑（水箱罩、大燈的框、下面一圈）
        rr(g, -0.19, 0.548, 0.19, 0.662, 0.025); g.fill();
        g.lineWidth = 0.008; g.lineJoin = 'round'; for (const s of [1, -1]) { poly(g, lampPts(s, 0.004)); g.stroke(); }
        poly(g, [[-0.7, 0.30], [0.7, 0.30], [0.7, 0.505], [-0.7, 0.505]]); g.fill();
      }),
      null, // B：方向燈（沒有）
      id((g) => { // A：燈裡暗的部分（兩顆投射鏡）；水箱罩裡的網子
        for (const s of [1, -1]) {
          g.fillStyle = '#fff'; for (const z of [0.42, 0.49]) { circle(g, s * z, LY(z), 0.014); g.fill(); }
          g.strokeStyle = 'rgb(150,150,150)'; g.lineWidth = 0.004; for (const z of [0.42, 0.49]) { circle(g, s * z, LY(z), 0.019); g.stroke(); }
        }
        g.fillStyle = '#fff';
        for (let k = 0; k < 9; k++) for (let i = -16; i <= 16; i++) { const z = i * 0.012 + (k % 2) * 0.006, y = 0.557 + k * 0.012; if (Math.abs(z) < 0.175) { circle(g, z, y, 0.0035); g.fill(); } }
      }),
    ]);
  }

  // ---- 後面（u＝z，y）：中間一條紅色尾燈、兩邊葉子板上的小反光片、下面一圈黑 ----
  function rear() {
    return layers(BOX.rear, [
      id((g) => { rr(g, -0.135, 0.696, 0.135, 0.728, 0.01); g.fill(); for (const s of [1, -1]) { rr(g, s > 0 ? 0.40 : -0.50, 0.64, s > 0 ? 0.50 : -0.40, 0.655, 0.006); g.fill(); } }), // R：紅（尾燈、葉子板後面的反光片）
      id((g) => { // G：黑（尾燈框、下面一圈、車牌那塊）
        g.lineWidth = 0.008; rr(g, -0.139, 0.692, 0.139, 0.732, 0.012); g.stroke();
        poly(g, [[-0.7, 0.30], [0.7, 0.30], [0.7, 0.575], [-0.7, 0.575]]); g.fill();
      }),
      null, // B：倒車燈（沒有）
      null,
    ]);
  }

  // ---- 上面（x, z）：油箱蓋（黑色的油箱蓋子）、置物台的縫 ----
  function top() {
    return layers(BOX.top, [
      null,
      id((g) => { circle(g, 0.30, 0, 0.032); g.fill(); }), // G：黑（油箱蓋子）
      id((g) => { g.lineWidth = 0.004; circle(g, 0.30, 0, 0.04); g.stroke(); line(g, [[0.47, 0.24], [0.47, -0.24]], 0.004); line(g, [[-0.42, 0.24], [-0.42, -0.24]], 0.004); }), // B：縫
      null, // A：玻璃（沒有）
    ]);
  }

  // ---- 拉花：race＝後葉子板上白底號碼牌「88」＋前葉子板 Z2＋油箱蓋側面一條斜線；stripe＝兩個葉子板一條細線＋前葉子板 Z2；none＝不要 ----
  // （葉子板在輪子上面只有 0.72～0.84 公尺；側蓋會被騎的人的腳擋住，所以字和號碼都放在葉子板輪子正上方）
  function livery(sd, style = 'race') {
    const { c, g } = canvas(BOX.side);
    g.clearRect(-3, -1, 6, 3);
    if (style === 'none') return c;
    const ink = '#16171a';
    if (style === 'race') {
      g.fillStyle = '#f4f5f6'; rr(g, -0.80, 0.748, -0.49, 0.832, 0.022); g.fill(); // 號碼牌（後葉子板，輪子正上方；側蓋會被腳擋住）
      g.strokeStyle = ink; g.lineWidth = 0.006; rr(g, -0.792, 0.755, -0.498, 0.825, 0.017); g.stroke();
      g.fillStyle = ink; text(g, '88', -0.645, 0.79, 0.068, { mirror: sd < 0, italic: true });
      text(g, 'Z2', 0.62, 0.79, 0.078, { mirror: sd < 0 });
      poly(g, [[0.20, 0.70], [0.46, 0.80], [0.46, 0.815], [0.20, 0.715]]); g.fill(); // 油箱蓋側面一條斜線
    } else {
      g.fillStyle = ink;
      for (const x0 of [0.62, -0.64]) { g.beginPath(); g.ellipse(x0, 0.32, 0.36, 0.475, 0, 0.35, Math.PI - 0.35); g.ellipse(x0, 0.32, 0.345, 0.46, 0, Math.PI - 0.35, 0.35, true); g.closePath(); g.fill(); } // 順著葉子板的一條細線
      text(g, 'Z2', 0.62, 0.79, 0.078, { mirror: sd < 0 });
    }
    return c;
  }
  function frontLivery() { const { c, g } = canvas(BOX.front); g.clearRect(-2, -1, 4, 3); return c; }

  return {
    side: sideTex, rear, top,
    fronts: { base: front },
    livery, frontLivery,
    livDefault: 1,
    nose: () => 'base',
    // 前後軸、車頭面、車尾面、玻璃高度（沒有玻璃＝放很高）；輪拱內側：圓心、半徑、|z| 小於多少塗黑
    U: { uXr: -0.64, uXf: 0.62, uFx: [0.86, 0.90], uRx: [-0.93, -0.97], uWell: [0.32, 0.415, 0.70], uWellR: [0.32, 0.425, 0.70], uGlassY: 3 },
  };
})();
