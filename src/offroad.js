// ---- 越野車場（第 4 批）：賽道南邊的越野公園：起伏的泥土地、跳台、泥巴池、攀岩區、沙丘、泥土賽道（起終點、檢查點）、越野車行、停車場 ----
// Nick 2026-09-28 05:37「還有越野車場可以買越野車去開比賽」、07:34「越野車很多台一樣可以買回車庫可自訂外觀 改引擎」
// 位置：直線加速賽道南邊的草地（圍籬圍起來：x −50…518、z 76…196），從村子自己開過去：
//   大路 E1 路口（x −112，賽道入口西邊）轉進水泥農路往南 → 農路轉彎的地方直直往南（新的水泥路，穿過村子南邊的樹、邊界）→ 往東到越野車場的大門（x −50、z 106）
//   村子本來的路、房子、門都沒有動；村子只改兩個地方（village.js 裡「第 4 批」那兩行）：南邊邊界的碰撞開一個口、路上那兩棵樹不種
// 世界座標跟 village.js、drive.js 一樣：x 往東、y 往上、z 往南；heading＝rotation.y（0 朝東、π/2 朝北）
// 【API】
//   await offroadFonts();                     招牌的中文字（跟 villageFonts 一起等）
//   const P = buildOffroad(V, { renderer });  V＝buildVillage() 回傳的；越野車場加進 V（V.group、V.places、V.colliders、V.roads、V.info.offroad）
//     V 多了：heightAt(x, z)（地面高度，跟畫出來的三角形一模一樣）、normalAt(x, z) → [nx, ny, nz]、terrainAt(x, z)（在越野車場的格子裡）、
//             mapDraw(g)（小地圖）、offroad（＝P）
//     V.surfaceAt、V.route 包一層：越野車場、新的水泥路照這裡算；村子裡完全照舊（同一個函式、同樣的答案）
//     V.bounds.x1 改成 380（小地圖畫到越野車場東邊）
//   V.places.offroad：越野車場（大門裡面的空地）{ name, pos, spawn, zone, gate }
//   V.places.odealer：越野車行 { name, pos, display（展示台：[0] 門口的大圓台（怪獸卡車放得下）、[1] [2] 車行裡面）, bay（買車區）, park, exit, spawn, zone, view }
//   V.places.orace：越野賽起跑區 { name, pos, zone, start（停好等比賽的位置）, grid（四個起跑位置）, spawn }
//   P.show（第 7 批：輾扁）：表演場 { x0, x1, z0, z1, cx, cz, ramp: [上坡起點, 坡頂, 外緣, 多高], cars: [[x, z, heading] × 5] }：
//     車行南邊的碎石平地（x 12…44、z 117…131）：一個 1.5 公尺高的土坡＋一排五台舊車的位置；舊車（輕量車）跟輾扁都是 crush.js 做的
//   路面（surfaceAt）：1 草地、3 碎石路／停車場、5 泥土路（賽道、小路）、6 泥巴、7 沙、8 石頭（terrain.js 照車種算限速、抓地）
//   P.course：賽道中線（一圈約 950 公尺、順時針、兩個右轉髮夾彎；s＝0 在起終點）
//     { len, n, ds, x, z, tx, tz, k（曲率，左轉 +）, bm（髮夾彎的外側斜坡 0–1）, mud, at(s) → { x, z, tx, tz, k }, project(x, z, hint) → { s, d（往右 +）, i } }
//   P.checkpoints：[{ s, x, z, tx, tz }] × 6（5 個檢查點＋最後一個＝起終點）；P.grid：四個起跑位置
//   P.fenceDist(x, z)：離圍籬多遠（裡面 +）；P.info：{ meshes, tris, terrainTris, ms（蓋了幾毫秒） }；P.dispose()（V.dispose() 也會叫）
//   createOffroadRace({ world: V, scene, drive, level, hudParent, createRide, onFinish, onDone, onAbort, calm })
//     level：OFFROAD_RACES 第幾場；drive：開車的（createDrive 回傳的，車子已經停在 grid[0]）；createRide：terrain.js 的（對手的車上下跳）
//     onFinish(result) → { lines: [多顯示的字] }（獎金、新的比賽：車庫頁的錢由呼叫的人加）；onDone({ again })：按「再比一次」／「開走」；onAbort(why)
//     → { update(dt)（drive.update 之後叫）, abort(why), dispose(), standings(), state（'count' | 'run' | 'done' | 'off'）, def }
//     result：{ id, name, place（第幾名）, n（幾台車）, time（秒）, won, prize（贏了的獎金，萬）, laps }
//   OFFROAD_RACES：三場 { id, name, laps, prize（萬）, opps: [{ name, style, color, skill }] }（贏了前一場才開下一場：呼叫的人照 GAME.wins 判斷）
//   makeOffroadRacer(style, color)：對手的車（buggy 沙灘車、truck 越野卡車、rally 拉力車）{ car, body, wheels（輪子的上一層＝hub）, spec, info, dispose }
//   OFFROAD_SOUND.monster：怪獸卡車的引擎聲設定（接到 createEngineAudio.cars.monster）；OFFROAD_EYE.monster：駕駛座視角（車子中間那張椅子）
// 效能：地形 3 塊（每塊一個 draw call，同一張 2048×448 的地面貼圖）、東西照材質、300 公尺一格合併；對手的車一台一個 draw call、輪子全部一個
// 地面：大貼圖（顏色、粗糙度）＋一張 256×256 的灰階細節貼圖（每 3.2 公尺重複一次：土粒、草的紋路），近看不會糊成一片
// 跟外面接起來：村子的草地到 x −62 為止、越野車場的格子從 x −52.5 起：中間鋪一條「接縫草地」（or-apron，村子草地的材質），不會露出賽道那層比較暗的草地
//   賽道（race.src.js 的 buildTrack）南邊的兩座遠山本來會蓋到越野車場：第 4 批把它們往南移（race.src.js 那一行，見 port-b4.mjs）
import * as THREE from 'three';

// 打包（build-art.mjs、build-app.mjs）：跟 village.js 一樣整個包在一個函式裡，只露出下面這些名字
export const { buildOffroad, offroadFonts, OFFROAD_TEXT, OFFROAD_RACES, OFFROAD_SOUND, OFFROAD_EYE, createOffroadRace, makeOffroadRacer } = (() => {
const TAU = Math.PI * 2;
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", "WenQuanYi Zen Hei", sans-serif';
const COND = '"Barlow Condensed", "Arial Narrow", sans-serif';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (e0, e1, v) => { const t = clamp((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const wrapA = (a) => { a = (a + Math.PI) % TAU; return a < 0 ? a + Math.PI : a - Math.PI; };
function rng(seed) { // 固定種子的亂數（每次蓋出來都一樣）
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash2 = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul((b | 0) + 7, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const CC = new Map();
const C = (hex) => { let v = CC.get(hex); if (!v) { const c = new THREE.Color(hex); v = [c.r, c.g, c.b]; CC.set(hex, v); } return v; }; // 線性顏色
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function segD(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1; let t = ((px - ax) * dx + (pz - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const ex = ax + dx * t - px, ez = az + dz * t - pz; return Math.sqrt(ex * ex + ez * ez); }
const plen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
function roundPoly(pts, r, n = 6) { // 轉角改成圓弧（二次貝茲，跟 village.js 一樣）
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
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function fitFont(g, text, maxW, px, fam = SANS) { let s = px; for (; s > 8; s -= 2) { g.font = `700 ${s}px ${fam}`; if (g.measureText(text).width <= maxW) break; } return s; }

// ---- 三場比賽、怪獸卡車的引擎聲、駕駛座 ----
const OFFROAD_RACES = [
  { id: 'mud1', name: '泥巴新手賽', laps: 2, prize: 20, opps: [{ name: '泥巴阿弟', style: 'buggy', color: '#2f9e44', skill: 0.72 }] },
  { id: 'mud2', name: '越野挑戰賽', laps: 2, prize: 80, opps: [{ name: '山豬哥', style: 'truck', color: '#1d4fd8', skill: 0.88 }, { name: '沙地小旋風', style: 'buggy', color: '#f3c316', skill: 0.87 }] },
  { id: 'mud3', name: '越野冠軍賽', laps: 3, prize: 300, opps: [{ name: '越野隊長', style: 'truck', color: '#e0251b', skill: 0.99 }, { name: '泥巴女王', style: 'rally', color: '#6b2fc0', skill: 0.97 }, { name: '鐵牛阿伯', style: 'truck', color: '#ff6a13', skill: 0.95 }] },
];
// 怪獸卡車：機械增壓 V8（燒甲醇），交叉平面曲軸（兩邊排氣輪流不平均：咕嚕咕嚕）、短短的直排頭段、增壓器的嗚嗚聲（sc）
const OFFROAD_SOUND = {
  monster: {
    name: '機械增壓 V8（甲醇）', red: 6800, idle: 0.13, gain: 1.02, idleGain: 1.7,
    fire: [0, 90, 180, 270, 360, 450, 540, 630], bank: [0, 1, 1, 0, 1, 0, 0, 1], cylAmp: [1, 0.97, 1.02, 0.98, 1, 0.96, 1.03, 0.99],
    width: 150, rise: 0.08, decay: 0.75, vari: 0.08, jit: 1.1, wob: 0.02,
    grp: [{ ms: 2.6, fb: -0.45, lp: 2600, gain: 1 }, { ms: 2.9, fb: -0.45, lp: 2400, gain: 0.9 }],
    pipe: [{ ms: 4.2, fb: -0.3, lp: 2400 }, { ms: 2.8, fb: -0.25, lp: 3000 }],
    lp: 2600, eq: [[90, 1, 6], [320, 1.2, 4], [1200, 1.8, 2]], hp: 60, drive: 2.0, rasp: 0.5, raspHz: 1800,
    intake: { lvl: 0.25, f: 380, q: 1.3, f2: 1200, mix2: 0.5, tone: 0.45, hiss: 0.1 },
    sc: { order: 16, lvl: 0.18 },
    pops: { lift: 0.5, shift: 0.4, lvl: 1.1, rate: 7, dur: 0.9, crack: 0.3, burp: 0.9 },
    cut: 0.1,
  },
};
const OFFROAD_EYE = { monster: { eye: [0.1, 2.8, 0], look: [9, 2.3, 0], fov: 72 } }; // 車子中間那張椅子（高高的）

// ---- 場地（常數）----
// 地形的格子：2.5 公尺一格（跳台、攀岩區另外細分成 0.625 公尺）；x −52.5…520、z 74…199
const G = { x0: -52.5, z0: 74, s: 2.5, nx: 229, nz: 50 }; G.x1 = G.x0 + G.nx * G.s; G.z1 = G.z0 + G.nz * G.s;
// 圍籬（順時針）：西邊 x = −50（大門 z 100–112）、北邊 z = 76、東邊 x = 518、南邊照著賽道的山腳彎彎的
const FENCE = [[-50, 76], [518, 76], [518, 142.9], [500, 156], [480, 172], [455, 196], [300, 196], [275, 182], [240, 166], [200, 160], [160, 168], [130, 180], [100, 196], [-50, 196]];
const GATE = { x: -50, z: 106, z0: 99.4, z1: 112.6 };
// 從村子來的水泥路：農路（x −112）轉彎的地方直直往南，再往東到大門（半徑 12 的彎）
const ACCESS = roundPoly([[-112, 44], [-112, 106], [-48, 106]], 12, 8);
// 賽道（順時針、兩個右轉髮夾彎）：控制點（向心 Catmull-Rom），起終點在 (150, 90) 朝東
const CP = [[150, 90], [200, 90], [250, 90], [300, 90], [350, 90], [400, 90], [436, 91], [462, 95], [481, 106], [489, 122], [484, 139], [468, 149], [446, 153], [420, 153], [392, 148], [362, 139], [332, 135], [302, 137],
  [272, 140], [242, 139], [212, 135], [182, 135], [152, 137], [124, 140], [98, 137], [78, 128], [66, 114], [66, 100], [76, 92], [100, 90], [125, 90]];
const HW = 7; // 賽道半寬（泥土路 14 公尺）
const PIT = { x: 424, z: 177, rx: 24, rz: 11 }; // 泥巴池（橢圓）
const ROCK = { x0: 319, x1: 378.5, z0: 161, z1: 192 }; // 攀岩區（一顆一顆的大石頭）
const SAND = { x0: -48, x1: 44, z0: 135, z1: 197 }; // 沙丘
const DUNES = [[-30, 150, 10, 7, 2.2, 0.3], [-6, 158, 11, 8, 2.6, -0.2], [18, 150, 8, 6, 1.8, 0.5], [-24, 178, 10, 8, 2.4, 0.1], [6, 184, 11, 7, 2.0, -0.4], [30, 172, 8, 7, 1.6, 0.2], [-38, 190, 6, 5, 1.2, 0]];
const RIDGE = { x: 230, z: 112, rx: 25, rz: 9, h: 3.5 }; // 賽道中間的小山
const TRAIL = [[18, 132], [5, 150], [-18, 164], [-30, 182], [-8, 190], [22, 184], [34, 162], [30, 142], [18, 132]]; // 沙丘裡的小路（一圈）
// 細分的長方形（邊對齊 2.5 公尺的格子；邊上照大格子內插，接縫不會裂開）
const FINE = [[172.5, 227.5, 79, 101.5], [257.5, 305, 79, 101.5], [345, 365, 79, 101.5], [232.5, 267.5, 126.5, 151.5], [317.5, 380, 159, 194], [15, 27.5, 116.5, 131.5]].map(([x0, x1, z0, z1]) => ({ x0, x1, z0, z1, n: 4 }));
// 平地（車行、停車場、大門、起跑區）：1＝完全平
const flatMask = (x, z) => Math.max(ss(64, 48, x) * ss(144, 132, z), ss(88, 100, x) * ss(172, 160, x) * ss(124, 112, z));
// 碎石地（車行、停車場、路）
const GRAVEL_R = [[-52.5, 101.5, -2, 110.5], [-45, 110.5, -7, 129], [-20, 77, 20, 97], [21, 97.5, 43, 114.5], [118, 99, 170, 112], [12, 117, 44, 131]]; // 最後一塊＝第 7 批的表演場
const GRAVEL_P = [[[-5, 106], [46, 106]]];
// 車行到起跑區的泥土路：往東穿過賽道西邊的髮夾彎（彎道頂點那裡外側的土堤留一個口）、內場，接到北邊直線
const PADDOCK_P = [[46, 106], [56, 106], [65, 106], [76, 105], [88, 101], [104, 94], [118, 91]];
const GAP = { x1: 78, z: 106 }; // 土堤的口：x < 78、z 106 前後
const gapK = (x, z) => (x < GAP.x1 ? ss(5, 9, Math.abs(z - GAP.z)) : 1); // 0＝口的中間（沒有土堤）
const PODIUM = { x: -33, z: 90, r: 5, h: 0.6 };
// ---- 第 7 批（輾扁）：表演場（怪獸卡車的表演：一個土坡＋一排舊的垃圾車，輾爆好玩的，不會報警）----
//   車行南邊的平地（x 12…44、z 117…131：樹、石頭本來就不種這裡）；碎石地（跟停車場一樣）
const SHOW = { x0: 12, x1: 44, z0: 117, z1: 131, z: 124, w: 7, rx0: 15.4, rtop: 24, rx1: 26.2, h: 1.5 }; // 土坡：x 15.4 上去、24 坡頂、26.2 外緣；z 124 中間、寬 7
const SHOW_CARS = [[27.2, 124, Math.PI / 2], [29.3, 124, Math.PI / 2], [31.4, 124, Math.PI / 2], [33.5, 124, Math.PI / 2], [35.6, 124, Math.PI / 2]]; // 一排五台（車頭朝北，怪獸卡車從西邊衝過來一台一台壓過去）
function showH(x, z) { // 土坡（側面也斜下去，從旁邊也開得上去）
  if (x < SHOW.rx0 - 0.6 || x > SHOW.rx1 || Math.abs(z - SHOW.z) > SHOW.w / 2 + 1.4) return 0;
  const side = 1 - ss(SHOW.w / 2 - 0.6, SHOW.w / 2 + 1.4, Math.abs(z - SHOW.z));
  const up = x < SHOW.rtop ? ss(SHOW.rx0, SHOW.rtop, x) : 1 - ss(SHOW.rtop + 0.6, SHOW.rx1, x);
  return SHOW.h * up * side;
}
// 越野車場裡的路線（大門 → 車行前面 → 買車區的車棚（路從車棚下面穿過去）→ 起跑區）
const PN = { GATE: [-48, 106], OFF: [-36, 106], HUB: [-5, 106], BAY: [32, 106], EXIT: [46, 106], PASS: [65, 106], IN: [84, 103], CJ: [104, 94], RACE: [134, 90] };
const PE = [['GATE', 'OFF'], ['OFF', 'HUB'], ['HUB', 'BAY'], ['BAY', 'EXIT'], ['EXIT', 'PASS'], ['PASS', 'IN'], ['IN', 'CJ'], ['CJ', 'RACE']];
const PDEST = { offroad: 'OFF', odealer: 'BAY', orace: 'RACE' };
const GRID = [[140, 93], [140, 87], [131, 87], [131, 93]]; // 起跑位置（你在第一個）

// 攀岩區的石頭（固定種子）：{ x, z, r, h, e（長寬比）, c, s（方向）}
const ROCKS = (() => {
  const R = rng(4404), out = [];
  for (let x = ROCK.x0 + 1.6; x < ROCK.x1 - 1; x += 3.2) for (let z = ROCK.z0 + 1.6; z < ROCK.z1 - 1; z += 3.2) {
    if (R() < 0.34) continue;
    const a = R() * Math.PI;
    out.push({ x: x + (R() - 0.5) * 1.6, z: z + (R() - 0.5) * 1.6, r: 0.9 + R() * 0.9, h: 0.35 + R() * 0.6, e: 0.7 + R() * 0.4, c: Math.cos(a), s: Math.sin(a) });
  }
  return out;
})();

// ---- 高度（蓋的時候算每個頂點；開車的時候查三角形）----
function fenceDist(x, z) { // 離圍籬多遠（裡面 +、外面 −）
  let d = Infinity, inside = false;
  for (let i = 0, n = FENCE.length, j = n - 1; i < n; j = i++) {
    const ax = FENCE[j][0], az = FENCE[j][1], bx = FENCE[i][0], bz = FENCE[i][1];
    if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    const e = segD(x, z, ax, az, bx, bz); if (e < d) d = e;
  }
  return inside ? d : -d;
}
const hBase = (x, z) => Math.max(0, 1.3 + 0.9 * Math.sin(0.071 * x + 0.8) * Math.sin(0.093 * z + 1.9) + 0.7 * Math.sin(0.031 * x - 0.052 * z + 2.6) + 0.45 * Math.sin(0.12 * x + 0.083 * z + 0.4) + 0.25 * Math.sin(0.21 * x - 0.17 * z + 1.1));
function duneH(x, z) {
  let s = 0;
  for (const [cx, cz, rx, rz, h, a] of DUNES) {
    const c = Math.cos(a), n = Math.sin(a), dx = x - cx, dz = z - cz, u = (dx * c + dz * n) / rx, v = (-dx * n + dz * c) / rz, q = u * u + v * v;
    if (q < 1) s += h * (0.5 + 0.5 * Math.cos(Math.PI * Math.sqrt(q)));
  }
  return s;
}
function hTerrain(x, z) { // 賽道以外的地：起伏（圍籬邊、平地慢慢變平）＋沙丘＋中間的小山
  const fd = fenceDist(x, z); if (fd <= 0) return 0;
  const fl = flatMask(x, z);
  let h = hBase(x, z) * ss(0, 14, fd) * ss(76, 106, z) * (1 - fl);
  if (x > SAND.x0 - 12 && x < SAND.x1 + 12 && z > SAND.z0 - 12) h += duneH(x, z) * ss(0, 8, fd) * (1 - fl);
  const u = (x - RIDGE.x) / RIDGE.rx, v = (z - RIDGE.z) / RIDGE.rz, q = u * u + v * v;
  if (q < 1) h += RIDGE.h * (0.5 + 0.5 * Math.cos(Math.PI * Math.sqrt(q)));
  h += showH(x, z); // 第 7 批：表演場的土坡
  return h;
}
function pitH(x, z, h) { // 泥巴池：底下的地至少墊到 0.75，中間挖 0.6、外圈一圈土堤
  const q = Math.hypot((x - PIT.x) / PIT.rx, (z - PIT.z) / PIT.rz); if (q > 1.6) return h;
  const base = h + (Math.max(h, 0.75) - h) * (1 - ss(1.2, 1.6, q));
  return base - 0.6 * (1 - ss(0.5, 1.0, q)) + 0.35 * Math.exp(-(((q - 1.08) / 0.1) ** 2));
}
function rockH(x, z) { // 攀岩區：重疊的石頭取最高的
  let m = 0;
  for (const R of ROCKS) {
    const dx = x - R.x, dz = z - R.z; if (dx * dx + dz * dz > R.r * R.r) continue;
    const u = (dx * R.c + dz * R.s) / R.r, v = (-dx * R.s + dz * R.c) / (R.r * R.e), q = u * u + v * v;
    if (q < 1) m = Math.max(m, R.h * Math.pow(1 - q, 0.55));
  }
  return m;
}
const lift = (x, z) => -0.04 + 0.1 * ss(0, 3, Math.min(x - G.x0, G.x1 - x, z - G.z0, G.z1 - z)); // 格子邊上沉到草地下面、裡面比草地高 8 公分（遠遠看不會閃）
// 賽道上的東西（照 x：北邊直線往東開、南邊往西開）
function featN(x) {
  let h = 0;
  if (x > 175 && x < 225) h += 0.32 * (0.5 - 0.5 * Math.cos((TAU * (x - 175)) / 5)) * ss(175, 178, x) * ss(225, 222, x); // 搓衣板（一連串小土包）
  if (x > 262 && x < 303) h += x < 273 ? 1.6 * Math.pow((x - 262) / 11, 1.6) : x < 285 ? 1.6 : 1.6 * (1 - ss(285, 303, x)); // 平台跳台：上坡（跳台口 13°）、平台、下坡落地
  if (x > 324 && x < 380) h += 1.5 * (0.5 + 0.5 * Math.cos((Math.PI * (x - 352)) / 28)); // 小山丘
  if (x > 349 && x < 358) h += x < 355 ? 0.8 * Math.pow((x - 349) / 6, 1.6) : 0.8 * (1 - ss(355, 357.8, x)); // 山丘頂上的小跳台（12°）
  return h;
}
function featS(x) {
  let h = 0;
  if (x > 398 && x < 424) h -= 0.35 * Math.pow(Math.sin((Math.PI * (x - 398)) / 26), 2); // 泥巴水坑
  if (x > 236 && x < 262) h += x > 256 ? 1.2 * Math.pow((262 - x) / 6, 1.2) : x > 246 ? 1.2 : 1.2 * (1 - ss(246, 236, x)); // 上台階（往西開：衝上去、平台、下坡）
  return h;
}

// ---- 賽道中線 ----
function makeCourse() {
  const n0 = CP.length, D = [];
  for (let i = 0; i < n0; i++) { // 向心 Catmull-Rom
    const p0 = CP[(i + n0 - 1) % n0], p1 = CP[i], p2 = CP[(i + 1) % n0], p3 = CP[(i + 2) % n0];
    const t1 = Math.sqrt(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])), t2 = t1 + Math.sqrt(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])), t3 = t2 + Math.sqrt(Math.hypot(p3[0] - p2[0], p3[1] - p2[1]));
    const m = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.5));
    for (let k = 0; k < m; k++) {
      const t = t1 + ((t2 - t1) * k) / m, pt = [0, 1].map((c) => {
        const A1 = ((t1 - t) * p0[c] + t * p1[c]) / t1, A2 = ((t2 - t) * p1[c] + (t - t1) * p2[c]) / (t2 - t1), A3 = ((t3 - t) * p2[c] + (t - t2) * p3[c]) / (t3 - t2);
        const B1 = ((t2 - t) * A1 + t * A2) / t2, B2 = ((t3 - t) * A2 + (t - t1) * A3) / (t3 - t1);
        return ((t2 - t) * B1 + (t - t1) * B2) / (t2 - t1);
      });
      D.push(pt);
    }
  }
  const nd = D.length, Lc = new Float64Array(nd + 1);
  for (let i = 0; i < nd; i++) { const j = (i + 1) % nd; Lc[i + 1] = Lc[i] + Math.hypot(D[j][0] - D[i][0], D[j][1] - D[i][1]); }
  const len = Lc[nd];
  let s0 = 0, best = Infinity; // 起終點：(150, 90) 投影到中線
  for (let i = 0; i < nd; i++) {
    const j = (i + 1) % nd, ax = D[i][0], az = D[i][1], dx = D[j][0] - ax, dz = D[j][1] - az, l2 = dx * dx + dz * dz, t = clamp(((150 - ax) * dx + (90 - az) * dz) / l2, 0, 1);
    const e = Math.hypot(ax + dx * t - 150, az + dz * t - 90); if (e < best) { best = e; s0 = Lc[i] + Math.sqrt(l2) * t; }
  }
  const n = Math.round(len), ds = len / n;
  const X = new Float64Array(n), Z = new Float64Array(n), TX = new Float64Array(n), TZ = new Float64Array(n), K = new Float64Array(n);
  let seg = 0;
  for (let i = 0; i < n; i++) {
    let s = s0 + i * ds; if (s >= len) s -= len;
    if (s < Lc[seg]) seg = 0;
    while (seg < nd - 1 && Lc[seg + 1] <= s) seg++;
    const j = (seg + 1) % nd, t = (s - Lc[seg]) / (Lc[seg + 1] - Lc[seg] || 1);
    X[i] = D[seg][0] + (D[j][0] - D[seg][0]) * t; Z[i] = D[seg][1] + (D[j][1] - D[seg][1]) * t;
  }
  for (let i = 0; i < n; i++) { const a = (i + n - 1) % n, b = (i + 1) % n, tx = X[b] - X[a], tz = Z[b] - Z[a], l = Math.hypot(tx, tz) || 1; TX[i] = tx / l; TZ[i] = tz / l; }
  for (let i = 0; i < n; i++) { const a = (i + n - 1) % n, b = (i + 1) % n; K[i] = wrapA(Math.atan2(-TZ[b], TX[b]) - Math.atan2(-TZ[a], TX[a])) / (2 * ds); }
  const KS = new Float64Array(n); // 曲率：前後 5 公尺平均
  for (let i = 0; i < n; i++) { let s = 0; for (let k = -5; k <= 5; k++) s += K[(i + k + n) % n]; KS[i] = s / 11; }
  // 找最近的點：12 公尺一格的桶子
  const HB = { x0: G.x0 - 30, z0: G.z0 - 30, s: 12 }; HB.nx = Math.ceil((G.x1 - G.x0 + 60) / HB.s); HB.nz = Math.ceil((G.z1 - G.z0 + 60) / HB.s);
  const bucket = Array.from({ length: HB.nx * HB.nz }, () => []);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, bx0 = Math.floor((Math.min(X[i], X[j]) - HB.x0) / HB.s), bx1 = Math.floor((Math.max(X[i], X[j]) - HB.x0) / HB.s);
    const bz0 = Math.floor((Math.min(Z[i], Z[j]) - HB.z0) / HB.s), bz1 = Math.floor((Math.max(Z[i], Z[j]) - HB.z0) / HB.s);
    for (let bx = bx0; bx <= bx1; bx++) for (let bz = bz0; bz <= bz1; bz++) if (bx >= 0 && bz >= 0 && bx < HB.nx && bz < HB.nz) bucket[bz * HB.nx + bx].push(i);
  }
  const B2 = bucket.map((l) => Int32Array.from(l));
  let pb = Infinity, pi = -1, pt = 0;
  const test = (i, x, z) => {
    const j = i + 1 === n ? 0 : i + 1, ax = X[i], az = Z[i], dx = X[j] - ax, dz = Z[j] - az, l2 = dx * dx + dz * dz;
    let t = ((x - ax) * dx + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = ax + dx * t - x, ez = az + dz * t - z, e = ex * ex + ez * ez;
    if (e < pb) { pb = e; pi = i; pt = t; }
  };
  const result = (x, z, out) => {
    const j = pi + 1 === n ? 0 : pi + 1, dx = X[j] - X[pi], dz = Z[j] - Z[pi], l = Math.hypot(dx, dz) || 1, qx = X[pi] + dx * pt, qz = Z[pi] + dz * pt;
    out.s = (pi + pt) * ds; out.d = (dx / l) * (z - qz) - (dz / l) * (x - qx); out.i = pi; out.t = pt; out.dist = Math.sqrt(pb);
    return out;
  };
  // near：蓋地形用（只找附近 12 公尺的桶子，找不到回 null）；project：開車用（hint＝上次的 i：先找前後 60 公尺，太遠才全部找）
  const NR = { s: 0, d: 0, i: 0, t: 0, dist: 0 };
  function near(x, z) {
    const bx = Math.floor((x - HB.x0) / HB.s), bz = Math.floor((z - HB.z0) / HB.s); pb = Infinity; pi = -1;
    for (let a = bz - 1; a <= bz + 1; a++) for (let b = bx - 1; b <= bx + 1; b++) { if (a < 0 || b < 0 || a >= HB.nz || b >= HB.nx) continue; const L = B2[a * HB.nx + b]; for (let k = 0; k < L.length; k++) test(L[k], x, z); }
    return pi < 0 ? null : result(x, z, NR);
  }
  function project(x, z, hint = -1) {
    pb = Infinity; pi = -1;
    if (hint >= 0) { for (let k = -60; k <= 60; k++) test((hint + k + n) % n, x, z); if (pb < 900) return result(x, z, {}); pb = Infinity; pi = -1; }
    const r = near(x, z); if (r && r.dist < 12) return { ...r };
    pb = Infinity; pi = -1; for (let i = 0; i < n; i++) test(i, x, z);
    return result(x, z, {});
  }
  function at(s, out = {}) {
    s = ((s % len) + len) % len; const f = s / ds, i = Math.floor(f) % n, j = (i + 1) % n, t = f - Math.floor(f);
    out.x = X[i] + (X[j] - X[i]) * t; out.z = Z[i] + (Z[j] - Z[i]) * t;
    const tx = TX[i] + (TX[j] - TX[i]) * t, tz = TZ[i] + (TZ[j] - TZ[i]) * t, l = Math.hypot(tx, tz) || 1;
    out.tx = tx / l; out.tz = tz / l; out.k = KS[i] + (KS[j] - KS[i]) * t; out.i = i;
    return out;
  }
  // 每一點：哪一段（1 北邊直線、2 南邊）、地形高度（前後各 15 公尺平均兩次）、跳台、髮夾彎外側的斜坡、泥巴水坑
  const LEG = new Uint8Array(n), P0 = new Float64Array(n), FC = new Float64Array(n), BM = new Float64Array(n), MUD = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    LEG[i] = Z[i] < 112 && X[i] > 140 && X[i] < 440 ? 1 : Z[i] > 120 && X[i] > 95 && X[i] < 452 ? 2 : 0;
    P0[i] = hTerrain(X[i], Z[i]);
    FC[i] = LEG[i] === 1 ? featN(X[i]) : LEG[i] === 2 ? featS(X[i]) : 0;
    BM[i] = ss(0.012, 0.03, Math.abs(KS[i]));
    MUD[i] = LEG[i] === 2 && X[i] >= 400 && X[i] <= 422 ? 1 : 0;
  }
  const tmp = new Float64Array(n);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) { let s = 0; for (let k = -15; k <= 15; k++) s += P0[(i + k + n) % n]; tmp[i] = s / 31; }
    P0.set(tmp);
  }
  for (let i = 0; i < n; i++) P0[i] *= 1 - flatMask(X[i], Z[i]);
  return { len, n, ds, x: X, z: Z, tx: TX, tz: TZ, k: KS, leg: LEG, p0: P0, fc: FC, bm: BM, mud: MUD, near, project, at };
}

// ---- 蓋 ----
function buildOffroad(V, opts = {}) {
  const T0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const aniso = opts.renderer ? Math.min(8, opts.renderer.capabilities.getMaxAnisotropy()) : 4;
  const CR = makeCourse(), cn = CR.n;
  // 1) 每個頂點的高度（賽道跟地形接起來、泥巴池、石頭）
  const hAt = (x, z) => {
    let h = hTerrain(x, z);
    const pr = CR.near(x, z);
    if (pr && Math.abs(pr.d) < 11.5) {
      const i = pr.i, j = i + 1 === cn ? 0 : i + 1, t = pr.t, ad = Math.abs(pr.d);
      const hc = lerp(CR.p0[i], CR.p0[j], t) + lerp(CR.fc[i], CR.fc[j], t) * (1 - ss(5.8, 7.6, ad)) + (pr.d < 0 ? 1.4 * lerp(CR.bm[i], CR.bm[j], t) * ss(1.0, 6.5, -pr.d) * gapK(x, z) : 0);
      h += (hc - h) * (1 - ss(6.5, 11, ad));
    }
    h = pitH(x, z, h);
    if (x > ROCK.x0 - 2 && x < ROCK.x1 + 2 && z > ROCK.z0 - 2 && z < ROCK.z1 + 2) h += rockH(x, z);
    return Math.max(0, h) + lift(x, z);
  };
  const W1 = G.nx + 1, HC = new Float32Array(W1 * (G.nz + 1));
  for (let j = 0; j <= G.nz; j++) for (let k = 0; k <= G.nx; k++) HC[j * W1 + k] = hAt(G.x0 + k * G.s, G.z0 + j * G.s);
  const FI = new Int8Array(G.nx * G.nz).fill(-1);
  const RECTS = FINE.map((f, ri) => {
    const k0 = Math.round((f.x0 - G.x0) / G.s), k1 = Math.round((f.x1 - G.x0) / G.s), j0 = Math.round((f.z0 - G.z0) / G.s), j1 = Math.round((f.z1 - G.z0) / G.s), n = f.n;
    const fnx = (k1 - k0) * n, fnz = (j1 - j0) * n, FW = fnx + 1, H = new Float32Array(FW * (fnz + 1)), fs = G.s / n;
    for (let b = 0; b <= fnz; b++) for (let a = 0; a <= fnx; a++) {
      let h;
      if (a === 0 || a === fnx) { const k = k0 + a / n, jb = Math.min(Math.floor(b / n), j1 - j0 - 1), t = (b - jb * n) / n; h = lerp(HC[(j0 + jb) * W1 + k], HC[(j0 + jb + 1) * W1 + k], t); } // 左右兩邊：照大格子內插
      else if (b === 0 || b === fnz) { const j = j0 + b / n, kb = Math.min(Math.floor(a / n), k1 - k0 - 1), t = (a - kb * n) / n; h = lerp(HC[j * W1 + k0 + kb], HC[j * W1 + k0 + kb + 1], t); } // 上下兩邊
      else h = hAt(G.x0 + k0 * G.s + a * fs, G.z0 + j0 * G.s + b * fs);
      H[b * FW + a] = h;
    }
    for (let j = j0; j < j1; j++) for (let k = k0; k < k1; k++) FI[j * G.nx + k] = ri;
    return { k0, k1, j0, j1, n, fnx, fnz, FW, H, fs, x0: G.x0 + k0 * G.s, z0: G.z0 + j0 * G.s };
  });
  // 查高度：找到那一格、那個三角形（對角線 00–11），跟畫出來的一模一樣
  const tri = (A, W, k, j, u, v) => { const i = j * W + k, h00 = A[i], h10 = A[i + 1], h01 = A[i + W], h11 = A[i + W + 1]; return u >= v ? h00 + u * (h10 - h00) + v * (h11 - h10) : h00 + u * (h11 - h01) + v * (h01 - h00); };
  function heightAt(x, z) {
    const fx = (x - G.x0) / G.s, fz = (z - G.z0) / G.s;
    if (!(fx >= 0 && fz >= 0 && fx < G.nx && fz < G.nz)) return 0;
    const k = fx | 0, j = fz | 0, ri = FI[j * G.nx + k];
    if (ri < 0) return tri(HC, W1, k, j, fx - k, fz - j);
    const r = RECTS[ri], lx = (x - r.x0) / r.fs, lz = (z - r.z0) / r.fs, a = Math.min(r.fnx - 1, lx | 0), b = Math.min(r.fnz - 1, lz | 0);
    return tri(r.H, r.FW, a, b, lx - a, lz - b);
  }
  const NRM = [0, 1, 0];
  function normalAt(x, z) {
    const fx = (x - G.x0) / G.s, fz = (z - G.z0) / G.s;
    if (!(fx >= 0 && fz >= 0 && fx < G.nx && fz < G.nz)) { NRM[0] = 0; NRM[1] = 1; NRM[2] = 0; return NRM; }
    let A = HC, W = W1, k = fx | 0, j = fz | 0, u = fx - k, v = fz - j, cs = G.s;
    const ri = FI[j * G.nx + k];
    if (ri >= 0) { const r = RECTS[ri], lx = (x - r.x0) / r.fs, lz = (z - r.z0) / r.fs; A = r.H; W = r.FW; k = Math.min(r.fnx - 1, lx | 0); j = Math.min(r.fnz - 1, lz | 0); u = lx - k; v = lz - j; cs = r.fs; }
    const i = j * W + k, h00 = A[i], h10 = A[i + 1], h01 = A[i + W], h11 = A[i + W + 1];
    const gx = (u >= v ? h10 - h00 : h11 - h01) / cs, gz = (u >= v ? h11 - h10 : h01 - h00) / cs, l = Math.sqrt(gx * gx + gz * gz + 1);
    NRM[0] = -gx / l; NRM[1] = 1 / l; NRM[2] = -gz / l; return NRM;
  }
  const terrainAt = (x, z) => x >= G.x0 - 4 && x <= G.x1 + 4 && z >= G.z0 - 4 && z <= G.z1 + 4;

  // 2) 路面：1.25 公尺一格
  const SC = 1.25, SNX = Math.round((G.x1 - G.x0) / SC), SNZ = Math.round((G.z1 - G.z0) / SC), SURF = new Uint8Array(SNX * SNZ);
  const inGravel = (x, z) => GRAVEL_R.some(([a, b, c, d]) => x >= a && x <= c && z >= b && z <= d) || Math.hypot(x - PODIUM.x, z - PODIUM.z) < PODIUM.r + 2.5 ||
    GRAVEL_P.some((p) => { for (let i = 1; i < p.length; i++) if (segD(x, z, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]) <= 3.6) return true; return false; });
  const inSand = (x, z) => x > SAND.x0 && x < SAND.x1 && z > SAND.z0 && z < SAND.z1;
  const polyD = (P, x, z) => { let d = Infinity; for (let i = 1; i < P.length; i++) d = Math.min(d, segD(x, z, P[i - 1][0], P[i - 1][1], P[i][0], P[i][1])); return d; };
  const trailD = (x, z) => polyD(TRAIL, x, z), padD = (x, z) => polyD(PADDOCK_P, x, z);
  function surfCode(x, z) {
    if (fenceDist(x, z) < 0) return x < GATE.x && Math.abs(z - GATE.z) < 4.5 ? 3 : 1;
    if (inGravel(x, z)) return 3;
    if (Math.hypot((x - PIT.x) / PIT.rx, (z - PIT.z) / PIT.rz) <= 1) return 6;
    if (x > ROCK.x0 && x < ROCK.x1 && z > ROCK.z0 && z < ROCK.z1) return 8;
    const pr = CR.near(x, z);
    if (pr && Math.abs(pr.d) <= HW + 0.2) return CR.mud[pr.i] ? 6 : 5;
    if (x < 125 && padD(x, z) <= 3.3) return 5;
    const sand = inSand(x, z);
    if (x > SAND.x0 - 6 && x < SAND.x1 + 6 && z > SAND.z0 - 6 && trailD(x, z) <= 3) return sand ? 7 : 5;
    return sand ? 7 : 1;
  }
  for (let j = 0; j < SNZ; j++) for (let i = 0; i < SNX; i++) SURF[j * SNX + i] = surfCode(G.x0 + (i + 0.5) * SC, G.z0 + (j + 0.5) * SC);
  const accBox = [-116, 38, -47, 110];
  const onAccess = (x, z) => { if (x < accBox[0] || x > accBox[2] || z < accBox[1] || z > accBox[3]) return false; for (let i = 1; i < ACCESS.length; i++) if (segD(x, z, ACCESS[i - 1][0], ACCESS[i - 1][1], ACCESS[i][0], ACCESS[i][1]) <= 3.4) return true; return false; };
  const surf0 = V.surfaceAt;
  const surfaceAt = (x, z) => {
    if (x >= G.x0 && x < G.x1 && z >= G.z0 && z < G.z1) return SURF[(((z - G.z0) / SC) | 0) * SNX + (((x - G.x0) / SC) | 0)];
    if (onAccess(x, z)) return 3;
    return surf0(x, z);
  };

  // 3) 地面的貼圖（整片越野車場一張，世界座標對上去）＋粗糙度（泥巴亮亮的）
  const R = rng(20260928);
  const PW = 2048, PH = 448, psx = PW / (G.x1 - G.x0), psz = PH / (G.z1 - G.z0);
  const [pc, g] = cv(PW, PH), [rc, rg] = cv(1024, 224);
  const W = () => g.setTransform(psx, 0, 0, psz, -G.x0 * psx, -G.z0 * psz), PX = () => g.setTransform(1, 0, 0, 1, 0, 0);
  const coursePath = (gg, off = 0, i0 = 0, i1 = cn, close = true) => {
    gg.beginPath();
    for (let i = i0; i <= i1; i++) { const k = i % cn, x = CR.x[k] - CR.tz[k] * off, z = CR.z[k] + CR.tx[k] * off; if (i === i0) gg.moveTo(x, z); else gg.lineTo(x, z); }
    if (close) gg.closePath();
  };
  const polyPath = (gg, pts, close) => { gg.beginPath(); pts.forEach(([x, z], i) => (i ? gg.lineTo(x, z) : gg.moveTo(x, z))); if (close) gg.closePath(); };
  const speckle = (n, cols, s = 1.6) => { PX(); for (const col of cols) { g.fillStyle = col; for (let i = 0; i < n; i++) g.fillRect(R() * PW, R() * PH, 1 + R() * s, 1 + R() * s); } };
  { // 草地
    PX(); g.fillStyle = '#6f9a4a'; g.fillRect(0, 0, PW, PH);
    W();
    for (let i = 0; i < 240; i++) {
      const x = G.x0 + R() * (G.x1 - G.x0), z = G.z0 + R() * (G.z1 - G.z0), r = 4 + R() * 14, gr = g.createRadialGradient(x, z, 0, x, z, r);
      gr.addColorStop(0, R() < 0.5 ? 'rgba(62,104,40,0.35)' : 'rgba(150,170,92,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, z - r, 2 * r, 2 * r);
    }
    speckle(5000, ['rgba(52,84,34,0.55)', 'rgba(140,170,90,0.45)', 'rgba(96,128,58,0.5)']);
    W();
    // 沙丘
    g.fillStyle = '#d9bf88'; g.beginPath(); g.roundRect(SAND.x0, SAND.z0, SAND.x1 - SAND.x0, SAND.z1 - SAND.z0, 12); g.fill();
    g.strokeStyle = 'rgba(217,191,136,0.5)'; g.lineWidth = 5; g.stroke();
    g.strokeStyle = 'rgba(176,146,92,0.45)'; g.lineWidth = 0.35;
    for (let z = SAND.z0 + 3; z < SAND.z1 - 2; z += 2.2) { g.beginPath(); for (let x = SAND.x0 + 3; x < SAND.x1 - 3; x += 2) { const zz = z + Math.sin(x * 0.35 + z) * 0.6; if (x === SAND.x0 + 3) g.moveTo(x, zz); else g.lineTo(x, zz); } g.stroke(); }
    // 攀岩區：碎石底、一顆一顆的石頭（亮面、陰影）
    g.fillStyle = '#958a7b'; g.beginPath(); g.roundRect(ROCK.x0 - 1.5, ROCK.z0 - 1.5, ROCK.x1 - ROCK.x0 + 3, ROCK.z1 - ROCK.z0 + 3, 4); g.fill();
    for (const r of ROCKS) {
      const a = Math.atan2(r.s, r.c);
      g.fillStyle = '#6f6a63'; g.beginPath(); g.ellipse(r.x + 0.25, r.z + 0.3, r.r, r.r * r.e, a, 0, TAU); g.fill();
      g.fillStyle = '#8e8a84'; g.beginPath(); g.ellipse(r.x, r.z, r.r * 0.95, r.r * r.e * 0.95, a, 0, TAU); g.fill();
      g.fillStyle = '#b3aea6'; g.beginPath(); g.ellipse(r.x - r.r * 0.25, r.z - r.r * 0.25, r.r * 0.45, r.r * r.e * 0.4, a, 0, TAU); g.fill();
    }
    // 碎石地（車行、停車場、大門的路、起跑區旁邊）
    g.fillStyle = '#b9b2a4';
    for (const [a, b, c, d] of GRAVEL_R) { g.beginPath(); g.roundRect(a, b, c - a, d - b, 2); g.fill(); }
    g.beginPath(); g.arc(PODIUM.x, PODIUM.z, PODIUM.r + 2.5, 0, TAU); g.fill();
    g.strokeStyle = '#b9b2a4'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 7.2;
    for (const p of GRAVEL_P) { polyPath(g, p, false); g.stroke(); }
    speckle(2500, ['rgba(120,112,100,0.5)'], 1.2); W();
    // 沙丘裡的小路
    g.strokeStyle = '#c29a66'; g.lineWidth = 6; polyPath(g, TRAIL, true); g.stroke();
    g.strokeStyle = 'rgba(120,88,52,0.45)'; g.lineWidth = 0.45; for (const o of [-1.2, 1.2]) { g.beginPath(); TRAIL.forEach(([x, z], i) => (i ? g.lineTo(x + o, z) : g.moveTo(x + o, z))); g.stroke(); }
    // 車行到起跑區的泥土路
    g.strokeStyle = 'rgba(150,112,72,0.55)'; g.lineWidth = 8.5; polyPath(g, PADDOCK_P, false); g.stroke();
    g.strokeStyle = '#a47148'; g.lineWidth = 6; polyPath(g, PADDOCK_P, false); g.stroke();
    // 賽道：路肩（淡一點）、泥土、車輪壓出來的痕跡、髮夾彎外側斜坡的邊
    g.strokeStyle = 'rgba(150,112,72,0.55)'; g.lineWidth = 2 * HW + 3.5; coursePath(g); g.stroke();
    g.strokeStyle = '#a47148'; g.lineWidth = 2 * HW; coursePath(g); g.stroke();
    g.strokeStyle = 'rgba(120,80,48,0.55)'; g.lineWidth = 0.55; for (const o of [-3, -1.1, 1.1, 3]) { coursePath(g, o); g.stroke(); }
    g.strokeStyle = 'rgba(88,58,34,0.35)'; g.lineWidth = 1.2;
    for (let i = 0; i < cn; i++) if (CR.bm[i] > 0.5 && CR.bm[(i + 1) % cn] > 0.5 && gapK(CR.x[i] + CR.tz[i] * HW, CR.z[i] - CR.tx[i] * HW) > 0.5) { const k = i, j = (i + 1) % cn, o = -HW + 0.6; g.beginPath(); g.moveTo(CR.x[k] - CR.tz[k] * o, CR.z[k] + CR.tx[k] * o); g.lineTo(CR.x[j] - CR.tz[j] * o, CR.z[j] + CR.tx[j] * o); g.stroke(); }
    // 泥巴水坑（賽道上）、泥巴池
    for (let i = 0; i < cn; i++) if (CR.mud[i]) { const k = i, j = (i + 1) % cn; g.strokeStyle = '#5b4029'; g.lineWidth = 2 * HW + 0.5; g.beginPath(); g.moveTo(CR.x[k], CR.z[k]); g.lineTo(CR.x[j], CR.z[j]); g.stroke(); }
    { const gr = g.createRadialGradient(PIT.x, PIT.z, 0, PIT.x, PIT.z, PIT.rx * 1.15); gr.addColorStop(0, '#3f2c1a'); gr.addColorStop(0.8, '#5b4029'); gr.addColorStop(0.9, '#7a5a3a'); gr.addColorStop(1, 'rgba(122,90,58,0)');
      g.save(); g.translate(PIT.x, PIT.z); g.scale(1, PIT.rz / PIT.rx); g.translate(-PIT.x, -PIT.z); g.fillStyle = gr; g.beginPath(); g.arc(PIT.x, PIT.z, PIT.rx * 1.15, 0, TAU); g.fill(); g.restore(); }
    g.fillStyle = 'rgba(160,140,120,0.35)'; for (let i = 0; i < 14; i++) { const a = R() * TAU, q = R() * 0.8; g.beginPath(); g.ellipse(PIT.x + Math.cos(a) * PIT.rx * q, PIT.z + Math.sin(a) * PIT.rz * q, 1 + R() * 2.5, 0.5 + R() * 1.2, R() * 3, 0, TAU); g.fill(); }
    speckle(4000, ['rgba(80,52,30,0.4)', 'rgba(190,150,110,0.35)'], 1.4); W();
    // 跳台口的白線、起終點的格子、檢查點的線、起跑位置、停車格、買車區
    const across = (i, w, col, lw) => { const x = CR.x[i], z = CR.z[i], nx = -CR.tz[i], nz = CR.tx[i]; g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x - nx * w, z - nz * w); g.lineTo(x + nx * w, z + nz * w); g.stroke(); };
    const atX = (leg, x) => { let bi = 0, bd = Infinity; for (let i = 0; i < cn; i++) if (CR.leg[i] === leg && Math.abs(CR.x[i] - x) < bd) { bd = Math.abs(CR.x[i] - x); bi = i; } return bi; };
    for (const [leg, x] of [[1, 273], [1, 285], [1, 355], [2, 256], [2, 246]]) across(atX(leg, x), HW - 0.3, 'rgba(245,240,228,0.9)', 0.35);
    for (let r = 0; r < 2; r++) for (let q = -7; q < 7; q++) { g.fillStyle = (q + r) % 2 ? '#f2f3f5' : '#17181b'; g.fillRect(150 + r, 90 + q, 1, 1); }
    g.strokeStyle = '#f2f3f5'; g.lineWidth = 0.22;
    for (const [x, z] of GRID) { g.strokeRect(x - 2.6, z - 1.3, 5.2, 2.6); }
    for (let k = 0; k <= 8; k++) { g.beginPath(); g.moveTo(-44 + 4.5 * k, 111.5); g.lineTo(-44 + 4.5 * k, 119); g.stroke(); }
    g.strokeStyle = '#f2c230'; g.lineWidth = 0.3; g.strokeRect(PN.BAY[0] - 5, PN.BAY[1] - 3.8, 10, 7.6);
    g.fillStyle = 'rgba(242,194,48,0.9)'; g.font = `700 2.2px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.translate(PN.BAY[0], PN.BAY[1]); g.rotate(Math.PI / 2); g.fillText('買車區', 0, 0); g.restore();
  }
  { // 粗糙度：泥巴 0.55（有一點天空的倒影、看起來濕濕的，還是咖啡色），其他 1
    rg.fillStyle = '#ffffff'; rg.fillRect(0, 0, 1024, 224);
    rg.setTransform(1024 / (G.x1 - G.x0), 0, 0, 224 / (G.z1 - G.z0), (-G.x0 * 1024) / (G.x1 - G.x0), (-G.z0 * 224) / (G.z1 - G.z0));
    rg.fillStyle = '#8c8c8c'; rg.save(); rg.translate(PIT.x, PIT.z); rg.scale(1, PIT.rz / PIT.rx); rg.beginPath(); rg.arc(0, 0, PIT.rx, 0, TAU); rg.fill(); rg.restore();
    rg.strokeStyle = '#999999'; rg.lineWidth = 2 * HW;
    for (let i = 0; i < cn; i++) if (CR.mud[i]) { const j = (i + 1) % cn; rg.beginPath(); rg.moveTo(CR.x[i], CR.z[i]); rg.lineTo(CR.x[j], CR.z[j]); rg.stroke(); }
  }
  const tPaint = new THREE.CanvasTexture(pc); tPaint.colorSpace = THREE.SRGBColorSpace; tPaint.anisotropy = aniso;
  const tRough = new THREE.CanvasTexture(rc); tRough.anisotropy = 2;

  // 近看的細節：整片一張的地面貼圖一公尺只有 3.6 個像素（近看很糊），再乘一張會重複的小貼圖（世界座標 3.2 公尺一格，平均＝1：遠的看不出來）
  const tDetail = detailTex(rng(3172));

  // 4) 地形網格：x 方向切三塊（看不到的那塊不用畫）；法線照旁邊的高度算（滑順）
  const terrMat = new THREE.MeshStandardMaterial({ map: tPaint, roughnessMap: tRough, roughness: 1, metalness: 0 });
  terrMat.onBeforeCompile = (sh) => {
    sh.uniforms.tDetail = { value: tDetail };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vOrW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOrW = position.xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tDetail;\nvarying vec2 vOrW;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= texture2D(tDetail, vOrW * 0.3125).rgb * 2.0;');
  };
  terrMat.customProgramCacheKey = () => 'or-terrain-detail';
  const group = new THREE.Group(); group.name = 'offroad';
  let terrTris = 0;
  const chunks = [[0, 76], [76, 152], [152, G.nx]];
  const hcAt = (k, j) => HC[clamp(j, 0, G.nz) * W1 + clamp(k, 0, G.nx)];
  for (const [ka, kb] of chunks) {
    const P = [], N = [], UV = [], I = [];
    const vert = (x, y, z, nx, nz, ny = 1) => { const l = Math.sqrt(nx * nx + ny * ny + nz * nz); P.push(x, y, z); N.push(nx / l, ny / l, nz / l); UV.push((x - G.x0) / (G.x1 - G.x0), 1 - (z - G.z0) / (G.z1 - G.z0)); return P.length / 3 - 1; };
    const cw = kb - ka + 1, base = [];
    for (let j = 0; j <= G.nz; j++) for (let k = ka; k <= kb; k++) {
      const gx = (hcAt(k + 1, j) - hcAt(k - 1, j)) / (2 * G.s), gz = (hcAt(k, j + 1) - hcAt(k, j - 1)) / (2 * G.s);
      base.push(vert(G.x0 + k * G.s, HC[j * W1 + k], G.z0 + j * G.s, -gx, -gz));
    }
    for (let j = 0; j < G.nz; j++) for (let k = ka; k < kb; k++) {
      if (FI[j * G.nx + k] >= 0) continue;
      const a = base[j * cw + (k - ka)], b = base[j * cw + (k - ka + 1)], c = base[(j + 1) * cw + (k - ka)], d = base[(j + 1) * cw + (k - ka + 1)];
      I.push(a, d, b, a, c, d); // (00, 11, 10)、(00, 01, 11)：法線朝上，對角線跟 heightAt 一樣
    }
    for (const r of RECTS) {
      if (r.k0 < ka || r.k0 >= kb) continue;
      const o = P.length / 3, hf = (a, b) => r.H[clamp(b, 0, r.fnz) * r.FW + clamp(a, 0, r.fnx)];
      for (let b = 0; b <= r.fnz; b++) for (let a = 0; a <= r.fnx; a++) vert(r.x0 + a * r.fs, r.H[b * r.FW + a], r.z0 + b * r.fs, -(hf(a + 1, b) - hf(a - 1, b)) / (2 * r.fs), -(hf(a, b + 1) - hf(a, b - 1)) / (2 * r.fs));
      for (let b = 0; b < r.fnz; b++) for (let a = 0; a < r.fnx; a++) { const i00 = o + b * r.FW + a, i10 = i00 + 1, i01 = i00 + r.FW, i11 = i01 + 1; I.push(i00, i11, i10, i00, i01, i11); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    geo.setIndex(P.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1)); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, terrMat); m.name = 'or-terrain'; m.matrixAutoUpdate = false; group.add(m);
    terrTris += I.length / 3;
  }
  // 村子的草地（到 x −62）和越野車場的地面（從 x −52.5）中間：賽道那片比較深的草地會露出一條，鋪一條村子的草地接過來（同一張貼圖接得起來）
  //   村子草地的材質往後推（polygonOffset）：這條疊在賽道的草地上面，不能往後推（複製一份拿掉）
  let apron = 0, apronMat = null;
  { const vg = V.group && V.group.getObjectByName('ground');
    if (vg && vg.material) {
      apronMat = vg.material.clone(); apronMat.polygonOffset = false;
      const P = [], N = [], UV = [], x0 = -62, x1 = G.x0 + 1.2; // 蓋過地形邊上沉下去的那 1.2 公尺（那裡地形比 0 低）
      for (let z = G.z0; z < G.z1 - 1e-6; z += 25) { const z1 = Math.min(G.z1, z + 25); for (const [x, zz] of [[x0, z1], [x1, z1], [x1, z], [x0, z1], [x1, z], [x0, z]]) { P.push(x, 0, zz); N.push(0, 1, 0); UV.push(x / 6, -zz / 6); } }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, apronMat); m.name = 'or-apron'; m.matrixAutoUpdate = false; group.add(m); apron = P.length / 9;
    } }

  // 5) 東西：圍籬、大門、車行、展示台、買車區、停車場、起終點、檢查點、旗子、輪胎堆、看台、報名處、招牌、樹、石頭
  const SA = signAtlas(), U = SA.uv;
  const tSign = new THREE.CanvasTexture(SA.c); tSign.colorSpace = THREE.SRGBColorSpace; tSign.anisotropy = aniso;
  const mats = {
    main: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }),
    sign: new THREE.MeshStandardMaterial({ map: tSign, vertexColors: true, emissive: 0xffffff, emissiveMap: tSign, emissiveIntensity: 0.3, roughness: 0.6 }),
  };
  const B = new PB(300), colliders = [], WHITE = [1, 1, 1], WU = dotUV(U.white);
  const addBox = (x, z, hx, hz, rot, h) => colliders.push({ t: 'box', x, z, hx, hz, rot, h });
  const addCircle = (x, z, r, h) => colliders.push({ t: 'circle', x, z, r, h });
  const box = (m, T, b, col, uv = {}) => { // 方塊（本地 [x0, y0, z0, x1, y1, z1]）；uv：{ pz, nz, px, nx } 哪一面貼招牌
    const [x0, y0, z0, x1, y1, z1] = b, P = T.p, cc = (k) => (Array.isArray(col) ? col : col[k] || col._ || WHITE);
    B.at(T.x);
    const f = (k, a, bb, c, d) => { if (uv[k] === false) return; const mm = uv[k] ? 'sign' : m; B.quad(mm, P(...a), P(...bb), P(...c), P(...d), uv[k] ? WHITE : cc(k), uv[k] || (mm === 'sign' ? WU : null)); };
    f('pz', [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); f('nz', [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    f('px', [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]); f('nx', [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    f('py', [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    if (uv.ny) f('ny', [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  };
  const cyl = (T, x, z, y0, y1, r0, r1, n, col, cap = true) => { // 直的圓柱（本地）
    const P = (a, r, y) => T.p(x + Math.cos(a) * r, y, z - Math.sin(a) * r); B.at(T.x);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, b = ((i + 1) / n) * TAU;
      if (r1 > 0) B.quad('main', P(a, r0, y0), P(b, r0, y0), P(b, r1, y1), P(a, r1, y1), col); else B.tri('main', P(a, r0, y0), P(b, r0, y0), T.p(x, y1, z), col);
      if (cap && r1 > 0) B.tri('main', T.p(x, y1, z), P(a, r1, y1), P(b, r1, y1), col);
    }
  };
  const blob = (cx, cy, cz, rx, ry, rz, col, jit, detail, seed, shade = 0.16) => { // 一團（樹冠、石頭）
    const { v, f } = ICO[detail], Pp = v.map((p, i) => { const k = 1 + (hash2(seed, i) - 0.5) * 2 * jit; return [cx + p[0] * rx * k, cy + p[1] * ry * k, cz + p[2] * rz * k]; });
    B.at(cx); f.forEach(([a, b, c], i) => { const ny = (v[a][1] + v[b][1] + v[c][1]) / 3, k = 0.88 + ny * 0.14 + (hash2(seed + 9, i) - 0.5) * shade; B.tri('main', Pp[a], Pp[b], Pp[c], mul(col, k)); });
  };
  const hMin = (x, z, r) => Math.min(heightAt(x, z), heightAt(x + r, z), heightAt(x - r, z), heightAt(x, z + r), heightAt(x, z - r));
  // 牌子（兩根柱子＋板子）：(x, z) 中間、面向 (fx, fz)（看牌子的人在那一邊）、寬 w、高 h、離地 y0；back：背面也貼（另一張）
  const board = (x, z, fx, fz, reg, w, h, y0, back = null, post = C('#5b5f66')) => {
    const T = frame(x, hMin(x, z, 0.5), z, Math.atan2(fx, fz));
    for (const s of [-1, 1]) { box('main', T, [s * (w / 2 - 0.25) - 0.06, -0.3, -0.08, s * (w / 2 - 0.25) + 0.06, y0 + h, 0.02], post); const q = T.p(s * (w / 2 - 0.25), 0, 0); addCircle(q[0], q[2], 0.15, y0 + h); }
    box('main', T, [-w / 2, y0, 0.02, w / 2, y0 + h, 0.12], C('#9aa0a6'), { pz: reg, nz: back || undefined });
  };

  // 圍籬：木頭柱子 4 公尺一根、兩條橫木；每一段一個碰撞（大門那裡空著）
  const POST = C('#7a5a3a'), RAIL = C('#a57c50');
  const fenceSegs = [];
  for (let i = 0; i < FENCE.length; i++) {
    const a = FENCE[i], b = FENCE[(i + 1) % FENCE.length];
    if (a[0] === -50 && b[0] === -50) { fenceSegs.push([a, [-50, GATE.z1]], [[-50, GATE.z0], b]); continue; } // 西邊：大門空著
    fenceSegs.push([a, b]);
  }
  for (const [a, b] of fenceSegs) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), np = Math.max(1, Math.ceil(L / 4)), ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    const pts = []; for (let k = 0; k <= np; k++) { const x = lerp(a[0], b[0], k / np), z = lerp(a[1], b[1], k / np); pts.push([x, heightAt(x, z), z]); }
    for (const [x, y, z] of pts) box('main', frame(x, y, z, ry), [-0.08, -0.35, -0.08, 0.08, 1.2, 0.08], POST);
    for (let k = 0; k < np; k++) {
      const p = pts[k], q = pts[k + 1];
      for (const yy of [0.5, 0.98]) {
        const A = [p[0], p[1] + yy, p[2]], Bq = [q[0], q[1] + yy, q[2]], A2 = [p[0], p[1] + yy + 0.13, p[2]], B2 = [q[0], q[1] + yy + 0.13, q[2]];
        B.at(p[0]); B.quad('main', A, Bq, B2, A2, RAIL); B.quad('main', Bq, A, A2, B2, mul(RAIL, 0.8));
      }
    }
    addBox((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L / 2, 0.25, ry, 1.3);
  }
  // 大門：兩根石柱＋橫樑，西邊「越野車場」、東邊「歡迎再來」（怪獸卡車過得去：5.5 公尺高）
  {
    const T = frame(GATE.x, 0.06, GATE.z, 0), ST = C('#7d6a55'), WOOD = C('#5a3a1e');
    for (const s of [-1, 1]) { box('main', T, [-0.7, -0.3, s * 6.6 - 0.7, 0.7, 7.6, s * 6.6 + 0.7], ST); box('main', T, [-0.85, 7.6, s * 6.6 - 0.85, 0.85, 8.0, s * 6.6 + 0.85], mul(ST, 0.8)); addBox(GATE.x, GATE.z + s * 6.6, 0.7, 0.7, 0, 8); }
    box('main', T, [-0.45, 5.6, -7.3, 0.45, 7.5, 7.3], WOOD);
    box('main', T, [-0.55, 5.55, -6, -0.45, 7.45, 6], WOOD, { nx: U.gateW });
    box('main', T, [0.45, 5.75, -6, 0.55, 7.25, 6], WOOD, { px: U.gateE });
  }
  // 越野車行：鐵皮大車棚（前面整片開著）、招牌、兩個展示位、門口的大圓台
  const floorY = 0.06 + 0.1;
  {
    const T = frame(0, 0.06, 86, 0), WALL = C('#d9d4c7'), ORG = C('#e58a2b'), ROOF = C('#b85a24');
    box('main', T, [-18, -0.3, -8, 18, 0.1, 8], C('#bdb8ad'));
    box('main', T, [-18, 0, -8, 18, 6.8, -7.6], WALL); box('main', T, [-18, 0, -8, -17.6, 6.6, 8], WALL); box('main', T, [17.6, 0, -8, 18, 6.6, 8], WALL);
    box('main', T, [-18, 6.6, -7.6, 18, 6.8, 8], mul(WALL, 0.9), { py: false }); // 屋簷下面那圈
    { // 斜屋頂（後高前低）
      const a = T.p(-18.6, 7.2, -8.6), b = T.p(18.6, 7.2, -8.6), c = T.p(18.6, 6.5, 8.8), d = T.p(-18.6, 6.5, 8.8);
      B.at(0); B.quad('main', d, c, b, a, ROOF); B.quad('main', a, b, c, d, mul(ROOF, 0.6));
      B.quad('main', T.p(-18.6, 6.3, 8.8), T.p(18.6, 6.3, 8.8), c, d, mul(ROOF, 0.85));
    }
    for (const x of [-18, -6, 6, 18]) { box('main', T, [x - 0.25, 0, 7.55, x + 0.25, 6.6, 8.05], ORG); if (Math.abs(x) < 10) addCircle(x, 93.8, 0.3, 6.6); }
    box('main', T, [-18.2, 5.7, 7.6, 18.2, 6.5, 8.2], ORG);
    box('main', T, [-7.5, 6.5, 7.9, 7.5, 9.5, 8.15], C('#2a1a0c'), { pz: U.dealer });
    for (const x of [-6.5, 6.5]) box('main', T, [x - 0.1, 6.5, 7.7, x + 0.1, 9.5, 7.9], C('#2a1a0c'));
    for (const x of [-7, 8]) box('main', T, [x - 2.6, 0.1, -1.6, x + 2.6, 0.18, 1.6], C('#3b3d42'));
    // 裡面：輪胎架、工作台、工具箱
    for (let i = 0; i < 6; i++) for (let k = 0; k < 3; k++) cyl(T, -15 + i * 1.05, -6.8, 0.1 + k * 0.36, 0.44 + k * 0.36, 0.48, 0.48, 10, C(k % 2 ? '#2b2c30' : '#232427'));
    box('main', T, [11, 0.1, -7.4, 15.5, 1.0, -6.2], C('#6b4a2c')); box('main', T, [12, 1.0, -7.3, 13.4, 1.6, -6.6], C('#c8322a'));
    addBox(0, 78.2, 18, 0.35, 0, 6.8); addBox(-17.8, 86, 0.3, 8, 0, 6.6); addBox(17.8, 86, 0.3, 8, 0, 6.6); addBox(-13.5, 79.3, 3.6, 0.6, 0, 1.2); addBox(13.2, 79.2, 2.3, 0.7, 0, 1.6);
    // 門口的大圓台
    const TP = frame(PODIUM.x, 0.06, PODIUM.z, 0);
    cyl(TP, 0, 0, -0.3, PODIUM.h, PODIUM.r, PODIUM.r, 24, C('#e7e1d3')); cyl(TP, 0, 0, 0.22, 0.4, PODIUM.r + 0.02, PODIUM.r + 0.02, 24, ORG, false);
    addCircle(PODIUM.x, PODIUM.z, PODIUM.r, PODIUM.h + 0.06);
    // 買車區的車棚（路從下面穿過去：四根柱子、平屋頂，怪獸卡車進得去；前後都有「買車區」的牌子）
    const TB = frame(0, 0.06, 0, 0), bx = PN.BAY[0], bz = PN.BAY[1];
    for (const [x, z] of [[bx - 8, bz - 7], [bx + 8, bz - 7], [bx - 8, bz + 7], [bx + 8, bz + 7]]) { cyl(TB, x, z, -0.2, 5.3, 0.2, 0.2, 8, C('#6b6f76')); addCircle(x, z, 0.25, 5.3); }
    box('main', TB, [bx - 8.7, 5.3, bz - 7.7, bx + 8.7, 5.65, bz + 7.7], { _: C('#e9e5dc'), py: C('#cfcac0') }, { ny: false });
    box('main', TB, [bx - 8.8, 5.1, bz - 7.8, bx + 8.8, 5.35, bz + 7.8], ORG);
    box('main', TB, [bx - 8.95, 3.95, bz - 1.25, bx - 8.8, 5.1, bz + 1.25], C('#6b3f1f'), { nx: U.buy });
    box('main', TB, [bx + 8.8, 3.95, bz - 1.25, bx + 8.95, 5.1, bz + 1.25], C('#6b3f1f'), { px: U.buy });
  }
  // 停車場：兩台停著的越野車
  for (const [style, col, x] of [['truck', '#2c7a9e', -35.75], ['buggy', '#d0342c', -17.75]]) {
    const y = heightAt(x, 115.5), T = frame(x, y, 115.5, Math.PI / 2), rp = racerParts(style, C(col));
    B.at(x); for (const t of rp.tris) B.tri('main', T.p(...t[0]), T.p(...t[1]), T.p(...t[2]), t[3]);
    for (const w of rp.wheels) for (const t of WHEEL_TRIS) { const P = (q) => T.p(w.x + q[0] * w.R, w.R + q[1] * w.R, w.z + q[2] * w.w); B.tri('main', P(t[0]), P(t[1]), P(t[2]), t[3]); }
    addBox(x, 115.5 - rp.info.CX, rp.info.halfW, rp.info.len / 2, 0, 1.6);
  }
  board(-44, 110.6, -1, 0, U.park, 2.4, 1.1, 1.3);
  // 起終點的門（兩根柱子、橫幅兩面都有字）
  const archAt = (i, reg, tall, wide) => {
    const x = CR.x[i], z = CR.z[i], ry = Math.atan2(-CR.tz[i], CR.tx[i]), T = frame(x, 0, z, ry), hw = wide;
    for (const s of [-1, 1]) {
      const q = T.p(0, 0, s * hw), y = hMin(q[0], q[2], 0.5);
      box('main', frame(q[0], y, q[2], ry), [-0.35, -0.3, -0.35, 0.35, tall + 1.1 - (y - heightAt(x, z)), 0.35], { _: C('#f2f3f5'), py: C('#c8322a') }); addCircle(q[0], q[2], 0.4, tall + 1);
    }
    const y0 = heightAt(x, z) + tall;
    const Tb = frame(x, y0, z, ry);
    box('main', Tb, [-0.2, 0, -hw, 0.2, 1.1, hw], C('#c8322a'));
    box('main', Tb, [-0.26, 0.05, -hw * 0.62, 0.26, 1.05, hw * 0.62], C('#c8322a'), { nx: reg, px: reg });
  };
  const cps = [];
  {
    const atX = (leg, x) => { let bi = 0, bd = Infinity; for (let i = 0; i < cn; i++) if (CR.leg[i] === leg && Math.abs(CR.x[i] - x) < bd) { bd = Math.abs(CR.x[i] - x); bi = i; } return bi; };
    const list = [atX(1, 240), atX(1, 412), CR.near(476, 144).i, atX(2, 300), atX(2, 165)];
    list.forEach((i, k) => { cps.push({ s: i * CR.ds, x: CR.x[i], z: CR.z[i], tx: CR.tx[i], tz: CR.tz[i], i }); archAt(i, U['cp' + (k + 1)], 4.6, 9.2); });
    cps.push({ s: CR.len, x: CR.x[0], z: CR.z[0], tx: CR.tx[0], tz: CR.tz[0], i: 0 }); archAt(0, U.sf, 5.6, 9.4);
  }
  // 賽道兩邊的旗子（15 公尺一支）、髮夾彎外側的輪胎堆、箭頭牌
  {
    const FLAGS = [C('#e0251b'), C('#ffcf33')], skip = (i) => cps.some((c) => Math.abs(((i - c.i + cn + cn / 2) % cn) - cn / 2) < 8) || i > cn - 40;
    let f = 0;
    for (let i = 6; i < cn; i += 15) {
      if (skip(i)) continue;
      for (const sd of [-1, 1]) {
        const o = sd * (HW + 0.8), x = CR.x[i] - CR.tz[i] * o, z = CR.z[i] + CR.tx[i] * o, y = heightAt(x, z), col = FLAGS[f++ % 2];
        if (x < GAP.x1 + 4 && Math.abs(z - GAP.z) < 9) continue; // 車行過來的路
        B.at(x); const T = frame(x, y, z, Math.atan2(-CR.tz[i], CR.tx[i]));
        box('main', T, [-0.03, -0.2, -0.03, 0.03, 1.7, 0.03], C('#e8e8e8'));
        const a = T.p(0, 1.68, 0), b = T.p(0, 1.18, 0), c = T.p(-0.75, 1.45, 0.05 * sd);
        B.tri('main', a, b, c, col); B.tri('main', b, a, c, mul(col, 0.8));
      }
    }
    for (let i = 0; i < cn; i += 5) {
      if (CR.bm[i] < 0.6) continue;
      const o = -(HW + 2.4), x = CR.x[i] - CR.tz[i] * o, z = CR.z[i] + CR.tx[i] * o, y = heightAt(x, z) - 0.1, T = frame(x, y, z, 0);
      if (gapK(x, z) < 0.99) continue;
      for (let k = 0; k < 3; k++) cyl(T, 0, 0, k * 0.3, k * 0.3 + 0.28, 0.45, 0.45, 8, C(k === 1 ? '#f2f3f5' : '#222326'), k === 2);
      addCircle(x, z, 0.5, 1);
    }
    for (let i = 0; i < cn; i += 12) {
      if (CR.bm[i] < 0.75) continue;
      const o = -(HW + 4.2), x = CR.x[i] - CR.tz[i] * o, z = CR.z[i] + CR.tx[i] * o;
      if (x < GAP.x1 + 4 && Math.abs(z - GAP.z) < 12) continue;
      board(x, z, -CR.tx[i], -CR.tz[i], U.chev, 1.8, 0.6, 0.5);
    }
  }
  // 報名處（小屋）、比賽的看板、看台
  {
    const T = frame(0, 0.06, 0, 0);
    box('main', T, [120, -0.2, 104.5, 125, 2.8, 108], C('#e8e2d2')); box('main', T, [119.5, 2.8, 104, 125.5, 3.1, 108.5], C('#c8322a'), { ny: false });
    box('main', T, [120.5, 1.9, 104.4, 124.5, 2.7, 104.5], C('#2a1a0c'), { nz: U.booth });
    addBox(122.5, 106.25, 2.5, 1.75, 0, 3);
    board(131, 104.2, 0, -1, U.board, 4.2, 2.8, 0.9);
    for (let k = 0; k < 4; k++) box('main', T, [136, -0.2, 104.5 + 1.4 * k, 164, 0.5 + 0.45 * k, 110.2], C(k % 2 ? '#d9d4c7' : '#c9c3b5'));
    for (let k = 0; k < 4; k++) box('main', T, [136.2, 0.5 + 0.45 * k, 104.7 + 1.4 * k, 163.8, 0.62 + 0.45 * k, 105.3 + 1.4 * k], C(['#1d4fd8', '#e0251b', '#f3c316', '#2f9e44'][k]));
    for (const x of [136.3, 150, 163.7]) cyl(T, x, 110, 0, 4.4, 0.12, 0.12, 6, C('#6b6f76'));
    box('main', T, [135.6, 4.4, 103.8, 164.4, 4.6, 110.6], C('#ededeb'), { ny: false });
    addBox(150, 107.35, 14, 2.85, 0, 4.6);
  }
  // 各區的牌子
  board(250, 102.5, -1, 0, U.jump, 2.4, 1.1, 1.2); board(398, 163.5, 0, -1, U.mud, 2.4, 1.1, 1.2); board(316, 157.5, 0, -1, U.rock, 2.4, 1.1, 1.2);
  board(22, 133.5, 0, -1, U.sand, 2.4, 1.1, 1.2);
  // 村子裡往越野車場的指示牌（大路 E1 路口兩邊、農路分岔的地方）
  board(-103.5, 6.9, 1, 0, U.v2, 2.8, 0.95, 1.6);
  board(-121, 6.9, -1, 0, U.v1, 2.8, 0.95, 1.6);
  board(-106.3, 53, 0, -1, U.v3, 2.4, 0.95, 1.4);
  // 樹、石頭（固定種子；避開賽道、小路、房子、跳台、泥巴池、攀岩區、圍籬）
  const GREENS = ['#4f8a3c', '#5e9a44', '#3f7a35', '#6aa84f', '#77ad4c'].map(C), TRUNK = C('#6b5140');
  const trees = [];
  {
    const Rt = rng(9090);
    const fenceZ = (x) => { for (let i = 1; i < FENCE.length; i++) { const a = FENCE[i - 1], b = FENCE[i]; if (a[1] >= 140 && b[1] >= 140 && ((a[0] >= x && b[0] <= x) || (a[0] <= x && b[0] >= x)) && a[0] !== b[0]) return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])); } return 196; };
    const bad = (x, z, r) => {
      const fd = fenceDist(x, z);
      if (Math.abs(fd) < 3 + r) return true;
      if (Math.hypot(x - 200, z - 320) < 152 || Math.hypot(x - 600, z - 300) < 172) return true; // 賽道的山
      if (fd < 0) return false;
      const pr = CR.near(x, z); if (pr && Math.abs(pr.d) < HW + 7 + r) return true;
      if (x < 60 && z < 134) return true; // 車行、停車場、大門
      if (x > 112 && x < 172 && z < 116) return true; // 起跑區、看台
      if (Math.hypot((x - PIT.x) / (PIT.rx + 9), (z - PIT.z) / (PIT.rz + 9)) < 1) return true;
      if (x > ROCK.x0 - 10 && x < ROCK.x1 + 10 && z > ROCK.z0 - 6 && z < ROCK.z1 + 6) return true;
      if (FINE.some((f) => x > f.x0 - 3 && x < f.x1 + 3 && z > f.z0 - 3 && z < f.z1 + 3)) return true;
      if (trailD(x, z) < 5 + r || padD(x, z) < 6 + r) return true;
      if (inSand(x, z) && Rt() < 0.8) return true;
      return trees.some((t) => Math.hypot(t[0] - x, t[1] - z) < 4 + r);
    };
    let tries = 0;
    while (trees.length < 78 && tries++ < 1400) {
      const zone = Rt();
      let x, z;
      if (zone < 0.45) { x = -48 + Rt() * 566; const f = fenceZ(x); z = f + 4 + Rt() * 16; } // 南邊圍籬外面
      else if (zone < 0.55) { x = 521 + Rt() * 22; z = 78 + Rt() * 62; } // 東邊外面
      else { x = G.x0 + Rt() * (G.x1 - G.x0); z = G.z0 + Rt() * (G.z1 - G.z0); } // 裡面空的地方
      const s = 0.85 + Rt() * 0.6;
      if (bad(x, z, 0.4 * s)) continue;
      trees.push([x, z, s]);
    }
    for (const [x, z, s] of trees) {
      const y = heightAt(x, z) - 0.25, T = frame(x, y, z, 0), h = 2 * s;
      cyl(T, 0, 0, 0, h + 0.4, 0.2 * s, 0.14 * s, 6, TRUNK, false);
      const gcol = GREENS[(hash2(x | 0, z | 0) * GREENS.length) | 0], seed = (hash2(z | 0, x | 0) * 1e6) | 0;
      blob(x, y + h + 1.3 * s, z, 1.8 * s, 1.5 * s, 1.8 * s, gcol, 0.22, 1, seed);
      blob(x + 0.7 * s, y + h + 2.1 * s, z - 0.4 * s, 1.1 * s, 1.0 * s, 1.1 * s, mul(gcol, 1.1), 0.2, 0, seed + 1);
      addCircle(x, z, 0.35 * s, h + 3 * s);
    }
    // 大石頭（有碰撞）：圍籬裡面的空地
    let nb = 0; tries = 0;
    while (nb < 22 && tries++ < 600) {
      const x = G.x0 + Rt() * (G.x1 - G.x0), z = G.z0 + Rt() * (G.z1 - G.z0), r = 0.7 + Rt() * 0.9;
      if (bad(x, z, r + 1) || fenceDist(x, z) < 6) continue;
      const y = heightAt(x, z);
      blob(x, y + r * 0.25, z, r * 1.2, r * 0.8, r, mix(C('#8e8b86'), C('#a39a8c'), Rt()), 0.3, 0, (Rt() * 1e6) | 0, 0.25);
      addCircle(x, z, r * 0.95, r); nb++;
    }
  }
  // 從村子來的水泥路（跟村子的農路一樣的貼圖）：跟農路重疊的那段往後推（村子的路蓋在上面）
  let roadMat = null; V.group.traverse((o) => { if (!roadMat && o.isMesh && o.name === 'road') roadMat = o.material; });
  const accMats = [0, 1].map((k) => {
    const m = roadMat ? roadMat.clone() : new THREE.MeshStandardMaterial({ color: 0xb5b3aa, roughness: 0.93 });
    if (k === 0) { m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 2; }
    return m;
  });
  {
    const RU = [404 / 512, 508 / 512], um = (RU[0] + RU[1]) / 2, n = ACCESS.length, parts = [[], []];
    let v = 0; const L = [], Rr = [], M = [], Vv = [];
    for (let i = 0; i < n; i++) {
      const p = ACCESS[i], a = ACCESS[Math.max(0, i - 1)], b = ACCESS[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
      const lx = tz, lz = -tx, hw = 3, y = terrainAt(p[0], p[1]) ? Math.max(0.03, heightAt(p[0], p[1]) + 0.04) : 0.03;
      if (i > 0) v += Math.hypot(p[0] - ACCESS[i - 1][0], p[1] - ACCESS[i - 1][1]);
      L.push([p[0] + lx * hw, y, p[1] + lz * hw]); Rr.push([p[0] - lx * hw, y, p[1] - lz * hw]); M.push([p[0], y, p[1]]); Vv.push(v / 10);
    }
    for (let i = 0; i < n - 1; i++) {
      const q = parts[ACCESS[i + 1][1] <= 62 ? 0 : 1];
      const t = (a, b, c, ua, ub, uc) => q.push([a, b, c, ua, ub, uc]);
      t(Rr[i], Rr[i + 1], M[i + 1], [RU[1], Vv[i]], [RU[1], Vv[i + 1]], [um, Vv[i + 1]]); t(Rr[i], M[i + 1], M[i], [RU[1], Vv[i]], [um, Vv[i + 1]], [um, Vv[i]]);
      t(M[i], M[i + 1], L[i + 1], [um, Vv[i]], [um, Vv[i + 1]], [RU[0], Vv[i + 1]]); t(M[i], L[i + 1], L[i], [um, Vv[i]], [RU[0], Vv[i + 1]], [RU[0], Vv[i]]);
    }
    parts.forEach((list, k) => {
      const P = [], N = [], UVs = [];
      for (const [a, b, c, ua, ub, uc] of list) { P.push(...a, ...b, ...c); N.push(0, 1, 0, 0, 1, 0, 0, 1, 0); UVs.push(...ua, ...ub, ...uc); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UVs, 2)); geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, accMats[k]); m.name = 'or-access'; m.matrixAutoUpdate = false; group.add(m);
    });
  }
  const bp = B.build(mats, 'or-');
  group.add(bp.group);
  group.updateMatrixWorld(true);
  V.group.add(group);

  // 6) 地方、路線、小地圖、碰撞、路（接到 V）
  const hudY = (x, z) => heightAt(x, z);
  const places = {
    offroad: { name: '越野車場', pos: [-36, 106], spawn: { x: -30, z: 106, heading: 0 }, zone: { x: -36, z: 106, hx: 12, hz: 9, rot: 0 }, gate: { x: GATE.x, z: GATE.z, heading: 0 } },
    odealer: {
      name: '越野車行', pos: [0, 86],
      display: [{ x: PODIUM.x, z: PODIUM.z, y: 0.06 + PODIUM.h, heading: -0.6, big: true }, { x: -7, z: 86, y: floorY + 0.08, heading: -Math.PI / 2 }, { x: 8, z: 86, y: floorY + 0.08, heading: -Math.PI / 2 }],
      bay: { x: PN.BAY[0], z: PN.BAY[1], hx: 5, hz: 3.8, rot: 0 }, park: { x: PN.BAY[0], z: PN.BAY[1], heading: 0 }, // 車棚下面（路從下面穿過去，車頭朝東）
      exit: { x: 12, z: 106, heading: Math.PI }, spawn: { x: 12, z: 106, heading: Math.PI }, // 買了新車：停在車棚西邊，車頭朝大門（開回家）
      zone: { x: PN.BAY[0], z: PN.BAY[1], hx: 12, hz: 8, rot: 0 },
      view: { pos: [-13, 3.4, 103], look: [-24, 0.9, 89], fov: 58 },
    },
    orace: { name: '越野賽起跑區', pos: [134, 90], zone: { x: 134, z: 90, hx: 16, hz: 6, rot: 0 }, start: { x: GRID[0][0], z: GRID[0][1], heading: 0 }, grid: GRID.map(([x, z]) => ({ x, z, heading: 0 })), spawn: { x: 112, z: 90, heading: 0 } },
  };
  Object.assign(V.places, places);
  for (const c of colliders) V.colliders.push(c);
  V.roads.push({ pts: ACCESS.map((p) => p.slice()), w: 6, kind: 'farm', noNpc: true }); // noNpc：路上的車、居民（npc.js）不走這條（盡頭是越野車場大門：車開到底會停在門口擋路）
  const prevDraw = V.mapDraw;
  V.mapDraw = (gg) => {
    if (prevDraw) prevDraw(gg);
    gg.save(); gg.lineCap = 'round'; gg.lineJoin = 'round';
    gg.fillStyle = 'rgba(176,140,90,0.16)'; polyPath(gg, FENCE, true); gg.fill();
    gg.fillStyle = 'rgba(232,210,160,0.55)'; gg.fillRect(SAND.x0, SAND.z0, SAND.x1 - SAND.x0, SAND.z1 - SAND.z0);
    gg.fillStyle = 'rgba(150,146,140,0.65)'; gg.fillRect(ROCK.x0, ROCK.z0, ROCK.x1 - ROCK.x0, ROCK.z1 - ROCK.z0);
    gg.fillStyle = 'rgba(96,70,44,0.85)'; gg.beginPath(); gg.ellipse(PIT.x, PIT.z, PIT.rx, PIT.rz, 0, 0, TAU); gg.fill();
    gg.strokeStyle = 'rgba(214,180,138,0.95)'; gg.lineWidth = 12; coursePath(gg); gg.stroke();
    gg.strokeStyle = 'rgba(200,170,130,0.8)'; gg.lineWidth = 5; polyPath(gg, TRAIL, true); gg.stroke(); polyPath(gg, PADDOCK_P, false); gg.stroke();
    gg.fillStyle = 'rgba(201,205,212,0.75)'; for (const [a, b, c, d] of GRAVEL_R) gg.fillRect(a, b, c - a, d - b);
    gg.strokeStyle = 'rgba(201,205,212,0.75)'; gg.lineWidth = 6; for (const p of GRAVEL_P) { polyPath(gg, p, false); gg.stroke(); }
    gg.fillStyle = 'rgba(206,210,218,0.6)'; gg.fillRect(-18, 78, 36, 16);
    gg.strokeStyle = '#f2f3f5'; gg.lineWidth = 2; gg.beginPath(); gg.moveTo(150, 83); gg.lineTo(150, 97); gg.stroke();
    gg.restore();
  };
  if (V.bounds) V.bounds.x1 = Math.max(V.bounds.x1, 380); // 小地圖畫到 x 530（drive.js 的 mapLayer 會多加 150）

  // 路線：越野車場裡（小路網）、新的水泥路、村子的路（village.js 的 route，照舊）
  // 新的水泥路接農路兩個地方：東邊（農路 x −112 那段直直往南）、南邊（農路 z 58 那段往東開到轉角，右轉往南）
  const route0 = V.route;
  const farm = V.roads.find((r) => { const a = r.pts[0], b = r.pts[r.pts.length - 1]; return r.kind === 'farm' && Math.hypot(a[0] + 250, a[1]) < 1 && Math.hypot(b[0] + 112, b[1]) < 1; }) || null; // village.js 的水泥農路（C (−250, 0) → 南 → 東 → 北 → E1 (−112, 0)）
  const join = (...rs) => { const pts = []; for (const r of rs) for (const p of r.pts || r) { const q = pts[pts.length - 1]; if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.05) pts.push([p[0], p[1]]); } return { pts, len: plen(pts) }; };
  const proj = (pts, x, z) => { // 投影到折線：{ d, i（第 i 段：pts[i−1] → pts[i]）, q, s（從頭算的長度）}
    let bd = Infinity, bi = 1, bq = pts[0], bs = 0, acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(x - qx, z - qz);
      if (d < bd) { bd = d; bi = i; bq = [qx, qz]; bs = acc + Math.sqrt(l2) * t; }
      acc += Math.sqrt(l2);
    }
    return { d: bd, i: bi, q: bq, s: bs };
  };
  const tail = (pts, pr) => [pr.q, ...pts.slice(pr.i)]; // 從投影點沿著折線走到底
  const ACC_E = ACCESS, ACC_W = join(roundPoly([[-125, 58], [-112, 58], [-112, 74]], 6, 5), ACCESS.filter((p) => p[1] > 74)).pts; // 東邊來的、南邊來的（都到大門）
  const ACC_ER = ACC_E.slice().reverse(), ACC_WR = ACC_W.slice().reverse();
  function parkPath(x, z, tgt) { // 越野車場裡：先走到最近的一段小路，再照小路網（Dijkstra）走到 tgt
    let best = null;
    for (const [a, b] of PE) { const A = PN[a], Bn = PN[b], d = segD(x, z, A[0], A[1], Bn[0], Bn[1]); if (!best || d < best.d) best = { a, b, d }; }
    const A = PN[best.a], Bn = PN[best.b], dx = Bn[0] - A[0], dz = Bn[1] - A[1], t = clamp(((x - A[0]) * dx + (z - A[1]) * dz) / (dx * dx + dz * dz), 0, 1), q = [A[0] + dx * t, A[1] + dz * t];
    const dist = { [best.a]: Math.hypot(A[0] - q[0], A[1] - q[1]), [best.b]: Math.hypot(Bn[0] - q[0], Bn[1] - q[1]) }, prev = {}, done = new Set();
    for (;;) {
      let u = null; for (const k in dist) if (!done.has(k) && (u == null || dist[k] < dist[u])) u = k;
      if (u == null) break; done.add(u);
      for (const [a, b] of PE) for (const [f, t2] of [[a, b], [b, a]]) {
        if (f !== u) continue; const nd = dist[u] + Math.hypot(PN[t2][0] - PN[f][0], PN[t2][1] - PN[f][1]);
        if (dist[t2] == null || nd < dist[t2]) { dist[t2] = nd; prev[t2] = f; }
      }
    }
    const chain = [tgt]; while (prev[chain[0]]) chain.unshift(prev[chain[0]]);
    return join([[x, z], q], chain.map((k) => PN[k]));
  }
  const best = (list) => list.filter((r) => r.pts.length > 1).reduce((a, b) => (!a || b.len < a.len ? b : a), null) || { pts: [[0, 0]], len: 0 };
  function toGate(x, z) { // 村子 → 越野車場大門（沿著路）
    if (onAccess(x, z)) return join([[x, z]], tail(ACC_E, proj(ACC_E, x, z)));
    if (!farm) return join(route0(x, z, 'E1').pts, ACC_E);
    const F = farm.pts, rE = route0(x, z, 'E1'), q1 = rE.pts[1] || rE.pts[0];
    if (proj(F, q1[0], q1[1]).d < 0.05) { // village.js 也是投影到農路：沿著農路開到接新路的地方（不回頭）
      const pf = proj(F, x, z), w = proj(F, -125, 58), e = proj(F, -112, 44);
      if (pf.s <= w.s + 0.5) return join([[x, z], pf.q], F.slice(pf.i, w.i), ACC_W); // 南邊那段往東開
      if (pf.s >= e.s - 0.5) return join([[x, z], pf.q], ACC_E); // 東邊那段往南開
      return join([[x, z]], tail(ACC_E, proj(ACC_E, x, z))); // 在轉角
    }
    const rC = route0(x, z, 'C'), w = proj(F, -125, 58);
    return best([join(rE.pts, ACC_E), join(rC.pts, F.slice(0, w.i), ACC_W)]); // 大路到 E1 往南、或到 C 走農路
  }
  function fromPark(x, z, dest) { // 越野車場／新的路 → 村子的地方
    const inP = inPark(x, z);
    const leadE = inP ? join(parkPath(x, z, 'GATE').pts, ACC_ER) : join([[x, z]], tail(ACC_ER, proj(ACC_ER, x, z)));
    const list = [join(leadE.pts, route0(-112, 44, dest).pts)]; // 東頭 (−112, 44) 往北
    if (farm && (inP || z > 66)) { // 南頭：農路轉角往西（要去西邊才走這條）
      const leadW = inP ? join(parkPath(x, z, 'GATE').pts, ACC_WR) : join([[x, z]], tail(ACC_WR, proj(ACC_WR, x, z)));
      const rW = route0(-125, 58, dest);
      if (rW.pts.slice(1, 4).some((p) => p[0] < -130)) list.push(join(leadW.pts, rW.pts));
    }
    return best(list);
  }
  function cpRoute(x, z) { // 比賽的下一個檢查點：沿著賽道
    const p = V.places.orcp; if (!p) return { pts: [[x, z]], len: 0 };
    const pr = CR.project(x, z);
    if (pr.dist > 25) return { pts: [[x, z], p.pos], len: Math.hypot(x - p.pos[0], z - p.pos[1]) };
    let s1 = p.s; while (s1 < pr.s) s1 += CR.len; if (s1 - pr.s > CR.len - 5) s1 -= CR.len;
    const pts = [[x, z]]; for (let s = pr.s + 4; s < s1; s += 6) { const c = CR.at(s); pts.push([c.x, c.z]); }
    pts.push(p.pos.slice());
    return { pts, len: plen(pts) };
  }
  const inPark = (x, z) => x >= G.x0 && x <= G.x1 && z >= G.z0 && z <= G.z1;
  V.route = (x, z, dest) => {
    const pd = PDEST[dest], inP = inPark(x, z), acc = !inP && onAccess(x, z);
    if (!pd && dest !== 'orcp' && !inP && !acc) return route0(x, z, dest); // 村子裡去村子的地方：完全照舊
    if (dest === 'orcp') return cpRoute(x, z);
    if (pd) return inP ? parkPath(x, z, pd) : join(toGate(x, z).pts, parkPath(PN.GATE[0], PN.GATE[1], pd).pts);
    return fromPark(x, z, dest);
  };
  V.surfaceAt = surfaceAt; V.heightAt = heightAt; V.normalAt = normalAt; V.terrainAt = terrainAt;
  const info = { meshes: 3 + 2 + bp.meshes + (apron ? 1 : 0), tris: terrTris + B.tris + ACCESS.length * 4 + apron, terrainTris: terrTris, props: B.tris, ms: 0 };
  if (V.info) V.info.offroad = info;
  const P = {
    group, places, course: CR, checkpoints: cps, grid: GRID.map(([x, z]) => ({ x, z, heading: 0 })), fenceDist, inPark, heightAt, normalAt, surfaceAt, info, trees: trees.length, rocks: ROCKS.length,
    show: { x0: SHOW.x0, x1: SHOW.x1, z0: SHOW.z0, z1: SHOW.z1, cx: (SHOW.x0 + SHOW.x1) / 2, cz: SHOW.z, ramp: [SHOW.rx0, SHOW.rtop, SHOW.rx1, SHOW.h], cars: SHOW_CARS }, // 第 7 批（輾扁）：表演場（crush.js 照這個擺垃圾車）
    dispose() {
      group.removeFromParent();
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const m of [...Object.values(mats), terrMat, ...accMats, apronMat]) if (m) m.dispose(); // 村子草地那條（apronMat）的貼圖是村子的：不要丟
      for (const t of [tPaint, tRough, tSign, tDetail]) t.dispose();
    },
  };
  V.offroad = P;
  const d0 = V.dispose; V.dispose = function () { P.dispose(); return d0.apply(this, arguments); };
  info.ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - T0);
  void hudY;
  return P;
}

// ---- 招牌（一張 1024×1024）----
const SIGNS = {
  gateW: '越野車場', gateE: '歡迎再來', dealer: '越野車行', dealerSub: '越野車 · 零件 · 改裝', sf: '起點 · 終點', board: '越野賽', lap: '圈', prize: '獎金', wan: '萬',
  cp: '檢查點', jump: '跳台', mud: '泥巴池', rock: '攀岩區', sand: '沙丘', park: '停車場', buy: '買車區', booth: '報名處',
};
const OFFROAD_TEXT = [...new Set([...Object.values(SIGNS).join(''), ...OFFROAD_RACES.map((r) => r.name + r.opps.map((o) => o.name).join('')).join('')].filter((ch) => ch.charCodeAt(0) > 0x2e80))].join('');
function offroadFonts(ms = 1500) {
  const f = typeof document !== 'undefined' && document.fonts;
  if (!f || !f.load) return Promise.resolve();
  const all = Promise.all([f.load(`700 64px ${SANS}`, OFFROAD_TEXT), f.load(`700 64px ${COND}`, '0123456789 ')]).catch(() => {});
  return Promise.race([all, new Promise((r) => setTimeout(r, ms))]);
}
const dotUV = (r) => { const u = (r[0] + r[2]) / 2, v = (r[1] + r[3]) / 2; return [u, v, u, v]; };
function detailTex(R) { // 地面的細節（256×256 灰階，一格 3.2 公尺）：小點點（草、小石頭）、細的刮痕；平均剛好 0.5（乘 2 以後亮度不變）；直接算像素（不用 canvas 讀回來，手機快）
  const N = 256, L = new Float32Array(N * N).fill(0.5);
  const dab = (x0, y0, w, h, v) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) L[((y + N) % N) * N + ((x + N) % N)] += v; };
  for (let i = 0; i < 2600; i++) dab((R() * N) | 0, (R() * N) | 0, 1 + ((R() * 2.4) | 0), 1 + ((R() * 2.4) | 0), (R() < 0.5 ? 1 : -1) * (0.08 + R() * 0.11));
  for (let i = 0; i < 90; i++) { const x = R() * N, y = R() * N, a = R() * TAU, l = 4 + R() * 9, v = (i % 2 ? 1 : -1) * 0.07; for (let t = 0; t < l; t += 0.7) dab((x + Math.cos(a) * t) | 0, (y + Math.sin(a) * t) | 0, 1, 1, v); }
  let sum = 0; for (let i = 0; i < L.length; i++) sum += L[i];
  const off = 0.5 - sum / L.length, px = new Uint8Array(N * N * 4);
  for (let i = 0; i < L.length; i++) { const v = clamp(Math.round((L[i] + off) * 255), 0, 255); px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v; px[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(px, N, N, THREE.RGBAFormat); // 資料貼圖（不是顏色）：不轉 sRGB
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
function signAtlas() {
  const W = 1024, H = 1024, [c, g] = cv(W, H), uv = {};
  const reg = (name, x, y, w, h, draw) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); draw(g, w, h); g.restore(); uv[name] = [(x + 0.5) / W, 1 - (y + h - 0.5) / H, (x + w - 0.5) / W, 1 - (y + 0.5) / H]; };
  const rr = (g2, x, y, w, h, r) => { g2.beginPath(); g2.roundRect(x, y, w, h, r); };
  const T = (g2, t, x, y, px, col, max, al = 'center', fam = SANS) => { g2.fillStyle = col; g2.textAlign = al; g2.textBaseline = 'middle'; fitFont(g2, t, max, px, fam); g2.fillText(t, x, y); };
  const arrow = (g2, cx, cy, s, dir, col) => { // 粗箭頭：R 右、L 左、U 上
    g2.save(); g2.translate(cx, cy); g2.rotate(dir === 'R' ? 0 : dir === 'L' ? Math.PI : -Math.PI / 2); g2.fillStyle = col;
    g2.beginPath(); g2.moveTo(s, 0); g2.lineTo(0.1 * s, -0.75 * s); g2.lineTo(0.1 * s, -0.3 * s); g2.lineTo(-s, -0.3 * s); g2.lineTo(-s, 0.3 * s); g2.lineTo(0.1 * s, 0.3 * s); g2.lineTo(0.1 * s, 0.75 * s); g2.closePath(); g2.fill(); g2.restore();
  };
  const brown = (g2, w, h, r = 14) => { g2.fillStyle = '#f1e7d6'; rr(g2, 0, 0, w, h, r); g2.fill(); g2.fillStyle = '#6b3f1f'; rr(g2, 6, 6, w - 12, h - 12, r - 4); g2.fill(); };
  const mudTrim = (g2, w, h) => { g2.fillStyle = '#e58a2b'; for (let x = 0; x < w; x += 22) { g2.beginPath(); g2.arc(x + 11, h - 6, 9, Math.PI, 0); g2.fill(); } };
  reg('white', 1000, 1000, 24, 24, (g2, w, h) => { g2.fillStyle = '#fff'; g2.fillRect(0, 0, w, h); });
  reg('gateW', 0, 0, 1024, 160, (g2, w, h) => {
    g2.fillStyle = '#4a2f18'; g2.fillRect(0, 0, w, h); g2.strokeStyle = '#e58a2b'; g2.lineWidth = 10; g2.strokeRect(8, 8, w - 16, h - 16);
    g2.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 40; x < w; x += 70) { g2.fillRect(x, 20, 26, 6); g2.fillRect(x + 10, h - 30, 26, 6); } // 輪胎痕
    g2.lineWidth = 8; g2.strokeStyle = '#2a1a0c'; g2.font = `700 ${fitFont(g2, SIGNS.gateW, w - 140, 118)}px ${SANS}`; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.strokeText(SIGNS.gateW, w / 2, h / 2 + 4);
    T(g2, SIGNS.gateW, w / 2, h / 2 + 4, 118, '#ffd23f', w - 140);
  });
  reg('gateE', 0, 160, 1024, 128, (g2, w, h) => { g2.fillStyle = '#4a2f18'; g2.fillRect(0, 0, w, h); g2.strokeStyle = '#e58a2b'; g2.lineWidth = 8; g2.strokeRect(6, 6, w - 12, h - 12); T(g2, SIGNS.gateE, w / 2, h / 2 + 3, 92, '#f2f3f5', w - 160); });
  reg('sf', 0, 288, 1024, 128, (g2, w, h) => {
    g2.fillStyle = '#c8322a'; g2.fillRect(0, 0, w, h);
    for (const x0 of [0, w - 180]) for (let r = 0; r < 4; r++) for (let q = 0; q < 6; q++) { g2.fillStyle = (r + q) % 2 ? '#f2f3f5' : '#17181b'; g2.fillRect(x0 + q * 30, r * 32, 30, 32); }
    T(g2, SIGNS.sf, w / 2, h / 2 + 3, 96, '#ffffff', w - 420);
  });
  reg('dealer', 0, 416, 640, 128, (g2, w, h) => { g2.fillStyle = '#e58a2b'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#2a1a0c'; g2.fillRect(0, h - 12, w, 12); T(g2, SIGNS.dealer, w / 2, 50, 76, '#2a1a0c', w - 60); T(g2, SIGNS.dealerSub, w / 2, 100, 26, '#4a2f18', w - 80); });
  reg('board', 640, 416, 384, 256, (g2, w, h) => {
    brown(g2, w, h); T(g2, SIGNS.board, w / 2, 38, 44, '#ffd23f', w - 60);
    OFFROAD_RACES.forEach((r, i) => { const y = 92 + i * 58; g2.fillStyle = 'rgba(255,255,255,0.12)'; g2.fillRect(18, y - 24, w - 36, 48); T(g2, r.name, 30, y, 30, '#ffffff', 190, 'left'); T(g2, `${r.laps} ${SIGNS.lap} · ${r.prize} ${SIGNS.wan}`, w - 28, y, 26, '#ffd23f', 150, 'right'); });
  });
  reg('v1', 0, 544, 320, 96, (g2, w, h) => { brown(g2, w, h); T(g2, SIGNS.gateW, w / 2 - 36, h / 2 + 2, 52, '#ffffff', 200); arrow(g2, w - 44, h / 2, 26, 'R', '#ffffff'); });
  reg('v2', 320, 544, 320, 96, (g2, w, h) => { brown(g2, w, h); arrow(g2, 44, h / 2, 26, 'L', '#ffffff'); T(g2, SIGNS.gateW, w / 2 + 36, h / 2 + 2, 52, '#ffffff', 200); });
  reg('v3', 0, 640, 320, 96, (g2, w, h) => { brown(g2, w, h); arrow(g2, 44, h / 2 + 2, 26, 'U', '#ffffff'); T(g2, SIGNS.gateW, w / 2 + 36, h / 2 + 2, 52, '#ffffff', 200); });
  reg('booth', 320, 640, 320, 96, (g2, w, h) => { g2.fillStyle = '#2a1a0c'; g2.fillRect(0, 0, w, h); T(g2, SIGNS.booth, w / 2, h / 2 + 2, 60, '#ffd23f', w - 40); });
  for (let k = 0; k < 5; k++) reg('cp' + (k + 1), 0, 736 + 56 * k, 320, 56, (g2, w, h) => { g2.fillStyle = '#ffcf33'; g2.fillRect(0, 0, w, h); T(g2, `${SIGNS.cp} ${k + 1}`, w / 2, h / 2 + 2, 40, '#16181c', w - 30); });
  ['jump', 'mud', 'rock', 'sand', 'park', 'buy'].forEach((k, i) => reg(k, 320 + 224 * (i % 3), 736 + 104 * Math.floor(i / 3), 224, 104, (g2, w, h) => { brown(g2, w, h, 12); mudTrim(g2, w, h); T(g2, SIGNS[k], w / 2, h / 2 - 2, 50, '#ffffff', w - 30); }));
  reg('chev', 320, 944, 224, 72, (g2, w, h) => { g2.fillStyle = '#ffcf33'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#16181c'; for (let k = 0; k < 3; k++) { const x = 40 + k * 60; g2.beginPath(); g2.moveTo(x, 10); g2.lineTo(x + 30, h / 2); g2.lineTo(x, h - 10); g2.lineTo(x + 18, h - 10); g2.lineTo(x + 48, h / 2); g2.lineTo(x + 18, 10); g2.closePath(); g2.fill(); } });
  return { c, uv };
}

// ---- 合併網格（同材質、x 方向同一格的三角形放一起）----
class PB {
  constructor(ch) { this.ch = ch; this.bins = new Map(); this.k = 0; this.tris = 0; }
  at(x) { this.k = Math.floor(x / this.ch); return this; }
  tri(m, a, b, c, col, ta, tb, tc) {
    const key = m + '|' + this.k; let g = this.bins.get(key);
    if (!g) this.bins.set(key, (g = { m, p: [], n: [], u: [], c: [] }));
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-12) return;
    nx /= l; ny /= l; nz /= l;
    g.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); g.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz); g.c.push(...col, ...col, ...col);
    if (ta) g.u.push(ta[0], ta[1], tb[0], tb[1], tc[0], tc[1]); else g.u.push(0, 0, 0, 0, 0, 0);
    this.tris++;
  }
  quad(m, a, b, c, d, col, uv) { if (uv) { const [u0, v0, u1, v1] = uv; this.tri(m, a, b, c, col, [u0, v0], [u1, v0], [u1, v1]); this.tri(m, a, c, d, col, [u0, v0], [u1, v1], [u0, v1]); } else { this.tri(m, a, b, c, col); this.tri(m, a, c, d, col); } }
  build(mats, tag) {
    const group = new THREE.Group(); let n = 0;
    for (const g of this.bins.values()) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3));
      if (mats[g.m].map) geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.u, 2));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mats[g.m]); mesh.matrixAutoUpdate = false; mesh.name = tag + g.m; group.add(mesh); n++;
    }
    return { group, meshes: n };
  }
}
// 本地座標框：原點 (x, y, z)、繞 y 轉 ry（本地 +x → (cos, 0, −sin)，跟 three.js 一樣）
function frame(x, y, z, ry = 0) { const c = Math.cos(ry), n = Math.sin(ry); return { x, y, z, ry, p: (lx, ly, lz) => [x + lx * c + lz * n, y + ly, z - lx * n + lz * c] }; }
const ICO = (() => { // 二十面體（樹冠、石頭）；細分一次＝80 面
  const t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return p.map((q) => q / l); });
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const v1 = v.map((p) => p.slice()), mid = new Map(), f1 = [];
  const m = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (mid.has(k)) return mid.get(k); const p = [(v1[a][0] + v1[b][0]) / 2, (v1[a][1] + v1[b][1]) / 2, (v1[a][2] + v1[b][2]) / 2], l = Math.hypot(...p); v1.push(p.map((q) => q / l)); mid.set(k, v1.length - 1); return v1.length - 1; };
  for (const [a, b, c] of f) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); f1.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
  return [{ v, f }, { v: v1, f: f1 }];
})();

// ---- 對手的車（沙灘車、越野卡車、拉力車）：程式做的卡通車，平面著色、頂點色 ----
// 車子座標：x 往前、y 往上、z 往右；原點在地上（前後輪中間）；hub 順序 [左前, 右前, 左後, 右後]（跟 buildCar 一樣）
const RACER = {
  buggy: { xf: 1.2, xr: -1.15, RF: 0.36, RR: 0.42, tf: 0.8, tr: 0.84, wf: 0.28, wr: 0.36, vtop: 31, alat: 8.2, acc: 5.0, brk: 7.0, mud: 13 },
  truck: { xf: 1.85, xr: -1.85, RF: 0.5, RR: 0.5, tf: 0.98, tr: 0.98, wf: 0.42, wr: 0.42, vtop: 33, alat: 7.4, acc: 4.4, brk: 6.5, mud: 15 },
  rally: { xf: 1.32, xr: -1.28, RF: 0.34, RR: 0.34, tf: 0.8, tr: 0.8, wf: 0.25, wr: 0.25, vtop: 34, alat: 8.0, acc: 4.8, brk: 7.5, mud: 11 },
};
// 輪子（半徑 1、寬 1、軸沿 z）：胎面、胎壁、輪框
const WHEEL_TRIS = (() => {
  const out = [], n = 12, TREAD = C('#27282b'), WALL = C('#323336'), RIM = C('#c9ccd1'), HUBC = C('#6b6f76');
  const P = (a, r, z) => [Math.cos(a) * r, Math.sin(a) * r, z];
  const push = (a, b, c, col, want) => { // 照想要的法線方向排順序
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    out.push(nx * want[0] + ny * want[1] + nz * want[2] >= 0 ? [a, b, c, col] : [a, c, b, col]);
  };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, b = ((i + 1) / n) * TAU, m = (a + b) / 2, out0 = [Math.cos(m), Math.sin(m), 0];
    push(P(a, 1, -0.5), P(b, 1, -0.5), P(b, 1, 0.5), TREAD, out0); push(P(a, 1, -0.5), P(b, 1, 0.5), P(a, 1, 0.5), TREAD, out0);
    for (const s of [-1, 1]) {
      const w = [0, 0, s];
      push(P(a, 0.62, s * 0.5), P(b, 0.62, s * 0.5), P(b, 1, s * 0.5), WALL, w); push(P(a, 0.62, s * 0.5), P(b, 1, s * 0.5), P(a, 1, s * 0.5), WALL, w);
      push([0, 0, s * 0.42], P(a, 0.62, s * 0.5), P(b, 0.62, s * 0.5), i % 3 === 0 ? HUBC : RIM, w);
    }
  }
  return out;
})();
function racerParts(style, paint) {
  const D = RACER[style] || RACER.buggy, tris = [], dark = C('#26282c'), glass = C('#1d2733'), white = C('#f2f3f5'), yellow = C('#ffd23f'), grey = C('#50545b'), chrome = C('#c9ccd1'), black = C('#141517');
  const e = (a, b, c, col) => tris.push([a, b, c, col]);
  const q = (a, b, c, d, col) => { e(a, b, c, col); e(a, c, d, col); };
  const hexa = (b0, b1, b2, b3, t0, t1, t2, t3, col) => { q(t3, t2, t1, t0, col); q(b3, b2, t2, t3, col); q(b1, b0, t0, t1, col); q(b2, b1, t1, t2, col); q(b0, b3, t3, t0, col); q(b0, b1, b2, b3, mul(col, 0.6)); };
  const box = (x0, y0, z0, x1, y1, z1, col) => hexa([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], col);
  const both = (f) => { f(1); f(-1); }; // 左右各一個（s＝1 右邊）
  const bar = (a, b, r, col) => { // 兩點之間的方管
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d), dn = d.map((x) => x / L), up = Math.abs(dn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let e1 = [dn[1] * up[2] - dn[2] * up[1], dn[2] * up[0] - dn[0] * up[2], dn[0] * up[1] - dn[1] * up[0]]; const l1 = Math.hypot(...e1); e1 = e1.map((x) => x / l1);
    const e2 = [dn[1] * e1[2] - dn[2] * e1[1], dn[2] * e1[0] - dn[0] * e1[2], dn[0] * e1[1] - dn[1] * e1[0]];
    const o = (k) => { const t = (k * Math.PI) / 2 + Math.PI / 4, c = Math.cos(t) * r, s = Math.sin(t) * r; return [e1[0] * c + e2[0] * s, e1[1] * c + e2[1] * s, e1[2] * c + e2[2] * s]; };
    for (let k = 0; k < 4; k++) { const p = o(k), n2 = o(k + 1); q([a[0] + p[0], a[1] + p[1], a[2] + p[2]], [a[0] + n2[0], a[1] + n2[1], a[2] + n2[2]], [b[0] + n2[0], b[1] + n2[1], b[2] + n2[2]], [b[0] + p[0], b[1] + p[1], b[2] + p[2]], col); }
  };
  if (style === 'truck') {
    box(-2.5, 0.55, -0.55, 2.4, 0.78, 0.55, dark);
    hexa([1.1, 0.75, -0.95], [2.6, 0.8, -0.9], [2.6, 0.8, 0.9], [1.1, 0.75, 0.95], [1.1, 1.35, -0.95], [2.55, 1.15, -0.85], [2.55, 1.15, 0.85], [1.1, 1.35, 0.95], paint);
    box(-0.8, 0.75, -0.95, 1.1, 1.35, 0.95, paint);
    hexa([-0.75, 1.35, -0.88], [1.05, 1.35, -0.88], [1.05, 1.35, 0.88], [-0.75, 1.35, 0.88], [-0.7, 2.0, -0.78], [0.35, 2.0, -0.78], [0.35, 2.0, 0.78], [-0.7, 2.0, 0.78], glass);
    box(-0.74, 1.98, -0.81, 0.4, 2.07, 0.81, paint);
    box(-2.65, 0.75, -0.95, -0.8, 0.95, 0.95, paint); both((s) => box(-2.65, 0.95, s > 0 ? 0.87 : -0.95, -0.8, 1.35, s > 0 ? 0.95 : -0.87, paint)); box(-2.65, 0.95, -0.95, -2.57, 1.35, 0.95, paint);
    both((s) => { box(1.2, 1.0, s > 0 ? 0.9 : -1.2, 2.45, 1.14, s > 0 ? 1.2 : -0.9, mul(paint, 0.7)); box(-2.45, 1.0, s > 0 ? 0.9 : -1.2, -1.2, 1.14, s > 0 ? 1.2 : -0.9, mul(paint, 0.7)); });
    box(0.0, 2.07, -0.72, 0.22, 2.2, 0.72, dark); for (let k = 0; k < 4; k++) box(0.22, 2.09, -0.62 + k * 0.36, 0.25, 2.18, -0.42 + k * 0.36, yellow);
    box(2.55, 0.55, -0.9, 2.78, 0.86, 0.9, dark); box(-2.88, 0.6, -0.9, -2.65, 0.86, 0.9, dark);
    both((s) => { bar([-1.0, 1.35, s * 0.85], [-1.3, 2.1, s * 0.6], 0.04, chrome); box(2.56, 0.98, s > 0 ? 0.45 : -0.75, 2.61, 1.12, s > 0 ? 0.75 : -0.45, yellow); box(-0.3, 0.82, s > 0 ? 0.95 : -0.965, 0.6, 1.25, s > 0 ? 0.965 : -0.95, white); });
    bar([-1.3, 2.1, -0.6], [-1.3, 2.1, 0.6], 0.04, chrome);
  } else if (style === 'rally') {
    hexa([-2.05, 0.3, -0.88], [2.05, 0.32, -0.8], [2.05, 0.32, 0.8], [-2.05, 0.3, 0.88], [-2.0, 0.95, -0.9], [1.95, 0.8, -0.82], [1.95, 0.8, 0.82], [-2.0, 0.95, 0.9], paint);
    hexa([-1.7, 0.95, -0.84], [0.75, 0.88, -0.84], [0.75, 0.88, 0.84], [-1.7, 0.95, 0.84], [-1.45, 1.45, -0.7], [-0.05, 1.45, -0.7], [-0.05, 1.45, 0.7], [-1.45, 1.45, 0.7], glass);
    box(-1.47, 1.43, -0.72, -0.03, 1.5, 0.72, paint); box(-0.7, 1.5, -0.12, -0.35, 1.58, 0.12, dark);
    box(-2.12, 1.28, -0.78, -1.8, 1.34, 0.78, paint); both((s) => bar([-1.95, 0.95, s * 0.55], [-1.97, 1.28, s * 0.55], 0.025, dark));
    both((s) => { box(-1.72, 0.08, s > 0 ? 0.6 : -0.95, -1.68, 0.45, s > 0 ? 0.95 : -0.6, black); box(0.9, 0.1, s > 0 ? 0.62 : -0.92, 0.94, 0.4, s > 0 ? 0.92 : -0.62, black); box(-0.6, 0.45, s > 0 ? 0.9 : -0.915, 0.3, 0.85, s > 0 ? 0.915 : -0.9, white); });
    box(2.02, 0.25, -0.82, 2.2, 0.5, 0.82, dark); box(-2.2, 0.25, -0.86, -2.02, 0.5, 0.86, dark);
    box(1.95, 0.72, -0.52, 2.08, 0.86, 0.52, dark); for (let k = 0; k < 4; k++) box(2.08, 0.74, -0.46 + k * 0.25, 2.11, 0.84, -0.3 + k * 0.25, yellow);
  } else { // buggy
    box(-1.5, 0.32, -0.5, 1.35, 0.46, 0.5, dark);
    hexa([1.0, 0.4, -0.5], [1.9, 0.4, -0.45], [1.9, 0.4, 0.45], [1.0, 0.4, 0.5], [1.0, 0.75, -0.45], [1.75, 0.62, -0.38], [1.75, 0.62, 0.38], [1.0, 0.75, 0.45], paint);
    both((s) => box(-0.9, 0.42, s > 0 ? 0.5 : -0.8, 0.7, 0.72, s > 0 ? 0.8 : -0.5, paint));
    box(-1.62, 0.44, -0.42, -0.85, 1.0, 0.42, grey); box(-1.3, 1.0, -0.15, -1.0, 1.2, 0.15, chrome);
    box(-0.55, 0.44, -0.28, -0.05, 0.62, 0.28, black); box(-0.72, 0.44, -0.28, -0.52, 1.15, 0.28, black);
    const cage = white;
    both((s) => {
      bar([0.55, 0.45, s * 0.5], [0.3, 1.45, s * 0.45], 0.035, cage); bar([-0.8, 0.45, s * 0.5], [-0.75, 1.45, s * 0.45], 0.035, cage);
      bar([0.3, 1.45, s * 0.45], [-0.75, 1.45, s * 0.45], 0.035, cage); bar([0.55, 0.45, s * 0.5], [1.4, 0.7, s * 0.35], 0.035, cage); bar([-0.75, 1.45, s * 0.45], [-1.5, 0.95, s * 0.35], 0.035, cage);
      box(0.3, 1.3, s > 0 ? 0.15 : -0.35, 0.37, 1.42, s > 0 ? 0.35 : -0.15, yellow);
    });
    bar([0.3, 1.45, -0.45], [0.3, 1.45, 0.45], 0.035, cage); bar([-0.75, 1.45, -0.45], [-0.75, 1.45, 0.45], 0.035, cage); bar([-1.72, 0.55, -0.6], [-1.72, 0.55, 0.6], 0.04, cage);
    box(1.2, 0.66, -0.22, 1.55, 0.72, 0.22, white);
  }
  let x0 = Infinity, x1 = -Infinity; for (const t of tris) for (const p of t.slice(0, 3)) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
  const wheels = [[D.xf, D.RF, -D.tf, D.wf], [D.xf, D.RF, D.tf, D.wf], [D.xr, D.RR, -D.tr, D.wr], [D.xr, D.RR, D.tr, D.wr]].map(([x, R, z, w]) => ({ x, R, z, w }));
  x0 = Math.min(x0, D.xr - D.RR); x1 = Math.max(x1, D.xf + D.RF);
  const halfW = Math.max(D.tf + D.wf / 2, D.tr + D.wr / 2, 0.9);
  return { tris, wheels, D, info: { nose: x1, tail: x0, len: x1 - x0, halfW, wheelbase: D.xf - D.xr, xr: D.xr, CX: (x0 + x1) / 2 } };
}
let RMAT = null, WGEO = null;
const racerMat = () => (RMAT ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.08 }));
const trisGeo = (tris) => {
  const P = [], N = [], Cc = [];
  for (const [a, b, c, col] of tris) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    P.push(...a, ...b, ...c); N.push(nx, ny, nz, nx, ny, nz, nx, ny, nz); Cc.push(...col, ...col, ...col);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.computeBoundingSphere();
  return g;
};
const wheelGeo = () => (WGEO ||= trisGeo(WHEEL_TRIS));
// 一台對手的車：{ car, body, wheels（放輪子的空物件；上一層是 hub）, spec: { wheels }, info, D, dispose }
function makeOffroadRacer(style, color, o = {}) {
  const rp = racerParts(style, C(color)), D = rp.D;
  const car = new THREE.Group(), body = new THREE.Group(); car.name = 'or-racer'; car.add(body);
  const mesh = new THREE.Mesh(trisGeo(rp.tris), racerMat()); mesh.name = 'or-racer-body'; body.add(mesh);
  const wheels = rp.wheels.map((w) => {
    const hub = new THREE.Object3D(); hub.position.set(w.x, w.R, w.z); car.add(hub);
    const wh = o.meshWheels ? new THREE.Mesh(wheelGeo(), racerMat()) : new THREE.Object3D(); wh.scale.set(w.R, w.R, w.w); hub.add(wh);
    return wh;
  });
  return {
    car, body, wheels, D, info: rp.info, style,
    spec: { wheels: { xf: D.xf, xr: D.xr, R: D.RF, RF: D.RF, RR: D.RR, trackF: D.tf, trackR: D.tr } },
    dispose() { car.removeFromParent(); mesh.geometry.dispose(); },
  };
}

// ---- 比賽 ----
const RCSS = `
.orr{position:absolute;inset:0;pointer-events:none;z-index:4;color:#F2F3F5;font-family:${SANS};-webkit-user-select:none;user-select:none}
.orr[hidden],.orr [hidden]{display:none!important}
.orr-p{position:absolute;top:58px;left:10px;min-width:132px;padding:8px 12px 9px;border-radius:16px;background:rgba(14,15,18,0.66);line-height:1.25}
.orr-p b{display:block;font-size:24px;font-weight:700;letter-spacing:.02em}
.orr-p span{display:block;font-size:14px;font-weight:600;color:#DADDE2}
.orr-p ol{margin:6px 0 0;padding:0 0 0 18px;font-size:13px;color:#C6CAD1}
.orr-p ol li.me{color:#FF9A4D;font-weight:700}
.orr-p button{margin-top:7px;padding:5px 12px;border:0;border-radius:999px;background:rgba(255,255,255,0.14);color:#F2F3F5;font:600 13px ${SANS};pointer-events:auto;cursor:pointer}
.orr-c{position:absolute;top:32%;left:50%;transform:translate(-50%,-50%);font:700 96px/1 ${COND},${SANS};color:#FFD23F;text-shadow:0 5px 0 rgba(0,0,0,0.35);white-space:nowrap}
.orr-c.go{font-size:64px;color:#3DDC84}
.orr-r{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(330px,calc(100% - 32px));box-sizing:border-box;padding:18px 18px 16px;border-radius:22px;background:rgba(14,15,18,0.88);text-align:center;pointer-events:auto}
.orr-r h3{margin:0 0 4px;font-size:30px}
.orr-r p{margin:4px 0;font-size:16px;line-height:1.35}
.orr-r p.big{font-size:20px;font-weight:700;color:#FFD23F}
.orr-r div{display:flex;gap:10px;justify-content:center;margin-top:12px}
.orr-r button{flex:1;min-height:48px;border:0;border-radius:999px;font:700 18px ${SANS};cursor:pointer}
.orr-r button.a{background:#FF6A1F;color:#1A0F07;box-shadow:0 4px 0 #9E4213}
.orr-r button.b{background:#2B2E35;color:#F2F3F5;box-shadow:0 4px 0 #111216}
`;
const fmtT = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
let SHT = null;
const shadowTex = () => {
  if (SHT) return SHT;
  const [c, g] = cv(64, 64), gr = g.createRadialGradient(32, 32, 4, 32, 32, 31); gr.addColorStop(0, 'rgba(0,0,0,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  SHT = new THREE.CanvasTexture(c); return SHT;
};
function speedProfile(CR, D, skill) { // 對手照賽道算的速度：直線極速、彎道照曲率（側向加速度）、泥巴慢、跳台前面收一點；再往前後算煞車、加速
  const n = CR.n, ds = CR.ds, v = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let m = D.vtop * skill; const k = Math.abs(CR.k[i]); if (k > 1e-4) m = Math.min(m, Math.sqrt((D.alat * skill) / k));
    if (CR.mud[i]) m = Math.min(m, D.mud);
    if (CR.leg[i] === 1 && ((CR.x[i] > 242 && CR.x[i] < 273) || (CR.x[i] > 330 && CR.x[i] < 356))) m = Math.min(m, 24.5);
    if (CR.leg[i] === 2 && CR.x[i] > 256 && CR.x[i] < 280) m = Math.min(m, 20);
    v[i] = m;
  }
  for (let pass = 0; pass < 2; pass++) for (let i = n - 1; i >= 0; i--) { const j = (i + 1) % n; v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * D.brk * ds)); }
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) { const j = (i + n - 1) % n; v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * D.acc * ds)); }
  return v;
}
function createOffroadRace(o) {
  const V = o.world, P = V.offroad, CR = P.course, drv = o.drive, lv = clamp(o.level | 0, 0, OFFROAD_RACES.length - 1), def = OFFROAD_RACES[lv];
  const scene = o.scene, mkRide = o.createRide || null, L = CR.len, CPS = P.checkpoints, NCP = CPS.length;
  const ci = drv.carInfo, pCX = (ci.nose + ci.tail) / 2, pHL = ci.len / 2, pHW = ci.halfW;
  const TMP = {};
  // 對手：從起跑位置 2、3、4 出發；照賽道的速度、左右偏一點（車道），上下交給 terrain.js
  const ais = def.opps.map((od, k) => {
    const R = makeOffroadRacer(od.style, od.color), D = R.D, g = P.grid[k + 1], pr = CR.project(g.x, g.z);
    if (scene) scene.add(R.car);
    const st = { x: g.x, z: g.z, th: 0, v: 0, surf: 5 };
    const ride = mkRide ? mkRide({ S: R, st, info: R.info, perf: { offroad: 1, awd: 1 }, world: V, events: [] }) : null;
    return { od, R, D, st, ride, prof: speedProfile(CR, D, od.skill), p: pr.s - L, d: pr.d, lane0: pr.d > 0 ? 2.2 : -2.2, laneT: pr.d, v: 0, spin: 0, fin: null, dd: 0, hint: pr.i, name: od.name };
  });
  // 輪子：全部一個 InstancedMesh；影子：一個 InstancedMesh
  const wIM = new THREE.InstancedMesh(wheelGeo(), racerMat(), Math.max(1, ais.length * 4)); wIM.frustumCulled = false; wIM.name = 'or-racer-wheels';
  const shGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), shMat = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: 0.8 });
  const sIM = new THREE.InstancedMesh(shGeo, shMat, Math.max(1, ais.length)); sIM.frustumCulled = false; sIM.renderOrder = 1; sIM.name = 'or-racer-shadows';
  if (scene) scene.add(wIM, sIM);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), NV = new THREE.Vector3();
  // 你
  const me = { p: -10, d: 0, v: 0, lapsDone: -1, next: NCP - 1, hint: -1, px: null, pz: null, fin: null, name: '你' };
  let state = 'count', t = 0, count = 3, goT = 0, lastLap = 0, result = null, outT = 0, hudDirty = true, wrongT = 0;
  // HUD
  const hud = (() => {
    if (!o.hudParent || typeof document === 'undefined') return null;
    if (!document.getElementById('orr-style')) { const s = document.createElement('style'); s.id = 'orr-style'; s.textContent = RCSS; document.head.appendChild(s); }
    const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const root = mk('div', 'orr'), panel = mk('div', 'orr-p'), pos = mk('b'), lap = mk('span'), cp = mk('span'), tm = mk('span'), list = mk('ol'), quit = mk('button', null, '放棄比賽'), cd = mk('div', 'orr-c'), res = mk('div', 'orr-r');
    quit.type = 'button'; quit.addEventListener('click', () => abort('quit'));
    panel.append(pos, lap, cp, tm, list, quit); res.hidden = true; root.append(panel, cd, res); o.hudParent.appendChild(root);
    return { root, panel, pos, lap, cp, tm, list, quit, cd, res, last: {} };
  })();
  const setTxt = (k, el, v) => { if (!hud || hud.last[k] === v) return; hud.last[k] = v; el.textContent = v; };
  const toast = (s, ms) => { if (drv && drv.toast) drv.toast(s, ms); };
  function setCp() { // 下一個檢查點：小地圖的路線、光柱
    const c = CPS[me.next];
    V.places.orcp = { name: me.next === NCP - 1 ? (me.lapsDone + 1 >= def.laps ? '終點' : '起終點') : `檢查點 ${me.next + 1}`, pos: [c.x, c.z], s: c.s % L };
    if (drv.setDestination) drv.setDestination('orcp');
  }
  setCp();
  if (drv.setInput) drv.setInput({ throttle: 0, brake: 1, steer: 0 });
  // 名次：先照誰先到終點，再照跑了多遠
  function standings() {
    const all = [me, ...ais];
    return all.slice().sort((a, b) => (a.fin != null && b.fin != null ? a.fin - b.fin : a.fin != null ? -1 : b.fin != null ? 1 : b.p - a.p));
  }
  function crossGate(c, x0, z0, x1, z1) { // 從檢查點前面開到後面（門寬 24 公尺）
    const s0 = (x0 - c.x) * c.tx + (z0 - c.z) * c.tz, s1 = (x1 - c.x) * c.tx + (z1 - c.z) * c.tz;
    if (!(s0 < 0 && s1 >= 0)) return false;
    const k = s0 / (s0 - s1), qx = x0 + (x1 - x0) * k, qz = z0 + (z1 - z0) * k;
    return Math.abs(-(qx - c.x) * c.tz + (qz - c.z) * c.tx) <= 12;
  }
  function playerTick(dt) {
    const tl = drv.telemetry(), x = tl.x + Math.cos(tl.heading) * pCX, z = tl.z - Math.sin(tl.heading) * pCX;
    me.v = tl.v;
    if (me.px != null && state === 'run' && me.fin == null) {
      if (crossGate(CPS[me.next], me.px, me.pz, x, z)) {
        if (me.next === NCP - 1) {
          me.lapsDone++;
          if (me.lapsDone >= def.laps) { me.fin = t; finish(); }
          else { me.next = 0; setCp(); toast(me.lapsDone === def.laps - 1 ? '最後一圈！' : `第 ${me.lapsDone + 1} 圈`, 1400); }
        } else { me.next++; setCp(); toast(`檢查點 ${me.next}/${NCP - 1}`, 900); }
      } else { // 漏掉檢查點：從別的門開過去
        for (let k = 0; k < NCP; k++) if (k !== me.next && crossGate(CPS[k], me.px, me.pz, x, z) && t - wrongT > 3) { wrongT = t; toast(`漏了${me.next === NCP - 1 ? '起終點' : `檢查點 ${me.next + 1}`}，照光柱開回去！`, 2200); }
      }
    }
    me.px = x; me.pz = z;
    const pr = CR.project(x, z, me.hint); me.hint = pr.i;
    const prevS = me.next === 0 ? 0 : CPS[me.next - 1].s, nextS = CPS[me.next].s;
    let s = pr.s; while (s < prevS - L / 2) s += L; while (s > prevS + L / 2) s -= L;
    me.p = me.lapsDone * L + clamp(s, prevS - 5, nextS + 5); me.d = pr.d;
    // 開出越野車場＝不比了
    if (state === 'run' && P.fenceDist(x, z) < -6) { outT += dt; if (outT > 0.5) abort('left'); } else outT = 0;
    return { x, z, th: tl.heading };
  }
  function aiStep(a, h, others) {
    const s = ((a.p % L) + L) % L, i = Math.floor(s / CR.ds) % CR.n;
    let vt = state === 'run' ? a.prof[i] : 0;
    if (a.fin != null) vt = Math.min(vt, 12);
    if (state === 'run' && me.fin == null && o.rubber !== false) vt *= 1 + clamp((me.p - a.p) / 260, -0.07, 0.1); // 你在後面：等你一點；你在前面：追快一點
    // 前面有車：換車道、跟著慢下來
    let lane = a.lane0 * (1 - CR.bm[i]) + 3 * CR.bm[i];
    for (const b of others) {
      if (b === a) continue;
      const gap = b.p - a.p;
      if (gap > 0 && gap < 14 && Math.abs(b.d - a.d) < 2.8) {
        lane = clamp(b.d + (b.d > 0 ? -3.4 : 3.4), -5, 5);
        if (gap < 7 && Math.abs(b.d - a.d) < 2.2) vt = Math.min(vt, Math.max(0, b.v - 0.5));
      }
    }
    a.laneT = lane;
    a.v += clamp(vt - a.v, -a.D.brk * h, a.D.acc * h); if (a.v < 0) a.v = 0;
    a.p += a.v * h;
    const d0 = a.d; a.d += clamp(a.laneT - a.d, -2.4 * h, 2.4 * h); a.dd += ((a.d - d0) / h - a.dd) * (1 - Math.exp(-h * 5)); // 換車道：車頭慢慢轉過去
    const c = CR.at(a.p, TMP);
    a.st.x = c.x - c.tz * a.d; a.st.z = c.z + c.tx * a.d; a.st.v = a.v;
    const thT = Math.atan2(-c.tz, c.tx) - Math.atan2(a.dd, Math.max(6, a.v));
    a.st.th = a.th0 ? a.st.th + clamp(wrapA(thT - a.st.th), -2.4 * h, 2.4 * h) : thT; a.th0 = true; // 車頭最快 2.4 rad/s 轉過去（不會一下子甩頭）
    a.k = c.k;
    if (a.ride) a.ride.step(h);
    if (a.fin == null && a.p >= def.laps * L) a.fin = t;
  }
  function aiPose(a, dt, j) {
    const R = a.R, car = R.car;
    car.position.x = a.st.x; car.position.z = a.st.z;
    const steer = clamp(Math.atan(R.info.wheelbase * (a.k || 0)) + (a.dd || 0) * 0.08, -0.5, 0.5);
    const cx = a.st.x + Math.cos(a.st.th) * R.info.CX, cz = a.st.z - Math.sin(a.st.th) * R.info.CX;
    if (a.ride) a.ride.pose(steer, null, cx, cz); else { car.position.y = V.heightAt ? V.heightAt(a.st.x, a.st.z) : 0; car.rotation.set(0, a.st.th, 0); }
    a.spin += (a.v * dt) / R.D.RR;
    R.wheels.forEach((w, k) => { w.rotation.z = -a.spin * (k < 2 ? R.D.RR / R.D.RF : 1); w.parent.rotation.y = k < 2 ? steer : 0; });
    car.updateMatrixWorld(true);
    R.wheels.forEach((w, k) => wIM.setMatrixAt(j * 4 + k, w.matrixWorld));
    // 影子：貼地、飛高了變小
    const gy = V.heightAt ? V.heightAt(cx, cz) : 0, up = Math.max(0, car.position.y - gy), sc = clamp(1 - up / 6, 0.35, 1), n = V.normalAt ? V.normalAt(cx, cz) : [0, 1, 0];
    NV.set(n[0], n[1], n[2]); Q.setFromUnitVectors(UP, NV); Q2.setFromAxisAngle(UP, a.st.th); Q.multiply(Q2);
    M4.compose(V3.set(cx, gy + 0.05, cz), Q, S3.set((R.info.len + 0.6) * sc, 1, (R.info.halfW * 2 + 0.4) * sc)); sIM.setMatrixAt(j, M4);
  }
  function finish() {
    state = 'done';
    if (drv.setInput) drv.setInput({ throttle: 0, brake: 1, steer: 0 });
    if (drv.setDestination) drv.setDestination(null);
    delete V.places.orcp;
    const place = 1 + ais.filter((a) => a.fin != null && a.fin < me.fin).length, n = ais.length + 1;
    result = { id: def.id, name: def.name, place, n, time: me.fin, won: place === 1, prize: place === 1 ? def.prize : 0, laps: def.laps, level: lv };
    const extra = (o.onFinish && o.onFinish(result)) || {};
    if (hud) {
      const r = hud.res; r.replaceChildren();
      const h = document.createElement('h3'); h.textContent = place === 1 ? '第 1 名！' : `第 ${place} 名`;
      const p1 = document.createElement('p'); p1.textContent = `${def.name} · ${fmtT(me.fin)}`;
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
    if (drv.setDestination) drv.setDestination(null);
    delete V.places.orcp;
    if (hud) hud.root.hidden = true;
    if (o.onAbort) o.onAbort(why || 'quit');
  }
  function update(dt) {
    if (state === 'off') return;
    dt = Math.min(0.1, Math.max(0, +dt || 0)); if (!dt) return;
    if (state === 'count') {
      count -= dt;
      if (count <= 0) { state = 'run'; t = 0; goT = 0.9; if (drv.setInput) drv.setInput(null); }
    } else if (state === 'run') t += dt;
    if (goT > 0) goT -= dt;
    playerTick(dt);
    // 對手：每一步 1/120 秒（跟你的車一樣）
    const others = [me, ...ais], n = Math.max(1, Math.ceil(dt * 120 - 1e-6)), h = dt / n;
    for (let s = 0; s < n; s++) for (const a of ais) aiStep(a, h, others);
    ais.forEach((a, j) => aiPose(a, dt, j));
    wIM.instanceMatrix.needsUpdate = true; sIM.instanceMatrix.needsUpdate = true;
    // 對手的車是會動的碰撞（你撞到會被擋住）
    if (drv.removeColliders) { drv.removeColliders('orai'); drv.addColliders(ais.map((a) => ({ t: 'box', x: a.st.x + Math.cos(a.st.th) * a.R.info.CX, z: a.st.z - Math.sin(a.st.th) * a.R.info.CX, hx: a.R.info.len / 2, hz: a.R.info.halfW, rot: a.st.th, h: 1.6 })), 'orai'); }
    // HUD
    if (hud) {
      const cd = state === 'count' ? String(Math.max(1, Math.ceil(count))) : goT > 0 ? '出發！' : '';
      setTxt('cd', hud.cd, cd); hud.cd.classList.toggle('go', cd === '出發！'); hud.cd.hidden = !cd;
      if (state !== 'done') {
        const order = standings(), pl = order.indexOf(me) + 1;
        setTxt('pos', hud.pos, `第 ${pl} 名 / ${order.length}`);
        setTxt('lap', hud.lap, `第 ${clamp(me.lapsDone + 1, 1, def.laps)}/${def.laps} 圈`);
        setTxt('cp', hud.cp, me.next === NCP - 1 ? (me.lapsDone < 0 ? '開過起點出發' : '回起終點') : `檢查點 ${me.next + 1}/${NCP - 1}`);
        setTxt('tm', hud.tm, fmtT(t));
        const names = order.map((c) => c.name).join('|');
        if (hud.last.names !== names) { hud.last.names = names; hud.list.replaceChildren(...order.map((c) => { const li = document.createElement('li'); li.textContent = c.name; if (c === me) li.className = 'me'; return li; })); }
      }
    }
    void lastLap; void hudDirty;
  }
  function dispose() {
    if (state !== 'off') { if (drv.setInput) drv.setInput(null); if (drv.setDestination) drv.setDestination(null); } // 跑完了（done）也要放開：跑完踩著煞車等你按「開走」
    state = 'off';
    delete V.places.orcp;
    if (drv.removeColliders) drv.removeColliders('orai');
    for (const a of ais) { if (a.ride) a.ride.release(); a.R.dispose(); }
    wIM.removeFromParent(); sIM.removeFromParent(); wIM.dispose(); sIM.dispose(); shGeo.dispose(); shMat.dispose();
    if (hud) hud.root.remove();
  }
  update(1e-6);
  return { update, abort, dispose, standings: () => standings().map((c) => ({ name: c.name, p: c.p, fin: c.fin, me: c === me })), get state() { return state; }, get time() { return t; }, def, level: lv, ais, me, get result() { return result; } };
}

return { buildOffroad, offroadFonts, OFFROAD_TEXT, OFFROAD_RACES, OFFROAD_SOUND, OFFROAD_EYE, createOffroadRace, makeOffroadRacer };
})();
