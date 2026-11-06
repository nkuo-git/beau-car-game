// 自行車（第 67 批；Nick 2026-11-06「加自行車」「還有越野腳踏車」，卡片「兩台都做」）：自己設計的，沒有真的牌子。整台用程式做（車身 glb 只是五通裡一顆看不到的小方塊：make-bike.mjs）：
// 車架（管子）、前叉、把手、座墊、曲柄＋腳踏、齒盤、鏈條、飛輪、兩個輪子（輻條）、煞車。騎的人跟 Z2／N4 一樣（town.src.js RIDES）：手握把手、腳踩腳踏（曲柄跟著後輪轉）。
// key：'mtb'（登山車：避震前叉、粗的越野胎、平把、碟煞）／'road'（公路車：彎把、細胎、夾器）。座標：x 往前、y 往上、z 往右（跟 moto-spec.js 一樣），公尺。
import * as THREE from 'three';
import { BOX, layers, canvas } from './masks.js';

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
    const ks = new THREE.Mesh(BK_rod([0, 0, 0], [-0.24, -0.02, 0], 0.008, 8), mats.black); ks.name = 'kick'; ks.position.set(bx - 0.04, by - 0.01, -0.05); ks.rotation.z = 0.1; g.add(ks); // 收著（沿著後下叉）
  }
  // ---- 輪子 ----
  const wR = bikeWheel(S, mats, key, true), wF = bikeWheel(S, mats, key, false);
  wR.name = 'wheelR'; wF.name = 'wheelF'; // supra.js buildCar（wheels.moto）、lod-bake.html 認這兩個名字
  wR.position.set(S.xr, y0, 0); wF.position.set(S.xf, y0, 0);
  g.add(wR); bars.add(wF);
  const B = { group: g, wheels: [wR, wF], crank, bars, peds, key, kick: g.getObjectByName('kick') || null };
  g.userData.bike = B;
  return B;
}

// ---- 騎的人（跟 z2-spec.js、moto-spec.js 一樣的介面：town.src.js 的 RIDES）----
//   at：屁股（character 的 group 放在車身底下的這一點）；grip：右手的握把（左手 z 相反；把手轉了跟著轉）；lean：坐上去再多往前趴幾弧度（手才搆得到低低的把手）
//   max：drive 的 steer 打到底（±1）把手轉幾弧度；ratio：後輪轉幾圈曲柄轉一圈（齒比）；view：第一人稱（CABIN_VIEW）：眼睛、往前看的點；真的騎的時候照騎的人的眼睛換（bikeEye）
export const BIKE_RIDE = {
  mtb: { at: [-0.27, 0.47, 0], grip: [0.335, 0.882, 0.29], max: 0.5, lean: 0.3, ratio: 2.3, view: { eye: [0.28, 1.33, 0], look: [3.2, 0.5, 0], fov: 72 } }, // at 比座墊低 5 公分：腳才踩得到最下面的腳踏（角色的腿比較短）
  road: { at: [-0.24, 0.45, 0], grip: [0.53, 0.87, 0.21], max: 0.45, lean: 0.6, ratio: 2.9, view: { eye: [0.32, 1.15, 0], look: [3.2, 0.4, 0], fov: 72 } },
};
const BK_HD = [[0, 0, 0], [0, 0, 0]], BK_FT = [[0, 0, 0], [0, 0, 0]], BK_UP = { state: 'sit', hands: BK_HD, feet: BK_FT, leanMax: 1.7, leanAdd: 0 };
const BK_P = new THREE.Vector3(), BK_Q = new THREE.Quaternion(), BK_PV = new THREE.Vector3(), BK_AX = new THREE.Vector3();
const bikeOf = (o) => (o && (o.userData.bike || (o.userData.bike = o.getObjectByName('bars')?.parent?.userData.bike))) || null; // body（車身）或 bikeBuild 的 group → B
// 把手跟著轉（繞頭管）＋曲柄跟著後輪轉（腳踏保持水平）；s＝drive 的 steer（−1 左～1 右）；每一格叫（town.src.js riderStep、riderOff）
export function bikeSteer(body, s, key) {
  const B = bikeOf(body); if (!B) return;
  const S = BIKE[key], R = BIKE_RIDE[key], b = B.bars, piv = b.userData.piv, ax = b.userData.ax;
  BK_AX.set(ax[0], ax[1], ax[2]).normalize(); BK_PV.set(piv[0], piv[1], piv[2]);
  b.quaternion.setFromAxisAngle(BK_AX, -s * R.max);
  b.position.copy(BK_PV).sub(BK_P.copy(BK_PV).applyQuaternion(b.quaternion));
  const a = B.wheels[0].rotation.z / R.ratio; B.crank.rotation.z = a; for (const p of B.peds) p.rotation.z = -a;
  void S;
}
// 人坐好：手握著（轉過的）把手、腳踩（轉到哪裡的）腳踏；C＝buildCharacter(look, { state: 'sit', shadow: false, plant: false })，C.group 放在車身底下的 BIKE_RIDE.at；每一格叫（不會 new 東西）
export function bikeRide(C, s, dt, key) {
  const R = BIKE_RIDE[key], S = BIKE[key], at = R.at, G = R.grip, B = bikeOf(C.group.parent);
  const piv = B ? B.bars.userData.piv : [0, 0, 0], ax = B ? B.bars.userData.ax : [0, 1, 0];
  BK_AX.set(ax[0], ax[1], ax[2]).normalize(); BK_PV.set(piv[0], piv[1], piv[2]); BK_Q.setFromAxisAngle(BK_AX, -s * R.max);
  for (let k = 0; k < 2; k++) {
    BK_P.set(G[0], G[1], (k ? 1 : -1) * G[2]).sub(BK_PV).applyQuaternion(BK_Q).add(BK_PV);
    BK_HD[k][0] = BK_P.x - at[0]; BK_HD[k][1] = BK_P.y - at[1]; BK_HD[k][2] = BK_P.z - at[2];
  }
  const a = B ? B.crank.rotation.z : 0, [bx, by] = S.bb, L = S.crank; // 腳踏：右邊曲柄角度 a（朝前＝0），左邊相反；腳踝在腳踏上面 7 公分
  for (let k = 0; k < 2; k++) { const dx = k ? L : -L; BK_FT[k][0] = bx + dx * Math.cos(a) - at[0] - 0.01; BK_FT[k][1] = by + dx * Math.sin(a) - at[1] + 0.07; BK_FT[k][2] = (k ? 1 : -1) * 0.11 * 0.85; }
  BK_UP.leanAdd = R.lean;
  C.update(dt, BK_UP);
}
// 騎的人的眼睛（車身座標）：把手擺正坐好以後量（out＝[x, y, z]）；C 還沒放進車身的時候也可以量（照 at 算）
export function bikeEye(C, key, out = [0, 0, 0]) {
  for (let i = 0; i < 30; i++) bikeRide(C, 0, 1 / 30, key);
  const g = C.group, p = g.parent; if (p) p.remove(g);
  const P0 = g.position.clone(), R0 = g.rotation.clone(); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
  g.updateMatrixWorld(true); C.eyes.getWorldPosition(BK_P);
  g.position.copy(P0); g.rotation.copy(R0); if (p) p.add(g);
  const at = BIKE_RIDE[key].at; out[0] = BK_P.x + at[0]; out[1] = BK_P.y + at[1]; out[2] = BK_P.z + at[2];
  return out;
}
export const MTB_RIDE = BIKE_RIDE.mtb, ROAD_RIDE = BIKE_RIDE.road;
export const MTB_steer = (body, s) => bikeSteer(body, s, 'mtb'), ROAD_steer = (body, s) => bikeSteer(body, s, 'road');
export const MTB_ride = (C, s = 0, dt = 1 / 60) => bikeRide(C, s, dt, 'mtb'), ROAD_ride = (C, s = 0, dt = 1 / 60) => bikeRide(C, s, dt, 'road');
export const MTB_eye = (C, out) => bikeEye(C, 'mtb', out), ROAD_eye = (C, out) => bikeEye(C, 'road', out);

// ---- 材質：車庫的 mats 沒有的自己做（bike-view.html 也用）----
export function bikeMats(mats, key) {
  const M = { ...mats };
  M.alu2 ||= new THREE.MeshStandardMaterial({ color: 0x8e9196, roughness: 0.45, metalness: 0.8 });
  M.steel ||= new THREE.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.35, metalness: 0.9 });
  M.decal ||= new THREE.MeshStandardMaterial({ color: 0xf4f5f6, roughness: 0.5, metalness: 0 });
  M.light ||= new THREE.MeshStandardMaterial({ color: 0xf6f3e4, roughness: 0.2, metalness: 0, emissive: 0xfff3c0, emissiveIntensity: 0.35 });
  M.saddle ||= M.seat || new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.8 });
  M.amber ||= new THREE.MeshStandardMaterial({ color: 0xe8901a, roughness: 0.3, emissive: 0x6a3a00, emissiveIntensity: 0.3 });
  M.chain ||= new THREE.MeshStandardMaterial({ color: 0x5a5d63, roughness: 0.5, metalness: 0.8 });
  M.bottle ||= new THREE.MeshStandardMaterial({ color: key === 'mtb' ? 0x2fb36b : 0xf2f2ee, roughness: 0.4 });
  M.red ||= new THREE.MeshStandardMaterial({ color: 0xd01818, roughness: 0.2, emissive: 0x400000, emissiveIntensity: 1 });
  return M;
}

// ---- 車庫（supra.js buildCar 的 spec）：車身 glb 是一顆看不到的小方塊（make-bike.mjs）；整台在 build() 裡用 bikeBuild 做；兩個輪子（wheels.moto）----
function bikeLook() { // 車殼上沒有玻璃、黑、縫、拉花（都是零件）
  const none = (b) => () => layers(b, [null, null, null, null]);
  const empty = (b) => () => { const { c, g } = canvas(b); g.clearRect(-3, -1, 6, 3); return c; };
  return { side: none(BOX.side), rear: none(BOX.rear), top: none(BOX.top), fronts: { base: none(BOX.front) }, livery: empty(BOX.side), frontLivery: empty(BOX.front), livDefault: 0, nose: () => 'base',
    U: { uXr: -0.5, uXf: 0.5, uFx: [3.0, 3.1], uRx: [-3.0, -3.1], uWell: [0.0, 0.0, 0.0], uWellR: [0.0, 0.0, 0.0], uGlassY: 3 } };
}
// 後貨架（wing 'rack'）：座墊後面的黑色鐵架＋籃子
function bikeRack(S, mats) {
  const g = new THREE.Group(), x0 = S.xr - 0.02, y = S.R + 0.12 + (S.R > 0.35 ? 0.06 : 0), bars = [];
  for (const s of [-1, 1]) { bars.push(BK_rod([x0 + 0.17, y, s * 0.06], [x0 - 0.17, y, s * 0.06], 0.005, 8), BK_rod([x0 - 0.12, y, s * 0.06], [S.xr, S.R + 0.01, s * 0.05], 0.005, 8), BK_rod([x0 + 0.12, y, s * 0.06], [S.xr + 0.12, S.R + 0.26, s * 0.03], 0.005, 8)); }
  for (const dx of [-0.17, -0.06, 0.06, 0.17]) bars.push(BK_rod([x0 + dx, y, -0.06], [x0 + dx, y, 0.06], 0.004, 6));
  g.add(new THREE.Mesh(BK_merge(bars), mats.black));
  const bk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.24), new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.7 })); bk.position.set(x0, y + 0.075, 0); g.add(bk);
  return g;
}
function bikeSpec(key) {
  const S = BIKE[key];
  return {
    look: bikeLook(), paint: key === 'mtb' ? '#e2531d' : '#1f6fd1', metal: 0.1, seat: 0x141518,
    wheels: { xf: S.xf, xr: S.xr, R: S.R, rim: S.rim, trackF: 0.08, trackR: 0.08, wF: S.tw, wR: S.tw, style: 'five', moto: true },
    wings: { none: () => new THREE.Group(), rack: (paint, mats) => bikeRack(S, mats) },
    wing: 'none',
    interior: {},
    build(body, paint, mats) {
      const cab = body.getObjectByName('interior'); if (cab) body.remove(cab); // 沒有車內（騎的）
      const B = bikeBuild(key, paint, bikeMats(mats, key));
      body.add(B.group); body.userData.bike = B;
      return () => {};
    },
    kit: 'stock',
    lod: { wheels: (B, R, kit, axles) => bikeLodWheels(B, R, kit, axles, key) },
  };
}
// 輕量車的兩個輪子（carlod.js 的 builder：B.lathe／B.cap；R＝角色 → 類別）：圓胎、兩面輪框、花鼓；都在中間（z 0）
function bikeLodWheels(B, R, kit, axles, key) {
  for (const A of axles) {
    const c = { x: A.x, y: A.R, z: 0 }, w = A.w, Rr = A.R, rim = A.rim, hw = w / 2, cc = Rr - hw, prof = [[rim - 0.008, -hw * 0.5], [rim + 0.004, -hw * 0.95]];
    for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + Math.PI * i / 8; prof.push([cc + Math.cos(a) * hw, Math.sin(a) * hw]); }
    prof.push([rim + 0.004, hw * 0.95], [rim - 0.008, hw * 0.5]);
    B.lathe(prof, 32, c, 1, R.rubber);
    const ring = []; for (let j = 0; j < 24; j++) { const a = (j / 24) * Math.PI * 2; ring.push([Math.cos(a) * (rim - 0.006), Math.sin(a) * (rim - 0.006)]); }
    B.cap(ring, 0.006, c, 1, key === 'road' ? R.black : R.rim); B.cap(ring, -0.006, c, 1, key === 'road' ? R.black : R.rim, true); // 輪框兩面（輻條太細，輕量車不畫）
    const hub = []; for (let j = 0; j < 12; j++) { const a = (j / 12) * Math.PI * 2; hub.push([Math.cos(a) * 0.03, Math.sin(a) * 0.03]); }
    B.cap(hub, 0.04, c, 1, R.rim); B.cap(hub, -0.04, c, 1, R.rim, true);
  }
}
export const MTB_SPEC = bikeSpec('mtb'), ROAD_SPEC = bikeSpec('road');
const BIKE_OPTS = { wing: [['none', '不要'], ['rack', '後貨架＋籃子']], kit: [['stock', '原廠']], height: [['0', '原廠']], livery: [['none', '沒有']], rimStyle: [['stock', '原廠']], wide: [['off', '原廠']] };
export const MTB_GARAGE = {
  name: '越野腳踏車', sub: '登山車 · 3D 試做版',
  paints: [['#e2531d', '橘'], ['#2fb36b', '綠'], ['#1f6fd1', '藍'], ['#d42a2a', '紅'], ['#f2c21b', '黃'], ['#f2f2ee', '白'], ['#121315', '黑'], ['#8e44ad', '紫']],
  opts: BIKE_OPTS,
  state: { paint: '#e2531d', rim: 'chrome', caliper: '#17181b', wing: 'none', kit: 'stock', height: '0', livery: 'none', tint: 'dark' },
};
export const ROAD_GARAGE = {
  name: '一般腳踏車', sub: '公路車 · 3D 試做版',
  paints: [['#1f6fd1', '藍'], ['#d42a2a', '紅'], ['#f2f2ee', '白'], ['#121315', '黑'], ['#2fb36b', '綠'], ['#f2c21b', '黃'], ['#e2531d', '橘'], ['#59c3d8', '天藍']],
  opts: BIKE_OPTS,
  state: { paint: '#1f6fd1', rim: 'black', caliper: '#17181b', wing: 'none', kit: 'stock', height: '0', livery: 'none', tint: 'dark' },
};
