// 獨立的改車遊戲網站（GitHub Pages：https://nkuo-git.github.io/beau-car-game/ ，APK 也是開這個網址）：產生 docs/
// node build-site.mjs <內容版號> [輸出資料夾，預設 ../docs]
//   內容版號：每次要上線就 +1（不能比 docs/version.json 的小）；標題旁的版本號是 0.<APK 版號>.<內容版號>
// 做法：先用 build-app.mjs（萬能軟體的「改車」頁）在暫存資料夾產生 tune.js／tune.css／tune/*.glb（同一份打包清單，不用改兩個地方），再：
//   game.js  ＝ tune.js 去掉萬能軟體才有的尾巴（版本號、汽車分頁）＋ site/site.js（版本號、有新版本那一條、搬進度）
//   game.css ＝ tune.css ＋ site/site.css
//   index.html ＝ site/index.src.html 放進 garage.src.html 裡 <!--__GARAGE__--> 框起來的畫面
//   sw.js ＝ site/sw.src.js（版號、車身檔清單）；manifest、icons 照抄；tune/*.glb 照抄（舊的刪掉）
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const dir = path.dirname(new URL(import.meta.url).pathname);
const [V, outArg] = process.argv.slice(2);
if (!/^\d+$/.test(V || '')) throw new Error('用法：node build-site.mjs <內容版號> [輸出資料夾]');
const out = path.resolve(outArg || path.join(dir, '../docs'));
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const verFile = path.join(out, 'version.json');
const prev = fs.existsSync(verFile) ? JSON.parse(fs.readFileSync(verFile, 'utf8')).build : 0;
if (+V < prev) throw new Error(`內容版號 ${V} 比上一版 ${prev} 小`);

// 1. 萬能軟體的改車頁（暫存）
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'beau-site-'));
execFileSync(process.execPath, [path.join(dir, 'build-app.mjs'), tmp, V], { stdio: ['ignore', 'ignore', 'inherit'] });

// 2. game.js
let js = fs.readFileSync(path.join(tmp, 'tune.js'), 'utf8');
const TAIL = '\n// ---- App 的改車頁才有的 ----';
if (js.split(TAIL).length !== 2) throw new Error('tune.js 找不到萬能軟體的尾巴（build-app.mjs 改過了？）');
js = js.slice(0, js.indexOf(TAIL));
const HEAD = /^\/\/ 大便龍的萬能軟體 — 改車.*\n\/\/ 這個檔是產生出來的.*\n/;
if (!HEAD.test(js)) throw new Error('tune.js 開頭的說明不一樣了（build-app.mjs 改過了？）');
js = js.replace(HEAD, '// 大便龍的改車遊戲（3D 車庫＋開車出門的小村莊、賽車場、越野車場、內湖）\n// 這個檔是產生出來的，不要直接改：原始碼在 beau-car-game 的 src/（node src/build-site.mjs <版號>）\n');
js += '\n' + read('site/site.js').replace('__V__', V);

// 3. game.css
let css = fs.readFileSync(path.join(tmp, 'tune.css'), 'utf8');
css = css.replace(/^\/\* 大便龍的萬能軟體 — 改車頁.*\*\/\n/, '/* 大便龍的改車遊戲（產生出來的，原始碼在 src/：app/*.css＋garage.css＋site/site.css） */\n') + read('site/site.css');

// 4. index.html（畫面跟萬能軟體的改車頁一樣是 garage.src.html 裡那一段）
const src = read('garage.src.html'), a = '<!--__GARAGE__-->', b = '<!--__/GARAGE__-->';
const i = src.indexOf(a), j = src.indexOf(b, i);
if (i < 0 || j < 0) throw new Error('garage.src.html 找不到 ' + a);
const markup = src.slice(i + a.length, j).replace(/^\n+|\s+$/g, '');
const html = read('site/index.src.html').replace('<!--__GARAGE__-->', () => markup.split('\n').map((l) => '  ' + l).join('\n')).replaceAll('__V__', V);

// 5. 寫出去
fs.mkdirSync(path.join(out, 'tune'), { recursive: true });
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
const glbs = fs.readdirSync(path.join(tmp, 'tune')).filter((f) => f.endsWith('.glb')).sort();
for (const f of fs.readdirSync(path.join(out, 'tune'))) if (!glbs.includes(f)) fs.rmSync(path.join(out, 'tune', f)); // 不用的車身檔刪掉
for (const f of glbs) fs.copyFileSync(path.join(tmp, 'tune', f), path.join(out, 'tune', f));
const glbUrls = [...js.matchAll(/'(tune\/[a-z0-9-]+\.glb\?h=[0-9a-f]{8})'/g)].map((m) => './' + m[1]);
if (glbUrls.length !== glbs.length) throw new Error(`game.js 裡的車身檔網址 ${glbUrls.length} 個，檔案 ${glbs.length} 個`);
fs.writeFileSync(path.join(out, 'game.js'), js);
fs.writeFileSync(path.join(out, 'game.css'), css);
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, 'sw.js'), read('site/sw.src.js').replace('"__V__"', JSON.stringify(V)).replace('/*__GLB__*/', glbUrls.map((u) => JSON.stringify(u)).join(', ')));
fs.copyFileSync(path.join(dir, 'site/manifest.webmanifest'), path.join(out, 'manifest.webmanifest'));
for (const f of fs.readdirSync(path.join(dir, 'site/icons'))) fs.copyFileSync(path.join(dir, 'site/icons', f), path.join(out, 'icons', f));
fs.writeFileSync(path.join(out, '.nojekyll'), '');
fs.writeFileSync(verFile, JSON.stringify({ build: +V }) + '\n');
fs.rmSync(tmp, { recursive: true, force: true });
const kb = (f) => (fs.statSync(path.join(out, f)).size / 1e3).toFixed(0) + ' KB';
console.log(`docs 內容 ${V}：index.html ${kb('index.html')}、game.js ${kb('game.js')}、game.css ${kb('game.css')}、車身檔 ${glbs.length} 個 →`, out);
