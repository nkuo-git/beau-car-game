// 3D Porsche 918 Spyder 的表面細節（投影貼圖），做法跟 gtr-look.js 一樣。
// 位置照 Nick 那兩張 918 照片量的（兩張照片的相機反推後，把照片上的點交會或打到車身上）。
// 拉花：stripes＝照片 1 的紅、深藍、淺藍條紋＋6 號；salzburg＝照片 2 的紅白＋白色圓牌 25 號（不畫品牌字樣和標誌）。
import { BOX, layers, poly, smooth, line, text, both, frit, canvas } from './masks.js';

export const P918_LOOK = (() => {
  const M = (pts) => pts.map(([u, y]) => [-u, y]); // 左右鏡射
  const rrect = (g, x0, y0, x1, y1, r) => { g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, r); };
  const circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };

  // ---- 側面（x, y）----
  // 側窗：A 柱後面、車頂下緣、防滾架前面、腰線上面
  const DLO = [[0.575, 0.868], [0.50, 0.925], [0.40, 1.00], [0.30, 1.07], [0.225, 1.112], [0.12, 1.128], [0.0, 1.132], [-0.10, 1.128],
    [-0.15, 1.115], [-0.17, 1.06], [-0.19, 0.95], [-0.20, 0.872], [0.10, 0.862], [0.40, 0.862]];
  const APILLAR = [[0.62, 0.845], [0.52, 0.915], [0.41, 1.00], [0.30, 1.08], [0.20, 1.135]];
  const INTAKE = [[-0.655, 0.80], [-0.66, 0.60], [-0.70, 0.535], [-0.80, 0.51], [-0.905, 0.52], [-0.915, 0.62], [-0.90, 0.78], [-0.84, 0.81]];
  const VENT = [[0.76, 0.805], [0.86, 0.835], [0.97, 0.845], [0.99, 0.82], [0.88, 0.80], [0.78, 0.785]]; // 前葉子板後面的出風口
  function side() {
    return layers(BOX.side, [
      (g) => { smooth(g, DLO); g.fill(); },
      (g) => { // 黑色
        g.lineJoin = 'round'; g.lineWidth = 0.018; smooth(g, DLO); g.stroke();
        line(g, [[0.60, 0.852], [0.10, 0.858], [-0.21, 0.866]], 0.02); // 腰線的黑邊
        smooth(g, INTAKE); g.fill();
        smooth(g, VENT); g.fill();
        poly(g, [[0.86, 0.20], [-0.98, 0.21], [-0.98, 0.10], [0.86, 0.10]]); g.fill(); // 碳纖維側裙
        rrect(g, -0.38, 0.775, -0.26, 0.79, 0.006); g.fill(); // 門把
      },
      (g) => { // 縫
        line(g, [[0.64, 0.842], [0.74, 0.74], [0.785, 0.60], [0.80, 0.42], [0.79, 0.23]], 0.005); // 車門前緣
        line(g, [[0.79, 0.23], [-0.50, 0.24]], 0.004); // 車門下緣
        line(g, [[-0.50, 0.24], [-0.56, 0.36], [-0.62, 0.50], [-0.64, 0.66], [-0.62, 0.84]], 0.005); // 車門後緣（進氣口前面）
        line(g, [[1.92, 0.40], [2.02, 0.50], [2.12, 0.58]], 0.004); // 前保桿接縫
        line(g, [[-1.93, 0.40], [-2.03, 0.52], [-2.15, 0.64]], 0.004); // 後保桿接縫
      },
      null,
    ]);
  }

  // ---- 正面（u＝|z|，畫的時候左右鏡射；y）----
  // 大燈：立在前葉子板鼓包上的水滴形，裡面四顆 LED 排成十字
  const HEAD = [[0.44, 0.612], [0.52, 0.655], [0.64, 0.70], [0.76, 0.726], [0.855, 0.716], [0.895, 0.672], [0.875, 0.625], [0.76, 0.598],
    [0.60, 0.588], [0.49, 0.592]];
  const LEDS = [[0.70, 0.665], [0.775, 0.69], [0.775, 0.638], [0.85, 0.665]];
  const SIDE_IN = [[0.36, 0.40], [0.72, 0.40], [0.755, 0.36], [0.74, 0.25], [0.70, 0.21], [0.40, 0.21], [0.36, 0.25]]; // 兩側大進氣口
  const CENTER_IN = [[-0.28, 0.24], [0.28, 0.24], [0.30, 0.20], [0.28, 0.135], [-0.28, 0.135], [-0.30, 0.20]];   // 中間下面
  function front() {
    return layers(BOX.front, [
      (g) => { for (const P of [HEAD, M(HEAD)]) { smooth(g, P); g.fill(); } }, // R：燈
      (g) => { // G：黑色
        for (const P of [SIDE_IN, M(SIDE_IN)]) { smooth(g, P); g.fill(); }
        smooth(g, CENTER_IN); g.fill();
        poly(g, [[-0.95, 0.125], [0.95, 0.125], [0.95, 0.0], [-0.95, 0.0]]); g.fill(); // 下巴
        g.lineWidth = 0.008; for (const P of [HEAD, M(HEAD)]) { smooth(g, P); g.stroke(); }
      },
      null,
      (g) => { // A：燈裡的 LED（暗色鏡片）、進氣口的橫條
        for (const s of [1, -1]) {
          g.save(); smooth(g, HEAD.map(([u, y]) => [u * s, y])); g.clip();
          g.fillStyle = 'rgb(215,215,215)'; g.fillRect(-1, 0.5, 2, 0.3);
          g.fillStyle = '#000'; for (const [u, y] of LEDS) { circle(g, u * s, y, 0.021); g.fill(); }
          g.strokeStyle = '#000'; g.lineWidth = 0.006; line(g, [[0.50 * s, 0.622], [0.66 * s, 0.655]], 0.006);
          g.restore(); g.fillStyle = g.strokeStyle = '#fff';
        }
        for (const P of [SIDE_IN, M(SIDE_IN)]) {
          g.save(); smooth(g, P); g.clip();
          for (let y = 0.225; y < 0.40; y += 0.03) line(g, [[-0.8, y], [0.8, y]], 0.008);
          g.restore();
        }
        g.save(); smooth(g, CENTER_IN); g.clip();
        for (let k = -1.2; k < 1.2; k += 0.02) { line(g, [[k, 0.10], [k + 0.2, 0.30]], 0.004); line(g, [[k, 0.30], [k + 0.2, 0.10]], 0.004); }
        g.restore();
      },
    ]);
  }

  // ---- 後面（u＝z，y）：細長的尾燈、中間的黑格柵、車牌、擴散器 ----
  const TAIL = [[0.37, 0.838], [0.60, 0.842], [0.80, 0.838], [0.905, 0.815], [0.91, 0.775], [0.86, 0.758], [0.62, 0.768], [0.38, 0.782], [0.355, 0.81]];
  function rear() {
    return layers(BOX.rear, [
      (g) => { for (const P of [TAIL, M(TAIL)]) { smooth(g, P); g.fill(); } },
      (g) => {
        g.lineWidth = 0.008; for (const P of [TAIL, M(TAIL)]) { smooth(g, P); g.stroke(); }
        for (const s of [1, -1]) line(g, [[0.42 * s, 0.808], [0.84 * s, 0.797]], 0.012); // 尾燈中間的暗線
        rrect(g, -0.33, 0.835, 0.33, 0.895, 0.02); g.fill(); // 尾翼下面的格柵
        rrect(g, -0.27, 0.485, 0.27, 0.598, 0.01); g.fill(); // 車牌
        poly(g, [[-0.66, 0.12], [0.66, 0.12], [0.62, 0.33], [-0.62, 0.33]]); g.fill(); // 擴散器
        for (const s of [1, -1]) { smooth(g, [[0.66 * s, 0.34], [0.86 * s, 0.36], [0.90 * s, 0.46], [0.70 * s, 0.44]]); g.fill(); } // 下面兩角的出風口
        for (const s of [1, -1]) { rrect(g, Math.min(0.56 * s, 0.84 * s), 0.715, Math.max(0.56 * s, 0.84 * s), 0.728, 0.004); g.fill(); } // 反光片
      },
      (g) => { rrect(g, -0.13, 0.30, 0.13, 0.318, 0.006); g.fill(); }, // 倒車燈
      (g) => { line(g, [[-0.90, 0.47], [-0.40, 0.46], [0.40, 0.46], [0.90, 0.47]], 0.004); line(g, [[-0.35, 0.90], [0.35, 0.90]], 0.004); },
    ]);
  }

  // ---- 上面（x, z）：前擋、後窗、碳纖維車頂、引擎蓋格柵、排氣管、前車蓋的縫 ----
  const WS = [[0.80, 0], [0.795, 0.30], [0.77, 0.50], [0.72, 0.63], [0.64, 0.715], [0.56, 0.70], [0.46, 0.66], [0.36, 0.60], [0.28, 0.53],
    [0.26, 0.40], [0.25, 0.20], [0.25, 0]];
  const ROOF = [[0.25, 0], [0.25, 0.30], [0.24, 0.50], [0.20, 0.585], [0.0, 0.60], [-0.14, 0.585], [-0.20, 0.50], [-0.22, 0]];
  const RW = [[-0.40, 0], [-0.40, 0.26], [-0.43, 0.30], [-0.52, 0.30], [-0.53, 0]]; // 車頂後面直立的小後窗
  const DECK = [[-0.60, 0], [-0.60, 0.28], [-0.80, 0.33], [-1.40, 0.33], [-1.90, 0.31], [-2.08, 0.27], [-2.10, 0]]; // 兩條扶壁中間
  function top() {
    return layers(BOX.top, [
      (g) => { // R：霧黑（引擎蓋格柵、排氣管口）
        smooth(g, both(DECK)); g.fill();
      },
      (g) => { // G：黑色（前擋黑邊、雨刷飾板、碳纖維車頂、引擎蓋）
        frit(g, both(WS), 0.025, [0.23, 0.30], [0.77, 0.82]);
        smooth(g, both(ROOF)); g.fill();
      },
      (g) => { // B：縫（前車蓋、引擎蓋）
        line(g, [[0.84, 0.46], [1.30, 0.50], [1.80, 0.44], [2.12, 0.36], [2.24, 0.20], [2.26, 0], [2.24, -0.20], [2.12, -0.36], [1.80, -0.44], [1.30, -0.50], [0.84, -0.46]], 0.005);
        g.lineWidth = 0.005; smooth(g, both(ROOF)); g.stroke();
        g.save(); smooth(g, both(DECK)); g.clip(); // 引擎蓋上的百葉
        for (let x = -1.22; x > -2.05; x -= 0.04) line(g, [[x, -0.30], [x, 0.30]], 0.01);
        g.restore();
      },
      (g) => { smooth(g, both(WS)); g.fill(); smooth(g, both(RW)); g.fill(); }, // A：玻璃
    ]);
  }

  // ---- 拉花 ----
  const LB = '#48aee6', DB = '#123a85', RED = '#d4202c', WHITE = '#f4f5f6', INK = '#111214';
  // 條紋：[寬度, 顏色]，從外（下面／後面）往內
  const MARTINI = [[0.028, LB], [0.01, DB], [0.028, LB], [0.012, null], [0.11, RED], [0.012, null], [0.028, LB], [0.01, DB], [0.028, LB]];
  // 沿著一條中心線畫一束條紋（中心線：水平一段 → 圓弧往上 → 直的往上）
  function band(g, stripes, draw) {
    const W = stripes.reduce((s, [w]) => s + w, 0);
    let off = -W / 2;
    for (const [w, col] of stripes) {
      if (col) { g.strokeStyle = col; g.lineWidth = w + 0.002; g.lineCap = 'butt'; g.lineJoin = 'round'; g.beginPath(); draw(off + w / 2); g.stroke(); }
      off += w;
    }
  }
  function livery(sd, style = 'stripes') {
    const { c, g } = canvas(BOX.side);
    g.clearRect(-3, -1, 6, 3);
    if (style === 'ff') style = 'stripes'; // 截圖頁建貼圖時用的預設名字
    if (style === 'stripes') {
      // 車門下面一束橫的，到後輪前面往上彎、沿著後葉子板前緣往上到頂
      const cx = -0.74, cy = 0.70, r = 0.365;
      band(g, MARTINI, (o) => { // o：離中心線的距離（正的往外＝下面／後面）
        const rr = r + o;
        g.moveTo(0.84, cy - rr); g.lineTo(cx, cy - rr);
        g.arc(cx, cy, rr, -Math.PI / 2, -Math.PI, true);
        g.lineTo(cx - rr - 0.08, 0.97);
      });
      g.fillStyle = WHITE;
      text(g, '6', 0.46, 0.585, 0.34, { mirror: sd < 0, weight: 700, font: 'Arial, sans-serif' });
      // 前車蓋條紋在上面這條沒有車身的地方（y＞1.2），給車蓋上的貼片用（x, z 對到 y＝1.2＋(z＋0.2)／3）
      const Y = (z) => 1.2 + (z + 0.2) / 3;
      const lid = [[0.028, LB], [0.01, DB], [0.028, LB], [0.012, null], [0.11, RED], [0.012, null], [0.05, WHITE], [0.012, null], [0.028, LB], [0.01, DB], [0.028, LB]];
      let z = 0.13 - lid.reduce((s, [w]) => s + w, 0) / 2;
      for (const [w, col] of lid) { if (col) { g.fillStyle = col; g.fillRect(0.70, Y(z), 1.70, (w + 0.002) / 3); } z += w; }
    } else if (style === 'salzburg') {
      g.fillStyle = RED;
      // 前葉子板上緣整片紅、輪子後面往下掃到側裙
      smooth(g, [[2.25, 0.60], [1.90, 0.745], [1.50, 0.80], [1.10, 0.815], [0.80, 0.80], [0.66, 0.78], [0.62, 0.62], [0.66, 0.40], [0.72, 0.24],
        [0.86, 0.24], [0.90, 0.40], [0.90, 0.62], [1.00, 0.70], [1.30, 0.74], [1.70, 0.72], [2.05, 0.66], [2.30, 0.54], [2.36, 0.62], [2.36, 1.0], [2.25, 1.0]]);
      g.fill();
      // 車門上三條橫的（越往後越細），側裙一條
      for (const [y, h, x1] of [[0.815, 0.04, -0.45], [0.66, 0.05, -0.50], [0.50, 0.045, -0.55]]) {
        poly(g, [[0.70, y + h / 2], [x1 + 0.12, y + h / 2 - 0.004], [x1, y], [x1 + 0.12, y - h / 2 + 0.004], [0.70, y - h / 2]]); g.fill();
      }
      poly(g, [[0.86, 0.255], [-0.92, 0.255], [-0.98, 0.20], [-0.92, 0.175], [0.86, 0.175]]); g.fill();
      // 白色圓牌＋黑色 25
      g.fillStyle = WHITE; circle(g, 0.06, 0.60, 0.19); g.fill();
      g.fillStyle = INK; text(g, '25', 0.06, 0.60, 0.23, { mirror: sd < 0, weight: 700, font: 'Arial, sans-serif' });
    }
    return c;
  }
  // 正面：stripes 那組條紋從車頭往車蓋爬（只有斜的車頭那段看得到）
  function frontLivery(style = 'stripes') {
    const { c, g } = canvas(BOX.front);
    g.clearRect(-2, -1, 4, 3);
    if (style === 'ff') style = 'stripes';
    if (style === 'stripes') {
      const lid = [[0.028, LB], [0.01, DB], [0.028, LB], [0.012, null], [0.11, RED], [0.012, null], [0.05, WHITE], [0.012, null], [0.028, LB], [0.01, DB], [0.028, LB]];
      let z = 0.13 - lid.reduce((s, [w]) => s + w, 0) / 2;
      for (const [w, col] of lid) { if (col) { g.fillStyle = col; g.fillRect(-z - w - 0.001, 0.40, w + 0.002, 0.60); } z += w; }
    }
    return c;
  }

  return {
    side, rear, top,
    fronts: { base: front },
    livery, frontLivery,
    livDefault: 1,
    nose: () => 'base',
    U: { uXr: -1.4165, uXf: 1.3135, uFx: [1.80, 1.90], uRx: [-2.0, -2.1], uWell: [0.347, 0.385, 0.95], uWellR: [0.364, 0.40, 0.95], uGlassY: 0.80 },
  };
})();
