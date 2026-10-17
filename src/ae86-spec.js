// 3D AE86（Sprinter Trueno 3 門掀背）：輪子（八輻、往內凹的老式鋁圈）、黑色方形後照鏡、原廠車頂小擾流、左後單出排氣、賽道套件、車庫選項
// 車身是 ae86-body.mjs 切出來的 body-ae86(-q).glb，表面細節在 ae86-look.js。
import * as THREE from 'three';
import { mirrorR34, aeroKit } from './parts.js';
import { AE86_LOOK } from './ae86-look.js';

// 輪框：八根粗的直輻條（Watanabe 風格），輻條中間的洞是圓角的梯形，整片往內凹一點，外面一圈台階狀的輪唇
export function AE86_wheel(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.008, ri = 0.058, N = 8;
  const disc = new THREE.Shape(); disc.absarc(0, 0, ro, 0, Math.PI * 2, false);
  const hw = (r) => 0.018 + ((r - ri) / (ro - ri)) * 0.006; // 輻條半寬：中間細一點、外面粗一點
  for (let j = 0; j < N; j++) {
    const a0 = (j * 2 * Math.PI) / N, a1 = ((j + 1) * 2 * Math.PI) / N;
    const rA = ri + 0.022, rB = ro - 0.024, n = 8, pts = [];
    for (let i = 0; i <= n; i++) { const r = rA + ((rB - rA) * i) / n; pts.push([Math.cos(a0 + Math.asin(hw(r) / r)) * r, Math.sin(a0 + Math.asin(hw(r) / r)) * r]); }
    const aO0 = a0 + Math.asin(hw(rB) / rB), aO1 = a1 - Math.asin(hw(rB) / rB);
    for (let i = 1; i < 8; i++) { const a = aO0 + ((aO1 - aO0) * i) / 8; pts.push([Math.cos(a) * rB, Math.sin(a) * rB]); }
    for (let i = n; i >= 0; i--) { const r = rA + ((rB - rA) * i) / n; pts.push([Math.cos(a1 - Math.asin(hw(r) / r)) * r, Math.sin(a1 - Math.asin(hw(r) / r)) * r]); }
    const aI0 = a1 - Math.asin(hw(rA) / rA), aI1 = a0 + Math.asin(hw(rA) / rA);
    for (let i = 1; i < 4; i++) { const a = aI0 + ((aI1 - aI0) * i) / 4; pts.push([Math.cos(a) * rA, Math.sin(a) * rA]); }
    const hole = new THREE.Path(); hole.moveTo(...pts[0]); for (const p of pts.slice(1)) hole.lineTo(...p); hole.closePath();
    disc.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(disc, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2, curveSegments: 48 });
  // 往內凹：越靠中間越往裡面（老式鋁圈的碟形）
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)); p.setZ(i, p.getZ(i) - 0.03 * (1 - Math.min(1, r / ro)) ** 1.5); }
  geo.computeVertexNormals();
  const face = new THREE.Mesh(geo, mats.chrome); face.position.z = w / 2 - 0.05; g.add(face);
  // 外面一圈台階狀的輪唇
  const lip = new THREE.Mesh(new THREE.TorusGeometry(ro + 0.004, 0.006, 8, 96), mats.chrome); lip.position.z = w / 2 - 0.008; g.add(lip);
  const step = new THREE.Mesh(new THREE.CylinderGeometry(ro + 0.002, ro + 0.002, 0.03, 96, 1, true), mats.chrome);
  step.geometry.rotateX(Math.PI / 2); step.position.z = w / 2 - 0.028; g.add(step);
  return g;
}
AE86_wheel.capInset = 0.07;

// 原廠車頂小擾流：車頂後緣一片跟車身同色的小翼（側面的形狀往兩邊拉），兩端修圓
export function AE86_roofSpoiler(paint) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.80, 1.325); sh.quadraticCurveTo(-0.90, 1.352, -1.02, 1.352); sh.quadraticCurveTo(-1.075, 1.35, -1.07, 1.335);
  sh.quadraticCurveTo(-1.00, 1.318, -0.93, 1.300); sh.quadraticCurveTo(-0.86, 1.31, -0.80, 1.325);
  const span = 1.0;
  const geo = new THREE.ExtrudeGeometry(sh, { depth: span, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.008, bevelSegments: 3, curveSegments: 10 });
  geo.translate(0, 0, -span / 2);
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, paint));
  return g;
}

// 圓的排氣管尾端（左後，保桿下面）
export function AE86_tip(mats, x, y, z) {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 28, 1, true), mats.alu);
  tube.geometry.rotateZ(Math.PI / 2); tube.material.side = THREE.DoubleSide; g.add(tube);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.026, 28), mats.black);
  inner.rotation.y = -Math.PI / 2; inner.position.x = -0.04; g.add(inner);
  g.position.set(x, y, z); g.rotation.z = 0.08; // 尾端微微往下
  return g;
}

export const AE86_AERO = {
  front: [[2.135, 0], [2.13, 0.30], [2.115, 0.50], [2.085, 0.62], [2.035, 0.70], [1.96, 0.75]], back: 1.86, y: 0.268, rods: [2.07, 0.30],
  canard: { S: [2.03, 0.66], t: [-0.51, 0.86], ys: [0.42, 0.35] },
  skirt: { y: 0.255, x0: -0.70, x1: 0.90, z0: 0.79, z1: 0.87 },
  diff: { x0: -1.72, x1: -1.98, x2: -2.13, y0: 0.29, y1: 0.305, y2: 0.36, w: 0.55, fin0: -1.82 },
};

export const AE86_SPEC = {
  look: AE86_LOOK, paint: '#f1f2ee', metal: 0.05, seat: 0x1c1d20,
  wheels: { xf: 1.3025, xr: -1.0975, R: 0.289, rim: 0.1778, trackF: 0.6775, trackR: 0.6725, wF: 0.185, wR: 0.185, style: AE86_wheel },
  mirror: (paint, mats, s) => { const m = mirrorR34(mats.gloss, mats, s); m.position.set(0.56, 0.985, s * 0.69); m.scale.set(0.95, 1.0, 0.9); return m; },
  wings: {
    stock: (paint) => AE86_roofSpoiler(paint),
    none: () => new THREE.Group(),
  },
  wing: 'none',
  interior: { dx: -0.02, cage: false, wheelZ: 0.36, dashX: 0.50, dashY: 0.86, bench: { x: -0.82, shelfX: -1.45, shelfY: 0.965 } },
  build(body, paint, mats) { // 套件：原廠（照片那台）、賽道（碳纖維前下巴＋風刀＋側裙刀片＋擴散器）
    body.add(AE86_tip(mats, -2.06, 0.30, -0.45));
    const aero = aeroKit(mats, AE86_AERO); aero.visible = false; body.add(aero);
    return (kit) => { aero.visible = kit === 'track'; };
  },
  kit: 'stock',
};

// 照片相機（疊圖用，ae863d/silfit.mjs：輪子中心＋車身輪廓擬合）：
// photo1＝拉花那台車頭右前（跳燈打開，1280×766）、photo2＝白黑那台左前（跳燈關著，1280×959）、photo3＝拉花那台右後（1280×805）、
// photo4＝白黑那台右後（1280×915）、photo5＝另一台黑色的正側面（1280×852，降低了大約 5 公分）
export const AE86_CAMS = {
  photo1: { a: -27.888, d: 4.159, h: 1.182, tx: 1.059, ty: 0.795, fov: 30.38, rl: 3.544 },
  photo2: { a: 26.616, d: 4.62, h: 1.36, tx: 0.959, ty: 0.554, fov: 30.085, rl: -0.679 },
  photo3: { a: -155.766, d: 6.102, h: 1.568, tx: -1.003, ty: 0.887, fov: 20.949, rl: 0.041 },
  photo4: { a: -136.451, d: 2.694, h: 1.533, tx: -0.888, ty: 0.389, fov: 43.612, rl: -0.19 }, // 近拍、廣角（點擬合：輪子、尾燈角、側窗後角）
  photo5: { a: 89.795, d: 25, h: 1.3, tx: -0.037, ty: 0.897, fov: 14.077, rl: 0.01 },
};

export const AE86_GARAGE = {
  name: '86 豆腐車', sub: '黑白豆腐車 · 3D 試做版',
  paints: [['#f1f2ee', '白'], ['#121316', '黑'], ['#b3141c', '紅'], ['#b8bcc1', '銀'], ['#5b6067', '鐵灰'], ['#1d3f8e', '藍'], ['#e8b81c', '黃']],
  opts: {
    wing: [['none', '不要'], ['stock', '車頂小擾流']],
    kit: [['stock', '原廠'], ['track', '賽道']],
    height: [['0', '原廠'], ['-0.03', '降低'], ['-0.05', '貼地']],
    livery: [['panda', '黑白'], ['tofu', '豆腐店'], ['none', '不要']],
  },
  state: { paint: '#f1f2ee', rim: 'gunmetal', caliper: '#6b6e72', wing: 'none', kit: 'stock', height: '0', livery: 'panda', tint: 'light' },
};
