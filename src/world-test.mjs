// 大家的世界（site/world.js＋net.src.js）：node world-test.mjs [docs 資料夾，預設 ../docs/try] [截圖 prefix，預設 ../out/world/world]
//   兩支「手機」＝兩個瀏覽器（各自的存檔、登入：u1 大便龍車神、u2 阿明快車手）；即時資料庫是假的（Node 這邊：路徑 → 值、監聽、斷線、規則的重點）
//   1 進入世界：「現在有 0 個人在線上」、線上的人 1/16、記住下次自己進去、車庫放上去
//   2 第二個人：兩邊名單一樣（進來的順序）、🏁 🚗 🚫
//   3 各自出門：看得到對方、小地圖的點、名單寫在哪裡、去找他（箭頭跟著他、走到旁邊就到了）
//   4 表情
//   5 找人比賽（爬山）：等他回答、他的遊戲跳出卡片 → 好 → 起點、同時出發、成績
//   6 再比一次、兩個都回去開車（比賽收掉）
//   7 不要；再找一次 400 公尺 → 好、同時綠燈、成績一樣；A 先回去開車 → B 看到「對方離開了」；一起開車的 draw calls
//   8 封鎖（兩邊都看不到、規則擋邀請）、解除；關掉邀請；沒回答（15 秒＝不要）
//   9 車庫街：名牌（第 1 間是你）、停在朋友的車庫門口「🚗 看他的車庫」→ 回車庫頁參觀
//   10 參觀車庫（名單上 🚗）
//   11 離開世界、斷線（自己再進去）、滿了（16 個人）、斷線沒收好的人被清掉、重新打開遊戲自己進去
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [docsArg, prefix = path.join(dir, '../out/world/world')] = process.argv.slice(2);
const docs = path.resolve(docsArg || path.join(dir, '../docs/try'));
const parent = path.dirname(docs);
fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const hook = 'window.__R = () => race; window.__D = () => ({ on: DRIVE.on, drv, walker, trip, VIL, cur, indoor, GAR });'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__NET = () => NET; window.__CARS = () => CARS; window.__HILL = () => HILL; window.__TD = () => tripDest; window.__POL = () => police; window.__GAME = () => GAME; window.__HOME = () => HOME;'
  + ' renderer.setAnimationLoop = function (cb) { clearInterval(this.__iv); this.__iv = cb ? setInterval(() => { const t = performance.now(); cb(t); window.__ticks = (window.__ticks || 0) + 1; }, 30) : 0; };'
  + ' window.__thin = (n) => { if (!renderer.__rr) { renderer.__rr = renderer.render.bind(renderer); renderer.__rn = 0; renderer.render = (s, c) => { if (++renderer.__rn % renderer.__every === 0) renderer.__rr(s, c); }; } renderer.__every = Math.max(1, n | 0); }; window.__thin(300);'
  + ' window.__dstep = (n, dt = 1 / 60) => { for (let i = 0; i < n && DRIVE.on; i++) driveStep(dt); return drv && drv.telemetry(); };';
let gameJs = null;
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u.startsWith('/three/') ? path.join(three, u.slice(7)) : u.startsWith('/site/') ? path.join(docs, u.slice(6) || 'index.html') : path.join(parent, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  let body = fs.readFileSync(f);
  if (f.endsWith('.html')) body = body.toString('utf8').replaceAll('https://cdn.jsdelivr.net/npm/three@0.186.1/', '/three/');
  if (f === path.join(docs, 'game.js')) {
    if (!gameJs) { const a = 'const RACE = { on: false, frame: raceFrame };', s = body.toString('utf8'); if (s.split(a).length !== 2) throw new Error('hook anchor'); gameJs = s.replace(a, `${a} ${hook}`).replaceAll('https://cdn.jsdelivr.net/npm/three@0.186.1/', '/three/'); }
    body = gameJs;
  }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(body);
}).listen(0);
const URL0 = `http://127.0.0.1:${srv.address().port}/site/`;
const LAUNCH = { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-accelerated-2d-canvas', '--disable-gpu-compositing'] };
// 一支手機一個瀏覽器：同一個瀏覽器的兩個分頁共用一個（軟體）GPU，一支一直在畫，另一支會等好幾分鐘
const BR = {}, b = { close: () => Promise.all(Object.values(BR).map((x) => x.close())) };
const errs = [], fails = [];
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const T0 = Date.now(), el = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`;

// ---- 假的即時資料庫 ----
const DB = {};
const clone = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));
const segs = (p) => String(p).split('/').filter(Boolean);
function getAt(p, root = DB) { let o = root; for (const k of segs(p)) { if (o == null || typeof o !== 'object') return null; o = o[k]; } return o === undefined ? null : clone(o); }
function prune(o) { if (!o || typeof o !== 'object') return o; for (const k of Object.keys(o)) { const v = prune(o[k]); if (v == null || typeof v === 'object' && !Object.keys(v).length) delete o[k]; } return o; }
function putAt(root, p, v) { const s = segs(p), last = s.pop(); let o = root; for (const k of s) { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; } if (v == null) delete o[last]; else o[last] = clone(v); prune(root); }
function allowed(uid, p, v, after) { // 規則的重點（notes/world.md）
  const s = segs(p), now = Date.now();
  if (s[0] === 'garages') return s[1] === uid && s.length >= 2;
  if (s[0] === 'likes') return s.length === 3 && s[2] === uid && s[1] !== uid && (v == null || v === true);
  if (s[0] === 'world') {
    const k = s[1], who = s[2];
    if (k === 's') { if (s.length !== 3 || !/^([0-9]|1[0-5])$/.test(who)) return false; const cur = getAt(p); return (v == null || v === uid) && (cur == null || cur === uid || getAt(`world/m/${cur}`) == null); }
    if (k === 'm') {
      if (!who) return false;
      if (who !== uid) { if (v != null || s.length !== 3) return false; const pt = getAt(`world/p/${who}/t`); return pt != null ? pt < now - 120000 : getAt(`world/p/${who}`) == null && (getAt(`world/m/${who}/j`) || 0) < now - 120000; }
      const m = getAt(`world/m/${who}`, after); if (m == null) return true;
      return typeof m.n === 'string' && m.n.length >= 1 && m.n.length <= 12 && typeof m.car === 'string' && m.car.length <= 12 && /^([0-9]|1[0-5])$/.test(m.s) && typeof m.j === 'number' && getAt(`world/s/${m.s}`, after) === who;
    }
    if (k === 'p') { if (s.length !== 3) return false; if (v == null) return who === uid || getAt(`world/m/${who}`) == null; return who === uid && getAt(`world/m/${who}`) != null && typeof v.x === 'number' && typeof v.t === 'number'; }
    if (k === 'e') return s.length === 3 && who === uid && (v == null || getAt(`world/m/${uid}`) != null);
    if (k === 'bl') return s.length === 4 && who === uid && s[3] !== uid && (v == null || typeof v === 'string' && v.length <= 12);
    if (k === 'ch') {
      if (s.length === 3) return who === uid && v == null;
      if (s.length !== 4) return false;
      const to = who, from = s[3];
      if (to === uid && v == null) return true;
      if (from !== uid || from === to) return false;
      if (v == null) return true;
      return getAt(`world/m/${to}`) != null && !getAt(`world/bl/${to}/${from}`) && !getAt(`world/bl/${from}/${to}`) && getAt(`world/m/${to}/inv`) !== 0 && typeof v.id === 'string' && typeof v.kind === 'string' && typeof v.t === 'number';
    }
    return false;
  }
  if (s[0] === 'matches') {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(s[1] || '')) return false;
    const cur = getAt(`matches/${s[1]}`), nw = getAt(`matches/${s[1]}`, after);
    if (!(cur ? cur.a === uid || cur.b === uid : nw && nw.a === uid)) return false;
    if (nw == null) return true;
    if (!nw.a || !nw.b || !nw.kind || nw.a === nw.b) return false;
    return !cur || cur.a === nw.a && cur.b === nw.b;
  }
  return false;
}
const L = new Map(); let lid = 0; // 監聽：id → { ctx, path, last }
const pages = {};
function notify() {
  for (const [id, w] of L) {
    const v = getAt(w.path), j = JSON.stringify(v);
    if (j === w.last) continue;
    w.last = j;
    pages[w.ctx]?.evaluate(([i, val]) => window.__rtPush && window.__rtPush(i, val), [id, v]).catch((e) => console.log('   push failed', id, e.message.slice(0, 200)));
  }
}
function write(uid, ops) { // ops：[[路徑, 值]]（一次全部檢查，全部可以才寫）
  const after = clone(DB) || {};
  for (const [p, v] of ops) putAt(after, p, v);
  for (const [p, v] of ops) if (!allowed(uid, p, v, after)) throw new Error('PERMISSION_DENIED ' + p);
  for (const [p, v] of ops) putAt(DB, p, v);
  setTimeout(notify, 0);
  return true;
}
const DISC = {}; // 斷線的時候伺服器做的事：ctx → [[路徑, 值（物件＝update，null＝刪掉）]]
function drop(ctx) { const list = DISC[ctx] || []; DISC[ctx] = []; for (const [p, v] of list) { if (v == null) putAt(DB, p, null); else for (const [k, x] of Object.entries(v)) putAt(DB, `${p}/${k}`, x); } notify(); }

// ---- 兩支手機 ----
const FS = new Map([['players/u1', { name: '大便龍車神' }], ['players/u2', { name: '阿明快車手' }]]);
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
async function phone(key, uid, name) {
  BR[key] = await pw.chromium.launch(LAUNCH);
  const ctx = await BR[key].newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: 'block', userAgent: UA });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await ctx.exposeFunction('__cloudGet', () => null);
  await ctx.exposeFunction('__cloudPut', () => true);
  await ctx.exposeFunction('__fsGet', (p) => (FS.has(p) ? FS.get(p) : null));
  await ctx.exposeFunction('__fsSet', (p, d) => { FS.set(p, d); return true; });
  await ctx.exposeFunction('__rtGet', (p) => getAt(p));
  await ctx.exposeFunction('__rtSet', (p, v) => write(uid, [[p, v]]));
  await ctx.exposeFunction('__rtUpdate', (p, v) => write(uid, Object.entries(v).map(([k, x]) => [`${p}/${k}`, x])));
  await ctx.exposeFunction('__rtOn', (id, p) => { L.set(id, { ctx: key, path: p, last: undefined }); setTimeout(notify, 0); return id; });
  await ctx.exposeFunction('__rtOff', (k) => { L.delete(k); });
  await ctx.exposeFunction('__rtDisc', (p, v) => { (DISC[key] ||= []).push([p, v]); return true; });
  await ctx.exposeFunction('__rtDiscOff', (p) => { DISC[key] = (DISC[key] || []).filter(([q]) => q !== p); return true; });
  await ctx.addInitScript(({ uid, name }) => {
    localStorage.setItem('fake.user', JSON.stringify({ uid, email: `${uid}@example.com`, displayName: name }));
    if (!localStorage.getItem('beau.cloud')) localStorage.setItem('beau.cloud', JSON.stringify({ uid, email: `${uid}@example.com`, h: null }));
    const cbs = {}; window.__rtPush = (k, v) => { const f = cbs[k]; if (f) f(v); };
    window.__beauCloudBackend = () => {
      let cb = null; const u = { uid, email: `${uid}@example.com`, displayName: name };
      return {
        onUser(f) { cb = f; setTimeout(() => f(u), 0); },
        async popup() { cb && cb(u); }, async token() { cb && cb(u); }, async out() { cb && cb(null); },
        get: (x) => window.__cloudGet(x), put: (x, d) => window.__cloudPut(x, d),
        nameGet: async (x) => (await window.__fsGet('players/' + x))?.name || null,
        namePut: (x, n) => window.__fsSet('players/' + x, { name: n }),
        lbTop: async () => [], lbRank: async () => 1, lbGet: async () => null, lbPut: async () => true, lbName: async () => true, ghostGet: async () => null,
        rt: async () => ({
          get: (p) => window.__rtGet(p), set: (p, v) => window.__rtSet(p, v), update: (p, v) => window.__rtUpdate(p, v), remove: (p) => window.__rtSet(p, null),
          on: (p, f) => { const k = uid + ':' + Math.random().toString(36).slice(2); cbs[k] = f; window.__rtOn(k, p); return () => { delete cbs[k]; window.__rtOff(k); }; },
          disc: (p, v) => window.__rtDisc(p, v), discOff: (p) => window.__rtDiscOff(p),
          conn: (f) => { f(true); return () => {}; }, now: () => Date.now(),
        }),
      };
    };
  }, { uid, name });
  const p = await ctx.newPage();
  p.setDefaultTimeout(300000);
  p.on('pageerror', (e) => { errs.push(`${key}: ${e.message}`); console.log('pageerror', key, e.message); });
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|404|GPU stall|AudioContext|fonts\.g|net::/.test(m.text())) console.log('console', key, m.text().slice(0, 240)); });
  pages[key] = p;
  await p.goto(URL0, { waitUntil: 'domcontentloaded' });
  const prog = setInterval(() => p.evaluate(() => JSON.stringify({ st: document.getElementById('status')?.hidden, world: !!window.beauWorld, net: !!window.beauGame?.net, user: !!window.beauCloud?.user })).then((x) => console.log('   load', key, el(), x), () => {}), 20000);
  await p.waitForFunction(() => document.getElementById('status')?.hidden && window.beauWorld && window.beauGame?.net && window.beauCloud?.user, null, { timeout: 300000, polling: 100 });
  clearInterval(prog);
  return p;
}
// 兩支手機都用軟體畫（CPU 不夠）：遊戲照常跑（計時器一秒 30 次），但 300 次才真的畫 1 次；拍照、量 draw calls 前先每次都畫
const shot = async (p, file) => { await p.evaluate(() => window.__thin(1)); await p.waitForTimeout(1500); await p.screenshot({ path: file }); await p.evaluate(() => window.__thin(300)); };
const A = await phone('A', 'u1', '大便龍車神');
const B = await phone('B', 'u2', '阿明快車手');
for (const p of [A, B]) await p.evaluate(() => window.__thin(300));
console.log('loaded', el());
const waitFor = (p, fn, arg, ms = 60000) => p.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);
const dlg = (p) => p.evaluate(() => { const $ = (id) => document.getElementById(id), shown = (id) => { const e = $(id); return !!e && !e.closest('[hidden]'); };
  return { open: !$('netDlg').hidden, title: $('netTitle').textContent, sec: ['nwIn', 'nwName', 'nwMenu', 'nwBoard', 'nwWorld', 'nwRace', 'nwWait', 'nwVisit'].filter(shown).join(),
    ppl: [...$('nwPpl').children].map((li) => li.innerText.replace(/\s+/g, ' ').trim()), top: $('nwMenuTop').textContent, note: $('nwMenuNote').textContent,
    err: shown('nwWorldErr') ? $('nwWorldErr').textContent : '', msg: shown('nwWorldMsg') ? $('nwWorldMsg').textContent : '', wait: $('nwWaitTxt').textContent, waitErr: shown('nwWaitErr') ? $('nwWaitErr').textContent : '',
    visitErr: shown('nwVisitErr') ? $('nwVisitErr').textContent : '', w: window.__beauWorld.w }; });
// 這台機器軟體畫圖、一秒不到 1 格：點擊不等「穩定」（要好幾格），等條件用計時器輪詢（不用 requestAnimationFrame）
const click = (p, sel) => p.click(sel, { force: true });
const info = (p) => p.evaluate(() => window.beauGame.net.info);
// 打開連線：車庫頁按上面的「👥 連線」；在外面（標題列藏起來）按遊戲裡的「👥 n 人在線上」
const openNet = async (p) => { if (await p.evaluate(() => document.getElementById('netDlg').hidden)) await click(p, (await p.isVisible('#netChip')) ? '#netChip' : '.nt-room'); await p.waitForTimeout(200); };
const toWorld = async (p) => { await openNet(p); if (await p.isHidden('#nwWorld')) await click(p, '#nwWorldBtn'); await waitFor(p, () => !document.getElementById('nwWorld').hidden, null, 10000); };
const closeDlg = (p) => p.evaluate(() => { if (!document.getElementById('netDlg').hidden) document.getElementById('netX').click(); });
const row = (p, name) => p.evaluate((n) => [...document.querySelectorAll('#nwPpl li')].findIndex((li) => li.querySelector('.nm b')?.textContent === n) + 1, name);
const btnOf = async (p, name, label) => `#nwPpl li:nth-child(${await row(p, name)}) button[aria-label^="${label}"]`;
const card = (p) => p.evaluate(() => { const c = document.querySelector('.nt-inv'); return c && !c.hidden ? c.innerText.replace(/\s+/g, ' ') : ''; });
const matchId = () => Object.keys(getAt('matches') || {})[0] || null;
// A 找 B 比 kind（打開線上的人 → 🏁 → 選），回傳 matches 的 id
async function challenge(kind) {
  await toWorld(A); await click(A, await btnOf(A, '阿明快車手', '找'));
  await waitFor(A, () => !document.getElementById('nwRace').hidden, null, 5000);
  await click(A, `#nwRace [data-k="${kind}"]`);
  await waitFor(A, () => !document.getElementById('nwWait').hidden, null, 10000);
  return matchId();
}

// ---- 1 進入世界 ----
await openNet(A);
await waitFor(A, () => /現在有 0 個人/.test(document.getElementById('nwMenuTop').textContent), null, 5000);
let a = await dlg(A);
check(a.sec === 'nwMenu' && /進入世界/.test(await A.textContent('#nwWorldBtn')) && /現在有 0 個人在線上/.test(a.top), `menu: 「大家都在同一個世界。現在有 0 個人在線上。」+ 進入世界 (${a.top})`);
check(!(await A.$('#nwJoinBtn')) && !(await A.$('#nwCode')), 'no rooms any more (no room code, no join box)');
await click(A, '#nwWorldBtn');
await waitFor(A, () => window.__beauWorld.w && !document.getElementById('nwWorld').hidden);
a = await dlg(A);
console.log('1', el(), JSON.stringify(a));
check(a.title === '線上的人（1/6）' && /大便龍車神（你）/.test(a.ppl[0] || '') && /GC8 · 在車庫/.test(a.ppl[0] || ''), `list 1/6: you, GC8, 在車庫 (${a.ppl})`);
check(getAt('world/s/0') === 'u1' && getAt('world/m/u1/n') === '大便龍車神' && getAt('world/m/u1/inv') === 1, 'database: slot 0, member u1, invites on');
check(await A.evaluate(() => localStorage.getItem('beau.world') === '1'), 'remembered: next time the game goes in by itself');
await waitFor(A, () => true, null, 500);
check(!!getAt('garages/u1/cars/gc8') && getAt('garages/u1/n') === '大便龍車神', 'my garage is published for visits');
await shot(A, `${prefix}-1-world.png`);

// ---- 2 第二個人 ----
await openNet(B);
await waitFor(B, () => /現在有 1 個人/.test(document.getElementById('nwMenuTop').textContent), null, 5000);
check(/現在有 1 個人在線上/.test((await dlg(B)).top), 'B’s menu: 現在有 1 個人在線上');
await click(B, '#nwWorldBtn');
await waitFor(B, () => window.__beauWorld.w && document.getElementById('nwPpl').children.length === 2);
await waitFor(A, () => document.getElementById('nwPpl').children.length === 2, null, 10000);
let bb = await dlg(B); a = await dlg(A);
console.log('2', el(), JSON.stringify(bb.ppl), JSON.stringify(a.ppl));
check(bb.title === '線上的人（2/6）' && /大便龍車神 GC8 · 在車庫/.test(bb.ppl[0]) && /阿明快車手（你）/.test(bb.ppl[1]), `B sees both, in join order (${bb.ppl})`);
check(await B.evaluate(() => { const li = document.querySelector('#nwPpl li'); return ['找', '看', '封鎖'].every((l) => li.querySelector(`button[aria-label^="${l}"]`)) && !li.querySelector('button[aria-label^="去找"]'); }), 'other people have 🏁 / 🚗 / 🚫 (no 去找他 while in the garage)');
check(getAt('world/s/1') === 'u2', 'B took slot 1');
await shot(B, `${prefix}-2-list.png`);

// ---- 3 出門：一直看得到對方 ----
for (const p of [A, B]) { await closeDlg(p); await click(p, '#driveOut'); }
const outOK = await Promise.all([A, B].map((p) => waitFor(p, () => window.__D().trip && window.__D().on && window.__D().walker, null, 240000)));
check(outOK[0] && outOK[1], 'both went out on their own (no host needed)');
// Nick 2026-10-13「所有人都在車庫街有個固定位置 不管有沒有連線」：A 是世界的 1 號、B 是 2 號＝你家（大理石車庫）就蓋在車庫街 1、2 號；號碼記在存檔；在自己的車庫裡面朋友看不到（名單「在車庫」）
const home3 = await Promise.all([A, B].map((p) => p.evaluate(() => { const V = window.__D().VIL, HM = window.__HOME(), L = V.places.garage.lot, q = V.places.garst.slots[HM.slot];
  return { slot: HM.slot, in: HM.in, home: window.__GAME().home, saved: JSON.parse(localStorage.getItem('carid.tune')).home, lotOK: !!q && Math.hypot(L.x - q.lot.x, L.z - q.lot.z) < 0.01 && L.heading === q.lot.heading }; })));
const hidden3 = await A.evaluate(() => { const q = window.beauGame.net.info.peers[0]; return !!q && !q.vis; });
console.log('   homes', JSON.stringify(home3), hidden3, getAt('world/m/u2/w'));
check(home3[0].slot === 0 && home3[1].slot === 1 && home3[0].in && home3[1].in && home3[0].lotOK && home3[1].lotOK && hidden3 && getAt('world/m/u2/w') === '在車庫', `each starts inside their own garage, built on garage street #1 (A) and #2 (B); A can’t see B while B is inside (B: 「${getAt('world/m/u2/w')}」)`);
check(home3[0].home === 0 && home3[0].saved === 0 && home3[1].home === 1 && home3[1].saved === 1, 'the world number is kept as your home in the save (A 1, B 2)');
const walked3 = []; // 站在鐵捲門裡面、往外走（一步一步走：走出去就停）
for (const p of [A, B]) walked3.push(await p.evaluate(() => { const D = window.__D(), G = D.GAR, W = D.walker, HM = window.__HOME(); G.door.open(0.1); for (let i = 0; i < 20; i++) window.__dstep(1);
  W.teleport(G.toWorld({ x: G.zones.door.x - 2, z: 0, heading: 0 })); window.__dstep(2); let n = 0;
  const dd = () => { const t = W.telemetry(), d = D.VIL.places.garage.door; return Math.hypot(t.x - d.x, t.z - d.z); };
  for (; n < 600 && (HM.in || dd() < 2.5); n++) { const t = W.telemetry(); const a = D.VIL.places.garage.lot.heading; W.setInput({ x: -Math.sin(a - t.camYaw) * 0.8, y: Math.cos(a - t.camYaw) * 0.8 }); window.__dstep(1); } // 走出門外 2.5 公尺
  W.setInput(null); window.__dstep(3); return !HM.in; }));
const at3 = await Promise.all([A, B].map((p) => p.evaluate(() => { const t = window.__D().walker.telemetry(), d = window.__D().VIL.places.garage.door; return +Math.hypot(t.x - d.x, t.z - d.z).toFixed(1); })));
console.log('   out the door', JSON.stringify(walked3), JSON.stringify(at3));
const act3 = await A.evaluate(() => { window.__dstep(2); const W = window.__D().walker, t = W.telemetry(), HM = window.__HOME(), d = window.__D().VIL.places.garage.door; return { act: W.action, door: window.__D().GAR.door.t, in: HM.in, d: +Math.hypot(t.x - d.x, t.z - d.z).toFixed(1) }; });
check(act3.act == null && act3.door === 1 && !act3.in, `just outside your open roller door: no 「進車庫」 any more, nothing to press (${JSON.stringify(act3)})`);
check(walked3[0] && walked3[1] && at3[0] < 4 && at3[1] < 4, `walked straight out of the roller door → standing in front of their own garage on the garage street (${at3} m from the door)`);
const seeB = await waitFor(A, () => { const i = window.beauGame.net.info; return i.peers[0] && i.peers[0].vis && i.peers[0].walk && i.marks === 1; }, null, 60000);
const seeA = await waitFor(B, () => { const i = window.beauGame.net.info; return i.peers[0] && i.peers[0].vis && i.peers[0].walk; }, null, 60000);
console.log('3', el(), seeB, seeA, JSON.stringify(await info(A)));
check(seeB && seeA, 'each sees the other walking (character + name tag) and a minimap dot');
const hud3 = await A.evaluate(() => { const r = document.querySelector('.nt'); return r && !r.hidden ? r.innerText.replace(/\s+/g, ' ') : null; });
check(/👥 2 人在線上/.test(hud3 || ''), `game box: ${hud3}`);
await waitFor(A, () => true, null, 3500);
check(getAt('world/m/u2/w') && getAt('world/m/u2/w') !== '在車庫', `the list shows where B is now (${getAt('world/m/u2/w')})`);
const w0 = await A.evaluate(() => ({ ...window.__NET().P.get('u2').mk }));
await B.evaluate(() => window.__D().walker.setInput({ y: 1 })); await B.waitForTimeout(3000); // 往外走（後面是自己的車庫，門開著） await B.evaluate(() => window.__D().walker.setInput(null));
await A.waitForTimeout(800);
const w1 = await A.evaluate(() => ({ ...window.__NET().P.get('u2').mk }));
check(Math.hypot(w1.x - w0.x, w1.z - w0.z) > 1, `B walked → A sees B move (${Math.hypot(w1.x - w0.x, w1.z - w0.z).toFixed(1)} m)`);
// 去找他：點遊戲裡的「👥 2 人在線上」→ 線上的人 → 去找他
await click(A, '.nt-room');
await waitFor(A, () => !document.getElementById('nwWorld').hidden, null, 5000);
check((await dlg(A)).sec === 'nwWorld', 'tapping 「👥 2 人在線上」 in the game opens the list');
await A.evaluate(() => { const m = window.__NET().P.get('u2').mk; window.__D().walker.teleport({ x: m.x, z: m.z + 45, heading: 0 }); }); // 兩個人都從自己的車庫出來（同一個地方）：A 先走遠一點
await click(A, await btnOf(A, '阿明快車手', '去找'));
await A.waitForTimeout(300);
const go3 = await A.evaluate(() => ({ td: window.__TD(), goal: window.__NET().goal, dlg: !document.getElementById('netDlg').hidden, f: window.__D().VIL.places.friend }));
console.log('  find', JSON.stringify(go3));
check(go3.td === 'friend' && go3.goal === 'u2' && !go3.dlg && go3.f?.name === '阿明快車手', '去找他: destination = B (follows B), dialog closed');
await A.evaluate(() => { const D = window.__D(), m = window.__NET().P.get('u2').mk, w = D.walker; w.teleport ? w.teleport({ x: m.x + 3, z: m.z, heading: 0 }) : null; });
const found = await waitFor(A, () => window.__NET().goal === null && window.__TD() !== 'friend', null, 8000);
check(found, 'walked next to B → 「找到阿明快車手了！」, destination cleared');
await shot(A, `${prefix}-3-together.png`);

// ---- 4 表情 ----
await click(A, '.nt-emo');
await click(A, '.nt-tray button:nth-child(3)');
const emoB = await waitFor(B, () => /大便龍車神：好車！/.test(document.querySelector('.nt-room')?.textContent || ''), null, 8000);
const bub = await B.evaluate(() => { const P = window.__NET().P.get('u1'); return !!P.bub && P.bub.visible; });
check(emoB && bub && getAt('world/e/u1/e') === 2, 'B sees 「大便龍車神：好車！」 and a bubble over A');

// ---- 5 找人比賽：爬山 ----
const id5 = await challenge('hill');
a = await dlg(A);
check(a.title === '🏁 找人比賽' && /等阿明快車手回答⋯（爬山）/.test(a.wait), `A waits: ${a.wait}`);
check(getAt(`matches/${id5}/a`) === 'u1' && getAt(`matches/${id5}/ok`) === 0 && getAt(`world/ch/u2/u1/id`) === id5, 'database: a match (waiting) and an invite for B');
await waitFor(B, () => !document.querySelector('.nt-inv')?.hidden, null, 8000);
const c5 = await card(B);
check(/🏁 大便龍車神找你比爬山計時賽！/.test(c5) && /他開 GC8/.test(c5) && /好/.test(c5) && /不要/.test(c5), `B gets the invite card: ${c5}`);
await shot(B, `${prefix}-5-invite.png`);
await click(B, '.nt-inv .a');
const prep = await Promise.all([A, B].map((p) => waitFor(p, () => { const r = window.beauGame.net.info.race; return r && r.kind === 'hill' && (r.phase === 'wait' || r.phase === 'run'); }, null, 120000)));
check(prep[0] && prep[1] && await A.evaluate(() => document.getElementById('netDlg').hidden), 'B said 好: both seated at the hill start, A’s dialog closed');
check(getAt(`matches/${id5}/ok`) === 1 && getAt('world/ch/u2/u1') == null && getAt(`matches/${id5}/seq`) > 0, 'database: ok 1, invite gone, seq set');
const pos5 = await Promise.all([A, B].map((p) => p.evaluate(() => { const t = window.__D().drv.telemetry(); return { x: t.x, z: t.z }; })));
check(Math.hypot(pos5[0].x - pos5[1].x, pos5[0].z - pos5[1].z) > 2.5, `different start spots (${Math.hypot(pos5[0].x - pos5[1].x, pos5[0].z - pos5[1].z).toFixed(1)} m apart)`);
await waitFor(A, () => window.beauGame.net.info.race?.go > 0, null, 40000);
const go5 = await A.evaluate(() => window.beauGame.net.info.race.go);
await A.evaluate(() => window.__D().drv.setInput({ throttle: 1, brake: 0, steer: 0 }));
await A.waitForTimeout(800);
const held = await A.evaluate(() => Math.abs(window.__D().drv.telemetry().v));
check(held < 0.5, `before the start the car stays put even with throttle (${held.toFixed(2)} m/s)`);
await A.evaluate(() => window.__D().drv.setInput(null));
const runAt = await Promise.all([A, B].map((p) => waitFor(p, () => window.beauGame.net.info.race?.phase === 'run', null, 60000).then(() => p.evaluate(() => { const r = window.beauGame.net.info.race; return { at: r.runAt, gap: r.runGap }; }))));
const goGap = runAt.map((r) => r.at - go5);
check(runAt.every((r, i) => goGap[i] >= 0 && goGap[i] <= r.gap + 50), `both started on the first frame after the agreed time (start − go: ${goGap.join(' / ')} ms; frame ${runAt.map((r) => r.gap).join(' / ')} ms)`);
const hill = await A.evaluate(async () => {
  const D = window.__D(), d = D.drv, M = D.VIL.mountain;
  d.setInput({ throttle: 0.7, brake: 0, steer: 0 });
  for (let i = 0; i < 30 && !window.__HILL().on; i++) { window.__dstep(10); await new Promise((r) => setTimeout(r, 0)); }
  const on = window.__HILL().on, R = M.road; let i = 0; while (i < R.n - 1 && R.s[i] < M.trial.s1 - 9) i++;
  d.teleport({ x: R.x[i], z: R.z[i], heading: Math.atan2(-R.tz[i], R.tx[i]) });
  for (let k = 0; k < 40 && window.beauGame.net.info.race.myT == null; k++) { window.__dstep(10); await new Promise((r) => setTimeout(r, 0)); }
  d.setInput(null);
  return { on, myT: window.beauGame.net.info.race.myT };
});
check(hill.on && hill.myT > 0, `A drove through the start gate and up to the finish: ${hill.myT} s`);
check(getAt(`matches/${id5}/r/${getAt(`matches/${id5}/seq`)}/u1/t`) === hill.myT, 'A’s time is in the database');
await waitFor(B, () => !document.querySelector('.nt-quit')?.hidden, null, 5000);
await click(B, '.nt-quit');
const res5 = await Promise.all([A, B].map((p) => waitFor(p, () => { const r = document.querySelector('.nt-res'); return r && !r.hidden && /沒跑完/.test(r.innerText) && /:\d\d\.\d\d/.test(r.innerText); }, null, 10000).then(async (ok) => ({ ok, txt: await p.evaluate(() => document.querySelector('.nt-res').innerText.replace(/\s+/g, ' ')) }))));
console.log('5', el(), JSON.stringify(res5));
check(res5[0].ok && res5[1].ok && /^爬山計時賽：第 1 名 1 大便龍車神（你）/.test(res5[0].txt) && /1 大便龍車神/.test(res5[1].txt), 'both phones: A first with a time, B 沒跑完');
check(/再比一次/.test(res5[0].txt) && /等對方按再比一次/.test(res5[1].txt), 'only the one who asked can press 再比一次');
await shot(A, `${prefix}-5-hill-results.png`);

// ---- 6 再比一次、回去開車 ----
const seq5 = getAt(`matches/${id5}/seq`);
await click(A, '.nt-res .a');
const again = await waitFor(B, (s) => window.beauGame.net.info.race?.seq > s && window.beauGame.net.info.race.kind === 'hill', seq5, 30000);
check(again && getAt(`matches/${id5}/seq`) > seq5, '再比一次: a new hill race for both');
for (const p of [A, B]) { await waitFor(p, () => { const r = window.beauGame.net.info.race; return r && (r.phase === 'wait' || r.phase === 'run') && !document.querySelector('.nt-quit').hidden; }, null, 90000); await click(p, '.nt-quit'); }
for (const p of [A, B]) { await waitFor(p, () => !document.querySelector('.nt-res')?.hidden, null, 10000); await click(p, '.nt-res .b'); }
await waitFor(A, () => !window.beauGame.net.info.race, null, 10000);
await A.waitForTimeout(400);
check(getAt('matches') == null && !(await info(A)).race && !(await info(B)).race, '回去開車: the match is gone, both drive on');

// ---- 7 不要；400 公尺 ----
const id7 = await challenge('drag');
await waitFor(B, () => !document.querySelector('.nt-inv')?.hidden, null, 8000);
await click(B, '.nt-inv .b');
await waitFor(A, () => !document.getElementById('nwWaitErr').hidden, null, 8000);
a = await dlg(A);
check(/阿明快車手說「不要」/.test(a.waitErr) && getAt(`matches/${id7}`) == null && getAt('world/ch/u2/u1') == null, `B said 不要 → A sees 「${a.waitErr}」, nothing left in the database`);
await click(A, '#nwWaitX');
const id7b = await challenge('drag');
await waitFor(B, () => !document.querySelector('.nt-inv')?.hidden, null, 8000);
await click(B, '.nt-inv .a');
const inDrag = await Promise.all([A, B].map((p) => waitFor(p, () => { const r = window.__R(); return r && r.net && window.beauGame.net.info.race?.kind === 'drag' && window.beauGame.net.info.race.phase === 'wait'; }, null, 120000)));
check(inDrag[0] && inDrag[1], 'asked again for 400 m → 好: both on the drag strip, no AI opponent');
for (const p of [A, B]) await p.evaluate(() => { // 機器人：綠燈 0.2 秒後起步、轉速到了換檔
  const press = (id) => document.getElementById(id).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  const tick = () => { const r = window.__R(); if (!r || !r.net) return; if (r.phase === 'run' && r.me.fin == null) { const c = r.me; if (c.go == null) { if (r.t - r.green > 0.2) press('goBtn'); } else if (c.rpm >= 0.93 && c.shiftT <= 0 && c.gear < 5) press('goBtn'); } };
  setInterval(tick, 30);
});
const greens = await Promise.all([A, B].map((p) => p.waitForFunction(() => { const r = window.__R(); return r && r.greenNow ? { d: r.greenNow - r.net.go, gap: r.gapMs } : false; }, null, { timeout: 90000, polling: 100 }).then((h) => h.jsonValue())));
check(greens.every((g) => g.d >= 0 && g.d <= g.gap + 50), `green light on the first frame after the agreed time on both phones (${greens.map((g) => g.d).join(' / ')} ms)`);
await A.waitForFunction(() => window.__R()?.me.x > 120, null, { timeout: 60000, polling: 100 });
const mid = await A.evaluate(() => { const r = window.__R(), o = r.nOpp[0]; return { me: r.me.x, opp: o.x, vis: !!o.obj && o.obj.car.visible, z: o.obj?.car.position.z }; });
console.log('   drag mid: B own x', await B.evaluate(() => { const r = window.__R(); return r && [r.me.x.toFixed(1), r.phase, r.me.go != null]; }), 'A sees', mid.opp.toFixed(1));
check(mid.vis && mid.opp > 50 && mid.z < 0, `B’s car runs in the other lane on A’s screen (B at ${mid.opp.toFixed(0)} m, A at ${mid.me.toFixed(0)} m)`);
const res7 = await Promise.all([A, B].map((p) => waitFor(p, () => { const r = document.querySelector('.nt-res'); return r && !r.hidden && (r.innerText.match(/\d+\.\d\d 秒/g) || []).length === 2; }, null, 90000).then(async (ok) => ({ ok, txt: await p.evaluate(() => document.querySelector('.nt-res').innerText.replace(/\s+/g, ' ')) }))));
const rows = (t) => (t.match(/\d (大便龍車神|阿明快車手)(（你）)? (\d+\.\d\d) 秒/g) || []).map((s) => s.replace('（你）', ''));
console.log('7', el(), JSON.stringify(res7));
check(res7[0].ok && res7[1].ok && JSON.stringify(rows(res7[0].txt)) === JSON.stringify(rows(res7[1].txt)) && rows(res7[0].txt).length === 2, `both finished: same places and times on both phones (${rows(res7[0].txt)})`);
await shot(B, `${prefix}-7-drag-results.png`);
await click(A, '.nt-res .b');
const left7 = await waitFor(B, () => /對方離開了/.test(document.querySelector('.nt-res .a')?.textContent || ''), null, 10000);
check(left7 && getAt(`matches/${id7b}`) == null, 'A pressed 回去開車 first → B’s card says 「對方離開了」');
await click(B, '.nt-res .b');
const back7 = await Promise.all([A, B].map((p) => waitFor(p, () => window.__D().on && window.__D().drv && !window.__R() && !window.beauGame.net.info.race, null, 30000)));
check(back7[0] && back7[1], 'both driving again next to the drag strip');
for (const p of [A, B]) await closeDlg(p);
const seeCar = await waitFor(A, () => { const i = window.beauGame.net.info; return i.peers[0]?.vis && i.peers[0].car && i.cols === 1; }, null, 30000);
await A.evaluate(() => window.__thin(1)); await A.waitForTimeout(1500);
const perf = await A.evaluate(() => { const r = window.__rinfo(); return { ...r }; });
console.log('   perf', JSON.stringify(perf));
check(seeCar, 'A sees B’s car (name tag, shadow, collider)');
check(perf.calls < 400, `draw calls with a friend’s car in view: ${perf.calls} calls, ${(perf.tris / 1e6).toFixed(2)} M triangles`);
// Nick 2026-10-11「改車別人只看得到原樣」：在世界裡改車（換顏色），朋友看到的車也跟著換
const repaint = await B.evaluate(() => { const C = window.__CARS()[window.__D().cur], old = C.state.paint, p = C.paints.map((x) => x[0]).find((x) => x !== old); C.state.paint = p; return { old, p }; });
const seenPaint = await waitFor(A, (p) => window.beauGame.net.info.peers[0]?.paint === p, repaint.p, 20000);
console.log('   repaint', JSON.stringify(repaint), JSON.stringify(await A.evaluate(() => window.beauGame.net.info.peers[0])));
check(seenPaint, `B repaints the car while in the world (${repaint.old} → ${repaint.p}): A sees B’s car in the new colour`);
await B.evaluate((o) => { window.__CARS()[window.__D().cur].state.paint = o; }, repaint.old);
await A.evaluate(() => window.__thin(300));
// Nick 2026-10-11「別人被警察抓我看不到」：B 被警察追 → A 看到 B 的名字旁邊兩顆星、追 B 的警車（紅藍燈）；B 被抓 → A 跳「🚓 阿明快車手被警察抓走了！」、名單「在拘留室 10:00」
await B.evaluate(() => { const t = window.__D().drv.telemetry(); window.__POL().crime('hit', { x: t.x, z: t.z }); });
const chased = await waitFor(A, () => { const i = window.beauGame.net.info, q = i.peers[0]; return q && q.w === 2 && q.tagW === 2 && i.pol >= 1; }, null, 120000);
const ch7 = await A.evaluate(() => { const i = window.beauGame.net.info; return { pol: i.pol, peer: i.peers[0] }; });
const bPol = await B.evaluate(() => window.__POL().telemetry().cars.map((c) => [c.x, c.z]));
console.log('   chased', chased, JSON.stringify(ch7), JSON.stringify(bPol), JSON.stringify(getAt('world/p/u2')));
check(chased, `B is wanted (2★): A sees ★★ next to B’s name and ${ch7.pol} police car(s) chasing B`);
await shot(A, `${prefix}-7-chased.png`);
await B.evaluate(() => window.__POL().surrender());
const jail7 = await waitFor(B, () => window.__POL().state === 'jail', null, 30000);
const toast7 = await waitFor(A, () => /🚓 阿明快車手被警察抓走了！/.test(document.querySelector('#stage .dv-toast')?.textContent || ''), null, 15000);
const list7 = await waitFor(A, () => /^在拘留室 (10:00|9:[0-5]0)$/.test(window.__beauWorld.w.mem.find((m) => m.uid === 'u2')?.w || ''), null, 15000);
const gone7 = await waitFor(A, () => { const i = window.beauGame.net.info; return i.pol === 0 && i.peers[0].tagW === 0; }, null, 15000);
console.log('   jailed', jail7, toast7, list7, gone7, getAt('world/m/u2/w'));
check(jail7 && toast7 && gone7, 'B is caught: A gets 「🚓 阿明快車手被警察抓走了！」, the stars and police cars go away');
check(list7, `A’s list says where B is: 「${getAt('world/m/u2/w')}」`);
const paid7 = await B.evaluate(() => { window.__GAME().money = Math.max(window.__GAME().money, 10); return window.__POL().payFine(); }); // 罰款 2★＝4 萬
console.log('   paid', paid7);
const out7 = await waitFor(B, () => window.__POL().state === 'free' && window.__D().walker && window.__D().walker.mode === 'walk', null, 30000);
console.log('   out', out7, JSON.stringify(await B.evaluate(() => { const D = window.__D(), w = D.walker; return { st: window.__POL().state, mode: w && w.mode, indoor: !!D.indoor, paused: w && w.telemetry().paused, jl: window.__POL().telemetry().jail }; })));
check(out7, 'B paid the fine and is out again');

// ---- 8 封鎖、關掉邀請、沒回答 ----
await toWorld(A);
await click(A, await btnOf(A, '阿明快車手', '封鎖'));
const blk = await Promise.all([waitFor(A, () => window.beauGame.net.info.peers.length === 0, null, 10000), waitFor(B, () => window.beauGame.net.info.peers.length === 0, null, 10000)]);
a = await dlg(A);
const bList = await B.evaluate(() => window.__beauWorld.w.mem.map((m) => m.n));
console.log('8', el(), JSON.stringify(a), JSON.stringify(bList));
check(blk[0] && blk[1] && a.ppl.length === 1 && bList.length === 1 && getAt('world/bl/u1/u2') === '阿明快車手', `🚫 block: neither sees the other (A list ${a.ppl.length}, B list ${bList.length})`);
check(/封鎖了阿明快車手/.test(a.msg) && /封鎖的人（1）/.test(await A.textContent('#nwBlkSum')), `A: 「${a.msg}」 + 封鎖的人（1）`);
let denied = null; try { write('u2', [['world/ch/u1/u2', { kind: 'drag', t: Date.now(), id: 'x-1' }]]); } catch (e) { denied = e.message; }
check(/PERMISSION/.test(denied || ''), 'a blocked person can’t send an invite (rules)');
await A.evaluate(() => { document.getElementById('nwBlk').open = true; });
await click(A, '#nwBlkList li button');
const unb = await waitFor(A, () => window.beauGame.net.info.peers.length === 1 && document.getElementById('nwPpl').children.length === 2, null, 10000);
check(unb && getAt('world/bl/u1') == null, '解除封鎖: they see each other again');
await toWorld(B); await click(B, '#nwInvTog');
await B.waitForTimeout(300);
check(getAt('world/m/u2/inv') === 0 && (await B.textContent('#nwInvTog')) === '關', 'B turned invites off (別人找我比賽：關)');
await closeDlg(B);
await toWorld(A); await click(A, await btnOf(A, '阿明快車手', '找'));
await click(A, '#nwRace [data-k="hill"]');
await waitFor(A, () => !document.getElementById('nwWorldErr').hidden, null, 5000);
check(/阿明快車手關掉了比賽邀請/.test((await dlg(A)).err) && getAt('matches') == null, 'A can’t ask: 「阿明快車手關掉了比賽邀請。」');
await toWorld(B); await click(B, '#nwInvTog'); await B.waitForTimeout(300); await closeDlg(B);
check(getAt('world/m/u2/inv') === 1, 'B turned invites back on');
await challenge('circuit');
await waitFor(B, () => !document.querySelector('.nt-inv')?.hidden, null, 8000);
const gone8 = await waitFor(A, () => !document.getElementById('nwWaitErr').hidden, null, 25000);
check(gone8 && /說「不要」/.test((await dlg(A)).waitErr) && await B.evaluate(() => document.querySelector('.nt-inv').hidden) && getAt('matches') == null, 'nobody answered: the card goes away after 15 s and counts as 不要');
await click(A, '#nwWaitX'); await closeDlg(A);

// ---- 9 車庫街：名牌、走到門口「看他的車庫」 ----
const st9 = await info(A);
check(JSON.stringify(st9.gst) === JSON.stringify(['大便龍車神', '阿明快車手', null, null, null, null]), `garage street signs: each person on their world number: #1 A (you), #2 B, the rest empty (${st9.gst})`);
const door9 = await A.evaluate(() => { const q = window.__D().VIL.places.garst.slots[1]; window.__D().drv.teleport({ x: q.door.x + 1.5, z: q.door.z, heading: 0 }); window.__D().drv.setInput({ throttle: 0, brake: 1, steer: 0 }); return q.door; });
const near9 = await waitFor(A, () => { const b = document.querySelector('.nt-gar'); return b && !b.hidden && getComputedStyle(b).display !== 'none'; }, null, 15000);
const btn9 = await A.evaluate(() => document.querySelector('.nt-gar').textContent);
console.log('9', el(), JSON.stringify(door9), btn9);
check(near9 && btn9 === '🚗 看阿明快車手的車庫', `stopped at B’s garage on the garage street: 「${btn9}」`);
await A.evaluate(() => window.__D().drv.setInput(null));
await shot(A, `${prefix}-9-garage-street.png`);
await click(A, '.nt-gar');
const vis9 = await waitFor(A, () => window.beauGame.visiting?.loaded && document.querySelector('.nv'), null, 180000);
const t9 = await A.evaluate(() => document.querySelector('.nv-top h3')?.textContent);
check(vis9 && t9 === '阿明快車手的車庫' && await A.evaluate(() => !window.__D().trip), `tap → back to the garage page and visiting: ${t9}`);
await click(A, '.nv-x');

// ---- 10 參觀車庫 ----
await B.evaluate(() => document.getElementById('driveHome').click());
await waitFor(B, () => !window.__D().trip && document.getElementById('status').hidden, null, 30000);
await waitFor(A, () => !window.beauGame.net.info.peers[0].vis, null, 10000);
await toWorld(A);
await waitFor(A, () => /阿明快車手 GC8 · 在車庫/.test(document.getElementById('nwPpl').innerText.replace(/\s+/g, ' ')), null, 10000);
a = await dlg(A);
check(a.ppl.some((t) => /阿明快車手 GC8 · 在車庫/.test(t)) && await A.evaluate(() => ![...document.querySelectorAll('#nwPpl button')].some((b) => /去找阿明/.test(b.title))), `B went home: A’s list says 在車庫 (no 去找他) (${a.ppl})`);
await closeDlg(A);
await toWorld(B);
await click(B, await btnOf(B, '大便龍車神', '看'));
const vis = await waitFor(B, () => window.beauGame.visiting?.loaded && document.querySelector('.nv'), null, 120000);
const v9 = await B.evaluate(() => ({ title: document.querySelector('.nv-top h3').textContent, info: document.querySelector('.nv-info').innerText.replace(/\s+/g, ' ') }));
check(vis && v9.title === '大便龍車神的車庫' && /GC8/.test(v9.info), `B visits A’s garage from the list: ${v9.title} · ${v9.info}`);
await click(B, '.nv-like');
await waitFor(B, () => /♥ 1/.test(document.querySelector('.nv-heart').textContent), null, 5000);
check(getAt('likes/u1/u2') === true, 'like → ♥ 1');
await click(B, '.nv-like'); await waitFor(B, () => /♥ 0/.test(document.querySelector('.nv-heart').textContent), null, 5000);
await click(B, '.nv-x');
check(!(await B.evaluate(() => !!document.querySelector('.nv'))), 'closed the visit');

// ---- 11 離開、斷線、滿了、自己進去 ----
await toWorld(B); await click(B, '#nwLeaveW');
await waitFor(A, () => window.beauGame.net.info.peers.length === 0, null, 10000);
check(getAt('world/m/u2') == null && getAt('world/s/1') == null && await B.evaluate(() => !window.__beauWorld.w && localStorage.getItem('beau.world') == null), '離開世界: slot freed, A no longer sees B, B won’t go back in by itself');
await openNet(B); await click(B, '#nwWorldBtn');
await waitFor(B, () => window.__beauWorld.w, null, 10000);
await waitFor(A, () => window.beauGame.net.info.peers.length === 1, null, 10000);
drop('B');
const blip = await waitFor(A, () => window.__beauWorld.w.mem.length === 2, null, 15000);
check(blip && getAt('world/m/u2') != null, 'B’s connection dropped (server took B out) → B’s phone went back in by itself');
await B.evaluate(() => window.beauWorld.leave());
await waitFor(A, () => window.__beauWorld.w.mem.length === 1, null, 10000);
for (let n = 1; n < 6; n++) { putAt(DB, `world/s/${n}`, `x${n}`); putAt(DB, `world/m/x${n}`, { n: `朋友${n}`, car: 'gc8', s: String(n), j: Date.now(), w: '在路上', inv: 1 }); putAt(DB, `world/p/x${n}`, { t: Date.now(), x: 0, z: 0, h: 0, v: 0, o: 0 }); }
notify();
await openNet(B); await click(B, '#nwWorldBtn');
await waitFor(B, () => /世界滿了/.test(document.getElementById('nwMenuNote').textContent), null, 10000);
check(/世界滿了（最多 6 個人）/.test(await B.textContent('#nwMenuNote')) && !(await B.evaluate(() => window.__beauWorld.w)), '7th person: 「世界滿了（最多 6 個人），等一下再來。」');
check((await dlg(A)).title === '線上的人（6/6）' || await A.evaluate(() => window.__beauWorld.w.mem.length === 6), 'A sees 6/6');
for (let n = 1; n < 6; n++) putAt(DB, `world/p/x${n}/t`, Date.now() - 200000);
notify();
const cleaned = await waitFor(A, () => window.__beauWorld.w.mem.length === 1, null, 45000);
check(cleaned && Object.keys(getAt('world/s') || {}).length === 1, 'people who disconnected without cleaning up (no position for minutes) get cleared');
await openNet(B); await click(B, '#nwWorldBtn');
await waitFor(B, () => window.__beauWorld.w, null, 10000);
await B.reload({ waitUntil: 'domcontentloaded' });
await B.waitForFunction(() => document.getElementById('status')?.hidden && window.beauWorld && window.beauGame?.net && window.beauCloud?.user, null, { timeout: 300000, polling: 100 });
const auto = await waitFor(B, () => window.__beauWorld.w && window.__beauWorld.w.mem.length === 2, null, 30000);
check(auto && await B.evaluate(() => document.getElementById('netDlg').hidden), 'reopened the game → back in the world by itself (no dialog)');

check(errs.length === 0, `no page errors (${errs.length}) ${errs.slice(0, 3).join(' | ')}`);
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' / ')}` : 'ALL CHECKS OK', el());
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
