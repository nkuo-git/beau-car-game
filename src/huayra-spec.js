// 3D Pagani Huayra（暫時版）
import * as THREE from 'three';
import { interior } from './parts.js';
import { HUAYRA_LOOK } from './huayra-look.js';

export const HUAYRA_SPEC = {
  look: HUAYRA_LOOK, paint: '#1f4fd6', metal: 0.35, seat: 0x2a2b2f,
  wheels: { xf: 1.27, xr: -1.525, RF: 0.3305, RR: 0.3545, rimF: 0.2413, rimR: 0.254, trackF: 0.84, trackR: 0.82, wF: 0.255, wR: 0.335, style: 'multi' },
  mirror: () => new THREE.Group(),
  wings: { stock: () => new THREE.Group() },
  wing: 'stock',
  interior: { dx: 0.0, cage: false, wheelZ: -0.36, dashX: 0.70, dashY: 0.78, shelf: false },
  build() { return () => {}; },
  kit: 'stock',
};
export const HUAYRA_CAMS = {
  photo1: { a: 10.094, d: 2.201, h: 1.571, tx: 1.675, ty: 0.61, fov: 44.373, rl: 4.43 },
  photo2: { a: 167.91, d: 4.422, h: 1.688, tx: 0.117, ty: 0.26, fov: 40.515, rl: -0.593 },
  photo3: { a: 91.517, d: 11.038, h: 0.368, tx: 0.112, ty: 0.917, fov: 18.804, rl: -0.017 },
};
