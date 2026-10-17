import * as THREE from 'three';
import { mirrorR34 } from './parts.js';
import { EVO_LOOK } from './evo-look.js';
export const EVO_SPEC = {
  look: EVO_LOOK, paint: '#eef0f1', metal: 0.1, seat: 0x1c1d20,
  wheels: { xf: 1.30, xr: -1.325, R: 0.3217, rim: 0.2159, trackF: 0.7575, trackR: 0.7575, wF: 0.235, wR: 0.235, style: 'multi' },
  mirror: (paint, mats, s) => { const m = mirrorR34(paint, mats, s); m.position.set(0.85, 0.98, s * 0.78); return m; },
  wings: { none: () => new THREE.Group() }, wing: 'none',
  interior: { dx: 0.1, cage: false, wheelZ: 0.37, dashX: 0.62, dashY: 0.90, bench: { x: -0.95, shelfX: -1.55, shelfY: 0.99 } },
  build() { return () => {}; }, kit: 'stock',
};
export const EVO_CAMS = {
  photo1: { a: -35.256, d: 5.183, h: 1.249, tx: 0.538, ty: 0.591, fov: 21.311, rl: -0.443 },
  photo2: { a: 143.955, d: 3.173, h: 1.249, tx: -0.879, ty: 0.647, fov: 42.145, rl: -0.953 },
  photo3: { a: 146.666, d: 3.593, h: 1.45, tx: -0.984, ty: 0.557, fov: 34.881, rl: 1.677 },
  photo4: { a: 112.391, d: 11.686, h: 0.991, tx: 0.918, ty: 0.882, fov: 28.926, rl: -0.46 },
  photo5: { a: 40.962, d: 3.644, h: 1.269, tx: 0.678, ty: 0.704, fov: 44.302, rl: -1.244 },
};
