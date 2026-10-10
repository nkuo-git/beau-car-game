// 連線第 1 步：鬼影車排行榜（site/online.js＋ghost.src.js 的 window.beauGame）：node online-test.mjs [docs 資料夾，預設 ../docs/try] [截圖 prefix，預設 ../out/online/online]
//   雲端是假的（window.__beauCloudBackend）：Firestore 的文件放在 Node 這邊（路徑 → 文件），規則（只能寫自己的、只能變快）這裡也照做
//   1 打開：右上角「👥 連線」和「☁ 登入」都在畫面裡；沒登入按「連線」→「要先登入」→ 登入 → 取名字
//   2 取名字：太短、髒話、email、電話都不行；好的名字 → 連線選單（排行榜、你的名字）；雲端 players/{uid}
//   3 跑完一趟（遊戲發 'beau-run'）→ 傳到 lb/hill-gc8 和 lb/hill（名字、車、秒數＋鬼影車）；慢的不傳；快的蓋過去
//   4 登出時跑的先記在這支手機 → 登入以後自己傳上去
//   5 排行榜：400 公尺（前 20 名、順序、名字 · 車、秒數）；不在前 20 名也列出自己第幾名；同一台車只有那台；爬山有你（框起來）
//   6 「👻 跟第 1 名的鬼影車跑」→ 下載 → 遊戲的 beauGame.ghost 有了、鬼影車載好；說要去哪裡
//   7 排行榜打不開（雲端錯誤）→ 說「等一下再試」
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [docsArg, prefix = path.join(dir, '../out/online/online')] = process.argv.slice(2);
const docs = path.resolve(docsArg || path.join(dir, '../docs/try'));
const parent = path.dirname(docs);
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
const URL0 = `http://127.0.0.1:${srv.address().port}/site/`;
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [], fails = [];
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const T0 = Date.now(), el = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`;

// ---- 假的 Firestore：路徑 → 文件；寫的規則照 notes/online.md ----
const FS = new Map(); let broken = false;
const ME = 'u1';
const coll = (c) => [...FS.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ uid: k.slice(c.length + 1), ...v }));
function rule(p, d, uid) { // 跟 Firestore 規則一樣：只能寫自己的；runs/ghosts 只能變快（一樣快可以：改名字）
  const m = /^(players|lb\/((?:drag|lap|hill)(?:-[a-z0-9]+)?)\/(runs|ghosts))\/([^/]+)$/.exec(p);
  if (!m || m[4] !== uid) return false;
  if (m[1] === 'players') return typeof d.name === 'string' && d.name.length >= 1 && d.name.length <= 10;
  const old = FS.get(p);
  return typeof d.t === 'number' && d.t > 1 && d.t < 900 && typeof d.name === 'string' && (!old || d.t <= old.t);
}
const seed = (p, d) => FS.set(p, d);
// 別人的成績：400 公尺 25 個人（你不在前 20 名）、爬山 3 個人
const CARS = ['jesko', 'gtr', 'p918', 'gc8', 'supra'];
for (let i = 0; i < 25; i++) { const car = CARS[i % 5], t = +(8.9 + i * 0.13).toFixed(2), name = `車手${i + 1}號`; seed(`lb/drag/runs/p${i}`, { name, car, t }); seed(`lb/drag-${car}/runs/p${i}`, { name, car, t }); }
for (const [i, car, t] of [[0, 'gtr', 62.4], [1, 'gc8', 71.8], [2, 'jesko', 80.1]]) { seed(`lb/hill/runs/h${i}`, { name: `山道${i + 1}`, car, t }); seed(`lb/hill-${car}/runs/h${i}`, { name: `山道${i + 1}`, car, t }); }
// 400 公尺第 1 名的鬼影車：起跑線往前一直開（c＝1：每 0.1 秒的 x），9 秒左右到 400 公尺
const pack1 = (xs) => { const s = [Math.round(xs[0] * 10)], buf = Buffer.alloc((xs.length - 1) * 2); let prev = s[0]; xs.slice(1).forEach((x, i) => { const v = Math.round(x * 10); buf.writeInt16LE(v - prev, i * 2); prev = v; }); return { hz: 10, c: 1, n: xs.length, s, d: buf.toString('base64') }; };
const dragXs = []; for (let i = 0; i <= 95; i++) { const tt = i / 10, go = Math.max(0, tt - 0.2); dragXs.push(Math.min(410, 4.94 * go * go)); }
seed('lb/drag/ghosts/p0', { name: '車手1號', car: 'jesko', t: 8.9, ...pack1(dragXs) });
// 爬山：你跑的那一趟（c＝3：x、z、方向）
const pack3 = (pts) => { const q = (p) => [Math.round(p[0] * 10), Math.round(p[1] * 10), Math.round(p[2] * 100)], s = q(pts[0]), buf = Buffer.alloc((pts.length - 1) * 6); let prev = s.slice(); pts.slice(1).forEach((p, i) => { const v = q(p); for (let j = 0; j < 3; j++) { buf.writeInt16LE(v[j] - prev[j], (i * 3 + j) * 2); prev[j] = v[j]; } }); return { hz: 10, c: 3, n: pts.length, s, d: buf.toString('base64') }; };
const hillPts = (t) => { const pts = []; for (let i = 0; i <= t * 10; i++) pts.push([-252 + i * 0.1, -70 - i * 1.2, 1.57]); return pts; };

const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: 'block', userAgent: UA });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
const SAVES = new Map();
await ctx.exposeFunction('__cloudGet', (uid) => (SAVES.has(uid) ? SAVES.get(uid) : null));
await ctx.exposeFunction('__cloudPut', (uid, d) => { SAVES.set(uid, d); return true; });
await ctx.exposeFunction('__fsGet', (p) => { if (broken) throw new Error('unavailable'); return FS.has(p) ? JSON.parse(JSON.stringify(FS.get(p))) : null; });
await ctx.exposeFunction('__fsSet', (p, d, uid) => { if (broken) throw new Error('unavailable'); if (!rule(p, d, uid)) throw new Error('permission-denied ' + p); FS.set(p, d); return true; });
await ctx.exposeFunction('__fsMerge', (p, d, uid) => { if (broken) throw new Error('unavailable'); const o = FS.get(p); if (!o) throw new Error('not-found'); const n = { ...o, ...d }; if (!rule(p, n, uid)) throw new Error('permission-denied'); FS.set(p, n); return true; });
await ctx.exposeFunction('__fsTop', (c, n) => { if (broken) throw new Error('unavailable'); return coll(c).sort((a, b) => a.t - b.t).slice(0, n); });
await ctx.exposeFunction('__fsCount', (c, t) => coll(c).filter((r) => r.t < t).length);
await ctx.addInitScript(() => {
  window.__roomWatch = false;
  window.__beauCloudBackend = () => {
    let cb = null, u = null;
    try { u = JSON.parse(localStorage.getItem('fake.user') || 'null'); } catch { u = null; }
    const login = (who) => { u = who; localStorage.setItem('fake.user', JSON.stringify(u)); cb && cb(u); };
    const me = () => (u ? u.uid : null);
    return {
      onUser(f) { cb = f; setTimeout(() => f(u), 0); },
      async popup() { login({ uid: 'u1', email: 'nick@example.com', displayName: 'Nick' }); },
      async token() { login({ uid: 'u1', email: 'nick@example.com', displayName: 'Nick' }); },
      async out() { u = null; localStorage.removeItem('fake.user'); cb && cb(null); },
      get: (uid) => window.__cloudGet(uid),
      put: (uid, d) => window.__cloudPut(uid, d),
      nameGet: async (uid) => (await window.__fsGet('players/' + uid))?.name || null,
      namePut: (uid, name) => window.__fsSet('players/' + uid, { name, t: Date.now() }, me()),
      lbTop: (bd, n) => window.__fsTop(`lb/${bd}/runs`, n),
      lbRank: async (bd, t) => (await window.__fsCount(`lb/${bd}/runs`, t)) + 1,
      lbGet: (bd, uid) => window.__fsGet(`lb/${bd}/runs/${uid}`),
      lbPut: async (bd, uid, run, ghost) => { await window.__fsSet(`lb/${bd}/runs/${uid}`, { ...run, at: Date.now() }, me()); await window.__fsSet(`lb/${bd}/ghosts/${uid}`, ghost, me()); },
      lbName: async (bd, uid, name) => { await window.__fsMerge(`lb/${bd}/runs/${uid}`, { name }, me()); await window.__fsMerge(`lb/${bd}/ghosts/${uid}`, { name }, me()); },
      ghostGet: (bd, uid) => window.__fsGet(`lb/${bd}/ghosts/${uid}`),
    };
  };
});
const p = await ctx.newPage();
p.setDefaultTimeout(240000);
p.on('pageerror', (e) => { errs.push(e.message); console.log('pageerror', e.message); });
const waitFor = (fn, arg, ms = 30000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const st = () => p.evaluate(() => {
  const $ = (id) => document.getElementById(id), shown = (id) => { const e = $(id); return !!e && !e.closest('[hidden]'); };
  return { chip: $('netChip').hidden ? null : $('netChip').textContent, dlg: !$('netDlg').hidden, title: $('netTitle').textContent, sec: ['nwIn', 'nwName', 'nwMenu', 'nwBoard'].filter(shown).join(),
    nameErr: shown('nwNameErr') ? $('nwNameErr').textContent : '', user: window.beauCloud?.user?.uid || null, name: window.__beauNet.name, q: Object.keys(window.__beauNet.queue), up: window.__beauNet.uploads };
});
const run = (d) => p.evaluate((d) => window.dispatchEvent(new CustomEvent('beau-run', { detail: d })), d);
const rowsNow = () => p.evaluate(() => [...document.querySelectorAll('#nwList li, #nwMine:not([hidden]) li')].map((li) => ({ me: li.classList.contains('me'), gap: li.classList.contains('gap'), txt: [...li.children].map((c) => c.textContent).join('|') || li.textContent })));

await p.goto(URL0, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => document.getElementById('status')?.hidden && window.__beauNet && window.beauGame, null, { timeout: 300000 });

// ---- 1 打開、要先登入 ----
{
  const s = await st();
  const lay = await p.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), n = r('netChip'), c = r('cloudChip'), h = document.querySelector('.brand-name').getBoundingClientRect(); return { net: [Math.round(n.left), Math.round(n.right)], cloud: [Math.round(c.left), Math.round(c.right)], brandR: Math.round(h.right), w: innerWidth, scrollW: document.documentElement.scrollWidth }; });
  console.log('1', el(), JSON.stringify(s), JSON.stringify(lay));
  check(s.chip === '👥 連線' && !s.dlg, `「👥 連線」 at the top (${s.chip})`);
  check(lay.net[1] <= lay.cloud[0] && lay.cloud[1] <= lay.w && lay.scrollW <= lay.w, `both chips fit in the title bar at 390 px, no sideways scroll (${JSON.stringify(lay)})`);
  await p.screenshot({ path: `${prefix}-1-top.png`, clip: { x: 0, y: 0, width: 390, height: 120 } });
  await p.setViewportSize({ width: 320, height: 700 }); await p.waitForTimeout(300);
  const narrow = await p.evaluate(() => { const c = document.getElementById('cloudChip').getBoundingClientRect(), n = document.getElementById('netChip').getBoundingClientRect(); return { cloudR: Math.round(c.right), netR: Math.round(n.right), netL: Math.round(n.left), cloudL: Math.round(c.left), top: Math.round(n.top), ctop: Math.round(c.top), scrollW: document.documentElement.scrollWidth, w: innerWidth }; });
  await p.screenshot({ path: `${prefix}-1-top-320.png`, clip: { x: 0, y: 0, width: 320, height: 120 } });
  check(narrow.cloudR <= narrow.w && narrow.netR <= narrow.cloudL && narrow.scrollW <= narrow.w && narrow.top === narrow.ctop, `a narrow phone (320 px): both chips still fit on one line (${JSON.stringify(narrow)})`);
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  await p.click('#netChip');
  const s1 = await st();
  check(s1.dlg && s1.sec === 'nwIn' && s1.title === '連線', `not signed in → 「要先登入才能連線」 with 用 Google 帳號登入 (${s1.sec})`);
  await p.click('#nwLogin');
  const ok = await waitFor(() => !document.getElementById('nwName').closest('[hidden]'));
  const s2 = await st();
  check(ok && s2.user === ME && s2.sec === 'nwName' && s2.title === '取一個名字', `signs in → first time: 「取一個名字」 (${s2.sec})`);
}

// ---- 2 取名字 ----
{
  const tryName = async (v) => { await p.fill('#nwNameIn', v); await p.click('#nwNameOk'); await new Promise((r) => setTimeout(r, 300)); return st(); };
  const bad = [];
  for (const [v, re] of [['車', /至少/], ['幹你娘', /髒話/], ['F u c k', /髒話/], ['nick@gmail.com', /email/], ['0912345678', /電話/], ['我是<b>', /只能用/]]) { const s = await tryName(v); bad.push(`${v}→${s.nameErr.slice(0, 8)}`); check(re.test(s.nameErr) && s.sec === 'nwName' && !FS.has('players/u1'), `name 「${v}」 is refused (${s.nameErr})`); }
  await p.screenshot({ path: `${prefix}-2-name-bad.png` });
  const s = await tryName('大便龍車神');
  check(s.sec === 'nwMenu' && s.name === '大便龍車神' && FS.get('players/u1')?.name === '大便龍車神' && (await p.textContent('#nwMyName')) === '大便龍車神', `「大便龍車神」 → saved (players/u1) → 連線 menu with 🏆 排行榜 and your name (${s.sec})`);
  const email = await p.evaluate(() => document.getElementById('netDlg').textContent.includes('@'));
  check(!email, 'no email anywhere on the 連線 sheets');
  await p.screenshot({ path: `${prefix}-2-menu.png` });
}

// ---- 3 跑完一趟就上傳 ----
{
  const g = pack3(hillPts(75.5));
  await run({ board: 'hill', car: 'gc8', t: 75.5, g });
  await waitFor(() => window.__beauNet.uploads >= 2 && !Object.keys(window.__beauNet.queue).length);
  const r1 = FS.get('lb/hill-gc8/runs/u1'), r0 = FS.get('lb/hill/runs/u1'), gh = FS.get('lb/hill/ghosts/u1');
  console.log('3', el(), JSON.stringify({ r1, r0, gh: gh && { ...gh, d: gh.d.length } }));
  check(r1?.t === 75.5 && r0?.t === 75.5 && r1.name === '大便龍車神' && r1.car === 'gc8' && gh?.d === g.d && gh.n === g.n && FS.get('lb/hill-gc8/ghosts/u1')?.d === g.d, `a hill run (75.50 s, GC8) → uploaded to 爬山 (everyone) and 爬山 GC8, with the ghost (${g.d.length} chars)`);
  const up0 = (await st()).up;
  await run({ board: 'hill', car: 'gc8', t: 80.2, g: pack3(hillPts(80.2)) });
  await new Promise((r) => setTimeout(r, 1200));
  const s = await st();
  check(s.up === up0 && FS.get('lb/hill/runs/u1').t === 75.5 && !s.q.length, `a slower run (80.20) is not uploaded, queue empty (${s.up - up0} uploads)`);
  await run({ board: 'hill', car: 'gc8', t: 70.25, g: pack3(hillPts(70.25)) });
  await waitFor((u) => window.__beauNet.uploads >= u + 2, up0);
  check(FS.get('lb/hill/runs/u1').t === 70.25 && FS.get('lb/hill-gc8/runs/u1').t === 70.25, `a faster run (70.25) replaces it (${FS.get('lb/hill/runs/u1').t})`);
  await run({ board: 'hill', car: 'supra', t: 72, g: pack3(hillPts(72)) });
  await waitFor((u) => window.__beauNet.uploads >= u + 3, up0);
  check(FS.get('lb/hill-supra/runs/u1')?.t === 72 && FS.get('lb/hill/runs/u1').t === 70.25, `another car (SUPRA 72.00): its own 同一台車 board gets it, 大家 keeps your best 70.25`);
  await run({ board: 'drag', car: 'gc8', t: 0.5, g: pack3(hillPts(2)) });
  await run({ board: 'drift', car: 'gc8', t: 30, g: pack3(hillPts(3)) });
  await new Promise((r) => setTimeout(r, 800));
  check(!(await st()).q.length && !FS.has('lb/drag/runs/u1'), 'bad runs (0.5 s, unknown board) are ignored');
}

// ---- 4 登出的時候先記著 ----
{
  await p.click('#netX');
  await p.click('#cloudChip'); await p.click('#clOut');
  await waitFor(() => !window.beauCloud.user);
  await run({ board: 'lap', car: 'gc8', t: 95.5, g: pack3(hillPts(95.5)) });
  await new Promise((r) => setTimeout(r, 600));
  const s = await st();
  check(!s.user && s.q.includes('lap-gc8') && !FS.has('lb/lap/runs/u1'), `signed out: a lap run (1:35.50) is kept on the phone (queue ${s.q})`);
  await p.click('#cloudChip'); await p.click('#clGoogle');
  const ok = await waitFor(() => window.beauCloud.user && !Object.keys(window.__beauNet.queue).length);
  check(ok && FS.get('lb/lap/runs/u1')?.t === 95.5 && FS.get('lb/lap-gc8/runs/u1')?.t === 95.5, `sign in again → it uploads by itself (賽車場一圈 ${FS.get('lb/lap/runs/u1')?.t})`);
}

// ---- 5 排行榜 ----
{
  await p.click('#netChip');
  await waitFor(() => !document.getElementById('nwMenu').closest('[hidden]'));
  await p.click('#nwBoardBtn');
  await waitFor(() => document.querySelectorAll('#nwList li').length >= 20);
  // 400 公尺：你也跑一趟（很慢，不在前 20 名）
  await run({ board: 'drag', car: 'gc8', t: 13.82, g: pack1(dragXs.map((x) => x * 0.6)) });
  await waitFor(() => [...document.querySelectorAll('#nwList li, #nwMine li')].some((li) => li.classList.contains('me')));
  const r = await rowsNow();
  const tabs = await p.evaluate(() => [...document.querySelectorAll('#nwTabs button, #nwFilt button')].map((b) => `${b.textContent}${b.getAttribute('aria-selected') === 'true' ? '*' : ''}`));
  console.log('5', el(), JSON.stringify(tabs), JSON.stringify(r.slice(0, 3)), JSON.stringify(r.slice(-3)));
  check(tabs.join() === '400 公尺*,賽車場一圈,爬山,大家*,同一台車（GC8）', `tabs 400 公尺／賽車場一圈／爬山 and 大家／同一台車（GC8） (${tabs})`);
  const top = r.filter((x) => !x.gap && !x.me);
  check(top.length === 20 && top[0].txt === '1|車手1號 · JESKO|8.90' && top[1].txt.startsWith('2|車手2號 · GT-R') && top.every((x, i) => x.txt.startsWith(`${i + 1}|`)), `top 20 in order: 「1 | 車手1號 · JESKO | 8.90」… (${top.length} rows)`);
  const mine = r[r.length - 1];
  const vis = await p.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), m = document.querySelector('#nwMine li.me'); return { mine: m ? Math.round(m.getBoundingClientRect().bottom) : null, ghost: Math.round(r('nwGhost').bottom), h: innerHeight }; });
  check(r[r.length - 2].gap && mine.me && mine.txt === '26|大便龍車神 · GC8|13.82' && vis.mine != null && vis.mine < vis.h && vis.ghost <= vis.h, `you're not in the top 20 → ⋮ then your own row, framed: 「${mine.txt}」; your row and the ghost button are on screen without scrolling (${JSON.stringify(vis)})`);
  await p.screenshot({ path: `${prefix}-5-board.png` });
  await p.click('#nwFiltCar');
  await waitFor(() => document.querySelectorAll('#nwList li').length && [...document.querySelectorAll('#nwList .w')].every((w) => / · GC8$/.test(w.textContent)));
  const rc = await rowsNow();
  check(rc.length >= 2 && rc.every((x) => x.gap || /· GC8\|/.test(x.txt)) && rc.some((x) => x.me && /^6\|/.test(x.txt)), `同一台車: only GC8 times, you're 6th (${rc.map((x) => x.txt.split('|')[0]).join(',')})`);
  await p.click('#nwTabs [data-b="hill"]');
  await p.click('#nwFilt [data-f="all"]');
  await waitFor(() => document.querySelectorAll('#nwList li').length === 4);
  const rh = await rowsNow();
  check(rh.length === 4 && /^1\|山道1 · .+\|1:02\.40$/.test(rh[0].txt) && /^2\|大便龍車神 · GC8\|1:10\.25$/.test(rh[1].txt) && rh[1].me && !rh[0].me && /\|1:20\.10$/.test(rh[3].txt), `爬山: you're 2nd (framed) with 1:10.25 (${rh.map((x) => x.txt).join(' / ')})`);
  await p.screenshot({ path: `${prefix}-5-hill.png` });
}

// ---- 6 鬼影車 ----
{
  await p.click('#nwTabs [data-b="drag"]');
  await waitFor(() => document.querySelectorAll('#nwList li').length >= 20 && !document.getElementById('nwGhost').disabled);
  const label = await p.textContent('#nwGhost');
  await p.click('#nwGhost');
  const ok = await waitFor(() => window.beauGame.ghost && !document.getElementById('nwGhostMsg').hidden && !/下載中/.test(document.getElementById('nwGhostMsg').textContent));
  const gst = await p.evaluate(() => ({ g: window.beauGame.ghost, msg: document.getElementById('nwGhostMsg').textContent }));
  console.log('6', el(), JSON.stringify(gst));
  check(label === '👻 跟第 1 名的鬼影車跑' && ok && gst.g.board === 'drag' && gst.g.name === '車手1號' && gst.g.car === 'jesko' && gst.g.t === 8.9 && /400 公尺/.test(gst.msg), `「👻 跟第 1 名的鬼影車跑」 → the game has 車手1號's 400 m ghost (JESKO 8.90) → 「${gst.msg}」`);
  const ready = await waitFor(() => window.beauGame.ghost?.ready, null, 120000);
  check(ready, 'the ghost car (light car, see-through) is built and waiting');
  await p.screenshot({ path: `${prefix}-6-ghost.png` });
  const bad = await p.evaluate(() => [window.beauGame.setGhost('drag', { name: 'x', car: 'gc8', t: 9, g: { hz: 10, c: 3, n: 2, s: [0, 0, 0], d: 'AAAAAAAA' } }), window.beauGame.setGhost('hill', { name: 'x', car: 'gc8', t: 9, g: { hz: 10, c: 3, n: 5, s: [0, 0, 0], d: 'AAAA' } }), window.beauGame.setGhost('nope', {})]);
  check(bad.every((x) => x === false) && (await p.evaluate(() => window.beauGame.ghost?.name)) === '車手1號', `broken ghosts (wrong kind, wrong length, unknown board) are refused, the good one stays (${bad})`);
}

// ---- 7 雲端壞了 ----
{
  broken = true;
  await p.click('#nwTabs [data-b="lap"]');
  const ok = await waitFor(() => /等一下再試/.test(document.getElementById('nwEmpty').textContent) && !document.getElementById('nwEmpty').hidden);
  check(ok, 'the cloud fails → 「排行榜現在打不開，等一下再試。」');
  broken = false;
  await p.click('#netX');
  check(!(await st()).dlg, '✕ closes it');
}

await ctx.close(); await b.close(); srv.close();
console.log(fails.length ? `FAILED: ${fails.length} failed — ${fails.join(' / ')}; page errors ${errs.length} ${el()}` : `ALL OK: 0 failed; page errors ${errs.length}; ${el()}`);
process.exit(fails.length || errs.length ? 1 : 0);
