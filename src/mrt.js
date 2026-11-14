// mrt.js — 第 78 批（Nick 2026-11-08「內湖的捷運站要從地面建起 要有正反方向的捷運開來開去 要真的可以搭…要可以自己走進捷運站並等車 每過一段時間來一班車」）
// 內湖的兩個捷運站（港墘、文德）從地面蓋起來（三層：1 樓出入口的樓梯、2 樓大廳（閘門）、3 樓兩邊的側式月台＋全高的月台門），
// 文湖線的列車（白色、咖啡色的帶子、4 節、無人駕駛；沒有真的 logo）兩個方向開來開去，每 90 秒一班，到站停 15 秒、車門和月台門一起開。
// 走路可以走上樓梯、過天橋、進大廳、走閘門（嗶一聲，免費）、上月台等車、走進車裡；車門關了就跟著車走（town.src.js 每一格叫 walker.shift），到站走出來、在另一站下車走回街上。
//
//   const M = buildMrt(V, { renderer });      buildNeihu 之後叫（要 V.neihu：資料、roadAt、hillH、inBox）；加進 V.group；街上擋人擋車的東西加進 V.colliders
//   M.update(camera, dt)                       每一格：時間往前、列車的位置、車門、看板；遠的站不畫
//   M.heightAt(x, z) → 高度 | null             站在捷運站的哪一層（月台、樓梯、大廳、天橋、出入口的樓梯；坐在車上＝車廂地板）；不在站裡＝null（town.src.js 的 walkWorld 接）
//   M.at(x, z) → 站的號碼 | -1                 在哪一站的範圍裡（±50 × ±30 公尺）
//   M.cols(si, lvl)                            那一層走路要擋的（1＝大廳、2＝月台；走進去 removeColliders('world')、加這個；下來再加回 V.colliders）
//   M.movers                                   每一格換的碰撞物（月台門的門片、停著的列車的牆；坐車時＝那一節車廂的牆）；walker.setMovers
//   M.step(dt, px, pz, py, walking)            走路的人在哪裡（每一格、walker.update 前面叫）→ 回傳 { shift: [dx, dz, dth] | null, lvl, si, ride, toast, chime, action }
//   M.leave()                                  下車、被搬走（直接回車庫、被抓）：坐車的狀態清掉
//   M.setTime(t) / M.time                      測試用：時間跳到 t（秒；一個循環 180 秒）
//   M.trains() → [{ dir, k, p, s, x, z, stop, open }]  現在在跑的列車（測試）
//   M.animals() → [{ k, si, lvl, sd, st, x, y, z, u, v, ride, … }]  第 87 批：捷運站裡的小動物（opt.makeAnimal＝animals.js buildAnimal；走近內湖才做）
//   M.info                                     { meshes, tris, stations: [...], T, H }
import * as THREE from 'three';

// 整個包在一個函式裡（打包是把檔案接在一起：名字不要跟別的檔案撞到）
export const { buildMrt, MRT_TEXT, mrtKeepOut, mrtHits } = (() => {

const MRT_TEXT = '往文德西湖港墘南港展覽館下一班約秒站出口捷運文湖線終點請下車叮咚月台列車進了到大廳閘門嗶免費本站是路線圖動物園木柵萬芳社區醫院辛亥麟光六張犁科技大樓安忠孝復興南京中山國松山機場直劍路內湖公東軟體園區熊貓在等你學港墘阿輝改車廠馬力機開張多喝水一天杯排隊禁止跨越危險請勿進入電扶梯靠右站穩下一班車內湖科學園區港墘站文德站下車馬力機開張一天杯 Wenhu Line No Entry';
const rotOf = (ux, uz) => Math.atan2(-uz, ux);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const TAU = Math.PI * 2, wrapA = (a) => { a = (a + Math.PI) % TAU; return a < 0 ? a + Math.PI : a - Math.PI; };
const SANS = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

// ---- 尺寸（公尺）----
const YC = 6.0, CEIL1 = 9.4; // 大廳的地板、天花板（高架橋的底是 9.6）
const PL = 30, PV0 = 3.3, PV1 = 10.4; // 月台：長 ±30、月台門在 3.3、後面的牆在 10.4（第 80 批：Nick「捷運等候區大一點」，以前 7.8）
const CU = 22, CV = 11; // 大廳 ±22 × ±11（第 80 批：以前 ±9）
const RAMP = { u0: 0, u1: 12, v0: 4.6, v1: 6.8 }; // 月台 ↔ 大廳的樓梯（兩邊各一條，v 照 ±）
const ESCV = [7.1, 8.5], HOLE1 = 8.8; // 第 80 批（Nick「要有電扶梯跟樓梯可上去」）：樓梯旁邊的電扶梯（往上：大廳 → 月台）；月台地板的洞到 8.8
const ESC_V = 0.55, STEP_D = 0.42; // 電扶梯：每秒走 0.55 公尺（水平）、一階 0.42
const GATE_U = -8; // 閘門那一排
const TRK_V = 1.95; // 兩條軌道離中線多遠（往東的在 +v＝行進方向的右手邊；車廂的外側離月台門 3.3 − 1.95 − 1.28 ＝ 7 公分）
const CAR_L = 13.8, CAR_P = 14.4, CAR_W = 1.28, DOOR_X = 3.6, DOOR_W = 1.3, CAR_H = 3.3; // 車廂：長、間距、半寬、車門在 ±3.6（寬 1.3）、車身高
const PSD_W = 1.9; // 月台門一個口的寬
const H = 90, DWELL = 15, VM = 36, ACC = 2.0, CYCLE = 180; // 每 90 秒一班、停 15 秒；第 79 批：最快 36 m/s（130 公里）、平均 2.0 m/s²（S 形：起步、進站慢慢來），港墘→文德約 46 秒（以前 65 秒）
const DOOR_U = []; for (let i = 0; i < 4; i++) for (const d of [-DOOR_X, DOOR_X]) DOOR_U.push((i - 1.5) * CAR_P + d);
// 顏色（0–1）
const WHITE = [0.93, 0.93, 0.91], WALL = [0.86, 0.86, 0.84], CONC = [0.70, 0.70, 0.68], TILE = [0.80, 0.78, 0.72], TILE2 = [0.62, 0.63, 0.66], ORA = [0.89, 0.40, 0.12], DARK = [0.22, 0.23, 0.25], STEEL = [0.60, 0.63, 0.66], ALU = [0.76, 0.78, 0.80], GLS = [0.74, 0.86, 0.90], GLSD = [0.30, 0.42, 0.50], BROWN = [0.47, 0.30, 0.17], SEAT = [0.17, 0.33, 0.66], YEL = [0.96, 0.80, 0.15], RED = [0.85, 0.15, 0.12], GREEN = [0.25, 0.70, 0.35];
const LGRY = [0.84, 0.86, 0.87], TGRN = [0.12, 0.58, 0.40], WBAND = [0.10, 0.11, 0.13], ROOFC = [0.46, 0.52, 0.58], TEAL = [0.20, 0.62, 0.66], PEACH = [0.96, 0.66, 0.42], LEMON = [0.98, 0.86, 0.36], SKY = [0.45, 0.70, 0.92], NAVY = [0.13, 0.25, 0.56], RUBBER = [0.08, 0.08, 0.09]; // 第 80 批：列車（淺灰、綠色帶子、黑色窗帶）、屋頂、月台的顏色
// 文湖線真的站名（路線圖用；站名不是商標）
const WENHU = ['動物園', '木柵', '萬芳社區', '萬芳醫院', '辛亥', '麟光', '六張犁', '科技大樓', '大安', '忠孝復興', '南京復興', '中山國中', '松山機場', '大直', '劍南路', '西湖', '港墘', '文德', '內湖', '大湖公園', '葫洲', '東湖', '南港軟體園區', '南港展覽館'];

// ---- 幾何（頂點色；本地座標 u（沿軌道）、y（世界高度）、v（橫過軌道，+v＝往東走的右手邊）----
function mesher() {
  const P = [], N = [], UV = [], C = [], I = [];
  const quad = (a, b, c, d, col) => {
    const k = P.length / 3, ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = d[0] - b[0], vy = d[1] - b[1], vz = d[2] - b[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const flat = Math.abs(ny) > 0.7;
    [a, b, c, d].forEach((p) => { P.push(p[0], p[1], p[2]); N.push(nx, ny, nz); UV.push(flat ? p[0] : Math.abs(nx) > 0.7 ? p[2] : p[0], flat ? p[2] : p[1]); C.push(col[0], col[1], col[2]); });
    I.push(k, k + 1, k + 2, k, k + 2, k + 3);
  };
  const hq = (u0, u1, v0, v1, y, col, up = true) => (up ? quad([u0, y, v1], [u1, y, v1], [u1, y, v0], [u0, y, v0], col) : quad([u0, y, v0], [u1, y, v0], [u1, y, v1], [u0, y, v1], col)); // 平的：朝上／朝下
  const vqU = (u, v0, v1, y0, y1, col, neg = true) => (neg ? quad([u, y0, v0], [u, y0, v1], [u, y1, v1], [u, y1, v0], col) : quad([u, y0, v1], [u, y0, v0], [u, y1, v0], [u, y1, v1], col)); // 直的（u 固定）：朝 −u／+u
  const vqV = (v, u0, u1, y0, y1, col, pos = true) => (pos ? quad([u0, y0, v], [u1, y0, v], [u1, y1, v], [u0, y1, v], col) : quad([u1, y0, v], [u0, y0, v], [u0, y1, v], [u1, y1, v], col)); // 直的（v 固定）：朝 +v／−v
  const bx = (u0, u1, y0, y1, v0, v1, col, faces = null, cols = null) => { // 盒子；faces＝只畫哪幾面（pu nu py ny pv nv）
    const F = (f) => !faces || faces.includes(f), cc = (f) => (cols && (cols[f] || cols._)) || col;
    if (F('pv')) vqV(v1, u0, u1, y0, y1, cc('pv'), true); if (F('nv')) vqV(v0, u0, u1, y0, y1, cc('nv'), false);
    if (F('pu')) vqU(u1, v0, v1, y0, y1, cc('pu'), false); if (F('nu')) vqU(u0, v0, v1, y0, y1, cc('nu'), true);
    if (F('py')) hq(u0, u1, v0, v1, y1, cc('py'), true); if (F('ny')) hq(u0, u1, v0, v1, y0, cc('ny'), false);
  };
  const slopeV = (v, u0, u1, ya, yb, h, col, pos = true) => (pos ? quad([u0, ya, v], [u1, yb, v], [u1, yb + h, v], [u0, ya + h, v], col) : quad([u1, yb, v], [u0, ya, v], [u0, ya + h, v], [u1, yb + h, v], col)); // 斜的直面（樓梯旁邊的牆）
  const slopeY = (u0, u1, v0, v1, ya, yb, col, up = true) => (up ? quad([u0, ya, v1], [u1, yb, v1], [u1, yb, v0], [u0, ya, v0], col) : quad([u0, ya, v0], [u1, yb, v0], [u1, yb, v1], [u0, ya, v1], col)); // 斜的平面（樓梯的頂）
  const stairs = (u0, u1, y0, y1, v0, v1, n, colT, colR) => { // 樓梯：從 (u0, y0) 到 (u1, y1)，n 階（踏板＋立板）
    for (let i = 0; i < n; i++) {
      const ua = u0 + ((u1 - u0) * i) / n, ub = u0 + ((u1 - u0) * (i + 1)) / n, yp = y0 + ((y1 - y0) * i) / n, yt = y0 + ((y1 - y0) * (i + 1)) / n;
      hq(Math.min(ua, ub), Math.max(ua, ub), v0, v1, yt, colT, true);
      vqU(ua, v0, v1, Math.min(yp, yt), Math.max(yp, yt), colR, y1 < y0 ? false : true);
    }
  };
  const prism = (u, v, r, y0, y1, col, n = 8) => { // 第 80 批：切角的柱子（八角）
    for (let i = 0; i < n; i++) { const a0 = ((i + 0.5) / n) * TAU, a1 = ((i + 1.5) / n) * TAU, p0 = [u + r * Math.cos(a0), v + r * Math.sin(a0)], p1 = [u + r * Math.cos(a1), v + r * Math.sin(a1)];
      quad([p1[0], y0, p1[1]], [p0[0], y0, p0[1]], [p0[0], y1, p0[1]], [p1[0], y1, p1[1]], col); }
  };
  const tri = (a, b, c, col) => quad(a, b, c, c, col);
  const geometry = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.setIndex(I); g.computeBoundingSphere(); return g;
  };
  return { quad, hq, vqU, vqV, bx, slopeV, slopeY, stairs, prism, tri, geometry, get tris() { return I.length / 3; }, get empty() { return !I.length; } };
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function fit(g, text, px, maxW) { for (let s = px; s >= 10; s -= 2) { g.font = `700 ${s}px ${SANS}`; if (g.measureText(text).width <= maxW) return s; } return 10; }
function signMat(tex) { const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22, roughness: 0.6, transparent: true }); m.userData.role = 'sign'; return m; } // 只畫正面（背面透過玻璃看到會是反的字）
function texOf(cv) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// 第 80 批（Nick「捷運等候區大一點顏色也不要那麼單調譬如說禁止跨越區捷運路線圖」）：一站一張 1024² 的圖：路線圖（本站亮起來）、4 張自己編的海報、地上的「下車」「排隊」「禁止跨越」
function routeMap(g, x0, y0, w, h, here) { // 文湖線的路線圖（站名是真的站名）
  g.fillStyle = '#fbfaf6'; g.fillRect(x0, y0, w, h); g.fillStyle = '#8a5a2b'; g.fillRect(x0, y0, w, Math.round(h * 0.2));
  g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = `700 ${Math.round(h * 0.13)}px ${SANS}`; g.fillText('文湖線　路線圖', x0 + 18, y0 + h * 0.1); g.textAlign = 'right'; g.font = `600 ${Math.round(h * 0.09)}px ${SANS}`; g.fillText('Wenhu Line', x0 + w - 18, y0 + h * 0.1);
  const n = WENHU.length, lx0 = x0 + 34, lx1 = x0 + w - 34, ly = y0 + h * 0.33, dx = (lx1 - lx0) / (n - 1);
  g.fillStyle = '#8a5a2b'; g.fillRect(lx0, ly - h * 0.03, lx1 - lx0, h * 0.06);
  const fs = Math.max(10, Math.min(Math.round(dx * 0.62), Math.round(h * 0.085)));
  for (let i = 0; i < n; i++) { const x = lx0 + i * dx, me = WENHU[i] === here;
    g.beginPath(); g.arc(x, ly, me ? h * 0.075 : h * 0.042, 0, TAU); g.fillStyle = me ? '#ffd23a' : '#fff'; g.fill(); g.lineWidth = Math.max(2, h * 0.018); g.strokeStyle = me ? '#c0392b' : '#8a5a2b'; g.stroke();
    g.fillStyle = me ? '#c0392b' : '#25272b'; g.textAlign = 'center'; g.font = `${me ? 800 : 600} ${fs}px ${SANS}`;
    [...WENHU[i]].forEach((ch, k) => g.fillText(ch, x, ly + h * 0.13 + k * fs * 1.04)); }
  if (here) { const i = WENHU.indexOf(here); if (i >= 0) { const x = lx0 + i * dx; g.fillStyle = '#c0392b'; g.font = `800 ${Math.round(h * 0.09)}px ${SANS}`; g.textAlign = 'center'; g.fillText('本站', x, ly - h * 0.12); } }
}
function decoAtlas(g, S) {
  const R = {};
  routeMap(g, 0, 0, 1024, 200, S.nm); R.map = [0, 0, 1024, 200];
  const ads = [ // 自己編的海報（沒有真的牌子）
    (x, y, w, h) => { g.fillStyle = '#ffd9e6'; g.fillRect(x, y, w, h); g.fillStyle = '#7ccf7a'; g.fillRect(x, y + h * 0.72, w, h * 0.28); const cx = x + w / 2, cy = y + h * 0.47, r = w * 0.27;
      g.fillStyle = '#222'; for (const q of [-1, 1]) { g.beginPath(); g.arc(cx + q * r * 0.75, cy - r * 0.75, r * 0.32, 0, TAU); g.fill(); } g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
      g.fillStyle = '#222'; for (const q of [-1, 1]) { g.beginPath(); g.ellipse(cx + q * r * 0.4, cy - r * 0.05, r * 0.22, r * 0.3, q * 0.5, 0, TAU); g.fill(); } g.beginPath(); g.arc(cx, cy + r * 0.32, r * 0.12, 0, TAU); g.fill();
      g.fillStyle = '#c2185b'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${Math.round(w * 0.17)}px ${SANS}`; g.fillText('動物園', cx, y + h * 0.12); g.font = `700 ${Math.round(w * 0.1)}px ${SANS}`; g.fillStyle = '#1b5e20'; g.fillText('熊貓在等你！', cx, y + h * 0.86); },
    (x, y, w, h) => { const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#2b6cb0'); gr.addColorStop(1, '#90cdf4'); g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.85)'; for (const [bx, bw, bh] of [[0.08, 0.18, 0.42], [0.3, 0.16, 0.6], [0.5, 0.2, 0.5], [0.74, 0.18, 0.36]]) { g.fillRect(x + w * bx, y + h * (0.88 - bh), w * bw, h * bh); }
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${Math.round(w * 0.13)}px ${SANS}`; g.fillText('內湖科學園區', x + w / 2, y + h * 0.13); g.font = `600 ${Math.round(w * 0.085)}px ${SANS}`; g.fillText('港墘站、文德站下車', x + w / 2, y + h * 0.94); },
    (x, y, w, h) => { g.fillStyle = '#ff8a1f'; g.fillRect(x, y, w, h); g.fillStyle = '#1e1e22'; g.fillRect(x, y + h * 0.62, w, h * 0.06);
      g.fillStyle = '#e53935'; g.beginPath(); g.moveTo(x + w * 0.12, y + h * 0.58); g.lineTo(x + w * 0.2, y + h * 0.44); g.lineTo(x + w * 0.42, y + h * 0.38); g.lineTo(x + w * 0.66, y + h * 0.4); g.lineTo(x + w * 0.88, y + h * 0.5); g.lineTo(x + w * 0.9, y + h * 0.58); g.closePath(); g.fill();
      g.fillStyle = '#222'; for (const q of [0.27, 0.73]) { g.beginPath(); g.arc(x + w * q, y + h * 0.59, w * 0.08, 0, TAU); g.fill(); }
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${Math.round(w * 0.15)}px ${SANS}`; g.fillText('阿輝改車廠', x + w / 2, y + h * 0.14); g.font = `700 ${Math.round(w * 0.1)}px ${SANS}`; g.fillText('馬力機開張！', x + w / 2, y + h * 0.82); },
    (x, y, w, h) => { g.fillStyle = '#26a69a'; g.fillRect(x, y, w, h); const cx = x + w / 2, cy = y + h * 0.5;
      g.fillStyle = '#e0f7fa'; g.beginPath(); g.moveTo(cx, cy - h * 0.22); g.bezierCurveTo(cx + w * 0.32, cy + h * 0.02, cx + w * 0.24, cy + h * 0.2, cx, cy + h * 0.2); g.bezierCurveTo(cx - w * 0.24, cy + h * 0.2, cx - w * 0.32, cy + h * 0.02, cx, cy - h * 0.22); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${Math.round(w * 0.17)}px ${SANS}`; g.fillText('多喝水', cx, y + h * 0.12); g.font = `700 ${Math.round(w * 0.1)}px ${SANS}`; g.fillText('一天 8 杯', cx, y + h * 0.88); },
  ];
  R.ads = ads.map((f, i) => { const r = [i * 256 + 8, 208, i * 256 + 248, 552]; g.fillStyle = '#fff'; g.fillRect(i * 256, 200, 256, 360); f(r[0], r[1], r[2] - r[0], r[3] - r[1]); return [i * 256, 200, i * 256 + 256, 560]; });
  // 地上：下車（黃色斜線＋往外的箭頭）、排隊（綠色箭頭往軌道）、禁止跨越（紅白斜線）
  const hatch = (x, y, w, h, c1, c2, k = 28) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = c1; g.fillRect(x, y, w, h); g.strokeStyle = c2; g.lineWidth = k * 0.45; for (let t = -h; t < w + h; t += k) { g.beginPath(); g.moveTo(x + t, y + h); g.lineTo(x + t + h, y); g.stroke(); } g.restore(); };
  { const x = 0, y = 560, w = 256, h = 256; g.fillStyle = '#c9c3b8'; g.fillRect(x, y, w, h); hatch(x + 10, y + 10, w - 20, h - 20, '#c9c3b8', '#f2c10f', 30); g.fillStyle = '#c9c3b8'; g.fillRect(x + 50, y + 70, w - 100, h - 140);
    g.fillStyle = '#f2c10f'; g.beginPath(); g.moveTo(x + w / 2, y + h - 78); g.lineTo(x + w / 2 - 40, y + h - 120); g.lineTo(x + w / 2 + 40, y + h - 120); g.closePath(); g.fill();
    g.fillStyle = '#3b3b3b'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 52px ${SANS}`; g.fillText('下車', x + w / 2, y + 112); R.off = [x, y, x + w, y + h]; }
  { const x = 256, y = 560, w = 128, h = 256; g.fillStyle = '#c9c3b8'; g.fillRect(x, y, w, h); g.fillStyle = '#2e9d57'; g.fillRect(x + 14, y + 8, w - 28, h - 16); g.fillStyle = '#c9c3b8'; g.fillRect(x + 24, y + 18, w - 48, h - 36);
    g.fillStyle = '#2e9d57'; for (const yy of [46, 120]) { g.beginPath(); g.moveTo(x + w / 2, y + yy); g.lineTo(x + w / 2 - 30, y + yy + 34); g.lineTo(x + w / 2 + 30, y + yy + 34); g.closePath(); g.fill(); }
    g.font = `800 30px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('排', x + w / 2, y + 196); g.fillText('隊', x + w / 2, y + 228); R.queue = [x, y, x + w, y + h]; }
  // 第 89 批：樓梯口旁邊的門（月台只剩 0.58 公尺）用的短的：寬的「下車」、小的「排隊」
  { const x = 0, y = 832, w = 384, h = 140; g.fillStyle = '#c9c3b8'; g.fillRect(x, y, w, h); hatch(x + 8, y + 8, w - 16, h - 16, '#c9c3b8', '#f2c10f', 26); g.fillStyle = '#c9c3b8'; g.fillRect(x + 40, y + 30, w - 80, h - 60);
    g.fillStyle = '#f2c10f'; g.beginPath(); g.moveTo(x + w - 64, y + h / 2 + 26); g.lineTo(x + w - 100, y + h / 2 - 8); g.lineTo(x + w - 28, y + h / 2 - 8); g.closePath(); g.fill();
    g.fillStyle = '#3b3b3b'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 52px ${SANS}`; g.fillText('下車', x + w / 2 - 20, y + h / 2); R.offW = [x, y, x + w, y + h]; }
  { const x = 400, y = 832, w = 140, h = 140; g.fillStyle = '#c9c3b8'; g.fillRect(x, y, w, h); g.fillStyle = '#2e9d57'; g.fillRect(x + 8, y + 8, w - 16, h - 16); g.fillStyle = '#c9c3b8'; g.fillRect(x + 16, y + 16, w - 32, h - 32);
    g.fillStyle = '#2e9d57'; g.beginPath(); g.moveTo(x + w / 2, y + 26); g.lineTo(x + w / 2 - 24, y + 54); g.lineTo(x + w / 2 + 24, y + 54); g.closePath(); g.fill();
    g.font = `800 34px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('排隊', x + w / 2, y + 90); R.queueS = [x, y, x + w, y + h]; }
  { const x = 384, y = 560, w = 256, h = 256; hatch(x, y, w, h, '#f4f4f0', '#d32f2f', 36); g.fillStyle = '#f4f4f0'; g.fillRect(x + 28, y + 92, w - 56, 72); g.fillStyle = '#d32f2f'; g.font = `800 50px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('禁止跨越', x + w / 2, y + h / 2); R.nox = [x, y, x + w, y + h]; }
  { const x = 640, y = 560, w = 384, h = 120; g.fillStyle = '#d32f2f'; g.fillRect(x, y, w, h); g.fillStyle = '#fff'; g.fillRect(x + 8, y + 8, w - 16, h - 16); g.fillStyle = '#d32f2f'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 50px ${SANS}`; g.fillText('禁止跨越', x + w / 2, y + 48); g.font = `600 26px ${SANS}`; g.fillStyle = '#333'; g.fillText('No Entry　危險 請勿進入', x + w / 2, y + 92); R.noxSign = [x, y, x + w, y + h]; }
  { const x = 640, y = 690, w = 384, h = 190; g.fillStyle = '#1f2326'; g.fillRect(x, y, w, h); g.fillStyle = '#8a5a2b'; g.fillRect(x, y, 16, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 64px ${SANS}`; g.fillText('電扶梯 ↑', x + w / 2 + 8, y + 70); g.font = `600 34px ${SANS}`; g.fillStyle = '#ffd24a'; g.fillText('請站穩、握好扶手', x + w / 2 + 8, y + 140); R.escSign = [x, y, x + w, y + h]; }
  return R;
}

// 列車跑一段（從停到停）：第 79 批（Nick「捷運自己慢慢啟動到慢慢停止 不要花太多時間」）：起步、進站的加速度從 0 慢慢變大再變小（S 形：
//   速度 v＝Vp·(3s²−2s³)，s＝t/TA），中間用 Vp 跑；平均加速度 ACC、最大 1.5·ACC；短的一段沒有中間（Vp＝√(L·ACC)）
function runV(L) { const da = (VM * VM) / (2 * ACC); return L >= 2 * da ? VM : Math.sqrt(L * ACC); }
function runT(L) { if (L <= 0) return 0; const Vp = runV(L), TA = Vp / ACC, da = (Vp * TA) / 2; return 2 * TA + Math.max(0, L - 2 * da) / Vp; }
function runP(L, t) { // t 秒以後走了多遠、速度
  const T = runT(L); if (t <= 0 || L <= 0) return [0, 0]; if (t >= T) return [L, 0];
  const Vp = runV(L), TA = Vp / ACC, da = (Vp * TA) / 2;
  const up = (tt) => { const s = tt / TA; return [Vp * TA * (s * s * s - 0.5 * s * s * s * s), Vp * s * s * (3 - 2 * s)]; };
  if (t < TA) return up(t);
  if (t < T - TA) return [da + Vp * (t - TA), Vp];
  const [q, v] = up(T - t); return [L - q, v];
}

// 出入口：哪一邊（s）、平台的頭在 u 幾（往 dir 的方向：5 公尺平台＋10.5 公尺樓梯下到街上）、樓梯那條帶子從 v 幾起（往外 4.6 公尺：樓梯＋電扶梯）
// 第 80 批：照探針量的路（港墘在內湖路一段上面：兩邊的車道 v −19…17；文德在文德路上面：車道 v 0…16）重新擺；跟車站重疊的房子 neihu.js 拿掉（mrtKeepOut）
function entDefs(nm) { return nm === '文德' ? [{ s: -1, uTop: -14, vTop: 13, dir: -1 }, { s: 1, uTop: 22, vTop: 19, dir: -1 }] : [{ s: 1, uTop: -14, vTop: 19.5, dir: -1 }, { s: -1, uTop: -14, vTop: 21.5, dir: -1 }]; }
function entOf(e, i) { const dir = e.dir || 1, u0 = e.uTop, uS = u0 + 5 * dir, u1 = u0 + 15.5 * dir; return { ...e, dir, n: i + 1, u0, uS, u1, bu0: Math.min(u0, uS), bu1: Math.max(u0, uS), v0: e.vTop * e.s, v1: (e.vTop + 4.6) * e.s }; }
function trackOf(E) { // 軌道（折線）：累積長度、s → 位置和方向、投影
  const TP = E.P, cum = [0]; for (let i = 1; i < TP.length; i++) cum.push(cum[i - 1] + Math.hypot(TP[i][0] - TP[i - 1][0], TP[i][1] - TP[i - 1][1]));
  const LT = cum[cum.length - 1], AT = [0, 0, 1, 0];
  const at = (s, out = AT) => { s = clamp(s, 0, LT); let i = 1; while (i < TP.length - 1 && cum[i] < s) i++; const a = TP[i - 1], b = TP[i], L = cum[i] - cum[i - 1] || 1, t = (s - cum[i - 1]) / L; out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = (b[0] - a[0]) / L; out[3] = (b[1] - a[1]) / L; return out; };
  const proj = (x, z) => { let bs = 0, bd = Infinity; for (let i = 1; i < TP.length; i++) { const a = TP[i - 1], b = TP[i], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1), px = a[0] + dx * t, pz = a[1] + dz * t, d = (x - px) ** 2 + (z - pz) ** 2; if (d < bd) { bd = d; bs = cum[i - 1] + Math.sqrt(L2) * t; } } return bs; };
  return { TP, cum, LT, at, proj };
}
// 第 80 批（Nick「可把會與捷運站重疊的房子去除」）：車站（月台、屋頂、大廳、翼、出入口）在地上佔的長方形（站的 u、v）；neihu.js 蓋房子以前叫
function mrtKeepOut(N) {
  const E = N && N.elev && N.elev.find((e) => e.k === 'mrt'); if (!E || !N.stations || !N.stations.length) return [];
  const T = trackOf(E), out = [];
  for (const st of N.stations) { const q = T.at(T.proj(st.p[0], st.p[1])), S = { x: q[0], z: q[1], ux: q[2], uz: q[3] }, R = [];
    R.push([-(PL + 2.5), PL + 2.5, -(PV1 + 1.8), PV1 + 1.8]);
    for (const e of entDefs(st.nm).map(entOf)) { const ua = Math.min(e.u0, e.u1 + 1.8 * e.dir), ub = Math.max(e.u0, e.u1 + 1.8 * e.dir); R.push([ua - 1.2, ub + 1.2, Math.min(e.v0, e.v1) - 1.2, Math.max(e.v0, e.v1) + 1.2]); R.push([e.bu0 - 1, e.bu1 + 1, Math.min(e.s * CV, e.v0), Math.max(e.s * CV, e.v0)]); }
    for (const [u0, u1, v0, v1] of R) out.push({ ...S, u0, u1, v0, v1, nm: st.nm }); }
  return out;
}
function mrtHits(K, P) { // 這個多邊形（房子）碰到哪一個長方形：頂點在裡面、長方形的角在多邊形裡面、或邊相交
  const loc = (r, x, z) => { const dx = x - r.x, dz = z - r.z; return [dx * r.ux + dz * r.uz, -dx * r.uz + dz * r.ux]; };
  for (const r of K) { const L = P.map((p) => loc(r, p[0], p[1]));
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity; for (const [u, v] of L) { minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v); }
    if (maxU < r.u0 || minU > r.u1 || maxV < r.v0 || minV > r.v1) continue;
    if (L.some(([u, v]) => u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1)) return true;
    const inP = (u, v) => { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if ((a[1] > v) !== (b[1] > v) && u < ((b[0] - a[0]) * (v - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    if (inP(r.u0, r.v0) || inP(r.u1, r.v0) || inP(r.u0, r.v1) || inP(r.u1, r.v1) || inP((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2)) return true;
    const segX = (a, b, c, d) => { const o = (p, q, r2) => (q[0] - p[0]) * (r2[1] - p[1]) - (q[1] - p[1]) * (r2[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
    const E4 = [[[r.u0, r.v0], [r.u1, r.v0]], [[r.u1, r.v0], [r.u1, r.v1]], [[r.u1, r.v1], [r.u0, r.v1]], [[r.u0, r.v1], [r.u0, r.v0]]];
    for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; if (E4.some(([c, d]) => segX(a, b, c, d))) return true; }
  }
  return false;
}

function buildMrt(V, opt = {}) {
  const NH = V.neihu; if (!NH || !NH.data) return null;
  const D = NH.data, E = D.elev.find((e) => e.k === 'mrt'); if (!E || !D.stations.length) return null;
  const T0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const group = new THREE.Group(); group.name = 'mrt';
  const YT = E.y, YP = YT + 1.1, CEIL2 = YP + 4.4, ROOF = CEIL2 + 0.5;
  // ---- 軌道（折線）：累積長度、s → 位置和方向、投影 ----
  const { LT, at, proj } = trackOf(E);
  // 列車跑的範圍（跟 neihu.js 一樣：範圍裡面，山比橋面高的地方＝隧道口）
  let sA = 0, sB = LT;
  { let s0 = -1, s1 = -1; for (let s = 0; s <= LT; s += 2) { const q = at(s); if (NH.inBox(q[0], q[1])) { if (s0 < 0) s0 = s; s1 = s; } }
    if (s0 >= 0) { for (let s = s0; s >= 0; s -= 2) { const q = at(s); if (NH.hillH(q[0], q[1]) > E.y + 1.2) { sA = s; break; } } for (let s = s1; s <= LT; s += 2) { const q = at(s); if (NH.hillH(q[0], q[1]) > E.y + 1.2) { sB = s; break; } } } }
  // ---- 站 ----
  const roadAt = NH.roadAt || (() => null);
  const onRoad = (x, z, m = 0.3) => { const r = roadAt(x, z); return !!r && r.d < r.w / 2 + m; }; // 車道上（人行道不算）
  const stations = D.stations.map((s) => { const q = at(proj(s.p[0], s.p[1])); return { nm: s.nm, en: s.en, s: proj(s.p[0], s.p[1]), x: q[0], z: q[1], ux: q[2], uz: q[3] }; }).sort((a, b) => a.s - b.s);
  const BEYOND = { 1: stations.length > 1 && stations[stations.length - 1].nm === '文德' ? '南港展覽館' : '動物園', [-1]: stations[0].nm === '港墘' ? '西湖' : '動物園' };
  const dirLabel = (si, dir) => { const j = si + dir; return '往' + (j >= 0 && j < stations.length ? stations[j].nm : BEYOND[dir]); };
  const colliders0 = [];
  const mats = {
    wall: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }),
    light: new THREE.MeshBasicMaterial({ color: 0xfff3dd, toneMapped: false }),
    train: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide }),
    tglass: new THREE.MeshStandardMaterial({ color: 0xa9bcc6, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }), // 第 82 批：淺一點（以前 0x2a3a46、0.45：車裡看出去整片暗）
    leaf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 }),
  };
  // 第 82 批（Nick「捷運站內光線太暗 車廂裡也太暗」）：站裡、車廂裡有日光燈：牆、地板、車廂自己亮一點（頂點色 × SELF），燈（三個顏色都 ≥ 0.945 的）亮很多；白天晚上、普通也一樣
  const SELF = { wall: [0.24, 1.6], train: [0.34, 1.8] };
  for (const k of Object.keys(SELF)) { const m = mats[k], [self, lamp] = SELF[k];
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef USE_COLOR
  { float lampK = step(0.945, min(vColor.r, min(vColor.g, vColor.b))); totalEmissiveRadiance += vColor.rgb * (${self.toFixed(3)} + lampK * ${lamp.toFixed(3)}); }
#endif`); };
    m.customProgramCacheKey = () => 'mrt-self-' + k; }
  let tris = 0, meshes = 0;
  const addMesh = (geo, mat, parent, name) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.frustumCulled = true; parent.add(m); meshes++; tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3; return m; };

  // 第 80 批：電扶梯：不動的部分（兩邊的玻璃扶手、黑色扶手帶、底下的斜面、上下的鋁板）；會動的階梯另外（InstancedMesh）；ua／ya＝下面、ub／yb＝上面
  const ESCS = [];
  function escal(M, G, S, ua, ub, ya, yb, vlo, vhi) {
    const lo = Math.min(ua, ub), hi = Math.max(ua, ub), yl = ua < ub ? ya : yb, yh = ua < ub ? yb : ya;
    M.slopeY(lo, hi, vlo, vhi, yl - 0.05, yh - 0.05, RUBBER, true); // 階梯底下暗暗的
    for (const vv of [vlo, vhi]) { M.slopeV(vv, lo, hi, yl - 0.05, yh - 0.05, 0.22, STEEL, vv > (vlo + vhi) / 2 ? false : true); G.slopeV(vv, lo, hi, yl + 0.17, yh + 0.17, 0.8, GLS, true); M.slopeY(lo, hi, vv - 0.05, vv + 0.05, yl + 1.0, yh + 1.0, RUBBER, true); M.slopeV(vv - 0.05, lo, hi, yl + 0.92, yh + 0.92, 0.08, RUBBER, false); M.slopeV(vv + 0.05, lo, hi, yl + 0.92, yh + 0.92, 0.08, RUBBER, true); }
    for (const [u, y, dd] of [[ua, ya, ua < ub ? -1 : 1], [ub, yb, ua < ub ? 1 : -1]]) M.bx(Math.min(u, u + dd * 1.0), Math.max(u, u + dd * 1.0), y - 0.05, y + 0.006, vlo, vhi, ALU); // 上下的鋁板
    ESCS.push({ S, ua, ub, ya, yb, vc: (vlo + vhi) / 2, w: vhi - vlo });
  }
  for (let si = 0; si < stations.length; si++) {
    const S = stations[si], ux = S.ux, uz = S.uz, vx = -uz, vz = ux, rot = rotOf(ux, uz);
    const toW = (u, v) => [S.x + ux * u + vx * v, S.z + uz * u + vz * v];
    const sg = new THREE.Group(); sg.name = 'mrt-st-' + S.nm; sg.position.set(S.x, 0, S.z); sg.rotation.y = rot; group.add(sg); S.group = sg;
    const M = mesher(), G = mesher(), LI = mesher();
    const box = (u0, u1, v0, v1, y0, h, tag, extra) => { const [x, z] = toW((u0 + u1) / 2, (v0 + v1) / 2); const c = { t: 'box', x, z, hx: Math.abs(u1 - u0) / 2, hz: Math.abs(v1 - v0) / 2, rot, h, noCrush: true, ...extra }; if (y0 != null) c.y0 = y0; return c; };
    const cols1 = [], cols2 = []; S.cols = { 1: cols1, 2: cols2 };
    // 出入口：哪一邊（s）、樓梯的頭在 u 幾（往 dir 的方向下去 13.5 公尺：3 公尺平台＋10.5 公尺樓梯）、樓梯那條帶子從 v 幾起（往外 3 公尺）；照探針量的：路、人行道、房子都避開
    S.ent = entDefs(S.nm).map(entOf);
    S.gates = S.ent.some((e) => e.bu1 > RAMP.u1) ? [GATE_U, 16] : [GATE_U]; // 閘門那幾排（出入口在兩頭的站：兩排，中間是付費區）
    // ==== 第 80 批：裝飾的圖（路線圖、海報、地上的線）：一張 1024² 一站一張 ====
    const dcv = mkCanvas(1024, 1024), dgx = dcv.getContext('2d'), DEC = decoAtlas(dgx, S), DCM = mesher(), dcuv = [];
    const decUV = (P4, r) => { const k0 = [r[0] / 1024, 1 - r[1] / 1024], k1 = [r[2] / 1024, 1 - r[3] / 1024], uv4 = [[k0[0], k0[1]], [k1[0], k0[1]], [k1[0], k1[1]], [k0[0], k1[1]]]; // P4＝左上、右上、右下、左下（看的人看到的）
      const a = P4[0], b = P4[1], c = P4[2], d = P4[3], ux2 = c[0] - a[0], uy2 = c[1] - a[1], uz2 = c[2] - a[2], vx2 = d[0] - b[0], vy2 = d[1] - b[1], vz2 = d[2] - b[2], ny2 = uz2 * vx2 - ux2 * vz2;
      DCM.quad(a, b, c, d, [1, 1, 1]); dcuv.push(...uv4); return ny2; };
    const decFloor = (uc, vNear, vFar, w, r, y = YP + 0.008) => { const sd = Math.sign(vFar - vNear) || 1; decUV([[uc - sd * w / 2, y, vNear], [uc + sd * w / 2, y, vNear], [uc + sd * w / 2, y, vFar], [uc - sd * w / 2, y, vFar]], r); }; // 字的上面朝 vNear（軌道那邊）
    const decWall = (u, y, v, w, h, r, face) => { const hw = w / 2, hh = h / 2; // face：朝哪邊（pv nv pu nu）
      const P4 = face === 'pv' ? [[u - hw, y + hh, v], [u + hw, y + hh, v], [u + hw, y - hh, v], [u - hw, y - hh, v]] : face === 'nv' ? [[u + hw, y + hh, v], [u - hw, y + hh, v], [u - hw, y - hh, v], [u + hw, y - hh, v]] : face === 'pu' ? [[u, y + hh, v + hw], [u, y + hh, v - hw], [u, y - hh, v - hw], [u, y - hh, v + hw]] : [[u, y + hh, v - hw], [u, y + hh, v + hw], [u, y - hh, v + hw], [u, y - hh, v - hw]];
      decUV(P4, r); };
    // ==== 月台層（第 80 批：深 7.1 公尺、樓梯＋電扶梯、地上的線、路線圖、海報、顏色）====
    const BAYC = [TEAL, PEACH, LEMON, SKY];
    for (const sd of [-1, 1]) {
      const a = sd * PV0, b = sd * PV1, r0 = sd * RAMP.v0, r1 = sd * RAMP.v1, h1 = sd * HOLE1, e0 = sd * ESCV[0], e1 = sd * ESCV[1], face = sd > 0 ? 'nv' : 'pv'; // face：後面的牆朝軌道
      // 地板（厚 0.6）：樓梯＋電扶梯的洞那一段分兩塊
      for (const [u0, u1, va, vb] of [[-PL, RAMP.u0, a, b], [RAMP.u0, RAMP.u1, a, r0], [RAMP.u0, RAMP.u1, h1, b], [RAMP.u1, PL, a, b]]) M.bx(u0, u1, YP - 0.6, YP, Math.min(va, vb), Math.max(va, vb), CONC, null, { py: TILE });
      M.hq(-PL, PL, Math.min(a + sd * 0.25, a + sd * 0.55), Math.max(a + sd * 0.25, a + sd * 0.55), YP + 0.004, YEL, true); // 月台邊的黃線（導盲磚）
      M.hq(-PL, PL, Math.min(b - sd * 1.4, b - sd * 0.3), Math.max(b - sd * 1.4, b - sd * 0.3), YP + 0.003, [0.70, 0.66, 0.60], true); // 後面一條深一點的地磚
      // 月台門（全高）：門口 1.9 寬，門片另外（InstancedMesh）；固定的玻璃＋門框、上面的橫樑（咖啡色＝文湖線）
      let u = -PL;
      const edges = DOOR_U.map((d) => [d - PSD_W / 2, d + PSD_W / 2]);
      for (const [e0d, e1d] of edges) {
        G.vqV(a, u, e0d, YP, YP + 3.0, GLS, sd > 0); M.bx(e0d - 0.08, e0d, YP, YP + 3.0, a - 0.05, a + 0.05, WHITE); M.bx(e1d, e1d + 0.08, YP, YP + 3.0, a - 0.05, a + 0.05, WHITE);
        G.vqV(a, e0d, e1d, YP + 2.2, YP + 3.0, GLS, sd > 0); // 門口上面的玻璃
        cols2.push(box(u, e0d, a - 0.06, a + 0.06, YP - 0.3, YP + 3.3)); u = e1d;
      }
      G.vqV(a, u, PL, YP, YP + 3.0, GLS, sd > 0); cols2.push(box(u, PL, a - 0.06, a + 0.06, YP - 0.3, YP + 3.3));
      M.bx(-PL, PL, YP + 3.0, YP + 3.35, a - 0.12, a + 0.12, BROWN); M.bx(-PL, PL, YP + 3.35, CEIL2, a - 0.06, a + 0.06, WALL); // 橫樑＋到天花板的板子
      // 地上的線：每個門口前面黃色斜線的「下車」、兩邊綠色的「排隊」箭頭
      // 第 89 批：門口在樓梯、電扶梯的洞旁邊（月台只剩玻璃欄杆前面那一條）＝短的線，不畫到洞上面（懸空）
      for (const d of DOOR_U) { if (d + 1.8 > RAMP.u0 && d - 1.8 < RAMP.u1) { const vf = r0 - sd * 0.12, dv = Math.abs(vf - (a + sd * 0.6)); decFloor(d, a + sd * 0.6, vf, dv * 384 / 140, DEC.offW); for (const q of [-1, 1]) decFloor(d + q * 1.35, a + sd * 0.6, vf, dv, DEC.queueS); continue; }
        decFloor(d, a + sd * 0.6, a + sd * 2.0, 1.5, DEC.off); for (const q of [-1, 1]) decFloor(d + q * 1.35, a + sd * 0.6, a + sd * 3.0, 0.8, DEC.queue); }
      // 兩頭：禁止跨越（紅白斜線＋黃黑欄杆，走不過去）
      for (const su of [-1, 1]) { const ub = su * (PL - 2.6); decFloor(su * (PL - 1.3), a + sd * 0.1, b - sd * 0.1, 2.5, DEC.nox); // 字朝那一頭的外面
        M.bx(ub - 0.05, ub + 0.05, YP, YP + 1.0, Math.min(a, b) + 0.1, Math.max(a, b) - 0.1, [0.95, 0.8, 0.1]); for (let k = 0; k < 6; k++) { const vv = a + (b - a) * (k + 0.5) / 6; M.bx(ub - 0.06, ub + 0.06, YP + 0.45, YP + 0.62, vv - 0.28, vv + 0.28, [0.1, 0.1, 0.1]); }
        decWall(ub + su * -0.07, YP + 1.35, (a + b) / 2, 1.6, 0.5, DEC.noxSign, su > 0 ? 'nu' : 'pu');
        cols2.push(box(ub - 0.08, ub + 0.08, a, b, YP - 0.3, YP + 1.2)); }
      // 後面的牆：每 6 公尺一格：下面有顏色的板子、咖啡色帶子；路線圖、海報、玻璃輪流
      for (let k = 0; k < 10; k++) { const t0 = -PL + k * 6, t1 = t0 + 6, tm = t0 + 3, kind = k === 2 || k === 7 ? 'map' : k === 4 || k === 5 ? 'ads' : 'glass';
        M.bx(t0, t1, YP, YP + 1.0, b - 0.08, b + 0.08, BAYC[(k + (sd > 0 ? 0 : 2)) % 4]); M.bx(t0, t1, YP + 1.0, YP + 1.12, b - 0.1, b + 0.1, BROWN);
        if (kind === 'glass') G.vqV(b, t0, t1, YP + 1.12, CEIL2, GLS, sd > 0);
        else { M.bx(t0, t1, YP + 1.12, YP + 2.75, b - 0.06, b + 0.06, WALL); G.vqV(b, t0, t1, YP + 2.75, CEIL2, GLS, sd > 0);
          if (kind === 'map') decWall(tm, YP + 1.93, b - sd * 0.08, 5.4, 1.06, DEC.map, face);
          else for (const q of [-1, 1]) decWall(tm + q * 1.3, YP + 1.93, b - sd * 0.08, 1.05, 1.5, DEC.ads[(k * 2 + (q > 0 ? 1 : 0) + (sd > 0 ? 0 : 1)) % 4], face); }
      }
      for (let t = -PL; t <= PL + 0.01; t += 6) M.bx(t - 0.08, t + 0.08, YP, CEIL2, b - 0.1, b + 0.1, WHITE);
      cols2.push(box(-PL, PL, b - 0.1, b + 0.1, YP - 0.3, CEIL2));
      // 兩頭的牆
      M.bx(-PL - 0.15, -PL, YP, CEIL2, Math.min(a, b), Math.max(a, b), WALL); M.bx(PL, PL + 0.15, YP, CEIL2, Math.min(a, b), Math.max(a, b), WALL);
      cols2.push(box(-PL - 0.2, -PL, a, b, YP - 0.3, CEIL2)); cols2.push(box(PL, PL + 0.2, a, b, YP - 0.3, CEIL2));
      // 切角的柱子（橘）、有顏色的椅子
      for (const t of [-24, -12, 12, 24]) { M.prism(t, sd * 9.7, 0.26, YP, CEIL2, ORA); cols2.push(box(t - 0.27, t + 0.27, sd * 9.7 - 0.27, sd * 9.7 + 0.27, YP - 0.3, CEIL2)); }
      for (const [t, col] of [[-18, TEAL], [-6, LEMON], [18, PEACH]]) { M.bx(t - 1.2, t + 1.2, YP + 0.4, YP + 0.48, sd * 9.4 - 0.25, sd * 9.4 + 0.25, col); M.bx(t - 1.2, t + 1.2, YP + 0.48, YP + 0.95, sd * 9.68 - 0.04, sd * 9.68 + 0.04, col); for (const q of [-1, 1]) M.bx(t + q * 1.0 - 0.04, t + q * 1.0 + 0.04, YP, YP + 0.4, sd * 9.4 - 0.2, sd * 9.4 + 0.2, DARK); cols2.push(box(t - 1.2, t + 1.2, sd * 9.4 - 0.3, sd * 9.4 + 0.3, YP - 0.3, YP + 0.5)); }
      // 樓梯（大廳 → 月台）：36 階＋旁邊往上的電扶梯
      M.stairs(RAMP.u0, RAMP.u1, YC, YP, Math.min(r0, r1), Math.max(r0, r1), 36, TILE2, CONC);
      M.slopeY(RAMP.u0, RAMP.u1, Math.min(r0, h1), Math.max(r0, h1), YC - 0.45, YP - 0.45, CONC, false); // 樓梯、電扶梯的底
      M.slopeY(RAMP.u0, RAMP.u1, Math.min(r1, e0), Math.max(r1, e0), YC + 0.02, YP + 0.02, CONC, true); // 中間的分隔
      M.slopeY(RAMP.u0, RAMP.u1, Math.min(e1, h1), Math.max(e1, h1), YC + 0.02, YP + 0.02, CONC, true);
      escal(M, G, S, RAMP.u0, RAMP.u1, YC, YP, Math.min(e0, e1), Math.max(e0, e1));
      for (const rv of [r0, h1]) { G.slopeV(rv, RAMP.u0, RAMP.u1, YC, YP, 1.05, GLS, rv > 0); M.bx(RAMP.u0, RAMP.u1 + 0.001, YC + 1.05, YC + 1.12, rv - 0.03, rv + 0.03, STEEL, ['py', 'ny']); }
      for (const rv of [r0, h1]) { G.vqV(rv, RAMP.u0, RAMP.u1, YP, YP + 1.05, GLS, rv > 0); M.bx(RAMP.u0, RAMP.u1, YP + 1.05, YP + 1.12, rv - 0.03, rv + 0.03, STEEL); cols2.push(box(RAMP.u0, RAMP.u1, rv - 0.05, rv + 0.05, YP - 0.3, YP + 1.2)); cols1.push(box(RAMP.u0, RAMP.u1, rv - 0.05, rv + 0.05, null, YP + 1.2)); }
      G.vqU(RAMP.u0, Math.min(r0, h1), Math.max(r0, h1), YP, YP + 1.05, GLS, true); M.bx(RAMP.u0 - 0.03, RAMP.u0 + 0.03, YP + 1.05, YP + 1.12, Math.min(r0, h1), Math.max(r0, h1), STEEL);
      cols2.push(box(RAMP.u0 - 0.05, RAMP.u0 + 0.05, r0, h1, YP - 0.3, YP + 1.2)); // 洞的低的那一頭
      // 月台的燈（天花板兩條）
      for (const lv of [5.5, 8.4]) LI.hq(-PL + 1, PL - 1, sd * lv - 0.15, sd * lv + 0.15, CEIL2 - 0.02, [1, 1, 1], false);
    }
    // 屋頂（第 80 批：斜的，有稜有角）：天花板白；上面兩片斜的屋頂（中間高）、兩頭斜下來、屋簷切角
    { const EV = PV1 + 1.4, EU = PL + 1.6, RG = ROOF + 2.2, RU = PL - 2.0;
      M.bx(-EU + 0.4, EU - 0.4, CEIL2, ROOF, -(PV1 + 0.4), PV1 + 0.4, CONC, null, { ny: WHITE, py: ROOFC });
      for (const q of [-1, 1]) { M.quad([-EU, ROOF, q * EV], [EU, ROOF, q * EV], [RU, RG, 0], [-RU, RG, 0], ROOFC); // 長的兩片（梯形）
        M.tri([q * EU, ROOF, -EV], [q * EU, ROOF, EV], [q * RU, RG, 0], ROOFC); } // 兩頭的三角形
      for (const q of [-1, 1]) { M.quad([-EU, ROOF, q * EV], [EU, ROOF, q * EV], [EU - 0.5, ROOF - 0.55, q * (EV - 0.7)], [-EU + 0.5, ROOF - 0.55, q * (EV - 0.7)], BROWN); // 屋簷下面斜的咖啡色
        M.quad([q * EU, ROOF, -EV], [q * EU, ROOF, EV], [q * (EU - 0.5), ROOF - 0.55, EV - 0.7], [q * (EU - 0.5), ROOF - 0.55, -(EV - 0.7)], BROWN); }
      for (let t = -PL + 3; t <= PL - 3 + 0.01; t += 6) for (const q of [-1, 1]) M.quad([t - 0.05, YP - 0.6, q * (PV1 + 0.12)], [t + 0.05, YP - 0.6, q * (PV1 + 0.12)], [t + 0.75, ROOF - 0.5, q * (PV1 + 0.9)], [t + 0.65, ROOF - 0.5, q * (PV1 + 0.9)], WHITE); } // 外面斜的白色鰭片
    for (let t = -PL + 6; t <= PL - 6; t += 12) M.bx(t - 0.25, t + 0.25, CEIL2 - 0.5, CEIL2, -PV1 - 0.6, PV1 + 0.6, ORA); // 橫樑
    // 軌道旁邊（月台門裡面）：兩條軌道的導軌墩（深色）
    for (const tv of [-TRK_V, TRK_V]) for (const q of [-1.05, 1.05]) M.bx(-PL, PL, YT, YT + 0.12, tv + q - 0.22, tv + q + 0.22, DARK, ['py', 'pv', 'nv']);
    // ==== 大廳層 ====
    M.bx(-CU, CU, YC - 0.5, YC, -CV, CV, CONC, null, { py: TILE2 });
    for (const [u0, u1, v0, v1] of [[-CU, 2, -CV, CV], [2, RAMP.u1, -RAMP.v0, RAMP.v0], [2, RAMP.u1, HOLE1, CV], [2, RAMP.u1, -CV, -HOLE1], [RAMP.u1, CU, -CV, CV]]) M.bx(u0, u1, CEIL1, CEIL1 + 0.2, v0, v1, WHITE, null, { py: CONC }); // 天花板（樓梯穿過去的地方挖掉）
    for (let k = 0; k < 11; k++) { const t0 = -CU + k * 4; M.hq(t0 + 0.1, t0 + 3.9, -1.2, 1.2, YC + 0.004, k % 2 ? [0.78, 0.72, 0.62] : [0.86, 0.82, 0.74], true); } M.hq(-CU, CU, -1.35, -1.2, YC + 0.005, BROWN, true); M.hq(-CU, CU, 1.2, 1.35, YC + 0.005, BROWN, true); // 第 80 批：大廳中間一條米色的走道、兩邊咖啡色
    decWall(-CU + 0.12, YC + 2.0, 0, 8.0, 1.56, DEC.map, 'pu'); decWall(CU - 0.12, YC + 2.0, 0, 8.0, 1.56, DEC.map, 'nu'); // 大廳兩頭的牆：大的路線圖
    for (const [t, q, k] of [[-6, 1, 0], [-2.5, 1, 1], [-6, -1, 2], [-2.5, -1, 3]]) decWall(t, YC + 1.7, q * (CV - 0.14), 1.4, 2.0, DEC.ads[k], q > 0 ? 'nv' : 'pv'); // 海報
    LI.hq(-CU + 2, CU - 2, -0.15, 0.15, CEIL1 - 0.02, [1, 1, 1], false); for (const t of [-14, 14]) LI.hq(t - 0.15, t + 0.15, -CV + 1, CV - 1, CEIL1 - 0.02, [1, 1, 1], false);
    // 四周的牆：下面白板、上面玻璃；天橋接進來的地方開口
    const wallV = (sd) => { const v = sd * CV, gaps = S.ent.filter((e) => e.s === sd).map((e) => [e.bu0, e.bu1]).sort((p, q) => p[0] - q[0]); let u = -CU; for (const [g0, g1] of gaps) { if (g0 > u) { M.bx(u, g0, YC, YC + 0.6, v - 0.08, v + 0.08, WALL); G.vqV(v, u, g0, YC + 0.6, CEIL1, GLS, sd > 0); cols1.push(box(u, g0, v - 0.1, v + 0.1, YC - 0.3, CEIL1)); } M.bx(g0 - 0.1, g0, YC, CEIL1, v - 0.1, v + 0.1, WHITE); M.bx(g1, g1 + 0.1, YC, CEIL1, v - 0.1, v + 0.1, WHITE); u = g1; } if (u < CU) { M.bx(u, CU, YC, YC + 0.6, v - 0.08, v + 0.08, WALL); G.vqV(v, u, CU, YC + 0.6, CEIL1, GLS, sd > 0); cols1.push(box(u, CU, v - 0.1, v + 0.1, YC - 0.3, CEIL1)); } for (let t = -CU; t <= CU + 0.01; t += 5.5) if (!gaps.some(([g0, g1]) => t > g0 - 0.2 && t < g1 + 0.2)) M.bx(t - 0.08, t + 0.08, YC, CEIL1, v - 0.1, v + 0.1, WHITE); };
    wallV(1); wallV(-1);
    for (const su of [-1, 1]) { const u = su * CU; M.bx(u - 0.08, u + 0.08, YC, YC + 0.6, -CV, CV, WALL); G.vqU(u, -CV, CV, YC + 0.6, CEIL1, GLS, su < 0); cols1.push(box(u - 0.1, u + 0.1, -CV, CV, YC - 0.3, CEIL1)); for (let t = -CV; t <= CV + 0.01; t += 6) M.bx(u - 0.1, u + 0.1, YC, CEIL1, t - 0.08, t + 0.08, WHITE); }
    // 閘門（每排 9 個機身、8 個 0.65 的口，兩頭欄杆到牆）
    for (const GU of S.gates) { const n = 9, bw = 1.0, pw = 0.65, span = n * bw + (n - 1) * pw, v0 = -span / 2;
      for (let i = 0; i < n; i++) { const a = v0 + i * (bw + pw), b = a + bw; M.bx(GU - 0.2, GU + 0.2, YC, YC + 1.0, a, b, STEEL, null, { py: ALU }); M.hq(GU - 0.12, GU + 0.12, a + 0.3, a + 0.7, YC + 1.004, GREEN, true); cols1.push(box(GU - 0.22, GU + 0.22, a, b, YC - 0.3, YC + 1.1)); if (i < n - 1) { M.bx(GU - 0.02, GU + 0.02, YC + 0.45, YC + 0.95, b, b + pw, [0.6, 0.78, 0.86], ['pu', 'nu']); } }
      for (const sd of [-1, 1]) { const a = sd * span / 2, b = sd * CV; G.vqU(GU, Math.min(a, b), Math.max(a, b), YC, YC + 1.15, GLS, true); M.bx(GU - 0.03, GU + 0.03, YC + 1.15, YC + 1.22, Math.min(a, b), Math.max(a, b), STEEL); cols1.push(box(GU - 0.05, GU + 0.05, a, b, YC - 0.3, YC + 1.3)); }
      S.gatePass = []; for (let i = 0; i < n - 1; i++) S.gatePass.push(v0 + i * (bw + pw) + bw + pw / 2); }
    // 詢問處（櫃台）、售票機、柱子
    M.bx(-12.5, -10, YC, YC + 1.1, -CV + 0.4, -CV + 1.9, [0.55, 0.42, 0.30], null, { py: ALU }); cols1.push(box(-12.5, -10, -CV + 0.4, -CV + 1.9, YC - 0.3, YC + 1.2)); // 第 80 批：搬到翼的旁邊（不擋路）
    for (const t of [-12.5, -11.5, -10.5]) { M.bx(t - 0.4, t + 0.4, YC, YC + 1.8, CV - 1.0, CV - 0.3, [0.26, 0.36, 0.60], null, { nv: [0.75, 0.80, 0.86] }); cols1.push(box(t - 0.4, t + 0.4, CV - 1.0, CV - 0.3, YC - 0.3, YC + 1.9)); }
    for (const t of [-14, 14]) for (const q of [-3, 3]) { M.bx(t - 0.2, t + 0.2, YC, CEIL1, q - 0.2, q + 0.2, ORA); cols1.push(box(t - 0.2, t + 0.2, q - 0.2, q + 0.2, YC - 0.3, CEIL1)); }
    // ==== 第 80 批：通到出入口的翼（6 公尺寬、有牆有屋頂的房子，橫過內湖路兩邊的人行道）＋出入口（樓梯＋往上的電扶梯，斜的屋頂）====
    for (const e of S.ent) {
      const sd = e.s, dr = e.dir, vIn = sd * CV, vOut = e.v0, b0 = e.bu0, b1 = e.bu1, lo = Math.min(vIn, vOut), hi = Math.max(vIn, vOut);
      const R2 = (a, b) => [Math.min(a, b), Math.max(a, b)];
      // 翼：地板、下面鋁板＋上面玻璃的牆、斜的屋頂（中間高）、柱子
      M.bx(b0, b1, YC - 0.4, YC, lo, hi, CONC, null, { py: TILE2 }); M.hq(b0 + 0.6, b1 - 0.6, lo, hi, YC + 0.004, [0.84, 0.80, 0.72], true); M.hq((b0 + b1) / 2 - 0.08, (b0 + b1) / 2 + 0.08, lo, hi, YC + 0.005, BROWN, true);
      for (const uu of [b0, b1]) { M.bx(uu - 0.06, uu + 0.06, YC, YC + 1.0, lo, hi, ALU); G.vqU(uu, lo, hi, YC + 1.0, YC + 3.2, GLS, uu === b0); M.bx(uu - 0.08, uu + 0.08, YC + 3.2, YC + 3.35, lo, hi, BROWN); cols1.push(box(uu - 0.08, uu + 0.08, lo, hi, YC - 0.3, YC + 3.3)); }
      { const um = (b0 + b1) / 2, ey = YC + 3.35, ry = YC + 4.5; for (const [ea, eb] of [[b0 - 0.5, um], [b1 + 0.5, um]]) M.quad([ea, ey, lo], [ea, ey, hi], [eb, ry, hi], [eb, ry, lo], ROOFC); M.hq(b0, b1, lo, hi, YC + 3.3, WHITE, false);
        for (const vv of [lo, hi]) M.tri([b0 - 0.5, ey, vv], [b1 + 0.5, ey, vv], [um, ry, vv], ROOFC); }
      for (let vv = lo + 0.2; vv <= hi - 0.19; vv += Math.max(2, (hi - lo - 0.4) / Math.max(1, Math.round((hi - lo) / 5)))) for (const uu of [b0, b1]) M.bx(uu - 0.09, uu + 0.09, YC, YC + 3.2, vv - 0.09, vv + 0.09, WHITE);
      for (const vv of [lo + (hi - lo) * 0.33, lo + (hi - lo) * 0.67]) LI.hq((b0 + b1) / 2 - 1.2, (b0 + b1) / 2 + 1.2, vv - 0.12, vv + 0.12, YC + 3.28, [1, 1, 1], false);
      { const um = (b0 + b1) / 2; for (const vm of [lo + (hi - lo) * 0.35, lo + (hi - lo) * 0.7]) { const [cx, cz] = toW(um, vm); if (Math.abs(vOut - vIn) > 4 && !onRoad(cx, cz, 0.8)) { M.prism(um, vm, 0.4, 0, YC - 0.4, CONC); colliders0.push(box(um - 0.4, um + 0.4, vm - 0.4, vm + 0.4, null, YC - 0.4)); } } }
      // 出入口：平台（u0…uS）在 YC、樓梯 uS…u1 下到 0；樓梯在靠翼的那一邊（ST），往上的電扶梯在外面那一邊（ES）
      const va = Math.min(e.v0, e.v1), vb = Math.max(e.v0, e.v1), [p0, p1] = R2(e.u0, e.uS), [s0, s1] = R2(e.uS, e.u1), yAt = (u) => YC * (1 - (u - e.uS) / (e.u1 - e.uS));
      const ST = R2(e.v0, e.v0 + sd * 2.6), ES = R2(e.v0 + sd * 2.95, e.v0 + sd * 4.45), DV = R2(e.v0 + sd * 2.6, e.v0 + sd * 2.95);
      M.bx(p0, p1, YC - 0.4, YC, va, vb, CONC, null, { py: TILE2 });
      M.stairs(e.uS, e.u1, YC, 0, ST[0], ST[1], 35, TILE2, CONC);
      M.slopeY(s0, s1, va, vb, yAt(s0) - 0.4, yAt(s1) - 0.4, CONC, false); // 樓梯的底（斜的）
      M.slopeY(s0, s1, DV[0], DV[1], yAt(s0) + 0.02, yAt(s1) + 0.02, CONC, true); // 中間的分隔
      M.slopeY(s0, s1, ES[1], vb, yAt(s0) + 0.02, yAt(s1) + 0.02, CONC, true);
      escal(M, G, S, e.u1, e.uS, 0, YC, ES[0], ES[1]);
      // 盒子：下面鋁板、上面玻璃；屋頂斜的（平台上面 HT，樓梯上面斜下來到門口 RD）
      const HT = YC + 3.4, RD = 6.2, roofAt = (u) => { const f = clamp((u - e.uS) / (e.u1 - e.uS), 0, 1); return HT + (RD - HT) * f; }, bridgeSide = (vv) => Math.abs(vv - e.v0) < 1e-6, og = (vv) => vv + (vv > (va + vb) / 2 ? 0.03 : -0.03);
      e.roofAt = roofAt;
      for (const vv of [va, vb]) { const pos = vv > 0;
        M.slopeV(vv, s0, s1, yAt(s0), yAt(s1), 1.1, ALU, pos); // 樓梯旁邊斜的鋁板
        const ra = roofAt(s0), rb = roofAt(s1), ya = yAt(s0) + 1.1, yb = yAt(s1) + 1.1, ov = og(vv); G.quad(pos ? [s0, ya, ov] : [s1, yb, ov], pos ? [s1, yb, ov] : [s0, ya, ov], pos ? [s1, rb, ov] : [s0, ra, ov], pos ? [s0, ra, ov] : [s1, rb, ov], GLS); // 玻璃到斜的屋頂
        if (!bridgeSide(vv)) { M.bx(p0, p1, YC, YC + 1.1, vv - 0.06, vv + 0.06, ALU); G.vqV(og(vv), p0, p1, YC + 1.1, HT, GLS, pos); }
        for (let k = 0; k <= 4; k++) { const uu = s0 + ((s1 - s0) * k) / 4; M.bx(uu - 0.07, uu + 0.07, Math.max(0, yAt(uu) - 0.4), roofAt(uu), vv - 0.08, vv + 0.08, WHITE); } } // 斜的白色框
      M.bx(...R2(e.u0, e.u0 - 0.1 * dr), YC, YC + 1.1, va, vb, ALU); G.vqU(e.u0 - 0.05 * dr, va, vb, YC + 1.1, HT, GLS, dr < 0); // 平台外面那一頭
      G.vqU(e.u1 + 0.05 * dr, va, vb, 2.7, RD, GLS, dr > 0); // 門口上面的玻璃
      { const ea = e.u0 - 0.4 * dr, eb = e.u1 + 0.4 * dr, yE = RD + 0.2 - 0.4 * ((HT - RD) / Math.abs(e.u1 - e.uS)); // 屋頂：平台那一段平的、樓梯那一段斜的（往外凸 0.4，切角的邊）
        M.bx(...R2(ea, e.uS), HT, HT + 0.2, va - 0.35, vb + 0.35, ROOFC, null, { ny: WHITE });
        for (const [y0, y1, col, up] of [[HT + 0.2, yE, ROOFC, true], [HT, yE - 0.2, WHITE, false]]) M.slopeY(...(dr > 0 ? [e.uS, eb] : [eb, e.uS]), va - 0.35, vb + 0.35, ...(dr > 0 ? [y0, y1] : [y1, y0]), col, up);
        for (const vv of [va - 0.35, vb + 0.35]) M.slopeV(vv, ...(dr > 0 ? [e.uS, eb] : [eb, e.uS]), ...(dr > 0 ? [HT, yE - 0.2] : [yE - 0.2, HT]), 0.2, BROWN, vv > 0); }
      M.bx(...R2(e.u1, e.u1 + 1.8 * dr), 2.5, 2.7, va - 0.3, vb + 0.3, BROWN, null, { ny: WHITE }); // 門口外面的罩子（咖啡色）
      for (const vv of [va - 0.15, vb + 0.15]) M.prism(e.u1 + 1.5 * dr, vv, 0.11, 0, 2.5, ALU); // 門口的柱子
      M.bx(...R2(e.u0 - 0.1 * dr, e.u0 + 0.9 * dr), 0, 0.5, va - 0.3, vb + 0.3, [0.66, 0.64, 0.60]); // 花崗岩的台座
      M.bx(p0 - 0.1, p1 + 0.1, 0.5, YC - 0.4, va - 0.1, vb + 0.1, ALU); // 平台下面包起來
      for (const vv of [va, vb]) { const c = box(...R2(e.uS, e.u1), vv - 0.1, vv + 0.1, null, HT); colliders0.push(c); cols1.push(c);
        if (!bridgeSide(vv)) { const c2 = box(...R2(e.u0 - 0.1 * dr, e.uS), vv - 0.1, vv + 0.1, null, HT); colliders0.push(c2); cols1.push(c2); } }
      { const c = box(...R2(e.u0 - 0.15 * dr, e.u0), va, vb, null, HT); colliders0.push(c); cols1.push(c); }
      { const c = box(...R2(e.uS, e.u1), DV[0], DV[1], null, YC + 1.0); colliders0.push(c); cols1.push(c); } // 樓梯和電扶梯中間（不會從旁邊跳上去）
      for (const vv of [va - 0.15, vb + 0.15]) colliders0.push(box(...R2(e.u1 + 1.4 * dr, e.u1 + 1.6 * dr), vv - 0.12, vv + 0.12, null, 2.5));
      e.sign = { u: e.u1 + 1.82 * dr, v: (va + vb) / 2, y: 2.2, w: 3.6, h: 0.6, face: dr > 0 ? 'pu' : 'nu' };
      decWall(e.u1 + 0.02 * dr, 1.6, (ES[0] + ES[1]) / 2, 1.0, 0.5, DEC.escSign, dr > 0 ? 'pu' : 'nu'); // 電扶梯口的牌子
    }
    // ==== 柱子（街上）：月台邊 ±8.6、中間 0；車道上不放 ====
    for (const t of [-27, -16, -5, 6, 17, 27]) for (const vv of [-(PV1 + 0.8), PV1 + 0.8]) { const [x, z] = toW(t, vv); if (onRoad(x, z, 0.6)) continue; M.prism(t, vv, 0.5, 0, YP - 0.6, CONC); colliders0.push(box(t - 0.5, t + 0.5, vv - 0.5, vv + 0.5, null, YP - 0.6)); }
    for (const t of [-21, -10, 10, 21]) { const [x, z] = toW(t, 0); if (onRoad(x, z, 0.6)) continue; M.prism(t, 0, 0.45, 0, YC - 0.5, CONC); colliders0.push(box(t - 0.45, t + 0.45, -0.45, 0.45, null, YC - 0.5)); }
    // 大廳的底、月台底下的樑
    M.hq(-CU, CU, -CV, CV, YC - 0.5, [0.6, 0.6, 0.58], false);
    // ==== 字：一張圖（站名、出口、大廳的牌子、往哪裡的月台）====
    const cv = mkCanvas(1024, 512), g = cv.getContext('2d');
    const rows = []; let ry = 0;
    const row = (h, draw) => { const r = { y: ry, h }; draw(r); rows.push(r); ry += h; return r; };
    const uvOf = (r, x0 = 0, x1 = 1024) => [x0 / 1024, 1 - (r.y + r.h) / 512, x1 / 1024, 1 - r.y / 512];
    const R = {};
    R.name = row(150, (r) => { g.fillStyle = '#f4f4f0'; g.fillRect(0, r.y, 1024, r.h); g.fillStyle = '#8a5a2b'; g.fillRect(0, r.y, 1024, 14); g.fillRect(0, r.y + r.h - 14, 1024, 14); g.fillStyle = '#1b1c1e'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${fit(g, S.nm, 96, 500)}px ${SANS}`; g.fillText(S.nm, 380, r.y + 76); g.font = `600 46px ${SANS}`; g.fillText(S.en, 760, r.y + 76); });
    R.hall = row(90, (r) => { g.fillStyle = '#8a5a2b'; g.fillRect(0, r.y, 1024, r.h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 60px ${SANS}`; g.fillText(`${S.nm}站`, 300, r.y + 45); g.font = `600 34px ${SANS}`; g.fillText(`${S.en} Station`, 760, r.y + 45); });
    const exitRow = (n) => row(80, (r) => { g.fillStyle = '#1f2326'; g.fillRect(0, r.y, 1024, r.h); g.fillStyle = '#8a5a2b'; g.fillRect(0, r.y, 110, r.h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 44px ${SANS}`; g.fillText('捷運', 55, r.y + 40); g.font = `700 48px ${SANS}`; g.textAlign = 'left'; g.fillText(`${S.nm}站　出口 ${n}`, 140, r.y + 40); g.textAlign = 'right'; g.font = `600 30px ${SANS}`; g.fillText(`${S.en} Exit ${n}`, 1000, r.y + 40); });
    R.exit = [exitRow(1), exitRow(2)];
    const wayRow = (dir) => row(80, (r) => { g.fillStyle = '#1f2326'; g.fillRect(0, r.y, 1024, r.h); g.fillStyle = '#8a5a2b'; g.fillRect(0, r.y, 1024, 8); g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `700 50px ${SANS}`; g.fillText(`↑ ${dirLabel(si, dir)} 月台`, 40, r.y + 44); g.textAlign = 'right'; g.font = `600 28px ${SANS}`; g.fillText('文湖線 Wenhu Line', 990, r.y + 44); });
    R.way = { 1: wayRow(1), [-1]: wayRow(-1) };
    const tex = texOf(cv), SM = mesher();
    const plate = (u, y, v, w, h, uv, facing) => { // facing：'pv' 'nv' 'pu' 'nu'（朝哪邊）
      const [a0, b0, a1, b1] = uv, hw = w / 2, hh = h / 2, P4 = facing === 'pv' ? [[u - hw, y - hh, v], [u + hw, y - hh, v], [u + hw, y + hh, v], [u - hw, y + hh, v]] : facing === 'nv' ? [[u + hw, y - hh, v], [u - hw, y - hh, v], [u - hw, y + hh, v], [u + hw, y + hh, v]] : facing === 'pu' ? [[u, y - hh, v + hw], [u, y - hh, v - hw], [u, y + hh, v - hw], [u, y + hh, v + hw]] : [[u, y - hh, v - hw], [u, y - hh, v + hw], [u, y + hh, v + hw], [u, y + hh, v - hw]];
      const k = SM.quad(P4[0], P4[1], P4[2], P4[3], [1, 1, 1]); return k;
    };
    const uvs = [];
    const plateUV = (u, y, v, w, h, uv, facing) => { plate(u, y, v, w, h, uv, facing); uvs.push([uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]); };
    for (const sd of [-1, 1]) plateUV(0, YP + 2.9, sd * (PV1 + 0.12), 9.6, 1.4, uvOf(R.name), sd > 0 ? 'pv' : 'nv'); // 站名：月台後面的牆外面
    for (const GU of S.gates) plateUV(GU + (GU < 0 ? 0.6 : -0.6), YC + 2.4, 0, 8.0, 0.7, uvOf(R.hall), GU < 0 ? 'nu' : 'pu'); // 大廳：閘門上面（從出入口走進來看得到）
    for (const sd of [-1, 1]) { plateUV(RAMP.u0 - 0.6, YC + 2.3, sd * 5.5, 4.4, 0.35, uvOf(R.way[sd]), 'nu'); if (S.gates.length > 1) plateUV(RAMP.u1 + 1.5, YC + 2.3, sd * 5.5, 4.4, 0.35, uvOf(R.way[sd]), 'pu'); } // 樓梯口上面：往哪裡的月台
    for (const e of S.ent) plateUV(e.sign.u, e.sign.y, e.sign.v, e.sign.w, e.sign.h, uvOf(R.exit[e.n - 1]), e.sign.face);
    const sgeo = SM.geometry(); sgeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
    addMesh(sgeo, signMat(tex), sg, 'mrt-signs');
    { const dt = texOf(dcv), dm = new THREE.MeshStandardMaterial({ map: dt, emissive: 0xffffff, emissiveMap: dt, emissiveIntensity: 0.1, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide }); // 第 80 批：路線圖、海報、地上的線
      const g2 = DCM.geometry(); g2.setAttribute('uv', new THREE.Float32BufferAttribute(dcuv.flat(), 2)); addMesh(g2, dm, sg, 'mrt-deco'); mats['deco' + si] = dm; }
    // 月台的看板（會變：下一班幾秒）：一張 512×128，上半＝+v 那邊、下半＝−v 那邊
    const dc = mkCanvas(512, 128), dg = dc.getContext('2d'), dtex = texOf(dc), DM = mesher(), duv = [];
    for (const sd of [-1, 1]) { const uv = sd > 0 ? [0, 0.5, 1, 1] : [0, 0, 1, 0.5]; for (const f of ['pu', 'nu']) { const P4 = f === 'pu' ? [[14, YP + 2.3, sd * 5.5 + 1.6], [14, YP + 2.3, sd * 5.5 - 1.6], [14, YP + 3.1, sd * 5.5 - 1.6], [14, YP + 3.1, sd * 5.5 + 1.6]] : [[14, YP + 2.3, sd * 5.5 - 1.6], [14, YP + 2.3, sd * 5.5 + 1.6], [14, YP + 3.1, sd * 5.5 + 1.6], [14, YP + 3.1, sd * 5.5 - 1.6]]; DM.quad(P4[0], P4[1], P4[2], P4[3], [1, 1, 1]); duv.push([uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]); } M.bx(13.97, 14.03, YP + 3.1, CEIL2, sd * 5.5 - 0.04, sd * 5.5 + 0.04, STEEL); }
    const dgeo = DM.geometry(); dgeo.setAttribute('uv', new THREE.Float32BufferAttribute(duv.flat(), 2));
    addMesh(dgeo, signMat(dtex), sg, 'mrt-board');
    S.board = { cv: dc, g: dg, tex: dtex, txt: ['', ''] };
    addMesh(M.geometry(), mats.wall, sg, 'mrt-walls'); addMesh(G.geometry(), mats.glass, sg, 'mrt-glass'); addMesh(LI.geometry(), mats.light, sg, 'mrt-lights');
    S.toW = toW; S.loc = (x, z) => { const dx = x - S.x, dz = z - S.z; return [dx * ux + dz * uz, dx * vx + dz * vz]; }; S.rot = rot;
    S.psd = []; for (const sd of [-1, 1]) for (const d of DOOR_U) S.psd.push({ sd, u: d, v: sd * PV0 }); // 月台門（門片兩片：另外的 InstancedMesh）
  }
  V.colliders.push(...colliders0);

  // ==== 月台門的門片（兩站 × 兩邊 × 8 個口 × 2 片）====
  const leafGeo = (() => { const Lm = mesher(); Lm.bx(-0.475, 0.475, 0, 2.2, -0.03, 0.03, WHITE, null, { pv: GLSD, nv: GLSD }); Lm.bx(-0.475, 0.475, 0, 0.5, -0.035, 0.035, WHITE); Lm.bx(-0.475, -0.40, 0, 2.2, -0.035, 0.035, WHITE); Lm.bx(0.40, 0.475, 0, 2.2, -0.035, 0.035, WHITE); return Lm.geometry(); })();
  const psdList = []; for (const S of stations) for (const d of S.psd) for (const q of [-1, 1]) psdList.push({ S, d, q });
  const psdIM = new THREE.InstancedMesh(leafGeo, mats.leaf, psdList.length); psdIM.name = 'mrt-psd'; psdIM.frustumCulled = false; group.add(psdIM); meshes++; tris += (leafGeo.index.count / 3) * psdList.length;
  // ==== 第 80 批：電扶梯會動的階梯（全部的電扶梯一組 InstancedMesh）====
  const stepGeo = (() => { const Sm = mesher(); Sm.bx(-STEP_D / 2 + 0.01, STEP_D / 2 - 0.01, -0.24, 0, -0.5, 0.5, [0.32, 0.33, 0.35], null, { py: [0.40, 0.41, 0.43] }); for (const q of [-1, 1]) Sm.hq(-STEP_D / 2 + 0.01, STEP_D / 2 - 0.01, q * 0.5 - q * 0.06 - 0.03, q * 0.5 - q * 0.06 + 0.03, 0.002, YEL, true); Sm.hq(STEP_D / 2 - 0.06, STEP_D / 2 - 0.01, -0.5, 0.5, 0.003, YEL, true); return Sm.geometry(); })();
  for (const e of ESCS) { e.L = Math.abs(e.ub - e.ua); e.n = Math.floor(e.L / STEP_D); }
  const nSteps = ESCS.reduce((a, e) => a + e.n, 0);
  const stepIM = new THREE.InstancedMesh(stepGeo, mats.wall, Math.max(1, nSteps)); stepIM.name = 'mrt-esc-steps'; stepIM.frustumCulled = false; group.add(stepIM); meshes++; tris += (stepGeo.index.count / 3) * nSteps;
  const SSC = new THREE.Vector3();
  function drawSteps() {
    let i = 0; const o = (time * ESC_V) % STEP_D;
    for (const e of ESCS) { const sg = Math.sign(e.ub - e.ua); Q4.setFromAxisAngle(YAX, e.S.rot); SSC.set(sg, 1, e.w - 0.16);
      for (let k = 0; k < e.n; k++) { const d = Math.min(e.L, k * STEP_D + o + STEP_D / 2), u = e.ua + sg * d, y = e.ya + ((e.yb - e.ya) * d) / e.L, [x, z] = e.S.toW(u, e.vc); V3.set(x, y, z); M4.compose(V3, Q4, SSC); stepIM.setMatrixAt(i++, M4); } }
    stepIM.count = i; stepIM.instanceMatrix.needsUpdate = true;
  }
  // ==== 列車：一節車廂的幾何（本地：x 往前、y 從橋面起、z 左右）====
  // 第 80 批（Nick「請上網查捷運的圖片 捷運太假了」）：照文湖線的車子（膠輪、4 節、無人駕駛）：淺灰的車身、綠色的帶子、黑色的窗帶、大窗、
  //   兩頭的車頭（斜的大擋風玻璃、圓的車燈；另外一組 InstancedMesh）、裡面藍色的長椅子、扶手的柱子和橫桿、深色的地板、車門上面的路線圖
  const F0 = 1.1, YS0 = F0 + 0.72, YS1 = F0 + 0.84, YW0 = F0 + 0.92, YW1 = F0 + 2.32, YTT = F0 + 2.5, YDOOR = F0 + 1.9, CX = 6.9;
  const WIN = [[-6.6, -4.45], [-2.8, -0.2], [0.2, 2.8], [4.45, 6.6]];
  const carGeo = (() => {
    const C = mesher(), hw = CAR_W, f0 = F0, hb = f0 + CAR_H, ROOFL = [0.90, 0.91, 0.92];
    C.bx(-CX, CX, 0.55, f0, -1.15, 1.15, DARK); // 底架
    for (const bx0 of [-4.6, 4.6]) { C.bx(bx0 - 1.1, bx0 + 1.1, 0.2, 0.6, -1.0, 1.0, [0.16, 0.17, 0.18]); for (const q of [-1, 1]) for (const w of [-0.75, 0.75]) C.bx(bx0 + w - 0.3, bx0 + w + 0.3, 0, 0.95, q * 0.95 - 0.16, q * 0.95 + 0.16, [0.1, 0.1, 0.1]); }
    const pieces = [[-CX, -6.6, 's'], [-6.6, -4.45, 'w'], [-4.45, -DOOR_X - DOOR_W / 2, 's'], [-DOOR_X - DOOR_W / 2, -DOOR_X + DOOR_W / 2, 'd'], [-DOOR_X + DOOR_W / 2, -2.8, 's'], [-2.8, -0.2, 'w'], [-0.2, 0.2, 's'], [0.2, 2.8, 'w'], [2.8, DOOR_X - DOOR_W / 2, 's'], [DOOR_X - DOOR_W / 2, DOOR_X + DOOR_W / 2, 'd'], [DOOR_X + DOOR_W / 2, 4.45, 's'], [4.45, 6.6, 'w'], [6.6, CX, 's']];
    for (const q of [-1, 1]) { const z = q * hw, pos = q > 0;
      const V2 = (x0, x1, a, b, col) => C.vqV(z, x0, x1, a, b, col, pos);
      for (const [x0, x1, k] of pieces) {
        if (k === 'd') { V2(x0, x1, YDOOR, YW1, WBAND); V2(x0, x1, YW1, YTT, LGRY); continue; }
        V2(x0, x1, f0, YS0, LGRY); V2(x0, x1, YS0, YS1, TGRN); V2(x0, x1, YS1, YW0, LGRY); if (k === 's') V2(x0, x1, YW0, YW1, WBAND); V2(x0, x1, YW1, YTT, LGRY);
      }
      C.quad(pos ? [-CX, YTT, z] : [CX, YTT, z], pos ? [CX, YTT, z] : [-CX, YTT, z], pos ? [CX, hb, q * 0.9] : [-CX, hb, q * 0.9], pos ? [-CX, hb, q * 0.9] : [CX, hb, q * 0.9], ROOFL); // 車頂的斜面（切角）
      for (const [x0, x1] of [[-6.6, -4.45], [-2.8, 2.8], [4.45, 6.6]]) { C.bx(x0, x1, f0, f0 + 0.45, Math.min(q * 0.8, q * 1.2), Math.max(q * 0.8, q * 1.2), SEAT); C.bx(x0, x1, f0 + 0.45, f0 + 1.08, Math.min(q * 1.12, q * 1.2), Math.max(q * 1.12, q * 1.2), NAVY); } // 藍色的長椅子（面對面）
      for (const x of [-4.45, -2.8, 2.8, 4.45]) C.bx(x - 0.03, x + 0.03, f0, f0 + 2.3, q * 0.76 - 0.03, q * 0.76 + 0.03, STEEL); // 扶手的柱子
      C.bx(-6.6, 6.6, f0 + 2.0, f0 + 2.04, q * 0.6 - 0.02, q * 0.6 + 0.02, STEEL); // 上面的橫桿
    }
    C.hq(-CX, CX, -0.9, 0.9, hb, ROOFL, true); // 車頂
    C.hq(-CX, CX, -hw, hw, f0 + 0.01, [0.30, 0.32, 0.36], true); C.hq(-CX, CX, -0.35, 0.35, f0 + 0.012, [0.38, 0.40, 0.44], true); C.hq(-CX, CX, -hw, hw, f0 + 2.3, WHITE, false); // 地板（中間淺一點）、天花板
    for (const q of [-1, 1]) C.hq(-6.6, 6.6, q * 0.45 - 0.1, q * 0.45 + 0.1, f0 + 2.29, [1, 1, 0.95], false); // 車裡的燈
    for (const q of [-1, 1]) { const x = q * CX, neg = q < 0; // 兩頭（車廂中間的走道門：深色）
      C.vqU(x, -hw, -0.5, f0, YTT, LGRY, neg); C.vqU(x, 0.5, hw, f0, YTT, LGRY, neg); C.vqU(x, -0.5, 0.5, f0 + 2.0, YTT, LGRY, neg); C.vqU(x, -0.5, 0.5, f0, f0 + 2.0, [0.2, 0.22, 0.25], neg);
      C.vqU(x, -hw, hw, YTT, hb, ROOFL, neg); }
    return C.geometry();
  })();
  const noseGeo = (() => { // 車頭（放在最前面、最後面那一節的外面那一頭；本地 x＝CX 往外）
    const C = mesher(), f0 = F0, hb = f0 + CAR_H;
    const prof = [[CX, 0.55, 1.15], [CX + 0.7, 0.62, 0.98], [CX + 0.78, YS0, 1.0], [CX + 0.79, YS1, 1.0], [CX + 0.8, f0 + 0.95, 1.0], [CX + 0.28, f0 + 2.5, 1.12], [CX, hb - 0.12, 0.9]]; // x、y、半寬（前面窄＝切角）
    const cols = [DARK, LGRY, TGRN, LGRY, [0.06, 0.08, 0.10], [0.9, 0.91, 0.92]];
    for (let i = 0; i < prof.length - 1; i++) { const [xa, ya, wa] = prof[i], [xb, yb, wb] = prof[i + 1]; C.quad([xa, ya, wa], [xa, ya, -wa], [xb, yb, -wb], [xb, yb, wb], cols[i]); }
    for (const q of [-1, 1]) { const P = prof.map(([x, y, w]) => [x, y, q * Math.max(w, 0.9)]); for (let i = 1; i < P.length - 1; i++) C.tri(P[0], P[i], P[i + 1], i >= 4 ? [0.06, 0.08, 0.10] : LGRY); } // 兩邊（窗那一段黑的）
    C.vqU(CX, -CAR_W, CAR_W, f0, YTT, LGRY, false); // 接到車身的那一面
    const disc = (z, y, r, col) => { const x = CX + 0.795, n = 10; for (let i = 0; i < n; i++) { const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU; C.tri([x, y, z], [x, y + r * Math.sin(a0), z + r * Math.cos(a0)], [x, y + r * Math.sin(a1), z + r * Math.cos(a1)], col); } };
    for (const q of [-1, 1]) { disc(q * 0.66, f0 + 0.42, 0.13, [1, 0.97, 0.84]); disc(q * 0.66, f0 + 0.42, 0.17, [0.2, 0.2, 0.22]); disc(q * 0.36, f0 + 0.42, 0.06, [0.9, 0.12, 0.1]); } // 圓的車燈（外面一圈黑）、小的紅燈
    return C.geometry();
  })();
  const carGlass = (() => { const Gm = mesher(), hw = CAR_W; for (const q of [-1, 1]) for (const [x0, x1] of WIN) Gm.vqV(q * hw, x0, x1, YW0, YW1, [1, 1, 1], q > 0); return Gm.geometry(); })();
  const carLeaf = (() => { const Lm = mesher(), w = DOOR_W / 4; Lm.bx(-w, w, 1.1, 3.0, -0.03, 0.03, LGRY, null, { pv: GLSD, nv: GLSD }); Lm.bx(-w, w, 1.1, 1.62, -0.035, 0.035, LGRY); Lm.bx(-w, w, 2.86, 3.0, -0.035, 0.035, LGRY); Lm.bx(-w, -w + 0.07, 1.1, 3.0, -0.035, 0.035, LGRY); Lm.bx(w - 0.07, w, 1.1, 3.0, -0.035, 0.035, LGRY); return Lm.geometry(); })();
  const carSignGeo = (() => { const Sm = mesher(); for (const q of [-1, 1]) for (const dx of [-DOOR_X, DOOR_X]) Sm.vqV(q * (CAR_W - 0.1), dx - 0.7, dx + 0.7, F0 + 2.04, F0 + 2.28, [1, 1, 1], q < 0); const g = Sm.geometry(), uv = []; for (let i = 0; i < 4; i++) uv.push(0, 0, 1, 0, 1, 1, 0, 1); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; })();
  const carSignMat = (() => { const c = mkCanvas(1024, 128), g = c.getContext('2d'); routeMap(g, 0, 0, 1024, 128, null); const t = texOf(c), m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35, roughness: 0.6 }); mats.csign = m; return m; })();
  // ---- 時刻：兩個方向，各自從隧道口出來、停每一站、開進另一頭的隧道口 ----
  const dirs = [1, -1].map((dir) => {
    const L = sB - sA, stops = stations.map((S, i) => ({ p: dir > 0 ? S.s - sA : sB - S.s, si: i })).sort((a, b) => a.p - b.p);
    const segs = []; let t = 0, p = 0;
    for (const st of stops) { const Lr = Math.max(0, st.p - p), T = runT(Lr); segs.push({ k: 'run', t0: t, t1: t + T, p0: p, L: Lr }); t += T; segs.push({ k: 'dwell', t0: t, t1: t + DWELL, p: st.p, si: st.si }); t += DWELL; p = st.p; }
    { const Lr = Math.max(0, L - p), T = runT(Lr); segs.push({ k: 'run', t0: t, t1: t + T, p0: p, L: Lr }); t += T; }
    return { dir, segs, total: t, phase: dir > 0 ? 0 : H / 2, L, stops };
  });
  const maxAct = dirs.reduce((n, d) => n + Math.ceil(d.total / H), 0);
  const carIM = new THREE.InstancedMesh(carGeo, mats.train, maxAct * 4); carIM.name = 'mrt-cars'; carIM.frustumCulled = false; group.add(carIM);
  const glsIM = new THREE.InstancedMesh(carGlass, mats.tglass, maxAct * 4); glsIM.name = 'mrt-car-glass'; glsIM.frustumCulled = false; group.add(glsIM);
  const dorIM = new THREE.InstancedMesh(carLeaf, mats.leaf, maxAct * 4 * 8); dorIM.name = 'mrt-car-doors'; dorIM.frustumCulled = false; group.add(dorIM);
  const noseIM = new THREE.InstancedMesh(noseGeo, mats.train, maxAct * 2); noseIM.name = 'mrt-noses'; noseIM.frustumCulled = false; group.add(noseIM); // 第 80 批：車頭
  const csIM = new THREE.InstancedMesh(carSignGeo, carSignMat, maxAct * 4); csIM.name = 'mrt-car-signs'; csIM.frustumCulled = false; group.add(csIM); // 車門上面的路線圖
  meshes += 5; tris += (carGeo.index.count / 3 + carGlass.index.count / 3 + (carLeaf.index.count / 3) * 8 + 8) * maxAct * 4 + (noseGeo.index.count / 3) * maxAct * 2;
  const posAt = (d, tau) => { // → { p, v, open, si（停著的站，沒有＝−1）, seg }
    for (const s of d.segs) if (tau < s.t1 || s === d.segs[d.segs.length - 1]) {
      if (s.k === 'dwell') return { p: s.p, v: 0, open: clamp(Math.min(tau - s.t0 - 0.8, s.t1 - tau - 0.8) / 1.2, 0, 1), si: s.si, seg: s };
      const [q, v] = runP(s.L, tau - s.t0); return { p: s.p0 + q, v, open: 0, si: -1, seg: s };
    }
    return null;
  };
  // ---- 狀態 ----
  let time = (Date.now() / 1000) % CYCLE, lap = 0; // 第 87 批：lap＝時間繞了幾圈（列車的 key 才不會在 180 秒那一下換掉：以前坐車剛好碰到就被當成「開進隧道了」、人留在半空中掉到街上）
  const LAPK = Math.round(CYCLE / H);
  const active = []; // 現在在跑的列車：{ dir, k, d, tau, p, s, open, si, cars: [{ x, z, th }], key }
  const prev = new Map(); // key → 上一格的 open（叮咚）
  const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3(1, 1, 1), ZERO = new THREE.Matrix4().makeScale(0, 0, 0), YAX = new THREE.Vector3(0, 1, 0);
  const events = [];
  function trainsNow() {
    active.length = 0;
    for (const d of dirs) {
      const k1 = Math.floor((time - d.phase) / H), k0 = Math.ceil((time - d.phase - d.total) / H);
      for (let k = k0; k <= k1; k++) { const tau = time - d.phase - k * H; if (tau < 0 || tau >= d.total) continue; const ps = posAt(d, tau); if (!ps) continue;
        const key = `${d.dir}:${k + lap * LAPK}`, s = d.dir > 0 ? sA + ps.p : sB - ps.p, tr = { dir: d.dir, k, d, tau, p: ps.p, s, open: ps.open, si: ps.si, seg: ps.seg, v: ps.v, cars: [], key };
        for (let i = 0; i < 4; i++) { const cs = s + d.dir * (i - 1.5) * CAR_P, q = at(cs), tv = TRK_V * d.dir; tr.cars.push({ x: q[0] - q[3] * tv, z: q[1] + q[2] * tv, th: Math.atan2(-q[3] * d.dir, q[2] * d.dir), ux: q[2] * d.dir, uz: q[3] * d.dir, s: cs }); }
        active.push(tr);
        const po = prev.get(key); if (po != null) { if (po === 0 && ps.open > 0 && ps.si >= 0) events.push({ k: 'arrive', tr, si: ps.si }); if (po > 0 && ps.open === 0 && ps.si >= 0) events.push({ k: 'close', tr, si: ps.si }); } prev.set(key, ps.open);
      }
    }
    if (prev.size > 64) for (const k of prev.keys()) if (!active.some((t) => t.key === k)) prev.delete(k);
  }
  // 車廂本地 ↔ 世界
  const carLoc = (c, x, z) => { const dx = x - c.x, dz = z - c.z; return [dx * c.ux + dz * c.uz, -dx * c.uz + dz * c.ux]; };
  const carW = (c, lu, lv) => [c.x + c.ux * lu - c.uz * lv, c.z + c.uz * lu + c.ux * lv];
  const inCar = (c, x, z, m = 0) => { const [lu, lv] = carLoc(c, x, z); return Math.abs(lu) <= 6.9 + m && Math.abs(lv) <= CAR_W + m; };
  // ---- 畫 ----
  const camP = [0, 0];
  function drawTrains() {
    let n = 0, nd = 0, nn = 0;
    for (const tr of active) for (let ci = 0; ci < tr.cars.length; ci++) { const c = tr.cars[ci];
      Q4.setFromAxisAngle(YAX, c.th); V3.set(c.x, YT, c.z); M4.compose(V3, Q4, S3); carIM.setMatrixAt(n, M4); glsIM.setMatrixAt(n, M4); csIM.setMatrixAt(n, M4); n++;
      if (ci === 3) noseIM.setMatrixAt(nn++, M4); else if (ci === 0) { Q4.setFromAxisAngle(YAX, c.th + Math.PI); M4.compose(V3, Q4, S3); noseIM.setMatrixAt(nn++, M4); Q4.setFromAxisAngle(YAX, c.th); }
      for (const q of [-1, 1]) for (const dx of [-DOOR_X, DOOR_X]) for (const lf of [-1, 1]) { const off = lf * (DOOR_W / 4 + (q > 0 ? tr.open : 0) * (DOOR_W / 2)), lu = dx + off, lv = q * (CAR_W - 0.06), [x, z] = carW(c, lu, lv); V3.set(x, YT, z); M4.compose(V3, Q4, S3); dorIM.setMatrixAt(nd++, M4); } // 只開月台那一邊（右手邊）的門
    }
    carIM.count = n; glsIM.count = n; csIM.count = n; dorIM.count = nd; noseIM.count = nn; for (const im of [carIM, glsIM, csIM, dorIM, noseIM]) im.instanceMatrix.needsUpdate = true;
  }
  function drawPsd() {
    let i = 0;
    for (const { S, d, q } of psdList) {
      const tr = active.find((t) => t.si === stations.indexOf(S) && t.open > 0 && t.dir === d.sd); const open = tr ? tr.open : 0; // +v 那邊＝往 +s（dir 1）
      const lu = d.u + q * (0.475 + open * 0.95), [x, z] = S.toW(lu, d.v); V3.set(x, YP, z); Q4.setFromAxisAngle(YAX, S.rot); M4.compose(V3, Q4, S3); psdIM.setMatrixAt(i++, M4);
    }
    psdIM.instanceMatrix.needsUpdate = true;
  }
  function nextIn(si, dir) { // 這一站這個方向下一班還要幾秒（0＝在站）
    const d = dirs[dir > 0 ? 0 : 1], st = d.segs.find((s) => s.k === 'dwell' && s.si === si); if (!st) return null;
    let best = Infinity; for (const tr of active) if (tr.dir === dir) { if (tr.si === si) return 0; if (tr.tau < st.t0) best = Math.min(best, st.t0 - tr.tau); }
    const k1 = Math.floor((time - d.phase) / H); for (let k = k1 + 1; k <= k1 + 3; k++) { const tau = time - d.phase - k * H; const w = st.t0 - tau; if (w >= 0) { best = Math.min(best, w); break; } }
    return isFinite(best) ? best : null;
  }
  let boardT = -1;
  function drawBoards() {
    for (let si = 0; si < stations.length; si++) { const S = stations[si]; let ch = false;
      for (const [row, dir] of [[0, 1], [1, -1]]) { const w = nextIn(si, dir), lab = dirLabel(si, dir), txt = w == null ? lab : w === 0 ? `${lab}　列車到站` : `${lab}　下一班 約 ${Math.ceil(w)} 秒`; if (S.board.txt[row] === txt) continue; S.board.txt[row] = txt; ch = true;
        const g = S.board.g, y = row * 64; g.fillStyle = '#101214'; g.fillRect(0, y, 512, 64); g.fillStyle = '#8a5a2b'; g.fillRect(0, y, 10, 64); g.fillStyle = w === 0 ? '#ffd24a' : '#ffffff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `700 ${fit(g, txt, 34, 470)}px ${SANS}`; g.fillText(txt, 26, y + 33); }
      if (ch) S.board.tex.needsUpdate = true; }
  }
  // ==== 第 87 批（Nick 2026-11-11「做1」＝原本那句「捷運站也要有生物」）：捷運站裡的小動物 ====
  // 路上的三隻動物（animals.js，opt.makeAnimal）也住進捷運站：每站大廳 4 隻（閘門外、閘門裡各 2）、月台每邊 3 隻（有的在車門旁邊排隊）；
  // 車來了，車門附近的走進車廂坐車（站在車廂裡、跟著車走），到下一站走出來；從隧道開出來的車也會帶 1～2 隻下車；開進隧道的車上的就不見了。
  // 走路用 0.25 公尺的格子（那一層的碰撞＋樓梯、軌道那邊不能走，往外 0.5 公尺），BFS 找路再拉直（一格最多找一次路）；你、別隻擋在前面就停下來等。
  // 一隻 2 個 draw call；90 公尺外藏起來、不算動作。走路的人撞得到（M.movers 的圓），上下車那一下不擋人。
  const mkAni = typeof opt.makeAnimal === 'function' ? opt.makeAnimal : null;
  const ZG = 0.25, ZR = 0.5, ZMAX = 32, ZKINDS = ['pig', 'pinky', 'cham'], ZSPD = { pig: 0.62, pinky: 0.74, cham: 0.58 }, ZQV = PV0 + 0.95; // 排隊的地方離軌道中線多遠
  const Z = { on: false, list: [], seed: 20261111, done: new Map(), pp: null, budget: 0, navs: [], spots: [] };
  const zr = () => { let t = (Z.seed = (Z.seed + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const ZWALK = { state: 'walk', speed: 0 }, ZIDLE = { state: 'idle', speed: 0 }, ZPP = [0, 0, 0];
  function zNav(S, lvl) { // 那一層哪裡可以走（本地 u、v 的格子）、連在一起的區域
    const U1 = lvl === 2 ? PL : CU, V1 = lvl === 2 ? PV1 : CV, U0 = -U1, V0 = -V1, nu = Math.round((U1 - U0) / ZG), nv = Math.round((V1 - V0) / ZG), free = new Uint8Array(nu * nv);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) free[j * nu + i] = Math.abs(U0 + (i + 0.5) * ZG) <= U1 - ZR && Math.abs(V0 + (j + 0.5) * ZG) <= V1 - ZR ? 1 : 0;
    const block = (a0, a1, b0, b1) => { const i0 = Math.max(0, Math.floor((Math.min(a0, a1) - ZR - U0) / ZG)), i1 = Math.min(nu - 1, Math.floor((Math.max(a0, a1) + ZR - U0) / ZG)), j0 = Math.max(0, Math.floor((Math.min(b0, b1) - ZR - V0) / ZG)), j1 = Math.min(nv - 1, Math.floor((Math.max(b0, b1) + ZR - V0) / ZG));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) free[j * nu + i] = 0; };
    for (const c of S.cols[lvl]) { const [cu, cv] = S.loc(c.x, c.z); block(cu - c.hx, cu + c.hx, cv - c.hz, cv + c.hz); }
    for (const q of [-1, 1]) block(RAMP.u0 - 0.6, RAMP.u1 + 0.6, q * (RAMP.v0 - 0.1), q * (HOLE1 + 0.1)); // 樓梯、電扶梯（不走上去、不擋在口）
    if (lvl === 2) block(-PL, PL, -PV0, PV0); // 月台門外面＝軌道
    else for (const q of [-1, 1]) block(-CU, CU, q * (CV - 0.15), q * (CV + 1)); // 大廳：天橋的口
    const comp = new Int16Array(nu * nv).fill(-1), comps = [], q = new Int32Array(nu * nv);
    for (let k = 0; k < nu * nv; k++) if (free[k] && comp[k] < 0) { const id = comps.length, cells = []; let h = 0, t = 0; q[t++] = k; comp[k] = id;
      while (h < t) { const c = q[h++]; cells.push(c); const i = c % nu, j = (c - i) / nu; for (const [di, dj] of D4) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nu || jj >= nv) continue; const n = jj * nu + ii; if (free[n] && comp[n] < 0) { comp[n] = id; q[t++] = n; } } }
      comps.push(cells); }
    return { S, lvl, U0, V0, nu, nv, free, comp, comps, q, prev: new Int32Array(nu * nv), seen: new Uint32Array(nu * nv), stamp: 0, y: lvl === 2 ? YP : YC };
  }
  const zCell = (N, u, v) => { const i = Math.floor((u - N.U0) / ZG), j = Math.floor((v - N.V0) / ZG); return i < 0 || j < 0 || i >= N.nu || j >= N.nv ? -1 : j * N.nu + i; };
  const zU = (N, k) => N.U0 + ((k % N.nu) + 0.5) * ZG, zV = (N, k) => N.V0 + (Math.floor(k / N.nu) + 0.5) * ZG;
  const zOk = (N, u, v) => { const k = zCell(N, u, v); return k >= 0 && N.free[k] === 1; };
  function zNear(N, u, v, id) { // 最近的可以走的格子（id＝只要那一區）
    const k0 = zCell(N, u, v); if (k0 >= 0 && N.free[k0] && (id == null || N.comp[k0] === id)) return k0;
    const i0 = Math.floor((u - N.U0) / ZG), j0 = Math.floor((v - N.V0) / ZG);
    for (let r = 1; r <= 16; r++) { let best = -1, bd = Infinity;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= N.nu || j >= N.nv) continue;
        const k = j * N.nu + i; if (N.free[k] && (id == null || N.comp[k] === id)) { const d = di * di + dj * dj; if (d < bd) { bd = d; best = k; } } }
      if (best >= 0) return best; }
    return -1;
  }
  function zLos(N, u0, v0, u1, v1) { const n = Math.ceil(Math.hypot(u1 - u0, v1 - v0) / 0.1); for (let t = 1; t < n; t++) if (!zOk(N, u0 + ((u1 - u0) * t) / n, v0 + ((v1 - v0) * t) / n)) return false; return true; }
  function zPath(N, u0, v0, k1) { // (u0, v0) → 格子 k1：拉直過的點 [[u, v] …]；找不到＝null
    const k0 = zNear(N, u0, v0, N.comp[k1]); if (k0 < 0) return null;
    const { nu, nv, free, prev, seen, q } = N, st = ++N.stamp; let h = 0, t = 0, found = k0 === k1; q[t++] = k0; seen[k0] = st; prev[k0] = -1;
    while (h < t && !found) { const c = q[h++], i = c % nu, j = (c - i) / nu;
      for (const [di, dj] of D8) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nu || jj >= nv) continue; const n = jj * nu + ii; if (!free[n] || seen[n] === st) continue;
        if (di && dj && (!free[j * nu + ii] || !free[jj * nu + i])) continue; seen[n] = st; prev[n] = c; if (n === k1) { found = true; break; } q[t++] = n; } }
    if (!found) return null;
    const cells = []; for (let c = k1; c >= 0; c = prev[c]) cells.push(c); cells.reverse();
    const out = []; let cu = u0, cv = v0, i = 0;
    while (i < cells.length - 1) { let j = i + 1; while (j + 1 < cells.length && zLos(N, cu, cv, zU(N, cells[j + 1]), zV(N, cells[j + 1]))) j++; cu = zU(N, cells[j]); cv = zV(N, cells[j]); out.push([cu, cv]); i = j; }
    if (!out.length) out.push([zU(N, k1), zV(N, k1)]);
    return out;
  }
  const zAct = (key) => { for (const t of active) if (t.key === key) return t; return null; };
  const zDoneCk = (key, k) => { const t = zAct(key); if (!t || t.si < 0 || t.open === 0) Z.done.delete(k); };
  const zNavOf = (si, lvl) => Z.navs[si * 2 + lvl - 1];
  function zNew(kind) { // 一隻（還沒做模型；update 裡一格做 3 隻）
    const a = { kind, C: null, free: true, si: -1, lvl: 0, sd: 0, N: null, comp: -1, x: 0, z: 0, y: 0, hd: 0, v: 0, st: 'idle', t: 0, wp: null, wi: 0, bk: 0, blk: 0, spd: ZSPD[kind] * (0.9 + 0.2 * zr()), spot: null, ride: null, tkey: null, tci: 0, fx: 0, fz: 0 };
    Z.list.push(a); return a;
  }
  function zTake() { for (const a of Z.list) if (a.free && a.st === 'gone') return a; return Z.list.length < ZMAX ? zNew(ZKINDS[Math.floor(zr() * 3)]) : null; }
  function zGone(a) { zUnspot(a); a.free = true; a.st = 'gone'; a.ride = null; a.wp = null; a.v = 0; if (a.C) a.C.group.visible = false; }
  function zPut(a, si, lvl, k, sd = 0) { // 放在那一層的格子 k
    const N = zNavOf(si, lvl), [x, z] = N.S.toW(zU(N, k), zV(N, k)); Object.assign(a, { free: false, si, lvl, sd, N, comp: N.comp[k], x, z, fx: x, fz: z, y: N.y, hd: N.S.rot + (zr() - 0.5) * 6, st: 'idle', t: 1 + zr() * 4, wp: null, ride: null });
  }
  function zUnspot(a) { if (a.spot) { a.spot.a = null; a.spot = null; } }
  function zBusy(a, x, z, r) { // 那裡有別隻（或牠要去的地方）、或你
    for (const b of Z.list) if (b !== a && !b.free && b.lvl === a.lvl && b.si === a.si && (Math.hypot(b.x - x, b.z - z) < r || Math.hypot(b.fx - x, b.fz - z) < r)) return true;
    const pp = Z.pp; return !!(pp && Math.abs(pp[2] - a.y) < 1.5 && Math.hypot(pp[0] - x, pp[1] - z) < r + 0.3);
  }
  function zGo(a, u, v, wantK = null) { // 走去 (u, v)（同一區最近的格子）
    const N = a.N, k1 = wantK ?? zNear(N, u, v, a.comp); if (k1 < 0) return false;
    const [u0, v0] = N.S.loc(a.x, a.z), p = zPath(N, u0, v0, k1); if (!p) return false;
    a.wp = p.map(([pu, pv]) => N.S.toW(pu, pv)); a.wi = 0; a.st = 'walk'; a.blk = 0; const e = a.wp[a.wp.length - 1]; a.fx = e[0]; a.fz = e[1]; return true;
  }
  function zPick(a) { // 下一個要去哪裡（一格最多找一次路）
    if (Z.budget <= 0) { a.t = 0.05; return; } Z.budget--;
    const N = a.N, S = N.S;
    if (a.lvl === 2 && zr() < 0.45) { // 去車門旁邊排隊
      const list = Z.spots[a.si * 2 + (a.sd > 0 ? 1 : 0)].filter((s) => !s.a && s.comp === a.comp && !zBusy(a, s.x, s.z, 1.1));
      if (list.length) { const s = list[Math.floor(zr() * list.length)]; if (zGo(a, s.u, s.v, s.k)) { zUnspot(a); a.spot = s; s.a = a; return; } } }
    zUnspot(a);
    const cells = N.comps[a.comp];
    for (let tries = 0; tries < 8; tries++) { const k = cells[Math.floor(zr() * cells.length)], [x, z] = S.toW(zU(N, k), zV(N, k)); if (Math.hypot(x - a.x, z - a.z) < 3 || zBusy(a, x, z, 1.4)) continue; if (zGo(a, 0, 0, k)) return; }
    a.st = 'idle'; a.t = 1 + zr() * 2;
  }
  function zBlocked(a, fx, fz) { // 前面有你、別隻
    const pp = Z.pp; if (pp && Math.abs(pp[2] - a.y) < 1.2 && Math.hypot(pp[0] - fx, pp[1] - fz) < 0.8) return true;
    for (const b of Z.list) if (b !== a && !b.free && b.lvl === a.lvl && b.si === a.si && b.st !== 'ride' && Math.hypot(b.x - fx, b.z - fz) < 0.75 && Math.hypot(b.x - a.x, b.z - a.z) > 0.2) return true;
    return false;
  }
  function zMove(a, dt, check) { // 沿著 a.wp 走；走到最後一點回傳 true
    const tg = a.wp[a.wi], dx = tg[0] - a.x, dz = tg[1] - a.z, d = Math.hypot(dx, dz);
    if (d < 0.06) { a.wi++; a.v = a.spd; return a.wi >= a.wp.length; }
    const dh = wrapA(Math.atan2(-dz, dx) - a.hd), turn = 3.4 * dt; a.hd = wrapA(a.hd + clamp(dh, -turn, turn));
    if (check && zBlocked(a, a.x + Math.cos(a.hd) * 0.75, a.z - Math.sin(a.hd) * 0.75)) { a.v = 0; a.blk += dt; return false; }
    a.blk = 0; const sp = a.spd * (Math.abs(dh) > 1.0 ? 0.3 : 1), s = Math.min(d, sp * dt); a.x += (dx / d) * s; a.z += (dz / d) * s; a.v = sp; return false;
  }
  function zDoorsOK(S, si, sd) { // 這一邊哪幾個車門前面可以站（樓梯旁邊那兩個不行）
    const N = zNavOf(si, 2); return DOOR_U.filter((du) => zOk(N, du, sd * ZQV));
  }
  function zCarOf(tr, S, du, sd) { const [x, z] = S.toW(du, sd * PV0); for (let i = 0; i < tr.cars.length; i++) { const [lu, lv] = carLoc(tr.cars[i], x, z); if (Math.abs(lu) <= 6.9 && Math.abs(lv) < CAR_W + 0.6) return [i, lu]; } return null; }
  function zRide(a, tr, ci) { // 站進車廂裡（車廂本地的位置記起來）
    if (!tr) { zGone(a); return; } const c = tr.cars[ci], [lu, lv] = carLoc(c, a.x, a.z);
    zUnspot(a); a.ride = { key: tr.key, ci, lu: clamp(lu, -6.4, 6.4), lv: clamp(lv, -0.55, 0.55), lh: wrapA(c.th - a.hd) }; a.st = 'ride'; a.lvl = 3; a.y = YP; a.v = 0; a.wp = null;
  }
  function zDoorD(a, sd) { const [u0, v0] = a.N.S.loc(a.x, a.z); let bd = Infinity; for (const d of zDoorsOK(a.N.S, a.si, sd)) bd = Math.min(bd, Math.hypot(d - u0, sd * ZQV - v0)); return bd; }
  function zBoard(a, tr, delay, maxD = 3.5) { // 走去最近的車門（maxD 公尺內）、走進車廂
    const si = tr.si, sd = tr.dir, S = stations[si], N = a.N, [u0, v0] = S.loc(a.x, a.z);
    let du = null, bd = maxD; for (const d of zDoorsOK(S, si, sd)) { const dd = Math.hypot(d - u0, sd * ZQV - v0); if (dd < bd) { bd = dd; du = d; } }
    if (du == null) return false; const cl = zCarOf(tr, S, du, sd); if (!cl) return false;
    const k1 = zNear(N, du, sd * ZQV, a.comp); if (k1 < 0) return false; const p = zPath(N, u0, v0, k1); if (!p) return false;
    const c = tr.cars[cl[0]], dlu = Math.sign(cl[1]) * DOOR_X;
    a.wp = [...p.map(([pu, pv]) => S.toW(pu, pv)), S.toW(du, sd * (PV0 + 0.2)), carW(c, dlu, CAR_W - 0.35), carW(c, dlu + (zr() - 0.5) * 1.4, (zr() - 0.5) * 0.9)];
    a.bk = a.wp.length - 2; a.wi = 0; a.st = 'board'; a.t = delay; a.tkey = tr.key; a.tci = cl[0]; zUnspot(a); const e = a.wp[a.wp.length - 1]; a.fx = e[0]; a.fz = e[1]; return true;
  }
  function zAlight(a, tr, delay) { // 從最近的（可以站的）車門走出去、站到月台上
    const si = tr.si, sd = tr.dir, S = stations[si], N = zNavOf(si, 2), c = tr.cars[a.ride.ci], ok = zDoorsOK(S, si, sd);
    let dlu = Math.abs(a.ride.lu - DOOR_X) < Math.abs(a.ride.lu + DOOR_X) ? DOOR_X : -DOOR_X;
    for (const d of [dlu, -dlu]) { const [du] = S.loc(...carW(c, d, 0)); if (ok.some((o) => Math.abs(o - du) < 0.5)) { dlu = d; break; } }
    const [du] = S.loc(...carW(c, dlu, 0)), k = zNear(N, du + (zr() - 0.5) * 1.6, sd * (ZQV + 0.3 + zr() * 1.2)); if (k < 0) { zGone(a); return; }
    a.wp = [carW(c, dlu, 0.2), carW(c, dlu, CAR_W + 0.15), S.toW(du, sd * (PV0 + 0.45)), S.toW(zU(N, k), zV(N, k))]; a.wi = 0;
    Object.assign(a, { st: 'alight', t: delay, si, sd, N, comp: N.comp[k], tkey: tr.key, ride: null, lvl: 2 }); const e = a.wp[3]; a.fx = e[0]; a.fz = e[1];
  }
  function zPlaceRider(a, tr, sd) { // 從隧道開出來的車上本來就有的：站在可以下車的車門旁邊
    const si = tr.si, S = stations[si], ok = zDoorsOK(S, si, sd); if (!ok.length) return false;
    const du = ok[Math.floor(zr() * ok.length)], cl = zCarOf(tr, S, du, sd); if (!cl) return false;
    const c = tr.cars[cl[0]], dlu = Math.sign(cl[1]) * DOOR_X, lu = dlu + (zr() - 0.5) * 1.4, lv = (zr() - 0.5) * 0.9, [x, z] = carW(c, lu, lv);
    Object.assign(a, { free: false, si, sd, x, z, y: YP, lvl: 3, st: 'ride', ride: { key: tr.key, ci: cl[0], lu, lv, lh: (zr() - 0.5) * 6 }, wp: null, v: 0 }); a.hd = c.th - a.ride.lh; return true;
  }
  const zCount = (si, sd) => { let n = 0; for (const a of Z.list) if (!a.free && a.lvl === 2 && a.si === si && a.sd === sd && a.st !== 'board') n++; return n; };
  function zArrive(tr) { // 列車到站、門開了：車上的下車、從隧道來的帶幾隻、車門旁邊的上車
    const si = tr.si, sd = tr.dir; let n = 0;
    for (const a of Z.list) if (!a.free && a.st === 'ride' && a.ride.key === tr.key) zAlight(a, tr, 0.2 + 0.7 * n++);
    if (tr.d.stops[0].si === si) { const add = Math.min(2, Math.max(0, 4 - zCount(si, sd))); for (let i = 0; i < add; i++) { const a = zTake(); if (!a || !zPlaceRider(a, tr, sd)) break; zAlight(a, tr, 0.2 + 0.7 * n++); } }
    let left = zCount(si, sd), nb = 0; const p = left > 3 ? 0.85 : 0.55; // 月台上（含剛下車的）至少留 1 隻
    const ok = (a) => !a.free && a.lvl === 2 && a.si === si && a.sd === sd && (a.st === 'idle' || a.st === 'queue' || a.st === 'walk');
    for (const a of Z.list) if (left > 1 && ok(a) && (a.st === 'queue' || zr() < p)) if (zBoard(a, tr, 1.0 + 0.6 * n + zr() * 0.6)) { left--; nb++; } // 在車門旁邊排隊的一定上車
    if (!nb && left > 1) { let best = null, bd = 6; for (const a of Z.list) if (ok(a)) { const d = zDoorD(a, sd); if (d < bd) { bd = d; best = a; } } if (best) zBoard(best, tr, 0.6, 6); } // 沒有人上：離車門最近的那隻上
  }
  function zInit() {
    Z.on = true;
    for (let si = 0; si < stations.length; si++) { const S = stations[si]; Z.navs.push(zNav(S, 1), zNav(S, 2));
      for (const sd of [-1, 1]) { const N = zNavOf(si, 2), sp = []; for (const du of zDoorsOK(S, si, sd)) for (const q of [-1, 1]) { const u = du + q * 1.35, v = sd * ZQV, k = zCell(N, u, v); if (k >= 0 && N.free[k]) { const [x, z] = S.toW(u, v); sp.push({ u, v, k, x, z, comp: N.comp[k], a: null }); } } Z.spots[si * 2 + (sd > 0 ? 1 : 0)] = sp; } }
    for (let si = 0; si < stations.length; si++) {
      const H1 = zNavOf(si, 1), big = H1.comps.map((c, i) => [c.length, i]).filter((c) => c[0] > 400).sort((p, q) => q[0] - p[0]).slice(0, 2);
      for (const [, id] of big) for (let n = 0; n < 2; n++) { const cells = H1.comps[id], a = zNew(ZKINDS[Math.floor(zr() * 3)]); let k = cells[0];
        for (let t = 0; t < 12; t++) { k = cells[Math.floor(zr() * cells.length)]; const [x, z] = H1.S.toW(zU(H1, k), zV(H1, k)); if (!Z.list.some((b) => !b.free && Math.hypot(b.x - x, b.z - z) < 2)) break; }
        zPut(a, si, 1, k); }
      const P2 = zNavOf(si, 2);
      for (const sd of [-1, 1]) { const side = P2.comps.filter((c) => c.length > 200 && Math.sign(zV(P2, c[0])) === sd), tot = side.reduce((s, c) => s + c.length, 0); if (!tot) continue;
        for (let n = 0; n < 3; n++) { const a = zNew(ZKINDS[Math.floor(zr() * 3)]); let k = side[0][0];
          for (let t = 0; t < 12; t++) { let r = zr() * tot, c = side[0]; for (const cc of side) { if (r < cc.length) { c = cc; break; } r -= cc.length; } k = c[Math.floor(zr() * c.length)]; const [x, z] = P2.S.toW(zU(P2, k), zV(P2, k)); if (!Z.list.some((b) => !b.free && Math.hypot(b.x - x, b.z - z) < 2)) break; }
          zPut(a, si, 2, k, sd); } } }
  }
  function zStep(dt) { // 每一格（在內湖附近）：上下車、走路、站著；畫的位置
    if (!Z.on) { if (!mkAni) return; let d = Infinity; for (const S of stations) d = Math.min(d, Math.hypot(S.x - camP[0], S.z - camP[1])); if (d > 400) return; zInit(); }
    Z.budget = 1; dt = Math.min(dt, 0.2);
    for (const tr of active) if (tr.si >= 0 && tr.open > 0.7) { const k = tr.key + '@' + tr.si; if (!Z.done.has(k)) { Z.done.set(k, tr.key); zArrive(tr); } }
    Z.done.forEach(zDoneCk); // 車門關好、開走了＝下次到站再算一次
    let nb = 0;
    for (const a of Z.list) {
      if (a.free) continue;
      if (!a.C && nb < 3) { nb++; a.C = mkAni({ animal: a.kind, age: 'adult' }); a.C.group.name = 'mrt-animal-' + a.kind; group.add(a.C.group); }
      if (a.st === 'ride') { const tr = zAct(a.ride.key); if (!tr) { zGone(a); continue; } const c = tr.cars[a.ride.ci], [x, z] = carW(c, a.ride.lu, a.ride.lv); a.x = x; a.z = z; a.hd = c.th - a.ride.lh; a.y = YP; a.v = 0; }
      else if (a.st === 'board') {
        const tr = zAct(a.tkey); if (!tr || tr.si !== a.si || tr.tau > tr.seg.t1 - 2.4) { if (tr && a.wi >= a.bk) zRide(a, tr, a.tci); else if (!tr && a.wi >= a.bk) zGone(a); else { a.st = 'idle'; a.t = 0.5; a.wp = null; a.v = 0; const k = zNear(a.N, ...a.N.S.loc(a.x, a.z), a.comp); if (k >= 0) { const [x, z] = a.N.S.toW(zU(a.N, k), zV(a.N, k)); a.x = x; a.z = z; } } continue; } // 車門要關了（關門前 2 秒）：還沒走進車門＝回月台
        if (a.t > 0) { a.t -= dt; a.v = 0; continue; }
        if (zMove(a, dt, a.wi < a.bk - 1)) zRide(a, tr, a.tci);
      } else if (a.st === 'alight') { if (a.t > 0) { a.t -= dt; const tr = zAct(a.tkey); if (!tr) { zGone(a); continue; } a.v = 0; continue; } if (zMove(a, dt, false)) { a.st = 'idle'; a.t = 0.8 + zr() * 2; a.wp = null; a.v = 0; } }
      else if (a.st === 'walk') { if (zMove(a, dt, true)) { a.wp = null; a.v = 0; if (a.spot) { a.st = 'queue'; a.t = 10 + zr() * 20; a.hd = a.N.S.rot + (a.sd > 0 ? Math.PI / 2 : -Math.PI / 2); } else { a.st = 'idle'; a.t = 2 + zr() * 6; } } else if (a.blk > 1.6) { a.st = 'idle'; a.t = 0.3 + zr() * 0.6; a.wp = null; a.v = 0; zUnspot(a); a.fx = a.x; a.fz = a.z; } }
      else if (a.st === 'idle' || a.st === 'queue') { a.v = 0; a.t -= dt; if (a.t <= 0) zPick(a); }
    }
    for (const a of Z.list) { if (!a.C) continue; const g = a.C.group;
      const vis = !a.free && Math.hypot(a.x - camP[0], a.z - camP[1]) < 90; g.visible = vis; if (!vis) continue;
      g.position.set(a.x, a.y, a.z); g.rotation.y = a.hd; const o = a.v > 0.02 ? ZWALK : ZIDLE; ZWALK.speed = a.v; a.C.update(dt, o); }
  }
  function zMovers(mv, si, y, key, ci) { // 走路的人撞得到（站著、走著的；上下車那一下不擋）
    if (!Z.on) return;
    for (const a of Z.list) { if (a.free || !a.C || a.st === 'board' || a.st === 'alight') continue;
      if (key != null ? !(a.st === 'ride' && a.ride.key === key && a.ride.ci === ci) : a.si !== si || a.st === 'ride' || Math.abs(a.y - y) > 0.5) continue;
      mv.push({ t: 'circle', x: a.x, z: a.z, r: Math.min(0.42, a.C.radius || 0.35), h: a.y + (a.C.height || 0.8), y0: a.y - 0.3 }); }
  }
  // ---- 走路的人 ----
  const P = {
    group, stations, info: { meshes, tris: Math.round(tris), stations: stations.map((s) => s.nm), hole: { u0: RAMP.u0, u1: RAMP.u1, v0: RAMP.v0, v1: HOLE1 }, // hole：月台地板樓梯、電扶梯的洞（站的座標 u、|v|）
      esc: ESCS.length, escSteps: nSteps, T: CYCLE, H, dwell: DWELL, maxTrains: maxAct, sA, sB, len: sB - sA, dirs: dirs.map((d) => ({ dir: d.dir, phase: d.phase, total: Math.round(d.total * 10) / 10, stops: d.stops.map((s) => Math.round(s.p)), dwells: d.segs.filter((s) => s.k === 'dwell').map((s) => ({ si: s.si, t0: Math.round(s.t0 * 10) / 10, t1: Math.round(s.t1 * 10) / 10 })) })) },
    YT, YP, YC, ride: null, lvl: 0, si: -1, py: 0, movers: [],
    get time() { return time; }, setTime(t) { time = ((t % CYCLE) + CYCLE) % CYCLE; prev.clear(); trainsNow(); events.length = 0; },
    animals: () => Z.list.filter((a) => !a.free).map((a) => { const [u, v] = a.si >= 0 ? stations[a.si].loc(a.x, a.z) : [0, 0]; return { k: a.kind, si: a.si, lvl: a.lvl, sd: a.sd, st: a.st, x: +a.x.toFixed(2), z: +a.z.toFixed(2), y: +a.y.toFixed(2), u: +u.toFixed(2), v: +v.toFixed(2), hd: +a.hd.toFixed(2), ride: a.ride ? a.ride.key : null, ci: a.ride ? a.ride.ci : null, spot: !!a.spot, vis: !!(a.C && a.C.group.visible), built: !!a.C }; }), // 第 87 批：捷運站的小動物（測試）
    zoo: Z,
    trains: () => active.map((t) => ({ key: t.key, dir: t.dir, k: t.k, p: Math.round(t.p * 10) / 10, s: Math.round(t.s * 10) / 10, x: t.cars[0].x, z: t.cars[0].z, stop: t.si, si: t.si, open: t.open, v: t.v, tau: Math.round(t.tau * 10) / 10, cars: t.cars.map((c) => ({ x: c.x, z: c.z, th: c.th, ux: c.ux, uz: c.uz })) })),
    at(x, z) { for (let i = 0; i < stations.length; i++) { const [u, v] = stations[i].loc(x, z); if (Math.abs(u) < 50 && Math.abs(v) < 32) return i; } return -1; },
    loc: (si, x, z) => stations[si].loc(x, z), toW: (si, u, v) => stations[si].toW(u, v),
    cols: (si, lvl) => (si >= 0 && stations[si].cols[lvl]) || [],
    dirLabel,
    heightAt(x, z) { // 候選的高度裡挑最接近上一格的（大廳在月台下面、街在天橋下面：夾層）
      if (P.ride) { const c = P.ride.tr.cars[P.ride.car]; if (inCar(c, x, z, 3.0)) return YP; } // 第 82 批：坐車的時候車廂附近都是車廂的地板（不會掉到街上）
      const si = P.at(x, z); if (si < 0) return null; const S = stations[si], [u, v] = S.loc(x, z), av = Math.abs(v), cand = [];
      if (Math.abs(u) <= PL + 0.2 && av >= PV0 - 0.4 && av <= PV1 + 0.3) { if (u >= RAMP.u0 && u <= RAMP.u1 && av >= RAMP.v0 && av <= HOLE1) return YC + ((YP - YC) * (u - RAMP.u0)) / (RAMP.u1 - RAMP.u0); cand.push(YP); }
      if (Math.abs(u) <= PL + 0.2 && av < PV0 - 0.4) { let on = false; for (const tr of active) if (tr.si === si) for (const c of tr.cars) if (inCar(c, x, z, 0.35)) on = true; cand.push(on ? YP : YT); }
      if (Math.abs(u) <= CU + 0.3 && av <= CV + 0.3) cand.push(YC);
      for (const e of S.ent) { const vlo = Math.min(e.v0, e.v1) - 0.3, vhi = Math.max(e.v0, e.v1) + 0.3, bl = Math.min(e.s * CV, e.v0) - 0.3, bh = Math.max(e.s * CV, e.v0) + 0.3, inB = u >= e.bu0 - 0.3 && u <= e.bu1 + 0.3;
        if (inB && v >= bl && v <= bh) cand.push(YC); // 天橋
        if (v >= vlo && v <= vhi) { if (inB) cand.push(YC); const f = (u - e.uS) / (e.u1 - e.uS); if (f > 0 && f <= 1.03) cand.push(Math.max(0, YC * (1 - f))); } } // 平台、樓梯（往 dir 下去）
      if (!cand.length) return null; let best = cand[0]; for (const c of cand) if (Math.abs(c - P.py) < Math.abs(best - P.py)) best = c; return best;
    },
    levelOf: (y) => (y == null ? 0 : y > 10 ? 2 : y > 3 ? 1 : 0),
    leave() { P.ride = null; P.movers.length = 0; },
    getOff(px, pz) { // 按「下車」：車停著、門開著 → 從最近的車門走到月台上（回傳要站的地方）；不行＝null
      const R = P.ride; if (!R) return null; const tr = active.find((t) => t.key === R.key); if (!tr || tr.si < 0 || tr.open < 0.5) return null;
      const S = stations[tr.si], c = tr.cars[R.car], [lu] = carLoc(c, px, pz), dx = Math.abs(lu - DOOR_X) < Math.abs(lu + DOOR_X) ? DOOR_X : -DOOR_X, [u] = S.loc(...carW(c, dx, 0)), sd = tr.dir, [x, z] = S.toW(u, sd * (PV0 + 1.2));
      P.ride = null; P.movers.length = 0; return { x, z, heading: Math.atan2(-(z - pz), x - px), nm: S.nm };
    },
    update(camera, dt) {
      const t2 = time + Math.max(0, Math.min(0.2, +dt || 0)); if (t2 >= CYCLE) lap++; time = t2 % CYCLE; trainsNow();
      if (camera) { camP[0] = camera.position.x; camP[1] = camera.position.z; }
      let near = false; for (const S of stations) { const d = Math.hypot(S.x - camP[0], S.z - camP[1]); S.group.visible = d < 1500; if (d < 2600) near = true; }
      carIM.visible = glsIM.visible = dorIM.visible = psdIM.visible = noseIM.visible = csIM.visible = stepIM.visible = near;
      if (near) { drawTrains(); drawPsd(); drawSteps(); if (time - boardT > 1 || time < boardT) { boardT = time; drawBoards(); } zStep(dt); }
      else if (Z.on) for (const a of Z.list) if (a.C) a.C.group.visible = false;
    },
    // 走路的人在 (px, pz)、腳下 py；回傳這一格要做的事
    step(dt, px, pz, py, walking) {
      const out = { shift: null, esc: false, lvl: 0, si: -1, ride: !!P.ride, toast: null, chime: false, beep: false, action: null, eject: null, cap: null }, evs = events.splice(0); // cap＝鏡頭最高（天花板、罩子）
      P.py = py; if (walking) { ZPP[0] = px; ZPP[1] = pz; ZPP[2] = py; Z.pp = ZPP; } else Z.pp = null; // 第 87 批：小動物看得到你（每格不 new）
      if (!walking && P.ride) { // 第 82 批：坐車的時候停一下（換視角、跳出來的東西⋯）：人還是跟著車走，不會留在半空中、掉到街上
        const R = P.ride, tr = active.find((t) => t.key === R.key);
        if (tr) { const c = tr.cars[R.car], c0 = R.pose, [lu, lv] = carLoc(c0, px, pz), [nx, nz] = carW(c, lu, lv); out.shift = [nx - px, nz - pz, wrapA(c.th - c0.th)]; R.pose = { x: c.x, z: c.z, th: c.th, ux: c.ux, uz: c.uz }; R.tr = tr; out.lvl = 3; out.ride = true; out.si = tr.si; out.cap = YP + 2.0; return out; }
      }
      if (!walking) { P.ride = null; P.movers.length = 0; P.lvl = 0; P.si = -1; P.lastU = null; return out; }
      const mv = P.movers; mv.length = 0;
      if (P.ride) {
        const R = P.ride, tr = active.find((t) => t.key === R.key);
        if (!tr) { P.ride = null; out.toast = '列車開進隧道了'; } else {
          const c = tr.cars[R.car], c0 = R.pose, [lu, lv] = carLoc(c0, px, pz); // 上一格車廂的本地座標 → 這一格的世界座標
          const [nx, nz] = carW(c, lu, lv); out.shift = [nx - px, nz - pz, wrapA(c.th - c0.th)]; R.pose = { x: c.x, z: c.z, th: c.th, ux: c.ux, uz: c.uz };
          R.tr = tr; px = nx; pz = nz;
          carWalls(c, tr.open, mv); zMovers(mv, -1, 0, R.key, R.car);
          const [u2, v2] = carLoc(c, px, pz);
          if (Math.abs(u2) > 12 || Math.abs(v2) > 5) { P.ride = null; P.movers.length = 0; } // 第 82 批：被搬走了（去這裡⋯）：不是坐車了
          else if (tr.open > 0.5 && (Math.abs(v2) > CAR_W + 0.05 || Math.abs(u2) > 6.95)) { P.ride = null; out.toast = `${stations[tr.si].nm}　下車了`; } // 走出車門＝下車
          else {
            if (tr.open < 0.5 && (Math.abs(u2) > 6.9 - 0.3 || Math.abs(v2) > CAR_W - 0.3)) { // 第 82 批：車門關著跑到車廂的牆外面（手機一格很久、轉彎）：拉回車廂裡面
              const cu = clamp(u2, -6.6, 6.6), cv = clamp(v2, -(CAR_W - 0.3), CAR_W - 0.3), [qx, qz] = carW(c, cu, cv); out.shift[0] += qx - px; out.shift[1] += qz - pz; px = qx; pz = qz; }
            if (tr.si >= 0 && tr.si !== R.lastSi && tr.open > 0) { R.lastSi = tr.si; const last = tr.d.stops[tr.d.stops.length - 1].si === tr.si; out.toast = last ? `叮咚！${stations[tr.si].nm}　到了（終點站，請下車）` : `叮咚！${stations[tr.si].nm}　到了`; out.chime = true; }
            if (tr.si >= 0 && tr.open > 0.5) out.action = 'off';
            if (tr.si >= 0 && tr.open === 0 && tr.tau > tr.seg.t0 + 2 && tr.d.stops[tr.d.stops.length - 1].si === tr.si) { // 終點站車門關了還在車上：請他下車（搬到月台上）
              const sd = tr.dir, S = stations[tr.si], [su] = S.loc(px, pz), du = DOOR_U.reduce((a, b) => (Math.abs(b - su) < Math.abs(a - su) ? b : a)), [ex, ez] = S.toW(du, sd * (PV0 + 1.0));
              P.ride = null; out.eject = { x: ex, z: ez, heading: Math.atan2(-(ez - pz), ex - px) }; out.toast = '終點站，請下車'; }
            if (tr.si < 0 && R.lastSi >= 0 && !R.saidNext) { R.saidNext = true; const i = tr.d.stops.findIndex((s) => s.si === R.lastSi), nx2 = tr.d.stops[i + 1]; out.toast = nx2 ? `下一站　${stations[nx2.si].nm}` : `開往 ${BEYOND[tr.dir]}（出了內湖就看不到了）`; }
            if (tr.si >= 0) R.saidNext = false;
          }
        }
        out.lvl = P.ride ? 3 : 2; out.ride = !!P.ride; out.si = tr ? tr.si : P.si; P.lvl = out.lvl; P.si = out.si; out.cap = P.ride ? YP + 2.0 : CEIL2 - 0.15; return out;
      }
      const si = P.at(px, pz), y = P.heightAt(px, pz), lvl = si < 0 ? 0 : P.levelOf(y);
      out.lvl = lvl; out.si = si; P.si = si;
      if (si >= 0 && lvl > 0) { const S = stations[si], [u, v] = S.loc(px, pz); // 鏡頭最高：月台的天花板、大廳的天花板、出入口的罩子（樓梯上照腳下的高度）
        let inC = false; if (lvl === 2) for (const tr of active) if (tr.si === si) for (const c of tr.cars) if (inCar(c, px, pz, 0.35)) inC = true;
        out.cap = lvl === 2 ? (inC ? YP + 2.0 : py >= YP - 0.3 ? CEIL2 - 0.15 : null) : Math.abs(u) <= CU + 0.3 && Math.abs(v) <= CV + 0.3 ? CEIL1 - 0.1 : exitCap(S, u, v); } // 車廂裡 2.2 高、出入口的盒子 3.4 高
      if (si >= 0) for (const e of ESCS) if (e.S === stations[si]) { const [u, v] = e.S.loc(px, pz), lo = Math.min(e.ua, e.ub), hi = Math.max(e.ua, e.ub); // 第 80 批：站在電扶梯上＝跟著往上走
        if (u >= lo - 0.1 && u <= hi + 0.1 && Math.abs(v - e.vc) < e.w / 2) { const f = clamp((u - e.ua) / (e.ub - e.ua), 0, 1), y = e.ya + (e.yb - e.ya) * f; if (Math.abs(py - y) < 0.7 && f < 1) { const d = ESC_V * Math.min(0.2, dt) * Math.sign(e.ub - e.ua); out.shift = [e.S.ux * d, e.S.uz * d, 0]; out.esc = true; } } }
      if (si >= 0 && lvl === 2) {
        const S = stations[si], [u, v] = S.loc(px, pz);
        for (const tr of active) if (tr.si === si) for (const c of tr.cars) carWalls(c, tr.open, mv);
        for (const d of S.psd) { const tr = active.find((t) => t.si === si && t.dir === d.sd), open = tr ? tr.open : 0; if (open < 0.95) { const w = PSD_W / 2 - open * 0.95; if (w > 0.02) for (const q of [-1, 1]) { const [x, z] = S.toW(d.u + q * (PSD_W / 2 - w / 2), d.v); mv.push({ t: 'box', x, z, hx: w / 2, hz: 0.06, rot: S.rot, h: YP + 3.3, y0: YP - 0.3 }); } } }
        for (const tr of active) if (Math.abs(tr.s - S.s) < 80 && tr.open === 0 && (tr.si < 0 || tr.tau > tr.seg.t0 + 2)) for (let i = 0; i < 4; i++) { const c = tr.cars[i], [lu, lv] = carLoc(c, px, pz); // 車門關了（或剛開走）人還在車裡＝上車了
          if (Math.abs(lu) <= 6.9 && Math.abs(lv) <= CAR_W) { P.ride = { key: tr.key, tr, car: i, pose: { x: c.x, z: c.z, th: c.th, ux: c.ux, uz: c.uz }, lastSi: si, saidNext: false }; out.ride = true; out.lvl = 3; out.toast = `上車了！${dirLabel(si, tr.dir)}`; P.lvl = 3; return out; }
          if (Math.abs(lu) <= 6.9 && Math.abs(lv) > CAR_W && Math.abs(lv) < PV0 + 0.2) { const sd = Math.sign(lv) || 1, [ex, ez] = S.toW(u, Math.sign(v || sd) * (PV0 + 0.8)); out.eject = { x: ex, z: ez }; } } // 夾在門口：推回月台
        for (const ev of evs) if (ev.k === 'arrive' && ev.si === si) { out.toast = `叮咚！${dirLabel(si, ev.tr.dir)}的列車進站了`; out.chime = true; }
      }
      if (si >= 0 && lvl === 1) { const S = stations[si], [u] = S.loc(px, pz); if (P.lastU != null) for (const GU of S.gates) if ((P.lastU - GU) * (u - GU) < 0) { out.toast = '嗶！（免費）'; out.beep = true; } P.lastU = u; } else P.lastU = null; // 走過閘門
      if (si >= 0 && (lvl === 1 || lvl === 2)) zMovers(mv, si, lvl === 2 ? YP : YC); // 第 87 批：小動物擋人
      P.lvl = lvl; return out;
    },
    dispose() { group.removeFromParent(); group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); for (const m of Object.values(mats)) m.dispose(); },
  };
  function exitCap(S, u, v) { // 第 80 批：出入口斜的屋頂、翼的天花板：鏡頭最高
    for (const e of S.ent) { const vlo = Math.min(e.v0, e.v1) - 0.3, vhi = Math.max(e.v0, e.v1) + 0.3; if (v >= vlo && v <= vhi && u >= Math.min(e.u0, e.u1) - 0.3 && u <= Math.max(e.u0, e.u1) + 0.3) return e.roofAt(u) - 0.35; }
    return YC + 3.05;
  }
  function carWalls(c, open, mv) { // 一節車廂的牆（走路擋人）：兩邊（車門開著就留口）、兩頭、椅子
    const push = (lu0, lu1, lv, hz) => { const [x, z] = carW(c, (lu0 + lu1) / 2, lv); mv.push({ t: 'box', x, z, hx: (lu1 - lu0) / 2, hz, rot: c.th, h: YP + 2.4, y0: YP - 0.3 }); };
    for (const q of [-1, 1]) { const lv = q * CAR_W, op = q > 0 ? open : 0; // 門只開月台那一邊（行進方向的右手邊）
      push(-6.9, -DOOR_X - DOOR_W / 2, lv, 0.06); push(-DOOR_X + DOOR_W / 2, DOOR_X - DOOR_W / 2, lv, 0.06); push(DOOR_X + DOOR_W / 2, 6.9, lv, 0.06);
      if (op < 0.95) for (const dx of [-DOOR_X, DOOR_X]) { const w = (DOOR_W / 2) * (1 - op); for (const lf of [-1, 1]) push(dx + lf * (DOOR_W / 2) - (lf > 0 ? w : 0), dx + lf * (DOOR_W / 2) + (lf < 0 ? w : 0), lv, 0.05); }
      for (const [x0, x1] of [[-6.6, -4.45], [-2.75, 2.75], [4.45, 6.6]]) push(x0, x1, q * 1.0, 0.2);
    }
    for (const q of [-1, 1]) { const [x, z] = carW(c, q * 6.9, 0); mv.push({ t: 'box', x, z, hx: 0.06, hz: CAR_W, rot: c.th, h: YP + 2.4, y0: YP - 0.3 }); }
  }
  trainsNow(); drawTrains(); drawPsd(); drawSteps(); drawBoards();
  V.group.add(group);
  P.info.ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - T0);
  P.info.colliders = colliders0.length; P.street = colliders0; // 街上的碰撞（柱子、樓梯的牆；測試看有沒有放到車道上）
  if (V.info) V.info.mrt = P.info;
  V.mrt = P;
  const d0 = V.dispose; V.dispose = function () { P.dispose(); return d0 ? d0.apply(this, arguments) : undefined; };
  return P;
}

return { buildMrt, MRT_TEXT, mrtKeepOut, mrtHits };
})();
