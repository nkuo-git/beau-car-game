// vdrest.js — 第 92 批（Nick 2026-11-15「在高速公路中段做一個休息站 請上網查南休的停車場樣式並照做 要有便利商店廁所 廁所樣式上網查 要有出口入口
//   要有人車 車一樣從車店挑 有車進來有車離開 有那三隻動物跟人」）
// 高架橋北邊那一段（z 312）北邊、山上削平的平台（viaduct.js VD_REST，y 24）＝「大便龍服務區」。照南投服務區（南休）的樣子做（網路上的照片、說明只拿來看，
//   筆記 /mnt/project-files/car-game/viaduct/nantou-service-area-research.md）：兩個方向共用；大車的斜停車格在一頭；主建築兩層、玻璃大廳、
//   前面一排鋸齒的「山」雨遮、門口上面大大的貓頭鷹臉；兩棟一層樓的廁所在主建築兩邊（外牆有原住民風的圖案、男女的門在兩頭、中間親子／無障礙）；
//   加油站在出口那邊；廣場（圓水池、紫色蝴蝶雕塑）；小車的停車場一排一排對著主建築、每 10 格一個種樹的島、靠近大廳的是婦幼、無障礙格；山上大大的彩色字。
//   沒有真的店名、logo：便利商店是「大便龍超商」（interiors.js 的超商，走得進去、可以買東西：V.buildings 多一棟 kind 'store'）。
// 進出（viaduct.js VD_RAMPS 的 WX／WE／EX／EE）：往西的從 WX 下來接南邊那條路（往西）→ WE 上去；往東的從 EX（跨過主線）下來接北邊那條路（往東）→ EE（再跨過主線）上去。
//   兩條路中間：西邊、東邊兩條連接的路（雙向）、停車場兩條走道。
// 用法：const RL = restLayout(VD_REST)（viaduct.js：橋墩不放在休息站的路上、停車格給 lotFar）；buildRestArea(RL, ctx) → { group, tris, cols, lamps, store, walk }
//   ctx：{ V, qb, boxAt, lbar, renderer }
import * as THREE from 'three';

export const { restLayout, buildRestArea, REST_TEXT } = (() => {
const REST_TEXT = '大便龍服務區超商24H伴手禮麵包茶美食街咖啡男女親子無障礙加油站洗手間無鉛超級柴油客運物流大型車限速婦幼專用出口入口往東西';

function restLayout(R) {
  const y = R.y, G = y + 0.025;
  // 路（長方形）：北邊那條（往東，兩線）、南邊那條（往西，兩線）、兩條連接的路（雙向）、停車場的兩條走道、大車區、加油站
  const roads = [
    { id: 'N', x0: 830, z0: 182.5, x1: 1196, z1: 189.5, dir: 1 },
    { id: 'S', x0: 800, z0: 283.5, x1: 1214, z1: 290.5, dir: -1 },
    { id: 'CW', x0: 838, z0: 189.5, x1: 846, z1: 283.5 },
    { id: 'CE', x0: 1176, z0: 189.5, x1: 1184, z1: 283.5 },
    { id: 'A1', x0: 846, z0: 243, x1: 1176, z1: 250 },
    { id: 'A2', x0: 846, z0: 260, x1: 1176, z1: 267 },
    { id: 'BIG', x0: 852, z0: 189.5, x1: 918, z1: 228 },
    { id: 'GAS', x0: 1104, z0: 189.5, x1: 1174, z1: 224 },
  ];
  const lot = { x0: 846, z0: 236.5, x1: 1176, z1: 272 }; // 小車停車場的柏油
  // 停車格（2.5 × 5）：4 排；A 對著廣場（車頭朝北）、B／C 背對背、D 對著走道 2；每 10 格一個種樹的島（3 公尺）
  const rows = [[240.5, Math.PI / 2], [252.5, -Math.PI / 2], [257.5, Math.PI / 2], [269.5, -Math.PI / 2]];
  const bays = [], islands = []; let n = 0;
  for (let r = 0; r < 4; r++) {
    const [zc, h] = rows[r];
    for (let x = 852, k = 0; x + 2.5 <= 1173; ) {
      if (k === 10) { islands.push([x + 1.5, zc, r]); x += 3; k = 0; continue; }
      const cx = x + 1.25, kind = r === 0 && cx > 978 && cx < 1003 ? 'mom' : r === 0 && cx > 1017 && cx < 1045 ? 'acc' : '';
      bays.push({ x: cx, z: zc, h, n: n++, row: r, kind }); x += 2.5; k++;
    }
  }
  // 房子：主建築（便利商店在西邊那一段、可以走進去）、兩棟廁所、加油站（雨棚、加油機、小屋）
  const hall = { x0: 966, x1: 1054, z0: 196, z1: 224, h: 10.6 };
  const store = { x: 989, z: 217.5, hx: 9, hz: 6.5 }; // interiors.js 的超商（18 × 13）：門在前面（南邊）中間
  const wcs = [{ x0: 925, x1: 957, z0: 199, z1: 219, h: 4.4 }, { x0: 1063, x1: 1095, z0: 199, z1: 219, h: 4.4 }];
  const gas = { cx0: 1116, cx1: 1164, cz0: 198, cz1: 216, kiosk: [1150, 1166, 216.5, 222.5] };
  const plaza = { x0: 920, x1: 1102, z0: 219, z1: 236.5 };
  const pond = { x: 944, z: 230, r: 4 }, fly = { x: 1084, z: 230 };
  // 走路的地方（人、動物）：廣場、廁所前面、停車場的走道邊（crowd 用）
  const walk = [[922, 224.5, 1100, 236], [922, 219.5, 1100, 224], [1000, 236.5, 1030, 272]];
  const inR = (q, x, z, p = 0) => x > q.x0 - p && x < q.x1 + p && z > q.z0 - p && z < q.z1 + p;
  const roadAt = (x, z) => {
    for (const q of roads) if (inR(q, x, z)) return true;
    if (inR(lot, x, z) || inR(plaza, x, z) || inR(hall, x, z)) return true;
    for (const w of wcs) if (inR(w, x, z)) return true;
    return false;
  };
  // 車（交通）走的線（viaduct 的車 vdtraffic）：每條路的車道中心
  const lanes = { N: [184.25, 187.75], S: [285.25, 288.75], CW: 842, CE: 1180, A1: 246.5, A2: 263.5 };
  return { R, y, G, roads, lot, rows, bays, islands, hall, store, wcs, gas, plaza, pond, fly, walk, roadAt, inR, lanes };
}

function buildRestArea(L, ctx) {
  const { V, qb, boxAt, renderer } = ctx, y = L.y, G = L.G, TAU = Math.PI * 2;
  const group = new THREE.Group(); group.name = 'vd-rest';
  const cb = qb(false), tb = qb(true), ab = qb(true), lineB = qb(false), glow = qb(false);
  const cols = [], lamps = [], trees = [];
  let tris = 0;
  const C = {
    asph: [0.17, 0.175, 0.18], asph2: [0.2, 0.2, 0.205], line: [0.86, 0.86, 0.83], yel: [0.86, 0.67, 0.13], curb: [0.62, 0.61, 0.58], grass: [0.2, 0.36, 0.14],
    pav1: [0.66, 0.6, 0.53], pav2: [0.58, 0.53, 0.47], wall: [0.86, 0.83, 0.76], wall2: [0.74, 0.7, 0.62], roof: [0.36, 0.35, 0.34], wood: [0.55, 0.34, 0.18], wood2: [0.66, 0.42, 0.22],
    glass: [0.42, 0.55, 0.62], pole: [0.55, 0.57, 0.6], red: [0.74, 0.12, 0.1], white: [0.93, 0.93, 0.9], water: [0.12, 0.3, 0.4], rim: [0.7, 0.68, 0.64], purple: [0.5, 0.22, 0.66],
    trunk: [0.36, 0.25, 0.15], leaf: [[0.16, 0.38, 0.13], [0.2, 0.44, 0.16], [0.13, 0.33, 0.12]], pink: [0.86, 0.5, 0.62], blue: [0.18, 0.4, 0.78], dark: [0.12, 0.12, 0.13],
  };
  const flat = (b, x0, z0, x1, z1, yy, col) => b.quad([x0, yy, z0], [x1, yy, z0], [x1, yy, z1], [x0, yy, z1], col, null, [0, 1, 0]);
  const box = (b, x0, x1, y0, y1, z0, z1, col, top = true) => {
    b.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], col, null, [0, 0, -1]);
    b.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, null, [0, 0, 1]);
    b.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col, null, [-1, 0, 0]);
    b.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], col, null, [1, 0, 0]);
    if (top) b.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], col, null, [0, 1, 0]);
  };
  const ln = (x0, z0, x1, z1, w, col, yy = G + 0.012) => { const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, ox = (-dz / l) * w / 2, oz = (dx / l) * w / 2; lineB.quad([x0 - ox, yy, z0 - oz], [x0 + ox, yy, z0 + oz], [x1 + ox, yy, z1 + oz], [x1 - ox, yy, z1 - oz], col, null, [0, 1, 0]); };
  const colBox = (x0, x1, z0, z1, h, extra) => cols.push({ t: 'box', x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, rot: 0, y0: y, h: y + h, noCrush: true, vd: 'rest', ...extra });
  const colCirc = (x, z, r, h) => cols.push({ t: 'circle', x, z, r, y0: y, h: y + h, noCrush: true, vd: 'rest' });

  // ---- 貼圖（一張 2048 × 1024：店面、玻璃、壁畫、廁所的門、招牌、遊覽車）＋透明的一張（山上的字、貓頭鷹、蝴蝶）----
  const AT = atlas(), AL = alphaAtlas();
  const reg = (name, f0 = 0, f1 = 1, g0 = 0, g1 = 1, A = AT) => { const [rx, ry, rw, rh] = A.R[name], W = A.W, H = A.H; const u0 = (rx + f0 * rw) / W, u1 = (rx + f1 * rw) / W, vb = 1 - (ry + rh - g0 * rh) / H, vt = 1 - (ry + rh - g1 * rh) / H; return [[u0, vb], [u1, vb], [u1, vt], [u0, vt]]; };
  // 牆上的一片貼圖：a＝從外面看的左下角、b＝右下角（x、z），y0…y1；nrm＝朝外
  const face = (b, name, ax, az, bx, bz, y0, y1, nrm, f0 = 0, f1 = 1, g0 = 0, g1 = 1, A = AT) => b.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], null, reg(name, f0, f1, g0, g1, A), nrm);

  // ---- 1) 地面：路、停車場（柏油）、廣場（磚）、種樹的島（草＋路緣）----
  for (const q of L.roads) flat(cb, q.x0, q.z0, q.x1, q.z1, G, q.id === 'BIG' || q.id === 'GAS' ? C.asph2 : C.asph);
  flat(cb, L.lot.x0, L.lot.z0, L.lot.x1, L.lot.z1, G, C.asph);
  { const P = L.plaza; for (let x = P.x0; x < P.x1 - 0.01; x += 2) for (let z = P.z0; z < P.z1 - 0.01; z += 2) if (!L.inR(L.hall, x + 1, z + 1)) flat(cb, x, z, Math.min(x + 2, P.x1), Math.min(z + 2, P.z1), G + 0.006, ((x - P.x0) / 2 + (z - P.z0) / 2) % 2 < 1 ? C.pav1 : C.pav2); }
  flat(cb, 920, 189.5, 1102, 196, G + 0.006, C.pav2); // 北邊那條路和房子中間的人行道
  for (const [x, z, r] of L.islands) {
    const z0 = r === 1 ? 250 : r === 2 ? 255 : r === 0 ? 238 : 267, z1 = r === 1 ? 255 : r === 2 ? 260 : r === 0 ? 243 : 272;
    box(cb, x - 1.4, x + 1.4, G, G + 0.15, z0, z1, C.curb, false); flat(cb, x - 1.3, z0 + 0.1, x + 1.3, z1 - 0.1, G + 0.16, C.grass);
    if (r !== 2) trees.push([x, r === 1 ? 255 : (z0 + z1) / 2, 0.9 + ((x * 7.3) % 1) * 0.3]);
    if (r === 0 || r === 3) { const lz = (z0 + z1) / 2 + (r === 0 ? 1.6 : -1.6); if (Math.round((x - 852) / 28) % 2 === 0) lampPole(x, lz, 10); }
  }
  // ---- 2) 線：兩條路（白邊線、中間白虛線、箭頭、40）、連接的路（黃虛線）、停車格、婦幼／無障礙格、大車斜格、斑馬線 ----
  { const edge = (x0, x1, z, gaps) => { let x = x0; for (const [a, b] of gaps) { if (a > x) ln(x, z, a, z, 0.15, C.line); x = Math.max(x, b); } if (x < x1) ln(x, z, x1, z, 0.15, C.line); };
    const N = L.roads[0], S = L.roads[1];
    edge(N.x0 + 1, N.x1 - 1, N.z0 + 0.3, []); edge(N.x0 + 1, N.x1 - 1, N.z1 - 0.3, [[837.5, 846.5], [851.5, 918.5], [1103.5, 1184.5]]);
    edge(S.x0 + 1, S.x1 - 1, S.z0 + 0.3, [[837.5, 846.5], [1175.5, 1184.5]]); edge(S.x0 + 1, S.x1 - 1, S.z1 - 0.3, []);
    for (const q of [N, S]) { const zc = (q.z0 + q.z1) / 2; for (let x = q.x0 + 4; x < q.x1 - 4; x += 8) ln(x, zc, x + 4, zc, 0.15, C.line); for (const x of q.dir > 0 ? [880, 1060] : [1150, 930]) for (const z of [zc - 1.75, zc + 1.75]) arrow(x, z, q.dir, 0); num40(q.dir > 0 ? 856 : 1196, zc, q.dir); }
  }
  for (const id of ['CW', 'CE']) { const q = L.roads.find((r) => r.id === id), xc = (q.x0 + q.x1) / 2; for (let z = q.z0 + 3; z < q.z1 - 3; z += 6) ln(xc, z, xc, z + 3, 0.14, C.yel); }
  for (const id of ['A1', 'A2']) { const q = L.roads.find((r) => r.id === id), zc = (q.z0 + q.z1) / 2; for (let x = q.x0 + 4; x < q.x1 - 4; x += 6) ln(x, zc, x + 3, zc, 0.12, C.yel); }
  for (const b of L.bays) {
    const z0 = b.z - 2.5, z1 = b.z + 2.5;
    for (const sx of [-1.25, 1.25]) ln(b.x + sx, z0 + 0.15, b.x + sx, z1 - 0.15, 0.12, C.line);
    if (b.kind) { flat(lineB, b.x - 1.15, z0 + 0.3, b.x + 1.15, z1 - 0.3, G + 0.01, b.kind === 'mom' ? C.pink : C.blue); }
  }
  for (let k = 0; k < 6; k++) { const x0 = 862 + k * 9; ln(x0, 226, x0 + 7, 196, 0.2, C.line); } // 大車：斜的格子（從北邊那條路開進去、往南開出來）
  for (const zc of [246.5, 263.5]) for (let k = 0; k < 8; k++) { const x = 1011.2 + k * 1.0; ln(x, zc - 3.2, x, zc + 3.2, 0.5, C.white); } // 斑馬線（廣場 → 停車場）

  // ---- 3) 主建築：兩層（便利商店、大廳、伴手禮、麵包；2 樓美食街）、鋸齒雨遮、貓頭鷹臉、屋頂的大招牌 ----
  { const H = L.hall, S = L.store, yT = y + H.h, zF = H.z1;
    box(cb, H.x0 + 0.02, H.x1 - 0.02, y, yT, H.z0 + 0.02, H.z1 - 0.02, C.wall2); // 外殼（前面貼店面、玻璃）
    box(cb, H.x0 - 0.6, H.x1 + 0.6, yT, yT + 0.35, H.z0 - 0.6, H.z1 + 0.6, C.roof); // 屋頂（出簷）
    box(cb, 990, 1038, yT + 0.35, yT + 0.6, 205, 215, C.glass); // 天窗
    const sx0 = S.x - S.hx, sx1 = S.x + S.hx;
    face(tb, 'shop2', H.x0, zF, sx0, zF, y, y + 4.6, [0, 0, 1], 0, 0.5);
    face(tb, 'store', sx0, zF, sx1, zF, y, y + 4.5, [0, 0, 1]); // 便利商店（門＝interiors.js 的自動門：x ±1.05、高 2.4）
    box(cb, sx0, sx1, y + 4.5, y + 4.6, zF - 0.02, zF + 0.02, C.dark, false);
    for (let x = sx1, k = 0; x < 1030 - 0.01; x += 8, k++) face(tb, 'atrium', x, zF, Math.min(x + 8, 1030), zF, y, y + 10, [0, 0, 1], 0, Math.min(8, 1030 - x) / 8); // 大廳的玻璃（兩層高）
    face(tb, 'shop2', 1030, zF, H.x1, zF, y, y + 4.6, [0, 0, 1], 0.5, 1);
    for (const [x0, x1] of [[H.x0, sx1], [1030, H.x1]]) { for (let x = x0; x < x1 - 0.01; x += 8) face(tb, 'slats', x, zF, Math.min(x + 8, x1), zF, y + 5, y + 9.4, [0, 0, 1], 0, Math.min(8, x1 - x) / 8); }
    face(tb, 'food', 970, zF + 0.03, 996, zF + 0.03, y + 9.4, y + 10.5, [0, 0, 1]); face(tb, 'food', 1032, zF + 0.03, 1052, zF + 0.03, y + 9.4, y + 10.5, [0, 0, 1]);
    for (let x = H.x0; x < H.x1 - 0.01; x += 8) { const x1 = Math.min(x + 8, H.x1), f = (x1 - x) / 8; face(tb, 'hallwall', x1, H.z0, x, H.z0, y, y + 5, [0, 0, -1], 0, f); face(tb, 'hallwall', x1, H.z0, x, H.z0, y + 5, y + 10, [0, 0, -1], 0, f); }
    for (let z = H.z0; z < H.z1 - 0.01; z += 7) { const z1 = Math.min(z + 7, H.z1), f = (z1 - z) / 8; for (const yy of [y, y + 5]) { face(tb, 'hallwall', H.x0, z, H.x0, z1, yy, yy + 5, [-1, 0, 0], 0, f); face(tb, 'hallwall', H.x1, z1, H.x1, z, yy, yy + 5, [1, 0, 0], 0, f); } }
    // 屋頂上朝南的大招牌「大便龍服務區」
    face(tb, 'roofsign', 990, 220, 1038, 220, yT + 0.4, yT + 3.4, [0, 0, 1]); box(cb, 990, 1038, yT + 0.35, yT + 3.45, 219.7, 219.98, C.dark, true);
    for (const x of [994, 1014, 1034]) boxAt(cb, x, 219.6, 0.12, yT + 0.35, yT + 3.2, C.pole);
    // 鋸齒的「山」雨遮：x 往東每 4 公尺一個山頭（高 y+6.4、谷 y+5.0），從牆往外 4 公尺；細柱子
    const zc0 = zF, zc1 = zF + 4.2;
    for (let x = H.x0 - 1; x < H.x1 + 1 - 0.01; x += 4) {
      const xm = x + 2, x1 = x + 4, yv = y + 5.0, yp = y + 6.4;
      for (const [ax, ay, bx, by] of [[x, yv, xm, yp], [xm, yp, x1, yv]]) {
        cb.quad([ax, ay, zc0], [bx, by, zc0], [bx, by, zc1], [ax, ay, zc1], C.wood2, null, [0, 1, 0]);
        cb.quad([ax, ay - 0.18, zc0], [bx, by - 0.18, zc0], [bx, by - 0.18, zc1], [ax, ay - 0.18, zc1], C.wood, null, [0, -1, 0]);
        cb.quad([ax, ay - 0.18, zc1], [bx, by - 0.18, zc1], [bx, by, zc1], [ax, ay, zc1], C.wood, null, [0, 0, 1]);
      }
    }
    for (let x = H.x0 + 3; x < H.x1; x += 8) { boxAt(cb, x, zc1 - 0.4, 0.12, y, y + 5.1, C.pole); colCirc(x, zc1 - 0.4, 0.2, 5); }
    // 貓頭鷹的臉（大廳玻璃上面、正中間）
    { const cx = 1016, cyy = y + 7.55, r = 3.0; ab.quad([cx - r, cyy - r, zF + 0.08], [cx + r, cyy - r, zF + 0.08], [cx + r, cyy + r, zF + 0.08], [cx - r, cyy + r, zF + 0.08], null, reg('owl', 0, 1, 0, 1, AL), [0, 0, 1]); }
    // 碰撞：便利商店那一塊不算（interiors.js 的超商自己擋；V.colliders 那一個盒子走進去的時候會關掉）
    colBox(H.x0, S.x - S.hx, H.z0, H.z1, H.h); colBox(S.x + S.hx, H.x1, H.z0, H.z1, H.h); colBox(S.x - S.hx, S.x + S.hx, H.z0, S.z - S.hz, H.h);
  }
  // ---- 4) 廁所（兩棟一層樓）：南邊是壁畫＋中間親子／無障礙的門，男的門在西邊那頭、女的門在東邊那頭；屋頂出簷＋天窗 ----
  for (const W of L.wcs) {
    const yT = y + W.h;
    box(cb, W.x0 + 0.02, W.x1 - 0.02, y, yT, W.z0 + 0.02, W.z1 - 0.02, C.wall);
    box(cb, W.x0 - 0.9, W.x1 + 0.9, yT, yT + 0.3, W.z0 - 0.9, W.z1 + 0.9, C.wood);
    for (const x of [W.x0 + 8, W.x1 - 12]) box(cb, x, x + 4, yT + 0.3, yT + 0.8, W.z0 + 6, W.z1 - 6, C.glass);
    const xm = (W.x0 + W.x1) / 2;
    for (let x = W.x0; x < W.x1 - 0.01; x += 8) { const x1 = Math.min(x + 8, W.x1); if (x1 <= xm - 1.5 || x >= xm + 1.5) face(tb, 'mural', x, W.z1, x1, W.z1, y, yT, [0, 0, 1], 0, (x1 - x) / 8); else { face(tb, 'mural', x, W.z1, xm - 1.5, W.z1, y, yT, [0, 0, 1], 0, (xm - 1.5 - x) / 8); face(tb, 'mural', xm + 1.5, W.z1, x1, W.z1, y, yT, [0, 0, 1], (xm + 1.5 - x) / 8, (x1 - x) / 8); } }
    face(tb, 'wcF', xm - 1.5, W.z1 + 0.01, xm + 1.5, W.z1 + 0.01, y, y + 3, [0, 0, 1]); box(cb, xm - 1.5, xm + 1.5, y + 3, yT, W.z1 - 0.02, W.z1 + 0.01, C.wall2, false);
    for (let x = W.x0; x < W.x1 - 0.01; x += 8) { const x1 = Math.min(x + 8, W.x1); face(tb, 'mural', x1, W.z0, x, W.z0, y, yT, [0, 0, -1], 0, (x1 - x) / 8); }
    const zm = (W.z0 + W.z1) / 2;
    face(tb, 'wcM', W.x0, zm - 1.5, W.x0, zm + 1.5, y, y + 3, [-1, 0, 0]); face(tb, 'mural', W.x0, W.z0, W.x0, zm - 1.5, y, yT, [-1, 0, 0], 0, (zm - 1.5 - W.z0) / 8); face(tb, 'mural', W.x0, zm + 1.5, W.x0, W.z1, y, yT, [-1, 0, 0], 0.4, 0.4 + (W.z1 - zm - 1.5) / 8);
    face(tb, 'wcW', W.x1, zm + 1.5, W.x1, zm - 1.5, y, y + 3, [1, 0, 0]); face(tb, 'mural', W.x1, W.z1, W.x1, zm + 1.5, y, yT, [1, 0, 0], 0, (W.z1 - zm - 1.5) / 8); face(tb, 'mural', W.x1, zm - 1.5, W.x1, W.z0, y, yT, [1, 0, 0], 0.4, 0.4 + (zm - 1.5 - W.z0) / 8);
    box(cb, W.x0 - 0.02, W.x0 + 0.01, y + 3, yT, zm - 1.5, zm + 1.5, C.wall2, false); box(cb, W.x1 - 0.01, W.x1 + 0.02, y + 3, yT, zm - 1.5, zm + 1.5, C.wall2, false);
    colBox(W.x0, W.x1, W.z0, W.z1, W.h);
    trees.push([W.x0 - 4, W.z1 + 2, 0.8], [W.x1 + 4, W.z1 + 2, 0.8]);
  }
  // ---- 5) 加油站：雨棚（上面一圈招牌）、6 支柱子、4 座加油機、小屋、價錢牌 ----
  { const Gs = L.gas, yc = y + 5.6, yt = y + 6.5;
    box(cb, Gs.cx0, Gs.cx1, yc, yt, Gs.cz0, Gs.cz1, C.white);
    for (let x = Gs.cx0; x < Gs.cx1 - 0.01; x += 4) { const x1 = Math.min(x + 4, Gs.cx1), f = (x1 - x) / 4; face(tb, 'gas', x, Gs.cz1 + 0.02, x1, Gs.cz1 + 0.02, yc, yt, [0, 0, 1], 0, f); face(tb, 'gas', x1, Gs.cz0 - 0.02, x, Gs.cz0 - 0.02, yc, yt, [0, 0, -1], 0, f); }
    for (const x of [1124, 1140, 1156]) for (const z of [201, 213]) { boxAt(cb, x, z, 0.3, y, yc, C.red); colBox(x - 0.35, x + 0.35, z - 0.35, z + 0.35, 5.6); }
    for (const x of [1132, 1148]) for (const z of [204.5, 209.5]) { box(cb, x - 0.6, x + 0.6, y, y + 0.2, z - 2.2, z + 2.2, C.curb); box(cb, x - 0.35, x + 0.35, y + 0.2, y + 2.1, z - 0.5, z + 0.5, z < 207 ? C.blue : C.red); box(cb, x - 0.38, x + 0.38, y + 1.5, y + 1.9, z - 0.52, z + 0.52, C.white, false); colBox(x - 0.6, x + 0.6, z - 2.2, z + 2.2, 2.1); }
    const [k0, k1, k2, k3] = Gs.kiosk; box(cb, k0, k1, y, y + 3.4, k2, k3, C.wall); box(cb, k0 - 0.4, k1 + 0.4, y + 3.4, y + 3.6, k2 - 0.4, k3 + 0.4, C.roof); { const km = (k0 + k1) / 2; box(cb, km - 1.95, km + 1.95, y + 2.3, y + 3.4, k3, k3 + 0.04, C.dark, false); face(tb, 'kiosk', km - 1.8, k3 + 0.06, km + 1.8, k3 + 0.06, y + 2.45, y + 3.35, [0, 0, 1]); } // 招牌 4:1 colBox(k0, k1, k2, k3, 3.4);
    boxAt(cb, 1171, 193, 0.18, y, y + 6, C.pole); box(cb, 1169.52, 1172.48, y + 6, y + 10.5, 192.72, 193.28, C.white); face(tb, 'price', 1169.5, 193.3, 1172.5, 193.3, y + 6, y + 10.5, [0, 0, 1]); face(tb, 'price', 1172.5, 192.7, 1169.5, 192.7, y + 6, y + 10.5, [0, 0, -1]); colCirc(1171, 193, 0.3, 10);
  }
  // ---- 6) 廣場：圓水池、紫色蝴蝶雕塑、長椅 ----
  { const P = L.pond, NS = 28; for (let k = 0; k < NS; k++) { const a0 = (k / NS) * TAU, a1 = ((k + 1) / NS) * TAU, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      cb.tri([P.x, G + 0.25, P.z], [P.x + c1 * (P.r - 0.35), G + 0.25, P.z + s1 * (P.r - 0.35)], [P.x + c0 * (P.r - 0.35), G + 0.25, P.z + s0 * (P.r - 0.35)], C.water, [0, 1, 0]);
      cb.quad([P.x + c0 * (P.r - 0.35), G + 0.45, P.z + s0 * (P.r - 0.35)], [P.x + c1 * (P.r - 0.35), G + 0.45, P.z + s1 * (P.r - 0.35)], [P.x + c1 * P.r, G + 0.45, P.z + s1 * P.r], [P.x + c0 * P.r, G + 0.45, P.z + s0 * P.r], C.rim, null, [0, 1, 0]);
      cb.quad([P.x + c0 * P.r, G, P.z + s0 * P.r], [P.x + c1 * P.r, G, P.z + s1 * P.r], [P.x + c1 * P.r, G + 0.45, P.z + s1 * P.r], [P.x + c0 * P.r, G + 0.45, P.z + s0 * P.r], C.rim, null, [c0, 0, s0]); }
    colCirc(P.x, P.z, P.r, 0.5);
    const F = L.fly; boxAt(cb, F.x, F.z, 0.15, y, y + 3.2, C.pole); box(cb, F.x - 1, F.x + 1, y, y + 0.5, F.z - 1, F.z + 1, C.curb);
    for (const sd of [-1, 1]) { const w = (a, b2, hh) => [F.x + sd * a, y + hh, F.z + b2]; ab.quad(w(0, 0, 2.2), w(3.2, -0.6, 2.2), w(3.2, -0.6, 6.0), w(0, 0, 6.0), null, reg('fly', 0, 1, 0, 1, AL), [0, 0, 1]); }
    colCirc(F.x, F.z, 1.1, 3);
    for (const x of [960, 990, 1046, 1066]) { box(cb, x - 1, x + 1, G, G + 0.45, 233.6, 234.1, C.wood2); colBox(x - 1, x + 1, 233.6, 234.1, 0.45); }
  }
  // ---- 7) 大車：遊覽車 4 台、貨車 2 台停在斜格裡（遠遠看就知道是休息站）----
  const buses = buildBuses();
  // ---- 8) 大字「大便龍服務區」（彩色，朝南）----
  // 大字（南投服務區山坡上那種彩色的大字；這裡後面沒有山＝立在北邊的鐵架上，停車場看得到）
  { const zL = 172, w = 7.5, gap = 1.3, x0 = 858, g0 = y + 3, xe = x0 + 6 * w + 5 * gap;
    for (let i = 0; i < 6; i++) { const x = x0 + i * (w + gap); ab.quad([x, g0, zL], [x + w, g0, zL], [x + w, g0 + w, zL], [x, g0 + w, zL], null, reg('L' + i, 0, 1, 0, 1, AL), [0, 0, 1]); ab.quad([x + w, g0, zL - 0.15], [x, g0, zL - 0.15], [x, g0 + w, zL - 0.15], [x + w, g0 + w, zL - 0.15], null, reg('L' + i, 1, 0, 0, 1, AL), [0, 0, -1]); }
    for (let x = x0 + 2; x < xe; x += 8.8) boxAt(cb, x, zL - 0.5, 0.14, y, g0 + w - 0.6, C.pole); // 柱子（字的後面）
    for (const yy of [g0 + 1.2, g0 + w - 1.6]) box(cb, x0 + 1, xe - 1, yy, yy + 0.2, zL - 0.62, zL - 0.38, C.pole); // 橫的鐵條
  }

  // ---- 9) 樹（北邊一排、停車場南邊一排、島上、廁所旁邊）、路燈（兩條路）----
  for (let x = 812; x < 1200; x += 11) { trees.push([x + ((x * 3.1) % 4), 176 + ((x * 1.7) % 3), 1 + ((x * 0.37) % 0.4)]); trees.push([x + 5, 277 + ((x * 2.3) % 2.5), 0.9 + ((x * 0.53) % 0.35)]); }
  for (let x = 820; x < 1205; x += 40) { lampPole(x, 181, 9, 1); lampPole(x + 20, 292, 9, -1); }
  for (const [x, z, s] of trees) tree(x, z, s);
  // ---- 網格 ----
  const tex = new THREE.CanvasTexture(AT.c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer && renderer.capabilities ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  const texA = new THREE.CanvasTexture(AL.c); texA.colorSpace = THREE.SRGBColorSpace;
  const mat = (o) => { const m = new THREE.MeshStandardMaterial(o); return m; };
  const mC = mat({ vertexColors: true, roughness: 0.85, metalness: 0 }); mC.name = 'rest-col';
  const mL = mat({ vertexColors: true, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); mL.name = 'rest-line';
  const mT = mat({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.14, roughness: 0.55, metalness: 0 }); mT.name = 'rest-fac';
  const mA = mat({ map: texA, emissiveMap: texA, emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.6, metalness: 0, alphaTest: 0.5, side: THREE.DoubleSide }); mA.name = 'rest-cut';
  const mG = new THREE.MeshBasicMaterial({ vertexColors: true }); mG.name = 'rest-lamp';
  for (const [b, m, nm] of [[cb, mC, 'rest-col'], [lineB, mL, 'rest-line'], [tb, mT, 'rest-fac'], [ab, mA, 'rest-cut'], [glow, mG, 'rest-lamp']]) { if (!b.n) continue; const me = new THREE.Mesh(b.geo(), m); me.name = nm; me.receiveShadow = nm !== 'rest-lamp'; me.castShadow = nm === 'rest-col' || nm === 'rest-cut'; group.add(me); tris += b.nt; }
  for (const I of buses.meshes) { I.material = mT; group.add(I); }
  tris += buses.tris;
  // ---- 便利商店：interiors.js 的超商（V.buildings 一棟 kind 'store'、y 24；那個盒子放 V.colliders：走進去的時候 town.src.js 會關掉）----
  const S = L.store, store = { kind: 'store', name: '大便龍超商', x: S.x, z: S.z, hx: S.hx, hz: S.hz, rot: 0, h: 4.6, y, rest: true, door: { x: S.x, z: S.z + S.hz + 0.15, ry: 0 } };
  if (V.buildings) V.buildings.push(store);
  if (V.colliders) V.colliders.push({ t: 'box', x: S.x, z: S.z, hx: S.hx, hz: S.hz, rot: 0, y0: y, h: y + 4.6, noCrush: true, rest: 'store' });
  return { group, tris, cols, lamps, store, walk: L.walk, buses: buses.list };

  function lampPole(x, z, h, side = 0) { // 路燈：柱子＋燈頭（晚上亮：look.js V.lampsX）
    boxAt(cb, x, z, 0.13, y, y + h, C.pole); colCirc(x, z, 0.22, h);
    const hx = x, hzz = z + side * 1.4; if (side) ctx.lbar(cb, x, z, hx, hzz, y + h - 0.15, y + h, 0.06, C.pole);
    glow.quad([hx - 0.4, y + h - 0.25, hzz - 0.22], [hx + 0.4, y + h - 0.25, hzz - 0.22], [hx + 0.4, y + h - 0.25, hzz + 0.22], [hx - 0.4, y + h - 0.25, hzz + 0.22], [1, 1, 1], null, [0, -1, 0]);
    lamps.push(hx, y + h - 0.3, hzz);
  }
  function tree(x, z, s) { // 樹：樹幹＋兩層八面體的樹冠
    const g = (V.heightAt ? V.heightAt(x, z) : y) - 0.05, th = 2.2 * s, col = C.leaf[Math.floor(Math.abs(x * 13.7 + z * 7.1)) % 3];
    boxAt(cb, x, z, 0.16 * s, g, g + th + 0.6, C.trunk);
    for (const [cy, r, hh] of [[g + th + 1.0 * s, 2.0 * s, 1.6 * s], [g + th + 2.4 * s, 1.4 * s, 1.4 * s]]) {
      const P = [], N2 = 6; for (let k = 0; k < N2; k++) { const a = (k / N2) * TAU + x; P.push([x + Math.cos(a) * r, cy, z + Math.sin(a) * r]); }
      for (let k = 0; k < N2; k++) { const a = P[k], b2 = P[(k + 1) % N2]; cb.tri(a, b2, [x, cy + hh, z], col, [a[0] - x, 0.6, a[2] - z]); cb.tri(b2, a, [x, cy - hh * 0.6, z], [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8], [a[0] - x, -0.5, a[2] - z]); }
    }
    colCirc(x, z, 0.3 * s, 3);
  }
  function arrow(x, z, dir, kind) { // 地上的白箭頭（往 dir 那邊）
    void kind; const t = dir;
    ln(x - 2.2 * t, z, x + 0.6 * t, z, 0.22, C.line);
    lineB.tri([x + 0.4 * t, G + 0.012, z - 0.6], [x + 1.6 * t, G + 0.012, z], [x + 0.4 * t, G + 0.012, z + 0.6], C.line, [0, 1, 0]);
  }
  function num40(x, z, dir) { // 地上的「40」（用線畫）
    const s = dir, w = 0.16, d = (a, b2, c, e) => ln(x + a * s, z + b2 * s, x + c * s, z + e * s, w, C.line);
    // 「4」：從開過來的人看（字頭朝前進方向）
    d(-1.2, -1.2, 0.6, -1.2); d(0.6, -1.2, -0.2, 0.2); d(-0.2, 0.2, -0.2, -0.8);
    // 「0」
    d(-1.2, 0.6, 0.6, 0.6); d(0.6, 0.6, 0.6, 1.6); d(0.6, 1.6, -1.2, 1.6); d(-1.2, 1.6, -1.2, 0.6);
  }
  function buildBuses() { // 遊覽車（12 × 2.5 × 3.4）、貨車（車頭＋貨櫃）：每種一個 InstancedMesh（用店面那張貼圖）
    const bb = qb(true), tk = qb(true);
    const bx = (b, x0, x1, y0, y1, z0, z1, side, front, back, topReg) => {
      b.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], null, reg(side), [0, 0, 1]); b.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], null, reg(side), [0, 0, -1]);
      b.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], null, reg(front), [1, 0, 0]); b.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], null, reg(back), [-1, 0, 0]);
      b.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], null, reg(topReg, 0.1, 0.2, 0.9, 1), [0, 1, 0]);
    };
    bx(bb, -6, 6, 0.35, 3.5, -1.25, 1.25, 'busside', 'busfront', 'busfront', 'busside');
    bx(tk, -6, 4, 0.4, 4.0, -1.25, 1.25, 'truckside', 'truckback', 'truckback', 'truckside');
    bx(tk, 4.1, 6.2, 0.4, 3.2, -1.2, 1.2, 'busfront', 'busfront', 'busfront', 'busside');
    const list = [], M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    const spots = [[0, 'bus'], [1, 'bus'], [2, 'truck'], [3, 'bus'], [5, 'truck']]; // 第 k 格（斜的）
    const ang = Math.atan2(30, 7); // 格子的方向（往南偏）：車頭朝南
    const bus = [], truck = [];
    for (const [k, t] of spots) { const x = 862 + k * 9 + 3.5 + 4.5, z = 211; (t === 'bus' ? bus : truck).push([x, z]); list.push({ x, z, h: ang, t }); colBox(x - 2.5, x + 2.5, z - 6.5, z + 6.5, 3.5); }
    const meshes = [], tr = { n: 0 };
    for (const [b, L2, nm] of [[bb, bus, 'rest-bus'], [tk, truck, 'rest-truck']]) {
      if (!L2.length) continue; const I = new THREE.InstancedMesh(b.geo(), null, L2.length); I.name = nm;
      L2.forEach(([x, z], i) => { q.setFromAxisAngle(up, ang); pos.set(x, y + 0.02, z); M4.compose(pos, q, one); I.setMatrixAt(i, M4); });
      I.instanceMatrix.needsUpdate = true; I.computeBoundingSphere(); I.castShadow = true; I.receiveShadow = true; meshes.push(I); tr.n += b.nt * L2.length;
    }
    return { meshes, tris: tr.n, list };
  }
}

// ---- 貼圖 ----
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
function atlas() {
  const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const R = {
    store: [0, 0, 1024, 256], shop2: [1024, 0, 1024, 256], atrium: [0, 256, 512, 512], mural: [512, 256, 512, 256], wcM: [1024, 256, 256, 256], wcW: [1280, 256, 256, 256], wcF: [1536, 256, 256, 256],
    roofsign: [512, 512, 1024, 128], food: [512, 640, 512, 128], gas: [1024, 640, 512, 128], kiosk: [1536, 512, 512, 128], slats: [0, 768, 512, 256], hallwall: [512, 768, 512, 256],
    busside: [1024, 768, 512, 128], truckside: [1024, 896, 512, 128], price: [1536, 640, 256, 384], busfront: [1792, 640, 256, 256], truckback: [1792, 896, 256, 128], wcspare: [1792, 256, 256, 256],
  };
  let s = 17; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const txt = (t, x, y, px, col, wt = 700, al = 'center') => { g.fillStyle = col; g.font = `${wt} ${px}px ${SANS}`; g.textAlign = al; g.textBaseline = 'middle'; g.fillText(t, x, y); };
  // 便利商店（18 × 4.5 公尺）：上面一條招牌、玻璃裡面亮亮的貨架、中間自動門
  { const [x0, y0, w, h] = R.store, m = w / 18;
    g.fillStyle = '#f3efe2'; g.fillRect(x0, y0, w, h);
    g.fillStyle = '#1d7a46'; g.fillRect(x0, y0, w, 44); g.fillStyle = '#f08a1c'; g.fillRect(x0, y0 + 44, w, 8); g.fillStyle = '#d93a2b'; g.fillRect(x0, y0 + 52, w, 5);
    txt('大便龍超商', x0 + 210, y0 + 23, 34, '#ffffff'); g.fillStyle = '#f08a1c'; g.fillRect(x0 + w - 150, y0 + 6, 110, 32); txt('24H', x0 + w - 95, y0 + 23, 28, '#ffffff', 800);
    txt('便利商店', x0 + w - 330, y0 + 23, 26, '#ffffff', 600);
    for (let k = 0; k < 9; k++) { const sx = x0 + 30 + k * 108; if (Math.abs(sx + 40 - (x0 + w / 2)) < 90) continue; for (let r = 0; r < 4; r++) { const yy = y0 + 92 + r * 36; g.fillStyle = '#c9c2b0'; g.fillRect(sx, yy + 26, 86, 4); for (let p = 0; p < 9; p++) { g.fillStyle = `hsl(${Math.floor(rnd() * 360)},${50 + rnd() * 30}%,${45 + rnd() * 20}%)`; g.fillRect(sx + 2 + p * 9.4, yy + 6 + rnd() * 6, 7, 20 - rnd() * 6); } } }
    g.fillStyle = 'rgba(255,255,255,0.9)'; for (let k = 0; k < 6; k++) g.fillRect(x0 + 40 + k * 170, y0 + 66, 110, 6);
    g.fillStyle = 'rgba(160,200,230,0.18)'; g.fillRect(x0, y0 + 60, w, h - 60);
    g.fillStyle = '#3a3d40'; for (let k = 0; k <= 9; k++) g.fillRect(x0 + k * (w / 9) - 3, y0 + 57, 6, h - 57); g.fillRect(x0, y0 + h - 10, w, 10);
    const dx = x0 + w / 2, dw = 1.05 * m, dt = y0 + h - 2.4 * m; g.fillStyle = 'rgba(40,60,70,0.55)'; g.fillRect(dx - dw, dt, dw * 2, h - (dt - y0)); g.fillStyle = '#2a2c2e'; g.fillRect(dx - dw - 4, dt - 4, dw * 2 + 8, 6); g.fillRect(dx - 2, dt, 4, h - (dt - y0));
    for (const [px, c2, t2] of [[x0 + 150, '#f6d33c', '新品'], [x0 + 820, '#e2584b', '咖啡'], [x0 + 330, '#7cc4e8', '冰品']]) { g.fillStyle = c2; g.fillRect(px, y0 + 150, 60, 60); txt(t2, px + 30, y0 + 180, 20, '#222'); }
  }
  // 伴手禮（左半）＋麵包・茶（右半）
  { const [x0, y0, w, h] = R.shop2;
    for (const [k, name, col, bg] of [[0, '伴手禮', '#8a3b1e', '#f5e6c8'], [1, '麵包 · 茶', '#2f5d3a', '#f1ead8']]) {
      const sx = x0 + k * (w / 2), sw = w / 2; g.fillStyle = bg; g.fillRect(sx, y0, sw, h); g.fillStyle = col; g.fillRect(sx, y0, sw, 46); txt(name, sx + sw / 2, y0 + 24, 32, '#fff');
      for (let r = 0; r < 3; r++) for (let p = 0; p < 12; p++) { g.fillStyle = `hsl(${(k ? 30 : 10) + rnd() * 40},${40 + rnd() * 30}%,${40 + rnd() * 25}%)`; g.fillRect(sx + 24 + p * 39, y0 + 96 + r * 44, 30, 26); }
      g.fillStyle = 'rgba(160,200,230,0.2)'; g.fillRect(sx, y0 + 50, sw, h - 50); g.fillStyle = '#3a3d40'; for (let q = 0; q <= 4; q++) g.fillRect(sx + q * (sw / 4) - 3, y0 + 46, 6, h - 46); g.fillRect(sx, y0 + h - 10, sw, 10);
    }
  }
  // 大廳的玻璃（8 × 8 公尺）：直的框 2 公尺一支、橫的在 2.5、5（2 樓地板）、7.5；裡面暖暖的燈
  { const [x0, y0, w, h] = R.atrium, m = w / 8;
    const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, '#8fb3c9'); gr.addColorStop(0.5, '#6b8ea4'); gr.addColorStop(1, '#4d6b7c'); g.fillStyle = gr; g.fillRect(x0, y0, w, h);
    g.fillStyle = 'rgba(255,214,150,0.35)'; for (let k = 0; k < 4; k++) g.fillRect(x0 + 20 + k * 128, y0 + h - 5.2 * m, 90, 8);
    g.fillStyle = 'rgba(255,220,170,0.25)'; g.fillRect(x0, y0 + h - 4.6 * m, w, 2.8 * m);
    g.fillStyle = 'rgba(255,255,255,0.18)'; for (let k = 0; k < 5; k++) { g.beginPath(); const a = x0 + rnd() * w; g.moveTo(a, y0); g.lineTo(a + 60, y0); g.lineTo(a - 80, y0 + h); g.lineTo(a - 140, y0 + h); g.fill(); }
    g.fillStyle = '#2f3438'; for (let k = 0; k <= 4; k++) g.fillRect(x0 + k * 2 * m - 4, y0, 8, h); for (const yy of [2.5, 5, 7.5]) g.fillRect(x0, y0 + h - yy * m - 4, w, yy === 5 ? 14 : 7);
  }
  // 壁畫（8 × 4 公尺）：米色的牆、中間一條紅黑白的菱形、上下鋸齒的黃線、下面深色的底
  { const [x0, y0, w, h] = R.mural, m = w / 8;
    g.fillStyle = '#e8dcc4'; g.fillRect(x0, y0, w, h); g.fillStyle = '#5a4a3c'; g.fillRect(x0, y0 + h - 0.5 * m, w, 0.5 * m);
    const by = y0 + h * 0.36, bh = h * 0.3; g.fillStyle = '#1f1b18'; g.fillRect(x0, by, w, bh);
    for (let k = 0; k < 16; k++) { const cx = x0 + (k + 0.5) * (w / 16), cy = by + bh / 2; g.fillStyle = k % 2 ? '#c8352a' : '#f2ede2'; g.beginPath(); g.moveTo(cx, cy - bh * 0.42); g.lineTo(cx + w / 34, cy); g.lineTo(cx, cy + bh * 0.42); g.lineTo(cx - w / 34, cy); g.fill(); g.fillStyle = '#1f1b18'; g.beginPath(); g.moveTo(cx, cy - bh * 0.16); g.lineTo(cx + w / 90, cy); g.lineTo(cx, cy + bh * 0.16); g.lineTo(cx - w / 90, cy); g.fill(); }
    g.strokeStyle = '#e0a526'; g.lineWidth = 6; for (const yy of [by - 14, by + bh + 14]) { g.beginPath(); for (let k = 0; k <= 32; k++) { const xx = x0 + k * (w / 32), y2 = yy + (k % 2 ? -8 : 8); k ? g.lineTo(xx, y2) : g.moveTo(xx, y2); } g.stroke(); }
  }
  // 廁所的門（3 × 3 公尺）：門洞（看得到裡面擋視線的牆）＋上面的牌子
  const wcDoor = (key, col, word, icon) => { const [x0, y0, w, h] = R[key];
    g.fillStyle = '#e8dcc4'; g.fillRect(x0, y0, w, h); g.fillStyle = '#3b3632'; g.fillRect(x0 + 40, y0 + 92, w - 80, h - 92); g.fillStyle = '#9a8f80'; g.fillRect(x0 + 70, y0 + 130, w - 140, h - 130); g.fillStyle = '#c7bdb0'; g.fillRect(x0 + 40, y0 + h - 8, w - 80, 8);
    g.fillStyle = col; g.fillRect(x0 + 40, y0 + 14, w - 80, 66); txt(word, x0 + w / 2 + 34, y0 + 48, 40, '#fff', 800); g.fillStyle = '#fff'; icon(x0 + 82, y0 + 47);
  };
  wcDoor('wcM', '#2f63b8', '男', (x, yy) => { g.beginPath(); g.arc(x, yy - 18, 8, 0, Math.PI * 2); g.fill(); g.fillRect(x - 10, yy - 8, 20, 22); g.fillRect(x - 9, yy + 12, 7, 18); g.fillRect(x + 2, yy + 12, 7, 18); });
  wcDoor('wcW', '#c8352a', '女', (x, yy) => { g.beginPath(); g.arc(x, yy - 18, 8, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(x, yy - 9); g.lineTo(x + 15, yy + 16); g.lineTo(x - 15, yy + 16); g.fill(); g.fillRect(x - 7, yy + 16, 5, 14); g.fillRect(x + 2, yy + 16, 5, 14); });
  wcDoor('wcF', '#2f8a4e', '親子 · 無障礙', (x, yy) => { g.beginPath(); g.arc(x - 6, yy - 18, 6, 0, Math.PI * 2); g.fill(); g.lineWidth = 4; g.strokeStyle = '#fff'; g.beginPath(); g.arc(x - 2, yy + 12, 12, 0, Math.PI * 2); g.stroke(); g.fillRect(x - 9, yy - 10, 6, 18); g.fillRect(x - 9, yy + 4, 18, 5); });
  { const [x0, y0, w, h] = R.wcF; g.fillStyle = '#2f8a4e'; g.fillRect(x0 + 40, y0 + 14, w - 80, 66); txt('親子', x0 + w / 2 + 22, y0 + 32, 26, '#fff', 800); txt('無障礙', x0 + w / 2 + 22, y0 + 62, 24, '#fff', 800); g.fillStyle = '#fff'; g.beginPath(); g.arc(x0 + 66, y0 + 34, 6, 0, Math.PI * 2); g.fill(); g.lineWidth = 4; g.strokeStyle = '#fff'; g.beginPath(); g.arc(x0 + 70, y0 + 58, 11, 0, Math.PI * 2); g.stroke(); }
  // 招牌：屋頂「大便龍服務區」、2 樓「美食街 · 咖啡」、加油站、小屋、價錢
  { const [x0, y0, w, h] = R.roofsign; g.fillStyle = '#3a2416'; g.fillRect(x0, y0, w, h); g.fillStyle = '#c8352a'; g.fillRect(x0, y0 + h - 12, w, 12); txt('大便龍服務區', x0 + w / 2, y0 + h / 2 - 4, 92, '#fff1c7', 900); }
  { const [x0, y0, w, h] = R.food; g.fillStyle = '#6b4225'; g.fillRect(x0, y0, w, h); txt('美食街 · 咖啡 2F', x0 + w / 2, y0 + h / 2, 54, '#fff', 800); }
  { const [x0, y0, w, h] = R.gas; g.fillStyle = '#ffffff'; g.fillRect(x0, y0, w, h); g.fillStyle = '#1d5fb0'; g.fillRect(x0, y0 + h - 26, w, 14); g.fillStyle = '#d93a2b'; g.fillRect(x0, y0 + h - 12, w, 12); txt('大便龍加油站', x0 + w / 2, y0 + 48, 56, '#1d5fb0', 900); }
  { const [x0, y0, w, h] = R.kiosk; g.fillStyle = '#1d5fb0'; g.fillRect(x0, y0, w, h); txt('加油站 · 洗手間', x0 + w / 2, y0 + h / 2, 58, '#fff', 800); }
  { const [x0, y0, w, h] = R.price; g.fillStyle = '#f4f4f0'; g.fillRect(x0, y0, w, h); g.fillStyle = '#1d5fb0'; g.fillRect(x0, y0, w, 70); txt('大便龍加油', x0 + w / 2, y0 + 36, 36, '#fff', 900);
    [['92 無鉛', '30.1'], ['95 無鉛', '31.6'], ['98 無鉛', '33.6'], ['超級柴油', '28.4']].forEach(([a, b2], k) => { const yy = y0 + 104 + k * 72; txt(a, x0 + 10, yy, 30, '#222', 800, 'left'); g.fillStyle = '#111'; g.fillRect(x0 + 140, yy - 26, 108, 52); txt(b2, x0 + 194, yy + 2, 40, '#ff3b2a', 800); }); }
  // 2 樓的木條、側面的牆（石頭＋一排高窗）
  { const [x0, y0, w, h] = R.slats; g.fillStyle = '#4b2e1a'; g.fillRect(x0, y0, w, h); for (let k = 0; k < 40; k++) { g.fillStyle = `hsl(26,${45 + rnd() * 15}%,${32 + rnd() * 12}%)`; g.fillRect(x0 + k * (w / 40) + 2, y0, w / 40 - 5, h); } g.fillStyle = 'rgba(255,220,160,0.25)'; g.fillRect(x0, y0 + h * 0.3, w, h * 0.35); }
  { const [x0, y0, w, h] = R.hallwall; g.fillStyle = '#b9ae9c'; g.fillRect(x0, y0, w, h); g.strokeStyle = 'rgba(80,70,60,0.35)'; g.lineWidth = 2; for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++) g.strokeRect(x0 + k * 64 + (r % 2) * 32, y0 + r * 32, 64, 32);
    g.fillStyle = '#4a5c68'; for (let k = 0; k < 4; k++) g.fillRect(x0 + 24 + k * 128, y0 + 50, 80, 70); g.fillStyle = 'rgba(255,255,255,0.25)'; for (let k = 0; k < 4; k++) g.fillRect(x0 + 30 + k * 128, y0 + 56, 20, 58); }
  // 遊覽車、貨車
  { const [x0, y0, w, h] = R.busside; g.fillStyle = '#f2f2ee'; g.fillRect(x0, y0, w, h); g.fillStyle = '#1e2a33'; g.fillRect(x0 + 24, y0 + 14, w - 48, 50); g.fillStyle = '#f08a1c'; g.fillRect(x0, y0 + 72, w, 10); g.fillStyle = '#1d7a46'; g.fillRect(x0, y0 + 84, w, 6); txt('大便龍客運', x0 + w / 2, y0 + 104, 22, '#1d7a46', 800);
    g.fillStyle = '#111'; for (const xx of [0.18, 0.8]) { g.beginPath(); g.arc(x0 + xx * w, y0 + h, 22, Math.PI, 0); g.fill(); } }
  { const [x0, y0, w, h] = R.truckside; g.fillStyle = '#eceff2'; g.fillRect(x0, y0, w, h); g.strokeStyle = '#c7ccd2'; g.lineWidth = 3; for (let k = 0; k < 20; k++) { g.beginPath(); g.moveTo(x0 + k * 26, y0); g.lineTo(x0 + k * 26, y0 + h); g.stroke(); } txt('BEAU 物流', x0 + w / 2, y0 + h / 2 - 6, 46, '#1d5fb0', 900); g.fillStyle = '#111'; for (const xx of [0.15, 0.8]) { g.beginPath(); g.arc(x0 + xx * w, y0 + h, 20, Math.PI, 0); g.fill(); } }
  { const [x0, y0, w, h] = R.busfront; g.fillStyle = '#e8e8e4'; g.fillRect(x0, y0, w, h); g.fillStyle = '#1e2a33'; g.fillRect(x0 + 18, y0 + 20, w - 36, h * 0.5); g.fillStyle = '#ffe9a8'; g.fillRect(x0 + 20, y0 + h - 60, 40, 18); g.fillRect(x0 + w - 60, y0 + h - 60, 40, 18); }
  { const [x0, y0, w, h] = R.truckback; g.fillStyle = '#d9dde2'; g.fillRect(x0, y0, w, h); g.fillStyle = '#9aa1a8'; g.fillRect(x0 + w / 2 - 2, y0, 4, h); g.fillStyle = '#c8352a'; g.fillRect(x0 + 10, y0 + h - 24, 30, 12); g.fillRect(x0 + w - 40, y0 + h - 24, 30, 12); }
  return { c, R, W, H };
}
function alphaAtlas() { // 透明底：山上的六個字、貓頭鷹的臉、蝴蝶的翅膀
  const W = 1536, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const R = { owl: [0, 256, 256, 256], fly: [256, 256, 256, 256] };
  const cols = ['#e8452f', '#f39a1e', '#f2cf2a', '#3fae4a', '#2f7fd1', '#8b4cc4'];
  [...'大便龍服務區'].forEach((ch, i) => { R['L' + i] = [i * 256, 0, 256, 256]; g.font = `900 228px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 22; g.strokeStyle = '#ffffff'; g.strokeText(ch, i * 256 + 128, 136); g.fillStyle = cols[i]; g.fillText(ch, i * 256 + 128, 136); });
  { const cx = 128, cy = 384, g2 = g; // 貓頭鷹：紅色的圓、白臉、兩個大眼睛、黃嘴巴、小耳朵
    g2.fillStyle = '#b8261d'; g2.beginPath(); g2.arc(cx, cy + 6, 118, 0, Math.PI * 2); g2.fill(); g2.beginPath(); g2.moveTo(cx - 100, cy - 60); g2.lineTo(cx - 70, cy - 126); g2.lineTo(cx - 40, cy - 80); g2.fill(); g2.beginPath(); g2.moveTo(cx + 100, cy - 60); g2.lineTo(cx + 70, cy - 126); g2.lineTo(cx + 40, cy - 80); g2.fill();
    g2.fillStyle = '#fbf6ea'; for (const sx of [-1, 1]) { g2.beginPath(); g2.arc(cx + sx * 46, cy - 6, 50, 0, Math.PI * 2); g2.fill(); }
    g2.fillStyle = '#151515'; for (const sx of [-1, 1]) { g2.beginPath(); g2.arc(cx + sx * 46, cy - 6, 30, 0, Math.PI * 2); g2.fill(); } g2.fillStyle = '#fff'; for (const sx of [-1, 1]) { g2.beginPath(); g2.arc(cx + sx * 46 + 9, cy - 16, 9, 0, Math.PI * 2); g2.fill(); }
    g2.fillStyle = '#f2b51e'; g2.beginPath(); g2.moveTo(cx - 14, cy + 34); g2.lineTo(cx + 14, cy + 34); g2.lineTo(cx, cy + 64); g2.fill();
    g2.strokeStyle = '#151515'; g2.lineWidth = 6; for (let k = 0; k < 5; k++) { g2.beginPath(); g2.arc(cx, cy + 92 + k * 3, 40 - k * 6, Math.PI * 0.15, Math.PI * 0.85); g2.stroke(); } }
  { const x0 = 256, y0 = 256; g.fillStyle = '#8b4cc4'; g.beginPath(); g.moveTo(x0 + 10, y0 + 120); g.bezierCurveTo(x0 + 60, y0 - 10, x0 + 250, y0 + 10, x0 + 240, y0 + 110); g.bezierCurveTo(x0 + 236, y0 + 150, x0 + 120, y0 + 140, x0 + 10, y0 + 128); g.bezierCurveTo(x0 + 120, y0 + 150, x0 + 210, y0 + 200, x0 + 170, y0 + 246); g.bezierCurveTo(x0 + 120, y0 + 270, x0 + 30, y0 + 190, x0 + 10, y0 + 136); g.fill();
    g.fillStyle = '#c99be8'; for (const [a, b2, r] of [[140, 80, 26], [190, 70, 16], [120, 190, 18]]) { g.beginPath(); g.arc(x0 + a, y0 + b2, r, 0, Math.PI * 2); g.fill(); } g.strokeStyle = '#4a2370'; g.lineWidth = 5; g.beginPath(); g.moveTo(x0 + 10, y0 + 128); g.lineTo(x0 + 200, y0 + 60); g.stroke(); }
  return { c, R, W, H };
}
return { restLayout, buildRestArea, REST_TEXT };
})();
