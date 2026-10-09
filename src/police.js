// ---- 警察局（第 3 批）：外面（三層樓、前院、旗桿、兩台警車）、裡面（櫃台、辦公桌、電腦、等候椅、公布欄、拘留室）、警車、警察的樣子 ----
// Nick 2026-09-28 06:21：「要警察局」；之後：揍人、開車撞人會被警察抓去關（追人、抓人是 police-ai.js；這裡只有房子、警車、警察的樣子）
// 全部用程式做（貼圖都是 canvas 畫的）；沒有真的警徽：只有「警察」「POLICE」字、藍白條紋、一般的盾牌星星圖形
// 世界座標跟 village.js 一樣：x 往東、y 往上、z 往南；heading／rotation.y：0 朝東、π/2 朝北
// 位置：大路西段南邊（x −385…−341、z 6…33.5），從 W 路口（−345, 0）往南開進前院；大樓 x −380…−354、z 20…32，大門朝北（大路）
// 【API】
//   buildPoliceStation({ renderer }) → {       village.js 蓋村子的時候叫（外面）
//     group,                                   THREE.Group（村子的 group 裡）：大樓、前院的東西、兩台停著的警車（makePoliceCar）
//     colliders, pave,                         碰撞（跟 V.colliders 一樣）；水泥地 [{ x, z, hx, hz, rot, col（#hex）}]（village.js 用 addPave 畫、算路面）
//     place,                                   V.places.police：{ name, pos, spawn（警車從這裡開出去，朝大路）, zone（前院）, door（大門外面、朝外）,
//                                              yard（被抓以後你的車停這裡）, cell（拘留室裡面：人關在這裡）, counter（櫃台前面）, lot, building, cars（停著的警車）}
//     building,                                V.buildings 的一筆：{ kind: 'police', name: '警察局', x, z, hx, hz, rot: π, h, floors: 3, door: { x, z, ry } }
//     cars, info: { meshes, tris }, dispose(),
//   }
//   buildPoliceInterior({ renderer }) → {       一樓裡面（跟走進房子的模組 buildInterior 一樣的用法：放進自己的 THREE.Scene，燈都在 group 裡）
//     group,                                   已經擺在大樓的世界位置（position (−367, 0, 26)、rotation.y π）；本地：原點＝大樓中心的地面、+z＝正面（大門）
//     spawn,                                   從外面走進來站的地方（門裡面、面朝裡面）{ x, z, heading }
//     exitDoor, exits,                         走出去的長方形 { x, z, hx, hz, rot, to: 'outside', spawn: 門外（＝place.door）}（exits＝[exitDoor]）
//     colliders,                               世界座標；拘留室的鐵門是 cellCollider（關著才擋：開著的時候 hx、hz 變 0，同一個物件）
//     zones: { counter, cell },                櫃台前面、拘留室裡面（長方形 { x, z, hx, hz, rot }）
//     cell,                                    拘留室裡面站的地方 { x, z, heading }（＝place.cell）
//     setCellDoor(open), cellOpen,             拘留室的鐵門（true 開、false 關）：慢慢轉過去（update(dt) 裡），碰撞馬上換
//     update(dt),                              每一幀（鐵門轉動、日光燈）
//     spots: { stand, sit, counter },          放警察、民眾（跟 buildInterior 一樣的格式）
//     camera: { maxDist, ceiling, near }, bounds, background, info, dispose(),
//   }
//   makePoliceCar() → { group, setLights(on), update(dt), lights, info, dispose() }
//     台灣的警車樣子（白色車身、藍色腰線、「警察 POLICE」、車頂紅藍警示燈），不是哪一牌的車；group：車的中心在原點、車頭朝 +x、輪子踩在 y = 0（跟 carlod.js 一樣）
//     長 4.62、寬 1.80、高 1.62（含警示燈）；兩個 draw call（車身＋輪子一個、警示燈一個）；setLights(true)：紅藍一直閃（update(dt) 裡）
//   POLICE_LOOK：警察的樣子（charstub.js／character.js 的 look：淺藍襯衫、深藍褲子、帽子）
//   POLICE_TEXT：貼圖上的中文字（villageFonts 一起等字型）
import * as THREE from 'three';

// 打包（build-art.mjs、build-app.mjs）會拿掉 import、把 export 變成一般宣告：這個檔全部包在一個函式裡，只露出下面這些名字
export const { buildPoliceStation, buildPoliceInterior, makePoliceCar, POLICE_LOOK, POLICE_TEXT } = (() => {
const TAU = Math.PI * 2, R2 = Math.PI / 2;
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", "WenQuanYi Zen Hei", sans-serif';
const COND = '"Barlow Condensed", "Arial Narrow", sans-serif';
const POLICE_TEXT = '警察局為民服務拘留室公布欄治安宣導防詐騙報案請先登記上班時間值班台處理交通事故失物招領酒駕不開車安全帽禁止吸菸出入口';
const POLICE_LOOK = { body: 'm', age: 'adult', height: 1.76, build: 'mid', skin: '#d9a77f', hair: 'short', hairColor: '#141110', top: 'uniform', topColor: '#a9c9e8', bottom: 'pants', bottomColor: '#1c2638', shoes: 'leather', shoesColor: '#121212', hat: 'cap', hatColor: '#1c2638', glasses: 'none', mask: false };

// ---- 位置（世界座標）----
const ST = { x: -367, z: 26, rot: Math.PI, hx: 13, hz: 6, FH: 3.6, fl: 3 }; // 大樓中心、朝北（本地 +z → 世界 −z）；本地 +x → 世界 −x（西）
const LOT = { x0: -385, z0: 7.5, x1: -341, z1: 33.5 }; // 第 9 批（路變大）：大路寬 13.5，前面的圍牆從 z 6 往後到 7.5

// ---- 小工具 ----
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const CC = new Map();
const C = (hex) => { let v = CC.get(hex); if (!v) { const c = new THREE.Color(hex); v = [c.r, c.g, c.b]; CC.set(hex, v); } return v; };
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const WHITE = [1, 1, 1];
function frame(x, y, z, ry = 0) {
  const c = Math.cos(ry), n = Math.sin(ry);
  const f = { x, y, z, ry, p: (lx, ly, lz) => [x + lx * c + lz * n, y + ly, z - lx * n + lz * c] };
  f.sub = (lx, ly, lz, dry = 0) => { const q = f.p(lx, ly, lz); return frame(q[0], q[1], q[2], ry + dry); };
  return f;
}
const SF = frame(ST.x, 0, ST.z, ST.rot); // 大樓的本地框
const W2 = (lx, lz) => { const p = SF.p(lx, 0, lz); return [p[0], p[2]]; }; // 本地 → 世界 [x, z]
const hd = (lhx, lhz) => Math.atan2(-(-lhx * Math.sin(ST.rot) + lhz * Math.cos(ST.rot)), lhx * Math.cos(ST.rot) + lhz * Math.sin(ST.rot)); // 本地方向 → 世界 heading
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function fitFont(g, text, maxW, px, weight = 700, fam = SANS) { let s = px; for (; s > 8; s -= 2) { g.font = `${weight} ${s}px ${fam}`; if (g.measureText(text).width <= maxW) break; } return s; }
function rrect(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
function speck(g, R, w, h, n, style, s = 2) { for (let i = 0; i < n; i++) { g.fillStyle = typeof style === 'function' ? style() : style; g.fillRect(R() * w, R() * h, 1 + R() * s, 1 + R() * s); } }
function sheet(W, H) {
  const [c, g] = cv(W, H), uv = {};
  let px = 0, py = 0, rowH = 0;
  const reg = (name, x, y, w, h, draw) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); draw(g, w, h); g.restore(); return (uv[name] = [(x + 0.5) / W, 1 - (y + h - 0.5) / H, (x + w - 0.5) / W, 1 - (y + 0.5) / H]); };
  const pack = (name, w, h, draw) => { if (px + w > W) { px = 0; py += rowH; rowH = 0; } if (py + h > H) throw new Error(`police atlas full: ${name}`); const r = reg(name, px, py, w, h, draw); px += w; rowH = Math.max(rowH, h); return r; };
  return { c, g, uv, reg, pack };
}
const dotUV = (r) => { const u = (r[0] + r[2]) / 2, v = (r[1] + r[3]) / 2; return [u, v, u, v]; };
const subUV = (r, a, b, c, d) => [r[0] + (r[2] - r[0]) * a, r[1] + (r[3] - r[1]) * b, r[0] + (r[2] - r[0]) * c, r[1] + (r[3] - r[1]) * d];
const flipU = (r) => [r[2], r[1], r[0], r[3]];
function toTex(c, aniso) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; }
const stripes = (g, x, y, w, h, n = 3) => { g.fillStyle = '#1f4fa8'; g.fillRect(x, y, w, h); g.fillStyle = '#ffffff'; for (let i = 1; i <= n; i++) g.fillRect(x, y + (h * i) / (n + 1) - h * 0.06, w, h * 0.12); }; // 藍白條紋

// ---- 貼圖集（外面、裡面共用；1024×1024）----
let ATLAS = null;
function policeAtlas() {
  if (ATLAS) return ATLAS;
  const R = rng(110), S = sheet(1024, 1024), P = S.pack;
  P('sign', 1024, 112, (g, w, h) => { // 雨遮前面的大招牌（9.6 × 1.05 公尺）：深藍底白字「警察局」＋ POLICE、兩邊藍白條紋
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#20448f'); gr.addColorStop(1, '#16336e'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    stripes(g, 0, 0, 120, h, 3); stripes(g, w - 120, 0, 120, h, 3);
    g.fillStyle = '#ffffff'; g.fillRect(120, 6, w - 240, 3); g.fillRect(120, h - 9, w - 240, 3);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, '警察局', 360, 84); g.fillText('警察局', w / 2 - 70, h / 2 + 3);
    g.font = `700 44px ${COND}`; g.fillStyle = '#cfe0ff'; g.fillText('POLICE', w / 2 + 210, h / 2 + 5);
  });
  P('roofSign', 736, 128, (g, w, h) => { // 女兒牆上面的大字（白底藍字，9.2 × 1.6 公尺）
    g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, w, h); stripes(g, 0, 0, 110, h, 3); stripes(g, w - 110, 0, 110, h, 3);
    g.fillStyle = '#1b3f8c'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, '警察局', 420, 104); g.fillText('警察局', w / 2, h / 2 + 5);
  });
  P('stripe', 256, 64, (g, w, h) => stripes(g, 0, 0, w, h, 2)); // 牆上的藍白條紋帶
  P('win', 128, 128, (g, w, h) => { // 樓上的鋁窗（天空倒影、一半拉窗簾）
    g.fillStyle = '#c9ccd0'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w * 0.4, h); gr.addColorStop(0, '#9ec2de'); gr.addColorStop(0.5, '#5f7f99'); gr.addColorStop(1, '#394b5a'); g.fillStyle = gr; g.fillRect(6, 6, w - 12, h - 12);
    g.fillStyle = 'rgba(240,240,236,0.85)'; g.fillRect(6, 6, w * 0.42, h - 12); g.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = 10; x < w * 0.42; x += 7) g.fillRect(x, 6, 1.5, h - 12);
    g.fillStyle = '#b8bcc1'; g.fillRect(w / 2 - 3, 6, 6, h - 12); g.fillRect(6, h * 0.62, w - 12, 4);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.moveTo(w * 0.6, 6); g.lineTo(w * 0.8, 6); g.lineTo(w * 0.55, h - 6); g.lineTo(w * 0.35, h - 6); g.fill();
  });
  P('winB', 128, 128, (g, w, h) => { // 一樓的窗（百葉窗）
    g.fillStyle = '#d4d7da'; g.fillRect(0, 0, w, h); g.fillStyle = '#e9ebee'; g.fillRect(6, 6, w - 12, h - 12);
    g.fillStyle = 'rgba(0,0,0,0.13)'; for (let y = 8; y < h - 8; y += 5) g.fillRect(6, y, w - 12, 1.6);
    g.fillStyle = '#9aa0a6'; g.fillRect(w / 2 - 2, 6, 4, h - 12);
    g.fillStyle = 'rgba(160,190,220,0.25)'; g.fillRect(6, 6, w - 12, h - 12);
  });
  P('door', 256, 256, (g, w, h) => { // 玻璃大門（兩扇）：裡面亮亮的、推把、門上的字
    g.fillStyle = '#8f949a'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#dfe8ef'); gr.addColorStop(0.6, '#c9d4dc'); gr.addColorStop(1, '#a9b1b6'); g.fillStyle = gr; g.fillRect(10, 10, w / 2 - 14, h - 14); g.fillRect(w / 2 + 4, 10, w / 2 - 14, h - 14);
    g.fillStyle = 'rgba(40,60,90,0.25)'; g.fillRect(10, h * 0.55, w - 20, h * 0.1); // 裡面的櫃台（影子）
    g.fillStyle = '#6d7277'; g.fillRect(w / 2 - 22, h * 0.45, 8, 40); g.fillRect(w / 2 + 14, h * 0.45, 8, 40);
    g.fillStyle = '#1b3f8c'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 20px ${SANS}`; g.fillText('警察局', w / 4 + 2, 40); g.fillText('為民服務', w * 0.75 - 2, 40);
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.moveTo(40, 10); g.lineTo(70, 10); g.lineTo(20, h - 4); g.lineTo(10, h - 4); g.fill();
  });
  P('lamp', 64, 128, (g, w, h) => { // 門口兩邊的燈箱（白底藍字「警察」）
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b3f8c'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 40px ${SANS}`; g.fillText('警', w / 2, 38); g.fillText('察', w / 2, 88);
  });
  P('tile', 128, 128, (g, w, h) => { // 外牆的磁磚（淺灰白二丁掛）
    g.fillStyle = '#b8b6b0'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < h / 8; r++) for (let k = -1; k < w / 24 + 1; k++) { const x = k * 24 + (r % 2) * 12, v = 0.93 + R() * 0.07; g.fillStyle = `rgb(${Math.round(246 * v)},${Math.round(245 * v)},${Math.round(241 * v)})`; g.fillRect(x + 1, r * 8 + 1, 22, 6.2); }
  });
  P('flag', 128, 80, (g, w, h) => { g.fillStyle = '#1f4fa8'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(0, h * 0.4, w, h * 0.2); g.fillStyle = '#f2c230'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 7 : 16; g.lineTo(26 + Math.cos(a) * r, 20 + Math.sin(a) * r); } g.fill(); }); // 一般的旗子（不是哪一國的）
  P('board', 256, 128, (g, w, h) => { // 公布欄
    g.fillStyle = '#8a5a34'; g.fillRect(0, 0, w, h); g.fillStyle = '#c9a36b'; g.fillRect(6, 22, w - 12, h - 28);
    g.fillStyle = '#1b3f8c'; g.fillRect(6, 4, w - 12, 18); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 14px ${SANS}`; g.fillText('公布欄', w / 2, 13);
    const posters = [['治安宣導', '#e8f0ff', '#1b3f8c'], ['防詐騙', '#fff1d6', '#c62f25'], ['酒駕不開車', '#ffe3e3', '#c62f25'], ['失物招領', '#f2f3f5', '#333'], ['安全帽', '#e3f6e9', '#1f7a4c']];
    posters.forEach(([t, bg, fg], i) => { const x = 12 + (i % 3) * 80 + R() * 6, y = 28 + ((i / 3) | 0) * 50 + R() * 4; g.save(); g.translate(x + 34, y + 22); g.rotate((R() - 0.5) * 0.06); g.fillStyle = bg; g.fillRect(-34, -22, 68, 46); g.fillStyle = fg; g.font = `700 11px ${SANS}`; g.fillText(t, 0, -12); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let k = 0; k < 4; k++) g.fillRect(-26, -2 + k * 6, 52 * (0.5 + R() * 0.5), 2); g.fillStyle = '#d33'; g.beginPath(); g.arc(0, -20, 2.4, 0, TAU); g.fill(); g.restore(); });
  });
  P('slogan', 256, 64, (g, w, h) => { g.fillStyle = '#1b3f8c'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2c230'; g.fillRect(0, 4, w, 2); g.fillRect(0, h - 6, w, 2); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, '為民服務', 220, 40); g.fillText('為民服務', w / 2, h / 2 + 2); });
  P('cellSign', 128, 40, (g, w, h) => { g.fillStyle = '#2a2c30'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, '拘留室', w - 14, 28); g.fillText('拘留室', w / 2, h / 2 + 1); });
  P('counterSign', 128, 40, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b3f8c'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, '值班台', w - 14, 26); g.fillText('值班台', w / 2, h / 2 + 1); });
  P('notice', 128, 64, (g, w, h) => { g.fillStyle = '#fffbe8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c62f25'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); g.fillStyle = '#c62f25'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 16px ${SANS}`; g.fillText('報案請先登記', w / 2, 20); g.fillStyle = '#444'; g.font = `600 12px ${SANS}`; g.fillText('禁止吸菸', w / 2, 44); });
  P('screen', 64, 48, (g, w, h) => { g.fillStyle = '#20262c'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f6fd6'; g.fillRect(3, 3, w - 6, h - 6); g.fillStyle = '#e8eef5'; g.fillRect(6, 8, w - 12, h - 16); g.fillStyle = '#6b7c8f'; for (let y = 11; y < h - 10; y += 4) g.fillRect(8, y, (w - 18) * (0.4 + R() * 0.6), 1.6); }); // 電腦螢幕
  P('view', 256, 128, (g, w, h) => { // 窗外（前院、樹、大路對面的房子）：亮亮的
    const gr = g.createLinearGradient(0, 0, 0, h * 0.55); gr.addColorStop(0, '#9fc3e6'); gr.addColorStop(1, '#dfe9f0'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) { const x = i * 40 + R() * 10, hh = 30 + R() * 30; g.fillStyle = ['#f0e6d6', '#e9d8c9', '#dfe6ea', '#f3eee4'][i % 4]; g.fillRect(x, h * 0.55 - hh, 36, hh); g.fillStyle = 'rgba(80,100,120,0.4)'; for (let k = 0; k < 3; k++) g.fillRect(x + 6, h * 0.55 - hh + 6 + k * 9, 24, 4); }
    g.fillStyle = '#6f9a4a'; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(R() * w, h * 0.5 + R() * 6, 10 + R() * 12, 0, TAU); g.fill(); }
    g.fillStyle = '#c9c9c4'; g.fillRect(0, h * 0.58, w, h * 0.42); g.fillStyle = '#b0b0ab'; g.fillRect(0, h * 0.58, w, 3);
    g.fillStyle = '#f4f5f6'; rrect(g, 40, h * 0.62, 60, 22, 5); g.fill(); g.fillStyle = '#1f4fa8'; g.fillRect(40, h * 0.62 + 11, 60, 4); // 停著的警車
  });
  P('clock', 64, 64, (g, w, h) => { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(32, 32, 30, 0, TAU); g.fill(); g.strokeStyle = '#333'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.fillRect(32 + Math.cos(a) * 24 - 1.5, 32 + Math.sin(a) * 24 - 1.5, 3, 3); } g.lineWidth = 3; g.beginPath(); g.moveTo(32, 32); g.lineTo(32, 14); g.moveTo(32, 32); g.lineTo(44, 36); g.stroke(); });
  P('floor', 128, 128, (g, w, h) => { g.fillStyle = '#d8d6cf'; g.fillRect(0, 0, w, h); speck(g, R, w, h, 900, () => `rgba(${R() < 0.5 ? '90,88,84' : '255,255,255'},${0.15 + R() * 0.25})`, 2); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); }); // 磨石子地板（一格 1 公尺）
  P('ceil', 128, 128, (g, w, h) => { g.fillStyle = '#eeeeea'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); speck(g, R, w, h, 400, 'rgba(0,0,0,0.05)', 1.5); }); // 天花板（礦纖板）
  P('light', 64, 128, (g, w, h) => { g.fillStyle = '#d9dde0'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(8, 8, w - 16, h - 16); g.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 12; y < h - 10; y += 10) g.fillRect(8, y, w - 16, 1.5); }); // 日光燈
  P('cabinet', 128, 128, (g, w, h) => { g.fillStyle = '#9aa3aa'; g.fillRect(0, 0, w, h); g.fillStyle = '#b3bbc1'; for (let k = 0; k < 4; k++) { g.fillRect(6, 6 + k * 30, w - 12, 26); g.fillStyle = '#6f777d'; g.fillRect(w / 2 - 12, 16 + k * 30, 24, 4); g.fillStyle = '#b3bbc1'; } }); // 鐵櫃
  P('counter', 256, 64, (g, w, h) => { g.fillStyle = '#e9e5dc'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b3f8c'; g.fillRect(0, h * 0.35, w, h * 0.18); g.fillStyle = '#ffffff'; g.fillRect(0, h * 0.42, w, h * 0.04); g.fillStyle = 'rgba(0,0,0,0.1)'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 2, h); }); // 櫃台正面（藍白線）
  P('wall', 128, 128, (g, w, h) => { g.fillStyle = '#f1f0ec'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b3f8c'; g.fillRect(0, h * 0.62, w, h * 0.06); g.fillStyle = '#dcdad4'; g.fillRect(0, h * 0.68, w, h * 0.32); }); // 牆（腰帶一條藍線，下面灰一點）；一格 3.2 公尺高
  P('wood', 64, 64, (g, w, h) => { g.fillStyle = '#b08858'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(80,50,20,0.25)'; for (let y = 3; y < h; y += 5) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 2, w * 0.6, y - 2, w, y + 1); g.stroke(); } });
  P('conc', 64, 64, (g, w, h) => { g.fillStyle = '#c9c7c1'; g.fillRect(0, 0, w, h); speck(g, R, w, h, 300, () => `rgba(0,0,0,${0.04 + R() * 0.06})`, 2); });
  P('white', 16, 16, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); });
  ATLAS = S; return S;
}

// ---- 合併網格（一個材質一個）----
class PB {
  constructor() { this.bins = new Map(); this.e = 0; this.tris = 0; }
  tri(m, a, b, c, ta, tb, tc, col) {
    let g = this.bins.get(m); if (!g) this.bins.set(m, (g = { p: [], n: [], u: [], c: [], e: [] }));
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-12) return; nx /= l; ny /= l; nz /= l;
    g.p.push(...a, ...b, ...c); g.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz); g.u.push(ta[0], ta[1], tb[0], tb[1], tc[0], tc[1]);
    const cc = Array.isArray(col[0]) ? col : [col, col, col]; for (const q of cc) g.c.push(q[0], q[1], q[2]); g.e.push(this.e, this.e, this.e); this.tris++;
  }
  quad(m, a, b, c, d, uv, col) { const [u0, v0, u1, v1] = uv; this.tri(m, a, b, c, [u0, v0], [u1, v0], [u1, v1], col); this.tri(m, a, c, d, [u0, v0], [u1, v1], [u0, v1], col); }
  mesh(m, mat, name) {
    const g = this.bins.get(m); if (!g) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.u, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3)); geo.setAttribute('emis', new THREE.Float32BufferAttribute(g.e, 1));
    geo.computeBoundingSphere(); const o = new THREE.Mesh(geo, mat); o.name = name; o.matrixAutoUpdate = false; return o;
  }
}
// 有 emis（自己會亮多少）的標準材質（招牌、燈箱、日光燈）
function stdMat(tex, o = {}) {
  const m = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.78, metalness: 0, ...o });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float emis;\nvarying float vEmis;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmis = emis;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vEmis;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vEmis;');
  };
  m.customProgramCacheKey = () => 'police-std';
  return m;
}
// 畫圖的小工具（都畫到 B）
function shapes(B, U) {
  const W0 = dotUV(U.white);
  const box = (m, T, b, col, uv = {}) => {
    const [x0, y0, z0, x1, y1, z1] = b, P = T.p;
    const f = (k, a, bb, c, d) => { const u = uv[k] !== undefined ? uv[k] : uv._; if (u === false) return; const cc = Array.isArray(col) ? col : col[k] || col._ || WHITE; B.quad(m, P(...a), P(...bb), P(...c), P(...d), u || W0, cc); };
    f('pz', [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); f('nz', [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    f('px', [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]); f('nx', [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    f('py', [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    if (uv.ny !== undefined && uv.ny !== false) f('ny', [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  };
  const vq = (m, T, a, b, y0, y1, uv, col = WHITE) => B.quad(m, T.p(a[0], y0, a[1]), T.p(b[0], y0, b[1]), T.p(b[0], y1, b[1]), T.p(a[0], y1, a[1]), uv, col);
  const face = (m, T, x0, x1, y0, y1, z, uv, col = WHITE) => vq(m, T, [x0, z], [x1, z], y0, y1, uv, col); // 朝本地 +z
  const faceN = (m, T, x0, x1, y0, y1, z, uv, col = WHITE) => vq(m, T, [x1, z], [x0, z], y0, y1, uv, col); // 朝本地 −z
  const faceX = (m, T, z0, z1, y0, y1, x, uv, col = WHITE) => vq(m, T, [x, z1], [x, z0], y0, y1, uv, col); // 朝本地 +x
  const faceNX = (m, T, z0, z1, y0, y1, x, uv, col = WHITE) => vq(m, T, [x, z0], [x, z1], y0, y1, uv, col); // 朝本地 −x
  const floor = (m, T, x0, z0, x1, z1, y, uv, col = WHITE) => B.quad(m, T.p(x0, y, z1), T.p(x1, y, z1), T.p(x1, y, z0), T.p(x0, y, z0), uv, col);
  const ceil = (m, T, x0, z0, x1, z1, y, uv, col = WHITE) => B.quad(m, T.p(x0, y, z0), T.p(x1, y, z0), T.p(x1, y, z1), T.p(x0, y, z1), uv, col);
  const cyl = (m, T, x, z, y0, y1, r0, r1, n, col, uv = null) => {
    const P = (a, r, y) => T.p(x + Math.cos(a) * r, y, z - Math.sin(a) * r), u = uv || W0;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, b = ((i + 1) / n) * TAU; B.quad(m, P(a, r0, y0), P(b, r0, y0), P(b, r1, y1), P(a, r1, y1), u, col); B.tri(m, T.p(x, y1, z), P(a, r1, y1), P(b, r1, y1), W0, W0, W0, col); }
  };
  // 磁磚牆：一片一片（每片 tw × th 公尺貼一次 uv）
  const tiled = (m, T, x0, x1, y0, y1, z, uv, tw, th, col = WHITE, dir = 1) => {
    for (let x = x0; x < x1 - 1e-6; x += tw) for (let y = y0; y < y1 - 1e-6; y += th) {
      const xa = x, xb = Math.min(x1, x + tw), ya = y, yb = Math.min(y1, y + th), su = subUV(uv, 0, 0, (xb - xa) / tw, (yb - ya) / th);
      if (dir > 0) face(m, T, xa, xb, ya, yb, z, su, col); else faceN(m, T, xa, xb, ya, yb, z, su, col);
    }
  };
  return { box, vq, face, faceN, faceX, faceNX, floor, ceil, cyl, tiled, W0 };
}

// ======== 警車 ========
let CAR_KIT = null;
function carKit() { // 警車的車身貼圖（所有警車共用）：側面、引擎蓋、前、後、車窗
  if (CAR_KIT) return CAR_KIT;
  const S = sheet(1024, 512), P = S.pack;
  const side = (g, w, h, flip) => { // 側面：x 0…w＝車尾…車頭（flip：左邊那面，字要正的）；y 0 上
    g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, w, h);
    const X = (u) => (flip ? w - u * w : u * w); // u：0 車尾 → 1 車頭
    g.fillStyle = '#1d4fb0'; g.fillRect(0, h * 0.42, w, h * 0.2); g.fillStyle = '#7fb0ff'; g.fillRect(0, h * 0.64, w, h * 0.035); // 藍色腰線＋細的淺藍線
    g.fillStyle = '#ffffff'; g.textBaseline = 'middle'; g.font = `900 ${Math.round(h * 0.17)}px ${SANS}`; g.textAlign = 'center';
    g.fillText('警 察', X(0.6), h * 0.525); g.font = `700 ${Math.round(h * 0.12)}px ${COND}`; g.fillText('POLICE', X(0.33), h * 0.53);
    g.fillStyle = '#1d4fb0'; g.font = `700 ${Math.round(h * 0.09)}px ${COND}`; g.fillText('110', X(0.12), h * 0.3);
    g.strokeStyle = 'rgba(40,44,50,0.55)'; g.lineWidth = 2; for (const u of [0.36, 0.555, 0.74]) { g.beginPath(); g.moveTo(X(u), h * 0.08); g.lineTo(X(u), h * 0.92); g.stroke(); } // 車門縫
    g.fillStyle = '#2a2c30'; for (const u of [0.46, 0.66]) g.fillRect(X(u) - 9, h * 0.33, 18, 5); // 門把
    g.fillStyle = '#16171a'; for (const u of [0.186, 0.814]) { g.beginPath(); g.ellipse(X(u), h, w * 0.085, h * 0.62, 0, Math.PI, TAU); g.fill(); } // 輪拱（黑）
    g.fillStyle = '#3b3e44'; g.fillRect(0, h * 0.9, w, h * 0.1); // 下面的裙邊
  };
  P('sideR', 512, 128, (g, w, h) => side(g, w, h, false));
  P('sideL', 512, 128, (g, w, h) => side(g, w, h, true));
  P('hood', 256, 128, (g, w, h) => { g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d4fb0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 60px ${SANS}`; g.fillText('警察', w / 2, h / 2 + 4); }); // 引擎蓋（站在車頭前面看是正的）
  P('front', 256, 64, (g, w, h) => { g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b1c1f'; rrect(g, w * 0.3, h * 0.35, w * 0.4, h * 0.4, 6); g.fill(); for (const x of [0.12, 0.88]) { g.fillStyle = '#dfe6ee'; rrect(g, w * x - 26, h * 0.22, 52, 20, 6); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w * x, h * 0.4, 7, 0, TAU); g.fill(); } g.fillStyle = '#2a2c30'; g.fillRect(0, h * 0.82, w, h * 0.18); g.fillStyle = '#f2c230'; g.fillRect(w * 0.42, h * 0.55, w * 0.16, h * 0.16); }); // 車頭：水箱罩、大燈、車牌
  P('rear', 256, 64, (g, w, h) => { g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, w, h); for (const x of [0.1, 0.9]) { g.fillStyle = '#b3121a'; rrect(g, w * x - 28, h * 0.2, 56, 18, 5); g.fill(); g.fillStyle = '#ff9a9a'; g.fillRect(w * x - 20, h * 0.26, 14, 6); } g.fillStyle = '#ffffff'; g.fillRect(w * 0.4, h * 0.5, w * 0.2, h * 0.2); g.strokeStyle = '#333'; g.strokeRect(w * 0.4, h * 0.5, w * 0.2, h * 0.2); g.fillStyle = '#2a2c30'; g.fillRect(0, h * 0.82, w, h * 0.18); g.fillStyle = '#1d4fb0'; g.font = `700 14px ${COND}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('POLICE', w / 2, h * 0.3); });
  P('glass', 64, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#5d7488'); gr.addColorStop(0.5, '#1d2630'); gr.addColorStop(1, '#0e1319'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(w * 0.2, 0); g.lineTo(w * 0.45, 0); g.lineTo(w * 0.15, h); g.lineTo(0, h); g.fill(); });
  P('sideGlass', 256, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6a8196'); gr.addColorStop(1, '#141a20'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#16171a'; g.fillRect(w * 0.47, 0, w * 0.05, h); g.fillRect(0, 0, w, 3); g.fillRect(0, h - 4, w, 4); }); // 側窗（中間 B 柱）
  P('tire', 128, 128, (g, w, h) => { g.fillStyle = '#151518'; g.beginPath(); g.arc(64, 64, 63, 0, TAU); g.fill(); g.fillStyle = '#b9bdc2'; g.beginPath(); g.arc(64, 64, 38, 0, TAU); g.fill(); g.fillStyle = '#8a8f95'; for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; g.beginPath(); g.ellipse(64 + Math.cos(a) * 20, 64 + Math.sin(a) * 20, 8, 11, a, 0, TAU); g.fill(); } g.fillStyle = '#444'; g.beginPath(); g.arc(64, 64, 7, 0, TAU); g.fill(); }); // 輪子正面（鋁圈）
  P('dark', 16, 16, (g, w, h) => { g.fillStyle = '#18191c'; g.fillRect(0, 0, w, h); });
  P('white', 16, 16, (g, w, h) => { g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, w, h); });
  P('bar', 64, 32, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = 4; x < w; x += 8) g.fillRect(x, 0, 1.5, h); }); // 警示燈的燈罩（顏色用頂點色）
  const tex = new THREE.CanvasTexture(S.c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const body = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.35, metalness: 0.15 });
  const U = S.uv;
  // 車身幾何（所有警車共用一份）
  const B = new PB(), m = 'b';
  const L = 4.62, Wd = 1.8;
  const q = (a, b, c, d, uv) => B.quad(m, a, b, c, d, uv, WHITE);
  const prof = [[2.31, 0.3], [2.36, 0.58], [2.24, 0.8], [1.02, 0.95], [-1.9, 1.0], [-2.3, 0.97], [-2.36, 0.58], [-2.3, 0.3]]; // 下半部的側面輪廓（x 往前、y 往上）：車頭下 → 車尾下
  const hz = Wd / 2, sideUV = (x, y, s) => { const u = (x + L / 2) / L, v = (y - 0.28) / 0.74; const r = s > 0 ? U.sideR : U.sideL; return [r[0] + (r[2] - r[0]) * (s > 0 ? u : 1 - u), r[1] + (r[3] - r[1]) * v]; };
  // 兩側（扇形三角形：從輪廓中間往外）
  for (const s of [1, -1]) {
    const c = [0, 0.62];
    for (let i = 0; i < prof.length; i++) {
      const a = prof[i], b = prof[(i + 1) % prof.length];
      const A = [a[0], a[1], s * hz], Bp = [b[0], b[1], s * hz], Cc = [c[0], c[1], s * hz];
      if (s > 0) B.tri(m, Cc, A, Bp, sideUV(c[0], c[1], s), sideUV(a[0], a[1], s), sideUV(b[0], b[1], s), WHITE);
      else B.tri(m, Cc, Bp, A, sideUV(c[0], c[1], s), sideUV(b[0], b[1], s), sideUV(a[0], a[1], s), WHITE);
    }
  }
  // 輪廓一圈（車頭、引擎蓋、車頂的下半、車尾⋯）
  // 每一段：(a, +z) (a, −z) (b, −z) (b, +z)；u 橫跨車寬（+z 在左）、v 從 a 到 b；車尾往下走，整個轉 180 度
  const rot180 = (r) => [r[2], r[3], r[0], r[1]];
  const edgeUV = [subUV(U.front, 0, 0, 1, 0.45), subUV(U.front, 0, 0.45, 1, 1), U.hood, dotUV(U.white), dotUV(U.white), rot180(U.rear), dotUV(U.dark), dotUV(U.dark)];
  for (let i = 0; i < prof.length; i++) { const a = prof[i], b = prof[(i + 1) % prof.length]; q([a[0], a[1], hz], [a[0], a[1], -hz], [b[0], b[1], -hz], [b[0], b[1], hz], edgeUV[i]); }
  // 車廂（玻璃、車頂）：腰線寬 0.8、車頂寬 0.66
  const gA = [0.98, 0.95], gB = [0.12, 1.4], gC = [-1.05, 1.42], gD = [-1.82, 1.0], zb = 0.8, zt = 0.64;
  const P3 = (p, z) => [p[0], p[1], z];
  q(P3(gA, zb), P3(gA, -zb), P3(gB, -zt), P3(gB, zt), U.glass); // 前擋
  q(P3(gB, zt), P3(gB, -zt), P3(gC, -zt), P3(gC, zt), dotUV(U.white)); // 車頂
  q(P3(gC, zt), P3(gC, -zt), P3(gD, -zb), P3(gD, zb), U.glass); // 後擋
  for (const s of [1, -1]) { // 側窗：A→D 腰線、B→C 車頂邊
    const a = P3(gA, s * zb), b = P3(gB, s * zt), c = P3(gC, s * zt), d = P3(gD, s * zb), g = U.sideGlass;
    if (s > 0) { q(d, a, b, c, [g[0], g[1], g[2], g[3]]); } else { q(a, d, c, b, [g[2], g[1], g[0], g[3]]); }
  }
  // 輪子（4 個，8 邊形）：輪胎側面（黑）、正面（鋁圈）
  const wheelAt = (cx, cz, s) => {
    const r = 0.33, n = 10, w0 = cz - s * 0.11, w1 = cz + s * 0.11, tu = U.tire;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU, p = (a, z) => [cx + Math.cos(a) * r, r + Math.sin(a) * r, z];
      if (s > 0) q(p(a0, w0), p(a1, w0), p(a1, w1), p(a0, w1), dotUV(U.dark)); else q(p(a1, w0), p(a0, w0), p(a0, w1), p(a1, w1), dotUV(U.dark));
      const cu = (a) => [(tu[0] + tu[2]) / 2 + Math.cos(a) * (tu[2] - tu[0]) / 2, (tu[1] + tu[3]) / 2 + Math.sin(a) * (tu[3] - tu[1]) / 2];
      const ctr = [cx, r, w1], cuv = [(tu[0] + tu[2]) / 2, (tu[1] + tu[3]) / 2];
      if (s > 0) B.tri(m, ctr, p(a0, w1), p(a1, w1), cuv, cu(a0), cu(a1), WHITE); else B.tri(m, ctr, p(a1, w1), p(a0, w1), cuv, cu(a1), cu(a0), WHITE);
    }
  };
  for (const x of [1.45, -1.45]) for (const s of [1, -1]) wheelAt(x, s * 0.8, s);
  // 後照鏡、警示燈的底座
  for (const s of [1, -1]) { const y0 = 0.93, y1 = 1.08, x0 = 0.86, x1 = 1.0, z0 = s * 0.9, z1 = s * 1.04; q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], dotUV(U.white)); q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], dotUV(U.dark)); q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], dotUV(U.white)); }
  const bodyGeo = B.mesh(m, body, 'police-body').geometry;
  // 警示燈（每台自己一份：頂點色會變）：兩半（左紅右藍），車頂 y 1.42
  const LB = new PB(), lx0 = -0.42, lx1 = -0.16, ly0 = 1.42, ly1 = 1.56, lz = 0.6;
  const lq = (a, b, c, d) => LB.quad('l', a, b, c, d, U.bar, WHITE);
  const half = (z0, z1) => { lq([lx1, ly0, z1], [lx1, ly0, z0], [lx1, ly1, z0], [lx1, ly1, z1]); lq([lx0, ly0, z0], [lx0, ly0, z1], [lx0, ly1, z1], [lx0, ly1, z0]); lq([lx0, ly1, z1], [lx1, ly1, z1], [lx1, ly1, z0], [lx0, ly1, z0]); lq([lx0, ly0, z1], [lx1, ly0, z1], [lx1, ly1, z1], [lx0, ly1, z1]); lq([lx1, ly0, z0], [lx0, ly0, z0], [lx0, ly1, z0], [lx1, ly1, z0]); };
  half(-lz, -0.02); half(0.02, lz); // 左半（−z）：紅、右半（+z）：藍
  const barGeo = LB.mesh('l', null, 'police-bar').geometry; barGeo.deleteAttribute('emis');
  const nBar = barGeo.attributes.position.count;
  CAR_KIT = { tex, body, bodyGeo, barGeo, nBar, tris: bodyGeo.attributes.position.count / 3 + nBar / 3 };
  return CAR_KIT;
}
function makePoliceCar() {
  const K = carKit(), group = new THREE.Group(); group.name = 'police-car';
  const bodyM = new THREE.Mesh(K.bodyGeo, K.body); bodyM.name = 'police-body'; group.add(bodyM);
  const geo = K.barGeo.clone(), col = geo.attributes.color, half = K.nBar / 2;
  const mat = new THREE.MeshBasicMaterial({ map: K.tex, vertexColors: true, toneMapped: false });
  const bar = new THREE.Mesh(geo, mat); bar.name = 'police-bar'; group.add(bar);
  let on = false, t = 0, last = -1;
  const paint = (r, b) => { // r、b：紅、藍兩半多亮（0…1）
    const R = [0.25 + 2.2 * r, 0.03 + 0.25 * r, 0.03 + 0.2 * r], Bc = [0.03 + 0.15 * b, 0.1 + 0.6 * b, 0.35 + 2.6 * b];
    for (let i = 0; i < K.nBar; i++) { const c = i < half ? R : Bc; col.setXYZ(i, c[0], c[1], c[2]); }
    col.needsUpdate = true;
  };
  paint(0, 0);
  const car = {
    group, lights: false, info: { tris: K.tris, draws: 2 },
    setLights(v) { on = !!v; car.lights = on; if (!on) { paint(0, 0); last = -1; } },
    update(dt) { // 紅藍輪流閃兩下（一圈 0.8 秒）
      if (!on) return; t = (t + dt) % 0.8;
      const k = Math.floor(t / 0.1); if (k === last) return; last = k;
      const r = k === 0 || k === 2 ? 1 : 0, b = k === 4 || k === 6 ? 1 : 0; paint(r, b);
    },
    dispose() { geo.dispose(); mat.dispose(); group.removeFromParent(); },
  };
  return car;
}

// ======== 警察局（外面）========
function buildPoliceStation(opts = {}) {
  const aniso = opts.renderer ? Math.min(8, opts.renderer.capabilities.getMaxAnisotropy()) : 4;
  const A = policeAtlas(), U = A.uv, tex = toTex(A.c, aniso);
  const mat = stdMat(tex);
  const B = new PB(), S = shapes(B, U), { box, face, faceN, faceX, faceNX, cyl, tiled, W0 } = S;
  const colliders = [], pave = [];
  const addBox = (x, z, hx, hz, rot, h) => colliders.push({ t: 'box', x, z, hx, hz, rot, h });
  const addCircle = (x, z, r, h) => colliders.push({ t: 'circle', x, z, r, h });
  const T = SF, FH = ST.FH, H = FH * ST.fl, hx = ST.hx, hz = ST.hz, m = 's';
  const wallC = C('#f2f1ec'), trim = C('#c9ccd0'), dark = C('#3a3d42');
  // ---- 大樓：正面白色磁磚、兩側和後面油漆牆、每層一條線腳、一樓上面藍白條紋帶 ----
  box(m, T, [-hx, 0, -hz, hx, H, hz], { _: C('#e9e7e1'), py: C('#b9b8b2') }, { pz: false, py: U.conc, _: dotUV(U.white) });
  tiled(m, T, -hx, hx, 0, H, hz, U.tile, 1.6, 1.6, wallC);
  for (const s of [1, -1]) for (let f = 0; f < ST.fl; f++) for (const zc of [-3.2, 0, 3.2]) { // 側面的窗
    const y0 = f * FH + 1.0, y1 = f * FH + 2.5;
    if (s > 0) faceX(m, T, zc - 0.9, zc + 0.9, y0, y1, hx + 0.02, U.win); else faceNX(m, T, zc - 0.9, zc + 0.9, y0, y1, -hx - 0.02, U.win);
  }
  for (let f = 1; f < ST.fl; f++) for (let k = -2; k <= 2; k++) { faceN(m, T, k * 4.6 - 1.2, k * 4.6 + 1.2, f * FH + 1.0, f * FH + 2.5, -hz - 0.02, U.win); } // 後面的窗
  // 正面：一樓大門、窗；樓上每層 5 個窗（鋁框、窗台）
  for (let f = 1; f < ST.fl; f++) {
    for (const xc of [-10, -5, 0, 5, 10]) {
      face(m, T, xc - 1.6, xc + 1.6, f * FH + 0.95, f * FH + 2.65, hz + 0.02, U.win);
      box(m, T, [xc - 1.75, f * FH + 0.82, hz, xc + 1.75, f * FH + 0.95, hz + 0.18], trim); // 窗台
      box(m, T, [xc - 1.75, f * FH + 2.65, hz, xc + 1.75, f * FH + 2.78, hz + 0.3], trim); // 窗楣（小雨遮）
    }
    box(m, T, [-hx, f * FH - 0.1, hz, hx, f * FH + 0.08, hz + 0.1], trim, { _: dotUV(U.white) }); // 樓層線腳
  }
  for (const xc of [-9.5, -5, 5, 9.5]) { face(m, T, xc - 1.8, xc + 1.8, 0.9, 2.6, hz + 0.02, U.winB); box(m, T, [xc - 1.95, 0.78, hz, xc + 1.95, 0.9, hz + 0.16], trim); }
  face(m, T, -1.5, 1.5, 0, 2.7, hz + 0.02, U.door); box(m, T, [-1.7, 2.7, hz, 1.7, 2.95, hz + 0.12], dark); // 大門
  for (let x = -hx; x < hx - 1e-6; x += 4) face(m, T, x, Math.min(hx, x + 4), 3.05, 3.5, hz + 0.03, subUV(U.stripe, 0, 0, Math.min(1, (hx - x) / 4), 1)); // 一樓上面的藍白條紋帶
  // 女兒牆：白色、正面中間大字「警察局」、兩邊藍白條紋
  const ph = 1.3;
  box(m, T, [-hx, H, hz - 0.25, hx, H + ph, hz], wallC, { pz: false, _: dotUV(U.white) });
  box(m, T, [-hx, H, -hz, hx, H + ph, -hz + 0.25], wallC); box(m, T, [-hx, H, -hz + 0.25, -hx + 0.25, H + ph, hz - 0.25], wallC); box(m, T, [hx - 0.25, H, -hz + 0.25, hx, H + ph, hz - 0.25], wallC);
  for (let x = -hx; x < hx - 1e-6; x += 4) face(m, T, x, Math.min(hx, x + 4), H + 0.15, H + ph - 0.15, hz + 0.01, subUV(U.stripe, 0, 0, Math.min(1, (hx - x) / 4), 1));
  face(m, T, -hx, hx, H, H + 0.15, hz + 0.01, W0, wallC); face(m, T, -hx, hx, H + ph - 0.15, H + ph, hz + 0.01, W0, wallC);
  B.e = 0.25; box(m, T, [-4.6, H + 0.05, hz + 0.02, 4.6, H + ph + 0.35, hz + 0.18], WHITE, { pz: U.roofSign, _: dotUV(U.white) }); B.e = 0; // 屋頂的大字
  // 頂樓：樓梯間、水塔
  box(m, T, [6, H, -hz + 1, 11, H + 3, -hz + 5], C('#e4e2dc'), { _: dotUV(U.white) }); cyl(m, T, -8, -2, H, H + 1.8, 0.8, 0.8, 10, C('#dfe3e6')); cyl(m, T, -8, -2, H + 1.8, H + 2.1, 0.8, 0.1, 10, C('#c9cdd1'));
  // 雨遮（門口）：兩根柱子、前面的招牌、兩邊燈箱
  const cz0 = hz, cz1 = hz + 3.5, cy = 3.55;
  box(m, T, [-5, cy, cz0, 5, cy + 0.3, cz1], { _: C('#e6e5e0'), ny: C('#d6d5d0') }, { _: dotUV(U.white), ny: dotUV(U.white) });
  B.e = 0.18; face(m, T, -4.8, 4.8, cy - 0.35, cy + 0.65, cz1 + 0.01, U.sign); B.e = 0;
  box(m, T, [-5, cy - 0.4, cz1 - 0.05, 5, cy - 0.35, cz1 + 0.02], dark);
  for (const s of [1, -1]) {
    box(m, T, [s * 4.6 - 0.2, 0, cz1 - 0.55, s * 4.6 + 0.2, cy, cz1 - 0.15], C('#dcdcd6'));
    const c = T.p(s * 4.6, 0, cz1 - 0.35); addBox(c[0], c[2], 0.22, 0.22, 0, cy);
    B.e = 0.7; box(m, T, [s * 4.6 - 0.16, 1.7, cz1 - 0.15, s * 4.6 + 0.16, 2.35, cz1 - 0.02], WHITE, { pz: U.lamp, _: dotUV(U.white) }); B.e = 0; // 燈箱（亮）
  }
  box(m, T, [-3.2, 0, hz, 3.2, 0.12, cz1 - 0.6], C('#b9b7b0'), { _: dotUV(U.conc) }); // 門口的平台（一階）
  addBox(ST.x, ST.z, hx, hz, 0, H + ph);
  // ---- 前院：水泥地、停車格、旗桿、矮牆＋欄杆、機車 ----
  pave.push({ x: (LOT.x0 + LOT.x1) / 2, z: (LOT.z0 + 20) / 2, hx: (LOT.x1 - LOT.x0) / 2, hz: (20 - LOT.z0) / 2, col: '#c4c4bf' }); // 前院 z 6…20
  pave.push({ x: -347.5, z: 26.75, hx: 6.5, hz: 6.75, col: '#bdbdb8' }, { x: -382.5, z: 26.75, hx: 2.5, hz: 6.75, col: '#bdbdb8' }); // 大樓兩邊
  pave.push({ x: -345, z: 5.25, hx: 3.5, hz: 0.8, col: '#c4c4bf' }); // 車道口
  const line = (x0, z0, x1, z1) => { const T2 = frame((x0 + x1) / 2, 0.035, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0)), L = Math.hypot(x1 - x0, z1 - z0) / 2; S.floor(m, T2, -L, -0.06, L, 0.06, 0, W0, C('#f2f3f5')); };
  for (const x of [-383.8, -380.2, -376.6]) line(x, 12.2, x, 17.8); line(-383.8, 12.2, -376.6, 12.2); // 警車的停車格
  for (const x of [-362.3, -358.7, -355.1]) line(x, 12.2, x, 17.8); line(-362.3, 12.2, -355.1, 12.2); // 訪客（你的車被拖來也停這裡）
  // 旗桿（一般的藍色旗子）
  { const fx = -356.5, fz = 9.5, F = frame(fx, 0, fz, 0); box(m, F, [-0.6, 0, -0.6, 0.6, 0.35, 0.6], C('#bdbbb4'), { _: dotUV(U.conc) }); cyl(m, F, 0, 0, 0.35, 11.5, 0.07, 0.05, 6, C('#e3e5e8')); cyl(m, F, 0, 0, 11.5, 11.65, 0.1, 0.1, 6, C('#f2c230'));
    const fl = U.flag, n = 6; for (let i = 0; i < n; i++) { const a = i / n, b = (i + 1) / n, xa = a * 1.9, xb = b * 1.9, za = Math.sin(a * 5) * 0.12, zb = Math.sin(b * 5) * 0.12, u = subUV(fl, a, 0, b, 1); B.quad(m, F.p(xa, 10.2, za), F.p(xb, 10.2, zb), F.p(xb, 11.4, zb), F.p(xa, 11.4, za), u, WHITE); B.quad(m, F.p(xb, 10.2, zb), F.p(xa, 10.2, za), F.p(xa, 11.4, za), F.p(xb, 11.4, zb), [u[2], u[1], u[0], u[3]], WHITE); }
    addCircle(fx, fz, 0.65, 11.6); }
  // 前面的矮牆＋欄杆（中間人走的門口、東邊車道口空著）
  const fence = (x0, x1, z) => { const Tf = frame((x0 + x1) / 2, 0, z, 0), L = (x1 - x0) / 2; box(m, Tf, [-L, 0, -0.15, L, 0.6, 0.15], C('#e8e6e0'), { _: dotUV(U.white) }); for (let x = -L; x < L - 1e-6; x += 4) { const xb = Math.min(L, x + 4); S.faceN(m, Tf, x, xb, 0.12, 0.48, -0.16, subUV(U.stripe, 0, 0, (xb - x) / 4, 1)); } for (let x = -L + 0.1; x <= L; x += 0.25) box(m, Tf, [x - 0.02, 0.6, -0.02, x + 0.02, 1.25, 0.02], C('#5a6068'), { py: false }); box(m, Tf, [-L, 1.2, -0.04, L, 1.26, 0.04], C('#5a6068')); addBox((x0 + x1) / 2, z, L, 0.18, 0, 1.25); };
  fence(LOT.x0, -369, LOT.z0 + 0.1); fence(-365, -349, LOT.z0 + 0.1);
  for (const [x0, x1] of [[-369.4, -369], [-365, -364.6]]) { const Tg = frame((x0 + x1) / 2, 0, LOT.z0 + 0.1, 0); box(m, Tg, [-0.2, 0, -0.2, 0.2, 1.5, 0.2], C('#dcdad4')); } // 人走的門口的門柱
  // 兩邊、後面的圍牆（矮一點）
  const wallL = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0) / 2, Tw = frame((x0 + x1) / 2, 0, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0)); box(m, Tw, [-L, 0, -0.12, L, 1.6, 0.12], C('#dedcd5'), { _: dotUV(U.conc) }); addBox((x0 + x1) / 2, (z0 + z1) / 2, L, 0.14, Math.atan2(-(z1 - z0), x1 - x0), 1.6); };
  wallL(LOT.x0, LOT.z0 + 0.3, LOT.x0, LOT.z1); wallL(LOT.x0, LOT.z1, -341, LOT.z1); wallL(-341, 20.5, -341, LOT.z1);
  // 警用機車（大樓東邊，三台）
  for (let i = 0; i < 3; i++) { const x = -352.2, z = 22.2 + i * 1.1, Tm = frame(x, 0, z, 0), wh = C('#f4f5f6'), bl = C('#1f4fa8'), dk = C('#2a2b2e');
    box(m, Tm, [-0.75, 0.28, -0.19, 0.5, 0.62, 0.19], wh); box(m, Tm, [-0.7, 0.44, -0.2, 0.45, 0.52, 0.2], bl); box(m, Tm, [-0.66, 0.62, -0.17, 0.05, 0.73, 0.17], dk); box(m, Tm, [0.46, 0.26, -0.22, 0.62, 0.98, 0.22], wh); box(m, Tm, [0.52, 0.96, -0.33, 0.58, 1.01, 0.33], dk);
    box(m, Tm, [-0.66, 0.73, -0.12, -0.36, 0.83, 0.12], C('#c62f25')); for (const wx of [-0.55, 0.6]) box(m, Tm, [wx - 0.2, 0, -0.05, wx + 0.2, 0.4, 0.05], dk); }
  addBox(-352.2, 23.3, 0.8, 1.7, 0, 1);
  // 兩台警車（停好、車頭朝大路）
  const cars = [];
  for (const x of [-382, -378.4]) { const car = makePoliceCar(); car.group.position.set(x, 0, 15.0); car.group.rotation.y = R2; car.group.updateMatrixWorld(true); cars.push(car); addBox(x, 15, 2.35, 0.92, R2, 1.5); }
  // ---- 組起來 ----
  const group = new THREE.Group(); group.name = 'police';
  const mesh = B.mesh(m, mat, 'police-st'); group.add(mesh);
  for (const c of cars) group.add(c.group);
  group.updateMatrixWorld(true);
  const door = W2(0, hz + 0.6);
  const cellL = [-10.7, -3.2], cell = W2(...cellL);
  const place = {
    name: '警察局', pos: [-363, 14],
    spawn: { x: -345, z: 10, heading: R2 },                              // 警車從前院開出去（朝大路）
    zone: { x: -363, z: 13, hx: 22, hz: 7, rot: 0 },                      // 前院
    door: { x: door[0], z: door[1], heading: R2 },                         // 大門外面（朝外＝北）
    yard: { x: -356.9, z: 15, heading: R2 },                                // 訪客停車格（被抓以後你的車停這裡）
    cell: { x: cell[0], z: cell[1], heading: hd(1, 0) },                    // 拘留室裡面（buildPoliceInterior 的；面朝鐵門）
    counter: (() => { const p = W2(0, 2.6); return { x: p[0], z: p[1], heading: hd(0, -1) }; })(), // 櫃台前面（面朝櫃台）
    lot: { ...LOT }, building: { x: ST.x, z: ST.z, hx, hz, rot: ST.rot },
    cars: cars.map((c) => ({ x: c.group.position.x, z: c.group.position.z, heading: R2 })),
  };
  const building = { kind: 'police', name: '警察局', x: ST.x, z: ST.z, hx, hz, rot: ST.rot, h: H + ph, floors: ST.fl, door: { x: door[0], z: door[1], ry: ST.rot } };
  let tris = B.tris; for (const c of cars) tris += c.info.tris;
  return {
    group, colliders, pave, place, building, cars,
    info: { meshes: 1 + cars.length * 2, tris: Math.round(tris) },
    dispose() { group.removeFromParent(); mesh.geometry.dispose(); mat.dispose(); tex.dispose(); for (const c of cars) c.dispose(); },
  };
}

// ======== 警察局（裡面：一樓）========
function buildPoliceInterior(opts = {}) {
  const aniso = opts.renderer ? Math.min(8, opts.renderer.capabilities.getMaxAnisotropy()) : 4;
  const A = policeAtlas(), U = A.uv, tex = toTex(A.c, aniso);
  const mat = stdMat(tex, { roughness: 0.7 });
  const B = new PB(), DB = new PB(), S = shapes(B, U), { box, face, faceN, faceX, faceNX, floor, ceil, W0 } = S;
  const colliders = [], m = 's', T = frame(0, 0, 0, 0); // 本地（group 放到大樓的位置）
  const X0 = -12.8, X1 = 12.8, Z0 = -5.8, Z1 = 5.8, CH = 3.2;
  const cl = (x0, z0, x1, z1, h) => { const p = W2((x0 + x1) / 2, (z0 + z1) / 2); const c = { t: 'box', x: p[0], z: p[1], hx: Math.abs(x1 - x0) / 2, hz: Math.abs(z1 - z0) / 2, rot: ST.rot, h }; colliders.push(c); return c; };
  // 地板、天花板、日光燈
  for (let x = X0; x < X1 - 1e-6; x += 1) for (let z = Z0; z < Z1 - 1e-6; z += 1) floor(m, T, x, z, Math.min(X1, x + 1), Math.min(Z1, z + 1), 0, subUV(U.floor, 0, 0, Math.min(1, X1 - x), Math.min(1, Z1 - z)));
  for (let x = X0; x < X1 - 1e-6; x += 1.6) for (let z = Z0; z < Z1 - 1e-6; z += 1.6) ceil(m, T, x, z, Math.min(X1, x + 1.6), Math.min(Z1, z + 1.6), CH, U.ceil);
  B.e = 1.0; for (const x of [-9.6, -4.8, 0, 4.8, 9.6]) for (const z of [-3.2, 0.8, 4.0]) ceil(m, T, x - 0.3, z - 0.6, x + 0.3, z + 0.6, CH - 0.01, U.light); B.e = 0;
  // 牆（裡面那一面）：一格 3.2 公尺、腰帶藍線
  const wallN = (x0, x1, z, dir) => { for (let x = x0; x < x1 - 1e-6; x += 3.2) { const xb = Math.min(x1, x + 3.2), su = subUV(U.wall, 0, 0, (xb - x) / 3.2, 1); if (dir > 0) face(m, T, x, xb, 0, CH, z, su); else faceN(m, T, x, xb, 0, CH, z, su); } };
  const wallX = (z0, z1, x, dir) => { for (let z = z0; z < z1 - 1e-6; z += 3.2) { const zb = Math.min(z1, z + 3.2), su = subUV(U.wall, 0, 0, (zb - z) / 3.2, 1); if (dir > 0) faceX(m, T, z, zb, 0, CH, x, su); else faceNX(m, T, z, zb, 0, CH, x, su); } };
  wallN(X0, -1.25, Z1, -1); wallN(1.25, X1, Z1, -1); face(m, T, -1.25, 1.25, 2.75, CH, Z1, dotUV(U.white), C('#e6e5e0')); // 前牆（大門上面）
  faceN(m, T, -1.25, 1.25, 0, 2.75, Z1 - 0.01, U.door); // 大門（從裡面看）
  wallN(X0, X1, Z0, 1); wallX(Z0, Z1, X0, 1); wallX(Z0, Z1, X1, -1);
  for (const xc of [-9.5, -5, 5, 9.5]) faceN(m, T, xc - 1.8, xc + 1.8, 0.9, 2.6, Z1 - 0.02, U.view); // 窗（外面亮亮的）
  cl(X0 - 0.3, Z1, -1.25, Z1 + 0.3, 3); cl(1.25, Z1, X1 + 0.3, Z1 + 0.3, 3); cl(X0 - 0.3, Z0 - 0.3, X1 + 0.3, Z0, 3); cl(X0 - 0.3, Z0, X0, Z1, 3); cl(X1, Z0, X1 + 0.3, Z1, 3);
  // 櫃台（值班台）：z 0.65…1.35、x −7.5…4.5；右邊留一個口
  const cBlue = C('#1b3f8c'), cTop = C('#d9d4c8');
  box(m, T, [-7.5, 0, 0.65, 4.5, 1.05, 1.35], { _: C('#e9e5dc'), py: cTop }, { pz: false, _: dotUV(U.white) });
  for (let x = -7.5; x < 4.5 - 1e-6; x += 3) face(m, T, x, Math.min(4.5, x + 3), 0, 1.05, 1.36, subUV(U.counter, 0, 0, Math.min(1, (4.5 - x) / 3), 1));
  box(m, T, [-7.6, 1.05, 1.1, 4.6, 1.12, 1.55], cTop, { _: dotUV(U.wood) }); // 上面的檯面（凸出來）
  B.e = 0.15; box(m, T, [-2.2, 1.12, 1.25, -0.6, 1.5, 1.32], WHITE, { pz: U.counterSign, nz: U.counterSign, _: dotUV(U.white) }); B.e = 0; // 值班台的小牌子
  cl(-7.5, 0.65, 4.5, 1.55, 1.1);
  // 辦公桌＋電腦＋椅子（櫃台後面）
  const desk = (x, z) => {
    box(m, T, [x - 0.7, 0.72, z - 0.35, x + 0.7, 0.76, z + 0.35], C('#c9c3b5'), { _: dotUV(U.wood) });
    box(m, T, [x - 0.66, 0, z - 0.3, x - 0.6, 0.72, z + 0.3], C('#8a8f95')); box(m, T, [x + 0.6, 0, z - 0.3, x + 0.66, 0.72, z + 0.3], C('#8a8f95'));
    box(m, T, [x - 0.14, 0.76, z + 0.02, x + 0.14, 0.8, z + 0.16], C('#2a2c30')); box(m, T, [x - 0.04, 0.8, z + 0.07, x + 0.04, 0.98, z + 0.11], C('#2a2c30'));
    B.e = 0.35; box(m, T, [x - 0.3, 0.95, z + 0.05, x + 0.3, 1.3, z + 0.1], { nz: WHITE, _: C('#2a2c30') }, { nz: U.screen, _: dotUV(U.white) }); B.e = 0; // 螢幕朝坐的人（−z）
    box(m, T, [x - 0.22, 0.76, z - 0.26, x + 0.22, 0.78, z - 0.1], C('#3a3d42')); // 鍵盤
    box(m, T, [x - 0.22, 0.42, z - 0.95, x + 0.22, 0.48, z - 0.55], C('#1f2328')); box(m, T, [x - 0.22, 0.48, z - 1.0, x + 0.22, 0.95, z - 0.94], C('#1f2328')); box(m, T, [x - 0.03, 0, z - 0.78, x + 0.03, 0.42, z - 0.72], C('#6f7378')); // 椅子
    cl(x - 0.7, z - 0.35, x + 0.7, z + 0.35, 0.8);
  };
  // 螢幕要朝坐的人：人坐在 z−0.75（面朝 +z），所以螢幕正面朝 −z
  const spots = { stand: [], sit: [], counter: [] };
  for (const [x, z] of [[-5.2, -0.9], [-1.8, -0.9], [1.6, -0.9], [-1.8, -3.9], [1.6, -3.9], [5.0, -3.9]]) {
    desk(x, z); const p = W2(x, z - 0.75); spots.sit.push({ x: p[0], z: p[1], heading: hd(0, 1), y: 0.45, room: '辦公室' });
  }
  // 鐵櫃、為民服務、時鐘
  for (let x = -6; x < 7; x += 1.0) box(m, T, [x, 0, Z0, x + 0.95, 1.9, Z0 + 0.5], C('#b3bbc1'), { pz: U.cabinet, _: dotUV(U.white) });
  cl(-6, Z0, 7, Z0 + 0.5, 1.9);
  B.e = 0.1; face(m, T, -2.4, 2.4, 2.15, 2.9, Z0 + 0.52, U.slogan); B.e = 0;
  face(m, T, 3.2, 3.8, 2.3, 2.9, Z0 + 0.52, U.clock);
  // 樓梯（西邊，往上，走不上去）
  const sc = C('#c9c7c1');
  for (let i = 0; i < 12; i++) box(m, T, [9.2, 0, Z0 + 0.3 + i * 0.35, 12.6, 0.18 + i * 0.18, Z0 + 0.3 + (i + 1) * 0.35], sc, { _: dotUV(U.conc) });
  box(m, T, [9.1, 0, Z0 + 0.3, 9.2, 3.2, Z0 + 4.5], C('#e9e7e1'));
  cl(9.1, Z0, X1, Z0 + 4.6, 3);
  // 公布欄（西牆）、提醒
  faceNX(m, T, 1.6, 5.2, 1.0, 2.4, X1 - 0.02, U.board);
  face(m, T, -1.8, -0.6, 1.5, 2.1, Z0 + 0.52, U.notice);
  // 等候椅（前牆裡面，兩排；椅背靠牆、面朝櫃台）
  const chairs = (x0, n, z) => { const blue = C('#2f6fd6'); for (let i = 0; i < n; i++) { const x = x0 + i * 0.55; box(m, T, [x, 0.42, z - 0.45, x + 0.5, 0.47, z], blue); box(m, T, [x, 0.47, z - 0.05, x + 0.5, 0.9, z], blue); const p = W2(x + 0.25, z - 0.25); spots.sit.push({ x: p[0], z: p[1], heading: hd(0, -1), y: 0.45, room: '等候區' }); }
    box(m, T, [x0, 0, z - 0.4, x0 + n * 0.55, 0.42, z - 0.36], C('#8a8f95')); cl(x0, z - 0.5, x0 + n * 0.55, z, 0.9); };
  chairs(3.2, 10, Z1 - 0.1); chairs(-10.6, 6, Z1 - 0.1);
  // 飲水機、盆栽
  box(m, T, [-12.6, 0, 3.3, -12.15, 1.2, 3.75], C('#e9ecef')); box(m, T, [-12.55, 1.2, 3.35, -12.2, 1.55, 3.7], C('#9cc7e4')); cl(-12.8, 3.3, -12.1, 3.8, 1.5);
  for (const x of [-2.2, 2.2]) { box(m, T, [x - 0.25, 0, 4.9, x + 0.25, 0.45, 5.4], C('#7a5a3a')); B.quad(m, T.p(x - 0.45, 0.45, 5.15), T.p(x + 0.45, 0.45, 5.15), T.p(x + 0.3, 1.5, 5.15), T.p(x - 0.3, 1.5, 5.15), dotUV(U.white), C('#4f8a3c')); B.quad(m, T.p(x, 0.45, 4.7), T.p(x, 0.45, 5.6), T.p(x, 1.5, 5.45), T.p(x, 1.5, 4.85), dotUV(U.white), C('#5e9a44')); cl(x - 0.3, 4.85, x + 0.3, 5.45, 1.5); }
  // ---- 拘留室：x −12.8…−8.5、z −5.8…−0.5；前面（x −8.5）鐵欄杆，門 z −2.3…−1.2 ----
  const CX = -8.5, cz0 = Z0, cz1 = -0.5, dz0 = -2.3, dz1 = -1.2, bar = C('#5f656c');
  box(m, T, [X0, 0, cz1, CX, CH, cz1 + 0.2], C('#e3e1db'), { _: dotUV(U.white) }); cl(X0, cz1, CX, cz1 + 0.2, 3);
  const bars = (z0, z1) => { for (let z = z0 + 0.06; z < z1; z += 0.13) box(m, T, [CX - 0.025, 0, z - 0.025, CX + 0.025, CH, z + 0.025], bar, { py: false }); box(m, T, [CX - 0.05, 1.05, z0, CX + 0.05, 1.12, z1], bar); box(m, T, [CX - 0.05, 2.3, z0, CX + 0.05, 2.38, z1], bar); cl(CX - 0.06, z0, CX + 0.06, z1, 3); };
  bars(cz0, dz0); bars(dz1, cz1);
  box(m, T, [CX - 0.06, 2.35, dz0, CX + 0.06, CH, dz1], bar); // 門上面
  B.e = 0.15; faceX(m, T, -2.6, -1.0, 2.55, 2.95, CX + 0.07, U.cellSign); B.e = 0;
  box(m, T, [X0, 0, -5.4, X0 + 0.6, 0.45, -1.2], C('#b9b7b0'), { _: dotUV(U.conc) }); cl(X0, -5.4, X0 + 0.6, -1.2, 0.45); // 水泥長椅
  box(m, T, [-10.2, 0, Z0, -10.1, 1.2, Z0 + 1.2], C('#d9d7d1')); box(m, T, [-9.9, 0, Z0 + 0.2, -9.3, 0.4, Z0 + 0.8], C('#f2f3f5')); cl(-10.2, Z0, -9.2, Z0 + 1.2, 1.2); // 廁所（矮牆）
  B.e = 0.8; ceil(m, T, -11.0, -3.6, -10.4, -2.4, CH - 0.01, U.light); B.e = 0;
  // 鐵門（會轉）：鉸鏈在 z −1.2，關著的時候沿著 z −2.3…−1.2；打開往辦公室那邊（+x）轉 100 度
  const DB2 = shapes(DB, U), dq = (x0, y0, z0, x1, y1, z1) => DB2.box(m, frame(0, 0, 0), [x0, y0, z0, x1, y1, z1], bar, { py: false });
  const dl = dz1 - dz0;
  for (let z = 0.08; z < dl - 0.03; z += 0.13) dq(-0.025, 0.02, -z - 0.025, 0.025, 2.33, -z + 0.025);
  dq(-0.04, 0, -dl, 0.04, 0.08, 0); dq(-0.04, 2.27, -dl, 0.04, 2.35, 0); dq(-0.04, 1.05, -dl, 0.04, 1.12, 0); dq(-0.05, 0, -0.06, 0.05, 2.35, 0); dq(-0.05, 0, -dl, 0.05, 2.35, -dl + 0.06);
  dq(0.05, 1.0, -dl + 0.1, 0.14, 1.2, -dl + 0.22); // 門鎖
  const doorMesh = DB.mesh(m, mat, 'police-cell-door'); doorMesh.matrixAutoUpdate = true; doorMesh.position.set(CX, 0, dz1);
  const cellCollider = cl(CX - 0.06, dz0, CX + 0.06, dz1, 3), cc0 = { hx: cellCollider.hx, hz: cellCollider.hz };
  let cellOpen = false, ang = 0;
  // ---- 燈（跟走進房子的模組一樣：半球光＋平行光；沒有陰影）----
  const group = new THREE.Group(); group.name = 'police-interior';
  const mesh = B.mesh(m, mat, 'police-int'); group.add(mesh, doorMesh);
  const hemi = new THREE.HemisphereLight(0xf4f7ff, 0x8a8478, 1.1); group.add(hemi);
  const dl2 = new THREE.DirectionalLight(0xfff6ea, 0.9); dl2.position.set(3, 8, 6); group.add(dl2, dl2.target);
  group.position.set(ST.x, 0, ST.z); group.rotation.y = ST.rot; group.updateMatrixWorld(true);
  // ---- 進出、區域 ----
  const R = (lx0, lz0, lx1, lz1) => { const p = W2((lx0 + lx1) / 2, (lz0 + lz1) / 2); return { x: p[0], z: p[1], hx: Math.abs(lx1 - lx0) / 2, hz: Math.abs(lz1 - lz0) / 2, rot: ST.rot }; };
  const sp = W2(0, 4.2), out = W2(0, ST.hz + 0.6);
  const outside = { x: out[0], z: out[1], heading: R2 };
  const exitDoor = { ...R(-1.2, 5.35, 1.2, 5.8), to: 'outside', spawn: outside };
  const cellP = W2(-10.7, -3.2), ctr = W2(0, 2.6);
  for (const x of [-4, -0.5, 3]) { const p = W2(x, 0.2); spots.counter.push({ x: p[0], z: p[1], heading: hd(0, 1), room: '值班台' }); }
  for (const [x, z, a, b] of [[-7.5, -2.5, 1, 0], [6.5, 3.2, -1, 0], [-11.5, 2.2, 1, 0]]) { const p = W2(x, z); spots.stand.push({ x: p[0], z: p[1], heading: hd(a, b), room: x < -8 ? '走廊' : '等候區' }); }
  const I = {
    group, colliders, cellCollider, spots,
    spawn: { x: sp[0], z: sp[1], heading: hd(0, -1) },
    exitDoor, exits: [exitDoor],
    zones: { counter: R(-7.5, 1.6, 4.5, 3.6), cell: R(-12.2, -5.6, -8.7, -0.8) },
    cell: { x: cellP[0], z: cellP[1], heading: hd(1, 0) }, counter: { x: ctr[0], z: ctr[1], heading: hd(0, -1) },
    get cellOpen() { return cellOpen; },
    setCellDoor(open) { cellOpen = !!open; cellCollider.hx = cellOpen ? 0 : cc0.hx; cellCollider.hz = cellOpen ? 0 : cc0.hz; cellCollider.h = cellOpen ? 0 : 3; },
    update(dt) { const tgt = cellOpen ? -1.75 : 0; if (ang !== tgt) { ang += Math.sign(tgt - ang) * Math.min(Math.abs(tgt - ang), dt * 2.2); doorMesh.rotation.y = ang; } },
    camera: { maxDist: 3.0, ceiling: CH - 0.15, near: 0.1 },
    bounds: R(X0, Z0, X1, Z1),
    background: new THREE.Color(0xdfe9f0),
    info: { kind: 'police', name: '警察局', tris: B.tris + DB.tris, draws: 2 },
    dispose() { group.removeFromParent(); mesh.geometry.dispose(); doorMesh.geometry.dispose(); mat.dispose(); tex.dispose(); },
  };
  I.setCellDoor(false);
  return I;
}

return { buildPoliceStation, buildPoliceInterior, makePoliceCar, POLICE_LOOK, POLICE_TEXT };
})();
