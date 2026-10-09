// 寬體套件的資料：從每台車的車身 SDF 量輪拱附近的車身側面（z），寫成 wide.js（WIDE[key]），車庫頁用 parts.js 的 wideKit() 做成加寬的葉子板
// 用法：node make-wide.mjs [key ...]（沒給就全部）
import fs from 'node:fs';
const CARS = {
  supra: { mod: './body.mjs', opt: { kit: 'bomex' }, xf: 1.2125, xr: -1.3375, RF: 0.325, RR: 0.325, trackF: 0.76, trackR: 0.765, wF: 0.235, wR: 0.265 },
  gtr: { mod: './gtr-body.mjs', xf: 1.29, xr: -1.375, RF: 0.327, RR: 0.327, trackF: 0.74, trackR: 0.745, wF: 0.245, wR: 0.245 },
  sp3: { mod: './sp3-body.mjs', xf: 1.21, xr: -1.441, RF: 0.3335, RR: 0.370, trackF: 0.8455, trackR: 0.8155, wF: 0.265, wR: 0.345 },
  jesko: { mod: './jesko-body.mjs', xf: 1.35, xr: -1.35, RF: 0.347, RR: 0.364, trackF: 0.85, trackR: 0.825, wF: 0.265, wR: 0.325 },
  yaris: { mod: './yaris-body.mjs', xf: 1.17, xr: -1.39, RF: 0.319, RR: 0.319, trackF: 0.7675, trackR: 0.7825, wF: 0.225, wR: 0.225 },
  gc8: { mod: './gc8-body.mjs', xf: 1.28, xr: -1.24, RF: 0.307, RR: 0.307, trackF: 0.7625, trackR: 0.7575, wF: 0.225, wR: 0.225 },
  p918: { mod: './p918-body.mjs', xf: 1.3135, xr: -1.4165, RF: 0.347, RR: 0.364, trackF: 0.832, trackR: 0.806, wF: 0.265, wR: 0.325 },
};
const out = fs.existsSync('wide.json') ? JSON.parse(fs.readFileSync('wide.json', 'utf8')) : {};
const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CARS);
const NK = 9, DR = 0.02; // 每個角度往外量 9 點、間隔 2 公分
for (const key of keys) {
  const C = CARS[key];
  const { makeSDF } = await import(C.mod);
  const f = makeSDF(C.opt || {});
  // (x, y) 這一點車身最外面的 z（從外面往裡找），找不到回 null
  const zs = (x, y) => {
    let z = 1.2;
    while (z > 0.2 && f(x, y, z) > 0) z -= 0.004;
    if (z <= 0.2) return null;
    let a = z, b = z + 0.004;
    for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (f(x, y, m) > 0) b = m; else a = m; }
    return (a + b) / 2;
  };
  const med = (a) => [...a].sort((p, q) => p - q)[a.length >> 1];
  const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  const win = (v, fn, w) => v.map((_, i) => fn(v.slice(Math.max(0, i - w), i + w + 1)));
  const axle = (x, R, track, w) => {
    const zt = track + w / 2; // 輪胎外側
    const th = [], r0s = [];
    for (let deg = -30; deg <= 210; deg += 6) {
      const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
      let r0 = null;
      for (let r = R + 0.005; r < R + 0.3; r += 0.005) {
        const y = R + s * r; if (y < 0.1) break;
        const q = zs(x + c * r, y);
        if (q != null && q > zt - 0.1) { r0 = r; break; }
      }
      if (r0 == null) continue;
      th.push(deg); r0s.push(r0);
    }
    // 輪拱邊緣：先用中位數去掉跳動，再平滑
    const ra = win(win(r0s, med, 2), mean, 2).map((v) => +v.toFixed(4));
    // 葉子板最下面切平：輪拱兩端邊緣最低的高度
    const yCut = +Math.max(0.1, Math.min(...th.map((d, i) => R + Math.sin((d * Math.PI) / 180) * ra[i]))).toFixed(4);
    let raw = th.map((d, i) => {
      const t = (d * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), row = [];
      for (let k = 0; k < NK; k++) { const r = ra[i] + k * DR; row.push(zs(x + c * r, Math.max(yCut, R + s * r))); }
      return row;
    });
    for (let i = raw.length - 1; i >= 0; i--) if (raw[i][0] == null) { raw.splice(i, 1); th.splice(i, 1); ra.splice(i, 1); }
    // 每一列從輪拱往外量到第一個不在車身上的點為止（kn＝有幾點；超出車身輪廓的點葉子板就停在輪廓上）
    const kn = raw.map((r) => { const k = r.findIndex((v) => v == null); return k < 0 ? NK : k; });
    // 每一欄沿角度：取鄰近最大（葉子板一定在車身外面）再平均，只用有量到的點
    const z = raw.map((r) => [...r]);
    for (let k = 0; k < NK; k++) {
      const ok = (i) => i >= 0 && i < raw.length && k < kn[i];
      const pick = (i, fn) => { const a = []; for (let j = i - 1; j <= i + 1; j++) if (ok(j)) a.push(fn(j)); return a; };
      const mx = raw.map((r, i) => (ok(i) ? Math.max(...pick(i, (j) => raw[j][k])) : null));
      raw.forEach((r, i) => { if (ok(i)) z[i][k] = mean(pick(i, (j) => mx[j])); });
    }
    z.forEach((r, i) => { for (let k = 0; k < NK; k++) r[k] = k < kn[i] ? +r[k].toFixed(4) : r[kn[i] - 1]; });
    return { x, y: R, th, ra, z, kn, yCut, zt: +zt.toFixed(4) };
  };
  out[key] = { f: axle(C.xf, C.RF, C.trackF, C.wF), r: axle(C.xr, C.RR, C.trackR, C.wR), dr: DR };
  const s = out[key];
  console.log(key, 'front', s.f.th.length, 'angles', s.f.th[0], '..', s.f.th.at(-1), 'cut', s.f.yCut, 'tire', s.f.zt, '| rear', s.r.th.length, s.r.th[0], '..', s.r.th.at(-1), 'cut', s.r.yCut, 'tire', s.r.zt);
}
fs.writeFileSync('wide.json', JSON.stringify(out));
const js = '// 寬體套件的資料（node make-wide.mjs 從車身 SDF 量的，不要手改）：每台車前後輪拱，每個角度 th 從輪拱邊緣 ra 往外每 dr 公尺車身側面的 z（低於 yCut 的點切平在 yCut）\n'
  + 'export const WIDE = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync('wide.js', js);
console.log('wide.js', js.length, 'bytes');
