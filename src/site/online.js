// ---- 連線第 1 步：鬼影車排行榜（Nick 2026-10-10「開始做吧」；草稿 https://claude.ai/artifact/6BtzWH7D5uWYMCra2e7DJo 第 1、2、7、8 張，Nick 和爸媽都說好）----
// src/site/online.js，build-site.mjs 接在 cloud.js 後面（用 cloud.js 的 window.beauCloud：同一個 Firebase、同一個登入）
// 右上角「👥 連線」→ 沒登入：要先登入 → 第一次：取一個名字（別人只看得到這個；不能有髒話、email、電話）→ 連線選單（🏆 排行榜；其他的還在做）
// 排行榜：400 公尺／賽車場一圈／爬山 × 大家／同一台車（現在開的這台），前 20 名，你那一行框起來（不在前 20 名也列出你第幾名）
//   「👻 跟第 1 名的鬼影車跑」→ 下載那一趟 → window.beauGame.setGhost（ghost.src.js）→ 下一次跑那一種的時候多一台半透明的車
// 上傳：遊戲每跑完一趟發 'beau-run'（{ board, car, t, g }）→ 先記在這支手機（beau.lbq：每一種每台車最好的那趟）→ 登入、有名字了就傳：
//   比雲端上自己的好才寫（lb/<板>-<車> 和 lb/<板> 兩份；規則也擋：只能寫自己的、只能變快）
// Firestore（規則要 Nick 貼到 Firebase 主控台，見 notes/online.md）：
//   players/{uid} ＝ { name, t }；lb/{板}/runs/{uid} ＝ { name, car, t, at }；lb/{板}/ghosts/{uid} ＝ { name, car, t, hz, c, n, s, d }
//   板 ＝ drag|lap|hill（大家：每個人最好的一趟，不管哪台車）或 drag-gc8…（同一台車）
// 測試：cloud.js 的 window.__beauCloudBackend（假的雲端）也要有 nameGet／namePut／lbTop／lbRank／lbGet／lbPut／lbName／ghostGet；window.__beauNet 看狀態
{
  const BOARDS = ['drag', 'lap', 'hill'], QK = 'beau.lbq', TOP = 20;
  const $n = (id) => document.getElementById(id);
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* 不給存就算了 */ } };
  const lsJson = (k) => { try { const v = JSON.parse(lsGet(k) || 'null'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
  const fmt = (b, t) => (b === 'drag' ? t.toFixed(2) : `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`);
  const carName = (k) => { try { return (window.beauGame && window.beauGame.cars()[k]) || String(k).toUpperCase(); } catch { return String(k).toUpperCase(); } };
  const curCar = () => { try { return (window.beauGame && window.beauGame.cur) || 'gc8'; } catch { return 'gc8'; } };
  const C = () => window.beauCloud;
  const uid = () => (C() && C().user ? C().user.uid : null);

  // ---- 名字：2–10 個字；不能有髒話、email、網址、電話 ----
  const BAD = ['幹', '操你', '操他', '靠北', '靠杯', '靠腰', '雞掰', '機掰', '雞巴', '白癡', '白痴', '智障', '王八', '去死', '媽的', '他媽', '你媽', '賤', '婊', '屁眼', '肏', '屌',
    'fuck', 'fuk', 'shit', 'bitch', 'dick', 'cunt', 'sex', 'porn', 'nigg', 'damn', 'penis', 'vagina', 'asshole', 'bastard', 'wtf', 'stfu'];
  function nameErr(s) {
    const t = s.trim().replace(/\s+/g, ' ');
    if ([...t].length < 2) return '名字至少要 2 個字。';
    if ([...t].length > 10) return '名字最多 10 個字。';
    if (/@|https?:|www\.|\.(com|net|org|tw)\b/i.test(t)) return '名字裡不要放 email 或網址。';
    if (/\d{6,}/.test(t.replace(/[\s-]/g, ''))) return '名字裡不要放電話號碼。';
    if (!/^[\p{L}\p{N} _\-·.]+$/u.test(t)) return '名字只能用字、數字、空格。';
    const norm = t.toLowerCase().replace(/[\s_\-·.0-9]/g, '');
    if (BAD.some((w) => norm.includes(w))) return '名字裡不能有髒話，換一個吧。';
    return '';
  }

  // ---- 狀態 ----
  let view = null, name = null, nameFor = null, busy = false, tab = 'drag', filt = 'all', rows = [], mine = null, boardKey = '', boardErr = '', boardBusy = false, ghostMsg = '', flushing = false;
  const best = {}; // 這次打開以後知道的：雲端上自己的秒數（板 → 秒，null＝沒有）
  const S = (window.__beauNet = { get view() { return view; }, get name() { return name; }, get rows() { return rows; }, get mine() { return mine; }, get queue() { return lsJson(QK); }, uploads: 0, fetches: 0 });

  // ---- 畫面 ----
  const chip = $n('netChip'), dlg = $n('netDlg'), titleEl = $n('netTitle');
  const SECS = { in: $n('nwIn'), name: $n('nwName'), menu: $n('nwMenu'), board: $n('nwBoard') };
  function paint() {
    if (!chip || !dlg) return;
    chip.hidden = false;
    dlg.hidden = !view;
    if (!view) return;
    for (const [k, el] of Object.entries(SECS)) el.hidden = k !== view;
    titleEl.textContent = view === 'in' ? '連線' : view === 'name' ? '取一個名字' : view === 'menu' ? '連線' : '🏆 排行榜';
    if (view === 'menu') $n('nwMyName').textContent = name || '';
    if (view === 'board') paintBoard();
  }
  function paintBoard() {
    for (const b of $n('nwTabs').children) b.setAttribute('aria-selected', String(b.dataset.b === tab));
    for (const b of $n('nwFilt').children) b.setAttribute('aria-selected', String(b.dataset.f === filt));
    $n('nwFiltCar').textContent = `同一台車（${carName(curCar())}）`;
    const list = $n('nwList'), mineEl = $n('nwMine'), me = uid();
    list.replaceChildren(); mineEl.replaceChildren();
    const row = (n, r, to = list) => {
      const li = document.createElement('li'), a = document.createElement('span'), w = document.createElement('span'), t = document.createElement('span');
      a.className = 'n'; w.className = 'w'; t.className = 't';
      a.textContent = String(n); w.textContent = `${r.name} · ${carName(r.car)}`; t.textContent = fmt(tab, r.t);
      if (r.uid === me) li.className = 'me';
      li.append(a, w, t); to.append(li);
    };
    rows.forEach((r, i) => row(i + 1, r));
    const below = !!mine && !rows.some((r) => r.uid === me); // 不在前 20 名：你那一行放在捲的那一塊下面（一直看得到）
    mineEl.hidden = !below;
    if (below) { const g = document.createElement('li'); g.className = 'gap'; g.textContent = '⋮'; mineEl.append(g); row(mine.rank, mine, mineEl); }
    const empty = $n('nwEmpty');
    empty.hidden = !(boardErr || (!boardBusy && !rows.length));
    empty.textContent = boardErr || (filt === 'car' ? `還沒有人開 ${carName(curCar())} 跑過。你跑一趟就是第 1 名！` : '還沒有人跑過。你跑一趟就是第 1 名！');
    if (boardBusy && !rows.length) { empty.hidden = false; empty.textContent = '讀取中⋯'; }
    const gb = $n('nwGhost'), top = rows[0];
    gb.disabled = !top || busy || !window.beauGame;
    gb.textContent = top && top.uid === me ? '👻 跟自己的鬼影車跑' : '👻 跟第 1 名的鬼影車跑';
    const gm = $n('nwGhostMsg'); gm.hidden = !ghostMsg; gm.textContent = ghostMsg;
  }
  const close = () => { view = null; paint(); };
  async function open() {
    if (!C()) return;
    ghostMsg = '';
    if (!uid()) { view = 'in'; $n('nwInErr').hidden = true; paint(); return; }
    view = 'menu'; paint();
    await ensureName();
    if (!name && view === 'menu') { view = 'name'; paint(); $n('nwNameIn').value = ''; }
  }
  async function ensureName() {
    const u = uid(); if (!u) return null;
    if (nameFor === u && name) return name;
    const cached = lsGet('beau.name.' + u);
    if (cached) { name = cached; nameFor = u; paint(); return name; }
    try { const be = await C().backend(); const n = await be.nameGet(u); if (n && uid() === u) { name = n; nameFor = u; lsSet('beau.name.' + u, n); paint(); } } catch { /* 沒有網路：之後再問 */ }
    return name;
  }
  async function saveName() {
    const inp = $n('nwNameIn'), errEl = $n('nwNameErr'), v = inp.value.trim().replace(/\s+/g, ' '), e = nameErr(v), u = uid();
    errEl.hidden = !e; errEl.textContent = e;
    if (e || !u || busy) return;
    busy = true; $n('nwNameOk').disabled = true;
    try {
      const be = await C().backend();
      await be.namePut(u, v);
      const old = name;
      name = v; nameFor = u; lsSet('beau.name.' + u, v);
      if (old && old !== v) for (const [b, t] of Object.entries(best)) if (t != null) be.lbName(b, u, v).catch(() => {}); // 改名字：排行榜上的也換
      view = 'menu'; paint();
      flush();
    } catch { errEl.hidden = false; errEl.textContent = '存不進去，有網路再試一次。'; }
    finally { busy = false; $n('nwNameOk').disabled = false; }
  }

  // ---- 排行榜 ----
  async function loadBoard() {
    const u = uid(); if (!u) return;
    const key = filt === 'all' ? tab : `${tab}-${curCar()}`;
    boardKey = key; boardBusy = true; boardErr = ''; rows = []; mine = null; paint();
    try {
      const be = await C().backend();
      const top = await be.lbTop(key, TOP); S.fetches++;
      if (boardKey !== key) return;
      rows = top.filter((r) => r && typeof r.name === 'string' && typeof r.t === 'number');
      if (!rows.some((r) => r.uid === u)) {
        const d = await be.lbGet(key, u);
        best[key] = d ? d.t : null;
        if (d && boardKey === key) mine = { ...d, uid: u, rank: await be.lbRank(key, d.t) };
      } else best[key] = rows.find((r) => r.uid === u).t;
    } catch (e) { if (boardKey === key) boardErr = '排行榜現在打不開，等一下再試。'; console.warn('排行榜', e); }
    if (boardKey === key) { boardBusy = false; paint(); }
  }
  async function raceGhost() {
    const top = rows[0], key = boardKey, b = tab; if (!top || busy) return;
    busy = true; ghostMsg = '鬼影車下載中⋯'; paint();
    try {
      const be = await C().backend();
      const g = await be.ghostGet(key, top.uid);
      const ok = g && window.beauGame && window.beauGame.setGhost(b, { name: top.name, car: top.car, t: top.t, g });
      ghostMsg = ok ? (b === 'hill' ? '鬼影車準備好了！開到山腳的起點門，往上開過去就一起出發。'
        : b === 'lap' ? '鬼影車準備好了！去賽車場比賽，每一圈鬼影車都會跟你一起跑。'
        : '鬼影車準備好了！去 400 公尺直線加速，綠燈一亮就一起出發。') : '這一趟的鬼影車壞掉了，換一個試試看。';
    } catch { ghostMsg = '下載不了，有網路再試一次。'; }
    busy = false; paint();
  }

  // ---- 上傳：每一種每台車最好的一趟先記在這支手機，登入、有名字才傳 ----
  function okRun(r) {
    return r && BOARDS.includes(r.board) && /^[a-z0-9]{1,10}$/.test(r.car || '') && typeof r.t === 'number' && r.t > 1 && r.t < 900
      && r.g && typeof r.g.d === 'string' && r.g.d.length < 200000 && Number.isInteger(r.g.n) && Array.isArray(r.g.s);
  }
  function onRun(e) {
    const r = e && e.detail; if (!okRun(r)) return;
    const q = lsJson(QK), k = `${r.board}-${r.car}`;
    if (q[k] && q[k].t <= r.t) return;
    q[k] = { board: r.board, car: r.car, t: r.t, g: r.g };
    lsSet(QK, JSON.stringify(q));
    flush();
  }
  async function flush() {
    const u = uid(); if (!u || flushing) return;
    const q = lsJson(QK); if (!Object.keys(q).length) return;
    if (!(await ensureName())) return; // 還沒取名字：先記著（取好名字再傳）
    flushing = true;
    try {
      const be = await C().backend();
      for (const [k, r] of Object.entries(q)) {
        if (uid() !== u) break;
        if (okRun(r)) for (const key of [`${r.board}-${r.car}`, r.board]) {
          if (best[key] === undefined) { const d = await be.lbGet(key, u); best[key] = d ? d.t : null; }
          if (best[key] != null && best[key] <= r.t) continue;
          await be.lbPut(key, u, { name, car: r.car, t: r.t }, { name, car: r.car, t: r.t, hz: r.g.hz, c: r.g.c, n: r.g.n, s: r.g.s, d: r.g.d });
          best[key] = r.t; S.uploads++;
        }
        const now = lsJson(QK); if (now[k] && now[k].t === r.t) { delete now[k]; lsSet(QK, JSON.stringify(now)); }
      }
    } catch (e) { console.warn('排行榜上傳', e); } // 沒有網路：留著，下次再傳
    flushing = false;
    if (view === 'board') loadBoard();
  }

  if (chip && dlg) {
    chip.addEventListener('click', open);
    $n('netX').addEventListener('click', close);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    $n('nwLogin').addEventListener('click', async () => {
      const el = $n('nwInErr'); el.hidden = true;
      const err = C() ? await C().login() : '連不到雲端。';
      if (uid()) open(); else if (err) { el.hidden = false; el.textContent = err; }
    });
    $n('nwNameOk').addEventListener('click', saveName);
    $n('nwNameIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName(); });
    $n('nwBoardBtn').addEventListener('click', () => { view = 'board'; ghostMsg = ''; paint(); loadBoard(); });
    $n('nwRename').addEventListener('click', () => { view = 'name'; $n('nwNameIn').value = name || ''; $n('nwNameErr').hidden = true; paint(); });
    for (const b of $n('nwTabs').children) b.addEventListener('click', () => { if (tab === b.dataset.b) return; tab = b.dataset.b; ghostMsg = ''; loadBoard(); });
    for (const b of $n('nwFilt').children) b.addEventListener('click', () => { if (filt === b.dataset.f) return; filt = b.dataset.f; ghostMsg = ''; loadBoard(); });
    $n('nwGhost').addEventListener('click', raceGhost);
    window.addEventListener('beau-run', onRun);
    window.addEventListener('beau-user', () => { if (!uid()) { name = null; nameFor = null; if (view && view !== 'in') close(); } else { if (view === 'in') open(); flush(); } });
    window.addEventListener('online', flush);
    paint();
  }
}
