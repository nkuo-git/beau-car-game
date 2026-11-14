// ---- 第 91 批：圓環高架橋＋高架下面的超大停車場 ----
// Nick 2026-11-14「在原本的快速道路上搭建一個像這樣的圓環高架橋上高架也可以通到內湖最遠處有斜坡緩緩下高架 並且高架橋中間下面要有一個超大停車場有很多車車一樣從車店挑」
//   草稿 https://claude.ai/artifact/FAaQSJMuCUmvLgnfMcFRC2 ，Nick「好 做完直接上線」
// 座標跟 village.js 一樣：x 往東、y 往上、z 往南
// 路線（VD_PATH，每 2 公尺一點）：
//   圓環＝快速道路一圈裡面南邊那座山（hills.js 拿掉了）的地方：圓心 (−780, 250)、中線半徑 105；從北邊 (−780, 145) 地面往西出發，繞 1.5 圈（990 公尺，坡度約 2.5%）到南邊 (−780, 355) 24 公尺高
//   → 往東跨過快速道路、內湖入口上面 → 沿著內湖北邊的山腳 (z 312) 往東 → 東北角轉往南 → 東邊的山腳 (x 1755) 往南、跨過捷運 → 慢慢下來（4%）→ 東南角轉往西 → 接到內湖最東南那條路的盡頭
//   一個方向兩線（3.5 公尺）、中間雙黃線、兩邊水泥護欄（1 公尺）、路燈（晚上亮，look.js 的 V.lampsX）、橋墩（30 公尺一支，不放在路上、房子上）；圓環兩圈疊在一起的地方：兩邊的柱子＋橫樑
//   離地不到 6 公尺的地方兩邊是實心的牆（引道）；高度照地面自己抬高（山腳、捷運上面至少留 6.5 公尺）
// 停車場：圓環中間（半徑 96.5 的柏油）：東西向 9 排、每排兩邊、中間一條南北向的走道；約 900 格、三分之二停了車（車店的車：便宜的多、超跑很少，跟內湖環山路一樣）
//   快速道路南邊彎道內圈的護欄開一個口（village.js VD_GAP），一條 10 公尺寬的路往北接到停車場；停車場北邊接圓環的起點（內側的護欄前 36 公尺沒有）
//   車：遠的是一個 InstancedMesh（一台約 60 個三角形、照那台車的長寬高、顏色），走近 26 公尺內的換成真的輕量車（town.src.js vdLotStep）
// 只有玩家開得上去（跟隧道、圓塔的斜坡一樣）：車流、警察、路人永遠在地上；town.src.js 每一格把玩家多高放在 VDV.st.py → at(x, z, py) 挑最接近的那一層
// 【API】
//   VD_PATH：{ X, Z, S, TX, TZ（Float32Array）, n, L, sH（圓環的終點）}；vdNear(x, z, pad)（離橋面的邊 pad 公尺以內：村子、內湖不放房子、樹）；vdInLot(x, z, pad)（停車場、連到快速道路的路）
//   vdEndDist(x, z)：離最後 420 公尺（下來那段）的中線多遠（80 公尺外 Infinity）：neihu.js 削平那裡的山
//   VD_LOT：{ x, z, r, spots: [[x, z, heading, n]…] }；VD_GAP：快速道路內圈的口（s、半寬）；VD_TEXT（牌子的字）
//   const VDV = buildViaduct(V, { renderer, lotCar(n) → { k, paint } | null, dims(k) → [長, 寬, 高] })   V＝buildVillage()（buildHills 之後）
//     VDV.st：{ py, px, pz, on, high }（town.src.js 每一格寫）；VDV.at(x, z, py) → 橋面高 | null；VDV.normal(x, z, py, out)；VDV.Q（上一次 at 的 s、u、坡度）
//     VDV.cols：只給玩家的碰撞（護欄、橋墩、柱子、停車場的車；off 自己看玩家在哪一層）；VDV.lot：{ cars, hide(j), show(j) }；VDV.info
import * as THREE from 'three';

export const { VD_PATH, VD_LOT, VD_GAP, VD_TEXT, vdNear, vdInLot, vdEndDist, buildViaduct } = (() => {
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const HW = 8, ROAD = 7.4, PLAT = 24, S_OPEN = 36, CLEAR = 6.5, DESC = 0.04, WALL = 6;
const C0 = { x: -780, z: 250 }, R = 105, TURNS = 1.5;
const VD_GAP = { s: 1853.1, h: 7.5 }; // 快速道路 s（從路口往北算）：南邊半圓的中間（−780, 475），內圈的口
const CONN = { x: -780, hw: 5, z0: 330, z1: 466 }; // 快速道路內圈 → 停車場的路
const VD_TEXT = '超大停車場往內湖高架快速道路圓環';

// ---- 路線：細的折線 → 每 2 公尺一點 ----
function crPt(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t, f = (j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
  return [f(0), f(1)];
}
const VD_PATH = (() => {
  const F = [], nh = Math.ceil((TURNS * TAU * R) / 0.5);
  for (let i = 0; i <= nh; i++) { const th = -Math.PI / 2 - (i / nh) * TURNS * TAU; F.push([C0.x + R * Math.cos(th), C0.z + R * Math.sin(th)]); }
  const nH = F.length - 1;
  const cr = (Q) => { for (let i = 1; i < Q.length - 2; i++) for (let k = 1; k <= 60; k++) F.push(crPt(Q[i - 1], Q[i], Q[i + 1], Q[i + 2], k / 60)); };
  cr([[-860, 347], [-780, 355], [-700, 347], [-600, 338], [-420, 338], [-260, 345], [-150, 362], [-60, 360], [0, 345], [60, 320], [150, 312], [300, 312], [450, 312]]); // 圓環出來往東（頭尾多一點讓方向對）
  F.push([1690, 312]);
  for (let k = 1; k <= 40; k++) { const a = (-90 + (90 * k) / 40) * (Math.PI / 180); F.push([1690 + 65 * Math.cos(a), 377 + 65 * Math.sin(a)]); } // 東北角
  F.push([1755, 1640]);
  for (let k = 1; k <= 40; k++) { const a = ((90 * k) / 40) * (Math.PI / 180); F.push([1690 + 65 * Math.cos(a), 1640 + 65 * Math.sin(a)]); } // 東南角
  cr([[1730, 1705], [1690, 1705], [1645, 1705], [1612, 1702], [1593.4, 1688.8], [1572.7, 1667.1]]); // 接到內湖最東南那條路的盡頭（方向照那條路）
  const cum = [0]; for (let i = 1; i < F.length; i++) cum.push(cum[i - 1] + Math.hypot(F[i][0] - F[i - 1][0], F[i][1] - F[i - 1][1]));
  const L = cum[cum.length - 1], n = Math.floor(L / 2) + 1 + (L % 2 > 0.2 ? 1 : 0);
  const X = new Float32Array(n), Z = new Float32Array(n), S = new Float32Array(n), TX = new Float32Array(n), TZ = new Float32Array(n);
  let j = 1;
  for (let i = 0; i < n; i++) {
    const s = Math.min(L, i * 2); while (j < F.length - 1 && cum[j] < s) j++;
    const t = (s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1); X[i] = F[j - 1][0] + (F[j][0] - F[j - 1][0]) * t; Z[i] = F[j - 1][1] + (F[j][1] - F[j - 1][1]) * t; S[i] = s;
  }
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = X[b] - X[a], dz = Z[b] - Z[a], l = Math.hypot(dx, dz) || 1; TX[i] = dx / l; TZ[i] = dz / l; }
  return { X, Z, S, TX, TZ, n, L, sH: cum[nH] };
})();

// ---- 找附近的路段：16 公尺一格（每一段多 22 公尺的邊）----
const CELL = 16, MARG = HW + 14, gkey = (i, j) => i * 65536 + j;
const GRID = (() => {
  const { X, Z, n } = VD_PATH, m = new Map();
  for (let i = 0; i < n - 1; i++) {
    const x0 = Math.min(X[i], X[i + 1]) - MARG, x1 = Math.max(X[i], X[i + 1]) + MARG, z0 = Math.min(Z[i], Z[i + 1]) - MARG, z1 = Math.max(Z[i], Z[i + 1]) + MARG;
    for (let a = Math.floor(x0 / CELL); a <= Math.floor(x1 / CELL); a++) for (let b = Math.floor(z0 / CELL); b <= Math.floor(z1 / CELL); b++) { const k = gkey(a, b); let L = m.get(k); if (!L) m.set(k, (L = [])); L.push(i); }
  }
  const out = new Map(); for (const [k, L] of m) out.set(k, Int32Array.from(L));
  return out;
})();
const SQ = { t: 0, d2: 0 };
function segQ(i, x, z) { // 第 i 段（i → i+1）：投影 t（0–1）、距離平方
  const { X, Z } = VD_PATH, ax = X[i], az = Z[i], dx = X[i + 1] - ax, dz = Z[i + 1] - az, l2 = dx * dx + dz * dz || 1;
  let t = ((x - ax) * dx + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + dx * t - x, pz = az + dz * t - z; SQ.t = t; SQ.d2 = px * px + pz * pz;
}
function vdDist(x, z) { // 離中線最近幾公尺（22 公尺外＝Infinity）
  const L = GRID.get(gkey(Math.floor(x / CELL), Math.floor(z / CELL))); if (!L) return Infinity;
  let b = Infinity; for (let k = 0; k < L.length; k++) { segQ(L[k], x, z); if (SQ.d2 < b) b = SQ.d2; }
  return Math.sqrt(b);
}
const vdNear = (x, z, pad = 0) => vdDist(x, z) < HW + pad;
// 最後 END_S 公尺（從東南角往西下來那段）離中線多遠（範圍外 = Infinity）：neihu.js 把那裡的山（範圍南邊外面那圈）削平，橋才下得到巷子的高度
const END_S = 420, END_R = 80;
const END = (() => { const { X, Z, S, n, L } = VD_PATH; let i0 = 0; while (i0 < n - 1 && S[i0] < L - END_S) i0++; const bb = [Infinity, Infinity, -Infinity, -Infinity]; for (let i = i0; i < n; i++) { bb[0] = Math.min(bb[0], X[i] - END_R); bb[1] = Math.min(bb[1], Z[i] - END_R); bb[2] = Math.max(bb[2], X[i] + END_R); bb[3] = Math.max(bb[3], Z[i] + END_R); } return { i0, bb }; })();
function vdEndDist(x, z) {
  const b = END.bb; if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) return Infinity;
  let m = Infinity; for (let i = END.i0; i < VD_PATH.n - 1; i++) { segQ(i, x, z); if (SQ.d2 < m) m = SQ.d2; }
  return Math.sqrt(m);
}

// ---- 停車場的格子（東西向的排：每排兩邊車頭對著車頭；中間南北向的走道 7.2 公尺）----
const VD_LOT = (() => {
  const spots = [], CX = C0.x, CZ = C0.z, RS = 89, W = 2.6, D = 5, AIS = 3.6;
  for (let k = -4; k <= 4; k++) {
    const zc = CZ + 17 * k;
    for (const side of [-1, 1]) { // −1：北邊那半（車頭朝南）、1：南邊那半（車頭朝北）
      const z0 = side < 0 ? zc - D : zc, z1 = side < 0 ? zc : zc + D, dz = Math.max(Math.abs(z0 - CZ), Math.abs(z1 - CZ));
      if (dz >= RS) continue;
      const hw = Math.sqrt(RS * RS - dz * dz);
      for (const dir of [-1, 1]) for (let j = 0; ; j++) {
        const xa = CX + dir * (AIS + W * j), xb = xa + dir * W; if (Math.abs(xb - CX) > hw) break;
        spots.push([(xa + xb) / 2, (z0 + z1) / 2, side < 0 ? -Math.PI / 2 : Math.PI / 2, spots.length]);
      }
    }
  }
  return { x: CX, z: CZ, r: 96.5, rs: RS, w: W, d: D, ais: AIS, spots, conn: CONN };
})();
function vdInLot(x, z, pad = 0) {
  const dx = x - C0.x, dz = z - C0.z;
  if (dx * dx + dz * dz < (VD_LOT.r + pad) ** 2) return true;
  return Math.abs(x - CONN.x) < CONN.hw + pad && z > CONN.z0 - pad && z < CONN.z1 + pad;
}

// ---- 蓋：V＝buildVillage（buildHills 之後）----
function buildViaduct(V, opts = {}) {
  const T0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const { X, Z, S, TX, TZ, n, L, sH } = VD_PATH;
  const HL = V.hills, h0 = V.heightAt || (() => 0);
  const st = { py: 0, px: 1e9, pz: 1e9, on: false, high: false };
  // 1) 地面（中線、左右 ±HW 最高、最低）：隧道那段算山頂；捷運的橋算地面（上面至少 6.5 公尺）
  const groundAt = (x, z) => { let g = h0(x, z); if (HL && HL.tunAt && HL.tunAt(x, z) >= 0 && HL.topAt) g = Math.max(g, HL.topAt(x, z)); return g; };
  const MRTE = (V.neihu && V.neihu.data && V.neihu.data.elev) || [];
  const mrtTop = (x, z) => { let m = -1e9; for (const E of MRTE) { const P = E.P; for (let i = 1; i < P.length; i++) { const ax = P[i - 1][0], az = P[i - 1][1], dx = P[i][0] - ax, dz = P[i][1] - az, l2 = dx * dx + dz * dz || 1, t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), qx = ax + dx * t - x, qz = az + dz * t - z; if (qx * qx + qz * qz < (E.w / 2 + 3) ** 2) m = Math.max(m, E.y + 4.5); } } return m; };
  const Gc = new Float32Array(n), Gmax = new Float32Array(n), Gmin = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const nx = -TZ[i], nz = TX[i]; let mx = -1e9, mn = 1e9;
    for (const u of [-HW, -HW / 2, 0, HW / 2, HW]) { const g = groundAt(X[i] + nx * u, Z[i] + nz * u); if (g > mx) mx = g; if (g < mn) mn = g; if (u === 0) Gc[i] = g; }
    Gmax[i] = Math.max(mx, mrtTop(X[i], Z[i])); Gmin[i] = mn;
  }
  // 2) 高度：起點（停車場地面）→ 圓環爬到 24 → 平的（地面高的地方抬高）→ 最後 4% 下來到路的盡頭
  const g0 = Gc[0], gE = Gc[n - 1], sD = L - (PLAT - gE) / DESC;
  const Y = new Float32Array(n), lo = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = S[i];
    Y[i] = s <= S_OPEN ? g0 : s < sH ? g0 + ((PLAT - g0) * (s - S_OPEN)) / (sH - S_OPEN) : s < sD ? PLAT : PLAT + ((gE - PLAT) * (s - sD)) / (L - sD);
    lo[i] = s >= sH - 4 && s <= sD + 4 ? Gmax[i] + CLEAR : Gmax[i] + 0.05; // 平的那段：底下至少 6.5 公尺
    if (Y[i] < lo[i]) Y[i] = lo[i];
  }
  for (let i = 1; i < n; i++) Y[i] = Math.max(Y[i], Y[i - 1] - DESC * 2); // 抬高的地方前後最陡 4%（往前、往後各掃一次）
  for (let i = n - 2; i >= 0; i--) Y[i] = Math.max(Y[i], Y[i + 1] - DESC * 2);
  { const W2 = 10, A = Float32Array.from(Y); // 轉角磨圓（20 公尺的平均，兩次）；頭尾不動
    for (let pass = 0; pass < 2; pass++) { const B = Float32Array.from(pass ? Y : A); for (let i = 0; i < n; i++) { if (S[i] < S_OPEN + 20 || S[i] > L - 20) continue; let t = 0, c = 0; for (let k = -W2; k <= W2; k++) { const j = i + k; if (j < 0 || j >= n) continue; t += B[j]; c++; } Y[i] = Math.max(t / c, lo[i]); } } } // 磨圓也不能比最低的還低（橋下至少 6.5 公尺）
  for (let i = 1; i < n; i++) Y[i] = Math.max(Y[i], Y[i - 1] - DESC * 2); // 磨圓以後再掃一次：最陡 4%（上面那行拉回最低的地方會有一小段比較陡）
  for (let i = n - 2; i >= 0; i--) Y[i] = Math.max(Y[i], Y[i + 1] - DESC * 2);
  for (let i = 0; i < n; i++) if (S[i] <= S_OPEN) Y[i] = g0 + 0.04; // 起點平的（停車場那一層，高 4 公分）
  Y[n - 1] = Math.max(Y[n - 1], gE + 0.04);
  const clearAt = (i) => Y[i] - Gmax[i];

  // 3) 網格：橋面（柏油貼圖、role 'road'）、水泥（頂點色）；400 公尺一塊
  const group = new THREE.Group(); group.name = 'viaduct';
  const tex = deckTex(opts.renderer);
  const roadMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.93, metalness: 0 }); roadMat.userData.role = 'road'; roadMat.name = 'vd-road';
  const concMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }); concMat.name = 'vd-conc';
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.fillStyle = '#fff6dc'; g.fillRect(0, 0, 8, 8); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: glowTex, emissiveMap: glowTex, emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.4 }); glowMat.name = 'vd-lamp'; // look.js：晚上加亮（招牌那一套）
  const COL = { bar: [0.74, 0.73, 0.70], barTop: [0.80, 0.79, 0.76], side: [0.66, 0.65, 0.62], under: [0.42, 0.41, 0.40], pier: [0.62, 0.61, 0.58], cap: [0.68, 0.67, 0.64], wall: [0.6, 0.58, 0.54], pole: [0.55, 0.57, 0.6], lot: [0.16, 0.165, 0.17], line: [0.85, 0.85, 0.82], yel: [0.85, 0.66, 0.12], green: [0.08, 0.36, 0.2] };
  const nrmAt = (i) => [-TZ[i], TX[i]];
  const P3 = (i, u, y) => [X[i] - TZ[i] * u, y, Z[i] + TX[i] * u];
  const STEP = 2, CH = 200; // 網格每 4 公尺一段（點每 2 公尺）；一塊 200 點＝400 公尺
  const chunks = [];
  let tris = 0;
  const rb = qb(true), cb = qb(false);
  const flushChunk = () => {
    for (const [b, m, nm] of [[rb, roadMat, 'vd-road'], [cb, concMat, 'vd-conc']]) { if (!b.n) continue; const me = new THREE.Mesh(b.geo(), m); me.name = nm; me.matrixAutoUpdate = false; me.updateMatrix(); me.receiveShadow = true; me.castShadow = nm === 'vd-conc'; group.add(me); tris += b.nt; chunks.push(me); b.reset(); }
  };
  const elev = (i) => clearAt(i) >= WALL; // 下面是空的（不是引道的牆）
  for (let i0 = 0; i0 < n - 1; i0 += STEP) {
    const i1 = Math.min(n - 1, i0 + STEP);
    const v0 = S[i0] / 12, v1 = S[i1] / 12, ya = Y[i0], yb = Y[i1];
    // 路面
    rb.quad(P3(i0, -ROAD, ya), P3(i0, ROAD, ya), P3(i1, ROAD, yb), P3(i1, -ROAD, yb), null, [[0.0375, v0], [0.9625, v0], [0.9625, v1], [0.0375, v1]], [0, 1, 0]);
    // 護欄：內面（下面斜一點、上面陡）、頂、外面一直到橋面下面（引道：到地面）
    for (const sd of [-1, 1]) {
      if (sd < 0 && S[i0] < S_OPEN - 0.1 && i0 < n / 2) { continue; } // 起點內側（左邊）開口：停車場進來
      const nr = nrmAt(i0), hint = [-nr[0] * sd, 0, -nr[1] * sd], out = [nr[0] * sd, 0, nr[1] * sd];
      const pr = [[ROAD, 0], [7.5, 0.1], [7.72, 0.36], [7.78, 1.0]];
      for (let k = 0; k < 3; k++) cb.quad(P3(i0, sd * pr[k][0], ya + pr[k][1]), P3(i1, sd * pr[k][0], yb + pr[k][1]), P3(i1, sd * pr[k + 1][0], yb + pr[k + 1][1]), P3(i0, sd * pr[k + 1][0], ya + pr[k + 1][1]), k === 2 ? COL.barTop : COL.bar, null, [hint[0], 0.3, hint[2]]);
      cb.quad(P3(i0, sd * 7.78, ya + 1), P3(i1, sd * 7.78, yb + 1), P3(i1, sd * HW, yb + 1), P3(i0, sd * HW, ya + 1), COL.barTop, null, [0, 1, 0]);
      const ba = elev(i0) ? ya - 1.1 : Math.min(ya - 1.1, Gmin[i0] - 0.4), bb = elev(i0) ? yb - 1.1 : Math.min(yb - 1.1, Gmin[i1] - 0.4);
      cb.quad(P3(i0, sd * HW, ya + 1), P3(i1, sd * HW, yb + 1), P3(i1, sd * HW, bb), P3(i0, sd * HW, ba), elev(i0) ? COL.side : COL.wall, null, out);
    }
    if (S[i0] < S_OPEN - 0.1) cb.quad(P3(i0, -HW, ya - 0.02), P3(i1, -HW, yb - 0.02), P3(i1, -ROAD, yb - 0.02), P3(i0, -ROAD, ya - 0.02), COL.under, null, [0, 1, 0]); // 開口那邊護欄的位子：鋪平
    if (elev(i0)) cb.quad(P3(i0, -HW, ya - 1.1), P3(i1, -HW, yb - 1.1), P3(i1, HW, yb - 1.1), P3(i0, HW, ya - 1.1), COL.under, null, [0, -1, 0]); // 橋面底下
    if (i0 >= 2 && elev(i0) !== elev(i0 - STEP)) { const j = i0, yj = Y[j], g = Gmin[j] - 0.4, t = [TX[j], 0, TZ[j]], f = elev(j) ? t : [-t[0], 0, -t[2]]; cb.quad(P3(j, -HW, yj - 1.1), P3(j, HW, yj - 1.1), P3(j, HW, g), P3(j, -HW, g), COL.wall, null, f); } // 引道的牆到橋的地方：一面牆封起來
    if ((i0 + STEP) % CH < STEP || i1 >= n - 1) flushChunk();
  }
  // 護欄的頭尾（開口那邊、終點）
  { const cap = (i, sd, dir) => { const y = Y[i], t = [TX[i] * dir, 0, TZ[i] * dir]; cb.quad(P3(i, sd * ROAD, y), P3(i, sd * HW, y), P3(i, sd * HW, y + 1), P3(i, sd * 7.78, y + 1), COL.barTop, null, t); };
    const io = Math.round(S_OPEN / 2); cap(io, -1, -1); cap(n - 1, -1, 1); cap(n - 1, 1, 1); cap(0, 1, -1); }

  // 4) 橋墩（30 公尺一支，不放在路上、房子、隧道、停車場）＋圓環兩邊的柱子、橫樑；碰撞只給玩家（在橋上的時候關掉）
  const cols = [], piers = [];
  const offWhenOn = (c) => { Object.defineProperty(c, 'off', { get: () => st.on, set: () => {}, enumerable: false, configurable: true }); return c; };
  const VCG = new Map(); for (const c of V.colliders) { if (!c || !isFinite(c.x)) continue; const r = c.t === 'box' ? Math.hypot(c.hx, c.hz) : c.r || 0; for (let a = Math.floor((c.x - r) / 16); a <= Math.floor((c.x + r) / 16); a++) for (let b = Math.floor((c.z - r) / 16); b <= Math.floor((c.z + r) / 16); b++) { const k = gkey(a, b); let Lc = VCG.get(k); if (!Lc) VCG.set(k, (Lc = [])); Lc.push(c); } }
  const hitCol = (x, z, m) => { const Lc = VCG.get(gkey(Math.floor(x / 16), Math.floor(z / 16))); if (!Lc) return false; for (const c of Lc) { if (c.t === 'box') { const dx = x - c.x, dz = z - c.z, co = Math.cos(c.rot || 0), si = Math.sin(c.rot || 0), lu = dx * co - dz * si, lw = dx * si + dz * co; if (Math.abs(lu) < c.hx + m && Math.abs(lw) < c.hz + m) return true; } else if (Math.hypot(x - c.x, z - c.z) < (c.r || 0) + m) return true; } return false; };
  const onRoad = (x, z) => { const s = V.surfaceAt ? V.surfaceAt(x, z) : 1; if (s === 0 || s === 4) return true; if (V.npcOnRoad && V.npcOnRoad(x, z)) return true; return s === 3 && x < 100; };
  const badSpot = (x, z, r) => { for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { const qx = x + dx, qz = z + dz; if (onRoad(qx, qz) || hitCol(qx, qz, 0.6) || vdInLot(qx, qz, 1.5) || (HL && HL.tunAt && HL.tunAt(qx, qz) >= 0)) return true; } return false; };
  const below = (x, z, y, rad, skipI) => { const Lc = GRID.get(gkey(Math.floor(x / CELL), Math.floor(z / CELL))); if (!Lc) return false; for (let k = 0; k < Lc.length; k++) { const i = Lc[k]; if (Math.abs(i - skipI) < 25) continue; segQ(i, x, z); if (SQ.d2 < rad * rad && Y[i] < y - 2) return true; } return false; }; // 這裡下面還有別的橋面
  const box = (cx, cz, ry, hx, hz, y0, y1, col) => { // 立著的長方塊（本地 x 沿著 ry 的方向）
    const c = Math.cos(ry), s = Math.sin(ry), p = (lx, lz, y) => [cx + lx * c - lz * s, y, cz + lx * s + lz * c];
    const F = [[[-hx, -hz], [hx, -hz]], [[hx, -hz], [hx, hz]], [[hx, hz], [-hx, hz]], [[-hx, hz], [-hx, -hz]]];
    for (const [[ax, az], [bx, bz]] of F) { const mx = (ax + bx) / 2, mz = (az + bz) / 2; cb.quad(p(ax, az, y0), p(bx, bz, y0), p(bx, bz, y1), p(ax, az, y1), col, null, [mx * c - mz * s, 0, mx * s + mz * c]); }
    cb.quad(p(-hx, -hz, y1), p(hx, -hz, y1), p(hx, hz, y1), p(-hx, hz, y1), col, null, [0, 1, 0]);
    cb.quad(p(-hx, -hz, y0), p(hx, -hz, y0), p(hx, hz, y0), p(-hx, hz, y0), col, null, [0, -1, 0]);
  };
  const yawOf = (i) => Math.atan2(TZ[i], TX[i]); // 本地 x 沿著路（box 用的 ry：x' = x cos − z sin … 這裡用 [cos, sin] 當方向）
  let nPier = 0, nSkip = 0;
  for (let s0 = sH + 30; s0 < L - 10; s0 += 30) { // 平的那段、下來那段：中間一支
    let done = false;
    for (const ds of [0, 6, -6, 12, -12]) {
      const i = Math.round((s0 + ds) / 2); if (i < 1 || i >= n - 1) continue;
      if (clearAt(i) < WALL) { done = true; break; } // 引道（牆）
      const x = X[i], z = Z[i], g = Gmin[i] - 0.3, y = Y[i];
      if (below(x, z, y, HW + 2, i) || badSpot(x, z, 1.6)) continue;
      const ry = yawOf(i);
      box(x, z, ry, 1.0, 1.4, g, y - 2.2, COL.pier); box(x, z, ry, 1.1, 6.6, y - 2.2, y - 1.1, COL.cap); // 柱子、上面的帽子
      const c = offWhenOn({ t: 'box', x, z, hx: 1.0, hz: 1.4, rot: -ry, h: y - 1.1, y0: g, noCrush: true, vd: 'pier' }); cols.push(c); piers.push([x, z]); nPier++; done = true; break;
    }
    if (!done) nSkip++;
  }
  // 圓環：每 20 度兩支柱子（半徑 105 ± 9.4），到那個角度最上面那層；每一層下面一根橫樑；開口、連到快速道路的路、停車場不放
  let nCol = 0;
  const LC = TAU * R;
  for (let a = 0; a < 360; a += 20) {
    const th = (-90 - a) * (Math.PI / 180), cx = Math.cos(th), cz = Math.sin(th);
    const laps = []; for (let s = (a / 360) * LC; s <= sH + 0.01; s += LC) laps.push(s);
    const ys = laps.map((s) => Y[Math.min(n - 1, Math.round(s / 2))]); const top = Math.max(...ys);
    const ok = (rr) => { const x = C0.x + cx * rr, z = C0.z + cz * rr; return !(Math.abs(x - CONN.x) < CONN.hw + 2.5 && z > C0.z) && !(laps[0] < S_OPEN + 14 && rr < R) && !hitCol(x, z, 0.5) && !onRoad(x, z); };
    const g = Gmin[Math.min(n - 1, Math.round(laps[0] / 2))] - 0.3;
    if (top - g < WALL) continue;
    for (const rr of [R - 9.4, R + 9.4]) {
      if (!ok(rr)) continue;
      const x = C0.x + cx * rr, z = C0.z + cz * rr;
      box(x, z, th, 0.7, 0.7, g, top - 1.1, COL.pier);
      cols.push(offWhenOn({ t: 'circle', x, z, r: 0.75, h: top - 1.1, y0: g, noCrush: true, vd: 'col' })); nCol++;
    }
    for (let k = 0; k < laps.length; k++) if (ys[k] - g >= WALL) box(C0.x + cx * R, C0.z + cz * R, th, 10.1, 0.6, ys[k] - 1.9, ys[k] - 1.1, COL.cap); // 橫樑（本地 x＝往外）
  }

  // 5) 路燈：48 公尺一支，左右輪流；燈頭晚上亮（look.js V.lampsX）
  const lb = qb(false), lampsX = [], lampK = [], GLOW = qb(false);
  { let side = 1;
    for (let s = 20; s < L - 10; s += 48, side = -side) {
      const i = Math.round(s / 2), y = Y[i], base = P3(i, side * 7.9, y + 1), top = y + 9, arm = P3(i, side * 6.0, top), nr = nrmAt(i);
      boxAt(lb, base[0], base[2], 0.11, base[1], top, COL.pole);
      const tip = P3(i, side * 5.6, top - 0.05); lbar(lb, base[0], base[2], tip[0], tip[2], top - 0.25, top, 0.09, COL.pole);
      const head = P3(i, side * 5.2, top - 0.3); glowBox(head[0], head[2], top - 0.38, top - 0.18, nr);
      lampsX.push(head[0], top - 0.4, head[2]); lampK.push(1.4); void arm;
    }
  }
  if (lb.n) { const me = new THREE.Mesh(lb.geo(), concMat); me.name = 'vd-poles'; me.castShadow = true; group.add(me); tris += lb.nt; }
  function glowBox(x, z, y0, y1, nr) { GLOW.quad([x - 0.45, y0, z - 0.25], [x + 0.45, y0, z - 0.25], [x + 0.45, y0, z + 0.25], [x - 0.45, y0, z + 0.25], [1, 1, 1], null, [0, -1, 0]); GLOW.quad([x - 0.45, y1, z - 0.25], [x + 0.45, y1, z - 0.25], [x + 0.45, y1, z + 0.25], [x - 0.45, y1, z + 0.25], [0.5, 0.5, 0.5], null, [0, 1, 0]); void nr; }
  flushChunk();

  // 6) 停車場：柏油圓、白線、連到快速道路的路、走道的箭頭；燈（6 支）
  const lot = buildLot();
  group.add(lot.group); tris += lot.tris;
  for (let k = 0; k < lot.lamps.length; k += 3) { lampsX.push(lot.lamps[k], lot.lamps[k + 1], lot.lamps[k + 2]); lampK.push(1.3); }
  { const glow = new THREE.Mesh(GLOW.geo(), glowMat); glow.name = 'vd-lamp'; group.add(glow); tris += GLOW.nt; } // 燈頭（橋上＋停車場）

  // 7) 牌子：快速道路的口「超大停車場」、停車場往圓環「往內湖（高架）」、內湖那頭「往快速道路 超大停車場（高架）」
  const signs = buildSigns(); group.add(signs.mesh); tris += signs.tris;

  // 8) 碰撞：護欄（4 公尺一塊，兩邊；起點內側開口不放）——在同一層才擋；引道（離地不到 6 公尺）在地上的人也擋（牆）
  let nBar = 0;
  for (let i = 0; i < n - 1; i += 2) {
    const j = Math.min(n - 1, i + 2), x = (X[i] + X[j]) / 2, z = (Z[i] + Z[j]) / 2, y = Math.min(Y[i], Y[j]), yHi = Math.max(Y[i], Y[j]), len = Math.hypot(X[j] - X[i], Z[j] - Z[i]);
    if (len < 0.1) continue;
    const tx = (X[j] - X[i]) / len, tz = (Z[j] - Z[i]) / len, rot = Math.atan2(-tz, tx), wall = !elev(i) || !elev(j), lo = wall ? -1e9 : y - 2.5;
    for (const sd of [-1, 1]) {
      if (sd < 0 && S[i] < S_OPEN - 2 && i < n / 2) continue;
      const u = sd * (HW - 0.3), c = { t: 'box', x: x - tz * u, z: z + tx * u, hx: len / 2 + 0.25, hz: 0.3, rot, h: yHi + 1.0, noCrush: true, lowCam: true, vd: 'bar' }; // h、y0＝絕對高度（walk.js）；牆（引道）沒有 y0＝走路的人在地上也擋；lowCam：開車的鏡頭不被護欄擋（drive.js tall）
      if (!wall) c.y0 = y;
      Object.defineProperty(c, 'off', { get: () => !(st.py > lo && st.py < yHi + 3), set: () => {}, enumerable: false, configurable: true });
      cols.push(c); nBar++;
    }
  }
  // 9) 停車場的車：遠的 InstancedMesh、碰撞（只給玩家）
  const lotCars = lotFar();
  group.add(...lotCars.meshes);
  for (const c of lotCars.cols) cols.push(c);

  // 10) 被橋蓋到的地面碰撞（離橋面邊 6 公尺內、橋比地面高 3 公尺以上）：玩家在橋上的時候關掉（不然開在橋上撞到下面的房子、樹、隧道洞口的欄杆）
  const K0 = Symbol('vdOff'); let nGround = 0;
  const wrap = (c) => {
    if (!c || c[K0] !== undefined || c.vd) return;
    const d = Object.getOwnPropertyDescriptor(c, 'off'); if (d && (d.get || d.configurable === false)) return;
    Object.defineProperty(c, K0, { value: { v: c.off }, enumerable: false, writable: true });
    Object.defineProperty(c, 'off', { get() { return st.high || this[K0].v === true; }, set(v) { this[K0].v = v; }, enumerable: false, configurable: true });
    nGround++;
  };
  const coversCol = (c) => {
    const pts = [[c.x, c.z]];
    if (c.t === 'box') { const co = Math.cos(c.rot || 0), si = Math.sin(c.rot || 0); for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0]]) pts.push([c.x + a * c.hx * co + b * c.hz * si, c.z - a * c.hx * si + b * c.hz * co]); }
    for (const [x, z] of pts) { const d = vdDist(x, z); if (d < HW + 6) return true; }
    return false;
  };
  for (const c of [...V.colliders, ...(HL && HL.layerCols ? HL.layerCols : [])]) if (c && isFinite(c.x) && coversCol(c)) wrap(c);

  // 11) 高度（只給玩家）：at(x, z, py) 挑 py 附近（−3…+1.5）最近的那層；不配置記憶體
  const HW2 = HW * HW, Q = { y: 0, s: 0, u: 0, g: 0, tx: 1, tz: 0, i: -1, t: 0 };
  function at(x, z, py) {
    const Lc = GRID.get(gkey(Math.floor(x / CELL), Math.floor(z / CELL))); if (!Lc) return null;
    let best = 1e9, by = 0, bi = -1, bt = 0;
    for (let k = 0; k < Lc.length; k++) {
      const i = Lc[k]; segQ(i, x, z); if (SQ.d2 > HW2) continue;
      const y = Y[i] + (Y[i + 1] - Y[i]) * SQ.t; if (y < py - 3 || y > py + 1.5) continue;
      if (SQ.d2 < best) { best = SQ.d2; by = y; bi = i; bt = SQ.t; } // 那一層（高度窗）裡面最近的那段（挑高度最接近的話：上坡的時候會挑前面高一點的那段，地面一直往上跳，車子被彈飛）
    }
    if (bi < 0) return null;
    Q.y = by; Q.i = bi; Q.t = bt; Q.s = S[bi] + (S[bi + 1] - S[bi]) * bt; Q.g = (Y[bi + 1] - Y[bi]) / (S[bi + 1] - S[bi] || 1); Q.tx = TX[bi]; Q.tz = TZ[bi];
    Q.u = (x - X[bi]) * -TZ[bi] + (z - Z[bi]) * TX[bi];
    return by;
  }
  function normal(x, z, py, out) { if (at(x, z, py) == null) return null; const k = 1 / Math.sqrt(1 + Q.g * Q.g); out[0] = -Q.tx * Q.g * k; out[1] = k; out[2] = -Q.tz * Q.g * k; return out; }

  // 12) 地面種類：停車場、連到快速道路的路＝柏油（不限速、不長草）
  const s0 = V.surfaceAt; V.surfaceAt = (x, z) => (vdInLot(x, z) ? 0 : s0 ? s0(x, z) : 1);
  // 13) 小地圖：停車場（灰）、高架（淺藍灰的粗線）
  const prevDraw = V.mapDraw;
  V.mapDraw = (g) => {
    if (prevDraw) prevDraw(g);
    g.save();
    g.fillStyle = 'rgba(70,74,80,0.9)'; g.beginPath(); g.arc(C0.x, C0.z, VD_LOT.r, 0, TAU); g.fill(); g.fillRect(CONN.x - CONN.hw, CONN.z0, CONN.hw * 2, CONN.z1 - CONN.z0);
    g.strokeStyle = 'rgba(150,178,200,0.95)'; g.lineWidth = 2 * HW; g.lineJoin = 'round'; g.lineCap = 'butt'; g.beginPath(); for (let i = 0; i < n; i += 4) (i ? g.lineTo(X[i], Z[i]) : g.moveTo(X[i], Z[i])); g.lineTo(X[n - 1], Z[n - 1]); g.stroke();
    g.restore();
  };
  V.lampsX = (V.lampsX || []).concat(lampsX); V.lampsK = (V.lampsK || []).concat(lampK);
  V.group.add(group);

  const API = {
    group, st, at, normal, Q, cols, Y, G: Gc, lot: lotCars, path: VD_PATH, HW, sD,
    near: vdNear, inLot: vdInLot, clearAt: (i) => clearAt(i),
    info: null,
  };
  API.info = { len: +L.toFixed(1), helix: +sH.toFixed(1), sD: +sD.toFixed(1), pts: n, tris, chunks: chunks.length, piers: nPier, pierSkip: nSkip, cols: nCol, bars: nBar, ground: nGround, lamps: lampsX.length / 3, lotSpots: VD_LOT.spots.length, lotCars: lotCars.cars.length, yMax: +Math.max(...Y).toFixed(2),
    minClear: (() => { let m = 1e9, at2 = 0; for (let i = 0; i < n; i++) if (S[i] > sH && S[i] < sD) { const c = clearAt(i); if (c < m) { m = c; at2 = S[i]; } } return [+m.toFixed(2), +at2.toFixed(0)]; })(),
    ms: 0 };
  API.info.ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - T0);
  if (V.info) V.info.viaduct = API.info;
  V.viaduct = API;
  return API;

  // ---- 停車場的地面 ----
  function buildLot() {
    const b = qb(false), g = new THREE.Group(); g.name = 'vd-lot';
    const y = 0.025, NS = 96, lamps = [];
    for (let k = 0; k < NS; k++) { const a0 = (k / NS) * TAU, a1 = ((k + 1) / NS) * TAU; b.tri([C0.x, y, C0.z], [C0.x + Math.cos(a1) * VD_LOT.r, y, C0.z + Math.sin(a1) * VD_LOT.r], [C0.x + Math.cos(a0) * VD_LOT.r, y, C0.z + Math.sin(a0) * VD_LOT.r], COL.lot, [0, 1, 0]); }
    b.quad([CONN.x - CONN.hw, y, CONN.z0], [CONN.x + CONN.hw, y, CONN.z0], [CONN.x + CONN.hw, y, CONN.z1], [CONN.x - CONN.hw, y, CONN.z1], COL.lot, null, [0, 1, 0]);
    const ly = y + 0.012, ln = (x0, z0, x1, z1, w, col) => { const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, ox = (-dz / l) * w / 2, oz = (dx / l) * w / 2; b.quad([x0 - ox, ly, z0 - oz], [x0 + ox, ly, z0 + oz], [x1 + ox, ly, z1 + oz], [x1 - ox, ly, z1 - oz], col, null, [0, 1, 0]); };
    for (const p of VD_LOT.spots) { const hz = VD_LOT.d / 2, w = VD_LOT.w; for (const sx of [-1, 1]) ln(p[0] + sx * w / 2, p[1] - hz, p[0] + sx * w / 2, p[1] + hz, 0.12, COL.line); }
    for (let k = -4; k <= 4; k++) { const zc = C0.z + 17 * k, dz = Math.abs(zc - C0.z); if (dz < VD_LOT.rs) { const hw = Math.sqrt(VD_LOT.rs ** 2 - dz * dz); ln(C0.x - hw, zc, C0.x - VD_LOT.ais, zc, 0.12, COL.line); ln(C0.x + VD_LOT.ais, zc, C0.x + hw, zc, 0.12, COL.line); } }
    for (let z = C0.z - 80; z < CONN.z1 - 6; z += 6) if (!(z > C0.z - 2 && z < C0.z + 2)) ln(C0.x, z, C0.x, z + 3, 0.15, COL.yel); // 中間走道的中線（黃虛線）
    for (const [x, z] of [[C0.x - 45, C0.z - 70], [C0.x + 45, C0.z - 70], [C0.x - 80, C0.z], [C0.x + 80, C0.z], [C0.x - 45, C0.z + 70], [C0.x + 45, C0.z + 70]]) { // 停車場的燈（高 9 公尺）
      boxAt(b, x, z, 0.14, y, 9, COL.pole); glowBox(x, z, 8.6, 8.85); lamps.push(x, 8.5, z);
    }
    const lm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); lm.name = 'vd-lot';
    const me = new THREE.Mesh(b.geo(), lm); me.name = 'vd-lot'; me.receiveShadow = true; g.add(me);
    return { group: g, tris: b.nt, lamps };
  }
  // ---- 牌子（綠底白字，一張貼圖三面）----
  function buildSigns() {
    const W = 1024, H = 384, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
    const panel = (y0, lines, arrow) => {
      x.fillStyle = '#0f6a3c'; x.fillRect(0, y0, W, 128); x.strokeStyle = '#f2f2f2'; x.lineWidth = 6; x.strokeRect(8, y0 + 8, W - 16, 112);
      x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `700 ${lines.length > 1 ? 44 : 62}px ${SANS}`; lines.forEach((t, k) => x.fillText(t, W / 2 - (arrow ? 60 : 0), y0 + 64 + (k - (lines.length - 1) / 2) * 50));
      if (arrow) { x.save(); x.translate(W - 110, y0 + 64); x.rotate(arrow); x.beginPath(); x.moveTo(0, -42); x.lineTo(30, -8); x.lineTo(11, -8); x.lineTo(11, 40); x.lineTo(-11, 40); x.lineTo(-11, -8); x.lineTo(-30, -8); x.closePath(); x.fill(); x.restore(); }
    };
    panel(0, ['超大停車場'], 0.0001); panel(128, ['往內湖（高架）'], -Math.PI / 2); panel(256, ['往快速道路', '超大停車場（高架）'], 0.0001);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.6 }); m.name = 'vd-sign';
    const b = qb(true), post = qb(false);
    const sign = (cx, cz, face, row, wd, hgt, y0) => { // face：牌子朝哪個方向（往那邊看得到字）
      const rx = -face[1], rz = face[0], v0 = 1 - (row + 1) / 3, v1 = 1 - row / 3, p = (u, y) => [cx + rx * u + face[0] * 0.02, y, cz + rz * u + face[1] * 0.02];
      b.quad(p(-wd / 2, y0), p(wd / 2, y0), p(wd / 2, y0 + hgt), p(-wd / 2, y0 + hgt), null, [[0, v0], [1, v0], [1, v1], [0, v1]], [face[0], 0, face[1]]);
      const bk = (u, y) => [cx + rx * u - face[0] * 0.04, y, cz + rz * u - face[1] * 0.04];
      post.quad(bk(wd / 2, y0), bk(-wd / 2, y0), bk(-wd / 2, y0 + hgt), bk(wd / 2, y0 + hgt), COL.pole, null, [-face[0], 0, -face[1]]);
      for (const u of [-wd / 2 + 0.3, wd / 2 - 0.3]) boxAt(post, cx + rx * u - face[0] * 0.15, cz + rz * u - face[1] * 0.15, 0.09, (V.heightAt ? V.heightAt(cx, cz) : 0), y0 + hgt * 0.9, COL.pole);
    };
    sign(CONN.x + CONN.hw + 2.2, CONN.z1 - 14, [0, 1], 0, 4.4, 1.65, 2.2); // 快速道路的口（從快速道路轉進來看得到）
    sign(C0.x + 9, C0.z - 72, [0, 1], 1, 4.4, 1.65, 2.2); // 停車場北邊（往圓環的起點）
    { const i = n - 12, f = [-TX[i], -TZ[i]], g2 = Y[i]; sign(X[i] - TZ[i] * 10.5, Z[i] + TX[i] * 10.5, f, 2, 5, 1.9, g2 + 2.6); } // 內湖那頭（從那條路開過來看得到）
    const me = new THREE.Mesh(b.geo(), m); me.name = 'vd-sign';
    const pm = new THREE.Mesh(post.geo(), concMat); pm.name = 'vd-sign-post'; me.add(pm);
    return { mesh: me, tris: b.nt + post.nt };
  }
  // ---- 停車場的車（遠的）：一台＝車身（照顏色）＋玻璃、輪子（黑）兩個 InstancedMesh；照那台車的長寬高放大 ----
  function lotFar() {
    const cars = [], colsL = [];
    for (const p of VD_LOT.spots) { const o = opts.lotCar ? opts.lotCar(p[3]) : null; if (!o) continue; const d = (opts.dims && opts.dims(o.k)) || [4.5, 1.9, 1.4]; cars.push({ j: p[3], x: p[0], z: p[1], h: p[2], k: o.k, paint: o.paint, d }); }
    const N = cars.length, gB = farCarGeo(false), gD = farCarGeo(true);
    const mB = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.25 }); mB.name = 'vd-lotcar';
    const mD = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.3, metalness: 0.1 }); mD.name = 'vd-lotcar-dark';
    const IB = new THREE.InstancedMesh(gB, mB, Math.max(1, N)), ID = new THREE.InstancedMesh(gD, mD, Math.max(1, N));
    IB.name = 'vd-lotcars'; ID.name = 'vd-lotcars-dark'; IB.count = ID.count = N;
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    const mats = [];
    cars.forEach((c, k) => {
      const gy = 0.03; q.setFromAxisAngle(up, c.h); pos.set(c.x, gy, c.z); sc.set(c.d[0], c.d[2], c.d[1] * 0.92); M4.compose(pos, q, sc); mats.push(M4.clone());
      IB.setMatrixAt(k, M4); ID.setMatrixAt(k, M4); col.set(c.paint); IB.setColorAt(k, col);
      colsL.push({ t: 'box', x: c.x, z: c.z, hx: c.d[0] / 2, hz: (c.d[1] * 0.92) / 2, rot: c.h, h: c.d[2], noCrush: true, vd: 'lotcar' });
      c.inst = k;
    });
    IB.instanceMatrix.needsUpdate = ID.instanceMatrix.needsUpdate = true; if (IB.instanceColor) IB.instanceColor.needsUpdate = true;
    IB.computeBoundingSphere(); ID.computeBoundingSphere();
    IB.castShadow = ID.castShadow = false; IB.receiveShadow = true;
    const set = (k, on) => { const m = on ? mats[k] : ZERO; IB.setMatrixAt(k, m); ID.setMatrixAt(k, m); IB.instanceMatrix.needsUpdate = ID.instanceMatrix.needsUpdate = true; };
    return { cars, cols: colsL, meshes: [IB, ID], hide: (k) => set(k, false), show: (k) => set(k, true), tris: (gB.index.count + gD.index.count) / 3 };
  }
}

// ---- 一台車的簡單樣子（長寬高都是 1：x −0.5…0.5 往前、y 0…1、z −0.5…0.5）----
function farCarGeo(dark) {
  const b = qb(false), c = [1, 1, 1];
  const bx = (x0, x1, y0, y1, z0, z1, xt0 = x0, xt1 = x1, zt = z1) => { // 下面 x0…x1、上面 xt0…xt1（前後斜）、上面寬 ±zt
    const p = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [xt0, y1, -zt], [xt1, y1, -zt], [xt1, y1, zt], [xt0, y1, zt]];
    const f = (a, bb, cc, d, h) => b.quad(p[a], p[bb], p[cc], p[d], c, null, h);
    f(4, 5, 6, 7, [0, 1, 0]); f(0, 1, 5, 4, [0, 0, -1]); f(3, 7, 6, 2, [0, 0, 1]); f(1, 2, 6, 5, [1, 0.3, 0]); f(0, 4, 7, 3, [-1, 0.3, 0]); f(0, 3, 2, 1, [0, -1, 0]);
  };
  if (!dark) {
    bx(-0.5, 0.5, 0.17, 0.5, -0.47, 0.47, -0.49, 0.44, 0.46); // 車身
    bx(-0.19, 0.12, 0.86, 0.9, -0.36, 0.36, -0.18, 0.11, 0.35); // 車頂
  } else {
    bx(-0.33, 0.27, 0.5, 0.86, -0.43, 0.43, -0.2, 0.12, 0.36); // 玻璃那一段
    for (const [x, z] of [[0.31, -0.45], [0.31, 0.45], [-0.31, -0.45], [-0.31, 0.45]]) bx(x - 0.12, x + 0.12, 0, 0.3, z - 0.05, z + 0.05, x - 0.12, x + 0.12, z + 0.05); // 輪子
  }
  return b.geo();
}

// ---- 小工具：四邊形一個一個加（法線照 hint 那一邊）----
function qb(uv) {
  let P = [], N = [], Cc = [], U = [], I = [];
  const o = {
    n: 0, nt: 0, // nt：幾個三角形（tri 是畫一個三角形）
    quad(a, b, c, d, col, uvs, hint) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return;
      nx /= l; ny /= l; nz /= l;
      let q = [a, b, c, d], qu = uvs;
      if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { q = [a, d, c, b]; qu = uvs && [uvs[0], uvs[3], uvs[2], uvs[1]]; nx = -nx; ny = -ny; nz = -nz; }
      const k = o.n;
      for (let m = 0; m < 4; m++) { P.push(q[m][0], q[m][1], q[m][2]); N.push(nx, ny, nz); if (uv) U.push(qu ? qu[m][0] : 0, qu ? qu[m][1] : 0); else Cc.push(col[0], col[1], col[2]); }
      I.push(k, k + 1, k + 2, k, k + 2, k + 3); o.n += 4; o.nt += 2;
    },
    tri(a, b, c, col, hint) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return; nx /= l; ny /= l; nz /= l;
      let q = [a, b, c]; if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { q = [a, c, b]; nx = -nx; ny = -ny; nz = -nz; }
      const k = o.n; for (let m = 0; m < 3; m++) { P.push(q[m][0], q[m][1], q[m][2]); N.push(nx, ny, nz); if (uv) U.push(0, 0); else Cc.push(col[0], col[1], col[2]); }
      I.push(k, k + 1, k + 2); o.n += 3; o.nt += 1;
    },
    geo() {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); else g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
      g.setIndex(o.n > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1)); g.computeBoundingSphere(); g.computeBoundingBox(); return g;
    },
    reset() { P = []; N = []; Cc = []; U = []; I = []; o.n = 0; o.nt = 0; },
  };
  return o;
}
function boxAt(b, x, z, r, y0, y1, col) { // 細的方柱
  const p = (a, c, y) => [x + a, y, z + c];
  b.quad(p(-r, -r, y0), p(r, -r, y0), p(r, -r, y1), p(-r, -r, y1), col, null, [0, 0, -1]); b.quad(p(r, -r, y0), p(r, r, y0), p(r, r, y1), p(r, -r, y1), col, null, [1, 0, 0]);
  b.quad(p(r, r, y0), p(-r, r, y0), p(-r, r, y1), p(r, r, y1), col, null, [0, 0, 1]); b.quad(p(-r, r, y0), p(-r, -r, y0), p(-r, -r, y1), p(-r, r, y1), col, null, [-1, 0, 0]);
  b.quad(p(-r, -r, y1), p(r, -r, y1), p(r, r, y1), p(-r, r, y1), col, null, [0, 1, 0]);
}
function lbar(b, x0, z0, x1, z1, y0, y1, w, col) { // 橫的細條（燈的手臂）
  const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, ox = (-dz / l) * w, oz = (dx / l) * w;
  b.quad([x0 - ox, y1, z0 - oz], [x1 - ox, y1, z1 - oz], [x1 + ox, y1, z1 + oz], [x0 + ox, y1, z0 + oz], col, null, [0, 1, 0]);
  b.quad([x0 - ox, y0, z0 - oz], [x1 - ox, y0, z1 - oz], [x1 - ox, y1, z1 - oz], [x0 - ox, y1, z0 - oz], col, null, [-ox, 0, -oz]);
  b.quad([x0 + ox, y0, z0 + oz], [x1 + ox, y0, z1 + oz], [x1 + ox, y1, z1 + oz], [x0 + ox, y1, z0 + oz], col, null, [ox, 0, oz]);
  b.quad([x0 - ox, y0, z0 - oz], [x1 - ox, y0, z1 - oz], [x1 + ox, y0, z1 + oz], [x0 + ox, y0, z0 + oz], col, null, [0, -1, 0]);
}
// ---- 橋面的柏油：中間雙黃線、兩邊白虛線（6 公尺線、6 公尺空）、路邊白線；u 0–1＝−8…8 公尺、v 一圈＝12 公尺 ----
function deckTex(renderer) {
  const W = 256, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#45474a'; g.fillRect(0, 0, W, H);
  let s = 91; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < 2600; k++) { const v = 52 + rnd() * 34; g.fillStyle = `rgba(${v},${v},${v + 2},${0.25 + rnd() * 0.35})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
  const px = (m) => ((m + 8) / 16) * W, lw = (m) => (m / 16) * W;
  g.fillStyle = '#e2b437'; for (const o of [-0.2, 0.2]) g.fillRect(px(o) - lw(0.06), 0, lw(0.12), H); // 雙黃線
  g.fillStyle = '#ecece6'; for (const o of [-3.6, 3.6]) g.fillRect(px(o) - lw(0.075), 0, lw(0.15), H / 2); // 白虛線（6 公尺）
  for (const o of [-7.05, 7.05]) g.fillRect(px(o) - lw(0.075), 0, lw(0.15), H); // 路邊白線
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer && renderer.capabilities ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  return t;
}

return { VD_PATH, VD_LOT, VD_GAP, VD_TEXT, vdNear, vdInLot, vdEndDist, buildViaduct };
})();
