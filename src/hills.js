// ---- 山、隧道、海邊（第 27 批）：每座山都開得上去、兩條隧道、拿掉看不到的牆以後地圖最外面一圈是沙灘和海 ----
// Nick 2026-10-23「每座山都可開／要有隧道／往內湖的那個車庫會被山擋住／不要空氣屏障」；草稿 https://claude.ai/artifact/NZ8YUwjuVLyJ4EPExuh7YZ ，地圖的邊 Nick 選「海邊」
// 以前的山（village.js 的 hill()：快速道路一圈裡面兩座、遠的一圈 12 座、村子南邊 3＋2 座；race.src.js 賽車場北邊 3 個半球）只是畫上去的，車子會穿過去：
//   現在全部照這裡的清單（HILL_LIST）長成真的地形：每座山自己一張格子（3.5–13 公尺一格），heightAt 跟畫出來的三角形一模一樣（對角線 00–11，跟 mountain.js 一樣）
//   山變矮一點（高 ÷ 半徑 ≈ 0.33，最陡大約 30°，不超過 35°）：一般的車開得上去（草地限速 50），陡的地方慢慢爬；山上的樹有碰撞（怪獸卡車輾得扁，跟山上的樹一樣）
//   4 號家（往內湖的聯外道路西邊）旁邊那座 (−214, 182) 往西搬到 (−262, 196)：塔外面的斜坡露出來
// 隧道（都是沿著 z 的直路）：快速道路西邊直線（x −1030，雙孔：中間護欄那裡一道牆）穿過新的山 (−1012, −140)；往內湖的聯外道路（x −112）穿過新的山 (−122, 243)（橫的長圓）
//   山比路高 9.4 公尺以上的那段＝隧道（拱頂 7.4）；山腳到洞口＝挖開的路（兩邊擋土牆，牆頂多 0.8 公尺當欄杆）；洞口一面水泥牆＋名牌
//   兩層：開在路上（下面）＝隧道的牆擋、地面＝路；開到山上（上面）＝山的地面、洞口上面的欄杆擋。誰在哪一層：只有玩家（town.src.js 的 proxyWorld 問 high）；
//   車流、警察、路人用 V.heightAt（隧道那段永遠是路）
//   隧道裡面：牆、拱頂不打光（MeshBasic），燈一排一排，路面蓋一層黑（暗一點）；鏡頭在隧道裡面，太陽、天空光變暗（update）
// 海邊：島＝圓角長方形（水邊 x −1830…2560、z −1280…2380，圓角 320）；水邊往裡 70 公尺是沙灘（從 0 慢慢低到海面 −0.55），往外海底越來越深
//   村子、內湖外面一圈的山（neihu.js 的格子）以外沒有地的地方鋪草地（40 公尺一格，跟沙灘、海底同一張）；海面一大片（中間挖掉陸地）
//   路面（surfaceAt）：7 沙、9 淺水（限速 12）、10 深水（開不動，倒車出得來）；走路走不進深水（walkable）；第一次開進深水「前面是海」（town.src.js）
// 400 公尺直線加速的盡頭（x 761）本來是看不到的牆：拿掉了，後面接一段沙地（x 760…1000）慢慢停下來
// 座標跟 village.js 一樣：x 往東、y 往上、z 往南
// 【API】
//   await hillsFonts();                    隧道名牌的字
//   const HL = buildHills(V, { renderer })  V＝buildVillage()（buildMountain 之後）；山、隧道、海加進 V.group、V.colliders；V.heightAt、normalAt、terrainAt、surfaceAt、mapDraw 包一層
//   V.hills＝HL：{ tunAt(x, z)（在隧道那段的範圍裡：第幾條，不然 −1）, topAt(x, z)（山的地面：上面那一層）, high（玩家在上面那層）, level(y)（每幀：玩家多高 → 換層、換碰撞）,
//                  inside(x, z, y)（在隧道裡面、下面那層：鏡頭天花板、變暗）, ceil, depth(x, z)（水多深）, walkable(x, z), update(dt, camera, scene), info }
//   HILL_LIST、hillH(x, z)（山比地面高多少：放東西前看一下）、inTunnel(x, z, pad)（隧道那段，village.js 的路燈、牌子不要放）、COAST、coastD(x, z)
// 效能：山 6 個網格（照位置分）、樹 1 個、隧道 3 個（牆＋洞口、燈、路面的黑）、島 1 個、海 1 個、名牌 1 個；碰撞都是一般的盒子、圓
import * as THREE from 'three';
import { TOWER_RAMP } from './tower.js';

export const { buildHills, hillsFonts, HILL_TEXT, HILL_LIST, hillH, inTunnel, tunnels, COAST, coastD, coastY } = (() => {
const TAU = Math.PI * 2;
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", "WenQuanYi Zen Hei", sans-serif';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (e0, e1, v) => { const t = clamp((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { // 固定種子的亂數（每次蓋出來都一樣）
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash2 = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul((b | 0) + 7, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, z, f, seed) { // −1…1
  const X = x * f, Z = z * f, i = Math.floor(X), j = Math.floor(Z), u = X - i, v = Z - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash2(i + seed, j), b = hash2(i + 1 + seed, j), c = hash2(i + seed, j + 1), d = hash2(i + 1 + seed, j + 1);
  return lerp(lerp(a, b, su), lerp(c, d, su), sv) * 2 - 1;
}
const CC = new Map();
const C = (hex) => { let v = CC.get(hex); if (!v) { const c = new THREE.Color(hex); v = [c.r, c.g, c.b]; CC.set(hex, v); } return v; }; // 線性顏色
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---- 山的清單：中心、半徑、高、種子、樹幾棵（t）、隧道（tun：TUN 的第幾條）----
const HILL_LIST = [
  { x: -800, z: -165, r: 135, h: 46, s: 21, t: 20 }, { x: -805, z: 185, r: 145, h: 48, s: 22, t: 22 }, // 快速道路一圈裡面（原本 72、80 公尺高）
  { x: -1330, z: -890, r: 270, h: 88, s: 29 }, { x: -990, z: -930, r: 260, h: 84, s: 33 }, { x: -660, z: -910, r: 250, h: 80, s: 34 }, { x: -420, z: -935, r: 210, h: 70, s: 35 }, // 遠的一圈：北（最東邊那座往北挪：不要蓋到山（mountain.js）山腳的樹）
  { x: -1480, z: -560, r: 250, h: 82, s: 31 }, { x: -1470, z: -170, r: 250, h: 80, s: 39 }, { x: -1480, z: 220, r: 260, h: 86, s: 32 }, { x: -1470, z: 600, r: 240, h: 78, s: 40 }, // 西
  { x: -1330, z: 890, r: 270, h: 88, s: 30 }, { x: -990, z: 930, r: 250, h: 80, s: 36 }, { x: -660, z: 910, r: 260, h: 84, s: 37 }, { x: -400, z: 880, r: 220, h: 70, s: 38 }, // 南
  { x: -430, z: 184, r: 76, h: 25, s: 15, t: 14 }, { x: -330, z: 192, r: 86, h: 28, s: 16, t: 18 }, { x: -262, z: 196, r: 86, h: 28, s: 17, t: 16 }, // 村子南邊（東邊那座本來在 (−214, 182)：蓋到 4 號家的斜坡；另外兩座往南一點：不要碰到村子南邊的路燈、樹）
  { x: -300, z: 540, r: 210, h: 70, s: 27 }, { x: -230, z: 680, r: 190, h: 62, s: 28 }, // 村子南邊遠的（第一座本來在 (−320, 500) 半徑 230：蓋到快速道路旁邊的透天厝、鐵皮工廠）
  { x: 120, z: -985, r: 150, h: 42, s: 41 }, { x: 560, z: -1010, r: 170, h: 48, s: 42 }, { x: 1000, z: -975, r: 140, h: 39, s: 43 }, // 賽車場北邊（race.src.js 本來的半球；往北挪一點，不要蓋到賽車場的樹）
  { x: -1012, z: -140, r: 105, h: 36, s: 51, t: 14, tun: 0 }, // 快速道路隧道的山
  { x: -122, z: 243, r: 82, rx: 82, rz: 54, h: 22, s: 52, t: 9, tun: 1 }, // 內湖隧道的山（橫的長圓：北邊不要碰到 4 號家，南邊不要蓋到聯外道路轉彎的地方）
];
const KOUT = 1.12; // 山的邊最多凸出去多少（外形不是正圓）
// 山比地面高多少（≤ 0：不在山上）；外形：(1 − u²)^1.5（最陡在半山腰）×（1 ± 5% 大雜訊）＋ 0.15 公尺小起伏；邊上歪歪的（不是正圓）；rx、rz：長圓的山（沒有就是 r）
const RX = (H) => H.rx || H.r, RZ = (H) => H.rz || H.r;
function shapeH(H, x, z) {
  const dx = (x - H.x) / RX(H), dz = (z - H.z) / RZ(H), d2 = dx * dx + dz * dz;
  if (d2 >= KOUT * KOUT) return -1;
  const a = Math.atan2(-dz, dx), k = 1 + 0.07 * Math.sin(3 * a + H.s) + 0.04 * Math.sin(5 * a + H.s * 1.7), u = Math.sqrt(d2) / k;
  if (u >= 1) return -1;
  const w = 1 - u * u, n1 = vnoise(x, z, 1 / Math.max(60, H.r * 0.5), H.s * 13), n2 = vnoise(x, z, 1 / 24, H.s * 7 + 3);
  return H.h * Math.pow(w, 1.5) * (1 + 0.05 * n1) + 0.15 * n2 * w * Math.min(1, u * 4); // 起伏不要太陡太密：下坡開 50 公里不會一直彈起來
}
function hillH(x, z) { let m = -1; for (const H of HILL_LIST) { const v = shapeH(H, x, z); if (v > m) m = v; } return m; }

// ---- 島：水邊（圓角長方形）、沙灘、海底 ----
const COAST = { x0: -1830, x1: 2560, z0: -1280, z1: 2380, r: 320, beach: 70, sl: -0.55 };
function coastD(x, z) { // 離水邊多遠（陸地負的、海裡正的）
  const cx = (COAST.x0 + COAST.x1) / 2, cz = (COAST.z0 + COAST.z1) / 2, hx = (COAST.x1 - COAST.x0) / 2 - COAST.r, hz = (COAST.z1 - COAST.z0) / 2 - COAST.r;
  const qx = Math.abs(x - cx) - hx, qz = Math.abs(z - cz) - hz;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - COAST.r;
}
function coastY(d) { // 地面多高：沙灘從 0 慢慢低到海面，海裡越來越深
  if (d <= -COAST.beach) return 0;
  if (d <= 0) return COAST.sl * Math.pow((d + COAST.beach) / COAST.beach, 1.4);
  return Math.max(-10, COAST.sl - 0.028 * Math.min(d, 40) - 0.08 * Math.max(0, d - 40));
}
// 本來就有地的地方（village.js 的草地、賽道的草地；內湖外面那圈山的格子 neihu.js 自己鋪）：島的格子不要再鋪
const groundAt = (x, z) => (x >= -1450 && x <= -62 && Math.abs(z) <= 880) || (x > -62 && x <= 1300 && Math.abs(z) <= 1150);
const RING0 = [-600, -520, 2456, 2281]; // neihu.js 山的格子（buildHills 的時候照 V.neihu.ringBox 改）

// ---- 隧道 ----
const TOP = 7.4, WALL_H = 5.0, CLR = 9.4; // 拱頂、直的牆多高；山比路高 CLR 以上才算隧道
const TUN = [
  { name: '快速道路隧道', x: -1030, hw: 14.5, bores: [[-14.5, -0.6], [0.6, 14.5]], hill: 22 },
  { name: '內湖隧道', x: -112, hw: 9.6, bores: [[-9.6, 9.6]], hill: 23 },
];
let TP = null;
function tunnels() { // 洞口在哪（照山的外形算：整個寬度都比路高 CLR 以上的那段）；z0…z1＝隧道、cz0…cz1＝挖開的路（山的範圍）
  if (TP) return TP;
  TP = TUN.map((t, k) => {
    const H = HILL_LIST[t.hill], xs = [-4, 0, 0.25, 0.5, 0.75, 1, 4].map((f, i) => (i === 0 ? t.x - t.hw - 4 : i === 6 ? t.x + t.hw + 4 : t.x - t.hw + 2 * t.hw * f));
    let best = null, cur = null;
    for (let z = Math.ceil(H.z - RZ(H) * KOUT); z <= H.z + RZ(H) * KOUT; z += 0.5) {
      let m = Infinity; for (const x of xs) m = Math.min(m, shapeH(H, x, z));
      if (m >= CLR) { if (!cur) cur = [z, z]; cur[1] = z; } else if (cur) { if (!best || cur[1] - cur[0] > best[1] - best[0]) best = cur; cur = null; }
    }
    if (cur && (!best || cur[1] - cur[0] > best[1] - best[0])) best = cur;
    if (!best) best = [H.z, H.z];
    return { ...t, k, z0: best[0], z1: best[1], cz0: H.z - RZ(H) * KOUT, cz1: H.z + RZ(H) * KOUT, x0: t.x - t.hw, x1: t.x + t.hw };
  });
  return TP;
}
function inTunnel(x, z, pad = 0) { for (const t of tunnels()) if (Math.abs(x - t.x) < t.hw + pad && z > t.z0 - pad && z < t.z1 + pad) return true; return false; }
const HILL_TEXT = TUN.map((t) => t.name).join('');
function hillsFonts(ms = 1500) {
  const f = typeof document !== 'undefined' && document.fonts;
  if (!f || !f.load) return Promise.resolve();
  const all = Promise.all([f.load(`700 64px ${SANS}`, HILL_TEXT)]).catch(() => {});
  return Promise.race([all, new Promise((r) => setTimeout(r, ms))]);
}

// ---- 格子：xs、zs（可以不等距）、高度 Y；heightAt＝三角形內插（對角線 00–11） ----
function seg(a, v) { let lo = 0, hi = a.length - 2; if (v <= a[0]) return 0; if (v >= a[hi]) return hi; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (a[m] <= v) lo = m; else hi = m - 1; } return lo; }
function axis(a0, a1, step, extra) { // a0…a1 每 step 一條，再加上 extra（太近的那條換掉）
  const out = [], n = Math.max(1, Math.round((a1 - a0) / step));
  for (let i = 0; i <= n; i++) out.push(a0 + ((a1 - a0) * i) / n);
  for (const e of extra) { if (e <= a0 || e >= a1) continue; let bi = 0; for (let i = 1; i < out.length; i++) if (Math.abs(out[i] - e) < Math.abs(out[bi] - e)) bi = i; if (Math.abs(out[bi] - e) < step * 0.3 && bi > 0 && bi < out.length - 1) out[bi] = e; else out.push(e); }
  return Float64Array.from(out.sort((p, q) => p - q));
}
const GN = [0, 1, 0];
function gridAt(G, x, z) { // 不在格子裡：NaN
  const xs = G.xs, zs = G.zs;
  if (!(x >= xs[0] && x <= xs[xs.length - 1] && z >= zs[0] && z <= zs[zs.length - 1])) return NaN;
  const i = seg(xs, x), j = seg(zs, z), u = (x - xs[i]) / (xs[i + 1] - xs[i]), v = (z - zs[j]) / (zs[j + 1] - zs[j]), W1 = xs.length, k = j * W1 + i, Y = G.Y;
  const h00 = Y[k], h10 = Y[k + 1], h01 = Y[k + W1], h11 = Y[k + W1 + 1];
  return u >= v ? h00 + u * (h10 - h00) + v * (h11 - h10) : h00 + u * (h11 - h01) + v * (h01 - h00);
}
function gridN(G, x, z, out) { // 那個三角形的法線
  const xs = G.xs, zs = G.zs, i = seg(xs, x), j = seg(zs, z), dx = xs[i + 1] - xs[i], dz = zs[j + 1] - zs[j], u = (x - xs[i]) / dx, v = (z - zs[j]) / dz, W1 = xs.length, k = j * W1 + i, Y = G.Y;
  const h00 = Y[k], h10 = Y[k + 1], h01 = Y[k + W1], h11 = Y[k + W1 + 1];
  const gx = (u >= v ? h10 - h00 : h11 - h01) / dx, gz = (u >= v ? h11 - h10 : h01 - h00) / dz, l = Math.sqrt(gx * gx + gz * gz + 1);
  out[0] = -gx / l; out[1] = 1 / l; out[2] = -gz / l; return out;
}
function gridMesh(G, keep, col, extra) { // 留下 keep(i, j) 的格子；頂點色 col(x, z, y, ny) → [r, g, b]；extra(x, z, y) → 另外的屬性（沙）
  const xs = G.xs, zs = G.zs, W1 = xs.length, H1 = zs.length, Y = G.Y, NV = W1 * H1;
  const used = new Uint8Array(NV), I = [];
  for (let j = 0; j < H1 - 1; j++) for (let i = 0; i < W1 - 1; i++) {
    if (!keep(i, j)) continue;
    const a = j * W1 + i, b = a + 1, d = a + W1, c = d + 1;
    I.push(a, c, b, a, d, c); used[a] = used[b] = used[c] = used[d] = 1;
  }
  if (!I.length) return null;
  const map = new Int32Array(NV).fill(-1); let n = 0; for (let v = 0; v < NV; v++) if (used[v]) map[v] = n++;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), CL = new Float32Array(n * 3), UV = new Float32Array(n * 2), EX = extra ? new Float32Array(n) : null;
  const yAt = (i, j) => Y[clamp(j, 0, H1 - 1) * W1 + clamp(i, 0, W1 - 1)], xAt = (i) => xs[clamp(i, 0, W1 - 1)], zAt = (j) => zs[clamp(j, 0, H1 - 1)];
  for (let j = 0; j < H1; j++) for (let i = 0; i < W1; i++) {
    const v = j * W1 + i, q = map[v]; if (q < 0) continue;
    const x = xs[i], z = zs[j], y = Y[v];
    const gx = (yAt(i + 1, j) - yAt(i - 1, j)) / Math.max(1e-6, xAt(i + 1) - xAt(i - 1)), gz = (yAt(i, j + 1) - yAt(i, j - 1)) / Math.max(1e-6, zAt(j + 1) - zAt(j - 1)), l = Math.sqrt(gx * gx + gz * gz + 1);
    P[q * 3] = x; P[q * 3 + 1] = y; P[q * 3 + 2] = z; N[q * 3] = -gx / l; N[q * 3 + 1] = 1 / l; N[q * 3 + 2] = -gz / l;
    UV[q * 2] = x / 6; UV[q * 2 + 1] = -z / 6;
    const c = col(x, z, y, 1 / l); CL[q * 3] = c[0]; CL[q * 3 + 1] = c[1]; CL[q * 3 + 2] = c[2];
    if (EX) EX[q] = extra(x, z, y);
  }
  const idx = new Uint32Array(I.length); for (let k = 0; k < I.length; k++) idx[k] = map[I[k]];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.BufferAttribute(CL, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  if (EX) geo.setAttribute('sand', new THREE.BufferAttribute(EX, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
  return { geo, tris: I.length / 3 };
}
const ICO = (() => { // 二十面體（樹冠）
  const t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return p.map((q) => q / l); });
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  return { v, f };
})();
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function fitFont(g, text, maxW, px) { let s = px; for (; s > 8; s -= 2) { g.font = `700 ${s}px ${SANS}`; if (g.measureText(text).width <= maxW) break; } return s; }

function buildHills(V, opts = {}) {
  const T0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const group = new THREE.Group(); group.name = 'hills';
  const colliders = [], lowCols = [], highCols = [];
  const TS = tunnels();
  const ring = V.neihu && typeof V.neihu.ringAt === 'function' ? V.neihu : null, RB = (ring && ring.ringBox) || RING0;
  const covered = (x, z) => groundAt(x, z) || (x >= RB[0] && x <= RB[2] && z >= RB[1] && z <= RB[3]);
  const vg = V.group && V.group.getObjectByName('ground');
  const terrMat = vg && vg.material ? vg.material.clone() : new THREE.MeshStandardMaterial({ color: 0x6f9a4a, roughness: 1 });
  terrMat.vertexColors = true; terrMat.polygonOffset = true; terrMat.polygonOffsetFactor = 1; terrMat.polygonOffsetUnits = 2;
  let tris = 0, meshes = 0;

  // 6 個家（塔、外面的斜坡、門口）四周是平的：山腳靠近家的地方壓到 0（內湖隧道的山東南角碰到 5 號家的後面）
  const HOMES = (V.homeSites || []).map((q) => [q.x, q.z]), HK0 = TOWER_RAMP.R1 + 20, HK1 = TOWER_RAMP.R1 + 34; // 第 60 批：旁邊的公寓（離塔 26 公尺）也要在平的上面（本來 +8、+22）
  const homeKeep = (x, z) => { let m = 1; for (const [hx, hz] of HOMES) { const d = Math.hypot(x - hx, z - hz); if (d < HK1) m = Math.min(m, ss(HK0, HK1, d)); } return m; };
  // 1) 每座山一張格子
  const HS = HILL_LIST.map((H, hi) => {
    const cs = clamp(Math.min(RX(H), RZ(H)) / 14, 3.5, 13), ex = [], ez = [];
    const T = H.tun != null ? TS[H.tun] : null;
    if (T) { ex.push(T.x0, T.x1); ez.push(T.z0, T.z1); }
    const xs = axis(H.x - RX(H) * KOUT, H.x + RX(H) * KOUT, cs, ex), zs = axis(H.z - RZ(H) * KOUT, H.z + RZ(H) * KOUT, cs, ez), W1 = xs.length, Y = new Float32Array(W1 * zs.length), S = new Float32Array(W1 * zs.length);
    for (let j = 0; j < zs.length; j++) for (let i = 0; i < W1; i++) {
      const x = xs[i], z = zs[j], s0 = shapeH(H, x, z), s = s0 > 0 ? s0 * homeKeep(x, z) : s0, b = coastY(coastD(x, z)); let y = s > 0 ? b + s : b - 0.15;
      if (T && x > T.x0 - 4.5 && x < T.x1 + 4.5 && z >= T.z0 - 0.01 && z <= T.z1 + 0.01) y = Math.max(y, TOP + 1.6); // 隧道上面：山一定蓋得住拱頂
      Y[j * W1 + i] = y; S[j * W1 + i] = s;
    }
    return { ...H, hi, T, G: { xs, zs, Y }, S, bx0: xs[0], bx1: xs[W1 - 1], bz0: zs[0], bz1: zs[zs.length - 1] };
  });
  // 找山：250 公尺一格的桶
  const BK = { x0: -2100, z0: -1600, s: 250, nx: 22, nz: 19 }, BUCK = Array.from({ length: BK.nx * BK.nz }, () => []);
  for (const H of HS) for (let j = Math.max(0, Math.floor((H.bz0 - BK.z0) / BK.s)); j <= Math.min(BK.nz - 1, Math.floor((H.bz1 - BK.z0) / BK.s)); j++) for (let i = Math.max(0, Math.floor((H.bx0 - BK.x0) / BK.s)); i <= Math.min(BK.nx - 1, Math.floor((H.bx1 - BK.x0) / BK.s)); i++) BUCK[j * BK.nx + i].push(H);
  const EMPTY = [];
  const near = (x, z) => { const i = Math.floor((x - BK.x0) / BK.s), j = Math.floor((z - BK.z0) / BK.s); return i >= 0 && j >= 0 && i < BK.nx && j < BK.nz ? BUCK[j * BK.nx + i] : EMPTY; }; // 第 34 批：x、z 是 NaN（一起比 400 公尺，朋友的車還沒有位置）以前拿到 undefined 就爆（每一格 pageerror、比賽開不起來）；現在跟沒有山的時候一樣算 NaN 不爆
  // 隧道的範圍：tunAt＝隧道那段（下面那層是路）、corrAt＝整段（隧道＋挖開的路）
  const tunAt = (x, z) => { for (let k = 0; k < TS.length; k++) { const t = TS[k]; if (x > t.x0 && x < t.x1 && z > t.z0 && z < t.z1) return k; } return -1; };
  const corrAt = (x, z) => { for (let k = 0; k < TS.length; k++) { const t = TS[k]; if (x > t.x0 && x < t.x1 && z > t.cz0 && z < t.cz1) return k; } return -1; };

  // 2) 島的格子（沙灘、海底、沒有地的地方鋪草地）：40 公尺一格，邊對齊本來的地
  const IS = (() => {
    const X0 = COAST.x0 - 160, X1 = COAST.x1 + 160, Z0 = COAST.z0 - 160, Z1 = COAST.z1 + 160;
    const xs = axis(X0, X1, 40, [-1450, -62, 1300, RB[0], RB[2]]), zs = axis(Z0, Z1, 40, [-1150, -880, 880, 1150, RB[1], RB[3]]), W1 = xs.length, Y = new Float32Array(W1 * zs.length);
    for (let j = 0; j < zs.length; j++) for (let i = 0; i < W1; i++) Y[j * W1 + i] = coastY(coastD(xs[i], zs[j]));
    const cell = new Uint8Array((W1 - 1) * (zs.length - 1));
    for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < W1 - 1; i++) cell[j * (W1 - 1) + i] = covered((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2) ? 0 : 1;
    return { G: { xs, zs, Y }, cell, W: W1 - 1 };
  })();
  const isAt = (x, z) => { // 島的格子：在本來沒有地的地方才算（NaN＝不算）
    const G = IS.G; if (!(x >= G.xs[0] && x <= G.xs[G.xs.length - 1] && z >= G.zs[0] && z <= G.zs[G.zs.length - 1])) return coastY(coastD(x, z));
    const i = seg(G.xs, x), j = seg(G.zs, z); return IS.cell[j * IS.W + i] ? gridAt(G, x, z) : NaN;
  };
  const RUN = { x0: 760, x1: 1000, hz: 16 }; // 400 公尺後面的沙地（盡頭圓的）
  const inRun = (x, z) => x >= RUN.x0 && (x <= RUN.x1 ? Math.abs(z) <= RUN.hz : (x - RUN.x1) ** 2 + z * z <= RUN.hz * RUN.hz);

  // 3) 高度、法線、地形、路面（包一層；隧道那段：V.heightAt 永遠是路，玩家在上面那層 topAt）
  const h0 = V.heightAt || (() => 0), n0 = V.normalAt || null, t0 = V.terrainAt || (() => false), s0 = V.surfaceAt || (() => 0);
  const SRC = { g: null, ring: false }; // 最後是誰（法線用）
  function baseH(x, z) { const v = isAt(x, z); if (v === v) { SRC.g = IS.G; return v; } SRC.g = null; return h0(x, z); }
  function hillsMax(x, z, h, skipCorr) {
    const L = near(x, z);
    for (let k = 0; k < L.length; k++) {
      const H = L[k]; if (x < H.bx0 || x > H.bx1 || z < H.bz0 || z > H.bz1) continue;
      if (skipCorr && H.T && x > H.T.x0 && x < H.T.x1) continue; // 挖開的路、隧道：這座山不算（下面那層）
      const v = gridAt(H.G, x, z); if (v > h) { h = v; SRC.g = H.G; SRC.ring = false; }
    }
    if (ring && x >= RB[0] && x <= RB[2] && z >= RB[1] && z <= RB[3]) { const v = ring.ringAt(x, z); if (v > h) { h = v; SRC.g = null; SRC.ring = true; } }
    return h;
  }
  const heightAt = (x, z) => { SRC.ring = false; return hillsMax(x, z, baseH(x, z), corrAt(x, z) >= 0); };
  const topAt = (x, z) => { SRC.ring = false; return hillsMax(x, z, baseH(x, z), false); }; // 上面那層（隧道上面的山）
  const NRM = [0, 1, 0];
  function normalAt(x, z) {
    SRC.ring = false; hillsMax(x, z, baseH(x, z), corrAt(x, z) >= 0);
    if (SRC.ring) return ring.ringN(x, z, NRM);
    if (SRC.g) return gridN(SRC.g, x, z, NRM);
    if (n0) return n0(x, z); NRM[0] = 0; NRM[1] = 1; NRM[2] = 0; return NRM;
  }
  function topN(x, z) { SRC.ring = false; hillsMax(x, z, baseH(x, z), false); if (SRC.ring) return ring.ringN(x, z, NRM); if (SRC.g) return gridN(SRC.g, x, z, NRM); if (n0) return n0(x, z); NRM[0] = 0; NRM[1] = 1; NRM[2] = 0; return NRM; }
  const lift = (x, z) => { // 山（或內湖外面的山）比底下的地高多少
    const b = baseH(x, z); return hillsMax(x, z, b, corrAt(x, z) >= 0) - b;
  };
  function terrainAt(x, z) { // 不平的地方（terrain.js 照三角形算）：原本的、沙灘和海、山、內湖外面的山
    if (t0(x, z) || coastD(x, z) > -COAST.beach - 4 || inRun(x, z)) return true; // 沙地也算（terrain.js 的沙：慢下來）
    const L = near(x, z);
    for (let k = 0; k < L.length; k++) { const H = L[k]; if (x >= H.bx0 && x <= H.bx1 && z >= H.bz0 && z <= H.bz1 && gridAt(H.G, x, z) > 0.02) return true; }
    return !!ring && x >= RB[0] && x <= RB[2] && z >= RB[1] && z <= RB[3] && ring.ringAt(x, z) > 0.05;
  }
  const depth = (x, z) => { const d = coastD(x, z); return d <= -COAST.beach ? 0 : Math.max(0, COAST.sl - heightAt(x, z)); };
  function surfaceAt(x, z) {
    const s = s0(x, z);
    if (inRun(x, z)) return 7;
    const d = coastD(x, z);
    if (d > -COAST.beach - 2 && lift(x, z) < 0.3) { const w = COAST.sl - heightAt(x, z); return w > 0.4 ? 10 : w > 0.02 ? 9 : 7; } // 沙灘、淺水、深水
    if (corrAt(x, z) < 0 && lift(x, z) > 0.3) return 1; // 山上：草地
    return s;
  }
  V.heightAt = heightAt; V.normalAt = normalAt; V.terrainAt = terrainAt; V.surfaceAt = surfaceAt;

  // 沙：另外一個屬性，shader 裡把草地的貼圖換成沙（山、島、400 公尺後面的沙地）
  const sandMat = (f, u) => { const m = terrMat.clone(); m.polygonOffsetFactor = f; m.polygonOffsetUnits = u; m.onBeforeCompile = sandShader; m.customProgramCacheKey = () => 'hl-sand'; return m; };
  const sandShader = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float sand;\nvarying float vSand;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvSand = sand;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSand;').replace('#include <map_fragment>', [
      '#ifdef USE_MAP',
      '  vec4 sampledDiffuseColor = texture2D( map, vMapUv );',
      '  float gl = dot( sampledDiffuseColor.rgb, vec3( 0.3, 0.55, 0.15 ) );',
      '  vec3 sandC = vec3( 0.62, 0.47, 0.24 ) * ( 0.6 + 2.6 * gl );',
      '  diffuseColor *= vec4( mix( sampledDiffuseColor.rgb, sandC, vSand ), 1.0 );',
      '#endif',
    ].join('\n'));
  };
  const hillMat = sandMat(1, 2);
  // 4) 山的網格：照位置分 6 組（看不到的整組不畫）；顏色跟 mountain.js 一樣（高的地方深一點、陡的地方黃一點、山腳跟草地一樣）
  const HI = [0.84, 0.93, 0.8], DRY = [1.16, 1.02, 0.8];
  const hillCol = (H) => (x, z, y, ny) => {
    const b = coastY(coastD(x, z)), h = y - b;
    let c = mix([1, 1, 1], HI, ss(4, 45, h) * (0.7 + 0.3 * vnoise(x, z, 1 / 70, 41)));
    c = mix(c, DRY, (1 - ss(0.62, 0.86, ny)) * 0.85);
    const nk = 1 + vnoise(x, z, 1 / 31, 7 + H.s) * 0.07 + vnoise(x, z, 1 / 9, 9) * 0.04;
    return mix([1, 1, 1], mul(c, nk), ss(0, 6, h));
  };
  const GROUPS = [[-1e9, -1100, -1e9, -350], [-1100, -1e9, -1e9, -350], [-1e9, -1100, -350, 1e9], [-1100, 0, -350, 1e9], [0, 1e9, -1e9, 1e9]]; // x0, x1, z0, z1（中心）
  const hillGeos = GROUPS.map(() => []);
  const hillSand = (x, z, y) => { const d = coastD(x, z); return d < -COAST.beach - 18 ? 0 : ss(-COAST.beach - 18, -COAST.beach + 12, d) * (1 - ss(2, 9, y - coastY(d))); }; // 海邊的山腳是沙
  for (const H of HS) {
    const xs = H.G.xs, zs = H.G.zs, W1 = xs.length, T = H.T;
    const m = gridMesh(H.G, (i, j) => {
      const s = H.S; if (s[j * W1 + i] <= 0 && s[j * W1 + i + 1] <= 0 && s[(j + 1) * W1 + i] <= 0 && s[(j + 1) * W1 + i + 1] <= 0) return false; // 整格都在山外面
      if (T) { const mx = (xs[i] + xs[i + 1]) / 2, mz = (zs[j] + zs[j + 1]) / 2; if (mx > T.x0 && mx < T.x1 && (mz < T.z0 || mz > T.z1)) return false; } // 挖開的路
      return true;
    }, hillCol(H), hillSand);
    if (!m) continue;
    const gi = GROUPS.findIndex(([x0, x1, z0, z1]) => H.x >= x0 && H.x < x1 && H.z >= z0 && H.z < z1);
    hillGeos[gi < 0 ? 0 : gi].push(m.geo); tris += m.tris;
  }
  hillGeos.forEach((L, gi) => {
    if (!L.length) return;
    const geo = L.length === 1 ? L[0] : mergeGeos(L);
    const mesh = new THREE.Mesh(geo, hillMat); mesh.name = 'hl-hill-' + gi; mesh.matrixAutoUpdate = false; group.add(mesh); meshes++;
  });

  // 5) 島：草地＋沙灘＋海底（同一張）
  const islandMat = sandMat(2, 6), runMat = sandMat(-1, -2); // 島跟村子的草地一樣往後推；400 公尺後面的沙地蓋在賽道的草地上面（斜斜看過去才不會被草地蓋掉）
  {
    const m = gridMesh(IS.G, (i, j) => IS.cell[j * IS.W + i] === 1, (x, z, y) => { const d = coastD(x, z), w = ss(0, 90, d); return mix([1, 1, 1], [0.55, 0.62, 0.66], w); }, (x, z) => ss(-COAST.beach - 18, -COAST.beach + 12, coastD(x, z)));
    if (m) { const mesh = new THREE.Mesh(m.geo, islandMat); mesh.name = 'hl-ground-island'; mesh.matrixAutoUpdate = false; group.add(mesh); meshes++; tris += m.tris; }
  }
  { // 400 公尺後面的沙地：長方形＋半圓
    const P = [], I = [], n = 10, y = 0.012, push = (x, z) => { P.push(x, y, z); return P.length / 3 - 1; };
    const a = push(RUN.x0, -RUN.hz), b = push(RUN.x0, RUN.hz), c = push(RUN.x1, RUN.hz), d = push(RUN.x1, -RUN.hz), o = push(RUN.x1, 0);
    I.push(a, b, c, a, c, d);
    let prev = c; for (let k = 1; k <= n; k++) { const t = Math.PI / 2 - (k / n) * Math.PI, q = push(RUN.x1 + Math.cos(t) * RUN.hz, Math.sin(t) * RUN.hz); I.push(o, prev, q); prev = q; }
    const geo = new THREE.BufferGeometry(), nv = P.length / 3, UV = [], N = [], CL = [], SD = [];
    for (let k = 0; k < nv; k++) { UV.push(P[k * 3] / 6, -P[k * 3 + 2] / 6); N.push(0, 1, 0); CL.push(1, 1, 1); SD.push(1); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(CL, 3)); geo.setAttribute('sand', new THREE.Float32BufferAttribute(SD, 1));
    geo.setIndex(I); fixWinding(geo); geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, runMat); mesh.name = 'hl-ground-runoff'; mesh.matrixAutoUpdate = false; group.add(mesh); meshes++; tris += I.length / 3;
  }

  // 6) 海：一大片（中間沙灘裡面那圈挖掉），淡淡透明、慢慢動的小波浪（法線貼圖）
  let water = null, waterTex = null;
  {
    const hx = (COAST.x1 - COAST.x0) / 2, hz = (COAST.z1 - COAST.z0) / 2, cx = COAST.x0 + hx, cz = COAST.z0 + hz, ins = COAST.beach - 4, R = COAST.r - ins;
    const shape = new THREE.Shape(); const E = 9000;
    shape.moveTo(cx - E, -(cz - E)); shape.lineTo(cx + E, -(cz - E)); shape.lineTo(cx + E, -(cz + E)); shape.lineTo(cx - E, -(cz + E)); shape.lineTo(cx - E, -(cz - E));
    const hole = new THREE.Path(), ax = hx - ins - R, az = hz - ins - R, pts = [];
    for (const [sx, sz, a0] of [[1, 1, 0], [-1, 1, Math.PI / 2], [-1, -1, Math.PI], [1, -1, (3 * Math.PI) / 2]]) for (let k = 0; k <= 8; k++) { const a = a0 + (k / 8) * (Math.PI / 2); pts.push([cx + sx * ax + Math.cos(a) * R, cz + sz * az + Math.sin(a) * R]); }
    pts.forEach(([x, z], k) => (k ? hole.lineTo(x, -z) : hole.moveTo(x, -z)));
    shape.holes.push(hole);
    const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2); // shape 的 y＝−z
    const p = geo.attributes.position, uv = geo.attributes.uv; for (let k = 0; k < p.count; k++) { p.setY(k, COAST.sl); uv.setXY(k, p.getX(k) / 24, p.getZ(k) / 24); }
    geo.computeVertexNormals(); geo.computeBoundingSphere();
    if (typeof document !== 'undefined') { // 小波浪：法線貼圖（可以接起來的雜訊）
      const S = 128, [c, g] = cv(S, S), im = g.createImageData(S, S), hh = (i, j) => { let v = 0; for (const [f, a, s] of [[4, 1, 3], [8, 0.5, 5], [16, 0.25, 7]]) v += a * Math.sin((TAU * f * (i + 0.37 * j)) / S + s) * Math.cos((TAU * f * 0.5 * (j - 0.21 * i)) / S + s * 1.3); return v; };
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const gx = hh(i + 1, j) - hh(i - 1, j), gz = hh(i, j + 1) - hh(i, j - 1), l = Math.hypot(gx, gz, 1.2), k = (j * S + i) * 4; im.data[k] = 128 + (-gx / l) * 127; im.data[k + 1] = 128 + (-gz / l) * 127; im.data[k + 2] = 128 + (1.2 / l) * 127; im.data[k + 3] = 255; }
      g.putImageData(im, 0, 0); waterTex = new THREE.CanvasTexture(c); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
    }
    const wm = new THREE.MeshStandardMaterial({ color: 0x2f7396, roughness: 0.16, metalness: 0.08, transparent: true, opacity: 0.84, normalMap: waterTex, normalScale: new THREE.Vector2(0.45, 0.45) });
    water = new THREE.Mesh(geo, wm); water.name = 'hl-water'; water.matrixAutoUpdate = false; water.renderOrder = 2; group.add(water); meshes++; tris += geo.index ? geo.index.count / 3 : p.count / 3;
  }

  // 7) 隧道：擋土牆（挖開的路兩邊、牆頂高出 0.8 公尺當欄杆）、洞口、裡面的牆和拱頂（不打光）、燈、路面的黑
  const TW = { P: [], C: [] }, TL = { P: [], C: [] }, TD = { P: [], C: [] }; // 牆（打光的水泥）、燈（亮的）、路面的黑（透明）
  const IN = { P: [], C: [] }; // 裡面（不打光）
  const quad = (L, a, b, c, d, col) => { L.P.push(...a, ...b, ...c, ...a, ...c, ...d); for (let k = 0; k < 6; k++) L.C.push(...col); };
  const CONC = C('#c4c1b8'), CONC2 = C('#a9a69e'), CAP = C('#d6d3cb'), INW = C('#7c7a74'), INB = C('#4f4e4a'), INC = C('#5d5c58'), LAMP = C('#fff2c4');
  const plates = [];
  for (const T of TS) {
    const H = HS[T.hill], xs = H.G.xs, zs = H.G.zs, W1 = xs.length, Y = H.G.Y;
    const iL = xs.indexOf(T.x0), iR = xs.indexOf(T.x1);
    // 擋土牆：挖開的路（z 在洞口外面、山比地高的地方）
    for (const [ii, sd] of [[iL, -1], [iR, 1]]) {
      const x = xs[ii], xo = x + sd * 0.35; let run = null;
      const flush = () => { if (!run) return; const zc = (run.z0 + run.z1) / 2, c = { t: 'box', x: x + sd * 0.3, z: zc, hx: 0.3, hz: (run.z1 - run.z0) / 2, rot: 0, h: run.h + 0.8, noCrush: true, hl: 'wall' }; colliders.push(c); run = null; };
      for (let j = 0; j < zs.length - 1; j++) {
        const za = zs[j], zb = zs[j + 1]; if (!(zb <= T.z0 + 0.01 || za >= T.z1 - 0.01)) { flush(); continue; } // 隧道那段：裡面的牆
        const ya = Y[j * W1 + ii], yb = Y[(j + 1) * W1 + ii], ha = ya - coastY(coastD(x, za)), hb = yb - coastY(coastD(x, zb));
        if (ha < 0.25 && hb < 0.25) { flush(); continue; }
        const pa = 0.8 * ss(0.25, 1.5, ha), pb = 0.8 * ss(0.25, 1.5, hb), ta = ya + pa, tb = yb + pb;
        // 對著路那面、上面、山那面（高出地面那段）
        if (sd < 0) { quad(TW, [x, -0.3, zb], [x, -0.3, za], [x, ta, za], [x, tb, zb], CONC); quad(TW, [x, ta, za], [xo, ta, za], [xo, tb, zb], [x, tb, zb], CAP); quad(TW, [xo, ya - 0.3, za], [xo, yb - 0.3, zb], [xo, tb, zb], [xo, ta, za], CONC2); }
        else { quad(TW, [x, -0.3, za], [x, -0.3, zb], [x, tb, zb], [x, ta, za], CONC); quad(TW, [x, ta, za], [x, tb, zb], [xo, tb, zb], [xo, ta, za], CAP); quad(TW, [xo, yb - 0.3, zb], [xo, ya - 0.3, za], [xo, ta, za], [xo, tb, zb], CONC2); }
        if (Math.max(ha, hb) > 0.8) { if (!run) run = { z0: za, z1: zb, h: Math.max(ya, yb) }; else { run.z1 = zb; run.h = Math.max(run.h, ya, yb); } if (run.z1 - run.z0 > 18) flush(); } else flush();
      }
      flush();
    }
    // 裡面：每一孔的剖面（直牆 → 半橢圓的拱），每 4 公尺一段；從洞口外面 0.5 公尺開始（接洞口的牆）
    const prof = (a, b) => { const c = (a + b) / 2, r = (b - a) / 2, out = [[a, 0], [a, WALL_H]]; for (let k = 1; k < 12; k++) { const th = Math.PI - (k / 12) * Math.PI; out.push([c + r * Math.cos(th), WALL_H + (TOP - WALL_H) * Math.sin(th)]); } out.push([b, WALL_H], [b, 0]); return out; };
    const zA = T.z0 - 0.6, zB = T.z1 + 0.6, nz = Math.max(1, Math.ceil((zB - zA) / 4));
    for (const [a, b] of T.bores) {
      const pr = prof(a, b);
      for (let q = 0; q < nz; q++) {
        const z0 = zA + ((zB - zA) * q) / nz, z1 = zA + ((zB - zA) * (q + 1)) / nz;
        for (let k = 0; k < pr.length - 1; k++) { const [u0, y0] = pr[k], [u1, y1] = pr[k + 1], col = y0 < 1.1 && y1 < 1.1 ? INB : y0 >= WALL_H && y1 >= WALL_H ? INC : INW; quad(IN, [T.x + u0, y0, z0], [T.x + u1, y1, z0], [T.x + u1, y1, z1], [T.x + u0, y0, z1], col); }
      }
      // 燈：拱的兩邊各一排（6 公尺一盞）
      for (let z = T.z0 + 3; z < T.z1 - 1; z += 6) for (const f of [0.2, 0.8]) {
        const th = Math.PI - f * Math.PI, c = (a + b) / 2, r = (b - a) / 2 - 0.12, u = c + r * Math.cos(th), y = WALL_H + (TOP - WALL_H - 0.12) * Math.sin(th);
        quad(TL, [T.x + u, y - 0.05, z - 0.9], [T.x + u, y - 0.05, z + 0.9], [T.x + u + (c - u) * 0.06, y - 0.2, z + 0.9], [T.x + u + (c - u) * 0.06, y - 0.2, z - 0.9], LAMP);
      }
    }
    // 中間的牆（雙孔：兩孔中間到拱腳那麼高，上面接山）
    if (T.bores.length > 1) for (let q = 0; q < nz; q++) { const z0 = zA + ((zB - zA) * q) / nz, z1 = zA + ((zB - zA) * (q + 1)) / nz, a = T.bores[0][1], b = T.bores[1][0]; quad(IN, [T.x + a, 0, z0], [T.x + b, 0, z0], [T.x + b, 0, z1], [T.x + a, 0, z1], INB); }
    // 路面的黑（洞口進來 14 公尺慢慢變黑）
    { const n = Math.max(2, Math.ceil((T.z1 - T.z0) / 7)), al = (z) => 0.5 * Math.min(ss(T.z0 - 0.5, T.z0 + 14, z), 1 - ss(T.z1 - 14, T.z1 + 0.5, z));
      for (let q = 0; q < n; q++) { const z0 = T.z0 - 0.6 + ((T.z1 - T.z0 + 1.2) * q) / n, z1 = T.z0 - 0.6 + ((T.z1 - T.z0 + 1.2) * (q + 1)) / n, y = 0.09; TD.P.push(T.x0, y, z0, T.x0, y, z1, T.x1, y, z1, T.x0, y, z0, T.x1, y, z1, T.x1, y, z0); for (const z of [z0, z1, z1, z0, z1, z0]) TD.C.push(0, 0, 0, al(z)); } }
    // 洞口：一面水泥牆（剖面挖空）、上面一圈、名牌；牆頂的欄杆（上面那層擋）
    const W = T.hw + 4;
    for (const [zp, sd] of [[T.z0 - 0.6, -1], [T.z1 + 0.6, 1]]) {
      let Hf = TOP + 2.2; for (let i = 0; i < W1; i++) if (xs[i] >= T.x - W && xs[i] <= T.x + W) Hf = Math.max(Hf, gridAt(H.G, xs[i], zp - sd * 1.2) + 1.0);
      const cont = [[-W, 0]]; for (const [a, b] of T.bores) for (const p of prof(a, b)) cont.push(p); cont.push([W, 0], [W, Hf], [-W, Hf]);
      const tr = THREE.ShapeUtils.triangulateShape(cont.map(([u, y]) => new THREE.Vector2(u, y)), []);
      const P3 = (u, y, z) => [T.x + u, y, z];
      for (const [i0, i1, i2] of tr) {
        const A = cont[i0], B = cont[i1], Cc = cont[i2], ccw = (B[0] - A[0]) * (Cc[1] - A[1]) - (B[1] - A[1]) * (Cc[0] - A[0]) > 0, fwd = sd > 0 ? ccw : !ccw; // 朝外（−z 或 +z）
        const k = (A[1] + B[1] + Cc[1]) / 3 > TOP + 0.4 ? 0.9 : 1, col = mul(CONC, k);
        if (fwd) { TW.P.push(...P3(A[0], A[1], zp), ...P3(B[0], B[1], zp), ...P3(Cc[0], Cc[1], zp)); } else { TW.P.push(...P3(A[0], A[1], zp), ...P3(Cc[0], Cc[1], zp), ...P3(B[0], B[1], zp)); }
        for (let q = 0; q < 3; q++) TW.C.push(...col);
      }
      const zb = zp - sd * 1.6; // 牆的厚度：上面、兩邊
      if (sd < 0) { quad(TW, [T.x - W, Hf, zp], [T.x + W, Hf, zp], [T.x + W, Hf, zb], [T.x - W, Hf, zb], CAP); quad(TW, [T.x - W, 0, zb], [T.x - W, 0, zp], [T.x - W, Hf, zp], [T.x - W, Hf, zb], CONC2); quad(TW, [T.x + W, 0, zp], [T.x + W, 0, zb], [T.x + W, Hf, zb], [T.x + W, Hf, zp], CONC2); }
      else { quad(TW, [T.x - W, Hf, zb], [T.x + W, Hf, zb], [T.x + W, Hf, zp], [T.x - W, Hf, zp], CAP); quad(TW, [T.x - W, 0, zp], [T.x - W, 0, zb], [T.x - W, Hf, zb], [T.x - W, Hf, zp], CONC2); quad(TW, [T.x + W, 0, zb], [T.x + W, 0, zp], [T.x + W, Hf, zp], [T.x + W, Hf, zb], CONC2); }
      // 洞口上面的帶子（深一點）＋名牌
      const yb0 = TOP + 0.35, yb1 = Math.min(Hf - 0.3, TOP + 1.95), pw = Math.min(2 * T.hw - 4, 16), zq = zp + sd * 0.03;
      quad(TW, sd < 0 ? [T.x - W, yb0 - 0.2, zq] : [T.x + W, yb0 - 0.2, zq], sd < 0 ? [T.x + W, yb0 - 0.2, zq] : [T.x - W, yb0 - 0.2, zq], sd < 0 ? [T.x + W, yb0 - 0.05, zq] : [T.x - W, yb0 - 0.05, zq], sd < 0 ? [T.x - W, yb0 - 0.05, zq] : [T.x + W, yb0 - 0.05, zq], C('#8b2f28'));
      plates.push({ T, x0: sd < 0 ? T.x + pw / 2 : T.x - pw / 2, x1: sd < 0 ? T.x - pw / 2 : T.x + pw / 2, y0: yb0, y1: yb1, z: zp + sd * 0.05 }); // 字的左邊：北邊的洞口（往南看）在東邊
      // 牆頂的欄杆：柱子＋兩根橫桿（上面那層才擋：玩家在山上）
      const ry = Hf;
      for (let u = -W; u <= W + 0.01; u += 2) quad(TW, [T.x + u - 0.06, ry, zp - sd * 0.25], [T.x + u + 0.06, ry, zp - sd * 0.25], [T.x + u + 0.06, ry + 1.05, zp - sd * 0.25], [T.x + u - 0.06, ry + 1.05, zp - sd * 0.25], C('#9aa0a6'));
      for (const yy of [0.55, 1.0]) quad(TW, [T.x - W, ry + yy, zp - sd * 0.22], [T.x + W, ry + yy, zp - sd * 0.22], [T.x + W, ry + yy + 0.09, zp - sd * 0.22], [T.x - W, ry + yy + 0.09, zp - sd * 0.22], C('#c9ccd0'));
      highCols.push({ t: 'box', x: T.x, z: zp - sd * 0.25, hx: W, hz: 0.3, rot: 0, h: ry + 1.1, noCrush: true, hl: 'portal', off: true });
    }
    // 裡面的牆（下面那層才擋）：兩邊＋雙孔中間
    const zc = (T.z0 + T.z1) / 2, hz = (T.z1 - T.z0) / 2 + 0.6;
    for (const x of [T.x0 - 0.3, T.x1 + 0.3]) lowCols.push({ t: 'box', x, z: zc, hx: 0.3, hz, rot: 0, h: TOP, noCrush: true, hl: 'tunnel' });
    if (T.bores.length > 1) lowCols.push({ t: 'box', x: T.x, z: zc, hx: 0.6, hz, rot: 0, h: TOP, noCrush: true, hl: 'tunnel' });
  }
  const listMesh = (L, mat, name) => {
    if (!L.P.length) return null;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(L.P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(L.C, L.C.length / (L.P.length / 3)));
    if (!mat.isMeshBasicMaterial) geo.computeVertexNormals(); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat); m.name = name; m.matrixAutoUpdate = false; group.add(m); meshes++; tris += L.P.length / 9; return m;
  };
  listMesh(TW, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), 'hl-tunnel');
  listMesh(IN, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), 'hl-tunnel-in');
  listMesh(TL, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), 'hl-tunnel-lamps');
  const dark = listMesh(TD, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 'hl-road-dark');
  if (dark) dark.renderOrder = 1;
  // 名牌（一張貼圖：每條隧道一列）
  if (typeof document !== 'undefined' && plates.length) {
    const RW = 512, RH = 96, [c, g] = cv(RW, RH * TS.length);
    TS.forEach((T, k) => { g.fillStyle = '#1f5f3a'; g.fillRect(0, k * RH, RW, RH); g.strokeStyle = '#f2f3f5'; g.lineWidth = 5; g.strokeRect(6, k * RH + 6, RW - 12, RH - 12); g.fillStyle = '#f2f3f5'; fitFont(g, T.name, RW - 60, 60); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(T.name, RW / 2, k * RH + RH / 2 + 3); });
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const P = [], UV = [];
    for (const p of plates) { const k = p.T.k, v0 = 1 - (k + 1) / TS.length, v1 = 1 - k / TS.length; P.push(p.x0, p.y0, p.z, p.x1, p.y0, p.z, p.x1, p.y1, p.z, p.x0, p.y0, p.z, p.x1, p.y1, p.z, p.x0, p.y1, p.z); UV.push(0, v0, 1, v0, 1, v1, 0, v0, 1, v1, 0, v1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); m.name = 'hl-tunnel-names'; m.matrixAutoUpdate = false; group.add(m); meshes++; tris += P.length / 9;
  }

  // 8) 山上的樹（有碰撞；怪獸卡車輾得扁）：圓的、尖的（杉樹）；隧道、家旁邊不種
  const TR = { P: [], C: [] }, R = rng(20261023), GREENS = [C('#4f8a3a'), C('#5e9a42'), C('#447f37'), C('#6aa04a')], PINES = [C('#2f6a3a'), C('#3c7a44'), C('#356f3c')], TRUNK = C('#6b4a2f');
  const homes = (V.places?.garst?.slots || []).map((q) => [q.x, q.z]);
  const tri3 = (a, b, c, col) => { TR.P.push(...a, ...b, ...c); for (let k = 0; k < 3; k++) TR.C.push(...col); };
  const tcyl = (x, y, z, y0, y1, r0, r1, n, col, rot) => {
    const P = (a, r, yy) => [x + Math.cos(a + rot) * r, y + yy, z - Math.sin(a + rot) * r];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, b = ((i + 1) / n) * TAU; if (r1 > 0) { tri3(P(a, r0, y0), P(b, r0, y0), P(b, r1, y1), col); tri3(P(a, r0, y0), P(b, r1, y1), P(a, r1, y1), col); } else tri3(P(a, r0, y0), P(b, r0, y0), [x, y + y1, z], mul(col, 0.92 + 0.12 * ((i % 3) / 2))); }
  };
  const tblob = (cx, cy, cz, rx, ry, rz, col, seed) => {
    const Pp = ICO.v.map((p, i) => { const k = 1 + (hash2(seed, i) - 0.5) * 0.44; return [cx + p[0] * rx * k, cy + p[1] * ry * k, cz + p[2] * rz * k]; });
    ICO.f.forEach(([a, b, c], i) => { const ny = (ICO.v[a][1] + ICO.v[b][1] + ICO.v[c][1]) / 3, k = 0.88 + ny * 0.14 + (hash2(seed + 9, i) - 0.5) * 0.16; tri3(Pp[a], Pp[b], Pp[c], mul(col, k)); });
  };
  let trees = 0;
  for (const H of HS) {
    if (!H.t) continue;
    for (let n = 0, tries = 0; n < H.t && tries < H.t * 12; tries++) {
      const a = R() * TAU, u = 0.14 + R() * 0.58, x = H.x + Math.cos(a) * RX(H) * u, z = H.z - Math.sin(a) * RZ(H) * u;
      if (H.T && Math.abs(x - H.T.x) < H.T.hw + 9) continue; // 隧道、挖開的路上面不種（洞口上面也不要）
      if (homes.some(([hx, hz]) => Math.hypot(x - hx, z - hz) < 30)) continue;
      const y = gridAt(H.G, x, z) - 0.15, sz = 1.25 + R() * 0.9, kind = R(), seed = (R() * 1e6) | 0;
      if (!(y > 0.5)) continue;
      if (kind < 0.45) { tcyl(x, y, z, 0, 2.2 * sz, 0.2 * sz, 0.14 * sz, 5, TRUNK, 0); tblob(x, y + 3.1 * sz, z, 1.9 * sz, 1.6 * sz, 1.9 * sz, GREENS[(R() * GREENS.length) | 0], seed); colliders.push({ t: 'circle', x, z, r: 0.48, h: 5 * sz, hl: 'tree' }); }
      else { const rot = R() * TAU; tcyl(x, y, z, -0.3, 1.2 * sz, 0.18 * sz, 0.13 * sz, 5, TRUNK, rot); tcyl(x, y, z, 1.0 * sz, 6.4 * sz, 1.6 * sz, 0, 7, PINES[(R() * PINES.length) | 0], rot); colliders.push({ t: 'circle', x, z, r: 0.48, h: 6.4 * sz, hl: 'tree' }); }
      n++; trees++;
    }
  }
  listMesh(TR, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }), 'hl-trees');

  // 隧道那段原本就有的碰撞（快速道路的護欄、聯外道路的護欄：都在路面上）：玩家開到上面那層（山上）的時候關掉（不然山上會撞到看不到的護欄）
  const tunVil = V.colliders.filter((c) => tunAt(c.x, c.z) >= 0);
  for (const c of colliders) V.colliders.push(c);
  V.group.add(group);

  // 9) 小地圖：山（越高越深）、隧道、海、沙灘、400 公尺後面的沙地
  const prevDraw = V.mapDraw;
  V.mapDraw = (g) => {
    if (prevDraw) prevDraw(g);
    g.save();
    for (const H of HS) { g.save(); g.translate(H.x, H.z); g.scale(RX(H) / H.r, RZ(H) / H.r); const gr = g.createRadialGradient(0, 0, 0, 0, 0, H.r); gr.addColorStop(0, `rgba(70,112,62,${0.28 + Math.min(0.2, H.h / 400)})`); gr.addColorStop(1, 'rgba(70,112,62,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, H.r, 0, TAU); g.fill(); g.restore(); }
    g.fillStyle = 'rgba(214,196,150,0.75)'; g.fillRect(RUN.x0, -RUN.hz, RUN.x1 - RUN.x0, RUN.hz * 2); g.beginPath(); g.arc(RUN.x1, 0, RUN.hz, -Math.PI / 2, Math.PI / 2); g.fill();
    g.fillStyle = 'rgba(40,40,44,0.55)'; for (const T of TS) g.fillRect(T.x0, T.z0, T.x1 - T.x0, T.z1 - T.z0);
    const hx = (COAST.x1 - COAST.x0) / 2, hz = (COAST.z1 - COAST.z0) / 2, cx = COAST.x0 + hx, cz = COAST.z0 + hz;
    const rr = (ins) => { const R2 = COAST.r - ins, ax = hx - ins - R2, az = hz - ins - R2; g.beginPath(); g.moveTo(cx + ax + R2, cz - az); g.arc(cx + ax, cz + az, R2, 0, Math.PI / 2); g.arc(cx - ax, cz + az, R2, Math.PI / 2, Math.PI); g.arc(cx - ax, cz - az, R2, Math.PI, 1.5 * Math.PI); g.arc(cx + ax, cz - az, R2, 1.5 * Math.PI, 2 * Math.PI); g.closePath(); };
    g.fillStyle = 'rgba(214,196,150,0.8)'; rr(-6); g.rect(cx - 9000, cz - 9000, 18000, 18000); rr(COAST.beach); g.fill('evenodd'); // 沙灘（水邊往裡 70 公尺）
    g.fillStyle = '#5b8fbf'; g.beginPath(); g.rect(cx - 9000, cz - 9000, 18000, 18000); rr(0); g.fill('evenodd'); // 海
    g.restore();
  };

  // 10) 玩家在哪一層（隧道）：每幀 level(y)；換層的時候換碰撞（下面：裡面的牆擋；上面：洞口上面的欄杆擋）
  //     這兩種碰撞只給玩家（layerCols：town.src.js 給開車、走路的）：車流、警察在隧道那段永遠是下面那層（快速道路、聯外道路自己的護欄擋）
  const walkable = (x, z) => depth(x, z) < 0.55;
  V.walkable = walkable;
  const API = {
    group, tunnels: TS, list: HS, high: false, ceil: TOP - 0.6, coast: COAST,
    tunAt, corrAt, topAt, topN, depth, walkable, lift, layerCols: [...lowCols, ...highCols],
    walkBounds: { x0: COAST.x0 - 120, x1: COAST.x1 + 120, z0: COAST.z0 - 120, z1: COAST.z1 + 120 }, // 走得到的範圍（走路的 bounds：本來到快速道路外面一點就是看不到的牆）
    level(y) {
      const hi = y > 4.5;
      if (hi === API.high) return;
      API.high = hi;
      for (const c of lowCols) c.off = hi;
      for (const c of tunVil) c.off = hi;
      for (const c of highCols) c.off = !hi;
    },
    inside: (x, z, y) => tunAt(x, z) >= 0 && y < TOP,
    dimK: 1,
    update(dt, cam, scene) { // 海的小波浪；鏡頭在隧道裡面：太陽、天空光變暗
      if (waterTex) { waterTex.offset.x = (waterTex.offset.x + dt * 0.006) % 1; waterTex.offset.y = (waterTex.offset.y + dt * 0.0041) % 1; }
      if (!cam || !scene) { if (API.lights && API.dimK !== 1) { API.dimK = 1; for (const [o, i0] of API.lights) o.intensity = i0; } return; } // 沒有鏡頭（回車庫頁、去比賽、在房子裡）：光調回來
      if (!API.lights) { API.lights = []; scene.traverse((o) => { if (o.isLight && (o.isDirectionalLight || o.isHemisphereLight)) API.lights.push([o, o.intensity]); }); }
      const want = API.inside(cam.position.x, cam.position.z, cam.position.y) && !API.high ? 0.42 : 1, k = API.dimK + (want - API.dimK) * (1 - Math.exp(-dt * 5));
      if (Math.abs(k - API.dimK) < 1e-4 && k === want) return;
      API.dimK = Math.abs(k - want) < 0.002 ? want : k;
      for (const [o, i0] of API.lights) o.intensity = i0 * API.dimK;
    },
    info: null,
  };
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - T0;
  API.info = { meshes, tris, hills: HS.length, trees, tunCols: tunVil.length, tunnels: TS.map((T) => ({ name: T.name, x: T.x, z0: T.z0, z1: T.z1, len: +(T.z1 - T.z0).toFixed(1) })), ms: +ms.toFixed(1) };
  if (V.info) V.info.hills = API.info;
  V.hills = API;
  return API;
}
function fixWinding(geo) { // 平的東西：三角形都朝上
  const p = geo.attributes.position, I = geo.index.array;
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k], b = I[k + 1], c = I[k + 2], ux = p.getX(b) - p.getX(a), uz = p.getZ(b) - p.getZ(a), vx = p.getX(c) - p.getX(a), vz = p.getZ(c) - p.getZ(a);
    if (uz * vx - ux * vz < 0) { I[k + 1] = c; I[k + 2] = b; }
  }
}
function mergeGeos(L) { // 同樣屬性的幾個（有 index）併成一個
  let nv = 0, ni = 0; for (const g of L) { nv += g.attributes.position.count; ni += g.index.count; }
  const out = new THREE.BufferGeometry(), names = Object.keys(L[0].attributes);
  for (const nm of names) { const isz = L[0].attributes[nm].itemSize, A = new Float32Array(nv * isz); let o = 0; for (const g of L) { A.set(g.attributes[nm].array, o); o += g.attributes[nm].array.length; } out.setAttribute(nm, new THREE.BufferAttribute(A, isz)); }
  const I = new Uint32Array(ni); let o = 0, base = 0; for (const g of L) { const src = g.index.array; for (let k = 0; k < src.length; k++) I[o++] = src[k] + base; base += g.attributes.position.count; }
  out.setIndex(new THREE.BufferAttribute(I, 1)); out.computeBoundingSphere(); return out;
}

return { buildHills, hillsFonts, HILL_TEXT, HILL_LIST, hillH, inTunnel, tunnels, COAST, coastD, coastY };
})();
