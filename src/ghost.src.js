// ==== 鬼影車排行榜（ghost.js；連線第 1 步，Nick 2026-10-10「開始做吧」）：build-art.mjs／build-app.mjs 接在 neihu.src.js 後面 ====
// 錄：爬山計時賽（town.src.js hillStep）、賽車場每一圈（circuit.src.js ciTick → ghLapTick）、400 公尺（race.src.js）
//   跑完一趟發 window 事件 'beau-run'：detail ＝ { board: 'hill'|'lap'|'drag', car, t（秒）, g（ghost.js 的包） }
//     t：爬山＝起點門到終點；lap＝一圈；drag＝400 公尺（不含反應時間，跟比完的表一樣）
//   網站（site/online.js）聽這個：比雲端上自己的好才上傳，沒登入先記著；試做頁沒有網站＝沒有人聽
// 播：網站叫 window.beauGame.setGhost(board, { name, car, t, g })（排行榜的「跟第 1 名的鬼影車跑」）→ 下一次跑那一種的時候多一台半透明的車
//   爬山：過起點門就出發；賽車場：每過一次終點線重新跑一圈；400 公尺：綠燈亮就出發（在你的車道，從你的車穿過去）
//   一次只放一台；再選一台、或 clearGhost() 就收掉；不加進任何碰撞（撞不到、警察和路人看不到它）
const GH = { arm: null, obj: null, job: 0, play: null, out: [0, 0, 0], hill: ghostRecorder(3), lap: ghostRecorder(3), drag: ghostRecorder(1), lapAt: undefined, lapN: 0, last: null, runs: 0 };
const GH_C = { hill: 3, lap: 3, drag: 1 };
const ghFmt = (board, t) => (board === 'drag' ? t.toFixed(2) : `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`);
const ghH = (x, z) => (VIL && VIL.heightAt ? VIL.heightAt(x, z) : 0);
// 跑完一趟（rec 錄好了）
function ghRun(board, t) {
  const g = GH[board].pack();
  if (!g || g.n < 2 || !(t > 1)) return;
  const detail = { board, car: cur, t: Math.round(t * 1000) / 1000, g };
  GH.last = detail; GH.runs++;
  try { window.dispatchEvent(new CustomEvent('beau-run', { detail })); } catch { /* 沒有人聽就算了 */ }
}
// 鬼影車：選好就先載（比賽開始馬上看得到）；沒有這台的輕量車（試做頁沒打包 Yaris）就換一台
function ghPrep() {
  const A = GH.arm; if (!A) return;
  const job = ++GH.job, keys = Object.keys(LOD_CARS);
  const k = LOD_CARS[A.car] ? A.car : LOD_CARS.gc8 ? 'gc8' : keys[0];
  if (!k) return;
  LOD_CARS[k].load().then((sc) => {
    if (job !== GH.job || GH.arm !== A) return;
    GH.obj = ghostCar(sc, k, { label: `👻 ${A.name} ${ghFmt(A.board, A.t)}` });
    GH.obj.car.visible = false;
  }, (e) => console.warn('鬼影車沒載好', e));
}
function ghDrop() { GH.job++; ghHide(); if (GH.obj) { GH.obj.dispose(); GH.obj = null; } }
// 開始跑（t0：那一種比賽的時間從哪裡算）；車子還沒載好也先開始算，好了就出現
function ghShow(board, scene, t0 = 0) {
  if (!GH.arm || GH.arm.board !== board) return false;
  GH.play = { board, scene, t: 0, t0, dist: 0, px: null, pz: null };
  return true;
}
function ghHide() { GH.play = null; if (GH.obj) GH.obj.car.visible = false; }
// 開車的世界（爬山、賽車場）：t 秒的位置，貼著地面、跟著坡度抬頭；回傳 false＝播完了
function ghPose(t) {
  const P = GH.play, A = GH.arm, O = GH.obj;
  if (!P || !A) return false;
  const more = ghostAt(A.G, t, GH.out);
  if (!O) return more;
  if (O.car.parent !== P.scene) P.scene.add(O.car);
  O.car.visible = true;
  const x = GH.out[0], z = GH.out[1], h = GH.out[2], fx = Math.cos(h) * 1.3, fz = -Math.sin(h) * 1.3;
  const y = ghH(x, z), pitch = Math.atan2(ghH(x + fx, z + fz) - ghH(x - fx, z - fz), 2.6);
  O.place(x, y, z, h, pitch);
  if (P.px != null) { P.dist += Math.hypot(x - P.px, z - P.pz); O.roll(P.dist); }
  P.px = x; P.pz = z;
  return more;
}
// ---- 爬山（hillStep 叫）----
function ghHillStart(t) { GH.hill.reset(); GH.hill.add(0, t.x, t.z, t.heading); ghShow('hill', TR.scene); }
function ghHillRec(t) { GH.hill.add(HILL.t, t.x, t.z, t.heading); }
function ghHillEnd(t, tt) { GH.hill.end(HILL.t, t.x, t.z, t.heading); ghRun('hill', tt); } // 到了：鬼影車自己跑完才收
function ghHillStop() { if (GH.play && GH.play.board === 'hill') ghHide(); }
function ghHillTick(dt) { // 每一格（hillStep 後面）
  const P = GH.play; if (!P || P.board !== 'hill') return;
  P.t = HILL.on ? HILL.t : P.t + dt; // 跑的時候跟計時器一樣；你到了以後鬼影車自己跑完
  if (!ghPose(P.t) && P.t > GH.arm.G.dur + 1.5) ghHide();
}
// 爬山計時賽到了：比鬼影快還是慢（toast 後面加的那一句）
function ghVs(board, t) {
  const A = GH.arm; if (!A || A.board !== board) return '';
  const d = t - A.t;
  return Math.abs(d) < 0.005 ? '　跟鬼影一樣快！' : d < 0 ? `　比鬼影快 ${(-d).toFixed(2)} 秒` : `　比鬼影慢 ${d.toFixed(2)} 秒`;
}
// ---- 賽車場（ciTick 叫，比賽 update 之後）：每過一次終點線＝一圈錄好了、鬼影車重新跑一圈 ----
function ghLapTick() {
  const R = ciRace;
  if (!R) { if (GH.lapAt !== undefined) { GH.lapAt = undefined; if (GH.play && GH.play.board === 'lap') ghHide(); } return; }
  const me = R.me, t = R.time;
  if (me.lap0 !== GH.lapAt) {
    const tl = drv.telemetry();
    if (GH.lapAt != null && me.laps.length > GH.lapN) { GH.lap.end(t - GH.lapAt, tl.x, tl.z, tl.heading); ghRun('lap', me.laps[me.laps.length - 1]); }
    GH.lapAt = me.lap0 ?? null; GH.lapN = me.laps.length;
    if (me.lap0 != null && me.fin == null) { GH.lap.reset(); GH.lap.add(0, tl.x, tl.z, tl.heading); ghShow('lap', TR.scene, me.lap0); }
  } else if (me.lap0 != null && me.fin == null) { const tl = drv.telemetry(); GH.lap.add(t - me.lap0, tl.x, tl.z, tl.heading); }
  const P = GH.play;
  if (P && P.board === 'lap' && !ghPose(t - P.t0) && t - P.t0 > GH.arm.G.dur + 1.5) ghHide();
}
// ---- 400 公尺（race.src.js 叫）：x＝車頭離起跑線幾公尺，鬼影車在你的車道 ----
function ghDragStart(R) { R.ghDone = false; GH.drag.reset(); ghShow('drag', TR.scene); ghDragPose(0); }
function ghDragFrame(R) {
  if (R.green != null && R.phase === 'run' && !R.ghDone) { if (R.me.fin != null) { GH.drag.end(R.t - R.green, R.me.x); R.ghDone = true; } else GH.drag.add(R.t - R.green, R.me.x); }
  if (GH.play && GH.play.board === 'drag') ghDragPose(R.green == null ? 0 : R.t - R.green);
}
function ghDragPose(tt) {
  const P = GH.play, A = GH.arm, O = GH.obj;
  if (!P || !A || !O) return;
  if (O.car.parent !== P.scene) P.scene.add(O.car);
  O.car.visible = true;
  ghostAt(A.G, tt, GH.out);
  O.place(GH.out[0] - O.nose, 0, LANE, 0); O.roll(GH.out[0]);
}
function ghDragEnd(R, et) { if (!R.ghDone && R.me.fin != null) GH.drag.end(Math.max(R.me.fin, R.t - R.green), R.me.x); R.ghDone = true; ghRun('drag', et); }
// ---- 網站叫的（site/online.js）----
window.beauGame = {
  cars() { const o = {}; for (const k of Object.keys(CARS)) o[k] = CARS[k].btn[0]; return o; },
  get cur() { return cur; },
  setGhost(board, run) {
    if (!GH_C[board] || !run) return false;
    const G = ghostUnpack(run.g);
    if (!G || G.c !== GH_C[board]) return false;
    ghDrop();
    GH.arm = { board, name: String(run.name || '').slice(0, 12), car: String(run.car || ''), t: +run.t > 0 ? +run.t : G.dur, G };
    ghPrep();
    if (DRIVE.on && drv) { setDest(board === 'hill' ? 'mountain' : board === 'lap' ? 'circuit' : 'track'); drv.toast('鬼影車準備好了！照著路線開過去', 2600); }
    return true;
  },
  clearGhost() { ghDrop(); GH.arm = null; },
  get ghost() { const A = GH.arm; return A ? { board: A.board, name: A.name, car: A.car, t: A.t, ready: !!GH.obj, showing: !!GH.play } : null; },
};
