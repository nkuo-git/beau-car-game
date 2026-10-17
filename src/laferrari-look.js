// 3D 法拉利 LaFerrari 的表面細節（投影貼圖），做法跟 GT-R 一樣。（初版：空的）
import { BOX, layers, poly, smooth, line, both, frit, canvas } from './masks.js';

export const LAFERRARI_LOOK = (() => {
  function side() { return layers(BOX.side, [null, null, null, null]); }
  function front() { return layers(BOX.front, [null, null, null, null]); }
  function rear() { return layers(BOX.rear, [null, null, null, null]); }
  function top() { return layers(BOX.top, [null, null, null, null]); }
  function livery() { const { c, g } = canvas(BOX.side); g.clearRect(-3, -1, 6, 3); return c; }
  function frontLivery() { const { c, g } = canvas(BOX.front); g.clearRect(-2, -1, 4, 3); return c; }
  return {
    side, rear, top, fronts: { base: front }, livery, frontLivery, livDefault: 0, nose: () => 'base',
    U: { uXr: -1.385, uXf: 1.265, uFx: [1.6, 1.7], uRx: [-2.05, -2.15], uWell: [0.3208, 0.38, 0.94], uWellR: [0.3575, 0.415, 0.94], uGlassY: 0.76 },
  };
})();
