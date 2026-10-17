// 3D Civic Type R FK8 的表面細節（投影貼圖）——暫時的
import { BOX, layers, poly, smooth, line, text, both, frit, canvas } from './masks.js';

export const CIVIC_LOOK = (() => {
  const DLO = [[0.52, 0.95], [0.07, 0.985], [-0.6, 1.03], [-1.41, 1.10], [-1.57, 1.13], [-1.53, 1.14], [-1.12, 1.29], [-0.48, 1.376], [0.32, 1.34]];
  function side() { return layers(BOX.side, [(g) => { smooth(g, DLO); g.fill(); }, null, null, null]); }
  const WS = [[0.80, 0], [0.80, 0.55], [0.70, 0.70], [0.0, 0.66], [-0.08, 0.6], [-0.08, 0]];
  const BL = [[-1.72, 0], [-1.72, 0.55], [-2.06, 0.55], [-2.06, 0]];
  function top() { return layers(BOX.top, [null, null, null, (g) => { smooth(g, both(WS)); g.fill(); poly(g, both(BL)); g.fill(); }]); }
  function front() { return layers(BOX.front, [null, null, null, null]); }
  function rear() { return layers(BOX.rear, [null, null, null, null]); }
  function livery() { const { c, g } = canvas(BOX.side); g.clearRect(-3, -1, 6, 3); return c; }
  function frontLivery() { const { c, g } = canvas(BOX.front); g.clearRect(-2, -1, 4, 3); return c; }
  return { side, rear, top, fronts: { base: front }, livery, frontLivery, livDefault: 0, nose: () => 'base',
    U: { uXr: -1.41, uXf: 1.29, uFx: [1.70, 1.80], uRx: [-2.05, -2.12], uWell: [0.3275, 0.40, 0.90], uWellR: [0.3275, 0.40, 0.90], uGlassY: 0.98 } };
})();
