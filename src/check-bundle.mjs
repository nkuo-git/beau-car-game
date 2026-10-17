// 檢查車的 look／spec 檔可不可以接進車庫頁的那一個 module（build-art.mjs 的作法：刪掉 import 開頭的行、拿掉 export）
// 用法：node check-bundle.mjs <key>-look.js <key>-spec.js   → 印「bundle ok」
// 規則：只能 export const／export function；其他最上層的名字要用 <KEY>_ 開頭（或包在 IIFE 裡），跟別台車、共用檔不能撞名
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const dir = path.dirname(new URL(import.meta.url).pathname);
const mine = process.argv.slice(2);
if (!mine.length) { console.log('usage: node check-bundle.mjs <key>-look.js <key>-spec.js'); process.exit(1); }
const others = fs.readdirSync(dir).filter((f) => /-(look|spec)\.js$/.test(f) && !mine.includes(f) && f !== 'gtr-look.js').sort();
const strip = (f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter((l) => !/^import /.test(l)).join('\n').replace(/^export (const|function) /gm, '$1 ');
const bad = [];
for (const f of mine) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const l of src.split('\n')) {
    if (/^import /.test(l) && !/from '(three|\.\/parts\.js|\.\/masks\.js|\.\/[a-z0-9]+-look\.js)';$/.test(l)) bad.push(`${f}: 不能 import 這個：${l}`);
    if (/^export (?!const |function )/.test(l)) bad.push(`${f}: 只能 export const／export function：${l}`);
    const m = /^(?:export )?(?:const|let|var|function|class) ([A-Za-z_$][\w$]*)/.exec(l);
    const key = f.split('-')[0].toUpperCase();
    if (m && !m[1].startsWith(key + '_') && !/^export /.test(l)) bad.push(`${f}: 最上層的名字要用 ${key}_ 開頭：${m[1]}`);
  }
}
const files = ['masks.js', 'gtr-look.js', 'parts.js', 'supra.js', ...others, ...mine];
const code = files.map((f) => `// ---- ${f} ----\n${strip(f)}`).join('\n') + '\nexport {};';
try { new vm.SourceTextModule(code); } catch (e) {
  if (e instanceof TypeError && /SourceTextModule/.test(e.message)) { try { new Function(code.replace(/\nexport \{\};$/, '')); } catch (e2) { bad.push('接起來不能跑：' + e2.message); } }
  else bad.push('接起來不能跑：' + e.message);
}
if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
console.log('bundle ok', `(${files.length} 個檔)`);
