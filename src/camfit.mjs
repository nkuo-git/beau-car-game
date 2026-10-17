// 照片相機的小工具（做車用，node）：跟 cview.html 的相機一模一樣
// 相機 c = { a, d, h, tx, ty, fov, rl }：位置 (tx + cos(a)·d, h, −sin(a)·d)，看 (tx, ty, 0)，fov＝垂直視角（度），rl＝照片轉幾度
//   setSize(W, H)        照片的像素大小（proj／back／hit 都用它）
//   proj(p, c)           車身座標 [x, y, z] → 照片像素 [u, v]（v 往下）
//   ray(px, c)           照片像素 → { o, d }（相機位置、單位方向）
//   back(px, c, axis, k) 照片像素打到平面 p[axis] = k 的點（axis 0=x 1=y 2=z）
//   hit(px, c, sdf)      照片像素打到車身表面：{ p, n }（沒打到 null）；sdf(x, y, z) → 距離
//   ratioAt(p, c)        在 p 的輪框橢圓「短軸／長軸」＝ |看的方向·z|
//   fit(pts, ratios, lo, hi, opt)  解相機：pts＝[[ [x,y,z] 或 (c,e)=>[x,y,z], [u,v] ], …]，ratios＝[[ [x,y,z], 比例 ], …]
//                        lo／hi＝[a, d, h, tx, ty, fov, rl, 其他要一起解的…] 的範圍；回傳 { c, e, err（平均像素誤差）, res }
let W = 1000, H = 1000;
export const setSize = (w, h) => { W = w; H = h; };
const D2R = Math.PI / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export function basis(c) {
  const a = c.a * D2R, P = [c.tx + Math.cos(a) * c.d, c.h, -Math.sin(a) * c.d], f = norm(sub([c.tx, c.ty, 0], P));
  let x = norm(cross(f, [0, 1, 0])), y = cross(x, f);
  const r = (c.rl || 0) * D2R, cs = Math.cos(r), sn = Math.sin(r);
  [x, y] = [[x[0] * cs + y[0] * sn, x[1] * cs + y[1] * sn, x[2] * cs + y[2] * sn], [-x[0] * sn + y[0] * cs, -x[1] * sn + y[1] * cs, -x[2] * sn + y[2] * cs]];
  return { P, f, x, y, t: Math.tan(c.fov * D2R / 2) };
}
export function proj(p, c, B = basis(c)) {
  const v = sub(p, B.P), z = dot(v, B.f), k = H / 2 / B.t / z;
  return [W / 2 + dot(v, B.x) * k, H / 2 - dot(v, B.y) * k];
}
export function ray([u, v], c, B = basis(c)) {
  const sx = (u - W / 2) / (H / 2) * B.t, sy = -(v - H / 2) / (H / 2) * B.t;
  return { o: B.P, d: norm([B.f[0] + B.x[0] * sx + B.y[0] * sy, B.f[1] + B.x[1] * sx + B.y[1] * sy, B.f[2] + B.x[2] * sx + B.y[2] * sy]) };
}
export function back(px, c, axis = 1, k = 0) {
  const { o, d } = ray(px, c), t = (k - o[axis]) / d[axis];
  return [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
}
export function hit(px, c, sdf, { far = 60, eps = 1e-4 } = {}) {
  const { o, d } = ray(px, c);
  let t = 0;
  for (let i = 0; i < 2000 && t < far; i++) {
    const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t], s = sdf(...p);
    if (s < eps) {
      const e = 1e-3, n = norm([sdf(p[0] + e, p[1], p[2]) - sdf(p[0] - e, p[1], p[2]), sdf(p[0], p[1] + e, p[2]) - sdf(p[0], p[1] - e, p[2]), sdf(p[0], p[1], p[2] + e) - sdf(p[0], p[1], p[2] - e)]);
      return { p, n, t };
    }
    t += Math.max(s * 0.9, eps);
  }
  return null;
}
export const ratioAt = (p, c) => Math.abs(norm(sub(p, basis(c).P))[2]);
// Nelder–Mead（在 lo..hi 裡，多試幾個起點）
function nm(f, x0, step, iters = 4000) {
  const n = x0.length; let S = [x0, ...x0.map((_, i) => x0.map((v, j) => v + (i === j ? step[j] : 0)))].map((x) => [x, f(x)]);
  for (let k = 0; k < iters; k++) {
    S.sort((a, b) => a[1] - b[1]);
    const c = Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += S[i][0][j] / n;
    const w = S[n], at = (t) => c.map((v, j) => v + t * (w[0][j] - v));
    const r = at(-1), fr = f(r);
    if (fr < S[0][1]) { const e = at(-2), fe = f(e); S[n] = fe < fr ? [e, fe] : [r, fr]; }
    else if (fr < S[n - 1][1]) S[n] = [r, fr];
    else { const ct = at(0.5), fc = f(ct); if (fc < w[1]) S[n] = [ct, fc]; else S = S.map(([x], i) => { if (!i) return S[0]; const y = x.map((v, j) => S[0][0][j] + 0.5 * (v - S[0][0][j])); return [y, f(y)]; }); }
    if (Math.abs(S[n][1] - S[0][1]) < 1e-12 && k > 200) break;
  }
  S.sort((a, b) => a[1] - b[1]); return S[0];
}
export function fit(pts, ratios = [], lo, hi, { tries = 30, wRatio = 400, seed = 1 } = {}) {
  let s = seed; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const toC = (x) => ({ c: { a: x[0], d: x[1], h: x[2], tx: x[3], ty: x[4], fov: x[5], rl: x[6] ?? 0 }, e: x.slice(7) });
  const clampPen = (x) => x.reduce((a, v, i) => a + (v < lo[i] ? (lo[i] - v) ** 2 : v > hi[i] ? (v - hi[i]) ** 2 : 0), 0) * 1e6;
  const cost = (x) => {
    const { c, e } = toC(x), B = basis(c); let sum = 0;
    for (const [p, uv] of pts) { const q = proj(typeof p === 'function' ? p(c, e) : p, c, B); sum += (q[0] - uv[0]) ** 2 + (q[1] - uv[1]) ** 2; }
    for (const [p, r] of ratios) sum += wRatio * (ratioAt(p, c) - r) ** 2 * 100;
    return sum + clampPen(x);
  };
  let best = null;
  for (let t = 0; t < tries; t++) {
    const x0 = lo.map((l, i) => l + (hi[i] - l) * rnd()), step = lo.map((l, i) => (hi[i] - l) * 0.1);
    let r = nm(cost, x0, step); r = nm(cost, r[0], step.map((v) => v * 0.1));
    if (!best || r[1] < best[1]) best = r;
  }
  const { c, e } = toC(best[0]), B = basis(c);
  const res = pts.map(([p, uv]) => { const q = proj(typeof p === 'function' ? p(c, e) : p, c, B); return Math.hypot(q[0] - uv[0], q[1] - uv[1]); });
  const round = (v) => Math.round(v * 1000) / 1000;
  return { c: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, round(v)])), e: e.map(round), err: res.reduce((a, b) => a + b, 0) / (res.length || 1), res: res.map((v) => Math.round(v * 10) / 10) };
}
