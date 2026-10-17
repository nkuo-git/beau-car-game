// 3D Lancer Evolution IX 的表面細節（投影貼圖），做法跟 gtr-look.js 一樣。
import { BOX, layers, poly, smooth, line, text, both, frit, canvas } from './masks.js';

export const EVO_LOOK = (() => {
  function side() { return layers(BOX.side, [null, null, null, null]); }
  function front() { return layers(BOX.front, [null, null, null, null]); }
  function rear() { return layers(BOX.rear, [null, null, null, null]); }
  function top() { return layers(BOX.top, [null, null, null, null]); }
  function livery() { const { c, g } = canvas(BOX.side); g.clearRect(-3, -1, 6, 3); return c; }
  function frontLivery() { const { c, g } = canvas(BOX.front); g.clearRect(-2, -1, 4, 3); return c; }
  return {
    side, rear, top, fronts: { base: front }, livery, frontLivery, livDefault: 0, nose: () => 'base',
    U: { uXr: -1.325, uXf: 1.30, uFx: [1.85, 1.95], uRx: [-1.90, -1.98], uWell: [0.3217, 0.362, 0.87], uGlassY: 0.93 },
  };
})();
