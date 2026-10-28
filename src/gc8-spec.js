// 3D Subaru Impreza WRX STI coupe（GC8）的設定：輪子（金色六輻）、賽道套件、車庫選項
// 第 49 批：車身換成高細節的（gc8-model.js，烘焙成 body-gc8-q.glb：gc8-bake.mjs）：STI 尾翼、後照鏡、排氣管、引擎蓋進氣口都在車身檔裡
import * as THREE from 'three';
import { aeroKit, rimMerge, rimLathe, rimCyl } from './parts.js';
import { GC8_LOOK } from './gc8-look.js';

// 照片那台的輪框（17 吋金色六輻）：六根細細的、一樣寬的輻條（接輪圈那頭圓圓的變寬），中間凹很深；平平的輪轂、黑色中心蓋、五顆螺帽
// 合成兩個網格（輪框色、黑色），自己有中心蓋和螺帽（own：parts.js 的 rimFace 不再加）
export function GC8_spokes(rim, w, mats) {
  const zo = w / 2 - 0.024, zi = w / 2 - 0.08, C = [], K = [];
  for (let k = 0; k < 6; k++) {
    const sh = new THREE.Shape(), r0 = 0.07, r1 = rim - 0.004;
    sh.moveTo(r0, -0.0195); sh.lineTo(r1 - 0.055, -0.018); sh.quadraticCurveTo(r1 - 0.014, -0.018, r1, -0.032); sh.lineTo(r1, 0.032); sh.quadraticCurveTo(r1 - 0.014, 0.018, r1 - 0.055, 0.018); sh.lineTo(r0, 0.0195); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.018, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2 }), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = Math.min(1, Math.max(0, (p.getX(i) - r0) / (r1 - r0))); p.setZ(i, p.getZ(i) + zi + (zo - zi) * t); } // 外面那頭在輪唇裡面、中間往裡面凹
    g.computeVertexNormals(); g.rotateZ((k * Math.PI) / 3 + Math.PI / 6); C.push(g);
  }
  C.push(rimLathe([[0.09, -0.01], [0.088, 0.016], [0.078, 0.028], [0.05, 0.034], [0, 0.036]].map(([r, z]) => [r, z + zi + 0.004]), 48)); // 輪轂：平平的圓盤，邊圓圓的
  for (let k = 0; k < 5; k++) { const a = (k * 2 * Math.PI) / 5 + Math.PI / 2; C.push(rimCyl(0.0095, 0.0095, 0.016, 6, zi + 0.046, 0.05 * Math.cos(a), 0.05 * Math.sin(a))); } // 螺帽
  K.push(rimCyl(0.028, 0.03, 0.012, 32, zi + 0.044)); // 中心蓋：黑的（沒有字）
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(rimMerge(C), mats.chrome), new THREE.Mesh(rimMerge(K), mats.black));
  return grp;
}
GC8_spokes.own = true;

// 第 49 批：照烘焙的新車身量（gc8-bake.mjs 的射線）：前保桿下巴往裡面彎，前下巴在 y 0.215（比保桿最前面多 2.5 公分，後緣塞進保桿底下）、沒有拉桿；
// 風刀貼著保桿角（兩端在保桿面裡面）；側裙刀片在門檻最下面（z 0.82）；擴散器貼著後保桿底、在排氣管（z −0.40、y 0.21～0.30）下面
export const GC8_AERO = {
  front: [[2.175, 0], [2.155, 0.30], [2.115, 0.50], [2.07, 0.62], [2.015, 0.70], [1.93, 0.75]], back: 1.86, y: 0.215,
  canard: { S: [1.93, 0.71], t: [-0.898, 0.436], ys: [0.295, 0.245] },
  skirt: { y: 0.165, x0: -0.86, x1: 0.84, z0: 0.79, z1: 0.875 },
  diff: { x0: -1.80, x1: -1.97, x2: -2.06, y0: 0.17, y1: 0.185, y2: 0.215, w: 0.62, fin0: -1.90 },
};

export const GC8_SPEC = {
  look: GC8_LOOK, paint: '#1a4cc0', metal: 0.4, seat: 0x1c1d20,
  wheels: { xf: 1.28, xr: -1.24, R: 0.312, rim: 0.216, trackF: 0.735, trackR: 0.735, wF: 0.215, wR: 0.215, style: GC8_spokes }, // 照片：17 吋、輪胎外面跟車身齊
  wings: { sti: 'baked' }, // STI 尾翼在車身檔裡（part＝wing）
  wing: 'sti',
  interior: { dx: 0.03, cage: false, wheelZ: 0.37, dashX: 0.52, dashY: 0.86, bench: { x: -0.92, shelfX: -1.24, shelfY: 0.92 } }, // 置物板在後擋下緣（-1.465、0.94）裡面
  build(body, paint, mats) { // 套件：原廠（照片那台）、賽道（前下巴＋風刀＋側裙刀片＋擴散器）
    const aero = aeroKit(mats, GC8_AERO); aero.visible = false; body.add(aero);
    return (kit) => { aero.visible = kit === 'track'; };
  },
  kit: 'stock',
};

// 照片相機（疊圖用）：照片 1＝前 3/4（3840×2559），照片 2＝後 3/4（499×374，另一台同型車）
export const GC8_CAMS = {
  photo1: { a: -35.0198, d: 9.9785, h: 1.7371, tx: 0.3663, ty: 0.7262, fov: 15.7783, rl: 0.4842 },
  photo2: { a: -145.2113, d: 5.6906, h: 0.2816, tx: -0.638, ty: 0.7136, fov: 25.3017, rl: -1.5171 },
};

export const GC8_GARAGE = {
  name: 'Subaru Impreza WRX STI', sub: 'GC8 雙門 · 金色輪框那台 · 3D 試做版',
  paints: [['#1a4cc0', 'WR 藍'], ['#f2f3f5', '白'], ['#141518', '黑'], ['#c3c8ce', '銀'], ['#c8141e', '紅'], ['#f2c200', '音速黃'], ['#1e5b35', '綠']],
  opts: {
    wing: [['sti', 'STI 尾翼'], ['none', '不要']],
    kit: [['stock', '原廠'], ['track', '賽道']],
    height: [['0', '原廠'], ['-0.03', '降低'], ['-0.05', '貼地']],
    livery: [['wrx', 'WRX 貼紙'], ['none', '不要']],
  },
  state: { paint: '#1a4cc0', rim: 'gold', caliper: '#c8141e', wing: 'sti', kit: 'stock', height: '0', livery: 'wrx', tint: 'light' },
};
