// 3D Supra A80 車身：側面、俯視、正面三個輪廓各自拉長成柱體，取交集並把邊修圓，
// 再加上後輪拱的圓鼓、挖出輪拱，得到一個 SDF（到車身表面的距離，裡面是負的），
// 最後用 surface nets 切成三角網格。
// 座標（公尺）：x 往車頭（-2.2575 車尾、+2.2575 車頭）、y 往上（0 是地面）、z 往車的右側。

export const CAR = { L: 4.515, W: 1.81, H: 1.275, xr: -1.3375, xf: 1.2125, R: 0.325 };

// ---- 2D 曲線：[x, y, 圓滑]，圓滑 0 是尖角 ----
export function curve(pts, closed = true, step = 0.01) {
  const n = pts.length, out = [];
  const P = (i) => pts[(i + n) % n];
  const tan = (i, dir) => {
    const p = P(i);
    if (!p[2] || (!closed && (i === 0 || i === n - 1))) return [0, 0];
    const a = P(i - 1), b = P(i + 1);
    const d0 = Math.hypot(p[0] - a[0], p[1] - a[1]), d1 = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const k = (dir > 0 ? d1 : d0) / (d0 + d1);
    return [(b[0] - a[0]) * k, (b[1] - a[1]) * k];
  };
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i), p1 = P(i + 1), m0 = tan(i, 1), m1 = tan(i + 1, -1);
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const m = Math.max(2, Math.ceil(len / step));
    for (let j = 0; j < m; j++) {
      const t = j / m, t2 = t * t, t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      out.push([h00 * p0[0] + h10 * m0[0] + h01 * p1[0] + h11 * m1[0], h00 * p0[1] + h10 * m0[1] + h01 * p1[1] + h11 * m1[1]]);
    }
  }
  if (!closed) out.push([P(n - 1)[0], P(n - 1)[1]]);
  return out;
}

// ---- 2D SDF 表格（先算好，之後用雙線性內插查）----
export function sdf2d(poly, x0, y0, x1, y1, res) {
  const nx = Math.ceil((x1 - x0) / res) + 1, ny = Math.ceil((y1 - y0) / res) + 1;
  const g = new Float32Array(nx * ny);
  const n = poly.length;
  const ax = new Float64Array(n), ay = new Float64Array(n), bx = new Float64Array(n), by = new Float64Array(n);
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; ax[i] = a[0]; ay[i] = a[1]; bx[i] = b[0]; by[i] = b[1]; }
  const xs = [];
  for (let j = 0; j < ny; j++) {
    const y = y0 + j * res;
    xs.length = 0;
    for (let i = 0; i < n; i++) {
      if ((ay[i] <= y) !== (by[i] <= y)) xs.push(ax[i] + ((y - ay[i]) / (by[i] - ay[i])) * (bx[i] - ax[i]));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k < nx; k++) {
      const x = x0 + k * res;
      let best = 1e9;
      for (let i = 0; i < n; i++) {
        const ex = bx[i] - ax[i], ey = by[i] - ay[i];
        const px = x - ax[i], py = y - ay[i];
        let t = (px * ex + py * ey) / (ex * ex + ey * ey || 1);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = px - t * ex, dy = py - t * ey, d = dx * dx + dy * dy;
        if (d < best) best = d;
      }
      let inside = false;
      for (let i = 0; i < xs.length; i++) if (xs[i] < x) inside = !inside;
      g[j * nx + k] = inside ? -Math.sqrt(best) : Math.sqrt(best);
    }
  }
  return { g, nx, ny, x0, y0, res };
}
export function look(t, x, y) {
  let fx = (x - t.x0) / t.res, fy = (y - t.y0) / t.res;
  if (fx < 0) fx = 0; else if (fx > t.nx - 1.001) fx = t.nx - 1.001;
  if (fy < 0) fy = 0; else if (fy > t.ny - 1.001) fy = t.ny - 1.001;
  const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j, k = j * t.nx + i, g = t.g;
  return (g[k] * (1 - u) + g[k + 1] * u) * (1 - v) + (g[k + t.nx] * (1 - u) + g[k + t.nx + 1] * u) * v;
}

export const smin = (a, b, r) => { const h = Math.max(r - Math.abs(a - b), 0) / r; return Math.min(a, b) - h * h * r * 0.25; };
export const smax = (a, b, r) => -smin(-a, -b, r);
// 圓角方塊（中心在原點，半邊長 hx, hy, hz，圓角 r）
export function rbox(x, y, z, hx, hy, hz, r) {
  const qx = Math.abs(x) - hx + r, qy = Math.abs(y) - hy + r, qz = Math.abs(z) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

// ---- 形狀 ----
const X = (xr) => xr - 2.2575; // 2D 版的 x 是從車尾量起
// 下半身側面（車窗以下）：車尾下 → 車尾 → 行李箱 → 沿著腰線 → 引擎蓋 → 車頭 → 車頭下 → 底盤
export const LOWER_SIDE = [
  [X(0.20), 0.185, 0], [X(0.035), 0.26, 1], [X(0.0), 0.44, 1], [X(0.02), 0.64, 1], [X(0.075), 0.80, 1], [X(0.20), 0.893, 1],
  [X(0.45), 0.928, 1], [X(0.72), 0.95, 1], [X(1.40), 0.985, 1], [X(2.30), 0.972, 1], [X(3.08), 0.935, 1], [X(3.52), 0.872, 1],
  [X(3.96), 0.79, 1], [X(4.30), 0.69, 1], [X(4.47), 0.60, 1], [X(4.515), 0.46, 1], [X(4.50), 0.30, 1], [X(4.44), 0.18, 1],
  [X(4.30), 0.125, 0], [X(3.85), 0.135, 0], [X(0.55), 0.16, 0],
];
// 車艙側面（前擋 → 車頂 → 後擋），下面伸進車身一點好融合
export const CABIN_SIDE = [
  [X(3.12), 0.90, 0], [X(2.76), 1.10, 1], [X(2.40), 1.25, 1], [X(2.02), 1.275, 1], [X(1.62), 1.245, 1], [X(1.20), 1.125, 1],
  [X(0.70), 0.94, 0], [X(0.66), 0.80, 0], [X(3.20), 0.80, 0],
];
// 俯視輪廓（最寬的地方，右半邊從車頭中間繞到車尾中間，再鏡射）
const mirrorZ = (r) => [...r, ...r.slice(1, -1).reverse().map(([x, z, s]) => [x, -z, s])];
export const PLAN = mirrorZ([
  [2.2575, 0, 1], [2.245, 0.30, 1], [2.20, 0.52, 1], [2.12, 0.68, 1], [2.00, 0.79, 1], [1.82, 0.862, 1], [1.55, 0.89, 1],
  [1.21, 0.897, 1], [0.85, 0.892, 1], [0.40, 0.878, 1], [-0.10, 0.876, 1], [-0.60, 0.886, 1], [-1.00, 0.900, 1], [-1.34, 0.905, 1],
  [-1.70, 0.898, 1], [-1.95, 0.868, 1], [-2.11, 0.80, 1], [-2.21, 0.66, 1], [-2.25, 0.42, 1], [-2.2575, 0, 1],
]);
// 車艙俯視（腰線高度），越高越往內收
export const CABIN_PLAN = mirrorZ([
  [0.95, 0, 1], [0.93, 0.40, 1], [0.86, 0.62, 1], [0.70, 0.715, 1], [0.30, 0.748, 1], [-0.30, 0.752, 1], [-0.80, 0.735, 1],
  [-1.15, 0.69, 1], [-1.40, 0.60, 1], [-1.56, 0.42, 1], [-1.60, 0, 1],
]);
export const CABIN_Y0 = 0.955, TUMBLE = 0.52;
// 下半身正面輪廓（z, y）
export const FRONT = [
  [0, 0.10, 0], [0.70, 0.10, 0], [0.84, 0.16, 1], [0.892, 0.30, 1], [0.905, 0.46, 1], [0.896, 0.60, 1], [0.866, 0.74, 1],
  [0.815, 0.86, 1], [0.765, 0.95, 1], [0.70, 1.02, 0], [0, 1.02, 0],
].concat([[-0.70, 1.02, 0], [-0.765, 0.95, 1], [-0.815, 0.86, 1], [-0.866, 0.74, 1], [-0.896, 0.60, 1], [-0.905, 0.46, 1], [-0.892, 0.30, 1], [-0.84, 0.16, 1], [-0.70, 0.10, 0]]);

// 拱形（中線高 → 兩側低多少）
const CROWN = [[-2.4, 0.05], [-2.0, 0.06], [-1.5, 0.07], [0.8, 0.07], [1.4, 0.07], [2.0, 0.08], [2.4, 0.09]];
const CABIN_CROWN = 0.05;
function lerpTable(t, x) {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const a = t[i - 1], b = t[i], u = (x - a[0]) / (b[0] - a[0]), s = u * u * (3 - 2 * u); return a[1] + (b[1] - a[1]) * s; }
  return t[t.length - 1][1];
}

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gau = (a, m, s) => Math.exp(-(((a - m) / s) ** 2));

// 車頭從 NOSE_X 切開：前面這段依套件換（原廠／Bomex），後面整台共用。
// 兩種套件在 x < 1.55 完全一樣，所以切口對得起來。
export const NOSE_X = 1.5;
export function makeSDF(opt = {}) {
  const kit = opt.kit || 'bomex';
  const res = 0.005;
  const side = sdf2d(curve(LOWER_SIDE), -2.45, -0.05, 2.45, 1.2, res);
  const cabS = sdf2d(curve(CABIN_SIDE), -1.8, 0.7, 1.2, 1.4, res);
  const plan = sdf2d(curve(PLAN), -2.45, -1.1, 2.45, 1.1, res);
  const cabP = sdf2d(curve(CABIN_PLAN), -1.9, -1.0, 1.2, 1.0, res);
  const front = sdf2d(curve(FRONT), -1.1, -0.05, 1.1, 1.2, res);
  const R1 = opt.R1 ?? 0.10, R2 = opt.R2 ?? 0.09, RC = opt.RC ?? 0.13, RU = opt.RU ?? 0.05;
  const hau = opt.haunch ?? { x: CAR.xr + 0.02, y: 0.56, z: 0.50, rx: 0.98, ry: 0.36, rz: 0.415, k: 0.16 };
  const fen = opt.fender ?? { x: CAR.xf + 0.05, y: 0.50, z: 0.50, rx: 0.82, ry: 0.30, rz: 0.395, k: 0.12 };
  const arch = opt.arch ?? { R: 0.365, zIn: 0.52 };
  const ell = (x, y, z, e) => {
    const dx = (x - e.x) / e.rx, dy = (y - e.y) / e.ry, dz = (z - e.z) / e.rz;
    return (Math.sqrt(dx * dx + dy * dy + dz * dz) - 1) * Math.min(e.rx, e.ry, e.rz);
  };
  return function f(x, y, z) {
    const az = Math.abs(z);
    const zz = az / 0.9;
    const hw = sstep(0.86, 1.05, x) * (1 - sstep(1.95, 2.18, x));
    const cr = lerpTable(CROWN, x) * zz * zz + hw * (0.014 * gau(az, 0.43, 0.13) - 0.016 * gau(az, 0.70, 0.075) - 0.008 * gau(az, 0, 0.22));
    const dS = look(side, x, y + cr);
    const dP = look(plan, x, az);
    const dF = look(front, az, y);
    let d = smax(dS, dP, R1);
    d = smax(d, dF, R2);
    d = smin(d, smax(ell(x, y, az, hau), dS, 0.08), hau.k);
    d = smin(d, smax(ell(x, y, az, fen), dS, 0.08), fen.k);
    // 車艙
    const zc = az / 0.75;
    const cS = look(cabS, x, y + CABIN_CROWN * zc * zc);
    const cP = look(cabP, x, az + Math.max(0, y - CABIN_Y0) * TUMBLE);
    const cab = smax(cS, cP, RC);
    d = smin(d, cab, RU);
    // 側裙：車門下面凸出一條
    if (x > -1.1 && x < 1.0 && y < 0.3) {
      const sk = smax(smax(az - 0.884, Math.max(y - 0.245, 0.14 - y), 0.03), Math.max(-0.93 - x, x - 0.80), 0.05);
      d = smin(d, sk, 0.02);
    }
    // 原廠前保桿：車頭圓順，保桿只微微凸出、邊緣修得很圓，下面一個寬的進氣口，沒有下巴
    if (x > 1.4 && kit === 'stock') {
      const bP = look(plan, x - 0.018 + (y - 0.30) * 0.05, az);
      const bump = smax(smax(bP, Math.max(y - 0.52, 0.14 - y), 0.05), 1.62 - x, 0.03);
      d = smin(d, bump, 0.03);
      d = smax(d, -rbox(x - 2.31, y - 0.262, az, 0.13, 0.057, 0.50 - Math.max(0, 0.27 - y) * 0.3, 0.035), 0.014);
    }
    // Bomex 前保桿：比上半部車頭凸出一點，上緣在大燈下面形成一道折線；下面再加一片下巴
    if (x > 1.4 && kit === 'bomex') {
      const bP = look(plan, x - 0.045 + (y - 0.33) * 0.06, az);
      const bump = smax(smax(bP, Math.max(y - 0.555, 0.125 - y), 0.028), 1.58 - x, 0.02);
      d = smin(d, bump, 0.008);
      const lip = smax(smax(look(plan, x - 0.055, az), Math.max(y - 0.15, 0.112 - y), 0.012), 1.72 - x, 0.02);
      d = smin(d, lip, 0.015);
      // 凹進去的水箱罩、轉角進氣口、下進氣口
      d = smax(d, -rbox(x - 2.32, y - 0.337, az, 0.16, 0.088, 0.53 - Math.max(0, 0.37 - y) * 0.4, 0.03), 0.012);
      d = smax(d, -rbox(x - 2.22, y - 0.372, az - 0.80, 0.12, 0.052, 0.05, 0.02), 0.008);
      d = smax(d, -rbox(x - 2.27, y - 0.232, az - 0.575, 0.10, 0.026, 0.13, 0.018), 0.008);
    }
    for (const [xa, zl] of [[CAR.xr, 0.875], [CAR.xf, 0.862]]) {
      if (y > 0.18 && Math.abs(x - xa) < 0.6) {
        const q = Math.hypot(x - xa, y - CAR.R) - (arch.R + 0.018);
        const lip = Math.hypot(q, az - zl) - 0.028;
        d = smin(d, lip, 0.035);
      }
    }
    for (const xa of [CAR.xr, CAR.xf]) {
      const dc = Math.hypot(x - xa, y - CAR.R) - arch.R;
      const a = smax(dc, arch.zIn - az, 0.03);
      d = smax(d, -a, 0.025);
    }
    return d;
  };
}

// ---- surface nets ----
// org：格點的原點（切一小塊時用整台的原點，格點座標才會跟整台一模一樣）
export function mesh(f, box, h, org = box) {
  const [bx0, by0, bz0, x1, y1, z1] = box;
  const [ox, oy, oz] = org, i0 = Math.round((bx0 - ox) / h), j0 = Math.round((by0 - oy) / h), k0 = Math.round((bz0 - oz) / h);
  const X = (i) => ox + (i0 + i) * h, Y = (j) => oy + (j0 + j) * h, Z = (k) => oz + (k0 + k) * h;
  const x0 = X(0), y0 = Y(0), z0 = Z(0);
  const nx = Math.ceil((x1 - x0) / h) + 1, ny = Math.ceil((y1 - y0) / h) + 1, nz = Math.ceil((z1 - z0) / h) + 1;
  const V = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) V[(k * ny + j) * nx + i] = f(X(i), Y(j), Z(k));
  const cell = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const co = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const val = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let m = 0;
    for (let c = 0; c < 8; c++) { const v = V[((k + co[c][2]) * ny + j + co[c][1]) * nx + i + co[c][0]]; val[c] = v; if (v < 0) m |= 1 << c; }
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of E) {
      if (((m >> a) & 1) === ((m >> b) & 1)) continue;
      const t = val[a] / (val[a] - val[b]);
      sx += co[a][0] + (co[b][0] - co[a][0]) * t; sy += co[a][1] + (co[b][1] - co[a][1]) * t; sz += co[a][2] + (co[b][2] - co[a][2]) * t; cnt++;
    }
    cell[(k * ny + j) * nx + i] = pos.length / 3;
    pos.push(X(i) + (sx / cnt) * h, Y(j) + (sy / cnt) * h, Z(k) + (sz / cnt) * h);
  }
  const idx = [];
  const C = (i, j, k) => cell[(k * ny + j) * nx + i];
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = V[(k * ny + j) * nx + i];
    const in0 = v0 < 0;
    // +x 邊
    if ((V[(k * ny + j) * nx + i + 1] < 0) !== in0) {
      const a = C(i, j, k), b = C(i, j - 1, k), c = C(i, j - 1, k - 1), d = C(i, j, k - 1);
      if (a >= 0 && b >= 0 && c >= 0 && d >= 0) in0 ? idx.push(a, b, c, a, c, d) : idx.push(a, c, b, a, d, c);
    }
    if ((V[(k * ny + j + 1) * nx + i] < 0) !== in0) {
      const a = C(i, j, k), b = C(i, j, k - 1), c = C(i - 1, j, k - 1), d = C(i - 1, j, k);
      if (a >= 0 && b >= 0 && c >= 0 && d >= 0) in0 ? idx.push(a, b, c, a, c, d) : idx.push(a, c, b, a, d, c);
    }
    if ((V[((k + 1) * ny + j) * nx + i] < 0) !== in0) {
      const a = C(i, j, k), b = C(i - 1, j, k), c = C(i - 1, j - 1, k), d = C(i, j - 1, k);
      if (a >= 0 && b >= 0 && c >= 0 && d >= 0) in0 ? idx.push(a, b, c, a, c, d) : idx.push(a, c, b, a, d, c);
    }
  }
  const P = new Float32Array(pos), N = new Float32Array(P.length);
  // 把點推到真正的表面上，法線用 SDF 的梯度
  const e = h * 0.25;
  for (let v = 0; v < P.length; v += 3) {
    let x = P[v], y = P[v + 1], z = P[v + 2];
    let gx = 0, gy = 0, gz = 0;
    for (let it = 0; it < 3; it++) {
      const d = f(x, y, z);
      gx = (f(x + e, y, z) - f(x - e, y, z)) / (2 * e); gy = (f(x, y + e, z) - f(x, y - e, z)) / (2 * e); gz = (f(x, y, z + e) - f(x, y, z - e)) / (2 * e);
      const g2 = gx * gx + gy * gy + gz * gz || 1;
      const s = Math.max(-h * 0.5, Math.min(h * 0.5, d / g2));
      x -= gx * s; y -= gy * s; z -= gz * s;
    }
    const gl = Math.hypot(gx, gy, gz) || 1;
    P[v] = x; P[v + 1] = y; P[v + 2] = z; N[v] = gx / gl; N[v + 1] = gy / gl; N[v + 2] = gz / gl;
  }
  return { positions: P, normals: N, indices: new Uint32Array(idx) };
}
