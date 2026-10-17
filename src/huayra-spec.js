// 3D Pagani Huayra（2012 coupe）：輪子（七組扭轉的雙輻條）、細長彎彎的後照鏡、四個水滴形大燈座、三顆一組的圓尾燈、
// 車尾中間四根排氣管、後面兩片主動式擾流板、下巴、擴散器、相機、車庫選項
// 遊戲裡的名字是「HY 風神」：不寫真的牌子、不畫標誌和字
import * as THREE from 'three';
import { interior, aeroKit, lip } from './parts.js';
import { HUAYRA_LOOK } from './huayra-look.js';

// 貼在車身上的點（huayra3d/bake.mjs 從車身 SDF 算的；右半邊 z > 0，左邊鏡射）
// podIn／podOut：大燈座的格子（一列一列，上面尖、下面圓），lens：兩顆燈的位置＋法線；lamps：三顆尾燈；flap：擾流板的 5×5 格子
const HUAYRA_BAKE = {"podIn":{"rows":[[[1.43,0.678,0.55],[1.43,0.678,0.55],[1.43,0.678,0.55],[1.43,0.678,0.55],[1.43,0.678,0.55],[1.43,0.678,0.55],[1.43,0.678,0.55],[1.43,0.678,0.55],[1.43,0.678,0.55],[1.43,0.678,0.55],[1.43,0.678,0.55]],[[1.447,0.661,0.531],[1.456,0.66,0.533],[1.465,0.66,0.535],[1.474,0.659,0.537],[1.482,0.658,0.538],[1.491,0.657,0.54],[1.499,0.656,0.542],[1.508,0.655,0.544],[1.516,0.654,0.546],[1.524,0.654,0.548],[1.532,0.653,0.55]],[[1.463,0.645,0.511],[1.48,0.643,0.515],[1.496,0.641,0.519],[1.513,0.639,0.523],[1.529,0.638,0.527],[1.545,0.636,0.531],[1.561,0.634,0.535],[1.577,0.632,0.539],[1.593,0.631,0.543],[1.609,0.629,0.547],[1.626,0.627,0.551]],[[1.485,0.628,0.493],[1.507,0.625,0.498],[1.529,0.623,0.504],[1.551,0.62,0.51],[1.573,0.617,0.516],[1.596,0.615,0.521],[1.619,0.612,0.527],[1.642,0.609,0.533],[1.664,0.607,0.539],[1.686,0.604,0.545],[1.707,0.602,0.55]],[[1.516,0.61,0.476],[1.54,0.607,0.483],[1.565,0.604,0.49],[1.591,0.6,0.497],[1.618,0.597,0.505],[1.645,0.594,0.512],[1.672,0.59,0.519],[1.698,0.587,0.527],[1.725,0.584,0.534],[1.752,0.58,0.541],[1.778,0.577,0.549]],[[1.556,0.592,0.461],[1.58,0.588,0.469],[1.606,0.584,0.477],[1.634,0.58,0.486],[1.662,0.576,0.494],[1.69,0.572,0.503],[1.719,0.569,0.511],[1.749,0.565,0.519],[1.779,0.561,0.528],[1.809,0.557,0.536],[1.852,0.553,0.545]],[[1.603,0.572,0.449],[1.626,0.568,0.457],[1.651,0.564,0.466],[1.678,0.56,0.475],[1.705,0.555,0.484],[1.734,0.551,0.493],[1.764,0.547,0.502],[1.795,0.543,0.511],[1.832,0.539,0.52],[1.914,0.535,0.529],[1.996,0.531,0.539]],[[1.657,0.55,0.44],[1.678,0.546,0.449],[1.7,0.542,0.457],[1.724,0.538,0.466],[1.751,0.534,0.475],[1.778,0.53,0.484],[1.807,0.526,0.493],[1.851,0.522,0.501],[1.968,0.518,0.51],[2.029,0.514,0.52],[2.066,0.51,0.529]],[[1.725,0.526,0.439],[1.742,0.522,0.446],[1.761,0.519,0.453],[1.781,0.516,0.46],[1.801,0.512,0.467],[1.827,0.509,0.474],[1.877,0.506,0.481],[1.989,0.503,0.489],[2.036,0.499,0.496],[2.068,0.496,0.504],[2.101,0.493,0.511]],[[1.991,0.488,0.465],[1.991,0.488,0.465],[1.991,0.488,0.465],[1.991,0.488,0.465],[1.991,0.488,0.465],[1.991,0.488,0.465],[1.991,0.488,0.465],[1.991,0.488,0.465],[1.991,0.488,0.465],[1.991,0.488,0.465],[1.991,0.488,0.465]]],"lens":[[[1.625,0.599,0.518],[0.237,0.798,-0.554]],[[1.786,0.523,0.484],[0.278,0.813,-0.512]]]},"podOut":{"rows":[[[1.498,0.732,0.697],[1.498,0.732,0.697],[1.498,0.732,0.697],[1.498,0.732,0.697],[1.498,0.732,0.697],[1.498,0.732,0.697],[1.498,0.732,0.697],[1.498,0.732,0.697],[1.498,0.732,0.697],[1.498,0.732,0.697],[1.498,0.732,0.697]],[[1.548,0.716,0.677],[1.552,0.715,0.679],[1.556,0.714,0.681],[1.559,0.713,0.683],[1.563,0.712,0.685],[1.566,0.711,0.687],[1.569,0.71,0.689],[1.573,0.709,0.691],[1.575,0.708,0.693],[1.578,0.708,0.694],[1.581,0.707,0.696]],[[1.585,0.7,0.656],[1.595,0.698,0.66],[1.605,0.696,0.664],[1.614,0.694,0.668],[1.622,0.692,0.672],[1.63,0.69,0.676],[1.636,0.689,0.68],[1.643,0.687,0.685],[1.649,0.685,0.688],[1.654,0.683,0.692],[1.66,0.681,0.696]],[[1.615,0.684,0.637],[1.633,0.681,0.642],[1.649,0.678,0.648],[1.663,0.675,0.654],[1.676,0.673,0.66],[1.687,0.67,0.666],[1.698,0.667,0.672],[1.707,0.664,0.678],[1.715,0.661,0.684],[1.723,0.659,0.69],[1.731,0.656,0.695]],[[1.644,0.667,0.619],[1.667,0.663,0.626],[1.688,0.66,0.633],[1.708,0.656,0.641],[1.725,0.653,0.648],[1.742,0.649,0.656],[1.756,0.646,0.663],[1.769,0.642,0.671],[1.781,0.639,0.678],[1.791,0.635,0.686],[1.802,0.631,0.693]],[[1.673,0.648,0.603],[1.701,0.644,0.611],[1.727,0.64,0.62],[1.751,0.636,0.628],[1.774,0.632,0.637],[1.794,0.628,0.645],[1.813,0.624,0.654],[1.83,0.62,0.663],[1.845,0.616,0.671],[1.857,0.612,0.68],[1.869,0.608,0.688]],[[1.708,0.629,0.59],[1.739,0.625,0.599],[1.768,0.62,0.608],[1.795,0.616,0.617],[1.821,0.612,0.626],[1.848,0.608,0.635],[1.873,0.603,0.645],[1.892,0.599,0.654],[1.907,0.595,0.663],[1.919,0.59,0.672],[1.931,0.586,0.681]],[[1.753,0.608,0.58],[1.783,0.604,0.589],[1.813,0.6,0.598],[1.846,0.595,0.607],[1.882,0.591,0.616],[1.913,0.587,0.625],[1.935,0.583,0.635],[1.952,0.579,0.644],[1.964,0.574,0.653],[1.976,0.57,0.662],[1.988,0.566,0.67]],[[1.824,0.583,0.578],[1.859,0.58,0.586],[1.899,0.577,0.593],[1.933,0.573,0.601],[1.958,0.57,0.608],[1.978,0.567,0.616],[1.993,0.563,0.623],[2.005,0.56,0.631],[2.015,0.556,0.638],[2.025,0.553,0.645],[2.035,0.549,0.652]],[[2.039,0.546,0.606],[2.039,0.546,0.606],[2.039,0.546,0.606],[2.039,0.546,0.606],[2.039,0.546,0.606],[2.039,0.546,0.606],[2.039,0.546,0.606],[2.039,0.546,0.606],[2.039,0.546,0.606],[2.039,0.546,0.606],[2.039,0.546,0.606]]],"lens":[[[1.719,0.654,0.661],[0.319,0.927,-0.195]],[[1.925,0.579,0.624],[0.251,0.933,-0.26]]]},"lamps":[[[-2.019,0.825,0.815],[-0.749,0.52,0.411]],[[-2.076,0.79,0.705],[-0.928,0.254,0.272]],[[-2.026,0.69,0.83],[-0.872,0,0.489]]],"flap":[[[-1.72,0.757,0.3],[-1.715,0.758,0.38],[-1.71,0.759,0.46],[-1.705,0.774,0.54],[-1.7,0.822,0.62]],[[-1.805,0.743,0.3],[-1.8,0.744,0.38],[-1.795,0.745,0.46],[-1.79,0.762,0.54],[-1.785,0.813,0.62]],[[-1.89,0.732,0.3],[-1.885,0.732,0.38],[-1.88,0.733,0.46],[-1.875,0.765,0.54],[-1.87,0.821,0.62]],[[-1.975,0.726,0.3],[-1.97,0.726,0.38],[-1.965,0.74,0.46],[-1.96,0.791,0.54],[-1.955,0.845,0.62]],[[-2.06,0.711,0.3],[-2.055,0.713,0.38],[-2.05,0.743,0.46],[-2.045,0.799,0.54],[-2.04,0.846,0.62]]],"strake":[[0.68,0.5,0.963],[0.79,0.5,0.974],[0.91,0.5,0.981]],"plate":[-2.25,0.39,0]};

// 格子（rows × cols 的點）→ 網格；flip：鏡射到左邊（z 變負，三角形反過來）
function HUAYRA_grid(rows, flip) {
  const nr = rows.length, nc = rows[0].length, pos = [], idx = [];
  for (const row of rows) for (const [x, y, z] of row) pos.push(x, y, flip ? -z : z);
  for (let i = 0; i < nr - 1; i++) for (let j = 0; j < nc - 1; j++) {
    const a = i * nc + j, b = a + 1, c = a + nc, d = c + 1;
    if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// 朝 n 方向擺一個東西（本來朝 +z）
function HUAYRA_face(o, p, n, s, off = 0) {
  const v = new THREE.Vector3(n[0], n[1], s * n[2]).normalize();
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v);
  o.position.set(p[0] + v.x * off, p[1] + v.y * off, s * p[2] + v.z * off);
  return o;
}
function HUAYRA_mats(mats) {
  if (mats.hyLamp) return mats;
  mats.hyLamp = new THREE.MeshPhysicalMaterial({ color: 0xf4f6f8, roughness: 0.08, metalness: 0.5, emissive: 0x2a2c30 });
  mats.hyRed = new THREE.MeshPhysicalMaterial({ color: 0xa00014, roughness: 0.12, metalness: 0, clearcoat: 1, emissive: 0x2a0004 });
  mats.hyPod = new THREE.MeshPhysicalMaterial({ color: 0x06070a, roughness: 0.05, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, side: THREE.DoubleSide });
  mats.hyPlate = new THREE.MeshStandardMaterial({ color: 0xe4e6e8, roughness: 0.6 });
  return mats;
}

// ---- 輪框：七組往同一邊扭轉的雙輻條（照片 3 那台），中間小輪轂 ----
function HUAYRA_rim(rim, w, mats) {
  const g = new THREE.Group();
  const ro = rim - 0.012, rh = 0.072, zo = w / 2 - 0.028, zi = w / 2 - 0.08, N = 10;
  const ribbon = (a0, side) => {
    const pos = [], idx = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N, r = rh + (ro - rh) * t, ang = a0 + 0.42 * t ** 1.2 + side * (0.05 + 0.07 * t), hw = 0.0105 - 0.004 * t;
      const z = zi + (zo - zi) * Math.min(1, t * 1.3), dz = 0.009;
      const c = Math.cos(ang), s = Math.sin(ang), tx = -s, ty = c;
      for (const [o, zz] of [[-hw, z + dz], [hw, z + dz], [hw, z - dz], [-hw, z - dz]]) pos.push(c * r + tx * o, s * r + ty * o, zz);
    }
    for (let k = 0; k < N; k++) for (let q = 0; q < 4; q++) {
      const a = k * 4 + q, b = k * 4 + ((q + 1) % 4), c = a + 4, d = b + 4;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  };
  for (let j = 0; j < 7; j++) for (const side of [-1, 1]) g.add(new THREE.Mesh(ribbon((j * 2 * Math.PI) / 7, side), mats.chrome));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.04, 40), mats.chrome);
  hub.geometry.rotateX(Math.PI / 2); hub.position.z = zi + 0.006; g.add(hub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ro + 0.002, 0.005, 8, 96), mats.chrome);
  ring.position.z = zo + 0.004; g.add(ring);
  return g;
}
HUAYRA_rim.capInset = 0.07;

// ---- 後照鏡：從前葉子板（A 柱前面）伸出一根細細彎彎的桿子，往上、往外，頂著一個葉子形的鏡殼 ----
function HUAYRA_mirror(paint, mats, s) {
  const g = new THREE.Group();
  const P = (x, y, z) => new THREE.Vector3(x, y, s * z);
  const arm = new THREE.CatmullRomCurve3([P(1.16, 0.75, 0.80), P(1.17, 0.83, 0.835), P(1.185, 0.895, 0.895), P(1.205, 0.925, 0.955)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(arm, 24, 0.0085, 8, false), mats.chrome));
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), paint);
  head.scale.set(0.078, 0.036, 0.075); head.position.set(1.215, 0.935, s * 0.985); head.rotation.y = s * 0.15; g.add(head);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(1, 28), mats.mirrorGlass);
  glass.scale.set(0.062, 0.03, 1); glass.rotation.y = -Math.PI / 2; glass.position.set(1.163, 0.935, s * 0.985); g.add(glass);
  return g;
}

// ---- 大燈：前葉子板上兩個水滴形燈座（黑色鏡面），裡面上下兩顆圓燈 ----
function HUAYRA_pods(mats) {
  const g = new THREE.Group(); HUAYRA_mats(mats);
  for (const s of [1, -1]) for (const k of ['podIn', 'podOut']) {
    const B = HUAYRA_BAKE[k];
    g.add(new THREE.Mesh(HUAYRA_grid(B.rows, s < 0), mats.hyPod));
    B.lens.forEach(([p, n], i) => {
      const r = i ? 0.025 : 0.03;
      g.add(HUAYRA_face(new THREE.Mesh(new THREE.TorusGeometry(r, 0.0045, 8, 28), mats.chrome), p, n, s, 0.007));
      g.add(HUAYRA_face(new THREE.Mesh(new THREE.CircleGeometry(r, 24), mats.hyLamp), p, n, s, 0.006));
    });
  }
  return g;
}
// ---- 尾燈：每邊三顆，銀色燈圈＋紅色燈罩＋中間銀色 ----
function HUAYRA_lamps(mats) {
  const g = new THREE.Group();
  for (const s of [1, -1]) for (const [p] of HUAYRA_BAKE.lamps) {
    const n = [-1, 0, 0];
    const bez = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.035, 32, 1, true), mats.chrome);
    bez.geometry.rotateX(Math.PI / 2); g.add(HUAYRA_face(bez, p, n, s, 0.0));
    g.add(HUAYRA_face(new THREE.Mesh(new THREE.CircleGeometry(0.052, 32), mats.hyRed), p, n, s, 0.016));
    g.add(HUAYRA_face(new THREE.Mesh(new THREE.CircleGeometry(0.03, 24), mats.alu), p, n, s, 0.018));
  }
  return g;
}
// ---- 排氣管：車尾中間 2×2 四根，稍微往上翹，外面一個碳纖維的座 ----
function HUAYRA_exhaust(mats) {
  const g = new THREE.Group(), y0 = 0.635;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.22), mats.carbon);
  seat.position.set(-2.10, y0, 0); g.add(seat);
  for (const dy of [-0.051, 0.051]) for (const z of [-0.049, 0.049]) {
    const p = new THREE.Group(); p.position.set(-2.16, y0 + dy, z); p.rotation.z = -0.12;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.16, 28, 1, true), mats.alu);
    tube.geometry.rotateZ(Math.PI / 2); p.add(tube);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.036, 24), mats.black);
    hole.rotation.y = -Math.PI / 2; hole.position.x = -0.06; p.add(hole);
    const lipR = new THREE.Mesh(new THREE.TorusGeometry(0.039, 0.004, 6, 28), mats.alu);
    lipR.rotation.y = Math.PI / 2; lipR.position.x = -0.08; p.add(lipR);
    g.add(p);
  }
  return g;
}
// ---- 後面的主動式擾流板（兩片，跟車同色）：up＝立起來（煞車時那樣） ----
function HUAYRA_flaps(paint, mats, up) {
  const g = new THREE.Group();
  for (const s of [1, -1]) {
    const f = new THREE.Group();
    f.add(new THREE.Mesh(HUAYRA_grid(HUAYRA_BAKE.flap, s < 0), paint));
    f.add(new THREE.Mesh(HUAYRA_grid(HUAYRA_BAKE.flap.map((r) => r.map(([x, y, z]) => [x, y - 0.006, z])), s > 0), mats.carbon)); // 底面
    if (up) { // 以前緣（x≈-1.71）為軸往上翻
      const piv = new THREE.Group(), hx = -1.71, hy = 0.79;
      piv.position.set(hx, hy, 0); f.position.set(-hx, -hy, 0); piv.add(f); piv.rotation.z = -0.55; g.add(piv);
    } else g.add(f);
  }
  return g;
}
// ---- 原廠：下巴、擴散器、側邊小飾條、空白車牌 ----
function HUAYRA_stock(mats) {
  const g = new THREE.Group();
  g.add(lip(mats, [[2.285, 0], [2.275, 0.30], [2.215, 0.52], [2.115, 0.70], [2.01, 0.82], [1.90, 0.89]], 1.85, 0.104));
  for (const z of [-0.42, -0.15, 0.15, 0.42]) {
    const f = new THREE.Shape(); f.moveTo(-1.90, 0.11); f.lineTo(-2.24, 0.19); f.lineTo(-2.26, 0.30); f.lineTo(-2.16, 0.30); f.lineTo(-1.98, 0.17); f.closePath();
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(f, { depth: 0.01, bevelEnabled: false }), mats.carbon); fin.position.z = z - 0.005; g.add(fin);
  }
  for (const s of [1, -1]) { // 前輪後面那條銀色飾條
    const c = new THREE.CatmullRomCurve3(HUAYRA_BAKE.strake.map(([x, y, z]) => new THREE.Vector3(x, y, s * (z + 0.006))));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 12, 0.0065, 6, false), mats.chrome));
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.11, 0.52), HUAYRA_mats(mats).hyPlate);
  plate.position.set(HUAYRA_BAKE.plate[0] - 0.004, 0.39, 0); g.add(plate);
  return g;
}
// ---- 賽道套件：大下巴＋風刀、側裙刀片、大擴散器 ----
const HUAYRA_AERO = {
  front: [[2.34, 0], [2.33, 0.30], [2.27, 0.52], [2.17, 0.70], [2.05, 0.83], [1.92, 0.91]], back: 1.85, y: 0.094,
  canard: { S: [2.07, 0.83], t: [-0.62, 0.78], ys: [0.30, 0.22] },
  skirt: { y: 0.115, x0: -1.05, x1: 0.78, z0: 0.88, z1: 0.99 },
  diff: { x0: -1.85, x1: -2.12, x2: -2.32, y0: 0.125, y1: 0.15, y2: 0.27, w: 0.62, fin0: -1.92 },
};

export const HUAYRA_SPEC = {
  look: HUAYRA_LOOK, paint: '#1f4fd6', metal: 0.35, seat: 0x2a2b2f,
  wheels: { xf: 1.27, xr: -1.525, RF: 0.3305, RR: 0.3545, rimF: 0.2413, rimR: 0.254, trackF: 0.84, trackR: 0.82, wF: 0.255, wR: 0.335, style: HUAYRA_rim },
  mirror: (paint, mats, s) => HUAYRA_mirror(paint, mats, s),
  wings: {
    stock: (paint, mats) => HUAYRA_flaps(paint, mats, false),
    up: (paint, mats) => HUAYRA_flaps(paint, mats, true),
  },
  wing: 'stock',
  interior: { dx: 0.0, cage: false, wheelZ: -0.36, dashX: 0.52, dashY: 0.70, shelf: false, seatDy: -0.12 },
  build(body, paint, mats) {
    HUAYRA_mats(mats);
    body.add(HUAYRA_pods(mats), HUAYRA_lamps(mats), HUAYRA_exhaust(mats), HUAYRA_stock(mats));
    const aero = aeroKit(mats, HUAYRA_AERO); aero.visible = false; body.add(aero);
    return (kit) => { aero.visible = kit === 'track'; };
  },
  kit: 'stock',
};
export const HUAYRA_CAMS = {
  photo1: { a: 10.094, d: 2.201, h: 1.571, tx: 1.675, ty: 0.61, fov: 44.373, rl: 4.43 },
  photo2: { a: 167.91, d: 4.422, h: 1.688, tx: 0.117, ty: 0.26, fov: 40.515, rl: -0.593 },
  photo4: { a: -82.543, d: 60, h: 0.244, tx: 0.189, ty: 0.666, fov: 3.775, rl: 0.3 },
  photo3: { a: 91.517, d: 11.038, h: 0.368, tx: 0.112, ty: 0.917, fov: 18.804, rl: -0.017 },
};
export const HUAYRA_GARAGE = {
  name: 'HY 風神', sub: '藍色風神超跑 · 3D 試做版',
  paints: [['#1f4fd6', '法國藍（照片 1、2）'], ['#8e0f26', '深紅（照片 3）'], ['#b9bdc2', '銀（照片 4）'], ['#f1f2f0', '白'], ['#f0c018', '黃'],
    ['#16171a', '黑'], ['#e5641c', '橘'], ['#1d5e3a', '綠']],
  opts: {
    wing: [['stock', '原廠擾流板'], ['up', '擾流板立起來'], ['none', '不要']],
    kit: [['stock', '原廠'], ['track', '賽道']],
    height: [['0', '原廠'], ['-0.03', '降低'], ['-0.05', '貼地']],
    livery: [['tri', '三色細條'], ['none', '不要']],
  },
  state: { paint: '#1f4fd6', rim: 'chrome', caliper: '#b8bcc2', wing: 'stock', kit: 'stock', height: '0', livery: 'tri', tint: 'light' },
};
