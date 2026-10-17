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
  photo1: { a: 51.156, d: 5.871, h: 1.424, tx: 0.238, ty: 0.338, fov: 23.08, rl: -2.582 },
  photo2: { a: 40.805, d: 6.794, h: 1.558, tx: 0.306, ty: 0.536, fov: 20.445, rl: -0.891 },
  photo3: { a: 134.927, d: 5.265, h: 1.48, tx: -0.748, ty: 0.404, fov: 25.868, rl: -0.137 },
  x1: { a: -31.281, d: 4.177, h: 1.55, tx: 0.795, ty: 0.546, fov: 33.44, rl: 0.464 },
  x3: { a: -151.385, d: 4.406, h: 1.507, tx: -1.212, ty: 0.472, fov: 23.741, rl: -1.109 },
};
