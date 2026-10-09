// ---- 輾扁（第 7 批）：怪獸卡車開上去把東西壓扁 ----
// Nick 2026-10-07：「可以輾別人」、「怪獸卡車啥都可輾」
// 只有怪獸卡車（PERF.big）輾得過去，別的車完全照舊（撞到、彈開）；人永遠不會被輾（車上的人先跳車跑掉、路上的人照舊被撞倒再爬起來）
// 做法：東西下面放一塊「墊子」（pad）＝臨時的地形高度（terrain.js 的 extraH），輾過去的時候墊子慢慢變矮：
//   車子的輪子照地形爬上去（懸吊、前後左右傾都是 terrain.js 算的）→ 看起來就是開上車頂、把它壓扁
//   同時東西本身壓扁：路上的車、垃圾車（輕量車）用 carlod.js 的 setSquash（車頂壓下來、玻璃破掉、車身變矮）；
//   路邊的東西（垃圾桶、燈箱、機車、板凳、矮柱⋯）把合併網格裡那一塊的頂點壓下去（一次做完，不是每幀）
// 座標跟 drive.js、village.js 一樣：x 往東、y 往上、z 往南；heading＝rotation.y（0 朝 +x）
// 【API】
//   const crush = createCrush({
//     world: V,                        buildVillage＋buildOffroad 的（V.group、V.colliders、V.heightAt、V.offroad.show＝越野車場的表演場）
//     getCar(out) → true/false,        玩家的車（每幀）：out.x、out.z（車身中心）、heading、v、hx、hz、big（是不是怪獸卡車）；沒在開車回 false
//     makeJunk(i, [x, z, h]) → Promise<lod>,  表演場的垃圾車（buildLodCar 做的輕量車；一次做一台）
//     recycle(car),                    輾扁的路上的車收回車流的池子（npc.js traffic.recycle）
//     bail(x, z, dx, dz) → n,          車上的人跳車往 (dx, dz) 跑掉（npc.js peds.bail）
//     sound(kind, x, z, k),            'crunch'（壓扁的咖啦聲）、'glass'（玻璃碎）
//     toast(text),                     第一次在表演場輾扁：「輾扁了！」
//     crime(x, z),                     村子裡輾東西＝報警（police.crime('crush')，1★）；越野車場裡面不叫
//   })
//   crush.heightAt(x, z)      墊子的高度（0＝沒有）：drive.js 的 crush.height
//   crush.can(c)              這個碰撞物輾得過去嗎（drive.js 的 crush.can）：垃圾桶、燈箱、機車、板凳、矮柱、小招牌、垃圾車⋯
//                             不輾：房子、牆、電線桿、路燈、樹（小樹苗以上）、警車、你自己的車、鐵捲門、文湖線的橋墩（都是大的或高的）
//   crush.hit(c, speed)       drive.js 碰到輾得過去的東西（它不擋了）→ 這裡接手
//   crush.hitTraffic(car)     npc.js：怪獸卡車撞到路上的車（npc.js 已經把它從車流裡拿出來）
//   crush.update(dt)          每幀（driveStep 裡 npcStep 後面）
//   crush.colliders()         表演場還沒輾扁的垃圾車（給「不是怪獸卡車」的車擋）；怪獸卡車的時候回空的
//   crush.colVer              上面那個清單換過幾次（變了才重新 addColliders，每幀不配置記憶體）
//   crush.reset()             回車庫頁：墊子清掉、輾扁的車收回去、垃圾車擺回來
//   crush.stats               { cars, junk, props, bails, pads, flats, ms, maxMs, frames, types }
// 第 9 批（路變大）Nick 2026-10-09「越車可碾任何東西」：越野車（PERF.offroad；現在只有怪獸卡車）什麼都輾得過去：
//   路上的車、警車（警察先下車跑掉，+2★）、路燈、樹、紅綠燈、牆、圍籬、站牌、招牌、房子、大樓、地標 → 壓成一堆低低的瓦礫（開得上去），碰撞拿掉
//   第 10 批：房子、大樓、內湖的地標撞不倒（HOUSE_SOLID）：撞到就停住，不扁、不算犯罪。下面「房子怎麼壓」留著，HOUSE_SOLID 關掉才會用到
//   不輾：人（永遠不會）、你的車庫、越野車車庫、改車廠、車店、槍店、警察局、越野車行、福德宮（o.protect）、捷運的橋墩跟高架（noCrush）、
//         賽車場（circuit）、長的圍牆／護欄（地圖的邊、快速道路：14 公尺以上）
//   房子怎麼壓：輾到的那一下把那棟（同一個 g 的碰撞物＋貼在上面的小東西）記下來 → 分幾幀（每幀最多 SEL_MS 毫秒）從合併網格裡挑出它的三角形
//     （三角形中心往裡面縮一點，在這棟的範圍裡、而且比較靠這棟不是靠隔壁）→ 0.6 秒內頂點的 y 往下壓（y × 瓦礫高／樓高）＋灰塵、瓦礫（共用的 InstancedMesh）
//   壓扁的房子：離開 140 公尺以上 25 秒（或回車庫頁）一次全部長回來（頂點的 y 原本是多少記著）；重新載入也會回來
//   o.any() → 現在開的是不是越野車；o.protect(x, z) → 這裡不能輾；o.copWreck(i, x, z) → police-ai 的 wreck（回傳 { x, z, th, hl, hw } 或 null）
// 【效能】每幀只跑現在的墊子（最多 16 個）：約 0.01 ms，不配置記憶體；壓扁的頂點是輾到的那一下做一次（一台／一個東西 0.2–3 ms，只傳改到的那一段）
import * as THREE from 'three';

export const { createCrush } = (() => {
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => (t >= 1 ? 1 : t <= 0 ? 0 : t * t * (3 - 2 * t));
const RAMP = 2.0; // 墊子外面的斜坡（公尺）：輪子從這裡爬上去
const CAR_H = 1.34, CAR_FLAT = 0.34; // 車子：車頂多高 → 輾扁以後多高
const PROP_FLAT = 0.14; // 路邊的東西輾扁以後多高
const SQ_T = 0.55, GROW_T = 0.3; // 壓扁要幾秒；墊子長出來要幾秒（突然長出來車會被彈起來）
const KEEP = 20, FADE = 1.4; // 輾扁的車在路邊留幾秒、再淡掉幾秒
const JUNK_BACK = 30, JUNK_FAR = 170, JUNK_AWAY = 50; // 表演場的垃圾車幾秒後回來；離這麼遠就算要蓋（170）／算離開了（50）
const CRIME_GAP = 8; // 一路輾過去只報一次警（一次 1★；不然一次就被通緝好幾顆星）
const V3 = new THREE.Vector3();
// 第 9 批：大東西（房子、樹、路燈⋯）
const LONG = 14; // 長的圍牆、護欄（地圖的邊、快速道路）不輾
const FALL_T = 0.6, SEL_MS = 1.6, FAR = 140, AWAY = 25, REC_MAX = 64; // 壓下去幾秒；挑三角形每幀最多幾毫秒；離多遠多久全部長回來；最多記幾個
const SKIP_MESH = /(^|[-_|])(ground|area|walk|road|paint|hill|grass|paddy|water|asph|line|lane)\b/i; // 地上的（壓不到）不用找

// 哪些東西輾得過去（照碰撞物的大小分：跟 street.js 畫影子一樣的辦法）
//   圓：垃圾桶（r 0.32 h 0.95）、燈箱（0.28 × 1.3）、油桶、矮柱；細細的桿子（旗桿、小招牌）h 3 公尺以內
//   長方形：機車（0.82 × 0.3 h 1.1）、板凳、塑膠椅、矮花台、垃圾車（junk）
//   不輾：npc（路上的車：npc.js 自己算）、警車（police）、高的（樹、電線桿、路燈、橋墩）、大的（房子、牆、你自己的車、展示台、鐵捲門）
function small(c) {
  const h = c.h ?? 9;
  if (c.t === 'circle') return (c.r <= 0.62 && h <= 1.6) || (c.r <= 0.1 && h <= 3.0);
  return h <= 1.35 && c.hx <= 1.7 && c.hz <= 1.7;
}
const gone = (c) => c.crushed === true || (!!c.src && c.src.crushed === true);
// 第 9 批：any＝越野車（什麼都輾）；protect(x, z)＝不能輾的地方
function canAny(c, any, protect) {
  if (!c || gone(c) || c.npc || c.person || c.noCrush || (c.src && c.src.noCrush)) return false;
  if (c.junk === true) return true;
  if (c.police === true) return !!any && c.t === 'box' && c.pi != null; // 警車（下車的警察是圓：不輾）
  if (small(c)) return true;
  if (!any || c.circuit || (c.src && c.src.circuit)) return false;
  if (c.t === 'box' && (c.hx > LONG || c.hz > LONG)) return false;
  if (protect && protect(c.x, c.z)) return false;
  if (HOUSE_SOLID && isBld(c.src || c)) return false;
  return true;
}
// 第 10 批（Nick 2026-10-09「所有房子⋯越野車撞不倒」）：房子、大樓、地標（內湖的 g ≥ GB−2；村子的：高 2.6 以上、兩邊都 1 公尺以上的盒子）越野車也撞不倒
const HOUSE_SOLID = true, NH_GB = 1e6 - 2;
function isBld(c) { return (c.g != null && c.g >= NH_GB) || (c.t === 'box' && (c.h ?? 9) >= 2.6 && c.hx >= 1 && c.hz >= 1); }
function can(c) { return canAny(c, false, null); }

function createCrush(o = {}) {
  const V = o.world || {}, SHOW = V.offroad && V.offroad.show ? V.offroad.show : null;
  const terrainAt = typeof V.terrainAt === 'function' ? V.terrainAt : () => false;
  const heightOf = typeof V.heightAt === 'function' ? V.heightAt : () => 0;
  let alive = true, colVer = 0, jN = 0, jBusy = false, awayT = 0, toldPark = false, crimeT = -99, clock = 0;
  const ME = { x: -0, z: -0, heading: -0, v: -0, hx: 2.8, hz: 1.9, big: false };
  const st = { cars: 0, junk: 0, props: 0, bails: 0, pads: 0, flats: 0, ms: -0, maxMs: -0, frames: 0, types: [], big: 0, cops: 0, restored: 0, bigMs: -0, hitMs: -0 };
  // 墊子（池子裡重複用；小數欄位 -0／x.5 開始）
  const PAD = [];
  for (let i = 0; i < 16; i++) PAD.push({ on: false, kind: '', x: -0, z: -0, c: 1.5, s: -0, hx: 1.5, hz: 1.5, h0: 1.5, hf: 0.5, h: -0, sq: -0, sqA: -0, grow: -0, t: -0, snd: 0, ct: -0, flat: false, car: null, lod: null, col: null, junk: -1 });
  const JUNK = []; // 表演場的垃圾車：{ lod, x, z, h, pad }
  const COL = [], CPOOL = []; // colliders()：還沒輾扁的垃圾車（重複用同一批物件）

  // ---- 墊子 ----
  function take() {
    for (let i = 0; i < PAD.length; i++) if (!PAD[i].on) return PAD[i];
    let old = null; // 滿了：最舊的（不是垃圾車的）先收掉
    for (let i = 0; i < PAD.length; i++) { const q = PAD[i]; if (q.junk >= 0) continue; if (!old || q.t > old.t) old = q; }
    if (old) { finish(old); return old; }
    return null;
  }
  function setPad(q, kind, x, z, rot, hx, hz, h0, hf, grow) {
    q.on = true; q.kind = kind; q.x = x; q.z = z; q.c = Math.cos(rot || 0); q.s = Math.sin(rot || 0);
    q.hx = hx; q.hz = hz; q.h0 = h0; q.hf = hf; q.h = grow ? 0 : h0; q.sq = 0; q.sqA = -1; q.grow = grow ? 0 : 1; q.t = 0; q.snd = 0; q.ct = -99; q.flat = false;
    q.car = null; q.lod = null; q.col = null; q.junk = -1; st.pads++;
    return q;
  }
  function finish(q) { // 墊子收掉（高度沒了）
    if (q.kind === 'car' && q.car) { if (o.recycle) try { o.recycle(q.car); } catch (e) { console.warn(e); } }
    q.on = false; q.kind = ''; q.car = null; q.lod = null; q.col = null; q.junk = -1; q.h = 0; q.sq = 0; q.sqA = -1; q.grow = 0;
  }
  // 車身中心在墊子上面（往外 m 公尺也算）
  function over(q, m) {
    const dx = ME.x - q.x, dz = ME.z - q.z;
    const far = q.hx + q.hz + ME.hx + ME.hz + m;
    if (dx > far || dx < -far || dz > far || dz < -far) return false;
    const u = Math.abs(dx * q.c + dz * q.s), w = Math.abs(-dx * q.s + dz * q.c);
    const mc = Math.cos(ME.heading), ms = Math.sin(ME.heading);
    const eu = ME.hx * Math.abs(mc * q.c - ms * q.s) + ME.hz * Math.abs(ms * q.c + mc * q.s); // 車身長方形投到墊子的兩軸上
    const ew = ME.hx * Math.abs(-mc * q.s - ms * q.c) + ME.hz * Math.abs(-ms * q.s + mc * q.c);
    return u < q.hx + eu + m && w < q.hz + ew + m;
  }

  // ---- 地形高度（drive.js → terrain.js 每個輪子、底盤、影子每一步都問：要快、不配置記憶體）----
  function heightAt(x, z) {
    let best = 0;
    for (let i = 0; i < PAD.length; i++) {
      const q = PAD[i]; if (!q.on || q.h <= 0.002) continue;
      const dx = x - q.x, dz = z - q.z, r = q.hx + q.hz + RAMP;
      if (dx > r || dx < -r || dz > r || dz < -r) continue;
      const u = Math.abs(dx * q.c + dz * q.s) - q.hx, w = Math.abs(-dx * q.s + dz * q.c) - q.hz;
      const e = u > w ? u : w;
      if (e >= RAMP) continue;
      const h = e <= 0 ? q.h : q.h * ease(1 - e / RAMP);
      if (h > best) best = h;
    }
    if (BIG.length) { const h = bigHeight(x, z); if (h > best) best = h; } // 第 9 批：壓扁的房子（瓦礫）
    return best;
  }

  // ---- 路邊的東西：合併網格裡那一塊的頂點壓下去（輾到的那一下做一次）----
  let MESH = null;
  const RGP = []; for (let i = 0; i < 8; i++) RGP.push({ start: 0, count: 0 });
  let rgi = 0;
  let meshKids = -1;
  function meshes() {
    const root = V.group || null;
    if (MESH && (!root || root.children.length === meshKids)) return MESH; // 第 9 批：後來加進來的（內湖）再找一次
    MESH = [];
    if (!root) return MESH;
    meshKids = root.children.length;
    root.updateMatrixWorld(true);
    root.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh) return;
      const g = m.geometry, p = g && g.attributes && g.attributes.position;
      if (!p || p.count > 600000 || !(p.array instanceof Float32Array)) return;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const bs = g.boundingSphere; if (!bs) return;
      V3.copy(bs.center).applyMatrix4(m.matrixWorld);
      const e = m.matrixWorld.elements, id = e[0] === 1 && e[5] === 1 && e[10] === 1 && e[1] === 0 && e[2] === 0 && e[4] === 0 && e[6] === 0 && e[8] === 0 && e[9] === 0 && e[12] === 0 && e[13] === 0 && e[14] === 0;
      const tr = e[0] === 1 && e[5] === 1 && e[10] === 1 && e[1] === 0 && e[2] === 0 && e[4] === 0 && e[6] === 0 && e[8] === 0 && e[9] === 0; // 只有平移（第 9 批：房子用世界座標挑三角形）
      MESH.push({ m, cx: V3.x, cz: V3.z, r: bs.radius + 1, id, tx: e[12], ty: e[13], tz: e[14], skip: !tr || SKIP_MESH.test(m.name || '') || !(m.geometry.attributes.position.array instanceof Float32Array) });
    });
    return MESH;
  }
  function flatten(c) { // c＝碰撞物（drive.js 的那一份）
    const h = Math.max(0.25, c.h ?? 1), cs = Math.cos(c.rot || 0), sn = Math.sin(c.rot || 0);
    const rx = (c.t === 'box' ? c.hx : c.r) + 0.22, rz = (c.t === 'box' ? c.hz : c.r) + 0.22, reach = Math.sqrt(rx * rx + rz * rz);
    const k = PROP_FLAT / h, rr = c.t === 'circle' ? rx * rx : 0;
    let n = 0;
    const L = meshes();
    for (let j = 0; j < L.length; j++) {
      const q = L[j];
      if (Math.abs(q.cx - c.x) > q.r + reach || Math.abs(q.cz - c.z) > q.r + reach) continue;
      const A = q.m.geometry.attributes.position, arr = A.array;
      let lo = -1, hi = -1;
      for (let i = 0; i < arr.length; i += 3) {
        const y = arr[i + 1]; if (y <= 0.04 || y > h + 0.5) continue;
        let x = arr[i], z = arr[i + 2];
        if (!q.id) { V3.set(x, y, z).applyMatrix4(q.m.matrixWorld); x = V3.x; z = V3.z; }
        const dx = x - c.x, dz = z - c.z;
        if (rr) { if (dx * dx + dz * dz > rr) continue; }
        else if (Math.abs(dx * cs - dz * sn) > rx || Math.abs(dx * sn + dz * cs) > rz) continue;
        arr[i + 1] = y * k; n++;
        if (lo < 0) lo = i; hi = i + 3;
      }
      if (lo >= 0) { const R = RGP[rgi++ % RGP.length]; R.start = lo; R.count = hi - lo; if (A.updateRanges.length) { A.clearUpdateRanges(); A.needsUpdate = true; } else { A.updateRanges.push(R); A.needsUpdate = true; } } // 只上傳改到的那一段（第 9 批：還有別的沒上傳的：整個上傳，範圍才不會亂）
    }
    st.flats += n;
    return n;
  }

  // ==== 第 9 批（路變大）：越野車輾大東西（房子、樹、路燈、牆⋯）====
  const anyNow = () => (o.any ? !!o.any() : ME.big);
  const BIG = []; // 壓扁的：{ grp, items, nb, x, z, b0..b3（範圍）, top, rub, M, phase（0 挑三角形 1 壓下去 2 扁了）, cand, mi, ti, sel, segs, t, inst, chunks, bld }
  // 碰撞物的格子（8 公尺；V.colliders 後來加的（內湖）下次自己補進來）＋同一棟（g）的清單
  const CG = 8, cgrid = new Map(), gmap = new Map(); let cgN = 0, cgS = 0;
  const cgKey = (i, j) => i * 73856 + j;
  function cgAdd(max = Infinity) { // max：這次最多放幾個（越野車開出來的時候分幾幀慢慢放）
    const L = V.colliders; if (!L) return true;
    for (let n = 0; cgN < L.length; cgN++) {
      if (n++ >= max) return false;
      const c = L[cgN]; if (!c || !isFinite(c.x)) continue;
      const e = c.t === 'box' ? Math.abs(Math.cos(c.rot || 0)) * c.hx + Math.abs(Math.sin(c.rot || 0)) * c.hz : c.r, f = c.t === 'box' ? Math.abs(Math.sin(c.rot || 0)) * c.hx + Math.abs(Math.cos(c.rot || 0)) * c.hz : c.r;
      if (e > 60 || f > 60) continue; // 很長的（地圖的邊）不用放
      for (let i = Math.floor((c.x - e) / CG); i <= Math.floor((c.x + e) / CG); i++) for (let j = Math.floor((c.z - f) / CG); j <= Math.floor((c.z + f) / CG); j++) { const k = cgKey(i, j); let a = cgrid.get(k); if (!a) cgrid.set(k, (a = [])); a.push(c); }
      if (c.g != null) { let a = gmap.get(c.g); if (!a) gmap.set(c.g, (a = [])); a.push(c); }
    }
    return true;
  }
  function cgNear(x0, z0, x1, z1, out) { // 這個範圍的碰撞物（不重複）→ out
    cgS++; out.length = 0;
    for (let i = Math.floor(x0 / CG); i <= Math.floor(x1 / CG); i++) for (let j = Math.floor(z0 / CG); j <= Math.floor(z1 / CG); j++) {
      const a = cgrid.get(cgKey(i, j)); if (!a) continue;
      for (let k = 0; k < a.length; k++) { const c = a[k]; if (c._cs === cgS) continue; c._cs = cgS; out.push(c); }
    }
    return out;
  }
  const NB = [];
  const inside = (c, x, z, m) => { if (c.t === 'circle') return Math.hypot(x - c.x, z - c.z) < c.r + m; const cs = Math.cos(c.rot || 0), sn = Math.sin(c.rot || 0), dx = x - c.x, dz = z - c.z; return Math.abs(dx * cs - dz * sn) < c.hx + m && Math.abs(dx * sn + dz * cs) < c.hz + m; };
  // 一棟：同一個 g（內湖的房子好幾個盒子）；沒有 g 的：自己＋中心在它裡面、比它小的東西（冷氣、招牌、雨遮⋯）
  function groupOf(src) {
    const out = [];
    if (src.g != null && gmap.has(src.g)) { for (const c of gmap.get(src.g)) if (!gone(c)) out.push(c); }
    if (!out.includes(src)) out.push(src);
    if (src.t === 'box' && (src.h ?? 9) >= 2.4) {
      const a = src.hx * src.hz, r = Math.hypot(src.hx, src.hz) + 1;
      for (const c of cgNear(src.x - r, src.z - r, src.x + r, src.z + r, NB)) {
        if (out.includes(c) || gone(c) || c.noCrush || c.circuit || (c.g != null && c.g !== src.g)) continue;
        const ca = c.t === 'box' ? c.hx * c.hz : c.r * c.r * 3.14; if (ca >= a * 0.6) continue;
        if (inside(src, c.x, c.z, 0.8)) out.push(c);
      }
    }
    return out;
  }
  // 三角形的中心離這棟（items）多遠（裡面＝0）；離別的東西（nb）多遠
  function outD(L, n, x, z) {
    let best = 1e9;
    for (let i = 0; i < n; i += 7) {
      const dx = x - L[i], dz = z - L[i + 1]; let d;
      if (L[i + 6] > 0) d = Math.max(0, Math.hypot(dx, dz) - L[i + 6]);
      else { const u = Math.abs(dx * L[i + 2] - dz * L[i + 3]) - L[i + 4], w = Math.abs(dx * L[i + 3] + dz * L[i + 2]) - L[i + 5]; d = u > 0 ? (w > 0 ? Math.hypot(u, w) : u) : w > 0 ? w : 0; }
      if (d < best) { best = d; if (d === 0) return 0; }
    }
    return best;
  }
  const pack = (list) => { const L = new Float64Array(list.length * 7); list.forEach((c, i) => { const k = i * 7; L[k] = c.x; L[k + 1] = c.z; L[k + 2] = Math.cos(c.rot || 0); L[k + 3] = Math.sin(c.rot || 0); L[k + 4] = c.hx || 0; L[k + 5] = c.hz || 0; L[k + 6] = c.t === 'circle' ? c.r : -1; }); return L; };
  // 共用的：瓦礫（一塊一塊）、灰塵（一團一團變大再縮掉）；沒在用的時候不畫
  let RUBM = null, DUSTM = null, rubN = 0;
  const RUB_N = 192, DUST_N = 36, M4 = new THREE.Matrix4(), QT = new THREE.Quaternion(), SV = new THREE.Vector3(), PV = new THREE.Vector3(), EU = new THREE.Euler();
  const PUFF = []; for (let i = 0; i < DUST_N / 6; i++) PUFF.push({ on: false, x: 0, z: 0, s: 1, t: 0 });
  let rr = 12345; const rnd = () => ((rr = (rr * 16807) % 2147483647) / 2147483647);
  function fxInit() {
    if (RUBM || !V.group) return;
    RUBM = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x9c9384, roughness: 1, flatShading: true }), RUB_N);
    RUBM.name = 'crush-rubble'; RUBM.count = 0; RUBM.frustumCulled = false; RUBM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); RUBM.visible = false;
    DUSTM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xd9ccb0, roughness: 1, flatShading: true, transparent: true, opacity: 0.55, depthWrite: false }), DUST_N);
    DUSTM.name = 'crush-dust'; DUSTM.count = DUST_N; DUSTM.frustumCulled = false; DUSTM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); DUSTM.visible = false;
    M4.makeScale(0, 0, 0); for (let i = 0; i < RUB_N; i++) RUBM.setMatrixAt(i, M4); for (let i = 0; i < DUST_N; i++) DUSTM.setMatrixAt(i, M4);
    V.group.add(RUBM); V.group.add(DUSTM);
  }
  function puff(x, z, s) { // 灰塵（一團 6 顆）
    fxInit(); if (!DUSTM) return;
    let q = PUFF[0]; for (const p of PUFF) { if (!p.on) { q = p; break; } if (p.t > q.t) q = p; }
    q.on = true; q.x = x; q.z = z; q.s = s; q.t = 0; DUSTM.visible = true;
  }
  function dustTick(dt) {
    if (!DUSTM || !DUSTM.visible) return;
    let any = false;
    for (let i = 0; i < PUFF.length; i++) {
      const q = PUFF[i];
      if (q.on) { q.t += dt; if (q.t > 1.3) { q.on = false; } }
      for (let k = 0; k < 6; k++) {
        const j = i * 6 + k;
        if (!q.on) { M4.makeScale(0, 0, 0); DUSTM.setMatrixAt(j, M4); continue; }
        any = true;
        const a = (k / 6) * Math.PI * 2 + i, e = Math.min(1, q.t / 0.5), r = q.s * (0.35 + 0.65 * e), sc = q.s * (0.35 + 0.55 * e) * (q.t > 0.8 ? Math.max(0, 1 - (q.t - 0.8) / 0.5) : 1);
        PV.set(q.x + Math.cos(a) * r, 0.4 + q.s * 0.25 * e + (k % 2) * q.s * 0.3, q.z + Math.sin(a) * r); SV.set(sc, sc * 0.75, sc);
        M4.compose(PV, QT.identity(), SV); DUSTM.setMatrixAt(j, M4);
      }
    }
    DUSTM.instanceMatrix.needsUpdate = true;
    if (!any) DUSTM.visible = false;
  }
  function rubble(j) { // 瓦礫：照範圍大小放幾塊（池子轉一圈用）
    fxInit(); if (!RUBM) return;
    const L = j.items, n = Math.min(10, Math.max(j.tree ? 1 : 3, Math.round(((j.b2 - j.b0) * (j.b3 - j.b1)) / 14)));
    for (let k = 0; k < n; k++) {
      const i = (Math.floor(rnd() * (L.length / 7)) * 7) | 0, cx = L[i], cz = L[i + 1];
      let x = cx, z = cz;
      if (L[i + 6] > 0) { const a = rnd() * 6.283, r = rnd() * (L[i + 6] + 0.6); x += Math.cos(a) * r; z += Math.sin(a) * r; }
      else { const u = (rnd() * 2 - 1) * L[i + 4] * 0.85, w = (rnd() * 2 - 1) * L[i + 5] * 0.85; x += u * L[i + 2] + w * L[i + 3]; z += -u * L[i + 3] + w * L[i + 2]; }
      const sc = (j.tree ? 0.35 : 0.5 + rnd() * 0.7) * Math.min(1.6, 0.6 + j.rub);
      const id = rubN++ % RUB_N; j.chunks.push(id);
      PV.set(x, j.rub * 0.55, z); EU.set(rnd() * 3, rnd() * 3, rnd() * 3); QT.setFromEuler(EU); SV.set(sc, sc * 0.6, sc);
      M4.compose(PV, QT, SV); RUBM.setMatrixAt(id, M4);
    }
    RUBM.count = Math.min(RUB_N, Math.max(RUBM.count, rubN)); RUBM.instanceMatrix.needsUpdate = true; RUBM.visible = true;
  }
  function bigHit(c, speed) {
    const h0 = typeof performance !== 'undefined' ? performance.now() : 0;
    fxInit(); cgAdd();
    const src = c.src || c, grp = groupOf(src);
    for (const g of grp) g.crushed = true;
    if (BIG.length >= REC_MAX) { let fi = 0, fd = -1; for (let i = 0; i < BIG.length; i++) { const d = Math.abs(BIG[i].x - ME.x) + Math.abs(BIG[i].z - ME.z); if (d > fd) { fd = d; fi = i; } } restoreJob(BIG[fi]); BIG.splice(fi, 1); }
    let b0 = 1e9, b1 = 1e9, b2 = -1e9, b3 = -1e9, top = 0;
    for (const g of grp) { const e = g.t === 'box' ? Math.abs(Math.cos(g.rot || 0)) * g.hx + Math.abs(Math.sin(g.rot || 0)) * g.hz : g.r, f = g.t === 'box' ? Math.abs(Math.sin(g.rot || 0)) * g.hx + Math.abs(Math.cos(g.rot || 0)) * g.hz : g.r; b0 = Math.min(b0, g.x - e); b2 = Math.max(b2, g.x + e); b1 = Math.min(b1, g.z - f); b3 = Math.max(b3, g.z + f); top = Math.max(top, g.h ?? 9); }
    const tree = src.t === 'circle', thin = tree && src.r < 0.45;
    const M = thin ? clamp(top * 0.6, 0.6, 4.5) : tree ? clamp(top * 0.45, 0.6, 4.2) : top >= 2.4 ? 1.6 : 0.5; // 往外多抓幾公尺（樹冠、路燈的燈頭、招牌、屋簷）
    const rub = thin ? 0.12 : tree ? 0.18 : clamp(top * 0.1, 0.15, 0.8);
    const j = { grp, items: pack(grp), nb: null, x: (b0 + b2) / 2, z: (b1 + b3) / 2, b0, b1, b2, b3, top, rub, M, tree, phase: 0, cand: [], mi: 0, ti: 0, sel: [], segs: [], t: 0, inst: null, chunks: [], bld: [], k: 1, away: 0 };
    // 別的東西（三角形比較靠它們的不要壓）
    const nb = []; for (const q of cgNear(b0 - M - 2, b1 - M - 2, b2 + M + 2, b3 + M + 2, NB)) if (!grp.includes(q) && (q.h ?? 9) > 0.3) nb.push(q);
    j.nb = pack(nb);
    // 走得進去的房子：門關起來（V.buildings 的那一筆 crushed）
    if (V.buildings && !tree) for (const b of V.buildings) { if (b.crushed || Math.abs(b.x - j.x) > 60 || Math.abs(b.z - j.z) > 60) continue; for (const g of grp) if (g.t === 'box' && inside(g, b.x, b.z, 0.5)) { b.crushed = true; j.bld.push(b); break; } }
    // 內湖的樹（InstancedMesh）：那一棵壓扁
    if (src.im && src.ti != null) { const m = src.im, A = m.instanceMatrix.array, o16 = src.ti * 16; j.inst = { m, i: src.ti, e: A.slice(o16, o16 + 16), R: { start: o16, count: 16 } }; }
    // 要找的網格：範圍碰得到的
    const L = meshes();
    for (let i = 0; i < L.length; i++) { const q = L[i]; if (q.skip) continue; if (q.cx + q.r < b0 - M || q.cx - q.r > b2 + M || q.cz + q.r < b1 - M || q.cz - q.r > b3 + M) continue; j.cand.push(q); }
    if (j.inst) j.cand.length = 0; // 內湖的樹：只有它自己（InstancedMesh）
    BIG.push(j);
    st.big++; note(tree ? (thin ? 'pole' : 'tree') : top >= 2.4 ? 'building' : 'wall');
    const sz = Math.min(5, 1 + Math.sqrt((b2 - b0) * (b3 - b1)) * 0.25);
    puff(j.x, j.z, tree ? 1.2 : sz);
    if (o.sound) { o.sound('crunch', j.x, j.z, clamp(0.3 + top / 30 + Math.abs(speed || 0) / 50, 0.3, 0.6)); if (!tree && top >= 2.4) o.sound('glass', j.x, j.z, 0.3); }
    police(j.x, j.z);
    const hm = (typeof performance !== 'undefined' ? performance.now() : 0) - h0; if (hm > st.hitMs) st.hitMs = hm;
    return true;
  }
  // 挑三角形（分幾幀做：每幀最多 SEL_MS 毫秒）
  const T3 = new Float64Array(9);
  function selectStep(j, tEnd) {
    const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
    const I = j.items, NI = I.length, NBL = j.nb, NN = NBL.length, M = j.M, x0 = j.b0 - M, x1 = j.b2 + M, z0 = j.b1 - M, z1 = j.b3 + M, ymax = j.top + 4;
    while (j.mi < j.cand.length) {
      const q = j.cand[j.mi], g = q.m.geometry, A = g.attributes.position, P = A.array, X = g.index ? g.index.array : null, nt = X ? X.length / 3 : A.count / 3;
      const tx = q.tx, ty = q.ty, tz = q.tz;
      let n = 0;
      for (; j.ti < nt; j.ti++) {
        if ((++n & 511) === 0 && now() > tEnd) return false;
        const t = j.ti, a = X ? X[t * 3] : t * 3, b = X ? X[t * 3 + 1] : t * 3 + 1, c = X ? X[t * 3 + 2] : t * 3 + 2;
        const ax = P[a * 3] + tx, az = P[a * 3 + 2] + tz, bx = P[b * 3] + tx, bz = P[b * 3 + 2] + tz, cx = P[c * 3] + tx, cz = P[c * 3 + 2] + tz;
        const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3;
        if (mx < x0 || mx > x1 || mz < z0 || mz > z1) continue;
        const ay = P[a * 3 + 1] + ty, by = P[b * 3 + 1] + ty, cy = P[c * 3 + 1] + ty, hi = ay > by ? (ay > cy ? ay : cy) : by > cy ? by : cy;
        if (hi < 0.25 || Math.min(ay, by, cy) > ymax) continue; // 地上的（路、人行道）、比它高很多的（別棟）
        // 法線（往裡面縮 0.1 公尺）：隔壁貼著的牆、屋簷才不會被算進來
        const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
        let nx = uy * vz - uz * vy, nz = ux * vy - uy * vx; const ny = uz * vx - ux * vz, nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; nz /= nl;
        const px = mx - nx * 0.1, pz = mz - nz * 0.1, d = outD(I, NI, px, pz);
        if (d > M) continue;
        if (d > 0 && NN && outD(NBL, NN, px, pz) <= d) continue; // 在範圍外面：比較靠別的東西的不要（在裡面的一定是它的）
        j.sel.push(a, b, c);
      }
      if (j.sel.length) { // 這個網格挑好了：記下來（頂點、原本的 y）
        const idx = Int32Array.from(j.sel); let lo = 1e9, hi = -1; const y0 = new Float32Array(idx.length);
        for (let i = 0; i < idx.length; i++) { const v = idx[i]; y0[i] = P[v * 3 + 1]; if (v < lo) lo = v; if (v > hi) hi = v; }
        j.segs.push({ A, idx, y0, lo, hi, ty, R: { start: lo * 3, count: (hi - lo + 1) * 3 } }); // R：這一段自己的上傳範圍（還沒上傳就不要再放一次）
        j.sel.length = 0;
      }
      j.mi++; j.ti = 0;
    }
    return true;
  }
  const upd = (A, R, start, count) => { // 上傳範圍：每一段自己一個（還沒畫出去前不要重複放；three.js 合併的時候會改 count）
    if (A.updateRanges.indexOf(R) < 0) { R.start = start; R.count = count; A.updateRanges.push(R); }
    A.needsUpdate = true;
  };
  function setK(j, k) { // 頂點的 y＝原本 × k（只上傳改到的那一段）
    for (const sg of j.segs) {
      const P = sg.A.array, I = sg.idx, Y = sg.y0, ty = sg.ty;
      for (let i = 0; i < I.length; i++) P[I[i] * 3 + 1] = (Y[i] + ty) * k - ty;
      upd(sg.A, sg.R, sg.lo * 3, (sg.hi - sg.lo + 1) * 3);
    }
    if (j.inst) { // 內湖的樹：矩陣的 y 軸縮下去、x z 放大一點（扁扁的一片）
      const A = j.inst.m.instanceMatrix, E = A.array, o16 = j.inst.i * 16, e = j.inst.e, kk = Math.max(k, 0.06), w = 1 + (1 - kk) * 0.35;
      for (let r = 0; r < 16; r++) E[o16 + r] = e[r] * (r < 3 || (r >= 8 && r < 11) ? w : r >= 4 && r < 7 ? kk : 1);
      upd(A, j.inst.R, o16, 16);
    }
    j.k = k;
  }
  function restoreJob(j) {
    if (j.phase > 0 || j.segs.length || j.inst) setK(j, 1);
    for (const g of j.grp) g.crushed = false;
    for (const b of j.bld) b.crushed = false;
    if (RUBM && j.chunks.length) { M4.makeScale(0, 0, 0); for (const id of j.chunks) RUBM.setMatrixAt(id, M4); RUBM.instanceMatrix.needsUpdate = true; }
    j.chunks.length = 0; j.phase = 3; st.restored++;
  }
  function restoreAll() { // 全部長回來（後來壓的先回去：頂點原本的 y 才對）
    for (let i = BIG.length - 1; i >= 0; i--) restoreJob(BIG[i]);
    BIG.length = 0; rubN = 0; if (RUBM) { RUBM.count = 0; RUBM.visible = false; }
  }
  let warm = 0;
  function bigTick(dt, live) {
    if (!BIG.length) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0, tEnd = t0 + SEL_MS;
    for (let i = 0; i < BIG.length; i++) {
      const j = BIG[i];
      if (j.phase === 0) { if (selectStep(j, tEnd)) { j.phase = 1; j.t = 0; rubble(j); } }
      else if (j.phase === 1) { j.t += dt; const f = ease(j.t / FALL_T), kf = j.rub / Math.max(j.top, j.rub + 0.01); setK(j, 1 - f * (1 - kf)); if (j.t >= FALL_T) j.phase = 2; }
      j.away = live && Math.abs(ME.x - j.x) < FAR && Math.abs(ME.z - j.z) < FAR ? 0 : j.away + dt; // 離它多久了
    }
    const ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0; if (ms > st.bigMs) st.bigMs = ms;
    // 離開 140 公尺以上 25 秒：長回來（後來壓的、範圍重疊的還扁著的話先等它：頂點原本的 y 才對）
    for (let i = BIG.length - 1; i >= 0; i--) {
      const j = BIG[i]; if (j.away <= AWAY || j.phase === 0) continue;
      let busy = false; for (let k = i + 1; k < BIG.length; k++) { const q = BIG[k]; if (q.b0 - q.M < j.b2 + j.M && q.b2 + q.M > j.b0 - j.M && q.b1 - q.M < j.b3 + j.M && q.b3 + q.M > j.b1 - j.M) { busy = true; break; } }
      if (busy) continue;
      restoreJob(j); BIG.splice(i, 1);
    }
    if (!BIG.length && RUBM) { rubN = 0; RUBM.count = 0; RUBM.visible = false; }
  }
  function bigHeight(x, z) { // 壓扁的房子（瓦礫）上面多高（開得上去）
    let best = 0;
    for (let i = 0; i < BIG.length; i++) {
      const j = BIG[i]; if (j.phase === 0 || j.rub < 0.3 || x < j.b0 - RAMP || x > j.b2 + RAMP || z < j.b1 - RAMP || z > j.b3 + RAMP) continue;
      const L = j.items, top = j.rub * (j.phase === 2 ? 1 : ease(j.t / FALL_T)), d = outD(L, L.length, x, z);
      if (d >= RAMP) continue;
      const h = d <= 0 ? top : top * ease(1 - d / RAMP); if (h > best) best = h;
    }
    return best;
  }
  // 警車：police-ai 壓扁、警察下車跑掉（+2★ 它自己報）；這裡放墊子（開得上去）、聲音、灰塵
  function copHit(c, speed) {
    if (!o.copWreck) return false;
    const w = o.copWreck(c.pi, ME.x, ME.z); if (!w) return false;
    const q = take(); if (q) { setPad(q, 'cop', w.x, w.z, w.th, w.hl, w.hw, CAR_H, CAR_FLAT, true); q.snd |= 1; }
    st.cops++; note('cop'); puff(w.x, w.z, 1.6);
    if (o.sound) { o.sound('crunch', w.x, w.z, clamp(0.42 + Math.abs(speed || 0) / 60, 0.42, 0.6)); o.sound('glass', w.x, w.z, 0.3); }
    return true;
  }

  // ---- 輾到了 ----
  const label = (c) => (c.junk ? 'junk' : c.t === 'circle' ? (c.r <= 0.1 ? 'pole' : 'bin') : c.hz <= 0.45 ? 'scooter' : 'bench');
  function note(kind) { st.types.push(kind); if (st.types.length > 40) st.types.shift(); }
  function police(x, z) { // 越野車場裡面不算犯罪；一路輾過去（8 秒內）只報一次
    if (terrainAt(x, z) || !o.crime || clock - crimeT < CRIME_GAP) return;
    crimeT = clock;
    try { o.crime(x, z); } catch (e) { console.warn(e); }
  }
  function hit(c, speed) { // drive.js：怪獸卡車碰到輾得過去的東西（那個碰撞物已經不擋了）
    if (!alive || !c) return false;
    if (c.junk === true) return true; // 垃圾車：墊子早就在了（update 自己算）
    if (c.police === true) return copHit(c, speed); // 第 9 批：警車
    if (!small(c)) return bigHit(c, speed); // 第 9 批：大東西（房子、樹、路燈⋯）
    const q = take(); if (!q) return false;
    setPad(q, 'prop', c.x, c.z, c.t === 'box' ? c.rot || 0 : 0, c.t === 'box' ? c.hx : c.r, c.t === 'box' ? c.hz : c.r, Math.min(1.5, Math.max(0.3, c.h ?? 0.9)), PROP_FLAT, true);
    q.col = c;
    st.props++; note(label(c));
    if (o.sound) o.sound('crunch', c.x, c.z, clamp(0.16 + Math.abs(speed || 0) / 40, 0.14, 0.4));
    q.snd |= 1;
    flatten(c);
    q.flat = true;
    police(c.x, c.z);
    // 村子本來的碰撞物（V.colliders）那一份也記起來：換別台車出門、走路的時候也知道它扁了（不擋）
    if (c.src) { c.src.crushed = true; return true; } // 第 9 批：drive.js 的那一份記著原來那個（src）
    const L = V.colliders;
    if (L) for (let i = 0; i < L.length; i++) { const q = L[i]; if (q.crushed !== true && q.t === c.t && q.x === c.x && q.z === c.z) { q.crushed = true; break; } }
    return true;
  }
  function hitTraffic(car) { // npc.js：路上的車被怪獸卡車輾到（npc.js 已經把它從車流裡拿出來、停住）
    if (!alive || !car) return false;
    const q = take(); if (!q) return false;
    const moto = car.kind === 'scooter'; // 第 13 批：機車（矮、扁到跟路邊的東西一樣）
    setPad(q, 'car', car.x, car.z, car.heading, car.hx, car.hz, moto ? 1.1 : CAR_H, moto ? PROP_FLAT : CAR_FLAT, true);
    q.car = car; q.lod = car.lod || car.squash || null;
    st.cars++; note('car');
    // 車上的人先跳車跑掉（往怪獸卡車的反方向、車身的旁邊；不會被輾到）
    const dx = car.x - ME.x, dz = car.z - ME.z, d = Math.hypot(dx, dz) || 1;
    let sx = Math.sin(car.heading), sz = Math.cos(car.heading); // 車身的右邊
    if (sx * dx + sz * dz < 0) { sx = -sx; sz = -sz; } // 離怪獸卡車遠的那一邊
    if (o.bail) { try { st.bails += o.bail(car.x + sx * 1.6, car.z + sz * 1.6, (sx * 2 + dx / d) / 3, (sz * 2 + dz / d) / 3) || 0; } catch (e) { console.warn(e); } }
    if (q.lod && q.lod.driver) q.lod.driver.group.visible = false; // 駕駛下車了：車裡沒人
    if (o.sound) o.sound('crunch', car.x, car.z, 0.42);
    q.snd |= 1;
    police(car.x, car.z);
    return true;
  }

  // ---- 表演場的垃圾車（越野車場；輾爆好玩的，不會報警）----
  function junkPad(j) {
    const q = take(); if (!q) return null;
    setPad(q, 'junk', j.x, j.z, j.h, j.hx, j.hz, CAR_H, CAR_FLAT, false);
    q.lod = j.lod; q.junk = JUNK.indexOf(j); j.pad = q;
    return q;
  }
  function junkTick(dt, live) {
    if (!SHOW || !o.makeJunk || !SHOW.cars) return;
    const d = Math.hypot(ME.x - SHOW.cx, ME.z - SHOW.cz), near = live && d < JUNK_FAR;
    if (near && jN < SHOW.cars.length && !jBusy) { // 一次做一台（做一台輕量車 10～25 毫秒）
      jBusy = true;
      const i = jN, p = SHOW.cars[i];
      Promise.resolve().then(() => o.makeJunk(i, p)).then((l) => {
        jBusy = false;
        if (!alive || !l) { jN = SHOW.cars.length; return; }
        jN = i + 1;
        const j = { lod: l, x: p[0], z: p[1], h: p[2] || 0, hx: 2.2, hz: 0.9, pad: null };
        const b = new THREE.Box3().setFromObject(l.car); // 這台多長多寬（輕量車）
        if (isFinite(b.max.x)) { j.hx = (b.max.x - b.min.x) / 2; j.hz = Math.max(b.max.z, -b.min.z); }
        l.car.position.set(j.x, heightOf(j.x, j.z), j.z); l.car.rotation.set(0, j.h, 0); l.car.visible = true;
        JUNK.push(j); junkPad(j); colVer++;
      }).catch((e) => { jBusy = false; jN = SHOW.cars.length; console.warn('crush: 垃圾車做不出來', e); });
    }
    // 離開很久（或回車庫）：輾扁的垃圾車全部擺回來
    awayT = live && d < JUNK_AWAY ? 0 : awayT + dt;
    if (awayT > 2) for (let i = 0; i < JUNK.length; i++) if (JUNK[i].pad && JUNK[i].pad.sq > 0) respawn(JUNK[i]);
  }
  function respawn(j) {
    const q = j.pad; if (!q) return;
    q.sq = 0; q.sqA = -1; q.snd = 0; q.ct = -99; q.t = 0; q.h = q.h0; q.grow = 1;
    if (j.lod) { j.lod.setSquash(0); j.lod.car.position.y = heightOf(j.x, j.z); }
    colVer++;
  }

  // ---- 每一幀 ----
  function update(dt) {
    if (!alive || !(dt > 0)) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    clock += dt;
    const live = o.getCar ? !!o.getCar(ME) : false;
    if (live && warm < 2 && anyNow()) { if (!warm) { warm = 1; fxInit(); meshes(); } else if (cgAdd(1500)) warm = 2; } // 第 9 批：越野車開出來就先做好（分幾幀；第一次輾房子不會卡一下）
    junkTick(dt, live);
    bigTick(dt, live); dustTick(dt); // 第 9 批：房子壓下去、灰塵、太久沒回來就長回來
    for (let i = 0; i < PAD.length; i++) {
      const q = PAD[i]; if (!q.on) continue;
      q.t += dt;
      if (q.grow < 1) q.grow = Math.min(1, q.grow + dt / GROW_T);
      // 開上去：壓扁（開上去的時候壓；輾到過的就一路扁到底，不會壓一半停在那裡）
      const on = q.sq < 1 && live && ME.big && over(q, 0.4);
      if (on || (q.sq < 1 && (q.snd & 1))) {
        q.sq = Math.min(1, q.sq + dt / SQ_T);
        if (on && q.kind === 'junk' && q.sq > 0.02 && !(q.snd & 1)) { // 垃圾車：第一下才算輾到
          q.snd |= 1; q.ct = q.t; st.junk++; note('junk'); colVer++;
          if (o.sound) o.sound('crunch', q.x, q.z, 0.42);
          if (!toldPark) { toldPark = true; if (o.toast) o.toast('輾扁了！'); }
        }
        if (q.sq > 0.35 && !(q.snd & 2) && q.kind !== 'prop' && q.kind !== 'cop') { q.snd |= 2; if (o.sound) o.sound('glass', q.x, q.z, 0.3); } // 玻璃破掉
        if (q.sq > 0.5 && !q.flat && q.kind === 'prop' && q.col) { q.flat = true; flatten(q.col); }
      }
      q.h = (q.h0 + (q.hf - q.h0) * ease(q.sq)) * q.grow;
      if (q.lod && q.sq !== q.sqA) { q.sqA = q.sq; q.lod.setSquash(q.sq); } // 車頂壓下來、玻璃破掉、車身變矮
      // 收掉／回來
      if (q.kind === 'car' || q.kind === 'cop') { // 第 9 批：警車（police-ai 自己 20 秒後收掉）
        if (q.t > KEEP) { // 路邊留 20 秒 → 淡掉（沉下去）→ 收回車流的池子
          const f = Math.min(1, (q.t - KEEP) / FADE);
          if (q.lod) q.lod.car.position.y = -f * 0.9;
          q.h = q.h * (1 - f);
          if (f >= 1) { if (q.lod) q.lod.car.position.y = 0; finish(q); }
        }
      } else if (q.kind === 'prop') {
        if (q.sq >= 1 && (!live || Math.abs(ME.x - q.x) + Math.abs(ME.z - q.z) > 9)) finish(q); // 壓扁了、人走了：墊子不用留（網格已經扁了）
      } else if (q.kind === 'junk') {
        if (q.sq > 0 && q.t - q.ct > JUNK_BACK && !(live && over(q, 2))) respawn(JUNK[q.junk]);
      }
    }
    const ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    st.ms += ms; if (ms > st.maxMs) st.maxMs = ms; st.frames++;
  }

  // ---- 還沒輾扁的垃圾車：給「不是怪獸卡車」的車擋（怪獸卡車的時候沒有：直接開上去）----
  function colliders() {
    COL.length = 0;
    if (ME.big) return COL;
    for (let i = 0; i < JUNK.length; i++) {
      const j = JUNK[i]; if (!j.pad || j.pad.sq > 0.5) continue;
      COL.push({ t: 'box', x: j.x, z: j.z, hx: j.hx, hz: j.hz, rot: j.h, h: 1.35, junk: true, noCrush: true });
    }
    return COL;
  }
  function reset() { // 回車庫頁
    for (let i = 0; i < PAD.length; i++) { const q = PAD[i]; if (q.on && q.junk < 0) finish(q); }
    for (let i = 0; i < JUNK.length; i++) if (JUNK[i].pad && JUNK[i].pad.sq > 0) respawn(JUNK[i]);
    awayT = 0; crimeT = -99;
    restoreAll(); // 第 9 批：壓扁的房子、樹⋯全部長回來
  }
  function dispose() {
    alive = false;
    for (let i = 0; i < PAD.length; i++) if (PAD[i].on) finish(PAD[i]);
    for (const j of JUNK) { if (j.lod) j.lod.dispose(); }
    JUNK.length = 0; MESH = null;
    restoreAll();
    for (const m of [RUBM, DUSTM]) if (m) { if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); }
    RUBM = DUSTM = null;
  }
  return {
    heightAt, can: (c) => canAny(c, anyNow(), o.protect || null), hit, hitTraffic, update, colliders, reset, dispose, restoreAll,
    get colVer() { return colVer; }, get junk() { return JUNK; }, get pads() { return PAD; }, get big() { return BIG; }, stats: st, me: ME,
  };
}
return { createCrush };
})();
