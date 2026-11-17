// 第 79 批（Nick 2026-11-08「油門放開後的聲浪要大一點」）：引擎聲放油門（引擎煞車、斷油）的音量
// Node（不開瀏覽器、不出聲音）：拿 sound.js 的 SND_core 自己算 1 秒一段的音量（dB），每台車：
//   油門到底（0.7 轉）、放油門前 0.5 秒、放油門滑行（0.65 轉）、低轉滑行（0.3 轉）、怠速
//   1) 全油門跟以前一樣大（第 79 批沒動踩油門的聲音）
//   2) 放油門滑行比全油門小 3～12 dB（以前小 17～21 dB，比怠速還小聲）、比怠速大
//   3) 低轉滑行不比怠速小超過 6 dB；油門一踩，聲浪那一段馬上收掉
//   第 97 批：手排降檔 blip() 不斷油、轉速滑上去（升檔 shift() 照舊斷一下）；AV12 全油門越高轉越大聲、低轉低沉（頻譜重心低）高轉高亢
// node sound-test.mjs
import fs from 'node:fs';
import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const fails = [];
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const src = fs.readFileSync(path.join(dir, 'sound.js'), 'utf8');
const a = src.indexOf('function SND_core'), b = src.indexOf('// ---- AudioWorklet');
const S = new Function(src.slice(a, b) + '\nreturn { SND_core, SND_profile, SND_CARS };')();
const sr = 48000;
function run(car, phases) {
  const v = S.SND_core(S.SND_profile(car, []), sr, 7), buf = new Float32Array(1024), res = [];
  for (const [dur, rpm, thr] of phases) {
    let s2 = 0, n = 0; const N = Math.round((dur * sr) / 1024);
    for (let i = 0; i < N; i++) { v.set(rpm, thr, 30); buf.fill(0); v.render(buf, 1024); for (const x of buf) s2 += x * x; n += 1024; }
    res.push({ db: +(10 * Math.log10(s2 / n + 1e-12)).toFixed(1), info: v.info() });
  }
  return res;
}
// 第 78 批以前（放油門的聲浪還沒做）同一個算法量到的全油門（dB）：踩油門的聲音不能變
const WOT0 = { gc8: -19.8, yaris: -19.1, supra: -20.3, gtr: -19.4, jp4: -22.2, n4: -20.8 };
const rows = [];
for (const car of Object.keys(WOT0)) {
  const r = run(car, [[1, 0.7, 1], [0.5, 0.7, 0], [1, 0.65, 0], [1, 0.3, 0], [1, 0.13, 0], [0.3, 0.65, 1]]);
  const row = { car, wot: r[0].db, coast: r[2].db, lo: r[3].db, idle: r[4].db, over: +r[2].info.over.toFixed(2), back: +r[5].info.over.toFixed(2) };
  rows.push(row); console.log('  ', JSON.stringify(row));
}
check(rows.every((r) => Math.abs(r.wot - WOT0[r.car]) <= 0.6), `full throttle sounds the same as before (${rows.map((r) => `${r.car} ${r.wot}`).join(', ')})`);
check(rows.every((r) => r.wot - r.coast >= 2 && r.wot - r.coast <= 12 && r.coast > r.idle), `off throttle at high revs: only ${rows.map((r) => (r.wot - r.coast).toFixed(1)).join(' / ')} dB under full throttle (was 17–21) and louder than idle`);
check(rows.every((r) => r.lo > r.idle - 6 && r.over > 0.3 && r.back < 0.05), `low-rev coast near idle loudness (${rows.map((r) => `${r.lo}/${r.idle}`).join(', ')}); the overrun part is on while coasting (${rows.map((r) => r.over).join(' ')}) and gone right after the throttle comes back (${rows.map((r) => r.back).join(' ')})`);
// ---- 第 97 批（Nick 2026-11-17「降檔聲稍微不要那麼頓挫」）：blip()（手排降檔接上那一下）不斷油、轉速滑上去；shift()（升檔）照舊斷一下 ----
function win(v, sec, rpm, thr, ms = 5) { // 每 ms 毫秒一格的音量 dB、轉速
  const n = Math.round((ms / 1000) * sr), buf = new Float32Array(n), out = [];
  for (let k = 0; k < Math.round((sec * 1000) / ms); k++) { v.set(rpm, thr, 30); v.render(buf, n); let e = 0; for (const x of buf) e += x * x; out.push([10 * Math.log10(e / n + 1e-12), v.info().rpm]); }
  return out;
}
for (const car of ['gc8', 'aventador']) {
  const R = {};
  for (const how of ['shift', 'blip']) {
    const v = S.SND_core(S.SND_profile(car, []), sr, 5);
    win(v, 0.6, 0.45, 0.8); const pre = win(v, 0.1, 0.45, 0.8), lv0 = pre.reduce((a, b) => a + b[0], 0) / pre.length;
    v[how](); const w = win(v, 0.3, 0.75, 0.8);
    R[how] = { drop: +(lv0 - Math.min(...w.slice(0, 40).map((q) => q[0]))).toFixed(1), r10: +w[1][1].toFixed(2), r40: +w[7][1].toFixed(2), r250: +w[49][1].toFixed(2) };
  }
  console.log('  ', car, JSON.stringify(R));
  check(R.shift.drop > 8 && R.blip.drop < 6 && R.blip.r10 < 0.62 && R.blip.r250 > 0.72 && R.shift.r10 > R.blip.r10,
    `${car} downshift blip: no fuel-cut gap (drops ${R.blip.drop} dB; an upshift still cuts ${R.shift.drop} dB); revs glide 0.45 → ${R.blip.r10} (10 ms) → ${R.blip.r40} (40 ms) → ${R.blip.r250} (upshift ${R.shift.r10} at 10 ms)`);
}
// ---- 第 97 批（Nick「lamborghini AV12 低轉速時聲浪要低沉越高轉越高亢越大聲」）：全油門每個轉速的音量、頻譜重心 ----
function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const ang = (-2 * Math.PI) / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(ang * k), s = Math.sin(ang * k), ur = re[i + k], ui = im[i + k], j = i + k + len / 2, vr = re[j] * c - im[j] * s, vi = re[j] * s + im[j] * c; re[i + k] = ur + vr; im[i + k] = ui + vi; re[j] = ur - vr; im[j] = ui - vi; } } }
function tone(car, rpm) {
  const v = S.SND_core(S.SND_profile(car, []), sr, 7), N = 4096, buf = new Float32Array(1024), P = new Float64Array(N / 2); let e = 0, n = 0;
  for (let i = 0; i < 30; i++) { v.set(rpm, 1, 30); v.render(buf, 1024); }
  for (let k = 0; k < 8; k++) { const x = new Float32Array(N); for (let o = 0; o < N; o += 1024) { v.set(rpm, 1, 30); v.render(buf, 1024); x.set(buf, o); }
    for (const y of x) { e += y * y; n++; }
    const re = Float64Array.from(x, (y, i) => y * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N))), im = new Float64Array(N); fft(re, im); for (let i = 0; i < N / 2; i++) P[i] += re[i] * re[i] + im[i] * im[i]; }
  let tot = 0, cen = 0; for (let i = 1; i < N / 2; i++) { tot += P[i]; cen += P[i] * ((i * sr) / N); }
  return { rpm, db: +(10 * Math.log10(e / n)).toFixed(1), hz: Math.round(cen / tot) };
}
const av = [0.2, 0.3, 0.45, 0.6, 0.75, 0.9, 0.98].map((r) => tone('aventador', r));
console.log('   aventador', JSON.stringify(av));
const ups = av.slice(1).map((q, i) => q.db - av[i].db);
check(ups.every((d) => d > -0.6) && av[6].db - av[0].db > 5.5, `AV12 full throttle gets louder with the revs (${av.map((q) => q.db).join(' → ')} dB)`);
check(av[0].hz < 500 && av[1].hz < 500 && av[6].hz > 1800 && av[4].hz > av[2].hz + 800, `AV12 low revs are deep (${av[0].hz} / ${av[1].hz} Hz), high revs bright (${av.slice(3).map((q) => q.hz).join(' / ')} Hz)`);
console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join('\n- ')}` : '\nALL OK');
process.exit(fails.length ? 1 : 0);
