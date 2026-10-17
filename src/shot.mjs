// 拍一張車的圖：node shot.mjs out.png 'car=<key>&v=photo1' [W H] [cview.html]
// （cview.html 的參數見那個檔案；W H 是像素，疊照片的時候用照片的大小）
import { serve, browser } from './lod-serve.mjs';
const [out, q = 'car=supra&v=front34', W = '1200', H = '800', page = 'cview.html'] = process.argv.slice(2);
if (!out) { console.log("usage: node shot.mjs out.png 'car=<key>&v=front34' [W H]"); process.exit(1); }
const srv = await serve(), b = await browser(), p = await b.newPage({ viewport: { width: +W, height: +H } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`${srv.url}/${page}?${q}&W=${W}&H=${H}`);
try { await p.waitForFunction(() => window.done, null, { timeout: 120000 }); } catch { console.log('沒有畫完：', errs.join(' | ')); }
await p.locator('canvas').screenshot({ path: out, omitBackground: /bg=none/.test(q) });
console.log(out, JSON.stringify(await p.evaluate(() => window.info)), errs.length ? 'errors: ' + errs.join(' | ') : '');
await b.close(); srv.close();
