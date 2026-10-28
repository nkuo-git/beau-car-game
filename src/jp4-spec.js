// 3D 吉普車（J4，自己設計的兩門越野車）：越野胎（胎面一塊一塊、胎壁也有花紋）、六輻 beadlock 樣子的黑框、黑色塑膠輪弧、鐵保桿＋紅色拖車勾、
// 側踏、尾門上的備胎、方形後照鏡、門鉸鏈、引擎蓋扣、天線；越野套件＝絞盤＋右邊的涉水喉；車頂架＝車頂的架子＋一排 LED 燈。
// 車身是 jp4-body.mjs 切出來的 body-jp4(-q).glb（存成遮罩座標，這裡放大、抬高回公尺），表面細節在 jp4-look.js。
import * as THREE from 'three';
import { wheel } from './parts.js';
import { JP4_LOOK, JP4_M } from './jp4-look.js';

const JP4_R = 0.415, JP4_RIM = 0.2159, JP4_TW = 0.30; // 34 吋越野胎（胎面花紋再多 1.5 公分）、17 吋框、寬 300

// 幾何合成一個（只留 position、normal）：同材質的小零件合成一個網格，draw call 少
function JP4_merge(list) {
  const P = [], N = []; let n = 0;
  for (let g of list) { if (g.index) g = g.toNonIndexed(); P.push(g.attributes.position.array); N.push(g.attributes.normal.array); n += g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (let i = 0; i < P.length; i++) { pos.set(P[i], o); nor.set(N[i], o); o += P[i].length; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
}
// 方塊：大小 (sx, sy, sz)、位置、轉角（歐拉角 XYZ）
function JP4_box(sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
  return g;
}

// 越野胎的花紋（輪子座標：輪軸 z、外側 +z）：胎面中間兩排交錯的大塊、胎肩一排包下去的塊、外側胎壁一圈小凸塊
const JP4_TREAD = {};
function JP4_treadGeo(R, w) {
  const k = R + ',' + w;
  if (JP4_TREAD[k]) return JP4_TREAD[k];
  const L = [], N = 30, h = 0.016;
  for (let i = 0; i < N; i++) {
    const t = (i * 2 * Math.PI) / N, rz = t - Math.PI / 2;
    for (const s of [1, -1]) {
      const tc = t + (s > 0 ? 0 : Math.PI / N); // 兩排錯開半格
      // 中間的大塊（有一點斜）
      L.push(JP4_box(0.074, h + 0.004, 0.066, Math.cos(tc) * (R + h / 2 - 0.002), Math.sin(tc) * (R + h / 2 - 0.002), s * 0.042, 0, 0, tc - Math.PI / 2));
      // 胎肩：往外斜下去的塊（繞切線轉，外側的往 +z 倒）
      const ts = tc + Math.PI / N * 0.5, rs = R - 0.004, zs = s * (w / 2 - 0.03);
      const sh = JP4_box(0.07, 0.024, 0.055, 0, 0, 0, 0, 0, ts - Math.PI / 2);
      sh.applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(ts), Math.cos(ts), 0), -s * 0.5));
      sh.translate(Math.cos(ts) * rs, Math.sin(ts) * rs, zs);
      L.push(sh);
    }
    // 外側胎壁的小凸塊（只有外側）
    if (i % 2 === 0) { const tw = t + 0.05, rw = R - 0.05; L.push(JP4_box(0.06, 0.035, 0.012, Math.cos(tw) * rw, Math.sin(tw) * rw, w / 2 + 0.002, 0, 0, rz)); }
  }
  return (JP4_TREAD[k] = JP4_merge(L));
}

// 輪框：六根粗輻條的黑框（往內凹一點）＋外面一圈 beadlock 樣子的環（16 顆螺絲）＋中間小蓋＋六顆螺帽；輪胎花紋也放在這裡（跟著輪子轉）
export function JP4_wheel(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.01, ri = 0.07, N = 6;
  const disc = new THREE.Shape(); disc.absarc(0, 0, ro, 0, Math.PI * 2, false);
  const hw = (r) => 0.024 + ((r - ri) / (ro - ri)) * 0.016;
  for (let j = 0; j < N; j++) {
    const a0 = (j * 2 * Math.PI) / N, a1 = ((j + 1) * 2 * Math.PI) / N;
    const rA = ri + 0.02, rB = ro - 0.028, n = 8, pts = [];
    for (let i = 0; i <= n; i++) { const r = rA + ((rB - rA) * i) / n; pts.push([Math.cos(a0 + Math.asin(hw(r) / r)) * r, Math.sin(a0 + Math.asin(hw(r) / r)) * r]); }
    const aO0 = a0 + Math.asin(hw(rB) / rB), aO1 = a1 - Math.asin(hw(rB) / rB);
    for (let i = 1; i < 10; i++) { const a = aO0 + ((aO1 - aO0) * i) / 10; pts.push([Math.cos(a) * rB, Math.sin(a) * rB]); }
    for (let i = n; i >= 0; i--) { const r = rA + ((rB - rA) * i) / n; pts.push([Math.cos(a1 - Math.asin(hw(r) / r)) * r, Math.sin(a1 - Math.asin(hw(r) / r)) * r]); }
    const aI0 = a1 - Math.asin(hw(rA) / rA), aI1 = a0 + Math.asin(hw(rA) / rA);
    for (let i = 1; i < 4; i++) { const a = aI0 + ((aI1 - aI0) * i) / 4; pts.push([Math.cos(a) * rA, Math.sin(a) * rA]); }
    const hole = new THREE.Path(); hole.moveTo(...pts[0]); for (const p of pts.slice(1)) hole.lineTo(...p); hole.closePath();
    disc.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(disc, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 40 });
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)); p.setZ(i, p.getZ(i) - 0.035 * (1 - Math.min(1, r / ro)) ** 1.3); }
  geo.computeVertexNormals();
  const face = new THREE.Mesh(geo, mats.chrome); face.position.z = w / 2 - 0.055; g.add(face);
  // beadlock 環＋螺絲
  const ring = new THREE.Mesh(new THREE.RingGeometry(rim - 0.012, rim + 0.024, 64, 1), mats.chrome); ring.position.z = w / 2 - 0.004; g.add(ring);
  const ringSide = new THREE.Mesh(new THREE.CylinderGeometry(rim + 0.024, rim + 0.024, 0.014, 64, 1, true), mats.chrome);
  ringSide.geometry.rotateX(Math.PI / 2); ringSide.position.z = w / 2 - 0.011; g.add(ringSide);
  const bolts = [], nuts = [];
  for (let j = 0; j < 16; j++) { const a = (j * 2 * Math.PI) / 16, b = new THREE.CylinderGeometry(0.0075, 0.0075, 0.012, 6); b.rotateX(Math.PI / 2); b.translate(Math.cos(a) * (rim + 0.006), Math.sin(a) * (rim + 0.006), w / 2 + 0.002); bolts.push(b); }
  for (let j = 0; j < 6; j++) { const a = (j * 2 * Math.PI) / 6 + Math.PI / 6, b = new THREE.CylinderGeometry(0.011, 0.011, 0.024, 6); b.rotateX(Math.PI / 2); b.translate(Math.cos(a) * 0.062, Math.sin(a) * 0.062, w / 2 - 0.075); nuts.push(b); }
  g.add(new THREE.Mesh(JP4_merge([...bolts, ...nuts]), mats.alu));
  // 中心蓋＋框後面一片黑的底（輻條中間看進去是黑的輪轂，不會看穿到另一邊）：同一個材質合成一個網格
  const capG = new THREE.CylinderGeometry(0.036, 0.042, 0.03, 24); capG.rotateX(Math.PI / 2); capG.translate(0, 0, w / 2 - 0.07);
  const back = new THREE.CircleGeometry(rim - 0.015, 40); back.translate(0, 0, w / 2 - 0.16);
  const backIn = new THREE.CircleGeometry(rim + 0.002, 40); backIn.rotateY(Math.PI); backIn.translate(0, 0, -w / 2 + 0.014); // 輪子內側的開口蓋起來（越野車底盤高，從車底下看得到對面輪子的內側，不然會看穿）
  g.add(new THREE.Mesh(JP4_merge([capG, back, backIn]), mats.black));
  // 輪胎花紋（輪子半徑 JP4_R）
  const tr = new THREE.Mesh(JP4_treadGeo(JP4_R, JP4_TW), mats.rubber); tr.name = 'tread'; g.add(tr);
  return g;
}
JP4_wheel.capInset = 0.6; // parts.js 的中心蓋、五顆螺帽藏進去（這個框自己有）

// 黑色塑膠輪弧：圓弧帶（內半徑 ri、外半徑 ro、從 a0 到 a1 度）往外伸到 z1
function JP4_flare(xa, ya, ri, ro, a0, a1, z0, z1) {
  const sh = new THREE.Shape(), A0 = (a0 * Math.PI) / 180, A1 = (a1 * Math.PI) / 180;
  sh.absarc(0, 0, ro, A0, A1, false); sh.absarc(0, 0, ri, A1, A0, true); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0 - 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 36 });
  geo.translate(xa, ya, z0 + 0.006);
  return geo;
}
// 水平的板子（俯視的形狀 pts＝[x, z]，從 y0 到 y1）
function JP4_slab(pts, y0, y1, bevel = 0.008) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], -pts[0][1]); for (const [x, z] of pts.slice(1)) sh.lineTo(x, -z); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0 - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, y0 + bevel, 0);
  return geo;
}
const JP4_tube = (pts, r, seg = 40) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)), false, 'catmullrom', 0.2), seg, r, 10, false);
const JP4_mirrorZ = (geo) => { const g = geo.clone(); g.scale(1, 1, -1); const ix = g.index; if (ix) { const a = ix.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } } else { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i += 3) for (const at of [p, n]) { for (let c = 0; c < 3; c++) { const t = at.getComponent(i + 1, c); at.setComponent(i + 1, c, at.getComponent(i + 2, c)); at.setComponent(i + 2, c, t); } } } return g; };
const JP4_both = (geo) => [geo, JP4_mirrorZ(geo)];

// 方形後照鏡：門前面伸出一支黑色的臂，鏡子是黑的方塊、後面是鏡面
function JP4_mirror(mats, s) {
  const g = new THREE.Group();
  const arm = new THREE.Mesh(JP4_tube([[0.56, 1.215, s * 0.85], [0.54, 1.25, s * 0.93], [0.50, 1.28, s * 0.975]], 0.012, 12), mats.black); g.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.19, 0.15), mats.black); head.position.set(0.48, 1.33, s * 1.02); g.add(head);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.135, 0.17), mats.mirrorGlass); gl.rotation.y = -Math.PI / 2; gl.position.set(0.4445, 1.33, s * 1.02); g.add(gl);
  return g;
}

export const JP4_SPEC = {
  look: JP4_LOOK, paint: '#4b5a3a', metal: 0.1, seat: 0x1b1c1f,
  wheels: { xf: 1.22, xr: -1.20, R: JP4_R, rim: JP4_RIM, trackF: 0.80, trackR: 0.80, wF: JP4_TW, wR: JP4_TW, style: JP4_wheel },
  mirror: (paint, mats, s) => JP4_mirror(mats, s),
  wings: {
    none: () => new THREE.Group(),
    rack: (paint, mats) => { // 車頂架：黑色的管子架＋前面一排 LED 燈
      const g = new THREE.Group(), L = [];
      for (const s of [1, -1]) L.push(JP4_tube([[0.20, 1.86, s * 0.70], [0.12, 1.94, s * 0.70], [-1.75, 1.94, s * 0.70], [-1.85, 1.86, s * 0.70]], 0.016, 40));
      for (const x of [0.12, -0.45, -1.05, -1.65]) L.push(JP4_tube([[x, 1.94, -0.70], [x, 1.94, 0.70]], 0.014, 6));
      for (const x of [0.0, -0.80, -1.60]) for (const s of [1, -1]) L.push(JP4_box(0.05, 0.10, 0.04, x, 1.895, s * 0.70));
      g.add(new THREE.Mesh(JP4_merge(L), mats.black));
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.075, 1.12), mats.black); bar.position.set(0.23, 1.99, 0); g.add(bar);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.045), new THREE.MeshStandardMaterial({ color: 0xeef3f8, roughness: 0.15, metalness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.7 }));
      lens.rotation.y = Math.PI / 2; lens.position.set(0.2705, 1.99, 0); g.add(lens);
      return g;
    },
  },
  wing: 'none',
  interior: { dx: -0.10, cage: false, wheelZ: -0.37, dashX: 0.40, dashY: 0.70, shelf: false, bench: { x: -0.95, shelfX: -1.55, shelfY: 0.55 } },
  build(body, paint, mats) {
    const { S, Y0 } = JP4_M;
    for (const n of ['paint', 'inside', 'glass']) { const m = body.getObjectByName(n); if (m) { m.scale.setScalar(1 / S); m.position.set(0, Y0, 0); } }
    const cab = body.getObjectByName('interior'); if (cab) cab.position.y = 0.50; // 車內（parts.js 照跑車的高度做的）整組抬高
    const plastic = new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.82, metalness: 0 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.68, metalness: 0.25 }); // 黑色烤漆的鐵（粗粗的，不像鏡子）
    const red = new THREE.MeshStandardMaterial({ color: 0xc0181c, roughness: 0.35, metalness: 0.2 });
    const amber = new THREE.MeshStandardMaterial({ color: 0xff8a1e, roughness: 0.2, emissive: 0xff6a00, emissiveIntensity: 0.15 });
    const redLens = new THREE.MeshStandardMaterial({ color: 0x8a0508, roughness: 0.15, emissive: 0xff1010, emissiveIntensity: 0.08 });
    // 輪弧（前面的蓋住葉子板外緣，後面的從車身側面伸出來）
    const fl = [JP4_flare(1.22, 0.42, 0.50, 0.605, 18, 168, 0.86, 0.985), JP4_flare(-1.20, 0.42, 0.49, 0.59, 12, 168, 0.835, 0.985)];
    body.add(new THREE.Mesh(JP4_merge(fl.flatMap(JP4_both)), plastic));
    // 側邊的小燈：前輪弧前端橘、後輪弧後端紅
    for (const s of [1, -1]) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.012), amber); a.position.set(1.22 + 0.555 * Math.cos(0.42), 0.42 + 0.555 * Math.sin(0.42), s * 0.987); a.rotation.z = 0.42 + Math.PI / 2; body.add(a);
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.012), redLens); r.position.set(-1.20 - 0.54 * Math.cos(0.30), 0.42 + 0.54 * Math.sin(0.30), s * 0.987); r.rotation.z = -0.30 - Math.PI / 2; body.add(r);
    }
    // 前保桿（黑鐵，兩端斜切）＋紅色拖車勾、後保桿＋拖車球座、側踏（黑管）、門鉸鏈、引擎蓋扣、天線、備胎架
    const st = [
      JP4_slab([[1.97, -0.80], [2.03, -0.965], [2.085, -0.965], [2.13, -0.86], [2.13, 0.86], [2.085, 0.965], [2.03, 0.965], [1.97, 0.80]], 0.50, 0.70),
      JP4_slab([[-2.03, -0.92], [-2.03, 0.92], [-2.08, 0.92], [-2.14, 0.84], [-2.14, -0.84], [-2.08, -0.92]], 0.52, 0.68),
      JP4_box(0.12, 0.055, 0.055, -2.19, 0.56, 0), // 拖車球座
      JP4_box(0.04, 0.10, 0.24, -2.055, 1.04, 0), // 備胎架（尾門上）
      JP4_box(0.17, 0.06, 0.06, -2.12, 1.04, 0),
    ];
    for (const s of [1, -1]) {
      st.push(JP4_tube([[0.62, 0.53, s * 0.85], [0.56, 0.495, s * 0.93], [0.30, 0.49, s * 0.94], [-0.18, 0.49, s * 0.94], [-0.42, 0.495, s * 0.93], [-0.48, 0.53, s * 0.85]], 0.034, 32));
      for (const x of [0.38, -0.25]) st.push(JP4_box(0.05, 0.05, 0.09, x, 0.505, s * 0.885));
    }
    // 車底（從旁邊、前面看車底下是黑色的零件，不會直接看穿到地上）：兩支大樑（在輪胎打到底也碰不到的地方）、前後橫樑、前後軸管＋差速器、引擎下面的護板
    for (const s of [1, -1]) st.push(JP4_box(3.96, 0.12, 0.08, -0.03, 0.50, s * 0.38));
    st.push(JP4_box(0.10, 0.12, 0.84, 1.92, 0.56, 0), JP4_box(0.10, 0.12, 0.84, -1.97, 0.56, 0), JP4_box(0.50, 0.02, 0.80, 1.70, 0.47, 0, 0, 0, 0.08));
    for (const xa of [1.22, -1.20]) {
      const ax = new THREE.CylinderGeometry(0.042, 0.042, 1.24, 12); ax.rotateX(Math.PI / 2); ax.translate(xa, JP4_R, 0); st.push(ax);
      const df = new THREE.SphereGeometry(0.13, 16, 10); df.scale(1, 0.9, 1); df.translate(xa, JP4_R - 0.005, xa > 0 ? 0.12 : 0); st.push(df);
    }
    body.add(new THREE.Mesh(JP4_merge(st), steel));
    const hooks = [];
    for (const s of [1, -1]) { const t = new THREE.TorusGeometry(0.04, 0.013, 8, 18, Math.PI); t.rotateY(Math.PI / 2); t.rotateX(Math.PI / 2); t.translate(2.13, 0.60, s * 0.56); hooks.push(t); }
    body.add(new THREE.Mesh(JP4_merge(hooks), red));
    const blk = [];
    for (const s of [1, -1]) {
      for (const y of [0.80, 1.10]) blk.push(JP4_box(0.06, 0.075, 0.022, 0.665, y, s * 0.866));
      blk.push(JP4_box(0.05, 0.075, 0.03, 1.86, 1.10, s * 0.676), JP4_box(0.03, 0.03, 0.04, 1.86, 1.15, s * 0.672)); // 引擎蓋扣（橡膠 T 字）
      blk.push(JP4_box(0.012, 0.012, 0.46, 0.67, 1.262, s * 0.30 - 0.04, 0, 0, 0)); // 雨刷
    }
    blk.push(new THREE.CylinderGeometry(0.004, 0.006, 0.80, 6).translate(0, 0.40, 0).rotateZ(0.12).translate(1.62, 1.05, 0.80)); // 天線（右前）
    body.add(new THREE.Mesh(JP4_merge(blk), mats.black));
    // 後窗：黑色硬頂後面那塊（遮罩是黑的）上面再蓋一片亮的深色玻璃
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(1.30, 0.44), new THREE.MeshPhysicalMaterial({ color: 0x07090b, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 }));
    rw.rotation.y = -Math.PI / 2; rw.position.set(-2.031, 1.52, 0); body.add(rw);
    // 第三煞車燈（備胎上面）
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.26), redLens); tb.position.set(-2.06, 1.79, 0); body.add(tb);
    // 備胎：跟四個輪子一樣的輪子，掛在尾門上，外側朝後
    const sp = wheel({ R: JP4_R, width: JP4_TW, rim: JP4_RIM, mats, style: JP4_wheel }).wheel;
    sp.rotation.y = -Math.PI / 2; sp.position.set(-2.22, 1.04, 0); sp.name = 'spare'; body.add(sp);
    // 越野套件：絞盤（前保桿中間）＋右邊的涉水喉（從葉子板沿著 A 柱上去，頂上的頭朝前）
    const trail = new THREE.Group(); trail.name = 'trail';
    const wn = [JP4_box(0.16, 0.14, 0.50, 2.06, 0.765, 0), JP4_tube([[2.15, 0.74, 0], [2.20, 0.70, 0], [2.21, 0.64, 0]], 0.012, 8)];
    const dr = new THREE.CylinderGeometry(0.06, 0.06, 0.36, 20); dr.rotateX(Math.PI / 2); dr.translate(2.06, 0.765, 0); wn.push(dr);
    trail.add(new THREE.Mesh(JP4_merge(wn), steel));
    const sn = JP4_tube([[1.42, 0.90, 0.985], [1.40, 1.08, 0.975], [0.70, 1.14, 0.93], [0.62, 1.30, 0.905], [0.40, 1.66, 0.88], [0.36, 1.86, 0.86]], 0.045, 48);
    const snh = new THREE.BoxGeometry(0.16, 0.12, 0.14); snh.translate(0.42, 1.92, 0.86);
    trail.add(new THREE.Mesh(JP4_merge([sn, snh]), plastic));
    body.add(trail);
    return (kit) => { trail.visible = kit === 'trail'; };
  },
  kit: 'stock',
};

// 這台車的標準視角（車比較高，看高一點）
export const JP4_CAMS = {
  front34: { a: 35, d: 8.6, h: 1.95, tx: 0, ty: 0.95, fov: 32 }, rear34: { a: 145, d: 8.6, h: 1.95, tx: -0.1, ty: 0.95, fov: 32 },
  side: { a: 90, d: 11, h: 1.0, tx: 0, ty: 0.95, fov: 28 }, front: { a: 0, d: 10, h: 1.05, tx: 0, ty: 0.95, fov: 20 }, rear: { a: 180, d: 10, h: 1.05, tx: 0, ty: 0.95, fov: 20 },
  low: { a: 28, d: 6.2, h: 0.55, tx: 0.3, ty: 0.85, fov: 40 },
};

export const JP4_GARAGE = {
  name: 'J4 吉普車', sub: '兩門越野車 · 3D 試做版',
  paints: [['#4b5a3a', '軍綠'], ['#c9b48a', '沙色'], ['#e5631e', '亮橘'], ['#b3141c', '紅'], ['#f1f2ee', '白'], ['#151618', '黑'], ['#2d6fb5', '天空藍'], ['#e8b81c', '黃']],
  opts: {
    wing: [['none', '不要'], ['rack', '車頂架']],
    kit: [['stock', '原廠'], ['trail', '越野套件']],
    height: [['0', '原廠'], ['0.05', '升高'], ['0.10', '大升高']],
    livery: [['none', '不要'], ['stripe', '條紋']],
    rimStyle: [['stock', '原廠']],
    wide: [['off', '原廠']],
  },
  state: { paint: '#4b5a3a', rim: 'black', caliper: '#17181b', wing: 'none', kit: 'stock', height: '0', livery: 'none', tint: 'dark' },
};
