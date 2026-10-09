// ---- 越野車車庫（第 6 批）：你家旁邊的越野車專屬停車位 ----
// Nick 2026-10-07：「越野車專屬位」＝家裡要有越野車（怪獸卡車⋯）專門停的地方
// 越野車（PERF.big：怪獸卡車 3.81 公尺寬、2.98 公尺高）停不上車庫的升降機，本來停在鐵捲門前面的水泥地（大車位，只有兩格）；
//   以後還有吉普車、小型越野車、皮卡、沙灘車 → 蓋一棟自己的車庫：白色大理石的車庫旁邊（西邊）一棟同樣款式、有自己鐵捲門的附屬車庫，裡面四個停車格
// 位置（世界座標，跟車庫一樣是正的長方形）：外牆 x −342…−320、z −109…−91.5（22 × 17.5 公尺），裡面淨高 5 公尺
//   旁邊（東邊）x −320…−313 是新的水泥車道，往南接到車庫前面的前庭（村子的花台縮短了一點，見 village.js「第 6 批」那一行）
//   鐵捲門在東邊那面牆（面向車道）：z −101…−94（寬 7 公尺）、高 4.4 公尺；門上面掛「越野車專用」
//   四個停車格靠北牆（車頭朝北開進去）：4.6 公尺寬 × 7.5 公尺深，黃線框起來、地上寫「越野車」；南邊 9.4 公尺的通道（怪獸卡車 7.3 公尺長，倒車出格轉得過來）
//   東邊牆邊（門旁邊）輪胎架，南牆邊工具牆＋工作台；地上幾塊泥巴（越野車帶回來的）
// 檢查過沒有壓到別的東西：村子的房子（西邊那排 z −89.5…−77）、圍籬（z −113 的邊界）、稻田（x ≤ −344）、
//   北邊那排樹（z −110.3 以北）、車庫（x −313…−287）、往內湖的聯外道路（村子南邊 x −112）、越野車場的水泥路（都在村子南邊）、
//   路上的車和居民的路線（npc.js 的 lane／walk graph 在大路、村子的街上，這一帶一條都沒有）
// 【API】
//   await orbayFonts();                      招牌的中文字（跟 villageFonts 一起等）
//   const OB = buildOrbay(V, { renderer });   V＝buildVillage() 回傳的（offroad／circuit／neihu 之後叫）
//     V 多了：V.places.orbay、V.colliders 多了牆和架子、V.areas.pave 多了地板和車道、V.roads 多一條車道（kind 'drive'：路上的車不走）、
//             V.buildings 多一棟（kind 'garage'，沒有門：走進房子、居民、車流都不理它）、V.info.orbay；V.surfaceAt 包一層（地板、車道算水泥地 3）
//   OB.door：鐵捲門 { t（0 關…1 開）, open(sec), close(sec), update(dt) → 還在動就 true, moving }（用法跟 room.js 的門一樣）
//   OB.bays：四個停車格停車的位置 [{ x, z, heading }]（世界座標、車子原點，車頭朝北）；OB.zones.bays[i]＝那一格的長方形
//   OB.zones：{ inside（裡面的地板）, aisle（通道）, apron（門外的車道）, door（門口：站在這裡給「開鐵捲門」）, bays }
//   OB.doorCols(open)：門的碰撞（門關著才有；開車、走路都要）；OB.cull(camera)：鏡頭在裡面而且比屋頂高就不畫屋頂
//   OB.update(dt)：門在動（每一格叫）；OB.signs：牆上、地上寫的字；OB.info：{ meshes, tris, ms }；OB.dispose()
// 效能：全部合併成 6 個網格（裡面、外殼、屋頂、招牌／地上的字、燈、鐵捲門片 InstancedMesh）＝ 6 個 draw call、1044 個三角形
import * as THREE from 'three';

// 打包（build-art.mjs、build-app.mjs）：跟 offroad.js 一樣整個包在一個函式裡，只露出下面這些名字
export const { buildOrbay, orbayFonts, ORBAY_TEXT } = (() => {
const TAU = Math.PI * 2;
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", "WenQuanYi Zen Hei", sans-serif';
const CC = new Map();
const C = (hex) => { let v = CC.get(hex); if (!v) { const c = new THREE.Color(hex); v = [c.r, c.g, c.b]; CC.set(hex, v); } return v; }; // 線性顏色
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// ---- 合併網格（同材質的三角形放一起；跟 offroad.js 一樣）----
class PB {
  constructor() { this.bins = new Map(); this.tris = 0; }
  tri(m, a, b, c, col, ta, tb, tc) {
    let g = this.bins.get(m);
    if (!g) this.bins.set(m, (g = { m, p: [], n: [], u: [], c: [] }));
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-12) return;
    nx /= l; ny /= l; nz /= l;
    g.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); g.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz); g.c.push(...col, ...col, ...col);
    if (ta) g.u.push(ta[0], ta[1], tb[0], tb[1], tc[0], tc[1]); else g.u.push(0, 0, 0, 0, 0, 0);
    this.tris++;
  }
  quad(m, a, b, c, d, col, uv) { if (uv) { const [u0, v0, u1, v1] = uv; this.tri(m, a, b, c, col, [u0, v0], [u1, v0], [u1, v1]); this.tri(m, a, c, d, col, [u0, v0], [u1, v1], [u0, v1]); } else { this.tri(m, a, b, c, col); this.tri(m, a, c, d, col); } }
  build(mats, tag) {
    const out = {}; let n = 0;
    for (const g of this.bins.values()) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3));
      if (mats[g.m].map) geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.u, 2));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mats[g.m]); mesh.matrixAutoUpdate = false; mesh.name = tag + g.m; out[g.m] = mesh; n++;
    }
    return { meshes: out, n };
  }
}

// ---- 尺寸（世界座標；x 往東、z 往南）----
const G = {
  X0: -342, X1: -320, Z0: -109, Z1: -91.5, WT: 0.3,   // 外牆面、牆厚（南牆 z −91.5：西邊那排透天厝在 z −89.5 以南，留 2 公尺）
  CEIL: 5, ROOF: 5.3, TOP: 5.8,                        // 天花板、屋頂板上面、女兒牆頂
  DZ0: -101, DZ1: -94, DH: 4.4, XD: -320.1,            // 鐵捲門（東牆）：開口 z、門高、門片平面
  N: 4, BW: 4.6, BD: 7.5,                              // 四格、一格寬、一格深
  LX0: -320, LX1: -313, LZ0: -109, LZ1: -86.5,         // 門外的水泥車道（往南接前庭）
};
const IX0 = G.X0 + G.WT, IX1 = G.X1 - G.WT, IZ0 = G.Z0 + G.WT, IZ1 = G.Z1 - G.WT; // 裡面
const BZ1 = IZ0 + G.BD;                                                            // 停車格的格口（通道那一邊）
const bayX = (i) => IX0 + G.BW / 2 + i * G.BW;                                     // 第 i 格的中心
const SIGNS = { wall: '越野車專用', bay: '越野車', tool: '工具', tyre: '輪胎', name: '越野車車庫' };
const ORBAY_TEXT = [...new Set(Object.values(SIGNS).join('').split('').filter((ch) => ch.charCodeAt(0) > 0x2e80))].join('');
function orbayFonts(ms = 1500) {
  const f = typeof document !== 'undefined' && document.fonts;
  if (!f || !f.load) return Promise.resolve();
  const all = f.load(`700 64px ${SANS}`, ORBAY_TEXT).catch(() => {});
  return Promise.race([all, new Promise((r) => setTimeout(r, ms))]);
}

// ---- 招牌、地上的字（一張 512 × 256 的貼圖）----
function signAtlas() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const uv = {}, reg = (k, x, y, w, h, draw) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); draw(g, w, h); g.restore(); uv[k] = [x / 512, 1 - (y + h) / 256, (x + w) / 512, 1 - y / 256]; };
  const T = (g2, s, x, y, px, col, max) => { g2.fillStyle = col; g2.font = `700 ${px}px ${SANS}`; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(s, x, y, max); };
  g.clearRect(0, 0, 512, 256);
  reg('wall', 0, 0, 512, 128, (g2, w, h) => { // 門上面的招牌：深色底、橘字（跟車庫的招牌同一個調）
    g2.fillStyle = '#1d1f23'; g2.fillRect(0, 0, w, h);
    g2.fillStyle = '#FF6A1F'; g2.fillRect(0, h - 9, w, 9);
    T(g2, SIGNS.wall, w / 2, h / 2 - 2, 76, '#FF6A1F', w - 40);
  });
  reg('bay', 0, 128, 320, 96, (g2, w, h) => T(g2, SIGNS.bay, w / 2, h / 2 + 2, 76, '#f2c230', w - 16)); // 地上寫的（透明底）
  reg('tool', 320, 128, 96, 96, (g2, w, h) => { g2.fillStyle = '#2f343b'; g2.fillRect(0, 0, w, h); T(g2, SIGNS.tool, w / 2, h / 2 + 2, 42, '#e9ecef', w - 10); });
  reg('tyre', 416, 128, 96, 96, (g2, w, h) => { g2.fillStyle = '#2f343b'; g2.fillRect(0, 0, w, h); T(g2, SIGNS.tyre, w / 2, h / 2 + 2, 42, '#e9ecef', w - 10); });
  return { c, uv };
}

function buildOrbay(V, o = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const aniso = o.renderer?.capabilities?.getMaxAnisotropy ? Math.min(4, o.renderer.capabilities.getMaxAnisotropy()) : 1;
  const SA = signAtlas(), U = SA.uv;
  const tSign = new THREE.CanvasTexture(SA.c); tSign.colorSpace = THREE.SRGBColorSpace; tSign.anisotropy = aniso;
  const mats = {
    main: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }),       // 裡面（地板、牆的內面、架子）
    ext: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.02 }),      // 外殼（白色大理石的外牆）
    roof: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 }),       // 屋頂＋天花板（鏡頭跑到屋頂上面就不畫）
    sign: new THREE.MeshStandardMaterial({ map: tSign, vertexColors: true, roughness: 0.6, alphaTest: 0.45, emissive: 0xffffff, emissiveMap: tSign, emissiveIntensity: 0.16, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),                                          // 燈（自己發光的面）
  };
  // 裡面（地板、牆的內面、天花板）沒有太陽照進來，只靠環境光會灰灰的一片：加一點自己發的光（當作日光燈把裡面照亮；不多畫一次、不多一盞燈）
  for (const [k, w] of [['main', '0.34'], ['roof', '0.16']]) { // 屋頂的外面也會亮一點點：所以少一點
    mats[k].onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * ${w};`); };
    mats[k].customProgramCacheKey = () => 'orbay-' + k;
  }
  const B = new PB(), colliders = [], WHITE = [1, 1, 1];
  const addBox = (x, z, hx, hz, h, y0) => { const c = { t: 'box', x, z, hx, hz, rot: 0, h }; if (y0) c.y0 = y0; colliders.push(c); return c; };
  // 方塊（世界座標 [x0, y0, z0, x1, y1, z1]）；col：顏色或 { px, nx, pz, nz, py, ny, _ }；uv：哪一面貼招牌
  const box = (m, b, col, uv = {}) => {
    const [x0, y0, z0, x1, y1, z1] = b, P = (x, y, z) => [x, y, z], cc = (k) => (Array.isArray(col) ? col : col[k] || col._ || WHITE);
    const f = (k, a, bb, c2, d) => { if (uv[k] === false) return; const mm = uv[k] ? 'sign' : m; B.quad(mm, P(...a), P(...bb), P(...c2), P(...d), uv[k] ? WHITE : cc(k), uv[k] || null); };
    f('pz', [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); f('nz', [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    f('px', [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]); f('nx', [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    f('py', [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    f('ny', [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  };
  const flat = (m, x0, z0, x1, z1, y, col, uv) => B.quad(uv ? 'sign' : m, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], uv ? WHITE : col, uv); // 平放的面（朝上）
  const flatD = (m, x0, z0, x1, z1, y, col) => B.quad(m, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], col);                                 // 平放的面（朝下：天花板的燈）
  const cyl = (m, x, z, y0, y1, r, n, col) => { // 直的圓柱
    const p = (ang, y) => [x + Math.cos(ang) * r, y, z - Math.sin(ang) * r];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, b2 = ((i + 1) / n) * TAU;
      B.quad(m, p(a, y0), p(b2, y0), p(b2, y1), p(a, y1), col);
      B.tri(m, p(a, y1), p(b2, y1), [x, y1, z], col);
    }
  };
  // 躺著的輪胎（輪胎架上）：一圈一圈的厚圓環，簡單一點：矮圓柱
  const tyre = (x, y, z, r, w, col) => {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, b2 = ((i + 1) / n) * TAU;
      const p = (ang, zz) => [x + Math.cos(ang) * r, y + Math.sin(ang) * r, zz];
      B.quad('main', p(a, z - w / 2), p(b2, z - w / 2), p(b2, z + w / 2), p(a, z + w / 2), col);
      const q = (ang, rr, zz) => [x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, zz];
      B.quad('main', q(b2, r, z + w / 2), q(a, r, z + w / 2), q(a, r * 0.45, z + w / 2), q(b2, r * 0.45, z + w / 2), mul(col, 0.8));
      B.quad('main', q(a, r, z - w / 2), q(b2, r, z - w / 2), q(b2, r * 0.45, z - w / 2), q(a, r * 0.45, z - w / 2), mul(col, 0.8));
    }
  };

  const WALL = C('#f4f3ef'), WALL_IN = C('#e7e6e1'), TRIM = C('#9a9b9d'), FLOOR = C('#b9b8b3'), DARK = C('#2f343b'), STEEL = C('#8d9197');
  const MUD = C('#584530'), YEL = C('#f2c230'), ORANGE = C('#FF6A1F');

  // ---- 地板、車道 ----
  flat('main', IX0, IZ0, IX1, IZ1, 0.03, FLOOR);                          // 裡面的水泥地板
  flat('main', G.LX0, G.LZ0, G.LX1, G.LZ1, 0.028, mul(FLOOR, 0.97));      // 門外的車道（往南接前庭）
  // 停車格：黃線（四邊）＋地上寫「越野車」
  const LW = 0.12;
  for (let i = 0; i < G.N; i++) {
    const cx = bayX(i), x0 = cx - G.BW / 2 + 0.1, x1 = cx + G.BW / 2 - 0.1, z0 = IZ0 + 0.1, z1 = BZ1 - 0.1;
    flat('main', x0, z0, x1, z0 + LW, 0.034, YEL); flat('main', x0, z1 - LW, x1, z1, 0.034, YEL);
    flat('main', x0, z0, x0 + LW, z1, 0.034, YEL); flat('main', x1 - LW, z0, x1, z1, 0.034, YEL);
    flat('main', cx - 1.5, z1 - 2.4, cx + 1.5, z1 - 1.5, 0.036, null, U.bay); // 「越野車」（從門口看是正的）
  }
  // 泥巴（越野車帶回來的）：門口、格口幾塊
  for (const [mx, mz, hx, hz] of [[-322.5, -97.5, 1.4, 1.1], [-327, -100.4, 1.8, 0.8], [-332.5, -101.6, 1.2, 0.9], [-338.6, -102.2, 1.5, 0.7], [-318.5, -97.5, 1.6, 1.3]])
    flat('main', mx - hx, mz - hz, mx + hx, mz + hz, 0.032, MUD);

  // ---- 牆（外面白色大理石、裡面淺灰；h 5.2 的碰撞：小地圖畫得出來）----
  // 南北兩面整條、東西兩面縮進去（兩面牆不要有重疊的面：會閃）
  box('ext', [G.X0, 0, G.Z0 + G.WT, G.X0 + G.WT, G.TOP, G.Z1 - G.WT], { _: WALL, px: WALL_IN, py: TRIM });         // 西牆
  box('ext', [G.X0, 0, G.Z0, G.X1, G.TOP, G.Z0 + G.WT], { _: WALL, pz: WALL_IN, py: TRIM });                       // 北牆
  box('ext', [G.X0, 0, G.Z1 - G.WT, G.X1, G.TOP, G.Z1], { _: WALL, nz: WALL_IN, py: TRIM });                       // 南牆
  box('ext', [G.X1 - G.WT, 0, G.Z0 + G.WT, G.X1, G.TOP, G.DZ0], { _: WALL, nx: WALL_IN, py: TRIM });               // 東牆（門北邊）
  box('ext', [G.X1 - G.WT, 0, G.DZ1, G.X1, G.TOP, G.Z1 - G.WT], { _: WALL, nx: WALL_IN, py: TRIM });               // 東牆（門南邊）
  box('ext', [G.X1 - G.WT, G.DH, G.DZ0, G.X1, G.TOP, G.DZ1], { _: WALL, nx: WALL_IN, py: TRIM, px: WALL });        // 門上面那塊牆
  addBox(G.X0 + G.WT / 2, (G.Z0 + G.Z1) / 2, G.WT / 2, (G.Z1 - G.Z0) / 2, 5.2);
  addBox((G.X0 + G.X1) / 2, G.Z0 + G.WT / 2, (G.X1 - G.X0) / 2, G.WT / 2, 5.2);
  addBox((G.X0 + G.X1) / 2, G.Z1 - G.WT / 2, (G.X1 - G.X0) / 2, G.WT / 2, 5.2);
  addBox(G.X1 - G.WT / 2, (G.Z0 + G.DZ0) / 2, G.WT / 2, (G.DZ0 - G.Z0) / 2, 5.2);
  addBox(G.X1 - G.WT / 2, (G.DZ1 + G.Z1) / 2, G.WT / 2, (G.Z1 - G.DZ1) / 2, 5.2);
  // 屋頂板＋天花板（埋進牆裡 0.15 公尺，不會跟牆有重疊的面）：鏡頭跑到屋頂上面就不畫
  box('roof', [IX0 - 0.15, G.CEIL, IZ0 - 0.15, IX1 + 0.15, G.ROOF, IZ1 + 0.15], { _: mul(WALL, 0.96), py: C('#dcdcd6'), ny: C('#eeeeea') });
  // 門口的門檻、導軌、捲筒盒、警示燈
  box('main', [G.X1 - 0.34, 0.03, G.DZ0 - 0.02, G.X1 - 0.02, 0.07, G.DZ1 + 0.02], STEEL);                                   // 不鏽鋼門檻
  for (const z of [G.DZ0 - 0.02, G.DZ1 - 0.1]) box('main', [G.XD - 0.14, 0, z, G.XD + 0.08, G.DH + 0.12, z + 0.12], DARK);  // 兩邊導軌
  box('main', [G.XD - 0.46, G.DH + 0.04, G.DZ0 - 0.14, G.X1 - 0.02, G.DH + 0.62, G.DZ1 + 0.14], { _: C('#e9e9e4'), ny: TRIM }); // 捲筒盒
  for (const z of [G.DZ0 - 0.3, G.DZ1 + 0.3]) box('glow', [G.X1 - 0.06, G.DH + 0.16, z - 0.09, G.X1 + 0.06, G.DH + 0.34, z + 0.09], [1.5, 0.95, 0.15]); // 門邊的黃色警示燈
  // 招牌「越野車專用」（門上面、外面那一側）
  box('ext', [G.X1 + 0.02, G.DH + 0.72, G.DZ0 + 0.2, G.X1 + 0.14, G.TOP - 0.18, G.DZ1 - 0.2], { _: C('#1d1f23') }, { px: U.wall });
  for (const z of [G.DZ0 + 0.9, G.DZ1 - 0.9]) box('glow', [G.X1 + 0.16, G.TOP - 0.3, z - 0.5, G.X1 + 0.3, G.TOP - 0.2, z + 0.5], [1.4, 1.35, 1.2]); // 招牌的投射燈

  // ---- 燈（天花板的燈條，朝下）：一格一條、通道兩條 ----
  for (let i = 0; i < G.N; i++) flatD('glow', bayX(i) - 0.38, IZ0 + 1.2, bayX(i) + 0.38, BZ1 - 1.2, G.CEIL - 0.05, [1.45, 1.42, 1.3]);
  for (const z of [IZ1 - 2.2, IZ1 - 5.6]) flatD('glow', IX0 + 1.5, z - 0.32, IX1 - 1.5, z + 0.32, G.CEIL - 0.05, [1.45, 1.42, 1.3]);

  // ---- 輪胎架（門旁邊、東牆邊）、工具牆＋工作台（南牆邊）----
  const RX = IX1 - 0.55; // 輪胎架中心
  for (const z of [-107.4, -103.2]) box('main', [RX - 0.5, 0, z - 0.06, RX + 0.5, 2.2, z + 0.06], STEEL);           // 兩根立柱
  for (const y of [0.6, 1.5]) box('main', [RX - 0.5, y, -107.5, RX + 0.5, y + 0.08, -103.1], STEEL);                // 兩層架板
  for (const [y, z] of [[0.98, -106.8], [0.98, -105.5], [0.98, -104.2], [1.88, -106.8], [1.88, -105.5], [1.88, -104.2]]) tyre(RX, y, z, 0.38, 0.3, C('#1b1c1e'));
  box('main', [RX - 0.52, 2.2, -105.6, RX + 0.52, 2.72, -104.6], { _: C('#2f343b') }, { nx: U.tyre });
  addBox(RX, -105.3, 0.62, 2.3, 2.3);
  const TW0 = IX0 + 0.4, TW1 = IX0 + 5.4; // 工具牆（南牆）
  box('main', [TW0, 1.05, IZ1 - 0.12, TW1, 2.65, IZ1 - 0.02], { _: C('#2a5a8f'), nz: C('#36699e') });
  for (let i = 0; i < 9; i++) { const x = TW0 + 0.45 + i * 0.55; box('main', [x - 0.05, 1.35 + (i % 3) * 0.42, IZ1 - 0.2, x + 0.05, 1.72 + (i % 3) * 0.42, IZ1 - 0.12], STEEL); } // 掛著的工具
  box('main', [TW0 + 1.6, 2.72, IZ1 - 0.14, TW0 + 2.6, 3.4, IZ1 - 0.04], { _: C('#2f343b') }, { nz: U.tool });
  box('main', [TW0, 0.8, IZ1 - 0.78, TW1, 0.92, IZ1 - 0.04], C('#8a8f96'));                                          // 工作台（檯面）
  box('main', [TW0 + 0.08, 0, IZ1 - 0.74, TW0 + 0.9, 0.8, IZ1 - 0.08], C('#c9ccd1')); box('main', [TW1 - 0.9, 0, IZ1 - 0.74, TW1 - 0.08, 0.8, IZ1 - 0.08], C('#c9ccd1')); // 工具櫃
  addBox((TW0 + TW1) / 2, IZ1 - 0.41, (TW1 - TW0) / 2, 0.37, 0.95);
  // 牆邊的油桶兩個（西北角）
  for (const z of [IZ0 + 1.1, IZ0 + 2.0]) { cyl('main', IX0 + 0.42, z, 0, 0.88, 0.28, 10, C('#c23b22')); addBox(IX0 + 0.42, z, 0.3, 0.3, 0.9); }

  // ---- 鐵捲門（InstancedMesh：22 片，捲到門上面的捲筒盒裡）----
  const SLAT = 0.2, NS = Math.ceil(G.DH / SLAT) + 1, YT = G.DH + 0.26, R0 = 0.2, HW = (G.DZ1 - G.DZ0) / 2 + 0.07;
  const slatGeo = () => { // 本地：x 往外（東）、y 上、z 沿著門片
    const P = [], N = [], Cv = [], push = (a, b2, c2, d, nx, ny, col) => {
      for (const q of [a, b2, c2, a, c2, d]) P.push(q[0], q[1], q[2]);
      for (let i = 0; i < 6; i++) { N.push(nx, ny, 0); Cv.push(col[0], col[1], col[2]); }
    };
    const out = C('#f1f1ee'), inn = C('#b9bcc0'), edge = C('#8f9398');
    push([0.03, -SLAT / 2, -HW], [0.03, -SLAT / 2, HW], [0.03, SLAT / 2 - 0.02, HW], [0.03, SLAT / 2 - 0.02, -HW], 1, 0, out);   // 外面
    push([-0.03, -SLAT / 2, HW], [-0.03, -SLAT / 2, -HW], [-0.03, SLAT / 2 - 0.02, -HW], [-0.03, SLAT / 2 - 0.02, HW], -1, 0, inn); // 裡面
    push([-0.03, SLAT / 2 - 0.02, -HW], [-0.03, SLAT / 2 - 0.02, HW], [0.03, SLAT / 2 - 0.02, HW], [0.03, SLAT / 2 - 0.02, -HW], 0, 1, edge); // 上緣（溝）
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cv, 3));
    return g;
  };
  const doorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.2 });
  const slats = new THREE.InstancedMesh(slatGeo(), doorMat, NS);
  slats.frustumCulled = false; slats.name = 'orbayDoor';
  const DS = { t: 0, target: 0, speed: 1 }, ZC = (G.DZ0 + G.DZ1) / 2;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), ZAX = new THREE.Vector3(0, 0, 1);
  function layoutDoor() { // 最下面那片的底在 t × 門高；超過捲筒切點的捲進盒子裡
    const yb = DS.t * G.DH, Lh = YT - yb;
    for (let i = 0; i < NS; i++) {
      const u = (i + 0.5) * SLAT;
      if (u <= Lh) { _p.set(G.XD, yb + u, ZC); _q.identity(); }
      else { const w = u - Lh, r = Math.max(0.08, R0 - (0.02 * w) / (TAU * R0)), ph = w / r; _p.set(G.XD - R0 + r * Math.cos(ph), YT + r * Math.sin(ph), ZC); _q.setFromAxisAngle(ZAX, -ph); }
      _m.compose(_p, _q, _s); slats.setMatrixAt(i, _m);
    }
    slats.instanceMatrix.needsUpdate = true;
  }
  const door = {
    get t() { return DS.t; }, set t(v) { DS.t = DS.target = Math.max(0, Math.min(1, +v || 0)); layoutDoor(); },
    get moving() { return DS.t !== DS.target; },
    open(sec = 2.2) { DS.target = 1; DS.speed = 1 / Math.max(0.05, sec); },
    close(sec = 1.8) { DS.target = 0; DS.speed = 1 / Math.max(0.05, sec); },
    update(dt) {
      if (DS.t === DS.target) return false;
      dt = Math.max(0, Math.min(0.1, +dt || 0));
      const st = DS.speed * dt;
      DS.t = DS.t < DS.target ? Math.min(DS.target, DS.t + st) : Math.max(DS.target, DS.t - st);
      layoutDoor();
      return DS.t !== DS.target;
    },
  };
  layoutDoor();

  // ---- 合併、放進村子 ----
  const built = B.build(mats, 'orbay-');
  const group = new THREE.Group(); group.name = 'orbay';
  for (const k of ['main', 'ext', 'roof', 'sign', 'glow']) if (built.meshes[k]) group.add(built.meshes[k]);
  group.add(slats);
  group.matrixAutoUpdate = false; group.updateMatrix();
  V.group.add(group);

  // 碰撞、地方、路面、小地圖、房子
  for (const c of colliders) V.colliders.push(c);
  const zones = {
    inside: { x: (IX0 + IX1) / 2, z: (IZ0 + IZ1) / 2, hx: (IX1 - IX0) / 2, hz: (IZ1 - IZ0) / 2, rot: 0 },
    aisle: { x: (IX0 + IX1) / 2, z: (BZ1 + IZ1) / 2, hx: (IX1 - IX0) / 2, hz: (IZ1 - BZ1) / 2, rot: 0 },
    apron: { x: (G.LX0 + G.LX1) / 2, z: (G.DZ0 + G.DZ1) / 2 - 1, hx: (G.LX1 - G.LX0) / 2, hz: 6, rot: 0 },
    door: { x: G.X1, z: ZC, hx: 4.6, hz: (G.DZ1 - G.DZ0) / 2 + 0.6, rot: 0 }, // 門口（裡外各 4.6 公尺：怪獸卡車車頂到門的時候車身中間在 3.8 公尺外）：站在這裡給「開鐵捲門」
    bays: [],
  };
  const bays = [];
  for (let i = 0; i < G.N; i++) {
    const cx = bayX(i);
    bays.push({ x: cx, z: (IZ0 + BZ1) / 2, heading: Math.PI / 2 }); // 車頭朝北（開進去）
    zones.bays.push({ x: cx, z: (IZ0 + BZ1) / 2, hx: G.BW / 2, hz: G.BD / 2, rot: 0 });
  }
  const place = {
    name: SIGNS.name, pos: [(G.X0 + G.X1) / 2, (G.Z0 + G.Z1) / 2],
    spawn: { x: G.X1 + 3.5, z: ZC, heading: 0 },               // 門外面、車頭朝東（開出去）
    door: { x: G.X1 + 1.2, z: ZC, heading: 0 },
    inside: zones.inside, apron: zones.apron, bays,
    zone: { x: (G.X0 + G.LX1) / 2, z: (G.Z0 + G.Z1) / 2, hx: (G.LX1 - G.X0) / 2, hz: (G.Z1 - G.Z0) / 2, rot: 0 }, // 車庫＋門外的車道
  };
  V.places.orbay = place;
  if (V.areas?.pave) {
    V.areas.pave.push({ x: (IX0 + IX1) / 2, z: (IZ0 + IZ1) / 2, hx: (IX1 - IX0) / 2, hz: (IZ1 - IZ0) / 2, rot: 0 });
    V.areas.pave.push({ x: (G.LX0 + G.LX1) / 2, z: (G.LZ0 + G.LZ1) / 2, hx: (G.LX1 - G.LX0) / 2, hz: (G.LZ1 - G.LZ0) / 2, rot: 0 });
  }
  if (V.roads) V.roads.push({ pts: [[(G.LX0 + G.LX1) / 2, G.LZ1], [(G.LX0 + G.LX1) / 2, ZC]], w: 6.5, kind: 'drive' }); // 小地圖畫得出來的車道（kind 'drive'：路上的車、居民不走）
  if (V.buildings) V.buildings.push({ kind: 'garage', name: SIGNS.name, x: (G.X0 + G.X1) / 2, z: (G.Z0 + G.Z1) / 2, hx: (G.X1 - G.X0) / 2, hz: (G.Z1 - G.Z0) / 2, rot: 0, h: G.TOP }); // 沒有 door：走進房子、居民、車流都不理它
  const inR = (r, x, z) => Math.abs(x - r.x) <= r.hx && Math.abs(z - r.z) <= r.hz;
  const paveR = [{ x: (G.X0 + G.X1) / 2, z: (G.Z0 + G.Z1) / 2, hx: (G.X1 - G.X0) / 2, hz: (G.Z1 - G.Z0) / 2 }, { x: (G.LX0 + G.LX1) / 2, z: (G.LZ0 + G.LZ1) / 2, hx: (G.LX1 - G.LX0) / 2, hz: (G.LZ1 - G.LZ0) / 2 }];
  const surf0 = V.surfaceAt;
  V.surfaceAt = (x, z) => { for (const r of paveR) if (inR(r, x, z)) return 3; return surf0(x, z); }; // 地板、車道＝水泥地

  const info = { meshes: built.n + 1, tris: B.tris + NS * 6, ms: +((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(0) };
  if (V.info) V.info.orbay = info;

  const OB = {
    group, door, bays, zones, place, size: { ceil: G.CEIL, doorH: G.DH, doorW: G.DZ1 - G.DZ0, bayW: G.BW, bayD: G.BD }, box: { x0: G.X0, x1: G.X1, z0: G.Z0, z1: G.Z1 },
    signs: { ...SIGNS }, // 牆上、地上寫的字（測試看得到）
    // 門的碰撞（關著才擋）：開車、走路都加這一個（tag 自己取）
    doorCols: (open = DS.t >= 0.9) => (open ? [] : [{ t: 'box', x: G.X1 - 0.17, z: ZC, hx: 0.2, hz: (G.DZ1 - G.DZ0) / 2, rot: 0, h: G.DH }]),
    inside: (x, z, m = 0) => x > G.X0 - m && x < G.X1 + m && z > G.Z0 - m && z < G.Z1 + m,
    // 鏡頭在裡面而且比屋頂高：屋頂、天花板不畫（不然看不到裡面的車；跟 room.js 的 cull 一樣的意思）
    cull: (cam) => { const r = built.meshes.roof; if (!r || !cam) return; const v = !(cam.position.y > G.CEIL - 0.6 && OB.inside(cam.position.x, cam.position.z, 0.6)); if (r.visible !== v) r.visible = v; },
    update: (dt) => door.update(dt),
    info,
    dispose() {
      group.removeFromParent();
      for (const k in built.meshes) built.meshes[k].geometry.dispose();
      slats.geometry.dispose(); slats.dispose();
      for (const k in mats) mats[k].dispose();
      doorMat.dispose(); tSign.dispose();
    },
  };
  V.orbay = OB;
  return OB;
}

return { buildOrbay, orbayFonts, ORBAY_TEXT };
})();
