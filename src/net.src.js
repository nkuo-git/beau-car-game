// ==== 連線第 2–4 步：一起開車、一起比賽、參觀車庫（net.src.js；build-art.mjs／build-app.mjs 接在 ghost.src.js 後面）====
// Nick 2026-10-10「那可以開始做上面12點的前3點」；草稿 https://claude.ai/artifact/6BtzWH7D5uWYMCra2e7DJo 第 3–6、9 張（Nick 和爸媽都說好）
// 網站（site/room.js）管房間碼、即時資料庫；這裡只管遊戲裡面：朋友的車和人（頭上有名字）、表情、小地圖／大地圖上的朋友、一起比賽、參觀車庫
// window.beauGame.net（網站叫的）：
//   join({ code, me, host })／leave()；members([{ uid, n, car, l（外觀）, ch（角色的樣子）}])（不含自己；順序＝進房間的順序，決定顏色）
//   snap(uid, { t, x, z, h, v, o, k, rp, rs })：朋友的位置（t＝伺服器時間毫秒；o：0 不在外面、1 開車、2 走路、3 在 400 公尺；rp＝這一場跑多遠、rs＝第幾場）
//   emote(uid, e)：朋友送的表情（NET_E 的第幾個）；clock(off)：伺服器時間＝Date.now()＋off
//   state() → 自己現在的（送給朋友）；look() → { car, l, ch }（自己開的車、外觀、角色）；garage() → { cur, cars: { key: 外觀 } }（參觀車庫用）
//   race({ seq, kind, go, order })：房主選的（kind：out 一起出門｜circuit 賽車場 3 圈｜drag 400 公尺｜hill 爬山；go＝出發的伺服器時間，0＝還在等大家準備好；order＝房間裡的人：起跑格）
//   results(seq, { uid: 秒 | −1（沒跑完）})；where() → 'garage' | 'out' | 'race'（參觀車庫只能在車庫頁）
//   遊戲發 window 事件 'beau-net'（detail.type）：emote { e }｜ready { seq }｜fin { seq, t }（t＝−1 沒跑完）｜again（房主按「再來一場」）｜room（點房間那一塊）
// window.beauGame.visit({ name, cars: [{ k, l }], likes, liked, onLike, onClose }) → { setLikes(n, liked), close() } | null（不在車庫頁）
// 安全（草稿說好的）：只有名字（網站擋過髒話）；表情只有固定的幾個；朋友的車在比賽中穿過去，平常會擋（撞到照兩台車的速度算）；朋友走路的人不會被撞到（穿過去）；警察只追自己
// 效能：朋友一台車＝輕量車 4 個 draw call＋影子＋名字；走路的人 2 個＋名字；每一格不 new（位置照 0.2 秒前的兩筆內插）
const NET_E = ['👍', '😂', '好車！', '跟我來', '比一場？'];
const NET_COL = ['#4a8cff', '#46c46f', '#f2c230', '#ff5fa2']; // 朋友的顏色（進房間的順序）；你自己是橘色
const NET_DELAY = 220; // 畫朋友的位置：0.22 秒前的（網路不穩也平順）
const NET_HOLD = { throttle: 0, brake: 1, steer: 0, handbrake: 1 };
const NET = { on: false, code: '', me: '', host: '', off: 0, mem: [], P: new Map(), race: null, doneSeq: 0, outSeq: 0, hud: null, marks: [], cols: [], wkT: 0, setD: null, setW: null, tex: {}, shGeo: null, shMat: null };
const netNow = () => Date.now() + NET.off;
const netEv = (type, d = {}) => { try { window.dispatchEvent(new CustomEvent('beau-net', { detail: { type, ...d } })); } catch { /* 沒有人聽就算了 */ } };
const netWorld = () => DRIVE.on && !indoor && !!VIL; // 在外面（開車、走路；不含房子裡面、400 公尺）

// ---- 名字、表情的貼圖（sprite：遠近都一樣大）----
function netTagTex(text, col) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
  const g = cv.getContext('2d');
  g.font = '700 50px "Noto Sans TC", "PingFang TC", sans-serif';
  const w = Math.min(500, g.measureText(text).width + 84), x0 = (512 - w) / 2;
  g.fillStyle = 'rgba(12,13,16,0.78)'; g.beginPath(); g.roundRect(x0, 8, w, 80, 20); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(x0 + 34, 48, 13, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f3f3f1'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256 + 20, 50, w - 70);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}
function netBubbleTex(i) {
  if (NET.tex[i]) return NET.tex[i];
  const cv = document.createElement('canvas'); cv.width = 384; cv.height = 112;
  const g = cv.getContext('2d'), text = NET_E[i];
  g.font = '800 54px "Noto Sans TC", "PingFang TC", sans-serif';
  const w = Math.min(370, g.measureText(text).width + 56), x0 = (384 - w) / 2;
  g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(x0, 6, w, 82, 26); g.fill();
  g.beginPath(); g.moveTo(180, 86); g.lineTo(192, 106); g.lineTo(204, 86); g.fill(); // 小尾巴
  g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 192, 49, w - 30);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  return (NET.tex[i] = tx);
}
function netSprite(map, w, h, cy) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }));
  sp.scale.set(w, h, 1); sp.center.set(0.5, cy); sp.renderOrder = 8; sp.frustumCulled = false;
  return sp;
}

// ---- 朋友 ----
function netPeer(uid) {
  let P = NET.P.get(uid);
  if (!P) {
    P = { uid, n: '', car: '', l: null, ch: null, col: NET_COL[0], buf: [], cur: { t: 0, x: 0, z: 0, h: 0, v: 0, o: 0, k: '', rp: null, rs: 0 }, last: 0,
      obj: null, objK: '', job: 0, chr: null, chrK: '', tag: null, bub: null, bubT: 0, roll: 0, px: null, pz: null, mk: { x: 0, z: 0, fill: NET_COL[0], ring: '#ffffff', r: 6, label: '', name: '', on: false },
      box: { t: 'box', x: 0, z: 0, hx: 2.2, hz: 0.9, rot: 0, h: 1.4, vx: 0, vz: 0, m: 1, dvx: 0, dvz: 0 }, vis: false };
    NET.P.set(uid, P); NET.marks.push(P.mk);
  }
  return P;
}
function netDropObj(P) {
  P.job++;
  if (P.obj) { P.obj.car.removeFromParent(); P.obj.sh.removeFromParent(); P.obj.lod.dispose(); P.obj = null; }
  P.objK = '';
}
function netDropChr(P) { if (P.chr) { P.chr.dispose(); P.chr = null; } P.chrK = ''; }
function netDropPeer(P) {
  netDropObj(P); netDropChr(P);
  for (const sp of [P.tag, P.bub]) if (sp) { sp.removeFromParent(); if (sp === P.tag) sp.material.map.dispose(); sp.material.dispose(); }
  P.tag = P.bub = null;
  const i = NET.marks.indexOf(P.mk); if (i >= 0) NET.marks.splice(i, 1);
  NET.P.delete(P.uid);
}
// 外觀：那台車原本的樣子＋朋友改的（這個版本沒有的選項不用）
function netLook(k, l) {
  const look = { ...DEFAULT_LOOK[k] };
  if (l && typeof l === 'object') for (const [o, v] of Object.entries(l)) if (o in look && typeof v === 'string' && okValue(k, o, v)) look[o] = v;
  return look;
}
// 朋友開的車（輕量車）：換車才重組；沒有這台的輕量車（試做頁沒打包 Yaris）換一台、顏色照舊
function netCar(P, k) {
  if (P.objK === k) return;
  netDropObj(P); P.objK = k;
  const keys = Object.keys(LOD_CARS), kk = LOD_CARS[k] ? k : LOD_CARS.gc8 ? 'gc8' : keys[0];
  if (!kk) return;
  const job = P.job;
  LOD_CARS[kk].load().then((sc) => {
    if (job !== P.job || NET.P.get(P.uid) !== P) return;
    const lod = buildLodCar(kk, sc, kk === k ? netLook(kk, P.l) : { ...DEFAULT_LOOK[kk], paint: netLook(k, P.l).paint || DEFAULT_LOOK[kk].paint });
    lod.car.position.set(0, 0, 0); lod.car.rotation.set(0, 0, 0); lod.car.updateMatrixWorld(true);
    const B = new THREE.Box3().setFromObject(lod.car);
    lod.car.rotation.order = 'YXZ'; lod.car.name = 'net-' + P.uid; lod.car.visible = false;
    if (!NET.shMat) { NET.shGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); NET.shMat = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: 0.8 }); }
    const sh = new THREE.Mesh(NET.shGeo, NET.shMat); sh.renderOrder = 1; sh.visible = false; sh.matrixAutoUpdate = false;
    P.obj = { lod, car: lod.car, sh, nose: B.max.x, tail: B.min.x, hw: Math.max(B.max.z, -B.min.z), top: B.max.y, cx: (B.max.x + B.min.x) / 2 };
    TR.scene.add(lod.car, sh);
  }, (e) => console.warn('朋友的車沒載好', e));
}
function netChr(P) {
  const key = JSON.stringify(P.ch || null);
  if (P.chr && P.chrK === key) return;
  netDropChr(P); P.chrK = key;
  try { P.chr = buildCharacter({ ...PLAYER_LOOK, ...(validLook(P.ch) || {}) }); P.chr.group.visible = false; P.chr.group.name = 'net-walk-' + P.uid; TR.scene.add(P.chr.group); } catch (e) { console.warn('朋友的人沒做好', e); P.chr = null; }
}
function netTag(P) {
  if (P.tag) { P.tag.material.map.dispose(); P.tag.material.map = netTagTex(P.n, P.col); P.tag.material.needsUpdate = true; return; }
  P.tag = netSprite(netTagTex(P.n, P.col), 0.22, 0.041, 0); P.tag.visible = false; // 放進場景：netStep（在車庫頁還沒有 TR）
}
// 0.22 秒前的位置（前後兩筆內插；最後一筆之後照速度往前推最多 0.5 秒）
const NET_S = { x: 0, z: 0, h: 0, v: 0 };
function netSample(P, T) {
  const b = P.buf, n = b.length; if (!n) return null;
  let a = b[0];
  if (T <= a.t || n === 1) { NET_S.x = a.x; NET_S.z = a.z; NET_S.h = a.h; NET_S.v = a.v; return NET_S; }
  let i = n - 1; while (i > 0 && b[i].t > T) i--;
  a = b[i];
  if (i === n - 1) { const d = Math.min(0.5, (T - a.t) / 1000); NET_S.x = a.x + Math.cos(a.h) * a.v * d; NET_S.z = a.z - Math.sin(a.h) * a.v * d; NET_S.h = a.h; NET_S.v = a.v; return NET_S; }
  const c = b[i + 1], f = (T - a.t) / Math.max(1, c.t - a.t);
  NET_S.x = a.x + (c.x - a.x) * f; NET_S.z = a.z + (c.z - a.z) * f; NET_S.h = a.h + wrapPi(c.h - a.h) * f; NET_S.v = a.v + (c.v - a.v) * f;
  return NET_S;
}
const netH = (x, z) => (VIL && VIL.heightAt ? VIL.heightAt(x, z) : 0);
// 每一格（driveStep 最後）：朋友的車、人、名字、表情、小地圖的點、碰撞
function netStep(dt) {
  if (!NET.on) return;
  netHudTick(dt);
  netRaceTick(dt);
  const show = netWorld(), T = netNow() - NET_DELAY, now = netNow(), race = !!(NET.race && NET.race.kind !== 'out') || !!ciRace || !!orRace;
  NET.cols.length = 0;
  for (const P of NET.P.values()) {
    const c = P.cur, fresh = now - P.last < 6000, s = show && fresh && (c.o === 1 || c.o === 2) ? netSample(P, T) : null;
    const car = !!s && c.o === 1, walkin = !!s && c.o === 2;
    if (car) netCar(P, c.k);
    if (walkin) netChr(P);
    const O = car ? P.obj : null, C = walkin ? P.chr : null;
    if (P.obj) { P.obj.car.visible = !!O; P.obj.sh.visible = !!O; }
    if (P.chr) P.chr.group.visible = !!C;
    P.mk.on = !!s; P.vis = !!(O || C);
    if (s) { P.mk.x = s.x; P.mk.z = s.z; }
    if (O) {
      const fx = Math.cos(s.h) * 1.3, fz = -Math.sin(s.h) * 1.3, y = netH(s.x, s.z);
      O.car.position.set(s.x, y, s.z); O.car.rotation.set(0, s.h, Math.atan2(netH(s.x + fx, s.z + fz) - netH(s.x - fx, s.z - fz), 2.6));
      if (P.px != null) { P.roll += Math.hypot(s.x - P.px, s.z - P.pz) * (s.v < 0 ? -1 : 1); O.lod.setRoll(P.roll); }
      O.sh.matrix.makeRotationY(s.h).scale(V_NET.set(O.nose - O.tail + 0.6, 1, O.hw * 2 + 0.4)).setPosition(s.x + Math.cos(s.h) * O.cx, y + 0.05, s.z - Math.sin(s.h) * O.cx); O.sh.matrixWorldNeedsUpdate = true;
      if (P.tag) P.tag.position.set(s.x, y + O.top + 0.35, s.z);
      if (!race && (drv || walker)) { // 平常會擋（撞到照兩台車的速度算；朋友那邊自己算自己的）；比賽中穿過去
        const k = P.box; k.x = s.x + Math.cos(s.h) * O.cx; k.z = s.z - Math.sin(s.h) * O.cx; k.hx = (O.nose - O.tail) / 2; k.hz = O.hw; k.rot = s.h;
        k.vx = Math.cos(s.h) * s.v; k.vz = -Math.sin(s.h) * s.v; k.dvx = k.dvz = 0; NET.cols.push(k);
      }
    } else if (C) {
      const y = netH(s.x, s.z);
      C.group.position.set(s.x, y, s.z); C.group.rotation.y = s.h;
      C.update(dt, { speed: Math.abs(s.v) });
      if (P.tag) P.tag.position.set(s.x, y + C.height + 0.45, s.z);
    }
    P.px = s ? s.x : null; P.pz = s ? s.z : null;
    if (P.vis) for (const sp of [P.tag, P.bub]) if (sp && !sp.parent) TR.scene.add(sp);
    if (P.tag) P.tag.visible = P.vis;
    if (P.bub) { P.bubT -= dt; P.bub.visible = P.vis && P.bubT > 0; if (P.bub.visible) P.bub.position.copy(P.tag.position); }
  }
  if (drv) {
    if (NET.setD !== drv) { NET.setD = drv; drv.setMarkers(NET.marks, 'net'); }
    drv.removeColliders('net'); if (NET.cols.length) drv.addColliders(NET.cols, 'net');
  }
  if (walker) {
    if (NET.setW !== walker) { NET.setW = walker; walker.setMarkers(NET.marks, 'net'); }
    NET.wkT -= dt; if (NET.wkT <= 0) { NET.wkT = 0.2; walker.removeColliders('net'); if (NET.cols.length) walker.addColliders(NET.cols, 'net'); } // 走路的碰撞 5 次／秒就好
  }
}
const V_NET = new THREE.Vector3();
function netHideAll() {
  for (const P of NET.P.values()) { if (P.obj) { P.obj.car.visible = false; P.obj.sh.visible = false; } if (P.chr) P.chr.group.visible = false; if (P.tag) P.tag.visible = false; if (P.bub) P.bub.visible = false; P.mk.on = false; }
  drv?.removeColliders('net'); walker?.removeColliders('net');
}

// ---- 畫面：房間那一塊（點了打開網站的房間）、表情 ----
function netHud() {
  if (NET.hud) return NET.hud;
  const st = document.createElement('style');
  st.textContent = `.nt{position:absolute;z-index:6;top:calc(var(--fs-t,0px) + 196px);right:calc(var(--fs-r,0px) + 10px);display:flex;align-items:center;justify-content:flex-end;gap:6px;max-width:calc(100% - 20px);font-family:"Noto Sans TC","PingFang TC",sans-serif;pointer-events:none}
.nt[hidden],.nt-tray[hidden],.nt-race[hidden],.nt-res[hidden]{display:none}
.nt button{pointer-events:auto;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;border:0;font-family:inherit}
.nt-room{height:34px;display:flex;align-items:center;gap:6px;padding:0 12px;border-radius:999px;background:rgba(14,15,18,0.72);color:#F2F3F5;font-size:13px;font-weight:700;white-space:nowrap;max-width:230px;overflow:hidden;text-overflow:ellipsis}
.nt-room b{color:#FF6A1F;font:700 17px/1 "Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:.06em}
.nt-room.msg{background:#F2F3F5;color:#1a1a1a}
.nt-emo{width:34px;height:34px;border-radius:50%;background:rgba(14,15,18,0.72);color:#F2F3F5;font-size:17px;display:grid;place-items:center}
.nt-tray{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}
.nt-tray button{height:34px;padding:0 11px;border-radius:999px;background:rgba(14,15,18,0.85);color:#F2F3F5;font-size:14px;font-weight:700;box-shadow:0 3px 0 rgba(0,0,0,0.35)}
.nt-tray button:active{transform:translateY(2px);box-shadow:none}
.nt-race{position:absolute;z-index:7;left:50%;top:30%;transform:translate(-50%,-50%);text-align:center;color:#F2F3F5;font-family:"Noto Sans TC",sans-serif;pointer-events:none;text-shadow:0 3px 0 rgba(0,0,0,0.45)}
.nt-race b{display:block;font:700 92px/1 "Barlow Condensed","Arial Narrow",sans-serif;color:#FF6A1F}
.nt-race b.go{color:#3DDC84;font-size:64px}
.nt-race span[hidden]{display:none}
.nt-race span{display:inline-block;margin-top:6px;padding:6px 14px;border-radius:999px;background:rgba(14,15,18,0.72);font-size:15px;font-weight:700;text-shadow:none}
.nt-quit{position:absolute;z-index:6;top:calc(var(--fs-t,0px) + 150px);left:calc(var(--fs-l,0px) + 10px);padding:8px 14px;border:0;border-radius:999px;background:rgba(14,15,18,0.72);color:#F2F3F5;font:700 14px "Noto Sans TC",sans-serif;cursor:pointer;touch-action:manipulation}
.nt-quit[hidden]{display:none}
.nt-res{position:absolute;z-index:9;left:50%;bottom:calc(var(--fs-b,0px) + 12px);transform:translateX(-50%);width:min(340px,calc(100% - 20px));box-sizing:border-box;padding:14px 13px;border-radius:18px;background:rgba(20,21,24,0.94);border:1px solid #34363c;color:#F2F3F5;font-family:"Noto Sans TC",sans-serif;display:flex;flex-direction:column;gap:7px;pointer-events:auto}
.nt-res h3{margin:0 0 2px;font-size:18px}
.nt-res ol{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:5px}
.nt-res li{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 10px;border-radius:10px;background:#24262b;font-size:14px}
.nt-res li.me{outline:1.5px solid #FF6A1F}
.nt-res li i{font:700 18px/1 "Barlow Condensed",sans-serif;font-style:normal;color:#a3a5ab;text-align:center}
.nt-res li span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nt-res li b{font:700 18px/1 "Barlow Condensed",sans-serif;font-variant-numeric:tabular-nums}
.nt-res li em{font-style:normal;font-size:12px;color:#a3a5ab}
.nt-res .row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:3px}
.nt-res .row button{min-height:44px;border:0;border-radius:11px;font:800 15px "Noto Sans TC",sans-serif;cursor:pointer}
.nt-res .a{background:#FF6A1F;color:#1a0d05}.nt-res .a:disabled{opacity:.55}
.nt-res .b{background:#24262b;color:#F2F3F5;border:1px solid #34363c}
.nt-res p{margin:0;font-size:12px;color:#a3a5ab}
body.bigmap .nt,body.shopping .nt,body.cimenu .nt{display:none}`;
  document.head.appendChild(st);
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const root = mk('div', 'nt'), room = mk('button', 'nt-room'), emo = mk('button', 'nt-emo', '💬'), tray = mk('div', 'nt-tray');
  room.type = emo.type = 'button'; emo.setAttribute('aria-label', '送表情');
  for (let i = 0; i < NET_E.length; i++) { const b = mk('button', null, NET_E[i]); b.type = 'button'; b.addEventListener('click', () => netSend(i)); tray.append(b); }
  const x = mk('button', null, '✕'); x.type = 'button'; x.setAttribute('aria-label', '收起來'); x.addEventListener('click', () => netTray(false)); tray.append(x);
  tray.hidden = true; root.hidden = true;
  room.addEventListener('click', () => netEv('room'));
  emo.addEventListener('click', () => netTray(true));
  root.append(room, emo, tray);
  const rc = mk('div', 'nt-race'), big = mk('b'), sub = mk('span'), quit = mk('button', 'nt-quit', '放棄這場');
  quit.type = 'button'; quit.hidden = true; quit.addEventListener('click', () => netQuit('quit'));
  rc.append(big, mk('br'), sub); rc.hidden = true;
  const res = mk('div', 'nt-res'); res.hidden = true;
  stage.append(root, rc, quit, res);
  NET.hud = { root, room, emo, tray, rc, big, sub, quit, res, msg: '', msgT: 0, last: '', sig: '' };
  return NET.hud;
}
function netTray(on) { const H = netHud(); H.tray.hidden = !on; H.room.hidden = on; H.emo.hidden = on; }
let netSentT = -9;
function netSend(i) {
  const t = performance.now() / 1000; if (t - netSentT < 1.2) return; netSentT = t; // 一直按：1.2 秒一個
  netTray(false);
  netEv('emote', { e: i });
  netSay(`你：${NET_E[i]}`);
}
function netSay(text) { const H = netHud(); H.msg = text; H.msgT = 2.6; }
function netHudTick(dt) {
  const H = netHud();
  const out = netWorld() && !RACE.on && !(walker && walker.mode === 'walk' && walker.telemetry().paused);
  if (H.root.hidden === out) H.root.hidden = !out;
  if (H.msgT > 0) H.msgT -= dt;
  const n = 1 + NET.mem.length, txt = H.msgT > 0 ? H.msg : `房間 ${NET.code} · ${n} 個人`;
  if (txt !== H.last) {
    H.last = txt; H.room.classList.toggle('msg', H.msgT > 0);
    if (H.msgT > 0) H.room.textContent = txt; else { H.room.replaceChildren('房間 ', Object.assign(document.createElement('b'), { textContent: NET.code }), ` · ${n} 個人`); }
  }
}

// ---- 朋友送的表情：頭上一個白色泡泡 3 秒（看不到他的時候房間那一塊寫出來）----
function netEmote(uid, e) {
  const P = NET.P.get(uid); if (!P || !(e >= 0 && e < NET_E.length)) return;
  if (!P.bub) { P.bub = netSprite(netBubbleTex(e), 0.17, 0.05, -0.95); } else { P.bub.material.map = netBubbleTex(e); P.bub.material.needsUpdate = true; }
  P.bubT = 3;
  netSay(`${P.n}：${NET_E[e]}`);
}

// ---- 一起比賽（房主選；大家同時出發；比賽中穿過去）----
// 準備：在車庫頁就先出門；下車的上車；在房子裡就出來；放到起點（每個人一格）→ 告訴網站準備好了 → 房主等大家準備好（最多 30 秒）定出發時間 → 倒數 → 出發
// 成績：秒數（賽車場 3 圈從熄燈算；400 公尺從綠燈算、含反應時間；爬山從出發算到山頂）；大家的成績一起列（還在跑的寫「跑中」，沒跑完的寫「沒跑完」）
const NET_KIND = { circuit: '大便龍賽車場 3 圈', drag: '400 公尺直線加速', hill: '爬山計時賽' };
function netRace(r) {
  if (!NET.on || !r || !r.seq) return;
  if (r.kind === 'out') { if (r.seq !== NET.outSeq) { NET.outSeq = r.seq; netOut(); } return; }
  if (!NET_KIND[r.kind]) return;
  const R = NET.race;
  if (r.seq <= NET.doneSeq) return; // 已經結束（回房間）的那一場：房間的資料還在，不要又開始
  if (!R || R.seq !== r.seq) { netRaceEnd(); netRaceNew(r); return; }
  if (Array.isArray(r.order)) R.order = r.order.slice(0, 4);
  if (r.go && !R.go) R.go = +r.go;
}
async function netOut() { // 一起出門：在車庫頁就出門（在 400 公尺的比賽裡就留著）
  if (trip || enterDrive.busy) return;
  if (RACE.on) exitRace();
  for (let i = 0; i < 40 && !S; i++) await new Promise((r) => setTimeout(r, 250)); // 車子還在開進車庫
  if (!trip) enterDrive();
}
function netRaceNew(r) {
  const R = { seq: r.seq, kind: r.kind, order: Array.isArray(r.order) ? r.order.slice(0, 4) : [], go: +r.go || 0, phase: 'prep', res: {}, myT: null, riv: [], ci: null, held: false, said: '', t0: performance.now() };
  NET.race = R;
  netRacePrep(R).catch((e) => { console.warn('一起比賽沒準備好', e); if (NET.race === R) netQuit('fail'); });
}
const netSlot = (R) => Math.max(0, R.order.indexOf(NET.me));
async function netRacePrep(R) {
  const H = netHud();
  H.rc.hidden = false; H.big.textContent = ''; H.big.className = ''; H.sub.textContent = `${NET_KIND[R.kind]}：準備中⋯`; H.sub.hidden = false; H.res.hidden = true; H.sig = '';
  if (RACE.on && !(R.kind === 'drag' && race?.net === R)) { if (trip) backToVillage(); else exitRace(); } // 在 400 公尺（自己比的）：先出來
  if (!trip) { await netOut(); for (let i = 0; i < 160 && enterDrive.busy; i++) await new Promise((r) => setTimeout(r, 250)); }
  if (NET.race !== R) return;
  if (!DRIVE.on || !drv && !walker) { netQuit('fail'); return; }
  if (jailed()) { netQuit('jail'); return; }
  const slot = netSlot(R), pose = netStartPose(R.kind, slot);
  if (!pose || !netSeat(pose)) { netQuit('fail'); return; }
  if (R.kind === 'circuit') {
    const d = drv;
    R.riv = R.order.filter((u) => u !== NET.me).map((u) => ({ uid: u, name: NET.P.get(u)?.n || '朋友', p: -1e9, fin: null }));
    ciRace = R.ci = createCircuitRace({ world: VIL, scene: TR.scene, drive: d, laps: 3, hudParent: stage, title: '一起比賽', calm, opps: [], grid: slot, rivals: R.riv, result: false,
      startIn: () => (R.go ? (R.go - netNow()) / 1000 : null),
      onFinish: (res) => netFin(R, Math.round(res.time * 1000) / 1000),
      onDone: () => {},
      onAbort: (why) => { setTimeout(() => { if (NET.race === R) netQuit(why === 'left' ? 'left' : 'quit'); }, 0); },
    });
    ciCars = []; polRace(true); document.body.classList.add('ciracing');
  } else if (R.kind === 'hill') {
    hillStop(); polRace(true); drv.setInput(NET_HOLD); R.held = true;
  } else if (R.kind === 'drag') {
    R.dragPending = true;
    toRace(); // 400 公尺：race.src.js 的 enterRace 叫 netDragInit（不放 AI 對手）
    if (!RACE.on || race?.net !== R) { netQuit('fail'); return; }
  }
  if (NET.race !== R) return;
  R.phase = 'wait';
  netEv('ready', { seq: R.seq });
}
// 起點：賽車場＝起跑格；爬山＝起點門前面（兩個兩個一排）；400 公尺＝起跑區
function netStartPose(kind, slot) {
  if (kind === 'circuit') { const g = VIL.circuit?.grid(slot); return g ? { x: g.x, z: g.z, heading: 0 } : null; }
  if (kind === 'hill') {
    const st = VIL.mountain?.trial?.start; if (!st) return null;
    const h = st.heading, fx = Math.cos(h), fz = -Math.sin(h), rx = Math.sin(h), rz = Math.cos(h), back = 10 + Math.floor(slot / 2) * 7, side = slot % 2 ? 1.7 : -1.7;
    return { x: st.x - fx * back + rx * side, z: st.z - fz * back + rz * side, heading: h };
  }
  if (kind === 'drag') return VIL.places.track?.start || null;
  return null;
}
// 不管現在在做什麼（走路、在房子裡、在車店、自己的比賽）：坐進現在這台車、放到 pose
function netSeat(pose) {
  if (!DRIVE.on || !walker || jailed()) return false;
  BIGMAP?.close(); panelClose();
  if (indoor) leaveHouse(null);
  if (doorFade) { doorFade = null; if (fadeEl) fadeEl.style.display = 'none'; }
  ciMenuClose(true); ciEnd(); orEnd(); hillStop(); police?.clear();
  if (walker.mode !== 'off') walker.pause({ hide: true });
  if (drv) { drv.resume(); if (drv.cameraMode) drv.setCameraMode(drv.cameraMode); }
  else { offDeck(cur); makeDrv(pose); }
  drv.setInput(null); drv.teleport(pose); drv.setDestination(null);
  if (!dvoice) dvoice = engineAudio.voice(cur, { parts: partsOf(cur) });
  arrangeCars();
  return true;
}
function netFin(R, t) {
  if (NET.race !== R || R.myT != null) return;
  R.myT = t; R.phase = 'done'; R.res[NET.me] = t;
  netEv('fin', { seq: R.seq, t });
  netResShow(R);
}
function netQuit(why) {
  const R = NET.race; if (!R) return;
  if (R.myT == null) { R.myT = -1; R.res[NET.me] = -1; netEv('fin', { seq: R.seq, t: -1 }); }
  R.phase = 'done';
  const H = netHud();
  if (why === 'jail') netSay('在警察局：這場不能比');
  if (R.kind === 'circuit' && R.ci && ciRace === R.ci) ciEnd();
  if (R.kind === 'hill' && R.held && drv) { drv.setInput(null); R.held = false; }
  if (R.kind === 'drag' && RACE.on && race?.net === R && why !== 'back') backToVillage();
  polRace(false);
  H.rc.hidden = true; H.quit.hidden = true;
  netResShow(R);
}
// 爬山到山頂（town.src.js 的 hillStep 叫）
function netHill(tt) {
  const R = NET.race; if (!R || R.kind !== 'hill' || R.phase !== 'run') return;
  netFin(R, R.go ? Math.round((netNow() - R.go) / 10) / 100 : tt);
}
function netRaceTick(dt) {
  const R = NET.race, H = NET.hud; if (!R || !H) return;
  const left = R.go ? (R.go - netNow()) / 1000 : null;
  // 賽車場：朋友跑多遠（名次）、跑完的秒數
  for (const v of R.riv) { const P = NET.P.get(v.uid); if (P && P.cur.rs === R.seq && typeof P.cur.rp === 'number') v.p = P.cur.rp; const t = R.res[v.uid]; v.fin = t > 0 ? t : null; if (P && P.n) v.name = P.n; }
  if (R.phase === 'wait' || R.phase === 'run' && left != null && left > -1.2) {
    let big = '', sub = '';
    if (left == null) sub = `${NET_KIND[R.kind]}：等大家準備好⋯`;
    else if (left > 0) { if (R.kind !== 'circuit' && R.kind !== 'drag') big = left <= 3 ? String(Math.ceil(left)) : ''; sub = R.kind === 'circuit' ? '紅燈全部熄掉就出發！' : R.kind === 'drag' ? '綠燈一亮就按起步！' : '倒數完就出發！'; }
    else if (R.kind === 'hill') big = '出發！';
    const sig = big + '|' + sub;
    if (sig !== H.sig) { H.sig = sig; H.big.textContent = big; H.big.className = big === '出發！' ? 'go' : ''; H.sub.textContent = sub; H.sub.hidden = !sub; }
    H.rc.hidden = left != null && (R.kind === 'circuit' || R.kind === 'drag' && left <= 0); // 賽車場有自己的紅燈、400 公尺有燈樹
    if (left != null && left <= 0 && R.phase === 'wait') { R.phase = 'run'; R.runAt = netNow(); if (R.kind === 'hill' && drv) { drv.setInput(null); R.held = false; } }
    if (R.kind === 'hill' && R.held && drv && Math.abs(drv.telemetry().v) > 0.3) drv.setInput(NET_HOLD);
  } else if (!H.rc.hidden && R.phase !== 'prep') H.rc.hidden = true;
  const q = R.kind === 'hill' && (R.phase === 'wait' || R.phase === 'run') && R.myT == null && netWorld(); // 爬山：沒有自己的「放棄」（賽車場有、400 公尺按「開回村子」）
  if (H.quit.hidden === q) H.quit.hidden = !q;
  if (R.phase === 'done' && !H.res.hidden) { R.resT = (R.resT || 0) - dt; if (R.resT <= 0) { R.resT = 0.5; netResShow(R); } }
}
function netResults(seq, map) {
  const R = NET.race; if (!R || R.seq !== seq || !map) return;
  for (const [u, t] of Object.entries(map)) if (typeof t === 'number' && t !== 0 && u !== NET.me) R.res[u] = t;
  if (R.phase === 'done') netResShow(R);
}
const netFmt = (kind, t) => (kind === 'drag' ? `${t.toFixed(2)} 秒` : `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`);
function netResShow(R) {
  const H = netHud();
  const rows = R.order.map((u) => {
    const P = NET.P.get(u), t = R.res[u], me = u === NET.me;
    const p = me ? 1e9 : P && P.cur.rs === R.seq && typeof P.cur.rp === 'number' ? P.cur.rp : -1e9;
    return { u, me, name: me ? `${NET.myName || '你'}（你）` : P?.n || '朋友', t, p };
  });
  rows.sort((a, b) => { const ka = a.t > 0 ? a.t : a.t === -1 ? 1e7 : 1e6 - a.p / 1e4, kb = b.t > 0 ? b.t : b.t === -1 ? 1e7 : 1e6 - b.p / 1e4; return ka - kb; });
  const sig = JSON.stringify(rows.map((r) => [r.u, r.t])) + NET.host + NET.me;
  if (sig === R.resSig && !H.res.hidden) return;
  R.resSig = sig;
  H.res.replaceChildren();
  const h = document.createElement('h3'); const mine = rows.findIndex((r) => r.me);
  h.textContent = R.myT === -1 ? `${NET_KIND[R.kind]}：沒跑完` : `${NET_KIND[R.kind]}：第 ${mine + 1} 名${rows.some((r) => !(r.t > 0) && r.t !== -1) ? '（還有人在跑）' : ''}`;
  const ol = document.createElement('ol');
  rows.forEach((r, i) => {
    const li = document.createElement('li'), a = document.createElement('i'), n = document.createElement('span'), t = document.createElement(r.t > 0 ? 'b' : 'em');
    a.textContent = r.t > 0 ? String(i + 1) : '–'; n.textContent = r.name; t.textContent = r.t > 0 ? netFmt(R.kind, r.t) : r.t === -1 ? '沒跑完' : '跑中⋯';
    if (r.me) li.className = 'me';
    li.append(a, n, t); ol.append(li);
  });
  const row = document.createElement('div'); row.className = 'row';
  const again = document.createElement('button'), back = document.createElement('button');
  again.type = back.type = 'button'; again.className = 'a'; back.className = 'b';
  const host = NET.host === NET.me;
  again.textContent = host ? '再來一場' : '等房主再來一場'; again.disabled = !host;
  back.textContent = '回房間';
  again.addEventListener('click', () => { if (NET.host === NET.me) netEv('again'); });
  back.addEventListener('click', () => { netRaceEnd(); netEv('room'); });
  row.append(again, back);
  H.res.append(h, ol, row);
  H.res.hidden = false;
}
// 這一場收掉（回房間、下一場、離開房間）：車子留在原地接著開
function netRaceEnd() {
  const R = NET.race; if (!R) return;
  NET.race = null; NET.doneSeq = Math.max(NET.doneSeq, R.seq);
  if (R.myT == null && R.phase !== 'prep') netEv('fin', { seq: R.seq, t: -1 });
  if (R.ci && ciRace === R.ci) ciEnd();
  if (R.kind === 'hill' && R.held && drv) drv.setInput(null);
  if (R.kind === 'drag' && RACE.on && race?.net === R) backToVillage();
  if (R.kind !== 'circuit' || !R.ci) polRace(false);
  const H = NET.hud; if (H) { H.rc.hidden = true; H.res.hidden = true; H.quit.hidden = true; H.sig = ''; }
}

// ---- 400 公尺（race.src.js 叫）：對手＝朋友（照他送來跑多遠；第一個開在隔壁車道，其他的是半透明的）----
function netDragInit(Rc) {
  const R = NET.race; if (!R || R.kind !== 'drag' || !R.dragPending) return false;
  R.dragPending = false;
  Rc.net = R; Rc.phase = 'intro'; Rc.t = 0; Rc.green = null; Rc.greenAt = null; Rc.foul = false; Rc.doneT = null; Rc.opp = null; Rc.oppS = null;
  Rc.nOpp = R.order.filter((u) => u !== NET.me).map((u, i) => ({ uid: u, obj: null, x: 0, i }));
  document.body.classList.add('netdrag');
  $('raceGo').disabled = true; $('raceGo').textContent = '一起比賽中';
  raceLive(true); goBtn.textContent = '起步'; goBtn.disabled = false; nitroBtn.disabled = false; resultEl.hidden = true;
  if (!snd.me?.alive) snd.me = engineAudio.voice(cur, { parts: partsOf(cur) });
  for (const o of Rc.nOpp) {
    const P = NET.P.get(o.uid), k = P?.car || 'gc8', keys = Object.keys(LOD_CARS), kk = LOD_CARS[k] ? k : LOD_CARS.gc8 ? 'gc8' : keys[0];
    if (!kk) continue;
    LOD_CARS[kk].load().then((sc) => {
      if (race !== Rc) return;
      if (o.i === 0) {
        const lod = buildLodCar(kk, sc, netLook(kk, kk === k ? P?.l : null)); lod.car.position.set(0, 0, 0); lod.car.rotation.set(0, 0, 0); lod.car.updateMatrixWorld(true);
        const B = new THREE.Box3().setFromObject(lod.car), tag = netSprite(netTagTex(P?.n || '朋友', P?.col || NET_COL[0]), 0.22, 0.041, 0);
        tag.position.set((B.max.x + B.min.x) / 2, B.max.y + 0.35, 0); lod.car.add(tag);
        o.obj = { car: lod.car, nose: B.max.x, roll: (d) => lod.setRoll(d), dispose: () => { tag.material.map.dispose(); tag.material.dispose(); lod.dispose(); } };
      } else o.obj = ghostCar(sc, kk, { label: P?.n || '朋友' });
      TR.scene.add(o.obj.car);
    }, (e) => console.warn('朋友的車沒載好', e));
  }
  return true;
}
function netDragTick(Rc, dt) { // raceFrame 一開始：出發時間換成比賽的時鐘
  const R = Rc.net;
  netRaceTick(dt);
  if (R.go) R.goT = Rc.t + (R.go - netNow()) / 1000; // 每一格重算：手機卡卡的（一格超過 0.1 秒）比賽的時鐘會慢，綠燈還是照伺服器的時間亮
  if (Rc.phase === 'intro' && R.goT != null && Rc.t > 1.6) { Rc.phase = 'stage'; Rc.stageT = Rc.t; toast('準備', 800); }
  if (Rc.phase === 'stage' && R.goT != null) Rc.greenAt = Math.max(Rc.stageT + 0.2, R.goT);
}
function netDragFrame(Rc) { // raceFrame（車子位置那一段之後）：朋友的車、跑完了沒
  const R = Rc.net, me = Rc.me, T = netNow() - NET_DELAY;
  for (const o of Rc.nOpp) {
    const P = NET.P.get(o.uid);
    if (P && P.cur.rs === R.seq && P.cur.o === 3) { const b = P.buf; let x = P.cur.rp || 0; for (let i = b.length - 1; i > 0; i--) if (b[i].t <= T && typeof b[i].rp === 'number' && typeof b[i + 1]?.rp === 'number') { x = b[i].rp + (b[i + 1].rp - b[i].rp) * Math.min(1, (T - b[i].t) / Math.max(1, b[i + 1].t - b[i].t)); break; } o.x = x; }
    if (o.obj) { o.obj.car.visible = true; o.obj.car.position.set(o.x - o.obj.nose, 0, -LANE); o.obj.car.rotation.set(0, 0, 0); o.obj.roll(o.x); }
  }
  if (Rc.nOpp[0]) pOpp.style.left = `${Math.min(100, (Rc.nOpp[0].x / RACE_M) * 100)}%`;
  if (Rc.phase === 'run' && me.fin != null && R.myT == null) { Rc.phase = 'done'; Rc.doneT = Rc.t; raceLive(false, 1300); goBtn.disabled = true; nitroBtn.disabled = true; toast('到了！', 1400); const et = me.fin - (me.react || 0); ghDragEnd(Rc, et); netFin(R, Math.round(me.fin * 1000) / 1000); }
}
function netDragFoul(Rc) { Rc.phase = 'done'; Rc.doneT = Rc.t; goBtn.disabled = true; nitroBtn.disabled = true; lights(0, false, true); toast('偷跑！這場算沒跑完', 1800); netQuit('back'); }
function netDragDrop(Rc) { // exitRace：朋友的車收掉
  for (const o of Rc.nOpp || []) if (o.obj) { o.obj.car.removeFromParent(); o.obj.dispose(); o.obj = null; }
  document.body.classList.remove('netdrag');
  const R = Rc.net; if (R && NET.race === R && R.myT == null) netQuit('back');
}

// ---- 自己的（送給朋友）----
const NET_ME = { o: 0, x: 0, z: 0, h: 0, v: 0, k: '', rp: null, rs: 0 };
function netState() {
  const s = NET_ME, R = NET.race;
  s.k = cur; s.rp = null; s.rs = 0; s.o = 0; s.x = s.z = s.h = s.v = 0;
  if (RACE.on && race) { s.o = 3; s.x = race.me.x; s.v = race.me.v; if (race.net) { s.rp = Math.round(race.me.x * 10) / 10; s.rs = race.net.seq; } return s; }
  if (!netWorld()) return s;
  if (walker && walker.mode !== 'off' && walker.mode !== 'seat') { const t = walker.telemetry(); s.o = 2; s.x = t.x; s.z = t.z; s.h = t.heading; s.v = t.speed; }
  else if (drv) { const t = drv.telemetry(); s.o = 1; s.x = t.x; s.z = t.z; s.h = t.heading; s.v = t.v; }
  if (R && R.ci && ciRace === R.ci) { s.rp = Math.round(R.ci.me.p * 10) / 10; s.rs = R.seq; }
  return s;
}

// ---- 參觀車庫（車庫頁；只能看）：朋友的車一台一台放在中間（完整的車），你的車先藏起來 ----
let NV = null;
function netVisit(d) {
  if (trip || RACE.on || enterDrive.busy || !d || !Array.isArray(d.cars)) return null;
  const cars = d.cars.filter((c) => c && CARS[c.k]).slice(0, 20);
  if (!cars.length) return null;
  if (NV) NV.close(true);
  netHud(); // 樣式
  const st = document.createElement('style');
  st.textContent = `.nv{position:absolute;inset:0;z-index:20;pointer-events:none;font-family:"Noto Sans TC",sans-serif;color:#F2F3F5}
.nv button{pointer-events:auto;cursor:pointer;border:0;font-family:inherit;touch-action:manipulation}
.nv-top{position:absolute;top:calc(var(--fs-t,0px) + 10px);left:10px;right:10px;display:flex;align-items:center;justify-content:space-between;gap:8px}
.nv-top h3{margin:0;padding:7px 13px;border-radius:12px;background:rgba(14,15,18,0.72);font-size:16px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nv-x{width:36px;height:36px;flex:none;border-radius:50%;background:rgba(14,15,18,0.72);color:#F2F3F5;font-size:15px}
.nv-card{position:absolute;left:50%;bottom:calc(var(--fs-b,0px) + 10px);transform:translateX(-50%);width:min(340px,calc(100% - 20px));box-sizing:border-box;padding:11px;border-radius:16px;background:rgba(20,21,24,0.92);display:flex;flex-direction:column;gap:8px;pointer-events:auto}
.nv-info{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:11px;background:#24262b;font-size:13px}
.nv-info span{min-width:0}
.nv-heart{flex:none;font-size:18px;font-weight:800;color:#ff4d6d;white-space:nowrap}
.nv-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.nv-two button{min-height:40px;border-radius:11px;background:#24262b;color:#F2F3F5;border:1px solid #34363c;font-size:14px;font-weight:700}
.nv-two button:disabled{opacity:.45}
.nv-like{min-height:44px;border-radius:11px;background:#FF6A1F;color:#1a0d05;font-size:15px;font-weight:800}
.nv-like.on{background:#ff4d6d;color:#fff}
.nv-card p{margin:0;font-size:11.5px;color:#a3a5ab;text-align:center}
body.visiting :is(.wrap,.tune)>:not(#stage),body.visiting #revBtn,body.visiting #views,body.visiting #hint{display:none !important}
body.visiting .stage{aspect-ratio:auto;height:min(78vh,640px);max-height:none}`; // 車庫頁（試做頁 .wrap、網站 main.tune）：只留畫面，畫面變高（車子在卡片上面看得到）
  document.head.appendChild(st);
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const el = mk('div', 'nv'), top = mk('div', 'nv-top'), h = mk('h3', null, `${String(d.name || '朋友').slice(0, 12)}的車庫`), x = mk('button', 'nv-x', '✕');
  const card = mk('div', 'nv-card'), info = mk('div', 'nv-info'), line = mk('span'), heart = mk('b', 'nv-heart');
  const two = mk('div', 'nv-two'), prev = mk('button', null, '◀ 上一台'), next = mk('button', null, '下一台 ▶'), like = mk('button', 'nv-like'), note = mk('p', null, '只能看，不能改別人的車、也不能拿走。');
  x.type = prev.type = next.type = like.type = 'button'; x.setAttribute('aria-label', '關掉');
  info.append(line, heart); two.append(prev, next); card.append(info, two, like, note); top.append(h, x); el.append(top, card);
  stage.appendChild(el);
  document.body.classList.add('visiting');
  stopRev(); getOut(); stopSpin();
  const V = { i: Math.max(0, cars.findIndex((c) => c.k === d.cur)), car: null, job: 0, likes: Math.max(0, d.likes | 0), liked: !!d.liked, busy: false };
  function paint() {
    const c = cars[V.i], L = netLook(c.k, c.l), bits = [CARS[c.k].btn[0]];
    if (L.wide === 'on') bits.push('寬體');
    if (L.wing && L.wing !== 'none' && L.wing !== 'stock') bits.push(WING_NAMES[L.wing] || '尾翼');
    const rim = RIMS.find((r) => r[0] === L.rim); if (rim && L.rim !== 'chrome') bits.push(`${rim[1]}色輪框`);
    if (L.glow && L.glow !== 'none') bits.push('底盤燈');
    line.textContent = `${bits.join(' · ')}（${V.i + 1}/${cars.length}）`;
    heart.textContent = `♥ ${V.likes}`;
    like.textContent = V.liked ? '♥ 已經讚了' : '♥ 讚'; like.classList.toggle('on', V.liked); like.disabled = V.busy || !d.onLike;
    prev.disabled = next.disabled = cars.length < 2;
  }
  async function show(i) {
    V.i = (i + cars.length) % cars.length; paint();
    const job = ++V.job, c = cars[V.i], look = netLook(c.k, c.l);
    status.hidden = false; msg.textContent = `${CARS[c.k].btn[0]} 開進來中⋯`; prog.parentElement.hidden = false; prog.style.width = glbs[c.k] ? '100%' : '0%';
    let car;
    try { car = await loadCar(c.k, look); } catch (e) { console.error(e); if (job === V.job) { msg.textContent = '車子沒載入成功，換一台試試看'; prog.parentElement.hidden = true; } return; }
    if (job !== V.job || NV !== V) { disposeCar(car); return; }
    if (V.car) disposeCar(V.car);
    V.car = car; scene.add(car.car); car.body.position.y = +look.height || 0;
    for (const b of Object.values(built)) b.car.visible = false;
    for (const L of Object.values(LODS)) if (L?.lod) L.lod.car.visible = false; // 你停在升降機上的車也先藏起來
    status.hidden = true;
  }
  V.close = (quiet) => {
    if (NV !== V) return;
    NV = null; V.job++;
    if (V.car) { disposeCar(V.car); V.car = null; }
    if (S) S.car.visible = true;
    for (const L of Object.values(LODS)) if (L?.lod) L.lod.car.visible = true;
    status.hidden = true;
    el.remove(); st.remove(); document.body.classList.remove('visiting');
    if (!quiet && d.onClose) d.onClose();
  };
  x.addEventListener('click', () => V.close());
  prev.addEventListener('click', () => show(V.i - 1));
  next.addEventListener('click', () => show(V.i + 1));
  like.addEventListener('click', async () => {
    if (V.busy || !d.onLike) return;
    V.busy = true; paint();
    try { const r = await d.onLike(!V.liked); if (r && typeof r.likes === 'number') { V.likes = r.likes; V.liked = !!r.liked; } } catch { /* 沒有網路：照舊 */ }
    V.busy = false; paint();
  });
  V.key = () => cars[V.i].k;
  NV = V;
  show(V.i);
  return { setLikes(n, liked) { V.likes = Math.max(0, n | 0); V.liked = !!liked; paint(); }, close: () => V.close(true), get open() { return NV === V; }, get car() { return cars[V.i].k; } };
}

// ---- 網站叫的 ----
Object.assign(window.beauGame, {
  net: {
    join(o) {
      if (!o || !o.code || !o.me) return;
      NET.on = true; NET.doneSeq = 0; NET.code = String(o.code); NET.me = String(o.me); NET.host = String(o.host || ''); NET.myName = String(o.name || '').slice(0, 12);
      netHud();
    },
    leave() {
      netRaceEnd();
      NET.on = false; NET.code = ''; NET.mem = [];
      for (const P of [...NET.P.values()]) netDropPeer(P);
      drv?.removeColliders('net'); walker?.removeColliders('net');
      if (NET.hud) { NET.hud.root.hidden = true; NET.hud.rc.hidden = true; NET.hud.res.hidden = true; NET.hud.quit.hidden = true; }
    },
    host(uid) { NET.host = String(uid || ''); },
    members(list) {
      if (!NET.on || !Array.isArray(list)) return;
      const keep = new Set();
      NET.mem = list.filter((m) => m && m.uid && m.uid !== NET.me).slice(0, 3);
      NET.mem.forEach((m, i) => {
        const P = netPeer(m.uid), n = String(m.n || '朋友').slice(0, 12), col = NET_COL[i % NET_COL.length];
        keep.add(m.uid);
        const lookChanged = JSON.stringify(m.l || null) !== JSON.stringify(P.l) || m.car !== P.car;
        P.car = String(m.car || ''); P.l = m.l && typeof m.l === 'object' ? m.l : null; P.ch = m.ch && typeof m.ch === 'object' ? m.ch : null;
        if (lookChanged && P.objK) netDropObj(P);
        if (n !== P.n || col !== P.col) { P.n = n; P.col = col; P.mk.fill = col; P.mk.label = [...n][0] || ''; P.mk.name = n; netTag(P); }
      });
      for (const P of [...NET.P.values()]) if (!keep.has(P.uid)) netDropPeer(P);
    },
    snap(uid, s) {
      const P = NET.P.get(uid); if (!P || !s || typeof s.t !== 'number') return;
      const b = P.buf; if (b.length && s.t <= b[b.length - 1].t) return;
      const e = { t: s.t, x: +s.x || 0, z: +s.z || 0, h: +s.h || 0, v: +s.v || 0, rp: typeof s.rp === 'number' ? s.rp : null };
      b.push(e); if (b.length > 16) b.shift();
      const c = P.cur; c.t = s.t; c.x = e.x; c.z = e.z; c.h = e.h; c.v = e.v; c.o = s.o | 0; c.k = typeof s.k === 'string' ? s.k : ''; c.rp = e.rp; c.rs = s.rs | 0;
      P.last = netNow();
      if (c.o !== 1 && c.o !== 2) b.length = 0; // 不在外面：下次出來不要從舊的位置滑過去
    },
    emote: netEmote,
    clock(off) { NET.off = +off || 0; },
    state: netState,
    look: () => ({ car: cur, l: { ...CARS[cur].state }, ch: GAME.look || null }),
    garage: () => ({ cur, cars: Object.fromEntries([...GAME.owned].filter((k) => CARS[k]).map((k) => [k, { ...CARS[k].state }])) }),
    race: netRace,
    results: netResults,
    where: () => (RACE.on && !trip ? 'race' : trip ? 'out' : 'garage'),
    get info() { return { on: NET.on, code: NET.code, peers: [...NET.P.values()].map((P) => ({ uid: P.uid, n: P.n, vis: P.vis, o: P.cur.o, car: !!P.obj, walk: !!P.chr })), race: NET.race && { seq: NET.race.seq, kind: NET.race.kind, phase: NET.race.phase, go: NET.race.go, runAt: NET.race.runAt || 0, myT: NET.race.myT, res: { ...NET.race.res } }, marks: NET.marks.filter((m) => m.on).length, cols: NET.cols.length }; },
  },
  visit: netVisit,
  get visiting() { return NV ? { car: NV.key(), loaded: !!NV.car } : null; },
});
