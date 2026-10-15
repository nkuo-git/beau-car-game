// ---- 大家的世界（Nick 2026-10-11「不用房間 選擇連線的人就加入一個永久的世界 大家都可以持續看到對方 隨時可以看有誰在線上 就發起比賽」「不用世界碼 反正就只有一個世界」；
//      草稿 https://claude.ai/artifact/QDwK28dEsEkumkvR2AiP9Y，Nick 說好、說爸媽同意了）：換掉內容 8 的房間（site/room.js）----
// src/site/world.js，build-site.mjs 接在 online.js 後面（同一個對話框 window.beauNetUI、同一個登入 window.beauCloud、遊戲那邊 window.beauGame.net／visit：net.src.js）
// 「👥 連線」→「進入世界」→ 線上的人（名字、開什麼車、在哪裡）：去找他、🏁 找他比賽、🚗 看他的車庫、🚫 封鎖；下次打開遊戲自己進去（beau.world），按「離開世界」才不會
// 即時資料庫（cloud.js 的 backend().rt()；規則在 notes/world.md，要爸媽貼到 Firebase 主控台）：
//   world/s/{0–5}：uid（6 個位子＝同時最多 6 個人＝車庫街 6 間車庫；2026-10-11 本來 16。規則還是收 0–15，舊版的人可能在 6 以後：沒有車庫而已）
//   world/m/{uid}：{ n, car, l, ch, s（位子）, j（進來的時間）, w（在哪裡）, inv（1＝收比賽邀請、0＝關掉）}
//   world/p/{uid}：位置（跟房間一樣，一秒 8 次，沒動就少送；被警察追多送 w 幾顆星、pc 警車、jl 被抓了）；world/e/{uid}：表情 { e, t }
//   world/bl/{uid}/{誰}：他的名字（封鎖；兩邊都看不到對方、不能找對方比賽）
//   world/ch/{給誰}/{誰找的}：{ kind, t, id }（比賽邀請；20 秒沒回答就算了）
//   matches/{id}：{ a（找人的）, b, kind, at, ok（1 好、−1 不要、−2 在忙）, seq, go }；matches/{id}/r/{seq}/{uid}：{ t }（0＝準備好，秒數＝跑完，−1＝沒跑完）
//   garages/{uid}、likes/{uid}/{誰}：參觀車庫（跟以前一樣）
//   借車（第 19 批，Nick 2026-10-15）：borrow/q/{車主}/{借的人}＝{ c（打的 4 個數字）, t, id }（只有車主讀得到；車主的手機對密碼，密碼本身不上網路）
//     → borrow/a/{借的人}/{車主}＝{ id, ok（1 好、0 不對、−2 現在不能借、−3 錯太多次要等、−9 拿回來）, t, 好的話：k, l, pt, ty, x, z, h；不對：left；要等：wait }
//     → 還車 borrow/r/{車主}/{借的人}＝{ id, x, z, h, t }（停在哪裡）；車主錯 3 次鎖 30 秒（每個借的人分開算）
// 比賽：A 按 🏁 選比什麼 → matches/{id}（ok 0）＋ world/ch/B/A → B 的遊戲跳出卡片（好／不要，15 秒）→ 好：ok 1 → A 寫 seq → 兩邊 net.race（order [A, B]）
//   → 兩邊準備好寫 r/{seq}/{uid}＝{ t: 0 } → A 看兩個都好了（最多等 30 秒）寫 go＝4.5 秒後 → 同時出發；「再比一次」（A）＝新的 seq；「回去開車」＝這場比賽收掉（matches/{id} 刪掉）
// 斷線（關掉 App、沒網路）：伺服器幫你離開世界、收掉你的比賽；網路回來自己再進去
// 測試：window.__beauCloudBackend().rt 換成假的即時資料庫；window.__beauWorld 看狀態
{
  const MAX = 6, INV_MS = 20000, LS_IN = 'beau.world', LS_INV = 'beau.inv';
  const COLS = ['#4a8cff', '#46c46f', '#f2c230', '#ff5fa2', '#a77bff', '#2fd3c7', '#ff8f5a', '#9bd14a', '#5ac8fa', '#e05ad7', '#ffd166', '#7f8cff', '#4cd98f', '#ff6b8b', '#c9a227'], ME_COL = '#ff6a1f'; // 跟 net.src.js 的 NET_COL 一樣
  const KIND = { circuit: '賽車場 3 圈', drag: '400 公尺', hill: '爬山' };
  const $w = (id) => document.getElementById(id);
  const UI = () => window.beauNetUI, C = () => window.beauCloud, G = () => window.beauGame;
  const uid = () => (C() && C().user ? C().user.uid : null);
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* 不給存就算了 */ } };
  const carName = (k) => { try { return (G() && G().cars()[k]) || String(k || '').toUpperCase(); } catch { return String(k || '').toUpperCase(); } };
  let rt = null, W = null, busy = false, errMsg = '', msg = '', visitMsg = '', pubT = 0, pubLast = '', peek = null, pickFor = null, waitMsg = '';
  let invOn = lsGet(LS_INV) !== 'off';
  // W（在世界裡）：{ me, slot, mem: [{ uid, n, car, w, inv, j, s }], all: {}, pos: {}, offs: [], sendT, tickT, last, lastT, conn, seen: {}, myBl: {}, blMe: Set,
  //   inc: {}, showing: { id, from }, answered: {}, out: { id, to, kind, at }, match: { id, a, b, kind, seq, go, raceAt, goT, res, rOff, mOff }, myCar, w, n }
  const S = (window.__beauWorld = {
    get w() { return W ? { me: W.me, slot: W.slot, mem: W.mem.map((m) => ({ uid: m.uid, n: m.n, w: m.w })), out: W.out && { ...W.out }, match: W.match && { id: W.match.id, a: W.match.a, b: W.match.b, kind: W.match.kind, seq: W.match.seq }, showing: W.showing && { ...W.showing }, bl: Object.keys(W.myBl) } : null; },
    sent: 0, err: '',
  });

  async function getRt() {
    if (rt) return rt;
    const be = await C().backend();
    if (!be.rt) throw new Error('no rtdb');
    rt = await be.rt();
    return rt;
  }
  const myName = () => (UI() && UI().name) || '';
  const place = () => { try { return String(G()?.net?.place() || '').slice(0, 12); } catch { return ''; } };
  function memberData(slot) {
    const lk = (G() && G().net && G().net.look()) || { car: 'gc8', l: null, ch: null };
    return { n: myName().slice(0, 12), car: String(lk.car).slice(0, 12), l: lk.l || null, ch: lk.ch || null, s: String(slot), j: rt.now(), w: place() || '在車庫', inv: invOn ? 1 : 0 };
  }
  function fail(e, m) { console.warn('世界', e); errMsg = m || (navigator.onLine === false ? '沒有網路，連上網路再試一次。' : '連不上，等一下再試。'); S.err = String(e && (e.code || e.message) || e); }
  const hid = (u) => !!W && (!!W.myBl[u] || W.blMe.has(u)); // 封鎖（我封鎖他、他封鎖我）：都看不到

  // ---- 進入世界、離開 ----
  async function claim(r, me) { // 拿一個位子（同時有人拿同一個：規則擋掉，換下一個）
    for (let tries = 0; tries < 4; tries++) {
      const s = (await r.get('world/s')) || {}, m = (await r.get('world/m')) || {};
      let slot = -1;
      for (let i = 0; i < MAX; i++) if (s[i] === me) slot = i;
      const free = (i) => !s[i] || !m[s[i]]; // 空的，或是人已經不在了（斷線沒收好）
      const pref = G()?.net?.home?.(); if (slot < 0 && Number.isInteger(pref) && pref >= 0 && pref < MAX && free(pref)) slot = pref; // 你固定的那間（車庫街；有人在用就先住別間）
      for (let i = 0; i < MAX && slot < 0; i++) if (free(i)) slot = i;
      if (slot < 0) return -1;
      try { await r.update('world', { [`s/${slot}`]: me, [`m/${me}`]: memberData(slot) }); return slot; } catch (e) { console.warn('位子被拿走了，換一個', e); }
    }
    throw new Error('no slot');
  }
  async function enter(quiet) {
    if (busy || W) return;
    const me = uid(); if (!me) return;
    if (!(await UI().ensureName())) { if (!quiet) UI().askName(); return; }
    for (let i = 0; i < 120 && !G()?.net; i++) await new Promise((ok) => setTimeout(ok, 500)); // 遊戲還在載入
    if (!G()?.net || W) return;
    busy = true; errMsg = ''; paintAll();
    try {
      const r = await getRt();
      const slot = await claim(r, me);
      if (slot < 0) { errMsg = `世界滿了（最多 ${MAX} 個人），等一下再來。`; busy = false; paintAll(); return; }
      lsSet(LS_IN, '1');
      await start(slot);
      if (!quiet) UI().show('world');
    } catch (e) { fail(e); }
    busy = false; paintAll();
  }
  async function start(slot) {
    const r = rt, me = uid();
    W = { me, slot, mem: [], all: {}, pos: {}, offs: [], last: null, lastT: 0, conn: true, seen: {}, myBl: {}, blMe: new Set(), inc: {}, showing: null, answered: {}, out: null, match: null, myCar: '', w: '', n: myName(), wT: 0, cleanT: 0, rejoin: false, lkK: lookKey(), lkT: 0, bq: null, bor: null, lent: null, tries: {}, bSeen: {} };
    await discSet();
    G()?.net?.join({ code: 'world', me, host: '', name: myName(), slot });
    G()?.net?.clock(r.now() - Date.now());
    const on = (p, cb) => W.offs.push(r.on(p, cb, (e) => console.warn('世界', p, e)));
    on('world/bl', onBlocks);
    on('world/m', onMembers);
    on('world/p', (all) => {
      if (!W) return; W.pos = all || {}; for (const [u, v] of Object.entries(W.pos)) if (u !== W.me && v && !hid(u)) G()?.net?.snap(u, v);
      const L = W.lent, p = L && W.pos[L.to]; if (p && p.o === 1 && [p.x, p.z, p.h].every(Number.isFinite)) L.last = { x: p.x, z: p.z, h: p.h }; // 借我車的人開到哪裡（他斷線了：車停在那裡）
    });
    on('world/e', (all) => { if (!W || !all) return; for (const [u, v] of Object.entries(all)) { if (u === W.me || !v || hid(u) || !(v.t > (W.seen[u] || 0))) continue; W.seen[u] = v.t; if (r.now() - v.t < 15000) G()?.net?.emote(u, v.e | 0); } });
    on(`world/ch/${me}`, (all) => { if (!W) return; W.inc = all || {}; invites(); });
    for (const b of ['q', 'a', 'r']) rt.remove(`borrow/${b}/${me}`).catch(() => {}); // 借車：上次留下來的先清掉
    on(`borrow/q/${me}`, borrowAsked);
    on(`borrow/a/${me}`, borrowAnswered);
    on(`borrow/r/${me}`, borrowReturned);
    if (r.conn) W.offs.push(r.conn((c) => { if (!W) return; const was = W.conn; W.conn = c; if (c && !was) back(); }));
    W.sendT = setInterval(send, 125);
    W.tickT = setInterval(tick, 1000);
    publish(true);
  }
  const mine = (me, slot) => ({ [`s/${slot}`]: null, [`m/${me}`]: null, [`p/${me}`]: null, [`e/${me}`]: null, [`ch/${me}`]: null });
  async function discSet() { try { await rt.disc('world', mine(W.me, W.slot)); } catch (e) { console.warn('斷線自動離開沒設好', e); } } // 關掉 App、沒網路：伺服器幫你離開
  async function back() { // 網路回來：伺服器可能已經幫你離開了 → 再進去（同一個位子，或換一個）
    if (!W || W.rejoin) return;
    W.rejoin = true;
    try {
      const m = await rt.get(`world/m/${W.me}`);
      if (!m && W) {
        const slot = await claim(rt, W.me);
        if (!W) return;
        if (slot < 0) { gone(`世界滿了（最多 ${MAX} 個人），等一下再來。`); return; }
        W.slot = slot; G()?.net?.slot?.(slot); await discSet();
      } else if (W) await discSet();
      if (W && W.match) matchDisc(W.match.id);
    } catch (e) { console.warn('再進去', e); }
    if (W) W.rejoin = false;
  }
  function gone(why) { stop(); errMsg = why || ''; if (UI().view === 'world' || UI().view === 'race' || UI().view === 'wait') UI().show('menu'); paintAll(); }
  function stop() {
    if (!W) return;
    clearInterval(W.sendT); clearInterval(W.tickT);
    for (const f of W.offs) try { f && f(); } catch { /* 算了 */ }
    if (W.match) matchOff(W.match);
    if (W.out && W.out.off) try { W.out.off(); } catch { /* 算了 */ }
    if (W.lent) rt.set(`borrow/a/${W.lent.to}/${W.me}`, { id: W.lent.id, ok: -9, t: rt.now() }).catch(() => {}); // 借出去的：拿回來
    G()?.net?.leave(); // 遊戲那邊：借來的還（送 return）、借出去的收回來
    W = null; paintAll();
  }
  async function leave() { // 「離開世界」：別人看不到我；下次打開也不會自己進去
    if (!W || busy) return;
    const r = rt, { me, slot, out, match } = W;
    lsSet(LS_IN, null);
    stop();
    try {
      await r.discOff('world');
      if (match) { await r.discOff(`matches/${match.id}`); await r.remove(`matches/${match.id}`); }
      if (out) { await r.remove(`world/ch/${out.to}/${me}`); await r.remove(`matches/${out.id}`); }
      await r.update('world', mine(me, slot));
    } catch (e) { console.warn('離開世界', e); }
    UI().show('menu');
  }

  // ---- 線上的人、封鎖 ----
  function onBlocks(all) {
    if (!W) return;
    all = all || {};
    const mineB = all[W.me] || {};
    W.myBl = {}; for (const [u, n] of Object.entries(mineB)) if (n) W.myBl[u] = typeof n === 'string' ? n : '';
    W.blMe = new Set(Object.entries(all).filter(([u, v]) => u !== W.me && v && v[W.me]).map(([u]) => u));
    onMembers(W.all, true);
  }
  function onMembers(all, quiet) {
    if (!W) return;
    W.all = all || {};
    const list = Object.entries(W.all).filter(([, v]) => v && typeof v.n === 'string').map(([u, v]) => ({ uid: u, ...v })).sort((a, b) => (a.j || 0) - (b.j || 0) || (a.uid < b.uid ? -1 : 1));
    if (!list.some((m) => m.uid === W.me)) { if (!quiet) back(); return; } // 伺服器把你拿掉了（斷線一下）：再進去
    W.mem = list.filter((m) => m.uid === W.me || !hid(m.uid));
    G()?.net?.members(W.mem.filter((m) => m.uid !== W.me));
    const here = new Set(W.mem.map((m) => m.uid));
    if (W.out && !here.has(W.out.to)) cancelOut('他離開世界了。');
    if (W.showing && !here.has(W.showing.from)) { G()?.net?.uninvite(W.showing.id); W.showing = null; }
    if (W.match && !here.has(W.match.a === W.me ? W.match.b : W.match.a)) matchEnd(true);
    if (W.lent && !here.has(W.lent.to)) lendBack(W.lent.last || null); // 借車的人離開了：車停在他最後的地方
    if (W.bor && !here.has(W.bor.owner)) { const o = W.bor.owner; W.bor = null; G()?.net?.borrowAns({ uid: o, ok: -8 }); } // 車主離開了：車還他
    if (W.bq && !here.has(W.bq.owner)) { const o = W.bq.owner; W.bq = null; G()?.net?.borrowAns({ uid: o, ok: -2 }); }
    invites(); paintAll();
  }
  async function block(u, n) {
    if (!W || u === W.me) return;
    msg = `封鎖了${n}：你看不到他，他也看不到你。下面可以解除。`; errMsg = '';
    if (W.out && W.out.to === u) cancelOut('');
    if (W.match && (W.match.a === u || W.match.b === u)) matchEnd(false);
    if (W.lent && W.lent.to === u) takeBack();
    if (W.bor && W.bor.owner === u) { W.bor = null; G()?.net?.borrowAns({ uid: u, ok: -8 }); }
    try { await rt.set(`world/bl/${W.me}/${u}`, String(n || '').slice(0, 12) || '?'); } catch (e) { fail(e, '封鎖不了，等一下再試一次。'); msg = ''; }
    paintAll();
  }
  async function unblock(u) {
    if (!W) return;
    msg = '';
    try { await rt.remove(`world/bl/${W.me}/${u}`); } catch (e) { fail(e, '解除不了，等一下再試一次。'); }
    paintAll();
  }
  async function setInv(on) {
    invOn = !!on; lsSet(LS_INV, invOn ? null : 'off');
    if (W) rt.update(`world/m/${W.me}`, { inv: invOn ? 1 : 0 }).catch((e) => console.warn('邀請開關', e));
    paintAll();
  }

  // ---- 位置：一秒 8 次（沒動就 1.5 秒一次、不在外面 3 秒一次）；一秒一次：時間、在哪裡、邀請、出發時間 ----
  const rd = (v, k) => Math.round(v * k) / k;
  function send() {
    if (!W || !W.conn || !rt || !G()?.net) return;
    const s = G().net.state(), now = performance.now();
    const o = { x: rd(s.x, 100), z: rd(s.z, 100), h: rd(s.h, 1000), v: rd(s.v, 10), o: s.o | 0, k: s.k };
    if (s.rp != null) { o.rp = s.rp; o.rs = s.rs; }
    if (s.w) o.w = s.w; if (s.jl) o.jl = 1; // 被警察追：幾顆星、追他的警車；被抓了
    if (s.pk) o.pk = s.pk.slice(); // 第 19 批：下車停著的車 [車, x, z, h]
    if (s.pn) { o.pc = []; for (let i = 0; i < s.pn * 3; i++) o.pc.push(rd(s.pc[i], i % 3 === 2 ? 100 : 10)); }
    const L = W.last, moved = !L || L.o !== o.o || L.k !== o.k || String(L.pk) !== String(o.pk) || L.rs !== o.rs || L.w !== o.w || L.jl !== o.jl || pcMoved(L.pc, o.pc) || Math.abs(L.x - o.x) > 0.05 || Math.abs(L.z - o.z) > 0.05 || Math.abs(L.h - o.h) > 0.01 || Math.abs(L.v - o.v) > 0.2 || L.rp !== o.rp;
    const gap = now - W.lastT;
    if (!(moved && gap > 110 || gap > (o.o ? 1500 : 3000))) return;
    o.t = rt.now(); W.last = o; W.lastT = now;
    rt.set(`world/p/${W.me}`, o).then(() => { S.sent++; }, (e) => console.warn('位置', e));
    if (s.k && s.k !== W.myCar) { // 換開別台：大家看到的車也換
      W.myCar = s.k; W.lkK = lookKey(); const lk = G().net.look();
      if (lk) rt.update(`world/m/${W.me}`, { car: String(lk.car).slice(0, 12), l: lk.l || null }).catch((e) => console.warn('換車', e));
    }
  }
  function pcMoved(a, b) {
    if (!a || !b) return a !== b;
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 0.1) return true;
    return false;
  }
  function lookKey() { const lk = G()?.net?.look(); return lk ? lk.car + JSON.stringify(lk.l || null) : null; }
  function tick() {
    if (!W || !rt) return;
    G()?.net?.clock(rt.now() - Date.now());
    const now = performance.now(), w = place(), n = myName();
    if (W.conn && (w !== W.w || n !== W.n) && now - W.wT > 2500) { W.w = w; W.n = n; W.wT = now; rt.update(`world/m/${W.me}`, { w: w || '在路上', n: n.slice(0, 12) }).catch((e) => console.warn('在哪裡', e)); }
    if (W.conn && now - W.lkT > 2500) { // 改了車（顏色、輪框、套件⋯）：大家看到的也換（Nick 2026-10-11「改車別人只看得到原樣」：以前只有進世界、換車的時候送）
      const lk = G()?.net?.look(), key = lookKey();
      if (lk && key !== W.lkK) { W.lkK = key; W.lkT = now; rt.update(`world/m/${W.me}`, { car: String(lk.car).slice(0, 12), l: lk.l || null }).catch((e) => console.warn('改車', e)); }
    }
    if (W.out && !W.match && now - W.out.at > INV_MS) cancelOut('他沒有回答。');
    if (W.out && UI().view === 'wait') paintWait();
    invites(); hostTick();
    if (now - W.cleanT > 30000) { W.cleanT = now; clean(); }
    if (UI().view === 'world') paintAll();
  }
  async function clean() { // 斷線沒收好的人（2 分鐘以上沒有位置）：誰看到誰收（規則允許）
    if (!W || !W.conn) return;
    const T = rt.now() - 150000;
    for (const [u, v] of Object.entries(W.all || {})) {
      const m = { uid: u, ...v };
      if (m.uid === W.me) continue;
      const p = W.pos[m.uid], t = p && typeof p.t === 'number' ? p.t : m.j || 0;
      if (t > T) continue;
      try { await rt.remove(`world/m/${m.uid}`); if (m.s != null) await rt.remove(`world/s/${m.s}`); await rt.remove(`world/p/${m.uid}`); } catch (e) { console.warn('收掉斷線的人', e); }
    }
  }

  // ---- 別人找我比賽（world/ch/{我}）：一次一張卡片；封鎖的、太舊的、關掉邀請、在忙：不跳 ----
  function invites() {
    if (!W) return;
    const now = rt.now(), here = new Set(W.mem.map((m) => m.uid));
    if (W.showing && !(W.inc[W.showing.from] && W.inc[W.showing.from].id === W.showing.id)) { G()?.net?.uninvite(W.showing.id); W.showing = null; } // 他取消了
    for (const [from, v] of Object.entries(W.inc)) {
      if (!v || typeof v.id !== 'string' || W.answered[v.id] || (W.showing && W.showing.id === v.id)) continue;
      const stale = !(now - (+v.t || 0) < INV_MS), m = W.mem.find((x) => x.uid === from);
      if (stale || hid(from) || !here.has(from) || !KIND[v.kind]) { W.answered[v.id] = 1; rt.remove(`world/ch/${W.me}/${from}`).catch(() => {}); continue; }
      if (!invOn) { reply(from, v.id, -1); continue; }
      if (W.match || W.out || W.lent || G()?.net?.borrowing?.()) { reply(from, v.id, -2); continue; } // 在比賽、在開借來的車、車借出去了
      if (W.showing) continue; // 排隊：這張回答完再跳
      if (G()?.net?.invite({ id: v.id, name: m.n, kind: v.kind, car: carName(m.car) })) W.showing = { id: v.id, from, kind: v.kind };
      else reply(from, v.id, -2); // 在比賽
    }
  }
  function reply(from, id, ok) {
    W.answered[id] = 1;
    rt.remove(`world/ch/${W.me}/${from}`).catch(() => {});
    if (ok !== 1) rt.update(`matches/${id}`, { ok }).catch(() => {}); // 他已經取消了：沒關係
  }
  async function answer(id, ok) {
    if (!W || !W.showing || W.showing.id !== id) return;
    const { from, kind } = W.showing; W.showing = null;
    if (!ok) { reply(from, id, -1); invites(); return; }
    W.answered[id] = 1;
    rt.remove(`world/ch/${W.me}/${from}`).catch(() => {});
    try {
      await rt.update(`matches/${id}`, { ok: 1 });
      matchStart({ id, a: from, b: W.me, kind });
    } catch (e) { console.warn('答應比賽', e); toast('對方已經取消了'); }
  }
  const toast = (t) => { try { G()?.net?.say?.(t); } catch { /* 算了 */ } };

  // ---- 我找別人比賽 ----
  async function challenge(to, kind) {
    if (!W || busy || !KIND[kind]) return;
    const m = W.mem.find((x) => x.uid === to);
    errMsg = ''; waitMsg = '';
    if (!m || hid(to)) { errMsg = '他已經不在線上了。'; UI().show('world'); return; }
    if (m.inv === 0) { errMsg = `${m.n}關掉了比賽邀請。`; UI().show('world'); return; }
    if (W.match || W.out) { errMsg = '你已經在比賽了。'; UI().show('world'); return; }
    if (G()?.net?.borrowing?.()) { errMsg = '先還車才能找人比賽。'; UI().show('world'); return; }
    if (W.lent) { errMsg = `你的車借給${W.lent.n}了，先拿回來才能找人比賽。`; UI().show('world'); return; }
    const id = `${W.me.slice(0, 10)}-${Date.now().toString(36)}`.replace(/[^A-Za-z0-9_-]/g, '');
    busy = true;
    try {
      await rt.set(`matches/${id}`, { a: W.me, b: to, kind, at: rt.now(), ok: 0 });
      await rt.disc(`matches/${id}`).catch(() => {});
      await rt.set(`world/ch/${to}/${W.me}`, { kind, t: rt.now(), id });
      W.out = { id, to, n: m.n, kind, at: performance.now(), off: null };
      W.out.off = rt.on(`matches/${id}`, (v) => onOut(id, v), (e) => console.warn('邀請', e));
      UI().show('wait');
    } catch (e) { fail(e, '送不出去，等一下再試一次。'); rt.remove(`matches/${id}`).catch(() => {}); UI().show('world'); }
    busy = false; paintAll();
  }
  function onOut(id, v) {
    const O = W && W.out; if (!O || O.id !== id || !v) return;
    if (v.ok === -1) cancelOut(`${O.n}說「不要」。`);
    else if (v.ok === -2) cancelOut(`${O.n}正在忙（在比賽），等一下再找他。`);
    else if (v.ok === 1) {
      const off = O.off; W.out = null;
      try { off && off(); } catch { /* 算了 */ }
      rt.remove(`world/ch/${O.to}/${W.me}`).catch(() => {});
      matchStart({ id, a: W.me, b: O.to, kind: O.kind });
      rt.update(`matches/${id}`, { seq: Math.floor(rt.now() / 1000), go: 0 }).catch((e) => console.warn('開始比賽', e));
    }
  }
  function cancelOut(why) {
    const O = W && W.out; if (!O) return;
    W.out = null;
    try { O.off && O.off(); } catch { /* 算了 */ }
    rt.remove(`world/ch/${O.to}/${W.me}`).catch(() => {});
    rt.discOff(`matches/${O.id}`).catch(() => {}); rt.remove(`matches/${O.id}`).catch(() => {});
    waitMsg = why || '';
    if (UI().view === 'wait') { if (why) paintAll(); else UI().show('world'); }
    else if (why) { errMsg = why; paintAll(); }
  }

  // ---- 比賽（兩個人都一樣；a＝找人的＝可以按「再比一次」、定出發時間）----
  function matchStart(o) {
    if (!W) return;
    if (W.match) matchEnd(false);
    const M = W.match = { id: o.id, a: o.a, b: o.b, kind: o.kind, seq: 0, go: 0, raceAt: 0, goT: 0, res: {}, rOff: null, mOff: null };
    matchDisc(M.id);
    M.mOff = rt.on(`matches/${M.id}`, (v) => onMatch(M, v), (e) => console.warn('比賽', e));
    if (UI().view) UI().close(); // 看遊戲（倒數、起點）
  }
  function matchDisc(id) { rt.disc(`matches/${id}`).catch((e) => console.warn('斷線收比賽', e)); }
  function onMatch(M, v) {
    if (!W || W.match !== M) return;
    if (!v) { matchEnd(true); return; } // 對方回去開車、離開了
    if (!v.seq) return;
    if (v.seq !== M.seq) {
      M.seq = v.seq; M.go = 0; M.res = {}; M.raceAt = performance.now(); M.goT = 0;
      if (M.rOff) try { M.rOff(); } catch { /* 算了 */ }
      const seq = v.seq;
      M.rOff = rt.on(`matches/${M.id}/r/${seq}`, (all) => {
        if (!W || W.match !== M || M.seq !== seq) return;
        M.res = all || {};
        const map = {}; for (const [u, x] of Object.entries(M.res)) if (x && typeof x.t === 'number') map[u] = x.t;
        G()?.net?.results(seq, map);
        hostTick();
      }, (e) => console.warn('成績', e));
    }
    M.go = +v.go || 0;
    G()?.net?.host(M.a);
    G()?.net?.race({ seq: M.seq, kind: M.kind, go: M.go, order: [M.a, M.b] });
  }
  function matchOff(M) {
    if (M.mOff) try { M.mOff(); } catch { /* 算了 */ }
    if (M.rOff) try { M.rOff(); } catch { /* 算了 */ }
  }
  // 這場比賽收掉。gone＝對方走了（自己的比賽還在跑就跑完；結果上寫「對方離開了」）；不然＝我按「回去開車」、封鎖他、換別的比賽
  function matchEnd(gone) {
    const M = W && W.match; if (!M) return;
    W.match = null; matchOff(M);
    rt.discOff(`matches/${M.id}`).catch(() => {});
    rt.remove(`matches/${M.id}`).catch(() => {});
    G()?.net?.host('');
    if (!gone) G()?.net?.end();
    paintAll();
  }
  function hostTick() { // 找人的那個：兩個都準備好了（或等了 30 秒）→ 定出發時間（4.5 秒後）
    const M = W && W.match;
    if (!M || M.a !== W.me || !M.seq || M.go || M.goT === M.seq) return;
    const res = M.res || {}, both = !!res[M.a] && !!res[M.b], late = performance.now() - M.raceAt > 30000 && Object.keys(res).length > 0;
    if (!(both || late)) return;
    M.goT = M.seq;
    rt.update(`matches/${M.id}`, { go: rt.now() + 4500 }).catch((e) => { console.warn('出發時間', e); M.goT = 0; });
  }
  window.addEventListener('beau-net', (ev) => {
    const d = ev.detail || {}; if (!W || !rt) return;
    const M = W.match;
    if (d.type === 'emote') rt.set(`world/e/${W.me}`, { e: d.e | 0, t: rt.now() }).catch((e) => console.warn('表情', e));
    else if (d.type === 'ready' && M && d.seq === M.seq) rt.set(`matches/${M.id}/r/${d.seq}/${W.me}`, { t: 0 }).catch((e) => console.warn('準備好', e));
    else if (d.type === 'fin' && M && d.seq === M.seq && typeof d.t === 'number') rt.set(`matches/${M.id}/r/${d.seq}/${W.me}`, { t: d.t }).catch((e) => console.warn('成績', e));
    else if (d.type === 'again' && M && M.a === W.me) rt.update(`matches/${M.id}`, { seq: Math.max(M.seq + 1, Math.floor(rt.now() / 1000)), go: 0 }).catch((e) => console.warn('再比一次', e));
    else if (d.type === 'back') matchEnd(false);
    else if (d.type === 'answer') answer(String(d.id || ''), !!d.ok);
    else if (d.type === 'list') { errMsg = ''; UI().show('world'); }
    else if (d.type === 'visit') visitStreet(String(d.uid || ''), String(d.name || ''));
    else if (d.type === 'borrow') borrowAsk(String(d.uid || ''), String(d.code || ''));
    else if (d.type === 'return') borrowReturn(String(d.uid || ''), d);
    else if (d.type === 'takeback') { if (W.lent && W.lent.to === String(d.uid || '')) takeBack(); }
  });

  // ---- 借車（第 19 批）----
  const B_TRY = 3, B_LOCK = 30000, B_OLD = 20000;
  function borrowAsk(owner, code) { // 我：打完密碼 → 問車主
    const m = W.mem.find((x) => x.uid === owner);
    if (!m || hid(owner) || owner === W.me || !/^[0-9]{4}$/.test(code)) { G()?.net?.borrowAns({ uid: owner, ok: -2 }); return; }
    const id = `${W.me.slice(0, 10)}-${Date.now().toString(36)}`.replace(/[^A-Za-z0-9_-]/g, '');
    W.bq = { owner, id };
    rt.set(`borrow/q/${owner}/${W.me}`, { c: code, t: rt.now(), id }).catch((e) => { console.warn('借車', e); if (W && W.bq && W.bq.id === id) { W.bq = null; G()?.net?.borrowAns({ uid: owner, ok: -2 }); } });
  }
  function borrowAnswered(all) { // 我：車主的回答
    if (!W || !all) return;
    for (const [owner, v] of Object.entries(all)) {
      if (!v || typeof v.id !== 'string' || W.bSeen['a' + v.id + v.ok]) continue;
      W.bSeen['a' + v.id + v.ok] = 1;
      rt.remove(`borrow/a/${W.me}/${owner}`).catch(() => {});
      if (v.ok === -9) { if (W.bor && W.bor.owner === owner && W.bor.id === v.id) { W.bor = null; G()?.net?.borrowAns({ uid: owner, ok: -9 }); } continue; }
      if (!W.bq || W.bq.owner !== owner || W.bq.id !== v.id) continue; // 不是我現在問的
      W.bq = null;
      if (v.ok === 1) W.bor = { owner, id: v.id };
      G()?.net?.borrowAns({ ...v, uid: owner });
    }
  }
  function borrowReturn(owner, d) { // 我：還車（停在哪裡）
    const B = W.bor; if (!B || B.owner !== owner) return;
    W.bor = null;
    const ok = [d.x, d.z, d.h].every(Number.isFinite);
    rt.set(`borrow/r/${owner}/${W.me}`, { id: B.id, x: ok ? rd(d.x, 100) : 0, z: ok ? rd(d.z, 100) : 0, h: ok ? rd(d.h, 1000) : 0, t: rt.now() }).catch((e) => console.warn('還車', e));
  }
  function borrowAsked(all) { // 車主：有人打了密碼
    if (!W || !all) return;
    for (const [from, v] of Object.entries(all)) {
      if (!v || typeof v.id !== 'string' || W.bSeen['q' + v.id]) continue;
      W.bSeen['q' + v.id] = 1;
      rt.remove(`borrow/q/${W.me}/${from}`).catch(() => {});
      const m = W.mem.find((x) => x.uid === from);
      if (!m || hid(from) || !(rt.now() - (+v.t || 0) < B_OLD)) continue; // 太舊的、封鎖的、不在世界裡的：不理
      const ans = (o) => rt.set(`borrow/a/${from}/${W.me}`, { id: v.id, t: rt.now(), ...o }).catch((e) => console.warn('借車回答', e));
      const T = W.tries[from] || (W.tries[from] = { n: 0, until: 0 }), now = performance.now();
      if (T.until > now) { ans({ ok: -3, wait: Math.ceil((T.until - now) / 1000) }); continue; }
      const info = !W.lent && G()?.net?.lendCheck?.();
      if (!info) { ans({ ok: -2 }); continue; } // 我在開、借給別人了、在車庫裡
      if (String(v.c) !== G().net.key()) {
        T.n++;
        if (T.n >= B_TRY) { T.n = 0; T.until = now + B_LOCK; ans({ ok: -3, wait: B_LOCK / 1000 }); } else ans({ ok: 0, left: B_TRY - T.n });
        continue;
      }
      T.n = 0;
      if (!G().net.lend(from, m.n)) { ans({ ok: -2 }); continue; }
      W.lent = { to: from, id: v.id, n: m.n };
      ans({ ok: 1, k: info.k, l: info.l || null, pt: info.pt, ty: info.ty, x: info.x, z: info.z, h: info.h });
    }
  }
  function borrowReturned(all) { // 車主：還回來了
    if (!W || !all) return;
    for (const [from, v] of Object.entries(all)) {
      rt.remove(`borrow/r/${W.me}/${from}`).catch(() => {});
      if (!v || !W.lent || W.lent.to !== from || W.lent.id !== v.id) continue;
      W.lent = null;
      G()?.net?.unlend({ x: +v.x, z: +v.z, h: +v.h });
    }
  }
  function lendBack(p) { W.lent = null; G()?.net?.unlend(p); }
  function takeBack() { // 車主：按「拿回來」（他在開的話停在他現在的地方）
    const L = W.lent; if (!L) return;
    rt.set(`borrow/a/${L.to}/${W.me}`, { id: L.id, ok: -9, t: rt.now() }).catch((e) => console.warn('拿回來', e));
    lendBack(L.last || null);
  }

  // ---- 參觀車庫（跟房間的時候一樣）----
  async function publish(now) { // 自己的車庫給別人看（存檔一變就更新；一樣就不送）
    clearTimeout(pubT);
    if (!now) { pubT = setTimeout(() => publish(true), 8000); return; }
    const me = uid(), n = myName(); if (!me || !n || !G()?.net) return;
    const g = G().net.garage(), body = JSON.stringify([n, g]);
    if (body === pubLast) return;
    try { const r = await getRt(); await r.set(`garages/${me}`, { n: n.slice(0, 12), t: r.now(), cur: g.cur, cars: g.cars }); pubLast = body; } catch (e) { console.warn('車庫', e); }
  }
  window.addEventListener('beau-save', () => { if (uid() && myName() && (W || pubLast)) publish(false); });
  async function visit(who, name) {
    const me = uid(); if (!me || !who) return;
    visitMsg = '';
    if (!G()?.visit || G().net?.where() !== 'garage') { visitMsg = '要在車庫頁才能參觀：先按「直接回車庫」，再點一次。'; UI().show('visit'); return; }
    if (who === me) return;
    busy = true; UI().show('visit'); visitMsg = '讀取中⋯'; paintAll();
    try {
      const r = await getRt();
      const g = await r.get(`garages/${who}`);
      if (!g || !g.cars) { visitMsg = `${name || '他'}還沒有開放車庫（要先打開一次「連線」才看得到）。`; busy = false; paintAll(); return; }
      const likes = (await r.get(`likes/${who}`)) || {};
      const cars = Object.entries(g.cars).map(([k, l]) => ({ k, l }));
      const ctl = G().visit({ name: g.n || name, cur: g.cur, cars, likes: Object.keys(likes).length, liked: !!likes[me],
        onLike: async (on) => {
          if (on) await r.set(`likes/${who}/${me}`, true); else await r.remove(`likes/${who}/${me}`);
          const L = (await r.get(`likes/${who}`)) || {};
          return { likes: Object.keys(L).length, liked: !!L[me] };
        },
        onClose: () => {} });
      busy = false;
      if (!ctl) { visitMsg = '要在車庫頁才能參觀：先按「直接回車庫」，再點一次。'; paintAll(); return; }
      visitMsg = ''; UI().close();
    } catch (e) { busy = false; visitMsg = '打不開，等一下再試一次。'; console.warn('參觀', e); paintAll(); }
  }
  async function visitStreet(u, n) { // 車庫街：走到他的車庫門口按「🚗 看他的車庫」→ 回車庫頁 → 參觀
    if (!u) return;
    const wait = (ms) => new Promise((ok) => setTimeout(ok, ms)), home = () => G()?.net?.where() === 'garage' && document.getElementById('status')?.hidden !== false;
    if (G()?.net?.where() !== 'garage') document.getElementById('driveHome')?.click();
    for (let i = 0; i < 160 && !home(); i++) await wait(250);
    if (!home()) return;
    await wait(300);
    visit(u, n);
  }
  function goTo(u, n) {
    const r = G()?.net?.goTo(u);
    errMsg = ''; msg = '';
    if (r === 'ok') { UI().close(); return; }
    if (r === 'garage') msg = `要先出門才能去找${n}。`;
    else if (r === 'away') { const m = W && W.mem.find((x) => x.uid === u); msg = `${n}${m && m.w ? m.w : '不在外面'}，現在找不到他。`; }
    else msg = `${n}已經不在線上了。`;
    paintAll();
  }
  window.beauRoom = { visit }; // online.js 的排行榜：點名字參觀車庫
  window.beauWorld = { enter, leave, challenge, block, unblock, setInv, visit };

  // ---- 畫面 ----
  const ava = (name, col) => { const a = document.createElement('span'); a.className = 'ava'; a.style.background = col; a.textContent = [...(name || '?')][0] || '?'; return a; };
  const btn = (txt, title, fn, cls) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; if (title) { b.title = title; b.setAttribute('aria-label', title); } if (cls) b.className = cls; b.addEventListener('click', fn); return b; };
  async function peekCount() { // 還沒進去：現在有幾個人在線上
    try { const r = await getRt(); const m = (await r.get('world/m')) || {}; peek = Object.keys(m).length; } catch { peek = null; }
    paintAll();
  }
  function paintMenu() {
    const wb = $w('nwWorldBtn'), top = $w('nwMenuTop'), note = $w('nwMenuNote');
    if (!wb) return;
    const n = W ? W.mem.length : peek;
    top.textContent = n == null ? '大家都在同一個世界。' : `大家都在同一個世界。現在有 ${n} 個人在線上。`;
    if (W) wb.replaceChildren('👥 線上的人', Object.assign(document.createElement('small'), { textContent: `${W.mem.length} 個人在線上（你在世界裡）` }));
    else wb.replaceChildren(busy ? '進去中⋯' : '進入世界', Object.assign(document.createElement('small'), { textContent: '下次打開遊戲自己就進去' }));
    wb.disabled = busy;
    note.textContent = errMsg || `只看得到名字，不能打字聊天（只有 5 個表情）。同時最多 ${MAX} 個人。`;
    note.classList.toggle('cl-err', !!errMsg); note.classList.toggle('cl-note', !errMsg);
  }
  function paintWorld() {
    if (!W) return;
    let ci = 0;
    const out = !!G()?.net && G().net.where() === 'out';
    $w('nwPpl').replaceChildren(...W.mem.map((m) => {
      const li = document.createElement('li'), me = m.uid === W.me, col = me ? ME_COL : COLS[ci++ % COLS.length], nm = document.createElement('span'), b = document.createElement('b'), sm = document.createElement('small');
      nm.className = 'nm'; b.textContent = me ? `${m.n}（你）` : m.n; sm.textContent = `${carName(m.car)} · ${m.w || '在路上'}`;
      nm.append(b, sm); li.append(ava(m.n, col), nm);
      if (!me) {
        if (out && !['在車庫', '在比賽', '在 400 公尺'].includes(m.w)) li.append(btn('去找他', `去找${m.n}`, () => goTo(m.uid, m.n)));
        li.append(btn('🏁', `找${m.n}比賽`, () => { errMsg = ''; pickFor = { uid: m.uid, n: m.n }; UI().show('race'); }, 'go'));
        li.append(btn('🚗', `看${m.n}的車庫`, () => visit(m.uid, m.n)));
        li.append(btn('🚫', `封鎖${m.n}`, () => block(m.uid, m.n)));
      }
      return li;
    }));
    const e = $w('nwWorldErr'); e.hidden = !errMsg; e.textContent = errMsg;
    const ms = $w('nwWorldMsg'); ms.hidden = !msg || !!errMsg; ms.textContent = msg;
    paintKey();
    const t = $w('nwInvTog'); t.setAttribute('aria-pressed', String(invOn)); t.textContent = invOn ? '開' : '關';
    const bl = Object.entries(W.myBl);
    $w('nwBlk').hidden = !bl.length; $w('nwBlkSum').textContent = `封鎖的人（${bl.length}）`;
    $w('nwBlkList').replaceChildren(...bl.map(([u, n]) => { const li = document.createElement('li'), nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = n || '（名字不知道）'; li.append(nm, btn('解除封鎖', null, () => unblock(u))); return li; }));
  }
  let keyEdit = false, keyErr = '';
  function paintKey() { // 🔑 我的車鑰匙密碼（第 19 批）：只有自己看得到
    const code = $w('nwKeyCode'); if (!code) return;
    const k = G()?.net?.key?.() || '';
    code.textContent = k || '····';
    $w('nwKeyForm').hidden = !keyEdit; $w('nwKeyEdit').textContent = keyEdit ? '取消' : '改密碼';
    const n = $w('nwKeyNote'), lent = G()?.net?.lent?.(), who = lent && W && W.lent ? W.lent.n : '';
    n.textContent = keyErr || (who ? `🔑 ${who}在開你的 ${carName(lent.k)}。` : '只有你看得到。要借車給朋友，就跟他說這 4 個數字。你下車以後，他走到你的車旁邊打密碼就能開。');
    n.classList.toggle('cl-err', !!keyErr); n.classList.toggle('cl-note', !keyErr);
  }
  function keySave() {
    const v = $w('nwKeyIn').value.trim();
    if (!/^[0-9]{4}$/.test(v) || !G()?.net?.setKey?.(v)) { keyErr = '密碼要剛好 4 個數字（0–9）。'; paintKey(); return; }
    keyEdit = false; keyErr = ''; $w('nwKeyIn').value = ''; msg = '密碼改好了。'; errMsg = ''; paintAll();
  }
  function paintWait() {
    const O = W && W.out;
    $w('nwWaitTxt').textContent = O ? `等${O.n}回答⋯（${KIND[O.kind]}）` : '';
    const bar = $w('nwWaitBar'); bar.style.width = O ? `${Math.max(0, 100 - (performance.now() - O.at) / INV_MS * 100)}%` : '0%';
    const e = $w('nwWaitErr'); e.hidden = !waitMsg; e.textContent = waitMsg;
    $w('nwWaitX').textContent = O ? '取消' : '← 回線上的人';
  }
  function paintVisit() {
    const list = $w('nwVisitList'), others = W ? W.mem.filter((m) => m.uid !== W.me) : [];
    let ci = 0;
    list.replaceChildren(...others.map((m) => { const li = document.createElement('li'), nm = document.createElement('span'), b = btn('看車庫', null, () => visit(m.uid, m.n)); nm.className = 'nm'; nm.textContent = m.n; b.disabled = busy; li.append(ava(m.n, COLS[ci++ % COLS.length]), nm, b); return li; }));
    list.hidden = !others.length;
    $w('nwVisitNote').textContent = others.length ? '線上的人：' : '進入世界，或在排行榜上點名字，就可以參觀別人的車庫。只能看，不能改，也不能拿走。';
    const e = $w('nwVisitErr'); e.hidden = !visitMsg; e.textContent = visitMsg;
  }
  function paintAll() { UI()?.paint(); }

  if ($w('nwWorld') && window.beauNetUI) {
    UI().add('menu', $w('nwMenu'), { title: '連線', paint: paintMenu });
    UI().add('world', $w('nwWorld'), { title: () => `線上的人（${W ? W.mem.length : 0}/${MAX}）`, paint: paintWorld });
    UI().add('race', $w('nwRace'), { title: () => (pickFor ? `找${pickFor.n}比什麼？` : '要比什麼？'), paint: () => { for (const b of $w('nwRace').querySelectorAll('[data-k]')) b.disabled = busy; } });
    UI().add('wait', $w('nwWait'), { title: '🏁 找人比賽', paint: paintWait });
    UI().add('visit', $w('nwVisit'), { title: '🚗 參觀車庫', paint: paintVisit });
    $w('nwWorldBtn').addEventListener('click', () => { errMsg = ''; msg = ''; if (W) UI().show('world'); else enter(false); });
    $w('nwVisitBtn').addEventListener('click', () => { visitMsg = ''; UI().show('visit'); publish(true); });
    $w('nwVisitBack').addEventListener('click', () => UI().show(W ? 'world' : 'menu'));
    $w('nwRaceBack').addEventListener('click', () => UI().show('world'));
    for (const b of $w('nwRace').querySelectorAll('[data-k]')) b.addEventListener('click', () => { if (pickFor) challenge(pickFor.uid, b.dataset.k); });
    $w('nwWaitX').addEventListener('click', () => { if (W && W.out) cancelOut(''); else { waitMsg = ''; UI().show('world'); } });
    $w('nwInvTog').addEventListener('click', () => setInv(!invOn));
    $w('nwKeyEdit').addEventListener('click', () => { keyEdit = !keyEdit; keyErr = ''; $w('nwKeyIn').value = ''; paintKey(); if (keyEdit) $w('nwKeyIn').focus(); });
    $w('nwKeyOk').addEventListener('click', keySave);
    $w('nwKeyIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') keySave(); });
    $w('nwKeyIn').addEventListener('input', (e) => { const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 4); if (v !== e.target.value) e.target.value = v; });
    $w('nwLeaveW').addEventListener('click', leave);
    $w('netChip')?.addEventListener('click', () => { if (!W) peekCount(); });
    const auto = () => { if (uid() && !W && lsGet(LS_IN) === '1') enter(true); }; // 上次在世界裡：自己進去
    window.addEventListener('beau-user', () => { if (!uid()) { stop(); pubLast = ''; } else auto(); });
    if (uid()) auto();
    window.addEventListener('pagehide', () => { if (W && rt) rt.update('world', mine(W.me, W.slot)).catch(() => {}); });
    window.addEventListener('pageshow', (e) => { if (e.persisted && W) back(); });
  }
}
