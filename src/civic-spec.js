// 3D Civic Type R FK8 —— 暫時的
import * as THREE from 'three';
import { mirror } from './parts.js';
import { CIVIC_LOOK } from './civic-look.js';
import { CIVIC_CAMS as C0 } from './civic3d/cams.mjs';
export const CIVIC_SPEC = {
  look: CIVIC_LOOK, paint: '#c8102e', metal: 0.1, seat: 0x1c1d20,
  wheels: { xf: 1.29, xr: -1.41, R: 0.3275, rim: 0.254, trackF: 0.80, trackR: 0.7975, wF: 0.245, wR: 0.245, style: 'five' },
  mirror: (paint, mats, s) => { const m = mirror(paint, mats, s); m.position.set(0.50, 1.02, s * 0.84); return m; },
  wings: { stock: () => new THREE.Group(), none: () => new THREE.Group() }, wing: 'stock',
  interior: { dx: 0.0, cage: false, wheelZ: -0.37, dashX: 0.55, dashY: 0.90 },
  build() { return () => {}; }, kit: 'stock',
};
export const CIVIC_CAMS = C0;
