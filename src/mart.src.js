// ==== 第 81 批：超商買東西（Nick 2026-11-08「超商的東西要都要可以買要自己從貨架上挑要跟店員結帳如果沒結帳會被抓用比賽的錢 / 買完後的東西可以自己把後車廂打開放進去自己關」；
//      草稿 https://claude.ai/artifact/92aQZm3v7VrFZPDEmsz6Yx ，卡片選「照這樣做」）====
// 村口超商（interiors.js storeFloor：F.spots.shop 每樣東西站哪裡拿、F.spots.till 櫃台）：
//   走到貨架前面「拿 · 洋芋片 39 元」→ 放進籃子（左上「🛒 籃子 2 樣 · 64 元」，按一下打開清單、「放回」）
//   走到櫃台「結帳 · 64 元」→ 店員嗶嗶刷條碼、錢從比賽贏的錢扣（GAME.money 是萬；不到 1 萬的零錢記在 GAME.yuan）→ 東西進袋子（「🛍 袋子 2 樣」）
//   錢不夠：「店員：錢不夠喔，放回去一些」。拿著沒付錢的東西走出大門：門口嗶嗶嗶、1★（police-ai 'steal'），東西在袋子裡；被抓：偷的東西還給超商（罰款照舊）
// 你開的那台車（停著、你在走路）：走到車子後面「打開後車廂」→ 車蓋翻起來（車身的顏色、一塊板子＋裡面黑黑的）→「放進去」（袋子放進去看得到）→「關後車廂」
//   東西一直放在那台車的後車廂（存檔 GAME.trunk[車]），下次打開還在；掀背車（後面高高的）＝整片尾門往上翻；P8 皮卡＝直接「放進車斗」（看得到）
//   騎的（沙灘車、街車、腳踏車）、怪獸卡車：沒有後車廂
// 接在 seat.src.js 後面（同一個 module）；town.src.js：homeWalk／超商裡面的 setAction 叫 martAct、martTrunkAct；ldLeave 叫 martLeave；onArrest 叫 martArrest；driveStep 在 seatsStep 後面叫 martStep
const MART_ITEMS = {
  drink: { n: '飲料', p: 25, c: '#e2483c' }, water: { n: '礦泉水', p: 20, c: '#58a9e0' }, onigiri: { n: '御飯糰', p: 35, c: '#f4f1e6' },
  bread: { n: '麵包', p: 30, c: '#d9a35c' }, noodle: { n: '泡麵', p: 45, c: '#f0c040' }, chips: { n: '洋芋片', p: 39, c: '#f2c230' },
  icecream: { n: '冰淇淋', p: 50, c: '#f7c7d9' }, egg: { n: '茶葉蛋', p: 15, c: '#7a4a2a' }, toycar: { n: '玩具小車', p: 199, c: '#d6342c' },
};
const MART_MAX = 12; // 籃子最多幾樣
const MART = { basket: [], bag: [], stolen: [], ui: null, lay: '', open: false, greet: 0, vis: null, sig: null };
const martSum = (L) => L.reduce((a, k) => a + (MART_ITEMS[k]?.p || 0), 0);
const martName = (k) => MART_ITEMS[k]?.n || k;
function martList(L) { const m = new Map(); for (const k of L) m.set(k, (m.get(k) || 0) + 1); return [...m].map(([k, n]) => martName(k) + (n > 1 ? ` ×${n}` : '')).join('、'); }
const martInStore = () => !!(indoor?.live && indoor.b?.kind === 'store');

// ---- 錢：比賽的錢是「萬」，超商是「元」：不夠就拆 1 萬放零錢（GAME.yuan） ----
function martPay(y) {
  let c = GAME.yuan || 0;
  if (c < y) { const need = Math.ceil((y - c) / 10000); if (GAME.money < need) return false; GAME.money -= need; c += need * 10000; }
  GAME.yuan = c - y; save(true); renderWallet(); return true;
}
function martBeep(n, gap = 0.2) { for (let i = 0; i < n; i++) setTimeout(() => mrtSnd('beep'), i * gap * 1000); }

// ---- 超商裡面：貨架、櫃台 ----
function martNear(list, t, r) { let best = null, bd = r; for (const s of list || []) { const d = Math.hypot(t.x - s.x, t.z - s.z); if (d < bd) { bd = d; best = s; } } return best; }
function martAct(t) {
  if (!martInStore() || doorFade || sleep || jailed()) return null;
  const sp = indoor.I.spots || {};
  const till = MART.basket.length ? martNear(sp.till, t, 1.5) : null;
  if (till) {
    if (performance.now() - MART.greet > 20000) { MART.greet = performance.now(); walker.toast('店員：歡迎光臨！要結帳嗎？', 1800); }
    const sum = martSum(MART.basket); return { label: `結帳 · ${sum} 元`, icon: 'hand', onClick: martCheckout };
  }
  const s = martNear(sp.shop, t, 1.15), it = s && MART_ITEMS[s.item];
  return it ? { label: `拿 · ${it.n} ${it.p} 元`, icon: 'hand', onClick: () => martTake(s.item) } : null;
}
function martTake(k) {
  if (!martInStore() || !MART_ITEMS[k]) return;
  if (MART.basket.length >= MART_MAX) { walker.toast(`籃子滿了（${MART_MAX} 樣）：先去櫃台結帳`, 1800); return; }
  MART.basket.push(k); MART.sig = null;
  walker.toast(`拿了${martName(k)}（籃子 ${MART.basket.length} 樣 · ${martSum(MART.basket)} 元）`, 1500);
}
function martPutBack(i) { if (!martInStore() || !MART.basket[i]) return; const k = MART.basket.splice(i, 1)[0]; MART.sig = null; walker.toast(`${martName(k)}放回貨架了`, 1200); }
function martCheckout() {
  if (!martInStore() || !MART.basket.length) return;
  const sum = martSum(MART.basket);
  if (!martPay(sum)) { walker.toast('店員：錢不夠喔，放回去一些（按左上的籃子）', 2400); return; }
  martBeep(Math.min(5, MART.basket.length));
  walker.toast(`店員：嗶、嗶⋯一共 ${sum} 元，謝謝光臨！`, 2200);
  MART.bag.push(...MART.basket); MART.basket = []; MART.sig = null;
}
function martLeave(H) { // 走出大門（ldLeave）：籃子裡還有沒付錢的＝偷
  if (H?.b?.kind !== 'store' || !MART.basket.length) return;
  const L = MART.basket; MART.basket = []; MART.bag.push(...L); MART.stolen.push(...L); MART.sig = null;
  martBeep(3, 0.16);
  const t = walker.telemetry(); police?.crime('steal', { x: t.x, z: t.z });
  setTimeout(() => walker?.toast('嗶嗶嗶！還沒結帳！', 2200), 60); // ldLeave 最後會清掉提示
}
function martArrest() { // 被抓：偷的東西還給超商
  if (!MART.stolen.length) return;
  for (const k of MART.stolen) { const i = MART.bag.indexOf(k); if (i >= 0) MART.bag.splice(i, 1); }
  MART.stolen = []; MART.basket = []; MART.sig = null;
  setTimeout(() => walker?.toast('偷的東西還給超商了', 2200), 2500);
}

// ---- 左上的籃子／袋子（按一下打開清單；超商裡面可以「放回」）----
function martUI() {
  if (MART.ui) return MART.ui;
  const st = document.createElement('style');
  st.textContent = '.mt-pill{position:absolute;top:10px;left:10px;z-index:30;display:flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;border:0;background:rgba(14,15,18,0.72);color:#fff;font:600 13px/1 system-ui,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent}'
    + '.mt-pill[hidden],.mt-list[hidden]{display:none}'
    + '.mt-list{position:absolute;top:48px;left:10px;z-index:30;min-width:190px;max-width:calc(100% - 20px);max-height:50%;overflow:auto;padding:6px;border-radius:12px;background:rgba(14,15,18,0.85);color:#fff;font:500 13px/1.3 system-ui,sans-serif}'
    + '.mt-list div{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 6px}'
    + '.mt-list button{border:0;border-radius:999px;padding:4px 10px;background:#f39a1e;color:#1d2420;font:700 12px/1 system-ui,sans-serif;cursor:pointer}'
    + '.mt-list p{margin:4px 6px;color:#c9d1cc;font-size:12px}';
  document.head.appendChild(st);
  const pill = document.createElement('button'); pill.type = 'button'; pill.className = 'mt-pill'; pill.hidden = true;
  const list = document.createElement('div'); list.className = 'mt-list'; list.hidden = true;
  pill.addEventListener('click', (e) => { e.stopPropagation(); MART.open = !MART.open; MART.sig = null; });
  list.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (!b) return; e.stopPropagation(); martPutBack(+b.dataset.i); });
  for (const el of [pill, list]) for (const ev of ['pointerdown', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  stage.appendChild(pill); stage.appendChild(list);
  return (MART.ui = { pill, list });
}
function martHud() {
  const show = DRIVE.on && walker && walker.mode === 'walk' && !doorFade && (MART.basket.length || MART.bag.length);
  if (!show && !MART.ui) return;
  const U = martUI(), inS = martInStore();
  if (show) { // 左邊那一排（路線、大按鈕、第二顆）下面：哪幾顆在就排在它們下面
    const L = [...stage.querySelectorAll('.wk-chip, .wk-act, .wk-act2')], key = L.map((e) => (e.hidden ? 0 : 1)).join('') + stage.clientHeight;
    if (key !== MART.lay) { MART.lay = key; const top = stage.getBoundingClientRect().top; let y = 10; for (const e of L) if (!e.hidden) { const r = e.getBoundingClientRect(); if (r.height) y = Math.max(y, r.bottom - top + 8); } U.pill.style.top = `${Math.round(y)}px`; U.list.style.top = `${Math.round(y) + 38}px`; }
  }
  const sig = show ? `${MART.basket.join()}|${MART.bag.join()}|${MART.open}|${inS}` : 'off';
  if (sig === MART.sig) return; MART.sig = sig;
  U.pill.hidden = !show; if (!show) { U.list.hidden = true; return; }
  U.pill.textContent = MART.basket.length ? `🛒 籃子 ${MART.basket.length} 樣 · ${martSum(MART.basket)} 元` : `🛍 袋子 ${MART.bag.length} 樣`;
  U.list.hidden = !MART.open;
  if (!MART.open) return;
  let h = '';
  MART.basket.forEach((k, i) => { h += `<div><span>${martName(k)} ${MART_ITEMS[k].p} 元</span>${inS ? `<button type="button" data-i="${i}">放回</button>` : ''}</div>`; });
  if (MART.basket.length) h += `<p>${inS ? '去櫃台結帳' : '還沒付錢！'}</p>`;
  if (MART.bag.length) h += `<p>袋子：${martList(MART.bag)}${trunkOK(cur) ? '（走到車子後面放進後車廂）' : ''}</p>`;
  U.list.innerHTML = h;
}

// ---- 後車廂 ----
const TRUNK_BED = { p8: 1 }; // 皮卡：車斗（沒有蓋子）
function trunkOK(k) { return !!(k && CARS[k] && !RIDES[k] && !PERF[k]?.big); }
const TK = { ray: null, v: null, d: null, m: null };
function trunkProbe(S) { // 量這台車的後面：車尾、行李廂蓋多高、到哪裡（後擋）、多寬、是不是掀背（在車子自己的座標：+x 往前）
  if (S._trunk) return S._trunk;
  const car = S.car; car.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(car.matrixWorld).invert(), m = new THREE.Matrix4(), bb = new THREE.Box3(), box = new THREE.Box3();
  const skip = new Set(); for (const w of Object.values(S.wings || {})) if (w) skip.add(w);
  const walk = (o) => { if (o.userData.seated || skip.has(o) || o.visible === false) return; if (o.isMesh && o.geometry) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); m.multiplyMatrices(inv, o.matrixWorld); bb.copy(o.geometry.boundingBox).applyMatrix4(m); box.union(bb); } for (const c of o.children) walk(c); };
  walk(S.body);
  const ray = TK.ray || (TK.ray = new THREE.Raycaster()), o = new THREE.Vector3(), d = new THREE.Vector3();
  const targets = []; const coll = (x) => { if (x.userData.seated || skip.has(x) || x.visible === false) return; if (x.isMesh) targets.push(x); for (const c of x.children) coll(c); }; coll(S.body);
  const top = (lx, lz = 0) => { o.set(lx, box.max.y + 1, lz).applyMatrix4(car.matrixWorld); d.set(0, -1, 0).transformDirection(car.matrixWorld); ray.set(o, d); ray.far = box.max.y + 3; const h = ray.intersectObjects(targets, false)[0]; return h ? car.worldToLocal(h.point.clone()).y : null; };
  const x0 = box.min.x, W = box.max.z - box.min.z, hs = [];
  for (let i = 1; i <= 16; i++) hs.push([x0 + i * 0.1, top(x0 + i * 0.1)]);
  const at = (dx) => { let best = null; for (const [x, y] of hs) if (y != null && (best == null || Math.abs(x - x0 - dx) < Math.abs(best[0] - x0 - dx))) best = [x, y]; return best ? best[1] : box.min.y + (box.max.y - box.min.y) * 0.6; };
  const h0 = at(0.3), H = box.max.y;
  let xh = null; for (const [x, y] of hs) if (x >= x0 + 0.45 && y != null && y > h0 + 0.12) { xh = x - 0.05; break; }
  xh = Math.min(x0 + 1.3, Math.max(x0 + 0.55, xh ?? x0 + 1.1));
  const bed = !!TRUNK_BED[curKeyOf(S)], hatch = !bed && h0 > box.min.y + (H - box.min.y) * 0.72;
  return (S._trunk = { x0, xh, y: h0, W, H, hatch, bed, ymin: box.min.y });
}
function curKeyOf(S) { return S === tripS ? cur : S.spec?.key || ''; }
const TRUNK_MAT = { bag: null, hole: null };
function trunkBagMat() {
  if (TRUNK_MAT.bag) return TRUNK_MAT.bag;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#f6f2e8'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#1f8a4c'; g.fillRect(0, 22, 64, 12); g.fillStyle = '#f39a1e'; g.fillRect(0, 34, 64, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (TRUNK_MAT.bag = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
}
function trunkVis(S) { // 蓋子（樞紐在前面那一邊；掀背＝上面）、裡面黑黑的那塊、袋子（最多 4 個）
  if (MART.vis?.S === S) return MART.vis;
  trunkDrop();
  const P = trunkProbe(S), g = new THREE.Group(); g.name = 'mart-trunk';
  const paintCol = S.paint?.color ? S.paint.color.clone() : new THREE.Color('#888');
  const lidMat = new THREE.MeshStandardMaterial({ color: paintCol, metalness: 0.35, roughness: 0.35 });
  const hole = TRUNK_MAT.hole || (TRUNK_MAT.hole = new THREE.MeshStandardMaterial({ color: '#0b0b0c', roughness: 1 }));
  const w = Math.min(1.3, P.W * 0.62);
  const V = { S, g, P, t: 0, want: 0, lid: null, hinge: null, cav: null, bags: [], n: -1 };
  if (P.bed) { /* 車斗：沒有蓋子 */ }
  else if (P.hatch) { // 掀背：整片尾門，樞紐在上面，往後往上翻
    const top = Math.min(P.H - 0.06, P.y + 0.26), L = Math.max(0.45, Math.min(1.0, top - P.ymin - 0.45)); // 樞紐在後擋上面（車頂後緣），整片連後擋一起翻
    V.hinge = new THREE.Group(); V.hinge.position.set(P.x0 + 0.04, top, 0); g.add(V.hinge);
    V.lid = new THREE.Mesh(new THREE.BoxGeometry(0.03, L, w), lidMat); V.lid.position.set(-0.03, -L / 2, 0); V.hinge.add(V.lid);
    V.cav = new THREE.Mesh(new THREE.BoxGeometry(0.02, L - 0.06, w - 0.06), hole); V.cav.position.set(P.x0 + 0.01, top - L / 2, 0); g.add(V.cav);
    V.bagAt = (i) => [P.x0 - 0.1, top - L + 0.16, (i - 1.5) * 0.3];
  } else { // 行李廂蓋：平的一塊，樞紐在前面（後擋下面），後面往上翻
    const L = P.xh - (P.x0 + 0.06), y = P.y + 0.012;
    V.hinge = new THREE.Group(); V.hinge.position.set(P.xh, y, 0); g.add(V.hinge);
    V.lid = new THREE.Mesh(new THREE.BoxGeometry(L, 0.025, w), lidMat); V.lid.position.set(-L / 2, 0, 0); V.hinge.add(V.lid);
    V.cav = new THREE.Mesh(new THREE.BoxGeometry(L - 0.06, 0.012, w - 0.06), hole); V.cav.position.set(P.xh - L / 2, P.y + 0.004, 0); g.add(V.cav);
    V.bagAt = (i) => [P.x0 + 0.3 + (i % 2) * Math.min(0.32, L - 0.45), P.y + 0.15, (i < 2 ? -1 : 1) * 0.17 + (i % 2 ? 0.05 : -0.05)];
  }
  if (P.bed) V.bagAt = (i) => [P.x0 + 0.45 + (i % 2) * 0.4, P.y + 0.15, (i < 2 ? -1 : 1) * 0.3];
  const bg = new THREE.BoxGeometry(0.24, 0.3, 0.17);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(bg, trunkBagMat()); b.position.set(...V.bagAt(i)); b.rotation.y = (i % 3) * 0.35 - 0.3; b.visible = false; g.add(b); V.bags.push(b); }
  if (V.cav) V.cav.visible = false;
  S.car.add(g);
  return (MART.vis = V);
}
function trunkDrop() {
  const V = MART.vis; if (!V) return; MART.vis = null;
  V.g.removeFromParent(); V.g.traverse((o) => { if (o.isMesh && o.material !== TRUNK_MAT.bag && o.material !== TRUNK_MAT.hole) { o.material.dispose?.(); } if (o.isMesh) o.geometry.dispose(); });
}
function trunkItems() { const k = cur; return (GAME.trunk && GAME.trunk[k]) || []; }
function trunkRear(t) { // 車子後面（世界）那一點：走到這裡附近才有按鈕
  if (!tripS || !drv || !trunkOK(cur)) return null;
  const P = trunkProbe(tripS), c = tripS.car; c.updateMatrixWorld();
  const p = new THREE.Vector3(P.x0 - 0.55, 0, 0).applyMatrix4(c.matrixWorld);
  return Math.hypot(t.x - p.x, t.z - p.z) < 1.25 ? p : null;
}
const TRUNK_OPEN = { label: '打開後車廂', icon: 'hand', onClick: () => trunkSet(1) };
const TRUNK_CLOSE = { label: '關後車廂', icon: 'hand', onClick: () => trunkSet(0) };
const TRUNK_PUT = { label: '放進去', icon: 'hand', onClick: trunkPut };
const TRUNK_BEDPUT = { label: '放進車斗', icon: 'hand', onClick: trunkPut };
function martTrunkAct(t) { // homeWalk（走路、在外面）：車子後面的大按鈕
  if (!DRIVE.on || !walker || walker.mode !== 'walk' || indoor || doorFade || sleep || jailed() || RACE.on) return null;
  if (!drv || !drv.telemetry().paused || !trunkRear(t)) return null;
  const V = trunkVis(tripS);
  if (V.P.bed) return MART.bag.length ? TRUNK_BEDPUT : null;
  if (V.want < 1) return TRUNK_OPEN;
  return MART.bag.length ? TRUNK_PUT : TRUNK_CLOSE;
}
function trunkSet(on) {
  const V = tripS && trunkVis(tripS); if (!V) return;
  V.want = on ? 1 : 0;
  if (on) { const L = trunkItems(); walker.toast(L.length ? `後車廂：${martList(L)}` : '後車廂是空的', 1800); }
}
function trunkPut() {
  if (!MART.bag.length || !tripS || !trunkOK(cur)) return;
  const k = cur; GAME.trunk = GAME.trunk || {}; const L = (GAME.trunk[k] = GAME.trunk[k] || []);
  L.push(...MART.bag.slice(0, Math.max(0, 40 - L.length)));
  walker.toast(`放進${trunkVis(tripS).P.bed ? '車斗' : '後車廂'}了：${martList(MART.bag)}`, 2000);
  MART.bag = []; MART.stolen = []; MART.sig = null; save(true);
}
// 每一格（seatsStep 後面）：蓋子慢慢翻、袋子、走遠了自己關、右邊第二顆「關後車廂」、左上的籃子
function martStep(dt) {
  if (!DRIVE.on) { if (MART.vis) trunkDrop(); MART.basket = []; martHud(); return; }
  if (MART.basket.length && !martInStore() && !doorFade) { MART.basket = []; MART.sig = null; } // 沒有走大門出來（直接回車庫、被抓）：籃子裡的放回去
  if (MART.vis && (MART.vis.S !== tripS || !drv)) trunkDrop();
  const t = walker && walker.mode === 'walk' ? walker.telemetry() : null;
  if (!MART.vis && tripS && trunkOK(cur) && TRUNK_BED[cur] && trunkItems().length && t && Math.hypot(t.x - tripS.car.position.x, t.z - tripS.car.position.z) < 40) trunkVis(tripS); // 皮卡的車斗：東西看得到
  const V = MART.vis;
  if (V) {
    if (V.want && (!t || Math.hypot(t.x - V.S.car.position.x, t.z - V.S.car.position.z) > 6 || !drv?.telemetry().paused)) V.want = 0; // 走遠了、上車了：自己關
    V.t += Math.sign(V.want - V.t) * Math.min(Math.abs(V.want - V.t), dt / 0.6);
    const e = V.t * V.t * (3 - 2 * V.t);
    if (V.hinge) V.hinge.rotation.z = V.P.hatch ? -1.25 * e : -1.15 * e;
    if (V.cav) V.cav.visible = V.t > 0.02;
    const n = Math.min(4, Math.ceil(trunkItems().length / 3)), vis = V.P.bed || V.t > 0.3;
    for (let i = 0; i < 4; i++) V.bags[i].visible = vis && i < n;
    if (t && V.want > 0 && MART.bag.length) walker.setAction2(TRUNK_CLOSE); // 開著、還有袋子：大按鈕「放進去」、右邊「關後車廂」
  }
  martHud();
}
