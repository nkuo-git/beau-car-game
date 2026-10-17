// 3D McLaren Senna：輪子、尾翼、後照鏡、下巴、擴散器、排氣管、相機、車庫選項
import * as THREE from 'three';
import { SENNA_LOOK } from './senna-look.js';

export const SENNA_SPEC = {
  look: SENNA_LOOK, paint: '#c8101c', metal: 0.1, seat: 0x1b1c1f,
  wheels: { xf: 1.092, xr: -1.578, RF: 0.327, RR: 0.3485, rimF: 0.2413, rimR: 0.254, trackF: 0.84, trackR: 0.815, wF: 0.245, wR: 0.315, style: 'five' },
  mirror: (paint, mats, s) => new THREE.Group(),
  wings: { stock: (paint, mats) => new THREE.Group() },
  wing: 'stock',
  interior: { dx: 0.0, cage: false, wheelZ: -0.36, dashX: 0.62, dashY: 0.80, shelf: false },
  build(body, paint, mats) { return () => {}; },
  kit: 'stock',
};
export const SENNA_CAMS = {
  photo1: { a: 51.168, d: 5.836, h: 1.421, tx: 0.239, ty: 0.336, fov: 23.216, rl: -2.539 },
  photo2: { a: 40.697, d: 6.969, h: 1.579, tx: 0.312, ty: 0.54, fov: 20.009, rl: -1.005 },
  photo3: { a: 134.981, d: 5.287, h: 1.481, tx: -0.746, ty: 0.405, fov: 25.75, rl: -0.089 },
  x1: { a: -32.014, d: 3.943, h: 1.468, tx: 0.776, ty: 0.536, fov: 35.205, rl: 0.59 },
  x3: { a: -151.401, d: 4.409, h: 1.508, tx: -1.211, ty: 0.472, fov: 23.719, rl: -1.113 },
};
