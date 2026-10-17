// 3D Civic Type R FK8：輪子（20 吋黑色五組 Y 形雙輻、輪唇一圈紅線）、同色後照鏡、原廠大尾翼（兩片同色大端板＋亮黑主翼）、
// 中間三支排氣管、車頂後緣的整流鰭片、引擎蓋進氣口的黑色開口、賽道套件
// 車身是 civic-body.mjs 切出來的 body-civic(-q).glb，表面細節在 civic-look.js。遊戲裡的名字是編的（沒有真的廠牌、車標）。
import * as THREE from 'three';
import { mirror, aeroKit, slab } from './parts.js';
import { CIVIC_LOOK } from './civic-look.js';

// 輪框：20 吋，五組 Y 形雙輻（每組兩根從輪轂分開到外緣），輻條往外緣微微往外凸；輪唇內側一圈紅線（只有原廠輪框有）
function CIVIC_wheel(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.012, rh = 0.07, zo = w / 2 - 0.026, zi = w / 2 - 0.068, rs = 0.135; // rs：Y 分叉的地方
  const P = (r, ang, z, off) => [Math.cos(ang) * r - Math.sin(ang) * off, Math.sin(ang) * r + Math.cos(ang) * off, z];
  const zs = zo - 0.008;
  for (let j = 0; j < 5; j++) {
    const a = (j * 2 * Math.PI) / 5 + Math.PI / 2;
    g.add(new THREE.Mesh(slab([P(rh, a, zi, -0.026), P(rs + 0.01, a, zs, -0.022), P(rs + 0.01, a, zs, 0.022), P(rh, a, zi, 0.026)], 0.026), mats.chrome)); // Y 的根（粗）
    for (const s of [-1, 1]) {
      const ai = a + s * 0.085, ao = a + s * 0.25; // 分成兩根，到外緣分開
      g.add(new THREE.Mesh(slab([P(rs - 0.01, ai, zs, -0.0135), P(ro, ao, zo, -0.0105), P(ro, ao, zo, 0.0105), P(rs - 0.01, ai, zs, 0.0135)], 0.024), mats.chrome));
    }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.09, 0.04, 40), mats.chrome);
  hub.geometry.rotateX(Math.PI / 2); hub.position.z = zi + 0.006; g.add(hub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ro + 0.003, 0.006, 8, 96), mats.chrome);
  ring.position.z = zo + 0.004; g.add(ring);
  mats.civRed ??= new THREE.MeshPhysicalMaterial({ color: 0xc8101c, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }); // 紅色細線（四個輪子共用）
  const red = new THREE.Mesh(new THREE.TorusGeometry(ro + 0.009, 0.0028, 6, 120), mats.civRed);
  red.position.z = zo + 0.009; g.add(red);
  return g;
}
CIVIC_wheel.capInset = 0.055;
// 原廠大尾翼：尾燈上面、尾門兩邊各一片同色的直立端板（下面往後踢一個腳），上面一片亮黑的主翼
// 位置從照片 2（側面）和照片 3（左後）兩張一起量的（civic3d/tri.mjs、bp.mjs）：端板在 z ±0.64，
// 上緣前 (-1.93, 1.355) 後 (-2.18, 1.375)，下緣前 (-1.86, 1.15)、後腳尖 (-2.30, 1.14)
function CIVIC_wing(paint, mats) {
  const g = new THREE.Group();
  const zAt = () => 0.64;
  const ep = new THREE.Shape(); // 端板側面（x, y）
  ep.moveTo(-1.925, 1.358); ep.lineTo(-2.165, 1.378); ep.quadraticCurveTo(-2.19, 1.376, -2.19, 1.35); ep.lineTo(-2.188, 1.215);
  ep.lineTo(-2.30, 1.148); ep.quadraticCurveTo(-2.305, 1.128, -2.28, 1.126); ep.lineTo(-2.10, 1.125); ep.lineTo(-1.87, 1.135);
  ep.quadraticCurveTo(-1.845, 1.14, -1.85, 1.17); ep.closePath();
  for (const sz of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(ep, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.007, bevelSegments: 2, curveSegments: 6 }), paint);
    m.geometry.translate(0, 0, sz * 0.64 - 0.012); g.add(m);
  }
  // 主翼：倒過來的機翼剖面，亮黑；弦長 0.24，在端板上段後半，前緣低一點；翼展跟著兩片端板（前面寬、後面窄）
  const chord = 0.22, s = new THREE.Shape(), N = 18, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const xc = (1 - Math.cos((Math.PI * i) / N)) / 2;
    const th = 0.12 * 5 * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
    const cam = -0.045 * Math.sin(Math.PI * xc);
    top.push([xc, cam + th]); bot.push([xc, cam - th]);
  }
  const PP = (p) => [(-p[0] + 0.5) * chord, p[1] * chord];
  s.moveTo(...PP(top[0])); for (const p of top.slice(1)) s.lineTo(...PP(p)); for (const p of bot.slice().reverse().slice(1)) s.lineTo(...PP(p));
  const bg = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 4 }); bg.translate(0, 0, -0.5);
  const cx = -2.06, cy = 1.352, ang = -0.10, c = Math.cos(ang), sn = Math.sin(ang), pos = bg.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i), ly = pos.getY(i), lz = pos.getZ(i), X = cx + lx * c - ly * sn;
    pos.setXYZ(i, X, cy + lx * sn + ly * c, lz * 2 * (zAt(X) - 0.012));
  }
  bg.computeVertexNormals(); g.add(new THREE.Mesh(bg, mats.gloss));
  return g;
}

// 排氣管：中間三支（兩邊大、中間小），亮的管口、裡面黑
function CIVIC_pipe(mats, z, r) {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 28, 1, true), mats.pipe);
  tube.geometry.rotateZ(Math.PI / 2); g.add(tube);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r, 0.004, 8, 28), mats.pipe);
  lip.rotation.y = Math.PI / 2; lip.position.x = -0.08; g.add(lip);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(r - 0.004, 28), mats.black);
  inner.rotation.y = -Math.PI / 2; inner.position.x = -0.04; g.add(inner);
  g.position.set(-2.215, 0.285, z);
  return g;
}

export const CIVIC_AERO = {
  front: [[2.20, 0], [2.19, 0.25], [2.155, 0.45], [2.085, 0.62], [1.985, 0.76], [1.89, 0.85]], back: 1.88, y: 0.152, rods: [2.15, 0.18],
  canard: { S: [1.96, 0.80], t: [-0.60, 0.80], ys: [0.43, 0.33] },
  skirt: { y: 0.162, x0: -0.98, x1: 0.86, z0: 0.86, z1: 0.955 },
  diff: { x0: -1.95, x1: -2.20, x2: -2.33, y0: 0.18, y1: 0.20, y2: 0.24, w: 0.40, fin0: -2.0 },
};

export const CIVIC_SPEC = {
  look: CIVIC_LOOK, paint: '#c8102e', metal: 0.08, seat: 0xb3121b,
  wheels: { xf: 1.29, xr: -1.41, R: 0.3275, rim: 0.254, trackF: 0.80, trackR: 0.7975, wF: 0.245, wR: 0.245, style: CIVIC_wheel },
  mirror: (paint, mats, s) => {
    const g = new THREE.Group(), m = mirror(paint, mats, s); m.scale.set(1.3, 1.45, 1.3); g.add(m);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.035, 0.10), mats.black); arm.position.set(0.03, -0.035, s * 0.05); g.add(arm); // 黑色底座
    g.position.set(0.63, 1.045, s * 0.855);
    return g;
  },
  wings: {
    stock: (paint, mats) => CIVIC_wing(paint, mats),
    none: () => new THREE.Group(),
  },
  wing: 'stock',
  interior: { dx: 0.0, cage: false, wheelZ: -0.37, dashX: 0.62, dashY: 0.92, bench: { x: -0.88, shelfX: -1.55, shelfY: 1.06 } },
  build(body, paint, mats) { // 套件：原廠（什麼都不加）、賽道（碳纖維前下巴＋風刀＋側裙刀片＋擴散器）
    mats.pipe = new THREE.MeshPhysicalMaterial({ color: 0xc4c0b8, roughness: 0.22, metalness: 1, side: THREE.DoubleSide });
    for (const [z, r] of [[-0.118, 0.05], [0, 0.04], [0.118, 0.05]]) body.add(CIVIC_pipe(mats, z, r));
    // 引擎蓋進氣口的開口（黑色，朝前，x 1.30）
    const scoop = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.024), mats.black);
    scoop.rotation.y = Math.PI / 2; scoop.position.set(1.302, 1.032, 0); body.add(scoop);
    // 車頭的黑色車牌底座位置沒有車牌（空白）；車頂後緣的整流鰭片（九片，跟車身同色）
    const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(-0.075, 0); fin.lineTo(-0.075, 0.022); fin.quadraticCurveTo(-0.03, 0.02, 0, 0);
    const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.006, bevelEnabled: false });
    for (let i = -4; i <= 4; i++) { const f = new THREE.Mesh(fg, paint); f.position.set(-1.565, 1.388 - Math.abs(i) * 0.0045, i * 0.085 - 0.003); body.add(f); }
    const aero = aeroKit(mats, CIVIC_AERO); aero.visible = false; body.add(aero);
    return (kit) => { aero.visible = kit === 'track'; };
  },
  kit: 'stock',
};

// 照片相機（civic3d/fit.mjs、fit1.mjs、fitr.mjs 擬合）：photo1＝紅色車頭左前（1280×853）、photo2＝白色左前（1280×960）、
// photo3＝白色左後（1280×946）、photo4＝白色右後（1280×823，那台裝了別的尾翼和輪框）
export const CIVIC_CAMS = {
  photo1: { a: 35.787, d: 3.415, h: 1.132, tx: 0.949, ty: 0.56, fov: 34.938, rl: -3.588 },
  photo2: { a: 34.87, d: 13.274, h: 0.688, tx: 0.151, ty: 0.812, fov: 14.726, rl: -3.157 },
  photo3: { a: 144.825, d: 2.743, h: 1.396, tx: -1.182, ty: 0.491, fov: 43.479, rl: 2.771 },
  photo4: { a: -144.529, d: 4.905, h: 1.405, tx: -0.875, ty: 0.629, fov: 26.367, rl: -2.031 },
};

export const CIVIC_GARAGE = {
  name: 'FK 大尾翼', sub: '紅色大尾翼掀背車 · 3D 試做版',
  paints: [['#c8102e', '拉力紅'], ['#eeeeea', '冠軍白'], ['#111316', '水晶黑'], ['#5e6266', '金屬灰'], ['#8d9298', '音速灰'],
    ['#1f3f8f', '愛琴海藍'], ['#2a5cc8', '衝刺藍'], ['#f2c200', '陽光黃']],
  opts: {
    wing: [['stock', '原廠大尾翼'], ['none', '不要']],
    kit: [['stock', '原廠'], ['track', '賽道']],
    height: [['0', '原廠'], ['-0.03', '降低'], ['-0.05', '貼地']],
    livery: [['redline', '紅色細線'], ['none', '不要']],
  },
  state: { paint: '#c8102e', rim: 'black', caliper: '#c8141e', wing: 'stock', kit: 'stock', height: '0', livery: 'redline', tint: 'light' },
};
