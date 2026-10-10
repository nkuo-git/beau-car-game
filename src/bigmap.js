// 大地圖（Nick 2026-10-10「可以瀏覽完整地圖」，草稿 https://claude.ai/artifact/VF5wb2U1PpAnzBRyJsSSW6 第 2 張，「大地圖OK」）
// 開車、走路的時候點右上角的小地圖（下面寫「🗺 大地圖」）→ 整個畫面一張地圖：拖一拖、兩指放大（電腦：滑輪）、＋－、📍 回到你
//   點一個地方（家、改、車⋯）→ 下面一張卡：名字、離你多遠、「去這裡」（＝目的地：左上角的箭頭、橘色路線）
//   地圖是小地圖同一張底圖（walk.js 的 mapLayer：村子、越野車場、賽車場、山、快速道路）＋內湖自己畫（world.mapLive）；下面一定寫 OSM 的字
//   只有打開的時候才畫（拖的時候每一幀、沒動的時候一秒 4 次：你和點會動）
// const M = createBigMap({ parent, world, layer: () => walker.mapLayer, me: () => ({ x, z, h }), dots: () => [陣列, …], dest: () => 目的地,
//                          onGo(key), onOpen(), onClose() })
//   M.open()、M.close()、M.isOpen、M.pick(key)（測試：點那個地方）、M.view（{ x, z, w }：畫面中間、寬幾公尺）、M.zoom(f)、M.home()、M.el、M.info（畫一次幾毫秒）、M.dispose()
//   dots：小地圖上的點同一種（{ x, z, fill, ring, r, on, label, name }）；name＝旁邊寫名字（一起開車的朋友）
//   h：你朝哪裡（drive.js 的 heading：0＝往 +x）
// 打包（build-art.mjs／build-app.mjs）：接在 walk.js 後面（用 drive.js 的 DRIVE_DEST）
import { DRIVE_DEST } from './drive.js';

export const { createBigMap, BIGMAP_STYLE } = (() => {
  const COND = '"Barlow Condensed", "Arial Narrow", sans-serif', SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
  const TAU = Math.PI * 2, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // 地圖上的地方：小地圖那幾個＋賽車場（小地圖只有要去的時候才畫）
  const STYLE = { ...DRIVE_DEST, circuit: { label: '去賽車場', icon: '圈', bg: '#D0342C', fg: '#FFFFFF' } };
  const NAME = { track: '直線加速（400 公尺）', circuit: '大便龍賽車場', mountain: '山頂', garage: '你的車庫' };
  const CSS = `
.bm{position:absolute;inset:0;z-index:30;background:#1A1C20;color:#F2F3F5;font-family:${SANS};-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;overflow:hidden}
.bm[hidden]{display:none}
.bm canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab}
.bm-top{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:10px;padding:10px 10px 22px 16px;background:linear-gradient(rgba(10,11,13,0.92),rgba(10,11,13,0));pointer-events:none}
.bm-top b{font-size:20px;font-weight:700}
.bm-top small{font-size:13px;color:#B8BCC4}
.bm-x{margin-left:auto;width:44px;height:44px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.28);background:rgba(14,15,18,0.82);color:#F2F3F5;font:700 20px/1 ${SANS};display:grid;place-items:center;pointer-events:auto;cursor:pointer;padding:0}
.bm-z{position:absolute;right:10px;bottom:104px;display:flex;flex-direction:column;gap:8px}
.bm-z button{width:46px;height:46px;border-radius:13px;border:1.5px solid rgba(255,255,255,0.22);background:rgba(14,15,18,0.85);color:#F2F3F5;font:700 22px/1 ${SANS};display:grid;place-items:center;cursor:pointer;padding:0}
.bm-z button svg{width:22px;height:22px}
.bm-card{position:absolute;left:10px;right:10px;bottom:12px;max-width:520px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:11px 12px 11px 14px;border-radius:18px;background:rgba(20,21,25,0.95);border:1.5px solid rgba(255,255,255,0.12)}
.bm-card[hidden]{display:none}
.bm-card i{flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font:700 19px/1 ${SANS};font-style:normal}
.bm-card div{min-width:0;flex:1}
.bm-card b{display:block;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bm-card small{font-size:13px;color:#B8BCC4}
.bm-go{flex:none;height:46px;padding:0 18px;border:0;border-radius:999px;background:#FF6A1F;color:#1A0F07;font:900 16px/1 ${SANS};cursor:pointer}
.bm-go[disabled]{background:#3DDC84;cursor:default}
.bm-hint{position:absolute;left:0;right:0;bottom:20px;text-align:center;font-size:14px;color:#C6CAD1;pointer-events:none}
.bm-osm{position:absolute;left:10px;bottom:84px;font-size:10px;color:rgba(255,255,255,0.62);pointer-events:none}
`;
  const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" fill="#FF6A1F"/><circle cx="12" cy="10" r="2.6" fill="#1A0F07"/></svg>';

  function createBigMap(o) {
    const world = o.world, places = world.places || {};
    if (!document.getElementById('bm-style')) { const s = document.createElement('style'); s.id = 'bm-style'; s.textContent = CSS; document.head.append(s); }
    const root = document.createElement('div'); root.className = 'bm'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', '地圖');
    root.innerHTML = '<canvas></canvas><div class="bm-top"><b>地圖</b><small>拖一拖、兩指放大</small><button type="button" class="bm-x" aria-label="關掉地圖">✕</button></div>'
      + `<div class="bm-z"><button type="button" data-z="in" aria-label="放大">＋</button><button type="button" data-z="out" aria-label="縮小">－</button><button type="button" data-z="me" aria-label="回到你">${PIN}</button></div>`
      + '<div class="bm-osm">內湖：地圖資料 © OpenStreetMap 貢獻者</div><div class="bm-hint">點一個地方，可以叫它帶你去</div>'
      + '<div class="bm-card" hidden><i></i><div><b></b><small></small></div><button type="button" class="bm-go">去這裡</button></div>';
    o.parent.append(root);
    const q = (s) => root.querySelector(s), cv = q('canvas'), g = cv.getContext('2d'), card = q('.bm-card'), hint = q('.bm-hint'), goB = q('.bm-go');
    const off = [], on = (el, t, f, opt) => { el.addEventListener(t, f, opt); off.push(() => el.removeEventListener(t, f, opt)); };
    const V = { x: 0, z: 0, w: 700 }; // 畫面中間（世界座標）、畫面寬幾公尺
    const B = world.bounds || { x0: -1100, x1: 1800, z0: -800, z1: 1700 }, MAXW = Math.max(B.x1 - B.x0, B.z1 - B.z0) * 1.15, MINW = 90;
    let open = false, sel = null, dirty = true, raf = 0, tick = 0, cw = 1, ch = 1, dpr = 1, ms = 0;
    const ic = []; // 這一次畫的地方（點的時候找最近的）：{ key, sx, sy }
    const ptr = new Map(); let moved = 0, pinch = 0;
    const placeXZ = (p) => (p.pos ? p.pos : p.x != null ? [p.x, p.z] : p.zone ? [p.zone.x, p.zone.z] : p.lot ? [p.lot.x, p.lot.z] : null);
    const nameOf = (k) => NAME[k] || (places[k] && places[k].name) || k;
    const toS = (x, z) => { const k = cw / V.w; return [(x - V.x) * k + cw / 2, (z - V.z) * k + ch / 2]; };

    function size() {
      const r = root.getBoundingClientRect(); dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
      cw = Math.max(1, r.width); ch = Math.max(1, r.height);
      const W = Math.round(cw * dpr), H = Math.round(ch * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      dirty = true;
    }
    function draw() {
      const t0 = performance.now(), k = cw / V.w, vh = (ch / cw) * V.w;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#1A1C20'; g.fillRect(0, 0, cw, ch);
      g.save(); g.translate(cw / 2, ch / 2); g.scale(k, k); g.translate(-V.x, -V.z);
      const L = o.layer && o.layer(); g.imageSmoothingEnabled = true;
      if (L) g.drawImage(L.c, L.x0, L.z0, L.c.width / L.ms, L.c.height / L.ms);
      if (world.mapLive) world.mapLive(g, V.x, V.z, Math.hypot(V.w, vh) / 1.8); // 內湖：畫面裡的路、房子、公園
      const route = o.route && o.route();
      if (route && route.pts && route.pts.length > 1) {
        g.strokeStyle = '#FF6A1F'; g.lineWidth = 4 / k; g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash(route.straight ? [7 / k, 6 / k] : []); g.beginPath();
        route.pts.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.stroke(); g.setLineDash([]);
      }
      g.restore();
      // 地方（字是正的；不跟著放大）
      const dest = o.dest && o.dest(); ic.length = 0;
      for (const key in STYLE) {
        const p = places[key], xz = p && placeXZ(p); if (!xz) continue;
        const [sx, sy] = toS(xz[0], xz[1]); if (sx < -30 || sy < -30 || sx > cw + 30 || sy > ch + 30) continue;
        ic.push({ key, sx, sy });
      }
      ic.sort((a, b) => (a.key === sel || a.key === dest) - (b.key === sel || b.key === dest));
      for (const { key, sx, sy } of ic) {
        const d = STYLE[key], big = key === sel, r = big ? 15 : key === dest ? 13 : 12;
        g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fillStyle = d.bg; g.fill();
        g.lineWidth = big ? 3.5 : 2; g.strokeStyle = big || key === dest ? '#FF6A1F' : 'rgba(242,243,245,0.88)'; g.stroke();
        g.fillStyle = d.fg; g.font = `700 ${Math.round(r * 1.15)}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d.icon, sx, sy + 0.5);
      }
      // 點（警車、比賽的對手、朋友）
      const lists = (o.dots && o.dots()) || [];
      for (const list of lists) for (let i = 0; list && i < list.length; i++) {
        const m = list[i]; if (!m || m.on === false) continue;
        const [sx, sy] = toS(m.x, m.z); if (sx < -20 || sy < -20 || sx > cw + 20 || sy > ch + 20) continue;
        const rr = (m.r || 5) * 1.25;
        g.beginPath(); g.arc(sx, sy, rr, 0, TAU); g.fillStyle = m.fill || '#FF3B30'; g.fill();
        if (m.ring) { g.lineWidth = 1.6; g.strokeStyle = m.ring; g.stroke(); }
        if (m.label != null) { g.fillStyle = m.fg || '#FFFFFF'; g.font = `700 ${Math.round(rr * 1.4)}px ${COND}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(m.label), sx, sy + 0.5); }
        if (m.name) { g.font = `700 13px ${SANS}`; const w = g.measureText(m.name).width + 12; g.fillStyle = 'rgba(14,15,18,0.82)'; g.beginPath(); g.roundRect ? g.roundRect(sx + rr + 3, sy - 10, w, 20, 10) : g.rect(sx + rr + 3, sy - 10, w, 20); g.fill(); g.fillStyle = '#FFFFFF'; g.textAlign = 'left'; g.fillText(m.name, sx + rr + 9, sy + 0.5); }
      }
      // 你
      const me = o.me && o.me();
      if (me) {
        const [sx, sy] = toS(me.x, me.z);
        g.save(); g.translate(sx, sy); g.rotate(Math.PI / 2 - (me.h || 0));
        g.beginPath(); g.moveTo(0, -12); g.lineTo(9.5, 9.5); g.lineTo(0, 4.5); g.lineTo(-9.5, 9.5); g.closePath();
        g.fillStyle = '#F2F3F5'; g.fill(); g.lineWidth = 2.6; g.lineJoin = 'round'; g.strokeStyle = '#FF6A1F'; g.stroke(); g.restore();
      }
      dirty = false; ms = performance.now() - t0;
    }
    function loop(now) {
      raf = 0; if (!open) return;
      if (now - tick > 250) { tick = now; dirty = true; } // 你、點會動：一秒 4 次
      if (dirty) { draw(); if (sel) showCard(); }
      raf = requestAnimationFrame(loop);
    }
    const kick = () => { dirty = true; if (open && !raf) raf = requestAnimationFrame(loop); };
    function showCard() {
      const k = sel, d = k && STYLE[k], p = k && places[k], xz = p && placeXZ(p);
      if (!xz) { card.hidden = true; hint.hidden = false; return; }
      card.hidden = false; hint.hidden = true;
      const i = card.querySelector('i'), me = o.me && o.me(), dist = me ? Math.hypot(xz[0] - me.x, xz[1] - me.z) : 0;
      if (i.textContent !== d.icon) { i.textContent = d.icon; i.style.background = d.bg; i.style.color = d.fg; }
      const nm = nameOf(k), here = dist < 30, txt = here ? '你就在這裡' : `離你 ${dist >= 1000 ? (dist / 1000).toFixed(1) + ' 公里' : Math.round(dist / 10) * 10 + ' 公尺'}`;
      card.querySelector('b').textContent = nm; card.querySelector('small').textContent = txt;
      const going = o.dest && o.dest() === k; goB.disabled = going; goB.textContent = going ? '正在去 ✓' : '去這裡';
    }
    function pick(k) { sel = STYLE[k] && places[k] ? k : null; showCard(); kick(); return sel; }
    function zoom(f, sx = cw / 2, sy = ch / 2) {
      const k0 = cw / V.w, wx = V.x + (sx - cw / 2) / k0, wz = V.z + (sy - ch / 2) / k0;
      V.w = clamp(V.w / f, MINW, MAXW); const k1 = cw / V.w;
      V.x = wx - (sx - cw / 2) / k1; V.z = wz - (sy - ch / 2) / k1; keep(); kick();
    }
    function keep() { V.x = clamp(V.x, B.x0 - 200, B.x1 + 200); V.z = clamp(V.z, B.z0 - 200, B.z1 + 200); } // 不會拖到世界外面很遠
    function home() { const me = o.me && o.me(); if (me) { V.x = me.x; V.z = me.z; } V.w = Math.min(V.w, 700); kick(); }
    // ---- 手指 ----
    on(cv, 'pointerdown', (e) => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch { /* 沒有就算了 */ } ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }); if (ptr.size === 1) moved = 0; pinch = 0; });
    on(cv, 'pointermove', (e) => {
      const P = ptr.get(e.pointerId); if (!P) return;
      const r = cv.getBoundingClientRect(), dx = e.clientX - P.x, dy = e.clientY - P.y; P.x = e.clientX; P.y = e.clientY;
      if (ptr.size === 1) { moved = Math.max(moved, Math.hypot(e.clientX - P.x0, e.clientY - P.y0)); const k = cw / V.w; V.x -= dx / k; V.z -= dy / k; keep(); kick(); }
      else if (ptr.size === 2) {
        const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y); moved = 99;
        if (pinch) zoom(d / pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        pinch = d;
      }
    });
    const up = (e) => {
      if (!ptr.has(e.pointerId)) return; ptr.delete(e.pointerId); pinch = 0;
      if (e.type !== 'pointerup' || ptr.size || moved > 8) return;
      const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top; let best = null, bd = 26; // 點：最近的地方（26 px 以內）
      for (const it of ic) { const d = Math.hypot(it.sx - sx, it.sy - sy); if (d < bd) { bd = d; best = it.key; } }
      pick(best);
    };
    for (const t of ['pointerup', 'pointercancel']) on(cv, t, up);
    on(cv, 'wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.25 : 1 / 1.25, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    on(q('.bm-x'), 'click', () => close());
    on(root, 'contextmenu', (e) => e.preventDefault());
    for (const b of root.querySelectorAll('.bm-z button')) on(b, 'click', () => { const z = b.dataset.z; if (z === 'in') zoom(1.6); else if (z === 'out') zoom(1 / 1.6); else home(); });
    on(goB, 'click', () => { if (!sel || goB.disabled) return; const k = sel; if (o.onGo) o.onGo(k, nameOf(k)); close(); });
    on(document, 'keydown', (e) => { if (open && e.key === 'Escape') { e.preventDefault(); close(); } });
    if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(() => { if (open) { size(); kick(); } }); ro.observe(root); off.push(() => ro.disconnect()); }

    function show() {
      if (open) return;
      open = true; root.hidden = false; sel = null; card.hidden = true; hint.hidden = false;
      const me = o.me && o.me(); if (me) { V.x = me.x; V.z = me.z; } V.w = 700;
      size(); kick();
      if (o.onOpen) o.onOpen();
    }
    function close() {
      if (!open) return;
      open = false; root.hidden = true; ptr.clear(); if (raf) cancelAnimationFrame(raf); raf = 0;
      if (o.onClose) o.onClose();
    }
    return {
      open: show, close, pick, zoom, home, el: root,
      get isOpen() { return open; }, get view() { return { ...V }; }, get selected() { return sel; }, get info() { return { ms: +ms.toFixed(2), places: ic.length }; },
      draw() { if (open) { size(); draw(); } },
      dispose() { close(); for (const f of off) f(); root.remove(); },
    };
  }
  return { createBigMap, BIGMAP_STYLE: STYLE };
})();
