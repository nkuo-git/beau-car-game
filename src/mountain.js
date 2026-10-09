// ---- 山（第 14 批）：村子北邊開得上去的山：之字形的山路、護欄、急彎路牌、反光鏡、樹、山頂停車場、紅色涼亭、觀景台、越野車的泥土捷徑、爬山計時賽的起點終點 ----
// Nick 2026-10-09「車可開到山上」；草稿 https://claude.ai/artifact/NhH4i6Gw2C8Yk2ZhEx6Poj（Nick「好」）
// 位置：你家車庫東北邊（村子的路 x −250 那個轉角）往北開，穿過北邊的山腳（village.js 北邊邊界開一個口）上山；山在 x −505…−75、z −700…−117.5（MB）
//   村子本來的路、房子都沒有動；village.js 改的地方都寫「第 14 批」：北邊邊界的碰撞開一個口、口上那兩棵樹不種、車庫東北邊稻田東邊那格拿掉（路穿過去）、
//   村子北邊三座小山、北邊遠的兩座大山拿掉（這座山蓋在那裡）、北邊那間鐵皮工廠往西搬到快速道路裡面
// 世界座標跟 village.js、drive.js 一樣：x 往東、y 往上、z 往南；heading＝rotation.y（0 朝東、π/2 朝北）
// 【API】
//   await mountainFonts();                     招牌的中文字（跟 villageFonts 一起等）
//   const M = buildMountain(V, { renderer });  V＝buildVillage() 回傳的（buildNeihu 之後）；山加進 V（V.group、V.places.mountain、V.colliders、V.roads、V.info.mountain）
//     V.heightAt、V.normalAt、V.terrainAt、V.surfaceAt、V.route、V.mapDraw 包一層：山上照這裡算；山外面完全照舊（同一個函式、同樣的答案）
//   V.places.mountain：山頂 { name, pos, zone（停車場＋涼亭）, spawn（停車場裡、車頭朝東）, view（觀景台欄杆中間） }
//   M.road：山路中線（從村子的轉角開始、到山頂停車場）{ len, n, x, z, tx, tz, h（路面高度）, s, project(x, z) → { s, d（離中線幾公尺）, h } }
//   M.trial：爬山計時賽 { s0（起點線）, s1（終點線）, start: { x, z, heading }, finish: { x, z } }：town.src.js 照 project(x, z).s 算有沒有過線
//   M.top：山頂多高（公尺）；M.inMountain(x, z)：在山的範圍裡（地形）；M.onRoad(x, z)：在山路上（含轉角到山腳那段）
//   M.info：{ meshes, tris, terrainTris, trees, rails, ms }；M.dispose()（V.dispose() 也會叫）
//   路面（surfaceAt）：3 山路、停車場（柏油）、5 泥土捷徑、1 草地（越野車照 terrain.js 的表）
// 地形：山路先決定（中線＋每一點的高度：一路大約 12% 的坡、髮夾彎緩一點、山頂停車場平的），再照路長出山：
//   每一段路往兩邊「看」：碰到上面（或下面）那一段路就照兩段路的高度差算坡（兩段路中間的山坡剛好接起來），看不到路的那邊照山的外形（橢圓、圓圓的山頭）往下；
//   很多段路的推估用距離加權平均（近的比較重）→ 平順的山坡；路上 6.5 公尺以內是平的（跟路面一樣高）、13.5 公尺以外照山坡；格子 2.5 公尺（heightAt 跟畫出來的三角形一模一樣）
// 效能：地形 1 個 draw call（約 6.9 萬個三角形）、山路 1 個、護欄／樹／涼亭照材質、100 公尺一格合併；碰撞都是一般的盒子、圓（drive.js、walk.js 照舊）
// 輾扁（crush.js）：山上的樹、護欄、路牌、反光鏡越野車輾得扁（涼亭、觀景台的欄杆不輾）；山上輾東西不報警（跟越野車場一樣：terrainAt）
import * as THREE from 'three';

export const { buildMountain, mountainFonts, MOUNT_TEXT, mountainLayout } = (() => {
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
const CC = new Map();
const C = (hex) => { let v = CC.get(hex); if (!v) { const c = new THREE.Color(hex); v = [c.r, c.g, c.b]; CC.set(hex, v); } return v; }; // 線性顏色
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function fitFont(g, text, maxW, px, fam = SANS) { let s = px; for (; s > 8; s -= 2) { g.font = `700 ${s}px ${fam}`; if (g.measureText(text).width <= maxW) break; } return s; }

// ---- 山的範圍、山路 ----
const MB = { x0: -505, x1: -75, z0: -700, z1: -117.5 }; // 地形的格子（南邊 z −117.5：村子北邊邊界的外面；西邊 −505：快速道路的護欄外面；東邊 −75：賽車場的草地外面；北邊 −700）
const GS = 2.5, NX = 172, NZ = 233; // 2.5 公尺一格
const RW = 9, FLAT = 6.5, BLEND = 15; // 路寬 9（雙黃線、兩邊白線）；中線 6.5 公尺以內地是平的、15 以外照山坡
const CORNER = [-250, -72]; // 村子的路（G → C）在這裡轉彎：山路從轉角的弧上接出去
// 中線的轉角（x, z, 圓弧半徑）：髮夾彎＝兩個 80–90° 的彎接在一起（半徑 14 公尺）
const CTRL = [[-250, -80, 0], [-250, -134, 24], [-160, -166, 14], [-158, -197, 14], [-418, -226, 14], [-420, -257, 14], [-178, -290, 14], [-176, -321, 14], [-362, -352, 14], [-364, -383, 14], [-318, -401, 18], [-304, -404, 0]];
const SUMMIT = { x0: -306, x1: -230, z0: -418, z1: -391 }; // 山頂平的地方：停車場（x −302…−252）＋涼亭（東邊）
const PARK = { x0: -301, x1: -253, z0: -415, z1: -394 };
const PAV = { x: -241, z: -404.5, hw: 3.4 }; // 涼亭（柱子中心到中心 6.8 公尺）
const PEAK = { x: -284, z: -428 }; // 山的外形（看不到路的那邊）：橢圓的山頭
const TRAIL = [[-224, -150], [-226, -168], [-236, -200], [-252, -232], [-262, -262], [-268, -292], [-276, -326], [-282, -356], [-286, -384], [-282, -394]]; // 越野車的泥土捷徑（直直往上，穿過每一段山路）

// 中線：直線＋圓弧（真的圓），每 1 公尺一點
function centerline(start) {
  const P = [start, ...CTRL.map((c) => [c[0], c[1]])], R = [0, ...CTRL.map((c) => c[2])], out = [];
  const push = (x, z) => { const q = out[out.length - 1]; if (!q || Math.hypot(q[0] - x, q[1] - z) > 1e-6) out.push([x, z]); };
  let cur = P[0]; push(cur[0], cur[1]);
  for (let i = 1; i < P.length; i++) {
    const b = P[i];
    if (i === P.length - 1 || !R[i]) { line(cur, b); cur = b; continue; }
    const c = P[i + 1], ax = b[0] - cur[0], az = b[1] - cur[1], la = Math.hypot(ax, az), bx = c[0] - b[0], bz = c[1] - b[1], lb = Math.hypot(bx, bz);
    const ux = ax / la, uz = az / la, vx = bx / lb, vz = bz / lb, cr = ux * vz - uz * vx, phi = Math.acos(clamp(ux * vx + uz * vz, -1, 1)), t = R[i] * Math.tan(phi / 2);
    const p0 = [b[0] - ux * t, b[1] - uz * t], p1 = [b[0] + vx * t, b[1] + vz * t];
    line(cur, p0);
    const sg = cr > 0 ? 1 : -1, cx = p0[0] - uz * R[i] * sg, cz = p0[1] + ux * R[i] * sg; // 圓心：p0 往彎進去的那邊 R
    const a0 = Math.atan2(p0[1] - cz, p0[0] - cx), n = Math.max(2, Math.ceil((phi * R[i]) / 1));
    for (let k = 1; k <= n; k++) { const a = a0 + sg * phi * (k / n); push(cx + Math.cos(a) * R[i], cz + Math.sin(a) * R[i]); }
    cur = p1;
  }
  return out;
  function line(a, b) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(l)); for (let k = 1; k <= n; k++) push(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n); }
}

// 山的外形（看不到路的地方）：橢圓的山頭，到格子的邊附近降到 0
function shapeH(x, z, top) {
  const dx = x - PEAK.x, dz = z - PEAK.z, rx = dx < 0 ? 205 : 195, rz = dz > 0 ? 295 : 255, r = Math.sqrt((dx / rx) ** 2 + (dz / rz) ** 2);
  const u = 1 - Math.pow(r, 1.7), w = 0.08, c = u > w ? u : u > -w ? ((u + w) * (u + w)) / (4 * w) : 0; // 圓圓的山頭（1 − r^1.7）、山腳磨圓（r 到 1.05 才是 0）
  const ex = Math.max(SUMMIT.x0 - x, 0, x - SUMMIT.x1), ez = Math.max(SUMMIT.z0 - z, 0, z - SUMMIT.z1); // 山頂平台旁邊：不要一下子掉下去（坡從 0.5 慢慢變陡）
  return Math.max((top + 3) * c, top - (0.5 + 0.012 * Math.hypot(ex, ez)) * Math.hypot(ex, ez));
}
// 平順的雜訊（值雜訊，兩層）：山坡不會一片平平的
function vnoise(x, z, f, seed) {
  const X = x * f, Z = z * f, i = Math.floor(X), j = Math.floor(Z), u = X - i, v = Z - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash2(i + seed, j), b = hash2(i + 1 + seed, j), c = hash2(i + seed, j + 1), d = hash2(i + 1 + seed, j + 1);
  return lerp(lerp(a, b, su), lerp(c, d, su), sv) * 2 - 1;
}

// ---- 版面：山路（中線、高度）＋地形的高度（純計算，不碰 three.js 的場景：測試用 Node 也跑得動）----
function mountainLayout(start = [-252.5, -69.5]) {
  const T0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  // 1) 中線、切線、曲率、長度
  const P = centerline(start), n = P.length;
  const X = new Float64Array(n), Z = new Float64Array(n), TX = new Float64Array(n), TZ = new Float64Array(n), K = new Float64Array(n), S = new Float64Array(n), Hh = new Float64Array(n);
  for (let i = 0; i < n; i++) { X[i] = P[i][0]; Z[i] = P[i][1]; if (i) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]); }
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = X[b] - X[a], dz = Z[b] - Z[a], l = Math.hypot(dx, dz) || 1; TX[i] = dx / l; TZ[i] = dz / l; }
  for (let i = 1; i < n - 1; i++) { const ax = TX[i - 1], az = TZ[i - 1], bx = TX[i + 1], bz = TZ[i + 1], ds = S[i + 1] - S[i - 1] || 1; K[i] = (ax * bz - az * bx) / ds; }
  const len = S[n - 1];
  // 2) 坡度：出了村子北邊（z −122）才開始爬；直線 12%、髮夾彎 8%；最後 35 公尺平的（停車場）；坡度先平滑（前後 12 公尺）再積分
  let s0 = 0; for (let i = 0; i < n; i++) if (Z[i] < -124) { s0 = S[i]; break; }
  const G0 = new Float64Array(n), G1 = new Float64Array(n);
  for (let i = 0; i < n; i++) G0[i] = (Math.abs(K[i]) > 1 / 22 ? 0.08 : 0.12) * ss(s0, s0 + 28, S[i]) * (1 - ss(len - 50, len - 30, S[i]));
  for (let i = 0; i < n; i++) { let a = 0, w = 0; for (let j = i; j >= 0 && S[i] - S[j] < 12; j--) { a += G0[j]; w++; } for (let j = i + 1; j < n && S[j] - S[i] < 12; j++) { a += G0[j]; w++; } G1[i] = a / w; }
  for (let i = 1; i < n; i++) Hh[i] = Hh[i - 1] + G1[i] * (S[i] - S[i - 1]);
  const top = Hh[n - 1];
  // 3) 路的格子（找最近的點：10 公尺一格）
  const RC = 10, rgrid = new Map(), rkey = (i, j) => i * 4099 + j;
  for (let i = 0; i < n - 1; i++) {
    const x0 = Math.min(X[i], X[i + 1]), x1 = Math.max(X[i], X[i + 1]), z0 = Math.min(Z[i], Z[i + 1]), z1 = Math.max(Z[i], Z[i + 1]);
    for (let a = Math.floor(x0 / RC); a <= Math.floor(x1 / RC); a++) for (let b = Math.floor(z0 / RC); b <= Math.floor(z1 / RC); b++) { const k = rkey(a, b); let L = rgrid.get(k); if (!L) rgrid.set(k, (L = [])); L.push(i); }
  }
  const PR = { s: 0, d: 0, h: 0, i: 0, t: 0, side: 0 };
  function project(x, z, maxD = 40, out = PR) { // 最近的中線（maxD 以外：d＝Infinity）
    const r = Math.ceil(maxD / RC), ci = Math.floor(x / RC), cj = Math.floor(z / RC); let bd = Infinity, bi = -1, bt = 0;
    for (let a = ci - r; a <= ci + r; a++) for (let b = cj - r; b <= cj + r; b++) {
      const L = rgrid.get(rkey(a, b)); if (!L) continue;
      for (let k = 0; k < L.length; k++) {
        const i = L[k], dx = X[i + 1] - X[i], dz = Z[i + 1] - Z[i], l2 = dx * dx + dz * dz || 1, t = clamp(((x - X[i]) * dx + (z - Z[i]) * dz) / l2, 0, 1), ex = X[i] + dx * t - x, ez = Z[i] + dz * t - z, d = ex * ex + ez * ez;
        if (d < bd) { bd = d; bi = i; bt = t; }
      }
    }
    if (bi < 0 || bd > maxD * maxD) { out.d = Infinity; out.i = -1; return out; }
    out.i = bi; out.t = bt; out.d = Math.sqrt(bd); out.s = lerp(S[bi], S[bi + 1], bt); out.h = lerp(Hh[bi], Hh[bi + 1], bt);
    out.side = (x - X[bi]) * TZ[bi] - (z - Z[bi]) * TX[bi] > 0 ? 1 : -1; // 1＝左邊（路的方向往前看）
    return out;
  }
  // 4) 每 6 公尺一點：往兩邊看（左＝(tz, −tx)），碰到別段路就照兩段的高度差算坡；看不到就照山的外形
  const CS = [];
  for (let s = 0; s <= len; s += 6) {
    let i = 0; while (i < n - 2 && S[i + 1] < s) i++;
    const x = X[i], z = Z[i], tx = TX[i], tz = TZ[i], h = Hh[i], sl = [0, 0];
    for (let sd = 0; sd < 2; sd++) {
      const nx = sd ? -tz : tz, nz = sd ? tx : -tx; let hit = Infinity, hh = 0;
      for (let j = 0; j < n - 1; j += 2) { // 射線 vs 中線（每 2 公尺一段）
        const jb = Math.min(n - 1, j + 2); if (Math.abs(S[j] - s) < 30) continue;
        const ex = X[jb] - X[j], ez = Z[jb] - Z[j], den = nx * ez - nz * ex; if (Math.abs(den) < 1e-9) continue;
        const qx = X[j] - x, qz = Z[j] - z, t = (qx * ez - qz * ex) / den, u = (qx * nz - qz * nx) / den;
        if (t > 4 && t < hit && u >= 0 && u <= 1) { hit = t; hh = lerp(Hh[j], Hh[jb], u); }
      }
      if (hit < 170) sl[sd] = clamp((hh - h) / Math.max(8, hit - 2 * FLAT), -0.9, 0.9);
      else { const d = 60; sl[sd] = clamp((shapeH(x + nx * d, z + nz * d, top) * edgeK(x + nx * d, z + nz * d) - h) / (d - FLAT), -0.95, 0.6); }
    }
    if (h < 0.5 && s < s0 + 10) { sl[0] = 0; sl[1] = 0; } // 山腳平的那段（村子）
    if (s > len - 45) { const k = ss(len - 45, len - 15, s); sl[0] *= 1 - k; sl[1] *= 1 - k; } // 山頂：四周先平平的，再照外形往下
    CS.push({ x, z, nx: tz, nz: -tx, h, sl });
  }
  const CC2 = 30, cgrid = new Map(); // 6 公尺那些點的格子（30 公尺）
  CS.forEach((c, k) => { const key = rkey(Math.floor(c.x / CC2), Math.floor(c.z / CC2)); let L = cgrid.get(key); if (!L) cgrid.set(key, (L = [])); L.push(k); });
  function edgeK(x, z) { const e = Math.min(x - MB.x0, MB.x1 - x, z - MB.z0, MB.z1 - z); return ss(0, 24, e); } // 格子的邊：慢慢降到 0（跟村子的草地接起來）
  // 5) 每個格點的高度
  const W1 = NX + 1, HC = new Float32Array(W1 * (NZ + 1)), DR = new Float32Array(W1 * (NZ + 1)); // DR：離山路中線多遠
  const RAD = 120, NR = Math.ceil(RAD / CC2);
  for (let j = 0; j <= NZ; j++) for (let k = 0; k <= NX; k++) {
    const x = MB.x0 + k * GS, z = MB.z0 + j * GS;
    // 推估（加權平均）＋最近的距離
    let sw = 0, sv = 0, dmin = Infinity; const ci = Math.floor(x / CC2), cj = Math.floor(z / CC2);
    for (let a = ci - NR; a <= ci + NR; a++) for (let b = cj - NR; b <= cj + NR; b++) {
      const L = cgrid.get(rkey(a, b)); if (!L) continue;
      for (let q = 0; q < L.length; q++) {
        const c = CS[L[q]], dx = x - c.x, dz = z - c.z, d2 = dx * dx + dz * dz; if (d2 > RAD * RAD) continue;
        if (d2 < dmin) dmin = d2;
        const off = dx * c.nx + dz * c.nz, v = c.h + (off >= FLAT ? c.sl[0] * (off - FLAT) : off <= -FLAT ? -c.sl[1] * (off + FLAT) : 0), w = 1 / ((d2 + 16) * (d2 + 16)); // 路面那 6.5 公尺是平的，外面才照坡
        sw += w; sv += w * v;
      }
    }
    dmin = Math.sqrt(dmin);
    const shp = shapeH(x, z, top);
    let h = sw > 0 ? lerp(sv / sw, shp, ss(30, 105, dmin)) : shp;
    const pr = project(x, z, BLEND + 30), dr = pr.d;
    h += (vnoise(x, z, 1 / 55, 11) * 3.2 + vnoise(x, z, 1 / 19, 23) * 1.1) * ss(9, 24, dr) * ss(0, 14, h);
    // 山頂平的地方
    const ex = Math.max(SUMMIT.x0 - x, 0, x - SUMMIT.x1), ez = Math.max(SUMMIT.z0 - z, 0, z - SUMMIT.z1), ed = Math.hypot(ex, ez);
    if (ed < 9) h = lerp(top, h, ss(0, 9, ed));
    // 路：附近的中線點加權（髮夾彎裡面兩邊的路平順接起來）
    if (dr < BLEND) {
      let aw = 0, ah = 0, wmax = 0; const ci2 = Math.floor(x / RC), cj2 = Math.floor(z / RC);
      for (let a = ci2 - 2; a <= ci2 + 2; a++) for (let b = cj2 - 2; b <= cj2 + 2; b++) {
        const L = rgrid.get(rkey(a, b)); if (!L) continue;
        for (let q = 0; q < L.length; q++) {
          const i = L[q], d = Math.hypot(x - X[i], z - Z[i]); if (d >= BLEND) continue;
          const w = 1 - ss(FLAT, BLEND, d); if (w <= 0) continue;
          const w2 = w * w * w; aw += w2; ah += w2 * Hh[i]; if (w > wmax) wmax = w;
        }
      }
      if (aw > 0) h = lerp(h, ah / aw, wmax);
    }
    h = Math.max(0, h) * edgeK(x, z);
    HC[j * W1 + k] = h; DR[j * W1 + k] = dr;
  }
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - T0;
  return { X, Z, TX, TZ, K, S, H: Hh, n, len, top, s0, project, HC, DR, W1, CS, ms, edgeK };
}


// ---- 招牌（一張 1024×512）----
const SIGNS = { start: '爬山計時賽 起點', finish: '終點', up: '往山頂', curve: '急彎', summit: '山頂觀景台', alt: '海拔', m: '公尺', trail: '越野車捷徑' };
const MOUNT_TEXT = [...new Set(Object.values(SIGNS).join('').split('').filter((ch) => ch.charCodeAt(0) > 0x2e80))].join('');
function mountainFonts(ms = 1500) {
  const f = typeof document !== 'undefined' && document.fonts;
  if (!f || !f.load) return Promise.resolve();
  const all = Promise.all([f.load(`700 64px ${SANS}`, MOUNT_TEXT + '0123456789')]).catch(() => {});
  return Promise.race([all, new Promise((r) => setTimeout(r, ms))]);
}
const dotUV = (r) => { const u = (r[0] + r[2]) / 2, v = (r[1] + r[3]) / 2; return [u, v, u, v]; };
function signAtlas(top) {
  const W = 1024, H = 512, [c, g] = cv(W, H), uv = {};
  const reg = (name, x, y, w, h, draw) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); draw(g, w, h); g.restore(); uv[name] = [(x + 0.5) / W, 1 - (y + h - 0.5) / H, (x + w - 0.5) / W, 1 - (y + 0.5) / H]; };
  const T = (g2, t, x, y, px, col, max, al = 'center') => { g2.fillStyle = col; g2.textAlign = al; g2.textBaseline = 'middle'; fitFont(g2, t, max, px); g2.fillText(t, x, y); };
  const checks = (g2, x0, h, n = 6) => { for (let r = 0; r < 4; r++) for (let q = 0; q < n; q++) { g2.fillStyle = (r + q) % 2 ? '#f2f3f5' : '#17181b'; g2.fillRect(x0 + q * (h / 4), r * (h / 4), h / 4, h / 4); } };
  const upArrow = (g2, cx, cy, s, col) => { g2.fillStyle = col; g2.beginPath(); g2.moveTo(cx, cy - s); g2.lineTo(cx + 0.75 * s, cy - 0.1 * s); g2.lineTo(cx + 0.3 * s, cy - 0.1 * s); g2.lineTo(cx + 0.3 * s, cy + s); g2.lineTo(cx - 0.3 * s, cy + s); g2.lineTo(cx - 0.3 * s, cy - 0.1 * s); g2.lineTo(cx - 0.75 * s, cy - 0.1 * s); g2.closePath(); g2.fill(); };
  reg('white', 1000, 488, 24, 24, (g2, w, h) => { g2.fillStyle = '#fff'; g2.fillRect(0, 0, w, h); });
  reg('start', 0, 0, 1024, 112, (g2, w, h) => { g2.fillStyle = '#c8322a'; g2.fillRect(0, 0, w, h); checks(g2, 0, h); checks(g2, w - 168, h); T(g2, SIGNS.start, w / 2, h / 2 + 3, 78, '#ffffff', w - 380); });
  reg('finish', 0, 112, 1024, 112, (g2, w, h) => { g2.fillStyle = '#c8322a'; g2.fillRect(0, 0, w, h); checks(g2, 0, h); checks(g2, w - 168, h); T(g2, SIGNS.finish, w / 2, h / 2 + 3, 84, '#ffffff', w - 380); });
  reg('up', 0, 224, 384, 128, (g2, w, h) => {
    g2.fillStyle = '#f2f3f5'; g2.beginPath(); g2.roundRect(0, 0, w, h, 16); g2.fill(); g2.fillStyle = '#1f7a45'; g2.beginPath(); g2.roundRect(6, 6, w - 12, h - 12, 12); g2.fill();
    g2.fillStyle = 'rgba(255,255,255,0.9)'; g2.beginPath(); g2.moveTo(30, h - 26); g2.lineTo(66, 34); g2.lineTo(86, 62); g2.lineTo(98, 48); g2.lineTo(124, h - 26); g2.closePath(); g2.fill(); // 小山
    T(g2, SIGNS.up, 240, h / 2 + 2, 64, '#ffffff', 170); upArrow(g2, w - 40, h / 2, 26, '#ffffff');
  });
  reg('curve', 384, 224, 160, 160, (g2, w, h) => { // 菱形（畫在正方形裡，模型是菱形）
    g2.fillStyle = '#17181b'; g2.beginPath(); g2.moveTo(w / 2, 0); g2.lineTo(w, h / 2); g2.lineTo(w / 2, h); g2.lineTo(0, h / 2); g2.closePath(); g2.fill();
    g2.fillStyle = '#ffcf33'; g2.beginPath(); g2.moveTo(w / 2, 9); g2.lineTo(w - 9, h / 2); g2.lineTo(w / 2, h - 9); g2.lineTo(9, h / 2); g2.closePath(); g2.fill();
    g2.strokeStyle = '#17181b'; g2.lineWidth = 9; g2.lineCap = 'round'; g2.beginPath(); g2.moveTo(w / 2 - 18, h / 2 + 34); g2.lineTo(w / 2 - 18, h / 2 + 8); g2.arc(w / 2, h / 2 + 8, 18, Math.PI, 0); g2.lineTo(w / 2 + 18, h / 2 + 22); g2.stroke(); // 迴轉的箭頭
    g2.fillStyle = '#17181b'; g2.beginPath(); g2.moveTo(w / 2 + 6, h / 2 + 20); g2.lineTo(w / 2 + 30, h / 2 + 20); g2.lineTo(w / 2 + 18, h / 2 + 38); g2.closePath(); g2.fill();
    T(g2, SIGNS.curve, w / 2, h / 2 - 22, 40, '#17181b', 80);
  });
  reg('summit', 544, 224, 480, 160, (g2, w, h) => {
    g2.fillStyle = '#5a3a20'; g2.beginPath(); g2.roundRect(0, 0, w, h, 14); g2.fill(); g2.fillStyle = '#7a5230'; g2.beginPath(); g2.roundRect(8, 8, w - 16, h - 16, 10); g2.fill();
    g2.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 20; y < h; y += 22) g2.fillRect(8, y, w - 16, 2); // 木紋
    T(g2, SIGNS.summit, w / 2, 62, 72, '#fff3d6', w - 50); T(g2, `${SIGNS.alt} ${Math.round(top)} ${SIGNS.m}`, w / 2, 124, 34, '#ffd27a', w - 80);
  });
  reg('haz', 0, 352, 256, 64, (g2, w, h) => { g2.fillStyle = '#ffcf33'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#17181b'; for (let x = -h; x < w + h; x += 40) { g2.beginPath(); g2.moveTo(x, h); g2.lineTo(x + 20, h); g2.lineTo(x + 20 + h, 0); g2.lineTo(x + h, 0); g2.closePath(); g2.fill(); } });
  reg('trail', 256, 352, 320, 96, (g2, w, h) => { g2.fillStyle = '#f1e7d6'; g2.beginPath(); g2.roundRect(0, 0, w, h, 14); g2.fill(); g2.fillStyle = '#6b3f1f'; g2.beginPath(); g2.roundRect(6, 6, w - 12, h - 12, 10); g2.fill(); T(g2, SIGNS.trail, w / 2 - 26, h / 2 + 2, 50, '#ffffff', 220); upArrow(g2, w - 40, h / 2, 24, '#ffffff'); });
  reg('mirror', 576, 384, 128, 128, (g2, w, h) => {
    g2.fillStyle = '#e8792b'; g2.beginPath(); g2.arc(w / 2, h / 2, w / 2, 0, TAU); g2.fill();
    const gr = g2.createRadialGradient(w * 0.42, h * 0.4, 4, w / 2, h / 2, w / 2 - 8); gr.addColorStop(0, '#f4f8fb'); gr.addColorStop(0.55, '#b9c9d6'); gr.addColorStop(1, '#6f8496');
    g2.fillStyle = gr; g2.beginPath(); g2.arc(w / 2, h / 2, w / 2 - 9, 0, TAU); g2.fill();
  });
  return { c, uv };
}

// ---- 合併網格（同材質、100 公尺一格的三角形放一起：看不到的那格不畫、輾扁找三角形快）----
class PB {
  constructor(ch) { this.ch = ch; this.bins = new Map(); this.k = 0; this.tris = 0; }
  at(x, z) { this.k = Math.floor(x / this.ch) * 1000 + Math.floor(z / this.ch); return this; }
  tri(m, a, b, c, col, ta, tb, tc) {
    const key = m + '|' + this.k; let g = this.bins.get(key);
    if (!g) this.bins.set(key, (g = { m, p: [], n: [], u: [], c: [] }));
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-12) return;
    nx /= l; ny /= l; nz /= l;
    g.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); g.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz); g.c.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
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
const ICO = (() => { // 二十面體（樹冠）
  const t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return p.map((q) => q / l); });
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  return { v, f };
})();
function segD(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1; let t = ((px - ax) * dx + (pz - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const ex = ax + dx * t - px, ez = az + dz * t - pz; return Math.sqrt(ex * ex + ez * ez); }
const plen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };

function buildMountain(V, opts = {}) {
  const T0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const aniso = opts.renderer ? Math.min(8, opts.renderer.capabilities.getMaxAnisotropy()) : 4;
  // 山路從村子的路（G → C）轉角的弧上的一點開始（警察的路網：端點在別條路上就接起來）
  const street = (V.roads || []).find((r) => r.kind === 'street' && r.pts.some((p) => Math.hypot(p[0] - CORNER[0], p[1] - CORNER[1]) < 12) && r.pts.some((p) => p[1] > -10));
  let start = [-252.5, -69.5];
  if (street) { let bd = Infinity; for (const p of street.pts) { const d = Math.hypot(p[0] - start[0], p[1] - start[1]); if (d < bd) { bd = d; start = [p[0], p[1]]; } } }
  const L = mountainLayout(start), top = L.top, n = L.n, HC = L.HC, W1 = L.W1;
  const at = (s, o = {}) => { // 中線上 s 那一點
    s = clamp(s, 0, L.len); let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L.S[m] <= s) lo = m; else hi = m; }
    const t = (s - L.S[lo]) / (L.S[hi] - L.S[lo] || 1);
    o.x = lerp(L.X[lo], L.X[hi], t); o.z = lerp(L.Z[lo], L.Z[hi], t); o.h = lerp(L.H[lo], L.H[hi], t);
    let tx = lerp(L.TX[lo], L.TX[hi], t), tz = lerp(L.TZ[lo], L.TZ[hi], t); const l = Math.hypot(tx, tz) || 1; o.tx = tx / l; o.tz = tz / l; o.k = lerp(L.K[lo], L.K[hi], t);
    return o;
  };
  const sOf = (x, z) => L.project(x, z, 30).s;

  // 1) 高度：找到那一格、那個三角形（對角線 00–11），跟畫出來的一模一樣
  const inBox = (x, z) => x >= MB.x0 && x <= MB.x1 && z >= MB.z0 && z <= MB.z1;
  const tri = (k, j, u, v) => { const i = j * W1 + k, h00 = HC[i], h10 = HC[i + 1], h01 = HC[i + W1], h11 = HC[i + W1 + 1]; return u >= v ? h00 + u * (h10 - h00) + v * (h11 - h10) : h00 + u * (h11 - h01) + v * (h01 - h00); };
  function hAt(x, z) {
    const fx = (x - MB.x0) / GS, fz = (z - MB.z0) / GS;
    if (!(fx >= 0 && fz >= 0 && fx < NX && fz < NZ)) return 0;
    const k = fx | 0, j = fz | 0; return tri(k, j, fx - k, fz - j);
  }
  const NRM = [0, 1, 0];
  function nAt(x, z) {
    const fx = (x - MB.x0) / GS, fz = (z - MB.z0) / GS;
    const k = fx | 0, j = fz | 0, u = fx - k, v = fz - j, i = j * W1 + k, h00 = HC[i], h10 = HC[i + 1], h01 = HC[i + W1], h11 = HC[i + W1 + 1];
    const gx = (u >= v ? h10 - h00 : h11 - h01) / GS, gz = (u >= v ? h11 - h10 : h01 - h00) / GS, l = Math.sqrt(gx * gx + gz * gz + 1);
    NRM[0] = -gx / l; NRM[1] = 1 / l; NRM[2] = -gz / l; return NRM;
  }
  const h0 = V.heightAt || (() => 0), n0 = V.normalAt || null, t0 = V.terrainAt || (() => false), s0 = V.surfaceAt;
  // 山路上：照路的高度（1 公尺一點，跟畫出來的柏油一樣平順；格子 2.5 公尺的三角形開快的時候會跳）；路邊 RE…FLAT 慢慢接回地形
  const PRH = { s: 0, d: 0, h: 0, i: 0, t: 0, side: 0 }, RE = RW / 2 + 0.6;
  function hMount(x, z) {
    const g = hAt(x, z), pr = L.project(x, z, FLAT, PRH);
    if (pr.i < 0) return g;
    const r = pr.h + 0.05; if (pr.d <= RE) return r;
    const u = (pr.d - RE) / (FLAT - RE), w = 1 - u * u * (3 - 2 * u); return g + (r - g) * w;
  }
  const heightAt = (x, z) => (inBox(x, z) ? hMount(x, z) : h0(x, z));
  const normalAt = (x, z) => { if (inBox(x, z) && x < MB.x1 && z < MB.z1) return nAt(x, z); if (n0) return n0(x, z); NRM[0] = 0; NRM[1] = 1; NRM[2] = 0; return NRM; };
  const inMountain = (x, z) => x >= MB.x0 - 4 && x <= MB.x1 + 4 && z >= MB.z0 - 4 && z <= MB.z1 + 4;
  const terrainAt = (x, z) => inMountain(x, z) || t0(x, z);

  // 2) 泥土捷徑、山頂
  const TR = []; { const P = TRAIL; for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]), m = Math.max(1, Math.round(l / 1.5)); for (let k = i === 1 ? 0 : 1; k <= m; k++) TR.push([lerp(P[i - 1][0], P[i][0], k / m), lerp(P[i - 1][1], P[i][1], k / m)]); } }
  const trailD = (x, z) => { let d = Infinity; for (let i = 1; i < TRAIL.length; i++) { const v = segD(x, z, TRAIL[i - 1][0], TRAIL[i - 1][1], TRAIL[i][0], TRAIL[i][1]); if (v < d) d = v; } return d; };
  const cross = []; { let last = -1e9; for (const [x, z] of TR) { const pr = L.project(x, z, 3); if (pr.d < 1.2 && pr.s - last > 20) { cross.push(pr.s); last = pr.s; } } } // 捷徑穿過山路的地方（護欄留口）
  const inRect = (R, x, z, m = 0) => x >= R.x0 - m && x <= R.x1 + m && z >= R.z0 - m && z <= R.z1 + m;
  const PRS = { s: 0, d: 0, h: 0, i: 0, t: 0, side: 0 };
  const onRoad = (x, z) => x > MB.x0 - 2 && x < MB.x1 + 2 && z > MB.z0 && z < -62 && L.project(x, z, 8, PRS).d <= RW / 2 + 0.4;
  const surfaceAt = (x, z) => {
    if (x < MB.x0 - 2 || x > MB.x1 + 2 || z < MB.z0 - 2 || z > -62) return s0(x, z);
    if (L.project(x, z, 8, PRS).d <= RW / 2 + 0.4) return 3;
    if (z > MB.z1) return s0(x, z); // 村子那邊（路以外）照舊
    if (inRect(SUMMIT, x, z)) return 3;
    if (trailD(x, z) <= 2.6) return 5;
    return 1;
  };

  // 3) 地形網格：草地的貼圖（跟村子同一張、世界座標）× 頂點色（高的地方深一點、陡的地方黃一點、雜訊）；法線照旁邊的高度算
  const group = new THREE.Group(); group.name = 'mountain';
  const vg = V.group && V.group.getObjectByName('ground');
  const terrMat = vg && vg.material ? vg.material.clone() : new THREE.MeshStandardMaterial({ color: 0x6f9a4a, roughness: 1 });
  terrMat.vertexColors = true; terrMat.polygonOffset = true; terrMat.polygonOffsetFactor = 1; terrMat.polygonOffsetUnits = 2; // 往後推一點（比村子的草地少）：路、泥土路蓋在上面不會閃
  let terrTris = 0;
  {
    const NV = W1 * (NZ + 1), P = new Float32Array(NV * 3), N = new Float32Array(NV * 3), CL = new Float32Array(NV * 3), UV = new Float32Array(NV * 2);
    const hc = (k, j) => HC[clamp(j, 0, NZ) * W1 + clamp(k, 0, NX)];
    const HI = [0.84, 0.93, 0.8], DRY = [1.16, 1.02, 0.8];
    for (let j = 0; j <= NZ; j++) for (let k = 0; k <= NX; k++) {
      const i = j * W1 + k, x = MB.x0 + k * GS, z = MB.z0 + j * GS, h = HC[i];
      const gx = (hc(k + 1, j) - hc(k - 1, j)) / (2 * GS), gz = (hc(k, j + 1) - hc(k, j - 1)) / (2 * GS), l = Math.sqrt(gx * gx + gz * gz + 1);
      P[i * 3] = x; P[i * 3 + 1] = h; P[i * 3 + 2] = z; N[i * 3] = -gx / l; N[i * 3 + 1] = 1 / l; N[i * 3 + 2] = -gz / l;
      UV[i * 2] = x / 6; UV[i * 2 + 1] = -z / 6;
      let c = mix([1, 1, 1], HI, ss(4, 45, h) * (0.7 + 0.3 * vnoise(x, z, 1 / 70, 41)));
      c = mix(c, DRY, (1 - ss(0.62, 0.86, 1 / l)) * 0.85); // 陡坡：草比較黃、比較少
      const nk = 1 + vnoise(x, z, 1 / 31, 7) * 0.07 + vnoise(x, z, 1 / 9, 9) * 0.04;
      c = mix([1, 1, 1], mul(c, nk), ss(0, 6, h)); // 山腳跟村子的草地一樣
      CL[i * 3] = c[0]; CL[i * 3 + 1] = c[1]; CL[i * 3 + 2] = c[2];
    }
    const I = new Uint32Array(NX * NZ * 6); let q = 0;
    for (let j = 0; j < NZ; j++) for (let k = 0; k < NX; k++) { const a = j * W1 + k, b = a + 1, c = a + W1, d = c + 1; I[q++] = a; I[q++] = d; I[q++] = b; I[q++] = a; I[q++] = c; I[q++] = d; } // (00, 11, 10)、(00, 01, 11)：法線朝上，對角線跟 heightAt 一樣
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.BufferAttribute(CL, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
    geo.setIndex(new THREE.BufferAttribute(I, 1)); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, terrMat); m.name = 'mt-hill'; m.matrixAutoUpdate = false; group.add(m); terrTris = q / 3;
  }

  // 4) 山路（村子的路的貼圖：兩邊白線、中間雙黃線）＋轉角接過去那塊柏油（沒有線）＋泥土捷徑
  const vr = V.group && V.group.getObjectByName('road'), vp = V.group && V.group.getObjectByName('pave');
  const roadMat = vr && vr.material ? vr.material : new THREE.MeshStandardMaterial({ color: 0x3c3e42, roughness: 0.93 });
  const paveMat = vp && vp.material ? vp.material : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const U0 = 4 / 512, U1 = 204 / 512, UA = 50 / 512; // village.js 的 RU.main（大路那一欄）；UA：沒有線的柏油
  let roadTris = 0, trailTris = 0;
  const ribbonGeo = (rows, uvRow, col) => { // rows：[[左, 右], ...]（每點 [x, y, z]）；兩排之間兩個三角形
    const P = [], UV = [], C3 = [], I = [];
    rows.forEach((r, i) => { for (let k = 0; k < r.length; k++) { P.push(...r[k]); UV.push(...uvRow(i, k)); if (col) C3.push(...col); } });
    const w = rows[0].length;
    for (let i = 0; i < rows.length - 1; i++) for (let k = 0; k < w - 1; k++) { const a = i * w + k, b = a + 1, c = a + w, d = c + 1; I.push(a, b, d, a, d, c); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); if (col) geo.setAttribute('color', new THREE.Float32BufferAttribute(C3, 3));
    geo.setIndex(I); geo.computeVertexNormals(); geo.computeBoundingSphere(); return { geo, tris: I.length / 3 };
  };
  let sRoad0 = 0; for (let i = 0; i < n; i++) if (L.Z[i] < -80) { sRoad0 = L.S[i]; break; }
  {
    const rows = [], vs = [], o = {};
    for (let s = sRoad0; ; s += 2) {
      const ss2 = Math.min(s, L.len); at(ss2, o); const y = o.h + 0.05, lx = o.tz * (RW / 2), lz = -o.tx * (RW / 2);
      rows.push([[o.x + lx, y, o.z + lz], [o.x - lx, y, o.z - lz]]); vs.push(ss2 / 10);
      if (ss2 >= L.len) break;
    }
    const { geo, tris } = ribbonGeo(rows, (i, k) => [k ? U1 : U0, vs[i]]);
    const m = new THREE.Mesh(geo, roadMat); m.name = 'mt-road'; m.matrixAutoUpdate = false; group.add(m); roadTris += tris;
    // 轉角：村子的路（寬 10.5）北邊接到山路
    const j = ribbonGeo([[[-255.25, 0.036, -67], [-244.75, 0.036, -67]], [[-255.25, 0.036, sRoad0 > 0 ? at(sRoad0).z - 0.5 : -81], [-244.75, 0.036, sRoad0 > 0 ? at(sRoad0).z - 0.5 : -81]]], (i, k) => [UA, i * 1.4]);
    const mj = new THREE.Mesh(j.geo, roadMat); mj.name = 'mt-road-join'; mj.matrixAutoUpdate = false; group.add(mj); roadTris += j.tris;
  }
  { // 泥土捷徑：沿著地形的一條（水泥地的貼圖 × 土色），3 個點寬
    const rows = [], DIRT = C('#8a6644');
    for (let i = 0; i < TR.length; i++) {
      const a = TR[Math.max(0, i - 1)], b = TR[Math.min(TR.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, lx = dz / l, lz = -dx / l, [x, z] = TR[i];
      const row = []; for (const o of [2.3, 0, -2.3]) { const px = x + lx * o, pz = z + lz * o; row.push([px, heightAt(px, pz) + (onRoad(px, pz) ? 0.02 : 0.08), pz]); }
      rows.push(row);
    }
    const { geo, tris } = ribbonGeo(rows, (i, k) => [TR[i][0] / 4 + k * 0.6, TR[i][1] / 4], DIRT);
    const m = new THREE.Mesh(geo, paveMat); m.name = 'mt-trail'; m.matrixAutoUpdate = false; group.add(m); trailTris = tris;
  }

  // 5) 東西：護欄、急彎路牌、反光鏡、警示板、起點終點的拱門、往山頂的牌子、山頂（停車場、涼亭、觀景台的欄杆、招牌、板凳）、樹
  const SA = signAtlas(top), U = SA.uv;
  const tSign = new THREE.CanvasTexture(SA.c); tSign.colorSpace = THREE.SRGBColorSpace; tSign.anisotropy = aniso;
  const mats = {
    main: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }),
    sign: new THREE.MeshStandardMaterial({ map: tSign, vertexColors: true, emissive: 0xffffff, emissiveMap: tSign, emissiveIntensity: 0.3, roughness: 0.6 }),
    pave: paveMat,
  };
  const B = new PB(100), colliders = [], WHITE = [1, 1, 1], WU = dotUV(U.white);
  const addBox = (x, z, hx, hz, rot, h, extra) => { const c = { t: 'box', x, z, hx, hz, rot, h }; if (extra) Object.assign(c, extra); colliders.push(c); return c; };
  const addCircle = (x, z, r, h, extra) => { const c = { t: 'circle', x, z, r, h }; if (extra) Object.assign(c, extra); colliders.push(c); return c; };
  const box = (m, T, b, col, uv = {}) => { // 方塊（本地 [x0, y0, z0, x1, y1, z1]）；uv：{ pz, nz, px, nx } 哪一面貼招牌
    const [x0, y0, z0, x1, y1, z1] = b, P = T.p, cc = (k) => (Array.isArray(col) ? col : col[k] || col._ || WHITE);
    B.at(T.x, T.z);
    const f = (k, a, bb, c, d) => { if (uv[k] === false) return; const mm = uv[k] ? 'sign' : m; B.quad(mm, P(...a), P(...bb), P(...c), P(...d), uv[k] ? WHITE : cc(k), uv[k] || (mm === 'sign' ? WU : null)); };
    f('pz', [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); f('nz', [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    f('px', [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]); f('nx', [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    f('py', [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
  };
  const cyl = (T, x, z, y0, y1, r0, r1, nseg, col, cap = true) => { // 直的圓柱（本地）
    const P = (a, r, y) => T.p(x + Math.cos(a) * r, y, z - Math.sin(a) * r); B.at(T.x, T.z);
    for (let i = 0; i < nseg; i++) {
      const a = (i / nseg) * TAU, b = ((i + 1) / nseg) * TAU;
      if (r1 > 0) B.quad('main', P(a, r0, y0), P(b, r0, y0), P(b, r1, y1), P(a, r1, y1), col); else B.tri('main', P(a, r0, y0), P(b, r0, y0), T.p(x, y1, z), col);
      if (cap && r1 > 0) B.tri('main', T.p(x, y1, z), P(a, r1, y1), P(b, r1, y1), col);
    }
  };
  const blob = (cx, cy, cz, rx, ry, rz, col, jit, seed, shade = 0.16) => { // 一團（樹冠）
    const { v, f } = ICO, Pp = v.map((p, i) => { const k = 1 + (hash2(seed, i) - 0.5) * 2 * jit; return [cx + p[0] * rx * k, cy + p[1] * ry * k, cz + p[2] * rz * k]; });
    B.at(cx, cz); f.forEach(([a, b, c], i) => { const ny = (v[a][1] + v[b][1] + v[c][1]) / 3, k = 0.88 + ny * 0.14 + (hash2(seed + 9, i) - 0.5) * shade; B.tri('main', Pp[a], Pp[b], Pp[c], mul(col, k)); });
  };
  const signQuad = (T, x0, y0, x1, y1, z, reg, back) => { // 本地 z＝z 那一面（朝 +z）貼招牌；back：背面的顏色（null＝不畫背面）
    B.at(T.x, T.z); B.quad('sign', T.p(x0, y0, z), T.p(x1, y0, z), T.p(x1, y1, z), T.p(x0, y1, z), WHITE, reg);
    if (back) B.quad('main', T.p(x1, y0, z - 0.02), T.p(x0, y0, z - 0.02), T.p(x0, y1, z - 0.02), T.p(x1, y1, z - 0.02), back);
  };
  const o1 = {}, o2 = {};
  const rot = (tx, tz) => Math.atan2(-tz, tx); // 碰撞盒的 rot、frame 的 ry：跟 heading 一樣（0 朝東、π/2 朝北）
  const GALV = C('#b9bec4'), POST = C('#8f959c');

  // 5a) 護欄：下坡那邊、髮夾彎外側（離中線 5.3 公尺）；捷徑穿過的地方、山頂停車場留口；一段一段（最長 8 公尺）是一個碰撞盒（越野車輾得扁）
  const slopeAt = (s, sd) => { // 這一點往左（0）／右（1）的坡（6 公尺那些點）
    const k = clamp(Math.round(s / 6), 0, L.CS.length - 1); return L.CS[k].sl[sd];
  };
  const railS0 = L.s0 + 14, railS1 = L.len - 34, RO = 5.3;
  let rails = 0;
  const railRuns = [[], []];
  for (let sd = 0; sd < 2; sd++) {
    let run = null;
    for (let s = railS0; s <= railS1; s += 2) {
      at(s, o1);
      const outside = Math.abs(o1.k) > 1 / 30 && (sd === 0 ? o1.k > 0 : o1.k < 0);
      const want = (slopeAt(s, sd) < -0.22 || outside) && !cross.some((c) => Math.abs(c - s) < 8);
      if (want) { if (!run) railRuns[sd].push((run = [s, s])); else run[1] = s; } else run = null;
    }
  }
  for (let sd = 0; sd < 2; sd++) for (const [a, b] of railRuns[sd]) {
    if (b - a < 6) continue;
    const pieces = Math.max(1, Math.ceil((b - a) / 8)), pl = (b - a) / pieces, sg = sd === 0 ? 1 : -1;
    for (let p = 0; p < pieces; p++) {
      const sa = a + p * pl, sb = sa + pl;
      const pt = (s) => { at(s, o1); return [o1.x + o1.tz * RO * sg, o1.h, o1.z - o1.tx * RO * sg, o1.tx, o1.tz]; };
      // 板子：每 2 公尺一段（兩面）
      for (let s = sa; s < sb - 1e-6; s += 2) {
        const A = pt(s), Bq = pt(Math.min(sb, s + 2));
        B.at(A[0], A[2]);
        const ya0 = A[1] + 0.52, ya1 = A[1] + 0.84, yb0 = Bq[1] + 0.52, yb1 = Bq[1] + 0.84;
        B.quad('main', [A[0], ya0, A[2]], [Bq[0], yb0, Bq[2]], [Bq[0], yb1, Bq[2]], [A[0], ya1, A[2]], GALV); B.quad('main', [Bq[0], yb0, Bq[2]], [A[0], ya0, A[2]], [A[0], ya1, A[2]], [Bq[0], yb1, Bq[2]], mul(GALV, 0.9));
        B.quad('main', [A[0], ya1, A[2]], [Bq[0], yb1, Bq[2]], [Bq[0] - sg * Bq[4] * 0.0, yb1 + 0.02, Bq[2]], [A[0], ya1 + 0.02, A[2]], GALV);
      }
      for (let s = sa; s <= sb + 1e-6; s += 4) { const A = pt(s), T = frame(A[0], A[1], A[2], rot(A[3], A[4])); box('main', T, [-0.06, -0.3, -0.06 - sg * 0.12, 0.06, 0.82, 0.06 - sg * 0.12], POST); }
      const M0 = pt(sa + pl / 2), Ar = pt(sa), Br = pt(sb);
      addBox(M0[0], M0[2], Math.hypot(Br[0] - Ar[0], Br[2] - Ar[2]) / 2 + 0.1, 0.2, rot(Br[0] - Ar[0], Br[2] - Ar[2]), 0.9, { mt: 'rail' });
      rails++;
    }
  }

  // 5b) 髮夾彎：急彎牌（上山、下山兩個方向，彎前 32 公尺、右手邊）、反光鏡（外側中間）、警示板（外側護欄後面三片）
  const HP = [[2, 3], [4, 5], [6, 7], [8, 9]].map(([a, b]) => { const sa = sOf(CTRL[a][0], CTRL[a][1]), sb = sOf(CTRL[b][0], CTRL[b][1]); return { a: sa - 12, b: sb + 12, m: (sa + sb) / 2 }; });
  const curveSign = (s, dir) => { // dir 1：給上山的車看（在路的右邊、面向下面）；−1：給下山的車
    at(s, o1); const sg = dir > 0 ? -1 : 1, x = o1.x + o1.tz * 6.1 * sg, z = o1.z - o1.tx * 6.1 * sg, y = heightAt(x, z);
    const T = frame(x, y, z, rot(o1.tx, o1.tz) + (dir > 0 ? Math.PI / 2 : -Math.PI / 2)); // 本地 +z 朝來的車
    cyl(T, 0, 0, -0.3, 2.3, 0.05, 0.05, 5, POST); B.at(x, z);
    const c = 2.75, r = 0.5, q = U.curve, um = (q[0] + q[2]) / 2, vm = (q[1] + q[3]) / 2;
    B.tri('sign', T.p(0, c + r, 0.07), T.p(-r, c, 0.07), T.p(0, c - r, 0.07), WHITE, [um, q[3]], [q[0], vm], [um, q[1]]); B.tri('sign', T.p(0, c + r, 0.07), T.p(0, c - r, 0.07), T.p(r, c, 0.07), WHITE, [um, q[3]], [um, q[1]], [q[2], vm]);
    B.tri('main', T.p(0, c + r, 0.05), T.p(r, c, 0.05), T.p(0, c - r, 0.05), POST); B.tri('main', T.p(0, c + r, 0.05), T.p(0, c - r, 0.05), T.p(-r, c, 0.05), POST);
    addCircle(x, z, 0.08, 3.2, { mt: 'sign' });
  };
  for (const hp of HP) {
    curveSign(hp.a - 32, 1); curveSign(hp.b + 32, -1);
    at(hp.m, o1); const outS = o1.k > 0 ? 1 : -1; // 外側（左＝1）
    { const x = o1.x + o1.tz * 7.2 * outS, z = o1.z - o1.tx * 7.2 * outS, y = heightAt(x, z), T = frame(x, y, z, rot(o1.tx, o1.tz) + (outS > 0 ? -Math.PI / 2 : Math.PI / 2)); // 反光鏡：面向路
      cyl(T, 0, 0, -0.3, 3.0, 0.05, 0.05, 6, C('#e8792b')); box('main', T, [-0.04, 2.55, -0.08, 0.04, 2.62, 0.18], C('#e8792b'));
      for (const dx of [-0.55, 0.55]) { const R = 0.42, cy = 2.95, cz = 0.2, nseg = 10, q = U.mirror, um = (q[0] + q[2]) / 2, vm = (q[1] + q[3]) / 2, ru = (q[2] - q[0]) / 2, rv = (q[3] - q[1]) / 2; B.at(x, z);
        for (let i = 0; i < nseg; i++) { const a = (i / nseg) * TAU, b = ((i + 1) / nseg) * TAU; B.tri('sign', T.p(dx, cy, cz), T.p(dx + Math.cos(a) * R, cy + Math.sin(a) * R, cz), T.p(dx + Math.cos(b) * R, cy + Math.sin(b) * R, cz), WHITE, [um, vm], [um + Math.cos(a) * ru, vm + Math.sin(a) * rv], [um + Math.cos(b) * ru, vm + Math.sin(b) * rv]); B.tri('main', T.p(dx, cy, cz - 0.03), T.p(dx + Math.cos(b) * R, cy + Math.sin(b) * R, cz - 0.03), T.p(dx + Math.cos(a) * R, cy + Math.sin(a) * R, cz - 0.03), C('#e8792b')); }
        box('main', T, [Math.min(0, dx), 2.9, 0.12, Math.max(0, dx), 3.0, 0.17], C('#e8792b')); }
      addCircle(x, z, 0.08, 3.4, { mt: 'mirror' }); }
    for (const ds of [-9, 0, 9]) { // 警示板（黃黑斜線）
      at(hp.m + ds, o1); const x = o1.x + o1.tz * 6.0 * outS, z = o1.z - o1.tx * 6.0 * outS, y = heightAt(x, z), T = frame(x, y, z, rot(o1.tx, o1.tz) + (outS > 0 ? -Math.PI / 2 : Math.PI / 2));
      for (const px of [-0.5, 0.5]) box('main', T, [px - 0.04, -0.2, -0.04, px + 0.04, 1.35, 0.04], POST);
      signQuad(T, -0.65, 0.85, 0.65, 1.3, 0.06, U.haz, C('#5c5f63'));
    }
  }

  // 5c) 爬山計時賽：起點（山腳，出了村子北邊）、終點（停車場前面）：地上一條線＋拱門（兩根柱子、上面紅布條）
  const S_START = L.s0 + 4, S_FIN = L.len - 30;
  const gantry = (s, reg, checker) => {
    at(s, o1); const T = frame(o1.x, o1.h, o1.z, rot(o1.tx, o1.tz) + Math.PI / 2); // 本地 +z 朝山下（上山的車看得到的那面）、本地 x 往左
    for (const px of [-5.9, 5.9]) { cyl(T, px, 0, -0.2, 5.6, 0.14, 0.14, 8, C('#d9dcdf')); addCircle(o1.x + o1.tz * px * -1 * -1, o1.z - o1.tx * px, 0.16, 5.6, { mt: 'gantry' }); }
    box('main', T, [-6, 5.25, -0.12, 6, 5.45, 0.12], C('#d9dcdf'));
    signQuad(T, -4.6, 4.1, 4.6, 5.25, 0.06, reg, C('#9e2a22'));
    B.at(o1.x, o1.z); // 地上的線
    const w = RW / 2 - 0.15, th = checker ? 0.9 : 0.4;
    if (!checker) B.quad('main', T.p(-w, 0.065, -th / 2), T.p(w, 0.065, -th / 2), T.p(w, 0.065, th / 2), T.p(-w, 0.065, th / 2).slice(), WHITE);
    else for (let r = 0; r < 2; r++) for (let q = 0; q < 12; q++) { const x0 = -w + (q * 2 * w) / 12, x1 = -w + ((q + 1) * 2 * w) / 12, z0 = -th / 2 + (r * th) / 2, z1 = z0 + th / 2; B.quad('main', T.p(x0, 0.065, z0), T.p(x1, 0.065, z0), T.p(x1, 0.065, z1), T.p(x0, 0.065, z1), (q + r) % 2 ? C('#f2f3f5') : C('#17181b')); }
  };
  gantry(S_START, U.start, false); gantry(S_FIN, U.finish, true);
  { // 村子的轉角：往山頂的綠牌子（路的東邊，面向南邊開過來的車）、捷徑口：越野車捷徑的牌子
    const x = -243.6, z = -86, T = frame(x, 0, z, 0);
    for (const px of [-0.9, 0.9]) cyl(T, px, 0, -0.1, 2.9, 0.05, 0.05, 5, POST);
    signQuad(T, -1.25, 1.95, 1.25, 2.78, 0.06, U.up, C('#5c5f63')); addCircle(x, z, 0.12, 2.9, { mt: 'sign' }); addCircle(x - 0.9, z, 0.06, 2.9, { mt: 'sign' }); addCircle(x + 0.9, z, 0.06, 2.9, { mt: 'sign' });
    const [tx0, tz0] = TRAIL[0], ty = heightAt(tx0 + 3.2, tz0), T2 = frame(tx0 + 3.2, ty, tz0, 0);
    for (const px of [-0.8, 0.8]) cyl(T2, px, 0, -0.2, 2.2, 0.05, 0.05, 5, C('#6b3f1f'));
    signQuad(T2, -1.1, 1.35, 1.1, 2.0, 0.06, U.trail, C('#4a2f18')); addCircle(tx0 + 3.2, tz0, 0.1, 2.2, { mt: 'sign' });
  }

  // 5d) 山頂：停車場（柏油、白線）、涼亭（紅柱子、兩層屋頂、板凳）、觀景台的欄杆（南邊、東邊）、招牌、板凳
  const TOP = top, ASPH = C('#55575b'), STONE = C('#cfc8ba'), LINE = C('#f2f3f5');
  const flatQuad = (m, x0, z0, x1, z1, y, col) => { B.at((x0 + x1) / 2, (z0 + z1) / 2); const a = [x0, y, z1], b = [x1, y, z1], c = [x1, y, z0], d = [x0, y, z0]; B.tri(m, a, b, c, col, [x0 / 4, z1 / 4], [x1 / 4, z1 / 4], [x1 / 4, z0 / 4]); B.tri(m, a, c, d, col, [x0 / 4, z1 / 4], [x1 / 4, z0 / 4], [x0 / 4, z0 / 4]); };
  flatQuad('pave', PARK.x0, PARK.z0, PARK.x1, PARK.z1, TOP + 0.045, ASPH);
  for (const z0 of [PARK.z0 + 0.6, PARK.z1 - 5.6]) for (let x = PARK.x0 + 4; x <= PARK.x1 - 2; x += 3.2) flatQuad('main', x - 0.06, z0, x + 0.06, z0 + 5, TOP + 0.06, LINE); // 停車格（北邊一排、南邊一排面向風景）
  flatQuad('pave', PAV.x - 6, PAV.z - 6, PAV.x + 6, PAV.z + 6, TOP + 0.05, STONE);
  flatQuad('pave', PARK.x1, PAV.z - 2, PAV.x - 6, PAV.z + 2, TOP + 0.05, STONE); // 停車場走到涼亭的石板路
  { // 涼亭
    const T = frame(PAV.x, TOP + 0.05, PAV.z, 0), RED = C('#b8322a'), DRED = C('#7a2a1e'), ROOF = C('#8c2f22'), GOLD = C('#d9a63a'), hw = PAV.hw;
    box('main', T, [-hw - 0.9, 0, -hw - 0.9, hw + 0.9, 0.35, hw + 0.9], C('#bdb5a5')); // 台基
    for (const [px, pz] of [[-hw, -hw], [hw, -hw], [-hw, hw], [hw, hw]]) { cyl(T, px, pz, 0.35, 3.45, 0.19, 0.17, 8, RED); addCircle(PAV.x + px, PAV.z - pz, 0.22, 4, { noCrush: true, mt: 'pavilion' }); }
    for (const [x0, z0, x1, z1] of [[-hw, -hw - 0.15, hw, -hw + 0.15], [-hw, hw - 0.15, hw, hw + 0.15], [-hw - 0.15, -hw, -hw + 0.15, hw], [hw - 0.15, -hw, hw + 0.15, hw]]) box('main', T, [x0, 3.2, z0, x1, 3.55, z1], DRED); // 樑
    const roof = (y0, y1, r0, r1, col, curl) => { // 四坡的屋頂（一圈四個梯形）、四個角翹起來
      const P = (a, r, y) => { const c = Math.cos(a), s = Math.sin(a), k = r / Math.max(Math.abs(c), Math.abs(s)); return T.p(c * k, y, -s * k); };
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2, b = a + Math.PI / 2; B.at(PAV.x, PAV.z); B.quad('main', P(a, r0, y0), P(b, r0, y0), P(b, r1, y1), P(a, r1, y1), mul(col, 0.92 + 0.08 * (i % 2))); B.quad('main', P(b, r0, y0 - 0.12), P(a, r0, y0 - 0.12), P(a, r0, y0), P(b, r0, y0), mul(col, 0.7)); B.quad('main', P(a, r0, y0 - 0.12), P(b, r0, y0 - 0.12), P(b, r1 * 0.9, y0 + 0.1), P(a, r1 * 0.9, y0 + 0.1), mul(col, 0.55)); }
      if (curl) for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a), k = r0 / Math.max(Math.abs(c), Math.abs(s)), px = c * k, pz = -s * k; B.at(PAV.x, PAV.z); B.tri('main', T.p(px * 0.93 - s * 0.35, y0, pz * 0.93 - c * 0.35), T.p(px * 1.12, y0 + 0.55, pz * 1.12), T.p(px * 0.93 + s * 0.35, y0, pz * 0.93 + c * 0.35), mul(col, 0.95)); }
    };
    roof(3.55, 4.55, hw + 1.6, hw * 0.55, ROOF, true); box('main', T, [-hw * 0.55, 4.55, -hw * 0.55, hw * 0.55, 4.85, hw * 0.55], DRED); roof(4.85, 5.75, hw * 0.95, 0.12, ROOF, true);
    cyl(T, 0, 0, 5.7, 6.15, 0.1, 0.18, 6, GOLD); cyl(T, 0, 0, 6.15, 6.35, 0.18, 0.02, 6, GOLD, false); // 頂上的寶珠
    for (const [x0, z0, x1, z1] of [[-hw + 0.4, -hw + 0.35, hw - 0.4, -hw + 0.85], [-hw + 0.4, hw - 0.85, hw - 0.4, hw - 0.35]]) { box('main', T, [x0, 0.35, z0, x1, 0.8, z1], C('#8a5a34')); } // 兩邊的長板凳
    box('main', T, [-0.55, 0.35, -0.55, 0.55, 1.05, 0.55], C('#9a958c')); // 石桌
  }
  // 觀景台的欄杆：木頭柱子＋兩根橫桿；南邊整排、東邊（涼亭外面）
  const WOOD = C('#7a5230');
  const railing = (x0, z0, x1, z1) => {
    const l = Math.hypot(x1 - x0, z1 - z0), ns = Math.max(1, Math.round(l / 2)), ry = rot((x1 - x0) / l, (z1 - z0) / l);
    for (let i = 0; i <= ns; i++) { const x = lerp(x0, x1, i / ns), z = lerp(z0, z1, i / ns); box('main', frame(x, TOP, z, ry), [-0.07, 0, -0.07, 0.07, 1.1, 0.07], WOOD); }
    for (const [y0, y1] of [[0.5, 0.6], [0.98, 1.1]]) box('main', frame((x0 + x1) / 2, TOP, (z0 + z1) / 2, ry), [-l / 2, y0, -0.05, l / 2, y1, 0.05], mul(WOOD, 1.1));
    const np = Math.max(1, Math.ceil(l / 8)); for (let p = 0; p < np; p++) { const a = p / np, b = (p + 1) / np; addBox(lerp(x0, x1, (a + b) / 2), lerp(z0, z1, (a + b) / 2), (l / np) / 2, 0.12, ry, 1.1, { noCrush: true, mt: 'view' }); }
  };
  railing(SUMMIT.x0 + 3, SUMMIT.z1 - 0.6, SUMMIT.x1 - 0.6, SUMMIT.z1 - 0.6); railing(SUMMIT.x1 - 0.6, SUMMIT.z1 - 0.6, SUMMIT.x1 - 0.6, SUMMIT.z0 + 0.6);
  { // 招牌：山頂觀景台（面向停車場：北邊）＋板凳（面向風景）
    const x = -270, z = SUMMIT.z1 - 2.2, T = frame(x, TOP, z, Math.PI);
    for (const px of [-1.4, 1.4]) cyl(T, px, 0, 0, 2.6, 0.08, 0.08, 6, WOOD);
    signQuad(T, -1.6, 1.4, 1.6, 2.45, 0.09, U.summit, C('#5a3a20')); addCircle(x - 1.4, z, 0.1, 2.6, { noCrush: true, mt: 'sign' }); addCircle(x + 1.4, z, 0.1, 2.6, { noCrush: true, mt: 'sign' });
    for (const bx of [-288, -252]) { const Tb = frame(bx, TOP, SUMMIT.z1 - 2.6, 0); box('main', Tb, [-1, 0.42, -0.25, 1, 0.5, 0.25], C('#8a5a34')); box('main', Tb, [-1, 0.5, 0.18, 1, 0.95, 0.26], C('#8a5a34')); for (const px of [-0.85, 0.85]) box('main', Tb, [px - 0.05, 0, -0.2, px + 0.05, 0.42, 0.2], C('#3a3c40')); addBox(bx, SUMMIT.z1 - 2.6, 1, 0.3, 0, 0.95, { mt: 'bench' }); }
  }

  // 5e) 樹：山坡上（路、捷徑、山頂、格子的邊旁邊不種）；圓的、尖的（杉樹）兩種
  const R = rng(20261009), GREENS = [C('#4f8a3a'), C('#5e9a42'), C('#447f37'), C('#6aa04a')], PINES = [C('#2f6a3a'), C('#3c7a44'), C('#356f3c')], TRUNK = C('#6b4a2f');
  let trees = 0;
  for (let z = MB.z0 + 10; z < MB.z1 - 8; z += 8.5) for (let x = MB.x0 + 10; x < MB.x1 - 8; x += 8.5) {
    const px = x + (R() - 0.5) * 7, pz = z + (R() - 0.5) * 7, kind = R(), sz = 0.8 + R() * 0.55, r3 = R(), seed = (R() * 1e6) | 0;
    const dens = 0.18 + 0.4 * ss(-0.1, 0.5, vnoise(px, pz, 1 / 60, 77)); if (r3 > dens) continue;
    const pr = L.project(px, pz, 14); if (pr.d < 10.5) continue;
    if (trailD(px, pz) < 5.5 || inRect(SUMMIT, px, pz, 5) || L.edgeK(px, pz) < 0.6 || pz > -128) continue;
    const y = heightAt(px, pz) - 0.15;
    if (kind < 0.5) { const T = frame(px, y, pz); cyl(T, 0, 0, 0, 2.2 * sz, 0.2 * sz, 0.14 * sz, 5, TRUNK, false); const g = GREENS[(R() * GREENS.length) | 0]; blob(px, y + 3.1 * sz, pz, 1.9 * sz, 1.6 * sz, 1.9 * sz, g, 0.22, seed); addCircle(px, pz, 0.3 * sz, 5 * sz, { mt: 'tree' }); }
    else { const T = frame(px, y, pz, R() * TAU); cyl(T, 0, 0, 0, 1.2 * sz, 0.18 * sz, 0.13 * sz, 5, TRUNK, false); cyl(T, 0, 0, 1.0 * sz, 6.4 * sz, 1.6 * sz, 0, 7, PINES[(R() * PINES.length) | 0], false); addCircle(px, pz, 0.28 * sz, 6.4 * sz, { mt: 'tree' }); }
    trees++;
  }
  const bp = B.build(mats, 'mt-'); group.add(bp.group);
  for (const c of colliders) V.colliders.push(c);
  V.group.add(group);

  // 6) 地方、路（小地圖、警察的路網：noNpc＝路上的車、居民不走）
  const zone = { x: (SUMMIT.x0 + SUMMIT.x1) / 2, z: (SUMMIT.z0 + SUMMIT.z1) / 2, hx: (SUMMIT.x1 - SUMMIT.x0) / 2, hz: (SUMMIT.z1 - SUMMIT.z0) / 2, rot: 0 };
  const places = { mountain: { name: '山頂', pos: [zone.x, zone.z], zone, spawn: { x: PARK.x0 + 8, z: (PARK.z0 + PARK.z1) / 2, heading: 0 }, view: { x: -270, z: SUMMIT.z1 - 1.5 } } };
  Object.assign(V.places, places);
  const rpts = []; for (let s = 0; s < L.len; s += 4) { at(s, o1); rpts.push([o1.x, o1.z]); } at(L.len, o1); rpts.push([o1.x, o1.z]); rpts[0] = [start[0], start[1]];
  V.roads.push({ pts: rpts, w: RW, kind: 'mount', noNpc: true });
  const prevDraw = V.mapDraw;
  V.mapDraw = (gg) => {
    if (prevDraw) prevDraw(gg);
    gg.save();
    for (let j = 0; j < NZ; j += 2) for (let k = 0; k < NX; k += 2) { const h = HC[j * W1 + k]; if (h < 3) continue; const band = Math.floor(h / 20); gg.fillStyle = `rgba(${86 - band * 6},${128 - band * 4},${76 - band * 5},${0.16 + band * 0.05})`; gg.fillRect(MB.x0 + k * GS, MB.z0 + j * GS, GS * 2 + 0.3, GS * 2 + 0.3); } // 山（越高越深）
    gg.lineCap = 'round'; gg.lineJoin = 'round';
    gg.strokeStyle = 'rgba(214,180,138,0.9)'; gg.lineWidth = 3.5; gg.setLineDash([5, 5]); gg.beginPath(); TRAIL.forEach(([x, z], i) => (i ? gg.lineTo(x, z) : gg.moveTo(x, z))); gg.stroke(); gg.setLineDash([]);
    gg.strokeStyle = '#e9ebee'; gg.lineWidth = RW * 0.95; gg.beginPath(); rpts.forEach(([x, z], i) => (i ? gg.lineTo(x, z) : gg.moveTo(x, z))); gg.stroke();
    gg.fillStyle = 'rgba(201,205,212,0.85)'; gg.fillRect(PARK.x0, PARK.z0, PARK.x1 - PARK.x0, PARK.z1 - PARK.z0);
    gg.restore();
  };

  // 7) 路線：山上 → 沿著山路；去山頂：先到村子的轉角（照村子的路），再沿著山路上去
  const route0 = V.route;
  const join = (...rs) => { const pts = []; for (const r of rs) for (const p of r.pts || r) { const q = pts[pts.length - 1]; if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.05) pts.push([p[0], p[1]]); } return { pts, len: plen(pts) }; };
  const along = (s0r, s1r) => { const pts = [], st = s1r >= s0r ? 4 : -4; for (let s = s0r; st > 0 ? s < s1r : s > s1r; s += st) { at(s, o2); pts.push([o2.x, o2.z]); } at(s1r, o2); pts.push([o2.x, o2.z]); return pts; };
  const PR2 = { s: 0, d: 0, h: 0, i: 0, t: 0, side: 0 };
  const onMount = (x, z) => inMountain(x, z) || onRoad(x, z);
  const best = (list) => list.filter((r) => r && r.pts.length > 1).reduce((a, b) => (!a || b.len < a.len ? b : a), null);
  function toCorner(x, z) { // 村子 → 轉角（從 G 沿著村子的路往東、或從 C 往北）
    if (!street) return route0(x, z, 'G');
    const sp = street.pts, ci = sp.findIndex((p) => Math.hypot(p[0] - start[0], p[1] - start[1]) < 0.01);
    if (ci < 0) return route0(x, z, 'G');
    const a = sp[0], first = Math.hypot(a[0] + 300, a[1] + 72) < 1 ? 'G' : 'C', other = first === 'G' ? 'C' : 'G';
    const rA = route0(x, z, first), rB = route0(x, z, other);
    return best([join(rA.pts, sp.slice(0, ci + 1)), join(rB.pts, sp.slice(ci).reverse())]);
  }
  V.route = (x, z, dest) => {
    const on = onMount(x, z);
    if (dest !== 'mountain' && !on) return route0(x, z, dest); // 山下去山下：完全照舊
    const pr = L.project(x, z, 400, PR2), sNow = pr.i >= 0 ? pr.s : 0;
    if (dest === 'mountain') {
      if (on && pr.i >= 0) return join([[x, z]], along(sNow, L.len), [places.mountain.pos]);
      const r = toCorner(x, z); return join(r.pts, along(0, L.len), [places.mountain.pos]);
    }
    const down = join([[x, z]], along(sNow, 0)), r = route0(start[0], start[1], dest); // 山上 → 沿著山路下山 → 村子的路
    return join(down.pts, r.pts);
  };
  V.surfaceAt = surfaceAt; V.heightAt = heightAt; V.normalAt = normalAt; V.terrainAt = terrainAt;

  const info = { meshes: 3 + bp.meshes, tris: terrTris + roadTris + trailTris + B.tris, terrainTris: terrTris, props: B.tris, trees, rails, ms: 0, layoutMs: +L.ms.toFixed(1) };
  if (V.info) V.info.mountain = info;
  const road = { len: L.len, n, x: L.X, z: L.Z, tx: L.TX, tz: L.TZ, h: L.H, s: L.S, project: (x, z, maxD = 40, out = null) => L.project(x, z, maxD, out || { s: 0, d: 0, h: 0, i: 0, t: 0, side: 0 }), at: (s) => at(s, {}) };
  at(S_START, o1); const trialStart = { x: o1.x, z: o1.z, heading: rot(o1.tx, o1.tz) }; at(S_FIN, o2);
  const M = {
    group, road, top, places, colliders, info, inMountain, onRoad: (x, z) => onRoad(x, z), heightAt, cross, trail: TRAIL,
    trial: { s0: S_START, s1: S_FIN, start: trialStart, finish: { x: o2.x, z: o2.z } }, summit: { ...SUMMIT }, park: { ...PARK }, pavilion: { ...PAV },
    dispose() {
      group.removeFromParent();
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      terrMat.dispose(); mats.main.dispose(); mats.sign.dispose(); tSign.dispose();
    },
  };
  V.mountain = M;
  const d0 = V.dispose; V.dispose = function () { M.dispose(); return d0 ? d0.apply(this, arguments) : undefined; };
  info.ms = +((typeof performance !== 'undefined' ? performance.now() : Date.now()) - T0).toFixed(1);
  return M;
}

return { buildMountain, mountainFonts, MOUNT_TEXT, mountainLayout };
})();
