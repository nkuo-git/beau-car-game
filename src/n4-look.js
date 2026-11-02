// N4 街車（第 62 批）的表面細節（投影貼圖）：車殼網格就是公尺座標（n4-body.mjs → moto-body.mjs，沒有整流罩：油箱＋座墊車尾）。
// 自己設計的街車（沒有照片、沒有真的車標）：大燈、儀表、水箱、引擎都是零件（moto-spec.js），車殼上只有拉花；整個車殼都是車漆。
import { BOX, layers, poly, text, canvas } from './masks.js';

export const N4_LOOK = (() => {
  const rr = (g, x0, y0, x1, y1, r) => { g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, r); };
  const none = (b) => () => layers(b, [null, null, null, null]); // 車殼上沒有玻璃、黑、縫

  // ---- 拉花：race＝油箱側面「N4」＋車尾白底號碼牌「4」；stripe＝油箱到車尾兩條細線＋「N4」；none＝不要 ----
  // （油箱側面 x −0.06～0.44、y 0.72～0.98；車尾 x −0.85～−0.30、y 0.74～0.90；騎的人的腿擋住座墊下面那一段）
  function livery(sd, style = 'race') {
    const { c, g } = canvas(BOX.side);
    g.clearRect(-3, -1, 6, 3);
    if (style === 'none') return c;
    const ink = '#f4f5f6';
    if (style === 'race') {
      g.fillStyle = ink; rr(g, -0.80, 0.80, -0.60, 0.875, 0.02); g.fill(); // 號碼牌（車尾側面）
      g.fillStyle = '#16171a'; text(g, '4', -0.70, 0.838, 0.066, { mirror: sd < 0, italic: true });
      g.fillStyle = ink; text(g, 'N4', 0.20, 0.86, 0.075, { mirror: sd < 0, italic: true });
      poly(g, [[0.02, 0.785], [0.40, 0.80], [0.40, 0.812], [0.02, 0.797]]); g.fill(); // 油箱下面一條斜線
    } else {
      g.fillStyle = ink;
      for (const dy of [0, 0.022]) poly(g, [[0.42, 0.905 - dy], [-0.05, 0.835 - dy], [-0.30, 0.815 - dy], [-0.84, 0.86 - dy], [-0.84, 0.868 - dy], [-0.30, 0.825 - dy], [-0.05, 0.845 - dy], [0.42, 0.915 - dy]]), g.fill();
      text(g, 'N4', 0.18, 0.80, 0.06, { mirror: sd < 0 });
    }
    return c;
  }
  function frontLivery() { const { c, g } = canvas(BOX.front); g.clearRect(-2, -1, 4, 3); return c; }

  return {
    side: none(BOX.side), rear: none(BOX.rear), top: none(BOX.top),
    fronts: { base: none(BOX.front) },
    livery, frontLivery,
    livDefault: 1,
    nose: () => 'base',
    // 前後軸；車頭面、車尾面放到很遠（車殼沒有正面、背面的投影）；輪拱內側不塗黑（半徑 0）；沒有玻璃
    U: { uXr: -0.68, uXf: 0.70, uFx: [3.0, 3.1], uRx: [-3.0, -3.1], uWell: [0.30, 0.0, 0.0], uWellR: [0.315, 0.0, 0.0], uGlassY: 3 },
  };
})();
