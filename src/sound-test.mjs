// 第 79 批（Nick 2026-11-08「油門放開後的聲浪要大一點」）：引擎聲放油門（引擎煞車、斷油）的音量
// Node（不開瀏覽器、不出聲音）：拿 sound.js 的 SND_core 自己算 1 秒一段的音量（dB），每台車：
//   油門到底（0.7 轉）、放油門前 0.5 秒、放油門滑行（0.65 轉）、低轉滑行（0.3 轉）、怠速
//   1) 全油門跟以前一樣大（第 79 批沒動踩油門的聲音）
//   2) 放油門滑行比全油門小 3～12 dB（以前小 17～21 dB，比怠速還小聲）、比怠速大
//   3) 低轉滑行不比怠速小超過 6 dB；油門一踩，聲浪那一段馬上收掉
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
console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join('\n- ')}` : '\nALL OK');
process.exit(fails.length ? 1 : 0);
