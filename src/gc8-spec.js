// 3D Subaru Impreza WRX STI coupe（GC8）的設定：輪子（金色六輻）、STI 高尾翼、後照鏡、排氣管、引擎蓋進氣口、賽道套件、車庫選項
import * as THREE from 'three';
import { mirrorR34, aeroKit } from './parts.js';
import { GC8_LOOK } from './gc8-look.js';

// 照片那台的輪框：六根寬寬的直輻條（Speedline 拉力賽風格），從中間往外微微凸出來
export function GC8_spokes(rim, w, mats) {
  const g = new THREE.Group();
  const ri = 0.068, ro = rim - 0.006, zi = w / 2 - 0.062, zo = w / 2 - 0.022;
  const len = ro - ri, tilt = Math.atan2(zo - zi, len);
  const sh = new THREE.Shape(); // 輻條（徑向長度 len，中間寬、外面稍窄）
  sh.moveTo(0, -0.036); sh.lineTo(len, -0.03); sh.lineTo(len, 0.03); sh.lineTo(0, 0.036); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2 });
  geo.translate(0, 0, -0.02);
  for (let j = 0; j < 6; j++) {
    const arm = new THREE.Group(); arm.rotation.z = (j * Math.PI) / 3 + Math.PI / 2;
    const m = new THREE.Mesh(geo, mats.chrome); m.position.set(ri, 0, zi); m.rotation.y = -tilt;
    arm.add(m); g.add(arm);
  }
  // 中間的輪轂（跟輪框同色）＋外圈薄薄的一圈
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.1, 0.045, 48), mats.chrome);
  hub.geometry.rotateX(Math.PI / 2); hub.position.z = zi - 0.004; g.add(hub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ro + 0.004, 0.005, 8, 96), mats.chrome);
  ring.position.z = zo + 0.008; g.add(ring);
  return g;
}
GC8_spokes.capInset = 0.055;

// STI 高尾翼：兩片大的側板（也是支柱）從行李箱斜斜往上，中間一片厚的翼片，全部車身色
export function GC8_stiWing(paint, mats, { x = -2.03, y = 1.205, span = 1.20, chord = 0.25, zp = 0.60 } = {}) {
  const g = new THREE.Group();
  const s = new THREE.Shape(), N = 20, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, xc = (1 - Math.cos(Math.PI * t)) / 2;
    const th = 0.16 * 5 * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
    const camber = 0.03 * Math.sin(Math.PI * xc);
    top.push([xc, camber + th]); bot.push([xc, camber - th]);
  }
  const P = (p) => [(-p[0] + 0.5) * chord, p[1] * chord];
  s.moveTo(...P(top[0])); for (const p of top.slice(1)) s.lineTo(...P(p)); for (const p of bot.slice().reverse().slice(1)) s.lineTo(...P(p));
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: span, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 3, curveSegments: 4 }), paint);
  blade.geometry.translate(0, 0, -span / 2); blade.rotation.z = -0.07; blade.position.set(x, y, 0); g.add(blade);
  // 側板：前緣從行李箱往後上方斜，後緣幾乎垂直（照片 1 量的）
  const ep = new THREE.Shape();
  ep.moveTo(-1.76, 0.962); ep.lineTo(-1.84, 1.03); ep.quadraticCurveTo(-1.95, 1.20, -1.975, 1.255); ep.quadraticCurveTo(-1.99, 1.275, -2.03, 1.272);
  ep.lineTo(-2.12, 1.255); ep.quadraticCurveTo(-2.145, 1.25, -2.14, 1.22); ep.lineTo(-2.10, 1.05); ep.quadraticCurveTo(-2.09, 0.995, -2.05, 0.948); ep.closePath(); // 底邊貼著行李箱蓋、稍微插進去一點（原本浮 2 公分）
  const epGeo = new THREE.ExtrudeGeometry(ep, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 10 });
  for (const sz of [-1, 1]) { const e = new THREE.Mesh(epGeo, paint); e.position.z = sz * zp - 0.011; g.add(e); }
  return g;
}

// 圓的排氣管尾端（左後）
export function GC8_tip(mats, x, y, z) {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.16, 32, 1, true), mats.alu);
  tube.geometry.rotateZ(Math.PI / 2); tube.material.side = THREE.DoubleSide; g.add(tube);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.041, 32), mats.black);
  inner.rotation.y = -Math.PI / 2; inner.position.x = -0.04; g.add(inner);
  g.position.set(x, y, z);
  return g;
}

export const GC8_AERO = {
  front: [[2.19, 0], [2.18, 0.30], [2.14, 0.50], [2.07, 0.66], [1.97, 0.765], [1.86, 0.82]], back: 1.90, y: 0.19, rods: [2.12, 0.245],
  canard: { S: [2.0, 0.70], t: [-0.67, 0.74], ys: [0.32, 0.245] },
  skirt: { y: 0.18, x0: -0.86, x1: 0.84, z0: 0.84, z1: 0.935 },
  diff: { x0: -1.80, x1: -2.02, x2: -2.19, y0: 0.255, y1: 0.27, y2: 0.315, w: 0.62, fin0: -1.90 },
};

export const GC8_SPEC = {
  look: GC8_LOOK, paint: '#1a4cc0', metal: 0.4, seat: 0x1c1d20,
  wheels: { xf: 1.28, xr: -1.24, R: 0.307, rim: 0.2286, trackF: 0.7625, trackR: 0.7575, wF: 0.225, wR: 0.225, style: GC8_spokes },
  mirror: (paint, mats, s) => { const m = mirrorR34(paint, mats, s); m.position.set(0.60, 0.95, s * 0.755); m.scale.set(1.05, 1.0, 1.0); return m; },
  wings: { sti: (paint, mats) => GC8_stiWing(paint, mats) },
  wing: 'sti',
  interior: { dx: 0.03, cage: false, wheelZ: 0.37, dashX: 0.52, dashY: 0.86, bench: { x: -0.92, shelfX: -1.30, shelfY: 0.975 } },
  build(body, paint, mats) { // 套件：原廠（照片那台）、賽道（前下巴＋風刀＋側裙刀片＋擴散器）
    body.add(GC8_tip(mats, -2.10, 0.27, -0.40));
    // 引擎蓋進氣口、兩個小導風口裡面是黑的
    const ins = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.034, 0.48), mats.black);
    ins.position.set(1.345, 0.882, 0); body.add(ins);
    for (const s of [-1, 1]) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.016, 0.11), mats.black); v.position.set(1.68, 0.812, s * 0.485); body.add(v); }
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
