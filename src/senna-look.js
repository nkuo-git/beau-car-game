// 3D McLaren Senna 的表面細節（投影貼圖），做法跟 gtr-look.js 一樣。
import { BOX, layers, poly, smooth, line, both, frit, canvas } from './masks.js';

export const SENNA_LOOK = (() => {
  const M = (pts) => pts.map(([u, y]) => [-u, y]);
  function side() { return layers(BOX.side, [null, null, null, null]); }
  function front() { return layers(BOX.front, [null, null, null, null]); }
  function rear() { return layers(BOX.rear, [null, null, null, null]); }
  function top() { return layers(BOX.top, [null, null, null, null]); }
  function livery(sd, s) { const { c, g } = canvas(BOX.side); g.clearRect(-3, -1, 6, 3); return c; }
  function frontLivery(s) { const { c, g } = canvas(BOX.front); g.clearRect(-2, -1, 4, 3); return c; }
  return {
    side, rear, top, fronts: { base: front }, livery, frontLivery, livDefault: 1, nose: () => 'base',
    U: { uXr: -1.578, uXf: 1.092, uFx: [1.85, 1.95], uRx: [-1.95, -2.05], uWell: [0.327, 0.39, 0.95], uWellR: [0.3485, 0.41, 0.95], uGlassY: 0.76 },
  };
})();
