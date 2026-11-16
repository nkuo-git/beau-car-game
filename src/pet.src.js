// ==== 第 95 批：寵物＋不會被抓（Nick 2026-11-15「可以開槍掃射對方或揍跟撞對方 但不會被抓 / 可以花重金買寵物 / 寵物是那三隻 / 他會一直跟著你 可以幫你打警察或人 /
//      你開車可以讓寵物騎沙灘車跟在你後面」；mock https://claude.ai/artifact/JiamLyxU1TobxZU6T6cgko ，2026-11-16 卡片選「照這樣做」、「做好就上線」）====
// 1 🚓 抓／不抓：「⋯」那一排一顆（每支手機自己記 localStorage carid.cops；'off'＝不抓）：police-ai setLenient → 什麼都不算犯罪、有星星的話清掉、警察不追你
// 2 大便龍寵物店（petshop.js：大停車場西邊、以前的稻田）：走進去（黑掉換場景，跟槍店一樣）站到圓台前面「買 · 小豬 200 萬」
//   小豬 200、粉紅 200、變色龍 300（萬；第 96 批以前 2000、2000、3000）；存檔 GAME.pets（買了哪幾隻）、GAME.pet（帶出門的那一隻）
// 3 跟著你：走路的時候踩著你走過的路（每 0.25 公尺一個點）走在你後面 1.3 公尺（跑步 1.8）；你跳牠也跳；進房子、坐捷運（walker.shift 一起搬）、回家都跟著；
//   跳太遠（換場景、傳送、電梯、樓梯換層）＝直接站到你腳邊
// 4 幫你打：你揍到人、開槍打到人（警察也算），牠衝過去撲倒對方；「揍」下面「🐾 上」：撲你前面最近的人或警察。小孩、路上的小動物永遠不撲；
//   被撲的人倒下去再爬起來（npc.js knock，沒有血）；警察倒下 2.4 秒（police-ai knockCop）；牠撲的不算你犯罪
// 5 開車：牠戴安全帽騎一台沙灘車（Z2 的輕量車，顏色照那一隻）踩著你的車開過的路跟在後面（6 公尺＋速度 × 0.35）；前面有人就停；被甩掉 220 公尺＝從後面 70 公尺追上來；
//   你下車：牠停好跳下來跑到你旁邊；你上車：牠坐回沙灘車
// 6 圓塔一樓大廳：沒帶出門的寵物在地毯、獎盃櫃前面走來走去（車庫頁也看得到全部的）；走過去「🐾 帶小豬出門」換一隻
// 接在 mart.src.js 後面（同一個 module）；town.src.js：atDoor 的 'petshop'、driveStep 的 psStep／petStep、homeWalk 的 petLobbyAct、doPunch／槍的 onCrime 叫 petHit／petCrime、walkBtns 多 🐾 上
const PET_NAME = { pig: '小豬', pinky: '粉紅', cham: '變色龍' };
const PET_PRICE = { pig: 200, pinky: 200, cham: 300 }; // 跟 petshop.js PET_KINDS 一樣
const PET_PAINT = { pig: '#f4a9bd', pinky: '#ff5fa2', cham: '#7d55d6' }; // 沙灘車的顏色（照那一隻）
const ATV_SC = { pig: 0.75, pinky: 0.75, cham: 1 }, atvS = (k) => ATV_SC[k] || 0.75; // 沙灘車的大小：小豬、粉紅只有人的一半高＝兒童的沙灘車；變色龍 2 公尺長＝原本那台
const PET_RIDE = { pig: [-0.30, 0.875, 0], pinky: [-0.32, 0.835, 0], cham: [-0.25, 0.62, 0] }; // 坐在沙灘車上：動物的原點放在沙灘車本地（沒縮小的）哪裡（座椅上面 0.88）
const PET_HELM_COL = { pig: '#ff7a1a', pinky: '#2f8cff', cham: '#ffd21a' }; // 安全帽的顏色（跟動物不一樣才看得出來）
const PET_HELM = { // 安全帽：頭的骨頭本地座標的中心、三個半徑、往後仰（量 animals.js 的頭：小豬 0.42 公尺的骨頭、頭頂 0.75；粉紅 0.55、0.77；變色龍 0.63／x 0.48、0.92）
  pig: { c: [-0.005, 0.225, 0], r: [0.212, 0.15, 0.232], tilt: 0.22 },
  pinky: { c: [0.0, 0.14, 0], r: [0.146, 0.11, 0.142], tilt: 0.18 },
  cham: { c: [0.13, 0.15, 0], r: [0.19, 0.15, 0.17], tilt: 0.3 },
};
const COPS_KEY = 'carid.cops';
let copsOff = (() => { try { return localStorage.getItem(COPS_KEY) === 'off'; } catch { return false; } })();
const PT = { x: 0, y: 0, z: 0, hx: 1, hz: 0 }, PT2 = { x: 0, y: 0, z: 0, hx: 1, hz: 0 }; // trAt 的輸出（每一格重複用）

// ---- 走過的路（環狀陣列）：x、y（腳下的地面）、z、s（從頭算走了幾公尺）；最新的那一點後面接「現在的位置」（live）----
function petTrail(N, step) { return { N, step, X: new Float64Array(N), Y: new Float64Array(N), Z: new Float64Array(N), S: new Float64Array(N), h: 0, n: 0, lx: 0, ly: 0, lz: 0, ls: 0 }; }
function trReset(T, x, y, z) { T.h = 0; T.n = 1; T.X[0] = x; T.Y[0] = y; T.Z[0] = z; T.S[0] = 0; T.lx = x; T.ly = y; T.lz = z; T.ls = 0; }
function trPush(T, x, y, z) { // 走到離最新的點 step 以上就記一點；live＝現在的位置
  const h = T.h, d = Math.hypot(x - T.X[h], z - T.Z[h]);
  if (d >= T.step) { const i = (h + 1) % T.N; T.X[i] = x; T.Y[i] = y; T.Z[i] = z; T.S[i] = T.S[h] + d; T.h = i; if (T.n < T.N) T.n++; T.lx = x; T.ly = y; T.lz = z; T.ls = T.S[i]; return; }
  T.lx = x; T.ly = y; T.lz = z; T.ls = T.S[h] + d;
}
const trI = (T, k) => (T.h - (T.n - 1) + k + T.N) % T.N; // 第 k 個（0＝最舊）
const trS0 = (T) => T.S[trI(T, 0)];
function trAt(T, s, o) { // s 那一點（線性內插；最新的點後面接 live）；o.hx／hz＝那一段的方向
  const h = T.h;
  if (s >= T.S[h]) {
    const L = T.ls - T.S[h], t = L > 1e-6 ? Math.min(1, (s - T.S[h]) / L) : 1;
    o.x = T.X[h] + (T.lx - T.X[h]) * t; o.y = T.Y[h] + (T.ly - T.Y[h]) * t; o.z = T.Z[h] + (T.lz - T.Z[h]) * t;
    if (L > 0.05) { o.hx = T.lx - T.X[h]; o.hz = T.lz - T.Z[h]; } else if (T.n > 1) { const p = trI(T, T.n - 2); o.hx = T.X[h] - T.X[p]; o.hz = T.Z[h] - T.Z[p]; }
    return o;
  }
  let lo = 0, hi = T.n - 1;
  if (s <= T.S[trI(T, 0)]) { const a = trI(T, 0); o.x = T.X[a]; o.y = T.Y[a]; o.z = T.Z[a]; if (T.n > 1) { const b = trI(T, 1); o.hx = T.X[b] - T.X[a]; o.hz = T.Z[b] - T.Z[a]; } return o; }
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T.S[trI(T, m)] <= s) lo = m; else hi = m; }
  const a = trI(T, lo), b = trI(T, hi), t = (s - T.S[a]) / Math.max(1e-6, T.S[b] - T.S[a]);
  o.x = T.X[a] + (T.X[b] - T.X[a]) * t; o.y = T.Y[a] + (T.Y[b] - T.Y[a]) * t; o.z = T.Z[a] + (T.Z[b] - T.Z[a]) * t; o.hx = T.X[b] - T.X[a]; o.hz = T.Z[b] - T.Z[a];
  return o;
}
function trShift(T, dx, dz, dth, px, pz) { // 腳下的地板動了（捷運）：整條路跟著搬（剛體：繞你原本站的地方轉 dth、再搬 dx dz）
  const c = Math.cos(dth || 0), s = Math.sin(dth || 0), nx = px + dx, nz = pz + dz;
  for (let k = 0; k < T.n; k++) { const i = trI(T, k), x = T.X[i] - px, z = T.Z[i] - pz; T.X[i] = nx + x * c + z * s; T.Z[i] = nz - x * s + z * c; }
  const x = T.lx - px, z = T.lz - pz; T.lx = nx + x * c + z * s; T.lz = nz - x * s + z * c;
}
const petAng = (a) => { a = (a + Math.PI) % (Math.PI * 2); return a < 0 ? a + Math.PI : a - Math.PI; };
const petTurn = (a, b, r) => { const d = petAng(b - a); return a + (Math.abs(d) <= r ? d : Math.sign(d) * r); };

// ---- 寵物的狀態 ----
const PET = {
  k: '', C: null, tag: null, scene: null, mode: 'hide', x: 0, y: 0, z: 0, th: 0, v: 0, s: 0, jy: 0, vy: 0, hop: -1, lj: 0, angry: 0, ready: false,
  T: petTrail(200, 0.25), lpx: 0, lpz: 0, lgy: 0, atk: null, helm: {}, helmMat: null, onAtv: false, sig: '', btn: false, fb: 0,
  A: { k: '', car: null, data: null, loading: false, x: 0, y: 0, z: 0, th: 0, v: 0, s: 0, vc: 0, pitch: 0, placed: false, pend: true, free: false, T: petTrail(640, 0.6), lcx: 0, lcy: 0, lcz: 0, chk: 0, look: null },
};
const PET_UP = { speed: 0, state: 'idle' };
function petName(k) { return PET_NAME[k] || '寵物'; }
function petWithMe() { return !!(GAME.pet && GAME.pets?.includes(GAME.pet)); }

// 名牌（頭上「🐾 小豬」：路上也有一樣的小動物，看得出哪一隻是你的）
function petTag(k) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(12,18,26,0.72)'; const r = 30; g.beginPath(); g.roundRect ? g.roundRect(4, 4, 248, 56, r) : g.rect(4, 4, 248, 56); g.fill();
  g.fillStyle = '#ffffff'; g.font = '700 34px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`🐾 ${petName(k)}`, 128, 34);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(0.8, 0.2, 1); sp.name = 'pet-tag'; sp.renderOrder = 3;
  return sp;
}
// 安全帽：一個半球（白色、中間一條那一隻的顏色、前面下緣黑色的帽簷），掛在頭的骨頭上；每一種做一次
function petHelmet(k) {
  if (PET.helm[k]) return PET.helm[k];
  const H = PET_HELM[k], geo = new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const P = geo.attributes.position, cols = new Float32Array(P.count * 3), shell = new THREE.Color(PET_HELM_COL[k] || '#ff7a1a'), white = new THREE.Color('#f6f6f2'), dark = new THREE.Color('#25282e');
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i), z = P.getZ(i), c = y < 0.16 ? dark : Math.abs(z) < 0.16 ? white : shell; // 下緣一圈深色、中間一條白的
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  if (!PET.helmMat) PET.helmMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.05, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, PET.helmMat); m.name = 'pet-helmet';
  m.position.set(H.c[0], H.c[1], H.c[2]); m.scale.set(H.r[0], H.r[1], H.r[2]); m.rotation.z = H.tilt;
  return (PET.helm[k] = m);
}
// 這一隻（換了就重做）
function petMake(k) {
  if (PET.C && PET.k === k) return PET.C;
  petDrop();
  let C = null; try { C = buildAnimal({ animal: k }); } catch (e) { console.error(e); return null; }
  C.group.name = 'pet-' + k;
  PET.tag = petTag(k); PET.tag.position.set(k === 'cham' ? 0.3 : 0, (C.height || 0.8) + 0.32, 0); C.group.add(PET.tag);
  PET.C = C; PET.k = k; PET.ready = false; PET.mode = 'hide';
  atvEnsure(k); // 沙灘車先載（上車的時候才不會等）
  return C;
}
function petDrop() {
  if (!PET.C) return;
  const hm = PET.helm[PET.k]; if (hm) hm.removeFromParent();
  if (PET.tag) { PET.tag.material.map?.dispose(); PET.tag.material.dispose(); PET.tag = null; }
  PET.C.dispose(); PET.C = null; PET.k = ''; PET.onAtv = false; PET.atk = null;
}
const petRoot = (o) => { while (o && o.parent) o = o.parent; return o; };

// ---- 沙灘車（Z2 的輕量車，顏色照那一隻；載一次留著）----
function atvEnsure(k) {
  const A = PET.A;
  if (A.car && A.k === k) return true;
  if (!LOD_CARS.z2) return false;
  if (A.data) {
    if (A.car) { A.car.removeFromParent(); A.look?.dispose?.(); }
    try { const L = buildLodCar('z2', A.data, { ...DEFAULT_LOOK.z2, paint: PET_PAINT[k] || DEFAULT_LOOK.z2.paint }); A.look = L; A.car = L.car; A.car.name = 'pet-atv'; A.car.visible = false; A.car.scale.setScalar(atvS(k)); A.k = k; } catch (e) { console.error(e); A.car = null; return false; }
    return true;
  }
  if (!A.loading) { A.loading = true; LOD_CARS.z2.load().then((d) => { A.data = d; A.loading = false; }).catch((e) => { console.error(e); A.loading = false; }); }
  return false;
}

// ---- 出門、回家 ----
function petTripStart() { // enterDrive 做好以後：沒有寵物就什麼都不做；沙灘車先載
  police?.setLenient(copsOff); copSync();
  PET.mode = 'hide'; PET.atk = null; PET.A.placed = false; PET.A.pend = true;
  if (petWithMe()) { petMake(GAME.pet); atvEnsure(GAME.pet); }
  petBtns();
}
function petHide() {
  if (PET.C) PET.C.group.visible = false;
  if (PET.A.car) PET.A.car.visible = false;
  PET.mode = 'hide'; PET.atk = null;
}
function petTripEnd() { // leaveDrive、比賽：收起來（下次出門重新放）
  petHide();
  if (PET.C) PET.C.group.removeFromParent();
  if (PET.A.car) PET.A.car.removeFromParent();
  PET.A.placed = false; PET.A.pend = true;
  for (const L of LOBBY) L.C.group.visible = false;
}
// 寵物現在在做什麼：hide（不在外面、比賽、被抓、坐電梯）／car（你在車上：牠騎沙灘車）／walk（你在走路：跟著）
function petModeNow() {
  if (!trip || !DRIVE.on || !walker || !petWithMe() || polRace.on || jailed() || (typeof RACE !== 'undefined' && RACE.on)) return 'hide';
  if (EL.ride) return 'hide'; // 坐電梯：到了再出現（你腳邊／沙灘車從後面追上來）
  if (walker.mode === 'seat') return 'car';
  if (walker.mode === 'off' && !sleep && !doorFade && !gsDesk) return 'car';
  return 'walk';
}
function petCarObj() { if (HOP.on) return (HOP.car || HOP.lodS)?.car || null; return tripS?.car || null; }

// 每一格（driveStep：seatsStep、martStep 後面）
function petStep(dt) {
  lobbyStep(dt);
  if (!PET.C) { if (petWithMe() && trip && DRIVE.on) petMake(GAME.pet); else return; }
  if (PET.k !== GAME.pet && petWithMe()) petMake(GAME.pet);
  const m = petModeNow();
  if (m === 'hide') { if (PET.mode !== 'hide') petHide(); return; }
  if (m === 'car') {
    if (!atvEnsure(PET.k)) { PET.C.group.visible = false; PET.mode = 'wait'; return; } // 沙灘車還在載
    if (PET.mode !== 'car') petMount();
    petCarStep(dt);
  } else {
    if (PET.mode !== 'walk') petDismount(PET.mode);
    petWalkStep(dt);
  }
}
// 走路：踩著你走過的路跟在後面
function petReset(px, gy, pz, th) { // 站到你腳邊（後面 0.35 公尺），路從這裡重新記
  const P = PET; P.x = px - Math.cos(th) * 0.35; P.z = pz + Math.sin(th) * 0.35; P.y = gy; P.th = th; P.v = 0; P.jy = 0; P.vy = 0; P.atk = null;
  trReset(P.T, P.x, gy, P.z); P.s = 0; trPush(P.T, px, gy, pz);
}
function petDismount(was) {
  const P = PET, A = P.A, ch = walker.character.group, sc = petRoot(ch);
  const hm = P.helm[P.k]; if (hm) hm.removeFromParent();
  P.C.group.scale.setScalar(1);
  P.onAtv = false; P.mode = 'walk'; P.atk = null; P.angry = 0;
  sc.add(P.C.group); P.scene = sc; P.C.group.visible = true;
  const t = walker.telemetry(), gy = ch.position.y - (t.jy || 0);
  P.lpx = ch.position.x; P.lpz = ch.position.z; P.lgy = gy; P.lj = t.jumps || 0;
  if (was === 'car' && A.car && A.car.visible && Math.hypot(A.x - ch.position.x, A.z - ch.position.z) < 15) { // 從沙灘車上跳下來（停好的沙灘車留著）
    const s = PET_RIDE[P.k], c = Math.cos(A.th), n = Math.sin(A.th);
    P.x = A.x + c * s[0] * atvS(P.k) + 0.55 * n; P.z = A.z - n * s[0] * atvS(P.k) + 0.55 * c; P.y = A.y; P.th = A.th; P.jy = s[1] * atvS(P.k); P.vy = 1.6; P.v = 0;
    trReset(P.T, P.x, A.y, P.z); P.s = 0; trPush(P.T, ch.position.x, gy, ch.position.z);
  } else petReset(ch.position.x, gy, ch.position.z, t.heading);
  A.v = 0;
}
function petWalkStep(dt) {
  const P = PET, C = P.C, T = P.T, ch = walker.character.group, sc = petRoot(ch), t = walker.telemetry();
  const px = ch.position.x, pz = ch.position.z, gy = ch.position.y - (t.jy || 0);
  if (sc !== P.scene) { sc.add(C.group); P.scene = sc; petReset(px, gy, pz, t.heading); }
  else if (Math.hypot(px - P.lpx, pz - P.lpz) > 4 || Math.abs(gy - P.lgy) > 1.5 || Math.hypot(px - P.x, pz - P.z) > 10) petReset(px, gy, pz, t.heading); // 傳送、樓梯換層、被甩太遠
  else if (Math.abs(gy - P.lgy) > 0.002 && Math.hypot(px - P.lpx, pz - P.lpz) < 0.004 && !(t.jy > 0)) { for (let k = 0; k < T.n; k++) T.Y[trI(T, k)] += gy - P.lgy; } // 站著不動、地板在動（電扶梯、升降）：路一起升降
  P.lpx = px; P.lpz = pz; P.lgy = gy;
  C.group.visible = true;
  trPush(T, px, gy, pz);
  if ((t.jumps || 0) > P.lj) { P.lj = t.jumps; if (P.hop < 0 && P.jy <= 0) P.hop = 0.12; } // 你跳牠也跳（晚一點點）
  if (P.hop >= 0) { P.hop -= dt; if (P.hop < 0) { P.hop = -1; if (P.jy <= 0) P.vy = 3.2; } }
  let state = 'idle', spd = 0;
  if (P.atk) { const r = petAtkStep(dt, px, gy, pz); state = r; spd = P.v; }
  else {
    const gap = t.running ? 1.8 : 1.3, d = Math.hypot(px - P.x, pz - P.z);
    if (d < gap * 0.9 && T.ls - P.s > gap * 2.2) { trReset(T, P.x, P.y, P.z); P.s = 0; trPush(T, px, gy, pz); } // 你繞回來了：不用走完那一圈
    const rem = T.ls - P.s - gap;
    const want = d > gap * 0.92 && rem > 0 ? Math.min(6.2, rem * 2.4 + Math.min(t.speed || 0, 4.6) * 0.6) : 0;
    P.v += (want - P.v) * Math.min(1, dt * 6);
    if (P.v < 0.02 && want === 0) P.v = 0;
    P.s = Math.min(P.s + P.v * dt, T.ls - gap * 0.6);
    trAt(T, P.s, PT); P.x = PT.x; P.z = PT.z; P.y = PT.y;
    if (P.v > 0.05 && (PT.hx || PT.hz)) P.th = petTurn(P.th, Math.atan2(-PT.hz, PT.hx), 9 * dt);
    else if (d > 0.4) P.th = petTurn(P.th, Math.atan2(-(pz - P.z), px - P.x), 3 * dt);
    spd = P.v; state = P.v < 0.05 ? 'idle' : P.v < 2.2 ? 'walk' : 'run';
  }
  if (P.angry > 0) { P.angry -= dt; state = 'wave'; spd = 0; }
  if (P.jy > 0 || P.vy > 0) { P.vy -= 11 * dt; P.jy += P.vy * dt; if (P.jy <= 0) { P.jy = 0; P.vy = 0; } }
  C.group.position.set(P.x, P.y + P.jy, P.z); C.group.rotation.set(0, P.th, 0);
  PET_UP.speed = spd; PET_UP.state = state; C.update(dt, PET_UP);
}

// ---- 幫你打 ----
const petPedOK = (p) => p && p.active && !p.gone && p.age !== 'kid' && !p.animal && p.mode !== 'sit' && p.mode !== 'enter' && p.mode !== 'dive'; // 小孩、路上的小動物永遠不撲
const petPedDown = (p) => p.down || p.mode === 'fall' || p.mode === 'lie' || p.mode === 'getup';
const petOutside = () => !indoor && !APTU.on && !LDR.on && !MRTS.lvl;
function petCanFight() { return PET.mode === 'walk' && PET.C && !PET.atk && walker?.mode === 'walk' && petOutside() && !sleep && !doorFade; }
function petAttack(o, cop) {
  if (!petCanFight() || !o) return false;
  if (Math.hypot(o.x - PET.x, o.z - PET.z) > 18) return false;
  PET.atk = { o, cop: !!cop, t: 0, hit: false, end: 0 };
  return true;
}
function petHit(o) { // doPunch 揍到的（警察有 st、人有 age）
  if (!o) return;
  if (o.st !== undefined && o.age === undefined) petAttack(o, true);
  else if (petPedOK(o)) petAttack(o, false);
}
function petNear(x, z, r, cops, peds, standing, fx, fz) { // 最近的（前面的算近一點：後面的距離 × 2.2）
  let best = null, bd = Infinity, cop = false;
  if (cops && police) for (const f of police.offs || []) {
    if (!police.copUp(f)) continue;
    const dx = f.x - x, dz = f.z - z, d = Math.hypot(dx, dz); if (d > r) continue;
    const sc = fx == null || dx * fx + dz * fz >= 0 ? d : d * 2.2; if (sc < bd) { bd = sc; best = f; cop = true; }
  }
  if (peds && NPC) for (const p of NPC.peds.people) {
    if (!petPedOK(p) || (standing && petPedDown(p))) continue;
    const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz); if (d > r) continue;
    const sc = fx == null || dx * fx + dz * fz >= 0 ? d : d * 2.2; if (sc < bd) { bd = sc; best = p; cop = false; }
  }
  return best ? { o: best, cop } : null;
}
function petCrime(kind, info) { // 槍：打到人／警察＝撲打到的那一個；附近有警察開槍＝撲最近的警察
  if (!petCanFight() || !info) return;
  const r = kind === 'gunfire' ? petNear(walker.character.group.position.x, walker.character.group.position.z, 30, true, false, true) : kind === 'shoot' || kind === 'shootCop' ? petNear(info.x, info.z, 4, true, true, false) : null;
  if (r) petAttack(r.o, r.cop);
}
function petGo() { // 「🐾 上」
  if (!PET.C || PET.mode !== 'walk') return;
  if (!petOutside()) { walker.toast(`${petName(PET.k)}：這裡沒有人可以撲`, 1400); return; }
  if (PET.atk) return;
  const t = walker.telemetry(), r = petNear(t.x, t.z, 14, true, true, true, Math.cos(t.heading), -Math.sin(t.heading));
  if (!r) { walker.toast('附近沒有人可以撲', 1400); return; }
  if (!petAttack(r.o, r.cop)) walker.toast(`${petName(PET.k)}跟不上了`, 1400);
}
function petAtkStep(dt, px, gy, pz) {
  const P = PET, g = P.atk, o = g.o; g.t += dt;
  const alive = g.cop ? o.on : o.active && !o.gone;
  if (g.hit) { if ((g.end -= dt) <= 0 || !alive) petAtkEnd(px, gy, pz); return 'wave'; }
  if (!alive || g.t > 6 || !petOutside()) { petAtkEnd(px, gy, pz); return 'idle'; }
  const dx = o.x - P.x, dz = o.z - P.z, d = Math.hypot(dx, dz);
  if (d < 0.85) { // 撲上去
    g.hit = true; g.end = 1.3; P.vy = 3.0; P.v = 0; P.angry = 1.3;
    if (g.cop) police?.knockCop(o, dx, dz);
    else if (NPC) { if (!petPedDown(o)) NPC.peds.knock(o, dx, dz, 3.5); NPC.peds.scare(o.x, o.z, 8); }
    return 'wave';
  }
  P.v = Math.min(6.8, P.v + dt * 14);
  const k = Math.min(1, (P.v * dt) / d); P.x += dx * k; P.z += dz * k;
  const h = PW?.heightAt ? PW.heightAt(P.x, P.z) : null; P.y = isFinite(h) ? h : gy;
  P.th = petTurn(P.th, Math.atan2(-dz, dx), 12 * dt);
  return 'run';
}
function petAtkEnd(px, gy, pz) { const P = PET; P.atk = null; trReset(P.T, P.x, P.y, P.z); P.s = 0; trPush(P.T, px, gy, pz); }

// ---- 開車：騎沙灘車跟著 ----
function petMount() {
  const P = PET, A = P.A, C = P.C, car = petCarObj();
  P.atk = null; P.angry = 0; P.mode = 'car'; P.onAtv = true;
  const sc = car ? petRoot(car) : TR.scene;
  if (A.car.parent !== sc) sc.add(A.car);
  if (!A.placed || Math.hypot(A.x - P.x, A.z - P.z) > 25 || !C.group.visible) { // 沙灘車在牠旁邊出現（沒放過、太遠、牠剛剛沒出現）
    if (C.group.visible && P.scene === sc) { A.x = P.x; A.y = P.y; A.z = P.z; A.th = P.th; A.placed = true; A.free = true; A.pend = false; }
    else { A.placed = false; A.pend = true; }
  } else { A.free = true; A.pend = false; }
  A.v = 0; A.chk = 0;
  if (car) { trReset(A.T, car.position.x, car.position.y, car.position.z); A.lcx = car.position.x; A.lcy = car.position.y; A.lcz = car.position.z; }
  A.car.add(C.group); const s = PET_RIDE[P.k]; C.group.position.set(s[0], s[1], s[2]); C.group.rotation.set(0, 0, 0); C.group.scale.setScalar(1 / atvS(P.k)); C.group.visible = true;
  C.B.head.add(petHelmet(P.k));
  A.car.visible = A.placed;
}
const ATV_MAXV = 31, ATV_PUSH = 3.4;
function petCarStep(dt) {
  const P = PET, A = P.A, T = A.T, car = petCarObj();
  if (!car) { A.car.visible = false; return; }
  const cx = car.position.x, cy = car.position.y, cz = car.position.z;
  if (Math.hypot(cx - A.lcx, cz - A.lcz) > 25 || Math.abs(cy - A.lcy) > 1.5) { trReset(T, cx, cy, cz); A.pend = true; A.placed = false; } // 車子傳送（去這裡、回家、電梯）：沙灘車等一下從後面追上來
  const vc = Math.hypot(cx - A.lcx, cz - A.lcz) / Math.max(dt, 1e-3); A.vc += (Math.min(vc, 90) - A.vc) * Math.min(1, dt * 4);
  A.lcx = cx; A.lcy = cy; A.lcz = cz;
  const sc = petRoot(car); if (A.car.parent !== sc) sc.add(A.car);
  trPush(T, cx, cy, cz);
  const gap = 6 + 0.35 * A.vc, sT = T.ls - gap;
  if (A.pend) { // 還沒出現：車子開了 gap＋1 公尺，沙灘車在後面那一點出現
    A.car.visible = false;
    if (T.ls - trS0(T) < gap + 1) return;
    A.pend = false; A.free = false; A.placed = true; A.s = sT; A.v = A.vc; trAt(T, A.s, PT); A.x = PT.x; A.y = PT.y; A.z = PT.z; A.th = Math.atan2(-PT.hz, PT.hx);
  }
  if (T.ls - A.s > 220 && !A.free) { A.s = T.ls - 70; A.v = Math.min(A.vc, ATV_MAXV); } // 甩掉了：從後面 70 公尺追上來
  // 前面有人（警察也算）：停
  let block = false;
  if (A.v > 0.5) {
    const fx = Math.cos(A.th), fz = -Math.sin(A.th);
    if (NPC) for (const p of NPC.peds.people) { if (!p.active || p.gone) continue; const dx = p.x - A.x, dz = p.z - A.z, f = dx * fx + dz * fz; if (f < 0.6 || f > 3.4) continue; if (Math.abs(dx * fz - dz * fx) < 1.2) { block = true; if (!p.dive) NPC.peds.scare(A.x, A.z, 4); break; } }
    if (!block && police?.nearCop(A.x + fx * 2, A.z + fz * 2, 1.6)) block = true;
  }
  let want;
  if (A.free) { trAt(T, Math.max(trS0(T), sT), PT2); const dx = PT2.x - A.x, dz = PT2.z - A.z, d = Math.hypot(dx, dz); want = d < 0.4 ? 0 : Math.min(ATV_MAXV, d * 1.6 + A.vc * 0.5); }
  else want = Math.max(0, Math.min(ATV_MAXV, A.vc + (sT - A.s) * 1.5));
  if (block) want = 0;
  const acc = want > A.v ? 7 : 12; A.v += Math.max(-acc * dt, Math.min(acc * dt, want - A.v));
  if (A.free) {
    const dx = PT2.x - A.x, dz = PT2.z - A.z, d = Math.hypot(dx, dz);
    if (d < 0.7 || d > 80) { A.free = false; A.s = Math.max(trS0(T), sT); if (d > 80) A.v = A.vc; trAt(T, A.s, PT); A.x = PT.x; A.y = PT.y; A.z = PT.z; } // 接上車子開過的路（太遠＝直接跳上去）
    else { const k = Math.min(1, (A.v * dt) / d); A.x += dx * k; A.z += dz * k; A.y += (PT2.y - A.y) * Math.min(1, dt * 5); if (A.v > 0.3) A.th = petTurn(A.th, Math.atan2(-dz, dx), 2.2 * dt); }
    A.pitch += (0 - A.pitch) * Math.min(1, dt * 4);
  } else {
    A.s = Math.min(A.s + A.v * dt, T.ls - 3);
    if (A.s < trS0(T)) A.s = trS0(T);
    trAt(T, A.s, PT); A.x = PT.x; A.y = PT.y; A.z = PT.z;
    if (PT.hx || PT.hz) A.th = petTurn(A.th, Math.atan2(-PT.hz, PT.hx), 4 * dt);
    trAt(T, A.s + 0.9, PT2); const y1 = PT2.y; trAt(T, A.s - 0.9, PT2); const sl = Math.atan2(y1 - PT2.y, 1.8);
    A.pitch += (sl - A.pitch) * Math.min(1, dt * 6);
    if ((A.chk -= dt) <= 0) { // 繞了一圈又經過這裡（倒車、迴轉）：直接接到後面那一段
      A.chk = 0.3;
      for (let k = T.n - 1; k >= 0; k--) { const i = trI(T, k); if (T.S[i] > sT) continue; if (T.S[i] <= A.s + 3) break; if (Math.hypot(T.X[i] - A.x, T.Z[i] - A.z) < 1) { A.s = T.S[i]; break; } }
    }
  }
  const dcx = A.x - cx, dcz = A.z - cz, dc = Math.hypot(dcx, dcz); // 車子倒過來：讓開
  if (dc < ATV_PUSH && dc > 1e-3) { A.x = cx + (dcx / dc) * ATV_PUSH; A.z = cz + (dcz / dc) * ATV_PUSH; A.v = 0; A.free = true; }
  A.car.visible = true; A.car.position.set(A.x, A.y, A.z); A.car.rotation.set(0, A.th, A.pitch);
  PET_UP.speed = 0; PET_UP.state = 'sit'; P.C.update(dt, PET_UP);
}

// ---- 走路右下角的「🐾 上」（「揍」下面；拿槍、被關的時候整排收起來）----
const PET_B = { id: 'pet', label: '🐾上', cls: 'pet', key: 'KeyP', onClick: () => petGo() };
function petBtns() { // 帶的寵物換了：右下角那一排重做
  const on = petWithMe();
  if (on === PET.btn || !walker) return;
  PET.btn = on;
  walker.setButtons(walkBtns(!(jailed() || gunner?.arms.cur)));
}

// ---- 大便龍寵物店（petshop.js 的 buildPetShopInterior：第一次走進去才蓋，蓋好留著；自己的場景）----
let PETSI = null, PETSC = null;
function enterPetShop(b) {
  let first = false;
  if (!PETSI) {
    try { PETSI = buildPetShopInterior({ makeAnimal: buildAnimal, makeCharacter: buildCharacter }); } catch (e) { console.error(e); PETSI = null; }
    if (!PETSI) return { say: '寵物店今天沒開' };
    PETSC = new THREE.Scene(); PETSC.name = 'petshop'; PETSC.background = PETSI.background; PETSC.add(PETSI.group);
    PETSI.exitsW = [{ ...PETSI.exitDoor, door: PETSI.doors[0] }];
    first = true;
  }
  indoor = { b, I: PETSI, scene: PETSC, t: 0, dist0: walker.cameraDist, folks: [], kind: 'petshop', keep: true, exits: PETSI.exitsW };
  PETSC.add(walker.character.group);
  walker.removeColliders('world'); walker.setCarReach(false);
  houseSet(PETSI.spawn);
  return { wait: first && renderer.compileAsync ? renderer.compileAsync(PETSC, dcam) : null, say: `${PETSI.name}：站到寵物前面按「買」` };
}
const PS_ACT = {};
function psAct(i) {
  const K = PET_KINDS[i]; if (!K) return null;
  const has = GAME.pets.includes(K.k), key = K.k + (has ? ':has' : '');
  return PS_ACT[key] || (PS_ACT[key] = has
    ? { label: `已經有${K.name}了`, icon: 'hand', onClick: () => walker.toast(GAME.pet === K.k ? `${K.name}跟著你` : `${K.name}在圓塔一樓大廳玩（走過去「🐾 帶${K.name}出門」）`, 2200) }
    : { label: `買 · ${K.name} ${K.price} 萬`, icon: 'hand', onClick: () => petBuy(K.k) });
}
function psStep(dt) {
  const t = walker.telemetry(); PETSI.update(dt, t);
  if (walker.mode !== 'walk') return;
  const z = PETSI.zoneAt(t.x, t.z);
  walker.setAction(z >= 0 ? psAct(z) : null);
}
function petBuy(k) {
  if (!PET_NAME[k] || GAME.pets.includes(k)) return;
  const price = PET_PRICE[k];
  if (GAME.money < price) { walker.toast(`錢不夠：${petName(k)}要 ${price} 萬`, 2000); return; }
  GAME.money -= price; GAME.pets.push(k);
  const had = GAME.pet; GAME.pet = k;
  save(true); renderWallet();
  PET.sig = ''; petBtns();
  walker.toast(had ? `買了${petName(k)}！牠跟著你，${petName(had)}回家在圓塔大廳等你` : `買了${petName(k)}！牠會一直跟著你`, 2600);
}

// ---- 圓塔一樓大廳的寵物（沒帶出門的；車庫頁是全部）：地毯、獎盃櫃前面走來走去（塔的本地座標：門在 +x、電梯圓台在中間）----
const LOBBY = [], PAGEP = [];
const LOBBY_R = [{ x0: -5.5, x1: 3.2, z0: 4.8, z1: 7.2 }, { x0: -9.2, x1: -4.8, z0: -3.6, z1: 3.6 }], LOBBY_W = [-5.0, 4.6]; // 南邊（沙發前面）、西邊（獎盃櫃前面）；兩塊中間走那一點
function lobbyPick(L) {
  const ri = Math.random() < 0.7 ? L.ri : 1 - L.ri, R = LOBBY_R[ri];
  L.tx = R.x0 + Math.random() * (R.x1 - R.x0); L.tz = R.z0 + Math.random() * (R.z1 - R.z0);
  L.via = ri !== L.ri; L.ri = ri; L.wait = 0;
}
function lobbyMake(list, k, parent, i) {
  let C = null; try { C = buildAnimal({ animal: k }); } catch (e) { console.error(e); return; }
  C.group.name = 'lobby-pet-' + k;
  const ri = i % 2, R = LOBBY_R[ri], L = { k, C, ri, x: (R.x0 + R.x1) / 2 + (i - 1) * 1.4, z: (R.z0 + R.z1) / 2, th: Math.random() * 6.28, tx: 0, tz: 0, via: false, wait: 1 + Math.random() * 3, sit: false, v: 0 };
  L.tx = L.x; L.tz = L.z;
  parent.add(C.group); list.push(L);
}
function lobbySync(list, keys, parent) { // 照名單重做（買了、換了才會變）
  const sig = keys.join(',') + '|' + (parent?.uuid || '');
  if (list.sig === sig) return; list.sig = sig;
  for (const L of list) L.C.dispose();
  list.length = 0;
  if (!parent) return;
  keys.forEach((k, i) => lobbyMake(list, k, parent, i));
}
function lobbyWalk(list, dt) {
  for (const L of list) {
    let st = 'idle', sp = 0;
    if (L.wait > 0) { L.wait -= dt; if (L.wait <= 0) { if (Math.random() < 0.3 && !L.sit) { L.sit = true; L.wait = 3 + Math.random() * 4; } else { L.sit = false; lobbyPick(L); } } st = L.sit ? 'sit' : 'idle'; L.v = 0; }
    else {
      const gx = L.via ? LOBBY_W[0] : L.tx, gz = L.via ? LOBBY_W[1] : L.tz, dx = gx - L.x, dz = gz - L.z, d = Math.hypot(dx, dz);
      if (d < 0.08) { if (L.via) L.via = false; else L.wait = 2 + Math.random() * 4; }
      else { L.v = Math.min(0.75, L.v + dt * 2); const k = Math.min(1, (L.v * dt) / d); L.x += dx * k; L.z += dz * k; L.th = petTurn(L.th, Math.atan2(-dz, dx), 4 * dt); st = 'walk'; sp = L.v; }
    }
    L.C.group.position.set(L.x, 0, L.z); L.C.group.rotation.set(0, L.th, 0);
    PET_UP.speed = sp; PET_UP.state = st; L.C.update(dt, PET_UP);
  }
}
function lobbyStep(dt) { // 村子裡你家的塔（GAR）：一樓大廳、離塔 45 公尺以內才動；在朋友家不畫
  if (!GAR) return;
  const keys = (GAME.pets || []).filter((k) => k !== GAME.pet);
  lobbySync(LOBBY, keys, GAR.group);
  if (!LOBBY.length) return;
  const me = walker && walker.mode !== 'off' ? walker.character.group.position : petCarObj()?.position, q = me ? garLocal(me.x, me.z) : null;
  const on = !!q && !GV.on && Math.hypot(q.x, q.z) < 45 && DRIVE.on && trip;
  for (const L of LOBBY) L.C.group.visible = on;
  if (on) lobbyWalk(LOBBY, dt);
}
function petLobbyAct(t) { // homeWalk（一樓大廳）：走到沒帶出門的那一隻旁邊「🐾 帶小豬出門」
  if (!LOBBY.length || GV.on || GAR.floor) return null;
  const q = garLocal(t.x, t.z);
  for (const L of LOBBY) if (Math.hypot(L.x - q.x, L.z - q.z) < 1.5) return L.act || (L.act = { label: `🐾 帶${petName(L.k)}出門`, icon: 'hand', onClick: () => petSwap(L.k) });
  return null;
}
function petSwap(k) {
  if (!GAME.pets.includes(k) || GAME.pet === k) return;
  const L = LOBBY.find((x) => x.k === k), old = GAME.pet, at = L ? { x: L.x, z: L.z, th: L.th } : null;
  GAME.pet = k; save(true);
  petMake(k); PET.mode = 'hide'; // 下一格放到牠站的地方（大廳裡你旁邊）
  if (at && walker) { const w = GAR.group.localToWorld(new THREE.Vector3(at.x, 0, at.z)); const ch = walker.character.group, sc = petRoot(ch); sc.add(PET.C.group); PET.scene = sc; PET.mode = 'walk'; PET.x = w.x; PET.z = w.z; PET.y = ch.position.y; PET.th = petAng(at.th + GAR.group.rotation.y); PET.v = 0; PET.jy = 0; trReset(PET.T, w.x, PET.y, w.z); PET.s = 0; PET.lpx = ch.position.x; PET.lpz = ch.position.z; PET.lgy = ch.position.y; PET.C.group.visible = true; }
  LOBBY.sig = ''; lobbyStep(0);
  if (old && L) { const n = LOBBY.find((x) => x.k === old); if (n) { n.x = L.x; n.z = L.z; n.th = L.th; } }
  walker?.toast(`${petName(k)}跟你出門了${old ? `，${petName(old)}在大廳等你` : ''}`, 2200);
}
// 車庫頁（tower.js 的 room，quality 高）：買了的全部在大廳走來走去；garage.src.html 的 loop 叫
function petsPage(dt = 0) {
  if (typeof room === 'undefined' || !room?.group) return;
  lobbySync(PAGEP, GAME.pets || [], room.group);
  if (PAGEP.length && dt) lobbyWalk(PAGEP, dt);
}

// ---- 🚓 抓／不抓（「⋯」那一排；每支手機自己記）----
function copSync() {
  const b = $('copTog'); if (!b) return;
  b.textContent = copsOff ? '🚓 不抓' : '🚓'; b.setAttribute('aria-pressed', String(copsOff));
  b.setAttribute('aria-label', copsOff ? '警察不抓你（按一下變回抓）' : '警察會抓你（按一下變成不抓）');
}
$('copTog')?.addEventListener('click', () => {
  copsOff = !copsOff;
  try { localStorage.setItem(COPS_KEY, copsOff ? 'off' : 'on'); } catch { /* 存不了：這次有效 */ }
  police?.setLenient(copsOff); copSync();
  const msg = copsOff ? '🚓 不抓：警察不會抓你了' : '🚓 抓：警察會抓你了';
  if (walker && walker.mode === 'walk') walker.toast(msg, 2000); else if (drv) drv.toast(msg, 2000); else gtoast(msg, 2000);
  FOLD.moreopen = foldStart();
});
copSync();
// 走路的人被捷運、電扶梯搬（walker.shift）：寵物走的路、寵物一起搬
function petWrapShift(w) {
  if (!w || w.__petShift) return;
  const f = w.shift; w.__petShift = true;
  w.shift = (dx, dz, dth) => {
    const ch = w.character?.group, px = ch ? ch.position.x : 0, pz = ch ? ch.position.z : 0;
    f(dx, dz, dth);
    if (PET.mode !== 'walk' || !PET.C || !ch) return;
    trShift(PET.T, dx || 0, dz || 0, dth || 0, px, pz);
    const c = Math.cos(dth || 0), s = Math.sin(dth || 0), x = PET.x - px, z = PET.z - pz;
    PET.x = px + (dx || 0) + x * c + z * s; PET.z = pz + (dz || 0) - x * s + z * c; PET.th = petAng(PET.th + (dth || 0));
    PET.lpx += dx || 0; PET.lpz += dz || 0;
  };
}
