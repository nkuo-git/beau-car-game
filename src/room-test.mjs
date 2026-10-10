// 連線第 2–4 步：房間、一起開車、一起比賽、參觀車庫（site/room.js＋net.src.js）：node room-test.mjs [docs 資料夾，預設 ../docs/try] [截圖 prefix，預設 ../out/room/room]
//   兩支「手機」＝兩個瀏覽器 context（各自的存檔、登入：u1 大便龍車神（房主）、u2 阿明快車手）
//   即時資料庫是假的：放在 Node 這邊（路徑 → 值；監聽、斷線自動做的事、規則的重點：房主才能改房間、4 個位子、只能寫自己的）
//   1 開房間：4 個字的房間碼、在房間裡的人 1/4（你，房主）；車庫放上去了（garages/u1）
//   2 加入：打錯的碼「找不到」；對的（小寫也可以）→ 2/4，兩邊名單一樣
//   3 一起出門：房主按 → 兩支都出門；看得到對方（走路的人、頭上有名字）、小地圖上有點
//   4 表情：按 💬 → 好車！→ 對方房間那一塊寫出來、頭上泡泡
//   5 爬山：兩個人放在起點門前面（不同格）、等大家 → 倒數 → 出發前踩不動；A 開到山頂（成績）、B 放棄 → 兩邊成績一樣
//   6 再來一場、換 400 公尺：兩支同時綠燈、跑完 → 兩邊名次、秒數一樣；隔壁車道是朋友的車
//   7 回房間：兩台車都在起跑區外面，看得到對方的車（有碰撞）；draw calls
//   8 參觀車庫：在外面不能參觀；回車庫頁 → 朋友的車庫、讚（雲端 likes）、收回去；自己的車回來
//   9 離開、斷線、滿了、房主關掉房間
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
const three = path.join(dir, '../node_modules/three');
const [docsArg, prefix = path.join(dir, '../out/room/room')] = process.argv.slice(2);
const docs = path.resolve(docsArg || path.join(dir, '../docs/try'));
const parent = path.dirname(docs);
fs.mkdirSync(path.dirname(prefix), { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const hook = 'window.__R = () => race; window.__D = () => ({ on: DRIVE.on, drv, walker, trip, VIL, cur, indoor });'
  + ' window.__rinfo = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });'
  + ' window.__NET = () => NET; window.__HILL = () => HILL;'
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
const LAUNCH = { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] };
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
function allowed(uid, p, v, after) { // 規則的重點（notes/room.md）
  const s = segs(p);
  if (s[0] === 'garages') return s[1] === uid && s.length >= 2;
  if (s[0] === 'likes') return s.length === 3 && s[2] === uid && s[1] !== uid && (v == null || v === true);
  if (s[0] !== 'rooms' || !/^[2-9A-HJKMNP-Z]{4}$/.test(s[1] || '')) return false;
  const room = getAt(`rooms/${s[1]}`), host = room && room.host;
  if (s.length === 2) return !room || host === uid;
  if (host === uid && ['host', 'at', 'race'].includes(s[2])) return true;
  if (s[2] === 's') { if (!room || s.length !== 4 || !/^[0-3]$/.test(s[3])) return false; const cur = room.s && room.s[s[3]]; return host === uid || (!cur && v === uid) || (cur === uid && v == null); }
  if (s[2] === 'm') { if (!room || s[3] !== uid && host !== uid) return false; if (v == null && s.length === 4) return true; const m = getAt(`rooms/${s[1]}/m/${s[3]}`, after); return !!m && typeof m.n === 'string' && typeof m.car === 'string' && /^[0-3]$/.test(m.s) && getAt(`rooms/${s[1]}/s/${m.s}`, after) === s[3]; }
  if (['p', 'e'].includes(s[2])) return s[3] === uid && !!(room.m && room.m[uid]);
  if (s[2] === 'r') return s[4] === uid && !!(room.m && room.m[uid]);
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
    window.__roomWatch = false;
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
  const prog = setInterval(() => p.evaluate(() => JSON.stringify({ st: document.getElementById('status')?.hidden, room: !!window.beauRoom, net: !!window.beauGame?.net, user: !!window.beauCloud?.user })).then((x) => console.log('   load', key, el(), x), () => {}), 20000);
  await p.waitForFunction(() => document.getElementById('status')?.hidden && window.beauRoom && window.beauGame?.net && window.beauCloud?.user, null, { timeout: 300000, polling: 100 });
  clearInterval(prog);
  return p;
}
// 兩支手機都用軟體畫（CPU 不夠）：遊戲照常跑（計時器一秒 30 次），但 300 次才真的畫 1 次；拍照、量 draw calls 前先每次都畫
const shot = async (p, file) => { await p.evaluate(() => window.__thin(1)); await p.waitForTimeout(1500); await p.screenshot({ path: file }); await p.evaluate(() => window.__thin(300)); };
const A = await phone('A', 'u1', '大便龍車神');
if (process.env.PROBE) { // 只看一支手機的速度
  await A.evaluate(() => window.__thin(+localStorage.getItem('x') || 20));
  const f0 = await A.evaluate(() => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else ok(n / 3); }; requestAnimationFrame(f); }));
  await A.click('#driveOut'); await A.waitForFunction(() => window.__D().on && window.__D().walker, null, { timeout: 120000, polling: 100 }); await A.waitForTimeout(3000);
  for (const n of [20, 1]) {
    await A.evaluate((n) => window.__thin(n), n);
    const fp = await A.evaluate(() => new Promise((ok) => { const k0 = window.__ticks, t0 = performance.now(), w0 = window.__D().walker.telemetry(); window.__D().walker.setInput({ y: -1 }); setTimeout(() => { const w1 = window.__D().walker.telemetry(); window.__D().walker.setInput(null); ok([(window.__ticks - k0) / ((performance.now() - t0) / 1000), Math.hypot(w1.x - w0.x, w1.z - w0.z) / ((performance.now() - t0) / 1000)]); }, 4000); }));
    const st = await A.evaluate(() => { const t0 = performance.now(); window.__dstep(10); return (performance.now() - t0) / 10; });
    console.log('probe thin', n, 'garage fps', f0, 'out fps', fp, 'driveStep ms', st.toFixed(1), JSON.stringify(await A.evaluate(() => window.__rinfo())));
  }
  await b.close(); srv.close(); process.exit(0);
}
const B = await phone('B', 'u2', '阿明快車手');
for (const p of [A, B]) await p.evaluate(() => window.__thin(300));
console.log('loaded', el());
const waitFor = (p, fn, arg, ms = 60000) => p.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);
const dlg = (p) => p.evaluate(() => { const $ = (id) => document.getElementById(id), shown = (id) => { const e = $(id); return !!e && !e.closest('[hidden]'); };
  return { open: !$('netDlg').hidden, title: $('netTitle').textContent, sec: ['nwIn', 'nwName', 'nwMenu', 'nwBoard', 'nwJoin', 'nwRoom', 'nwRace', 'nwVisit'].filter(shown).join(),
    code: $('nwCode').textContent, who: [...$('nwWho').children].map((li) => li.innerText.replace(/\s+/g, ' ').trim()), lbl: $('nwWhoLbl').textContent,
    joinErr: shown('nwJoinErr') ? $('nwJoinErr').textContent : '', visitErr: shown('nwVisitErr') ? $('nwVisitErr').textContent : '', room: window.__beauRoom.room }; });
// 這台機器軟體畫圖、一秒不到 1 格：點擊不等「穩定」（要好幾格），等條件用計時器輪詢（不用 requestAnimationFrame）
const click = (p, sel) => p.click(sel, { force: true });
const info = (p) => p.evaluate(() => window.beauGame.net.info);
// 打開連線：車庫頁按上面的「👥 連線」；在外面（標題列藏起來）按遊戲裡的「房間 XXXX」
const openNet = async (p) => { if (await p.evaluate(() => document.getElementById('netDlg').hidden)) await click(p, (await p.isVisible('#netChip')) ? '#netChip' : '.nt-room'); await p.waitForTimeout(200); };

const toRoom = async (p) => { await openNet(p); if (await p.isHidden('#nwRoom')) await click(p, '#nwRoomBtn'); await p.waitForTimeout(150); };

// ---- 1 開房間 ----
await openNet(A);
let a = await dlg(A);
check(a.sec === 'nwMenu' && /開一個房間/.test(await A.textContent('#nwRoomBtn')), `menu has 開一個房間 / 輸入房間碼加入 / 排行榜 / 參觀車庫 (${a.sec})`);
await click(A, '#nwRoomBtn');
await waitFor(A, () => window.__beauRoom.room && !document.getElementById('nwRoom').hidden);
a = await dlg(A);
const CODE = a.room?.code || '';
console.log('1', el(), JSON.stringify(a));
check(/^[2-9A-HJKMNP-Z]{4}$/.test(CODE) && a.code === CODE, `room code is 4 easy characters (${CODE})`);
check(a.lbl === '在房間裡的人（1/4）' && /大便龍車神\s*（你，房主）/.test(a.who[0] || '') && a.title === '你的房間', `member list 1/4: you, host (${a.who})`);
check(getAt(`rooms/${CODE}/host`) === 'u1' && getAt(`rooms/${CODE}/s/0`) === 'u1' && getAt(`rooms/${CODE}/m/u1/n`) === '大便龍車神', 'database: host, slot 0, member u1');
await waitFor(A, () => true, null, 500);
check(!!getAt('garages/u1/cars/gc8') && getAt('garages/u1/n') === '大便龍車神', `my garage is published for visits (${JSON.stringify(getAt('garages/u1'))?.slice(0, 80)})`);
await shot(A, `${prefix}-1-room.png`);

// ---- 2 加入 ----
await openNet(B);
await click(B, '#nwJoinBtn');
await B.fill('#nwCodeIn', 'zzzz'); await click(B, '#nwJoinOk');
await waitFor(B, () => !document.getElementById('nwJoinErr').hidden);
let bb = await dlg(B);
check(/找不到這個房間/.test(bb.joinErr) && !bb.room, `wrong code: 「找不到這個房間」 (${bb.joinErr})`);
await B.fill('#nwCodeIn', CODE.toLowerCase()); await click(B, '#nwJoinOk');
await waitFor(B, () => window.__beauRoom.room && !document.getElementById('nwRoom').hidden);
await waitFor(A, () => document.getElementById('nwWhoLbl').textContent.includes('2/4'), null, 10000);
bb = await dlg(B); a = await dlg(A);
console.log('2', el(), JSON.stringify(bb.who), JSON.stringify(a.who));
check(bb.lbl.includes('2/4') && /大便龍車神\s*（房主）/.test(bb.who[0]) && /阿明快車手\s*（你）/.test(bb.who[1]) && bb.title === '房間', `B joined with lower-case code: 2/4, host listed first (${bb.who})`);
check(a.lbl.includes('2/4') && /阿明快車手/.test(a.who[1]) && /車庫/.test(a.who[1]), `A sees B join (with a 🚗 車庫 button) (${a.who})`);
check(await B.evaluate(() => document.getElementById('nwOut').hidden && !document.getElementById('nwRoomNote').hidden), 'only the host has 一起出門 / 一起比賽');
check(getAt(`rooms/${CODE}/s/1`) === 'u2', 'B took slot 1');
await shot(B, `${prefix}-2-joined.png`);

// ---- 3 一起出門 ----
await click(A, '#nwOut');
const outOK = await Promise.all([A, B].map((p) => waitFor(p, () => window.__D().trip && window.__D().on && window.__D().walker && !window.__D().drv, null, 240000)));
console.log('3', el(), outOK);
check(outOK[0] && outOK[1], 'host pressed 一起出門: both phones went out (walking at the garage)');
check(await A.evaluate(() => document.getElementById('netDlg').hidden), 'the dialog closed so the game shows');
const seeB = await waitFor(A, () => { const i = window.beauGame.net.info; return i.peers[0] && i.peers[0].vis && i.peers[0].walk && i.marks === 1; }, null, 30000);
const seeA = await waitFor(B, () => { const i = window.beauGame.net.info; return i.peers[0] && i.peers[0].vis && i.peers[0].walk; }, null, 30000);
if (!seeB || !seeA) { const s0 = await B.evaluate(() => window.__beauRoom.sent); await B.waitForTimeout(5000); console.log('   stale', JSON.stringify({ sentIn5s: (await B.evaluate(() => window.__beauRoom.sent)) - s0, age: await A.evaluate(() => Date.now() + window.__NET().off - window.__NET().P.get('u2').last), db: getAt(`rooms/${CODE}/p/u2`), now: Date.now() })); }
const i3 = await info(A);
console.log('  ', JSON.stringify(i3));
check(seeB && seeA, 'each sees the other walking (character + name tag) and A has a minimap dot');
const hud3 = await A.evaluate(() => { const r = document.querySelector('.nt'); return r && !r.hidden ? r.innerText.replace(/\s+/g, ' ') : null; });
check(/房間 \S{4} · 2 個人/.test(hud3 || ''), `room box in the game: ${hud3}`);
// 走一下：B 往前走，A 看到的位置跟著動
const w0 = await A.evaluate(() => ({ ...window.__NET().P.get('u2').mk }));
await B.evaluate(() => window.__D().walker.setInput({ y: -1 }) /* 往鏡頭走：前面是車 */); await B.waitForTimeout(1500); await B.evaluate(() => window.__D().walker.setInput(null));
await A.waitForTimeout(800);
const w1 = await A.evaluate(() => ({ ...window.__NET().P.get('u2').mk }));
console.log('   walk', JSON.stringify(w0), JSON.stringify(w1), JSON.stringify(getAt(`rooms/${CODE}/p/u2`)), await B.evaluate(() => JSON.stringify({ sent: window.__beauRoom.sent, st: window.beauGame.net.state(), wk: (({ x, z, paused, speed }) => ({ x, z, paused, speed }))(window.__D().walker.telemetry()), mode: window.__D().walker.mode, ae: document.activeElement?.id || document.activeElement?.tagName })), await A.evaluate(() => { const P = window.__NET().P.get('u2'); return JSON.stringify({ n: P.buf.length, last: P.buf[P.buf.length - 1], now: Date.now() }); }));
check(Math.hypot(w1.x - w0.x, w1.z - w0.z) > 1, `B walked → A sees B move (${Math.hypot(w1.x - w0.x, w1.z - w0.z).toFixed(1)} m)`);
await shot(A, `${prefix}-3-walk-together.png`);

const fpsOf = (p) => p.evaluate(() => new Promise((ok) => { const k0 = window.__ticks; setTimeout(() => ok((window.__ticks - k0) / 2), 2000); }));
console.log('   ticks/s', JSON.stringify(await Promise.all([fpsOf(A), fpsOf(B)])));
// ---- 4 表情 ----
await click(A, '.nt-emo');
await click(A, '.nt-tray button:nth-child(3)');
await waitFor(A, () => /你：/.test(document.querySelector('.nt-room').textContent), null, 2500); // 下一格才換字
const emoA = await A.evaluate(() => document.querySelector('.nt-room').textContent);
const emoB = await waitFor(B, () => /大便龍車神：好車！/.test(document.querySelector('.nt-room')?.textContent || ''), null, 8000);
const bub = await B.evaluate(() => { const P = window.__NET().P.get('u1'); return !!P.bub && P.bub.visible; });
check(emoB && bub, 'B sees 「大便龍車神：好車！」 and a bubble over A');
check(/你：好車！/.test(emoA) && getAt(`rooms/${CODE}/e/u1/e`) === 2, `A sees 「你：好車！」 (${emoA})`);
await shot(B, `${prefix}-4-emote.png`);

// ---- 5 爬山 ----
await toRoom(A); await click(A, '#nwRaceBtn');
check((await dlg(A)).title === '要比什麼？', 'host: 要比什麼？ (賽車場 / 400 公尺 / 爬山 / 泥巴賽下次做)');
await click(A, '#nwRace [data-k="hill"]');
const prep = await Promise.all([A, B].map((p) => waitFor(p, () => { const r = window.beauGame.net.info.race; return r && r.kind === 'hill' && (r.phase === 'wait' || r.phase === 'run'); }, null, 120000)));
const pos5 = await Promise.all([A, B].map((p) => p.evaluate(() => { const t = window.__D().drv.telemetry(); return { x: t.x, z: t.z, v: t.v, rc: document.querySelector('.nt-race')?.innerText.replace(/\s+/g, ' ') }; })));
console.log('5', el(), JSON.stringify(pos5));
check(prep[0] && prep[1], 'both got ready for the hill climb (seated in their cars at the start)');
check(Math.hypot(pos5[0].x - pos5[1].x, pos5[0].z - pos5[1].z) > 2.5, `different start spots (${Math.hypot(pos5[0].x - pos5[1].x, pos5[0].z - pos5[1].z).toFixed(1)} m apart)`);
await waitFor(A, () => window.beauGame.net.info.race?.go > 0, null, 40000);
const go5 = await A.evaluate(() => window.beauGame.net.info.race.go);
// 出發前踩油門：不會動
await A.evaluate(() => window.__D().drv.setInput({ throttle: 1, brake: 0, steer: 0 }));
await A.waitForTimeout(800);
const held = await A.evaluate(() => Math.abs(window.__D().drv.telemetry().v));
check(held < 0.5, `before the start the car stays put even with throttle (${held.toFixed(2)} m/s)`);
await A.evaluate(() => window.__D().drv.setInput(null));
await shot(A, `${prefix}-5-hill-countdown.png`);
const runAt = await Promise.all([A, B].map((p) => waitFor(p, () => window.beauGame.net.info.race?.phase === 'run', null, 60000).then(() => p.evaluate(() => window.beauGame.net.info.race.runAt))));
const goGap = runAt.map((t) => t - go5);
check(goGap.every((g) => g >= 0 && g < 1500), `both started at the agreed time (start − go: ${goGap.join(' / ')} ms)`);
// A 開過起點門，然後放到山頂前面開過終點
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
console.log('  hill', JSON.stringify(hill));
check(hill.on && hill.myT > 0, `A drove through the start gate and up to the finish: ${hill.myT} s`);
check(getAt(`rooms/${CODE}/r/${getAt(`rooms/${CODE}/race/seq`)}/u1/t`) === hill.myT, 'A’s time is in the database');
await waitFor(B, () => !document.querySelector('.nt-quit')?.hidden, null, 5000);
await click(B, '.nt-quit');
const res5 = await Promise.all([A, B].map((p) => waitFor(p, () => { const r = document.querySelector('.nt-res'); return r && !r.hidden && /沒跑完/.test(r.innerText) && /:\d\d\.\d\d/.test(r.innerText); }, null, 10000).then(async (ok) => ({ ok, txt: await p.evaluate(() => document.querySelector('.nt-res').innerText.replace(/\s+/g, ' ')) }))));
console.log('  ', JSON.stringify(res5));
check(res5[0].ok && res5[1].ok, 'both phones show the results: A’s time, B 沒跑完');
check(/^爬山計時賽：第 1 名 1 大便龍車神（你）/.test(res5[0].txt) && /第 2 名|沒跑完/.test(res5[1].txt) && /1 大便龍車神/.test(res5[1].txt), 'same order on both phones (A first)');
check(/再來一場/.test(res5[0].txt) && /等房主再來一場/.test(res5[1].txt), 'only the host can press 再來一場');
await shot(A, `${prefix}-5-hill-results.png`);

// ---- 6 再來一場 → 換 400 公尺 ----
const seq5 = getAt(`rooms/${CODE}/race/seq`);
await click(A, '.nt-res .a');
await waitFor(B, (s) => window.beauGame.net.info.race?.seq === s + 1, seq5, 20000);
check(getAt(`rooms/${CODE}/race/seq`) === seq5 + 1 && getAt(`rooms/${CODE}/race/kind`) === 'hill', '再來一場: a new hill race for everyone');
await toRoom(A); await click(A, '#nwRaceBtn'); await click(A, '#nwRace [data-k="drag"]');
const inDrag = await Promise.all([A, B].map((p) => waitFor(p, () => { const r = window.__R(); return r && r.net && window.beauGame.net.info.race?.kind === 'drag' && window.beauGame.net.info.race.phase === 'wait'; }, null, 120000)));
check(inDrag[0] && inDrag[1], 'switched to 400 m: both on the drag strip, no AI opponent');
for (const p of [A, B]) await p.evaluate(() => { // 機器人：綠燈 0.2 秒後起步、轉速到了換檔
  const press = (id) => document.getElementById(id).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  const tick = () => { const r = window.__R(); if (!r || !r.net) return; if (r.phase === 'run' && r.me.fin == null) { const c = r.me; if (c.go == null) { if (r.t - r.green > 0.2) press('goBtn'); } else if (c.rpm >= 0.93 && c.shiftT <= 0 && c.gear < 5) press('goBtn'); } };
  setInterval(tick, 30); // 不用 requestAnimationFrame（這台機器一秒不到 1 格）
});
const dragDbg = async () => { for (const [k, p] of [['A', A], ['B', B]]) console.log('   drag', k, await p.evaluate(() => { const r = window.__R(), i = window.beauGame.net.info.race; return JSON.stringify({ race: i && { seq: i.seq, phase: i.phase, go: i.go, goT: window.__NET().race?.goT }, R: r && { phase: r.phase, t: r.t, greenAt: r.greenAt, green: r.green }, now: Date.now() }); })); console.log('   db', JSON.stringify(getAt(`rooms/${CODE}/race`)), JSON.stringify(getAt(`rooms/${CODE}/r`))); };
await A.waitForTimeout(6000); await dragDbg();
const greens = await Promise.all([A, B].map((p) => p.waitForFunction(() => { const r = window.__R(); return r && r.greenNow ? r.greenNow - r.net.go : false; }, null, { timeout: 90000, polling: 100 }).then((h) => h.jsonValue())));
check(greens.every((g) => g >= 0 && g < 800), `green light at the agreed time on both phones (green − go: ${greens.join(' / ')} ms)`);
await A.waitForFunction(() => window.__R()?.me.x > 120, null, { timeout: 60000, polling: 100 });
const mid = await A.evaluate(() => { const r = window.__R(), o = r.nOpp[0]; return { me: r.me.x, opp: o.x, vis: !!o.obj && o.obj.car.visible, z: o.obj?.car.position.z }; });
console.log('6', el(), JSON.stringify(mid));
check(mid.vis && mid.opp > 50 && mid.z < 0, `B’s car runs in the other lane on A’s screen (B at ${mid.opp.toFixed(0)} m, A at ${mid.me.toFixed(0)} m)`);
await shot(A, `${prefix}-6-drag.png`);
const res6 = await Promise.all([A, B].map((p) => waitFor(p, () => { const r = document.querySelector('.nt-res'); return r && !r.hidden && (r.innerText.match(/\d+\.\d\d 秒/g) || []).length === 2; }, null, 90000).then(async (ok) => ({ ok, txt: await p.evaluate(() => document.querySelector('.nt-res').innerText.replace(/\s+/g, ' ')) }))));
console.log('  ', JSON.stringify(res6));
const rows = (t) => (t.match(/\d (大便龍車神|阿明快車手)(（你）)? (\d+\.\d\d) 秒/g) || []).map((s) => s.replace('（你）', ''));
check(res6[0].ok && res6[1].ok && JSON.stringify(rows(res6[0].txt)) === JSON.stringify(rows(res6[1].txt)) && rows(res6[0].txt).length === 2, `both finished: same names, places and times on both phones (${rows(res6[0].txt)})`);
await shot(B, `${prefix}-6-drag-results.png`);

// ---- 7 回房間：接著一起開車 ----
for (const p of [A, B]) await click(p, '.nt-res .b');
const back = await Promise.all([A, B].map((p) => waitFor(p, () => window.__D().on && window.__D().drv && !window.__R() && !window.beauGame.net.info.race, null, 30000)));
check(back[0] && back[1], '回房間: both driving again (next to the drag strip)');
for (const p of [A, B]) await p.evaluate(() => { if (!document.getElementById('netDlg').hidden) document.getElementById('netX').click(); });
const seeCar = await waitFor(A, () => { const i = window.beauGame.net.info; return i.peers[0]?.vis && i.peers[0].car && i.cols === 1; }, null, 30000);
await A.waitForTimeout(1500);
await A.evaluate(() => window.__thin(1)); await A.waitForTimeout(1500);
const perf = await A.evaluate(() => { const r = window.__rinfo(), i = window.beauGame.net.info, t = window.__D().drv.telemetry(), m = window.__NET().P.get('u2').mk; return { ...r, cols: i.cols, d: Math.hypot(t.x - m.x, t.z - m.z) }; });
console.log('7', el(), JSON.stringify(perf));
check(seeCar, 'A sees B’s car (name tag, shadow) and it blocks like a moving car in free driving');
check(perf.calls < 400, `draw calls with a friend’s car in view: ${perf.calls} calls, ${(perf.tris / 1e6).toFixed(2)} M triangles`);
await shot(A, `${prefix}-7-drive-together.png`);

// ---- 8 參觀車庫 ----
await toRoom(A);
await click(A, '#nwWho li:nth-child(2) button');
await waitFor(A, () => !document.getElementById('nwVisitErr').hidden, null, 5000);
check(/要在車庫頁才能參觀/.test((await dlg(A)).visitErr), 'while driving: 「要在車庫頁才能參觀」');
await click(A, '#netX');
await B.evaluate(() => { if (!document.getElementById('netDlg').hidden) document.getElementById('netX').click(); });
await B.evaluate(() => document.getElementById('driveHome').click());
await waitFor(B, () => !window.__D().trip && document.getElementById('status').hidden, null, 30000);
check(await A.evaluate(() => window.beauGame.net.info.peers[0].vis === false) || await waitFor(A, () => !window.beauGame.net.info.peers[0].vis, null, 10000), 'B went home → A no longer sees B’s car');
await toRoom(B);
await click(B, '#nwWho li:nth-child(1) button');
const vis = await waitFor(B, () => window.beauGame.visiting?.loaded && document.querySelector('.nv'), null, 120000);
if (!vis) console.log('   visit', await B.evaluate(() => JSON.stringify({ v: window.beauGame.visiting, msg: document.getElementById('msg').textContent, st: document.getElementById('status').hidden })));
const v8 = await B.evaluate(() => ({ title: document.querySelector('.nv-top h3').textContent, info: document.querySelector('.nv-info').innerText.replace(/\s+/g, ' '), like: document.querySelector('.nv-like').textContent, dlg: !document.getElementById('netDlg').hidden, cls: document.body.classList.contains('visiting') }));
console.log('8', el(), JSON.stringify(v8));
check(vis && v8.title === '大便龍車神的車庫' && /GC8.*（1\/1）/.test(v8.info) && /♥ 0/.test(v8.info) && !v8.dlg && v8.cls, `B is visiting A’s garage: ${v8.title} · ${v8.info}`);
await shot(B, `${prefix}-8-visit.png`);
await click(B, '.nv-like');
await waitFor(B, () => /♥ 1/.test(document.querySelector('.nv-heart').textContent), null, 5000);
check(getAt('likes/u1/u2') === true && /已經讚了/.test(await B.textContent('.nv-like')), 'like → ♥ 1 (likes/u1/u2 in the database)');
await click(B, '.nv-like');
await waitFor(B, () => /♥ 0/.test(document.querySelector('.nv-heart').textContent), null, 5000);
check(getAt('likes/u1/u2') == null, 'tap again → like taken back (♥ 0)');
let denied = null; try { write('u2', [['garages/u1', { n: 'x' }]]); } catch (e) { denied = e.message; }
check(/PERMISSION/.test(denied || ''), 'nobody can change someone else’s garage (rules)');
await click(B, '.nv-x');
const after8 = await B.evaluate(() => ({ nv: !!document.querySelector('.nv'), cls: document.body.classList.contains('visiting'), mine: window.__D().cur, opts: getComputedStyle(document.getElementById('opts')).display }));
check(!after8.nv && !after8.cls && after8.opts !== 'none', `closed: my garage is back (${JSON.stringify(after8)})`);

// ---- 9 離開、斷線、滿了、房主關掉 ----
await toRoom(B); await click(B, '#nwLeave');
await waitFor(A, () => window.beauGame.net.info.peers.length === 0, null, 10000);
check(getAt(`rooms/${CODE}/m/u2`) == null && getAt(`rooms/${CODE}/s/1`) == null && (await info(A)).peers.length === 0, 'B left: slot freed, A no longer has B');
await B.evaluate(() => document.getElementById('nwJoinBtn').click());
await B.fill('#nwCodeIn', CODE); await click(B, '#nwJoinOk');
await waitFor(B, () => window.__beauRoom.room, null, 10000);
drop('B');
await waitFor(A, () => window.__beauRoom.room.mem.length === 1, null, 10000);
check((await A.evaluate(() => window.__beauRoom.room.mem.length)) === 1 && getAt(`rooms/${CODE}/s`)?.[1] == null, 'B’s phone lost its connection → the server took B out');
await B.evaluate(() => window.__beauRoom.room && window.beauRoom.leave());
for (const n of [1, 2, 3]) { putAt(DB, `rooms/${CODE}/s/${n}`, `x${n}`); putAt(DB, `rooms/${CODE}/m/x${n}`, { n: `朋友${n}`, car: 'gc8', s: String(n), j: n }); }
notify();
await openNet(B); await B.evaluate(() => { document.getElementById('nwJoinBtn').click(); });
await B.fill('#nwCodeIn', CODE); await click(B, '#nwJoinOk');
await waitFor(B, () => !document.getElementById('nwJoinErr').hidden, null, 10000);
check(/滿了/.test((await dlg(B)).joinErr), `5th person: 「這個房間滿了（最多 4 個人）」`);
await toRoom(A);
check((await dlg(A)).lbl.includes('4/4'), 'host sees 4/4');
await click(A, '#nwLeave');
await A.waitForTimeout(500);
check(getAt(`rooms/${CODE}`) == null && !(await A.evaluate(() => window.__beauRoom.room)), 'host closed the room: it is gone from the database');

check(errs.length === 0, `no page errors (${errs.length}) ${errs.slice(0, 3).join(' | ')}`);
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' / ')}` : 'ALL CHECKS OK', el());
await b.close(); srv.close();
process.exit(fails.length ? 1 : 0);
