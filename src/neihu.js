// ---- 內湖（真的地圖）：Nick 最後一次匯出的 OpenStreetMap（neihu3.osm）整個範圍，約 1.76 × 1.36 公里（neihu-conv.mjs → neihu-data.js）----
// Nick 2026-10-04「從西湖站到文德站這一代附近」「港墘路 × 內湖路一段」；地圖資料 © OpenStreetMap 貢獻者（ODbL）：在內湖的時候畫面上要寫（neihu.src.js）
// 位置：直線加速賽道西頭（起跑線西邊 x −47）往南穿過護欄的口（x −57.5…−37，跟北邊去賽車場的口對稱），聯外道路沿著賽道南邊（z 22）往東，
//   穿過西邊的山谷，接到內湖路一段（範圍的西邊，世界約 (1480, −40)）；不經過起跑區（x −14…0：慢慢開進去會被拉去比直線加速），賽道東邊的盡頭照舊
//   內湖的中心（港墘路口）在世界的 NEIHU_DATA.at（約 (2102, 200)）；範圍＝匯出的長方形（邊上綠籬、路上「道路施工」的欄杆），外面一圈山（北邊最高：金面山）
//   北＝−z（跟遊戲一樣），1 公尺＝1 公尺（真的大小）
// 世界座標跟 village.js、drive.js 一樣：x 往東、y 往上、z 往南
// 【API】
//   await neihuFonts();                       招牌、路名牌的中文字
//   const N = buildNeihu(V, { renderer });    V＝buildVillage() 回傳的（buildCircuit 之後）；內湖加進 V（V.group、V.places.neihu、V.colliders、V.roads（聯外道路）、V.bounds、V.mapBounds、V.mapLive、V.info.neihu）
//     V.surfaceAt、V.route 包一層：內湖、聯外道路照這裡算（大路 0、小路／人行道／水泥地 3、公園草地 1），外面完全照舊
//     V.route(x, z, 'neihu')：從世界任何地方開到內湖（港墘站下面）；在內湖裡往外的目的地：照路網（單行道照方向）開出去，再接原本的
//     V.places.neihu：{ name: '內湖', pos, zone（港墘站下面的內湖路一段）, spawn }
//   N.inside(x, z)：在內湖（範圍裡、聯外道路上）；N.update(camera)：每一幀（遠的格子收起來）；N.info：{ meshes, tris, colliders, buildings, ms }；N.dispose()
// 效能：房子照 250 公尺一格合併成一個網格（牆、屋頂、騎樓、頂樓加蓋、高架、車站都是同一個材質：一張 2048×1024 的貼圖，
//   著色器裡 fract() 重複一格一格的窗戶，所以一面牆只要兩個四邊形）；路、人行道、標線、地面 500 公尺一格；樹 250 公尺一格 InstancedMesh（山上的樹一個、八面體）；
//   路名牌、直立招牌一個網格；沒有法線（flatShading）；遠的格子不畫（房子 1300、地面 1500、標線 420、樹 400 公尺）
import * as THREE from 'three';
import { NEIHU_DATA } from './neihu-data.js';

// 打包（build-art.mjs、build-app.mjs）：整個包在一個函式裡，只露出下面這些名字
export const { buildNeihu, neihuFonts, NEIHU_TEXT, NEIHU_KEEP } = (() => {
const TAU = Math.PI * 2;
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", "WenQuanYi Zen Hei", sans-serif';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (e0, e1, v) => { const t = clamp((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hh = (i, k) => { let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; }; // 照編號固定的亂數
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function fitFont(g, text, maxW, px, w = 700) { let s = px; for (; s > 8; s -= 1) { g.font = `${w} ${s}px ${SANS}`; if (g.measureText(text).width <= maxW) break; } return s; }
function segD2(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9; let t = ((px - ax) * dx + (pz - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const ex = ax + dx * t - px, ez = az + dz * t - pz; return ex * ex + ez * ez; }
function inPoly(P, x, z) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
const rotOf = (ux, uz) => Math.atan2(-uz, ux); // rotation.y：本地 +x 轉到 (ux, uz)

// ---- 店的招牌字（一般的店名，沒有牌子）----
const SHOPS = ['早餐', '豆漿', '麵店', '便當', '小吃', '水餃', '飲料', '咖啡', '藥局', '診所', '牙醫', '眼鏡', '文具', '書局', '洗衣', '美髮', '水電', '五金', '機車行', '寵物', '花店', '麵包', '鍋貼', '滷味', '火鍋', '補習班', '房屋', '冰店', '牛肉麵', '自助餐'];
const BOARD = ['道路施工', '請改道', '內湖', '港墘', '往', '越野車場', '村子', '站'];
const D = NEIHU_DATA;
// 聯外道路（Nick 2026-10-05「去內湖的路太遠了 可以大概三四百公尺遠就好」）：越野車場的水泥路（offroad.js 的 ACCESS）在村子南邊的口（x −112、z 94）往南直走，
//   約 350 公尺接到內湖西北角的環山路二段（範圍的位置在 neihu-conv.mjs 的 BOX_AT）
const LINK_J = [-112, 94];
const NEIHU_KEEP = []; // race.src.js：賽道旁邊的樹不要種在聯外道路上（x0, z0, x1, z1）：聯外道路不經過賽道了
const RIDGE_Z = 232; // 越野車場（圍籬 z 196、外面一圈地形到 z 229）南邊：內湖北邊那道矮山脊從這裡起
// 世界本來的草地（village.js 的 ground、race.src.js 的賽道草地）在哪裡：內湖的山在這上面平的地方壓低一點（草地蓋過去），範圍裡面挖掉（carveWorld）
const worldGround = (x, z) => (x >= -1450 && x <= -62 && Math.abs(z) <= 880) || (x > -62 && x <= 1300 && Math.abs(z) <= 1150);
const NEIHU_TEXT = [...new Set([...D.names.map((n) => n[0]).join(''), ...D.stations.map((s) => s[0]).join(''), ...D.nsigns.map((s) => s[3]).join(''), ...SHOPS.join(''), ...BOARD.join(''), ...'地圖資料©OpenStreetMap貢獻者到了'].filter((ch) => ch.charCodeAt(0) > 0x2e80))].join('');
function neihuFonts(ms = 1500) {
  const f = typeof document !== 'undefined' && document.fonts;
  if (!f || !f.load) return Promise.resolve();
  return Promise.race([f.load(`700 64px ${SANS}`, NEIHU_TEXT).catch(() => {}), new Promise((r) => setTimeout(r, ms))]);
}

// ---- 讀資料（公寸 → 公尺、加上世界的位置）----
const b64i16 = (s) => { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Int16Array(u8.buffer); };
function readData() {
  const AX = D.at.x, AZ = D.at.z, W = (x, z) => [x / 10 + AX, z / 10 + AZ];
  const nodes = new Float64Array(D.nodes.length); for (let i = 0; i < D.nodes.length; i += 2) { nodes[i] = D.nodes[i] / 10 + AX; nodes[i + 1] = D.nodes[i + 1] / 10 + AZ; }
  const roads = D.roads.map(([nm, w, sw, cls, ow, gen, n]) => ({ nm, w: w / 10, sw: sw / 10, cls, ow, gen, n }));
  const S = b64i16(D.bld), bld = []; let k = 0;
  while (k < S.length) {
    const type = S[k++], f = S[k++], h = S[k++] / 10, fl = S[k++], st = fl & 31, back = !!(fl & 32), lmb = !!(fl & 64); // lmb＝地標的房子（neihu.js 自己畫）
    if (type === 1) {
      const [cx, cz] = W(S[k++], S[k++]), hx = S[k++] / 10, hz = S[k++] / 10, rot = S[k++] / 1000, ef = S[k++];
      const ux = Math.cos(rot), uz = -Math.sin(rot), vx = -uz, vz = ux;
      const P = [[cx - ux * hx - vx * hz, cz - uz * hx - vz * hz], [cx + ux * hx - vx * hz, cz + uz * hx - vz * hz], [cx + ux * hx + vx * hz, cz + uz * hx + vz * hz], [cx - ux * hx + vx * hz, cz - uz * hx + vz * hz]];
      const e = [ef & 3, (ef >> 2) & 3, (ef >> 4) & 3, (ef >> 6) & 3];
      let core = null, col = back ? null : [[cx, cz, hx, hz, rot]];
      if (e[0] === 2 && hz > 4.5) { // 騎樓：靠路那邊（第 0 邊）往裡面退 3.2
        core = [[P[0][0] + vx * 3.2, P[0][1] + vz * 3.2], [P[1][0] + vx * 3.2, P[1][1] + vz * 3.2], P[2], P[3]];
        col = [[cx + vx * 1.6, cz + vz * 1.6, hx, hz - 1.6, rot]];
      } else if (e[0] === 2) e[0] = 1;
      bld.push({ P, f, h, st, back, e, core, col, rect: [cx, cz, hx, hz, rot] });
    } else {
      const n = S[k++], P = []; for (let i = 0; i < n; i++) P.push(W(S[k++], S[k++]));
      const e = []; for (let i = 0; i < n; i += 8) { const v = S[k++] & 0xffff; for (let j = 0; j < 8 && i + j < n; j++) e.push((v >> (2 * j)) & 3); }
      let core = null; if (S[k++]) { core = []; for (let i = 0; i < n; i++) core.push(W(S[k++], S[k++])); }
      const m = S[k++], col = []; for (let i = 0; i < m; i++) { const [x, z] = W(S[k++], S[k++]); col.push([x, z, S[k++] / 10, S[k++] / 10, S[k++] / 1000]); }
      bld.push({ P, f, h, st, back, lm: lmb, e, core, col: back ? null : col, rect: col[0] || null });
    }
  }
  const areas = D.areas.map(([t, p]) => { const P = []; for (let i = 0; i < p.length; i += 2) P.push(W(p[i], p[i + 1])); return { t: D.areaKinds[t], P }; });
  const elev = D.elev.map(([k2, y, w, p, pi]) => { const P = [], PI = []; for (let i = 0; i < p.length; i += 2) P.push(W(p[i], p[i + 1])); for (let i = 0; i < pi.length; i += 2) PI.push(W(pi[i], pi[i + 1])); return { k: k2, y: y / 10, w: w / 10, P, piers: PI }; });
  const T = b64i16(D.trees), trees = []; for (let i = 0; i < T.length; i += 3) trees.push([T[i] / 10 + AX, T[i + 1] / 10 + AZ, T[i + 2] / 100]);
  const lm = {}; // 七個地標：形狀（世界座標）、牌子
  for (const [k, v] of Object.entries(D.lm || {})) { const o = { nm: v.nm }; for (const [kk, vv] of Object.entries(v)) { if (kk === 'nm') continue; if (kk === 'sign') { o.sign = { p: W(vv[0], vv[1]), ang: vv[2] / 1000, nm: vv[3] }; continue; } const P = []; for (let i = 0; i < vv.length; i += 2) P.push(W(vv[i], vv[i + 1])); o[kk] = P; } lm[k] = o; }
  return {
    wide: D.wide || 1, // 第 9 批（路變大）：車道是 OSM 估的幾倍
    AX, AZ, W, nodes, roads, bld, areas, elev, trees, lm,
    stations: D.stations.map(([nm, en, x, z, a, len, w]) => ({ nm, en, p: W(x, z), ang: a / 1000, len: len / 10, w: w / 10 })),
    entr: D.entr.map(([x, z, a]) => ({ p: W(x, z), ang: a / 1000 })),
    cross: D.cross.map(([x, z, a, w]) => ({ p: W(x, z), ang: a / 1000, w: w / 10 })),
    signs: D.signs.map(([x, z, a, n]) => ({ p: W(x, z), ang: a / 1000, n })),
    nsigns: D.nsigns.map(([x, z, a, nm, t]) => ({ p: W(x, z), ang: a / 1000, nm, t })),
    bars: D.bars.map(([x, z, a, w]) => ({ p: W(x, z), ang: a / 1000, w: w / 10 })),
    box: [D.box[0] / 10 + AX, D.box[1] / 10 + AZ, D.box[2] / 10 + AX, D.box[3] / 10 + AZ], edge: D.edge ?? 3, entP: W(D.entP[0], D.entP[1]), entDir: D.entDir, ent: D.ent,
  };
}

// ---- 外觀（貼圖格子的編號）----
// 0 米色小磁磚、1 白磁磚、2 紅磚色、3 粉紅、4 新的灰大樓、5 玻璃辦公大樓、6 學校、7 舊的灰公寓、8 淺綠磁磚、9 廟、10 工廠、11 鐵皮（頂樓加蓋）
// 12–14 一樓的店面、15 住家的一樓（鐵門、車庫）、16 辦公大樓的大廳、17 學校的一樓、18 屋頂（水泥）、19 鐵皮屋頂、20 純白（用頂點顏色上色）、21 車站的玻璃、22 廟的一樓、23 工廠的一樓
const GROUND_OF = [15, 15, 15, 15, 16, 16, 17, 15, 15, 22, 23];
const CELL = (i) => [i % 8, Math.floor(i / 8)];
function facadeAtlas(aniso) {
  const W = 2048, H = 1024, CS = 256, IN = 248, [c, g] = cv(W, H);
  const R = rng(20261004);
  const [tc, tg] = cv(IN, IN);
  const put = (i, draw) => { // 畫一格（248×248，左右上下會重複），四周 4 像素照重複的樣子補（mipmap 不會滲別格的顏色）
    tg.save(); tg.clearRect(0, 0, IN, IN); draw(tg, IN, IN); tg.restore();
    const [cx, cy] = CELL(i), x0 = cx * CS + 4, y0 = cy * CS + 4;
    g.save(); g.beginPath(); g.rect(cx * CS, cy * CS, CS, CS); g.clip();
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) g.drawImage(tc, x0 + dx * IN, y0 + dy * IN);
    g.restore();
  };
  const tiles = (g2, w, h, base, line, s = 6) => { g2.fillStyle = base; g2.fillRect(0, 0, w, h); g2.fillStyle = line; for (let y = 0; y < h; y += s) g2.fillRect(0, y, w, 1); for (let y = 0; y < h; y += s) for (let x = (y / s) % 2 ? 0 : s; x < w; x += s * 2) g2.fillRect(x, y, 1, s); };
  const noise = (g2, w, h, n, cols, sz = 2) => { for (let i = 0; i < n; i++) { g2.fillStyle = cols[(R() * cols.length) | 0]; g2.fillRect(R() * w, R() * h, sz, sz); } };
  const win = (g2, x, y, w, h, o = {}) => { // 鋁窗（玻璃、框、中間的框）、鐵窗、冷氣
    g2.fillStyle = o.frame || '#cfd3d6'; g2.fillRect(x - 3, y - 3, w + 6, h + 6);
    const gr = g2.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, o.g1 || '#4d6274'); gr.addColorStop(0.55, o.g2 || '#2b3a47'); gr.addColorStop(1, o.g3 || '#5f7688');
    g2.fillStyle = gr; g2.fillRect(x, y, w, h);
    if (o.curtain) { g2.fillStyle = o.curtain; g2.fillRect(x + 2, y + 2, w * 0.35, h - 4); }
    g2.fillStyle = o.frame || '#cfd3d6'; g2.fillRect(x + w / 2 - 1.5, y, 3, h);
    if (o.grille) { g2.fillStyle = o.grille; g2.fillRect(x - 6, y - 6, w + 12, 3); g2.fillRect(x - 6, y + h + 3, w + 12, 3); for (let gx = x - 6; gx <= x + w + 6; gx += 7) g2.fillRect(gx, y - 6, 2, h + 12); g2.fillStyle = 'rgba(0,0,0,0.18)'; g2.fillRect(x - 6, y + h + 6, w + 12, 3); }
    if (o.ac) { g2.fillStyle = '#e9e4d6'; g2.fillRect(x + w - 30, y + h + 8, 30, 18); g2.fillStyle = '#9b978c'; for (let k = 0; k < 4; k++) g2.fillRect(x + w - 26 + k * 7, y + h + 11, 4, 12); }
  };
  const winGrid = (g2, w, h, o) => { for (let by = 0; by < 2; by++) for (let bx = 0; bx < 2; bx++) win(g2, bx * 124 + 22, by * 124 + 28, 80, 62, { ...o, ac: o.ac && R() < 0.55, curtain: R() < 0.5 ? (R() < 0.5 ? 'rgba(230,220,200,0.55)' : 'rgba(170,190,210,0.5)') : null }); };
  const streaks = (g2, w, h, a) => { for (let i = 0; i < 14; i++) { g2.fillStyle = `rgba(40,40,40,${a * R()})`; g2.fillRect(R() * w, R() * h * 0.5, 2 + R() * 4, h * (0.3 + R() * 0.7)); } };
  // 上面的樓層（一格＝兩間 × 兩層樓）
  put(0, (g2, w, h) => { tiles(g2, w, h, '#d9c6a1', 'rgba(150,130,100,0.35)'); winGrid(g2, w, h, { grille: '#f2f2ee', ac: true }); });
  put(1, (g2, w, h) => { tiles(g2, w, h, '#e9e7e0', 'rgba(160,160,160,0.3)', 5); for (let by = 0; by < 2; by++) { win(g2, 10, by * 124 + 24, 104, 70, {}); win(g2, 134, by * 124 + 24, 104, 70, {}); g2.fillStyle = '#d7d4cc'; g2.fillRect(0, by * 124 + 96, w, 8); g2.fillStyle = '#f4f3ef'; for (let x = 4; x < w; x += 8) g2.fillRect(x, by * 124 + 74, 3, 22); g2.fillRect(0, by * 124 + 72, w, 4); } });
  put(2, (g2, w, h) => { tiles(g2, w, h, '#a85a40', 'rgba(70,30,20,0.4)', 5); noise(g2, w, h, 400, ['#9b4f37', '#b5654a', '#93452f']); winGrid(g2, w, h, { grille: '#3b3f3a', ac: true, frame: '#d6d6d0' }); });
  put(3, (g2, w, h) => { tiles(g2, w, h, '#dcaaa0', 'rgba(140,90,80,0.3)'); winGrid(g2, w, h, { grille: '#f0efe9', ac: true }); });
  put(4, (g2, w, h) => { g2.fillStyle = '#9ba4ad'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#b8bfc6'; for (let by = 0; by < 2; by++) g2.fillRect(0, by * 124 + 100, w, 24); for (let by = 0; by < 2; by++) for (let bx = 0; bx < 2; bx++) { win(g2, bx * 124 + 8, by * 124 + 14, 108, 82, { frame: '#5b636b', g1: '#6c8396', g2: '#3a4f61', g3: '#86a0b4' }); g2.fillStyle = 'rgba(200,220,230,0.35)'; g2.fillRect(bx * 124 + 6, by * 124 + 72, 112, 24); g2.fillStyle = '#e8ecef'; g2.fillRect(bx * 124 + 6, by * 124 + 70, 112, 3); } });
  put(5, (g2, w, h) => { const gr = g2.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#5f84a8'); gr.addColorStop(0.5, '#3d5f80'); gr.addColorStop(1, '#6f95b8'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h); g2.fillStyle = '#2d3a46'; for (let by = 0; by < 2; by++) g2.fillRect(0, by * 124 + 104, w, 20); g2.fillStyle = '#c3ccd4'; for (let x = 0; x < w; x += 31) g2.fillRect(x, 0, 3, h); for (let by = 0; by < 2; by++) g2.fillRect(0, by * 124 + 102, w, 3); g2.fillStyle = 'rgba(255,255,255,0.12)'; g2.fillRect(0, 10, w, 30); });
  put(6, (g2, w, h) => { g2.fillStyle = '#ece8dc'; g2.fillRect(0, 0, w, h); for (let by = 0; by < 2; by++) { g2.fillStyle = '#d5cfbf'; g2.fillRect(0, by * 124 + 92, w, 32); win(g2, 8, by * 124 + 22, 232, 60, { frame: '#7aa7c7', g1: '#4d6a80', g2: '#344b5c' }); g2.fillStyle = '#7aa7c7'; for (let x = 8; x < 240; x += 58) g2.fillRect(x, by * 124 + 22, 4, 60); g2.fillStyle = '#eae6da'; g2.fillRect(0, by * 124 + 96, w, 4); } });
  put(7, (g2, w, h) => { g2.fillStyle = '#a9a69d'; g2.fillRect(0, 0, w, h); noise(g2, w, h, 900, ['#9a978e', '#b5b2a9', '#8e8b83']); streaks(g2, w, h, 0.25); winGrid(g2, w, h, { grille: '#6d5a48', ac: true, frame: '#bfc2bf' }); });
  put(8, (g2, w, h) => { tiles(g2, w, h, '#adc7a6', 'rgba(80,110,80,0.3)'); winGrid(g2, w, h, { grille: '#f2f2ee', ac: true }); });
  put(9, (g2, w, h) => { g2.fillStyle = '#b3392d'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#e2b13c'; for (let by = 0; by < 2; by++) g2.fillRect(0, by * 124 + 6, w, 10); for (let by = 0; by < 2; by++) for (let bx = 0; bx < 2; bx++) { g2.fillStyle = '#2e5a3a'; g2.fillRect(bx * 124 + 40, by * 124 + 40, 44, 50); g2.fillStyle = '#e2b13c'; for (let k = 0; k < 5; k++) g2.fillRect(bx * 124 + 42 + k * 9, by * 124 + 40, 3, 50); } });
  put(10, (g2, w, h) => { g2.fillStyle = '#c7cacd'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#aeb2b6'; for (let x = 0; x < w; x += 8) g2.fillRect(x, 0, 3, h); for (let by = 0; by < 2; by++) { win(g2, 6, by * 124 + 40, 236, 34, { frame: '#8c9196' }); } });
  put(11, (g2, w, h) => { g2.fillStyle = '#5d86b3'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#7da3cb'; for (let x = 0; x < w; x += 10) g2.fillRect(x, 0, 4, h); g2.fillStyle = 'rgba(0,0,0,0.15)'; for (let x = 6; x < w; x += 10) g2.fillRect(x, 0, 2, h); win(g2, 70, 70, 60, 50, { grille: '#ddd' }); });
  // 一樓（一格＝兩間 × 一層樓，3.6 公尺高）
  const shopFront = (g2, x, w, h, word, R2) => {
    const sc = [['#d6342b', '#fff'], ['#f3c623', '#222'], ['#1f5fae', '#fff'], ['#2a8a4a', '#fff'], ['#ffffff', '#c22'], ['#f28c28', '#fff'], ['#6b3fa0', '#fff']][(R2() * 7) | 0];
    g2.fillStyle = '#5a5650'; g2.fillRect(x, 0, w, h);
    g2.fillStyle = sc[0]; g2.fillRect(x + 4, 6, w - 8, 56); g2.strokeStyle = 'rgba(0,0,0,0.25)'; g2.lineWidth = 2; g2.strokeRect(x + 5, 7, w - 10, 54);
    g2.fillStyle = sc[1]; g2.textAlign = 'center'; g2.textBaseline = 'middle'; fitFont(g2, word, w - 22, 40); g2.fillText(word, x + w / 2, 35);
    const kind = R2();
    if (kind < 0.4) { g2.fillStyle = '#8e9296'; g2.fillRect(x + 6, 66, w - 12, h - 66); g2.fillStyle = '#a3a7ab'; for (let y = 68; y < h; y += 7) g2.fillRect(x + 6, y, w - 12, 3); g2.fillStyle = '#2a2622'; g2.fillRect(x + 6, h - 60, w - 12, 60); g2.fillStyle = '#e0c48a'; for (let k = 0; k < 6; k++) g2.fillRect(x + 12 + k * 17, h - 50 + (k % 2) * 12, 12, 10); } // 鐵捲門拉一半
    else if (kind < 0.75) { g2.fillStyle = '#c9d8e0'; g2.fillRect(x + 6, 66, w - 12, h - 66); g2.fillStyle = '#6d8a9a'; g2.fillRect(x + w / 2 - 2, 66, 4, h - 66); g2.fillStyle = 'rgba(255,240,200,0.5)'; g2.fillRect(x + 10, 80, w - 20, 40); g2.fillStyle = '#7a5a3a'; for (let k = 0; k < 4; k++) g2.fillRect(x + 14 + k * 26, h - 70, 18, 70); } // 玻璃門、裡面的架子
    else { g2.fillStyle = '#3a3330'; g2.fillRect(x + 6, 66, w - 12, h - 66); g2.fillStyle = '#ffe9b0'; g2.fillRect(x + 8, 70, w - 16, 10); g2.fillStyle = '#c84b32'; for (let k = 0; k < 5; k++) g2.fillRect(x + 12 + k * 21, h - 64, 15, 40); g2.fillStyle = '#d8d2c4'; g2.fillRect(x + 6, h - 24, w - 12, 24); } // 開著的店
  };
  for (let s = 0; s < 3; s++) put(12 + s, (g2, w, h) => { const R2 = rng(77 + s); shopFront(g2, 0, 124, h, SHOPS[(s * 2 + 3) % SHOPS.length], R2); shopFront(g2, 124, 124, h, SHOPS[(s * 7 + 11) % SHOPS.length], R2); });
  put(15, (g2, w, h) => { tiles(g2, w, h, '#c9bfae', 'rgba(110,100,90,0.35)'); g2.fillStyle = '#7b2a22'; g2.fillRect(18, 60, 70, h - 60); g2.fillStyle = '#5d1f19'; for (let y = 70; y < h; y += 16) g2.fillRect(22, y, 62, 3); g2.fillStyle = '#d8c068'; g2.fillRect(76, 140, 6, 10); g2.fillStyle = '#9097a0'; g2.fillRect(120, 50, 116, h - 50); g2.fillStyle = '#a6acb4'; for (let y = 54; y < h; y += 8) g2.fillRect(120, y, 116, 3); g2.fillStyle = '#d6d0c2'; g2.fillRect(100, 110, 14, 18); });
  put(16, (g2, w, h) => { g2.fillStyle = '#3f4a52'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#9fb7c6'; g2.fillRect(0, 30, w, h - 30); g2.fillStyle = '#4c5a64'; for (let x = 0; x < w; x += 62) g2.fillRect(x, 30, 5, h - 30); g2.fillStyle = 'rgba(255,250,230,0.45)'; g2.fillRect(10, 50, w - 20, 30); g2.fillStyle = '#d8dde0'; g2.fillRect(0, 0, w, 26); });
  put(17, (g2, w, h) => { g2.fillStyle = '#e4dccb'; g2.fillRect(0, 0, w, h); win(g2, 10, 70, 104, 90, { frame: '#7aa7c7' }); win(g2, 134, 70, 104, 90, { frame: '#7aa7c7' }); g2.fillStyle = '#c96f4a'; g2.fillRect(0, h - 30, w, 30); });
  put(18, (g2, w, h) => { g2.fillStyle = '#a7a59f'; g2.fillRect(0, 0, w, h); noise(g2, w, h, 1600, ['#9a9892', '#b3b1ab', '#8f8d88', '#bab8b0'], 3); g2.fillStyle = 'rgba(60,60,60,0.25)'; g2.fillRect(0, 0, w, 3); g2.fillRect(0, 0, 3, h); });
  put(19, (g2, w, h) => { g2.fillStyle = '#4f7fae'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#6f9ccb'; for (let x = 0; x < w; x += 12) g2.fillRect(x, 0, 5, h); g2.fillStyle = 'rgba(0,0,0,0.18)'; for (let x = 8; x < w; x += 12) g2.fillRect(x, 0, 2, h); noise(g2, w, h, 120, ['rgba(120,80,50,0.4)'], 4); });
  put(20, (g2, w, h) => { g2.fillStyle = '#ffffff'; g2.fillRect(0, 0, w, h); });
  put(21, (g2, w, h) => { const gr = g2.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9ccfc4'); gr.addColorStop(1, '#5d9a90'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h); g2.fillStyle = '#e8ecec'; for (let x = 0; x < w; x += 41) g2.fillRect(x, 0, 4, h); g2.fillRect(0, h / 2 - 2, w, 4); });
  put(22, (g2, w, h) => { g2.fillStyle = '#b3392d'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#7a2a1c'; g2.fillRect(70, 60, 108, h - 60); g2.fillStyle = '#e2b13c'; g2.fillRect(70, 56, 108, 6); g2.fillRect(122, 60, 4, h - 60); g2.fillStyle = '#f0d070'; g2.fillRect(20, 20, w - 40, 14); });
  // 24 麗山國中：白色小磁磚＋紅磚飾帶、走廊欄杆（照片 麗山國中-1、-2）；25 西湖圖書館：灰白小口磁磚＋橫帶窗（照片 西湖圖書館-4、-6）
  put(24, (g2, w, h) => { tiles(g2, w, h, '#eceae2', 'rgba(150,150,145,0.28)', 5);
    for (let by = 0; by < 2; by++) { g2.fillStyle = '#a4533c'; g2.fillRect(0, by * 124 + 96, w, 20); noise(g2, w, h, 60, ['#95492f', '#b05f45'], 3); win(g2, 10, by * 124 + 22, 104, 66, { frame: '#dcdcd6' }); win(g2, 134, by * 124 + 22, 104, 66, { frame: '#dcdcd6' });
      g2.fillStyle = '#c9ccc8'; g2.fillRect(0, by * 124 + 88, w, 6); g2.fillStyle = '#8f9490'; for (let x = 4; x < w; x += 10) g2.fillRect(x, by * 124 + 90, 3, 6); } });
  put(25, (g2, w, h) => { tiles(g2, w, h, '#dfe2e3', 'rgba(130,135,138,0.35)', 4); noise(g2, w, h, 500, ['#d6dadc', '#e8ebec'], 2);
    for (let by = 0; by < 2; by++) { g2.fillStyle = '#c6cacb'; g2.fillRect(0, by * 124 + 18, w, 4); win(g2, 6, by * 124 + 24, 110, 58, { frame: '#e8eaea', g1: '#6b7d87', g2: '#44555f' }); win(g2, 130, by * 124 + 24, 110, 58, { frame: '#e8eaea', g1: '#6b7d87', g2: '#44555f' }); g2.fillStyle = '#cfd3d4'; g2.fillRect(0, by * 124 + 92, w, 30); } });
  put(23, (g2, w, h) => { g2.fillStyle = '#b9bdc1'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#9da2a7'; g2.fillRect(20, 40, 200, h - 40); g2.fillStyle = '#b0b5ba'; for (let y = 44; y < h; y += 8) g2.fillRect(20, y, 200, 3); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  const cells = []; for (let i = 0; i < 32; i++) { const [cx, cy] = CELL(i); cells.push(new THREE.Vector4((cx * CS + 4) / W, 1 - (cy * CS + 4 + IN) / H, IN / W, IN / H)); }
  return { tex: t, cells };
}
// 路名牌、直立招牌、車站、公園學校的牌子、施工欄杆：一張 1024×1536
function signAtlas(aniso, names, boards, lms) {
  const W = 1024, H = 1536, [c, g] = cv(W, H), uv = {};
  const reg = (key, x, y, w, h, draw) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); draw(g, w, h); g.restore(); uv[key] = [(x + 1) / W, 1 - (y + h - 1) / H, (x + w - 1) / W, 1 - (y + 1) / H]; };
  const T = (g2, t, x, y, px, col, max, wt = 700) => { g2.fillStyle = col; g2.textAlign = 'center'; g2.textBaseline = 'middle'; fitFont(g2, t, max, px, wt); g2.fillText(t, x, y); };
  // 路名牌（藍底白字，下面小的英文）：256×48，最多 84 個
  names.slice(0, 84).forEach(([nm, en], i) => reg('n' + i, (i % 4) * 256, Math.floor(i / 4) * 48, 256, 48, (g2, w, h) => {
    g2.fillStyle = '#1f4f9c'; g2.fillRect(0, 0, w, h); g2.strokeStyle = '#ffffff'; g2.lineWidth = 2; g2.strokeRect(3, 3, w - 6, h - 6);
    if (en) { T(g2, nm, w / 2, 19, 26, '#fff', w - 16); T(g2, en, w / 2, 38, 11, '#dfe8f5', w - 20, 600); } else T(g2, nm, w / 2, h / 2, 30, '#fff', w - 16);
  }));
  // 直立招牌 64×256 × 16
  const SC = [['#d6342b', '#fff'], ['#f3c623', '#c0141a'], ['#ffffff', '#1f5fae'], ['#1f5fae', '#fff'], ['#2a8a4a', '#fff'], ['#f28c28', '#fff'], ['#ffffff', '#d6342b'], ['#222222', '#f3c623']];
  for (let i = 0; i < 16; i++) reg('v' + i, i * 64, 1008, 64, 256, (g2, w, h) => {
    const [bg, fg] = SC[i % SC.length], word = SHOPS[(i * 5 + 2) % SHOPS.length];
    g2.fillStyle = bg; g2.fillRect(0, 0, w, h); g2.strokeStyle = fg; g2.lineWidth = 3; g2.strokeRect(4, 4, w - 8, h - 8);
    const ch = [...word], step = Math.min(56, (h - 24) / ch.length); g2.fillStyle = fg; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.font = `900 ${Math.min(46, step * 0.86)}px ${SANS}`;
    ch.forEach((k, j) => g2.fillText(k, w / 2, 12 + step * (j + 0.5) + (h - 24 - step * ch.length) / 2));
  });
  // 牌子 256×68 × 16：車站、往內湖、施工、公園、學校
  boards.slice(0, 16).forEach((b, i) => reg('b' + i, (i % 4) * 256, 1264 + Math.floor(i / 4) * 68, 256, 68, (g2, w, h) => {
    if (b.t === 'station') { g2.fillStyle = '#20323f'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#b07a3a'; g2.fillRect(0, h - 8, w, 8); T(g2, b.nm + '站', 92, 30, 40, '#fff', 150); T(g2, b.en || '', 196, 32, 18, '#cfe0ea', 100, 600); }
    else if (b.t === 'guide') { g2.fillStyle = '#1d7a46'; g2.fillRect(0, 0, w, h); g2.strokeStyle = '#fff'; g2.lineWidth = 3; g2.strokeRect(4, 4, w - 8, h - 8); T(g2, b.nm, w / 2 - 20, 30, 38, '#fff', w - 70); T(g2, b.en || '', w / 2 - 20, 56, 13, '#fff', w - 70, 600); g2.fillStyle = '#fff'; g2.beginPath(); if (b.arrow === 'r') { g2.moveTo(w - 18, 34); g2.lineTo(w - 38, 14); g2.lineTo(w - 38, 26); g2.lineTo(w - 60, 26); g2.lineTo(w - 60, 42); g2.lineTo(w - 38, 42); g2.lineTo(w - 38, 54); } else { g2.moveTo(w - 40, 14); g2.lineTo(w - 22, 34); g2.lineTo(w - 32, 34); g2.lineTo(w - 32, 56); g2.lineTo(w - 48, 56); g2.lineTo(w - 48, 34); g2.lineTo(w - 58, 34); } g2.closePath(); g2.fill(); }
    else if (b.t === 'work') { for (let x = -h; x < w; x += 34) { g2.fillStyle = (x / 34) % 2 ? '#f47b20' : '#ffffff'; g2.beginPath(); g2.moveTo(x, h); g2.lineTo(x + 17, h); g2.lineTo(x + 17 + h, 0); g2.lineTo(x + h, 0); g2.fill(); } g2.fillStyle = 'rgba(200,30,30,0.92)'; g2.fillRect(46, 12, w - 92, h - 24); T(g2, '道路施工 請改道', w / 2, h / 2, 26, '#fff', w - 104); }
    else if (b.t === 'school') { g2.fillStyle = '#7a1f1f'; g2.fillRect(0, 0, w, h); T(g2, b.nm, w / 2, h / 2, 36, '#f4e6c0', w - 20); }
    else { g2.fillStyle = '#5b6a52'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#6f7f64'; g2.fillRect(4, 4, w - 8, h - 8); T(g2, b.nm, w / 2, h / 2, 34, '#fffbe8', w - 20); }
  }));
  // 地標的牌子 256×68 × 8（y 1400…1536）：石頭的、金字的⋯（照參考照片）
  const LST = {
    stone: ['#2a2622', '#e8c66a', 2], // 碧湖公園：黑花崗岩、金字
    white: ['#efece4', '#4a3a2c', 1], // 內湖國小：白色石牆、深褐字
    red: ['#7a3326', '#f2e4c4', 1], // 麗山國中
    green: ['#2f4a35', '#eef2e8', 2], // 大港墘公園：墨綠石碑
    grey: ['#c9ccce', '#ffffff', 0], // 西湖圖書館：灰白磁磚牆、白色立體字
    frieze: ['#dcd9d0', '#6a6counter', 0], // 湖光教會：石頭的額枋、刻的字
    gold: ['#2b2b2b', '#d8b45e', 2], // 港墘站出入口：金色的站名牌
  };
  LST.frieze[1] = '#6a6358';
  (lms || []).slice(0, 8).forEach((m, i) => reg('L' + i, (i % 4) * 256, 1400 + Math.floor(i / 4) * 68, 256, 68, (g2, w, h) => {
    const [bg, fg, bd] = LST[m.st] || LST.white;
    g2.fillStyle = bg; g2.fillRect(0, 0, w, h);
    if (bd) { g2.strokeStyle = fg; g2.lineWidth = bd; g2.strokeRect(5, 5, w - 10, h - 10); }
    if (m.en) { T(g2, m.nm, w / 2, 28, 34, fg, w - 24); T(g2, m.en, w / 2, 54, 15, fg, w - 30, 600); } else T(g2, m.nm, w / 2, h / 2, 34, fg, w - 24);
  }));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return { tex: t, uv };
}
function detailTex(seed, base, cols, n, N, aniso, sz = 2) {
  const R = rng(seed), [c, g] = cv(N, N); g.fillStyle = base; g.fillRect(0, 0, N, N);
  for (let i = 0; i < n; i++) { g.fillStyle = cols[(R() * cols.length) | 0]; const w = 1 + R() * sz; g.fillRect(R() * N, R() * N, w, w); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function paveTex(aniso) { // 人行道的地磚（一張＝2 公尺）
  const N = 128, [c, g] = cv(N, N), R = rng(3); g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, N, N);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = 170 + R() * 30; g.fillStyle = `rgb(${v},${v - 8},${v - 18})`; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---- 幾何：一格（材質 × 格子）一個 ----
class Geo { // 長得很快的陣列：位置、uv、顏色（0–255）、貼圖格子編號（牆的材質才用）
  constructor(tile) { this.p = new Float32Array(3 * 1024); this.u = new Float32Array(2 * 1024); this.c = new Uint8Array(3 * 1024); this.t = tile ? new Uint8Array(1024) : null; this.i = new Uint32Array(1536); this.v = 0; this.ni = 0; }
  grow(nv, ni) {
    if (this.v + nv > this.p.length / 3) { const m = Math.max(this.p.length / 3 * 2, this.v + nv); const g = (A, k) => { const B = new A.constructor(m * k); B.set(A); return B; }; this.p = g(this.p, 3); this.u = g(this.u, 2); this.c = g(this.c, 3); if (this.t) this.t = g(this.t, 1); }
    if (this.ni + ni > this.i.length) { const B = new Uint32Array(Math.max(this.i.length * 2, this.ni + ni)); B.set(this.i); this.i = B; }
  }
  vert(x, y, z, u, v, r, g, b, cell) { const k = this.v++; this.p[k * 3] = x; this.p[k * 3 + 1] = y; this.p[k * 3 + 2] = z; this.u[k * 2] = u; this.u[k * 2 + 1] = v; this.c[k * 3] = r; this.c[k * 3 + 1] = g; this.c[k * 3 + 2] = b; if (this.t) this.t[k] = cell; return k; }
  tri(a, b, c) { this.i[this.ni++] = a; this.i[this.ni++] = b; this.i[this.ni++] = c; }
  geometry() {
    const g = new THREE.BufferGeometry(), v = this.v;
    g.setAttribute('position', new THREE.BufferAttribute(this.p.slice(0, v * 3), 3)); g.setAttribute('uv', new THREE.BufferAttribute(this.u.slice(0, v * 2), 2));
    g.setAttribute('color', new THREE.BufferAttribute(this.c.slice(0, v * 3), 3, true)); if (this.t) g.setAttribute('cell', new THREE.BufferAttribute(new Float32Array(this.t.subarray(0, v)), 1));
    g.setIndex(new THREE.BufferAttribute(v > 65535 ? this.i.slice(0, this.ni) : Uint16Array.from(this.i.subarray(0, this.ni)), 1));
    g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
}
const col255 = (hex) => { const c = new THREE.Color(hex); return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]; }; // 線性的顏色（跟材質的 color 一樣）
const shade = (c, k) => [Math.min(255, Math.round(c[0] * k)), Math.min(255, Math.round(c[1] * k)), Math.min(255, Math.round(c[2] * k))];

function buildNeihu(V, opt = {}) {
  const T0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const aniso = opt.renderer ? Math.min(8, opt.renderer.capabilities.getMaxAnisotropy()) : 4;
  const N = readData(), AX = N.AX, AZ = N.AZ, [BX0, BZ0, BX1, BZ1] = N.box;
  const ND = N.nodes, nx = (i) => ND[i * 2], nz = (i) => ND[i * 2 + 1];
  const edgeIn = (x, z) => Math.min(x - BX0, BX1 - x, z - BZ0, BZ1 - z); // 到範圍的邊（裡面＞0）
  const inBox = (x, z, m = 0) => x >= BX0 + m && x <= BX1 - m && z >= BZ0 + m && z <= BZ1 - m;
  const boxD = (x, z) => { const ox = x < BX0 ? BX0 - x : x > BX1 ? x - BX1 : 0, oz = z < BZ0 ? BZ0 - z : z > BZ1 ? z - BZ1 : 0; return Math.hypot(ox, oz); }; // 範圍外面幾公尺
  // 路口：一個點有幾條路（3 以上＝路口）、路口多大（最寬那條的半寬＋人行道）
  const deg = new Uint8Array(ND.length / 2); for (const r of N.roads) r.n.forEach((ni, i) => { deg[ni] += i === 0 || i === r.n.length - 1 ? 1 : 2; });
  const jR = new Float32Array(ND.length / 2); for (const r of N.roads) for (const ni of r.n) jR[ni] = Math.max(jR[ni], r.w / 2 + r.sw);
  const colliders = [];
  // ---- 材質 ----
  const FA = facadeAtlas(aniso);
  const boards = [...N.stations.map((s) => ({ t: 'station', nm: s.nm, en: s.en })), { t: 'guide', nm: '內湖', en: 'Neihu' }, { t: 'guide', nm: '往 村子・越野車場', en: '' }, { t: 'guide', nm: '內湖', en: 'Neihu', arrow: 'r' }, { t: 'work' }, ...N.nsigns.map((s) => ({ t: s.t, nm: s.nm }))];
  // 地標的牌子（照參考照片：碧湖公園黑花崗岩金字、內湖國小白石牆、麗山國中紅褐、大港墘公園墨綠石碑、西湖圖書館灰白牆白字、湖光教會石頭額枋、港墘站金色站名）
  const LMS = [['bihu', 'stone', 'Bihu Park'], ['nhps', 'white', ''], ['lishan', 'red', ''], ['dgq', 'green', 'Dagangqian Park'], ['lib', 'grey', ''], ['church', 'frieze', ''], ['mrt', 'gold', 'GANGQIAN']]
    .filter(([k]) => N.lm[k]).map(([k, st, en]) => ({ k, st, en, nm: N.lm[k].nm }));
  const SA = signAtlas(aniso, D.names, boards, LMS);
  const lmUV = (k) => SA.uv['L' + LMS.findIndex((m) => m.k === k)];
  const bIdx = (pred) => boards.findIndex(pred);
  const tAsph = detailTex(11, '#4f5156', ['#45474c', '#5b5d62', '#3e4044', '#66686c'], 5000, 256, aniso, 1.6), tPave = paveTex(aniso), tGround = detailTex(12, '#bdbab2', ['#b0ada5', '#c8c5bd', '#a9a69e'], 3000, 128, aniso, 2.5);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, flatShading: true, ...o });
  const mats = {
    wall: std({ map: FA.tex, vertexColors: true, roughness: 0.85 }),
    sign: std({ map: SA.tex, vertexColors: true, emissive: 0xffffff, emissiveMap: SA.tex, emissiveIntensity: 0.25, roughness: 0.6 }),
    ground: std({ map: tGround, vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 }),
    area: std({ map: tGround, vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    walk: std({ map: tPave, vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    road: std({ map: tAsph, vertexColors: true, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }),
    paint: std({ vertexColors: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -6 }),
    hill: std({ vertexColors: true, roughness: 1 }),
    tree: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
  };
  // 牆的材質：貼圖格子在著色器裡重複（fract），每個頂點一個「格子編號」→ uniform 陣列裡的 [u0, v0, du, dv]
  mats.wall.onBeforeCompile = (sh) => {
    sh.uniforms.nhCells = { value: FA.cells };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float cell;\nuniform vec4 nhCells[32];\nvarying vec4 vTile;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTile = nhCells[int(cell + 0.5)];');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vTile;')
      .replace('#include <map_fragment>', 'vec2 nhUv = vTile.xy + fract(vMapUv) * vTile.zw;\nvec4 sampledDiffuseColor = textureGrad(map, nhUv, dFdx(vMapUv) * vTile.zw, dFdy(vMapUv) * vTile.zw);\ndiffuseColor *= sampledDiffuseColor;');
  };
  mats.wall.customProgramCacheKey = () => 'neihu-wall';

  // ---- 格子（tile）：材質 + 格子 → Geo ----
  const banks = new Map();
  const TB = 250, TG = 500;
  const bank = (mat, x, z, size) => { const i = Math.floor((x - AX) / size), j = Math.floor((z - AZ) / size), key = mat + ':' + i + ',' + j; let b = banks.get(key); if (!b) banks.set(key, (b = { mat, g: new Geo(mat === 'wall'), cx: AX + (i + 0.5) * size, cz: AZ + (j + 0.5) * size, size })); return b.g; };
  const WHITE = [255, 255, 255];
  // 直立的面（牆）：從 a 到 b、y0..y1，正面朝 (a→b) 的右手邊（從上面看、z 往下：順時針的多邊形的外面）
  function wallQ(g, ax, az, bx, bz, y0, y1, u0, u1, v0, v1, cell, c0, c1 = c0) {
    g.grow(4, 6); const k = g.vert(ax, y0, az, u0, v0, c0[0], c0[1], c0[2], cell); g.vert(bx, y0, bz, u1, v0, c0[0], c0[1], c0[2], cell); g.vert(bx, y1, bz, u1, v1, c1[0], c1[1], c1[2], cell); g.vert(ax, y1, az, u0, v1, c1[0], c1[1], c1[2], cell);
    g.tri(k, k + 2, k + 1); g.tri(k, k + 3, k + 2); // 外面看過去逆時針
  }
  function quad3(g, P, uv, cell, c) { g.grow(4, 6); const k = g.v; for (let i = 0; i < 4; i++) g.vert(P[i][0], P[i][1], P[i][2], uv[i][0], uv[i][1], c[0], c[1], c[2], cell); g.tri(k, k + 1, k + 2); g.tri(k, k + 2, k + 3); }
  // 盒子（中心 x z、半長 hx 沿 rot、半寬 hz、y0..y1）：純白的格子＋頂點顏色
  function boxG(g, x, z, hx, hz, rot, y0, y1, c, cell = 20, top = true) {
    const ux = Math.cos(rot), uz = -Math.sin(rot), vx = -uz, vz = ux, P = [[x - ux * hx - vx * hz, z - uz * hx - vz * hz], [x + ux * hx - vx * hz, z + uz * hx - vz * hz], [x + ux * hx + vx * hz, z + uz * hx + vz * hz], [x - ux * hx + vx * hz, z - uz * hx + vz * hz]];
    for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4]; wallQ(g, a[0], a[1], b[0], b[1], y0, y1, 0.3, 0.7, 0.3, 0.7, cell, shade(c, 0.86 + 0.07 * (i % 2)), c); }
    if (top) quad3(g, [[P[0][0], y1, P[0][1]], [P[3][0], y1, P[3][1]], [P[2][0], y1, P[2][1]], [P[1][0], y1, P[1][1]]], [[0.3, 0.3], [0.3, 0.7], [0.7, 0.7], [0.7, 0.3]], cell, shade(c, 1.08));
    return P;
  }
  // 平的多邊形（從上面看朝上）：三角化
  const V2 = (p) => new THREE.Vector2(p[0], p[1]);
  function flatPoly(g, P, y, uvS, c, cell = 0, down = false) {
    const tri = THREE.ShapeUtils.triangulateShape(P.map(V2), []); if (!tri.length) return;
    g.grow(P.length, tri.length * 3); const k = g.v;
    for (const p of P) g.vert(p[0], y, p[1], p[0] / uvS, -p[1] / uvS, c[0], c[1], c[2], cell);
    // triangulateShape 不管多邊形本來是哪個方向，吐出來的三角形都是同一個方向（正的面積）→ 照固定的方向接（本來看 isClockWise，方向反過來的多邊形（碧湖⋯）整片朝下，看不到）
    for (const [a, b, d] of tri) { if (!down) g.tri(k + a, k + d, k + b); else g.tri(k + a, k + b, k + d); } // 反過來接＝朝上（x-z 平面上「逆時針」的三角形法線朝下）
  }

  // ==== 房子 ====
  const STY_COL = [[236, 226, 208], [240, 240, 236], [230, 214, 206], [240, 222, 216], [222, 226, 230], [220, 226, 234], [242, 240, 232], [214, 212, 206], [226, 236, 222], [240, 220, 210], [226, 228, 230]];
  const resSt = new Set([0, 1, 2, 3, 7, 8]);
  let nb = 0, nArc = 0, nShed = 0, vSigns = [];
  const LISHAN = N.lm && N.lm.lishan ? N.lm.lishan.p : null; // 麗山國中校地裡的房子：白磁磚＋紅磚飾帶的牆（格子 24，照參考照片）
  const GB = 1e6; // 第 9 批：房子的編號（碰撞物的 g；村子的房子沒有 g）
  N.bld.forEach((b, bi) => {
    if (b.lm) return; // 地標的房子（西湖圖書館、湖光教會）：下面自己做
    const P = b.P, n = P.length; let cx = 0, cz = 0; for (const p of P) { cx += p[0]; cz += p[1]; } cx /= n; cz /= n;
    const g = bank('wall', cx, cz, TB);
    const gh = b.e.includes(2) ? 4.2 : 3.6, top = b.h > 2 ? b.h : b.f <= 1 ? 3.8 + hh(bi, 1) * 0.8 : gh + (b.f - 1) * 3.2;
    const st = b.st, base = STY_COL[st] || WHITE, tint = 0.9 + hh(bi, 2) * 0.16, col = shade(base, tint), low = shade(col, 0.78), gcell = GROUND_OF[st] ?? 15;
    const C = b.core || P;
    for (let i = 0; i < n; i++) {
      const a = P[i], c = P[(i + 1) % n], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue;
      const ca = C[i], cc = C[(i + 1) % n], Lc = Math.hypot(cc[0] - ca[0], cc[1] - ca[1]), e = b.e[i] || 0;
      const shopCell = 12 + Math.floor(hh(bi, 10 + i) * 3);
      if (b.f <= 1 && b.h <= 2) { wallQ(g, a[0], a[1], c[0], c[1], 0, top, 0, L / 6, 0, 1, e ? shopCell : gcell, low, col); continue; }
      // 一樓（騎樓的話退到裡面那條線）
      wallQ(g, ca[0], ca[1], cc[0], cc[1], 0, gh, 0, Math.max(1, Math.round(Lc / 6)), 0, 1, e ? shopCell : gcell, low, col);
      // 樓上
      wallQ(g, a[0], a[1], c[0], c[1], gh, top, 0, Math.max(1, Math.round(L / 6)), 0, (top - gh) / 6.4, LISHAN && inPoly(LISHAN, cx, cz) ? 24 : st, col, col);
      if (e === 2 && b.core) { // 騎樓：天花板、柱子
        nArc++;
        quad3(g, [[a[0], gh, a[1]], [ca[0], gh, ca[1]], [cc[0], gh, cc[1]], [c[0], gh, c[1]]], [[0.3, 0.3], [0.3, 0.7], [0.7, 0.7], [0.7, 0.3]], 20, [214, 210, 200]);
        const k = Math.max(1, Math.round(L / 4.5)), ox = (c[1] - a[1]) / L, oz = -(c[0] - a[0]) / L;
        for (let j = 0; j <= k; j++) {
          const t = clamp(j / k, 0.04, 0.96), px = a[0] + (c[0] - a[0]) * t - ox * 0.4, pz = a[1] + (c[1] - a[1]) * t - oz * 0.4;
          boxG(g, px, pz, 0.32, 0.32, rotOf(c[0] - a[0], c[1] - a[1]), 0, gh, shade(col, 0.95), 20, false);
          if (!b.back) colliders.push({ t: 'circle', x: px, z: pz, r: 0.42, h: gh, g: GB + bi });
        }
      }
      // 一樓臨路的店：樓上掛直立招牌（往外伸）
      if (e && b.f >= 3 && L >= 6 && !b.back && vSigns.length < 2200 && hh(bi, 30 + i) < (e === 2 ? 0.95 : 0.45)) {
        const m = Math.min(3, Math.floor(L / 7)); for (let j = 0; j < m; j++) { const t = (j + 0.5) / m, ox = (c[1] - a[1]) / L, oz = -(c[0] - a[0]) / L; vSigns.push({ x: a[0] + (c[0] - a[0]) * t, z: a[1] + (c[1] - a[1]) * t, ox, oz, y0: gh + 0.4, h: Math.min(top - gh - 0.6, 3 + hh(bi, 50 + j) * 2.6), s: Math.floor(hh(bi, 60 + i * 3 + j) * 16) }); }
      }
    }
    // 屋頂
    flatPoly(g, P, top, 6, shade([235, 233, 228], 0.9 + hh(bi, 3) * 0.15), 18);
    // 一樓的頂點顏色暗一點已經有了；頂樓加蓋、水塔、樓梯間
    const rc = b.rect;
    if (rc && !b.back && b.f >= 3) {
      const [rx, rz, hx, hz, rot] = rc, ux = Math.cos(rot), uz = -Math.sin(rot), vx = -uz, vz = ux;
      if (resSt.has(st) && b.f <= 8 && hh(bi, 4) < 0.45 && hx > 3 && hz > 3) { // 頂樓加蓋（鐵皮屋）
        nShed++; const sx = hx * (0.55 + hh(bi, 5) * 0.3), sz = hz * (0.55 + hh(bi, 6) * 0.3), ox = (hh(bi, 7) - 0.5) * (hx - sx), oz = (hh(bi, 8) - 0.5) * (hz - sz), x = rx + ux * ox + vx * oz, z = rz + uz * ox + vz * oz;
        const Q = boxG(g, x, z, sx, sz, rot, top, top + 2.6, [255, 255, 255], 11, false);
        quad3(g, [[Q[0][0], top + 2.6, Q[0][1]], [Q[3][0], top + 2.9, Q[3][1]], [Q[2][0], top + 2.9, Q[2][1]], [Q[1][0], top + 2.6, Q[1][1]]], [[0, 0], [0, sz / 3], [sx / 3, sz / 3], [sx / 3, 0]], 19, [255, 255, 255]);
      }
      if (hh(bi, 9) < 0.6) { const x = rx + ux * hx * 0.6 - vx * hz * 0.5, z = rz + uz * hx * 0.6 - vz * hz * 0.5; boxG(g, x, z, 0.7, 0.7, rot, top, top + 1.5, [222, 226, 230]); } // 水塔
      if (b.f >= 7) boxG(g, rx - ux * hx * 0.3, rz - uz * hx * 0.3, Math.min(2.5, hx * 0.3), Math.min(2, hz * 0.3), rot, top, top + 3, shade(col, 0.95), 20); // 樓梯間
    }
    if (b.col) for (const [x, z, hx, hz, rot] of b.col) colliders.push({ t: 'box', x, z, hx, hz, rot, h: top, g: GB + bi }); // g：同一棟（第 9 批：越野車輾到一個盒子，整棟一起扁）
    nb++;
  });

  // ==== 聯外道路：越野車場的水泥路在村子南邊的口 LINK_J (−112, 94) → 往南直走 → 轉往東 → 內湖西北角的環山路二段（入口） ====
  const LK = (() => {
    const [jx, jz] = LINK_J, E = N.entP, d = N.entDir, W0 = 13.5, pts = []; // 第 9 批（路變大）：9 → 13.5
    const P2 = [E[0] - d[0] * 30, E[1] - d[1] * 30], A = [jx, P2[1] - 45]; // 進範圍前 30 公尺照入口那條路的方向；轉彎前 45 公尺還是往南
    for (let z = jz; z < A[1] - 1; z += 20) pts.push([jx, z]); pts.push(A.slice());
    const nS = pts.length - 1, C1 = [A[0], A[1] + 30], C2 = [P2[0] - d[0] * 30, P2[1] - d[1] * 30];
    for (let i = 1; i <= 16; i++) { const t = i / 16, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, e = t ** 3; pts.push([a * A[0] + b * C1[0] + c * C2[0] + e * P2[0], a * A[1] + b * C1[1] + c * C2[1] + e * P2[1]]); }
    pts.push([E[0] - d[0] * 15, E[1] - d[1] * 15], [E[0], E[1]]);
    // 入口那幾條路（雙向分開的）：寬度要包得住
    let spread = 0; for (const [ri, e] of N.ent) { const r = N.roads[ri], ni = r.n[e ? r.n.length - 1 : 0]; spread = Math.max(spread, Math.abs((nx(ni) - E[0]) * -d[1] + (nz(ni) - E[1]) * d[0]) + r.w / 2); }
    const wEnd = Math.max(13, spread * 2 + 1), nT = pts.length - 1 - nS;
    const w = pts.map((_, i) => (i <= nS ? W0 : W0 + (wEnd - W0) * ss(0.3, 0.95, (i - nS) / nT)));
    w[0] = w[1] = 9; // 村子南邊的口（x −118…−106）那一段跟越野車場的水泥路一樣寬 9 公尺（第 9 批：本來 6）：口兩邊留草地（切太快會慢下來），不要整個路口都鋪成柏油
    let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity, len = 0; for (const [x, z] of pts) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); }
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return { pts, w, wEnd, nS, len, box: [bx0 - 12, bz0 - 12, bx1 + 12, bz1 + 12] };
  })();
  const linkDist = (x, z) => { const P = LK.pts; let bd = Infinity, bi = 1; for (let i = 1; i < P.length; i++) { const d = segD2(x, z, P[i - 1][0], P[i - 1][1], P[i][0], P[i][1]); if (d < bd) { bd = d; bi = i; } } return { d: Math.sqrt(bd), w: LK.w[bi] }; };

  // ==== 山：範圍外面一圈（北邊：越野車場、賽道那邊一道矮山脊，賽車場的草地（x 1250）東邊才是高的金面山；東邊也高；南邊矮；西邊（村子那邊）照聯外道路留一個山谷）====
  // 邊外 12 公尺以內是平的（路、施工欄杆、綠籬）；高度場 hillH(x, z)：範圍裡、邊外 12 公尺 → −0.02（跟地面一樣高）
  const HM = 12;
  const hillH = (x, z) => {
    const ox = x < BX0 ? BX0 - x : x > BX1 ? x - BX1 : 0, oz = z < BZ0 ? BZ0 - z : z > BZ1 ? z - BZ1 : 0; if (ox <= HM && oz <= HM) return -0.02;
    const lx = x - AX, lz = z - AZ, n = Math.sin(lx * 0.0061 + 1.3) * 0.5 + Math.sin(lx * 0.013 + lz * 0.007) * 0.3 + Math.sin(lz * 0.011 - lx * 0.004 + 2) * 0.2; // −1…1
    const rise = (d, H, k) => H * (1 - Math.exp(-Math.max(0, d - HM) / k));
    let h = 0;
    if (z < BZ0) {
      const t = clamp((z - RIDGE_Z) / (BZ0 - HM - RIDGE_Z), 0, 1); // 北：越野車場和範圍中間一道矮山脊（擋住往村子、賽道那邊看的東西）
      h = Math.max(h, 30 * (0.85 + 0.3 * n) * Math.sin(Math.PI * t) ** 0.7 * ss(-70, 10, x));
      h = Math.max(h, (rise(oz, 235, 300) * (0.82 + 0.3 * n) + 80 * Math.exp(-((lx - 900) ** 2 + (lz + 1150) ** 2) / 260 ** 2) * ss(HM, 200, oz)) * ss(1270, 1420, x)); // 賽車場的草地東邊：金面山
    }
    if (z > BZ1) h = Math.max(h, rise(oz, 70, 170) * (0.75 + 0.4 * n)); // 南：矮的
    if (x > BX1) h = Math.max(h, rise(ox, 150, 230) * (0.8 + 0.35 * n)); // 東
    if (x < BX0) h = Math.max(h, 50 * (0.8 + 0.35 * n) * (1 - Math.exp(-Math.max(0, ox - HM) / 110)) * ss(N.entP[1] + 40, N.entP[1] + 140, z)); // 西：入口南邊才有山（北邊是聯外道路、村子）
    if (x < BX0 + 40 && h > 0) { const L = linkDist(x, z); h *= ss(L.w / 2 + 30, L.w / 2 + 110, L.d); } // 聯外道路的山谷（底是平的：網格 25 公尺，三角形不要戳到路面）
    return h - 0.02;
  };

  // ==== 高架：捷運文湖線、國道 ====
  const CON = [204, 204, 198], MRT = [190, 140, 92];
  const portals = [];
  for (const E of N.elev) {
    let P = E.P; const mrt = E.k === 'mrt', dep = mrt ? 1.9 : 2.0, w = E.w;
    const yAt = () => E.y;
    // 範圍外面：山比橋面高的地方切掉，切口做一個隧道口（文湖線往西湖、往內湖站都鑽進山裡）
    let sA = 0, sB = 0;
    { const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
      const Lt = cum[cum.length - 1], at = (s2) => { let i = 1; while (i < P.length - 1 && cum[i] < s2) i++; const t = (s2 - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t]; };
      let s0 = -1, s1 = -1; for (let s2 = 0; s2 <= Lt; s2 += 2) { const q = at(s2); if (inBox(q[0], q[1])) { if (s0 < 0) s0 = s2; s1 = s2; } }
      if (s0 < 0) continue;
      sA = 0; for (let s2 = s0; s2 >= 0; s2 -= 2) { const q = at(s2); if (hillH(q[0], q[1]) > E.y + 1.2) { sA = s2; break; } }
      sB = Lt; for (let s2 = s1; s2 <= Lt; s2 += 2) { const q = at(s2); if (hillH(q[0], q[1]) > E.y + 1.2) { sB = s2; break; } }
      const Q = [at(sA)]; for (let i = 1; i < P.length - 1; i++) if (cum[i] > sA + 0.5 && cum[i] < sB - 0.5) Q.push(P[i]); Q.push(at(sB));
      for (const [s2, sg] of [[sA, 1], [sB, -1]]) if (s2 > 0 && s2 < Lt) { const a = at(s2), b = at(s2 + sg * 2); portals.push({ p: a, ux: (b[0] - a[0]) / 2, uz: (b[1] - a[1]) / 2, w, y: E.y }); }
      P = Q; }
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], c = P[i], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 0.1) continue;
      const ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L, vx = -uz, vz = ux, ya = yAt(a), yc = yAt(c), g = bank('wall', (a[0] + c[0]) / 2, (a[1] + c[1]) / 2, TB), hw = w / 2;
      if (ya < -1 && yc < -1) continue;
      const L1 = [a[0] - vx * hw, a[1] - vz * hw], L2 = [c[0] - vx * hw, c[1] - vz * hw], R1 = [a[0] + vx * hw, a[1] + vz * hw], R2 = [c[0] + vx * hw, c[1] + vz * hw];
      quad3(g, [[L1[0], ya, L1[1]], [R1[0], ya, R1[1]], [R2[0], yc, R2[1]], [L2[0], yc, L2[1]]], [[0.3, 0.3], [0.3, 0.7], [0.7, 0.7], [0.7, 0.3]], 20, mrt ? [170, 168, 160] : [150, 152, 156]); // 上面
      wallQ(g, L2[0], L2[1], L1[0], L1[1], yc - dep, yc, 0.3, 0.7, 0.3, 0.7, 20, CON); // 左邊（從左邊看）
      // 兩邊的面：照頂點的高度（斜的）
      g.grow(8, 12); { const k = g.v; for (const [p, y] of [[L1, ya], [L2, yc]]) { g.vert(p[0], y - dep, p[1], 0.5, 0.5, 190, 190, 184, 20); g.vert(p[0], y + (mrt ? 0.9 : 1.0), p[1], 0.5, 0.5, mrt ? MRT[0] : 210, mrt ? MRT[1] : 210, mrt ? MRT[2] : 205, 20); } g.tri(k, k + 1, k + 3); g.tri(k, k + 3, k + 2); }
      { const k = g.v; for (const [p, y] of [[R1, ya], [R2, yc]]) { g.vert(p[0], y - dep, p[1], 0.5, 0.5, 190, 190, 184, 20); g.vert(p[0], y + (mrt ? 0.9 : 1.0), p[1], 0.5, 0.5, mrt ? MRT[0] : 210, mrt ? MRT[1] : 210, mrt ? MRT[2] : 205, 20); } g.tri(k, k + 2, k + 3); g.tri(k, k + 3, k + 1); }
      g.grow(4, 6); { const k = g.v; for (const [p, y] of [[L1, ya], [R1, ya], [R2, yc], [L2, yc]]) g.vert(p[0], y - dep, p[1], 0.5, 0.5, 150, 150, 146, 20); g.tri(k, k + 2, k + 1); g.tri(k, k + 3, k + 2); } // 底下
    }
    // 橋墩（帽子＋柱子）：範圍外面的不要放在聯外道路上、山裡
    for (const p of E.piers) {
      if (!inBox(p[0], p[1], -2)) { if (hillH(p[0], p[1]) > 1) continue; const L = linkDist(p[0], p[1]); if (L.d < L.w / 2 + 2) continue; }
      let bi = 1, bd = Infinity; for (let i = 1; i < P.length; i++) { const d = segD2(p[0], p[1], P[i - 1][0], P[i - 1][1], P[i][0], P[i][1]); if (d < bd) { bd = d; bi = i; } }
      if (bd > (w / 2) ** 2) continue; // 切掉的那段（山裡）
      const a = P[bi - 1], c = P[bi], rot = rotOf(c[0] - a[0], c[1] - a[1]), y = yAt(p) - dep; if (y < 1.5) continue;
      const g = bank('wall', p[0], p[1], TB), cw = mrt ? 0.9 : 1.1;
      boxG(g, p[0], p[1], cw, cw, rot, 0, y - 1, CON, 20, false);
      boxG(g, p[0], p[1], 1.1, w / 2 - 0.6, rot, y - 1.2, y, shade(CON, 0.95), 20, false);
      colliders.push({ t: 'box', x: p[0], z: p[1], hx: cw, hz: cw, rot, h: y, noCrush: true }); // noCrush：第 9 批（捷運的橋墩，越野車也輾不到）
    }
  }
  for (const t of portals) { // 隧道口：橋面切口一道水泥牆（上面再高一點，下面埋進山裡）、中間黑黑的洞
    const g = bank('wall', t.p[0], t.p[1], TB), rot = rotOf(t.ux, t.uz), vx = -t.uz, vz = t.ux;
    boxG(g, t.p[0] - t.ux * 0.6, t.p[1] - t.uz * 0.6, 0.6, t.w / 2 + 2.2, rot, t.y - 4, t.y + 5.4, shade(CON, 0.92), 20);
    const x = t.p[0] - t.ux * 1.25, z = t.p[1] - t.uz * 1.25, hw = t.w / 2 - 0.4; g.grow(4, 6); const k = g.v;
    for (const [s2, yy] of [[-1, t.y], [1, t.y], [1, t.y + 4.2], [-1, t.y + 4.2]]) g.vert(x + vx * hw * s2, yy, z + vz * hw * s2, 0.5, 0.5, 28, 30, 32, 20);
    g.tri(k, k + 1, k + 2); g.tri(k, k + 2, k + 3); g.tri(k, k + 2, k + 1); g.tri(k, k + 3, k + 2);
  }
  // 路口（三條路以上）附近：jR＋2 公尺以內（轉彎會切過去的地方）
  function nearJunction(x, z) { for (let i = 0; i < deg.length; i++) if (deg[i] >= 3) { const dx = nx(i) - x, dz = nz(i) - z, r = jR[i] + 2; if (dx * dx + dz * dz < r * r) return true; } return false; }
  // ---- 車站（高架的站房）＋站的柱子：照參考照片（港墘站-1、-4、-5、-6、-7：白色站體、綠色玻璃帷幕、兩片灰色波浪屋頂、橘色鋼柱和拱、月台門）----
  const roadAt = mkRoadGrid();
  const ORA = col255('#e2661f'), MET = [150, 156, 162], GLS = [255, 255, 255];
  for (const s of N.stations) {
    const [x, z] = s.p, ux = Math.cos(s.ang), uz = Math.sin(s.ang), vx = -uz, vz = ux, rot = rotOf(ux, uz), hl = s.len / 2, hw = s.w / 2, g = bank('wall', x, z, TB);
    const y0 = 8.6, yg = 15.2, P = [[x - ux * hl - vx * hw, z - uz * hl - vz * hw], [x + ux * hl - vx * hw, z + uz * hl - vz * hw], [x + ux * hl + vx * hw, z + uz * hl + vz * hw], [x - ux * hl + vx * hw, z - uz * hl + vz * hw]];
    quad3(g, [[P[0][0], y0, P[0][1]], [P[1][0], y0, P[1][1]], [P[2][0], y0, P[2][1]], [P[3][0], y0, P[3][1]]], [[0.3, 0.3], [0.3, 0.7], [0.7, 0.7], [0.7, 0.3]], 20, [176, 176, 170]); // 底下
    quad3(g, [[P[3][0], y0 + 0.5, P[3][1]], [P[2][0], y0 + 0.5, P[2][1]], [P[1][0], y0 + 0.5, P[1][1]], [P[0][0], y0 + 0.5, P[0][1]]], [[0, 0], [0, hl / 3], [hw / 3, hl / 3], [hw / 3, 0]], 18, [222, 216, 202]); // 月台地板（米色磁磚）
    // 兩邊：下面月台門（白）、上面綠色的玻璃帷幕
    for (let i = 0; i < 4; i++) { const a = P[i], c = P[(i + 1) % 4], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      wallQ(g, a[0], a[1], c[0], c[1], y0 + 0.5, y0 + 2.4, 0, L / 6, 0, 1, 20, [238, 238, 234]); // 月台門
      wallQ(g, a[0], a[1], c[0], c[1], y0 + 2.4, yg, 0, L / 6, 0, 1, 21, GLS); }
    // 橘色的鋼柱（兩排）＋上面的橫樑、拱的托架
    for (const sd of [-1, 1]) for (let t = -hl + 7; t <= hl - 7; t += 13) {
      const px = x + ux * t + vx * sd * (hw - 1.1), pz = z + uz * t + vz * sd * (hw - 1.1);
      boxG(g, px, pz, 0.42, 0.42, rot, y0 + 0.5, yg + 2.4, ORA, 20, false);
      for (let k2 = 0; k2 < 3; k2++) { const d = 0.6 + k2 * 0.6, yb = yg + 2.4 - 0.55 - k2 * 0.55; boxG(g, px - vx * sd * d, pz - vz * sd * d, 0.3, 0.3 + d / 2, rot, yb, yb + 0.5, ORA, 20, false); } // 樹狀的斜撐
    }
    for (let t = -hl + 7; t <= hl - 7; t += 13) boxG(g, x + ux * t, z + uz * t, 0.3, hw - 0.9, rot, yg + 2.0, yg + 2.4, shade(ORA, 0.92), 20, false); // 橫樑
    // 中間的站房（兩層：下面玻璃、上面白牆）
    const cl = 14, cw = hw + 1.4;
    for (const [i0, y1a, y2a, cell, cc] of [[0, yg, yg + 3.4, 21, GLS], [0, yg + 3.4, yg + 6.2, 20, [242, 242, 238]]]) {
      const Q = [[x - ux * cl - vx * cw, z - uz * cl - vz * cw], [x + ux * cl - vx * cw, z + uz * cl - vz * cw], [x + ux * cl + vx * cw, z + uz * cl + vz * cw], [x - ux * cl + vx * cw, z - uz * cl + vz * cw]];
      for (let i = 0; i < 4; i++) { const a = Q[i], c = Q[(i + 1) % 4], L = Math.hypot(c[0] - a[0], c[1] - a[1]); wallQ(g, a[0], a[1], c[0], c[1], y1a, y2a, 0, L / 6, 0, 1, cell, cc); }
    }
    // 兩片波浪屋頂（彎的金屬板，往外挑出去）：每一邊 4 段
    for (const sd of [-1, 1]) {
      const n = 4, pts = [];
      for (let i = 0; i <= n; i++) { const u = i / n, off = sd * (hw + 3) * (1 - u), yy = yg + 5.6 + 2.6 * Math.sin(u * Math.PI * 0.5) - 1.2 * u * u; pts.push([off, yy]); }
      for (let i = 1; i <= n; i++) { const [o0, y1b] = pts[i - 1], [o1, y2b] = pts[i];
        const A = [x - ux * (hl + 2) + vx * o0, z - uz * (hl + 2) + vz * o0], B = [x + ux * (hl + 2) + vx * o0, z + uz * (hl + 2) + vz * o0];
        const C2 = [x + ux * (hl + 2) + vx * o1, z + uz * (hl + 2) + vz * o1], Dd = [x - ux * (hl + 2) + vx * o1, z - uz * (hl + 2) + vz * o1];
        quad3(g, [[A[0], y1b, A[1]], [B[0], y1b, B[1]], [C2[0], y2b, C2[1]], [Dd[0], y2b, Dd[1]]], [[0.3, 0.3], [0.3, 0.7], [0.7, 0.7], [0.7, 0.3]], 20, shade(MET, sd > 0 ? 1.04 : 0.96));
        quad3(g, [[Dd[0], y2b, Dd[1]], [C2[0], y2b, C2[1]], [B[0], y1b, B[1]], [A[0], y1b, A[1]]], [[0.3, 0.3], [0.3, 0.7], [0.7, 0.7], [0.7, 0.3]], 20, shade(MET, 0.8));
      }
    }
    // 柱子：兩排，路面上不放
    for (const sd of [-1, 1]) for (let t = -hl + 6; t <= hl - 6; t += 14) {
      const px = x + ux * t + vx * sd * (hw - 2), pz = z + uz * t + vz * sd * (hw - 2), rr = roadAt(px, pz); if (rr && rr.d < rr.r.w / 2 + rr.r.sw + 0.4) continue; // 車道、人行道上不放
      if (nearJunction(px, pz)) continue; // 路口轉彎的地方也不放
      boxG(g, px, pz, 0.7, 0.7, rot, 0, y0, CON, 20, false); colliders.push({ t: 'box', x: px, z: pz, hx: 0.7, hz: 0.7, rot, h: y0, noCrush: true });
    }
    // 軌道兩邊：淺綠色的隔音牆（站前後各 130 公尺）
    const mrt = N.elev.find((e) => e.k === 'mrt');
    if (mrt) for (let i = 1; i < mrt.P.length; i++) {
      const a = mrt.P[i - 1], b = mrt.P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue;
      const n = Math.ceil(L / 8);
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n, mx = a[0] + (b[0] - a[0]) * t, mz = a[1] + (b[1] - a[1]) * t, d = Math.hypot(mx - x, mz - z);
        if (d > 130 || d < hl + 2) continue;
        const ex = (b[0] - a[0]) / L, ez = (b[1] - a[1]) / L, ox = -ez, oz = ex, gg = bank('wall', mx, mz, TB);
        for (const sd of [-1, 1]) boxG(gg, mx + ox * sd * (mrt.w / 2 - 0.2), mz + oz * sd * (mrt.w / 2 - 0.2), L / n / 2, 0.08, rotOf(ex, ez), mrt.y + 0.9, mrt.y + 2.5, col255('#a9cf4e'), 20, false);
      }
    }
  }
  // 捷運出入口：港墘站的照參考照片（港墘站-2：灰色鋁板的罩子、花崗岩的台座、金色的站名牌）；別站的是玻璃的小房子
  const gq = N.stations.find((s2) => s2.nm === '港墘');
  for (const e of N.entr) {
    const [x, z] = e.p, g = bank('wall', x, z, TB), ux = Math.cos(e.ang), uz = Math.sin(e.ang), rot = rotOf(ux, uz), near = gq && Math.hypot(x - gq.p[0], z - gq.p[1]) < 130;
    if (near) {
      boxG(g, x, z, 4.0, 2.2, rot, 0, 0.5, [176, 170, 160], 20, false); // 花崗岩台座
      const Q = boxG(g, x, z, 3.7, 2.0, rot, 0.5, 3.6, [196, 200, 204], 20, false); // 鋁板的罩子
      quad3(g, [[Q[0][0], 3.9, Q[0][1]], [Q[3][0], 3.9, Q[3][1]], [Q[2][0], 3.9, Q[2][1]], [Q[1][0], 3.9, Q[1][1]]], [[0.3, 0.3], [0.3, 0.7], [0.7, 0.7], [0.7, 0.3]], 20, [150, 156, 160]);
      for (let i = 0; i < 4; i++) { const a = Q[i], c = Q[(i + 1) % 4]; wallQ(g, a[0], a[1], c[0], c[1], 3.6, 3.9, 0.3, 0.7, 0.3, 0.7, 20, [168, 172, 176]); }
      colliders.push({ t: 'box', x, z, hx: 4.0, hz: 2.2, rot, h: 3.9, noCrush: true }); // 捷運站的出入口（第 9 批：不輾）
    } else {
      const Q = boxG(g, x, z, 3.8, 1.9, rot, 0, 3.4, [255, 255, 255], 21, false);
      quad3(g, [[Q[0][0], 3.6, Q[0][1]], [Q[3][0], 3.6, Q[3][1]], [Q[2][0], 3.6, Q[2][1]], [Q[1][0], 3.6, Q[1][1]]], [[0.3, 0.3], [0.3, 0.7], [0.7, 0.7], [0.7, 0.3]], 20, [120, 128, 136]);
      colliders.push({ t: 'box', x, z, hx: 3.8, hz: 1.9, rot, h: 3.5, noCrush: true });
    }
  }

  // ==== 路網（路由、地面種類、小地圖都用）====
  function mkRoadGrid() { // 15 公尺一格：每一格經過的路段；roadAt(x, z) → 最近的 { r, k, d }
    const G = 15, grid = new Map(), key = (i, j) => i * 73856093 + j;
    N.roads.forEach((r, ri) => { for (let k = 1; k < r.n.length; k++) { const a = r.n[k - 1], b = r.n[k], m = r.w / 2 + r.sw + 1; for (let i = Math.floor((Math.min(nx(a), nx(b)) - m) / G); i <= Math.floor((Math.max(nx(a), nx(b)) + m) / G); i++) for (let j = Math.floor((Math.min(nz(a), nz(b)) - m) / G); j <= Math.floor((Math.max(nz(a), nz(b)) + m) / G); j++) { const kk = key(i, j); let L = grid.get(kk); if (!L) grid.set(kk, (L = [])); L.push(ri, k); } } });
    const out = { r: null, k: 0, d: 0 };
    return (x, z) => {
      const L = grid.get(key(Math.floor(x / G), Math.floor(z / G))); if (!L) return null; let best = Infinity, br = -1, bk = 0;
      for (let i = 0; i < L.length; i += 2) { const r = N.roads[L[i]], k = L[i + 1], a = r.n[k - 1], b = r.n[k], d = Math.sqrt(segD2(x, z, nx(a), nz(a), nx(b), nz(b))) - r.w / 2; if (d < best) { best = d; br = L[i]; bk = k; } }
      if (br < 0) return null; out.r = N.roads[br]; out.k = bk; out.d = best + out.r.w / 2; return out;
    };
  }


  // ==== 路面：柏油、人行道、標線 ====
  const ASPH = [255, 255, 255], ASPH2 = [236, 236, 240];
  function strip(gk, P, W, y, c, uvS, sizeKey) { // 一條（每段一個長方形，轉角補一個圓）
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.01) continue;
      const w0 = (Array.isArray(W) ? W[i - 1] : W) / 2, w1 = (Array.isArray(W) ? W[i] : W) / 2, vx = -(b[1] - a[1]) / L, vz = (b[0] - a[0]) / L, g = bank(gk, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, sizeKey);
      g.grow(4, 6); const k = g.v;
      for (const [x, z] of [[a[0] - vx * w0, a[1] - vz * w0], [b[0] - vx * w1, b[1] - vz * w1], [b[0] + vx * w1, b[1] + vz * w1], [a[0] + vx * w0, a[1] + vz * w0]]) g.vert(x, y, z, x / uvS, -z / uvS, c[0], c[1], c[2], 0);
      g.tri(k, k + 2, k + 1); g.tri(k, k + 3, k + 2);
    }
  }
  function disc(gk, x, z, r, y, c, uvS, seg = 12) { const g = bank(gk, x, z, TG); g.grow(seg + 1, seg * 3); const k = g.v; g.vert(x, y, z, x / uvS, -z / uvS, c[0], c[1], c[2], 0); for (let i = 0; i < seg; i++) { const a = (i / seg) * TAU, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; g.vert(px, y, pz, px / uvS, -pz / uvS, c[0], c[1], c[2], 0); } for (let i = 0; i < seg; i++) g.tri(k, k + 1 + ((i + 1) % seg), k + 1 + i); }
  const rpts = (r) => r.n.map((i) => [nx(i), nz(i)]);
  for (const r of N.roads) {
    const P = rpts(r), cA = r.cls <= 2 ? ASPH : ASPH2;
    strip('road', P, r.w, 0.03, cA, 8, TG);
    for (let i = 0; i < r.n.length; i++) { const ni = r.n[i]; if (deg[ni] >= 2) disc('road', nx(ni), nz(ni), (i === 0 || i === r.n.length - 1) && deg[ni] === 1 ? r.w / 2 : Math.max(r.w / 2, deg[ni] >= 3 ? jR[ni] - r.sw * 0.6 : r.w / 2), 0.03, cA, 8, deg[ni] >= 3 ? 16 : 10); }
    if (r.sw > 0) { strip('walk', P, r.w + 2 * r.sw, 0.022, WHITE, 2, TG); for (const ni of r.n) disc('walk', nx(ni), nz(ni), r.w / 2 + r.sw, 0.022, WHITE, 2, 12); }
  }
  // 聯外道路（柏油、兩邊護欄）
  const LKP = [[LINK_J[0], 110], ...LK.pts.slice(1)]; // 越野車場的水泥路（寬 6、z 109 以北轉東）那段不疊：z 110 以南才鋪；接口那塊低一點點（水泥路蓋在上面）
  strip('road', LKP, [LK.w[0], ...LK.w.slice(1)], 0.03, ASPH, 8, TG); strip('road', [LINK_J, [LINK_J[0], 111]], [LK.w[0], LK.w[0]], 0.008, ASPH, 8, TG);
  // ---- 標線 ----
  const YEL = col255('#f2c230'), WHT = [242, 242, 238], RED = [200, 40, 32];
  function line(P, off, w, y, c, dash, gap, t0, t1) { // 沿著折線、往右 off 公尺、寬 w；dash＝0 實線
    let s0 = 0;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.01) { continue; }
      const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, vx = -uz, vz = ux, lo = Math.max(0, t0 - s0), hi = Math.min(L, t1 - s0);
      if (hi > lo) {
        const pieces = [];
        if (!dash) pieces.push([lo, hi]); else { const per = dash + gap; let s = Math.ceil((s0 + lo) / per) * per - s0; for (; s < hi; s += per) { const e = Math.min(hi, s + dash); if (e > Math.max(s, lo)) pieces.push([Math.max(s, lo), e]); } }
        const g = bank('paint', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, TG);
        for (const [p0, p1] of pieces) { g.grow(4, 6); const k = g.v, A = [a[0] + ux * p0 + vx * off, a[1] + uz * p0 + vz * off], B = [a[0] + ux * p1 + vx * off, a[1] + uz * p1 + vz * off], hw = w / 2;
          for (const [x, z] of [[A[0] - vx * hw, A[1] - vz * hw], [B[0] - vx * hw, B[1] - vz * hw], [B[0] + vx * hw, B[1] + vz * hw], [A[0] + vx * hw, A[1] + vz * hw]]) g.vert(x, y, z, 0, 0, c[0], c[1], c[2], 0);
          g.tri(k, k + 2, k + 1); g.tri(k, k + 3, k + 2); }
      }
      s0 += L;
    }
  }
  const plen = (P) => { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; };
  N.roads.forEach((r, ri) => {
    const P = rpts(r), L = plen(P), ia = r.n[0], ib = r.n[r.n.length - 1];
    const t0 = deg[ia] >= 3 ? jR[ia] + 1.5 : 0, t1 = L - (deg[ib] >= 3 ? jR[ib] + 1.5 : 0); if (t1 - t0 < 3) return;
    const y = 0.05, hw = r.w / 2, w0 = r.w / (D.wide || 1); // 第 9 批：標線照原本的路寬（車道數一樣、每條變寬）
    if (!r.ow) {
      if (w0 >= 8.5) { line(P, -0.13, 0.13, y, YEL, 0, 0, t0, t1); line(P, 0.13, 0.13, y, YEL, 0, 0, t0, t1); }
      else if (w0 >= 6.4) line(P, 0, 0.12, y, YEL, 4, 6, t0, t1);
      const lanes = Math.floor((w0 / 2 - 0.5) / 3.1); for (let k = 1; k < lanes; k++) for (const s of [-1, 1]) line(P, s * k * (hw / lanes), 0.12, y, WHT, 4, 6, t0, t1);
    } else { const lanes = Math.max(1, Math.floor((w0 - 0.6) / 3.1)); for (let k = 1; k < lanes; k++) line(P, -hw + (k * r.w) / lanes, 0.12, y, WHT, 4, 6, t0, t1); }
    if (r.cls <= 3) { line(P, -hw + 0.3, 0.15, y, WHT, 0, 0, t0, t1); line(P, hw - 0.3, 0.15, y, WHT, 0, 0, t0, t1); }
    else if (w0 >= 4.5 && hh(ri, 1) < 0.55) { const c = hh(ri, 2) < 0.7 ? RED : YEL; line(P, -hw + 0.25, 0.12, y, c, 0, 0, t0, t1); line(P, hw - 0.25, 0.12, y, c, 0, 0, t0, t1); } // 紅線（不能停車）
    // 停止線（大路口前面，自己這個方向那半邊）
    if (r.cls <= 3) for (const [end, ni] of [[1, ib], [0, ia]]) {
      if (deg[ni] < 3) continue; if (r.ow === 1 && !end) continue; if (r.ow === -1 && end) continue;
      const s = end ? t1 - 0.4 : t0 + 0.4, from = r.ow ? -hw + 0.3 : end ? 0.2 : -hw + 0.3, to = r.ow ? hw - 0.3 : end ? hw - 0.3 : -0.2; // 往右開的那邊：從終點看是右邊
      const lo = end ? from : -to, hi = end ? to : -from; line(P, (lo + hi) / 2, hi - lo, y, WHT, 0, 0, s - 0.25, s + 0.25);
    }
  });
  // 聯外道路的標線
  { const P = LKP, L = plen(P), Ls = plen(LKP.slice(0, LK.nS + 1)); line(P, -0.13, 0.13, 0.05, YEL, 0, 0, 6, L - 20); line(P, 0.13, 0.13, 0.05, YEL, 0, 0, 6, L - 20); line(P, -6.45, 0.15, 0.05, WHT, 0, 0, 6, Ls); line(P, 6.45, 0.15, 0.05, WHT, 0, 0, 6, Ls); }
  // 斑馬線
  for (const c of N.cross) {
    const ux = Math.cos(c.ang), uz = Math.sin(c.ang), vx = -uz, vz = ux, n = Math.max(3, Math.floor((c.w - 0.6) / 1.0)), g = bank('paint', c.p[0], c.p[1], TG);
    for (let i = 0; i < n; i++) { const off = -c.w / 2 + 0.5 + (i + 0.5) * ((c.w - 1) / n), x = c.p[0] + vx * off, z = c.p[1] + vz * off; g.grow(4, 6); const k = g.v;
      for (const [a, b] of [[-1.8, -0.22], [1.8, -0.22], [1.8, 0.22], [-1.8, 0.22]]) g.vert(x + ux * a + vx * b, 0.052, z + uz * a + vz * b, 0, 0, 240, 240, 236, 0);
      g.tri(k, k + 2, k + 1); g.tri(k, k + 3, k + 2); }
  }

  // ==== 地面：範圍裡水泥地（50 公尺一格）、邊外 12 公尺一圈草地（再外面是山的網格，接得剛好）====
  {
    const CC = [196, 192, 184], GR = col255('#8d9a6b');
    const xs = [BX0 - HM], zs = [BZ0 - HM]; for (let x = BX0; x < BX1; x += 50) xs.push(x); xs.push(BX1, BX1 + HM); for (let z = BZ0; z < BZ1; z += 50) zs.push(z); zs.push(BZ1, BZ1 + HM);
    for (let i = 1; i < xs.length; i++) for (let j = 1; j < zs.length; j++) {
      const x0 = xs[i - 1], x1 = xs[i], z0 = zs[j - 1], z1 = zs[j], mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, c = inBox(mx, mz) ? CC : GR;
      if (x1 - x0 < 0.01 || z1 - z0 < 0.01) continue;
      const g = bank('ground', mx, mz, TG); g.grow(4, 6); const k = g.v;
      for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) g.vert(x, -0.02, z, x / 4, -z / 4, c[0], c[1], c[2], 0);
      g.tri(k, k + 3, k + 2); g.tri(k, k + 2, k + 1);
    }
  }
  // 公園、學校、球場、水池⋯（地上的多邊形）
  const AC = { park: col255('#7fa35c'), school: [214, 206, 188], pitch: col255('#5f9a48'), track: col255('#b55a40'), court: col255('#4c8a78'), water: col255('#5b8fbf'), play: col255('#cbb48c'), parking: [150, 152, 156], plaza: [214, 208, 196], site: col255('#a48e6c') };
  const AY = { school: 0.006, park: 0.008, parking: 0.009, plaza: 0.009, site: 0.008, pitch: 0.011, play: 0.011, court: 0.012, track: 0.012, water: 0.013 };
  const LMSKIP = []; // 地標自己畫的那幾塊（碧湖的湖、國小的操場、游泳池⋯）：一般的地面不要再鋪一次（高度差幾公釐會閃）
  for (const L of Object.values(N.lm || {})) for (const [k, P] of Object.entries(L)) { if (k === 'nm' || k === 'sign' || k === 'p' || k === 'bridge') continue; let x = 0, z = 0; for (const q of P) { x += q[0]; z += q[1]; } LMSKIP.push([x / P.length, z / P.length]); }
  for (const a of N.areas.slice().sort((p, q) => (AY[p.t] || 0) - (AY[q.t] || 0))) { let cx = 0, cz = 0; for (const p of a.P) { cx += p[0]; cz += p[1]; } cx /= a.P.length; cz /= a.P.length;
    if (LMSKIP.some((q) => Math.hypot(q[0] - cx, q[1] - cz) < 2.5)) continue;
    flatPoly(bank('area', cx, cz, TG), a.P, AY[a.t] || 0.01, 4, AC[a.t] || WHITE); }

  // ==== 山的網格：x 西邊 600、東邊 700 公尺外，z 北邊 850、南邊 600 公尺外；格線對齊「邊外 12 公尺」那一圈（裡面不要）；
  //      世界本來的草地上（worldGround）平的格子不畫（草地已經有了），山腳平的點壓低 6 公分（草地蓋過去，不會閃）====
  let hillTris = 0, hillMesh;
  {
    const S = 25, axis = (a, b, c, d) => { const o = []; const n1 = Math.max(1, Math.round((b - a) / S)); for (let i = 0; i < n1; i++) o.push(a + ((b - a) * i) / n1); const n2 = Math.max(1, Math.round((c - b) / S)); for (let i = 0; i < n2; i++) o.push(b + ((c - b) * i) / n2); const n3 = Math.max(1, Math.round((d - c) / S)); for (let i = 0; i <= n3; i++) o.push(c + ((d - c) * i) / n3); return o; };
    const xs = axis(BX0 - 600, BX0 - HM, BX1 + HM, BX1 + 700), zs = axis(BZ0 - 850, BZ0 - HM, BZ1 + HM, BZ1 + 600), nI = xs.length, nJ = zs.length;
    const g = new Geo(false), R2 = rng(5), G1 = col255('#55703f'), G2 = col255('#6f8a4a'), G3 = col255('#7d8f62'), GF = col255('#8d9a6b');
    const idx = new Int32Array(nI * nJ);
    for (let j = 0; j < nJ; j++) for (let i = 0; i < nI; i++) {
      const x = xs[i], z = zs[j], h = hillH(x, z), t = clamp(h / 220, 0, 1), r = R2(), f = ss(0, 6, h); // 山腳：跟草地一樣的顏色
      const c = [G1[0] + (G3[0] - G1[0]) * t + (G2[0] - G1[0]) * r * 0.5, G1[1] + (G3[1] - G1[1]) * t + (G2[1] - G1[1]) * r * 0.5, G1[2] + (G3[2] - G1[2]) * t];
      const y = h <= 0 && worldGround(x, z) && !inBox(x, z, -HM - 0.5) ? -0.06 : h;
      g.grow(1, 0); idx[j * nI + i] = g.vert(x, y, z, 0, 0, GF[0] + (c[0] - GF[0]) * f, GF[1] + (c[1] - GF[1]) * f, GF[2] + (c[2] - GF[2]) * f, 0);
    }
    for (let j = 0; j < nJ - 1; j++) for (let i = 0; i < nI - 1; i++) {
      const mx = (xs[i] + xs[i + 1]) / 2, mz = (zs[j] + zs[j + 1]) / 2; if (mx > BX0 - HM && mx < BX1 + HM && mz > BZ0 - HM && mz < BZ1 + HM) continue; // 範圍裡（地面自己鋪）
      const a = idx[j * nI + i], b = idx[j * nI + i + 1], c = idx[(j + 1) * nI + i + 1], d = idx[(j + 1) * nI + i];
      if (worldGround(mx, mz) && Math.max(g.p[a * 3 + 1], g.p[b * 3 + 1], g.p[c * 3 + 1], g.p[d * 3 + 1]) < 0.05) continue; // 世界的草地上平的：不用畫
      g.grow(0, 6); g.tri(a, d, c); g.tri(a, c, b); hillTris += 2;
    }
    hillMesh = new THREE.Mesh(g.geometry(), mats.hill); hillMesh.name = 'nh-hill'; hillMesh.matrixAutoUpdate = false;
  }
  // 範圍的邊：一圈綠籬（矮）＋碰撞；路開出去的地方空著（施工欄杆擋）、西邊的入口（聯外道路）開口
  {
    const E = N.entP, half = LK.wEnd / 2 + 3, C = [[BX0, BZ0], [BX1, BZ0], [BX1, BZ1], [BX0, BZ1]];
    for (let s2 = 0; s2 < 4; s2++) {
      const A = C[s2], B = C[(s2 + 1) % 4], L = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.ceil(L / 8), rot = rotOf(B[0] - A[0], B[1] - A[1]);
      for (let i = 0; i < n; i++) {
        const m = [A[0] + ((B[0] - A[0]) * (i + 0.5)) / n, A[1] + ((B[1] - A[1]) * (i + 0.5)) / n], l = L / n;
        if (Math.hypot(m[0] - E[0], m[1] - E[1]) < half) continue;
        const rr = roadAt(m[0], m[1]); if (rr && rr.d < rr.r.w / 2 + rr.r.sw + l / 2 + 0.5) continue;
        boxG(bank('wall', m[0], m[1], TB), m[0], m[1], l / 2 + 0.05, 0.45, rot, 0, 1.25, col255('#3f6b35'), 20);
        colliders.push({ t: 'box', x: m[0], z: m[1], hx: l / 2 + 0.3, hz: 0.6, rot, h: 1.3 });
      }
    }
  }
  // 聯外道路的護欄（兩邊）
  {
    const P = LK.pts; for (const sd of [-1, 1]) for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), vx = -(b[1] - a[1]) / L, vz = (b[0] - a[0]) / L, wa = LK.w[i - 1] / 2 + 0.6, wb = LK.w[i] / 2 + 0.6;
      const A = [a[0] + vx * sd * wa, a[1] + vz * sd * wa], B = [b[0] + vx * sd * wb, b[1] + vz * sd * wb]; if (inBox(B[0], B[1], -1) || Math.hypot(A[0] - LINK_J[0], A[1] - LINK_J[1]) < 18) continue; // 岔出來的路口（越野車場的水泥路）沒有護欄
      const m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], rot = rotOf(B[0] - A[0], B[1] - A[1]), l = Math.hypot(B[0] - A[0], B[1] - A[1]);
      boxG(bank('wall', m[0], m[1], TB), m[0], m[1], l / 2 + 0.02, 0.12, rot, 0.35, 0.85, [214, 218, 222], 20);
      if (i % 2) boxG(bank('wall', A[0], A[1], TB), A[0], A[1], 0.08, 0.08, rot, 0, 0.85, [170, 172, 176], 20, false);
      colliders.push({ t: 'box', x: m[0], z: m[1], hx: l / 2 + 0.05, hz: 0.25, rot, h: 0.9, noCrush: true }); // 第 9 批：聯外道路的護欄不輾（山谷）
    }
  }

  // ==== 牌子：路名牌（柱子＋兩面）、公園學校的牌子、車站的站名、往內湖的指示牌、施工欄杆、直立招牌 ====
  const sg = new Geo(false);
  const sq = (P, uv, c = WHITE) => { sg.grow(4, 6); const k = sg.v; for (let i = 0; i < 4; i++) sg.vert(P[i][0], P[i][1], P[i][2], uv[i][0], uv[i][1], c[0], c[1], c[2], 0); sg.tri(k, k + 1, k + 2); sg.tri(k, k + 2, k + 3); };
  const plate = (x, y, z, ux, uz, w, h, uv, two = true) => { // 直立的牌子（中心 x y z，沿 (ux, uz) 寬 w、高 h），兩面都看得到字
    const a = [x - ux * w / 2, z - uz * w / 2], b = [x + ux * w / 2, z + uz * w / 2], [u0, v0, u1, v1] = uv;
    sq([[a[0], y - h / 2, a[1]], [b[0], y - h / 2, b[1]], [b[0], y + h / 2, b[1]], [a[0], y + h / 2, a[1]]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
    if (two) sq([[b[0], y - h / 2, b[1]], [a[0], y - h / 2, a[1]], [a[0], y + h / 2, a[1]], [b[0], y + h / 2, b[1]]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  };
  { // 路名牌
    const posts = new Map();
    for (const s of N.signs) {
      const uv = SA.uv['n' + s.n]; if (!uv) continue; const key = Math.round(s.p[0]) + ',' + Math.round(s.p[1]); const k = posts.get(key) || 0; posts.set(key, k + 1);
      if (!k) { boxG(bank('wall', s.p[0], s.p[1], TB), s.p[0], s.p[1], 0.06, 0.06, 0, 0, 3.75 + 0.3, [150, 156, 160], 20); colliders.push({ t: 'circle', x: s.p[0], z: s.p[1], r: 0.12, h: 4 }); }
      const ux = Math.cos(s.ang), uz = Math.sin(s.ang); plate(s.p[0] + ux * 0.62, 3.95 - k * 0.34, s.p[1] + uz * 0.62, ux, uz, 1.2, 0.26, uv);
    }
  }
  // ---- 大路的路名牌（Nick 2026-10-05「主要街道（十米寬以上）可以掛路牌讓我看得出我在什麼路上嗎?」）----
  //   真的寬度（車道＋兩邊人行道，OSM 的車道數／width 算出來的）≥ 10 公尺的路：每個大路口前面、長的路每 250 公尺，右邊一根桿子伸一支橫桿到近車道上面，
  //   藍底白字朝著開過來的人（40 公尺外看得到：牌子 4.6 × 0.95 公尺、字約 0.5 公尺高）；下面小的那面是前面那條路的名字
  const bigSigns = []; // [x, z, 開過來的方向 ux, uz, 路名]（測試、截圖用）
  {
    const BIG_W = 10, GAP = 250, AT_J = 13; // 路口前 13 公尺
    const atNode = new Map(); // 點 → 經過的路（有名字的）
    N.roads.forEach((r) => { if (r.nm < 0) return; r.n.forEach((ni, i) => { let a = atNode.get(ni); if (!a) atNode.set(ni, (a = [])); a.push(r); }); });
    const crossUV = (ni, r) => { const L = atNode.get(ni); if (!L) return null; let best = null; for (const o of L) if (o.nm >= 0 && o.nm !== r.nm && (!best || o.w > best.w)) best = o; return best ? SA.uv['n' + best.nm] : null; };
    const post = (px, pz, ux, uz, w, uv, uv2, nm) => { // 桿子（右邊）、橫桿、牌子（朝 −u）
      const rx = -uz, rz = ux, g = bank('wall', px, pz, TB), arm = Math.min(5.5, w * 0.3 + 1.4), cx = px - rx * arm, cz = pz - rz * arm;
      boxG(g, px, pz, 0.14, 0.14, 0, 0, 6.3, [148, 152, 156], 20); // 柱子
      boxG(g, (px + cx) / 2, (pz + cz) / 2, arm / 2, 0.09, rotOf(rx, rz), 6.0, 6.25, [148, 152, 156], 20, false); // 橫桿
      colliders.push({ t: 'circle', x: px, z: pz, r: 0.22, h: 6.3, reach: arm + 1 }); bigSigns.push([cx, cz, ux, uz, nm]);
      plate(cx, 5.3, cz, rx, rz, 4.6, 0.95, uv, false);
      if (uv2) plate(cx, 4.5, cz, rx, rz, 3.3, 0.68, uv2, false);
    };
    for (const r of N.roads) {
      if (r.nm < 0 || r.w / (D.wide || 1) + 2 * r.sw < BIG_W) continue; // 第 9 批：照原本的路寬挑（同一批路）
      const P = rpts(r), n = P.length; if (n < 2) continue;
      const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
      const L = cum[n - 1]; if (L < 25) continue;
      const at = (s2) => { let i = 1; while (i < n - 1 && cum[i] < s2) i++; const t = (s2 - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t, (P[i][0] - P[i - 1][0]) / (cum[i] - cum[i - 1] || 1), (P[i][1] - P[i - 1][1]) / (cum[i] - cum[i - 1] || 1)]; };
      const uv = SA.uv['n' + r.nm]; if (!uv) continue;
      const want = []; // [路上的距離, 往前（1）還是往後（−1）開, 前面那條路的牌子]
      for (let i = 0; i < n; i++) { const ni = r.n[i]; if (deg[ni] < 3) continue; const cu = crossUV(ni, r);
        if (r.ow >= 0 && cum[i] > AT_J + 6) want.push([cum[i] - AT_J, 1, cu]); // 往前開的人：路口前面
        if (r.ow <= 0 && cum[i] < L - AT_J - 6) want.push([cum[i] + AT_J, -1, cu]); }
      for (let s2 = GAP / 2; s2 < L; s2 += GAP) for (const d of [1, -1]) { if (d > 0 && r.ow < 0) continue; if (d < 0 && r.ow > 0) continue; if (!want.some((w) => w[1] === d && Math.abs(w[0] - s2) < 90)) want.push([s2, d, null]); }
      want.sort((a, b) => a[0] - b[0]);
      let last = { 1: -1e9, '-1': -1e9 };
      for (const [s2, d, cu] of want) {
        if (s2 < 8 || s2 > L - 8) continue; if (s2 - last[d] < 60) continue;
        const [x, z, dx, dz] = at(s2), ux = dx * d, uz = dz * d, rx = -uz, rz = ux; // 往右（開過去的右手邊）
        const px = x + rx * (r.w / 2 + r.sw * 0.5 + 0.8), pz = z + rz * (r.w / 2 + r.sw * 0.5 + 0.8);
        const rr = roadAt(px, pz); if (rr && rr.r !== r && rr.d < rr.r.w / 2 + 0.6) continue; // 別條路的車道上不放
        if (!inBox(px, pz, 2)) continue;
        last[d] = s2; post(px, pz, ux, uz, r.w, uv, cu, D.names[r.nm][0]);
      }
    }
  }
  for (const s of N.nsigns) { // 公園、學校的牌子（路邊，矮的）
    const bi = bIdx((b) => b.nm === s.nm), uv = SA.uv['b' + bi]; if (!uv) continue; const ux = Math.cos(s.ang), uz = Math.sin(s.ang);
    boxG(bank('wall', s.p[0], s.p[1], TB), s.p[0], s.p[1], 1.55, 0.18, rotOf(ux, uz), 0, 1.0, s.t === 'school' ? [190, 180, 170] : [150, 146, 136], 20);
    plate(s.p[0], 1.42, s.p[1], ux, uz, 2.9, 0.78, uv, true); colliders.push({ t: 'box', x: s.p[0], z: s.p[1], hx: 1.55, hz: 0.25, rot: rotOf(ux, uz), h: 1.8 });
  }
  for (const s of N.stations) { // 站名（站房的兩邊）
    const uv = SA.uv['b' + bIdx((b) => b.t === 'station' && b.nm === s.nm)]; if (!uv) continue; const ux = Math.cos(s.ang), uz = Math.sin(s.ang), vx = -uz, vz = ux;
    for (const sd of [-1, 1]) { const x = s.p[0] + vx * sd * (s.w / 2 + 0.08), z = s.p[1] + vz * sd * (s.w / 2 + 0.08); plate(x, 13.6, z, ux * -sd, uz * -sd, 11, 2.9, uv, false); }
  }
  { // 聯外道路：往內湖的指示牌（門架）＋回程的
    const P = LK.pts, gtry = (i, back) => {
      const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, vx = -uz, vz = ux, hw = LK.w[i] / 2 + 1.2, gw = bank('wall', a[0], a[1], TB);
      for (const sd of [-1, 1]) { boxG(gw, a[0] + vx * sd * hw, a[1] + vz * sd * hw, 0.18, 0.18, 0, 0, 7.2, [160, 166, 170], 20); colliders.push({ t: 'circle', x: a[0] + vx * sd * hw, z: a[1] + vz * sd * hw, r: 0.3, h: 7.2, noCrush: true }); }
      boxG(gw, a[0], a[1], 0.15, hw, rotOf(ux, uz), 6.9, 7.2, [160, 166, 170], 20);
      const uv = SA.uv['b' + bIdx((bb) => bb.t === 'guide' && !bb.arrow && (back ? bb.nm !== '內湖' : bb.nm === '內湖'))];
      if (uv) { const s = back ? 1 : -1; plate(a[0] + ux * 0.2 * s + vx * 2.2, 5.6, a[1] + uz * 0.2 * s + vz * 2.2, vx * -s, vz * -s, 5.2, 1.4, uv, false); } // 牌子朝開過來的人
    };
    const at = (s0) => { let acc = 0; for (let i = 1; i < P.length; i++) { acc += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (acc >= s0) return i - 1; } return P.length - 2; };
    gtry(at(45), false); gtry(at(LK.len - 70), true); // 進來 45 公尺：「內湖」；出去（離入口 70 公尺）：「往 村子・越野車場」
    // 農路往南開的人（村子南邊的口前面）：路邊一面「內湖 ↑」（直走；越野車場往左轉）
    const uv = SA.uv['b' + bIdx((bb) => bb.t === 'guide' && !bb.arrow && bb.nm === '內湖')], sx = LINK_J[0] + 7, sz = LINK_J[1] - 20;
    boxG(bank('wall', sx, sz, TB), sx, sz, 0.08, 0.08, 0, 0, 3.4, [160, 166, 170], 20); colliders.push({ t: 'circle', x: sx, z: sz, r: 0.15, h: 3.4 });
    if (uv) plate(sx, 3.0, sz - 0.12, -1, 0, 3.6, 0.96, uv, false); // 正面朝北（往南開過來的人看得到）
  }
  for (const bar of N.bars) { // 施工欄杆
    const ux = Math.cos(bar.ang), uz = Math.sin(bar.ang), vx = -uz, vz = ux, w = bar.w, uv = SA.uv['b' + bIdx((b) => b.t === 'work')], gw = bank('wall', bar.p[0], bar.p[1], TB);
    const n = Math.max(1, Math.round(w / 3.2));
    for (let i = 0; i < n; i++) { const off = -w / 2 + (i + 0.5) * (w / n), x = bar.p[0] + vx * off, z = bar.p[1] + vz * off; if (uv) plate(x, 0.85, z, vx, vz, w / n - 0.15, 0.62, uv, true); for (const s of [-1, 1]) boxG(gw, x + vx * s * (w / n / 2 - 0.2), z + vz * s * (w / n / 2 - 0.2), 0.05, 0.05, 0, 0, 1.2, [235, 235, 235], 20); }
    colliders.push({ t: 'box', x: bar.p[0], z: bar.p[1], hx: w / 2 + 0.5, hz: 0.35, rot: rotOf(vx, vz), h: 1.2, noCrush: true }); // 第 9 批：路封起來的欄杆（範圍的邊）不輾
  }
  for (const s of vSigns) { // 直立招牌：從牆往外伸 0.9 公尺、兩面都有字
    const uv = SA.uv['v' + s.s]; if (!uv) continue; const x = s.x + s.ox * 0.55, z = s.z + s.oz * 0.55, ymid = s.y0 + s.h / 2;
    plate(x, ymid, z, s.ox, s.oz, 0.9, s.h, uv, true);
  }
  // ==== 七個地標（Nick 2026-10-05「我只需要下面幾個跟實景一樣就好（位置也要正確喔）」）====
  //   形狀、位置都是 OSM 的（neihu-conv.mjs 的 lm）；外觀照 Nick 給的參考照片（/mnt/project-files/tune-game/neihu-photos）手工做，照片沒有進遊戲
  {
    const LMP = N.lm || {};
    const cenOf = (P) => { let x = 0, z = 0; for (const p of P) { x += p[0]; z += p[1]; } return [x / P.length, z / P.length]; };
    const grow = (P, d) => { const c = cenOf(P); return P.map((p) => { const dx = p[0] - c[0], dz = p[1] - c[1], l = Math.hypot(dx, dz) || 1; return [p[0] + (dx / l) * d, p[1] + (dz / l) * d]; }); }; // 往外（d＜0 往裡面）
    const fan = (g, x, z, r, y, c, seg = 8, cell = 20, up = true) => { // 圓的蓋子
      g.grow(seg + 1, seg * 3); const k = g.vert(x, y, z, 0.5, 0.5, c[0], c[1], c[2], cell);
      for (let i = 0; i < seg; i++) { const a = (i / seg) * TAU; g.vert(x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0.5 + Math.cos(a) * 0.2, 0.5 + Math.sin(a) * 0.2, c[0], c[1], c[2], cell); }
      for (let i = 0; i < seg; i++) { const a = k + 1 + i, b = k + 1 + ((i + 1) % seg); if (up) g.tri(k, b, a); else g.tri(k, a, b); }
    };
    const cyl = (g, x, z, r, y0, y1, c, seg = 8, cell = 20, cap = true) => { // 圓柱（八角）
      for (let i = 0; i < seg; i++) { const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU; wallQ(g, x + Math.cos(a1) * r, z + Math.sin(a1) * r, x + Math.cos(a0) * r, z + Math.sin(a0) * r, y0, y1, 0.3, 0.7, 0.3, 0.7, cell, shade(c, 0.86 + 0.14 * (i % 2)), c); }
      if (cap) fan(g, x, z, r, y1, shade(c, 1.06), seg, cell, true);
    };
    const cone = (g, x, z, r, y0, y1, c, seg = 8, cell = 20) => { // 尖的（涼亭、尖塔）
      for (let i = 0; i < seg; i++) { const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU; g.grow(3, 3); const k = g.v;
        g.vert(x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r, 0.3, 0.3, c[0], c[1], c[2], cell); g.vert(x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r, 0.7, 0.3, c[0], c[1], c[2], cell); g.vert(x, y1, z, 0.5, 0.7, shade(c, 1.1)[0], shade(c, 1.1)[1], shade(c, 1.1)[2], cell);
        g.tri(k, k + 1, k + 2); }
    };
    const edgeRun = (P, gap, fn, closed = true) => { // 沿著多邊形的邊，一段一段（每段最多 gap 公尺）
      const n = closed ? P.length : P.length - 1;
      for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.2) continue; const m = Math.ceil(L / gap), rot = rotOf(b[0] - a[0], b[1] - a[1]);
        for (let j = 0; j < m; j++) { const t0 = j / m, t1 = (j + 1) / m, mx = a[0] + (b[0] - a[0]) * (t0 + t1) / 2, mz = a[1] + (b[1] - a[1]) * (t0 + t1) / 2; fn(mx, mz, (L / m) / 2, rot, i); } }
    };
    const lmSign = (k, y, h, w) => { const L = LMP[k]; if (!L || !L.sign) return; const uv = lmUV(k); if (!uv) return; const ux = Math.cos(L.sign.ang), uz = Math.sin(L.sign.ang); plate(L.sign.p[0], y, L.sign.p[1], ux, uz, w, h, uv, true); };
    const STONE = col255('#8c8880'), WHT2 = [240, 238, 232], BRICK = col255('#a8613f'), GRN = col255('#5d7f4a');

    // ---- 碧湖公園（照片 1–8）：碧湖（內湖大陂）、湖邊的石砌駁坎、紅磚步道、白色的九曲橋、湖心小島的橘瓦涼亭、入口的黑花崗岩石碑 ----
    const BH = LMP.bihu;
    if (BH && BH.lake) {
      const lake = BH.lake, lc = cenOf(lake);
      flatPoly(bank('area', lc[0], lc[1], TG), lake, 0.02, 4, col255('#49706e')); // 湖水：照片裡是灰綠色的（一般的水池太淺）
      edgeRun(lake, 6, (mx, mz, hl, rot) => { // 湖邊：石頭砌的邊（照片 碧湖公園-1、-6）
        boxG(bank('wall', mx, mz, TB), mx, mz, hl + 0.08, 0.5, rot, -0.4, 0.3, STONE, 20, true);
        colliders.push({ t: 'box', x: mx, z: mz, hx: hl + 0.1, hz: 0.55, rot, h: 0.45 });
      });
      const walk = grow(lake, 4.5); strip('walk', walk.concat([walk[0]]), 3.2, 0.06, BRICK, 2, TG); // 紅磚的步道（照片 碧湖公園-1、-2）
      edgeRun(lake, 14, (mx, mz) => { const gg = bank('wall', mx, mz, TB); boxG(gg, mx, mz, 0.07, 0.07, 0, 0.3, 1.0, [198, 202, 206], 20); }); // 不鏽鋼欄杆的柱子
      if (BH.islet) { // 湖心的小島＋涼亭（照片 碧湖公園-5）
        const isl = BH.islet, c = cenOf(isl), gi2 = bank('wall', c[0], c[1], TB);
        flatPoly(bank('area', c[0], c[1], TG), isl, 0.55, 4, col255('#7a8a5e'));
        edgeRun(isl, 5, (mx, mz, hl, rot) => boxG(bank('wall', mx, mz, TB), mx, mz, hl + 0.06, 0.45, rot, -0.2, 0.55, STONE, 20, false));
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; cyl(gi2, c[0] + Math.cos(a) * 2.6, c[1] + Math.sin(a) * 2.6, 0.22, 0.6, 3.5, [168, 172, 170], 8, 20, false); } // 灰色的圓柱
        boxG(gi2, c[0], c[1], 3.1, 3.1, Math.PI / 4, 3.5, 3.9, [226, 224, 216], 20, false); // 白色的額枋
        cone(gi2, c[0], c[1], 4.1, 3.9, 5.9, col255('#d8902c'), 8); // 橘色的琉璃瓦（翹的屋簷）
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; boxG(gi2, c[0] + Math.cos(a) * 3.4, c[1] + Math.sin(a) * 3.4, 0.14, 0.14, 0, 0.6, 1.1, WHT2, 20); } // 白色的欄杆柱
      }
      if (BH.bridge) { // 九曲橋：白色的橋面、兩邊雕花的欄杆、水泥橋墩（照片 碧湖公園-4、-7）
        const br = BH.bridge;
        strip('walk', br, 3.0, 0.62, WHT2, 2, TG);
        for (let i = 1; i < br.length; i++) {
          const a = br[i - 1], b = br[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.2) continue;
          const ex = (b[0] - a[0]) / L, ez = (b[1] - a[1]) / L, ox = -ez, oz = ex, rot = rotOf(ex, ez), gg = bank('wall', a[0], a[1], TB);
          boxG(gg, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L / 2, 1.5, rot, 0.25, 0.62, [214, 212, 206], 20, false); // 橋面的厚度
          for (const sd of [-1, 1]) { boxG(gg, (a[0] + b[0]) / 2 + ox * sd * 1.45, (a[1] + b[1]) / 2 + oz * sd * 1.45, L / 2, 0.1, rot, 0.62, 1.3, WHT2, 20); // 欄杆
            for (let j = 0; j <= Math.ceil(L / 2.2); j++) { const t = j / Math.max(1, Math.ceil(L / 2.2)); boxG(gg, a[0] + (b[0] - a[0]) * t + ox * sd * 1.45, a[1] + (b[1] - a[1]) * t + oz * sd * 1.45, 0.18, 0.18, rot, 0.62, 1.5, WHT2, 20); } }
          if (i % 2 === 0) for (const sd of [-1, 1]) boxG(gg, a[0] + ox * sd * 1.1, a[1] + oz * sd * 1.1, 0.26, 0.26, rot, -0.6, 0.3, [196, 194, 188], 20, false); // 橋墩
        }
      }
      if (BH.sign) { // 入口的黑花崗岩石碑（照片 碧湖公園-8）
        const sp = BH.sign.p, rot = rotOf(Math.cos(BH.sign.ang), Math.sin(BH.sign.ang));
        boxG(bank('wall', sp[0], sp[1], TB), sp[0], sp[1], 2.1, 0.45, rot, 0, 2.2, [46, 40, 38], 20);
        colliders.push({ t: 'box', x: sp[0], z: sp[1], hx: 2.1, hz: 0.5, rot, h: 2.2 });
        lmSign('bihu', 1.35, 0.9, 3.0);
      }
    }

    // ---- 內湖國小（照片 1–2）：白色的圍牆＋紅磚柱、操場（紅色 PU、綠色草皮）、游泳池、籃球場、校門的白色門柱和石頭校名牆 ----
    const PS = LMP.nhps;
    if (PS) {
      const sp = PS.sign ? PS.sign.p : null;
      edgeRun(PS.p, 6, (mx, mz, hl, rot) => { // 圍牆（OSM 的 barrier=wall）：白牆、下面紅磚
        if (sp && Math.hypot(mx - sp[0], mz - sp[1]) < 11) return; // 大門那邊空著
        const gg = bank('wall', mx, mz, TB);
        boxG(gg, mx, mz, hl + 0.05, 0.22, rot, 0, 0.9, col255('#9c5540'), 20, false);
        boxG(gg, mx, mz, hl + 0.05, 0.2, rot, 0.9, 1.9, [238, 236, 230], 20);
        colliders.push({ t: 'box', x: mx, z: mz, hx: hl + 0.1, hz: 0.3, rot, h: 1.9 });
      }, false);
      if (PS.track) { const c = cenOf(PS.track); flatPoly(bank('area', c[0], c[1], TG), PS.track, 0.02, 4, col255('#b4553c')); flatPoly(bank('area', c[0], c[1], TG), grow(PS.track, -6), 0.03, 4, col255('#5f9a48')); } // 操場：紅色跑道、中間草皮
      if (PS.pool) { const c = cenOf(PS.pool); flatPoly(bank('area', c[0], c[1], TG), grow(PS.pool, 1.6), 0.015, 4, [226, 224, 218]); flatPoly(bank('area', c[0], c[1], TG), PS.pool, 0.025, 4, col255('#3f8fc4')); } // 游泳池：白色的池邊
      if (PS.court) { const c = cenOf(PS.court), g2 = bank('wall', c[0], c[1], TB); // 籃球場：兩邊的籃框
        const P = PS.court, a = P[0], b = P[P.length - 1];
        for (const q of [[(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2], [(P[2][0] + P[3][0]) / 2, (P[2][1] + P[3][1]) / 2]]) {
          boxG(g2, q[0], q[1], 0.09, 0.09, 0, 0, 3.0, [180, 184, 188], 20); boxG(g2, q[0], q[1], 0.9, 0.08, 0, 2.6, 3.2, WHT2, 20); }
      }
      if (sp) { // 校門：兩根白色的門柱、弧形的雨庇、石頭的校名牆（照片 內湖國小-1、-2）
        const ang = PS.sign.ang, ux = Math.cos(ang), uz = Math.sin(ang), rot = rotOf(ux, uz), g2 = bank('wall', sp[0], sp[1], TB);
        for (const sd of [-1, 1]) { boxG(g2, sp[0] + ux * sd * 5.2, sp[1] + uz * sd * 5.2, 0.6, 0.6, rot, 0, 5.4, [242, 242, 238], 20); colliders.push({ t: 'box', x: sp[0] + ux * sd * 5.2, z: sp[1] + uz * sd * 5.2, hx: 0.7, hz: 0.7, rot, h: 5.4 }); }
        boxG(g2, sp[0], sp[1], 5.2, 0.5, rot, 4.8, 5.2, [246, 246, 242], 20); // 雨庇
        boxG(g2, sp[0] - uz * 1.0, sp[1] + ux * 1.0, 3.2, 0.35, rot, 0, 1.3, [226, 222, 212], 20); // 石頭的校名牆
        colliders.push({ t: 'box', x: sp[0] - uz * 1.0, z: sp[1] + ux * 1.0, hx: 3.2, hz: 0.4, rot, h: 1.3 });
        lmSign('nhps', 0.95, 0.6, 4.4);
      }
    }

    // ---- 麗山國中（照片 1–2）：白色小磁磚＋紅磚飾帶的教學樓（牆的格子 24）、圍牆、紅磚柱的大門 ----
    const LS = LMP.lishan;
    if (LS) {
      const sp = LS.sign ? LS.sign.p : null;
      edgeRun(LS.p, 6, (mx, mz, hl, rot) => {
        if (sp && Math.hypot(mx - sp[0], mz - sp[1]) < 10) return;
        const gg = bank('wall', mx, mz, TB);
        boxG(gg, mx, mz, hl + 0.05, 0.2, rot, 0, 2.0, [236, 234, 228], 20);
        boxG(gg, mx, mz, hl + 0.06, 0.22, rot, 1.55, 1.75, col255('#9c5540'), 20, false);
        colliders.push({ t: 'box', x: mx, z: mz, hx: hl + 0.1, hz: 0.3, rot, h: 2.0 });
      }, false);
      if (sp) { const ang = LS.sign.ang, ux = Math.cos(ang), uz = Math.sin(ang), rot = rotOf(ux, uz), g2 = bank('wall', sp[0], sp[1], TB);
        for (const sd of [-1, 1]) { boxG(g2, sp[0] + ux * sd * 4.6, sp[1] + uz * sd * 4.6, 0.7, 0.7, rot, 0, 3.6, col255('#9c5540'), 20); colliders.push({ t: 'box', x: sp[0] + ux * sd * 4.6, z: sp[1] + uz * sd * 4.6, hx: 0.8, hz: 0.8, rot, h: 3.6 }); }
        lmSign('lishan', 2.6, 0.7, 4.0);
      }
    }

    // ---- 大港墘公園（照片 1–6）：草地、彎彎的水泥步道、鋪面廣場、墨綠色的石碑、遊戲區（藍黃色的軟墊、溜滑梯）、路燈、長椅 ----
    const DG = LMP.dgq;
    if (DG) {
      const P = DG.p, c = cenOf(P), g2 = bank('wall', c[0], c[1], TB);
      const inner = grow(P, -16);
      strip('walk', inner.concat([inner[0]]), 3.0, 0.05, [206, 204, 198], 2, TG); // 繞一圈的步道
      for (let i = 0; i < P.length; i += 2) { const a = grow(P, -8)[i]; strip('walk', [a, [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], c], 2.6, 0.05, [206, 204, 198], 2, TG); } // 幾條往中間的
      flatPoly(bank('area', c[0], c[1], TG), grow([[c[0] - 16, c[1] - 12], [c[0] + 16, c[1] - 12], [c[0] + 16, c[1] + 12], [c[0] - 16, c[1] + 12]], 0), 0.05, 4, [198, 196, 190]); // 中間的鋪面廣場
      flatPoly(bank('area', c[0], c[1], TG), [[c[0] - 14, c[1] - 10], [c[0] - 2, c[1] - 10], [c[0] - 2, c[1] + 10], [c[0] - 14, c[1] + 10]], 0.055, 4, col255('#c0552f')); // 紅磚色的帶子
      { const px = c[0] + 26, pz = c[1] - 6; // 遊戲區（藍、黃色的軟墊、灰色的溜滑梯、橘色的欄杆）
        flatPoly(bank('area', px, pz, TG), [[px - 12, pz - 9], [px + 12, pz - 9], [px + 12, pz + 9], [px - 12, pz + 9]], 0.05, 4, col255('#3b8fd0'));
        flatPoly(bank('area', px, pz, TG), [[px - 10, pz - 2], [px + 4, pz - 2], [px + 4, pz + 7], [px - 10, pz + 7]], 0.06, 4, col255('#e0b33a'));
        const gp = bank('wall', px, pz, TB);
        boxG(gp, px + 5, pz - 4, 3.2, 2.4, 0, 0, 2.2, [190, 192, 190], 20); // 小山丘＋溜滑梯
        boxG(gp, px + 1.2, pz - 4, 1.0, 1.0, 0, 0.2, 1.4, [206, 208, 206], 20);
        for (const sd of [-1, 1]) boxG(gp, px + 5, pz - 4 + sd * 2.5, 3.2, 0.06, 0, 2.2, 3.0, col255('#d8882a'), 20); // 橘色的欄杆
        colliders.push({ t: 'box', x: px + 5, z: pz - 4, hx: 3.4, hz: 2.6, rot: 0, h: 2.4 });
      }
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, px = c[0] + Math.cos(a) * 30, pz = c[1] + Math.sin(a) * 24; // 黑色的路燈
        boxG(bank('wall', px, pz, TB), px, pz, 0.09, 0.09, 0, 0, 4.0, [60, 62, 64], 20); boxG(bank('wall', px, pz, TB), px, pz, 0.3, 0.3, 0, 4.0, 4.3, [70, 72, 74], 20); }
      for (let i = 0; i < 6; i++) { const px = c[0] - 20 + i * 8, pz = c[1] + 13; boxG(bank('wall', px, pz, TB), px, pz, 1.4, 0.3, 0, 0.42, 0.5, [74, 66, 58], 20); boxG(bank('wall', px, pz, TB), px, pz, 1.4, 0.06, 0, 0.5, 0.95, [74, 66, 58], 20); } // 長椅
      if (DG.sign) { const sp = DG.sign.p, rot = rotOf(Math.cos(DG.sign.ang), Math.sin(DG.sign.ang)); // 墨綠色的石碑（照片 大港墘公園-1、-3）
        boxG(bank('wall', sp[0], sp[1], TB), sp[0], sp[1], 1.1, 0.45, rot, 0, 2.6, col255('#2f4a35'), 20);
        boxG(bank('wall', sp[0], sp[1], TB), sp[0], sp[1], 1.6, 0.8, rot, 0, 0.3, [196, 192, 184], 20);
        colliders.push({ t: 'box', x: sp[0], z: sp[1], hx: 1.6, hz: 0.8, rot, h: 2.6 });
        lmSign('dgq', 1.7, 0.75, 1.9);
      }
    }

    // ---- 西湖圖書館（照片 1、3、4、5、6）：灰白小口磁磚（牆的格子 25）、圓弧的角、2 樓的弧形玻璃雨庇、直立的館名 ----
    const LB = LMP.lib;
    if (LB) {
      const P = LB.p, c = cenOf(P), g2 = bank('wall', c[0], c[1], TB), top = 17.5;
      for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.3) continue;
        wallQ(g2, a[0], a[1], b[0], b[1], 0, 4.2, 0, Math.max(1, Math.round(L / 6)), 0, 1, 25, [216, 220, 222], [230, 232, 234]);
        wallQ(g2, a[0], a[1], b[0], b[1], 4.2, top, 0, Math.max(1, Math.round(L / 6)), 0, (top - 4.2) / 6.4, 25, [230, 232, 234]); }
      flatPoly(g2, P, top, 6, [206, 206, 200], 18);
      { // 圓弧的角（照片 西湖圖書館-1、-5）：東南角一座圓的量體
        const a = P[0], b = P[1], cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
        cyl(g2, cx, cz, 5.2, 0, top, [228, 230, 232], 10, 25, true);
        cyl(g2, cx, cz, 5.6, 4.0, 4.5, [214, 218, 220], 10, 20, false); // 2 樓的弧形玻璃雨庇
      }
      boxG(g2, c[0], c[1], 1.6, 1.6, 0, top, top + 3.2, [226, 228, 230], 25); // 樓梯間
      const bx = P[P.length - 1]; boxG(g2, bx[0], bx[1], 1.5, 1.5, 0, 0, top + 4.5, [226, 230, 232], 25); // 館名的那道高牆（直立的字）
      const k0 = colliders.length;
      for (const [x, z, hx, hz] of [[c[0], c[1], 14, 14]]) colliders.push({ t: 'box', x, z, hx, hz, rot: 0, h: top });
      // 第 9 批（路變大）：江南街讓開以後車子開得到圖書館的每一面牆，原本只有中間一個 14×14 的箱子（邊上撞得進去 12 公尺）；
      //   每一面牆往裡面加一道 3 公尺厚的牆、圓角＝圓柱；全部同一個 g（越野車一次壓扁整棟）
      for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue;
        let nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if (!inPoly(P, mx + nx * 0.6, mz + nz * 0.6)) { nx = -nx; nz = -nz; }
        colliders.push({ t: 'box', x: mx + nx * 1.5, z: mz + nz * 1.5, hx: L / 2, hz: 1.5, rot: rotOf(b[0] - a[0], b[1] - a[1]), h: top }); }
      { const a = P[0], b = P[1]; colliders.push({ t: 'circle', x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, r: 5.2, h: top }); }
      for (let i = k0; i < colliders.length; i++) colliders[i].g = GB - 1;
      lmSign('lib', 6.5, 1.1, 4.4);
    }

    // ---- 湖光基督教會（照片 1–6）：白色石頭的教堂、正面的大柱廊、鐘樓＋尖塔、十字架、綠色玻璃的雨庇 ----
    const CH = LMP.church;
    if (CH) {
      const P = CH.p, c = cenOf(P), g2 = bank('wall', c[0], c[1], TB), top = 15.0, SW = [238, 236, 230];
      const k0 = colliders.length; // 第 9 批（路變大）：教會的碰撞物同一個 g（越野車一次壓扁整棟）
      for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.3) continue;
        wallQ(g2, a[0], a[1], b[0], b[1], 0, top, 0, Math.max(1, Math.round(L / 6)), 0, 1, 20, shade(SW, 0.94), SW); }
      flatPoly(g2, P, top, 6, [214, 212, 206], 18);
      { // 正面（最長的那一邊）：柱廊、額枋、屋簷
        let bi = 0, bl = 0; for (let i = 0; i < P.length; i++) { const L = Math.hypot(P[(i + 1) % P.length][0] - P[i][0], P[(i + 1) % P.length][1] - P[i][1]); if (L > bl) { bl = L; bi = i; } }
        const a = P[bi], b = P[(bi + 1) % P.length], L = bl, ex = (b[0] - a[0]) / L, ez = (b[1] - a[1]) / L, ox = ez, oz = -ex; // 外面
        const n = Math.max(3, Math.min(6, Math.floor(L / 4.5)));
        for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, px = a[0] + (b[0] - a[0]) * t + ox * 1.6, pz = a[1] + (b[1] - a[1]) * t + oz * 1.6;
          cyl(g2, px, pz, 0.72, 0, 12.2, SW, 8, 20, false); cyl(g2, px, pz, 0.95, 12.2, 12.9, [246, 244, 238], 8, 20, true); // 柱子＋柱頭
          colliders.push({ t: 'circle', x: px, z: pz, r: 0.8, h: 12.9 }); }
        const mx = (a[0] + b[0]) / 2 + ox * 1.6, mz = (a[1] + b[1]) / 2 + oz * 1.6, rot = rotOf(ex, ez);
        boxG(g2, mx, mz, L / 2, 1.1, rot, 12.9, 14.6, [244, 242, 236], 20); // 額枋（上面有刻字）
        boxG(g2, mx, mz, L / 2 + 0.4, 1.4, rot, 14.6, 15.2, [236, 234, 228], 20); // 屋簷
        boxG(g2, (a[0] + b[0]) / 2 + ox * 3.2, (a[1] + b[1]) / 2 + oz * 3.2, L / 2 - 2, 1.7, rot, 4.0, 4.3, col255('#7fa89c'), 20); // 綠色玻璃的雨庇
        const uv = lmUV('church'); if (uv) plate(mx + ox * 1.15, 13.7, mz + oz * 1.15, ex, ez, Math.min(12, L - 2), 1.2, uv, false); // 正面的「湖光基督教會」
      }
      { // 鐘樓＋尖塔＋十字架（照片 湖光教會-1、-2、-5）
        const tx = c[0], tz = c[1], g3 = bank('wall', tx, tz, TB);
        boxG(g3, tx, tz, 3.0, 3.0, 0, 0, 20.0, SW, 20, false);
        boxG(g3, tx, tz, 3.4, 3.4, 0, 20.0, 21.0, [246, 244, 238], 20, false); // 鐘樓的檐口
        boxG(g3, tx, tz, 2.4, 2.4, 0, 21.0, 24.5, [242, 240, 234], 20, false); // 鐘的那一層（四面拱窗）
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) boxG(g3, tx + dx * 2.42, tz + dz * 2.42, dx ? 0.05 : 1.0, dx ? 1.0 : 0.05, 0, 21.6, 23.9, [52, 56, 54], 20, false); // 拱窗（暗的）
        cone(g3, tx, tz, 2.6, 24.5, 33.0, [226, 228, 226], 8); // 尖塔
        boxG(g3, tx, tz, 0.12, 0.12, 0, 33.0, 35.4, [70, 70, 68], 20, false); boxG(g3, tx, tz, 0.9, 0.1, 0, 34.0, 34.3, [70, 70, 68], 20, false); // 十字架
        colliders.push({ t: 'box', x: tx, z: tz, hx: 3.2, hz: 3.2, rot: 0, h: 21 });
      }
      for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; colliders.push({ t: 'box', x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, hx: Math.hypot(b[0] - a[0], b[1] - a[1]) / 2, hz: 0.4, rot: rotOf(b[0] - a[0], b[1] - a[1]), h: top }); }
      for (let i = k0; i < colliders.length; i++) colliders[i].g = GB - 2;
    }

    // ---- 港墘站的出入口：金色的站名牌（照片 港墘站-2）----
    if (LMP.mrt && gq) { const uv = lmUV('mrt');
      if (uv) for (const e of N.entr) { const d = Math.hypot(e.p[0] - gq.p[0], e.p[1] - gq.p[1]); if (d > 130) continue; const ux = Math.cos(e.ang), uz = Math.sin(e.ang); plate(e.p[0] - uz * 2.1, 2.6, e.p[1] + ux * 2.1, ux, uz, 3.4, 0.62, uv, true); }
    }
  }

  const signMesh = new THREE.Mesh(sg.geometry(), mats.sign); signMesh.name = 'nh-signs'; signMesh.matrixAutoUpdate = false;

  // ==== 樹（250 公尺一格 InstancedMesh：樹幹＋樹冠一個網格；山上的樹另外一個）====
  const treeGeo = (() => {
    const g = new Geo(false), TR = col255('#6b4f37'), L1 = col255('#4f7a3a'), L2 = col255('#3f6a31');
    boxG(g, 0, 0, 0.14, 0.14, 0, 0, 2.6, TR, 0, false);
    const ico = new THREE.IcosahedronGeometry(1.9, 0).toNonIndexed(), p = ico.attributes.position; g.grow(p.count, p.count);
    for (let i = 0; i < p.count; i += 3) { const k = g.v; for (let j = 0; j < 3; j++) { const y = p.getY(i + j); const c = y > 0.5 ? L1 : L2; g.vert(p.getX(i + j) * 1.15, 3.6 + y * 0.9, p.getZ(i + j) * 1.15, 0, 0, c[0], c[1], c[2], 0); } g.tri(k, k + 1, k + 2); }
    ico.dispose(); return g.geometry();
  })();
  const hillTreeGeo = (() => { // 山上的樹：遠遠看的，一個八面體（8 個三角形，沒有樹幹）
    const g = new Geo(false), L1 = col255('#4a7036'), L2 = col255('#3b5f2e'), o = new THREE.OctahedronGeometry(2.1, 0), p = o.attributes.position; g.grow(p.count, p.count);
    for (let i = 0; i < p.count; i += 3) { const k = g.v; for (let j = 0; j < 3; j++) { const y = p.getY(i + j), c = y > 0.3 ? L1 : L2; g.vert(p.getX(i + j), 2.2 + y * 1.3, p.getZ(i + j), 0, 0, c[0], c[1], c[2], 0); } g.tri(k, k + 1, k + 2); }
    o.dispose(); return g.geometry();
  })();
  const treeTiles = new Map(), TT = 250, M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(), PV = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0);
  const addTree = (x, y, z, s, hill = false) => { const key = hill ? 'hill' : Math.floor((x - AX) / TT) + ',' + Math.floor((z - AZ) / TT); let L = treeTiles.get(key); if (!L) treeTiles.set(key, (L = [])); L.push(x, y, z, s); };
  const treeCols = []; // 第 9 批：碰撞物記著是哪一格的第幾棵（越野車輾到 → 那一棵壓扁：crush.js 改 InstancedMesh 的矩陣）
  for (const [x, z, s] of N.trees) { addTree(x, 0, z, s); if (inBox(x, z)) { const c = { t: 'circle', x, z, r: 0.25, h: 3, tk: Math.floor((x - AX) / TT) + ',' + Math.floor((z - AZ) / TT), ti: treeTiles.get(Math.floor((x - AX) / TT) + ',' + Math.floor((z - AZ) / TT)).length / 4 - 1 }; colliders.push(c); treeCols.push(c); } }
  { // 山上的樹（遠遠看的）：範圍外面一圈，山腳 4 公尺以上；近的密一點
    const R3 = rng(8); let n = 0;
    for (let tries = 0; n < 2600 && tries < 40000; tries++) {
      const x = BX0 - 550 + R3() * (BX1 + 650 - BX0 + 550), z = BZ0 - 800 + R3() * (BZ1 - BZ0 + 1350), d = boxD(x, z); if (d < 16 || R3() > 1.25 - d / 600) continue;
      const h = hillH(x, z); if (h < 4) continue; addTree(x, h - 0.3, z, 1.8 + R3() * 1.6, true); n++;
    }
  }
  const treeMeshes = [];
  for (const [key, L] of treeTiles) {
    const n = L.length / 4, m = new THREE.InstancedMesh(key === 'hill' ? hillTreeGeo : treeGeo, mats.tree, n); m.name = 'nh-trees-' + key;
    let cx = 0, cz = 0; const col = new THREE.Color();
    for (let i = 0; i < n; i++) { const x = L[i * 4], y = L[i * 4 + 1], z = L[i * 4 + 2], s = L[i * 4 + 3]; Q.setFromAxisAngle(UPV, hh(i, 70) * TAU); M4.compose(PV.set(x, y, z), Q, SC.set(s, s * (0.85 + hh(i, 71) * 0.3), s)); m.setMatrixAt(i, M4); col.setRGB(0.85 + hh(i, 72) * 0.25, 0.9 + hh(i, 73) * 0.15, 0.85 + hh(i, 74) * 0.2); m.setColorAt(i, col); cx += x; cz += z; }
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); m.userData.c = [cx / n, cz / n]; m.userData.hill = key === 'hill'; treeMeshes.push(m);
  }
  { const byKey = new Map(treeMeshes.map((m) => [m.name.slice(9), m])); for (const c of treeCols) { c.im = byKey.get(c.tk) || null; delete c.tk; } }

  // ==== 全部放進 group ====
  const group = new THREE.Group(); group.name = 'neihu';
  let tris = 0, meshes = 0; const tileMeshes = [];
  const ORDER = ['ground', 'area', 'walk', 'road', 'paint', 'wall'];
  for (const [key, b] of [...banks.entries()].sort((p, q) => ORDER.indexOf(p[1].mat) - ORDER.indexOf(q[1].mat))) {
    if (!b.g.v) continue; const m = new THREE.Mesh(b.g.geometry(), mats[b.mat]); m.name = 'nh-' + key; m.matrixAutoUpdate = false; m.updateMatrix();
    m.userData.c = [b.cx, b.cz]; m.userData.r = b.size * 0.75; m.userData.far = b.mat === 'paint' ? 420 : b.mat === 'wall' ? 1300 : 1500;
    group.add(m); tileMeshes.push(m); tris += b.g.ni / 3; meshes++;
  }
  group.add(hillMesh, signMesh); meshes += 2; tris += hillTris + sg.ni / 3;
  for (const m of treeMeshes) { group.add(m); meshes++; tris += m.count * (m.geometry.index.count / 3); }
  if (V.group) V.group.add(group);

  // ==== 地面種類（surfaceAt）：2 公尺一格，第一次問才算 ====
  const roadAt2 = mkRoadGrid();
  const grassAreas = N.areas.filter((a) => a.t === 'park' || a.t === 'pitch');
  const SX0 = BX0 - 20, SZ0 = BZ0 - 20, SNX = Math.ceil((BX1 - BX0 + 40) / 2), SNZ = Math.ceil((BZ1 - BZ0 + 40) / 2), SM = new Uint8Array(SNX * SNZ).fill(255);
  const LB = LK.box, LGN = Math.ceil((LB[2] - LB[0]) / 2), LGM = Math.ceil((LB[3] - LB[1]) / 2), LG = new Uint8Array(LGN * LGM); // 聯外道路：2 公尺一格（0 還沒算、1 在路上、2 不在）
  const inLink = (x, z) => {
    if (z < LINK_J[1]) return false; // 路口以北是越野車場的水泥路（村子那邊）：不算聯外道路（不然 V.route 會以為人已經在內湖那邊，算出繞一大圈的路線）
    if (x < LB[0] || x >= LB[2] || z < LB[1] || z >= LB[3]) return false;
    const i = Math.floor((x - LB[0]) / 2), j = Math.floor((z - LB[1]) / 2), k = j * LGN + i;
    if (!LG[k]) { const L = linkDist(LB[0] + i * 2 + 1, LB[1] + j * 2 + 1); LG[k] = L.d <= L.w / 2 + 1 ? 1 : 2; }
    return LG[k] === 1;
  };
  const surfCalc = (x, z) => {
    if (inLink(x, z)) return 0;
    const r = roadAt2(x, z);
    if (r && r.d <= r.r.w / 2 + 0.3) return r.r.cls <= 2 ? 0 : 3;
    if (r && r.d <= r.r.w / 2 + r.r.sw + 0.3) return 3;
    if (!inBox(x, z)) return 1; // 邊外的草地
    for (const a of grassAreas) if (inPoly(a.P, x, z)) return 1;
    return 3; // 水泥地
  };
  const surf0 = V.surfaceAt;
  const inside = (x, z) => inBox(x, z, -20) || inLink(x, z);
  V.surfaceAt = (x, z) => {
    if (inBox(x, z, -20)) { const i = Math.floor((x - SX0) / 2), j = Math.floor((z - SZ0) / 2); if (i >= 0 && j >= 0 && i < SNX && j < SNZ) { const k = j * SNX + i; let v = SM[k]; if (v === 255) v = SM[k] = surfCalc(SX0 + (i + 0.5) * 2, SZ0 + (j + 0.5) * 2); return v; } }
    if (inLink(x, z)) return 0;
    return surf0 ? surf0(x, z) : 0;
  };

  // ==== 路網、路線（V.route）====
  // 點：路的點（0..nN-1）＋聯外道路的點；邊：單行道只有一個方向
  const nN = ND.length / 2, LP = LK.pts, nL = LP.length, NT = nN + nL;
  const PX = new Float64Array(NT), PZ = new Float64Array(NT); for (let i = 0; i < nN; i++) { PX[i] = nx(i); PZ[i] = nz(i); } for (let i = 0; i < nL; i++) { PX[nN + i] = LP[i][0]; PZ[nN + i] = LP[i][1]; }
  const out = Array.from({ length: NT }, () => []), inn = Array.from({ length: NT }, () => []); // [到哪, 長度]
  const edge = (a, b, two, k = 1) => { const L = Math.hypot(PX[b] - PX[a], PZ[b] - PZ[a]) * k; out[a].push(b, L); inn[b].push(a, L); if (two) { out[b].push(a, L); inn[a].push(b, L); } }; // k：小路算長一點（路線走大路，不要鑽巷子）
  const EDGES = []; // 小地圖、投影用：[a, b, 可以 a→b, 可以 b→a, w]
  for (const r of N.roads) for (let k = 1; k < r.n.length; k++) { let a = r.n[k - 1], b = r.n[k]; const fw = r.ow !== -1, bw = r.ow !== 1; const k2 = r.cls <= 2 ? 1 : r.cls === 3 ? 1.1 : 1.35; if (fw) edge(a, b, false, k2); if (bw) edge(b, a, false, k2); EDGES.push([a, b, fw, bw, r.w]); }
  for (let i = 1; i < nL; i++) { edge(nN + i - 1, nN + i, true); EDGES.push([nN + i - 1, nN + i, true, true, LK.w[i]]); }
  for (const [ri, e] of N.ent) { const r = N.roads[ri], ni = r.n[e ? r.n.length - 1 : 0]; edge(nN + nL - 1, ni, true); EDGES.push([nN + nL - 1, ni, true, true, r.w]); }
  const EG = new Map(), EGS = 25, ek = (i, j) => i * 73856093 + j;
  EDGES.forEach((e, ei) => { const [a, b] = e, m = e[4] / 2 + 30; for (let i = Math.floor((Math.min(PX[a], PX[b]) - m) / EGS); i <= Math.floor((Math.max(PX[a], PX[b]) + m) / EGS); i++) for (let j = Math.floor((Math.min(PZ[a], PZ[b]) - m) / EGS); j <= Math.floor((Math.max(PZ[a], PZ[b]) + m) / EGS); j++) { const kk = ek(i, j); let L = EG.get(kk); if (!L) EG.set(kk, (L = [])); L.push(ei); } });
  const trees2 = new Map(); // 目標點 → { dist, next }（往目標的最短路，反著算一次記起來）
  function treeTo(t) {
    let T = trees2.get(t); if (T) return T;
    const dist = new Float64Array(NT).fill(Infinity), next = new Int32Array(NT).fill(-1); dist[t] = 0;
    const hk = new Float64Array(NT * 4 + 8), hv = new Int32Array(NT * 4 + 8); let hn = 0; // 小堆（鍵＝距離）
    const hpush = (k, v) => { let c = hn++; while (c > 0) { const p = (c - 1) >> 1; if (hk[p] <= k) break; hk[c] = hk[p]; hv[c] = hv[p]; c = p; } hk[c] = k; hv[c] = v; };
    hpush(0, t);
    while (hn) {
      const d = hk[0], u = hv[0], lk = hk[--hn], lv = hv[hn]; let c = 0;
      for (;;) { let m = 2 * c + 1; if (m >= hn) break; if (m + 1 < hn && hk[m + 1] < hk[m]) m++; if (hk[m] >= lk) break; hk[c] = hk[m]; hv[c] = hv[m]; c = m; }
      hk[c] = lk; hv[c] = lv;
      if (d > dist[u]) continue;
      const L = inn[u]; for (let i = 0; i < L.length; i += 2) { const v = L[i], nd = d + L[i + 1]; if (nd < dist[v]) { dist[v] = nd; next[v] = u; if (hn < hk.length) hpush(nd, v); } }
    }
    T = { dist, next }; trees2.set(t, T); return T;
  }
  const PRJ = { e: -1, t: 0, d: Infinity };
  function project(x, z) {
    PRJ.e = -1; PRJ.d = Infinity; const L = EG.get(ek(Math.floor(x / EGS), Math.floor(z / EGS))); if (!L) return null;
    for (const ei of L) { const [a, b] = EDGES[ei], dx = PX[b] - PX[a], dz = PZ[b] - PZ[a], l2 = dx * dx + dz * dz || 1e-9, t = clamp(((x - PX[a]) * dx + (z - PZ[a]) * dz) / l2, 0, 1), ex = PX[a] + dx * t - x, ez = PZ[a] + dz * t - z, d = ex * ex + ez * ez; if (d < PRJ.d) { PRJ.d = d; PRJ.e = ei; PRJ.t = t; } }
    return PRJ.e >= 0 ? PRJ : null;
  }
  function pathTo(x, z, t) { // (x, z) → 目標點 t（照路網、單行道照方向）
    const T = treeTo(t), p = project(x, z); if (!p) return null;
    const [a, b, fw, bw] = EDGES[p.e], L = Math.hypot(PX[b] - PX[a], PZ[b] - PZ[a]), qx = PX[a] + (PX[b] - PX[a]) * p.t, qz = PZ[a] + (PZ[b] - PZ[a]) * p.t;
    const cb = fw ? (1 - p.t) * L + T.dist[b] : Infinity, ca = bw ? p.t * L + T.dist[a] : Infinity;
    let u = cb <= ca ? b : a; if (!isFinite(Math.min(ca, cb))) { u = T.dist[a] < T.dist[b] ? a : b; if (!isFinite(T.dist[u])) return null; } // 逆向開在單行道上：還是給一條（往比較近的那頭）
    const pts = [[x, z], [qx, qz]]; for (let g = 0; u >= 0 && g < 4000; g++) { pts.push([PX[u], PZ[u]]); if (u === t) break; u = T.next[u]; }
    return pts;
  }
  // 目的地：港墘站下面（最近的大路的點）
  const st0 = N.stations.find((s) => s.nm === '港墘') || N.stations[0];
  let destNode = 0; { let bd = Infinity; const [sx, sz] = st0 ? st0.p : [AX, AZ]; N.roads.forEach((r) => { if (r.cls > 2) return; for (const ni of r.n) { const d = (nx(ni) - sx) ** 2 + (nz(ni) - sz) ** 2; if (d < bd) { bd = d; destNode = ni; } } }); }
  const destRoad = N.roads.find((r) => r.n.includes(destNode)), di = destRoad.n.indexOf(destNode), dA = destRoad.n[Math.max(0, di - 1)], dB = destRoad.n[Math.min(destRoad.n.length - 1, di + 1)];
  const dRot = rotOf(nx(dB) - nx(dA), nz(dB) - nz(dA)), dHead = Math.atan2(-(nz(dB) - nz(dA)), nx(dB) - nx(dA));
  const place = { name: '內湖', pos: [nx(destNode), nz(destNode)], zone: { x: nx(destNode), z: nz(destNode), hx: 22, hz: destRoad.w / 2 + destRoad.sw + 2, rot: dRot }, spawn: { x: nx(destNode), z: nz(destNode), heading: dHead } };
  V.places.neihu = place;
  const L0 = nN; // 聯外道路北頭（越野車場的水泥路在村子南邊的口：LINK_J）
  const join = (...rs) => { const pts = []; for (const r of rs) for (const p of r || []) { const q = pts[pts.length - 1]; if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.05) pts.push([p[0], p[1]]); } let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return { pts, len }; };
  // 內湖裡面任兩點（照路網、單行道照方向）：測試、以後的任務用
  const routeTo = (x, z, tx, tz) => { const q = project(tx, tz); if (!q) return null; const [a, b] = EDGES[q.e], pts = pathTo(x, z, q.t < 0.5 ? a : b); return pts ? join(pts, [[tx, tz]]) : null; };
  const roadName = (x, z) => { const r = roadAt2(x, z); return r && r.r.nm >= 0 && r.d <= r.r.w / 2 + r.r.sw + 1 ? D.names[r.r.nm][0] : ''; }; // 這裡是哪條路（路名牌的名字）
  const route0 = V.route;
  const [JX, JZ] = LINK_J, atJ = (q) => Math.abs(q[0] - JX) < 2.5 && q[1] > JZ - 8 && q[1] < JZ + 4; // 路線經過村子南邊的口（越野車場的水泥路）
  V.route = (x, z, dest) => {
    const inN = inside(x, z);
    if (dest === 'neihu') {
      if (inN) { const p = pathTo(x, z, destNode); return p ? join(p) : null; }
      // 照原本的路（去越野車場：村子 → 農路 → 水泥路；在越野車場裡：開出來）開到村子南邊的口，往南直走接聯外道路
      for (const d0 of ['offroad', 'garage']) { const r = route0(x, z, d0); if (!r || !r.pts) continue; const i = r.pts.findIndex(atJ); if (i >= 0) return join(r.pts.slice(0, i), [LINK_J], pathTo(JX, JZ, destNode)); }
      const r = route0(x, z, 'offroad'); return r && r.pts ? join(r.pts, [LINK_J], pathTo(JX, JZ, destNode)) : null;
    }
    if (!inN || Math.hypot(x - JX, z - JZ) < 14) return route0(x, z, dest); // 路口附近（越野車場的水泥路和聯外道路疊在一起那十幾公尺）：去村子那邊的地方完全照舊（不然路線會先往北折回路口）
    const a = pathTo(x, z, L0); if (!a) return route0(x, z, dest);
    const b = route0(JX, JZ - 3, dest); // 水泥路上（越野車場的 V.route 會接回村子）
    return join(a, [LINK_J], b && b.pts);
  };
  // 聯外道路給小地圖、警車（路網）
  V.roads.push({ pts: LP.map((p) => p.slice()), w: 13.5, kind: 'main', noNpc: true }); // 第 9 批：聯外道路 13.5 公尺
  V.colliders.push(...colliders);
  // 範圍：走路（walk.js 照 V.bounds 限制）、警察的格子；小地圖的底圖照原本的範圍（V.mapBounds），內湖另外畫（V.mapLive）
  if (V.bounds) { if (!V.mapBounds) V.mapBounds = { ...V.bounds }; V.bounds.x1 = Math.max(V.bounds.x1, BX1 + 30); V.bounds.z1 = Math.max(V.bounds.z1, BZ1 + 30); V.bounds.z0 = Math.min(V.bounds.z0, BZ0 - 30); }

  // ==== 小地圖：照格子先做好 Path2D（路、房子、公園），附近的才畫 ====
  const MT = 200, mtiles = new Map(), mkey = (i, j) => i * 1000 + j;
  const mt = (x, z) => { const k = mkey(Math.floor((x - AX + 2000) / MT), Math.floor((z - AZ + 2000) / MT)); let t = mtiles.get(k); if (!t) mtiles.set(k, (t = { bld: null, park: null, roads: new Map() })); return t; };
  let mapReady = false;
  function mapBuild() {
    if (mapReady || typeof Path2D === 'undefined') return; mapReady = true;
    for (const b of N.bld) { if (b.back) continue; const t = mt(b.P[0][0], b.P[0][1]); if (!t.bld) t.bld = new Path2D(); b.P.forEach((p, i) => (i ? t.bld.lineTo(p[0], p[1]) : t.bld.moveTo(p[0], p[1]))); t.bld.closePath(); }
    for (const a of N.areas) { if (a.t !== 'park' && a.t !== 'pitch' && a.t !== 'water') continue; const t = mt(a.P[0][0], a.P[0][1]); const key = a.t === 'water' ? 'water' : 'park'; if (!t[key]) t[key] = new Path2D(); a.P.forEach((p, i) => (i ? t[key].lineTo(p[0], p[1]) : t[key].moveTo(p[0], p[1]))); t[key].closePath(); }
    for (const r of N.roads) for (let k = 1; k < r.n.length; k++) { const a = r.n[k - 1], b = r.n[k], t = mt((nx(a) + nx(b)) / 2, (nz(a) + nz(b)) / 2), wk = Math.max(5, Math.round(r.w * 0.95)) + (r.cls <= 2 ? 100 : 0); let p = t.roads.get(wk); if (!p) t.roads.set(wk, (p = new Path2D())); p.moveTo(nx(a), nz(a)); p.lineTo(nx(b), nz(b)); }
  }
  V.mapLive = (g, cx, cz, span) => { // drive.js／walk.js 的小地圖：底圖畫完、路線畫之前叫（g 已經轉成世界座標）
    if (boxD(cx, cz) > span + 400) return;
    mapBuild();
    const r = span * 0.9, i0 = Math.floor((cx - r - AX + 2000) / MT), i1 = Math.floor((cx + r - AX + 2000) / MT), j0 = Math.floor((cz - r - AZ + 2000) / MT), j1 = Math.floor((cz + r - AZ + 2000) / MT);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let pass = 0; pass < 3; pass++) for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const t = mtiles.get(mkey(i, j)); if (!t) continue;
      if (pass === 0) { if (t.park) { g.fillStyle = 'rgba(122,178,96,0.4)'; g.fill(t.park); } if (t.water) { g.fillStyle = 'rgba(110,160,210,0.55)'; g.fill(t.water); } if (t.bld) { g.fillStyle = 'rgba(206,210,218,0.26)'; g.fill(t.bld); } }
      else if (pass === 1) for (const [wk, p] of t.roads) { if (wk >= 100) continue; g.strokeStyle = '#c9cdd4'; g.lineWidth = wk; g.stroke(p); }
      else for (const [wk, p] of t.roads) { if (wk < 100) continue; g.strokeStyle = '#e9ebee'; g.lineWidth = wk - 100; g.stroke(p); }
    }
  };

  // ==== 在內湖的時候：世界那邊 1.6 公里外的東西不畫（霧 1500 公尺外全白；小村莊、賽車場一兩百個 draw call 省下來）====
  //   鏡頭在內湖裡面（離西北角的入口 380 公尺以上、比北邊的山脊低）：山脊後面的東西（整個在 z 262 以北）也不畫——被山和房子擋住了；很大的一群（快速道路⋯）拆開來一個一個算
  const cullList = [], hidden = new Set(); let cullReady = false;
  function cullWorld(x, y, z, on) {
    if (on && !cullReady) {
      cullReady = true; const B = new THREE.Box3(), Sp = new THREE.Sphere();
      const add = (o) => { if (o === group || /^lodcar|^bigspot/.test(o.name)) return; B.setFromObject(o); if (B.isEmpty()) return; B.getBoundingSphere(Sp); if (Sp.radius > 400 && !o.isMesh && o.children.length > 1) { for (const k of o.children) add(k); return; } cullList.push({ o, x: Sp.center.x, z: Sp.center.z, r: Sp.radius, z1: B.max.z }); };
      for (const o of V.group.children) add(o); const sc = V.group.parent;
      if (sc) for (const o of sc.children) if (o.name === 'room' || (o.isMesh && !o.name)) add(o); // 小村莊的格子、賽車場、越野車場、快速道路⋯、車庫、直線加速賽道（直接放在場景裡、不會動的那些 mesh）
    }
    const ridge = on && y < 60 && z > BZ0 + 40 && Math.hypot(x - BX0, z - BZ0) > 380;
    for (const c of cullList) {
      const far = on && (Math.hypot(c.x - x, c.z - z) - c.r > 1600 || (ridge && c.z1 < RIDGE_Z + 30));
      if (far) { if (c.o.visible) { c.o.visible = false; hidden.add(c.o); } } else if (hidden.has(c.o)) { c.o.visible = true; hidden.delete(c.o); } // 只放回自己藏的
    }
  }
  const uncull = () => { if (hidden.size) cullWorld(0, 0, 0, false); };
  // ==== 世界本來的草地（village.js 的 ground、race.src.js 1312 × 900 的賽道草地）：內湖範圍（外面多 12 公尺）挖掉，不然跟內湖的地面疊在一起會閃；dispose 放回原來的 ====
  const HOLE = [BX0 - HM, BZ0 - HM, BX1 + HM, BZ1 + HM], carved = []; let carveDone = false;
  const cut = (a, c, b, d, out) => { // 長方形 a…b × c…d 減掉 HOLE（最多 4 塊）
    const [h0, h1, h2, h3] = HOLE; if (b <= h0 || a >= h2 || d <= h1 || c >= h3) { out.push([a, c, b, d]); return; }
    if (a < h0) out.push([a, c, h0, d]); if (b > h2) out.push([h2, c, b, d]);
    const x0 = Math.max(a, h0), x1 = Math.min(b, h2); if (c < h1) out.push([x0, c, x1, h1]); if (d > h3) out.push([x0, h3, x1, d]);
  };
  function carveWorld() {
    if (carveDone || !V.group.parent) return; carveDone = true; let sc = V.group.parent; while (sc.parent) sc = sc.parent;
    const rebuild = (m, cells, toP, toUV, nrm) => {
      const P = [], Nn = [], UV = [];
      for (const [a, c, b, d] of cells) for (const [x, z] of [[a, d], [b, d], [b, c], [a, d], [b, c], [a, c]]) { const q = toP(x, z), u = toUV(x, z); P.push(q[0], q[1], q[2]); Nn.push(nrm[0], nrm[1], nrm[2]); UV.push(u[0], u[1]); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.computeBoundingSphere();
      carved.push([m, m.geometry]); m.geometry = g;
    };
    sc.traverse((m) => {
      if (!m.isMesh || carved.some((c) => c[0] === m)) return;
      const gp = m.geometry.parameters;
      if (m.name === 'ground' && !m.geometry.index && m.geometry.attributes.position.count % 6 === 0) { // 小村莊的草地：50 公尺一格、每格 6 個點（y 0）
        const A = m.geometry.attributes.position.array, cells = [];
        for (let i = 0; i < A.length; i += 18) { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (let k = 0; k < 18; k += 3) { a = Math.min(a, A[i + k]); b = Math.max(b, A[i + k]); c = Math.min(c, A[i + k + 2]); d = Math.max(d, A[i + k + 2]); } cut(a, c, b, d, cells); }
        rebuild(m, cells, (x, z) => [x, 0, z], (x, z) => [x / 6, -z / 6], [0, 1, 0]);
      } else if (m.geometry.type === 'PlaneGeometry' && gp.width === 1312 && gp.height === 900) { // 賽道的草地（轉成平躺、中心 (594, −0.02, 0)）：22 × 15 格
        const cx = m.position.x, cz = m.position.z, x0 = cx - 656, z0 = cz - 450, cells = [];
        for (let i = 0; i < gp.widthSegments; i++) for (let j = 0; j < gp.heightSegments; j++) cut(x0 + (1312 * i) / gp.widthSegments, z0 + (900 * j) / gp.heightSegments, x0 + (1312 * (i + 1)) / gp.widthSegments, z0 + (900 * (j + 1)) / gp.heightSegments, cells);
        rebuild(m, cells, (x, z) => [x - cx, -(z - cz), 0], (x, z) => [(x - x0) / 1312, (cz + 450 - z) / 900], [0, 0, 1]);
      }
    });
  }
  const uncarve = () => { for (const [m, g] of carved) { m.geometry.dispose(); m.geometry = g; } carved.length = 0; carveDone = false; };
  // ==== 每一幀：遠的格子不畫 ====
  let lastUp = -1;
  function update(camera) {
    if (!camera) return; if (!carveDone) carveWorld(); const x = camera.position.x, z = camera.position.z;
    const far = boxD(x, z) > 1600; group.visible = !far; if (far) { uncull(); return; }
    const y = camera.position.y; if (lastUp >= 0 && Math.abs(x - update.x) + Math.abs(z - update.z) + Math.abs(y - update.y) < 8) return; update.x = x; update.y = y; update.z = z; lastUp = 1;
    cullWorld(x, y, z, boxD(x, z) < 150);
    for (const m of tileMeshes) { const [mx, mz] = m.userData.c, d = Math.hypot(mx - x, mz - z) - m.userData.r; m.visible = d < m.userData.far; }
    for (const m of treeMeshes) { if (m.userData.hill) continue; const [mx, mz] = m.userData.c, d = Math.hypot(mx - x, mz - z) - 180; m.visible = d < 400; } // 路邊的樹：250 公尺一格，400 公尺外不畫（霧裡看不太到）
  }
  update.x = 0; update.y = 0; update.z = 0;

  const info = { meshes, tris: Math.round(tris), colliders: colliders.length, bigSigns: bigSigns.length, buildings: nb, arcades: nArc, sheds: nShed, shopSigns: vSigns.length, trees: N.trees.length, ms: 0, at: [AX, AZ], box: [BX0, BZ0, BX1, BZ1] };
  if (V.info) V.info.neihu = info;
  const P = {
    group, info, inside, update, uncull, place, routeTo, roadName, bigSigns, names: D.names, link: LK, destNode, pathTo: (x, z) => pathTo(x, z, destNode), data: N, hillH, inBox,
    dispose() {
      uncull(); uncarve(); group.removeFromParent(); group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const m of Object.values(mats)) m.dispose(); for (const t of [FA.tex, SA.tex, tAsph, tPave, tGround]) t.dispose();
    },
  };
  V.neihu = P;
  const d0 = V.dispose; V.dispose = function () { P.dispose(); return d0 ? d0.apply(this, arguments) : undefined; };
  info.ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - T0);
  return P;
}

return { buildNeihu, neihuFonts, NEIHU_TEXT, NEIHU_KEEP };
})();
