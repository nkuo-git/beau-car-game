// ---- 連線第 2–4 步：房間（一起開車、一起比賽）、參觀車庫（Nick 2026-10-10「那可以開始做上面12點的前3點」；草稿 https://claude.ai/artifact/6BtzWH7D5uWYMCra2e7DJo 第 2–6、9 張）----
// src/site/room.js，build-site.mjs 接在 online.js 後面（同一個對話框 window.beauNetUI、同一個登入 window.beauCloud、遊戲那邊 window.beauGame.net／visit：net.src.js）
// 即時資料庫（cloud.js 的 backend().rt()；規則在 notes/room.md，家長 2026-10-10 貼好了）：
//   rooms/{碼}：{ host, at, race: { seq, kind, go }, s: { 0–3: uid（4 個位子＝最多 4 個人）}, m: { uid: { n, car, l, ch, s, j } }, p: { uid: 位置 }, e: { uid: { e, t } }, r: { seq: { uid: { t } } } }
//   garages/{uid}：{ n, t, cur, cars: { 車: 外觀 } }（參觀車庫）；likes/{uid}/{誰按的}: true
// 房間碼：4 個字（沒有 0 1 I L O，不會看錯）；開房間的是房主（選比賽、叫大家出門；離開＝關掉房間）；斷線（關掉 App）自己離開
// 位置：一秒 8 次（沒動就少送），沒連上網路不送（不會塞一堆舊的）；伺服器時間（.info/serverTimeOffset）給遊戲對齊大家的時間
// 一起比賽：房主選 → race { seq＋1, kind, go: 0 } → 大家的遊戲準備好寫 r/{seq}/{uid} = { t: 0 } → 房主看大家都好了（最多等 30 秒）寫 go＝4.5 秒後 → 同時出發 → 跑完寫 { t: 秒 }（−1＝沒跑完）
// 測試：window.__beauCloudBackend().rt 換成假的即時資料庫；window.__beauRoom 看狀態
{
  const ABC = '23456789ABCDEFGHJKMNPQRSTUVWXYZ', CODE_RE = /^[2-9A-HJKMNP-Z]{4}$/;
  const COLS = ['#4a8cff', '#46c46f', '#f2c230', '#ff5fa2'], ME_COL = '#ff6a1f';
  const $r = (id) => document.getElementById(id);
  const UI = () => window.beauNetUI, C = () => window.beauCloud, G = () => window.beauGame;
  const uid = () => (C() && C().user ? C().user.uid : null);
  let rt = null, R = null, busy = false, errMsg = '', visitMsg = '', pubT = 0, pubLast = '';
  // R（在房間裡）：{ code, me, host, slot, mem: [{ uid, n, … }], race, seq0, offs: [], sendT, clockT, last, lastT, conn, seen: {}, rOff, raceAt, goT, myCar }
  const S = (window.__beauRoom = { get room() { return R ? { code: R.code, host: R.host, me: R.me, mem: R.mem.map((m) => ({ uid: m.uid, n: m.n })), race: R.race } : null; }, sent: 0, err: '' });

  async function getRt() {
    if (rt) return rt;
    const be = await C().backend();
    if (!be.rt) throw new Error('no rtdb');
    rt = await be.rt();
    return rt;
  }
  const myName = () => (UI() && UI().name) || '';
  function memberData(slot) {
    const lk = (G() && G().net && G().net.look()) || { car: 'gc8', l: null, ch: null };
    return { n: myName().slice(0, 12), car: String(lk.car).slice(0, 12), l: lk.l || null, ch: lk.ch || null, s: String(slot), j: rt.now() };
  }
  function fail(e, msg) { console.warn('房間', e); errMsg = msg || (navigator.onLine === false ? '沒有網路，連上網路再試一次。' : '連不上，等一下再試。'); S.err = String(e && (e.code || e.message) || e); }

  // ---- 開房間、加入、離開 ----
  async function create() {
    if (busy || R) return;
    const me = uid(); if (!me) return;
    if (!(await UI().ensureName())) { UI().askName(); return; }
    busy = true; errMsg = ''; paintAll();
    try {
      const r = await getRt();
      let code = null;
      for (let i = 0; i < 10 && !code; i++) {
        let c = ''; for (let k = 0; k < 4; k++) c += ABC[Math.floor(Math.random() * ABC.length)];
        if ((await r.get(`rooms/${c}/host`)) == null) code = c;
      }
      if (!code) throw new Error('no free code');
      await r.set(`rooms/${code}`, { host: me, at: r.now(), s: { 0: me }, m: { [me]: memberData(0) } });
      await enter(code, me, 0);
    } catch (e) { fail(e); }
    busy = false; paintAll();
  }
  async function join(raw) {
    if (busy || R) return;
    const me = uid(); if (!me) return;
    const code = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    errMsg = '';
    if (!CODE_RE.test(code)) { errMsg = '房間碼是 4 個字（數字和英文字母），再看一次。'; paintAll(); return; }
    if (!(await UI().ensureName())) { UI().askName(); return; }
    busy = true; paintAll();
    try {
      const r = await getRt();
      const host = await r.get(`rooms/${code}/host`);
      if (!host) { errMsg = '找不到這個房間。房間碼對嗎？也可能房主已經關掉了。'; busy = false; paintAll(); return; }
      const s = (await r.get(`rooms/${code}/s`)) || {};
      let slot = -1;
      for (let i = 0; i < 4; i++) if (s[i] === me) slot = i;
      for (let i = 0; i < 4 && slot < 0; i++) if (!s[i]) slot = i;
      if (slot < 0) { errMsg = '這個房間滿了（最多 4 個人）。'; busy = false; paintAll(); return; }
      await r.update(`rooms/${code}`, { [`s/${slot}`]: me, [`m/${me}`]: memberData(slot) });
      await enter(code, host, slot);
    } catch (e) { fail(e, '進不去這個房間，等一下再試一次。'); }
    busy = false; paintAll();
  }
  async function enter(code, host, slot) {
    const r = rt, me = uid();
    R = { code, me, host, slot, mem: [], race: null, seq0: 0, offs: [], last: null, lastT: 0, conn: true, seen: {}, rOff: null, raceAt: 0, goT: 0, myCar: '', rSeq: 0 };
    const mine = { [`s/${slot}`]: null, [`m/${me}`]: null, [`p/${me}`]: null, [`e/${me}`]: null };
    try { await r.disc(`rooms/${code}`, mine); } catch (e) { console.warn('斷線自動離開沒設好', e); } // 關掉 App、沒網路：伺服器幫你離開
    const cur = await r.get(`rooms/${code}/race`).catch(() => null);
    R.seq0 = cur && cur.seq ? cur.seq : 0; // 進來以前的比賽、出門不算
    G()?.net?.join({ code, me, host, name: myName() });
    G()?.net?.clock(r.now() - Date.now());
    const on = (p, cb) => R.offs.push(r.on(`rooms/${code}/${p}`, cb, (e) => console.warn('房間', p, e)));
    on('host', (h) => { if (!R) return; if (!h) { gone('房主把房間關掉了。'); return; } R.host = h; G()?.net?.host(h); paintAll(); });
    on('m', onMembers);
    on('p', (all) => { if (!R || !all) return; for (const [u, v] of Object.entries(all)) if (u !== R.me && v) G()?.net?.snap(u, v); });
    on('e', (all) => { if (!R || !all) return; for (const [u, v] of Object.entries(all)) { if (u === R.me || !v || !(v.t > (R.seen[u] || 0))) continue; R.seen[u] = v.t; if (r.now() - v.t < 15000) G()?.net?.emote(u, v.e | 0); } });
    on('race', onRace);
    if (r.conn) R.offs.push(r.conn((c) => { if (R) R.conn = c; }));
    R.sendT = setInterval(send, 125);
    R.clockT = setInterval(() => { if (R) G()?.net?.clock(r.now() - Date.now()); hostTick(); }, 2000);
    publish(true);
    UI().show('room');
  }
  function gone(why) { // 房間不見了（房主關掉了）、被拿掉了
    const was = !!R; stop();
    if (was) { errMsg = why || ''; if (UI().view === 'room' || UI().view === 'race') UI().show('menu'); else if (why) UI().show('menu'); }
  }
  function stop() {
    if (!R) return;
    clearInterval(R.sendT); clearInterval(R.clockT);
    for (const f of R.offs) try { f && f(); } catch { /* 算了 */ }
    if (R.rOff) try { R.rOff(); } catch { /* 算了 */ }
    G()?.net?.leave();
    R = null; paintAll();
  }
  async function leave() {
    if (!R || busy) return;
    const r = rt, { code, me, slot, host } = R;
    stop();
    try {
      await r.discOff(`rooms/${code}`);
      if (host === me) await r.remove(`rooms/${code}`); // 房主離開＝關掉房間
      else await r.update(`rooms/${code}`, { [`s/${slot}`]: null, [`m/${me}`]: null, [`p/${me}`]: null, [`e/${me}`]: null });
    } catch (e) { console.warn('離開房間', e); }
    UI().show('menu');
  }
  function onMembers(all) {
    if (!R) return;
    const list = Object.entries(all || {}).filter(([, v]) => v && typeof v.n === 'string').map(([u, v]) => ({ uid: u, ...v })).sort((a, b) => (a.uid === R.host ? -1 : b.uid === R.host ? 1 : (a.j || 0) - (b.j || 0)));
    if (!list.some((m) => m.uid === R.me)) { gone('你已經不在房間裡了。'); return; }
    R.mem = list;
    G()?.net?.members(list.filter((m) => m.uid !== R.me));
    if (R.race) G()?.net?.race({ ...R.race, order: order() });
    hostTick(); paintAll();
  }
  const order = () => (R ? R.mem.map((m) => m.uid) : []);

  // ---- 位置：一秒 8 次（沒動就 1.5 秒一次、不在外面 3 秒一次）----
  const rd = (v, k) => Math.round(v * k) / k;
  function send() {
    if (!R || !R.conn || !rt || !G()?.net) return;
    const s = G().net.state(), now = performance.now();
    const o = { x: rd(s.x, 100), z: rd(s.z, 100), h: rd(s.h, 1000), v: rd(s.v, 10), o: s.o | 0, k: s.k };
    if (s.rp != null) { o.rp = s.rp; o.rs = s.rs; }
    const L = R.last, moved = !L || L.o !== o.o || L.k !== o.k || L.rs !== o.rs || Math.abs(L.x - o.x) > 0.05 || Math.abs(L.z - o.z) > 0.05 || Math.abs(L.h - o.h) > 0.01 || Math.abs(L.v - o.v) > 0.2 || L.rp !== o.rp;
    const gap = now - R.lastT;
    if (!(moved && gap > 110 || gap > (o.o ? 1500 : 3000))) return;
    o.t = rt.now(); R.last = o; R.lastT = now;
    rt.set(`rooms/${R.code}/p/${R.me}`, o).then(() => { S.sent++; }, (e) => console.warn('位置', e));
    if (s.k && s.k !== R.myCar) { // 換開別台：大家看到的車也換
      R.myCar = s.k; const lk = G().net.look();
      if (lk) rt.update(`rooms/${R.code}/m/${R.me}`, { car: String(lk.car).slice(0, 12), l: lk.l || null }).catch((e) => console.warn('換車', e));
    }
  }

  // ---- 一起出門、一起比賽 ----
  function onRace(r) {
    if (!R) return;
    if (!r || !r.seq || r.seq <= R.seq0) { R.race = null; return; }
    const isNew = !R.race || R.race.seq !== r.seq;
    R.race = { seq: r.seq, kind: String(r.kind || ''), go: +r.go || 0 };
    if (isNew) {
      R.raceAt = performance.now();
      if (R.rOff) { try { R.rOff(); } catch { /* 算了 */ } R.rOff = null; }
      if (r.kind !== 'out') {
        const seq = r.seq;
        R.rOff = rt.on(`rooms/${R.code}/r/${seq}`, (all) => {
          if (!R || !R.race || R.race.seq !== seq) return;
          R.res = all || {};
          const map = {}; for (const [u, v] of Object.entries(R.res)) if (v && typeof v.t === 'number') map[u] = v.t;
          G()?.net?.results(seq, map);
          hostTick();
        }, (e) => console.warn('成績', e));
        if (UI().view === 'room' || UI().view === 'race') UI().close(); // 看遊戲（倒數、起點）
      } else if (UI().view === 'room') UI().close();
    }
    G()?.net?.race({ ...R.race, order: order() });
    paintAll();
  }
  async function startRace(kind) {
    if (!R || R.host !== R.me || busy) return;
    busy = true; paintAll();
    try { await rt.set(`rooms/${R.code}/race`, { seq: Math.max(R.race ? R.race.seq : 0, R.seq0) + 1, kind, go: 0 }); }
    catch (e) { fail(e, '送不出去，等一下再試一次。'); }
    busy = false; paintAll();
  }
  // 房主：大家都準備好了（或等了 30 秒）→ 定出發時間（4.5 秒後）
  function hostTick() {
    if (!R || R.host !== R.me || !R.race || R.race.kind === 'out' || R.race.go || R.goT) return;
    const res = R.res || {}, all = R.mem.every((m) => res[m.uid]), late = performance.now() - R.raceAt > 30000, any = Object.keys(res).length > 0;
    if (!(all || late && any)) return;
    R.goT = R.race.seq;
    rt.update(`rooms/${R.code}/race`, { go: rt.now() + 4500 }).then(() => { if (R) R.goT = 0; }, (e) => { console.warn('出發時間', e); if (R) R.goT = 0; });
  }
  window.addEventListener('beau-net', (ev) => {
    const d = ev.detail || {}; if (!R || !rt) return;
    if (d.type === 'emote') rt.set(`rooms/${R.code}/e/${R.me}`, { e: d.e | 0, t: rt.now() }).catch((e) => console.warn('表情', e));
    else if (d.type === 'ready' && R.race && d.seq === R.race.seq) rt.set(`rooms/${R.code}/r/${d.seq}/${R.me}`, { t: 0 }).catch((e) => console.warn('準備好', e));
    else if (d.type === 'fin' && R.race && d.seq === R.race.seq && typeof d.t === 'number') rt.set(`rooms/${R.code}/r/${d.seq}/${R.me}`, { t: d.t }).catch((e) => console.warn('成績', e));
    else if (d.type === 'again' && R.race && R.race.kind !== 'out') startRace(R.race.kind);
    else if (d.type === 'room') UI().show('room');
  });

  // ---- 參觀車庫 ----
  async function publish(now) { // 自己的車庫給別人看（存檔一變就更新；一樣就不送）
    clearTimeout(pubT);
    if (!now) { pubT = setTimeout(() => publish(true), 8000); return; }
    const me = uid(), n = myName(); if (!me || !n || !G()?.net) return;
    const g = G().net.garage(), body = JSON.stringify([n, g]);
    if (body === pubLast) return;
    try { const r = await getRt(); await r.set(`garages/${me}`, { n: n.slice(0, 12), t: r.now(), cur: g.cur, cars: g.cars }); pubLast = body; } catch (e) { console.warn('車庫', e); }
  }
  window.addEventListener('beau-save', () => { if (uid() && myName() && (R || pubLast)) publish(false); });
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
  window.beauRoom = { visit, create, join, leave, startRace };

  // ---- 畫面 ----
  const ava = (name, col) => { const a = document.createElement('span'); a.className = 'ava'; a.style.background = col; a.textContent = [...(name || '?')][0] || '?'; return a; };
  function paintMenu() {
    const rb = $r('nwRoomBtn'), jb = $r('nwJoinBtn'), note = $r('nwMenuNote');
    if (!rb) return;
    if (R) { rb.replaceChildren('回到房間 ', Object.assign(document.createElement('b'), { textContent: R.code }), Object.assign(document.createElement('small'), { textContent: `${R.mem.length} 個人在裡面` })); }
    else rb.replaceChildren('開一個房間', Object.assign(document.createElement('small'), { textContent: busy ? '開房間中⋯' : '給朋友房間碼，他就能進來' }));
    rb.disabled = busy; jb.hidden = !!R;
    note.textContent = errMsg || '只有拿到房間碼的人才進得來，陌生人進不來。一個房間最多 4 個人。';
    note.classList.toggle('cl-err', !!errMsg); note.classList.toggle('cl-note', !errMsg);
  }
  function paintJoin() {
    const e = $r('nwJoinErr'); e.hidden = !errMsg; e.textContent = errMsg;
    $r('nwJoinOk').disabled = busy; $r('nwJoinOk').textContent = busy ? '進去中⋯' : '加入';
  }
  function paintRoom() {
    if (!R) return;
    const code = $r('nwCode'); if (code.textContent !== R.code) code.replaceChildren(...[...R.code].map((c) => Object.assign(document.createElement('span'), { textContent: c })));
    $r('nwWhoLbl').textContent = `在房間裡的人（${R.mem.length}/4）`;
    let ci = 0;
    $r('nwWho').replaceChildren(...R.mem.map((m) => {
      const li = document.createElement('li'), me = m.uid === R.me, col = me ? ME_COL : COLS[ci++ % COLS.length], nm = document.createElement('span');
      nm.className = 'nm'; nm.textContent = m.n;
      const tags = [me && '你', m.uid === R.host && '房主'].filter(Boolean);
      if (tags.length) nm.append(' ', Object.assign(document.createElement('small'), { textContent: `（${tags.join('，')}）` }));
      li.append(ava(m.n, col), nm);
      if (!me) { const b = document.createElement('button'); b.type = 'button'; b.textContent = '🚗 車庫'; b.addEventListener('click', () => visit(m.uid, m.n)); li.append(b); }
      return li;
    }));
    const host = R.host === R.me, e = $r('nwRoomErr');
    e.hidden = !errMsg; e.textContent = errMsg;
    $r('nwOut').hidden = !host; $r('nwRaceBtn').hidden = !host; $r('nwRoomNote').hidden = host;
    $r('nwOut').disabled = $r('nwRaceBtn').disabled = busy;
    $r('nwLeave').textContent = host ? '關掉房間（大家都會離開）' : '離開房間';
  }
  function paintVisit() {
    const list = $r('nwVisitList'), others = R ? R.mem.filter((m) => m.uid !== R.me) : [];
    let ci = 0;
    list.replaceChildren(...others.map((m) => { const li = document.createElement('li'), nm = document.createElement('span'), b = document.createElement('button'); nm.className = 'nm'; nm.textContent = m.n; b.type = 'button'; b.textContent = '看車庫'; b.disabled = busy; b.addEventListener('click', () => visit(m.uid, m.n)); li.append(ava(m.n, COLS[ci++ % COLS.length]), nm, b); return li; }));
    list.hidden = !others.length;
    $r('nwVisitNote').textContent = others.length ? '房間裡的朋友：' : '在房間裡，或在排行榜上點名字，就可以參觀別人的車庫。只能看，不能改，也不能拿走。';
    const e = $r('nwVisitErr'); e.hidden = !visitMsg; e.textContent = visitMsg;
  }
  function paintAll() { UI()?.paint(); }

  if ($r('nwRoom') && window.beauNetUI) {
    UI().add('menu', $r('nwMenu'), { title: '連線', paint: paintMenu });
    UI().add('join', $r('nwJoin'), { title: '加入房間', paint: paintJoin });
    UI().add('room', $r('nwRoom'), { title: () => (R && R.host === R.me ? '你的房間' : '房間'), paint: paintRoom });
    UI().add('race', $r('nwRace'), { title: '要比什麼？', paint: () => { for (const b of $r('nwRace').querySelectorAll('[data-k]')) b.disabled = busy; } });
    UI().add('visit', $r('nwVisit'), { title: '🚗 參觀車庫', paint: paintVisit });
    $r('nwRoomBtn').addEventListener('click', () => { errMsg = ''; if (R) UI().show('room'); else create(); });
    $r('nwJoinBtn').addEventListener('click', () => { errMsg = ''; $r('nwCodeIn').value = ''; UI().show('join'); setTimeout(() => $r('nwCodeIn').focus(), 50); });
    $r('nwJoinOk').addEventListener('click', () => join($r('nwCodeIn').value));
    $r('nwCodeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') join($r('nwCodeIn').value); });
    $r('nwCodeIn').addEventListener('input', (e) => { const v = e.target.value.toUpperCase(); if (v !== e.target.value) e.target.value = v; });
    $r('nwJoinBack').addEventListener('click', () => { errMsg = ''; UI().show('menu'); });
    $r('nwVisitBtn').addEventListener('click', () => { visitMsg = ''; UI().show('visit'); publish(true); });
    $r('nwVisitBack').addEventListener('click', () => UI().show('menu'));
    $r('nwOut').addEventListener('click', async () => { await startRace('out'); });
    $r('nwRaceBtn').addEventListener('click', () => { errMsg = ''; UI().show('race'); });
    $r('nwRaceBack').addEventListener('click', () => UI().show('room'));
    for (const b of $r('nwRace').querySelectorAll('[data-k]')) b.addEventListener('click', () => startRace(b.dataset.k));
    $r('nwLeave').addEventListener('click', leave);
    window.addEventListener('beau-user', () => { if (!uid()) { stop(); pubLast = ''; } });
    window.addEventListener('pagehide', () => { if (R && rt && R.host !== R.me) rt.update(`rooms/${R.code}`, { [`s/${R.slot}`]: null, [`m/${R.me}`]: null, [`p/${R.me}`]: null, [`e/${R.me}`]: null }).catch(() => {}); });
  }
}
