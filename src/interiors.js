// ---- 走進房子（第 2 批）：村子裡每一棟都走得進去：透天厝（每一層）、一樓的店、超商、福德宮、三合院 ----
// Nick 2026-09-28：「那些房子都要可以走進去然後人要可以下車走來走去」
// 村子的房子是一格一格併起來的網格（外殼藏不掉）：裡面是另外一個空間。人走進門口 → 淡出淡入 → 換成這棟的裡面；走出裡面的門口 → 回到外面門口
// 全部用程式做（貼圖都是 canvas 畫的，沒有下載任何東西）；窗戶外面是亮亮的白天（街景、綠樹、屋頂、廟埕、稻田），不是黑的
//
// 【API】
//   await interiorFonts();               canvas 上的中文字（日曆、菜單、匾額⋯）等字型（最多 1.5 秒；村子已經 villageFonts() 過也要，字不一樣）
//   interiorFor(b) → 便宜的說明（不蓋網格）或 null（這棟不用走進去，見下面）：
//       { kind: 'house' | 'store' | 'temple' | 'farmhouse', biz（一樓做什麼：null 住家 | grocery | noodle | scooter | barber | ice | breakfast | pharmacy | betel
//              | buffet 自助餐 | tea 飲料店 | hardware 五金／水電／冷氣 | laundry 洗衣 | optical 眼鏡 | pawn 當舖 | clinic 診所 | school 補習班）：看 b.name／b.sign 裡的字（村子的招牌、第 3 批 street.js 掛的招牌）,
//         name（中文，例如「阿嬤雜貨店」「透天厝（三樓）」）, floors, size: { w, d }, rooms: [['客廳', '餐廳', '廚房'], ['主臥室', '走道', '書房'], ...]（每層：前面、中間、後面）,
//         enter: { x, z, hx, hz, rot }（外面門口前的長方形（世界座標）：人走進這裡就換到裡面）, outside: { x, z, heading }（走出來站的地方：門外、面朝外） }
//     b＝village.js 的 V.buildings[i]；null：你的車庫（room.js 已經是真的車庫）、阿財車行（玻璃展示間本來就在村子裡）、阿輝改車廠（開得進去的改車區本來就在）、
//       警察局（police.js 的 buildPoliceInterior）、槍店（gunshop.js）⋯ 其他 kind 都是 null
//   const I = buildInterior(b, { renderer, quality = 'high' })   → 蓋好一棟的裡面（同一棟每次都一樣：亂數種子＝房子的位置）；不用走進去的房子回 null
//     renderer：拿來做反射用的環境貼圖（PMREM，全部房子共用一張，第一次蓋的時候做）；沒給也可以（沒有反射）。蓋的時候不問 GL（貼圖 anisotropy 8，three.js 上傳時自己取上限）
//     quality：'high'｜'low'（慢的手機：地板、亮面家具不算鏡面反射，全部用 Lambert）
//     buildInterior(null, { renderer, quality })：只先做共用的（四張 canvas 貼圖、PMREM、材質），回 null：載入畫面叫一次，第一次走進門就不會頓
//   I.group：THREE.Group，已經擺在這棟房子的世界位置（position＝(b.x, 0, b.z)、rotation.y＝b.rot）：
//       放進自己的 THREE.Scene（建議；燈都在 group 裡面）；人、鏡頭照樣用世界座標（x 東、y 上、z 南），走進門口座標是接起來的
//       每一層樓都是自己的平面空間，地板都在 y = 0（上樓不用改人的高度）：一次只顯示一層（setFloor）
//       本地座標（網格用的）：原點＝房子中心的地面、+z＝正面（大門那邊）、本地 +x → 世界 (cos rot, 0, −sin rot)（跟 village.js 的 house()、碰撞的 hx 同一個方向）
//   I.floors：[{ index, label（'1F'…）, group, colliders, exits, spots, rooms, camera, bounds }]：每一層
//   I.floor（現在第幾層，0＝一樓）；I.setFloor(i) → 那一層（只顯示那一層：燈、網格都在那一層的 group 裡）
//   I.spawn：{ x, z, heading }：從外面走進來站的地方（門裡面 1 公尺、面朝裡面；在一樓）
//   I.colliders / I.exits / I.spots / I.rooms / I.camera / I.bounds：現在這一層的（＝I.floors[I.floor].xxx）
//     colliders：[{ t: 'box', x, z, hx, hz, rot, h } | { t: 'circle', x, z, r, h }]（世界座標，跟 village.js 一樣；牆 h ≥ 2.4（擋鏡頭），家具 h 是真的高度）
//     exits：[{ x, z, hx, hz, rot, to: 'outside' | 樓層, spawn: { x, z, heading } }]：人的中心走進這個長方形就換（淡出淡入）：
//       to 'outside'：回村子，人站到 spawn（門外、面朝外；＝interiorFor(b).outside）；to 數字：I.setFloor(to)，人站到 spawn（那一層的樓梯口，面朝離開樓梯的方向）
//       spawn 都在任何 exit 外面（不會一出現又被傳走）；建議換完 0.4 秒內不要再判斷
//       door：{ x, z, ry, w }：同一個出口寫成 walk.js setDoors 的門（ry 朝房間裡面：往 −(sin ry, cos ry) 走＝出去／上下樓；w＝半寬）
//     樓梯：每一層是自己的空間，樓梯口是 exit（不是真的一階一階走上去）：透天厝是兩跑樓梯（樓梯間 2 × 3.2 公尺，靠一邊的牆），
//       一樓只有「上樓」、頂樓只有「下樓」、中間的樓層兩個口並排（左上右下或相反）；看得到往上的樓梯、往下的樓梯、轉角平台、扶手
//     spots：{ stand: [], sit: [], sleep: [], pray: [], counter: [] }：放居民用（世界座標）：{ x, z, heading, y?, room }
//       stand 站著（heading＝面朝哪裡）；sit 坐（y＝椅面的高度：沙發 0.5、板凳 0.46、理髮椅 0.58；charstub 的 'sit' 屁股在腳底上面 0.45 → group.y＝y − 0.45；heading＝面朝前）；
//       sleep 躺（x, z＝床中間、y＝床墊上面、heading＝腳 → 頭的方向）；
//       pray 拜拜（站在神明桌／供桌前面，面朝神明）；counter 櫃台後面的店員（面朝客人）
//     rooms：[{ name, x, z, hx, hz, rot, probe: { x, z } }]（probe＝這間一定走得到的一點：測試用）
//     camera：{ maxDist（第三人稱鏡頭離人最遠幾公尺，房間放得下）, ceiling（鏡頭最高 y）, near }
//     bounds：{ x, z, hx, hz, rot }（這一層的外框，世界座標）
//   I.info：{ kind, biz, name, floors, tris, draws（每一層 draw call 數，最多那層）, ms（蓋了幾毫秒）, shared?: { atlas, env }（這一次順便做了共用的貼圖／PMREM 才有：各幾毫秒）}
//   I.background：建議的 scene.background（淡淡的天空色：萬一從很斜的角度看出窗外邊邊也是亮的）
//   I.dispose()：丟掉這棟的網格（共用的貼圖、材質留著，下一棟再用）；disposeInteriorCache()：共用的也丟掉（離開村子的時候）
// 效能：每一層同材質併成一個網格（牆、地板、家具、亮面、金屬、鏤空、發光、窗景、影子：最多 9 個 draw call）；四張 512² 的 canvas 貼圖（全部共用）＋一張 64² 的影子；
//   燈：每一層一樣的組合（半球光＋平行光＋兩個點光源，沒有陰影）：換房子、換樓層不會重新編譯 shader；牆角、牆腳的陰影算在頂點色裡；家具底下一片軟影子
// 打包（build-art.mjs）：拿掉 import、export 變一般宣告：這個檔全部包在一個函式裡，只露出 buildInterior、interiorFor、interiorFonts、disposeInteriorCache
import * as THREE from 'three';

export const { buildInterior, interiorFor, interiorFonts, disposeInteriorCache } = (() => {
const TAU = Math.PI * 2, HP = Math.PI / 2, FH = 3.3, CH = 3.0; // 透天厝一層樓高（跟 village.js 一樣）、天花板高
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", "WenQuanYi Zen Hei", sans-serif';
const COND = '"Barlow Condensed", "Arial Narrow", sans-serif';
// 貼圖上所有的中文字（interiorFonts 先把這些字的字型載好）
const TEXT = '一二三四五六七八九十百元日月年星期農曆宜祭祀出行福春德正神千家敬則為萬古尊流芳祖歷代先之位菜單紅燒清燉牛肉麵湯陽春餛飩燙青滷味小早餐蛋餅蘿蔔糕鐵板火腿吐司鮪魚奶茶豆漿剉冰芒果豆八寶雪花粉圓咖啡熱狗關東煮第件折新品上市涼夏霜淇淋買送杯半價食提款機時藥局健保特約成保養量血壓理髮剪洗刮鬍輪胎起換油檳榔菁仔包葉香錢靈籤光明燈浴室員工專用洗手間歡迎臨週末大放送今聞天氣晴雜貨店機車行阿嬤國好吃超商村口營業中請勿吸菸謝惠顧冷飲料零嘴開會議通知衛生紙米醬而有染檸檬愛玉宮廳房灶腳';

// ---- 小工具 ----
function rng(seed) { // 固定種子的亂數（跟 village.js 一樣）：同一棟每次蓋出來都一樣
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash2 = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul((b | 0) + 7, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const CC = new Map();
const C = (hex) => { let v = CC.get(hex); if (!v) { const c = new THREE.Color(hex); v = [c.r, c.g, c.b]; CC.set(hex, v); } return v; }; // 線性顏色 [r, g, b]
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const pick = (r, list) => list[(r() * list.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const WHITE = [1, 1, 1];
// 本地座標框：原點 (x, y, z)、繞 y 轉 ry（跟 three.js 的 rotation.y 一樣：本地 +x → (cos, 0, −sin)、本地 +z → (sin, 0, cos)）
function frame(x, y, z, ry = 0) {
  const c = Math.cos(ry), n = Math.sin(ry);
  const f = { x, y, z, ry, p: (lx, ly, lz) => [x + lx * c + lz * n, y + ly, z - lx * n + lz * c] };
  f.sub = (lx, ly, lz, dry = 0) => { const q = f.p(lx, ly, lz); return frame(q[0], q[1], q[2], ry + dry); };
  return f;
}
const F0 = frame(0, 0, 0);

// 中文字型：等 Noto Sans TC 載好這些字（最多 ms 毫秒；沒有就用系統的字）
function interiorFonts(ms = 1500) {
  const f = typeof document !== 'undefined' && document.fonts;
  if (!f || !f.load) return Promise.resolve();
  const all = Promise.all([f.load(`700 40px ${SANS}`, TEXT), f.load(`700 40px ${COND}`, '0123456789 NT$ ATM 24H')]).catch(() => {});
  return Promise.race([all, new Promise((r) => setTimeout(r, ms))]);
}

// ---- canvas 貼圖（全部房子共用，第一次蓋的時候畫；四張 512²）----
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function speck(g, R, x, y, w, h, n, style, s = 2) { for (let i = 0; i < n; i++) { g.fillStyle = typeof style === 'function' ? style() : style; g.fillRect(x + R() * w, y + R() * h, 0.6 + R() * s, 0.6 + R() * s); } }
function fitFont(g, text, maxW, px, weight = 700, fam = SANS) { let s = px; for (; s > 7; s -= 1) { g.font = `${weight} ${s}px ${fam}`; if (g.measureText(text).width <= maxW) break; } return s; }
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function txt(g, t, x, y, px, col, align = 'center', maxW = 0, weight = 700, fam = SANS) { // 一行字（maxW：太長就縮小）
  g.fillStyle = col; g.textAlign = align; g.textBaseline = 'middle';
  if (maxW) fitFont(g, t, maxW, px, weight, fam); else g.font = `${weight} ${px}px ${fam}`;
  g.fillText(t, x, y);
}
function vtxt(g, t, cx, y0, step, px, col, fam = SANS) { g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${px}px ${fam}`; [...t].forEach((ch, k) => g.fillText(ch, cx, y0 + k * step)); } // 直的字
function lg(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const [t, c] of stops) gr.addColorStop(t, c); return gr; }
// 一張貼圖集：reg（一般的區塊，uv 往內縮半個像素）、tile（可以接起來的：暫存 canvas 畫一次，貼 3×3 份，四邊留 p 像素：mipmap 不會混到旁邊）
// uv＝[u0, v0, u1, v1]（canvas 上面＝v 大）
function sheet(W, H) {
  const [c, g] = cv(W, H), uv = {};
  const reg = (name, x, y, w, h, draw) => {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); draw(g, w, h); g.restore();
    return (uv[name] = [(x + 0.5) / W, 1 - (y + h - 0.5) / H, (x + w - 0.5) / W, 1 - (y + 0.5) / H]);
  };
  const tile = (name, x, y, w, h, draw, p = 4) => {
    const [t, tg] = cv(w, h); draw(tg, w, h);
    g.save(); g.beginPath(); g.rect(x - p, y - p, w + 2 * p, h + 2 * p); g.clip();
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) g.drawImage(t, x + i * w, y + j * h);
    g.restore();
    return (uv[name] = [x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H]);
  };
  return { c, g, uv, reg, tile };
}
const dotUV = (r) => { const u = (r[0] + r[2]) / 2, v = (r[1] + r[3]) / 2; return [u, v, u, v]; }; // 單色的面：整面取區塊中間一點
const subUV = (r, a, b, c, d) => [r[0] + (r[2] - r[0]) * a, r[1] + (r[3] - r[1]) * b, r[0] + (r[2] - r[0]) * c, r[1] + (r[3] - r[1]) * d];

// 地板、牆、天花板：可以接起來的，120 像素一格（四邊各留 4 像素），4 × 4 格；PER＝一格是幾公尺（[u, v]）
const PER = { terrazzo: [1, 1], tileW: [1.2, 1.2], tileB: [1.2, 1.2], wood: [1.2, 1.2], ktile: [0.6, 0.6], plaster: [1.6, 1.6], ceil: [1.2, 1.2], granite: [1.6, 1.6],
  rbrick: [1.4, 1.4], wbrick: [1, 1], slats: [0.6, 0.6], timber: [1.2, 1.2], tatami: [1.8, 1.8], storeT: [1.2, 1.2], mosaic: [0.6, 0.6], white: [1, 1] };
function surfAtlas(R) {
  const S = sheet(512, 512), T = (name, i, draw) => S.tile(name, (i % 4) * 128 + 4, ((i / 4) | 0) * 128 + 4, 120, 120, draw);
  const grid = (g, w, h, n, col, lw = 1.2) => { g.fillStyle = col; for (let k = 0; k < n; k++) { g.fillRect((k * w) / n, 0, lw, h); g.fillRect(0, (k * h) / n, w, lw); } };
  T('terrazzo', 0, (g, w, h) => { // 磨石子（1 公尺一格，邊上銅條）
    g.fillStyle = '#d9d5cc'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.1)'; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(R() * w, R() * h, 5 + R() * 12, 0, TAU); g.fill(); }
    const cs = ['#8d8a84', '#5d5b57', '#f6f4ee', '#b9a58a', '#98a39a', '#c9b7a3', '#3f3d3a', '#a8a39a'];
    for (let i = 0; i < 1500; i++) { g.fillStyle = pick(R, cs); const s = 0.7 + R() * 2; g.fillRect(R() * w, R() * h, s, s * (0.6 + R() * 0.8)); }
    g.fillStyle = '#b3935a'; g.fillRect(0, 0, w, 1.3); g.fillRect(0, 0, 1.3, h);
  });
  T('tileW', 1, (g, w, h) => { // 白色拋光石英磚 60 公分（淡淡的紋）
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const k = (236 + R() * 9) | 0; g.fillStyle = `rgb(${k},${k - 1},${k - 5})`; g.fillRect(i * 60, j * 60, 60, 60);
      g.strokeStyle = 'rgba(140,135,128,0.13)'; g.lineWidth = 0.9;
      for (let v = 0; v < 3; v++) { g.beginPath(); g.moveTo(i * 60 + R() * 60, j * 60); g.bezierCurveTo(i * 60 + R() * 60, j * 60 + 20, i * 60 + R() * 60, j * 60 + 40, i * 60 + R() * 60, j * 60 + 60); g.stroke(); }
    }
    grid(g, w, h, 2, '#c4bfb6', 1);
  });
  T('tileB', 2, (g, w, h) => { // 米色老磁磚 30 公分（中間一個小菱形）
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * 30, y = j * 30, k = R() * 14; g.fillStyle = `rgb(${(228 - k) | 0},${(210 - k) | 0},${(180 - k) | 0})`; g.fillRect(x, y, 30, 30);
      g.fillStyle = 'rgba(150,100,60,0.2)'; g.beginPath(); g.moveTo(x + 15, y + 8); g.lineTo(x + 22, y + 15); g.lineTo(x + 15, y + 22); g.lineTo(x + 8, y + 15); g.fill();
    }
    speck(g, R, 0, 0, w, h, 300, 'rgba(90,60,30,0.08)', 1.5); grid(g, w, h, 4, '#a89878');
  });
  T('wood', 3, (g, w, h) => { // 木紋地板（一片 20 公分寬）
    for (let j = 0; j < 6; j++) {
      const y = j * 20; let x = -R() * 60;
      while (x < w) {
        const L = 50 + R() * 50, k = R() * 30; g.fillStyle = `rgb(${(178 - k) | 0},${(130 - k * 0.8) | 0},${(86 - k * 0.6) | 0})`; g.fillRect(x, y, L, 20);
        g.strokeStyle = 'rgba(90,55,25,0.22)'; g.lineWidth = 0.8;
        for (let t = 0; t < 4; t++) { const yy = y + 3 + R() * 14; g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + L * 0.3, yy + (R() - 0.5) * 4, x + L * 0.7, yy + (R() - 0.5) * 4, x + L, yy); g.stroke(); }
        g.fillStyle = 'rgba(40,25,10,0.45)'; g.fillRect(x, y, 1, 20); x += L;
      }
      g.fillStyle = 'rgba(40,25,10,0.4)'; g.fillRect(0, y, w, 1);
    }
  });
  T('ktile', 4, (g, w, h) => { // 廚房、浴室的白色壁磚 15 公分
    g.fillStyle = '#f4f4f1'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = `rgba(0,0,0,${(R() * 0.035).toFixed(3)})`; g.fillRect(i * 30, j * 30, 30, 30); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(i * 30 + 3, j * 30 + 3, 9, 2); }
    grid(g, w, h, 4, '#c6c7c2', 1.4);
  });
  T('plaster', 5, (g, w, h) => { // 油漆牆（白底，頂點色上色）
    g.fillStyle = '#f5f4f0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${(0.012 + R() * 0.02).toFixed(3)})`; g.beginPath(); g.arc(R() * w, R() * h, 6 + R() * 18, 0, TAU); g.fill(); }
    speck(g, R, 0, 0, w, h, 160, 'rgba(0,0,0,0.03)', 1.2);
  });
  T('ceil', 6, (g, w, h) => { // 矽酸鈣板天花板（60 公分一格、灰色 T 型骨架）
    g.fillStyle = '#f7f7f4'; g.fillRect(0, 0, w, h); speck(g, R, 0, 0, w, h, 260, 'rgba(0,0,0,0.035)', 1);
    g.fillStyle = '#cfcfca'; for (const k of [0, 60]) { g.fillRect(k - 1.2, 0, 2.4, h); g.fillRect(0, k - 1.2, w, 2.4); }
  });
  T('granite', 7, (g, w, h) => { // 廟的花崗石地板（80 公分一塊）
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const k = R() * 12; g.fillStyle = `rgb(${(164 - k) | 0},${(159 - k) | 0},${(150 - k) | 0})`; g.fillRect(i * 60, j * 60, 60, 60); }
    speck(g, R, 0, 0, w, h, 900, () => (R() < 0.5 ? 'rgba(40,38,35,0.35)' : 'rgba(235,232,225,0.35)'), 1.6);
    grid(g, w, h, 2, '#77736b', 1.3);
  });
  T('rbrick', 8, (g, w, h) => { // 三合院的紅地磚（尺磚）
    g.fillStyle = '#c9b8a0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const k = R() * 30; g.fillStyle = `rgb(${(176 - k) | 0},${(88 - k * 0.5) | 0},${(60 - k * 0.4) | 0})`; g.fillRect(i * 30 + 1.2, j * 30 + 1.2, 27.6, 27.6); }
    speck(g, R, 0, 0, w, h, 400, 'rgba(60,20,10,0.15)', 1.5);
  });
  T('wbrick', 9, (g, w, h) => { // 紅磚牆
    g.fillStyle = '#d4c8b6'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 10; r++) for (let x = (r % 2) * -15; x < w; x += 30) { const k = R() * 28; g.fillStyle = `rgb(${(172 - k) | 0},${(84 - k * 0.5) | 0},${(58 - k * 0.4) | 0})`; g.fillRect(x + 1, r * 12 + 1, 28, 10); }
  });
  T('slats', 10, (g, w, h) => { // 鐵捲門（裡面看）
    for (let y = 0; y < h; y += 10) { g.fillStyle = lg(g, 0, y, 0, y + 10, [[0, '#a9afb6'], [0.5, '#d7dbdf'], [1, '#8b9299']]); g.fillRect(0, y, w, 10); }
    g.fillStyle = 'rgba(120,90,50,0.07)'; for (let i = 0; i < 6; i++) g.fillRect(R() * w, 0, 2 + R() * 5, h);
  });
  T('timber', 11, (g, w, h) => { // 樑、椽子的木頭（紋沿著 u）
    g.fillStyle = '#8d5c37'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 44; i++) { g.strokeStyle = `rgba(${R() < 0.5 ? '60,35,15' : '160,110,65'},${(0.2 + R() * 0.3).toFixed(2)})`; g.lineWidth = 0.6 + R() * 1.2; const y = R() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (R() - 0.5) * 6, w * 0.7, y + (R() - 0.5) * 6, w, y); g.stroke(); }
  });
  T('tatami', 12, (g, w, h) => { // 榻榻米（兩片並排，綠色包邊）
    for (let i = 0; i < 2; i++) { const x = i * 60; g.fillStyle = '#d2c894'; g.fillRect(x, 0, 60, h); g.fillStyle = 'rgba(120,110,60,0.22)'; for (let y = 0; y < h; y += 2.5) g.fillRect(x, y, 60, 0.8); g.fillStyle = '#2f4632'; g.fillRect(x, 0, 4, h); g.fillRect(x + 56, 0, 4, h); }
  });
  T('storeT', 13, (g, w, h) => { // 超商的白地磚
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const k = (246 + R() * 6) | 0; g.fillStyle = `rgb(${k},${k},${k - 2})`; g.fillRect(i * 60, j * 60, 60, 60); }
    speck(g, R, 0, 0, w, h, 120, 'rgba(0,0,0,0.04)', 1); grid(g, w, h, 2, '#d3d3cf', 1.2);
  });
  T('mosaic', 14, (g, w, h) => { // 小口磚（麵店、浴室的地）
    g.fillStyle = '#b3bec2'; g.fillRect(0, 0, w, h); const cs = ['#e9eef0', '#d4e3ea', '#f4f4f2', '#c9d6dc', '#dfe8e6', '#cfe0e4'];
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) { g.fillStyle = pick(R, cs); g.fillRect(i * 10 + 0.8, j * 10 + 0.8, 8.4, 8.4); }
  });
  T('white', 15, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); });
  return S;
}

// 家具、小東西（有光照）：位置照下面的表（剛好排滿 512²）
function propAtlas(R) {
  const S = sheet(512, 512), P = (name, x, y, w, h, draw) => S.reg(name, x, y, w, h, draw);
  P('white', 496, 128, 16, 96, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); });
  P('deity', 0, 0, 96, 128, (g, w, h) => { // 神明彩：金框、紅底、中間坐著的神明（光環、金冠、黃袍）、兩邊站著的
    g.fillStyle = '#b8892e'; g.fillRect(0, 0, w, h); g.fillStyle = '#7a1a12'; g.fillRect(5, 5, w - 10, h - 10);
    g.fillStyle = lg(g, 0, 8, 0, h - 8, [[0, '#f0d9a8'], [0.5, '#e8c890'], [1, '#c99a5a']]); g.fillRect(9, 9, w - 18, h - 18);
    g.fillStyle = 'rgba(255,240,190,0.9)'; g.beginPath(); g.arc(w / 2, 42, 20, 0, TAU); g.fill(); // 光環
    g.fillStyle = '#d4a62c'; g.beginPath(); g.moveTo(w / 2 - 10, 30); g.lineTo(w / 2 + 10, 30); g.lineTo(w / 2 + 7, 20); g.lineTo(w / 2, 24); g.lineTo(w / 2 - 7, 20); g.fill(); // 冠
    g.fillStyle = '#f2cfa6'; g.beginPath(); g.arc(w / 2, 38, 8, 0, TAU); g.fill();
    g.fillStyle = '#f4f2ea'; g.beginPath(); g.moveTo(w / 2 - 6, 42); g.quadraticCurveTo(w / 2, 58, w / 2 + 6, 42); g.fill(); // 白鬍子
    g.fillStyle = '#e0a526'; g.beginPath(); g.moveTo(w / 2 - 22, 104); g.quadraticCurveTo(w / 2 - 20, 56, w / 2, 50); g.quadraticCurveTo(w / 2 + 20, 56, w / 2 + 22, 104); g.fill(); // 袍
    g.fillStyle = '#c0392b'; g.fillRect(w / 2 - 22, 84, 44, 8); g.fillStyle = '#2d6ea8'; g.fillRect(w / 2 - 5, 58, 10, 26);
    for (const s of [-1, 1]) { const x = w / 2 + s * 33; g.fillStyle = s < 0 ? '#2e7d4f' : '#a8322a'; g.beginPath(); g.moveTo(x - 9, 112); g.lineTo(x - 7, 66); g.lineTo(x + 7, 66); g.lineTo(x + 9, 112); g.fill(); g.fillStyle = '#f2cfa6'; g.beginPath(); g.arc(x, 60, 6, 0, TAU); g.fill(); g.fillStyle = '#1b1b1b'; g.fillRect(x - 6, 52, 12, 4); }
    g.fillStyle = 'rgba(120,70,20,0.5)'; g.fillRect(9, h - 20, w - 18, 11); // 蓮花座
    g.fillStyle = '#e04a7a'; for (let x = 16; x < w - 12; x += 11) { g.beginPath(); g.ellipse(x, h - 14, 5, 3, 0, 0, TAU); g.fill(); }
  });
  P('quilt', 96, 0, 128, 128, (g, w, h) => { // 床單、被子：白底小花（頂點色上色）
    g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, w, h);
    const cs = ['#f08aa2', '#f5b041', '#8fc1e3', '#9ccf8a', '#e57373'];
    for (let i = 0; i < 70; i++) { const x = R() * w, y = R() * h, c = pick(R, cs); g.fillStyle = c; for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; g.beginPath(); g.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2, 0, TAU); g.fill(); } g.fillStyle = '#fff2a8'; g.beginPath(); g.arc(x, y, 1.3, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.06)'; g.lineWidth = 1; for (let y = 16; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
  P('dragon', 224, 0, 64, 128, (g, w, h) => { // 龍柱：石頭柱子上盤一條龍
    g.fillStyle = '#9d988d'; g.fillRect(0, 0, w, h); speck(g, R, 0, 0, w, h, 300, 'rgba(50,48,44,0.3)', 1.5);
    g.strokeStyle = '#6f6a60'; g.lineWidth = 9; g.beginPath(); for (let y = -10; y <= h + 10; y += 2) { const x = w / 2 + Math.sin(y / 11) * 22; if (y === -10) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
    g.strokeStyle = '#c9c3b6'; g.lineWidth = 3; g.beginPath(); for (let y = -10; y <= h + 10; y += 2) { const x = w / 2 + Math.sin(y / 11) * 22 - 2; if (y === -10) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
    g.fillStyle = '#5d584f'; for (let y = 4; y < h; y += 9) { const x = w / 2 + Math.sin(y / 11) * 22; g.beginPath(); g.arc(x + 3, y, 2, 0, TAU); g.fill(); }
  });
  P('tablet', 288, 0, 32, 128, (g, w, h) => { // 祖先牌位：黑底金字、上面金色雕花
    g.fillStyle = '#7a1a12'; g.fillRect(0, 0, w, h); g.fillStyle = '#d4a62c'; g.fillRect(0, 0, w, 20); g.fillRect(0, h - 10, w, 10);
    g.fillStyle = '#1c1512'; g.fillRect(4, 22, w - 8, h - 36); vtxt(g, '歷代祖先', w / 2, 34, 13, 11, '#e8c25a');
    g.fillStyle = '#7a1a12'; g.beginPath(); g.arc(w / 2, 10, 7, 0, TAU); g.fill();
  });
  P('cpL', 320, 0, 16, 128, (g, w, h) => { g.fillStyle = '#b3261e'; g.fillRect(0, 0, w, h); vtxt(g, '福而有德千家敬', w / 2, 10, 17, 13, '#f0cd62'); });
  P('cpR', 336, 0, 16, 128, (g, w, h) => { g.fillStyle = '#b3261e'; g.fillRect(0, 0, w, h); vtxt(g, '正則為神萬古尊', w / 2, 10, 17, 13, '#f0cd62'); });
  P('qian', 352, 0, 32, 64, (g, w, h) => { // 籤筒：竹子的筒、一把竹籤
    g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, w, h); for (let x = 2; x < w - 2; x += 3) { g.fillStyle = `rgb(${(200 + R() * 30) | 0},${(160 + R() * 30) | 0},${(90 + R() * 20) | 0})`; g.fillRect(x, 0, 2, 26 + R() * 8); }
    g.fillStyle = '#b3261e'; g.fillRect(0, 30, w, h - 30); vtxt(g, '靈籤', w / 2, 42, 13, 11, '#f0cd62');
  });
  P('mirror', 352, 64, 32, 64, (g, w, h) => { g.fillStyle = lg(g, 0, 0, w, h, [[0, '#dfe8ee'], [0.45, '#aebdc8'], [0.55, '#eef4f7'], [1, '#8fa1ad']]); g.fillRect(0, 0, w, h); });
  P('calendar', 384, 0, 64, 96, (g, w, h) => { // 撕的日曆：紅色大字日期
    g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); g.fillStyle = '#c0392b'; g.fillRect(0, 0, w, 16); txt(g, '九月', w / 2, 8.5, 11, '#fff');
    txt(g, '28', w / 2, 44, 36, '#c0392b', 'center', 0, 700, COND); txt(g, '星期一', w / 2, 70, 10, '#333'); txt(g, '農曆八月十八', w / 2, 83, 8, '#555', 'center', w - 6);
    g.fillStyle = '#d9d2c2'; g.fillRect(0, 16, w, 2);
  });
  P('poster1', 448, 0, 64, 96, (g, w, h) => { // 超商的海報：第二件六折
    g.fillStyle = '#ffcf33'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8412c'; g.beginPath(); g.arc(w / 2, 40, 24, 0, TAU); g.fill();
    txt(g, '第二件', w / 2, 32, 12, '#fff'); txt(g, '六折', w / 2, 49, 16, '#fff'); txt(g, '冷飲料', w / 2, 80, 13, '#7a2a10');
  });
  P('books', 384, 96, 128, 32, (g, w, h) => { // 書背
    g.fillStyle = '#5a4634'; g.fillRect(0, 0, w, h); const cs = ['#c0392b', '#2e86c1', '#f4d03f', '#27ae60', '#f5f5f0', '#8e44ad', '#e67e22', '#34495e'];
    for (let x = 1; x < w - 3;) { const bw = 3 + R() * 5, bh = 18 + R() * 12; g.fillStyle = pick(R, cs); g.fillRect(x, h - bh, bw, bh); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + bw * 0.3, h - bh + 4, bw * 0.4, 2); x += bw + 0.6; }
  });
  P('poster2', 0, 128, 64, 96, (g, w, h) => { // 霜淇淋
    g.fillStyle = '#eaf6ff'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8b36a'; g.beginPath(); g.moveTo(w / 2 - 11, 44); g.lineTo(w / 2 + 11, 44); g.lineTo(w / 2, 74); g.fill();
    g.fillStyle = '#fffaf0'; for (const [y, r] of [[40, 13], [30, 10], [22, 6]]) { g.beginPath(); g.arc(w / 2, y, r, 0, TAU); g.fill(); }
    txt(g, '霜淇淋', w / 2, 86, 12, '#2a6ab0');
  });
  P('poster3', 64, 128, 64, 96, (g, w, h) => { // 咖啡第二杯半價
    g.fillStyle = '#5b3a24'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; rr(g, w / 2 - 12, 26, 24, 26, 4); g.fill(); g.fillStyle = '#8a5a3a'; g.fillRect(w / 2 - 10, 30, 20, 6);
    txt(g, '咖啡', w / 2, 12, 13, '#ffe7c2'); txt(g, '第二杯', w / 2, 66, 11, '#fff'); txt(g, '半價', w / 2, 82, 14, '#ffcf33');
  });
  P('barber', 128, 128, 64, 96, (g, w, h) => { // 理髮的價目表
    g.fillStyle = '#f7f7f4'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f5fae'; g.fillRect(0, 0, w, 20); txt(g, '理髮', w / 2, 10.5, 13, '#fff');
    [['剪髮', '150'], ['洗髮', '100'], ['刮鬍', '80'], ['染髮', '800']].forEach(([a, b], i) => { txt(g, a, 6, 34 + i * 16, 10, '#222', 'left'); txt(g, b, w - 6, 34 + i * 16, 11, '#c0392b', 'right', 0, 700, COND); });
  });
  P('atm', 192, 128, 48, 96, (g, w, h) => { // 提款機的外殼
    g.fillStyle = '#d9dde2'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a6ab0'; g.fillRect(0, 0, w, 16); txt(g, '提款機', w / 2, 8.5, 10, '#fff');
    g.fillStyle = '#2b2e33'; g.fillRect(8, 22, w - 16, 26); g.fillStyle = '#9aa0a6'; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.fillRect(12 + c * 9, 56 + r * 7, 7, 5);
    g.fillStyle = '#3a3d42'; g.fillRect(8, 86, w - 16, 4);
  });
  P('wardrobe', 240, 128, 64, 96, (g, w, h) => { // 衣櫃門（白底，頂點色上色）：兩片門、細框、把手
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1.5; g.strokeRect(3, 3, w / 2 - 4, h - 6); g.strokeRect(w / 2 + 1, 3, w / 2 - 4, h - 6);
    g.fillStyle = '#9aa0a6'; g.fillRect(w / 2 - 5, h * 0.42, 2, 14); g.fillRect(w / 2 + 3, h * 0.42, 2, 14);
  });
  P('fridge', 304, 128, 64, 96, (g, w, h) => { // 冰箱門（白底）：上下兩門、把手
    g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, 34, w, 2); g.fillStyle = '#b9bec4'; g.fillRect(6, 12, 3, 18); g.fillRect(6, 42, 3, 30);
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(w - 16, 4, 6, h - 8);
  });
  P('plaque', 368, 128, 128, 48, (g, w, h) => { g.fillStyle = '#1b1512'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d4a62c'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); txt(g, '福德正神', w / 2, h / 2 + 1, 28, '#e8c25a', 'center', w - 16); });
  P('plaque2', 368, 176, 128, 48, (g, w, h) => { g.fillStyle = '#1b1512'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d4a62c'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); txt(g, '祖德流芳', w / 2, h / 2 + 1, 28, '#e8c25a', 'center', w - 16); });
  const goods = (g, w, h, cs, tall) => { // 貨架上一排一排的東西（兩層）
    g.fillStyle = '#e9ebee'; g.fillRect(0, 0, w, h);
    for (const y0 of [0, h / 2]) {
      for (let x = 1; x < w - 2;) { const bw = 5 + R() * 8, bh = (tall ? 18 : 12) + R() * 10; const c = pick(R, cs); g.fillStyle = c; g.fillRect(x, y0 + h / 2 - 3 - bh, bw, bh); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x + 1, y0 + h / 2 - bh + 1, bw - 2, 3); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + bw - 1.2, y0 + h / 2 - 3 - bh, 1.2, bh); x += bw + 0.8; }
      g.fillStyle = '#bfc4ca'; g.fillRect(0, y0 + h / 2 - 3, w, 3); g.fillStyle = '#ffcf33'; for (let x = 6; x < w; x += 22) g.fillRect(x, y0 + h / 2 - 3, 9, 3); // 價錢條
    }
  };
  P('goods1', 0, 224, 128, 64, (g, w, h) => goods(g, w, h, ['#e0453a', '#f2c230', '#3b8fd9', '#43b36b', '#f07aa8', '#ff8a2a', '#8a5cd6', '#ffffff'], false)); // 零嘴
  P('goods2', 128, 224, 128, 64, (g, w, h) => { // 飲料瓶
    g.fillStyle = '#e9ebee'; g.fillRect(0, 0, w, h); const cs = ['#d93b2b', '#2f8fd6', '#f6c343', '#43b36b', '#f2f2f2', '#8a5a3a', '#ff8a2a'];
    for (const y0 of [0, h / 2]) { for (let x = 2; x < w - 4; x += 7) { const c = pick(R, cs); g.fillStyle = c; g.fillRect(x, y0 + 8, 5.5, h / 2 - 11); g.fillRect(x + 1.5, y0 + 4, 2.5, 4); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x, y0 + 14, 5.5, 5); } g.fillStyle = '#bfc4ca'; g.fillRect(0, y0 + h / 2 - 3, w, 3); }
  });
  P('goods3', 256, 224, 128, 64, (g, w, h) => goods(g, w, h, ['#f5f5f0', '#9ad0f5', '#f7d6e0', '#b5e3c4', '#ffe9a8', '#d0d4da', '#6bb3e6'], true)); // 衛生紙、洗衣精
  P('meds', 384, 224, 128, 64, (g, w, h) => goods(g, w, h, ['#ffffff', '#e8f4ff', '#fdecef', '#2e9a5c', '#2a6ab0', '#e0453a', '#f6c343'], false)); // 藥盒
  P('tyres', 0, 288, 128, 64, (g, w, h) => { // 牆上的輪胎架
    g.fillStyle = '#34363b'; g.fillRect(0, 0, w, h);
    for (const y of [2, 33]) { for (let x = 2; x < w - 14; x += 15) { g.fillStyle = '#141517'; rr(g, x, y, 13, 26, 4); g.fill(); g.fillStyle = '#3c3e42'; g.fillRect(x + 3, y + 3, 1.5, 20); g.fillRect(x + 8.5, y + 3, 1.5, 20); } g.fillStyle = '#c8322a'; g.fillRect(0, y + 26, w, 3); }
  });
  P('peg', 128, 288, 128, 64, (g, w, h) => { // 洞洞板＋工具
    g.fillStyle = '#c9b27c'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(60,40,20,0.45)'; for (let x = 3; x < w; x += 6) for (let y = 3; y < h; y += 6) g.fillRect(x, y, 1.3, 1.3);
    const cs = ['#d0342c', '#2f6fd6', '#f2c230', '#1d1f23', '#8f949b'];
    for (let i = 0; i < 10; i++) { const x = 6 + i * 12, c = pick(R, cs); g.fillStyle = '#9aa0a6'; g.fillRect(x, 6, 2.5, 20 + (i % 3) * 5); g.fillStyle = c; g.fillRect(x - 1, 26 + (i % 3) * 5, 4.5, 8); }
    for (let i = 0; i < 5; i++) { const x = 10 + i * 24; g.strokeStyle = '#7d848b'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, 48, 5, 0, TAU); g.stroke(); }
  });
  P('cig', 256, 288, 128, 64, (g, w, h) => { // 櫃台後面的一格一格小盒子（沒有牌子）
    g.fillStyle = '#2a2c30'; g.fillRect(0, 0, w, h); const cs = ['#f2f2f0', '#d93b2b', '#2a6ab0', '#e8c25a', '#43b36b', '#8f949b', '#1d1f23'];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) { g.fillStyle = pick(R, cs); g.fillRect(2 + c * 12.6, 2 + r * 15.5, 10.6, 12); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(3 + c * 12.6, 3 + r * 15.5, 8, 2); }
  });
  P('betel', 384, 288, 64, 64, (g, w, h) => { // 檳榔攤的玻璃櫃：一包一包、綠色的檳榔
    g.fillStyle = '#e8f0ea'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { g.fillStyle = '#fff'; g.fillRect(3 + c * 15, 4 + r * 20, 13, 16); g.fillStyle = '#4c8a3a'; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(7 + c * 15 + (k % 2) * 5, 9 + r * 20 + ((k / 2) | 0) * 6, 2.2, 3, 0, 0, TAU); g.fill(); } }
  });
  P('oden', 448, 288, 64, 64, (g, w, h) => { // 關東煮（格子裡的湯、白蘿蔔、蛋、豆腐、魚板）
    g.fillStyle = '#b9bec4'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { const x = 2 + c * 20.5, y = 2 + r * 30.5; g.fillStyle = '#c99a4a'; g.fillRect(x, y, 19, 29); for (let k = 0; k < 5; k++) { g.fillStyle = pick(R, ['#f3ead0', '#f7f2e6', '#e2b86a', '#f0a8b8', '#d9c9a8', '#8a6a3a']); g.beginPath(); g.arc(x + 4 + R() * 11, y + 4 + R() * 21, 3 + R() * 2.5, 0, TAU); g.fill(); } }
  });
  const grain = (g, w, h, base, dark, n = 26) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { g.strokeStyle = dark; g.globalAlpha = 0.15 + R() * 0.25; g.lineWidth = 0.6 + R(); const y = R() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (R() - 0.5) * 5, w * 0.6, y + (R() - 0.5) * 5, w, y + (R() - 0.5) * 3); g.stroke(); } g.globalAlpha = 1; };
  P('pwood', 0, 352, 64, 64, (g, w, h) => grain(g, w, h, '#8a4b2a', '#3a1a0c')); // 紅木（神明桌、沙發、八仙桌）
  P('lwood', 64, 352, 64, 64, (g, w, h) => grain(g, w, h, '#d8b98e', '#8a6a44')); // 淺色木頭（書桌、衣櫃、椅子）
  P('fabric', 128, 352, 64, 64, (g, w, h) => { g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.07)'; for (let y = 0; y < h; y += 2) g.fillRect(0, y, w, 1); for (let x = 0; x < w; x += 2) g.fillRect(x, 0, 1, h); }); // 布（白底，頂點色上色）
  P('clock', 192, 352, 64, 64, (g, w, h) => {
    g.fillStyle = '#3a3d42'; g.beginPath(); g.arc(32, 32, 31, 0, TAU); g.fill(); g.fillStyle = '#fbfaf5'; g.beginPath(); g.arc(32, 32, 27, 0, TAU); g.fill();
    g.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.fillRect(32 + Math.cos(a) * 22 - 1.2, 32 + Math.sin(a) * 22 - 1.2, 2.4, 2.4); }
    g.strokeStyle = '#222'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + 11, 32 - 7); g.stroke(); g.lineWidth = 1.6; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 - 3, 32 - 19); g.stroke();
  });
  P('mag', 256, 352, 64, 64, (g, w, h) => { // 雜誌、報紙
    const cs = ['#e0453a', '#2f6fd6', '#f2c230', '#43b36b', '#f07aa8', '#222'];
    for (let i = 0; i < 4; i++) { const x = (i % 2) * 32, y = ((i / 2) | 0) * 32; g.fillStyle = '#f7f7f4'; g.fillRect(x + 1, y + 1, 30, 30); g.fillStyle = pick(R, cs); g.fillRect(x + 1, y + 1, 30, 8); g.fillStyle = pick(R, cs); g.fillRect(x + 5, y + 12, 22, 14); }
  });
  // 鏤空的（alphaTest）：盆栽的葉子、蕾絲窗簾、三種鐵窗、晾的衣服、電風扇的網
  P('plant', 320, 352, 64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); for (let i = 0; i < 26; i++) { g.fillStyle = pick(R, ['#3f7a35', '#4f8a3c', '#5e9a44', '#2f6a2c']); g.save(); g.translate(w / 2 + (R() - 0.5) * 36, h * 0.3 + R() * 40); g.rotate((R() - 0.5) * 2.4); g.beginPath(); g.ellipse(0, 0, 5, 14, 0, 0, TAU); g.fill(); g.restore(); } });
  P('lace', 384, 352, 64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(250,250,245,1)'; for (let x = 0; x < w; x += 4) for (let y = 0; y < h; y += 4) if ((x + y) % 8 === 0 || (R() < 0.35)) g.fillRect(x, y, 3, 3); g.fillRect(0, 0, w, 6); });
  const bars = (g, w, h, col, fn) => { g.clearRect(0, 0, w, h); g.strokeStyle = col; g.fillStyle = col; fn(); g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3); g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h); };
  P('grille1', 448, 352, 64, 64, (g, w, h) => bars(g, w, h, '#f4f4f0', () => { for (let x = 4; x < w; x += 8) g.fillRect(x, 0, 2.2, h); g.fillRect(0, h * 0.3, w, 2.5); g.lineWidth = 2; for (let x = 8; x < w; x += 16) { g.beginPath(); g.arc(x, h * 0.3 - 6, 5, Math.PI, 0); g.stroke(); } })); // 白色鐵窗（上面捲捲的）
  P('grille2', 0, 416, 64, 64, (g, w, h) => bars(g, w, h, '#3f7c59', () => { for (let x = 2; x < w; x += 10) g.fillRect(x, 0, 2.5, h); for (let y = 2; y < h; y += 10) g.fillRect(0, y, w, 2.5); })); // 綠色方格
  P('grille3', 64, 416, 64, 64, (g, w, h) => bars(g, w, h, '#6a4a36', () => { g.lineWidth = 2.5; for (let x = -h; x < w; x += 13) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.moveTo(x + h, 0); g.lineTo(x, h); g.stroke(); } })); // 咖啡色菱形
  P('clothes', 128, 416, 64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); const cs = ['#e0453a', '#3b8fd9', '#f2f2f0', '#f2c230', '#43b36b', '#f07aa8'];
    for (let i = 0; i < 4; i++) { const x = 2 + i * 15.5; g.fillStyle = pick(R, cs); if (i % 2) { g.fillRect(x, 4, 13, 34); } else { g.beginPath(); g.moveTo(x, 4); g.lineTo(x + 13, 4); g.lineTo(x + 15, 12); g.lineTo(x + 11, 13); g.lineTo(x + 11, 40); g.lineTo(x + 2, 40); g.lineTo(x + 2, 13); g.lineTo(x - 2, 12); g.fill(); } }
    g.fillStyle = '#888'; g.fillRect(0, 2, w, 2); });
  P('redCarve', 192, 416, 64, 64, (g, w, h) => { g.fillStyle = '#8f1d14'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d4a62c'; g.lineWidth = 2; g.strokeRect(4, 4, w - 8, h - 8); for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(16 + (i % 2) * 32, 16 + ((i / 2) | 0) * 32, 9, 0, TAU); g.stroke(); } g.fillStyle = '#e8c25a'; g.beginPath(); g.arc(32, 32, 5, 0, TAU); g.fill(); }); // 紅漆雕花（神龕、紅眠床）
  P('goldCarve', 256, 416, 64, 64, (g, w, h) => { g.fillStyle = '#c9982e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a5a14'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 6 + i * 11); for (let x = 0; x <= w; x += 8) g.quadraticCurveTo(x + 4, 6 + i * 11 + (x % 16 ? 5 : -5), x + 8, 6 + i * 11); g.stroke(); } });
  P('rug', 320, 416, 128, 64, (g, w, h) => { g.fillStyle = '#8b2c2a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e0b060'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12); g.lineWidth = 1.5; g.strokeRect(12, 12, w - 24, h - 24); g.fillStyle = '#1f3a5a'; g.beginPath(); g.ellipse(w / 2, h / 2, 26, 12, 0, 0, TAU); g.fill(); speck(g, R, 0, 0, w, h, 400, 'rgba(0,0,0,0.12)', 1.2); });
  P('photo', 448, 416, 64, 64, (g, w, h) => { // 全家福
    g.fillStyle = '#c9a15a'; g.fillRect(0, 0, w, h); g.fillStyle = lg(g, 0, 4, 0, h - 4, [[0, '#9ec5e0'], [0.6, '#dce9c9'], [1, '#8fb070']]); g.fillRect(5, 5, w - 10, h - 10);
    for (let i = 0; i < 5; i++) { const x = 12 + i * 10, y = 34 + (i % 2) * 3; g.fillStyle = pick(R, ['#d8342c', '#2f6fd6', '#f2f2f2', '#2e8b57', '#444']); g.fillRect(x - 4, y, 8, 18); g.fillStyle = '#e8c09a'; g.beginPath(); g.arc(x, y - 4, 4, 0, TAU); g.fill(); g.fillStyle = '#222'; g.fillRect(x - 4, y - 9, 8, 3); }
  });
  P('beam', 0, 480, 128, 32, (g, w, h) => { // 廟的彩繪樑
    g.fillStyle = '#1f4f7a'; g.fillRect(0, 0, w, h); g.fillStyle = '#c9982e'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
    g.fillStyle = '#b3261e'; g.fillRect(w * 0.3, 5, w * 0.4, h - 10); g.fillStyle = '#f2e3b0'; g.fillRect(w * 0.33, 8, w * 0.34, h - 16);
    g.fillStyle = '#2e8b57'; for (let x = 4; x < w * 0.28; x += 10) { g.beginPath(); g.arc(x + 4, h / 2, 4, 0, TAU); g.fill(); } for (let x = w * 0.72; x < w - 4; x += 10) { g.beginPath(); g.arc(x + 4, h / 2, 4, 0, TAU); g.fill(); }
    g.fillStyle = '#d33b2c'; g.beginPath(); g.arc(w / 2 - 12, h / 2, 4, 0, TAU); g.fill(); g.fillStyle = '#2f6fd6'; g.beginPath(); g.arc(w / 2 + 12, h / 2, 4, 0, TAU); g.fill();
  });
  P('steel', 128, 480, 64, 32, (g, w, h) => { g.fillStyle = '#c3c7cc'; g.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)'; g.fillRect(R() * w - 10, R() * h, 10 + R() * 30, 0.8); } }); // 不鏽鋼（拉絲）
  P('oil', 192, 480, 64, 32, (g, w, h) => { g.fillStyle = '#5c6167'; g.fillRect(0, 0, w, h); for (let x = 1; x < w - 5; x += 7) { g.fillStyle = pick(R, ['#f2c230', '#e0453a', '#2f6fd6', '#1d1f23', '#43b36b']); g.fillRect(x, 6, 6, h - 8); g.fillRect(x + 2, 3, 2, 3); } });
  P('pillow', 256, 480, 32, 32, (g, w, h) => { g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1; rr(g, 2, 2, w - 4, h - 4, 8); g.stroke(); });
  P('fan', 288, 480, 32, 32, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#e8eaec'; g.lineWidth = 1.2; for (const r of [15, 11, 7]) { g.beginPath(); g.arc(16, 16, r, 0, TAU); g.stroke(); } for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.beginPath(); g.moveTo(16, 16); g.lineTo(16 + Math.cos(a) * 15, 16 + Math.sin(a) * 15); g.stroke(); } g.fillStyle = '#5ab4ff'; g.beginPath(); g.arc(16, 16, 3.5, 0, TAU); g.fill(); });
  P('price', 320, 480, 64, 32, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#e0453a'; g.fillRect(0, 0, w, 10); txt(g, '營業中', w / 2, 21, 12, '#222'); });
  P('fu', 384, 480, 32, 32, (g, w, h) => { g.fillStyle = '#c62f25'; g.save(); g.translate(16, 16); g.rotate(Math.PI / 4); g.fillRect(-11, -11, 22, 22); g.restore(); txt(g, '福', 16, 17, 15, '#1a1210'); }); // 斗方「福」
  P('donate', 416, 480, 32, 32, (g, w, h) => { g.fillStyle = '#b3261e'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b1512'; g.fillRect(8, 3, 16, 3); txt(g, '香油錢', w / 2, 19, 9, '#f0cd62', 'center', w - 4); });
  P('register', 448, 480, 32, 32, (g, w, h) => { g.fillStyle = '#3a3d42'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1f23'; g.fillRect(3, 3, w - 6, 12); g.fillStyle = '#c9ccd0'; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g.fillRect(4 + c * 6.5, 18 + r * 4.5, 5, 3.5); });
  P('door', 480, 480, 32, 32, (g, w, h) => { g.fillStyle = lg(g, 0, 0, w, 0, [[0, '#b58a5a'], [0.5, '#c89c6a'], [1, '#a57a4a']]); g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(60,35,15,0.35)'; g.lineWidth = 1; g.strokeRect(4, 3, w - 8, 11); g.strokeRect(4, 17, w - 8, 12); }); // 木門板
  return S;
}

// 自己發光的（不吃燈）：冰箱裡面、菜單燈箱、電視、光明燈、燈籠、燈的顏色
function glowAtlas(R) {
  const S = sheet(512, 512), P = (name, x, y, w, h, draw) => S.reg(name, x, y, w, h, draw);
  const fridge = (g, w, h, cs, tall) => { // 冰箱（玻璃門）裡面：亮亮的層架、一排一排瓶子
    g.fillStyle = '#eef6fb'; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h - 8; y += 24) {
      for (let x = 4; x < w - 6; x += 7) { const c = pick(R, cs), bh = (tall ? 17 : 13) + R() * 3; g.fillStyle = c; g.fillRect(x, y + 20 - bh, 5.5, bh); g.fillRect(x + 1.6, y + 20 - bh - 3, 2.3, 3); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x, y + 20 - bh + 4, 5.5, 3); }
      g.fillStyle = '#b9c4cc'; g.fillRect(0, y + 20, w, 2.5);
    }
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.moveTo(w * 0.62, 0); g.lineTo(w * 0.8, 0); g.lineTo(w * 0.35, h); g.lineTo(w * 0.17, h); g.fill(); // 玻璃反光
    g.fillStyle = '#2a2c30'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3); g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h); g.fillStyle = '#9aa0a6'; g.fillRect(w - 8, h * 0.35, 2.5, h * 0.3);
  };
  P('fridgeA', 0, 0, 64, 128, (g, w, h) => fridge(g, w, h, ['#d93b2b', '#2f8fd6', '#f6c343', '#43b36b', '#f2f2f2', '#8a5a3a', '#ff8a2a', '#1d1f23'], true));
  P('fridgeB', 64, 0, 64, 128, (g, w, h) => fridge(g, w, h, ['#ffffff', '#f7e6b8', '#ffd1dc', '#c8e6c9', '#bbdefb', '#fff59d', '#8a5a3a'], false));
  const menu = (g, w, h, title, bg, fg, items) => { // 菜單燈箱
    g.fillStyle = '#fffdf5'; g.fillRect(0, 0, w, h); g.fillStyle = bg; g.fillRect(0, 0, w, 22); txt(g, title, w / 2, 11.5, 16, fg);
    items.forEach(([a, b], i) => { const y = 30 + i * 11; txt(g, a, 6, y, 9.5, '#222', 'left', w * 0.66); txt(g, b, w - 6, y, 11, '#c0392b', 'right', 0, 700, COND); });
    g.strokeStyle = bg; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
  };
  P('menuN', 128, 0, 128, 96, (g, w, h) => menu(g, w, h, '菜單', '#c62f25', '#fff5c4', [['紅燒牛肉麵', '130'], ['清燉牛肉麵', '130'], ['牛肉湯麵', '80'], ['陽春麵', '50'], ['餛飩湯', '50'], ['燙青菜', '40']]));
  P('menuB', 256, 0, 128, 96, (g, w, h) => menu(g, w, h, '早餐', '#ff8a2a', '#fff', [['蛋餅', '30'], ['蘿蔔糕', '35'], ['鐵板麵', '50'], ['火腿蛋吐司', '40'], ['奶茶', '25'], ['豆漿', '20']]));
  P('menuI', 384, 0, 128, 96, (g, w, h) => menu(g, w, h, '剉冰', '#2a8fd6', '#fff', [['芒果冰', '120'], ['紅豆牛奶冰', '60'], ['八寶冰', '60'], ['雪花冰', '90'], ['粉圓冰', '50'], ['檸檬愛玉', '40']]));
  P('storeBox', 128, 96, 128, 32, (g, w, h) => { g.fillStyle = '#12a39a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffcf33'; g.fillRect(0, h - 5, w, 5); txt(g, '咖啡 · 熱食 · 關東煮', w / 2, h / 2 - 1, 15, '#fff', 'center', w - 8); });
  P('pharm', 256, 96, 128, 32, (g, w, h) => { g.fillStyle = '#2e9a5c'; g.fillRect(0, 0, w, h); txt(g, '藥局 · 健保特約', w / 2, h / 2 + 1, 15, '#fff', 'center', w - 10); });
  P('exit', 384, 96, 64, 32, (g, w, h) => { g.fillStyle = '#1f9d55'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.beginPath(); g.arc(14, 9, 3.5, 0, TAU); g.fill(); g.fillRect(11, 13, 6, 9); g.fillRect(8, 21, 4, 8); g.fillRect(16, 21, 4, 8); txt(g, '出口', 42, h / 2 + 1, 14, '#fff'); });
  P('cross', 448, 96, 32, 32, (g, w, h) => { g.fillStyle = '#f4fff6'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f9d55'; g.fillRect(12, 4, 8, 24); g.fillRect(4, 12, 24, 8); });
  P('atmS', 480, 96, 32, 32, (g, w, h) => { g.fillStyle = '#1f5fae'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8f2ff'; for (let i = 0; i < 4; i++) g.fillRect(5, 6 + i * 6, 12 + (i % 2) * 8, 3); });
  P('lightWall', 0, 128, 128, 128, (g, w, h) => { // 光明燈：一格一格小佛像，每格一盞燈，下面紅色的名牌
    g.fillStyle = '#6b1410'; g.fillRect(0, 0, w, h); g.fillStyle = '#d4a62c'; g.fillRect(0, 0, w, 16); txt(g, '光明燈', w / 2, 8.5, 12, '#7a1a12');
    for (let r = 0; r < 7; r++) for (let c = 0; c < 8; c++) {
      const x = 2 + c * 15.7, y = 19 + r * 15.5; g.fillStyle = '#3a0c08'; g.fillRect(x, y, 14, 14);
      const gr = g.createRadialGradient(x + 7, y + 6, 1, x + 7, y + 6, 7); gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.5, '#ffc94a'); gr.addColorStop(1, 'rgba(255,150,40,0.2)'); g.fillStyle = gr; g.fillRect(x + 1, y + 1, 12, 10);
      g.fillStyle = '#b8892e'; g.beginPath(); g.arc(x + 7, y + 6, 2.2, 0, TAU); g.fill(); g.fillStyle = '#e0261a'; g.fillRect(x + 3, y + 11, 8, 2.5);
    }
  });
  P('lantern', 128, 128, 64, 64, (g, w, h) => { // 紅燈籠（包在圓柱、球上：上下金色、中間「福」）
    g.fillStyle = lg(g, 0, 0, 0, h, [[0, '#8f1a10'], [0.5, '#ff4a2a'], [1, '#8f1a10']]); g.fillRect(0, 0, w, h); g.fillStyle = '#e8b83a'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
    g.strokeStyle = 'rgba(120,20,10,0.5)'; g.lineWidth = 1; for (let x = 0; x < w; x += 8) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x, h - 6); g.stroke(); }
    txt(g, '福', w / 4, h / 2 + 1, 22, '#ffe08a'); txt(g, '福', (w * 3) / 4, h / 2 + 1, 22, '#ffe08a');
  });
  const screen = (g, w, h, kind) => { // 電視畫面
    if (kind === 0) { // 連續劇：客廳裡兩個人、下面字幕
      g.fillStyle = lg(g, 0, 0, 0, h, [[0, '#c9a27a'], [1, '#6b4a33']]); g.fillRect(0, 0, w, h); g.fillStyle = '#e8d7b8'; g.fillRect(8, 8, 26, 30);
      for (const [x, c] of [[40, '#2f4f7a'], [64, '#a8322a']]) { g.fillStyle = c; g.fillRect(x - 8, 26, 16, 38); g.fillStyle = '#f0c49a'; g.beginPath(); g.arc(x, 20, 7, 0, TAU); g.fill(); g.fillStyle = '#1b1b1b'; g.fillRect(x - 7, 12, 14, 5); }
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, h - 14, w, 14); txt(g, '今天天氣晴', w / 2, h - 7, 10, '#fff');
    } else if (kind === 1) { // 新聞：主播、跑馬燈
      g.fillStyle = lg(g, 0, 0, w, h, [[0, '#1f4f9a'], [1, '#0e2a5a']]); g.fillRect(0, 0, w, h); g.fillStyle = '#2a6ab0'; g.fillRect(52, 8, 38, 26);
      g.fillStyle = '#3a3d42'; g.fillRect(20, 26, 24, 30); g.fillStyle = '#f0c49a'; g.beginPath(); g.arc(32, 20, 7, 0, TAU); g.fill(); g.fillStyle = '#1b1b1b'; g.fillRect(25, 12, 14, 5);
      g.fillStyle = '#d93b2b'; g.fillRect(0, h - 16, w, 16); txt(g, '今日新聞', 26, h - 8, 9, '#fff'); g.fillStyle = '#fff'; g.fillRect(52, h - 11, 40, 5);
    } else { // 棒球轉播
      g.fillStyle = '#3f8f3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#c9a26a'; g.beginPath(); g.moveTo(w / 2, 18); g.lineTo(w - 10, h - 6); g.lineTo(10, h - 6); g.fill();
      g.fillStyle = '#2f7a2e'; g.beginPath(); g.moveTo(w / 2, 30); g.lineTo(w - 30, h - 12); g.lineTo(30, h - 12); g.fill(); g.fillStyle = '#fff'; g.fillRect(w / 2 - 2, h - 16, 4, 4);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(4, 4, 34, 13); txt(g, '3 : 2', 21, 11, 10, '#ffcf33', 'center', 0, 700, COND);
    }
  };
  P('tvA', 192, 128, 96, 64, (g, w, h) => screen(g, w, h, 0));
  P('tvB', 288, 128, 96, 64, (g, w, h) => screen(g, w, h, 1));
  P('tvC', 384, 128, 96, 64, (g, w, h) => screen(g, w, h, 2));
  P('flame', 128, 192, 64, 64, (g, w, h) => { // 蠟燭、油燈的火
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const gr = g.createRadialGradient(w / 2, h * 0.62, 2, w / 2, h * 0.55, w / 2); gr.addColorStop(0, '#fffbe8'); gr.addColorStop(0.3, '#ffd36a'); gr.addColorStop(0.7, '#ff7a1a'); gr.addColorStop(1, '#6a1a00');
    g.fillStyle = gr; g.beginPath(); g.moveTo(w / 2, 2); g.quadraticCurveTo(w, h * 0.7, w / 2, h - 2); g.quadraticCurveTo(0, h * 0.7, w / 2, 2); g.fill();
  });
  P('monitor', 192, 192, 64, 48, (g, w, h) => { g.fillStyle = lg(g, 0, 0, w, h, [[0, '#4a90d9'], [1, '#1c4f8a']]); g.fillRect(0, 0, w, h); g.fillStyle = '#f4f7fb'; g.fillRect(8, 8, 30, 22); g.fillStyle = '#9ec5e8'; g.fillRect(8, 8, 30, 4); g.fillStyle = '#c9d6e3'; for (let i = 0; i < 4; i++) g.fillRect(11, 15 + i * 3.5, 20, 1.5); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, h - 6, w, 6); });
  P('welcome', 256, 192, 128, 48, (g, w, h) => { g.fillStyle = '#0c0c0e'; g.fillRect(0, 0, w, h); txt(g, '歡迎光臨', w / 2, h / 2 + 1, 26, '#ff3b2a', 'center', w - 10); g.fillStyle = 'rgba(0,0,0,0.45)'; for (let x = 0; x < w; x += 3) g.fillRect(x, 0, 1, h); for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1); });
  P('bulbR', 384, 192, 64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, '#fff1c8'); gr.addColorStop(0.35, '#ff6a3a'); gr.addColorStop(1, '#8a0e06'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }); // 神明燈（紅色燈泡）
  const SW = ['#ffffff', '#fff1d6', '#eef6ff', '#ff3b2a', '#ffd9a0', '#3fdc8a', '#5ab4ff', '#ff8fb5', '#fff59d', '#ff9a3a', '#c8f0ff', '#1b1d22', '#e0261a', '#ffe8b0', '#b8ffcf', '#f4f4f4'];
  const SWN = ['white', 'warm', 'cool', 'red', 'amber', 'green', 'blue', 'pink', 'yellow', 'orange', 'ice', 'black', 'deepred', 'cream', 'mint', 'grey'];
  SW.forEach((c, i) => P('s_' + SWN[i], 448 + (i % 4) * 16, 192 + ((i / 4) | 0) * 16, 16, 16, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); }));
  P('promo', 0, 256, 256, 64, (g, w, h) => { // 超商冰箱上面的燈箱：冷飲、冰品
    g.fillStyle = lg(g, 0, 0, w, 0, [[0, '#0f8f88'], [1, '#16b3a8']]); g.fillRect(0, 0, w, h); g.fillStyle = '#ffcf33'; g.fillRect(0, h - 8, w, 8); g.fillStyle = '#ff5a4a'; g.fillRect(0, h - 14, w, 6);
    txt(g, '冷飲', w * 0.25, h / 2 - 5, 30, '#fff'); txt(g, '冰品', w * 0.75, h / 2 - 5, 30, '#fff'); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(w / 2 - 1, 8, 2, h - 30);
  });
  P('storeBand', 256, 256, 256, 64, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#12a39a'; g.fillRect(0, h - 22, w, 8); g.fillStyle = '#ffcf33'; g.fillRect(0, h - 14, w, 5); g.fillStyle = '#ff5a4a'; g.fillRect(0, h - 9, w, 9); txt(g, '村口超商', w * 0.36, h / 2 - 9, 28, '#12a39a'); txt(g, '24H', w * 0.8, h / 2 - 9, 26, '#ff5a4a', 'center', 0, 700, COND); });
  return S;
}

// 窗外：白天的景（水平方向可以接起來；一張 12 公尺寬 × 6 公尺高，地平線在人的眼睛高度）
// 每張 248×120（四邊留 4 像素）：street 街景（對面的透天厝）、street2、green 後院的樹、roofs 樓上看出去的屋頂、temple 廟埕、court 三合院的禾埕、field 稻田、sky 天空
const VIEW_W = 12, VIEW_H = 6, VIEW_Y0 = -1.2; // 窗景一張幾公尺、最下面在地板下面幾公尺
function viewAtlas(R) {
  const S = sheet(512, 512), V = (name, i, draw) => S.tile(name, (i % 2) * 256 + 4, ((i / 2) | 0) * 128 + 4, 248, 120, draw);
  const W = 248, HZ = 64; // 地平線（canvas y）
  const wrap = (x, wd, fn) => { fn(x); if (x + wd > W) fn(x - W); if (x < 0) fn(x + W); };
  const sky = (g, h, top = '#6fb0ea', hor = '#d9ecf8') => {
    g.fillStyle = lg(g, 0, 0, 0, HZ + 6, [[0, top], [1, hor]]); g.fillRect(0, 0, W, h);
    for (let i = 0; i < 7; i++) { const x = R() * W, y = 6 + R() * 30, s = 8 + R() * 14; wrap(x - s * 2, s * 4, (xx) => { g.fillStyle = 'rgba(255,255,255,0.75)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(xx + s * 2 + (k - 1.5) * s * 0.7, y + (k % 2) * 2, s * 0.7, s * 0.35, 0, 0, TAU); g.fill(); } }); }
  };
  const ridge = (g, base, amp, col, seed) => { // 遠山（週期函數：左右接得起來）
    g.fillStyle = col; g.beginPath(); g.moveTo(0, 130);
    for (let x = 0; x <= W; x += 2) { const t = (x / W) * TAU; g.lineTo(x, base - amp * (0.55 + 0.3 * Math.sin(t * 2 + seed) + 0.15 * Math.sin(t * 5 + seed * 2.3) + 0.08 * Math.sin(t * 11 + seed))); }
    g.lineTo(W, 130); g.fill();
  };
  const HC = ['#f6e9d7', '#f5c9c1', '#cfe9d9', '#fbe6a3', '#cfe2f2', '#ffd5b0', '#e5dcf0', '#f3f3ef', '#dcd5c7', '#d99a78', '#b9dccd', '#f7cfe0', '#a9cbe8'];
  const houseRow = (g, base, fl0, fl1, scale = 1) => { // 對面一排透天厝：磁磚、鐵窗、陽台、冷氣、頂樓水塔
    let x = 0; const ws = []; while (x < W - 1) { let w = (20 + R() * 9) * scale; if (W - x - w < 16 * scale) w = W - x; ws.push([x, w]); x += w; }
    for (const [x0, w] of ws) {
      const fl = fl0 + ((R() * (fl1 - fl0 + 1)) | 0), fh = 11 * scale, top = base - fl * fh, col = pick(R, HC);
      g.fillStyle = col; g.fillRect(x0, top, w, base - top); g.fillStyle = 'rgba(0,0,0,0.06)'; for (let y = top; y < base; y += 3 * scale) g.fillRect(x0, y, w, 0.6);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x0 + w - 1, top, 1, base - top);
      for (let f = 1; f < fl; f++) { const y = base - (f + 1) * fh; // 樓上：窗（鐵窗）或陽台
        if (R() < 0.5) { g.fillStyle = '#4a5d6e'; g.fillRect(x0 + w * 0.22, y + fh * 0.2, w * 0.56, fh * 0.55); g.fillStyle = 'rgba(240,240,236,0.8)'; for (let k = 1; k < 5; k++) g.fillRect(x0 + w * 0.22 + (k * w * 0.56) / 5, y + fh * 0.2, 0.7, fh * 0.55); }
        else { g.fillStyle = '#3d4f60'; g.fillRect(x0 + w * 0.2, y + fh * 0.12, w * 0.6, fh * 0.7); g.fillStyle = mixHex(col, '#ffffff', 0.4); g.fillRect(x0 + 1, y + fh * 0.55, w - 2, fh * 0.35); }
        if (R() < 0.5) { g.fillStyle = '#eeeeea'; g.fillRect(x0 + w * 0.72, y + fh * 0.62, w * 0.18, fh * 0.28); }
      }
      if (R() < 0.6) { g.fillStyle = '#cfd3d6'; g.fillRect(x0, base - fh, w, fh * 0.92); g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = base - fh; y < base; y += 1.6) g.fillRect(x0, y, w, 0.5); } // 鐵捲門
      else { g.fillStyle = '#3d4f60'; g.fillRect(x0 + w * 0.35, base - fh * 0.9, w * 0.3, fh * 0.9); g.fillStyle = pick(R, ['#d33b2c', '#f2c230', '#2f6fd6', '#2e9a5c']); g.fillRect(x0 + 1, base - fh * 1.1, w - 2, fh * 0.2); }
      if (R() < 0.6) { const tx = x0 + w * (0.3 + R() * 0.4); g.fillStyle = R() < 0.5 ? '#2f78c8' : '#c9ced3'; g.fillRect(tx - 3 * scale, top - 6 * scale, 6 * scale, 5 * scale); g.fillStyle = '#8a8f95'; g.fillRect(tx - 3.5 * scale, top - 1.2 * scale, 7 * scale, 1.2 * scale); }
      g.fillStyle = mixHex(col, '#000000', 0.2); g.fillRect(x0, top - 2 * scale, w, 2 * scale); // 女兒牆
    }
  };
  const tree = (g, x, y, s, col) => wrap(x - s * 1.4, s * 2.8, (xx) => { g.fillStyle = '#6b5140'; g.fillRect(xx + s * 1.4 - s * 0.12, y - s * 0.9, s * 0.24, s * 0.9); for (const [dx, dy, r] of [[0, -1.6, 1], [-0.6, -1.2, 0.75], [0.6, -1.25, 0.75], [0.2, -2.1, 0.7]]) { g.fillStyle = col; g.beginPath(); g.arc(xx + s * 1.4 + dx * s, y + dy * s, r * s, 0, TAU); g.fill(); } g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(xx + s * 1.3, y - 2 * s, 0.45 * s, 0, TAU); g.fill(); });
  const GR = ['#4f8a3c', '#5e9a44', '#3f7a35', '#6aa84f', '#77ad4c'];
  const wires = (g, ys) => { g.strokeStyle = 'rgba(40,40,45,0.7)'; g.lineWidth = 0.7; for (const y of ys) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } };
  const pole = (g, x, top, base) => wrap(x - 3, 6, (xx) => { g.fillStyle = '#b9b8b2'; g.fillRect(xx + 2, top, 2, base - top); g.fillStyle = '#5f6166'; g.fillRect(xx - 3, top + 3, 12, 1.5); });
  const scooter = (g, x, y) => wrap(x - 6, 12, (xx) => { g.fillStyle = pick(R, ['#f2f3f5', '#d0342c', '#2f6fd6', '#1d1f23', '#f2c230']); g.fillRect(xx - 5, y - 5, 10, 4); g.fillStyle = '#222'; g.beginPath(); g.arc(xx - 3.5, y - 1, 1.6, 0, TAU); g.arc(xx + 3.5, y - 1, 1.6, 0, TAU); g.fill(); });
  const street = (g, w, h, alt) => {
    sky(g, h); ridge(g, HZ - 4, 16, '#a9c4ae', 1.3 + alt); ridge(g, HZ + 2, 12, '#8fb39a', 2.1 + alt);
    for (let i = 0; i < 3; i++) tree(g, R() * W, HZ + 12, 5 + R() * 2, pick(R, GR));
    houseRow(g, HZ + 12, 2, 4, 0.95);
    g.fillStyle = '#d9d9d4'; g.fillRect(0, HZ + 12, W, 4); // 騎樓前的水泥地
    for (let i = 0; i < 4; i++) scooter(g, R() * W, HZ + 15);
    g.fillStyle = '#7a7c80'; g.fillRect(0, HZ + 16, W, h - HZ - 16); speck(g, R, 0, HZ + 16, W, h - HZ - 16, 500, () => (R() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'), 1.4);
    g.fillStyle = '#f1f1ec'; for (let x = 0; x < W; x += 31) g.fillRect(x, HZ + 30, 16, 1.6); g.fillStyle = '#e9c23a'; g.fillRect(0, HZ + 45, W, 1.4);
    pole(g, 40 + alt * 90, HZ - 34, HZ + 14); wires(g, [HZ - 31, HZ - 28, HZ - 25]);
    g.fillStyle = '#d2d2cd'; g.fillRect(0, h - 10, W, 10); // 自己家門口的地
  };
  V('street', 0, (g, w, h) => street(g, w, h, 0));
  V('street2', 1, (g, w, h) => street(g, w, h, 1));
  V('green', 2, (g, w, h) => { // 後院：樹、竹子、隔壁的後牆（水管、小窗）、曬衣服、盆栽
    sky(g, h, '#79b8ec', '#e0f0f8'); ridge(g, HZ - 8, 20, '#98b8a0', 0.7);
    g.fillStyle = '#e4e2dc'; g.fillRect(150, HZ - 30, 70, 50); g.fillStyle = '#4a5d6e'; g.fillRect(165, HZ - 20, 14, 10); g.fillStyle = '#9aa0a6'; g.fillRect(200, HZ - 30, 2, 50);
    for (let i = 0; i < 9; i++) tree(g, (i / 9) * W + R() * 12, HZ + 14 + R() * 8, 7 + R() * 5, pick(R, GR));
    for (let i = 0; i < 5; i++) { const x = 90 + i * 6; g.strokeStyle = '#8fae4a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, HZ + 30); g.quadraticCurveTo(x + 3, HZ - 10, x + 8, HZ - 30); g.stroke(); g.fillStyle = '#6f9e3a'; g.beginPath(); g.ellipse(x + 8, HZ - 28, 7, 10, 0.3, 0, TAU); g.fill(); }
    g.fillStyle = '#6aa84f'; g.fillRect(0, HZ + 18, W, h - HZ - 18); speck(g, R, 0, HZ + 18, W, h - HZ - 18, 500, () => (R() < 0.5 ? 'rgba(30,60,20,0.2)' : 'rgba(200,230,150,0.2)'), 2);
    g.strokeStyle = '#888'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(10, HZ + 2); g.lineTo(80, HZ); g.stroke();
    for (let i = 0; i < 5; i++) { g.fillStyle = pick(R, ['#e0453a', '#3b8fd9', '#f2f2f0', '#f2c230', '#f07aa8']); g.fillRect(16 + i * 12, HZ + 1, 8, 12); }
    for (let i = 0; i < 6; i++) { const x = 20 + i * 38 + R() * 10; g.fillStyle = '#b5694a'; g.fillRect(x, h - 22, 10, 8); g.fillStyle = pick(R, GR); g.beginPath(); g.arc(x + 5, h - 24, 7, 0, TAU); g.fill(); }
    g.fillStyle = '#c9c7c0'; g.fillRect(0, h - 14, W, 14);
  });
  V('roofs', 3, (g, w, h) => { // 樓上看出去：一片屋頂（水塔、鐵皮加蓋、天線）、遠山
    sky(g, h, '#68abe8', '#d6ebf8'); ridge(g, HZ - 2, 22, '#9fbfaa', 0.4); ridge(g, HZ + 4, 14, '#86ad93', 2.9);
    houseRow(g, HZ + 40, 3, 4, 1.05);
    for (let i = 0; i < 6; i++) { const x = R() * W, y = HZ + 8 + R() * 16; wrap(x, 30, (xx) => { g.fillStyle = pick(R, ['#3b78c4', '#e07a3a', '#e8eaec', '#4c9a6a']); g.beginPath(); g.moveTo(xx, y); g.lineTo(xx + 26, y - 3); g.lineTo(xx + 28, y + 8); g.lineTo(xx + 2, y + 10); g.fill(); g.fillStyle = 'rgba(255,255,255,0.3)'; for (let k = 2; k < 26; k += 3) g.fillRect(xx + k, y - 2, 0.8, 11); }); }
    g.fillStyle = '#bdbcb6'; g.fillRect(0, HZ + 40, W, h - HZ - 40); g.fillStyle = '#a5a49e'; g.fillRect(0, HZ + 40, W, 2);
    wires(g, [HZ + 20, HZ + 23]); tree(g, 60, HZ + 50, 9, GR[1]); tree(g, 190, HZ + 55, 8, GR[3]);
  });
  V('temple', 4, (g, w, h) => { // 廟埕：花崗石地、大榕樹、石獅、香爐，遠一點是大路和對面的房子
    sky(g, h, '#6fb0ea', '#dcedf8'); ridge(g, HZ - 2, 14, '#a3c1ab', 1.9);
    houseRow(g, HZ + 6, 2, 3, 0.7);
    g.fillStyle = '#6d6f73'; g.fillRect(0, HZ + 6, W, 7);
    g.fillStyle = '#e3dccf'; g.fillRect(0, HZ + 13, W, h - HZ - 13); g.fillStyle = 'rgba(120,110,95,0.25)'; for (let y = HZ + 16; y < h; y += 6) g.fillRect(0, y, W, 0.8); for (let x = 0; x < W; x += 14) g.fillRect(x, HZ + 13, 0.8, h);
    g.fillStyle = '#6e5a4a'; g.fillRect(186, HZ - 20, 12, 50); for (const [dx, dy, r] of [[0, -46, 34], [-26, -34, 24], [26, -36, 26], [0, -64, 22]]) { g.fillStyle = '#3f6e33'; g.beginPath(); g.arc(192 + dx, HZ + dy, r, 0, TAU); g.fill(); }
    g.strokeStyle = '#7a6655'; g.lineWidth = 0.8; for (let i = 0; i < 10; i++) { const x = 168 + i * 5; g.beginPath(); g.moveTo(x, HZ - 20); g.lineTo(x, HZ + 12); g.stroke(); }
    g.fillStyle = '#8d6a36'; g.fillRect(118, HZ + 8, 14, 14); g.beginPath(); g.ellipse(125, HZ + 8, 10, 4, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(230,230,230,0.6)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(125 + Math.sin(k) * 3, HZ - 2 - k * 6, 3 + k, 0, TAU); g.fill(); }
    for (const x of [70, 176]) { g.fillStyle = '#9d988e'; g.fillRect(x - 6, HZ + 20, 12, 10); g.fillStyle = '#a6a196'; g.beginPath(); g.arc(x, HZ + 16, 6, 0, TAU); g.fill(); }
  });
  V('court', 5, (g, w, h) => { // 三合院的禾埕：紅磚地、兩邊護龍（紅磚牆、紅瓦）、前面的樹和田
    sky(g, h, '#72b3ea', '#e0f0f9'); ridge(g, HZ - 3, 16, '#9dbda6', 0.9);
    for (let i = 0; i < 6; i++) tree(g, 70 + i * 22 + R() * 6, HZ + 8, 7 + R() * 4, pick(R, GR));
    g.fillStyle = '#9ccf5a'; g.fillRect(60, HZ + 6, 130, 8);
    for (const [x0, x1, dir] of [[0, 62, 1], [186, W, -1]]) { // 護龍
      g.fillStyle = '#a4513b'; g.fillRect(x0, HZ - 26, x1 - x0, 48); g.fillStyle = 'rgba(214,202,184,0.6)'; for (let y = HZ - 26; y < HZ + 22; y += 4) g.fillRect(x0, y, x1 - x0, 0.7);
      g.fillStyle = '#4a1c12'; g.beginPath(); g.moveTo(x0 - 4, HZ - 26); g.lineTo(x1 + 4, HZ - 26); g.lineTo(x1 + 4 - dir * 0, HZ - 38); g.lineTo(x0 - 4, HZ - 38); g.fill(); g.fillStyle = '#9c3f2b'; for (let x = x0; x < x1; x += 4) g.fillRect(x, HZ - 37, 2, 10);
      const dx = dir > 0 ? x1 - 30 : x0 + 12; g.fillStyle = '#5a3a22'; g.fillRect(dx, HZ - 10, 16, 32); g.fillStyle = '#6a4a36'; g.fillRect(dx - 22 * dir + (dir < 0 ? 0 : 0), HZ - 12, 12, 10);
    }
    g.fillStyle = '#b5694a'; g.fillRect(0, HZ + 22, W, h - HZ - 22); g.fillStyle = 'rgba(210,190,165,0.6)'; for (let y = HZ + 24; y < h; y += 5) g.fillRect(0, y, W, 0.8); for (let x = 0; x < W; x += 9) g.fillRect(x, HZ + 22, 0.8, h);
    g.fillStyle = 'rgba(232,200,90,0.9)'; g.fillRect(80, HZ + 34, 90, 22); speck(g, R, 80, HZ + 34, 90, 22, 200, 'rgba(180,140,40,0.5)', 1.5); // 曬穀
  });
  V('field', 6, (g, w, h) => { // 稻田、遠山、農路
    sky(g, h, '#6aaee9', '#dfeff9'); ridge(g, HZ - 6, 22, '#9dbfa8', 2.4); ridge(g, HZ + 2, 12, '#7fa688', 0.2);
    for (let i = 0; i < 5; i++) tree(g, R() * W, HZ + 4, 4 + R() * 3, pick(R, GR));
    for (let y = HZ + 4, k = 0; y < h; y += 3 + k * 0.6, k++) { g.fillStyle = k % 2 ? '#8fcf4a' : '#a2dc5c'; g.fillRect(0, y, W, 3 + k * 0.6); }
    g.fillStyle = '#d8d2c0'; g.beginPath(); g.moveTo(100, HZ + 4); g.lineTo(112, HZ + 4); g.lineTo(150, h); g.lineTo(96, h); g.fill();
  });
  V('sky', 7, (g, w, h) => { sky(g, h, '#63a8e6', '#d9ecf8'); ridge(g, HZ + 6, 18, '#9fbfaa', 1.1); for (let i = 0; i < 10; i++) tree(g, (i / 10) * W + R() * 10, h - 8, 10 + R() * 6, pick(R, GR)); });
  return S;
}
function mixHex(a, b, t) { const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16); const f = (s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t); return `rgb(${f(16)},${f(8)},${f(0)})`; }
// 家具底下的軟影子（64²，黑色、alpha 從中間往外淡）
// 家具底下的軟影子（64²）：一個方塊的邊慢慢淡掉；自己算像素（不用 shadowBlur：有的 GPU canvas 很慢）
function blobCanvas() {
  const [c, g] = cv(64, 64), im = g.createImageData && g.createImageData(64, 64); if (!im || !im.data) return c;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const dx = Math.max(Math.abs(x + 0.5 - 32) - 12, 0), dy = Math.max(Math.abs(y + 0.5 - 32) - 12, 0), d = Math.sqrt(dx * dx + dy * dy); im.data[(y * 64 + x) * 4 + 3] = Math.round(255 * Math.exp(-(d * d) / 72)); }
  g.putImageData(im, 0, 0); return c;
}

// ---- 共用的：貼圖、材質、環境貼圖（第一次蓋的時候做，之後每一棟都用同一份）----
let SH = null;
const DFL = {}; // 每個材質「單色的面」用的 uv
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
function shared(renderer, quality) {
  if (!SH) {
    const t0 = now(), R = rng(20260928), tk = [t0], lap = (v) => (tk.push(now()), v), sa = lap(surfAtlas(R)), pa = lap(propAtlas(R)), ga = lap(glowAtlas(R)), va = lap(viewAtlas(R));
    const tg = now(), aniso = 8, glMs = now() - tg; // anisotropy 直接給 8（three.js 上傳貼圖的時候自己跟 GPU 的上限取小的）：不在這裡問 GL（getParameter 會等 GPU 做完手上的事：測試機的 SwiftShader 在這裡卡過 5～17 秒）
    const tex = (c, a = aniso) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = a; return t; };
    SH = { tex: { S: tex(sa.c), P: tex(pa.c), G: tex(ga.c), V: tex(va.c), B: tex(blobCanvas(), 1) }, uv: { S: sa.uv, P: pa.uv, G: ga.uv, V: va.uv }, mats: {}, env: null, envTried: false, ms: { atlas: +(now() - t0).toFixed(1), sheets: tk.slice(1).map((t, i) => +(t - tk[i]).toFixed(1)), gl: +glMs.toFixed(1) } }; // sheets：牆地板、家具、發光、窗景 四張各畫了幾毫秒；gl：問 anisotropy
    const sw = dotUV(sa.uv.white), pw = dotUV(pa.uv.white), gw = dotUV(ga.uv.s_white);
    Object.assign(DFL, { wall: sw, floor: sw, prop: pw, shiny: pw, metal: pw, cut: pw, glow: gw, view: dotUV(va.uv.sky), shadow: [0, 0, 1, 1] });
  }
  if (renderer && !SH.envTried) {
    SH.envTried = true;
    const t1 = now(); try { SH.env = makeEnv(renderer); } catch (e) { SH.env = null; } SH.ms.env = +(now() - t1).toFixed(1);
    for (const ms of Object.values(SH.mats)) for (const m of Object.values(ms)) if (m.isMeshStandardMaterial && SH.env) { m.envMap = SH.env.texture; if (m.userData.metal) m.metalness = 0.8; m.needsUpdate = true; }
  }
  const key = quality === 'low' ? 'low' : 'high';
  if (!SH.mats[key]) SH.mats[key] = makeMats(key);
  return SH;
}
// 反射用的環境：一間房間（牆、地板暗暗的）＋兩片亮窗＋天花板一條燈（全部房子共用一張 PMREM）
function makeEnv(renderer) {
  const s = new THREE.Scene(), trash = [];
  const add = (geo, col, set) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), side: THREE.DoubleSide })); set(m); s.add(m); trash.push(m); };
  add(new THREE.BoxGeometry(10, 3.2, 10), [0.52, 0.5, 0.46], (m) => { m.position.y = 1.6; m.material.side = THREE.BackSide; });
  add(new THREE.PlaneGeometry(10, 10), [0.36, 0.33, 0.29], (m) => { m.rotation.x = -HP; m.position.y = 0.01; });
  add(new THREE.PlaneGeometry(2.4, 1.6), [4.2, 4.6, 5], (m) => m.position.set(0, 1.6, -4.95));
  add(new THREE.PlaneGeometry(1.6, 1.4), [3.6, 3.9, 4.2], (m) => { m.position.set(4.95, 1.5, 1); m.rotation.y = -HP; });
  add(new THREE.PlaneGeometry(1.5, 0.3), [8, 7.6, 7], (m) => { m.rotation.x = HP; m.position.set(0, 3.15, 0); });
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(s, 0.02); pm.dispose();
  for (const m of trash) { m.geometry.dispose(); m.material.dispose(); }
  return rt;
}
function makeMats(key) {
  const { S, P, G, V, B } = SH.tex, env = SH.env ? SH.env.texture : null, hi = key === 'high';
  const lam = (map, o = {}) => new THREE.MeshLambertMaterial({ map, vertexColors: true, ...o });
  const std = (map, o) => (hi ? new THREE.MeshStandardMaterial({ map, vertexColors: true, envMap: env, ...o }) : lam(map));
  const metal = hi ? new THREE.MeshStandardMaterial({ map: P, vertexColors: true, envMap: env, roughness: 0.34, metalness: env ? 0.8 : 0.3, envMapIntensity: 1 }) : lam(P);
  metal.userData.metal = true;
  const M = {
    wall: lam(S), floor: std(S, { roughness: 0.3, metalness: 0, envMapIntensity: 0.4 }), prop: lam(P), shiny: std(P, { roughness: 0.34, metalness: 0, envMapIntensity: 0.45 }), metal,
    cut: lam(P, { alphaTest: 0.5, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ map: G, vertexColors: true }),
    view: new THREE.MeshBasicMaterial({ map: V, vertexColors: true, fog: false }),
    shadow: new THREE.MeshBasicMaterial({ map: B, color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
  };
  for (const [k, m] of Object.entries(M)) m.name = 'int-' + k;
  return M;
}
function disposeInteriorCache() {
  if (!SH) return;
  for (const t of Object.values(SH.tex)) t.dispose();
  for (const ms of Object.values(SH.mats)) for (const m of Object.values(ms)) m.dispose();
  if (SH.env) SH.env.dispose();
  SH = null;
}

// ---- 網格：同一層、同一個材質的東西併成一個；頂點色＝顏色 × 陰影（牆腳、牆角、天花板邊暗一點，窗邊亮一點）----
const SHADE = new Set(['wall', 'floor', 'prop', 'shiny', 'metal', 'cut']);
const ORDER = { cut: 1, glow: 1, view: 0, shadow: 2 };
// 會長大的 Float32Array（少一點垃圾回收，最後直接給 BufferAttribute）
class FA { constructor(n) { this.a = new Float32Array(n); this.n = 0; } room(k) { if (this.n + k > this.a.length) { const b = new Float32Array(Math.max(this.a.length * 2, this.n + k)); b.set(this.a.subarray(0, this.n)); this.a = b; } return this.a; } done() { return this.a.slice(0, this.n); } }
class IB {
  constructor() { this.bins = new Map(); this.tris = 0; this.sh = null; this._m = null; this._g = null; }
  _bin(m) { if (m === this._m) return this._g; let g = this.bins.get(m); if (!g) this.bins.set(m, (g = { p: new FA(4608), n: new FA(4608), u: new FA(3072), c: new FA(4608), s: SHADE.has(m) })); this._m = m; this._g = g; return g; }
  tri(m, a, b, c, ta, tb, tc, ca, cb = ca, cc = ca) { this._t(m, a, b, c, ta[0], ta[1], tb[0], tb[1], tc[0], tc[1], ca, cb, cc); }
  // 內部：uv 直接傳數字（不要每個三角形都做小陣列）
  _t(m, a, b, c, u0, v0, u1, v1, u2, v2, ca, cb, cc) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.sqrt(nx * nx + ny * ny + nz * nz); if (l < 1e-12) return;
    nx /= l; ny /= l; nz /= l;
    const g = this._bin(m);
    let A = g.p.room(9), i = g.p.n; A[i] = a[0]; A[i + 1] = a[1]; A[i + 2] = a[2]; A[i + 3] = b[0]; A[i + 4] = b[1]; A[i + 5] = b[2]; A[i + 6] = c[0]; A[i + 7] = c[1]; A[i + 8] = c[2]; g.p.n = i + 9;
    A = g.n.room(9); i = g.n.n; A[i] = A[i + 3] = A[i + 6] = nx; A[i + 1] = A[i + 4] = A[i + 7] = ny; A[i + 2] = A[i + 5] = A[i + 8] = nz; g.n.n = i + 9;
    A = g.u.room(6); i = g.u.n; A[i] = u0; A[i + 1] = v0; A[i + 2] = u1; A[i + 3] = v1; A[i + 4] = u2; A[i + 5] = v2; g.u.n = i + 6;
    const sh = g.s ? this.sh : null, ka = sh ? sh(a[0], a[1], a[2], nx, ny, nz) : 1, kb = sh ? sh(b[0], b[1], b[2], nx, ny, nz) : 1, kc = sh ? sh(c[0], c[1], c[2], nx, ny, nz) : 1;
    A = g.c.room(9); i = g.c.n; A[i] = ca[0] * ka; A[i + 1] = ca[1] * ka; A[i + 2] = ca[2] * ka; A[i + 3] = cb[0] * kb; A[i + 4] = cb[1] * kb; A[i + 5] = cb[2] * kb; A[i + 6] = cc[0] * kc; A[i + 7] = cc[1] * kc; A[i + 8] = cc[2] * kc; g.c.n = i + 9;
    this.tris++;
  }
  // a b c d：左下、右下、右上、左上（從正面看）；uv＝[u0, v0, u1, v1]
  quad(m, a, b, c, d, uv, col) { const u0 = uv[0], v0 = uv[1], u1 = uv[2], v1 = uv[3]; this._t(m, a, b, c, u0, v0, u1, v0, u1, v1, col, col, col); this._t(m, a, c, d, u0, v0, u1, v1, u0, v1, col, col, col); }
  build(mats) {
    const group = new THREE.Group(); let draws = 0;
    for (const [m, g] of this.bins) {
      if (!g.p.n) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(g.p.done(), 3)); geo.setAttribute('normal', new THREE.BufferAttribute(g.n.done(), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(g.u.done(), 2)); geo.setAttribute('color', new THREE.BufferAttribute(g.c.done(), 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mats[m]); mesh.name = 'int-' + m; mesh.renderOrder = ORDER[m] || 0; mesh.matrixAutoUpdate = false;
      group.add(mesh); draws++;
    }
    return { group, draws };
  }
}
// 這一層的陰影：rooms＝[{ x0, x1, z0, z1, h }]（本地）、wins＝[{ x, z, k }]（窗、門口：附近亮一點）
function makeShade(Fl) {
  const rooms = Fl.rooms, wins = Fl.wins, nr = rooms.length, nw = wins.length;
  return (x, y, z, nx, ny, nz) => {
    let s = 1, r = null;
    for (let i = 0; i < nr; i++) { const q = rooms[i]; if (x >= q.x0 - 0.03 && x <= q.x1 + 0.03 && z >= q.z0 - 0.03 && z <= q.z1 + 0.03) { r = q; break; } }
    const vert = ny < 0.5 && ny > -0.5;
    if (vert) s *= 1 - 0.34 * Math.exp(-Math.max(0, y) / 0.26); // 牆腳、家具下面
    if (r) {
      const dx = Math.min(x - r.x0, r.x1 - x), dz = Math.min(z - r.z0, r.z1 - z), dw = Math.max(0, Math.min(dx, dz));
      if (ny >= 0.5) s *= y < 0.05 ? 1 - 0.32 * Math.exp(-dw / 0.28) : 1 - 0.12 * Math.exp(-dw / 0.2); // 地板靠牆暗；桌面、床靠牆一點點
      else if (ny <= -0.5) s *= 1 - 0.26 * Math.exp(-dw / 0.38);
      else { const along = Math.abs(nx) > 0.5 ? dz : dx; s *= (1 - 0.16 * Math.exp(-Math.max(0, r.h - y) / 0.22)) * (1 - 0.24 * Math.exp(-Math.max(0, along) / 0.34)); }
    }
    for (let i = 0; i < nw; i++) { const w = wins[i], ex = x - w.x, ez = z - w.z; if (ex > 6 || ex < -6 || ez > 6 || ez < -6) continue; const d = Math.sqrt(ex * ex + ez * ez); if (d < 6) s *= 1 + w.k * Math.exp(-d / 1.7); }
    return s;
  };
}

// ---- 基本形狀（本地座標；T＝frame）----
// 方塊：bx＝[x0, y0, z0, x1, y1, z1]；col：顏色或 { pz, nz, px, nx, py, ny, _ }；uv：一個區塊（全部的面）或 { 同上 }（false＝不要那一面；ny 要寫才有）
function box(B, m, T, bx, col, uv = {}) {
  const [x0, y0, z0, x1, y1, z1] = bx, P = T.p, d = DFL[m], U = Array.isArray(uv) ? { _: uv } : uv;
  const f = (k, a, b, c, e) => { const u = U[k] !== undefined ? U[k] : U._; if (u === false) return; const cc = Array.isArray(col) ? col : col[k] || col._ || WHITE; B.quad(m, P(...a), P(...b), P(...c), P(...e), u || d, cc); };
  f('pz', [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); f('nz', [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
  f('px', [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]); f('nx', [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
  f('py', [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
  if (U.ny !== undefined && U.ny !== false) f('ny', [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
}
// 直立的面：本地 (ax, az) → (bx, bz)（正面看左到右）、y0–y1
function vq(B, m, T, a, b, y0, y1, uv, col = WHITE, both = false) {
  B.quad(m, T.p(a[0], y0, a[1]), T.p(b[0], y0, b[1]), T.p(b[0], y1, b[1]), T.p(a[0], y1, a[1]), uv, col);
  if (both) B.quad(m, T.p(b[0], y0, b[1]), T.p(a[0], y0, a[1]), T.p(a[0], y1, a[1]), T.p(b[0], y1, b[1]), [uv[2], uv[1], uv[0], uv[3]], col);
}
// 水平的面（朝上 up＝true：地板、桌面；朝下：天花板）
function hq(B, m, T, x0, z0, x1, z1, y, uv, col = WHITE, up = true) {
  if (up) B.quad(m, T.p(x0, y, z1), T.p(x1, y, z1), T.p(x1, y, z0), T.p(x0, y, z0), uv, col); else B.quad(m, T.p(x0, y, z0), T.p(x1, y, z0), T.p(x1, y, z1), T.p(x0, y, z1), uv, col);
}
// 直的圓柱（本地）：底 (x, y0, z)、高到 y1、半徑 r0→r1、n 邊；uv 包一圈；cap：上面蓋起來
function cyl(B, m, T, x, z, y0, y1, r0, r1, n, col, uv = null, cap = true, a0 = 0) {
  const P = (a, r, y) => T.p(x + Math.cos(a) * r, y, z - Math.sin(a) * r), d = DFL[m], u = uv || d;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU, b = a0 + ((i + 1) / n) * TAU, ua = u[0] + ((u[2] - u[0]) * i) / n, ub = u[0] + ((u[2] - u[0]) * (i + 1)) / n;
    if (r1 > 0) B.quad(m, P(a, r0, y0), P(b, r0, y0), P(b, r1, y1), P(a, r1, y1), [ua, u[1], ub, u[3]], col);
    else B.tri(m, P(a, r0, y0), P(b, r0, y0), T.p(x, y1, z), [ua, u[1]], [ub, u[1]], [(ua + ub) / 2, u[3]], col);
    if (cap && r1 > 0) B.tri(m, T.p(x, y1, z), P(a, r1, y1), P(b, r1, y1), d.slice(0, 2), d.slice(0, 2), d.slice(0, 2), col);
  }
}
// 兩點之間的管子（本地座標的點）
function tube(B, m, a, b, r0, r1, n, col, uv = null, cap = false) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d); d[0] /= L; d[1] /= L; d[2] /= L;
  const up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let e1 = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; const l1 = Math.hypot(...e1); e1 = e1.map((v) => v / l1);
  const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]];
  const P = (o, t, r) => { const c = Math.cos(t) * r, s = Math.sin(t) * r; return [o[0] + e1[0] * c + e2[0] * s, o[1] + e1[1] * c + e2[1] * s, o[2] + e1[2] * c + e2[2] * s]; };
  const u = uv || DFL[m], u0 = DFL[m];
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * TAU, t1 = ((i + 1) / n) * TAU, ua = u[0] + ((u[2] - u[0]) * i) / n, ub = u[0] + ((u[2] - u[0]) * (i + 1)) / n;
    B.quad(m, P(a, t0, r0), P(a, t1, r0), P(b, t1, r1), P(b, t0, r1), [ua, u[1], ub, u[3]], col);
    if (cap) { B.tri(m, b, P(b, t0, r1), P(b, t1, r1), u0, u0, u0, col); B.tri(m, a, P(a, t1, r0), P(a, t0, r0), u0, u0, u0, col); }
  }
}
// 球（橢球）：中心、半徑；nu × nv 格；uv 包一圈
function ball(B, m, T, cx, cy, cz, rx, ry, rz, col, uv = null, nu = 8, nv = 5) {
  const u = uv || DFL[m], P = (i, j) => { const a = (i / nu) * TAU, b = (j / nv) * Math.PI - HP; return T.p(cx + Math.cos(a) * Math.cos(b) * rx, cy + Math.sin(b) * ry, cz - Math.sin(a) * Math.cos(b) * rz); };
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const ua = u[0] + ((u[2] - u[0]) * i) / nu, ub = u[0] + ((u[2] - u[0]) * (i + 1)) / nu, va = u[1] + ((u[3] - u[1]) * j) / nv, vb = u[1] + ((u[3] - u[1]) * (j + 1)) / nv;
    B.quad(m, P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1), [ua, va, ub, vb], col);
  }
}
// 一片會接起來的面（地板、牆、天花板）：原點 o、方向 u、v（u × v＝正面）、長 lu × lv；reg＝貼圖區塊、per＝一格幾公尺（[pu, pv]，null＝整片貼一張）
// cu、cv：多切幾刀（本地的長度，陰影才有層次）；uo、vo：貼圖的起點（整面牆、整個房子的磚才對得齊）
function plane(B, m, o, u, v, lu, lv, reg, per, col, cu = [], cvv = [], uo = 0, vo = 0) {
  const cuts = (L, p, extra, off) => {
    const s = [0, L];
    if (p) for (let k = Math.ceil((off + 1e-6) / p) * p - off; k < L - 1e-4; k += p) s.push(k);
    for (const e of extra) if (e > 1e-3 && e < L - 1e-3) s.push(e);
    s.sort((a, b) => a - b); return s.filter((x, i) => !i || x - s[i - 1] > 1e-3);
  };
  const U = cuts(lu, per && per[0], cu, uo), W = cuts(lv, per && per[1], cvv, vo);
  const P = (s, t) => [o[0] + u[0] * s + v[0] * t, o[1] + u[1] * s + v[1] * t, o[2] + u[2] * s + v[2] * t];
  const fr = (a, b, p) => { const k = Math.floor(a / p + 1e-6); return [a / p - k, b / p - k]; };
  for (let i = 0; i < U.length - 1; i++) for (let j = 0; j < W.length - 1; j++) {
    const s0 = U[i], s1 = U[i + 1], t0 = W[j], t1 = W[j + 1];
    let uv;
    if (per) { const a = fr(s0 + uo, s1 + uo, per[0]), b = fr(t0 + vo, t1 + vo, per[1]); uv = subUV(reg, a[0], b[0], a[1], b[1]); }
    else uv = subUV(reg, s0 / lu, t0 / lv, s1 / lu, t1 / lv);
    B.quad(m, P(s0, t0), P(s1, t0), P(s1, t1), P(s0, t1), uv, col);
  }
}
const aoCuts = (L) => [0.12, 0.35, 0.8, L - 0.8, L - 0.35, L - 0.12]; // 靠邊多切幾刀（陰影）

// ---- 一層樓：房間、牆（門窗的洞）、地板、天花板、窗外的景、燈 ----
const SU = (n) => SH.uv.S[n], PU = (n) => SH.uv.P[n], GU = (n) => SH.uv.G[n], VU = (n) => SH.uv.V[n];
const col3 = (c) => (typeof c === 'string' ? C(c) : c || WHITE);
// 表面：r＝surfAtlas 的名字、c＝顏色、m＝材質；wain＝下半截另一種（廚房、浴室的壁磚）{ h, s }；skirt＝踢腳板的顏色
const sf = (r, c = WHITE, m = 'wall', o = {}) => ({ r, c: col3(c), m, ...o });
function newFloor(o = {}) {
  return { B: new IB(), ch: o.ch ?? CH, rooms: [], named: [], wins: [], walls: [], cols: [], exits: [], lamps: [], views: [], slabs: [],
    spots: { stand: [], sit: [], sleep: [], pray: [], counter: [] }, sun: null, hemi: null, index: o.index || 0, label: o.label || '1F', cam: o.cam || null };
}
// 房間：陰影用（每個房間都要），name 有的話對外（rooms）；floor／ceil：地板、天花板的表面（null 不畫）
function room(F, name, x0, x1, z0, z1, o = {}) {
  const r = { x0, x1, z0, z1, h: o.h ?? F.ch };
  F.rooms.push(r);
  if (name) F.named.push({ name, x0, x1, z0, z1, probe: o.probe || [(x0 + x1) / 2, (z0 + z1) / 2] });
  if (o.floor || o.ceil) F.slabs.push({ x0, x1, z0, z1, h: r.h, floor: o.floor, ceil: o.ceil, y: o.y ?? 0 });
  return r;
}
// 牆（資料，ready() 的時候才畫）：ax 'x'＝沿 x 的牆（面朝 ±z），c＝牆中心線的 z；ax 'z'＝沿 z（面朝 ±x），c＝x
//   s0–s1：沿牆的範圍；t 厚、h 高；p／n：正面（+z 或 +x 那面）／反面的表面（null＝不畫：外牆的外面）
//   ops：洞 [{ a, b, y0, y1, k, ... }]：k＝win 窗｜door 大門（開著）｜idoor 房門（開著）｜closed 關著的門｜open 開口｜shutter 關著的鐵捲門｜glass 大片玻璃｜balc 陽台落地門（關著）
//   out：外牆朝外是 +1（+z／+x）還是 −1；view：窗外的景（名字）、voff：景的位移
function wall(F, ax, c, s0, s1, o = {}) { const w = { ax, c, s0, s1, t: 0.12, h: F.ch, ops: [], p: null, n: null, col: true, ...o }; F.walls.push(w); return w; }
const PASS = new Set(['door', 'idoor', 'open']);
const LIT = new Set(['win', 'door', 'open', 'glass', 'balc']);
// 牆上的點（沿牆 s、牆的法線方向 n）→ 本地 [x, z]
const WP = (w, s, n) => (w.ax === 'x' ? [s, n] : [n, s]);
// 直立的面：A→B（本地 xz），法線要朝 (nx, nz)（不對就反過來）
function vqN(B, m, A, Bp, y0, y1, nx, nz, uv, col) {
  const dx = Bp[0] - A[0], dz = Bp[1] - A[1];
  if (-dz * nx + dx * nz < 0) vq(B, m, F0, Bp, A, y0, y1, [uv[2], uv[1], uv[0], uv[3]], col); else vq(B, m, F0, A, Bp, y0, y1, uv, col);
}
// 陰影：牆、窗準備好之後才能蓋東西
function ready(F) {
  for (const w of F.walls) if (w.out) for (const o of w.ops) if (LIT.has(o.k)) {
    const m = (o.a + o.b) / 2, [x, z] = WP(w, m, w.c - w.out * 0.6);
    F.wins.push({ x, z, k: o.k === 'win' ? 0.16 : o.k === 'glass' ? 0.1 : 0.22 });
  }
  F.B.sh = makeShade(F);
  for (const s of F.slabs) slab(F, s);
  for (const w of F.walls) drawWall(F, w);
}
function slab(F, s) {
  const lx = s.x1 - s.x0, lz = s.z1 - s.z0;
  if (s.floor) { const f = s.floor; plane(F.B, f.m === 'wall' ? 'floor' : f.m, [s.x0, s.y, s.z1], [1, 0, 0], [0, 0, -1], lx, lz, SU(f.r), PER[f.r], f.c, aoCuts(lx), aoCuts(lz), s.x0, -s.z1); }
  if (s.ceil) { const f = s.ceil; plane(F.B, f.m === 'floor' ? 'wall' : f.m, [s.x0, s.y + s.h, s.z0], [1, 0, 0], [0, 0, 1], lx, lz, SU(f.r), PER[f.r], f.c, aoCuts(lx), aoCuts(lz), s.x0, s.z0); }
}
// 牆面的一塊：面在 n＝fc、朝 side（+1／−1）、沿牆 a–b、高 y0–y1
function wallFace(F, w, fc, side, a, b, y0, y1, s) {
  if (b - a < 1e-3 || y1 - y0 < 1e-3) return;
  const wn = s.wain;
  if (wn && y0 < wn.h - 1e-3 && y1 > wn.h + 1e-3) { wallFace(F, w, fc, side, a, b, y0, wn.h, s); wallFace(F, w, fc, side, a, b, wn.h, y1, s); return; }
  const f = wn && y1 <= wn.h + 1e-3 ? wn.s : s, L = b - a, H = y1 - y0;
  const cv = [0.08, 0.25, 0.6, F.ch - 0.6, F.ch - 0.25, F.ch - 0.08].map((y) => y - y0).filter((y) => y > 0.02 && y < H - 0.02);
  let o, u;
  if (w.ax === 'x') { if (side > 0) { o = [a, y0, fc]; u = [1, 0, 0]; } else { o = [b, y0, fc]; u = [-1, 0, 0]; } }
  else if (side > 0) { o = [fc, y0, b]; u = [0, 0, -1]; } else { o = [fc, y0, a]; u = [0, 0, 1]; }
  const uo = side > 0 === (w.ax === 'x') ? a : -b;
  plane(F.B, f.m, o, u, [0, 1, 0], L, H, SU(f.r), PER[f.r], f.c, aoCuts(L), cv, uo, y0);
  if (s.skirt && y0 < 1e-3 && !(wn && wn.s.noSkirt)) { // 踢腳板
    const n = fc + side * 0.012, A = WP(w, a, n), Bp = WP(w, b, n), nx = w.ax === 'z' ? side : 0, nz = w.ax === 'x' ? side : 0;
    vqN(F.B, 'prop', A, Bp, 0, 0.09, nx, nz, DFL.prop, s.skirt);
    const A2 = WP(w, a, fc), B2 = WP(w, b, fc); // 上緣
    F.B.quad('prop', [A2[0], 0.09, A2[1]], [Bp[0], 0.09, Bp[1]], [B2[0], 0.09, B2[1]], [A[0], 0.09, A[1]], DFL.prop, s.skirt);
  }
}
function drawWall(F, w) {
  const t = w.t, h = w.h, ops = w.ops.slice().sort((p, q) => p.a - q.a), B = F.B;
  for (const side of [1, -1]) {
    const s = side > 0 ? w.p : w.n; if (!s) continue;
    const fc = w.c + (side * t) / 2; let cur = w.s0;
    for (const o of ops) {
      wallFace(F, w, fc, side, cur, o.a, 0, h, s);
      if (o.y0 > 0) wallFace(F, w, fc, side, o.a, o.b, 0, o.y0, s);
      if (o.y1 < h) wallFace(F, w, fc, side, o.a, o.b, o.y1, h, s);
      cur = o.b;
    }
    wallFace(F, w, fc, side, cur, w.s1, 0, h, s);
  }
  if (h < F.ch - 0.01 || w.top) { // 矮牆的上面
    const s = w.p || w.n, A = WP(w, w.s0, w.c - t / 2), Bp = WP(w, w.s1, w.c + t / 2);
    hq(B, s.m, F0, Math.min(A[0], Bp[0]), Math.min(A[1], Bp[1]), Math.max(A[0], Bp[0]), Math.max(A[1], Bp[1]), h, dotUV(SU(s.r)), s.c);
  }
  for (const o of ops) opening(F, w, o);
  if (w.col) { // 碰撞：門口（y0 低）切開；擋鏡頭的高度 ≥ 2.6
    let cur = w.s0; const segs = [];
    for (const o of ops) if (PASS.has(o.k) && o.y0 < 0.3) { segs.push([cur, o.a]); cur = o.b; }
    segs.push([cur, w.s1]);
    for (const [p, q] of segs) if (q - p > 0.01) { const [x, z] = WP(w, (p + q) / 2, w.c); F.cols.push(w.ax === 'x' ? { t: 'box', x, z, hx: (q - p) / 2, hz: t / 2, rot: 0, h: Math.max(2.6, h) } : { t: 'box', x, z, hx: t / 2, hz: (q - p) / 2, rot: 0, h: Math.max(2.6, h) }); }
  }
  if (w.out && w.view) viewBand(F, w);
}
// 洞：側面、上面、窗台＋裡面的東西（窗框、鐵窗、門、鐵捲門⋯）
function opening(F, w, o) {
  const B = F.B, t = w.t, n0 = w.c - t / 2, n1 = w.c + t / 2, s = w.p || w.n, rev = o.rev ? col3(o.rev) : s.c, ru = dotUV(SU(s.r)), rm = s.m;
  const ax = w.ax, nS = ax === 'x' ? [1, 0] : [0, 1]; // 沿牆的方向（本地 xz）
  // 側面（朝洞裡面）
  vqN(B, rm, WP(w, o.a, n0), WP(w, o.a, n1), o.y0, o.y1, nS[0], nS[1], ru, rev);
  vqN(B, rm, WP(w, o.b, n0), WP(w, o.b, n1), o.y0, o.y1, -nS[0], -nS[1], ru, rev);
  const P0 = WP(w, o.a, n0), P1 = WP(w, o.b, n1);
  const x0 = Math.min(P0[0], P1[0]), x1 = Math.max(P0[0], P1[0]), z0 = Math.min(P0[1], P1[1]), z1 = Math.max(P0[1], P1[1]);
  if (o.y1 < w.h - 1e-3) hq(B, rm, F0, x0, z0, x1, z1, o.y1, ru, rev, false);
  if (o.y0 > 1e-3) { // 窗台（大理石，往裡面凸一點）
    const inn = w.out ? -w.out : 1, nA = inn > 0 ? n1 + 0.05 : n0 - 0.05, nB = inn > 0 ? n0 : n1;
    const Q0 = WP(w, o.a - 0.04, nA), Q1 = WP(w, o.b + 0.04, nB);
    box(B, 'shiny', F0, [Math.min(Q0[0], Q1[0]), o.y0 - 0.03, Math.min(Q0[1], Q1[1]), Math.max(Q0[0], Q1[0]), o.y0 + 0.012, Math.max(Q0[1], Q1[1])], C('#e9e4da'));
  } else if (w.out || o.k === 'idoor' || o.k === 'open') { // 門檻
    const P2 = WP(w, o.a, n0), P3 = WP(w, o.b, n1);
    hq(B, 'floor', F0, Math.min(P2[0], P3[0]), Math.min(P2[1], P3[1]), Math.max(P2[0], P3[0]), Math.max(P2[1], P3[1]), 0.004, dotUV(SU('granite')), C(o.k === 'idoor' ? '#b9a88f' : '#9a968d'));
  }
  const fill = OPEN_FILL[o.k]; if (fill) fill(F, w, o, n0, n1);
}
// 洞裡面的東西（本地：沿牆 s、法線 n）
const OPEN_FILL = {
  win(F, w, o, n0, n1) { // 鋁窗（兩片推拉）＋外面的鐵窗＋窗簾
    const B = F.B, mid = w.c + (w.out || 1) * 0.02, al = C(o.frame || '#c9cdd2'), a = o.a, b = o.b, y0 = o.y0, y1 = o.y1, fr = 0.045;
    const bar = (s0, s1, ya, yb) => { const A = WP(w, s0, mid - 0.03), Bq = WP(w, s1, mid + 0.03); box(B, 'metal', F0, [Math.min(A[0], Bq[0]), ya, Math.min(A[1], Bq[1]), Math.max(A[0], Bq[0]), yb, Math.max(A[1], Bq[1])], al); };
    bar(a, a + fr, y0, y1); bar(b - fr, b, y0, y1); bar(a, b, y0, y0 + fr); bar(a, b, y1 - fr, y1); bar((a + b) / 2 - 0.025, (a + b) / 2 + 0.025, y0, y1);
    if (o.grille !== false && w.out) { // 鐵窗（外面，鏤空）
      const gn = w.c + w.out * (w.t / 2 + 0.14), g = o.grille || 'grille1', A = WP(w, a - 0.05, gn), Bq = WP(w, b + 0.05, gn), uv = PU(g);
      vq(B, 'cut', F0, A, Bq, y0 - 0.05, y1 + 0.05, uv, WHITE, true);
      const n2 = w.c + w.out * (w.t / 2); // 鐵窗的上下蓋
      for (const y of [y0 - 0.05, y1 + 0.05]) { const P = WP(w, a - 0.05, n2), Q = WP(w, b + 0.05, gn); hq(B, 'metal', F0, Math.min(P[0], Q[0]), Math.min(P[1], Q[1]), Math.max(P[0], Q[0]), Math.max(P[1], Q[1]), y, DFL.metal, C('#9aa0a6'), y > y0); }
    }
    if (o.curtain) { // 窗簾（收在兩邊，布、有摺）
      const inn = -(w.out || 1), cn = w.c + inn * (w.t / 2 + 0.08), cc = col3(o.curtain), cw = Math.min(0.42, (b - a) * 0.22);
      for (const [s0, s1] of [[a - 0.12, a - 0.12 + cw], [b + 0.12 - cw, b + 0.12]]) {
        const k = 5, st = (s1 - s0) / k;
        for (let i = 0; i < k; i++) { const A = WP(w, s0 + i * st, cn + (i % 2 ? 0.035 : -0.035) * inn), Bq = WP(w, s0 + (i + 1) * st, cn + (i % 2 ? -0.035 : 0.035) * inn); vq(F.B, 'prop', F0, A, Bq, 0.2, y1 + 0.25, PU('fabric'), mul(cc, i % 2 ? 0.86 : 1), true); }
      }
      const A = WP(w, a - 0.2, cn), Bq = WP(w, b + 0.2, cn); box(F.B, 'metal', F0, [Math.min(A[0], Bq[0]) , y1 + 0.26, Math.min(A[1], Bq[1]) - 0.015, Math.max(A[0], Bq[0]), y1 + 0.29, Math.max(A[1], Bq[1]) + 0.015], C('#d0d2d4'));
    }
  },
  balc(F, w, o) { // 陽台的鋁門（落地、推拉，關著）
    const B = F.B, mid = w.c, al = C('#b9bec4'), a = o.a, b = o.b, fr = 0.05;
    const bar = (s0, s1, ya, yb) => { const A = WP(w, s0, mid - 0.035), Bq = WP(w, s1, mid + 0.035); box(B, 'metal', F0, [Math.min(A[0], Bq[0]), ya, Math.min(A[1], Bq[1]), Math.max(A[0], Bq[0]), yb, Math.max(A[1], Bq[1])], al); };
    bar(a, a + fr, 0, o.y1); bar(b - fr, b, 0, o.y1); bar(a, b, 0, 0.06); bar(a, b, o.y1 - fr, o.y1);
    const n = 2 + ((b - a) > 2.6 ? 1 : 0); for (let i = 1; i < n; i++) { const s = a + ((b - a) * i) / n; bar(s - 0.03, s + 0.03, 0, o.y1); }
    bar(a, b, 0.95, 0.99);
  },
  glass(F, w, o) { // 大片玻璃（超商、店面）：直的鋁框每 1.2 公尺一支
    const B = F.B, mid = w.c, al = C(o.frame || '#aeb4ba'), a = o.a, b = o.b;
    const bar = (s0, s1, ya, yb) => { const A = WP(w, s0, mid - 0.04), Bq = WP(w, s1, mid + 0.04); box(B, 'metal', F0, [Math.min(A[0], Bq[0]), ya, Math.min(A[1], Bq[1]), Math.max(A[0], Bq[0]), yb, Math.max(A[1], Bq[1])], al); };
    const n = Math.max(1, Math.round((b - a) / 1.3)); for (let i = 0; i <= n; i++) { const s = a + ((b - a) * i) / n; bar(s - 0.035, s + 0.035, o.y0, o.y1); }
    bar(a, b, o.y0, o.y0 + 0.07); bar(a, b, o.y1 - 0.07, o.y1); if (o.y1 - o.y0 > 2.2) bar(a, b, o.y0 + 2.2, o.y0 + 2.26);
    if (o.posters) for (const [s, y, name, sz] of o.posters) { const inn = -(w.out || 1), A = WP(w, s - sz / 2, mid + inn * 0.045), Bq = WP(w, s + sz / 2, mid + inn * 0.045); vqN(B, 'prop', A, Bq, y, y + sz * 1.5, w.ax === 'z' ? inn : 0, w.ax === 'x' ? inn : 0, PU(name), WHITE); }
  },
  door(F, w, o) { // 大門：鋁框玻璃門（兩片，往裡面開到 90 度）
    const B = F.B, a = o.a, b = o.b, inn = -(w.out || 1), al = C(o.frame || '#8f7a5e'), fn = w.c + inn * (w.t / 2);
    const fr = (s0, s1, ya, yb) => { const A = WP(w, s0, w.c - 0.05), Bq = WP(w, s1, w.c + 0.05); box(B, 'metal', F0, [Math.min(A[0], Bq[0]), ya, Math.min(A[1], Bq[1]), Math.max(A[0], Bq[0]), yb, Math.max(A[1], Bq[1])], al); };
    fr(a, a + 0.05, 0, o.y1); fr(b - 0.05, b, 0, o.y1); fr(a, b, o.y1 - 0.06, o.y1);
    const leaves = o.leaves || ((b - a) > 1.2 ? 2 : 1), lw = (b - a - 0.1) / leaves, dn = lw * 0.96;
    const leaf = (hs, sgn) => { // 門片：轉到跟牆垂直，靠在 hs（門軸）那邊
      const n0 = fn, n1 = fn + inn * dn, A = WP(w, hs, n0), Bq = WP(w, hs + sgn * 0.045, n1);
      const x0 = Math.min(A[0], Bq[0]), x1 = Math.max(A[0], Bq[0]), z0 = Math.min(A[1], Bq[1]), z1 = Math.max(A[1], Bq[1]);
      box(B, 'metal', F0, [x0, 0.02, z0, x1, o.y1 - 0.08, z1], al);
      const G0 = WP(w, hs + sgn * 0.0225, n0 + inn * 0.08), G1 = WP(w, hs + sgn * 0.0225, n1 - inn * 0.08);
      vq(B, 'glow', F0, G0, G1, 0.3, o.y1 - 0.3, dotUV(GU('s_ice')), [0.5, 0.56, 0.6], true);
      F.cols.push({ t: 'box', x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2 + 0.02, hz: (z1 - z0) / 2 + 0.02, rot: 0, h: 2.2 });
      if (F.occ) F.occ.push({ x0: x0 - 0.05, x1: x1 + 0.05, z0: z0 - 0.05, z1: z1 + 0.05 });
    };
    if (leaves === 2) { leaf(a + 0.05, 1); leaf(b - 0.05, -1); } else leaf(o.hinge === 'b' ? b - 0.05 : a + 0.05, o.hinge === 'b' ? -1 : 1);
  },
  idoor(F, w, o) { // 房門：木頭門框（兩面）、門片開到 90 度
    const B = F.B, a = o.a, b = o.b, wood = col3(o.wood || '#9b6a42'), tw = 0.07;
    for (const side of [1, -1]) {
      const n = w.c + side * (w.t / 2 + 0.012);
      const tr = (s0, s1, ya, yb) => { const A = WP(w, s0, n - side * 0.012), Bq = WP(w, s1, n + side * 0.012); box(B, 'prop', F0, [Math.min(A[0], Bq[0]), ya, Math.min(A[1], Bq[1]), Math.max(A[0], Bq[0]), yb, Math.max(A[1], Bq[1])], wood, PU('pwood')); };
      tr(a - tw, a, 0, o.y1 + tw); tr(b, b + tw, 0, o.y1 + tw); tr(a - tw, b + tw, o.y1, o.y1 + tw);
    }
    if (o.leaf === false) return;
    const side = o.swing || 1, hs = o.hinge === 'b' ? b : a, sg = o.hinge === 'b' ? -1 : 1, lw = b - a - 0.02, n0 = w.c + side * (w.t / 2), n1 = n0 + side * lw;
    const A = WP(w, hs + sg * 0.01, n0), Bq = WP(w, hs + sg * 0.05, n1), x0 = Math.min(A[0], Bq[0]), x1 = Math.max(A[0], Bq[0]), z0 = Math.min(A[1], Bq[1]), z1 = Math.max(A[1], Bq[1]);
    box(B, 'prop', F0, [x0, 0.01, z0, x1, o.y1 - 0.01, z1], col3(o.leafCol || '#c89c6a'), PU('door'));
    F.cols.push({ t: 'box', x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, rot: 0, h: 2.0 });
    if (F.occ) F.occ.push({ x0: x0 - 0.05, x1: x1 + 0.05, z0: z0 - 0.05, z1: z1 + 0.05 });
  },
  closed(F, w, o) { // 關著的門（浴室、儲藏室、後門、員工專用）：門片在牆中間
    const B = F.B, a = o.a, b = o.b, wood = col3(o.wood || '#9b6a42');
    const A = WP(w, a, w.c - 0.02), Bq = WP(w, b, w.c + 0.02);
    box(B, 'prop', F0, [Math.min(A[0], Bq[0]), 0, Math.min(A[1], Bq[1]), Math.max(A[0], Bq[0]), o.y1, Math.max(A[1], Bq[1])], col3(o.leafCol || '#c89c6a'), PU(o.tex || 'door'));
    for (const side of [1, -1]) {
      if (side > 0 ? !w.p : !w.n) continue;
      const n = w.c + side * (w.t / 2 + 0.012);
      const tr = (s0, s1, ya, yb) => { const P = WP(w, s0, n - side * 0.012), Q = WP(w, s1, n + side * 0.012); box(B, 'prop', F0, [Math.min(P[0], Q[0]), ya, Math.min(P[1], Q[1]), Math.max(P[0], Q[0]), yb, Math.max(P[1], Q[1])], wood, PU('pwood')); };
      tr(a - 0.07, a, 0, o.y1 + 0.07); tr(b, b + 0.07, 0, o.y1 + 0.07); tr(a - 0.07, b + 0.07, o.y1, o.y1 + 0.07);
      const hN = WP(w, o.hinge === 'b' ? a + 0.1 : b - 0.1, n + side * 0.03); // 門把
      box(B, 'metal', F0, [hN[0] - 0.03, 0.98, hN[1] - 0.03, hN[0] + 0.03, 1.04, hN[1] + 0.03], C('#d8d2c0'));
      if (o.sign && side === (o.signSide || side)) { const m = (a + b) / 2, sn = w.c + side * 0.026; vqN(B, o.signM || 'prop', WP(w, m - 0.17, sn), WP(w, m + 0.17, sn), 1.5, 1.67, w.ax === 'z' ? side : 0, w.ax === 'x' ? side : 0, o.signM === 'glow' ? GU(o.sign) : PU(o.sign), WHITE); }
    }
  },
  shutter(F, w, o) { // 關著的鐵捲門（從裡面看）＋兩邊的軌道、下面漏進來一條光
    const B = F.B, inn = -(w.out || 1), n = w.c + inn * 0.02, nx = w.ax === 'z' ? inn : 0, nz = w.ax === 'x' ? inn : 0;
    const L = o.b - o.a, H = o.y1 - o.y0, u = w.ax === 'x' ? (inn > 0 ? [1, 0, 0] : [-1, 0, 0]) : inn > 0 ? [0, 0, -1] : [0, 0, 1];
    const org = w.ax === 'x' ? [inn > 0 ? o.a : o.b, 0, n] : [n, 0, inn > 0 ? o.b : o.a];
    plane(B, 'metal', org, u, [0, 1, 0], L, H, SU('slats'), [1.2, 0.6], o.tint ? col3(o.tint) : C('#e9ecef'), [], [0.25, H - 0.3]);
    const g0 = WP(w, o.a, n + inn * 0.006), g1 = WP(w, o.b, n + inn * 0.006); vqN(B, 'glow', g0, g1, 0, 0.03, nx, nz, dotUV(GU('s_cream')), [1.4, 1.35, 1.2]);
    for (const s of [o.a, o.b - 0.06]) { const P = WP(w, s, n), Q = WP(w, s + 0.06, n + inn * 0.07); box(B, 'metal', F0, [Math.min(P[0], Q[0]), 0, Math.min(P[1], Q[1]), Math.max(P[0], Q[0]), o.y1, Math.max(P[1], Q[1])], C('#8f959b')); }
  },
  open(F, w, o) { // 開口：店面的話上面有捲起來的鐵捲門盒
    if (!o.roll) return;
    const inn = -(w.out || 1), P = WP(w, o.a, w.c + inn * (w.t / 2)), Q = WP(w, o.b, w.c + inn * (w.t / 2 + 0.28));
    box(F.B, 'metal', F0, [Math.min(P[0], Q[0]), o.y1, Math.min(P[1], Q[1]), Math.max(P[0], Q[0]), o.y1 + 0.3, Math.max(P[1], Q[1])], C('#a5abb1'));
  },
};
// 窗外的景：外牆外面一片（沿牆多 2.5 公尺），u 照景的寬度接起來（水平可以接）
function viewBand(F, w) {
  const d = w.vdist ?? 0.4, n = w.c + w.out * (w.t / 2 + d), f = w.ax === 'x' ? [0, w.out] : [w.out, 0]; // 看出去的方向
  const right = [-f[1], f[0]], reg = VU(w.view), k = w.vbright ?? 1.25, colr = [k, k, k * 1.02];
  const s0 = w.s0 - 2.5, s1 = w.s1 + 2.5;
  // 沿 right 的座標 r：s 跟 r 同向或反向
  const sgn = (w.ax === 'x' ? right[0] : right[1]) > 0 ? 1 : -1, r0 = Math.min(sgn * s0, sgn * s1), r1 = Math.max(sgn * s0, sgn * s1);
  const off = (w.voff || 0) * VIEW_W, ya = VIEW_Y0 + (w.vy || 0), yb = ya + VIEW_H;
  const cuts = [r0]; for (let k2 = Math.ceil((r0 + off) / VIEW_W) * VIEW_W - off; k2 < r1; k2 += VIEW_W) if (k2 > r0 + 1e-3) cuts.push(k2); cuts.push(r1);
  for (let i = 0; i < cuts.length - 1; i++) {
    const ra = cuts[i], rb = cuts[i + 1], ua = (ra + off) / VIEW_W - Math.floor((ra + off) / VIEW_W + 1e-6), ub = ua + (rb - ra) / VIEW_W;
    const A = WP(w, sgn * ra, n), Bq = WP(w, sgn * rb, n);
    vq(F.B, 'view', F0, A, Bq, ya, yb, subUV(reg, ua, 0, Math.min(1, ub), 1), colr);
  }
  // 門口外面的地（騎樓的水泥地）：從牆外面到景
  for (const o of w.ops) if (o.y0 < 0.05 && LIT.has(o.k)) {
    const P = WP(w, o.a - 0.6, w.c + w.out * (w.t / 2)), Q = WP(w, o.b + 0.6, n);
    hq(F.B, 'floor', F0, Math.min(P[0], Q[0]), Math.min(P[1], Q[1]), Math.max(P[0], Q[0]), Math.max(P[1], Q[1]), -0.03, dotUV(SU('granite')), C(w.ground || '#b8b6b0'));
  }
}
// ---- 燈 ----
// 天花板的燈具（只有外型；真的光源是 lamp()）：round 吸頂燈、tube 日光燈、panel 超商的平板燈、bulb 燈泡
function fixture(F, x, z, kind = 'round', o = {}) {
  const B = F.B, y = o.y ?? F.ch, ry = o.ry || 0, T = frame(x, 0, z, ry);
  if (kind === 'round') { cyl(B, 'prop', T, 0, 0, y - 0.07, y, 0.26, 0.26, 12, C('#f4f4f2'), null, false); cyl(B, 'glow', T, 0, 0, y - 0.1, y - 0.07, 0.25, 0.2, 12, [1.3, 1.26, 1.18], dotUV(GU('s_warm')), false); hq(B, 'glow', T, -0.14, -0.14, 0.14, 0.14, y - 0.1, dotUV(GU('s_warm')), [1.35, 1.3, 1.2], false); }
  else if (kind === 'tube') { const L = o.L || 1.2; box(B, 'prop', T, [-L / 2, y - 0.05, -0.06, L / 2, y, 0.06], C('#eeeeec')); box(B, 'glow', T, [-L / 2 + 0.05, y - 0.085, -0.025, L / 2 - 0.05, y - 0.05, 0.025], [1.3, 1.34, 1.36], { _: dotUV(GU('s_cool')), ny: dotUV(GU('s_cool')), py: false }); }
  else if (kind === 'panel') { const L = o.L || 1.2, W2 = o.W || 0.6; hq(B, 'glow', T, -L / 2, -W2 / 2, L / 2, W2 / 2, y - 0.01, dotUV(GU('s_white')), [1.45, 1.47, 1.5], false); box(B, 'metal', T, [-L / 2 - 0.03, y - 0.012, -W2 / 2 - 0.03, L / 2 + 0.03, y - 0.004, W2 / 2 + 0.03], C('#e4e6e8'), { py: false, ny: false }); }
  else if (kind === 'bulb') { tube(B, 'prop', [x, y, z], [x, y - 0.5, z], 0.006, 0.006, 3, C('#333')); cyl(B, 'prop', T, 0, 0, y - 0.62, y - 0.5, 0.04, 0.03, 6, C('#555'), null, true); ball(B, 'glow', T, 0, y - 0.68, 0, 0.06, 0.07, 0.06, [1.4, 1.3, 1.1], dotUV(GU('s_warm')), 6, 4); }
}
// 點光源（每層固定兩個：第三個以後不算）
function lamp(F, x, z, I = 1, c = '#fff1dc', y) { F.lamps.push({ x, z, y: y ?? F.ch - 0.35, I, c }); }
// 家具底下的軟影子：本地長方形（或 frame T 裡的長方形）
function blob(F, x0, z0, x1, z1, k = 1, T = F0, y = 0.006) {
  const e = 0.14, a = T.p(x0 - e, y, z1 + e), b = T.p(x1 + e, y, z1 + e), c = T.p(x1 + e, y, z0 - e), d = T.p(x0 - e, y, z0 - e);
  F.B.quad('shadow', a, b, c, d, [0, 0, 1, 1], [k, k, k]);
}
// ---- 碰撞、放人的點、出口（都是本地座標；最後才換成世界座標）----
function colBox(F, x0, z0, x1, z1, h) { F.cols.push({ t: 'box', x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: Math.abs(x1 - x0) / 2, hz: Math.abs(z1 - z0) / 2, rot: 0, h }); }
function colT(F, T, x0, z0, x1, z1, h) { const c = T.p((x0 + x1) / 2, 0, (z0 + z1) / 2); F.cols.push({ t: 'box', x: c[0], z: c[2], hx: Math.abs(x1 - x0) / 2, hz: Math.abs(z1 - z0) / 2, rot: T.ry, h }); }
function colC(F, x, z, r, h) { F.cols.push({ t: 'circle', x, z, r, h }); }
// 放人的點：T 裡面的 (lx, lz)，lh＝在 T 裡面面朝哪裡（−π/2＝朝 T 的 +z）
function spot(F, kind, T, lx, lz, lh, y, rm) { const p = T.p(lx, 0, lz); const s = { x: p[0], z: p[2], heading: T.ry + lh }; if (y != null) s.y = y; if (rm) s.room = rm; F.spots[kind].push(s); return s; }
// 出口：本地長方形 → to（'outside' 或樓層），spawn＝到那邊站哪裡（本地；outside 的話最後換成門外）
function exitZone(F, x0, z0, x1, z1, to, spawn) { F.exits.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: Math.abs(x1 - x0) / 2, hz: Math.abs(z1 - z0) / 2, rot: 0, to, spawn }); }

// ---- 家具（本地座標；T＝frame：靠牆的東西原點在牆面中間、+z 朝房間；放在中間的東西原點在中間）----
// 每個都自己加：網格、碰撞（colT）、影子（blob）、放人的點（spot）
const bx = (F, m, T, b, c, uv) => box(F.B, m, T, b, col3(c), uv || {});
const WOOD = () => PU('pwood'), LWOOD = () => PU('lwood'), FAB = () => PU('fabric');
// 牆上的畫、日曆、海報：T＝牆面（+z 朝房間），中間在 x＝0、下緣 y
function wallPic(F, T, name, w, h, y, m = 'prop', col = WHITE, dz = 0.012) { vq(F.B, m, T, [-w / 2, dz], [w / 2, dz], y, y + h, m === 'glow' ? GU(name) : PU(name), col3(col)); }
function framedPic(F, T, name, w, h, y, fc = '#6b4a2e') { bx(F, 'prop', T, [-w / 2 - 0.03, y - 0.03, 0, w / 2 + 0.03, y + h + 0.03, 0.025], fc); wallPic(F, T, name, w, h, y, 'prop', WHITE, 0.027); }

// 神明桌（一組）：頂桌（高）＋下桌（八仙桌，往前伸）＋神明彩、對聯、神明燈、香爐、神像、祖先牌位、水果、蠟燭
function altar(F, T, o = {}) {
  const B = F.B, w = o.w || 1.8, hw = w / 2, wd = WOOD(), rc = PU('redCarve'), gold = C('#d4a62c');
  bx(F, 'shiny', T, [-hw, 1.04, 0.02, hw, 1.12, 0.64], WHITE, wd);
  bx(F, 'prop', T, [-hw + 0.04, 0.82, 0.06, hw - 0.04, 1.04, 0.6], WHITE, { pz: rc, _: wd });
  for (const x of [-hw + 0.04, hw - 0.12]) for (const z of [0.06, 0.52]) bx(F, 'prop', T, [x, 0, z, x + 0.08, 0.82, z + 0.08], WHITE, wd);
  bx(F, 'prop', T, [-hw + 0.04, 0.1, 0.06, hw - 0.04, 0.14, 0.6], WHITE, wd);
  const lw = Math.min(0.7, hw - 0.12);
  bx(F, 'shiny', T, [-lw, 0.78, 0.34, lw, 0.84, 1.1], WHITE, wd);
  bx(F, 'prop', T, [-lw + 0.03, 0.08, 1.07, lw - 0.03, 0.78, 1.1], WHITE, { pz: rc, _: wd }); // 桌裙（紅色刺繡）
  for (const x of [-lw + 0.03, lw - 0.1]) bx(F, 'prop', T, [x, 0, 1.0, x + 0.07, 0.78, 1.07], WHITE, wd);
  // 牆上：神明彩、上面紅色的燈條、兩邊對聯
  const pw = Math.min(1.0, w - 0.55), ph = pw * 1.33, py = 1.16;
  bx(F, 'prop', T, [-pw / 2 - 0.05, py - 0.04, 0, pw / 2 + 0.05, py + ph + 0.05, 0.03], gold);
  wallPic(F, T, 'deity', pw, ph, py, 'prop', WHITE, 0.032);
  if (w >= 1.5) { vq(B, 'prop', T.sub(-pw / 2 - 0.2, 0, 0), [-0.07, 0.012], [0.07, 0.012], py + 0.1, py + 1.15, PU('cpR'), WHITE); vq(B, 'prop', T.sub(pw / 2 + 0.2, 0, 0), [-0.07, 0.012], [0.07, 0.012], py + 0.1, py + 1.15, PU('cpL'), WHITE); }
  // 神明燈（兩盞紅色蓮花燈）
  for (const s of [-1, 1]) {
    const x = s * (hw - 0.2);
    cyl(B, 'metal', T, x, 0.3, 1.12, 1.16, 0.08, 0.06, 8, C('#c9a24a')); cyl(B, 'metal', T, x, 0.3, 1.16, 1.4, 0.018, 0.018, 5, C('#c9a24a'), null, false);
    cyl(B, 'glow', T, x, 0.3, 1.38, 1.46, 0.05, 0.1, 8, [1.25, 0.4, 0.28], dotUV(GU('s_red')), false);
    ball(B, 'glow', T, x, 1.5, 0.3, 0.075, 0.085, 0.075, [1.35, 0.6, 0.4], GU('bulbR'), 8, 5);
  }
  // 神像（坐著的：金色的袍、黑鬍子）
  const sx = o.tablet === false ? 0 : -0.12;
  cyl(B, 'prop', T, sx, 0.26, 1.12, 1.2, 0.13, 0.12, 8, C('#8a1a12'));
  cyl(B, 'shiny', T, sx, 0.26, 1.2, 1.46, 0.12, 0.07, 8, C('#d8a431'));
  ball(B, 'shiny', T, sx, 1.52, 0.27, 0.055, 0.065, 0.055, C('#e8c49a'), null, 7, 5);
  cyl(B, 'shiny', T, sx, 0.27, 1.56, 1.62, 0.06, 0.035, 7, C('#caa032'));
  // 祖先牌位
  if (o.tablet !== false) { const tx = hw - 0.5; bx(F, 'prop', T, [tx - 0.08, 1.12, 0.14, tx + 0.08, 1.2, 0.3], C('#7a1a12')); bx(F, 'prop', T, [tx - 0.07, 1.2, 0.2, tx + 0.07, 1.58, 0.26], WHITE, { pz: PU('tablet'), _: dotUV(PU('pwood')) }); }
  // 香爐＋三支香
  cyl(B, 'metal', T, 0, 0.46, 1.12, 1.24, 0.12, 0.14, 10, C('#b08a3e')); cyl(B, 'prop', T, 0, 0.46, 1.235, 1.245, 0.125, 0.125, 10, C('#7d746a'), null, true);
  for (const dx of [-0.03, 0, 0.03]) { tube(B, 'prop', [dx, 1.24, 0.46], [dx * 2.2, 1.52, 0.44], 0.005, 0.005, 3, C('#b8412a')); const p = T.p(dx * 2.2, 1.525, 0.44); ball(B, 'glow', frame(p[0], 0, p[2]), 0, p[1], 0, 0.009, 0.009, 0.009, [2, 0.6, 0.2], dotUV(GU('s_orange')), 4, 3); }
  // 下桌：水果（兩盤）、茶杯、蠟燭
  for (const s of [-1, 1]) {
    const x = s * (lw - 0.25);
    cyl(B, 'shiny', T, x, 0.72, 0.84, 0.86, 0.14, 0.15, 10, C('#e9e6df'));
    for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; ball(B, 'shiny', T, x + Math.cos(a) * 0.06, 0.915 + (k === 0 ? 0.06 : 0), 0.72 + Math.sin(a) * 0.06, 0.05, 0.05, 0.05, C(s < 0 ? '#f39c12' : '#d63a2a'), null, 6, 4); }
    cyl(B, 'prop', T, s * (lw - 0.07), 0.5, 0.84, 1.08, 0.02, 0.02, 6, C('#c0261c'));
    const p = T.p(s * (lw - 0.07), 0, 0.5); ball(B, 'glow', frame(p[0], 0, p[2]), 0, 1.11, 0, 0.012, 0.028, 0.012, [2, 1.4, 0.6], GU('flame'), 4, 3);
  }
  for (let k = 0; k < 3; k++) cyl(B, 'shiny', T, -0.12 + k * 0.12, 0.5, 0.84, 0.885, 0.028, 0.022, 7, C('#f4f1ea'));
  colT(F, T, -hw, 0, hw, 1.12, 1.12); blob(F, -hw, 0, hw, 1.14, 1, T);
  spot(F, 'pray', T, 0, 1.6, HP, null, o.room);
}
// 木頭沙發（n 人座）：T＝靠牆中間，坐的人面朝 +z
function sofa(F, T, o = {}) {
  const n = o.n || 3, L = n * 0.6 + 0.24, hl = L / 2, wd = o.leather ? dotUV(PU('white')) : WOOD(), wc = o.leather ? col3(o.col || '#5a3a2a') : WHITE, cc = col3(o.col || '#b5453a'), fb = FAB();
  for (const s of [-1, 1]) bx(F, 'prop', T, [s > 0 ? hl - 0.12 : -hl, 0, 0.04, s > 0 ? hl : -hl + 0.12, 0.64, 0.78], wc, wd);
  bx(F, 'prop', T, [-hl + 0.12, 0.08, 0.06, hl - 0.12, 0.38, 0.76], wc, wd);
  bx(F, 'prop', T, [-hl + 0.12, 0.38, 0.04, hl - 0.12, 0.96, 0.14], wc, wd);
  const sw = (L - 0.24) / n;
  for (let i = 0; i < n; i++) {
    const x0 = -hl + 0.12 + i * sw + 0.01, x1 = x0 + sw - 0.02;
    bx(F, 'prop', T, [x0, 0.38, 0.16, x1, 0.49, 0.76], cc, fb);
    if (!o.leather) bx(F, 'prop', T, [x0 + 0.02, 0.49, 0.14, x1 - 0.02, 0.86, 0.26], mul(cc, 0.95), fb);
    spot(F, 'sit', T, (x0 + x1) / 2, 0.48, -HP, 0.5, o.room);
  }
  colT(F, T, -hl, 0.02, hl, 0.8, 0.96); blob(F, -hl, 0.02, hl, 0.8, 1, T);
}
// 茶几＋茶盤、茶壺、茶杯
function teaTable(F, T, o = {}) {
  const B = F.B, L = o.L || 1.1, D = o.D || 0.55, wd = WOOD();
  bx(F, 'shiny', T, [-L / 2, 0.38, -D / 2, L / 2, 0.44, D / 2], WHITE, wd);
  for (const x of [-L / 2 + 0.03, L / 2 - 0.09]) for (const z of [-D / 2 + 0.03, D / 2 - 0.09]) bx(F, 'prop', T, [x, 0, z, x + 0.06, 0.38, z + 0.06], WHITE, wd);
  bx(F, 'prop', T, [-L / 2 + 0.05, 0.08, -D / 2 + 0.05, L / 2 - 0.05, 0.11, D / 2 - 0.05], WHITE, wd);
  bx(F, 'shiny', T, [-0.26, 0.44, -0.16, 0.26, 0.47, 0.16], C('#3a2416'));
  ball(B, 'shiny', T, -0.08, 0.525, 0, 0.065, 0.055, 0.065, C('#6b3a22'), null, 8, 5);
  cyl(B, 'shiny', T, -0.08, 0, 0.575, 0.6, 0.03, 0.02, 6, C('#6b3a22')); const p = T.p(-0.08, 0, 0); tube(B, 'shiny', [p[0] + 0.05, 0.52, p[2]], [p[0] + 0.12, 0.56, p[2]], 0.012, 0.008, 4, C('#6b3a22'));
  for (let k = 0; k < 4; k++) cyl(B, 'shiny', T, 0.07 + (k % 2) * 0.09, -0.05 + ((k / 2) | 0) * 0.1, 0.47, 0.5, 0.022, 0.02, 7, C('#f1ede2'));
  if (o.fruit !== false) { cyl(B, 'shiny', T, L / 2 - 0.2, 0.05, 0.44, 0.46, 0.12, 0.13, 8, C('#d9d4ca')); for (let k = 0; k < 3; k++) ball(B, 'shiny', T, L / 2 - 0.24 + k * 0.05, 0.5, 0.03 + (k % 2) * 0.04, 0.04, 0.04, 0.04, C(['#f39c12', '#d63a2a', '#9ccf5a'][k]), null, 6, 4); }
  colT(F, T, -L / 2, -D / 2, L / 2, D / 2, 0.47); blob(F, -L / 2, -D / 2, L / 2, D / 2, 0.8, T);
}
// 電視櫃＋電視（畫面發光）
function tvSet(F, T, o = {}) {
  const B = F.B, L = o.L || 1.6, wd = o.light ? LWOOD() : WOOD();
  bx(F, 'prop', T, [-L / 2, 0, 0.02, L / 2, 0.5, 0.46], WHITE, wd);
  for (let i = 0; i < 3; i++) { const x0 = -L / 2 + 0.04 + (i * (L - 0.08)) / 3; vq(B, 'prop', T, [x0 + 0.01, 0.462], [x0 + (L - 0.08) / 3 - 0.01, 0.462], 0.06, 0.44, dotUV(PU('pwood')), C('#5a3018')); bx(F, 'metal', T, [x0 + 0.12, 0.3, 0.462, x0 + 0.26, 0.32, 0.48], C('#d8c9a0')); }
  const tw = Math.min(1.25, L - 0.2), th = tw * 0.58;
  bx(F, 'prop', T, [-0.2, 0.5, 0.12, 0.2, 0.53, 0.34], C('#1d1f23')); bx(F, 'prop', T, [-0.04, 0.53, 0.14, 0.04, 0.62, 0.18], C('#1d1f23'));
  bx(F, 'shiny', T, [-tw / 2, 0.6, 0.12, tw / 2, 0.6 + th, 0.17], C('#141517'));
  vq(B, 'glow', T, [-tw / 2 + 0.02, 0.171], [tw / 2 - 0.02, 0.171], 0.62, 0.58 + th, GU(o.tv || 'tvA'), [1.05, 1.05, 1.05]);
  if (o.plant !== false) { const x = L / 2 - 0.16; cyl(B, 'prop', T, x, 0.3, 0.5, 0.64, 0.08, 0.1, 8, C('#c8643c')); vq(B, 'cut', T, [x - 0.2, 0.3], [x + 0.2, 0.3], 0.6, 1.0, PU('plant'), WHITE, true); vq(B, 'cut', T.sub(x, 0, 0.3, HP), [-0.2, 0], [0.2, 0], 0.6, 1.0, PU('plant'), WHITE, true); }
  colT(F, T, -L / 2, 0, L / 2, 0.47, 0.55); blob(F, -L / 2, 0, L / 2, 0.47, 0.8, T);
}
// 電風扇（立扇）
function fan(F, T, o = {}) {
  const B = F.B, c = col3(o.col || '#f2f2f0'), bl = col3(o.blade || '#6fa8dc');
  cyl(B, 'prop', T, 0, 0, 0, 0.05, 0.2, 0.18, 10, c); cyl(B, 'prop', T, 0, 0, 0.05, 0.95, 0.018, 0.018, 6, C('#d8dadc'), null, false);
  bx(F, 'prop', T, [-0.07, 0.95, -0.12, 0.07, 1.08, 0.04], c);
  for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + 0.3, p = T.p(0, 1.06, 0.08); const q = T.p(Math.cos(a) * 0.15, 1.06 + Math.sin(a) * 0.15, 0.08); tube(B, 'prop', p, q, 0.03, 0.05, 4, bl); }
  vq(B, 'cut', T, [-0.2, 0.1], [0.2, 0.1], 0.86, 1.26, PU('fan'), WHITE, true); vq(B, 'cut', T, [-0.2, 0.05], [0.2, 0.05], 0.86, 1.26, PU('fan'), WHITE, true);
  const p = T.p(0, 0, 0); colC(F, p[0], p[2], 0.22, 1.2); blob(F, -0.2, -0.2, 0.2, 0.2, 0.6, T);
}
// 鞋櫃＋拖鞋
function shoeCab(F, T, o = {}) {
  const B = F.B, L = o.L || 0.9;
  bx(F, 'prop', T, [-L / 2, 0, 0.02, L / 2, 1.0, 0.36], C(o.col || '#e9e3d6'), { pz: PU('wardrobe'), _: dotUV(PU('white')) });
  bx(F, 'prop', T, [-L / 2 - 0.01, 1.0, 0.01, L / 2 + 0.01, 1.03, 0.37], WHITE, LWOOD());
  cyl(B, 'prop', T, L / 2 - 0.15, 0.18, 1.03, 1.2, 0.07, 0.09, 8, C('#6aa0c8')); // 花瓶
  const cs = ['#3b7dd8', '#e0453a', '#43b36b', '#f2c230'];
  for (let k = 0; k < 2; k++) { const x = -L / 2 + 0.15 + k * 0.28; for (const dx of [0, 0.11]) bx(F, 'prop', T, [x + dx, 0, 0.42, x + dx + 0.09, 0.025, 0.66], cs[(k + (o.seed || 0)) % 4]); }
  colT(F, T, -L / 2, 0, L / 2, 0.37, 1.0); blob(F, -L / 2, 0, L / 2, 0.37, 0.7, T);
}
// 機車（停在家裡）：T＝機車中間，車頭朝 +x
function scooter(F, T, o = {}) {
  const B = F.B, pc = col3(o.col || '#f2f3f5'), dk = C('#2a2b2e');
  bx(F, 'shiny', T, [-0.75, 0.28, -0.19, 0.5, 0.62, 0.19], pc); bx(F, 'prop', T, [-0.2, 0.2, -0.2, 0.36, 0.3, 0.2], dk);
  bx(F, 'prop', T, [-0.66, 0.62, -0.17, 0.05, 0.74, 0.17], C('#1b1c1f')); bx(F, 'shiny', T, [0.46, 0.26, -0.22, 0.62, 0.98, 0.22], pc);
  bx(F, 'metal', T, [0.52, 0.96, -0.33, 0.58, 1.01, 0.33], dk); bx(F, 'glow', T, [0.62, 0.72, -0.08, 0.66, 0.84, 0.08], [1.1, 1.1, 1.05], dotUV(GU('s_white')));
  for (const wx of [-0.55, 0.6]) tube(B, 'prop', T.p(wx, 0.2, -0.07), T.p(wx, 0.2, 0.07), 0.2, 0.2, 8, dk, null, true);
  if (o.helmet) ball(B, 'shiny', T, -0.3, 0.86, 0, 0.14, 0.13, 0.14, col3(o.helmet), null, 8, 5);
  colT(F, T, -0.8, -0.26, 0.7, 0.26, 1.0); blob(F, -0.8, -0.22, 0.7, 0.22, 0.9, T);
}
// 餐桌（方桌、圓桌）＋椅子或板凳：T＝桌子中間；o.round、o.w、o.d、o.seats：[[x, z, 面朝的 lh]]（本地）
function dining(F, T, o = {}) {
  const B = F.B, w = o.w || 1.1, d = o.d || 0.75, H = o.h || 0.76, top = col3(o.top || '#f0ebe0'), wd = LWOOD();
  if (o.round) { cyl(B, 'shiny', T, 0, 0, H - 0.04, H, o.r || 0.45, o.r || 0.45, 16, top, null, true); cyl(B, 'metal', T, 0, 0, 0, H - 0.04, 0.03, 0.03, 6, C('#9aa0a6'), null, false); cyl(B, 'metal', T, 0, 0, 0, 0.03, 0.26, 0.26, 10, C('#9aa0a6')); }
  else {
    bx(F, 'shiny', T, [-w / 2, H - 0.04, -d / 2, w / 2, H, d / 2], top, o.top ? {} : wd);
    for (const x of [-w / 2 + 0.04, w / 2 - 0.09]) for (const z of [-d / 2 + 0.04, d / 2 - 0.09]) bx(F, 'prop', T, [x, 0, z, x + 0.05, H - 0.04, z + 0.05], o.legs || '#6b4a2e');
  }
  const r = o.r || 0.45, hw = o.round ? r : w / 2, hd = o.round ? r : d / 2;
  const seats = o.seats || (o.round ? [0, 1, 2, 3].map((k) => { const a = (k / 4) * TAU + 0.4; return [Math.cos(a) * (r + 0.28), -Math.sin(a) * (r + 0.28), a + Math.PI]; }) : [[-w / 4, -d / 2 - 0.28, -HP], [w / 4, -d / 2 - 0.28, -HP], [-w / 4, d / 2 + 0.28, HP], [w / 4, d / 2 + 0.28, HP]]);
  const sc = col3(o.stool || '#d9403a');
  for (const [x, z, lh] of seats) {
    if (o.chairs) { const S = T.sub(x, 0, z, lh + HP); bx(F, 'prop', S, [-0.2, 0.43, -0.2, 0.2, 0.47, 0.2], WHITE, wd); for (const lx of [-0.18, 0.15]) for (const lz of [-0.18, 0.15]) bx(F, 'prop', S, [lx, 0, lz, lx + 0.03, 0.43, lz + 0.03], C('#6b4a2e')); bx(F, 'prop', S, [-0.2, 0.47, -0.22, 0.2, 0.9, -0.18], WHITE, wd); const p = S.p(0, 0, 0); colC(F, p[0], p[2], 0.22, 0.9); }
    else { cyl(B, 'shiny', T, x, z, 0, 0.44, 0.13, 0.16, 10, sc, null, true); const p = T.p(x, 0, z); colC(F, p[0], p[2], 0.17, 0.45); }
    spot(F, 'sit', T, x, z, lh, 0.46, o.room);
  }
  // 桌上：菜罩、碗、電鍋
  if (o.food !== false) {
    const cov = col3(o.cover || '#f28ab0'); ball(B, 'prop', T, 0.05, H, 0, 0.26, 0.16, 0.26, cov, null, 10, 3);
    for (const [x, z] of [[-0.3, 0.15], [0.32, -0.12]]) cyl(B, 'shiny', T, x, z, H, H + 0.06, 0.05, 0.07, 8, C('#f4f1ea'), null, true);
  }
  colT(F, T, -hw, -hd, hw, hd, H); blob(F, -hw, -hd, hw, hd, 0.8, T);
}
// 大同電鍋（紅、綠、白）
function riceCooker(F, T, x, y, z, col = '#d8342c') {
  const B = F.B; cyl(B, 'shiny', T, x, z, y, y + 0.2, 0.13, 0.13, 12, col3(col)); cyl(B, 'shiny', T, x, z, y + 0.2, y + 0.24, 0.12, 0.09, 12, col3(col));
  cyl(B, 'metal', T, x, z, y + 0.24, y + 0.27, 0.025, 0.02, 6, C('#d8dadc')); bx(F, 'prop', T, [x - 0.16, y + 0.14, z - 0.02, x - 0.12, y + 0.17, z + 0.02], C('#333')); bx(F, 'prop', T, [x + 0.12, y + 0.14, z - 0.02, x + 0.16, y + 0.17, z + 0.02], C('#333'));
}
// 廚房流理台：T＝牆，檯子沿 T 的 x 從 0 到 L，+z 朝房間；o.stove（'l'｜'r' 爐子在哪一頭）
function kitchen(F, T, L, o = {}) {
  const B = F.B, cab = col3(o.cab || '#f1ede4'), H = 0.86, st = o.stove === 'r' ? L - 0.75 : 0.05;
  bx(F, 'prop', T, [0, 0.08, 0.04, L, H - 0.04, 0.6], cab, { pz: PU('wardrobe'), _: dotUV(PU('white')) });
  bx(F, 'prop', T, [0, 0, 0.1, L, 0.08, 0.56], C('#4a4a4a'));
  bx(F, 'metal', T, [0, H - 0.04, 0.02, L, H, 0.62], C('#c7ccd1'), PU('steel'));
  // 爐子、炒菜鍋、抽油煙機
  const sx = st + 0.35; bx(F, 'prop', T, [st, H, 0.08, st + 0.7, H + 0.03, 0.54], C('#1d1f23'));
  for (const dx of [-0.17, 0.17]) cyl(B, 'metal', T, sx + dx, 0.3, H + 0.03, H + 0.05, 0.08, 0.08, 8, C('#555a60'));
  ball(B, 'metal', T, sx - 0.17, H + 0.13, 0.3, 0.19, 0.08, 0.19, C('#3a3c40'), null, 10, 3); tube(B, 'prop', T.p(sx - 0.17 + 0.18, H + 0.12, 0.3), T.p(sx - 0.17 + 0.42, H + 0.16, 0.3), 0.018, 0.018, 4, C('#2a1a10'));
  bx(F, 'metal', T, [st - 0.05, 1.72, 0.02, st + 0.75, 1.9, 0.55], C('#c7ccd1'), PU('steel')); bx(F, 'metal', T, [st + 0.2, 1.9, 0.02, st + 0.5, F.ch, 0.3], C('#c7ccd1'), PU('steel'));
  // 水槽＋水龍頭
  const kx = o.stove === 'r' ? 0.6 : L - 0.6; hq(B, 'metal', T, kx - 0.3, 0.12, kx + 0.3, 0.5, H + 0.002, PU('steel'), C('#8d949b')); bx(F, 'metal', T, [kx - 0.02, H, 0.06, kx + 0.02, H + 0.3, 0.1], C('#dfe3e6')); tube(B, 'metal', T.p(kx, H + 0.3, 0.08), T.p(kx, H + 0.3, 0.26), 0.015, 0.015, 5, C('#dfe3e6'));
  // 調味料、砧板
  for (let k = 0; k < 4; k++) cyl(B, 'shiny', T, st + 0.8 + k * 0.09, 0.14, H, H + 0.2 + (k % 2) * 0.05, 0.03, 0.03, 6, C(['#3a1a0c', '#f4f1ea', '#b8261c', '#c9a24a'][k]));
  if (L > 1.9) bx(F, 'prop', T, [kx - 0.95, H, 0.2, kx - 0.55, H + 0.02, 0.45], C('#d9c6a5'));
  if (o.rice !== false && L > 1.6) riceCooker(F, T, o.stove === 'r' ? 0.25 : L - 1.05, H, 0.35, o.rice || '#d8342c');
  if (o.upper !== false) { bx(F, 'prop', T, [0, 2.0, 0.02, L, 2.7, 0.36], cab, { pz: PU('wardrobe'), _: dotUV(PU('white')) }); }
  colT(F, T, 0, 0, L, 0.62, 0.9); blob(F, 0, 0, L, 0.62, 0.8, T);
  spot(F, 'stand', T, L / 2, 0.95, HP, null, o.room);
}
// 冰箱：T＝靠牆中間
function fridge(F, T, o = {}) {
  const B = F.B, w = o.w || 0.68, h = o.h || 1.72, c = col3(o.col || '#eef0f1');
  bx(F, 'shiny', T, [-w / 2, 0.02, 0.03, w / 2, h, 0.7], c, { pz: PU('fridge'), _: dotUV(PU('white')) });
  bx(F, 'prop', T, [-w / 2 + 0.02, 0, 0.05, w / 2 - 0.02, 0.04, 0.68], C('#333'));
  const mc = ['#e0453a', '#f2c230', '#3b8fd9', '#43b36b']; for (let k = 0; k < 4; k++) vq(B, 'prop', T, [-0.18 + k * 0.1, 0.702], [-0.12 + k * 0.1, 0.702], 1.25 + (k % 2) * 0.12, 1.31 + (k % 2) * 0.12, dotUV(PU('white')), C(mc[k]));
  bx(F, 'prop', T, [-w / 2 + 0.05, h, 0.1, w / 2 - 0.1, h + 0.18, 0.6], C('#d8c7a8'));
  colT(F, T, -w / 2, 0, w / 2, 0.72, h); blob(F, -w / 2, 0, w / 2, 0.72, 0.8, T);
}
// 床（雙人 1.5、單人 1.05）：T＝床頭靠牆的中間，床往 +z；睡的人頭在床頭
function bed(F, T, o = {}) {
  const B = F.B, W = o.w || 1.5, L = 2.0, hw = W / 2, fr = o.frame === 'dark' ? WOOD() : LWOOD(), qc = col3(o.quilt || '#f5b7c8');
  bx(F, 'prop', T, [-hw, 0.06, 0.06, hw, 0.3, L], WHITE, fr); bx(F, 'prop', T, [-hw + 0.05, 0, 0.1, hw - 0.05, 0.06, L - 0.05], C('#333'));
  bx(F, 'prop', T, [-hw - 0.03, 0, 0, hw + 0.03, 1.0, 0.07], WHITE, fr);
  bx(F, 'prop', T, [-hw + 0.03, 0.3, 0.08, hw - 0.03, 0.5, L - 0.03], C('#f7f5ef'), FAB());
  bx(F, 'prop', T, [-hw + 0.01, 0.5, 0.62, hw - 0.01, 0.57, L - 0.01], qc, { py: PU('quilt'), pz: PU('quilt'), _: FAB() });
  bx(F, 'prop', T, [-hw + 0.01, 0.33, L - 0.02, hw - 0.01, 0.57, L + 0.01], qc, FAB());
  bx(F, 'prop', T, [-hw + 0.01, 0.52, 0.56, hw - 0.01, 0.6, 0.78], mul(qc, 0.92), FAB()); // 被子摺起來的邊
  const np = W > 1.2 ? 2 : 1; for (let i = 0; i < np; i++) { const x = np === 1 ? 0 : (i ? 1 : -1) * W * 0.23; bx(F, 'prop', T, [x - 0.29, 0.5, 0.14, x + 0.29, 0.63, 0.5], C(o.pillow || '#fbfaf6'), PU('pillow')); }
  if (o.side !== false) { // 床頭櫃＋小檯燈
    const s = o.side === 'l' ? -1 : 1, x = s * (hw + 0.28);
    bx(F, 'prop', T, [x - 0.22, 0, 0.04, x + 0.22, 0.52, 0.44], WHITE, fr); cyl(B, 'prop', T, x, 0.22, 0.52, 0.56, 0.07, 0.07, 8, C('#c9b28a')); cyl(B, 'metal', T, x, 0.22, 0.56, 0.78, 0.012, 0.012, 5, C('#c9b28a'), null, false);
    cyl(B, 'glow', T, x, 0.22, 0.74, 0.92, 0.12, 0.08, 10, [1.25, 1.12, 0.92], dotUV(GU('s_cream')), true);
    colT(F, T, x - 0.22, 0, x + 0.22, 0.46, 0.55);
  }
  colT(F, T, -hw - 0.03, 0, hw + 0.03, L + 0.02, 0.6); blob(F, -hw, 0, hw, L, 1, T);
  spot(F, 'sleep', T, 0, 1.02, HP, 0.58, o.room);
  spot(F, 'sit', T, np === 1 ? 0 : -W * 0.2, L - 0.3, 0, 0.5, o.room).edge = true;
}
// 衣櫃
function wardrobe(F, T, o = {}) {
  const w = o.w || 1.2, h = o.h || 2.0, c = col3(o.col || '#f3efe6');
  bx(F, 'prop', T, [-w / 2, 0, 0.02, w / 2, h, 0.6], c, { pz: PU('wardrobe'), _: dotUV(PU('white')) });
  bx(F, 'prop', T, [-w / 2 - 0.01, h, 0.01, w / 2 + 0.01, h + 0.04, 0.61], mul(c, 0.9), LWOOD());
  if (o.boxes !== false) { bx(F, 'prop', T, [-w / 2 + 0.05, h + 0.04, 0.08, -w / 2 + 0.55, h + 0.3, 0.5], C('#c9a878')); bx(F, 'prop', T, [0.0, h + 0.04, 0.1, 0.4, h + 0.22, 0.45], C('#5a7ea8')); }
  colT(F, T, -w / 2, 0, w / 2, 0.62, h); blob(F, -w / 2, 0, w / 2, 0.62, 0.9, T);
}
// 書桌＋椅子＋電腦（或檯燈、書）：T＝靠牆中間
function desk(F, T, o = {}) {
  const B = F.B, w = o.w || 1.1, wd = LWOOD();
  bx(F, 'shiny', T, [-w / 2, 0.72, 0.02, w / 2, 0.76, 0.58], WHITE, wd);
  bx(F, 'prop', T, [-w / 2, 0, 0.04, -w / 2 + 0.04, 0.72, 0.56], WHITE, wd); bx(F, 'prop', T, [w / 2 - 0.42, 0, 0.04, w / 2, 0.72, 0.56], WHITE, { pz: PU('wardrobe'), _: wd });
  if (o.pc !== false) {
    bx(F, 'prop', T, [-0.28, 0.76, 0.12, 0.28, 1.12, 0.16], C('#1d1f23')); vq(B, 'glow', T, [-0.26, 0.161], [0.26, 0.161], 0.79, 1.1, GU('monitor'), WHITE);
    bx(F, 'prop', T, [-0.05, 0.76, 0.16, 0.05, 0.79, 0.24], C('#1d1f23')); bx(F, 'prop', T, [-0.22, 0.76, 0.3, 0.2, 0.78, 0.44], C('#2a2c30')); bx(F, 'prop', T, [0.28, 0.76, 0.34, 0.34, 0.78, 0.42], C('#2a2c30'));
  } else { vq(B, 'prop', T, [-0.35, 0.3], [0.1, 0.3], 0.76, 0.9, PU('books'), WHITE); cyl(B, 'metal', T, 0.3, 0.2, 0.76, 1.1, 0.012, 0.012, 5, C('#444'), null, false); cyl(B, 'glow', T, 0.3, 0.24, 1.02, 1.12, 0.08, 0.04, 8, [1.2, 1.15, 1], dotUV(GU('s_warm'))); }
  vq(B, 'prop', T.sub(0, 0, 0), [-w / 2 + 0.05, 0.013], [w / 2 - 0.45, 0.013], 1.05, 1.4, PU('books'), WHITE); bx(F, 'prop', T, [-w / 2 + 0.03, 1.02, 0.02, w / 2 - 0.43, 1.05, 0.26], WHITE, wd); // 牆上的書架
  const S = T.sub(o.chairX || 0, 0, 0.8, Math.PI), cc = col3(o.chair || '#2f3b52');
  bx(F, 'prop', S, [-0.23, 0.44, -0.22, 0.23, 0.5, 0.22], cc); bx(F, 'prop', S, [-0.22, 0.5, -0.25, 0.22, 0.98, -0.2], cc); cyl(B, 'metal', S, 0, 0, 0.06, 0.44, 0.025, 0.025, 6, C('#555'), null, false);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; tube(B, 'metal', S.p(0, 0.06, 0), S.p(Math.cos(a) * 0.26, 0.04, Math.sin(a) * 0.26), 0.015, 0.015, 3, C('#333')); }
  colT(F, T, -w / 2, 0, w / 2, 0.6, 0.76); const p = S.p(0, 0, 0); colC(F, p[0], p[2], 0.26, 1.0); blob(F, -w / 2, 0, w / 2, 0.6, 0.8, T);
  spot(F, 'sit', T, o.chairX || 0, 0.78, HP, 0.5, o.room);
}
// 冷氣（分離式室內機）：T＝牆
function acUnit(F, T, y = 2.35) {
  bx(F, 'shiny', T, [-0.43, y, 0.01, 0.43, y + 0.28, 0.21], C('#f4f5f4')); hq(F.B, 'prop', T, -0.4, 0.05, 0.4, 0.2, y - 0.001, dotUV(PU('white')), C('#707478'), false);
  vq(F.B, 'glow', T, [0.25, 0.211], [0.33, 0.211], y + 0.06, y + 0.1, dotUV(GU('s_green')), [0.6, 1.3, 0.8]);
}
// 書櫃
function bookshelf(F, T, o = {}) {
  const w = o.w || 0.9, h = o.h || 1.8, wd = LWOOD(), n = Math.floor(h / 0.36);
  bx(F, 'prop', T, [-w / 2, 0, 0.02, w / 2, h, 0.34], WHITE, { pz: false, _: wd });
  vq(F.B, 'prop', T, [-w / 2, 0.021], [w / 2, 0.021], 0, h, dotUV(PU('lwood')), C('#9a7a54'));
  for (let i = 0; i < n; i++) { const y = 0.04 + i * (h / n); bx(F, 'prop', T, [-w / 2, y - 0.03, 0.02, w / 2, y, 0.34], WHITE, wd); vq(F.B, 'prop', T, [-w / 2 + 0.03, 0.3], [w / 2 - 0.03, 0.3], y, y + h / n - 0.06, PU('books'), WHITE); }
  colT(F, T, -w / 2, 0, w / 2, 0.36, h); blob(F, -w / 2, 0, w / 2, 0.36, 0.7, T);
}
// 洗衣機（直立式）
function washer(F, T) {
  bx(F, 'shiny', T, [-0.3, 0.03, 0.04, 0.3, 0.92, 0.64], C('#f2f3f4')); hq(F.B, 'prop', T, -0.24, 0.12, 0.24, 0.5, 0.921, dotUV(PU('white')), C('#b9c7d4'));
  bx(F, 'prop', T, [-0.3, 0.92, 0.04, 0.3, 1.02, 0.14], C('#e8eaec')); vq(F.B, 'glow', T, [-0.12, 0.141], [0.12, 0.141], 0.95, 1.0, dotUV(GU('s_blue')), [0.7, 0.9, 1.3]);
  colT(F, T, -0.3, 0, 0.3, 0.66, 1.0); blob(F, -0.3, 0, 0.3, 0.66, 0.8, T);
}
// 曬衣架（衣服鏤空）
function dryRack(F, T, L = 1.4) {
  const B = F.B, m = C('#c9cdd2');
  for (const x of [-L / 2, L / 2]) { cyl(B, 'metal', T, x, 0, 0, 1.55, 0.015, 0.015, 5, m, null, false); tube(B, 'metal', T.p(x, 0.02, -0.25), T.p(x, 0.02, 0.25), 0.015, 0.015, 4, m); }
  tube(B, 'metal', T.p(-L / 2, 1.55, 0), T.p(L / 2, 1.55, 0), 0.012, 0.012, 4, m);
  vq(B, 'cut', T, [-L / 2 + 0.05, 0], [L / 2 - 0.05, 0], 0.75, 1.55, PU('clothes'), WHITE, true);
  colT(F, T, -L / 2, -0.25, L / 2, 0.25, 1.55);
}
// 紙箱一疊（儲藏）
function boxes(F, T, n = 3, seed = 1) {
  const R = rng(seed); let y = 0;
  for (let i = 0; i < n; i++) { const w = 0.35 + R() * 0.25, d = 0.3 + R() * 0.2, h = 0.25 + R() * 0.2, x = (R() - 0.5) * 0.1; bx(F, 'prop', T, [x - w / 2, y, -d / 2, x + w / 2, y + h, d / 2], pick(R, ['#c9a878', '#b8946a', '#d8bc8e', '#5a7ea8'])); y += h; }
  colT(F, T, -0.33, -0.28, 0.33, 0.28, y); blob(F, -0.3, -0.25, 0.3, 0.25, 0.7, T);
}
// 盆栽（地上）
function plant(F, T, s = 1) {
  const B = F.B; cyl(B, 'prop', T, 0, 0, 0, 0.3 * s, 0.14 * s, 0.18 * s, 8, C('#b5694a'));
  for (let k = 0; k < 3; k++) vq(B, 'cut', T.sub(0, 0, 0, (k / 3) * Math.PI), [-0.35 * s, 0], [0.35 * s, 0], 0.22 * s, 1.1 * s, PU('plant'), WHITE, true);
  const p = T.p(0, 0, 0); colC(F, p[0], p[2], 0.2 * s, 1); blob(F, -0.18, -0.18, 0.18, 0.18, 0.6, T);
}
// 小板凳（紅色塑膠）：放人坐
function stool(F, T, col = '#d9403a', sit = true, rm) { cyl(F.B, 'shiny', T, 0, 0, 0, 0.44, 0.13, 0.16, 10, col3(col), null, true); const p = T.p(0, 0, 0); colC(F, p[0], p[2], 0.17, 0.45); if (sit) spot(F, 'sit', T, 0, 0, -HP, 0.46, rm); }

// ---- 擺家具：走道（膠囊）不能擋、家具不能重疊；幾個位置試試看，第一個放得下的就放 ----
function path(F, x0, z0, x1, z1, r = 0.45) { F.paths.push({ x0, z0, x1, z1, r }); }
const rectDist = (r, x, z) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
function fits(F, r) {
  for (const p of F.paths) { const n = Math.max(1, Math.ceil(Math.hypot(p.x1 - p.x0, p.z1 - p.z0) / 0.08)); for (let i = 0; i <= n; i++) { const t = i / n; if (rectDist(r, p.x0 + (p.x1 - p.x0) * t, p.z0 + (p.z1 - p.z0) * t) < p.r) return false; } }
  for (const q of F.occ) if (r.x0 < q.x1 - 0.01 && r.x1 > q.x0 + 0.01 && r.z0 < q.z1 - 0.01 && r.z1 > q.z0 + 0.01) return false;
  if (F.lim) for (const q of F.lim) if (r.x0 >= q.x0 - 0.01 && r.x1 <= q.x1 + 0.01 && r.z0 >= q.z0 - 0.01 && r.z1 <= q.z1 + 0.01) return true;
  return !F.lim;
}
function fpRect(T, fp) { const q = [T.p(fp[0], 0, fp[1]), T.p(fp[2], 0, fp[3]), T.p(fp[0], 0, fp[3]), T.p(fp[2], 0, fp[1])], xs = q.map((p) => p[0]), zs = q.map((p) => p[2]); return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }; }
// 店：進門站的地方往裡面看的那條線（F.doorLine）：高的東西（貨架、冰箱、牆櫃）不放在正前方，一進門就看得到整間店；擋到的位置換成 null（place 會跳過）
function offLine(F, cands, fp) {
  const p = F.doorLine; if (!p) return cands;
  return cands.map((T) => {
    if (!T) return T; const r = fpRect(T, fp), n = Math.max(1, Math.ceil(Math.hypot(p.x1 - p.x0, p.z1 - p.z0) / 0.08));
    for (let i = 0; i <= n; i++) { const t = i / n; if (rectDist(r, p.x0 + (p.x1 - p.x0) * t, p.z0 + (p.z1 - p.z0) * t) < p.r) return null; }
    return T;
  });
}
// 擺了會不會擋路：格子 0.1 公尺、人半徑 0.32（int-node-check.mjs 用 0.3）；F.walk 有的話，每擺一樣就從進來的地方淹一次，
// 出口、房間（probe）、站的點（0.4 公尺內）、坐的點（1 公尺內）都要走得到，不然拿掉（網格、碰撞、spots 退回去）換下一個位置
const GS = 0.1, GRAD = 0.32;
function cdist(c, x, z) { const dx = x - c.x, dz = z - c.z; if (c.t === 'circle') return Math.sqrt(dx * dx + dz * dz) - c.r; const cr = Math.cos(c.rot || 0), sr = Math.sin(c.rot || 0), lx = Math.max(Math.abs(dx * cr - dz * sr) - c.hx, 0), lz = Math.max(Math.abs(dx * sr + dz * cr) - c.hz, 0); return Math.sqrt(lx * lx + lz * lz); }
function gmark(W, g, c) {
  if ((c.h ?? 1) <= 0.05) return;
  const e = (c.t === 'circle' ? c.r : Math.hypot(c.hx, c.hz)) + GRAD;
  const i0 = Math.max(0, Math.floor((c.x - e - W.x0) / GS)), i1 = Math.min(W.nx - 1, Math.floor((c.x + e - W.x0) / GS)), j0 = Math.max(0, Math.floor((c.z - e - W.z0) / GS)), j1 = Math.min(W.nz - 1, Math.floor((c.z + e - W.z0) / GS));
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = i * W.nz + j; if (!g[k] && cdist(c, W.x0 + (i + 0.5) * GS, W.z0 + (j + 0.5) * GS) < GRAD) g[k] = 1; }
}
function walkInit(F, starts) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const r of F.rooms) { x0 = Math.min(x0, r.x0); x1 = Math.max(x1, r.x1); z0 = Math.min(z0, r.z0); z1 = Math.max(z1, r.z1); }
  for (const e of F.exits) { x0 = Math.min(x0, e.x - e.hx); x1 = Math.max(x1, e.x + e.hx); z0 = Math.min(z0, e.z - e.hz); z1 = Math.max(z1, e.z + e.hz); }
  x0 -= 0.3; z0 -= 0.3; x1 += 0.3; z1 += 0.3;
  const W = { x0, z0, nx: Math.ceil((x1 - x0) / GS), nz: Math.ceil((z1 - z0) / GS), n0: 0, starts: starts.filter(Boolean) };
  W.base = new Uint8Array(W.nx * W.nz); W.seen = new Uint8Array(W.nx * W.nz); W.stack = new Int32Array(W.nx * W.nz);
  F.walk = W; walkSync(F);
  if (!walkOK(F, W.base)) F.walk = null; // 牆本身就不通（不應該）：不檢查，讓測試抓
}
function walkSync(F) { const W = F.walk; for (; W.n0 < F.cols.length; W.n0++) gmark(W, W.base, F.cols[W.n0]); }
function walkOK(F, g) {
  const W = F.walk, seen = W.seen, st = W.stack, nz = W.nz; seen.fill(0); let sp = 0;
  const cell = (x, z) => { const i = Math.floor((x - W.x0) / GS), j = Math.floor((z - W.z0) / GS); return i < 0 || j < 0 || i >= W.nx || j >= nz ? -1 : i * nz + j; };
  for (const s of W.starts) { const k = cell(s.x, s.z); if (k >= 0 && !g[k] && !seen[k]) { seen[k] = 1; st[sp++] = k; } }
  if (!sp) return false;
  while (sp) {
    const k = st[--sp], i = (k / nz) | 0, j = k - i * nz;
    if (i > 0 && !g[k - nz] && !seen[k - nz]) { seen[k - nz] = 1; st[sp++] = k - nz; }
    if (i < W.nx - 1 && !g[k + nz] && !seen[k + nz]) { seen[k + nz] = 1; st[sp++] = k + nz; }
    if (j > 0 && !g[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; st[sp++] = k - 1; }
    if (j < nz - 1 && !g[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; st[sp++] = k + 1; }
  }
  const reach = (x, z, m) => {
    const n = Math.ceil(m / GS) + 1, ci = Math.floor((x - W.x0) / GS), cj = Math.floor((z - W.z0) / GS);
    for (let i = Math.max(0, ci - n); i <= Math.min(W.nx - 1, ci + n); i++) for (let j = Math.max(0, cj - n); j <= Math.min(nz - 1, cj + n); j++) {
      if (!seen[i * nz + j]) continue; const dx = W.x0 + (i + 0.5) * GS - x, dz = W.z0 + (j + 0.5) * GS - z; if (dx * dx + dz * dz <= m * m) return true;
    }
    return false;
  };
  for (const e of F.exits) { const ok = reach(e.x, e.z, Math.hypot(e.hx, e.hz)) && (() => { for (let i = Math.max(0, Math.floor((e.x - e.hx - W.x0) / GS)); i <= Math.min(W.nx - 1, Math.floor((e.x + e.hx - W.x0) / GS)); i++) for (let j = Math.max(0, Math.floor((e.z - e.hz - W.z0) / GS)); j <= Math.min(nz - 1, Math.floor((e.z + e.hz - W.z0) / GS)); j++) { const cx = W.x0 + (i + 0.5) * GS, cz = W.z0 + (j + 0.5) * GS; if (seen[i * nz + j] && Math.abs(cx - e.x) <= e.hx - 0.05 && Math.abs(cz - e.z) <= e.hz - 0.05) return true; } return false; })(); if (!ok) return false; }
  for (const r of F.named) if (r.probe && !reach(r.probe[0], r.probe[1], 0.3)) return false;
  for (const k of ['stand', 'counter', 'pray']) for (const q of F.spots[k]) if (!reach(q.x, q.z, 0.4)) return false;
  for (const q of F.spots.sit) if (!reach(q.x, q.z, 1.0)) return false;
  return true;
}
function snapF(F) { const b = new Map(); for (const [m, g] of F.B.bins) b.set(m, [g.p.n, g.n.n, g.u.n, g.c.n]); const sp = {}; for (const k in F.spots) sp[k] = F.spots[k].length; return { b, tris: F.B.tris, cols: F.cols.length, sp }; }
function rollback(F, S) { for (const [m, g] of F.B.bins) { const q = S.b.get(m) || [0, 0, 0, 0]; g.p.n = q[0]; g.n.n = q[1]; g.u.n = q[2]; g.c.n = q[3]; } F.B.tris = S.tris; F.cols.length = S.cols; for (const k in S.sp) F.spots[k].length = S.sp[k]; }
// cands：frame 的陣列（null 跳過）；fp：佔的地方（T 裡面的 [x0, z0, x1, z1]，包含前面要留的空間）；tall：高的東西，不擋進門的視線（offLine）
function place(F, cands, fp, draw, tall = false) {
  if (tall) cands = offLine(F, cands, fp);
  for (const T of cands) {
    if (!T) continue; const r = fpRect(T, fp); if (!fits(F, r)) continue;
    F.occ.push(r);
    if (!F.walk) { draw(T); return T; }
    walkSync(F); const S = snapF(F); draw(T);
    const W = F.walk, g = W.base.slice(); for (let k = S.cols; k < F.cols.length; k++) gmark(W, g, F.cols[k]);
    if (walkOK(F, g)) { W.base = g; W.n0 = F.cols.length; return T; }
    rollback(F, S); F.occ.pop(); F.rejects = (F.rejects || 0) + 1;
  }
  return null;
}
// 沙發前面留一條走道（0.6 公尺，人走得到每一個位子），茶几放在走道外面
function lane(F, T, hl, z = 1.12) { const a = T.p(-hl + 0.1, 0, z), b = T.p(hl - 0.1, 0, z); path(F, a[0], a[2], b[0], b[2], 0.3); }
// 沙發＋茶几：茶几靠沙發的一頭，另一頭（靠房間中間 zm 那頭）留 0.6 公尺以上的縫走進沙發前面
function sofaTable(F, T, hl, zm, o = {}) {
  const L = hl * 2 >= 1.9 ? (o.L || 1.1) : 0.72, D = o.D || 0.55, side = -(zm - T.z) * Math.sin(T.ry) < 0 ? 1 : -1, d = side * (hl - L / 2 - 0.02);
  lane(F, T, hl);
  const tT = place(F, [T.sub(d, 0, 1.8), T.sub(d, 0, 1.95)], [-L / 2, -D / 2, L / 2, D / 2], (T2) => teaTable(F, T2, { L, D, fruit: L >= 1 }));
  const gx = (d - side * L / 2 - side * hl) / 2, a = T.p(gx, 0, 1.12), b = T.p(gx, 0, 2.7); path(F, a[0], a[2], b[0], b[2], 0.3);
  return tT;
}
const occupy = (F, x0, z0, x1, z1) => F.occ.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });

// ---- 透天厝 ----
// 招牌上的字 → 一樓開什麼店（村子的橫招牌、直立招牌；第 3 批 street.js 掛的招牌也寫在 name／sign）：前面的先比
const BIZ = [['檳榔', 'betel'], ['雜貨', 'grocery'], ['自助餐', 'buffet'], ['便當', 'buffet'], ['滷味', 'noodle'], ['碳烤', 'noodle'], ['麵', 'noodle'], ['機車', 'scooter'], ['理髮', 'barber'], ['美髮', 'barber'], ['剪髮', 'barber'],
  ['冰', 'ice'], ['豆花', 'ice'], ['早餐', 'breakfast'], ['紅茶', 'tea'], ['茶飲', 'tea'], ['飲料', 'tea'], ['藥', 'pharmacy'], ['五金', 'hardware'], ['水電', 'hardware'], ['冷氣', 'hardware'],
  ['洗衣', 'laundry'], ['眼鏡', 'optical'], ['當舖', 'pawn'], ['診所', 'clinic'], ['補習', 'school']];
const BIZ_NAME = { grocery: '雜貨店', noodle: '麵店', scooter: '機車行', barber: '理髮廳', ice: '冰店', breakfast: '早餐店', pharmacy: '藥局', betel: '檳榔攤',
  buffet: '自助餐', tea: '飲料店', hardware: '五金行', laundry: '洗衣店', optical: '眼鏡行', pawn: '當舖', clinic: '診所', school: '補習班' };
// 只有直立招牌（沒有店名）的：照招牌的字取名字
const SIGN_NAME = { 早餐: '早餐店', 麵店: '麵店', 機車: '機車行', 機車行: '機車行', 理髮: '理髮廳', 美髮: '美髮院', 冰店: '冰店', 藥局: '藥局', 檳榔: '檳榔攤', 雜貨店: '雜貨店',
  五金: '五金行', 水電: '水電行', 冷氣: '冷氣行', 當舖: '當舖', 診所: '診所', 補習班: '補習班', 茶飲: '茶飲店' };
const shopName = (b, biz) => b.name || (b.sign && SIGN_NAME[b.sign]) || BIZ_NAME[biz];
const CNUM = ['', '一', '二', '三', '四', '五', '六'];
const WALLC = ['#f3efe6', '#eef3ea', '#e8eff4', '#f6ecdf', '#f3e9ec', '#fbf8f0', '#e6efe9', '#f4f1e1', '#eef0f3'];
const seedOf = (b) => (Math.imul(Math.round(b.x * 10), 73856093) ^ Math.imul(Math.round(b.z * 10), 19349663)) >>> 0;
function bizOf(b) {
  const t = b.name || b.sign || ''; for (const [k, v] of BIZ) if (t.includes(k)) return v;
  if (b.kind === 'shop') return ['grocery', 'noodle', 'scooter'][(hash2(Math.round(b.x), Math.round(b.z)) * 3) | 0]; // 舊版 village.js 沒記店名
  return null;
}
// 一棟透天厝的尺寸、格局（每一層做什麼）
function houseInfo(b) {
  const t = 0.2, hx = b.hx, hz = b.hz, X0 = -hx + t, X1 = hx - t, ZF = hz - t, ZB = -hz + t, W = X1 - X0, Di = ZF - ZB;
  const L1 = clamp(Di * 0.42, 4.3, 5.3), zP = ZF - L1, zS1 = zP - 0.12, zSB = zS1 - 3.2;
  const c = Math.cos(b.rot), s = Math.sin(b.rot), ddx = b.door.x - b.x, ddz = b.door.z - b.z, doorX = ddx * c - ddz * s;
  const R = rng(seedOf(b)), N = Math.max(1, b.floors || Math.round(b.h / FH) || 2), biz = bizOf(b);
  const front = b.front || (b.kind === 'shop' ? 'shop' : Math.abs(doorX) > 0.5 ? 'shutter' : 'door');
  const ss = Math.abs(doorX) > 0.5 ? -Math.sign(doorX) : R() < 0.5 ? -1 : 1;
  const X = (u) => (ss < 0 ? X0 + u : X1 - u), XR = (u0, u1) => { const a = X(u0), q = X(u1); return [Math.min(a, q), Math.max(a, q)]; };
  const Wp = W - 2.1, dww = Wp >= 2.6 ? 1.3 : 1.0, dwU = 2.1 + Wp / 2;
  const altarFl = biz ? N - 1 : N >= 3 && R() < 0.35 ? N - 1 : 0;
  const frontUse = [], backUse = [];
  for (let n = 0; n < N; n++) {
    frontUse.push(n === 0 ? (biz ? 'shop' : 'living') : n === altarFl ? 'shrine' : 'bed');
    if (n === 0) backUse.push('kitchen');
    else { const top = n === N - 1, deep = zSB - ZB >= 3.75; backUse.push(top && R() < 0.5 ? 'laundry' : deep && R() < 0.5 ? 'bed2' : pick(R, ['family', 'study', deep ? 'bed2' : 'family'])); }
  }
  if (N >= 2 && !backUse.includes('family') && N >= 3) backUse[1] = 'family';
  const ups = Array.isArray(b.up) ? b.up : null;
  const pal = {
    liv: pick(R, ['terrazzo', 'terrazzo', 'tileW', 'tileB']), up: pick(R, ['tileW', 'terrazzo', 'wood', 'tileW']), kit: pick(R, ['tileB', 'mosaic', 'terrazzo']),
    wall: pick(R, WALLC), wall2: pick(R, WALLC), bedW: [pick(R, WALLC), pick(R, WALLC), pick(R, WALLC), pick(R, WALLC), pick(R, WALLC)],
    sofa: pick(R, ['#b5453a', '#8a5a3a', '#6e7f5a', '#4f6b8a', '#a8803e']), quilt: [pick(R, ['#f5b7c8', '#9ec9ea', '#f4d27a', '#b8dcb0', '#e6b8e0']), pick(R, ['#f5b7c8', '#9ec9ea', '#f4d27a', '#b8dcb0']), pick(R, ['#f5b7c8', '#9ec9ea', '#f4d27a', '#b8dcb0'])],
    scooter: pick(R, ['#f2f3f5', '#d0342c', '#2f6fd6', '#c3c8ce', '#ff8fb5', '#f2c230', '#1d1f23']), fridge: pick(R, ['#eef0f1', '#dfe6ea', '#f2e6d8', '#e8f0e6']), rice: pick(R, ['#d8342c', '#3f8f5a', '#eef0f1', '#e9a8b8']),
    tv: pick(R, ['tvA', 'tvB', 'tvC']), view: R() < 0.5 ? 'street' : 'street2', voff: R(),
  };
  return { b, R, t, hx, hz, X0, X1, ZF, ZB, W, zP, zS1, zSB, ss, X, XR, Wp, dww, dwU, N, biz, front, doorX, frontUse, backUse, ups, pal, altarFl };
}
const upKind = (H, n) => (H.ups && H.ups[n - 1]) || (hash2(seedOf(H.b), n) < 0.5 ? 'b' : 'w');
// 房間名字
function roomNames(H, n) {
  const fu = H.frontUse[n], bu = H.backUse[n];
  const f = fu === 'living' ? '客廳' : fu === 'shop' ? shopName(H.b, H.biz) : fu === 'shrine' ? '神明廳' : n === 1 ? '主臥室' : '臥室';
  const k = bu === 'kitchen' ? '廚房' : bu === 'family' ? '起居室' : bu === 'study' ? '書房' : bu === 'laundry' ? '洗衣間' : n >= 2 ? '小孩房' : '臥室';
  return [f, k];
}
// 一層樓
function houseFloor(H, n) {
  const { b, R, X0, X1, ZF, ZB, W, zP, zS1, zSB, ss, X, XR, Wp, dww, dwU, N } = H;
  const F = newFloor({ index: n, label: n + 1 + 'F' }); F.paths = []; F.occ = [];
  const fu = H.frontUse[n], bu = H.backUse[n], [fName, kName] = roomNames(H, n), pal = H.pal, shop = fu === 'shop';
  const wc = n === 0 ? pal.wall : pal.bedW[n % 5], wc2 = n === 0 ? pal.wall2 : pal.bedW[(n + 2) % 5];
  const skirt = (c) => mul(C(c), 0.72);
  const S_front = sf('plaster', shop && ['grocery', 'pharmacy', 'clinic', 'optical', 'laundry', 'school'].includes(H.biz) ? '#fafaf8' : wc, 'wall', { skirt: skirt(wc) });
  const S_pass = sf('plaster', wc2, 'wall', { skirt: skirt(wc2) });
  const S_kit = sf('plaster', '#f5f3ec', 'wall', { wain: { h: 1.6, s: sf('ktile', WHITE, 'wall', { noSkirt: true }) } });
  const S_back = bu === 'kitchen' ? S_kit : sf('plaster', pal.bedW[(n + 1) % 5], 'wall', { skirt: skirt(pal.bedW[(n + 1) % 5]) });
  const S_shaft = sf('plaster', '#efece4', 'wall');
  const floorF = sf(n === 0 ? (shop ? ({ grocery: 'tileW', pharmacy: 'tileW', noodle: 'mosaic', ice: 'mosaic', breakfast: 'tileB', scooter: 'granite', barber: 'terrazzo', betel: 'terrazzo',
      buffet: 'mosaic', tea: 'tileB', hardware: 'granite', laundry: 'tileW', optical: 'tileW', pawn: 'terrazzo', clinic: 'tileW', school: 'tileB' }[H.biz] || 'tileW') : pal.liv) : fu === 'shrine' ? 'tileW' : pal.up, H.biz === 'scooter' && n === 0 ? C('#9a9a98') : WHITE, 'floor');
  const floorB = sf(n === 0 ? pal.kit : bu === 'laundry' ? 'tileB' : pal.up, WHITE, 'floor');
  const ceil = sf(shop && ['grocery', 'pharmacy', 'barber', 'clinic', 'optical', 'laundry', 'school', 'hardware'].includes(H.biz) ? 'ceil' : 'plaster', '#fbfbf8');
  const bed2 = bu === 'bed2', zH = zSB - 1.5; // 後面房間的隔間（樓梯口淨深 1.34 公尺：上樓站的地方離隔間 0.5 公尺以上）
  // 房間
  const [px0, px1] = XR(2.1, W), [sx0, sx1] = XR(0, 2.0);
  room(F, fName, X0, X1, zP, ZF, { floor: floorF, ceil, probe: [X(dwU), zP + 0.8] });
  room(F, n === 0 && H.Wp >= 2.4 && !shop ? '餐廳' : '走道', px0, px1, zSB, zS1, { floor: sf(n === 0 ? pal.liv : pal.up, WHITE, 'floor'), ceil: sf('plaster', '#fbfbf8'), probe: [X(W - 0.55), (zSB + zS1) / 2] });
  if (bed2) { room(F, '樓梯口', X0, X1, zH + 0.06, zSB, { floor: sf(pal.up, WHITE, 'floor'), ceil: sf('plaster', '#fbfbf8'), probe: [X(W - 0.6), zSB - 0.6] }); room(F, kName, X0, X1, ZB, zH - 0.06, { floor: sf('wood', WHITE, 'floor'), ceil: sf('plaster', '#fbfbf8'), probe: [X(W - 0.7), zH - 0.7] }); }
  else room(F, kName, X0, X1, ZB, zSB, { floor: floorB, ceil: sf('plaster', '#fbfbf8'), probe: [X(W - 0.6), zSB - 0.7] });
  room(F, null, sx0, sx1, zSB, zS1, { h: n < N - 1 ? 4.8 : F.ch });
  // 牆：兩邊的牆（共同壁，沒有窗）
  const side = (z0, z1, s, onlyPass = false) => {
    for (const sg of [-1, 1]) {
      if (onlyPass && (sg < 0) === (ss < 0)) continue; // 樓梯那邊的牆（樓梯間自己畫）
      wall(F, 'z', sg < 0 ? X0 - 0.1 : X1 + 0.1, z0, z1, { t: 0.2, p: sg < 0 ? s : null, n: sg > 0 ? s : null, col: false });
    }
  };
  side(zP, ZF, S_front); side(zSB, zS1, S_pass, true);
  if (bed2) { side(zH + 0.06, zSB, S_pass); side(ZB, zH - 0.06, S_back); } else side(ZB, zSB, S_back);
  colBox(F, -H.hx - 0.3, -H.hz, X0, H.hz, 3); colBox(F, X1, -H.hz, H.hx + 0.3, H.hz, 3);
  // 正面
  const fops = [], fw = { view: n === 0 ? pal.view : n === 1 ? 'street2' : 'roofs', voff: pal.voff, out: 1, t: 0.2, n: S_front, p: null };
  const doors = []; // 走得出去的洞（一樓）
  if (n === 0) {
    const hx = H.hx, w = hx * 2;
    // 跟外面（village.js）一樣：店面＝整片打開；鐵捲門（寬的）＝鐵捲門關著＋旁邊小門；鐵捲門（窄的）＝從鐵捲門進來（捲起來，裡面鋁門窗）；大門＋窗
    if (H.front === 'shop') { const o = { a: X0 + 0.12, b: X1 - 0.12, y0: 0, y1: 2.72, k: 'open', roll: true }; fops.push(o); doors.push(o); }
    else if (H.front === 'shutter') {
      if (w >= 5) {
        const sw = Math.min(3.4, w - 1.7), a = Math.max(X0 + 0.05, -hx + 0.25), bb = -hx + 0.25 + sw;
        const sa = ss < 0 ? a : -bb, sb = ss < 0 ? bb : -a; // 鐵捲門在樓梯那一邊（門的另一邊）
        const da = ss < 0 ? hx - 1.45 : -(hx - 0.25), db = ss < 0 ? hx - 0.25 : -(hx - 1.45);
        fops.push({ a: sa, b: sb, y0: 0, y1: 2.7, k: 'shutter', tint: pick(R, ['#f2f4f5', '#e4f3ee', '#e6edf8', '#f6efdf']) });
        const d = { a: Math.max(da, X0 + 0.1), b: Math.min(db, X1 - 0.1), y0: 0, y1: 2.3, k: 'door', leaves: 1, hinge: ss < 0 ? 'b' : 'a', frame: '#9aa0a6' }; fops.push(d); doors.push(d);
      } else { // 窄的：鐵捲門捲起來，裡面一整片鋁門窗（中間兩片開著）
        const d = { a: -0.85, b: 0.85, y0: 0, y1: 2.3, k: 'door', leaves: 2, frame: '#b7bcc2' }; fops.push(d); doors.push(d);
        fops.push({ a: X0 + 0.1, b: -0.95, y0: 0, y1: 2.3, k: 'glass', frame: '#b7bcc2' }, { a: 0.95, b: X1 - 0.1, y0: 0, y1: 2.3, k: 'glass', frame: '#b7bcc2' });
        F.rollBox = true;
      }
    } else { // 大門＋兩邊窗
      const d = { a: -0.8, b: 0.8, y0: 0, y1: 2.3, k: 'door', leaves: 2, frame: pick(R, ['#8f7a5e', '#6e5a44', '#9aa0a6']) }; fops.push(d); doors.push(d);
      if (X0 < -1.35) { const cu = pick(R, ['#f3e6c8', '#d7e6f2', '#f2d7da', '#e0ecd8']); fops.push({ a: X0 + 0.15, b: -1.05, y0: 0.9, y1: 2.3, k: 'win', curtain: cu, grille: 'grille1' }, { a: 1.05, b: X1 - 0.15, y0: 0.9, y1: 2.3, k: 'win', curtain: cu, grille: 'grille1' }); }
    }
  } else if (upKind(H, n) === 'b') { const dw = Math.min(3.2, H.hx * 2 - 1.2); fops.push({ a: -dw / 2, b: dw / 2, y0: 0, y1: 2.35, k: 'balc' }); fw.vdist = 1.5; }
  else { const gw = Math.min(2.6, H.hx * 2 - 1.3); fops.push({ a: -gw / 2, b: gw / 2, y0: 0.85, y1: 2.3, k: 'win', curtain: pick(R, ['#f3e6c8', '#d7e6f2', '#f2d7da', '#e0ecd8', '#fff']), grille: pick(R, ['grille1', 'grille2', 'grille3']) }); }
  wall(F, 'x', H.hz - 0.1, X0, X1, { ...fw, ops: fops });
  // 後面
  const bops = []; let sinkU = 0, cuEnd = 0;
  if (n === 0) {
    cuEnd = clamp(W - 1.95, 1.4, 2.8); sinkU = cuEnd - 0.6;
    const [wa, wb] = XR(sinkU - 0.5, sinkU + 0.5); bops.push({ a: wa, b: wb, y0: 1.1, y1: 2.0, k: 'win', grille: 'grille2' });
    const [da, db] = XR(W - 1.1, W - 0.25); bops.push({ a: da, b: db, y0: 0, y1: 2.1, k: 'closed', leafCol: '#b9c2c8', tex: 'door' });
  } else { const ww = Math.min(1.8, W - 1.4), cu = pick(R, ['#f3e6c8', '#d7e6f2', '#f2d7da', '#e0ecd8']); bops.push({ a: -ww / 2, b: ww / 2, y0: 0.9, y1: 2.2, k: 'win', curtain: bu === 'laundry' ? null : cu, grille: pick(R, ['grille1', 'grille2']) }); }
  wall(F, 'x', -H.hz + 0.1, X0, X1, { t: 0.2, p: S_back, out: -1, view: n <= 1 ? 'green' : 'roofs', voff: (pal.voff + 0.37) % 1, ops: bops });
  // 隔間（客廳和樓梯、走道之間）
  const [dwa, dwb] = XR(dwU - dww / 2, dwU + dww / 2), [st0, st1] = XR(0, 2.1);
  wall(F, 'x', zP - 0.06, st0, st1, { p: S_front, n: null });
  wall(F, 'x', zP - 0.06, px0, px1, { p: S_front, n: S_pass, ops: [{ a: dwa, b: dwb, y0: 0, y1: 2.1, k: 'idoor', leaf: !shop && fu !== 'living', hinge: ss < 0 ? 'b' : 'a', swing: 1 }] });
  // 樓梯的內牆（走道那面）、樓梯口那面牆
  wall(F, 'z', X(2.05), zSB, zS1, { t: 0.1, p: ss < 0 ? S_pass : null, n: ss > 0 ? S_pass : null });
  const up = n < N - 1, down = n > 0, [ha0, ha1] = XR(1.05, 2.0), [hb0, hb1] = XR(0, 0.95);
  wall(F, 'x', zSB - 0.05, st0, st1, { t: 0.1, n: S_back.wain ? sf('plaster', '#f5f3ec', 'wall', { skirt: skirt('#f5f3ec') }) : S_back, p: S_shaft, ops: [
    up ? { a: ha0, b: ha1, y0: 0, y1: 2.3, k: 'open' } : { a: ha0 + 0.08, b: ha1 - 0.08, y0: 0, y1: 2.05, k: 'closed', leafCol: '#c8b8a0' },
    down ? { a: hb0, b: hb1, y0: 0, y1: 2.3, k: 'open' } : { a: hb0 + 0.1, b: hb1 - 0.06, y0: 0, y1: 2.0, k: 'closed', leafCol: '#e8e2d6' }] });
  if (bed2) { const [ba, bb] = XR(W - 1.15, W - 0.25); wall(F, 'x', zH, X0, X1, { p: S_pass, n: S_back, ops: [{ a: ba, b: bb, y0: 0, y1: 2.1, k: 'idoor', hinge: ss < 0 ? 'a' : 'b', swing: -1 }] }); }
  ready(F);
  if (F.rollBox) box(F.B, 'metal', F0, [X0 + 0.05, 2.42, ZF - 0.3, X1 - 0.05, 2.72, ZF], C('#a5abb1')); // 窄的鐵捲門捲起來的盒子（裡面看）
  stairShaft(F, H, n, S_shaft);
  // 陽台（落地門外面）
  if (fops.some((o) => o.k === 'balc')) balcony(F, H, n);
  // 走得出去（一樓的門）：出口、外面擋住、進來站的地方
  for (const d of doors) {
    exitZone(F, d.a + 0.12, ZF - 0.55, d.b - 0.12, H.hz + 0.35, 'outside', null);
    colBox(F, d.a - 0.3, H.hz + 0.3, d.b + 0.3, H.hz + 0.8, 2.6);
  }
  if (n === 0) {
    const d = doors.find((o) => H.doorX >= o.a - 0.05 && H.doorX <= o.b + 0.05) || doors[0], sx = clamp(d.k === 'open' ? X(dwU) : H.doorX, d.a + 0.35, d.b - 0.35); // 整片打開的店面：站在正對後面門口的走道上
    F.spawnIn = { x: sx, z: ZF - 1.15, lh: HP };
    if (shop) F.doorLine = { x0: sx, z0: ZF - 1.15, x1: sx, z1: Math.max(zP + 1.2, ZF - 2.75), r: 0.36 }; // 進門往前 1.6 公尺看得到店裡（offLine）
    // 店：門在旁邊的話先斜斜走到正對後面門口，再直直走進去（不要斜斜切過整間店，靠牆的地方才放得下櫃子、桌子）
    if (shop && Math.abs(sx - X(dwU)) > 0.05) { const zk = Math.max(zP + 1.0, ZF - 1.6); path(F, sx, ZF - 0.9, X(dwU), zk, 0.4); path(F, X(dwU), zk, X(dwU), zP + 0.45, 0.4); }
    else path(F, sx, ZF - 0.9, X(dwU), zP + 0.45, shop ? 0.4 : 0.46);
    for (const o of doors) if (o !== d) path(F, (o.a + o.b) / 2, ZF - 0.9, X(dwU), zP + 0.45, 0.4); // 每一個門口都走得到後面
    for (const o of doors) path(F, (o.a + o.b) / 2, ZF - 0.5, (o.a + o.b) / 2, o.k === 'open' ? ZF - 1.0 : ZF - 1.3, 0.5);
  }
  // 走道：隔間門口 → 後面；樓梯口一整條；到後門
  path(F, X(dwU), zP + 0.3, X(dwU), zP - 0.6, 0.42);
  path(F, X(dwU), zS1 - 0.3, X(W - 0.55), zS1 - 0.9, 0.42); path(F, X(W - 0.55), zS1 - 0.9, X(W - 0.55), zSB - 0.2, 0.42); // 靠遠的那面牆走（餐桌靠樓梯的牆）
  path(F, X(0.35), zSB - 0.8, X(W - 0.45), zSB - 0.8, 0.5); // 樓梯口一整條：上下樓站的地方（zSB−0.8）前後 0.5 公尺不放家具
  if (n > 0) path(F, X(0.7), zSB - 0.8, X(0.7), zSB - 1.55, 0.4); // 上樓站的地方前面也留空（鏡頭、走路）
  if (n < N - 1) path(F, X(1.525), zSB - 0.8, X(1.525), zSB - 1.55, 0.4);
  if (bed2) path(F, X(W - 0.7), zSB - 0.6, X(W - 0.7), zH - 0.8, 0.44);
  // 燈
  const fc = [(X0 + X1) / 2, (zP + ZF) / 2], bc = [(X0 + X1) / 2, bed2 ? (ZB + zH) / 2 : (ZB + zSB) / 2];
  lamp(F, fc[0], fc[1], shop ? 5 : 3.2, shop ? '#f4f8ff' : '#fff1dc'); lamp(F, bc[0], bc[1], 2.6, '#fff4e6');
  const fx = shop || R() < 0.45 ? 'tube' : 'round';
  if (fx === 'tube') for (const dz of [-0.9, 0.9]) fixture(F, fc[0], fc[1] + dz, 'tube', { L: Math.min(1.8, W - 1) }); else fixture(F, fc[0], fc[1], 'round');
  fixture(F, bc[0], bc[1], bu === 'kitchen' || bu === 'laundry' ? 'tube' : 'round', { L: 1.2 });
  fixture(F, X(W - 1.05), (zSB + zS1) / 2, 'round');
  F.sun = { from: [0.3, 0.75, 1], I: 0.8 }; F.hemi = { sky: '#fffaf2', ground: '#c8b89c', I: 1.55 };
  F.cam = { maxDist: clamp(W * 0.62, 2.1, 3.2), ceiling: F.ch - 0.18, near: 0.1 };
  // 家具
  const ctx = { F, H, n, X, XR, R, cuEnd, sinkU, zH, doors, S_front };
  walkInit(F, [n === 0 ? F.spawnIn : F.stairArrive.fromBelow, n < N - 1 ? F.stairArrive.fromAbove : null]);
  if (fu === 'living') living(ctx); else if (fu === 'shop') shopFront(ctx); else if (fu === 'shrine') shrineRoom(ctx); else bedFront(ctx);
  if (bu === 'kitchen') kitchenBack(ctx); else if (bu === 'bed2') bedBack(ctx); else if (bu === 'family') familyBack(ctx); else if (bu === 'study') studyBack(ctx); else laundryBack(ctx);
  if (n === 0 && H.Wp >= 2.4 && !shop) passageDining(ctx);
  return F;
}
// u 方向的 frame：朝 +u、朝 −u、朝 +z、朝 −z
const faceU = (H, u, z, dir) => frame(H.X(u), 0, z, H.ss < 0 === dir > 0 ? HP : -HP); // dir＞0：+z 朝 +u
// 樓梯間（兩跑）：A 半邊上樓（從後面往前爬到平台）、B 半邊下樓；看得到的都做（踏步、平台、扶手、下面的斜底）
function stairShaft(F, H, n, S) {
  const { X, XR, zSB, zS1, N } = H, B = F.B, up = n < N - 1, down = n > 0, r = 3.3 / 18, g = 0.26, zL = zSB + 8 * g;
  const yb = down ? -3.3 : 0, yt = up ? 4.8 : F.ch, sg = H.ss < 0 ? 1 : -1;
  const [xa0, xa1] = XR(1.05, 2.0), [xb0, xb1] = XR(0, 0.95), [xs0, xs1] = XR(0, 2.0), [xd0, xd1] = XR(0.95, 1.05);
  const fk = { ax: 'z' }, fx = { ax: 'x' };
  wallFace(F, fk, X(0), sg, zSB, zS1, yb, yt, S); wallFace(F, fk, X(2.0), -sg, zSB, zS1, yb, yt, S); wallFace(F, fx, zS1, -1, xs0, xs1, yb, yt, S);
  if (yt > F.ch) wallFace(F, fx, zSB, 1, xs0, xs1, F.ch, yt, S);
  box(B, 'wall', F0, [xd0, down ? yb : 0, zSB, xd1, yt, zL], S.c, { py: false, _: dotUV(SU('plaster')) });
  hq(B, 'wall', F0, xs0, zSB, xs1, zS1, yt, dotUV(SU('plaster')), S.c, false);
  const TU = subUV(SU('terrazzo'), 0.05, 0.05, 0.95, 0.3), tc = WHITE, rc = C('#d6d2ca'), nose = C('#6a665f');
  const tread = (x0, x1, z0, z1, y, riserZ, rdir) => {
    hq(B, 'floor', F0, x0, z0, x1, z1, y, TU, tc);
    if (riserZ != null) vqN(B, 'floor', [x0, riserZ], [x1, riserZ], y - r, y, 0, rdir, TU, rc);
    box(B, 'prop', F0, [x0, y - 0.012, (rdir < 0 ? z0 : z1 - 0.04), x1, y + 0.003, (rdir < 0 ? z0 + 0.04 : z1)], nose);
  };
  const rail = (x, xw, za, ya, zb, yb2) => { tube(B, 'prop', [x, ya, za], [x, yb2, zb], 0.024, 0.024, 6, WHITE, PU('pwood'), true); for (const t of [0.15, 0.85]) { const z = za + (zb - za) * t, y = ya + (yb2 - ya) * t; tube(B, 'metal', [x, y - 0.02, z], [xw, y - 0.02, z], 0.008, 0.008, 3, C('#b0b4b8')); } };
  if (up) {
    for (let i = 1; i <= 8; i++) tread(xa0, xa1, zSB + (i - 1) * g, zSB + i * g, i * r, zSB + (i - 1) * g, -1);
    vqN(B, 'floor', [xa0, zL], [xa1, zL], 8 * r, 9 * r, 0, -1, TU, rc);
    plane(B, 'floor', [xs0, 9 * r, zS1], [1, 0, 0], [0, 0, -1], xs1 - xs0, zS1 - zL, SU('terrazzo'), PER.terrazzo, WHITE, [], [], xs0, -zS1);
    for (let j = 1; j <= 8; j++) tread(xb0, xb1, zL - j * g, zL - (j - 1) * g, 9 * r + j * r, zL - (j - 1) * g, 1); // 第二跑（平台往後爬）
    rail(X(1.94), X(2.0), zSB + 0.05, 0.92, zL, 0.92 + 8 * r); rail(X(0.06), X(0), zL, 0.92 + 9 * r, zSB, 0.92 + 17 * r);
    if (down) { // 下面看上來：第一跑、平台、第二跑的斜底
      const sof = (x0, x1, za, ya, zb, yb2) => F.B.quad('wall', [x1, yb2, zb], [x0, yb2, zb], [x0, ya, za], [x1, ya, za], dotUV(SU('plaster')), mul(S.c, 0.9));
      sof(xa0, xa1, zSB, -0.18, zL, 8 * r - 0.18); hq(B, 'wall', F0, xs0, zL, xs1, zS1, 9 * r - 0.16, dotUV(SU('plaster')), mul(S.c, 0.9), false);
      sof(xb0, xb1, zL, 9 * r - 0.16, zSB, 17 * r - 0.16);
      vqN(B, 'wall', [xb0, zL], [xb1, zL], 9 * r - 0.16, 9 * r, 0, -1, dotUV(SU('plaster')), S.c);
    }
  }
  if (down) {
    for (let j = 1; j <= 8; j++) tread(xb0, xb1, zSB + (j - 1) * g, zSB + j * g, -j * r, zSB + j * g, 1);
    plane(B, 'floor', [xs0, -9 * r, zS1], [1, 0, 0], [0, 0, -1], xs1 - xs0, zS1 - zL, SU('terrazzo'), PER.terrazzo, WHITE, [], [], xs0, -zS1);
    for (let k = 1; k <= 8; k++) tread(xa0, xa1, zL - k * g, zL - (k - 1) * g, -9 * r - k * r, zL - (k - 1) * g, 1);
    rail(X(0.06), X(0), zSB + 0.05, 0.92 - r, zL, 0.92 - 9 * r);
  }
  // 碰撞＋出口
  colBox(F, xd0, zSB, xd1, zS1, 3);
  const zo = [zSB - 0.45, zSB + 0.45];
  if (up) { colBox(F, xa0, zSB + 0.45, xa1, zS1, 3); exitZone(F, xa0 + 0.06, zo[0], xa1 - 0.06, zo[1], n + 1, { x: X(0.7), z: zSB - 0.8, lh: HP }); }
  if (down) { colBox(F, xb0, zSB + 0.45, xb1, zS1, 3); exitZone(F, xb0 + 0.06, zo[0], xb1 - 0.06, zo[1], n - 1, { x: X(1.525), z: zSB - 0.8, lh: HP }); }
  F.stairArrive = { fromBelow: { x: X(0.7), z: zSB - 0.8, lh: HP }, fromAbove: { x: X(1.525), z: zSB - 0.8, lh: HP } };
}
// 陽台：地、欄杆（女兒牆）、兩邊的牆；冷氣室外機、盆栽
function balcony(F, H, n) {
  const B = F.B, hz = H.hz, hx = H.hx, z0 = hz, z1 = hz + 1.05, cw = C('#e8e4dc');
  hq(B, 'floor', F0, -hx + 0.1, z0, hx - 0.1, z1, -0.02, dotUV(SU('tileB')), C('#d8cfc0'));
  box(B, 'wall', F0, [-hx + 0.1, -0.02, z1 - 0.12, hx - 0.1, 1.0, z1], cw, dotUV(SU('plaster')));
  for (const s of [-1, 1]) box(B, 'wall', F0, [s < 0 ? -hx + 0.1 : hx - 0.22, -0.02, z0, s < 0 ? -hx + 0.22 : hx - 0.1, 1.0, z1], cw, dotUV(SU('plaster')));
  hq(B, 'wall', F0, -hx + 0.1, z0, hx - 0.1, z1 + 0.05, 2.95, dotUV(SU('plaster')), C('#e0dcd4'), false);
  if (hash2(seedOf(H.b), n * 7) < 0.6) { const T = frame(hx - 0.75, 0, z1 - 0.5, Math.PI); bx(F, 'prop', T, [-0.4, 0, -0.14, 0.4, 0.55, 0.14], '#efefeb'); vq(B, 'cut', T, [-0.3, 0.141], [0.1, 0.141], 0.08, 0.48, PU('fan'), C('#6a6e72')); }
  plant(F, frame(-hx + 0.5, 0, z1 - 0.4), 0.8);
  F.cols.pop(); // 盆栽在外面：不用碰撞
}

// ---- 一樓客廳 ----
function living(c) {
  const { F, H, X, R } = c, { W, zP, ZF, dwU, dww } = H, rm = '客廳';
  const altarHere = H.altarFl === 0, solid = dwU - dww / 2, aw = Math.min(1.9, solid - 0.55);
  if (altarHere) {
    const uc = Math.max(aw / 2 + 0.1, solid / 2), cs = [uc, (uc + aw / 2 + 0.1) / 2, aw / 2 + 0.1].map((u) => frame(X(u), 0, zP, 0));
    if (!place(F, cs, [-aw / 2, 0, aw / 2, 1.95], (T) => altar(F, T, { w: aw, room: rm }))) place(F, cs, [-aw / 2, 0, aw / 2, 1.55], (T) => altar(F, T, { w: aw, room: rm }));
  } else place(F, [frame(X((dwU - dww / 2) / 2), 0, zP, 0)], [-0.8, 0, 0.8, 0.5], (T) => cabinet(F, T, { w: Math.min(1.6, dwU - dww / 2 - 0.4), room: rm }));
  const L1 = ZF - zP, n3 = L1 >= 4.9 ? 3 : 2, sl = n3 * 0.6 + 0.24;
  const zc = altarHere ? zP + 1.95 + sl / 2 + 0.05 : zP + 0.9 + sl / 2;
  // 沙發（靠樓梯那邊的牆，面朝 +u）＋茶几；電視在對面
  const sofaT = place(F, [faceU(H, 0, zc, 1), faceU(H, 0, zc + 0.4, 1), faceU(H, 0, zc - 0.3, 1), faceU(H, W, zc, -1)], [-sl / 2, 0, sl / 2, 0.82], (T) => sofa(F, T, { n: n3, col: H.pal.sofa, room: rm }));
  if (sofaT) {
    const oth = sofaT.ry === faceU(H, 0, 0, 1).ry, tvT = faceU(H, oth ? W : 0, sofaT.z, oth ? -1 : 1);
    sofaTable(F, sofaT, sl / 2, (zP + ZF) / 2);
    place(F, [tvT, tvT.sub(0.4, 0, 0), tvT.sub(-0.4, 0, 0)], [-0.8, 0, 0.8, 0.5], (T) => tvSet(F, T, { L: 1.6, tv: H.pal.tv }));
  }
  // 機車（一兩台，停在前面：鐵捲門後面最好）
  const sc = H.pal.scooter, zs = ZF - 1.0;
  place(F, [frame(X(0.45), 0, zs, HP), frame(X(W - 0.45), 0, zs, HP), frame(X(1.0), 0, ZF - 0.45, 0), frame(X(W - 1.0), 0, ZF - 0.45, 0)], [-0.85, -0.32, 0.8, 0.32], (T) => scooter(F, T, { col: sc, helmet: pick(R, ['#f2c230', '#e0453a', '#3b8fd9', '#f2f2f0']) }));
  if (H.front === 'shutter' && H.hx * 2 >= 5) place(F, [frame(X(1.15), 0, zs, HP), frame(X(1.8), 0, zs, HP)], [-0.85, -0.32, 0.8, 0.32], (T) => scooter(F, T, { col: pick(R, ['#f2f3f5', '#2f6fd6', '#d0342c', '#1d1f23']) }));
  // 鞋櫃（門邊）、電風扇、盆栽、牆上的日曆、時鐘、全家福
  const d0 = c.doors[0];
  if (d0) place(F, [frame(d0.b + 0.55, 0, ZF, Math.PI), frame(d0.a - 0.55, 0, ZF, Math.PI), faceU(H, W, ZF - 0.7, -1), faceU(H, 0, ZF - 0.7, 1)], [-0.47, 0, 0.47, 0.68], (T) => shoeCab(F, T, { L: 0.9, seed: (R() * 4) | 0 }));
  place(F, [frame(X(0.35), 0, ZF - 0.35, Math.PI * 0.8), frame(X(W - 0.35), 0, ZF - 0.35, Math.PI * 1.2), frame(X(0.35), 0, zP + 0.35, 0.3), frame(X(W - 0.35), 0, zP + 2.4, -HP)], [-0.25, -0.25, 0.25, 0.25], (T) => fan(F, T, { col: pick(R, ['#f2f2f0', '#e8f0f8']), blade: pick(R, ['#6fa8dc', '#8fcf8a', '#f4a6b8']) }));
  place(F, [frame(X(W - 0.3), 0, zP + 0.3), frame(X(0.3), 0, ZF - 1.9)], [-0.22, -0.22, 0.22, 0.22], (T) => plant(F, T, 1.1));
  // 牆上
  const wallT = faceU(H, W, zc - 0.2, -1).sub(0, 0, 0.001);
  wallPic(F, wallT.sub(-0.9, 0, 0), 'calendar', 0.34, 0.5, 1.45); wallPic(F, wallT.sub(0, 0, 0), 'clock', 0.34, 0.34, 1.95);
  framedPic(F, faceU(H, 0, zc, 1).sub(0, 0, 0.001), 'photo', 0.7, 0.55, 1.35);
  if (!altarHere) wallPic(F, frame(X(0.9), 0, zP, 0), 'fu', 0.4, 0.4, 1.6);
  acUnit(F, faceU(H, W, zP + 1.2, -1));
}
// 展示櫃（沒有神明桌的時候靠隔間牆）：下面抽屜櫃、上面玻璃層板（酒、獎盃、瓷盤、相框）
function cabinet(F, T, o = {}) {
  const w = o.w || 1.6, B = F.B, wd = WOOD(), R = rng(((T.x * 131) ^ (T.z * 71)) >>> 0), dark = C('#5a3220');
  bx(F, 'prop', T, [-w / 2, 0, 0.02, w / 2, 0.8, 0.45], WHITE, { pz: PU('wardrobe'), _: wd });
  bx(F, 'shiny', T, [-w / 2 - 0.01, 0.8, 0.02, w / 2 + 0.01, 0.84, 0.47], WHITE, wd);
  bx(F, 'prop', T, [-w / 2, 0.84, 0.02, w / 2, 1.95, 0.05], dark, wd); // 背板
  for (const s of [-1, 1]) bx(F, 'prop', T, [s < 0 ? -w / 2 : w / 2 - 0.04, 0.84, 0.02, s < 0 ? -w / 2 + 0.04 : w / 2, 1.95, 0.38], WHITE, wd);
  bx(F, 'prop', T, [-w / 2, 1.91, 0.02, w / 2, 1.97, 0.4], WHITE, wd);
  const lv = [0.84, 1.22, 1.58];
  for (const y of lv.slice(1)) bx(F, 'shiny', T, [-w / 2 + 0.04, y - 0.012, 0.05, w / 2 - 0.04, y, 0.36], C('#cfdde2'));
  lv.forEach((y, k) => { // 每一層擺幾樣
    let x = -w / 2 + 0.12;
    while (x < w / 2 - 0.14) {
      const t = R();
      if (t < 0.4) { const c = C(pick(R, ['#6b3a22', '#2e6b3a', '#c9a24a', '#8a1a12', '#d8d4c0'])); cyl(B, 'shiny', T, x, 0.2, y, y + 0.2, 0.035, 0.035, 7, c); cyl(B, 'shiny', T, x, 0.2, y + 0.2, y + 0.29, 0.012, 0.02, 5, c); x += 0.12; }
      else if (t < 0.6) { cyl(B, 'metal', T, x + 0.03, 0.2, y, y + 0.03, 0.05, 0.05, 7, C('#c9a24a')); cyl(B, 'metal', T, x + 0.03, 0.2, y + 0.03, y + 0.16, 0.012, 0.012, 5, C('#c9a24a')); cyl(B, 'metal', T, x + 0.03, 0.2, y + 0.16, y + 0.24, 0.05, 0.02, 7, C('#e0b83a')); x += 0.16; }
      else if (t < 0.8 && k > 0) { bx(F, 'prop', T, [x - 0.02, y, 0.07, x + 0.2, y + 0.22, 0.09], C('#f4f1e8')); bx(F, 'prop', T, [x + 0.02, y + 0.03, 0.091, x + 0.16, y + 0.19, 0.095], C(pick(R, ['#3a6fb0', '#c0392b', '#2e8b57']))); x += 0.3; }
      else { bx(F, 'prop', T, [x - 0.03, y, 0.08, x + 0.13, y + 0.18, 0.1], WHITE, PU('photo')); x += 0.22; }
    }
  });
  colT(F, T, -w / 2, 0, w / 2, 0.47, 1.97); blob(F, -w / 2, 0, w / 2, 0.47, 0.8, T);
}
// ---- 一樓後面：廚房（流理台、冰箱）、浴室門、後門 ----
function kitchenBack(c) {
  const { F, H, X, R, cuEnd, sinkU } = c, { ZB, zSB, W } = H, rm = '廚房';
  const [x0, x1] = H.XR(0, cuEnd);
  const T = frame(x0, 0, ZB, 0);
  kitchen(F, T, x1 - x0, { stove: H.ss < 0 ? 'l' : 'r', upper: false, rice: H.pal.rice, room: rm }); occupy(F, x0, ZB, x1, ZB + 0.62);
  path(F, X(0.4), ZB + 1.1, X(cuEnd - 0.1), ZB + 1.1, 0.3);
  path(F, X(W - 0.67), zSB - 0.8, X(W - 0.67), ZB + 0.5, 0.42);
  place(F, [frame(X(cuEnd + 0.42), 0, ZB, 0), faceU(H, 0, ZB + 1.1, 1), faceU(H, W, zSB - 1.7, -1)], [-0.36, 0, 0.36, 0.72], (T2) => fridge(F, T2, { col: H.pal.fridge }));
  // 小餐桌（放得下才放；走道放餐桌的房子不用；店的走道不放餐桌，家裡的人在廚房吃）
  if (H.Wp < 2.4 || H.biz) place(F, [faceU(H, W, ZB + 1.5, -1).sub(0, 0, 0.4), faceU(H, 0, ZB + 1.6, 1).sub(0, 0, 0.4), faceU(H, 0, (ZB + zSB + 0.1) / 2, 1).sub(0, 0, 0.4)], [-0.45, -0.4, 0.45, 0.72], (T2) => dining(F, T2, { w: 0.9, d: 0.6, seats: [[-0.25, 0.58, HP], [0.25, 0.58, HP]], stool: pick(R, ['#d9403a', '#3b8fd9']), room: rm }));
  wallPic(F, faceU(H, W, ZB + 1.0, -1).sub(0, 0, 0.001), 'calendar', 0.3, 0.45, 1.5);
  if (W > 3.2) place(F, [frame(X(W - 0.3), 0, zSB - 1.45)], [-0.2, -0.2, 0.2, 0.2], (T2) => { bx(F, 'prop', T2, [-0.16, 0, -0.16, 0.16, 0.36, 0.16], '#2f78c8'); bx(F, 'shiny', T2, [-0.13, 0.36, -0.13, 0.13, 0.4, 0.13], '#e8eaec'); colT(F, T2, -0.17, -0.17, 0.17, 0.17, 0.4); });
  void sinkU;
}
// 走道夠寬：餐桌靠樓梯的牆
function passageDining(c) {
  const { F, H, X, R } = c, { zSB, zS1 } = H, zm = (zSB + zS1) / 2;
  place(F, [faceU(H, 2.1, zm, 1).sub(0, 0, 0.4, 0), faceU(H, 2.1, zm - 0.4, 1).sub(0, 0, 0.4, 0), faceU(H, 2.1, zm + 0.4, 1).sub(0, 0, 0.4, 0)], [-0.6, -0.4, 0.6, 0.9], (T) => dining(F, T, { w: 1.2, d: 0.75, chairs: true, seats: [[-0.3, 0.68, HP], [0.3, 0.68, HP]], room: '餐廳', cover: pick(R, ['#f28ab0', '#8fc1e3', '#f5b041']) }));
}
// ---- 樓上前面：臥室 ----
function bedFront(c) {
  const { F, H, n, X, R } = c, { W, zP, ZF, dwU, dww } = H, rm = c.n === 1 ? '主臥室' : '臥室';
  const bw = W >= 4.2 && R() < 0.8 ? 1.5 : 1.05, zc = zP + 0.62 + 0.75 + bw / 2 + 0.02;
  const ww = Math.min(1.8, dwU - dww / 2 - 0.3); place(F, [frame(X((dwU - dww / 2) / 2), 0, zP, 0)], [-ww / 2, 0, ww / 2, 0.62], (T) => wardrobe(F, T, { w: ww, col: pick(R, ['#f3efe6', '#e8dcc8', '#dfe6ea']) }));
  const bT = place(F, [faceU(H, 0, zc, 1), faceU(H, 0, zc + 0.3, 1), faceU(H, W, zc, -1), faceU(H, 0, ZF - 1.0 - bw / 2, 1)], [-bw / 2 - 0.5, 0, bw / 2 + 0.05, 2.05], (T) => bed(F, T, { w: bw, quilt: H.pal.quilt[n % 3], side: 'l', room: rm }));
  place(F, [faceU(H, W, ZF - 1.0, -1), faceU(H, W, zP + 1.7, -1)], [-0.55, 0, 0.55, 1.2], (T) => desk(F, T, { w: 1.0, pc: R() < 0.5, room: rm }));
  if (bT) acUnit(F, bT.sub(0, 0, 0.001, 0), 2.35); else acUnit(F, faceU(H, 0, (zP + ZF) / 2, 1));
  place(F, [frame(X(W - 0.35), 0, zP + 0.35), frame(X(0.35), 0, ZF - 0.35)], [-0.25, -0.25, 0.25, 0.25], (T) => fan(F, T, {}));
  wallPic(F, faceU(H, W, zP + 1.1, -1).sub(0, 0, 0.001), 'calendar', 0.3, 0.45, 1.55);
  path(F, X(dwU), zP + 0.45, X(dwU), ZF - 0.9, 0.42);
}
// ---- 神明廳（頂樓前面）----
function shrineRoom(c) {
  const { F, H, X, R } = c, { W, zP, ZF, dwU, dww } = H, rm = '神明廳', aw = Math.min(2.0, dwU - dww / 2 - 0.3);
  place(F, [frame(X(clamp((dwU - dww / 2) / 2, aw / 2 + 0.1, 1.3)), 0, zP, 0)], [-aw / 2, 0, aw / 2, 1.95], (T) => {
    altar(F, T, { w: aw, room: rm });
    for (let k = 0; k < 2; k++) cyl(F.B, 'prop', T, -0.35 + k * 0.7, 1.75, 0, 0.1, 0.24, 0.22, 10, C('#b8261c')); // 拜墊（不擋路）
  });
  place(F, [faceU(H, W, (zP + ZF) / 2, -1), faceU(H, 0, ZF - 1.2, 1)], [-0.6, 0, 0.6, 0.5], (T) => { dining(F, T.sub(0, 0, 0.35), { w: 0.9, d: 0.55, h: 0.8, seats: [[-0.62, 0, 0], [0.62, 0, Math.PI]], chairs: true, food: false, room: rm }); });
  place(F, [faceU(H, 0, ZF - 0.6, 1), faceU(H, W, ZF - 0.6, -1)], [-0.4, 0, 0.4, 0.5], (T) => boxes(F, T.sub(0, 0, 0.3), 2, (R() * 100) | 0));
  path(F, X(dwU), zP + 0.45, X(dwU), ZF - 0.9, 0.42);
}
// ---- 樓上後面：起居室、書房、臥室、洗衣間 ----
function familyBack(c) {
  const { F, H, X, R } = c, { W, ZB, zSB } = H, rm = '起居室', zs = zSB - 1.3;
  const d = zs - ZB, n2 = d >= 2.1 ? 3 : 2, sl = n2 * 0.6 + 0.24, zc = ZB + Math.max(sl / 2 + 0.05, d / 2);
  const sT = place(F, [faceU(H, 0, zc, 1), faceU(H, W, zc, -1)], [-sl / 2, 0, sl / 2, 0.82], (T) => sofa(F, T, { n: n2, col: pick(R, ['#6e7f5a', '#4f6b8a', '#8a5a3a', '#b5453a']), leather: R() < 0.5, room: rm }));
  if (sT) { const other = sT.x === faceU(H, 0, zc, 1).x ? W : 0; sofaTable(F, sT, sl / 2, (ZB + zSB) / 2, { L: 1.0, D: 0.5 }); place(F, [faceU(H, other, zc, other ? -1 : 1)], [-0.7, 0, 0.7, 0.5], (T) => tvSet(F, T, { L: 1.4, tv: pick(R, ['tvA', 'tvB', 'tvC']), light: true })); }
  place(F, [frame(0, 0, ZB, 0)], [-0.5, 0, 0.5, 0.4], (T) => bookshelf(F, T, { w: 0.9, h: 0.8 }));
  acUnit(F, frame(X(W * 0.7), 0, ZB, 0));
  wallPic(F, faceU(H, 0, zc, 1).sub(0, 0, 0.001), 'photo', 0.5, 0.5, 1.5);
}
function studyBack(c) {
  const { F, H, X, R } = c, { W, ZB, zSB } = H, rm = '書房';
  place(F, [frame(0, 0, ZB, 0), frame(X(W / 2), 0, ZB, 0)], [-0.6, 0, 0.6, 1.2], (T) => desk(F, T, { w: 1.2, pc: true, room: rm }));
  place(F, [faceU(H, 0, ZB + 0.6, 1), faceU(H, W, ZB + 0.6, -1)], [-0.47, 0, 0.47, 0.4], (T) => bookshelf(F, T, { w: 0.9, h: 1.9 }));
  place(F, [faceU(H, W, ZB + 0.6, -1), faceU(H, 0, ZB + 0.6, 1)], [-0.47, 0, 0.47, 0.4], (T) => bookshelf(F, T, { w: 0.9, h: 1.9 }));
  place(F, [faceU(H, W, zSB - 1.75, -1), faceU(H, 0, zSB - 1.75, 1)], [-0.45, 0, 0.45, 0.8], (T) => sofa(F, T, { n: 1, col: pick(R, ['#6e7f5a', '#4f6b8a']), leather: true, room: rm }));
  acUnit(F, frame(X(W * 0.3), 0, ZB, 0));
}
function bedBack(c) {
  const { F, H, n, X, R, zH } = c, { W, ZB } = H, rm = n >= 2 ? '小孩房' : '臥室', d = zH - 0.06 - ZB;
  const bT = place(F, [faceU(H, 0, ZB + 0.1 + 0.55, 1), faceU(H, 0, ZB + d / 2, 1)], [-0.6, 0, 0.6, 2.05], (T) => bed(F, T, { w: 1.05, quilt: H.pal.quilt[(n + 1) % 3], side: false, room: rm }));
  place(F, [faceU(H, W, ZB + 0.7, -1), frame(X(W - 0.9), 0, ZB, 0)], [-0.55, 0, 0.55, 0.62], (T) => wardrobe(F, T, { w: 1.0 }));
  place(F, [faceU(H, W, zH - 0.7, -1), frame(X(2.5), 0, ZB, 0)], [-0.5, 0, 0.5, 1.2], (T) => desk(F, T, { w: 0.9, pc: R() < 0.4, room: rm }));
  acUnit(F, bT ? bT.sub(0, 0, 0.001) : frame(X(W / 2), 0, ZB, 0));
  path(F, X(W - 0.7), zH - 0.1, X(W - 0.7), zH - 0.9, 0.42);
}
function laundryBack(c) {
  const { F, H, X, R } = c, { W, ZB, zSB } = H;
  place(F, [frame(X(0.4), 0, ZB, 0), frame(X(W - 0.4), 0, ZB, 0)], [-0.32, 0, 0.32, 0.7], (T) => washer(F, T));
  place(F, [frame(X(1.2), 0, ZB, 0)], [-0.35, 0, 0.35, 0.65], (T) => { bx(F, 'shiny', T, [-0.35, 0, 0.02, 0.35, 0.8, 0.55], '#dfe3e6'); hq(F.B, 'metal', T, -0.3, 0.07, 0.3, 0.5, 0.801, PU('steel'), C('#8d949b')); colT(F, T, -0.35, 0, 0.35, 0.56, 0.8); });
  place(F, [faceU(H, W, (ZB + zSB - 1.3) / 2, -1).sub(0, 0, 0.5), frame(X(W / 2), 0, (ZB + zSB - 1.3) / 2 + 0.3, 0)], [-0.8, -0.3, 0.8, 0.3], (T) => dryRack(F, T, 1.5));
  place(F, [faceU(H, 0, zSB - 1.75, 1).sub(0, 0, 0.35), frame(X(W - 0.4), 0, ZB + 1.3)], [-0.35, -0.3, 0.35, 0.3], (T) => boxes(F, T, 3, (R() * 999) | 0));
}

// ---- 店裡的東西 ----
// 靠牆的貨架（高 h、深 0.45）：貼圖一層一層（兩排一張）
function wallShelf(F, T, L, o = {}) {
  const B = F.B, h = o.h || 1.9, d = o.d || 0.45, tex = o.tex || ['goods1', 'goods3'], c = col3(o.col || '#e4e7ea'), lv = Math.round(h / 0.95);
  bx(F, 'prop', T, [-L / 2, 0, 0.02, L / 2, 0.12, d], C('#9aa0a6'));
  for (const s of [-1, 1]) bx(F, 'prop', T, [s < 0 ? -L / 2 : L / 2 - 0.03, 0, 0.02, s < 0 ? -L / 2 + 0.03 : L / 2, h, d], c);
  vq(B, 'prop', T, [-L / 2, 0.025], [L / 2, 0.025], 0.12, h, dotUV(PU('white')), mul(c, 0.8));
  for (let i = 0; i < lv; i++) {
    const y0 = 0.12 + (i * (h - 0.12)) / lv, y1 = 0.12 + ((i + 1) * (h - 0.12)) / lv, tx = tex[i % tex.length];
    const segs = Math.max(1, Math.round(L / 1.2));
    for (let k = 0; k < segs; k++) { const xa = -L / 2 + 0.03 + (k * (L - 0.06)) / segs, xb = xa + (L - 0.06) / segs; vq(B, 'prop', T, [xa, d * 0.55], [xb, d * 0.55], y0, y1 - 0.02, PU(tx), WHITE); }
    bx(F, 'shiny', T, [-L / 2, y0 - 0.02, 0.03, L / 2, y0, d], c);
  }
  bx(F, 'shiny', T, [-L / 2, h - 0.02, 0.02, L / 2, h, d], c);
  if (o.band) vq(B, 'glow', T, [-L / 2, d + 0.001], [L / 2, d + 0.001], h, h + 0.3, GU(o.band), WHITE);
  colT(F, T, -L / 2, 0, L / 2, d, h); blob(F, -L / 2, 0, L / 2, d, 0.7, T);
}
// 雙面貨架（超商中間一排）：T＝中間，沿 x 長 L
function gondola(F, T, L, o = {}) {
  const B = F.B, h = o.h || 1.45, c = C('#e9ecef'), tex = o.tex || ['goods1', 'goods2', 'goods3'];
  bx(F, 'prop', T, [-L / 2, 0, -0.45, L / 2, 0.14, 0.45], C('#b9bec4')); bx(F, 'prop', T, [-L / 2, 0.14, -0.03, L / 2, h, 0.03], c);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const y0 = 0.14 + i * ((h - 0.14) / 2), y1 = y0 + (h - 0.14) / 2, tx = tex[(i + (s > 0 ? 1 : 0) + (o.seed || 0)) % tex.length], segs = Math.max(1, Math.round(L / 1.3));
      for (let k = 0; k < segs; k++) { const xa = -L / 2 + (k * L) / segs, xb = xa + L / segs; if (s > 0) vq(B, 'prop', T, [xa, 0.3], [xb, 0.3], y0, y1, PU(tx), WHITE); else vq(B, 'prop', T, [xb, -0.3], [xa, -0.3], y0, y1, PU(tx), WHITE); }
      bx(F, 'shiny', T, s > 0 ? [-L / 2, y0 - 0.02, 0.03, L / 2, y0 + 0.01, 0.45] : [-L / 2, y0 - 0.02, -0.45, L / 2, y0 + 0.01, -0.03], c);
    }
  }
  bx(F, 'shiny', T, [-L / 2, h, -0.1, L / 2, h + 0.03, 0.1], c); blob(F, -L / 2 - 0.1, -0.55, L / 2 + 0.1, 0.55, 0.7, T);
  for (const s of [-1, 1]) bx(F, 'prop', T, [s < 0 ? -L / 2 - 0.04 : L / 2, 0, -0.45, s < 0 ? -L / 2 : L / 2 + 0.04, h + 0.03, 0.45], mul(c, 0.92));
  if (o.sign) { const S = T.sub(0, 0, 0); vq(B, 'glow', S, [-0.5, 0], [0.5, 0], h + 0.25, h + 0.5, GU(o.sign), WHITE, true); }
  colT(F, T, -L / 2 - 0.04, -0.46, L / 2 + 0.04, 0.46, h); blob(F, -L / 2, -0.45, L / 2, 0.45, 0.7, T);
}
// 冰箱（玻璃門，一排 n 門）：T＝靠牆中間
function drinkFridge(F, T, n, o = {}) {
  const B = F.B, dw = 0.72, L = n * dw, h = o.h || 2.0;
  bx(F, 'prop', T, [-L / 2, 0, 0.02, L / 2, h + 0.1, 0.78], C('#2a2c30'));
  for (let i = 0; i < n; i++) { const x0 = -L / 2 + i * dw; vq(B, 'glow', T, [x0 + 0.03, 0.781], [x0 + dw - 0.03, 0.781], 0.1, h - 0.02, GU(i % 3 === 2 ? 'fridgeB' : 'fridgeA'), [1.12, 1.12, 1.12]); }
  if (o.promo !== false) { const segs = Math.max(1, Math.round(L / 2.4)); for (let k = 0; k < segs; k++) { const xa = -L / 2 + (k * L) / segs; vq(B, 'glow', T, [xa, 0.79], [xa + L / segs, 0.79], h + 0.1, h + 0.45, GU(o.promo || 'promo'), WHITE); } }
  colT(F, T, -L / 2, 0, L / 2, 0.8, h); blob(F, -L / 2, 0, L / 2, 0.8, 0.7, T);
  spot(F, 'stand', T, 0, 1.2, HP, null, o.room);
}
// 櫃台：T＝櫃台前面中間（客人那邊 +z），沿 x 長 L；店員站在後面（−z）面朝客人
function counter(F, T, L, o = {}) {
  const B = F.B, h = o.h || 1.0, top = col3(o.top || '#d8d4cc'), front = col3(o.front || '#f4f4f2');
  bx(F, 'prop', T, [-L / 2, 0, -0.62, L / 2, h - 0.04, 0], front, { pz: dotUV(PU('white')), _: dotUV(PU('white')) });
  if (o.stripe) bx(F, 'prop', T, [-L / 2, 0.55, -0.005, L / 2, 0.68, 0.005], o.stripe);
  bx(F, 'shiny', T, [-L / 2 - 0.02, h - 0.04, -0.66, L / 2 + 0.02, h, 0.03], top);
  if (o.register !== false) { const x = o.regX ?? -L / 2 + 0.5; bx(F, 'prop', T, [x - 0.2, h, -0.45, x + 0.2, h + 0.12, -0.12], WHITE, { py: PU('register'), _: dotUV(PU('white')) }); bx(F, 'prop', T, [x - 0.14, h + 0.12, -0.5, x + 0.14, h + 0.36, -0.46], C('#1d1f23')); vq(B, 'glow', T, [x + 0.13, -0.459], [x - 0.13, -0.459], h + 0.14, h + 0.34, GU('monitor'), WHITE); }
  colT(F, T, -L / 2, -0.66, L / 2, 0.03, h);
  if (o.clerk !== false) spot(F, 'counter', T, o.clerkX ?? 0, -1.05, -HP, null, o.room);
  blob(F, -L / 2, -0.62, L / 2, 0, 0.6, T);
}
// 關東煮（鍋子，放在櫃台上）
function oden(F, T, x, y, z) { const B = F.B; bx(F, 'metal', T, [x - 0.3, y, z - 0.18, x + 0.3, y + 0.16, z + 0.18], C('#c7ccd1'), PU('steel')); hq(B, 'prop', T, x - 0.27, z - 0.15, x + 0.27, z + 0.15, y + 0.161, PU('oden'), WHITE); bx(F, 'metal', T, [x - 0.3, y + 0.16, z - 0.19, x + 0.3, y + 0.19, z - 0.17], C('#aeb4ba')); }
// 咖啡機
function coffee(F, T, x, y, z, ry = 0) { const S = T.sub(x, y, z, ry); bx(F, 'shiny', S, [-0.22, 0, -0.25, 0.22, 0.62, 0.2], C('#26282c')); vq(F.B, 'glow', S, [-0.16, 0.201], [0.16, 0.201], 0.38, 0.56, GU('monitor'), WHITE); bx(F, 'metal', S, [-0.08, 0.14, 0.12, 0.08, 0.2, 0.2], C('#9aa0a6')); cyl(F.B, 'shiny', S, 0, 0.12, 0.02, 0.13, 0.04, 0.045, 8, C('#f4f1ea')); }
// 提款機
function atm(F, T) { bx(F, 'shiny', T, [-0.3, 0, 0.02, 0.3, 1.55, 0.6], C('#d9dde2'), { pz: PU('atm'), _: dotUV(PU('white')) }); vq(F.B, 'glow', T, [-0.2, 0.601], [0.2, 0.601], 1.02, 1.3, GU('atmS'), WHITE); colT(F, T, -0.3, 0, 0.3, 0.62, 1.55); blob(F, -0.3, 0, 0.3, 0.6, 0.7, T); spot(F, 'stand', T, 0, 0.95, HP); }
// 靠窗的高吧台（超商、早餐店）＋高腳椅
function barCounter(F, T, L, n, o = {}) {
  const B = F.B; bx(F, 'shiny', T, [-L / 2, 1.02, 0.02, L / 2, 1.06, 0.48], C(o.top || '#d9c6a5')); for (const x of [-L / 2 + 0.1, L / 2 - 0.14]) bx(F, 'metal', T, [x, 0, 0.1, x + 0.04, 1.02, 0.14], C('#9aa0a6'));
  colT(F, T, -L / 2, 0, L / 2, 0.5, 1.06);
  for (let i = 0; i < n; i++) { const x = -L / 2 + (L / n) * (i + 0.5); cyl(B, 'metal', T, x, 0.85, 0, 0.72, 0.03, 0.03, 6, C('#9aa0a6'), null, false); cyl(B, 'shiny', T, x, 0.85, 0.72, 0.78, 0.19, 0.19, 10, C(o.seat || '#2f3b52')); cyl(B, 'metal', T, x, 0.85, 0, 0.02, 0.2, 0.2, 8, C('#9aa0a6')); const p = T.p(x, 0, 0.85); colC(F, p[0], p[2], 0.2, 0.78); spot(F, 'sit', T, x, 0.85, HP, 0.78, o.room); }
}
// 天花板吊的牌子（兩面）
function hangSign(F, x, y, z, ry, name, w = 1.4, h = 0.35) { const T = frame(x, 0, z, ry); vq(F.B, 'glow', T, [-w / 2, 0], [w / 2, 0], y, y + h, GU(name), WHITE, true); tube(F.B, 'metal', T.p(-w / 2 + 0.1, y + h, 0), T.p(-w / 2 + 0.1, F.ch, 0), 0.006, 0.006, 3, C('#888')); tube(F.B, 'metal', T.p(w / 2 - 0.1, y + h, 0), T.p(w / 2 - 0.1, F.ch, 0), 0.006, 0.006, 3, C('#888')); }
// 麵攤（不鏽鋼台子＋大湯鍋＋麵杓＋碗）：T＝台子前面中間（客人那邊 +z），廚師站在 −z 面朝湯鍋
function noodleStall(F, T, L, o = {}) {
  const B = F.B, h = 0.9;
  bx(F, 'metal', T, [-L / 2, 0, -0.35, L / 2, h, 0.35], C('#c7ccd1'), PU('steel'));
  if (o.kind === 'tea') { // 飲料店：三個大茶桶、封口機、一疊杯子
    for (let k = 0; k < 3; k++) { const x = -L / 2 + 0.22 + k * 0.3; cyl(B, 'metal', T, x, -0.12, h, h + 0.52, 0.12, 0.12, 10, C('#c7ccd1'), PU('steel'), true); bx(F, 'metal', T, [x - 0.02, h + 0.08, 0.0, x + 0.02, h + 0.12, 0.06], C('#555a60')); }
    bx(F, 'prop', T, [L / 2 - 0.5, h, -0.25, L / 2 - 0.18, h + 0.4, 0.1], C('#e9ecef')); bx(F, 'prop', T, [L / 2 - 0.46, h + 0.12, 0.1, L / 2 - 0.22, h + 0.2, 0.12], C('#2a2c30'));
    for (let k = 0; k < 3; k++) cyl(B, 'shiny', T, L / 2 - 0.1, -0.2 + k * 0.1, h, h + 0.3, 0.035, 0.045, 8, C('#f4f5f6'));
  } else for (const [x, r, hh] of [[-L / 2 + 0.35, 0.28, 0.42], [-L / 2 + 0.95, 0.24, 0.34]]) { if (x + r > L / 2) continue; cyl(B, 'metal', T, x, 0, h, h + hh, r, r, 12, C('#b9bec4'), PU('steel'), false); cyl(B, 'prop', T, x, 0, h + hh - 0.05, h + hh - 0.049, r - 0.01, r - 0.01, 12, C('#8a5a32'), null, true); }
  if (o.kind === 'breakfast') { bx(F, 'metal', T, [0, h, -0.3, L / 2 - 0.05, h + 0.05, 0.3], C('#3a3c40')); for (let k = 0; k < 3; k++) ball(B, 'shiny', T, 0.2 + k * 0.22, h + 0.06, 0, 0.08, 0.02, 0.08, C('#f5d76e'), null, 8, 2); }
  else if (o.kind === 'ice') { bx(F, 'prop', T, [0, h, -0.25, 0.5, h + 0.12, 0.25], C('#d93b2b')); cyl(B, 'prop', T, 0.25, 0, h + 0.12, h + 0.55, 0.06, 0.06, 8, C('#d93b2b')); tube(B, 'metal', T.p(0.25, h + 0.6, -0.2), T.p(0.25, h + 0.6, 0.2), 0.15, 0.15, 12, C('#9aa0a6'), null, false); for (let k = 0; k < 5; k++) { const x = -0.35 + k * 0.14; if (x < L / 2 - 0.1) { bx(F, 'metal', T, [x - 0.06, h, 0.05, x + 0.06, h + 0.06, 0.3], C('#c7ccd1')); hq(B, 'prop', T, x - 0.05, 0.06, x + 0.05, 0.29, h + 0.061, dotUV(PU('white')), C(['#f5b041', '#8a3a2a', '#f7f2e6', '#9ccf5a', '#f28ab0'][k])); } } }
  else if (o.kind !== 'tea') { for (let k = 0; k < 6; k++) cyl(B, 'shiny', T, L / 2 - 0.25 - (k % 3) * 0.14, 0.12 - ((k / 3) | 0) * 0.14, h, h + 0.08, 0.07, 0.05, 8, C('#f4f1ea')); }
  if (o.glassCase) { bx(F, 'metal', T, [-L / 2, h, 0.2, L / 2, h + 0.45, 0.35], C('#c9ccd0'), { pz: false, py: false }); vq(B, 'glow', T, [-L / 2 + 0.02, 0.351], [L / 2 - 0.02, 0.351], h + 0.02, h + 0.43, dotUV(GU('s_ice')), [0.55, 0.62, 0.66]); }
  colT(F, T, -L / 2, -0.35, L / 2, 0.35, h); blob(F, -L / 2, -0.35, L / 2, 0.35, 0.7, T);
  spot(F, 'counter', T, 0, -0.75, HP, null, o.room);
}
// 兩人、四人的小吃桌＋紅色塑膠椅
function eatTable(F, T, o = {}) { dining(F, T, { w: o.w || 0.75, d: 0.75, h: 0.74, top: o.top || '#e6e2da', legs: '#9aa0a6', stool: o.stool || '#d9403a', food: false, seats: o.seats || [[0, -0.66, -HP], [0, 0.66, HP]], room: o.room }); const B = F.B; for (let k = 0; k < 3; k++) cyl(B, 'shiny', T, -0.12 + k * 0.1, 0, 0.74, 0.88, 0.028, 0.028, 6, C(['#b8261c', '#3a1a0c', '#f4f1ea'][k])); bx(F, 'prop', T, [0.14, 0.74, -0.06, 0.24, 0.86, 0.06], '#c9a878'); }
// 理髮椅（面朝 +z 的鏡子）
function barberChair(F, T, o = {}) {
  const B = F.B, c = col3(o.col || '#8e1c1c');
  cyl(B, 'metal', T, 0, 0, 0, 0.06, 0.3, 0.3, 12, C('#c7ccd1')); cyl(B, 'metal', T, 0, 0, 0.06, 0.42, 0.07, 0.07, 8, C('#c7ccd1'), null, false);
  bx(F, 'shiny', T, [-0.3, 0.42, -0.28, 0.3, 0.56, 0.28], c); bx(F, 'shiny', T, [-0.28, 0.56, -0.34, 0.28, 1.12, -0.24], c); bx(F, 'shiny', T, [-0.12, 1.14, -0.33, 0.12, 1.28, -0.25], C('#222'));
  for (const s of [-1, 1]) bx(F, 'metal', T, [s * 0.3 - 0.04, 0.6, -0.25, s * 0.3 + 0.04, 0.66, 0.24], C('#d8dadc'));
  bx(F, 'metal', T, [-0.2, 0.15, 0.3, 0.2, 0.19, 0.52], C('#c7ccd1'));
  const p = T.p(0, 0, 0); colC(F, p[0], p[2], 0.36, 1.2); blob(F, -0.32, -0.34, 0.32, 0.5, 0.7, T);
  spot(F, 'sit', T, 0, 0, -HP, 0.58, o.room); spot(F, 'counter', T, 0.25, -0.75, -HP, null, o.room);
}
// 牆上的鏡子＋下面的檯子（理髮店）
function mirrorWall(F, T, L) {
  const B = F.B, segs = Math.max(1, Math.round(L / 1.1));
  for (let k = 0; k < segs; k++) { const xa = -L / 2 + (k * L) / segs, xb = xa + L / segs; vq(B, 'shiny', T, [xa + 0.03, 0.02], [xb - 0.03, 0.02], 1.0, 2.1, PU('mirror'), WHITE); }
  bx(F, 'shiny', T, [-L / 2, 0.8, 0.02, L / 2, 0.86, 0.36], C('#e9e4da')); bx(F, 'prop', T, [-L / 2, 0, 0.02, L / 2, 0.8, 0.32], C('#f1ede4'), { pz: PU('wardrobe'), _: dotUV(PU('white')) });
  for (let k = 0; k < Math.floor(L / 0.25); k++) cyl(B, 'shiny', T, -L / 2 + 0.15 + k * 0.25, 0.2, 0.86, 0.98 + (k % 3) * 0.05, 0.03, 0.03, 6, C(['#2f6fd6', '#f2c230', '#43b36b', '#f4f1ea', '#e0453a'][k % 5]));
  colT(F, T, -L / 2, 0, L / 2, 0.36, 0.86);
}
// 玻璃櫃（藥局、檳榔攤）：T＝前面中間；店員在 −z
function glassCase(F, T, L, o = {}) {
  const B = F.B, h = o.h || 1.0;
  bx(F, 'prop', T, [-L / 2, 0, -0.55, L / 2, 0.35, 0], C(o.base || '#e8e4dc'));
  vq(B, 'prop', T, [-L / 2 + 0.03, 0.001], [L / 2 - 0.03, 0.001], 0.38, h - 0.04, PU(o.tex || 'meds'), [0.95, 0.97, 1]);
  bx(F, 'shiny', T, [-L / 2, h - 0.03, -0.56, L / 2, h, 0.01], C('#d8e8ee')); for (const s of [-1, 1]) bx(F, 'metal', T, [s < 0 ? -L / 2 : L / 2 - 0.03, 0.35, -0.02, s < 0 ? -L / 2 + 0.03 : L / 2, h, 0.01], C('#c7ccd1'));
  colT(F, T, -L / 2, -0.56, L / 2, 0.01, h); blob(F, -L / 2, -0.55, L / 2, 0, 0.6, T);
  if (o.clerk !== false) spot(F, 'counter', T, 0, -0.95, -HP, null, o.room);
}
// 工作台（機車行）＋虎鉗、工具箱
function workbench(F, T, L = 1.6) {
  const B = F.B; bx(F, 'prop', T, [-L / 2, 0.84, 0.02, L / 2, 0.9, 0.7], C('#6b5a48')); for (const x of [-L / 2 + 0.03, L / 2 - 0.08]) for (const z of [0.05, 0.62]) bx(F, 'metal', T, [x, 0, z, x + 0.05, 0.84, z + 0.05], C('#3a3c40'));
  bx(F, 'metal', T, [-L / 2 + 0.1, 0.9, 0.3, -L / 2 + 0.3, 1.05, 0.45], C('#2f6fd6')); bx(F, 'prop', T, [L / 2 - 0.6, 0, 0.1, L / 2 - 0.1, 0.7, 0.6], C('#c8322a')); vq(B, 'prop', T, [-L / 2, 0.021], [L / 2, 0.021], 1.0, 1.8, PU('peg'), WHITE);
  colT(F, T, -L / 2, 0, L / 2, 0.72, 0.9); blob(F, -L / 2, 0, L / 2, 0.7, 0.7, T); spot(F, 'counter', T, 0, 1.0, HP);
}
// 空壓機（紅色的桶）
function compressor(F, T) { const B = F.B; tube(B, 'shiny', T.p(-0.4, 0.3, 0), T.p(0.4, 0.3, 0), 0.22, 0.22, 10, C('#c8322a'), null, true); bx(F, 'prop', T, [-0.2, 0.5, -0.12, 0.2, 0.75, 0.12], C('#2a2c30')); for (const x of [-0.3, 0.3]) bx(F, 'metal', T, [x - 0.03, 0, -0.18, x + 0.03, 0.12, 0.18], C('#333')); colT(F, T, -0.45, -0.25, 0.45, 0.25, 0.8); blob(F, -0.45, -0.25, 0.45, 0.25, 0.7, T); }
// 冰櫃（上掀）
function freezer(F, T, L = 1.2) { bx(F, 'shiny', T, [-L / 2, 0, 0.02, L / 2, 0.85, 0.7], C('#f4f5f6')); hq(F.B, 'glow', T, -L / 2 + 0.05, 0.07, L / 2 - 0.05, 0.65, 0.851, dotUV(GU('s_ice')), [0.75, 0.85, 0.9]); colT(F, T, -L / 2, 0, L / 2, 0.72, 0.86); blob(F, -L / 2, 0, L / 2, 0.7, 0.7, T); }
// 米袋、飲料箱一疊
function sacks(F, T, n = 3) { const B = F.B; for (let i = 0; i < n; i++) bx(F, 'prop', T, [-0.3 + (i % 2) * 0.05, i * 0.16, -0.22, 0.3 + (i % 2) * 0.05, i * 0.16 + 0.16, 0.22], C(i % 2 ? '#efe6d2' : '#e6dcc4')); vq(B, 'prop', T, [-0.2, 0.221], [0.2, 0.221], 0.02, 0.14, dotUV(PU('white')), C('#c62f25')); colT(F, T, -0.32, -0.23, 0.36, 0.23, n * 0.16); blob(F, -0.3, -0.22, 0.3, 0.22, 0.7, T); }

// 一捆水管（PVC，躺在地上疊三層）：T＝中間、沿 x 長 L（五金、水電行）
function pipes(F, T, L = 1.8) {
  const B = F.B, cols = ['#e9ecef', '#9fb3c8', '#e9ecef', '#6f8fb2', '#d9dde1', '#e4e6e8', '#8a9fb8', '#e9ecef', '#c9d3dd'];
  let k = 0; for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) { const r = 0.055, z = (i - (3 - row) / 2) * 0.12, y = r + row * 0.1; tube(B, 'shiny', T.p(-L / 2, y, z), T.p(L / 2, y, z), r, r, 8, C(cols[k++ % cols.length]), null, true); }
  colT(F, T, -L / 2, -0.26, L / 2, 0.26, 0.32); blob(F, -L / 2, -0.26, L / 2, 0.26, 0.6, T);
}
// 自助餐的菜台（不鏽鋼、兩排一格一格的菜、上面玻璃罩）：T＝客人那邊中間；打菜的人在 −z
function buffetLine(F, T, L, o = {}) {
  const B = F.B, h = 0.88, n = Math.max(3, Math.floor(L / 0.36)), cols = ['#5a8f3a', '#8a4b1e', '#f2c230', '#c8452a', '#6fa84a', '#b5793a', '#efe7d2', '#7a4a2a', '#3f7d3a', '#d98c3a', '#e8d27a'];
  bx(F, 'metal', T, [-L / 2, 0, -0.7, L / 2, h, 0], C('#c7ccd1'), PU('steel'));
  for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) {
    const x0 = -L / 2 + 0.04 + (i * (L - 0.08)) / n, x1 = x0 + (L - 0.08) / n - 0.03, z0 = -0.64 + r * 0.31, z1 = z0 + 0.28;
    bx(F, 'metal', T, [x0, h - 0.05, z0, x1, h + 0.006, z1], C('#aeb4ba')); hq(B, 'prop', T, x0 + 0.02, z0 + 0.02, x1 - 0.02, z1 - 0.02, h + 0.012, dotUV(PU('white')), C(cols[(i * 3 + r * 5 + (o.seed || 0)) % cols.length]));
  }
  bx(F, 'shiny', T, [-L / 2, h + 0.4, -0.5, L / 2, h + 0.42, -0.02], C('#d8e8ee')); for (const x of [-L / 2, L / 2 - 0.03]) bx(F, 'metal', T, [x, h, -0.3, x + 0.03, h + 0.4, -0.26], C('#c7ccd1'));
  for (let k = 0; k < 6; k++) cyl(B, 'shiny', T, L / 2 - 0.2 - (k % 3) * 0.13, 0.12, h + 0.42, h + 0.47 + ((k / 3) | 0) * 0.05, 0.08, 0.1, 8, C('#f4f1ea')); // 疊起來的盤子
  colT(F, T, -L / 2, -0.7, L / 2, 0, h); blob(F, -L / 2, -0.7, L / 2, 0, 0.6, T);
  spot(F, 'counter', T, 0, -1.05, -HP, null, o.room); spot(F, 'stand', T, -L / 4, 0.45, HP, null, o.room);
}
// 烘衣機（兩台疊起來、圓的窗）：T＝靠牆中間、n 組並排
function dryers(F, T, n = 2) {
  const B = F.B, w = 0.7, L = n * w;
  for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
    const x = -L / 2 + (i + 0.5) * w, y = 0.05 + j * 0.86;
    bx(F, 'shiny', T, [x - w / 2 + 0.01, y, 0.02, x + w / 2 - 0.01, y + 0.84, 0.72], C('#eceef0'));
    tube(B, 'shiny', T.p(x, y + 0.4, 0.72), T.p(x, y + 0.4, 0.74), 0.24, 0.24, 14, C('#9aa3ab'), null, true); tube(B, 'shiny', T.p(x, y + 0.4, 0.74), T.p(x, y + 0.4, 0.745), 0.19, 0.19, 14, C('#2a3036'), null, true);
    vq(B, 'glow', T, [x + 0.12, 0.721], [x + 0.28, 0.721], y + 0.72, y + 0.78, dotUV(GU('s_green')), [0.6, 1.2, 0.8]);
  }
  colT(F, T, -L / 2, 0, L / 2, 0.74, 1.8); blob(F, -L / 2, 0, L / 2, 0.74, 0.8, T);
}
// 保險箱（當舖）
function safeBox(F, T) { const B = F.B; bx(F, 'metal', T, [-0.32, 0, 0.02, 0.32, 0.9, 0.6], C('#3a3f45')); tube(B, 'metal', T.p(-0.06, 0.58, 0.6), T.p(-0.06, 0.58, 0.64), 0.07, 0.07, 10, C('#c7ccd1'), null, true); bx(F, 'metal', T, [0.16, 0.36, 0.6, 0.2, 0.56, 0.64], C('#c7ccd1')); colT(F, T, -0.32, 0, 0.32, 0.62, 0.9); blob(F, -0.32, 0, 0.32, 0.6, 0.7, T); }
// 白板（補習班）：T＝牆面
function whiteboard(F, T, w) {
  const B = F.B; bx(F, 'metal', T, [-w / 2 - 0.03, 0.85, 0, w / 2 + 0.03, 2.08, 0.03], C('#9aa0a6'));
  vq(B, 'shiny', T, [-w / 2, 0.031], [w / 2, 0.031], 0.88, 2.05, dotUV(PU('white')), C('#fbfcfc'));
  const R = rng(Math.round(w * 100)); for (let k = 0; k < 6; k++) { const y = 1.85 - k * 0.15, x0 = -w / 2 + 0.12 + (k % 3 === 0 ? 0 : 0.1), x1 = x0 + (w - 0.3) * (0.35 + R() * 0.5); vq(B, 'prop', T, [x0, 0.033], [x1, 0.033], y, y + 0.035, dotUV(PU('white')), C(k === 0 ? '#c62f25' : k % 2 ? '#2f5fae' : '#2a2c30')); }
  bx(F, 'metal', T, [-w / 2, 0.84, 0.03, w / 2, 0.87, 0.09], C('#c7ccd1')); for (let k = 0; k < 3; k++) bx(F, 'prop', T, [-0.3 + k * 0.1, 0.87, 0.04, -0.22 + k * 0.1, 0.89, 0.08], C(['#c62f25', '#2f5fae', '#2a2c30'][k]));
}
// 學生的桌子（兩人一張）＋椅子：T＝桌子中間，學生坐在 +z 那邊、面朝 −z（白板）
function schoolDesk(F, T, w = 1.2, o = {}) {
  const B = F.B, n = Math.max(1, Math.round(w / 0.6)), tc = C('#d8c8a8'), lc = C('#8a9096'), cc = C(o.chair || '#3b6fb6');
  bx(F, 'shiny', T, [-w / 2, 0.7, -0.22, w / 2, 0.74, 0.22], tc); for (const x of [-w / 2 + 0.03, w / 2 - 0.06]) bx(F, 'metal', T, [x, 0, -0.18, x + 0.03, 0.7, 0.18], lc);
  bx(F, 'prop', T, [-w / 2 + 0.03, 0.56, -0.2, w / 2 - 0.03, 0.59, 0.12], lc);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w / n) * (i + 0.5), S = T.sub(x, 0, 0.5);
    bx(F, 'prop', S, [-0.2, 0.42, -0.18, 0.2, 0.46, 0.18], cc); bx(F, 'prop', S, [-0.2, 0.46, 0.15, 0.2, 0.84, 0.19], cc);
    for (const lx of [-0.18, 0.15]) for (const lz of [-0.16, 0.13]) bx(F, 'metal', S, [lx, 0, lz, lx + 0.03, 0.42, lz + 0.03], lc);
    const p = S.p(0, 0, 0); colC(F, p[0], p[2], 0.22, 0.84); spot(F, 'sit', T, x, 0.5, HP, 0.46, o.room);
    if ((i + (o.seed || 0)) % 2 === 0) bx(F, 'prop', T, [x - 0.14, 0.74, -0.08, x + 0.1, 0.77, 0.12], C(['#f2f3f5', '#f2c230', '#43b36b'][(i + (o.seed || 0)) % 3]));
  }
  colT(F, T, -w / 2, -0.22, w / 2, 0.22, 0.74); blob(F, -w / 2, -0.22, w / 2, 0.7, 0.7, T);
}

// 壁掛的神明架（店裡、高高的）：紅色架子、小神明彩、小神像、香爐、兩盞紅燈、上面紅燈條
function wallShrine(F, T, y = 2.0) {
  const B = F.B, w = 0.62, d = 0.34;
  bx(F, 'prop', T, [-w / 2 - 0.04, y - 0.1, 0, w / 2 + 0.04, y, d + 0.02], WHITE, PU('redCarve'));
  bx(F, 'prop', T, [-w / 2, y, 0, w / 2, y + 0.58, 0.03], C('#9b1c14'));
  wallPic(F, T, 'deity', 0.34, 0.45, y + 0.06, 'prop', WHITE, 0.032);
  cyl(B, 'shiny', T, 0, 0.19, y, y + 0.2, 0.07, 0.045, 8, C('#d8a431')); ball(B, 'shiny', T, 0, y + 0.24, 0.19, 0.035, 0.042, 0.035, C('#e8c49a'), null, 6, 4);
  cyl(B, 'metal', T, 0, 0.3, y, y + 0.06, 0.05, 0.06, 8, C('#b08a3e'));
  for (const s of [-1, 1]) { cyl(B, 'glow', T, s * 0.23, 0.2, y + 0.01, y + 0.13, 0.035, 0.055, 8, [1.3, 0.45, 0.3], dotUV(GU('s_red'))); ball(B, 'glow', T, s * 0.23, y + 0.17, 0.2, 0.045, 0.05, 0.045, [1.35, 0.6, 0.4], GU('bulbR'), 8, 5); }
  vq(B, 'glow', T, [-w / 2, 0.035], [w / 2, 0.035], y + 0.58, y + 0.63, dotUV(GU('s_red')), [1.25, 0.4, 0.3]);
}
// 掛在牆上高高的電視（吃的店）
function wallTV(F, T, y = 1.95, tv = 'tvA') {
  bx(F, 'metal', T, [-0.05, y + 0.12, 0, 0.05, y + 0.32, 0.2], C('#333639'));
  bx(F, 'shiny', T, [-0.43, y, 0.2, 0.43, y + 0.52, 0.25], C('#141517'));
  vq(F.B, 'glow', T, [-0.41, 0.251], [0.41, 0.251], y + 0.02, y + 0.5, GU(tv), [1.05, 1.05, 1.05]);
}
// 店的後牆（隔間牆朝店的那一面，門口兩邊）：神明架、時鐘；吃的店多一台電視
function shopBackWall(c) {
  const { F, H, X, R } = c, { W, zP, dwU, dww, biz } = H;
  const A = [0.15, dwU - dww / 2 - 0.15], Bq = [dwU + dww / 2 + 0.15, W - 0.15], at = (u) => frame(X(u), 0, zP, 0);
  const eat = ['noodle', 'breakfast', 'ice', 'buffet', 'tea'].includes(biz);
  if (biz !== 'pharmacy' && biz !== 'clinic' && biz !== 'school' && A[1] - A[0] >= 0.8) wallShrine(F, at(eat && A[1] - A[0] >= 2.0 ? A[0] + 0.45 : (A[0] + A[1]) / 2), 2.02);
  if (eat) { const u = Bq[1] - Bq[0] >= 0.95 ? (Bq[0] + Bq[1]) / 2 : A[1] - A[0] >= 2.0 ? A[1] - 0.5 : null; if (u != null) wallTV(F, at(u), 1.9, pick(R, ['tvA', 'tvB', 'tvC'])); }
  const cu = Bq[1] - Bq[0] >= 0.5 ? (Bq[0] + Bq[1]) / 2 : null; if (cu != null) wallPic(F, at(cu), 'clock', 0.32, 0.32, eat ? 1.45 : 1.95);
}
// ---- 一樓的店（前面房間）----
// 中間貨架的 x：門口那條線（F.doorLine）左右各 1.25 公尺，離牆 0.7 以上（offLine 擋掉正中間的時候用）
const midX = (F, H) => (F.doorLine ? [F.doorLine.x0 + 1.25, F.doorLine.x0 - 1.25].filter((x) => x > H.X0 + 0.7 && x < H.X1 - 0.7) : []);
function shopFront(c) {
  const { F, H, X, R } = c, { W, zP, ZF, dwU, dww, biz } = H, rm = shopName(H.b, biz), L1 = ZF - zP;
  shopBackWall(c);
  const menu = (name) => { const T = faceU(H, W, zP + L1 * 0.45, -1).sub(0, 0, 0.001); vq(F.B, 'glow', T, [-0.62, 0.012], [0.62, 0.012], 1.75, 2.55, GU(name), WHITE); bx(F, 'prop', T, [-0.66, 1.71, 0, 0.66, 2.59, 0.012], '#2a2c30'); };
  const soloStall = (kind, L) => place(F, [faceU(H, 1.15, ZF - 0.6 - L / 2, 1), faceU(H, 1.15, zP + 1.6, 1)], [-L / 2, -1.15, L / 2, 0.45], (T) => noodleStall(F, T, L, { kind, glassCase: kind === 'noodle', room: rm }));
  // 小吃桌：一排一排（椅子前後放），先靠遠的那面牆，再往中間
  const tables = (n, stool) => {
    let k = 0;
    for (const u of [W - 0.5, 0.5, W - 1.9, W / 2]) for (let z = zP + 0.95; z <= ZF - 1.0; z += 0.2) { if (k >= n) return; if (place(F, [frame(X(u), 0, z, 0)], [-0.42, -0.95, 0.42, 0.95], (T) => eatTable(F, T, { stool, room: rm }))) k++; }
  };
  if (biz === 'grocery') {
    // 櫃台（老闆站在櫃台和牆中間，牆上是香菸櫃）：遠的牆靠前面，不行就靠後面的隔間牆（通往家裡的門旁邊）
    const cu = Math.max(0.95, (dwU - dww / 2) / 2);
    place(F, [faceU(H, W, ZF - 1.6, -1).sub(0, 0, 1.5), faceU(H, W, ZF - 2.2, -1).sub(0, 0, 1.5), frame(X(cu), 0, zP + 1.5, 0), faceU(H, W, zP + 1.3, -1).sub(0, 0, 1.5)], [-0.7, -1.5, 0.7, 0.3], (T) => { counter(F, T, 1.3, { top: '#b89a6a', front: '#c9a878', h: 0.9, room: rm }); bx(F, 'prop', T.sub(0, 0, -1.45), [-0.6, 0, -0.05, 0.6, 1.5, 0.0], WHITE, { pz: PU('cig'), _: dotUV(PU('white')) }); colT(F, T.sub(0, 0, -1.45), -0.6, -0.05, 0.6, 0, 1.5); });
    for (const [z0, z1] of [[zP + 0.4, ZF - 0.8], [zP + 1.9, ZF - 0.8], [zP + 1.9, ZF - 1.7]]) if (z1 - z0 >= 1 && place(F, [faceU(H, 0, (z0 + z1) / 2, 1)], [-(z1 - z0) / 2, 0, (z1 - z0) / 2, 0.48], (T) => wallShelf(F, T, z1 - z0, { tex: ['goods1', 'goods3', 'goods2'] }), true)) break;
    place(F, [faceU(H, W, zP + 0.9, -1), faceU(H, W, zP + 1.3, -1), faceU(H, W, ZF - 1.0, -1), faceU(H, 0, ZF - 1.0, 1)], [-0.4, 0, 0.4, 1.0], (T) => drinkFridge(F, T, 1, { promo: false, room: rm }), true); // 前面 0.2 就好（走道在旁邊；擋路的話 place 會退回去）
    const gx = midX(F, H), zm = (zP + ZF) / 2;
    if (W >= 4.4 && !place(F, [frame(X(W / 2 - 0.2), 0, zm - 0.3, HP), frame(X(W / 2 - 0.2), 0, zm + 0.4, HP), ...gx.map((x) => frame(x, 0, zm, HP))], [-1.0, -0.5, 1.0, 0.5], (T) => gondola(F, T, 1.8, { h: 1.25, seed: 1 }), true))
      place(F, [frame(X(W / 2 - 0.2), 0, zm + 0.5, HP), frame(X(W / 2 - 0.2), 0, zm, HP), frame(X(W / 2 - 0.5), 0, zm + 0.5, HP), ...gx.map((x) => frame(x, 0, zm + 0.3, HP))], [-0.7, -0.5, 0.7, 0.5], (T) => gondola(F, T, 1.2, { h: 1.25, seed: 1 }), true);
    place(F, [faceU(H, 0.4, ZF - 0.55, 1), faceU(H, 1.1, ZF - 0.55, 1)], [-0.36, -0.26, 0.36, 0.26], (T) => sacks(F, T, 4));
  } else if (biz === 'hardware') { // 五金行、水電行、冷氣行
    const ac = rm.includes('冷氣'), cu = Math.max(0.95, (dwU - dww / 2) / 2);
    place(F, [frame(X(cu), 0, zP + 1.5, 0), faceU(H, W, ZF - 1.6, -1).sub(0, 0, 1.5), faceU(H, W, zP + 1.3, -1).sub(0, 0, 1.5)], [-0.7, -1.5, 0.7, 0.3], (T) => { counter(F, T, 1.3, { top: '#8f949a', front: '#6b7580', h: 0.95, room: rm }); vq(F.B, 'prop', T.sub(0, 0, -1.47), [-0.65, 0], [0.65, 0], 0.95, 2.15, PU('peg'), WHITE); });
    for (const [z0, z1] of [[zP + 1.9, ZF - 0.5], [zP + 1.9, ZF - 1.2], [zP + 0.4, ZF - 0.8], [zP + 2.4, ZF - 0.8]]) if (z1 - z0 >= 1 && place(F, [faceU(H, 0, (z0 + z1) / 2, 1)], [-(z1 - z0) / 2, 0, (z1 - z0) / 2, 0.48], (T) => wallShelf(F, T, z1 - z0, { h: 2.1, tex: ['peg', 'oil', 'goods2'], col: '#c9ced3' }), true)) break;
    if (ac) { for (let k = 0; k < 3; k++) acUnit(F, faceU(H, W, zP + 1.3 + k * 1.05, -1), k === 1 ? 2.05 : 1.45); place(F, [faceU(H, W, zP + 1.8, -1).sub(0, 0, 0.35), faceU(H, W, zP + 1.2, -1).sub(0, 0, 0.35)], [-0.35, -0.35, 0.35, 0.35], (T) => boxes(F, T, 3, 7), true); }
    else place(F, [faceU(H, W, zP + 1.5, -1), faceU(H, W, zP + 1.1, -1), faceU(H, W, zP + 2.0, -1)], [-0.9, 0, 0.9, 0.48], (T) => wallShelf(F, T, 1.8, { h: 2.1, tex: ['oil', 'peg'], col: '#c9ced3' }), true);
    if (W >= 4.4) place(F, [frame(X(W / 2 - 0.2), 0, (zP + ZF) / 2 + 0.5, HP), frame(X(W / 2 - 0.2), 0, (zP + ZF) / 2, HP), frame(X(W / 2 - 0.5), 0, (zP + ZF) / 2 + 0.5, HP), ...midX(F, H).map((x) => frame(x, 0, (zP + ZF) / 2 + 0.3, HP))], [-0.7, -0.5, 0.7, 0.5], (T) => gondola(F, T, 1.2, { h: 1.4, tex: ['peg', 'goods2', 'oil'] }), true);
    place(F, [frame(X(0.75), 0, ZF - 0.55, HP), frame(X(W - 0.75), 0, ZF - 0.55, HP), faceU(H, 0.3, ZF - 1.2, 1)], [-1.0, -0.27, 1.0, 0.27], (T) => pipes(F, T, 1.8));
  } else if (biz === 'buffet') { // 自助餐：一長條菜台、白飯、湯桶；桌子
    place(F, [faceU(H, 1.55, ZF - 0.7 - 1.1, 1), faceU(H, 1.55, zP + 1.8, 1)], [-1.1, -1.55, 1.1, 0.5], (T) => { buffetLine(F, T, 2.2, { seed: (R() * 10) | 0, room: rm }); });
    place(F, [faceU(H, 0, zP + 0.5, 1), frame(X(0.5), 0, zP, 0)], [-0.4, 0, 0.4, 1.2], (T) => drinkFridge(F, T, 1, { promo: false, room: rm }));
    tables(4, '#3b8fd9');
  } else if (biz === 'tea') { // 飲料店：櫃台在門口（茶桶、封口機）、冰箱、兩張小桌子
    place(F, [frame(X(W / 2), 0, ZF - 1.35, 0), faceU(H, 1.15, ZF - 1.35, 1), faceU(H, 1.15, zP + 1.6, 1)], [-0.8, -1.15, 0.8, 0.45], (T) => noodleStall(F, T, 1.5, { kind: 'tea', room: rm }));
    place(F, [faceU(H, 0, zP + 0.5, 1), frame(X(0.5), 0, zP, 0)], [-0.4, 0, 0.4, 1.2], (T) => drinkFridge(F, T, 1, { promo: false, room: rm }));
    tables(2, '#f2c230');
  } else if (biz === 'laundry') { // 洗衣店：洗衣機一排、烘衣機疊兩層、櫃台、摺衣服的桌子、曬衣架、等的椅子
    const n = clamp(Math.floor((L1 - 1.6) / 0.66), 2, 5), cu = Math.max(0.95, (dwU - dww / 2) / 2);
    place(F, [faceU(H, 0, ZF - 0.6 - n * 0.33, 1), faceU(H, 0, zP + 0.3 + n * 0.33, 1)], [-n * 0.33, 0, n * 0.33, 0.72], (T) => { for (let k = 0; k < n; k++) washer(F, T.sub(-n * 0.33 + 0.33 + k * 0.66, 0, 0)); });
    place(F, [faceU(H, W, zP + 1.3, -1), faceU(H, W, zP + 0.9, -1), faceU(H, W, zP + 1.9, -1)], [-0.72, 0, 0.72, 0.76], (T) => dryers(F, T, 2));
    place(F, [frame(X(cu), 0, zP + 1.5, 0), faceU(H, W, zP + 3.2, -1).sub(0, 0, 1.5)], [-0.65, -1.5, 0.65, 0.3], (T) => counter(F, T, 1.2, { top: '#d8dadc', front: '#5bc0eb', h: 0.95, room: rm }));
    place(F, [frame(X(W / 2 - 0.1), 0, (zP + ZF) / 2 + 0.4, HP), frame(X(W / 2 - 0.1), 0, (zP + ZF) / 2 - 0.2, HP)], [-0.75, -0.4, 0.75, 0.4], (T) => { dining(F, T, { w: 1.4, d: 0.65, h: 0.9, seats: [], food: false, top: '#e9ecef', legs: '#9aa0a6' }); for (let k = 0; k < 3; k++) bx(F, 'prop', T, [-0.5 + k * 0.36, 0.9, -0.15, -0.24 + k * 0.36, 0.96 + (k % 2) * 0.05, 0.15], ['#f2f3f5', '#7fb3e0', '#f2c9a0'][k]); });
    place(F, [frame(X(W - 0.45), 0, ZF - 1.0, HP), frame(X(0.45), 0, ZF - 1.0, HP)], [-0.3, -0.3, 0.3, 0.3], (T) => stool(F, T, '#3b8fd9', true, rm));
    place(F, [frame(X(W - 0.45), 0, ZF - 1.9, HP)], [-0.3, -0.3, 0.3, 0.3], (T) => stool(F, T, '#3b8fd9', true, rm));
    place(F, [faceU(H, W, ZF - 0.9, -1).sub(0, 0, 0.3), frame(X(0.6), 0, ZF - 0.5, 0)], [-0.72, -0.28, 0.72, 0.28], (T) => dryRack(F, T, 1.3), true);
  } else if (biz === 'school') { // 補習班：白板（後面的隔間牆）、老師的桌子、學生的桌椅一排一排面朝白板、書櫃
    const bw = clamp(dwU - dww / 2 - 0.5, 1.2, 2.6); whiteboard(F, frame(X((dwU - dww / 2) / 2), 0, zP, 0), bw); occupy(F, ...(() => { const r = fpRect(frame(X((dwU - dww / 2) / 2), 0, zP, 0), [-bw / 2, 0, bw / 2, 0.3]); return [r.x0, r.z0, r.x1, r.z1]; })());
    place(F, [frame(X((dwU - dww / 2) / 2), 0, zP + 1.1, Math.PI), frame(X(W - 0.8), 0, zP + 1.1, Math.PI)], [-0.6, -0.35, 0.6, 0.45], (T) => { dining(F, T, { w: 1.1, d: 0.55, h: 0.76, seats: [], food: false, top: '#d8c8a8', legs: '#8a9096' }); bx(F, 'prop', T, [-0.3, 0.76, -0.1, 0.05, 0.8, 0.15], '#f2f3f5'); spot(F, 'stand', T, 0, 0.55, HP, null, rm); });
    let k = 0; const desk = (u, w, z) => place(F, [frame(X(u), 0, z, 0), frame(X(u), 0, z + 0.3, 0)], [-w / 2 - 0.02, -0.24, w / 2 + 0.02, 0.75], (T) => schoolDesk(F, T, w, { seed: k++, room: rm }));
    for (let z = zP + 2.05; z <= ZF - 1.0; z += 1.6) { if (!desk(1.0, 1.8, z)) desk(0.7, 1.2, z); desk(W - 0.72, 1.2, z); } // 一排：靠樓梯那邊三個人（放不下就兩個人）、遠的那邊兩個人
    place(F, [faceU(H, W, ZF - 0.8, -1), faceU(H, 0, ZF - 0.8, 1)], [-0.45, 0, 0.45, 0.36], (T) => bookshelf(F, T, { w: 0.9, h: 1.8 }), true);
  } else if (biz === 'noodle' || biz === 'breakfast' || biz === 'ice') {
    soloStall(biz, 1.5); menu(biz === 'noodle' ? 'menuN' : biz === 'breakfast' ? 'menuB' : 'menuI');
    place(F, [faceU(H, 0, zP + 0.5, 1), frame(X(0.5), 0, zP, 0)], [-0.4, 0, 0.4, 1.2], (T) => biz === 'ice' ? freezer(F, T, 0.9) : drinkFridge(F, T, 1, { promo: false, room: rm }));
    tables(4, biz === 'noodle' ? '#d9403a' : biz === 'ice' ? '#3b8fd9' : '#f2c230');
  } else if (biz === 'scooter') {
    place(F, [faceU(H, W, (zP + ZF) / 2, -1), faceU(H, W, ZF - 1.6, -1)], [-1.3, 0, 1.3, 0.34], (T) => { bx(F, 'prop', T, [-1.3, 0.25, 0.02, 1.3, 1.9, 0.3], WHITE, { pz: PU('tyres'), _: dotUV(PU('tyres')) }); colT(F, T, -1.3, 0, 1.3, 0.3, 1.9); }, true);
    place(F, [frame(X((dwU - dww / 2) / 2), 0, zP, 0)], [-0.85, 0, 0.85, 1.7], (T) => workbench(F, T, 1.6));
    place(F, [frame(X(1.2), 0, ZF - 1.2, HP * 0.9), frame(X(W / 2), 0, ZF - 1.3, HP)], [-0.9, -0.4, 0.85, 0.4], (T) => scooter(F, T, { col: pick(R, ['#f2f3f5', '#2f6fd6', '#d0342c']) }));
    place(F, [frame(X(0.5), 0, zP + 2.2, -HP), frame(X(W - 0.5), 0, zP + 2.2, -HP)], [-0.9, -0.4, 0.85, 0.4], (T) => scooter(F, T, { col: pick(R, ['#1d1f23', '#f2c230', '#c3c8ce']) }));
    place(F, [faceU(H, W, ZF - 0.5, -1).sub(0, 0, 0.3), frame(X(0.5), 0, ZF - 0.5, 0)], [-0.46, -0.26, 0.46, 0.26], (T) => compressor(F, T));
    place(F, [faceU(H, 0, zP + 1.2, 1)], [-0.6, 0, 0.6, 0.4], (T) => { wallShelf(F, T, 1.2, { h: 1.6, d: 0.35, tex: ['oil', 'oil'] }); });
    for (let k = 0; k < 3; k++) blob(F, X(1.5 + k * 0.6) - 0.3, zP + 1.0 + k * 0.9, X(1.5 + k * 0.6) + 0.3, zP + 1.5 + k * 0.9, 0.35);
  } else if (biz === 'barber') {
    const Lm = Math.min(3.2, L1 - 2.5), mT = faceU(H, 0, zP + 1.0 + Lm / 2, 1); mirrorWall(F, mT, Lm); occupy(F, ...(() => { const r = fpRect(mT, [-Lm / 2, 0, Lm / 2, 0.4]); return [r.x0, r.z0, r.x1, r.z1]; })());
    for (const dz of [-0.75, 0.75]) place(F, [mT.sub(dz, 0, 1.05, Math.PI), mT.sub(dz * 0.8, 0, 1.05, Math.PI)], [-0.4, -0.55, 0.4, 0.6], (T) => barberChair(F, T, { col: pick(R, ['#8e1c1c', '#2a2c30', '#5a3a2a']), room: rm }));
    place(F, [faceU(H, W, (zP + ZF) / 2 + 0.3, -1), faceU(H, W, zP + 1.6, -1), faceU(H, W, zP + 1.05, -1)], [-0.8, 0, 0.8, 0.8], (T) => sofa(F, T, { n: 2, col: '#2f3b52', leather: true, room: rm }));
    wallPic(F, faceU(H, W, ZF - 0.9, -1).sub(0, 0, 0.001), 'barber', 0.5, 0.75, 1.3);
    place(F, [frame(X(0.6), 0, zP, 0)], [-0.35, 0, 0.35, 0.8], (T) => { bx(F, 'shiny', T, [-0.3, 0.7, 0.02, 0.3, 0.85, 0.5], '#f4f5f6'); bx(F, 'prop', T, [-0.2, 0, 0.1, 0.2, 0.7, 0.4], '#e8eaec'); colT(F, T, -0.3, 0, 0.3, 0.5, 0.85); });
  } else if (biz === 'pharmacy' || biz === 'optical' || biz === 'pawn' || biz === 'clinic') { // 藥局；眼鏡行、當舖、診所：一樣的格局，櫃子、牌子不一樣
    const tex = biz === 'pharmacy' ? ['meds', 'goods3'] : biz === 'optical' ? ['mag', 'goods3'] : biz === 'pawn' ? ['goods2', 'goods3'] : ['meds', 'books'];
    if (biz === 'clinic') { // 診所：候診的沙發靠樓梯那面牆、掛號櫃台
      place(F, [faceU(H, 0, (zP + ZF) / 2 + 0.3, 1), faceU(H, 0, (zP + ZF) / 2 + 0.8, 1)], [-1.1, 0, 1.1, 0.82], (T) => sofa(F, T, { n: 3, col: '#5b8fb9', leather: true, room: rm }));
      place(F, [faceU(H, 0, ZF - 0.55, 1), faceU(H, W, ZF - 0.55, -1)], [-0.3, 0, 0.3, 0.5], (T) => plant(F, T.sub(0, 0, 0.25), 1.2));
      place(F, [frame(X(dwU / 2 - 0.3), 0, zP + 1.7, 0), frame(X(1.2), 0, zP + 1.7, 0), faceU(H, W, zP + 1.3, -1).sub(0, 0, 1.7)], [-0.7, -1.7, 0.7, 0.3], (T) => { counter(F, T, 1.3, { top: '#e9ecef', front: '#f4f5f6', stripe: '#2e9a5c', h: 1.05, room: rm }); wallShelf(F, T.sub(0, 0, -1.7), 1.2, { h: 1.9, d: 0.25, tex: ['meds'] }); });
      wallPic(F, faceU(H, W, zP + 1.0, -1).sub(0, 0, 0.001), 'cross', 0.5, 0.5, 1.9, 'glow');
    } else {
      place(F, [faceU(H, 0, (zP + ZF) / 2 + 0.2, 1)], [-(L1 - 1.4) / 2, 0, (L1 - 1.4) / 2, 0.48], (T) => wallShelf(F, T, L1 - 1.4, { tex }), true);
      place(F, [faceU(H, W, ZF - 1.4, -1), faceU(H, W, ZF - 2.0, -1), faceU(H, W, zP + 2.2, -1)], [-0.6, 0, 0.6, 0.48], (T) => wallShelf(F, T, 1.2, { tex: [tex[0]] }), true);
      place(F, [frame(X(dwU / 2 - 0.3), 0, zP + 1.35, 0), frame(X(1.2), 0, zP + 1.35, 0)], [-0.8, -1.3, 0.8, 0.5], (T) => { glassCase(F, T, 1.5, { tex: biz === 'pharmacy' ? 'meds' : biz === 'pawn' ? 'goods3' : 'mag', room: rm }); if (biz === 'pharmacy') wallPic(F, frame(T.x, 0, zP, 0), 'pharm', 1.2, 0.3, 2.35, 'glow'); stool(F, T.sub(0.35, 0, 0.3, Math.PI), '#2f3b52', true, rm); });
      if (biz === 'pharmacy') wallPic(F, faceU(H, W, zP + 1.0, -1).sub(0, 0, 0.001), 'cross', 0.5, 0.5, 1.9, 'glow');
      if (biz === 'optical') vq(F.B, 'shiny', faceU(H, W, zP + 1.8, -1), [-0.25, 0.02], [0.25, 0.02], 0.9, 1.9, PU('mirror'), WHITE);
      if (biz === 'pawn') { place(F, [frame(X(0.5), 0, zP, 0), faceU(H, W, zP + 0.5, -1)], [-0.35, 0, 0.35, 0.65], (T) => safeBox(F, T)); framedPic(F, faceU(H, W, zP + 1.9, -1), 'plaque', 1.0, 0.3, 2.2, '#6b4a2e'); }
    }
    if (biz !== 'clinic') place(F, [faceU(H, W, zP + 1.0, -1)], [-0.3, 0, 0.3, 0.8], (T) => { bx(F, 'prop', T, [-0.25, 0, 0.02, 0.25, 1.1, 0.5], '#e8eaec'); vq(F.B, 'glow', T, [-0.15, 0.501], [0.15, 0.501], 0.8, 1.0, GU('monitor'), WHITE); colT(F, T, -0.25, 0, 0.25, 0.5, 1.1); }, true);
  } else { // 檳榔攤：玻璃櫃在門口（窗戶後面），後面是自己家的客廳
    // 店面整片打開：櫃子離牆 1.1；大門（±0.8～0.85、門片往裡面開）：櫃子塞在門片和牆中間
    const open = H.front === 'shop', gL = open ? 1.1 : clamp(-0.9 - H.X0 - 0.04, 0.8, 1.1), gu = open ? 1.1 : 0.02 + gL / 2;
    place(F, [frame(H.X0 + gu, 0, ZF - (open ? 0.35 : 0.14), 0), frame(H.X1 - gu, 0, ZF - (open ? 0.35 : 0.14), 0), faceU(H, 1.3, ZF - 1.4, 1)], [-gL / 2 - 0.02, -1.0, gL / 2 + 0.02, 0.1], (T) => { glassCase(F, T, gL, { tex: 'betel', room: rm }); stool(F, T.sub(0, 0, -0.75), '#3b8fd9', false); });
    place(F, [faceU(H, 0, zP + 0.5, 1)], [-0.4, 0, 0.4, 1.2], (T) => drinkFridge(F, T, 1, { promo: false, room: rm }));
    const sT = place(F, [faceU(H, W, zP + 1.6, -1), faceU(H, 0, zP + 2.2, 1)], [-0.8, 0, 0.8, 0.82], (T) => sofa(F, T, { n: 2, col: H.pal.sofa, room: rm }));
    if (sT) sofaTable(F, sT, 0.72, (zP + ZF) / 2);
  }
  if (!['grocery', 'pharmacy', 'clinic', 'school', 'hardware', 'laundry'].includes(biz)) wallPic(F, frame(X(W - 0.9), 0, zP, 0), 'calendar', 0.3, 0.45, 1.5);
  acUnit(F, faceU(H, W, zP + 0.6, -1));
}

// ---- 村口超商 ----
function storeFloor(b) {
  const F = newFloor({ ch: 3.2 }); F.paths = []; F.occ = [];
  const X0 = -8.8, X1 = 8.8, Z0 = -6.3, Z1 = 6.3, rm = b.name || '村口超商';
  const wallS = sf('plaster', '#f6f6f3', 'wall', { skirt: C('#9aa0a6'), wain: { h: 1.0, s: sf('ktile', '#f2f4f5', 'wall', { noSkirt: true }) } });
  room(F, rm, X0, X1, Z0, Z1, { floor: sf('storeT', WHITE, 'floor'), ceil: sf('ceil', '#fbfbf8'), probe: [0, 4.0] });
  for (const s of [-1, 1]) wall(F, 'z', s * 8.9, Z0, Z1, { t: 0.2, p: s < 0 ? wallS : null, n: s > 0 ? wallS : null });
  wall(F, 'x', -6.4, X0, X1, { t: 0.2, p: wallS, ops: [{ a: 6.1, b: 7.0, y0: 0, y1: 2.1, k: 'closed', leafCol: '#dfe3e6', tex: 'door', sign: 'exit', signM: 'glow' }] });
  const posters = [[-6.5, 1.25, 'poster1', 0.6], [-3.2, 1.25, 'poster3', 0.6], [3.4, 1.25, 'poster2', 0.6], [6.4, 1.25, 'poster1', 0.6]];
  const door = { a: -1.05, b: 1.05, y0: 0, y1: 2.4, k: 'open' };
  wall(F, 'x', 6.4, X0, X1, { t: 0.2, n: wallS, out: 1, view: 'street', voff: 0.3, ops: [{ a: X0 + 0.15, b: -1.2, y0: 0.05, y1: 2.9, k: 'glass', posters }, door, { a: 1.2, b: X1 - 0.15, y0: 0.05, y1: 2.9, k: 'glass', posters }] });
  ready(F);
  // 自動門（兩片玻璃往兩邊開）
  for (const s of [-1, 1]) { const T = frame(s * 1.6, 0, 6.25); bx(F, 'metal', T, [-0.52, 0, -0.03, 0.52, 2.4, 0.03], '#aeb4ba', { pz: false, nz: false }); vq(F.B, 'glow', T, [-0.48, 0], [0.48, 0], 0.1, 2.3, dotUV(GU('s_ice')), [0.45, 0.5, 0.52], true); }
  bx(F, 'glow', F0, [-1.2, 2.45, 6.0, 1.2, 2.72, 6.3], [1, 1, 1], { nz: GU('welcome'), _: dotUV(GU('s_black')) });
  exitZone(F, -0.95, Z1 - 0.55, 0.95, 6.85, 'outside', null); colBox(F, -1.4, 6.8, 1.4, 7.3, 2.6);
  F.spawnIn = { x: 0, z: Z1 - 1.2, lh: HP };
  path(F, 0, Z1 - 0.5, 0, 3.4, 0.55); path(F, -7.6, 3.6, 5.0, 3.6, 0.55); path(F, -7.6, -5.0, 5.0, -5.0, 0.5); path(F, -7.6, 3.6, -7.6, -5.0, 0.5); path(F, 5.0, 3.6, 5.0, -5.0, 0.55); path(F, 4.8, 4.2, 4.8, 5.6, 0.5);
  for (const z of [2.2, -0.6, -3.4]) path(F, -7.6, z - 1.35, 5.0, z - 1.35, 0.01);
  // 櫃台（靠東邊，平行東牆）＋店員後面的菸櫃、咖啡機、關東煮
  const cT = frame(6.0, 0, 2.3, HP); // 面朝西（+z＝世界 −x？本地 +x）
  const cT2 = cT.sub(0, 0, 0, Math.PI);
  counter(F, cT2, 3.6, { stripe: '#12a39a', regX: -0.9, clerkX: -0.9, room: rm }); spot(F, 'counter', cT2, 0.9, -1.05, -HP, null, rm);
  oden(F, cT2, 1.2, 1.0, -0.33); bx(F, 'glow', cT2, [0.1, 1.0, -0.5, 0.6, 1.4, -0.15], [0.9, 0.85, 0.7], { _: dotUV(GU('s_amber')) });
  wallPic(F, frame(X1, 0, 2.3, -HP), 'cig', 3.0, 1.5, 1.2); bx(F, 'prop', frame(X1, 0, 2.3, -HP), [-1.6, 0, 0.02, 1.6, 1.0, 0.5], '#e8eaec');
  coffee(F, frame(X1, 0, 3.5, -HP), 0, 1.0, 0.25); coffee(F, frame(X1, 0, 1.0, -HP), 0, 1.0, 0.25);
  colBox(F, X1 - 0.5, 0.6, X1, 4.0, 1.0);
  hangSign(F, 6.0, 2.45, 2.3, HP, 'storeBox', 1.6, 0.4);
  // 中間三排貨架
  const gs = [['goods1', 'goods2', 'goods3'], ['goods3', 'goods1', 'goods2'], ['goods2', 'goods3', 'goods1']];
  [2.2, -0.6, -3.4].forEach((z, i) => gondola(F, frame(-1.6, 0, z), 9.6, { tex: gs[i], seed: i }));
  for (const [z, i] of [[2.2, 0], [-0.6, 1], [-3.4, 2]]) for (const s of [-1, 1]) spot(F, 'stand', frame(-1.6 + (i - 1) * 1.5, 0, z), 0, s * 0.9, s > 0 ? HP : -HP, null, rm);
  // 後面一排冰箱、西邊的貨架、提款機、靠窗的吧台
  drinkFridge(F, frame(-3.0, 0, Z0), 13, { room: rm });
  wallShelf(F, frame(X0, 0, -1.4, HP), 5.2, { tex: ['goods3', 'goods1'], h: 1.9 });
  atm(F, frame(X0, 0, 3.9, HP));
  barCounter(F, frame(-5.0, 0, Z1, Math.PI), 6.0, 6, { top: '#d9c6a5', room: rm });
  freezer(F, frame(4.2, 0, 5.2, HP), 1.2);
  bx(F, 'metal', frame(-1.6, 0, 5.8), [-0.2, 0, -0.2, 0.2, 0.7, 0.2], '#3a8f5a'); colBox(F, -1.8, 5.6, -1.4, 6.0, 0.7);
  // 燈：平板燈一格一格
  for (const x of [-6.5, -3.2, 0.1, 3.4]) for (const z of [4.4, 0.8, -2.0, -4.9]) fixture(F, x, z, 'panel', { L: 1.2, W: 0.6 });
  fixture(F, 6.8, 2.3, 'panel', { L: 1.2, W: 0.6, ry: HP });
  lamp(F, -3.0, 0.5, 9, '#f6fbff', 2.8); lamp(F, 3.5, 1.0, 9, '#f6fbff', 2.8);
  F.sun = { from: [0.2, 0.7, 1], I: 0.7 }; F.hemi = { sky: '#ffffff', ground: '#d8dcd8', I: 2.2 };
  F.cam = { maxDist: 4.5, ceiling: 3.0, near: 0.1 };
  return F;
}

// ---- 福德宮（土地公廟）----
function templeFloor(b) {
  const F = newFloor({ ch: 4.0 }); F.paths = []; F.occ = [];
  const X0 = -5.95, X1 = 5.95, Z0 = -5.3, Z1 = 1.6, rm = b.name || '福德宮', B = F.B;
  const wallS = sf('plaster', '#efe0c2', 'wall', { wain: { h: 1.1, s: sf('granite', '#c9c0b0', 'wall') } });
  room(F, rm, X0, X1, Z0, Z1, { floor: sf('granite', WHITE, 'floor'), ceil: sf('timber', '#b98a5a'), probe: [0, -1.0] });
  for (const s of [-1, 1]) wall(F, 'z', s * 6.075, Z0, Z1, { t: 0.25, p: s < 0 ? wallS : null, n: s > 0 ? wallS : null });
  wall(F, 'x', -5.425, X0, X1, { t: 0.25, p: wallS });
  wall(F, 'x', 1.725, X0, X1, { t: 0.25, n: wallS, out: 1, view: 'temple', vdist: 4.4, voff: 0.1, vy: 0, ground: '#bdb6a8', ops: [{ a: -1.9, b: 1.9, y0: 0, y1: 3.45, k: 'open', rev: '#9b2a1c' }, { a: -4.65, b: -3.15, y0: 1.25, y1: 2.75, k: 'win', grille: 'grille3', frame: '#6a3a1c' }, { a: 3.15, b: 4.65, y0: 1.25, y1: 2.75, k: 'win', grille: 'grille3', frame: '#6a3a1c' }] });
  ready(F);
  // 前廊（門外）：地、柱子、天花板
  hq(B, 'floor', F0, -6.2, 1.85, 6.2, 5.9, 0, dotUV(SU('granite')), C('#d0cabd')); hq(B, 'prop', F0, -6.2, 1.85, 6.2, 5.9, 4.25, dotUV(PU('white')), C('#7d1812'), false);
  for (const x of [-5.6, -2.9, 2.9, 5.6]) { cyl(B, 'prop', frame(x, 0, 5.65), 0, 0, 0.3, 4.25, 0.24, 0.24, 10, C('#b8241c'), null, false); cyl(B, 'prop', frame(x, 0, 5.65), 0, 0, 0, 0.3, 0.36, 0.3, 8, C('#aaa498')); }
  // 門框（紅色、金邊）、門片（收在兩邊）
  for (const s of [-1, 1]) { bx(F, 'prop', F0, [s * 1.9 - (s > 0 ? 0 : 0.16), 0, 1.55, s * 1.9 + (s > 0 ? 0.16 : 0), 3.6, 1.62], '#9b2a1c'); bx(F, 'prop', frame(s * 2.4, 0, 1.55), [-0.47, 0, -0.04, 0.47, 3.4, 0], WHITE, { nz: PU('redCarve'), _: dotUV(PU('pwood')) }); }
  bx(F, 'prop', F0, [-2.06, 3.45, 1.55, 2.06, 3.62, 1.62], '#d4a62c');
  // 神龕：底座、神像（土地公＋兩個）、龕頂
  const S = frame(0, 0, Z0, 0), gold = C('#d4a62c');
  bx(F, 'prop', S, [-1.9, 0, 0.02, 1.9, 0.95, 1.0], WHITE, { pz: PU('goldCarve'), _: PU('redCarve') });
  bx(F, 'prop', S, [-1.9, 0.95, 0.02, 1.9, 3.3, 0.08], '#6b1410', PU('redCarve'));
  for (const s of [-1, 1]) { bx(F, 'prop', S, [s * 1.9 - 0.14, 0.95, 0.05, s * 1.9 + 0.14, 3.3, 0.95], WHITE, PU('goldCarve')); }
  bx(F, 'prop', S, [-2.05, 3.0, 0.02, 2.05, 3.45, 1.05], WHITE, { pz: PU('goldCarve'), ny: PU('redCarve'), _: PU('redCarve') });
  wallPic(F, S.sub(0, 0, 0.001), 'plaque', 1.7, 0.64, 3.48);
  const statue = (x, s, robe) => { const T = S.sub(x, 0.95, 0.5); cyl(B, 'prop', T, 0, 0, 0, 0.12 * s, 0.34 * s, 0.32 * s, 10, gold); cyl(B, 'shiny', T, 0, 0, 0.12 * s, 0.75 * s, 0.3 * s, 0.2 * s, 10, C(robe)); bx(F, 'shiny', T, [-0.26 * s, 0.12 * s, 0, 0.26 * s, 0.36 * s, 0.3 * s], robe); ball(B, 'shiny', T, 0, 0.87 * s, 0.02 * s, 0.13 * s, 0.15 * s, 0.13 * s, C('#e8c49a'), null, 8, 5); ball(B, 'prop', T, 0, 0.78 * s, 0.1 * s, 0.1 * s, 0.1 * s, 0.06 * s, C('#f4f2ea'), null, 6, 4); cyl(B, 'shiny', T, 0, 0, 0.96 * s, 1.1 * s, 0.14 * s, 0.1 * s, 8, gold); bx(F, 'shiny', T, [-0.2 * s, 1.06 * s, -0.03, 0.2 * s, 1.1 * s, 0.03], gold); };
  statue(0, 1.35, '#c9982e'); statue(-1.05, 0.95, '#2e7d4f'); statue(1.05, 0.95, '#a8322a');
  colBox(F, -2.1, Z0, 2.1, Z0 + 1.05, 3.4);
  // 供桌（高、紅色桌裙）、下桌、拜墊
  const T1 = frame(0, 0, Z0 + 1.1, 0);
  bx(F, 'shiny', T1, [-1.6, 0.98, 0, 1.6, 1.05, 0.72], WHITE, WOOD()); bx(F, 'prop', T1, [-1.56, 0.1, 0.68, 1.56, 0.98, 0.72], WHITE, PU('redCarve')); for (const s of [-1, 1]) bx(F, 'prop', T1, [s * 1.55 - 0.05, 0, 0.02, s * 1.55 + 0.05, 0.98, 0.66], WHITE, WOOD());
  cyl(B, 'metal', T1, 0, 0.4, 1.05, 1.3, 0.24, 0.28, 12, C('#b08a3e')); cyl(B, 'prop', T1, 0, 0.4, 1.29, 1.3, 0.25, 0.25, 12, C('#7d746a'));
  for (let k = 0; k < 7; k++) { const x = -0.15 + k * 0.05, z = 0.35 + (k % 2) * 0.06; tube(B, 'prop', T1.p(x, 1.29, z), T1.p(x * 1.3, 1.62, z), 0.005, 0.005, 3, C('#b8412a')); const p = T1.p(x * 1.3, 0, z); ball(B, 'glow', frame(p[0], 0, p[2]), 0, 1.625, 0, 0.01, 0.01, 0.01, [2, 0.6, 0.2], dotUV(GU('s_orange')), 4, 3); }
  for (const s of [-1, 1]) { cyl(B, 'metal', T1, s * 0.9, 0.3, 1.05, 1.5, 0.03, 0.05, 6, C('#c9a24a')); cyl(B, 'prop', T1, s * 0.9, 0.3, 1.5, 1.72, 0.035, 0.035, 6, C('#d0261c')); const p = T1.p(s * 0.9, 0, 0.3); ball(B, 'glow', frame(p[0], 0, p[2]), 0, 1.76, 0, 0.018, 0.04, 0.018, [2, 1.4, 0.6], GU('flame'), 4, 3); cyl(B, 'shiny', T1, s * 1.35, 0.3, 1.05, 1.35, 0.06, 0.08, 8, C('#2a6ab0')); for (let k = 0; k < 4; k++) ball(B, 'prop', T1, s * 1.35 + (k - 1.5) * 0.05, 1.42 + (k % 2) * 0.05, 0.3, 0.05, 0.05, 0.05, C(['#f2c230', '#e0453a', '#f28ab0', '#f4f1ea'][k]), null, 5, 3); }
  colT(F, T1, -1.6, 0, 1.6, 0.72, 1.05); blob(F, -1.6, 0, 1.6, 0.72, 0.8, T1);
  const T2 = frame(0, 0, Z0 + 2.1, 0);
  for (const s of [-1, 1]) { const T = T2.sub(s * 0.95, 0, 0.45); bx(F, 'shiny', T, [-0.9, 0.8, -0.45, 0.9, 0.86, 0.45], WHITE, WOOD()); for (const x of [-0.85, 0.79]) for (const z of [-0.4, 0.34]) bx(F, 'prop', T, [x, 0, z, x + 0.06, 0.8, z + 0.06], WHITE, WOOD()); for (let k = 0; k < 4; k++) { const x = -0.6 + k * 0.4; if (k % 2) { bx(F, 'prop', T, [x - 0.15, 0.86, -0.15, x + 0.15, 0.96, 0.15], ['#e0453a', '#f2c230'][(k + (s > 0 ? 1 : 0)) % 2]); } else { cyl(B, 'shiny', T, x, 0, 0.86, 0.88, 0.14, 0.15, 8, C('#e9e6df')); for (let q = 0; q < 3; q++) ball(B, 'shiny', T, x + (q - 1) * 0.06, 0.93, (q % 2) * 0.05, 0.05, 0.05, 0.05, C(['#f39c12', '#d63a2a', '#9ccf5a'][q]), null, 6, 4); } } }
  colT(F, T2, -1.9, 0, 1.9, 0.9, 0.86); blob(F, -1.9, 0, 1.9, 0.9, 0.8, T2);
  for (let k = 0; k < 3; k++) { cyl(B, 'prop', frame(-0.9 + k * 0.9, 0, Z0 + 3.55), 0, 0, 0, 0.1, 0.26, 0.24, 12, C('#b8261c')); spot(F, 'pray', frame(-0.9 + k * 0.9, 0, Z0 + 3.55), 0, 0, HP, null, rm); }
  path(F, 0, Z1 - 0.5, 0, Z0 + 3.4, 0.7); path(F, -2.2, Z0 + 3.5, 2.2, Z0 + 3.5, 0.6);
  // 龍柱、紅柱
  for (const s of [-1, 1]) { cyl(B, 'prop', frame(s * 2.6, 0, Z0 + 1.6), 0, 0, 0.35, 4.0, 0.26, 0.26, 12, WHITE, PU('dragon'), false); bx(F, 'prop', frame(s * 2.6, 0, Z0 + 1.6), [-0.36, 0, -0.36, 0.36, 0.35, 0.36], '#aaa498'); colC(F, s * 2.6, Z0 + 1.6, 0.36, 4); vq(B, 'prop', frame(s * 2.6, 0, Z0 + 1.6 + 0.265), [-0.07, 0], [0.07, 0], 1.0, 2.6, PU(s < 0 ? 'cpR' : 'cpL'), WHITE); }
  for (const s of [-1, 1]) { cyl(B, 'prop', frame(s * 3.7, 0, -0.2), 0, 0, 0.3, 4.0, 0.22, 0.22, 10, C('#b8241c'), null, false); cyl(B, 'prop', frame(s * 3.7, 0, -0.2), 0, 0, 0, 0.3, 0.32, 0.28, 8, C('#aaa498')); colC(F, s * 3.7, -0.2, 0.32, 4); }
  // 樑（彩繪）、燈籠
  for (const z of [Z0 + 1.6, -1.8, 0.9]) { bx(F, 'prop', F0, [X0, 3.55, z - 0.14, X1, 3.85, z + 0.14], WHITE, { pz: PU('beam'), nz: PU('beam'), _: dotUV(PU('pwood')) }); }
  for (const [x, z] of [[-1.3, -1.8], [1.3, -1.8], [-1.3, 0.9], [1.3, 0.9], [-4.3, -1.8], [4.3, -1.8]]) { const T = frame(x, 0, z); tube(B, 'metal', T.p(0, 3.55, 0), T.p(0, 3.1, 0), 0.006, 0.006, 3, C('#333')); cyl(B, 'glow', T, 0, 0, 2.55, 3.1, 0.24, 0.24, 10, [1.15, 1.1, 1.05], GU('lantern'), false); cyl(B, 'prop', T, 0, 0, 3.1, 3.16, 0.16, 0.1, 8, gold); cyl(B, 'prop', T, 0, 0, 2.49, 2.55, 0.1, 0.16, 8, gold); tube(B, 'prop', T.p(0, 2.49, 0), T.p(0, 2.2, 0), 0.03, 0.01, 4, C('#e8b83a')); }
  // 光明燈（兩邊的牆）、籤筒桌、籤詩櫃、香油錢箱、鐘、鼓
  for (const s of [-1, 1]) wallPic(F, frame(s * X1, 0, -3.9, -s * HP), 'lightWall', 2.2, 2.2, 1.2, 'glow');
  const Q = frame(X1, 0, -0.7, -HP);
  bx(F, 'prop', Q, [-0.55, 0.78, 0.02, 0.55, 0.84, 0.62], WHITE, WOOD()); bx(F, 'prop', Q, [-0.5, 0, 0.06, 0.5, 0.78, 0.58], WHITE, PU('redCarve'));
  cyl(B, 'prop', Q, -0.18, 0.32, 0.84, 1.18, 0.1, 0.1, 10, WHITE, PU('qian'), true);
  for (const dx of [0.12, 0.26]) ball(B, 'shiny', Q, dx, 0.86, 0.35, 0.07, 0.025, 0.035, C('#c0261c'), null, 6, 3);
  colT(F, Q, -0.55, 0, 0.55, 0.62, 0.84); spot(F, 'stand', Q, 0, 1.0, HP, null, rm);
  const K = frame(X1, 0, -2.0, -HP); bx(F, 'prop', K, [-0.5, 0, 0.02, 0.5, 1.9, 0.35], '#5a2a1a', WOOD()); for (let r = 0; r < 6; r++) for (let q = 0; q < 5; q++) vq(B, 'prop', K, [-0.46 + q * 0.184, 0.351], [-0.46 + (q + 1) * 0.184 - 0.015, 0.351], 0.25 + r * 0.26, 0.25 + (r + 1) * 0.26 - 0.02, dotUV(PU('pwood')), C(r % 2 === q % 2 ? '#7a3a22' : '#6b3018')); colT(F, K, -0.5, 0, 0.5, 0.37, 1.9);
  const D = frame(-3.3, 0, Z0 + 2.3, 0); bx(F, 'prop', D, [-0.35, 0, -0.3, 0.35, 0.85, 0.3], WHITE, { pz: PU('donate'), _: dotUV(PU('redCarve')) }); colT(F, D, -0.35, -0.3, 0.35, 0.3, 0.85);
  const bell = frame(4.7, 0, 0.7); for (const s of [-1, 1]) bx(F, 'prop', bell, [s * 0.5 - 0.05, 0, -0.05, s * 0.5 + 0.05, 2.2, 0.05], WHITE, WOOD()); bx(F, 'prop', bell, [-0.55, 2.2, -0.06, 0.55, 2.3, 0.06], WHITE, WOOD()); cyl(B, 'metal', bell, 0, 0, 1.45, 2.1, 0.32, 0.18, 12, C('#8d6a36'), null, false); ball(B, 'metal', bell, 0, 2.12, 0, 0.18, 0.08, 0.18, C('#8d6a36'), null, 8, 3); colT(F, bell, -0.6, -0.4, 0.6, 0.4, 2.3);
  const drum = frame(-4.7, 0, 0.7); for (const s of [-1, 1]) bx(F, 'prop', drum, [s * 0.45 - 0.04, 0, -0.04, s * 0.45 + 0.04, 1.0, 0.04], WHITE, WOOD()); tube(B, 'prop', drum.p(0, 1.35, -0.3), drum.p(0, 1.35, 0.3), 0.42, 0.42, 14, C('#b8241c'), null, false); for (const z of [-0.3, 0.3]) tube(B, 'prop', drum.p(0, 1.35, z), drum.p(0, 1.35, z * 1.02), 0.41, 0.41, 14, C('#e8d7b0'), null, true); colT(F, drum, -0.55, -0.45, 0.55, 0.45, 1.8);
  // 燈、出口
  lamp(F, 0, Z0 + 2.2, 7, '#ffd9a8', 3.3); lamp(F, 0, 0.2, 5, '#ffe2b8', 3.3);
  F.sun = { from: [0.1, 0.5, 1], I: 0.8 }; F.hemi = { sky: '#fff2de', ground: '#b09a80', I: 1.45 };
  exitZone(F, -1.7, Z1 - 0.55, 1.7, 2.2, 'outside', null); colBox(F, -2.2, 2.15, 2.2, 2.7, 3);
  F.spawnIn = { x: 0, z: Z1 - 1.15, lh: HP };
  F.cam = { maxDist: 5.0, ceiling: 3.4, near: 0.1 };
  return F;
}

// ---- 三合院（正身：正廳＋左右房間）----
function farmFloor(b) {
  const F = newFloor({ ch: 3.4 }); F.paths = []; F.occ = [];
  const X0 = -8.75, X1 = 8.75, Z0 = -2.75, Z1 = 2.75, B = F.B;
  const wallS = sf('plaster', '#f0e9d8', 'wall', { wain: { h: 0.8, s: sf('wbrick', WHITE, 'wall') } }), fl = sf('rbrick', WHITE, 'floor');
  room(F, '正廳', -2.925, 2.925, Z0, Z1, { floor: fl, probe: [0, 0.6] });
  room(F, '房間', X0, -3.075, Z0, Z1, { floor: fl, probe: [-6.0, 0.8] });
  room(F, '灶腳', 3.075, X1, Z0, Z1, { floor: fl, probe: [7.2, -0.6] });
  for (const s of [-1, 1]) wall(F, 'z', s * 8.875, Z0, Z1, { t: 0.25, p: s < 0 ? wallS : null, n: s > 0 ? wallS : null });
  wall(F, 'x', -2.875, X0, X1, { t: 0.25, p: wallS, out: -1, view: 'field', voff: 0.6, ops: [-6.0, 6.0].map((x) => ({ a: x - 0.5, b: x + 0.5, y0: 1.5, y1: 2.3, k: 'win', grille: 'grille3', frame: '#6a4a36' })) });
  wall(F, 'x', 2.875, X0, X1, { t: 0.25, n: wallS, out: 1, view: 'court', voff: 0.05, ops: [{ a: -1.0, b: 1.0, y0: 0, y1: 2.5, k: 'door', leaves: 2, frame: '#5a3a22' }, { a: -5.8, b: -4.2, y0: 1.0, y1: 2.3, k: 'win', grille: 'grille3', frame: '#6a4a36' }, { a: 4.2, b: 5.8, y0: 1.0, y1: 2.3, k: 'win', grille: 'grille3', frame: '#6a4a36' }] });
  for (const s of [-1, 1]) wall(F, 'z', s * 3.0, Z0, Z1, { t: 0.15, h: 3.4, p: wallS, n: wallS, top: true, ops: [{ a: -1.9, b: -0.9, y0: 0, y1: 2.1, k: 'idoor', leaf: false, wood: '#6b4a2e' }] }); // 往房間、灶腳的門（靠後面，太師椅不擋）
  ready(F);
  // 屋頂（裡面看：斜的木板、桁木、中間的大樑）
  const RY = (z) => 3.4 + (1 - Math.abs(z) / 2.75) * 1.3;
  const SL = Math.hypot(1.3, 2.75), pu = dotUV(SU('plaster')).slice(0, 2), wcol = C('#f0e9d8');
  plane(B, 'wall', [X0, RY(0), 0], [1, 0, 0], [0, -1.3 / SL, 2.75 / SL], X1 - X0, SL, SU('timber'), PER.timber, C('#c9a47a'), [], [0.3, SL - 0.3]);
  plane(B, 'wall', [X1, RY(0), 0], [-1, 0, 0], [0, -1.3 / SL, -2.75 / SL], X1 - X0, SL, SU('timber'), PER.timber, C('#c9a47a'), [], [0.3, SL - 0.3]);
  for (const x of [-3.0, 3.0]) { B.tri('wall', [x, 3.4, -2.75], [x, 3.4, 2.75], [x, RY(0), 0], pu, pu, pu, wcol); B.tri('wall', [x, 3.4, 2.75], [x, 3.4, -2.75], [x, RY(0), 0], pu, pu, pu, wcol); }
  for (const s of [-1, 1]) B.tri('wall', [s * X1, 3.4, s < 0 ? 2.75 : -2.75], [s * X1, 3.4, s < 0 ? -2.75 : 2.75], [s * X1, RY(0), 0], pu, pu, pu, wcol);
  for (const z of [-2.0, -1.0, 0, 1.0, 2.0]) bx(F, 'prop', F0, [X0, RY(z) - 0.2, z - 0.09, X1, RY(z) - 0.02, z + 0.09], WHITE, PU('pwood'));
  bx(F, 'prop', F0, [-2.9, RY(0) - 0.35, -0.14, 2.9, RY(0) - 0.05, 0.14], WHITE, { pz: PU('beam'), nz: PU('beam'), _: dotUV(PU('pwood')) });
  // 正廳：神明桌（大）、八仙桌、太師椅
  altar(F, frame(0, 0, Z0, 0), { w: 2.3, room: '正廳' });
  wallPic(F, frame(0, 0, Z0, 0), 'plaque2', 1.6, 0.6, 2.75);
  for (const s of [-1, 1]) { const T = frame(s * 2.925, 0, 0.9, -s * HP); for (const dz of [-0.6, 0.6]) { const S = T.sub(dz, 0, 0.35); bx(F, 'prop', S, [-0.28, 0.44, -0.25, 0.28, 0.5, 0.25], WHITE, WOOD()); bx(F, 'prop', S, [-0.28, 0.5, -0.28, 0.28, 1.1, -0.22], WHITE, { pz: PU('redCarve'), _: WOOD() }); for (const sx of [-1, 1]) bx(F, 'prop', S, [sx * 0.28 - 0.03, 0, -0.25, sx * 0.28 + 0.03, 0.72, 0.25], WHITE, WOOD()); colT(F, S, -0.3, -0.28, 0.3, 0.27, 1.1); spot(F, 'sit', S, 0, 0, -HP, 0.5, '正廳'); } bx(F, 'prop', T.sub(0, 0, 0.3), [-0.22, 0, -0.22, 0.22, 0.75, 0.22], WHITE, WOOD()); colT(F, T.sub(0, 0, 0.3), -0.22, -0.22, 0.22, 0.22, 0.75); }
  // 房間：紅眠床、衣櫥、木箱
  { const T = frame(-6.0, 0, Z0, 0), W2 = 1.9, L = 1.95, rc = PU('redCarve'), gc = PU('goldCarve');
    bx(F, 'prop', T, [-W2 / 2, 0, 0.05, W2 / 2, 0.5, L], WHITE, WOOD()); bx(F, 'wall', T, [-W2 / 2 + 0.05, 0.5, 0.1, W2 / 2 - 0.05, 0.54, L - 0.05], WHITE, SU('tatami'));
    for (const x of [-W2 / 2, W2 / 2 - 0.08]) for (const z of [0.05, L - 0.08]) bx(F, 'prop', T, [x, 0, z, x + 0.08, 2.3, z + 0.08], WHITE, WOOD());
    bx(F, 'prop', T, [-W2 / 2, 2.1, 0.05, W2 / 2, 2.3, L], WHITE, { pz: gc, _: rc }); bx(F, 'prop', T, [-W2 / 2, 0.54, 0.05, W2 / 2, 2.1, 0.12], WHITE, rc);
    for (const s of [-1, 1]) bx(F, 'prop', T, [s < 0 ? -W2 / 2 : W2 / 2 - 0.35, 1.5, L - 0.06, s < 0 ? -W2 / 2 + 0.35 : W2 / 2, 2.1, L], WHITE, gc);
    bx(F, 'prop', T, [-0.5, 0.54, 0.2, 0.5, 0.66, 0.5], C('#fbfaf6'), PU('pillow')); bx(F, 'prop', T, [-0.8, 0.54, 1.0, 0.8, 0.62, 1.8], C('#6f8fb8'), PU('quilt'));
    colT(F, T, -W2 / 2, 0, W2 / 2, L, 2.3); blob(F, -W2 / 2, 0, W2 / 2, L, 1, T); spot(F, 'sleep', T, 0, 0.95, HP, 0.58, '房間'); }
  wardrobe(F, frame(X0, 0, 0.8, HP), { w: 1.2, col: '#8a5a3a', boxes: false });
  bx(F, 'prop', frame(-3.5, 0, 1.7, -HP), [-0.45, 0, 0.02, 0.45, 0.5, 0.5], WHITE, { py: PU('redCarve'), _: WOOD() }); colT(F, frame(-3.5, 0, 1.7, -HP), -0.45, 0, 0.45, 0.5, 0.5);
  // 灶腳：磚灶（兩口鍋）、煙囪、水缸、柴、碗櫥、小桌子
  { const T = frame(6.2, 0, Z0, 0); bx(F, 'wall', T, [-1.1, 0, 0.02, 1.1, 0.85, 0.9], WHITE, SU('wbrick')); hq(B, 'wall', T, -1.1, 0.02, 1.1, 0.9, 0.851, dotUV(SU('plaster')), C('#8a8078'));
    for (const x of [-0.5, 0.5]) { ball(B, 'metal', T, x, 0.87, 0.46, 0.34, 0.12, 0.34, C('#2f3034'), null, 10, 3); cyl(B, 'prop', T, x, 0.46, 0.87, 1.02, 0.36, 0.33, 10, C('#6b5a48'), null, true); }
    bx(F, 'wall', T, [0.75, 0.85, 0.02, 1.1, 3.4, 0.35], WHITE, SU('wbrick')); vq(B, 'prop', T, [-0.35, 0.901], [0.35, 0.901], 0.12, 0.5, dotUV(PU('white')), C('#1a1612'));
    colT(F, T, -1.1, 0, 1.1, 0.9, 1.0); blob(F, -1.1, 0, 1.1, 0.9, 1, T); spot(F, 'stand', T, 0, 1.3, HP, null, '灶腳'); }
  cyl(B, 'shiny', frame(8.2, 0, -2.2), 0, 0, 0, 0.75, 0.32, 0.38, 12, C('#5a3a24')); cyl(B, 'prop', frame(8.2, 0, -2.2), 0, 0, 0.74, 0.76, 0.34, 0.34, 12, C('#3a2a1a')); colC(F, 8.2, -2.2, 0.4, 0.76);
  for (let i = 0; i < 9; i++) tube(B, 'prop', [4.0 + (i % 3) * 0.02, 0.1 + ((i / 3) | 0) * 0.14, -2.4 + (i % 3) * 0.16], [4.9, 0.1 + ((i / 3) | 0) * 0.14, -2.4 + (i % 3) * 0.16], 0.065, 0.065, 5, C(i % 2 ? '#8a6a44' : '#6b5040'), null, true);
  colBox(F, 3.9, -2.75, 5.0, -1.9, 0.5);
  bookshelf(F, frame(X1, 0, 0.9, -HP), { w: 1.0, h: 1.7 });
  dining(F, frame(5.6, 0, 0.9), { w: 0.8, d: 0.8, h: 0.72, top: '#b8946a', legs: '#6b4a2e', stool: '#c9a878', seats: [[0, -0.65, -HP], [0, 0.65, HP], [-0.65, 0, 0]], cover: '#8fc1e3', room: '灶腳' });
  // 燈
  fixture(F, 0, 0.3, 'bulb', { y: RY(0.3) - 0.35 }); fixture(F, -6, 0.3, 'bulb', { y: RY(0.3) - 0.35 }); fixture(F, 6, 0.3, 'bulb', { y: RY(0.3) - 0.35 });
  lamp(F, 0, 0.3, 5, '#ffe6c0', 3.2); lamp(F, -6.0, 0.4, 3.5, '#ffe6c0', 3.2);
  F.sun = { from: [0.1, 0.55, 1], I: 0.85 }; F.hemi = { sky: '#fff6e8', ground: '#a88e74', I: 1.5 };
  exitZone(F, -0.85, Z1 - 0.55, 0.85, 3.25, 'outside', null); colBox(F, -1.3, 3.2, 1.3, 3.7, 3);
  F.spawnIn = { x: 0, z: Z1 - 1.15, lh: HP };
  path(F, 0, Z1 - 0.9, 0, -1.2, 0.5); path(F, -2.5, -1.4, -6.0, 0.4, 0.45); path(F, 2.5, -1.4, 6.0, 0.2, 0.45);
  F.cam = { maxDist: 3.6, ceiling: 3.25, near: 0.1 };
  return F;
}

// ---- 對外：interiorFor（便宜的說明）、buildInterior（蓋出來）----
// 哪些房子走得進去：透天厝（含一樓的店）、超商、廟、三合院；車庫、車店、改車廠本來就有自己的（null）
function kindOf(b) {
  if (!b || !isFinite(b.x) || !isFinite(b.z)) return null;
  if (b.kind === 'house') return 'house';
  if (b.kind === 'shop') return (b.name || '').includes('改車') || b.hx > 8 ? null : 'house';
  if (b.kind === 'store' || b.kind === 'temple' || b.kind === 'farmhouse') return b.kind;
  return null;
}
const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
function toWorld(b) { const c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0); return (x, z) => [b.x + x * c + z * s, b.z - x * s + z * c]; }
// 本地的說明：enter（外面門口前的長方形）、outside（走出來站的地方）都是本地
function planOf(b, kind) {
  if (kind === 'house') {
    const H = houseInfo(b), rooms = [];
    for (let n = 0; n < H.N; n++) { const [f, k] = roomNames(H, n); rooms.push([f, n === 0 && H.Wp >= 2.4 && !H.biz ? '餐廳' : '走道', k]); } // 跟蓋出來的 floors[n].rooms 一樣（前面、中間、後面）
    const dx = clamp(H.doorX, -H.hx + 0.75, H.hx - 0.75), wide = H.front === 'shop';
    return { kind, biz: H.biz, name: H.biz ? shopName(b, H.biz) : b.name || `透天厝（${CNUM[H.N] || H.N}樓）`, floors: H.N, size: { w: b.hx * 2, d: b.hz * 2 }, rooms,
      enter: wide ? { x: 0, z: H.hz + 0.28, hx: H.hx - 0.4, hz: 0.27 } : { x: dx, z: H.hz + 0.28, hx: 0.65, hz: 0.27 }, outside: { x: dx, z: H.hz + 1.35, lh: -HP } };
  }
  if (kind === 'store') return { kind, biz: 'store', name: b.name || '村口超商', floors: 1, size: { w: 18, d: 13 }, rooms: [[b.name || '村口超商']], enter: { x: 0, z: 6.78, hx: 1.1, hz: 0.27 }, outside: { x: 0, z: 7.95, lh: -HP } };
  if (kind === 'temple') return { kind, biz: 'temple', name: b.name || '福德宮', floors: 1, size: { w: 12.4, d: 7.4 }, rooms: [[b.name || '福德宮']], enter: { x: 0, z: 7.4, hx: 2.4, hz: 0.45 }, outside: { x: 0, z: 8.55, lh: -HP } };
  return { kind, biz: 'farm', name: b.name || '三合院', floors: 1, size: { w: 18, d: 6 }, rooms: [['正廳', '房間', '灶腳']], enter: { x: 0, z: 3.28, hx: 0.9, hz: 0.27 }, outside: { x: 0, z: 4.15, lh: -HP } };
}
function interiorFor(b) {
  const kind = kindOf(b); if (!kind) return null;
  const P = planOf(b, kind), W = toWorld(b), e = W(P.enter.x, P.enter.z), o = W(P.outside.x, P.outside.z);
  return { kind: P.kind, biz: P.biz === 'store' || P.biz === 'temple' || P.biz === 'farm' ? null : P.biz, name: P.name, floors: P.floors, size: P.size, rooms: P.rooms,
    enter: { x: e[0], z: e[1], hx: P.enter.hx, hz: P.enter.hz, rot: b.rot || 0 }, outside: { x: o[0], z: o[1], heading: wrapA(P.outside.lh + (b.rot || 0)) } };
}
// 每一層固定一樣的燈：半球光＋平行光（從正面照進來）＋兩個點光源（換房子、換樓層都不用重新編譯 shader）
function addLights(g, F) {
  const hm = F.hemi || { sky: '#fffaf2', ground: '#c8b89c', I: 1.5 }, sn = F.sun || { from: [0.3, 0.75, 1], I: 0.8 };
  const h = new THREE.HemisphereLight(new THREE.Color(hm.sky), new THREE.Color(hm.ground), hm.I); h.name = 'int-hemi'; g.add(h);
  const d = new THREE.DirectionalLight(0xfff2de, sn.I); d.name = 'int-sun'; d.position.set(sn.from[0] * 10, sn.from[1] * 10, sn.from[2] * 10); d.target.position.set(0, 0, 0); g.add(d, d.target);
  for (let i = 0; i < 2; i++) { const L = F.lamps[i]; const p = new THREE.PointLight(new THREE.Color(L ? L.c : '#ffffff'), L ? L.I * 4 : 0, 0, 2); p.name = 'int-lamp' + i; p.position.set(L ? L.x : 0, L ? L.y : 2.5, L ? L.z : 0); g.add(p); }
}
function buildInterior(b, o = {}) {
  const q = o.quality === 'low' ? 'low' : 'high';
  if (b == null) { shared(o.renderer || null, q); return null; } // 先做好共用的貼圖、環境貼圖、材質（載入畫面叫一次，第一次走進門就不會頓）
  const kind = kindOf(b); if (!kind) return null;
  const t0 = now(), fresh = !SH || (o.renderer && !SH.envTried);
  shared(o.renderer || null, q); const mats = SH.mats[q];
  const P = planOf(b, kind), W = toWorld(b), rot = b.rot || 0;
  let Fs;
  if (kind === 'house') { const H = houseInfo(b); Fs = []; for (let n = 0; n < H.N; n++) Fs.push(houseFloor(H, n)); }
  else Fs = [kind === 'store' ? storeFloor(b) : kind === 'temple' ? templeFloor(b) : farmFloor(b)];
  const group = new THREE.Group(); group.name = 'interior:' + P.name; group.position.set(b.x, 0, b.z); group.rotation.y = rot;
  const xz = (x, z) => { const p = W(x, z); return { x: p[0], z: p[1] }; };
  const pose = (p) => ({ ...xz(p.x, p.z), heading: wrapA(p.lh + rot) });
  const outside = pose(P.outside);
  let tris = 0, draws = 0;
  const floors = Fs.map((F, i) => {
    const { group: g, draws: dc } = F.B.build(mats); g.name = 'floor-' + F.label; g.visible = i === 0; addLights(g, F); group.add(g);
    tris += F.B.tris; draws = Math.max(draws, dc);
    const spots = {}; for (const [k, list] of Object.entries(F.spots)) spots[k] = list.map((s) => { const r = { ...xz(s.x, s.z), heading: wrapA(s.heading + rot) }; if (s.y != null) r.y = s.y; if (s.room) r.room = s.room; if (s.edge) r.edge = true; return r; });
    const rs = F.rooms.length ? F.rooms : [{ x0: -1, x1: 1, z0: -1, z1: 1 }];
    const bx0 = Math.min(...rs.map((r) => r.x0)), bx1 = Math.max(...rs.map((r) => r.x1)), bz0 = Math.min(...rs.map((r) => r.z0)), bz1 = Math.max(...rs.map((r) => r.z1));
    return {
      index: i, label: F.label, group: g, draws: dc, tris: F.B.tris,
      colliders: F.cols.map((c) => (c.t === 'box' ? { t: 'box', ...xz(c.x, c.z), hx: c.hx, hz: c.hz, rot: wrapA((c.rot || 0) + rot), h: c.h } : { t: 'circle', ...xz(c.x, c.z), r: c.r, h: c.h })),
      exits: F.exits.map((e) => ({ ...xz(e.x, e.z), hx: e.hx, hz: e.hz, rot, to: e.to, spawn: e.to === 'outside' ? { ...outside } : pose(e.spawn), door: { ...xz(e.x, e.z + e.hz - 0.35), ry: wrapA(Math.PI + rot), w: e.hx } })),
      spots, rooms: F.named.map((r) => ({ name: r.name, ...xz((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2), hx: (r.x1 - r.x0) / 2, hz: (r.z1 - r.z0) / 2, rot, probe: xz(r.probe[0], r.probe[1]) })),
      camera: { maxDist: 3, ceiling: F.ch - 0.2, near: 0.1, ...(F.cam || {}) },
      bounds: { ...xz((bx0 + bx1) / 2, (bz0 + bz1) / 2), hx: (bx1 - bx0) / 2, hz: (bz1 - bz0) / 2, rot },
    };
  });
  const I = {
    group, floors, floor: 0, kind: P.kind, name: P.name, spawn: pose(Fs[0].spawnIn || { x: 0, z: 0, lh: HP }), outside,
    background: new THREE.Color(0xd8e8f3),
    setFloor(i) {
      i = clamp(i | 0, 0, floors.length - 1); I.floor = i;
      floors.forEach((f, k) => { f.group.visible = k === i; });
      const f = floors[i]; I.colliders = f.colliders; I.exits = f.exits; I.spots = f.spots; I.rooms = f.rooms; I.camera = f.camera; I.bounds = f.bounds;
      return f;
    },
    dispose() { group.traverse((m) => { if (m.isMesh) m.geometry.dispose(); }); group.removeFromParent(); group.clear(); floors.length = 0; },
  };
  I.setFloor(0);
  I.info = { kind: P.kind, biz: P.biz === 'store' || P.biz === 'temple' || P.biz === 'farm' ? null : P.biz, name: P.name, floors: floors.length, tris, draws, ms: +(now() - t0).toFixed(1) };
  if (fresh) I.info.shared = { ...SH.ms }; // 這一次順便做了共用的（atlas＝canvas 貼圖、env＝PMREM）
  return I;
}
return { buildInterior, interiorFor, interiorFonts, disposeInteriorCache };
})();
