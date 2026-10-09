// ---- 街景（第 3 批）：讓村子的街道像真的台灣小鎮：天空、外牆（二丁掛、馬賽克、洗石子、油漆牆＋水漬）、招牌、機車、電線、紅綠燈、水溝蓋、雜草⋯ ----
// Nick 2026-09-28 06:22：「街景盡量真一點」；07:19：「有店可以買槍 子彈」→ 槍店的外面（店面、招牌、門口）在這裡（裡面、買槍的畫面是別的模組）
// 世界座標跟 village.js 一樣：x 往東、y 往上、z 往南；公尺；rotation.y＝ry（本地 +x → (cos, 0, −sin)、本地 +z → (sin, 0, cos)）
// 【API】
//   const ST = buildStreet(W, opts)   buildVillage() 裡面叫（開發頁拿 buildVillage 回傳的 V 也可以）
//     W：{ buildings, roads, places, colliders, areas, surfaceAt, nodes?, poles?, houses? }
//        nodes：路口的座標（village.js 的 NODES：C＝大路口）；poles：電線桿（village.js 記的 { x, z, fx, fz, ins }）；
//        houses：village.js house() 記下來的每一棟透天厝 { T, w, D, H, fl, cw, cs, kind, door }（有給就用這裡的外牆材質畫四面牆；沒給就不換）
//     opts：{ renderer, chunk = 4000（不會藏的東西一格多大）, cell = 160（小東西一格多大）, propFar = 150（小東西多遠以外不畫）}
//   回傳 {
//     group,                 THREE.Group（加到村子的 group）
//     colliders,             新的碰撞（機車、紅綠燈桿、檳榔攤、槍店⋯）：格式跟 V.colliders 一樣，要併進去
//     pave,                  新的水泥地 [{ x, z, hx, hz, rot, col（#hex）}]（槍店門口）：village.js 用 addPave 畫、算路面（surfaceAt 3）
//     sidewalks,             [{ pts: [[x, z], ...], w, side }]：房子前面走路的地方（騎樓前的水泥地）的中線；以後居民走路用
//     crossings,             [{ a: [x, z], b: [x, z], w, node, signal?, group? }]：斑馬線（a → b 橫過馬路；signal＝哪一組紅綠燈、group＝跟哪個方向的綠燈一起走）
//     signals,               [{ id, node, x, z, cycle, heads: [...], phase(t) }]：紅綠燈；phase(t) → { ew, ns（'green'|'yellow'|'red'）, ewLeft, nsLeft（這個燈還剩幾秒）, walkEW, walkNS（'walk'|'flash'|'stop'）}
//                            ew＝東西向（大路）、ns＝南北向；t＝clock()（秒）；燈自己會動（畫天空的時候順便更新，不用每一幀叫）
//     clock,                 () → 秒（performance.now()）：紅綠燈的時間；以後的車流、行人用同一個
//     gunshop,               槍店：{ place: { name, pos, spawn, zone, door, front, building }, building: { kind: 'gunshop', … } }（village.js 放到 V.places.gunshop、V.buildings）
//     sky,                   天空（跟著鏡頭走的大圓球，最先畫）
//     info: { meshes, tris, props, instances },
//     dispose(),
//   }
// 效能：不會藏的東西（外牆、招牌、紅綠燈、地上的字）一個材質一個網格（整個村子）；小東西（機車、雜草、盆栽、鐵窗、燈箱⋯）160 公尺一格併成一個網格，
//       鏡頭離那格 150 公尺以外就不畫；電線一個 LineSegments（遠的變淡）；貼圖都是 canvas 畫的（最大 1024）；沒有即時陰影（地上的影子、牆腳的暗是一張貼圖乘上去的）
import * as THREE from 'three';

// 打包（build-art.mjs、build-app.mjs）會拿掉 import、把 export 變成一般宣告、所有檔接在同一個 script 裡：
// 這個檔全部包在一個函式裡，只露出下面兩個名字（跟 village.js 一樣）
export const { buildStreet, STREET_TEXT } = (() => {
const TAU = Math.PI * 2;
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", "WenQuanYi Zen Hei", sans-serif';
const COND = '"Barlow Condensed", "Arial Narrow", sans-serif';
// 招牌、路名牌上的字（villageFonts 一起等字型）
const SHOPS_H = [ // 橫的招牌（雨遮前面那一條）：[店名, 底色, 字色, 小字]
  ['阿美早餐店', '#f6c343', '#b3261e', '漢堡 · 蛋餅 · 奶茶'], ['老王牛肉麵', '#c62f25', '#fff3c4', '麵 · 水餃 · 小菜'], ['順發五金行', '#1f5fae', '#ffffff', '水電 · 油漆 · 工具'],
  ['大發機車行', '#ffffff', '#c62f25', '修理 · 保養 · 輪胎'], ['仁心藥局', '#2e9a5c', '#ffffff', '健保 · 藥品'], ['福利雜貨店', '#d33b2c', '#ffffff', '米 · 酒 · 飲料'],
  ['永安水電行', '#ffffff', '#1f5fae', '冷氣 · 水塔 · 抓漏'], ['小林美髮', '#f07aa8', '#ffffff', '剪髮 · 燙髮'], ['好味自助餐', '#ff8a2a', '#ffffff', '便當 · 自助餐'],
  ['古早味紅茶', '#7a3b1e', '#ffe7a8', '紅茶 · 綠茶 · 冬瓜茶'], ['大眾洗衣', '#5bc0eb', '#ffffff', '乾洗 · 水洗'], ['明亮眼鏡', '#1d1f23', '#f2c230', '配眼鏡 · 驗光'],
  ['安心診所', '#ffffff', '#2e9a5c', '內科 · 小兒科'], ['文昌補習班', '#2d6fd6', '#ffffff', '國小 · 國中 · 英文'], ['豆花 · 剉冰', '#f2f3f5', '#8a4b1e', '古早味'], ['碳烤 · 滷味', '#1d1f23', '#ff7a2e', '晚上營業'],
];
const SHOPS_V = [ // 直立招牌（從上往下）
  ['早餐', '#f6c343', '#b3261e'], ['麵店', '#c62f25', '#ffffff'], ['五金', '#1f5fae', '#ffffff'], ['機車', '#ffffff', '#c62f25'], ['藥局', '#2e9a5c', '#ffffff'],
  ['水電', '#ffffff', '#1f5fae'], ['美髮', '#f07aa8', '#ffffff'], ['當舖', '#1d1f23', '#f2c230'], ['診所', '#ffffff', '#2e9a5c'], ['補習班', '#2d6fd6', '#ffffff'], ['冷氣', '#5bc0eb', '#ffffff'], ['茶飲', '#7a3b1e', '#ffe7a8'],
];
const BOXES = [['早餐', '#f6c343', '#b3261e'], ['麵', '#c62f25', '#ffffff'], ['檳榔', '#ff5fa2', '#ffffff'], ['機車', '#1f5fae', '#ffffff'], ['冷飲', '#2e9a5c', '#ffffff'], ['剪髮', '#ffffff', '#c62f25']]; // 路邊的直立燈箱
const PLATES = [['中山路', 'Zhongshan Rd.'], ['廟口街', 'Miaokou St.'], ['福德路', 'Fude Rd.'], ['和平街', 'Heping St.'], ['民生路', 'Minsheng Rd.'], ['光明路', 'Guangming Rd.']];
const STREET_TEXT = [...new Set([...SHOPS_H.map((s) => s[0] + s[3]), ...SHOPS_V.map((s) => s[0]), ...BOXES.map((s) => s[0]), ...PLATES.map((p) => p[0]),
  '槍店彈營業中停公車站牌時刻表香菸飲料檳榔慢護具'].join(''))].join('');

// ---- 小工具（跟 village.js 一樣的寫法）----
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash2 = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul((b | 0) + 7, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const hxz = (x, z, k = 0) => hash2(Math.round(x * 10) + k * 7919, Math.round(z * 10) - k * 104729); // 位置的固定亂數（不動到村子的亂數順序）
const CC = new Map();
const C = (hex) => { let v = CC.get(hex); if (!v) { const c = new THREE.Color(hex); v = [c.r, c.g, c.b]; CC.set(hex, v); } return v; }; // 線性顏色
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const pick = (r, list) => list[(r() * list.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function frame(x, y, z, ry = 0) { // 本地座標框（跟 village.js 的 frame 一樣）
  const c = Math.cos(ry), n = Math.sin(ry);
  const f = { x, y, z, ry, p: (lx, ly, lz) => [x + lx * c + lz * n, y + ly, z - lx * n + lz * c] };
  f.sub = (lx, ly, lz, dry = 0) => { const q = f.p(lx, ly, lz); return frame(q[0], q[1], q[2], ry + dry); };
  return f;
}
const inRect = (r, x, z, m = 0) => { const dx = x - r.x, dz = z - r.z, c = Math.cos(r.rot || 0), s = Math.sin(r.rot || 0); return Math.abs(dx * c - dz * s) <= r.hx + m && Math.abs(dx * s + dz * c) <= r.hz + m; };
function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1; const t = clamp(((px - ax) * dx + (pz - az) * dz) / L2, 0, 1); const qx = ax + dx * t, qz = az + dz * t; return [Math.hypot(px - qx, pz - qz), t, qx, qz]; }

// ---- canvas 貼圖 ----
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function speck(g, R, w, h, n, style, s = 2) { for (let i = 0; i < n; i++) { g.fillStyle = typeof style === 'function' ? style() : style; g.fillRect(R() * w, R() * h, 1 + R() * s, 1 + R() * s); } }
function fitFont(g, text, maxW, px, weight = 700, fam = SANS) { let s = px; for (; s > 8; s -= 2) { g.font = `${weight} ${s}px ${fam}`; if (g.measureText(text).width <= maxW) break; } return s; }
function rrect(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
function sheet(W, H) { // 貼圖集：pack(名字, w, h, 畫) → uv [u0, v0, u1, v1]（canvas 上面＝v 大）；一排一排排（先放高的）
  const [c, g] = cv(W, H), uv = {};
  let px = 0, py = 0, rowH = 0;
  const reg = (name, x, y, w, h, draw) => {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); draw(g, w, h); g.restore();
    return (uv[name] = [(x + 0.5) / W, 1 - (y + h - 0.5) / H, (x + w - 0.5) / W, 1 - (y + 0.5) / H]);
  };
  const pack = (name, w, h, draw) => {
    if (px + w > W) { px = 0; py += rowH; rowH = 0; }
    if (py + h > H) throw new Error(`street atlas full: ${name}`);
    const r = reg(name, px, py, w, h, draw); px += w; rowH = Math.max(rowH, h); return r;
  };
  return { c, g, uv, reg, pack };
}
const dotUV = (r) => { const u = (r[0] + r[2]) / 2, v = (r[1] + r[3]) / 2; return [u, v, u, v]; };
const subUV = (r, a, b, c, d) => [r[0] + (r[2] - r[0]) * a, r[1] + (r[3] - r[1]) * b, r[0] + (r[2] - r[0]) * c, r[1] + (r[3] - r[1]) * d];
function toTex(c, aniso, o = {}) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function vText(g, t, cx, y0, step, px, col) { g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${px}px ${SANS}`; [...t].forEach((ch, k) => g.fillText(ch, cx, y0 + k * step)); }

// ---- 外牆的磁磚（四種，一種 512×512 一格、可以一直重複貼）：二丁掛、馬賽克、洗石子、粉光油漆；白底，頂點色上色 ----
const FAC_M = [3.2, 2.4, 4.0, 4.0]; // 每一種一格是幾公尺
function facadeTex(R) {
  const [c, g] = cv(1024, 1024);
  const cell = (ox, oy, draw) => { g.save(); g.beginPath(); g.rect(ox, oy, 512, 512); g.clip(); g.translate(ox, oy); draw(); g.restore(); };
  cell(0, 0, () => { // 二丁掛：長條磚 22.7 × 6 公分、灰縫（一排錯開半塊）；32 × 10 像素一塊（3.2 公尺一格：一塊 20 公分）
    g.fillStyle = '#b9b4ab'; g.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 512 / 10; r++) for (let k = -1; k < 512 / 32 + 1; k++) {
      const x = k * 32 + (r % 2) * 16, y = r * 10, v = 0.9 + R() * 0.14, warm = R() < 0.08 ? 0.93 : 1;
      g.fillStyle = `rgb(${Math.round(250 * v)},${Math.round(247 * v * warm)},${Math.round(242 * v * warm * warm)})`; g.fillRect(x + 1.5, y + 1.5, 29, 7.5);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 1.5, y + 1.5, 29, 1.2); // 上緣亮一點（有厚度）
    }
    speck(g, R, 512, 512, 2500, () => `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + R() * 0.05})`, 1.5);
  });
  cell(512, 0, () => { // 馬賽克：小方塊 5 公分，深淺兩色混著貼
    g.fillStyle = '#c9c6c0'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 512 / 8; i++) for (let j = 0; j < 512 / 8; j++) {
      const v = R() < 0.22 ? 0.84 + R() * 0.06 : 0.95 + R() * 0.07;
      g.fillStyle = `rgb(${Math.round(255 * Math.min(1, v))},${Math.round(254 * Math.min(1, v))},${Math.round(250 * Math.min(1, v))})`; g.fillRect(i * 8 + 1, j * 8 + 1, 6.6, 6.6);
    }
  });
  cell(0, 512, () => { // 洗石子：灰色小石頭點點，1 公尺一條分割溝
    g.fillStyle = '#cfccc6'; g.fillRect(0, 0, 512, 512);
    speck(g, R, 512, 512, 26000, () => { const k = R(); return k < 0.45 ? `rgba(90,88,84,${0.25 + R() * 0.35})` : k < 0.8 ? `rgba(245,243,238,${0.3 + R() * 0.4})` : `rgba(150,120,95,${0.2 + R() * 0.3})`; }, 2.2);
    g.fillStyle = 'rgba(60,58,54,0.55)'; for (let k = 0; k < 4; k++) { g.fillRect(0, k * 128, 512, 2.5); g.fillRect(k * 128, 0, 2.5, 512); }
    g.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < 4; k++) { g.fillRect(0, k * 128 + 2.5, 512, 1); g.fillRect(k * 128 + 2.5, 0, 1, 512); }
  });
  cell(512, 512, () => { // 粉光＋油漆：幾乎平的，淡淡的抹刀痕、一點點斑
    g.fillStyle = '#f2f1ee'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) { const x = R() * 512, y = R() * 512, w = 30 + R() * 90; g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${0.008 + R() * 0.014})`; g.beginPath(); g.ellipse(x, y, w, w * (0.2 + R() * 0.3), R() * 0.6 - 0.3, 0, TAU); g.fill(); }
    speck(g, R, 512, 512, 3000, () => `rgba(0,0,0,${0.02 + R() * 0.04})`, 1.5);
    g.fillStyle = 'rgba(0,0,0,0.05)'; for (let k = 0; k < 4; k++) g.fillRect(0, k * 128, 512, 1.5); // 每層樓的施工縫（淡）
  });
  return c;
}
// 水漬（乘上去的：白＝沒有）：16 格 256×256，每一面牆挑一格拉滿整面（上面女兒牆流下來的黑線、窗台下的水痕、牆腳的髒、鐵窗的鏽）
function stainTex(R) {
  const [c, g] = cv(1024, 1024);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 1024, 1024);
  for (let k = 0; k < 16; k++) {
    const ox = (k % 4) * 256, oy = ((k / 4) | 0) * 256, heavy = k % 4 === 3 ? 1.6 : k % 4 === 2 ? 1.25 : 1; // 越後面越髒（側牆用）
    g.save(); g.beginPath(); g.rect(ox, oy, 256, 256); g.clip(); g.translate(ox, oy);
    const streak = (x, y0, len, w, a, col = '30,28,26') => { // 一條往下流的水痕（上面深、下面淡）
      const gr = g.createLinearGradient(0, y0, 0, y0 + len); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(0.25, `rgba(${col},${a * 0.8})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - w / 2, y0); g.lineTo(x + w / 2, y0); g.lineTo(x + w * 0.3, y0 + len); g.lineTo(x - w * 0.3, y0 + len); g.closePath(); g.fill();
    };
    const n = Math.round((6 + R() * 10) * heavy);
    for (let i = 0; i < n; i++) streak(R() * 256, 0, 20 + R() * 120 * heavy, 2 + R() * 9, (0.12 + R() * 0.22) * Math.min(1.3, heavy)); // 女兒牆流下來
    for (let f = 1; f < 4; f++) if (R() < 0.8) { const y = 256 - f * 64 + 6, xc = 70 + R() * 116; for (let i = 0; i < 3 + R() * 5; i++) streak(xc + (R() - 0.5) * 90, y, 10 + R() * 40, 2 + R() * 5, 0.1 + R() * 0.18); } // 每層窗台下面
    if (R() < 0.45) for (let i = 0; i < 3; i++) streak(40 + R() * 176, 256 - (1 + ((R() * 3) | 0)) * 64 + 10, 14 + R() * 26, 3 + R() * 4, 0.18 + R() * 0.15, '120,64,30'); // 鐵窗的鏽
    for (let i = 0; i < 5 * heavy; i++) { const x = R() * 256, y = R() * 256, r = 10 + R() * 40; const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(40,38,34,${0.05 + R() * 0.07})`); gr.addColorStop(1, 'rgba(40,38,34,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    const gb = g.createLinearGradient(0, 256, 0, 200); gb.addColorStop(0, `rgba(55,50,40,${0.3 * heavy})`); gb.addColorStop(1, 'rgba(55,50,40,0)'); g.fillStyle = gb; g.fillRect(0, 200, 256, 56); // 牆腳的髒
    if (k % 4 === 3) { const gm = g.createLinearGradient(0, 256, 0, 215); gm.addColorStop(0, 'rgba(70,90,50,0.3)'); gm.addColorStop(1, 'rgba(70,90,50,0)'); g.fillStyle = gm; g.fillRect(0, 215, 256, 41); } // 青苔
    g.restore();
  }
  return c;
}

// ---- 招牌、路名牌、燈箱、機車⋯（有光照；自己會亮的用頂點的 emis）----
function propAtlas(R) {
  const S = sheet(1024, 1024), P = S.pack;
  // 高的先放
  SHOPS_V.forEach(([t, bg, fg], i) => P('v' + i, 48, 256, (g, w, h) => { // 直立招牌
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(3, 3, w - 6, 4);
    const n = t.length, s = Math.min(40, (h - 24) / n); vText(g, t, w / 2, 12 + s / 2 + (h - 24 - s * n) / 2, s, s * 0.92, fg);
  }));
  P('vGun', 48, 256, (g, w, h) => { // 槍店的直立燈箱（黑底橘字＋準星）
    g.fillStyle = '#17191c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ff8a1f'; g.lineWidth = 3; g.strokeRect(2.5, 2.5, w - 5, h - 5);
    g.lineWidth = 3; g.beginPath(); g.arc(24, 30, 13, 0, TAU); g.stroke(); g.fillStyle = '#ff8a1f'; g.fillRect(22.5, 12, 3, 36); g.fillRect(6, 28.5, 36, 3);
    vText(g, '槍店', w / 2, 92, 62, 40, '#ffb347'); g.fillStyle = '#f2f3f5'; g.font = `700 13px ${COND}`; g.textAlign = 'center'; g.fillText('GUN', 24, 214); g.fillText('SHOP', 24, 230);
  });
  P('gdoor', 128, 256, (g, w, h) => { // 玻璃門（鋁框、推桿、「營業中」的牌子）
    g.fillStyle = '#b9bdc2'; g.fillRect(0, 0, w, h);
    const gl = g.createLinearGradient(0, 0, w, h); gl.addColorStop(0, '#3c4c57'); gl.addColorStop(0.5, '#27323a'); gl.addColorStop(1, '#1b2228'); g.fillStyle = gl; g.fillRect(9, 9, w - 18, h - 18);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.moveTo(40, 9); g.lineTo(70, 9); g.lineTo(28, h - 9); g.lineTo(9, h - 9); g.lineTo(9, 90); g.fill();
    g.fillStyle = 'rgba(255,190,120,0.18)'; g.fillRect(9, 150, w - 18, 60); // 裡面的燈
    g.fillStyle = '#b9bdc2'; g.fillRect(0, 124, w, 7); g.fillStyle = '#e3e5e8'; g.fillRect(18, 118, w - 36, 5); // 橫的框、推桿
    g.fillStyle = '#c62f25'; rrect(g, 34, 44, 60, 26, 4); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, '營業中', 52, 18); g.fillText('營業中', 64, 58);
    g.strokeStyle = '#8f949a'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  });
  P('booth', 256, 256, (g, w, h) => { // 檳榔攤的正面：玻璃櫃、裡面的燈、霓虹框
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a1d2c'); gr.addColorStop(1, '#120c14'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff4e0'; g.fillRect(24, 96, w - 48, 110); // 亮亮的玻璃櫃
    const cs = ['#3aa05a', '#e0453a', '#f2c230', '#3b8fd9', '#ffffff'];
    for (const y of [120, 150, 180]) for (let x = 30; x < w - 34; x += 9) { g.fillStyle = pick(R, cs); g.fillRect(x, y - 10 - R() * 8, 7, 12); }
    g.fillStyle = '#6b8f3a'; for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(40 + R() * (w - 80), 196 + R() * 6, 5, 3, 0, 0, TAU); g.fill(); } // 一顆一顆檳榔
    g.strokeStyle = '#c9ccd0'; g.lineWidth = 4; g.strokeRect(24, 96, w - 48, 110);
    g.fillStyle = '#d9d2c8'; g.fillRect(0, 206, w, 50); // 下面的檯子
    g.save(); g.shadowColor = '#ff4fb0'; g.shadowBlur = 14; g.strokeStyle = '#ff7ac8'; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 60); g.restore();
    g.save(); g.shadowColor = '#4dff9a'; g.shadowBlur = 12; g.fillStyle = '#b8ffd8'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, '檳榔', 180, 70); g.fillText('檳榔', w / 2, 52); g.restore();
  });
  P('gunSign', 512, 128, (g, w, h) => { // 槍店的大招牌（黑底、橘字、準星）
    g.fillStyle = '#17191c'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a3f2a'; g.fillRect(0, h - 20, w, 20);
    for (let x = -20; x < w; x += 28) { g.fillStyle = '#f2c230'; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 14, h); g.lineTo(x + 34, h - 20); g.lineTo(x + 20, h - 20); g.fill(); }
    g.strokeStyle = '#ff8a1f'; g.lineWidth = 7; g.beginPath(); g.arc(70, 54, 34, 0, TAU); g.stroke(); g.lineWidth = 5; g.beginPath(); g.moveTo(70, 12); g.lineTo(70, 96); g.moveTo(28, 54); g.lineTo(112, 54); g.stroke();
    g.fillStyle = '#ff8a1f'; g.beginPath(); g.arc(70, 54, 7, 0, TAU); g.fill();
    g.fillStyle = '#ffb347'; g.textAlign = 'left'; g.textBaseline = 'middle'; fitFont(g, '槍店', 170, 92); g.fillText('槍店', 140, 56);
    g.fillStyle = '#f2f3f5'; fitFont(g, '槍 · 子彈 · 護具', 190, 30); g.fillText('槍 · 子彈 · 護具', 310, 38); g.font = `700 30px ${COND}`; g.fillStyle = '#9aa1ac'; g.fillText('GUN SHOP', 312, 78);
  });
  P('gunWin', 256, 128, (g, w, h) => { // 槍店的櫥窗：牆上掛的長槍、手槍（輪廓）、靶紙
    g.fillStyle = '#3b3530'; g.fillRect(0, 0, w, h); g.fillStyle = '#5c5048'; for (let y = 8; y < h; y += 16) g.fillRect(0, y, w, 1.5);
    const rifle = (x, y, L) => { g.fillStyle = '#16171a'; g.fillRect(x, y, L, 5); g.fillRect(x + L * 0.62, y - 2, L * 0.22, 3); g.beginPath(); g.moveTo(x + L * 0.08, y + 5); g.lineTo(x + L * 0.26, y + 5); g.lineTo(x + L * 0.2, y + 14); g.lineTo(x, y + 13); g.closePath(); g.fill(); g.fillRect(x + L * 0.4, y + 5, 5, 8); g.fillStyle = '#6b4a2e'; g.fillRect(x + L * 0.3, y + 5, L * 0.09, 3); };
    rifle(18, 18, 150); rifle(26, 44, 132); rifle(14, 70, 160);
    const pistol = (x, y) => { g.fillStyle = '#1b1c1f'; g.fillRect(x, y, 26, 7); g.fillRect(x + 2, y + 7, 8, 12); g.fillRect(x + 9, y + 7, 5, 3); };
    for (let i = 0; i < 3; i++) pistol(180 + (i % 2) * 34, 18 + i * 22);
    g.fillStyle = '#f4efe2'; g.fillRect(186, 86, 52, 36); g.strokeStyle = '#1b1c1f'; g.lineWidth = 2; for (const r of [4, 9, 14]) { g.beginPath(); g.arc(212, 104, r, 0, TAU); g.stroke(); } g.fillStyle = '#c62f25'; g.beginPath(); g.arc(212, 104, 3, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.1)'; g.beginPath(); g.moveTo(w * 0.55, 0); g.lineTo(w * 0.72, 0); g.lineTo(w * 0.42, h); g.lineTo(w * 0.25, h); g.fill(); // 玻璃反光
    g.strokeStyle = '#8f949a'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  });
  PLATES.forEach(([t, en], i) => P('plate' + i, 192, 64, (g, w, h) => { // 藍底白字的路名牌
    g.fillStyle = '#f2f3f5'; rrect(g, 0, 0, w, h, 6); g.fill(); g.fillStyle = '#1b4fa0'; rrect(g, 3, 3, w - 6, h - 6, 4); g.fill();
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, t, w - 30, 36); g.fillText(t, w / 2, 26); g.font = `600 15px ${COND}`; g.fillText(en, w / 2, 51);
  }));
  SHOPS_H.forEach(([t, bg, fg, sub], i) => P('h' + i, 256, 48, (g, w, h) => { // 橫的招牌（雨遮前面那一條）
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, h - 4, w, 4); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 0, w, 3);
    g.fillStyle = fg; g.textBaseline = 'middle'; g.textAlign = 'left'; const s = fitFont(g, t, 150, 34); g.fillText(t, 10, h / 2 + 1);
    const tw = g.measureText(t).width; g.globalAlpha = 0.85; fitFont(g, sub, w - tw - 28, 16); g.textAlign = 'right'; g.fillText(sub, w - 8, h / 2 + 2); g.globalAlpha = 1; void s;
  }));
  BOXES.forEach(([t, bg, fg], i) => P('box' + i, 48, 112, (g, w, h) => { // 燈箱（兩面一樣）
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(0, 0, w, 5);
    const n = t.length, s = Math.min(34, (h - 16) / n); vText(g, t, w / 2, 8 + s / 2 + (h - 16 - s * n) / 2, s, s * 0.9, fg);
  }));
  P('bus', 96, 96, (g, w, h) => { // 公車站牌
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(48, 48, 46, 0, TAU); g.fill(); g.fillStyle = '#1f7a4c'; g.beginPath(); g.arc(48, 48, 41, 0, TAU); g.fill();
    g.fillStyle = '#ffffff'; rrect(g, 24, 22, 48, 36, 6); g.fill(); g.fillStyle = '#1f7a4c'; g.fillRect(29, 27, 38, 14); g.fillStyle = '#ffffff'; for (const x2 of [34, 62]) { g.beginPath(); g.arc(x2, 60, 5, 0, TAU); g.fill(); }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 16px ${SANS}`; g.fillText('公車站', 48, 76);
  });
  P('busTable', 64, 96, (g, w, h) => { g.fillStyle = '#f2f3f5'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f7a4c'; g.fillRect(0, 0, w, 16); g.fillStyle = '#fff'; g.font = `700 11px ${SANS}`; g.textAlign = 'center'; g.fillText('時刻表', w / 2, 9); g.fillStyle = '#555'; for (let y = 22; y < h - 4; y += 7) { g.fillRect(6, y, 16, 2); g.fillRect(28, y, 30 * (0.4 + R() * 0.6), 2); } });
  P('digits', 240, 40, (g, w, h) => { // 倒數計秒的數字（七段顯示器，白字黑底：顏色用頂點色）
    g.fillStyle = '#050505'; g.fillRect(0, 0, w, h);
    const SEG = [[1, 1, 1, 0, 1, 1, 1], [0, 0, 1, 0, 0, 1, 0], [1, 0, 1, 1, 1, 0, 1], [1, 0, 1, 1, 0, 1, 1], [0, 1, 1, 1, 0, 1, 0], [1, 1, 0, 1, 0, 1, 1], [1, 1, 0, 1, 1, 1, 1], [1, 0, 1, 0, 0, 1, 0], [1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 0, 1, 1]];
    for (let d = 0; d < 10; d++) {
      const x0 = d * 24 + 4, y0 = 4, W = 16, H2 = 15, t = 3.2; g.fillStyle = '#ffffff';
      const s = SEG[d];
      if (s[0]) g.fillRect(x0 + t, y0, W - 2 * t, t); if (s[1]) g.fillRect(x0, y0 + t, t, H2 - t); if (s[2]) g.fillRect(x0 + W - t, y0 + t, t, H2 - t);
      if (s[3]) g.fillRect(x0 + t, y0 + H2, W - 2 * t, t); if (s[4]) g.fillRect(x0, y0 + H2 + t, t, H2 - t); if (s[5]) g.fillRect(x0 + W - t, y0 + H2 + t, t, H2 - t); if (s[6]) g.fillRect(x0 + t, y0 + 2 * H2, W - 2 * t, t);
    }
  });
  P('pedR', 40, 40, (g, w, h) => { g.fillStyle = '#050505'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.beginPath(); g.arc(20, 8, 4, 0, TAU); g.fill(); g.fillRect(15, 13, 10, 13); g.fillRect(16, 26, 3, 11); g.fillRect(21, 26, 3, 11); g.fillRect(11, 14, 3, 11); g.fillRect(26, 14, 3, 11); }); // 行人：站著（紅）
  P('pedG', 40, 40, (g, w, h) => { g.fillStyle = '#050505'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.beginPath(); g.arc(22, 7, 4, 0, TAU); g.fill(); g.save(); g.translate(20, 20); g.rotate(0.15); g.fillRect(-4, -8, 8, 13); g.restore(); g.save(); g.translate(18, 30); g.rotate(0.45); g.fillRect(-1.5, -6, 3, 12); g.restore(); g.save(); g.translate(24, 30); g.rotate(-0.4); g.fillRect(-1.5, -6, 3, 12); g.restore(); g.save(); g.translate(14, 18); g.rotate(0.7); g.fillRect(-1.5, -5, 3, 10); g.restore(); g.save(); g.translate(27, 17); g.rotate(-0.8); g.fillRect(-1.5, -5, 3, 10); g.restore(); }); // 小綠人
  P('grass', 128, 64, (g, w, h) => { // 雜草（透明底，一叢一叢）
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = 4 + R() * (w - 8), hh = h * (0.35 + R() * 0.62), lean = (R() - 0.5) * 14, c = pick(R, ['#5f7f36', '#6f8f3c', '#7d9a45', '#8a9f52', '#4f6f2e', '#a3a860']);
      g.strokeStyle = c; g.lineWidth = 1.4 + R() * 1.4; g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + lean * 0.3, h - hh * 0.6, x + lean, h - hh); g.stroke();
    }
    for (let i = 0; i < 6; i++) { g.fillStyle = pick(R, ['#f2e6a0', '#ffffff', '#d9c24a']); g.beginPath(); g.arc(6 + R() * (w - 12), h * (0.2 + R() * 0.35), 1.6, 0, TAU); g.fill(); } // 小野花
  });
  P('leaf', 64, 128, (g, w, h) => { // 香蕉葉（透明底）：長長的，中間一條脈，邊上裂開
    g.clearRect(0, 0, w, h); g.fillStyle = '#5f9a3a'; g.beginPath(); g.moveTo(w / 2, 2); g.bezierCurveTo(w - 2, h * 0.25, w - 4, h * 0.75, w / 2, h - 2); g.bezierCurveTo(4, h * 0.75, 2, h * 0.25, w / 2, 2); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.lineWidth = 1.5; for (let i = 0; i < 9; i++) { const y = 18 + i * 12 + R() * 6, s = R() < 0.5 ? 1 : -1; g.beginPath(); g.moveTo(w / 2 + s * 4, y); g.lineTo(w / 2 + s * 30, y + 6); g.stroke(); } g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 20; i++) g.fillRect(w / 2 + (R() - 0.5) * 40, R() * h, 1, 6);
    g.fillStyle = '#c9d88a'; g.fillRect(w / 2 - 1.2, 4, 2.4, h - 8); // 中間的葉脈
  });
  P('bush', 64, 64, (g, w, h) => { // 盆栽的葉子（透明底）
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { const a = R() * TAU, r = R() * 26; g.fillStyle = pick(R, ['#4f8a3c', '#5e9a44', '#3f7a35', '#6aa84f', '#2f6a2c']); g.beginPath(); g.ellipse(32 + Math.cos(a) * r, 34 + Math.sin(a) * r * 0.8, 5 + R() * 3, 2.5 + R() * 2, a, 0, TAU); g.fill(); }
  });
  P('solar', 64, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1d2f4a'); gr.addColorStop(1, '#0b1422'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(160,190,220,0.35)'; for (let x = 3; x < w; x += 6) g.fillRect(x, 0, 2, h); g.strokeStyle = '#b9bdc2'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3); }); // 太陽能熱水器的集熱管
  P('grill', 256, 128, (g, w, h) => { // 鐵窗（透明底：只有鐵條；寬 2.8 公尺左右一張）：直條、兩條橫條、下面一排花樣
    g.clearRect(0, 0, w, h); g.fillStyle = '#ffffff';
    for (let x = 3; x < w; x += 8) g.fillRect(x, 0, 2.6, h);
    for (const y of [0, h * 0.34, h * 0.67, h - 4]) g.fillRect(0, y, w, 4);
    g.strokeStyle = '#ffffff'; g.lineWidth = 2.2; for (let x = 0; x < w; x += 16) { g.beginPath(); g.arc(x + 8, h - 12, 6, 0, TAU); g.stroke(); }
  });
  P('disc', 32, 32, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const gr = g.createRadialGradient(16, 16, 2, 16, 16, 15); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.75, '#f0f0f0'); gr.addColorStop(1, '#303030'); g.fillStyle = gr; g.beginPath(); g.arc(16, 16, 14.5, 0, TAU); g.fill(); }); // 紅綠燈的燈（顏色用頂點色）
  P('meter', 32, 48, (g, w, h) => { g.fillStyle = '#c9ccd0'; g.fillRect(0, 0, w, h); g.fillStyle = '#e9ecef'; g.fillRect(4, 6, w - 8, 18); g.fillStyle = '#222'; g.fillRect(8, 11, w - 16, 6); g.fillStyle = '#8f949a'; g.fillRect(4, 30, w - 8, 12); }); // 電錶箱
  P('acF', 48, 32, (g, w, h) => { g.fillStyle = '#e9e9e5'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8f949a'; g.lineWidth = 1.2; for (const r of [11, 7.5, 4]) { g.beginPath(); g.arc(30, 16, r, 0, TAU); g.stroke(); } g.fillStyle = '#b3b8be'; for (let y = 5; y < 28; y += 4) g.fillRect(3, y, 9, 1.5); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, h - 5, w, 5); }); // 冷氣室外機
  P('win2', 128, 64, (g, w, h) => { // 鋁門窗（兩片推拉）：玻璃映著天空、裡面的窗簾
    g.fillStyle = '#c9ccd0'; g.fillRect(0, 0, w, h);
    for (const [x0, x1] of [[4, 66], [62, 124]]) { const gl = g.createLinearGradient(0, 4, 0, h - 4); gl.addColorStop(0, '#a9c3d6'); gl.addColorStop(0.55, '#6f8ea6'); gl.addColorStop(1, '#4b6275'); g.fillStyle = gl; g.fillRect(x0 + 3, 7, x1 - x0 - 6, h - 14); }
    g.fillStyle = 'rgba(236,228,210,0.55)'; g.fillRect(9, 9, 22, h - 18); g.fillRect(96, 9, 22, h - 18); // 窗簾
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(20, 7); g.lineTo(34, 7); g.lineTo(18, h - 7); g.lineTo(7, h - 7); g.fill();
    g.fillStyle = '#9ea3a9'; g.fillRect(62, 4, 4, h - 8); g.fillRect(0, h - 5, w, 5);
  });
  P('white', 16, 16, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); });
  return S;
}

// ---- 地上的東西（透明）：牆腳的暗、樹影、補過的柏油、裂縫、油漬、水溝蓋、停止線、字、箭頭 ----
function groundAtlas(R) {
  const S = sheet(1024, 512), P = S.pack;
  P('ting', 96, 256, (g, w, h) => { g.fillStyle = '#f2f3f5'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.translate(w / 2, h / 2); g.scale(1, 2.3); g.font = `700 88px ${SANS}`; g.fillText('停', 0, 4); g.restore(); }); // 路上的「停」（拉長）
  const arrow = (name, kind) => P(name, 64, 256, (g, w, h) => { // 車道箭頭（長長的）：U 直走、L 左轉＋直走、R 右轉＋直走
    g.fillStyle = '#f2f3f5'; const cx = w / 2;
    const up = (x, y0, y1) => { g.fillRect(x - 5, y0 + 30, 10, y1 - y0 - 30); g.beginPath(); g.moveTo(x, y0); g.lineTo(x + 14, y0 + 34); g.lineTo(x - 14, y0 + 34); g.closePath(); g.fill(); };
    if (kind === 'U') up(cx, 10, h - 8);
    else { const s = kind === 'R' ? 1 : -1; up(cx - s * 8, 10, h - 8); g.fillRect(cx - s * 8 - 5, 120, 10, 30); g.save(); g.translate(cx - s * 8, 124); g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 22, -18); g.lineTo(s * 22, -30); g.lineTo(s * 30, -14); g.lineTo(s * 22, 2); g.lineTo(s * 22, -8); g.lineTo(0, 10); g.closePath(); g.fill(); g.restore(); }
  });
  arrow('arU', 'U'); arrow('arL', 'L'); arrow('arR', 'R');
  P('ditch', 256, 64, (g, w, h) => { // 水溝蓋：水泥板一塊一塊＋中間一個鐵格柵（沿著路 4 公尺一格）
    g.fillStyle = '#9b9a95'; g.fillRect(0, 0, w, h); speck(g, R, w, h, 900, () => `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${0.06 + R() * 0.08})`, 2);
    g.fillStyle = 'rgba(40,40,38,0.55)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 2, h); g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2);
    g.fillStyle = '#2b2b2a'; g.fillRect(96, 8, 64, h - 16); g.fillStyle = '#6c6d6e'; for (let x = 99; x < 158; x += 5) g.fillRect(x, 10, 2.2, h - 20); g.fillRect(96, 8, 64, 3); g.fillRect(96, h - 11, 64, 3);
    g.fillStyle = 'rgba(80,60,40,0.25)'; g.fillRect(96, 8, 64, h - 16);
  });
  for (let k = 0; k < 3; k++) P('patch' + k, 128, 128, (g, w, h) => { // 補過的柏油（深一點、邊緣不整齊）
    g.fillStyle = k === 2 ? 'rgba(90,92,96,0.55)' : 'rgba(22,22,24,0.42)'; g.beginPath();
    const n = 10; for (let i = 0; i < n; i++) { const a = (i / n) * TAU, r = 0.36 + R() * 0.12; g.lineTo(64 + Math.cos(a) * r * w * (k === 1 ? 1.2 : 1), 64 + Math.sin(a) * r * h * (k === 1 ? 0.55 : 1)); } g.closePath(); g.fill();
    speck(g, R, w, h, 300, () => `rgba(0,0,0,${0.05 + R() * 0.05})`, 2);
  });
  P('crack', 256, 64, (g, w, h) => { g.strokeStyle = 'rgba(16,16,18,0.55)'; g.lineCap = 'round'; for (let j = 0; j < 3; j++) { g.lineWidth = 1 + R() * 1.4; g.beginPath(); let x = 4, y = 20 + R() * 24; g.moveTo(x, y); while (x < w - 6) { x += 6 + R() * 14; y = clamp(y + (R() - 0.5) * 14, 4, h - 4); g.lineTo(x, y); } g.stroke(); } });
  P('oil', 64, 256, (g, w, h) => { for (let i = 0; i < 26; i++) { const y = R() * h, r = 6 + R() * 14; const gr = g.createRadialGradient(32, y, 1, 32, y, r); gr.addColorStop(0, `rgba(12,12,14,${0.18 + R() * 0.2})`); gr.addColorStop(1, 'rgba(12,12,14,0)'); g.fillStyle = gr; g.fillRect(32 - r, y - r, r * 2, r * 2); } }); // 車道中間滴的油
  P('ao', 32, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.62)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }); // 牆腳（v 大＝貼著牆）
  P('blob', 128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }); // 樹影、機車的影子
  P('tire', 128, 64, (g, w, h) => { g.lineCap = 'round'; for (let i = 0; i < 2; i++) { g.strokeStyle = `rgba(10,10,12,${0.18 + R() * 0.15})`; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 18 + i * 28); g.bezierCurveTo(w * 0.3, 14 + i * 28 + R() * 8, w * 0.7, 22 + i * 28, w, 16 + i * 28 + R() * 6); g.stroke(); } });
  P('dirt', 128, 64, (g, w, h) => { for (let i = 0; i < 18; i++) { const x = R() * w, y = R() * h, r = 8 + R() * 22; const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(96,84,62,${0.12 + R() * 0.14})`); gr.addColorStop(1, 'rgba(96,84,62,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } }); // 路邊的泥土、落葉
  P('white', 16, 16, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); });
  return S;
}

// ---- 天空：上面藍、地平線是霧的顏色（跟 buildTrack 的霧一樣 #b4cde2），一些積雲；u 繞一圈、v 從上到下 ----
function skyTex(R, fog) {
  const [c, g] = cv(1024, 512), W = 1024, H = 512, hz = H * 0.5;
  const gr = g.createLinearGradient(0, 0, 0, hz);
  gr.addColorStop(0, '#3d74b8'); gr.addColorStop(0.45, '#6f9dd0'); gr.addColorStop(0.8, '#9fbfdf'); gr.addColorStop(1, fog);
  g.fillStyle = gr; g.fillRect(0, 0, W, hz); g.fillStyle = fog; g.fillRect(0, hz, W, H - hz);
  const hb = g.createLinearGradient(0, hz - 60, 0, hz + 4); hb.addColorStop(0, 'rgba(226,233,236,0)'); hb.addColorStop(1, 'rgba(226,233,236,0.55)'); g.fillStyle = hb; g.fillRect(0, hz - 60, W, 64); // 地平線的霾
  const cloud = (x, y, s, a) => { // 一朵積雲：很多圓疊起來，下面灰一點
    for (let i = 0; i < 14; i++) {
      const dx = (R() - 0.5) * s * 2.2, dy = (R() - 0.7) * s * 0.55, r = s * (0.28 + R() * 0.42), yy = y + dy;
      for (const off of [0, W]) { // 接縫那邊也畫一次（u 會繞一圈）
        const cx = ((x + dx) % W) + off - (x + dx > W ? W : 0);
        const g2 = g.createRadialGradient(cx, yy - r * 0.3, r * 0.1, cx, yy, r);
        g2.addColorStop(0, `rgba(255,255,255,${a})`); g2.addColorStop(0.6, `rgba(244,246,248,${a * 0.75})`); g2.addColorStop(1, 'rgba(236,240,244,0)');
        g.fillStyle = g2; g.beginPath(); g.ellipse(cx, yy, r * 1.3, r * 0.7, 0, 0, TAU); g.fill();
        const g3 = g.createRadialGradient(cx, yy + r * 0.35, 1, cx, yy + r * 0.35, r * 0.9); g3.addColorStop(0, `rgba(150,160,175,${a * 0.28})`); g3.addColorStop(1, 'rgba(150,160,175,0)');
        g.fillStyle = g3; g.beginPath(); g.ellipse(cx, yy + r * 0.3, r * 1.2, r * 0.4, 0, 0, TAU); g.fill();
      }
    }
  };
  for (let i = 0; i < 26; i++) cloud(R() * W, hz - 22 - R() * 70, 12 + R() * 22, 0.55 + R() * 0.35); // 地平線上面一排
  for (let i = 0; i < 12; i++) cloud(R() * W, hz - 100 - R() * 110, 16 + R() * 26, 0.35 + R() * 0.3);
  { const sx = 151, sy = 128; // 太陽（跟平行光同一個方向 (−18, 30, 24)：u 0.148、高 45°）：只畫一圈亮亮的光暈
    for (const off of [0, W]) { const gs = g.createRadialGradient(sx + off, sy, 2, sx + off, sy, 150); gs.addColorStop(0, 'rgba(255,252,240,0.95)'); gs.addColorStop(0.06, 'rgba(255,248,228,0.75)'); gs.addColorStop(0.25, 'rgba(255,244,220,0.22)'); gs.addColorStop(1, 'rgba(255,244,220,0)'); g.fillStyle = gs; g.fillRect(sx + off - 150, sy - 150, 300, 300); } }
  g.globalAlpha = 0.18; g.strokeStyle = '#ffffff'; g.lineCap = 'round'; for (let i = 0; i < 30; i++) { g.lineWidth = 2 + R() * 5; const x = R() * W, y = 30 + R() * 140; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 40, y - 6, x + 80 + R() * 80, y + (R() - 0.5) * 10); g.stroke(); } g.globalAlpha = 1; // 卷雲
  return c;
}

// ---- 合併網格：同材質、同一格的三角形放一起；'st'（招牌、機車⋯）多一個 emis（自己會亮多少）、'fac'（外牆）多 rect（哪一種磁磚）＋ suv（水漬貼圖的 uv）----
class MB {
  constructor(cell) { this.cell = cell; this.bins = new Map(); this.k = '0,0'; this.tris = 0; this.e = 0; this.rect = null; this.sr = null; }
  at(x, z) { const c = this.cell; this.k = Math.floor(x / c + 0.5) + ',' + Math.floor(z / c + 0.5); return this; } // 格子的中心在 (i·cell, j·cell)（大路 z = 0 在格子中間）
  tri(m, a, b, c, ta, tb, tc, ca, cb = ca, cc = ca) {
    const key = m + '|' + this.k; let g = this.bins.get(key);
    if (!g) this.bins.set(key, (g = { m, k: this.k, p: [], n: [], u: [], c: [], e: [], r: [], s: [] }));
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-12) return;
    nx /= l; ny /= l; nz /= l;
    g.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); g.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    g.u.push(ta[0], ta[1], tb[0], tb[1], tc[0], tc[1]); g.c.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
    if (m === 'st') g.e.push(this.e, this.e, this.e);
    if (m === 'fac') { const r = this.rect, s = this.sr; for (let i = 0; i < 3; i++) g.r.push(r[0], r[1], r[2], r[3]); const q = [ta, tb, tc]; for (const t of q) g.s.push(s[0] + (s[2] - s[0]) * t[2], s[1] + (s[3] - s[1]) * t[3]); }
    this.tris++;
  }
  // a b c d：左下、右下、右上、左上（從正面看）；uv＝[u0, v0, u1, v1]
  quad(m, a, b, c, d, uv, col) { const [u0, v0, u1, v1] = uv; this.tri(m, a, b, c, [u0, v0], [u1, v0], [u1, v1], col); this.tri(m, a, c, d, [u0, v0], [u1, v1], [u0, v1], col); }
  // 外牆：uv 用公尺（÷ 那種磁磚一格幾公尺），水漬用 0–1（第 3、4 個數字）
  wall(a, b, c, d, t0, t1, col) { const [u0, v0, u1, v1] = t0, [s0, r0, s1, r1] = t1; this.tri('fac', a, b, c, [u0, v0, s0, r0], [u1, v0, s1, r0], [u1, v1, s1, r1], col); this.tri('fac', a, c, d, [u0, v0, s0, r0], [u1, v1, s1, r1], [u0, v1, s0, r1], col); }
  build(mats, tag = '', order = {}) {
    const out = [];
    for (const g of this.bins.values()) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
      if (g.m === 'fac') { const uv = [], n = g.u.length; for (let i = 0; i < n; i += 2) uv.push(g.u[i], g.u[i + 1]); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('rect', new THREE.Float32BufferAttribute(g.r, 4)); geo.setAttribute('suv', new THREE.Float32BufferAttribute(g.s, 2)); }
      else geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.u, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3));
      if (g.m === 'st') geo.setAttribute('emis', new THREE.Float32BufferAttribute(g.e, 1));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mats[g.m]); mesh.matrixAutoUpdate = false; mesh.name = tag + g.m; mesh.renderOrder = order[g.m] || 0;
      const [i, j] = g.k.split(',').map(Number), c = this.cell; mesh.userData.cell = { x0: (i - 0.5) * c, z0: (j - 0.5) * c, x1: (i + 0.5) * c, z1: (j + 0.5) * c };
      out.push(mesh);
    }
    return out;
  }
}
// MB.tri 對 'fac' 的 uv：[u, v, 水漬 s, 水漬 t]（上面 wall() 傳進來的）；別的材質只看前兩個

// ---- 材質 ----
function makeMats(tex) {
  const st = new THREE.MeshStandardMaterial({ map: tex.prop, vertexColors: true, alphaTest: 0.5, roughness: 0.82, metalness: 0 });
  st.onBeforeCompile = (sh) => { // 頂點的 emis：自己會亮（霓虹、燈箱、紅綠燈的燈罩）→ 加到 emissive
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float emis;\nvarying float vEmis;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmis = emis;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vEmis;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vEmis;');
  };
  st.customProgramCacheKey = () => 'street-st';
  const fac = new THREE.MeshStandardMaterial({ map: tex.fac, vertexColors: true, roughness: 0.86, metalness: 0 });
  fac.onBeforeCompile = (sh) => { // 外牆：磁磚一直重複（fract＋textureGrad：接縫不會有線）、乘上水漬、牆腳暗一點
    sh.uniforms.stainMap = { value: tex.stain };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 rect;\nattribute vec2 suv;\nvarying vec4 vRect;\nvarying vec2 vSuv;\nvarying vec2 vTuv;\nvarying float vY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRect = rect; vSuv = suv; vTuv = uv; vY = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D stainMap;\nvarying vec4 vRect;\nvarying vec2 vSuv;\nvarying vec2 vTuv;\nvarying float vY;')
      .replace('#include <map_fragment>', [
        'vec2 tg = vTuv * vRect.zw;',
        'vec4 texelColor = textureGrad( map, vRect.xy + fract( vTuv ) * vRect.zw, dFdx( tg ), dFdy( tg ) );',
        'diffuseColor *= texelColor;',
        'diffuseColor.rgb *= texture2D( stainMap, vSuv ).rgb;',
        'diffuseColor.rgb *= mix( 0.7, 1.0, smoothstep( 0.02, 0.75, vY ) );', // 牆腳（貼地那一截）暗一點
      ].join('\n'));
  };
  fac.customProgramCacheKey = () => 'street-fac';
  const dec = new THREE.MeshStandardMaterial({ map: tex.ground, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, roughness: 0.9 });
  const lamp = new THREE.MeshBasicMaterial({ map: tex.prop, vertexColors: true, toneMapped: true }); // 紅綠燈的燈、倒數的數字（會變的）
  const wire = new THREE.LineBasicMaterial({ color: 0x1b1c1e, transparent: true, depthWrite: false });
  wire.onBeforeCompile = (sh) => { // 遠的電線變淡（90 → 200 公尺）
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFade;').replace('#include <project_vertex>', '#include <project_vertex>\nvFade = 1.0 - smoothstep( 90.0, 200.0, -mvPosition.z );');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFade;').replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vFade;');
  };
  wire.customProgramCacheKey = () => 'street-wire';
  const moto = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
  const sky = new THREE.MeshBasicMaterial({ map: tex.sky, fog: false, depthWrite: false, depthTest: false, side: THREE.BackSide });
  return { st, fac, dec, lamp, wire, moto, sky };
}


const FH = 3.3; // 透天厝一層樓高（跟 village.js 一樣）
const SUN = (() => { const l = Math.hypot(-18, 30, 24); return [-18 / l, 30 / l, 24 / l]; })(); // 往太陽的方向（buildTrack 的平行光在 (−18, 30, 24)）
const SHOFF = [-SUN[0] / SUN[1], -SUN[2] / SUN[1]]; // 高 1 公尺的東西，影子在地上往 (x, z) 偏多少：(0.6, −0.8)
const SHR = { x0: -540, z0: -135, w: 500, h: 250, W: 1024, H: 512 }; // 地上的影子貼圖蓋的範圍（0.49 公尺一格）
const SCOOT = ['#f2f3f5', '#d0342c', '#2f6fd6', '#c3c8ce', '#ff8fb5', '#f2c230', '#1d1f23', '#3f8f6a', '#8a8f96', '#f2f3f5', '#1d1f23'].map(C);

function buildStreet(W, opts = {}) {
  const aniso = opts.renderer ? Math.min(8, opts.renderer.capabilities.getMaxAnisotropy()) : 4;
  const TR = rng(31337), R = rng(opts.seed ?? 20260928);
  const PA = propAtlas(TR), GA = groundAtlas(TR);
  const tex = { prop: toTex(PA.c, aniso), ground: toTex(GA.c, aniso), fac: toTex(facadeTex(TR), aniso), stain: toTex(stainTex(TR), 2, { linear: true }), sky: toTex(skyTex(TR, '#b4cde2'), 1) };
  tex.sky.minFilter = THREE.LinearFilter; tex.sky.generateMipmaps = false;
  const mats = makeMats(tex);
  const PU = PA.uv, GU = GA.uv, PW = dotUV(PU.white), GW = dotUV(GU.white);
  const SB = new MB(opts.chunk ?? 4000), PB = new MB(opts.cell ?? 160); // SB：不會藏的（外牆、招牌、紅綠燈、地上的東西：整個村子一個材質一個網格，draw call 最少）；PB：小東西（160 公尺一格，遠了就不畫）
  let B = SB;
  const colliders = [], pave = [], WHITE = [1, 1, 1];
  const nodes = W.nodes || {}, buildings = W.buildings || [], houses = W.houses || [], rows = W.rows || [], poles = W.poles || [];
  const roads = (W.roads || []).filter((r) => r.kind === 'main' || r.kind === 'street' || r.kind === 'farm' || r.kind === 'drive');
  const wires = [], wirePush = (a, b) => wires.push(a[0], a[1], a[2], b[0], b[1], b[2]); // 電線（LineSegments）：[x, y, z, x, y, z, ...]

  // ---- 基本形狀（跟 village.js 一樣；材質 'st'：uv 沒給就用白色那一點；emis 用 B.e 設）----
  const box = (m, T, b, col, uv = {}) => {
    const [x0, y0, z0, x1, y1, z1] = b, P = T.p;
    const f = (k, a, bb, c, d) => { const u = uv[k] !== undefined ? uv[k] : uv._; if (u === false) return; const cc = Array.isArray(col) ? col : col[k] || col._ || WHITE; B.quad(m, P(...a), P(...bb), P(...c), P(...d), u || (m === 'dec' ? GW : PW), cc); };
    f('pz', [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); f('nz', [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    f('px', [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]); f('nx', [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    f('py', [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    if (uv.ny !== undefined && uv.ny !== false) f('ny', [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  };
  const vquad = (m, T, a, b, y0, y1, uv, col = WHITE, both = false) => {
    B.quad(m, T.p(a[0], y0, a[1]), T.p(b[0], y0, b[1]), T.p(b[0], y1, b[1]), T.p(a[0], y1, a[1]), uv, col);
    if (both) B.quad(m, T.p(b[0], y0, b[1]), T.p(a[0], y0, a[1]), T.p(a[0], y1, a[1]), T.p(b[0], y1, b[1]), [uv[2], uv[1], uv[0], uv[3]], col);
  };
  const face = (m, T, x0, x1, y0, y1, z, uv, col = WHITE) => vquad(m, T, [x0, z], [x1, z], y0, y1, uv, col);
  const cyl = (m, T, x, z, y0, y1, r0, r1, n, col, uv = null, cap = true) => {
    const P = (a, r, y) => T.p(x + Math.cos(a) * r, y, z - Math.sin(a) * r), u = uv || PW;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, b = ((i + 1) / n) * TAU, ua = u[0] + ((u[2] - u[0]) * i) / n, ub = u[0] + ((u[2] - u[0]) * (i + 1)) / n;
      if (r1 > 0) B.quad(m, P(a, r0, y0), P(b, r0, y0), P(b, r1, y1), P(a, r1, y1), [ua, u[1], ub, u[3]], col);
      else B.tri(m, P(a, r0, y0), P(b, r0, y0), T.p(x, y1, z), [ua, u[1]], [ub, u[1]], [(ua + ub) / 2, u[3]], col);
      if (cap && r1 > 0) B.tri(m, T.p(x, y1, z), P(a, r1, y1), P(b, r1, y1), PW, PW, PW, col);
    }
  };
  const tube = (m, a, b, r0, r1, n, col, uv = null) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d); d[0] /= L; d[1] /= L; d[2] /= L;
    const up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let e1 = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; const l1 = Math.hypot(...e1); e1 = e1.map((v) => v / l1);
    const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]];
    const P = (o, t, r) => { const c = Math.cos(t) * r, s = Math.sin(t) * r; return [o[0] + e1[0] * c + e2[0] * s, o[1] + e1[1] * c + e2[1] * s, o[2] + e1[2] * c + e2[2] * s]; };
    const u = uv || PW;
    for (let i = 0; i < n; i++) { const t0 = (i / n) * TAU, t1 = ((i + 1) / n) * TAU; B.quad(m, P(a, t0, r0), P(a, t1, r0), P(b, t1, r1), P(b, t0, r1), u, col); }
  };
  // 輪子（本地 z 方向的軸）：八邊形，兩面蓋起來
  const wheel = (m, T, x, y, z, r, w, col) => {
    const n = 6, P = (a, zz) => T.p(x + Math.cos(a) * r, y + Math.sin(a) * r, zz);
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, b = ((i + 1) / n) * TAU; B.quad(m, P(a, z - w), P(b, z - w), P(b, z + w), P(a, z + w), PW, col); B.tri(m, T.p(x, y, z + w), P(a, z + w), P(b, z + w), PW, PW, PW, col); B.tri(m, T.p(x, y, z - w), P(b, z - w), P(a, z - w), PW, PW, PW, col); }
  };
  // 地上平平的一片（'dec'）：中心、(dx, dz)＝貼圖上方的方向、len 沿著它、wid 橫的
  const flat = (cx, cz, dx, dz, len, wid, y, uv, col = WHITE) => {
    const rx = -dz, rz = dx, hl = len / 2, hw = wid / 2;
    B.at(cx, cz).quad('dec', [cx - dx * hl - rx * hw, y, cz - dz * hl - rz * hw], [cx - dx * hl + rx * hw, y, cz - dz * hl + rz * hw], [cx + dx * hl + rx * hw, y, cz + dz * hl + rz * hw], [cx + dx * hl - rx * hw, y, cz + dz * hl - rz * hw], uv, col);
  };
  const addBox = (x, z, hx, hz, rot, h) => { const c = { t: 'box', x, z, hx, hz, rot, h }; colliders.push(c); return c; };
  const addCircle = (x, z, r, h) => { const c = { t: 'circle', x, z, r, h }; colliders.push(c); return c; };
  const hitsAny = (x, z, m) => { for (const c of W.colliders || []) if (c.t === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + m : inRect(c, x, z, m)) return true; for (const c of colliders) if (c.t === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + m : inRect(c, x, z, m)) return true; return false; };

  // ---- 路 ----
  const segs = [];
  for (const r of roads) for (let i = 0; i < r.pts.length - 1; i++) {
    const w = Array.isArray(r.w) ? Math.max(r.w[Math.min(i, r.w.length - 1)], r.w[Math.min(i + 1, r.w.length - 1)]) : r.w;
    const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue;
    segs.push({ ax, az, bx, bz, L, dx: (bx - ax) / L, dz: (bz - az) / L, hw: w / 2, r });
  }
  const nearSeg = (x, z, kinds = null) => { let best = null; for (const s of segs) { if (kinds && !kinds.includes(s.r.kind)) continue; const [d, t, qx, qz] = segDist(x, z, s.ax, s.az, s.bx, s.bz); if (!best || d < best.d) best = { d, t, qx, qz, s }; } return best; };
  const onRoad = (x, z, m = 0) => segs.some((s) => s.r.kind !== 'drive' && segDist(x, z, s.ax, s.az, s.bx, s.bz)[0] <= s.hw + m);
  const deg = {}; for (const r of roads) { deg[r.a] = (deg[r.a] || 0) + 1; deg[r.b] = (deg[r.b] || 0) + 1; }
  const nearNode = (x, z, d) => Object.entries(nodes).some(([k, p]) => (deg[k] || 0) >= 3 && Math.hypot(x - p[0], z - p[1]) < d);

  // ---- 地上的影子（一張貼圖蓋整個村子，乘上去）：房子、樹、電線桿的影子，牆腳的暗 ----
  const [mc, mg] = cv(SHR.W, SHR.H), [sc, sg] = cv(SHR.W, SHR.H);
  const kx = SHR.W / SHR.w, kz = SHR.H / SHR.h, px = (x) => (x - SHR.x0) * kx, pz = (z) => (z - SHR.z0) * kz;
  mg.clearRect(0, 0, SHR.W, SHR.H); mg.fillStyle = '#8e9ab3'; // 影子的顏色（天空光：藍一點）
  sg.fillStyle = '#ffffff'; sg.fillRect(0, 0, SHR.W, SHR.H);
  const hull = (P) => { // 凸包（Andrew）
    const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  };
  const shade = {
    box(x, z, hx, hz, rot, h) { // 一個方塊（房子）的影子：地上的長方形＋屋頂往影子方向推 h
      const c = Math.cos(rot || 0), s = Math.sin(rot || 0), cs = [];
      for (const [a, b] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) { const wx = x + a * c + b * s, wz = z - a * s + b * c; cs.push([wx, wz], [wx + SHOFF[0] * h, wz + SHOFF[1] * h]); }
      const H = hull(cs); mg.beginPath(); H.forEach(([a, b], i) => (i ? mg.lineTo(px(a), pz(b)) : mg.moveTo(px(a), pz(b)))); mg.closePath(); mg.fill();
    },
    blob(x, z, r, a) { const g = sg, cx = px(x), cz = pz(z), rr = r * kx; const gr = g.createRadialGradient(cx, cz, 0, cx, cz, rr); gr.addColorStop(0, `rgba(96,106,128,${a})`); gr.addColorStop(0.6, `rgba(96,106,128,${a * 0.7})`); gr.addColorStop(1, 'rgba(96,106,128,0)'); g.fillStyle = gr; g.fillRect(cx - rr, cz - rr, rr * 2, rr * 2); },
    stick(x, z, h, w) { mg.save(); mg.lineWidth = Math.max(1, w * kx); mg.strokeStyle = '#8e9ab3'; mg.lineCap = 'round'; mg.beginPath(); mg.moveTo(px(x), pz(z)); mg.lineTo(px(x + SHOFF[0] * h), pz(z + SHOFF[1] * h)); mg.stroke(); mg.restore(); },
    rim(x, z, hx, hz, rot, a = 0.3) { // 牆腳：房子外框一圈暗暗的（接觸陰影）
      const c = Math.cos(rot || 0), s = Math.sin(rot || 0), g = sg; g.save(); g.strokeStyle = `rgba(70,76,92,${a})`; g.lineWidth = 1.6; g.lineJoin = 'round'; g.beginPath();
      [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].forEach(([a2, b], i) => { const wx = x + a2 * c + b * s, wz = z - a2 * s + b * c; i ? g.lineTo(px(wx), pz(wz)) : g.moveTo(px(wx), pz(wz)); }); g.closePath(); g.stroke(); g.restore();
    },
  };

  const Z = { W, colliders, pave, wires, ticks: [], extra: [] };
  const steps = [facades, facadeProps, gunShop, groundDecals, markings, signals, plates, furniture, scooters, weeds, wiresStep, shadows];
  const stepTris = {}; for (const f of steps) { B = SB; const t0 = SB.tris + PB.tris; f(); stepTris[f.name] = SB.tris + PB.tris - t0; }

  // ==================== 外牆（磁磚、水漬）：每一棟透天厝的正面、露出來的側面、背面 ====================
  function facades() {
    const e = 1.5 / 1024, RECT = [[e, 0.5 + e, 0.5 - 2 * e, 0.5 - 2 * e], [0.5 + e, 0.5 + e, 0.5 - 2 * e, 0.5 - 2 * e], [e, e, 0.5 - 2 * e, 0.5 - 2 * e], [0.5 + e, e, 0.5 - 2 * e, 0.5 - 2 * e]];
    const stainR = (k) => { const ox = (k % 4) * 256, oy = ((k / 4) | 0) * 256; return [(ox + 3) / 1024, 1 - (oy + 253) / 1024, (ox + 253) / 1024, 1 - (oy + 3) / 1024]; };
    const sideC = (h, s) => { const T = frame(h.x, 0, h.z, h.ry); return T.p(s * h.w / 2, 0, -h.D / 2); };
    const covered = (h, s) => { // 旁邊那棟蓋住這面側牆到多高
      const c = sideC(h, s); let best = 0;
      for (const o of houses) { if (o === h || Math.abs(o.D - h.D) > 0.5) continue; for (const t of [1, -1]) { const q = sideC(o, t); if (Math.abs(q[0] - c[0]) < 0.08 && Math.abs(q[2] - c[2]) < 0.08) best = Math.max(best, o.H + o.ph); } }
      return best;
    };
    const NEUT = [C('#d9d1c3'), C('#d5d3cc'), C('#b9b6ae'), C('#ece9e2')]; // 二丁掛（米色）、馬賽克、洗石子（灰）、油漆（白）
    B = SB;
    for (const h of houses) {
      const T = frame(h.x, 0, h.z, h.ry), w = h.w, D = h.D, H = h.H, top = H + h.ph;
      const r1 = hxz(h.x, h.z, 1), type = r1 < 0.42 ? 0 : r1 < 0.66 ? 1 : r1 < 0.78 ? 2 : 3, M = FAC_M[type];
      const k2 = hxz(h.x, h.z, 2), k3 = hxz(h.x, h.z, 3);
      const gray = (c) => { const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return [l, l, l]; };
      let col = mix(mix(h.cw, gray(h.cw), 0.2), NEUT[type], type === 2 ? 0.7 : 0.22); col = mul(col, 0.95 + k3 * 0.08);
      h.fac = { type, col };
      B.at(h.x, h.z); B.rect = RECT[type];
      const off = k2 * M;
      const si = (k2 * 16) | 0; B.sr = stainR(si % 4 === 3 ? si - 1 : si); // 正面不用最髒那一種（每排第 4 格）
      B.wall(T.p(-w / 2, 0, 0), T.p(w / 2, 0, 0), T.p(w / 2, top, 0), T.p(-w / 2, top, 0), [off / M, 0, (off + w) / M, top / M], [0, 0, 1, 1], col);
      // 側面、背面：油漆＋很髒（上面流下來的水痕、青苔）
      const sc = mul(mix(mix(h.cs, gray(h.cs), 0.35), NEUT[3], 0.3), 0.93), SM = FAC_M[3];
      B.rect = RECT[3];
      for (const s of [1, -1]) {
        const y0 = covered(h, s); if (y0 >= H - 0.05) continue;
        B.sr = stainR(3 + 4 * (((hxz(h.x, h.z, 5 + s) * 4) | 0) % 4));
        const a = s > 0 ? T.p(w / 2, y0, 0) : T.p(-w / 2, y0, -D), b = s > 0 ? T.p(w / 2, y0, -D) : T.p(-w / 2, y0, 0);
        const c = s > 0 ? T.p(w / 2, H, -D) : T.p(-w / 2, H, 0), d = s > 0 ? T.p(w / 2, H, 0) : T.p(-w / 2, H, -D);
        B.wall(a, b, c, d, [0, y0 / SM, D / SM, H / SM], [0, y0 / H, 1, 1], sc);
      }
      B.sr = stainR(2 + 4 * (((k3 * 4) | 0) % 4));
      B.wall(T.p(w / 2, 0, -D), T.p(-w / 2, 0, -D), T.p(-w / 2, H, -D), T.p(w / 2, H, -D), [0, 0, w / SM, H / SM], [0, 0, 1, 1], sc);
    }
  }

  // ==================== 外牆上的東西：鐵窗、陽台的盆栽、冷氣、招牌、頂樓的太陽能熱水器、天線、牆上的暗（陽台下面）====================
  function facadeProps() {
    const RUST = [C('#e8e8e4'), C('#d9d9d4'), C('#7a6a5a'), C('#5a5e63'), C('#e8e8e4')], POTS = [C('#a0522d'), C('#8a4b2e'), C('#3f6fb0'), C('#e2e2dc')];
    let hi = 0, vi = 0;
    for (const h of houses) {
      const T = frame(h.x, 0, h.z, h.ry), w = h.w, H = h.H, q = (k) => hxz(h.x, h.z, k);
      // 鐵窗（凸出來的鐵籠子）
      B = PB; B.at(h.x, h.z);
      for (const fo of h.flo || []) {
        const y = fo.f * FH;
        if (fo.t === 'w' && q(10 + fo.f) < 0.72) {
          const gw = fo.gw, x0 = -gw / 2 - 0.12, x1 = gw / 2 + 0.12, y0 = y + 0.72, y1 = y + 2.56, z1 = 0.5, gc = RUST[((q(20 + fo.f) * RUST.length) | 0)];
          face('st', T, x0, x1, y0, y1, z1, PU.grill, gc); vquad('st', T, [x1, z1], [x0, z1], y0, y1, [PU.grill[2], PU.grill[1], PU.grill[0], PU.grill[3]], gc); // 前面（兩面都看得到）
          for (const sx of [x0, x1]) { const g = subUV(PU.grill, 0, 0, 0.18, 1); vquad('st', T, [sx, 0], [sx, z1], y0, y1, g, gc, true); }
          box('st', T, [x0 - 0.04, y1, -0.02, x1 + 0.04, y1 + 0.06, z1 + 0.12], mul(gc, 0.8)); // 上面的小屋頂
          box('st', T, [x0, y0 - 0.05, 0, x1, y0, z1], mul(gc, 0.85), { ny: PW });
        }
        if (fo.t === 'b') { // 陽台：欄杆上的盆栽
          if (q(30 + fo.f) < 0.55) { const n = 2 + ((q(31 + fo.f) * 3) | 0); for (let i = 0; i < n; i++) { const x = -w / 2 + 0.5 + ((i + 0.5) * (w - 1)) / n + (q(40 + i) - 0.5) * 0.3, pc = POTS[((q(50 + i) * 4) | 0)]; box('st', T, [x - 0.14, y + 1.0, 0.88, x + 0.14, y + 1.22, 1.1], pc); const s = 0.35 + q(60 + i) * 0.25; vquad('st', T.sub(x, y + 1.18, 0.99, q(70 + i) * 3), [-s, 0], [s, 0], 0, s * 1.3, PU.bush, WHITE, true); vquad('st', T.sub(x, y + 1.18, 0.99, q(70 + i) * 3 + 1.5), [-s, 0], [s, 0], 0, s * 1.3, PU.bush, WHITE, true); } }
          B = SB; B.at(h.x, h.z); face('dec', T, -w / 2 + 0.1, w / 2 - 0.1, y - 1.0, y - 0.16, 0.012, [GU.ao[0], GU.ao[3], GU.ao[2], GU.ao[1]], [1, 1, 1]); B = PB; // 陽台下面的牆暗一點
        }
      }
      if (h.awn) { B = SB; B.at(h.x, h.z); face('dec', T, -w / 2, w / 2, 1.9, 2.95, 0.013, [GU.ao[0], GU.ao[3], GU.ao[2], GU.ao[1]], [1, 1, 1]); B = PB; } // 雨遮下面
      // 冷氣室外機（掛在露出來的側牆上）
      for (const s of [1, -1]) if (q(80 + s) < 0.4 && h.fl >= 3) {
        const fz = -1.5 - q(82 + s) * (h.D - 3), fy = FH * (1 + ((q(84 + s) * (h.fl - 1)) | 0)) + 0.5, Ts = T.sub(s * (w / 2 + 0.3), fy, fz, s > 0 ? Math.PI / 2 : -Math.PI / 2);
        box('st', Ts, [-0.4, 0, -0.3, 0.4, 0.55, 0.0], { pz: WHITE, _: C('#e4e4e0') }, { pz: PU.acF, _: PW }); box('st', Ts, [-0.35, -0.06, -0.3, 0.35, 0.0, -0.02], C('#8f949a'));
      }
      // 電錶箱（一樓正面旁邊）、瓦斯桶、門口的盆栽
      if (h.kind !== 'shop') {
        const ex = (h.kind === 'door' ? -1 : 1) * (w / 2 - 0.35);
        box('st', T, [ex - 0.17, 1.3, 0.01, ex + 0.17, 1.8, 0.16], { pz: WHITE, _: C('#c9ccd0') }, { pz: PU.meter, _: PW });
        if (q(90) < 0.4) { const gx = h.door + (h.door > 0 ? -1.0 : 1.0), gcol = q(91) < 0.5 ? C('#8fa4b8') : C('#3f7f8f'); cyl('st', T.sub(gx, 0, 0.3), 0, 0, 0, 0.72, 0.16, 0.16, 8, gcol); cyl('st', T.sub(gx, 0, 0.3), 0, 0, 0.72, 0.8, 0.08, 0.05, 6, C('#2a2c30')); const p = T.p(gx, 0, 0.3); addCircle(p[0], p[2], 0.18, 0.8); }
        if (q(92) < 0.5) for (const sgn of [-1, 1]) { const px2 = h.door + sgn * (h.kind === 'door' ? 1.15 : 0.95); if (Math.abs(px2) > w / 2 - 0.3) continue; const p = T.p(px2, 0, 0.35); if (hitsAny(p[0], p[2], 0.25)) continue; const pc = POTS[((q(93 + sgn) * 4) | 0)], s = 0.4 + q(95 + sgn) * 0.3; box('st', T, [px2 - 0.2, 0, 0.15, px2 + 0.2, 0.36, 0.55], pc); vquad('st', T.sub(px2, 0.3, 0.35, 0.4), [-s, 0], [s, 0], 0, s * 1.6, PU.bush, WHITE, true); vquad('st', T.sub(px2, 0.3, 0.35, 1.97), [-s, 0], [s, 0], 0, s * 1.6, PU.bush, WHITE, true); addCircle(p[0], p[2], 0.25, 0.9); }
      }
      // 頂樓：太陽能熱水器（朝南）、天線
      if (q(100) < 0.3) { const sx = (q(101) - 0.5) * Math.max(0, w - 2.6), Tr = T.sub(sx, H, -2.4), sy = Math.PI - h.ry; // 朝南（世界 +z）
        const Tp = frame(Tr.x, H, Tr.z, 0); void sy;
        B.quad('st', Tp.p(-0.9, 0.35, 0.5), Tp.p(0.9, 0.35, 0.5), Tp.p(0.9, 1.3, -0.5), Tp.p(-0.9, 1.3, -0.5), PU.solar, WHITE); // 集熱管（面朝南、斜的）
        B.quad('st', Tp.p(0.9, 0.35, 0.5), Tp.p(-0.9, 0.35, 0.5), Tp.p(-0.9, 1.3, -0.5), Tp.p(0.9, 1.3, -0.5), PW, C('#8f949a'));
        tube('st', Tp.p(-1.0, 1.42, -0.62), Tp.p(1.0, 1.42, -0.62), 0.22, 0.22, 8, C('#d9dde1')); // 水箱
        for (const x of [-0.8, 0.8]) box('st', Tp, [x - 0.03, 0, -0.6, x + 0.03, 1.3, 0.5], C('#9aa0a6'), { py: false });
      }
      if (q(102) < 0.25) { const ax = (q(103) - 0.5) * (w - 1), Ta = T.sub(ax, H + 0.9, -h.D + 0.8); tube('st', Ta.p(0, 0, 0), Ta.p(0, 2.6, 0), 0.025, 0.02, 4, C('#9aa0a6')); for (let i = 0; i < 4; i++) { const y = 1.6 + i * 0.28, l = 0.7 - i * 0.12; tube('st', Ta.p(-l, y, 0), Ta.p(l, y, 0), 0.012, 0.012, 3, C('#9aa0a6')); } }
      // 招牌：一樓上面的橫招牌（鐵捲門的店）、樓上的直立招牌
      B = SB; B.at(h.x, h.z);
      const hasH = h.kind === 'shutter' && h.vsign == null && q(110) < 0.5; // 村子自己有直立招牌的那幾棟不加（一棟一家店）
      if (hasH) {
        const [sx0, sx1] = h.shutter || [-w / 2 + 0.3, w / 2 - 0.3], k = hi++ % SHOPS_H.length, bal = (h.flo || []).some((f) => f.f === 1 && f.t === 'b');
        if (h.b && !h.b.name) { h.b.name = SHOPS_H[k][0]; h.b.streetSign = SHOPS_H[k][0]; } // V.buildings 那一筆：走進去的時候對得上招牌（interiors.js 看 name 裡的字決定開什麼店）
        const x0 = Math.max(-w / 2 + 0.1, sx0 - 0.2), x1 = Math.min(w / 2 - 0.1, Math.max(sx1 + 0.4, x0 + 3.2)), zz = h.awn ? 1.14 : 0.3, y0 = h.awn ? 2.98 : 2.72, y1 = h.awn ? 3.48 : bal ? 3.1 : 3.22;
        B.e = 0.22; box('st', T, [x0, y0, zz - 0.12, x1, y1, zz], { pz: WHITE, _: C('#d8dade') }, { pz: PU['h' + k], _: PW }); B.e = 0;
      }
      const hasV = h.vsign != null || (h.kind === 'shop' && h.fl >= 3);
      if (!hasV && !hasH && h.fl >= 3 && q(111) < 0.33) {
        const k = vi++ % SHOPS_V.length, u = PU['v' + k], xs = -w / 2 + 0.12;
        if (h.b && !h.b.name && !h.b.sign) { h.b.sign = SHOPS_V[k][0]; h.b.streetSign = SHOPS_V[k][0]; } // 直立招牌的字（跟村子的 o.vsign 一樣放 sign）
        B.e = 0.25; box('st', T, [xs, 3.7, 1.12, xs + 0.24, 7.5, 1.95], { px: WHITE, nx: WHITE, _: C('#d8dade') }, { px: u, nx: u, _: PW }); B.e = 0; // 掛在陽台外面（不會插進陽台）
        box('st', T, [xs + 0.08, 7.5, 0.0, xs + 0.16, 7.56, 1.85], C('#8f949a')); box('st', T, [xs + 0.08, 3.64, 0.0, xs + 0.16, 3.7, 1.85], C('#8f949a'));
      }
    }
  }

  // ==================== 槍店（改車廠對面：x −167…−157、z 14…26，門朝北）====================
  function gunShop() {
    const GX = -162, GZ = 14, w = 10, D = 12, H = 7.0, ph = 0.9, T = frame(GX, 0, GZ, Math.PI);
    B = SB; B.at(GX, GZ + D / 2);
    const e = 1.5 / 1024;
    // 外牆：正面（米色二丁掛）、側面、背面（油漆）
    B.rect = [e, 0.5 + e, 0.5 - 2 * e, 0.5 - 2 * e]; B.sr = [3 / 1024, 1 - 253 / 1024, 253 / 1024, 1 - 3 / 1024];
    const fc = C('#c9c1b3'), sc = C('#cfcbc2');
    B.wall(T.p(-w / 2, 0, 0), T.p(w / 2, 0, 0), T.p(w / 2, H + ph, 0), T.p(-w / 2, H + ph, 0), [0, 0, w / 3.2, (H + ph) / 3.2], [0, 0, 1, 1], fc);
    B.rect = [0.5 + e, e, 0.5 - 2 * e, 0.5 - 2 * e]; B.sr = [(768 + 3) / 1024, 1 - 509 / 1024, 1021 / 1024, 1 - 259 / 1024];
    B.wall(T.p(w / 2, 0, 0), T.p(w / 2, 0, -D), T.p(w / 2, H + ph, -D), T.p(w / 2, H + ph, 0), [0, 0, D / 4, (H + ph) / 4], [0, 0, 1, 1], sc);
    B.wall(T.p(-w / 2, 0, -D), T.p(-w / 2, 0, 0), T.p(-w / 2, H + ph, 0), T.p(-w / 2, H + ph, -D), [0, 0, D / 4, (H + ph) / 4], [0, 0, 1, 1], sc);
    B.wall(T.p(w / 2, 0, -D), T.p(-w / 2, 0, -D), T.p(-w / 2, H + ph, -D), T.p(w / 2, H + ph, -D), [0, 0, w / 4, (H + ph) / 4], [0, 0, 1, 1], sc);
    box('st', T, [-w / 2, H, -D, w / 2, H + 0.02, 0], C('#a9a8a2'), { py: PW, _: false }); // 屋頂（女兒牆裡面）
    box('st', T, [-w / 2 + 0.15, H, -D + 0.15, w / 2 - 0.15, H + ph - 0.02, -0.15], C('#c9c5bd'), { py: false, _: false, pz: false }); // （裡面看不到，不畫）
    for (const [x0, z0, x1, z1] of [[-w / 2, -D, w / 2, -D + 0.18], [-w / 2, -0.18, w / 2, 0], [-w / 2, -D, -w / 2 + 0.18, 0], [w / 2 - 0.18, -D, w / 2, 0]]) box('st', T, [x0, H, z0, x1, H + ph, z1], C('#c9c5bd'), { py: PW, pz: z1 === 0 ? false : PW, nz: z0 === -D ? false : PW, px: x1 === w / 2 ? false : PW, nx: x0 === -w / 2 ? false : PW }); // 女兒牆（裡面那幾面）
    cyl('st', T, 2.5, -D + 2.4, H, H + 1.3, 0.62, 0.62, 10, C('#2f78c8')); cyl('st', T, 2.5, -D + 2.4, H + 1.3, H + 1.55, 0.62, 0.2, 10, C('#2a66ad'));
    // 一樓店面：黑色外框、櫥窗（牆上的槍）、鐵窗、玻璃門
    const dark = C('#2a2c30');
    box('st', T, [-w / 2 + 0.1, 0, 0, w / 2 - 0.1, 3.0, 0.08], dark, { pz: PW, _: PW });
    B.e = 0.4; face('st', T, -4.3, 0.7, 0.55, 2.65, 0.1, PU.gunWin); B.e = 0; // 櫥窗（裡面有燈）
    face('st', T, -4.35, 0.75, 0.5, 2.7, 0.2, PU.grill, C('#3a3d42')); vquad('st', T, [0.75, 0.2], [-4.35, 0.2], 0.5, 2.7, [PU.grill[2], PU.grill[1], PU.grill[0], PU.grill[3]], C('#3a3d42'));
    box('st', T, [-4.45, 0, 0.08, 0.85, 0.5, 0.3], C('#3a3d42')); // 櫥窗下面
    B.e = 0.05; face('st', T, 1.45, 3.55, 0, 2.55, 0.1, PU.gdoor); B.e = 0; box('st', T, [1.3, 2.55, 0.05, 3.7, 2.95, 0.3], C('#50555c')); // 門、門上的鐵捲門箱
    // 大招牌（蓋住二樓一半）＋直立燈箱
    B.e = 0.3; box('st', T, [-4.45, 3.1, 0.05, 4.45, 5.3, 0.3], { pz: WHITE, _: C('#17191c') }, { pz: PU.gunSign, _: PW }); B.e = 0;
    for (const x of [-3.5, 0, 3.5]) box('st', T, [x - 0.05, 5.3, 0.1, x + 0.05, 5.45, 0.45], C('#8f949a')); // 招牌上的燈架
    B.e = 0.35; box('st', T, [w / 2 - 0.36, 3.4, 0.1, w / 2 - 0.12, 6.6, 1.0], { px: WHITE, nx: WHITE, _: C('#17191c') }, { px: PU.vGun, nx: PU.vGun, _: PW }); B.e = 0;
    // 二樓：兩個有鐵窗的窗
    for (const xc of [-2.2, 2.2]) { face('st', T, xc - 1.1, xc + 1.1, 5.55, 6.75, 0.02, PU.win2, WHITE); face('st', T, xc - 1.2, xc + 1.2, 5.5, 6.8, 0.3, PU.grill, C('#e8e8e4')); box('st', T, [xc - 1.25, 6.8, 0, xc + 1.25, 6.86, 0.4], C('#9aa0a6')); }
    // 門口的水泥地、停車格、立牌
    pave.push({ x: -163.3, z: 9.5, hx: 6.7, hz: 4.5, col: '#c6c6c1' });
    B = SB; for (const x of [-164.6, -161.8]) flat(x, 9.7, 0, 1, 5.0, 0.12, 0.05, GW, [0.95, 0.95, 0.95]); flat(-163.2, 7.2, 1, 0, 2.9, 0.12, 0.05, GW, [0.95, 0.95, 0.95]);
    B = PB; B.at(-157.8, 12.6); { const Tb = frame(-157.8, 0, 12.6, Math.PI / 2 + 0.3); B.e = 0.5; box('st', Tb, [-0.24, 0.1, -0.15, 0.24, 1.35, 0.15], { pz: WHITE, nz: WHITE, _: C('#17191c') }, { pz: PU.vGun, nz: PU.vGun, _: PW }); B.e = 0; box('st', Tb, [-0.28, 0, -0.2, 0.28, 0.1, 0.2], C('#2a2c30')); addCircle(-157.8, 12.6, 0.3, 1.4); }
    addBox(GX, GZ + D / 2, w / 2, D / 2, 0, H + ph);
    shade.box(GX, GZ + D / 2, w / 2, D / 2, 0, H + ph); shade.rim(GX, GZ + D / 2, w / 2, D / 2, 0);
    const dp = T.p(2.5, 0, 0.6);
    const place = {
      name: '槍店', pos: [GX, 11],
      spawn: { x: -163, z: 9.5, heading: Math.PI / 2 },                 // 店門口的停車格（車頭朝大路）
      zone: { x: -163.3, z: 9.6, hx: 6.4, hz: 4.2, rot: 0 },             // 店門口的水泥地（停在這裡）
      door: { x: dp[0], z: dp[2], heading: Math.PI / 2 },                 // 店門外面（朝外）：走路的人從這裡進去（裡面是 gunshop.js）
      front: { x: GX, z: GZ, heading: Math.PI / 2 },                      // 店面中間
      building: { x: GX, z: GZ + D / 2, hx: w / 2, hz: D / 2, rot: Math.PI },
    };
    Z.gunshop = { place, building: { kind: 'gunshop', name: '槍店', x: GX, z: GZ + D / 2, hx: w / 2, hz: D / 2, rot: Math.PI, h: H + ph, floors: 2, door: { x: dp[0], z: dp[2], ry: Math.PI } } };
  }

  // ==================== 地上：柏油補丁、裂縫、油漬、胎痕、路邊的泥土；騎樓前的水溝蓋；紅線、黃線 ====================
  function groundDecals() {
    B = SB; const r = rng(4242);
    for (const s of segs) {
      if (s.r.kind === 'drive') continue;
      const n = Math.max(1, Math.round(s.L / (s.r.kind === 'farm' ? 16 : 9))), rx = -s.dz, rz = s.dx;
      for (let i = 0; i < n; i++) {
        const t = (i + r()) / n, cx = s.ax + (s.bx - s.ax) * t, cz = s.az + (s.bz - s.az) * t, k = r();
        if (nearNode(cx, cz, s.hw + 2)) continue; // 路口那塊（另外一塊柏油）不要
        const lat = (r() - 0.5) * 2 * (s.hw - 1.0), x = cx + rx * lat, z = cz + rz * lat;
        if (k < 0.3) flat(x, z, s.dx, s.dz, 1.5 + r() * 3, 1 + r() * 1.6, 0.046, GU['patch' + ((r() * 3) | 0)]);
        else if (k < 0.48) flat(x, z, s.dx, s.dz, 3 + r() * 4, 0.9, 0.047, GU.crack);
        else if (k < 0.7) { const lane = (r() < 0.5 ? 1 : -1) * s.hw * 0.5; flat(cx + rx * lane, cz + rz * lane, s.dx, s.dz, 3 + r() * 3, 0.9, 0.048, GU.oil); }
        else if (k < 0.85) { const ed = (r() < 0.5 ? 1 : -1) * (s.hw - 0.45); flat(cx + rx * ed, cz + rz * ed, s.dx, s.dz, 2 + r() * 3, 0.9, 0.047, GU.dirt); }
        else if (k < 0.93 && s.r.kind !== 'farm') flat(cx, cz, rx, rz, s.hw * 2 - 0.2, 1.0 + r() * 0.6, 0.046, GU.patch2); // 挖過的水管溝（橫過整條路）
      }
      // 路口前後的胎痕
      for (const end of [0, 1]) { const px2 = end ? s.bx : s.ax, pz2 = end ? s.bz : s.az; if (!nearNode(px2, pz2, 1) || s.L < 20) continue; const sg2 = end ? -1 : 1; for (let j = 0; j < 2; j++) { const d = 8 + r() * 10, lane = (j ? 1 : -1) * s.hw * 0.5; flat(px2 + s.dx * d * sg2 + rx * lane, pz2 + s.dz * d * sg2 + rz * lane, s.dx, s.dz, 4 + r() * 3, 1.4, 0.048, GU.tire); } }
    }
    // 騎樓前（每一排透天厝）的水溝蓋：路邊 0.55 公尺寬，一塊 2.2 公尺
    for (const rw of rows) {
      const L = Math.hypot(rw.bx - rw.ax, rw.bz - rw.az), ux = (rw.bx - rw.ax) / L, uz = (rw.bz - rw.az) / L, mx = (rw.ax + rw.bx) / 2 + rw.nx * rw.ap, mz = (rw.az + rw.bz) / 2 + rw.nz * rw.ap;
      const ns = nearSeg(mx, mz, ['main', 'street', 'farm']); if (!ns) continue;
      const dFac = Math.abs((ns.qx - (rw.ax + rw.bx) / 2) * rw.nx + (ns.qz - (rw.az + rw.bz) / 2) * rw.nz); // 房子正面到路中線
      const dR = dFac - ns.s.hw, out = Math.min(rw.ap, dR), inn = out - 0.55; if (out < 0.7 || dFac > 16) continue;
      const nT = Math.floor(L / 2.2);
      for (let i = 0; i < nT; i++) { const t = (i + 0.5) * (L / nT), cx = rw.ax + ux * t + rw.nx * (out + inn) / 2, cz = rw.az + uz * t + rw.nz * (out + inn) / 2; flat(cx, cz, rw.nx, rw.nz, 0.55, L / nT - 0.02, 0.051, [GU.ditch[0], GU.ditch[1], GU.ditch[2], GU.ditch[3]]); }
      // 路邊的黃線（不能停車）／紅線（路口附近）：畫在路面的邊上
      const e0 = dR - 0.25; if (dR > rw.ap + 0.5) continue;
      for (let t = 0; t < L; t += 2) {
        const t1 = Math.min(L, t + 2), cx = rw.ax + ux * (t + t1) / 2 + rw.nx * e0, cz = rw.az + uz * (t + t1) / 2 + rw.nz * e0;
        const red = nearNode(cx, cz, 16);
        flat(cx, cz, ux, uz, t1 - t, 0.13, 0.052, GW, red ? [0.62, 0.06, 0.05] : [0.85, 0.62, 0.05]);
      }
    }
  }

  // ==================== 路上的字、線：大路口（C）的停止線、箭頭；小路口的「停」＋停止線 ====================
  function markings() {
    B = SB;
    const arms = (k) => { const p = nodes[k]; if (!p) return []; const out = []; for (const r of roads) { if (r.a !== k && r.b !== k) continue; const q = r.a === k ? r.pts : r.pts.slice().reverse(); const dx = q[1][0] - q[0][0], dz = q[1][1] - q[0][1], l = Math.hypot(dx, dz); const w = Array.isArray(r.w) ? r.w[r.a === k ? 0 : r.w.length - 1] : r.w; out.push({ r, ox: dx / l, oz: dz / l, hw: w / 2, q }); } return out; };
    Z.arms = arms;
    const WH = [0.95, 0.95, 0.95];
    // 大路口：每個方向停止線（右半邊）、斑馬線（village.js 已經畫了，這裡記下來）、大路兩頭的直行箭頭
    const cA = arms('C'), [cx, cz] = nodes.C || [0, 0]; Z.crossings = [];
    for (const a of cA) {
      const rx = -a.oz, rz = a.ox; // 往外看的左邊…進來的車（方向 −o）的右邊＝(−(−oz), −ox)…
      const dxIn = -a.ox, dzIn = -a.oz, rIn = [-dzIn, dxIn]; // 開進來的車的右手邊
      const sd = 10.6, sx = cx + a.ox * sd + rIn[0] * a.hw / 2, sz = cz + a.oz * sd + rIn[1] * a.hw / 2;
      flat(sx, sz, a.ox, a.oz, 0.4, a.hw - 0.3, 0.052, GW, WH);
      if (a.r.kind === 'main' || a.r.kind === 'street') for (const d of [27, 42]) { const ax2 = cx + a.ox * d + rIn[0] * a.hw / 2, az2 = cz + a.oz * d + rIn[1] * a.hw / 2; flat(ax2, az2, dxIn, dzIn, 5, 1.1, 0.052, GU.arU); }
      const zc = [cx + a.ox * 8.4, cz + a.oz * 8.4], hw = a.hw - 0.3;
      Z.crossings.push({ a: [zc[0] + rx * hw, zc[1] + rz * hw], b: [zc[0] - rx * hw, zc[1] - rz * hw], w: 3, node: 'C', signal: 'C', group: Math.abs(a.ox) > 0.7 ? 'ns' : 'ew' });
    }
    // 小路口（沒有紅綠燈）：從小路開出來的地方畫「停」＋停止線
    const STOPS = [['X', 'G'], ['W', 'G'], ['W', 'POL'], ['E1', 'C'], ['SHX', 'SHB'], ['SH', 'GSP']];
    for (const [k, from] of STOPS) {
      const p = nodes[k]; if (!p) continue;
      for (const a of arms(k)) {
        if (!(a.r.a === from || a.r.b === from)) continue;
        if (k === 'E1' && a.r.kind !== 'farm') continue;
        const cross = arms(k).filter((o) => Math.abs(o.ox * a.ox + o.oz * a.oz) < 0.5).reduce((m, o) => Math.max(m, o.hw), 0) || 4.5;
        const dxIn = -a.ox, dzIn = -a.oz, rIn = [-dzIn, dxIn];
        const sd = cross + 1.4, sx = p[0] + a.ox * sd + rIn[0] * a.hw / 2, sz = p[1] + a.oz * sd + rIn[1] * a.hw / 2;
        flat(sx, sz, a.ox, a.oz, 0.4, a.hw - 0.3, 0.052, GW, WH);
        if (a.r.kind !== 'drive') { const td = cross + 5.2, tx = p[0] + a.ox * td + rIn[0] * a.hw / 2, tz = p[1] + a.oz * td + rIn[1] * a.hw / 2; flat(tx, tz, dxIn, dzIn, 2.6, 1.2, 0.052, GU.ting); }
      }
    }
    // 人行道（騎樓前）的中線：以後居民走路用
    Z.sidewalks = rows.map((rw) => ({ pts: [[rw.ax + rw.nx * rw.ap / 2, rw.az + rw.nz * rw.ap / 2], [rw.bx + rw.nx * rw.ap / 2, rw.bz + rw.nz * rw.ap / 2]], w: rw.ap, side: [rw.nx, rw.nz] }));
    Z.sidewalks.push({ pts: [[-369.5, 8.4], [-367, 8.4], [-367, 19]], w: 2.4, side: [0, -1], place: 'police' }, { pts: [[-160.9, 7.6], [-164.5, 12.8]], w: 2, side: [0, -1], place: 'gunshop' }); // 第 9 批：大路寬了，起點往外
  }

  // ==================== 紅綠燈（大路口 C）：四根桿子、懸臂上的燈＋倒數、行人號誌 ====================
  function signals() {
    const p = nodes.C; if (!p) { Z.signals = []; return; }
    const [cx, cz] = p, A = Z.arms('C'); if (A.length < 4) { Z.signals = []; return; }
    const CYC = 60, EG = 27, Y = 3, AR = 2, NG = 23; // 東西綠 27 秒、黃 3、全紅 2、南北綠 23、黃 3、全紅 2
    const phase = (t) => {
      const u = ((t % CYC) + CYC) % CYC, o = {};
      if (u < EG) { o.ew = 'green'; o.ewLeft = EG - u; } else if (u < EG + Y) { o.ew = 'yellow'; o.ewLeft = EG + Y - u; } else { o.ew = 'red'; o.ewLeft = CYC - u; }
      const n0 = EG + Y + AR;
      if (u < n0) { o.ns = 'red'; o.nsLeft = n0 - u; } else if (u < n0 + NG) { o.ns = 'green'; o.nsLeft = n0 + NG - u; } else if (u < n0 + NG + Y) { o.ns = 'yellow'; o.nsLeft = n0 + NG + Y - u; } else { o.ns = 'red'; o.nsLeft = CYC - u + n0; }
      o.walkEW = o.ew === 'green' ? (o.ewLeft > 6 ? 'walk' : 'flash') : 'stop';
      o.walkNS = o.ns === 'green' ? (o.nsLeft > 6 ? 'walk' : 'flash') : 'stop';
      return o;
    };
    // 燈的網格（一個，頂點色每秒改）
    const L = { p: [], u: [], c: [] }, lamps = [], digits = [];
    const lq = (a, b, c, d, uv, kind, group) => { const i0 = L.p.length / 3; for (const q of [a, b, c, a, c, d]) L.p.push(q[0], q[1], q[2]); const [u0, v0, u1, v1] = uv; L.u.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1); for (let i = 0; i < 6; i++) L.c.push(0.05, 0.05, 0.05); return { i0, kind, group }; };
    const heads = [], dark = C('#1f2226'), gray = C('#8d9197');
    const byDir = (dx, dz) => A.find((a) => a.ox * dx + a.oz * dz > 0.9);
    for (const a of A) {
      const d = [-a.ox, -a.oz], r = [-d[1], d[0]]; // 開進來的方向、右手邊
      const armR = byDir(r[0], r[1]), far = byDir(d[0], d[1]); if (!armR || !far) continue;
      let px2 = cx + d[0] * (armR.hw + 1.3) + r[0] * (far.hw + 1.1), pz2 = cz + d[1] * (armR.hw + 1.3) + r[1] * (far.hw + 1.1);
      for (let k = 0; k < 6 && hitsAny(px2, pz2, 0.35); k++) { px2 += r[0] * 0.4; pz2 += r[1] * 0.4; }
      const group = Math.abs(a.ox) > 0.7 ? 'ew' : 'ns';
      const T = frame(px2, 0, pz2, Math.atan2(-r[0], -r[1]) + Math.PI); // 本地 +z＝往右（r），本地 +x＝往前（d）？下面直接用世界向量
      void T;
      B = SB; B.at(px2, pz2);
      const P0 = frame(px2, 0, pz2, 0);
      cyl('st', P0, 0, 0, 0, 6.2, 0.14, 0.11, 8, gray); cyl('st', P0, 0, 0, 0, 0.5, 0.2, 0.2, 8, C('#a9adb2'));
      const armLen = far.hw + 1.1 - a.hw / 2 + 0.2, tip = [px2 - r[0] * armLen, 5.75, pz2 - r[1] * armLen];
      tube('st', [px2, 5.75, pz2], tip, 0.07, 0.05, 6, gray); tube('st', [px2, 6.1, pz2], [px2 - r[0] * armLen * 0.55, 5.8, pz2 - r[1] * armLen * 0.55], 0.03, 0.03, 4, gray);
      // 燈頭：橫的（紅、黃、綠：開車的人看左到右），旁邊倒數
      const hc = [tip[0] + r[0] * 0.15, 5.45, tip[2] + r[1] * 0.15], Hd = frame(hc[0], hc[1], hc[2], Math.atan2(-r[1], r[0])); // 本地 +x＝r（右）、本地 +z＝往車子（−d）？
      // frame：本地 +x → (cos, −sin)＝r；本地 +z → (sin, cos)＝(−r[1]... ) 算出來＝−d（朝開過來的車）
      box('st', Hd, [-0.75, -0.21, -0.16, 0.55, 0.21, 0.12], dark);
      const lampAt = (lx, kind) => { const s = 0.15; lamps.push(lq(Hd.p(lx - s, -s, 0.125), Hd.p(lx + s, -s, 0.125), Hd.p(lx + s, s, 0.125), Hd.p(lx - s, s, 0.125), PU.disc, kind, group)); box('st', Hd, [lx - 0.19, 0.13, 0.12, lx + 0.19, 0.17, 0.34], dark); };
      lampAt(-0.52, 'R'); lampAt(-0.14, 'Y'); lampAt(0.24, 'G');
      box('st', frame(hc[0], hc[1], hc[2], Hd.ry).sub(0.9, 0, 0), [-0.3, -0.21, -0.14, 0.3, 0.21, 0.1], dark); // 倒數的箱子
      const Dg = frame(hc[0], hc[1], hc[2], Hd.ry).sub(0.9, 0, 0);
      for (const [lx, pos] of [[-0.13, 'tens'], [0.13, 'ones']]) digits.push({ ...lq(Dg.p(lx - 0.11, -0.17, 0.105), Dg.p(lx + 0.11, -0.17, 0.105), Dg.p(lx + 0.11, 0.17, 0.105), Dg.p(lx - 0.11, 0.17, 0.105), subUV(PU.digits, 0, 0, 0.1, 1), 'D', group), pos });
      heads.push({ x: hc[0], z: hc[2], y: hc[1], facing: Math.atan2(-(-d[1]), -d[0]), group, approach: [d[0], d[1]], stop: [cx + a.ox * 10.6, cz + a.oz * 10.6] });
      // 行人號誌：這根桿子旁邊的兩條斑馬線，各一個（朝對面）
      for (const b of [armR, far]) {
        const acrossDir = b === armR ? [d[0], d[1]] : [r[0], r[1]]; // 站在對面的人看過來：號誌朝對面（−acrossDir？）
        const face2 = [-acrossDir[0] * (b === armR ? -1 : -1), -acrossDir[1] * (b === armR ? -1 : -1)];
        void face2;
        // 對面的角：從這根桿子橫過 b 那條路（b 往外的方向＝(b.ox, b.oz)；橫過去的方向＝垂直的那個）
        const ax = -b.oz, az = b.ox, toC = [(cx - px2), (cz - pz2)], sgn = ax * toC[0] + az * toC[1] > 0 ? 1 : -1, dir = [ax * sgn, az * sgn]; // 往對面走的方向
        const Pg = frame(px2 + dir[0] * 0.2, 2.9, pz2 + dir[1] * 0.2, Math.atan2(-(-dir[1]) * 0, 0) || 0);
        void Pg;
        const Ph = frame(px2 + dir[0] * 0.22, 2.75, pz2 + dir[1] * 0.22, Math.atan2(dir[0], dir[1])); // 本地 +z＝dir（朝對面）
        box('st', Ph, [-0.17, -0.3, -0.12, 0.17, 0.3, 0.1], dark);
        const pg = (Math.abs(b.ox) > 0.7) ? 'ns' : 'ew'; // 橫過東西向的路＝南北走
        lamps.push(lq(Ph.p(-0.13, 0.02, 0.105), Ph.p(0.13, 0.02, 0.105), Ph.p(0.13, 0.28, 0.105), Ph.p(-0.13, 0.28, 0.105), PU.pedR, 'pR', pg));
        lamps.push(lq(Ph.p(-0.13, -0.28, 0.105), Ph.p(0.13, -0.28, 0.105), Ph.p(0.13, -0.02, 0.105), Ph.p(-0.13, -0.02, 0.105), PU.pedG, 'pG', pg));
      }
      addCircle(px2, pz2, 0.22, 6.2);
      shade.stick(px2, pz2, 5.8, 0.3); shade.stick(tip[0], tip[2], 0, 0.1);
    }
    // 燈的網格
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(L.p, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(L.u, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(L.c, 3));
    geo.computeBoundingSphere();
    const lampMesh = new THREE.Mesh(geo, mats.lamp); lampMesh.name = 'st-lamps'; lampMesh.matrixAutoUpdate = false; Z.extra.push({ o: lampMesh });
    const ON = { R: [3.2, 0.25, 0.12], Y: [3.0, 1.6, 0.1], G: [0.1, 2.4, 1.2], pR: [3.0, 0.3, 0.2], pG: [0.2, 2.6, 0.9] }, OFF = { R: [0.16, 0.03, 0.03], Y: [0.16, 0.12, 0.03], G: [0.03, 0.12, 0.08], pR: [0.1, 0.03, 0.03], pG: [0.03, 0.09, 0.05] };
    const col = geo.attributes.color, uvA = geo.attributes.uv; let lastKey = '';
    const setQ = (q, c) => { for (let i = 0; i < 6; i++) col.setXYZ(q.i0 + i, c[0], c[1], c[2]); };
    const tick = (t) => {
      const o = phase(t), flashOn = (t % 1) < 0.5, key = `${o.ew}${Math.ceil(o.ewLeft)}${o.ns}${Math.ceil(o.nsLeft)}${o.walkEW === 'flash' || o.walkNS === 'flash' ? (flashOn ? 1 : 0) : ''}`;
      if (key === lastKey) return; lastKey = key;
      for (const q of lamps) {
        const st = q.group === 'ew' ? o.ew : o.ns, wk = q.group === 'ew' ? o.walkEW : o.walkNS;
        let on = false;
        if (q.kind === 'R') on = st === 'red'; else if (q.kind === 'Y') on = st === 'yellow'; else if (q.kind === 'G') on = st === 'green';
        else if (q.kind === 'pR') on = wk === 'stop'; else if (q.kind === 'pG') on = wk === 'walk' || (wk === 'flash' && flashOn);
        setQ(q, on ? ON[q.kind] : OFF[q.kind]);
      }
      for (const q of digits) {
        const st = q.group === 'ew' ? o.ew : o.ns, left = Math.min(99, Math.ceil(q.group === 'ew' ? o.ewLeft : o.nsLeft));
        const show = st !== 'yellow', dgt = q.pos === 'tens' ? Math.floor(left / 10) : left % 10, blank = !show || (q.pos === 'tens' && left < 10);
        setQ(q, blank ? [0.02, 0.02, 0.02] : st === 'red' ? [3.0, 0.2, 0.15] : [0.2, 2.6, 0.8]);
        const u0 = PU.digits[0] + (PU.digits[2] - PU.digits[0]) * (dgt * 24 + 2) / 240, u1 = PU.digits[0] + (PU.digits[2] - PU.digits[0]) * (dgt * 24 + 22) / 240, v0 = PU.digits[1], v1 = PU.digits[3];
        const U6 = [u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1]; for (let i = 0; i < 6; i++) uvA.setXY(q.i0 + i, U6[i * 2], U6[i * 2 + 1]);
      }
      col.needsUpdate = true; uvA.needsUpdate = true;
    };
    tick(clock()); Z.ticks.push(tick);
    Z.signals = [{ id: 'C', node: 'C', x: cx, z: cz, cycle: CYC, heads, phase, stopLines: heads.map((h) => ({ x: h.stop[0], z: h.stop[1], approach: h.approach, group: h.group })) }];
  }

  // ==================== 路名牌（藍底白字）：大路口、X、W ====================
  function plates() {
    B = SB;
    const plate = (x, z, y, alongX, k) => { // alongX：牌子跟 x 軸平行（名字是東西向的路）
      const T = frame(x, y, z, alongX ? 0 : Math.PI / 2), u = PU['plate' + k];
      box('st', T, [-0.75, 0, -0.025, 0.75, 0.5, 0.025], { pz: WHITE, nz: WHITE, _: C('#d0d3d8') }, { pz: u, nz: u, _: PW });
    };
    const post = (x, z) => { B.at(x, z); cyl('st', frame(x, 0, z), 0, 0, 0, 3.8, 0.06, 0.05, 6, C('#9aa0a6')); addCircle(x, z, 0.08, 3.8); shade.stick(x, z, 3.8, 0.12); };
    const C0 = nodes.C, X = nodes.X, Wn = nodes.W;
    // 第 9 批（路變大）：路名牌跟著路邊往外（村子的路寬 1.5 倍）
    if (C0) { B.at(C0[0] + 6.45, C0[1] - 8.05); const s = Z.signals && Z.signals[0]; const hp = s && s.heads[0]; void hp; plate(C0[0] + 6.45, C0[1] - 8.05, 3.3, true, 0); plate(C0[0] + 6.45, C0[1] - 8.05, 2.75, false, 1); }
    if (X) { const x = X[0] - 5.65, z = X[1] - 6.85; if (!hitsAny(x, z, 0.2)) { post(x, z); plate(x, z, 3.2, true, 0); plate(x, z, 2.65, false, 4); } }
    if (Wn) { const x = Wn[0] - 6.25, z = Wn[1] - 8.3; B.at(x, z); plate(x + 0.25, z, 3.3, true, 0); plate(x + 0.25, z, 2.75, false, 3); }
    const E1 = nodes.E1; if (E1) { const x = E1[0] - 5.1, z = E1[1] + 7.45; if (!hitsAny(x, z, 0.25)) { post(x, z); plate(x, z, 3.2, true, 0); plate(x, z, 2.65, false, 2); } }
  }

  // ==================== 路邊的東西：公車站、燈箱、檳榔攤、垃圾桶、郵筒 ====================
  function furniture() {
    // 公車站（大路南邊、農路口東邊）：站牌＋時刻表＋長椅
    { const x = -224, z = 7.5; B = SB; B.at(x, z); const T = frame(x, 0, z, 0);
      cyl('st', T, 0, 0, 0, 2.9, 0.05, 0.05, 6, C('#9aa0a6'));
      const Tb = frame(x, 2.55, z, 0); box('st', Tb, [-0.45, -0.45, -0.03, 0.45, 0.45, 0.03], { pz: WHITE, nz: WHITE, _: C('#1f7a4c') }, { pz: PU.bus, nz: PU.bus, _: PW });
      box('st', frame(x, 1.2, z + 0.06, 0), [-0.2, 0, 0, 0.2, 0.6, 0.04], { nz: WHITE, _: C('#c9ccd0') }, { nz: PU.busTable, _: PW });
      addCircle(x, z, 0.1, 2.9); shade.stick(x, z, 2.9, 0.12);
      B = PB; B.at(x, z); const Tc = frame(x - 2.2, 0, 7.97, 0); box('st', Tc, [-0.9, 0.4, -0.2, 0.9, 0.46, 0.2], C('#7a6a55')); box('st', Tc, [-0.9, 0.46, 0.14, 0.9, 0.85, 0.2], C('#7a6a55')); for (const lx of [-0.8, 0.8]) box('st', Tc, [lx - 0.03, 0, -0.18, lx + 0.03, 0.4, 0.18], C('#6b6f74')); addBox(x - 2.2, 7.97, 0.9, 0.22, 0, 0.9); }
    // 檳榔攤（霓虹框、玻璃櫃）：大路北邊、超商西邊的角落（改車廠那段）
    { const x = -188.5, z = -9.45, T = frame(x, 0, z, 0); if (!hitsAny(x, z, 1.4)) { B = SB; B.at(x, z);
      box('st', T, [-1.3, 0, -1.2, 1.3, 2.5, 0.9], { pz: WHITE, _: C('#e9e4dc') }, { pz: false, py: PW });
      B.e = 0.55; face('st', T, -1.3, 1.3, 0, 2.5, 0.91, PU.booth); B.e = 0;
      box('st', T, [-1.5, 2.5, -1.35, 1.5, 2.62, 1.6], C('#d9d9d4'), { ny: PW }); // 雨遮
      B.e = 0.8; box('st', T, [-0.28, 2.62, 1.2, 0.28, 3.55, 1.4], WHITE, { pz: PU.box2, nz: PU.box2, _: PW }); B.e = 0;
      addBox(x, z - 0.15, 1.3, 1.05, 0, 2.6); shade.box(x, z - 0.15, 1.3, 1.05, 0, 2.6); } }
    // 燈箱（店門口的直立燈箱）、垃圾桶
    B = PB; let bi = 0;
    for (const h of houses) {
      if (!(h.kind === 'shop' || (h.kind === 'shutter' && h.vsign == null && hxz(h.x, h.z, 110) < 0.5))) continue;
      if (hxz(h.x, h.z, 120) > 0.55) continue;
      const T = frame(h.x, 0, h.z, h.ry), lx = (hxz(h.x, h.z, 121) - 0.5) * (h.w - 1.4), p = T.p(lx, 0, 1.05);
      if (hitsAny(p[0], p[2], 0.35) || onRoad(p[0], p[2], 0.2)) continue;
      B.at(p[0], p[2]); const Tb = T.sub(lx, 0, 1.05, 0.25 + hxz(h.x, h.z, 122) * 0.3), u = PU['box' + (bi++ % BOXES.length)];
      B.e = 0.55; box('st', Tb, [-0.24, 0.12, -0.14, 0.24, 1.25, 0.14], { pz: WHITE, nz: WHITE, _: C('#e9ecef') }, { pz: u, nz: u, _: PW }); B.e = 0; box('st', Tb, [-0.28, 0, -0.18, 0.28, 0.12, 0.18], C('#2a2c30'));
      addCircle(p[0], p[2], 0.28, 1.3);
    }
    const bins = [[-233.5, 7.15, '#2f7a4c'], [-229.6, -7.25, '#2f6fb0'], [-296.3, 6.9, '#2f7a4c'], [-257.4, -6.9, '#2f6fb0'], [-187.3, -7.15, '#2f7a4c'], [-343.2, 7.65, '#2f6fb0']];
    for (const [x, z, c] of bins) { if (hitsAny(x, z, 0.3) || onRoad(x, z, 0.2)) continue; B.at(x, z); const T = frame(x, 0, z, 0); box('st', T, [-0.28, 0, -0.28, 0.28, 0.85, 0.28], C(c)); box('st', T, [-0.31, 0.85, -0.31, 0.31, 0.95, 0.31], mul(C(c), 0.8)); addCircle(x, z, 0.32, 0.95); }
  }

  // ==================== 機車（騎樓前斜斜停一排）：跟村子的機車一樣大小、多一點細節 ====================
  function scooters() {
    B = PB; let n = 0;
    // 兩個長方形接起來的筒子（前後大小不一樣：機車的車身、擋板）：a、b＝x0、x1 那頭的 [y0, y1, 半寬]；底下不畫
    const loft = (T, x0, x1, a, b, col) => {
      const P = T.p, q = (p1, p2, p3, p4) => B.quad('st', P(...p1), P(...p2), P(...p3), P(...p4), PW, col);
      q([x0, a[0], a[2]], [x1, b[0], b[2]], [x1, b[1], b[2]], [x0, a[1], a[2]]); q([x1, b[0], -b[2]], [x0, a[0], -a[2]], [x0, a[1], -a[2]], [x1, b[1], -b[2]]);
      q([x0, a[1], a[2]], [x1, b[1], b[2]], [x1, b[1], -b[2]], [x0, a[1], -a[2]]);
      q([x1, b[0], b[2]], [x1, b[0], -b[2]], [x1, b[1], -b[2]], [x1, b[1], b[2]]); q([x0, a[0], -a[2]], [x0, a[0], a[2]], [x0, a[1], a[2]], [x0, a[1], -a[2]]);
    };
    const scooter = (T, col, top) => { // 速克達：後面的車身往後收、座墊、踏板、前面的擋板（往前收）、龍頭、大燈、後照鏡
      const dk = C('#232427'), gr = C('#4a4d52');
      loft(T, -0.8, 0.04, [0.4, 0.6, 0.12], [0.26, 0.64, 0.19], col); loft(T, -0.68, 0.06, [0.6, 0.68, 0.11], [0.64, 0.76, 0.17], dk); // 車身、座墊
      box('st', T, [0.02, 0.2, -0.19, 0.44, 0.29, 0.19], gr); loft(T, 0.4, 0.62, [0.24, 0.92, 0.2], [0.3, 0.98, 0.13], col); // 踏板、擋板
      loft(T, 0.46, 0.7, [0.94, 1.06, 0.12], [0.9, 1.02, 0.07], col); box('st', T, [0.66, 0.9, -0.06, 0.71, 0.98, 0.06], C('#f4f1e6')); // 龍頭、大燈
      box('st', T, [0.52, 1.02, -0.34, 0.56, 1.05, 0.34], dk); box('st', T, [-0.82, 0.48, -0.07, -0.79, 0.56, 0.07], C('#c62f25')); // 把手、尾燈
      for (const s of [1, -1]) { box('st', T, [0.53, 1.05, s * 0.28 - 0.01, 0.55, 1.2, s * 0.28 + 0.01], dk); box('st', T, [0.52, 1.2, s * 0.28 - 0.06, 0.56, 1.26, s * 0.28 + 0.06], dk); }
      if (top) box('st', T, [-0.78, 0.74, -0.16, -0.42, 0.98, 0.16], top);
      wheel('st', T, -0.55, 0.2, 0, 0.2, 0.055, dk); wheel('st', T, 0.62, 0.2, 0, 0.19, 0.05, dk);
    };
    for (const h of houses) {
      const q = (k) => hxz(h.x, h.z, k); if (q(200) > 0.62) continue;
      const T = frame(h.x, 0, h.z, h.ry), sgn = q(201) < 0.5 ? 1 : -1, dry = sgn > 0 ? -Math.PI / 6 : (-5 * Math.PI) / 6;
      const slots = []; for (let x = -h.w / 2 + 0.75; x <= h.w / 2 - 0.75; x += 1.3) slots.push(x);
      let placed = 0; const want = 1 + ((q(202) * 5) | 0);
      for (const lx of slots) {
        if (placed >= want) break;
        const clear = h.kind === 'shop' ? 1.3 : 1.0; if (Math.abs(lx - h.door) < clear) continue;
        const Ts = T.sub(lx, 0, 0.8, dry), c = Ts.p(0, 0, 0), a = Ts.p(0.8, 0, 0), b = Ts.p(-0.8, 0, 0);
        if (hitsAny(c[0], c[2], 0.35) || hitsAny(a[0], a[2], 0.15) || hitsAny(b[0], b[2], 0.15) || onRoad(a[0], a[2], 0.1) || onRoad(c[0], c[2], 0.1)) continue;
        B.at(c[0], c[2]); scooter(Ts, pick(R, SCOOT), R() < 0.3 ? pick(R, [C('#e9e9e6'), C('#1d1f23'), C('#c62f25')]) : null);
        addBox(c[0], c[2], 0.82, 0.3, Ts.ry, 1.1); shade.blob(c[0], c[2], 0.9, 0.18); placed++; n++;
      }
    }
    // 警察局、槍店門口也停幾台
    for (const [x, z, ry] of [[-158.2, 8.1, 0.5], [-158.1, 9.3, 0.5], [-340.6, 9.2, Math.PI / 2 + 0.3]]) { if (hitsAny(x, z, 0.4)) continue; const Ts = frame(x, 0, z, ry); B.at(x, z); scooter(Ts, pick(R, SCOOT), null); addBox(x, z, 0.82, 0.3, ry, 1.1); n++; }
    Z.instances = n;
  }

  // ==================== 雜草（牆腳、電線桿腳、田邊）、香蕉樹 ====================
  function weeds() {
    B = PB; const r = rng(777);
    const tuft = (x, z, s) => { if (onRoad(x, z, 0.3)) return; B.at(x, z); const a = r() * Math.PI; for (const k of [0, 1]) { const ang = a + k * Math.PI / 2, dx = Math.cos(ang) * s * 0.5, dz = Math.sin(ang) * s * 0.5; B.quad('st', [x - dx, 0, z - dz], [x + dx, 0, z + dz], [x + dx, s * 0.55, z + dz], [x - dx, s * 0.55, z - dz], PU.grass, [0.9 + r() * 0.2, 0.9 + r() * 0.2, 0.85]); B.quad('st', [x + dx, 0, z + dz], [x - dx, 0, z - dz], [x - dx, s * 0.55, z - dz], [x + dx, s * 0.55, z + dz], PU.grass, [0.85, 0.85, 0.8]); } };
    for (const h of houses) { // 房子後面、露出來的側牆腳
      const T = frame(h.x, 0, h.z, h.ry);
      for (let x = -h.w / 2 + 0.3; x < h.w / 2; x += 0.9 + r() * 1.5) { const p = T.p(x, 0, -h.D - 0.25 - r() * 0.3); if (!hitsAny(p[0], p[2], 0.05)) tuft(p[0], p[2], 0.5 + r() * 0.5); }
    }
    for (const pl of poles) for (let i = 0; i < 3; i++) { const a = r() * TAU, d = 0.35 + r() * 0.25; tuft(pl.x + Math.cos(a) * d, pl.z + Math.sin(a) * d, 0.4 + r() * 0.4); }
    for (const s of segs) { // 田中間的路：路邊一路都是草
      if (s.r.kind !== 'farm' && !(s.r.kind === 'main' && (s.ax > -150 || s.ax < -400))) continue;
      const rx = -s.dz, rz = s.dx;
      for (let t = 0; t < s.L; t += 2.2 + r() * 2.8) for (const sd of [1, -1]) { const d = s.hw + 0.35 + r() * 0.5, x = s.ax + s.dx * t + rx * d * sd, z = s.az + s.dz * t + rz * d * sd; if (!hitsAny(x, z, 0.1)) tuft(x, z, 0.45 + r() * 0.5); }
    }
    // 香蕉樹：房子後面、院子
    const banana = (x, z) => {
      if (hitsAny(x, z, 1.0) || onRoad(x, z, 1.5)) return; B.at(x, z);
      const hh = 2.4 + r() * 1.2; tube('st', [x, 0, z], [x + (r() - 0.5) * 0.3, hh, z + (r() - 0.5) * 0.3], 0.14, 0.1, 5, C('#7d8f4a'));
      const n = 6 + ((r() * 3) | 0);
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU + r() * 0.5, L = 1.4 + r() * 0.6, up = 0.4 + r() * 0.5, cx = Math.cos(a), cz = Math.sin(a), b = [x + cx * 0.1, hh, z + cz * 0.1], tip = [x + cx * L, hh + up - 0.3, z + cz * L], wv = 0.38, rx = -cz * wv, rz = cx * wv;
        B.quad('st', [b[0] - rx * 0.3, b[1], b[2] - rz * 0.3], [b[0] + rx * 0.3, b[1], b[2] + rz * 0.3], [tip[0] + rx, tip[1], tip[2] + rz], [tip[0] - rx, tip[1], tip[2] - rz], PU.leaf, WHITE);
        B.quad('st', [b[0] + rx * 0.3, b[1], b[2] + rz * 0.3], [b[0] - rx * 0.3, b[1], b[2] - rz * 0.3], [tip[0] - rx, tip[1], tip[2] - rz], [tip[0] + rx, tip[1], tip[2] + rz], PU.leaf, [0.8, 0.85, 0.75]); }
      addCircle(x, z, 0.2, hh); shade.blob(x + SHOFF[0] * hh, z + SHOFF[1] * hh, 1.6, 0.3);
    };
    for (const h of houses) if (hxz(h.x, h.z, 300) < 0.12) { const T = frame(h.x, 0, h.z, h.ry), p = T.p((hxz(h.x, h.z, 301) - 0.5) * h.w, 0, -h.D - 2.2); for (let i = 0; i < 1 + ((hxz(h.x, h.z, 302) * 3) | 0); i++) banana(p[0] + (r() - 0.5) * 2.5, p[2] + (r() - 0.5) * 2.5); }
    for (const [x, z] of [[-322, -30], [-318, -39], [-283, -38], [-386.5, 27], [-352.5, 29.5], [-150, 22], [-172.5, 24]]) banana(x, z);
  }

  // ==================== 電線：電線桿到每一家（接戶線）、電線桿之間多幾條電信線、過馬路的線 ====================
  function wiresStep() {
    const sag = (a, b, k) => { let p0 = a; const L = Math.hypot(b[0] - a[0], b[2] - a[2]), s = k + L * 0.018; for (let i = 1; i <= 8; i++) { const t = i / 8, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - s * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]; wirePush(p0, p); p0 = p; } };
    // 電信線：同一排（相鄰、朝同一個方向）的電線桿之間多兩條，低一點、垂多一點
    for (let i = 1; i < poles.length; i++) {
      const a = poles[i - 1], b = poles[i], L = Math.hypot(b.x - a.x, b.z - a.z); if (L > 36 || a.fx !== b.fx || a.fz !== b.fz) continue;
      for (const [y, k] of [[7.9, 0.5], [7.55, 0.7], [7.2, 0.9]]) sag([a.x, y, a.z], [b.x, y, b.z], k);
    }
    for (const pl of poles) for (const y of [7.9, 7.55, 7.2]) { // 電信線的夾具
      B = PB; B.at(pl.x, pl.z); box('st', frame(pl.x, y, pl.z, Math.atan2(pl.fx, pl.fz)), [-0.12, -0.05, -0.2, 0.12, 0.05, 0.02], C('#5f6166'));
    }
    // 接戶線：每一棟（兩層以上）找最近的電線桿（22 公尺內）
    for (const h of houses) {
      let best = null; for (const pl of poles) { const d = Math.hypot(pl.x - h.x, pl.z - h.z); if (d < 22 && (!best || d < best.d)) best = { d, pl }; }
      if (!best) continue; const T = frame(h.x, 0, h.z, h.ry), pl = best.pl, yy = Math.min(h.H - 0.5, 6.4), ex = (hxz(h.x, h.z, 400) < 0.5 ? 1 : -1) * (h.w / 2 - 0.35);
      const a = T.p(ex, yy, 0.06), a2 = T.p(ex, yy - 0.35, 0.06);
      sag([pl.x, 9.2, pl.z], a, 0.25); sag([pl.x, 7.55, pl.z], a2, 0.3);
      B = PB; B.at(h.x, h.z); box('st', T, [ex - 0.06, yy - 0.45, 0, ex + 0.06, yy + 0.08, 0.12], C('#3a3d42')); // 牆上的夾具
    }
    // 過馬路的線（路口兩邊的電線桿）
    for (const [k, p] of Object.entries(nodes)) {
      if ((deg[k] || 0) < 3) continue;
      const near = poles.filter((pl) => Math.hypot(pl.x - p[0], pl.z - p[1]) < 24);
      for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) { const a = near[i], b = near[j]; const L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 8 || L > 30 || (a.fx === b.fx && a.fz === b.fz)) continue; sag([a.x, 8.2, a.z], [b.x, 8.0, b.z], 0.6); sag([a.x, 7.4, a.z], [b.x, 7.6, b.z], 0.8); }
    }
  }

  // ==================== 影子（房子、樹、電線桿）→ 一張貼圖 ====================
  function shadows() {
    for (const b of buildings) { const h = (b.h || 5) + (b.kind === 'house' || b.kind === 'shop' ? 0.95 : 0); shade.box(b.x, b.z, b.hx, b.hz, b.rot || 0, h); }
    for (const b of buildings) shade.rim(b.x, b.z, b.hx, b.hz, b.rot || 0, 0.32);
    for (const c of W.colliders || []) {
      if (c.t !== 'circle') { if (c.h > 0.7 && c.h < 3.2 && c.hx < 5 && c.hz < 5) shade.box(c.x, c.z, c.hx, c.hz, c.rot || 0, c.h); continue; } // 矮牆、車、攤子
      const ratio = c.h / c.r;
      if (c.r >= 0.26 && c.r <= 0.7 && ratio > 12 && ratio < 17) { const s = c.r / 0.35, hc = 3.3 * s; shade.blob(c.x + SHOFF[0] * hc, c.z + SHOFF[1] * hc, 2.4 * s, 0.55); shade.stick(c.x, c.z, 2 * s, 0.35 * s); } // 樹
      else if (Math.abs(c.r - 0.25) < 0.01 && c.h > 5.5 && c.h < 12) { shade.blob(c.x + SHOFF[0] * c.h, c.z + SHOFF[1] * c.h, 2.2, 0.4); shade.stick(c.x, c.z, c.h, 0.22); } // 檳榔樹
      else if (c.r > 1.3 && c.r < 1.5 && c.h > 8) shade.blob(c.x + SHOFF[0] * 6, c.z + SHOFF[1] * 6, 3.2, 0.45); // 竹叢
      else if (Math.abs(c.r - 1.1) < 0.01 && c.h >= 10) shade.blob(c.x + SHOFF[0] * 7, c.z + SHOFF[1] * 7, 6.5, 0.6); // 大榕樹
      else if (Math.abs(c.r - 0.24) < 0.01 && c.h > 10) shade.stick(c.x, c.z, 10, 0.3); // 電線桿
      else if (c.h > 2) shade.stick(c.x, c.z, c.h, 0.14);
    }
    // 合起來：白底，影子（藍灰）稍微糊一點
    sg.save(); if ('filter' in sg) sg.filter = 'blur(1px)'; sg.globalAlpha = 1; sg.drawImage(mc, 0, 0); sg.restore();
    // 你家車庫（走得進去、地板就在 y 0、裡面有自己的燈）裡面不蓋影子：這層影子在 y 0.058 乘上去，會把白色大理石地板、升降機的坑染成藍灰。
    //   往外投出去的影子、牆腳那圈留著（只把車庫的外框塗回白色）
    for (const b of buildings) if (b.kind === 'garage') {
      const c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0); sg.fillStyle = '#ffffff'; sg.beginPath();
      [[-b.hx, -b.hz], [b.hx, -b.hz], [b.hx, b.hz], [-b.hx, b.hz]].forEach(([a, d], i) => { const wx = b.x + a * c + d * s, wz = b.z - a * s + d * c; i ? sg.lineTo(px(wx), pz(wz)) : sg.moveTo(px(wx), pz(wz)); });
      sg.closePath(); sg.fill();
    }
  }

  // ---- 組起來 ----
  const group = new THREE.Group(); group.name = 'street';
  const ORDER = { dec: 2 };
  const statics = SB.build(mats, 'st-', ORDER), props = PB.build(mats, 'stp-', ORDER);
  for (const m of statics) group.add(m);
  const cells = []; // 遠了就藏起來的：小東西（120 公尺一格）
  for (const m of props) { group.add(m); cells.push({ o: m, ...m.userData.cell }); }
  for (const x of Z.extra) { group.add(x.o); if (x.cell) cells.push({ o: x.o, ...x.cell }); }
  // 電線：一個 LineSegments；離鏡頭 90 公尺以外慢慢變淡、200 公尺以外看不到（1 像素的線在遠的地方看起來太粗，材質裡面做）
  const wireSegs = wires.length / 6;
  { const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3)); wg.computeBoundingSphere();
    const wl = new THREE.LineSegments(wg, mats.wire); wl.name = 'st-wires'; wl.matrixAutoUpdate = false; wl.renderOrder = 3; group.add(wl); }
  // 地上的影子：切成 50 公尺的格子（太大的三角形在手機上深度不準），乘上去（不受霧、色調映射影響）
  const shTex = new THREE.CanvasTexture(sc); shTex.colorSpace = THREE.SRGBColorSpace; shTex.anisotropy = aniso;
  const shMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  { const P = [], UV = [], y = 0.058, n = 10, m = 5;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const x0 = SHR.x0 + (SHR.w * i) / n, x1 = SHR.x0 + (SHR.w * (i + 1)) / n, z0 = SHR.z0 + (SHR.h * j) / m, z1 = SHR.z0 + (SHR.h * (j + 1)) / m, u = (x) => (x - SHR.x0) / SHR.w, v = (z) => 1 - (z - SHR.z0) / SHR.h;
      for (const [x, z] of [[x0, z1], [x1, z1], [x1, z0], [x0, z1], [x1, z0], [x0, z0]]) { P.push(x, y, z); UV.push(u(x), v(z)); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.computeBoundingSphere();
    var shMesh = new THREE.Mesh(g, shMat); shMesh.name = 'st-shadow'; shMesh.renderOrder = 2.5; shMesh.matrixAutoUpdate = false; group.add(shMesh); }
  // 天空：跟著鏡頭的大圓球（最先畫、不寫深度）；順便：遠的小東西藏起來、紅綠燈換燈
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mats.sky);
  sky.name = 'sky'; sky.frustumCulled = false; sky.renderOrder = -1000; sky.matrixAutoUpdate = false;
  const HIDE = opts.propFar ?? 150;
  sky.onBeforeRender = (renderer, scene, cam) => {
    const e = cam.matrixWorld.elements, cx = e[12], cy = e[13], cz = e[14];
    sky.matrixWorld.makeTranslation(cx, cy * 0.02, cz); // 高度幾乎不跟（從高空看地平線還在差不多的地方）
    for (const c of cells) { const dx = Math.max(c.x0 - cx, 0, cx - c.x1), dz = Math.max(c.z0 - cz, 0, cz - c.z1); c.o.visible = dx * dx + dz * dz < HIDE * HIDE && cy < 400; }
    const t = clock(); for (const f of Z.ticks) f(t);
  };
  group.add(sky);
  group.updateMatrixWorld(true);
  sky.matrixWorld.identity();
  let tris = 0, meshes = 0; group.traverse((o) => { if ((o.isMesh || o.isLineSegments) && o !== sky) { meshes++; if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  const texs = [...Object.values(tex), shTex];
  return {
    group, colliders, pave, sky,
    sidewalks: Z.sidewalks || [], crossings: Z.crossings || [], signals: Z.signals || [], clock, gunshop: Z.gunshop || null,
    info: { meshes: meshes + 1, tris: Math.round(tris), staticTris: SB.tris, propTris: PB.tris, scooters: Z.instances || 0, statics: statics.length, propCells: props.length, wireSegs, stepTris },
    dispose() { group.removeFromParent(); group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); for (const m of Object.values(mats)) m.dispose(); shMat.dispose(); for (const t of texs) t.dispose(); },
  };
}
const clock = () => performance.now() / 1000;

return { buildStreet, STREET_TEXT };
})();
