// ---- 登入＋雲端存檔（Nick 2026-10-09「要做登入功能 讓每個人資料存在雲端」→ 用 Google 帳號登入，不用密碼）：src/site/cloud.js，build-site.mjs 接在 site.js 後面 ----
// Firebase 專案 beau-car-game（Nick 的）：Authentication（Google）＋ Firestore 的 saves/{uid}（規則：只能讀寫自己的那一份）
//   saves/{uid} ＝ { v: 1, t: 存的時間（毫秒）, keys: { 'carid.tune': 原封不動的字串, … 跟搬家一樣那 6 個 key }, sum: { money, cars, cups } }
// 這支手機記著 beau.cloud ＝ { uid, email, h：上一次跟雲端一樣的時候 carid.tune 的雜湊 }：用來判斷「誰改過」
//   登入（或打開遊戲的時候已經登入）→ 讀雲端：
//     雲端沒有 → 把這支手機的存上去；一樣 → 不用動；這支手機沒有存檔、或這支手機從上次之後沒改過 → 用雲端的（寫進去、重新載入）
//     雲端從上次之後沒改過 → 存上去；兩邊都改過（或第一次在這支手機登入）→ 問「要用哪一個進度？」
//   之後遊戲每存一次（garage.src.html 的 save() 發 'beau-save'）→ 2.5 秒後存到雲端；沒有網路就記著，有網路、切回來的時候再存
// Firebase 的程式（gstatic 上的）登入過或按了登入才下載；App（BeauCarApp）裡面 Google 不給用網頁登入：外殼 BeauCarApp.googleSignIn() 用手機上的帳號登入，
//   拿到的 ID token 交回 window.beauGoogleSignIn(idToken, error)，再給 Firebase（舊版外殼沒有這個 → 請他更新 App）
// 測試：window.__beauCloudBackend ＝ 假的雲端（跟 firebaseBackend() 一樣的介面），window.__beauCloud 看狀態
{
  const FIREBASE = {
    apiKey: 'AIzaSyAS55MsRleb9F78AmvS_M7jYEtILG4jeMc', // 網頁的 Firebase 設定本來就是公開的（安全靠 Firestore 的規則）
    authDomain: 'beau-car-game.firebaseapp.com',
    projectId: 'beau-car-game',
    storageBucket: 'beau-car-game.firebasestorage.app',
    messagingSenderId: '793707590323',
    appId: '1:793707590323:web:3a8470065243651dd4f6c6',
  };
  const FB = 'https://www.gstatic.com/firebasejs/10.14.1/';
  // 即時資料庫（Realtime Database）：一起開車、一起比賽、參觀車庫（site/room.js）；規則在 notes/room.md（家長貼到 Firebase 主控台）
  const RTDB_URL = 'https://beau-car-game-default-rtdb.asia-southeast1.firebasedatabase.app';
  const KEYS = ['carid.tune', 'carid.tune.full', 'carid.sound', 'carid.roomq', 'carid.theme', 'carid.accent']; // 跟搬家一樣
  const META = 'beau.cloud', MAX = 512 * 1024, SAVE_DELAY = 2500;
  const $c = (id) => document.getElementById(id);
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* 不給存就算了 */ } };
  const hash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0') + ':' + s.length; };
  const inApp = () => /BeauCarApp\//.test(navigator.userAgent || '');

  async function firebaseBackend() {
    const [{ initializeApp }, A, F] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore-lite.js')]);
    const app = initializeApp(FIREBASE);
    const auth = A.initializeAuth(app, { persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence], popupRedirectResolver: A.browserPopupRedirectResolver });
    const db = F.getFirestore(app), ref = (uid) => F.doc(db, 'saves', uid);
    let rtP = null;
    return {
      // 即時資料庫：第一次用（開房間、加入、參觀車庫）才下載；路徑都是 'rooms/K7Q2/p/<uid>' 這種字串
      rt: () => (rtP ||= import(FB + 'firebase-database.js').then((D) => {
        const rdb = D.getDatabase(app, RTDB_URL), R = (p) => D.ref(rdb, p);
        let off = 0; D.onValue(R('.info/serverTimeOffset'), (s) => { off = +s.val() || 0; });
        return {
          get: async (p) => (await D.get(R(p))).val(),
          set: (p, v) => D.set(R(p), v),
          update: (p, v) => D.update(R(p), v),
          remove: (p) => D.remove(R(p)),
          on: (p, cb, fail) => D.onValue(R(p), (s) => cb(s.val()), fail),
          disc: (p, v) => (v == null ? D.onDisconnect(R(p)).remove() : D.onDisconnect(R(p)).update(v)),
          discOff: (p) => D.onDisconnect(R(p)).cancel(),
          conn: (cb) => D.onValue(R('.info/connected'), (s) => cb(!!s.val())),
          now: () => Date.now() + off,
          stamp: D.serverTimestamp,
        };
      }).catch((e) => { rtP = null; throw e; })),
      onUser: (cb) => A.onAuthStateChanged(auth, cb),
      popup: () => A.signInWithPopup(auth, new A.GoogleAuthProvider()),
      token: (idToken) => A.signInWithCredential(auth, A.GoogleAuthProvider.credential(idToken)),
      out: () => A.signOut(auth),
      get: async (uid) => { const s = await F.getDoc(ref(uid)); return s.exists() ? s.data() : null; },
      put: (uid, data) => F.setDoc(ref(uid), data),
      // 連線（site/online.js）：名字 players/{uid}；排行榜 lb/{板}/runs/{uid}（名字、車、秒數）＋ lb/{板}/ghosts/{uid}（鬼影車）
      nameGet: async (uid) => { const s = await F.getDoc(F.doc(db, 'players', uid)); return s.exists() ? s.data().name || null : null; },
      namePut: (uid, name) => F.setDoc(F.doc(db, 'players', uid), { name, t: Date.now() }),
      lbTop: async (b, n) => (await F.getDocs(F.query(F.collection(db, 'lb', b, 'runs'), F.orderBy('t'), F.limit(n)))).docs.map((d) => ({ uid: d.id, ...d.data() })),
      lbRank: async (b, t) => (await F.getCount(F.query(F.collection(db, 'lb', b, 'runs'), F.where('t', '<', t)))).data().count + 1,
      lbGet: async (b, uid) => { const s = await F.getDoc(F.doc(db, 'lb', b, 'runs', uid)); return s.exists() ? s.data() : null; },
      lbPut: (b, uid, run, ghost) => { const w = F.writeBatch(db); w.set(F.doc(db, 'lb', b, 'runs', uid), { ...run, at: F.serverTimestamp() }); w.set(F.doc(db, 'lb', b, 'ghosts', uid), ghost); return w.commit(); },
      lbName: (b, uid, name) => { const w = F.writeBatch(db); w.update(F.doc(db, 'lb', b, 'runs', uid), { name }); w.update(F.doc(db, 'lb', b, 'ghosts', uid), { name }); return w.commit(); },
      ghostGet: async (b, uid) => { const s = await F.getDoc(F.doc(db, 'lb', b, 'ghosts', uid)); return s.exists() ? s.data() : null; },
    };
  }

  // ---- 狀態 ----
  let be = null, loading = null, user = null, meta = null, picking = null, saveT = 0, dirty = false, busy = false, status = '', err = '';
  try { meta = JSON.parse(get(META) || 'null'); if (!meta || typeof meta.uid !== 'string') meta = null; } catch { meta = null; }
  const setMeta = (m) => { meta = m; set(META, m ? JSON.stringify(m) : null); };
  const S = (window.__beauCloud = { get user() { return user; }, get meta() { return meta; }, get status() { return status; }, get picking() { return !!picking; }, get dirty() { return dirty; }, uploads: 0, applied: 0 });

  function summary(tune) {
    let d = null; try { d = JSON.parse(tune || 'null'); } catch { d = null; }
    if (!d || typeof d !== 'object') return { money: 0, cars: 0, cups: 0 };
    return { money: Math.max(0, Math.floor(+d.money || 0)), cars: Array.isArray(d.owned) ? d.owned.length : 0, cups: Object.values(d.wins || {}).filter((n) => +n > 0).length };
  }
  const sumText = (s, t) => `NT$ ${s.money.toLocaleString('zh-TW')} 萬\n車 ${s.cars} 台 · 獎盃 ${s.cups} 個${t ? '\n' + t : ''}`;
  const when = (ms) => { if (!ms) return ''; const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 存的`; };
  function okKeys(keys) { // 雲端拿下來的：跟搬家一樣檢查
    if (!keys || typeof keys !== 'object') return null;
    const out = {};
    for (const k of KEYS) { const v = keys[k]; if (v == null) continue; if (typeof v !== 'string' || v.length > MAX) return null; out[k] = v; }
    let d; try { d = JSON.parse(out['carid.tune'] || 'null'); } catch { return null; }
    return d && typeof d === 'object' && !Array.isArray(d) && typeof d.v === 'number' ? out : null;
  }

  // ---- 畫面 ----
  const chip = $c('cloudChip'), chipTxt = $c('cloudChipTxt'), dlg = $c('cloudDlg'), title = $c('cloudTitle');
  const secIn = $c('clIn'), secAcct = $c('clAcct'), secPick = $c('clPick'), errEl = $c('clErr');
  let view = null; // 'in' | 'acct' | 'pick' | null（關著）
  function paint() {
    if (!chip) return;
    chip.hidden = false;
    chip.classList.toggle('on', !!user);
    chipTxt.textContent = user ? '已登入' : (meta && !user && loading ? '登入中⋯' : '☁ 登入');
    if (!dlg) return;
    dlg.hidden = !view;
    if (!view) return;
    secIn.hidden = view !== 'in'; secAcct.hidden = view !== 'acct'; secPick.hidden = view !== 'pick';
    title.textContent = view === 'in' ? '登入' : view === 'acct' ? '帳號' : '要用哪一個進度？';
    $c('cloudX').hidden = view === 'pick'; // 選進度一定要選一個
    $c('clGoogle').disabled = busy; $c('clGoogle').textContent = busy ? '登入中⋯' : '用 Google 帳號登入';
    errEl.hidden = !err; errEl.textContent = err;
    if (user) {
      $c('clEmail').textContent = user.email || user.displayName || '';
      $c('clAva').textContent = ((user.displayName || user.email || '?').trim()[0] || '?').toUpperCase();
      $c('clStatus').textContent = '雲端存檔：' + (status || '讀取中⋯');
      $c('clStatusDot').className = 'cl-dot ' + (dirty ? 'warn' : status === '剛剛存好了' || status === '跟雲端一樣' ? 'ok' : '');
    }
    if (picking) {
      $c('clCloudSum').textContent = sumText(summary(picking.keys['carid.tune']), when(picking.t));
      $c('clLocalSum').textContent = sumText(summary(get('carid.tune')), '這支手機現在的');
    }
  }
  const open = (v) => { view = v; err = ''; paint(); };
  const close = () => { if (view === 'pick') return; view = null; paint(); };

  // ---- 雲端 ----
  function load() {
    if (be) return Promise.resolve(be);
    if (!loading) {
      loading = (window.__beauCloudBackend ? Promise.resolve(window.__beauCloudBackend()) : firebaseBackend()).then((b) => { be = b; be.onUser(onUser); return b; });
      loading.catch(() => { loading = null; paint(); });
      paint();
    }
    return loading;
  }
  function onUser(u) {
    if (u) {
      const first = !user || user.uid !== u.uid;
      user = { uid: u.uid, email: u.email || '', displayName: u.displayName || '' };
      if (view === 'in') view = null;
      paint(); userEv();
      if (first) sync();
    } else {
      user = null; picking = null; status = ''; dirty = false;
      if (meta) setMeta(null); // 登入過期了，或是登出
      if (view === 'acct' || view === 'pick') view = null;
      paint(); userEv();
    }
  }
  const userEv = () => { try { window.dispatchEvent(new Event('beau-user')); } catch { /* 沒有人聽就算了 */ } }; // 連線（site/online.js）聽這個
  async function sync() {
    const u = user; if (!u) return;
    status = '讀取中⋯'; paint();
    let docu;
    try { docu = await be.get(u.uid); } catch { status = '連不到雲端，有網路再試'; dirty = true; paint(); return; }
    if (user !== u) return;
    const local = get('carid.tune'), lh = local ? hash(local) : null;
    const keys = docu ? okKeys(docu.keys) : null, ct = keys ? keys['carid.tune'] : null, ch = ct ? hash(ct) : null;
    const mh = meta && meta.uid === u.uid ? meta.h : null;
    if (!ch) { if (local) await upload(true); else { setMeta({ uid: u.uid, email: u.email, h: null }); status = '還沒有存檔'; paint(); } return; }
    if (ch === lh) { setMeta({ uid: u.uid, email: u.email, h: lh }); status = '跟雲端一樣'; paint(); return; }
    if (!local || (mh && lh === mh)) { apply(keys, ch); return; }
    if (mh && ch === mh) { await upload(true); return; }
    picking = { keys, t: +docu.t || 0, h: ch }; view = 'pick'; paint(); // 兩邊都改過、或第一次在這支手機登入：問
  }
  function apply(keys, h) { // 用雲端的：寫進這支手機、重新載入（跟搬家一樣，重新載入以前遊戲不能再存）
    setMeta({ uid: user.uid, email: user.email, h });
    for (const k of KEYS) set(k, keys[k] ?? null);
    S.applied++;
    if (window.__beauCloudNoReload) return;
    try { Storage.prototype.setItem = function () {}; } catch { /* 擋不住就算了 */ }
    location.replace(location.pathname + location.search);
  }
  async function upload(force) {
    clearTimeout(saveT); saveT = 0;
    const u = user; if (!u || picking) return;
    const tune = get('carid.tune'); if (!tune || tune.length > MAX) return;
    if (!force && !dirty && meta && meta.uid === u.uid && meta.h === hash(tune)) return; // 跟上次存上去的一樣：不用再存（省雲端的次數）
    const keys = {}; for (const k of KEYS) { const v = get(k); if (v != null && v.length <= MAX) keys[k] = v; }
    status = '存檔中⋯'; paint();
    try {
      await be.put(u.uid, { v: 1, t: Date.now(), keys, sum: summary(tune) });
    } catch { if (user === u) { dirty = true; status = navigator.onLine === false ? '沒有網路，有網路再存' : '存不進去，等一下再試'; paint(); } return; }
    S.uploads++;
    if (user !== u) return;
    dirty = false; status = '剛剛存好了';
    setMeta({ uid: u.uid, email: u.email, h: hash(tune) });
    paint();
  }
  const soon = () => { if (!user || picking) return; clearTimeout(saveT); saveT = setTimeout(upload, SAVE_DELAY); };
  const flush = () => { if (user && !picking && (saveT || dirty)) { if (dirty && status.startsWith('連不到')) sync(); else upload(); } };
  window.addEventListener('beau-save', soon);
  window.addEventListener('online', () => { if (meta && !be && !loading) load().catch(() => {}); else flush(); });
  document.addEventListener('visibilitychange', flush); // 切走的時候把還沒存的存上去；切回來的時候補存

  // ---- 登入 ----
  let tokenWait = null;
  window.beauGoogleSignIn = (idToken, e) => { const w = tokenWait; tokenWait = null; if (w) w(idToken ? { idToken } : { error: e || 'cancel' }); };
  async function login() {
    if (busy) return;
    err = ''; busy = true; paint();
    try {
      await load();
      if (inApp()) {
        const shell = window.BeauCarApp;
        if (!shell || typeof shell.googleSignIn !== 'function') { err = '要先更新 App 才能登入（按上面的「App 有新版本／下載安裝」）。也可以用手機的瀏覽器打開遊戲網站登入。'; return; }
        const r = await new Promise((res) => { tokenWait = res; try { shell.googleSignIn(); } catch { tokenWait = null; res({ error: 'fail' }); } });
        if (r.error) { if (r.error !== 'cancel') err = r.error === 'nonet' ? '沒有網路，連上網路再試一次。' : r.error === 'noacct' ? '這支手機還沒有 Google 帳號：先到手機的「設定」加一個，再回來登入。' : '登入失敗了，再試一次。'; return; }
        await be.token(r.idToken);
      } else await be.popup();
    } catch (e) {
      const c = (e && e.code) || '';
      if (!be) err = '連不到雲端，等一下再試。';
      else if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request' || c === 'auth/user-cancelled') err = '';
      else if (c === 'auth/popup-blocked') err = '瀏覽器擋住了登入的視窗，再按一次試試看。';
      else if (c === 'auth/network-request-failed') err = '沒有網路，連上網路再試一次。';
      else if (c === 'auth/unauthorized-domain') err = '這個網址還不能登入（要加到 Firebase 的授權網域）。';
      else err = '登入失敗了，再試一次。' + (c ? `（${c}）` : '');
    } finally { busy = false; paint(); }
  }
  async function logout() {
    clearTimeout(saveT); saveT = 0;
    try { if (be) await be.out(); } catch { /* 登出失敗：這支手機這邊還是當作登出 */ }
    user = null; picking = null; status = ''; dirty = false; setMeta(null); view = null; paint(); userEv();
  }
  // 連線（site/online.js）用的：同一個雲端、同一個登入
  window.beauCloud = { get user() { return user; }, backend: () => load(), login: async () => { await login(); return err; } };

  if (chip && dlg) {
    chip.addEventListener('click', () => open(user ? 'acct' : 'in'));
    $c('cloudX').addEventListener('click', close);
    $c('clLater').addEventListener('click', close);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    $c('clGoogle').addEventListener('click', login);
    $c('clOut').addEventListener('click', logout);
    $c('clUseCloud').addEventListener('click', () => { const p = picking; if (!p) return; picking = null; view = null; apply(p.keys, p.h); paint(); });
    $c('clUseLocal').addEventListener('click', () => { if (!picking) return; picking = null; view = null; paint(); upload(true); });
    paint();
    if (meta) load().catch(() => { /* 沒有網路：下次再登入 */ }); // 登入過：背景接上雲端（Firebase 自己記得登入）
  }
}
