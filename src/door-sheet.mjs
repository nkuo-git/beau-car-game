// 第 98 批：每台有門的車，門全開的樣子（看門開得對不對）：node door-sheet.mjs <資料夾> [車 …] [v=front34]
import { serve, browser } from './lod-serve.mjs';
const [dir, ...rest] = process.argv.slice(2), view = (rest.find((a) => a.startsWith('v=')) || 'v=front34').slice(2), keys = rest.filter((a) => !a.startsWith('v='));
const ALL = ['gc8', 'yaris', 'supra', 'gtr', 'rx7', 'ae86', 'civic', 'evo', 'altis', 'p918', 'sp3', 'jesko', 'chiron', 'aventador', 'senna', 'huayra', 'laferrari', 'jp4', 'k2', 'p8'];
const srv = await serve(), b = await browser();
for (const k of keys.length ? keys : ALL) {
  const p = await b.newPage({ viewport: { width: 480, height: 320 } }), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${srv.url}/cview.html?car=${k}&cab=1&door=1&v=${view}&W=480&H=320`);
  try { await p.waitForFunction(() => window.done, null, { timeout: 180000 }); } catch { console.log(k, 'timeout', errs.join(' | ')); }
  await p.locator('canvas').screenshot({ path: `${dir}/${k}.png` });
  console.log(k, JSON.stringify(await p.evaluate(() => ({ doors: window.info?.doors, ms: window.info?.doorMs }))), errs.join(' | '));
  await p.close();
}
await b.close(); srv.close();
