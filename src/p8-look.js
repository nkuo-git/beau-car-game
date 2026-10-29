// 皮卡（P8）的表面細節（投影貼圖），做法跟 k2-look.js 一樣：
// 車身網格存成「遮罩座標」（p8-body.mjs：xm＝x·0.90、ym＝(y−0.40)·0.90、zm＝z·0.90），這裡的點都用公尺寫，畫的時候整張圖先縮放、平移。
// 自己設計的車（沒有照片、沒有真的車標）：細長的大燈嵌在一條黑色的水箱罩橫帶兩頭、下面一大塊蜂巢網＋車身色的「P8」大字、黑色 B 柱、下面一圈黑色護板、直的尾燈在車斗兩個角。
import { BOX, layers, poly, smooth, line, text, canvas } from './masks.js';

export const P8_M = { S: 0.90, X0: 0, Y0: 0.40 }; // 遮罩座標的縮放、平移（跟 p8-body.mjs 的 P8 一樣）
export const P8_LOOK = (() => {
  const { S, X0, Y0 } = P8_M;
  const real = (fn, dx, dy) => (g) => { g.save(); g.translate(-dx * S, -dy * S); g.scale(S, S); fn(g); g.restore(); };
  const side = (fn) => real(fn, X0, Y0), face = (fn) => real(fn, 0, Y0), plan = (fn) => real(fn, X0, 0);
  const rr = (g, x0, y0, x1, y1, r) => { g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, r); };
  const circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
  const both = (pts) => [...pts, ...pts.slice().reverse().map(([x, z]) => [x, -z])]; // 上面：半邊 → 整個

  // ---- 側面（x, y）----
  // A 柱（前擋的後緣）：前擋下緣 (1.075, 1.235) → 上緣 (0.50, 1.786)
  const AP = (y) => 1.075 - 1.0436 * (y - 1.235);
  const WY0 = 1.20, WY1 = 1.765; // 側窗下緣、上緣
  const DOOR_W = [[AP(WY0) - 0.075, WY0], [AP(1.735) - 0.075, 1.735], [AP(1.735) - 0.10, WY1], [0.19, WY1], [0.17, 1.745], [0.17, 1.22], [0.19, WY0]];
  const REAR_W = [[0.05, WY0], [0.07, 1.22], [0.07, 1.745], [0.05, WY1], [-0.50, WY1], [-0.56, 1.742], [-0.58, 1.69], [-0.58, 1.22], [-0.56, WY0]];
  function sideTex() {
    return layers(BOX.side, [
      side((g) => { poly(g, DOOR_W); g.fill(); poly(g, REAR_W); g.fill(); }), // R：側窗
      side((g) => { // G：黑（B 柱、窗框膠條、門把、下面一圈護板）
        poly(g, [[0.07, 1.17], [0.17, 1.17], [0.17, 1.81], [0.07, 1.81]]); g.fill(); // B 柱
        g.fillStyle = '#000'; poly(g, DOOR_W); g.fill(); poly(g, REAR_W); g.fill(); g.fillStyle = '#fff'; // 窗戶挖掉（黑的地方玻璃不會透明）
        g.lineWidth = 0.02; g.lineJoin = 'round'; poly(g, DOOR_W); g.stroke(); poly(g, REAR_W); g.stroke(); // 窗框膠條
        rr(g, 0.25, 1.075, 0.40, 1.105, 0.012); g.fill(); rr(g, -0.50, 1.075, -0.35, 1.105, 0.012); g.fill(); // 門把
        poly(g, [[-2.70, 0.40], [2.70, 0.40], [2.70, 0.60], [-2.70, 0.60]]); g.fill(); // 下面一圈黑色護板（輪拱那裡本來就挖掉了）
      }),
      side((g) => { // B：縫
        line(g, [[1.08, 0.60], [1.08, 1.19], [AP(1.19) - 0.035, 1.19], [AP(1.80) - 0.035, 1.80], [0.12, 1.80], [0.12, 0.60]], 0.006); // 前門（窗框跟著門）
        line(g, [[0.12, 1.80], [-0.60, 1.80], [-0.63, 1.77], [-0.63, 0.60]], 0.006); // 後門
        line(g, [[1.13, 1.168], [2.44, 1.136]], 0.004); // 引擎蓋的邊（側面看）
        g.lineWidth = 0.005; circle(g, -0.86, 1.05, 0.048); g.stroke(); // 油箱蓋（車斗前面）
      }),
      null,
    ]);
  }

  // ---- 正面（u＝z，左右都畫；y）：上面一條黑色橫帶（兩頭是細長的大燈）、下面一大塊蜂巢網（中間車身色的 P8 大字）、大燈外側下面橘色方向燈 ----
  const LZ0 = 0.535, LZ1 = 0.868, LY0 = 0.985, LY1 = 1.095;
  const lamp = (g, s, e = 0) => rr(g, s > 0 ? LZ0 - e : -LZ1 - e, LY0 - e, s > 0 ? LZ1 + e : -LZ0 + e, LY1 + e, 0.022 + e);
  const grille = (g) => { g.beginPath(); g.roundRect(-0.885, 0.97, 1.77, 0.14, 0.035); g.roundRect(-0.47, 0.72, 0.94, 0.30, 0.045); }; // 橫帶＋下面那塊
  const P8TXT = (g) => text(g, 'P8', 0, 0.858, 0.155, { skew: 0.08 });
  function front() {
    return layers(BOX.front, [
      face((g) => { for (const s of [1, -1]) { lamp(g, s); g.fill(); } }), // R：大燈
      face((g) => { // G：黑（水箱罩、大燈的框、保桿後面）；P8 大字挖掉＝車身色
        grille(g); g.fill();
        g.lineWidth = 0.012; for (const s of [1, -1]) { lamp(g, s, 0.006); g.stroke(); }
        poly(g, [[-0.95, 0.40], [0.95, 0.40], [0.95, 0.72], [-0.95, 0.72]]); g.fill();
        g.fillStyle = '#000'; P8TXT(g);
      }),
      face((g) => { for (const s of [1, -1]) { rr(g, s > 0 ? 0.77 : -0.862, 0.99, s > 0 ? 0.862 : -0.77, 1.012, 0.006); g.fill(); } }), // B：橘色方向燈（大燈外側下面）
      face((g) => { // A：燈裡暗的部分（整個暗，上緣一條亮的 LED、外側一個亮圈的投射鏡）；網子（蜂巢一格一格的點，P8 字上面沒有）
        for (const s of [1, -1]) {
          g.fillStyle = '#fff'; lamp(g, s); g.fill();
          g.fillStyle = '#000'; rr(g, s > 0 ? 0.55 : -0.853, 1.074, s > 0 ? 0.853 : -0.55, 1.086, 0.005); g.fill(); // 上緣的 LED（亮）
          g.lineWidth = 0.01; g.strokeStyle = '#000'; for (const zc of [0.64, 0.76]) { circle(g, s * zc, 1.036, 0.03); g.stroke(); } // 兩個投射鏡的亮圈
          g.fillStyle = '#fff';
        }
        for (let k = 0; k < 13; k++) for (let i = -23; i <= 23; i++) {
          const z = i * 0.02 + (k % 2) * 0.01, y = 0.737 + k * 0.021;
          if (Math.abs(z) < 0.455 && y < 1.005) { circle(g, z, y, 0.0062); g.fill(); }
        }
        g.fillStyle = '#000'; P8TXT(g);
      }),
    ]);
  }

  // ---- 後面（u＝z，y）：直的尾燈在車斗兩個角（上紅、下白倒車燈）、尾門（縫、把手）----
  const TL = [0.765, 0.80, 0.915, 1.14];
  function rear() {
    const tl = (g, s, y0, y1) => rr(g, s > 0 ? TL[0] : -TL[2], y0, s > 0 ? TL[2] : -TL[0], y1, 0.025);
    return layers(BOX.rear, [
      face((g) => { for (const s of [1, -1]) { tl(g, s, 0.895, TL[3]); g.fill(); } }), // R：紅色尾燈
      face((g) => { // G：黑（尾燈框、尾門把手、下面保桿後面）
        g.lineWidth = 0.012; for (const s of [1, -1]) { tl(g, s, TL[1], TL[3]); g.stroke(); }
        for (const s of [1, -1]) { rr(g, s > 0 ? TL[0] : -TL[2], 0.878, s > 0 ? TL[2] : -TL[0], 0.89, 0.003); g.fill(); } // 紅燈跟倒車燈中間一條黑
        text(g, 'P8', 0, 0.875, 0.115, { skew: 0.08 }); // 尾門上的 P8（黑色的字）
        rr(g, -0.13, 1.065, 0.13, 1.108, 0.014); g.fill(); // 尾門把手
        poly(g, [[-0.95, 0.40], [0.95, 0.40], [0.95, 0.62], [-0.95, 0.62]]); g.fill();
      }),
      face((g) => { for (const s of [1, -1]) { tl(g, s, TL[1], 0.878); g.fill(); } }), // B：倒車燈
      face((g) => { line(g, [[-0.735, 1.18], [-0.735, 0.63], [0.735, 0.63], [0.735, 1.18]], 0.006); }), // A：縫（尾門）
    ]);
  }

  // ---- 上面（x, z）：前擋玻璃、雨刷那條黑、引擎蓋的縫、車斗的邊（黑色護蓋）、車斗裡面黑 ----
  const WS = [[1.06, 0], [1.06, 0.775], [1.035, 0.80], [0.99, 0.80], [0.56, 0.745], [0.525, 0.735], [0.505, 0.71], [0.505, 0]];
  function top() {
    return layers(BOX.top, [
      null,
      plan((g) => { // G：黑
        rr(g, 1.075, -0.82, 1.14, 0.82, 0.01); g.fill(); // 雨刷那條（前擋下緣）
        g.lineWidth = 0.014; smooth(g, both(WS)); g.stroke(); // 前擋膠條
        poly(g, [[-2.60, -0.95], [-0.735, -0.95], [-0.735, 0.95], [-2.60, 0.95]]); g.fill(); // 車斗：邊上的黑色護蓋、裡面（內襯另外做）
      }),
      plan((g) => { // B：縫（引擎蓋）
        line(g, [[1.15, 0.86], [2.44, 0.86]], 0.005); line(g, [[1.15, -0.86], [2.44, -0.86]], 0.005);
        line(g, [[1.15, 0.86], [1.15, -0.86]], 0.005);
      }),
      plan((g) => { smooth(g, both(WS)); g.fill(); }), // A：前擋玻璃
    ]);
  }

  // ---- 拉花：stripe＝側面一條粗的、一條細的（沙漠賽車那種）＋車斗上 P8 4X4；mud＝下面一圈泥巴點點；none＝不要 ----
  // （0.60 以下是黑色護板、輪拱挖掉了，所以條紋放在 0.66～0.80、字放在車斗側面輪拱上面）
  function livery(sd, style = 'stripe') {
    const { c, g } = canvas(BOX.side);
    g.clearRect(-3, -1, 6, 3);
    if (style === 'none') return c;
    side((q) => {
      if (style === 'mud') { // 輪子往後噴上去的泥巴（越遠越少、越小）＋下面一整圈的點點＋幾條往下流的
        let s = 12345; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
        const C = ['rgba(92,66,40,0.92)', 'rgba(120,90,58,0.85)', 'rgba(70,50,32,0.9)'];
        for (const xa of [1.70, -1.40]) for (let i = 0; i < 520; i++) {
          const th = (0.55 + rnd() * 0.42) * Math.PI, d = 0.47 + rnd() ** 1.8 * 0.85; // 從輪子後上方往後散開
          const x = xa + Math.cos(th) * d, y = 0.42 + Math.sin(th) * d * 0.62, r = 0.005 + rnd() * rnd() * 0.03 * (1.25 - (d - 0.47) / 0.85);
          q.fillStyle = C[i % 3]; circle(q, x, y, r); q.fill();
        }
        for (let i = 0; i < 900; i++) {
          const x = -2.55 + rnd() * 5.05, y = 0.60 + rnd() ** 2.2 * 0.30, r = 0.004 + rnd() * rnd() * 0.028;
          q.fillStyle = C[i % 3]; circle(q, x, y, r); q.fill();
        }
        q.fillStyle = C[0];
        for (let i = 0; i < 40; i++) { const x = -2.5 + rnd() * 4.9, y = 0.60 + rnd() * 0.10, w = 0.006 + rnd() * 0.01, h = 0.03 + rnd() * 0.09; rr(q, x - w / 2, y, x + w / 2, y + h, w / 2); q.fill(); circle(q, x, y + h, w * 0.9); q.fill(); }
        poly(q, [[-2.55, 0.60], [2.50, 0.60], [2.50, 0.65], [-2.55, 0.65]]); q.fill();
      } else {
        q.fillStyle = '#16171a';
        poly(q, [[-2.52, 0.665], [2.36, 0.665], [2.30, 0.745], [-2.52, 0.745]]); q.fill();
        poly(q, [[-2.52, 0.775], [2.24, 0.775], [2.225, 0.795], [-2.52, 0.795]]); q.fill();
        text(q, 'P8 4X4', -2.10, 1.045, 0.092, { mirror: sd < 0, italic: true });
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
    U: { uXr: X(-1.40), uXf: X(1.70), uFx: [X(2.40), X(2.44)], uRx: [X(-2.47), X(-2.50)], uWell: [Y(0.42), 0.66 * S, 0.90 * S], uWellR: [Y(0.42), 0.66 * S, 0.90 * S], uGlassY: Y(1.20) },
  };
})();
