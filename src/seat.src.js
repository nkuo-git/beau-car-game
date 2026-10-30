// ==== 第 57 批：每個位子都可以坐（Nick 2026-10-30「車子的每個位子都可以坐」；草稿 /mnt/project-files/car-game/seats/seats-v1.jpg，卡片選「好，照圖做」）====
// 走到車子旁邊：「上車」＝開（照舊）；新的「選位子」（深色那顆）＝挑要坐哪裡（上面看下去的車，車頭朝上；駕駛座＝開車；有人坐的灰色、你坐的黃色）
// 坐別的位子：車子不會動；右上 👁 換第一人稱／從外面看（拖畫面：轉頭、繞著車看）；右邊「換位子」「下車」；換到駕駛座＝開
// 開車的時候從外面看得到你坐在駕駛座（手握方向盤、跟著轉）；駕駛座視角不畫自己（沙灘車照第 56 批騎的人）
// 大家的世界：朋友的車停著（他下車走路）或停下來（他在開、停住了）→「選位子」→ 他的手機跳「🚗 X想坐你的車」好／不要 → 好：你走過去坐進去，他開車你跟著走
//   你這邊：他的車換成完整的車（看得到車裡），你坐在那個位子；左上「🚗 坐在 X 的車上」；車停下來才能下車；他回家、去比賽、離開世界、換車：你在他的車旁邊下車
//   大家那邊：坐在車上的人畫在那台車的位子上（開的人坐駕駛座、手握方向盤；以前朋友的車裡面是空的）
//   送的：world/p 多 st（我在我自己的車坐第幾個位子）、o 5＋rd [車主, 位子, 車]（坐在朋友的車上）、nr（我在比賽：坐我車的人要下車）
//   網站（site/world.js）：matches/{id}（kind 'ride'）＋ world/ch（s、k）：跟按門鈴同一條路（封鎖、關掉邀請的問不到）；規則不用改
// 接在 net.src.js 後面（同一個 module）；town.src.js driveStep 在 netStep 後面叫 seatsStep（朋友的車這一格的位置才是新的）
const seClamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const SEAT_CACHE = {};
function seatsOf(k) { if (!k || !CARS[k]) return []; return SEAT_CACHE[k] || (SEAT_CACHE[k] = cabinSeats(k) || []); } // 沙灘車、怪獸卡車：沒有（cabin.js 沒有車內）
const seatName = (k, i) => seatsOf(k)[i]?.n || '位子';
function seatGo(k, i, cx) { const s = seatsOf(k)[i]; return s ? { i, side: s.side || 0, u: s.hip[0] + 0.1 - (+cx || 0) } : null; } // walk.js getIn 的 seat：走去那一邊、屁股前面一點的門

// ---- 你自己坐在車上（另外一個人：走路的那個藏起來了）----
const MYSIT = { C: null, lk: null, S: null, k: '', i: -1, P: {}, st: 9 };
function mySitMake() {
  const L = meLook();
  if (MYSIT.C && MYSIT.lk === L) return MYSIT.C;
  try {
    if (!MYSIT.C) { MYSIT.C = buildCharacter(L, { state: 'sit', shadow: false, plant: false }); MYSIT.C.group.name = 'seat-me'; MYSIT.C.group.userData.seated = true; }
    else { MYSIT.C.setLook(L); MYSIT.S = null; } // 換了樣子（身高可能不一樣）：重新坐
    MYSIT.lk = L;
  } catch (e) { console.error(e); MYSIT.C = null; }
  return MYSIT.C;
}
function mySitOn(Sx, k, i, vis) {
  const s = seatsOf(k)[i], C = s && Sx?.body ? mySitMake() : null;
  if (!C) { mySitOff(); return null; }
  if (MYSIT.S !== Sx || MYSIT.k !== k || MYSIT.i !== i || C.group.parent !== Sx.body) { Sx.body.add(C.group); seatPlace(C, s, MYSIT.P); MYSIT.S = Sx; MYSIT.k = k; MYSIT.i = i; MYSIT.st = 0; }
  C.group.visible = !!vis;
  return C;
}
function mySitOff() { const C = MYSIT.C; if (C) { C.group.removeFromParent(); C.group.visible = false; } MYSIT.S = null; MYSIT.k = ''; MYSIT.i = -1; }
function mySitSteer(steer) { // 開車：手跟著方向盤（變了才算）
  const C = MYSIT.C; if (!C || !C.group.visible || !MYSIT.P.s?.wheel || Math.abs(steer - MYSIT.st) < 0.01) return;
  MYSIT.st = steer; seatSteer(C, MYSIT.P, steer); C.update(1 / 30, MYSIT.P);
}
// 車子要收掉（釋放、搬回車庫頁）：坐在上面的人先拿下來（人的材質大家共用，不能跟著車一起釋放）
function seatDetach(body) {
  if (!body) return;
  for (const o of [...body.children]) if (o.userData.seated) { o.removeFromParent(); o.visible = false; }
  if (MYSIT.S && MYSIT.S.body === body) MYSIT.S = null;
  if (typeof NET !== 'undefined') for (const P of NET.P.values()) if (P.sit && P.sit.B === body) P.sit.B = null;
}

// ---- 坐在哪台車的哪個位子（有人坐的：名字）----
function seatTaken(host, k, hn) {
  const T = [];
  if (NET.on) for (const P of NET.P.values()) {
    const c = P.cur; if (netNow() - P.last > 6000) continue;
    if (c.o === 5 && c.rd && c.rd[0] === host && c.rd[2] === k) T[c.rd[1]] = P.n || '朋友';
    else if (P.uid === host && c.o === 1 && c.k === k) T[c.st | 0] = P.n || '朋友';
  }
  if (hn && !T[0]) T[0] = hn; // 朋友的車：駕駛座是他的（他下車走路也一樣）
  if (HOP.on && HOP.uid === host && HOP.k === k) T[HOP.i] = '你';
  return T;
}

// ---- 畫面：選位子（上面看下去的車）、坐著的時候（左上誰的車、右上 👁、右邊換位子／下車、提示）----
const SEAT_SVG = {
  seat: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="5.4" height="3.2" rx="1.3"/><path d="M9.4 5.7L7.6 15h9.2a1.4 1.4 0 0 1 1.4 1.4V17"/><path d="M11 17v4M7 21h8"/></svg>',
  car: '<svg viewBox="0 0 24 24"><path d="M3.5 16.5v-3.2l1.8-4.4a1.6 1.6 0 0 1 1.5-1h10.4a1.6 1.6 0 0 1 1.5 1l1.8 4.4v3.2z"/><path d="M3.5 13.3h17"/><circle cx="7.6" cy="18.2" r="1.7"/><circle cx="16.4" cy="18.2" r="1.7"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6.2 9.5-6.2 9.5 6.2 9.5 6.2-3.5 6.2-9.5 6.2S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
};
let SEATUI = null;
function seatUi() {
  if (SEATUI) return SEATUI;
  const F = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
  const st = document.createElement('style'); st.id = 'seat-style';
  st.textContent = `.sp{position:absolute;inset:0;z-index:12;display:grid;place-items:center;background:rgba(0,0,0,0.38);font-family:${F};color:#F2F3F5;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.sp[hidden],.ps[hidden],.ps [hidden]{display:none!important}
.sp-box{position:relative;width:min(300px,calc(100% - 24px));box-sizing:border-box;padding:12px 14px 14px;border-radius:18px;background:#202227;box-shadow:0 10px 30px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:9px;align-items:center}
.sp-box h3{margin:0;padding:4px 36px 0;font-size:21px;font-weight:700;text-align:center;text-wrap:balance}
.sp-x{position:absolute;top:8px;right:8px;width:36px;height:36px;border:0;border-radius:50%;background:#2c2e33;color:#c4c7cc;font:700 16px/1 ${F};cursor:pointer;touch-action:manipulation}
.sp-car{position:relative;flex:none;width:170px;height:250px;border-radius:60px 60px 46px 46px;background:#2c4fb8;box-shadow:inset 0 0 0 4px #1b2f73}
.sp-car.two{height:196px}
.sp-ws{position:absolute;left:20px;right:20px;top:38px;height:26px;border-radius:12px 12px 4px 4px;background:#8fb3d9;opacity:.8}
.sp-seat{position:absolute;width:60px;height:56px;box-sizing:border-box;margin:0;padding:2px;border:0;border-radius:12px;background:#FF6A1F;color:#1A0F07;font:700 14px/1.1 ${F};white-space:pre-line;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;text-align:center;box-shadow:0 3px 0 #9E4213;cursor:pointer;touch-action:manipulation}
.sp-seat.n3{font-size:13px}
.sp-seat small{font-size:11px;font-weight:700;opacity:.85;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.sp-seat.tk{background:#55585f;color:#e8e8e8;box-shadow:0 3px 0 #2c2e33;cursor:default}
.sp-seat.me{background:#ffd84a;color:#1A0F07;box-shadow:0 3px 0 #a88a12;cursor:default}
.sp-seat:not(.tk):not(.me):active{transform:translateY(2px);box-shadow:0 1px 0 #9E4213}
.sp-seat:focus-visible,.sp-x:focus-visible,.ps-btn:focus-visible,.ps-eye:focus-visible{outline:3px solid #F2F3F5;outline-offset:2px}
.sp-box p{margin:0;font-size:14px;color:#c4c7cc;text-align:center;text-wrap:balance}
.ps{position:absolute;inset:0;z-index:3;pointer-events:none;color:#F2F3F5;font-family:${F};-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;overflow:hidden}
.ps>*{position:absolute}
.ps-look{inset:0;pointer-events:auto;touch-action:none;cursor:grab}
.ps-look.on{cursor:grabbing}
.ps-who{left:10px;top:10px;max-width:calc(100% - 82px);box-sizing:border-box;padding:7px 14px;border-radius:999px;background:rgba(14,15,18,.72);font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ps-eye{right:10px;top:10px;width:44px;height:44px;margin:0;padding:0;border:0;border-radius:50%;background:rgba(14,15,18,.62);display:grid;place-items:center;pointer-events:auto;cursor:pointer;touch-action:manipulation}
.ps-eye svg{width:24px;height:24px;fill:none;stroke:#F2F3F5;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ps-eye[aria-pressed="true"]{background:#FF6A1F}
.ps-eye[aria-pressed="true"] svg{stroke:#1A0F07}
.ps-btn{right:10px;height:50px;box-sizing:border-box;display:flex;align-items:center;gap:8px;margin:0;padding:0 16px 0 6px;border:0;border-radius:999px;background:rgba(14,15,18,0.62);color:#F2F3F5;font:700 18px/1 ${F};letter-spacing:.04em;box-shadow:0 4px 0 rgba(0,0,0,0.35);pointer-events:auto;cursor:pointer;touch-action:manipulation}
.ps-btn i{flex:none;width:38px;height:38px;border-radius:50%;background:#FF6A1F;display:grid;place-items:center}
.ps-btn svg{width:22px;height:22px;fill:none;stroke:#1A0F07;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.ps-btn:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,0.35)}
.ps-btn.off{opacity:.5}
.ps-swap{top:max(196px,calc(34% - 16px))}
.ps-out{top:max(256px,calc(34% + 44px))}
.ps-toast{top:22%;left:50%;width:max-content;max-width:calc(100% - 32px);box-sizing:border-box;padding:9px 20px;border-radius:22px;background:rgba(14,15,18,0.78);font-size:19px;font-weight:700;line-height:1.3;text-align:center;text-wrap:balance;opacity:0;transform:translate(-50%,-50%) scale(.92);transition:opacity .15s,transform .15s}
.ps-toast.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
body.seated #drivebar{display:none!important}
body.fs #stage .ps{inset:var(--fs-t) var(--fs-r) var(--fs-b) var(--fs-l)}
body.fs #stage .ps>:not(.ps-look),body.fs #stage .sp-box{zoom:var(--hudz)}
@media (prefers-reduced-motion:reduce){.ps-toast{transition:none}}`;
  document.head.appendChild(st);
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const sp = mk('div', 'sp'), box = mk('div', 'sp-box'), h3 = mk('h3', null, '要坐哪裡？'), x = mk('button', 'sp-x', '✕'), car = mk('div', 'sp-car'), note = mk('p');
  sp.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '要坐哪裡？'); x.type = 'button'; x.setAttribute('aria-label', '關掉');
  car.append(mk('i', 'sp-ws')); box.append(h3, x, car, note); sp.append(box);
  const ps = mk('div', 'ps'), look = mk('div', 'ps-look'), who = mk('b', 'ps-who'), eye = mk('button', 'ps-eye'), swap = mk('button', 'ps-btn ps-swap'), out = mk('button', 'ps-btn ps-out'), toast = mk('div', 'ps-toast');
  ps.hidden = true; who.hidden = true; toast.setAttribute('role', 'status');
  eye.type = swap.type = out.type = 'button'; eye.setAttribute('aria-label', '換視角'); eye.innerHTML = SEAT_SVG.eye;
  swap.innerHTML = `<i>${SEAT_SVG.seat}</i><span>換位子</span>`; out.innerHTML = `<i>${SEAT_SVG.car}</i><span>下車</span>`;
  ps.append(look, who, eye, swap, out, toast);
  stage.append(ps, sp);
  const U = (SEATUI = { sp, box, h3, car, note, ps, look, who, eye, swap, out, toast, tT: 0, pick: null });
  sp.addEventListener('click', (e) => { if (e.target === sp) seatPickClose(); });
  x.addEventListener('click', () => seatPickClose());
  car.addEventListener('click', (e) => { const b = e.target.closest('.sp-seat'); if (!b || b.disabled || !U.pick) return; const o = U.pick, i = +b.dataset.i; seatPickClose(); o.pick(i); });
  eye.addEventListener('click', () => seatEye());
  swap.addEventListener('click', () => seatSwap());
  out.addEventListener('click', () => (HOP.on ? hopOut() : paxOut()));
  look.addEventListener('pointerdown', (e) => { if (e.button > 0 || !SCAM.on) return; SCAM.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; look.classList.add('on'); try { look.setPointerCapture(e.pointerId); } catch { /* 算了 */ } });
  look.addEventListener('pointermove', (e) => { const d = SCAM.drag; if (!d || d.id !== e.pointerId) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; seatLook(dx, dy); });
  const up = (e) => { if (SCAM.drag && SCAM.drag.id === e.pointerId) { SCAM.drag = null; look.classList.remove('on'); } };
  look.addEventListener('pointerup', up); look.addEventListener('pointercancel', up);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && U.pick) seatPickClose(); else if ((e.key === 'c' || e.key === 'C') && SCAM.on && !U.pick && !e.repeat && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) seatEye(); });
  return U;
}
// o：{ k, own（你的車：駕駛座寫「開車」）, taken[i]＝誰坐了, me（你現在坐的）, title, note, valid()（不對了就收起來）, pick(i) }
function seatPickOpen(o) {
  const U = seatUi(), L = seatsOf(o.k); if (L.length < 2) return;
  U.pick = o;
  for (const b of [...U.car.querySelectorAll('.sp-seat')]) b.remove();
  const front = L.filter((s) => !s.rear), rear = L.filter((s) => s.rear), two = !rear.length;
  U.car.classList.toggle('two', two);
  const row = (list, top) => {
    const n = list.length, w = n >= 3 ? 46 : 60, gap = n >= 3 ? 52 : 76;
    list.slice().sort((a, b) => a.hip[2] - b.hip[2]).forEach((s, j) => { // 車頭朝上：右邊的位子（z > 0）在右邊
      const b = document.createElement('button'), tk = o.taken[s.i], me = o.me === s.i;
      b.type = 'button'; b.className = `sp-seat${n >= 3 ? ' n3' : ''}${me ? ' me' : tk ? ' tk' : ''}`; b.dataset.i = s.i; b.disabled = !!(me || tk);
      b.style.left = `${85 + (j - (n - 1) / 2) * gap - w / 2}px`; b.style.top = `${top}px`; b.style.width = `${w}px`;
      const lab = document.createElement('span'); lab.textContent = s.n.length === 4 ? `${s.n.slice(0, 2)}\n${s.n.slice(2)}` : s.n; b.append(lab);
      const sub = me ? '你' : tk ? String(tk).slice(0, 6) : s.drv && o.own ? '（開車）' : '';
      if (sub) { const sm = document.createElement('small'); sm.textContent = sub; b.append(sm); }
      b.setAttribute('aria-label', `${s.n}${me ? '（你坐這裡）' : tk ? `（${tk}坐了）` : s.drv && o.own ? '（開車）' : ''}`);
      U.car.append(b);
    });
  };
  row(front, two ? 92 : 84); if (!two) row(rear, 166);
  U.h3.textContent = o.title || '要坐哪裡？'; U.box.setAttribute('aria-label', U.h3.textContent);
  U.note.textContent = o.note || '點一個位子就走過去坐';
  U.sp.hidden = false;
}
function seatPickClose() { if (!SEATUI) return; SEATUI.pick = null; SEATUI.sp.hidden = true; }
function seatToast(t, ms = 2200) {
  const U = seatUi(); U.toast.textContent = t; U.toast.classList.add('show');
  clearTimeout(U.tT); U.tT = setTimeout(() => U.toast.classList.remove('show'), ms);
}
function seatHud(on) {
  const U = seatUi();
  U.ps.hidden = !on;
  if (on) { destOpen(false); moreOpen(false); } bodyFlag('seated', !!on); // 坐著：「去哪裡」「⋯」那一排收起來（開車的人才用）
  if (!on) { U.toast.classList.remove('show'); SCAM.drag = null; U.look.classList.remove('on'); return; }
  U.who.hidden = !HOP.on; if (HOP.on) U.who.textContent = `🚗 坐在 ${HOP.n} 的車上`;
  U.eye.setAttribute('aria-pressed', String(SCAM.mode === 'eye'));
  U.out.classList.remove('off');
}

// ---- 鏡頭（坐著的時候）：第一人稱＝那個位子的眼睛（拖：轉頭）；從外面看＝繞著車（拖：繞、高低）；換的時候慢慢移過去 ----
const SCAM = { on: false, mode: 'eye', pref: 'eye', lod: false, cx: 0, yaw: 0, pitch: 0, oyaw: 0, opit: 0.32, hs: 0, hsOk: false, drag: null, near0: 0.2 };
const SBL = { on: false, t: 0, T: 0.5, p: new THREE.Vector3(), q: new THREE.Quaternion(), f: 60 };
const SC_V = new THREE.Vector3(), SC_W = new THREE.Vector3(), SC_Q = new THREE.Quaternion(), SC_Q2 = new THREE.Quaternion(), SC_E = new THREE.Euler(0, 0, 0, 'YXZ');
function seatBlendFrom(T = 0.5) { if (!dcam) return; SBL.on = true; SBL.t = 0; SBL.T = calm ? Math.min(T, 0.15) : T; SBL.p.copy(dcam.position); SBL.q.copy(dcam.quaternion); SBL.f = dcam.fov; }
function seatBlendTick(dt) { // 這一格的鏡頭擺好以後：從記下來的慢慢移過去
  if (!SBL.on || !dcam) return;
  SBL.t += dt; const e = sm01(SBL.t / SBL.T);
  SC_V.copy(dcam.position); dcam.position.copy(SBL.p).lerp(SC_V, e);
  SC_Q2.copy(dcam.quaternion); dcam.quaternion.copy(SBL.q).slerp(SC_Q2, e);
  const f = SBL.f + (dcam.fov - SBL.f) * e; if (Math.abs(f - dcam.fov) > 0.01) { dcam.fov = f; dcam.updateProjectionMatrix(); }
  if (e >= 1) SBL.on = false;
}
function seatCamStart(mode, cx) {
  if (!SCAM.on) { SCAM.on = true; SCAM.near0 = dcam.near; }
  seatBlendFrom();
  SCAM.mode = mode; SCAM.cx = +cx || 0; SCAM.yaw = SCAM.pitch = 0; SCAM.oyaw = 0; SCAM.opit = 0.32; SCAM.hsOk = false; SCAM.drag = null;
}
function seatCamEnd() { if (!SCAM.on) return; SCAM.on = false; SCAM.drag = null; dcam.near = SCAM.near0 || 0.2; dcam.updateProjectionMatrix(); }
function seatEye() { // 👁：第一人稱 ↔ 從外面看（記住：下次坐也是這個）
  if (!SCAM.on) return;
  seatBlendFrom(0.45);
  SCAM.mode = SCAM.mode === 'eye' ? 'out' : 'eye'; SCAM.pref = SCAM.mode; SCAM.yaw = SCAM.pitch = 0; SCAM.oyaw = 0; SCAM.hsOk = false;
  SEATUI?.eye.setAttribute('aria-pressed', String(SCAM.mode === 'eye'));
}
function seatLook(dx, dy) { // 拖畫面：跟走路一樣（往右拖＝往右看、往下拖＝往下看）
  if (SCAM.mode === 'eye' && !SCAM.lod) { const k = (dcam.fov * Math.PI) / 180 / Math.max(240, stage.clientHeight); SCAM.yaw = seClamp(SCAM.yaw - dx * k, -2.5, 2.5); SCAM.pitch = seClamp(SCAM.pitch - dy * k, -0.75, 0.6); }
  else { SCAM.oyaw = wrapPi(SCAM.oyaw - dx * 0.0068); SCAM.opit = seClamp(SCAM.opit + dy * 0.0052, 0.04, 1.2); }
}
function seatFov(f, near) {
  let ch = false;
  if (Math.abs(dcam.fov - f) > 0.01) { dcam.fov = f; ch = true; }
  if (dcam.near !== near) { dcam.near = near; ch = true; }
  if (ch) dcam.updateProjectionMatrix();
}
function seatChaseFov() { // 跟 drive.js 追車鏡頭停著的時候一樣（直的長畫面看多一點）
  const a = dcam.aspect || 1, tall = 93 * seClamp(0.6 - a, 0, 0.2);
  return seClamp((2 * Math.atan(Math.tan((56 * Math.PI) / 360) / a) * 180) / Math.PI, 50, 72 + tall);
}
function seatCeil(x, z) { // 鏡頭最高到哪（跟開車的一樣：越野車車庫、隧道裡、圓塔每一層的天花板下面）
  if (OB?.inside(x, z, 0.6)) return OB.size.ceil - 0.75;
  if (VIL.hills && !VIL.hills.high && VIL.hills.tunAt(x, z) >= 0) return VIL.hills.ceil;
  const c = GAR.ceilingAt(x, z, true); return c < 50 ? GAR.group.position.y + c - 0.75 : Infinity;
}
function seatCamTick(dt, body, k, i, heading) {
  const s = seatsOf(k)[i]; if (!s || !body || !dcam) return;
  body.updateMatrixWorld(true);
  if (SCAM.mode === 'eye' && !SCAM.lod) {
    dcam.position.set(s.eye[0] + 0.05, s.eye[1], s.eye[2]).applyMatrix4(body.matrixWorld);
    body.getWorldQuaternion(SC_Q);
    dcam.quaternion.copy(SC_Q).multiply(SC_Q2.setFromEuler(SC_E.set(SCAM.pitch, -Math.PI / 2 + SCAM.yaw, 0, 'YXZ'))); // 車身：x 往前（相機看 −z：轉 −90°）
    seatFov(cabinFov(k, dcam.aspect), 0.05);
    return;
  }
  SC_W.set(SCAM.cx, 0.85, 0).applyMatrix4(body.matrixWorld); // 看車子中間
  if (!SCAM.hsOk) { SCAM.hs = heading; SCAM.hsOk = true; } else SCAM.hs += wrapPi(heading - SCAM.hs) * (1 - Math.exp(-dt * 2.5));
  const tw = GAR && inTower(SC_W.x, SC_W.z, 0.5), tight = tw || !!OB?.inside(SC_W.x, SC_W.z, 0.6), D = tight ? 3.6 : 6.3, a = SCAM.hs + SCAM.oyaw + Math.PI, ce = Math.cos(SCAM.opit);
  let x = SC_W.x + Math.cos(a) * ce * D, z = SC_W.z - Math.sin(a) * ce * D, y = SC_W.y + Math.sin(SCAM.opit) * D;
  if (tw) { const L = garLot(), dx = x - L.x, dz = z - L.z, r = Math.hypot(dx, dz), R = TOWER.RW - 0.7; if (r > R) { x = L.x + (dx * R) / r; z = L.z + (dz * R) / r; } } // 圓塔裡面：不要穿出玻璃（地下室外面是土）
  const g = PW ? PW.heightAt(x, z) || 0 : 0; if (y < g + 0.35) y = g + 0.35;
  const c = seatCeil(x, z); if (y > c) y = c;
  dcam.position.set(x, y, z); dcam.up.set(0, 1, 0); dcam.lookAt(SC_W);
  seatFov(seatChaseFov(), 0.2);
}

// ---- 坐自己的車的別的位子（車子停著；開車的 drv 暫停著，跟剛下車一樣）----
const PAX = { on: false, k: '', i: 0, want: null };
function paxStart(k, i) {
  if (!drv || !tripS || !seatsOf(k)[i]) return;
  PAX.want = null;
  drv.pause(); const sh = TR.scene.getObjectByName('drive-shadow'); if (sh) sh.visible = true; // 影子留著（drive.pause 會藏起來）
  dvoice?.dispose(); dvoice = null; // 熄火
  tripS.cabin?.userData.setGauges(0, 0); tripS.cabin?.userData.setSteer?.(0);
  PAX.on = true; PAX.k = k; PAX.i = i;
  const ci = drv.carInfo; seatCamStart(SCAM.pref, (ci.nose + ci.tail) / 2);
  seatHud(true);
  seatToast(`坐在${seatName(k, i)}。要開車就換到駕駛座`, 2600);
}
function paxEnd() { if (!PAX.on) return; PAX.on = false; seatCamEnd(); seatHud(false); seatPickClose(); }
function paxTo(j) {
  if (!PAX.on || !drv || j === PAX.i || !seatsOf(PAX.k)[j]) return;
  if (j === 0) { // 換到駕駛座：開
    const eye = SCAM.mode === 'eye';
    seatBlendFrom(0.45); paxEnd();
    drv.resume(); drv.setCameraMode(eye ? 'eye' : 'chase');
    dvoice?.dispose(); dvoice = engineAudio.voice(cur, { parts: partsOf(cur) });
    drv.toast('換到駕駛座了，可以開了', 1800);
    return;
  }
  seatBlendFrom(0.4); PAX.i = j; SCAM.yaw = SCAM.pitch = 0;
  seatToast(`換到${seatName(PAX.k, j)}`, 1500);
}
function paxOut() {
  if (!PAX.on || !drv || !walker) return;
  const t = drv.telemetry(), s = seatsOf(PAX.k)[PAX.i]; if (!s) return;
  const ci = drv.carInfo, cx = (ci.nose + ci.tail) / 2;
  const sp = BORROW_K ? null : parkSpot(t), spot = sp && Math.hypot(sp.x - t.x, sp.z - t.z) < 0.05 && Math.abs(wrapPi(sp.heading - t.heading)) < 0.02 ? sp : null; // 本來就停在格子裡：照樣掛回格子
  const car = outAt(spot, { seat: { side: s.side || 1, u: s.hip[0] + 0.1 - cx }, paused: true });
  if (!car) { seatToast('這裡太擠了，下不了車', 1800); return; }
  paxEnd();
}

// ---- 換位子（自己的車、朋友的車）----
function seatSwap() {
  if (PAX.on) { seatPickOpen({ k: PAX.k, own: true, taken: seatTaken(NET.me, PAX.k), me: PAX.i, title: '換到哪裡？', note: '點一個位子就換過去', valid: () => PAX.on, pick: (j) => paxTo(j) }); return; }
  if (!HOP.on) return;
  const T = seatTaken(HOP.uid, HOP.k, HOP.n); T[HOP.i] = undefined;
  seatPickOpen({ k: HOP.k, own: false, taken: T, me: HOP.i, title: '換到哪裡？', note: '駕駛座是開車的人坐的', valid: () => HOP.on, pick: (j) => { if (!HOP.on || j === HOP.i || !seatsOf(HOP.k)[j]) return; seatBlendFrom(0.4); HOP.i = j; SCAM.yaw = SCAM.pitch = 0; seatToast(`換到${seatName(HOP.k, j)}`, 1500); } });
}

// ---- 走路的時候：「選位子」（你的車：走到「上車」那台旁邊；朋友的車：停著、或他在開但停住了，2.4 公尺內）----
const SEATN = { own: null, P: null };
const SEAT_ACT = { label: '選位子', icon: 'seat', onClick: () => seatWalkGo() };
function seatOwnCar(car) { return !!car && !car.borrow && !car.hop && !BORROW_K && (car.drive || GAME.owned.has(car.key)) && seatsOf(car.key).length > 1; }
function seatHopKey(P) { const c = P.cur; return c.o === 1 ? c.k : P.pkOn && (c.pk || c.pv) ? (c.pk || c.pv)[0] : null; } // 他現在開的、停著的那台
function seatNearFriend(me) {
  if (!NET.on || HOP.ask || HOP.want || BOR.on || BOR.want || BOR.loading || !netWorld()) return null;
  let best = null, bd = 2.4;
  for (const P of NET.P.values()) {
    const c = P.cur, O = P.obj; if (!O || !O.car.visible || netNow() - P.last > 6000) continue;
    const k = seatHopKey(P); if (!k || P.objK !== k || seatsOf(k).length < 2) continue;
    if (c.o === 1 && (Math.abs(c.v) > 1 || c.nr)) continue; // 開著的：停住了才可以
    const h = O.car.rotation.y, cs = Math.cos(h), sn = Math.sin(h), bx = O.car.position.x + cs * O.cx, bz = O.car.position.z - sn * O.cx, dx = me.x - bx, dz = me.z - bz;
    const eu = Math.abs(dx * cs - dz * sn) - (O.nose - O.tail) / 2, ew = Math.abs(dx * sn + dz * cs) - O.hw, d = Math.hypot(Math.max(0, eu), Math.max(0, ew));
    if (d < bd) { bd = d; best = P; }
  }
  return best;
}
function seatWalk() {
  SEATN.own = null; SEATN.P = null;
  if (!walker) return;
  const ok = walker.mode === 'walk' && !indoor && !doorFade && !sleep && !jailed() && !BOR.pad && !(police && police.state === 'wanted') && !RACE.on;
  if (ok) {
    const car = walker.nearCar;
    if (seatOwnCar(car)) SEATN.own = car; else SEATN.P = seatNearFriend(walker.telemetry());
  }
  walker.setAction2(SEATN.own || SEATN.P ? SEAT_ACT : null);
}
function seatWalkGo() {
  const car = SEATN.own, near = (x, z) => { if (!walker || walker.mode !== 'walk') return false; const t = walker.telemetry(); return Math.hypot(t.x - x, t.z - z) < 7; };
  if (car) {
    const k = car.key;
    seatPickOpen({ k, own: true, taken: seatTaken(NET.me, k), me: -1, note: '點一個位子就走過去坐', valid: () => near(car.x, car.z), pick: (i) => { if (!walker || walker.mode !== 'walk') return; if (i === 0) walker.getIn(car); else walker.getIn(car, { seat: seatGo(k, i, car.cx) }); } });
    return;
  }
  const P = SEATN.P; if (!P) return;
  const k = seatHopKey(P), n = P.n || '朋友'; if (!k) return;
  seatPickOpen({ k, own: false, taken: seatTaken(P.uid, k, n), me: -1, title: `要坐${n}的車哪裡？`, note: `點一個位子，問${n}可不可以坐`, valid: () => !!P.obj && P.obj.car.visible && near(P.obj.car.position.x, P.obj.car.position.z), pick: (i) => hopAsk(P, k, i) });
}

// ---- 坐朋友的車 ----
const HOP = { on: false, ask: null, want: null, uid: '', n: '', k: '', i: 1, car: null, lodS: null, job: 0, voice: null, lost: 0, last: { x: 0, z: 0, heading: 0 }, hx: 2.2, hz: 0.9, cx: 0, roll: 0, px: null, pz: null, ph: 0, kap: 0, vd: 0, spd: 0, hubs: null, hub0: null, RF: 0.33, RR: 0.33 };
function hopAsk(P, k, i) {
  if (HOP.ask || HOP.on || !NET.on || !walker) return;
  if (police && police.state === 'wanted') { walker.toast('被警察追的時候不能坐朋友的車', 2200); return; }
  if (BOR.on || BOR.want || BOR.loading) { walker.toast('先還車才能坐朋友的車', 2200); return; }
  HOP.ask = { uid: P.uid, n: P.n || '朋友', k, i, t: performance.now() };
  netEv('ride', { uid: P.uid, s: i, k });
  walker.toast(`🚗 等${HOP.ask.n}回答⋯`, 2600);
}
function hopAns(a) { // 網站：他的回答 { uid, n, ok：1 好｜-1 不要｜-2 在忙｜-3 關掉邀請｜-4 送不出去｜-5 不在線上｜0 沒有回答 }
  const A = HOP.ask; if (!a || !A || String(a.uid) !== A.uid) return 'gone';
  HOP.ask = null;
  const n = String(a.n || A.n || '朋友').slice(0, 12);
  if ((a.ok | 0) === 1) return hopGo(A, n) ? 'ok' : 'far';
  const m = { [-1]: `${n}說「不要」。`, [-2]: `${n}在忙，等一下再試。`, [-3]: `${n}關掉了邀請。`, [-4]: '問不到，等一下再試一次。', [-5]: `${n}已經不在線上了。`, 0: `${n}沒有回答。` }[a.ok | 0];
  if (m) netToast(m);
  return 'ok';
}
function hopGo(A, n) { // 他說好了：走過去坐（他的車的車門）
  const P = NET.P.get(A.uid), O = P && P.obj;
  if (!trip || !DRIVE.on || !walker || walker.mode !== 'walk' || indoor) { netToast(`${n}說好了，可是你現在不能上車`); return false; }
  if (!O || !O.car.visible || P.objK !== A.k) { netToast(`${n}說好了，可是他的車不見了`); return false; }
  const me = walker.telemetry(); if (Math.hypot(O.car.position.x - me.x, O.car.position.z - me.z) > 9) { netToast(`${n}說好了，可是你已經走遠了`); return false; }
  let i = A.i; const T = seatTaken(P.uid, A.k, n);
  if (T[i] || !seatsOf(A.k)[i]) { i = seatsOf(A.k).findIndex((s, j) => j > 0 && !T[j]); if (i < 0) { netToast(`${n}的車坐滿了`); return false; } } // 那個位子剛好有人坐了：換一個空的
  const e = { key: A.k, name: `${n}的 ${borCarName(A.k)}`, x: O.car.position.x, z: O.car.position.z, heading: O.car.rotation.y, hx: (O.nose - O.tail) / 2, hz: O.hw, cx: O.cx, cz: 0, h: O.top, object: O.car, hop: true, solid: false };
  HOP.want = { uid: P.uid, n, k: A.k, i, entry: e, t: performance.now() };
  walker.setCars([...walkCars(), e]);
  if (!walker.getIn(e, { seat: seatGo(A.k, i, O.cx) })) { HOP.want = null; walker.setCars(walkCars()); netToast('上不了車，再試一次'); return false; }
  walker.toast(`${n}說好！走過去坐${seatName(A.k, i)}`, 2000);
  return true;
}
function hopWantOff() { if (!HOP.want) return; HOP.want = null; if (walker && trip) walker.setCars(walkCars()); } // 走去車門的時候推搖桿取消了
// 坐進去了（town.src.js onGetIn）：你原本那台停好（跟借車一樣）、坐在他的車上（先坐在輕量車上、從外面看；完整的車載好換過去）
function hopBoard(e, seat) {
  const W = HOP.want; HOP.want = null;
  const P = W && W.entry === e ? NET.P.get(W.uid) : null, O = P && P.obj;
  const fail = (t) => { if (walker && trip) { walker.setCars(walkCars()); walker.resume(); walker.toast(t, 2200); } };
  if (!P) { fail(W ? `${W.n}不在了` : '上不了車'); return; }
  if (!O || !O.car.visible || P.objK !== W.k || Math.hypot(O.car.position.x - e.x, O.car.position.z - e.z) > 3) { fail(`${W.n}開走了`); return; }
  if (drv) borParkMine(); // 你原本那台（剛下來的）停好
  Object.assign(HOP, { on: true, uid: W.uid, n: W.n, k: W.k, i: seat && seat.i > 0 ? seat.i : W.i, car: null, lodS: { body: O.lod.body || O.car }, lost: 0, last: { x: e.x, z: e.z, heading: e.heading }, hx: (O.nose - O.tail) / 2, hz: O.hw, cx: O.cx, roll: 0, px: null, pz: null, ph: e.heading, kap: 0, vd: 0, spd: 0 });
  walker.setCars(walkCars());
  seatCamStart('out', O.cx); SCAM.lod = true;
  seatHud(true);
  seatToast(`坐在 ${W.n} 的車上`, 2200);
  hopLoad();
}
async function hopLoad() {
  const job = ++HOP.job, k = HOP.k, P = NET.P.get(HOP.uid), look = netLook(k, P ? P.l : null);
  let car = null; try { car = await loadCar(k, look); } catch (e) { console.error(e); }
  if (!HOP.on || HOP.job !== job || !trip || !DRIVE.on) { if (car) disposeCar(car); return; }
  if (!car) { hopEnd('fail'); return; }
  HOP.car = car; car.car.rotation.order = 'YXZ'; car.body.position.y = +look.height || 0; car.car.visible = true; TR.scene.add(car.car);
  car.cabin?.userData.setGauges(0.13, 0); car.cabin?.userData.setSteer?.(0);
  HOP.hubs = car.wheels.map((w) => w.parent); HOP.hub0 = HOP.hubs.map((h) => h.rotation.y);
  const W = car.spec?.wheels || {}; HOP.RF = W.RF ?? W.R ?? 0.33; HOP.RR = W.RR ?? W.R ?? 0.33;
  try { HOP.voice?.dispose(); HOP.voice = engineAudio.input ? engineAudio.voice(k, { parts: [] }) : null; } catch (e) { HOP.voice = null; }
  seatBlendFrom(0.5); SCAM.lod = false; SCAM.mode = SCAM.pref; SCAM.yaw = SCAM.pitch = 0; SCAM.hsOk = false;
  seatHud(true);
}
// 要下車了嗎（每一格）：'' 照坐；'wait' 他的車這一格沒畫（重做中）；其他＝下車的原因
function hopWhy(P, dt) {
  if (!P) return 'gone';
  const c = P.cur;
  if (netNow() - P.last > 6000) return 'stale';
  if (c.o === 3 || (c.o === 1 && c.nr)) return 'race';
  const k = c.o === 1 ? c.k : c.pk || c.pv ? (c.pk || c.pv)[0] : null;
  if (!k) return 'away';
  if (k !== HOP.k) return 'car';
  const O = P.obj;
  if (!O || P.objK !== HOP.k || !O.car.parent || !(O.car.visible || HOP.lost < 0)) { HOP.lost += dt; return HOP.lost > 2.5 ? 'away' : 'wait'; }
  HOP.lost = 0;
  return '';
}
const hopRpm = (kmh) => { if (kmh < 2) return 0.13; const G = [0, 45, 80, 115, 155, 200, 260, 420]; let g = 0; while (g < G.length - 2 && kmh > G[g + 1]) g++; return 0.28 + 0.62 * seClamp((kmh - G[g]) / (G[g + 1] - G[g]), 0, 1); };
function hopStep(dt) {
  const P = NET.P.get(HOP.uid), why = hopWhy(P, dt);
  if (why && why !== 'wait') { hopEnd(why); return; }
  if (why === 'wait') return;
  const O = P.obj, src = O.car, C = HOP.car;
  if (!C && HOP.lodS.body !== (O.lod.body || O.car)) HOP.lodS = { body: O.lod.body || O.car }; // 他的輕量車重做了
  let d = 0;
  if (HOP.px != null) {
    d = Math.hypot(src.position.x - HOP.px, src.position.z - HOP.pz) * (P.cur.v < 0 ? -1 : 1);
    const dh = wrapPi(src.rotation.y - HOP.ph); if (Math.abs(d) > 0.01) HOP.kap += (seClamp(-dh / d, -0.3, 0.3) - HOP.kap) * 0.3; else HOP.kap *= 0.9; // 往右轉＝正的
    if (dt > 0) HOP.spd += (Math.abs(d) / dt - HOP.spd) * Math.min(1, dt * 6);
  }
  HOP.px = src.position.x; HOP.pz = src.position.z; HOP.ph = src.rotation.y; HOP.roll += d;
  HOP.last.x = src.position.x; HOP.last.z = src.position.z; HOP.last.heading = src.rotation.y;
  const vis = seClamp(Math.atan(HOP.kap * 2.6), -0.6, 0.6); HOP.vd += (vis - HOP.vd) * Math.min(1, dt * 8);
  const steer = seClamp(HOP.vd / 0.45, -1, 1), kmh = HOP.spd * 3.6, rpm = hopRpm(kmh);
  if (C) {
    C.car.position.copy(src.position); C.car.rotation.set(src.rotation.x, src.rotation.y, src.rotation.z, 'YXZ');
    src.visible = false; // 輕量車藏起來（影子 O.sh 留著）
    C.wheels.forEach((w, j) => { w.rotation.z = (j % 2 === 0 ? 1 : -1) * (HOP.roll / (j < 2 ? HOP.RF : HOP.RR)); });
    if (HOP.hubs?.length > 1) { HOP.hubs[0].rotation.y = HOP.hub0[0] - HOP.vd; HOP.hubs[1].rotation.y = HOP.hub0[1] - HOP.vd; }
    C.cabin?.userData.setGauges(rpm, kmh); C.cabin?.userData.setSteer?.(steer);
  }
  walker?.follow(src.position.x, src.position.z, src.rotation.y); // 地圖、路上的車和人、警察看到的你在哪裡
  HOP.voice?.set({ rpm, throttle: kmh > 3 ? 0.5 : 0.1, speed: HOP.spd });
  if (SEATUI) SEATUI.out.classList.toggle('off', HOP.spd > 1 || Math.abs(P.cur.v) > 1);
}
function hopOut() { // 「下車」：車停下來才可以
  if (!HOP.on) return;
  const P = NET.P.get(HOP.uid);
  if (HOP.spd > 1 || (P && Math.abs(P.cur.v) > 1)) { seatToast('車子停下來才能下車', 1600); return; }
  hopEnd('out');
}
// 下車（why：out 自己下車｜gone 他離開世界｜away 他回家了｜race 他去比賽｜car 他換車｜stale 斷線｜fail 載不了車｜home 你回車庫頁｜leave 你離開世界）
function hopEnd(why) {
  if (!HOP.on) return;
  const P = NET.P.get(HOP.uid), n = HOP.n, k = HOP.k, i = HOP.i, C = HOP.car, last = { ...HOP.last };
  HOP.on = false; HOP.job++;
  if (C && MIR.S === C) mirrorSet(false);
  mySitOff();
  if (C) seatDetach(C.body);
  HOP.voice?.dispose(); HOP.voice = null;
  if (C) disposeCar(C);
  HOP.car = null; HOP.lodS = null; HOP.hubs = HOP.hub0 = null;
  if (P?.obj && P.objK === k) P.obj.car.visible = true;
  seatCamEnd(); seatHud(false); seatPickClose();
  if (why === 'home' || !walker || !trip || !DRIVE.on) return;
  const s = seatsOf(k)[i], box = { x: last.x, z: last.z, heading: last.heading, hx: HOP.hx, hz: HOP.hz, cx: HOP.cx, cz: 0 };
  walker.removeColliders('net'); NET.wkT = 0; // 他的車的碰撞先拿掉（車門那一段才不會算擋住）；下一格 netStep 再放
  if (!walker.exitAt(box, { side: s?.side || 1, u: (s ? s.hip[0] + 0.1 : 0) - HOP.cx })) { // 四邊都沒地方站：站到左邊
    const c = Math.cos(last.heading), sn = Math.sin(last.heading), dd = HOP.hz + 0.9;
    walker.teleport({ x: last.x - sn * dd, z: last.z - c * dd, heading: last.heading - Math.PI / 2 }, { keepCamera: false });
    walker.resume({ blend: 0.4 });
  }
  walker.setCars(walkCars());
  const m = { gone: `${n}離開了，你下車了`, away: `${n}把車開回家了，你下車了`, race: `${n}去比賽了，你下車了`, car: `${n}換車了，你下車了`, stale: `${n}斷線了，你下車了`, fail: '坐不進去，等一下再試一次' }[why];
  if (m) walker.toast(m, 2600);
}

// ---- 朋友坐在車上（他開車＝駕駛座；坐在別人的車上＝那個位子）：他的人（netChr）放進那台車的車身（輕量車或完整的車），坐好一次；手跟著方向盤 ----
const SEAT_PS = { n: 0 };
function seatPeerBody(P) { // → [車身, 車, 位子] | null
  const c = P.cur; if (netNow() - P.last > 6000 || !netWorld()) return null;
  if (c.o === 1) {
    if (!c.k || c.k === 'z2') return null; // 沙灘車：第 56 批騎的人
    if (HOP.on && HOP.uid === P.uid && HOP.car && HOP.k === c.k) return [HOP.car.body, c.k, c.st | 0];
    const O = P.obj; if (!O || !O.car.visible || P.objK !== c.k) return null;
    return [O.lod.body || O.car, c.k, c.st | 0];
  }
  if (c.o === 5 && c.rd) {
    const h = c.rd[0], i = c.rd[1], k = c.rd[2];
    if (h === NET.me) return tripFull === cur && cur === k && !BORROW_K && tripS?.car?.visible && tripS.car.parent === TR.scene ? [tripS.body, k, i] : null; // 坐我的車
    if (HOP.on && HOP.uid === h && HOP.k === k) { if (HOP.car) return [HOP.car.body, k, i]; }
    const H = NET.P.get(h), O = H && H.obj; if (!O || H.objK !== k || !O.car.visible) return null;
    return [O.lod.body || O.car, k, i];
  }
  return null;
}
function seatPeerSteer(P) { // 朋友開車：照他轉彎多快估方向盤（右轉＝正的）
  const b = P.buf, n = b.length; if (n < 2) return 0;
  const a = b[n - 2], c = b[n - 1], ds = Math.hypot(c.x - a.x, c.z - a.z) * (c.v < 0 ? -1 : 1);
  if (Math.abs(ds) < 0.05) return P.stE || 0;
  const want = seClamp(Math.atan((-wrapPi(c.h - a.h) / ds) * 2.6) / 0.45, -1, 1);
  P.stE = (P.stE || 0) + (want - (P.stE || 0)) * 0.25;
  return P.stE;
}
function seatUnpeer(P) {
  const S = P.sit; P.sit = null; const C = P.chr; if (!C || !S || S.C !== C) return;
  C.group.userData.seated = false;
  if (C.group.parent !== TR.scene && C.group.parent !== PSC) { TR.scene.add(C.group); C.group.visible = false; } // 還在車上（他回車庫頁了）：拿下來；在走路（netStep 已經拿到場景上了）就照它的
  C.group.rotation.x = 0; C.group.rotation.z = 0;
  if (C.shadow) C.shadow.visible = true;
  C.update(0, { state: 'idle', hands: 'lap', feet: null });
}
function seatPeers() {
  let n = 0;
  for (const P of NET.P.values()) {
    const t = seatPeerBody(P);
    if (!t) { if (P.sit) seatUnpeer(P); continue; }
    const [B, k, i] = t, s = seatsOf(k)[i];
    if (!s) { if (P.sit) seatUnpeer(P); continue; }
    if (!P.chr) netChr(P);
    const C = P.chr; if (!C) continue;
    const S = P.sit || (P.sit = { B: null, k: '', i: -1, C: null, P: {}, st: 9 });
    if (S.B !== B || S.k !== k || S.i !== i || S.C !== C || C.group.parent !== B) {
      B.add(C.group); C.group.userData.seated = true; if (C.shadow) C.shadow.visible = false;
      seatPlace(C, s, S.P); S.B = B; S.k = k; S.i = i; S.C = C; S.st = 0;
    }
    C.group.visible = true; n++;
    if (s.wheel && P.cur.o === 1) { const st = seatPeerSteer(P); if (Math.abs(st - S.st) > 0.02) { S.st = st; seatSteer(C, S.P, st); C.update(1 / 30, S.P); } }
  }
  SEAT_PS.n = n;
  for (const P of NET.P.values()) { // 我是車主：有人坐上來、下車了
    const c = P.cur, on = netNow() - P.last < 6000 && c.o === 5 && !!c.rd && c.rd[0] === NET.me;
    if (on !== !!P.rideMe) { P.rideMe = on; if (P.n) netToast(on ? `🚗 ${P.n}坐上你的車了` : `${P.n}下車了`); }
  }
}

// ---- 每一格（town.src.js driveStep：netStep 後面）----
function seatsStep(dt) {
  if (!trip || !DRIVE.on || !TR) return;
  if (HOP.on) hopStep(dt);
  if (HOP.want && walker && walker.mode === 'walk' && performance.now() - HOP.want.t > 600) hopWantOff();
  if (PAX.on && (!drv || !tripS || !walker || walker.mode !== 'off')) paxEnd(); // 被換掉了（回車庫頁、被抓⋯）
  if (PAX.on) { mySitOn(tripS, PAX.k, PAX.i, SCAM.mode !== 'eye'); seatCamTick(dt, tripS.body, PAX.k, PAX.i, tripS.car.rotation.y); }
  else if (HOP.on) { const Sx = HOP.car || HOP.lodS; mySitOn(Sx, HOP.k, HOP.i, SCAM.mode !== 'eye' || !HOP.car); seatCamTick(dt, Sx?.body, HOP.k, HOP.i, HOP.last.heading); }
  else if (drv && walker && walker.mode === 'off' && cur !== 'z2' && tripS?.car?.visible && tripS.car.parent === TR.scene && !(walker.character && walker.character.group.visible) && seatsOf(cur).length) { // 開車：你坐在駕駛座（從外面看得到）
    mySitOn(tripS, cur, 0, drv.cameraMode !== 'eye'); mySitSteer(drv.telemetry().steer);
  } else if (MYSIT.S) mySitOff();
  if (NET.on) seatPeers();
  seatWalk();
  if (SEATUI?.pick && SEATUI.pick.valid && !SEATUI.pick.valid()) seatPickClose();
  seatBlendTick(dt);
}
// 回車庫頁（leaveDrive）、離開世界：全部收掉（why 'home'＝不用下車走路）
function seatsEnd(why = 'home') {
  seatPickClose();
  if (HOP.ask) { netEv('rideEnd', { uid: HOP.ask.uid }); HOP.ask = null; }
  hopWantOff();
  if (HOP.on) hopEnd(why);
  if (PAX.on) paxEnd();
  if (why === 'home') mySitOff();
  for (const P of NET.P.values()) if (P.sit) seatUnpeer(P);
  SBL.on = false;
}
// 送給朋友的（net.src.js netState）：坐在朋友的車上＝o 5、他的車在哪裡、rd [車主, 位子, 車]
function seatNetHop(s) { s.o = 5; s.x = HOP.last.x; s.z = HOP.last.z; s.h = HOP.last.heading; s.v = HOP.spd; s.rd = [HOP.uid, HOP.i, HOP.k]; }
// 車主：別人問「可以坐你的車嗎」：現在可以嗎（不行＝網站回「在忙」）
function seatHostOk(d) {
  if (!trip || !DRIVE.on || !tripPose || BOR.on || LENT_K || HOP.on || RACE.on || ciRace || orRace || jailed() || indoor) return false;
  const k = String(d.k || ''), i = d.s | 0;
  if (k && k !== cur) return false;
  return i > 0 && !!seatsOf(cur)[i];
}
