// 沙灘車（Z2，自己設計的四輪沙灘車＝ATV）：越野塊狀胎（大塊、左右錯開的人字花紋）、12 吋六輻鋁圈＋黑色防脫圈（一圈螺絲）、黑色長座椅、
// 手把（握把、拉桿、中間的儀表罩）、前後 A 臂懸吊＋紅色彈簧的避震器、黑色腳踏板、前保桿、後保桿＋拖車勾、車架、底下的護板、引擎、右邊的排氣管。
// 行李架＝前後置物台上的管子架；越野套件＝大的前保桿＋絞盤＋兩顆圓燈＋護手（車身色）。
// 車身是 z2-body.mjs 切出來的 body-z2(-q).glb（公尺座標，不用縮放），表面細節在 z2-look.js。沒有車內：人騎在座椅上。
import * as THREE from 'three';
import { Z2_LOOK } from './z2-look.js';

const Z2_R = 0.32, Z2_RIM = 0.1524, Z2_WF = 0.20, Z2_WR = 0.25; // 25 吋越野胎、12 吋鋁圈、前胎寬 200、後胎寬 250
const Z2_sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 幾何合成一個（只留 position、normal）：同材質的小零件合成一個網格，draw call 少
function Z2_merge(list) {
  const P = [], N = []; let n = 0;
  for (let g of list) { if (g.index) g = g.toNonIndexed(); P.push(g.attributes.position.array); N.push(g.attributes.normal.array); n += g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (let i = 0; i < P.length; i++) { pos.set(P[i], o); nor.set(N[i], o); o += P[i].length; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
}
// 方塊：大小 (sx, sy, sz)、位置、轉角（歐拉角 XYZ）
function Z2_box(sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
  return g;
}
const Z2_tube = (pts, r, seg = 40, rs = 10) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)), false, 'catmullrom', 0.2), seg, r, rs, false);
const Z2_mirrorZ = (geo) => { const g = geo.clone(); g.scale(1, 1, -1); const ix = g.index; if (ix) { const a = ix.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } } else { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i += 3) for (const at of [p, n]) { for (let c = 0; c < 3; c++) { const t = at.getComponent(i + 1, c); at.setComponent(i + 1, c, at.getComponent(i + 2, c)); at.setComponent(i + 2, c, t); } } } return g; };
const Z2_both = (geo) => [geo, Z2_mirrorZ(geo)];
// 圓柱：兩端 a、b（半徑 r）
function Z2_rod(a, b, r, seg = 12) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), g = new THREE.CylinderGeometry(r, r, d.length(), seg);
  g.applyMatrix4(new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1)));
  return g;
}
// 水平的板子（俯視的形狀 pts＝[x, z]，從 y0 到 y1）
function Z2_slab(pts, y0, y1, bevel = 0.01) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], -pts[0][1]); for (const [x, z] of pts.slice(1)) sh.lineTo(x, -z); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0 - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, y0 + bevel, 0);
  return geo;
}
// 側面的形狀（pts＝[x, y]）往 z 拉，從 z0 到 z1（圓角 bevel）
function Z2_side(pts, z0, z1, bevel = 0.01, smooth = false) {
  const sh = new THREE.Shape(); sh.moveTo(...pts[0]);
  if (smooth) sh.splineThru(pts.slice(1).map((p) => new THREE.Vector2(...p))); else for (const p of pts.slice(1)) sh.lineTo(...p);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0 - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 24 });
  geo.translate(0, 0, z0 + bevel);
  return geo;
}

// ---- 越野胎的花紋（輪子座標：輪軸 z、外側 +z）：胎面兩排大塊（左右錯開半格、斜 17 度＝人字）、胎肩一排往下包的塊；塊高 1.8 公分（0.7 公分埋在胎面裡）----
const Z2_TREAD = {};
function Z2_treadGeo(R, w) {
  const k = R + ',' + w;
  if (Z2_TREAD[k]) return Z2_TREAD[k];
  const L = [], N = 20, h = 0.018, half = w / 2, rc = R - 0.007 + h / 2;
  for (let i = 0; i < N; i++) {
    for (const s of [1, -1]) {
      const t = (i * 2 * Math.PI) / N + (s > 0 ? 0 : Math.PI / N);
      const c = new THREE.BoxGeometry(0.05, h, half * 0.62); // 胎面的塊：沿著圓周 5 公分、往外 h、橫的 0.62 個半寬
      c.rotateY(s * 0.3); c.rotateZ(t - Math.PI / 2); c.translate(Math.cos(t) * rc, Math.sin(t) * rc, s * half * 0.42);
      L.push(c);
      const ts = t + Math.PI / N * 0.35, rs = R - 0.006, zs = s * (half - 0.014); // 胎肩的塊：往胎壁那邊彎下去
      const sh = new THREE.BoxGeometry(0.044, 0.022, 0.034);
      sh.rotateZ(ts - Math.PI / 2);
      sh.applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(ts), Math.cos(ts), 0), -s * 0.6));
      sh.translate(Math.cos(ts) * rs, Math.sin(ts) * rs, zs);
      L.push(sh);
    }
  }
  return (Z2_TREAD[k] = Z2_merge(L));
}

// ---- 輪框：六根輻條（越外面越寬）、外圈一個黑色防脫圈＋16 顆螺絲、中間的蓋子＋4 顆螺帽（沙灘車是 4 孔）；輪胎花紋也放在這裡（跟著輪子轉）----
export function Z2_wheel(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.012, zf = w / 2 - 0.034; // 輪框面凹進去 3.4 公分
  const disc = new THREE.Shape(); disc.absarc(0, 0, ro, 0, Math.PI * 2, false);
  const n = 6, rA = 0.066, rB = ro - 0.018, hw = (r) => 0.012 + ((r - rA) / (rB - rA)) * 0.009;
  for (let j = 0; j < n; j++) {
    const a0 = (j * 2 * Math.PI) / n, a1 = ((j + 1) * 2 * Math.PI) / n, pts = [];
    for (let i = 0; i <= 8; i++) { const r = rA + ((rB - rA) * i) / 8, a = a0 + Math.asin(hw(r) / r); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const aO0 = a0 + Math.asin(hw(rB) / rB), aO1 = a1 - Math.asin(hw(rB) / rB);
    for (let i = 1; i < 10; i++) { const a = aO0 + ((aO1 - aO0) * i) / 10; pts.push([Math.cos(a) * rB, Math.sin(a) * rB]); }
    for (let i = 8; i >= 0; i--) { const r = rA + ((rB - rA) * i) / 8, a = a1 - Math.asin(hw(r) / r); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const aI0 = a1 - Math.asin(hw(rA) / rA), aI1 = a0 + Math.asin(hw(rA) / rA);
    for (let i = 1; i < 5; i++) { const a = aI0 + ((aI1 - aI0) * i) / 5; pts.push([Math.cos(a) * rA, Math.sin(a) * rA]); }
    const hole = new THREE.Path(); hole.moveTo(...pts[0]); for (const p of pts.slice(1)) hole.lineTo(...p); hole.closePath();
    disc.holes.push(hole);
  }
  const face = new THREE.Mesh(new THREE.ExtrudeGeometry(disc, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 48 }), mats.chrome);
  face.position.z = zf; g.add(face);
  // 防脫圈（黑）：蓋在輪胎的胎唇上
  const ring = new THREE.Shape(); ring.absarc(0, 0, 0.166, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(0, 0, 0.128, 0, Math.PI * 2, true); ring.holes.push(hole);
  const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 64 }); rg.translate(0, 0, w / 2 - 0.011);
  g.add(new THREE.Mesh(rg, mats.black));
  // 螺絲（防脫圈上 16 顆）、中間 4 顆螺帽：亮的鋁
  const bolts = [];
  for (let j = 0; j < 16; j++) { const a = (j * 2 * Math.PI) / 16; const b = new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 6); b.rotateX(Math.PI / 2); b.translate(Math.cos(a) * 0.147, Math.sin(a) * 0.147, w / 2 - 0.001); bolts.push(b); }
  for (let j = 0; j < 4; j++) { const a = (j * Math.PI) / 2 + Math.PI / 4; const b = new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6); b.rotateX(Math.PI / 2); b.translate(Math.cos(a) * 0.05, Math.sin(a) * 0.05, zf + 0.022); bolts.push(b); }
  g.add(new THREE.Mesh(Z2_merge(bolts), mats.alu));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.03, 32), mats.chrome); cap.geometry.rotateX(Math.PI / 2); cap.position.z = zf + 0.022; g.add(cap);
  const backIn = new THREE.CircleGeometry(rim + 0.002, 40); backIn.rotateY(Math.PI); backIn.translate(0, 0, -w / 2 + 0.014); // 輪子內側的開口蓋起來
  g.add(new THREE.Mesh(backIn, mats.black));
  const tr = new THREE.Mesh(Z2_treadGeo(Z2_R, w), mats.rubber); tr.name = 'tread'; g.add(tr);
  return g;
}
Z2_wheel.own = true; // 自己有中心蓋和螺帽（4 孔）

// 座椅：側面的形狀往 z 拉（圓角），前面窄、後面寬
function Z2_seatGeo() {
  const top = [[0.12, 0.866], [0.03, 0.881], [-0.30, 0.880], [-0.62, 0.885], [-0.752, 0.880], [-0.797, 0.856], [-0.80, 0.818]];
  const sh = new THREE.Shape(); sh.moveTo(0.165, 0.832); sh.splineThru(top.map((p) => new THREE.Vector2(...p))); sh.lineTo(-0.42, 0.796); sh.lineTo(0.04, 0.803); sh.closePath();
  const W = 0.165, bv = 0.03, geo = new THREE.ExtrudeGeometry(sh, { depth: 2 * (W - bv), bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.8, bevelSegments: 5, curveSegments: 32 });
  geo.translate(0, 0, -(W - bv));
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const f = (0.09 + 0.075 * Z2_sstep(0.15, -0.22, p.getX(i))) / W; p.setZ(i, p.getZ(i) * f); }
  geo.computeVertexNormals();
  return geo;
}
// 避震器：下面 a → 上面 b；鋁的筒（下 60%）、細的桿、紅色彈簧（7 圈）、兩頭的環
function Z2_shock(a, b, out) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length(); d.normalize();
  const m = A.clone().addScaledVector(d, len * 0.6);
  out.alu.push(Z2_rod(a, m.toArray(), 0.019, 16), Z2_rod(m.toArray(), b, 0.008, 8));
  for (const q of [A, B]) { const e = new THREE.TorusGeometry(0.014, 0.005, 6, 12); e.lookAt(new THREE.Vector3(0, 0, 1)); e.translate(q.x, q.y, q.z); out.alu.push(e); }
  const u = new THREE.Vector3(0, 0, 1).cross(d).normalize(), v = d.clone().cross(u), pts = [], turns = 7, s0 = 0.14, s1 = 0.9;
  for (let i = 0; i <= turns * 16; i++) { const t = i / (turns * 16), an = t * turns * 2 * Math.PI, c = A.clone().addScaledVector(d, len * (s0 + (s1 - s0) * t)).addScaledVector(u, Math.cos(an) * 0.034).addScaledVector(v, Math.sin(an) * 0.034); pts.push(c); }
  out.spring.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, 0.0065, 6, false));
  for (const t of [s0 - 0.02, s1 + 0.02]) { const c = A.clone().addScaledVector(d, len * t); out.alu.push(Z2_rod(c.clone().addScaledVector(d, -0.006).toArray(), c.clone().addScaledVector(d, 0.006).toArray(), 0.04, 20)); } // 彈簧座
}
// 一個角的懸吊：A 臂（上下）、轉向節、避震器、傳動軸＋防塵套（前輪多一支轉向拉桿）
function Z2_corner(x0, s, kz, front, out) {
  const bz = (z) => s * z;
  for (const dx of [-0.12, 0.12]) out.arm.push(Z2_tube([[x0 + dx, 0.30, bz(0.155)], [x0 + dx * 0.45, 0.268, bz((0.155 + kz - 0.075) / 2)], [x0, 0.235, bz(kz - 0.075)]], 0.014, 10, 8));
  for (const dx of [-0.09, 0.09]) out.arm.push(Z2_tube([[x0 + dx, 0.47, bz(0.17)], [x0 + dx * 0.45, 0.45, bz((0.17 + kz - 0.1) / 2)], [x0, 0.43, bz(kz - 0.1)]], 0.012, 10, 8));
  out.arm.push(Z2_box(0.05, 0.22, 0.04, x0, 0.33, bz(kz - 0.085)));
  Z2_shock([x0 + 0.02, 0.262, bz(kz - 0.14)], [x0 - 0.02, 0.675, bz(0.218)], out);
  out.steel.push(Z2_rod([x0, 0.32, bz(0.13)], [x0, 0.33, bz(kz - 0.09)], 0.013, 10));
  for (const [z, r0, r1] of [[0.15, 0.022, 0.034], [kz - 0.12, 0.034, 0.022]]) out.boot.push(Z2_rod([x0, 0.32, bz(z - 0.03)], [x0, 0.325, bz(z + 0.03)], (r0 + r1) / 2, 12));
  if (front) out.steel.push(Z2_rod([x0 + 0.08, 0.36, bz(0.10)], [x0 + 0.07, 0.37, bz(kz - 0.09)], 0.007, 8));
}

// 行李架：前後置物台上的黑管子（外框、中間兩條、橫的格子、四支腳）
function Z2_racks() {
  const steel = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.6, metalness: 0.3 }), L = [];
  const rack = (x0, x1, zz, y, deck) => {
    for (const z of [-zz, zz]) L.push(Z2_tube([[x0, y, z], [x1, y, z]], 0.011, 6, 8));
    for (const x of [x0, x1]) L.push(Z2_tube([[x, y, -zz], [x, y, zz]], 0.011, 6, 8));
    for (let x = x0 + 0.08; x < x1 - 0.04; x += 0.08) L.push(Z2_rod([x, y, -zz], [x, y, zz], 0.006, 6));
    for (const z of [-zz / 2, zz / 2]) L.push(Z2_rod([x0, y + 0.004, z], [x1, y + 0.004, z], 0.008, 6));
    for (const x of [x0 + 0.03, x1 - 0.03]) for (const z of [-zz * 0.9, zz * 0.9]) L.push(Z2_rod([x, y, z], [x, deck(x) - 0.01, z], 0.01, 8));
  };
  rack(0.47, 0.89, 0.40, 0.845, (x) => 0.815 - 0.05 * Z2_sstep(0.5, 0.9, x));
  rack(-0.94, -0.42, 0.46, 0.855, () => 0.806);
  const g = new THREE.Group(); g.add(new THREE.Mesh(Z2_merge(L), steel));
  return g;
}

export const Z2_SPEC = {
  look: Z2_LOOK, paint: '#f2c21b', metal: 0.05, seat: 0x17181b,
  wheels: { xf: 0.62, xr: -0.64, R: Z2_R, rim: Z2_RIM, trackF: 0.475, trackR: 0.465, wF: Z2_WF, wR: Z2_WR, style: Z2_wheel },
  wings: {
    none: () => new THREE.Group(),
    rack: () => Z2_racks(),
  },
  wing: 'rack',
  interior: {},
  build(body, paint, mats) {
    const cab = body.getObjectByName('interior'); if (cab) body.remove(cab); // 沒有車內（騎的）
    const plastic = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.85, metalness: 0 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.6, metalness: 0.3 });
    const silver = new THREE.MeshStandardMaterial({ color: 0xb4b8bd, roughness: 0.35, metalness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.5, metalness: 0.6 });
    const fin = new THREE.MeshStandardMaterial({ color: 0x9a9ea4, roughness: 0.4, metalness: 0.9 });
    const spring = new THREE.MeshStandardMaterial({ color: 0xc81e28, roughness: 0.35, metalness: 0.3 });
    const bronze = new THREE.MeshStandardMaterial({ color: 0x8f7f66, roughness: 0.35, metalness: 1 });
    const brushed = new THREE.MeshStandardMaterial({ color: 0xa9adb2, roughness: 0.3, metalness: 1 });
    const seatM = new THREE.MeshPhysicalMaterial({ color: 0x141518, roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.9 });
    const lens = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.1, metalness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.25 });
    const screen = new THREE.MeshPhysicalMaterial({ color: 0x0b0f14, roughness: 0.08, metalness: 0, clearcoat: 1, emissive: 0x0b3346, emissiveIntensity: 0.35 });
    const shell = new THREE.MeshPhysicalMaterial({ roughness: 0.35, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 }); shell.color = paint.color; // 手把罩、護手：跟車漆同一個顏色物件
    // 座椅
    const seat = new THREE.Mesh(Z2_seatGeo(), seatM); seat.name = 'seat'; body.add(seat);
    // 腳踏板（黑色塑膠）：踏板、防滑條、外緣、前後的擋板；外面一支管子（護腳）
    const fw = [Z2_slab([[0.24, 0.205], [0.24, 0.54], [-0.27, 0.54], [-0.27, 0.205]], 0.338, 0.368, 0.008)];
    for (let x = -0.22; x < 0.22; x += 0.055) fw.push(Z2_box(0.012, 0.006, 0.30, x, 0.371, 0.37));
    fw.push(Z2_box(0.51, 0.035, 0.02, -0.015, 0.385, 0.535), Z2_box(0.025, 0.15, 0.35, 0.237, 0.435, 0.38), Z2_box(0.025, 0.15, 0.35, -0.255, 0.435, 0.38));
    body.add(new THREE.Mesh(Z2_merge(fw.flatMap(Z2_both)), plastic));
    // 手把（之後可以跟著轉：bars 這組）：龍頭桿、儀表罩（黑）＋螢幕、把手（深色金屬）、握把、拉桿、油門
    const bars = new THREE.Group(); bars.name = 'bars';
    const bp = [[0.41, 1.005, 0], [0.41, 1.008, 0.10], [0.40, 1.03, 0.20], [0.375, 1.055, 0.29], [0.355, 1.065, 0.42]];
    const barM = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.35, metalness: 0.8 });
    bars.add(new THREE.Mesh(Z2_tube([...bp.slice(1).reverse().map(([x, y, z]) => [x, y, -z]), ...bp], 0.011, 80, 10), barM));
    // 手把罩（車身色）：蓋在油箱蓋上，龍頭桿藏在裡面；後面上面一塊螢幕
    const pod = new THREE.Mesh(Z2_side([[0.50, 0.90], [0.493, 0.952], [0.43, 1.004], [0.37, 1.022], [0.338, 1.006], [0.342, 0.935], [0.40, 0.898]], -0.155, 0.155, 0.03, true), shell);
    bars.add(pod);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.04), screen); scr.position.set(0.385, 1.0265, 0); scr.lookAt(0.385 - 0.35, 1.0265 + 0.94, 0); bars.add(scr);
    const gr = [], lv = [];
    for (const s of [1, -1]) {
      const a = new THREE.Vector3(0.375, 1.055, s * 0.29), b = new THREE.Vector3(0.355, 1.065, s * 0.42), d = b.clone().sub(a).normalize();
      const c0 = a.clone().addScaledVector(d, 0.01), c1 = b.clone().addScaledVector(d, -0.004);
      gr.push(Z2_rod(c0.toArray(), c1.toArray(), 0.017, 16), Z2_rod(c1.toArray(), c1.clone().addScaledVector(d, 0.01).toArray(), 0.02, 16));
      lv.push(Z2_rod([0.395, 1.062, s * 0.275], [0.43, 1.07, s * 0.40], 0.005, 6), Z2_box(0.03, 0.025, 0.03, 0.392, 1.06, s * 0.265));
    }
    gr.push(Z2_box(0.02, 0.03, 0.015, 0.385, 1.045, 0.285, 0, 0, 0.3)); // 油門（右手大拇指）
    bars.add(new THREE.Mesh(Z2_merge(gr), grip), new THREE.Mesh(Z2_merge(lv), mats.alu));
    body.add(bars);
    // 車架、前後橫桿、底下的鋁護板、前面的護板
    const fr = [];
    for (const s of [1, -1]) fr.push(Z2_tube([[0.92, 0.43, s * 0.15], [0.86, 0.31, s * 0.15], [-0.82, 0.31, s * 0.15], [-0.90, 0.43, s * 0.15]], 0.016, 40, 8));
    for (const x of [0.74, 0.40, -0.36, -0.76]) fr.push(Z2_rod([x, 0.31, -0.15], [x, 0.31, 0.15], 0.014, 8));
    // 前保桿（原廠）、後保桿＋拖車勾
    const bumper = new THREE.Mesh(Z2_tube([[0.93, 0.44, -0.30], [1.01, 0.45, -0.30], [1.045, 0.475, -0.24], [1.058, 0.49, 0], [1.045, 0.475, 0.24], [1.01, 0.45, 0.30], [0.93, 0.44, 0.30]], 0.022, 48, 10), steel); bumper.name = 'bumper';
    body.add(bumper);
    fr.push(Z2_tube([[-0.94, 0.47, -0.36], [-1.02, 0.48, -0.30], [-1.045, 0.52, -0.20], [-1.052, 0.53, 0], [-1.045, 0.52, 0.20], [-1.02, 0.48, 0.30], [-0.94, 0.47, 0.36]], 0.018, 48, 10));
    fr.push(Z2_box(0.12, 0.05, 0.05, -1.02, 0.40, 0), Z2_box(0.02, 0.08, 0.10, -0.97, 0.40, 0));
    body.add(new THREE.Mesh(Z2_merge(fr), steel));
    body.add(new THREE.Mesh(Z2_merge([Z2_slab([[0.50, -0.19], [0.50, 0.19], [-0.50, 0.19], [-0.50, -0.19]], 0.275, 0.287, 0.004), Z2_slab([[0.99, -0.20], [0.99, 0.20], [0.74, 0.22], [0.74, -0.22]], 0.405, 0.417, 0.004)]), silver));
    // 引擎：曲軸箱（深灰）、汽缸散熱片（鋁）、左邊的皮帶蓋（黑）、右邊圓的蓋子
    const eng = [Z2_box(0.46, 0.18, 0.26, -0.06, 0.38, 0)];
    eng.push(Z2_side([[-0.28, 0.33], [-0.26, 0.48], [0.10, 0.50], [0.18, 0.44], [0.16, 0.31], [-0.20, 0.30]], -0.19, -0.13, 0.012, true));
    const st = new THREE.CylinderGeometry(0.075, 0.075, 0.035, 28); st.rotateX(Math.PI / 2); st.translate(-0.10, 0.40, 0.15); eng.push(st);
    body.add(new THREE.Mesh(Z2_merge(eng), dark));
    const fins = []; for (let k = 0; k < 6; k++) fins.push(Z2_box(0.17, 0.008, 0.2, 0.12, 0.425 + k * 0.018, 0, 0, 0, -0.2));
    body.add(new THREE.Mesh(Z2_merge(fins), fin));
    // 排氣管（右邊）：排氣歧管（燒過的顏色）→ 消音器（不鏽鋼）→ 尾管（黑）
    body.add(new THREE.Mesh(Z2_tube([[0.20, 0.47, 0.05], [0.25, 0.41, 0.10], [0.17, 0.355, 0.165], [-0.06, 0.36, 0.185], [-0.32, 0.45, 0.20], [-0.46, 0.56, 0.225], [-0.53, 0.60, 0.235]], 0.02, 60, 10), bronze));
    const muf = new THREE.CylinderGeometry(0.058, 0.058, 0.40, 28); muf.rotateZ(Math.PI / 2); muf.translate(-0.72, 0.60, 0.235);
    body.add(new THREE.Mesh(muf, brushed));
    const mc = []; for (const x of [-0.52, -0.92]) mc.push(Z2_rod([x - 0.006, 0.60, 0.235], [x + 0.006, 0.60, 0.235], 0.061, 28));
    mc.push(Z2_rod([-0.92, 0.60, 0.235], [-0.985, 0.60, 0.235], 0.022, 16));
    body.add(new THREE.Mesh(Z2_merge(mc), steel));
    // 懸吊：前後 A 臂（黑）、避震器（鋁＋紅彈簧）、傳動軸（黑）＋防塵套、差速器
    const sus = { arm: [], alu: [], spring: [], steel: [], boot: [] };
    for (const s of [1, -1]) { Z2_corner(0.62, s, 0.475, true, sus); Z2_corner(-0.64, s, 0.465, false, sus); }
    sus.steel.push(Z2_box(0.16, 0.15, 0.20, 0.62, 0.32, 0), Z2_box(0.18, 0.16, 0.22, -0.64, 0.32, 0), Z2_rod([-0.55, 0.32, 0.03], [0.53, 0.32, 0.03], 0.016, 10));
    body.add(new THREE.Mesh(Z2_merge(sus.arm), steel), new THREE.Mesh(Z2_merge(sus.alu), mats.alu), new THREE.Mesh(Z2_merge(sus.spring), spring), new THREE.Mesh(Z2_merge(sus.steel), dark), new THREE.Mesh(Z2_merge(sus.boot), plastic));
    // 車牌（後面中間，空白）＋黑色的框
    body.add(new THREE.Mesh(Z2_box(0.012, 0.125, 0.19, -1.004, 0.625, 0), plastic));
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.105), new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.5 })); plate.rotation.y = -Math.PI / 2; plate.position.set(-1.0105, 0.625, 0); body.add(plate);
    // 越野套件：大的前保桿＋絞盤＋兩顆圓燈、護手（車身色）
    const trail = new THREE.Group(); trail.name = 'trail';
    const gd = [Z2_tube([[0.93, 0.44, -0.34], [1.05, 0.45, -0.34], [1.09, 0.52, -0.30], [1.10, 0.70, -0.24], [1.10, 0.735, 0], [1.10, 0.70, 0.24], [1.09, 0.52, 0.30], [1.05, 0.45, 0.34], [0.93, 0.44, 0.34]], 0.024, 64, 10),
      Z2_rod([1.09, 0.56, -0.29], [1.09, 0.56, 0.29], 0.018, 10)];
    for (const z of [-0.10, 0.10]) gd.push(Z2_rod([1.10, 0.56, z], [1.10, 0.73, z], 0.015, 8));
    for (const s of [1, -1]) gd.push(Z2_box(0.05, 0.04, 0.05, 1.10, 0.755, s * 0.17), Z2_rod([1.105, 0.80, s * 0.17], [1.15, 0.80, s * 0.17], 0.052, 24));
    const winch = new THREE.CylinderGeometry(0.045, 0.045, 0.26, 24); winch.rotateX(Math.PI / 2); winch.translate(1.055, 0.50, 0);
    trail.add(new THREE.Mesh(Z2_merge(gd), steel), new THREE.Mesh(winch, plastic));
    trail.add(new THREE.Mesh(Z2_merge([Z2_rod([1.15, 0.80, 0.17], [1.154, 0.80, 0.17], 0.046, 24), Z2_rod([1.15, 0.80, -0.17], [1.154, 0.80, -0.17], 0.046, 24)]), lens));
    const hg = [];
    for (const s of [1, -1]) { const h = Z2_side([[0.37, 1.10], [0.45, 1.09], [0.475, 1.05], [0.44, 1.03], [0.43, 1.06], [0.38, 1.075]], 0.29, 0.43, 0.008, true); if (s < 0) hg.push(Z2_mirrorZ(h)); else hg.push(h); }
    trail.add(new THREE.Mesh(Z2_merge(hg), shell));
    body.add(trail);
    return (kit) => { trail.visible = kit === 'trail'; bumper.visible = kit !== 'trail'; };
  },
  kit: 'stock',
};

// 這台車的標準視角（車很小）
export const Z2_CAMS = {
  front34: { a: 35, d: 4.6, h: 1.55, tx: 0, ty: 0.62, fov: 32 }, rear34: { a: 145, d: 4.6, h: 1.55, tx: -0.05, ty: 0.62, fov: 32 },
  side: { a: 90, d: 6.4, h: 0.72, tx: 0, ty: 0.6, fov: 26 }, front: { a: 0, d: 6, h: 0.75, tx: 0, ty: 0.6, fov: 20 }, rear: { a: 180, d: 6, h: 0.75, tx: 0, ty: 0.6, fov: 20 },
  low: { a: 28, d: 3.6, h: 0.45, tx: 0.2, ty: 0.55, fov: 40 }, top: { a: 90, d: 0.01, h: 8, tx: 0, ty: 0, fov: 25 },
};

export const Z2_GARAGE = {
  name: 'Z2 沙灘車', sub: '四輪沙灘車 · 3D 試做版',
  paints: [['#f2c21b', '閃電黃'], ['#d42a2a', '紅'], ['#1d5fc4', '藍'], ['#7ac943', '萊姆綠'], ['#ef6c1a', '橘'], ['#f2f2ee', '白'], ['#1e1f22', '黑'], ['#5b6b3f', '軍綠']],
  opts: {
    wing: [['rack', '行李架'], ['none', '不要']],
    kit: [['stock', '原廠'], ['trail', '越野套件']],
    height: [['0', '原廠'], ['0.03', '升高'], ['0.06', '大升高']],
    livery: [['none', '不要'], ['race', '號碼'], ['stripe', '條紋']],
    rimStyle: [['stock', '原廠']],
    wide: [['off', '原廠']],
  },
  state: { paint: '#f2c21b', rim: 'black', caliper: '#17181b', wing: 'rack', kit: 'stock', height: '0', livery: 'race', tint: 'dark' },
};
