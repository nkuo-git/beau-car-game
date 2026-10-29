// 小越野車（K2，自己設計的三門小越野車）：全地形胎（胎面兩排小塊、胎肩一排）、白色鐵框（八個圓洞）、黑色的圓輪弧、黑色塑膠保桿＋銀色護板＋圓霧燈、
// 尾門上的備胎（車身色硬殼蓋）、圓的後照鏡；越野套件＝前面的防撞桿＋兩顆圓燈＋擋泥板；車頂籃＝車頂的籃子架。
// 車身是 k2-body.mjs 切出來的 body-k2(-q).glb（存成遮罩座標，這裡放大、抬高回公尺），表面細節在 k2-look.js。
import * as THREE from 'three';
import { K2_LOOK, K2_M } from './k2-look.js';

const K2_R = 0.365, K2_RIM = 0.2032, K2_TW = 0.235; // 全地形胎（胎紋再多 1.2 公分）、16 吋鐵框、寬 235

// 幾何合成一個（只留 position、normal）：同材質的小零件合成一個網格，draw call 少
function K2_merge(list) {
  const P = [], N = []; let n = 0;
  for (let g of list) { if (g.index) g = g.toNonIndexed(); P.push(g.attributes.position.array); N.push(g.attributes.normal.array); n += g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (let i = 0; i < P.length; i++) { pos.set(P[i], o); nor.set(N[i], o); o += P[i].length; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
}
// 方塊：大小 (sx, sy, sz)、位置、轉角（歐拉角 XYZ）
function K2_box(sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
  return g;
}

// 全地形胎的花紋（輪子座標：輪軸 z、外側 +z）：胎面中間兩排交錯的小塊、胎肩一排往下包的塊（比吉普車的越野胎細）
const K2_TREAD = {};
function K2_treadGeo(R, w) {
  const k = R + ',' + w;
  if (K2_TREAD[k]) return K2_TREAD[k];
  const L = [], N = 36, h = 0.012;
  for (let i = 0; i < N; i++) {
    const t = (i * 2 * Math.PI) / N;
    for (const s of [1, -1]) {
      const tc = t + (s > 0 ? 0 : Math.PI / N);
      L.push(K2_box(0.052, h + 0.004, 0.05, Math.cos(tc) * (R + h / 2 - 0.002), Math.sin(tc) * (R + h / 2 - 0.002), s * 0.034, 0, 0, tc - Math.PI / 2));
      const ts = tc + Math.PI / N * 0.5, rs = R - 0.004, zs = s * (w / 2 - 0.026);
      const sh = K2_box(0.05, 0.02, 0.045, 0, 0, 0, 0, 0, ts - Math.PI / 2);
      sh.applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(ts), Math.cos(ts), 0), -s * 0.5));
      sh.translate(Math.cos(ts) * rs, Math.sin(ts) * rs, zs);
      L.push(sh);
    }
  }
  return (K2_TREAD[k] = K2_merge(L));
}

// 鐵框：一片往外鼓的圓盤，外圈八個圓洞、中間一圈凸起來（中心蓋、五顆螺帽是 parts.js 加的：capInset）；輪胎花紋也放在這裡（跟著輪子轉）
export function K2_wheel(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.012, disc = new THREE.Shape(); disc.absarc(0, 0, ro, 0, Math.PI * 2, false);
  for (let j = 0; j < 8; j++) { const a = (j * 2 * Math.PI) / 8 + Math.PI / 8, h = new THREE.Path(); h.absarc(Math.cos(a) * 0.135, Math.sin(a) * 0.135, 0.026, 0, Math.PI * 2, true); disc.holes.push(h); }
  const geo = new THREE.ExtrudeGeometry(disc, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 48 });
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)); p.setZ(i, p.getZ(i) + 0.012 * (1 - Math.min(1, Math.max(0, (r - 0.10) / 0.08)))); } // 中間往外鼓 1.2 公分
  geo.computeVertexNormals();
  const face = new THREE.Mesh(geo, mats.chrome); face.position.z = w / 2 - 0.05; g.add(face);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.084, 0.09, 0.016, 40), mats.chrome); hub.geometry.rotateX(Math.PI / 2); hub.position.z = w / 2 - 0.03; g.add(hub);
  const backIn = new THREE.CircleGeometry(rim + 0.002, 40); backIn.rotateY(Math.PI); backIn.translate(0, 0, -w / 2 + 0.014); // 輪子內側的開口蓋起來（底盤高，車底下看得到）
  g.add(new THREE.Mesh(backIn, mats.black));
  const tr = new THREE.Mesh(K2_treadGeo(K2_R, K2_TW), mats.rubber); tr.name = 'tread'; g.add(tr);
  return g;
}
K2_wheel.capInset = 0.026;

// 黑色塑膠輪弧：圓弧帶（內半徑 ri、外半徑 ro、從 a0 到 a1 度）往外伸到 z1
function K2_flare(xa, ya, ri, ro, a0, a1, z0, z1) {
  const sh = new THREE.Shape(), A0 = (a0 * Math.PI) / 180, A1 = (a1 * Math.PI) / 180;
  sh.absarc(0, 0, ro, A0, A1, false); sh.absarc(0, 0, ri, A1, A0, true); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0 - 0.016, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 36 });
  geo.translate(xa, ya, z0 + 0.008);
  return geo;
}
// 水平的板子（俯視的形狀 pts＝[x, z]，從 y0 到 y1）
function K2_slab(pts, y0, y1, bevel = 0.012) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], -pts[0][1]); for (const [x, z] of pts.slice(1)) sh.lineTo(x, -z); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0 - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, y0 + bevel, 0);
  return geo;
}
const K2_tube = (pts, r, seg = 40) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)), false, 'catmullrom', 0.2), seg, r, 10, false);
const K2_mirrorZ = (geo) => { const g = geo.clone(); g.scale(1, 1, -1); const ix = g.index; if (ix) { const a = ix.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } } else { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i += 3) for (const at of [p, n]) { for (let c = 0; c < 3; c++) { const t = at.getComponent(i + 1, c); at.setComponent(i + 1, c, at.getComponent(i + 2, c)); at.setComponent(i + 2, c, t); } } } return g; };
const K2_both = (geo) => [geo, K2_mirrorZ(geo)];
// 圓的東西朝前（+x）或朝後（−x）：半徑 r、厚 d，中心 (x, y, z)
const K2_disk = (r, d, x, y, z, seg = 24) => { const g = new THREE.CylinderGeometry(r, r, d, seg); g.rotateZ(Math.PI / 2); g.translate(x, y, z); return g; };

// 圓的後照鏡：門的前上角伸出一支黑色的短臂，鏡子是黑的圓殼、後面是鏡面
function K2_mirror(mats, s) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(K2_tube([[0.50, 1.15, s * 0.79], [0.49, 1.19, s * 0.85], [0.47, 1.22, s * 0.90]], 0.012, 12), mats.black));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 16), mats.black); head.scale.set(0.42, 0.9, 1.05); head.position.set(0.47, 1.25, s * 0.95); g.add(head);
  const gl = new THREE.Mesh(new THREE.CircleGeometry(0.07, 28), mats.mirrorGlass); gl.scale.set(1, 0.86, 1); gl.rotation.y = -Math.PI / 2; gl.position.set(0.437, 1.25, s * 0.95); g.add(gl);
  return g;
}

export const K2_SPEC = {
  look: K2_LOOK, paint: '#7fc8b0', metal: 0.1, seat: 0x232528,
  wheels: { xf: 1.10, xr: -1.14, R: K2_R, rim: K2_RIM, trackF: 0.70, trackR: 0.70, wF: K2_TW, wR: K2_TW, style: K2_wheel },
  mirror: (paint, mats, s) => K2_mirror(mats, s),
  wings: {
    none: () => new THREE.Group(),
    basket: (paint, mats) => { // 車頂籃：黑色的管子圍一圈（上下兩條、中間直的小柱子）＋四支腳
      const g = new THREE.Group(), L = [], y0 = 1.835, y1 = 1.905, x0 = -1.42, x1 = -0.02, zz = 0.60;
      for (const y of [y0, y1]) { L.push(K2_tube([[x1, y, -zz], [x1, y, zz]], 0.012, 6), K2_tube([[x0, y, -zz], [x0, y, zz]], 0.012, 6)); for (const s of [1, -1]) L.push(K2_tube([[x0, y, s * zz], [x1, y, s * zz]], 0.012, 6)); }
      for (let x = x0; x <= x1 + 1e-6; x += 0.20) for (const s of [1, -1]) L.push(K2_box(0.014, y1 - y0, 0.014, x, (y0 + y1) / 2, s * zz));
      for (const z of [-0.40, -0.20, 0, 0.20, 0.40]) L.push(K2_box(0.014, y1 - y0, 0.014, x1, (y0 + y1) / 2, z), K2_box(0.014, y1 - y0, 0.014, x0, (y0 + y1) / 2, z));
      for (const x of [x0 + 0.25, -0.70, x1 - 0.25]) L.push(K2_tube([[x, y0, -zz], [x, y0, zz]], 0.01, 6));
      for (const x of [x0 + 0.12, x1 - 0.12]) for (const s of [1, -1]) L.push(K2_box(0.06, y0 - 1.755, 0.05, x, (y0 + 1.755) / 2, s * (zz - 0.03)));
      g.add(new THREE.Mesh(K2_merge(L), mats.black));
      return g;
    },
  },
  wing: 'none',
  interior: { dx: -0.05, cage: false, wheelZ: -0.36, dashX: 0.36, dashY: 0.70, shelf: false, bench: { x: -0.85, shelfX: -1.40, shelfY: 0.55 } },
  build(body, paint, mats) {
    const { S, Y0 } = K2_M;
    for (const n of ['paint', 'inside', 'glass']) { const m = body.getObjectByName(n); if (m) { m.scale.setScalar(1 / S); m.position.set(0, Y0, 0); } }
    const cab = body.getObjectByName('interior'); if (cab) cab.position.y = 0.40; // 車內（parts.js 照跑車的高度做的）整組抬高
    const plastic = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.85, metalness: 0 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.68, metalness: 0.25 });
    const silver = new THREE.MeshStandardMaterial({ color: 0xb4b8bd, roughness: 0.35, metalness: 0.8 });
    const shell = new THREE.MeshPhysicalMaterial({ roughness: 0.35, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }); shell.color = paint.color; // 備胎蓋：跟車漆同一個顏色物件（換車色一起變）
    const amber = new THREE.MeshStandardMaterial({ color: 0xff8a1e, roughness: 0.2, emissive: 0xff6a00, emissiveIntensity: 0.15 });
    const redLens = new THREE.MeshStandardMaterial({ color: 0x8a0508, roughness: 0.15, emissive: 0xff1010, emissiveIntensity: 0.08 });
    const lens = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.1, metalness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.25 });
    // 黑色的圓輪弧（從車身側面伸出來）
    const fl = [K2_flare(1.10, 0.37, 0.445, 0.535, 6, 174, 0.73, 0.865), K2_flare(-1.14, 0.37, 0.445, 0.535, 6, 174, 0.73, 0.865)];
    body.add(new THREE.Mesh(K2_merge(fl.flatMap(K2_both)), plastic));
    // 側邊的小燈：前輪弧前端橘
    for (const s of [1, -1]) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.026, 0.012), amber); a.position.set(1.10 + 0.49 * Math.cos(0.5), 0.37 + 0.49 * Math.sin(0.5), s * 0.868); a.rotation.z = 0.5 + Math.PI / 2; body.add(a); }
    // 前後保桿（黑色塑膠、角是圓的包到側面）
    const bp = [
      K2_slab([[1.64, -0.79], [1.70, -0.835], [1.78, -0.825], [1.835, -0.72], [1.835, 0.72], [1.78, 0.825], [1.70, 0.835], [1.64, 0.79]], 0.48, 0.70),
      K2_slab([[-1.64, -0.79], [-1.64, 0.79], [-1.70, 0.835], [-1.78, 0.825], [-1.835, 0.72], [-1.835, -0.72], [-1.78, -0.825], [-1.70, -0.835]], 0.48, 0.665),
    ];
    body.add(new THREE.Mesh(K2_merge(bp), plastic));
    // 銀色的護板（前保桿下面、後保桿下面一條）
    body.add(new THREE.Mesh(K2_merge([K2_box(0.22, 0.016, 0.64, 1.74, 0.468, 0, 0, 0, 0.32), K2_box(0.12, 0.014, 0.70, -1.80, 0.478, 0, 0, 0, -0.2)]), silver));
    // 圓霧燈（前保桿兩邊）：亮面的圈＋白色燈罩
    const fogR = [], fogL = [];
    for (const s of [1, -1]) { const t = new THREE.TorusGeometry(0.043, 0.008, 8, 24); t.rotateY(Math.PI / 2); t.translate(1.838, 0.59, s * 0.60); fogR.push(t); fogL.push(K2_disk(0.04, 0.006, 1.836, 0.59, s * 0.60)); }
    body.add(new THREE.Mesh(K2_merge(fogR), mats.chrome), new THREE.Mesh(K2_merge(fogL), lens));
    // 車牌（後保桿中間，空白）
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.10), new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.5 })); plate.rotation.y = -Math.PI / 2; plate.position.set(-1.8375, 0.57, 0); body.add(plate);
    // 車底（從旁邊、前面看車底下是黑色的零件，不會直接看穿到地上）：兩支大樑、前後橫樑、前後軸管＋差速器
    const st = [];
    for (const s of [1, -1]) st.push(K2_box(3.30, 0.10, 0.07, -0.02, 0.44, s * 0.36));
    st.push(K2_box(0.08, 0.10, 0.76, 1.62, 0.48, 0), K2_box(0.08, 0.10, 0.76, -1.64, 0.48, 0));
    for (const xa of [1.10, -1.14]) {
      const ax = new THREE.CylinderGeometry(0.036, 0.036, 1.10, 12); ax.rotateX(Math.PI / 2); ax.translate(xa, K2_R, 0); st.push(ax);
      const df = new THREE.SphereGeometry(0.11, 16, 10); df.scale(1, 0.9, 1); df.translate(xa, K2_R - 0.005, xa > 0 ? 0.10 : 0); st.push(df);
    }
    body.add(new THREE.Mesh(K2_merge(st), steel));
    // 雨刷、天線
    const blk = [];
    for (const s of [1, -1]) blk.push(K2_box(0.012, 0.012, 0.42, 0.655, 1.11, s * 0.28 - 0.04));
    blk.push(new THREE.CylinderGeometry(0.003, 0.005, 0.40, 6).translate(0, 0.20, 0).rotateZ(0.35).translate(-1.20, 1.76, -0.55)); // 天線（車頂左後，往後倒）
    body.add(new THREE.Mesh(K2_merge(blk), mats.black));
    // 後窗：遮罩是黑的那塊上面再蓋一片亮的深色玻璃；第三煞車燈在後窗上面
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.30), new THREE.MeshPhysicalMaterial({ color: 0x07090b, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 }));
    rw.rotation.y = -Math.PI / 2; rw.position.set(-1.6965, 1.44, 0); body.add(rw);
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.24), redLens); tb.position.set(-1.688, 1.625, 0); body.add(tb);
    // 備胎：尾門上的架子＋車身色的硬殼蓋（前面平平的、邊圓圓的）＋一圈黑邊
    const lp = [[0, 0.0], [0.37, 0.0], [0.382, 0.035], [0.382, 0.18], [0.372, 0.212], [0.345, 0.233], [0.30, 0.24], [0, 0.24]].map(([r, a]) => new THREE.Vector2(r, a));
    const cv = new THREE.LatheGeometry(lp, 64); cv.rotateZ(Math.PI / 2); cv.translate(-1.735, 1.02, 0); cv.computeVertexNormals();
    const cover = new THREE.Mesh(cv, shell); cover.name = 'spare'; body.add(cover);
    const band = new THREE.TorusGeometry(0.384, 0.012, 8, 64); band.rotateY(Math.PI / 2); band.translate(-1.86, 1.02, 0);
    body.add(new THREE.Mesh(K2_merge([band, K2_box(0.04, 0.12, 0.30, -1.715, 1.02, 0)]), plastic));
    // 越野套件：前面的防撞桿（黑管）＋上面兩顆圓燈、每個輪子後面的擋泥板
    const trail = new THREE.Group(); trail.name = 'trail';
    const bar = [K2_tube([[1.84, 0.56, -0.46], [1.90, 0.62, -0.46], [1.92, 0.86, -0.42], [1.92, 0.90, -0.30], [1.92, 0.90, 0.30], [1.92, 0.86, 0.42], [1.90, 0.62, 0.46], [1.84, 0.56, 0.46]], 0.024, 48),
      K2_tube([[1.905, 0.66, -0.46], [1.905, 0.66, 0.46]], 0.02, 8)];
    for (const s of [1, -1]) bar.push(K2_box(0.05, 0.05, 0.05, 1.86, 0.58, s * 0.46), K2_box(0.03, 0.06, 0.03, 1.92, 0.93, s * 0.24));
    for (const s of [1, -1]) bar.push(K2_disk(0.07, 0.06, 1.93, 1.00, s * 0.24, 28));
    const flaps = [];
    for (const xa of [1.10, -1.14]) for (const s of [1, -1]) flaps.push(K2_box(0.01, 0.22, 0.24, xa - 0.47, 0.30, s * 0.70));
    trail.add(new THREE.Mesh(K2_merge([...bar, ...flaps]), plastic));
    trail.add(new THREE.Mesh(K2_merge([K2_disk(0.058, 0.006, 1.962, 1.00, 0.24, 28), K2_disk(0.058, 0.006, 1.962, 1.00, -0.24, 28)]), lens));
    body.add(trail);
    return (kit) => { trail.visible = kit === 'trail'; };
  },
  kit: 'stock',
};

// 這台車的標準視角（車比較高、比較短）
export const K2_CAMS = {
  front34: { a: 35, d: 7.6, h: 1.8, tx: 0, ty: 0.9, fov: 32 }, rear34: { a: 145, d: 7.6, h: 1.8, tx: -0.1, ty: 0.9, fov: 32 },
  side: { a: 90, d: 10, h: 0.95, tx: 0, ty: 0.9, fov: 28 }, front: { a: 0, d: 9, h: 1.0, tx: 0, ty: 0.9, fov: 20 }, rear: { a: 180, d: 9, h: 1.0, tx: 0, ty: 0.9, fov: 20 },
  low: { a: 28, d: 5.8, h: 0.5, tx: 0.3, ty: 0.8, fov: 40 },
};

export const K2_GARAGE = {
  name: 'K2 小越野車', sub: '三門小越野車 · 3D 試做版',
  paints: [['#7fc8b0', '薄荷綠'], ['#e3b23c', '芥末黃'], ['#efe6d2', '奶油白'], ['#c8323a', '紅'], ['#3f6fb0', '藍'], ['#8a8f94', '灰'], ['#5b6b3f', '橄欖綠'], ['#e8742c', '橘']],
  opts: {
    wing: [['none', '不要'], ['basket', '車頂籃']],
    kit: [['stock', '原廠'], ['trail', '越野套件']],
    height: [['0', '原廠'], ['0.04', '升高'], ['0.08', '大升高']],
    livery: [['none', '不要'], ['stripe', '條紋'], ['mountain', '山']],
    rimStyle: [['stock', '原廠']],
    wide: [['off', '原廠']],
  },
  state: { paint: '#7fc8b0', rim: 'white', caliper: '#17181b', wing: 'none', kit: 'stock', height: '0', livery: 'stripe', tint: 'dark' }, // 拉花預設條紋（給 Nick 看的圖就是這樣）
};
