// 3D 法拉利 LaFerrari：輪子、後照鏡、尾翼、車尾、套件、車庫選項（初版）
import * as THREE from 'three';
import { LAFERRARI_LOOK } from './laferrari-look.js';

export const LAFERRARI_SPEC = {
  look: LAFERRARI_LOOK, paint: '#c8101a', metal: 0.3, seat: 0x1a1a1c,
  wheels: { xf: 1.265, xr: -1.385, RF: 0.3208, RR: 0.3575, rimF: 0.2413, rimR: 0.254, trackF: 0.83, trackR: 0.80, wF: 0.265, wR: 0.345, style: 'five' },
  mirror: () => new THREE.Group(),
  wings: {}, wing: 'none',
  interior: { dx: -0.1, cage: false, dashX: 0.45, dashY: 0.72, seatDy: -0.1, shelf: false },
  build() { return () => {}; },
  kit: 'stock',
};
const LAFERRARI_D = -0.06; // 相機是用「軸距中點＝0」解的；車身座標的軸距中點在 x＝D
export const LAFERRARI_CAMS = {
  photo1: { a: 32.369, d: 8.509, h: 1.164, tx: 0.465 + LAFERRARI_D, ty: 0.56, fov: 12.661, rl: 0.658 },
  photo2: { a: 40.948, d: 3.078, h: 1.299, tx: 0.918 + LAFERRARI_D, ty: 0.238, fov: 50.051, rl: -4.276 },
  photo3: { a: -134.133, d: 10.277, h: 1.54, tx: -0.276 + LAFERRARI_D, ty: 0.548, fov: 10.854, rl: 1.083 },
  photo4: { a: -144.9, d: 6.704, h: 1.535, tx: -0.577 + LAFERRARI_D, ty: 0.546, fov: 15.508, rl: -1.332 },
};
