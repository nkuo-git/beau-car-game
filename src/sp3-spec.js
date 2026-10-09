// 3D 法拉利 Daytona SP3：輪子、後照鏡、車尾百葉、排氣管、套件、車庫選項（照 Nick 2026-09-27 的兩張紅色 SP3 照片）
import * as THREE from 'three';
import { gtWing, aeroKit, slab, lip } from './parts.js';
import { SP3_LOOK } from './sp3-look.js';

// 車尾一條條橫鰭貼的曲線（右半邊）：[高度 y, 從哪個 z 開始, [[z, 車尾表面 x], ...]]，由 sp3d/tail2.mjs 從車身 SDF 算出來
// 最上面那條是尾燈；下面 9 條整排；再下面 5 條只在兩邊角落（中間是排氣管那條黑帶）
const SP3_TAIL = [[0.908,0,[[0,-2.263],[0.071,-2.263],[0.141,-2.263],[0.21,-2.263],[0.277,-2.262],[0.342,-2.261],[0.405,-2.26],[0.465,-2.258],[0.521,-2.256],[0.573,-2.259],[0.62,-2.26],[0.664,-2.257],[0.701,-2.249],[0.734,-2.235],[0.761,-2.215],[0.782,-2.19],[0.798,-2.168],[0.807,-2.154],[0.81,-2.149]]],[0.887,0,[[0,-2.27],[0.071,-2.27],[0.141,-2.27],[0.21,-2.271],[0.277,-2.27],[0.342,-2.27],[0.405,-2.269],[0.465,-2.267],[0.521,-2.266],[0.573,-2.266],[0.62,-2.265],[0.664,-2.261],[0.701,-2.253],[0.734,-2.24],[0.761,-2.221],[0.782,-2.198],[0.798,-2.177],[0.807,-2.163],[0.81,-2.159]]],[0.8655,0,[[0,-2.274],[0.071,-2.274],[0.141,-2.274],[0.21,-2.275],[0.277,-2.275],[0.342,-2.274],[0.405,-2.273],[0.465,-2.272],[0.521,-2.271],[0.573,-2.27],[0.62,-2.268],[0.664,-2.263],[0.701,-2.256],[0.734,-2.243],[0.761,-2.226],[0.782,-2.205],[0.798,-2.185],[0.807,-2.172],[0.81,-2.167]]],[0.844,0,[[0,-2.275],[0.071,-2.276],[0.141,-2.276],[0.21,-2.276],[0.277,-2.277],[0.342,-2.276],[0.405,-2.276],[0.465,-2.274],[0.521,-2.273],[0.573,-2.272],[0.62,-2.269],[0.664,-2.265],[0.701,-2.258],[0.734,-2.246],[0.761,-2.23],[0.782,-2.211],[0.798,-2.191],[0.807,-2.178],[0.81,-2.174]]],[0.8225,0,[[0,-2.276],[0.071,-2.277],[0.141,-2.277],[0.21,-2.277],[0.277,-2.278],[0.342,-2.277],[0.405,-2.277],[0.465,-2.276],[0.521,-2.274],[0.573,-2.273],[0.62,-2.27],[0.664,-2.266],[0.701,-2.259],[0.734,-2.248],[0.761,-2.233],[0.782,-2.214],[0.798,-2.196],[0.807,-2.183],[0.81,-2.179]]],[0.801,0,[[0,-2.277],[0.071,-2.277],[0.141,-2.277],[0.21,-2.278],[0.277,-2.278],[0.342,-2.278],[0.405,-2.277],[0.465,-2.276],[0.521,-2.275],[0.573,-2.273],[0.62,-2.271],[0.664,-2.266],[0.701,-2.259],[0.734,-2.249],[0.761,-2.235],[0.782,-2.217],[0.798,-2.199],[0.807,-2.187],[0.81,-2.182]]],[0.7795,0,[[0,-2.277],[0.071,-2.277],[0.141,-2.278],[0.21,-2.278],[0.277,-2.278],[0.342,-2.278],[0.405,-2.278],[0.465,-2.276],[0.521,-2.275],[0.573,-2.274],[0.62,-2.271],[0.664,-2.266],[0.701,-2.26],[0.734,-2.25],[0.761,-2.236],[0.782,-2.218],[0.798,-2.201],[0.807,-2.189],[0.81,-2.184]]],[0.758,0,[[0,-2.277],[0.071,-2.277],[0.141,-2.277],[0.21,-2.278],[0.277,-2.278],[0.342,-2.278],[0.405,-2.278],[0.465,-2.276],[0.521,-2.275],[0.573,-2.274],[0.62,-2.271],[0.664,-2.266],[0.701,-2.26],[0.734,-2.25],[0.761,-2.236],[0.782,-2.219],[0.798,-2.202],[0.807,-2.189],[0.81,-2.185]]],[0.7365,0,[[0,-2.276],[0.071,-2.277],[0.141,-2.277],[0.21,-2.278],[0.277,-2.278],[0.342,-2.278],[0.405,-2.277],[0.465,-2.276],[0.521,-2.275],[0.573,-2.273],[0.62,-2.271],[0.664,-2.266],[0.701,-2.26],[0.734,-2.251],[0.761,-2.236],[0.782,-2.218],[0.798,-2.201],[0.807,-2.188],[0.81,-2.184]]],[0.715,0,[[0,-2.276],[0.071,-2.277],[0.141,-2.277],[0.21,-2.277],[0.277,-2.278],[0.342,-2.278],[0.405,-2.277],[0.465,-2.276],[0.521,-2.275],[0.573,-2.273],[0.62,-2.271],[0.664,-2.266],[0.701,-2.26],[0.734,-2.25],[0.761,-2.235],[0.782,-2.217],[0.798,-2.198],[0.807,-2.186],[0.81,-2.181]]],[0.6935,0.575,[[0.575,-2.273],[0.598,-2.272],[0.622,-2.271],[0.645,-2.268],[0.669,-2.266],[0.693,-2.262],[0.716,-2.256],[0.74,-2.247],[0.763,-2.232],[0.787,-2.209],[0.81,-2.177]]],[0.672,0.575,[[0.575,-2.273],[0.598,-2.272],[0.622,-2.271],[0.645,-2.268],[0.669,-2.265],[0.693,-2.261],[0.716,-2.255],[0.74,-2.245],[0.763,-2.229],[0.787,-2.204],[0.81,-2.172]]],[0.6505,0.575,[[0.575,-2.273],[0.598,-2.272],[0.622,-2.27],[0.645,-2.268],[0.669,-2.265],[0.693,-2.261],[0.716,-2.254],[0.74,-2.243],[0.763,-2.226],[0.787,-2.199],[0.81,-2.165]]],[0.629,0.575,[[0.575,-2.273],[0.598,-2.272],[0.622,-2.27],[0.645,-2.268],[0.669,-2.264],[0.693,-2.26],[0.716,-2.253],[0.74,-2.24],[0.763,-2.221],[0.787,-2.192],[0.81,-2.158]]],[0.6075,0.575,[[0.575,-2.273],[0.598,-2.272],[0.622,-2.27],[0.645,-2.267],[0.669,-2.264],[0.693,-2.259],[0.716,-2.251],[0.74,-2.237],[0.763,-2.216],[0.787,-2.185],[0.81,-2.15]]]];

// 沿著一條曲線（xz 平面）做一片有厚度的薄板：前緣貼著原本的車尾表面、往裡 depth 深、厚 th，前緣比後緣低一點（往下斜）
function SP3_blade(pts, y, th, depth) {
  const n = pts.length, secs = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[1] - a[1], tz = b[0] - a[0]; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    const nx = -tz, nz = tx; // 朝外
    const [z, x] = pts[i];
    const F = [x - nx * 0.003, z - nz * 0.003], B = [x - nx * depth, z - nz * depth];
    secs.push([[F[0], y + th / 2 - 0.003, F[1]], [F[0], y - th / 2 - 0.003, F[1]], [B[0], y - th / 2 + 0.003, B[1]], [B[0], y + th / 2 + 0.003, B[1]]]);
  }
  const P = [], I = [];
  for (let k = 0; k < 4; k++) { // 四個面各自一條帶子（邊是尖的、面上是平滑的）
    const base = P.length / 3;
    for (const s of secs) P.push(...s[k], ...s[(k + 1) % 4]);
    for (let i = 0; i < n - 1; i++) { const q = base + i * 2; I.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
  }
  for (const s of [secs[0], secs[n - 1]]) { const base = P.length / 3; for (const c of s) P.push(...c); I.push(base, base + 1, base + 2, base, base + 2, base + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  return g;
}
// 圓角長方形（給排氣管口、倒車燈）
function SP3_rrect(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}
// 車尾：橫鰭（車身同色，換車色會跟著變）、尾燈、中間黑帶上的兩個方形排氣管和兩個倒車燈
function SP3_tail(paint, mats) {
  const g = new THREE.Group();
  const fin = new THREE.MeshPhysicalMaterial({ metalness: paint.metalness, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.15, envMapIntensity: 0.45, side: THREE.DoubleSide });
  fin.color = paint.color; // 同一個顏色物件：車庫換車色時橫鰭一起變
  const lamp = new THREE.MeshPhysicalMaterial({ color: 0x6d0208, emissive: 0x2a0000, roughness: 0.12, clearcoat: 1, side: THREE.DoubleSide });
  for (const [y, z0, half] of SP3_TAIL) {
    const top = y > 0.9;
    if (z0 === 0) { // 整排：左右接起來
      const pts = [...half.slice(1).reverse().map(([z, x]) => [-z, x]), ...half];
      g.add(new THREE.Mesh(SP3_blade(pts, y, top ? 0.016 : 0.0115, 0.055), top ? lamp : fin));
    } else for (const s of [1, -1]) {
      const pts = s > 0 ? half : half.map(([z, x]) => [-z, x]).reverse();
      g.add(new THREE.Mesh(SP3_blade(pts, y, 0.0115, 0.055), fin));
    }
  }
  // 中間黑帶（排氣管、倒車燈裝在上面）
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.112, 1.15), mats.gloss);
  band.position.set(-2.247, 0.652, 0); g.add(band);
  const tip = new THREE.MeshPhysicalMaterial({ color: 0xb09070, metalness: 1, roughness: 0.28 });
  for (const s of [1, -1]) {
    const ring = SP3_rrect(0.19, 0.086, 0.028); ring.holes.push(SP3_rrect(0.166, 0.062, 0.02));
    const ex = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 8 }), tip);
    ex.geometry.rotateY(-Math.PI / 2); ex.position.set(-2.243, 0.657, s * 0.175); g.add(ex);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.066), mats.black);
    hole.rotation.y = -Math.PI / 2; hole.position.set(-2.262, 0.657, s * 0.175); g.add(hole);
    const rev = new THREE.Mesh(new THREE.ExtrudeGeometry(SP3_rrect(0.15, 0.048, 0.012), { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }),
      new THREE.MeshPhysicalMaterial({ color: 0xc9d0d8, roughness: 0.06, metalness: 0.2, clearcoat: 1 }));
    rev.geometry.rotateY(-Math.PI / 2); rev.position.set(-2.268, 0.648, s * 0.395); g.add(rev);
  }
  return g;
}

// 車尾下面擴散器的直立導流片（碳纖維），貼著往上斜的通道
function SP3_diffuser(mats) {
  const g = new THREE.Group();
  for (const z of [-0.60, -0.36, -0.12, 0.12, 0.36, 0.60]) {
    const f = new THREE.Shape(); f.moveTo(-1.86, 0.134); f.lineTo(-2.285, 0.302); f.lineTo(-2.29, 0.175); f.lineTo(-2.02, 0.128); f.closePath();
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(f, { depth: 0.008, bevelEnabled: false }), mats.carbon);
    m.position.z = z - 0.004; g.add(m);
  }
  return g;
}

// 前葉子板後面的黃色盾牌（只畫形狀和上面三色條，不畫圖案）
function SP3_shields() {
  const g = new THREE.Group();
  const sh = new THREE.Shape();
  sh.moveTo(-0.034, 0.046); sh.lineTo(0.034, 0.046); sh.lineTo(0.034, -0.008); sh.quadraticCurveTo(0.032, -0.03, 0, -0.047); sh.quadraticCurveTo(-0.032, -0.03, -0.034, -0.008); sh.closePath();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf5c400, roughness: 0.35 });
  const bands = [[0x159a3c, -0.0227], [0xf4f4f4, 0], [0xd01c24, 0.0227]];
  for (const s of [1, -1]) {
    const d = new THREE.Group();
    d.add(new THREE.Mesh(new THREE.ShapeGeometry(sh, 12), yellow));
    for (const [c, x] of bands) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.0227, 0.009), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 })); b.position.set(x, 0.0395, 0.0005); d.add(b); }
    d.position.set(0.737, 0.561, s * 0.986); d.rotation.y = Math.atan2(-0.11, s * 0.99);
    g.add(d);
  }
  return g;
}

// 後照鏡：長長的黑色支架從前葉子板上面伸出來，鏡頭上半紅（車色）下半黑，鏡面朝後
function SP3_mirror(paint, mats, s) {
  const g = new THREE.Group();
  const up = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), paint);
  up.scale.set(0.125, 0.05, 0.062); g.add(up);
  const lo = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mats.black);
  lo.scale.set(0.12, 0.034, 0.06); g.add(lo);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(1, 32), mats.mirrorGlass);
  glass.scale.set(0.048, 0.03, 1); glass.rotation.y = -Math.PI / 2; glass.position.x = -0.103; g.add(glass);
  g.position.set(0.955, 0.815, s * 0.985);
  const root = new THREE.Group(); root.add(g);
  const c = new THREE.CatmullRomCurve3([[1.285, 0.728, 0.952], [1.17, 0.772, 0.975], [1.05, 0.79, 0.985], [0.99, 0.795, 0.985]].map(([x, y, z]) => new THREE.Vector3(x, y, s * z)));
  root.add(new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.011, 8), mats.black));
  return root;
}

// 輪框：五組雙輻（銀色），中間黃色中心蓋（不畫圖案）
const SP3_capMat = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.35 });
function SP3_spokes(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.013, rh = 0.078, zo = w / 2 - 0.03, zi = w / 2 - 0.078;
  const P = (r, ang, z, off) => [Math.cos(ang) * r - Math.sin(ang) * off, Math.sin(ang) * r + Math.cos(ang) * off, z];
  for (let j = 0; j < 5; j++) {
    const a = (j * 2 * Math.PI) / 5;
    for (const s of [-1, 1]) {
      const ai = a + s * 0.075, ao = a + s * 0.105, wi = 0.011, wo = 0.009;
      g.add(new THREE.Mesh(slab([P(rh, ai, zi, -wi), P(ro, ao, zo, -wo), P(ro, ao, zo, wo), P(rh, ai, zi, wi)], 0.024), mats.chrome));
    }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.1, 0.036, 48), mats.chrome);
  hub.geometry.rotateX(Math.PI / 2); hub.position.z = zi + 0.004; g.add(hub);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.034, 32), SP3_capMat);
  cap.position.z = w / 2 - SP3_spokes.capInset + 0.0158; g.add(cap);
  return g;
}
SP3_spokes.capInset = 0.062;

// 賽道套件的位置（碳纖維前下巴、風刀、側裙刀片、後擴散器）
const SP3_AERO = {
  front: [[2.43, 0], [2.42, 0.30], [2.36, 0.52], [2.26, 0.70], [2.13, 0.85], [2.0, 0.93]], back: 1.95, y: 0.088, rods: [2.33, 0.13],
  canard: { S: [2.135, 0.76], t: [-0.567, 0.824], ys: [0.33, 0.26] },
  skirt: { y: 0.118, x0: -0.95, x1: 0.78, z0: 0.84, z1: 0.95 },
  diff: { x0: -1.80, x1: -2.12, x2: -2.30, y0: 0.125, y1: 0.15, y2: 0.24, w: 0.66, fin0: -1.9 },
};

export const SP3_SPEC = {
  look: SP3_LOOK, paint: '#c3141c', metal: 0.35, seat: 0x1b3f8f,
  wheels: { xf: 1.21, xr: -1.441, RF: 0.3335, RR: 0.370, rimF: 0.262, rimR: 0.275, trackF: 0.8455, trackR: 0.8155, wF: 0.265, wR: 0.345, style: SP3_spokes },
  mirror: SP3_mirror,
  wings: { gt: (paint, mats) => gtWing({ mats, x: -2.04, y: 1.255, deck: 0.972, span: 1.62, chord: 0.30 }) }, wing: 'none', // 端板要高過後葉子板（原本插進去 8 公分）
  interior: { dx: -0.1, cage: false, dashX: 0.40, dashY: 0.72, seatDy: -0.09, shelf: false },
  build(body, paint, mats) { // 套件：原廠、賽道（碳纖維前下巴＋風刀＋側裙刀片＋擴散器）
    body.add(SP3_tail(paint, mats), SP3_shields(), SP3_diffuser(mats));
    // 原廠碳纖維下巴：厚厚一塊（約 6 公分），霧一點，不要反光成白色
    const chin = lip(mats, [[2.345, 0], [2.335, 0.30], [2.28, 0.49], [2.185, 0.63], [2.065, 0.74], [1.955, 0.80]], 1.95, 0.142);
    const cm = new THREE.MeshPhysicalMaterial({ color: 0x0e0f11, roughness: 0.5, metalness: 0.1, clearcoat: 0.25, clearcoatRoughness: 0.3 });
    chin.traverse((o) => { if (o.isMesh) { o.material = cm; o.scale.z = 3.5; } });
    body.add(chin);
    const aero = aeroKit(mats, SP3_AERO); aero.visible = false; body.add(aero);
    return (kit) => { aero.visible = kit === 'track'; };
  },
  kit: 'stock',
};
export const SP3_CAMS = {
  photo1: { a: 35.7133, d: 5.899, h: 1.1528, tx: 0.6508, ty: 0.4215, fov: 25.9325, rl: 0.123 },
  photo2: { a: -152.417, d: 6.7108, h: 1.1264, tx: -0.6628, ty: 0.5682, fov: 22.9076, rl: 0.3138 },
};
export const SP3_GARAGE = {
  name: 'Ferrari Daytona SP3', sub: '照片那台紅色 SP3 · 3D 試做版',
  paints: [['#c3141c', '賽車紅'], ['#f4c21b', '摩德納黃'], ['#141518', '黑'], ['#f2f3f5', '白'], ['#1c3f94', '藍'], ['#8a9098', '銀灰'], ['#123f2c', '英國綠'], ['#ff7414', '橘']],
  opts: {
    wing: [['none', '不要'], ['gt', 'GT 大尾翼']],
    kit: [['stock', '原廠'], ['track', '賽道']],
    height: [['0', '原廠'], ['-0.025', '降低'], ['-0.045', '貼地']],
    livery: [['none', '不要'], ['daytona', '3 號賽車']],
  },
  state: { paint: '#c3141c', rim: 'chrome', caliper: '#f2b705', wing: 'none', kit: 'stock', height: '0', livery: 'none', tint: 'light' },
};
