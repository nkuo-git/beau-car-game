// ---- 賽車場（大便龍賽車場）：直線加速賽道北邊一條 3.7 公里的封閉賽道，一圈一圈跟對手比 ----
// Nick 2026-10-04「賽道要很長不要只是直線」
// 位置：直線加速賽道（x −60…760、z ±6）北邊的草地：x 230…1150、z −160…−740（從上面看逆時針：主直線在南邊往東開）
//   從村子自己開過去：直線加速賽道入口（x −51、z 0）北邊的護欄開一個口 → 新的柏油路往北再往東 → 維修區後面的停車場 → 維修道 → 開上賽道
//   村子、直線加速賽道、快速道路、越野車場都沒有動（只有 race.src.js 北邊的三座遠山往北移、樹不種在新路上，village.js／race.src.js 北邊的護欄開一個口）
// 一圈：主直線（起終點、起跑格、維修道、看台）→ 第 1 彎（重煞車，外面碎石）→ 兩個高速彎 → 中速彎 → 後直線（減速彎）→ 髮夾彎 → 下坡的長彎 →
//   中速彎、S 彎 → 最後一個彎回到主直線
// 世界座標跟 village.js、drive.js 一樣：x 往東、y 往上、z 往南；heading＝rotation.y（0 朝東、π/2 朝北）
// 【API】
//   await circuitFonts();                    招牌的中文字（跟 villageFonts 一起等）
//   const P = buildCircuit(V, { renderer });  V＝buildVillage() 回傳的（buildOffroad 之後）；賽車場加進 V（V.group、V.places、V.colliders、V.roads、V.bounds、V.info.circuit）
//     V.surfaceAt、V.route 包一層：賽車場裡照這裡算（柏油 0、草地 1、碎石 2），外面完全照舊
//     V.places.circuit：維修區的報名處 { name, pos, zone（開進來慢一點就停好、選對手）, park（停好的位置）, spawn }
//   P.course：賽道中線（一圈 len 公尺、n 點、每 ds 公尺一點；s＝0 在起終點線，往東開）
//     { len, n, ds, x, z, tx, tz, k（曲率，左轉 +）, wl, wr（左右到護欄多遠）, line（跑線：往右 +）, at(s, out) → { x, z, tx, tz, k }, project(x, z, hint) → { s, d（往右 +）, i, dist } }
//   P.gates：檢查點 [{ s, x, z, tx, tz, hw }] × 12（最後一個＝起終點）；P.grid(k) → 第 k 個起跑格的 { x, z, heading }（車子中心）
//   P.inside(x, z)：在賽車場的護欄裡面（含維修區、停車場、聯外道路）；P.zoneAt(x, z) → 'track' | 'pad' | 'access' | null
//   P.info：{ meshes, tris, colliders, ms }；P.setLights(n)：起跑燈亮幾顆（0–5；−1 全暗）；P.dispose()（V.dispose() 也會叫）
//   createCircuitRace({ world: V, scene, drive, opps, laps, hudParent, title, onFinish, onDone, onAbort, calm })
//     opps：[{ name, obj（輕量車 buildLodCar 回傳的：car、setRoll、setLook）, perf（{ hp, kg, cda, vmax, awd, drive }）, skill（'rookie' | 'ok' | 'good' | 'pro' | 'slow'）, boss }]
//     drive：開車的（createDrive 回傳的）；比賽一開始把你放到最後一個起跑格、對手排在前面；五顆紅燈一顆一顆亮、全部熄掉才可以開
//     onFinish(result) → { lines: [多顯示的字] }（獎金由呼叫的人加）；onDone({ again })：「再比一次」／「開走」；onAbort(why)：'quit'、'left'（開出賽車場）
//     → { update(dt)（drive.update 之後叫）, abort(why), dispose(), standings(), state（'grid' | 'run' | 'done' | 'off'）, time, me, ais, result }
//     result：{ place, n, time, best（最快一圈）, laps, won }
// 效能：地面（草、柏油、碎石、白線＋路緣石）、護欄、看台、建築都照材質合併（450 公尺一塊）；樹一個 InstancedMesh；對手一台 4 個 draw call（輕量車）＋影子一個
import * as THREE from 'three';

// 打包（build-art.mjs、build-app.mjs）：跟 offroad.js 一樣整個包在一個函式裡，只露出下面這些名字
export const { buildCircuit, circuitFonts, CIRCUIT_TEXT, CIRCUIT_KEEP, createCircuitRace, CIRCUIT_SKILL, circuitCourse, circuitCSS, circuitFmt, circuitCar, circuitProfile } = (() => {
const TAU = Math.PI * 2;
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", "WenQuanYi Zen Hei", sans-serif';
const COND = '"Barlow Condensed", "Arial Narrow", sans-serif';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (e0, e1, v) => { const t = clamp((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const wrapA = (a) => { a = (a + Math.PI) % TAU; return a < 0 ? a + Math.PI : a - Math.PI; };
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const CC = new Map();
const C = (hex) => { let v = CC.get(hex); if (!v) { const c = new THREE.Color(hex); v = [c.r, c.g, c.b]; CC.set(hex, v); } return v; }; // 線性顏色
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const plen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
function segD(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1; let t = ((px - ax) * dx + (pz - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const ex = ax + dx * t - px, ez = az + dz * t - pz; return Math.sqrt(ex * ex + ez * ez); }
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function fitFont(g, text, maxW, px, fam = SANS) { let s = px; for (; s > 8; s -= 2) { g.font = `700 ${s}px ${fam}`; if (g.measureText(text).width <= maxW) break; } return s; }

// ---- 賽道的形狀：多邊形的角（逆時針）＋每個角的圓弧半徑；out＝彎道外側到護欄幾公尺、grav＝外側鋪碎石（衝出去會慢下來）----
const LAYOUT = [
  [230, -160, 60, 22, 0], // 最後一個彎（左）→ 主直線
  [1150, -160, 40, 32, 1], // 第 1 彎：主直線盡頭重煞車（左）
  [1150, -330, 260, 18, 0], [1050, -470, 260, 18, 0], // 高速的左、右
  [1050, -600, 35, 28, 1], [900, -600, 70, 22, 0], [900, -740, 30, 28, 1], // 中速彎三個
  [660, -740, 14, 17, 1], [642, -728, 14, 17, 1], [608, -728, 14, 17, 1], [590, -740, 14, 17, 1], // 後直線中間的減速彎（右、左）
  [250, -740, 17, 30, 1], [240, -695, 25, 24, 1], // 髮夾彎
  [450, -600, 70, 20, 0], [470, -470, 45, 22, 1], [700, -470, 60, 18, 0], [770, -400, 70, 18, 0], [720, -330, 40, 24, 1], // 內場：長的右彎、中速彎
  [560, -330, 45, 16, 0], [500, -270, 45, 16, 0], [400, -270, 60, 16, 0], [340, -330, 30, 18, 1], // S 彎
  [230, -330, 80, 20, 0], // 往南回主直線
];
const HW = 6.5, W0 = 13, SF_X = 640; // 跑道半寬；直線兩邊到護欄；起終點線（主直線往東）
// 維修區：維修道（z −150…−138）、車庫（x 475…805）、後面的停車場，全部是柏油，跟主直線接在一起（x 300…372、952…990 是進出口）
const PAD = { x0: 300, x1: 990, z0: -153.4, z1: -92 };
const PIT = { z: -144, x0: 300, x1: 990, wall: { x0: 372, x1: 952, z: -150.8 } };
const GARAGE = { x0: 475, x1: 805, z0: -138, z1: -126, h: 8 };
const BOX = { x: 446, z: -144 }; // 報名處（停在這裡選對手）
const JX = -51; // 聯外道路接直線加速賽道入口的地方（x −51、z 0）
const ACC_POLY = [[JX, -3, 0], [JX, -100, 35], [300, -100, 0]]; // 聯外道路（9 公尺寬）
const ACC_W = 9;
// 樹（race.src.js 的 buildTrack）不要種的地方：聯外道路 [x0, z0, x1, z1]
const CIRCUIT_KEEP = [[-64, -116, 4, -5], [-10, -112, 310, -86]];
// 對手開車的功力：lat＝過彎抓地（你的 1）、brk＝煞車、react＝起跑反應（秒）
const SKILL = { slow: { lat: 0.62, brk: 0.7, react: 0.8 }, rookie: { lat: 0.68, brk: 0.75, react: 0.65 }, ok: { lat: 0.74, brk: 0.8, react: 0.5 }, good: { lat: 0.8, brk: 0.86, react: 0.4 }, pro: { lat: 0.86, brk: 0.9, react: 0.3 } };
const AERO = 0.55; // 跟 drive.js 一樣（街機的風阻）
const SIGNS = { name: '大便龍賽車場', short: '賽車場', sf: '起點 · 終點', pit: '維修區', ads: ['阿輝改車廠', '阿財車行', '越野車場', '加油！衝啊！', '安全第一', '大便龍賽車場'], arch: '大便龍賽車場 →', exit: '出口', welcome: '歡迎光臨' };
const HUD_TEXT = '第名圈你放棄比賽出發開反了掉頭最後一圈最快再比一次開走獎金秒準備中選對手開始離開贏過先還沒出現';
const CIRCUIT_TEXT = [...new Set([...Object.values(SIGNS).flat().join(''), ...HUD_TEXT].filter((ch) => ch.charCodeAt(0) > 0x2e80))].join('');
function circuitFonts(ms = 1500) {
  const f = typeof document !== 'undefined' && document.fonts;
  if (!f || !f.load) return Promise.resolve();
  const all = Promise.all([f.load(`700 64px ${SANS}`, CIRCUIT_TEXT), f.load(`700 64px ${COND}`, '0123456789 ')]).catch(() => {});
  return Promise.race([all, new Promise((r) => setTimeout(r, ms))]);
}

// ---- 中線：每個角換成圓弧（切線長 R·tan(θ/2)），每 ds（約 2 公尺）一點；s＝0 移到起終點線 ----
function fillet(P, closed, step = 0.5) { // P：[[x, z, R], ...] → { pts: [[x, z], ...], corners: [{ at（第幾點）, n, R, left, k }] }
  const N = P.length, out = [], corners = [];
  const T = P.map((p, i) => {
    if (!closed && (i === 0 || i === N - 1)) return null;
    const a = P[(i + N - 1) % N], c = P[(i + 1) % N], l1 = Math.hypot(p[0] - a[0], p[1] - a[1]), l2 = Math.hypot(c[0] - p[0], c[1] - p[1]);
    const din = [(p[0] - a[0]) / l1, (p[1] - a[1]) / l1], dout = [(c[0] - p[0]) / l2, (c[1] - p[1]) / l2];
    const th = Math.acos(clamp(din[0] * dout[0] + din[1] * dout[1], -1, 1)), left = din[0] * dout[1] - din[1] * dout[0] < 0;
    return { din, dout, th, t: p[2] * Math.tan(th / 2), left, R: p[2] };
  });
  const M = closed ? N : N - 1;
  for (let i = 0; i < M; i++) {
    const p = P[i], k = T[i], q = P[(i + 1) % N], kn = T[(i + 1) % N];
    let a1 = [p[0], p[1]];
    if (k && k.R > 0 && k.th > 1e-6) {
      const a0 = [p[0] - k.din[0] * k.t, p[1] - k.din[1] * k.t], nL = [k.din[1], -k.din[0]], sg = k.left ? 1 : -1, cx = a0[0] + nL[0] * sg * k.R, cz = a0[1] + nL[1] * sg * k.R;
      const n = Math.max(1, Math.ceil((k.R * k.th) / step)), ang0 = Math.atan2(a0[1] - cz, a0[0] - cx);
      corners.push({ at: out.length, n, R: k.R, left: k.left, idx: i });
      for (let j = 0; j < n; j++) { const ang = ang0 + (k.left ? -1 : 1) * k.th * (j / n); out.push([cx + Math.cos(ang) * k.R, cz + Math.sin(ang) * k.R]); }
      a1 = [p[0] + k.dout[0] * k.t, p[1] + k.dout[1] * k.t];
    } else if (!closed && i === 0) a1 = [p[0], p[1]];
    const b0 = kn && kn.R > 0 ? [q[0] - kn.din[0] * kn.t, q[1] - kn.din[1] * kn.t] : [q[0], q[1]], sl = Math.hypot(b0[0] - a1[0], b0[1] - a1[1]), m = Math.max(1, Math.ceil(sl / step));
    for (let j = 0; j < m; j++) out.push([a1[0] + (b0[0] - a1[0]) * (j / m), a1[1] + (b0[1] - a1[1]) * (j / m)]);
  }
  if (!closed) out.push([P[N - 1][0], P[N - 1][1]]);
  return { pts: out, corners };
}
let COURSE = null;
function makeCourse() {
  if (COURSE) return COURSE;
  const F = fillet(LAYOUT.map((p) => [p[0], p[1], p[2]]), true), raw = F.pts, m = raw.length;
  // 細的點（0.5 公尺）累積長度 → 照長度平均取 n 點
  const cum = new Float64Array(m + 1); for (let i = 1; i <= m; i++) { const a = raw[i - 1], b = raw[i % m]; cum[i] = cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const L = cum[m];
  let s0 = 0; for (let i = 0; i < m; i++) { const a = raw[i], b = raw[(i + 1) % m]; if (a[1] === b[1] && a[1] === LAYOUT[0][1] && a[0] <= SF_X && b[0] > SF_X) { s0 = cum[i] + (SF_X - a[0]); break; } }
  const n = Math.round(L / 2), ds = L / n, x = new Float32Array(n), z = new Float32Array(n), tx = new Float32Array(n), tz = new Float32Array(n), k = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    let s = s0 + i * ds; if (s >= L) s -= L;
    if (i === 0 || s < cum[j]) j = 0;
    while (cum[j + 1] < s) j++;
    const a = raw[j], b = raw[(j + 1) % m], f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
    x[i] = a[0] + (b[0] - a[0]) * f; z[i] = a[1] + (b[1] - a[1]) * f;
  }
  for (let i = 0; i < n; i++) { const a = (i + n - 1) % n, b = (i + 1) % n, dx = x[b] - x[a], dz = z[b] - z[a], l = Math.hypot(dx, dz); tx[i] = dx / l; tz[i] = dz / l; }
  for (let i = 0; i < n; i++) { const a = (i + n - 1) % n, b = (i + 1) % n, h0 = Math.atan2(-tz[a], tx[a]), h1 = Math.atan2(-tz[b], tx[b]); k[i] = wrapA(h1 - h0) / (2 * ds); }
  // 彎道：中線上的範圍（s0..s1）、左右、半徑
  const sOf = (rawIdx) => { let s = cum[rawIdx] - s0; if (s < 0) s += L; return s; };
  const corners = F.corners.map((c) => { const a = sOf(c.at), b = a + (cum[c.at + c.n] - cum[c.at]); const L5 = LAYOUT[c.idx]; return { s0: a, s1: b, R: c.R, left: c.left, out: L5[3], grav: !!L5[4], idx: c.idx }; });
  // 左右到護欄多遠：直線 W0；彎道外側照 LAYOUT（前 30、後 20 公尺開始變寬）；外側碎石（彎前 15 到彎後 25 公尺）
  const wl = new Float32Array(n).fill(W0), wr = new Float32Array(n).fill(W0), gl = new Uint8Array(n), gr = new Uint8Array(n);
  const dS = (s, a) => { let d = s - a; if (d > L / 2) d -= L; if (d < -L / 2) d += L; return d; };
  for (const c of corners) for (let i = 0; i < n; i++) {
    const s = i * ds, da = dS(s, c.s0), db = dS(s, c.s1);
    const ramp = Math.min(ss(-60, -30, da), 1 - ss(20, 45, db)); if (ramp <= 0) continue;
    const W = W0 + (c.out - W0) * ramp, OUT = c.left ? wr : wl; if (W > OUT[i]) OUT[i] = W;
    if (c.grav && da > -15 && db < 25) (c.left ? gr : gl)[i] = 1;
  }
  const at = (s, o = {}) => {
    s = ((s % L) + L) % L; const f0 = s / ds, i = Math.floor(f0) % n, b = (i + 1) % n, f = f0 - Math.floor(f0);
    o.x = x[i] + (x[b] - x[i]) * f; o.z = z[i] + (z[b] - z[i]) * f; o.tx = tx[i] + (tx[b] - tx[i]) * f; o.tz = tz[i] + (tz[b] - tz[i]) * f; o.k = k[i] + (k[b] - k[i]) * f; o.i = i;
    const l = Math.hypot(o.tx, o.tz) || 1; o.tx /= l; o.tz /= l; return o;
  };
  const PR = { s: 0, d: 0, i: 0, dist: 0 };
  const project = (px, pz, hint = -1, o = PR) => { // 投影到中線：s、d（往右 +）、最近的點 i；hint＝上一次的 i（附近找就好）
    let bi = 0, bd = Infinity;
    if (hint >= 0) { for (let q = -14; q <= 14; q++) { const i = (hint + q + n) % n, d = (x[i] - px) ** 2 + (z[i] - pz) ** 2; if (d < bd) { bd = d; bi = i; } } }
    if (hint < 0 || bd > 400) { bd = Infinity; for (let i = 0; i < n; i += 3) { const d = (x[i] - px) ** 2 + (z[i] - pz) ** 2; if (d < bd) { bd = d; bi = i; } } for (let q = -3; q <= 3; q++) { const i = (bi + q + n) % n, d = (x[i] - px) ** 2 + (z[i] - pz) ** 2; if (d < bd) { bd = d; bi = i; } } }
    // 前後兩段裡最近的那段
    let best = null;
    for (const a of [(bi + n - 1) % n, bi]) {
      const b = (a + 1) % n, dx = x[b] - x[a], dz = z[b] - z[a], l2 = dx * dx + dz * dz, t = clamp(((px - x[a]) * dx + (pz - z[a]) * dz) / l2, 0, 1), qx = x[a] + dx * t, qz = z[a] + dz * t, d2 = (px - qx) ** 2 + (pz - qz) ** 2;
      if (!best || d2 < best.d2) best = { d2, a, t, qx, qz, l: Math.sqrt(l2) };
    }
    const a = best.a, txa = tx[a], tza = tz[a];
    o.s = (a + best.t) * ds; o.i = best.t < 0.5 ? a : (a + 1) % n; o.dist = Math.sqrt(best.d2);
    o.d = -(px - best.qx) * tza + (pz - best.qz) * txa; // 往右（法線 (−tz, tx)）+
    return o;
  };
  // 跑線（對手開的線）：在跑道裡（離邊 1.4 公尺）拉直，曲率越小越好（橡皮筋：每點往前後兩點的中間拉，先粗後細）
  const lim = HW - 1.4, line = new Float32Array(n), nx = (i) => -tz[i], nz = (i) => tx[i];
  for (const [st, it] of [[12, 70], [5, 90], [2, 110], [1, 70]]) for (let r = 0; r < it; r++) for (let i = 0; i < n; i++) {
    const a = (i - st + n) % n, b = (i + st) % n;
    const mx = (x[a] + nx(a) * line[a] + x[b] + nx(b) * line[b]) / 2, mz = (z[a] + nz(a) * line[a] + z[b] + nz(b) * line[b]) / 2;
    const d = (mx - x[i] - nx(i) * line[i]) * nx(i) + (mz - z[i] - nz(i) * line[i]) * nz(i);
    line[i] = clamp(line[i] + 0.6 * d, -lim, lim);
  }
  // 跑線的曲率、每一段多長（對手照這個算速度）
  const lk = new Float32Array(n), lq = new Float32Array(n);
  const LX = (i) => x[i] + nx(i) * line[i], LZ = (i) => z[i] + nz(i) * line[i];
  for (let i = 0; i < n; i++) {
    const a = (i + n - 2) % n, b = (i + 2) % n, ax = LX(a), az = LZ(a), px = LX(i), pz = LZ(i), bx = LX(b), bz = LZ(b);
    const c1 = (px - ax) * (bz - az) - (pz - az) * (bx - ax), la = Math.hypot(px - ax, pz - az), lb = Math.hypot(bx - px, bz - pz), lc = Math.hypot(bx - ax, bz - az);
    lk[i] = (-2 * c1) / (la * lb * lc || 1); // 左轉 +
    const j = (i + 1) % n; lq[i] = Math.hypot(LX(j) - px, LZ(j) - pz);
  }
  for (let r = 0; r < 2; r++) { const t = Float32Array.from(lk); for (let i = 0; i < n; i++) lk[i] = (t[(i + n - 1) % n] + 2 * t[i] + t[(i + 1) % n]) / 4; }
  COURSE = { len: L, n, ds, x, z, tx, tz, k, wl, wr, gl, gr, line, lk, lq, corners, at, project };
  return COURSE;
}

// ---- 車的加速、煞車（對手；跟 drive.js 差不多：馬力、重量、起步抓地、風阻）----
function carModel(perf) {
  const P = perf || {}, m = (P.kg || 1400) + 75, pw = (P.hp || 300) * 745.7 * 0.88 * 0.9, tract = 1.35 * 9.81 * (P.awd ? 0.9 : P.drive ?? 0.74), aero = (AERO * 0.6 * (P.cda || 0.65)) / m, vtop = (P.vmax || 250) / 3.6;
  return { vtop, acc: (v) => Math.min(tract, pw / (m * Math.max(v, 3))) - 0.147 - aero * v * v, brk: (v) => 9.5 + 2.5 * Math.min(1, (v * v) / 4900) + 1.4 + aero * v * v, lat: (v) => 13 + 2 * clamp((v - 20) / 50, 0, 1) };
}
function speedProfile(CO, M, sk) { // 照跑線的曲率：彎道最快多快（側向抓地 × 功力）、往回算煞車點、往前算加速
  const n = CO.n, v = new Float32Array(n);
  for (let i = 0; i < n; i++) { const kk = Math.abs(CO.lk[i]); let u = M.vtop; if (kk > 1e-5) { u = Math.min(u, Math.sqrt((sk.lat * M.lat(30)) / kk)); u = Math.min(M.vtop, Math.sqrt((sk.lat * M.lat(u)) / kk)); } v[i] = u; }
  for (let pass = 0; pass < 2; pass++) for (let i = n - 1; i >= 0; i--) { const j = (i + 1) % n; v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * M.brk(v[j]) * sk.brk * CO.lq[i])); }
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) { const j = (i + n - 1) % n; v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * Math.max(0.3, M.acc(v[j])) * CO.lq[j])); }
  return v;
}

// ---- 蓋：一個材質、一塊（450 公尺）一個網格 ----
const CH = 450, CX0 = -100, CZ0 = -850;
function bank() {
  const map = new Map();
  const get = (mat, x, z) => { const key = mat + ':' + Math.floor((x - CX0) / CH) + ',' + Math.floor((z - CZ0) / CH); let g = map.get(key); if (!g) map.set(key, (g = { mat, p: [], n: [], u: [], c: [], i: [], v: 0 })); return g; };
  return { map, get };
}
const vtx = (g, x, y, z, nx, ny, nz, u, v, c) => { g.p.push(x, y, z); g.n.push(nx, ny, nz); g.u.push(u, v); g.c.push(c[0], c[1], c[2]); return g.v++; };
function quad(g, a, b, c, d, uv, col) { // 正面看逆時針 a（左下）b（右下）c（右上）d（左上）；uv＝[u0, v0, u1, v1]
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = d[0] - a[0], wy = d[1] - a[1], wz = d[2] - a[2];
  let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  const k = vtx(g, a[0], a[1], a[2], nx, ny, nz, uv[0], uv[1], col); vtx(g, b[0], b[1], b[2], nx, ny, nz, uv[2], uv[1], col); vtx(g, c[0], c[1], c[2], nx, ny, nz, uv[2], uv[3], col); vtx(g, d[0], d[1], d[2], nx, ny, nz, uv[0], uv[3], col);
  g.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
}
function flat(g, a, b, c, d, y, uvf, col) { // 地上的四邊形（四個 [x, z]）：法線朝上，uv＝uvf(x, z)
  const cr = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]); // 從上面看的方向：要順著 +y 法線
  const P = cr < 0 ? [a, b, c, d] : [a, d, c, b], cs = Array.isArray(col[0]) ? (cr < 0 ? col : [col[0], col[3], col[2], col[1]]) : null;
  const k = g.v; P.forEach((p, j) => { const t = uvf(p[0], p[1]); vtx(g, p[0], y, p[1], 0, 1, 0, t[0], t[1], cs ? cs[j] : col); });
  g.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
}
// 盒子（實心的顏色）：中心 (x, y0 底, z)、半長 hx、半寬 hz、高 h、轉 ry；skip＝不要底
function box(g, x, y0, z, hx, hz, h, ry, col, top = col) {
  const c = Math.cos(ry), s = Math.sin(ry), P = (lx, ly, lz) => [x + lx * c + lz * s, y0 + ly, z - lx * s + lz * c];
  const a = P(-hx, 0, hz), b = P(hx, 0, hz), cc = P(hx, 0, -hz), d = P(-hx, 0, -hz), A = P(-hx, h, hz), B = P(hx, h, hz), Cc = P(hx, h, -hz), D = P(-hx, h, -hz), u = [0.5, 0.5, 0.5, 0.5];
  quad(g, a, b, B, A, u, col); quad(g, b, cc, Cc, B, u, mul(col, 0.92)); quad(g, cc, d, D, Cc, u, mul(col, 0.85)); quad(g, d, a, A, D, u, mul(col, 0.92)); quad(g, A, B, Cc, D, u, top);
}
// 貼圖的面：直立的長方形（從 p0 到 p1、y0..y1），正面朝 p0→p1 的右邊（(−dz, dx)）；看的人看過去 p0 在左邊
function wall(g, p0, p1, y0, y1, uv, col = [1, 1, 1]) { quad(g, [p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], uv, col); }

// ---- 貼圖 ----
function toTex(c, aniso, rep) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function noiseTex(R, N, base, spots, aniso) { // 地面：底色＋小點點（柏油、碎石、草）
  const [c, g] = cv(N, N); g.fillStyle = base; g.fillRect(0, 0, N, N);
  for (const [n, cols, s] of spots) for (let i = 0; i < n; i++) { g.fillStyle = cols[(R() * cols.length) | 0]; const w = 1 + R() * s; g.fillRect(R() * N, R() * N, w, w); }
  return toTex(c, aniso, true);
}
function grassTex(R, aniso) { // 割過的草（兩種綠一條一條；一張 = 24 公尺）
  const N = 128, [c, g] = cv(N, N);
  g.fillStyle = '#7f9157'; g.fillRect(0, 0, N, N / 2); g.fillStyle = '#738650'; g.fillRect(0, N / 2, N, N / 2);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${50 + R() * 40},${70 + R() * 50},${30 + R() * 25},0.3)`; g.fillRect(R() * N, R() * N, 1.5, 1.5); }
  return toTex(c, aniso, true);
}
function atlas(aniso) { // 護欄、輪胎牆、車庫、觀眾、窗戶、招牌、廣告、煞車牌：一張 1024×1024
  const W = 1024, H = 1024, [c, g] = cv(W, H), uv = {};
  const reg = (name, x, y, w, h, draw) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); draw(g, w, h); g.restore(); uv[name] = [(x + 1) / W, 1 - (y + h - 1) / H, (x + w - 1) / W, 1 - (y + 1) / H]; };
  const R = rng(5);
  const T = (g2, t, x, y, px, col, max, fam = SANS) => { g2.fillStyle = col; g2.textAlign = 'center'; g2.textBaseline = 'middle'; fitFont(g2, t, max, px, fam); g2.fillText(t, x, y); };
  reg('rail', 0, 0, 256, 64, (g2, w, h) => { // 鋼板護欄（W 形：亮暗亮暗）
    const gr = g2.createLinearGradient(0, 0, 0, h); [[0, '#e9edf0'], [0.18, '#9aa1a8'], [0.32, '#dfe4e8'], [0.5, '#7e858c'], [0.68, '#dfe4e8'], [0.82, '#9aa1a8'], [1, '#6b7177']].forEach(([o, col]) => gr.addColorStop(o, col));
    g2.fillStyle = gr; g2.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { g2.fillStyle = 'rgba(80,70,60,0.12)'; g2.fillRect(R() * w, R() * h, 2, 1); }
  });
  reg('tyre', 256, 0, 256, 128, (g2, w, h) => { // 輪胎牆：三層輪胎、紅白的帶子
    g2.fillStyle = '#16171a'; g2.fillRect(0, 0, w, h);
    for (let r = 0; r < 3; r++) for (let q = 0; q < 6; q++) { const cx = q * 43 + 21 + (r % 2) * 10, cy = h - 21 - r * 42; g2.fillStyle = '#26272b'; g2.beginPath(); g2.arc(cx, cy, 20, 0, TAU); g2.fill(); g2.fillStyle = '#0b0b0c'; g2.beginPath(); g2.arc(cx, cy, 9, 0, TAU); g2.fill(); }
    for (let q = 0; q < 4; q++) { g2.fillStyle = q % 2 ? '#f2f3f5' : '#d0342c'; g2.fillRect((q * w) / 4, h * 0.42, w / 4, h * 0.16); }
  });
  reg('conc', 512, 0, 256, 64, (g2, w, h) => { // 水泥牆：上面紅白
    g2.fillStyle = '#c9c7c0'; g2.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { g2.fillStyle = 'rgba(0,0,0,0.06)'; g2.fillRect(R() * w, R() * h, 2, 2); }
    for (let q = 0; q < 4; q++) { g2.fillStyle = q % 2 ? '#f2f3f5' : '#d0342c'; g2.fillRect((q * w) / 4, 0, w / 4, h * 0.22); }
  });
  reg('garage', 0, 64, 256, 256, (g2, w, h) => { // 一間車庫（15 公尺寬、8 公尺高）：上面一排玻璃、下面捲門、號碼
    g2.fillStyle = '#e8e9ec'; g2.fillRect(0, 0, w, h);
    g2.fillStyle = '#5d7c96'; g2.fillRect(6, 10, w - 12, 70); g2.fillStyle = 'rgba(255,255,255,0.35)'; for (let q = 0; q < 6; q++) g2.fillRect(8 + q * 41, 12, 3, 66);
    g2.fillStyle = '#2b2e35'; g2.fillRect(0, 92, w, 26); g2.fillStyle = '#FF6A1F'; g2.fillRect(0, 92, w, 5);
    g2.fillStyle = '#8f949b'; g2.fillRect(18, 128, w - 36, h - 128); g2.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 134; y < h; y += 9) g2.fillRect(18, y, w - 36, 2);
  });
  reg('crowd', 256, 128, 256, 128, (g2, w, h) => { // 觀眾：兩排座位，坐滿人
    g2.fillStyle = '#3a4d6b'; g2.fillRect(0, 0, w, h);
    const cols = ['#f2c230', '#d0342c', '#2f6fd6', '#f2f3f5', '#3dbb6b', '#ff8a2a', '#1d1f23', '#e57fb0'];
    for (let r = 0; r < 2; r++) for (let q = 0; q < 16; q++) { if (R() < 0.12) continue; const x = q * 16 + 8 + (R() - 0.5) * 4, y = r * 64 + 40; g2.fillStyle = cols[(R() * cols.length) | 0]; g2.fillRect(x - 6, y - 4, 12, 22); g2.fillStyle = ['#f1c9a5', '#d8a77f', '#8d5a3b'][(R() * 3) | 0]; g2.beginPath(); g2.arc(x, y - 12, 6, 0, TAU); g2.fill(); g2.fillStyle = '#1d1f23'; g2.fillRect(x - 6, y - 19, 12, 4); }
  });
  reg('glass', 512, 128, 128, 128, (g2, w, h) => { const gr = g2.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#9fc3dd'); gr.addColorStop(1, '#3f6585'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h); g2.fillStyle = '#2b2e35'; for (let q = 0; q <= 4; q++) g2.fillRect((q * w) / 4 - 2, 0, 4, h); g2.fillRect(0, h / 2 - 2, w, 4); });
  reg('chk', 640, 128, 128, 128, (g2, w, h) => { const s = 32; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g2.fillStyle = (i + j) % 2 ? '#111' : '#f2f3f5'; g2.fillRect(i * s, j * s, s, s); } });
  reg('banner', 0, 320, 1024, 128, (g2, w, h) => { // 大招牌：大便龍賽車場
    g2.fillStyle = '#1A0F07'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#FF6A1F'; g2.fillRect(0, 0, w, 10); g2.fillRect(0, h - 10, w, 10);
    for (const x0 of [0, w - 96]) for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { g2.fillStyle = (i + j) % 2 ? '#111' : '#f2f3f5'; g2.fillRect(x0 + i * 32, 16 + j * 24, 32, 24); }
    T(g2, SIGNS.name, w / 2, h / 2 + 3, 92, '#FFD23F', w - 240);
  });
  reg('arch', 0, 448, 1024, 96, (g2, w, h) => { g2.fillStyle = '#FF6A1F'; g2.fillRect(0, 0, w, h); T(g2, SIGNS.arch, w / 2, h / 2 + 2, 70, '#1A0F07', w - 60); });
  const adCol = [['#2F6FD6', '#fff'], ['#C8281E', '#fff'], ['#8A5A2B', '#FFF3E0'], ['#FFD23F', '#1A0F07'], ['#1F8A4C', '#fff'], ['#1A0F07', '#FF9A4D']];
  SIGNS.ads.forEach((t, q) => reg('ad' + q, (q % 2) * 512, 544 + (q >> 1) * 96, 512, 96, (g2, w, h) => { g2.fillStyle = adCol[q][0]; g2.fillRect(0, 0, w, h); g2.fillStyle = 'rgba(255,255,255,0.18)'; g2.fillRect(0, 0, w, 8); T(g2, t, w / 2, h / 2 + 3, 62, adCol[q][1], w - 40); }));
  ['300', '200', '100'].forEach((t, q) => reg('b' + t, q * 128, 832, 128, 128, (g2, w, h) => { g2.fillStyle = '#f2f3f5'; g2.fillRect(0, 0, w, h); g2.lineWidth = 8; g2.strokeStyle = '#1d1f23'; g2.strokeRect(6, 6, w - 12, h - 12); T(g2, t, w / 2, h / 2 + 4, 76, '#1d1f23', w - 20, COND); }));
  reg('pit', 384, 832, 384, 96, (g2, w, h) => { g2.fillStyle = '#1d1f23'; g2.fillRect(0, 0, w, h); T(g2, SIGNS.pit, w / 2, h / 2 + 2, 60, '#FFD23F', w - 30); });
  reg('sf', 384, 928, 384, 96, (g2, w, h) => { g2.fillStyle = '#f2f3f5'; g2.fillRect(0, 0, w, h); T(g2, SIGNS.sf, w / 2, h / 2 + 2, 58, '#1d1f23', w - 30); });
  reg('flag', 768, 832, 128, 128, (g2, w, h) => { g2.fillStyle = '#ff8a2a'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#1d1f23'; g2.fillRect(0, h * 0.44, w, h * 0.12); });
  reg('white', 896, 832, 64, 64, (g2, w, h) => { g2.fillStyle = '#ffffff'; g2.fillRect(0, 0, w, h); });
  return { tex: toTex(c, aniso, false), uv };
}
const dot = (r) => { const u = (r[0] + r[2]) / 2, v = (r[1] + r[3]) / 2; return [u, v, u, v]; };

// ---- 蓋賽車場：地面、跑道、路緣石、白線、碎石、護欄、看台、維修區、塔台、起跑燈、招牌、樹；碰撞、路面、路線、小地圖 ----
function buildCircuit(V, opt = {}) {
  const T0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const CO = makeCourse(), n = CO.n, ds = CO.ds, L = CO.len, X = CO.x, Z = CO.z, TX = CO.tx, TZ = CO.tz;
  const aniso = opt.renderer ? Math.min(8, opt.renderer.capabilities.getMaxAnisotropy()) : 4, R = rng(20261004);
  const NX = (i) => -TZ[i], NZ = (i) => TX[i];
  const P2 = (i, d) => [X[i] + NX(i) * d, Z[i] + NZ(i) * d];
  // 聯外道路的中線
  const ACC = fillet(ACC_POLY, false, 1).pts;
  // ---- 範圍格子（2 公尺）：每一格離護欄多遠 F（裡面 −）、最近的是中線哪一點 J（n＝維修區、n+1＝聯外道路）----
  const G = { x0: -72, z0: -820, st: 2 }; G.nx = Math.ceil((1250 - G.x0) / G.st) + 1; G.nz = Math.ceil((-8 - G.z0) / G.st) + 1;
  const F = new Float32Array(G.nx * G.nz).fill(99), J = new Uint16Array(G.nx * G.nz).fill(65535);
  const stamp = (x0, z0, x1, z1, fn, code) => {
    const i0 = clamp(Math.floor((x0 - G.x0) / G.st), 0, G.nx - 1), i1 = clamp(Math.ceil((x1 - G.x0) / G.st), 0, G.nx - 1), j0 = clamp(Math.floor((z0 - G.z0) / G.st), 0, G.nz - 1), j1 = clamp(Math.ceil((z1 - G.z0) / G.st), 0, G.nz - 1);
    for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) { const k = jj * G.nx + ii, f = fn(G.x0 + ii * G.st, G.z0 + jj * G.st); if (f < F[k]) { F[k] = f; J[k] = code; } }
  };
  for (let i = 0; i < n; i++) {
    const r = Math.max(CO.wl[i], CO.wr[i]) + 5, cx = X[i], cz = Z[i], nx = NX(i), nz = NZ(i), wl = CO.wl[i], wr = CO.wr[i];
    stamp(cx - r, cz - r, cx + r, cz + r, (px, pz) => { const dx = px - cx, dz = pz - cz; return Math.sqrt(dx * dx + dz * dz) - (dx * nx + dz * nz >= 0 ? wr : wl); }, i);
  }
  const padF = (px, pz) => { const dx = Math.max(PAD.x0 - px, 0, px - PAD.x1), dz = Math.max(PAD.z0 - pz, 0, pz - PAD.z1); const out = Math.hypot(dx, dz); return (out > 0 ? out : -Math.min(px - PAD.x0, PAD.x1 - px, pz - PAD.z0, PAD.z1 - pz)) - 3; };
  stamp(PAD.x0 - 8, PAD.z0 - 8, PAD.x1 + 8, PAD.z1 + 8, padF, n);
  for (let i = 1; i < ACC.length; i++) { const [ax, az] = ACC[i - 1], [bx, bz] = ACC[i], r = ACC_W / 2 + 7; stamp(Math.min(ax, bx) - r, Math.min(az, bz) - r, Math.max(ax, bx) + r, Math.max(az, bz) + r, (px, pz) => segD(px, pz, ax, az, bx, bz) - (ACC_W / 2 + 2), n + 1); }
  // 路口（從直線加速賽道往北轉進來）：東邊做成喇叭口，z −20 → −8 往東斜出去 7.5 公尺（不會一轉彎就擦到護欄；直線加速北邊的牆開口到 x −37，看台從 −35 開始）
  const MOUTH = (z) => 0.625 * clamp(z + 20, 0, 14);
  stamp(JX - 10, -24, JX + 18, -8, (px, pz) => Math.max(px - (JX + ACC_W / 2 + 2 + MOUTH(pz)), JX - ACC_W / 2 - 2 - px), n + 1);
  const cellK = (x, z) => { const ii = Math.round((x - G.x0) / G.st), jj = Math.round((z - G.z0) / G.st); return ii < 0 || jj < 0 || ii >= G.nx || jj >= G.nz ? -1 : jj * G.nx + ii; };
  const Fat = (x, z) => { // 雙線性
    const fx = (x - G.x0) / G.st, fz = (z - G.z0) / G.st, i = Math.floor(fx), j = Math.floor(fz); if (i < 0 || j < 0 || i >= G.nx - 1 || j >= G.nz - 1) return 99;
    const a = fx - i, b = fz - j, k = j * G.nx + i; return (F[k] * (1 - a) + F[k + 1] * a) * (1 - b) + (F[k + G.nx] * (1 - a) + F[k + G.nx + 1] * a) * b;
  };
  const inPad = (x, z) => x >= PAD.x0 && x <= PAD.x1 && z >= PAD.z0 && z <= PAD.z1;
  const PRJ = { s: 0, d: 0, i: 0, dist: 0 };
  const zoneAt = (x, z) => { const k = cellK(x, z); if (k < 0 || F[k] > 1.5) return null; const j = J[k]; return j === n ? 'pad' : j === n + 1 ? 'access' : j < n ? 'track' : null; };
  // ---- 路面：柏油（跑道、路緣石、維修區、聯外道路）0、草地 1、碎石 2；外面照舊 ----
  const surf0 = V.surfaceAt;
  const surfaceAt = (x, z) => {
    if (z > -8.5 && z < -6.2 && x > JX - ACC_W / 2 && x < JX + ACC_W / 2 + MOUTH(-8)) return 0; // 路口：直線加速的牆到網格邊邊那一條（柏油）
    const k = cellK(x, z); if (k < 0 || F[k] > 2.5) return surf0(x, z);
    if (inPad(x, z)) return 0;
    const j = J[k];
    if (j === n + 1) return Fat(x, z) <= -1.7 ? 0 : 1; // 聯外道路（F＝離路中線 −（半寬＋2））
    if (j === n) return 1;
    const p = CO.project(x, z, j, PRJ), ad = Math.abs(p.d);
    if (ad <= HW + 1.3) return 0;
    const i = p.i, gv = p.d > 0 ? CO.gr[i] : CO.gl[i];
    return gv && ad >= HW + 3 ? 2 : 1;
  };
  V.surfaceAt = surfaceAt;

  // ---- 材質 ----
  const AT = atlas(aniso);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const tAsph = noiseTex(R, 256, '#56585c', [[5000, ['#4a4c50', '#65676b', '#3f4144', '#6e7074'], 1.6]], aniso), tGrav = noiseTex(R, 128, '#b9a27c', [[2400, ['#a08860', '#cfbb97', '#8d7756', '#e2d3b4'], 2.2]], aniso), tGrass = grassTex(R, aniso);
  const mats = {
    grass: std({ map: tGrass, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    grav: std({ map: tGrav, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 }),
    asph: std({ map: tAsph, vertexColors: true, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -5 }),
    paint: std({ vertexColors: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -7 }),
    solid: std({ vertexColors: true, roughness: 0.78 }),
    atlas: std({ map: AT.tex, vertexColors: true, roughness: 0.7 }),
    lamp: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };
  const B = bank(), UV = AT.uv;
  const wuv = (s) => (x, z) => [x / s, z / s]; // 地面：世界座標的 uv（s 公尺一張）
  const Y = { grav: 0.012, asph: 0.03, paint: 0.045 };
  const WHITE = C('#f2f3f5'), RED = C('#d0342c'), YEL = C('#f2c230');
  // ---- 草地（整個賽車場一大片，割草的條紋）----
  { const g = B.get('grass', 600, -400), x0 = -60, x1 = 1250, z0 = -820, z1 = -62; flat(g, [x0, z1], [x1, z1], [x1, z0], [x0, z0], 0, wuv(24), [1, 1, 1]); }
  // ---- 跑道（柏油：中間跑線的地方深一點＝輪胎的膠）、直線 8 公尺一段、彎道 2 公尺一段 ----
  const rows = []; for (let i = 0; i < n; i++) { const kk = Math.abs(CO.k[i]) + Math.abs(CO.k[(i + 1) % n]) + Math.abs(CO.k[(i + n - 1) % n]); if (kk > 1e-4 || i % 4 === 0) rows.push(i); }
  const COLS = [-HW, -HW / 2, 0, HW / 2, HW];
  for (let r = 0; r < rows.length; r++) {
    const i = rows[r], j = rows[(r + 1) % rows.length], g = B.get('asph', X[i], Z[i]);
    for (let q = 0; q < 4; q++) {
      const sh = (ii, d) => { const e = (d - CO.line[ii]) / 2.2, k = 1 - 0.22 * Math.exp(-e * e); return [k, k, k * 1.01]; };
      const a = P2(i, COLS[q]), b = P2(i, COLS[q + 1]), c = P2(j, COLS[q + 1]), d = P2(j, COLS[q]);
      flat(g, a, b, c, d, Y.asph, wuv(6), [sh(i, COLS[q]), sh(i, COLS[q + 1]), sh(j, COLS[q + 1]), sh(j, COLS[q])]);
    }
  }
  // ---- 維修區、停車場（一大片）、聯外道路 ----
  { const g = B.get('asph', 640, -120); flat(g, [PAD.x0, PAD.z1], [PAD.x1, PAD.z1], [PAD.x1, PAD.z0], [PAD.x0, PAD.z0], Y.asph - 0.004, wuv(6), [[0.97, 0.97, 0.98], [0.97, 0.97, 0.98], [0.97, 0.97, 0.98], [0.97, 0.97, 0.98]]); }
  const offsetPts = (pts, d) => pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [p[0] - (dz / l) * d, p[1] + (dx / l) * d]; });
  const ribbonPts = (mat, pts, d0, d1, y, col, uvf) => { const A = offsetPts(pts, d0), Bp = offsetPts(pts, d1); for (let i = 0; i < pts.length - 1; i++) flat(B.get(mat, pts[i][0], pts[i][1]), A[i], Bp[i], Bp[i + 1], A[i + 1], y, uvf || wuv(6), col); };
  ribbonPts('asph', ACC, -ACC_W / 2, ACC_W / 2, Y.asph, [0.98, 0.98, 0.98]);
  { const e = (z) => [JX + ACC_W / 2 + MOUTH(z), z]; flat(B.get('asph', JX, -12), [JX + ACC_W / 2 - 0.5, -20], e(-20), e(-6.3), [JX + ACC_W / 2 - 0.5, -6.3], Y.asph, wuv(6), [0.98, 0.98, 0.98]); } // 喇叭口的柏油
  // ---- 白線、路緣石（紅白一格 2 公尺）、起終點（格子）、起跑格、維修道的線 ----
  const ribbon = (mat, i0, i1, d0, d1, y, colF) => { for (let i = i0; i < i1; i++) { const a = ((i % n) + n) % n, b = (a + 1) % n, c = colF(i); if (!c) continue; flat(B.get(mat, X[a], Z[a]), P2(a, d0), P2(a, d1), P2(b, d1), P2(b, d0), y, wuv(6), c); } };
  for (let r = 0; r < rows.length; r++) { const i = rows[r], j = rows[(r + 1) % rows.length]; for (const sg of [1, -1]) flat(B.get('paint', X[i], Z[i]), P2(i, sg * (HW - 0.4)), P2(i, sg * (HW - 0.15)), P2(j, sg * (HW - 0.15)), P2(j, sg * (HW - 0.4)), Y.paint, wuv(6), WHITE); }
  for (const c of CO.corners) { // 內側：整個彎；外側：出彎那一段
    const a = Math.round(c.s0 / ds), b = Math.round(c.s1 / ds), inS = c.left ? -1 : 1, mid = Math.round((a + b) / 2);
    ribbon('paint', a - 3, b + 3, inS * HW, inS * (HW + 1.3), Y.paint - 0.003, (i) => (i % 2 ? RED : WHITE));
    ribbon('paint', mid - 2, b + 8, -inS * HW, -inS * (HW + 1.3), Y.paint - 0.003, (i) => (i % 2 ? RED : WHITE));
  }
  { // 起終點：兩排黑白格子
    const g = B.get('paint', SF_X, -160), z0 = -160 - HW, cnt = 12, w = (2 * HW) / cnt;
    for (let r = 0; r < 2; r++) for (let q = 0; q < cnt; q++) flat(g, [SF_X - 1 + r, z0 + q * w], [SF_X + r, z0 + q * w], [SF_X + r, z0 + (q + 1) * w], [SF_X - 1 + r, z0 + (q + 1) * w], Y.paint + 0.002, wuv(6), (q + r) % 2 ? C('#16171a') : WHITE);
  }
  const gridPose = (k) => { const x = SF_X - 9 - 9 * k, d = k % 2 ? 3.2 : -3.2; return { x, z: -160 + d, heading: 0 }; };
  for (let k = 0; k < 6; k++) { // 起跑格：白色的 ㄇ
    const p = gridPose(k), g = B.get('paint', p.x, p.z), x0 = p.x + 3, zz = p.z;
    flat(g, [x0 - 0.3, zz - 1.4], [x0, zz - 1.4], [x0, zz + 1.4], [x0 - 0.3, zz + 1.4], Y.paint, wuv(6), WHITE);
    for (const s of [-1, 1]) flat(g, [x0 - 1.8, zz + s * 1.4 - 0.15], [x0, zz + s * 1.4 - 0.15], [x0, zz + s * 1.4 + 0.15], [x0 - 1.8, zz + s * 1.4 + 0.15], Y.paint, wuv(6), WHITE);
  }
  { // 維修道：靠賽道那邊白線、車庫前面黃色停車格；聯外道路：兩邊白線、中間虛線
    ribbonPts('paint', [[PIT.x0, PIT.z - 6], [PIT.x1, PIT.z - 6]], -0.15, 0.15, Y.paint, WHITE);
    ribbonPts('paint', [[PIT.x0 + 30, PIT.z + 5.6], [PIT.x1 - 20, PIT.z + 5.6]], -0.12, 0.12, Y.paint, YEL);
    for (let x = GARAGE.x0 + 2; x < GARAGE.x1; x += 15) { const g = B.get('paint', x, -140); flat(g, [x, -141], [x + 0.25, -141], [x + 0.25, -138.4], [x, -138.4], Y.paint, wuv(6), YEL); }
    ribbonPts('paint', ACC, ACC_W / 2 - 0.45, ACC_W / 2 - 0.2, Y.paint, WHITE); ribbonPts('paint', ACC, -ACC_W / 2 + 0.2, -ACC_W / 2 + 0.45, Y.paint, WHITE);
    let acc = 0; for (let i = 1; i < ACC.length; i++) { const a = ACC[i - 1], b = ACC[i]; acc += Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc % 9 < 4.5) ribbonPts('paint', [a, b], -0.1, 0.1, Y.paint, WHITE); }
  }
  // ---- 碎石（彎道外側，從跑道邊 3 公尺到護欄前面 1 公尺）----
  for (let i = 0; i < n; i++) for (const sg of [1, -1]) {
    const G0 = sg > 0 ? CO.gr : CO.gl, Wd = sg > 0 ? CO.wr : CO.wl, j = (i + 1) % n;
    if (!G0[i] || !G0[j]) continue;
    flat(B.get('grav', X[i], Z[i]), P2(i, sg * (HW + 3)), P2(i, sg * (Wd[i] - 0.8)), P2(j, sg * (Wd[j] - 0.8)), P2(j, sg * (HW + 3)), Y.grav, wuv(3), [1, 1, 1]);
  }

  // ---- 護欄：F＝0 的等高線（marching squares）→ 連成線 → 簡化 → 一段一段（≤ 4 公尺）：鋼板護欄、輪胎牆（碎石那邊）、水泥牆（主直線看台前面）----
  const contours = (() => {
    const nx = G.nx, segs = [], eid = (i, j, dir) => (j * nx + i) * 2 + dir; // dir 0：(i,j)→(i+1,j)，1：(i,j)→(i,j+1)
    const ept = (i, j, dir) => { const k0 = j * nx + i, k1 = dir ? k0 + nx : k0 + 1, a = F[k0], b = F[k1], t = a / (a - b); return dir ? [G.x0 + i * G.st, G.z0 + (j + t) * G.st] : [G.x0 + (i + t) * G.st, G.z0 + j * G.st]; };
    for (let j = 0; j < G.nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const k = j * nx + i, a = F[k] < 0, b = F[k + 1] < 0, c = F[k + nx + 1] < 0, d = F[k + nx] < 0; // a (i,j) b (i+1,j) c (i+1,j+1) d (i,j+1)
      const code = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0) | (d ? 8 : 0); if (code === 0 || code === 15) continue;
      const E = { t: eid(i, j, 0), r: eid(i + 1, j, 1), b: eid(i, j + 1, 0), l: eid(i, j, 1) };
      const pairs = { 1: [['l', 't']], 2: [['t', 'r']], 3: [['l', 'r']], 4: [['r', 'b']], 6: [['t', 'b']], 7: [['l', 'b']], 8: [['b', 'l']], 9: [['b', 't']], 11: [['b', 'r']], 12: [['r', 'l']], 13: [['r', 't']], 14: [['t', 'l']] }[code]
        || (code === 5 ? [['l', 't'], ['r', 'b']] : [['t', 'r'], ['b', 'l']]);
      for (const [p, q] of pairs) segs.push([E[p], E[q]]);
    }
    const pos = new Map(); const P = (id) => { let v = pos.get(id); if (!v) { const k = id >> 1, i = k % nx, j = (k / nx) | 0; v = ept(i, j, id & 1); pos.set(id, v); } return v; };
    const adj = new Map(); segs.forEach(([a, b], s) => { for (const e of [a, b]) { let l = adj.get(e); if (!l) adj.set(e, (l = [])); l.push(s); } });
    const used = new Uint8Array(segs.length), lines = [];
    for (let s = 0; s < segs.length; s++) {
      if (used[s]) continue; used[s] = 1;
      const chain = [segs[s][0], segs[s][1]];
      for (const dir of [1, 0]) for (;;) { // 往兩頭接
        const e = dir ? chain[chain.length - 1] : chain[0], nb = (adj.get(e) || []).find((q) => !used[q]); if (nb == null) break;
        used[nb] = 1; const o = segs[nb][0] === e ? segs[nb][1] : segs[nb][0]; if (dir) chain.push(o); else chain.unshift(o);
      }
      const pts = chain.map(P), closed = chain[0] === chain[chain.length - 1];
      if (plen(pts) > 6) lines.push({ pts, closed });
    }
    return lines;
  })();
  const simplify = (pts, eps) => { // Douglas–Peucker
    if (pts.length < 3) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
    while (st.length) { const [a, b] = st.pop(); let bd = 0, bi = -1; for (let i = a + 1; i < b; i++) { const d = segD(pts[i][0], pts[i][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]); if (d > bd) { bd = d; bi = i; } } if (bd > eps) { keep[bi] = 1; st.push([a, bi], [bi, b]); } }
    return pts.filter((p, i) => keep[i]);
  };
  const colliders = [], BAR = [];
  let barLen = 0;
  for (const ln of contours) {
    const pts = simplify(ln.pts, 0.2);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.05) continue;
      barLen += l;
      const nC = Math.max(1, Math.ceil(l / 10)); // 碰撞：最長 10 公尺一個盒子（厚 0.6、高 1）
      for (let q = 0; q < nC; q++) { const f0 = q / nC, f1 = (q + 1) / nC, x0 = a[0] + (b[0] - a[0]) * f0, z0 = a[1] + (b[1] - a[1]) * f0, x1 = a[0] + (b[0] - a[0]) * f1, z1 = a[1] + (b[1] - a[1]) * f1; colliders.push({ t: 'box', x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: Math.hypot(x1 - x0, z1 - z0) / 2 + 0.15, hz: 0.3, rot: Math.atan2(-(z1 - z0), x1 - x0), h: 1, circuit: 1 }); }
      const nM = Math.max(1, Math.round(l / 4)); // 畫：4 公尺左右一段
      for (let q = 0; q < nM; q++) { const f0 = q / nM, f1 = (q + 1) / nM; BAR.push([a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0, a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1]); }
    }
  }
  // 哪一種：碎石那邊＝輪胎牆；主直線北邊（看台前面）＝水泥牆＋廣告；其他＝鋼板護欄
  const SOLID = C('#8d9197'), POST = C('#5d6268');
  const mainS = (s) => { let d = s; if (d > L / 2) d -= L; return d > -340 && d < 470; }; // 主直線（起終點前後）
  for (const [x0, z0, x1, z1] of BAR) {
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, l = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / l, uz = (z1 - z0) / l;
    const fL = Fat(mx - uz * 0.8, mz + ux * 0.8), inSide = fL < Fat(mx + uz * 0.8, mz - ux * 0.8) ? 1 : -1; // 賽道在哪一邊：(−uz, ux) 那邊＝1
    const nx = -uz * inSide, nz = ux * inSide; // 朝賽道
    const k = cellK(mx + nx * 3, mz + nz * 3), j = k >= 0 ? J[k] : 65535;
    let type = 'rail';
    if (j < n) { const p = CO.project(mx, mz, j, PRJ), gv = p.d > 0 ? CO.gr[p.i] : CO.gl[p.i]; if (gv) type = 'tyre'; else if (mainS(p.s) && p.d < 0) type = 'conc'; }
    // 正面（朝賽道）：從賽道看過去左到右
    const A = inSide > 0 ? [x0, z0] : [x1, z1], Bq = inSide > 0 ? [x1, z1] : [x0, z0];
    const g = B.get('atlas', mx, mz), gs = B.get('solid', mx, mz);
    if (type === 'rail') {
      const back = (p) => [p[0] - nx * 0.12, p[1] - nz * 0.12];
      wall(g, A, Bq, 0.42, 0.8, UV.rail); wall(g, back(Bq), back(A), 0.42, 0.8, UV.rail, [0.8, 0.8, 0.8]); // 正面、背面
      const px = A[0] - nx * 0.25, pz = A[1] - nz * 0.25; box(gs, px, 0, pz, 0.07, 0.07, 0.76, Math.atan2(-nz, nx), POST);
    } else {
      const h = type === 'tyre' ? 0.95 : 1.1, th = type === 'tyre' ? 0.8 : 0.45, back = (p) => [p[0] - nx * th, p[1] - nz * th], uvr = type === 'tyre' ? UV.tyre : UV.conc;
      wall(g, A, Bq, 0, h, uvr); wall(g, back(Bq), back(A), 0, h, uvr, [0.85, 0.85, 0.85]);
      quad(gs, [A[0], h, A[1]], [Bq[0], h, Bq[1]], [back(Bq)[0], h, back(Bq)[1]], [back(A)[0], h, back(A)[1]], [0.5, 0.5, 0.5, 0.5], type === 'tyre' ? C('#1d1e21') : C('#b9b7b0'));
    }
  }
  // ---- 東西（看台、車庫、塔台、起跑燈、維修區的牆、拱門、天橋、救援站、煞車牌、廣告）----
  const frameAt = (x, z, ry) => { const c = Math.cos(ry), s = Math.sin(ry); return (lx, ly, lz) => [x + lx * c + lz * s, ly, z - lx * s + lz * c]; }; // 局部：x 往前、z 往右
  const addBox = (x, y0, z, hx, hz, h, ry, col, top, hit) => { box(B.get('solid', x, z), x, y0, z, hx, hz, h, ry, col, top); if (hit) colliders.push({ t: 'box', x, z, hx, hz, rot: ry, h: y0 + h }); };
  // 看台：長 len、row 排（每排深 0.9、高 0.5），面向 ry 的 −z 方向（frame 的 −z＝前面）……這裡用：中心 (x, z)、ry＝看台「看的方向」
  function stand(x, z, look, len, rows = 9) {
    const ry = look - Math.PI / 2, P = frameAt(x, z, ry), D = rows * 0.9, H = rows * 0.5; // 局部：x 沿著看台、z 往後（遠離賽道）
    const g = B.get('atlas', x, z), gs = B.get('solid', x, z), conc = C('#c9c7c0'), cu = UV.crowd, nTile = Math.max(1, Math.round(len / 8));
    for (let r = 0; r < rows; r++) {
      const z0 = r * 0.9, y0 = r * 0.5, y1 = y0 + 0.5;
      for (let q = 0; q < nTile; q++) { const xa = -len / 2 + (q * len) / nTile, xb = -len / 2 + ((q + 1) * len) / nTile; quad(g, P(xb, y0, z0), P(xa, y0, z0), P(xa, y1, z0), P(xb, y1, z0), [cu[0], cu[1] + ((cu[3] - cu[1]) * (r % 2)) / 2, cu[2], cu[1] + ((cu[3] - cu[1]) * ((r % 2) + 1)) / 2], [1, 1, 1]); }
      quad(gs, P(len / 2, y1, z0), P(-len / 2, y1, z0), P(-len / 2, y1, z0 + 0.9), P(len / 2, y1, z0 + 0.9), [0.5, 0.5, 0.5, 0.5], conc);
    }
    quad(gs, P(-len / 2, 0, D), P(len / 2, 0, D), P(len / 2, H + 0.6, D), P(-len / 2, H + 0.6, D), [0.5, 0.5, 0.5, 0.5], mul(conc, 0.8)); // 背面
    for (const s of [-1, 1]) { const e = (s * len) / 2; if (s > 0) quad(gs, P(e, 0, D), P(e, 0, 0), P(e, 0.5, 0), P(e, H + 0.6, D), [0.5, 0.5, 0.5, 0.5], mul(conc, 0.9)); else quad(gs, P(e, 0, 0), P(e, 0, D), P(e, H + 0.6, D), P(e, 0.5, 0), [0.5, 0.5, 0.5, 0.5], mul(conc, 0.9)); }
    // 屋頂：柱子＋一片（前面高一點）
    const roof = C('#e8e9ec'), yr0 = H + 4.2;
    for (let q = 0; q <= Math.round(len / 20); q++) { const lx = -len / 2 + (q * len) / Math.round(len / 20), p = P(lx, 0, D + 0.3); box(gs, p[0], 0, p[2], 0.25, 0.25, yr0 + 0.6, ry, C('#5d6268')); }
    quad(gs, P(len / 2 + 1, yr0 + 1.2, -1.5), P(-len / 2 - 1, yr0 + 1.2, -1.5), P(-len / 2 - 1, yr0 + 0.6, D + 1), P(len / 2 + 1, yr0 + 0.6, D + 1), [0.5, 0.5, 0.5, 0.5], roof);
    quad(gs, P(-len / 2 - 1, yr0 + 1.2 - 0.05, -1.5), P(len / 2 + 1, yr0 + 1.2 - 0.05, -1.5), P(len / 2 + 1, yr0 + 0.55, D + 1), P(-len / 2 - 1, yr0 + 0.55, D + 1), [0.5, 0.5, 0.5, 0.5], mul(roof, 0.6)); // 屋頂底下
    const c0 = P(0, 0, D / 2); colliders.push({ t: 'box', x: c0[0], z: c0[2], hx: len / 2, hz: D / 2 + 0.3, rot: ry, h: H + 0.6 });
  }
  stand(525, -181, -Math.PI / 2, 100); stand(640, -181, -Math.PI / 2, 110); stand(755, -181, -Math.PI / 2, 100); // 主直線北邊（看維修區、起終點）
  stand(1196, -222, Math.PI, 60, 8); // 第 1 彎外面
  stand(390, -759, -Math.PI / 2, 90, 8); // 髮夾彎北邊
  stand(1095, -625, Math.atan2(-60, -80), 50, 7); // 第 4 彎外面（東北）
  // 維修區：車庫一長排（正面＝車庫貼圖）、屋頂、背面；塔台（玻璃、上面大招牌）
  {
    const gA = B.get('atlas', 640, -132), gs = B.get('solid', 640, -132), H = GARAGE.h, n15 = Math.round((GARAGE.x1 - GARAGE.x0) / 15);
    for (let q = 0; q < n15; q++) { const xa = GARAGE.x0 + q * 15, xb = xa + 15; quad(gA, [xb, 0, GARAGE.z0], [xa, 0, GARAGE.z0], [xa, H, GARAGE.z0], [xb, H, GARAGE.z0], UV.garage, [1, 1, 1]); }
    addBox((GARAGE.x0 + GARAGE.x1) / 2, 0, (GARAGE.z0 + GARAGE.z1) / 2 + 0.05, (GARAGE.x1 - GARAGE.x0) / 2 - 0.05, (GARAGE.z1 - GARAGE.z0) / 2 - 0.1, H, 0, C('#d9dadd'), C('#b7b9bd'), true);
    const t0 = { x: 640, z: -119, hx: 12, hz: 7 }; // 塔台（車庫後面）
    addBox(t0.x, 0, t0.z, t0.hx, t0.hz, 16, 0, C('#e8e9ec'), C('#9da1a6'), true);
    for (const [p0, p1] of [[[t0.x + t0.hx, t0.z - t0.hz - 0.05], [t0.x - t0.hx, t0.z - t0.hz - 0.05]], [[t0.x - t0.hx, t0.z + t0.hz + 0.05], [t0.x + t0.hx, t0.z + t0.hz + 0.05]]]) wall(gA, p0, p1, 11, 15.4, UV.glass);
    for (const sx of [-1, 1]) wall(gA, [t0.x + sx * (t0.hx + 0.05), t0.z + sx * t0.hz], [t0.x + sx * (t0.hx + 0.05), t0.z - sx * t0.hz], 11, 15.4, UV.glass);
    // 大招牌：塔台上面（兩面）
    wall(gA, [t0.x + 24, t0.z - 1], [t0.x - 24, t0.z - 1], 17, 23, UV.banner); wall(gA, [t0.x - 24, t0.z - 0.6], [t0.x + 24, t0.z - 0.6], 17, 23, UV.banner);
    for (const sx of [-1, 1]) box(gs, t0.x + sx * 20, 16, t0.z - 0.8, 0.3, 0.3, 1.2, 0, C('#5d6268'));
    // 維修區的牆（賽道跟維修道中間：水泥、上面紅白）＋「維修區」牌子
    const W = PIT.wall, nW = Math.round((W.x1 - W.x0) / 4);
    for (let q = 0; q < nW; q++) { const xa = W.x0 + (q * (W.x1 - W.x0)) / nW, xb = W.x0 + ((q + 1) * (W.x1 - W.x0)) / nW; wall(gA, [xb, W.z - 0.35], [xa, W.z - 0.35], 0, 1.1, UV.conc); wall(gA, [xa, W.z + 0.35], [xb, W.z + 0.35], 0, 1.1, UV.conc, [0.85, 0.85, 0.85]); }
    quad(gs, [W.x0, 1.1, W.z - 0.35], [W.x1, 1.1, W.z - 0.35], [W.x1, 1.1, W.z + 0.35], [W.x0, 1.1, W.z + 0.35], [0.5, 0.5, 0.5, 0.5], C('#b9b7b0'));
    for (let q = 0; q < Math.ceil((W.x1 - W.x0) / 10); q++) { const xa = W.x0 + q * 10, xb = Math.min(W.x1, xa + 10); colliders.push({ t: 'box', x: (xa + xb) / 2, z: W.z, hx: (xb - xa) / 2, hz: 0.35, rot: 0, h: 1.1, circuit: 1 }); }
    for (const x of [W.x0 + 10, 640 - 40, W.x1 - 10]) { wall(gA, [x + 2.5, W.z - 0.4], [x - 2.5, W.z - 0.4], 1.15, 2.4, UV.pit); wall(gA, [x - 2.5, W.z + 0.4], [x + 2.5, W.z + 0.4], 1.15, 2.4, UV.pit); box(gs, x, 1.1, W.z, 2.5, 0.08, 0.05, 0, C('#5d6268')); }
    // 起終點的牌子（維修區的牆上、面對賽道）
    wall(gA, [SF_X + 3, W.z - 0.4], [SF_X - 3, W.z - 0.4], 1.2, 2.4, UV.sf);
  }
  // 起跑燈：橫跨跑道（起終點線上面，x SF_X + 1），五組紅燈朝西（起跑格看得到）
  const gantryX = SF_X + 1.5;
  {
    const gs = B.get('solid', gantryX, -160), dark = C('#26282c');
    for (const z of [-168.6, -151]) addBox(gantryX, 0, z, 0.3, 0.3, 7, 0, dark, dark, z < -160);
    addBox(gantryX, 6.2, -159.8, 0.4, 9.2, 0.8, 0, dark, dark, false);
    for (let q = 0; q < 5; q++) box(gs, gantryX - 0.2, 4.7, -163 + q * 1.6, 0.25, 0.55, 1.5, 0, C('#111214'));
    const gA = B.get('atlas', gantryX, -160); wall(gA, [gantryX - 0.45, -168.6], [gantryX - 0.45, -151], 6.25, 6.95, UV.chk); wall(gA, [gantryX + 0.45, -151], [gantryX + 0.45, -168.6], 6.25, 6.95, UV.chk);
  }
  // 燈（自己一個網格，頂點色換顏色）：每組上下兩顆
  const lampGeo = (() => {
    const g = { p: [], n: [], u: [], c: [], i: [], v: 0 };
    for (let q = 0; q < 5; q++) for (const y of [5.05, 5.75]) { const z = -163 + q * 1.6, x = gantryX - 0.47, r = 0.24; quad(g, [x, y - r, z - r], [x, y - r, z + r], [x, y + r, z + r], [x, y + r, z - r], [0, 0, 1, 1], C('#3a0d0b')); }
    return g;
  })();
  // 聯外道路的拱門（「大便龍賽車場 →」）、救援站、煞車牌、天橋（後直線）、廣告牌
  {
    const ax = JX, az = -26, gs = B.get('solid', ax, az), gA = B.get('atlas', ax, az), post = C('#3b3f46');
    for (const s of [-1, 1]) addBox(ax + s * 6.8, 0, az, 0.35, 0.35, 7.6, 0, post, post, true);
    addBox(ax, 6.0, az, 7.2, 0.3, 1.6, 0, post, post, false);
    wall(gA, [ax - 7, az + 0.32], [ax + 7, az + 0.32], 6.05, 7.55, UV.arch); wall(gA, [ax + 7, az - 0.32], [ax - 7, az - 0.32], 6.05, 7.55, UV.banner);
  }
  { // 後直線的天橋（兩面大招牌）
    const bx = 760, s0 = CO.project(bx, -740), i = s0.i, w = Math.max(CO.wl[i], CO.wr[i]) + 2.5, a = P2(i, -w), b = P2(i, w), gs = B.get('solid', bx, -740), gA = B.get('atlas', bx, -740), post = C('#3b3f46');
    for (const p of [a, b]) addBox(p[0], 0, p[1], 0.6, 0.6, 7.6, 0, post, post, true);
    addBox(bx, 6.2, -740, 0.9, w + 0.6, 1.8, 0, C('#e8e9ec'), C('#9da1a6'), false);
    const n0 = Math.round((2 * w) / 26); for (let q = 0; q < n0; q++) { const za = -740 - w + (q * 2 * w) / n0, zb = -740 - w + ((q + 1) * 2 * w) / n0; wall(gA, [bx - 0.92, za], [bx - 0.92, zb], 6.25, 7.95, UV.banner); wall(gA, [bx + 0.92, zb], [bx + 0.92, za], 6.25, 7.95, UV.banner); }
  }
  // 彎道外面：救援站（小房子＋橘色旗子）、彎前的煞車牌 300/200/100（外側草地）
  const big = CO.corners.filter((c) => [1, 4, 6, 7, 11, 14, 17, 21].includes(c.idx));
  for (const c of big) {
    const outS = c.left ? 1 : -1, i = Math.round(((c.s0 + c.s1) / 2) / ds) % n, W = (outS > 0 ? CO.wr : CO.wl)[i] + 4, p = P2(i, outS * W), ry = Math.atan2(-TZ[i], TX[i]);
    addBox(p[0], 0, p[1], 1.2, 1.2, 2.4, ry, C('#f2f3f5'), C('#ff8a2a'), true);
    const gA = B.get('atlas', p[0], p[1]), q0 = P2(i, outS * (W - 1.3)), fx = q0[0], fz = q0[1];
    box(B.get('solid', fx, fz), fx, 0, fz, 0.04, 0.04, 3.4, 0, C('#5d6268'));
    wall(gA, [fx, fz], [fx + TX[i] * 0.9, fz + TZ[i] * 0.9], 2.6, 3.3, UV.flag); wall(gA, [fx + TX[i] * 0.9, fz + TZ[i] * 0.9], [fx, fz], 2.6, 3.3, UV.flag);
    // 煞車牌：彎前 300、200、100 公尺（前面要有夠長的直線）
    let straight = 0; for (let q = 1; q < 200; q++) { const ii = (Math.round(c.s0 / ds) - q + n) % n; if (Math.abs(CO.k[ii]) > 1e-3) break; straight = q * ds; }
    for (const d of [300, 200, 100]) {
      if (d > straight - 10) continue;
      const ii = (Math.round((c.s0 - d) / ds) + n) % n, pp = P2(ii, outS * (HW + 2.2)), fx2 = pp[0], fz2 = pp[1], hw2 = 0.45; // 外側草地，牌子面向來車
      box(B.get('solid', fx2, fz2), fx2, 0, fz2, 0.05, 0.05, 1.0, 0, C('#5d6268'));
      const g2 = B.get('atlas', fx2, fz2), pl = [fx2 - NX(ii) * hw2, fz2 - NZ(ii) * hw2], pr = [fx2 + NX(ii) * hw2, fz2 + NZ(ii) * hw2];
      wall(g2, pl, pr, 0.95, 1.85, UV['b' + d]); wall(g2, pr, pl, 0.95, 1.85, UV.white, [0.7, 0.7, 0.7]);
    }
  }
  // 廣告牌（主直線看台前、第 1 彎、髮夾彎的護欄後面）
  { let q = 0;
    const ads = (sA, sB, side) => { for (let s = sA; s < sB; s += 14) { const i = (Math.round(s / ds) + n) % n, W = (side > 0 ? CO.wr : CO.wl)[i] + 0.9, a = P2(i, side * W), b = P2((i + 5) % n, side * W), g = B.get('atlas', a[0], a[1]); const uv = UV['ad' + (q++ % SIGNS.ads.length)]; if (side > 0) { wall(g, b, a, 0.3, 1.55, uv); wall(g, a, b, 0.3, 1.55, UV.white, [0.5, 0.5, 0.5]); } else { wall(g, a, b, 0.3, 1.55, uv); wall(g, b, a, 0.3, 1.55, UV.white, [0.5, 0.5, 0.5]); } } };
    const c1 = CO.corners.find((c) => c.idx === 1), c11 = CO.corners.find((c) => c.idx === 11);
    ads(L - 300, L - 40, -1); ads(40, 420, -1); ads(c1.s0 - 120, c1.s1 + 20, 1); ads(c11.s0 - 60, c11.s1 + 10, 1);
  }
  // ---- 樹（賽車場裡面的草地、護欄外面；離護欄 6 公尺以上、不擋看台、建築）----
  const blockers = colliders.filter((c) => !c.circuit && c.t === 'box');
  const TP = [];
  for (let tries = 0; tries < 6000 && TP.length < 420; tries++) {
    const x = -40 + R() * 1280, z = -815 + R() * 740, f = Fat(x, z);
    if (f < 7 || (f > 60 && R() < 0.65)) continue; // 外面遠的地方少一點
    if (x < 140 && z > -120) continue; // 直線加速賽道、村子那邊不種
    if (blockers.some((b) => Math.abs(x - b.x) < b.hx + 8 && Math.abs(z - b.z) < Math.max(b.hz, b.hx) + 8)) continue;
    if (CIRCUIT_KEEP.some(([a, b2, c, d]) => x > a && x < c && z > b2 && z < d)) continue;
    TP.push([x, z, 0.75 + R() * 0.9]);
  }
  const cone = new THREE.ConeGeometry(1.6, 5, 7); cone.translate(0, 4.2, 0);
  const trunk = new THREE.CylinderGeometry(0.18, 0.25, 1.8, 6); trunk.translate(0, 0.9, 0);
  const treeMat = std({ color: 0x3f5a32, roughness: 1 }), trunkMat = std({ color: 0x5a4332, roughness: 1 });
  const trees = new THREE.InstancedMesh(cone, treeMat, Math.max(1, TP.length)), trunks = new THREE.InstancedMesh(trunk, trunkMat, Math.max(1, TP.length));
  { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(); TP.forEach(([x, z, k], i) => { m4.compose(pv.set(x, 0, z), q, sc.set(k, k * (0.85 + ((i * 37) % 10) / 20), k)); trees.setMatrixAt(i, m4); trunks.setMatrixAt(i, m4); }); }
  trees.name = 'ci-trees'; trunks.name = 'ci-trunks';
  for (const tp of TP) if (tp[2] > 0) colliders.push({ t: 'circle', x: tp[0], z: tp[1], r: 0.3 * tp[2], h: 6, circuit: 1 });

  // ---- 網格 ----
  const group = new THREE.Group(); group.name = 'circuit';
  let tris = 0, meshes = 0;
  const geoOf = (g) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.u, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3));
    geo.setIndex(g.v > 65535 ? new THREE.Uint32BufferAttribute(g.i, 1) : new THREE.Uint16BufferAttribute(g.i, 1)); geo.computeBoundingSphere(); geo.computeBoundingBox();
    return geo;
  };
  const order = ['grass', 'grav', 'asph', 'paint', 'solid', 'atlas'];
  for (const [key, g] of [...B.map.entries()].sort((a, b) => order.indexOf(a[1].mat) - order.indexOf(b[1].mat))) {
    if (!g.v) continue;
    const m = new THREE.Mesh(geoOf(g), mats[g.mat]); m.name = 'ci-' + key; m.matrixAutoUpdate = false; m.updateMatrix(); group.add(m);
    tris += g.i.length / 3; meshes++;
  }
  const lampMesh = new THREE.Mesh(geoOf(lampGeo), mats.lamp); lampMesh.name = 'ci-lamps'; group.add(lampMesh); meshes++; tris += lampGeo.i.length / 3;
  group.add(trees, trunks); meshes += 2; tris += TP.length * (cone.index ? cone.index.count : cone.attributes.position.count) / 3 + TP.length * (trunk.index ? trunk.index.count : trunk.attributes.position.count) / 3;
  if (V.group) V.group.add(group);
  const lampCol = lampMesh.geometry.attributes.color, OFF = C('#3a0d0b'), ON = [1, 0.08, 0.05];
  const setLights = (k) => { // 第幾組亮（0–5）
    for (let q = 0; q < 5; q++) for (let r = 0; r < 2; r++) for (let v = 0; v < 4; v++) { const c = q < k ? ON : OFF; lampCol.setXYZ((q * 2 + r) * 4 + v, c[0], c[1], c[2]); }
    lampCol.needsUpdate = true;
  };
  setLights(0);

  // ---- 碰撞、地方、路、小地圖、範圍 ----
  V.colliders.push(...colliders);
  const places = {
    circuit: { name: SIGNS.short, pos: [BOX.x, BOX.z], zone: { x: BOX.x - 14, z: BOX.z, hx: 18, hz: 5.5, rot: 0 }, park: { x: BOX.x, z: BOX.z, heading: 0 }, spawn: { x: BOX.x, z: BOX.z, heading: 0 } },
  };
  Object.assign(V.places, places);
  const loop = []; for (let i = 0; i < n; i += 3) loop.push([X[i], Z[i]]); loop.push([X[0], Z[0]]);
  V.roads.push({ pts: loop, w: 13, kind: 'circuit', noNpc: true }, { pts: ACC.map((p) => p.slice()), w: ACC_W, kind: 'circuit', noNpc: true },
    { pts: [[PIT.x0, PIT.z], [PIT.x1, PIT.z]], w: 12, kind: 'circuit', noNpc: true }, { pts: [[PAD.x0 + 8, -109], [PAD.x1 - 8, -109]], w: 30, kind: 'circuit', noNpc: true });
  if (V.bounds) { V.bounds.x1 = Math.max(V.bounds.x1, 1230); V.bounds.z0 = Math.min(V.bounds.z0, -800); }

  // ---- 路線：賽車場裡面（照跑道的方向開到維修區入口 → 維修道 → 停車場 → 聯外道路）、聯外道路、村子（照舊）----
  const route0 = V.route;
  const join = (...rs) => { const pts = []; for (const r of rs) for (const p of r.pts || r) { const q = pts[pts.length - 1]; if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.05) pts.push([p[0], p[1]]); } return { pts, len: plen(pts) }; };
  const projPts = (pts, x, z) => { let bd = Infinity, bi = 1, bq = pts[0]; for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(x - qx, z - qz); if (d < bd) { bd = d; bi = i; bq = [qx, qz]; } } return { d: bd, i: bi, q: bq }; };
  const PIT_W = [370, PIT.z], BOXP = [BOX.x, BOX.z], PADW = [330, -100]; // 維修道西頭、報名處、停車場西頭
  const ACCR = ACC.slice().reverse();
  const toJ = (x, z) => { // 賽車場裡面任何地方 → 直線加速賽道入口（JX, 0）
    const zn = zoneAt(x, z);
    if (zn === 'access') { const pr = projPts(ACCR, x, z); return join([[x, z], pr.q], ACCR.slice(pr.i), [[JX, 0]]); }
    if (zn === 'pad' || inPad(x, z)) return join([[x, z]], z < -128 && x > GARAGE.x0 - 5 && x < GARAGE.x1 + 5 ? [[Math.min(x, GARAGE.x0 - 8), z]] : [], x > PADW[0] + 4 ? [PADW] : [], ACCR, [[JX, 0]]); // 已經過了停車場西頭：直接上聯外道路（不要繞回去）
    return join(trackTo(x, z, 345), [[372, PIT.z - 2]], [PIT_W, PADW], ACCR, [[JX, 0]]);
  };
  function trackTo(x, z, xTarget) { // 照跑道的方向開到主直線 x＝xTarget
    const p = CO.project(x, z), sT = CO.project(xTarget, -160).s;
    let s1 = sT; while (s1 < p.s + 2) s1 += L;
    const pts = [[x, z]], o = {}; for (let s = p.s + 4; s < s1; s += 8) { CO.at(s, o); pts.push([o.x, o.z]); }
    CO.at(sT, o); pts.push([o.x, o.z]); return pts;
  }
  const fromJ = (x, z) => { // 村子 → 賽車場報名處
    let lead;
    if (x > JX - 9 && x < 770 && Math.abs(z) < 7) lead = [[x, z], [JX, 0]]; // 在直線加速賽道上
    else { const r = route0(x, z, 'track'), pts = r.pts; let cut = pts.length; for (let i = 1; i < pts.length; i++) if (pts[i][0] >= JX && pts[i - 1][0] <= JX + 0.01 && Math.abs(pts[i][1]) < 7) { cut = i; break; } lead = [...pts.slice(0, cut), [JX, 0]]; }
    return join(lead, ACC, [PADW, PIT_W, BOXP]);
  };
  V.route = (x, z, dest) => {
    const zn = zoneAt(x, z), inC = !!zn || inPad(x, z);
    if (dest === 'circuit') {
      if (!inC) return fromJ(x, z);
      if (zn === 'access') { const pr = projPts(ACC, x, z); return join([[x, z], pr.q], ACC.slice(pr.i), [PADW, PIT_W, BOXP]); }
      if (zn === 'pad' || inPad(x, z)) return join([[x, z]], z < -128 && x > GARAGE.x0 - 5 && x < GARAGE.x1 + 5 && x > BOX.x ? [[Math.max(x, GARAGE.x1 + 8), z], [GARAGE.x1 + 8, PIT.z]] : [], [BOXP]);
      return join(trackTo(x, z, 345), [[372, PIT.z - 2], BOXP]);
    }
    if (!inC) return route0(x, z, dest);
    const a = toJ(x, z), b = route0(JX, 0, dest);
    return join(a, b);
  };
  // ---- 檢查點、起跑格 ----
  const NG = 12, gates = [];
  for (let k = 1; k <= NG; k++) { const s = (k * L) / NG, o = CO.at(s, {}), i = o.i; gates.push({ s: k === NG ? L : s, x: o.x, z: o.z, tx: o.tx, tz: o.tz, hw: Math.max(CO.wl[i], CO.wr[i]) + 3 }); }
  const grid = (k) => { const p = gridPose(k); return { x: p.x, z: p.z, heading: 0 }; };

  const info = { meshes, tris: Math.round(tris), colliders: colliders.length, barrier: Math.round(barLen), trees: TP.length, ms: 0, lap: Math.round(L) };
  if (V.info) V.info.circuit = info;
  const P = {
    group, course: CO, gates, grid, places, info, zoneAt, inside: (x, z) => !!zoneAt(x, z) || inPad(x, z), surfaceAt, setLights, F: Fat, contours, gantryX,
    dispose() {
      group.removeFromParent();
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const m of [...Object.values(mats), treeMat, trunkMat]) m.dispose();
      for (const t of [tAsph, tGrav, tGrass, AT.tex]) t.dispose();
    },
  };
  V.circuit = P;
  const d0 = V.dispose; V.dispose = function () { P.dispose(); return d0 ? d0.apply(this, arguments) : undefined; };
  info.ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - T0);
  return P;
}

// ==== 比賽 ====
const RCSS = `
.cir{position:absolute;inset:0;pointer-events:none;z-index:4;color:#F2F3F5;font-family:${SANS};-webkit-user-select:none;user-select:none}
.cir[hidden],.cir [hidden]{display:none!important}
.cir-p{position:absolute;top:58px;left:10px;min-width:138px;padding:8px 12px 9px;border-radius:16px;background:rgba(14,15,18,0.66);line-height:1.25}
.cir-p b{display:block;font-size:24px;font-weight:700;letter-spacing:.02em}
.cir-p span{display:block;font-size:14px;font-weight:600;color:#DADDE2}
.cir-p ol{margin:6px 0 0;padding:0 0 0 18px;font-size:13px;color:#C6CAD1}
.cir-p ol li.me{color:#FF9A4D;font-weight:700}
.cir-p button{margin-top:7px;padding:5px 12px;border:0;border-radius:999px;background:rgba(255,255,255,0.14);color:#F2F3F5;font:600 13px ${SANS};pointer-events:auto;cursor:pointer}
.cir-l{position:absolute;top:36%;left:50%;transform:translate(-50%,-50%);display:flex;gap:10px;padding:12px 16px;border-radius:20px;background:rgba(14,15,18,0.78)}
.cir-l i{width:34px;height:34px;border-radius:50%;background:#3a0d0b;box-shadow:inset 0 3px 6px rgba(0,0,0,0.6)}
.cir-l i.on{background:#ff2a1a;box-shadow:0 0 14px #ff2a1a}
.cir-c{position:absolute;top:38%;left:50%;transform:translate(-50%,-50%);font:700 60px/1.1 ${COND},${SANS};color:#FFD23F;text-shadow:0 5px 0 rgba(0,0,0,0.35);white-space:nowrap;text-align:center}
.cir-c.go{color:#3DDC84;font-size:70px}
.cir-c.warn{color:#FF5A4D;font-size:44px}
.cir-r{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(340px,calc(100% - 32px));max-height:calc(100% - 24px);overflow:auto;box-sizing:border-box;padding:18px 18px 16px;border-radius:22px;background:rgba(14,15,18,0.9);text-align:center;pointer-events:auto}
.cir-r h3{margin:0 0 4px;font-size:30px}
.cir-r p{margin:4px 0;font-size:16px;line-height:1.35}
.cir-r p.big{font-size:20px;font-weight:700;color:#FFD23F}
.cir-r ol{margin:8px auto 4px;padding:0 0 0 22px;text-align:left;font-size:15px;max-width:240px}
.cir-r ol li.me{color:#FF9A4D;font-weight:700}
.cir-r div{display:flex;gap:10px;justify-content:center;margin-top:12px}
.cir-r button{flex:1;min-height:48px;border:0;border-radius:999px;font:700 18px ${SANS};cursor:pointer}
.cir-r button.a,.cir-m button.a{background:#FF6A1F;color:#1A0F07;box-shadow:0 4px 0 #9E4213}
.cir-r button.b,.cir-m button.b{background:#2B2E35;color:#F2F3F5;box-shadow:0 4px 0 #111216}
.cir-m{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);width:min(420px,calc(100% - 20px));max-height:calc(100% - 20px);display:flex;flex-direction:column;box-sizing:border-box;padding:14px 14px 12px;border-radius:22px;background:rgba(14,15,18,0.92);color:#F2F3F5;font-family:${SANS};pointer-events:auto;z-index:5}
.cir-m h3{margin:0;font-size:22px}
.cir-m p{margin:2px 0 8px;font-size:14px;color:#C6CAD1}
.cir-m .list{flex:1 1 auto;min-height:0;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:2px}
.cir-m .list button{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:8px 10px;border:2px solid transparent;border-radius:14px;background:#2B2E35;color:#F2F3F5;text-align:left;cursor:pointer;font-family:${SANS}}
.cir-m .list button b{font-size:16px}
.cir-m .list button span,.cir-m .list button small{font-size:12px;color:#C6CAD1}
.cir-m .list button[aria-pressed="true"]{border-color:#FF6A1F;background:#3a2a20}
.cir-m .list button.beaten b::after{content:" ✓";color:#3DDC84}
.cir-m .list button:disabled{opacity:0.45;cursor:default}
.cir-m .row{display:flex;gap:10px;margin-top:10px}
.cir-m .row button{flex:1;min-height:46px;border:0;border-radius:999px;font:700 17px ${SANS};cursor:pointer}
.cir-m .row button:disabled{opacity:0.5}
body.ciracing #drivebar #dests{display:none}
body.cimenu #drivebar{visibility:hidden}
@media (max-height:520px){.cir-m .list{grid-template-columns:1fr 1fr 1fr}.cir-l{top:30%}.cir-c{font-size:46px}}
`;
const fmtT = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
let SHT = null;
const shadowTex = () => {
  if (SHT) return SHT;
  const [c, g] = cv(64, 64), gr = g.createRadialGradient(32, 32, 4, 32, 32, 31); gr.addColorStop(0, 'rgba(0,0,0,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  SHT = new THREE.CanvasTexture(c); return SHT;
};
const cssOnce = () => { if (typeof document === 'undefined' || document.getElementById('cir-style')) return; const s = document.createElement('style'); s.id = 'cir-style'; s.textContent = RCSS; document.head.appendChild(s); };
function createCircuitRace(o) {
  const V = o.world, P = V.circuit, CO = P.course, L = CO.len, n = CO.n, drv = o.drive, scene = o.scene, laps = clamp(o.laps | 0 || 2, 1, 9), GATES = P.gates, NG = GATES.length;
  const ci = drv.carInfo, pCX = (ci.nose + ci.tail) / 2, pHW = ci.halfW;
  const TMP = {}, PR = { s: 0, d: 0, i: 0, dist: 0 }, MEAS = new THREE.Box3();
  const nA = o.opps.length;
  // 起跑：你在最後一格，對手照順序排在前面
  const meGrid = P.grid(nA);
  if (drv.teleport) drv.teleport({ x: meGrid.x - pCX, z: meGrid.z, heading: 0 });
  if (drv.setInput) drv.setInput({ throttle: 0, brake: 1, steer: 0, handbrake: 1 });
  if (drv.setDestination) drv.setDestination(null);
  const ais = o.opps.map((od, k) => {
    const car = od.obj.car, p0 = car.position.clone(), r0 = car.rotation.y;
    car.position.set(0, 0, 0); car.rotation.set(0, 0, 0); car.updateMatrixWorld(true); MEAS.setFromObject(car); car.position.copy(p0); car.rotation.y = r0;
    const info = { len: MEAS.max.x - MEAS.min.x, halfW: Math.max(MEAS.max.z, -MEAS.min.z), CX: (MEAS.max.x + MEAS.min.x) / 2 };
    const sk = typeof od.skill === 'object' ? od.skill : SKILL[od.skill] || SKILL.ok, M = carModel(od.perf), g = P.grid(k), pr = CO.project(g.x, g.z);
    if (scene && car.parent !== scene) scene.add(car);
    car.visible = true;
    return { od, name: od.name, car, obj: od.obj, info, sk, M, prof: speedProfile(CO, M, sk), p: pr.s - L, d: pr.d, laneT: pr.d, lane: 0, v: 0, th: 0, x: g.x, z: g.z, dd: 0, roll: 0, brake: false, react: sk.react * (0.8 + Math.random() * 0.4), fin: null, k: 0, best: null, lapT: null, lap0: null };
  });
  const sIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: 0.8 }), Math.max(1, nA));
  sIM.frustumCulled = false; sIM.renderOrder = 1; sIM.name = 'ci-racer-shadows'; if (scene) scene.add(sIM);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const me = { p: -L, d: 0, v: 0, lapsDone: -1, next: NG - 1, hint: -1, px: null, pz: null, fin: null, held: false, name: '你', best: null, lap0: null, laps: [] };
  let hudT = 0, state = 'grid', t = 0, gT = 0, goAt = 4.2 + 0.5 + Math.random() * 1.0, result = null, outT = 0, wrongT = 0, wrongSaid = -9, msg = '', msgT = 0, lightsOn = -1;
  const hud = (() => {
    if (!o.hudParent || typeof document === 'undefined') return null;
    cssOnce();
    const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const root = mk('div', 'cir'), panel = mk('div', 'cir-p'), pos = mk('b'), lap = mk('span'), tm = mk('span'), bst = mk('span'), list = mk('ol'), quit = mk('button', null, '放棄比賽'), lt = mk('div', 'cir-l'), cd = mk('div', 'cir-c'), res = mk('div', 'cir-r');
    for (let q = 0; q < 5; q++) lt.append(mk('i'));
    quit.type = 'button'; quit.addEventListener('click', () => abort('quit'));
    panel.append(pos, lap, tm, bst, list, quit); res.hidden = true; root.append(panel, lt, cd, res); o.hudParent.appendChild(root);
    return { root, panel, pos, lap, tm, bst, list, quit, lt, lamps: [...lt.children], cd, res, last: {} };
  })();
  const setTxt = (k, el, v) => { if (!hud || hud.last[k] === v) return; hud.last[k] = v; el.textContent = v; };
  const say = (s, ms = 1400) => { msg = s; msgT = ms / 1000; };
  function setLamps(k) {
    if (k === lightsOn) return; lightsOn = k;
    P.setLights(Math.max(0, k));
    if (hud) { hud.lamps.forEach((e, q) => e.classList.toggle('on', q < k)); hud.lt.hidden = k < 0; }
  }
  setLamps(0);
  function standings() { const all = [me, ...ais]; return all.slice().sort((a, b) => (a.fin != null && b.fin != null ? a.fin - b.fin : a.fin != null ? -1 : b.fin != null ? 1 : b.p - a.p)); }
  function crossGate(c, x0, z0, x1, z1) {
    const s0 = (x0 - c.x) * c.tx + (z0 - c.z) * c.tz, s1 = (x1 - c.x) * c.tx + (z1 - c.z) * c.tz;
    if (!(s0 < 0 && s1 >= 0)) return false;
    const k = s0 / (s0 - s1), qx = x0 + (x1 - x0) * k, qz = z0 + (z1 - z0) * k;
    return Math.abs(-(qx - c.x) * c.tz + (qz - c.z) * c.tx) <= c.hw;
  }
  function playerTick(dt) {
    const tl = drv.telemetry(), x = tl.x + Math.cos(tl.heading) * pCX, z = tl.z - Math.sin(tl.heading) * pCX;
    me.v = tl.v;
    if (state === 'grid' && Math.abs(tl.v) > 0.2 && drv.setInput) drv.setInput(HOLD); // 還沒熄燈：踩不動（別的地方把煞車放掉了也一樣）
    if (state === 'done' && !me.held && Math.abs(tl.v) < 0.5 && drv.setInput) { me.held = true; drv.setInput(HOLD); }
    if (me.px != null && state === 'run' && me.fin == null) {
      if (crossGate(GATES[me.next], me.px, me.pz, x, z)) {
        if (me.next === NG - 1) {
          me.lapsDone++;
          if (me.lap0 != null) { const lt = t - me.lap0; me.laps.push(lt); if (me.best == null || lt < me.best) me.best = lt; }
          me.lap0 = t;
          if (me.lapsDone >= laps) { me.fin = t; finish(); }
          else { me.next = 0; if (me.lapsDone > 0) say(me.lapsDone === laps - 1 ? '最後一圈！' : `第 ${me.lapsDone + 1} 圈`); }
        } else me.next++;
      }
    }
    me.px = x; me.pz = z;
    const pr = CO.project(x, z, me.hint, PR); me.hint = pr.i;
    const prevS = me.next === 0 ? 0 : GATES[me.next - 1].s, nextS = GATES[me.next].s;
    let s = pr.s; while (s < prevS - L / 2) s += L; while (s > prevS + L / 2) s -= L;
    me.p = me.lapsDone * L + clamp(s, prevS - 5, nextS + 5); me.d = pr.d;
    // 開反了：車頭跟跑道的方向相反、在動
    const fx = Math.cos(tl.heading), fz = -Math.sin(tl.heading), dotT = fx * CO.tx[pr.i] + fz * CO.tz[pr.i];
    if (state === 'run' && me.fin == null && dotT < -0.35 && tl.v > 2 && pr.dist < 30) { wrongT += dt; if (wrongT > 1 && t - wrongSaid > 3) { wrongSaid = t; say('開反了！掉頭', 2000); } } else wrongT = 0;
    // 開出賽車場（聯外道路）＝不比了
    const zn = P.zoneAt(x, z);
    if (state === 'run' && (zn === 'access' || (!zn && !P.inside(x, z)))) { outT += dt; if (outT > 0.6) abort('left'); } else outT = 0;
    return tl;
  }
  // 對手：照跑線（＋換車道）開；速度照 speedProfile；前面有車（你、別的對手）換邊超車或跟著慢下來
  const others = [me, ...ais];
  function aiStep(a, h) {
    const s = ((a.p % L) + L) % L, i = Math.floor(s / CO.ds) % n, j = (i + 1) % n, f = s / CO.ds - Math.floor(s / CO.ds);
    let vt = 0;
    if (state !== 'grid' && t > a.react) vt = a.prof[i] + (a.prof[j] - a.prof[i]) * f; // 你跑完了（done）對手照跑到終點
    if (a.fin != null || state === 'done' && me.fin != null && a.p > laps * L) vt = Math.min(vt, 26);
    if (state === 'run' && me.fin == null && a.fin == null && o.rubber !== false) vt *= 1 + clamp((me.p - a.p) / 400, -0.06, 0.03); // 你落後很多：等你一點；你在前面：追快一點點
    // 跑線＋車道
    const line = CO.line[i] + (CO.line[j] - CO.line[i]) * f;
    let target = clamp(line + a.lane, -HW + 1.3, HW - 1.3);
    let block = null, bgap = 1e9;
    for (const b of others) {
      if (b === a || b.fin != null && b !== me) continue;
      const gap = b.p - a.p; if (gap <= 0 || gap > 30) continue;
      if (Math.abs(b.d - a.d) < 2.7 && gap < bgap) { bgap = gap; block = b; }
    }
    if (block) {
      const faster = vt > (block.v || 0) + 0.5;
      if (faster && bgap < 26) { const side = block.d > 0 ? -1 : 1, want = block.d + side * 3.3; if (Math.abs(want) <= HW - 1.2) a.lane = clamp(want - line, -9, 9); else a.lane = clamp(block.d - side * 3.3 - line, -9, 9); }
      if (bgap < 9) vt = Math.min(vt, Math.max(0, (block.v || 0) - 0.4 + (bgap - 6) * 0.4));
    } else a.lane *= Math.exp(-h * 0.35); // 沒車了慢慢回到跑線
    a.laneT = target;
    const acc = a.M.acc(a.v), brk = a.M.brk(a.v) * a.sk.brk;
    if (vt > a.v) a.v = Math.min(vt, a.v + Math.max(0.3, acc) * h); else a.v = Math.max(vt, a.v - brk * h);
    a.brake = vt < a.v - 0.6 || state === 'grid';
    a.p += a.v * h * (CO.ds / Math.max(0.5, CO.lq[i]));
    const d0 = a.d; a.d += clamp(target - a.d, -2.2 * h, 2.2 * h);
    if (a.pushD) { a.d = clamp(a.d + a.pushD * h, -HW + 1, HW - 1); a.pushD *= Math.exp(-h * 4); if (Math.abs(a.pushD) < 0.05) a.pushD = 0; } // 被你撞到旁邊（慢慢停下來，不會被推出跑道）
    a.dd += ((a.d - d0) / h - a.dd) * (1 - Math.exp(-h * 5));
    const c = CO.at(a.p, TMP);
    a.x = c.x - c.tz * a.d; a.z = c.z + c.tx * a.d; a.k = c.k;
    a.th = Math.atan2(-c.tz, c.tx) - Math.atan2(a.dd, Math.max(6, a.v));
    a.roll += a.v * h;
    if (a.fin == null && a.p >= laps * L) a.fin = t;
    const lapNo = Math.floor(a.p / L); if (lapNo !== a.lapT) { if (a.lapT != null && lapNo > a.lapT && a.lap0 != null && lapNo >= 1) { const lt = t - a.lap0; if (a.best == null || lt < a.best) a.best = lt; } a.lapT = lapNo; if (lapNo >= 0) a.lap0 = t; }
  }
  function aiPose(a, j) {
    a.car.position.set(a.x, 0, a.z); a.car.rotation.set(0, a.th, 0);
    if (a.obj.setRoll) a.obj.setRoll(a.roll);
    if (a.obj.setLook && a.brake !== a.bk0) { a.bk0 = a.brake; a.obj.setLook({ brake: a.brake }); }
    M4.compose(V3.set(a.x, 0.05, a.z), Q.setFromAxisAngle(UP, a.th), S3.set(a.info.len + 0.6, 1, a.info.halfW * 2 + 0.4)); sIM.setMatrixAt(j, M4);
  }
  const HOLD = { throttle: 0, brake: 1, steer: 0, handbrake: 1 }; // 手煞車：停住了只按煞車會換倒車
  const AIC = ais.map(() => ({ t: 'box', x: 0, z: 0, hx: 2, hz: 1, rot: 0, h: 1.6, vx: 0, vz: 0, m: 1, dvx: 0, dvz: 0 }));
  function finish() {
    state = 'done';
    if (drv.setInput) drv.setInput({ throttle: 0, brake: 1, steer: 0 }); // 先煞車（很快的時候拉手煞車會甩尾），停住了再拉手煞車（playerTick）
    const place = 1 + ais.filter((a) => a.fin != null && a.fin < me.fin).length, N = ais.length + 1;
    result = { place, n: N, time: me.fin, best: me.best, laps, won: place === 1 };
    const extra = (o.onFinish && o.onFinish(result)) || {};
    if (hud) {
      const r = hud.res; r.replaceChildren();
      const h = document.createElement('h3'); h.textContent = place === 1 ? '第 1 名！' : `第 ${place} 名`;
      const p1 = document.createElement('p'); p1.textContent = `${o.title ? `對手：${o.title} · ` : ''}你 ${fmtT(me.fin)}${me.best ? `（最快一圈 ${fmtT(me.best)}）` : ''}`;
      r.append(h, p1);
      for (const line of [].concat(extra.lines || [])) { const p = document.createElement('p'); p.className = /獎金/.test(line) ? 'big' : ''; p.textContent = line; r.append(p); }
      const row = document.createElement('div'), again = document.createElement('button'), go = document.createElement('button');
      again.type = go.type = 'button'; again.className = 'b'; go.className = 'a'; again.textContent = '再比一次'; go.textContent = '開走';
      again.addEventListener('click', () => { if (o.onDone) o.onDone({ again: true, result }); });
      go.addEventListener('click', () => { if (o.onDone) o.onDone({ again: false, result }); });
      row.append(again, go); r.append(row); r.hidden = false; hud.panel.hidden = true;
    }
  }
  function abort(why) {
    if (state === 'off' || state === 'done') return;
    state = 'off';
    if (drv.setInput) drv.setInput(null);
    P.setLights(0);
    if (hud) hud.root.hidden = true;
    if (o.onAbort) o.onAbort(why || 'quit');
  }
  function update(dt) {
    if (state === 'off') return;
    dt = Math.min(0.1, Math.max(0, +dt || 0)); if (!dt) return;
    if (state === 'grid') {
      gT += dt;
      const k = gT < 1 ? 0 : Math.min(5, 1 + Math.floor((gT - 1) / 0.8));
      if (gT >= goAt) { state = 'run'; t = 0; setLamps(-1); say('出發！', 900); if (drv.setInput) drv.setInput(null); } else setLamps(k);
    } else t += dt;
    if (msgT > 0) msgT -= dt;
    playerTick(dt);
    const ns = Math.max(1, Math.ceil(dt * 60 - 1e-6)), h = dt / ns;
    ais.forEach((a, j) => { // 你撞到它（drive.js 加在 AIC 的 dvx、dvz）：往前的那份加到它的速度，往旁邊的那份推它換一點車道
      const c = AIC[j]; if (!c.dvx && !c.dvz) return;
      const fx = Math.cos(a.th), fz = -Math.sin(a.th);
      a.v = Math.max(0, a.v + c.dvx * fx + c.dvz * fz); a.pushD = clamp((a.pushD || 0) + c.dvx * -fz + c.dvz * fx, -6, 6); c.dvx = c.dvz = 0;
    });
    for (let q = 0; q < ns; q++) for (const a of ais) aiStep(a, h);
    ais.forEach((a, j) => aiPose(a, j));
    sIM.instanceMatrix.needsUpdate = true;
    // 對手的車是會動的碰撞（撞到會被擋住）
    if (drv.removeColliders) { drv.removeColliders('ciai'); ais.forEach((a, j) => { const c = AIC[j]; c.x = a.x + Math.cos(a.th) * a.info.CX; c.z = a.z - Math.sin(a.th) * a.info.CX; c.hx = a.info.len / 2; c.hz = a.info.halfW; c.rot = a.th; c.vx = Math.cos(a.th) * a.v; c.vz = -Math.sin(a.th) * a.v; }); drv.addColliders(AIC, 'ciai'); } // vx、vz：撞到照兩台車的速度算（追撞不會整台停住）
    if (hud) {
      const big = msgT > 0 ? msg : '';
      if (hud.last.cd !== big) { hud.last.cd = big; hud.cd.textContent = big; hud.cd.className = 'cir-c' + (big === '出發！' ? ' go' : /開反/.test(big) ? ' warn' : ''); hud.cd.hidden = !big; }
      hudT -= dt;
      if (state !== 'done' && hudT <= 0) { // 名次、圈數、時間：一秒五次
        hudT = 0.2;
        const order = standings(), pl = order.indexOf(me) + 1;
        setTxt('pos', hud.pos, `第 ${pl} 名 / ${order.length}`);
        setTxt('lap', hud.lap, `第 ${clamp(me.lapsDone + 1, 1, laps)}/${laps} 圈`);
        setTxt('tm', hud.tm, fmtT(t));
        setTxt('bst', hud.bst, me.best ? `最快 ${fmtT(me.best)}` : '');
        const names = order.map((c) => c.name).join('|');
        if (hud.last.names !== names) { hud.last.names = names; hud.list.replaceChildren(...order.map((c) => { const li = document.createElement('li'); li.textContent = c.name; if (c === me) li.className = 'me'; return li; })); }
      }
    }
  }
  function dispose() {
    if (state !== 'off' && drv.setInput) drv.setInput(null);
    state = 'off';
    P.setLights(0);
    if (drv.removeColliders) drv.removeColliders('ciai');
    sIM.removeFromParent(); sIM.geometry.dispose(); sIM.material.dispose(); sIM.dispose();
    if (hud) hud.root.remove();
  }
  update(1e-6);
  return { update, abort, dispose, standings: () => standings().map((c) => ({ name: c.name, p: c.p, fin: c.fin, me: c === me })), get state() { return state; }, get time() { return t; }, laps, ais, me, get result() { return result; }, drive: drv, get lights() { return lightsOn; }, colliders: AIC };
}

return { buildCircuit, circuitFonts, CIRCUIT_TEXT, CIRCUIT_KEEP, createCircuitRace, CIRCUIT_SKILL: SKILL, circuitCourse: makeCourse, circuitCSS: cssOnce, circuitFmt: fmtT, circuitCar: carModel, circuitProfile: speedProfile };
})();
