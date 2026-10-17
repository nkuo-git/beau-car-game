// 3D Bugatti Chiron：輪子（五組 V 字雙輻條）、C 字線的亮銀飾條、車頂中間的脊線、可升起的尾翼、後照鏡、下巴、擴散器、
// 中間四出排氣管、相機、車庫選項。車庫裡的名字是編的「C16 閃電」（沒有真的牌子、字、徽章）。
// 拉花「雙色」：車漆補丁（build 裡）讓側面拉花貼圖也畫到朝上、朝後的面，所以車頂、引擎蓋板、車尾、尾翼、脊線都跟著變深色。
import * as THREE from 'three';
import { CHIRON_LOOK } from './chiron-look.js';

// 一片有厚度的板子：給四個角（依序），往板子法線兩邊各長 th/2（回傳不帶 index 的幾何，好合併）
function CHIRON_slab(pts, th) {
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
// 幾何合成一個（只留 position、normal）：同一個材質的小零件合成一個網格，draw call 少
function CHIRON_merge(list) {
  const P = [], N = []; let n = 0;
  for (let g of list) {
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    P.push(g.attributes.position.array); N.push(g.attributes.normal.array); n += g.attributes.position.count;
  }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (let i = 0; i < P.length; i++) { pos.set(P[i], o); nor.set(N[i], o); o += P[i].length; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}
// 側面輪廓（x, y）往 z 拉厚 th，放在 z0（回傳幾何）
function CHIRON_plate(pts, th, z0, bevel = 0.003) {
  const s = new THREE.Shape(); s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 12 });
  g.translate(0, 0, z0 - th / 2); return g;
}

// ---- 輪框：五組 V 字雙輻條（兩根從輪轂一起出來、到輪緣分開），往中間凹 ----
function CHIRON_rim(rim, w, mats) {
  const ro = rim - 0.012, rh = 0.078, zo = w / 2 - 0.028, zi = w / 2 - 0.056;
  const P = (r, ang, z, off) => [Math.cos(ang) * r - Math.sin(ang) * off, Math.sin(ang) * r + Math.cos(ang) * off, z];
  const zAt = (r) => zi + (zo - zi) * Math.min(1, (r - rh) / (ro - rh)) ** 0.7;
  const list = [];
  for (let j = 0; j < 5; j++) {
    const a = (j * 2 * Math.PI) / 5 + Math.PI / 2;
    for (const s of [-1, 1]) {
      const ai = a + s * 0.075, ao = a + s * 0.215, N = 4;
      for (let k = 0; k < N; k++) { // 一根輻條分四段，沿著凹面彎
        const t0 = k / N, t1 = (k + 1) / N, r0 = rh + (ro - rh) * t0, r1 = rh + (ro - rh) * t1;
        const w0 = 0.017 - 0.005 * t0, w1 = 0.017 - 0.005 * t1;
        list.push(CHIRON_slab([P(r0, ai + (ao - ai) * t0, zAt(r0), -w0), P(r1, ai + (ao - ai) * t1, zAt(r1), -w1), P(r1, ai + (ao - ai) * t1, zAt(r1), w1), P(r0, ai + (ao - ai) * t0, zAt(r0), w0)], 0.022));
      }
    }
  }
  const hub = new THREE.CylinderGeometry(0.086, 0.094, 0.04, 40); hub.rotateX(Math.PI / 2); hub.translate(0, 0, zi + 0.002); list.push(hub);
  const ring = new THREE.TorusGeometry(ro + 0.002, 0.005, 8, 96); ring.translate(0, 0, zo + 0.004); list.push(ring);
  return new THREE.Mesh(CHIRON_merge(list), mats.chrome);
}
CHIRON_rim.capInset = 0.06;

// ---- C 字線的亮銀飾條：沿著 C 的台階（照 chiron-body.mjs 的 CLINE 打到車身上量的點，chiron3d/geo.mjs）----
const CHIRON_CLINE3 = [[0.62, 0.84, 0.823], [0.564, 0.866, 0.779], [0.451, 0.917, 0.753], [0.35, 0.964, 0.737], [0.251, 1.012, 0.709], [0.15, 1.055, 0.699], [0.052, 1.086, 0.709], [-0.049, 1.108, 0.711],
  [-0.158, 1.12, 0.713], [-0.275, 1.123, 0.711], [-0.392, 1.119, 0.709], [-0.501, 1.109, 0.707], [-0.603, 1.091, 0.705], [-0.7, 1.06, 0.705], [-0.8, 0.994, 0.713], [-0.863, 0.911, 0.901],
  [-0.885, 0.82, 0.955], [-0.878, 0.726, 0.987], [-0.842, 0.627, 1.001], [-0.78, 0.53, 0.997], [-0.715, 0.46, 0.991], [-0.64, 0.4, 0.985], [-0.553, 0.346, 0.977], [-0.46, 0.305, 0.965],
  [-0.358, 0.28, 0.951], [-0.253, 0.266, 0.941], [-0.142, 0.255, 0.933], [-0.025, 0.247, 0.927], [0.092, 0.242, 0.921], [0.208, 0.238, 0.919], [0.325, 0.235, 0.915], [0.442, 0.233, 0.915],
  [0.55, 0.231, 0.913], [0.65, 0.23, 0.913], [0.75, 0.229, 0.915], [0.853, 0.227, 0.921], [0.96, 0.226, 0.927], [0.98, 0.226, 0.923]];
function CHIRON_cline(mats) {
  const list = [];
  for (const s of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3(CHIRON_CLINE3.map(([x, y, z]) => new THREE.Vector3(x, y, s * (z - 0.004))));
    list.push(new THREE.TubeGeometry(c, 160, 0.011, 6, false));
  }
  const m = new THREE.Mesh(CHIRON_merge(list), mats.alu); m.name = 'cline';
  return m;
}

// ---- 車頂中間的脊線：從前擋上緣沿著車頂、引擎室蓋中間一路到尾翼前面（車漆材質，雙色時跟車頂一起變深）----
const CHIRON_SPINE = [[-0.1, 1.177], [-0.3, 1.209], [-0.5, 1.213], [-0.7, 1.201], [-0.9, 1.177], [-1.1, 1.147], [-1.3, 1.111], [-1.5, 1.077], [-1.7, 1.045]];
function CHIRON_spine(paint) {
  const top = CHIRON_SPINE.map(([x, y], i) => [x, y + 0.004 + 0.018 * Math.min(1, i / 3)]);
  const bot = CHIRON_SPINE.map(([x, y]) => [x, y - 0.03]).reverse();
  top[top.length - 1][1] -= 0.01;
  const m = new THREE.Mesh(CHIRON_plate([...top, ...bot], 0.018, 0, 0.004), paint); m.name = 'spine';
  return m;
}

// ---- 尾翼：原廠是收起來的（平平貼在引擎蓋板後段，跟車身同色）；「升起」是照片那樣用兩根銀色油壓桿撐高、往後仰 ----
function CHIRON_wing(paint, mats, up) {
  const g = new THREE.Group();
  const span = 0.66, x0 = -1.765, c = 0.44;
  const N = 14, pos = [], idx = [];
  const sec = (z) => { // 翼剖面（x, y）：上面微微拱起
    const u = Math.abs(z) / span, pts = [];
    const y0 = up ? 1.17 : 0.985 - 0.012 * u * u - 0.01 * (u > 0.85 ? (u - 0.85) / 0.15 : 0), aoa = up ? 0.16 : 0.03, th = up ? 0.032 : 0.022;
    for (let i = 0; i <= N; i++) { const t = i / N, xc = (1 - Math.cos(Math.PI * t)) / 2; pts.push([x0 - xc * c * Math.cos(aoa), y0 + xc * c * Math.sin(aoa) + th * Math.sin(Math.PI * Math.sqrt(xc)) * 0.6]); }
    for (let i = N - 1; i > 0; i--) { const t = i / N, xc = (1 - Math.cos(Math.PI * t)) / 2; pts.push([x0 - xc * c * Math.cos(aoa), y0 + xc * c * Math.sin(aoa) - th * 0.35 * Math.sin(Math.PI * xc)]); }
    return pts;
  };
  const S = 16, n = 2 * N;
  for (let i = 0; i <= S; i++) { const z = -span + (2 * span * i) / S; for (const [x, y] of sec(z)) pos.push(x, y, z); }
  for (let i = 0; i < S; i++) for (let j = 0; j < n; j++) { const a = i * n + j, b = i * n + ((j + 1) % n), cc = (i + 1) * n + j, d = (i + 1) * n + ((j + 1) % n); idx.push(a, b, cc, b, d, cc); }
  for (const [i0, flip] of [[0, true], [S, false]]) { // 兩端封起來
    const ctr = pos.length / 3, sp = sec(-span + (2 * span * i0) / S);
    pos.push(sp.reduce((a, p) => a + p[0], 0) / n, sp.reduce((a, p) => a + p[1], 0) / n, -span + (2 * span * i0) / S);
    for (let j = 0; j < n; j++) { const a = i0 * n + j, b = i0 * n + ((j + 1) % n); flip ? idx.push(ctr, a, b) : idx.push(ctr, b, a); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, paint));
  if (up) { // 兩根油壓桿（銀）＋底座（黑）
    const list = [], base = [];
    for (const z of [-0.43, 0.43]) {
      const rod = new THREE.CylinderGeometry(0.022, 0.022, 0.20, 16); rod.rotateZ(-0.12); rod.translate(-1.93, 1.075, z); list.push(rod);
      const b = new THREE.BoxGeometry(0.09, 0.04, 0.07); b.translate(-1.935, 0.985, z); base.push(b);
    }
    g.add(new THREE.Mesh(CHIRON_merge(list), mats.alu), new THREE.Mesh(CHIRON_merge(base), mats.black));
  }
  return g;
}

// ---- 後照鏡：細支架從車門上緣前面伸出去，長長的水滴形鏡殼（同車色）＋鏡面朝後 ----
function CHIRON_mirror(paint, mats, s) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), paint);
  head.scale.set(0.115, 0.048, 0.072); head.rotation.y = s * 0.10; head.position.set(0.57, 0.94, s * 0.925); g.add(head);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(1, 24), mats.mirrorGlass);
  glass.scale.set(0.068, 0.038, 1); glass.rotation.y = -Math.PI / 2; glass.position.set(0.50, 0.94, s * 0.925); g.add(glass);
  g.add(new THREE.Mesh(CHIRON_slab([[0.72, 0.84, s * 0.81], [0.63, 0.93, s * 0.89], [0.57, 0.93, s * 0.89], [0.65, 0.84, s * 0.81]], 0.022), paint));
  return g;
}

// ---- 下巴（碳纖維，原廠就有）、擴散器、四出排氣管；賽道套件多風刀、側裙刀片、大一點的下巴 ----
function CHIRON_splitter(mats, big) {
  const k = big ? 0.05 : 0;
  const front = [[2.25 + k, 0], [2.24 + k, 0.18], [2.205 + k, 0.35], [2.14 + k, 0.50], [2.04 + k * 0.7, 0.64], [1.92 + k * 0.4, 0.76], [1.78, 0.84]];
  const sh = new THREE.Shape(), zb = front[front.length - 1][1];
  sh.moveTo(1.70, -zb); sh.lineTo(front[front.length - 1][0], -zb);
  sh.splineThru(front.slice(0, -1).reverse().map(([x, z]) => new THREE.Vector2(x, -z)));
  sh.splineThru(front.slice(1).map(([x, z]) => new THREE.Vector2(x, z)));
  sh.lineTo(1.70, zb); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 20 });
  geo.rotateX(Math.PI / 2); geo.translate(0, big ? 0.10 : 0.118, 0);
  return geo;
}
function CHIRON_diffuser(mats) {
  const list = [];
  list.push(CHIRON_slab([[-1.78, 0.13, -0.80], [-1.78, 0.13, 0.80], [-2.27, 0.30, 0.80], [-2.27, 0.30, -0.80]], 0.012));
  for (const z of [-0.74, -0.56, -0.38, 0.38, 0.56, 0.74]) list.push(CHIRON_plate([[-1.95, 0.14], [-2.27, 0.30], [-2.285, 0.30], [-2.285, 0.235], [-2.10, 0.17]], 0.012, z, 0.002));
  return list;
}
function CHIRON_exhaust(mats) {
  const g = new THREE.Group();
  // 外框：上寬下窄的梯形（銀色鈦），中間一根上窄下寬的隔柱，左右兩個大開口裡各再分兩個
  const outer = [[-0.27, 0.285], [0.27, 0.285], [0.24, 0.17], [0.20, 0.145], [-0.20, 0.145], [-0.24, 0.17]];
  const sh = new THREE.Shape(); sh.moveTo(...outer[0]); for (const p of outer.slice(1)) sh.lineTo(...p); sh.closePath();
  for (const s of [-1, 1]) {
    const h = new THREE.Path(), pts = [[0.035, 0.27], [0.25, 0.27], [0.225, 0.178], [0.19, 0.16], [0.07, 0.16]].map(([u, y]) => [u * s, y]);
    if (s < 0) pts.reverse();
    h.moveTo(...pts[0]); for (const p of pts.slice(1)) h.lineTo(...p); h.closePath(); sh.holes.push(h);
  }
  const frame = new THREE.ExtrudeGeometry(sh, { depth: 0.10, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 8 });
  frame.rotateY(-Math.PI / 2); frame.translate(-2.165, -0.04, 0);
  const divs = [];
  for (const u of [-0.15, 0.15]) { const d = new THREE.BoxGeometry(0.08, 0.10, 0.008); d.translate(-2.235, 0.175, u); divs.push(d); }
  g.add(new THREE.Mesh(CHIRON_merge([frame, ...divs]), mats.alu));
  const back = new THREE.PlaneGeometry(0.52, 0.13); back.rotateY(-Math.PI / 2); back.translate(-2.20, 0.175, 0);
  g.add(new THREE.Mesh(back, mats.black));
  return g;
}
function CHIRON_track(mats) {
  const list = [];
  for (const s of [-1, 1]) {
    for (const [y, dx] of [[0.42, 0], [0.50, -0.04]]) list.push(CHIRON_slab([[2.03 + dx, y, s * 0.70], [1.90 + dx, y + 0.035, s * 0.83], [1.87 + dx, y + 0.035, s * 0.92], [1.99 + dx, y, s * 0.83]], 0.008));
    list.push(CHIRON_slab([[-0.92, 0.115, s * 0.93], [0.88, 0.115, s * 0.93], [0.84, 0.115, s * 1.0], [-0.88, 0.115, s * 1.0]], 0.01));
  }
  for (const z of [-0.22, 0.22]) list.push(CHIRON_plate([[-1.86, 0.135], [-2.27, 0.30], [-2.30, 0.30], [-2.30, 0.11], [-2.0, 0.11]], 0.012, z, 0.002));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(CHIRON_merge(list), mats.carbon), new THREE.Mesh(CHIRON_splitter(mats, true), mats.carbon));
  return g;
}

export const CHIRON_SPEC = {
  look: CHIRON_LOOK, paint: '#1f6fd8', metal: 0.3, seat: 0x1d3f7a,
  wheels: { xf: 1.37, xr: -1.341, RF: 0.3395, RR: 0.3555, rimF: 0.254, rimR: 0.2667, trackF: 0.85, trackR: 0.83, wF: 0.285, wR: 0.355, style: CHIRON_rim },
  mirror: (paint, mats, s) => CHIRON_mirror(paint, mats, s),
  wings: { stock: (paint, mats) => CHIRON_wing(paint, mats, false), high: (paint, mats) => CHIRON_wing(paint, mats, true) },
  wing: 'stock',
  interior: { dx: 0.0, cage: false, wheelZ: -0.36, dashX: 0.42, dashY: 0.76, shelf: false },
  build(body, paint, mats) {
    // 雙色拉花：側面拉花貼圖（左上角有記號才算）也畫到朝上、朝後的面
    const ob = paint.onBeforeCompile, ok = paint.customProgramCacheKey;
    paint.onBeforeCompile = (sh, r) => {
      ob(sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('diffuseColor.rgb = mix(diffuseColor.rgb, LV.rgb, LV.a * sideW * uLiv);', `$&
  { float mk = vP.z > 0.0 ? texture2D(tLivR, vec2(0.003, 0.994)).a : texture2D(tLivL, vec2(0.003, 0.994)).a;
    diffuseColor.rgb = mix(diffuseColor.rgb, LV.rgb, LV.a * (1.0 - sideW) * uLiv * step(0.5, mk)); }`);
    };
    paint.customProgramCacheKey = () => (ok ? ok() : '') + '+chiron';
    const base = new THREE.Group();
    base.add(CHIRON_cline(mats), CHIRON_spine(paint), CHIRON_exhaust(mats));
    base.add(new THREE.Mesh(CHIRON_merge([CHIRON_splitter(mats, false), ...CHIRON_diffuser(mats)]), mats.carbon));
    const track = CHIRON_track(mats); track.visible = false;
    body.add(base, track);
    return (kit) => { track.visible = kit === 'track'; };
  },
  kit: 'stock',
};
export const CHIRON_CAMS = {
  photo1: { a: -33.638, d: 4.455, h: 1.611, tx: 0.594, ty: 0.362, fov: 29.628, rl: 1.945 },
  photo2: { a: -31.699, d: 5.589, h: 1.441, tx: 0.517, ty: 0.419, fov: 22.86, rl: 3.347 },
  photo3: { a: 180.478, d: 5.012, h: 1.62, tx: -1.815, ty: 0.643, fov: 17.4, rl: -1.809 },
  photo4: { a: 92.27, d: 6.99, h: 0.2, tx: -0.024, ty: 0.55, fov: 29.47, rl: -2.0 },
};
export const CHIRON_GARAGE = {
  name: 'C16 閃電', sub: '藍色馬蹄超跑 · 3D 試做版',
  paints: [['#1f6fd8', '賽車藍（照片 1）'], ['#29a8e6', '淺藍（照片 2）'], ['#15171c', '黑（照片 3）'], ['#e9eaec', '白'], ['#b8bcc2', '銀'], ['#c8141e', '紅'], ['#e8a317', '金黃'], ['#2b3a67', '深藍']],
  opts: {
    wing: [['stock', '原廠（收起來）'], ['high', '升起'], ['none', '不要']],
    kit: [['stock', '原廠'], ['track', '賽道']],
    height: [['0', '原廠'], ['-0.03', '降低'], ['-0.05', '貼地']],
    livery: [['duo', '雙色（深色車尾）'], ['none', '不要']],
  },
  state: { paint: '#1f6fd8', rim: 'gunmetal', caliper: '#1f6fd8', wing: 'stock', kit: 'stock', height: '0', livery: 'duo', tint: 'light' },
};
