// ==== 第 95 批：寵物＋不會被抓（Nick 2026-11-15「可以開槍掃射對方或揍跟撞對方 但不會被抓 / 可以花重金買寵物 / 寵物是那三隻 / 他會一直跟著你 可以幫你打警察或人 /
//      你開車可以讓寵物騎沙灘車跟在你後面」；mock https://claude.ai/artifact/JiamLyxU1TobxZU6T6cgko ，2026-11-16 卡片選「照這樣做」、「做好就上線」）====
// 1 🚓 抓／不抓：「⋯」那一排一顆（每支手機自己記 localStorage carid.cops；'off'＝不抓）：police-ai setLenient → 什麼都不算犯罪、有星星的話清掉、警察不追你
// 2 大便龍寵物店（petshop.js：大停車場西邊、以前的稻田）：走進去（黑掉換場景，跟槍店一樣）站到圓台前面「買 · 小豬 200 萬」
//   小豬 200、粉紅 200、變色龍 300（萬；第 96 批以前 2000、2000、3000）；存檔 GAME.pets（買了哪幾隻）、GAME.petsOut（帶出門的，第 97 批；以前是 GAME.pet 一隻）
// 3 跟著你：走路的時候踩著你走過的路（每 0.25 公尺一個點）走在你後面 1.3 公尺（跑步 1.8）；你跳牠也跳；進房子、坐捷運（walker.shift 一起搬）、回家都跟著；
//   跳太遠（換場景、傳送、電梯、樓梯換層）＝直接站到你腳邊
// 4 幫你打：你揍到人、開槍打到人（警察也算），牠衝過去撲倒對方；「揍」下面「🐾 上」：撲你前面最近的人或警察。小孩、路上的小動物永遠不撲；
//   被撲的人倒下去再爬起來（npc.js knock，沒有血）；警察倒下 2.4 秒（police-ai knockCop）；牠撲的不算你犯罪
// 5 開車：牠戴安全帽騎一台沙灘車（Z2 的輕量車，顏色照那一隻）踩著你的車開過的路跟在後面（6 公尺＋速度 × 0.35）；前面有人就停；被甩掉 220 公尺＝從後面 70 公尺追上來；
//   你下車：牠停好跳下來跑到你旁邊；你上車：牠坐回沙灘車
// 6 圓塔一樓大廳：沒帶出門的寵物在地毯、獎盃櫃前面走來走去（車庫頁也看得到全部的）；走過去「🐾 帶小豬出門」換一隻
// 7 第 97 批（Nick 2026-11-17「寵物可以多隻同時出門」）：買了的都可以一起出門（排隊跟著你、一隻一台沙灘車、「🐾上」每一隻撲一個）；
//   大廳：沒帶的旁邊「🐾 帶X出門」＝多一隻；站在牠們玩的地毯、獎盃櫃前面「🐾 讓X在家玩」＝排最後那一隻留下來；買新的＝一起出門
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

// ---- 寵物的狀態（第 97 批：好幾隻一起出門＝PETS 一隻一個；GAME.petsOut＝帶出門的、照順序排隊）----
// 排隊：第一隻走在你後面 1.3 公尺（跑步 1.8），後面的一隻接一隻（前一隻的屁股＋後一隻的頭＋0.3 公尺）；每一隻自己記一條你走過的路
// 開車：每一隻騎自己的沙灘車，一台接一台跟在車子後面（前一台太近就停）
const PET_EXT = { pig: [0.26, 0.18], pinky: [0.22, 0.18], cham: [0.84, 1.1] }; // 身體從原點往前、往後多長（animals.js 的大小；變色龍的尾巴捲在後面）
const ATV_LEN = 2.1; // 沙灘車多長（沒縮小）
const PETG = { helm: {}, helmMat: null, btn: false, atvData: null, atvLoading: false }; // 大家共用：安全帽（每一種一頂）、沙灘車的資料
const PETS = []; // 帶出門的（跟 GAME.petsOut 同樣的順序）
function petNew(k) {
  return { k, C: null, tag: null, scene: null, mode: 'hide', x: 0, y: 0, z: 0, th: 0, v: 0, s: 0, jy: 0, vy: 0, hop: -1, lj: 0, angry: 0, i: 0, extra: 0,
    T: petTrail(200, 0.25), lpx: 0, lpz: 0, lgy: 0, atk: null, onAtv: false,
    A: { car: null, look: null, x: 0, y: 0, z: 0, th: 0, v: 0, s: 0, vc: 0, pitch: 0, placed: false, pend: true, free: false, T: petTrail(640, 0.6), lcx: 0, lcy: 0, lcz: 0, chk: 0, extra: 0 } };
}
const PET0 = petNew(''); // 沒有寵物的時候給測試看的空的
const PET_UP = { speed: 0, state: 'idle' };
function petName(k) { return PET_NAME[k] || '寵物'; }
const PO = { src: null, pets: null, n: -1, out: [], lobby: [] }, PO_NONE = [];
function petsOut() { // 帶出門的（買了的、不重複）；GAME.petsOut／GAME.pets 換了才重算（每一格不 new 陣列）
  const o = GAME.petsOut || PO_NONE, p = GAME.pets || PO_NONE;
  if (PO.src !== o || PO.pets !== p || PO.n !== p.length) { PO.src = o; PO.pets = p; PO.n = p.length; PO.out = o.filter((k, i) => p.includes(k) && o.indexOf(k) === i); PO.lobby = p.filter((k) => !PO.out.includes(k)); }
  return PO.out;
}
function petWithMe() { return petsOut().length > 0; }
const petOf = (k) => PETS.find((P) => P.k === k) || null;

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
// 安全帽：一個半球（那一隻的顏色、中間一條白的、下緣一圈深色），掛在頭的骨頭上；每一種做一次（每一種最多一隻）
function petHelmet(k) {
  if (PETG.helm[k]) return PETG.helm[k];
  const H = PET_HELM[k], geo = new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const P = geo.attributes.position, cols = new Float32Array(P.count * 3), shell = new THREE.Color(PET_HELM_COL[k] || '#ff7a1a'), white = new THREE.Color('#f6f6f2'), dark = new THREE.Color('#25282e');
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i), z = P.getZ(i), c = y < 0.16 ? dark : Math.abs(z) < 0.16 ? white : shell; // 下緣一圈深色、中間一條白的
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  if (!PETG.helmMat) PETG.helmMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.05, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, PETG.helmMat); m.name = 'pet-helmet';
  m.position.set(H.c[0], H.c[1], H.c[2]); m.scale.set(H.r[0], H.r[1], H.r[2]); m.rotation.z = H.tilt;
  return (PETG.helm[k] = m);
}
// 做一隻（第一次帶出門）
function petMake(P) {
  if (P.C) return P.C;
  let C = null; try { C = buildAnimal({ animal: P.k }); } catch (e) { console.error(e); return null; }
  C.group.name = 'pet-' + P.k;
  P.tag = petTag(P.k); P.tag.position.set(P.k === 'cham' ? 0.3 : 0, (C.height || 0.8) + 0.32, 0); C.group.add(P.tag);
  P.C = C; P.mode = 'hide';
  atvEnsure(P); // 沙灘車先載（上車的時候才不會等）
  return C;
}
function petDrop(P) {
  const hm = PETG.helm[P.k]; if (hm) hm.removeFromParent(); // 每一種只有一隻：安全帽就是牠的
  if (P.tag) { P.tag.material.map?.dispose(); P.tag.material.dispose(); P.tag = null; }
  if (P.C) P.C.dispose(); P.C = null; P.onAtv = false; P.atk = null;
  if (P.A.car) { P.A.car.removeFromParent(); P.A.look?.dispose?.(); P.A.car = null; P.A.look = null; }
}
const petRoot = (o) => { while (o && o.parent) o = o.parent; return o; };
// 排隊：第 i 隻比第一隻多離你幾公尺（走路）；沙灘車多幾公尺（不算速度那一段）
function petLine() {
  let e = 0, a = 0;
  PETS.forEach((P, i) => {
    if (i) { const Q = PETS[i - 1]; e += (PET_EXT[Q.k]?.[1] ?? 0.2) + (PET_EXT[P.k]?.[0] ?? 0.25) + 0.3; a += (ATV_LEN * (atvS(Q.k) + atvS(P.k))) / 2 + 1.4; }
    P.i = i; P.extra = e; P.A.extra = a;
  });
}
// GAME.petsOut 變了：PETS 跟著（多的做、少的收；照順序排）
function petSync() {
  const want = petsOut();
  if (PETS.length === want.length && PETS.every((P, i) => P.k === want[i])) return false;
  for (let i = PETS.length - 1; i >= 0; i--) if (!want.includes(PETS[i].k)) { petDrop(PETS[i]); PETS.splice(i, 1); }
  for (const k of want) if (!petOf(k)) PETS.push(petNew(k));
  PETS.sort((a, b) => want.indexOf(a.k) - want.indexOf(b.k));
  petLine();
  return true;
}

// ---- 沙灘車（Z2 的輕量車，顏色照那一隻；每一隻一台，資料載一次大家用）----
function atvEnsure(P) {
  const A = P.A;
  if (A.car) return true;
  if (!LOD_CARS.z2) return false;
  if (PETG.atvData) {
    try { const L = buildLodCar('z2', PETG.atvData, { ...DEFAULT_LOOK.z2, paint: PET_PAINT[P.k] || DEFAULT_LOOK.z2.paint }); A.look = L; A.car = L.car; A.car.name = 'pet-atv-' + P.k; A.car.visible = false; A.car.scale.setScalar(atvS(P.k)); } catch (e) { console.error(e); A.car = null; return false; }
    return true;
  }
  if (!PETG.atvLoading) { PETG.atvLoading = true; LOD_CARS.z2.load().then((d) => { PETG.atvData = d; PETG.atvLoading = false; }).catch((e) => { console.error(e); PETG.atvLoading = false; }); }
  return false;
}

// ---- 出門、回家 ----
function petTripStart() { // enterDrive 做好以後：沒有寵物就什麼都不做；沙灘車先載
  police?.setLenient(copsOff); copSync();
  petSync();
  for (const P of PETS) { P.mode = 'hide'; P.atk = null; P.A.placed = false; P.A.pend = true; petMake(P); }
  petBtns();
}
function petHide(P) {
  if (P.C) P.C.group.visible = false;
  if (P.A.car) P.A.car.visible = false;
  P.mode = 'hide'; P.atk = null;
}
function petTripEnd() { // leaveDrive、比賽：收起來（下次出門重新放）
  for (const P of PETS) {
    petHide(P);
    if (P.C) P.C.group.removeFromParent();
    if (P.A.car) P.A.car.removeFromParent();
    P.A.placed = false; P.A.pend = true;
  }
  for (const L of LOBBY) L.C.group.visible = false;
}
// 寵物現在在做什麼：hide（不在外面、比賽、被抓、坐電梯）／car（你在車上：騎沙灘車）／walk（你在走路：跟著）
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
  if (!trip || !DRIVE.on) return;
  if (petSync()) petBtns();
  if (!PETS.length) return;
  const m = petModeNow();
  for (const P of PETS) {
    if (!P.C && !petMake(P)) continue;
    if (m === 'hide') { if (P.mode !== 'hide') petHide(P); continue; }
    if (m === 'car') {
      if (!atvEnsure(P)) { P.C.group.visible = false; P.mode = 'wait'; continue; } // 沙灘車還在載
      if (P.mode !== 'car') petMount(P);
      petCarStep(P, dt);
    } else {
      if (P.mode !== 'walk') petDismount(P, P.mode);
      petWalkStep(P, dt);
    }
  }
}
// 走路：踩著你走過的路跟在後面
function petReset(P, px, gy, pz, th) { // 站到你腳邊（後面 0.35 公尺；排在後面的再往後），路從這裡重新記
  const b = 0.35 + P.extra; P.x = px - Math.cos(th) * b; P.z = pz + Math.sin(th) * b; P.y = gy; P.th = th; P.v = 0; P.jy = 0; P.vy = 0; P.atk = null;
  trReset(P.T, P.x, gy, P.z); P.s = 0; trPush(P.T, px, gy, pz);
}
function petDismount(P, was) {
  const A = P.A, ch = walker.character.group, sc = petRoot(ch);
  const hm = PETG.helm[P.k]; if (hm) hm.removeFromParent();
  P.C.group.scale.setScalar(1);
  P.onAtv = false; P.mode = 'walk'; P.atk = null; P.angry = 0;
  sc.add(P.C.group); P.scene = sc; P.C.group.visible = true;
  const t = walker.telemetry(), gy = ch.position.y - (t.jy || 0);
  P.lpx = ch.position.x; P.lpz = ch.position.z; P.lgy = gy; P.lj = t.jumps || 0;
  if (was === 'car' && A.car && A.car.visible && Math.hypot(A.x - ch.position.x, A.z - ch.position.z) < 15 + A.extra) { // 從沙灘車上跳下來（停好的沙灘車留著）
    const s = PET_RIDE[P.k], c = Math.cos(A.th), n = Math.sin(A.th);
    P.x = A.x + c * s[0] * atvS(P.k) + 0.55 * n; P.z = A.z - n * s[0] * atvS(P.k) + 0.55 * c; P.y = A.y; P.th = A.th; P.jy = s[1] * atvS(P.k); P.vy = 1.6; P.v = 0;
    trReset(P.T, P.x, A.y, P.z); P.s = 0; trPush(P.T, ch.position.x, gy, ch.position.z);
  } else petReset(P, ch.position.x, gy, ch.position.z, t.heading);
  A.v = 0;
}
function petWalkStep(P, dt) {
  const C = P.C, T = P.T, ch = walker.character.group, sc = petRoot(ch), t = walker.telemetry();
  const px = ch.position.x, pz = ch.position.z, gy = ch.position.y - (t.jy || 0);
  if (sc !== P.scene) { sc.add(C.group); P.scene = sc; petReset(P, px, gy, pz, t.heading); }
  else if (Math.hypot(px - P.lpx, pz - P.lpz) > 4 || Math.abs(gy - P.lgy) > 1.5 || Math.hypot(px - P.x, pz - P.z) > 10 + P.extra) petReset(P, px, gy, pz, t.heading); // 傳送、樓梯換層、被甩太遠
  else if (Math.abs(gy - P.lgy) > 0.002 && Math.hypot(px - P.lpx, pz - P.lpz) < 0.004 && !(t.jy > 0)) { for (let k = 0; k < T.n; k++) T.Y[trI(T, k)] += gy - P.lgy; } // 站著不動、地板在動（電扶梯、升降）：路一起升降
  P.lpx = px; P.lpz = pz; P.lgy = gy;
  C.group.visible = true;
  trPush(T, px, gy, pz);
  if ((t.jumps || 0) > P.lj) { P.lj = t.jumps; if (P.hop < 0 && P.jy <= 0) P.hop = 0.12 + P.i * 0.1; } // 你跳牠也跳（晚一點點；排在後面的再晚一點）
  if (P.hop >= 0) { P.hop -= dt; if (P.hop < 0) { P.hop = -1; if (P.jy <= 0) P.vy = 3.2; } }
  let state = 'idle', spd = 0;
  if (P.atk) { const r = petAtkStep(P, dt, px, gy, pz); state = r; spd = P.v; }
  else {
    const gap = (t.running ? 1.8 : 1.3) + P.extra * (t.running ? 1.15 : 1), d = Math.hypot(px - P.x, pz - P.z);
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

// ---- 幫你打（每一隻都會去）----
const petPedOK = (p) => p && p.active && !p.gone && p.age !== 'kid' && !p.animal && p.mode !== 'sit' && p.mode !== 'enter' && p.mode !== 'dive'; // 小孩、路上的小動物永遠不撲
const petPedDown = (p) => p.down || p.mode === 'fall' || p.mode === 'lie' || p.mode === 'getup';
const petOutside = () => !indoor && !APTU.on && !LDR.on && !MRTS.lvl;
function petCanFight(P) { return P.mode === 'walk' && P.C && !P.atk && walker?.mode === 'walk' && petOutside() && !sleep && !doorFade; }
function petAttack(P, o, cop) {
  if (!petCanFight(P) || !o) return false;
  if (Math.hypot(o.x - P.x, o.z - P.z) > 18 + P.extra) return false;
  P.atk = { o, cop: !!cop, t: 0, hit: false, end: 0 };
  return true;
}
function petHit(o) { // doPunch 揍到的（警察有 st、人有 age）：大家一起撲
  if (!o) return;
  const cop = o.st !== undefined && o.age === undefined;
  if (!cop && !petPedOK(o)) return;
  for (const P of PETS) petAttack(P, o, cop);
}
function petNear(x, z, r, cops, peds, standing, fx, fz, skip) { // 最近的（前面的算近一點：後面的距離 × 2.2）；skip＝已經有寵物去撲的
  let best = null, bd = Infinity, cop = false;
  if (cops && police) for (const f of police.offs || []) {
    if (!police.copUp(f) || skip?.includes(f)) continue;
    const dx = f.x - x, dz = f.z - z, d = Math.hypot(dx, dz); if (d > r) continue;
    const sc = fx == null || dx * fx + dz * fz >= 0 ? d : d * 2.2; if (sc < bd) { bd = sc; best = f; cop = true; }
  }
  if (peds && NPC) for (const p of NPC.peds.people) {
    if (!petPedOK(p) || (standing && petPedDown(p)) || skip?.includes(p)) continue;
    const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz); if (d > r) continue;
    const sc = fx == null || dx * fx + dz * fz >= 0 ? d : d * 2.2; if (sc < bd) { bd = sc; best = p; cop = false; }
  }
  return best ? { o: best, cop } : null;
}
function petCrime(kind, info) { // 槍：打到人／警察＝撲打到的那一個；附近有警察開槍＝撲最近的警察
  if (!info || !PETS.some(petCanFight)) return;
  const r = kind === 'gunfire' ? petNear(walker.character.group.position.x, walker.character.group.position.z, 30, true, false, true) : kind === 'shoot' || kind === 'shootCop' ? petNear(info.x, info.z, 4, true, true, false) : null;
  if (r) for (const P of PETS) petAttack(P, r.o, r.cop);
}
function petGo() { // 「🐾 上」：每一隻撲一個（附近的人不夠就一起撲同一個）
  const ready = PETS.filter((P) => P.C && P.mode === 'walk');
  if (!ready.length) return;
  if (!petOutside()) { walker.toast(`${ready.map((P) => petName(P.k)).join('、')}：這裡沒有人可以撲`, 1400); return; }
  const go = ready.filter((P) => !P.atk);
  if (!go.length) return;
  const t = walker.telemetry(), fx = Math.cos(t.heading), fz = -Math.sin(t.heading), taken = [];
  let first = null, n = 0;
  for (const P of go) {
    const r = petNear(t.x, t.z, 14, true, true, true, fx, fz, taken) || first;
    if (!r) break;
    if (!first) first = r;
    if (petAttack(P, r.o, r.cop)) { n++; taken.push(r.o); }
  }
  if (!first) walker.toast('附近沒有人可以撲', 1400);
  else if (!n) walker.toast(`${petName(go[0].k)}跟不上了`, 1400);
}
function petAtkStep(P, dt, px, gy, pz) {
  const g = P.atk, o = g.o; g.t += dt;
  const alive = g.cop ? o.on : o.active && !o.gone;
  if (g.hit) { if ((g.end -= dt) <= 0 || !alive) petAtkEnd(P, px, gy, pz); return 'wave'; }
  if (!alive || g.t > 6 || !petOutside()) { petAtkEnd(P, px, gy, pz); return 'idle'; }
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
function petAtkEnd(P, px, gy, pz) { P.atk = null; trReset(P.T, P.x, P.y, P.z); P.s = 0; trPush(P.T, px, gy, pz); }

// ---- 開車：每一隻騎自己的沙灘車，一台接一台跟著 ----
function petMount(P) {
  const A = P.A, C = P.C, car = petCarObj();
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
function petCarStep(P, dt) {
  const A = P.A, T = A.T, car = petCarObj();
  if (!car) { A.car.visible = false; return; }
  const cx = car.position.x, cy = car.position.y, cz = car.position.z;
  if (Math.hypot(cx - A.lcx, cz - A.lcz) > 25 || Math.abs(cy - A.lcy) > 1.5) { trReset(T, cx, cy, cz); A.pend = true; A.placed = false; } // 車子傳送（去這裡、回家、電梯）：沙灘車等一下從後面追上來
  const vc = Math.hypot(cx - A.lcx, cz - A.lcz) / Math.max(dt, 1e-3); A.vc += (Math.min(vc, 90) - A.vc) * Math.min(1, dt * 4);
  A.lcx = cx; A.lcy = cy; A.lcz = cz;
  const sc = petRoot(car); if (A.car.parent !== sc) sc.add(A.car);
  trPush(T, cx, cy, cz);
  const gap = 6 + 0.35 * A.vc + A.extra + P.i * 0.22 * A.vc, sT = T.ls - gap; // 排在後面的：前面那幾台的長度＋間隔（越快離越遠）
  if (A.pend) { // 還沒出現：車子開了 gap＋1 公尺，沙灘車在後面那一點出現
    A.car.visible = false;
    if (T.ls - trS0(T) < gap + 1) return;
    A.pend = false; A.free = false; A.placed = true; A.s = sT; A.v = A.vc; trAt(T, A.s, PT); A.x = PT.x; A.y = PT.y; A.z = PT.z; A.th = Math.atan2(-PT.hz, PT.hx);
  }
  if (T.ls - A.s > 220 + A.extra && !A.free) { A.s = T.ls - 70 - A.extra; A.v = Math.min(A.vc, ATV_MAXV); } // 甩掉了：從後面 70 公尺追上來
  // 前面有人（警察也算）、前面那一台沙灘車太近：停
  let block = false;
  const fx = Math.cos(A.th), fz = -Math.sin(A.th);
  if (A.v > 0.5) {
    if (NPC) for (const p of NPC.peds.people) { if (!p.active || p.gone) continue; const dx = p.x - A.x, dz = p.z - A.z, f = dx * fx + dz * fz; if (f < 0.6 || f > 3.4) continue; if (Math.abs(dx * fz - dz * fx) < 1.2) { block = true; if (!p.dive) NPC.peds.scare(A.x, A.z, 4); break; } }
    if (!block && police?.nearCop(A.x + fx * 2, A.z + fz * 2, 1.6)) block = true;
  }
  const Q = P.i ? PETS[P.i - 1].A : null, qGap = Q && Q.placed && Q.car?.visible ? (ATV_LEN * (atvS(PETS[P.i - 1].k) + atvS(P.k))) / 2 + 0.6 : 0;
  if (qGap) { const dx = Q.x - A.x, dz = Q.z - A.z; if (dx * fx + dz * fz > 0 && Math.hypot(dx, dz) < qGap + 0.4 * A.v) block = true; }
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
  if (qGap) { const dx = A.x - Q.x, dz = A.z - Q.z, d = Math.hypot(dx, dz), m = qGap * 0.8; if (d < m && d > 1e-3) { A.x = Q.x + (dx / d) * m; A.z = Q.z + (dz / d) * m; A.v = Math.min(A.v, Q.v); } } // 兩台不疊在一起
  A.car.visible = true; A.car.position.set(A.x, A.y, A.z); A.car.rotation.set(0, A.th, A.pitch);
  PET_UP.speed = 0; PET_UP.state = 'sit'; P.C.update(dt, PET_UP);
}

// ---- 走路右下角的「🐾 上」（「揍」下面；拿槍、被關的時候整排收起來）----
const PET_B = { id: 'pet', label: '🐾上', cls: 'pet', key: 'KeyP', onClick: () => petGo() };
function petBtns() { // 有沒有帶寵物變了：右下角那一排重做
  const on = petWithMe();
  if (on === PETG.btn || !walker) return;
  PETG.btn = on;
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
    ? { label: `已經有${K.name}了`, icon: 'hand', onClick: () => walker.toast(petsOut().includes(K.k) ? `${K.name}跟著你` : `${K.name}在圓塔一樓大廳玩（走過去「🐾 帶${K.name}出門」）`, 2200) }
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
  const had = petsOut().length; GAME.petsOut = [...petsOut(), k]; // 第 97 批：買了就一起出門（以前換掉原本那一隻）
  save(true); renderWallet();
  petSync(); petBtns();
  walker.toast(had ? `買了${petName(k)}！牠也跟著你（${GAME.petsOut.length} 隻一起）` : `買了${petName(k)}！牠會一直跟著你`, 2600);
}

// ---- 圓塔一樓大廳的寵物（沒帶出門的；車庫頁是全部）：地毯、獎盃櫃前面走來走去（塔的本地座標：門在 +x、電梯圓台在中間）----
const LOBBY = [], PAGEP = [];
const LOBBY_R = [{ x0: -5.5, x1: 3.2, z0: 4.8, z1: 7.2 }, { x0: -9.2, x1: -4.8, z0: -3.6, z1: 3.6 }], LOBBY_W = [-5.0, 4.6]; // 南邊（沙發前面）、西邊（獎盃櫃前面）；兩塊中間走那一點
function lobbyPick(L) {
  const ri = Math.random() < 0.7 ? L.ri : 1 - L.ri, R = LOBBY_R[ri];
  L.tx = R.x0 + Math.random() * (R.x1 - R.x0); L.tz = R.z0 + Math.random() * (R.z1 - R.z0);
  L.via = ri !== L.ri; L.ri = ri; L.wait = 0;
}
function lobbyMake(list, k, parent, i, at) {
  let C = null; try { C = buildAnimal({ animal: k }); } catch (e) { console.error(e); return; }
  C.group.name = 'lobby-pet-' + k;
  const ri = at ? at.ri : i % 2, R = LOBBY_R[ri], L = { k, C, ri, x: at ? at.x : (R.x0 + R.x1) / 2 + (i - 1) * 1.4, z: at ? at.z : (R.z0 + R.z1) / 2, th: at ? at.th : Math.random() * 6.28, tx: 0, tz: 0, via: false, wait: 1 + Math.random() * 3, sit: false, v: 0 };
  L.tx = L.x; L.tz = L.z;
  parent.add(C.group); list.push(L);
}
function lobbySync(list, keys, parent) { // 照名單重做（買了、帶出門、留在家才會變）；本來就在的留在原地
  if (list.keys === keys && list.kn === keys.length && list.par === parent) return; // 每一格：名單沒換就不算
  list.keys = keys; list.kn = keys.length; list.par = parent;
  const sig = keys.join(',') + '|' + (parent?.uuid || '');
  if (list.sig === sig) return; list.sig = sig;
  const was = {}; for (const L of list) { was[L.k] = { x: L.x, z: L.z, th: L.th, ri: L.ri }; L.C.dispose(); }
  if (list.at) { Object.assign(was, list.at); list.at = null; }
  list.length = 0;
  if (!parent) return;
  keys.forEach((k, i) => lobbyMake(list, k, parent, i, was[k]));
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
  petsOut(); lobbySync(LOBBY, PO.lobby, GAR.group);
  if (!LOBBY.length) return;
  const me = walker && walker.mode !== 'off' ? walker.character.group.position : petCarObj()?.position, q = me ? garLocal(me.x, me.z) : null;
  const on = !!q && !GV.on && Math.hypot(q.x, q.z) < 45 && DRIVE.on && trip;
  for (const L of LOBBY) L.C.group.visible = on;
  if (on) lobbyWalk(LOBBY, dt);
}
const inLobbyArea = (q, m = 0) => LOBBY_R.some((R) => q.x > R.x0 - m && q.x < R.x1 + m && q.z > R.z0 - m && q.z < R.z1 + m);
const PL_ACT = {};
function petLobbyAct(t) { // homeWalk（一樓大廳）：沒帶出門的那一隻旁邊「🐾 帶X出門」；地毯、獎盃櫃前面（牠們玩的地方）「🐾 讓X在家玩」（排最後面那一隻）
  if (GV.on || GAR.floor) return null;
  const q = garLocal(t.x, t.z);
  for (const L of LOBBY) if (Math.hypot(L.x - q.x, L.z - q.z) < 1.5) return L.act || (L.act = { label: `🐾 帶${petName(L.k)}出門`, icon: 'hand', onClick: () => petTake(L.k) });
  const out = petsOut();
  if (out.length && inLobbyArea(q)) { const k = out[out.length - 1]; return PL_ACT[k] || (PL_ACT[k] = { label: `🐾 讓${petName(k)}在家玩`, icon: 'hand', onClick: () => petStay(k) }); }
  return null;
}
function petTake(k) { // 第 97 批：帶出門＝多一隻跟著你（以前是換一隻）
  if (!GAME.pets.includes(k) || petsOut().includes(k)) return;
  const L = LOBBY.find((x) => x.k === k), at = L ? { x: L.x, z: L.z, th: L.th } : null;
  GAME.petsOut = [...petsOut(), k]; save(true);
  petSync(); petBtns();
  const P = petOf(k);
  if (P && petMake(P) && at && walker) { // 從牠站的地方開始跟（大廳裡你旁邊）
    const w = GAR.group.localToWorld(new THREE.Vector3(at.x, 0, at.z)), ch = walker.character.group, sc = petRoot(ch);
    sc.add(P.C.group); P.scene = sc; P.mode = 'walk'; P.x = w.x; P.z = w.z; P.y = ch.position.y; P.th = petAng(at.th + GAR.group.rotation.y); P.v = 0; P.jy = 0;
    trReset(P.T, w.x, P.y, w.z); P.s = 0; P.lpx = ch.position.x; P.lpz = ch.position.z; P.lgy = ch.position.y; P.C.group.visible = true;
  }
  lobbyStep(0);
  const n = petsOut().length;
  walker?.toast(n > 1 ? `${petName(k)}也跟你出門了（${n} 隻一起）` : `${petName(k)}跟你出門了`, 2200);
}
function petStay(k) { // 第 97 批：讓牠留在大廳玩（站在牠現在的地方）
  if (!petsOut().includes(k)) return;
  const P = petOf(k);
  if (P && P.C && P.mode === 'walk' && GAR) { const q = garLocal(P.x, P.z); LOBBY.at = { ...(LOBBY.at || {}), [k]: { x: q.x, z: q.z, th: petAng(P.th - GAR.group.rotation.y), ri: q.z > 4 ? 0 : 1 } }; }
  GAME.petsOut = petsOut().filter((x) => x !== k); save(true);
  petSync(); petBtns();
  lobbyStep(0);
  walker?.toast(`${petName(k)}在大廳玩（要帶牠：走過去「🐾 帶${petName(k)}出門」）`, 2400);
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
    if (!ch) return;
    const c = Math.cos(dth || 0), s = Math.sin(dth || 0);
    for (const P of PETS) {
      if (P.mode !== 'walk' || !P.C) continue;
      trShift(P.T, dx || 0, dz || 0, dth || 0, px, pz);
      const x = P.x - px, z = P.z - pz;
      P.x = px + (dx || 0) + x * c + z * s; P.z = pz + (dz || 0) - x * s + z * c; P.th = petAng(P.th + (dth || 0));
      P.lpx += dx || 0; P.lpz += dz || 0;
    }
  };
}
