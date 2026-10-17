// 3D Lancer Evolution IX（CT9A）的設定：輪子（十輻鍛造鋁圈，槍灰色）、高尾翼（兩片鯊魚鰭支架＋碳纖維翼片）、
// 後照鏡、右邊一支大排氣管、尾燈下面的橘色方向燈條、車頂天線、賽道套件、車庫選項。
// 車身是 evo-body.mjs 切出來的 body-evo(-q).glb，表面細節在 evo-look.js。車上沒有任何廠牌字、徽章。
import * as THREE from 'three';
import { mirrorR34, aeroKit, slab } from './parts.js';
import { EVO_LOOK } from './evo-look.js';

// 輪框：17 吋十根細直輻條（Enkei 那種），輻條從輪轂往外微微往外凸、外緣接到輪框邊
export function EVO_wheel(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.008, rh = 0.068, zo = w / 2 - 0.024, zi = w / 2 - 0.07;
  for (let j = 0; j < 10; j++) {
    const a = (j * 2 * Math.PI) / 10 + Math.PI / 2;
    const P = (r, z, off) => [Math.cos(a) * r - Math.sin(a) * off, Math.sin(a) * r + Math.cos(a) * off, z];
    const wi = 0.0125, wo = 0.009;
    g.add(new THREE.Mesh(slab([P(rh, zi, -wi), P(ro, zo, -wo), P(ro, zo, wo), P(rh, zi, wi)], 0.022), mats.chrome));
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.096, 0.045, 40), mats.chrome);
  hub.geometry.rotateX(Math.PI / 2); hub.position.z = zi + 0.002; g.add(hub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ro + 0.002, 0.006, 8, 96), mats.chrome);
  ring.position.z = zo + 0.006; g.add(ring);
  return g;
}
EVO_wheel.capInset = 0.06;

// 原廠高尾翼：兩片跟車身同色的鯊魚鰭支架（前緣往後斜、上面平），上面一片薄薄的碳纖維翼片
// 位置：照片 2、3 的像素打到 z＝±0.60 的平面（evo3d/bp.mjs），兩張照片取中間
export function EVO_wing(paint, mats, { zp = 0.60 } = {}) {
  const g = new THREE.Group();
  const fin = new THREE.Shape(); // 側面形狀（x, y）
  fin.moveTo(-1.74, 0.95); fin.lineTo(-1.80, 0.985);
  fin.bezierCurveTo(-1.86, 1.06, -1.91, 1.17, -1.955, 1.232);
  fin.quadraticCurveTo(-1.965, 1.248, -1.99, 1.25);
  fin.lineTo(-2.13, 1.252); fin.quadraticCurveTo(-2.16, 1.25, -2.158, 1.225);
  fin.lineTo(-2.10, 1.03); fin.quadraticCurveTo(-2.085, 0.975, -2.04, 0.96); fin.closePath();
  const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 3, curveSegments: 12 });
  fg.translate(0, 0, -0.015);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(fg, paint); m.position.z = s * zp; g.add(m); }
  // 翼片：倒過來的機翼剖面，前緣低一點
  const chord = 0.17, span = 2 * zp + 0.04, sh = new THREE.Shape(), N = 16, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, xc = (1 - Math.cos(Math.PI * t)) / 2;
    const th = 0.09 * 5 * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
    const camber = -0.03 * Math.sin(Math.PI * xc);
    top.push([xc, camber + th]); bot.push([xc, camber - th]);
  }
  const P = (p) => [(-p[0] + 0.5) * chord, p[1] * chord];
  sh.moveTo(...P(top[0])); for (const p of top.slice(1)) sh.lineTo(...P(p)); for (const p of bot.slice().reverse().slice(1)) sh.lineTo(...P(p));
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: span, bevelEnabled: false, curveSegments: 4 }), mats.carbon);
  blade.geometry.translate(0, 0, -span / 2); blade.rotation.z = -0.06; blade.position.set(-2.07, 1.262, 0); g.add(blade);
  return g;
}

// 一支大的圓排氣管（右後，從擴散器旁邊伸出來）
export function EVO_exhaust(mats, x, y, z) {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.18, 36, 1, true), mats.pipe);
  tube.geometry.rotateZ(Math.PI / 2); g.add(tube);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.005, 8, 36), mats.pipe);
  lip.rotation.y = Math.PI / 2; lip.position.x = -0.09; g.add(lip);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.052, 36), mats.black);
  inner.rotation.y = -Math.PI / 2; inner.position.x = -0.05; g.add(inner);
  g.position.set(x, y, z);
  return g;
}

// 尾燈下面的橘色方向燈條：沿著車身表面的一條帶子（點是 evo3d/amber.mjs 從車身 SDF 量的：每一排［上, 下］，右邊；左邊鏡射）
export const EVO_AMBER = [[[-2.19, 0.758, 0.548], [-2.19, 0.748, 0.548]], [[-2.187, 0.758, 0.563], [-2.188, 0.747, 0.563]], [[-2.184, 0.758, 0.577], [-2.185, 0.746, 0.577]], [[-2.181, 0.759, 0.592], [-2.181, 0.744, 0.592]], [[-2.177, 0.759, 0.606], [-2.177, 0.742, 0.606]], [[-2.172, 0.759, 0.621], [-2.173, 0.741, 0.621]], [[-2.167, 0.759, 0.635], [-2.167, 0.739, 0.635]], [[-2.161, 0.759, 0.65], [-2.162, 0.737, 0.65]], [[-2.155, 0.76, 0.664], [-2.155, 0.735, 0.664]], [[-2.147, 0.76, 0.679], [-2.147, 0.732, 0.679]], [[-2.137, 0.76, 0.693], [-2.137, 0.73, 0.693]], [[-2.126, 0.76, 0.708], [-2.126, 0.728, 0.708]], [[-2.113, 0.76, 0.722], [-2.113, 0.726, 0.722]], [[-2.098, 0.76, 0.737], [-2.098, 0.723, 0.737]], [[-2.082, 0.761, 0.751], [-2.082, 0.721, 0.751]], [[-2.063, 0.761, 0.766], [-2.063, 0.718, 0.766]], [[-2.041, 0.761, 0.78], [-2.041, 0.716, 0.78]], [[-2.015, 0.761, 0.795], [-2.015, 0.713, 0.795]], [[-1.982, 0.761, 0.809], [-1.984, 0.71, 0.809]], [[-1.935, 0.762, 0.824], [-1.942, 0.708, 0.824]]];
export function EVO_amberStrips(mat) {
  const pos = [], idx = [];
  for (const s of [1, -1]) {
    const b = pos.length / 3;
    for (const [t, d] of EVO_AMBER) pos.push(t[0], t[1], s * t[2], d[0], d[1], s * d[2]);
    for (let i = 0; i < EVO_AMBER.length - 1; i++) {
      const a = b + i * 2;
      if (s > 0) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

export const EVO_AERO = {
  front: [[2.27, 0], [2.26, 0.30], [2.22, 0.48], [2.15, 0.62], [2.05, 0.73], [1.93, 0.80]], back: 1.90, y: 0.15, rods: null,
  canard: { S: [1.98, 0.735], t: [-0.45, 0.89], ys: [0.33, 0.25] },
  skirt: { y: 0.175, x0: -0.90, x1: 0.88, z0: 0.84, z1: 0.93 },
  diff: { x0: -1.85, x1: -2.06, x2: -2.22, y0: 0.27, y1: 0.285, y2: 0.33, w: 0.60, fin0: -1.92 },
};

export const EVO_SPEC = {
  look: EVO_LOOK, paint: '#eef0f1', metal: 0.1, seat: 0x1c1d20,
  wheels: { xf: 1.30, xr: -1.325, R: 0.3217, rim: 0.2159, trackF: 0.7575, trackR: 0.7575, wF: 0.235, wR: 0.235, style: EVO_wheel },
  mirror: (paint, mats, s) => { const m = mirrorR34(paint, mats, s); m.position.set(0.76, 0.985, s * 0.775); m.scale.set(1.08, 1.0, 1.0); return m; },
  wings: {
    stock: (paint, mats) => EVO_wing(paint, mats),
    none: () => new THREE.Group(),
  },
  wing: 'stock',
  interior: { dx: -0.05, cage: false, wheelZ: 0.37, dashX: 0.66, dashY: 0.88, bench: { x: -0.98, shelfX: -1.50, shelfY: 0.99 } },
  build(body, paint, mats) { // 套件：原廠（照片那台）、賽道（碳纖維前下巴＋風刀＋側裙刀片＋擴散器）
    mats.pipe = new THREE.MeshPhysicalMaterial({ color: 0xc4c6c9, roughness: 0.22, metalness: 1, side: THREE.DoubleSide });
    body.add(EVO_exhaust(mats, -2.20, 0.375, 0.33));
    const amber = new THREE.MeshPhysicalMaterial({ color: 0xff7a12, roughness: 0.12, metalness: 0, clearcoat: 1, emissive: 0x401800 });
    body.add(EVO_amberStrips(amber));
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.32, 6), mats.black); // 車頂後面的天線
    ant.position.set(-1.10, 1.56, 0); ant.rotation.z = 0.6; body.add(ant);
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), mats.black); base.scale.set(1.4, 0.5, 0.6); base.position.set(-1.04, 1.41, 0); body.add(base);
    const aero = aeroKit(mats, EVO_AERO); aero.visible = false; body.add(aero);
    return (kit) => { aero.visible = kit === 'track'; };
  },
  kit: 'stock',
};

// 照片相機（疊圖用；evo3d/fit*.mjs 用輪框橢圓、接地點、車牌、天線底座擬合）：
// photo1＝白色前 3/4（右前），photo2＝紅色後 3/4（左後），photo3＝白色後 3/4（左後），photo4＝白色側面（左），photo5＝紅色前 3/4（左前，展示間）
export const EVO_CAMS = {
  photo1: { a: -35.256, d: 5.183, h: 1.249, tx: 0.538, ty: 0.591, fov: 21.311, rl: -0.443 },
  photo2: { a: 143.955, d: 3.173, h: 1.249, tx: -0.879, ty: 0.647, fov: 42.145, rl: -0.953 },
  photo3: { a: 146.666, d: 3.593, h: 1.45, tx: -0.984, ty: 0.557, fov: 34.881, rl: 1.677 },
  photo4: { a: 112.391, d: 11.686, h: 0.991, tx: 0.918, ty: 0.882, fov: 28.926, rl: -0.46 },
  photo5: { a: 40.962, d: 3.644, h: 1.269, tx: 0.678, ty: 0.704, fov: 44.302, rl: -1.244 },
};

export const EVO_GARAGE = {
  name: 'E9 拉力', sub: '白色拉力房車 · 3D 試做版',
  paints: [['#eef0f1', '珍珠白'], ['#c8151c', '紅'], ['#d9dcdf', '冷光銀'], ['#121316', '黑'], ['#1d3f8f', '藍'], ['#5d6268', '鐵灰'], ['#e9c21a', '黃']],
  opts: {
    wing: [['stock', '原廠高尾翼'], ['none', '不要']],
    kit: [['stock', '原廠'], ['track', '賽道']],
    height: [['0', '原廠'], ['-0.03', '降低'], ['-0.05', '貼地']],
    livery: [['rally', '拉力條紋'], ['none', '不要']],
  },
  state: { paint: '#eef0f1', rim: 'gunmetal', caliper: '#c8141e', wing: 'stock', kit: 'stock', height: '0', livery: 'none', tint: 'light' },
};
