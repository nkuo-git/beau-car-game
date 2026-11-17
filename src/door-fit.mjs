// 第 98 批：量每台車的車門（doors.js doorMeasure，用 cview.html 載真的車身＋車內）→ DOOR_FIT
// 用法：node door-fit.mjs [車 …] [--write]（--write：寫進 doors.js 的 DOOR_FIT 那一行；沒給車＝全部有門的車）
import fs from 'node:fs';
import { serve, browser } from './lod-serve.mjs';
const ALL = ['gc8', 'yaris', 'supra', 'gtr', 'rx7', 'ae86', 'civic', 'evo', 'altis', 'p918', 'sp3', 'jesko', 'chiron', 'aventador', 'senna', 'huayra', 'laferrari', 'jp4', 'k2', 'p8'];
const args = process.argv.slice(2), write = args.includes('--write'), keys = args.filter((a) => !a.startsWith('--'));
const list = keys.length ? keys : ALL;
const src = fs.readFileSync(new URL('./doors.js', import.meta.url), 'utf8'), m = src.match(/^export const DOOR_FIT = (\{.*\});/m);
const FIT = m ? JSON.parse(m[1]) : {};
const srv = await serve(), b = await browser();
for (const k of list) {
  const p = await b.newPage({ viewport: { width: 160, height: 120 } }), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const t0 = Date.now();
  await p.goto(`${srv.url}/cview.html?car=${k}&cab=1&fit=1&door=0&W=160&H=120`);
  try { await p.waitForFunction(() => window.done, null, { timeout: 600000 }); } catch { console.log(k, '沒有量完', errs.join(' | ')); await p.close(); continue; }
  const info = await p.evaluate(() => window.info);
  FIT[k] = info.doorFit; console.log(k, JSON.stringify(info.doorFit), `${((Date.now() - t0) / 1000).toFixed(1)}s`, errs.length ? errs.join(' | ') : '');
  await p.close();
}
await b.close(); srv.close();
if (write) {
  const out = src.replace(/^export const DOOR_FIT = .*$/m, `export const DOOR_FIT = ${JSON.stringify(FIT)}; // door-fit.mjs --write 換掉這一行`);
  fs.writeFileSync(new URL('./doors.js', import.meta.url), out); console.log('寫好了 doors.js');
}
