// ---- 第 72 批：內湖的街景照 Nick 2026-11-07 的照片做（江南街、內湖路一段、環山路二段／三段）----
//   照片只拿來看（/mnt/project-files/car-game/neihu/ref-2026-11-07/），照片本身永遠不進遊戲。
//   店名用諧音（Nick 2026-11-07「可以用諧音字 就是不完全一樣 但又看得出來是在講那家店」）：顏色跟真的店像、名字差一兩個字、logo 畫得不一樣；沒有真的品牌名字和 logo。
//   江南街：騎樓、一整排停著的機車、彩色發亮的燈箱招牌、4～5 樓公寓（後面幾棟 12 樓以上的大樓）、紅綠燈
//   內湖路一段：一排大王椰子、公車亭、路燈、7 樓公寓、圍牆＋樹籬＋後面的樹、變電箱彩繪
//   環山路：擋土牆＋很多樹、新大樓＋舊公寓混著、鷹架的工地（塔吊）、停車格＋停著的車（第 74 批起是車店的車：spots.parked 只給位置，town.src.js／crush.js 開到附近才做）、綠色路牌、公車亭、共享腳踏車站「優拜客」
// 【API】（neihu.js 的 buildNeihu 叫）
//   nhStreetPrep({ N, nx, nz, names, hh }) → S：floorsOf(b, bi, cx, cz)（這三條路邊的房子照真的樓層）、arcadeFix(b)（江南街的騎樓）、noTree(x, z)（內湖路的行道樹換成大王椰子）、nearKey(x, z)
//   nhStreetBuild(ctx) → { meshes（InstancedMesh：機車、大王椰子；250 公尺一格，跟樹一樣遠了不畫）, poles（路燈：look.js 晚上最近的幾支真的有光）, info, spots（parked＝停車格的車的位置）, tex }
//   效能：全部合併進 neihu.js 的格子（wall、paint、sign2）或 InstancedMesh；每格不多幾個 draw call
import * as THREE from 'three';

export const { nhStreetPrep, nhStreetBuild, NH_STREET_TEXT } = (() => {
const TAU = Math.PI * 2;
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", "WenQuanYi Zen Hei", sans-serif';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hh = (i, k) => { let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; };
const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9; let t = ((px - ax) * dx + (pz - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(ax + dx * t - px, az + dz * t - pz); };
const inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const rotOf = (ux, uz) => Math.atan2(-uz, ux);
const col255 = (hex) => { const c = new THREE.Color(hex); return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]; };
const shade = (c, k) => [Math.min(255, Math.round(c[0] * k)), Math.min(255, Math.round(c[1] * k)), Math.min(255, Math.round(c[2] * k))];
const KEYS = { 江南街: 'jn', 內湖路一段: 'nh', 環山路二段: 'hs', 環山路三段: 'hs' };
const KEY_NAME = { jn: '江南街', nh: '內湖路一段', hs: '環山路' };

// ---- 諧音店名（[大字, 小字, 底色, 字色, 圖案]）：顏色像真的那家、名字差一兩個字、圖案不一樣 ----
const CHAINS = [
  ['58°C', '烘焙咖啡', '#d9242b', '#ffffff', 'cup'], ['柒拾壹', '便利商店', '#ffffff', '#1f7a3c', 'bars'], ['全嘉', '便利商店', '#1d5fb8', '#ffffff', 'house'],
  ['台彎彩卷', '', '#f8d530', '#d2232a', 'star'], ['麥噹噹', '', '#d52b1e', '#ffc72c', 'burger'], ['星巴客', 'COFFEE', '#00704a', '#ffffff', 'star'],
  ['全連', '福利中心', '#1aa260', '#ffffff', 'cart'], ['屈成氏', '', '#00a39a', '#ffffff', 'plus'], ['康時美', '藥妝', '#e6007e', '#ffffff', 'leaf'],
  ['五十籃', '', '#ffd400', '#1f4fa3', 'cup'], ['清新福全', '', '#1b8f3a', '#f6e04d', 'cup'], ['小被百貨', '', '#e62129', '#ffe600', 'none'],
  ['燦崑3C', '', '#ffd100', '#0054a6', 'bolt'], ['永情房屋', '', '#f5b800', '#1c3f94', 'house'], ['信議房屋', '', '#c8102e', '#ffffff', 'house'],
  ['路意莎', 'COFFEE', '#5b3a1e', '#ffffff', 'cup'], ['摩絲漢堡', '', '#d22630', '#ffffff', 'burger'], ['肯德雞', '', '#e4002b', '#ffffff', 'none'],
  ['大芳子', '鮮果飲', '#ffffff', '#f26522', 'leaf'], ['寶稚', '生活館', '#e5007d', '#ffffff', 'none'], ['美廉舍', '', '#ff6a00', '#ffffff', 'cart'],
  ['米斯特', '甜甜圈', '#e60012', '#ffffff', 'ring'], ['丹提咖啡', '', '#2b2b2b', '#e8c66a', 'cup'], ['阿瘦皮鞋', '', '#ffffff', '#1f1f1f', 'none'],
];
const GENERIC = [['王記牛肉麵', '#c62f25', '#ffffff'], ['好運彩券行', '#ffd400', '#c62f25'], ['快樂髮廊', '#ffffff', '#e5007d'], ['大眾眼鏡', '#1f5fae', '#ffffff'], ['安心藥局', '#2e9a5c', '#ffffff'], ['阿婆豆花', '#f28c28', '#ffffff'],
  ['內湖機車行', '#222222', '#f3c623'], ['幸福早餐', '#f6c343', '#b3261e'], ['青春補習班', '#ffffff', '#1f5fae'], ['好鄰居水果', '#2a8a4a', '#fff3b0'], ['美美美甲', '#ff7ab8', '#ffffff'], ['老張鍋貼', '#8a2b1a', '#ffe9b0']];
const NH_STREET_TEXT = [...new Set([...CHAINS.flatMap((c) => c[0] + c[1]), ...GENERIC.map((g) => g[0]), ...'公車站施工中請小心優拜客租借站內湖路環山路港墘路江南街←→↑↓往'].join(''))].join('');

// ==== 第一步（蓋房子以前）：三條路、路邊的房子幾層、江南街的騎樓、哪裡不種一般的樹 ====
function nhStreetPrep({ N, nx, nz, names }) {
  const segs = []; // { key, name, a, b, w, sw, r, ri }
  N.roads.forEach((r, ri) => { const nm = r.nm >= 0 ? names[r.nm][0] : ''; const key = KEYS[nm]; if (!key) return; for (let i = 1; i < r.n.length; i++) segs.push({ key, name: nm, a: [nx(r.n[i - 1]), nz(r.n[i - 1])], b: [nx(r.n[i]), nz(r.n[i])], w: r.w, sw: r.sw, r, ri }); });
  const roads = []; { const seen = new Set(); for (const s of segs) if (!seen.has(s.r)) { seen.add(s.r); roads.push({ key: s.key, name: s.name, r: s.r, ri: s.ri, pts: s.r.n.map((i) => [nx(i), nz(i)]) }); } }
  const out = { key: null, d: Infinity, seg: null };
  const nearKey = (x, z) => { out.key = null; out.d = Infinity; out.seg = null; for (const s of segs) { const d = segD(x, z, s.a[0], s.a[1], s.b[0], s.b[1]); if (d < out.d) { out.d = d; out.key = s.key; out.seg = s; } } return out; };
  const fronting = (x, z, extra) => { const k = nearKey(x, z); return k.seg && k.d <= k.seg.w / 2 + k.seg.sw + extra ? k : null; };
  let site = null; // 工地（環山路）：哪一棟換成工地 { b, bi, rect }
  function floorsOf(b, bi, cx, cz) {
    let fx = cx, fz = cz; if (b.gen) { fx = (b.P[0][0] + b.P[1][0]) / 2; fz = (b.P[0][1] + b.P[1][1]) / 2; }
    const k = fronting(fx, fz, 8), r = hh(bi, 300); // 補的長方形的前面離路中線約 9～11.6 公尺
    if (k) {
      let fl = clamp(b.f, 2, 15);
      if (k.key === 'jn') fl = b.f >= 9 ? Math.min(14, b.f) : clamp(b.f, 3, 5);
      else if (k.key === 'nh') fl = b.f <= 3 ? 5 + Math.floor(r * 3) : Math.min(15, b.f);
      else { fl = Math.min(15, b.f); if (fl <= 2) fl = 3 + Math.floor(r * 3); }
      const st = fl >= 11 ? (r < 0.55 ? 4 : null) : k.key === 'hs' && fl <= 5 && r < 0.4 ? 7 : null;
      return { fl, st, key: k.key };
    }
    const j = nearKey(cx, cz); if (j.key === 'jn' && j.d > 18 && j.d < 75 && hh(bi, 301) < 0.16) return { fl: 12 + Math.floor(hh(bi, 302) * 3), st: hh(bi, 303) < 0.6 ? 4 : null, key: null }; // 江南街後面一排：高樓（照片裡後面有 12 樓以上的大樓）
    return null;
  }
  function arcadeFix(b, bi) { // 江南街（cls 4，轉換程式只給大路做騎樓）：臨路的補的長方形也做騎樓（一樓退 3.2 公尺、柱子）
    if (!b.gen || !b.rect || b.e[0] === 2 || b.f < 3) return false;
    const [cx, cz, hx, hz, rot] = b.rect; if (hz <= 4.5 || hx * 2 < 4.4) return false;
    const fx = (b.P[0][0] + b.P[1][0]) / 2, fz = (b.P[0][1] + b.P[1][1]) / 2, k = fronting(fx, fz, 7); if (!k || k.key !== 'jn') return false;
    const ux = Math.cos(rot), uz = -Math.sin(rot), vx = -uz, vz = ux, P = b.P;
    b.e[0] = 2; b.core = [[P[0][0] + vx * 3.2, P[0][1] + vz * 3.2], [P[1][0] + vx * 3.2, P[1][1] + vz * 3.2], P[2], P[3]]; b.col = [[cx + vx * 1.6, cz + vz * 1.6, hx, hz - 1.6, rot]];
    return true;
  }
  // 工地：環山路中段、臨路、夠大的補的長方形
  { let best = null; N.bld.forEach((b, bi) => { if (!b.gen || !b.rect || b.back || b.rect[2] < 8 || b.rect[3] < 8 || b.rect[2] > 20 || b.rect[3] > 20) return; const fx = (b.P[0][0] + b.P[1][0]) / 2, fz = (b.P[0][1] + b.P[1][1]) / 2, k = fronting(fx, fz, 1.5); if (!k || k.key !== 'hs') return; const sc = Math.abs(fx - 520) + hh(bi, 310) * 60; if (!best || sc < best.sc) best = { b, bi, sc }; });
    if (best) { site = { b: best.b, bi: best.bi, rect: best.b.rect }; best.b.site = true; } }
  const noTree = (x, z) => { const k = nearKey(x, z); if (k.key === 'nh' && k.d < k.seg.w / 2 + k.seg.sw + 0.6) return true; if (site) { const [cx, cz, hx, hz] = site.rect; if (Math.abs(x - cx) < hx + 2 && Math.abs(z - cz) < hz + 2) return true; } return false; };
  return { segs, roads, nearKey, fronting, floorsOf, arcadeFix, noTree, site, KEY_NAME };
}

// ==== 第二步：路邊的東西 ====
function nhStreetBuild(ctx) {
  const { S, N, nx, nz, deg, jR, bank, boxG, wallQ, quad3, flatPoly, colliders, addTree, TB, TG, inBox, cv, fitFont, mats, aniso, Geo, workUV, GB } = ctx;
  const info = { scooters: 0, cars: 0, bays: 0, palms: 0, lamps: 0, shelters: 0, signals: 0, uboxes: 0, wallM: 0, rwallM: 0, site: 0, guides: 0, bikes: 0, boxes: 0, hedgeTrees: 0 };
  const spots = { shelters: [], signals: [], guides: [], ubike: [], site: null, views: {}, parked: [], roads: S.roads.map((rd) => ({ key: rd.key, name: rd.name, pts: rd.pts })) }; // roads：三條路每一段 way 的中線（一條路好幾段；測試：哪些房子是照真的樓層蓋高的） // parked（第 74 批）：停車格裡停著的車 [x, z, 車頭方向, 亂數種子]：town.src.js／crush.js 開到附近才做成車店的車（輕量車）
  const WHITE = [255, 255, 255];
  // ---- 招牌、燈箱、牌子的貼圖（一張 1024×1024）----
  const [ac, ag] = cv(1024, 1024), UV = {}; const W = 1024, H = 1024;
  const reg = (key, x, y, w, h, draw) => { ag.save(); ag.beginPath(); ag.rect(x, y, w, h); ag.clip(); ag.translate(x, y); draw(ag, w, h); ag.restore(); UV[key] = [(x + 1) / W, 1 - (y + h - 1) / H, (x + w - 1) / W, 1 - (y + 1) / H]; };
  const T = (g, t, x, y, px, col, max, wt = 900) => { if (!t) return; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, t, max, px, wt); g.fillText(t, x, y); };
  const icon = (g, kind, x, y, r, fg, bg) => { // 自己畫的小圖案（不是真的 logo）
    g.save(); g.translate(x, y); g.fillStyle = fg; g.strokeStyle = fg; g.lineWidth = Math.max(2, r * 0.16);
    if (kind === 'cup') { g.beginPath(); g.moveTo(-r * 0.6, -r * 0.4); g.lineTo(r * 0.6, -r * 0.4); g.lineTo(r * 0.4, r * 0.6); g.lineTo(-r * 0.4, r * 0.6); g.closePath(); g.fill(); g.beginPath(); g.arc(r * 0.72, 0, r * 0.3, -1.3, 1.3); g.stroke(); g.fillStyle = bg; g.fillRect(-r * 0.3, -r * 0.1, r * 0.6, r * 0.12); }
    else if (kind === 'bars') { for (let i = 0; i < 3; i++) { g.fillStyle = ['#f47b20', '#1f7a3c', '#d6342b'][i]; g.fillRect(-r + i * r * 0.7, -r, r * 0.55, r * 2); } }
    else if (kind === 'house') { g.beginPath(); g.moveTo(-r, 0); g.lineTo(0, -r); g.lineTo(r, 0); g.closePath(); g.fill(); g.fillRect(-r * 0.7, 0, r * 1.4, r * 0.9); g.fillStyle = bg; g.fillRect(-r * 0.2, r * 0.3, r * 0.4, r * 0.6); }
    else if (kind === 'star') { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); }
    else if (kind === 'burger') { g.beginPath(); g.arc(0, -r * 0.2, r, Math.PI, 0); g.fill(); g.fillRect(-r, r * 0.05, r * 2, r * 0.3); g.fillRect(-r * 0.9, r * 0.45, r * 1.8, r * 0.45); g.fillStyle = bg; g.beginPath(); g.arc(-r * 0.35, -r * 0.35, r * 0.1, 0, TAU); g.arc(r * 0.35, -r * 0.35, r * 0.1, 0, TAU); g.fill(); }
    else if (kind === 'cart') { g.fillRect(-r * 0.8, -r * 0.5, r * 1.6, r * 0.8); g.beginPath(); g.arc(-r * 0.4, r * 0.7, r * 0.2, 0, TAU); g.arc(r * 0.4, r * 0.7, r * 0.2, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-r, -r * 0.9); g.lineTo(-r * 0.7, -r * 0.9); g.lineTo(-r * 0.6, -r * 0.5); g.stroke(); }
    else if (kind === 'plus') { g.fillRect(-r * 0.3, -r, r * 0.6, r * 2); g.fillRect(-r, -r * 0.3, r * 2, r * 0.6); }
    else if (kind === 'leaf') { g.beginPath(); g.moveTo(0, r); g.quadraticCurveTo(-r * 1.2, 0, 0, -r); g.quadraticCurveTo(r * 1.2, 0, 0, r); g.fill(); g.strokeStyle = bg; g.beginPath(); g.moveTo(0, r * 0.8); g.lineTo(0, -r * 0.7); g.stroke(); }
    else if (kind === 'bolt') { g.beginPath(); g.moveTo(r * 0.2, -r); g.lineTo(-r * 0.6, r * 0.15); g.lineTo(0, r * 0.15); g.lineTo(-r * 0.2, r); g.lineTo(r * 0.6, -r * 0.15); g.lineTo(0, -r * 0.15); g.closePath(); g.fill(); }
    else if (kind === 'ring') { g.lineWidth = r * 0.5; g.beginPath(); g.arc(0, 0, r * 0.7, 0, TAU); g.stroke(); }
    g.restore();
  };
  // 橫的燈箱 256×80：24 格（h0…h23）：諧音的連鎖店＋自己編的店
  const LB = [...CHAINS, ...GENERIC.map((g) => [g[0], '', g[1], g[2], 'none'])];
  LB.slice(0, 36).forEach(([big, small, bg, fg, ic], i) => reg('h' + i, (i % 4) * 256, Math.floor(i / 4) * 80, 256, 80, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6);
    const hasIc = ic !== 'none'; if (hasIc) icon(g, ic, 42, h / 2, 24, fg, bg);
    const x0 = hasIc ? 84 : 14, cw = w - x0 - 12;
    if (small) { T(g, big, x0 + cw / 2, 30, 40, fg, cw); T(g, small, x0 + cw / 2, 62, 18, fg, cw, 700); } else T(g, big, x0 + cw / 2, h / 2, 44, fg, cw);
  }));
  // 綠色路牌 256×96 × 6（g0…g5）：蓋的時候照路口填字
  const guideCells = []; let nG = 0;
  const guideCell = (top, bot) => { const key = 'g' + nG; if (nG >= 6) return null; const i = nG++; reg(key, (i % 4) * 256, 720 + Math.floor(i / 4) * 96, 256, 96, (g, w, h) => { g.fillStyle = '#1d7a46'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8); T(g, top, w / 2, 30, 34, '#fff', w - 20, 700); T(g, bot, w / 2, 68, 30, '#fff', w - 20, 700); }); guideCells.push(key); return key; };
  // 小牌子 128×128：公車站、優拜客、變電箱彩繪 ×2、綠色的鷹架網、路燈的燈
  const sm = (key, i, draw) => reg(key, i * 128, 912, 128, 112, draw);
  sm('bus', 0, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f5fae'; g.fillRect(0, 0, w, 36); T(g, '公車站', w / 2, 18, 24, '#fff', w - 10); g.fillStyle = '#1f5fae'; g.fillRect(24, 50, 80, 36); g.fillStyle = '#cfe0ff'; for (let k = 0; k < 3; k++) g.fillRect(30 + k * 25, 56, 18, 14); g.fillStyle = '#222'; g.beginPath(); g.arc(42, 90, 7, 0, TAU); g.arc(86, 90, 7, 0, TAU); g.fill(); });
  sm('ubike', 1, (g, w, h) => { g.fillStyle = '#ffd400'; g.fillRect(0, 0, w, h); T(g, '優拜客', w / 2, 26, 30, '#1f1f1f', w - 10); T(g, '租借站', w / 2, 96, 20, '#1f1f1f', w - 10, 700); g.strokeStyle = '#1f1f1f'; g.lineWidth = 4; g.beginPath(); g.arc(40, 66, 14, 0, TAU); g.moveTo(102, 66); g.arc(88, 66, 14, 0, TAU); g.moveTo(40, 66); g.lineTo(58, 44); g.lineTo(88, 66); g.lineTo(76, 46); g.lineTo(52, 46); g.stroke(); });
  sm('ub0', 2, (g, w, h) => { g.fillStyle = '#8fb8d8'; g.fillRect(0, 0, w, h); const C = ['#f4c542', '#e4572e', '#2a9d8f', '#ffffff']; for (let k = 0; k < 9; k++) { g.fillStyle = C[k % 4]; g.beginPath(); g.arc(20 + (k % 3) * 44, 22 + Math.floor(k / 3) * 36, 13, 0, TAU); g.fill(); } });
  sm('ub1', 3, (g, w, h) => { g.fillStyle = '#4c8a3f'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffe08a'; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(14 + k * 24, h); g.lineTo(26 + k * 24, 28 + (k % 2) * 20); g.lineTo(38 + k * 24, h); g.fill(); } g.fillStyle = '#ffffff'; g.beginPath(); g.arc(96, 26, 12, 0, TAU); g.fill(); });
  sm('mesh', 4, (g, w, h) => { g.fillStyle = '#245c3a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3f8f5c'; g.lineWidth = 1; for (let k = 0; k < w; k += 6) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, h); g.moveTo(0, k); g.lineTo(w, k); g.stroke(); } });
  sm('glow', 5, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, 60); gr.addColorStop(0, '#fff8e0'); gr.addColorStop(0.6, '#f2d890'); gr.addColorStop(1, '#6a6050'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  sm('work2', 6, (g, w, h) => { g.fillStyle = '#1f5fae'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(6, 6, w - 12, h - 12); T(g, '施工中', w / 2, 40, 34, '#1f5fae', w - 16); T(g, '請小心', w / 2, 80, 26, '#d6342b', w - 16, 700); });
  sm('hoard', 7, (g, w, h) => { g.fillStyle = '#eef0ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f5fae'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 10, w, 10); g.fillStyle = '#9fb3c8'; g.fillRect(60, 14, 4, h - 24); });
  // 紅綠燈的燈頭 96×32 × 3（紅、黃、綠亮）
  ['sigR', 'sigY', 'sigG'].forEach((key, i) => reg(key, i * 96, 880, 96, 32, (g, w, h) => { g.fillStyle = '#23262a'; g.fillRect(0, 0, w, h); const C = ['#ff2a1a', '#ffb000', '#19e05a'], D = ['#4a1510', '#4a3a08', '#0c4a22']; for (let k = 0; k < 3; k++) { g.fillStyle = k === i ? C[k] : D[k]; g.beginPath(); g.arc(16 + k * 32, 16, 11, 0, TAU); g.fill(); } }));
  const tex = new THREE.CanvasTexture(ac); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
  mats.sign2 = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3, roughness: 0.55, metalness: 0, flatShading: true, vertexColors: true }); // look.js：emissiveMap＝map ＝ 招牌 → 晚上加亮
  mats.sign3 = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0, flatShading: true, vertexColors: true }); // 不發亮的（鷹架的網、變電箱的彩繪）
  mats.inst = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05, flatShading: true });

  // ---- 小工具 ----
  const sq = (g, P, uv, c = WHITE) => { g.grow(4, 6); const k = g.v; for (let i = 0; i < 4; i++) g.vert(P[i][0], P[i][1], P[i][2], uv[i][0], uv[i][1], c[0], c[1], c[2], 0); g.tri(k, k + 1, k + 2); g.tri(k, k + 2, k + 3); };
  const plate2 = (x, y, z, ux, uz, w, h, key, two = true, c = WHITE, fx = 0, fz = 0, mat = 'sign2') => { // 直立的牌子（sign2＝會發亮的、sign3＝不發亮的）；(fx, fz)＝正面朝哪邊（只畫一面的時候）
    const uv = UV[key]; if (!uv) return; const g = bank(mat, x, z, TB); let a = [x - ux * w / 2, z - uz * w / 2], b = [x + ux * w / 2, z + uz * w / 2]; const [u0, v0, u1, v1] = uv;
    if (!two && -uz * fx + ux * fz < 0) [a, b] = [b, a]; // 照 a→b 畫的面朝 (−uz, ux)；要朝另一邊就反過來
    sq(g, [[a[0], y - h / 2, a[1]], [b[0], y - h / 2, b[1]], [b[0], y + h / 2, b[1]], [a[0], y + h / 2, a[1]]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], c);
    if (two) sq(g, [[b[0], y - h / 2, b[1]], [a[0], y - h / 2, a[1]], [a[0], y + h / 2, a[1]], [b[0], y + h / 2, b[1]]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], c);
  };
  const plateDown = (x, y, z, ux, uz, w, h, key) => { const uv = UV[key]; if (!uv) return; const g = bank('sign2', x, z, TB), vx = -uz, vz = ux, [u0, v0, u1, v1] = uv; // 朝下的牌子（路燈的燈）
    sq(g, [[x - ux * w / 2 - vx * h / 2, y, z - uz * w / 2 - vz * h / 2], [x - ux * w / 2 + vx * h / 2, y, z - uz * w / 2 + vz * h / 2], [x + ux * w / 2 + vx * h / 2, y, z + uz * w / 2 + vz * h / 2], [x + ux * w / 2 - vx * h / 2, y, z + uz * w / 2 - vz * h / 2]], [[u0, v0], [u0, v1], [u1, v1], [u1, v0]]); };
  const wallG = (x, z) => bank('wall', x, z, TB);
  const junctions = []; for (let i = 0; i < deg.length; i++) if (deg[i] >= 3) junctions.push([nx(i), nz(i), jR[i], i]);
  const nearJ = (x, z, extra) => { for (const [jx, jz, r] of junctions) { const dx = jx - x, dz = jz - z, rr = r + extra; if (dx * dx + dz * dz < rr * rr) return true; } return false; };
  const nearCross = (x, z, d) => { for (const c of N.cross) { const dx = c.p[0] - x, dz = c.p[1] - z; if (dx * dx + dz * dz < d * d) return true; } return false; };
  // 房子在不在附近（20 公尺一格）
  const BG = new Map(), BGS = 20, bkey = (i, j) => i * 73856093 + j, bInfo = [];
  N.bld.forEach((b, bi) => { if (b.back || b.lm) return; let cx = 0, cz = 0; for (const p of b.P) { cx += p[0]; cz += p[1]; } cx /= b.P.length; cz /= b.P.length; let rad = 0; for (const p of b.P) rad = Math.max(rad, Math.hypot(p[0] - cx, p[1] - cz)); const o = { P: b.P, cx, cz, rad, bi }; bInfo.push(o);
    for (let i = Math.floor((cx - rad) / BGS); i <= Math.floor((cx + rad) / BGS); i++) for (let j = Math.floor((cz - rad) / BGS); j <= Math.floor((cz + rad) / BGS); j++) { const k = bkey(i, j); let L = BG.get(k); if (!L) BG.set(k, (L = [])); L.push(o); } });
  const bldNear = (x, z, r) => { for (let i = Math.floor((x - r) / BGS); i <= Math.floor((x + r) / BGS); i++) for (let j = Math.floor((z - r) / BGS); j <= Math.floor((z + r) / BGS); j++) { const L = BG.get(bkey(i, j)); if (!L) continue; for (const o of L) { if (Math.hypot(o.cx - x, o.cz - z) > o.rad + r) continue; if (inPoly(o.P, x, z)) return true; const P = o.P; for (let q = 0; q < P.length; q++) { const a = P[q], b = P[(q + 1) % P.length]; if (segD(x, z, a[0], a[1], b[0], b[1]) < r) return true; } } } return false; };
  const inArea = (x, z) => { for (const a of N.areas) if (a.t !== 'school' && inPoly(a.P, x, z)) return true; return false; };
  const otherRoad = (x, z, r, m = 0.5) => { const q = ctx.roadAt(x, z); return q && q.r !== r && q.d < q.r.w / 2 + q.r.sw + m; }; // 別條路（巷子口）上；m＝再多留多少
  const entP = N.entP;

  // ---- InstancedMesh 的東西（機車、停著的車、大王椰子）：250 公尺一格 ----
  const TT = 250, AX = ctx.AX, AZ = ctx.AZ;
  const lbox = (g, x0, y0, z0, x1, y1, z1, c) => { // 本地座標的盒子（六面，側面暗一點）
    const F = [[[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]];
    const K = [0.9, 0.9, 0.82, 0.82, 1.0, 0.6];
    F.forEach((P, i) => { const cc = shade(c, K[i]); g.grow(4, 6); const k = g.v; for (const p of P) g.vert(p[0], p[1], p[2], 0, 0, cc[0], cc[1], cc[2], 0); g.tri(k, k + 1, k + 2); g.tri(k, k + 2, k + 3); });
  };
  const lcyl = (g, cx, cy, cz, r, hw, c, seg = 8) => { // 輪子：軸沿著 z
    const P = []; for (let i = 0; i < seg; i++) { const a = (i / seg) * TAU; P.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    for (let i = 0; i < seg; i++) { const a = P[i], b = P[(i + 1) % seg], cc = shade(c, 0.75 + 0.25 * ((i % 2) ? 1 : 0.6)); g.grow(4, 6); const k = g.v; g.vert(a[0], a[1], cz - hw, 0, 0, cc[0], cc[1], cc[2], 0); g.vert(b[0], b[1], cz - hw, 0, 0, cc[0], cc[1], cc[2], 0); g.vert(b[0], b[1], cz + hw, 0, 0, cc[0], cc[1], cc[2], 0); g.vert(a[0], a[1], cz + hw, 0, 0, cc[0], cc[1], cc[2], 0); g.tri(k, k + 2, k + 1); g.tri(k, k + 3, k + 2); }
    for (const s of [-1, 1]) { g.grow(seg + 1, seg * 3); const k = g.vert(cx, cy, cz + s * hw, 0, 0, c[0], c[1], c[2], 0); for (const p of P) g.vert(p[0], p[1], cz + s * hw, 0, 0, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 0); for (let i = 0; i < seg; i++) { const a = k + 1 + i, b = k + 1 + ((i + 1) % seg); if (s > 0) g.tri(k, a, b); else g.tri(k, b, a); } }
  };
  const DK = [38, 38, 42], SOFT = [250, 250, 250];
  const scooterGeo = (() => { const g = new Geo(false); lbox(g, -0.15, 0.28, -0.18, 0.35, 0.36, 0.18, DK); lbox(g, 0.35, 0.3, -0.2, 0.62, 0.95, 0.2, SOFT); lbox(g, 0.48, 0.95, -0.33, 0.58, 1.02, 0.33, DK); lbox(g, 0.58, 0.72, -0.1, 0.68, 0.86, 0.1, [245, 240, 220]);
    lbox(g, -0.62, 0.62, -0.17, -0.02, 0.74, 0.17, [46, 46, 50]); lbox(g, -0.74, 0.36, -0.19, -0.02, 0.62, 0.19, SOFT); lbox(g, -0.82, 0.5, -0.1, -0.74, 0.62, 0.1, [230, 40, 40]); lcyl(g, -0.56, 0.2, 0, 0.2, 0.06, DK); lcyl(g, 0.62, 0.2, 0, 0.2, 0.06, DK); return g.geometry(); })();
  const carGeo = (() => { const g = new Geo(false), GL = [40, 44, 50]; lbox(g, -2.2, 0.3, -0.88, 2.2, 0.78, 0.88, SOFT); lbox(g, 2.2, 0.42, -0.7, 2.3, 0.6, -0.4, [250, 240, 200]); lbox(g, 2.2, 0.42, 0.4, 2.3, 0.6, 0.7, [250, 240, 200]); lbox(g, -2.3, 0.45, -0.75, -2.2, 0.62, -0.45, [220, 30, 30]); lbox(g, -2.3, 0.45, 0.45, -2.2, 0.62, 0.75, [220, 30, 30]);
    const pr = [[0.95, 0.78], [0.45, 1.42], [-1.25, 1.42], [-1.8, 0.78]], zz = 0.82; // 車艙：擋風玻璃、車頂、後窗、兩邊
    const q = (P, c) => { g.grow(4, 6); const k = g.v; for (const p of P) g.vert(p[0], p[1], p[2], 0, 0, c[0], c[1], c[2], 0); g.tri(k, k + 1, k + 2); g.tri(k, k + 2, k + 3); };
    q([[pr[0][0], pr[0][1], zz], [pr[0][0], pr[0][1], -zz], [pr[1][0], pr[1][1], -zz], [pr[1][0], pr[1][1], zz]], GL); q([[pr[1][0], pr[1][1], zz], [pr[1][0], pr[1][1], -zz], [pr[2][0], pr[2][1], -zz], [pr[2][0], pr[2][1], zz]], SOFT); q([[pr[2][0], pr[2][1], zz], [pr[2][0], pr[2][1], -zz], [pr[3][0], pr[3][1], -zz], [pr[3][0], pr[3][1], zz]], GL);
    q([[pr[0][0], pr[0][1], zz], [pr[1][0], pr[1][1], zz], [pr[2][0], pr[2][1], zz], [pr[3][0], pr[3][1], zz]], GL); q([[pr[3][0], pr[3][1], -zz], [pr[2][0], pr[2][1], -zz], [pr[1][0], pr[1][1], -zz], [pr[0][0], pr[0][1], -zz]], GL);
    for (const x of [-1.4, 1.4]) for (const z of [-0.8, 0.8]) lcyl(g, x, 0.33, z, 0.33, 0.1, DK); return g.geometry(); })();
  const palmGeo = (() => { const g = new Geo(false), TR = [140, 128, 110], CR = [96, 140, 70], L1 = [70, 128, 52], L2 = [52, 104, 40], seg = 8, HT = 9.0;
    const ring = (y, r) => { const P = []; for (let i = 0; i < seg; i++) { const a = (i / seg) * TAU; P.push([Math.cos(a) * r, y, Math.sin(a) * r]); } return P; };
    const band = (A, B, c) => { for (let i = 0; i < seg; i++) { const a = A[i], b = A[(i + 1) % seg], c2 = B[(i + 1) % seg], d = B[i], cc = shade(c, 0.8 + 0.2 * (i % 2)); g.grow(4, 6); const k = g.v; for (const p of [a, b, c2, d]) g.vert(p[0], p[1], p[2], 0, 0, cc[0], cc[1], cc[2], 0); g.tri(k, k + 2, k + 1); g.tri(k, k + 3, k + 2); } };
    band(ring(0, 0.26), ring(HT * 0.5, 0.2), TR); band(ring(HT * 0.5, 0.2), ring(HT, 0.17), TR); band(ring(HT, 0.17), ring(HT + 1.1, 0.14), CR);
    for (let f = 0; f < 9; f++) { const a = (f / 9) * TAU + hh(f, 5) * 0.4, ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux, n = 3, drop = 1.2 + hh(f, 6) * 0.8; let prev = null;
      for (let s = 0; s <= n; s++) { const t = s / n, r = t * 3.3, y = HT + 1.0 + 1.1 * t - drop * t * t, w = 0.1 + 0.5 * (1 - t) * (0.4 + 0.6 * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2)); const cur = [[ux * r - vx * w, y, uz * r - vz * w], [ux * r + vx * w, y, uz * r + vz * w]];
        if (prev) { const c = t < 0.6 ? L1 : L2; g.grow(8, 12); let k = g.v; for (const p of [prev[0], prev[1], cur[1], cur[0]]) g.vert(p[0], p[1], p[2], 0, 0, c[0], c[1], c[2], 0); g.tri(k, k + 1, k + 2); g.tri(k, k + 2, k + 3); k = g.v; for (const p of [prev[1], prev[0], cur[0], cur[1]]) g.vert(p[0], p[1], p[2], 0, 0, c[0] * 0.85, c[1] * 0.85, c[2] * 0.85, 0); g.tri(k, k + 1, k + 2); g.tri(k, k + 2, k + 3); }
        prev = cur; } }
    return g.geometry(); })();
  const tiles = { scooter: new Map(), palm: new Map() }, tcols = []; // 第 74 批：停著的車不再是 InstancedMesh（spots.parked）
  const tkey = (x, z) => Math.floor((x - AX) / TT) + ',' + Math.floor((z - AZ) / TT);
  const addInst = (kind, x, z, rot, s, c, col) => { const key = tkey(x, z); let L = tiles[kind].get(key); if (!L) tiles[kind].set(key, (L = [])); L.push([x, z, rot, s, c]); if (col) { col.tk = kind + '-' + key; col.ti = L.length - 1; colliders.push(col); tcols.push(col); } }; // tk 要跟 InstancedMesh 的名字（'nh-' 後面）一樣，下面才接得上 im（neihu-test 7s 會查）
  const SCOL = ['#e8e8e8', '#2b2b2b', '#c62f25', '#1f5fae', '#f3c623', '#6a6a6a', '#2a8a4a', '#ffffff', '#8a3a8a', '#d9d9d9', '#3b3b3b', '#f28c28'].map(col255);
  const CCOL = ['#e9e9e9', '#2a2a2a', '#8c8c8c', '#c62f25', '#1f3f7a', '#d9d9d9', '#ffffff', '#5a6a7a', '#f3c623', '#3a4a3a', '#ffffff', '#b0b0b0'].map(col255);

  // ---- 沿著路走：fn(x, z, ux, uz, rx, rz, s, L, poly)（rx rz＝開過去的右手邊）----
  const along = (road, step, s0, fn) => { const P = road.pts; let acc = 0, next = s0; const L = P.reduce((t, p, i) => (i ? t + Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]) : 0), 0);
    for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.01) continue; const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
      while (next <= acc + l) { const t = (next - acc) / l; fn(a[0] + ux * l * t, a[1] + uz * l * t, ux, uz, -uz, ux, next, L); next += step; } acc += l; } return L; };
  const ok = (x, z, jx = 2.5) => inBox(x, z, 2) && !nearJ(x, z, jx) && Math.hypot(x - entP[0], z - entP[1]) > 45;

  // ==== 1 停著的機車 ====
  for (const rd of S.roads) {
    const w = rd.r.w, sw = rd.r.sw, jn = rd.key === 'jn', off = jn ? (w >= 9 ? w / 2 - 0.55 : w / 2 + 0.1) : w / 2 + 0.75, stepS = 0.85; // 機車 1.4 公尺長、車頭朝房子：窄的那段（7 公尺）停到路緣上，不然會伸進車道（車道在 w/4）
    for (const side of [-1, 1]) { let run = 0, gap = 0, n = 0;
      along(rd, stepS, 1, (x, z, ux, uz, rx, rz, s) => { n++;
        if (gap > 0) { gap--; return; }
        if (run <= 0) { const r = hh(rd.ri * 7 + side + 3, n); if (r < (jn ? 0.5 : 0.12)) { run = jn ? 5 + Math.floor(hh(n, 2) * 10) : 2 + Math.floor(hh(n, 2) * 4); } else { gap = Math.floor((jn ? 2 : 8) + hh(n, 3) * (jn ? 6 : 22)); return; } }
        const px = x + rx * side * off, pz = z + rz * side * off; run--;
        if (!ok(px, pz, 3) || nearCross(px, pz, 2.5) || otherRoad(px, pz, rd.r, jn ? 1.2 : 0.5)) return; // 巷子口不停（會擋到巷子出來的車道）
        const rot = rotOf(rx * side, rz * side) + (hh(n, 4) - 0.5) * 0.3; // 車頭朝房子那邊
        addInst('scooter', px, pz, rot, 0.95 + hh(n, 5) * 0.15, SCOL[Math.floor(hh(n, 6) * SCOL.length)], { t: 'box', x: px, z: pz, hx: 0.85, hz: 0.35, rot, h: 1.1 }); info.scooters++; });
    }
  }
  // ==== 2 停車格＋停著的車（環山路）====
  for (const rd of S.roads) {
    if (rd.key !== 'hs') continue; const w = rd.r.w, off = w / 2 - 1.3;
    for (const side of [-1, 1]) { let run = 0, gap = 0, n = 0;
      along(rd, 6.0, 20, (x, z, ux, uz, rx, rz) => { n++;
        if (gap > 0) { gap--; return; }
        if (run <= 0) { if (hh(rd.ri * 9 + side, n) < 0.6) run = 4 + Math.floor(hh(n, 12) * 5); else { gap = 2 + Math.floor(hh(n, 13) * 5); return; } }
        const px = x + rx * side * off, pz = z + rz * side * off; run--;
        if (!ok(px, pz, 6) || nearCross(px, pz, 5) || otherRoad(px, pz, rd.r, 2.5) || otherRoad(px + ux * 3, pz + uz * 3, rd.r, 2.5) || otherRoad(px - ux * 3, pz - uz * 3, rd.r, 2.5)) return; // 巷子口不畫停車格
        const g = bank('paint', px, pz, TG), hx = 2.8, hz = 1.15, c = [236, 236, 232]; // 白線框
        for (const [lx0, lz0, lx1, lz1] of [[-hx, -hz, hx, -hz], [-hx, hz, hx, hz], [-hx, -hz, -hx, hz], [hx, -hz, hx, hz]]) { g.grow(4, 6); const k = g.v, wdt = 0.07;
          const ax = px + ux * lx0 + rx * lz0, az = pz + uz * lx0 + rz * lz0, bx = px + ux * lx1 + rx * lz1, bz = pz + uz * lx1 + rz * lz1, nxx = -(bz - az), nzz = bx - ax, nl = Math.hypot(nxx, nzz) || 1;
          for (const [qx, qz] of [[ax - nxx / nl * wdt, az - nzz / nl * wdt], [bx - nxx / nl * wdt, bz - nzz / nl * wdt], [bx + nxx / nl * wdt, bz + nzz / nl * wdt], [ax + nxx / nl * wdt, az + nzz / nl * wdt]]) g.vert(qx, 0.054, qz, 0, 0, c[0], c[1], c[2], 0); g.tri(k, k + 2, k + 1); g.tri(k, k + 3, k + 2); }
        info.bays++;
        if (hh(n, 14) < 0.62) { const rot = rotOf(ux, uz) + (hh(n, 15) < 0.5 ? 0 : Math.PI); spots.parked.push([+px.toFixed(2), +pz.toFixed(2), +rot.toFixed(4), n * 2 + (side > 0 ? 1 : 0) + rd.ri * 1000]); info.cars++; } }); // 第 74 批（Nick「路停的車用車店的隨機放 豪車少一點」）：以前是 InstancedMesh 的方塊車；現在只記位置，開到附近 crush.js／town.src.js 做成車店的車
    }
  }
  // ==== 3 大王椰子（內湖路一段兩邊，取代一般的行道樹）====
  for (const rd of S.roads) {
    if (rd.key !== 'nh') continue; const w = rd.r.w, off = w / 2 + 1.0; let n = 0;
    for (const side of [-1, 1]) along(rd, 9, 4.5 + (side > 0 ? 0 : 4.5), (x, z, ux, uz, rx, rz) => { n++; const px = x + rx * side * off, pz = z + rz * side * off; if (!ok(px, pz, 4) || nearCross(px, pz, 3) || otherRoad(px, pz, rd.r)) return;
      addInst('palm', px, pz, hh(n, 20) * TAU, 0.85 + hh(n, 21) * 0.3, [255, 255, 255], { t: 'circle', x: px, z: pz, r: 0.3, h: 9 }); info.palms++; });
  }
  // ==== 4 路燈（三條路；look.js 晚上最近的幾支真的有光：燈頭在 pole + f·2.2、高 7.6）====
  const poles = [];
  for (const rd of S.roads) {
    const w = rd.r.w, jn = rd.key === 'jn', off = jn ? w / 2 + 0.25 : w / 2 + 0.5; let n = 0;
    along(rd, 34, 17, (x, z, ux, uz, rx, rz) => { n++; const side = n % 2 ? 1 : -1, px = x + rx * side * off, pz = z + rz * side * off; if (!ok(px, pz, 1.5) || otherRoad(px, pz, rd.r)) return;
      const fx = -rx * side, fz = -rz * side, g = wallG(px, pz), MET = [150, 154, 158];
      boxG(g, px, pz, 0.09, 0.09, 0, 0, 7.9, MET, 20, false); boxG(g, px + fx * 1.1, pz + fz * 1.1, 1.15, 0.06, rotOf(fx, fz), 7.55, 7.68, MET, 20, false);
      boxG(g, px + fx * 2.2, pz + fz * 2.2, 0.34, 0.14, rotOf(fx, fz), 7.5, 7.68, [232, 232, 226], 20, true); plateDown(px + fx * 2.2, 7.49, pz + fz * 2.2, fx, fz, 0.64, 0.26, 'glow');
      colliders.push({ t: 'circle', x: px, z: pz, r: 0.14, h: 7.9 }); poles.push({ x: px, z: pz, fx, fz, lamp: true }); info.lamps++; });
  }
  // ==== 5 公車亭（內湖路、環山路；每邊約 230 公尺一個）====
  for (const rd of S.roads) {
    if (rd.key === 'jn') continue; const w = rd.r.w, sw = rd.r.sw, off = w / 2 + Math.max(1.6, sw * 0.55); let n = 0;
    const cand = []; along(rd, 10, 40, (x, z, ux, uz, rx, rz) => cand.push([x, z, ux, uz, rx, rz])); // 10 公尺一個候選點：每 230 公尺挑一個放得下的（路口、別條路、房子太近都不行）
    let lastS = -1e9; cand.forEach(([x, z, ux, uz, rx, rz], ci) => { const s = 40 + ci * 10; if (s - lastS < 230) return; n++;
      let side = (n + rd.ri) % 2 ? 1 : -1, px = x + rx * side * off, pz = z + rz * side * off;
      if (!ok(px, pz, 8) || otherRoad(px, pz, rd.r) || bldNear(px, pz, 2.2)) { side = -side; px = x + rx * side * off; pz = z + rz * side * off; if (!ok(px, pz, 8) || otherRoad(px, pz, rd.r) || bldNear(px, pz, 2.2)) { n--; return; } }
      lastS = s;
      const g = wallG(px, pz), rot = rotOf(ux, uz), bx = rx * side, bz = rz * side, MET = [120, 124, 128], GLS = [196, 210, 220];
      for (const [dx, dz] of [[-1.9, 0.6], [1.9, 0.6], [-1.9, -0.55], [1.9, -0.55]]) boxG(g, px + ux * dx + bx * dz, pz + uz * dx + bz * dz, 0.06, 0.06, rot, 0, 2.55, MET, 20, false);
      boxG(g, px, pz, 2.15, 0.85, rot, 2.5, 2.62, [214, 216, 214], 20, true); // 屋頂
      boxG(g, px + bx * 0.62, pz + bz * 0.62, 1.95, 0.03, rot, 0.35, 2.4, GLS, 20, false); // 後面的玻璃
      boxG(g, px + bx * 0.25, pz + bz * 0.25, 0.9, 0.2, rot, 0.4, 0.48, [90, 70, 50], 20, true); // 長椅
      for (const dx of [-0.7, 0.7]) boxG(g, px + ux * dx + bx * 0.25, pz + uz * dx + bz * 0.25, 0.04, 0.17, rot, 0, 0.4, MET, 20, false);
      const sx = px - ux * 2.6, sz = pz - uz * 2.6; boxG(g, sx, sz, 0.05, 0.05, 0, 0, 2.6, MET, 20, false); plate2(sx, 2.15, sz, ux, uz, 0.6, 0.55, 'bus', true); // 站牌
      colliders.push({ t: 'box', x: px + bx * 0.55, z: pz + bz * 0.55, hx: 2.0, hz: 0.12, rot, h: 2.6, noCrush: true }, { t: 'box', x: px + bx * 0.25, z: pz + bz * 0.25, hx: 0.9, hz: 0.2, rot, h: 0.5 }, { t: 'circle', x: sx, z: sz, r: 0.1, h: 2.6 });
      for (const [dx, dz] of [[-1.9, -0.55], [1.9, -0.55]]) colliders.push({ t: 'circle', x: px + ux * dx + bx * dz, z: pz + uz * dx + bz * dz, r: 0.1, h: 2.55, noCrush: true });
      spots.shelters.push([px, pz]); info.shelters++; });
  }
  // ==== 6 紅綠燈（三條路跟別條有名字的路的路口；每個方向路口前面右邊一支，橫桿伸到車道上）====
  { const roadsAt = new Map(); N.roads.forEach((r) => { if (r.nm < 0) return; for (const ni of r.n) { let a = roadsAt.get(ni); if (!a) roadsAt.set(ni, (a = [])); if (!a.includes(r)) a.push(r); } });
    const done = new Set();
    for (const rd of S.roads) { const r = rd.r, P = rd.pts;
      r.n.forEach((ni, i) => { if (deg[ni] < 3 || jR[ni] < 6) return; const others = (roadsAt.get(ni) || []).filter((o) => o !== r && o.nm !== r.nm && o.cls <= 4); if (!others.length) return;
        const jx = nx(ni), jz = nz(ni), green = hh(ni, 40) < 0.5; // 這條路綠燈（一半的路口）
        for (const d of [1, -1]) { if (r.ow === 1 && d < 0) continue; if (r.ow === -1 && d > 0) continue; const k = i - d; if (k < 0 || k >= P.length) continue; // 從 k 那頭開過來
          const ax = P[k][0] - jx, az = P[k][1] - jz, al = Math.hypot(ax, az) || 1, ux = -ax / al, uz = -az / al, rx = -uz, rz = ux; // 開過來的方向、右邊
          const back = jR[ni] + 1.2, px = jx - ux * back + rx * (r.w / 2 + 0.55), pz = jz - uz * back + rz * (r.w / 2 + 0.55), key = Math.round(px) + ',' + Math.round(pz); if (done.has(key) || !inBox(px, pz, 2)) continue; done.add(key);
          const g = wallG(px, pz), MET = [112, 116, 120], arm = Math.min(6.5, r.w / 2 + 0.3), cx = px - rx * arm, cz = pz - rz * arm;
          boxG(g, px, pz, 0.12, 0.12, 0, 0, 6.2, MET, 20, false); boxG(g, (px + cx) / 2, (pz + cz) / 2, arm / 2, 0.07, rotOf(rx, rz), 5.9, 6.05, MET, 20, false);
          boxG(g, cx + rx * 0.6, cz + rz * 0.6, 0.55, 0.17, rotOf(rx, rz), 5.15, 5.5, [36, 38, 42], 20, true); plate2(cx + rx * 0.6 - ux * 0.19, 5.33, cz + rz * 0.6 - uz * 0.19, rx, rz, 1.05, 0.34, green ? 'sigG' : 'sigR', false, WHITE, -ux, -uz);
          colliders.push({ t: 'circle', x: px, z: pz, r: 0.18, h: 6.2 }); spots.signals.push([px, pz, green]); info.signals++; } }); }
  }
  // ==== 7 變電箱（彩繪）：內湖路、環山路的人行道靠房子那邊 ====
  for (const rd of S.roads) {
    if (rd.key === 'jn') continue; const w = rd.r.w, sw = rd.r.sw, off = w / 2 + sw - 0.55; let n = 0;
    along(rd, 150, 95 + (rd.ri % 4) * 20, (x, z, ux, uz, rx, rz) => { n++; const side = (n + rd.ri) % 2 ? -1 : 1, px = x + rx * side * off, pz = z + rz * side * off; if (!ok(px, pz, 4) || otherRoad(px, pz, rd.r) || bldNear(px, pz, 0.9)) return;
      const rot = rotOf(ux, uz), g = wallG(px, pz); boxG(g, px, pz, 0.62, 0.3, rot, 0, 1.5, [168, 172, 170], 20, true); plate2(px - rx * side * 0.31, 0.8, pz - rz * side * 0.31, ux, uz, 1.2, 1.3, n % 2 ? 'ub0' : 'ub1', false, WHITE, -rx * side, -rz * side, 'sign3');
      colliders.push({ t: 'box', x: px, z: pz, hx: 0.62, hz: 0.3, rot, h: 1.5 }); info.uboxes++; });
  }
  // ==== 8 圍牆＋樹籬（內湖路）、擋土牆＋很多樹（環山路）：路邊沒有房子的那幾段 ====
  for (const rd of S.roads) {
    if (rd.key === 'jn') continue; const hs = rd.key === 'hs', w = rd.r.w, sw = rd.r.sw, off = w / 2 + sw + 0.15, STEP = 4;
    for (const side of [-1, 1]) { let run = []; const flush = () => { if (run.length >= 3) wallRun(run, side, hs, rd); run = []; };
      along(rd, STEP, 2, (x, z, ux, uz, rx, rz) => { const px = x + rx * side * off, pz = z + rz * side * off, qx = x + rx * side * (off + 3), qz = z + rz * side * (off + 3);
        const good = ok(px, pz, 3) && !otherRoad(px, pz, rd.r) && !otherRoad(qx, qz, rd.r) && !bldNear(qx, qz, 6.5) && !inArea(qx, qz) && !nearCross(px, pz, 4);
        if (good) run.push([px, pz, ux, uz, rx * side, rz * side]); else flush(); });
      flush(); }
  }
  function wallRun(run, side, hs, rd) {
    const n = run.length, L = (n - 1) * 4; for (let i = 1; i < n; i++) { const a = run[i - 1], b = run[i], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, l = Math.hypot(b[0] - a[0], b[1] - a[1]), rot = rotOf(b[0] - a[0], b[1] - a[1]), g = wallG(mx, mz), ox = a[4], oz = a[5];
      if (hs) { // 擋土牆：3.6 公尺、三層深淺（混凝土的水平線）、上面一條壓頂
        const C = [[168, 164, 152], [176, 172, 160], [160, 156, 146]]; for (let k = 0; k < 3; k++) boxG(g, mx + ox * 0.5, mz + oz * 0.5, l / 2 + 0.02, 0.5, rot, k * 1.2, (k + 1) * 1.2, C[k], 20, k === 2); boxG(g, mx + ox * 0.5, mz + oz * 0.5, l / 2 + 0.05, 0.56, rot, 3.6, 3.8, [150, 146, 138], 20, true);
        info.rwallM += l; } else { // 圍牆 1.7 公尺＋前面的樹籬
        boxG(g, mx + ox * 0.4, mz + oz * 0.4, l / 2 + 0.02, 0.14, rot, 0, 1.7, [206, 202, 192], 20, true); boxG(g, mx + ox * 0.4, mz + oz * 0.4, l / 2 + 0.02, 0.16, rot, 0, 0.3, [150, 110, 90], 20, false);
        boxG(g, mx - ox * 0.15, mz - oz * 0.15, l / 2, 0.3, rot, 0, 0.95, [58, 96, 52], 20, true); info.wallM += l; }
      colliders.push({ t: 'box', x: mx + ox * 0.45, z: mz + oz * 0.45, hx: l / 2 + 0.05, hz: hs ? 0.55 : 0.5, rot, h: hs ? 3.8 : 1.7, noCrush: true });
    }
    for (let i = 0; i < n; i += hs ? 1 : 2) { const a = run[i]; if (hs) { for (const [d, s] of [[3.0, 1.3], [6.5, 1.6]]) { addTree(a[0] + a[4] * d + a[2] * (hh(i, 30) - 0.5) * 2, 0, a[1] + a[5] * d + a[3] * (hh(i, 30) - 0.5) * 2, s + hh(i, 31) * 0.4); info.hedgeTrees++; } } else { addTree(a[0] + a[4] * 2.6, 0, a[1] + a[5] * 2.6, 1.0 + hh(i, 32) * 0.3); info.hedgeTrees++; } }
    void L; void side; void rd;
  }
  // ==== 9 工地（環山路）：圍籬、6 層的水泥骨架、鷹架＋綠色的網、塔吊 ====
  if (S.site) {
    const [cx, cz, hx, hz, rot] = S.site.rect, ux = Math.cos(rot), uz = -Math.sin(rot), vx = -uz, vz = ux, g = wallG(cx, cz), WH = [236, 236, 232], BL = [40, 90, 160], CON = [196, 192, 184], YEL = [232, 180, 40];
    const corner = (a, b) => [cx + ux * a + vx * b, cz + uz * a + vz * b];
    // 圍籬 2.4 公尺（前面＝第 0 邊，在 −v 那邊）
    const edges = [[corner(-hx, -hz), corner(hx, -hz)], [corner(hx, -hz), corner(hx, hz)], [corner(hx, hz), corner(-hx, hz)], [corner(-hx, hz), corner(-hx, -hz)]];
    edges.forEach(([a, b], ei) => { const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, l = Math.hypot(b[0] - a[0], b[1] - a[1]), r2 = rotOf(b[0] - a[0], b[1] - a[1]);
      boxG(g, mx, mz, l / 2, 0.06, r2, 0, 2.4, WH, 20, true); boxG(g, mx, mz, l / 2, 0.08, r2, 2.1, 2.4, BL, 20, true); boxG(g, mx, mz, l / 2, 0.08, r2, 0, 0.25, BL, 20, false);
      const m = Math.max(1, Math.round(l / 6)); for (let j = 0; j < m; j++) { const t = (j + 0.5) / m; boxG(g, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0.06, 0.06, r2, 0, 2.45, [120, 124, 128], 20, false); }
      if (ei === 0 && workUV) { const nxx = (b[1] - a[1]) / l, nzz = -(b[0] - a[0]) / l; for (let j = 0; j < Math.min(3, m); j++) { const t = (j + 0.5) / Math.min(3, m); ctx.plate(a[0] + (b[0] - a[0]) * t + nxx * 0.09, 1.2, a[1] + (b[1] - a[1]) * t + nzz * 0.09, (b[0] - a[0]) / l, (b[1] - a[1]) / l, 3.0, 0.75, workUV, true); } } // (nxx, nzz)＝往外
      if (ei === 0) { const t = 0.5, nxx = (b[1] - a[1]) / l, nzz = -(b[0] - a[0]) / l; plate2(a[0] + (b[0] - a[0]) * t + nxx * 0.1, 1.9, a[1] + (b[1] - a[1]) * t + nzz * 0.1, (b[0] - a[0]) / l, (b[1] - a[1]) / l, 1.1, 0.95, 'work2', false, WHITE, nxx, nzz); }
      colliders.push({ t: 'box', x: mx, z: mz, hx: l / 2, hz: 0.15, rot: r2, h: 2.4, noCrush: true }); });
    // 水泥骨架：6 層樓板（內縮 1.5 公尺）＋柱子
    const ix = hx - 1.5, iz = hz - 1.5, FL = 6;
    for (let k = 1; k <= FL; k++) boxG(g, cx, cz, ix, iz, rot, k * 3.3 - 0.25, k * 3.3, CON, 20, true);
    const ncx = Math.max(2, Math.round(ix / 3)), ncz = Math.max(2, Math.round(iz / 3));
    for (let i = 0; i <= ncx; i++) for (let j = 0; j <= ncz; j++) { const a = -ix + 0.25 + (i / ncx) * (ix * 2 - 0.5), b = -iz + 0.25 + (j / ncz) * (iz * 2 - 0.5), [px, pz] = corner(a, b); boxG(g, px, pz, 0.25, 0.25, rot, 0, FL * 3.3 + 2.8, shade(CON, 0.92), 20, true); }
    // 鷹架（前面、右邊那兩面）：桿子、橫桿、綠色的網
    for (const [a, b] of [edges[0], edges[1]]) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]), ex = (b[0] - a[0]) / l, ez = (b[1] - a[1]) / l, nxx = ez, nzz = -ex, r2 = rotOf(ex, ez), H2 = FL * 3.3 + 1.5; // nxx nzz＝往裡面
      const ia = [a[0] + nxx * 1.2 + ex * 1.5, a[1] + nzz * 1.2 + ez * 1.5], ib = [b[0] + nxx * 1.2 - ex * 1.5, b[1] + nzz * 1.2 - ez * 1.5], l2 = l - 3, m = Math.max(2, Math.round(l2 / 1.8));
      for (let j = 0; j <= m; j++) { const t = j / m; for (const d of [0, 0.9]) boxG(g, ia[0] + (ib[0] - ia[0]) * t + nxx * d, ia[1] + (ib[1] - ia[1]) * t + nzz * d, 0.04, 0.04, r2, 0, H2, [150, 150, 146], 20, false); }
      for (let y = 1.9; y < H2; y += 1.9) for (const d of [0, 0.9]) boxG(g, (ia[0] + ib[0]) / 2 + nxx * d, (ia[1] + ib[1]) / 2 + nzz * d, l2 / 2, 0.03, r2, y, y + 0.06, [150, 150, 146], 20, false);
      const uv = UV.mesh, gs = bank('sign3', cx, cz, TB), A = [ia[0] - nxx * 0.08, ia[1] - nzz * 0.08], B = [ib[0] - nxx * 0.08, ib[1] - nzz * 0.08]; // 網：一整片（兩面）
      sq(gs, [[A[0], 0.5, A[1]], [B[0], 0.5, B[1]], [B[0], H2 - 0.3, B[1]], [A[0], H2 - 0.3, A[1]]], [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]], [190, 200, 190]);
      sq(gs, [[B[0], 0.5, B[1]], [A[0], 0.5, A[1]], [A[0], H2 - 0.3, A[1]], [B[0], H2 - 0.3, B[1]]], [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]], [150, 160, 150]);
    }
    colliders.push({ t: 'box', x: cx, z: cz, hx: ix + 1.3, hz: iz + 1.3, rot, h: FL * 3.3, noCrush: true });
    // 塔吊：黃色的塔身、旋轉台、吊臂、平衡臂＋配重、吊鉤
    { const [mx, mz] = corner(-ix * 0.3, iz * 0.3), MH = FL * 3.3 + 14, jl = 22, cl = 7, jrot = rot + 0.7, jx = Math.cos(jrot), jz = -Math.sin(jrot);
      boxG(g, mx, mz, 0.7, 0.7, rot, 0, MH, YEL, 20, false); for (let y = 0; y < MH; y += 2.2) boxG(g, mx, mz, 0.78, 0.78, rot, y, y + 0.12, shade(YEL, 0.8), 20, false);
      boxG(g, mx, mz, 1.1, 1.1, jrot, MH, MH + 1.2, [120, 124, 128], 20, true); boxG(g, mx + jx * 1.4, mz + jz * 1.4, 0.8, 0.7, jrot, MH + 1.2, MH + 3.0, [232, 232, 226], 20, true); // 旋轉台、駕駛室
      boxG(g, mx + jx * jl / 2, mz + jz * jl / 2, jl / 2, 0.45, jrot, MH + 1.0, MH + 1.9, YEL, 20, true); boxG(g, mx - jx * cl / 2, mz - jz * cl / 2, cl / 2, 0.45, jrot, MH + 1.0, MH + 1.9, YEL, 20, true);
      boxG(g, mx - jx * (cl - 1.0), mz - jz * (cl - 1.0), 1.0, 0.7, jrot, MH - 0.2, MH + 1.0, [120, 116, 110], 20, true); boxG(g, mx, mz, 0.3, 0.3, jrot, MH + 1.9, MH + 5.5, YEL, 20, true); // 配重、塔頂
      const hk = 0.62; boxG(g, mx + jx * jl * hk, mz + jz * jl * hk, 0.02, 0.02, jrot, MH - 10, MH + 1.0, [60, 60, 60], 20, false); boxG(g, mx + jx * jl * hk, mz + jz * jl * hk, 0.25, 0.25, jrot, MH - 10.6, MH - 10, [60, 60, 60], 20, true);
      colliders.push({ t: 'circle', x: mx, z: mz, r: 0.9, h: MH, noCrush: true }); }
    spots.site = [cx, cz]; info.site = 1;
  }
  // ==== 10 綠色路牌（環山路跟有名字的大路的路口）＋ 11 優拜客（共享腳踏車）站 ====
  const roadsAtN = new Map(); N.roads.forEach((r) => { if (r.nm < 0) return; for (const ni of r.n) { let a = roadsAtN.get(ni); if (!a) roadsAtN.set(ni, (a = [])); if (!a.includes(r)) a.push(r); } });
  const names = ctx.names;
  const bikeStation = (px, pz, ux, uz, bx, bz) => { // 沿著 (ux, uz) 一排 10 個停車柱、7 台黃白的腳踏車；bx bz＝朝路的方向（kiosk 在那頭）
    const g = wallG(px, pz), rot = rotOf(ux, uz), YL = [250, 205, 20], WT = [245, 245, 240];
    const kx = px - ux * 4.6, kz = pz - uz * 4.6; boxG(g, kx, kz, 0.28, 0.2, rot, 0, 1.9, WT, 20, true); plate2(kx, 1.45, kz, ux, uz, 0.55, 0.5, 'ubike', true); colliders.push({ t: 'box', x: kx, z: kz, hx: 0.28, hz: 0.2, rot, h: 1.9 });
    for (let i = 0; i < 10; i++) { const t = -3.6 + i * 0.8, x = px + ux * t, z = pz + uz * t; boxG(g, x, z, 0.06, 0.06, rot, 0, 0.72, [150, 154, 158], 20, true);
      if (hh(i, 50) < 0.72) { const fx = bx, fz = bz, wr = 0.3; // 車頭朝路邊（fx fz）
        const wheel = (d) => { const wx = x + fx * d, wz = z + fz * d; for (let k = 0; k < 8; k++) { const a0 = (k / 8) * TAU, a1 = ((k + 1) / 8) * TAU; const p0 = [wx + fx * Math.cos(a0) * wr, wr + Math.sin(a0) * wr, wz + fz * Math.cos(a0) * wr], p1 = [wx + fx * Math.cos(a1) * wr, wr + Math.sin(a1) * wr, wz + fz * Math.cos(a1) * wr]; g.grow(4, 6); const kk = g.v; for (const p of [p0, p1, [p1[0] + ux * 0.04, p1[1], p1[2] + uz * 0.04], [p0[0] + ux * 0.04, p0[1], p0[2] + uz * 0.04]]) g.vert(p[0], p[1], p[2], 0, 0, 40, 40, 44, 0); g.tri(kk, kk + 2, kk + 1); g.tri(kk, kk + 3, kk + 2); } };
        wheel(-0.55); wheel(0.55); boxG(g, x, z, 0.5, 0.03, rotOf(fx, fz), 0.5, 0.56, YL, 20, true); boxG(g, x - fx * 0.3, z - fz * 0.3, 0.03, 0.03, rot, 0.3, 0.95, YL, 20, true); boxG(g, x + fx * 0.45, z + fz * 0.45, 0.03, 0.03, rot, 0.3, 0.98, YL, 20, true);
        boxG(g, x - fx * 0.3, z - fz * 0.3, 0.14, 0.05, rotOf(fx, fz), 0.95, 1.0, [50, 50, 54], 20, true); boxG(g, x + fx * 0.45, z + fz * 0.45, 0.04, 0.22, rotOf(fx, fz), 0.98, 1.02, [50, 50, 54], 20, true); boxG(g, x + fx * 0.75, z + fz * 0.75, 0.16, 0.14, rotOf(fx, fz), 0.75, 0.9, WT, 20, true); info.bikes++; } }
    colliders.push({ t: 'box', x: px, z: pz, hx: 4.0, hz: 0.6, rot, h: 1.0, noCrush: true }); spots.ubike.push([px, pz]);
  };
  { let nSign = 0, stations = 0;
    for (const rd of S.roads) { if (rd.key !== 'hs') continue; const r = rd.r, P = rd.pts;
      r.n.forEach((ni, i) => { if (deg[ni] < 3 || nSign >= 6) return; const others = (roadsAtN.get(ni) || []).filter((o) => o !== r && o.nm !== r.nm && o.cls <= 3); if (!others.length) return;
        const o = others[0], jx = nx(ni), jz = nz(ni), on = names[o.nm][0];
        for (const d of [1, -1]) { const k = i - d; if (k < 0 || k >= P.length || nSign >= 6) continue; const ax = P[k][0] - jx, az = P[k][1] - jz, al = Math.hypot(ax, az); if (al < 40) continue; const ux = -ax / al, uz = -az / al, rx = -uz, rz = ux;
          const px = jx - ux * 28 + rx * (r.w / 2 + 0.6), pz = jz - uz * 28 + rz * (r.w / 2 + 0.6); if (!inBox(px, pz, 2) || otherRoad(px, pz, r)) continue;
          const key = guideCell(on + ' ← →', KEY_NAME.hs + ' ↑'); if (!key) continue; const g = wallG(px, pz), MET = [148, 152, 156], arm = Math.min(5.5, r.w * 0.3 + 1.4), cx = px - rx * arm, cz = pz - rz * arm;
          boxG(g, px, pz, 0.14, 0.14, 0, 0, 6.3, MET, 20, false); boxG(g, (px + cx) / 2, (pz + cz) / 2, arm / 2, 0.09, rotOf(rx, rz), 6.0, 6.25, MET, 20, false);
          plate2(cx, 5.2, cz, rx, rz, 3.6, 1.35, key, false, WHITE, -ux, -uz); colliders.push({ t: 'circle', x: px, z: pz, r: 0.22, h: 6.3 }); spots.guides.push([px, pz, ux, uz]); info.guides++; nSign++;
          if (stations < 1 && d > 0) { const sx = jx - ux * 16 + rx * (r.w / 2 + r.sw * 0.55), sz = jz - uz * 16 + rz * (r.w / 2 + r.sw * 0.55); if (!bldNear(sx, sz, 2) && !otherRoad(sx, sz, r)) { bikeStation(sx, sz, ux, uz, -rx, -rz); stations++; } } } }); }
    // 港墘站旁邊（內湖路一段的人行道）也一站
    const st0 = N.stations.find((s) => s.nm === '港墘'); if (st0) { let best = null; for (const rd of S.roads) { if (rd.key !== 'nh') continue; along(rd, 6, 30, (x, z, ux, uz, rx, rz) => { const d = Math.hypot(x - st0.p[0], z - st0.p[1]); if (d > 70) return; for (const side of [-1, 1]) { const px = x + rx * side * (rd.r.w / 2 + rd.r.sw * 0.55), pz = z + rz * side * (rd.r.w / 2 + rd.r.sw * 0.55); if (!ok(px, pz, 8) || bldNear(px, pz, 2.5) || otherRoad(px, pz, rd.r) || spots.shelters.some((s) => Math.hypot(s[0] - px, s[1] - pz) < 10)) continue; const sc = Math.abs(d - 45); if (!best || sc < best.sc) best = { sc, px, pz, ux, uz, bx: -rx * side, bz: -rz * side }; } }); }
      if (best) bikeStation(best.px, best.pz, best.ux, best.uz, best.bx, best.bz); }
  }
  // ==== 12 店門口的燈箱招牌（三條路臨路的一樓）====
  { const used = new Set();
    N.bld.forEach((b, bi) => { if (b.lm || b.back || b.site) return; const P = b.P, n = P.length;
      for (let i = 0; i < n; i++) { const a = P[i], c = P[(i + 1) % n], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 3.5) continue; if (b.gen && i !== 0) continue;
        const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, ox = (c[1] - a[1]) / L, oz = -(c[0] - a[0]) / L, k = S.fronting(mx + ox * 2, mz + oz * 2, 6); if (!k) continue; if (!b.gen && !(b.e[i] >= 1)) continue;
        const gh = b.e.includes(2) ? 4.2 : 3.6, m = Math.max(1, Math.round(L / 6)); let y0 = gh + 0.18, h = 0.92;
        for (let j = 0; j < m; j++) { const t0 = j / m, t1 = (j + 1) / m, cx = a[0] + (c[0] - a[0]) * (t0 + t1) / 2, cz = a[1] + (c[1] - a[1]) * (t0 + t1) / 2, w = L / m - 0.3; if (w < 2) continue;
          const r = hh(bi, 400 + i * 7 + j), ci = r < 0.4 ? Math.floor(hh(bi, 410 + i * 7 + j) * CHAINS.length) : CHAINS.length + Math.floor(hh(bi, 420 + i * 7 + j) * GENERIC.length), key = 'h' + ci; if (!UV[key]) continue;
          const dup = Math.round(cx / 3) + ',' + Math.round(cz / 3); if (used.has(dup)) continue; used.add(dup);
          const g = wallG(cx, cz); boxG(g, cx + ox * 0.12, cz + oz * 0.12, w / 2, 0.11, rotOf(c[0] - a[0], c[1] - a[1]), y0, y0 + h, [60, 60, 64], 20, true); plate2(cx + ox * 0.24, y0 + h / 2, cz + oz * 0.24, (c[0] - a[0]) / L, (c[1] - a[1]) / L, w, h, key, false, WHITE, ox, oz); info.boxes++; }
      } });
  }
  // ---- InstancedMesh ----
  const meshes = [], M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(), PV = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const geos = { scooter: scooterGeo, palm: palmGeo };
  for (const kind of Object.keys(tiles)) for (const [key, L] of tiles[kind]) {
    const n = L.length, m = new THREE.InstancedMesh(geos[kind], kind === 'palm' ? mats.tree : mats.inst, n); m.name = 'nh-' + kind + '-' + key; let cx = 0, cz = 0;
    for (let i = 0; i < n; i++) { const [x, z, rot, s, c] = L[i]; Q.setFromAxisAngle(UPV, rot); M4.compose(PV.set(x, 0, z), Q, SC.set(s, s, s)); m.setMatrixAt(i, M4); col.setRGB(c[0] / 255, c[1] / 255, c[2] / 255); m.setColorAt(i, col); cx += x; cz += z; }
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); m.userData.c = [cx / n, cz / n]; m.userData.hill = false; meshes.push(m);
  }
  { const byKey = new Map(meshes.map((m) => [m.name.slice(3), m])); for (const c of tcols) { c.im = byKey.get(c.tk) || null; delete c.tk; } }
  // 看的地方（測試、截圖）：每條路中間、照路的方向
  for (const rd of S.roads) { if (spots.views[rd.key]) continue; const P = rd.pts; let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (L < 150) continue; let acc = 0; for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (acc + l >= L * 0.45) { const t = (L * 0.45 - acc) / l, ux = (P[i][0] - P[i - 1][0]) / l, uz = (P[i][1] - P[i - 1][1]) / l; spots.views[rd.key] = [P[i - 1][0] + ux * l * t, P[i - 1][1] + uz * l * t, Math.atan2(-uz, ux)]; break; } acc += l; } }
  info.poles = poles.length;
  return { meshes, poles, info, spots, tex, UV };
}

return { nhStreetPrep, nhStreetBuild, NH_STREET_TEXT };
})();
