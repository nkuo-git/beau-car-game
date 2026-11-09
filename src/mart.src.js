// ==== 第 81 批：超商買東西（Nick 2026-11-08「超商的東西要都要可以買要自己從貨架上挑要跟店員結帳如果沒結帳會被抓用比賽的錢 / 買完後的東西可以自己把後車廂打開放進去自己關」；
//      草稿 https://claude.ai/artifact/92aQZm3v7VrFZPDEmsz6Yx ，卡片選「照這樣做」）====
// 村口超商（interiors.js storeFloor：F.spots.shop 每樣東西站哪裡拿、F.spots.till 櫃台）：
//   走到貨架前面「拿 · 洋芋片 39 元」→ 放進籃子（左上「🛒 籃子 2 樣 · 64 元」，按一下打開清單、「放回」）
//   走到櫃台「結帳 · 64 元」→ 店員嗶嗶刷條碼、錢從比賽贏的錢扣（GAME.money 是萬；不到 1 萬的零錢記在 GAME.yuan）→ 東西進袋子（「🛍 袋子 2 樣」）
//   錢不夠：「店員：錢不夠喔，放回去一些」。拿著沒付錢的東西走出大門：門口嗶嗶嗶、1★（police-ai 'steal'），東西在袋子裡；被抓：偷的東西還給超商（罰款照舊）
// 你開的那台車（停著、你在走路）：走到車子後面「打開後車廂」→ 車身那一塊（第 83 批：照真的車怎麼開：房車的行李廂蓋、掀背的尾門、超跑在前面、吉普車側開、皮卡尾門往下）翻開 →「放進去」→「關後車廂」；
//   東西一直放在那台車的後車廂（存檔 GAME.trunk[車]），下次打開還在
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
// 第 83 批（Nick「你去查那些車是如何開後車箱的 不是直接在原車加上一片東西」）：照真的車怎麼開，把車身那一塊切下來當蓋子（打開的時候才切，關好了換回原本的網格）
//   trunk＝房車的行李廂蓋（樞紐在後擋下面，後面往上翻）；hatch＝掀背（整片尾門連後擋，樞紐在車頂後緣）；frunk＝中置引擎的超跑：行李廂在前面（樞紐在前擋下面，前面往上翻）；
//   swing＝吉普車、小越野車：側開的尾門（樞紐在右邊，往右邊打開，備胎跟著門）；drop＝皮卡：尾門往下放平；SN8 沒有行李廂（只有座位後面一點點）
const TRUNK_KIND = { gc8: 'trunk', gtr: 'trunk', altis: 'trunk', evo: 'trunk', yaris: 'hatch', supra: 'hatch', rx7: 'hatch', ae86: 'hatch', civic: 'hatch',
  p918: 'frunk', sp3: 'frunk', jesko: 'frunk', chiron: 'frunk', aventador: 'frunk', huayra: 'frunk', laferrari: 'frunk', jp4: 'swing', k2: 'swing', p8: 'drop', senna: 'none' };
const TRUNK_BED = { p8: 1 }; // 皮卡：車斗（東西一直看得到）
function trunkKind(k) { return TRUNK_KIND[k] || 'trunk'; }
function trunkOK(k) { return !!(k && CARS[k] && !RIDES[k] && !PERF[k]?.big && trunkKind(k) !== 'none'); }
const TRUNK_TXT = { trunk: '後車廂', hatch: '後車廂', frunk: '前車廂', swing: '後車廂', drop: '車斗' };
const TK = { ray: null };
function trunkProbe(S) { // 量這台車：前後的高度（每 10 公分）、後面那一面（往前打的射線）、是哪一種、樞紐、要切下來的範圍（都在車子自己的座標：+x 往前、+z 右邊）
  if (S._trunk) return S._trunk;
  const car = S.car; car.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(car.matrixWorld).invert(), m = new THREE.Matrix4(), bb = new THREE.Box3(), box = new THREE.Box3();
  const skip = new Set(); for (const w of Object.values(S.wings || {})) if (w) skip.add(w);
  const walk = (o) => { if (o.userData.seated || skip.has(o) || o.visible === false || o.name === 'interior') return; if (o.isMesh && o.geometry) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); m.multiplyMatrices(inv, o.matrixWorld); bb.copy(o.geometry.boundingBox).applyMatrix4(m); box.union(bb); } for (const c of o.children) walk(c); };
  walk(S.body);
  const ray = TK.ray || (TK.ray = new THREE.Raycaster()), o = new THREE.Vector3(), d = new THREE.Vector3();
  const targets = []; const coll = (x) => { if (x.userData.seated || skip.has(x) || x.visible === false || x.name === 'interior') return; if (x.isMesh) targets.push(x); for (const c of x.children) coll(c); }; coll(S.body);
  const hit = (ox, oy, oz, dx, dy, far) => { o.set(ox, oy, oz).applyMatrix4(car.matrixWorld); d.set(dx, dy, 0).transformDirection(car.matrixWorld); ray.set(o, d); ray.far = far; const h = ray.intersectObjects(targets, false)[0]; return h ? car.worldToLocal(h.point.clone()) : null; };
  const top = (lx, lz = 0) => { const h = hit(lx, box.max.y + 1, lz, 0, -1, box.max.y + 3); return h ? h.y : null; };
  const x0 = box.min.x, x1 = box.max.x, W = box.max.z - box.min.z, H = box.max.y, kind = trunkKind(curKeyOf(S));
  const hs = []; for (let i = 1; i <= 16; i++) hs.push([x0 + i * 0.1, top(x0 + i * 0.1)]);
  const at = (dx) => { let best = null; for (const [x, y] of hs) if (y != null && (best == null || Math.abs(x - x0 - dx) < Math.abs(best[0] - x0 - dx))) best = [x, y]; return best ? best[1] : box.min.y + (box.max.y - box.min.y) * 0.6; };
  const h0 = at(0.3);
  let xh = null; for (const [x, y] of hs) if (x >= x0 + 0.45 && y != null && y > h0 + 0.12) { xh = x - 0.05; break; }
  xh = Math.min(x0 + 1.3, Math.max(x0 + 0.55, xh ?? x0 + 1.1));
  // 後面那一面：離中間 0.3 個車寬（避開中間的備胎），從後面往前打；最後面那幾格＝保桿
  const face = []; for (let y = box.min.y + 0.12; y < H - 0.05; y += 0.05) { const a = hit(x0 - 1, y, W * 0.3, 1, 0, 3), b2 = hit(x0 - 1, y, -W * 0.3, 1, 0, 3); const xs = [a, b2].filter(Boolean).map((p) => p.x); if (xs.length) face.push([y, Math.max(...xs)]); }
  const fmin = face.length ? Math.min(...face.map((f) => f[1])) : x0;
  const lowF = face.filter(([y]) => y < box.min.y + (H - box.min.y) * 0.5), lmin = lowF.length ? Math.min(...lowF.map((f) => f[1])) : fmin;
  let yB = box.min.y + 0.35; for (const [y, x] of lowF) if (x <= lmin + 0.03) yB = y + 0.03; // 保桿上緣（下面那一半最後面那一段的最上面）
  const mid = face.filter(([y]) => y > yB + 0.05 && y < H - 0.25).map((f) => f[1]).sort((a, b) => a - b), xr = mid.length ? mid[mid.length >> 1] : x0 + 0.1; // 尾門那一面
  let yTop = yB; for (const [y, x] of face) if (y > yB && Math.abs(x - xr) < 0.06) yTop = y; // 尾門最上面（皮卡：車斗的邊）
  const P = { kind, x0, x1, xh, y: h0, W, H, ymin: box.min.y, yB, xr, yTop, hatch: kind === 'hatch', bed: !!TRUNK_BED[curKeyOf(S)] };
  const zl = (k) => W * k;
  if (kind === 'hatch') { // 樞紐在車頂後緣：車頂（離最高 6 公分以內）最後面那一點
    let xRoof = x0 + 1.2; for (let i = 1; i <= 30; i++) { const x = x0 + i * 0.08, y = top(x); if (y != null && y > H - 0.07) { xRoof = x; break; } }
    const hy = (top(xRoof) ?? H) - 0.015, z = zl(0.35);
    Object.assign(P, { hinge: [xRoof - 0.02, hy, 0], axis: 'z', ang: -1.25, inR: (x, y, zz) => x <= xRoof - 0.04 && y >= yB && Math.abs(zz) <= z,
      cav: [x0 + 0.18, x0 + 0.95, yB + 0.02, hy - 0.12, z - 0.04], rear: true });
    P.bagAt = (i) => [x0 + 0.42 + (i % 2) * 0.28, yB + 0.17, (i < 2 ? -1 : 1) * 0.2];
  } else if (kind === 'frunk') { // 前面：引擎蓋到前擋下面（坡變陡的地方）
    const fs = []; for (let i = 1; i <= 24; i++) fs.push([x1 - i * 0.1, top(x1 - i * 0.1)]);
    let xw = x1 - 1.5; for (let i = 6; i < fs.length; i++) { const [x, y] = fs[i], py = fs[i - 1][1]; if (y != null && py != null && y - py > 0.055) { xw = fs[i - 1][0]; break; } }
    xw = Math.min(x1 - 0.75, Math.max(x1 - 2.0, xw));
    const hood = fs.filter(([x, y]) => y != null && x > xw && x < x1 - 0.15).map((f) => f[1]), yH = hood.length ? Math.min(...hood) : box.min.y + 0.6, z = zl(0.3), hy = (top(xw) ?? yH) + 0.005;
    Object.assign(P, { hinge: [xw, hy, 0], axis: 'z', ang: 1.1, inR: (x, y, zz) => x >= xw + 0.01 && x <= x1 - 0.1 && y >= yH - 0.04 && Math.abs(zz) <= z,
      cav: [xw + 0.08, x1 - 0.22, yH - 0.36, yH - 0.03, z - 0.04], wall: [xw + 0.05, yH - 0.36, hy + 0.03, zl(0.4)], front: true }); // wall＝前車廂後面那一面（擋住車裡面）
    P.bagAt = (i) => [x1 - 0.5 - (i % 2) * 0.3, yH - 0.2, (i < 2 ? -1 : 1) * 0.18];
  } else if (kind === 'swing') { // 側開的尾門：樞紐在右邊（+z），門往右後方打開
    const z = zl(0.46), zt = Math.min(H - 0.06, yTop + 0.05);
    Object.assign(P, { hinge: [xr, 0, z], axis: 'y', ang: 1.75, inR: (x, y, zz) => x <= xr + 0.1 && y >= yB && y <= zt && Math.abs(zz) <= z,
      cav: [xr + 0.08, xr + 0.85, yB + 0.02, Math.min(H - 0.2, zt - 0.1), zl(0.42)], rear: true });
    P.bagAt = (i) => [xr + 0.3 + (i % 2) * 0.3, yB + 0.17, (i < 2 ? -1 : 1) * 0.22];
  } else if (kind === 'drop') { // 皮卡的尾門：樞紐在下面，往後放平
    const z = zl(0.45);
    Object.assign(P, { hinge: [xr, yB, 0], axis: 'z', ang: 1.5, inR: (x, y, zz) => x <= xr + 0.12 && y >= yB && y <= yTop + 0.04 && Math.abs(zz) <= z, rear: true });
    P.bagAt = (i) => [x0 + 0.6 + (i % 2) * 0.4, h0 + 0.15, (i < 2 ? -1 : 1) * 0.3];
  } else { // 房車的行李廂蓋：樞紐在後擋下面；蓋子包到車尾那一面（尾燈上面）
    const yC = Math.max(Math.min(yB, h0 - 0.25) + 0.05, h0 - 0.2), z = zl(0.35); // 車尾直直的（E9）量不到保桿上緣：最多到蓋子下面 25 公分
    Object.assign(P, { hinge: [xh, h0 + 0.012, 0], axis: 'z', ang: -1.15, inR: (x, y, zz) => x <= xh - 0.03 && y >= yC && y <= h0 + 0.12 && Math.abs(zz) <= z,
      cav: [x0 + 0.14, xh - 0.06, Math.max(box.min.y + 0.25, h0 - 0.45), h0 - 0.02, z - 0.04], wall: [xh - 0.05, Math.max(box.min.y + 0.25, h0 - 0.45), h0 + 0.03, zl(0.4)], rear: true });
    P.bagAt = (i) => [x0 + 0.3 + (i % 2) * Math.min(0.32, xh - x0 - 0.6), Math.max(box.min.y + 0.25, h0 - 0.45) + 0.15, (i < 2 ? -1 : 1) * 0.17 + (i % 2 ? 0.05 : -0.05)];
  }
  return (S._trunk = P);
}
function curKeyOf(S) { return S === tripS ? cur : S.spec?.key || ''; }
// 把車身切成「蓋子」和「剩下的」：每個網格的三角形，三個點都在範圍裡＝蓋子；跟原本的網格共用頂點（只換 index），算一次記在 S._lidCut
function trunkCut(S, P) {
  if (S._lidCut) return S._lidCut;
  const car = S.car; car.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(car.matrixWorld).invert(), v = new THREE.Vector3(), parts = [], moved = [], cache = new Map();
  const wings = new Set(Object.values(S.wings || {}).filter(Boolean));
  const visit = (ob) => {
    if (ob.userData.seated || ob.name === 'interior' || ob.name === 'mart-trunk') return;
    if (wings.has(ob)) { if (ob.visible) { const b = new THREE.Box3().setFromObject(ob).applyMatrix4(inv), c = b.getCenter(v); if (!b.isEmpty() && P.inR(c.x, Math.min(c.y, P.hinge[1]), c.z)) moved.push(ob); } return; } // 尾翼裝在蓋子上：整個跟著翻
    if (ob.isMesh && ob.geometry && !ob.isInstancedMesh && !ob.isSkinnedMesh && ob.geometry.attributes.position) {
      const rel = new THREE.Matrix4().multiplyMatrices(inv, ob.matrixWorld), g = ob.geometry, key = g.uuid + rel.elements.map((e) => e.toFixed(4)).join();
      let sp = cache.get(key);
      if (sp === undefined) {
        const pos = g.attributes.position, n = pos.count, inside = new Uint8Array(n);
        for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(rel); inside[i] = P.inR(v.x, v.y, v.z) ? 1 : 0; }
        const idx = g.index ? g.index.array : null, cnt = idx ? idx.length : n, I = (k) => (idx ? idx[k] : k);
        const groups = g.groups.length ? g.groups : [{ start: 0, count: g.drawRange.count === Infinity ? cnt : Math.min(cnt, g.drawRange.count), materialIndex: 0 }];
        const lid = [], rest = [], gl = [], gr = []; let any = false;
        for (const gp of groups) { const l0 = lid.length, r0 = rest.length;
          for (let k = gp.start; k + 2 < gp.start + gp.count && k + 2 < cnt; k += 3) { const a = I(k), b = I(k + 1), c = I(k + 2); if (inside[a] && inside[b] && inside[c]) { lid.push(a, b, c); any = true; } else rest.push(a, b, c); }
          gl.push({ start: l0, count: lid.length - l0, materialIndex: gp.materialIndex }); gr.push({ start: r0, count: rest.length - r0, materialIndex: gp.materialIndex }); }
        sp = null;
        if (any) { const mk = (arr, gs) => { const q = new THREE.BufferGeometry(); for (const [k, a] of Object.entries(g.attributes)) q.setAttribute(k, a); q.setIndex(new (n > 65535 ? THREE.Uint32BufferAttribute : THREE.Uint16BufferAttribute)(arr, 1)); if (g.groups.length) for (const x of gs) q.addGroup(x.start, x.count, x.materialIndex); q.boundingSphere = g.boundingSphere || (g.computeBoundingSphere(), g.boundingSphere); q.boundingBox = g.boundingBox; return q; };
          sp = { lid: mk(lid, gl), rest: mk(rest, gr) }; }
        cache.set(key, sp);
      }
      if (sp) parts.push({ mesh: ob, g0: ob.geometry, sp, rel });
    }
    for (const c of ob.children) visit(c);
  };
  visit(S.body);
  return (S._lidCut = { parts, moved });
}
const TRUNK_MAT = { bag: null, hole: null };
function trunkBagMat() {
  if (TRUNK_MAT.bag) return TRUNK_MAT.bag;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#f6f2e8'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#1f8a4c'; g.fillRect(0, 22, 64, 12); g.fillStyle = '#f39a1e'; g.fillRect(0, 34, 64, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (TRUNK_MAT.bag = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
}
function trunkVis(S) { // 蓋子（車身切下來的那一塊，掛在樞紐上）、裡面黑黑的那個空間（只畫裡面那幾面）、袋子（最多 4 個）
  if (MART.vis?.S === S) return MART.vis;
  trunkDrop();
  const P = trunkProbe(S), g = new THREE.Group(); g.name = 'mart-trunk';
  const hole = TRUNK_MAT.hole || (TRUNK_MAT.hole = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 1, side: THREE.BackSide }));
  const V = { S, g, P, t: 0, want: 0, hinge: null, inner: null, lids: [], cut: false, cav: null, bags: [], n: -1 };
  if (P.hinge) { V.hinge = new THREE.Group(); V.hinge.name = 'mart-lid'; V.hinge.position.set(...P.hinge); g.add(V.hinge); V.inner = new THREE.Group(); V.inner.position.set(-P.hinge[0], -P.hinge[1], -P.hinge[2]); V.hinge.add(V.inner); }
  if (P.cav) { const [a, b, c, d, z] = P.cav; V.cav = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.1, b - a), Math.max(0.1, d - c), 2 * z), hole); V.cav.position.set((a + b) / 2, (c + d) / 2, 0); V.cav.visible = false; g.add(V.cav);
    if (P.wall) { const [x, y0, y1, z] = P.wall, wm = TRUNK_MAT.wall || (TRUNK_MAT.wall = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 1, side: THREE.DoubleSide })), w = new THREE.Mesh(new THREE.PlaneGeometry(2 * z, y1 - y0), wm);
      w.rotation.y = Math.PI / 2; w.position.set(x - V.cav.position.x, (y0 + y1) / 2 - V.cav.position.y, 0); V.cav.add(w); } }
  const bg = new THREE.BoxGeometry(0.24, 0.3, 0.17);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(bg, trunkBagMat()); b.position.set(...P.bagAt(i)); b.rotation.y = (i % 3) * 0.35 - 0.3; b.visible = false; g.add(b); V.bags.push(b); }
  S.car.add(g);
  return (MART.vis = V);
}
function trunkSplit(V, on) { // 打開：車身換成「剩下的」、蓋子掛到樞紐上；關好：換回原本的網格
  if (!V.hinge || V.cut === on) return; V.cut = on;
  const C = trunkCut(V.S, V.P);
  if (on) {
    for (const p of C.parts) { p.mesh.geometry = p.sp.rest; const m = new THREE.Mesh(p.sp.lid, p.mesh.material); m.matrixAutoUpdate = false; m.matrix.copy(p.rel); m.castShadow = p.mesh.castShadow; m.receiveShadow = p.mesh.receiveShadow; m.renderOrder = p.mesh.renderOrder; m.name = 'lid-' + (p.mesh.name || 'part'); V.inner.add(m); V.lids.push(m); }
    V.hinge.rotation.set(0, 0, 0); V.hinge.updateMatrixWorld(true); V.moved = C.moved.map((w) => ({ w, par: w.parent })); for (const x of V.moved) V.inner.attach(x.w);
  } else {
    for (const p of C.parts) p.mesh.geometry = p.g0;
    for (const m of V.lids) m.removeFromParent(); V.lids.length = 0;
    V.hinge.rotation.set(0, 0, 0); V.hinge.updateMatrixWorld(true); for (const x of V.moved || []) x.par.attach(x.w); V.moved = null;
  }
}
function trunkDrop() {
  const V = MART.vis; if (!V) return; MART.vis = null;
  trunkSplit(V, false);
  V.g.removeFromParent(); V.g.traverse((o) => { if (o.isMesh && o.name !== 'mart-bag') { if (o.geometry && !o.name.startsWith('lid-')) o.geometry.dispose(); } });
}
function trunkItems() { const k = cur; return (GAME.trunk && GAME.trunk[k]) || []; }
function trunkRear(t) { // 打開的地方（世界）：後車廂＝車尾後面、前車廂＝車頭前面；走到這裡附近才有按鈕
  if (!tripS || !drv || !trunkOK(cur)) return null;
  const P = trunkProbe(tripS), c = tripS.car; c.updateMatrixWorld();
  const p = new THREE.Vector3(P.front ? P.x1 + 0.55 : P.x0 - 0.55, 0, 0).applyMatrix4(c.matrixWorld);
  return Math.hypot(t.x - p.x, t.z - p.z) < 1.25 ? p : null;
}
const TRUNK_ACT = {};
function trunkAct(kind, what) { // 按鈕的字照種類：打開後車廂／打開前車廂／打開尾門（皮卡）
  const key = kind + what; if (TRUNK_ACT[key]) return TRUNK_ACT[key];
  const nm = TRUNK_TXT[kind] || '後車廂', lab = what === 'open' ? (kind === 'drop' ? '放下尾門' : `打開${nm}`) : what === 'close' ? (kind === 'drop' ? '關尾門' : `關${nm}`) : (kind === 'drop' ? '放進車斗' : '放進去');
  return (TRUNK_ACT[key] = { label: lab, icon: 'hand', onClick: what === 'open' ? () => trunkSet(1) : what === 'close' ? () => trunkSet(0) : trunkPut });
}
function martTrunkAct(t) { // homeWalk（走路、在外面）：車子後面（前面）的大按鈕
  if (!DRIVE.on || !walker || walker.mode !== 'walk' || indoor || doorFade || sleep || jailed() || RACE.on) return null;
  if (!drv || !drv.telemetry().paused || !trunkRear(t)) return null;
  const V = trunkVis(tripS), k = V.P.kind;
  if (V.P.bed && MART.bag.length && V.want < 1) return trunkAct(k, 'put'); // 皮卡：車斗不用開也放得進去
  if (V.want < 1) return trunkAct(k, 'open');
  return MART.bag.length ? trunkAct(k, 'put') : trunkAct(k, 'close');
}
function trunkSet(on) {
  const V = tripS && trunkVis(tripS); if (!V) return;
  V.want = on ? 1 : 0;
  if (on) { const L = trunkItems(), nm = TRUNK_TXT[V.P.kind] || '後車廂'; walker.toast(L.length ? `${nm}：${martList(L)}` : `${nm}是空的`, 1800); }
}
function trunkPut() {
  if (!MART.bag.length || !tripS || !trunkOK(cur)) return;
  const k = cur; GAME.trunk = GAME.trunk || {}; const L = (GAME.trunk[k] = GAME.trunk[k] || []);
  L.push(...MART.bag.slice(0, Math.max(0, 40 - L.length)));
  walker.toast(`放進${TRUNK_TXT[trunkVis(tripS).P.kind] || '後車廂'}了：${martList(MART.bag)}`, 2000);
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
    trunkSplit(V, V.t > 0.001); // 動起來才切開；關好了換回原本的車身
    if (V.hinge) { V.hinge.rotation[V.P.axis] = V.P.ang * e; }
    if (V.cav) V.cav.visible = V.t > 0.02;
    const n = Math.min(4, Math.ceil(trunkItems().length / 3)), vis = V.P.bed || V.t > 0.3;
    for (let i = 0; i < 4; i++) V.bags[i].visible = vis && i < n;
    if (t && V.want > 0 && MART.bag.length) walker.setAction2(trunkAct(V.P.kind, 'close')); // 開著、還有袋子：大按鈕「放進去」、右邊「關後車廂」
  }
  martHud();
}
