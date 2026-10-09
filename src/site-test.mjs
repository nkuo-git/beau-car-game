// 獨立網站（docs/，GitHub Pages 上的那一份）的快速檢查：node site-test.mjs [docs 資料夾，預設 ../docs] [截圖 prefix，預設 ../out/site/site]
//   1 打開：沒有頁面錯誤、車庫出來、標題是「大便龍的改車遊戲」、版本號 0.0.<內容>（瀏覽器）／0.7.<內容>（APK 7）、沒有萬能軟體的切換、分頁
//   2 開車：出門 → 上車 → 開鐵捲門 → 踩油門會動；App 的外殼收到 setFullscreen(true)
//   3 有新版本：Service Worker 裝好 → 換一版（sw.js、index.html 換版號）→ 跳「有新版本，要更新嗎」→ 按「更新」→ 重新載入、版本號變新的；沒按之前不會自己換
//   4 App 有新版本：APK 7 + GitHub 說 apk-9 → 只跳「App 有新版本／下載安裝」（連到 .apk），內容那條不跳；APK 9 → 不跳
//   5 搬進度：#import=… → 問「要把萬能軟體裡的進度搬過來嗎？」→ 不要：什麼都沒改；搬過來：錢、車、外觀都換成搬來的，網址的 #import 拿掉；
//     window.beauImport（外殼走的路）一樣會問；壞掉的資料 → 「搬家的資料看不懂，沒有搬。」、什麼都沒改
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [docsArg, prefix = path.join(dir, '../out/site/site')] = process.argv.slice(2);
const docs = path.resolve(docsArg || path.join(dir, '../docs'));
fs.mkdirSync(path.dirname(prefix), { recursive: true });
const BUILD = JSON.parse(fs.readFileSync(path.join(docs, 'version.json'), 'utf8')).build;
// 伺服器：先放 docs 的一份複本（第 3 段要假裝換版）；game.js 加測試用的鉤子（看得到 DRIVE、walker、drv）
const site = fs.mkdtempSync(path.join(os.tmpdir(), 'beau-site-test-'));
fs.cpSync(docs, site, { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const hook = 'window.__D = () => ({ on: DRIVE.on, drv, walker, cur }); window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };';
const A = 'const RACE = { on: false, frame: raceFrame };', D1 = '  driveStep(dt);\n  if (!DRIVE.on) return;';
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u.startsWith('/three/') ? path.join(three, u.slice(7)) : path.join(site, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  let body = fs.readFileSync(f);
  if (f.endsWith('.html')) body = body.toString('utf8').replaceAll('https://cdn.jsdelivr.net/npm/three@0.186.1/', '/three/');
  if (u === '/game.js') {
    let js = body.toString('utf8');
    for (const x of [A, D1]) if (js.split(x).length !== 2) throw new Error('hook anchor missing or not unique in game.js: ' + x);
    body = js.replace(A, `${A} ${hook}`).replace(D1, '  if (!window.__hold) driveStep(dt);\n  if (!DRIVE.on) return;');
  }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(body);
}).listen(0);
const root = `http://127.0.0.1:${srv.address().port}`;
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errs = [], fails = [];
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const T0 = Date.now(), el = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`;
const UA = (apk) => 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36' + (apk ? ` BeauCarApp/${apk}` : '');
async function newPage({ apk = null, sw = 'block', release = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: sw, userAgent: UA(apk) });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => {
    if (release && /api\.github\.com\/repos\/nkuo-git\/beau-car-game\/releases\/latest/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(release) });
    return r.abort();
  });
  await ctx.addInitScript(() => { window.__roomWatch = false; });
  if (apk) await ctx.addInitScript(() => { window.__fsCalls = []; window.__ready = 0; window.BeauCarApp = { ready() { window.__ready++; }, setFullscreen(on) { window.__fsCalls.push(on); } }; });
  const p = await ctx.newPage();
  p.setDefaultTimeout(300000);
  p.on('pageerror', (e) => { errs.push(e.message); console.log('pageerror', e.message); });
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|404|GPU stall|AudioContext|fonts\.g|Failed to load resource/.test(m.text())) console.log('console', m.type(), m.text().slice(0, 240)); });
  return { ctx, p };
}
const ready = (p) => p.waitForFunction(() => document.getElementById('status')?.hidden, null, { timeout: 300000 });
const vis = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }, sel);

// ---- 1 打開 ----
{
  const { ctx, p } = await newPage();
  await p.goto(root + '/', { waitUntil: 'domcontentloaded' }); await ready(p);
  const r = await p.evaluate(() => ({ title: document.querySelector('.brand-name')?.firstChild?.textContent, ver: document.getElementById('brandVer').textContent, cars: document.querySelectorAll('#cars button').length,
    canvas: !!document.querySelector('#stage canvas'), chrome: ['.segbar', '.tabbar', '.icon-btn'].filter((s) => document.querySelector(s)).join(' '), bars: [document.getElementById('updateBar').hidden, document.getElementById('appUpdateBar').hidden], dlg: document.getElementById('impDlg').hidden,
    manifest: document.querySelector('link[rel=manifest]')?.getAttribute('href') }));
  console.log('1', el(), JSON.stringify(r));
  check(r.title === '大便龍的改車遊戲' && r.ver === `0.0.${BUILD}`, `title 大便龍的改車遊戲, version 0.0.${BUILD} in a browser (${r.title} ${r.ver})`);
  check(r.cars >= 1 && r.canvas && !r.chrome && r.bars.every(Boolean) && r.dlg && r.manifest === './manifest.webmanifest', `garage page shows (${r.cars} car buttons, 3D canvas), no 萬能軟體 switcher/tabs/settings, no update bar, no import dialog, manifest linked`);
  await p.screenshot({ path: `${prefix}-1-page.png` });
  await ctx.close();
}

// ---- 2 開車（在 APK 7 裡）----
{
  const { ctx, p } = await newPage({ apk: 7 });
  await p.goto(root + '/', { waitUntil: 'domcontentloaded' }); await ready(p);
  const ver = await p.evaluate(() => document.getElementById('brandVer').textContent);
  check(ver === `0.7.${BUILD}` && await p.evaluate(() => window.__ready >= 1), `in APK 7: version 0.7.${BUILD} (${ver}), BeauCarApp.ready() called`);
  await p.evaluate(() => document.getElementById('driveOut').click());
  await p.waitForFunction(() => window.__D().on && window.__D().walker?.mode === 'walk', null, { timeout: 300000 });
  await p.evaluate(() => { window.__hold = true; });
  await p.waitForFunction(() => window.__D().walker.cars.length >= 1, null, { timeout: 120000 });
  const r = await p.evaluate(() => {
    const vis = (e) => !!e && !e.hidden && !e.closest('[hidden]') && e.getClientRects().length > 0, act = () => [...document.querySelectorAll('#stage .wk-act, #stage .dv-act')].find(vis);
    const D0 = window.__D(), W = D0.walker; window.__dstep(30); // 剛開始走的 0.35 秒內不能上車（walk.js 的 lockT）
    const p1 = W.getIn(W.cars.find((c) => c.key === D0.cur)) ? '上車 · ' + D0.cur : null; // 走去坐上自己的車（跟按「上車」一樣）
    for (let n = 0; n < 600 && W.mode !== 'off'; n++) window.__dstep(1);
    window.__dstep(40);
    const p2 = act()?.querySelector('span')?.textContent; act()?.click(); // 開鐵捲門
    window.__dstep(200);
    const d = window.__D().drv; let max = 0;
    d.setInput({ throttle: 1, brake: 0, steer: 0 }); for (let n = 0; n < 90; n++) { const t = window.__dstep(1); max = Math.max(max, Math.abs(t.kmh)); }
    d.setInput(null);
    return { p1, p2, drv: !!d, max: +max.toFixed(1), fs: document.body.classList.contains('fs'), calls: window.__fsCalls.join(',') };
  });
  console.log('2', el(), JSON.stringify(r));
  check(/^上車/.test(r.p1 || '') && r.p2 === '開鐵捲門' && r.drv && r.max > 5, `drive: 出門 → 「${r.p1}」 → 「${r.p2}」 → full throttle reaches ${r.max} km/h`);
  check(r.fs && /^true/.test(r.calls), `driving is fullscreen and the APK shell got BeauCarApp.setFullscreen(true) (${r.calls})`);
  await p.evaluate(() => { window.__hold = false; });
  await p.screenshot({ path: `${prefix}-2-drive.png` });
  await p.evaluate(() => document.getElementById('driveHome').click()); await p.waitForTimeout(1500);
  check(await p.evaluate(() => !document.body.classList.contains('fs') && window.__fsCalls.at(-1) === false), 'back to the garage: not fullscreen, setFullscreen(false)');
  await ctx.close();
}

// ---- 3 有新版本（內容）：Service Worker ----
{
  const { ctx, p } = await newPage({ sw: 'allow' });
  await p.goto(root + '/', { waitUntil: 'domcontentloaded' }); await ready(p);
  await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 120000 });
  const c1 = await p.evaluate(() => caches.keys());
  check(c1.includes(`beaucar-v${BUILD}`) && !(await vis(p, '#updateBar')), `service worker installed (caches ${c1.join(', ')}), no update bar on the first install`);
  // 換一版：sw.js、index.html 的版號 +1（game.js／game.css 用同一份）
  const N = BUILD + 1;
  fs.writeFileSync(path.join(site, 'sw.js'), fs.readFileSync(path.join(site, 'sw.js'), 'utf8').replace(`const V = "${BUILD}"`, `const V = "${N}"`));
  fs.writeFileSync(path.join(site, 'index.html'), fs.readFileSync(path.join(site, 'index.html'), 'utf8').replaceAll(`?v=${BUILD}`, `?v=${N}`));
  fs.writeFileSync(path.join(site, 'game.js'), fs.readFileSync(path.join(site, 'game.js'), 'utf8').replace(`const GAME_BUILD = ${BUILD};`, `const GAME_BUILD = ${N};`));
  await p.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await p.waitForFunction(() => !document.getElementById('updateBar').hidden, null, { timeout: 120000 });
  const bar = await p.evaluate(() => ({ txt: document.querySelector('#updateBar .txt').textContent, btn: document.getElementById('updateBtn').textContent, app: document.getElementById('appUpdateBar').hidden, ver: document.getElementById('brandVer').textContent }));
  await p.screenshot({ path: `${prefix}-3-update-bar.png` });
  await p.waitForTimeout(3000);
  const still = await p.evaluate(() => document.getElementById('brandVer').textContent);
  check(bar.txt === '有新版本，要更新嗎' && bar.btn === '更新' && bar.app && bar.ver === `0.0.${BUILD}` && still === `0.0.${BUILD}`, `new version waiting: one bar 「${bar.txt}／${bar.btn}」, nothing updates by itself (still ${still})`);
  await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.click('#updateBtn')]);
  await ready(p);
  const after = await p.evaluate(async () => ({ ver: document.getElementById('brandVer').textContent, bar: document.getElementById('updateBar').hidden, caches: await caches.keys() }));
  check(after.ver === `0.0.${N}` && after.bar && after.caches.includes(`beaucar-v${N}`) && !after.caches.includes(`beaucar-v${BUILD}`) && after.caches.includes('beaucar-glb'), `pressed 更新: reloaded on the new version ${after.ver}, old cache gone, car models kept (${after.caches.join(', ')})`);
  await ctx.close();
  fs.rmSync(site, { recursive: true, force: true }); fs.cpSync(docs, site, { recursive: true }); // 換回原本的
}

// ---- 4 App（APK）有新版本 ----
{
  const release = { tag_name: 'apk-9', assets: [{ name: 'beau-car-game-9.apk', browser_download_url: 'https://github.com/nkuo-git/beau-car-game/releases/download/apk-9/beau-car-game-9.apk' }] };
  const { ctx, p } = await newPage({ apk: 7, release });
  await p.goto(root + '/', { waitUntil: 'domcontentloaded' }); await ready(p);
  await p.waitForFunction(() => !document.getElementById('appUpdateBar').hidden, null, { timeout: 30000 }).catch(() => {});
  const r = await p.evaluate(() => ({ app: !document.getElementById('appUpdateBar').hidden, web: !document.getElementById('updateBar').hidden, txt: document.querySelector('#appUpdateBar .txt').textContent, link: document.getElementById('appUpdateLink').textContent, href: document.getElementById('appUpdateLink').href }));
  await p.screenshot({ path: `${prefix}-4-apk-bar.png` });
  check(r.app && !r.web && r.txt === 'App 有新版本' && r.link === '下載安裝' && r.href === release.assets[0].browser_download_url, `APK 7, GitHub apk-9: only 「${r.txt}／${r.link}」 → ${r.href}`);
  await ctx.close();
  const q = await newPage({ apk: 9, release });
  await q.p.goto(root + '/', { waitUntil: 'domcontentloaded' }); await ready(q.p); await q.p.waitForTimeout(2500);
  check(await q.p.evaluate(() => document.getElementById('appUpdateBar').hidden && document.getElementById('updateBar').hidden), 'APK 9, GitHub apk-9: no bar');
  await q.ctx.close();
}

// ---- 5 搬進度 ----
{
  const save = { v: 2, cur: 'supra', scene: 'room', money: 4321, owned: ['gc8', 'supra', 'yaris'], parts: {}, tyres: {}, wins: {}, cars: {} };
  const pack = (keys) => Buffer.from(JSON.stringify({ v: 1, from: 'carid-pwa', keys })).toString('base64url');
  const good = pack({ 'carid.tune': JSON.stringify(save), 'carid.sound': 'off', 'carid.tune.full': 'off', 'carid.roomq': 'low', 'carid.other': 'x' });
  const { ctx, p } = await newPage();
  await p.goto(root + '/', { waitUntil: 'domcontentloaded' }); await ready(p);
  await p.evaluate(() => { localStorage.setItem('carid.tune', JSON.stringify({ v: 2, cur: 'gc8', money: 7, owned: ['gc8'], parts: {}, tyres: {}, wins: {}, cars: {} })); });
  // 不要
  await p.goto(root + '/?t=1#import=' + good, { waitUntil: 'domcontentloaded' }); await ready(p);
  const ask = await p.evaluate(() => ({ open: !document.getElementById('impDlg').hidden, msg: document.getElementById('impMsg').textContent, yes: document.getElementById('impYes').textContent, no: document.getElementById('impNo').textContent, hash: location.hash }));
  await p.screenshot({ path: `${prefix}-5-import-ask.png` });
  check(ask.open && ask.msg === '要把萬能軟體裡的進度搬過來嗎？（會蓋掉這裡的進度）' && ask.yes === '搬過來' && ask.no === '不要' && ask.hash === '', `#import=…: asks 「${ask.msg}」 with 搬過來／不要, #import removed from the address`);
  await p.click('#impNo');
  await p.waitForTimeout(1000);
  const kept = await p.evaluate(() => ({ s: JSON.parse(localStorage.getItem('carid.tune')), open: !document.getElementById('impDlg').hidden, cash: document.getElementById('cash').textContent }));
  check(!kept.open && kept.s.money === 7 && kept.s.owned.join() === 'gc8' && /NT\$ 7 萬/.test(kept.cash), `不要: dialog closed, nothing changed (${kept.cash})`);
  // 搬過來（外殼的路：window.beauImport）
  const ok = await p.evaluate((s) => window.beauImport(s), good);
  check(ok === true && await vis(p, '#impDlg'), 'window.beauImport(save) (the APK shell path) returns true and asks too');
  await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.click('#impYes')]);
  await ready(p);
  const got = await p.evaluate(() => ({ tune: JSON.parse(localStorage.getItem('carid.tune')), sound: localStorage.getItem('carid.sound'), full: localStorage.getItem('carid.tune.full'), roomq: localStorage.getItem('carid.roomq'), other: localStorage.getItem('carid.other'),
    cash: document.getElementById('cash').textContent, sel: document.querySelector('#cars button[aria-pressed="true"], #cars button.on, #cars button[aria-current]')?.dataset.car || null,
    cars: [...document.querySelectorAll('#cars button')].map((x) => x.dataset.car), dlg: document.getElementById('impDlg').hidden, url: location.pathname + location.hash }));
  console.log('5', el(), JSON.stringify({ ...got, tune: undefined }));
  await p.screenshot({ path: `${prefix}-5-imported.png` });
  check(got.tune.money === 4321 && got.tune.owned.join() === 'gc8,supra,yaris' && got.sound === 'off' && got.full === 'off' && got.roomq === 'low' && got.other === null && got.dlg && got.url === '/', `搬過來: reloaded with the imported keys (money 4321, cars gc8/supra/yaris, sound off, fullscreen off, quality low; unknown key ignored)`);
  check(/NT\$ 4,321 萬/.test(got.cash) && got.cars.includes('supra') && got.cars.includes('yaris'), `the game shows the imported progress: wallet 「${got.cash}」, car buttons ${got.cars.join('/')}`);
  const cur = await p.evaluate(() => JSON.parse(localStorage.getItem('carid.tune')).cur);
  check(cur === 'supra' && got.sel === 'supra', `the imported current car is selected and stays after the game saves again (${cur})`);
  // 壞掉的
  const s0 = await p.evaluate(() => localStorage.getItem('carid.tune'));
  for (const bad of ['%%%', pack({ 'carid.sound': 'off' }), Buffer.from('{"v":2,"keys":{}}').toString('base64url'), pack({ 'carid.tune': 'not json' })]) {
    const r = await p.evaluate((s) => { const ok = window.beauImport(s); return { ok, open: !document.getElementById('impDlg').hidden, msg: document.getElementById('impMsg').textContent, yes: !document.getElementById('impYes').hidden, no: document.getElementById('impNo').textContent }; }, bad);
    await p.click('#impNo');
    check(!r.ok && r.open && r.msg === '搬家的資料看不懂，沒有搬。' && !r.yes && r.no === '好' && await p.evaluate(() => localStorage.getItem('carid.tune')) === s0, `bad data (${bad.slice(0, 16)}…): 「${r.msg}」 with only 好, nothing changed`);
  }
  await ctx.close();
}

await b.close(); srv.close(); fs.rmSync(site, { recursive: true, force: true });
console.log(errs.length ? `ERRORS ${errs.length}` : 'no page errors');
check(!errs.length, 'no page errors');
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL OK', el());
process.exit(fails.length ? 1 : 0);
