// 把 masks.js、parts.js、supra.js、village.js、drive.js 和每台車的 look／spec 內嵌進車庫頁（再接上 race.src.js、town.src.js），輸出 art/garage.html＋每台車的車身檔 art/car-*.txt（base64 的 glb）
// 輕量車（carlod.js，車位／車行／路上的車）：接在每台車的 spec 後面；車身檔 body-<key>-lod.glb（make-lod.mjs 做的）→ art/car-<key>-lod.txt，大小填進 carlod.js 的 {/*__LOD_SIZES__*/}
import fs from 'node:fs';
import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
// 車：[key, 車身 glb, 車庫頁要的檔名, 內嵌的 js]
const CARS = [
  ['supra', 'body-q.glb', 'car-glb.txt', []],
  ['gtr', 'body-gtr-q.glb', 'car-gtr.txt', []],
  ['sp3', 'body-sp3-q.glb', 'car-sp3.txt', ['sp3-look.js', 'sp3-spec.js']],
  ['jesko', 'body-jesko-q.glb', 'car-jesko.txt', ['jesko-look.js', 'jesko-spec.js']],
  ['gc8', 'body-gc8-q.glb', 'car-gc8.txt', ['gc8-look.js', 'gc8-spec.js']],
  ['p918', 'body-p918-q.glb', 'car-p918.txt', ['p918-look.js', 'p918-spec.js']],
  ['monster', 'body-monster-q.glb', 'car-monster.txt', ['monster-look.js', 'monster-spec.js']], // 第 4 批：越野車（越野車場的越野車行賣的）；輕量車 body-monster-lod.glb（monster-lod.mjs）
];
const NOLOD = []; // 沒有輕量車的車（不停車位、不擺阿財車行）；怪獸卡車現在有了（body-monster-lod.glb）
const yaris = process.argv.includes('--yaris');
if (yaris) CARS.splice(4, 0, ['yaris', 'body-yaris-q.glb', 'car-yaris.txt', ['yaris-look.js', 'yaris-spec.js']]);
const strip = (f) => fs.readFileSync(path.join(dir, f), 'utf8')
  .split('\n').filter((l) => !/^import /.test(l)).join('\n')
  .replace(/^export (const|function) /gm, '$1 ');
const files = ['masks.js', 'gtr-look.js', 'parts.js', 'supra.js', 'cabin.js', 'wings.js', 'wide.js', 'room.js', 'sound.js', 'street.js', 'police.js', 'village.js', 'interiors.js', 'terrain.js', 'drive.js', 'offroad.js', 'circuit.js', 'neihu-data.js', 'neihu.js', 'orbay.js', 'damage.js', 'walk.js', 'character.js', 'lookpanel.js', ...CARS.flatMap((c) => c[3]), 'carlod.js', 'npc.js', 'crush.js', 'police-ai.js', 'guns.js', 'gunshop.js'];
const code = files.map((f) => `// ---- ${f} ----\n${strip(f)}`).join('\n');
fs.mkdirSync(path.join(dir, 'art'), { recursive: true });
const sizes = {}, lodSizes = {};
for (const [key, glb, out] of CARS) {
  const b64 = fs.readFileSync(path.join(dir, glb)).toString('base64');
  fs.writeFileSync(path.join(dir, 'art', out), b64);
  sizes[key] = b64.length;
  if (NOLOD.includes(key)) continue; // 第 4 批：越野車沒有輕量車
  const lod = fs.readFileSync(path.join(dir, `body-${key}-lod.glb`)).toString('base64'); // 輕量車（沒有就先跑 node make-lod.mjs）
  fs.writeFileSync(path.join(dir, 'art', `car-${key}-lod.txt`), lod);
  lodSizes[key] = lod.length;
}
if (code.split('{/*__LOD_SIZES__*/}').length !== 2) throw new Error('carlod.js 的 {/*__LOD_SIZES__*/} 要剛好一個');
let html = fs.readFileSync(path.join(dir, 'garage.src.html'), 'utf8').replace('/*__INLINE__*/', () => code.replace('{/*__LOD_SIZES__*/}', JSON.stringify(lodSizes))).replace('__SIZES__', JSON.stringify(sizes))
  .replace('/*__GARAGE_CSS__*/', () => fs.readFileSync(path.join(dir, 'garage.css'), 'utf8'))
  .replace('/*__RACE__*/', () => `// ---- race.src.js ----\n${fs.readFileSync(path.join(dir, 'race.src.js'), 'utf8')}`) // 賽道
  .replace('/*__TOWN__*/', () => `// ---- town.src.js ----\n${fs.readFileSync(path.join(dir, 'town.src.js'), 'utf8')}\n// ---- circuit.src.js ----\n${fs.readFileSync(path.join(dir, 'circuit.src.js'), 'utf8')}\n// ---- neihu.src.js ----\n${fs.readFileSync(path.join(dir, 'neihu.src.js'), 'utf8')}`); // 開車出門（小村莊）
if (yaris) html = html.replace('/*__YARIS__*/', "yaris: { file: 'car-yaris.txt', size: SIZES.yaris, spec: YARIS_SPEC, btn: ['YARIS', '豐田 GR · 白'], ...YARIS_GARAGE },");
fs.writeFileSync(path.join(dir, 'art/garage.html'), html);
fs.rmSync(path.join(dir, 'art/car.glb'), { force: true });
console.log('garage.html', html.length, 'bytes;', CARS.map(([k]) => `${k} ${(sizes[k] / 1e6).toFixed(2)}MB (${lodSizes[k] ? `lod ${(lodSizes[k] / 1e3).toFixed(0)}KB` : '沒有輕量車'})`).join(', '));
