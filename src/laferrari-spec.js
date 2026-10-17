// 3D 法拉利 LaFerrari（2013）：輪子（五組扭轉的雙輻）、後照鏡、會升起來的尾翼、圓尾燈、四根排氣管、下巴、擴散器、套件、相機、車庫選項
// （照四張紅色 LaFerrari 照片；車庫裡的名字是自己編的「LF 紅焰」，沒有廠牌、馬、盾牌、字）
import * as THREE from 'three';
import { aeroKit, slab, lip } from './parts.js';
import { LAFERRARI_LOOK } from './laferrari-look.js';

// ---- 輪框：五組扭轉的雙輻（每組兩片，從中間往外慢慢分開、往一邊彎），中間中心鎖螺帽 ----
function LAFERRARI_rim(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.010, rh = 0.06, zo = w / 2 - 0.028, zi = w / 2 - 0.080;
  const N = 10, twist = 0.22; // 每片切 10 段（連在一起的長條），從中間到外緣轉 0.22 弧度
  const P = [], I = [];
  for (let j = 0; j < 5; j++) {
    const a0 = (j * 2 * Math.PI) / 5 + Math.PI / 2;
    for (const s of [-1, 1]) {
      const base = P.length / 3;
      for (let i = 0; i <= N; i++) {
        const t = i / N, r = rh + (ro - rh) * t;
        const sep = s * (0.004 + 0.016 * t * t) / Math.max(r, 0.06);   // 兩片在中間併在一起，往外分開
        const ang = a0 + twist * t * t + sep;
        const ww = 0.010 + 0.006 * t;                                   // 半寬
        const zf = zi + 0.012 + (zo - zi - 0.012) * Math.min(1, t * 1.4), th = 0.020 - 0.006 * t; // 往外凸、外面薄一點
        const c = Math.cos(ang), sn = Math.sin(ang);
        for (const [off, dz] of [[-ww, 0], [ww, 0], [ww, -th], [-ww, -th]]) P.push(c * r - sn * off, sn * r + c * off, zf + dz);
      }
      for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) {
        const a = base + i * 4 + k, b = base + i * 4 + ((k + 1) % 4), c = a + 4, d = b + 4;
        I.push(a, c, b, b, c, d);
      }
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setIndex(I);
  geo.computeVertexNormals(); g.add(new THREE.Mesh(geo, mats.chrome));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.036, 40), mats.chrome);
  hub.geometry.rotateX(Math.PI / 2); hub.position.z = zi + 0.012; g.add(hub);
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.035, 6), mats.alu); // 中心鎖螺帽（六角）
  nut.geometry.rotateX(Math.PI / 2); nut.position.z = zi + 0.04; g.add(nut);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ro + 0.002, 0.005, 8, 96), mats.chrome);
  ring.position.z = zo + 0.004; g.add(ring);
  return g;
}
LAFERRARI_rim.capInset = 0.03;

// ---- 後照鏡：細細的黑色長支架從前擋下角伸出去，黑色鏡殼，鏡面朝後 ----
function LAFERRARI_mirror(paint, mats, s) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), mats.gloss);
  head.scale.set(0.085, 0.045, 0.06); head.position.set(0.55, 0.925, s * 0.955); head.rotation.y = s * 0.15; g.add(head);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(1, 28), mats.mirrorGlass);
  glass.scale.set(0.054, 0.036, 1); glass.rotation.y = -Math.PI / 2; glass.position.set(0.48, 0.925, s * 0.955); g.add(glass);
  const c = new THREE.CatmullRomCurve3([[0.74, 0.79, 0.66], [0.70, 0.84, 0.78], [0.63, 0.89, 0.88], [0.575, 0.915, 0.93]].map(([x, y, z]) => new THREE.Vector3(x, y, s * z)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 20, 0.009, 8), mats.gloss));
  return g;
}

// ---- 尾翼：原廠＝尾翼板後緣一條黑色小擾流片（收起來）；升起來＝整片往上翹 ----
const LAFERRARI_DECK = { x: -2.17, y: 0.80, span: 0.68 };
function LAFERRARI_flap(mats, up) {
  const g = new THREE.Group(), D = LAFERRARI_DECK, n = 12, P = [], I = [];
  // 沿著車尾的弧（兩邊往前收一點）一片薄板：前緣 xf、後緣 xb
  const ang = up ? 0.42 : 0.06, chord = up ? 0.20 : 0.05, lift = up ? 0.035 : 0.004;
  for (let i = 0; i <= n; i++) {
    const z = -D.span + (2 * D.span * i) / n, k = (z / D.span) ** 2;
    const xb = D.x + 0.02 + 0.08 * k, yb = D.y - 0.008 - 0.03 * k + lift;
    const xf = xb + chord * Math.cos(ang), yf = yb - chord * Math.sin(ang) * 0.15;
    const yt = yb + chord * Math.sin(ang);
    P.push(xf, yf + 0.006, z, xb, yt + 0.006, z, xb, yt - 0.006, z, xf, yf - 0.006, z);
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = a + 4, d = b + 4; I.push(a, c, b, b, c, d); }
  for (const e of [0, n * 4]) I.push(e, e + 1, e + 2, e, e + 2, e + 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setIndex(I); geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0x0d0e10, roughness: 0.25, metalness: 0.1, clearcoat: 1, side: THREE.DoubleSide })));
  if (up) for (const s of [-1, 1]) { // 兩根小支架
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.012), mats.black);
    arm.position.set(D.x + 0.08, D.y + 0.005, s * 0.42); arm.rotation.z = -0.35; g.add(arm);
  }
  return g;
}

// ---- 圓尾燈（兩邊各一顆，在後葉子板尾端的圓筒上）：外圈紅、中間白色倒車燈 ----
function LAFERRARI_lamps(mats) {
  const g = new THREE.Group();
  const red = new THREE.MeshPhysicalMaterial({ color: 0x8a0309, emissive: 0x3a0002, roughness: 0.12, clearcoat: 1 });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xe8ecef, roughness: 0.08, metalness: 0.3, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const o = new THREE.Group(); o.position.set(-2.078, 0.742, s * 0.785); o.rotation.y = -Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.073, 0.007, 8, 40), mats.gloss); o.add(rim);
    const lens = new THREE.Mesh(new THREE.RingGeometry(0.036, 0.072, 40), red); lens.position.z = 0.002; o.add(lens);
    const ctr = new THREE.Mesh(new THREE.CircleGeometry(0.036, 32), white); ctr.position.z = 0.004; o.add(ctr);
    const bez = new THREE.Mesh(new THREE.TorusGeometry(0.037, 0.004, 6, 32), mats.alu); bez.position.z = 0.005; o.add(bez);
    g.add(o);
  }
  return g;
}

// ---- 排氣管：兩邊各兩根大圓管，在車尾下面的凹洞裡 ----
function LAFERRARI_exhaust(mats) {
  const g = new THREE.Group();
  const ti = new THREE.MeshPhysicalMaterial({ color: 0x9a9690, metalness: 1, roughness: 0.32, side: THREE.DoubleSide });
  for (const s of [-1, 1]) for (const z of [0.497, 0.613]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.11, 32, 1, true), ti);
    p.geometry.rotateZ(Math.PI / 2); p.position.set(-2.15, 0.335, s * z); g.add(p);
    const lipR = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.004, 6, 32), ti); lipR.rotation.y = Math.PI / 2; lipR.position.set(-2.205, 0.335, s * z); g.add(lipR);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.044, 32), mats.black); hole.rotation.y = -Math.PI / 2; hole.position.set(-2.165, 0.335, s * z); g.add(hole);
  }
  return g;
}

// ---- 碳纖維的下巴（車頭底下）、側裙下緣 ----
function LAFERRARI_carbon(mats) {
  const g = new THREE.Group();
  const sp = lip(mats, [[2.415, 0], [2.40, 0.28], [2.34, 0.50], [2.22, 0.66], [2.07, 0.79], [1.92, 0.875]], 1.90, 0.12);
  g.add(sp);
  for (const s of [-1, 1]) g.add(new THREE.Mesh(slab([[-0.95, 0.10, s * 0.84], [0.88, 0.10, s * 0.84], [0.84, 0.10, s * 0.905], [-0.91, 0.10, s * 0.91]], 0.01), mats.carbon));
  return g;
}

// 賽道套件的位置（大下巴＋拉桿、角落風刀、側裙刀片、後擴散器）
const LAFERRARI_AERO = {
  front: [[2.48, 0], [2.47, 0.30], [2.41, 0.52], [2.29, 0.68], [2.13, 0.81], [2.0, 0.89]], back: 1.92, y: 0.104, rods: [2.38, 0.15],
  canard: { S: [2.07, 0.765], t: [-0.805, 0.593], ys: [0.30, 0.37] },
  skirt: { y: 0.09, x0: -0.92, x1: 0.84, z0: 0.88, z1: 0.985 },
  diff: { x0: -1.80, x1: -2.10, x2: -2.30, y0: 0.122, y1: 0.16, y2: 0.27, w: 0.66, fin0: -1.90 },
};

export const LAFERRARI_SPEC = {
  look: LAFERRARI_LOOK, paint: '#c8101a', metal: 0.3, seat: 0x1c1c1f,
  wheels: { xf: 1.265, xr: -1.385, RF: 0.3208, RR: 0.3575, rimF: 0.2413, rimR: 0.254, trackF: 0.83, trackR: 0.80, wF: 0.265, wR: 0.345, style: LAFERRARI_rim },
  mirror: LAFERRARI_mirror,
  wings: { stock: (paint, mats) => LAFERRARI_flap(mats, false), up: (paint, mats) => LAFERRARI_flap(mats, true) }, wing: 'stock',
  interior: { dx: -0.2, cage: false, wheelZ: -0.36, dashX: 0.48, dashY: 0.72, seatDy: -0.11, shelf: false },
  build(body, paint, mats) { // 套件：原廠（碳纖維下巴、側裙、擴散器）、賽道（再加大下巴、風刀、側裙刀片、大擴散器）
    body.add(LAFERRARI_lamps(mats), LAFERRARI_exhaust(mats), LAFERRARI_carbon(mats));
    const aero = aeroKit(mats, LAFERRARI_AERO); aero.visible = false; body.add(aero);
    return (kit) => { aero.visible = kit === 'track'; };
  },
  kit: 'stock',
};
const LAFERRARI_D = -0.06; // 相機是用「軸距中點＝0」解的（laferrari3d/fit*.mjs）；車身座標的軸距中點在 x＝D
export const LAFERRARI_CAMS = {
  photo1: { a: 32.369, d: 8.509, h: 1.164, tx: 0.465 + LAFERRARI_D, ty: 0.56, fov: 12.661, rl: 0.658 },
  photo2: { a: 39.973, d: 3.167, h: 1.307, tx: 0.843, ty: 0.191, fov: 48.651, rl: -2.126 },
  photo3: { a: -134.133, d: 10.277, h: 1.54, tx: -0.276 + LAFERRARI_D, ty: 0.548, fov: 10.854, rl: 1.083 },
  photo4: { a: -144.9, d: 6.704, h: 1.535, tx: -0.577 + LAFERRARI_D, ty: 0.546, fov: 15.508, rl: -1.332 },
};
export const LAFERRARI_GARAGE = {
  name: 'LF 紅焰', sub: '紅色流線超跑 · 3D 試做版',
  paints: [['#c8101a', '賽車紅'], ['#f5c400', '摩德納黃'], ['#121316', '黑'], ['#f0f1f3', '白'], ['#5f6469', '鐵灰'], ['#1f3a7a', '法國藍'], ['#8f0f16', '深紅'], ['#d3d6da', '銀']],
  opts: {
    wing: [['stock', '原廠'], ['up', '尾翼升起'], ['none', '不要']],
    kit: [['stock', '原廠'], ['track', '賽道']],
    height: [['0', '原廠'], ['-0.025', '降低'], ['-0.045', '貼地']],
    livery: [['none', '不要'], ['num', '19 號賽車']],
  },
  state: { paint: '#c8101a', rim: 'chrome', caliper: '#c8161d', wing: 'stock', kit: 'stock', height: '0', livery: 'none', tint: 'light' },
};
