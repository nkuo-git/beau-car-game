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
//   M.info                                     { meshes, tris, stations: [...], T, H }
import * as THREE from 'three';

// 整個包在一個函式裡（打包是把檔案接在一起：名字不要跟別的檔案撞到）
export const { buildMrt, MRT_TEXT } = (() => {

const MRT_TEXT = '往文德西湖港墘南港展覽館下一班約秒站出口捷運文湖線終點請下車叮咚月台列車進了到大廳閘門嗶免費本站是';
const rotOf = (ux, uz) => Math.atan2(-uz, ux);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const TAU = Math.PI * 2, wrapA = (a) => { a = (a + Math.PI) % TAU; return a < 0 ? a + Math.PI : a - Math.PI; };
const SANS = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

// ---- 尺寸（公尺）----
const YC = 6.0, CEIL1 = 9.4; // 大廳的地板、天花板（高架橋的底是 9.6）
const PL = 30, PV0 = 3.3, PV1 = 7.8; // 月台：長 ±30、月台門在 3.3、後面的玻璃牆在 7.8
const CU = 22, CV = 9; // 大廳 ±22 × ±9
const RAMP = { u0: 0, u1: 12, v0: 4.4, v1: 6.6 }; // 月台 ↔ 大廳的樓梯（兩邊各一條，v 照 ±）
const GATE_U = -8; // 閘門那一排
const TRK_V = 1.95; // 兩條軌道離中線多遠（往東的在 +v＝行進方向的右手邊；車廂的外側離月台門 3.3 − 1.95 − 1.28 ＝ 7 公分）
const CAR_L = 13.8, CAR_P = 14.4, CAR_W = 1.28, DOOR_X = 3.6, DOOR_W = 1.3, CAR_H = 3.3; // 車廂：長、間距、半寬、車門在 ±3.6（寬 1.3）、車身高
const PSD_W = 1.9; // 月台門一個口的寬
const H = 90, DWELL = 15, VM = 22, ACC = 1.2, CYCLE = 180; // 每 90 秒一班、停 15 秒、最快 22 m/s（80 公里）、1.2 m/s²
const DOOR_U = []; for (let i = 0; i < 4; i++) for (const d of [-DOOR_X, DOOR_X]) DOOR_U.push((i - 1.5) * CAR_P + d);
// 顏色（0–1）
const WHITE = [0.93, 0.93, 0.91], WALL = [0.86, 0.86, 0.84], CONC = [0.70, 0.70, 0.68], TILE = [0.80, 0.78, 0.72], TILE2 = [0.62, 0.63, 0.66], ORA = [0.89, 0.40, 0.12], DARK = [0.22, 0.23, 0.25], STEEL = [0.60, 0.63, 0.66], ALU = [0.76, 0.78, 0.80], GLS = [0.74, 0.86, 0.90], GLSD = [0.30, 0.42, 0.50], BROWN = [0.47, 0.30, 0.17], SEAT = [0.17, 0.33, 0.66], YEL = [0.96, 0.80, 0.15], RED = [0.85, 0.15, 0.12], GREEN = [0.25, 0.70, 0.35];

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
  const geometry = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.setIndex(I); g.computeBoundingSphere(); return g;
  };
  return { quad, hq, vqU, vqV, bx, slopeV, slopeY, stairs, geometry, get tris() { return I.length / 3; }, get empty() { return !I.length; } };
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function fit(g, text, px, maxW) { for (let s = px; s >= 10; s -= 2) { g.font = `700 ${s}px ${SANS}`; if (g.measureText(text).width <= maxW) return s; } return 10; }
function signMat(tex) { const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22, roughness: 0.6, transparent: true }); m.userData.role = 'sign'; return m; } // 只畫正面（背面透過玻璃看到會是反的字）
function texOf(cv) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// 列車跑一段（從停到停）：梯形的速度曲線
function runT(L) { const da = (VM * VM) / (2 * ACC); return L >= 2 * da ? (2 * VM) / ACC + (L - 2 * da) / VM : 2 * Math.sqrt(L / ACC); }
function runP(L, t) { // t 秒以後走了多遠、速度
  const da = (VM * VM) / (2 * ACC), T = runT(L);
  if (t <= 0) return [0, 0]; if (t >= T) return [L, 0];
  if (L >= 2 * da) { const ta = VM / ACC; if (t < ta) return [0.5 * ACC * t * t, ACC * t]; if (t < T - ta) return [da + VM * (t - ta), VM]; const r = T - t; return [L - 0.5 * ACC * r * r, ACC * r]; }
  const th = T / 2; if (t < th) return [0.5 * ACC * t * t, ACC * t]; const r = T - t; return [L - 0.5 * ACC * r * r, ACC * r];
}

function buildMrt(V, opt = {}) {
  const NH = V.neihu; if (!NH || !NH.data) return null;
  const D = NH.data, E = D.elev.find((e) => e.k === 'mrt'); if (!E || !D.stations.length) return null;
  const T0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const group = new THREE.Group(); group.name = 'mrt';
  const YT = E.y, YP = YT + 1.1, CEIL2 = YP + 4.4, ROOF = CEIL2 + 0.5;
  // ---- 軌道（折線）：累積長度、s → 位置和方向、投影 ----
  const TP = E.P, cum = [0]; for (let i = 1; i < TP.length; i++) cum.push(cum[i - 1] + Math.hypot(TP[i][0] - TP[i - 1][0], TP[i][1] - TP[i - 1][1]));
  const LT = cum[cum.length - 1];
  const AT = [0, 0, 1, 0];
  const at = (s, out = AT) => { s = clamp(s, 0, LT); let i = 1; while (i < TP.length - 1 && cum[i] < s) i++; const a = TP[i - 1], b = TP[i], L = cum[i] - cum[i - 1] || 1, t = (s - cum[i - 1]) / L; out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = (b[0] - a[0]) / L; out[3] = (b[1] - a[1]) / L; return out; };
  const proj = (x, z) => { let bs = 0, bd = Infinity; for (let i = 1; i < TP.length; i++) { const a = TP[i - 1], b = TP[i], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1), px = a[0] + dx * t, pz = a[1] + dz * t, d = (x - px) ** 2 + (z - pz) ** 2; if (d < bd) { bd = d; bs = cum[i - 1] + Math.sqrt(L2) * t; } } return bs; };
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
    tglass: new THREE.MeshStandardMaterial({ color: 0x2a3a46, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }),
    leaf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 }),
  };
  let tris = 0, meshes = 0;
  const addMesh = (geo, mat, parent, name) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.frustumCulled = true; parent.add(m); meshes++; tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3; return m; };

  for (let si = 0; si < stations.length; si++) {
    const S = stations[si], ux = S.ux, uz = S.uz, vx = -uz, vz = ux, rot = rotOf(ux, uz);
    const toW = (u, v) => [S.x + ux * u + vx * v, S.z + uz * u + vz * v];
    const sg = new THREE.Group(); sg.name = 'mrt-st-' + S.nm; sg.position.set(S.x, 0, S.z); sg.rotation.y = rot; group.add(sg); S.group = sg;
    const M = mesher(), G = mesher(), LI = mesher();
    const box = (u0, u1, v0, v1, y0, h, tag, extra) => { const [x, z] = toW((u0 + u1) / 2, (v0 + v1) / 2); const c = { t: 'box', x, z, hx: Math.abs(u1 - u0) / 2, hz: Math.abs(v1 - v0) / 2, rot, h, noCrush: true, ...extra }; if (y0 != null) c.y0 = y0; return c; };
    const cols1 = [], cols2 = []; S.cols = { 1: cols1, 2: cols2 };
    // 出入口：哪一邊（s）、樓梯的頭在 u 幾（往 dir 的方向下去 13.5 公尺：3 公尺平台＋10.5 公尺樓梯）、樓梯那條帶子從 v 幾起（往外 3 公尺）；照探針量的：路、人行道、房子都避開
    const ENT = S.nm === '文德' ? [{ s: -1, uTop: -19, vTop: 10.5, dir: 1 }, { s: 1, uTop: 27, vTop: 19, dir: -1 }] : [{ s: 1, uTop: -19, vTop: 19.5, dir: 1 }, { s: -1, uTop: -19, vTop: 21.5, dir: 1 }];
    S.ent = ENT.map((e, i) => { const dir = e.dir || 1, u0 = e.uTop, uS = u0 + 3 * dir, u1 = u0 + 13.5 * dir; return { ...e, dir, n: i + 1, u0, uS, u1, bu0: Math.min(u0, uS), bu1: Math.max(u0, uS), v0: e.vTop * e.s, v1: (e.vTop + 3) * e.s }; });
    S.gates = S.ent.some((e) => e.bu1 > RAMP.u1) ? [GATE_U, 16] : [GATE_U]; // 閘門那幾排（出入口在兩頭的站：兩排，中間是付費區）
    // ==== 月台層 ====
    for (const sd of [-1, 1]) {
      const a = sd * PV0, b = sd * PV1, r0 = sd * RAMP.v0, r1 = sd * RAMP.v1;
      // 地板（厚 0.6）：樓梯的洞那一段分兩塊
      for (const [u0, u1, va, vb] of [[-PL, RAMP.u0, a, b], [RAMP.u0, RAMP.u1, a, r0], [RAMP.u0, RAMP.u1, r1, b], [RAMP.u1, PL, a, b]]) M.bx(u0, u1, YP - 0.6, YP, Math.min(va, vb), Math.max(va, vb), CONC, null, { py: TILE });
      M.hq(-PL, PL, Math.min(a + sd * 0.25, a + sd * 0.55), Math.max(a + sd * 0.25, a + sd * 0.55), YP + 0.004, YEL, true); // 月台邊的黃線
      // 月台門（全高）：門口 1.9 寬，門片另外（InstancedMesh）；固定的玻璃＋門框、上面的橫樑
      let u = -PL;
      const edges = DOOR_U.map((d) => [d - PSD_W / 2, d + PSD_W / 2]);
      for (const [e0, e1] of edges) {
        G.vqV(a, u, e0, YP, YP + 3.0, GLS, sd > 0); M.bx(e0 - 0.08, e0, YP, YP + 3.0, a - 0.05, a + 0.05, WHITE); M.bx(e1, e1 + 0.08, YP, YP + 3.0, a - 0.05, a + 0.05, WHITE);
        G.vqV(a, e0, e1, YP + 2.2, YP + 3.0, GLS, sd > 0); // 門口上面的玻璃
        cols2.push(box(u, e0, a - 0.06, a + 0.06, YP - 0.3, YP + 3.3)); u = e1;
      }
      G.vqV(a, u, PL, YP, YP + 3.0, GLS, sd > 0); cols2.push(box(u, PL, a - 0.06, a + 0.06, YP - 0.3, YP + 3.3));
      M.bx(-PL, PL, YP + 3.0, YP + 3.35, a - 0.12, a + 0.12, WHITE); M.bx(-PL, PL, YP + 3.35, CEIL2, a - 0.06, a + 0.06, WALL); // 橫樑＋到天花板的板子
      // 後面的牆：下面白板、上面玻璃、柱子
      M.bx(-PL, PL, YP, YP + 1.0, b - 0.08, b + 0.08, WALL); G.vqV(b, -PL, PL, YP + 1.0, CEIL2, GLS, sd > 0);
      for (let t = -PL; t <= PL + 0.01; t += 6) M.bx(t - 0.08, t + 0.08, YP, CEIL2, b - 0.1, b + 0.1, WHITE);
      cols2.push(box(-PL, PL, b - 0.1, b + 0.1, YP - 0.3, CEIL2));
      // 兩頭的牆
      M.bx(-PL - 0.15, -PL, YP, CEIL2, Math.min(a, b), Math.max(a, b), WALL); M.bx(PL, PL + 0.15, YP, CEIL2, Math.min(a, b), Math.max(a, b), WALL);
      cols2.push(box(-PL - 0.2, -PL, a, b, YP - 0.3, CEIL2)); cols2.push(box(PL, PL + 0.2, a, b, YP - 0.3, CEIL2));
      // 橘色的柱子、椅子、垃圾桶
      for (const t of [-24, -12, 12, 24]) M.bx(t - 0.18, t + 0.18, YP, CEIL2, sd * 7.1 - 0.18, sd * 7.1 + 0.18, ORA);
      for (const t of [-18, 18]) { M.bx(t - 1.2, t + 1.2, YP + 0.4, YP + 0.48, sd * 7.0 - 0.25, sd * 7.0 + 0.25, STEEL); for (const q of [-1, 1]) M.bx(t + q * 1.0 - 0.04, t + q * 1.0 + 0.04, YP, YP + 0.4, sd * 7.0 - 0.2, sd * 7.0 + 0.2, DARK); cols2.push(box(t - 1.2, t + 1.2, sd * 7.0 - 0.3, sd * 7.0 + 0.3, YP - 0.3, YP + 0.5)); }
      // 樓梯（大廳 → 月台）：36 階、兩邊斜的玻璃欄杆（在月台這一層＝洞的欄杆：橫的）
      M.stairs(RAMP.u0, RAMP.u1, YC, YP, Math.min(r0, r1), Math.max(r0, r1), 36, TILE2, CONC);
      M.slopeY(RAMP.u0, RAMP.u1, Math.min(r0, r1), Math.max(r0, r1), YC - 0.45, YP - 0.45, CONC, false); // 樓梯的底
      for (const rv of [r0, r1]) { G.slopeV(rv, RAMP.u0, RAMP.u1, YC, YP, 1.05, GLS, rv > 0); M.bx(RAMP.u0, RAMP.u1 + 0.001, YC + 1.05, YC + 1.12, rv - 0.03, rv + 0.03, STEEL, ['py', 'ny']); }
      for (const rv of [r0, r1]) { G.vqV(rv, RAMP.u0, RAMP.u1, YP, YP + 1.05, GLS, rv > 0); M.bx(RAMP.u0, RAMP.u1, YP + 1.05, YP + 1.12, rv - 0.03, rv + 0.03, STEEL); cols2.push(box(RAMP.u0, RAMP.u1, rv - 0.05, rv + 0.05, YP - 0.3, YP + 1.2)); cols1.push(box(RAMP.u0, RAMP.u1, rv - 0.05, rv + 0.05, null, YP + 1.2)); }
      G.vqU(RAMP.u0, Math.min(r0, r1), Math.max(r0, r1), YP, YP + 1.05, GLS, true); M.bx(RAMP.u0 - 0.03, RAMP.u0 + 0.03, YP + 1.05, YP + 1.12, Math.min(r0, r1), Math.max(r0, r1), STEEL);
      cols2.push(box(RAMP.u0 - 0.05, RAMP.u0 + 0.05, r0, r1, YP - 0.3, YP + 1.2)); // 洞的低的那一頭
      // 月台的燈（天花板一條）
      LI.hq(-PL + 1, PL - 1, sd * 5.5 - 0.15, sd * 5.5 + 0.15, CEIL2 - 0.02, [1, 1, 1], false);
    }
    // 屋頂（整個站，含軌道上面）：天花板白、上面灰
    M.bx(-PL - 1.5, PL + 1.5, CEIL2, ROOF, -(PV1 + 0.8), PV1 + 0.8, CONC, null, { ny: WHITE, py: [0.52, 0.54, 0.56] });
    for (let t = -PL + 6; t <= PL - 6; t += 12) M.bx(t - 0.25, t + 0.25, CEIL2 - 0.5, CEIL2, -PV1 - 0.6, PV1 + 0.6, ORA); // 橫樑
    // 軌道旁邊（月台門裡面）：兩條軌道的導軌墩（深色）
    for (const tv of [-TRK_V, TRK_V]) for (const q of [-1.05, 1.05]) M.bx(-PL, PL, YT, YT + 0.12, tv + q - 0.22, tv + q + 0.22, DARK, ['py', 'pv', 'nv']);
    // ==== 大廳層 ====
    M.bx(-CU, CU, YC - 0.5, YC, -CV, CV, CONC, null, { py: TILE2 });
    for (const [u0, u1, v0, v1] of [[-CU, 2, -CV, CV], [2, RAMP.u1, -RAMP.v0, RAMP.v0], [2, RAMP.u1, RAMP.v1, CV], [2, RAMP.u1, -CV, -RAMP.v1], [RAMP.u1, CU, -CV, CV]]) M.bx(u0, u1, CEIL1, CEIL1 + 0.2, v0, v1, WHITE, null, { py: CONC }); // 天花板（樓梯穿過去的地方挖掉）
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
    M.bx(-15, -12.5, YC, YC + 1.1, -CV + 0.4, -CV + 1.9, [0.55, 0.42, 0.30], null, { py: ALU }); cols1.push(box(-15, -12.5, -CV + 0.4, -CV + 1.9, YC - 0.3, YC + 1.2));
    for (const t of [-17.5, -16.5, -15.5]) { M.bx(t - 0.4, t + 0.4, YC, YC + 1.8, CV - 1.0, CV - 0.3, [0.26, 0.36, 0.60], null, { nv: [0.75, 0.80, 0.86] }); cols1.push(box(t - 0.4, t + 0.4, CV - 1.0, CV - 0.3, YC - 0.3, YC + 1.9)); }
    for (const t of [-14, 14]) for (const q of [-3, 3]) { M.bx(t - 0.2, t + 0.2, YC, CEIL1, q - 0.2, q + 0.2, ORA); cols1.push(box(t - 0.2, t + 0.2, q - 0.2, q + 0.2, YC - 0.3, CEIL1)); }
    // ==== 天橋＋出入口的樓梯（每個出入口）====
    for (const e of S.ent) {
      const sd = e.s, dr = e.dir, vIn = sd * CV, vOut = e.v0, b0 = e.bu0, b1 = e.bu1, lo = Math.min(vIn, vOut), hi = Math.max(vIn, vOut);
      const R2 = (a, b) => [Math.min(a, b), Math.max(a, b)];
      // 天橋：3 公尺寬（b0…b1），從大廳的牆到樓梯的平台；地板、兩邊欄杆、屋頂＋柱子
      M.bx(b0, b1, YC - 0.4, YC, lo, hi, CONC, null, { py: TILE2 });
      for (const uu of [b0, b1]) { G.vqU(uu, lo, hi, YC, YC + 1.1, GLS, uu === b0); M.bx(uu - 0.04, uu + 0.04, YC + 1.1, YC + 1.17, lo, hi, STEEL); cols1.push(box(uu - 0.06, uu + 0.06, lo, hi, YC - 0.3, YC + 1.3)); }
      M.bx(b0 - 0.3, b1 + 0.3, YC + 2.9, YC + 3.1, lo - 0.3, hi + 0.3, ALU, null, { ny: WHITE });
      for (const uu of [b0 + 0.1, b1 - 0.1]) for (const vv of [lo + 0.3, hi - 0.3]) M.bx(uu - 0.06, uu + 0.06, YC + 1.1, YC + 2.9, vv - 0.06, vv + 0.06, STEEL);
      { const um = (b0 + b1) / 2, vm = (vIn + vOut) / 2, [cx, cz] = toW(um, vm); if (Math.abs(vOut - vIn) > 4 && !onRoad(cx, cz, 0.8)) { M.bx(um - 0.35, um + 0.35, 0, YC - 0.4, vm - 0.35, vm + 0.35, CONC); colliders0.push(box(um - 0.35, um + 0.35, vm - 0.35, vm + 0.35, null, YC - 0.4)); } }
      // 樓梯的帶子：平台（u0…uS）在 YC，樓梯 uS…u1 下到 0（往 dir 的方向）；兩邊鋁板的牆（到踏面上面 2.6）、斜的罩子、門口的平罩子
      const va = Math.min(e.v0, e.v1), vb = Math.max(e.v0, e.v1), [p0, p1] = R2(e.u0, e.uS), [s0, s1] = R2(e.uS, e.u1), yAt = (u) => YC * (1 - (u - e.uS) / (e.u1 - e.uS));
      M.bx(p0, p1, YC - 0.4, YC, va, vb, CONC, null, { py: TILE2 });
      M.stairs(e.uS, e.u1, YC, 0, va, vb, 35, TILE2, CONC);
      M.slopeY(s0, s1, va, vb, yAt(s0) - 0.4, yAt(s1) - 0.4, CONC, false); // 樓梯的底（斜的）
      // 出入口＝一個高的玻璃盒子（第 78 批第 2 版：平的屋頂在 YC + 3.4，鏡頭跟在後面、在樓梯上面也不會穿出罩子）：下面 1.1 鋁板、上面玻璃；天橋接進來那一邊的平台沒有牆
      const HT = YC + 3.4, bridgeSide = (vv) => Math.abs(vv - e.v0) < 1e-6, og = (vv) => vv + (vv > (va + vb) / 2 ? 0.03 : -0.03);
      for (const vv of [va, vb]) {
        M.slopeV(vv, s0, s1, yAt(s0), yAt(s1), 1.1, ALU, vv > 0); G.vqV(og(vv), s0, s1, 1.1, HT, GLS, vv > 0); // 樓梯旁邊：斜的鋁板＋玻璃到屋頂
        if (!bridgeSide(vv)) { M.bx(p0, p1, YC, YC + 1.1, vv - 0.06, vv + 0.06, ALU); G.vqV(og(vv), p0, p1, YC + 1.1, HT, GLS, vv > 0); } // 平台旁邊
      }
      M.bx(...R2(e.u0, e.u0 - 0.1 * dr), YC, YC + 1.1, va, vb, ALU); G.vqU(e.u0 - 0.05 * dr, va, vb, YC + 1.1, HT, GLS, dr < 0); // 平台外面那一頭的牆（上面玻璃）
      G.vqU(e.u1 + 0.05 * dr, va, vb, 2.7, HT, GLS, dr > 0); // 門口上面的玻璃
      M.bx(...R2(e.u0 - 0.3 * dr, e.u1 + 0.3 * dr), HT, HT + 0.2, va - 0.25, vb + 0.25, ALU, null, { ny: WHITE }); // 平的屋頂（整條：平台＋樓梯）
      M.bx(...R2(e.u1, e.u1 + 1.6 * dr), 2.5, 2.7, va - 0.25, vb + 0.25, ALU, null, { ny: WHITE }); // 門口外面的平罩子
      for (const vv of [va - 0.15, vb + 0.15]) M.bx(...R2(e.u1 + 1.2 * dr, e.u1 + 1.4 * dr), 0, 2.5, vv - 0.1, vv + 0.1, ALU); // 門口的柱子
      M.bx(...R2(e.u0 - 0.1 * dr, e.u0 + 0.9 * dr), 0, 0.5, va - 0.3, vb + 0.3, [0.66, 0.64, 0.60]); // 花崗岩的台座（樓梯頭下面）
      M.bx(p0 - 0.1, p1 + 0.1, 0.5, YC - 0.4, va - 0.1, vb + 0.1, ALU); // 平台下面包起來（鋁板的小房子）
      for (const vv of [va, vb]) { // 兩邊的牆：街上、大廳那一層都擋（樓梯那段兩邊都有；平台那段天橋那一邊沒有）
        const c = box(...R2(e.uS, e.u1), vv - 0.1, vv + 0.1, null, HT); colliders0.push(c); cols1.push(c);
        if (!bridgeSide(vv)) { const c2 = box(...R2(e.u0 - 0.1 * dr, e.uS), vv - 0.1, vv + 0.1, null, HT); colliders0.push(c2); cols1.push(c2); }
      }
      { const c = box(...R2(e.u0 - 0.15 * dr, e.u0), va, vb, null, HT); colliders0.push(c); cols1.push(c); }
      for (const vv of [va - 0.15, vb + 0.15]) colliders0.push(box(...R2(e.u1 + 1.2 * dr, e.u1 + 1.4 * dr), vv - 0.12, vv + 0.12, null, 2.5));
      e.sign = { u: e.u1 + 1.62 * dr, v: (va + vb) / 2, y: 2.2, w: 3.0, h: 0.55, face: dr > 0 ? 'pu' : 'nu' }; // 門口的罩子前面的牌子（朝走過來的人）
    }
    // ==== 柱子（街上）：月台邊 ±8.6、中間 0；車道上不放 ====
    for (const t of [-27, -16, -5, 6, 17, 27]) for (const vv of [-8.6, 8.6]) { const [x, z] = toW(t, vv); if (onRoad(x, z, 0.6)) continue; M.bx(t - 0.45, t + 0.45, 0, YP - 0.6, vv - 0.45, vv + 0.45, CONC); colliders0.push(box(t - 0.5, t + 0.5, vv - 0.5, vv + 0.5, null, YP - 0.6)); }
    for (const t of [-21, -10, 10, 21]) { const [x, z] = toW(t, 0); if (onRoad(x, z, 0.6)) continue; M.bx(t - 0.4, t + 0.4, 0, YC - 0.5, -0.4, 0.4, CONC); colliders0.push(box(t - 0.45, t + 0.45, -0.45, 0.45, null, YC - 0.5)); }
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
  // ==== 列車：一節車廂的幾何（本地：x 往前、y 從橋面起、z 左右）====
  const carGeo = (() => {
    const C = mesher(), hw = CAR_W, f0 = 1.1, hb = f0 + CAR_H; // 地板 1.1、車頂 4.4
    C.bx(-6.9, 6.9, 0.55, f0, -1.15, 1.15, DARK); // 底架
    for (const bx0 of [-4.6, 4.6]) { C.bx(bx0 - 1.1, bx0 + 1.1, 0.2, 0.6, -1.0, 1.0, [0.16, 0.17, 0.18]); for (const q of [-1, 1]) for (const w of [-0.75, 0.75]) C.bx(bx0 + w - 0.3, bx0 + w + 0.3, 0, 0.95, q * 0.95 - 0.16, q * 0.95 + 0.16, [0.1, 0.1, 0.1]); }
    const pieces = [[-6.9, -6.5, 's'], [-6.5, -4.6, 'w'], [-4.6, -DOOR_X - DOOR_W / 2, 's'], [-DOOR_X - DOOR_W / 2, -DOOR_X + DOOR_W / 2, 'd'], [-DOOR_X + DOOR_W / 2, -2.7, 's'], [-2.7, -0.3, 'w'], [-0.3, 0.3, 's'], [0.3, 2.7, 'w'], [2.7, DOOR_X - DOOR_W / 2, 's'], [DOOR_X - DOOR_W / 2, DOOR_X + DOOR_W / 2, 'd'], [DOOR_X + DOOR_W / 2, 4.6, 's'], [4.6, 6.5, 'w'], [6.5, 6.9, 's']];
    const y0 = f0, yb0 = f0 + 0.95, yb1 = f0 + 1.1, yw1 = f0 + 2.25, yt = f0 + 2.5, ydoor = f0 + 1.9;
    for (const q of [-1, 1]) { const z = q * hw, pos = q > 0;
      const V2 = (x0, x1, a, b, col) => C.vqV(z, x0, x1, a, b, col, pos);
      for (const [x0, x1, k] of pieces) {
        if (k === 's') { V2(x0, x1, y0, yb0, WHITE); V2(x0, x1, yb0, yb1, BROWN); V2(x0, x1, yb1, yt, WHITE); }
        else if (k === 'w') { V2(x0, x1, y0, yb0, WHITE); V2(x0, x1, yb0, yb1, BROWN); V2(x0, x1, yw1, yt, WHITE); }
        else { V2(x0, x1, ydoor, yt, WHITE); }
      }
      // 車頂的斜面
      C.quad(pos ? [-6.9, yt, z] : [6.9, yt, z], pos ? [6.9, yt, z] : [-6.9, yt, z], pos ? [6.9, hb, q * 0.9] : [-6.9, hb, q * 0.9], pos ? [-6.9, hb, q * 0.9] : [6.9, hb, q * 0.9], [0.84, 0.84, 0.82]);
      // 裡面的椅子（避開車門）
      for (const [x0, x1] of [[-6.6, -4.45], [-2.75, 2.75], [4.45, 6.6]]) { C.bx(x0, x1, f0, f0 + 0.45, Math.min(q * 0.82, q * 1.2), Math.max(q * 0.82, q * 1.2), SEAT); C.bx(x0, x1, f0 + 0.45, f0 + 1.05, Math.min(q * 1.13, q * 1.2), Math.max(q * 1.13, q * 1.2), SEAT); }
    }
    C.hq(-6.9, 6.9, -0.9, 0.9, hb, [0.84, 0.84, 0.82], true); // 車頂
    C.hq(-6.9, 6.9, -hw, hw, f0 + 0.01, [0.42, 0.44, 0.47], true); C.hq(-6.9, 6.9, -hw, hw, f0 + 2.3, WHITE, false); // 地板、天花板
    for (const q of [-1, 1]) C.hq(-6.6, 6.6, q * 0.5 - 0.08, q * 0.5 + 0.08, f0 + 2.29, [1, 1, 0.95], false); // 車裡的燈
    for (const q of [-1, 1]) { const x = q * 6.9, neg = q < 0; // 兩頭（駕駛室的樣子：白色、咖啡色的帶子、大窗（玻璃另外）、車燈）
      C.vqU(x, -hw, hw, y0, yb0, WHITE, neg); C.vqU(x, -hw, hw, yb0, yb1, BROWN, neg); C.vqU(x, -hw, -0.95, yb1, yt, WHITE, neg); C.vqU(x, 0.95, hw, yb1, yt, WHITE, neg); C.vqU(x, -0.95, 0.95, yt - 0.25, yt, WHITE, neg);
      C.vqU(x, -hw, hw, yt, hb, [0.84, 0.84, 0.82], neg);
      for (const s of [-0.85, 0.85]) C.vqU(x + q * 0.01, s - 0.14, s + 0.14, y0 + 0.45, y0 + 0.65, [1, 0.97, 0.8], neg);
      for (const s of [-0.5, 0.5]) C.vqU(x + q * 0.01, s - 0.12, s + 0.12, y0 + 0.45, y0 + 0.65, RED, neg);
    }
    return C.geometry();
  })();
  const carGlass = (() => { const Gm = mesher(), hw = CAR_W, f0 = 1.1, yb1 = f0 + 1.1, yw1 = f0 + 2.25; for (const q of [-1, 1]) { for (const [x0, x1] of [[-6.5, -4.6], [-2.7, -0.3], [0.3, 2.7], [4.6, 6.5]]) Gm.vqV(q * hw, x0, x1, yb1, yw1, [1, 1, 1], q > 0); } for (const q of [-1, 1]) Gm.vqU(q * 6.9, -0.95, 0.95, yb1, f0 + 2.25, [1, 1, 1], q < 0); return Gm.geometry(); })();
  const carLeaf = (() => { const Lm = mesher(); Lm.bx(-DOOR_W / 4, DOOR_W / 4, 1.1, 3.0, -0.03, 0.03, WHITE, null, { pv: GLSD, nv: GLSD }); Lm.bx(-DOOR_W / 4, DOOR_W / 4, 1.1, 2.0, -0.035, 0.035, WHITE); Lm.bx(-DOOR_W / 4, -DOOR_W / 4 + 0.07, 1.1, 3.0, -0.035, 0.035, WHITE); Lm.bx(DOOR_W / 4 - 0.07, DOOR_W / 4, 1.1, 3.0, -0.035, 0.035, WHITE); return Lm.geometry(); })();
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
  meshes += 3; tris += (carGeo.index.count / 3 + carGlass.index.count / 3 + (carLeaf.index.count / 3) * 8) * maxAct * 4;
  const posAt = (d, tau) => { // → { p, v, open, si（停著的站，沒有＝−1）, seg }
    for (const s of d.segs) if (tau < s.t1 || s === d.segs[d.segs.length - 1]) {
      if (s.k === 'dwell') return { p: s.p, v: 0, open: clamp(Math.min(tau - s.t0 - 0.8, s.t1 - tau - 0.8) / 1.2, 0, 1), si: s.si, seg: s };
      const [q, v] = runP(s.L, tau - s.t0); return { p: s.p0 + q, v, open: 0, si: -1, seg: s };
    }
    return null;
  };
  // ---- 狀態 ----
  let time = (Date.now() / 1000) % CYCLE;
  const active = []; // 現在在跑的列車：{ dir, k, d, tau, p, s, open, si, cars: [{ x, z, th }], key }
  const prev = new Map(); // key → 上一格的 open（叮咚）
  const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3(1, 1, 1), ZERO = new THREE.Matrix4().makeScale(0, 0, 0), YAX = new THREE.Vector3(0, 1, 0);
  const events = [];
  function trainsNow() {
    active.length = 0;
    for (const d of dirs) {
      const k1 = Math.floor((time - d.phase) / H), k0 = Math.ceil((time - d.phase - d.total) / H);
      for (let k = k0; k <= k1; k++) { const tau = time - d.phase - k * H; if (tau < 0 || tau >= d.total) continue; const ps = posAt(d, tau); if (!ps) continue;
        const key = `${d.dir}:${((k % 1000) + 1000) % 1000}`, s = d.dir > 0 ? sA + ps.p : sB - ps.p, tr = { dir: d.dir, k, d, tau, p: ps.p, s, open: ps.open, si: ps.si, seg: ps.seg, v: ps.v, cars: [], key };
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
    let n = 0, nd = 0;
    for (const tr of active) for (const c of tr.cars) {
      Q4.setFromAxisAngle(YAX, c.th); V3.set(c.x, YT, c.z); M4.compose(V3, Q4, S3); carIM.setMatrixAt(n, M4); glsIM.setMatrixAt(n, M4); n++;
      for (const q of [-1, 1]) for (const dx of [-DOOR_X, DOOR_X]) for (const lf of [-1, 1]) { const off = lf * (DOOR_W / 4 + (q > 0 ? tr.open : 0) * (DOOR_W / 2)), lu = dx + off, lv = q * (CAR_W - 0.06), [x, z] = carW(c, lu, lv); V3.set(x, YT, z); M4.compose(V3, Q4, S3); dorIM.setMatrixAt(nd++, M4); } // 只開月台那一邊（右手邊）的門
    }
    carIM.count = n; glsIM.count = n; dorIM.count = nd; carIM.instanceMatrix.needsUpdate = true; glsIM.instanceMatrix.needsUpdate = true; dorIM.instanceMatrix.needsUpdate = true;
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
  // ---- 走路的人 ----
  const P = {
    group, stations, info: { meshes, tris: Math.round(tris), stations: stations.map((s) => s.nm), T: CYCLE, H, dwell: DWELL, maxTrains: maxAct, sA, sB, len: sB - sA, dirs: dirs.map((d) => ({ dir: d.dir, phase: d.phase, total: Math.round(d.total * 10) / 10, stops: d.stops.map((s) => Math.round(s.p)), dwells: d.segs.filter((s) => s.k === 'dwell').map((s) => ({ si: s.si, t0: Math.round(s.t0 * 10) / 10, t1: Math.round(s.t1 * 10) / 10 })) })) },
    YT, YP, YC, ride: null, lvl: 0, si: -1, py: 0, movers: [],
    get time() { return time; }, setTime(t) { time = ((t % CYCLE) + CYCLE) % CYCLE; prev.clear(); trainsNow(); events.length = 0; },
    trains: () => active.map((t) => ({ dir: t.dir, k: t.k, p: Math.round(t.p * 10) / 10, s: Math.round(t.s * 10) / 10, x: t.cars[0].x, z: t.cars[0].z, stop: t.si, si: t.si, open: t.open, v: t.v, tau: Math.round(t.tau * 10) / 10, cars: t.cars.map((c) => ({ x: c.x, z: c.z, th: c.th, ux: c.ux, uz: c.uz })) })),
    at(x, z) { for (let i = 0; i < stations.length; i++) { const [u, v] = stations[i].loc(x, z); if (Math.abs(u) < 50 && Math.abs(v) < 32) return i; } return -1; },
    loc: (si, x, z) => stations[si].loc(x, z), toW: (si, u, v) => stations[si].toW(u, v),
    cols: (si, lvl) => (si >= 0 && stations[si].cols[lvl]) || [],
    dirLabel,
    heightAt(x, z) { // 候選的高度裡挑最接近上一格的（大廳在月台下面、街在天橋下面：夾層）
      if (P.ride) { const c = P.ride.tr.cars[P.ride.car]; if (inCar(c, x, z, 1.0)) return YP; }
      const si = P.at(x, z); if (si < 0) return null; const S = stations[si], [u, v] = S.loc(x, z), av = Math.abs(v), cand = [];
      if (Math.abs(u) <= PL + 0.2 && av >= PV0 - 0.4 && av <= PV1 + 0.3) { if (u >= RAMP.u0 && u <= RAMP.u1 && av >= RAMP.v0 && av <= RAMP.v1) return YC + ((YP - YC) * (u - RAMP.u0)) / (RAMP.u1 - RAMP.u0); cand.push(YP); }
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
      time = (time + Math.max(0, Math.min(0.2, +dt || 0))) % CYCLE; trainsNow();
      if (camera) { camP[0] = camera.position.x; camP[1] = camera.position.z; }
      let near = false; for (const S of stations) { const d = Math.hypot(S.x - camP[0], S.z - camP[1]); S.group.visible = d < 1500; if (d < 2600) near = true; }
      carIM.visible = glsIM.visible = dorIM.visible = psdIM.visible = near;
      if (near) { drawTrains(); drawPsd(); if (time - boardT > 1 || time < boardT) { boardT = time; drawBoards(); } }
    },
    // 走路的人在 (px, pz)、腳下 py；回傳這一格要做的事
    step(dt, px, pz, py, walking) {
      const out = { shift: null, lvl: 0, si: -1, ride: !!P.ride, toast: null, chime: false, beep: false, action: null, eject: null, cap: null }, evs = events.splice(0); // cap＝鏡頭最高（天花板、罩子）
      P.py = py;
      if (!walking) { P.ride = null; P.movers.length = 0; P.lvl = 0; P.si = -1; P.lastU = null; return out; }
      const mv = P.movers; mv.length = 0;
      if (P.ride) {
        const R = P.ride, tr = active.find((t) => t.key === R.key);
        if (!tr) { P.ride = null; out.toast = '列車開進隧道了'; } else {
          const c = tr.cars[R.car], c0 = R.pose, [lu, lv] = carLoc(c0, px, pz); // 上一格車廂的本地座標 → 這一格的世界座標
          const [nx, nz] = carW(c, lu, lv); out.shift = [nx - px, nz - pz, wrapA(c.th - c0.th)]; R.pose = { x: c.x, z: c.z, th: c.th, ux: c.ux, uz: c.uz };
          R.tr = tr; px = nx; pz = nz;
          carWalls(c, tr.open, mv);
          const [u2, v2] = carLoc(c, px, pz);
          if (tr.open > 0.5 && (Math.abs(v2) > CAR_W + 0.05 || Math.abs(u2) > 6.95)) { P.ride = null; out.toast = `${stations[tr.si].nm}　下車了`; } // 走出車門＝下車
          else {
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
        out.cap = lvl === 2 ? (inC ? YP + 2.0 : py >= YP - 0.3 ? CEIL2 - 0.15 : null) : Math.abs(u) <= CU + 0.3 && Math.abs(v) <= CV + 0.3 ? CEIL1 - 0.1 : YC + 3.2; } // 車廂裡 2.2 高、出入口的盒子 3.4 高
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
      P.lvl = lvl; return out;
    },
    dispose() { group.removeFromParent(); group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); for (const m of Object.values(mats)) m.dispose(); },
  };
  function carWalls(c, open, mv) { // 一節車廂的牆（走路擋人）：兩邊（車門開著就留口）、兩頭、椅子
    const push = (lu0, lu1, lv, hz) => { const [x, z] = carW(c, (lu0 + lu1) / 2, lv); mv.push({ t: 'box', x, z, hx: (lu1 - lu0) / 2, hz, rot: c.th, h: YP + 2.4, y0: YP - 0.3 }); };
    for (const q of [-1, 1]) { const lv = q * CAR_W, op = q > 0 ? open : 0; // 門只開月台那一邊（行進方向的右手邊）
      push(-6.9, -DOOR_X - DOOR_W / 2, lv, 0.06); push(-DOOR_X + DOOR_W / 2, DOOR_X - DOOR_W / 2, lv, 0.06); push(DOOR_X + DOOR_W / 2, 6.9, lv, 0.06);
      if (op < 0.95) for (const dx of [-DOOR_X, DOOR_X]) { const w = (DOOR_W / 2) * (1 - op); for (const lf of [-1, 1]) push(dx + lf * (DOOR_W / 2) - (lf > 0 ? w : 0), dx + lf * (DOOR_W / 2) + (lf < 0 ? w : 0), lv, 0.05); }
      for (const [x0, x1] of [[-6.6, -4.45], [-2.75, 2.75], [4.45, 6.6]]) push(x0, x1, q * 1.0, 0.2);
    }
    for (const q of [-1, 1]) { const [x, z] = carW(c, q * 6.9, 0); mv.push({ t: 'box', x, z, hx: 0.06, hz: CAR_W, rot: c.th, h: YP + 2.4, y0: YP - 0.3 }); }
  }
  trainsNow(); drawTrains(); drawPsd(); drawBoards();
  V.group.add(group);
  P.info.ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - T0);
  P.info.colliders = colliders0.length; P.street = colliders0; // 街上的碰撞（柱子、樓梯的牆；測試看有沒有放到車道上）
  if (V.info) V.info.mrt = P.info;
  V.mrt = P;
  const d0 = V.dispose; V.dispose = function () { P.dispose(); return d0 ? d0.apply(this, arguments) : undefined; };
  return P;
}

return { buildMrt, MRT_TEXT };
})();
