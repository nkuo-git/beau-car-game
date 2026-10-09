// 3D 怪獸卡車的表面細節（投影貼圖），做法跟 gtr-look.js 一樣。
// 車殼網格存成「遮罩座標」（monster-body.mjs：xm＝(x−0.1)·0.8、ym＝(y−1.38)·0.8、zm＝z·0.8，masks.js 的 shader 只認得一般車的大小），
// 這裡的點都用公尺（靜止時的車身座標）寫，畫的時候整張圖先縮放、平移（real），寫起來跟別台車一樣。
// 位置照 Nick 2026-09-28 傳的粉紅色怪獸卡車照片量的（照片上的點從相機打光線到車殼，monster3d/hits.mjs、trace.mjs）。
// 拉花都是自己畫的（照片上的贊助商標誌、車名、網址、人物畫都不抄，福特的橢圓標誌也不畫）：
//   照片雙色（上面車身色、下面黑、中間一條藍細線）、星條、怪獸火焰、大便龍 66；黑色下半身是拉花的一部分（「不要」＝整台車身色）
import { BOX, layers, poly, smooth, line, text, both, frit, canvas } from './masks.js';

export const MONSTER_M = { S: 0.8, X0: 0.1, Y0: 1.38 }; // 遮罩座標的縮放、平移（跟 monster-body.mjs 的 MONSTER 一樣）
export const MONSTER_LOOK = (() => {
  const { S, X0, Y0 } = MONSTER_M;
  // 用公尺畫：側面 (x, y)、正面／後面 (u＝z, y)、上面 (x, z)
  const real = (fn, dx, dy) => (g) => { g.save(); g.translate(-dx * S, -dy * S); g.scale(S, S); fn(g); g.restore(); };
  const side = (fn) => real(fn, X0, Y0), face = (fn) => real(fn, 0, Y0), plan = (fn) => real(fn, X0, 0);
  const M = (pts) => pts.map(([u, y]) => [-u, y]); // 正面、後面左右鏡射
  const rr = (g, x0, y0, x1, y1, r) => { g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, r); };
  const circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };

  // ---- 側面（x, y）----
  // 車門窗：下緣在腰線上面一點、上緣 2.905（車頂邊下面）、後緣 x≈0.03、前緣沿著 A 柱（照片的窗打到車殼上量的）
  const DLO = [[0.04, 2.45], [0.03, 2.60], [0.03, 2.80], [0.045, 2.875], [0.10, 2.905], [0.30, 2.905], [0.47, 2.90], [0.54, 2.87], [0.63, 2.80],
    [0.78, 2.67], [0.88, 2.575], [0.945, 2.495], [0.95, 2.455], [0.90, 2.438], [0.60, 2.432], [0.30, 2.43], [0.10, 2.43], [0.055, 2.435]];
  // 後輪拱（跟 monster-body.mjs 的 REAR_ARCH 一樣）：拱裡面那片內葉子板是黑的
  const ARCH = [[-2.25, 1.0], [-2.24, 1.70], [-2.21, 2.08], [-2.12, 2.24], [-1.92, 2.285], [-1.67, 2.225], [-1.38, 2.115],
    [-1.10, 1.975], [-0.88, 1.80], [-0.74, 1.62], [-0.62, 1.44], [-0.55, 1.0]];
  function sideTex() {
    return layers(BOX.side, [
      side((g) => { smooth(g, DLO); g.fill(); }), // 側窗
      side((g) => { // 黑色
        g.lineWidth = 0.024; g.lineJoin = 'round'; smooth(g, DLO); g.stroke(); // 窗框
        poly(g, [[2.28, 1.80], [2.80, 1.80], [2.80, 2.065], [2.28, 2.065]]); g.fill(); // 前保桿包到側面那段
        smooth(g, ARCH); g.fill(); // 後輪拱裡面
        rr(g, 0.075, 2.275, 0.19, 2.305, 0.012); g.fill(); // 門把
      }),
      side((g) => { // 縫
        line(g, [[1.10, 1.665], [1.09, 2.35], [1.02, 2.44], [0.56, 2.925]], 0.006); // 前門前緣＋A 柱
        line(g, [[0.0, 1.665], [0.0, 2.925]], 0.006); // 前門後緣（後半門前緣）
        line(g, [[-0.60, 1.665], [-0.60, 2.925]], 0.006); // 後半門後緣
        line(g, [[-0.60, 1.665], [1.10, 1.665]], 0.005); // 門下緣
        line(g, [[-0.72, 1.55], [-0.72, 2.93]], 0.007); // 車艙和貨斗（貨斗蓋）中間的縫
        line(g, [[-0.72, 2.405], [-2.47, 2.405]], 0.006); // 貨斗蓋下緣
        line(g, [[1.33, 2.43], [2.40, 2.40]], 0.005); // 引擎蓋和葉子板
      }),
      null,
    ]);
  }

  // ---- 正面（u＝z，畫的時候左右鏡射；y）----
  // 大燈：水箱罩兩邊，外側包到葉子板側面（外端畫到 u＝1.06，側面投影到的地方）
  const HEAD = [[0.705, 2.10], [0.70, 2.21], [0.735, 2.25], [0.84, 2.258], [0.93, 2.265], [1.02, 2.275], [1.07, 2.272], [1.07, 2.155],
    [0.99, 2.142], [0.90, 2.125], [0.80, 2.108]];
  // 水箱罩：大的長方形、上緣微拱、橫的格柵（照片那種 2000 年代全尺寸皮卡，中間不放廠徽）
  const GRILLE = [[0.0, 2.322], [0.25, 2.317], [0.50, 2.302], [0.55, 2.262], [0.555, 2.16], [0.52, 2.117], [0.30, 2.108], [0.0, 2.106]];
  const GR = [...GRILLE, ...M(GRILLE).slice(1, -1).reverse()];
  function front() {
    return layers(BOX.front, [
      face((g) => { for (const P of [HEAD, M(HEAD)]) { smooth(g, P); g.fill(); } }), // R：大燈
      face((g) => { // G：黑色
        smooth(g, GR); g.fill(); // 水箱罩裡面
        poly(g, [[-1.2, 1.70], [1.2, 1.70], [1.2, 2.062], [-1.2, 2.062]]); g.fill(); // 保桿（黑色塑膠）
        g.lineWidth = 0.012; for (const P of [HEAD, M(HEAD)]) { smooth(g, P); g.stroke(); } // 大燈的黑邊
      }),
      face((g) => { // B：橘色（大燈內側下面、外側角落）
        for (const s of [1, -1]) { circle(g, 0.745 * s, 2.165, 0.032); g.fill(); rr(g, s > 0 ? 1.0 : -1.07, 2.17, s > 0 ? 1.07 : -1.0, 2.235, 0.01); g.fill(); }
      }),
      face((g) => { // A：水箱罩的橫條（網子）、大燈裡的投射鏡（暗玻璃）
        g.save(); smooth(g, GR); g.clip();
        for (let y = 2.125; y < 2.31; y += 0.0265) poly(g, [[-0.6, y], [0.6, y], [0.6, y + 0.013], [-0.6, y + 0.013]]), g.fill();
        g.restore();
        for (const s of [1, -1]) {
          g.save(); smooth(g, s > 0 ? HEAD : M(HEAD)); g.clip();
          g.fillStyle = 'rgb(120,120,120)'; circle(g, 0.915 * s, 2.20, 0.042); g.fill(); // 投射鏡
          g.fillStyle = 'rgb(200,200,200)'; poly(g, [[0.70 * s, 2.09], [1.08 * s, 2.14], [1.08 * s, 2.158], [0.70 * s, 2.118]]); g.fill(); // 燈殼下緣
          g.restore(); g.fillStyle = '#fff';
        }
      }),
    ]);
  }

  // ---- 後面（u＝z, y）：直立的尾燈在兩個角、中間尾門、下面黑保桿 ----
  const LAMP = [0.80, 1.975, 0.975, 2.345]; // u0, y0, u1, y1
  function rear() {
    const lamp = (g, s) => rr(g, s > 0 ? LAMP[0] : -LAMP[2], LAMP[1], s > 0 ? LAMP[2] : -LAMP[0], LAMP[3], 0.03);
    return layers(BOX.rear, [
      face((g) => { for (const s of [1, -1]) { lamp(g, s); g.fill(); } }), // R：紅色尾燈
      face((g) => { // G：黑色
        poly(g, [[-1.2, 1.60], [1.2, 1.60], [1.2, 2.405], [-1.2, 2.405]]); g.fill(); // 尾門、後保桿都是黑的（跟兩邊黑色下半身接起來，照片那台車尾也是黑的）
        g.fillStyle = '#000'; for (const s of [1, -1]) { lamp(g, s); g.fill(); } g.fillStyle = '#fff'; // 尾燈的地方挖掉（shader 裡黑色會蓋掉紅色）
        g.lineWidth = 0.012; for (const s of [1, -1]) { lamp(g, s); g.stroke(); }
        rr(g, -0.12, 2.28, 0.12, 2.315, 0.012); g.fill(); // 尾門把手
      }),
      face((g) => { for (const s of [1, -1]) { rr(g, s > 0 ? 0.83 : -0.95, 2.10, s > 0 ? 0.95 : -0.83, 2.17, 0.012); g.fill(); } }), // B：倒車燈
      face((g) => { // A：縫
        g.lineWidth = 0.006; rr(g, -0.775, 1.915, 0.775, 2.355, 0.03); g.stroke(); // 尾門
        line(g, [[-1.1, 2.405], [1.1, 2.405]], 0.006); // 貨斗蓋下緣
      }),
    ]);
  }

  // ---- 上面（x, z）：前擋、雨刷飾板、引擎蓋的縫 ----
  const WS = [[0.975, 0], [0.975, 0.55], [0.965, 0.74], [0.93, 0.80], [0.85, 0.82], [0.72, 0.83], [0.672, 0.815], [0.652, 0.76], [0.645, 0.55], [0.645, 0]];
  function top() {
    return layers(BOX.top, [
      null,
      plan((g) => {
        frit(g, both(WS), 0.035, [0.60, 0.68], [0.935, 1.0]);
        rr(g, 0.99, -0.80, 1.10, 0.80, 0.03); g.fill(); // 雨刷飾板
      }),
      plan((g) => {
        line(g, [[1.12, 0.93], [1.60, 0.945], [2.30, 0.94], [2.44, 0.86], [2.50, 0.60], [2.52, 0], [2.50, -0.60], [2.44, -0.86], [2.30, -0.94], [1.60, -0.945], [1.12, -0.93]], 0.006); // 引擎蓋
        line(g, [[-0.72, 0.99], [-0.72, -0.99]], 0.007); // 車艙和貨斗蓋中間
      }),
      plan((g) => { smooth(g, both(WS)); g.fill(); }), // A：前擋玻璃
    ]);
  }

  // ---- 拉花 ----
  // 雙色的分界線（側面，下面黑）：前面在大燈下面、沿著葉子板到車艙前面，往後斜下來經過車門，貨斗那段繞過後輪拱上面往車尾升上去
  const TT = [[2.85, 2.30], [2.45, 2.30], [2.00, 2.315], [1.50, 2.33], [1.28, 2.34], [1.08, 2.30], [0.80, 2.21], [0.40, 2.08], [0.0, 2.00],
    [-0.40, 2.03], [-0.80, 2.13], [-1.20, 2.30], [-1.60, 2.42], [-2.00, 2.52], [-2.30, 2.66], [-2.50, 2.85], [-2.75, 3.10]];
  const offY = (pts, d) => pts.map(([x, y]) => [x, y + d]);
  function lowerPath(g, d = 0) { smooth(g, offY(TT, d), false); g.lineTo(-2.9, 1.2); g.lineTo(2.95, 1.2); g.closePath(); }
  function twoTone(g) {
    g.fillStyle = '#0c0d10'; lowerPath(g); g.fill();
    g.strokeStyle = '#2f63e8'; g.lineWidth = 0.022; g.lineJoin = 'round'; smooth(g, offY(TT, 0.026), false); g.stroke(); // 藍色細線
  }
  function star(g, x, y, r, rot = -Math.PI / 2) { // 五角星
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = rot + (i * Math.PI) / 5, q = i % 2 ? r * 0.4 : r; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, y + Math.sin(a) * q); }
    g.closePath();
  }
  // 星條：黑色下半身上面三條紅白紅的彩帶沿著分界線往後，車門前面一塊藍底白星，車尾一顆大白星
  function stars(g) {
    twoTone(g);
    g.save(); lowerPath(g, -0.012); g.clip();
    g.lineJoin = g.lineCap = 'round';
    const band = (d, w, col) => { g.strokeStyle = col; g.lineWidth = w; smooth(g, offY(TT.filter(([x]) => x < 0.9), d), false); g.stroke(); };
    band(-0.075, 0.06, '#d9232c'); band(-0.14, 0.05, '#f3f4f6'); band(-0.20, 0.06, '#d9232c');
    g.fillStyle = '#1d3fae'; poly(g, [[1.24, 2.36], [0.72, 2.36], [0.50, 1.62], [1.20, 1.62]]); g.fill(); // 藍底
    g.fillStyle = '#f5f6f8';
    for (const [x, y, r] of [[1.06, 2.17, 0.065], [0.87, 2.05, 0.05], [1.07, 1.95, 0.05], [0.84, 1.82, 0.058], [1.03, 1.74, 0.045], [0.69, 1.70, 0.04]]) { star(g, x, y, r); g.fill(); }
    star(g, -2.08, 2.38, 0.17, -Math.PI / 2 + 0.25); g.fillStyle = '#f5f6f8'; g.fill(); g.lineWidth = 0.02; g.strokeStyle = '#1d3fae'; g.stroke();
    g.restore();
  }
  // 怪獸火焰：從前面開口後緣往後舔的五條火舌（黃→橘→紅、深紅外框），火舌跟著分界線彎，只畫在黑色下半身上
  const TONGUES = [[1.74, 1.30, 0.17], [1.90, 1.80, 0.20], [2.05, 2.25, 0.21], [2.18, 1.85, 0.18], [2.28, 1.35, 0.14]]; // y、長度、根部粗細
  const ttY = (x) => { for (let i = 1; i < TT.length; i++) if (x >= TT[i][0]) { const [a, b] = [TT[i - 1], TT[i]], u = (x - b[0]) / (a[0] - b[0]); return b[1] + (a[1] - b[1]) * u; } return TT[TT.length - 1][1]; };
  function tongue(g, y0, L, h, k) {
    const x0 = 1.24, n = 32, top = [], bot = [], f = Math.min(1, (y0 - 1.62) / (ttY(x0) - 1.62)) * 0.9;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 - t * L, w = h * (1 - t) ** 0.75 * (1 + 0.25 * Math.sin(t * 9 + k)), c = y0 + (ttY(x) - ttY(x0)) * f + 0.05 * Math.sin(t * 5.5 + k * 1.7) * t;
      top.push([x, c + w / 2]); bot.push([x, c - w / 2]);
    }
    g.beginPath(); g.moveTo(x0 + 0.1, top[0][1]);
    for (const p of top) g.lineTo(...p);
    for (const p of bot.reverse()) g.lineTo(...p);
    g.lineTo(x0 + 0.1, bot[bot.length - 1][1]); g.closePath();
  }
  function fire(g) {
    twoTone(g);
    g.save(); lowerPath(g, -0.012); g.clip();
    g.lineJoin = 'round'; g.lineWidth = 0.03; g.strokeStyle = '#3a0804';
    TONGUES.forEach(([y, L, h], k) => { tongue(g, y, L, h, k); g.stroke(); });
    const gr = g.createLinearGradient(1.25, 0, -1.0, 0);
    for (const [k, col] of [[0, '#fff3a0'], [0.15, '#ffd92e'], [0.38, '#ff9a14'], [0.62, '#f25110'], [0.85, '#d2230e'], [1, '#a8140c']]) gr.addColorStop(k, col);
    g.fillStyle = gr; TONGUES.forEach(([y, L, h], k) => { tongue(g, y, L, h, k); g.fill(); });
    g.restore();
  }
  // 大便龍 66：車門上白色圓牌＋黑色 66，貨斗側面一塊黑底黃框的牌子寫「大便龍車隊」（黑底：什麼車色都看得清楚）
  const FONT = '"Arial Black", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "WenQuanYi Zen Hei", sans-serif';
  function number(g, sd) {
    twoTone(g);
    circle(g, 0.52, 1.86, 0.20); g.fillStyle = '#f5f6f8'; g.fill(); g.lineWidth = 0.025; g.strokeStyle = '#2f63e8'; g.stroke();
    g.fillStyle = '#111215'; text(g, '66', 0.52, 1.855, 0.23, { mirror: sd < 0, italic: true, skew: 0.12 });
    g.save();
    g.translate(-1.33, 2.68); g.scale(sd < 0 ? -1 : 1, -1); g.transform(1, 0, -0.18, 1, 0, 0); g.scale(0.0016, 0.0016); // 用 100px 的字畫再縮小（1px＝1.6 公釐）
    g.font = `900 100px ${FONT}`;
    const W = g.measureText('大便龍車隊').width + 190, H = 150;
    g.beginPath(); g.roundRect(-W / 2, -H / 2, W, H, 18); g.fillStyle = '#111215'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#ffd21f'; g.stroke();
    g.fillStyle = '#ffd21f'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('大便龍車隊', 0, 4);
    for (const s of [-1, 1]) { star(g, s * (W / 2 - 50), 0, 30); g.fill(); } // 兩頭各一顆星（這裡 y 是反的，−π/2 朝上）
    g.restore();
  }
  const OWN = { twotone: twoTone, stars, fire, number };
  function livery(sd, style = 'twotone') {
    const { c, g } = canvas(BOX.side);
    g.clearRect(-3, -1, 6, 3);
    side((q) => (OWN[style] || twoTone)(q, sd))(g); // 不認得的名字（剛建好時的 'ff'）畫照片雙色
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
    // 前後軸、前面開口、車尾、玻璃高度（遮罩座標）；輪拱的圓只給通用拉花用（z＝0：shader 不塗黑，輪拱內側是 monster-spec.js 的黑色內襯）
    U: { uXr: X(-1.90), uXf: X(1.90), uFx: [X(2.33), X(2.40)], uRx: [X(-2.28), X(-2.38)], uWell: [Y(1.70), 0.54, 0], uWellR: [Y(1.30), 0.87, 0], uGlassY: Y(2.44) },
    // 網格工具用的外形（公尺）：側窗 DLO（側面 x, y）、前擋 WS（上面 x, z 半邊）、雙色分界線 TT（側面）；monster-mesh.mjs 挑玻璃附近的三角形
    shape: { DLO, WS, TT },
  };
})();
