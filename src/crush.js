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

// 哪些東西輾得過去（照碰撞物的大小分：跟 street.js 畫影子一樣的辦法）
//   圓：垃圾桶（r 0.32 h 0.95）、燈箱（0.28 × 1.3）、油桶、矮柱；細細的桿子（旗桿、小招牌）h 3 公尺以內
//   長方形：機車（0.82 × 0.3 h 1.1）、板凳、塑膠椅、矮花台、垃圾車（junk）
//   不輾：npc（路上的車：npc.js 自己算）、警車（police）、高的（樹、電線桿、路燈、橋墩）、大的（房子、牆、你自己的車、展示台、鐵捲門）
function can(c) {
  if (!c || c.crushed === true || c.npc || c.police === true || c.noCrush) return false;
  if (c.junk === true) return true;
  const h = c.h ?? 9;
  if (c.t === 'circle') return (c.r <= 0.62 && h <= 1.6) || (c.r <= 0.1 && h <= 3.0);
  return h <= 1.35 && c.hx <= 1.7 && c.hz <= 1.7;
}

function createCrush(o = {}) {
  const V = o.world || {}, SHOW = V.offroad && V.offroad.show ? V.offroad.show : null;
  const terrainAt = typeof V.terrainAt === 'function' ? V.terrainAt : () => false;
  const heightOf = typeof V.heightAt === 'function' ? V.heightAt : () => 0;
  let alive = true, colVer = 0, jN = 0, jBusy = false, awayT = 0, toldPark = false, crimeT = -99, clock = 0;
  const ME = { x: -0, z: -0, heading: -0, v: -0, hx: 2.8, hz: 1.9, big: false };
  const st = { cars: 0, junk: 0, props: 0, bails: 0, pads: 0, flats: 0, ms: -0, maxMs: -0, frames: 0, types: [] };
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
    return best;
  }

  // ---- 路邊的東西：合併網格裡那一塊的頂點壓下去（輾到的那一下做一次）----
  let MESH = null;
  const RGP = []; for (let i = 0; i < 8; i++) RGP.push({ start: 0, count: 0 });
  let rgi = 0;
  function meshes() {
    if (MESH) return MESH;
    MESH = [];
    const root = V.group || null; if (!root) return MESH;
    root.updateMatrixWorld(true);
    root.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh) return;
      const g = m.geometry, p = g && g.attributes && g.attributes.position;
      if (!p || p.count > 600000 || !(p.array instanceof Float32Array)) return;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const bs = g.boundingSphere; if (!bs) return;
      V3.copy(bs.center).applyMatrix4(m.matrixWorld);
      const e = m.matrixWorld.elements, id = e[0] === 1 && e[5] === 1 && e[10] === 1 && e[1] === 0 && e[2] === 0 && e[4] === 0 && e[6] === 0 && e[8] === 0 && e[9] === 0 && e[12] === 0 && e[13] === 0 && e[14] === 0;
      MESH.push({ m, cx: V3.x, cz: V3.z, r: bs.radius + 1, id });
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
      if (lo >= 0) { const R = RGP[rgi++ % RGP.length]; R.start = lo; R.count = hi - lo; A.updateRanges.length = 0; A.updateRanges.push(R); A.needsUpdate = true; } // 只上傳改到的那一段
    }
    st.flats += n;
    return n;
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
    const L = V.colliders;
    if (L) for (let i = 0; i < L.length; i++) { const q = L[i]; if (q.crushed !== true && q.t === c.t && q.x === c.x && q.z === c.z) { q.crushed = true; break; } }
    return true;
  }
  function hitTraffic(car) { // npc.js：路上的車被怪獸卡車輾到（npc.js 已經把它從車流裡拿出來、停住）
    if (!alive || !car) return false;
    const q = take(); if (!q) return false;
    setPad(q, 'car', car.x, car.z, car.heading, car.hx, car.hz, CAR_H, CAR_FLAT, true);
    q.car = car; q.lod = car.lod || null;
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
    junkTick(dt, live);
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
        if (q.sq > 0.35 && !(q.snd & 2) && q.kind !== 'prop') { q.snd |= 2; if (o.sound) o.sound('glass', q.x, q.z, 0.3); } // 玻璃破掉
        if (q.sq > 0.5 && !q.flat && q.kind === 'prop' && q.col) { q.flat = true; flatten(q.col); }
      }
      q.h = (q.h0 + (q.hf - q.h0) * ease(q.sq)) * q.grow;
      if (q.lod && q.sq !== q.sqA) { q.sqA = q.sq; q.lod.setSquash(q.sq); } // 車頂壓下來、玻璃破掉、車身變矮
      // 收掉／回來
      if (q.kind === 'car') {
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
  }
  function dispose() {
    alive = false;
    for (let i = 0; i < PAD.length; i++) if (PAD[i].on) finish(PAD[i]);
    for (const j of JUNK) { if (j.lod) j.lod.dispose(); }
    JUNK.length = 0; MESH = null;
  }
  return {
    heightAt, can, hit, hitTraffic, update, colliders, reset, dispose,
    get colVer() { return colVer; }, get junk() { return JUNK; }, get pads() { return PAD; }, stats: st, me: ME,
  };
}
return { createCrush };
})();
