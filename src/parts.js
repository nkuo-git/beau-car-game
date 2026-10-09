// 3D Supra 的零件：輪子（輪胎＋五輻輪框＋碟盤＋卡鉗）、尾翼、後照鏡、車內
import * as THREE from 'three';

export const MAT = {
  rubber: () => new THREE.MeshPhysicalMaterial({ color: 0x0c0c0d, roughness: 0.82, metalness: 0 }),
  chrome: () => new THREE.MeshPhysicalMaterial({ color: 0xe8eaec, roughness: 0.07, metalness: 1 }),
  alu: () => new THREE.MeshPhysicalMaterial({ color: 0xc9ccd0, roughness: 0.28, metalness: 1 }),
  disc: () => new THREE.MeshPhysicalMaterial({ color: 0x6d6f72, roughness: 0.45, metalness: 0.9 }),
  caliper: () => new THREE.MeshPhysicalMaterial({ color: 0x9da1a6, roughness: 0.3, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  black: () => new THREE.MeshPhysicalMaterial({ color: 0x0a0a0b, roughness: 0.5, metalness: 0 }),
  gloss: () => new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.15, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }),
  carbon: () => new THREE.MeshPhysicalMaterial({ color: 0x17181b, roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  polish: () => new THREE.MeshPhysicalMaterial({ color: 0xdadde2, roughness: 0.1, metalness: 1 }), // 拋光輪唇（不跟輪框顏色）
};

// 多輻輪框（照片那台 GT-R）：12 組 V 形雙輻，從中間往外、往內凹
function multiSpoke(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.014, rh = 0.078, zo = w / 2 - 0.03, zi = w / 2 - 0.085;
  for (let j = 0; j < 12; j++) {
    const a = (j * 2 * Math.PI) / 12;
    for (const s of [-1, 1]) {
      const ai = a + s * 0.07, ao = a + s * 0.155; // 中間靠近、外面分開
      const P = (r, ang, z, off) => [Math.cos(ang) * r - Math.sin(ang) * off, Math.sin(ang) * r + Math.cos(ang) * off, z];
      const wi = 0.0068, wo = 0.0052;
      const geo = slab([P(rh, ai, zi, -wi), P(ro, ao, zo, -wo), P(ro, ao, zo, wo), P(rh, ai, zi, wi)], 0.016);
      g.add(new THREE.Mesh(geo, mats.chrome));
    }
  }
  // 中間的輪轂（深色）＋外圈一道亮邊
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.1, 0.04, 48), mats.chrome);
  hub.geometry.rotateX(Math.PI / 2); hub.position.z = zi + 0.006; g.add(hub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ro + 0.002, 0.006, 8, 96), mats.chrome);
  ring.position.z = zo + 0.004; g.add(ring);
  return g;
}

// ---- 輪子：輪軸沿著 z，外側朝 +z ----
export function wheel({ R = 0.325, width = 0.235, rim = 0.2413, mats, style = 'five' } = {}) {
  const g = new THREE.Group();
  const w = width;
  // 輪胎剖面（r, 軸向）：內側胎唇 → 胎壁 → 胎肩 → 胎面 → 外側
  const tp = [
    [rim + 0.004, -w / 2 + 0.012], [rim + 0.02, -w / 2 + 0.002], [R - 0.045, -w / 2], [R - 0.016, -w / 2 + 0.008], [R - 0.003, -w / 2 + 0.028],
    [R, -w / 2 + 0.05], [R, w / 2 - 0.05], [R - 0.003, w / 2 - 0.028], [R - 0.016, w / 2 - 0.008], [R - 0.045, w / 2], [rim + 0.02, w / 2 - 0.002], [rim + 0.004, w / 2 - 0.012],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tire = new THREE.Mesh(new THREE.LatheGeometry(tp, 96), mats.rubber); tire.name = 'tire';
  tire.geometry.rotateX(Math.PI / 2);
  g.add(tire);
  // 輪框筒＋外緣亮邊
  const bp = [
    [rim - 0.012, -w / 2 + 0.01], [rim + 0.006, -w / 2 + 0.006], [rim + 0.006, -w / 2 + 0.02], [rim - 0.01, -w / 2 + 0.03],
    [rim - 0.01, w / 2 - 0.035], [rim + 0.004, w / 2 - 0.022], [rim + 0.012, w / 2 - 0.012], [rim + 0.012, w / 2 - 0.004], [rim + 0.002, w / 2 + 0.002], [rim - 0.012, w / 2 - 0.004],
    [rim - 0.018, w / 2 - 0.02],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(bp, 96), mats.chrome); barrel.name = 'barrel'; // 換輪框時有拋光輪唇的樣式會換成 mats.polish
  barrel.geometry.rotateX(Math.PI / 2);
  g.add(barrel);
  // 輪框內側暗一點（看得到的筒內）
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(rim - 0.018, rim - 0.018, w * 0.8, 64, 1, true), mats.disc);
  inner.geometry.rotateX(Math.PI / 2); inner.material = mats.barrelIn; inner.position.z = -0.01;
  g.add(inner);
  g.add(rimFace(style, rim, w, mats)); // 輪框面（輻條＋中心蓋＋螺帽），換輪框時整組換掉
  // 碟盤＋卡鉗（不跟著輪子轉，放在另一個 group）
  const brake = new THREE.Group();
  const d = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.028, 64), mats.disc);
  d.geometry.rotateX(Math.PI / 2); d.position.z = w / 2 - 0.11; brake.add(d);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 40), mats.disc);
  hat.geometry.rotateX(Math.PI / 2); hat.position.z = w / 2 - 0.085; brake.add(hat);
  // 卡鉗：包住碟盤外緣的一塊（弧形、四角修圓），在碟盤後上方
  const ca = new THREE.Shape(), r0 = 0.118, r1 = 0.198, A = 0.62;
  ca.absarc(0, 0, r1, -A / 2, A / 2, false); ca.absarc(0, 0, r0, A / 2, -A / 2, true); ca.closePath();
  const cal = new THREE.Mesh(new THREE.ExtrudeGeometry(ca, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 20 }), mats.caliper);
  cal.rotation.z = Math.PI * 0.64; cal.position.z = w / 2 - 0.135; brake.add(cal);
  return { wheel: g, brake };
}

// ---- 輪框面：輻條＋中心蓋＋螺帽（放在輪子 group 裡一起轉；setRim 換樣式時只換這一組）----
// style：車自己的函式 style(rim, w, mats)、'five'（預設）、'multi'，或 RIM_FACES 裡的 'mesh'、'six'、'fan'、'dish'；hand：右輪 1、左輪 -1（有方向的樣式左右相反）
export function rimFace(style, rim, w, mats, hand = 1) {
  const g = new THREE.Group(); g.name = 'rimface';
  if (RIM_FACES[style]) { g.add(RIM_FACES[style](rim, w, mats, hand)); return g; } // 新樣式自己有中心蓋和螺帽
  if (typeof style === 'function') g.add(style(rim, w, mats)); // 各台車自己的輪框：style(rim, w, mats) 回傳輻條（外側朝 +z）
  else if (style === 'multi') g.add(multiSpoke(rim, w, mats));
  else {
    // 五根輻條：圓盤挖掉五個洞
    const ro = rim - 0.012, ri = 0.062;
    const disc = new THREE.Shape(); disc.absarc(0, 0, ro, 0, Math.PI * 2, false);
    const hw = (r) => 0.021 + (r - ri) / (ro - ri) * 0.013;
    for (let j = 0; j < 5; j++) {
      const a0 = (j * 2 * Math.PI) / 5, a1 = ((j + 1) * 2 * Math.PI) / 5;
      const pts = [];
      const rA = ri + 0.018, rB = ro - 0.02, n = 10;
      for (let i = 0; i <= n; i++) { const r = rA + ((rB - rA) * i) / n; const a = a0 + Math.asin(hw(r) / r); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      const aO0 = a0 + Math.asin(hw(rB) / rB), aO1 = a1 - Math.asin(hw(rB) / rB);
      for (let i = 1; i < 12; i++) { const a = aO0 + ((aO1 - aO0) * i) / 12; pts.push([Math.cos(a) * rB, Math.sin(a) * rB]); }
      for (let i = n; i >= 0; i--) { const r = rA + ((rB - rA) * i) / n; const a = a1 - Math.asin(hw(r) / r); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      const aI0 = a1 - Math.asin(hw(rA) / rA), aI1 = a0 + Math.asin(hw(rA) / rA);
      for (let i = 1; i < 6; i++) { const a = aI0 + ((aI1 - aI0) * i) / 6; pts.push([Math.cos(a) * rA, Math.sin(a) * rA]); }
      const hole = new THREE.Path(); hole.moveTo(...pts[0]); for (const p of pts.slice(1)) hole.lineTo(...p); hole.closePath();
      disc.holes.push(hole);
    }
    const face = new THREE.Mesh(new THREE.ExtrudeGeometry(disc, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2, curveSegments: 64 }), mats.chrome);
    face.position.z = w / 2 - 0.045;
    g.add(face);
  }
  // 中心蓋＋螺帽
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.03, 40), mats.chrome);
  const capZ = typeof style === 'function' ? w / 2 - (style.capInset ?? 0.03) : style === 'multi' ? w / 2 - 0.058 : w / 2 - 0.012;
  cap.geometry.rotateX(Math.PI / 2); cap.position.z = capZ; g.add(cap);
  for (let j = 0; j < 5; j++) {
    const a = (j * 2 * Math.PI) / 5 + Math.PI / 5;
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 6), mats.chrome);
    nut.geometry.rotateX(Math.PI / 2); nut.position.set(Math.cos(a) * 0.062, Math.sin(a) * 0.062, capZ - 0.004); g.add(nut);
  }
  return g;
}

// ---- 換裝的輪框樣式（任何車都能用，照這個輪子的輪框半徑 rim、寬度 w 縮放）----
// 後面的碟盤、卡鉗不轉：卡鉗 r 0.106–0.21、z 到 w/2−0.073，碟盤帽 r＜0.085、z 到 w/2−0.06
// → 輻條背面最深 w/2−0.058；最外面不超過胎壁（w/2）。零件先做成幾何，同材質的合成一個網格（draw call 少）
function rimMerge(list) { // 幾何合成一個（只留 position、normal）
  const P = [], N = []; let n = 0;
  for (let g of list) { if (g.index) g = g.toNonIndexed(); P.push(g.attributes.position.array); N.push(g.attributes.normal.array); n += g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (let i = 0; i < P.length; i++) { pos.set(P[i], o); nor.set(N[i], o); o += P[i].length; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
}
function rimMeshes(parts) { const g = new THREE.Group(); for (const [list, m] of parts) if (list.length) g.add(new THREE.Mesh(rimMerge(list), m)); return g; }
// 一段一段的剖面接成實心條（輻條、葉片）：secs＝幾個點數一樣的剖面，頭尾封起來；每一面順著長度平滑、稜角是利的
function rimLoft(secs) {
  const ctr = (s) => s.reduce((a, p) => a.map((v, i) => v + p[i] / s.length), [0, 0, 0]);
  const s0 = secs[0], nn = [0, 0, 0], c0 = ctr(secs[0]), c1 = ctr(secs[1]);
  s0.forEach((p, i) => { const q = s0[(i + 1) % s0.length]; nn[0] += (p[1] - q[1]) * (p[2] + q[2]); nn[1] += (p[2] - q[2]) * (p[0] + q[0]); nn[2] += (p[0] - q[0]) * (p[1] + q[1]); });
  if (nn[0] * (c1[0] - c0[0]) + nn[1] * (c1[1] - c0[1]) + nn[2] * (c1[2] - c0[2]) < 0) secs = secs.map((s) => s.slice().reverse()); // 剖面要繞著前進方向逆時針，法線才朝外
  const m = s0.length, out = [], F = secs[0], L = secs[secs.length - 1], cap = [];
  for (let k = 0; k < m; k++) { // 每一面一條：順著長度共用頂點（平滑），跟旁邊的面不共用（稜角利）
    const k1 = (k + 1) % m, pos = [], idx = [];
    secs.forEach((S, i) => { pos.push(...S[k], ...S[k1]); if (i) { const a = 2 * (i - 1); idx.push(a, a + 1, a + 3, a, a + 3, a + 2); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); out.push(g);
  }
  for (let k = 1; k < m - 1; k++) cap.push(...F[0], ...F[k + 1], ...F[k], ...L[0], ...L[k], ...L[k + 1]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(cap, 3)); g.computeVertexNormals(); out.push(g);
  return rimMerge(out);
}
// 直的輻條：A→B（[x, y, 背面 z]），寬 wa→wb、厚 ta→tb，上面比下面窄（兩邊斜的倒角）
function rimBar(A, B, wa, wb, ta, tb, top = 0.62) {
  const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy), px = -dy / l, py = dx / l;
  const sec = (P, w, t) => [[P[0] - (px * w) / 2, P[1] - (py * w) / 2, P[2]], [P[0] + (px * w) / 2, P[1] + (py * w) / 2, P[2]],
    [P[0] + (px * w * top) / 2, P[1] + (py * w * top) / 2, P[2] + t], [P[0] - (px * w * top) / 2, P[1] - (py * w * top) / 2, P[2] + t]];
  return rimLoft([sec(A, wa, ta), sec(B, wb, tb)]);
}
const rimLathe = (pts, n = 96) => new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), n).rotateX(Math.PI / 2); // 剖面 [r, z]，往裡走的面朝外
const rimCyl = (rF, rB, h, n, z, x = 0, y = 0) => new THREE.CylinderGeometry(rF, rB, h, n).rotateX(Math.PI / 2).translate(x, y, z); // 軸沿 z，rF＝前面的半徑
function rimNuts(list, n, r, z, a0 = Math.PI / 5, s = 0.009, h = 0.014) { for (let j = 0; j < n; j++) { const a = a0 + (j * 2 * Math.PI) / n; list.push(rimCyl(s, s, h, 6, z, Math.cos(a) * r, Math.sin(a) * r)); } }

// 'six'：六根直輻（TE37 那種）：粗、直、往中間凹，平的輪轂上五顆螺帽＋小中心蓋
function rimSix(rim, w, mats) {
  const zf = w / 2, k = rim / 0.254, ro = rim - 0.011, rh = 0.07, C = [];
  for (let j = 0; j < 6; j++) {
    const a = (j * Math.PI) / 3 + Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    C.push(rimBar([c * rh, s * rh, zf - 0.058], [c * ro, s * ro, zf - 0.034], 0.06 * k, 0.042 * k, 0.026, 0.02, 0.8));
  }
  C.push(rimCyl(0.086, 0.09, 0.024, 48, zf - 0.046)); // 輪轂（前面跟輻條根部一樣高）
  C.push(rimCyl(0.026, 0.03, 0.012, 32, zf - 0.028)); // 中心蓋
  rimNuts(C, 5, 0.058, zf - 0.03, Math.PI / 2 + Math.PI / 5, 0.009, 0.012);
  return rimMeshes([[C, mats.chrome]]);
}
// 'mesh'：BBS RS 那種交叉網狀輻條＋外圈一圈小螺絲，外面是有階梯的拋光輪唇
function rimMesh(rim, w, mats) {
  const zf = w / 2, k = rim / 0.254, C = [], Pl = [];
  Pl.push(rimLathe([[rim - 0.018, zf - 0.02], [rim - 0.026, zf - 0.0215], [rim - 0.0275, zf - 0.029], [rim - 0.036, zf - 0.0305], [rim - 0.037, zf - 0.04]])); // 階梯輪唇（接在輪框筒內緣後面）
  const r1 = rim - 0.0375, r0 = rim - 0.053, rm = (r0 + r1) / 2;
  C.push(rimLathe([[r1, zf - 0.05], [r1, zf - 0.036], [r0, zf - 0.036], [r0, zf - 0.05]])); // 網子外圈
  for (let j = 0; j < 20; j++) { const a = (j * Math.PI * 2) / 20; Pl.push(rimCyl(0.0042, 0.0048, 0.008, 6, zf - 0.034, Math.cos(a) * rm, Math.sin(a) * rm)); } // 一圈螺絲
  // 交叉輻條：每根從輪轂往外轉 1.5 格，兩個方向交叉成兩圈菱形；其中一個方向高 2 公釐（交叉的地方才不會閃）
  const N = 12, rh = 0.08, re = r0 + 0.004, dA = (Math.PI * 2) / N;
  for (let j = 0; j < N; j++) for (const s of [1, -1]) {
    const a = j * dA + Math.PI / 2, b = a + s * dA * 1.5, up = s > 0 ? 0.002 : 0;
    C.push(rimBar([Math.cos(a) * rh, Math.sin(a) * rh, zf - 0.058 + up], [Math.cos(b) * re, Math.sin(b) * re, zf - 0.048 + up], 0.018 * k, 0.015 * k, 0.012, 0.011, 0.72));
  }
  C.push(rimCyl(0.086, 0.09, 0.012, 48, zf - 0.052)); // 輪轂
  C.push(rimCyl(0.05, 0.052, 0.01, 40, zf - 0.041), rimCyl(0.036, 0.04, 0.004, 40, zf - 0.034)); // 中心蓋（兩層）
  rimNuts(C, 5, 0.068, zf - 0.04, Math.PI / 2 + Math.PI / 5, 0.009, 0.012);
  return rimMeshes([[C, mats.chrome], [Pl, mats.polish]]);
}
// 'fan'：渦輪扇（turbofan）：平的圓盤上很多片彎的葉片（葉片之間是暗的），中間一顆大的中央螺帽；hand：左右輪葉片方向相反
function rimFan(rim, w, mats, hand = 1) {
  const zf = w / 2, ro = rim - 0.012, C = [], B = [];
  const N = 18, r1 = 0.092, r2 = ro - 0.018, zt = zf - 0.024, hw = (Math.PI / N) * 0.6;
  B.push(rimCyl(r2 + 0.006, r2 + 0.006, 0.004, 96, zf - 0.046)); // 葉片後面的暗色平盤
  C.push(rimLathe([[ro + 0.004, zf - 0.046], [ro + 0.004, zt], [r2, zt], [r2, zf - 0.046]])); // 外圈
  C.push(rimLathe([[r1 + 0.004, zf - 0.046], [r1 + 0.004, zt + 0.002], [0, zt + 0.002]], 64)); // 中間的平盤
  for (let j = 0; j < N; j++) { // 葉片：往外越彎越多，前緣高、後緣低（像風扇）
    const secs = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, r = r1 + (r2 - r1) * t, th = (j * 2 * Math.PI) / N + hand * 0.95 * Math.pow(t, 1.3), a0 = th - hand * hw, a1 = th + hand * hw;
      const P = (a, z) => [Math.cos(a) * r, Math.sin(a) * r, z];
      secs.push([P(a0, zt - 0.008), P(a1, zt - 0.017), P(a1, zt - 0.009), P(a0, zt)]);
    }
    C.push(rimLoft(secs));
  }
  C.push(rimCyl(0.036, 0.036, 0.016, 6, zf - 0.014), rimCyl(0.018, 0.022, 0.004, 24, zf - 0.004)); // 中央螺帽＋小蓋
  return rimMeshes([[C, mats.chrome], [B, mats.black]]);
}
// 'dish'：深盤：很寬的拋光輪唇斜斜往裡凹下去，細輻條放在很深的盤底；盤底一圈鉚釘（三片式）
function rimDish(rim, w, mats) {
  const zf = w / 2, k = rim / 0.254, D = Math.min(0.054, Math.max(0.04, 0.17 * w)), rb = rim - 0.018 - 0.034 * k, C = [], Pl = [];
  Pl.push(rimLathe([[rim - 0.018, zf - 0.02], [rim - 0.022, zf - 0.0215], [rb, zf - D + 0.002], [rb - 0.003, zf - D], [rb - 0.015, zf - D]])); // 輪唇＋盤底一小圈平的
  for (let j = 0; j < 24; j++) { const a = (j * Math.PI * 2) / 24; Pl.push(new THREE.SphereGeometry(0.0042, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(Math.cos(a) * (rb - 0.009), Math.sin(a) * (rb - 0.009), zf - D)); } // 鉚釘
  const rh = 0.066, re = rb - 0.01;
  for (let j = 0; j < 8; j++) { // 八根細輻條
    const a = (j * Math.PI) / 4 + Math.PI / 8, c = Math.cos(a), s = Math.sin(a);
    C.push(rimBar([c * rh, s * rh, zf - 0.058], [c * re, s * re, zf - D - 0.004], 0.02 * k, 0.013 * k, 0.012, 0.01));
  }
  C.push(rimCyl(0.072, 0.076, 0.012, 40, zf - 0.052), rimCyl(0.03, 0.032, 0.012, 32, zf - 0.04)); // 輪轂＋中心蓋
  rimNuts(C, 5, 0.052, zf - 0.041, Math.PI / 2 + Math.PI / 5, 0.0085, 0.012);
  return rimMeshes([[C, mats.chrome], [Pl, mats.polish]]);
}
const RIM_FACES = { mesh: rimMesh, six: rimSix, fan: rimFan, dish: rimDish };
export const RIM_POLISH = { mesh: true, dish: true }; // 這些樣式的輪框筒（外緣）換成拋光的輪唇

// ---- 尾翼（GT 大尾翼）：鋁的翼片、黑色端板、兩根鋁支架 ----
export function gtWing({ span = 1.74, chord = 0.32, x = -1.74, y = 1.30, deck = 0.93, mats } = {}) {
  const g = new THREE.Group();
  // 翼剖面（倒過來的機翼：下面彎、上面平）
  const s = new THREE.Shape();
  const N = 24, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, xc = (1 - Math.cos(Math.PI * t)) / 2;
    const th = 0.12 * 5 * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
    const camber = -0.06 * Math.sin(Math.PI * xc) * (1 - 0.3 * xc);
    top.push([xc, camber + th]); bot.push([xc, camber - th]);
  }
  const P = (p) => [(-p[0] + 0.5) * chord, p[1] * chord];
  s.moveTo(...P(top[0]));
  for (const p of top.slice(1)) s.lineTo(...P(p));
  for (const p of bot.slice().reverse().slice(1)) s.lineTo(...P(p));
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: span, bevelEnabled: false, curveSegments: 4 }), mats.alu);
  blade.geometry.translate(0, 0, -span / 2);
  blade.rotation.z = 0.10; // 前緣稍微朝下
  blade.position.set(x, y, 0);
  g.add(blade);
  // 端板
  const ep = new THREE.Shape();
  const ew = 0.40, eh = 0.30, r = 0.03;
  ep.moveTo(-ew / 2 + r, -eh * 0.62); ep.lineTo(ew / 2 - r, -eh * 0.62); ep.quadraticCurveTo(ew / 2, -eh * 0.62, ew / 2, -eh * 0.62 + r);
  ep.lineTo(ew / 2, eh * 0.38 - r); ep.quadraticCurveTo(ew / 2, eh * 0.38, ew / 2 - r, eh * 0.38); ep.lineTo(-ew / 2 + 0.06, eh * 0.38);
  ep.lineTo(-ew / 2, eh * 0.2); ep.lineTo(-ew / 2, -eh * 0.62 + r); ep.quadraticCurveTo(-ew / 2, -eh * 0.62, -ew / 2 + r, -eh * 0.62);
  for (const sz of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.ExtrudeGeometry(ep, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }), mats.gloss);
    e.position.set(x - 0.01, y + 0.01, sz * (span / 2) - (sz > 0 ? 0 : 0.008));
    g.add(e);
  }
  // 支架：從行李箱蓋往上，稍微往後傾
  for (const sz of [-1, 1]) {
    const st = new THREE.Shape();
    const hh = y - deck - 0.02;
    st.moveTo(-0.08, 0); st.lineTo(0.08, 0); st.lineTo(0.04, hh); st.lineTo(-0.05, hh); st.closePath();
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(st, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }), mats.alu);
    m.position.set(x + 0.04, deck, sz * 0.55 - 0.006);
    g.add(m);
  }
  return g;
}

// ---- 賽道套件：碳纖維前下巴（含兩根拉桿）、保桿角的風刀、側裙下的刀片、後擴散器 ----
// 一片有厚度的板子：給四個角（依序），往板子法線兩邊各長 th/2
export function slab(pts, th) {
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
// 賽道套件的位置（Supra 預設）；GT-R 另外給一組
export const AERO_SUPRA = {
  front: [[2.357, 0], [2.345, 0.30], [2.30, 0.52], [2.22, 0.68], [2.10, 0.79], [1.99, 0.83]], back: 1.93, y: 0.112, rods: [2.29, 0.16],
  canard: { S: [2.105, 0.735], t: [-0.737, 0.676], ys: [0.30, 0.225] },
  skirt: { y: 0.132, x0: -0.90, x1: 0.78, z0: 0.80, z1: 0.925 },
  diff: { x0: -1.76, x1: -2.06, x2: -2.225, y0: 0.150, y1: 0.174, y2: 0.258, w: 0.64, fin0: -1.84 },
};
export function aeroKit(mats, A = AERO_SUPRA) {
  const g = new THREE.Group(), m = mats.carbon;
  // 前下巴：沿著保桿下緣再往前伸，後緣收在保桿底下
  const front = A.front, zb = front[front.length - 1][1];
  const sh = new THREE.Shape();
  sh.moveTo(A.back, -zb); sh.lineTo(front[front.length - 1][0], -zb);
  sh.splineThru(front.slice(0, -1).reverse().map(([x, z]) => new THREE.Vector2(x, -z)));
  sh.splineThru(front.slice(1).map(([x, z]) => new THREE.Vector2(x, z)));
  sh.lineTo(A.back, zb); sh.closePath();
  const sp = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false, curveSegments: 24 }), m);
  sp.rotation.x = Math.PI / 2; sp.position.y = A.y; g.add(sp);
  if (A.rods) for (const z of [-0.36, 0.36]) { // 拉桿
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.13, 8), mats.alu);
    rod.position.set(A.rods[0], A.rods[1], z); rod.rotation.z = -0.55; g.add(rod);
  }
  for (const s of [-1, 1]) {
    // 保桿角上的兩片風刀（後緣翹起來）
    if (A.canard) {
      const S = A.canard.S, t = A.canard.t, n = [t[1], -t[0]]; // n：朝外
      for (const y of A.canard.ys) {
        const P = (a, b, dy) => [S[0] + t[0] * a + n[0] * b, y + dy, s * (S[1] + t[1] * a + n[1] * b)];
        const pts = [P(-0.075, -0.015, 0), P(0.075, -0.015, 0.03), P(0.05, 0.075, 0.03), P(-0.035, 0.055, 0)];
        g.add(new THREE.Mesh(slab(s > 0 ? pts : pts.reverse(), 0.006), m));
      }
    }
    // 側裙下的刀片
    const k = A.skirt;
    g.add(new THREE.Mesh(slab([[k.x0, k.y, s * k.z0], [k.x1, k.y, s * k.z0], [k.x1 - 0.04, k.y, s * k.z1], [k.x0 + 0.04, k.y, s * k.z1]], 0.01), m));
  }
  // 後擴散器：一片往後上翹的板子＋五片直的導流片
  const D = A.diff;
  if (D) {
    g.add(new THREE.Mesh(slab([[D.x0, D.y0, -D.w], [D.x0, D.y0, D.w], [D.x1, D.y1, D.w - 0.01], [D.x1, D.y1, -D.w + 0.01]], 0.01), m));
    g.add(new THREE.Mesh(slab([[D.x1, D.y1, -D.w + 0.01], [D.x1, D.y1, D.w - 0.01], [D.x2, D.y2, D.w - 0.04], [D.x2, D.y2, -D.w + 0.04]], 0.01), m));
    for (const z of [-0.52, -0.26, 0, 0.26, 0.52]) {
      const f = new THREE.Shape(); f.moveTo(D.fin0, D.y0 + 0.005); f.lineTo(D.x1, D.y1 - 0.002); f.lineTo(D.x2, D.y2 - 0.003); f.lineTo(D.x2, D.y0 - 0.02); f.lineTo(D.x1 + 0.06, D.y0 - 0.02); f.closePath();
      const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(f, { depth: 0.008, bevelEnabled: false }), m);
      fin.position.z = z - 0.004; g.add(fin);
    }
  }
  return g;
}

// GT-R「玩命關頭」套件：照片那台的碳纖維前下巴（一片薄板＋前緣往下折一點）
export function lip(mats, front, back, y) {
  const g = new THREE.Group();
  const zb = front[front.length - 1][1];
  const sh = new THREE.Shape();
  sh.moveTo(back, -zb); sh.lineTo(front[front.length - 1][0], -zb);
  sh.splineThru(front.slice(0, -1).reverse().map(([x, z]) => new THREE.Vector2(x, -z)));
  sh.splineThru(front.slice(1).map(([x, z]) => new THREE.Vector2(x, z)));
  sh.lineTo(back, zb); sh.closePath();
  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 24 }), mats.carbon);
  plate.rotation.x = Math.PI / 2; plate.position.y = y; g.add(plate);
  return g;
}

// R34 原廠尾翼：跟車身同色的翼片（兩端往下彎）、黑色可調尾緣、兩根支柱
export function r34Wing(paintMat, mats, { x = -2.05, y = 1.105, deck = 0.99, span = 1.36, chord = 0.25, post = 0.42 } = {}) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  const N = 20, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, xc = (1 - Math.cos(Math.PI * t)) / 2;
    const th = 0.13 * 5 * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
    const camber = 0.03 * Math.sin(Math.PI * xc);
    top.push([xc, camber + th]); bot.push([xc, camber - th]);
  }
  const P = (p) => [(-p[0] + 0.5) * chord, p[1] * chord];
  s.moveTo(...P(top[0])); for (const p of top.slice(1)) s.lineTo(...P(p)); for (const p of bot.slice().reverse().slice(1)) s.lineTo(...P(p));
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: span, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 3, curveSegments: 4 }), paintMat);
  blade.geometry.translate(0, 0, -span / 2); blade.rotation.z = -0.06; blade.position.set(x, y, 0); g.add(blade);
  // 兩端往下彎的翼端
  for (const sz of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), paintMat);
    tip.scale.set(chord * 0.5, 0.05, 0.035); tip.position.set(x, y - 0.018, sz * (span / 2 + 0.012)); g.add(tip);
  }
  // 尾緣的黑色可調片
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, span * 0.96), mats.gloss);
  flap.position.set(x - chord * 0.5 - 0.006, y + 0.012, 0); flap.rotation.z = 0.5; g.add(flap);
  // 支柱：下寬上窄、往後傾
  for (const sz of [-1, 1]) {
    const st = new THREE.Shape(), hh = y - deck - 0.01;
    st.moveTo(-0.075, 0); st.lineTo(0.075, 0); st.lineTo(0.035, hh); st.lineTo(-0.055, hh); st.closePath();
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(st, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 }), paintMat);
    m.position.set(x + 0.03, deck - 0.01, sz * post - 0.015); g.add(m);
  }
  return g;
}

// 排氣管尾端：鈦色的橢圓管口（外面亮、裡面黑）
export function exhaust(mats, x, y, z, size = 1, oval = 0.72) { // size：放大倍數，oval：高／寬
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.16, 32, 1, true), mats.alu);
  tube.geometry.rotateZ(Math.PI / 2); tube.material.side = THREE.DoubleSide; g.add(tube);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.046, 32), mats.black);
  inner.rotation.y = -Math.PI / 2; inner.position.x = -0.05; g.add(inner);
  g.scale.set(1, oval * size, size); g.position.set(x, y, z);
  return g;
}

// Supra 原廠拱形尾翼（照 Nick 2026-09-27 傳的紅色 Supra 車尾照片量的，rear3d/hit-supra.mjs）：
// 兩邊支柱從行李箱蓋往上、前緣往後斜，上面圓角彎過來接成一片翼，整支跟車身同色
export function mk4Wing(paintMat, { z = 0.635, top = 1.128, te = -2.11, th = 0.034, bend = 0.10 } = {}) {
  const LE = [[0.80, -1.68], [0.925, -1.74], [1.03, -1.93], [1.08, -1.95]]; // 前緣 x 隨高度（腳插進行李箱蓋裡）
  const le = (y) => { if (y <= LE[0][0]) return LE[0][1]; for (let i = 1; i < LE.length; i++) if (y <= LE[i][0]) { const [y0, x0] = LE[i - 1], [y1, x1] = LE[i], t = (y - y0) / (y1 - y0); return x0 + (x1 - x0) * t; } return LE[LE.length - 1][1]; };
  // 路徑（z, y）：左腳 → 左支柱 → 圓角 → 翼 → 圓角 → 右支柱 → 右腳
  const yb = 0.80, yc = top - bend, path = [];
  for (let i = 0; i <= 12; i++) path.push([-z, yb + ((yc - yb) * i) / 12]);
  for (let i = 1; i <= 10; i++) { const a = Math.PI - (Math.PI / 2) * (i / 10); path.push([-z + bend + bend * Math.cos(a), yc + bend * Math.sin(a)]); }
  for (let i = 1; i < 16; i++) path.push([-z + bend + (2 * (z - bend) * i) / 16, top]);
  for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 - (Math.PI / 2) * (i / 10); path.push([z - bend + bend * Math.cos(a), yc + bend * Math.sin(a)]); }
  for (let i = 1; i <= 12; i++) path.push([z, yc - ((yc - yb) * i) / 12]);
  // 翼剖面：對稱的 NACA 厚度，前緣到尾緣（上面）再回來（下面）
  const K = 14, us = [], ring = [];
  for (let k = 0; k <= K; k++) us.push((1 - Math.cos((Math.PI * k) / K)) / 2);
  const tk = (u) => 5 * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4) / 0.6;
  for (const u of us) ring.push([u, 1]);
  for (const u of us.slice(1, -1).reverse()) ring.push([u, -1]);
  const pos = [], idx = [], cols = ring.length + 1;
  path.forEach(([pz, py], i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    let tz = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tz, ty); tz /= l; ty /= l;
    const nz = -ty, ny = tz; // 厚度方向＝(-x) × 路徑方向（在 zy 平面上）
    const x0 = le(py), ch = te - x0;
    for (let j = 0; j <= ring.length; j++) {
      const [u, sg] = ring[j % ring.length], t = (th / 2) * tk(u) * sg;
      pos.push(x0 + ch * u, py + ny * t, pz + nz * t);
    }
  });
  for (let i = 0; i < path.length - 1; i++) for (let j = 0; j < cols - 1; j++) { const a = i * cols + j, b = a + cols; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, paintMat));
  return g;
}

// R34 後照鏡：方中帶圓的殼（同車色）、黑色底座、鏡面朝後
export function mirrorR34(paintMat, mats, side = 1) {
  const g = new THREE.Group();
  const sh = new THREE.Shape(), w = 0.17, h = 0.10, r = 0.035;
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); sh.lineTo(w / 2, h / 2 - r);
  sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + 0.01, h / 2); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const shell = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 4, curveSegments: 12 }), paintMat);
  // 形狀在 xy（x 往前、y 往上），往 z 拉厚；殼的前面圓、後面平一點
  shell.geometry.translate(0, 0, -0.03); shell.geometry.rotateY(side > 0 ? 0 : Math.PI); shell.position.set(0.01, 0, side * 0.11);
  shell.rotation.y = side * -0.12;
  g.add(shell);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.075), mats.mirrorGlass);
  glass.rotation.y = -Math.PI / 2; glass.position.set(-0.098, 0, side * 0.108); g.add(glass);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.08), mats.black);
  foot.position.set(0.02, -0.035, side * 0.04); g.add(foot);
  return g;
}

// ---- 後照鏡（流線型，跟車身同色）----
export function mirror(paintMat, mats, side = 1) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), paintMat);
  head.scale.set(0.105, 0.048, 0.07);
  head.position.set(0, 0, side * 0.1);
  g.add(head);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(1, 32), mats.mirrorGlass);
  glass.scale.set(0.043, 0.085, 1); glass.rotation.y = -Math.PI / 2; glass.rotation.z = Math.PI / 2;
  glass.position.set(-0.055, 0, side * 0.1);
  g.add(glass);
  const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.09), paintMat);
  stalk.position.set(0.01, -0.02, side * 0.045);
  g.add(stalk);
  return g;
}

// ---- 車內：看得到的座椅、儀表板、方向盤 ----
export function interior(mats, o = {}) {
  const dx = o.dx ?? 0, cage = o.cage ?? true, swZ = o.wheelZ ?? -0.36, sy = o.seatDy ?? 0; // seatDy：座椅整組往下（車頂很低的跑車）
  const g = new THREE.Group();
  const box = (w, h, d, m, x, y, z, rz = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.z = rz; g.add(b); return b; };
  // 儀表板
  box(0.40, 0.14, 1.20, mats.black, (o.dashX ?? 0.40), (o.dashY ?? 0.85), 0, 0.15);
  // 座椅（藍色桶椅）
  for (const z of [-0.36, 0.36]) {
    box(0.5, 0.12, 0.46, mats.seat, -0.18 + dx, 0.40 + sy, z);
    box(0.13, 0.62, 0.46, mats.seat, -0.46 + dx, 0.70 + sy, z, -0.22);
    box(0.08, 0.14, 0.24, mats.seat, -0.56 + dx, 1.06 + sy, z, -0.22);
  }
  // 方向盤（左駕）
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 10, 36), mats.black);
  sw.rotation.y = Math.PI / 2; sw.rotation.x = 0; sw.rotation.z = 0; sw.position.set(0.25 + dx, 0.86, swZ);
  sw.rotateOnAxis(new THREE.Vector3(0, 0, 1), 0.35);
  g.add(sw);
  // 防滾籠（白色的管子）
  const tube = (pts, r = 0.018) => { const c = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))); const m = new THREE.Mesh(new THREE.TubeGeometry(c, 32, r, 8), mats.cage); g.add(m); };
  if (cage) {
    tube([[-0.66, 0.30, -0.62], [-0.66, 0.95, -0.60], [-0.64, 1.14, -0.42], [-0.63, 1.17, 0], [-0.64, 1.14, 0.42], [-0.66, 0.95, 0.60], [-0.66, 0.30, 0.62]]);
    tube([[-0.64, 1.15, 0.30], [-0.66, 0.40, -0.55]]);
    tube([[-0.63, 1.16, -0.52], [0.10, 1.17, -0.55], [0.55, 0.92, -0.62]]);
    tube([[-0.63, 1.16, 0.52], [0.10, 1.17, 0.55], [0.55, 0.92, 0.62]]);
  }
  // 中央通道
  box(1.0, 0.2, 0.22, mats.black, 0.0, 0.35, 0);
  // 後座上方的置物板、後面的隔板（擋住看進行李箱）
  if (o.bench) { // 四人座（GT-R）：後座椅墊、椅背、後擋下面的置物板
    const b = o.bench;
    box(0.45, 0.12, 1.2, mats.seat, b.x, 0.42, 0);
    box(0.12, 0.55, 1.2, mats.seat, b.x - 0.26, 0.70, 0, -0.3);
    box(0.42, 0.03, 1.3, mats.black, b.shelfX, b.shelfY, 0);
    box(2.8, 0.04, 1.5, mats.black, -0.3, 0.24, 0);
  } else {
    if (o.shelf !== false) { // shelf: false → 沒有後面的置物板（中置引擎車，座椅後面就是引擎蓋）
      box(0.75, 0.03, 1.36, mats.black, -1.18, 0.93, 0);
      box(0.04, 0.62, 1.4, mats.black, -0.86, 0.62, 0);
    }
    // 地板與後面的隔板
    box(2.0, 0.04, 1.5, mats.black, -0.1, 0.24, 0);
    box(0.04, 0.5, 1.4, mats.black, -0.85, 0.55, 0);
  }
  return g;
}

// ---- 寬體：四個輪拱外面加一片外掛的寬葉子板（跟車身同一個材質，所以車色、拉花、縫都會跟著），輪子往外推 ----
// W＝WIDE[key]（make-wide.mjs 從車身 SDF 量的）：每個輪拱每個角度 th，從輪拱邊緣 ra 往外每 dr 公尺車身側面的 z
// 葉子板邊緣凸到輪胎外推後再往外 1.2 公分，往外 15 公分慢慢收回車身；外緣比車身高 8 公釐、一圈鉚釘，兩端和最下面切平
export const WIDE_PUSH = { f: 0.05, r: 0.065 };
export function wideKit(paint, W, mats) {
  const g = new THREE.Group(); g.name = 'wide';
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const T0 = 0.008;
  const bolt = new THREE.CylinderGeometry(0.0072, 0.0085, 0.008, 10);
  const boltMat = mats?.barrelIn || new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 1 });
  const up = new THREE.Vector3(0, 1, 0), nv = new THREE.Vector3(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
  const sub = (p, r) => [p[0] - r[0], p[1] - r[1], p[2] - r[2]];
  for (const ax of ['f', 'r']) {
    const A = W[ax], n = A.th.length, NK = A.z[0].length, zT = A.zt + WIDE_PUSH[ax] + 0.012;
    const th0 = A.th[0], th1 = A.th[n - 1];
    for (const sd of [1, -1]) {
      // 一列＝一個角度：[往裡折回的唇邊, 唇邊圓角, 葉子板面 0..NK-1]
      const grid = [];
      for (let i = 0; i < n; i++) {
        const t = (A.th[i] * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), r0 = A.ra[i];
        const e = 0.4 + 0.6 * ss(th0, th0 + 30, A.th[i]) * (1 - ss(th1 - 30, th1, A.th[i])); // 兩端比較不凸
        const z0 = A.z[i][0], D = Math.min(0.1, Math.max(0.04, zT - z0)) * e;
        const P = (r, z) => [A.x + c * r, Math.max(A.yCut, A.y + s * r), sd * z];
        const row = [P(r0 - 0.012, z0 - 0.04), P(r0 - 0.016, z0 + T0 + D - 0.012)];
        const kn = A.kn ? A.kn[i] : NK; // 超出車身輪廓的點停在輪廓上
        for (let k = 0; k < NK; k++) { const r = r0 + Math.min(k, kn - 1) * W.dr; row.push(P(r, A.z[i][k] + T0 + D * (1 - ss(0.02, 0.15, r - r0)))); }
        grid.push(row);
      }
      const inset = (p, i, k) => [p[0], p[1], sd * (A.z[i][Math.max(0, Math.min(NK - 1, k))] - 0.02)]; // 同一點往車身裡面收
      const pos = [], idx = [];
      const strip = (rows) => { // 一片網格（自己的頂點，這樣摺角是利的）
        const o = pos.length / 3, cols = rows[0].length;
        for (const r of rows) for (const p of r) pos.push(p[0], p[1], p[2]);
        for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < cols - 1; j++) {
          const a = o + i * cols + j, b = a + cols;
          if (sd > 0) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
      };
      strip(grid);
      strip(grid.map((r, i) => [r[r.length - 1], inset(r[r.length - 1], i, NK - 1)])); // 外緣的牆
      strip([grid[0].map((p, j) => inset(p, 0, j - 2)), grid[0]]); // 兩端的牆
      strip([grid[n - 1], grid[n - 1].map((p, j) => inset(p, n - 1, j - 2))]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, paint));
      // 鉚釘：外緣往裡 2 公分，每 12 度一顆
      const kb = NK; // 葉子板面倒數第二欄（前面有兩欄唇邊）
      const spots = [];
      for (let i = 1; i < n - 1; i += 2) {
        const p = grid[i][kb];
        if (p[1] < A.yCut + 0.03 || (A.kn && A.kn[i] < NK)) continue;
        const t1 = sub(grid[i + 1][kb], grid[i - 1][kb]), t2 = sub(grid[i][kb + 1], grid[i][kb - 1]);
        nv.set(t1[1] * t2[2] - t1[2] * t2[1], t1[2] * t2[0] - t1[0] * t2[2], t1[0] * t2[1] - t1[1] * t2[0]).normalize();
        if (nv.z * sd < 0) nv.negate();
        spots.push([p, nv.clone()]);
      }
      const bolts = new THREE.InstancedMesh(bolt, boltMat, spots.length);
      spots.forEach(([p, nn], k) => { q.setFromUnitVectors(up, nn); m4.compose(new THREE.Vector3(p[0], p[1], p[2]).addScaledVector(nn, 0.002), q, one); bolts.setMatrixAt(k, m4); });
      g.add(bolts);
    }
  }
  return g;
}

// ---- 底盤霓虹燈（setGlow）：地上一片柔柔的光，加色、不寫深度，比車身大一圈、邊緣慢慢淡掉 ----
// x0、x1：車身前後，hz：車身半寬。光的形狀在 shader 裡算（到車身外框＝圓角長方形的距離），不用貼圖
// 混色：光是直接加上去的（src×1），alpha 只把底下的地板壓暗一點（dst×(1−k·f)）：暗的地方（暗攝影棚、柏油）跟純加色一樣是霓虹，
// 亮的地板才看得出顏色（純加色會變成白白的）；k＝0 就是純加色。顏色用畫面上的 sRGB 直接輸出（不經過色調對應，才會飽和）
// 要畫在車底影子（y 0.002–0.006、renderOrder 0）上面：y 0.012＋renderOrder 3＋polygonOffset；f 加一點點抖動，暗的地方才不會一圈一圈（shader 裡只放英文）
// 有霧（車庫 Fog 11–26、賽道 80–560）就跟著淡掉：加色的光不能混霧的顏色，直接乘 (1−霧)
export function neonPad(x0, x1, hz, k = 0.7) {
  const m = 0.75, PX = x1 - x0 + 2 * m, PZ = 2 * hz + 2 * m;
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uColor: { value: new THREE.Color(1, 1, 1) }, uK: { value: k }, uBox: { value: new THREE.Vector4((x1 - x0) / 2 - 0.1, hz - 0.08, 0.45, m) } },
    vertexShader: `#include <fog_pars_vertex>
varying vec2 vP;
void main() { vP = position.xy; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `#include <fog_pars_fragment>
uniform vec3 uColor; uniform float uK; uniform vec4 uBox; varying vec2 vP;
void main() {
  vec2 q = abs(vP) - uBox.xy + uBox.z;
  float d = max(0.0, length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uBox.z);
  float f = (0.45 * exp(-d / 0.12) + 0.55 * exp(-d * d / 0.1444)) * (1.0 - smoothstep(0.4, uBox.w + 0.08, d));
  f += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.55) - 0.5) / 255.0;
  f = clamp(f, 0.0, 1.0);
#ifdef USE_FOG
#ifdef FOG_EXP2
  f *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
#else
  f *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
#endif
#endif
  gl_FragColor = vec4(uColor * f, uK * f);
}`,
    fog: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(PX, PZ), mat);
  pad.rotation.x = -Math.PI / 2; pad.position.set((x0 + x1) / 2, 0.012, 0); pad.renderOrder = 3; pad.name = 'glow';
  pad.setColor = (c) => mat.uniforms.uColor.value.setStyle(c, THREE.LinearSRGBColorSpace); // 照字面的 sRGB 值（不轉線性）
  return pad;
}
