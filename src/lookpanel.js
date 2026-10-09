// ---- 自訂角色（第 2 批）：你自己的樣子 ----
// Nick 2026-09-28：「⋯人要可以下車走來走去⋯可以自訂角色⋯」
// 畫面（手機直拿為主）：最上面一排「取消」「自訂角色」「隨機」「完成」；下面是 3D 預覽（人站在轉盤上慢慢轉，手指左右拖可以自己轉）；
//   再下面是選項（CHARACTER_OPTIONS 的順序，分成 身體／頭髮／衣服／配件 四段），選了馬上換在預覽的人身上
//   手機橫拿、電腦（寬的畫面）：預覽在左邊、選項在右邊
// 【API】
//   createLookPanel({ parent = document.body, onDone(look), onCancel() }) → P
//     P.open(look)     從這個樣子開始改（沒給＝PLAYER_LOOK）；第一次打開才做預覽用的 WebGLRenderer（自己一個，不跟頁面的共用）
//     P.close()        關掉（不存）；P.isOpen；P.look（現在改到的樣子，完整的）；P.el；P.character（預覽的人）；P.set(key, value)（跟點選項一樣）
//     P.random()、P.done()、P.cancel()   跟按「隨機」「完成」「取消」一樣
//     完成 → onDone(完整的樣子)；取消、Esc → onCancel()
//   validLook(look) → 只留認得的欄位（CHARACTER_OPTIONS 的 key＋seed）、值不對的丟掉；身高照年紀夾在範圍裡（存檔讀回來用）；什麼都沒有回傳 null
//   PLAYER_MAX_H：你自己最高幾公尺（1.9：車庫升降機升起來的平台底下走得過去；走路的鏡頭看的那一點最高 1.78，walk.js）
// 預覽只在打開的時候畫（requestAnimationFrame），關掉就停；樣式在 garage.css 的 .lookp（跟車庫頁一樣的深色、主色）
import * as THREE from 'three';
import { buildCharacter, randomLook, CHARACTER_OPTIONS, PLAYER_LOOK } from './character.js';

export const { createLookPanel, validLook, PLAYER_MAX_H } = (() => {
const PLAYER_MAX_H = 1.9;
const OPT = Object.fromEntries(CHARACTER_OPTIONS.map((o) => [o.key, o]));
const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// 分段（選項的順序照 CHARACTER_OPTIONS；新加的選項沒列在這裡就放最後一段）
const SECTIONS = [
  ['身體', ['body', 'age', 'height', 'build', 'skin', 'face']],
  ['頭髮', ['hair', 'hairColor']],
  ['衣服', ['top', 'topColor', 'bottom', 'bottomColor', 'shoes', 'shoesColor']],
  ['配件', ['hat', 'hatColor', 'glasses', 'mask', 'maskColor']],
];
const fixedColor = (key, v) => !!OPT[key]?.choices.find((c) => c.value === v)?.fixedColor; // 藍白拖、斗笠：不用選顏色
// 看情況才出現的選項：光頭沒有髮色、不戴帽子沒有帽子顏色、沒戴口罩沒有口罩顏色
const SHOW = {
  hairColor: (L) => L.hair !== 'bald',
  shoesColor: (L) => !fixedColor('shoes', L.shoes),
  hatColor: (L) => L.hat !== 'none' && !fixedColor('hat', L.hat),
  maskColor: (L) => !!L.mask,
};
const rangeOf = (age) => { const o = OPT.height; return age === 'kid' ? [o.minKid, o.maxKid] : [o.min, Math.min(o.max, PLAYER_MAX_H)]; };
const ageHeight = (L) => { const a = OPT.age.choices.find((c) => c.value === L.age) || {}; return +(L.body === 'f' && a.heightF ? a.heightF : a.height || 1.72).toFixed(2); };

function validLook(L) {
  if (!L || typeof L !== 'object') return null;
  const out = {};
  for (const o of CHARACTER_OPTIONS) {
    const v = L[o.key];
    if (v === undefined) continue;
    if (o.type === 'color') { if (typeof v === 'string' && HEX.test(v)) out[o.key] = v.toLowerCase(); }
    else if (o.type === 'range') { if (typeof v === 'number' && Number.isFinite(v)) out[o.key] = v; }
    else if (o.choices.some((c) => c.value === v)) out[o.key] = v;
  }
  if (Number.isInteger(L.seed)) out.seed = L.seed;
  if (out.height != null) { const [a, b] = rangeOf(out.age ?? PLAYER_LOOK.age); out.height = +clamp(out.height, a, b).toFixed(2); }
  return Object.keys(out).length ? out : null;
}
const full = (L) => { const v = { ...PLAYER_LOOK, ...(validLook(L) || {}) }; const [a, b] = rangeOf(v.age); v.height = +clamp(v.height ?? ageHeight(v), a, b).toFixed(2); return v; };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function createLookPanel(o = {}) {
  const parent = o.parent || document.body;
  const el = document.createElement('section');
  el.className = 'lookp'; el.hidden = true; el.tabIndex = -1;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '自訂角色');
  el.innerHTML = '<div class="lk-head"><button type="button" class="ghost lk-cancel">取消</button>'
    + '<div class="lk-title"><b>自訂角色</b><span>你自己的樣子</span></div>'
    + '<button type="button" class="ghost lk-rand">隨機</button><button type="button" class="primary lk-done">完成</button></div>'
    + '<div class="lk-body"><div class="lk-view"><canvas aria-label="預覽：手指左右拖可以轉"></canvas><span class="lk-hint">手指左右拖可以轉</span><span class="lk-wait" role="status">準備中⋯</span></div>'
    + '<div class="lk-opts"></div></div>';
  parent.append(el);
  const q = (s) => el.querySelector(s), view = q('.lk-view'), canvas = q('canvas'), opts = q('.lk-opts'), wait = q('.lk-wait');
  let cur = full(PLAYER_LOOK), isOpen = false, dirty = false, play = null;

  // ---- 選項 ----
  const groups = {}; // key → { g, btns: Map(value → button), range, val }
  const seen = new Set();
  const sections = SECTIONS.map(([t, keys]) => [t, keys.filter((k) => OPT[k] && !seen.has(k) && seen.add(k))]);
  const rest = CHARACTER_OPTIONS.map((x) => x.key).filter((k) => !seen.has(k));
  if (rest.length) sections[sections.length - 1][1].push(...rest);
  for (const [title, keys] of sections) {
    const h = document.createElement('h3'); h.className = 'optsub'; h.textContent = title; opts.append(h);
    for (const k of keys) {
      const op = OPT[k], g = document.createElement('div'), G = { g, btns: new Map() };
      g.className = 'group lk-g'; g.dataset.k = k;
      const h2 = document.createElement('h2'); h2.textContent = op.label; g.append(h2);
      if (op.type === 'range') {
        const w = document.createElement('div'); w.className = 'lk-range';
        w.innerHTML = `<input type="range" aria-label="${esc(op.label)}" step="${op.step || 0.01}"><b></b>`;
        G.range = w.querySelector('input'); G.val = w.querySelector('b');
        G.range.addEventListener('input', () => set(k, +G.range.value));
        g.append(w);
        const pills = document.createElement('div'); pills.className = 'seg pills lk-presets';
        for (const c of op.choices) { const b = document.createElement('button'); b.type = 'button'; b.textContent = c.label; b.dataset.v = c.value; b.addEventListener('click', () => set(k, +c.value)); pills.append(b); G.btns.set(c.value, b); }
        g.append(pills);
      } else if (op.type === 'color') {
        const box = document.createElement('div'); box.className = 'chips';
        for (const c of op.choices) {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.style.background = c.swatch || c.value;
          b.setAttribute('aria-label', c.label); b.title = c.label; b.addEventListener('click', () => set(k, c.value)); box.append(b); G.btns.set(c.value, b);
        }
        g.append(box);
      } else {
        const box = document.createElement('div'); box.className = 'seg pills';
        for (const c of op.choices) { const b = document.createElement('button'); b.type = 'button'; b.textContent = c.label; b.addEventListener('click', () => set(k, c.value)); box.append(b); G.btns.set(c.value, b); }
        g.append(box);
      }
      groups[k] = G; opts.append(g);
    }
  }
  function sync() { // 選項跟著現在的樣子：按下去的、看情況才出現的、身高的範圍
    for (const [k, G] of Object.entries(groups)) {
      const v = cur[k];
      G.g.hidden = SHOW[k] ? !SHOW[k](cur) : false;
      if (G.range) {
        const [a, b] = rangeOf(cur.age);
        G.range.min = a; G.range.max = b; G.range.value = v; G.val.textContent = `${(+v).toFixed(2)} 公尺`;
        for (const [pv, btn] of G.btns) { btn.hidden = cur.age === 'kid' || pv < a - 1e-6 || pv > b + 1e-6; btn.setAttribute('aria-pressed', String(Math.abs(pv - v) < 0.005)); } // 矮／普通／高／很高是大人的
      } else for (const [pv, btn] of G.btns) btn.setAttribute('aria-pressed', String(k.endsWith('Color') || OPT[k].type === 'color' ? String(pv).toLowerCase() === String(v).toLowerCase() : pv === v));
    }
  }
  function set(k, v) {
    const L = { ...cur };
    if (k === 'height') { const [a, b] = rangeOf(L.age); L.height = +clamp(+v, a, b).toFixed(2); }
    else { L[k] = v; if (k === 'age' || k === 'body') L.height = ageHeight(L); } // 換年紀、性別：身高換成那一種人的平均
    const [a, b] = rangeOf(L.age); L.height = +clamp(L.height, a, b).toFixed(2);
    cur = L; dirty = true; sync();
  }

  // ---- 3D 預覽（自己的 renderer，第一次打開才做）----
  let R = null;
  function gl() {
    if (R) return R;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xe8eef8, 0x34302b, 1.25));
    const key = new THREE.DirectionalLight(0xfff2e2, 2.0); key.position.set(2.4, 3.6, 3.0); scene.add(key);
    const fill = new THREE.DirectionalLight(0xd2e2ff, 0.5); fill.position.set(-3.2, 1.6, 1.8); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffb27f, 1.1); rim.position.set(-1.2, 2.8, -3.4); scene.add(rim);
    // 轉盤：深色的圓＋主色的一圈（跟車庫頁的轉盤一樣的感覺）
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.85 }));
    const ringM = new THREE.MeshBasicMaterial({ color: 0xff6a1f }), ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.64, 96).rotateX(-Math.PI / 2), ringM);
    ring.position.y = 0.003; scene.add(disc, ring);
    const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 40);
    R = { renderer, scene, cam, ringM, C: null, yaw: -Math.PI / 2 + 0.55, idle: 0, drag: null, last: 0, raf: 0, w: 0, h: 0, fitH: 0, fy: 0, fd: 0 };
    // 手指左右拖：自己轉（放開一下子以後又自己慢慢轉）
    canvas.addEventListener('pointerdown', (e) => { R.drag = { id: e.pointerId, x: e.clientX, yaw: R.yaw }; try { canvas.setPointerCapture(e.pointerId); } catch { /* 算了 */ } });
    canvas.addEventListener('pointermove', (e) => { if (R.drag && e.pointerId === R.drag.id) { R.yaw = R.drag.yaw + (e.clientX - R.drag.x) * 0.012; R.idle = 0; } });
    const up = (e) => { if (R.drag && e.pointerId === R.drag.id) { R.drag = null; R.idle = 0; } };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    return R;
  }
  function fit(snap) { // 鏡頭：整個人（頭髮、帽子）放得下，照身高拉遠拉近
    const h = (R.C?.height || cur.height) + 0.16, want = { y: h * 0.47, d: (h / 0.74) / (2 * Math.tan((R.cam.fov * Math.PI) / 360)) / Math.min(1, R.cam.aspect * 1.45) };
    if (snap) { R.fy = want.y; R.fd = want.d; } else { R.fy += (want.y - R.fy) * 0.15; R.fd += (want.d - R.fd) * 0.15; }
    R.cam.position.set(0, R.fy + R.fd * 0.1, R.fd); R.cam.lookAt(0, R.fy, 0);
  }
  function frame(now) {
    if (!isOpen || !R) { if (R) R.raf = 0; return; }
    R.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - R.last) / 1000 || 0); R.last = now;
    const w = view.clientWidth, h = view.clientHeight;
    if (w && h && (w !== R.w || h !== R.h)) { R.w = w; R.h = h; R.renderer.setSize(w, h, false); R.cam.aspect = w / h; R.cam.updateProjectionMatrix(); fit(true); }
    if (!R.C) return;
    if (dirty) { dirty = false; R.C.setLook({ ...cur }); }
    if (!R.drag) { R.idle += dt; if (R.idle > 1.5) R.yaw += dt * 0.5; }
    R.C.group.rotation.y = R.yaw;
    R.C.update(dt, play ? { state: play } : NOSTATE); play = null;
    fit(false);
    R.renderer.render(R.scene, R.cam);
  }
  const NOSTATE = {};
  function start() {
    gl();
    const acc = getComputedStyle(el).getPropertyValue('--accent').trim(); // 主色（App 可以換顏色）
    try { if (acc) R.ringM.color.set(acc); } catch { /* 顏色看不懂就用橘色 */ }
    wait.hidden = !!R.C;
    const go = () => {
      if (!isOpen) return;
      if (!R.C) { R.C = buildCharacter({ ...cur }, { state: 'idle' }); R.scene.add(R.C.group); wait.hidden = true; } // 第一個人會先畫共用的貼圖（手機 0.1–0.5 秒）
      else R.C.setLook({ ...cur });
      dirty = false; R.last = performance.now(); fit(true);
      if (!R.raf) R.raf = requestAnimationFrame(frame);
    };
    if (R.C) go(); else setTimeout(go, 30); // 先讓畫面出來（「準備中⋯」），再做人
  }

  function open(look) {
    cur = full(look); dirty = true; isOpen = true;
    el.hidden = false; document.documentElement.classList.add('lk-open');
    opts.scrollTop = 0; sync();
    if (R) R.yaw = -Math.PI / 2 + 0.55;
    start();
    el.focus({ preventScroll: true }); // 鍵盤：Esc 取消
  }
  function close() {
    if (!isOpen) return;
    isOpen = false; el.hidden = true; document.documentElement.classList.remove('lk-open');
    if (R?.raf) { cancelAnimationFrame(R.raf); R.raf = 0; }
    if (R) R.drag = null;
  }
  const P = {
    el, open, close, set,
    get isOpen() { return isOpen; }, get look() { return { ...cur }; }, get character() { return R?.C || null; },
    random() { cur = full({ ...randomLook(), seed: Math.floor(Math.random() * 1e6) }); dirty = true; play = 'wave'; sync(); }, // 村子裡隨便一個人的樣子，揮個手
    done() { const L = { ...cur }; close(); o.onDone?.(L); },
    cancel() { close(); o.onCancel?.(); },
    dispose() { close(); R?.C?.dispose(); R?.renderer.dispose(); R = null; el.remove(); },
  };
  q('.lk-cancel').addEventListener('click', () => P.cancel());
  q('.lk-rand').addEventListener('click', () => P.random());
  q('.lk-done').addEventListener('click', () => P.done());
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); P.cancel(); } });
  return P;
}

return { createLookPanel, validLook, PLAYER_MAX_H };
})();
