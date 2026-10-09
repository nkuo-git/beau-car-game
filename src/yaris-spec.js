// 3D Toyota GR Yaris：輪子（BBS 鍛造 10 輻，五組 V 形）、黑色後照鏡、GR 大尾翼（鵝頸支架）、原廠車頂擾流、雙邊排氣、賽道套件
// 車身是 yaris-body.mjs 切出來的 body-yaris(-q).glb，表面細節在 yaris-look.js。
import * as THREE from 'three';
import { mirror, aeroKit } from './parts.js';
import { YARIS_LOOK } from './yaris-look.js';

// 一片有厚度的四邊形板子（四個角依序），往法線兩邊各長 th/2
function YARIS_slab(pts, th) {
  const v = pts.map((p) => new THREE.Vector3(...p));
  const n = new THREE.Vector3().crossVectors(v[1].clone().sub(v[0]), v[3].clone().sub(v[0])).normalize().multiplyScalar(th / 2);
  const T = v.map((p) => p.clone().add(n)), B = v.map((p) => p.clone().sub(n));
  const quads = [[T[0], T[1], T[2], T[3]], [B[3], B[2], B[1], B[0]]];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quads.push([B[i], B[j], T[j], T[i]]); }
  const a = [];
  for (const [p, q, r, w] of quads) a.push(...p.toArray(), ...q.toArray(), ...r.toArray(), ...p.toArray(), ...r.toArray(), ...w.toArray());
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); g.computeVertexNormals();
  return g;
}

// 輪框：BBS 鍛造 18 吋，十根細輻條兩兩一組（五組 V 形），在輪轂那邊靠在一起、到輪框外緣平均分開
function YARIS_wheel(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.012, rh = 0.07, zo = w / 2 - 0.028, zi = w / 2 - 0.075;
  for (let j = 0; j < 5; j++) {
    const a = (j * 2 * Math.PI) / 5 + Math.PI / 10;
    for (const s of [-1, 1]) {
      const ai = a + s * 0.075, ao = a + s * (Math.PI / 10); // 輪轂那邊靠近、外緣平均分開（十個尖端每 36 度一個）
      const P = (r, ang, z, off) => [Math.cos(ang) * r - Math.sin(ang) * off, Math.sin(ang) * r + Math.cos(ang) * off, z];
      const wi = 0.0095, wo = 0.0065;
      g.add(new THREE.Mesh(YARIS_slab([P(rh, ai, zi, -wi), P(ro, ao, zo, -wo), P(ro, ao, zo, wo), P(rh, ai, zi, wi)], 0.02), mats.chrome));
    }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.045, 40), mats.chrome);
  hub.geometry.rotateX(Math.PI / 2); hub.position.z = zi + 0.004; g.add(hub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ro + 0.003, 0.006, 8, 96), mats.chrome);
  ring.position.z = zo + 0.004; g.add(ring);
  return g;
}
YARIS_wheel.capInset = 0.06;

// GR 大尾翼：黑色主翼、兩片大端板、兩支從尾門上緣彎上去勾在翼面上的鵝頸支架；底下留原廠擾流
function YARIS_spoiler(mats) {
  const g = new THREE.Group();
  const sh = new THREE.Shape(); // 側面形狀（x, y），往 z 拉
  sh.moveTo(-1.575, 1.345); sh.lineTo(-1.66, 1.338); sh.lineTo(-1.775, 1.305); sh.lineTo(-1.79, 1.285); sh.lineTo(-1.70, 1.282); sh.lineTo(-1.60, 1.305); sh.closePath();
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.94, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 2 }), mats.gloss);
  m.geometry.translate(0, 0, -0.47); g.add(m);
  return g;
}
function YARIS_grWing(mats) {
  const g = new THREE.Group();
  g.add(YARIS_spoiler(mats));
  // 位置從車尾照片量的（左右對稱的點一起三角定位，yaris3d/mtri.mjs、epplane.mjs）：
  // 端板尖角 (-1.784, 1.451, ±0.441)、前下角 (-1.466, 1.205, ±0.609)，端板是直立的、往後收（跟著尾門兩側變窄）
  // 主翼後緣 (-1.74, 1.432)、弦長 0.23、前緣低 17 度，貼著端板上緣
  const TIP = [-1.784, 1.451, 0.441], K = 0.168 / 0.318; // 端板往前每 1 公尺往外 0.528
  const zAt = (x) => TIP[2] + (x - TIP[0]) * K; // 端板（右邊）在 x 的位置
  const chord = 0.23, ang = -0.297, te = [-1.74, 1.432];
  const cx = te[0] + (chord / 2) * Math.cos(ang), cy = te[1] + (chord / 2) * Math.sin(ang);
  // 翼剖面（倒過來的機翼：下面彎、上面平），翼展跟著兩邊端板：前緣寬、後緣窄
  const s = new THREE.Shape(), N = 20, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, xc = (1 - Math.cos(Math.PI * t)) / 2;
    const th = 0.12 * 5 * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
    const camber = -0.05 * Math.sin(Math.PI * xc);
    top.push([xc, camber + th]); bot.push([xc, camber - th]);
  }
  const P = (p) => [(-p[0] + 0.5) * chord, p[1] * chord];
  s.moveTo(...P(top[0])); for (const p of top.slice(1)) s.lineTo(...P(p)); for (const p of bot.slice().reverse().slice(1)) s.lineTo(...P(p));
  const bg = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 4 });
  bg.translate(0, 0, -0.5);
  const pos = bg.attributes.position, c = Math.cos(ang), sn = Math.sin(ang);
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i), ly = pos.getY(i), lz = pos.getZ(i);
    pos.setXYZ(i, cx + lx * c - ly * sn, cy + lx * sn + ly * c, lz * 2 * (zAt(cx + lx * c - ly * sn) + 0.004));
  }
  bg.computeVertexNormals();
  g.add(new THREE.Mesh(bg, mats.gloss));
  // 後緣往上的小翼片（格尼片）
  const fl = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 2 * zAt(te[0])), mats.gloss);
  fl.position.set(te[0] + 0.004, te[1] + 0.006, 0); fl.rotation.z = ang; g.add(fl);
  // 端板：直立的鰭，尖角在後上，前下角靠在 C 柱外面；座標是（沿著端板往前 s、比尖角低多少 dy）
  const ep = new THREE.Shape();
  ep.moveTo(0, 0); ep.lineTo(0.40, -0.124); ep.lineTo(0.405, -0.16); ep.lineTo(0.36, -0.246); ep.lineTo(0.294, -0.203);
  ep.lineTo(0.146, -0.143); ep.lineTo(0.02, -0.105); ep.lineTo(-0.008, -0.07); ep.closePath();
  for (const sz of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.ExtrudeGeometry(ep, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.004, bevelSegments: 1 }), mats.gloss);
    e.geometry.translate(0, 0, -0.004);
    const f = new THREE.Vector3(1, 0, sz * K).normalize(), up = new THREE.Vector3(0, 1, 0), n = f.clone().cross(up);
    e.matrixAutoUpdate = false;
    e.matrix.makeBasis(f, up, n).setPosition(TIP[0], TIP[1], sz * TIP[2]);
    g.add(e);
  }
  // 鵝頸支架：從尾門上的擾流往上、繞到主翼後緣後面，再從上面勾住翼面
  const st = new THREE.Shape();
  st.moveTo(-1.640, 1.336); st.lineTo(-1.688, 1.328);
  st.bezierCurveTo(-1.745, 1.345, -1.792, 1.39, -1.785, 1.438);
  st.bezierCurveTo(-1.78, 1.462, -1.72, 1.462, -1.665, 1.408);
  st.lineTo(-1.685, 1.412);
  st.bezierCurveTo(-1.71, 1.438, -1.745, 1.448, -1.758, 1.432);
  st.bezierCurveTo(-1.768, 1.40, -1.72, 1.35, -1.640, 1.336);
  for (const sz of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(st, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 8 }), mats.gloss);
    m.position.z = sz * 0.20 - 0.007; g.add(m);
  }
  return g;
}

// 排氣管尾端：圓的鈦色管口（外面亮、裡面黑），在後保桿兩個角下面
function YARIS_exhaust(mats, x, y, z) {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.14, 32, 1, true), mats.pipe);
  tube.geometry.rotateZ(Math.PI / 2); g.add(tube);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.004, 8, 32), mats.pipe);
  lip.rotation.y = Math.PI / 2; lip.position.x = -0.07; g.add(lip);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.044, 32), mats.black);
  inner.rotation.y = -Math.PI / 2; inner.position.x = -0.03; g.add(inner);
  g.position.set(x, y, z);
  return g;
}

export const YARIS_AERO = {
  front: [[2.025, 0], [2.02, 0.30], [2.005, 0.50], [1.98, 0.62], [1.94, 0.72], [1.87, 0.79]], back: 1.80, y: 0.132, rods: [1.97, 0.165],
  canard: { S: [1.905, 0.765], t: [-0.59, 0.81], ys: [0.33, 0.25] },
  skirt: { y: 0.16, x0: -0.95, x1: 0.78, z0: 0.82, z1: 0.915 },
  diff: { x0: -1.70, x1: -1.96, x2: -2.07, y0: 0.235, y1: 0.255, y2: 0.31, w: 0.56, fin0: -1.78 },
};

export const YARIS_SPEC = {
  look: YARIS_LOOK, paint: '#eceeef', metal: 0.12, seat: 0x1c1d20,
  wheels: { xf: 1.17, xr: -1.39, R: 0.319, rim: 0.2286, trackF: 0.7675, trackR: 0.7825, wF: 0.225, wR: 0.225, style: YARIS_wheel },
  mirror: (paint, mats, s) => { const m = mirror(mats.gloss, mats, s); m.position.set(0.60, 1.10, s * 0.79); m.scale.setScalar(1.25); return m; },
  wings: {
    gr: (paint, mats) => YARIS_grWing(mats),
    stock: (paint, mats) => YARIS_spoiler(mats),
    none: () => new THREE.Group(),
  },
  wing: 'gr',
  interior: { dx: 0.05, cage: false, wheelZ: 0.36, dashX: 0.55, dashY: 0.93, bench: { x: -0.88, shelfX: -1.45, shelfY: 1.03 } },
  build(body, paint, mats) { // 套件：原廠（什麼都不加）、賽道（碳纖維前下巴＋風刀＋側裙刀片＋擴散器）
    mats.pipe = new THREE.MeshPhysicalMaterial({ color: 0xb9b4ad, roughness: 0.25, metalness: 1, side: THREE.DoubleSide });
    for (const s of [-1, 1]) body.add(YARIS_exhaust(mats, -1.975, 0.27, s * 0.528));
    const aero = aeroKit(mats, YARIS_AERO); aero.visible = false; body.add(aero);
    return (kit) => { aero.visible = kit === 'track'; };
  },
  kit: 'stock',
};

// 照片相機（yaris3d/fit3.mjs、fit-front4.mjs 擬合）：photo1＝車尾那張（2048×1152），photo2＝車頭那張（738×399）
export const YARIS_CAMS = {
  photo1: { a: 141.615, d: 8.693, h: 0.78, tx: -0.371, ty: 0.749, fov: 14.094, rl: -0.152 },
  photo2: { a: 38.933, d: 5.932, h: 0.854, tx: 0.35, ty: 0.685, fov: 20.034, rl: -0.309 },
};

export const YARIS_GARAGE = {
  name: 'Toyota GR Yaris', sub: '白色 GR Yaris · 3D 試做版',
  paints: [['#eceeef', '珍珠白'], ['#b30f1f', '情熱紅'], ['#0e0f11', '寶石黑'], ['#5d6166', '金屬灰'], ['#c3c7cc', '銀'], ['#1f4fb8', '藍'], ['#f2c21a', '黃'], ['#1e7f4a', '綠']],
  opts: {
    wing: [['gr', 'GR 大尾翼'], ['stock', '原廠'], ['none', '不要']],
    kit: [['stock', '原廠'], ['track', '賽道']],
    height: [['0', '原廠'], ['-0.03', '降低'], ['-0.05', '貼地']],
    livery: [['gr', 'GR 條紋'], ['none', '不要']],
  },
  state: { paint: '#eceeef', rim: 'black', caliper: '#c8141e', wing: 'gr', kit: 'stock', height: '0', livery: 'none', tint: 'light' },
};
