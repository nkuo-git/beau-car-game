// 把 3D 車庫＋賽道放進 App（carid-pwa 的「改車」頁）：產生 tune.html、tune.css、tune.js、tune/<車>.glb
// node build-app.mjs <repo 資料夾> <內容版號>（版號跟 app.js 的 WEB_BUILD 一樣）
// 跟 build-art.mjs 用同一份原始碼：garage.src.html 裡 <!--__GARAGE__--> 框起來的畫面、module 程式、garage.css、race.src.js、town.src.js
// 輕量車（carlod.js）：body-<key>-lod.glb → tune/<key>-lod.glb；carlod.js 裡的 'car-<key>-lod.txt' 換成 'tune/<key>-lod.glb?h=<雜湊>'，大小填進 {/*__LOD_SIZES__*/}
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dir = path.dirname(new URL(import.meta.url).pathname);
const [repo, V] = process.argv.slice(2);
if (!repo || !/^\d+$/.test(V || '')) throw new Error('用法：node build-app.mjs <repo 資料夾> <內容版號>');
// 車：[key, 車身 glb, 車庫試做頁用的檔名（會換成 tune/<key>.glb）, 內嵌的 js]
const CARS = [
  ['supra', 'body-q.glb', 'car-glb.txt', []],
  ['gtr', 'body-gtr-q.glb', 'car-gtr.txt', []],
  ['sp3', 'body-sp3-q.glb', 'car-sp3.txt', ['sp3-look.js', 'sp3-spec.js']],
  ['jesko', 'body-jesko-q.glb', 'car-jesko.txt', ['jesko-look.js', 'jesko-spec.js']],
  ['yaris', 'body-yaris-q.glb', 'car-yaris.txt', ['yaris-look.js', 'yaris-spec.js']],
  ['gc8', 'body-gc8-q.glb', 'car-gc8.txt', ['gc8-look.js', 'gc8-spec.js']],
  ['p918', 'body-p918-q.glb', 'car-p918.txt', ['p918-look.js', 'p918-spec.js']],
  ['monster', 'body-monster-q.glb', 'car-monster.txt', ['monster-look.js', 'monster-spec.js']], // 第 4 批：越野車（越野車場的越野車行賣的）；輕量車 body-monster-lod.glb（monster-lod.mjs）
];
const NOLOD = []; // 沒有輕量車的車（不停車位、不擺阿財車行）；怪獸卡車現在有了（body-monster-lod.glb）
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const strip = (f) => read(f).split('\n').filter((l) => !/^import /.test(l)).join('\n').replace(/^export (const|function) /gm, '$1 ');
let code = ['masks.js', 'gtr-look.js', 'parts.js', 'supra.js', 'cabin.js', 'wings.js', 'wide.js', 'room.js', 'sound.js', 'street.js', 'police.js', 'village.js', 'interiors.js', 'terrain.js', 'drive.js', 'offroad.js', 'circuit.js', 'neihu-data.js', 'neihu.js', 'mountain.js', 'orbay.js', 'damage.js', 'walk.js', 'bigmap.js', 'character.js', 'lookpanel.js', ...CARS.flatMap((c) => c[3]), 'carlod.js', 'ghost.js', 'npc.js', 'crush.js', 'police-ai.js', 'guns.js', 'gunshop.js'].map((f) => `// ---- ${f} ----\n${strip(f)}`).join('\n');
const src = read('garage.src.html');
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('找不到 ' + a); return src.slice(i + a.length, j); };

// tune/<key>.glb：直接放 glb（不用像 artifact 那樣轉成 base64 文字）
fs.mkdirSync(path.join(repo, 'tune'), { recursive: true });
// 網址後面接車身檔的雜湊（不是內容版號）：車身沒改就不用重新下載（每台 1–2 MB，手機流量）
const sizes = {}, hashes = {}, lodSizes = {};
for (const [key, glb] of CARS) {
  const b = fs.readFileSync(path.join(dir, glb)); fs.writeFileSync(path.join(repo, 'tune', key + '.glb'), b);
  sizes[key] = b.length; hashes[key] = crypto.createHash('sha1').update(b).digest('hex').slice(0, 8);
  if (NOLOD.includes(key)) continue; // 第 4 批：越野車沒有輕量車
  // 輕量車：tune/<key>-lod.glb（一台 200～250 KB），網址一樣接雜湊
  const l = fs.readFileSync(path.join(dir, `body-${key}-lod.glb`)); fs.writeFileSync(path.join(repo, 'tune', key + '-lod.glb'), l);
  lodSizes[key] = l.length;
  const name = `'car-${key}-lod.txt'`;
  if (code.split(name).length !== 2) throw new Error('carlod.js 的 ' + name + ' 要剛好一個');
  code = code.replace(name, `'tune/${key}-lod.glb?h=${crypto.createHash('sha1').update(l).digest('hex').slice(0, 8)}'`);
}
if (code.split('{/*__LOD_SIZES__*/}').length !== 2) throw new Error('carlod.js 的 {/*__LOD_SIZES__*/} 要剛好一個');
code = code.replace('{/*__LOD_SIZES__*/}', JSON.stringify(lodSizes));

// tune.js
let js = cut('<script type="module">', '</script>')
  .replace('/*__YARIS__*/', "yaris: { file: 'car-yaris.txt', size: SIZES.yaris, spec: YARIS_SPEC, btn: ['YARIS', '豐田 GR · 白'], ...YARIS_GARAGE },");
for (const [key, , txt] of CARS) { if (!js.includes(`'${txt}'`)) throw new Error('找不到 ' + txt); js = js.replace(`'${txt}'`, `'tune/${key}.glb?h=${hashes[key]}'`); }
js = js.replace('/*__INLINE__*/', () => code).replace('__SIZES__', JSON.stringify(sizes))
  .replace('/*__RACE__*/', () => `// ---- race.src.js ----\n${read('race.src.js')}`)
  .replace('/*__TOWN__*/', () => `// ---- town.src.js ----\n${read('town.src.js')}\n// ---- circuit.src.js ----\n${read('circuit.src.js')}\n// ---- neihu.src.js ----\n${read('neihu.src.js')}\n// ---- ghost.src.js ----\n${read('ghost.src.js')}`);
js = `// 大便龍的萬能軟體 — 改車（3D 車庫＋開車出門的小村莊＋400 公尺直線加速）
// 這個檔是產生出來的，不要直接改：原始碼和指令在專案檔案 tune-game/supra3d/（build-app.mjs）
${js.trim()}

// ---- App 的改車頁才有的 ----
// 標題旁的版本號：0.外殼.內容，跟汽車、麥塊那兩頁一樣
(function paintVersion() {
  const el = document.getElementById('brandVer'), web = new URL(import.meta.url).searchParams.get('v');
  if (!el || !web) return;
  const app = /CaridApp\\/(\\d+)/.exec(navigator.userAgent || '');
  el.textContent = '0.' + (app ? app[1] : 0) + '.' + web;
})();
// 記住汽車裡最後看的是改車：從麥塊按「汽車」回來會回到這頁
try { sessionStorage.setItem('carid.tab', 'tune'); } catch { /* 不給用就算了 */ }
// 已經在改車頁再點底部的「汽車」：捲回最上面
document.getElementById('carTab').addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
`;
fs.writeFileSync(path.join(repo, 'tune.js'), js);

// tune.css：App 的顏色和外框（從 styles.css 抄的：顏色、標題列、四個功能的切換、底部分頁）＋車庫的元件
const css = ['s1.css', 's2.css', 's3.css'].map((f) => fs.readFileSync(path.join(dir, 'app', f), 'utf8')).join('\n')
  + fs.readFileSync(path.join(dir, 'app', 'tune-vars.css'), 'utf8') + read('garage.css');
fs.writeFileSync(path.join(repo, 'tune.css'), `/* 大便龍的萬能軟體 — 改車頁（產生出來的，原始碼在 tune-game/supra3d：app/*.css＋garage.css） */\n${css}`);

// tune.html
const markup = cut('<!--__GARAGE__-->', '<!--__/GARAGE__-->').replace(/^\n+|\s+$/g, '');
const html = fs.readFileSync(path.join(dir, 'app', 'tune.src.html'), 'utf8').replace('<!--__GARAGE__-->', () => markup.split('\n').map((l) => '  ' + l).join('\n')).replaceAll('__V__', V);
fs.writeFileSync(path.join(repo, 'tune.html'), html);
console.log('tune.html', html.length, 'tune.js', js.length, 'tune.css', css.length, 'glb', Object.entries(sizes).map(([k, n]) => `${k} ${(n / 1e6).toFixed(2)}MB (${lodSizes[k] ? `lod ${(lodSizes[k] / 1e3).toFixed(0)}KB` : '沒有輕量車'})`).join(', '));
