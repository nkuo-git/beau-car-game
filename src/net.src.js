// ==== 連線：大家的世界（一起開車、找人比賽、參觀車庫）（net.src.js；build-art.mjs／build-app.mjs 接在 ghost.src.js 後面）====
// 內容 8：房間（Nick 2026-10-10，草稿 https://claude.ai/artifact/6BtzWH7D5uWYMCra2e7DJo）；2026-10-11 改成只有一個世界（Nick「不用房間 選擇連線的人就加入一個永久的世界」，
//   草稿 https://claude.ai/artifact/QDwK28dEsEkumkvR2AiP9Y，Nick 說爸媽同意了）：進入世界的人都看得到彼此（最多 16 個人），點名字找他比賽（兩個人），可以封鎖
// 網站（site/world.js）管世界、邀請、封鎖、即時資料庫；這裡只管遊戲裡面：別人的車和人（頭上有名字）、表情、小地圖／大地圖上的點、比賽、邀請的卡片、去找他、參觀車庫
// window.beauGame.net（網站叫的）：
//   join({ code, me, host, slot（世界的號碼 0–5＝車庫街你那間）})／slot(n)／leave()；members([{ uid, n, car, l（外觀）, ch（角色的樣子）}])（不含自己、不含封鎖的；順序＝進世界的順序，決定顏色；最多 15 個）
//   snap(uid, { t, x, z, h, v, o, k, rp, rs, w, jl, pc })：朋友的位置（t＝伺服器時間毫秒；o：0 不在外面、1 開車、2 走路、3 在 400 公尺；rp＝這一場跑多遠、rs＝第幾場；
//     w＝通緝幾顆星、jl＝1 被警察抓了、pc＝追他的警車 [x, z, h, …]（最多 3 台）：名字旁邊畫星星、後面畫警車（閃紅藍燈）、被抓跳「🚓 X被警察抓走了！」）
//     第 22 批：pi＝那幾台警車是他那邊的第幾台（撞到的時候用）；ph＝[朋友, 第幾台, dvx, dvz, 第幾下]：我撞到朋友的警車（他那邊 police.bump）；
//       pv＝[車, x, z, h]：他停著的車（不管他在走路、在房子裡、在警察局、被關）；o＝4：在警察局裡面（x、z 是裡面的座標；我也在裡面才畫）
//     第 24 批：y＝他開在圓塔外面的斜坡上有多高（沒有＝在地上；車子照這個高度畫、高度差太多不會撞到）
//   emote(uid, e)：朋友送的表情（NET_E 的第幾個）；clock(off)：伺服器時間＝Date.now()＋off
//   state() → 自己現在的（送給朋友）；look() → { car, l, ch }（自己開的車、外觀、角色）；garage() → { cur, cars: { key: 外觀 }, tw, tr }（參觀車庫、第 23 批開進來看）
//   race({ seq, kind, go, order })：比賽（kind：circuit 賽車場 3 圈｜drag 400 公尺｜hill 爬山；go＝出發的伺服器時間，0＝還在等兩個人準備好；order＝比的人：起跑格）；host(uid)＝發起的人（可以按「再比一次」）
//   results(seq, { uid: 秒 | −1（沒跑完）})；where() → 'garage' | 'out' | 'race'（參觀車庫只能在車庫頁）
//   第 23 批（開進朋友的車庫）：bellAns({ uid, n, ok, g })＝門鈴的回答（1 好＋g＝他的車庫 garages/{uid}、−1 不要、−2 在忙、−3 關掉邀請、−4 送不出去、−5 不在線上、0 沒回答）；
//     visitEnd(why)＝在他家的時候 'kick' 他請你出去／'gone' 他走了；guest({ uid, n } | null, why)＝朋友在我的車庫裡（上面那一條「請他出去」）；invite 的 kind 'bell'＝有人按我家的門鈴
//   invite({ id, name, kind, car })：別人找你比賽（遊戲裡跳出卡片：好／不要，15 秒）；uninvite(id)；goTo(uid)＝去找他（目的地＝他現在在哪裡，跟著箭頭）；place() → 現在在哪裡（給名單看：在車庫、在山頂⋯）
//   遊戲發 window 事件 'beau-net'（detail.type）：emote { e }｜ready { seq }｜fin { seq, t }（t＝−1 沒跑完）｜again（發起的人按「再比一次」）｜back（「回去開車」）｜list（點右邊那一塊：線上的人）｜answer { id, ok }（邀請：好／不要）
//     ｜bell { uid, name }（按他家的門鈴）｜bellEnd { uid }（離開他家了）｜kick { uid }（請他出去）
// window.beauGame.visit({ name, cars: [{ k, l }], likes, liked, onLike, onClose }) → { setLikes(n, liked), close() } | null（不在車庫頁）
// 安全（草稿說好的）：只有名字（網站擋過髒話）；表情只有固定的幾個；朋友的車在比賽中穿過去，平常會擋（撞到照兩台車的速度算）；朋友走路的人不會被撞到（穿過去）；警察只追自己
//   第 22 批：追朋友的警車也會擋，撞到了朋友那邊的那台會被撞開、暈一下（不算犯罪、不會給你星星）
// 效能：朋友一台車＝輕量車 4 個 draw call＋影子＋名字；走路的人 2 個＋名字；每一格不 new（位置照 0.2 秒前的兩筆內插）
const NET_E = ['👍', '😂', '好車！', '跟我來', '比一場？'];
const NET_COL = ['#4a8cff', '#46c46f', '#f2c230', '#ff5fa2', '#a77bff', '#2fd3c7', '#ff8f5a', '#9bd14a', '#5ac8fa', '#e05ad7', '#ffd166', '#7f8cff', '#4cd98f', '#ff6b8b', '#c9a227']; // 別人的顏色（進世界的順序）；你自己是橘色
const NET_MAX = 5, NET_FAR = 320; // 最多看幾個人；多遠以外只畫地圖上的點（車、人不畫）
const NET_DELAY = 220; // 畫朋友的位置：0.22 秒前的（網路不穩也平順）
const NET_HOLD = { throttle: 0, brake: 1, steer: 0, handbrake: 1 };
const NET = { on: false, code: '', me: '', host: '', slot: -1, off: 0, mem: [], P: new Map(), race: null, doneSeq: 0, outSeq: 0, hud: null, marks: [], cols: [], wkT: 0, setD: null, setW: null, tex: {}, shGeo: null, shMat: null, inv: null, invT: 0, goal: null, goalHome: -1, cellShut: false, bumped: 0 };
const netNow = () => Date.now() + NET.off;
const netEv = (type, d = {}) => { try { window.dispatchEvent(new CustomEvent('beau-net', { detail: { type, ...d } })); } catch { /* 沒有人聽就算了 */ } };
const netWorld = () => DRIVE.on && !indoor && !!VIL; // 在外面（開車、走路；不含房子裡面、400 公尺）

// ---- 名字、表情的貼圖（sprite：遠近都一樣大）----
function netTagTex(text, col, stars = 0) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
  const g = cv.getContext('2d');
  g.font = '700 50px "Noto Sans TC", "PingFang TC", sans-serif';
  const st = stars > 0 ? '★'.repeat(Math.min(3, stars)) : '', sw = st ? g.measureText(st).width + 12 : 0; // 被警察追：名字後面黃色星星
  const w = Math.min(500, g.measureText(text).width + 84 + sw), x0 = (512 - w) / 2;
  g.fillStyle = 'rgba(12,13,16,0.78)'; g.beginPath(); g.roundRect(x0, 8, w, 80, 20); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(x0 + 34, 48, 13, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f3f3f1'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x0 + 56 + (w - 70 - sw) / 2, 50, w - 70 - sw);
  if (st) { g.fillStyle = '#ffc531'; g.textAlign = 'right'; g.fillText(st, x0 + w - 18, 50); }
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
    P = { uid, n: '', car: '', l: null, ch: null, col: NET_COL[0], buf: [], cur: { t: 0, x: 0, z: 0, h: 0, v: 0, o: 0, k: '', rp: null, rs: 0, w: 0, jl: 0, pk: null, pv: null }, last: 0, pkOn: false, tagW: 0, jlSeen: 0,
      obj: null, objK: '', job: 0, chr: null, chrK: '', tag: null, bub: null, bubT: 0, roll: 0, px: null, pz: null, mk: { x: 0, z: 0, fill: NET_COL[0], ring: '#ffffff', r: 6, label: '', name: '', on: false },
      box: { t: 'box', x: 0, z: 0, hx: 2.2, hz: 0.9, rot: 0, h: 1.4, vx: 0, vz: 0, m: 1, dvx: 0, dvz: 0, noCrush: true }, vis: false }; // noCrush：越野車輾不過去（照車撞車算）
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
    const lk = kk === k ? netLook(kk, P.l) : { ...DEFAULT_LOOK[kk], paint: netLook(k, P.l).paint || DEFAULT_LOOK[kk].paint }, lod = buildLodCar(kk, sc, lk);
    P.objPaint = lk.paint; // 測試用：做出來的車是什麼顏色
    lod.car.position.set(0, 0, 0); lod.car.rotation.set(0, 0, 0); lod.car.updateMatrixWorld(true);
    const B = new THREE.Box3().setFromObject(lod.car);
    lod.car.rotation.order = 'YXZ'; lod.car.name = 'net-' + P.uid; lod.car.visible = false;
    if (!NET.shMat) { NET.shGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); NET.shMat = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: 0.8 }); }
    const sh = new THREE.Mesh(NET.shGeo, NET.shMat); sh.renderOrder = 1; sh.visible = false; sh.matrixAutoUpdate = false;
    lod.pop?.set(!!P.cur.pl, 0); // 跳燈：一出現就是他現在的樣子
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
  if (P.tag) { P.tag.material.map.dispose(); P.tag.material.map = netTagTex(P.n, P.col, P.tagW); P.tag.material.needsUpdate = true; return; }
  P.tag = netSprite(netTagTex(P.n, P.col, P.tagW), 0.22, 0.041, 0); P.tag.visible = false; // 放進場景：netStep（在車庫頁還沒有 TR）
}
// 0.22 秒前的位置（前後兩筆內插；最後一筆之後照速度往前推最多 0.5 秒）
const NET_S = { x: 0, z: 0, y: null, h: 0, v: 0, i: 0, f: 0 }; // i、f：用哪兩筆（b[i]→b[i+1] 的 f；f＝0 只用 b[i]）：警車也照這個內插
function netSample(P, T) {
  const b = P.buf, n = b.length; if (!n) return null;
  let a = b[0];
  NET_S.i = 0; NET_S.f = 0;
  NET_S.y = a.y; // 第 24 批：開在斜坡上（有送高度）
  if (T <= a.t || n === 1) { NET_S.x = a.x; NET_S.z = a.z; NET_S.h = a.h; NET_S.v = a.v; return NET_S; }
  let i = n - 1; while (i > 0 && b[i].t > T) i--;
  a = b[i]; NET_S.i = i;
  NET_S.y = a.y;
  if (i === n - 1) { const d = Math.min(0.5, (T - a.t) / 1000); NET_S.x = a.x + Math.cos(a.h) * a.v * d; NET_S.z = a.z - Math.sin(a.h) * a.v * d; NET_S.h = a.h; NET_S.v = a.v; return NET_S; }
  const c = b[i + 1], f = (T - a.t) / Math.max(1, c.t - a.t);
  NET_S.f = f; NET_S.x = a.x + (c.x - a.x) * f; NET_S.z = a.z + (c.z - a.z) * f; NET_S.h = a.h + wrapPi(c.h - a.h) * f; NET_S.v = a.v + (c.v - a.v) * f;
  if (a.y != null && c.y != null) NET_S.y = a.y + (c.y - a.y) * f;
  return NET_S;
}
const netH = (x, z) => (VIL && VIL.heightAt ? VIL.heightAt(x, z) : 0);
// 每一格（driveStep 最後）：朋友的車、人、名字、表情、小地圖的點、碰撞
function netStep(dt) {
  if (!NET.on) return;
  netHudTick(dt);
  netRaceTick(dt);
  netPhTick();
  const show = netWorld(), T = netNow() - NET_DELAY, now = netNow(), race = !!(NET.race && NET.race.kind !== 'out') || !!ciRace || !!orRace;
  const inPol = !!(DRIVE.on && indoor && indoor.kind === 'police' && walker && PSC); // 第 22 批：我在警察局裡面：看得到也在裡面的朋友（關在拘留室的也是）
  const me = show ? (walker && walker.mode !== 'off' ? walker.telemetry() : drv ? drv.telemetry() : null) : null, mx = me ? me.x : 0, mz = me ? me.z : 0;
  const cols = !race && !!(drv || walker);
  const myY = drv && TRAMP.on && me ? PW.heightAt(mx, mz) : null; // 第 24 批：我開在斜坡上：只撞得到跟我差不多高的
  let jin = false; // 有朋友關在拘留室（我看得到的）
  NET.cols.length = 0; NET_POL.n = 0;
  for (const P of NET.P.values()) {
    const c = P.cur, fresh = now - P.last < 6000, s = fresh && ((show && (c.o === 1 || c.o === 2)) || (inPol && c.o === 4)) ? netSample(P, T) : null;
    if (c.jl !== P.jlSeen) { P.jlSeen = c.jl; if (c.jl && P.n) netToast(`🚓 ${P.n}被警察抓走了！`); } // 朋友被警察抓走
    const tw = fresh && (c.o === 1 || c.o === 2) ? c.w : 0; if (tw !== P.tagW) { P.tagW = tw; if (P.n) netTag(P); } // 名字旁邊的星星
    const near = !!s && (c.o === 4 || !me || (s.x - mx) * (s.x - mx) + (s.z - mz) * (s.z - mz) < NET_FAR * NET_FAR); // 遠的：只有地圖上的點
    const car = near && c.o === 1, walkin = near && (c.o === 2 || c.o === 4), inside = c.o === 4;
    // 第 19 批：他下車停著的車（走路的時候）：畫在停的地方、會擋；借給你了（你在開、在載入）就不畫這台
    // 第 22 批（Nick「他的車不管在哪裡你都要看得到」）：他在房子裡、在警察局、被關（車拖到警察局的停車場）也畫（pv）
    const pq = c.pk || c.pv;
    const pk = show && fresh && !race && c.o !== 1 && c.o !== 3 && pq && !(BOR.on && BOR.on.uid === P.uid) && !(BOR.loading && BOR.loading.uid === P.uid) ? pq : null;
    const pkOn = !!pk && (!me || (pk[1] - mx) * (pk[1] - mx) + (pk[2] - mz) * (pk[2] - mz) < NET_FAR * NET_FAR);
    if (car) netCar(P, c.k); else if (pkOn) netCar(P, pk[0]);
    if (walkin) netChr(P);
    const O = car || pkOn ? P.obj : null, C = walkin ? P.chr : null;
    P.pkOn = pkOn && !!O;
    if (P.obj) { P.obj.car.visible = !!O; P.obj.sh.visible = !!O; }
    if (P.chr) P.chr.group.visible = !!C;
    P.mk.on = !!s && !inside; P.vis = !!(O || C);
    if (s && !inside) { P.mk.x = s.x; P.mk.z = s.z; if (NET.goal === P.uid && NET.goalHome < 0 && VIL.places.friend) { VIL.places.friend.pos[0] = s.x; VIL.places.friend.pos[1] = s.z; } }
    if (O) {
      const ox = car ? s.x : pk[1], oz = car ? s.z : pk[2], oh = car ? s.h : pk[3], ov = car ? s.v : 0; // 開的車：內插的位置；停著的：停的位置
      const fx = Math.cos(oh) * 1.3, fz = -Math.sin(oh) * 1.3, ry = car && s.y != null ? s.y : null, y = ry != null ? ry : netH(ox, oz); // 第 24 批：開在斜坡上＝他送來的高度
      if (ry != null && P.ryx != null) { const d = Math.hypot(ox - P.ryx, oz - P.ryz); if (d > 0.02) { P.rpt = Math.atan2((y - P.ryy) * (s.v < 0 ? -1 : 1), d); P.ryx = ox; P.ryz = oz; P.ryy = y; } } else if (ry != null) { P.ryx = ox; P.ryz = oz; P.ryy = y; P.rpt = 0; } else P.ryx = null;
      if (ry != null) P.rp = (P.rp || 0) + ((P.rpt || 0) - (P.rp || 0)) * Math.min(1, dt * 6); // 上坡、下坡：車頭抬起來
      O.car.position.set(ox, y, oz); O.car.rotation.set(0, oh, ry != null ? P.rp : Math.atan2(netH(ox + fx, oz + fz) - netH(ox - fx, oz - fz), 2.6));
      if (car && P.px != null) { P.roll += Math.hypot(s.x - P.px, s.z - P.pz) * (s.v < 0 ? -1 : 1); O.lod.setRoll(P.roll); }
      O.sh.matrix.makeRotationY(oh).scale(V_NET.set(O.nose - O.tail + 0.6, 1, O.hw * 2 + 0.4)).setPosition(ox + Math.cos(oh) * O.cx, y + 0.05, oz - Math.sin(oh) * O.cx); O.sh.matrixWorldNeedsUpdate = true;
      if (P.tag && car) P.tag.position.set(ox, y + O.top + 0.35, oz);
      const pp = O.lod.pop; if (pp) { if (pp.on !== !!c.pl) pp.set(!!c.pl, calm ? 0.12 : 0.3); pp.step(dt); } // 跳燈：朋友開燈＝燈蓋立起來（開著的、停著的車都一樣）
      if (cols && (myY == null && ry == null || Math.abs(y - (myY != null ? myY : netH(mx, mz))) < 2.2)) { // 平常會擋（撞到照兩台車的速度算；朋友那邊自己算自己的）；比賽中穿過去；第 24 批：在斜坡上差太高的不擋
        const k = P.box; k.x = ox + Math.cos(oh) * O.cx; k.z = oz - Math.sin(oh) * O.cx; k.hx = (O.nose - O.tail) / 2; k.hz = O.hw; k.rot = oh;
        k.vx = Math.cos(oh) * ov; k.vz = -Math.sin(oh) * ov; k.dvx = k.dvz = 0; NET.cols.push(k);
      }
    }
    if (C) {
      const scn = inside ? PSC : TR.scene, y = inside ? 0 : netH(s.x, s.z); // 第 22 批：警察局裡面＝它自己的場景（地板 0）
      if (C.group.parent !== scn) scn.add(C.group);
      C.group.position.set(s.x, y, s.z); C.group.rotation.y = s.h;
      C.update(dt, { speed: Math.abs(s.v) });
      if (P.tag) P.tag.position.set(s.x, y + C.height + 0.45, s.z);
      if (inside && c.jl) jin = true;
    }
    netPolOffStep(P, dt);
    if (s && near && c.w && (car || (walkin && !inside))) netPolPlace(P, s, dt, cols && !rampHigh()); // 追他的警車（他開車、走路都畫）；第 24 批：我在斜坡上面撞不到地上的
    P.px = O && car ? s.x : null; P.pz = O && car ? s.z : null;
    const tsc = C && inside ? PSC : TR.scene;
    if (P.vis) for (const sp of [P.tag, P.bub]) if (sp && sp.parent !== tsc) tsc.add(sp);
    if (P.tag) P.tag.visible = P.vis;
    if (P.bub) { P.bubT -= dt; P.bub.visible = P.vis && P.bubT > 0; if (P.bub.visible) P.bub.position.copy(P.tag.position); }
  }
  for (let i = NET_POL.n; i < NET_POL.cars.length; i++) NET_POL.cars[i].group.visible = false;
  netCell(inPol, jin);
  netGoalTick(me);
  netGstTick(me, show && !race);
  gvTick(); // 第 23 批：在朋友家（他的車一格做一台、走遠了＝出來了）
  borTick(me, show, race); // 第 19 批：借車
  if (drv) {
    if (NET.setD !== drv) { NET.setD = drv; drv.setMarkers(NET.marks, 'net'); }
    drv.removeColliders('net'); if (NET.cols.length) drv.addColliders(NET.cols, 'net');
  }
  if (walker) {
    if (NET.setW !== walker) { NET.setW = walker; walker.setMarkers(NET.marks, 'net'); }
    NET.wkT -= dt; if (NET.wkT <= 0) { NET.wkT = 0.2; walker.removeColliders('net'); if (NET.cols.length) walker.addColliders(NET.cols, 'net'); } // 走路的碰撞 5 次／秒就好
  }
}
// 第 22 批（Nick 2026-10-18「別人被拘留你要看得到他在裡面」）：朋友關在拘留室、我也在警察局裡面（我沒被關）：鐵門關著（他在裡面）；我站在拘留室裡面就不關
function netCell(inPol, jin) {
  const want = !!(inPol && jin && PI && police && police.state === 'free' && !netInCell());
  if (want === NET.cellShut) return;
  NET.cellShut = want;
  if (want) { PI.setCellDoor(false); walker.addColliders([{ ...PI.cellCollider }], 'netcell'); return; } // 鐵門的碰撞（走路的碰撞是進來的時候抄的：另外放一個）
  walker?.removeColliders('netcell');
  if (PI && police && police.state === 'free') PI.setCellDoor(true);
}
function netInCell() {
  const t = walker.telemetry(), Z = PI.zones.cell, dx = t.x - Z.x, dz = t.z - Z.z, c = Math.cos(Z.rot), s = Math.sin(Z.rot);
  return Math.abs(dx * c - dz * s) < Z.hx + 0.5 && Math.abs(dx * s + dz * c) < Z.hz + 0.5;
}
const V_NET = new THREE.Vector3();
// 追朋友的警車（police.js 的 makePoliceCar，一台 2 個 draw call；全部最多 4 台，用完重用）：照朋友送來的位置畫（跟他的車一樣內插），紅藍燈一直閃
// 第 22 批（Nick 2026-10-18「別人被警察抓你要撞得到別人的那個警察」）：會擋（長方形，照兩台車的動量算）；你撞到的推力送給朋友（ph）：他那邊那台被撞開、暈一下（police.bump）
//   你這邊先自己滑一下、轉一下（P.pof：慢慢回到朋友送來的位置），不用等網路
const NET_POL = { cars: [], n: 0, MAX: 4, hits: 0 };
const NET_PH = { to: '', i: -1, ax: 0, az: 0, n: 0, out: null, outT: 0, seq: Date.now() % 1000000, sent: 0 }; // 撞到朋友的警車：攢起來，0.15 秒送一次（world.js 一秒 8 次）
function netPolPlace(P, s, dt, cols) {
  const b = P.buf, A = b[s.i], pa = A && A.pc; if (!pa) return;
  const B = s.f > 0 ? b[s.i + 1] : null, pi = A.pi, pb = B && B.pc && B.pc.length === pa.length && String(B.pi) === String(pi) ? B.pc : null, f = s.f, gap = pb ? Math.max(0.05, (B.t - A.t) / 1000) : 1;
  for (let j = 0; j + 2 < pa.length && NET_POL.n < NET_POL.MAX; j += 3) {
    let x = pa[j], z = pa[j + 1], h = pa[j + 2];
    if (pb) { x += (pb[j] - x) * f; z += (pb[j + 1] - z) * f; h += wrapPi(pb[j + 2] - h) * f; }
    if ((x - s.x) * (x - s.x) + (z - s.z) * (z - s.z) > 250 * 250) continue;
    const id = pi ? pi[j / 3] : -1, q = id >= 0 ? netPolOff(P, id) : null;
    if (q) { x += q.x; z += q.z; h += q.a; }
    let k = NET_POL.cars[NET_POL.n];
    if (!k) { k = makePoliceCar(); k.group.name = 'net-police'; k.setLights(true); NET_POL.cars.push(k); }
    if (!k.group.parent) TR.scene.add(k.group);
    k.group.visible = true; k.group.position.set(x, netH(x, z), z); k.group.rotation.set(0, h, 0); k.update(dt); NET_POL.n++;
    if (id < 0) continue; // 舊版的朋友（沒送第幾台）：只畫
    const bx = netPolBox(P, id);
    if (bx.dvx || bx.dvz) netPolHit(P, id, h, bx.dvx, bx.dvz); // 上一格被你推的
    bx.dvx = bx.dvz = 0;
    if (!cols) continue;
    bx.x = x; bx.z = z; bx.rot = h; bx.vx = (pb ? (pb[j] - pa[j]) / gap : 0) + q.vx; bx.vz = (pb ? (pb[j + 1] - pa[j + 1]) / gap : 0) + q.vz;
    NET.cols.push(bx);
  }
}
function netPolBox(P, id) { const a = P.pbx || (P.pbx = []); return a[id] || (a[id] = { t: 'box', x: 0, z: 0, hx: 2.35, hz: 0.92, rot: 0, h: 1.6, vx: 0, vz: 0, m: 1.2, dvx: 0, dvz: 0, noCrush: true, netPol: true }); } // police-ai.js 的警車一樣大；noCrush：越野車輾不扁（是朋友那邊的車）
function netPolOff(P, id) { const a = P.pof || (P.pof = []); return a[id] || (a[id] = { x: 0, z: 0, vx: 0, vz: 0, a: 0, w: 0 }); }
function netPolOffStep(P, dt) { // 自己這邊撞開的：滑出去、慢慢回到朋友送來的位置（那時候他那邊也撞開了）
  if (!P.pof) return;
  const e = Math.exp(-dt * 4), back = Math.exp(-dt * 1.6);
  for (const q of P.pof) if (q) { q.x = (q.x + q.vx * dt) * back; q.z = (q.z + q.vz * dt) * back; q.a = (q.a + q.w * dt) * back; q.vx *= e; q.vz *= e; q.w *= e; }
}
function netPolHit(P, id, h, dvx, dvz) {
  const q = netPolOff(P, id), fx = Math.cos(h), fz = -Math.sin(h), al = dvx * fx + dvz * fz, lx = dvx - al * fx, lz = dvz - al * fz;
  q.vx += dvx; q.vz += dvz; q.w += (lx * fz - lz * fx > 0 ? 1 : -1) * Math.min(3, Math.hypot(lx, lz) * 0.4);
  const H = NET_PH; if (H.n && (H.to !== P.uid || H.i !== id)) netPhFlush();
  H.to = P.uid; H.i = id; H.ax += dvx; H.az += dvz; H.n++;
  NET_POL.hits++;
}
function netPhFlush() { const H = NET_PH; H.out = [H.to, H.i, Math.round(H.ax * 10) / 10, Math.round(H.az * 10) / 10, ++H.seq]; H.outT = performance.now(); H.ax = H.az = 0; H.n = 0; H.sent++; }
function netPhTick() { const H = NET_PH, t = performance.now(); if (H.n && t - H.outT > 150) netPhFlush(); if (H.out && t - H.outT > 4000) H.out = null; } // 留 4 秒（網頁很卡也送得到；朋友那邊照第幾下只算一次）
function netPolBumped(P, i, dvx, dvz) { // 朋友撞到追我的警車：我這邊那台被撞開、暈一下
  if (!police || !police.bump || !police.bump(i, dvx, dvz)) return;
  NET.bumped++;
  const t = performance.now(); if (P.n && t - (P.bumpT || 0) > 4000) { P.bumpT = t; netToast(`💥 ${P.n}撞開了追你的警車！`); }
}
function netToast(text) { const t = walker && walker.mode !== 'off' ? walker : drv; if (t && trip) t.toast(text, 3000); else netSay(text); }
function netHideAll() {
  for (const k of NET_POL.cars) k.group.visible = false;
  for (const P of NET.P.values()) { if (P.obj) { P.obj.car.visible = false; P.obj.sh.visible = false; } if (P.chr) P.chr.group.visible = false; if (P.tag) P.tag.visible = false; if (P.bub) P.bub.visible = false; P.mk.on = false; }
  drv?.removeColliders('net'); walker?.removeColliders('net');
  netCell(false, false);
  if (NET.hud) { NET.hud.root.hidden = true; netTray(false); } // 回車庫頁：房間那一塊收起來（netHudTick 只有在外面才跑）
}

// ---- 畫面：右邊那一塊（幾個人在線上；點了打開網站的名單）、表情、邀請的卡片 ----
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
body.netdrag .nt-quit{left:auto;right:calc(var(--fs-r,0px) + 10px);top:calc(var(--fs-t,0px) + 240px)}
body.fs.netdrag #race{display:none}
body.netdrag #race :is(.minirow,.group,.me,.how){display:none}
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
.nt-inv{position:absolute;z-index:10;left:50%;top:calc(var(--fs-t,0px) + 64px);transform:translateX(-50%);width:min(330px,calc(100% - 20px));box-sizing:border-box;padding:13px;border-radius:16px;background:rgba(20,21,24,0.95);border:2px solid #FF6A1F;color:#F2F3F5;font-family:"Noto Sans TC",sans-serif;display:flex;flex-direction:column;gap:7px;pointer-events:auto}
.nt-inv[hidden]{display:none}
.nt-inv b{font-size:16px}
.nt-inv small{font-size:13px;font-weight:700;color:#f2a14a}.nt-inv small[hidden]{display:none}
.nt-inv span{font-size:13px;color:#C6CAD1}
.nt-invbar{height:4px;border-radius:4px;background:rgba(255,255,255,.15);overflow:hidden}
.nt-invbar i{display:block;height:100%;background:#FF6A1F}
.nt-inv .row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.nt-inv .row button{min-height:44px;border:0;border-radius:11px;font:800 15px "Noto Sans TC",sans-serif;cursor:pointer;touch-action:manipulation}
.nt-inv .a{background:#FF6A1F;color:#1a0d05}.nt-inv .b{background:#24262b;color:#F2F3F5;border:1px solid #34363c}
.nt-gar{position:absolute;z-index:6;left:50%;bottom:calc(var(--fs-b,0px) + 150px);transform:translateX(-50%);max-width:calc(100% - 20px);padding:11px 18px;border:2px solid #FF6A1F;border-radius:999px;background:rgba(20,21,24,0.92);color:#F2F3F5;font:800 15px "Noto Sans TC",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;touch-action:manipulation}
.nt-gar[hidden],body:not(.driving) .nt-gar{display:none}
.nt-gar.wait{border-color:#6d717a;color:#C6CAD1}
body.bigmap .nt,body.shopping .nt,body.cimenu .nt,body.bigmap .nt-gar{display:none}`;
  document.head.appendChild(st);
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const root = mk('div', 'nt'), room = mk('button', 'nt-room'), emo = mk('button', 'nt-emo', '💬'), tray = mk('div', 'nt-tray');
  room.type = emo.type = 'button'; emo.setAttribute('aria-label', '送表情');
  for (let i = 0; i < NET_E.length; i++) { const b = mk('button', null, NET_E[i]); b.type = 'button'; b.addEventListener('click', () => netSend(i)); tray.append(b); }
  const x = mk('button', null, '✕'); x.type = 'button'; x.setAttribute('aria-label', '收起來'); x.addEventListener('click', () => netTray(false)); tray.append(x);
  tray.hidden = true; root.hidden = true;
  room.addEventListener('click', () => netEv('list'));
  emo.addEventListener('click', () => netTray(true));
  root.append(room, emo, tray);
  const rc = mk('div', 'nt-race'), big = mk('b'), sub = mk('span'), quit = mk('button', 'nt-quit', '放棄這場');
  quit.type = 'button'; quit.hidden = true; quit.addEventListener('click', () => netQuit('quit'));
  rc.append(big, mk('br'), sub); rc.hidden = true;
  const res = mk('div', 'nt-res'); res.hidden = true;
  const inv = mk('div', 'nt-inv'), invH = mk('small', null, '🔔 有人按你家的門鈴'), invT = mk('b'), invS = mk('span'), invBar = mk('div', 'nt-invbar'), invI = mk('i'), invRow = mk('div', 'row'), invOk = mk('button', 'a', '好'), invNo = mk('button', 'b', '不要');
  invOk.type = invNo.type = 'button'; invBar.append(invI); invRow.append(invOk, invNo); inv.append(invH, invT, invS, invBar, invRow); inv.hidden = true; invH.hidden = true;
  invOk.addEventListener('click', () => netAnswer(true)); invNo.addEventListener('click', () => netAnswer(false));
  const gar = mk('button', 'nt-gar'); gar.type = 'button'; gar.hidden = true; gar.addEventListener('click', netGstGo);
  stage.append(root, rc, quit, res, inv, gar);
  NET.hud = { root, room, emo, tray, rc, big, sub, quit, res, inv, invH, invT, invS, invI, gar, msg: '', msgT: 0, last: '', sig: '' };
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
  const n = 1 + NET.mem.length, txt = H.msgT > 0 ? H.msg : `👥 ${n} 人在線上`;
  if (txt !== H.last) {
    H.last = txt; H.room.classList.toggle('msg', H.msgT > 0);
    if (H.msgT > 0) H.room.textContent = txt; else { H.room.replaceChildren('👥 ', Object.assign(document.createElement('b'), { textContent: String(n) }), ' 人在線上'); }
  }
}

// ---- 車庫街（village.js 第 16、17 批）：6 間車庫的名牌（門上面的黑大理石橫帶；一張貼圖 6 格＝1 個 draw call）：每個人在自己世界號碼那間（你那間不畫：大理石車庫自己的招牌），沒有人就「空的」----
// 走到（或開到）別人那間門口 6 公尺內：「🚗 看小明的車庫」（回車庫頁參觀，網站那邊做）；自己那間：開鐵捲門開進去
const NET_GST = { mesh: null, cv: null, tex: null, sig: null, at: -1, txt: '', own: [], dots: [] }; // dots：第 21 批，朋友的家畫在大地圖上（名字寫在旁邊）
const NET_GST_W = 512, NET_GST_H = 50;
function netGstBuild() {
  const SL = VIL?.places?.garst?.slots; if (!SL || NET_GST.mesh || !TR?.scene) return !!NET_GST.mesh;
  const n = SL.length, cv = document.createElement('canvas'); cv.width = NET_GST_W; cv.height = NET_GST_H * n;
  const P = [], UV = [], I = [];
  SL.forEach((q, i) => {
    const g = q.sign, th = g.ry + Math.PI / 2, ux = Math.cos(th) * g.w / 2, uz = -Math.sin(th) * g.w / 2, v0 = 1 - (i + 1) / n, v1 = 1 - i / n, b = i * 4; // 牌子的寬往右（面向牌子看）
    for (const [a, y, u, v] of [[-1, -1, 0, v0], [1, -1, 1, v0], [1, 1, 1, v1], [-1, 1, 0, v1]]) { P.push(g.x + ux * a, g.y + y * g.h / 2, g.z + uz * a); UV.push(u, v); }
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); geo.setIndex(I); geo.computeBoundingSphere();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 })); // 第 17 批：你那間不畫（大理石車庫自己有招牌）：那一格是透明的
  mesh.name = 'garst-signs'; mesh.matrixAutoUpdate = false;
  TR.scene.add(mesh);
  Object.assign(NET_GST, { mesh, cv, tex, sig: null });
  return true;
}
function netGstPaint() {
  const SL = VIL?.places?.garst?.slots; if (!SL || !NET_GST.cv) return;
  const own = NET_GST.own, mine = homeSlot(); own.length = SL.length; own.fill(null); // 車庫街的家：每個人在自己號碼那間（世界的號碼 0–5）
  own[mine] = { uid: NET.me, n: NET.myName || '你', me: true };
  for (const m of NET.mem) { const i = parseInt(m.s, 10); if (i >= 0 && i < SL.length && !own[i]) own[i] = { uid: m.uid, n: NET.P.get(m.uid)?.n || String(m.n || '朋友').slice(0, 12), col: NET.P.get(m.uid)?.col }; }
  const sig = HOME.gs + '#' + own.map((o) => (o ? o.uid + ':' + o.n : '-')).join('|');
  if (sig === NET_GST.sig) return;
  NET_GST.sig = sig;
  NET_GST.dots.length = 0;
  for (let i = 0; i < SL.length; i++) { const o = own[i]; if (o && !o.me) NET_GST.dots.push({ x: SL[i].door.x, z: SL[i].door.z, fill: o.col || '#4a8cff', ring: '#FFFFFF', r: 5, label: '⌂', name: `${o.n}的車庫` }); }
  const g = NET_GST.cv.getContext('2d'), W = NET_GST_W, H = NET_GST_H;
  g.clearRect(0, 0, W, H * SL.length);
  for (let i = 0; i < SL.length; i++) {
    const o = own[i], y = i * H;
    if (i === HOME.gs) continue; // 塔蓋在這裡（你家；第 23 批：去朋友家＝他家）：圓塔自己的名牌
    g.fillStyle = '#1d2026'; g.fillRect(0, y, W, H);
    g.font = `800 ${o ? 34 : 28}px "Noto Sans TC", "PingFang TC", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (o) { if (!o.me) { g.fillStyle = o.col || '#4a8cff'; g.beginPath(); g.arc(28, y + H / 2, 9, 0, Math.PI * 2); g.fill(); } g.fillStyle = o.me ? '#FF8A3D' : '#F3F3F1'; g.fillText(o.me ? `${o.n}（你）` : `${o.n}的車庫`, W / 2, y + H / 2 + 1, W - 80); }
    else { g.fillStyle = '#6d717a'; g.fillText('空的', W / 2, y + H / 2 + 1); }
  }
  NET_GST.tex.needsUpdate = true;
}
// 第 23 批（Nick 2026-10-18「可以開進別人的車庫」，卡片選「按門鈴」）：朋友家門口的按鈕＝「🔔 按門鈴 · 小明的家」（以前是「🚗 看他的車庫」：名單上的 🚗 還在）
function netGstTick(me, out) {
  if (!netGstBuild()) return;
  NET_GST.mesh.visible = true;
  netGstPaint();
  let at = -1;
  if (out && me && Math.abs(me.v ?? me.speed ?? 0) < 4) {
    const SL = VIL.places.garst.slots;
    for (let i = 0; i < SL.length && i < NET_GST.own.length; i++) { const d = SL[i].door; if (NET_GST.own[i] && !NET_GST.own[i].me && !(GV.on && GV.slot === i) && (d.x - me.x) * (d.x - me.x) + (d.z - me.z) * (d.z - me.z) < 36) { at = i; break; } } // 自己那間：開鐵捲門開進去；在他家（門開了）：不用按
  }
  const o = at >= 0 ? NET_GST.own[at] : null, wait = !!o && BELL.uid === o.uid, txt = o ? (wait ? `🔔 等${o.n}回答⋯` : `🔔 按門鈴 · ${o.n}的家`) : '';
  if (at === NET_GST.at && txt === NET_GST.txt) return;
  const first = !!o && at !== NET_GST.at && !wait;
  NET_GST.at = at; NET_GST.txt = txt;
  const H = netHud();
  H.gar.hidden = !o;
  if (o) { H.gar.textContent = txt; H.gar.classList.toggle('wait', wait); }
  if (first) netToast(`這是${o.n}的家。按門鈴問他可不可以開進去`);
}
function netGstGo() {
  const o = NET_GST.at >= 0 ? NET_GST.own[NET_GST.at] : null; if (!o || BELL.uid) return;
  if (police && police.state === 'wanted') { netToast('被警察追的時候不能按門鈴'); return; }
  if (BOR.on) { netToast('開借來的車不能進朋友家：先還車'); return; }
  BELL.uid = o.uid; BELL.n = o.n; BELL.t = performance.now();
  netEv('bell', { uid: o.uid, name: o.n });
  netToast(`🔔 叮咚！等${o.n}回答⋯`);
}
function netGstOff() {
  if (NET_GST.mesh) NET_GST.mesh.visible = false;
  NET_GST.at = -1; NET_GST.txt = ''; NET_GST.sig = null; NET_GST.own.length = 0; NET_GST.dots.length = 0;
  if (NET.hud) NET.hud.gar.hidden = true;
}

// ---- 別人找你比賽：卡片（好／不要），15 秒沒按＝不要；車庫頁也看得到（卡片放在畫面上）----
const NET_INV_S = 15;
function netInvite(d) {
  if (!NET.on || !d || !d.id || !(NET_KIND[d.kind] || d.kind === 'bell')) return false;
  const H = netHud();
  if (NET.inv && NET.inv.id !== d.id) return false; // 一次一張（網站排隊）
  if (NET.race && NET.race.phase !== 'done') return false; // 比賽中：網站說「在比賽」
  clearTimeout(NET.invT);
  NET.inv = { id: String(d.id) };
  const bell = d.kind === 'bell'; // 第 23 批：有人按我家的門鈴（草稿：「有人按你家的門鈴／X想開進你的車庫／他只能看你的車，不能開走。」）
  H.invH.hidden = !bell;
  H.invT.textContent = bell ? `${String(d.name || '有人').slice(0, 12)}想開進你的車庫` : `🏁 ${String(d.name || '有人').slice(0, 12)}找你比${NET_KIND[d.kind].replace(' 3 圈', '')}！`;
  H.invS.textContent = bell ? '他只能看你的車，不能開走。' : d.car ? `他開 ${String(d.car).slice(0, 24)}` : '';
  H.inv.hidden = false;
  H.invI.style.transition = 'none'; H.invI.style.width = '100%'; void H.invI.offsetWidth;
  H.invI.style.transition = `width ${NET_INV_S}s linear`; H.invI.style.width = '0%';
  NET.invT = setTimeout(() => netAnswer(false), NET_INV_S * 1000);
  return true;
}
function netUninvite(id) {
  if (!NET.inv || (id != null && NET.inv.id !== String(id))) return;
  clearTimeout(NET.invT); NET.inv = null;
  if (NET.hud) NET.hud.inv.hidden = true;
}
function netAnswer(ok) {
  const I = NET.inv; if (!I) return;
  netUninvite(I.id);
  netEv('answer', { id: I.id, ok: !!ok });
}

// ---- 去找他：目的地＝他現在在哪裡（VIL.places.friend，每一格跟著他動；沒有路線就直直指過去）；走到 14 公尺內就到了 ----
// 第 21 批（Nick 2026-10-17 草稿「「去找他」可以直接開到他的車庫」）：他在家（車庫裡）＝去他的家（6 個家分散在地圖上：照回家的路線帶路，到門口 14 公尺內就到了）
function netGoTo(uid) {
  const P = NET.P.get(uid);
  if (!P) return 'gone';
  if (!trip || !DRIVE.on || !VIL) return 'garage';
  if (!(netNow() - P.last < 6000) || !(P.cur.o === 1 || P.cur.o === 2)) { // 他在車庫（或在 400 公尺）
    const SL = VIL.places.garst?.slots, m = NET.mem.find((q) => q.uid === uid), i = m ? parseInt(m.s, 10) : -1;
    if (P.cur.o === 3 || (m && m.w && m.w !== '在車庫') || !SL || !(i >= 0 && i < SL.length) || i === homeSlot() || !VIL.homeAt) return 'away'; // 在比賽：找不到
    const H = VIL.homeAt(i, {});
    VIL.places.friend = { name: `${P.n || '朋友'}的車庫`, pos: H.pos.slice(), via: H.via, end: H.end, tail: H.tail };
    NET.goal = uid; NET.goalHome = i;
    BIGMAP?.close();
    setDest('friend');
    (walker && walker.mode !== 'off' ? walker : drv)?.toast(`去${P.n}的車庫：跟著左上角的箭頭`, 2400);
    return 'ok';
  }
  VIL.places.friend = { name: P.n || '朋友', pos: [P.cur.x, P.cur.z] };
  NET.goal = uid; NET.goalHome = -1;
  BIGMAP?.close();
  setDest('friend');
  (walker && walker.mode !== 'off' ? walker : drv)?.toast(`去找${P.n}：跟著左上角的箭頭`, 2400);
  return 'ok';
}
function netGoalTick(me) {
  if (!NET.goal) return;
  const P = NET.P.get(NET.goal);
  if (tripDest !== 'friend' || !P) { NET.goal = null; if (tripDest === 'friend') setDest(null); return; }
  if (me && NET.goalHome >= 0) { const d = VIL.places.friend?.pos; if (d && Math.hypot(d[0] - me.x, d[1] - me.z) < 14) { NET.goal = null; NET.goalHome = -1; setDest(null); (walker && walker.mode !== 'off' ? walker : drv)?.toast(`到${P.n}的車庫了！`, 2000); } return; }
  if (!me || !P.mk.on) return;
  if (Math.hypot(P.mk.x - me.x, P.mk.z - me.z) < 14) { NET.goal = null; setDest(null); (walker && walker.mode !== 'off' ? walker : drv)?.toast(`找到${P.n}了！`, 2000); }
}
// 現在在哪裡（名單上寫的；最多 12 個字）
function netPlace() {
  if (NET.race && NET.race.phase !== 'done') return '在比賽';
  if (RACE.on) return '在 400 公尺';
  if (!trip || HOME.in) return '在車庫';
  if (GV.in) return `在${GV.n}家`; // 第 23 批
  if (jailed()) { if (police.state !== 'jail') return '在警察局'; const L = Math.ceil(police.jailLeft / 10) * 10; return `在拘留室 ${Math.floor(L / 60)}:${String(L % 60).padStart(2, '0')}`; } // 10 秒一格（名單上倒數，不用一直送）
  if (ciRace) return '在賽車場';
  if (orRace) return '在越野車場';
  if (indoor) return indoor.kind === 'police' ? '在警察局' : indoor.kind === 'gunshop' ? '在槍店' : '在房子裡';
  const t = walker && walker.mode !== 'off' ? walker.telemetry() : drv ? drv.telemetry() : null;
  if (!t || !VIL) return '在路上';
  let best = null, bd = 140;
  for (const [k, q] of Object.entries(VIL.places)) {
    if (k === 'friend' || !q || !q.name) continue;
    const at = q.zone ? [q.zone.x, q.zone.z] : q.pos ? q.pos : q.spawn ? [q.spawn.x, q.spawn.z] : null; if (!at) continue;
    const d = Math.hypot(at[0] - t.x, at[1] - t.z); if (d < bd) { bd = d; best = k === 'garage' ? '家門口' : q.name; } // 「你的車庫」別人看會看錯
  }
  return best ? `在${String(best).slice(0, 11)}` : '在路上';
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
  if (r.seq <= NET.doneSeq) return; // 已經結束（回去開車）的那一場：資料還在，不要又開始
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
  else { offTower(cur); makeDrv(pose); } // 停在圓塔格子裡的那台：先從格子拿下來（第 21 批）
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
  const R = NET.race, H = NET.hud, tk = netNow(), tk0 = NET.tickAt || tk; NET.tickAt = tk; if (!R || !H) return;
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
    if (left != null && left <= 0 && R.phase === 'wait') { R.phase = 'run'; R.runAt = tk; R.runGap = tk - tk0; if (R.kind === 'hill' && drv) { drv.setInput(null); R.held = false; } } // runGap：跟上一格差多久（出發是在 go 以後的第一格）
    if (R.kind === 'hill' && R.held && drv && Math.abs(drv.telemetry().v) > 0.3) drv.setInput(NET_HOLD);
  } else if (!H.rc.hidden && R.phase !== 'prep') H.rc.hidden = true;
  const q = (R.phase === 'wait' || R.phase === 'run') && R.myT == null && (R.kind === 'hill' ? netWorld() : R.kind === 'drag' && RACE.on && document.body.classList.contains('fs')); // 爬山、全螢幕的 400 公尺（下面那一塊藏起來了）：「放棄這場」；賽車場有自己的、一般版面的 400 公尺按「開回村子」
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
  const host = NET.host === NET.me, left = !NET.host; // host 空的＝對方回去開車、離開了
  again.textContent = host ? '再比一次' : left ? '對方離開了' : '等對方按再比一次'; again.disabled = !host;
  back.textContent = '回去開車';
  again.addEventListener('click', () => { if (NET.host === NET.me) netEv('again'); });
  back.addEventListener('click', () => { netRaceEnd(); netEv('back'); });
  row.append(again, back);
  H.res.append(h, ol, row);
  H.res.hidden = false;
}
// 這一場收掉（回去開車、下一場、對方走了、離開世界）：車子留在原地接著開
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
  Rc.net = R; Rc.phase = 'intro'; Rc.t = 0; Rc.green = null; Rc.greenAt = null; Rc.goSeen = null; Rc.wallAt = 0; Rc.foul = false; Rc.doneT = null; Rc.opp = null; Rc.oppS = null;
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
  const wall = Date.now(); Rc.gapMs = wall - (Rc.wallAt || wall); Rc.wallAt = wall; // 這一格跟上一格差多久（就在看出發時間的地方量；測試看綠燈是不是 go 以後的第一格）
  if (R.go) { R.goT = Rc.t + (R.go - netNow()) / 1000; if (Rc.goSeen == null) Rc.goSeen = wall; } // 每一格重算：手機卡卡的（一格超過 0.1 秒）比賽的時鐘會慢，綠燈還是照伺服器的時間亮；goSeen：什麼時候知道出發時間（測試看）
  if (Rc.phase === 'intro' && R.goT != null && (Rc.t > 1.6 || R.goT - Rc.t < 0.5)) { Rc.phase = 'stage'; Rc.stageT = Rc.t; toast('準備', 800); }
  // 手機很卡（一格超過 0.05 秒，比賽的時鐘比真的慢）：進場還沒播完、出發時間快到了 → 直接準備；綠燈就是出發時間（不再多等 0.2 秒：比賽的時鐘慢，會晚將近 1 秒）
  if (Rc.phase === 'stage' && R.goT != null) Rc.greenAt = R.goT;
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

// ==== 第 19 批：借朋友的車（Nick 2026-10-15「可以借別人的車來開 每個人自己手機上會有一個密碼 別人要借你就跟他說密碼。密碼可以自己改。打完密碼就可以上車」；
//      草稿 https://claude.ai/artifact/5yJe6e2HjwjbPemrTACohF，Nick 說好）====
// 車主：下車以後車停在原地（netState 送 pk＝[車, x, z, h]，朋友那邊畫出來、會擋）；密碼 GAME.key（4 個數字，第一次要的時候自己給一組；網站「👥 連線」裡看、改；只有自己看得到）
// 借的人：走到朋友停著的車旁邊 →「🔑 借車 · 小明的 GT-R」→ 數字鍵盤打 4 個數字 → 網站送給車主的手機，車主那邊對密碼（錯 3 次要等 30 秒）
//   → 對了：車主那邊把車藏起來，回車子的樣子、零件、輪胎、停的位置 → 走去車門坐進去（walk.js getIn）→ 開的是朋友的車（他的顏色、零件）
//   存檔還是你自己的（saveFix）；不能改裝、不能在車行買車、不能比直線加速、不能找人比賽（town.src.js 看 BORROW_K、網站看 borrowing()）
//   下車＝還車（停在你下車的地方）；車主按「拿回來」、車主離開世界、你回車庫頁：也還（你在開的話，人站到車子旁邊）
// 車主那邊：借出去的那台藏起來、不能上（LENT_K）；上面一條「🔑 阿龍在開你的 GT-R  拿回來」；還回來＝停在他下車的地方（輕量車，上車照常換成完整的）
// 網站（site/world.js）送：borrow/q（密碼）→ borrow/a（回答、拿回來）→ borrow/r（還車：停在哪裡）
const BOR = { near: null, pad: null, want: null, on: null, lent: null, loading: null, ui: null, nearSig: '', locks: {} }; // loading：坐進去了、車子載入中（want 那一筆）
const BOR_TRY = 3; // 錯幾次要等（車主那邊算；這邊只是顯示）
const borCarName = (k) => (CARS[k] ? CARS[k].btn[0] : String(k || '').toUpperCase());
function borKey() { // 我的密碼（沒有就給一組）
  if (!/^[0-9]{4}$/.test(GAME.key || '')) { GAME.key = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); save(true); }
  return GAME.key;
}
function borUi() {
  if (BOR.ui) return BOR.ui;
  netHud();
  const st = document.createElement('style');
  st.textContent = `.nt-key{position:absolute;z-index:6;left:50%;bottom:calc(var(--fs-b,0px) + 200px);transform:translateX(-50%);max-width:calc(100% - 20px);padding:11px 18px;border:2px solid #ffcc33;border-radius:999px;background:rgba(20,21,24,0.92);color:#F2F3F5;font:800 15px "Noto Sans TC",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;touch-action:manipulation}
.nt-key[hidden],body:not(.driving) .nt-key,body.bigmap .nt-key{display:none}
.nt-pad{position:absolute;inset:0;z-index:11;display:grid;place-items:center;background:rgba(8,10,14,0.6);font-family:"Noto Sans TC",sans-serif}
.nt-pad[hidden]{display:none}
.nt-pad>div{width:min(290px,calc(100% - 28px));box-sizing:border-box;padding:14px;border-radius:18px;background:rgba(20,21,24,0.96);border:2px solid #ffcc33;color:#F2F3F5;display:flex;flex-direction:column;gap:10px;text-align:center}
.nt-pad b{font-size:16px}
.nt-dots{display:flex;justify-content:center;gap:14px}
.nt-dots i{width:15px;height:15px;border-radius:50%;border:2px solid #ffcc33;box-sizing:border-box}
.nt-dots i.on{background:#ffcc33}
.nt-pad.bad .nt-dots{animation:ntShake .35s}
@keyframes ntShake{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
.nt-pad p{margin:0;min-height:19px;font-size:13px;color:#C6CAD1}
.nt-pad p.err{color:#ff8a7a}
.nt-keys{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.nt-keys button{min-height:46px;border:0;border-radius:12px;background:#2a2d33;color:#F2F3F5;font:800 20px/1 "Barlow Condensed","Arial Narrow",sans-serif;cursor:pointer;touch-action:manipulation;font-variant-numeric:tabular-nums}
.nt-keys button.sm{font:700 14px "Noto Sans TC",sans-serif}
.nt-keys button:disabled{opacity:.4}
.nt-bor{position:absolute;z-index:7;left:50%;top:calc(var(--fs-t,0px) + 112px);transform:translateX(-50%);max-width:calc(100% - 20px);display:flex;align-items:center;gap:10px;padding:6px 6px 6px 14px;border-radius:999px;background:rgba(20,21,24,0.9);border:2px solid #ffcc33;color:#F2F3F5;font:700 14px "Noto Sans TC",sans-serif;pointer-events:auto}
.nt-bor[hidden],body:not(.driving) .nt-bor,body.bigmap .nt-bor,body.shopping .nt-bor{display:none}
.nt-bor span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nt-bor button{flex:none;min-height:34px;padding:0 14px;border:0;border-radius:999px;background:#ffcc33;color:#1a1405;font:800 14px "Noto Sans TC",sans-serif;cursor:pointer;touch-action:manipulation}`;
  document.head.appendChild(st);
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const near = mk('button', 'nt-key'); near.type = 'button'; near.hidden = true; near.addEventListener('click', () => { if (BOR.near) borPadOpen(BOR.near); });
  const pad = mk('div', 'nt-pad'), box = mk('div'), title = mk('b'), dots = mk('div', 'nt-dots'), msg = mk('p'), keys = mk('div', 'nt-keys');
  for (let i = 0; i < 4; i++) dots.append(mk('i'));
  const btns = [];
  for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '取消', '0', '⌫']) {
    const b = mk('button', d.length > 1 ? 'sm' : null, d); b.type = 'button'; if (d === '⌫') b.setAttribute('aria-label', '刪掉一個');
    b.addEventListener('click', () => borPadKey(d)); keys.append(b); btns.push(b);
  }
  box.append(title, dots, msg, keys); pad.append(box); pad.hidden = true;
  const bar = mk('div', 'nt-bor'), barT = mk('span'), barB = mk('button'); barB.type = 'button'; bar.append(barT, barB); bar.hidden = true;
  barB.addEventListener('click', () => { if (BOR.on) leaveCar(); else if (BOR.lent) netEv('takeback', { uid: BOR.lent.uid }); });
  stage.append(near, pad, bar);
  return (BOR.ui = { near, pad, title, dots, msg, btns, bar, barT, barB });
}
// ---- 借的人：數字鍵盤 ----
function borPadOpen(P) {
  const U = borUi(), k = P.cur.pk && P.cur.pk[0];
  if (!k || BOR.on || BOR.want) return;
  BOR.pad = { uid: P.uid, n: P.n, k, code: '', state: 'type', lockT: BOR.locks[P.uid] > performance.now() ? BOR.locks[P.uid] : 0, sentT: 0 }; // 錯太多次：關掉再打開還是鎖著
  U.title.textContent = `輸入${P.n}的密碼`;
  borPadMsg('', false); borPadPaint(); U.pad.hidden = false;
}
function borPadClose() { BOR.pad = null; if (BOR.ui) BOR.ui.pad.hidden = true; }
function borPadMsg(t, err) { const U = borUi(); U.msg.textContent = t; U.msg.classList.toggle('err', !!err); }
function borPadPaint() {
  const U = borUi(), D = BOR.pad; if (!D) return;
  [...U.dots.children].forEach((e, i) => e.classList.toggle('on', i < D.code.length));
  const lock = D.state === 'wait' || D.lockT > performance.now();
  U.btns.forEach((b) => { b.disabled = lock && b.textContent !== '取消'; });
}
function borPadKey(d) {
  const D = BOR.pad; if (!D) return;
  if (d === '取消') { borPadClose(); return; }
  if (D.state === 'wait' || D.lockT > performance.now()) return;
  if (d === '⌫') D.code = D.code.slice(0, -1);
  else if (D.code.length < 4) D.code += d;
  borUi().pad.classList.remove('bad');
  borPadPaint();
  if (D.code.length === 4) { D.state = 'wait'; D.sentT = performance.now(); borPadMsg('確認中⋯', false); borPadPaint(); netEv('borrow', { uid: D.uid, code: D.code }); }
}
function borPadTick() { // 送出去 10 秒沒回答；鎖住的時間到了
  const D = BOR.pad; if (!D) return;
  const now = performance.now();
  if (D.state === 'wait' && now - D.sentT > 10000) { D.state = 'type'; D.code = ''; borPadMsg(`${D.n}沒有回答，等一下再試。`, true); borPadPaint(); }
  if (D.lockT && D.lockT <= now) { D.lockT = 0; borPadMsg('可以再試了。', false); borPadPaint(); }
  else if (D.lockT) { const s = Math.ceil((D.lockT - now) / 1000), t = `錯太多次了，等 ${s} 秒再試。`; if (borUi().msg.textContent !== t) borPadMsg(t, true); }
}
// 網站回答（borrow/a）：{ uid, ok：1 好｜0 密碼不對｜−2 現在不能借｜−3 要等｜−4 送不出去（規則還沒貼）｜−8 他離開了｜−9 拿回來, k, l, pt, ty, x, z, h, left, wait }
function borAnswer(a) {
  if (!a || !a.uid) return;
  if (a.ok === -9 || a.ok === -8) { if (BOR.on && BOR.on.uid === a.uid) netBorrowEnd(a.ok === -9 ? 'back' : 'gone'); else if (BOR.loading && BOR.loading.uid === a.uid) BOR.loading.cancel = true; else if (BOR.want && BOR.want.uid === a.uid) { BOR.want = null; if (walker && trip) walker.setCars(walkCars()); netToast(`${a.ok === -9 ? '他把車拿回去了' : '他離開了'}`); } if (BOR.pad && BOR.pad.uid === a.uid) borPadClose(); return; }
  const D = BOR.pad;
  if (a.ok === 1) {
    const pose = { x: +a.x, z: +a.z, heading: +a.h }, k = typeof a.k === 'string' ? a.k : '';
    const ret = () => netEv('return', { uid: a.uid, x: pose.x, z: pose.z, h: pose.heading });
    if (!D || D.uid !== a.uid || D.state !== 'wait' || !CARS[k] || ![pose.x, pose.z, pose.heading].every(Number.isFinite)) { ret(); return; } // 取消了、資料不對：車子馬上還他
    borPadClose();
    const P = NET.P.get(a.uid), O = P && P.obj, me = walker && walker.mode === 'walk' ? walker.telemetry() : null;
    if (!O || !me || Math.hypot(me.x - pose.x, me.z - pose.z) > 9) { ret(); netToast('走到車子旁邊再試一次'); return; }
    const pt = Array.isArray(a.pt) ? a.pt.filter((x) => PERF[k].parts.some((p) => p[0] === x)) : [];
    const ty = a.ty && typeof a.ty === 'object' ? { own: (Array.isArray(a.ty.own) ? a.ty.own : []).filter((n) => n === 1 || n === 2), use: [0, 1, 2].includes(a.ty.use) ? a.ty.use : 0 } : { own: [], use: 0 };
    if (ty.use && !ty.own.includes(ty.use)) ty.use = 0;
    const entry = { key: k, name: `${P.n}的 ${borCarName(k)}`, x: pose.x, z: pose.z, heading: pose.heading, hx: (O.nose - O.tail) / 2, hz: O.hw, cx: O.cx, cz: 0, h: O.top, object: O.car, borrow: true, solid: false };
    BOR.want = { uid: a.uid, n: P.n, k, l: a.l && typeof a.l === 'object' ? a.l : null, pt, ty, pose, entry, t: performance.now() };
    walker.setCars([...walkCars(), entry]);
    if (!walker.getIn(entry)) { borWantOff(); netToast('上不了車，再試一次'); }
    return;
  }
  if (!D || D.uid !== a.uid || D.state !== 'wait') return;
  D.state = 'type'; D.code = '';
  if (a.ok === 0) { const left = Math.max(0, a.left | 0); borPadMsg(left ? `密碼不對（還可以試 ${left} 次）` : '密碼不對', true); const U = borUi(); U.pad.classList.remove('bad'); void U.pad.offsetWidth; U.pad.classList.add('bad'); }
  else if (a.ok === -3) { D.lockT = BOR.locks[D.uid] = performance.now() + Math.max(1, Math.min(60, +a.wait || 30)) * 1000; }
  else if (a.ok === -4) borPadMsg('借車還沒打開：要請爸媽把新的規則貼到 Firebase', true);
  else borPadMsg(`${D.n}的車現在不能借（他坐回車上了，或回車庫了）`, true);
  borPadPaint();
}
function borWantOff() { // 走去車門走到一半取消了（推搖桿）、不能上：車子還他
  const W = BOR.want; if (!W) return;
  BOR.want = null;
  netEv('return', { uid: W.uid, x: W.pose.x, z: W.pose.z, h: W.pose.heading });
  if (walker && trip) walker.setCars(walkCars());
}
// 你原本那台（剛下來的）：跟 switchCar 一樣停好（大車用完整的停在原地，別台換輕量車、走過去還能上）
function borParkMine() {
  const old = tripS, keep = old && !liftOK(cur) && tripPose[cur] ? { p: old.car.position.clone(), r: old.car.rotation.clone() } : null;
  if (drv) { drv.dispose(); drv = null; }
  dvoice?.dispose(); dvoice = null;
  old?.dmg?.clearDebris();
  if (keep) { old.car.position.copy(keep.p); old.car.rotation.copy(keep.r); old.car.updateMatrixWorld(true); PFULL[cur] = { S: old, box: tripBox || fullBox(old) }; }
  else stowFull(old);
  if (parkShadow) parkShadow.visible = false;
  tripFull = null; tripBox = null; arrangeCars(); // tripS 留著（跟 switchCar 一樣）：比賽的 netSeat、回車庫頁都用它
}
// 坐進去了（town.src.js onGetIn）：完整的車（朋友的樣子）載好 → 你原本那台停好（跟 switchCar 一樣）→ 開
async function netBorrowBoard(e) {
  const W = BOR.want;
  if (!W || W.entry !== e) { borParkMine(); walker.resume(); return; } // 走到一半車主拿回去了
  BOR.want = null; BOR.loading = W;
  const k = W.k, look = netLook(k, W.l), pcur = cur, ppose = tripPose[k] || null;
  borParkMine();
  const myS = tripS;
  gtoast(`${W.n}的 ${borCarName(k)} 發動中⋯`, 2600);
  let car = null; try { car = await loadCar(k, look); } catch (er) { console.error(er); }
  BOR.loading = null;
  if (!car || !trip || !DRIVE.on || !tripPose || !NET.P.get(W.uid) || W.cancel) {
    if (car) disposeCar(car);
    if (trip && DRIVE.on && walker) { walker.resume(); walker.toast(W.cancel ? `${W.n}把車拿回去了` : '車子發動不了', 2200); }
    if (!W.cancel) netEv('return', { uid: W.uid, x: W.pose.x, z: W.pose.z, h: W.pose.heading });
    return;
  }
  const prev = { cur: pcur, S: myS, pose: ppose, state: { ...CARS[k].state }, parts: GAME.parts[k], tyres: GAME.tyres[k], dmg: GAME.dmg[k], has: { parts: k in GAME.parts, tyres: k in GAME.tyres, dmg: k in GAME.dmg }, pf: null };
  if (PFULL[k]) { prev.pf = PFULL[k]; prev.pf.S.car.visible = false; prev.pf.sd?.removeFromParent(); delete PFULL[k]; } // 你自己也有一台一樣的（大車停在外面）：先藏起來
  CARS[k].state = { ...look }; GAME.parts[k] = W.pt.slice(); GAME.tyres[k] = { own: W.ty.own.slice(), use: W.ty.use }; delete GAME.dmg[k];
  BOR.on = { uid: W.uid, n: W.n, k, car, prev, pose0: { ...W.pose } };
  BORROW_K = k; saveFix = borSaveFix;
  cur = k; tripS = car; tripPose[k] = { ...W.pose }; tripBox = fullBox(car);
  makeDrv(W.pose);
  drv.toast(`開${W.n}的 ${borCarName(k)}：下車就還給他`, 2800);
}
function borSaveFix(d) { // 存檔：借來的車不要存（現在開的、外觀、零件、輪胎都換回你自己的）
  const B = BOR.on; if (!B) return;
  const p = B.prev, k = B.k;
  d.cur = p.cur;
  d.cars = { ...d.cars, [k]: p.state };
  d.parts = { ...d.parts }; if (p.has.parts) d.parts[k] = p.parts; else delete d.parts[k];
  d.tyres = { ...d.tyres }; if (p.has.tyres) d.tyres[k] = p.tyres; else delete d.tyres[k];
  d.dmg = { ...d.dmg }; if (p.has.dmg) d.dmg[k] = p.dmg; else delete d.dmg[k];
  if (d.park && d.park.mid === k && !GAME.owned.has(k)) d.park = { ...d.park, mid: p.cur };
}
// 還車（why：out 下車｜back 車主拿回來｜gone 車主離開了｜home 回車庫頁｜leave 你離開世界）：車子停的位置送給車主，換回你自己的
function netBorrowEnd(why) {
  const B = BOR.on; if (!B) { if (BOR.want && why !== 'out') borWantOff(); return; }
  BOR.on = null; BORROW_K = null; saveFix = null;
  const k = B.k, p = B.prev, driving = !!drv && cur === k && !!walker && walker.mode === 'off';
  let pose = tripPose[k] ? { x: tripPose[k].x, z: tripPose[k].z, heading: tripPose[k].heading } : null;
  if (drv && cur === k) { const t = drv.telemetry(); pose = { x: t.x, z: t.z, heading: t.heading }; }
  if (pose && (HOME.in || GAR.isInside(garLocal(pose.x, pose.z).x, garLocal(pose.x, pose.z).z, -1))) pose = { ...B.pose0 }; // 開進你自己的車庫裡：還到他原本停的地方（他進不去你的車庫）
  dvoice?.dispose(); dvoice = null;
  if (drv && cur === k) { drv.dispose(); drv = null; }
  disposeCar(B.car);
  CARS[k].state = p.state;
  if (p.has.parts) GAME.parts[k] = p.parts; else delete GAME.parts[k];
  if (p.has.tyres) GAME.tyres[k] = p.tyres; else delete GAME.tyres[k];
  if (p.has.dmg) GAME.dmg[k] = p.dmg; else delete GAME.dmg[k];
  cur = p.cur; tripS = p.S || null; tripFull = null; tripBox = null; // 你自己那台（收著；走過去上車照常）
  if (tripPose) { if (p.pose) tripPose[k] = p.pose; else delete tripPose[k]; }
  if (p.pf) { PFULL[k] = p.pf; p.pf.S.car.visible = true; }
  if (why !== 'home' && trip && walker) {
    if (driving && pose) { // 還在開（車主拿回來、他離開了）：人站到車子左邊（駕駛座那邊）
      const ci = PERF[k]?.halfW || 1, c = Math.cos(pose.heading), s = Math.sin(pose.heading), side = ci + 0.9;
      walker.teleport({ x: pose.x - s * side, z: pose.z - c * side, heading: pose.heading - Math.PI / 2 }, { keepCamera: false });
      walker.resume({ blend: 0.4 });
    }
    walker.setCars([], { keepParked: false });
    arrangeCars();
  }
  borUi().bar.hidden = true;
  if (pose && why !== 'back' && why !== 'gone') netEv('return', { uid: B.uid, x: pose.x, z: pose.z, h: pose.heading });
  if (why === 'out') netToast(`還給${B.n}了`);
  else if (why === 'back') netToast(`${B.n}把車拿回去了`);
  else if (why === 'gone') netToast(`${B.n}離開了，車還給他了`);
  save();
}
// ---- 車主 ----
function borParked() { // 我下車停著的那台（朋友看得到、借得到）：剛下來（開車的暫停著）或朋友還回來的（輕量車）；不在車庫裡面、沒借出去 → { x, z, heading }
  if (BOR.on || LENT_K || !walker || walker.mode === 'off' || walker.mode === 'seat' || walker.mode === 'in' || HOME.in || !tripPose) return null;
  let t = null;
  if (drv) { if (tripFull !== cur || !tripS) return null; const d = drv.telemetry(); if (!d.paused) return null; t = { x: d.x, z: d.z, heading: d.heading }; }
  else { const p = tripPose[cur]; if (!p || p.tw != null || tripFull === cur || PFULL[cur] || !GAME.owned.has(cur)) return null; t = p; } // 還回來停著（輕量車）
  const q = garLocal(t.x, t.z); if (GAR.isInside(q.x, q.z, -1)) return null;
  return t;
}
// 第 22 批：我的車停在外面哪裡（我在走路、在房子裡、在警察局、被關都算；開著、在自己車庫裡、停在家的格子上、借出去了不算）→ { x, z, heading } | null
function netParked() {
  if (BOR.on || LENT_K || HOME.in || !trip || !tripPose || !walker || walker.mode === 'off') return null;
  let t = null;
  if (drv) { if (tripFull !== cur || !tripS) return null; const d = drv.telemetry(); if (!d.paused) return null; t = { x: d.x, z: d.z, heading: d.heading }; }
  else { t = tripPose[cur]; if (!t || t.tw != null || !GAME.owned.has(cur)) return null; } // 被抓：拖到警察局的停車場（完整的車）；還回來的：輕量車
  const q = garLocal(t.x, t.z); if (GAR.isInside(q.x, q.z, -1)) return null;
  return t;
}
function borLendInfo() { // 網站問：可以借嗎（可以＝車子的樣子、零件、停在哪裡）
  const t = borParked(); if (!t) return null;
  return { k: cur, l: { ...CARS[cur].state }, pt: partsOf(cur).slice(), ty: { own: tyresOf(cur).own.slice(), use: tyresOf(cur).use }, x: Math.round(t.x * 100) / 100, z: Math.round(t.z * 100) / 100, h: Math.round(t.heading * 1000) / 1000 };
}
function borLend(uid, n) { // 借出去了：開車的收掉、車子藏起來（不能上）
  const t = borParked(); if (!t) return false;
  const k = cur;
  if (drv) { drv.dispose(); drv = null; dvoice?.dispose(); dvoice = null; stowFull(tripS); tripS = null; tripFull = null; tripBox = null; } // 剛下來那台：開車的收掉
  if (parkShadow) parkShadow.visible = false;
  tripPose[k] = { x: t.x, z: t.z, heading: t.heading };
  BOR.lent = { uid, n: String(n || '朋友').slice(0, 12), k }; LENT_K = k;
  walker.setCars([], { keepParked: false }); arrangeCars();
  const U = borUi(); U.barT.textContent = `🔑 ${BOR.lent.n}在開你的 ${borCarName(k)}`; U.barB.textContent = '拿回來'; U.bar.hidden = false;
  netToast(`🔑 ${BOR.lent.n}借走你的 ${borCarName(k)} 了`);
  return true;
}
function borUnlend(pose) { // 還回來了（停在他下車的地方；沒有位置＝原本停的地方）
  const L = BOR.lent; if (!L) return;
  BOR.lent = null; LENT_K = null;
  if (BOR.ui) BOR.ui.bar.hidden = true;
  if (!trip || !tripPose) return;
  if (pose && [pose.x, pose.z, pose.heading].every(Number.isFinite)) tripPose[L.k] = { x: pose.x, z: pose.z, heading: pose.heading };
  arrangeCars();
  netToast(`${L.n}把 ${borCarName(L.k)} 還給你了`);
}
function netLendHome() { if (BOR.lent) { netEv('takeback', { uid: BOR.lent.uid }); BOR.lent = null; LENT_K = null; if (BOR.ui) BOR.ui.bar.hidden = true; } } // 回車庫頁：借出去的拿回來
// 每一格（netStep）：旁邊有朋友停著的車＝「🔑 借車」；開借來的車＝上面那一條；下車了＝還車
function borTick(me, show, race) {
  const U = borUi();
  borPadTick();
  if (BOR.on && trip && DRIVE.on && (!drv || cur !== BOR.on.k || (walker && walker.mode !== 'off' && walker.mode !== 'out'))) netBorrowEnd('out'); // 下車（走出來以後）＝還車
  if (BOR.want && walker && walker.mode === 'walk' && performance.now() - BOR.want.t > 600) borWantOff(); // 走去車門的時候推搖桿取消了
  if (BOR.on) { const t = `🔑 借來的車 · ${BOR.on.n}的 ${borCarName(BOR.on.k)}`; if (U.barT.textContent !== t) { U.barT.textContent = t; U.barB.textContent = '還車'; } U.bar.hidden = false; }
  let best = null;
  if (show && !race && !BOR.on && !BOR.want && !BOR.pad && me && walker && walker.mode === 'walk') {
    let bd = 2.4;
    for (const P of NET.P.values()) {
      const c = P.cur, O = P.obj; if (c.o !== 2 || !c.pk || !O || !O.car.visible) continue;
      const h = c.pk[3], cs = Math.cos(h), sn = Math.sin(h), bx = c.pk[1] + cs * O.cx, bz = c.pk[2] - sn * O.cx, dx = me.x - bx, dz = me.z - bz;
      const eu = Math.abs(dx * cs - dz * sn) - (O.nose - O.tail) / 2, ew = Math.abs(dx * sn + dz * cs) - O.hw, d = Math.hypot(Math.max(0, eu), Math.max(0, ew));
      if (d < bd) { bd = d; best = P; }
    }
  }
  BOR.near = best;
  const sig = best ? `${best.uid}:${best.cur.pk[0]}:${best.n}` : '';
  if (sig !== BOR.nearSig) { BOR.nearSig = sig; U.near.hidden = !best; if (best) U.near.textContent = `🔑 借車 · ${best.n}的 ${borCarName(best.cur.pk[0])}`; }
}
function borOff() { // 離開世界：借來的還、借出去的拿回來（網站那邊自己送）
  if (BOR.on) netBorrowEnd('leave');
  if (BOR.want) borWantOff();
  if (BOR.loading) BOR.loading.cancel = true;
  borPadClose();
  if (BOR.lent) borUnlend(null);
  BOR.near = null; BOR.nearSig = '';
  if (BOR.ui) { BOR.ui.near.hidden = true; BOR.ui.bar.hidden = true; }
}

// ==== 第 23 批：開進朋友的車庫（Nick 2026-10-18「可以開進別人的車庫」；草稿 https://claude.ai/artifact/RUhVB6G34nJk9SBLt1rm6q，卡片選「按門鈴」）====
// 走到朋友家門口（他在世界裡）→「🔔 按門鈴 · 小明的家」→ 他的遊戲跳卡片（好／不要，15 秒）→ 好：你這邊的塔（GAR）搬到他家（你家變外殼，你的車照停）、
//   格子裡換成他的車（輕量車、他的樣子；只能看，不能開、不能停進他的格子）、名牌、獎盃換他的；鐵捲門打開 → 開進去、下車走路、坐電梯（走路才能坐）看每一層
// 出來：開（走）出門外 25 公尺（你的車還停在裡面就不算）；他按「請他出去」、他離開世界：人、車送到門口外面；塔搬回你家
// 他那邊：上面一條「🏠 X在你的車庫裡」＋「請他出去」；他在一樓的時候朋友看得到他（平常在家裡看不到）
// 網站（site/world.js）：matches/{id}（kind 'bell'）＋ world/ch（跟找人比賽同一條路：封鎖、關掉邀請的聽不到）；規則不用改
const BELL = { uid: '', n: '', t: 0 }; // 我按了誰家的門鈴（等他回答）
const GUEST = { uid: '', n: '', ui: null }; // 誰在我的車庫裡（我說好了）
function netBellAns(a) {
  if (!a || !a.uid) return 'gone';
  const n = String(a.n || BELL.n || '朋友').slice(0, 12);
  if (BELL.uid === a.uid) BELL.uid = '';
  if (a.ok === 1) {
    const r = gvStart(a.uid, n, a.g);
    if (r === 'far') netToast(`${n}說好了，可是你已經走遠了`); else if (r !== 'ok') netToast(`${n}說好了，可是你現在進不去`);
    return r;
  }
  const m = { [-1]: `${n}說「不要」。`, [-2]: `${n}在忙（在比賽），等一下再按。`, [-3]: `${n}關掉了邀請，聽不到門鈴。`, [-4]: '門鈴按不響，等一下再試一次。', [-5]: `${n}已經不在線上了。`, 0: `${n}沒有回答。` }[a.ok | 0];
  if (m) netToast(m);
  return 'ok';
}
// 他說好了：塔搬到他家（g＝他的車庫：{ cars: { key: 外觀 }, tw: 'gc8,,supra,…'（40 格）, tr（獎盃）, cur }）→ 'ok' | 'far' | 'gone' | 'busy'
function gvStart(uid, n, g) {
  if (GV.on) return GV.uid === uid ? 'ok' : 'busy';
  if (!trip || !DRIVE.on || !GAR || !tripPose || !VIL?.places?.garst || RACE.on || indoor || jailed() || EL.ride || GAR.lift.busy || BOR.on) return 'busy';
  const i = NET_GST.own.findIndex((o) => o && !o.me && o.uid === uid), SL = VIL.places.garst.slots;
  if (i < 0 || !SL[i]) return 'gone';
  const t = walker && walker.mode !== 'off' ? walker.telemetry() : drv ? drv.telemetry() : null, d = SL[i].door;
  if (!t || Math.hypot(t.x - d.x, t.z - d.z) > 40) return 'far';
  const cars = g && g.cars && typeof g.cars === 'object' ? g.cars : {}, ok = (k) => typeof k === 'string' && !!CARS[k] && !!LOD_CARS[k] && liftOK(k) && Object.prototype.hasOwnProperty.call(cars, k);
  const want = Array(TOWER_BAYS.length).fill(null), seen = new Set(), tw = typeof g?.tw === 'string' ? g.tw.split(',') : null;
  if (tw) tw.forEach((k, j) => { if (j < want.length && !TOWER_BAYS[j].road && ok(k) && !seen.has(k)) { want[j] = k; seen.add(k); } });
  if (tw) tw.forEach((k, j) => { if (j < want.length && TOWER_BAYS[j].road && ok(k) && !seen.has(k)) { const f = twFree(want); if (f >= 0) { want[f] = k; seen.add(k); } } }); // 第 24 批：舊版（內容 17）停在變成路的那一格：換到空的格子
  else for (const k of Object.keys(cars)) if (ok(k) && k !== g?.cur && !seen.has(k)) { const j = twFree(want); if (j < 0) break; want[j] = k; seen.add(k); } // 舊版（內容 16）沒有送格子：照順序擺
  if (g && ok(g.cur) && !seen.has(g.cur)) { const j = twFree(want); if (j >= 0) { want[j] = g.cur; seen.add(g.cur); } } // 第 32 批：他正在開的那台也擺進去（第一個空格；以前不會出現）
  Object.assign(GV, { on: true, uid, n: String(n || '朋友').slice(0, 12), slot: i, want, looks: cars, objs: {}, q: [...seen], tr: Math.max(0, Math.min(9, (g && g.tr) | 0)), lift0: { f: GAR.lift.floor, rot: GAR.lift.rot }, in: false, loading: false });
  GV.job++;
  stopLiftSnd(); GAR.liftSnap(0, 0); GAR.setFloor(0); GAR.door.t = 0;
  homePlace(); // 塔搬到他家（你的東西不動）
  GAR.setTrophies(GV.tr); GAR.setSign?.(`${GV.n}的車庫`, `${GV.n}的家`);
  GAR.door.open(calm ? 1.2 : 2.2);
  arrangeCars();
  netToast(`${GV.n}說好！開進去吧（他的車只能看，不能開走）`);
  return 'ok';
}
// 他的車（輕量車、他的樣子）：一格做一台，做好就掛到格子上
function gvLoad(k) {
  const job = GV.job; GV.loading = true;
  LOD_CARS[k].load().then((sc) => {
    GV.loading = false;
    if (job !== GV.job || !GV.on) return;
    const lod = buildLodCar(k, sc, netLook(k, GV.looks[k])), box = new THREE.Box3().setFromObject(lod.car);
    lod.car.name = 'guest-' + k;
    GV.objs[k] = { lod, cx: (box.min.x + box.max.x) / 2, cz: (box.min.z + box.max.z) / 2, hx: (box.max.x - box.min.x) / 2, hz: (box.max.z - box.min.z) / 2 };
    arrangeCars();
  }, (e) => { if (job === GV.job) GV.loading = false; console.warn('朋友的車沒載好', e); });
}
function gvTick() {
  if (BELL.uid && performance.now() - BELL.t > 25000) BELL.uid = ''; // 網站 20 秒會說沒回答；保險
  if (!GV.on) return;
  if (!trip || !DRIVE.on || !GAR || !tripPose) { gvEnd('home'); return; }
  if (GV.q.length && !GV.loading) gvLoad(GV.q.shift());
  const t = walker && walker.mode !== 'off' ? walker.telemetry() : drv ? drv.telemetry() : null;
  if (!t || indoor || RACE.on || EL.ride || garIn(t)) return;
  const D = garWorld({ x: TOWER.DX1 + 2, z: 0 }), p = tripPose[cur];
  if (Math.hypot(t.x - D.x, t.z - D.z) > 25 && !(walker && walker.mode !== 'off' && p && (p.tw != null || garIn(p)))) gvEnd('left'); // 走遠了（車還停在他家裡面、他的格子裡就不算；第 32 批）
}
// 還在他家裡面（他請你出去、他走了）：人、車送到門口外面（車頭朝外）
function gvOut() {
  const riding = !!(EL.ride && EL.ride.me);
  elEnd();
  const out = (z) => { const w = garWorld({ x: TOWER.DX1 + 7, z, heading: 0 }); return { x: w.x, z: w.z, heading: w.heading }; };
  if (drv && walker && walker.mode === 'off') { const t = drv.telemetry(); if (garIn(t)) { const q = out(0); drv.teleport(q); tripPose[cur] = { ...q, f: 0 }; } return; }
  if (!walker || walker.mode === 'off') return;
  const p = tripPose[cur];
  if (p && p.tw != null && GV.want && tripS) { const i = p.tw; GV.want[i] = null; if (GAR.cars[i]) GAR.take(i); if (GAR.tk) GAR.tk[i] = null; if (drv) dropDrv(); tripPose[cur] = { ...out(0), f: 0 }; parkFull(); } // 第 32 批：停在他格子裡的車也到門口外面
  else if (p && p.tw == null && garIn(p) && tripS) { if (drv) dropDrv(); tripPose[cur] = { ...out(0), f: 0 }; parkFull(); }
  if (garIn(walker.telemetry())) walker.teleport(out(3.6), { keepCamera: false });
  if (riding) walker.resume();
}
// 出來了：塔搬回你家、格子換回你的車、名牌和獎盃換回來；why：left 走遠了｜kick 他請你出去｜gone 他走了｜leave 你離開世界｜home 回車庫頁
function gvEnd(why) {
  if (!GV.on) return;
  const n = GV.n, uid = GV.uid, L0 = GV.lift0, live = trip && tripPose && GAR;
  if (live && why !== 'home') gvOut();
  GV.on = false; GV.in = false; GV.job++; GV.q.length = 0; GV.loading = false;
  if (GAR) {
    GAR.door.t = 0; if (!EL.ride) { GAR.setFloor(0); stopLiftSnd(); }
    homePlace(); // 塔搬回你家（你在外面）
    GAR.liftSnap(L0 ? L0.f : 0, L0 ? L0.rot : 0);
    GAR.setTrophies(trophyCount()); GAR.setSign?.();
    if (live) liftChanged(); // 碰撞、格子換回你的車
  }
  for (const k of Object.keys(GV.objs)) { const o = GV.objs[k]; o.lod.car.removeFromParent(); o.lod.dispose(); }
  GV.objs = {}; GV.want = null; GV.looks = {};
  netEv('bellEnd', { uid });
  if (why === 'kick') netToast(`${n}請你出去了`);
  else if (why === 'gone') netToast(`${n}離開了，你從他家出來了`);
  else if (why === 'left') netToast(`離開${n}的家了`);
}
// 我這邊：朋友在我的車庫裡（上面一條＋「請他出去」；車庫頁也看得到）
function gstUi() {
  if (GUEST.ui) return GUEST.ui;
  netHud();
  const st = document.createElement('style');
  st.textContent = `.nt-gst{position:absolute;z-index:7;left:50%;top:calc(var(--fs-t,0px) + 112px);transform:translateX(-50%);max-width:calc(100% - 20px);display:flex;align-items:center;gap:10px;padding:6px 6px 6px 14px;border-radius:999px;background:rgba(20,21,24,0.9);border:2px solid #FF6A1F;color:#F2F3F5;font:700 14px "Noto Sans TC",sans-serif;pointer-events:auto;box-sizing:border-box}
.nt-gst[hidden],body.bigmap .nt-gst,body.shopping .nt-gst{display:none}
.nt-gst.low{top:calc(var(--fs-t,0px) + 160px)}
.nt-gst span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nt-gst button{flex:none;min-height:34px;padding:0 14px;border:0;border-radius:999px;background:#FF6A1F;color:#1a0d05;font:800 14px "Noto Sans TC",sans-serif;cursor:pointer;touch-action:manipulation}`;
  document.head.appendChild(st);
  const bar = document.createElement('div'), t = document.createElement('span'), b = document.createElement('button');
  bar.className = 'nt-gst'; b.type = 'button'; b.textContent = '請他出去'; bar.append(t, b); bar.hidden = true;
  b.addEventListener('click', () => { const u = GUEST.uid, n = GUEST.n; if (!u) return; netEv('kick', { uid: u }); netGuest(null); netToast(`請${n}出去了`); });
  stage.append(bar);
  return (GUEST.ui = { bar, t, b });
}
function netGuest(g, why) {
  if (g && g.uid) { const U = gstUi(); GUEST.uid = String(g.uid); GUEST.n = String(g.n || '朋友').slice(0, 12); U.t.textContent = `🏠 ${GUEST.n}在你的車庫裡`; U.bar.classList.toggle('low', !!(BOR.ui && !BOR.ui.bar.hidden)); U.bar.hidden = false; return; }
  const n = GUEST.n; GUEST.uid = ''; GUEST.n = '';
  if (GUEST.ui) GUEST.ui.bar.hidden = true;
  if (why === 'left' && n) netToast(`${n}離開你的車庫了`);
}

// ---- 自己的（送給朋友）----
const NET_ME = { o: 0, x: 0, z: 0, h: 0, v: 0, y: null, k: '', rp: null, rs: 0, w: 0, jl: 0, pc: [0, 0, 0, 0, 0, 0, 0, 0, 0], pi: [0, 0, 0], pn: 0, pk: null, pv: null, ph: null }; // y：第 24 批，開在外面的斜坡上（高度） // w、jl、pc／pi／pn：被警察追（幾顆星、被抓了、追你的警車、第幾台）；pk：第 19 批，下車停著的車 [車, x, z, h]；pv、ph：第 22 批（停著的車、撞到朋友的警車）
NET_ME.pl = 0; // 跳燈：開的（停著的）這台燈蓋立起來＝1（town.src.js popSend）
function netState() {
  const s = NET_ME, R = NET.race;
  s.k = cur; s.rp = null; s.rs = 0; s.o = 0; s.x = s.z = s.h = s.v = 0; s.w = 0; s.pn = 0; s.pk = null; s.pv = null; s.ph = NET_PH.out; s.jl = jailed() ? 1 : 0;
  s.pl = 0; s.y = null;
  if (RACE.on && race) { s.o = 3; s.x = race.me.x; s.v = race.me.v; if (race.net) { s.rp = Math.round(race.me.x * 10) / 10; s.rs = race.net.seq; } return s; }
  const pv = netParked(); if (pv) s.pv = [cur, Math.round(pv.x * 100) / 100, Math.round(pv.z * 100) / 100, Math.round(pv.heading * 1000) / 1000]; // 第 22 批：停著的車（我在哪裡都送）
  if (DRIVE.on && trip && indoor && indoor.kind === 'police' && walker && walker.mode !== 'off') { const t = walker.telemetry(); s.o = 4; s.x = t.x; s.z = t.z; s.h = t.heading; s.v = t.speed; return s; } // 第 22 批：在警察局裡面（關在拘留室也是）
  if (!netWorld() || (HOME.in && !(GUEST.uid && !GAR.floor)) || (GV.in && GAR.floor)) return s; // 在自己車庫裡面：朋友看不到（名單寫「在車庫」）；第 23 批：有朋友來我家、我在一樓＝看得到；我在朋友家樓上＝不送（高度對不起來）
  if (walker && walker.mode !== 'off' && walker.mode !== 'seat') {
    const t = walker.telemetry(); s.o = 2; s.x = t.x; s.z = t.z; s.h = t.heading; s.v = t.speed;
    const p = borParked(); if (p) { s.pk = [cur, Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100, Math.round(p.heading * 1000) / 1000]; s.pv = null; } // 第 19 批：下車停著的車（朋友看得到、借得到）
  }
  else if (drv) { const t = drv.telemetry(); s.o = 1; s.x = t.x; s.z = t.z; s.h = t.heading; s.v = t.v; if (TRAMP.on) s.y = Math.round(PW.heightAt(t.x, t.z) * 100) / 100; } // 第 24 批：開在斜坡上送高度
  if (s.o) s.pl = popSend(); // 跳燈
  if (R && R.ci && ciRace === R.ci) { s.rp = Math.round(R.ci.me.p * 10) / 10; s.rs = R.seq; }
  if (s.o && police && police.state === 'wanted' && police.enabled) { // 通緝中：幾顆星、200 公尺內追你的警車
    s.w = police.wanted; const nc = police.npcCars;
    for (let i = 0; i < nc.length && s.pn < 3; i++) { const q = nc[i]; if (q.x > 1e5 || (q.x - s.x) * (q.x - s.x) + (q.z - s.z) * (q.z - s.z) > 200 * 200) continue; s.pc[s.pn * 3] = q.x; s.pc[s.pn * 3 + 1] = q.z; s.pc[s.pn * 3 + 2] = q.heading; s.pi[s.pn] = i; s.pn++; }
  }
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

// 第 17 批（Nick 2026-10-13「所有人都在車庫街有個固定位置 不管有沒有連線」）：第一次進入世界拿到的號碼就是你家，記在存檔（沒連線也住那間）
function netHomeKeep() { if (NET.slot >= 0 && NET.slot < 6 && !Number.isInteger(GAME.home)) { GAME.home = NET.slot; save(true); } }

// ---- 網站叫的 ----
Object.assign(window.beauGame, {
  net: {
    join(o) {
      if (!o || !o.code || !o.me) return;
      NET.on = true; NET.doneSeq = 0; NET.slot = Number.isInteger(o.slot) ? o.slot : -1; NET.code = String(o.code); NET.me = String(o.me); NET.host = String(o.host || ''); NET.myName = String(o.name || '').slice(0, 12);
      netHomeKeep();
      netHud();
    },
    leave() {
      borOff(); // 第 19 批：借來的還、借出去的拿回來
      gvEnd('leave'); netGuest(null); BELL.uid = ''; // 第 23 批：在朋友家＝出來；朋友在我家＝收掉那一條
      netRaceEnd(); netUninvite(); if (NET.goal) { NET.goal = null; if (tripDest === 'friend') setDest(null); }
      NET.on = false; NET.code = ''; NET.mem = []; NET.slot = -1; netGstOff();
      for (const P of [...NET.P.values()]) netDropPeer(P);
      for (const k of NET_POL.cars) k.group.visible = false;
      drv?.removeColliders('net'); walker?.removeColliders('net');
      netCell(false, false); NET_PH.n = 0; NET_PH.out = null;
      if (NET.hud) { NET.hud.root.hidden = true; NET.hud.rc.hidden = true; NET.hud.res.hidden = true; NET.hud.quit.hidden = true; }
    },
    host(uid) { NET.host = String(uid || ''); },
    slot(n) { NET.slot = Number.isInteger(n) ? n : -1; netHomeKeep(); }, // 世界的號碼（斷線再進來可能換）：車庫街你那間
    home: () => (Number.isInteger(GAME.home) ? GAME.home : null), // 第 17 批：你固定的那間（網站拿位子的時候先試這個號碼）
    members(list) {
      if (!NET.on || !Array.isArray(list)) return;
      const keep = new Set();
      NET.mem = list.filter((m) => m && m.uid && m.uid !== NET.me).slice(0, NET_MAX);
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
      const e = { t: s.t, x: +s.x || 0, z: +s.z || 0, h: +s.h || 0, v: +s.v || 0, y: Number.isFinite(s.y) && Math.abs(s.y) < 500 ? +s.y : null, rp: typeof s.rp === 'number' ? s.rp : null, // y：第 24 批，他開在斜坡上
        pc: Array.isArray(s.pc) && s.pc.length <= 9 && s.pc.length % 3 === 0 && s.pc.every(Number.isFinite) ? s.pc : null, pi: null };
      if (e.pc && Array.isArray(s.pi) && s.pi.length * 3 === e.pc.length && s.pi.every((v) => Number.isInteger(v) && v >= 0 && v < 8)) e.pi = s.pi; // 第 22 批：第幾台警車
      if (!P.last) P.jlSeen = s.jl ? 1 : 0; // 進世界的時候他已經被關了：不用跳「被抓走了」
      if (((s.o | 0) === 4) !== (P.cur.o === 4)) b.length = 0; // 第 22 批：走進、走出警察局（裡面、外面的座標不一樣）：不要滑過去
      b.push(e); if (b.length > 16) b.shift();
      const c = P.cur; c.t = s.t; c.x = e.x; c.z = e.z; c.h = e.h; c.v = e.v; c.o = s.o | 0; c.k = typeof s.k === 'string' ? s.k : ''; c.rp = e.rp; c.rs = s.rs | 0; c.w = Math.max(0, Math.min(3, s.w | 0)); c.jl = s.jl ? 1 : 0;
      c.pl = s.pl === 1 ? 1 : 0; // 跳燈
      const pk = s.pk; c.pk = Array.isArray(pk) && pk.length === 4 && typeof pk[0] === 'string' && CARS[pk[0]] && [pk[1], pk[2], pk[3]].every(Number.isFinite) ? pk : null; // 第 19 批：他停著的車
      const pv = s.pv; c.pv = Array.isArray(pv) && pv.length === 4 && typeof pv[0] === 'string' && CARS[pv[0]] && [pv[1], pv[2], pv[3]].every(Number.isFinite) ? pv : null; // 第 22 批：他停著的車（他在哪裡都有）
      const ph = s.ph; // 第 22 批：他撞到追我的警車
      if (Array.isArray(ph) && ph.length === 5 && ph[0] === NET.me && ph[4] !== P.phSeen) { P.phSeen = ph[4]; if (Number.isInteger(ph[1]) && Number.isFinite(ph[2]) && Number.isFinite(ph[3]) && netNow() - s.t < 3000) netPolBumped(P, ph[1], ph[2], ph[3]); }
      P.last = netNow();
      if (c.o !== 1 && c.o !== 2 && c.o !== 4) b.length = 0; // 不在外面（也不在警察局裡面）：下次出來不要從舊的位置滑過去
    },
    emote: netEmote,
    clock(off) { NET.off = +off || 0; },
    state: netState,
    look: () => ({ car: cur, l: { ...CARS[cur].state }, ch: GAME.look || null }),
    garage: () => ({ cur, cars: Object.fromEntries([...GAME.owned].filter((k) => CARS[k]).map((k) => [k, { ...CARS[k].state }])), // 第 23 批：tw＝圓塔 40 格停哪台（'gc8,,supra,…'）、tr＝獎盃（朋友開進來看得到）
      tw: (Array.isArray(GAME.park?.tower) ? GAME.park.tower : []).map((k) => (typeof k === 'string' && GAME.owned.has(k) ? k : '')).join(','), tr: trophyCount() }),
    race: netRace,
    results: netResults,
    end() { netRaceEnd(); }, // 對方走了、對方按「回去開車」：這一場收掉
    invite: netInvite,
    say: netSay, // 遊戲右邊那一塊寫一句話（「對方已經取消了」）
    uninvite: netUninvite,
    goTo: netGoTo,
    // 第 19 批：借車。key() → 我的密碼（4 個數字；沒有就給一組）；setKey(c) → true／false
    key: borKey,
    setKey(c) { c = String(c ?? ''); if (!/^[0-9]{4}$/.test(c)) return false; GAME.key = c; save(true); return true; },
    borrowAns: borAnswer, // 車主的回答 { uid（車主）, ok, k, l, pt, ty, x, z, h, left, wait }
    lendCheck: borLendInfo, // 可以借嗎 → { k, l, pt, ty, x, z, h } | null
    lend: borLend, // (uid, 名字) → true／false：借出去了
    unlend(p) { borUnlend(p && [p.x, p.z, p.h].every(Number.isFinite) ? { x: p.x, z: p.z, heading: p.h } : null); }, // 還回來了（停在哪裡；null＝原本停的地方）
    borrowing: () => !!(BOR.on || BOR.want || BOR.loading),
    lent: () => (BOR.lent ? { uid: BOR.lent.uid, k: BOR.lent.k } : null),
    bellAns: netBellAns, // 第 23 批：門鈴的回答
    visitEnd(why) { gvEnd(why === 'kick' ? 'kick' : 'gone'); }, // 他請你出去／他走了
    guest: netGuest, // 朋友在我的車庫裡（null＝走了）
    place: netPlace,
    where: () => (RACE.on && !trip ? 'race' : trip ? 'out' : 'garage'),
    get info() { return { on: NET.on, code: NET.code, peers: [...NET.P.values()].map((P) => ({ uid: P.uid, n: P.n, vis: P.vis, o: P.cur.o, pk: P.cur.pk ? P.cur.pk[0] : null, pv: P.cur.pv ? P.cur.pv[0] : null, park: !!P.pkOn, carVis: !!(P.obj && P.obj.car.visible), inPol: !!(P.chr && P.chr.group.visible && PSC && P.chr.group.parent === PSC), car: !!P.obj, paint: P.obj ? P.objPaint : null, walk: !!P.chr, w: P.cur.w, jl: P.cur.jl, tagW: P.tagW })), pol: NET_POL.n, polHits: NET_POL.hits, phSent: NET_PH.sent, bumped: NET.bumped, cellShut: NET.cellShut, race: NET.race && { seq: NET.race.seq, kind: NET.race.kind, phase: NET.race.phase, go: NET.race.go, runAt: NET.race.runAt || 0, runGap: NET.race.runGap || 0, myT: NET.race.myT, res: { ...NET.race.res } }, marks: NET.marks.filter((m) => m.on).length, bor: { on: BOR.on && { uid: BOR.on.uid, k: BOR.on.k }, want: !!BOR.want, loading: !!BOR.loading, lent: BOR.lent && { uid: BOR.lent.uid, k: BOR.lent.k }, near: BOR.near ? BOR.near.uid : null, pad: BOR.pad && { uid: BOR.pad.uid, state: BOR.pad.state, lock: BOR.pad.lockT > performance.now() }, msg: BOR.ui ? BOR.ui.msg.textContent : '', bar: BOR.ui && !BOR.ui.bar.hidden ? BOR.ui.barT.textContent : '' }, cols: NET.cols.length, gst: NET_GST.own.map((o) => (o ? o.n : null)), gstAt: NET_GST.at,
      gstBtn: NET.hud && !NET.hud.gar.hidden ? NET.hud.gar.textContent : '', bell: BELL.uid || null, guest: GUEST.uid || null, guestBar: GUEST.ui && !GUEST.ui.bar.hidden ? GUEST.ui.t.textContent : '',
      gv: GV.on ? { uid: GV.uid, n: GV.n, slot: GV.slot, in: GV.in, want: GV.want.filter(Boolean).length, made: Object.keys(GV.objs).length, gs: HOME.gs, home: HOME.slot } : null }; },
  },
  visit: netVisit,
});
// Object.assign 會把 getter 當下的值抄過去，所以這個要用 defineProperty
Object.defineProperty(window.beauGame, 'visiting', { configurable: true, get: () => (NV ? { car: NV.key(), loaded: !!NV.car } : null) });
