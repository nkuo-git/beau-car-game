// GC8 烘焙用（第 54 批，Nick「我比較希望細節做多一點」）：車子自己的暗影（ambient occlusion），算一次存進車身檔，遊戲裡不用算
// 只在 gc8-bake.mjs 的 Chromium 裡跑（不打包）：window.__AO.bake(THREE, group, opt) → 統計
//   射線打整台車（不透明的零件；玻璃、燈罩、網子不算）＋地面（y＝0）＋四個輪胎（烘焙的車沒有輪子：照 gc8-model.js 的位置放圓柱）
//   每一點沿著法線那一半的球面射 N 條（餘弦分布、每點轉一個亂數角度），D 公尺內打到東西就暗（越近越暗：1 − t/D）
//   車漆：照車身貼圖的 uv 算一張 W×H 的圖（左右兩邊同一個 uv：平均；保桿正面 noseCap 的 uv 借車底那一條：那幾格用保桿的）
//         → material.aoMap（遊戲裡只壓環境光和反光：太陽直接照到的地方還是亮的）
//   其他不透明的零件：每個頂點一個值 → geometry.userData.ao（gc8-bake.mjs 乘進頂點色）
window.__AO = (() => {
const LEAF = 4;
// ---- BVH：三角形（每個 9 個數字）→ 節點的盒子 NB（6 個數字）、NL（左、右；葉子：−(開始＋1)、個數）----
function buildBVH(T) {
  const n = T.length / 9, C = new Float32Array(n * 3), B = new Float32Array(n * 6), idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    idx[i] = i; const o = i * 9;
    for (let k = 0; k < 3; k++) { const a = T[o + k], b = T[o + 3 + k], c = T[o + 6 + k]; B[i * 6 + k] = Math.min(a, b, c); B[i * 6 + 3 + k] = Math.max(a, b, c); C[i * 3 + k] = (a + b + c) / 3; }
  }
  const cap = Math.max(1, 2 * Math.ceil(n / LEAF) * 2), NB = new Float32Array(cap * 6), NL = new Int32Array(cap * 2); let nn = 0;
  const select = (s, e, m, ax) => { // 第 m 小的（照重心的 ax 軸）放到 m，左邊都不比它大、右邊都不比它小
    let lo = s, hi = e - 1;
    while (hi > lo) {
      const piv = C[idx[(lo + hi) >> 1] * 3 + ax]; let i = lo, j = hi;
      while (i <= j) { while (C[idx[i] * 3 + ax] < piv) i++; while (C[idx[j] * 3 + ax] > piv) j--; if (i <= j) { const t = idx[i]; idx[i] = idx[j]; idx[j] = t; i++; j--; } }
      if (m <= j) hi = j; else if (m >= i) lo = i; else break;
    }
  };
  const build = (s, e) => {
    const k = nn++; let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9, cx0 = 1e9, cy0 = 1e9, cz0 = 1e9, cx1 = -1e9, cy1 = -1e9, cz1 = -1e9;
    for (let i = s; i < e; i++) { const t = idx[i], b = t * 6, c = t * 3;
      if (B[b] < x0) x0 = B[b]; if (B[b + 1] < y0) y0 = B[b + 1]; if (B[b + 2] < z0) z0 = B[b + 2]; if (B[b + 3] > x1) x1 = B[b + 3]; if (B[b + 4] > y1) y1 = B[b + 4]; if (B[b + 5] > z1) z1 = B[b + 5];
      if (C[c] < cx0) cx0 = C[c]; if (C[c + 1] < cy0) cy0 = C[c + 1]; if (C[c + 2] < cz0) cz0 = C[c + 2]; if (C[c] > cx1) cx1 = C[c]; if (C[c + 1] > cy1) cy1 = C[c + 1]; if (C[c + 2] > cz1) cz1 = C[c + 2]; }
    NB[k * 6] = x0; NB[k * 6 + 1] = y0; NB[k * 6 + 2] = z0; NB[k * 6 + 3] = x1; NB[k * 6 + 4] = y1; NB[k * 6 + 5] = z1;
    if (e - s <= LEAF) { NL[k * 2] = -(s + 1); NL[k * 2 + 1] = e - s; return k; }
    const dx = cx1 - cx0, dy = cy1 - cy0, dz = cz1 - cz0, ax = dx >= dy && dx >= dz ? 0 : dy >= dz ? 1 : 2, m = (s + e) >> 1;
    select(s, e, m, ax);
    const l = build(s, m), r = build(m, e); NL[k * 2] = l; NL[k * 2 + 1] = r; return k;
  };
  build(0, n);
  return { T, idx, NB, NL, nodes: nn };
}
// 最近的交點（tmax 以內；沒有就回 tmax）
const STACK = new Int32Array(256);
function cast(H, ox, oy, oz, dx, dy, dz, tmax) {
  const { T, idx, NB, NL } = H, ix = 1 / dx, iy = 1 / dy, iz = 1 / dz; let best = tmax, sp = 0; STACK[sp++] = 0;
  while (sp) {
    const k = STACK[--sp], b = k * 6;
    let ta = (NB[b] - ox) * ix, tb = (NB[b + 3] - ox) * ix, t0 = Math.min(ta, tb), t1 = Math.max(ta, tb);
    ta = (NB[b + 1] - oy) * iy; tb = (NB[b + 4] - oy) * iy; t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
    ta = (NB[b + 2] - oz) * iz; tb = (NB[b + 5] - oz) * iz; t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
    if (t1 < Math.max(t0, 0) || t0 > best) continue;
    const a = NL[k * 2], c = NL[k * 2 + 1];
    if (a >= 0) { STACK[sp++] = c; STACK[sp++] = a; continue; }
    for (let q = -a - 1, qe = q + c; q < qe; q++) { // Möller–Trumbore（兩面都算）
      const o = idx[q] * 9, e1x = T[o + 3] - T[o], e1y = T[o + 4] - T[o + 1], e1z = T[o + 5] - T[o + 2], e2x = T[o + 6] - T[o], e2y = T[o + 7] - T[o + 1], e2z = T[o + 8] - T[o + 2];
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
      if (det > -1e-12 && det < 1e-12) continue;
      const inv = 1 / det, sx = ox - T[o], sy = oy - T[o + 1], sz = oz - T[o + 2], u = (sx * px + sy * py + sz * pz) * inv; if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) * inv; if (v < 0 || u + v > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv; if (t > 1e-5 && t < best) best = t;
    }
  }
  return best;
}
// 輪胎（圓柱，軸沿著 z）：最近的交點（側面或兩邊的平面）
function castWheels(W, ox, oy, oz, dx, dy, dz, tmax) {
  let best = tmax;
  for (const w of W) {
    const px = ox - w.x, py = oy - w.y, a = dx * dx + dy * dy, bb = px * dx + py * dy, c = px * px + py * py - w.r * w.r;
    if (a > 1e-12) { const disc = bb * bb - a * c; if (disc >= 0) { const t = (-bb - Math.sqrt(disc)) / a; if (t > 1e-5 && t < best) { const z = oz + dz * t; if (z >= w.z0 && z <= w.z1) best = t; } } }
    if (dz * dz > 1e-12) for (const zc of [w.z0, w.z1]) { const t = (zc - oz) / dz; if (t > 1e-5 && t < best) { const x = px + dx * t, y = py + dy * t; if (x * x + y * y <= w.r * w.r) best = t; } }
  }
  return best;
}
const solid = (m) => !!m && !m.transparent && !(m.transmission > 0) && !(m.alphaTest > 0) && m.userData.slot !== 'interior';
const NOVERT = new Set(['paint', 'glass', 'lens', 'amber', 'tail', 'net', 'netF', 'mirror', 'bulb', 'interior']); // 這幾組不算頂點的暗影（車漆用貼圖；透明的、發光的不要）
function ranges(o) {
  const geo = o.geometry, total = geo.index ? geo.index.count : geo.attributes.position.count;
  return Array.isArray(o.material) ? (geo.groups.length ? geo.groups : [{ start: 0, count: total, materialIndex: 0 }]).map((r) => ({ start: r.start, count: Math.min(r.count, total - r.start), m: o.material[r.materialIndex] })) : [{ start: 0, count: total, m: o.material }];
}
// 主程式：opt = { N（每點幾條）, D（多遠）, W, H（車漆圖大小）, wheels: [{x, y, r, z0, z1}], paintMat, body（車身網格）, nose（保桿正面網格的名字）}
function bake(THREE, root, opt) {
  const t0 = performance.now(), N = opt.N ?? 48, D = opt.D ?? 0.35, W = opt.W ?? 512, H = opt.H ?? 256, WH = opt.wheels || [];
  root.updateMatrixWorld(true);
  // 1. 擋光的三角形（世界座標）
  const tri = []; const v = new THREE.Vector3();
  root.traverse((o) => { if (!o.isMesh) return; const pos = o.geometry.attributes.position, I = o.geometry.index, M = o.matrixWorld;
    for (const r of ranges(o)) { if (!solid(r.m)) continue; for (let t = r.start; t + 2 < r.start + r.count; t += 3) for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, I ? I.getX(t + k) : t + k).applyMatrix4(M); tri.push(v.x, v.y, v.z); } } });
  const BV = buildBVH(new Float32Array(tri)), t1 = performance.now();
  // 2. 方向：餘弦分布（分層：每一層的角度錯開）
  const DIRS = new Float32Array(N * 3); { const S1 = Math.round(Math.sqrt(N / 2)) || 1, S2 = Math.ceil(N / S1); let k = 0;
    for (let a = 0; a < S1 && k < N; a++) for (let b = 0; b < S2 && k < N; b++, k++) { const u1 = (a + 0.5) / S1, u2 = (b + 0.5 + (a % 2) * 0.5) / S2, r = Math.sqrt(u1), ph = 2 * Math.PI * u2; DIRS[k * 3] = r * Math.cos(ph); DIRS[k * 3 + 1] = r * Math.sin(ph); DIRS[k * 3 + 2] = Math.sqrt(Math.max(0, 1 - u1)); } }
  let rays = 0, seed = 12345; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ao = (px, py, pz, nx, ny, nz) => { // 一點的暗影（1＝完全沒擋）
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let ax = Math.abs(nx) < 0.9 ? 1 : 0, ay = ax ? 0 : 1, az = 0; // 切線
    let tx = ay * nz - az * ny, ty = az * nx - ax * nz, tz = ax * ny - ay * nx; const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx, ph = rnd() * 2 * Math.PI, cs = Math.cos(ph), sn = Math.sin(ph);
    const ox = px + nx * 0.002, oy = py + ny * 0.002, oz = pz + nz * 0.002; let occ = 0;
    for (let k = 0; k < N; k++) {
      const a = DIRS[k * 3] * cs - DIRS[k * 3 + 1] * sn, b = DIRS[k * 3] * sn + DIRS[k * 3 + 1] * cs, c = DIRS[k * 3 + 2];
      const dx = tx * a + bx * b + nx * c, dy = ty * a + by * b + ny * c, dz = tz * a + bz * b + nz * c;
      let t = cast(BV, ox, oy, oz, dx, dy, dz, D);
      if (dy < -1e-6) { const tg = -oy / dy; if (tg > 0 && tg < t) t = tg; } // 地面
      t = castWheels(WH, ox, oy, oz, dx, dy, dz, t);
      if (t < D) occ += 1 - t / D;
    }
    rays += N; return 1 - occ / N;
  };
  // 3. 每個頂點（車漆以外的不透明零件）：同一個位置＋法線只算一次
  const cache = new Map(); let nv = 0; const nm = new THREE.Matrix3(), n3 = new THREE.Vector3();
  root.traverse((o) => { if (!o.isMesh) return; const geo = o.geometry, pos = geo.attributes.position, nrm = geo.attributes.normal, I = geo.index, M = o.matrixWorld; if (!nrm) return;
    const want = new Uint8Array(pos.count); let any = false;
    for (const r of ranges(o)) { if (!solid(r.m) || NOVERT.has(r.m.userData.slot)) continue; for (let t = r.start; t < r.start + r.count; t++) { want[I ? I.getX(t) : t] = 1; any = true; } }
    if (!any) return;
    const A = (geo.userData.ao = new Float32Array(pos.count).fill(1)); nm.getNormalMatrix(M);
    for (let i = 0; i < pos.count; i++) { if (!want[i]) continue; v.fromBufferAttribute(pos, i).applyMatrix4(M); n3.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
      const key = `${Math.round(v.x * 2e3)},${Math.round(v.y * 2e3)},${Math.round(v.z * 2e3)},${Math.round(n3.x * 20)},${Math.round(n3.y * 20)},${Math.round(n3.z * 20)}`;
      let a = cache.get(key); if (a === undefined) { a = ao(v.x, v.y, v.z, n3.x, n3.y, n3.z); cache.set(key, a); } A[i] = a; nv++; } });
  const t2 = performance.now();
  // 4. 車漆的圖：車身（第 0 組＝車漆）、保桿正面（自己的 uv，蓋過車底）的三角形畫進 uv 格子
  const sum = new Float32Array(W * H), cnt = new Uint16Array(W * H), sumN = new Float32Array(W * H), cntN = new Uint16Array(W * H); let ns = 0;
  const raster = (o, rgs, S, Cn) => { const geo = o.geometry, pos = geo.attributes.position, nrm = geo.attributes.normal, uv = geo.attributes.uv, I = geo.index, M = o.matrixWorld; nm.getNormalMatrix(M);
    const P = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], Nn = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], U = [[0, 0], [0, 0], [0, 0]];
    for (const r of rgs) for (let t = r.start; t + 2 < r.start + r.count; t += 3) {
      for (let k = 0; k < 3; k++) { const i = I ? I.getX(t + k) : t + k; P[k].fromBufferAttribute(pos, i).applyMatrix4(M); Nn[k].fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize(); U[k][0] = uv.getX(i) * W - 0.5; U[k][1] = uv.getY(i) * H - 0.5; }
      const [a, b, c] = U, den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(den) < 1e-12) continue;
      const x0 = Math.max(0, Math.ceil(Math.min(a[0], b[0], c[0]) - 1e-6)), x1 = Math.min(W - 1, Math.floor(Math.max(a[0], b[0], c[0]) + 1e-6)), y0 = Math.max(0, Math.ceil(Math.min(a[1], b[1], c[1]) - 1e-6)), y1 = Math.min(H - 1, Math.floor(Math.max(a[1], b[1], c[1]) + 1e-6));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den, l3 = 1 - l1 - l2;
        if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
        const px = l1 * P[0].x + l2 * P[1].x + l3 * P[2].x, py = l1 * P[0].y + l2 * P[1].y + l3 * P[2].y, pz = l1 * P[0].z + l2 * P[1].z + l3 * P[2].z;
        const qx = l1 * Nn[0].x + l2 * Nn[1].x + l3 * Nn[2].x, qy = l1 * Nn[0].y + l2 * Nn[1].y + l3 * Nn[2].y, qz = l1 * Nn[0].z + l2 * Nn[1].z + l3 * Nn[2].z;
        const o2 = y * W + x; S[o2] += ao(px, py, pz, qx, qy, qz); Cn[o2]++; ns++;
      } } };
  const body = opt.body; raster(body, ranges(body).filter((r) => r.m === opt.paintMat), sum, cnt);
  root.traverse((o) => { if (o.isMesh && o.name === opt.nose) raster(o, ranges(o), sumN, cntN); });
  const AO = new Float32Array(W * H).fill(-1);
  for (let i = 0; i < W * H; i++) { if (cntN[i]) AO[i] = sumN[i] / cntN[i]; else if (cnt[i]) AO[i] = sum[i] / cnt[i]; }
  for (let it = 0; it < 6; it++) { const B2 = AO.slice(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o2 = y * W + x; if (AO[o2] >= 0) continue; let s = 0, c = 0; // 沒有三角形的格子：旁邊的平均（雙線性取樣的時候不會混到白的）
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = AO[yy * W + xx]; if (q >= 0) { s += q; c++; } }
    if (c) B2[o2] = s / c; } AO.set(B2); }
  const OUT = new Float32Array(W * H); // 3×3 模糊（雜點少一點）
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = AO[yy * W + xx], w = (2 - Math.abs(dx)) * (2 - Math.abs(dy)); if (q >= 0) { s += q * w; c += w; } } OUT[y * W + x] = c ? s / c : 1; }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), im = g.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { const a = Math.round(Math.min(1, OUT[i] / 0.97) * 255); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = a; im.data[i * 4 + 3] = 255; } // 0.97 以上＝1（空曠的地方不要有雜點）
  g.putImageData(im, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.flipY = false; opt.paintMat.aoMap = tex; opt.paintMat.needsUpdate = true;
  return { tris: tri.length / 9, nodes: BV.nodes, verts: nv, uniq: cache.size, samples: ns, rays, ms: [Math.round(t1 - t0), Math.round(t2 - t1), Math.round(performance.now() - t2)] };
}
return { bake, NOVERT };
})();
