// 皮卡（P8，自己設計的四門越野皮卡）：全地形胎（胎面兩排塊、胎肩往下包、胎壁小凸塊）、六根粗輻條的框、黑色的方輪弧、黑色塑膠前保桿＋銀色護板＋紅色拖車勾＋方霧燈、
// 鐵的後踏板保桿＋拖車頭、車門下面的黑色側踏、黑色的大後照鏡、車斗的黑色內襯（地板一條一條、輪拱凸起來）、車艙後面的後窗；
// 越野套件＝車頂一條 LED 燈＋前面的鐵保桿（絞盤、兩顆圓燈、拖車勾）＋擋泥板；防滾架＝車斗裡的黑色鐵管架＋四顆圓燈。
// 車身是 p8-body.mjs 切出來的 body-p8(-q).glb（存成遮罩座標，這裡放大、抬高回公尺），表面細節在 p8-look.js。
import * as THREE from 'three';
import { P8_LOOK, P8_M } from './p8-look.js';

const P8_R = 0.42, P8_RIM = 0.2159, P8_TW = 0.27; // 33 吋全地形胎（胎紋再多 1.4 公分）、17 吋框、寬 270

// 幾何合成一個（只留 position、normal）：同材質的小零件合成一個網格，draw call 少
function P8_merge(list) {
  const P = [], N = []; let n = 0;
  for (let g of list) { if (g.index) g = g.toNonIndexed(); P.push(g.attributes.position.array); N.push(g.attributes.normal.array); n += g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (let i = 0; i < P.length; i++) { pos.set(P[i], o); nor.set(N[i], o); o += P[i].length; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
}
// 方塊：大小 (sx, sy, sz)、位置、轉角（歐拉角 XYZ）
function P8_box(sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
  return g;
}

// 全地形胎的花紋（輪子座標：輪軸 z、外側 +z）：胎面中間兩排交錯的塊、胎肩一排往下包的塊、外側胎壁一圈小凸塊
const P8_TREAD = {};
function P8_treadGeo(R, w) {
  const k = R + ',' + w;
  if (P8_TREAD[k]) return P8_TREAD[k];
  const L = [], N = 34, h = 0.014;
  for (let i = 0; i < N; i++) {
    const t = (i * 2 * Math.PI) / N, rz = t - Math.PI / 2;
    for (const s of [1, -1]) {
      const tc = t + (s > 0 ? 0 : Math.PI / N); // 兩排錯開半格
      L.push(P8_box(0.062, h + 0.004, 0.058, Math.cos(tc) * (R + h / 2 - 0.002), Math.sin(tc) * (R + h / 2 - 0.002), s * 0.038, 0, 0, tc - Math.PI / 2));
      const ts = tc + Math.PI / N * 0.5, rs = R - 0.004, zs = s * (w / 2 - 0.027);
      const sh = P8_box(0.06, 0.022, 0.05, 0, 0, 0, 0, 0, ts - Math.PI / 2);
      sh.applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(ts), Math.cos(ts), 0), -s * 0.5));
      sh.translate(Math.cos(ts) * rs, Math.sin(ts) * rs, zs);
      L.push(sh);
    }
    if (i % 2 === 0) { const tw = t + 0.05, rw = R - 0.045; L.push(P8_box(0.05, 0.03, 0.01, Math.cos(tw) * rw, Math.sin(tw) * rw, w / 2 + 0.002, 0, 0, rz)); }
  }
  return (P8_TREAD[k] = P8_merge(L));
}

// 輪框：六根粗輻條（往內凹一點）＋外圈一圈亮的輪唇＋中間黑色小蓋＋六顆螺帽；輪胎花紋也放在這裡（跟著輪子轉）
export function P8_wheel(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.01, ri = 0.072, N = 6;
  const disc = new THREE.Shape(); disc.absarc(0, 0, ro, 0, Math.PI * 2, false);
  const hw = (r) => 0.030 + ((r - ri) / (ro - ri)) * 0.022; // 輻條半寬：中間 3 公分、外面 5.2 公分
  for (let j = 0; j < N; j++) {
    const a0 = (j * 2 * Math.PI) / N + Math.PI / 6, a1 = a0 + (2 * Math.PI) / N;
    const rA = ri + 0.026, rB = ro - 0.03, n = 8, pts = [];
    for (let i = 0; i <= n; i++) { const r = rA + ((rB - rA) * i) / n; pts.push([Math.cos(a0 + Math.asin(hw(r) / r)) * r, Math.sin(a0 + Math.asin(hw(r) / r)) * r]); }
    const aO0 = a0 + Math.asin(hw(rB) / rB), aO1 = a1 - Math.asin(hw(rB) / rB);
    for (let i = 1; i < 10; i++) { const a = aO0 + ((aO1 - aO0) * i) / 10; pts.push([Math.cos(a) * rB, Math.sin(a) * rB]); }
    for (let i = n; i >= 0; i--) { const r = rA + ((rB - rA) * i) / n; pts.push([Math.cos(a1 - Math.asin(hw(r) / r)) * r, Math.sin(a1 - Math.asin(hw(r) / r)) * r]); }
    const aI0 = a1 - Math.asin(hw(rA) / rA), aI1 = a0 + Math.asin(hw(rA) / rA);
    for (let i = 1; i < 4; i++) { const a = aI0 + ((aI1 - aI0) * i) / 4; pts.push([Math.cos(a) * rA, Math.sin(a) * rA]); }
    const hole = new THREE.Path(); hole.moveTo(...pts[0]); for (const p of pts.slice(1)) hole.lineTo(...p); hole.closePath();
    disc.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(disc, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 40 });
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)); p.setZ(i, p.getZ(i) - 0.03 * (1 - Math.min(1, r / ro)) ** 1.4); }
  geo.computeVertexNormals();
  const face = new THREE.Mesh(geo, mats.chrome); face.position.z = w / 2 - 0.05; g.add(face);
  const lip = new THREE.Mesh(new THREE.RingGeometry(rim - 0.022, rim + 0.004, 64, 1), mats.alu); lip.position.z = w / 2 - 0.022; g.add(lip); // 亮的輪唇
  const nuts = [];
  for (let j = 0; j < 6; j++) { const a = (j * 2 * Math.PI) / 6, b = new THREE.CylinderGeometry(0.011, 0.011, 0.024, 6); b.rotateX(Math.PI / 2); b.translate(Math.cos(a) * 0.06, Math.sin(a) * 0.06, w / 2 - 0.066); nuts.push(b); }
  g.add(new THREE.Mesh(P8_merge(nuts), mats.alu));
  const capG = new THREE.CylinderGeometry(0.034, 0.04, 0.03, 24); capG.rotateX(Math.PI / 2); capG.translate(0, 0, w / 2 - 0.062);
  const back = new THREE.CircleGeometry(rim - 0.015, 40); back.translate(0, 0, w / 2 - 0.15);
  const backIn = new THREE.CircleGeometry(rim + 0.002, 40); backIn.rotateY(Math.PI); backIn.translate(0, 0, -w / 2 + 0.014); // 輪子內側的開口蓋起來（底盤高，車底下看得到）
  g.add(new THREE.Mesh(P8_merge([capG, back, backIn]), mats.black));
  const tr = new THREE.Mesh(P8_treadGeo(P8_R, P8_TW), mats.rubber); tr.name = 'tread'; g.add(tr);
  return g;
}
P8_wheel.capInset = 0.6; // parts.js 的中心蓋、五顆螺帽藏進去（這個框自己有）

// 方方的輪拱（跟 p8-body.mjs 的 P8_ARCH 一樣）：梯形、角修圓
const P8_A = { yc: 0.62, r1: 0.58, r2: 0.46, he: 0.32, rr: 0.14 };
function P8_trap(px, py, r1, r2, he) {
  px = Math.abs(px);
  const k2x = r2 - r1, k2y = 2 * he;
  const cax = px - Math.min(px, py < 0 ? r1 : r2), cay = Math.abs(py) - he;
  const t = Math.max(0, Math.min(1, ((r2 - px) * k2x + (he - py) * k2y) / (k2x * k2x + k2y * k2y)));
  const cbx = px - r2 + k2x * t, cby = py - he + k2y * t;
  return (cbx < 0 && cay < 0 ? -1 : 1) * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby));
}
const P8_arch = (dx, dy) => P8_trap(dx, dy, P8_A.r1 - P8_A.rr, P8_A.r2 - P8_A.rr, P8_A.he - P8_A.rr) - P8_A.rr;
// 輪拱邊上的一圈（距離 lev 的那條線）：從圓心往外找，y 0.53 以上
function P8_archLine(lev, yMin = 0.53) {
  const out = [];
  for (let i = 0; i <= 160; i++) {
    const th = -0.7 + ((Math.PI + 1.4) * i) / 160, c = Math.cos(th), s = Math.sin(th);
    let lo = 0.02, hi = 1.4;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (P8_arch(c * m, s * m) < lev) lo = m; else hi = m; }
    out.push([c * lo, P8_A.yc + s * lo]);
  }
  const res = [];
  for (let i = 0; i < out.length; i++) {
    const [x, y] = out[i], prev = out[i - 1];
    if (prev && (prev[1] >= yMin) !== (y >= yMin)) { const t = (yMin - prev[1]) / (y - prev[1]); res.push([prev[0] + (x - prev[0]) * t, yMin]); }
    if (y >= yMin) res.push([x, y]);
  }
  return res;
}
// 黑色塑膠方輪弧：輪拱邊（往裡多 8 公釐蓋住切口）到外面 7.5 公分那一圈，從 z0 伸到 z1
function P8_flare(xa, z0, z1) {
  const o = P8_archLine(0.075), n = P8_archLine(-0.008).reverse(), sh = new THREE.Shape();
  sh.moveTo(xa + o[0][0], o[0][1]); for (const [x, y] of [...o.slice(1), ...n]) sh.lineTo(xa + x, y); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0 - 0.016, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 12 });
  geo.translate(0, 0, z0 + 0.008);
  return geo;
}
// 水平的板子（俯視的形狀 pts＝[x, z]，從 y0 到 y1）
function P8_slab(pts, y0, y1, bevel = 0.012) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], -pts[0][1]); for (const [x, z] of pts.slice(1)) sh.lineTo(x, -z); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0 - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, y0 + bevel, 0);
  return geo;
}
const P8_tube = (pts, r, seg = 40) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)), false, 'catmullrom', 0.2), seg, r, 10, false);
const P8_mirrorZ = (geo) => { const g = geo.clone(); g.scale(1, 1, -1); const ix = g.index; if (ix) { const a = ix.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } } else { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i += 3) for (const at of [p, n]) { for (let c = 0; c < 3; c++) { const t = at.getComponent(i + 1, c); at.setComponent(i + 1, c, at.getComponent(i + 2, c)); at.setComponent(i + 2, c, t); } } } return g; };
const P8_both = (geo) => [geo, P8_mirrorZ(geo)];
// 圓的東西朝前（+x）：半徑 r、厚 d，中心 (x, y, z)
const P8_disk = (r, d, x, y, z, seg = 24) => { const g = new THREE.CylinderGeometry(r, r, d, seg); g.rotateZ(Math.PI / 2); g.translate(x, y, z); return g; };

// 方的大後照鏡：前門前上角伸出一支黑色的臂，鏡子是黑的方殼、後面是鏡面
function P8_mirror(mats, s) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(P8_tube([[1.0, 1.215, s * 0.885], [0.98, 1.245, s * 0.94], [0.955, 1.265, s * 0.985]], 0.016, 12), mats.black));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.20, 0.155), mats.black); head.position.set(0.95, 1.325, s * 1.005); g.add(head);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.135, 0.175), mats.mirrorGlass); gl.rotation.y = -Math.PI / 2; gl.position.set(0.9095, 1.325, s * 1.005); g.add(gl);
  return g;
}

export const P8_SPEC = {
  look: P8_LOOK, paint: '#c62a2f', metal: 0.15, seat: 0x232528,
  wheels: { xf: 1.70, xr: -1.40, R: P8_R, rim: P8_RIM, trackF: 0.79, trackR: 0.79, wF: P8_TW, wR: P8_TW, style: P8_wheel },
  mirror: (paint, mats, s) => P8_mirror(mats, s),
  wings: {
    none: () => new THREE.Group(),
    rollbar: (paint, mats) => { // 防滾架：車斗裡兩支往上的黑鐵管、上面一條橫的（比車頂高）、往後斜撐，上面四顆圓燈
      const g = new THREE.Group(), L = [], xu = -0.98, zz = 0.80;
      L.push(P8_tube([[xu, 1.17, -zz], [xu, 1.80, -zz], [xu + 0.01, 1.93, -zz + 0.10], [xu + 0.01, 1.96, -0.55], [xu + 0.01, 1.96, 0.55], [xu + 0.01, 1.93, zz - 0.10], [xu, 1.80, zz], [xu, 1.17, zz]], 0.032, 64));
      for (const s of [1, -1]) L.push(P8_tube([[xu - 0.01, 1.90, s * (zz - 0.05)], [-1.30, 1.55, s * zz], [-1.62, 1.17, s * zz]], 0.026, 24));
      L.push(P8_tube([[xu, 1.55, -zz], [xu, 1.55, zz]], 0.024, 8));
      for (const s of [1, -1]) for (const x of [xu, -1.62]) L.push(P8_box(0.12, 0.014, 0.08, x, 1.175, s * zz));
      for (const z of [-0.48, -0.16, 0.16, 0.48]) { L.push(P8_disk(0.07, 0.085, xu + 0.03, 2.045, z, 28)); L.push(P8_box(0.04, 0.05, 0.03, xu + 0.01, 1.99, z)); }
      g.add(new THREE.Mesh(P8_merge(L), mats.black));
      const lens = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.1, metalness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.25 });
      g.add(new THREE.Mesh(P8_merge([-0.48, -0.16, 0.16, 0.48].map((z) => P8_disk(0.058, 0.006, xu + 0.075, 2.045, z, 28))), lens));
      return g;
    },
  },
  wing: 'none',
  interior: { dx: 0.36, cage: false, wheelZ: -0.40, dashX: 0.80, dashY: 0.80, shelf: false, bench: { x: -0.33, shelfX: -0.30, shelfY: 0.30 } },
  build(body, paint, mats) {
    const { S, Y0 } = P8_M;
    for (const n of ['paint', 'inside', 'glass']) { const m = body.getObjectByName(n); if (m) { m.scale.setScalar(1 / S); m.position.set(0, Y0, 0); } }
    const cab = body.getObjectByName('interior'); if (cab) cab.position.y = 0.36; // 車內（parts.js 照跑車的高度做的）整組抬高
    const plastic = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.85, metalness: 0 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.68, metalness: 0.25 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x2e3135, roughness: 0.5, metalness: 0.6 });
    const silver = new THREE.MeshStandardMaterial({ color: 0xb4b8bd, roughness: 0.35, metalness: 0.8 });
    const liner = new THREE.MeshStandardMaterial({ color: 0x222326, roughness: 0.93, metalness: 0 });
    const red = new THREE.MeshStandardMaterial({ color: 0xc8141e, roughness: 0.45, metalness: 0.2 });
    const amber = new THREE.MeshStandardMaterial({ color: 0xff8a1e, roughness: 0.2, emissive: 0xff6a00, emissiveIntensity: 0.15 });
    const redLens = new THREE.MeshStandardMaterial({ color: 0x8a0508, roughness: 0.15, emissive: 0xff1010, emissiveIntensity: 0.08 });
    const lens = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.1, metalness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.25 });
    // 黑色的方輪弧（從車身側面伸出來）
    body.add(new THREE.Mesh(P8_merge([P8_flare(1.70, 0.905, 0.985), P8_flare(-1.40, 0.905, 0.985)].flatMap(P8_both)), plastic));
    // 側邊的小燈：前輪弧前端橘、後輪弧後面紅
    for (const s of [1, -1]) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.012), amber); a.position.set(2.36, 0.86, s * 0.93); body.add(a);
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.012), redLens); r.position.set(-2.46, 0.98, s * 0.931); body.add(r);
    }
    // 前保桿：上面車身色（角圓圓的包到側面）、下面黑色塑膠（圓霧燈）＋最下面銀色護板＋紅色拖車勾
    const shell = new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03 }); shell.color = paint.color; // 跟車漆同一個顏色物件（換車色一起變）
    body.add(new THREE.Mesh(P8_slab([[2.30, -0.915], [2.45, -0.935], [2.555, -0.895], [2.605, -0.75], [2.612, 0], [2.605, 0.75], [2.555, 0.895], [2.45, 0.935], [2.30, 0.915]], 0.60, 0.75, 0.03), shell));
    body.add(new THREE.Mesh(P8_slab([[2.30, -0.90], [2.44, -0.92], [2.54, -0.88], [2.585, -0.74], [2.59, 0], [2.585, 0.74], [2.54, 0.88], [2.44, 0.92], [2.30, 0.90]], 0.38, 0.615, 0.015), plastic));
    body.add(new THREE.Mesh(P8_merge([P8_box(0.34, 0.03, 0.90, 2.44, 0.37, 0, 0, 0, 0.12)]), silver));
    const hooks = [];
    for (const s of [1, -1]) { const t = new THREE.TorusGeometry(0.036, 0.012, 8, 16, Math.PI); t.rotateZ(-Math.PI / 2); t.translate(2.592, 0.46, s * 0.40); hooks.push(t); }
    body.add(new THREE.Mesh(P8_merge(hooks), red));
    const fogR = [], fogL = [];
    for (const s of [1, -1]) { const t = new THREE.TorusGeometry(0.046, 0.009, 8, 24); t.rotateY(Math.PI / 2); t.translate(2.588, 0.50, s * 0.70); fogR.push(t); fogL.push(P8_disk(0.042, 0.006, 2.586, 0.50, s * 0.70)); }
    body.add(new THREE.Mesh(P8_merge(fogR), mats.chrome), new THREE.Mesh(P8_merge(fogL), lens));
    // 後保桿（鐵的踏板保桿）＋上面黑色的止滑條＋拖車頭；車牌（空白）在尾門下面
    body.add(new THREE.Mesh(P8_slab([[-2.50, -0.92], [-2.62, -0.932], [-2.69, -0.88], [-2.712, -0.70], [-2.712, 0.70], [-2.69, 0.88], [-2.62, 0.932], [-2.50, 0.92]], 0.42, 0.63, 0.012), iron));
    body.add(new THREE.Mesh(P8_merge([P8_box(0.12, 0.012, 0.62, -2.645, 0.634, 0), P8_box(0.13, 0.065, 0.065, -2.75, 0.47, 0)]), plastic));
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.15), new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.5 })); plate.rotation.y = -Math.PI / 2; plate.position.set(-2.553, 0.715, 0); body.add(plate); // 車牌在尾門下面中間
    // 側踏：車門下面一支黑管（三個腳架）＋兩塊止滑板
    const step = [];
    for (const s of [1, -1]) {
      step.push(P8_tube([[1.02, 0.43, s * 0.86], [0.98, 0.40, s * 0.95], [-0.58, 0.40, s * 0.95], [-0.62, 0.43, s * 0.86]], 0.03, 48));
      for (const x of [0.82, 0.12, -0.42]) step.push(P8_box(0.05, 0.05, 0.30, x, 0.45, s * 0.80));
      for (const x of [0.62, -0.24]) step.push(P8_box(0.30, 0.012, 0.10, x, 0.432, s * 0.95));
    }
    body.add(new THREE.Mesh(P8_merge(step), plastic));
    // 車底：兩支大樑、橫樑、前面差速器、後軸管＋差速器、車斗下面的備胎、油箱
    const st = [];
    for (const s of [1, -1]) st.push(P8_box(4.70, 0.14, 0.09, -0.05, 0.44, s * 0.45));
    for (const x of [2.20, 0.55, -0.95, -2.35]) st.push(P8_box(0.08, 0.10, 0.90, x, 0.44, 0));
    st.push(P8_box(0.90, 0.22, 0.60, 0.15, 0.44, -0.10));
    const df = new THREE.SphereGeometry(0.12, 16, 10); df.scale(1, 0.85, 1); df.translate(1.70, P8_R - 0.02, 0.06); st.push(df);
    const ax = new THREE.CylinderGeometry(0.04, 0.04, 1.42, 12); ax.rotateX(Math.PI / 2); ax.translate(-1.40, P8_R, 0); st.push(ax);
    const dr = new THREE.SphereGeometry(0.14, 16, 10); dr.scale(1, 0.9, 1); dr.translate(-1.40, P8_R - 0.01, 0.08); st.push(dr);
    body.add(new THREE.Mesh(P8_merge(st), steel));
    const spare = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 32); spare.translate(-2.12, 0.40, 0);
    body.add(new THREE.Mesh(spare, mats.rubber));
    // 雨刷、天線
    const blk = [];
    for (const s of [1, -1]) blk.push(P8_box(0.012, 0.012, 0.56, 1.09, 1.222, s * 0.30 - 0.05));
    blk.push(new THREE.CylinderGeometry(0.003, 0.005, 0.46, 6).translate(0, 0.23, 0).rotateZ(0.30).translate(1.02, 1.17, -0.88)); // 天線（左前，往後倒）
    body.add(new THREE.Mesh(P8_merge(blk), mats.black));
    // 車艙後面的後窗（平的那一段：x = −0.70 + 0.0833·(y − 1.22)，上面往前倒 4.8 度）：黑框＋深色亮玻璃；第三煞車燈在車頂後緣
    const tilt = Math.atan(0.04 / 0.48), backX = (y, out) => -0.70 + 0.0833 * (y - 1.22) - out * Math.cos(tilt);
    const pane = (w, h, y, out, mat) => { const pg = new THREE.PlaneGeometry(w, h); pg.rotateY(-Math.PI / 2); pg.rotateZ(-tilt); pg.translate(backX(y, out), y + out * Math.sin(tilt), 0); return new THREE.Mesh(pg, mat); };
    body.add(pane(1.38, 0.42, 1.475, 0.004, mats.black));
    body.add(pane(1.30, 0.345, 1.475, 0.007, new THREE.MeshPhysicalMaterial({ color: 0x07090b, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 })));
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.026, 0.30), redLens); tb.position.set(-0.668, 1.755, 0); tb.rotation.z = -tilt; body.add(tb);
    // 車斗的黑色內襯：地板（一條一條凸起來）、兩邊、前面、尾門裡面、輪拱凸起來那一塊
    const ln = [P8_box(1.704, 0.006, 1.714, -1.645, 0.843, 0)];
    for (let i = -4; i <= 4; i++) ln.push(P8_box(1.66, 0.012, 0.05, -1.645, 0.852, i * 0.18));
    for (const s of [1, -1]) ln.push(P8_box(1.70, 0.30, 0.006, -1.645, 0.995, s * 0.854));
    ln.push(P8_box(0.006, 0.30, 1.71, -0.796, 0.995, 0), P8_box(0.006, 0.30, 1.71, -2.494, 0.995, 0));
    for (const s of [1, -1]) ln.push(P8_slab([[-1.92, s * 0.60], [-0.88, s * 0.60], [-0.88, s * 0.853], [-1.92, s * 0.853]], 0.84, 0.99, 0.03));
    body.add(new THREE.Mesh(P8_merge(ln), liner));
    // 越野套件：車頂一條 LED 燈、前面的鐵保桿（絞盤、兩顆圓燈、紅色拖車勾）、四個輪子後面的擋泥板
    const trail = new THREE.Group(); trail.name = 'trail';
    const tk = [P8_box(0.075, 0.07, 1.34, 0.30, 1.895, 0)];
    for (const s of [1, -1]) tk.push(P8_box(0.05, 0.05, 0.04, 0.30, 1.858, s * 0.60));
    tk.push(P8_slab([[2.57, -0.80], [2.70, -0.80], [2.735, -0.74], [2.735, 0.74], [2.70, 0.80], [2.57, 0.80]], 0.42, 0.73, 0.01));
    for (const s of [1, -1]) tk.push(P8_disk(0.07, 0.07, 2.69, 0.80, s * 0.58, 28), P8_box(0.05, 0.05, 0.04, 2.67, 0.745, s * 0.58));
    for (const xa of [1.70, -1.40]) for (const s of [1, -1]) tk.push(P8_box(0.012, 0.30, 0.26, xa - 0.60, 0.33, s * 0.82));
    trail.add(new THREE.Mesh(P8_merge(tk), steel));
    trail.add(new THREE.Mesh(P8_merge([P8_box(0.006, 0.045, 1.28, 0.3385, 1.895, 0), ...[1, -1].map((s) => P8_disk(0.058, 0.006, 2.726, 0.80, s * 0.58, 28))]), lens));
    const wh = new THREE.CylinderGeometry(0.06, 0.06, 0.42, 20); wh.rotateX(Math.PI / 2); wh.translate(2.70, 0.70, 0);
    trail.add(new THREE.Mesh(P8_merge([wh, P8_box(0.02, 0.06, 0.22, 2.742, 0.60, 0)]), silver));
    const sh2 = [];
    for (const s of [1, -1]) { const t = new THREE.TorusGeometry(0.04, 0.013, 8, 16, Math.PI); t.rotateZ(-Math.PI / 2); t.translate(2.74, 0.50, s * 0.46); sh2.push(t); }
    trail.add(new THREE.Mesh(P8_merge(sh2), red));
    body.add(trail);
    return (kit) => { trail.visible = kit === 'trail'; };
  },
  kit: 'stock',
};

// 這台車的標準視角（車比較長、比較高）
export const P8_CAMS = {
  front34: { a: 35, d: 9.4, h: 2.1, tx: 0, ty: 0.95, fov: 32 }, rear34: { a: 145, d: 9.4, h: 2.6, tx: -0.2, ty: 0.9, fov: 32 },
  side: { a: 90, d: 12.5, h: 1.0, tx: 0, ty: 0.95, fov: 28 }, front: { a: 0, d: 10, h: 1.05, tx: 0, ty: 0.95, fov: 20 }, rear: { a: 180, d: 10, h: 1.05, tx: 0, ty: 0.95, fov: 20 },
  low: { a: 28, d: 6.8, h: 0.55, tx: 0.4, ty: 0.85, fov: 40 },
};

export const P8_GARAGE = {
  name: 'P8 皮卡', sub: '四門越野皮卡 · 3D 試做版',
  paints: [['#c62a2f', '火山紅'], ['#f1f2ef', '白'], ['#26282c', '黑'], ['#7b8288', '鐵灰'], ['#d6c29a', '沙色'], ['#2f5fa8', '藍'], ['#e07a1f', '橘'], ['#4d5b3a', '軍綠']],
  opts: {
    wing: [['none', '不要'], ['rollbar', '防滾架']],
    kit: [['stock', '原廠'], ['trail', '越野套件']],
    height: [['0', '原廠'], ['0.04', '升高'], ['0.08', '大升高']],
    livery: [['none', '不要'], ['stripe', '條紋'], ['mud', '泥巴']],
    rimStyle: [['stock', '原廠']],
    wide: [['off', '原廠']],
  },
  state: { paint: '#c62a2f', rim: 'gunmetal', caliper: '#17181b', wing: 'none', kit: 'stock', height: '0', livery: 'none', tint: 'dark' },
};
