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
  // 2026-10-17 新的 10 台車（照 Wikimedia 照片做的，車名是自己編的）
  ['rx7', 'body-rx7-q.glb', 'car-rx7.txt', ['rx7-look.js', 'rx7-spec.js']],
  ['chiron', 'body-chiron-q.glb', 'car-chiron.txt', ['chiron-look.js', 'chiron-spec.js']],
  ['ae86', 'body-ae86-q.glb', 'car-ae86.txt', ['ae86-look.js', 'ae86-spec.js']],
  ['aventador', 'body-aventador-q.glb', 'car-aventador.txt', ['aventador-look.js', 'aventador-spec.js']],
  ['altis', 'body-altis-q.glb', 'car-altis.txt', ['altis-look.js', 'altis-spec.js']],
  ['senna', 'body-senna-q.glb', 'car-senna.txt', ['senna-look.js', 'senna-spec.js']],
  ['huayra', 'body-huayra-q.glb', 'car-huayra.txt', ['huayra-look.js', 'huayra-spec.js']],
  ['laferrari', 'body-laferrari-q.glb', 'car-laferrari.txt', ['laferrari-look.js', 'laferrari-spec.js']],
  ['civic', 'body-civic-q.glb', 'car-civic.txt', ['civic-look.js', 'civic-spec.js']],
  ['evo', 'body-evo-q.glb', 'car-evo.txt', ['evo-look.js', 'evo-spec.js']],
  ['monster', 'body-monster-q.glb', 'car-monster.txt', ['monster-look.js', 'monster-spec.js']], // 第 4 批：越野車（越野車場的越野車行賣的）；輕量車 body-monster-lod.glb（monster-lod.mjs）
  ['jp4', 'body-jp4-q.glb', 'car-jp4.txt', ['jp4-look.js', 'jp4-spec.js']], // 第 48 批：J4 吉普車（越野車行賣的）；輕量車 body-jp4-lod.glb（make-lod.mjs）
  ['k2', 'body-k2-q.glb', 'car-k2.txt', ['k2-look.js', 'k2-spec.js']], // 第 51 批：K2 小越野車（越野車行賣的）；輕量車 body-k2-lod.glb（make-lod.mjs）
  ['p8', 'body-p8-q.glb', 'car-p8.txt', ['p8-look.js', 'p8-spec.js']], // 第 53 批：P8 皮卡（越野車行賣的）；輕量車 body-p8-lod.glb（make-lod.mjs）
  ['z2', 'body-z2-q.glb', 'car-z2.txt', ['z2-look.js', 'z2-spec.js']], // 第 56 批：Z2 沙灘車（越野車行賣的；騎的）；輕量車 body-z2-lod.glb（make-lod.mjs）
];
const NOLOD = []; // 沒有輕量車的車（不停車位、不擺阿財車行）；怪獸卡車現在有了（body-monster-lod.glb）
const yaris = process.argv.includes('--yaris');
if (yaris) CARS.splice(4, 0, ['yaris', 'body-yaris-q.glb', 'car-yaris.txt', ['yaris-look.js', 'yaris-spec.js']]);
const strip = (f) => fs.readFileSync(path.join(dir, f), 'utf8')
  .split('\n').filter((l) => !/^import /.test(l)).join('\n')
  .replace(/^export (const|function) /gm, '$1 ');
const files = ['masks.js', 'gtr-look.js', 'parts.js', 'supra.js', 'popup.js', 'cabin.js', 'wings.js', 'wide.js', 'tower.js', 'apt.js', 'sound.js', 'street.js', 'police.js', 'hills.js', 'village.js', 'interiors.js', 'terrain.js', 'drive.js', 'offroad.js', 'circuit.js', 'neihu-data.js', 'neihu.js', 'mountain.js', 'orbay.js', 'damage.js', 'walk.js', 'bigmap.js', 'character.js', 'lookpanel.js', ...CARS.flatMap((c) => c[3]), 'carlod.js', 'ghost.js', 'npc.js', 'crush.js', 'police-ai.js', 'guns.js', 'gunshop.js', 'look.js'];
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
  .replace('/*__TOWN__*/', () => `// ---- town.src.js ----\n${fs.readFileSync(path.join(dir, 'town.src.js'), 'utf8')}\n// ---- circuit.src.js ----\n${fs.readFileSync(path.join(dir, 'circuit.src.js'), 'utf8')}\n// ---- neihu.src.js ----\n${fs.readFileSync(path.join(dir, 'neihu.src.js'), 'utf8')}\n// ---- ghost.src.js ----\n${fs.readFileSync(path.join(dir, 'ghost.src.js'), 'utf8')}\n// ---- net.src.js ----\n${fs.readFileSync(path.join(dir, 'net.src.js'), 'utf8')}\n// ---- seat.src.js ----\n${fs.readFileSync(path.join(dir, 'seat.src.js'), 'utf8')}`); // 開車出門（小村莊）
if (yaris) html = html.replace('/*__YARIS__*/', "yaris: { file: 'car-yaris.txt', size: SIZES.yaris, spec: YARIS_SPEC, btn: ['YARIS', '豐田 GR · 白'], ...YARIS_GARAGE },");
fs.writeFileSync(path.join(dir, 'art/garage.html'), html);
fs.rmSync(path.join(dir, 'art/car.glb'), { force: true });
console.log('garage.html', html.length, 'bytes;', CARS.map(([k]) => `${k} ${(sizes[k] / 1e6).toFixed(2)}MB (${lodSizes[k] ? `lod ${(lodSizes[k] / 1e3).toFixed(0)}KB` : '沒有輕量車'})`).join(', '));
