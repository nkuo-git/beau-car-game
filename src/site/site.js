
// ---- 改車遊戲（獨立的網站 https://nkuo-git.github.io/beau-car-game/ 和它的 APK）才有的：src/site/site.js，build-site.mjs 接在 game.js 最後 ----
// 包在一個區塊裡：跟上面整個遊戲同一個 module，名字不能撞到
{
  const GAME_BUILD = __V__; // 網頁內容的版號（build-site.mjs 填；跟 sw.js 的 CACHE、index.html 的 ?v= 一樣）
  const TRY_PAGE = __TRY__; // 試玩頁（docs/try/，build-site.mjs --try）：標題寫「試玩」、不裝 Service Worker（正式網站的 sw.js 管整個網站，試玩頁不要搶）
  const $id = (id) => document.getElementById(id);
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* 不給存就算了 */ } };
  // App（APK）的外殼：User-Agent 帶 BeauCarApp/<版號>（＝GitHub Release 的 apk-<版號>），網頁才知道自己跑在哪一版的 App 裡
  const apkBuild = () => { const m = /BeauCarApp\/(\d+)/.exec(navigator.userAgent || ''); return m ? Number(m[1]) : null; };

  // ---- 標題旁的版本號：0.App.內容（不在 App 裡＝一般瀏覽器，App 算 0）----
  const ver = $id('brandVer');
  if (ver) ver.textContent = '0.' + (apkBuild() ?? 0) + '.' + GAME_BUILD + (TRY_PAGE ? ' 試玩' : '');

  // ---- 有新版本的那一條（跟萬能軟體一樣：一次只跳一條、不自己更新，按了才換）----
  // App 有新版 → 「App 有新版本／下載安裝」（新的 App 自己下載、跳出安裝；舊的 App 開 GitHub 上的 .apk）；只有內容有新版 → 「有新版本，要更新嗎／更新」
  const APK_API = 'https://api.github.com/repos/nkuo-git/beau-car-game/releases/latest';
  const APK_NEW = 'beaucar.apknew', APK_SEEN = 'beaucar.apkcheck';
  let webWaiting = false, apkNew = null, apkAsking = false;
  try {
    const saved = JSON.parse(lsGet(APK_NEW) || 'null'), mine = apkBuild();
    if (saved && mine !== null && saved.n > mine && /\.apk$/i.test(saved.url || '')) apkNew = saved;
    else if (saved) lsSet(APK_NEW, null); // 已經裝好了
  } catch { lsSet(APK_NEW, null); }
  function paintUpdate() {
    const appBar = $id('appUpdateBar'), link = $id('appUpdateLink'), webBar = $id('updateBar');
    if (link && apkNew) link.href = apkNew.url;
    if (appBar) appBar.hidden = !apkNew;
    if (webBar) webBar.hidden = !webWaiting || !!apkNew;
  }
  paintUpdate();
  // 新的 App（2026-10-10 之後編的）會自己下載、跳出安裝（BeauCarApp.installApk）：按「下載安裝」不再打開 GitHub。舊的 App 照舊開連結
  // App 回報進度：window.beauApkProgress(百分比, 狀態)；狀態 'dl' 下載中、'install' 跳出安裝了、'perm' 去設定允許安裝、'denied' 沒允許、'fail' 失敗
  const APK_MSG = { install: '按「安裝」就好', perm: '打開「允許安裝應用程式」，再按返回', denied: '沒有允許安裝，再按一次', fail: '下載失敗，再按一次' };
  let apkBusy = false;
  function apkText(t, btnOn) {
    const txt = document.querySelector('#appUpdateBar .txt'), link = $id('appUpdateLink');
    if (txt) txt.textContent = t;
    if (link) { link.toggleAttribute('aria-disabled', !btnOn); link.style.visibility = btnOn ? '' : 'hidden'; }
  }
  window.beauApkProgress = (pct, st) => {
    if (st === 'dl') { apkBusy = true; apkText('下載新版本⋯ ' + Math.max(0, Math.min(100, Math.round(Number(pct) || 0))) + '%', false); return; }
    apkBusy = st === 'install' || st === 'perm';
    apkText(APK_MSG[st] || 'App 有新版本', !apkBusy);
  };
  $id('appUpdateLink')?.addEventListener('click', (e) => {
    const app = window.BeauCarApp;
    if (!app || typeof app.installApk !== 'function' || !apkNew) return; // 舊的 App：照舊打開連結
    e.preventDefault();
    if (apkBusy) return;
    apkBusy = true; apkText('下載新版本⋯ 0%', false);
    try { app.installApk(apkNew.url); } catch { window.beauApkProgress(0, 'fail'); }
  });
  async function checkAppUpdate() {
    const mine = apkBuild();
    if (mine === null || apkAsking) return; // 不在 App 裡不用查
    if (Date.now() - Number(lsGet(APK_SEEN) || 0) < 60 * 60 * 1000) return; // 一小時查一次（GitHub 的匿名 API 有次數限制）
    let latest;
    apkAsking = true;
    try {
      const res = await fetch(APK_API, { cache: 'no-cache', headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) return;
      latest = await res.json();
    } catch { return; } finally { apkAsking = false; }
    lsSet(APK_SEEN, String(Date.now()));
    const tag = /^apk-(\d+)$/.exec(latest?.tag_name || '');
    if (!tag) return;
    const n = Number(tag[1]);
    if (n <= mine) apkNew = null;
    else {
      const apk = (latest.assets || []).find((a) => /\.apk$/i.test(a.name || ''));
      if (!apk?.browser_download_url) return; // Release 還在上傳，下次再看
      apkNew = { n, url: apk.browser_download_url };
    }
    lsSet(APK_NEW, apkNew ? JSON.stringify(apkNew) : null);
    paintUpdate();
  }
  if ('serviceWorker' in navigator && !TRY_PAGE) {
    const start = async () => {
      const appChecked = checkAppUpdate().catch(() => {});
      let reg;
      try { reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }); } catch { return; }
      if (!reg) return;
      const btn = $id('updateBtn'), hadController = !!navigator.serviceWorker.controller;
      let reloading = false, applied = false;
      const apply = () => { if (!reg.waiting) return; applied = true; if (btn) { btn.disabled = true; btn.textContent = '更新中⋯'; } reg.waiting.postMessage({ type: 'SKIP_WAITING' }); };
      const offer = () => { if (!reg.waiting || !navigator.serviceWorker.controller) return; webWaiting = true; paintUpdate(); }; // 第一次安裝不用問
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading || !(applied || hadController)) return; reloading = true; location.reload(); });
      if (btn) btn.addEventListener('click', apply);
      reg.addEventListener('updatefound', () => { const f = reg.installing; if (f) f.addEventListener('statechange', () => { if (f.state === 'installed') offer(); }); });
      let checkedAt = 0;
      const check = () => { const now = Date.now(); if (now - checkedAt < 60000) return; checkedAt = now; reg.update().catch(() => {}); checkAppUpdate(); };
      await Promise.race([appChecked, new Promise((r) => setTimeout(r, 2000))]); // App 那條先問（最多等兩秒），有的話只跳 App 那條
      offer();
      check();
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
      window.addEventListener('focus', check);
      setInterval(() => { if (!document.hidden) check(); }, 5 * 60 * 1000); // 一直開著也會知道有新版
    };
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
  } else checkAppUpdate();

  // ---- 從萬能軟體搬進度過來 ----
  // 格式（萬能軟體那邊的「搬家」要照這個做，見 CLAUDE.md）：base64url( UTF-8 JSON {"v":1,"from":"carid-pwa","keys":{"carid.tune":"…", …}} )
  //   keys 的值＝萬能軟體 localStorage 裡原封不動的字串；只認 IMPORT_KEYS 這幾個，其他的不管；一定要有 carid.tune（而且是存檔 JSON）
  // 進來的路：App 的外殼收到 beaucargame://import?save=… → window.beauImport(save)；測試用：網址 #import=…
  // 先問「要把萬能軟體裡的進度搬過來嗎？」→ 搬過來：清掉這裡的這幾個 key、寫進去、重新載入；不要：什麼都不改
  const IMPORT_KEYS = ['carid.tune', 'carid.tune.full', 'carid.sound', 'carid.roomq', 'carid.theme', 'carid.accent'];
  const MAX_SAVE = 512 * 1024;
  function decodeSave(s) {
    s = String(s || '').trim().replace(/=+$/, '');
    if (!s || s.length > MAX_SAVE * 1.4 || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
    let d;
    try {
      const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
      d = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    } catch { return null; }
    if (!d || typeof d !== 'object' || d.v !== 1 || !d.keys || typeof d.keys !== 'object' || Array.isArray(d.keys)) return null;
    const keys = {};
    for (const k of IMPORT_KEYS) {
      const v = d.keys[k];
      if (v == null) continue;
      if (typeof v !== 'string' || v.length > MAX_SAVE) return null;
      keys[k] = v;
    }
    let save;
    try { save = JSON.parse(keys['carid.tune'] || 'null'); } catch { return null; }
    if (!save || typeof save !== 'object' || Array.isArray(save) || typeof save.v !== 'number') return null;
    return keys;
  }
  const dlg = $id('impDlg'), msg = $id('impMsg'), yes = $id('impYes'), no = $id('impNo'), ASK = msg ? msg.textContent : '';
  let pending = null;
  function ask(keys) {
    pending = keys;
    if (!dlg) return;
    msg.textContent = keys ? ASK : '搬家的資料看不懂，沒有搬。';
    yes.hidden = !keys; no.textContent = keys ? '不要' : '好';
    dlg.hidden = false;
    (keys ? yes : no).focus?.();
  }
  if (no) no.addEventListener('click', () => { pending = null; dlg.hidden = true; });
  if (yes) yes.addEventListener('click', () => {
    const keys = pending; if (!keys) return;
    yes.disabled = no.disabled = true;
    for (const k of IMPORT_KEYS) lsSet(k, keys[k] ?? null);
    try { Storage.prototype.setItem = function () {}; } catch { /* 擋不住就算了 */ } // 重新載入以前遊戲不能再存（不然會蓋回去）
    location.replace(location.pathname + location.search);
  });
  window.beauImport = (s) => { const keys = decodeSave(s); ask(keys); return !!keys; };
  const hm = /^#import=([A-Za-z0-9_-]+=*)$/.exec(location.hash);
  if (hm) { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* 改不了網址就算了 */ } window.beauImport(hm[1]); }

  // 告訴 App 的外殼：網頁準備好了，可以把搬家的連結交過來（舊版外殼沒有就算了）
  try { window.BeauCarApp?.ready?.(); } catch { /* 外殼沒有就算了 */ }
}
