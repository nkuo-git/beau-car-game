// ---- 公寓的家（第 60 批；Nick 2026-10-31「自己家改成在旁邊的公寓」，草稿 https://claude.ai/artifact/GahqJPKLLPf5FYXmHeq2wU 第 1 版，Nick 選「照草稿做」）----
// 每座圓塔車庫旁邊一棟 5 層的公寓（外殼：這裡；裡面：interiors.js 的 kind 'apt'：1 樓大廳＋電梯＋樓梯、2–5 樓走廊、4 樓你的家；頂樓、4 樓的陽台是真的在外面（town.src.js））
// 本地座標（跟 interiors.js 一樣）：原點＝一樓地板的中心、+z＝正面（大門、陽台那邊，朝街上）、+x 往右（從街上看是左邊）；放進世界：position＝(x, y, z)、rotation.y＝heading
//   公寓的正面跟塔的鐵捲門朝同一邊（aptLotOf：heading＝塔的 heading + π/2，中心在塔的本地 (lx, lz)：HOME_SITES[n].apt，沒給＝門外那條線往左 26 公尺）
// 【API】
//   APT：{ W 寬 12, D 深 15, FH 一層 3.3, NF 5 層, ROOF 頂樓地板 16.5, PAR 女兒牆 1.0, BZ 陽台內牆 z 6.1, BX0 BX1 陽台 x 範圍, core（樓梯、電梯在哪：interiors.js 照這裡蓋）, door（大門本地 { x, z, ry }）}
//   aptLotOf(L, n)：L＝HOME_SITES[n] → { x, z, heading, lx, lz }（公寓在世界的哪裡）
//   buildApt() → { parts: [{ name, geometry, material }]（給 InstancedMesh：6 座共用）, tris, cols（本地：整棟的碰撞，給村子）, roof: { y, zone, cols, spawn, door }, balc: { y, zone, cols, spawn, door, ceil } }
//     roof／balc：在外面走的那兩層（本地座標；town.src.js 換成世界、照塔的高度加 y）：zone＝走得到的長方形、cols＝只有在那一層的時候加的碰撞（女兒牆、樓梯間、牆）、spawn＝從裡面出來站哪、door＝回裡面的門（walk.js setDoors）
//   aptColsAt(cols, lot)：本地的碰撞 → 世界（跟 towerColsAt 一樣）
// 效能：一棟約 2.4k 三角形、5 個材質（磁磚、水泥、玻璃、金屬、白）；6 座 InstancedMesh＝5 個 draw call
// 打包（build-art.mjs／build-app.mjs 拿掉 import／export）：最上層只有 APT、aptLotOf、buildApt、aptColsAt
import * as THREE from 'three';

export const APT = { W: 12, D: 15, FH: 3.3, NF: 5, ROOF: 16.5, PAR: 1.0, BZ: 6.1, BX0: -0.3, BX1: 5.8, T: 0.2,
  core: { sx0: -5.8, sx1: -3.8, lx0: -3.6, lx1: -1.9, z0: -5.6, z1: -2.4, lz1: -3.7 }, // 樓梯間 x sx0…sx1、電梯 x lx0…lx1（深 z0…lz1）、都在 z0…z1；後面的走廊 z −7.3 … −5.6
  door: { x: 0, z: 7.5, ry: 0, w: 1.0 }, // 大門（正面中間；ry＝朝外）
  head: { x0: -5.8, x1: -1.7, z0: -5.8, z1: -2.2, h: 2.6 }, // 頂樓的樓梯間（上面放水塔）
};
const ROOFY = APT.ROOF, BALY = APT.FH * 3; // 4 樓的陽台地板（樓層 index 3）
// 公寓在哪：塔的本地 (lx, lz)（lx 往門外、lz 往左）→ 世界；正面朝塔的門那邊
export function aptLotOf(L, n = 0) {
  const o = L.apt || { lx: 4, lz: 26 }, c = Math.cos(L.heading), s = Math.sin(L.heading);
  return { x: L.x + o.lx * c + o.lz * s, z: L.z - o.lx * s + o.lz * c, heading: L.heading + Math.PI / 2, lx: o.lx, lz: o.lz, n };
}
export function aptColsAt(cols, lot) {
  const c = Math.cos(lot.heading), s = Math.sin(lot.heading), y = lot.y || 0;
  return cols.map((q) => { const o = { ...q, x: lot.x + q.x * c + q.z * s, z: lot.z - q.x * s + q.z * c }; if (o.t === 'box') o.rot = (q.rot || 0) + lot.heading; if (q.h != null) o.h = q.h + y; if (q.y0 != null) o.y0 = q.y0 + y; return o; });
}
const col3 = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
// 磁磚（canvas）：8 × 8 片一張，一片 10 公分 → uv 1 ＝ 0.8 公尺
function tileTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#b8b2a6'; g.fillRect(0, 0, 128, 128);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const k = ((i * 7 + j * 13) % 5) / 5; g.fillStyle = `rgb(${226 + k * 14},${214 + k * 12},${196 + k * 10})`; g.fillRect(i * 16 + 1, j * 16 + 1, 14, 14); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function mesher(uvScale) {
  const P = [], N = [], UV = [], C = [], I = [];
  const quad = (a, b, c, d, col, uv) => { // a b c d 逆時針（從正面看）；uv 不給：照世界尺寸（直的面：橫向＋高度；平的：x z）
    const k = P.length / 3, ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = d[0] - b[0], vy = d[1] - b[1], vz = d[2] - b[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const flat = Math.abs(ny) > 0.7, us = uv || [a, b, c, d].map((p) => (flat ? [p[0] / uvScale, p[2] / uvScale] : [(Math.abs(nx) > 0.7 ? p[2] : p[0]) / uvScale, p[1] / uvScale]));
    [a, b, c, d].forEach((p, i) => { P.push(p[0], p[1], p[2]); N.push(nx, ny, nz); UV.push(us[i][0], us[i][1]); C.push(col[0], col[1], col[2]); });
    I.push(k, k + 1, k + 2, k, k + 2, k + 3);
  };
  // 盒子：faces＝要畫哪幾面（px nx py ny pz nz；不給＝全部）；cols＝每面的顏色 { pz, py, _ }
  const bx = (x0, x1, y0, y1, z0, z1, col, faces = null, cols = null) => {
    const F = (f) => !faces || faces.includes(f), cc = (f) => (cols && cols[f]) || (cols && cols._) || col;
    if (F('pz')) quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], cc('pz'));
    if (F('nz')) quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], cc('nz'));
    if (F('px')) quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], cc('px'));
    if (F('nx')) quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], cc('nx'));
    if (F('py')) quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], cc('py'));
    if (F('ny')) quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], cc('ny'));
  };
  const cyl = (x, z, y0, y1, r0, r1, col, n = 12, cap = true) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, p = (r, a, y) => [x + r * Math.cos(a), y, z + r * Math.sin(a)];
      quad(p(r0, a1, y0), p(r0, a0, y0), p(r1, a0, y1), p(r1, a1, y1), col, [[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1]]);
      if (cap) quad([x, y1, z], p(r1, a1, y1), p(r1, a0, y1), p(r1, a0, y1), col, [[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1]]);
    }
  };
  const geometry = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.setIndex(I); g.computeBoundingSphere(); return g;
  };
  return { quad, bx, cyl, geometry, get tris() { return I.length / 3; } };
}
export function buildApt() {
  const { W, D, FH, NF, PAR, BZ, BX0, BX1, T, core, head } = APT, HX = W / 2, HZ = D / 2, H = ROOFY;
  const TI = mesher(0.8), FL = mesher(1), GL = mesher(1), MT = mesher(1), WH = mesher(1); // 磁磚、水泥、玻璃、金屬、白
  const tile = col3('#e4d8c4'), tile2 = col3('#cdb9a0'), conc = col3('#c9c6bf'), conc2 = col3('#b4b1aa'), dark = col3('#3c4046'), al = col3('#c7ccd2'), white = col3('#f2f2ef'), under = col3('#8f8d88');
  // ---- 主體：四面磁磚牆（正面右邊 2–4 樓凹進去是陽台）----
  TI.bx(-HX, HX, 0, H, -HZ, HZ, tile, ['nz', 'px', 'nx'], null); // 後、左、右
  TI.bx(-HX, BX0, 0, H, HZ - 0.01, HZ, tile, ['pz']); // 正面左半（整面）
  TI.bx(BX0, HX, 0, FH, HZ - 0.01, HZ, tile, ['pz']); // 正面右半一樓（大廳）
  TI.bx(BX0, HX, FH * 4, H, HZ - 0.01, HZ, tile, ['pz']); // 正面右半五樓
  TI.bx(BX0 - 0.01, BX0, FH, FH * 4, BZ, HZ, tile2, ['px']); // 陽台左邊的牆（凹進去那段）
  TI.bx(BX0, HX, FH, FH * 4, BZ, BZ + 0.01, tile2, ['pz']); // 陽台內牆（落地門那面）
  FL.quad([-HX, H, HZ], [HX, H, HZ], [HX, H, -HZ], [-HX, H, -HZ], conc); // 頂樓地板
  FL.quad([-HX, 0.01, -HZ], [HX, 0.01, -HZ], [HX, 0.01, HZ], [-HX, 0.01, HZ], conc2); // 一樓地（從外面看門口那一塊）
  for (let f = 1; f < NF; f++) FL.bx(-HX - 0.06, HX + 0.06, f * FH - 0.12, f * FH + 0.06, -HZ - 0.06, HZ + 0.06, conc2, ['pz', 'nz', 'px', 'nx', 'py', 'ny'].filter((k) => f >= 2 || k !== 'pz')); // 每層的線腳
  // ---- 陽台（2–4 樓，正面右邊）：地、女兒牆、天花板、落地門、冷氣 ----
  for (let f = 1; f <= 3; f++) {
    const y = f * FH;
    FL.bx(BX0, HX, y - 0.14, y, BZ, HZ, conc, ['py', 'ny', 'pz']); // 樓板（陽台地＋底）
    TI.bx(BX0, HX, y, y + PAR, HZ - 0.12, HZ, tile, ['pz', 'nz', 'py']); // 女兒牆
    FL.bx(BX0, HX, y + PAR, y + PAR + 0.05, HZ - 0.16, HZ + 0.02, conc2); // 壓頂
    FL.bx(BX0, HX, y + FH - 0.14, y + FH - 0.13, BZ, HZ, under, ['ny']); // 天花板（上一層的樓板底）
    GL.bx(BX0 + 1.0, BX0 + 3.6, y, y + 2.3, BZ, BZ + 0.03, dark); MT.bx(BX0 + 1.0, BX0 + 3.6, y + 2.3, y + 2.36, BZ, BZ + 0.06, al); MT.bx(BX0 + 2.28, BX0 + 2.32, y, y + 2.3, BZ, BZ + 0.05, al); // 落地門
    GL.bx(BX0 + 4.1, BX0 + 5.5, y + 0.9, y + 2.2, BZ, BZ + 0.03, dark); MT.bx(BX0 + 4.1, BX0 + 5.5, y + 2.2, y + 2.26, BZ, BZ + 0.06, al); // 窗
    WH.bx(HX - 1.1, HX - 0.3, y + 0.05, y + 0.6, HZ - 0.55, HZ - 0.15, white); // 冷氣室外機
  }
  // ---- 窗：正面左邊、兩側、後面（每層）；玻璃貼在牆外 2 公分＋鋁框 ----
  const win = (face, a, b, y0, y1) => { // face：'pz' z=HZ、'nz' z=−HZ、'px' x=HX、'nx' x=−HX；a…b 沿牆的位置
    const o = 0.02, f = 0.05;
    if (face === 'pz' || face === 'nz') { const z = face === 'pz' ? HZ + o : -HZ - o, z1 = face === 'pz' ? HZ + o + f : -HZ - o - f; GL.bx(a, b, y0, y1, Math.min(z, z1 - 0.01), Math.max(z, z1 - 0.01), dark); MT.bx(a - f, b + f, y1, y1 + f, Math.min(z, z1), Math.max(z, z1), al); MT.bx(a - f, b + f, y0 - f, y0, Math.min(z, z1), Math.max(z, z1), al); MT.bx(a - f, a, y0, y1, Math.min(z, z1), Math.max(z, z1), al); MT.bx(b, b + f, y0, y1, Math.min(z, z1), Math.max(z, z1), al); }
    else { const x = face === 'px' ? HX + o : -HX - o, x1 = face === 'px' ? HX + o + f : -HX - o - f; GL.bx(Math.min(x, x1 - 0.01), Math.max(x, x1 - 0.01), y0, y1, a, b, dark); MT.bx(Math.min(x, x1), Math.max(x, x1), y1, y1 + f, a - f, b + f, al); MT.bx(Math.min(x, x1), Math.max(x, x1), y0 - f, y0, a - f, b + f, al); MT.bx(Math.min(x, x1), Math.max(x, x1), y0, y1, a - f, a, al); MT.bx(Math.min(x, x1), Math.max(x, x1), y0, y1, b, b + f, al); }
  };
  for (let f = 0; f < NF; f++) {
    const y = f * FH + 0.95, y1 = f * FH + 2.35;
    win('pz', -5.0, -3.4, y, y1); win('pz', -2.6, -1.0, y, y1); // 正面左半：房間、廚房的窗
    if (f === 4) win('pz', 0.8, 2.6, y, y1), win('pz', 3.4, 5.0, y, y1); // 五樓右半
    win('px', 1.0, 2.6, y, y1); win('px', 4.0, 5.4, y, y1); win('px', -4.6, -3.2, y, y1); // 右側
    win('nx', -5.4, -4.0, y, y1); win('nx', -2.6, -1.0, y, y1); win('nx', 2.2, 3.8, y, y1); // 左側
    win('nz', 1.2, 3.0, y, y1); win('nz', 4.0, 5.2, y + 0.3, y1); win('nz', -5.2, -4.4, y + 0.4, y1); // 後面：走廊、廚房、廁所的窗
  }
  // ---- 一樓大門：玻璃雙開門＋雨遮＋門階＋門牌燈；信箱在裡面（interiors.js）----
  GL.bx(-1.0, 1.0, 0.05, 2.4, HZ + 0.02, HZ + 0.05, col3('#2a3440')); MT.bx(-1.08, 1.08, 2.4, 2.5, HZ, HZ + 0.08, al); MT.bx(-0.03, 0.03, 0.05, 2.4, HZ, HZ + 0.07, al); MT.bx(-1.08, -1.0, 0, 2.5, HZ, HZ + 0.08, al); MT.bx(1.0, 1.08, 0, 2.5, HZ, HZ + 0.08, al);
  FL.bx(-1.8, 1.8, 2.75, 2.9, HZ, HZ + 1.3, conc2); FL.bx(-1.8, 1.8, 0, 0.14, HZ, HZ + 0.5, conc2, ['py', 'pz', 'px', 'nx']); // 雨遮、門階
  WH.bx(-0.3, 0.3, 2.95, 3.1, HZ + 0.02, HZ + 0.12, white); // 門牌（字 town.src.js／net.src.js 以後再掛）
  // ---- 頂樓：女兒牆、樓梯間（上面水塔）、曬衣架、盆栽、冷氣 ----
  TI.bx(-HX, HX, H, H + PAR, HZ - 0.15, HZ, tile, ['pz', 'nz', 'py']); TI.bx(-HX, HX, H, H + PAR, -HZ, -HZ + 0.15, tile, ['pz', 'nz', 'py']);
  TI.bx(-HX, -HX + 0.15, H, H + PAR, -HZ, HZ, tile, ['px', 'nx', 'py']); TI.bx(HX - 0.15, HX, H, H + PAR, -HZ, HZ, tile, ['px', 'nx', 'py']);
  FL.bx(-HX - 0.03, HX + 0.03, H + PAR, H + PAR + 0.05, -HZ - 0.03, HZ + 0.03, conc2, ['py', 'pz', 'nz', 'px', 'nx']); // 壓頂
  TI.bx(head.x0, head.x1, H, H + head.h, head.z0, head.z1, tile2, ['px', 'nx', 'pz', 'nz']); FL.bx(head.x0 - 0.05, head.x1 + 0.05, H + head.h, H + head.h + 0.12, head.z0 - 0.05, head.z1 + 0.05, conc2); // 樓梯間
  MT.bx(head.x1 - 0.02, head.x1 + 0.04, H, H + 2.05, -4.5, -3.5, col3('#6f7580')); // 樓梯間的鐵門（朝 +x；走出來在 x −1.7 外面）
  const tk = { x: (head.x0 + head.x1) / 2, z: (head.z0 + head.z1) / 2, y: H + head.h + 0.12 };
  for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) MT.bx(tk.x + dx - 0.04, tk.x + dx + 0.04, tk.y, tk.y + 0.5, tk.z + dz - 0.04, tk.z + dz + 0.04, col3('#7d8288'));
  WH.cyl(tk.x, tk.z, tk.y + 0.5, tk.y + 1.9, 0.8, 0.8, col3('#e6e8ea'), 14); WH.cyl(tk.x, tk.z, tk.y + 1.9, tk.y + 2.15, 0.8, 0.25, col3('#d5d8db'), 14); // 水塔（不鏽鋼）
  for (const x of [1.5, 4.5]) { // 曬衣架：兩支竿子＋三條線＋衣服
    for (const z of [-5.5, -2.5]) MT.cyl(x, z, H, H + 1.7, 0.02, 0.02, al, 6, false);
    for (const dy of [1.68, 1.45]) MT.bx(x - 0.01, x + 0.01, H + dy, H + dy + 0.02, -5.5, -2.5, al);
    [['#f2c230', -5.0], ['#2f6fd6', -4.3], ['#f28cb1', -3.6], ['#e9ecef', -3.0]].forEach(([c, z]) => WH.quad([x + 0.02, H + 0.9, z], [x + 0.02, H + 0.9, z + 0.45], [x + 0.02, H + 1.66, z + 0.45], [x + 0.02, H + 1.66, z], col3(c)));
    [['#f2c230', -5.0], ['#2f6fd6', -4.3], ['#f28cb1', -3.6], ['#e9ecef', -3.0]].forEach(([c, z]) => WH.quad([x - 0.02, H + 0.9, z + 0.45], [x - 0.02, H + 0.9, z], [x - 0.02, H + 1.66, z], [x - 0.02, H + 1.66, z + 0.45], col3(c)));
  }
  for (const [x, z] of [[4.9, 6.2], [-4.9, 6.2], [-4.9, 3.6]]) { WH.cyl(x, z, H, H + 0.42, 0.22, 0.26, col3('#b5694a'), 8); WH.cyl(x, z, H + 0.42, H + 1.1, 0.1, 0.42, col3('#4f8a3a'), 7); } // 盆栽（簡單的錐）
  WH.bx(2.6, 3.4, H, H + 0.6, 6.4, 6.9, white); // 冷氣室外機
  // ---- 碰撞（本地）----
  const cols = [{ t: 'box', x: 0, z: 0, hx: HX, hz: HZ, rot: 0, h: H + PAR, noCrush: true }, { t: 'box', x: 0, z: HZ + 0.25, hx: 1.8, hz: 0.25, rot: 0, h: 0.14 }]; // 整棟、門階（擋車不擋人）
  // 頂樓那一層：女兒牆、樓梯間、水塔的腳（都只在頂樓加）
  const roofCols = [
    { t: 'box', x: 0, z: HZ - 0.075, hx: HX, hz: 0.075, rot: 0, h: H + PAR }, { t: 'box', x: 0, z: -HZ + 0.075, hx: HX, hz: 0.075, rot: 0, h: H + PAR },
    { t: 'box', x: -HX + 0.075, z: 0, hx: 0.075, hz: HZ, rot: 0, h: H + PAR }, { t: 'box', x: HX - 0.075, z: 0, hx: 0.075, hz: HZ, rot: 0, h: H + PAR },
    { t: 'box', x: (head.x0 + head.x1) / 2, z: (head.z0 + head.z1) / 2, hx: (head.x1 - head.x0) / 2, hz: (head.z1 - head.z0) / 2, rot: 0, h: H + head.h + 2.3 },
    { t: 'box', x: 3.0, z: 6.65, hx: 0.4, hz: 0.25, rot: 0, h: H + 0.6 }, ...[[4.9, 6.2], [-4.9, 6.2], [-4.9, 3.6]].map(([x, z]) => ({ t: 'circle', x, z, r: 0.3, h: H + 1.1 })),
    ...[1.5, 4.5].flatMap((x) => [-5.5, -2.5].map((z) => ({ t: 'circle', x, z, r: 0.06, h: H + 1.7 }))),
  ];
  const roof = { y: H, zone: { x: 0, z: 0, hx: HX - 0.3, hz: HZ - 0.3 }, cols: roofCols, spawn: { x: head.x1 + 1.1, z: -2.2, lh: 0 }, door: { x: head.x1 + 0.02, z: -4.0, ry: Math.PI / 2, w: 0.5 }, ceil: null }; // door.ry＝門朝外（本地 +x；walk.js：往 −(sin ry, cos ry) 走＝進去）
  // 4 樓的陽台：地 y＝BALY、內牆 z＝BZ、女兒牆 z HZ−0.12、左邊牆 x BX0、右邊＝外牆；天花板 y BALY + FH − 0.14
  const balCols = [
    { t: 'box', x: 0, z: (BZ - HZ) / 2, hx: HX, hz: (BZ + HZ) / 2, rot: 0, h: ROOFY }, // 落地門那面牆以後面整層（陽台只有 z BZ…HZ）
    { t: 'box', x: 0, z: HZ - 0.06, hx: HX, hz: 0.06, rot: 0, h: BALY + PAR }, { t: 'box', x: BX0 - 0.1, z: (BZ + HZ) / 2, hx: 0.1, hz: (HZ - BZ) / 2, rot: 0, h: ROOFY }, { t: 'box', x: HX + 0.1, z: (BZ + HZ) / 2, hx: 0.1, hz: (HZ - BZ) / 2, rot: 0, h: ROOFY },
    { t: 'box', x: HX - 0.7, z: HZ - 0.35, hx: 0.4, hz: 0.2, rot: 0, h: BALY + 0.6 }, // 冷氣
    { t: 'box', x: 0, z: (BZ + HZ) / 2, hx: HX, hz: (HZ - BZ) / 2, rot: 0, y0: BALY + FH - 0.14, h: ROOFY }, // 天花板（只擋鏡頭）
  ];
  const balc = { y: BALY, zone: { x: (BX0 + HX) / 2, z: (BZ + HZ) / 2, hx: (HX - BX0) / 2 - 0.1, hz: (HZ - BZ) / 2 - 0.05 }, cols: balCols, spawn: { x: BX0 + 4.3, z: BZ + 0.85, lh: -Math.PI / 2 }, door: { x: BX0 + 2.3, z: BZ + 0.03, ry: 0, w: 1.3, lh: Math.PI / 2 }, ceil: BALY + FH - 0.3 };
  const mk = (name, M, material) => ({ name, geometry: M.geometry(), material });
  const parts = [
    mk('apt-tile', TI, new THREE.MeshStandardMaterial({ map: tileTex(), vertexColors: true, roughness: 0.85, metalness: 0 })),
    mk('apt-conc', FL, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 })),
    mk('apt-glass', GL, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.7 })),
    mk('apt-metal', MT, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.6 })),
    mk('apt-white', WH, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 })),
  ];
  return { parts, tris: TI.tris + FL.tris + GL.tris + MT.tris + WH.tris, cols, roof, balc };
}
