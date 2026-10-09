// 登入＋雲端存檔（site/cloud.js）：node cloud-test.mjs [docs 資料夾，預設 ../docs/try] [截圖 prefix，預設 ../out/cloud/cloud]
//   雲端是假的（window.__beauCloudBackend：一份放在 Node 這邊的 saves，兩個瀏覽器分頁＝兩支手機共用；Google 登入直接成功）
//   1 打開：右上角「☁ 登入」；按了跳「登入」（用 Google 帳號登入／先不要）
//   2 手機 A 登入：「已登入」、雲端有這支手機的存檔；換車色（遊戲 save() → 'beau-save'）→ 一下子以後雲端也換了；帳號畫面「雲端存檔：剛剛存好了」
//   3 手機 B（自己有進度）第一次登入 → 問「要用哪一個進度？」（雲端的錢／這支手機的錢）→ 用雲端的 → 重新載入，B 的存檔＝雲端的、還是已登入
//   4 B 改了、存上去 → A 重新打開：A 從上次之後沒改過 → 直接用雲端的（不用問）
//   5 兩邊都改了 → 問 → 用這支手機的 → 雲端換成這支手機的
//   6 沒有網路：存不上去（記著）→ 有網路 → 補存上去
//   7 登出：「☁ 登入」、這支手機的進度還在、不會再存到雲端
//   8 App（BeauCarApp）：舊外殼（沒有 googleSignIn）→ 說要先更新 App；新外殼 → 叫 googleSignIn()，拿到 token 登入
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [docsArg, prefix = path.join(dir, '../out/cloud/cloud')] = process.argv.slice(2);
const docs = path.resolve(docsArg || path.join(dir, '../docs/try'));
const parent = path.dirname(docs); // 試玩頁的車身檔用 ../tune/（正式網站的）
fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u.startsWith('/three/') ? path.join(three, u.slice(7)) : u.startsWith('/site/') ? path.join(docs, u.slice(6) || 'index.html') : path.join(parent, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  let body = fs.readFileSync(f);
  if (f.endsWith('.html')) body = body.toString('utf8').replaceAll('https://cdn.jsdelivr.net/npm/three@0.186.1/', '/three/');
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(body);
}).listen(0);
// 試玩頁放在 /site/（車身檔 ../tune/ → /tune/ ＝ 正式網站的 docs/tune）
const URL0 = `http://127.0.0.1:${srv.address().port}/site/`;
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [], fails = [];
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const T0 = Date.now(), el = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`;

// 假的雲端：Node 這邊一份 saves（uid → 資料），offline 的時候 get/put 都丟錯
const CLOUD = new Map(); let offline = false, puts = 0;
const UA = (apk) => 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36' + (apk ? ` BeauCarApp/${apk}` : '');
async function device({ apk = null, shell = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: 'block', userAgent: UA(apk) });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await ctx.exposeFunction('__cloudGet', (uid) => { if (offline) throw new Error('offline'); return CLOUD.has(uid) ? JSON.parse(JSON.stringify(CLOUD.get(uid))) : null; });
  await ctx.exposeFunction('__cloudPut', (uid, d) => { if (offline) throw new Error('offline'); CLOUD.set(uid, d); puts++; return true; });
  await ctx.addInitScript(() => {
    window.__roomWatch = false;
    window.__beauCloudBackend = () => {
      let cb = null, u = null;
      try { u = JSON.parse(localStorage.getItem('fake.user') || 'null'); } catch { u = null; }
      const login = (who) => { u = who; localStorage.setItem('fake.user', JSON.stringify(u)); cb && cb(u); };
      return {
        onUser(f) { cb = f; setTimeout(() => f(u), 0); },
        async popup() { login({ uid: 'u1', email: 'nick@example.com', displayName: 'Nick' }); },
        async token(t) { window.__gotToken = t; login({ uid: 'u1', email: 'nick@example.com', displayName: 'Nick' }); },
        async out() { u = null; localStorage.removeItem('fake.user'); cb && cb(null); },
        get: (uid) => window.__cloudGet(uid),
        put: (uid, d) => window.__cloudPut(uid, d),
      };
    };
  });
  if (shell === 'old') await ctx.addInitScript(() => { window.BeauCarApp = { ready() {}, setFullscreen() {} }; });
  if (shell === 'new') await ctx.addInitScript(() => { window.__gsi = 0; window.BeauCarApp = { ready() {}, setFullscreen() {}, googleSignIn() { window.__gsi++; setTimeout(() => window.beauGoogleSignIn('fake-id-token'), 50); } }; });
  const p = await ctx.newPage();
  p.setDefaultTimeout(240000);
  p.on('pageerror', (e) => { errs.push(e.message); console.log('pageerror', e.message); });
  return { ctx, p };
}
const ready = (p) => p.waitForFunction(() => document.getElementById('status')?.hidden && window.__beauCloud, null, { timeout: 300000 });
const open = async (p) => { await p.goto(URL0, { waitUntil: 'domcontentloaded' }); await ready(p); };
const st = (p) => p.evaluate(() => {
  const C = window.__beauCloud, t = localStorage.getItem('carid.tune'), $ = (id) => document.getElementById(id), shown = (id) => { const e = $(id); return !!e && !e.closest('[hidden]'); };
  let money = null; try { money = JSON.parse(t).money; } catch { /* 沒有存檔 */ }
  return { chip: $('cloudChip').hidden ? null : $('cloudChipTxt').textContent, user: C.user?.email || null, status: C.status, picking: C.picking, dirty: C.dirty, meta: C.meta, tune: t, money,
    dlg: !$('cloudDlg').hidden, title: $('cloudTitle').textContent, sec: ['clIn', 'clAcct', 'clPick'].filter(shown).join(), err: shown('clErr') ? $('clErr').textContent : '' };
});
const waitFor = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 30000 }).then(() => true, () => false);
const setMoney = (p, n) => p.evaluate((n) => { const d = JSON.parse(localStorage.getItem('carid.tune')); d.money = n; localStorage.setItem('carid.tune', JSON.stringify(d)); window.dispatchEvent(new Event('beau-save')); }, n);
const cloudMoney = () => { const d = CLOUD.get('u1'); try { return JSON.parse(d.keys['carid.tune']).money; } catch { return null; } };

// ---- 1 打開 ----
const A = await device();
await open(A.p);
{
  const s0 = await st(A.p);
  console.log('1', el(), JSON.stringify({ ...s0, tune: !!s0.tune }));
  check(s0.chip === '☁ 登入' && !s0.dlg && !s0.user, `opens with 「☁ 登入」 at the top right, not signed in (${s0.chip})`);
  await A.p.click('#cloudChip');
  const s1 = await st(A.p);
  const lay = await A.p.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); const c = r('cloudChip'); return { chipRight: Math.round(c.right), chipTop: Math.round(c.top), w: innerWidth, card: Math.round(document.querySelector('.cl-card').getBoundingClientRect().width) }; });
  check(s1.dlg && s1.title === '登入' && s1.sec === 'clIn' && lay.chipRight <= lay.w && lay.chipTop < 60, `tap it → 「登入」 sheet (用 Google 帳號登入／先不要), chip inside the screen (${JSON.stringify(lay)})`);
  await A.p.screenshot({ path: `${prefix}-1-login.png` });
  await A.p.click('#clLater');
  check(!(await st(A.p)).dlg, '「先不要」 closes it');
}

// ---- 2 手機 A 登入、存檔 ----
{
  await A.p.click('#cloudChip'); await A.p.click('#clGoogle');
  const ok = await waitFor(A.p, () => window.__beauCloud.user && !document.getElementById('cloudChip').hidden && window.__beauCloud.status && !/讀取|存檔中/.test(window.__beauCloud.status));
  const s = await st(A.p);
  console.log('2', el(), JSON.stringify({ ...s, tune: !!s.tune }), 'cloud', !!CLOUD.get('u1'));
  check(ok && s.user === 'nick@example.com' && s.chip === '已登入' && !s.dlg, `signed in with Google: chip 「已登入」, sheet closed (${s.chip}, ${s.status})`);
  const local = s.tune;
  check(!local || CLOUD.get('u1')?.keys['carid.tune'] === local, `the phone's save went up to the cloud (${local ? 'same string' : 'no local save yet'})`);
  // 換車色 → 遊戲 save() → beau-save → 2.5 秒後存上去
  const n0 = puts;
  const u0 = await A.p.evaluate(() => { window.__saves = 0; window.addEventListener('beau-save', () => window.__saves++); return window.__beauCloud.uploads; });
  await A.p.click('#paints .chip[aria-pressed="false"]');
  const up = await waitFor(A.p, (u0) => window.__beauCloud.uploads > u0 && window.__saves > 0 && window.__beauCloud.status === '剛剛存好了', u0);
  const s2 = await st(A.p);
  check(up && puts > n0 && CLOUD.get('u1').keys['carid.tune'] === s2.tune && CLOUD.get('u1').sum && s2.meta?.uid === 'u1', `changing the paint saves (game fires 'beau-save') → uploaded a moment later, cloud = this phone (${puts - n0} put)`);
  await A.p.click('#cloudChip');
  const s3 = await st(A.p);
  check(s3.title === '帳號' && s3.sec === 'clAcct' && /剛剛存好了/.test(await A.p.textContent('#clStatus')) && (await A.p.textContent('#clEmail')) === 'nick@example.com', `account sheet: email, 「雲端存檔：剛剛存好了」, 登出 (${await A.p.textContent('#clStatus')})`);
  await A.p.screenshot({ path: `${prefix}-2-account.png` });
  await A.p.click('#cloudX');
  await setMoney(A.p, 470);
  await waitFor(A.p, () => window.__beauCloud.status === '剛剛存好了' && JSON.parse(localStorage.getItem('carid.tune')).money === 470);
  await new Promise((r) => setTimeout(r, 3000));
  check(cloudMoney() === 470, `money 470 萬 on phone A → cloud has 470 (${cloudMoney()})`);
}

// ---- 3 手機 B 第一次登入：問要用哪一個 ----
// 兩支手機的 3D 一起跑太慢：一次只開一支（另一支先換成空白頁＝放下手機）
const blank = (p) => p.goto('about:blank');
await blank(A.p);
const B = await device();
await open(B.p);
{
  // B 自己也玩過（錢不一樣）
  await B.p.evaluate(() => { const t = localStorage.getItem('carid.tune'); const d = t ? JSON.parse(t) : { v: 2, cur: 'gc8', owned: ['gc8'], money: 0 }; d.money = 75; localStorage.setItem('carid.tune', JSON.stringify(d)); });
  await B.p.click('#cloudChip'); await B.p.click('#clGoogle');
  const asked = await waitFor(B.p, () => window.__beauCloud.picking);
  const s = await st(B.p);
  const sums = [await B.p.textContent('#clCloudSum'), await B.p.textContent('#clLocalSum')];
  console.log('3', el(), JSON.stringify(sums));
  check(asked && s.title === '要用哪一個進度？' && s.sec === 'clPick' && /470/.test(sums[0]) && /75/.test(sums[1]), `phone B (own progress) signs in → 「要用哪一個進度？」 cloud 470 萬 vs this phone 75 萬`);
  check(await B.p.evaluate(() => document.getElementById('cloudX').hidden), 'no ✕ on that one (has to pick)');
  await B.p.screenshot({ path: `${prefix}-3-pick.png` });
  const nav = B.p.waitForNavigation({ waitUntil: 'domcontentloaded' });
  await B.p.click('#clUseCloud'); await nav; await ready(B.p);
  await waitFor(B.p, () => window.__beauCloud.user && window.__beauCloud.status);
  const s2 = await st(B.p);
  check(s2.money === 470 && s2.tune === CLOUD.get('u1').keys['carid.tune'] && s2.chip === '已登入', `用雲端的 → reloads with the cloud progress (470 萬), still signed in (${s2.money}, ${s2.chip}, ${s2.status})`);
}

// ---- 4 B 改了 → A 重新打開：直接用雲端的 ----
{
  await setMoney(B.p, 520);
  await waitFor(B.p, () => window.__beauCloud.status === '剛剛存好了' && JSON.parse(localStorage.getItem('carid.tune')).money === 520);
  await new Promise((r) => setTimeout(r, 3000));
  check(cloudMoney() === 520, `phone B: 520 萬 → cloud 520 (${cloudMoney()})`);
  await blank(B.p);
  await open(A.p); // A 上次之後沒改過
  const got = await waitFor(A.p, () => { try { return JSON.parse(localStorage.getItem('carid.tune')).money === 520; } catch { return false; } });
  if (got) await ready(A.p).catch(() => {});
  await waitFor(A.p, () => window.__beauCloud && window.__beauCloud.user && window.__beauCloud.status === '跟雲端一樣');
  const s = await st(A.p);
  console.log('4', el(), s.money, s.status, s.picking);
  check(got && s.money === 520 && !s.picking && s.status === '跟雲端一樣', `phone A (unchanged since its last sync) reopens → takes the cloud's 520 萬 without asking (${s.money}, ${s.status})`);
}

// ---- 5 兩邊都改了 → 問 → 用這支手機的 ----
{
  offline = true;
  await setMoney(A.p, 600); // 存不上去
  await waitFor(A.p, () => window.__beauCloud.dirty);
  await blank(A.p); // 還是沒有網路的時候放下 A
  offline = false;
  await open(B.p);
  await waitFor(B.p, () => window.__beauCloud.user && window.__beauCloud.status === '跟雲端一樣');
  await setMoney(B.p, 610);
  await waitFor(B.p, () => window.__beauCloud.status === '剛剛存好了' && JSON.parse(localStorage.getItem('carid.tune')).money === 610);
  await new Promise((r) => setTimeout(r, 3000));
  await blank(B.p);
  await open(A.p);
  const asked = await waitFor(A.p, () => window.__beauCloud.picking);
  const sums = asked ? [await A.p.textContent('#clCloudSum'), await A.p.textContent('#clLocalSum')] : [];
  check(asked && /610/.test(sums[0]) && /600/.test(sums[1]), `both changed (A offline 600, B 610) → A asks (cloud 610 / this phone 600) ${JSON.stringify(sums)}`);
  await A.p.click('#clUseLocal');
  await waitFor(A.p, () => window.__beauCloud.status === '剛剛存好了');
  const s = await st(A.p);
  check(cloudMoney() === 600 && s.money === 600 && !s.dlg, `用這支手機的 → cloud becomes 600 (${cloudMoney()})`);
}

// ---- 6 沒有網路：記著，有網路再存 ----
{
  offline = true;
  await A.p.context().setOffline(true);
  await setMoney(A.p, 650);
  const d = await waitFor(A.p, () => window.__beauCloud.dirty && /網路|存不進去/.test(window.__beauCloud.status));
  const s = await st(A.p);
  check(d && cloudMoney() === 600, `offline: can't save (${s.status}), cloud still 600`);
  offline = false;
  await A.p.context().setOffline(false);
  await A.p.evaluate(() => window.dispatchEvent(new Event('online')));
  const up = await waitFor(A.p, () => !window.__beauCloud.dirty && window.__beauCloud.status === '剛剛存好了');
  check(up && cloudMoney() === 650, `back online → saved up (${cloudMoney()})`);
}

// ---- 7 登出 ----
{
  await A.p.click('#cloudChip'); await A.p.click('#clOut');
  const s = await st(A.p);
  const n0 = puts;
  await setMoney(A.p, 700);
  await new Promise((r) => setTimeout(r, 3500));
  check(s.chip === '☁ 登入' && !s.user && !s.meta && s.money === 650 && puts === n0 && cloudMoney() === 650, `登出 → 「☁ 登入」, this phone keeps its progress (650), no more cloud saves (${s.chip}, cloud ${cloudMoney()})`);
}
await A.ctx.close(); await B.ctx.close();

// ---- 8 App 裡 ----
{
  const O = await device({ apk: 3, shell: 'old' });
  await open(O.p);
  await O.p.click('#cloudChip'); await O.p.click('#clGoogle');
  await waitFor(O.p, () => !document.getElementById('clErr').hidden);
  const s = await st(O.p);
  check(/更新 App/.test(s.err) && !s.user, `old app shell (no googleSignIn) → 「要先更新 App 才能登入⋯」 (${s.err.slice(0, 20)}…)`);
  await O.p.screenshot({ path: `${prefix}-8-old-app.png` });
  await O.ctx.close();
  const N = await device({ apk: 4, shell: 'new' });
  await open(N.p);
  await N.p.click('#cloudChip'); await N.p.click('#clGoogle');
  const ok = await waitFor(N.p, () => window.__beauCloud.user);
  const r = await N.p.evaluate(() => ({ gsi: window.__gsi, tok: window.__gotToken }));
  check(ok && r.gsi === 1 && r.tok === 'fake-id-token', `new app shell → BeauCarApp.googleSignIn() → token back → signed in (${JSON.stringify(r)})`);
  await N.ctx.close();
}

await b.close(); srv.close();
console.log(fails.length ? `FAILED: ${fails.length} failed — ${fails.join(' / ')}; page errors ${errs.length} ${el()}` : `ALL OK: 0 failed; page errors ${errs.length}; ${el()}`);
process.exit(fails.length || errs.length ? 1 : 0);
