// 第 98 批：車門（doors.js；Nick 2026-11-17「車門做成是可自己打開關起來的…像AV12是剪刀門上開的」，草稿「車門」那一頁）
//   走到你的車（完整的那台：tripS）的車門旁邊：門關著＝大按鈕「開車門 · X」→ 門照那台真的車的樣子打開（0.6 秒）
//   門開著＝「上車 · X」（坐那個門的位子：駕駛座那邊＝開車、另一邊＝副駕駛座、後門＝後座）＋第二顆「關車門」（以前的「選位子」）
//   別的地方按「上車」（車頭、車尾、測試直接叫 walker.getIn）：走到門口門自己打開；下車：門先打開、人走出來，門開著
//   開車的時候門開著：停住了左上「關車門」；開快了（時速 9 公里）門自己甩上；坐別的位子：坐好 1 秒門自己關
//   換車、停進格子、回車庫頁、比賽＝門關好（車身換回原本的網格）；開後車廂的時候門先關（兩個都會切車身）
//   沒有門：腳踏車、街車、沙灘車（騎的）、怪獸卡車
const CD_ON = true; // 試做頁 v111 打開（v110 先放發動／熄火的時候是 false）
const CD = { S: null, rig: null, near: -1, act2: null, lastMode: '', paxT: 0, acts: {} };
const CD_V = new THREE.Vector3(), CD_V2 = new THREE.Vector3();
function cdOK(k) { return !!(CD_ON && k && CARS[k] && !RIDES[k] && !PERF[k]?.bike && !PERF[k]?.big && seatsOf(k).length > 0); }
function cdSide(k) { return cdOK(k) ? seatsOf(k)[0]?.side || 0 : 0; } // 駕駛座那一邊（walk.js 的 dside：「上車」走過去、下車走出來都是這一邊；右駕 1、左駕 −1）
function cdDrop() { if (CD.rig) CD.rig.dispose(); CD.rig = null; CD.S = null; CD.near = -1; }
function cdShut() { const R = CD.rig; if (!R) return; for (let i = 0; i < R.doors.length; i++) if (R.doors[i].want || R.doors[i].t) R.snap(i, 0); } // 後車廂要開：門馬上關好
// 你的車（完整的、看得到的）的門；沒有門的車、不是這一趟的車 null
function cdRig() {
  if (!DRIVE.on || !trip || !tripS || !cdOK(cur) || RACE.on || BORROW_K || !tripS.car.visible) return null;
  if (CD.S !== tripS) { cdDrop(); }
  if (!CD.rig) { MART.vis && trunkShutNow(); CD.rig = doorRig(tripS, cur); CD.S = tripS; }
  return CD.rig;
}
function trunkShutNow() { const V = MART.vis; if (!V || (!V.want && !V.t)) return; V.want = 0; V.t = 0; trunkSplit(V, false); if (V.hinge) V.hinge.rotation.set(0, 0, 0); if (V.cav) V.cav.visible = false; }
// 世界的 (x, z) 離哪一個門最近（車身外面 maxD 公尺內；裡面 0.6 公尺內也算：坐下、走出來的位置）
function cdNear(x, z, maxD) {
  const R = CD.rig; if (!R) return -1;
  const B = tripS.body; B.updateMatrixWorld(true); B.getWorldPosition(CD_V2);
  const p = B.worldToLocal(CD_V.set(x, CD_V2.y + 0.6, z));
  let best = -1, bd = maxD;
  for (let i = 0; i < R.doors.length; i++) {
    const D = R.doors[i].D, s = D.side; if (p.z * s <= 0) continue;
    const w = s * p.z - D.zOut, xm = (D.m.xf + D.m.xr) / 2, hx = (D.m.xf - D.m.xr) / 2, dx = Math.max(0, Math.abs(p.x - xm) - hx), d = Math.hypot(dx, Math.max(0, w));
    if (w > -0.75 && d < bd) { bd = d; best = i; }
  }
  return best;
}
// 這個門是哪個位子：那一邊的座位，前門＝最前面那個、後門＝最後面那個（中間的位子沒有門）
function cdSeatOf(k, D) {
  const S = seatsOf(k); let best = -1, bx = 0;
  for (let i = 0; i < S.length; i++) { const s = S[i]; if (s.side !== D.side) continue; const x = s.hip[0]; if (best < 0 || (D.row === 0 ? x > bx : x < bx)) { best = i; bx = x; } }
  return best < 0 ? 0 : best;
}
function cdOpen(i, t0 = 0) { const R = CD.rig; if (!R || i < 0) return; if (MART.vis) trunkShutNow(); if (t0) R.nudge(i, t0); else R.set(i, 1); }
function cdAct(what) {
  const nm = CARS[cur]?.btn[0] || '', key = what + nm; if (CD.acts[key]) return CD.acts[key];
  const a = what === 'open' ? { label: `開車門 · ${nm}`, icon: 'door', onClick: () => cdOpen(CD.near) }
    : what === 'in' ? { label: `上車 · ${nm}`, icon: 'car', onClick: () => cdIn(CD.near) }
    : what === 'close' ? { label: '關車門', icon: 'door', onClick: () => CD.rig && CD.near >= 0 && CD.rig.set(CD.near, 0) }
    : { label: '關車門', icon: 'door', onClick: () => { const R = CD.rig; if (R) for (let i = 0; i < R.doors.length; i++) R.set(i, 0); } }; // 'shut'：開車的時候（全部的門）
  return (CD.acts[key] = a);
}
function cdIn(i) {
  const R = CD.rig; if (!R || i < 0 || !walker || walker.mode !== 'walk') return;
  const rec = walker.cars.find((c) => c.object === tripS.car); if (!rec) return;
  const si = cdSeatOf(cur, R.doors[i].D), who = seatTaken(NET.me, cur)[si];
  if (who) { walker.toast(`${who}坐在這個位子`, 1600); return; } // 朋友坐在你的車上（大家的世界）
  if (si > 0) walker.getIn(rec, { seat: seatGo(cur, si, rec.cx) }); else walker.getIn(rec);
}
// 走路（homeWalk）：站在車門旁邊的大按鈕
function cdWalkAct(t) {
  CD.act2 = null;
  if (!walker || walker.mode !== 'walk' || indoor || doorFade || sleep || jailed() || !tripS) return null;
  if (Math.hypot(t.x - tripS.car.position.x, t.z - tripS.car.position.z) > 7) return null;
  if (!walker.cars.some((c) => c.object === tripS.car)) return null; // 走路那邊沒有這台（還在載入、別層）
  const R = cdRig(); if (!R) return null;
  const i = cdNear(t.x, t.z, 1.25); if (i < 0) return null;
  CD.near = i;
  if (R.doors[i].want < 1) return cdAct('open');
  CD.act2 = cdAct('close');
  return cdAct('in');
}
// 開車（HUD 左上的大按鈕）：門開著、停住了
function cdDriveAct(t) { const R = CD.rig; return R && CD.S === tripS && Math.abs(t.v) < 1 && R.doors.some((d) => d.want > 0) ? cdAct('shut') : null; }
// 每一格（martStep 後面）：門慢慢開關、走過去坐進去／走出來門自己開、開快了甩上、第二顆「關車門」
function cdStep(dt) {
  const ok = DRIVE.on && trip && tripS && CD.S === tripS && !RACE.on && tripS.car.visible;
  if (CD.rig && !ok) cdDrop();
  const mode = walker ? walker.mode : '';
  if (walker && (mode === 'in' || mode === 'seat' || mode === 'out') && tripS) { // 走過去坐進去、走出來：那個門自己打開
    const tg = walker.inTarget;
    if (tg && tg.car && tg.car.object === tripS.car) {
      const R = cdRig();
      if (R) {
        const w = walker.telemetry(), i = cdNear(tg.x, tg.z, 2.2);
        if (i >= 0 && R.doors[i].want < 1) { if (tg.out) cdOpen(i, 0.45); else if (mode === 'seat' || Math.hypot(w.x - tg.x, w.z - tg.z) < 1.8) cdOpen(i, mode === 'seat' ? 0.6 : 0); }
      }
    }
  }
  const R = CD.rig;
  if (R) {
    if (mode === 'off' && drv && !walker?.inTarget) { // 坐在車上
      const t = drv.telemetry();
      if (!t.paused && Math.abs(t.v) > 2.5) for (let i = 0; i < R.doors.length; i++) R.slam(i); // 開快了：甩上
      if (PAX.on) { CD.paxT += dt; if (CD.paxT > 1) for (let i = 0; i < R.doors.length; i++) R.set(i, 0); } else CD.paxT = 0; // 坐別的位子：坐好 1 秒門自己關
    } else CD.paxT = 0;
    R.step(dt);
  }
  if (CD.act2 && mode === 'walk') walker.setAction2(CD.act2);
  CD.act2 = null; CD.lastMode = mode;
}
