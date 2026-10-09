// ---- 小村莊（改車遊戲）：台灣鄉下的小村子＋快速道路，自己開車從你的車庫去改車廠、車店、賽道、上快速道路 ----
// Nick 2026-09-27：「有小村莊有改車廠要比賽要自己開去小村莊裡的賽道」
// Nick 2026-09-28：車庫要真的可以停車、開鐵捲門開出去；買車要開去車店；修車廠要自己開進去；路上可以開到極速（快速道路）
// 低多邊形、全部用程式做（貼圖都是 canvas 畫的，沒有下載任何東西）
// 世界座標跟賽道（race.src.js 的 buildTrack）一樣，兩個可以放在同一個場景：
//   x 往東（賽道的前進方向）、y 往上、z 往南（朝東開時車子的右邊）；公尺
//   賽道柏油 x −60…760（寬 12、兩邊水泥護欄 z = ±6.3）、起跑線 x = 0、起跑區 x −14…0、|z| ≤ 6
//   村子在賽道西邊（x −395…−60）：大路（z = 0）往東開到賽道西邊的開口（x = −60），直接接上賽道的柏油；
//   大路往西穿過村子、經過車店（阿財車行），到快速道路的路口（x = −518）
//   快速道路：村子西邊一整圈（東邊那段直線 x = −530、z −225…225，450 公尺；北、南兩個半徑 250 的半圓；西邊直線 x = −1030），一圈 2.47 公里
//     Nick 2026-09-28：「高速公路太長了」→ 從 4.7 公里縮成一半（原本東邊直線 1250 公尺、半圓半徑 350、西邊大 S 彎）
//     雙向各兩線＋內路肩 1 公尺＋外路肩 3 公尺，中間紐澤西護欄、兩邊鋼板護欄；路口是平面的 T 字路口（中間護欄開口，可以左轉）
// 【API】
//   await villageFonts();                  招牌上的中文要等字型（最多等 1.5 秒，沒有就用系統字）
//   const V = buildVillage({ renderer });  renderer 可省略（只拿來設貼圖的 anisotropy）；chunk：合併網格的格子大小（公尺，預設 200）
//                                          garagePlaceholder: true：蓋一個簡單的車庫殼（牆＋6 公尺的門洞＋碰撞），測試用；真的車庫模組由別人放在 places.garage.lot
//   scene.add(V.group)
//   V.places.garage | shop | dealer | track | highway：{ name, pos: [x, z], spawn: { x, z, heading }, zone: { x, z, hx, hz, rot } … }
//       heading＝車子的 rotation.y（0 朝東 +x、π/2 朝北 −z、π 朝西、−π/2 朝南 +z）
//       長方形（zone、apron、bay⋯）：中心、半寬 hx（沿 rot 那個方向）、半深 hz、rot＝rotation.y
//     garage：lot＝車庫模組原點的世界位置（模組本地：原點＝裡面停車位的車子中心、地板 y 0、車頭朝本地 +x＝朝鐵捲門外；
//               牆含在內 x −13…+5.3、z −13…+13、高 ≤ 6；鐵捲門在 +x 那面牆（x = +5、厚 0.3）中間、寬 6、高 3.8）
//             spawn＝lot；door＝門口中間（heading 朝外）；apron＝門前的水泥地（本地 x 5.3…22、z ±7：停在這裡 HUD 給「開鐵捲門」）；
//             inside＝車庫裡面的地板（本地 x −12.7…5、z ±12.7）；zone＝apron＋inside 的外框（本地 x −12.7…22、z ±12.7）
//             車庫的牆、碰撞這裡都沒有（模組自己有）；別的碰撞都在外框外面；門口直直出去 90 公尺是一條路（沒有東西擋）
//     shop（阿輝改車廠）：開得進去的改車區（前門進、後門出）：bay＝改車區地板（停在這裡打開改車廠）、park＝改車區中間（朝出口）、
//             exit＝後門外面（朝前，從院子、東邊的小路開回大路）、spawn＝exit、zone＝改車區＋門口前面、view＝改車時的鏡頭 { pos, look, fov }
//     dealer（阿財車行）：display＝6 台展示車的位置 [{ x, z, y, heading }]（轉盤中心、y＝轉盤面 0.06；玻璃展示間裡，從大路看得到；車 4.2–4.8 × 2 公尺，四周都有 1 公尺以上）、bay＝買車區（車棚下面，停在這裡打開車店）、
//             park＝買車區中間（朝前）、exit＝買完新車出現的地方（朝大路、前面沒東西）、spawn＝exit、zone＝買車區＋前面那段、view＝展示間裡看車的鏡頭
//     track：spawn、zone＝起跑區 x −14…0、|z| ≤ 6；start＝{ noseX: 0, z: 2.4, heading: 0 }：起跑線上（車頭對齊 x = 0、右邊車道，跟 race.src.js 的 putCar 一樣）
//     highway（快速道路）：zone＝路口（上快速道路的地方）、spawn＝外側車道、路口北邊一點、朝北
//   V.colliders：[{ t: 'box', x, z, hx, hz, rot, h } | { t: 'circle', x, z, r, h }]（xz 平面；h＝高度，鏡頭避開房子用）
//   V.roads：[{ pts: [[x, z], ...], w, kind }]（小地圖畫路；kind：main 大路、street 村子的路、farm 水泥農路、drive 車道／前庭、strip 賽道、highway 快速道路（中線、w 是整條路寬））
//   V.route(x, z, dest) → { pts: [[x, z], ...], len }：從 (x, z) 沿著路開到 dest（'garage' | 'shop' | 'track' | 'dealer' | 'highway'）
//       單行道：改車廠、車店都是前面進、另一邊出；快速道路兩個方向分開算（在哪一邊就只能往前開，到路口才出得去）
//       garage 開到車庫門口再進去停車位；shop 開到改車區；dealer 開到買車區；highway 開到路口（上外側車道）
//   V.surfaceAt(x, z) → 0 大路（賽道、往賽道的路、往快速道路的路）、3 村子的小路、水泥地、4 快速道路、1 草地、2 稻田
//   V.areas：{ paddy: [長方形], pave: [長方形] }（小地圖畫稻田用）
//   V.buildings：[{ kind: house | shop | temple | store | farmhouse | dealer | garage, name?, sign?, front?, up?, x, z, hx, hz, rot, h, floors?, door: { x, z, ry } }]
//       透天厝一排的店：name＝橫招牌（阿嬤雜貨店、好吃牛肉麵、阿國機車行）；sign＝直立招牌的字（理髮、冰店、早餐、藥局、檳榔⋯：一樓做生意）；front＝一樓正面 shop | shutter | door；up＝二樓以上每層正面（'b' 陽台 | 'w' 鐵窗）
//       房子的外框（長方形，跟碰撞一樣）；door＝大門外面一點、ry＝房子正面朝的方向（以後走進去、放居民用）
//   V.highway：{ len, center: [[x, z], ...]（中線，一圈，從路口往北）, out / in: [[x, z], ...]（外圈往北、內圈往南那一邊的中間（離中線 5.05），照開的方向）,
//               half: 11.9（中線到路肩邊）, lanes: [3.175, 6.925]（兩個車道中間離中線幾公尺，往右） }（直線 25 公尺、彎道 1.5 度一點；以後的車流用）
//   V.bounds：{ x0, x1, z0, z1 }（小地圖範圍：−1090…12、−530…530）
//   V.info：{ meshes, tris, village: { meshes, tris }, highway: { meshes, tris }, ground }（group 裡：村子的網格、名字 hwy- 開頭的 highway 子 group、ground、wires）
//   V.dispose()
// ==== 第 3 批（b3-city）：街景、警察局、槍店（Nick 2026-09-28 06:21「要警察局」、06:22「街景盡量真一點」、07:19「有店可以買槍 子彈」）====
//   V.places.police（警察局，大路西段南邊、W 路口往南開進前院）：{ name, pos, spawn（警車開出來的地方，朝大路）, zone（前院）, door（大門外面、朝外）,
//       yard（被抓以後你的車停這裡）, cell（拘留室裡面）, counter（櫃台前面）, lot, building } —— 裡面：police.js 的 buildPoliceInterior()
//   V.places.gunshop（槍店，改車廠對面）：{ name, pos, spawn, zone（店門口的水泥地）, door（店門外面、朝外）, front, building } —— 裡面是別的模組（gunshop.js）
//   V.buildings 多兩棟：{ kind: 'police', name: '警察局', … }、{ kind: 'gunshop', name: '槍店', … }（door 跟透天厝一樣）
//   V.sidewalks：[{ pts, w, side }]（房子前面走路的地方的中線）、V.crossings：斑馬線、V.signals：紅綠燈（phase(t)）、V.clock()：紅綠燈的時間（秒）
//   V.street、V.police：street.js／police.js 的回傳（info、sky、cars⋯）
// ==== 第 3 批 end ====
// stripColliders()：賽道那邊的護欄、看台、路燈、燈樹（村子沒有做，開車碰撞用；buildTrack() 的東西）
// 效能：同一種材質、同一格（200 公尺）的東西全部併成一個網格（快速道路的路燈也併進去，不另外多 draw call）；沒有即時陰影；貼圖都是 canvas，最大 1024
//       地面：草地往後推一點（polygonOffset）、切成 50 公尺的格子；路 y 0.03、水泥地 0.02、稻田 0.012、路口 0.04
import * as THREE from 'three';
import { buildStreet, STREET_TEXT } from './street.js'; // ==== 第 3 批：街景 ====
import { buildPoliceStation, POLICE_TEXT } from './police.js'; // ==== 第 3 批：警察局 ====

// 打包（build-art.mjs、build-app.mjs）會拿掉 import、把 export 變成一般宣告、所有檔接在同一個 script 裡：
// 這個檔全部包在一個函式裡，只露出下面三個名字，不會跟別的檔撞名（跟 cabin.js 的 CABIN 一樣）
export const { buildVillage, stripColliders, villageFonts } = (() => {
const TAU = Math.PI * 2, FH = 3.3; // 透天厝一層樓高
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", "WenQuanYi Zen Hei", sans-serif';
const COND = '"Barlow Condensed", "Arial Narrow", sans-serif';
const SIGN_TEXT = '一三下乘你便保個停光入冰出利到前加勿北區南口可吃合商回圈國在大好嬤子宮就局店庫廠引往德快慢持擎改新早有末村榔機檳歡每減渦漆烤牛率理的直福線肉肩胎臨藥行裝裡試財貨買賽超距路車輝輪迎這速週道開阿院雜零面餐駛髮麵龍';

// 招牌的字型：等 Google Fonts 的 Noto Sans TC、Barlow Condensed（最多 ms 毫秒）
function villageFonts(ms = 1500) {
  const f = typeof document !== 'undefined' && document.fonts;
  if (!f || !f.load) return Promise.resolve();
  const all = Promise.all([f.load(`700 64px ${SANS}`, SIGN_TEXT + STREET_TEXT + POLICE_TEXT /* 第 3 批 */), f.load(`700 64px ${COND}`, 'RACEWAY 0123456789 M TUNING 24H km')]).catch(() => {});
  return Promise.race([all, new Promise((r) => setTimeout(r, ms))]);
}

// ---- 小工具 ----
function rng(seed) { // 固定種子的亂數：每次蓋出來都一樣（碰撞、測試、截圖才對得起來）
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash2 = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul((b | 0) + 7, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const CC = new Map();
const C = (hex) => { let v = CC.get(hex); if (!v) { const c = new THREE.Color(hex); v = [c.r, c.g, c.b]; CC.set(hex, v); } return v; }; // 線性顏色
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const pick = (r, list) => list[(r() * list.length) | 0];
const HOUSE_MAX_FL = 2; // 第 10 批（Nick 2026-10-09「所有房子變矮」）：透天厝最多 2 層
// 本地座標框：原點 (x, y, z)、繞 y 轉 ry（跟 three.js rotation.y 一樣：本地 +x → (cos, 0, −sin)）
function frame(x, y, z, ry = 0, s = 1) {
  const c = Math.cos(ry) * s, n = Math.sin(ry) * s;
  const f = { x, y, z, ry, s, p: (lx, ly, lz) => [x + lx * c + lz * n, y + ly * s, z - lx * n + lz * c] };
  f.sub = (lx, ly, lz, dry = 0, ds = 1) => { const q = f.p(lx, ly, lz); return frame(q[0], q[1], q[2], ry + dry, s * ds); };
  return f;
}

// ---- canvas 貼圖 ----
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function toTex(c, aniso, wrap) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (wrap === 'both') t.wrapS = t.wrapT = THREE.RepeatWrapping; else if (wrap === 't') t.wrapT = THREE.RepeatWrapping;
  return t;
}
function speck(g, R, w, h, n, style, s = 2) { for (let i = 0; i < n; i++) { g.fillStyle = typeof style === 'function' ? style() : style; g.fillRect(R() * w, R() * h, 1 + R() * s, 1 + R() * s); } }
function fitFont(g, text, maxW, px, weight = 700, fam = SANS) { let s = px; for (; s > 8; s -= 2) { g.font = `${weight} ${s}px ${fam}`; if (g.measureText(text).width <= maxW) break; } return s; }
function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
// 一張貼圖集：reg(名字, x, y, w, h, 畫) → uv [u0, v0, u1, v1]（canvas 上面＝v 大）；pack(名字, w, h, 畫)：自己一排一排排（要先放高的）
function sheet(W, H) {
  const [c, g] = cv(W, H), uv = {};
  const reg = (name, x, y, w, h, draw) => {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); draw(g, w, h); g.restore();
    return (uv[name] = [(x + 0.5) / W, 1 - (y + h - 0.5) / H, (x + w - 0.5) / W, 1 - (y + 0.5) / H]);
  };
  let px = 0, py = 0, rowH = 0;
  const pack = (name, w, h, draw) => {
    if (px + w > W) { px = 0; py += rowH; rowH = 0; }
    if (py + h > H) throw new Error(`atlas full: ${name}`);
    const r = reg(name, px, py, w, h, draw); px += w; rowH = Math.max(rowH, h); return r;
  };
  return { c, g, uv, reg, pack };
}
const dotUV = (r) => { const u = (r[0] + r[2]) / 2, v = (r[1] + r[3]) / 2; return [u, v, u, v]; }; // 單色的面：整面取區塊中間一點
const subUV = (r, a, b, c, d) => [r[0] + (r[2] - r[0]) * a, r[1] + (r[3] - r[1]) * b, r[0] + (r[2] - r[0]) * c, r[1] + (r[3] - r[1]) * d];
const flipU = (r) => [r[2], r[1], r[0], r[3]]; // 左右相反（箭頭朝另一邊）
function arrowGlyph(g, cx, cy, s, dir, col) { // 粗箭頭：U 往前、L 左轉、R 右轉、UR 右前、UL 左前、D 往下
  g.save(); g.translate(cx, cy); g.rotate({ U: 0, R: Math.PI / 2, L: -Math.PI / 2, D: Math.PI, UR: Math.PI / 4, UL: -Math.PI / 4 }[dir]); g.fillStyle = col; g.beginPath();
  g.moveTo(0, -s); g.lineTo(s * 0.85, -s * 0.05); g.lineTo(s * 0.32, -s * 0.05); g.lineTo(s * 0.32, s); g.lineTo(-s * 0.32, s); g.lineTo(-s * 0.32, -s * 0.05); g.lineTo(-s * 0.85, -s * 0.05);
  g.closePath(); g.fill(); g.restore();
}
function turnGlyph(g, cx, cy, s, right, col) { // 轉彎箭頭（↱ ↰）：往上一段再轉過去
  g.save(); g.translate(cx, cy); if (!right) g.scale(-1, 1); g.fillStyle = col; g.beginPath();
  g.moveTo(-s * 0.55, s); g.lineTo(-s * 0.55, -s * 0.25); g.quadraticCurveTo(-s * 0.55, -s * 0.62, -s * 0.18, -s * 0.62); g.lineTo(s * 0.25, -s * 0.62); g.lineTo(s * 0.25, -s * 0.98);
  g.lineTo(s, -s * 0.44); g.lineTo(s * 0.25, s * 0.1); g.lineTo(s * 0.25, -s * 0.26); g.lineTo(-s * 0.12, -s * 0.26); g.quadraticCurveTo(-s * 0.2, -s * 0.26, -s * 0.2, -s * 0.12); g.lineTo(-s * 0.2, s);
  g.closePath(); g.fill(); g.restore();
}
function iconGlyph(g, kind, cx, cy, s, col, bg = '#000') { // 小圖示：flag 格子旗、wrench 扳手、house 房子、car 汽車、road 快速道路；bg＝挖空的地方的顏色（null＝真的挖空：地上的字）
  g.save(); g.translate(cx, cy); g.fillStyle = col; g.strokeStyle = col;
  const cut = (f) => { g.save(); if (bg) g.fillStyle = bg; else { g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; } f(); g.restore(); };
  if (kind === 'flag') {
    g.fillRect(-s * 0.55, -s * 0.8, s * 0.12, s * 1.6);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) g.fillRect(-s * 0.43 + i * s * 0.26, -s * 0.8 + j * s * 0.26, s * 0.26, s * 0.26);
    g.lineWidth = s * 0.06; g.strokeRect(-s * 0.43, -s * 0.8, s * 1.04, s * 0.78);
  } else if (kind === 'wrench') {
    g.rotate(-Math.PI / 4); g.fillRect(-s * 0.13, -s * 0.35, s * 0.26, s * 1.15);
    g.lineWidth = s * 0.26; g.beginPath(); g.arc(0, -s * 0.52, s * 0.3, Math.PI * 0.72, Math.PI * 2.28); g.stroke();
  } else if (kind === 'car') {
    g.beginPath(); g.moveTo(-s * 0.98, s * 0.3); g.lineTo(-s * 0.98, -s * 0.06); g.lineTo(-s * 0.6, -s * 0.14); g.lineTo(-s * 0.32, -s * 0.52); g.lineTo(s * 0.34, -s * 0.52); g.lineTo(s * 0.62, -s * 0.14);
    g.lineTo(s * 0.98, -s * 0.04); g.lineTo(s * 0.98, s * 0.3); g.closePath(); g.fill();
    cut(() => { g.fillRect(-s * 0.26, -s * 0.44, s * 0.24, s * 0.26); g.fillRect(s * 0.04, -s * 0.44, s * 0.26, s * 0.26); });
    for (const x of [-0.55, 0.56]) { g.beginPath(); g.arc(x * s, s * 0.34, s * 0.23, 0, TAU); g.fill(); }
  } else if (kind === 'road') {
    g.beginPath(); g.moveTo(-s, s * 0.85); g.lineTo(-s * 0.2, -s * 0.85); g.lineTo(s * 0.2, -s * 0.85); g.lineTo(s, s * 0.85); g.closePath(); g.fill();
    cut(() => { for (const [y, h2, w2] of [[-0.7, 0.22, 0.05], [-0.25, 0.3, 0.07], [0.3, 0.4, 0.09]]) g.fillRect(-w2 * s, y * s, w2 * 2 * s, h2 * s); });
  } else if (kind === 'police') { // ==== 第 3 批：警察局＝盾牌＋星星（一般的圖形，不是真的警徽）====
    g.beginPath(); g.moveTo(0, -s * 0.9); g.lineTo(s * 0.78, -s * 0.62); g.lineTo(s * 0.7, s * 0.2); g.quadraticCurveTo(s * 0.5, s * 0.66, 0, s * 0.92); g.quadraticCurveTo(-s * 0.5, s * 0.66, -s * 0.7, s * 0.2); g.lineTo(-s * 0.78, -s * 0.62); g.closePath(); g.fill();
    cut(() => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = (i % 2 ? 0.2 : 0.46) * s; g.lineTo(Math.cos(a) * r, Math.sin(a) * r - s * 0.02); } g.closePath(); g.fill(); });
  } else if (kind === 'gun') { // ==== 第 3 批：槍店＝準星 ====
    g.lineWidth = s * 0.17; g.beginPath(); g.arc(0, 0, s * 0.6, 0, TAU); g.stroke();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.fillRect(dx ? (dx > 0 ? s * 0.3 : -s * 0.95) : -s * 0.08, dy ? (dy > 0 ? s * 0.3 : -s * 0.95) : -s * 0.08, dx ? s * 0.65 : s * 0.16, dy ? s * 0.65 : s * 0.16);
    g.beginPath(); g.arc(0, 0, s * 0.13, 0, TAU); g.fill();
  } else {
    g.beginPath(); g.moveTo(0, -s * 0.85); g.lineTo(s * 0.85, -s * 0.05); g.lineTo(s * 0.62, -s * 0.05); g.lineTo(s * 0.62, s * 0.75); g.lineTo(-s * 0.62, s * 0.75); g.lineTo(-s * 0.62, -s * 0.05); g.lineTo(-s * 0.85, -s * 0.05); g.closePath(); g.fill();
  }
  g.restore();
}
const HG = '#00783C'; // 快速道路指示牌的綠
const SHOP_NAMES = ['阿嬤雜貨店', '好吃牛肉麵', '阿國機車行']; // 一樓店面的橫招牌（house 的 o.shop % 3）
const VSIGN_TEXT = ['雜貨店', '麵店', '機車行', '理髮', '冰店', '早餐', '藥局', '檳榔']; // 直立招牌（o.vsign）
const VSIGN_COL = [['#d33b2c', '#fff'], ['#f2c230', '#b3261e'], ['#2f6fd6', '#fff'], ['#ffffff', '#1f5fae'], ['#5bc0eb', '#fff'], ['#ff8a2a', '#fff'], ['#2e9a5c', '#fff'], ['#ff5fa2', '#fff']];
function vText(g, t, cx, y0, step, px, col) { g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${px}px ${SANS}`; [...t].forEach((ch, k) => g.fillText(ch, cx, y0 + k * step)); } // 直的字（從上往下）

// 牆壁、窗戶、屋瓦⋯（有光照；白底的區塊用頂點色上色）
function mainAtlas(R) {
  const S = sheet(1024, 1024), reg = S.reg;
  reg('white', 0, 0, 64, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); });
  reg('conc', 0, 64, 64, 64, (g, w, h) => { g.fillStyle = '#ecebe7'; g.fillRect(0, 0, w, h); speck(g, R, w, h, 140, () => `rgba(0,0,0,${0.03 + R() * 0.05})`); });
  reg('ac', 64, 0, 32, 32, (g, w, h) => { // 冷氣室外機
    g.fillStyle = '#efefeb'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8f949a'; g.lineWidth = 1.3;
    for (const r of [11, 7.5, 4]) { g.beginPath(); g.arc(20, 16, r, 0, TAU); g.stroke(); }
    g.beginPath(); g.moveTo(9, 16); g.lineTo(31, 16); g.moveTo(20, 5); g.lineTo(20, 27); g.stroke();
    g.fillStyle = '#b3b8be'; for (let y = 5; y < 28; y += 4) g.fillRect(2, y, 5, 1.5);
  });
  reg('tank', 64, 32, 32, 64, (g, w, h) => { // 不鏽鋼水塔
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#9aa0a7'); gr.addColorStop(0.3, '#f4f6f8'); gr.addColorStop(0.55, '#c4c9cf'); gr.addColorStop(1, '#8e949b');
    g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.2)'; for (let y = 6; y < h; y += 11) g.fillRect(0, y, w, 1.5);
  });
  reg('bark', 96, 0, 32, 128, (g, w, h) => { g.fillStyle = '#8f9585'; g.fillRect(0, 0, w, h); g.fillStyle = '#c9ccbb'; for (let y = 3; y < h; y += 7) g.fillRect(0, y, w, 2); speck(g, R, w, h, 50, 'rgba(60,60,50,0.2)'); });
  reg('shutter', 128, 0, 128, 128, (g, w, h) => { // 鐵捲門
    g.fillStyle = '#d5d8dc'; g.fillRect(0, 0, w, h);
    for (let y = 2; y < h - 10; y += 5) { g.fillStyle = '#a4a9b0'; g.fillRect(0, y, w, 1.2); g.fillStyle = '#f2f3f5'; g.fillRect(0, y + 1.2, w, 1); }
    g.fillStyle = '#878c93'; g.fillRect(0, h - 10, w, 10); g.fillStyle = '#4f545a'; g.fillRect(w / 2 - 9, h - 8, 18, 3);
    for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(120,95,60,${0.04 + R() * 0.06})`; g.fillRect(R() * w, 0, 2 + R() * 6, h); }
  });
  const glass = (g, w, h, curtain) => { // 玻璃窗：天空倒影、窗簾、鋁框
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8aa2b6'); gr.addColorStop(0.45, '#3d5367'); gr.addColorStop(1, '#27323e');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (curtain) { g.fillStyle = curtain; g.fillRect(w * 0.06, h * 0.08, w * 0.34, h * 0.86); g.fillStyle = 'rgba(0,0,0,0.13)'; for (let x = w * 0.08; x < w * 0.4; x += 7) g.fillRect(x, h * 0.08, 2, h * 0.86); }
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(w * 0.55, 0); g.lineTo(w * 0.78, 0); g.lineTo(w * 0.38, h); g.lineTo(w * 0.15, h); g.fill();
    g.strokeStyle = '#c3c7cc'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  };
  reg('win1', 256, 0, 128, 128, (g, w, h) => { // 白色鐵窗（上面一排捲捲的花）
    glass(g, w, h, '#f3d9a4'); g.fillStyle = '#f7f7f4';
    for (let x = 5; x < w; x += 12) g.fillRect(x, 0, 3.5, h);
    for (const y of [0, h * 0.3, h * 0.64, h - 5]) g.fillRect(0, y, w, 4);
    g.strokeStyle = '#f7f7f4'; g.lineWidth = 3; for (let x = 11; x < w; x += 24) { g.beginPath(); g.arc(x, h * 0.3 - 11, 9, Math.PI, 0); g.stroke(); g.beginPath(); g.arc(x, h * 0.3 - 11, 4, 0, TAU); g.stroke(); }
  });
  reg('win2', 384, 0, 128, 128, (g, w, h) => { glass(g, w, h, '#f2b8c6'); g.fillStyle = '#3f7c59'; for (let x = 3; x < w; x += 16) g.fillRect(x, 0, 4, h); for (let y = 3; y < h; y += 16) g.fillRect(0, y, w, 4); }); // 綠色方格鐵窗
  reg('win3', 512, 0, 128, 128, (g, w, h) => { // 咖啡色菱形鐵窗
    glass(g, w, h, '#bcd7ea'); g.strokeStyle = '#6a4a36'; g.lineWidth = 3.5;
    for (let x = -h; x < w; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.moveTo(x + h, 0); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = '#6a4a36'; for (let x = 0; x <= w; x += 32) g.fillRect(x - 2, 0, 5, h); g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5);
  });
  reg('slide', 640, 0, 128, 128, (g, w, h) => { glass(g, w, h, '#ebe6da'); g.fillStyle = '#b3b7bc'; g.fillRect(w * 0.49, 0, 5, h); }); // 陽台落地窗
  reg('winP', 768, 0, 128, 128, (g, w, h) => { glass(g, w, h, null); g.fillStyle = 'rgba(236,236,230,0.55)'; for (let y = 8; y < h * 0.55; y += 5) g.fillRect(7, y, w - 14, 2.2); }); // 鋁窗＋百葉
  reg('gpanel', 896, 0, 128, 128, (g, w, h) => { // 深炭灰直條金屬板
    g.fillStyle = '#25272b'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = '#33363b'; g.fillRect(x + 4, 0, 7, h); g.fillStyle = '#4a4d53'; g.fillRect(x + 4, 0, 1.2, h); g.fillStyle = '#161719'; g.fillRect(x + 11, 0, 1.5, h); }
  });
  reg('shop1', 0, 128, 128, 128, (g, w, h) => { // 雜貨店：架子上五顏六色、冰箱
    g.fillStyle = '#4c3d2e'; g.fillRect(0, 0, w, h);
    const cs = ['#e0453a', '#f2c230', '#3b8fd9', '#43b36b', '#f07aa8', '#ffffff', '#ff8a2a'];
    for (const y of [36, 64, 92]) { g.fillStyle = '#7a634a'; g.fillRect(4, y, w * 0.62, 4); for (let x = 6; x < w * 0.62; x += 7) { g.fillStyle = pick(R, cs); const hh = 8 + R() * 15; g.fillRect(x, y - hh, 5.5, hh); } }
    g.fillStyle = '#e8eef3'; g.fillRect(w * 0.7, 12, w * 0.27, h - 26); g.fillStyle = '#a6dcff'; g.fillRect(w * 0.73, 18, w * 0.21, h - 40);
    for (let y = 24; y < h - 28; y += 12) for (let x = w * 0.74; x < w * 0.93; x += 6) { g.fillStyle = pick(R, cs); g.fillRect(x, y, 4, 9); }
    g.fillStyle = '#8b8f94'; g.fillRect(0, h - 12, w, 12); g.strokeStyle = '#c3c7cc'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, w - 5, h - 5);
  });
  reg('shop2', 128, 128, 128, 128, (g, w, h) => { // 麵店：菜單、大鍋子冒煙、紅色圓凳
    g.fillStyle = '#efe2c4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c62f25'; g.fillRect(10, 10, w - 20, 34); g.fillStyle = '#fff3c4'; for (let i = 0; i < 4; i++) g.fillRect(16 + i * 26, 16, 18, 22);
    g.fillStyle = '#c9ccd0'; g.fillRect(6, h * 0.62, w * 0.55, h * 0.38); g.fillStyle = '#2d2f33'; g.beginPath(); g.ellipse(34, h * 0.6, 20, 8, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; for (const [x, y, r] of [[30, 62, 9], [40, 52, 8], [28, 44, 7]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    g.fillStyle = '#d33b2c'; for (const x of [86, 108]) { g.fillRect(x - 7, h * 0.78, 14, 5); g.fillRect(x - 2, h * 0.78, 4, h * 0.22); }
    g.strokeStyle = '#c3c7cc'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, w - 5, h - 5);
  });
  reg('shop3', 256, 128, 128, 128, (g, w, h) => { // 機車行：牆上掛輪胎、一台機車
    g.fillStyle = '#34353a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#111'; g.lineWidth = 7; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(18 + i * 30, 30, 11, 0, TAU); g.stroke(); }
    g.fillStyle = '#d8d1c0'; g.fillRect(0, h - 16, w, 16);
    g.fillStyle = '#e04a3c'; rrect(g, 30, h - 56, 64, 26, 10); g.fill(); g.fillStyle = '#16171a'; for (const x of [40, 86]) { g.beginPath(); g.arc(x, h - 22, 11, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(70, h - 8, 26, 4, 0, 0, TAU); g.fill();
    g.strokeStyle = '#c3c7cc'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, w - 5, h - 5);
  });
  reg('twall', 384, 128, 128, 128, (g, w, h) => { // 廟的紅牆＋下面花崗石
    g.fillStyle = '#b3261e'; g.fillRect(0, 0, w, h * 0.66); g.strokeStyle = '#86170f'; g.lineWidth = 3; g.strokeRect(8, 8, w - 16, h * 0.66 - 14);
    g.fillStyle = '#d9a63a'; g.fillRect(0, h * 0.66 - 5, w, 4);
    g.fillStyle = '#a29d93'; g.fillRect(0, h * 0.66, w, h * 0.34); g.fillStyle = '#827d74';
    for (let y = h * 0.66 + 14; y < h; y += 14) g.fillRect(0, y, w, 1.5); for (let x = 0; x < w; x += 32) g.fillRect(x, h * 0.66, 1.5, h);
  });
  reg('tdoor', 512, 128, 128, 128, (g, w, h) => { // 廟門：金框、兩扇紅門、門神
    g.fillStyle = '#d4a93c'; g.fillRect(0, 0, w, h); g.fillStyle = '#a81e17'; g.fillRect(6, 6, w / 2 - 8, h - 6); g.fillRect(w / 2 + 2, 6, w / 2 - 8, h - 6);
    for (const cx of [w * 0.27, w * 0.73]) {
      g.fillStyle = '#2e7d4f'; g.beginPath(); g.moveTo(cx - 20, h - 12); g.lineTo(cx - 14, 50); g.lineTo(cx + 14, 50); g.lineTo(cx + 20, h - 12); g.fill();
      g.fillStyle = '#e0b040'; g.fillRect(cx - 16, 70, 32, 6); g.fillStyle = '#2657a8'; g.fillRect(cx - 12, 54, 24, 14);
      g.fillStyle = '#f0c49a'; g.beginPath(); g.arc(cx, 40, 11, 0, TAU); g.fill(); g.fillStyle = '#1b1b1b'; g.fillRect(cx - 13, 22, 26, 9); g.beginPath(); g.moveTo(cx - 8, 44); g.lineTo(cx + 8, 44); g.lineTo(cx, 60); g.fill();
      g.fillStyle = '#e0b040'; g.fillRect(cx + 16, 34, 3, 70);
    }
    g.fillStyle = '#e8c25a'; g.fillRect(w / 2 - 3, 6, 6, h);
  });
  reg('par1', 640, 128, 128, 64, (g, w, h) => { // 陽台花磚（圓洞）
    g.fillStyle = '#f0efeb'; g.fillRect(0, 0, w, h); g.fillStyle = '#6f6d68';
    for (let x = 0; x < w; x += 16) for (let y = 8; y < h - 8; y += 16) { g.beginPath(); g.arc(x + 8, y + 8, 5.5, 0, TAU); g.fill(); }
    g.fillStyle = '#f0efeb'; for (let x = 0; x < w; x += 16) for (let y = 8; y < h - 8; y += 16) { g.beginPath(); g.arc(x + 8, y + 8, 2.2, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, w, 6);
  });
  reg('par2', 640, 192, 128, 64, (g, w, h) => { // 花瓶柱欄杆
    g.fillStyle = '#50565c'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2f1ed'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 8, w, 8);
    for (let x = 4; x < w; x += 12) { g.beginPath(); g.moveTo(x + 2, 10); g.lineTo(x + 6, 10); g.quadraticCurveTo(x + 11, 30, x + 7, h - 8); g.lineTo(x + 1, h - 8); g.quadraticCurveTo(x - 3, 30, x + 2, 10); g.fill(); }
  });
  reg('par3', 768, 128, 128, 64, (g, w, h) => { // 實心女兒牆＋一條彩色磁磚
    g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, w, h); g.fillStyle = '#9dbfcf'; g.fillRect(0, h * 0.42, w, 12);
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = 0; x < w; x += 8) g.fillRect(x, h * 0.42, 1, 12); g.fillRect(0, 0, w, 5);
  });
  reg('twin', 768, 192, 64, 64, (g, w, h) => { // 廟的圓形石窗
    g.fillStyle = '#b3261e'; g.fillRect(0, 0, w, h); g.fillStyle = '#9d988f'; g.beginPath(); g.arc(32, 32, 28, 0, TAU); g.fill();
    g.fillStyle = '#3a2a22'; g.beginPath(); g.arc(32, 32, 22, 0, TAU); g.fill(); g.fillStyle = '#9d988f';
    for (let i = -2; i <= 2; i++) { g.fillRect(29 + i * 9, 10, 5, 44); g.fillRect(10, 29 + i * 9, 44, 5); }
  });
  reg('mesh', 832, 192, 64, 64, (g, w, h) => { g.fillStyle = '#7d8288'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c4c8cd'; g.lineWidth = 1.2; for (let i = -h; i < w; i += 6) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); } });
  reg('brick', 896, 128, 128, 96, (g, w, h) => { g.fillStyle = '#d6cfc2'; g.fillRect(0, 0, w, h); for (let y = 0, r = 0; y < h; y += 7, r++) for (let x = (r % 2) * -8; x < w; x += 16) { g.fillStyle = `rgb(${160 + R() * 30},${68 + R() * 20},${46 + R() * 14})`; g.fillRect(x + 1, y + 1, 14, 5); } });
  reg('tile', 0, 256, 128, 256, (g, w, h) => { // 透天厝正面的小磁磚（白底，頂點色上色）
    g.fillStyle = '#f7f7f5'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) for (let y = 0; y < h; y += 8) if (R() < 0.12) { g.fillStyle = `rgba(0,0,0,${0.02 + R() * 0.04})`; g.fillRect(x, y, 8, 8); }
    g.fillStyle = 'rgba(120,120,112,0.28)'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 1, h); for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1);
    g.fillStyle = 'rgba(80,70,50,0.07)'; for (let i = 0; i < 6; i++) g.fillRect(R() * w, R() * h * 0.5, 2 + R() * 3, h * (0.2 + R() * 0.5));
  });
  reg('door', 128, 256, 96, 160, (g, w, h) => { // 大門：鋁門＋兩邊紅色春聯＋上面橫批
    g.fillStyle = '#f7f7f5'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8281e'; g.fillRect(3, 20, 13, 118); g.fillRect(w - 16, 20, 13, 118); g.fillRect(20, 4, w - 40, 12);
    g.fillStyle = '#1d1a18'; for (let y = 26; y < 132; y += 16) { g.fillRect(6, y, 7, 9); g.fillRect(w - 13, y, 7, 9); } for (let x = 26; x < w - 26; x += 12) g.fillRect(x, 6, 8, 8);
    g.fillStyle = '#b9bdc2'; g.fillRect(19, 19, w - 38, h - 19); g.fillStyle = '#3d5063'; g.fillRect(24, 24, w - 48, 58); g.fillRect(24, 88, w - 48, h - 94);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(28, 26, 8, 54); g.fillStyle = '#e8e8e8'; g.fillRect(w - 34, 92, 4, 16);
  });
  reg('ac2', 224, 448, 32, 32, (g, w, h) => { g.fillStyle = '#5e6268'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a3d42'; g.fillRect(4, 4, w - 8, h - 8); }); // 樓梯間的鐵門
  reg('corr', 224, 256, 256, 128, (g, w, h) => { // 浪板（白底，頂點色上色）
    g.fillStyle = '#e6e8ea'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) { g.fillStyle = '#fbfcfc'; g.fillRect(x, 0, 2.5, h); g.fillStyle = '#b8bdc3'; g.fillRect(x + 5, 0, 2, h); }
    g.fillStyle = 'rgba(120,90,60,0.08)'; for (let i = 0; i < 10; i++) g.fillRect(R() * w, 0, 3, h);
  });
  reg('troof', 480, 256, 256, 128, (g, w, h) => { // 廟的屋瓦：一條一條筒瓦，屋簷那邊一排綠色瓦當
    g.fillStyle = '#d98a2b'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 42) { const gr = g.createLinearGradient(x, 0, x + 21, 0); gr.addColorStop(0, '#a85f14'); gr.addColorStop(0.5, '#f6b54c'); gr.addColorStop(1, '#a85f14'); g.fillStyle = gr; g.fillRect(x + 21, 0, 21, h - 12); }
    g.fillStyle = 'rgba(90,40,0,0.25)'; for (let y = 10; y < h - 12; y += 14) g.fillRect(0, y, w, 2);
    g.fillStyle = '#2f8a5a'; g.fillRect(0, h - 12, w, 12); g.fillStyle = '#6cc48f'; for (let x = 21; x < w; x += 42) { g.beginPath(); g.arc(x + 10.5, h - 6, 5, 0, TAU); g.fill(); }
  });
  reg('rdoor', 736, 256, 256, 128, (g, w, h) => { // 改車廠的大鐵捲門（下面黃黑斜紋）
    g.fillStyle = '#a3aab2'; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 14; y += 6) { g.fillStyle = '#7f868e'; g.fillRect(0, y, w, 1.5); g.fillStyle = '#c5cad0'; g.fillRect(0, y + 1.5, w, 1); }
    g.fillStyle = '#50555c'; g.fillRect(0, 0, w, 10); g.fillStyle = '#f2c230'; g.fillRect(0, h - 14, w, 14);
    g.fillStyle = '#16171a'; for (let x = -14; x < w; x += 20) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 10, h); g.lineTo(x + 24, h - 14); g.lineTo(x + 14, h - 14); g.fill(); }
  });
  reg('ridge', 224, 384, 256, 32, (g, w, h) => { // 屋脊上的剪黏（彩色花）
    g.fillStyle = '#b8261c'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f8a5a'; g.fillRect(0, h - 7, w, 7);
    const cs = ['#f6d046', '#5fc1e8', '#ffffff', '#6cc48f', '#ff8a3d'];
    for (let x = 6; x < w; x += 13) { g.fillStyle = pick(R, cs); g.beginPath(); g.arc(x, 11, 4.5, 0, TAU); g.fill(); g.fillStyle = '#f6d046'; g.beginPath(); g.arc(x, 11, 1.8, 0, TAU); g.fill(); }
  });
  reg('band', 224, 416, 256, 32, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#12a39a'; g.fillRect(0, 3, w, 9); g.fillStyle = '#ffcf33'; g.fillRect(0, 13, w, 6); g.fillStyle = '#ff5a4a'; g.fillRect(0, 20, w, 9); }); // 超商的三色條
  reg('froof', 480, 384, 256, 128, (g, w, h) => { // 三合院的紅瓦
    g.fillStyle = '#9c3f2b'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#7a2c1d'); gr.addColorStop(0.5, '#c0583c'); gr.addColorStop(1, '#7a2c1d'); g.fillStyle = gr; g.fillRect(x + 8, 0, 8, h); }
    g.fillStyle = 'rgba(40,10,0,0.25)'; for (let y = 8; y < h; y += 12) g.fillRect(0, y, w, 1.5);
  });
  reg('gwin', 736, 384, 128, 128, (g, w, h) => { // 深色玻璃
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#46566a'); gr.addColorStop(0.5, '#1d2630'); gr.addColorStop(1, '#12171d'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(w * 0.2, 0); g.lineTo(w * 0.45, 0); g.lineTo(w * 0.15, h); g.lineTo(0, h); g.fill();
    g.fillStyle = '#0c0d0f'; for (let x = 0; x <= w; x += 32) g.fillRect(x - 2, 0, 4, h); g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
  });
  reg('barrier', 864, 384, 160, 64, (g, w, h) => { // 紅白水泥護欄（跟賽道的一樣）
    g.fillStyle = '#c9ccd0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#f2f3f5' : '#d0342c'; g.fillRect((i * w) / 4, 0, w / 4, h * 0.3); }
    speck(g, R, w, h, 200, 'rgba(0,0,0,0.05)');
  });
  reg('fence', 864, 448, 160, 64, (g, w, h) => { g.fillStyle = '#e8e9eb'; g.fillRect(0, 0, w, h); g.fillStyle = '#d0342c'; for (let x = 0; x < w; x += 40) g.fillRect(x, 0, 20, h); });
  // ---- 下面一半：快速道路、改車廠裡面、車行 ----
  reg('wbeam', 0, 512, 128, 32, (g, w, h) => { // 鋼板護欄（W 形斷面）：亮暗亮暗亮的橫條（只有上下變化：沿著路拉長也沒關係）
    const gr = g.createLinearGradient(0, 0, 0, h);
    [[0, '#f1f3f5'], [0.16, '#c3c8cd'], [0.3, '#80878e'], [0.5, '#e6e9ec'], [0.7, '#80878e'], [0.84, '#c3c8cd'], [1, '#eef0f2']].forEach(([t, c]) => gr.addColorStop(t, c));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  reg('crash', 128, 512, 64, 32, (g, w, h) => { g.fillStyle = '#ffcf33'; g.fillRect(0, 0, w, h); g.fillStyle = '#16171a'; for (let x = -h; x < w + h; x += 16) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 8, h); g.lineTo(x + 8 + h, 0); g.lineTo(x + h, 0); g.fill(); } }); // 黃黑斜紋（護欄頭、防撞桶）
  reg('peg', 0, 544, 256, 128, (g, w, h) => { // 工具牆：洞洞板上掛起子、扳手
    g.fillStyle = '#c9b27c'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(60,40,20,0.45)';
    for (let x = 4; x < w; x += 8) for (let y = 4; y < h; y += 8) g.fillRect(x, y, 1.6, 1.6);
    const cs = ['#d0342c', '#2f6fd6', '#f2c230', '#1d1f23', '#8f949b'];
    for (let i = 0; i < 16; i++) { const x = 10 + i * 15, c = pick(R, cs); g.fillStyle = '#9aa0a6'; g.fillRect(x, 14, 3, 30 + (i % 3) * 8); g.fillStyle = c; g.fillRect(x - 1, 44 + (i % 3) * 8, 5, 10); }
    for (let i = 0; i < 7; i++) { const x = 14 + i * 34; g.strokeStyle = '#7d848b'; g.lineWidth = 3; g.beginPath(); g.arc(x, 86, 7, 0, TAU); g.stroke(); g.fillStyle = '#7d848b'; g.fillRect(x - 2, 88, 4, 30); }
    g.fillStyle = '#5a3b22'; g.fillRect(0, h - 6, w, 6);
  });
  reg('rack', 256, 544, 256, 128, (g, w, h) => { // 輪胎架：紅色鐵架三層，一排一排輪胎
    g.fillStyle = '#2a2b2f'; g.fillRect(0, 0, w, h);
    for (const y of [4, 46, 88]) { for (let x = 6; x < w - 18; x += 21) { g.fillStyle = '#141517'; rrect(g, x, y, 19, 36, 5); g.fill(); g.fillStyle = '#3a3c40'; g.fillRect(x + 3, y + 4, 2, 28); g.fillRect(x + 14, y + 4, 2, 28); } g.fillStyle = '#c8322a'; g.fillRect(0, y + 36, w, 5); }
    g.fillStyle = '#c8322a'; g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h);
  });
  reg('shelf', 512, 544, 256, 128, (g, w, h) => { // 零件架：機油、零件盒
    g.fillStyle = '#5c6167'; g.fillRect(0, 0, w, h);
    const cs = ['#e0453a', '#f2c230', '#3b8fd9', '#43b36b', '#ff8a2a', '#1d1f23', '#f2f3f5'];
    for (const y of [36, 78, 120]) { g.fillStyle = '#8a9096'; g.fillRect(0, y, w, 5); for (let x = 3; x < w - 16;) { const hh = 14 + R() * 18, ww = 7 + R() * 8; g.fillStyle = pick(R, cs); g.fillRect(x, y - hh, ww, hh); x += ww + 2; } }
    g.fillStyle = '#8a9096'; g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h);
  });
  reg('carSide', 768, 544, 256, 80, (g, w, h) => { // 車子側面（白底，頂點色上色）：窗戶、門縫、輪拱
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#26303a'; g.beginPath(); g.moveTo(w * 0.22, h * 0.42); g.lineTo(w * 0.34, h * 0.08); g.lineTo(w * 0.7, h * 0.08); g.lineTo(w * 0.8, h * 0.42); g.closePath(); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(w * 0.52, h * 0.06, 5, h * 0.38);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.52, h * 0.44); g.lineTo(w * 0.52, h * 0.92); g.moveTo(w * 0.34, h * 0.44); g.lineTo(w * 0.34, h * 0.9); g.stroke();
    g.fillStyle = '#17181b'; for (const x of [w * 0.18, w * 0.82]) { g.beginPath(); g.arc(x, h, h * 0.42, Math.PI, 0); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(w * 0.42, h * 0.52, 12, 3); g.fillRect(w * 0.6, h * 0.52, 12, 3);
  });
  reg('carFront', 768, 624, 128, 48, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1f23'; g.fillRect(w * 0.3, h * 0.45, w * 0.4, h * 0.3); g.fillStyle = '#f4f6f8'; g.fillRect(6, h * 0.3, 26, 10); g.fillRect(w - 32, h * 0.3, 26, 10); g.fillStyle = '#3a3c40'; g.fillRect(0, h - 8, w, 8); });
  reg('carBack', 896, 624, 128, 48, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#d0342c'; g.fillRect(6, h * 0.25, 28, 10); g.fillRect(w - 34, h * 0.25, 28, 10); g.fillStyle = '#e8e8e8'; g.fillRect(w / 2 - 16, h * 0.5, 32, 10); g.fillStyle = '#3a3c40'; g.fillRect(0, h - 8, w, 8); });
  reg('panel', 0, 672, 128, 128, (g, w, h) => { g.fillStyle = '#eef0f2'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(80,90,100,0.28)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 1.5, h); for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 1.5); }); // 車行外牆的鋁板
  reg('rust', 128, 672, 128, 128, (g, w, h) => { g.fillStyle = '#9a6a48'; g.fillRect(0, 0, w, h); speck(g, R, w, h, 900, () => `rgba(${R() < 0.5 ? '60,30,15' : '190,120,70'},${0.2 + R() * 0.3})`, 4); }); // 廢車的鏽
  reg('floorT', 256, 672, 128, 128, (g, w, h) => { // 車行的亮面地磚：4 × 4 格（一格 1.2 公尺，一片貼 4.8 公尺）
    g.fillStyle = '#f1f1ee'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${0.02 + R() * 0.03})`; g.fillRect(i * 32, j * 32, 32, 32); }
    g.fillStyle = 'rgba(110,110,105,0.4)'; for (let k = 0; k < 4; k++) { g.fillRect(k * 32, 0, 1, h); g.fillRect(0, k * 32, w, 1); }
  });
  return S;
}

// 招牌、路標（有光照＋一點自發光，背光也看得清楚）
function signAtlas(R) {
  const S = sheet(1024, 1024), reg = S.reg;
  reg('white', 992, 992, 32, 32, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); });
  reg('shop', 0, 0, 640, 160, (g, w, h) => { // 改車廠大招牌：阿輝改車廠
    g.fillStyle = '#121316'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#FF6A1F'; g.beginPath(); g.moveTo(0, 0); g.lineTo(150, 0); g.lineTo(96, h - 22); g.lineTo(0, h - 22); g.fill();
    g.fillStyle = '#d0342c'; g.beginPath(); g.moveTo(160, 0); g.lineTo(186, 0); g.lineTo(132, h - 22); g.lineTo(106, h - 22); g.fill();
    g.strokeStyle = '#121316'; g.lineWidth = 12; g.beginPath(); g.arc(62, 66, 34, 0, TAU); g.stroke(); g.lineWidth = 6; g.strokeStyle = '#121316'; g.beginPath(); g.arc(62, 66, 16, 0, TAU); g.stroke();
    for (let i = 0; i < 64; i++) { g.fillStyle = (i + ((i / 32) | 0)) % 2 ? '#f2f3f5' : '#121316'; g.fillRect((i % 32) * 20, h - 22 + ((i / 32) | 0) * 11, 20, 11); }
    g.fillStyle = '#f2f3f5'; g.textBaseline = 'middle'; g.textAlign = 'center'; fitFont(g, '阿輝改車廠', 420, 96); g.shadowColor = '#FF6A1F'; g.shadowOffsetX = 5; g.shadowOffsetY = 5; g.fillText('阿輝改車廠', 408, 62); g.shadowColor = 'transparent';
    g.fillStyle = '#FF6A1F'; g.font = `700 30px ${COND}`; g.textAlign = 'right'; g.fillText('TUNING · 引擎 · 輪胎', w - 14, 124);
  });
  const VS = VSIGN_TEXT.map((t, i) => [t, ...VSIGN_COL[i]]);
  VS.forEach(([t, bg, fg], i) => reg('v' + i, 640 + i * 48, 0, 48, 160, (g, w, h) => { // 直立招牌（字從上往下）
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; const n = t.length, s = Math.min(38, (h - 20) / n); g.font = `700 ${s}px ${SANS}`;
    [...t].forEach((ch, k) => g.fillText(ch, w / 2, 10 + s * (k + 0.5) + (h - 20 - s * n) / 2));
  }));
  reg('arch', 0, 160, 1024, 96, (g, w, h) => { // 賽道入口的拱門：正面
    g.fillStyle = '#121316'; g.fillRect(0, 0, w, h);
    for (const x0 of [0, w - 132]) for (let i = 0; i < 11; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2 === 0) { g.fillStyle = '#f2f3f5'; g.fillRect(x0 + i * 12, j * 12, 12, 12); }
    g.fillStyle = '#FF6A1F'; g.fillRect(132, 0, w - 264, 6); g.fillRect(132, h - 6, w - 264, 6);
    g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillStyle = '#FF6A1F'; g.font = `700 70px ${SANS}`; g.fillText('賽道', 420, h / 2 + 2);
    g.fillStyle = '#f2f3f5'; g.font = `700 36px ${COND}`; g.textAlign = 'left'; g.fillText('400 M', 520, h / 2 + 2); g.font = `700 32px ${SANS}`; g.fillText('直線加速', 610, h / 2 + 2);
    iconGlyph(g, 'flag', 300, h / 2 + 2, 30, '#f2f3f5');
  });
  reg('archB', 0, 256, 384, 96, (g, w, h) => { g.fillStyle = '#121316'; g.fillRect(0, 0, w, h); g.fillStyle = '#FF6A1F'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6); iconGlyph(g, 'house', 80, h / 2, 28, '#FF6A1F'); g.fillStyle = '#f2f3f5'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = `700 58px ${SANS}`; g.fillText('回村子', 130, h / 2 + 2); });
  reg('temple', 384, 256, 256, 96, (g, w, h) => { g.fillStyle = '#1c2c4c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8c25a'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10); g.fillStyle = '#f0cd62'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = `700 60px ${SANS}`; g.fillText('福德宮', w / 2, h / 2 + 3); });
  reg('slow', 640, 256, 96, 96, (g, w, h) => { g.fillStyle = '#d0342c'; g.beginPath(); g.moveTo(4, 6); g.lineTo(w - 4, 6); g.lineTo(w / 2, h - 4); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(17, 14); g.lineTo(w - 17, 14); g.lineTo(w / 2, h - 20); g.fill(); g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 34px ${SANS}`; g.fillText('慢', w / 2, 38); });
  reg('limit', 736, 256, 96, 96, (g, w, h) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(48, 48, 44, 0, TAU); g.fill(); g.strokeStyle = '#d0342c'; g.lineWidth = 11; g.beginPath(); g.arc(48, 48, 38, 0, TAU); g.stroke(); g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 40px ${COND}`; g.fillText('30', 48, 50); });
  reg('mirror', 832, 256, 96, 96, (g, w, h) => { // 路口的反光鏡
    g.fillStyle = '#ff7a1a'; g.beginPath(); g.arc(48, 48, 46, 0, TAU); g.fill();
    const gr = g.createRadialGradient(38, 36, 4, 48, 48, 40); gr.addColorStop(0, '#f4f9ff'); gr.addColorStop(0.35, '#9fb8cc'); gr.addColorStop(0.75, '#5d7385'); gr.addColorStop(1, '#3c4a57');
    g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 38, 0, TAU); g.fill();
  });
  ['改裝', '輪胎', '烤漆'].forEach((t, i) => reg('flag' + i, i * 64, 352, 64, 256, (g, w, h) => { // 旗幟
    g.fillStyle = ['#FF6A1F', '#d0342c', '#2f6fd6'][i]; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(0, 0, 9, h);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 44px ${SANS}`; [...t].forEach((ch, k) => g.fillText(ch, w / 2 + 4, 60 + k * 64));
  }));
  // 路標：五個地方 × 三種箭頭（一列 256×48，一面路標疊好幾列）；前三個在上面，車店、快速道路在最下面
  const DEST = { track: ['賽道', '#FF6A1F', '#1A0F07', 'flag'], shop: ['改車廠', '#2F6FD6', '#FFFFFF', 'wrench'], garage: ['車庫', '#1d1f23', '#FF6A1F', 'house'], dealer: ['車店', '#C8281E', '#FFFFFF', 'car'], highway: ['快速道路', HG, '#FFFFFF', 'road'] };
  Object.entries(DEST).forEach(([k, [name, bg, fg, icon]], di) => ['L', 'U', 'R'].forEach((a, ai) => reg(`g_${k}_${a}`, di < 3 ? 192 + ai * 256 : ai * 256, di < 3 ? 352 + di * 48 : 896 + (di - 3) * 48, 256, 48, (g, w, h) => {
    g.fillStyle = '#e9ecef'; g.fillRect(0, 0, w, h); g.fillStyle = bg; rrect(g, 3, 3, w - 6, h - 6, 9); g.fill();
    iconGlyph(g, icon, 28, h / 2, 15, fg, bg); g.fillStyle = fg; g.textAlign = 'left'; g.textBaseline = 'middle'; fitFont(g, name, 130, 34); g.fillText(name, 52, h / 2 + 2);
    arrowGlyph(g, a === 'L' ? 206 : 214, h / 2, 17, a, fg);
  })));
  // ==== 第 3 批：警察局、槍店的路標列（x 512…1024、y 736…880）====
  Object.entries({ police: ['警察局', '#1F4FA8', '#FFFFFF', 'police'], gunshop: ['槍店', '#26282C', '#FF9A2E', 'gun'] }).forEach(([k, [name, bg, fg, icon]], di) => ['L', 'U', 'R'].forEach((a, ai) => reg(`g_${k}_${a}`, 512 + di * 256, 736 + ai * 48, 256, 48, (g, w, h) => {
    g.fillStyle = '#e9ecef'; g.fillRect(0, 0, w, h); g.fillStyle = bg; rrect(g, 3, 3, w - 6, h - 6, 9); g.fill();
    iconGlyph(g, icon, 28, h / 2, 15, fg, bg); g.fillStyle = fg; g.textAlign = 'left'; g.textBaseline = 'middle'; fitFont(g, name, 130, 34); g.fillText(name, 52, h / 2 + 2);
    arrowGlyph(g, a === 'L' ? 206 : 214, h / 2, 17, a, fg);
  })));
  // ==== 第 3 批 end ====
  SHOP_NAMES.map((t, i) => [t, ...VSIGN_COL[i]]).forEach(([t, bg, fg], i) => reg('h' + i, 192 + i * 256, 496, 256, 48, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, t, w - 20, 36); g.fillText(t, w / 2, h / 2 + 2);
  }));
  reg('bill', 192, 544, 512, 192, (g, w, h) => { // 看板：週末直線加速賽
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#16181c'); gr.addColorStop(1, '#2b1b12'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#FF6A1F'; g.beginPath(); g.moveTo(0, h * 0.62); g.lineTo(w, h * 0.42); g.lineTo(w, h * 0.5); g.lineTo(0, h * 0.7); g.fill();
    g.fillStyle = '#ff7414'; g.beginPath(); g.moveTo(40, 150); g.lineTo(60, 120); g.lineTo(120, 108); g.lineTo(170, 92); g.lineTo(250, 92); g.lineTo(300, 110); g.lineTo(330, 118); g.lineTo(336, 150); g.closePath(); g.fill();
    g.fillStyle = '#1b2733'; g.beginPath(); g.moveTo(140, 104); g.lineTo(178, 96); g.lineTo(240, 96); g.lineTo(276, 110); g.closePath(); g.fill();
    g.fillStyle = '#111'; for (const x of [96, 282]) { g.beginPath(); g.arc(x, 150, 22, 0, TAU); g.fill(); g.fillStyle = '#c9ccd0'; g.beginPath(); g.arc(x, 150, 11, 0, TAU); g.fill(); g.fillStyle = '#111'; }
    g.fillStyle = '#f2f3f5'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = `700 52px ${SANS}`; g.fillText('直線加速賽', 20, 64);
    g.fillStyle = '#FF6A1F'; g.font = `700 40px ${COND}`; g.fillText('400 M', 360, 150); g.fillStyle = '#f2f3f5'; g.font = `700 28px ${SANS}`; g.fillText('就在前面', 360, 184);
  });
  reg('mural', 0, 736, 512, 160, (g, w, h) => { // 改車廠側牆的大字
    g.fillStyle = '#e9ecef'; g.fillRect(0, 0, w, h); g.fillStyle = '#FF6A1F'; g.fillRect(0, h - 26, w, 26);
    g.strokeStyle = '#16181c'; g.lineWidth = 22; g.beginPath(); g.arc(80, 70, 46, 0, TAU); g.stroke(); g.lineWidth = 6; g.strokeStyle = '#9aa1ac'; g.beginPath(); g.arc(80, 70, 22, 0, TAU); g.stroke();
    g.fillStyle = '#16181c'; g.textAlign = 'left'; g.textBaseline = 'middle'; fitFont(g, '輪胎 · 改裝 · 烤漆', w - 170, 60); g.fillText('輪胎 · 改裝 · 烤漆', 150, 72);
  });
  return S;
}

// 自己會亮的（霓虹招牌、店裡的燈、展示間）：MeshBasicMaterial
function glowAtlas(R) {
  const S = sheet(1024, 1024), reg = S.reg;
  reg('neon', 0, 0, 1024, 128, (g, w, h) => { // 「大便龍的車庫」橘色霓虹（車庫模組要用可以拿去；村子這邊沒有用到）
    g.fillStyle = '#141519'; g.fillRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 88px ${SANS}`;
    g.strokeStyle = '#ff6a1f'; g.lineJoin = 'round'; g.shadowColor = '#ff6a1f';
    for (const [lw, b] of [[12, 28], [7, 14]]) { g.lineWidth = lw; g.shadowBlur = b; g.strokeText('大便龍的車庫', w / 2, h / 2 + 4); }
    g.shadowBlur = 6; g.lineWidth = 2.5; g.strokeStyle = '#ffe2cc'; g.strokeText('大便龍的車庫', w / 2, h / 2 + 4);
    g.shadowBlur = 16; g.strokeStyle = '#ff6a1f'; g.lineWidth = 4; rrect(g, 14, 12, w - 28, h - 24, 18); g.stroke();
  });
  reg('gglass', 0, 128, 384, 256, (g, w, h) => { // 車庫大玻璃門：裡面的六角形燈、炭灰牆、橘色燈條、亮亮的地板（假車庫殼用）
    g.fillStyle = '#16171b'; g.fillRect(0, 0, w, h);
    const hz = h * 0.5, bx0 = w * 0.18, bx1 = w * 0.82;
    g.fillStyle = '#1f2125'; g.beginPath(); g.moveTo(0, 0); g.lineTo(bx0, h * 0.2); g.lineTo(bx0, hz + h * 0.14); g.lineTo(0, h); g.fill();
    g.beginPath(); g.moveTo(w, 0); g.lineTo(bx1, h * 0.2); g.lineTo(bx1, hz + h * 0.14); g.lineTo(w, h); g.fill();
    g.fillStyle = '#2a2c31'; g.fillRect(bx0, h * 0.2, bx1 - bx0, hz - h * 0.06);
    g.save(); g.strokeStyle = '#f2f8ff'; g.shadowColor = '#cfe6ff'; g.shadowBlur = 10; // 天花板六角燈（越遠越小）
    for (let r = 0; r < 4; r++) { const y = 10 + r * 13, s = 17 - r * 3.2, dx = s * 1.9; g.lineWidth = 3 - r * 0.5; for (let x = w / 2 - dx * 6 + (r % 2) * dx / 2; x < w; x += dx) { g.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; g.lineTo(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.32); } g.closePath(); g.stroke(); } }
    g.restore();
    g.fillStyle = '#ff6a1f'; g.shadowColor = '#ff6a1f'; g.shadowBlur = 12; g.fillRect(bx0, hz + h * 0.08, bx1 - bx0, 4); g.fillRect(bx0 + 6, h * 0.24, 3, hz - h * 0.12); g.fillRect(bx1 - 9, h * 0.24, 3, hz - h * 0.12); g.shadowBlur = 0;
    g.fillStyle = '#3b2415'; g.fillRect(bx0 + 20, hz - 6, 56, 44); g.fillStyle = '#ff6a1f'; for (let y = hz; y < hz + 36; y += 10) g.fillRect(bx0 + 24, y, 48, 2); // 工具車
    const fl = g.createLinearGradient(0, hz + h * 0.14, 0, h); fl.addColorStop(0, '#34363c'); fl.addColorStop(1, '#101114'); g.fillStyle = fl; g.fillRect(0, hz + h * 0.14, w, h);
    g.globalAlpha = 0.35; g.strokeStyle = '#dbeaff'; g.lineWidth = 2; for (let x = 40; x < w; x += 46) { g.beginPath(); g.moveTo(x, hz + h * 0.2); g.lineTo(x + (x - w / 2) * 0.3, h); g.stroke(); } g.globalAlpha = 1;
    g.strokeStyle = '#ff6a1f'; g.lineWidth = 3; g.strokeRect(w * 0.32, h * 0.76, w * 0.36, h * 0.2);
    g.fillStyle = '#0b0c0e'; for (const x of [0, w / 3, (2 * w) / 3, w]) g.fillRect(x - 3, 0, 6, h); g.fillRect(0, 0, w, 5); // 玻璃的框
  });
  reg('store', 384, 128, 256, 128, (g, w, h) => { // 超商：亮亮的店裡、貨架、櫃台、自動門
    g.fillStyle = '#f4f7f8'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; for (let x = 20; x < w; x += 60) g.fillRect(x, 6, 40, 5);
    const cs = ['#e0453a', '#f2c230', '#3b8fd9', '#43b36b', '#f07aa8', '#ff8a2a', '#8a5cd6'];
    for (const x0 of [16, 150]) for (const y of [48, 70, 92]) { g.fillStyle = '#c9ced3'; g.fillRect(x0, y, 88, 3); for (let x = x0 + 2; x < x0 + 86; x += 6) { g.fillStyle = pick(R, cs); const hh = 7 + R() * 10; g.fillRect(x, y - hh, 4.5, hh); } }
    g.fillStyle = '#12a39a'; g.fillRect(104, 60, 44, 40); g.fillStyle = '#dfe4e8'; g.fillRect(0, h - 14, w, 14);
    g.fillStyle = 'rgba(80,120,140,0.18)'; g.fillRect(0, 0, w, h); g.fillStyle = '#6d757d'; for (const x of [0, 104, 150, w]) g.fillRect(x - 3, 0, 6, h); g.fillRect(0, 0, w, 5);
    g.fillStyle = '#ff5a4a'; g.fillRect(20, 16, 50, 26); g.fillStyle = '#ffcf33'; g.fillRect(186, 16, 50, 26);
  });
  reg('storeSign', 384, 256, 256, 64, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#12a39a'; g.textAlign = 'left'; g.textBaseline = 'middle'; fitFont(g, '村口超商', 160, 42); g.fillText('村口超商', 14, h / 2 + 2); g.fillStyle = '#ff5a4a'; rrect(g, 182, 12, 62, 40, 8); g.fill(); g.fillStyle = '#fff'; g.font = `700 30px ${COND}`; g.textAlign = 'center'; g.fillText('24H', 213, h / 2 + 2); });
  reg('work', 640, 128, 256, 128, (g, w, h) => { // （舊的）改車廠門裡面的樣子：舉升機、工具牆、日光燈
    g.fillStyle = '#2b2d31'; g.fillRect(0, 0, w, h); g.fillStyle = '#8e969e'; for (let y = 0; y < 14; y += 4) g.fillRect(0, y, w, 2);
    g.fillStyle = '#f5fbff'; g.shadowColor = '#e8f4ff'; g.shadowBlur = 8; for (const x of [40, 110, 180]) g.fillRect(x, 20, 46, 4); g.shadowBlur = 0;
    g.fillStyle = '#3b4148'; g.fillRect(20, 30, 90, 44); g.fillStyle = '#c9ccd0'; for (let i = 0; i < 26; i++) g.fillRect(24 + R() * 80, 34 + R() * 36, 3, 8 + R() * 6);
    g.fillStyle = '#f2c230'; g.fillRect(130, 34, 8, h - 50); g.fillRect(228, 34, 8, h - 50); g.fillStyle = '#e04a3c'; rrect(g, 126, 50, 116, 30, 12); g.fill();
    g.fillStyle = '#1a1b1e'; g.fillRect(150, 44, 64, 10); for (const x of [146, 222]) { g.beginPath(); g.arc(x, 82, 11, 0, TAU); g.fill(); }
    const fl = g.createLinearGradient(0, h - 26, 0, h); fl.addColorStop(0, '#5d6a64'); fl.addColorStop(1, '#3c4541'); g.fillStyle = fl; g.fillRect(0, h - 26, w, 26); g.fillStyle = '#f2c230'; g.fillRect(0, h - 22, w, 2);
  });
  reg('halo', 640, 256, 128, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,120,40,0.9)'); gr.addColorStop(0.5, 'rgba(255,100,30,0.25)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  reg('warm', 896, 128, 32, 32, (g, w, h) => { g.fillStyle = '#fff1d6'; g.fillRect(0, 0, w, h); });
  reg('led', 928, 128, 32, 32, (g, w, h) => { g.fillStyle = '#ff7a2e'; g.fillRect(0, 0, w, h); });
  reg('red', 960, 128, 32, 32, (g, w, h) => { g.fillStyle = '#ff3b2a'; g.fillRect(0, 0, w, h); });
  reg('white', 992, 128, 32, 32, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); });
  reg('cool', 896, 160, 32, 32, (g, w, h) => { g.fillStyle = '#eef6ff'; g.fillRect(0, 0, w, h); }); // 日光燈、LED
  reg('amber', 928, 160, 32, 32, (g, w, h) => { g.fillStyle = '#ffd9a0'; g.fillRect(0, 0, w, h); }); // 快速道路的路燈
  reg('blue', 960, 160, 32, 32, (g, w, h) => { g.fillStyle = '#5ab4ff'; g.fillRect(0, 0, w, h); });
  reg('green', 992, 160, 32, 32, (g, w, h) => { g.fillStyle = '#3fdc8a'; g.fillRect(0, 0, w, h); });
  // ---- 車行、改車廠裡面 ----
  reg('dealer', 0, 512, 768, 144, (g, w, h) => { // 車行正面的燈箱：阿財車行＋新車
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#dc3a2e'); gr.addColorStop(1, '#a81e17'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, h - 12, w, 4);
    iconGlyph(g, 'car', 92, h / 2 - 4, 58, '#ffffff', '#c8281e');
    g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.textBaseline = 'middle'; fitFont(g, '阿財車行', 360, 100); g.fillText('阿財車行', 176, h / 2 - 2);
    g.fillStyle = '#ffffff'; rrect(g, w - 214, 22, 192, h - 44, 14); g.fill(); g.fillStyle = '#c8281e'; g.textAlign = 'center'; fitFont(g, '新車', 150, 80); g.fillText('新車', w - 118, h / 2 + 2);
  });
  reg('pylon', 768, 512, 112, 448, (g, w, h) => { // 路邊的直立燈箱：上面紅底「阿財車行」、下面白底「新車」
    g.fillStyle = '#c8281e'; g.fillRect(0, 0, w, 300); vText(g, '阿財車行', w / 2, 44, 70, 60, '#ffffff');
    g.fillStyle = '#ffffff'; g.fillRect(0, 300, w, 148); vText(g, '新車', w / 2, 340, 70, 58, '#c8281e');
    g.strokeStyle = '#8a1510'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  });
  reg('buy', 0, 656, 448, 112, (g, w, h) => { // 車棚的招牌：買車區、停這裡
    g.fillStyle = '#16181c'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8281e'; g.fillRect(0, 0, 112, h); iconGlyph(g, 'car', 56, h / 2 + 4, 36, '#ffffff', '#c8281e');
    g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.textBaseline = 'middle'; fitFont(g, '買車區', 190, 66); g.fillText('買車區', 128, h / 2 + 2);
    g.fillStyle = '#ffcf33'; fitFont(g, '停這裡', 88, 30); g.fillText('停這裡', 330, h / 2 - 16); arrowGlyph(g, 374, h / 2 + 24, 16, 'D', '#ffcf33');
  });
  reg('shopHdr', 448, 656, 320, 88, (g, w, h) => { // 改車廠裡面（後門上面）的燈箱
    g.fillStyle = '#141519'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ff6a1f'; g.lineWidth = 4; rrect(g, 4, 4, w - 8, h - 8, 10); g.stroke();
    iconGlyph(g, 'wrench', 44, h / 2, 22, '#ff6a1f'); g.fillStyle = '#ffe2cc'; g.shadowColor = '#ff6a1f'; g.shadowBlur = 10; g.textAlign = 'left'; g.textBaseline = 'middle'; fitFont(g, '阿輝改車廠', 222, 52); g.fillText('阿輝改車廠', 80, h / 2 + 2); g.shadowBlur = 0;
  });
  reg('welcome', 0, 768, 256, 48, (g, w, h) => { // 紅色跑馬燈：歡迎光臨
    g.fillStyle = '#0c0c0e'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff3b2a'; g.shadowColor = '#ff3b2a'; g.shadowBlur = 6; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, '歡迎光臨', 220, 38); g.fillText('歡迎光臨', w / 2, h / 2 + 2); g.shadowBlur = 0;
    g.fillStyle = 'rgba(0,0,0,0.45)'; for (let x = 0; x < w; x += 3) g.fillRect(x, 0, 1, h); for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  });
  reg('tv', 256, 768, 160, 96, (g, w, h) => { // 展示間的電視：新車廣告
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1d4f8a'); gr.addColorStop(1, '#0d1b33'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, h * 0.7, w, 3); iconGlyph(g, 'car', 56, h * 0.56, 40, '#e8eef6', '#1d4f8a');
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#ffcf33'; g.font = `700 24px ${SANS}`; g.fillText('新車', 104, 30); g.fillStyle = '#ffffff'; g.font = `700 18px ${SANS}`; g.fillText('試乘', 106, 58);
    g.fillStyle = '#0a0a0c'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4); g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h);
  });
  reg('dlight', 416, 768, 64, 64, (g, w, h) => { g.fillStyle = '#b9bdc2'; g.fillRect(0, 0, w, h); const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.6); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e6eef8'); g.fillStyle = gr; g.fillRect(4, 4, w - 8, h - 8); }); // 天花板的方形燈
  reg('exitG', 480, 768, 96, 48, (g, w, h) => { g.fillStyle = '#128a4a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.textBaseline = 'middle'; fitFont(g, '出口', 52, 30); g.fillText('出口', 8, h / 2 + 1); arrowGlyph(g, 76, h / 2, 13, 'U', '#ffffff'); }); // 綠色「出口」燈
  return S;
}

// 地上的字、斑馬線、輪胎印（透明）
function decalAtlas(R) {
  const S = sheet(512, 512), reg = S.reg;
  reg('slow', 0, 0, 128, 256, (g, w, h) => { g.fillStyle = '#f2f3f5'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.translate(w / 2, h / 2); g.scale(1, 2.2); g.font = `700 104px ${SANS}`; g.fillText('慢', 0, 4); g.restore(); });
  reg('zebra', 128, 0, 128, 128, (g, w, h) => { g.fillStyle = 'rgba(242,243,245,0.95)'; for (let x = 4; x < w; x += 21) g.fillRect(x, 2, 12, h - 4); });
  reg('zone', 256, 0, 256, 128, (g, w, h) => { // 改車區（黃色虛線框）
    g.strokeStyle = '#ffcf33'; g.lineWidth = 7; g.setLineDash([18, 10]); g.strokeRect(6, 6, w - 12, h - 12); g.setLineDash([]);
    g.fillStyle = '#ffcf33'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 46px ${SANS}`; g.fillText('改車區', w / 2 + 16, h / 2 + 2); iconGlyph(g, 'wrench', 58, h / 2 + 2, 22, '#ffcf33');
  });
  reg('skid', 128, 128, 128, 128, (g, w, h) => { g.lineCap = 'round'; for (let i = 0; i < 4; i++) { g.strokeStyle = `rgba(10,10,12,${0.35 + R() * 0.3})`; g.lineWidth = 7 + R() * 4; g.beginPath(); const x = 20 + i * 26 + R() * 8; g.moveTo(x, h); g.bezierCurveTo(x + 10, h * 0.6, x - 12, h * 0.35, x + 6 + R() * 10, 0); g.stroke(); } });
  reg('oil', 0, 256, 128, 128, (g, w, h) => { for (let i = 0; i < 7; i++) { const gr = g.createRadialGradient(0, 0, 1, 0, 0, 30); gr.addColorStop(0, 'rgba(20,18,16,0.55)'); gr.addColorStop(1, 'rgba(20,18,16,0)'); g.save(); g.translate(20 + R() * 88, 20 + R() * 88); g.scale(1, 0.4 + R() * 0.6); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill(); g.restore(); } });
  reg('rice', 256, 128, 256, 128, (g, w, h) => { // 廟埕曬穀
    g.fillStyle = 'rgba(214,170,64,0.97)'; rrect(g, 6, 6, w - 12, h - 12, 18); g.fill(); g.strokeStyle = 'rgba(160,118,30,0.8)'; g.lineWidth = 3;
    for (let y = 16; y < h - 10; y += 9) { g.beginPath(); g.moveTo(12, y); for (let x = 12; x < w - 12; x += 16) g.lineTo(x + 8, y + (x % 32 ? 2 : -2)); g.stroke(); }
    speck(g, R, w, h, 300, 'rgba(250,215,120,0.5)');
  });
  reg('park', 256, 256, 256, 128, (g, w, h) => { g.fillStyle = 'rgba(242,243,245,0.92)'; g.fillRect(4, 4, w - 8, 6); for (const x of [4, 86, 168, w - 10]) g.fillRect(x, 4, 6, h - 8); });
  reg('manhole', 128, 256, 64, 64, (g, w, h) => { g.fillStyle = 'rgba(40,42,46,0.9)'; g.beginPath(); g.arc(32, 32, 29, 0, TAU); g.fill(); g.strokeStyle = 'rgba(120,122,126,0.8)'; g.lineWidth = 2; for (const r of [24, 16, 8]) { g.beginPath(); g.arc(32, 32, r, 0, TAU); g.stroke(); } });
  reg('start', 192, 256, 64, 64, (g, w, h) => { g.fillStyle = 'rgba(242,243,245,0.95)'; g.fillRect(0, 0, w, h); });
  reg('buyzone', 0, 384, 256, 128, (g, w, h) => { // 買車區（白色虛線框）
    g.strokeStyle = '#f2f3f5'; g.lineWidth = 7; g.setLineDash([18, 10]); g.strokeRect(6, 6, w - 12, h - 12); g.setLineDash([]);
    g.fillStyle = '#f2f3f5'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 46px ${SANS}`; g.fillText('買車區', w / 2 + 18, h / 2 + 2); iconGlyph(g, 'car', 52, h / 2 + 4, 24, '#f2f3f5', null);
  });
  reg('arrLR', 256, 384, 64, 128, (g, w, h) => { g.save(); g.scale(1, 2); turnGlyph(g, w / 2 + 6, h / 4 + 6, 22, true, '#f2f3f5'); turnGlyph(g, w / 2 - 6, h / 4 + 6, 22, false, '#f2f3f5'); g.restore(); }); // 路面箭頭：左轉、右轉（長長的）
  reg('arrU', 320, 384, 64, 128, (g, w, h) => { g.save(); g.scale(1, 2); arrowGlyph(g, w / 2, h / 4, 26, 'U', '#f2f3f5'); g.restore(); }); // 路面箭頭：直走
  return S;
}

// 快速道路、車行的牌子（綠底白字的指示牌、看板、旗子⋯）：跟 signAtlas 一樣的材質，自己排位置（先放高的）
function sign2Atlas(R) {
  const S = sheet(1024, 1024), P = S.pack;
  const hw = (g, w, h, r = 12) => { g.fillStyle = '#f2f3f5'; rrect(g, 0, 0, w, h, r); g.fill(); g.fillStyle = HG; rrect(g, 5, 5, w - 10, h - 10, r - 4); g.fill(); }; // 綠底白邊
  const T = (g, t, x, y, px, col = '#ffffff', al = 'left', max = 999, fam = SANS) => { g.fillStyle = col; g.textAlign = al; g.textBaseline = 'middle'; fitFont(g, t, max, px, 700, fam); g.fillText(t, x, y); };
  const tag = (g, x, y, w, h, t) => { g.fillStyle = '#ffcf33'; rrect(g, x, y, w, h, 8); g.fill(); T(g, t, x + w / 2, y + h / 2 + 1, h * 0.72, '#16181c', 'center', w - 10); }; // 黃底黑字的小牌（出口）
  P('entry', 448, 208, (g, w, h) => { // 大路開到快速道路的路口：快速道路（左轉往南、右轉往北）
    hw(g, w, h); iconGlyph(g, 'road', 54, 56, 30, '#ffffff', HG); T(g, '快速道路', 98, 58, 66, '#ffffff', 'left', 310);
    g.fillStyle = '#ffffff'; g.fillRect(18, 104, w - 36, 3);
    turnGlyph(g, 52, 156, 30, false, '#ffffff'); T(g, '往南', 88, 158, 40); turnGlyph(g, w - 52, 156, 30, true, '#ffffff'); T(g, '往北', w - 88, 158, 40, '#ffffff', 'right');
    T(g, `一圈 ${(HWY_LEN / 1000).toFixed(1)} km`, w / 2, 158, 26, '#cfe8d8', 'center', 130); // 照 HWY_PLAN 算（2.5 km）
  });
  const gantry = (name, dir) => P(name, 448, 192, (g, w, h) => { // 門架上的大牌子：前面 300 公尺出口（往村子）
    hw(g, w, h); tag(g, 18, 16, 112, 44, '出口'); T(g, '300 m', w - 22, 39, 38, '#ffffff', 'right', 150, COND);
    T(g, '村子', 24, 104, 68, '#ffffff', 'left', 180); T(g, '車店 · 改車廠 · 賽道', 24, 160, 34, '#ffffff', 'left', 318);
    arrowGlyph(g, w - 62, 128, 40, dir, '#ffffff');
  });
  P('fl0', 48, 192, (g, w, h) => { g.fillStyle = '#c8281e'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 6, h); vText(g, '新車到', w / 2 + 3, 36, 56, 38, '#ffffff'); }); // 車行門口的旗子
  P('fl1', 48, 192, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8281e'; g.fillRect(0, 0, 6, h); vText(g, '可試乘', w / 2 + 3, 36, 56, 38, '#c8281e'); });
  gantry('gantryN', 'UR'); gantry('gantryS', 'UL');
  P('fl2', 48, 192, (g, w, h) => { g.fillStyle = '#ffcf33'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8281e'; g.fillRect(0, 0, 6, h); vText(g, '零利率', w / 2 + 3, 36, 56, 38, '#c8281e'); });
  P('ad1', 448, 192, (g, w, h) => { // 看板：阿財車行
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#d0342c'); gr.addColorStop(1, '#8a1510'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    T(g, '阿財車行', 24, 54, 64, '#ffffff', 'left', 270); T(g, '新車 · 好開 · 好停', 24, 112, 32, '#ffe1dc', 'left', 260);
    g.fillStyle = '#ffffff'; rrect(g, 24, 140, 196, 38, 8); g.fill(); T(g, '下一個出口', 122, 160, 26, '#c8281e', 'center', 176);
    iconGlyph(g, 'car', 352, 104, 72, '#ffffff', '#a01c15');
  });
  P('ad2', 448, 192, (g, w, h) => { // 看板：阿輝改車廠
    g.fillStyle = '#16181c'; g.fillRect(0, 0, w, h); g.fillStyle = '#FF6A1F'; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.8); g.lineTo(w, h * 0.56); g.lineTo(w, h * 0.68); g.lineTo(w * 0.35, h); g.closePath(); g.fill();
    T(g, '阿輝改車廠', 24, 56, 60, '#ffffff', 'left', 300); T(g, '引擎 · 渦輪 · 輪胎 · 烤漆', 24, 112, 30, '#FF6A1F', 'left', 330);
    iconGlyph(g, 'wrench', 396, 64, 40, '#FF6A1F');
  });
  P('ad3', 448, 192, (g, w, h) => { // 看板：直線加速賽
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1b2733'); gr.addColorStop(1, '#0f151c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 22; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#f2f3f5' : '#16181c'; g.fillRect(i * 21, h - 28 + j * 14, 21, 14); }
    T(g, '直線加速賽', 24, 58, 62, '#ffffff', 'left', 320); T(g, '每個週末 · 400 M', 24, 116, 32, '#FF6A1F', 'left', 300);
    iconGlyph(g, 'flag', 392, 70, 42, '#ffffff');
  });
  const exitS = (name, right) => P(name, 320, 160, (g, w, h) => { // 路口前的出口牌（箭頭往出口那邊）
    hw(g, w, h); tag(g, right ? 16 : w - 124, 14, 108, 42, '出口');
    T(g, '村子 · 車店', right ? 20 : w - 20, 104, 44, '#ffffff', right ? 'left' : 'right', 196); arrowGlyph(g, right ? w - 50 : 50, 100, 34, right ? 'R' : 'L', '#ffffff');
  });
  exitS('exitR', true); exitS('exitL', false);
  P('post1', 192, 128, (g, w, h) => { hw(g, w, h, 10); T(g, '保持', w / 2, 40, 44, '#ffffff', 'center'); T(g, '車距', w / 2, 90, 44, '#ffffff', 'center'); }); // 路邊的小牌
  P('post2', 192, 128, (g, w, h) => { g.fillStyle = '#f2f3f5'; rrect(g, 0, 0, w, h, 10); g.fill(); g.fillStyle = '#1f5fae'; rrect(g, 5, 5, w - 10, h - 10, 6); g.fill(); T(g, '勿行駛', w / 2, 40, 40, '#ffffff', 'center'); T(g, '路肩', w / 2, 90, 40, '#ffffff', 'center'); });
  P('dist', 320, 112, (g, w, h) => { hw(g, w, h, 10); T(g, '村子出口', 22, 36, 36, '#ffffff', 'left', 190); T(g, '500 m', w - 22, 36, 34, '#ffffff', 'right', 110, COND); T(g, '賽道', 22, 80, 32); T(g, '1 km', w - 22, 80, 32, '#ffffff', 'right', 110, COND); }); // 距離牌
  P('lim110', 96, 96, (g, w, h) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(48, 48, 44, 0, TAU); g.fill(); g.strokeStyle = '#d0342c'; g.lineWidth = 10; g.beginPath(); g.arc(48, 48, 38, 0, TAU); g.stroke(); T(g, '110', 48, 50, 36, '#111111', 'center', 58, COND); });
  P('stop', 96, 96, (g, w, h) => { // 停（紅色八角形）
    const oct = (r) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = ((i + 0.5) / 8) * TAU; g.lineTo(48 + Math.cos(a) * r, 48 + Math.sin(a) * r); } g.closePath(); g.fill(); };
    g.fillStyle = '#ffffff'; oct(46); g.fillStyle = '#d0342c'; oct(41); T(g, '停', 48, 50, 46, '#ffffff', 'center');
  });
  P('chev', 64, 96, (g, w, h) => { g.fillStyle = '#ffcf33'; g.fillRect(0, 0, w, h); g.fillStyle = '#16181c'; g.beginPath(); g.moveTo(12, 14); g.lineTo(32, 14); g.lineTo(52, 48); g.lineTo(32, 82); g.lineTo(12, 82); g.lineTo(32, 48); g.closePath(); g.fill(); g.strokeStyle = '#16181c'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3); }); // 彎道的箭頭牌（往右）
  P('white', 32, 32, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); });
  P('warn', 256, 64, (g, w, h) => { g.fillStyle = '#ffcf33'; g.fillRect(0, 0, w, h); g.strokeStyle = '#16181c'; g.lineWidth = 5; g.strokeRect(4, 4, w - 8, h - 8); T(g, '前有路口 · 減速', w / 2, h / 2 + 2, 34, '#16181c', 'center', 228); }); // 快速道路路口前的警告
  P('in', 96, 48, (g, w, h) => { g.fillStyle = '#1e7b45'; g.fillRect(0, 0, w, h); T(g, '入口', 34, h / 2 + 1, 28, '#ffffff', 'center'); arrowGlyph(g, 76, h / 2, 13, 'U', '#ffffff'); }); // 車行的入口、出口
  P('out', 96, 48, (g, w, h) => { g.fillStyle = '#c8281e'; g.fillRect(0, 0, w, h); T(g, '出口', 34, h / 2 + 1, 28, '#ffffff', 'center'); arrowGlyph(g, 76, h / 2, 13, 'U', '#ffffff'); });
  return S;
}

// 路面：大路（白邊線＋雙黃線）、村子的路（紅線＋白虛線）、水泥農路；v 方向一格 10 公尺
function roadTex(R) {
  const [c, g] = cv(512, 512), P = 512 / 10;
  g.fillStyle = '#3c3e42'; g.fillRect(0, 0, 400, 512);
  speck(g, R, 400, 512, 7000, () => { const k = 40 + R() * 60; return `rgba(${k},${k},${k + 4},0.5)`; }, 1.5);
  g.fillStyle = 'rgba(20,20,22,0.18)'; for (const x of [40, 72, 136, 168, 250, 276, 330, 356]) g.fillRect(x, 0, 16, 512); // 輪胎壓過的地方暗一點
  g.fillStyle = '#e9ebee'; g.fillRect(7, 0, 4, 512); g.fillRect(197, 0, 4, 512); // 大路：兩邊白線
  g.fillStyle = '#f2c230'; g.fillRect(98, 0, 4, 512); g.fillRect(106, 0, 4, 512); // 雙黃線
  g.fillStyle = '#c8322a'; g.fillRect(219, 0, 4, 512); g.fillRect(385, 0, 4, 512); // 村子的路：紅線
  g.fillStyle = '#e9ebee'; g.fillRect(302, 0, 4, P * 4); // 白虛線（4 公尺、空 6 公尺）
  g.fillStyle = '#bdbeb9'; g.fillRect(400, 0, 112, 512); speck(g, R, 112, 512, 1500, () => `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${0.05 + R() * 0.07})`, 2); // 水泥
  g.fillStyle = 'rgba(60,60,58,0.45)'; g.fillRect(400, 0, 112, 2); g.fillRect(400, 256, 112, 2);
  g.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 30; i++) g.fillRect(400 + R() * 112, R() * 512, 1, 20 + R() * 60);
  return c;
}
const RU = { main: [4 / 512, 204 / 512], street: [216 / 512, 392 / 512], farm: [404 / 512, 508 / 512] };
// 快速道路（一邊）：u 0 → 1＝中間護欄邊（0.3 公尺）→ 外側（11.9 公尺）：內路肩 1、黃線、兩線道（中間白虛線 4 公尺空 6 公尺）、白邊線、外路肩 3；v 一格 10 公尺
function hwyTex(R) {
  const [c, g] = cv(512, 512), k = 512 / 11.6, X = (o) => (o - 0.3) * k, P = 512 / 10;
  g.fillStyle = '#46484c'; g.fillRect(0, 0, 512, 512);
  speck(g, R, 512, 512, 9000, () => { const q = 42 + R() * 60; return `rgba(${q},${q},${q + 4},0.45)`; }, 1.5);
  g.fillStyle = 'rgba(255,255,255,0.035)'; g.fillRect(0, 0, X(1.3), 512); g.fillRect(X(8.8), 0, 512 - X(8.8), 512); // 路肩淺一點（比較少車壓）
  g.fillStyle = 'rgba(18,18,20,0.2)'; for (const o of [2.25, 4.1, 6.0, 7.85]) g.fillRect(X(o) - 13, 0, 26, 512); // 輪胎壓過的地方
  g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 6; i++) g.fillRect(X(1.4) + R() * (X(8.7) - X(1.4)), R() * 512, 2, 30 + R() * 90); // 補過的裂縫
  g.fillStyle = '#f2c230'; g.fillRect(X(1.22), 0, 0.15 * k, 512); // 內側黃線
  g.fillStyle = '#eceef0'; g.fillRect(X(4.97), 0, 0.15 * k, P * 4); // 車道線
  g.fillRect(X(8.73), 0, 0.15 * k, 512); // 外側白邊線
  return c;
}
function paveTex(R) { // 水泥地（4 公尺一格，頂點色上色：柏油、花崗石⋯）
  const [c, g] = cv(256, 256);
  g.fillStyle = '#dcdcd8'; g.fillRect(0, 0, 256, 256); speck(g, R, 256, 256, 2400, () => `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + R() * 0.07})`, 2);
  g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(0, 0, 256, 1.5); g.fillRect(0, 128, 256, 1); g.fillRect(0, 0, 1.5, 256); g.fillRect(128, 0, 1, 256);
  return c;
}
function paddyTex(R) { // 稻田：水面映天空、一排一排秧苗（3.2 公尺一格）
  const [c, g] = cv(256, 256);
  const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, '#9ab9bd'); gr.addColorStop(1, '#86a9ae'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 40; i++) g.fillRect(R() * 256, R() * 256, 10 + R() * 30, 1);
  const cs = ['#4f9a34', '#62ad3c', '#78bf45', '#3f8a2c'];
  for (let y = 8; y < 256; y += 24) for (let x = 6; x < 256; x += 20) {
    const cx = x + R() * 3, cy = y + R() * 3;
    g.fillStyle = 'rgba(40,70,40,0.35)'; g.beginPath(); g.ellipse(cx + 2, cy + 3, 7, 4, 0, 0, TAU); g.fill();
    for (let k = 0; k < 7; k++) { g.strokeStyle = pick(R, cs); g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); const a = R() * TAU; g.lineTo(cx + Math.cos(a) * (5 + R() * 5), cy + Math.sin(a) * (4 + R() * 4)); g.stroke(); }
  }
  return c;
}
function grassTex(R) { // 草地（6 公尺一格；跟賽道的草地差不多顏色）
  const [c, g] = cv(256, 256);
  g.fillStyle = '#809358'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) { const gr = g.createRadialGradient(0, 0, 1, 0, 0, 40); gr.addColorStop(0, `rgba(${R() < 0.5 ? '60,90,40' : '150,160,90'},0.18)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.translate(R() * 256, R() * 256); g.fillStyle = gr; g.fillRect(-40, -40, 80, 80); g.restore(); }
  speck(g, R, 256, 256, 3000, () => `rgba(${40 + R() * 60},${70 + R() * 60},${25 + R() * 30},0.4)`, 2);
  return c;
}

// ---- 合併網格：同材質、同一格（ch 公尺）的三角形放一起，最後每一組變成一個 Mesh ----
class Builder {
  constructor(ch) { this.ch = ch; this.bins = new Map(); this.k = '0,0'; this.tris = 0; }
  at(x, z) { this.k = Math.floor(x / this.ch) + ',' + Math.floor(z / this.ch); return this; }
  tri(m, a, b, c, ta, tb, tc, ca, cb = ca, cc = ca) {
    const key = m + '|' + this.k; let g = this.bins.get(key);
    if (!g) this.bins.set(key, (g = { m, p: [], n: [], u: [], c: [] }));
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-12) return;
    nx /= l; ny /= l; nz /= l;
    g.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); g.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    g.u.push(ta[0], ta[1], tb[0], tb[1], tc[0], tc[1]); g.c.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
    this.tris++;
  }
  // a b c d：左下、右下、右上、左上（從正面看）；uv＝[u0, v0, u1, v1]
  quad(m, a, b, c, d, uv, col) { const [u0, v0, u1, v1] = uv; this.tri(m, a, b, c, [u0, v0], [u1, v0], [u1, v1], col); this.tri(m, a, c, d, [u0, v0], [u1, v1], [u0, v1], col); }
  build(mats, order = {}, tag = '') {
    const group = new THREE.Group(); let n = 0;
    for (const g of this.bins.values()) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.u, 2));
      if (mats[g.m].vertexColors) geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mats[g.m]); mesh.matrixAutoUpdate = false; mesh.renderOrder = order[g.m] || 0; mesh.name = tag + g.m;
      group.add(mesh); n++;
    }
    return { group, meshes: n };
  }
}
const ICO = (() => { // 二十面體（樹冠、燈籠）；細分一次＝80 面
  const t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return p.map((q) => q / l); });
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const v1 = v.map((p) => p.slice()), f1 = [], mid = new Map();
  const m = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (mid.has(k)) return mid.get(k); const p = [(v1[a][0] + v1[b][0]) / 2, (v1[a][1] + v1[b][1]) / 2, (v1[a][2] + v1[b][2]) / 2], l = Math.hypot(...p); v1.push(p.map((q) => q / l)); mid.set(k, v1.length - 1); return v1.length - 1; };
  for (const [a, b, c] of f) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); f1.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
  return [{ v, f }, { v: v1, f: f1 }];
})();

// ---- 快速道路：一圈。從路口 (−530, 0) 朝北出發：東邊直線（z 0 → −225）→ 北邊半圓（R 250，圓心 (−780, −225)）→ 西邊直線（x = −1030，450 公尺）→ 南邊半圓 → 回到路口 ----
// S 直線、A 彎（半徑、角度：正的左轉）；頭尾 14、2.5 公尺分開是為了剛好在中間護欄開口（±14）、東邊護欄開口（±16.5）的地方有點
// 一圈 2470.8 公尺（原本 4709.8：東邊直線 1250、R 350、西邊 R 900 的大 S 彎，Nick 嫌太長）。同樣長度比過別的形狀（node 裡用 drive.js 的物理＋測試的機器人開）：
//   彎大一點（R 300、直線 300）彎道快一點，可是直線短、機器人極速反而低（233 vs 242 km/h）；彎小一點（R 200、直線 600）極速差不多（244），彎道慢很多；
//   西邊加緩的 S 彎（R 600 ±10°）長度幾乎不變，可是測試的機器人在 S 彎接半圓那裡會偏出車道太多、猛煞車 → 不加
//   R 250：drive.js 設計的「250 公尺的彎 200 km/h 過得去」；這麼短的一圈 SUPRA 開不到 300（直線要 1 公里左右），機器人 240 左右、油門踩到底不煞車 265 左右
const HWY_PLAN = [['S', 14], ['S', 2.5], ['S', 208.5], ['A', 250, 180], ['S', 450], ['A', 250, 180], ['S', 208.5], ['S', 2.5], ['S', 14]];
const HW = { x: -530, z: 0, half: 11.9, rail: 12.0, mid: 5.05, lanes: [3.175, 6.925], gapM: 14, gapE: 16.5 }; // 半寬（到外路肩邊）、護欄、車道中間⋯（離中線幾公尺，右邊＝往前開的右手邊）
// 沿著中線取點：直線每段最長 stS 公尺、彎道每段最多 stA 度；{ x, z, th（朝向＝rotation.y）, s（從路口算的距離）, k（曲率，左轉正）}
function hwyPath(stS, stA) {
  let x = HW.x, z = HW.z, th = Math.PI / 2, s = 0; const out = [{ x, z, th, s, k: 0 }];
  for (const [t, a, b] of HWY_PLAN) {
    if (t === 'S') {
      const n = Math.max(1, Math.ceil(a / stS));
      for (let i = 1; i <= n; i++) { const d = (a * i) / n; out.push({ x: x + Math.cos(th) * d, z: z - Math.sin(th) * d, th, s: s + d, k: 0 }); }
      x += Math.cos(th) * a; z -= Math.sin(th) * a; s += a;
    } else {
      const ang = (b * Math.PI) / 180, sg = Math.sign(ang), n = Math.max(1, Math.ceil(Math.abs(b) / stA), Math.ceil((a * Math.abs(ang)) / stS)); // 大半徑的彎：一段也不要超過 stS 公尺
      const cx = x - sg * Math.sin(th) * a, cz = z - sg * Math.cos(th) * a; // 圓心：左轉在左手邊、右轉在右手邊
      for (let i = 1; i <= n; i++) { const t2 = th + (ang * i) / n; out.push({ x: cx + sg * a * Math.sin(t2), z: cz + sg * a * Math.cos(t2), th: t2, s: s + (a * Math.abs(ang) * i) / n, k: sg / a }); }
      th += ang; x = cx + sg * a * Math.sin(th); z = cz + sg * a * Math.cos(th); s += a * Math.abs(ang);
    }
  }
  return out;
}
const hwyOff = (p, o) => [p.x + o * Math.sin(p.th), p.z + o * Math.cos(p.th)]; // 中線往右 o 公尺（負的往左）
const HWY_LEN = HWY_PLAN.reduce((L, [t, a, b]) => L + (t === 'S' ? a : (a * Math.abs(b) * Math.PI) / 180), 0); // 一圈 2470.8 公尺
const HWY_ARCS = (() => { const out = []; let s = 0; for (const [t, a, b] of HWY_PLAN) { const L = t === 'S' ? a : (a * Math.abs(b) * Math.PI) / 180; if (t === 'A') out.push({ s0: s, s1: s + L, R: a, deg: b }); s += L; } return out; })(); // 彎道在哪（從路口算）：彎道箭頭牌用
function hwyAt(s) { // 中線上距離 s（從路口往北算）的 { x, z, th }
  s = ((s % HWY_LEN) + HWY_LEN) % HWY_LEN; let x = HW.x, z = HW.z, th = Math.PI / 2;
  for (const [t, a, b] of HWY_PLAN) {
    if (t === 'S') { if (s <= a) return { x: x + Math.cos(th) * s, z: z - Math.sin(th) * s, th }; x += Math.cos(th) * a; z -= Math.sin(th) * a; s -= a; continue; }
    const ang = (b * Math.PI) / 180, sg = Math.sign(ang), len = a * Math.abs(ang), cx = x - sg * Math.sin(th) * a, cz = z - sg * Math.cos(th) * a;
    if (s <= len) { const t2 = th + (sg * s) / a; return { x: cx + sg * a * Math.sin(t2), z: cz + sg * a * Math.cos(t2), th: t2 }; }
    th += ang; x = cx + sg * a * Math.sin(th); z = cz + sg * a * Math.cos(th); s -= len;
  }
  return { x, z, th };
}

// ---- 路網（節點＝路口、端點）----
const NODES = {
  T: [-7, 0], E0: [-60, 0], E1: [-112, 0], SHX: [-136, 0], SH: [-160, 0], C: [-250, 0], X: [-300, 0], W: [-345, 0], DEN: [-410, 0], DEX: [-497, 0], HJ: [-518, 0],
  HO: [HW.x + HW.mid, 0], HI: [HW.x - HW.mid, 0], // 快速道路：往北（外圈）、往南（內圈）那一邊的路口
  G: [-300, -72], GD: [-300, -92.5], GAR: [-300, -97.5], SHB: [-160, -35], DEB: [-484, -17],
};
// 第 9 批（b9-wide）：Nick 2026-10-09「路變大」→ 村子的路都寬 1.5 倍（中線不動）：大路 9 → 13.5、村子的路 8 → 12、7 → 10.5、水泥農路 6 → 9；
//   車道（drive：改車廠、車店、車庫、警察局、槍店的進出口）、快速道路（一線 3.75 公尺本來就夠寬）、賽道不變
const ROADS = [
  { a: 'T', b: 'E0', kind: 'strip', w: 12, pts: [[-7, 0], [-60, 0]] }, // 賽道（buildTrack 畫的，這裡只算路線）
  { a: 'E0', b: 'E1', kind: 'main', w: [12, 12.4, 13.5, 13.5], pts: [[-60, 0], [-88, 0], [-100, 0], [-112, 0]] }, // 賽道入口：12 公尺寬（賽道），慢慢變成 13.5（Nick 2026-10-09「路變大」：大路 9 → 13.5）
  { a: 'E1', b: 'SHX', kind: 'main', w: 13.5, pts: [[-112, 0], [-136, 0]] },
  { a: 'SHX', b: 'SH', kind: 'main', w: 13.5, pts: [[-136, 0], [-160, 0]] },
  { a: 'SH', b: 'C', kind: 'main', w: 13.5, pts: [[-160, 0], [-250, 0]] },
  { a: 'C', b: 'X', kind: 'street', w: 12, pts: [[-250, 0], [-300, 0]] },
  { a: 'X', b: 'W', kind: 'street', w: 12, pts: [[-300, 0], [-345, 0]] },
  { a: 'W', b: 'DEN', kind: 'main', w: 13.5, pts: [[-345, 0], [-410, 0]] }, // 出村子往西：車店、快速道路
  { a: 'DEN', b: 'DEX', kind: 'main', w: 13.5, pts: [[-410, 0], [-497, 0]] },
  { a: 'DEX', b: 'HJ', kind: 'main', w: 13.5, pts: [[-497, 0], [-518, 0]] },
  { a: 'HJ', b: 'HO', kind: 'link', w: 8, pts: [[-518, 0], [HW.x + HW.mid, 0]] }, // 路口右轉上外圈（往北）、左轉過中間護欄開口上內圈（往南）
  { a: 'HJ', b: 'HI', kind: 'link', w: 8, pts: [[-518, 0], [HW.x - HW.mid, 0]] },
  { a: 'W', b: 'G', kind: 'street', w: 10.5, pts: [[-345, 0], [-345, -72], [-300, -72]], round: 10 },
  { a: 'G', b: 'C', kind: 'street', w: 10.5, pts: [[-300, -72], [-250, -72], [-250, 0]], round: 10 },
  { a: 'G', b: 'X', kind: 'street', w: 10.5, pts: [[-300, -72], [-300, 0]] }, // 車庫門口直直往南到大路
  { a: 'G', b: 'GD', kind: 'drive', w: 6, pts: [[-300, -72], [-300, -92.5]] }, // 車庫前的水泥地 → 鐵捲門
  { a: 'GD', b: 'GAR', kind: 'drive', w: 6, pts: [[-300, -92.5], [-300, -97.5]] }, // 鐵捲門 → 車庫裡的停車位
  { a: 'SH', b: 'SHB', kind: 'drive', w: 7, oneway: true, pts: [[-160, 0], [-160, -35]] }, // 改車廠：前門開進改車區
  { a: 'SHB', b: 'SHX', kind: 'drive', w: 7, oneway: true, pts: [[-160, -35], [-160, -57], [-136, -57], [-136, 0]], round: 9 }, // 後門出去、後院、東邊的小路回大路
  { a: 'DEN', b: 'DEB', kind: 'drive', w: 7, oneway: true, pts: [[-410, 0], [-410, -17], [-484, -17]], round: 8 }, // 車店：東邊進來、經過展示間前面、開進車棚（買車區）
  { a: 'DEB', b: 'DEX', kind: 'drive', w: 7, oneway: true, pts: [[-484, -17], [-497, -17], [-497, 0]], round: 7 }, // 西邊出去
  { a: 'C', b: 'E1', kind: 'farm', w: 9, pts: [[-250, 0], [-250, 58], [-112, 58], [-112, 0]], round: 13 },
];
const DEST_NODE = { garage: 'GAR', shop: 'SHB', track: 'T', dealer: 'DEB', highway: 'HO' };
// ==== 第 3 批：警察局（大路西段南邊：W 路口往南開進前院，變成十字路口）、槍店（改車廠對面：SH 路口往南斜斜開進店門口）====
NODES.POL = [-345, 11]; NODES.GSP = [-163, 9.5];
ROADS.push({ a: 'W', b: 'POL', kind: 'drive', w: 7, pts: [[-345, 0], [-345, 11]] }, { a: 'SH', b: 'GSP', kind: 'drive', w: 6, pts: [[-160, 0], [-163, 9.5]] });
DEST_NODE.police = 'POL'; DEST_NODE.gunshop = 'GSP';
// ==== 第 3 批 end ====
const HWK = new Set(['hwyO', 'hwyI']); // 快速道路的兩條（一圈）：路線圖用
function roundPoly(pts, r, n = 6) { // 轉角改成圓弧（二次貝茲）
  if (!r || pts.length < 3) return pts.map((p) => p.slice());
  const out = [pts[0].slice()];
  for (let i = 1; i < pts.length - 1; i++) {
    const [p, q, s] = [pts[i - 1], pts[i], pts[i + 1]], l1 = Math.hypot(q[0] - p[0], q[1] - p[1]), l2 = Math.hypot(s[0] - q[0], s[1] - q[1]), rr = Math.min(r, l1 / 2, l2 / 2);
    const a = [q[0] + ((p[0] - q[0]) * rr) / l1, q[1] + ((p[1] - q[1]) * rr) / l1], b = [q[0] + ((s[0] - q[0]) * rr) / l2, q[1] + ((s[1] - q[1]) * rr) / l2];
    for (let k = 0; k <= n; k++) { const t = k / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * q[0] + t * t * b[0], u * u * a[1] + 2 * u * t * q[1] + t * t * b[1]]); }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
const plen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)); const qx = ax + dx * t, qz = az + dz * t; return [Math.hypot(px - qx, pz - qz), t, qx, qz]; }
const inRect = (r, x, z) => { const dx = x - r.x, dz = z - r.z, c = Math.cos(r.rot || 0), s = Math.sin(r.rot || 0); return Math.abs(dx * c - dz * s) <= r.hx && Math.abs(dx * s + dz * c) <= r.hz; };

// 賽道（buildTrack）那邊的碰撞：兩邊護欄、看台、路燈、燈樹、終點門柱
function stripColliders() {
  const out = [];
  out.push({ t: 'box', x: 350, z: 6.3, hx: 410, hz: 0.2, rot: 0, h: 0.9 }, { t: 'box', x: -58.75, z: -6.3, hx: 1.25, hz: 0.2, rot: 0, h: 0.9 }, { t: 'box', x: 361.5, z: -6.3, hx: 398.5, hz: 0.2, rot: 0, h: 0.9 }); // 南邊的牆不開口了（內湖改從村子南邊的口過去）；北邊的牆在 x −57.5…−37 開一個口（往北去賽車場：circuit.js）
  out.push({ t: 'box', x: 30, z: -13.4, hx: 65, hz: 3.3, rot: 0, h: 4.2 });
  for (let k = 0; k < 14; k++) for (const s of [1, -1]) out.push({ t: 'circle', x: -30 + 60 * k, z: s * 8, r: 0.22, h: 9 });
  out.push({ t: 'circle', x: 3.2, z: 0, r: 0.35, h: 2.6 });
  for (const s of [1, -1]) out.push({ t: 'box', x: 400, z: s * 6.9, hx: 0.23, hz: 0.23, rot: 0, h: 6.4 });
  out.push({ t: 'box', x: 761, z: 0, hx: 1, hz: 7, rot: 0, h: 1 }); // 柏油東邊的盡頭（看不到的牆，不要開出去）
  for (const c of out) c.noCrush = true; // 第 9 批（路變大）：賽道的東西越野車也輾不到（照舊）
  return out;
}

function buildVillage(opts = {}) {
  const R = rng(opts.seed ?? 20260927), TR = rng(7);
  const aniso = opts.renderer ? Math.min(8, opts.renderer.capabilities.getMaxAnisotropy()) : 4;
  const MA = mainAtlas(TR), SA = signAtlas(TR), GA = glowAtlas(TR), DA = decalAtlas(TR), S2A = sign2Atlas(TR);
  const U = MA.uv, SU = SA.uv, GU = GA.uv, DU = DA.uv, S2 = S2A.uv, WD = dotUV(U.white), SW = dotUV(SU.white), GW = dotUV(GU.white), S2W = dotUV(S2.white);
  const texs = [toTex(MA.c, aniso), toTex(SA.c, aniso), toTex(GA.c, aniso), toTex(DA.c, aniso), toTex(S2A.c, aniso), toTex(roadTex(TR), aniso, 't'), toTex(hwyTex(TR), aniso, 't'), toTex(paveTex(TR), aniso, 'both'), toTex(paddyTex(TR), aniso, 'both'), toTex(grassTex(TR), aniso, 'both')];
  const [tMain, tSign, tGlow, tDecal, tSign2, tRoad, tHwy, tPave, tPaddy, tGrass] = texs;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
  const mats = {
    main: std({ map: tMain, vertexColors: true }),
    sign: std({ map: tSign, vertexColors: true, emissive: 0xffffff, emissiveMap: tSign, emissiveIntensity: 0.3, roughness: 0.6 }),
    sign2: std({ map: tSign2, vertexColors: true, emissive: 0xffffff, emissiveMap: tSign2, emissiveIntensity: 0.3, roughness: 0.6 }),
    glow: new THREE.MeshBasicMaterial({ map: tGlow, vertexColors: true }),
    halo: new THREE.MeshBasicMaterial({ map: tGlow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true }),
    road: std({ map: tRoad, roughness: 0.93 }),
    hwy: std({ map: tHwy, roughness: 0.93 }),
    pave: std({ map: tPave, vertexColors: true }),
    paddy: std({ map: tPaddy, vertexColors: true, roughness: 0.55 }),
    decal: std({ map: tDecal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xc4dbe8, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true }), // 車行、改車廠辦公室的玻璃（兩面一次畫完）
    ground: std({ map: tGrass, roughness: 1, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 6 }), // 往後推一點：斜斜看過去時水泥地、路不會被草地蓋掉
    wire: new THREE.LineBasicMaterial({ color: 0x26272a }),
  };
  // 村子：200 公尺一格；快速道路那一大圈：500 公尺一格（HB）。下面的小工具都畫到 B：蓋快速道路的時候把 B 換成 HB
  let B = new Builder(opts.chunk ?? 200); const VB = B, HB = new Builder(500);
  const colliders = [], paved = [], paddies = [], wires = [], buildings = [];
  const FAC = true, stHouses = [], stRows = [], stPoles = []; // ==== 第 3 批：外牆給 street.js 畫；每一棟透天厝、每一排、每一根電線桿記下來給 street.js ====
  const WHITE = [1, 1, 1];
  const dfl = (m) => (m === 'sign' ? SW : m === 'sign2' ? S2W : m === 'glow' || m === 'halo' ? GW : WD);

  // ---- 基本形狀 ----
  // 方塊：b＝[x0, y0, z0, x1, y1, z1]（本地）；col：顏色或 { pz, px, nx, nz, py, ny, _ }；uv：同樣（false＝不要那一面；ny 要寫才有）
  const box = (m, T, b, col, uv = {}) => {
    const [x0, y0, z0, x1, y1, z1] = b, P = T.p, dflt = dfl(m);
    const f = (k, a, bb, c, d) => {
      const u = uv[k] !== undefined ? uv[k] : uv._; if (u === false) return;
      const cc = Array.isArray(col) ? col : col[k] || col._ || WHITE;
      B.quad(m, P(...a), P(...bb), P(...c), P(...d), u || dflt, cc);
    };
    f('pz', [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); f('nz', [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    f('px', [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]); f('nx', [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    f('py', [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    if (uv.ny !== undefined && uv.ny !== false) f('ny', [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  };
  // 直立的面：從本地 (ax, az) 到 (bx, bz)（正面看左到右），y0–y1
  const vquad = (m, T, a, b, y0, y1, uv, col = WHITE, both = false) => {
    B.quad(m, T.p(a[0], y0, a[1]), T.p(b[0], y0, b[1]), T.p(b[0], y1, b[1]), T.p(a[0], y1, a[1]), uv, col);
    if (both) B.quad(m, T.p(b[0], y0, b[1]), T.p(a[0], y0, a[1]), T.p(a[0], y1, a[1]), T.p(b[0], y1, b[1]), [uv[2], uv[1], uv[0], uv[3]], col);
  };
  // 本地 z 往前的正面貼一片（x0–x1、y0–y1、在 z）
  const face = (m, T, x0, x1, y0, y1, z, uv, col = WHITE) => vquad(m, T, [x0, z], [x1, z], y0, y1, uv, col);
  // 天花板（從下面看）／地板（從上面看）：本地 x0–x1、z0–z1、高 y
  const ceil = (m, T, x0, z0, x1, z1, y, uv, col = WHITE) => B.quad(m, T.p(x0, y, z0), T.p(x1, y, z0), T.p(x1, y, z1), T.p(x0, y, z1), uv, col);
  const floor = (m, T, x0, z0, x1, z1, y, uv, col = WHITE) => B.quad(m, T.p(x0, y, z1), T.p(x1, y, z1), T.p(x1, y, z0), T.p(x0, y, z0), uv, col);
  // 形狀招牌（圓形、倒三角）：poly＝貼圖區塊裡的像素點（凸多邊形），貼在本地 z、中心 (cx, cy)、一像素 k 公尺；背面灰色
  const circ = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * TAU) * r, cy - Math.sin((i / n) * TAU) * r]);
  const signPoly = (T, reg, rw, rh, poly, k, cx, cy, z, back = C('#9aa0a6'), m = 'sign') => {
    let L = poly.map(([px, py]) => [cx + (px - rw / 2) * k, cy - (py - rh / 2) * k, reg[0] + ((reg[2] - reg[0]) * px) / rw, reg[3] - ((reg[3] - reg[1]) * py) / rh]);
    let area = 0; for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) L = L.reverse(); // 逆時針＝正面朝本地 +z
    const n = L.length, mm = [0, 1, 2, 3].map((q) => L.reduce((s, p) => s + p[q], 0) / n);
    for (let i = 0; i < n; i++) {
      const a = L[i], b = L[(i + 1) % n];
      B.tri(m, T.p(mm[0], mm[1], z), T.p(a[0], a[1], z), T.p(b[0], b[1], z), [mm[2], mm[3]], [a[2], a[3]], [b[2], b[3]], WHITE);
      B.tri('main', T.p(mm[0], mm[1], z - 0.025), T.p(b[0], b[1], z - 0.025), T.p(a[0], a[1], z - 0.025), WD, WD, WD, back);
    }
  };
  // 地上平平的一片：中心 (cx, cz)、dir＝貼圖上方朝向（單位向量）、len 沿 dir、wid 橫向
  const flat = (m, cx, cz, dx, dz, len, wid, y, uv, col = WHITE) => {
    const rx = -dz, rz = dx, hl = len / 2, hw = wid / 2;
    B.at(cx, cz).quad(m, [cx - dx * hl - rx * hw, y, cz - dz * hl - rz * hw], [cx - dx * hl + rx * hw, y, cz - dz * hl + rz * hw], [cx + dx * hl + rx * hw, y, cz + dz * hl + rz * hw], [cx + dx * hl - rx * hw, y, cz + dz * hl - rz * hw], uv, col);
  };
  // 直的圓柱（本地）：底 (x, y0, z)、高到 y1、半徑 r0→r1、n 邊；uv 包一圈
  const cyl = (m, T, x, z, y0, y1, r0, r1, n, col, uv = null, cap = true, a0 = 0) => {
    const P = (a, r, y) => T.p(x + Math.cos(a) * r, y, z - Math.sin(a) * r), dflt = dfl(m);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU, b = a0 + ((i + 1) / n) * TAU, u = uv || dflt;
      const ua = u[0] + ((u[2] - u[0]) * i) / n, ub = u[0] + ((u[2] - u[0]) * (i + 1)) / n;
      if (r1 > 0) B.quad(m, P(a, r0, y0), P(b, r0, y0), P(b, r1, y1), P(a, r1, y1), [ua, u[1], ub, u[3]], col);
      else B.tri(m, P(a, r0, y0), P(b, r0, y0), T.p(x, y1, z), [ua, u[1]], [ub, u[1]], [(ua + ub) / 2, u[3]], col);
      if (cap && r1 > 0) B.tri(m, T.p(x, y1, z), P(a, r1, y1), P(b, r1, y1), dflt.slice(0, 2), dflt.slice(0, 2), dflt.slice(0, 2), col);
    }
  };
  // 兩點之間的管子（樹幹、支架、燕尾）：世界座標 a→b
  const tube = (m, a, b, r0, r1, n, col, uv = null, cap = false) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d); d[0] /= L; d[1] /= L; d[2] /= L;
    const up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let e1 = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; const l1 = Math.hypot(...e1); e1 = e1.map((v) => v / l1);
    const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]];
    const P = (o, t, r) => { const c = Math.cos(t) * r, s = Math.sin(t) * r; return [o[0] + e1[0] * c + e2[0] * s, o[1] + e1[1] * c + e2[1] * s, o[2] + e1[2] * c + e2[2] * s]; };
    const u = uv || dfl(m), u0 = dfl(m);
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * TAU, t1 = ((i + 1) / n) * TAU, ua = u[0] + ((u[2] - u[0]) * i) / n, ub = u[0] + ((u[2] - u[0]) * (i + 1)) / n;
      if (r1 > 0) B.quad(m, P(a, t0, r0), P(a, t1, r0), P(b, t1, r1), P(b, t0, r1), [ua, u[1], ub, u[3]], col);
      else B.tri(m, P(a, t0, r0), P(a, t1, r0), b, [ua, u[1]], [ub, u[1]], [ua, u[3]], col);
      if (cap && r1 > 0) B.tri(m, b, P(b, t0, r1), P(b, t1, r1), u0, u0, u0, col);
    }
  };
  // 一團（樹冠、灌木、燈籠）：二十面體，每個頂點抖一點、每面顏色深淺不同
  const blob = (m, cx, cy, cz, rx, ry, rz, col, jit = 0.18, detail = 0, seed = 0, shade = 0.16) => {
    const { v, f } = ICO[detail], P = v.map((p, i) => { const k = 1 + (hash2(seed, i) - 0.5) * 2 * jit; return [cx + p[0] * rx * k, cy + p[1] * ry * k, cz + p[2] * rz * k]; });
    f.forEach(([a, b, c], i) => { const nyy = (v[a][1] + v[b][1] + v[c][1]) / 3, k = 0.88 + nyy * 0.14 + (hash2(seed + 9, i) - 0.5) * shade; B.tri(m, P[a], P[b], P[c], WD, WD, WD, mul(col, k)); });
  };
  const addBox = (x, z, hx, hz, rot, h) => colliders.push({ t: 'box', x, z, hx, hz, rot, h });
  const addCircle = (x, z, r, h) => colliders.push({ t: 'circle', x, z, r, h });
  const lbox = (T, x0, z0, x1, z1, h) => { const c = T.p((x0 + x1) / 2, 0, (z0 + z1) / 2); addBox(c[0], c[2], Math.abs(x1 - x0) / 2, Math.abs(z1 - z0) / 2, T.ry, h); }; // 本地長方形的碰撞
  const wall = (m, T, b, col, uv, h) => { box(m, T, b, col, uv); lbox(T, b[0], b[2], b[3], b[5], h ?? b[4]); }; // 方塊＋碰撞
  const addPave = (x, z, hx, hz, rot, col, y = 0.02, draw = true) => { // 水泥／柏油地（算路面）；draw false：只算路面不畫（車庫模組自己有地板）
    if (draw) {
      const T = frame(x, y, z, rot); B.at(x, z).quad('pave', T.p(-hx, 0, hz), T.p(hx, 0, hz), T.p(hx, 0, -hz), T.p(-hx, 0, -hz), [0, 0, 0, 0], col);
      const g = B.bins.get('pave|' + B.k), n = g.u.length; // 貼圖用世界座標（4 公尺一格）
      for (let i = n - 12; i < n; i += 2) { const j = ((i - (n - 12)) / 2) | 0, p = g.p.length - 18 + j * 3; g.u[i] = g.p[p] / 4; g.u[i + 1] = g.p[p + 2] / 4; }
    }
    paved.push({ x, z, hx, hz, rot });
  };

  // ---- 路 ----
  const hc = hwyPath(50, 4); // 快速道路（路線圖、小地圖用：直線 50 公尺、彎道 4 度一段）
  const roads = ROADS.concat([
    { a: 'HO', b: 'HO', kind: 'hwyO', w: 7.5, oneway: true, pts: hc.map((p) => hwyOff(p, HW.mid)) }, // 外圈：從路口往北、一圈回到路口（中線右邊）
    { a: 'HI', b: 'HI', kind: 'hwyI', w: 7.5, oneway: true, pts: hc.map((p) => hwyOff(p, -HW.mid)).reverse() }, // 內圈：從路口往南、反方向一圈
  ]).map((r) => ({ ...r, pts: roundPoly(r.pts, r.round) }));
  for (const r of roads) r.len = plen(r.pts);
  const roadSegs = []; // 村子的路（算路面、人孔蓋）：賽道、快速道路另外算
  for (const r of roads) if (r.kind !== 'strip' && r.kind !== 'link' && !HWK.has(r.kind)) for (let i = 0; i < r.pts.length - 1; i++) {
    const w = Array.isArray(r.w) ? Math.max(r.w[Math.min(i, r.w.length - 1)], r.w[Math.min(i + 1, r.w.length - 1)]) : r.w;
    roadSegs.push({ ax: r.pts[i][0], az: r.pts[i][1], bx: r.pts[i + 1][0], bz: r.pts[i + 1][1], hw: w / 2, r });
  }
  const ribbon = (r) => { // 路面：沿著折線的帶子（轉角斜接），u 橫向、v 沿路
    const pts = r.kind === 'main' && r.a === 'E0' ? [[-59.4, 0], ...r.pts.slice(1)] : r.kind === 'main' && r.b === 'HJ' ? [...r.pts.slice(0, -1), [-518.3, 0]] : r.pts; // 蓋過賽道柏油的邊一點點（接縫看不出來）；快速道路那頭接到路口的柏油
    const n = pts.length, [u0, u1] = RU[r.kind], ws = pts.map((p, i) => (Array.isArray(r.w) ? r.w[Math.min(i, r.w.length - 1)] : r.w));
    let v = 0; const L = [], Rt = [], V = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
      let k = 1; if (i > 0 && i < n - 1) { const sx = pts[i][0] - pts[i - 1][0], sz = pts[i][1] - pts[i - 1][1], sl = Math.hypot(sx, sz); k = 1 / Math.max(0.5, (sx * tx + sz * tz) / sl); }
      const lx = tz, lz = -tx, hw = (ws[i] / 2) * k; // 左邊＝(tz, −tx)
      if (i > 0) v += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      L.push([p[0] + lx * hw, 0.03, p[1] + lz * hw]); Rt.push([p[0] - lx * hw, 0.03, p[1] - lz * hw]); V.push(v / 10);
    }
    const um = (u0 + u1) / 2, M = pts.map((p) => [p[0], 0.03, p[1]]);
    for (let i = 0; i < n - 1; i++) { // 左右兩半各一條（路變寬的地方，中線才不會彎來彎去）
      B.at((pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      B.tri('road', Rt[i], Rt[i + 1], M[i + 1], [u1, V[i]], [u1, V[i + 1]], [um, V[i + 1]], WHITE); B.tri('road', Rt[i], M[i + 1], M[i], [u1, V[i]], [um, V[i + 1]], [um, V[i]], WHITE);
      B.tri('road', M[i], M[i + 1], L[i + 1], [um, V[i]], [um, V[i + 1]], [u0, V[i + 1]], WHITE); B.tri('road', M[i], L[i + 1], L[i], [um, V[i]], [u0, V[i + 1]], [u0, V[i]], WHITE);
    }
  };
  for (const r of roads) if (RU[r.kind]) ribbon(r);
  const deg = {}; for (const r of roads) if (r.kind !== 'strip' && r.kind !== 'link' && !HWK.has(r.kind)) { deg[r.a] = (deg[r.a] || 0) + 1; deg[r.b] = (deg[r.b] || 0) + 1; }
  const ASPH = C('#55575b'), CONC = C('#e6e6e2');
  for (const [k, p] of Object.entries(NODES)) { // 路口：一塊沒有標線的柏油，剛好蓋住兩條路交叉的那一格（路都是東西向或南北向）
    if ((deg[k] || 0) < 3) continue;
    let hx = 0, hz = 0;
    for (const r of roads) {
      if (r.kind === 'strip' || r.kind === 'link' || HWK.has(r.kind) || (r.a !== k && r.b !== k)) continue;
      const q = r.a === k ? r.pts : r.pts.slice().reverse(), w = Array.isArray(r.w) ? r.w[r.a === k ? 0 : r.w.length - 1] : r.w;
      if (Math.abs(q[1][0] - q[0][0]) > Math.abs(q[1][1] - q[0][1])) hz = Math.max(hz, w / 2); else hx = Math.max(hx, w / 2);
    }
    const x0 = p[0] - hx, x1 = p[0] + hx, z0 = p[1] - hz, z1 = p[1] + hz, uv = (x, z) => [x / 4, z / 4]; B.at(p[0], p[1]);
    B.tri('pave', [x0, 0.04, z1], [x1, 0.04, z1], [x1, 0.04, z0], uv(x0, z1), uv(x1, z1), uv(x1, z0), ASPH); B.tri('pave', [x0, 0.04, z1], [x1, 0.04, z0], [x0, 0.04, z0], uv(x0, z1), uv(x1, z0), uv(x0, z0), ASPH);
  }
  // 路線圖（Dijkstra；有方向：改車廠、車店是前面進、另一邊出；快速道路兩個方向各一條，一圈接回自己）
  const adjOut = {}, adjIn = {};
  for (const r of roads) {
    if (r.a === r.b) continue; // 快速道路一圈：車子在上面才用（route 從目前位置往前開到路口）
    const e = { r, from: r.a, to: r.b }; (adjOut[r.a] ||= []).push(e); (adjIn[r.b] ||= []).push(e);
    if (!r.oneway) { const e2 = { r, from: r.b, to: r.a }; (adjOut[r.b] ||= []).push(e2); (adjIn[r.a] ||= []).push(e2); }
  }
  let surfaceAt = null; // 下面蓋完才有（路面種類要等水泥地、稻田都登記好）
  function nearestRoad(x, z) { // 最近的路：在快速道路上就只找快速道路（還有路口），不在上面就不找快速道路
    const onH = surfaceAt(x, z) === 4; let best = null;
    for (const r of roads) {
      if (HWK.has(r.kind) ? !onH : onH && r.kind !== 'link') continue;
      let along = 0;
      for (let i = 0; i < r.pts.length - 1; i++) { const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], sl = Math.hypot(bx - ax, bz - az), [d, t, qx, qz] = segDist(x, z, ax, az, bx, bz); if (!best || d < best.d) best = { d, r, i, t, qx, qz, along: along + sl * t }; along += sl; }
    }
    return best;
  }
  function dijkstra(start) { // start：{ 節點: 距離 }
    const dist = { ...start }, prev = {}, done = new Set();
    for (;;) {
      let u = null; for (const k in dist) if (!done.has(k) && (u == null || dist[k] < dist[u])) u = k;
      if (u == null) break; done.add(u);
      for (const e of adjOut[u] || []) { const nd = dist[u] + e.r.len; if (dist[e.to] == null || nd < dist[e.to]) { dist[e.to] = nd; prev[e.to] = e; } }
    }
    return { dist, prev };
  }
  const walk = (r, from) => (r.a === from ? r.pts : r.pts.slice().reverse()); // 從節點 from 沿著路 r 走的點
  function route(x, z, dest) {
    const tgt = DEST_NODE[dest] || dest, nr = nearestRoad(x, z); if (!nr || !NODES[tgt]) return { pts: [[x, z]], len: 0 };
    const r = nr.r, start = r.oneway ? { [r.b]: r.len - nr.along } : { [r.a]: nr.along, [r.b]: r.len - nr.along }; // 單行道只能往前
    const { dist, prev } = dijkstra(start);
    if (dist[tgt] == null) return { pts: [[x, z]], len: 0 };
    let first = tgt; const chain = [];
    while (prev[first]) { chain.unshift(prev[first]); first = prev[first].from; }
    const toA = !r.oneway && first === r.a, mid = toA ? r.pts.slice(0, nr.i + 1).reverse() : r.pts.slice(nr.i + 1); // 從投影點走到第一個節點（a 或 b）
    const pts = [[x, z], [nr.qx, nr.qz]].concat(mid).filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.05);
    for (const e of chain) pts.push(...walk(e.r, e.from).slice(1));
    return { pts, len: Math.hypot(x - nr.qx, z - nr.qz) + dist[tgt] };
  }
  // 所有節點之間的最短距離（路標的箭頭用；有方向）
  const APSP = {}; for (const k of Object.keys(NODES)) APSP[k] = dijkstra({ [k]: 0 }).dist;

  // ---- 地面、稻田 ----
  { // 草地：村子、快速道路那一大片；賽道那邊（x −62…1250、|z| ≤ 450）是 buildTrack 的草地，這裡只補它南北兩邊；切成 50 公尺的格子（太大的三角形在手機／SwiftShader 上深度會不準）
    // 快速道路那片：路外面留 400 公尺左右，邊上是一圈遠的山（山跨在草地的邊上，從路上看不到草地的盡頭）
    const P = [], N = [], UV = [];
    const rect = (x0, z0, x1, z1) => {
      const nx = Math.max(1, Math.round((x1 - x0) / 50)), nz = Math.max(1, Math.round((z1 - z0) / 50));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const a = x0 + ((x1 - x0) * i) / nx, b = x0 + ((x1 - x0) * (i + 1)) / nx, c = z0 + ((z1 - z0) * j) / nz, d = z0 + ((z1 - z0) * (j + 1)) / nz;
        for (const [x, z] of [[a, d], [b, d], [b, c], [a, d], [b, c], [a, c]]) { P.push(x, 0, z); N.push(0, 1, 0); UV.push(x / 6, -z / 6); }
      }
    };
    rect(-1450, -880, -313, 880); rect(-287, -880, -62, 880); rect(-313, -880, -287, -110.5); rect(-313, -92.2, -287, 880); // 你家（車庫 x −313…−287、z −110.5…−92.2）底下挖空：升降機的坑不會被草蓋住
    rect(-62, -1150, 1300, -450); rect(-62, 450, 1300, 1150); // 快速道路一圈 x −1042…−518、z ±487（原本 −1500…、±1150）
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.computeBoundingSphere();
    var ground = new THREE.Mesh(g, mats.ground); ground.name = 'ground'; ground.matrixAutoUpdate = false;
  }
  const RICE = [C('#ffffff'), C('#eef6e4'), C('#ffffff'), C('#b3e869'), C('#a2dc5c'), C('#c8ef78'), C('#e8f07a')]; // 白＝剛插秧（水面映天空）；綠、黃綠＝長高了的稻子（乘在同一張貼圖上）
  const paddyArea = (x0, z0, x1, z1, nx, nz, rnd) => { // 一塊稻田：切成 nx × nz 格，中間田埂
    paddies.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, rot: 0 });
    const dx = (x1 - x0) / nx, dz = (z1 - z0) / nz, EMB = C('#8a9a58');
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const a = x0 + i * dx + 0.2, b = x0 + (i + 1) * dx - 0.2, c = z0 + j * dz + 0.2, d = z0 + (j + 1) * dz - 0.2, col = pick(rnd, RICE), rot = rnd() < 0.5;
      B.at((a + b) / 2, (c + d) / 2);
      const uv = (x, z) => (rot ? [z / 3.2, x / 3.2] : [x / 3.2, z / 3.2]);
      B.tri('paddy', [a, 0.012, d], [b, 0.012, d], [b, 0.012, c], uv(a, d), uv(b, d), uv(b, c), col); B.tri('paddy', [a, 0.012, d], [b, 0.012, c], [a, 0.012, c], uv(a, d), uv(b, c), uv(a, c), col);
    }
    const T0 = frame(0, 0, 0);
    for (let i = 0; i <= nx; i++) { const x = x0 + i * dx; B.at(x, (z0 + z1) / 2); box('main', T0, [x - 0.22, 0, z0, x + 0.22, 0.14, z1], EMB, { nz: false, pz: false }); }
    for (let j = 0; j <= nz; j++) { const z = z0 + j * dz; B.at((x0 + x1) / 2, z); box('main', T0, [x0, 0, z - 0.22, x1, 0.14, z + 0.22], EMB, { px: false, nx: false }); }
  };

  // ---- 樹 ----
  const GREENS = ['#4f8a3c', '#5e9a44', '#3f7a35', '#6aa84f', '#77ad4c'].map(C), TRUNK = C('#6b5140');
  const tree = (x, z, s, rnd, col = true) => { // 圓圓的樹
    B.at(x, z); const T = frame(x, 0, z), h = 2 * s;
    cyl('main', T, 0, 0, 0, h + 0.4, 0.2 * s, 0.14 * s, 6, TRUNK, null, false);
    const g = pick(rnd, GREENS), seed = (rnd() * 1e6) | 0;
    blob('main', x, h + 1.3 * s, z, 1.8 * s, 1.5 * s, 1.8 * s, g, 0.22, 1, seed);
    blob('main', x + 0.7 * s, h + 2.1 * s, z - 0.4 * s, 1.1 * s, 1.0 * s, 1.1 * s, mul(g, 1.1), 0.2, 0, seed + 1);
    if (col) addCircle(x, z, 0.35 * s, h + 3 * s);
  };
  const lowTree = (x, z, s, rnd) => { // 遠遠的樹（快速道路旁邊）：面少一點
    B.at(x, z); cyl('main', frame(x, 0, z), 0, 0, 0, 2.2 * s, 0.22 * s, 0.15 * s, 4, TRUNK, null, false);
    blob('main', x, 3.4 * s, z, 2.2 * s, 1.8 * s, 2.2 * s, mul(pick(rnd, GREENS), 0.92 + rnd() * 0.16), 0.25, 0, (rnd() * 1e6) | 0, 0.2);
  };
  const cone = (x, y, z, s, rnd) => { B.at(x, z); const T = frame(x, y, z, rnd() * TAU); cyl('main', T, 0, 0, -0.5, 1.2 * s, 0.18 * s, 0.12 * s, 5, TRUNK, null, false); cyl('main', T, 0, 0, 1.0 * s, 5.2 * s, 1.5 * s, 0, 7, mul(pick(rnd, GREENS), 0.8 + rnd() * 0.25), null, false); };
  const FROND = [C('#4c7d32'), C('#5b8f3a'), C('#6b9c3f')];
  const palm = (x, z, h, rnd, col = true) => { // 檳榔樹：細細直直的樹幹、上面一小叢葉子
    B.at(x, z); const lean = (rnd() - 0.5) * 0.06, la = rnd() * TAU, top = [x + Math.cos(la) * lean * h, h, z + Math.sin(la) * lean * h];
    tube('main', [x, 0, z], top, 0.13, 0.1, 5, C('#b9bca9'), U.bark);
    const sh = [top[0], top[1] + 1.1, top[2]]; tube('main', top, sh, 0.12, 0.1, 5, C('#6f9a3e'));
    blob('main', top[0] + 0.12, top[1] - 0.1, top[2], 0.2, 0.28, 0.2, C('#c9a13a'), 0.2, 0, (rnd() * 1e6) | 0); // 檳榔
    const n = 7 + ((rnd() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd() * 0.4, cx = Math.cos(a), cz = Math.sin(a), Lf = 2.3 + rnd() * 0.8, up = 0.9 + rnd() * 0.5, W = 0.34, fc = pick(rnd, FROND);
      const at = (t) => [sh[0] + cx * Lf * t, sh[1] - 0.2 + up * t - (up + 1.3) * t * t, sh[2] + cz * Lf * t];
      for (let k = 0; k < 4; k++) {
        const t0 = k / 4, t1 = (k + 1) / 4, w0 = W * Math.sin(Math.PI * Math.min(0.95, t0 + 0.08)), w1 = W * Math.sin(Math.PI * Math.min(0.95, t1 + 0.04)) * (k === 3 ? 0.2 : 1);
        const p0 = at(t0), p1 = at(t1), rx = -cz, rz = cx;
        const a0 = [p0[0] - rx * w0, p0[1], p0[2] - rz * w0], b0 = [p0[0] + rx * w0, p0[1], p0[2] + rz * w0], a1 = [p1[0] - rx * w1, p1[1], p1[2] - rz * w1], b1 = [p1[0] + rx * w1, p1[1], p1[2] + rz * w1];
        B.quad('main', a0, b0, b1, a1, WD, fc); B.quad('main', b0, a0, a1, b1, WD, mul(fc, 0.8));
      }
    }
    if (col) addCircle(x, z, 0.25, h);
  };
  const bamboo = (x, z, rnd) => { // 竹叢
    B.at(x, z);
    for (let i = 0; i < 9; i++) {
      const a = rnd() * TAU, r = rnd() * 1.2, bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r, h = 7 + rnd() * 4, lx = Math.cos(a) * (0.6 + rnd()), lz = Math.sin(a) * (0.6 + rnd());
      tube('main', [bx, 0, bz], [bx + lx, h, bz + lz], 0.07, 0.04, 4, C('#8fae4a'));
      blob('main', bx + lx * 1.05, h - 0.6, bz + lz * 1.05, 1.1, 1.6, 1.1, mul(C('#6f9e3a'), 0.85 + rnd() * 0.3), 0.3, 0, (rnd() * 1e6) | 0);
    }
    addCircle(x, z, 1.4, 9);
  };
  const banyan = (x, z) => { // 廟口的大榕樹
    B.at(x, z); const T = frame(x, 0, z);
    cyl('main', T, 0, 0, 0, 3.6, 1.0, 0.75, 8, C('#6e5a4a'), null, false);
    for (const [a, l] of [[0.3, 3.2], [2.1, 3.6], [4.0, 3.0], [5.3, 2.8]]) tube('main', [x, 3.2, z], [x + Math.cos(a) * l, 5.2, z + Math.sin(a) * l], 0.42, 0.25, 6, C('#6e5a4a'));
    for (const [dx, dy, dz, r] of [[0, 7.2, 0, 5.2], [3.2, 6.4, 1.8, 3.6], [-3.4, 6.2, -1.2, 3.8], [0.8, 6.0, -3.4, 3.4], [-1.2, 6.3, 3.4, 3.4], [0, 8.8, 0.5, 3.2]]) blob('main', x + dx, dy, z + dz, r, r * 0.62, r, C('#3f6e33'), 0.2, 1, (dx * 100 + dz) | 0);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + 0.3, r = 2.4 + (i % 3) * 1.1; tube('main', [x + Math.cos(a) * r, 5.4, z + Math.sin(a) * r], [x + Math.cos(a) * r, 0, z + Math.sin(a) * r], 0.05, 0.06, 3, C('#7a6655')); }
    addCircle(x, z, 1.1, 10);
  };
  const shrub = (x, z, s, rnd) => { B.at(x, z); blob('main', x, 0.45 * s, z, 0.9 * s, 0.6 * s, 0.9 * s, mul(pick(rnd, GREENS), 0.9 + rnd() * 0.2), 0.25, 0, (rnd() * 1e6) | 0); }; // 花台裡的矮樹

  // ---- 電線桿、路燈、電線 ----
  const pole = (x, z, fx, fz, lamp, trans) => { // (fx, fz)：朝路中間的方向（路燈的手臂伸過去）
    B.at(x, z); const T = frame(x, 0, z, Math.atan2(fx, fz)); // 本地 +z 朝路
    cyl('main', T, 0, 0, 0, 10.4, 0.17, 0.12, 6, C('#b9b8b2'), null, true);
    box('main', T, [-1.05, 9.5, -0.06, 1.05, 9.64, 0.06], C('#5f6166'));
    const ins = [-0.9, 0, 0.9].map((dx) => { box('main', T, [dx - 0.05, 9.64, -0.05, dx + 0.05, 9.84, 0.05], C('#e8e8e4')); return T.p(dx, 9.82, 0); });
    if (trans) { cyl('main', T, 0, -0.42, 6.8, 8.0, 0.32, 0.32, 8, C('#8f9398'), null, true); box('main', T, [-0.06, 7.0, -0.25, 0.06, 7.8, -0.12], C('#5f6166')); }
    if (lamp) { // 路燈手臂＋燈頭
      const a = T.p(0, 7.4, 0.1), b = T.p(0, 7.9, 1.9); tube('main', a, b, 0.05, 0.05, 4, C('#8d9197'));
      const H = T.sub(0, 7.8, 2.2); box('main', H, [-0.18, -0.08, -0.45, 0.18, 0.06, 0.45], C('#6f7378'), { ny: dotUV(U.white) }); box('glow', H, [-0.14, -0.1, -0.38, 0.14, -0.08, 0.38], [1.1, 1.05, 0.95], { _: dotUV(GU.warm), ny: dotUV(GU.warm) });
    }
    addCircle(x, z, 0.24, 10.4);
    stPoles.push({ x, z, fx, fz, ins, lamp: !!lamp, trans: !!trans }); // 第 3 批：電線桿（street.js 拉接戶線）
    return ins;
  };
  const poleLine = (pts) => { // pts：[[x, z, fx, fz], ...]
    let prev = null;
    pts.forEach(([x, z, fx, fz], i) => {
      const ins = pole(x, z, fx, fz, i % 2 === 0, i % 3 === 1);
      if (prev) for (let k = 0; k < 3; k++) { const a = prev[k], b = ins[k], sag = 0.35 + Math.hypot(b[0] - a[0], b[2] - a[2]) * 0.012; let p0 = a; for (let s = 1; s <= 8; s++) { const t = s / 8, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]; wires.push(p0, p); p0 = p; } }
      prev = ins;
    });
  };
  const mirrorPole = (x, z, tx, tz) => { // 路口反光鏡（橘色桿子），鏡子朝 (tx, tz)
    B.at(x, z); const T = frame(x, 0, z, Math.atan2(tx - x, tz - z)); cyl('main', T, 0, 0, 0, 2.75, 0.05, 0.05, 5, C('#ff7a1a'), null, true);
    signPoly(T, SU.mirror, 96, 96, circ(48, 48, 46, 14), 0.44 / 46, 0, 3.05, 0.09, C('#ff7a1a'));
    addCircle(x, z, 0.12, 3);
  };

  // ---- 透天厝 ----
  // ==== 第 3 批：外牆顏色改成比較像真的（米色／咖啡色二丁掛、白色／灰色馬賽克、淡色油漆）；一樣 14 個（亂數不變）====
  const HOUSE = ['#e6dccb', '#d9c3b0', '#c9d6c9', '#e3d7ac', '#c8d2da', '#d8b99c', '#d6cfd6', '#ecebe6', '#cfc8ba', '#b98b6f', '#b8cbc0', '#dcc3bf', '#dad3b2', '#b3c3d2'].map(C);
  const AWN = ['#3f8f6a', '#2f6fb0', '#c9ccd0', '#d9573b', '#e2b53a'].map(C), ROOFADD = ['#3b78c4', '#e07a3a', '#e8eaec', '#4c9a6a', '#8fb7e0'].map(C);
  const SCOOT = ['#f2f3f5', '#d0342c', '#2f6fd6', '#c3c8ce', '#ff8fb5', '#f2c230', '#1d1f23'].map(C);
  const scooter = (x, z, ry, rnd) => { // 機車（停在騎樓前）
    B.at(x, z); const T = frame(x, 0, z, ry), pc = pick(rnd, SCOOT), dk = C('#2a2b2e');
    box('main', T, [-0.75, 0.28, -0.19, 0.5, 0.62, 0.19], pc); box('main', T, [-0.2, 0.2, -0.2, 0.36, 0.3, 0.2], dk);
    box('main', T, [-0.66, 0.62, -0.17, 0.05, 0.73, 0.17], C('#1b1c1f')); box('main', T, [0.46, 0.26, -0.22, 0.62, 0.98, 0.22], pc);
    box('main', T, [0.52, 0.96, -0.33, 0.58, 1.01, 0.33], dk); box('main', T, [0.62, 0.72, -0.08, 0.66, 0.84, 0.08], C('#f4f1e6'));
    for (const wx of [-0.55, 0.6]) tube('main', T.p(wx, 0.2, -0.07), T.p(wx, 0.2, 0.07), 0.2, 0.2, 7, dk, null, true);
    const c = T.p(-0.05, 0, 0); addBox(c[0], c[2], 0.72, 0.24, ry, 1);
  };
  const house = (x, z, ry, w, D, fl, rnd, o = {}) => {
    const fl0 = o.fl0 ?? fl; // 第 10 批（房子變矮）：本來要蓋幾層（亂數照本來的層數用，別的房子才長得跟以前一樣）
    B.at(x, z); const T = frame(x, 0, z, ry), H = fl * FH;
    const cw = pick(rnd, HOUSE), cs = mix(cw, C('#c9c5bd'), 0.55), band = mul(cw, 0.8), roof = C('#a39f97');
    const hl = FAC ? { x, z, ry, w, D, H, fl, pw: 0.18, ph: 0.95, cw, cs, kind: 'house', door: 0, flo: [], awn: null, shop: o.shop ?? null, vsign: o.vsign ?? null } : null; // ==== 第 3 批：外牆給 street.js 畫（磁磚、水漬）；這裡記下每一棟（不動到亂數）====
    box('main', T, [-w / 2, 0, -D, w / 2, H, 0], { pz: cw, py: roof, _: cs }, FAC ? { py: U.conc, _: false } : { pz: subUV(U.tile, 0, 0, Math.min(1, w / 6.2), Math.min(1, H / 13.2)), _: U.conc });
    const pw = 0.18, ph = 0.95; // 女兒牆
    box('main', T, [-w / 2, H, -pw, w / 2, H + ph, 0], { pz: cw, _: cs }, { pz: FAC ? false : subUV(U.tile, 0, 0, Math.min(1, w / 6.2), 0.07), _: U.conc });
    box('main', T, [-w / 2, H, -D, w / 2, H + ph, -D + pw], cs, { _: U.conc }); box('main', T, [-w / 2, H, -D + pw, -w / 2 + pw, H + ph, -pw], cs, { _: U.conc }); box('main', T, [w / 2 - pw, H, -D + pw, w / 2, H + ph, -pw], cs, { _: U.conc });
    // 頂樓：樓梯間、水塔、加蓋的鐵皮屋
    const sx = (rnd() - 0.5) * Math.max(0, w - 3.2), stair = [sx - 1.3, H, -D + 0.6, sx + 1.3, H + 2.6, -D + 3.9];
    box('main', T, stair, cs, { _: U.conc, pz: U.conc }); face('main', T, sx - 0.45, sx + 0.45, H, H + 2.1, -D + 3.92, U.ac2);
    if (rnd() < 0.55) { cyl('main', T, sx, -D + 2.2, H + 2.6, H + 2.8, 0.5, 0.5, 6, C('#7d8288'), null, true); cyl('main', T, sx, -D + 2.2, H + 2.8, H + 4.1, 0.58, 0.58, 10, WHITE, U.tank, false); cyl('main', T, sx, -D + 2.2, H + 4.1, H + 4.4, 0.58, 0, 10, C('#d9dde1'), null, false); }
    else { const bl = C('#2f78c8'); cyl('main', T, sx, -D + 2.2, H + 2.6, H + 3.8, 0.62, 0.62, 10, bl, null, false); cyl('main', T, sx, -D + 2.2, H + 3.8, H + 4.05, 0.62, 0.2, 10, mul(bl, 0.9), null, true); }
    if (fl < 3 && fl0 >= 3) { if (rnd() < 0.35) pick(rnd, ROOFADD); } // 第 10 批：變矮的房子不加蓋（亂數一樣用掉）
    else if (fl >= 3 && rnd() < 0.35) { // 頂樓加蓋（浪板）
      const rc = pick(rnd, ROOFADD), z1 = -D * 0.42;
      box('main', T, [-w / 2 + 0.25, H, -D + 4.3, w / 2 - 0.25, H + 2.7, z1], rc, { _: U.corr, py: false });
      B.quad('main', T.p(-w / 2 + 0.05, H + 2.62, z1 + 0.4), T.p(w / 2 - 0.05, H + 2.62, z1 + 0.4), T.p(w / 2 - 0.05, H + 3.2, -D + 4.0), T.p(-w / 2 + 0.05, H + 3.2, -D + 4.0), U.corr, mul(rc, 0.85));
      B.quad('main', T.p(-w / 2 + 0.05, H + 3.2, -D + 4.0), T.p(w / 2 - 0.05, H + 3.2, -D + 4.0), T.p(w / 2 - 0.05, H + 2.62, z1 + 0.4), T.p(-w / 2 + 0.05, H + 2.62, z1 + 0.4), WD, mul(rc, 0.5));
    }
    for (let f = 1; f < fl; f++) box('main', T, [-w / 2, f * FH - 0.14, 0, w / 2, f * FH + 0.06, 0.12], band, { _: U.conc }); // 每層的線腳
    // 一樓：鐵捲門＋大門、店面、或門＋窗
    const kind = o.shop != null ? 'shop' : rnd() < 0.62 ? 'shutter' : 'door';
    let door = 0; // 門在本地 x 哪裡（以後走進去用）
    if (kind === 'shop') {
      const sp = o.shop;
      face('main', T, -w / 2 + 0.2, w / 2 - 0.2, 0, 2.75, 0.02, U['shop' + (sp % 3 + 1)]);
      box('sign', T, [-w / 2 + 0.1, 2.78, 0, w / 2 - 0.1, 3.22, 0.2], C('#f2f3f5'), { pz: SU['h' + (sp % 3)], _: SW });
      if (fl >= 3) box('sign', T, [w / 2 - 0.34, 3.7, 0.08, w / 2 - 0.1, 7.6, 1.0], C('#f2f3f5'), { px: SU['v' + (sp % 8)], nx: SU['v' + (sp % 8)], _: SW }); // 直立招牌
    } else if (kind === 'shutter') {
      const sw = w >= 5 ? Math.min(3.4, w - 1.7) : w - 0.5, x0 = -w / 2 + 0.25;
      face('main', T, x0, x0 + sw, 0, 2.7, 0.02, U.shutter, pick(rnd, [WHITE, WHITE, C('#d9efe9'), C('#dde8f6'), C('#f5ecd9')]));
      box('main', T, [x0 - 0.05, 2.7, 0, x0 + sw + 0.05, 3.0, 0.24], C('#9aa0a6'));
      if (w >= 5) { face('main', T, w / 2 - 1.45, w / 2 - 0.15, 0, 2.6, 0.02, U.door); door = w / 2 - 0.8; } else door = x0 + sw / 2;
      if (o.vsign != null && fl >= 3) box('sign', T, [w / 2 - 0.34, 3.7, 0.08, w / 2 - 0.1, 7.6, 1.0], C('#f2f3f5'), { px: SU['v' + o.vsign], nx: SU['v' + o.vsign], _: SW });
    } else {
      face('main', T, -0.8, 0.8, 0, 2.6, 0.02, U.door);
      if (w >= 4.6) { face('main', T, -w / 2 + 0.35, -1.05, 0.9, 2.4, 0.02, U.winP); face('main', T, 1.05, w / 2 - 0.35, 0.9, 2.4, 0.02, U.winP); }
    }
    if (hl) { hl.kind = kind; hl.door = door; if (kind === 'shutter') { const sw = w >= 5 ? Math.min(3.4, w - 1.7) : w - 0.5; hl.shutter = [-w / 2 + 0.25, -w / 2 + 0.25 + sw]; } } // 第 3 批
    if (rnd() < 0.45) { // 一樓的雨遮（浪板）
      const ac = pick(rnd, AWN); if (hl) hl.awn = ac; // 第 3 批
      B.quad('main', T.p(-w / 2, 2.95, 1.1), T.p(w / 2, 2.95, 1.1), T.p(w / 2, 3.25, 0), T.p(-w / 2, 3.25, 0), U.corr, ac);
      B.quad('main', T.p(-w / 2, 3.25, 0), T.p(w / 2, 3.25, 0), T.p(w / 2, 2.95, 1.1), T.p(-w / 2, 2.95, 1.1), WD, mul(ac, 0.55));
    }
    const pc = rnd() < 0.3 ? WHITE : cw, parU = pick(rnd, [U.par1, U.par2, U.par3]), ups = []; // ups：樓上每層的正面（b 陽台＋落地門、w 鐵窗）
    for (let f = 1; f < fl0; f++) { // 樓上：陽台或鐵窗
      if (f >= fl) { // 第 10 批：拿掉的樓層不蓋，亂數照下面一樣用掉
        if (rnd() < 0.5) { if (rnd() < 0.35) for (let k = 0; k < 4; k++) { rnd(); rnd(); } rnd(); } else { rnd(); rnd(); }
        continue;
      }
      const y = f * FH;
      if (rnd() < 0.5) {
        ups.push('b');
        if (hl) hl.flo.push({ f, t: 'b' }); // 第 3 批：陽台
        box('main', T, [-w / 2 + 0.1, y - 0.16, 0, w / 2 - 0.1, y, 1.05], band, { _: U.conc, ny: U.conc });
        box('main', T, [-w / 2 + 0.1, y, 0.93, w / 2 - 0.1, y + 1.0, 1.05], pc, { pz: parU, nz: parU, _: U.conc });
        box('main', T, [-w / 2 + 0.1, y, 0, -w / 2 + 0.22, y + 1.0, 0.93], pc, { _: U.conc }); box('main', T, [w / 2 - 0.22, y, 0, w / 2 - 0.1, y + 1.0, 0.93], pc, { _: U.conc });
        const dw = Math.min(3.2, w - 1.2); face('main', T, -dw / 2, dw / 2, y, y + 2.35, 0.02, U.slide);
        if (rnd() < 0.35) { // 曬衣服
          box('main', T, [-w / 2 + 0.3, y + 1.9, 0.55, w / 2 - 0.3, y + 1.94, 0.59], C('#c9ccd0'));
          for (let k = 0; k < 4; k++) { const cx = -w / 2 + 0.7 + k * (w - 1.4) / 4 + rnd() * 0.3; vquad('main', T, [cx - 0.25, 0.57], [cx + 0.25, 0.57], y + 1.2, y + 1.9, WD, pick(rnd, SCOOT.concat(HOUSE)), true); }
        }
        if (rnd() < 0.5) box('main', T, [w / 2 - 1.1, y, 0.25, w / 2 - 0.3, y + 0.55, 0.6], C('#efefeb'), { pz: U.ac, _: WD });
      } else {
        ups.push('w');
        const gw = Math.min(2.6, w - 1.3), wu = pick(rnd, [U.win1, U.win1, U.win2, U.win3]); if (hl) hl.flo.push({ f, t: 'w', gw }); // 第 3 批：鐵窗
        box('main', T, [-gw / 2, y + 0.85, 0, gw / 2, y + 2.45, 0.34], C('#6a6f76'), { pz: wu, py: WD, _: WD });
        box('main', T, [-gw / 2 - 0.1, y + 2.45, 0, gw / 2 + 0.1, y + 2.53, 0.46], C('#9aa0a6'));
        if (rnd() < 0.55) box('main', T, [gw / 2 - 0.85, y + 0.25, 0, gw / 2 - 0.05, y + 0.78, 0.32], C('#efefeb'), { pz: U.ac, _: WD });
      }
    }
    if (o.scooter || rnd() < 0.22) scooter(...(() => { const p = T.p((rnd() - 0.5) * (w - 2), 0, 0.8); return [p[0], p[2], ry + (rnd() < 0.5 ? 0 : Math.PI), rnd]; })());
    const c = T.p(0, 0, -D / 2), dp = T.p(door, 0, 0.6); addBox(c[0], c[2], w / 2, D / 2, ry, H);
    const biz = kind === 'shop' ? { name: SHOP_NAMES[o.shop % 3] } : kind === 'shutter' && o.vsign != null && fl >= 3 ? { sign: VSIGN_TEXT[o.vsign] } : {}; // 店名（橫招牌）、直立招牌的字（一樓做生意）：走進去的時候照這個擺
    buildings.push({ kind: kind === 'shop' ? 'shop' : 'house', ...biz, front: kind, x: c[0], z: c[2], hx: w / 2, hz: D / 2, rot: ry, h: H, floors: fl, up: ups, door: { x: dp[0], z: dp[2], ry } }); // door：大門外面一點（ry＝房子正面朝的方向）；front：一樓正面 shop 店面 | shutter 鐵捲門＋小門 | door 大門＋窗；up：二樓以上每層正面 b 陽台 | w 鐵窗
    if (hl) { hl.b = buildings[buildings.length - 1]; stHouses.push(hl); } // 第 3 批（hl.b：street.js 掛了招牌的，把店名寫進 V.buildings 那一筆的 name、streetSign）
    return H;
  };
  // 一排透天厝：沿著建築線從 a 到 b，面向 (nx, nz)（朝路）；前面 1.5 公尺水泥地（騎樓前）
  const row = (ax, az, bx, bz, nx, nz, seed, o = {}) => {
    const rnd = rng(seed), L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, ry = Math.atan2(nx, nz);
    let t = 0, i = 0;
    while (L - t >= 4) {
      let w = 4.3 + rnd() * 1.7; if (L - t - w < 4) w = L - t;
      if (w > 7) w = 5 + rnd();
      const cx = ax + ux * (t + w / 2), cz = az + uz * (t + w / 2), fl = rnd() < 0.2 ? 2 : rnd() < 0.62 ? 3 : 4;
      house(cx, cz, ry, w, o.D ?? 12.5, Math.min(fl, HOUSE_MAX_FL), rnd, { fl0: fl, shop: o.shops && o.shops[i] != null ? o.shops[i] : null, vsign: o.vsigns && o.vsigns[i] != null ? o.vsigns[i] : null });
      t += w; i++;
      if (o.gaps && rnd() < 0.13 && L - t > 12) { const gw = 3 + rnd() * 2.5, gx = ax + ux * (t + gw / 2), gz = az + uz * (t + gw / 2); tree(gx - nx * 3, gz - nz * 3, 0.9 + rnd() * 0.3, rnd); t += gw; }
    }
    const ap = o.apron ?? 1.5; addPave(ax + ux * L / 2 + nx * ap / 2, az + uz * L / 2 + nz * ap / 2, L / 2, ap / 2, ry, C('#d9d9d4'));
    stRows.push({ ax, az, bx, bz, nx, nz, ap, D: o.D ?? 12.5 }); // 第 3 批：騎樓前的走道（V.sidewalks）
  };

  // 停著的車（改車廠裡、後院的廢車）：本地 +x＝車頭；y0＝輪子底下的高度（舉升機上就高一點）
  const carProp = (x, y0, z, ry, col, o = {}) => {
    B.at(x, z); const T = frame(x, y0, z, ry), L = o.L ?? 4.4, W = o.W ?? 1.8, rust = o.rust, dk = C('#17181b');
    const body = rust ? mul(col, 0.9) : col, side = rust ? U.rust : U.carSide;
    box('main', T, [-L / 2, 0.32, -W / 2, L / 2, 1.0, W / 2], { py: body, _: body }, { pz: side, nz: flipU(side), px: rust ? U.rust : U.carFront, nx: rust ? U.rust : U.carBack, py: WD });
    box('main', T, [-L / 2 + 0.95, 1.0, -W / 2 + 0.1, L / 2 - 1.25, 1.42, W / 2 - 0.1], { py: body, _: rust ? C('#3a3530') : C('#26303a') }, { py: WD, _: WD });
    if (!o.noWheels) for (const wx of [-L / 2 + 0.78, L / 2 - 0.82]) for (const s of [1, -1]) tube('main', T.p(wx, 0.33, s * (W / 2 - 0.18)), T.p(wx, 0.33, s * (W / 2 + 0.02)), 0.33, 0.33, 8, dk, null, true);
    return T;
  };

  // ---- 村子中間那塊：四邊都是透天厝；中間一條往北的路（車庫門口直直出來到大路）----
  // 第 9 批（路變大）：每一排往後退（路寬多出來的一半：大路 2.25、12 公尺的路 2、10.5 公尺的路 1.75 公尺），騎樓前的水泥地一樣寬
  row(-269.75, -7.5, -293.75, -7.5, 0, 1, 101, { shops: [null, 0, null, null, 1], gaps: false }); // 大路西段北側（面向南）：新路東邊
  row(-306.25, -7.5, -325.25, -7.5, 0, 1, 112, { shops: [null, 2], gaps: false });              // 新路西邊
  row(-269.75, -65.25, -293.75, -65.25, 0, -1, 102, { gaps: false });                                 // 北邊的路南側（面向北）
  row(-306.25, -65.25, -325.25, -65.25, 0, -1, 113, { gaps: false });
  row(-293.25, -52, -293.25, -21, -1, 0, 114, { D: 11, apron: 1.0, vsigns: [null, 2], gaps: false }); // 車庫那條路（x −300）東側（面向西）
  row(-306.75, -37, -306.75, -52, 1, 0, 115, { D: 11, apron: 1.0, gaps: false });                 // 西側（面向東）
  row(-256.75, -15, -256.75, -65, 1, 0, 103, { shops: [2, null, null, null, 0], vsigns: [null, 3, null, 5], gaps: false }); // 廟口街西側（面向東）；路口那塊空著（樹）
  row(-338.25, -65, -338.25, -8, -1, 0, 104, { gaps: false });                                    // 西邊的路東側（面向西）
  tree(-264.5, -11, 1.05, rng(31)); tree(-242.5, 14.5, 1.1, rng(32)); // 廟口路口的兩個角
  // 外圍
  row(-243.25, -22, -243.25, -66, -1, 0, 105, { shops: [null, null, 1], vsigns: [4, null, null, 7], gaps: true }); // 廟口街東側（面向西）
  // 第 10 批：車庫西邊（面向南）那排透天厝拿掉了：越野車車庫搬到這裡（orbay.js PLACE）
  row(-284, -78.75, -256, -78.75, 0, 1, 107, { gaps: false });            // 車庫東邊
  row(-302, 7.5, -340, 7.5, 0, -1, 108, { vsigns: [6, null, null, 1], gaps: true }); // 大路西段南側（面向北）
  row(-220, -8.25, -184, -8.25, 0, 1, 109, { shops: [null, null, 0, null, null, 1], vsigns: [3], gaps: true }); // 大路北側（超商到改車廠）
  row(-237, 8.25, -196, 8.25, 0, -1, 110, { shops: [null, 2, null, null], vsigns: [null, null, null, 5, null, 7], gaps: true }); // 大路南側
  { // 中間的院子：菜園、幾棵樹、一小塊田
    const rnd = rng(111);
    for (const [x, z] of [[-282, -44], [-276, -28], [-272, -48]]) tree(x, z, 1.1 + rnd() * 0.3, rnd, false);
    addPave(-321.5, -45, 4.5, 6, 0, C('#8a7556')); // 菜園（土）
    for (let i = 0; i < 4; i++) { const z = -49.5 + i * 3; B.at(-321.5, z); box('main', frame(-321.5, 0, z), [-3.8, 0, -0.7, 3.8, 0.28, 0.7], C('#6b5a40')); for (let k = 0; k < 7; k++) blob('main', -325 + k * 1.1, 0.42, z, 0.42, 0.26, 0.42, mul(C('#6aa84f'), 0.85 + rnd() * 0.3), 0.3, 0, i * 10 + k); }
    paddyArea(-327, -35, -306, -21, 3, 1, rnd);
  }

  // ---- 你的車庫：這裡只有空地（白色大理石、鐵捲門的車庫是另外的模組，放在 places.garage.lot）；前面水泥地、兩邊花台，門口直直往南一條路到大路 ----
  const LOT = { x: -300, z: -97.5, heading: -Math.PI / 2 }; // 模組原點＝裡面停車位的車子中心；本地 +x 朝鐵捲門外（南）、本地 +z 朝西
  {
    const T = frame(LOT.x, 0, LOT.z, LOT.heading), T0 = frame(0, 0, 0); B.at(-300, -84);
    addPave(-300, -83.85, 14, 8.35, 0, C('#d2d2cd'));            // 前庭 x −314…−286、z −92.2…−75.5
    addPave(-300, -83.85, 7, 8.35, 0, C('#bcbdb9'), 0.024);       // 門前的車道（apron）深一點
    addPave(-300, -101.35, 16, 9.15, 0, null, 0, false);          // 車庫裡面（模組的地板）：算水泥地，不畫（第 11 批：車庫變寬，本來 13）
    for (const x of [-306.8, -293.2]) { B.at(x, -84); box('main', T0, [x - 0.12, 0.024, -91.8, x + 0.12, 0.03, -76], C('#8e8f8c')); } // 車道兩邊的排水溝蓋
    const rnd = rng(919);
    for (const s of [1, -1]) { // 兩邊花台（低低的，不擋視線）
      const x0 = s > 0 ? -291 : -313.5, x1 = s > 0 ? -286.5 : -309; B.at((x0 + x1) / 2, -85.5);
      // ==== 第 6 批：花台從 z −91…−80 縮成 −86…−80（6 公尺）：前庭往西留一條路到越野車車庫（orbay.js），兩邊一樣短，前庭看起來還是對稱的 ====
      box('main', T0, [x0, 0, -86, x1, 0.55, -80], C('#eceae4'), { _: U.conc }); box('main', T0, [x0 + 0.2, 0.55, -85.8, x1 - 0.2, 0.62, -80.2], C('#5d4a38'));
      for (let k = 0; k < 5; k++) shrub((x0 + x1) / 2 + (rnd() - 0.5) * 1.6, -85.4 + k * 1.15, 1.1, rnd);
      const t = (x0 + x1) / 2; tree(t, -83.2, 0.8, rnd, false); addBox(t, -83, (x1 - x0) / 2, 3, 0, 0.62);
    }
    for (const x of [-308.2, -291.8]) { B.at(x, -78.6); const t = frame(x, 0, -78.6); cyl('main', t, 0, 0, 0, 0.8, 0.1, 0.1, 6, C('#2a2c30'), null, false); cyl('glow', t, 0, 0, 0.8, 0.95, 0.1, 0.1, 6, [1.5, 1.5, 1.5], dotUV(GU.warm), true); addCircle(x, -78.6, 0.12, 1); } // 車道口的矮燈柱
    if (opts.garagePlaceholder) { // 測試用的假車庫殼：牆、6 公尺寬 3.8 公尺高的門洞、屋頂；碰撞跟真的模組差不多
      const wc = C('#f4f3ef'), trim = C('#9a9b9d'); B.at(-300, -101);
      floor('main', T, -12.7, -12.7, 5, 12.7, 0.03, dotUV(U.conc), C('#f7f6f2'));
      wall('main', T, [-13, 0, -13, -12.7, 5.5, 13], wc, { _: U.conc }); // 後牆
      for (const s of [1, -1]) wall('main', T, [-12.7, 0, s > 0 ? 12.7 : -13, 5.15, 5.5, s > 0 ? 13 : -12.7], wc, { _: U.conc });
      for (const s of [1, -1]) wall('main', T, [4.85, 0, s > 0 ? 3 : -12.7, 5.15, 5.5, s > 0 ? 12.7 : -3], wc, { _: U.conc }); // 前牆（門兩邊）
      box('main', T, [4.85, 3.8, -3, 5.15, 5.5, 3], wc, { _: U.conc }); box('main', T, [5.1, 3.55, -3.1, 5.35, 3.85, 3.1], trim); // 門上面、捲起來的鐵捲門
      box('main', T, [-13.1, 5.5, -13.1, 5.35, 5.8, 13.1], C('#dcdcd6'), { _: U.conc, ny: U.conc });
      for (const [x, z] of [[-8, -8], [-8, 8], [0, -8], [0, 8]]) ceil('glow', T, x - 1, z - 0.2, x + 1, z + 0.2, 5.48, dotUV(GU.cool), [1.2, 1.2, 1.2]);
    }
    buildings.push({ kind: 'garage', name: '你的車庫', x: -300, z: -101.35, hx: 9.15, hz: 16, rot: LOT.heading, h: 6, door: { x: -300, z: -91.6, ry: 0 } }); // 車庫模組的地（本地 x −13…5.3、z ±16；第 11 批：本來 ±13）：以後走進去、小地圖用
  }

  // ---- 阿輝改車廠：鐵皮工廠。前門開進去（中間的改車區），後門出去，從後院、東邊的小路回大路；裡面舉升機、工具牆、輪胎架、零件架、辦公室、日光燈 ----
  {
    const T = frame(-160, 0, -26, 0); B.at(-160, -35); // 本地＝世界 −(−160, −26)：牆 x −18…18、z −18…0（正面在 z 0 朝南）
    const wall1 = C('#9fb0c2'), wall2 = C('#dfe3e8'), inner = C('#e4e7ea'), steel = C('#3b4148'), yel = C('#f2c230');
    const IN = { pz: 'nz', nz: 'pz', px: 'nx', nx: 'px' };
    const wp = (x0, z0, x1, z1, y0, y1, out, col = true) => { // 一段牆：外面浪板（下半藍灰、上半淺灰）、裡面白色浪板
      for (const [a, b, c] of [[y0, Math.min(y1, 5), wall1], [Math.max(y0, 5), y1, wall2]]) if (b - a > 0.01) box('main', T, [x0, a, z0, x1, b, z1], { [out]: c, [IN[out]]: inner, _: mix(c, inner, 0.5) }, { _: U.corr });
      if (col) lbox(T, x0, z0, x1, z1, y1);
    };
    wp(-18, -0.25, -14.5, 0, 0, 7.4, 'pz'); wp(-8.5, -0.25, -3, 0, 0, 7.4, 'pz'); wp(3, -0.25, 18, 0, 0, 7.4, 'pz'); // 前牆：西邊的門（開著，展示舉升機）、中間的門（開進去）
    wp(-14.5, -0.25, -8.5, 0, 4.6, 7.4, 'pz', false); wp(-3, -0.25, 3, 0, 4.6, 7.4, 'pz', false);
    wp(-18, -18, -3, -17.75, 0, 7.4, 'nz'); wp(3, -18, 18, -17.75, 0, 7.4, 'nz'); wp(-3, -18, 3, -17.75, 4.6, 7.4, 'nz', false); // 後牆：中間後門
    wp(-18, -17.75, -17.75, -0.25, 0, 7.4, 'nx'); wp(17.75, -17.75, 18, -0.25, 0, 7.4, 'px'); // 兩邊
    for (const s of [1, -1]) { // 山牆（三角形）：外面、裡面
      const xo = s * 18, xi = s * 17.75, a = s > 0 ? 0 : -18, b = s > 0 ? -18 : 0;
      B.tri('main', T.p(xo, 7.4, a), T.p(xo, 7.4, b), T.p(xo, 8.8, -9), [U.corr[0], U.corr[1]], [U.corr[2], U.corr[1]], [(U.corr[0] + U.corr[2]) / 2, U.corr[3]], wall2);
      B.tri('main', T.p(xi, 7.4, b), T.p(xi, 7.4, a), T.p(xi, 8.8, -9), [U.corr[0], U.corr[1]], [U.corr[2], U.corr[1]], [(U.corr[0] + U.corr[2]) / 2, U.corr[3]], inner);
    }
    for (const [zA, zB, zr] of [[0.6, -9, 1], [-18.6, -9, -1]]) { // 屋頂（上面、下面）
      const a = T.p(zr > 0 ? -18.5 : 18.5, 7.3, zA), b = T.p(zr > 0 ? 18.5 : -18.5, 7.3, zA), c = T.p(zr > 0 ? 18.5 : -18.5, 8.8, zB), d = T.p(zr > 0 ? -18.5 : 18.5, 8.8, zB);
      B.quad('main', a, b, c, d, U.corr, C('#8d9aa8')); B.quad('main', b, a, d, c, U.corr, C('#6c7580'));
    }
    for (const x of [-12, -6, 0, 6, 12]) box('main', T, [x - 0.1, 6.95, -17.75, x + 0.1, 7.2, -0.25], steel, { ny: WD }); // 鋼樑
    for (const [x, open] of [[-11.5, true], [0, true], [11.5, false]]) { // 三個鐵捲門：兩個開著（捲在上面），東邊那個關著
      if (!open) face('main', T, x - 3, x + 3, 0, 4.6, 0.03, U.rdoor);
      box('main', T, [x - 3.25, 4.6, 0, x + 3.25, 4.9, 0.3], C('#50555c'));
      if (open) box('main', T, [x - 3.1, 4.62, -0.75, x + 3.1, 5.0, -0.28], C('#8f969e'), { ny: WD }); // 捲起來的門
    }
    box('main', T, [-3.1, 4.62, -17.7, 3.1, 5.0, -17.25], C('#8f969e'), { ny: WD }); // 後門上面（捲起來的門）
    box('sign', T, [-7.2, 5.15, 0, 7.2, 7.25, 0.2], { pz: WHITE, _: C('#121316') }, { pz: SU.shop, _: SW }); // 大招牌：阿輝改車廠
    box('main', T, [-18, 0, 0, -14.5, 0.25, 0.3], C('#50555c')); box('main', T, [-8.5, 0, 0, -3, 0.25, 0.3], C('#50555c')); box('main', T, [3, 0, 0, 18, 0.25, 0.3], C('#50555c'));
    B.quad('sign', T.p(-18.02, 1.3, -2), T.p(-18.02, 1.3, -14), T.p(-18.02, 4.6, -14), T.p(-18.02, 4.6, -2), SU.mural, WHITE); // 西邊牆上的大字（從村子開過來看得到）
    // 地板：綠灰色 Epoxy、黃線（中間開過去的車道、西邊的舉升機位）
    floor('main', T, -17.75, -17.75, 17.75, -0.25, 0.03, dotUV(U.conc), C('#8aa196')); addPave(-160, -35, 17.75, 8.75, 0, null, 0, false);
    for (const x of [-3.05, 3.05]) floor('main', T, x - 0.06, -17.6, x + 0.06, -0.4, 0.036, WD, yel);
    for (const [x0, z0, x1, z1] of [[-14.3, -15, -8.7, -14.88], [-14.3, -3.12, -8.7, -3], [-14.3, -15, -14.18, -3], [-8.82, -15, -8.7, -3]]) floor('main', T, x0, z0, x1, z1, 0.036, WD, yel);
    flat('decal', -160, -35, 0, -1, 11, 5.4, 0.05, DU.zone); // 改車區（停在這裡就打開改車廠）
    flat('decal', -171.5, -35, 0, -1, 4, 4, 0.052, DU.oil); flat('decal', -159, -31, 0, -1, 3, 3, 0.052, DU.oil);
    // 舉升機：中間（空的，手臂收在旁邊，上面一根橫樑：車子、鏡頭都過得去）、西邊（上面一台車舉起來）
    const LIFT = C('#c8322a');
    for (const [x0, x1, top] of [[-3.55, 3.55, true], [-14.15, -8.85, false]]) {
      for (const x of [x0, x1]) { box('main', T, [x - 0.18, 0, -9.3, x + 0.18, 3.95, -8.7], LIFT); box('main', T, [x - 0.3, 0, -9.45, x + 0.3, 0.12, -8.55], C('#2a2b2e')); const c = T.p(x, 0, -9); addBox(c[0], c[2], 0.3, 0.45, 0, 3.95); }
      if (top) box('main', T, [x0 - 0.18, 3.95, -9.25, x1 + 0.18, 4.25, -8.75], LIFT, { ny: WD });
      for (const x of [x0, x1]) for (const dz of [-1.1, 1.1]) { const s = x < (x0 + x1) / 2 ? 1 : -1; box('main', T, [Math.min(x, x + s * 0.9), top ? 0.08 : 1.62, -9 + dz - 0.08, Math.max(x, x + s * 0.9), top ? 0.16 : 1.72, -9 + dz + 0.08], C('#50555c')); }
    }
    carProp(-171.5, 1.72, -35, Math.PI / 2, C('#2f6fd6')); // 舉起來的藍色車（車頭朝北）
    carProp(-148.5, 0, -32, -Math.PI / 2, C('#f2f3f5')); const cc = T.p(11.5, 0, -6); addBox(cc[0], cc[2], 1, 2.3, 0, 1.5); // 東邊鐵捲門後面等著修的白車
    for (const [x, z] of [[-6.3, -6], [-6.3, -12], [6.3, -6], [6.3, -12]]) { box('main', T, [x - 0.18, 0, z - 0.18, x + 0.18, 6.95, z + 0.18], steel); const c = T.p(x, 0, z); addBox(c[0], c[2], 0.2, 0.2, 0, 7); } // 柱子
    // 西邊：工作台、洞洞板工具牆、空壓機
    box('main', T, [-17.75, 0, -15, -16.9, 0.88, -3], { py: C('#8a6a4a'), _: C('#5a5f66') }); lbox(T, -17.75, -15, -16.9, -3, 1);
    vquad('main', T, [-17.72, -3], [-17.72, -15], 1.1, 2.7, U.peg);
    box('main', T, [-17.2, 0, -1.6, -15.9, 0.6, -0.6], C('#2f6fd6')); cyl('main', frame(-176.5, 0.6, -27.1), 0, 0, 0, 0.9, 0.3, 0.3, 8, C('#2f6fd6'), null, true); lbox(T, -17.2, -1.6, -15.9, -0.6, 1.5);
    box('main', T, [-16.4, 0, -17.3, -15.2, 1.0, -16.3], C('#d0342c')); lbox(T, -16.4, -17.3, -15.2, -16.3, 1); // 紅色工具車
    // 東邊：輪胎架（後牆）、零件架（東牆）、辦公室（玻璃）、換胎機、平衡機
    box('main', T, [4, 0, -17.75, 11, 3.0, -16.95], { pz: WHITE, _: C('#2a2b2f') }, { pz: U.rack, _: WD }); lbox(T, 4, -17.75, 11, -16.95, 3);
    box('main', T, [16.95, 0, -11, 17.75, 2.6, -1.5], { nx: WHITE, _: C('#5c6167') }, { nx: U.shelf, _: WD }); lbox(T, 16.95, -11, 17.75, -1.5, 2.6);
    { const g0 = C('#3a3d42'); // 辦公室：x 12…17.75、z −17.75…−12，玻璃牆
      for (const [x, z] of [[12, -12], [12, -17.7], [15.6, -12], [17.7, -12]]) box('main', T, [x - 0.06, 0, z - 0.06, x + 0.06, 2.8, z + 0.06], g0);
      box('main', T, [12, 2.8, -17.75, 17.75, 3.0, -12], C('#f2f3f5'), { ny: WD });
      box('main', T, [12, 0, -12.06, 15.6, 0.9, -11.94], C('#d9dce0')); // 下面一截是板子
      vquad('glass', T, [12, -12], [15.5, -12], 0.9, 2.8, WD); vquad('glass', T, [12, -17.7], [12, -12], 0.9, 2.8, WD); box('main', T, [11.94, 0, -17.7, 12.06, 0.9, -12], C('#d9dce0'));
      box('main', T, [13.2, 0, -16.8, 15.8, 0.76, -15.6], { py: C('#8a6a4a'), _: C('#6b5a48') }); face('glow', T, 13.9, 14.9, 0.8, 1.4, -16.3, GU.tv); // 桌子、電腦
      lbox(T, 12, -17.75, 17.75, -12, 3);
    }
    box('main', T, [4.2, 0, -4.6, 5.3, 1.0, -3.4], C('#c8322a')); cyl('main', frame(-155.25, 1.0, -30), 0, 0, 0, 0.1, 0.45, 0.45, 10, C('#2a2b2e'), null, true); lbox(T, 4.2, -4.6, 5.3, -3.4, 1.1); // 換胎機
    box('main', T, [4.3, 0, -15.8, 5.2, 1.1, -14.9], C('#3b78c4')); lbox(T, 4.3, -15.8, 5.2, -14.9, 1.1); // 平衡機
    for (const [x, z, n] of [[8.6, -15.8, 5], [9.4, -15, 4], [-13.2, -16.5, 3]]) { const t = T.sub(x, 0, z); for (let k = 0; k < n; k++) cyl('main', t, 0, 0, k * 0.25, k * 0.25 + 0.23, 0.33, 0.33, 9, C('#1b1c1f'), null, true); const c = t.p(0, 0, 0); addCircle(c[0], c[2], 0.36, n * 0.25); } // 地上一疊輪胎
    // 燈：日光燈（三排），後牆上面的燈箱（阿輝改車廠）、出口燈
    for (const x of [-11.5, 0, 11.5]) for (const z of [-4, -9, -14]) { box('main', T, [x - 0.2, 5.55, z - 0.95, x + 0.2, 5.68, z + 0.95], C('#c9ccd0')); ceil('glow', T, x - 0.14, z - 0.9, x + 0.14, z + 0.9, 5.54, dotUV(GU.cool), [1.3, 1.3, 1.3]); }
    face('glow', T, -2.2, 2.2, 5.15, 6.35, -17.72, GU.shopHdr, [1.15, 1.15, 1.15]);
    face('glow', T, 3.4, 4.4, 3.7, 4.2, -17.72, GU.exitG);
    // 前庭：輪胎堆、油桶、旗子、輪胎招牌
    addPave(-156.5, -15.2, 24.5, 10.8, 0, C('#cfd0cc')); // x −181…−132、z −26…−4.4
    const rnd = rng(212);
    const tyres = (x, z, n) => { const t = frame(x, 0, z); for (let k = 0; k < n; k++) cyl('main', t, 0, 0, k * 0.25, k * 0.25 + 0.23, 0.33, 0.33, 9, C('#1b1c1f'), null, true); addCircle(x, z, 0.36, n * 0.25); };
    for (const [x, z, n] of [[-176, -22.5, 5], [-176.8, -21.6, 4], [-175.2, -21.4, 6], [-144, -22.6, 5], [-143.2, -21.7, 3], [-179.5, -24.5, 4]]) { B.at(x, z); tyres(x, z, n); }
    for (const [x, z, col] of [[-177.2, -12, '#d0342c'], [-176.4, -11.4, '#2f6fd6'], [-177.4, -10.6, '#f2c230']]) { B.at(x, z); const t = frame(x, 0, z); cyl('main', t, 0, 0, 0, 0.9, 0.3, 0.3, 10, C(col), null, true); cyl('main', t, 0, 0, 0.3, 0.36, 0.305, 0.305, 10, WHITE, null, false); addCircle(x, z, 0.32, 0.9); }
    ['flag0', 'flag1', 'flag2'].forEach((f, i) => { const x = -153 + i * 5.5, z = -7.75, t = frame(x, 0, z); B.at(x, z); cyl('main', t, 0, 0, 0, 3.8, 0.04, 0.04, 5, C('#c9ccd0'), null, true); vquad('sign', t, [0.05, 0], [0.75, 0], 0.9, 3.7, SU[f], WHITE, true); addCircle(x, z, 0.1, 3.8); });
    flat('decal', -166, -9, 0.6, -0.8, 5, 5, 0.052, DU.skid); flat('decal', -150, -21, 0, -1, 4, 4, 0.052, DU.oil);
    for (let i = 0; i < 3; i++) flat('decal', -150 + i * 3.5, -12 + rnd(), 0, 1, 3, 3, 0.051, DU.oil);
    flat('decal', -160, -19, 0, -1, 4.6, 1.3, 0.05, DU.arrU); flat('decal', -136, -16, 0, 1, 4.6, 1.3, 0.05, DU.arrU); // 前門進去、東邊小路出來（地上的箭頭）
    const lb = frame(-181.5, 0, -12, Math.PI / 2); B.at(-181.5, -12); // 輪胎招牌柱
    cyl('main', lb, 0, 0, 0, 4, 0.1, 0.1, 6, C('#50555c'), null, true); tube('main', lb.p(0, 4.4, -0.2), lb.p(0, 4.4, 0.2), 0.75, 0.75, 14, C('#16171a'), null, true); addCircle(-181.5, -12, 0.15, 4);
    // 後院（x −174…−128、z −72…−44）：出口的路（後門往北、往東、再沿著東邊的小路往南回大路）；兩邊擺廢車、輪胎、油桶；鐵絲網圍起來
    addPave(-151, -58, 23, 14, 0, C('#b4b4ae')); addPave(-136, -35, 4, 9, 0, C('#b4b4ae'));
    const fence = (x0, z0, x1, z1) => { // 鐵皮圍籬（藍色浪板，兩面都看得到）＋柱子，3 公尺一片
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 3)), ry = Math.atan2(-(z1 - z0), x1 - x0), t = frame((x0 + x1) / 2, 0, (z0 + z1) / 2, ry); B.at(t.x, t.z);
      for (let i = 0; i < n; i++) vquad('main', t, [-L / 2 + (L * i) / n, 0], [-L / 2 + (L * (i + 1)) / n, 0], 0.05, 2.2, U.corr, C('#5f86b8'), true);
      for (let i = 0; i <= n; i++) box('main', t, [-L / 2 + (L * i) / n - 0.05, 0, -0.08, -L / 2 + (L * i) / n + 0.05, 2.3, 0.08], C('#7d8288'));
      addBox((x0 + x1) / 2, (z0 + z1) / 2, L / 2, 0.1, ry, 2.2);
    };
    fence(-174, -72, -129, -72); fence(-174, -72, -174, -44.2); fence(-129, -72, -129, -27);
    const junk = rng(313);
    const jc = (x, z, ry, col, nw) => { const t = carProp(x, 0, z, ry, col, { rust: true, noWheels: nw }); const c = t.p(0, 0, 0); addBox(c[0], c[2], 2.25, 0.95, ry, 1.45); };
    jc(-169, -67.5, 0.25, C('#8d6a52'), true); jc(-168.5, -50, Math.PI / 2 + 0.1, C('#6f8a9a'), false); jc(-144, -68, -0.15, C('#a5a8a0'), true);
    for (const [x, z, n] of [[-172, -61, 4], [-171.2, -60.2, 5], [-133, -70, 6], [-132.2, -69.1, 3], [-131.4, -70.3, 5], [-151.5, -46.5, 4]]) { B.at(x, z); tyres(x, z, n); }
    for (const [x, z, col] of [[-156.5, -70.5, '#2f6fd6'], [-155.8, -69.9, '#2f6fd6'], [-146.5, -46.3, '#d0342c'], [-147.3, -47, '#3a3d42']]) { B.at(x, z); const t = frame(x, 0, z); cyl('main', t, 0, 0, 0, 0.9, 0.3, 0.3, 10, C(col), null, true); addCircle(x, z, 0.32, 0.9); }
    { B.at(-162, -70.4); const t = frame(-162, 0, -70.4, 0.08); box('main', t, [-1.2, 0, -0.55, 1.2, 0.72, 0.55], C('#8a6a4a')); box('main', t, [-1.1, 0.72, -0.5, 1.1, 1.3, 0.5], C('#4a4d52')); addBox(-162, -70.4, 1.2, 0.55, 0.08, 1.3); } // 棧板上的舊引擎
    flat('decal', -160, -50, 0, -1, 4.6, 1.3, 0.05, DU.arrU); flat('decal', -146, -57, 1, 0, 4.6, 1.3, 0.05, DU.arrU); flat('decal', -136, -44, 0, 1, 4.6, 1.3, 0.05, DU.arrU);
    flat('decal', -150, -62, 0, 1, 5, 5, 0.052, DU.oil); flat('decal', -165, -56, 1, 0, 4, 4, 0.052, DU.oil);
    buildings.push({ kind: 'shop', name: '阿輝改車廠', x: -160, z: -35, hx: 18, hz: 9, rot: 0, h: 8.8, door: { x: -160, z: -25, ry: 0 } });
  }

  // ---- 福德宮（廟）：紅牆、燕尾曲線屋頂、廟埕、大榕樹、香爐、金爐 ----
  const curvedRoof = (T, L, Dp, Dn, yE, yR, lift, colU, uvTop, nS = 10) => { // 屋脊沿本地 x，兩邊斜面往 ±z，屋簷和兩端往上翹
    const P = (s, t, side) => { const e = Math.abs(s) ** 4, D = side > 0 ? Dp : Dn; return T.p(s * (L / 2 + 0.7 * t * t), yE + (yR - yE) * Math.pow(1 - t, 1.5) + lift * e * (0.5 + 0.5 * t * t), side * D * t); };
    for (const side of [1, -1]) for (let i = 0; i < nS; i++) for (let j = 0; j < 4; j++) {
      const s0 = -1 + (2 * i) / nS, s1 = -1 + (2 * (i + 1)) / nS, t0 = j / 4, t1 = (j + 1) / 4, uv = [uvTop[0], uvTop[1] + (uvTop[3] - uvTop[1]) * (1 - t1), uvTop[2], uvTop[1] + (uvTop[3] - uvTop[1]) * (1 - t0)];
      const a = P(side > 0 ? s0 : s1, t1, side), b = P(side > 0 ? s1 : s0, t1, side), c = P(side > 0 ? s1 : s0, t0, side), d = P(side > 0 ? s0 : s1, t0, side);
      B.quad('main', a, b, c, d, uv, WHITE); B.quad('main', b, a, d, c, WD, colU);
    }
    for (const s of [1, -1]) B.tri('main', P(s, 0, 1), s > 0 ? P(s, 1, 1) : P(s, 1, -1), s > 0 ? P(s, 1, -1) : P(s, 1, 1), WD, WD, WD, C('#9a2019'));
    return P;
  };
  {
    const cx = -277, cz = 32, T = frame(cx, 0, cz, Math.PI); B.at(cx, cz); // 面向北（大路）
    const gran = C('#aaa498'), red = C('#b8241c'), gold = C('#d9a63a');
    box('main', T, [-8, 0, -6, 8, 0.45, 7.5], gran); box('main', T, [-2.6, 0, 7.5, 2.6, 0.28, 8.4], mul(gran, 1.05));
    box('main', T, [-6.2, 0.45, -4.8, 6.2, 4.7, 2.6], WHITE, { _: U.twall, py: WD });
    face('main', T, -1.9, 1.9, 0.45, 3.9, 2.62, U.tdoor); for (const x of [-3.9, 3.9]) face('main', T, x - 0.75, x + 0.75, 1.7, 3.2, 2.62, U.twin);
    box('sign', T, [-1.55, 3.98, 2.6, 1.55, 4.56, 2.75], { pz: WHITE, _: C('#1c2c4c') }, { pz: SU.temple, _: SW });
    for (const x of [-5.6, -2.9, 2.9, 5.6]) { cyl('main', T, x, 6.4, 0.45, 0.75, 0.36, 0.3, 8, gran, null, true); cyl('main', T, x, 6.4, 0.75, 4.75, 0.24, 0.24, 10, red, null, false); }
    box('main', T, [-6.7, 4.5, 6.05, 6.7, 4.78, 6.75], gold); box('main', T, [-6.7, 4.78, 6.05, 6.7, 4.98, 6.75], C('#2e8b57'));
    box('main', T, [-6.2, 4.7, 2.6, 6.2, 4.98, 6.05], C('#7d1812')); // 前廊天花板
    const RT = T.sub(0, 0, 0.9), P = curvedRoof(RT, 14.6, 6.5, 6.4, 4.8, 7.6, 1.15, C('#5a1a12'), U.troof, 12);
    let prev = null; for (let i = 0; i <= 12; i++) { const s = -1 + (2 * i) / 12, p = P(s, 0, 1); const q = [p[0], p[1] + 0.2, p[2]]; if (prev) tube('main', prev, q, 0.24, 0.24, 4, WHITE, U.ridge); prev = q; }
    for (const s of [1, -1]) { // 燕尾
      const e = P(s, 0, 1), base = [e[0], e[1] + 0.2, e[2]], ox = RT.p(s * 9.4, 0, 0), dir = [ox[0] - RT.x, 0, ox[2] - RT.z], dl = Math.hypot(dir[0], dir[2]), ux = dir[0] / dl, uz = dir[2] / dl;
      const mid = [base[0] + ux * 0.9, base[1] + 0.75, base[2] + uz * 0.9]; tube('main', base, mid, 0.22, 0.17, 4, C('#b8261c'));
      for (const zz of [0.38, -0.38]) { const side = RT.p(0, 0, zz), sx = side[0] - RT.x, sz = side[2] - RT.z; tube('main', mid, [mid[0] + ux * 0.8 + sx, mid[1] + 0.9, mid[2] + uz * 0.8 + sz], 0.16, 0.03, 4, C('#b8261c')); }
    }
    const top = P(0, 0, 1); blob('main', top[0], top[1] + 0.95, top[2], 0.38, 0.38, 0.38, C('#ff5a2a'), 0.05, 0, 3); cyl('main', frame(top[0], top[1] + 0.2, top[2]), 0, 0, 0, 0.6, 0.22, 0.15, 6, gold, null, true); // 屋脊中間的寶珠
    for (const s of [1, -1]) { const a = RT.p(s * 0.6, 0, 0), b = RT.p(s * 2.6, 0, 0); tube('main', [a[0], top[1] + 0.45, a[2]], [b[0], top[1] + 1.25, b[2]], 0.2, 0.07, 5, C('#2e9a5c')); }
    for (const x of [-4.25, -2.2, 2.2, 4.25]) { const p = T.p(x, 3.35, 6.4); blob('main', p[0], p[1], p[2], 0.34, 0.44, 0.34, C('#e0261a'), 0.02, 1, x | 0, 0.05); cyl('main', frame(p[0], p[1] + 0.4, p[2]), 0, 0, 0, 0.3, 0.14, 0.14, 6, gold, null, true); cyl('main', frame(p[0], p[1] - 0.58, p[2]), 0, 0, 0, 0.16, 0.12, 0.12, 6, gold, null, true); cyl('main', frame(p[0], p[1] + 0.7, p[2]), 0, 0, 0, 4.5 - p[1] - 0.7, 0.025, 0.025, 3, C('#3a2a1a'), null, false); }
    for (const x of [-2.3, 2.3]) { const L0 = T.sub(x, 0, 9.0); box('main', L0, [-0.45, 0, -0.45, 0.45, 0.7, 0.45], gran); box('main', L0, [-0.32, 0.7, -0.4, 0.32, 1.35, 0.36], C('#9d988e')); box('main', L0, [-0.3, 1.2, 0.05, 0.3, 1.7, 0.55], C('#a6a196')); const c = L0.p(0, 0, 0); addCircle(c[0], c[2], 0.55, 1.7); }
    { const I = T.sub(0, 0, 13.5), bronze = C('#8d6a36'); box('main', I, [-0.6, 0, -0.6, 0.6, 0.55, 0.6], gran); cyl('main', I, 0, 0, 0.55, 1.35, 0.55, 0.72, 12, bronze, null, true); cyl('main', I, 0, 0, 1.35, 1.9, 0.5, 0.08, 8, mul(bronze, 1.15), null, false); for (const s of [1, -1]) box('main', I, [s * 0.75 - 0.06, 1.1, -0.08, s * 0.75 + 0.06, 1.55, 0.08], gold); const c = I.p(0, 0, 0); addCircle(c[0], c[2], 0.8, 2); }
    { const F = T.sub(9.8, 0, 4.2); box('main', F, [-0.8, 0, -0.8, 0.8, 1.7, 0.8], C('#b8241c')); face('main', F, -0.35, 0.35, 0.5, 1.2, 0.81, WD, C('#241a16')); box('main', F, [-0.6, 1.7, -0.6, 0.6, 2.5, 0.6], C('#c7362a')); curvedRoof(F.sub(0, 0, 0), 1.6, 0.95, 0.95, 2.55, 3.15, 0.25, C('#5a1a12'), U.troof, 4); cyl('main', F, 0, 0, 3.0, 3.8, 0.14, 0.08, 6, gold, null, true); const c = F.p(0, 0, 0); addBox(c[0], c[2], 0.8, 0.8, Math.PI, 3); }
    const c = T.p(0, 0, 0.75), dp = T.p(0, 0, 3.3); addBox(c[0], c[2], 8, 6.75, Math.PI, 8); buildings.push({ kind: 'temple', name: '福德宮', x: c[0], z: c[2], hx: 8, hz: 6.75, rot: Math.PI, h: 8, door: { x: dp[0], z: dp[2], ry: Math.PI } });
    addPave(-277, 14.6, 21, 9.3, 0, C('#e3dccf')); // 廟埕
    flat('decal', -290, 12.5, 1, 0, 9, 5.5, 0.05, DU.rice); // 曬穀
    banyan(-265, 19);
    const rnd = rng(313); for (const [x, z] of [[-292, 45], [-280, 47], [-266, 44], [-296, 30], [-258, 33]]) tree(x, z, 1.2 + rnd() * 0.3, rnd);
  }

  // ---- 村口超商 ----
  {
    const T = frame(-231.5, 0, -8.25, 0); B.at(-231.5, -8.25); // 第 9 批：大路變寬，超商往後退 2.25 公尺
    box('main', T, [-9, 0, -13, 9, 4.2, 0], C('#f4f4f2'), { _: U.conc });
    face('glow', T, -8.4, 8.4, 0, 3.0, 0.03, GU.store, [1.05, 1.05, 1.05]);
    face('main', T, -9, 9, 3.05, 3.6, 0.03, U.band);
    box('glow', T, [-9.1, 4.2, -0.4, 9.1, 5.2, 0.15], [1.05, 1.05, 1.05], { pz: GU.storeSign, _: dotUV(GU.white) });
    B.quad('main', T.p(-9.02, 3.05, 0), T.p(-9.02, 3.05, -13), T.p(-9.02, 3.6, -13), T.p(-9.02, 3.6, 0), U.band, WHITE);
    for (const [x, z, cl] of [[-7.5, 1.0, '#2f78c8'], [-6.8, 1.0, '#43b36b']]) { cyl('main', T, x, z, 0, 0.95, 0.28, 0.28, 8, C(cl), null, true); const c = T.p(x, 0, z); addCircle(c[0], c[2], 0.3, 1); }
    box('main', T, [5.2, 0, 0.6, 7.6, 0.45, 1.1], C('#8a6a4a')); const bc = T.p(6.4, 0, 0.85); addBox(bc[0], bc[2], 1.2, 0.25, 0, 0.5); // 長椅
    const rnd = rng(414); scooter(...T.p(3.6, 0, 1.1).filter((_, i) => i !== 1), 0, rnd); scooter(...T.p(2.5, 0, 1.2).filter((_, i) => i !== 1), 0.1, rnd);
    for (const [x, cl] of [[-3.4, '#1e7b45'], [-2.7, '#c8281e']]) { const p = T.p(x, 0, 1.1); B.at(p[0], p[2]); const t = frame(p[0], 0, p[2]); box('main', t, [-0.28, 0, -0.25, 0.28, 1.05, 0.25], C(cl)); cyl('main', t, 0, 0, 1.05, 1.2, 0.3, 0.2, 8, C(cl), null, true); addCircle(p[0], p[2], 0.32, 1.2); } // 郵筒（綠、紅）
    const c = T.p(0, 0, -6.5); addBox(c[0], c[2], 9, 6.5, 0, 5); buildings.push({ kind: 'store', name: '村口超商', x: c[0], z: c[2], hx: 9, hz: 6.5, rot: 0, h: 5.2, door: { x: -231.5, z: -7.65, ry: 0 } });
  }

  // ---- 三合院（農家，紅磚紅瓦）----
  {
    const T = frame(-330, 0, 58, Math.PI); B.at(-330, 58); const brick = C('#ffffff');
    box('main', T, [-9, 0, -3, 9, 3.4, 3], brick, { _: U.brick, py: WD });
    for (const s of [1, -1]) box('main', T, [s > 0 ? 6 : -9, 0, 3, s > 0 ? 9 : -6, 3.0, 13], brick, { _: U.brick, py: WD });
    face('main', T, -1, 1, 0, 2.5, 3.02, U.door); for (const x of [-5, 5]) face('main', T, x - 0.8, x + 0.8, 1.0, 2.3, 3.02, U.win3);
    curvedRoof(T.sub(0, 0, 0), 19, 3.8, 3.8, 3.3, 5.0, 0.25, C('#4a1c12'), U.froof, 8);
    for (const s of [1, -1]) curvedRoof(T.sub(s * 7.5, 0, 8, Math.PI / 2), 11, 2.4, 2.4, 2.95, 4.2, 0.15, C('#4a1c12'), U.froof, 6);
    addBox(-330, 58, 9, 3, Math.PI, 5); for (const s of [1, -1]) { const c = T.p(s * 7.5, 0, 8); addBox(c[0], c[2], 1.5, 5, Math.PI, 4); }
    buildings.push({ kind: 'farmhouse', name: '三合院', x: -330, z: 58, hx: 9, hz: 3, rot: Math.PI, h: 5, door: { x: -330, z: 54.4, ry: Math.PI } });
    addPave(-330, 50, 6, 5, 0, C('#cbb8a0'));
    const rnd = rng(515); for (const [x, z] of [[-346, 62], [-316, 66], [-338, 72]]) tree(x, z, 1.1 + rnd() * 0.3, rnd);
  }

  // ---- 賽道入口：拱門、紅白護欄、旗子、看板 ----
  {
    const T = frame(-70, 0, 0, 0); B.at(-70, 0);
    for (const s of [1, -1]) { box('main', T, [-0.45, 0, s * 7.5 - 0.45, 0.45, 7.2, s * 7.5 + 0.45], C('#1b1d21')); box('glow', T, [-0.47, 1.0, s * 7.5 - 0.47, 0.47, 1.25, s * 7.5 + 0.47], [1.6, 1.6, 1.6], { _: dotUV(GU.led) }); addBox(-70, s * 7.5, 0.45, 0.45, 0, 7.2); }
    box('sign', T, [-0.3, 5.3, -8, 0.3, 6.8, 8], { nx: WHITE, _: C('#121316') }, { nx: SU.arch, px: false, _: SW });
    B.quad('sign', T.p(0.31, 5.3, 8), T.p(0.31, 5.3, -8), T.p(0.31, 6.8, -8), T.p(0.31, 6.8, 8), subUV(SU.white, 0, 0, 1, 1), C('#121316'));
    vquad('sign', T, [0.33, 3], [0.33, -3], 5.4, 6.7, SU.archB); // 背面（從賽道回村子看到）：回村子（從 +x 看，左邊是 +z）
    for (const s of [1, -1]) { const t = T.sub(0, 7.2, s * 7.5); cyl('main', t, 0, 0, 0, 2.4, 0.04, 0.04, 5, C('#c9ccd0'), null, true); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) vquad('main', t, [-0.05 - i * 0.3 - 0.3, 0], [-0.05 - i * 0.3, 0], 1.4 + j * 0.3, 1.7 + j * 0.3, WD, (i + j) % 2 ? C('#141414') : C('#f2f3f5'), true); }
    const bar = (x0, z0, x1, z1) => { // 紅白水泥護欄（一段一段，4 公尺一節）
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 4)), ry = Math.atan2(-(z1 - z0), x1 - x0);
      for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, t = frame(x0 + (x1 - x0) * (t0 + t1) / 2, 0, z0 + (z1 - z0) * (t0 + t1) / 2, ry); B.at(t.x, t.z); box('main', t, [-L / n / 2, 0, -0.2, L / n / 2, 0.9, 0.2], WHITE, { _: U.barrier }); }
      addBox((x0 + x1) / 2, (z0 + z1) / 2, L / 2, 0.2, ry, 0.9);
    };
    for (const s of [1, -1]) { bar(-60.3, s * 6.3, -88, s * 6.5); bar(-88, s * 6.5, -99, s * 9.6); }
    const fence = (x, z0, z1) => { // 賽道外面的圍籬（紅白欄杆）
      const n = Math.round(Math.abs(z1 - z0) / 3);
      for (let i = 0; i <= n; i++) { const z = z0 + ((z1 - z0) * i) / n; B.at(x, z); cyl('main', frame(x, 0, z), 0, 0, 0, 1.3, 0.05, 0.05, 4, C('#e8e9eb'), null, true); }
      for (let i = 0; i < n; i++) { const za = z0 + ((z1 - z0) * i) / n, zb = z0 + ((z1 - z0) * (i + 1)) / n, t = frame(x, 0, (za + zb) / 2, Math.PI / 2); B.at(x, (za + zb) / 2); for (const y of [0.55, 1.1]) box('main', t, [-Math.abs(zb - za) / 2, y, -0.03, Math.abs(zb - za) / 2, y + 0.12, 0.03], WHITE, { _: U.fence }); }
      addBox(x, (z0 + z1) / 2, 0.2, Math.abs(z1 - z0) / 2, 0, 1.3);
    };
    fence(-61.8, 6.6, 92); fence(-61.8, -6.6, -110);
    const rnd = rng(616);
    for (let i = 0; i < 6; i++) for (const s of [1, -1]) { // 三角旗
      const x = -100 + i * 6, z = s * (s > 0 ? 11.5 : 11.5), t = frame(x, 0, z, Math.PI / 2); B.at(x, z); cyl('main', t, 0, 0, 0, 5.2, 0.045, 0.045, 5, C('#dfe2e6'), null, true);
      B.tri('main', t.p(0.05, 5.1, 0), t.p(1.3, 4.75, 0), t.p(0.05, 4.4, 0), WD, WD, WD, pick(rnd, [C('#FF6A1F'), C('#f2f3f5'), C('#16181c')])); B.tri('main', t.p(0.05, 4.4, 0), t.p(1.3, 4.75, 0), t.p(0.05, 5.1, 0), WD, WD, WD, C('#c9582a')); addCircle(x, z, 0.1, 5);
    }
    { const t = frame(-96, 0, -21, -0.45); B.at(-96, -21); for (const x of [-3.2, 3.2]) cyl('main', t, x, 0, 0, 3.2, 0.12, 0.12, 6, C('#50555c'), null, true); box('sign', t, [-4.2, 3.0, -0.12, 4.2, 6.2, 0.12], { pz: WHITE, _: C('#16181c') }, { pz: SU.bill, _: SW }); const c = t.p(0, 0, 0); addBox(c[0], c[2], 3.4, 0.2, -0.45, 6.2); }
    flat('decal', -80, -2.4, 1, 0, 14, 3, 0.05, DU.skid); flat('decal', -72, 2.3, 1, 0, 10, 3, 0.05, DU.skid);
    for (let i = 0; i < 5; i++) { const x = -94 + i * 1.3; B.at(x, 9.9); const t = frame(x, 0, 9.9); for (let k = 0; k < 3; k++) cyl('main', t, 0, 0, k * 0.25, k * 0.25 + 0.23, 0.33, 0.33, 9, (i + k) % 2 ? C('#d0342c') : C('#f2f3f5'), null, true); } addBox(-91.4, 9.9, 3.2, 0.35, 0, 0.75);
  }

  // ---- 稻田 ----
  { const rnd = rng(717);
    paddyArea(-126, -104, -68, -9, 3, 4, rnd);    // 大路北邊（往賽道那段）：改車廠出口的小路東邊
    paddyArea(-106, 9, -68, 31, 2, 1, rnd);       // 大路南邊、農路東邊（中間 z 31–58 是檳榔園）
    paddyArea(-106, 59, -68, 88, 2, 1, rnd);
    { for (let i = 0; i < 12; i++) rnd(); const r2 = rng(7171); paddyArea(-194, 9, -172, 52, 1, 2, r2); paddyArea(-152, 9, -118, 52, 2, 2, r2); paddyArea(-172, 30, -152, 52, 1, 1, r2); } // 第 3 批：中間空出來給槍店（亂數照樣用掉 12 個，後面的田不變）
    paddyArea(-244, 22, -196, 52, 2, 1, rnd);
    paddyArea(-244, 64, -118, 88, 5, 1, rnd);     // 農路南邊
    paddyArea(-386, -92, -352, -8, 2, 3, rnd);    // 村子西邊（大路北側）
    for (let i = 0; i < 4; i++) rnd();            // 第 3 批：西邊（大路南側）的田改成警察局（亂數照樣用掉，後面的田不變）
    paddyArea(-296, 64, -250, 88, 2, 1, rnd);
    paddyArea(-386, 34, -352, 88, 2, 2, rnd);
    paddyArea(-282, -108, -232, -92, 2, 1, rnd);  // 車庫東北邊
    paddyArea(-386, -110, -344, -94, 2, 1, rnd);
    paddyArea(-176, -106, -130, -76, 2, 1, rnd);  // 改車廠後院北邊
    paddyArea(-512, -108, -398, -56, 5, 2, rnd);  // 車店後面
    paddyArea(-512, 24, -395, 88, 4, 2, rnd);     // 往快速道路那段的南邊
  }

  // ---- 樹、竹子、檳榔樹 ----
  { const rnd = rng(818);
    for (let x = -229.5; x <= -198; x += 6.5) for (let z = -100; z <= -30; z += 7) tree(x + (rnd() - 0.5) * 1.5, z + (rnd() - 0.5) * 1.5, 0.75 + rnd() * 0.2, rnd); // 果園
    for (let x = -236; x <= -126; x += 7 + rnd() * 3) palm(x, 63.5 + rnd() * 1.5, 7.5 + rnd() * 3, rnd);     // 農路南邊一排檳榔樹
    for (let z = 10; z <= 50; z += 6.5 + rnd() * 2) palm(-105.5 - rnd() * 1.5, z, 7 + rnd() * 3, rnd);        // 農路東邊
    for (let i = 0; i < 22; i++) palm(-90 + (i % 5) * 4.2 + rnd(), 36 + ((i / 5) | 0) * 4.5 + rnd(), 7 + rnd() * 4, rnd); // 檳榔園
    for (let i = 0; i < 16; i++) palm(-214 + (i % 4) * 4 + rnd(), 72 + ((i / 4) | 0) * 4 + rnd(), 7 + rnd() * 3, rnd);
    for (let x = -124; x <= -80; x += 9 + rnd() * 3) palm(x, -10.5 - rnd() * 1.5, 7 + rnd() * 3, rnd);         // 往賽道的路邊（改車廠出口的東邊開始）
    for (let x = -186; x <= -120; x += 10 + rnd() * 4) { const gs = x > -168 && x < -155; if (gs) B = new Builder(200); palm(x, 8.5 + rnd(), 6.5 + rnd() * 3, rnd, !gs); B = VB; } // 第 3 批：槍店門口那棵不種（亂數照樣用掉）
    for (let z = -100; z <= 84; z += 9 + rnd() * 3) { if (Math.abs(z) < 14) continue; bamboo(-389 + rnd() * 2, z, rnd); } // 西邊竹林（大路穿過去）
    for (let x = -505; x <= -66; x += 6 + rnd() * 3) { if (x > -320 && x < -280) continue; tree(x, -112 + rnd() * 2, 1.2 + rnd() * 0.4, rnd); } // 北邊一排樹（車庫後面空著）
    for (let x = -505; x <= -66; x += 6 + rnd() * 3) { const g4 = x > -121 && x < -103; if (g4) B = new Builder(200); tree(x, 91 + rnd() * 2, 1.2 + rnd() * 0.4, rnd, !g4); B = VB; } // 南邊一排樹 // ==== 第 4 批：往越野車場的水泥路穿過去的那兩棵不種（亂數照樣用掉）====
    // 第 2 批（路上的車）：農路邊的兩棵原本種在路面上（(-248.5, 30) 在往北的車道正中間、(-244, 60) 樹幹壓到轉角的路邊）→ 移到路邊的草地上（離路 2 公尺以上、不在稻田裡；亂數照樣用）
    for (const [x, z] of [[-352, -8], [-351, 12], [-255.5, 27], [-228, 30], [-192, -20], [-196, 40], [-245, 64.5], [-192, -48], [-186, -62], [-194, -80]]) tree(x, z, 1 + rnd() * 0.3, rnd);
    for (const [x, z] of [[-396, -12], [-396, -30], [-395, -46], [-418, -52], [-426, -46], [-424, -34], [-406, 14], [-398, 18], [-476, 14], [-488, 16], [-500, 12], [-510, 18], [-509, -40], [-510, -22]]) tree(x, z, 1 + rnd() * 0.35, rnd); // 車店、往快速道路那段的空地
  }

  // ---- 電線桿（每條路一排）、路口反光鏡 ----
  // 第 9 批（路變大）：電線桿跟著路邊往外移（大路 2.25、12 公尺的路 2、10.5 公尺的路 1.75、農路 1.5 公尺）
  poleLine([[-235, 7.45, 0, -1], [-212, 7.45, 0, -1], [-184, 7.45, 0, -1], [-156, 7.65, 0, -1], [-128, 7.85, 0, -1], [-100, 8.2, 0, -1], [-78, 8.2, 0, -1]]);
  poleLine([[-262, -6.8, 0, 1], [-290, -6.8, 0, 1], [-318, -6.8, 0, 1], [-336.5, -6.8, 0, 1]]);
  poleLine([[-244.05, -62, -1, 0], [-244.05, -44, -1, 0], [-244.05, -24, -1, 0]]);
  // 第 10 批：越野車車庫的門前（x −338.5…−329.5）不要有電線桿：拿掉 x −336.5 那根，反光鏡往西挪到 −340.6
  poleLine([[-318, -78.15, 0, 1], [-280, -78.15, 0, 1], [-260, -78.15, 0, 1]]);
  poleLine([[-351.25, -52, 1, 0], [-351.25, -26, 1, 0], [-351.25, -8.2, 1, 0]]);
  poleLine([[-255.5, 22, 1, 0], [-255.5, 46, 1, 0], [-236, 63.5, 0, -1], [-208, 63.5, 0, -1], [-180, 63.5, 0, -1], [-152, 63.5, 0, -1], [-124, 63.5, 0, -1], [-106.5, 44, -1, 0], [-106.5, 20, -1, 0]]);
  poleLine([[-358, 7.55, 0, -1], [-386, 7.55, 0, -1], [-414, 7.55, 0, -1], [-442, 7.55, 0, -1], [-470, 7.55, 0, -1], [-500, 7.55, 0, -1]]); // 往快速道路那段（南側）
  mirrorPole(-241.85, -7.75, -250, 0); mirrorPole(-256.25, -77.95, -252, -70); mirrorPole(-340.6, -77.75, -343, -70); mirrorPole(-288.6, -78.05, -300, -72); mirrorPole(-293.85, -7.1, -300, 0);

  // ---- 地上的字：路口前的「慢」、廟口的斑馬線 ----
  const approach = (node, r) => { // 從路 r 開向 node：最後一段的方向、在 node 前 d 公尺的點
    const pts = walk(r, r.a === node ? r.b : r.a), n = pts.length;
    const at = (d) => { let rest = d; for (let i = n - 1; i > 0; i--) { const [bx, bz] = pts[i], [ax, az] = pts[i - 1], l = Math.hypot(bx - ax, bz - az); if (rest <= l) { const t = rest / l; return { x: bx + (ax - bx) * t, z: bz + (az - bz) * t, dx: (bx - ax) / l, dz: (bz - az) / l }; } rest -= l; } const [bx, bz] = pts[1], [ax, az] = pts[0], l = Math.hypot(bx - ax, bz - az); return { x: ax, z: az, dx: (bx - ax) / l, dz: (bz - az) / l }; };
    return at;
  };
  const NOSLOW = new Set(['DEN', 'DEX', 'SHX', 'HJ', 'HO', 'HI']); // 車店、改車廠的出入口不畫「慢」
  for (const k of Object.keys(NODES)) {
    if ((deg[k] || 0) < 3 || NOSLOW.has(k)) continue;
    for (const e of adjIn[k] || []) {
      const r = e.r; if (r.kind === 'strip' || r.kind === 'drive' || r.kind === 'link' || r.len < 30) continue;
      const at = approach(k, r), p = at(17), hw = (Array.isArray(r.w) ? 13.5 : r.w) / 2;
      flat('decal', p.x - p.dz * hw * 0.5, p.z + p.dx * hw * 0.5, p.dx, p.dz, 3.4, 1.6, 0.05, DU.slow);
      if (k === 'C') { const q = at(8.4); flat('decal', q.x, q.z, p.dx, p.dz, 3, hw * 2 - 0.6, 0.05, DU.zebra); }
    }
  }
  { const rnd = rng(919); for (let i = 0; i < 16; i++) { const s = roadSegs[(rnd() * roadSegs.length) | 0]; if (s.r.kind === 'drive') continue; const t = 0.2 + rnd() * 0.6; flat('decal', s.ax + (s.bx - s.ax) * t, s.az + (s.bz - s.az) * t, 1, 0, 0.9, 0.9, 0.05, DU.manhole); } }

  // ---- 路標：每個路口前面（右手邊），五個地方各往哪邊；一根柱子、牌子伸到路上面（台灣鄉下常見的懸臂式）----
  const guide = (x, z, dx, dz, rows) => { // (x, z)＝柱子（路邊）；(dx, dz)＝車子開過來的方向；牌子面向車子、往左邊（路中間）伸出去
    const q = rows.length > 5 ? 0.86 : 1, rh = 0.56 * q; // ==== 第 3 批：多了警察局、槍店：六列以上小一點 ====
    const ry = Math.atan2(-dx, -dz), T = frame(x, 0, z, ry), h = rows.length * rh + 0.16, y0 = 2.9; B.at(x, z);
    cyl('main', T, 0, -0.25, 0, y0 + h + 0.1, 0.09, 0.08, 6, C('#9aa0a6'), null, true);
    box('main', T, [-2.2 * q, y0 + h - 0.12, -0.2, 0.05, y0 + h - 0.04, -0.13], C('#8d9197')); box('main', T, [-2.2 * q, y0 + 0.1, -0.2, 0.05, y0 + 0.18, -0.13], C('#8d9197')); // 兩根橫桿
    box('sign', T, [0.15 - 2.9 * q, y0, -0.12, 0.15, y0 + h, -0.02], C('#e9ecef'), { pz: SW, _: SW });
    rows.forEach((k, i) => face('sign', T, 0.08 - 2.76 * q, 0.08, y0 + h - 0.08 - (i + 1) * rh + 0.04, y0 + h - 0.08 - i * rh, -0.015, SU['g_' + k]));
    addCircle(x, z, 0.15, y0 + h);
  };
  const GUIDE = new Set(['C', 'X', 'W', 'G', 'E1', 'SH']);
  const DRIVE_SIGN = { G: [-308.6, -79.6], SHX: [-140.3, -10], DEX: [-501.4, -9] }; // 從車庫、改車廠、車店開出來：前面右手邊的路標
  const SIGN_AT = { 'X<C': 16, 'G<C': 14 }; // 這幾個路標往後挪（前面有電線桿、反光鏡）
  const dirOf = (fx, fz, hx, hz) => { const dot = fx * hx + fz * hz, cr = fx * hz - fz * hx; return dot > 0.72 ? 'U' : cr > 0 ? 'R' : 'L'; };
  const DESTS = ['track', 'shop', 'garage', 'dealer', 'highway', 'police', 'gunshop']; // 第 3 批：＋警察局、槍店
  for (const k of Object.keys(NODES)) {
    const own = DRIVE_SIGN[k]; if (!GUIDE.has(k) && !own) continue;
    for (const eIn of adjIn[k] || []) {
      const rIn = eIn.r; if (rIn.kind === 'strip' || rIn.kind === 'link') continue;
      if (rIn.kind === 'drive' ? !own : !GUIDE.has(k)) continue;
      const at = approach(k, rIn), d = SIGN_AT[k + '<' + eIn.from] ?? Math.min(11, rIn.len * 0.55), p = at(d), fin = at(0.01);
      const rows = [];
      for (const dest of DESTS) {
        const t = DEST_NODE[dest]; if (t === k) { rows.push(dest + '_U'); continue; }
        if (rIn.kind === 'drive' && (APSP[eIn.from][t] ?? 1e9) < 10) continue; // 剛從那裡開出來（車庫、改車廠、車店）：不用再指回去
        let best = null; for (const e of adjOut[k] || []) { const cost = e.r.len + (APSP[e.to][t] ?? 1e9); if (!best || cost < best.cost) best = { e, cost }; }
        if (!best || best.cost >= 1e9 || best.e.r === rIn) continue;
        const w = walk(best.e.r, k), hx = w[1][0] - w[0][0], hz = w[1][1] - w[0][1], hl = Math.hypot(hx, hz);
        rows.push(dest + '_' + dirOf(fin.dx, fin.dz, hx / hl, hz / hl));
      }
      if (!rows.length) continue;
      const off = (Array.isArray(rIn.w) ? 13.5 : rIn.w) / 2 + 0.6;
      if (rIn.kind === 'drive') guide(own[0], own[1], p.dx, p.dz, rows); else guide(p.x - p.dz * off, p.z + p.dx * off, p.dx, p.dz, rows);
    }
  }
  { // 慢、限速牌（村子入口）
    for (const [x, z, ry, u] of [[-190, 7.85, -Math.PI / 2, 'limit'], [-255.95, -26, Math.PI, 'slow']]) { const T = frame(x, 0, z, ry); B.at(x, z); cyl('main', T, 0, -0.06, 0, 2.6, 0.045, 0.045, 5, C('#9aa0a6'), null, true); signPoly(T, SU[u], 96, 96, u === 'limit' ? circ(48, 48, 44, 16) : [[4, 6], [92, 6], [48, 92]], 0.9 / 96, 0, 2.62, 0.02); addCircle(x, z, 0.08, 3); }
  }

  // ---- 往快速道路那段：南邊一排透天厝（小聚落）、路口前的「停」、左右轉的箭頭、快速道路的入口牌 ----
  row(-418, 9.75, -466, 9.75, 0, -1, 120, { shops: [null, 1, null, null, null, 0], vsigns: [7, null, 4, null, 6], gaps: true });
  {
    const oct = Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) / 8) * TAU; return [48 + Math.cos(a) * 46, 48 + Math.sin(a) * 46]; });
    const T = frame(-513.6, 0, -8.45, Math.PI / 2); B.at(-513.6, -8.45); cyl('main', T, 0, -0.06, 0, 2.5, 0.05, 0.05, 5, C('#9aa0a6'), null, true); signPoly(T, S2.stop, 96, 96, oct, 0.8 / 96, 0, 2.55, 0.02, C('#9aa0a6'), 'sign2'); addCircle(-513.6, -8.45, 0.08, 3);
    flat('decal', -516.1, -3.375, -1, 0, 0.45, 6.3, 0.05, DU.start); // 停止線（第 9 批：車道 6.75 公尺寬，中間 z −3.375）
    flat('decal', -508, -3.375, -1, 0, 5, 1.7, 0.05, DU.arrLR); flat('decal', -480, -3.375, -1, 0, 5, 1.7, 0.05, DU.arrU);
    const G = frame(-485, 0, 8.85, Math.PI / 2); B.at(-485, 0); // 第 9 批：柱子往外 2.25、懸臂長 3.4（牌子還是在往西那一線的正上面） // 懸臂的大牌子：路南邊一根柱子（本地 +x 朝北），牌子在往西那一線上面、對著開過來的車
    cyl('main', G, 0, -0.3, 0, 7.9, 0.22, 0.2, 8, C('#8d9197'), null, true);
    for (const y of [7.35, 6.0]) box('main', G, [-0.2, y, -0.42, 14.6, y + 0.18, -0.2], C('#8d9197'));
    box('sign2', G, [10.0, 5.2, -0.18, 14.4, 7.3, -0.06], C('#7d8288'), { pz: S2.entry, _: S2W });
    addCircle(-485, 8.55, 0.25, 8);
  }

  // ---- 阿財車行：玻璃展示間（6 台車在轉盤上，大路看得到）、旁邊的車棚（買車區：開進去停好就打開車店）、後面的庫存車、路邊的立牌、旗子 ----
  const DISPLAY = [[-463, -33, 0.45], [-450, -33, 0.8], [-437, -33, -0.45], [-463, -43, 0.6], [-450, -43, 0], [-437, -43, -0.6]].map(([x, z, a]) => ({ x, z, y: 0.06, heading: -Math.PI / 2 + a })); // 車頭大概朝大路（南），斜一點
  {
    const T = frame(-450, 0, -26, 0); B.at(-450, -38); // 本地＝世界 −(−450, −26)：展示間 x −22…22、z −24…0（玻璃正面在 z 0 朝南），高 8
    const wc = C('#f4f5f6'), red = C('#c8281e'), dk = C('#2a2c30'), frameC = C('#3a3d42');
    for (let x = -22; x < 21.9; x += 4.4) for (let z = -24; z < -0.1; z += 4.8) floor('main', T, x, z, x + 4.4, z + 4.8, 0.04, U.floorT); // 亮面地磚
    addPave(-450, -38, 22, 12, 0, null, 0, false);
    wall('main', T, [-22, 0, -24, 22, 8, -23.7], { nz: WHITE, pz: wc, _: wc }, { nz: U.panel, _: dotUV(U.conc) }); // 後牆
    wall('main', T, [-22, 0, -23.7, -21.7, 8, 0], { nx: WHITE, px: wc, _: wc }, { nx: U.panel, _: dotUV(U.conc) }); // 西牆
    wall('main', T, [21.7, 0, -23.7, 22, 8, -12], { px: WHITE, nx: wc, _: wc }, { px: U.panel, _: dotUV(U.conc) }); // 東牆（後半）
    box('main', T, [21.7, 5.2, -12, 22, 8, 0], { px: WHITE, _: wc }, { px: U.panel, _: dotUV(U.conc) });
    box('main', T, [-22, 5.2, -0.3, 22, 8, 0], { pz: WHITE, _: wc }, { pz: U.panel, _: dotUV(U.conc) }); // 正面上面的招牌牆
    box('main', T, [-22.2, 8, -24.2, 22.2, 8.35, 0.25], C('#e9eaec'), { _: dotUV(U.conc), ny: dotUV(U.conc) }); // 屋頂
    box('main', T, [-22.2, 4.95, 0, 22.2, 5.25, 1.1], C('#e9eaec'), { ny: dotUV(U.conc) }); // 玻璃上面的雨遮
    face('main', T, -22, 22, 5.25, 5.55, 0.02, WD, red); // 紅色的一條
    face('glow', T, -6.3, 6.3, 5.62, 7.98, 0.03, GU.dealer, [1.1, 1.1, 1.1]); // 燈箱：阿財車行、新車
    // 玻璃：正面整片（每 4.4 公尺一根框）、東牆前半；門在 x 11…14
    vquad('glass', T, [-22, -0.05], [11.1, -0.05], 0, 5.2, WD); vquad('glass', T, [14.1, -0.05], [22, -0.05], 0, 5.2, WD); vquad('glass', T, [11.1, -0.05], [14.1, -0.05], 2.76, 5.2, WD); // 自動門開著（門框裡面沒有玻璃）
    vquad('glass', T, [21.85, -0.05], [21.85, -12], 0, 5.2, WD);
    for (let x = -22; x <= 22.01; x += 4.4) box('main', T, [x - 0.07, 0, -0.14, x + 0.07, 5.2, 0.04], frameC);
    box('main', T, [-22, 0, -0.14, 22, 0.12, 0.04], frameC); box('main', T, [-22, 5.08, -0.14, 22, 5.2, 0.04], frameC);
    for (const z of [-12, -8, -4]) box('main', T, [21.78, 0, z - 0.07, 21.96, 5.2, z + 0.07], frameC);
    box('main', T, [11.1, 0, -0.16, 11.25, 2.7, 0.06], frameC); box('main', T, [13.95, 0, -0.16, 14.1, 2.7, 0.06], frameC); box('main', T, [11.1, 2.62, -0.16, 14.1, 2.76, 0.06], frameC); // 自動門的框
    face('glow', T, 11.35, 13.85, 2.82, 3.3, 0.06, GU.welcome); // 歡迎光臨
    lbox(T, -22, -0.3, 11.25, 0.05, 5.2); lbox(T, 13.95, -0.3, 22, 0.05, 5.2); lbox(T, 21.7, -12, 22, 0, 5.2); // 正面的玻璃分兩段：自動門（x 11.25…13.95）開著，人走得進展示間（第 2 批；車開不進去：town.src.js 只給開車的一片擋住）
    // 裡面：天花板（方形燈）、轉盤（6 個，LED 光圈）、櫃台、沙發、電視、盆栽、牆上的大海報
    ceil('glow', T, -21.7, -23.7, 21.7, -0.3, 5.2, GW, [0.86, 0.86, 0.84]); // 天花板：燈照得很亮（不吃光：不然只有半球光的地面色，暗暗的）
    for (let x = -18.7; x < 21; x += 6.2) for (let z = -21; z < -1; z += 5) ceil('glow', T, x - 0.6, z - 0.6, x + 0.6, z + 0.6, 5.19, GU.dlight, [1.1, 1.1, 1.1]);
    for (const d of DISPLAY) { const t = frame(d.x, 0, d.z); cyl('main', t, 0, 0, 0.04, 0.06, 2.9, 2.9, 28, C('#3a3d42'), null, true); cyl('glow', t, 0, 0, 0.04, 0.07, 3.02, 3.02, 28, [1.3, 1.3, 1.3], dotUV(GU.cool), false); }
    box('main', T, [-17.5, 0, -22.9, -12.5, 1.05, -21.9], { pz: red, _: wc }); box('main', T, [-17.5, 1.05, -23.0, -12.5, 1.12, -21.75], C('#dcdcd8')); lbox(T, -17.5, -23.0, -12.5, -21.75, 1.1); // 櫃台（靠後牆，後面留 0.7 公尺給業務站）
    face('sign2', T, -3.85, 3.85, 1.6, 4.9, -23.68, S2.ad1); // 後牆的大海報
    box('main', T, [-21.6, 0, -13, -20.3, 0.45, -7], C('#3a3d42')); box('main', T, [-21.6, 0.45, -13, -21.2, 0.95, -7], C('#3a3d42')); lbox(T, -21.6, -13, -20.3, -7, 1); // 沙發
    vquad('glow', T, [-21.68, -8.2], [-21.68, -11.8], 1.6, 3.6, GU.tv);
    const rnd = rng(1212);
    for (const [x, z] of [[-20.6, -22.6], [20.6, -22.6], [-20.6, -1.6], [9.6, -1.4], [20.6, -13.2]]) { const t = T.sub(x, 0, z); cyl('main', t, 0, 0, 0, 0.55, 0.32, 0.26, 8, C('#e8e6e0'), null, true); const q = t.p(0, 0, 0); blob('main', q[0], 1.25, q[2], 0.6, 0.8, 0.6, mul(pick(rnd, GREENS), 0.95), 0.25, 0, (rnd() * 1e6) | 0); addCircle(q[0], q[2], 0.35, 1.8); }
    // 車棚（買車區）：x −492…−476、z −25…−9，四根柱子、屋頂下面的燈、東邊和南邊的燈箱「買車區」
    const K = frame(-484, 0, -17, 0); B.at(-484, -17);
    for (const [x, z] of [[-7.2, -7.2], [-7.2, 7.2], [7.2, -7.2], [7.2, 7.2]]) { box('main', K, [x - 0.2, 0, z - 0.2, x + 0.2, 5.0, z + 0.2], wc); const c = K.p(x, 0, z); addBox(c[0], c[2], 0.22, 0.22, 0, 5); }
    box('main', K, [-8.5, 5.0, -8.5, 8.5, 6.2, 8.5], { py: C('#d9dadc'), _: red }, { ny: false, _: WD });
    ceil('glow', K, -8.5, -8.5, 8.5, 8.5, 5.0, GW, [0.8, 0.8, 0.78]);
    for (const [x, z] of [[-4, -4], [-4, 4], [4, -4], [4, 4], [0, 0]]) ceil('glow', K, x - 0.6, z - 0.6, x + 0.6, z + 0.6, 4.99, GU.dlight, [1.15, 1.15, 1.15]);
    vquad('glow', K, [8.52, 2.2], [8.52, -2.2], 5.05, 6.15, GU.buy, [1.1, 1.1, 1.1]); face('glow', K, -2.2, 2.2, 5.05, 6.15, 8.52, GU.buy, [1.1, 1.1, 1.1]); // 東邊（開過來的車看得到）、南邊（大路看得到）
    addPave(-484, -17, 8, 8, 0, C('#5d5f63'), 0.03); flat('decal', -484, -17, -1, 0, 10, 7, 0.05, DU.buyzone);
    // 前庭（x −502…−400、z −26…−4.5）、東邊入口 x −414…−406、西邊出口 x −501…−493；中間一排矮花台＋旗子
    addPave(-451, -15.25, 51, 10.75, 0, C('#dedfdb'));
    for (const [x0, x1] of [[-493, -414], [-406, -401]]) { B.at((x0 + x1) / 2, -7.55); box('main', frame(0, 0, 0), [x0, 0, -8.25, x1, 0.45, -6.95], C('#e8e7e2'), { _: dotUV(U.conc) }); box('main', frame(0, 0, 0), [x0 + 0.15, 0.45, -8.1, x1 - 0.15, 0.5, -7.1], C('#5d4a38')); for (let x = x0 + 1.2; x < x1 - 0.5; x += 2.2) shrub(x, -7.6, 0.75, rnd); addBox((x0 + x1) / 2, -7.6, (x1 - x0) / 2, 0.65, 0, 0.5); }
    for (let i = 0; i < 8; i++) { const x = -487 + i * 9.5, t = frame(x, 0, -7.6, 0); B.at(x, -7.6); cyl('main', t, 0, 0, 0.45, 4.6, 0.035, 0.035, 5, C('#dfe2e6'), null, true); vquad('sign2', t, [0.05, 0], [0.62, 0], 1.9, 4.5, S2['fl' + (i % 3)], WHITE, true); }
    for (const [x, z, a] of [[-410, -9, [0, -1]], [-440, -17, [-1, 0]], [-470, -17, [-1, 0]], [-497, -8, [0, 1]]]) flat('decal', x, z, a[0], a[1], 4.6, 1.3, 0.05, DU.arrU); // 地上的箭頭：進來、往西、出去
    { const t = frame(-415.2, 0, -8.65, 0); B.at(-415.2, -8.65); cyl('main', t, 0, 0, 0, 1.9, 0.04, 0.04, 5, C('#9aa0a6'), null, true); box('sign2', t, [-0.5, 1.4, -0.03, 0.5, 1.9, 0.02], C('#7d8288'), { pz: S2.in, _: S2W }); addCircle(-415.2, -8.65, 0.06, 2); } // 入口
    { const t = frame(-491.8, 0, -8.65, Math.PI); B.at(-491.8, -8.65); cyl('main', t, 0, 0, 0, 1.9, 0.04, 0.04, 5, C('#9aa0a6'), null, true); box('sign2', t, [-0.5, 1.4, -0.03, 0.5, 1.9, 0.02], C('#7d8288'), { pz: S2.out, _: S2W }); addCircle(-491.8, -8.65, 0.06, 2); } // 出口（對著開出來的車）
    { const t = frame(-403.5, 0, -9.45, 0); B.at(-403.5, -9.45); box('main', t, [-0.9, 0, -0.35, 0.9, 0.5, 0.35], C('#c9ccd0')); box('glow', t, [-0.8, 0.5, -0.25, 0.8, 7.3, 0.25], [1.05, 1.05, 1.05], { px: GU.pylon, nx: GU.pylon, _: dotUV(GU.white) }); box('main', t, [-0.85, 7.3, -0.3, 0.85, 7.45, 0.3], C('#c8281e')); addBox(-403.5, -9.45, 0.9, 0.35, 0, 7.5); } // 路邊的立牌（東西兩面）
    // 後面：庫存車（x −500…−474、z −48…−28）、客人停車
    addPave(-487, -38, 13, 10, 0, C('#b9bab6'));
    for (let i = 0; i < 5; i++) { const x = -497.5 + i * 5, t = carProp(x, 0, -34, -Math.PI / 2, pick(rnd, [C('#f2f3f5'), C('#1d1f23'), C('#9aa0a6'), C('#c8281e'), C('#2f6fd6'), C('#e8e4da')])); void t; addBox(x, -34, 1, 2.3, 0, 1.5); }
    for (let i = 0; i < 4; i++) { const x = -496.5 + i * 5.5, t = carProp(x, 0, -44.5, Math.PI / 2, pick(rnd, [C('#f2f3f5'), C('#3a3d42'), C('#b3261e'), C('#cfd3d8')])); void t; addBox(x, -44.5, 1, 2.3, 0, 1.5); }
    for (let i = 0; i < 6; i++) flat('decal', -499.8 + i * 5, -34, 0, 1, 5.2, 0.12, 0.05, DU.start); // 白線
    buildings.push({ kind: 'dealer', name: '阿財車行', x: -450, z: -38, hx: 22, hz: 12, rot: 0, h: 8.3, door: { x: -437.4, z: -25.2, ry: 0 } });
  }

  // ---- 山：近的綠色小山（碰不到）、遠的藍綠色大山（霧裡）----
  const hill = (cx, cz, R0, H, col, seed, trees = 0) => {
    B.at(cx, cz); const nr = 7, ns = 20, rnd = rng(seed);
    const pt = (i, j) => { const r = i / nr, a = (j / ns) * TAU + (i % 2) * (Math.PI / ns), k = 1 + (hash2(seed + i, j % ns) - 0.5) * 0.18 * r; const h = H * Math.pow(Math.max(0, 1 - r * r), 1.5) * (1 + (hash2(seed + 31, i * 7 + (j % ns)) - 0.5) * 0.12) - 0.6 * r; return [cx + Math.cos(a) * R0 * r * k, h, cz - Math.sin(a) * R0 * r * k]; };
    for (let i = 0; i < nr; i++) for (let j = 0; j < ns; j++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1), k1 = 0.9 + hash2(seed + 3, i * 40 + j) * 0.2, k2 = 0.9 + hash2(seed + 5, i * 40 + j) * 0.2;
      const cc = mix(col, C('#8fa860'), i / nr * 0.5);
      if (i === 0) { B.tri('main', a, b, c, WD, WD, WD, mul(cc, k1)); continue; }
      B.tri('main', a, b, c, WD, WD, WD, mul(cc, k1)); B.tri('main', a, c, d, WD, WD, WD, mul(cc, k2));
    }
    for (let t = 0; t < trees; t++) { const r = 0.15 + rnd() * 0.6, a = rnd() * TAU, x = cx + Math.cos(a) * R0 * r, z = cz - Math.sin(a) * R0 * r, h = H * Math.pow(1 - r * r, 1.5) - 0.8; cone(x, h, z, 1.6 + rnd() * 1.2, rnd); }
  };
  hill(-300, -212, 98, 34, C('#5c8a45'), 11, 24); hill(-165, -205, 88, 26, C('#648f4a'), 12, 18); hill(-420, -205, 80, 32, C('#56843f'), 13, 16); // 村子北邊
  hill(-430, 178, 76, 28, C('#618d48'), 15, 14); hill(-330, 184, 90, 28, C('#5f8b46'), 16, 18); hill(-214, 182, 86, 30, C('#648f4a'), 17, 16); // 南邊（東邊那座本來在 (−190, 182)、半徑 90：往西挪，不要蓋到往內湖的聯外道路 x −112）

  // ---- 快速道路：路面（兩邊各兩線＋路肩）、中間紐澤西護欄、兩邊鋼板護欄、路燈、門架指示牌、彎道箭頭牌、看板；碰撞（護欄）----
  B = HB; // 這一段畫到快速道路的網格（500 公尺一格）
  const HL = HWY_LEN, hp = hwyPath(25, 1.5), hsegs = [], GREY = C('#8d9197');
  const HP = (p, o, y) => [p.x + o * Math.sin(p.th), y, p.z + o * Math.cos(p.th)]; // 中線往右 o 公尺、高 y
  const NJ = [[0.305, 0], [0.29, 0.076], [0.12, 0.33], [0.08, 0.82]], NJC = C('#d2d0c9'), NJS = [0.8, 0.9, 1.0], CU = dotUV(U.conc), WB = subUV(U.wbeam, 0.3, 0, 0.7, 1), WBK = C('#9ba1a8');
  const inGap = (a, b, g) => b.s <= g + 1e-6 || a.s >= HL - g - 1e-6; // 這一段在路口的開口裡面
  for (let i = 0; i < hp.length - 1; i++) {
    const a = hp[i], b = hp[i + 1], va = a.s / 10, vb = b.s / 10; B.at((a.x + b.x) / 2, (a.z + b.z) / 2); hsegs.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z });
    B.quad('hwy', HP(a, 0.3, 0.03), HP(a, HW.half, 0.03), HP(b, HW.half, 0.03), HP(b, 0.3, 0.03), [0, va, 1, vb], WHITE); // 右邊（往前開那一邊）
    B.quad('hwy', HP(a, -HW.half, 0.03), HP(a, -0.3, 0.03), HP(b, -0.3, 0.03), HP(b, -HW.half, 0.03), [1, va, 0, vb], WHITE); // 左邊（反方向）
    B.quad('hwy', HP(a, -0.3, 0.028), HP(a, 0.3, 0.028), HP(b, 0.3, 0.028), HP(b, -0.3, 0.028), [0, va, 0.02, vb], WHITE); // 護欄底下
    if (!inGap(a, b, HW.gapM)) { // 紐澤西護欄（斷面三段斜面＋上面）
      for (let k = 0; k < 3; k++) {
        const [o0, y0] = NJ[k], [o1, y1] = NJ[k + 1];
        B.quad('main', HP(a, o0, y0), HP(b, o0, y0), HP(b, o1, y1), HP(a, o1, y1), CU, mul(NJC, NJS[k]));
        B.quad('main', HP(b, -o0, y0), HP(a, -o0, y0), HP(a, -o1, y1), HP(b, -o1, y1), CU, mul(NJC, NJS[k]));
      }
      B.quad('main', HP(a, -0.08, 0.82), HP(a, 0.08, 0.82), HP(b, 0.08, 0.82), HP(b, -0.08, 0.82), CU, mul(NJC, 1.06));
    }
    for (const sd of [1, -1]) { // 鋼板護欄：前面（對著路）、後面；東邊路口那段沒有
      if (sd > 0 && inGap(a, b, HW.gapE)) continue;
      const o = sd * HW.rail, ob = sd * (HW.rail + 0.06);
      if (sd > 0) { B.quad('main', HP(b, o, 0.5), HP(a, o, 0.5), HP(a, o, 0.82), HP(b, o, 0.82), WB, WHITE); B.quad('main', HP(a, ob, 0.5), HP(b, ob, 0.5), HP(b, ob, 0.82), HP(a, ob, 0.82), WD, WBK); }
      else { B.quad('main', HP(a, o, 0.5), HP(b, o, 0.5), HP(b, o, 0.82), HP(a, o, 0.82), WB, WHITE); B.quad('main', HP(b, ob, 0.5), HP(a, ob, 0.5), HP(a, ob, 0.82), HP(b, ob, 0.82), WD, WBK); }
      for (let s = Math.ceil(a.s / 6) * 6; s < b.s; s += 6) { // 柱子（6 公尺一根，只畫對著路那一面）
        if (sd > 0 && (s < HW.gapE || s > HL - HW.gapE)) continue;
        const t = (s - a.s) / (b.s - a.s), p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, th: a.th + (b.th - a.th) * t }, fo = sd * 12.12, hs = 0.08 * sd;
        const f = [Math.cos(p.th), -Math.sin(p.th)], P0 = HP(p, fo, 0), q = (d, y) => [P0[0] + f[0] * d, y, P0[2] + f[1] * d];
        B.quad('main', q(hs, 0), q(-hs, 0), q(-hs, 0.52), q(hs, 0.52), WD, C('#7d838a'));
      }
    }
  }
  // 路口：兩邊車道＋中間開口鋪一塊沒有標線的柏油、東邊兩個圓角（接大路）；開口兩頭的防撞墊、護欄頭
  B.at(-530, 0);
  { const uv = (x, z) => [x / 4, z / 4], y = 0.04, x0 = HW.x - HW.half, x1 = HW.x + HW.half; B.tri('pave', [x0, y, 14], [x1, y, 14], [x1, y, -14], uv(x0, 14), uv(x1, 14), uv(x1, -14), ASPH); B.tri('pave', [x0, y, 14], [x1, y, -14], [x0, y, -14], uv(x0, 14), uv(x1, -14), uv(x0, -14), ASPH);
    for (const sz of [1, -1]) { // 圓角（半徑 12）：從路口角落 (−518.1, ±4.5) 扇形接到圓弧
      const cx = x1 + 12, cz = sz * 16.5, c0 = [x1, y, sz * 4.5];
      for (let k = 0; k < 8; k++) {
        const a0 = Math.PI + (k / 8) * (Math.PI / 2), a1 = Math.PI + ((k + 1) / 8) * (Math.PI / 2), p0 = [cx + Math.cos(a0) * 12, y, cz - sz * Math.sin(a0 - Math.PI) * 12], p1 = [cx + Math.cos(a1) * 12, y, cz - sz * Math.sin(a1 - Math.PI) * 12]; // 從 (x1, cz) 繞到 (cx, ±4.5)
        if (sz > 0) B.tri('pave', c0, p0, p1, uv(c0[0], c0[2]), uv(p0[0], p0[2]), uv(p1[0], p1[2]), ASPH); else B.tri('pave', c0, p1, p0, uv(c0[0], c0[2]), uv(p1[0], p1[2]), uv(p0[0], p0[2]), ASPH);
      }
      paved.push({ x: x1 + 4, z: sz * 8.5, hx: 4, hz: 4, rot: 0, main: true }); // main：算大路（不限 40）
    }
    for (const s of [HW.gapM, HL - HW.gapM]) { // 中間護欄頭的防撞墊（黃黑斜紋）
      const p = hwyAt(s), sg = s < HL / 2 ? -1 : 1, T = frame(p.x, 0, p.z, p.th); // 本地 +x 沿路
      box('main', T, sg < 0 ? [-2.4, 0, -0.42, 0, 0.9, 0.42] : [0, 0, -0.42, 2.4, 0.9, 0.42], WHITE, { _: U.crash, py: WD });
      const c = T.p(sg * 1.2, 0, 0); addBox(c[0], c[2], 1.2, 0.42, p.th, 0.9);
    }
    for (const s of [HW.gapE, HL - HW.gapE]) { const p = hwyAt(s), sg = s < HL / 2 ? -1 : 1, T = frame(p.x, 0, p.z, p.th); box('main', T, sg < 0 ? [-0.9, 0.35, 12, 0, 0.95, 12.35] : [0, 0.35, 12, 0.9, 0.95, 12.35], WHITE, { _: U.crash }); } // 護欄頭
  }
  // 碰撞：兩邊護欄（內面在 ±12）、中間護欄（±0.3）；直線併成一個長方塊，彎道 3 度（最多 20 公尺）一段
  { const hc3 = hwyPath(20, 3);
    const rb = (a, b, o, hz) => { const A = hwyOff(a, o), Bq = hwyOff(b, o), L2 = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]); addBox((A[0] + Bq[0]) / 2, (A[1] + Bq[1]) / 2, L2 / 2 + 0.3, hz, Math.atan2(-(Bq[1] - A[1]), Bq[0] - A[0]), 0.9); };
    for (const [o, hz, g] of [[HW.rail + 0.6, 0.6, HW.gapE], [-(HW.rail + 0.6), 0.6, 0], [0, 0.3, HW.gapM]]) {
      let run = null; const flush = () => { if (run) rb(run.a, run.b, o, hz); run = null; };
      for (let i = 0; i < hc3.length - 1; i++) {
        const a = hc3[i], b = hc3[i + 1];
        if (g && inGap(a, b, g)) { flush(); continue; }
        if (run && run.b === a && a.k === 0 && b.k === 0 && Math.abs(run.a.th - b.th) < 1e-9) run.b = b; else { flush(); run = { a, b }; }
      }
      flush();
    }
  }
  // 路燈：中間護欄上，60 公尺一支，兩邊各一個燈頭（路口前後 25 公尺不要）；跟別的東西併在同一個網格（不多 draw call）
  for (let s = 30; s <= HL - 25; s += 60) {
    const p = hwyAt(s), T = frame(p.x, 0, p.z, p.th); B.at(p.x, p.z); // 本地 +x 沿路、+z 往右
    cyl('main', T, 0, 0, 0.82, 11.2, 0.13, 0.09, 6, GREY, null, true);
    for (const sd of [1, -1]) {
      tube('main', T.p(0, 10.75, 0), T.p(0, 11.2, sd * 2.35), 0.06, 0.05, 4, GREY);
      const H = T.sub(0, 11.2, sd * 2.65); box('main', H, [-0.5, -0.07, -0.22, 0.5, 0.08, 0.22], C('#6f7378'), { ny: false });
      ceil('glow', H, -0.42, -0.16, 0.42, 0.16, -0.075, dotUV(GU.amber), [1.2, 1.2, 1.2]);
    }
  }
  // 指示牌：hpose(s, 往右幾公尺, dir)：dir 1＝給往前開（s 變大）的車看、-1＝給反方向的車看；本地 +x＝開車的人的右手邊、+z＝朝開過來的車
  const hpose = (s, o, dir) => { const p = hwyAt(s), q = hwyOff(p, o); return frame(q[0], 0, q[1], p.th - (dir * Math.PI) / 2); };
  const gantry = (s, dir, reg) => { // 門架：路邊一根柱子（右手邊 14 公尺），桁架伸到車道上面，牌子在車道中間上面
    const T = hpose(s, dir * 14, dir); B.at(T.x, T.z);
    cyl('main', T, 0, 0, 0, 9.9, 0.3, 0.26, 8, GREY, null, true);
    for (const y of [9.35, 8.25]) box('main', T, [-13.3, y, -0.14, 0.2, y + 0.22, 0.14], GREY);
    for (let x = -12.6; x < 0; x += 1.8) box('main', T, [x - 0.05, 8.47, -0.05, x + 0.05, 9.35, 0.05], GREY);
    box('sign2', T, [-12.75, 5.0, 0.16, -5.15, 8.25, 0.28], C('#7d8288'), { pz: reg, _: S2W });
  };
  const rsign = (s, dir, o, reg, w, h, y0) => { // 路邊的牌子（兩根柱子）
    const T = hpose(s, dir * o, dir); B.at(T.x, T.z);
    for (const x of [-w * 0.3, w * 0.3]) cyl('main', T, x, -0.1, 0, y0 + h, 0.06, 0.06, 5, C('#9aa0a6'), null, true);
    box('sign2', T, [-w / 2, y0, -0.04, w / 2, y0 + h, 0.04], C('#7d8288'), { pz: reg, _: S2W });
  };
  gantry(HL - 300, 1, S2.gantryN); gantry(300, -1, S2.gantryS); // 出口前 300 公尺
  rsign(HL - 40, 1, 14, S2.exitR, 3.2, 1.6, 2.2); rsign(40, -1, 14, S2.exitL, 3.2, 1.6, 2.2); // 出口
  rsign(HL - 500, 1, 14, S2.dist, 3.2, 1.12, 2.2); rsign(500, -1, 14, S2.dist, 3.2, 1.12, 2.2);
  rsign(HL - 150, 1, 13.6, S2.warn, 2.4, 0.6, 2.0); rsign(150, -1, 13.6, S2.warn, 2.4, 0.6, 2.0);
  for (const [s, dir, reg] of [[700, 1, S2.post1], [1330, 1, S2.post2], [1780, -1, S2.post1], [1140, -1, S2.post2]]) rsign(s, dir, 13, reg, 1.2, 0.8, 1.6); // 保持車距、勿行駛路肩：兩個方向各兩面
  for (const [s, dir] of [[120, 1], [HL - 120, -1], [HL / 2, 1], [HL / 2, -1]]) { // 速限 110：路口出來、一圈的另一頭（西邊直線中間）
    const T = hpose(s, dir * 13, dir); B.at(T.x, T.z); cyl('main', T, 0, -0.06, 0, 2.6, 0.05, 0.05, 5, C('#9aa0a6'), null, true);
    signPoly(T, S2.lim110, 96, 96, circ(48, 48, 44, 16), 1.0 / 96, 0, 2.7, 0.02, C('#9aa0a6'), 'sign2');
  }
  for (const a of HWY_ARCS) if (a.deg >= 90) for (let s = a.s0 + 20; s < a.s1 - 10; s += 40) { // 半圓彎道（左彎）的箭頭牌：外側給往前開的車（往左）、中間護欄上給反方向的車（往右）
    { const T = hpose(s, 12.95, 1); B.at(T.x, T.z); cyl('main', T, 0, -0.05, 0, 2.2, 0.035, 0.035, 4, C('#9aa0a6'), null, true); box('sign2', T, [-0.3, 1.25, -0.02, 0.3, 2.15, 0.02], C('#9aa0a6'), { pz: flipU(S2.chev), _: S2W }); }
    { const T = hpose(s, 0, -1); box('main', T, [-0.035, 0.82, -0.05, 0.035, 1.3, -0.02], C('#9aa0a6')); box('sign2', T, [-0.3, 1.3, -0.02, 0.3, 2.2, 0.02], C('#9aa0a6'), { pz: S2.chev, _: S2W }); }
  }
  // 路邊的東西佔的地方（長方形 { x, z, hx, hz, rot } 或圓 { x, z, r }）：最後種的樹避開這些（不會長在稻田、房子、山坡、看板上）
  const keep = [], keepR = (x, z, hx, hz, rot = 0) => keep.push({ x, z, hx, hz, rot }), keepC = (x, z, r) => keep.push({ x, z, r });
  const kept = (x, z, m) => keep.some((k) => (k.r != null ? Math.hypot(x - k.x, z - k.z) < k.r + m : inRect({ ...k, hx: k.hx + m, hz: k.hz + m }, x, z)));
  for (const [s, dir, reg] of [[640, 1, S2.ad1], [1800, 1, S2.ad3], [1100, -1, S2.ad2], [1900, -1, S2.ad1], [560, -1, S2.ad3]]) { // 路邊的大看板（半圓外側給往前開的、裡面給反方向的）
    const T = hpose(s, dir * 34, dir); B.at(T.x, T.z);
    for (const x of [-3, 3]) cyl('main', T, x, -0.3, 0, 7.3, 0.28, 0.24, 8, GREY, null, true);
    box('main', T, [-5.2, 7.0, -0.45, 5.2, 7.2, 0.2], GREY); box('sign2', T, [-5, 7.2, -0.18, 5, 11.5, 0.12], C('#7d8288'), { pz: reg, _: S2W });
    keepR(T.x, T.z, 5.5, 1, T.ry);
  }
  // 兩邊的風景：稻田、鐵皮工廠、檳榔園、幾間透天厝、山（先放），最後種樹
  // 一圈裡面：東邊直線 x −542…、西邊 …−1018（護欄）；半圓離圓心 (−780, ∓225) 238 公尺以內；路邊的樹在離中線 17–47 公尺（裡面、外面都有）
  { const rnd = rng(4242);
    const paddy = (x0, z0, x1, z1, nx, nz) => { paddyArea(x0, z0, x1, z1, nx, nz, rnd); keepR((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2); };
    paddy(-645, -220, -590, -120, 2, 3); paddy(-645, 100, -590, 220, 2, 4); // 快速道路裡面：東邊直線旁邊（中間是路口、兩間鐵皮工廠）
    paddy(-860, -405, -700, -350, 3, 2); paddy(-860, 355, -700, 400, 3, 2); // 半圓裡面
    paddy(-1135, -330, -1080, -45, 2, 7); paddy(-1135, 45, -1080, 330, 2, 7); // 西邊外面（中間一排透天厝）
    paddy(-900, -600, -680, -535, 4, 2); paddy(-900, 535, -680, 600, 4, 2); // 半圓外面（北、南）
    const shed = (x, z, ry, w, d, h, wc, rc) => { // 鐵皮工廠：浪板牆、斜屋頂
      B.at(x, z); const T = frame(x, 0, z, ry); box('main', T, [-w / 2, 0, -d / 2, w / 2, h, d / 2], wc, { _: U.corr, py: false });
      for (const s of [1, -1]) { B.quad('main', T.p(-w / 2 - 0.3, h - 0.1, s * (d / 2 + 0.4)), T.p(w / 2 + 0.3, h - 0.1, s * (d / 2 + 0.4)), T.p(w / 2 + 0.3, h + d * 0.18, 0), T.p(-w / 2 - 0.3, h + d * 0.18, 0), U.corr, rc); }
      for (const s of [1, -1]) B.tri('main', T.p(s * w / 2, h, s > 0 ? d / 2 : -d / 2), T.p(s * w / 2, h, s > 0 ? -d / 2 : d / 2), T.p(s * w / 2, h + d * 0.18, 0), WD, WD, WD, wc);
      addBox(x, z, w / 2, d / 2, ry, h); keepR(x, z, w / 2 + 0.5, d / 2 + 0.5, ry);
    };
    for (const [x, z, ry, w, d, h, wc, rc] of [[-610, -95, 0.05, 30, 18, 7, '#dfe3e8', '#3b78c4'], [-612, 70, -0.04, 24, 16, 6, '#c9d6e2', '#e8eaec'], // 一圈裡面、路口旁邊
      [-1100, -400, 0.2, 36, 20, 8, '#e8eaec', '#3b78c4'], [-1095, 400, -0.15, 28, 18, 7, '#dfe3e8', '#4c9a6a'], [-560, -560, 0.4, 32, 18, 7, '#e8eaec', '#3b78c4'], [-1000, 560, -0.3, 26, 16, 6, '#dfe3e8', '#e07a3a'], // 外面：西北、西南、北、南
      [-485, -330, 0.1, 26, 16, 6.5, '#e6e2d8', '#3b78c4'], [-485, 330, -0.1, 30, 18, 7, '#dfe3e8', '#8fb7e0']]) shed(x, z, ry, w, d, h, C(wc), C(rc)); // 外面：東北、東南（村子北邊、南邊）
    const grove = (x, z, n, cols) => { for (let i = 0; i < n; i++) palm(x + (i % cols) * 4.5 + rnd(), z + ((i / cols) | 0) * 4.5 + rnd(), 7 + rnd() * 3, rnd, false); keepC(x + (cols - 1) * 2.25, z + (Math.ceil(n / cols) - 1) * 2.25, 12); }; // 檳榔園
    grove(-712, 322, 14, 4); grove(-968, -9, 10, 3); grove(-1112, -10, 10, 3); // 南邊半圓裡面、西邊直線裡面（兩座山中間）、西邊外面（透天厝後面）
    const houses = (ax, az, bx, bz, nx, nz, seed, o) => { row(ax, az, bx, bz, nx, nz, seed, o); const L = Math.hypot(bx - ax, bz - az); keepR((ax + bx) / 2 - nx * 5.5, (az + bz) / 2 - nz * 5.5, L / 2 + 1, 8, Math.atan2(nx, nz)); }; // 房子深 12.5、前面 1.5 公尺水泥地
    houses(-1072, -30, -1072, 30, 1, 0, 131, { gaps: true }); houses(-500, 356, -500, 386, -1, 0, 132, { gaps: false }); // 快速道路旁邊的透天厝：西邊外面（面向快速道路）、東南（村子南邊）
    // 山：一圈裡面兩座（有樹）；遠的一圈（藍綠色，跨在草地的邊上 x −1450、z ±880）；村子南北的山、遠的山（上面蓋的）也不要種樹
    const HILLS_IN = [[-800, -165, 135, 72, '#5f8a50', 21, 20], [-805, 185, 145, 80, '#5c874c', 22, 22]];
    const HILLS_FAR = [[-1330, -890, 270, 140, 29], [-990, -930, 260, 125, 33], [-660, -910, 250, 120, 34], [-400, -880, 220, 105, 35], // 北
      [-1480, -560, 250, 130, 31], [-1470, -170, 250, 120, 39], [-1480, 220, 260, 135, 32], [-1470, 600, 240, 115, 40], // 西
      [-1330, 890, 270, 140, 30], [-990, 930, 250, 120, 36], [-660, 910, 260, 130, 37], [-400, 880, 220, 100, 38]]; // 南
    for (const [x, z, r, h, col, seed, n] of HILLS_IN) { hill(x, z, r, h, C(col), seed, n); keepC(x, z, r); }
    for (const [x, z, r, h, seed] of HILLS_FAR) { hill(x, z, r, h, C('#5f7f6e'), seed, 0); keepC(x, z, r); }
    for (const [x, z, r] of [[-420, -205, 80], [-430, 178, 76], [-250, -430, 230], [-260, 430, 230], [-60, -430, 180], [-90, 390, 190]]) keepC(x, z, r);
    for (let s = 40; s < HL - 40; s += 24 + rnd() * 28) for (const sd of [1, -1]) { // 路邊的樹（離中線 17–47 公尺）
      if (rnd() < 0.3) continue;
      const p = hwyAt(s), q = hwyOff(p, sd * (17 + rnd() * 30));
      if ((q[0] > -560 && Math.abs(q[1]) < 150) || kept(q[0], q[1], 4)) continue; // 路口、村子那邊不要；稻田、房子、山、看板上面不要
      if (rnd() < 0.55) lowTree(q[0], q[1], 0.9 + rnd() * 0.5, rnd); else cone(q[0], 0, q[1], 1.3 + rnd() * 0.9, rnd);
    }
  }
  hill(-250, -430, 230, 125, C('#5f7f6e'), 25, 0); hill(-60, -430, 180, 78, C('#5f7f6e'), 26, 0); hill(-320, 500, 230, 110, C('#5f7f6e'), 27, 0); hill(-230, 680, 190, 80, C('#5f7f6e'), 28, 0); // 遠的（村子南北）；南邊兩座本來在 (−260, 430)、(−90, 390)：會蓋到往內湖的聯外道路（x −112 往南）：往西南移
  B = VB;

  // ---- 地方：你的車庫、改車廠、車店、賽道、快速道路 ----
  const R2 = Math.PI / 2;
  const places = {
    garage: { // 車庫模組（白色大理石、鐵捲門）放在 lot；這裡只有門前的水泥地、花台、往南的路
      name: '你的車庫', pos: [LOT.x, LOT.z], lot: { ...LOT }, spawn: { ...LOT },
      door: { x: -300, z: -92.5, heading: -R2 },                                // 鐵捲門中間（本地 x = +5），朝外（南）
      apron: { x: -300, z: -83.85, hx: 8.35, hz: 7, rot: -R2 },                 // 門前（本地 x 5.3…22、z ±7）：停在這裡 HUD 給「開鐵捲門」
      inside: { x: -300, z: -101.35, hx: 8.85, hz: 15.7, rot: -R2 },            // 車庫裡面（本地 x −12.7…5、z ±15.7；第 11 批：本來 ±12.7）
      zone: { x: -300, z: -92.85, hx: 17.35, hz: 15.7, rot: -R2 },              // apron＋inside
    },
    shop: { // 阿輝改車廠：前門（南）開進改車區、後門（北）出去
      name: '阿輝改車廠', pos: [-160, -35],
      bay: { x: -160, z: -35, hx: 2.5, hz: 6.5, rot: 0 },                        // 改車區的地板（中間那格，黃線裡面）：停在這裡打開改車廠
      park: { x: -160, z: -35, heading: R2 },                                    // 改車區中間，車頭朝後門
      exit: { x: -160, z: -50.5, heading: R2 }, spawn: { x: -160, z: -50.5, heading: R2 }, // 後門外面的院子：往前、右轉、東邊的小路回大路
      zone: { x: -160, z: -30, hx: 7, hz: 14, rot: 0 },                          // 改車區＋前門口
      view: { pos: [-164.6, 2.2, -27.6], look: [-159.2, 0.9, -36.5], fov: 52 },  // 改車的時候：前門裡面左邊，看改車區的車（左後方）、後門、輪胎架
    },
    dealer: { // 阿財車行：大路東邊開進前庭、經過展示間前面、開進車棚（買車區）、西邊出去
      name: '阿財車行', pos: [-450, -38],
      display: DISPLAY.map((d) => ({ ...d })),                                    // 6 台展示車（轉盤上，y＝轉盤的高度）
      bay: { x: -484, z: -17, hx: 5, hz: 3.5, rot: 0 },                          // 買車區（車棚下面）：停在這裡打開車店
      park: { x: -484, z: -17, heading: Math.PI },                               // 買車區中間，車頭朝西（出口）
      exit: { x: -497, z: -11, heading: -R2 }, spawn: { x: -497, z: -11, heading: -R2 }, // 新車出現的地方：出口車道上，朝大路
      zone: { x: -480, z: -17, hx: 14, hz: 8, rot: 0 },
      view: { pos: [-428.7, 3.7, -26.5], look: [-453, 0.2, -39.5], fov: 60 },    // 展示間裡面（東南角，高一點）看 6 台車
    },
    track: { name: '賽道', pos: [-7, 0], spawn: { x: -9, z: 0, heading: Math.PI }, zone: { x: -7, z: 0, hx: 7, hz: 6, rot: 0 }, start: { noseX: 0, z: 2.4, heading: 0 } },
    highway: { // 快速道路的路口（上快速道路的地方）；spawn：外側車道（往北）的慢車道上
      name: '快速道路', pos: [HW.x, 0],
      spawn: { x: HW.x + HW.lanes[1], z: -40, heading: R2 },
      zone: { x: -526, z: 0, hx: 20, hz: 16, rot: 0 },
    },
  };

  // ---- 邊界：村子北邊、南邊的山腳（西邊是快速道路的護欄、東邊是賽道外面的圍籬）----
  addBox(-286, -114.5, 232, 1.5, 0, 3); addBox(-318, 94, 200, 1.5, 0, 3); addBox(-80, 94, 26, 1.5, 0, 3); // ==== 第 4 批：南邊邊界 x −118…−106 開一個口（往越野車場的水泥路）====

  // ==== 第 3 批（b3-city）：警察局（police.js）、街景＋槍店的店面（street.js）：碰撞、水泥地、地方、房子都登記進來（路面種類要在下面算）====
  const PS = buildPoliceStation({ renderer: opts.renderer });
  for (const c of PS.colliders) colliders.push(c);
  for (const p of PS.pave) addPave(p.x, p.z, p.hx, p.hz, p.rot || 0, C(p.col), p.y ?? 0.02);
  places.police = PS.place; buildings.push(PS.building);
  const ST = buildStreet({ buildings, roads, places, colliders, paved, nodes: NODES, poles: stPoles, houses: stHouses, rows: stRows }, { renderer: opts.renderer });
  for (const c of ST.colliders) colliders.push(c);
  for (const p of ST.pave) addPave(p.x, p.z, p.hx, p.hz, p.rot || 0, C(p.col), p.y ?? 0.02);
  if (ST.gunshop) { places.gunshop = ST.gunshop.place; buildings.push(ST.gunshop.building); }
  // ==== 第 3 批 end ====

  // ---- 路面種類：25 公尺一格，先把每格附近的路、快速道路、水泥地、稻田找好（開車每一格只查那幾個）----
  const SG = { x0: -1100, z0: -525, c: 25, nx: 46, nz: 42 }, cells = new Array(SG.nx * SG.nz); // x −1100…50、z −525…525（快速道路一圈 x −1042…、z ±487）
  const put = (x0, z0, x1, z1, k, o) => {
    const i0 = Math.max(0, Math.floor((x0 - SG.x0) / SG.c)), i1 = Math.min(SG.nx - 1, Math.floor((x1 - SG.x0) / SG.c));
    const j0 = Math.max(0, Math.floor((z0 - SG.z0) / SG.c)), j1 = Math.min(SG.nz - 1, Math.floor((z1 - SG.z0) / SG.c));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) (cells[j * SG.nx + i] ||= { h: [], r: [], p: [], d: [] })[k].push(o);
  };
  const ext = (p) => { const c = Math.abs(Math.cos(p.rot || 0)), s = Math.abs(Math.sin(p.rot || 0)), ex = p.hx * c + p.hz * s, ez = p.hx * s + p.hz * c; return [p.x - ex, p.z - ez, p.x + ex, p.z + ez]; };
  for (const s of hsegs) put(Math.min(s.ax, s.bx) - HW.half, Math.min(s.az, s.bz) - HW.half, Math.max(s.ax, s.bx) + HW.half, Math.max(s.az, s.bz) + HW.half, 'h', s);
  for (const s of roadSegs) { const m = s.hw + 0.4; put(Math.min(s.ax, s.bx) - m, Math.min(s.az, s.bz) - m, Math.max(s.ax, s.bx) + m, Math.max(s.az, s.bz) + m, 'r', s); }
  for (const p of paved) put(...ext(p), 'p', p);
  for (const p of paddies) put(...ext(p), 'd', p);
  surfaceAt = (x, z) => {
    if (x >= -60 && x <= 760 && Math.abs(z) <= 6.3) return 0; // 賽道
    const i = Math.floor((x - SG.x0) / SG.c), j = Math.floor((z - SG.z0) / SG.c);
    const c = i >= 0 && j >= 0 && i < SG.nx && j < SG.nz ? cells[j * SG.nx + i] : null; if (!c) return 1;
    for (const s of c.h) if (segDist(x, z, s.ax, s.az, s.bx, s.bz)[0] <= HW.half) return 4; // 快速道路（路肩也算）
    for (const s of c.r) if (segDist(x, z, s.ax, s.az, s.bx, s.bz)[0] <= s.hw + 0.4) return s.r.kind === 'main' ? 0 : 3;
    for (const p of c.p) if (inRect(p, x, z)) return p.main ? 0 : 3;
    for (const p of c.d) if (inRect(p, x, z)) return 2;
    return 1;
  };

  // ---- 組起來：村子（200 公尺一格）、快速道路（500 公尺一格，另外一個 group，名字前面加 hwy-）----
  const ORDER = { decal: 2, halo: 3, glass: 4 };
  const bv = VB.build(mats, ORDER), bh = HB.build(mats, ORDER, 'hwy-');
  const group = bv.group; group.name = 'village'; group.add(ground);
  group.add(PS.group, ST.group); // 第 3 批：警察局、街景
  bh.group.name = 'highway'; group.add(bh.group);
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wires.flat(), 3));
  const wl = new THREE.LineSegments(wg, mats.wire); wl.name = 'wires'; wl.matrixAutoUpdate = false; group.add(wl);
  group.updateMatrixWorld(true);
  const gTris = ground.geometry.attributes.position.count / 3;
  return {
    group, places, colliders, surfaceAt, route,
    roads: roads.filter((r) => !HWK.has(r.kind) && r.kind !== 'link').map((r) => ({ pts: r.pts, w: Array.isArray(r.w) ? Math.max(...r.w) : r.w, kind: r.kind }))
      .concat([{ pts: hc.map((p) => [p.x, p.z]), w: HW.half * 2, kind: 'highway' }]),
    bounds: { x0: -1090, x1: 12, z0: -530, z1: 530 }, areas: { paddy: paddies, pave: paved }, buildings,
    highway: { len: HL, center: hp.map((p) => [p.x, p.z]), out: hp.map((p) => hwyOff(p, HW.mid)), in: hp.map((p) => hwyOff(p, -HW.mid)).reverse(), half: HW.half, lanes: HW.lanes.slice() }, // 細的（直線 25 公尺、彎道 1.5 度一點）：以後的車流、AI 用
    info: { meshes: bv.meshes + bh.meshes + 2 + PS.info.meshes + ST.info.meshes, tris: VB.tris + HB.tris + gTris + PS.info.tris + ST.info.tris, village: { meshes: bv.meshes, tris: VB.tris }, highway: { meshes: bh.meshes, tris: HB.tris }, ground: gTris, street: ST.info, police: PS.info }, // 第 3 批：＋街景、警察局
    sidewalks: ST.sidewalks, crossings: ST.crossings, signals: ST.signals, clock: ST.clock, street: ST, police: PS, // ==== 第 3 批 ====
    dispose() { ST.dispose(); PS.dispose(); /* 第 3 批 */ group.removeFromParent(); group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); for (const m of Object.values(mats)) m.dispose(); for (const t of texs) t.dispose(); },
  };
}
return { buildVillage, stripColliders, villageFonts };
})();
