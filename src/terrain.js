// ---- 地形開車（第 4 批：越野車場）：drive.js 的小幫手（懸吊、跳起來、落地、路面抓地、四輪轉向、大車的追車鏡頭）----
// Nick 2026-09-28 05:37「還有越野車場可以買越野車去開比賽」、07:34「越野車很多台一樣可以買回車庫可自訂外觀 改引擎」
// 世界有高度（world.heightAt，offroad.js 的 buildOffroad 加的）才會用到；村子是平的：一般的車沒開進越野車場，drive.js 完全照舊（一步都不碰）
// 座標跟 drive.js 一樣：x 往東、y 往上、z 往南；車子座標 x＝車頭、z＝右邊；heading＝car.rotation.y
// 【API】
//   const ride = createRide({ S, st, info, perf, world, events })
//     S：buildCar 回傳的車（car、body、wheels（輪子的上一層＝hub）、spec.wheels、spec.susp（怪獸卡車：懸吊＋四輪轉向））
//     st：drive.js 的狀態（這裡只讀 x, z, th, v, surf）；info：{ nose, tail, len, halfW, wheelbase, xr, CX }
//     perf：PERF[key]（offroad: 1＝越野車：四驅、底盤高、越野胎）；world：{ heightAt, normalAt, terrainAt }；events：drive.js 的事件（落地 ['land', e]）
//     extraH(x, z)：第 7 批（輾扁）臨時多出來的高度（crush.js 的墊子：輾過去的東西下面一塊斜坡），可省略
//   ride.on          這一步照地形算（一般的車開進越野車場、還沒停穩；越野車一直是）
//   ride.air         四個輪子、底盤都沒碰到地（飛起來了）
//   ride.k           { trac（起步抓地 ×）, lat（過彎抓地 ×）, ws（方向盤打死的曲率 ×：四輪轉向最多 2）, pivot（車子繞哪一點轉，車子座標 x）, slope, scrape }
//   ride.sf(路面) → 這台車在這種路面的 { cap, drag, over }（null＝照 drive.js 自己的 SURF）
//   ride.speed(un, u, h, sg, stop, go, kA) → 這一步的新速度：飛在空中只剩風阻、上坡慢下坡快、底盤磨到地
//   ride.step(h)     每一個物理步（懸吊、跳、落地）；ride.follow(dt)：自動停車（parkAt）的時候跟著地面
//   ride.pose(vis, shadow, cx, cz)   車子擺上去（高度、前後左右傾、懸吊上下、怪獸卡車四個輪子轉向）；影子貼著地面、飛高變淡
//   ride.cam(dt) → { d, dh, look, y, floor(x, z) }   追車鏡頭：大車拉遠拉高、鏡頭跟著車子的高度（慢一點，顛簸不會一直晃）、不會鑽到地底下
//   ride.reset()（teleport 的時候）、ride.release()（車子交回去：輪子歸位、旋轉順序換回來）
//   ride.tele() → { y, air, pitch, roll, wheels（幾個輪子著地）, belly（底盤磨到）, lands（落地幾次）, land（上一次落地）, pen（這一步最深壓進地面多少） }
// 落地事件（drive.js 叫 onLand）：飛超過 0.25 秒再碰到地，看接下來 0.12 秒最重的一下
//   { speed（往下撞地的速度 m/s）, air（飛了幾秒）, drop（最高離地幾公尺）, x, z, v（水平速度 m/s）, hard（超過這台車受得了的）}
import * as THREE from 'three';

export const { createRide, RIDE } = (() => {
const G = 9.81;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// 車種：懸吊的頻率 f（Hz）、阻尼 zeta、行程 up（壓縮）／down（伸長）、底盤離地 clr、受得了的落地速度 tol（m/s）、輪胎前後取幾點 feet、鏡頭
const CLS = {
  road: { f: 1.6, zeta: 0.45, up: 0.075, down: 0.09, clr: 0.13, tol: 4.5, feet: 3, cam: { d: 1, dh: 0, look: 0 } },
  offroad: { f: 1.25, zeta: 0.4, up: 0.16, down: 0.2, clr: 0.3, tol: 7, feet: 5, cam: { d: 1.12, dh: 0.4, look: 0.3 } },
  monster: { f: 0.95, zeta: 0.34, up: 0.35, down: 0.4, clr: 0.9, tol: 10, feet: 5, cam: { d: 1.5, dh: 1.9, look: 1.25 } },
};
// 路面（world.surfaceAt）：0 大路、1 草地、2 稻田、3 小路、4 快速道路、5 泥土路、6 泥巴、7 沙、8 石頭
//   cap＝限速 m/s、drag＝多的阻力 m/s²、over＝比限速快怎麼慢下來 [每 m/s, 最多 m/s²]、grip＝起步抓地 ×、lat＝過彎抓地 ×
//   一般的車：泥巴、石頭、沙很慢（開得進去，很辛苦）；越野車（四驅、越野胎、底盤高）：草地、泥土路幾乎全速，泥巴、石頭也過得去
const K = (kmh) => kmh / 3.6;
const SURF = {
  road: {
    5: { cap: K(95), drag: 0.5, over: [1.4, 5], grip: 0.78, lat: 0.72 },
    6: { cap: K(12), drag: 1.0, over: [3, 9], grip: 0.5, lat: 0.45 }, // 陷在泥巴裡：慢慢爬（後驅也爬得出來，不會完全卡死）
    7: { cap: K(38), drag: 1.6, over: [2.2, 7], grip: 0.55, lat: 0.55 },
    8: { cap: K(10), drag: 1.2, over: [3, 9], grip: 0.6, lat: 0.6 },
  },
  offroad: {
    0: { cap: Infinity, drag: 0, grip: 0.95, lat: 0.9 }, 3: { cap: Infinity, drag: 0, grip: 0.95, lat: 0.9 }, 4: { cap: Infinity, drag: 0, grip: 0.95, lat: 0.9 },
    1: { cap: K(95), drag: 0.3, over: [1.2, 5], grip: 0.92, lat: 0.85 },
    2: { cap: K(40), drag: 1.1, over: [2, 7], grip: 0.75, lat: 0.7 },
    5: { cap: Infinity, drag: 0.15, grip: 0.97, lat: 0.9 },
    6: { cap: K(40), drag: 1.2, over: [2, 7], grip: 0.82, lat: 0.7 },
    7: { cap: K(90), drag: 0.6, over: [1.5, 6], grip: 0.88, lat: 0.78 },
    8: { cap: K(24), drag: 0.5, over: [2, 7], grip: 0.97, lat: 0.85 },
  },
  monster: {
    0: { cap: Infinity, drag: 0, grip: 0.95, lat: 0.85 }, 3: { cap: Infinity, drag: 0, grip: 0.95, lat: 0.85 }, 4: { cap: Infinity, drag: 0, grip: 0.95, lat: 0.85 },
    1: { cap: K(100), drag: 0.2, over: [1.2, 5], grip: 0.95, lat: 0.82 },
    2: { cap: K(50), drag: 0.8, over: [2, 7], grip: 0.85, lat: 0.7 },
    5: { cap: Infinity, drag: 0.1, grip: 0.98, lat: 0.85 },
    6: { cap: K(45), drag: 0.8, over: [2, 7], grip: 0.9, lat: 0.72 },
    7: { cap: K(100), drag: 0.4, over: [1.5, 6], grip: 0.92, lat: 0.78 },
    8: { cap: K(30), drag: 0.3, over: [2, 7], grip: 0.98, lat: 0.82 },
  },
};
const BASE = { cap: Infinity, drag: 0, grip: 1, lat: 1 }, AIR = { cap: Infinity, drag: 0, grip: 0, lat: 0 };
const UP = new THREE.Vector3(0, 1, 0), NV = new THREE.Vector3(), Q1 = new THREE.Quaternion(), Q2 = new THREE.Quaternion();

function createRide(o) {
  const S = o.S, st = o.st, info = o.info, P = o.perf || {}, world = o.world || {}, events = o.events || [];
  const W = S.spec.wheels, susp = typeof S.spec.susp === 'function' ? S.spec.susp : null;
  const cls = P.offroad ? (susp ? 'monster' : 'offroad') : 'road', C = CLS[cls], TAB = SURF[cls];
  const always = cls !== 'road'; // 越野車：村子裡也照這個算（懸吊、四輪轉向）；一般的車只有開進地形才算
  const hasH = typeof world.heightAt === 'function';
  const xH = typeof o.extraH === 'function' ? o.extraH : null; // 第 7 批（輾扁）：臨時多出來的高度（怪獸卡車開上去的東西：crush.js 的墊子）
  const H = hasH ? (xH ? (x, z) => world.heightAt(x, z) + xH(x, z) : (x, z) => world.heightAt(x, z)) : xH ? (x, z) => xH(x, z) : () => 0;
  const inT = typeof world.terrainAt === 'function' ? (x, z) => world.terrainAt(x, z) : () => hasH;
  // 四個輪子：車子座標（從 hub 讀：[左前, 右前, 左後, 右後]）、半徑
  const hubs = S.wheels.map((w) => w.parent), hubY0 = hubs.map((hb) => hb.position.y);
  const X = hubs.map((hb) => hb.position.x), Z = hubs.map((hb) => hb.position.z), RW = hubs.map((hb, i) => (i < 2 ? W.RF ?? W.R : W.RR ?? W.R));
  const xc = (X[0] + X[1] + X[2] + X[3]) / 4, L = Math.max(0.5, (X[0] + X[1]) / 2 - (X[2] + X[3]) / 2), tw = Math.max(0.3, (Z[1] + Z[3] - Z[0] - Z[2]) / 2);
  const kp2 = (0.28 * info.len + 0.12) ** 2, kr2 = (0.72 * Math.max(tw / 2, 0.5)) ** 2; // 前後、左右轉動的慣量（÷ 質量）
  const w0 = 2 * Math.PI * C.f, KS = (w0 * w0) / 4, DS = (C.zeta * w0) / 2, C0 = G / (w0 * w0), FMAX = 3.2 * G; // 每個角的彈簧（÷ 質量）；靜止時壓 C0
  // 輪胎有多大：前後取幾個點（碰到石頭、跳台的邊，輪胎前緣先爬上去）；越野車的胎很寬：左右兩邊也取（石頭在胎的邊上也會爬上去）
  const FEET = C.feet === 5 ? [0, 0.45, -0.45, 0.8, -0.8] : [0, 0.5, -0.5];
  const TW = [0, 1, 2, 3].map((i) => (i < 2 ? W.wF : W.wR) || (cls === 'monster' ? 1 : 0.3));
  const FT = RW.map((R, i) => { const out = FEET.map((k) => [k * R, 0, R - Math.sqrt(R * R - k * R * k * R)]); if (cls !== 'road') for (const q of [-0.36, 0.36]) for (const k of [0, 0.45, -0.45]) out.push([k * R, q * TW[i], R - Math.sqrt(R * R - k * R * k * R)]); return out; });
  // 底盤：車頭、車尾、中間、中間兩邊（離地多少）
  const clrN = C.clr + (cls === 'road' ? 0.04 : 0.05), halfW = info.halfW;
  const CH = [[info.nose - 0.35, 0, clrN], [info.tail + 0.35, 0, clrN + 0.02], [xc, 0, C.clr], [xc, -halfW * 0.6, C.clr + 0.01], [xc, halfW * 0.6, C.clr + 0.01],
    [info.nose - 0.25, -halfW * 0.8, clrN + 0.04], [info.nose - 0.25, halfW * 0.8, clrN + 0.04], [info.tail + 0.25, -halfW * 0.8, clrN + 0.06], [info.tail + 0.25, halfW * 0.8, clrN + 0.06]]; // 底盤：車頭、車尾、中間、兩邊、四個角
  const driven = P.awd || cls !== 'road' ? [0, 1, 2, 3] : [2, 3];
  // 狀態：y＝車子中間（四個輪子的中間）那點的高度、p＝抬頭（+）、r＝右邊往下（+）
  const R = { y: 0, vy: 0, p: 0, pv: 0, r: 0, rv: 0 };
  const G4 = [0, 0, 0, 0], GD = [0, 0, 0, 0], SV = [0, 0, 0, 0], F = [0, 0, 0, 0], VIS = [0, 0, 0, 0], CG = CH.map(() => 0), CGd = CH.map(() => 0);
  let on = false, air = false, airT = 0, maxDrop = 0, landT = 0, landMax = 0, landAir = 0, landDrop = 0, lands = 0, last = null, first = true, nW = 4, nC = 0, pen = 0, pg = 0, camY = 0, camOk = false, shadowRef = null, shadowOp = null;
  const k = { trac: 1, lat: 1, ws: 1, pivot: info.xr, slope: 0, scrape: 0 };

  // 輪子底下的地面（輪胎的圓碰到的最高點，換算成輪子最低點的高度）
  function ground(i, c, s) {
    const wx = st.x + c * X[i] + s * Z[i], wz = st.z - s * X[i] + c * Z[i];
    let g = -Infinity;
    for (const [d, dz, drop] of FT[i]) { const v = H(wx + c * d + s * dz, wz - s * d + c * dz) - drop; if (v > g) g = v; }
    return g;
  }
  function setFromGround() { // 照地面擺好（teleport、剛開進地形）
    const c = Math.cos(st.th), s = Math.sin(st.th);
    for (let i = 0; i < 4; i++) G4[i] = ground(i, c, s);
    const gf = (G4[0] + G4[1]) / 2, gr = (G4[2] + G4[3]) / 2, gl = (G4[0] + G4[2]) / 2, gri = (G4[1] + G4[3]) / 2;
    R.p = Math.atan2(gf - gr, L); R.r = Math.atan2(gl - gri, tw); R.y = (G4[0] + G4[1] + G4[2] + G4[3]) / 4;
    R.vy = R.pv = R.rv = 0; GD.fill(0); first = true; air = false; airT = 0; landT = 0; nW = 4;
    for (let j = 0; j < CH.length; j++) CGd[j] = 0;
    k.trac = k.lat = 1; k.slope = k.scrape = 0; // 飛在空中的時候 teleport（回車庫、再比一次）：抓地先回來，不然下一步還是飛的抓地（0）
  }
  // 一個角往上推 J（速度或位置）：高度、前後、左右一起分
  const arm = (a, zz) => 1 + (a * a) / kp2 + (zz * zz) / kr2;
  function push(which, a, zz, J) {
    if (which === 0) { R.vy += J; R.pv += (J * a) / kp2; R.rv -= (J * zz) / kr2; }
    else { R.y += J; R.p += (J * a) / kp2; R.r -= (J * zz) / kr2; }
  }
  function activate() { on = true; setFromGround(); camOk = false; }
  function deactivate() {
    on = false; air = false; k.trac = k.lat = k.ws = 1; k.pivot = info.xr; k.slope = k.scrape = 0;
    rest();
  }
  function rest() { // 車子、輪子、影子放回平地的樣子（drive.js 的 pose 下一步照舊擺）
    S.car.rotation.order = 'XYZ'; S.car.rotation.x = 0; S.car.rotation.z = 0; S.car.position.y = 0;
    if (susp) susp(S, [0, 0, 0, 0], 0, 0); else hubs.forEach((hb, i) => (hb.position.y = hubY0[i]));
    if (shadowRef) { shadowRef.rotation.set(0, shadowRef.rotation.y, 0); if (shadowOp != null) shadowRef.material.opacity = shadowOp; }
  }

  function step(h) {
    if (!on) { if (always || inT(st.x, st.z)) activate(); else return; }
    const c = Math.cos(st.th), s = Math.sin(st.th), sp = Math.sin(R.p), sr = Math.sin(R.r);
    // 1) 四個輪子：地面、壓縮、彈簧＋阻尼（只有往上推）
    let fs = 0, mp = 0, mr = 0, nw = 0, td = 0; pen = 0;
    for (let i = 0; i < 4; i++) {
      const g = ground(i, c, s);
      GD[i] = first ? 0 : clamp((g - G4[i]) / h, -15, 15); G4[i] = g; // 地面往上的速度（石頭的邊、跳台口）：最多 15 m/s（車子突然轉向、換位置不會被彈飛）
      const a = X[i] - xc, sv = g - (R.y + a * sp - Z[i] * sr), vI = R.vy + a * R.pv - Z[i] * R.rv;
      SV[i] = sv; if (sv - C.up > pen) pen = sv - C.up;
      if (sv > -C.down) { const f = clamp(KS * (sv + C0) + DS * (GD[i] - vI), 0, FMAX); F[i] = f; fs += f; mp += f * a; mr -= f * Z[i]; nw++; if (GD[i] - vI > td) td = GD[i] - vI; } else F[i] = 0;
    }
    // 底盤碰到地（石頭、坡的頂點）：推上去、磨地變慢
    let nc = 0, scr = 0;
    for (let j = 0; j < CH.length; j++) {
      const [x, zz, cl] = CH[j], gh = H(st.x + c * x + s * zz, st.z - s * x + c * zz);
      CGd[j] = first ? 0 : clamp((gh - CG[j]) / h, -15, 15); CG[j] = gh;
      const e = gh - (R.y + (x - xc) * sp - zz * sr + cl);
      if (e > 0) { nc++; scr += 4 + 10 * e; pen = Math.max(pen, e); }
    }
    first = false;
    const wasAir = air;
    air = nw === 0 && nc === 0;
    // 2) 加速度（彈簧、重力；飛在空中慢慢擺正：車頭照飛的方向、左右擺平，才會輪子先著地）
    let ay = fs - G, ap = mp / kp2, ar = mr / kr2;
    if (air) {
      const pT = clamp(Math.atan2(R.vy, Math.max(4, Math.abs(st.v))) * 0.55, -0.42, 0.3);
      ap += -3.2 * (R.p - pT) - 1.8 * R.pv; ar += -4.5 * R.r - 2.4 * R.rv;
    }
    R.vy += ay * h; R.pv += ap * h; R.rv += ar * h;
    // 3) 壓到底（避震壓死）、底盤碰到：碰撞（不讓它再往下）；落地最重的一下記下來
    let hit = 0;
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < 4; i++) {
        if (SV[i] <= C.up) continue;
        const a = X[i] - xc, cl = GD[i] - (R.vy + a * R.pv - Z[i] * R.rv);
        if (cl > 0) { push(0, a, Z[i], cl / arm(a, Z[i])); if (it === 0) hit = Math.max(hit, cl); }
      }
      for (let j = 0; j < CH.length; j++) {
        const [x, zz, cl0] = CH[j], a = x - xc, e = CG[j] - (R.y + a * sp - zz * sr + cl0); if (e <= 0) continue;
        const cl = CGd[j] - (R.vy + a * R.pv - zz * R.rv);
        if (cl > 0) { push(0, a, zz, cl / arm(a, zz)); if (it === 0) hit = Math.max(hit, cl); }
      }
    }
    R.y += R.vy * h; R.p += R.pv * h; R.r += R.rv * h;
    // 位置：壓進地面的部分推出來（輪子最多壓到 up、底盤不能在地面下面）
    for (let it = 0; it < 2; it++) {
      const sp2 = Math.sin(R.p), sr2 = Math.sin(R.r);
      for (let i = 0; i < 4; i++) {
        const a = X[i] - xc, e = G4[i] - (R.y + a * sp2 - Z[i] * sr2) - C.up;
        if (e > 0) push(1, a, Z[i], e / arm(a, Z[i]));
      }
      for (let j = 0; j < CH.length; j++) {
        const [x, zz, cl0] = CH[j], a = x - xc, e = CG[j] - (R.y + a * sp2 - zz * sr2 + cl0);
        if (e > 0) push(1, a, zz, e / arm(a, zz));
      }
    }
    // 不會翻車（街機）：前後、左右最多傾這麼多
    if (Math.abs(R.p) > 0.75) { R.p = clamp(R.p, -0.75, 0.75); R.pv = 0; }
    if (Math.abs(R.r) > 0.6) { R.r = clamp(R.r, -0.6, 0.6); R.rv = 0; }
    { // 還壓在地面下面的（傾到最多了、推兩次還不夠）：整台直接抬上來，輪子不會陷進石頭裡、底盤不會穿過地面
      const sp3 = Math.sin(R.p), sr3 = Math.sin(R.r); let lift = 0;
      for (let i = 0; i < 4; i++) { const e = G4[i] - (R.y + (X[i] - xc) * sp3 - Z[i] * sr3) - C.up; if (e > lift) lift = e; }
      for (let j = 0; j < CH.length; j++) { const [x, zz, cl0] = CH[j], e = CG[j] - (R.y + (x - xc) * sp3 - zz * sr3 + cl0); if (e > lift) lift = e; }
      if (lift > 0) { R.y += lift; if (R.vy < 0) R.vy = 0; }
    }
    nW = nw; nC = nc;
    // 4) 飛、落地
    const gC = (G4[0] + G4[1] + G4[2] + G4[3]) / 4;
    if (air) { airT += h; maxDrop = Math.max(maxDrop, R.y - gC); }
    else {
      if (wasAir && airT >= 0.25) { landT = 0.12; landMax = Math.max(hit, td); landAir = airT; landDrop = maxDrop; }
      else if (landT > 0) landMax = Math.max(landMax, hit);
      if (landT > 0) {
        landT -= h;
        if (landT <= 0) { lands++; last = { speed: +landMax.toFixed(2), air: +landAir.toFixed(2), drop: +landDrop.toFixed(2), x: st.x, z: st.z, v: Math.abs(st.v), hard: landMax > C.tol }; events.push(['land', last]); }
      }
      airT = 0; maxDrop = 0;
    }
    // 5) 給 drive.js 的：抓地（照輪子壓多重）、上下坡、四輪轉向
    const sf = air ? AIR : TAB[st.surf] || BASE, f0 = KS * C0;
    let fd = 0; for (const i of driven) fd += F[i];
    const cD = fd / (driven.length * f0), cA = fs / (4 * f0);
    pg = Math.atan2((G4[0] + G4[1]) / 2 - (G4[2] + G4[3]) / 2, L);
    k.trac = air ? 0 : sf.grip * clamp(cD, 0, 1.1);
    if (nc > 0 && !air) k.trac = Math.max(k.trac, 0.4); // 底盤卡在石頭上（輪子懸空）：輪胎亂抓還是爬得動一點（不會永遠卡死）
    k.lat = air ? 1e-3 : sf.lat * clamp(cA, 0.25, 1.1); // 飛的時候不是 0：drive.js 過彎那裡要除以它（0÷0 車子會不見）
    k.slope = air || nw === 0 ? 0 : -G * Math.sin(pg) * Math.min(1, nw / 2);
    k.scrape = Math.min(12, scr) * clamp(Math.abs(st.v) / 4, 0.1, 1); // 底盤磨地：快的時候磨很兇，慢慢爬只磨一點
    if (susp) { const r4 = clamp(1 - (Math.abs(st.v) - 4) / 12, 0, 1); k.ws = 1 + r4; k.pivot = (r4 * xfA + xrA) / (1 + r4); } // 怪獸卡車：慢的時候後輪反向轉（原地迴轉），快了只有前輪
    else { k.ws = 1; k.pivot = info.xr; }
    // 一般的車開出地形、停穩了：交回給 drive.js（完全照舊）
    if (!always && !inT(st.x, st.z) && nw === 4 && Math.abs(R.y) < 0.003 && Math.abs(R.p) < 0.002 && Math.abs(R.r) < 0.002 && Math.abs(R.vy) < 0.02 && Math.abs(R.pv) < 0.02 && Math.abs(R.rv) < 0.02) deactivate();
  }
  const xfA = (X[0] + X[1]) / 2, xrA = (X[2] + X[3]) / 2;

  function pose(vis, shadow, cx, cz) {
    if (!on) return;
    const car = S.car;
    car.rotation.order = 'YZX';
    car.position.y = R.y - xc * Math.sin(R.p);
    car.rotation.set(R.r, st.th, R.p);
    // 懸吊：著地的輪子照壓縮、離地的慢慢垂下去
    for (let i = 0; i < 4; i++) {
      const want = SV[i] > -C.down ? clamp(SV[i], -C.down, C.up) : -C.down;
      VIS[i] += (want - VIS[i]) * (SV[i] > -C.down ? 1 : 0.25);
    }
    if (susp) { const r4 = k.ws - 1; susp(S, VIS, vis, -r4 * vis); }
    else for (let i = 0; i < 4; i++) hubs[i].position.y = hubY0[i] + VIS[i];
    if (shadow) { // 影子：貼著地面（照地面的斜度）、飛高變淡
      shadowRef = shadow; if (shadowOp == null) shadowOp = shadow.material.opacity;
      const g = H(cx, cz), up = Math.max(0, R.y - g);
      shadow.position.set(cx, g + 0.06, cz);
      normalAt(cx, cz, NV); Q1.setFromUnitVectors(UP, NV); Q2.setFromAxisAngle(UP, st.th); shadow.quaternion.copy(Q1).multiply(Q2);
      shadow.material.opacity = shadowOp * clamp(1 - up / 5, 0.2, 1);
    }
  }
  function normalAt(x, z, out) {
    if (typeof world.normalAt === 'function') { const n = world.normalAt(x, z); return out.set(n[0], n[1], n[2]); }
    const e = 0.5, hx = H(x + e, z) - H(x - e, z), hz = H(x, z + e) - H(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }
  function speed(un, u, h, sg, stop, go, kA) {
    if (air) { const a = kA * u * u * h; return u > 0 ? Math.max(0, u - a) : u < 0 ? Math.min(0, u + a) : 0; } // 飛在空中：只有風阻
    let v = un;
    const sl = k.slope; // 上坡（車頭朝上）往後拉、下坡往前推；停著踩煞車（或沒踩油門的緩坡）不會滑
    if (sl && !(Math.abs(u) < 0.3 && (stop > 0.3 || (go < 0.05 && Math.abs(sl) < 2.5)))) v += sl * sg * h;
    if (k.scrape) { const d = k.scrape * h; v = v > 0 ? Math.max(0, v - d) : v < 0 ? Math.min(0, v + d) : 0; } // 底盤磨地
    return v;
  }
  function cam(dt) {
    const gy = R.y;
    if (!camOk) { camY = gy; camOk = true; } else camY += (gy - camY) * (1 - Math.exp(-dt * (Math.abs(gy - camY) > 3 ? 9 : 5)));
    return { d: C.cam.d, dh: C.cam.dh, look: C.cam.look, y: camY, floor: (x, z) => H(x, z) + 0.9 };
  }
  function reset() { // teleport：照地面擺好（一般的車在村子裡：不動）
    if (!always && !inT(st.x, st.z)) { if (on) deactivate(); return; }
    if (!on) on = true;
    setFromGround(); camOk = false;
  }
  function follow(dt) { // 自動停車：車子是照曲線擺的（drive.js），高度照樣算
    const n = Math.max(1, Math.ceil(dt * 120 - 1e-6)), h = dt / n;
    for (let i = 0; i < n; i++) step(h);
  }
  function release() { rest(); if (!always) on = false; else { on = true; setFromGround(); } VIS.fill(0); }

  return {
    get on() { return on; }, get air() { return air; }, get cls() { return cls; }, k,
    sf: (code) => (air ? AIR : TAB[code] || null),
    speed, step, follow, pose, cam, reset, release,
    ground: H,
    tele: () => ({ y: R.y, air, pitch: R.p, roll: R.r, wheels: nW, belly: nC > 0, lands, land: last, pen, rideOn: on, cls }),
  };
}
return { createRide, RIDE: { CLS, SURF } };
})();
