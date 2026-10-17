// 3D Mazda RX-7（FD3S）的設定：輪子（原廠 16 吋五輻，輻條微微掃過去）、後照鏡、原廠低尾翼（拱形）、後期 RS 高尾翼、雙排氣管、賽道套件、車庫選項
// 車身是 rx7-body.mjs 切出來的 body-rx7(-q).glb，表面細節在 rx7-look.js。車庫裡的名字是自己編的「R7 轉子」，沒有廠牌字。
import * as THREE from 'three';
import { mirror, aeroKit } from './parts.js';
import { RX7_LOOK } from './rx7-look.js';

// 輪框：原廠 16 吋五輻（照片 1、3），每根輻條從輪轂往外微微掃過去、越外面越細，輪轂那邊比較寬
export function RX7_wheel(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.012, ri = 0.075, rA = 0.092, rB = ro - 0.016, sweep = 0.20;
  const ang = (j, r) => (j * 2 * Math.PI) / 5 + Math.PI / 2 + sweep * Math.pow(Math.max(0, (r - rA) / (rB - rA)), 1.3);
  const hw = (r) => 0.034 - 0.011 * Math.max(0, (r - rA) / (rB - rA)); // 輻條半寬（弧長）
  const disc = new THREE.Shape(); disc.absarc(0, 0, ro, 0, Math.PI * 2, false);
  for (let j = 0; j < 5; j++) {
    const pts = [], n = 14;
    for (let i = 0; i <= n; i++) { const r = rA + ((rB - rA) * i) / n, a = ang(j, r) + hw(r) / r; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const o0 = ang(j, rB) + hw(rB) / rB, o1 = ang(j + 1, rB) - hw(rB) / rB;
    for (let i = 1; i < 12; i++) { const a = o0 + ((o1 - o0) * i) / 12; pts.push([Math.cos(a) * rB, Math.sin(a) * rB]); }
    for (let i = n; i >= 0; i--) { const r = rA + ((rB - rA) * i) / n, a = ang(j + 1, r) - hw(r) / r; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const i0 = ang(j + 1, rA) - hw(rA) / rA, i1 = ang(j, rA) + hw(rA) / rA;
    for (let i = 1; i < 6; i++) { const a = i0 + ((i1 - i0) * i) / 6; pts.push([Math.cos(a) * rA, Math.sin(a) * rA]); }
    const hole = new THREE.Path(); hole.moveTo(...pts[0]); for (const p of pts.slice(1)) hole.lineTo(...p); hole.closePath();
    disc.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(disc, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2, curveSegments: 72 });
  const face = new THREE.Mesh(geo, mats.chrome); face.position.z = w / 2 - 0.038; g.add(face);
  // 中間的輪轂
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(rA + 0.004, rA + 0.01, 0.03, 48), mats.chrome);
  hub.geometry.rotateX(Math.PI / 2); hub.position.z = w / 2 - 0.052; g.add(hub);
  return g;
}
RX7_wheel.capInset = 0.012;

// 拱形尾翼（早期原廠低尾翼）：兩端從掀背門往上彎過來接成一片翼，整支車身色（照片 1、2）
export function RX7_hoop(paintMat, { z = 0.57, top = 1.01, foot = 0.88, bend = 0.065, th = 0.04 } = {}) {
  const le = (y) => -1.80 - 0.10 * Math.max(0, Math.min(1, (top - y) / (top - foot))); // 前緣 x：上面 -1.80、腳 -1.90
  const te = (y) => -2.00 + 0.02 * Math.max(0, Math.min(1, (top - y) / (top - foot)));
  const yc = top - bend, path = [];
  for (let i = 0; i <= 8; i++) path.push([-z, foot + ((yc - foot) * i) / 8]);
  for (let i = 1; i <= 10; i++) { const a = Math.PI - (Math.PI / 2) * (i / 10); path.push([-z + bend + bend * Math.cos(a), yc + bend * Math.sin(a)]); }
  for (let i = 1; i < 16; i++) path.push([-z + bend + (2 * (z - bend) * i) / 16, top]);
  for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 - (Math.PI / 2) * (i / 10); path.push([z - bend + bend * Math.cos(a), yc + bend * Math.sin(a)]); }
  for (let i = 1; i <= 8; i++) path.push([z, yc - ((yc - foot) * i) / 8]);
  const K = 12, us = [], ring = [];
  for (let k = 0; k <= K; k++) us.push((1 - Math.cos((Math.PI * k) / K)) / 2);
  const tk = (u) => 5 * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4) / 0.6;
  for (const u of us) ring.push([u, 1]);
  for (const u of us.slice(1, -1).reverse()) ring.push([u, -1]);
  const pos = [], idx = [], cols = ring.length + 1;
  path.forEach(([pz, py], i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    let tz = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tz, ty); tz /= l; ty /= l;
    const nz = -ty, ny = tz, x0 = le(py), ch = te(py) - x0;
    for (let j = 0; j <= ring.length; j++) {
      const [u, sg] = ring[j % ring.length], t = (th / 2) * tk(u) * sg, lift = 0.012 * Math.sin(Math.PI * u); // 微微往上拱（翼剖面）
      pos.push(x0 + ch * u, py + ny * (t + lift), pz + nz * (t + lift));
    }
  });
  for (let i = 0; i < path.length - 1; i++) for (let j = 0; j < cols - 1; j++) { const a = i * cols + j, b = a + cols; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, paintMat));
  return g;
}

// 後期 RS 高尾翼（照片 4）：一片大翼板，兩端立著車身色的大鰭（下面貼在後葉子板上面），翼板兩端有圓圓的端蓋
export function RX7_rsWing(paintMat, mats, { span = 1.40, chord = 0.25, x = -1.93, y = 0.985, zp = 0.66 } = {}) {
  const g = new THREE.Group();
  const s = new THREE.Shape(), N = 20, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, xc = (1 - Math.cos(Math.PI * t)) / 2;
    const thk = 0.13 * 5 * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
    const camber = 0.035 * Math.sin(Math.PI * xc);
    top.push([xc, camber + thk]); bot.push([xc, camber - thk]);
  }
  const P = (p) => [(-p[0] + 0.5) * chord, p[1] * chord];
  s.moveTo(...P(top[0])); for (const p of top.slice(1)) s.lineTo(...P(p)); for (const p of bot.slice().reverse().slice(1)) s.lineTo(...P(p));
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: span, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 3, curveSegments: 4 }), paintMat);
  blade.geometry.translate(0, 0, -span / 2); blade.rotation.z = -0.10; blade.position.set(x, y, 0); g.add(blade);
  // 鰭（側面形狀 x, y）：前緣從後葉子板斜斜往上，上面接翼板、後面圓角往下
  const ep = new THREE.Shape();
  ep.moveTo(-1.74, 0.86); ep.lineTo(-1.78, 0.93); ep.quadraticCurveTo(-1.80, 0.98, -1.78, 1.005); ep.lineTo(-1.95, 1.03);
  ep.quadraticCurveTo(-2.07, 1.025, -2.09, 0.985); ep.quadraticCurveTo(-2.095, 0.95, -2.07, 0.92); ep.lineTo(-2.03, 0.86); ep.closePath();
  const epGeo = new THREE.ExtrudeGeometry(ep, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 3, curveSegments: 10 });
  for (const sz of [-1, 1]) { const e = new THREE.Mesh(epGeo, paintMat); e.position.z = sz * zp - 0.015; g.add(e); }
  return g;
}

// 圓的排氣管（右後，兩支並排）
function RX7_tip(mats, x, y, z) {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.14, 32, 1, true), mats.pipe);
  tube.geometry.rotateZ(Math.PI / 2); g.add(tube);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.004, 8, 32), mats.pipe);
  lip.rotation.y = Math.PI / 2; lip.position.x = -0.07; g.add(lip);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.039, 32), mats.black);
  inner.rotation.y = -Math.PI / 2; inner.position.x = -0.035; g.add(inner);
  g.position.set(x, y, z);
  return g;
}

// 前下巴：黑色橡膠唇，沿著保桿下緣往前凸一點、包到前輪前面（照片 1、2 都有）
function RX7_chin(mats) {
  const F = [[2.12, 0], [2.116, 0.15], [2.11, 0.30], [2.09, 0.42], [2.05, 0.52], [2.004, 0.60], [1.944, 0.67], [1.87, 0.73], [1.76, 0.795], [1.64, 0.83]];
  const sh = new THREE.Shape(), back = 1.60;
  sh.moveTo(back, -0.83); sh.lineTo(F[F.length - 1][0], -F[F.length - 1][1]);
  sh.splineThru(F.slice(0, -1).reverse().map(([x, z]) => new THREE.Vector2(x, -z)));
  sh.splineThru(F.slice(1).map(([x, z]) => new THREE.Vector2(x, z)));
  sh.lineTo(back, 0.83); sh.closePath();
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 2, curveSegments: 24 }), mats.black);
  m.rotation.x = Math.PI / 2; m.position.y = 0.205; // 上面 0.213、下面 0.152（含圓角）
  const g = new THREE.Group(); g.add(m);
  return g;
}

export const RX7_AERO = {
  front: [[2.19, 0], [2.185, 0.25], [2.15, 0.42], [2.10, 0.53], [2.04, 0.62], [1.96, 0.70], [1.86, 0.77]], back: 1.80, y: 0.172, rods: [2.12, 0.215],
  canard: { S: [1.95, 0.625], t: [-0.67, 0.74], ys: [0.30, 0.24] },
  skirt: { y: 0.175, x0: -0.80, x1: 0.80, z0: 0.83, z1: 0.92 },
  diff: { x0: -1.70, x1: -1.95, x2: -2.12, y0: 0.26, y1: 0.275, y2: 0.32, w: 0.60, fin0: -1.78 },
};

export const RX7_SPEC = {
  look: RX7_LOOK, paint: '#c8101c', metal: 0.12, seat: 0x1c1d20,
  wheels: { xf: 1.21, xr: -1.215, R: 0.316, rim: 0.2032, trackF: 0.73, trackR: 0.73, wF: 0.225, wR: 0.225, style: RX7_wheel },
  mirror: (paint, mats, s) => { const m = mirror(paint, mats, s); m.position.set(0.20, 0.885, s * 0.755); m.scale.set(1.05, 1.0, 1.0); return m; },
  wings: {
    stock: (paint) => RX7_hoop(paint),
    rs: (paint, mats) => RX7_rsWing(paint, mats),
    none: () => new THREE.Group(),
  },
  wing: 'stock',
  interior: { dx: -0.06, cage: false, wheelZ: -0.36, dashX: 0.30, dashY: 0.74, seatDy: -0.07, shelf: false },
  build(body, paint, mats) { // 套件：原廠（黑色前下巴）、賽道（碳纖維大下巴＋風刀＋側裙刀片＋擴散器）
    mats.pipe = new THREE.MeshPhysicalMaterial({ color: 0xc4c6c9, roughness: 0.22, metalness: 1, side: THREE.DoubleSide });
    for (const z of [0.38, 0.47]) body.add(RX7_tip(mats, -2.04, 0.29, z));
    const chin = RX7_chin(mats); body.add(chin);
    const aero = aeroKit(mats, RX7_AERO); aero.visible = false; body.add(aero);
    return (kit) => { chin.visible = kit !== 'track'; aero.visible = kit === 'track'; };
  },
  kit: 'stock',
};

// 照片相機（rx73d/fit.mjs、fit2.mjs 擬合）：photo1＝左前（1280×821，1994 紅色）、photo2＝右前（1280×823，1993 酒紅、車身降低）、
// photo3＝左後（1280×853，1993 紅色、沒有尾翼）、photo4＝左後（1280×960，後期紅色、RS 高尾翼）
export const RX7_CAMS = {
  photo1: { a: 44.19, d: 6.144, h: 1.481, tx: 0.312, ty: 0.59, fov: 22.6, rl: -1.6 },
  photo2: { a: -37.997, d: 3.617, h: 1.316, tx: 0.845, ty: 0.542, fov: 32.463, rl: 2.852 },
  photo3: { a: 140.542, d: 4.549, h: 1.184, tx: -0.515, ty: 0.403, fov: 34.524, rl: 3.768 },
  photo4: { a: 140.663, d: 3.283, h: 1.294, tx: -0.897, ty: 0.713, fov: 47.853, rl: 2.6 },
};

export const RX7_GARAGE = {
  name: 'R7 轉子', sub: '紅色轉子跑車 · 3D 試做版',
  paints: [['#c8101c', '經典紅'], ['#f1f1ee', '白'], ['#0f1012', '黑'], ['#f2c400', '競技黃'], ['#b9bdc1', '銀'], ['#2a52ad', '亮藍'],
    ['#1b3566', '深藍'], ['#5a1722', '酒紅'], ['#1f5a46', '綠']],
  opts: {
    wing: [['stock', '原廠'], ['rs', 'RS 高尾翼'], ['none', '不要']],
    kit: [['stock', '原廠'], ['track', '賽道']],
    height: [['0', '原廠'], ['-0.03', '降低'], ['-0.05', '貼地']],
    livery: [['rotor', '轉子圖案'], ['none', '不要']],
  },
  state: { paint: '#c8101c', rim: 'chrome', caliper: '#9da1a6', wing: 'stock', kit: 'stock', height: '0', livery: 'none', tint: 'light' },
};
