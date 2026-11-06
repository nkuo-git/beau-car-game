// 自行車（第 67 批，做圖）：自己設計的，沒有真的牌子。整台用程式做（沒有車殼 glb）：車架（管子）、前叉、把手、座墊、曲柄＋腳踏、齒盤、鏈條、飛輪、兩個輪子（輻條）、煞車。
// key：'mtb'（登山車：避震前叉、粗的越野胎、平把、碟煞）／'road'（公路車：彎把、細胎、夾器）。座標：x 往前、y 往上、z 往右（跟 moto-spec.js 一樣），公尺。
import * as THREE from 'three';

const BK_V = (a) => new THREE.Vector3(...a);
function BK_rod(a, b, r, seg = 12, r2 = r) { // a → b 的圓管
  const A = BK_V(a), B = BK_V(b), d = B.clone().sub(A), g = new THREE.CylinderGeometry(r2, r, d.length(), seg, 1, false);
  g.applyMatrix4(new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1)));
  return g;
}
const BK_tube = (pts, r, seg = 40, rs = 10) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(BK_V), false, 'catmullrom', 0.3), seg, r, rs, false);
function BK_merge(list) {
  const P = [], N = []; let n = 0;
  for (let g of list) { if (g.index) g = g.toNonIndexed(); P.push(g.attributes.position.array); N.push(g.attributes.normal.array); n += g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (let i = 0; i < P.length; i++) { pos.set(P[i], o); nor.set(N[i], o); o += P[i].length; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
}
const BK_at = (g, x, y, z, rx = 0, ry = 0, rz = 0) => { g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1))); return g; };

// 兩台的尺寸：輪子半徑（外徑）、胎寬、輪框半徑、前後輪軸、五通（曲柄的軸）、頭管上下、座墊、把手
export const BIKE = {
  mtb: { R: 0.365, tw: 0.058, rim: 0.292, xr: -0.565, xf: 0.6, bb: [-0.13, 0.33], ht: [[0.425, 0.66], [0.38, 0.79]], seat: [-0.315, 0.97], bar: [0.36, 0.87], barW: 0.37, crank: 0.17 },
  road: { R: 0.336, tw: 0.028, rim: 0.3, xr: -0.5, xf: 0.5, bb: [-0.1, 0.27], ht: [[0.385, 0.68], [0.345, 0.84]], seat: [-0.29, 0.95], bar: [0.43, 0.88], barW: 0.21, crank: 0.172 },
};

// 輪子（輪軸＝z）：外胎、輪框、輻條、花鼓（＋碟盤）
function bikeWheel(S, mats, key, rear) {
  const g = new THREE.Group(), R = S.R, tw = S.tw, rim = S.rim, cr = R - tw / 2;
  const tyre = new THREE.TorusGeometry(cr, tw / 2, 14, 96);
  if (key === 'mtb') { // 越野胎：外圈一顆一顆的胎塊
    const knobs = [];
    for (let i = 0; i < 64; i++) { const a = i * Math.PI * 2 / 64; for (const z of i % 2 ? [-0.016, 0.016] : [0]) knobs.push(BK_at(new THREE.BoxGeometry(0.014, 0.012, 0.016), Math.cos(a) * (R - 0.002), Math.sin(a) * (R - 0.002), z, 0, 0, a)); }
    for (let i = 0; i < 64; i++) { const a = (i + 0.5) * Math.PI * 2 / 64; for (const z of [-0.027, 0.027]) knobs.push(BK_at(new THREE.BoxGeometry(0.012, 0.012, 0.01), Math.cos(a) * (cr + 0.02), Math.sin(a) * (cr + 0.02), z, 0, 0, a)); }
    g.add(new THREE.Mesh(BK_merge([tyre, ...knobs]), mats.rubber));
  } else g.add(new THREE.Mesh(tyre, mats.rubber));
  const rimG = new THREE.LatheGeometry([[rim - 0.012, -0.011], [rim + 0.006, -0.012], [rim + 0.008, 0.012], [rim - 0.012, 0.011], [rim - 0.012, -0.011]].map(([r, y]) => new THREE.Vector2(r, y)), 96); rimG.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(rimG, key === 'road' ? mats.black : mats.alu));
  const sp = [], n = key === 'road' ? 24 : 32, hz = 0.03;
  for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n, s = i % 2 ? 1 : -1, a0 = a + s * 0.25; sp.push(BK_rod([Math.cos(a0) * 0.024, Math.sin(a0) * 0.024, s * hz], [Math.cos(a) * (rim - 0.012), Math.sin(a) * (rim - 0.012), s * 0.004], 0.0011, 4)); }
  g.add(new THREE.Mesh(BK_merge(sp), mats.steel));
  const hub = new THREE.CylinderGeometry(0.018, 0.018, 0.1, 16); hub.rotateX(Math.PI / 2);
  const fl = [-hz, hz].map((z) => BK_at(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 20), 0, 0, z, Math.PI / 2));
  g.add(new THREE.Mesh(BK_merge([hub, ...fl]), mats.alu));
  if (key === 'mtb') { // 碟盤（左邊）
    const d = new THREE.Shape(); d.absarc(0, 0, 0.09, 0, Math.PI * 2, false); const h = new THREE.Path(); h.absarc(0, 0, 0.07, 0, Math.PI * 2, true); d.holes.push(h);
    for (let j = 0; j < 12; j++) { const a = j * Math.PI / 6, q = new THREE.Path(); q.absarc(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0.004, 0, Math.PI * 2, true); d.holes.push(q); }
    const dg = new THREE.ExtrudeGeometry(d, { depth: 0.002, bevelEnabled: false, curveSegments: 40 }); dg.translate(0, 0, -0.052);
    const arms = []; for (let j = 0; j < 6; j++) { const a = j * Math.PI / 3; arms.push(BK_rod([Math.cos(a) * 0.02, Math.sin(a) * 0.02, -0.051], [Math.cos(a + 0.3) * 0.072, Math.sin(a + 0.3) * 0.072, -0.051], 0.004, 6)); }
    g.add(new THREE.Mesh(BK_merge([dg, ...arms]), mats.disc));
  }
  if (rear) { // 飛輪（右邊，一片一片的齒片）
    const cs = []; for (let j = 0; j < (key === 'road' ? 11 : 12); j++) { const r = 0.024 + j * (key === 'road' ? 0.0042 : 0.0055), c = new THREE.CylinderGeometry(r, r, 0.0018, 28); c.rotateX(Math.PI / 2); c.translate(0, 0, 0.045 - j * 0.0037); cs.push(c); }
    g.add(new THREE.Mesh(BK_merge(cs), mats.steel));
  }
  return g;
}

// 一台：回傳 { group, wheels: [後, 前], crank, bars }（crank、bars 是會轉的那組）
export function bikeBuild(key, paint, mats) {
  const S = BIKE[key], g = new THREE.Group(), y0 = S.R, [bx, by] = S.bb, [hb, ht] = S.ht, R = key === 'road';
  const tr = R ? 0.016 : 0.022; // 管子的半徑
  // ---- 車架 ----
  const stTop = [bx + (S.seat[0] - bx) * (R ? 0.72 : 0.6), by + (S.seat[1] - by) * (R ? 0.72 : 0.6)];
  const frame = [
    BK_rod([bx, by, 0], [stTop[0], stTop[1], 0], tr * 0.85), // 立管
    BK_rod([bx, by, 0], [hb[0], hb[1], 0], tr * 1.15, 14, tr), // 下管
    BK_rod([stTop[0] + 0.01, stTop[1] - 0.03, 0], [ht[0], ht[1] - 0.03, 0], tr * 0.9), // 上管
    BK_rod([hb[0] + 0.006, hb[1] - 0.03, 0], [ht[0] - 0.004, ht[1] + 0.03, 0], tr * 1.35, 16), // 頭管
  ];
  for (const s of [-1, 1]) {
    frame.push(BK_tube([[bx, by, s * 0.03], [(bx + S.xr) / 2, (by + y0) / 2 - 0.005, s * 0.06], [S.xr, y0, s * 0.066]], tr * 0.55, 12, 8)); // 後下叉
    frame.push(BK_tube([[stTop[0] - 0.005, stTop[1] - 0.04, s * 0.022], [(stTop[0] + S.xr) / 2, (stTop[1] + y0) / 2 + 0.02, s * 0.055], [S.xr, y0 + 0.01, s * 0.066]], tr * 0.48, 12, 8)); // 後上叉
  }
  frame.push(BK_at(new THREE.CylinderGeometry(0.024, 0.024, 0.075, 18), bx, by, 0, Math.PI / 2)); // 五通
  g.add(new THREE.Mesh(BK_merge(frame), paint));
  // 車架上的字（自己編的）：下管兩邊一條白色的貼紙
  const dDir = new THREE.Vector2(hb[0] - bx, hb[1] - by), dL = dDir.length(), dA = Math.atan2(dDir.y, dDir.x);
  for (const s of [-1, 1]) g.add(new THREE.Mesh(BK_at(new THREE.BoxGeometry(dL * 0.45, tr * 0.9, 0.002), bx + Math.cos(dA) * dL * 0.5, by + Math.sin(dA) * dL * 0.5, s * tr * 1.12, 0, 0, dA), mats.decal));
  // ---- 前叉、龍頭、把手（bars：轉向的那一組，繞頭管轉）----
  const bars = new THREE.Group(); bars.name = 'bars';
  const ax = new THREE.Vector2(ht[0] - hb[0], ht[1] - hb[1]).normalize(); // 頭管往上的方向
  const fk = [S.xf, y0], crown = [hb[0] - ax.x * 0.03, hb[1] - ax.y * 0.03];
  const fork = [];
  if (!R) { // 避震前叉：上面銀色內管、下面黑色外管
    const mid = [crown[0] + (fk[0] - crown[0]) * 0.45, crown[1] + (fk[1] - crown[1]) * 0.45];
    const st = [], low = [];
    for (const s of [-1, 1]) { st.push(BK_rod([crown[0], crown[1], s * 0.055], [mid[0], mid[1], s * 0.055], 0.016, 14)); low.push(BK_rod([mid[0] + (crown[0] - mid[0]) * 0.1, mid[1] + (crown[1] - mid[1]) * 0.1, s * 0.055], [fk[0] - 0.01, fk[1] - 0.02, s * 0.055], 0.021, 14)); }
    low.push(BK_tube([[mid[0] - 0.01, mid[1] + 0.06, -0.055], [mid[0] + 0.03, mid[1] + 0.08, 0], [mid[0] - 0.01, mid[1] + 0.06, 0.055]], 0.012, 12, 8)); // 拱橋
    low.push(BK_at(new THREE.BoxGeometry(0.06, 0.035, 0.15), crown[0], crown[1], 0, 0, 0, Math.atan2(ax.y, ax.x) - Math.PI / 2)); // 肩蓋
    bars.add(new THREE.Mesh(BK_merge(st), mats.chrome), new THREE.Mesh(BK_merge(low), mats.black));
  } else {
    for (const s of [-1, 1]) fork.push(BK_tube([[crown[0], crown[1], s * 0.03], [(crown[0] + fk[0]) / 2 + 0.01, (crown[1] + fk[1]) / 2, s * 0.05], [fk[0], fk[1], s * 0.052]], 0.011, 16, 8));
    fork.push(BK_at(new THREE.BoxGeometry(0.04, 0.03, 0.08), crown[0], crown[1], 0));
    bars.add(new THREE.Mesh(BK_merge(fork), paint));
  }
  const top = [ht[0] + ax.x * 0.05, ht[1] + ax.y * 0.05]; // 龍頭的柱
  const stem = [BK_rod([ht[0], ht[1], 0], [top[0], top[1], 0], 0.016, 14), BK_rod([top[0] - 0.01, top[1] - 0.01, 0], [S.bar[0], S.bar[1], 0], 0.017, 12)];
  bars.add(new THREE.Mesh(BK_merge(stem), mats.black));
  const bw = S.barW, bar = [];
  if (!R) bar.push(BK_tube([[S.bar[0] - 0.03, S.bar[1] + 0.012, -bw], [S.bar[0], S.bar[1] + 0.006, -0.12], [S.bar[0] + 0.004, S.bar[1], 0], [S.bar[0], S.bar[1] + 0.006, 0.12], [S.bar[0] - 0.03, S.bar[1] + 0.012, bw]], 0.0115, 40, 10));
  else for (const s of [-1, 1]) bar.push(BK_tube([[S.bar[0], S.bar[1], 0], [S.bar[0], S.bar[1], s * 0.12], [S.bar[0] + 0.02, S.bar[1], s * 0.2], [S.bar[0] + 0.1, S.bar[1] - 0.01, s * bw], [S.bar[0] + 0.13, S.bar[1] - 0.08, s * bw], [S.bar[0] + 0.08, S.bar[1] - 0.14, s * bw], [S.bar[0], S.bar[1] - 0.13, s * bw]], 0.0115, 40, 10)); // 彎把
  bars.add(new THREE.Mesh(BK_merge(bar), mats.alu2));
  const grips = [];
  if (!R) for (const s of [-1, 1]) { grips.push(BK_rod([S.bar[0] - 0.024, S.bar[1] + 0.011, s * (bw - 0.11)], [S.bar[0] - 0.03, S.bar[1] + 0.012, s * (bw + 0.004)], 0.017, 14)); }
  else for (const s of [-1, 1]) grips.push(BK_tube([[S.bar[0] + 0.02, S.bar[1], s * 0.2], [S.bar[0] + 0.1, S.bar[1] - 0.01, s * bw], [S.bar[0] + 0.13, S.bar[1] - 0.08, s * bw], [S.bar[0] + 0.08, S.bar[1] - 0.14, s * bw]], 0.0145, 30, 10)); // 握把帶
  // 煞車把手（兩邊）、變速撥桿、鈴鐺（右邊）、車燈（前面）
  for (const s of [-1, 1]) {
    if (!R) grips.push(BK_rod([S.bar[0] - 0.01, S.bar[1] + 0.02, s * (bw - 0.13)], [S.bar[0] + 0.07, S.bar[1] + 0.005, s * (bw - 0.05)], 0.006, 8));
    else grips.push(BK_rod([S.bar[0] + 0.13, S.bar[1] - 0.02, s * bw], [S.bar[0] + 0.15, S.bar[1] - 0.15, s * bw], 0.007, 8), BK_at(new THREE.BoxGeometry(0.05, 0.05, 0.03), S.bar[0] + 0.125, S.bar[1] - 0.005, s * bw)); // 變速把手（兩用）
  }
  bars.add(new THREE.Mesh(BK_merge(grips), mats.black));
  const bell = new THREE.SphereGeometry(0.022, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); bell.translate(S.bar[0] + 0.005, S.bar[1] + 0.014, R ? 0.075 : 0.2);
  bars.add(new THREE.Mesh(bell, mats.chrome));
  const lamp = BK_at(new THREE.CylinderGeometry(0.022, 0.026, 0.06, 18), S.bar[0] + 0.03, S.bar[1] - 0.028, R ? -0.06 : -0.08, 0, 0, -Math.PI / 2);
  bars.add(new THREE.Mesh(lamp, mats.black));
  const lens = BK_at(new THREE.CircleGeometry(0.021, 18), S.bar[0] + 0.061, S.bar[1] - 0.028, R ? -0.06 : -0.08, 0, Math.PI / 2, 0);
  bars.add(new THREE.Mesh(lens, mats.light));
  g.add(bars);
  bars.userData.piv = [hb[0], hb[1], 0]; bars.userData.ax = [ax.x, ax.y, 0];
  // ---- 座墊、座管 ----
  const sp = [stTop[0] + 0.01, stTop[1] - 0.04];
  g.add(new THREE.Mesh(BK_rod([sp[0], sp[1], 0], [S.seat[0] + 0.01, S.seat[1] - 0.03, 0], 0.0135, 14), mats.alu2));
  const sad = new THREE.SphereGeometry(1, 24, 12); const sp2 = sad.attributes.position;
  for (let i = 0; i < sp2.count; i++) { const x = sp2.getX(i), y = sp2.getY(i), z = sp2.getZ(i), w = 0.035 + 0.045 * Math.max(0, Math.min(1, (-x + 0.2) / 1.0)); sp2.setXYZ(i, x * 0.135, y * (y < 0 ? 0.03 : 0.024) + x * x * 0.012, z * w); }
  sad.computeVertexNormals(); sad.translate(S.seat[0], S.seat[1] - 0.005, 0);
  g.add(new THREE.Mesh(sad, mats.saddle));
  // ---- 曲柄、齒盤、腳踏（crank：繞五通轉）----
  const crank = new THREE.Group(); crank.name = 'crank'; crank.position.set(bx, by, 0);
  const ring = new THREE.Shape(), rr = R ? 0.105 : 0.085; ring.absarc(0, 0, rr, 0, Math.PI * 2, false); const hh = new THREE.Path(); hh.absarc(0, 0, rr - 0.018, 0, Math.PI * 2, true); ring.holes.push(hh);
  const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.003, bevelEnabled: false, curveSegments: 48 }); rg.translate(0, 0, 0.052);
  const teeth = []; for (let j = 0; j < (R ? 50 : 32); j++) { const a = j * Math.PI * 2 / (R ? 50 : 32); teeth.push(BK_at(new THREE.BoxGeometry(0.006, 0.006, 0.003), Math.cos(a) * (rr + 0.002), Math.sin(a) * (rr + 0.002), 0.0535, 0, 0, a)); }
  const spider = []; for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2 + Math.PI / 4; spider.push(BK_rod([0, 0, 0.05], [Math.cos(a) * (rr - 0.01), Math.sin(a) * (rr - 0.01), 0.05], 0.006, 6)); }
  crank.add(new THREE.Mesh(BK_merge([rg, ...teeth]), mats.steel), new THREE.Mesh(BK_merge(spider), mats.black));
  const L = S.crank, arms = [], peds = [];
  for (const s of [-1, 1]) { // 右邊的曲柄朝前（角度 0），左邊朝後
    const dx = s > 0 ? L : -L;
    arms.push(BK_rod([0, 0, s * 0.062], [dx, 0, s * 0.072], 0.011, 10, 0.009));
    const pd = new THREE.Group(); pd.name = s > 0 ? 'pedR' : 'pedL'; pd.position.set(dx, 0, s * 0.11);
    pd.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.016, 0.075), mats.black));
    pd.add(new THREE.Mesh(BK_at(new THREE.BoxGeometry(0.004, 0.006, 0.07), 0.04, -0.012, 0), mats.amber), new THREE.Mesh(BK_at(new THREE.BoxGeometry(0.004, 0.006, 0.07), -0.04, -0.012, 0), mats.amber)); // 反光片
    crank.add(pd); peds.push(pd);
  }
  crank.add(new THREE.Mesh(BK_merge([...arms, BK_at(new THREE.CylinderGeometry(0.012, 0.012, 0.15, 12), 0, 0, 0, Math.PI / 2)]), mats.alu2));
  g.add(crank);
  // 鏈條：齒盤 → 飛輪（上下兩條，右邊）
  const cw = 0.003, rc = R ? 0.034 : 0.05, chain = [];
  for (const s of [-1, 1]) chain.push(BK_rod([bx, by + s * (rr + cw), 0.054], [S.xr, y0 + s * (rc + cw), 0.054], 0.004, 6));
  const cA = new THREE.TorusGeometry(rr + cw, 0.004, 6, 48, Math.PI); cA.rotateZ(-Math.PI / 2); cA.translate(bx, by, 0.054);
  const cB = new THREE.TorusGeometry(rc + cw, 0.004, 6, 24, Math.PI); cB.rotateZ(Math.PI / 2); cB.translate(S.xr, y0, 0.054);
  g.add(new THREE.Mesh(BK_merge([...chain, cA, cB]), mats.chain));
  if (!R) g.add(new THREE.Mesh(BK_merge([BK_rod([S.xr + 0.01, y0 - 0.02, 0.066], [S.xr + 0.03, y0 - 0.11, 0.07], 0.01, 8), BK_at(new THREE.BoxGeometry(0.04, 0.05, 0.015), S.xr + 0.035, y0 - 0.11, 0.072)]), mats.black)); // 後變速器
  // 煞車：登山車＝卡鉗（碟盤那邊），公路車＝夾器
  if (!R) { const cal = [BK_at(new THREE.BoxGeometry(0.05, 0.035, 0.022), S.xf - 0.05, y0 + 0.06, -0.055), BK_at(new THREE.BoxGeometry(0.05, 0.035, 0.022), S.xr + 0.045, y0 + 0.07, -0.055)]; g.add(new THREE.Mesh(BK_merge(cal), mats.black)); }
  else { const cal = [BK_at(new THREE.BoxGeometry(0.03, 0.05, 0.06), crown[0] + 0.01, crown[1] - 0.04, 0), BK_at(new THREE.BoxGeometry(0.03, 0.05, 0.06), stTop[0] - 0.07, stTop[1] - 0.12, 0)]; g.add(new THREE.Mesh(BK_merge(cal), mats.alu2)); }
  // 水壺架＋水壺（下管上面）、後面的紅色反光片
  const wb = [bx + Math.cos(dA) * dL * 0.45 - Math.sin(dA) * 0.045, by + Math.sin(dA) * dL * 0.45 + Math.cos(dA) * 0.045];
  g.add(new THREE.Mesh(BK_at(new THREE.CylinderGeometry(0.034, 0.034, 0.2, 18), wb[0], wb[1], 0, 0, 0, dA - Math.PI / 2), mats.bottle));
  g.add(new THREE.Mesh(BK_at(new THREE.BoxGeometry(0.012, 0.03, 0.04), S.seat[0] - 0.03, S.seat[1] - 0.09, 0), mats.red));
  if (!R) { // 側柱（停的時候放下來，騎的時候收起來：做圖先收著）
    const ks = new THREE.Mesh(BK_rod([0, 0, 0], [-0.24, -0.02, 0], 0.008, 8), mats.black); ks.name = 'kick'; ks.position.set(bx - 0.04, by - 0.01, -0.05); g.add(ks);
  }
  // ---- 輪子 ----
  const wR = bikeWheel(S, mats, key, true), wF = bikeWheel(S, mats, key, false);
  wR.position.set(S.xr, y0, 0); wF.position.set(S.xf - (hb[0] - (S.xf)) * 0, y0, 0);
  g.add(wR); bars.add(wF);
  return { group: g, wheels: [wR, wF], crank, bars, peds };
}

// 騎的人：屁股（character 的 at）、手（握把）、兩隻腳（跟著曲柄轉）
export const BIKE_RIDE = {
  mtb: { at: [-0.27, 0.53, 0], grip: [0.335, 0.882, 0.29], max: 0.5, lean: 0.3 },
  road: { at: [-0.24, 0.51, 0], grip: [0.53, 0.87, 0.21], max: 0.45, lean: 0.6 },
};
const BK_HD = [[0, 0, 0], [0, 0, 0]], BK_FT = [[0, 0, 0], [0, 0, 0]], BK_UP = { state: 'sit', hands: BK_HD, feet: BK_FT, leanMax: 1.7, leanAdd: 0 }, BK_P = new THREE.Vector3();
export function bikeRide(C, B, key, dt) { // B＝bikeBuild 回傳的；腳踝在腳踏上面 7 公分
  const R = BIKE_RIDE[key], at = R.at, G = R.grip;
  BK_UP.leanAdd = R.lean;
  for (let k = 0; k < 2; k++) { BK_HD[k][0] = G[0] - at[0]; BK_HD[k][1] = G[1] - at[1]; BK_HD[k][2] = (k ? 1 : -1) * G[2]; }
  B.group.updateMatrixWorld(true);
  for (let k = 0; k < 2; k++) { const p = B.peds[k ? 1 : 0]; p.getWorldPosition(BK_P); B.group.worldToLocal(BK_P); BK_FT[k][0] = BK_P.x - at[0] - 0.01; BK_FT[k][1] = BK_P.y - at[1] + 0.07; BK_FT[k][2] = BK_P.z * 0.85; }
  C.update(dt, BK_UP);
}
