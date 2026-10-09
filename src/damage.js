// ---- 撞爛：撞到東西車身會凹、玻璃會裂會碎、燈會破、後照鏡尾翼會斷掉、輪子會歪、引擎室冒煙；到阿輝改車廠付錢修好 ----
// Nick 2026-09-28：「車子需要可以撞爛」
// 車身座標跟 buildCar 一樣：+x 車頭、+z 右邊、−z 左邊（駕駛座那邊）、y 往上、輪子踩在 y＝0；單位公尺
//
// 【API】
//   const dmg = createDamage(S, { key, scene, audio, smoke });
//     S       buildCar()／車庫 loadCar() 回傳的整台車（完整的車）
//     key     車的代號（gc8、supra、p918⋯）：引擎在前還是在後（冒煙的位置、撞哪裡比較傷）
//     scene   斷掉的零件、碎玻璃、煙放在哪個 Object3D（可省略：車子所在的最上層，通常就是 scene）
//     audio   createEngineAudio() 回傳的（可省略）：撞的時候 audio.crash()、車況很差的時候 audio.hiss()
//     smoke   false＝不冒煙（車庫展示的車可以關掉）
//     建好就把這台車的車漆、車內、玻璃三個材質換成「會壞的」版本（shader 多一段；七台車共用同一組程式，只編譯一次）
//   dmg.hit(e)        撞一下。drive.js 的 onImpact 直接接：createDrive({ ..., onImpact: (e) => dmg.hit(e) })
//                     e＝{ speed（撞進去的速度 m/s）, px, pz（碰到的點，車身座標）, nx, nz（法線，往車子裡面的單位向量）,
//                          r（撞到的東西沿著切線的半寬 m；牆＝省略或很大）, ox, oz（撞到的東西的中心，車身座標）, h（它多高，省略＝3）, py（碰到的高度，可省略） }
//                     回傳 { dent（凹多深 m）, glass（這一下裂／碎幾片玻璃）, lamps（破幾個燈）, parts（掉幾個零件）, health } 或 null（太輕：9 km/h 以下）
//   dmg.update(dt)    每一幀叫：煙、掉下來的零件、碎片（沒有東西在動的時候幾乎不花時間，也不配置記憶體）
//   dmg.state         存檔用的小 JSON：{ v: 1, h: [[每一下 10 個數字], ...], x, hp, gl, lp, pt }；沒壞＝null
//   dmg.apply(state)  照存檔重播（先恢復原狀，再一下一下撞回去；跟當時撞的一模一樣）；null＝恢復原狀
//   dmg.repair()      修好：網格、玻璃、燈、後照鏡、尾翼、輪子全部恢復原狀，煙、掉在路上的零件也收掉
//   dmg.health        車況 0–1（1＝新的）
//   dmg.perf          { power, top, maxKmh, steerPull }：出力倍數、極速倍數、最高時速（很爛的時候 60，不然 Infinity）、方向盤偏（−1 左～1 右）
//                     → drive.setDamage(dmg.perf)（每次 hit、apply、repair 之後叫）
//   dmg.cost(price)   修車費（萬）＝DAMAGE.cost(dmg.state, price)
//   dmg.prepare()     先把網格分類、鄰接表算好，再在這台車上暖身撞三下（瀏覽器先編譯好、這台車會凹的網格先複製好，第一次撞才不會卡）：
//                     CPU 約 0.1–0.4 秒（測試機；918 最重），載入車子、開車出門的時候叫；不叫也可以（第一次 hit／apply 會自己算，但那一下會卡）；
//                     createDamage(S, { warm: false }) 不暖身（prepare 快一半，第一次撞多 10–70 ms）
//   dmg.clearDebris() 收掉掉在路上的零件、碎片、煙，嘶嘶聲也停（離開開車、去比賽的時候；之後 update 還會再冒煙）
//   dmg.setSmoke(on)  dmg.lastMs（最後一次 hit／apply 花幾毫秒）  dmg.dispose()（要在車庫 disposeCar 之前叫：換過的網格換回來）
//
//   const dl = damageLod(lod, state, { spec, scene });   輕量車（carlod.js buildLodCar 回傳的）：凹、玻璃破洞、燈變暗、零件拿掉
//     spec    LOD_CARS[key].spec（輪子、後照鏡的位置）；state：同一台車的存檔（可省略）
//     dl.hit(e)、dl.apply(state)、dl.repair()、dl.update(dt)、dl.state、dl.health、dl.dispose()（在 lod.dispose() 之前叫）
//     lod.setLook() 換了套件／尾翼／寬體（車身網格換掉了）也沒關係：下一次 hit／update 會自己重播
//
//   DAMAGE.cost(state, price)   修車費（萬，整數）：有壞就 1 萬起跳，全毀最多車價的 15%；沒壞＝0
//   DAMAGE.health(state)        存檔的車況；DAMAGE.V_MIN：比這個慢（m/s）撞不壞
//
// 【怎麼做的】
//   凹陷：每一下撞擊是一個「位移場」，只看頂點的位置（不看法線）：從第一個碰到的地方往車裡，越深推越少（平滑衰減），
//     加上手風琴一樣的皺摺、引擎蓋／後車廂蓋拱起來、兩邊鼓出來、保桿偏一邊垂下來；每個頂點離原位最多 42 公分（車艙 16 公分）
//     → 鏡射、重複的頂點（車身中線、摺邊）一定一起動，不會裂開；越快越爛（20 km/h 約 6 公分、50 km/h 21 公分、100 km/h 36 公分）
//     車內（cabin.js 的門板、座椅⋯）也凹：每個頂點當作在外面車殼那一層算（離車殼 10 公分內整個跟著），皺摺一律算往裡面最多 → 門凹進去，門板不會從外面穿出來
//   車身的貼圖（車窗、燈、飾條⋯）是照「原本的位置」投影的（masks.js），所以原本的位置另外存在 aP0／aN0，shader 改用它們查遮罩，
//     凹下去的地方貼圖跟著走；法線照「原本的法線＋（現在的面法線−原本的面法線）」重算，只算動到的頂點和旁邊一圈
//   玻璃、燈：shader 裡的 uniform（每台車自己的）：蜘蛛網裂痕、鋸齒邊的破洞、燈變暗＋裂痕
//   打包（build-art.mjs、build-app.mjs 會拿掉 import、export）：最上層只有 createDamage、damageLod、DAMAGE，其他都在 IIFE 裡
import * as THREE from 'three';

export const { createDamage, damageLod, DAMAGE } = (() => {
  const V_MIN = 2.6, MAX_HITS = 40, NG = 8, NL = 6, STEP = 2048;
  const MID = { p918: 1, sp3: 1, jesko: 1 }; // 引擎在後面（中置）的車
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const sst = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const q3 = (x) => Math.round(x * 1000) / 1000;
  const fin = (x, d) => (typeof x === 'number' && isFinite(x) ? x : d);
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const rng = (seed) => { const s = new Uint32Array([seed >>> 0 || 1]); return () => { s[0] = Math.imul(s[0], 1664525) + 1013904223; return s[0] / 4294967296; }; }; // 狀態放在 Uint32Array：放在變數裡的大整數每一次都會變成新的 HeapNumber（數列跟 >>> 0 的寫法一樣）
  const hashRec = (a, i) => { let h = (2166136261 ^ Math.imul(i + 1, 2654435761)) >>> 0; for (let k = 0; k < 8; k++) h = Math.imul(h ^ (Math.round(a[k] * 1000) | 0), 16777619) >>> 0; return h; };
  // 平滑的亂數場（2D value noise，0–1）：皺摺的走向不要太規則
  const vh = (i, j, s) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function vnoise(x, y, s) {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = vh(i, j, s), b = vh(i + 1, j, s), c = vh(i, j + 1, s), d = vh(i + 1, j + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const tri = (x) => { const f = x / TAU + 0.25, t = f - Math.floor(f); return 1 - 4 * Math.abs(t - 0.5); }; // 三角波：摺痕是尖的
  const fsin = (x) => { x -= TAU * Math.round(x / TAU); const y = 1.2732395447351628 * x - 0.4052847345693511 * x * Math.abs(x); return 0.225 * (y * Math.abs(y) - y) + y; }; // 快的 sin（誤差 0.001）
  // 撞多深（m）：越快越深，但有上限
  const crush = (v) => 0.5 * (1 - Math.exp(-Math.max(0, v - 3) / 20));

  // ================= 撞擊 =================
  // 存檔用的一下：[px, pz, nx, nz, v, uc, r, h, s0, py]（都量化到公厘，重播一定一樣）
  //   uc：撞到的東西的中心沿著切線（t＝(−nz, nx)）離碰到的點多遠；r：它沿著切線的半寬（9＝牆）；h：它多高；
  //   s0：第一個碰到的車身在法線方向的深度（撞的當下量的，存起來：換套件以後重播也一樣）；py：碰到的高度（−1＝沒給）
  function toRec(e) {
    let nx = fin(+e.nx, 0), nz = fin(+e.nz, 0);
    const l = Math.hypot(nx, nz);
    if (l < 1e-6) return null;
    nx /= l; nz /= l;
    const px = q3(fin(+e.px, 0)), pz = q3(fin(+e.pz, 0)), v = Math.round(fin(+e.speed, 0) * 100) / 100;
    const ox = fin(+e.ox, px), oz = fin(+e.oz, pz), uc = q3((ox - px) * -nz + (oz - pz) * nx);
    const r = e.r > 0 && e.r < 8 ? q3(e.r) : 9, h = e.h > 0 ? q3(Math.min(9, e.h)) : 3, py = e.py >= 0 ? q3(e.py) : -1;
    return [px, pz, q3(nx), q3(nz), v, uc, r, h, NaN, py];
  }
  // 碰到的點離車子太遠（座標系弄錯了，例如給了世界座標）：沿著法線搬到車子的外框上，不然整台車都會被壓到
  function onCar(a, S) {
    const x0 = S.tail, x1 = S.nose, hw = S.hw, px = a[0], pz = a[1];
    if (px < x1 + 0.6 && px > x0 - 0.6 && Math.abs(pz) < hw + 0.6) return a;
    const nx = a[2], nz = a[3], cx = (x0 + x1) / 2, hx = (x1 - x0) / 2;
    const u = clamp((px - cx) * -nz + pz * nx, -Math.min(hx, hw), Math.min(hx, hw)); // 切線方向的位置（留在車子範圍內）
    let bx = cx - nz * u, bz = nx * u; // 從這裡沿著 −n 走到外框
    const tx = nx < -1e-6 ? (x1 - bx) / -nx : nx > 1e-6 ? (bx - x0) / nx : Infinity, tz = nz < -1e-6 ? (hw - bz) / -nz : nz > 1e-6 ? (bz + hw) / nz : Infinity, t = Math.max(0, Math.min(tx, tz));
    bx -= nx * t; bz -= nz * t;
    a[0] = q3(bx); a[1] = q3(bz); a[5] = 0; a[9] = -1; // 撞到的東西的中心也不可信了：當作正對著撞
    return a;
  }
  const okRec = (a) => Array.isArray(a) && a.length >= 8 && a.slice(0, 8).every((x) => typeof x === 'number' && isFinite(x)) && a[4] >= V_MIN;
  const normRec = (a) => { const r = a.slice(0, 10); while (r.length < 10) r.push(r.length === 8 ? NaN : -1); if (!(typeof r[8] === 'number' && isFinite(r[8]))) r[8] = NaN; if (!(typeof r[9] === 'number' && isFinite(r[9]))) r[9] = -1; return r; };

  // 一下撞擊要用的常數（每台車一個，重複用）
  //   數字欄位一開始都放小數（V8 才會一開始就當浮點數欄位；不然第一次撞會換隱藏類別、重新編譯，卡一下）
  function newH() { return { sa: 1, sb: 1, hw: 0.5, px: 0.5, pz: 0.5, nx: 0.5, nz: 0.5, tx: 0.5, tz: 0.5, v: 0.5, uc: 0.5, r: 0.5, wall: true, h: 0.5, s0: 0.5, py: 0.5, D: 0.5, L: 0.5, k1: 0.5, capN: 0.5, spread: 0.5, fb: 0.5, side: false, ph1: 0.5, ph2: 0.5, ph3: 0.5, droop: 0.5, dside: 0.5, dfront: 0.5, dx0: 0.5, dyL: 0.5, rn: null }; }
  function prepHit(H, a, idx, S) {
    let nx = a[2], nz = a[3];
    const l = Math.sqrt(nx * nx + nz * nz) || 1;
    nx /= l; nz /= l;
    H.px = a[0]; H.pz = a[1]; H.nx = nx; H.nz = nz; H.tx = -nz; H.tz = nx; H.v = a[4]; H.uc = a[5]; H.r = a[6]; H.wall = a[6] >= 8; H.h = a[7]; H.s0 = a[8]; H.py = a[9]; H.hw = S.hw;
    const D = (H.D = crush(a[4]));
    H.L = Math.max(0.28, 2.3 * D + 0.1); H.k1 = TAU / (0.09 + 0.25 * D); H.capN = 0.7 / H.k1; H.spread = 0.22 + 0.9 * D;
    H.fb = Math.max(0, Math.abs(nx) - 0.4) / 0.6; H.side = Math.abs(nz) > 0.5;
    const rn = (H.rn = rng(hashRec(a, idx)));
    H.ph1 = rn() * TAU; H.ph2 = rn() * TAU; H.ph3 = rn() * TAU; H.sa = rn() < 0.5 ? -1 : 1; H.sb = rn() < 0.5 ? -1 : 1;
    // 保桿垂下來：前後撞、夠快、偏一邊（很快的話正面撞也會）
    H.droop = 0;
    if (Math.abs(nx) > 0.5 && a[4] > 8) {
      const off = Math.abs(a[1]) / S.hw, front = nx < 0, sd = rn() < 0.5 ? -1 : 1;
      if (off > 0.3 || a[4] > 14) {
        H.droop = Math.min(0.12, 0.012 * (a[4] - 6));
        H.dside = off > 0.3 ? Math.sign(a[1]) : sd;
        H.dfront = front ? 1 : -1;
        H.dx0 = front ? S.xf + 0.62 * S.Rf : -(S.xr - 0.62 * S.Rr);
        H.dyL = front ? S.lampF : S.lampR;
      }
    }
    return H;
  }

  // ================= 車子的外形（給位移場用）=================
  // 高度圖 H(x, z)＝最高的 y、寬度圖 W(x, y)＝最大的 |z|（4 公分一格、雙線性）：判斷一個點在車頂面（往上推）還是側面（往外推）
  const CELL = 0.04, MX0 = -2.9, MNX = 146, MZ0 = -1.35, MNZ = 68, MY0 = -0.1, MNY = 47;
  function shapeOf(pts, spec, extra = {}) {
    const W = spec.wheels || {}, S = {
      xf: fin(W.xf, 1.3), xr: fin(W.xr, -1.3), Rf: fin(W.RF ?? W.R, 0.33), Rr: fin(W.RR ?? W.R, 0.33),
      Hm: new Float32Array(MNX * MNZ).fill(-9), Wm: new Float32Array(MNX * MNY).fill(-9), hw: 0.9, nose: 2, tail: -2,
      gY: fin(extra.gY, 0.95), lampF: 0.5, lampR: 0.55, ca: 0, cb: 0,
    };
    let hw = 0, nose = -9, tail = 9;
    for (const P of pts) {
      for (let i = 0; i < P.length; i += 3) {
        const x = P[i], y = P[i + 1], z = P[i + 2], ax = Math.abs(z);
        if (ax > hw) hw = ax; if (x > nose) nose = x; if (x < tail) tail = x;
        const ix = Math.floor((x - MX0) / CELL), iz = Math.floor((z - MZ0) / CELL), iy = Math.floor((y - MY0) / CELL);
        if (ix < 0 || ix >= MNX) continue;
        if (iz >= 0 && iz < MNZ) { const k = iz * MNX + ix; if (y > S.Hm[k]) S.Hm[k] = y; }
        if (iy >= 0 && iy < MNY) { const k = iy * MNX + ix; if (ax > S.Wm[k]) S.Wm[k] = ax; }
      }
    }
    const dil = (M, nx, ny) => { // 空的格子補旁邊最大的（三圈），雙線性才不會拉到 −9
      for (let pass = 0; pass < 3; pass++) {
        const O = M.slice();
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          if (O[j * nx + i] > -5) continue;
          let m = -9;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a >= 0 && a < nx && b >= 0 && b < ny && O[b * nx + a] > m) m = O[b * nx + a]; }
          M[j * nx + i] = m;
        }
      }
    };
    dil(S.Hm, MNX, MNZ); dil(S.Wm, MNX, MNY);
    S.hw = hw || 0.9; S.nose = nose > tail ? nose : 2; S.tail = nose > tail ? tail : -2; // 沒有點（沒有車殼的車）：當作 4 公尺長
    S.ca = S.xr + S.Rr + 0.12; S.cb = S.xf - S.Rf - 0.05; // 車艙（兩個輪拱中間）：比較硬
    return S;
  }
  function bil(M, nx, ny, x0, y0, x, y) {
    let fx = (x - x0) / CELL - 0.5, fy = (y - y0) / CELL - 0.5;
    let ix = Math.floor(fx), iy = Math.floor(fy);
    fx -= ix; fy -= iy;
    if (ix < 0) { ix = 0; fx = 0; } else if (ix > nx - 2) { ix = nx - 2; fx = 1; }
    if (iy < 0) { iy = 0; fy = 0; } else if (iy > ny - 2) { iy = ny - 2; fy = 1; }
    const k = iy * nx + ix;
    return (M[k] * (1 - fx) + M[k + 1] * fx) * (1 - fy) + (M[k + nx] * (1 - fx) + M[k + nx + 1] * fx) * fy;
  }
  const topness = (S, x, y, z) => { const h = bil(S.Hm, MNX, MNZ, MX0, MZ0, x, z); return h < -5 ? 0 : sst(h - 0.1, h - 0.015, y); };
  const sideness = (S, x, y, z) => { const w = bil(S.Wm, MNX, MNY, MX0, MY0, x, y); return w < -5 ? 0 : sst(w - 0.1, w - 0.015, Math.abs(z)); };
  const cabW = (S, x) => sst(S.ca - 0.15, S.ca + 0.2, x) * (1 - sst(S.cb - 0.2, S.cb + 0.15, x));
  // 每個頂點不會變的東西（照原本的位置算一次，0–255）：頂面、側面、車艙、車窗以上、兩個平滑亂數
  const NST = 6, I255 = 1 / 255;
  function st6(S, x, y, z, T, o) {
    T[o] = Math.round(topness(S, x, y, z) * 255);
    T[o + 1] = Math.round(sideness(S, x, y, z) * 255);
    T[o + 2] = Math.round(cabW(S, x) * 255);
    T[o + 3] = Math.round((1 - 0.5 * sst(S.gY - 0.05, S.gY + 0.25, y)) * 255); // 側撞：車窗以上凹得少
    T[o + 4] = Math.round(vnoise((x + 0.93 * z) * 3.3 + 17, y * 3.9, 11) * 255); // 皺摺走向（大）
    T[o + 5] = Math.round(vnoise((x - 0.87 * z) * 7.1, y * 6.3 + 31, 12) * 255); // （小）
  }
  function staticsOf(B, n, S, sh) { const T = new Uint8Array(n * NST); for (let i = 0; i < n; i++) st6(S, B[i * 3], B[i * 3 + 1], B[i * 3 + 2] + (sh ? sh[i] : 0), T, i * NST); return T; }
  // 車內（門板、座椅邊）：每個頂點往外移到車殼那一層（z 方向）再算位移場＝跟外面的車門一起動，門板不會從凹下去的車門穿出來
  //   離車殼 10 公分以內整個跟著車殼；25 公分以上（座椅中間、中央通道）照自己的位置
  function skinShift(B, n, S) {
    const sh = new Float32Array(n);
    let any = false;
    for (let i = 0; i < n; i++) {
      const x = B[i * 3], y = B[i * 3 + 1], z = B[i * 3 + 2], w = bil(S.Wm, MNX, MNY, MX0, MY0, x, y);
      if (w < -5) continue;
      const gap = w - Math.abs(z);
      if (!(gap > 0)) continue;
      const k = 1 - sst(0.1, 0.25, gap);
      if (k > 0) { sh[i] = (z < 0 ? -gap : gap) * k; any = true; }
    }
    return any ? sh : null;
  }

  // ================= 位移場 =================
  // C＝[x, y, z（現在的位置）, bx, by, bz（原本的位置）, 頂面, 側面, 車艙, 車窗以上, 亂數 1, 亂數 2, 車內（1＝門板、座椅⋯）]（車身座標）
  // 有動就把「要加的位移」寫進 out、回傳 1（參數只有物件：一個頂點叫一次也不會配置記憶體）
  function fieldCore(H, C, out) {
    const x = C[0], y = C[1], z = C[2], bx = C[3], by = C[4], bz = C[5];
    const dx = x - H.px, dz = z - H.pz, s = dx * H.nx + dz * H.nz - H.s0;
    let ox = 0, oy = 0, oz = 0, hit = 0;
    if (H.droop > 0) { // 保桿垂下來（輪拱外面、燈下面，撞的那一角最多）
      const fx = H.dfront * bx - H.dx0;
      if (fx > 0) {
        const wz = sst(-0.2, 1, (H.dside * bz) / H.hw), k = H.droop * sst(0, 0.15, fx) * (1 - sst(H.dyL - 0.08, H.dyL - 0.02, by)) * wz * wz;
        if (k > 1e-6) { oy -= k; ox += H.dfront * 0.25 * k; oz += H.dside * 0.2 * k; hit = 1; }
      }
    }
    if (s < H.L) {
      const u = dx * H.tx + dz * H.tz - H.uc;
      const wu = H.wall ? 1 : 1 - sst(H.r, H.r + H.spread, Math.abs(u));
      if (wu > 0) {
        let wy = 1 - sst(H.h - 0.05, H.h + 0.3, y);
        if (H.py >= 0) wy *= 1 - sst(0.35, 0.9, Math.abs(y - H.py));
        if (H.side) wy *= C[9];
        const w = wu * wy;
        if (w > 0) {
          // 越前面壓得越扁（(1−q)²：最前面整個壓平、後面慢慢沒有）
          const q = s > 0 ? s / H.L : 0, g1 = 1 - q, g = g1 * g1, kz = 1 - 0.55 * C[8];
          const m0 = H.D * g * w * kz, cw = H.D * w * kz * g1 * (0.3 + 0.7 * g1);
          // 皺摺：沿著撞擊面的一道一道（三角波＝尖的摺痕），走向用平滑亂數扭一扭（每一下正負隨機）
          const nz1 = 0.5 + H.sa * (C[10] - 0.5), nz2 = 0.5 + H.sb * (C[11] - 0.5);
          const arg = s * H.k1 + H.ph1 + 5.5 * nz1 + 2.2 * nz2;
          // 車內：皺摺一律當作往裡面最多（車殼的皺摺在兩個門板頂點中間凸進來也碰不到門板）
          const inner = C[12] > 0, A = inner ? 1 : 0.65 * tri(arg) + 0.35 * fsin(arg * 1.7 + H.ph2), A2 = inner ? -1 : 0.7 * tri(arg + 1.3 + 3 * nz2) + 0.3 * fsin(arg * 2.3 + H.ph3);
          const an = m0 + Math.min(0.35 * cw, H.capN) * A; // 往裡推＋手風琴（振幅有上限：不會摺到自己裡面）
          ox += H.nx * an; oz += H.nz * an;
          const top = C[6], sd = C[7], sg = bz < 0 ? -1 : 1, am = 0.3 * cw * A2 * (0.55 + 0.9 * nz2);
          oy += top * am; oz += sd * sg * am; // 皺摺：頂面上下、側面內外
          if (H.fb > 0 && q < 0.9) { // 前後撞：引擎蓋／後車廂蓋拱起來、兩邊鼓出來
            const bump = fsin((Math.PI * q) / 0.9) * H.fb * H.D * wu;
            oy += 0.42 * bump * top; oz += 0.2 * bump * sd * sg;
          }
          hit = 1;
        }
      }
    }
    if (!hit) return 0;
    let tx = x + ox - bx, ty = y + oy - by, tz = z + oz - bz;
    const cap = 0.42 - 0.26 * C[8], l2 = tx * tx + ty * ty + tz * tz;
    if (l2 > cap * cap) { const k = cap / Math.sqrt(l2); tx *= k; ty *= k; tz *= k; }
    out[0] = bx + tx - x; out[1] = by + ty - y; out[2] = bz + tz - z;
    return 1;
  }
  // 一個點（零件的固定點、冒煙的地方）
  const FC = new Float64Array(13), FT = new Uint8Array(NST);
  function fieldAt(H, S, x, y, z, bx, by, bz, out) {
    FC[0] = x; FC[1] = y; FC[2] = z; FC[3] = bx; FC[4] = by; FC[5] = bz;
    st6(S, bx, by, bz, FT, 0);
    for (let k = 0; k < NST; k++) FC[6 + k] = FT[k] * I255;
    return fieldCore(H, FC, out);
  }

  // ================= 會變形的網格 =================
  // inPlace：直接改這個網格（車殼、車頭：這台車自己的）；不然第一次變形時複製一份（零件的網格可能跟別的網格共用），修好再換回來
  // 所有會變形的網格都用同一個樣子的物件（完整的車、輕量車、暖身）：V8 的隱藏類別一樣，編譯好的程式不會作廢
  function defObj() {
    return {
      meshes: null, mesh: null, geo0: null, geo: null, n: 0, inPlace: false, masked: false, prim: false, keepVis: null,
      P: null, N: null, P0: null, N0: null, B: null, M: null, Li: null, idx: null,
      adjO: null, adj: null, A0: null, tmark: null, vmark: null, stamp: 0, list: null,
      mk: null, mv: null, mvN: 0, chm: null, primed: false, r0: 0.5, maxD: 0.5, pane: null, lamp: null, st: null, bb: null, sc: 0.5, a0: false, dirty: false, sh: null,
    };
  }
  function mkDef(meshes, geo, M, o = {}) {
    const pa = geo.attributes.position, na = geo.attributes.normal;
    if (!pa || pa.isInterleavedBufferAttribute || !(pa.array instanceof Float32Array) || pa.itemSize !== 3) return null;
    if (na && (na.isInterleavedBufferAttribute || !(na.array instanceof Float32Array) || na.itemSize !== 3)) return null;
    const n = pa.count, idx = geo.index ? geo.index.array : null;
    if (!n || (idx && idx.length % 3) || (!idx && n % 3)) return null;
    const d = defObj();
    d.meshes = meshes; d.mesh = meshes[0] || null; d.geo0 = geo; d.geo = geo; d.n = n; d.inPlace = !!o.inPlace; d.masked = !!o.masked; d.prim = !!o.prim; d.keepVis = o.keepVis || null;
    d.P = pa.array; d.N = na ? na.array : null; d.idx = idx; d.r0 = 0; d.maxD = 0; d.sc = 1;
    if (M) {
      const e = M.elements, id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      if (e.some((v, i) => Math.abs(v - id[i]) > 1e-9)) {
        d.M = Float64Array.from(e);
        d.Li = Float64Array.from(new THREE.Matrix3().setFromMatrix4(M).invert().elements);
        d.sc = Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]));
      }
    }
    if (d.M) { // 車身座標的原本位置
      const B = (d.B = new Float32Array(n * 3)), P = d.P, m = d.M;
      for (let i = 0; i < n * 3; i += 3) { const X = P[i], Y = P[i + 1], Z = P[i + 2]; B[i] = m[0] * X + m[4] * Y + m[8] * Z + m[12]; B[i + 1] = m[1] * X + m[5] * Y + m[9] * Z + m[13]; B[i + 2] = m[2] * X + m[6] * Y + m[10] * Z + m[14]; }
    } else d.B = d.P; // 還沒變形之前 P 就是原本的（prime 時換成 P0）
    return d;
  }
  function prime(d) {
    if (d.primed) return;
    d.primed = true;
    if (!d.r0) { if (!d.geo.boundingSphere) d.geo.computeBoundingSphere(); d.r0 = d.geo.boundingSphere.radius; }
    if (d.inPlace) {
      d.P0 = new Float32Array(d.P); d.N0 = d.N ? new Float32Array(d.N) : null;
      if (!d.M) d.B = d.P0;
      if (d.masked) { d.geo.setAttribute('aP0', new THREE.BufferAttribute(d.P0, 3)); d.geo.setAttribute('aN0', new THREE.BufferAttribute(d.N0 || d.P0, 3)); }
    } else {
      const g0 = d.geo0, g = g0.clone();
      g.deleteAttribute('aP0'); g.deleteAttribute('aN0');
      d.P0 = g0.attributes.position.array; d.N0 = g0.attributes.normal ? g0.attributes.normal.array : null;
      if (d.masked) { g.setAttribute('aP0', new THREE.BufferAttribute(d.P0, 3)); g.setAttribute('aN0', new THREE.BufferAttribute(d.N0 || d.P0, 3)); }
      g.boundingSphere = g0.boundingSphere ? g0.boundingSphere.clone() : null;
      d.geo = g; d.P = g.attributes.position.array; d.N = g.attributes.normal ? g.attributes.normal.array : null;
      if (!d.M) d.B = d.P0;
      for (const m of d.meshes) m.geometry = g;
    }
    if (!d.mk) { d.mk = new Uint8Array(d.n); d.mv = new Int32Array(d.n); }
  }
  // 恢復原狀（repair、apply 之前）
  //   hard＝複製的網格也換回原本共用的那個（dispose）；不然只把數字抄回去（複製的留著，下一次撞不用再複製）
  function unprime(d, hard) {
    if (!d.primed) return;
    if (hard && !d.inPlace) {
      for (const m of d.meshes) m.geometry = d.geo0;
      const g = d.geo;
      g.deleteAttribute('aP0'); g.deleteAttribute('aN0'); g.dispose();
      d.geo = d.geo0; d.P = d.P0; d.N = d.N0; if (!d.M) d.B = d.P;
      d.primed = false;
    } else if (d.dirty) {
      d.P.set(d.P0); if (d.N && d.N0) d.N.set(d.N0);
      // 整個重傳（之後同一幀再加的小段會併進來，不會只傳小段）
      for (const a of [d.geo.attributes.position, d.geo.attributes.normal]) if (a) { a.clearUpdateRanges(); a.addUpdateRange(0, a.array.length); a.needsUpdate = true; }
      if (d.geo.boundingSphere) d.geo.boundingSphere.radius = d.r0;
    }
    d.maxD = 0; d.dirty = false;
    if (d.mvN) { for (let j = 0; j < d.mvN; j++) d.mk[d.mv[j]] = 0; d.mvN = 0; }
  }
  // 這個網格這一下可能被碰到嗎（原本位置的外框＋已經凹進去的量：一定不會碰到的整個跳過）
  function mayTouch(d, H) {
    let b = d.bb;
    if (!b) {
      const B = d.B, sh = d.sh;
      b = d.bb = new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
      for (let i = 0; i < d.n * 3; i += 3) for (let c = 0; c < 3; c++) { const v = B[i + c] + (c === 2 && sh ? sh[i / 3] : 0); if (v < b[c]) b[c] = v; if (v > b[c + 3]) b[c + 3] = v; }
    }
    if (!(b[0] <= b[3])) return false;
    const e = d.maxD * d.sc + 0.01, sx = H.nx >= 0 ? b[0] : b[3], sz = H.nz >= 0 ? b[2] : b[5];
    if ((sx - H.px) * H.nx + (sz - H.pz) * H.nz - H.s0 - e < H.L) return true;
    return H.droop > 0 && H.dfront * (H.dfront > 0 ? b[3] : b[0]) > H.dx0;
  }
  // 每一下：算出動到的頂點（先算完、再寫：第一次要先複製網格）；大部分的頂點在這裡就跳過（不叫函式）
  function scanDef(d, H, S, sc) {
    if (!mayTouch(d, H)) return 0;
    if (!d.st) d.st = staticsOf(d.B, d.n, S, d.sh);
    const n = d.n, P = d.P, B = d.B, m = d.M, T = d.st, C = sc.C, out = sc.out, I = sc.idx, DS = sc.dsp, SH = d.sh;
    const px = H.px, pz = H.pz, nx = H.nx, nz = H.nz, s0 = H.s0, L = H.L, dr = H.droop > 0, df = H.dfront, dx0 = H.dx0;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      let x = P[i3], y = P[i3 + 1], z = P[i3 + 2];
      if (m) { const X = x, Y = y, Z = z; x = m[0] * X + m[4] * Y + m[8] * Z + m[12]; y = m[1] * X + m[5] * Y + m[9] * Z + m[13]; z = m[2] * X + m[6] * Y + m[10] * Z + m[14]; }
      const q = SH === null ? 0 : SH[i]; // 車內：當作在車殼那一層
      z += q;
      if ((x - px) * nx + (z - pz) * nz - s0 >= L && !(dr && df * B[i3] > dx0)) continue;
      const o = i * NST;
      C[0] = x; C[1] = y; C[2] = z; C[3] = B[i3]; C[4] = B[i3 + 1]; C[5] = B[i3 + 2] + q;
      C[6] = T[o] * I255; C[7] = T[o + 1] * I255; C[8] = T[o + 2] * I255; C[9] = T[o + 3] * I255; C[10] = T[o + 4] * I255; C[11] = T[o + 5] * I255; C[12] = SH === null ? 0 : 1;
      if (!fieldCore(H, C, out)) continue;
      if (out[0] * out[0] + out[1] * out[1] + out[2] * out[2] < 1e-12) continue;
      I[k] = i; DS[k * 3] = out[0]; DS[k * 3 + 1] = out[1]; DS[k * 3 + 2] = out[2]; k++;
    }
    return k;
  }
  function writeDef(d, k, sc, stats) {
    prime(d);
    d.dirty = true;
    const P = d.P, P0 = d.P0, Li = d.Li, I = sc.idx, DS = sc.dsp, pane = d.pane, lamp = d.lamp;
    let maxD = d.maxD;
    for (let j = 0; j < k; j++) {
      const i = I[j], i3 = i * 3;
      let dx = DS[j * 3], dy = DS[j * 3 + 1], dz = DS[j * 3 + 2];
      if (stats && (pane || lamp)) {
        const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (pane && pane[i] && mag > stats.pane[pane[i]]) stats.pane[pane[i]] = mag;
        if (lamp && lamp[i] && mag > stats.lamp[lamp[i]]) stats.lamp[lamp[i]] = mag;
      }
      if (Li) { const X = dx, Y = dy, Z = dz; dx = Li[0] * X + Li[3] * Y + Li[6] * Z; dy = Li[1] * X + Li[4] * Y + Li[7] * Z; dz = Li[2] * X + Li[5] * Y + Li[8] * Z; }
      P[i3] += dx; P[i3 + 1] += dy; P[i3 + 2] += dz;
      const ex = P[i3] - P0[i3], ey = P[i3 + 1] - P0[i3 + 1], ez = P[i3 + 2] - P0[i3 + 2], e2 = ex * ex + ey * ey + ez * ez;
      if (e2 > maxD * maxD) maxD = Math.sqrt(e2);
      if (!d.mk[i]) { d.mk[i] = 1; d.mv[d.mvN++] = i; }
    }
    d.maxD = maxD;
  }
  // 鄰接表（頂點 → 三角形，CSR）
  function buildAdj(d) {
    const n = d.n, I = d.idx, nt = I ? I.length / 3 : n / 3;
    if (!d.adj) {
      const O = new Int32Array(n + 1);
      if (I) for (let k = 0; k < I.length; k++) O[I[k] + 1]++; else for (let k = 0; k < n; k++) O[k + 1]++;
      for (let i = 0; i < n; i++) O[i + 1] += O[i];
      const A = new Int32Array(O[n]), f = O.slice(0, n);
      for (let t = 0; t < nt; t++) for (let c = 0; c < 3; c++) { const v = I ? I[t * 3 + c] : t * 3 + c; A[f[v]++] = t; }
      d.adjO = O; d.adj = A;
    }
    d.tmark = new Int32Array(nt); d.vmark = new Int32Array(n); d.list = new Int32Array(n);
  }
  // 三角形的面法線（面積加權、沒有正規化）：這一輪用到的才算，一個三角形只算一次（全部的網格共用一塊）
  let FN = new Float32Array(3 * 65536);
  const ensureFN = (n3) => { if (FN.length < n3) FN = new Float32Array(Math.max(n3, FN.length * 2)); };
  function faceN(X, I, t) {
    const t3 = t * 3, a = (I ? I[t3] : t3) * 3, b = (I ? I[t3 + 1] : t3 + 1) * 3, c = (I ? I[t3 + 2] : t3 + 2) * 3;
    const ux = X[b] - X[a], uy = X[b + 1] - X[a + 1], uz = X[b + 2] - X[a + 2], vx = X[c] - X[a], vy = X[c + 1] - X[a + 1], vz = X[c + 2] - X[a + 2];
    FN[t3] = uy * vz - uz * vy; FN[t3 + 1] = uz * vx - ux * vz; FN[t3 + 2] = ux * vy - uy * vx;
  }
  // 原本的面法線（每個頂點：旁邊的三角形加起來、正規化）：第一次變形時整個網格算一次
  function initA0(d) {
    const n = d.n, I = d.idx, nt = I ? I.length / 3 : n / 3, O = d.adjO, A = d.adj, P0 = d.P0 || d.P, A0 = (d.A0 = new Float32Array(n * 3)); // 還沒變形之前 P 就是原本的
    ensureFN(nt * 3);
    for (let t = 0; t < nt; t++) faceN(P0, I, t);
    for (let v = 0; v < n; v++) {
      let ax = 0, ay = 0, az = 0;
      for (let q = O[v]; q < O[v + 1]; q++) { const t3 = A[q] * 3; ax += FN[t3]; ay += FN[t3 + 1]; az += FN[t3 + 2]; }
      const l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
      A0[v * 3] = ax / l; A0[v * 3 + 1] = ay / l; A0[v * 3 + 2] = az / l;
    }
    d.a0 = true;
  }
  // 動到的頂點＋旁邊一圈重算法線：n＝normalize(原本的法線＋現在的面法線−原本的面法線)
  //   只看最後的位置、三角形照固定的順序加：撞完一下一下算、跟重播一次算，結果一模一樣
  function fixNormals(d) {
    if (!d.mvN) return 0;
    if (!d.adj || !d.tmark) buildAdj(d);
    if (d.N && d.N0 && !d.a0) initA0(d);
    const P = d.P, N = d.N, N0 = d.N0, I = d.idx, O = d.adjO, A = d.adj, TM = d.tmark, VM = d.vmark, L = d.list, A0 = d.A0;
    const st = ++d.stamp;
    let nd = 0;
    for (let j = 0; j < d.mvN; j++) {
      const v = d.mv[j];
      d.mk[v] = 0;
      for (let q = O[v]; q < O[v + 1]; q++) {
        const t = A[q];
        if (TM[t] === st) continue;
        TM[t] = st;
        for (let c = 0; c < 3; c++) { const u = I ? I[t * 3 + c] : t * 3 + c; if (VM[u] !== st) { VM[u] = st; L[nd++] = u; } }
      }
    }
    d.mvN = 0;
    if (N && N0) {
      ensureFN(I ? I.length : d.n);
      const s2 = ++d.stamp;
      for (let j = 0; j < nd; j++) {
        const v = L[j], v3 = v * 3;
        let ax = 0, ay = 0, az = 0;
        for (let q = O[v]; q < O[v + 1]; q++) {
          const t = A[q], t3 = t * 3;
          if (TM[t] !== s2) { TM[t] = s2; faceN(P, I, t); }
          ax += FN[t3]; ay += FN[t3 + 1]; az += FN[t3 + 2];
        }
        const l = Math.sqrt(ax * ax + ay * ay + az * az);
        if (!(l > 1e-12)) continue;
        const ex = ax / l - A0[v3], ey = ay / l - A0[v3 + 1], ez = az / l - A0[v3 + 2];
        if (ex === 0 && ey === 0 && ez === 0) { N[v3] = N0[v3]; N[v3 + 1] = N0[v3 + 1]; N[v3 + 2] = N0[v3 + 2]; continue; }
        const x = N0[v3] + ex, y = N0[v3 + 1] + ey, z = N0[v3 + 2] + ez, m = Math.sqrt(x * x + y * y + z * z) || 1;
        N[v3] = x / m; N[v3 + 1] = y / m; N[v3 + 2] = z / m;
      }
    }
    // 上傳：只傳有動的那幾段（每 2048 個頂點一段）
    const nch = Math.ceil(d.n / STEP);
    if (!d.chm) d.chm = new Uint8Array(nch);
    const C = d.chm;
    for (let j = 0; j < nd; j++) C[(L[j] / STEP) | 0] = 1;
    const pa = d.geo.attributes.position, na = d.geo.attributes.normal;
    for (let c = 0; c < nch; c++) {
      if (!C[c]) continue;
      let e = c; while (e + 1 < nch && C[e + 1]) e++;
      const s = c * STEP * 3, len = Math.min(d.n, (e + 1) * STEP) * 3 - s;
      pa.addUpdateRange(s, len); if (na) na.addUpdateRange(s, len);
      for (let k = c; k <= e; k++) C[k] = 0;
      c = e;
    }
    pa.needsUpdate = true; if (na) na.needsUpdate = true;
    if (d.geo.boundingSphere) d.geo.boundingSphere.radius = d.r0 + d.maxD;
    return nd;
  }

  // ================= shader：車漆、車內、玻璃（接在 masks.js 的後面）=================
  const DMG_DECL = `
uniform vec4 uDG[${NG}]; uniform vec4 uDK[${NG}]; uniform vec4 uDL[${NL}]; uniform vec4 uDM;
varying float vDmg;
float dmgH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dmgN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(dmgH(i), dmgH(i + vec2(1.0, 0.0)), f.x), mix(dmgH(i + vec2(0.0, 1.0)), dmgH(i + vec2(1.0, 1.0)), f.x), f.y); }
// 蜘蛛網裂痕：q＝玻璃平面上離撞擊點的向量（公尺）、R＝裂到多遠、px＝一個像素幾公尺 → 0–1
float dmgWeb(vec2 q, float R, float seed, float px) {
  float r = length(q), a = atan(q.y, q.x), N = 17.0, t = a / 6.2831853 * N + seed, k0 = floor(t), best = 1e3, bk = k0;
  for (int j = -1; j <= 1; j++) {
    float k = k0 + float(j), c = k + 0.5 + (dmgH(vec2(k, seed)) - 0.5) * 0.8 + 0.035 * sin(r * 31.0 + k * 1.7);
    float e = abs(t - c); if (e < best) { best = e; bk = k; }
  }
  float w = px * 0.75 + 0.0005, lenK = dmgH(vec2(bk, seed + 3.1));
  float rad = (1.0 - smoothstep(0.0, w, best / N * 6.2831853 * r)) * (1.0 - smoothstep(R * (0.4 + 0.6 * lenK), R * (0.45 + 0.6 * lenK), r));
  float ring = 0.0, lr = log(max(r, 1e-4) / 0.035) / log(1.6);
  if (lr > -0.5) {
    float m = floor(lr + 0.5), cell = floor(t);
    float rr = 0.035 * pow(1.6, m + (dmgH(vec2(cell, m + seed)) - 0.5) * 0.4);
    ring = step(0.5, dmgH(vec2(cell * 1.3, m * 2.1 + seed))) * (1.0 - smoothstep(0.0, w, abs(r - rr))) * (1.0 - smoothstep(R * 0.6, R, r));
  }
  return max(max(rad, ring * 0.7), (1.0 - smoothstep(0.0, 0.02 + px, r)) * 0.85);
}
// 破洞的鋸齒邊：每個角度的半徑倍數（0.7–1）
float dmgJag(float a, float seed) {
  float N = 11.0, t = (a / 6.2831853 + 0.5) * N, i0 = floor(t), f = t - i0;
  return 0.7 + 0.3 * mix(dmgH(vec2(mod(i0, N), seed)), dmgH(vec2(mod(i0 + 1.0, N), seed)), f);
}
`;
  const VS_OLD = 'vP = position; vN = normal;', VS_NEW = 'vP = aP0; vN = aN0; vDmg = length(position - aP0);';
  const A_BLACK = '  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012), blackG);';
  const A_GAP = '  diffuseColor.rgb *= 1.0 - 0.85 * gap;';
  const A_GLASS = '  if (glass < 0.5 || blk > 0.5) discard;\n';
  const PAINT_LAMP = `  float dLc = 0.0, dRough = smoothstep(0.012, 0.07, vDmg);
  if (uDM.z > 0.5) { // 破掉的燈：反光罩變暗、燈殼裂開
    float dPx = length(fwidth(vP)) + 1e-5, lit = max(max(lamp, lens), max(amber, max(red, rev)));
    if (lit > 0.02) for (int i = 0; i < ${NL}; i++) {
      if (float(i) >= uDM.z) break;
      vec4 L = uDL[i]; vec3 d = vP - L.xyz; float r = length(d);
      if (r > L.w) continue;
      float k = (1.0 - smoothstep(L.w * 0.8, L.w, r)) * smoothstep(0.02, 0.3, lit);
      lamp *= 1.0 - 0.9 * k; lens *= 1.0 - k; amber *= 1.0 - 0.55 * k; red *= 1.0 - 0.45 * k; rev *= 1.0 - 0.85 * k;
      blackG = max(blackG, 0.8 * k);
      dLc = max(dLc, k * dmgWeb(vec2(d.z, d.y), L.w * 0.9, float(i) * 7.31 + 1.0, dPx));
    }
  }
`;
  const PAINT_SCUFF = `  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.56, 0.58), dLc * 0.6);
  if (vDmg > 0.05) { // 壓得很爛的地方：漆刮掉幾條，露出一點金屬
    float sc = dmgN(vec2(vP.y * 70.0, (vP.x + vP.z) * 3.0)) * dmgN(vec2(vP.y * 23.0 + 5.0, (vP.x - vP.z) * 11.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.52, 0.53, 0.55), smoothstep(0.05, 0.14, vDmg) * smoothstep(0.42, 0.6, sc) * 0.45);
  }
`;
  const GLASS_CODE = `  float dCrk = 0.0;
  if (uDM.y > 0.5) { // 裂痕、破洞：只畫在同一片玻璃上（左、右側窗、前擋、後擋）
    float dPx = length(fwidth(vP)) + 1e-5, pane = sideF(vN) > 0.5 ? (vP.z < 0.0 ? 1.0 : 2.0) : (vP.x > uDM.x ? 3.0 : 4.0);
    for (int i = 0; i < ${NG}; i++) {
      if (float(i) >= uDM.y) break;
      vec4 G = uDG[i], K = uDK[i];
      if (abs(K.y - pane) > 0.5) continue;
      vec3 d = vP - G.xyz;
      vec2 q = pane < 2.5 ? d.xy : vec2(d.z, sign(d.x) * length(d.xy));
      float r = length(q);
      if (r > max(G.w, K.x) + 0.05) continue;
      if (K.x > 0.0) { float e = dmgJag(atan(q.y, q.x), K.z) * K.x; if (r < e) discard; dCrk = max(dCrk, 1.0 - smoothstep(0.0, 0.045, r - e)); }
      dCrk = max(dCrk, dmgWeb(q, G.w, K.z, dPx));
    }
  }
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.75, 0.78), dCrk * 0.7);
  diffuseColor.a = mix(diffuseColor.a, 0.75, dCrk);
`;
  // 換上會壞的 shader（包在原本的 onBeforeCompile 外面）；kind：'paint'｜'glass'｜'inside'
  function patchMat(mat, kind, U) {
    if (!mat || mat.userData.dmgU) return;
    const prev = mat.onBeforeCompile, key0 = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
    mat.userData.dmgU = U;
    mat.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(this, sh, r);
      if (!sh.vertexShader.includes(VS_OLD)) return; // 不是 masks.js 的 shader（不會發生）
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'attribute vec3 aP0; attribute vec3 aN0; varying float vDmg;\n' + sh.vertexShader.replace(VS_OLD, VS_NEW);
      let fs = sh.fragmentShader.replace('void main() {', DMG_DECL + 'void main() {');
      if (kind === 'paint' && fs.includes(A_BLACK) && fs.includes(A_GAP)) {
        fs = fs.replace(A_BLACK, PAINT_LAMP + A_BLACK).replace(A_GAP, PAINT_SCUFF + A_GAP)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.55, dRough * 0.7);')
          .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\n  material.clearcoat *= 1.0 - 0.75 * dRough;\n#endif');
      } else if (kind === 'glass' && fs.includes(A_GLASS)) {
        fs = fs.replace(A_GLASS, A_GLASS + GLASS_CODE).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.5, dCrk);');
      }
      sh.fragmentShader = fs;
    };
    mat.customProgramCacheKey = () => key0 + '+dmg';
    // 用這個材質畫的網格一定要有 aP0／aN0（還沒變形的：跟 position／normal 共用同一個，不佔記憶體）
    const pr = mat.onBeforeRender;
    mat.onBeforeRender = function (r, sc, cam, geo, obj, grp) {
      if (geo && !geo.attributes.aP0 && geo.attributes.position) { geo.setAttribute('aP0', geo.attributes.position); geo.setAttribute('aN0', geo.attributes.normal || geo.attributes.position); }
      if (pr) pr.call(this, r, sc, cam, geo, obj, grp);
    };
    mat.needsUpdate = true;
  }
  const newU = () => ({ uDG: { value: new Float32Array(NG * 4) }, uDK: { value: new Float32Array(NG * 4) }, uDL: { value: new Float32Array(NL * 4) }, uDM: { value: new THREE.Vector4(-9, 0, 0, 0) } });

  // ================= 讀投影貼圖（CPU：哪些頂點是玻璃、燈）=================
  const T4 = new Float32Array(4);
  function samp(tex, u, v) {
    const im = tex && tex.image;
    if (!im || !im.data) { T4.fill(0); return T4; }
    const x = clamp(Math.floor(u * im.width), 0, im.width - 1), y = clamp(Math.floor(v * im.height), 0, im.height - 1), i = (y * im.width + x) * 4, dd = im.data;
    T4[0] = dd[i] / 255; T4[1] = dd[i + 1] / 255; T4[2] = dd[i + 2] / 255; T4[3] = dd[i + 3] / 255;
    return T4;
  }
  // 玻璃在哪一片（跟 masks.js glassMask 一樣的判斷）：0 不是、1 左側窗、2 右側窗、3 前擋、4 後擋（前擋、後擋之後用 x 分）
  function glassAt(tex, gY, x, y, z, nz) {
    const sf = sst(0.35, 0.55, Math.abs(nz)), hi = y >= gY ? 1 : 0;
    const S = samp(tex.side, (x + 2.35) / 4.7, y / 1.4), sr = S[0], sg = S[1];
    const T = samp(tex.top, (x + 2.35) / 4.7, (z + 1) / 2), ta = T[3], tg = T[1];
    const glass = Math.max(sr * sf, ta * (1 - sf) * hi), blk = Math.max(sg * sf, tg * (1 - sf) * hi);
    if (glass < 0.5 || blk > 0.5) return 0;
    return sf > 0.5 ? (z < 0 ? 1 : 2) : 3;
  }
  // 燈在哪（跟 masks.js patchPaint 一樣）：0 不是、1 左前、2 右前、3 左後、4 右後
  function lampAt(tex, U, x, y, z, nx, ny) {
    const fW = sst(U.uFx.value.x, U.uFx.value.y, x) * sst(-0.35, 0.1, nx) * (1 - sst(0.82, 0.95, ny));
    if (fW > 0.3) { const F = samp(tex.U.tFront.value, (1 - z) / 2, y / 1.3); if (Math.max(F[0], F[2]) * fW > 0.4) return z < 0 ? 1 : 2; }
    const rW = (1 - sst(U.uRx.value.y, U.uRx.value.x, x)) * (1 - sst(-0.1, 0.35, nx));
    if (rW > 0.3) { const R = samp(tex.rear, (z + 1) / 2, y / 1.3); if (Math.max(R[0] * (1 - R[1]), R[2]) * rW > 0.4) return z < 0 ? 3 : 4; }
    return 0;
  }
  // 前擋、後擋的分界：頂面玻璃頂點的 x 分佈裡最大的空隙
  function splitX(xs) {
    if (xs.length < 8) return -9;
    const bins = new Uint8Array(110);
    for (const x of xs) bins[clamp(Math.floor((x + 2.75) / 0.05), 0, 109)] = 1;
    let best = 0, at = -9, last = -1;
    for (let i = 0; i < 110; i++) if (bins[i]) { if (last >= 0 && i - last - 1 > best) { best = i - last - 1; at = -2.75 + ((last + i + 1) / 2) * 0.05; } last = i; }
    return best * 0.05 >= 0.15 ? at : -9;
  }
  // 一群頂點 → 球（中心、半徑）
  function cluster(list, P) {
    let cx = 0, cy = 0, cz = 0, y0 = 9;
    for (const i of list) { cx += P[i * 3]; cy += P[i * 3 + 1]; cz += P[i * 3 + 2]; if (P[i * 3 + 1] < y0) y0 = P[i * 3 + 1]; }
    const n = list.length || 1;
    cx /= n; cy /= n; cz /= n;
    const ds = list.map((i) => Math.hypot(P[i * 3] - cx, P[i * 3 + 1] - cy, P[i * 3 + 2] - cz)).sort((a, b) => a - b);
    return { c: [cx, cy, cz], r: Math.min(0.45, (ds[Math.floor(ds.length * 0.95)] || 0.1) + 0.03), y0 };
  }

  // ================= 玻璃、燈的規則（完整的車、輕量車共用）=================
  // panes[p]：{ id, verts, x0, x1, y0, z0, z1 }；回傳這一下新裂／碎的
  // PC＝現在的位置（量距離）、PB＝原本的位置（裂痕中心：shader 用原本的位置畫）
  function glassRules(H, S, panes, stats, PC, PB, glassList, rn) {
    let n = 0;
    const same = (p) => (p.id === 1 ? H.pz < 0 : H.pz > 0) && Math.abs(H.pz) > 0.3 * S.hw;
    for (const p of panes) {
      if (!p) continue;
      const mx = stats.pane[p.id];
      let dist = 9;
      if (p.id <= 2) for (let j = 0; j < p.verts.length; j += 7) { const i = p.verts[j] * 3; const dd = Math.hypot(PC[i] - H.px, PC[i + 2] - H.pz); if (dd < dist) dist = dd; }
      let crack = false, shatter = false;
      if (p.id <= 2) { shatter = mx > 0.03 || (same(p) && dist < 0.5 && H.v > 9); crack = shatter || mx > 0.006 || (same(p) && dist < 0.8 && H.v > 5.5); }
      else if (p.id === 3) crack = (H.nx < -0.55 && H.D > 0.07) || mx > 0.006; // 前擋有夾層：只會裂
      else { shatter = (H.nx > 0.55 && H.D > 0.2) || mx > 0.03; crack = shatter || (H.nx > 0.55 && H.D > 0.07) || mx > 0.006; }
      const seed = rn() * 100; // 每一片都抽（不管有沒有裂）：重播的亂數順序一樣
      if (!crack) continue;
      // 裂痕從哪裡開始：側窗＝撞到那邊的下緣、前擋後擋＝撞到那一側的下緣
      const tgt = p.id <= 2 ? [clamp(H.px, p.x0, p.x1), p.y0 + 0.1, p.id === 1 ? -S.hw : S.hw] : [p.id === 3 ? p.x1 : p.x0, p.y0 + 0.08, clamp(H.pz, p.z0 + 0.1, p.z1 - 0.1)];
      let bi = p.verts[0], bd = Infinity;
      for (let j = 0; j < p.verts.length; j += 3) { const i = p.verts[j] * 3, dd = (PC[i] - tgt[0]) ** 2 + (PC[i + 1] - tgt[1]) ** 2 + (PC[i + 2] - tgt[2]) ** 2; if (dd < bd) { bd = dd; bi = p.verts[j]; } }
      const c = [PB[bi * 3], PB[bi * 3 + 1], PB[bi * 3 + 2]];
      const hole = shatter ? 0.75 + 1.4 * H.D : 0, R = p.id === 3 ? 0.18 + 1.8 * H.D : shatter ? hole + 0.15 : 0.25 + 1.5 * H.D;
      addGlass(glassList, p.id, c, R, hole, seed);
      n += shatter ? 1 : 0.5;
    }
    return n;
  }
  function addGlass(L, pane, c, R, hole, seed) {
    let best = null, bd = Infinity;
    for (const g of L) if (g.pane === pane) { const dd = Math.hypot(g.c[0] - c[0], g.c[1] - c[1], g.c[2] - c[2]); if (dd < bd) { bd = dd; best = g; } }
    if (best && (bd < 0.35 || L.length >= NG)) { best.R = Math.max(best.R, R); best.hole = Math.max(best.hole, hole); return; }
    if (L.length >= NG) { let k = 0; for (let i = 1; i < L.length; i++) if (L[i].R < L[k].R) k = i; L[k] = { pane, c, R, hole, seed }; return; }
    L.push({ pane, c, R, hole, seed });
  }
  const glassCount = (L) => { const by = {}; for (const g of L) by[g.pane] = Math.max(by[g.pane] || 0, g.hole > 0 ? 1 : 0.5); return Object.values(by).reduce((a, b) => a + b, 0); };

  // 車況：每一下扣 2.2×凹多深（撞到引擎那頭 ×1.3、側撞車艙 ×0.85）
  function lossOf(a, S, mid) {
    const D = crush(a[4]), nx = a[2], nz = a[3];
    const eng = mid ? nx > 0.5 : nx < -0.5, zw = eng ? 1.3 : Math.abs(nz) > 0.5 && cabW(S, a[0]) > 0.5 ? 0.85 : 1;
    return 2.2 * D * zw;
  }
  function perfOf(h, pull) {
    return { power: 0.3 + 0.7 * sst(0, 0.7, h), top: 0.4 + 0.6 * sst(0, 0.6, h), maxKmh: h < 0.08 ? 60 : Infinity, steerPull: clamp(pull, -1, 1) };
  }
  // 修車費（萬）：車價 ×（1% ＋ 12% ×（1−車況）^1.15）＋玻璃、燈、零件；最多 15%；有壞最少 1 萬
  function cost(state, price) {
    if (!state || !Array.isArray(state.h) || (!state.h.length && !(state.x > 0))) return 0;
    const p = Math.max(0, +price || 0), h = clamp(fin(+state.hp, 1), 0, 1);
    const c = p * (0.01 + 0.12 * Math.pow(1 - h, 1.15)) + p * (0.004 * fin(+state.gl, 0) + 0.005 * fin(+state.lp, 0) + 0.006 * fin(+state.pt, 0));
    return Math.max(1, Math.ceil(Math.min(0.15 * p, c)));
  }

  // ================= 煙（每台車 64 顆，粒子池；不配置記憶體）=================
  let PUFF = null, SHARD_GEO = null;
  // 每一幀會碰到的小物件都用下面這幾個函式做（同一個樣子），而且每一種都一直留一個在 KEEP（煙池、碎片池留第一個；dispose 以後也留著，
  //   GPU 的東西已經釋放，只剩幾十 KB 的陣列）：V8 最佳化過的 stepFx／stepSmoke／stepShards 記著這些物件的「樣子」，舊車的物件全部被回收的話
  //   樣子也跟著被回收，最佳化過的程式就作廢了；而且（Chrome 141 實測）沒有迴圈的 stepFx 常常就再也不最佳化，每一幀多 1 KB 的小數要回收
  const fxRec = () => ({ scene: null, debris: [], shards: null, smoke: null });
  const fxState = (VS, fx, pos) => ({ VS, fx, pos, parW: null, bodyW: null, emit: null }); // stepFx 的 I：只放物件，數字都在 VS
  const debrisRec = (obj, e, s) => ({ obj, e, s, sleep: false, own: null });
  const KEEP = { smoke: null, shards: null, fx: fxRec(), I: null, debris: debrisRec(null, null, null) };
  KEEP.I = fxState(new Float64Array(11), KEEP.fx, new THREE.Vector3());
  // 每一幀用的數字（update → stepSmoke／stepShards／stepDebris）：放在一個 Float64Array 傳過去，不用小數當參數（小數當參數、當回傳值，V8 常常要包成新的 HeapNumber）
  //   0 dt、1 冒煙速度、2 深淺、3–5 冒煙的地方（世界座標）、6–7 車子的速度 x、z
  const FR = new Float64Array(8);
  // 每一幀：車子的速度、掉下來的零件、碎片、煙、嘶嘶聲的大小。全部的車共用這一個函式，而且只碰大家共用樣子的東西
  //   （Vector3、陣列、Float64Array、效果的物件）：V8 最佳化一次就好，換了車（舊車的物件被回收）也不會作廢
  //   每一台車的 update 只做物件的讀寫（在直譯器裡跑也不配置記憶體），數字全部放在 I.VS／FR；小數的算數都在這裡
  //   I.VS：0–1 車子的速度 x、z（世界座標，平滑過）、2–3 上一幀的位置、4 有沒有上一幀、5 嘶嘶聲現在多大、6 車況、7 冒煙速度、8 看得到、9 這一幀要算煙、10 要嘶嘶聲
  //   回傳 1＝嘶嘶聲的大小變了（I.VS[5]）
  function stepFx(I, F) {
    const VS = I.VS, fx = I.fx, dt = F[0], P = I.pos, W = I.parW;
    // 車子的速度：位置差、平滑（煙被風吹歪、碎片和零件被甩出去用）；一幀跑超過 5 公尺＝瞬間移動，重來
    let px = P.x, pz = P.z;
    if (W !== null) { const x = px, y = P.y, z = pz; px = W[0] * x + W[4] * y + W[8] * z + W[12]; pz = W[2] * x + W[6] * y + W[10] * z + W[14]; }
    //   （每一幀都寫同樣的地方：很少走到的分支裡的讀寫，V8 最佳化的時候沒看過，一走到就作廢重來，例如換車以後的第一幀）
    const ddx = px - VS[2], ddz = pz - VS[3], ok = VS[4] > 0 && ddx * ddx + ddz * ddz < 25, k = dt * 20 < 1 ? dt * 20 : 1;
    VS[0] = ok ? VS[0] + (ddx / dt - VS[0]) * k : 0; VS[1] = ok ? VS[1] + (ddz / dt - VS[1]) * k : 0;
    VS[2] = px; VS[3] = pz; VS[4] = 1;
    if (fx.debris.length) stepDebris(fx.debris, F);
    if (fx.shards !== null) stepShards(fx.shards, F);
    if (VS[9] > 0 && fx.smoke !== null) {
      const m = I.bodyW, c = I.emit, x = c[0], y = c[1], z = c[2];
      F[1] = VS[8] > 0 ? VS[7] : 0; F[2] = VS[6] < 0.15 ? 0.8 : 0.08;
      F[3] = m[0] * x + m[4] * y + m[8] * z + m[12]; F[4] = m[1] * x + m[5] * y + m[9] * z + m[13]; F[5] = m[2] * x + m[6] * y + m[10] * z + m[14];
      F[6] = VS[0]; F[7] = VS[1];
      stepSmoke(fx.smoke, F);
    }
    // 車況很差（< 25%）：水箱漏水的嘶嘶聲
    const hs = VS[10] > 0 ? 0.25 + 0.75 * (1 - VS[6] / 0.25) : 0, ch = Math.abs(hs - VS[5]) > 0.02 ? 1 : 0;
    VS[5] = ch ? hs : VS[5];
    return ch;
  }
  // 煙的亂數：狀態在 Uint32Array 裡（每一顆煙池一個；不是每一台車一個函式，V8 內嵌以後換車也不會作廢）；數列跟 rng() 一樣
  const rndU = (st) => { st[0] = Math.imul(st[0], 1664525) + 1013904223; return st[0] / 4294967296; };
  function puffTex() {
    if (PUFF) return PUFF;
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = rng(7);
    for (let k = 0; k < 8; k++) {
      const x = 32 + (r() - 0.5) * 20, y = 32 + (r() - 0.5) * 20, rad = 11 + r() * 15;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    PUFF = new THREE.CanvasTexture(c);
    return PUFF;
  }
  const SMOKE_N = 64, SS = 13; // 每顆：位置 3、速度 3、年紀、壽命、大小（開始、最後）、深淺、轉角、轉速
  function makeSmoke() {
    const tex = puffTex();
    if (!tex) return null;
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const iP = new THREE.InstancedBufferAttribute(new Float32Array(SMOKE_N * 4), 4), iC = new THREE.InstancedBufferAttribute(new Float32Array(SMOKE_N * 4), 4);
    iP.setUsage(THREE.DynamicDrawUsage); iC.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iP', iP); geo.setAttribute('iC', iC); geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: tex }, cLight: { value: new THREE.Color(0.86, 0.87, 0.9) }, cDark: { value: new THREE.Color(0.07, 0.07, 0.075) } }]),
      vertexShader: `attribute vec4 iP; attribute vec4 iC; varying vec2 vUv; varying float vA; varying float vS;
#include <common>
#include <fog_pars_vertex>
void main() {
  vUv = position.xy + 0.5; vA = iC.x; vS = iC.y;
  float c = cos(iC.z), s = sin(iC.z);
  vec4 mvPosition = modelViewMatrix * vec4(iP.xyz, 1.0);
  mvPosition.xy += mat2(c, s, -s, c) * position.xy * iP.w;
  gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
      fragmentShader: `uniform sampler2D map; uniform vec3 cLight; uniform vec3 cDark; varying vec2 vUv; varying float vA; varying float vS;
#include <common>
#include <fog_pars_fragment>
void main() {
  float a = texture2D(map, vUv).a * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(mix(cLight, cDark, vS), a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`,
      transparent: true, depthWrite: false, fog: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'dmg-smoke'; mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.matrixAutoUpdate = false;
    const sm = { mesh, geo, iP, iC, S: new Float32Array(SMOKE_N * SS), n: 0, A: new Float64Array(1), rs: new Uint32Array([99]) }; // A[0]：累積到下一顆煙
    if (!KEEP.smoke) KEEP.smoke = sm;
    return sm;
  }
  function stepSmoke(sm, F) {
    const S = sm.S, rs = sm.rs, dt = F[0], rate = F[1], shade = F[2], ex = F[3], ey = F[4], ez = F[5], vx = F[6], vz = F[7];
    if (rate > 0) {
      const A = sm.A;
      A[0] += rate * dt;
      while (A[0] >= 1) {
        A[0] -= 1;
        if (sm.n >= SMOKE_N) continue;
        const o = sm.n++ * SS;
        S[o] = ex + (rndU(rs) - 0.5) * 0.35; S[o + 1] = ey + rndU(rs) * 0.05; S[o + 2] = ez + (rndU(rs) - 0.5) * 0.35;
        S[o + 3] = vx * 0.25 + (rndU(rs) - 0.5) * 0.4; S[o + 4] = 0.5 + rndU(rs) * 0.35; S[o + 5] = vz * 0.25 + (rndU(rs) - 0.5) * 0.4;
        S[o + 6] = 0; S[o + 7] = 2 + rndU(rs) * 0.9 + shade * 0.6; S[o + 8] = 0.22 + rndU(rs) * 0.1; S[o + 9] = 0.85 + rndU(rs) * 0.5 + shade * 0.45; S[o + 10] = shade; S[o + 11] = rndU(rs) * TAU; S[o + 12] = (rndU(rs) - 0.5) * 1.2;
      }
    } else sm.A[0] = 0;
    if (!sm.n) return;
    const P = sm.iP.array, C = sm.iC.array;
    let j = 0;
    for (let i = 0; i < sm.n; i++) {
      const o = i * SS;
      const age = S[o + 6] + dt, life = S[o + 7];
      if (age >= life) continue;
      const q = j * SS;
      if (q !== o) for (let k = 0; k < SS; k++) S[q + k] = S[o + k];
      S[q + 6] = age;
      const damp = Math.max(0, 1 - 0.9 * dt);
      S[q + 3] = S[q + 3] * damp + 0.4 * dt; S[q + 5] = S[q + 5] * damp - 0.16 * dt; S[q + 4] = S[q + 4] * damp + 0.24 * dt; // 往上飄、被風吹歪（煙柱斜斜的，不會堆成一團）
      S[q] += S[q + 3] * dt; S[q + 1] += S[q + 4] * dt; S[q + 2] += S[q + 5] * dt; S[q + 11] += S[q + 12] * dt;
      const t = age / life, a = Math.min(1, age / 0.18) * (1 - t) * (1 - t) * (0.28 + 0.3 * S[q + 10]);
      P[j * 4] = S[q]; P[j * 4 + 1] = S[q + 1]; P[j * 4 + 2] = S[q + 2]; P[j * 4 + 3] = S[q + 8] + (S[q + 9] - S[q + 8]) * Math.sqrt(t);
      C[j * 4] = a; C[j * 4 + 1] = S[q + 10]; C[j * 4 + 2] = S[q + 11]; C[j * 4 + 3] = 0;
      j++;
    }
    sm.n = j; sm.geo.instanceCount = j;
    sm.iP.needsUpdate = true; sm.iC.needsUpdate = true; // 整個上傳（64 顆 × 4 個數＝1 KB）：不用 addUpdateRange（它每叫一次就 new 一個物件）
  }

  // ================= 碎片（玻璃、燈殼）：240 片 InstancedMesh，掉到地上就不動 =================
  const SHARD_N = 240, HS = 13; // 位置 3、速度 3、角度 3、角速度 3、大小
  function makeShards() {
    if (!SHARD_GEO) {
      SHARD_GEO = new THREE.BufferGeometry();
      SHARD_GEO.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.3, 0, 0.55, -0.2, 0, 0.05, 0.5, 0]), 3));
      SHARD_GEO.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0.05, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(SHARD_GEO, mat, SHARD_N);
    mesh.name = 'dmg-shards'; mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    const sh = { mesh, S: new Float32Array(SHARD_N * HS), live: new Uint8Array(SHARD_N), g: new Float32Array(SHARD_N), next: 0, active: 0 };
    if (!KEEP.shards) KEEP.shards = sh;
    return sh;
  }
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  function spawnShards(sh, n, x, y, z, vx, vz, col, ground, r) {
    for (let k = 0; k < n; k++) {
      const i = sh.next; sh.next = (sh.next + 1) % SHARD_N;
      if (sh.mesh.count < SHARD_N) sh.mesh.count = Math.max(sh.mesh.count, i + 1);
      const o = i * HS, S = sh.S;
      S[o] = x + (r() - 0.5) * 0.3; S[o + 1] = y + (r() - 0.5) * 0.15; S[o + 2] = z + (r() - 0.5) * 0.3;
      S[o + 3] = vx * 0.35 + (r() - 0.5) * 2.4; S[o + 4] = 0.5 + r() * 1.8; S[o + 5] = vz * 0.35 + (r() - 0.5) * 2.4;
      S[o + 6] = r() * TAU; S[o + 7] = r() * TAU; S[o + 8] = r() * TAU; S[o + 9] = (r() - 0.5) * 30; S[o + 10] = (r() - 0.5) * 30; S[o + 11] = (r() - 0.5) * 30; S[o + 12] = 0.012 + r() * 0.026;
      if (!sh.live[i]) sh.active++;
      sh.live[i] = 1; sh.g[i] = ground;
      _c.setRGB(col[0] * (0.85 + 0.3 * r()), col[1] * (0.85 + 0.3 * r()), col[2] * (0.85 + 0.3 * r()));
      sh.mesh.setColorAt(i, _c);
    }
    if (sh.mesh.instanceColor) sh.mesh.instanceColor.needsUpdate = true;
  }
  function stepShards(sh, F) {
    if (!sh.active) return;
    const S = sh.S, dt = F[0], A = sh.mesh.instanceMatrix.array;
    for (let i = 0; i < SHARD_N; i++) {
      if (!sh.live[i]) continue;
      const o = i * HS;
      S[o + 4] -= 9.8 * dt;
      S[o] += S[o + 3] * dt; S[o + 1] += S[o + 4] * dt; S[o + 2] += S[o + 5] * dt;
      S[o + 6] += S[o + 9] * dt; S[o + 7] += S[o + 10] * dt; S[o + 8] += S[o + 11] * dt;
      const g = sh.g[i] + 0.003;
      if (S[o + 1] <= g) { // 掉到地上：平躺、不動
        S[o + 1] = g; S[o + 6] = -Math.PI / 2 + (S[o + 6] % 0.3) * 0.2; S[o + 7] = 0;
        sh.live[i] = 0; sh.active--;
      }
      // 矩陣＝旋轉（Euler XYZ，跟 three 的 makeRotationFromEuler 一樣）× 大小＋位置，直接寫（每一幀不配置記憶體）
      const a = Math.cos(S[o + 6]), b = Math.sin(S[o + 6]), c = Math.cos(S[o + 7]), d = Math.sin(S[o + 7]), e = Math.cos(S[o + 8]), f = Math.sin(S[o + 8]), sc = S[o + 12];
      const ae = a * e, af = a * f, be = b * e, bf = b * f, m = i * 16;
      A[m] = c * e * sc; A[m + 1] = (af + be * d) * sc; A[m + 2] = (bf - ae * d) * sc; A[m + 3] = 0;
      A[m + 4] = -c * f * sc; A[m + 5] = (ae - bf * d) * sc; A[m + 6] = (be + af * d) * sc; A[m + 7] = 0;
      A[m + 8] = d * sc; A[m + 9] = -b * c * sc; A[m + 10] = a * c * sc; A[m + 11] = 0;
      A[m + 12] = S[o]; A[m + 13] = S[o + 1]; A[m + 14] = S[o + 2]; A[m + 15] = 1;
    }
    sh.mesh.instanceMatrix.needsUpdate = true;
  }

  // ================= 斷掉的零件（剛體，只跟地面碰：8 個角）=================
  const _p = new THREE.Vector3(), _w = new THREE.Vector3();
  function makeDebris(part, scene, vel, kick, ground, r) {
    // part：車上的零件（Object3D）→ 複製一份放到 scene，外面包一個 group（原點在零件中間）
    part.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(part);
    if (box.isEmpty()) return null;
    const pivot = new THREE.Group();
    pivot.name = 'dmg-debris';
    box.getCenter(pivot.position);
    const cq = new THREE.Quaternion(); part.getWorldQuaternion(cq);
    pivot.quaternion.copy(cq);
    scene.add(pivot); pivot.updateMatrixWorld(true);
    const clone = part.clone(true);
    clone.visible = true;
    const rel = new THREE.Matrix4().copy(pivot.matrixWorld).invert().multiply(part.matrixWorld);
    rel.decompose(clone.position, clone.quaternion, clone.scale);
    pivot.add(clone);
    // 碰撞用的盒子（pivot 座標）
    pivot.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(pivot.matrixWorld).invert(), lb = new THREE.Box3(), tb = new THREE.Box3();
    clone.traverse((o) => { if (o.isMesh && o.geometry) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); tb.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); lb.union(tb); } });
    const c = lb.getCenter(new THREE.Vector3()), h = lb.getSize(new THREE.Vector3()).multiplyScalar(0.5).max(new THREE.Vector3(0.01, 0.01, 0.01));
    // 狀態（stepDebris 每一幀只動這個陣列、直接寫 pivot.matrix：不叫 three 的函式，不配置記憶體）：
    //   0–2 位置、3–6 轉（四元數 x y z w）、7–9 速度、10–12 角速度、13–15 碰撞盒中心（pivot 座標）、16–18 半邊長、19 轉動慣量、20 停了多久、21 掉了多久、22 地面高度
    const s = new Float64Array(23), P = pivot.position, Q = pivot.quaternion;
    s[0] = P.x; s[1] = P.y; s[2] = P.z; s[3] = Q.x; s[4] = Q.y; s[5] = Q.z; s[6] = Q.w;
    s[7] = vel.x * 0.3 + kick.x; s[8] = Math.max(0.8, kick.y); s[9] = vel.z * 0.3 + kick.z;
    s[10] = (r() - 0.5) * 9; s[11] = (r() - 0.5) * 9; s[12] = (r() - 0.5) * 9;
    s[13] = c.x; s[14] = c.y; s[15] = c.z; s[16] = h.x; s[17] = h.y; s[18] = h.z; s[19] = Math.max(1e-4, (h.x * h.x + h.y * h.y + h.z * h.z) * 0.4); s[22] = ground;
    pivot.matrixAutoUpdate = false; // pivot.matrix 現在＝位置＋轉（上面 updateMatrixWorld 算好的）；之後 stepDebris 直接寫
    return debrisRec(pivot, pivot.matrix.elements, s);
  }
  function stepDebris(list, F) {
    const dt = F[0], h = dt / 3;
    for (let bi = 0; bi < list.length; bi++) { // 不用 for…of（每一幀 new 一個 iterator）
      const b = list[bi];
      if (b.sleep) continue;
      const s = b.s, k = s[19], g = s[22];
      for (let it = 0; it < 3; it++) {
        s[8] -= 9.8 * h;
        s[0] += s[7] * h; s[1] += s[8] * h; s[2] += s[9] * h;
        // 轉：q ←（繞角速度的方向轉 |w|·h）· q，再正規化
        const Wx = s[10], Wy = s[11], Wz = s[12], wl = Math.sqrt(Wx * Wx + Wy * Wy + Wz * Wz);
        if (wl > 1e-6) {
          const ha = wl * h * 0.5, sn = Math.sin(ha) / wl, ax = Wx * sn, ay = Wy * sn, az = Wz * sn, aw = Math.cos(ha), qx = s[3], qy = s[4], qz = s[5], qw = s[6];
          let x = ax * qw + aw * qx + ay * qz - az * qy, y = ay * qw + aw * qy + az * qx - ax * qz, z = az * qw + aw * qz + ax * qy - ay * qx, w = aw * qw - ax * qx - ay * qy - az * qz;
          const l = Math.sqrt(x * x + y * y + z * z + w * w);
          if (l > 0) { x /= l; y /= l; z /= l; w /= l; } else { x = 0; y = 0; z = 0; w = 1; }
          s[3] = x; s[4] = y; s[5] = z; s[6] = w;
        }
        const qx = s[3], qy = s[4], qz = s[5], qw = s[6];
        let pen = 0, touch = false;
        for (let c = 0; c < 8; c++) {
          // 盒子的角（轉到世界方向）：r＝q·(中心 ± 半邊長)
          const vx = s[13] + (c & 1 ? s[16] : -s[16]), vy = s[14] + (c & 2 ? s[17] : -s[17]), vz = s[15] + (c & 4 ? s[18] : -s[18]);
          const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
          const rx = vx + qw * tx + qy * tz - qz * ty, ry = vy + qw * ty + qz * tx - qx * tz, rz = vz + qw * tz + qx * ty - qy * tx;
          const d = g - (s[1] + ry);
          if (d <= 0) continue;
          touch = true; if (d > pen) pen = d;
          // 接觸點的速度 v＋w×r；往下的話給衝量（彈 0.25、摩擦 0.6）
          const px = s[11] * rz - s[12] * ry + s[7], py = s[12] * rx - s[10] * rz + s[8], pz = s[10] * ry - s[11] * rx + s[9];
          if (py < 0) {
            const den = 1 + (rx * rx + rz * rz) / k, j = (-1.25 * py) / den;
            s[8] += j; s[10] += (-rz * j) / k; s[12] += (rx * j) / k;
            const tl = Math.sqrt(px * px + pz * pz);
            if (tl > 1e-5) {
              const jt = Math.min(0.6 * j, tl / (1 + (ry * ry) / k + 1)), fx = (-px / tl) * jt, fz = (-pz / tl) * jt;
              s[7] += fx; s[9] += fz;
              s[10] += (ry * fz) / k; s[11] += (rz * fx - rx * fz) / k; s[12] += (-ry * fx) / k;
            }
          }
        }
        if (pen > 0) s[1] += pen;
        if (touch) { s[10] *= 0.985; s[11] *= 0.985; s[12] *= 0.985; s[7] *= 0.995; s[9] *= 0.995; }
        // 停下來：貼著地、慢（< 0.2 m/s、< 0.8 rad/s）0.3 秒；翹著的零件會在兩個角之間一直搖（每一下碰地又彈一點），所以門檻不能太嚴；最多 8 秒一定停
        if (touch && s[7] * s[7] + s[8] * s[8] + s[9] * s[9] < 0.04 && s[10] * s[10] + s[11] * s[11] + s[12] * s[12] < 0.64) { s[20] += h; if (s[20] > 0.3) { b.sleep = true; break; } } else s[20] = 0;
        s[21] += h; if (s[21] > 8) { b.sleep = true; break; }
      }
      // pivot.matrix（matrixAutoUpdate＝false）＝轉＋位置
      const e = b.e, x = s[3], y = s[4], z = s[5], w = s[6], x2 = x + x, y2 = y + y, z2 = z + z;
      const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
      e[0] = 1 - (yy + zz); e[1] = xy + wz; e[2] = xz - wy; e[3] = 0;
      e[4] = xy - wz; e[5] = 1 - (xx + zz); e[6] = yz + wx; e[7] = 0;
      e[8] = xz + wy; e[9] = yz - wx; e[10] = 1 - (xx + yy); e[11] = 0;
      e[12] = s[0]; e[13] = s[1]; e[14] = s[2]; e[15] = 1;
      b.obj.matrixWorldNeedsUpdate = true;
    }
  }
  function dropDebris(list, keep) {
    while (list.length > keep) { const b = list.shift(); b.obj.removeFromParent(); }
  }
  // 看不見鎖：斷掉的零件一直藏著（setWing、setKit 也叫不出來），修好才放開
  function lockHidden(o) {
    if (o.userData.dmgLock) return;
    const want = { v: o.visible };
    o.userData.dmgLock = want;
    Object.defineProperty(o, 'visible', { configurable: true, enumerable: true, get: () => false, set: (v) => { want.v = !!v; } });
  }
  function unlockHidden(o) {
    const want = o.userData.dmgLock;
    if (!want) return;
    delete o.visible; o.visible = want.v; delete o.userData.dmgLock;
  }
  function sceneOf(o) { let r = o; while (r.parent) r = r.parent; return r === o ? null : r; }
  function visibleIn(o, top) { for (let p = o; p && p !== top; p = p.parent) if (!p.visible) return false; return true; }

  // 用零件產生器做一個「探針」量它在車身座標的外框（後照鏡）：材質用假的，量完就丟
  const DUMMY = { mat: null };
  const dummyMats = () => { if (!DUMMY.mat) DUMMY.mat = new THREE.MeshStandardMaterial(); return new Proxy({}, { get: () => DUMMY.mat }); };
  function boxOf(obj, inv) {
    const b = new THREE.Box3(), t = new THREE.Box3(), m = new THREE.Matrix4();
    obj.updateWorldMatrix(true, true);
    obj.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      t.copy(o.geometry.boundingBox).applyMatrix4(inv ? m.multiplyMatrices(inv, o.matrixWorld) : o.matrixWorld);
      b.union(t);
    });
    return b;
  }
  function probeBox(fn) {
    let g = null;
    try { g = fn(); } catch { return null; }
    if (!g) return null;
    g.updateMatrixWorld(true);
    const b = boxOf(g, null);
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    return b.isEmpty() ? null : b;
  }
  const boxNear = (a, b, e) => Math.abs(a.min.x - b.min.x) < e && Math.abs(a.min.y - b.min.y) < e && Math.abs(a.min.z - b.min.z) < e && Math.abs(a.max.x - b.max.x) < e && Math.abs(a.max.y - b.max.y) < e && Math.abs(a.max.z - b.max.z) < e;

  // ================= 完整的車 =================
  function createDamage(S, opts = {}) {
    const key = opts.key || '', car = S.car, body = S.body, spec = S.spec || {}, tex = S.tex, mid = !!MID[key];
    const shellMesh = body.getObjectByName('paint'), innerMesh = body.getObjectByName('inside'), glzMesh = body.getObjectByName('glass');
    const U = (shellMesh && shellMesh.material.userData.dmgU) || newU(); // 同一台車第二次 createDamage：shader 已經接好了，用同一組
    const mats = new Set();
    if (shellMesh) { patchMat(shellMesh.material, 'paint', U); mats.add(shellMesh.material); }
    if (innerMesh) { patchMat(innerMesh.material, 'inside', U); mats.add(innerMesh.material); }
    if (glzMesh) { patchMat(glzMesh.material, 'glass', U); mats.add(glzMesh.material); }
    const usesPatched = (m) => (Array.isArray(m.material) ? m.material.some((x) => mats.has(x)) : mats.has(m.material));
    let R = null, alive = true, hits = [], wear = 0, health = 1, pull = 0, glassL = [], lampsBroken = [], partsGone = 0, lastMs = 0, smokeOn = opts.smoke !== false;
    const H = newH(), H0 = newH(), vel = new THREE.Vector3(), tmpV = new THREE.Vector3();
    const VS = new Float64Array(11); // 每一幀的數字（stepFx 的說明）：速度、上一幀的位置、嘶嘶聲、車況、冒煙⋯；撞的時候速度抄到 vel
    const fx = fxRec();

    function prepare() {
      if (R) return R;
      const t0 = now();
      car.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(body.matrixWorld).invert(), rel = (o) => new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      const defs = [], skip = new Set([shellMesh, innerMesh, glzMesh].filter(Boolean)); // 車內（座椅、門板、儀表板）也跟著凹：不然門凹進去，門板會從外面露出來
      // 車殼（三層共用一個網格）
      let shell = null;
      if (shellMesh) { shell = mkDef([shellMesh, innerMesh, glzMesh].filter((m) => m && m.geometry === shellMesh.geometry), shellMesh.geometry, null, { inPlace: true, masked: true, prim: true }); if (shell) defs.push(shell); }
      // Supra 的車頭（依套件換）
      const noseDefs = [];
      for (const m of Object.values(S.noses || {})) { skip.add(m); const d = mkDef([m], m.geometry, rel(m), { inPlace: true, masked: usesPatched(m), prim: true }); if (d) { if (d.M) { d.inPlace = false; } defs.push(d); noseDefs.push(d); } }
      // 尾翼（整支：歪、斷掉）
      const wings = [];
      for (const [name, w] of Object.entries(S.wings || {})) {
        skip.add(w);
        const b = boxOf(w, inv);
        if (b.isEmpty()) continue;
        const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, hz = (b.max.z - b.min.z) / 2;
        wings.push({ obj: w, name, box: b, pos0: w.position.clone(), quat0: w.quaternion.clone(), piv: [cx, b.min.y, cz],
          mounts: [[cx, b.min.y, cz - hz * 0.6], [cx, b.min.y, cz + hz * 0.6]].map((p) => ({ b: p, c: p.slice() })), off: [0, 0, 0], tilt: 0, gone: false });
      }
      // 後照鏡：用 spec.mirror 做一個探針，外框一樣的就是
      const mirrors = [];
      if (spec.mirror) {
        const cands = body.children.filter((c) => !skip.has(c));
        for (const s of [-1, 1]) {
          const pb = probeBox(() => spec.mirror(S.paint, S.mats || dummyMats(), s));
          if (!pb) continue;
          const m = cands.find((c) => !mirrors.some((x) => x.obj === c) && boxNear(boxOf(c, inv), pb, 0.003));
          if (!m) continue;
          skip.add(m);
          const inner = s < 0 ? pb.max.z : pb.min.z, mt = [(pb.min.x + pb.max.x) / 2, (pb.min.y + pb.max.y) / 2, inner];
          mirrors.push({ obj: m, s, box: pb, pos0: m.position.clone(), quat0: m.quaternion.clone(), mount: { b: mt, c: mt.slice() }, off: [0, 0, 0], fold: 0, gone: false });
        }
      }
      // 其他零件（保桿下巴、套件、寬體、排氣管、車燈⋯）：一個一個頂點跟著凹；InstancedMesh（螺絲）整顆移
      const inst = [], cabDefs = [];
      const wide = body.getObjectByName('wide');
      const walk = (o, cab) => {
        for (const c of o.children) {
          if (skip.has(c)) continue;
          const inCab = cab || c === S.cabin || c.name === 'cabin' || c.name === 'interior';
          if (c.isInstancedMesh) {
            const M = rel(c), A = c.instanceMatrix.array, n = c.count, pts = new Float32Array(n * 3), t = new THREE.Matrix4(), p = new THREE.Vector3();
            for (let i = 0; i < n; i++) { t.fromArray(A, i * 16); p.setFromMatrixPosition(t).applyMatrix4(M); pts.set([p.x, p.y, p.z], i * 3); }
            inst.push({ mesh: c, M, Mi: new THREE.Matrix3().setFromMatrix4(M).invert(), A0: A.slice(), B: pts, C: pts.slice(), moved: false });
          } else if (c.isMesh && c.geometry) {
            let inWide = false; for (let p = c; p && p !== body; p = p.parent) if (p === wide) inWide = true;
            const d = mkDef([c], c.geometry, rel(c), { masked: usesPatched(c), prim: inWide, keepVis: inWide ? wide : null });
            if (d) { if (!d.M) d.inPlace = false; defs.push(d); if (inCab) cabDefs.push(d); }
          }
          if (c.children.length) walk(c, inCab);
        }
      };
      walk(body, false);
      // 車子的外形
      const pts = shell ? [shell.B, ...noseDefs.map((d) => d.B)] : defs.filter((d) => !cabDefs.includes(d)).map((d) => d.B); // 沒有「paint」車殼的車（別的做法做的車）：用全部的零件
      const U0 = tex && tex.U;
      const Sh = shapeOf(pts, spec, { gY: U0 && U0.uGlassY ? U0.uGlassY.value : 0.95 });
      // 玻璃分片、燈（照投影貼圖）
      const panes = [null, null, null, null, null];
      let lampCl = [];
      if (shell && tex && U0) {
        const B = shell.B, N = shell.N, n = shell.n, pane = (shell.pane = new Uint8Array(n)), top = [];
        for (let i = 0; i < n; i++) { const p = glassAt(tex, Sh.gY, B[i * 3], B[i * 3 + 1], B[i * 3 + 2], N ? N[i * 3 + 2] : 0); if (p) { pane[i] = p; if (p === 3) top.push(B[i * 3]); } }
        const xs = splitX(top);
        U.uDM.value.x = xs;
        const lists = [[], [], [], [], []];
        for (let i = 0; i < n; i++) if (pane[i]) { if (pane[i] === 3 && B[i * 3] <= xs) pane[i] = 4; lists[pane[i]].push(i); }
        for (let p = 1; p <= 4; p++) {
          const L = lists[p];
          if (L.length < 12) { for (const i of L) pane[i] = 0; continue; }
          let x0 = 9, x1 = -9, y0 = 9, z0 = 9, z1 = -9;
          for (const i of L) { const x = B[i * 3], y = B[i * 3 + 1], z = B[i * 3 + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
          panes[p] = { id: p, verts: Int32Array.from(L), x0, x1, y0, z0, z1 };
        }
        // 燈：車殼＋車頭
        const cl = [[], [], [], [], []], src = [];
        for (const d of [shell, ...noseDefs]) {
          d.lamp = new Uint8Array(d.n);
          const Bd = d.B, Nd = d.N, nm = d.M ? new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().fromArray(d.M)).invert().transpose() : null, nv = new THREE.Vector3();
          for (let i = 0; i < d.n; i++) {
            let nx = Nd ? Nd[i * 3] : 0, ny = Nd ? Nd[i * 3 + 1] : 0;
            if (nm && Nd) { nv.fromArray(Nd, i * 3).applyMatrix3(nm).normalize(); nx = nv.x; ny = nv.y; }
            const k = lampAt(tex, U0, Bd[i * 3], Bd[i * 3 + 1], Bd[i * 3 + 2], nx, ny);
            if (k) { d.lamp[i] = k; cl[k].push(src.length / 3); src.push(Bd[i * 3], Bd[i * 3 + 1], Bd[i * 3 + 2]); }
          }
        }
        const SP = Float32Array.from(src);
        for (let k = 1; k <= 4; k++) if (cl[k].length >= 6) { const c = cluster(cl[k], SP); lampCl.push({ id: k, ...c, broken: false }); }
        const fy = lampCl.filter((c) => c.id <= 2).map((c) => c.y0), ry = lampCl.filter((c) => c.id > 2).map((c) => c.y0);
        if (fy.length) Sh.lampF = Math.min(...fy) - 0.03;
        if (ry.length) Sh.lampR = Math.min(...ry) - 0.03;
      }
      // 輪子
      const W = spec.wheels || {}, wheels = (S.wheels || []).map((wh, i) => {
        const hub = wh.parent, s = i % 2 === 0 ? -1 : 1, front = i < 2;
        return { wh, hub, brake: hub ? hub.children.filter((c) => c !== wh) : [], s, x: front ? fin(W.xf, 1.3) : fin(W.xr, -1.3), z: s * fin(front ? W.trackF : W.trackR, 0.76),
          R: fin(front ? W.RF ?? W.R : W.RR ?? W.R, 0.33), w: fin(front ? W.wF : W.wR, 0.24), y0: wh.position.y, camber: 0, toe: 0, front,
          r0: [wh, ...(hub ? hub.children.filter((c) => c !== wh) : [])].map((o) => [o.rotation.x, o.rotation.y, o.position.y]) };
      });
      // 冒煙的地方：引擎蓋上面（中置引擎的車在後面）
      const ex = mid ? Sh.xr + 0.55 : Sh.xf - 0.05, ey = Math.max(0.5, bil(Sh.Hm, MNX, MNZ, MX0, MZ0, ex, 0)) + 0.03;
      let maxN = 0;
      for (const d of defs) maxN = Math.max(maxN, d.n);
      R = { defs, shell, noseDefs, inst, wings, mirrors, wheels, panes, lampCl, S: Sh, emit: { b: [ex, ey, 0], c: [ex, ey, 0] },
        sc: { idx: new Int32Array(maxN), dsp: new Float32Array(maxN * 3), out: new Float64Array(3), C: new Float64Array(13) }, stats: { pane: new Float64Array(5), lamp: new Float64Array(5) } };
      // 先算好：每個頂點不會變的東西、外框、鄰接表、原本的面法線（不然第一次撞會卡一下）
      const t1 = now();
      for (const d of cabDefs) d.sh = skinShift(d.B, d.n, Sh);
      for (const d of defs) { d.st = staticsOf(d.B, d.n, Sh, d.sh); mayTouch(d, H0); if (!d.geo.boundingSphere) d.geo.computeBoundingSphere(); d.r0 = d.geo.boundingSphere.radius; }
      const t2 = now();
      ensureFN(defs.reduce((m, d) => Math.max(m, d.idx ? d.idx.length : d.n), 0));
      for (const d of defs) if (d.prim || d.n > 3000) { buildAdj(d); if (d.N) initA0(d); }
      R.prep = { st: t2 - t1, adj: now() - t2, warm: 0 };
      // 暖身：在這台車上真的撞三下（前、左、後；不出聲、不掉零件）再恢復原狀：瀏覽器先把真的會跑的程式編譯好，第一次撞才不會卡
      if (opts.warm !== false) {
        const t3 = now(), WH = [[Sh.nose - 0.03, -0.3, -1, 0, 16, 0, 9, 3, NaN, -1], [0.1, -Sh.hw + 0.03, 0, 1, 11, 0, 0.3, 3, NaN, -1], [Sh.tail + 0.03, 0.2, 1, 0, 14, 0, 9, 3, NaN, -1]];
        for (let i = 0; i < WH.length; i++) doHit(WH[i], i, false);
        finish();
        resetAll();
        finish();
        R.prep.warm = now() - t3;
      }
      R.ms = now() - t0;
      return R;
    }

    // 第一個碰到的車身（看得到的車殼、車頭、寬體）在法線方向多深
    function firstContact(H) {
      let best = Infinity;
      for (const d of R.defs) {
        if (!d.prim) continue;
        if (d.keepVis ? !visibleIn(d.keepVis, body) : !visibleIn(d.mesh, body)) continue;
        const P = d.P, m = d.M, n = d.n;
        for (let i = 0; i < n; i++) {
          const i3 = i * 3;
          let x = P[i3], y = P[i3 + 1], z = P[i3 + 2];
          if (m) { const X = x, Y = y, Z = z; x = m[0] * X + m[4] * Y + m[8] * Z + m[12]; y = m[1] * X + m[5] * Y + m[9] * Z + m[13]; z = m[2] * X + m[6] * Y + m[10] * Z + m[14]; }
          if (y < 0.05 || y > H.h || (H.py >= 0 && Math.abs(y - H.py) > 0.5)) continue;
          const dx = x - H.px, dz = z - H.pz;
          if (!H.wall && Math.abs(dx * H.tx + dz * H.tz - H.uc) > H.r + 0.04) continue;
          const s = dx * H.nx + dz * H.nz;
          if (s < best) best = s;
        }
      }
      return best === Infinity ? -0.04 : clamp(best, -0.6, 0.4);
    }

    const OUT = new Float64Array(3);
    // 剛體零件的一點跟著場走（pt.b 原本、pt.c 現在）；回傳這一下動了多少
    function movePt(pt) {
      if (!fieldAt(H, R.S, pt.c[0], pt.c[1], pt.c[2], pt.b[0], pt.b[1], pt.b[2], OUT)) return 0;
      pt.c[0] += OUT[0]; pt.c[1] += OUT[1]; pt.c[2] += OUT[2];
      return Math.hypot(OUT[0], OUT[1], OUT[2]);
    }

    // 一下撞擊（live：真的在撞，會掉零件、碎片、出聲；不然是重播）
    const TM = { scan: 0, normals: 0, moved: 0, ring: 0 };
    function doHit(a, idx, live) {
      const t0 = now();
      prepHit(H, a, idx, R.S);
      if (!(a[8] === a[8])) { a[8] = q3(firstContact(H)); H.s0 = a[8]; }
      const st = R.stats, sc = R.sc;
      st.pane.fill(0); st.lamp.fill(0);
      for (const d of R.defs) { const k = scanDef(d, H, R.S, sc); if (k) writeDef(d, k, sc, d.pane || d.lamp ? st : null); }
      const t1 = now(); TM.scan = t1 - t0;
      // 螺絲（InstancedMesh）
      for (const it of R.inst) {
        const n = it.mesh.count;
        for (let i = 0; i < n; i++) {
          const i3 = i * 3;
          if (!fieldAt(H, R.S, it.C[i3], it.C[i3 + 1], it.C[i3 + 2], it.B[i3], it.B[i3 + 1], it.B[i3 + 2], OUT)) continue;
          it.C[i3] += OUT[0]; it.C[i3 + 1] += OUT[1]; it.C[i3 + 2] += OUT[2]; it.moved = true;
        }
      }
      const out = { dent: q3(H.D), glass: 0, lamps: 0, parts: 0, health: 0 };
      const scene = live ? fxScene() : null, ground = live ? groundY() : 0;
      // 後照鏡：斷掉或往後折
      for (const m of R.mirrors) {
        if (m.gone) { H.rn(); continue; }
        const dd = movePt(m.mount), near = Math.sign(H.pz) === m.s && Math.abs(H.px - m.mount.b[0]) < 0.7 && Math.abs(H.pz) > 0.5 * R.S.hw;
        const acc = Math.hypot(m.mount.c[0] - m.mount.b[0], m.mount.c[1] - m.mount.b[1], m.mount.c[2] - m.mount.b[2]), rr = H.rn();
        if (acc > 0.03 || (near && H.v > 6.5)) {
          m.gone = true; partsGone++; out.parts++;
          if (scene) spawnPart(m.obj, scene, ground, [0, 1.2 + rr, m.s * (1.5 + H.v * 0.12)]);
          lockHidden(m.obj);
        } else if (dd > 0 || (near && H.v > 4)) {
          m.fold = Math.min(1.1, m.fold + 10 * dd + (near ? 0.35 + 0.05 * H.v : 0));
          m.off = [m.mount.c[0] - m.mount.b[0], m.mount.c[1] - m.mount.b[1], m.mount.c[2] - m.mount.b[2]];
          poseMirror(m);
        }
      }
      // 尾翼：歪掉或斷掉
      for (const w of R.wings) {
        if (w.gone) { H.rn(); continue; }
        const d0 = movePt(w.mounts[0]), d1 = movePt(w.mounts[1]), rr = H.rn();
        const acc = Math.max(...w.mounts.map((p) => Math.hypot(p.c[0] - p.b[0], p.c[1] - p.b[1], p.c[2] - p.b[2])));
        if (acc > 0.05 || (H.nx > 0.55 && H.v > 12)) {
          w.gone = true;
          if (w.obj.visible) { partsGone++; out.parts++; if (scene) spawnPart(w.obj, scene, ground, [H.nx * 1.5, 1.5 + rr * 2, (rr - 0.5) * 2]); }
          lockHidden(w.obj);
        } else if (d0 + d1 > 0) {
          w.off = [0, 1, 2].map((k) => (w.mounts[0].c[k] - w.mounts[0].b[k] + w.mounts[1].c[k] - w.mounts[1].b[k]) / 2);
          w.tilt = Math.min(0.35, w.tilt + 3 * (d0 + d1) / 2);
          poseWing(w);
        }
      }
      // 輪子：撞到輪子附近（側面、角落）而且夠快 → 外傾、束角歪掉
      for (const wl of R.wheels) {
        const dw = Math.hypot(H.px - wl.x, H.pz - wl.z), rr = H.rn();
        if (dw > 0.9 || H.v <= 7) continue;
        const k = Math.min(1, (H.v - 7) / 15) * (1 - dw / 0.9);
        wl.camber = Math.max(-0.16, wl.camber - 0.1 * k);
        wl.toe = clamp(wl.toe + (rr < 0.5 ? -1 : 1) * 0.07 * k, -0.1, 0.1);
        poseWheel(wl);
      }
      movePt(R.emit);
      // 玻璃、燈
      const PC = R.shell ? R.shell.P : null;
      if (PC) out.glass = glassRules(H, R.S, R.panes, st, PC, R.shell.B, glassL, H.rn);
      for (const c of R.lampCl) {
        if (c.broken) continue;
        if (st.lamp[c.id] > 0.008 || (Math.hypot(c.c[0] - H.px, c.c[2] - H.pz) < 0.45 && H.v > 4.5)) {
          c.broken = true; out.lamps++;
          if (scene && fx.shards) { const w = toWorld(c.c); spawnShards(fx.shards, 10, w.x, w.y, w.z, vel.x, vel.z, c.id <= 2 ? [0.9, 0.92, 0.95] : [0.75, 0.03, 0.03], ground, H.rn); }
        }
      }
      if (scene && out.glass && fx.shards) for (const g of glassL) if (g.hole > 0 && !g.spawned) { g.spawned = true; const w = toWorld(g.c); spawnShards(fx.shards, 22, w.x, w.y, w.z, vel.x, vel.z, [0.72, 0.8, 0.84], ground, H.rn); }
      return out;
    }
    // 撞完（或重播完）：法線、上傳、uniform、車況
    function finish() {
      const t0 = now();
      let mv = 0, ring = 0;
      for (const d of R.defs) if (d.mvN) { mv += d.mvN; ring += fixNormals(d); }
      TM.normals = now() - t0; TM.moved = mv; TM.ring = ring;
      for (const it of R.inst) if (it.moved) {
        it.moved = false;
        const A = it.mesh.instanceMatrix.array, t = new THREE.Matrix4(), p = new THREE.Vector3();
        for (let i = 0; i < it.mesh.count; i++) {
          t.fromArray(it.A0, i * 16);
          p.set(it.C[i * 3] - it.B[i * 3], it.C[i * 3 + 1] - it.B[i * 3 + 1], it.C[i * 3 + 2] - it.B[i * 3 + 2]).applyMatrix3(it.Mi);
          t.elements[12] += p.x; t.elements[13] += p.y; t.elements[14] += p.z;
          t.toArray(A, i * 16);
        }
        it.mesh.instanceMatrix.needsUpdate = true;
      }
      // uniform
      const G = U.uDG.value, K = U.uDK.value, L = U.uDL.value;
      G.fill(0); K.fill(0); L.fill(0);
      glassL.forEach((g, i) => { G.set([g.c[0], g.c[1], g.c[2], g.R], i * 4); K.set([g.hole, g.pane, g.seed, 0], i * 4); });
      let nl = 0;
      for (const c of R.lampCl) if (c.broken && nl < NL) { L.set([c.c[0], c.c[1], c.c[2], c.r * 1.15], nl * 4); nl++; }
      U.uDM.value.y = glassL.length; U.uDM.value.z = nl;
      for (const m of mats) m.uniformsNeedUpdate = true;
      lampsBroken = R.lampCl.filter((c) => c.broken);
      // 車況、方向盤偏
      let loss = wear;
      for (const a of hits) loss += lossOf(a, R.S, mid);
      health = clamp(1 - loss, 0, 1);
      const w = R.wheels;
      pull = w.length === 4 ? clamp((-(w[0].toe + w[1].toe) / 2 + (0.5 * (w[2].toe + w[3].toe)) / 2) / 0.06, -1, 1) : 0;
    }
    function poseMirror(m) {
      const o = m.obj, a = -m.s * m.fold, p = m.mount.b;
      _q.setFromAxisAngle(_w.set(0, 1, 0), a);
      o.position.copy(m.pos0).sub(_v.set(p[0], p[1], p[2])).applyQuaternion(_q).add(_v).add(_s.set(m.off[0], m.off[1], m.off[2]));
      o.quaternion.copy(m.quat0).premultiply(_q);
    }
    function poseWing(w) {
      const o = w.obj, p = w.piv;
      _q.setFromAxisAngle(_w.set(0, 0, 1), w.tilt);
      o.position.copy(w.pos0).sub(_v.set(p[0], p[1], p[2])).applyQuaternion(_q).add(_v).add(_s.set(w.off[0], w.off[1], w.off[2]));
      o.quaternion.copy(w.quat0).premultiply(_q);
    }
    function poseWheel(wl) {
      const lift = wl.R * Math.cos(wl.camber) + (wl.w / 2) * Math.abs(Math.sin(wl.camber)) - wl.R; // 外傾了輪胎最低點還是踩在地上
      [wl.wh, ...wl.brake].forEach((o, i) => { o.rotation.x = wl.r0[i][0] + wl.camber; o.rotation.y = wl.r0[i][1] + wl.toe; o.position.y = wl.r0[i][2] + lift; });
    }
    function resetParts() {
      for (const m of R.mirrors) { unlockHidden(m.obj); m.obj.position.copy(m.pos0); m.obj.quaternion.copy(m.quat0); m.gone = false; m.fold = 0; m.off = [0, 0, 0]; m.mount.c = m.mount.b.slice(); }
      for (const w of R.wings) { unlockHidden(w.obj); w.obj.position.copy(w.pos0); w.obj.quaternion.copy(w.quat0); w.gone = false; w.tilt = 0; w.off = [0, 0, 0]; for (const p of w.mounts) p.c = p.b.slice(); }
      for (const wl of R.wheels) { wl.camber = 0; wl.toe = 0; [wl.wh, ...wl.brake].forEach((o, i) => { o.rotation.x = wl.r0[i][0]; o.rotation.y = wl.r0[i][1]; o.position.y = wl.r0[i][2]; }); }
      for (const it of R.inst) { it.C.set(it.B); it.mesh.instanceMatrix.array.set(it.A0); it.mesh.instanceMatrix.needsUpdate = true; }
      for (const c of R.lampCl) c.broken = false;
      R.emit.c = R.emit.b.slice();
      glassL = []; partsGone = 0;
    }
    function resetAll() {
      for (const d of R.defs) unprime(d, false);
      resetParts();
      hits = []; wear = 0;
    }
    // ---- 效果 ----
    function fxScene() {
      const sc = opts.scene || sceneOf(car);
      if (!sc) return null;
      if (fx.scene !== sc) {
        if (fx.smoke) sc.add(fx.smoke.mesh);
        if (fx.shards) sc.add(fx.shards.mesh);
        fx.scene = sc;
      }
      if (!fx.shards && typeof document !== 'undefined') { fx.shards = makeShards(); sc.add(fx.shards.mesh); }
      return sc;
    }
    const groundY = () => { car.updateWorldMatrix(true, false); return tmpV.setFromMatrixPosition(car.matrixWorld).y; };
    const toWorld = (p) => { body.updateWorldMatrix(true, false); return _p.set(p[0], p[1], p[2]).applyMatrix4(body.matrixWorld).clone(); };
    function spawnPart(obj, scene, ground, kick) {
      if (!visibleIn(obj, body)) return;
      const q = new THREE.Quaternion(); car.getWorldQuaternion(q);
      const k = new THREE.Vector3(kick[0], kick[1], kick[2]).applyQuaternion(q);
      const b = makeDebris(obj, scene, vel, k, ground, rng(fx.debris.length * 7 + hits.length * 13 + 5));
      if (b) { fx.debris.push(b); dropDebris(fx.debris, 16); }
    }
    function clearDebris() {
      dropDebris(fx.debris, 0);
      if (fx.shards) { fx.shards.mesh.count = 0; fx.shards.live.fill(0); fx.shards.active = 0; fx.shards.next = 0; }
      if (fx.smoke) { fx.smoke.n = 0; fx.smoke.geo.instanceCount = 0; }
      if (VS[5] > 0) { VS[5] = 0; if (opts.audio && opts.audio.hiss) try { opts.audio.hiss(0); } catch { /* 算了 */ } } // 嘶嘶聲也停（下次 update 車況還是很差會再響）
    }

    function hit(e) {
      if (!alive || !e) return null;
      const t0 = now();
      if (!(fin(+e.speed, 0) >= V_MIN)) return null;
      const a = toRec(e);
      if (!a) return null;
      prepare();
      vel.set(VS[0], 0, VS[1]); // 車子現在的速度（update 算的）：碎片、零件跟著甩出去
      onCar(a, R.S);
      let out;
      if (hits.length >= MAX_HITS) { // 撞太多下了：不再凹（存檔不會一直變大），只扣車況
        wear = Math.min(1, wear + 0.5 * lossOf(a, R.S, mid));
        out = { dent: 0, glass: 0, lamps: 0, parts: 0, health: 0 };
      } else {
        out = doHit(a, hits.length, true);
        hits.push(a);
      }
      finish();
      out.health = health;
      if (opts.audio && opts.audio.crash) {
        try { opts.audio.crash({ strength: clamp((a[4] - 2) / 24, 0.05, 1), glass: Math.min(1, out.glass * 0.6 + out.lamps * 0.3), pan: clamp(a[1], -1, 1) * 0.6 }); } catch { /* 沒聲音也沒關係 */ }
      }
      lastMs = now() - t0;
      return out;
    }
    function apply(state) {
      if (!alive) return;
      const t0 = now();
      prepare();
      resetAll();
      if (state && Array.isArray(state.h)) {
        for (const a0 of state.h) {
          if (hits.length >= MAX_HITS) break;
          if (!okRec(a0)) continue;
          const a = normRec(a0);
          doHit(a, hits.length, false);
          hits.push(a);
        }
        wear = clamp(fin(+state.x, 0), 0, 1);
      }
      for (const g of glassL) g.spawned = true; // 重播的不再噴碎片
      finish();
      lastMs = now() - t0;
    }
    function repair() { if (!alive) return; apply(null); clearDebris(); }

    // stepFx 用的（每一台車一個）
    const I = fxState(VS, fx, car.position);
    function update(dt) {
      if (!alive) return;
      const d = fin(+dt, 0);
      if (!(d > 0)) return;
      FR[0] = d < 0.1 ? d : 0.1;
      const par = car.parent;
      if (par) { par.updateWorldMatrix(true, false); I.parW = par.matrixWorld.elements; } else I.parW = null;
      const rate = smokeOn && R && hits.length ? (health < 0.15 ? 14 : health < 0.4 ? 6 : 0) : 0;
      VS[9] = 0;
      if (R && (rate > 0 || (fx.smoke && fx.smoke.n))) {
        const sc = fxScene(); // 車子換了 scene（車庫 ↔ 村子）：煙、碎片跟著搬過去
        if (sc && !fx.smoke) { fx.smoke = makeSmoke(); if (fx.smoke) sc.add(fx.smoke.mesh); }
        if (fx.smoke) { body.updateWorldMatrix(true, false); I.bodyW = body.matrixWorld.elements; I.emit = R.emit.c; VS[9] = 1; VS[8] = visibleIn(car, null) ? 1 : 0; VS[7] = rate; }
      }
      VS[6] = health; VS[10] = smokeOn && hits.length && health < 0.25 ? 1 : 0;
      if (stepFx(I, FR) && opts.audio && opts.audio.hiss) try { opts.audio.hiss(VS[5]); } catch { /* 算了 */ }
    }
    function dispose() {
      if (!alive) return;
      if (R) { // 全部恢復原狀（同一台車之後再 createDamage 也沒問題）
        for (const d of R.defs) unprime(d, true);
        resetParts();
        U.uDM.value.y = 0; U.uDM.value.z = 0; U.uDG.value.fill(0); U.uDK.value.fill(0); U.uDL.value.fill(0);
        for (const m of mats) m.uniformsNeedUpdate = true;
      }
      clearDebris();
      for (const k of ['smoke', 'shards']) if (fx[k]) { fx[k].mesh.removeFromParent(); if (k === 'smoke') fx[k].geo.dispose(); fx[k].mesh.material.dispose(); if (k === 'shards') fx[k].mesh.dispose(); fx[k] = null; }
      if (opts.audio && opts.audio.hiss && VS[5] > 0) try { opts.audio.hiss(0); } catch { /* 算了 */ }
      alive = false;
    }
    const api = {
      hit, apply, repair, update, prepare: () => { prepare(); return R.ms; }, clearDebris, dispose,
      setSmoke(on) { smokeOn = !!on; },
      cost: (price) => cost(api.state, price),
      get state() {
        if (!hits.length && !wear) return null;
        return { v: 1, h: hits.map((a) => a.map((x) => (x === x ? x : -1))), x: q3(wear), hp: q3(health), gl: glassCount(glassL), lp: lampsBroken.length, pt: partsGone };
      },
      get health() { return health; },
      get perf() { return perfOf(health, pull); },
      get lastMs() { return lastMs; },
      get hits() { return hits.length; },
      get debug() { return R && { ms: R.ms, prep: R.prep, tm: { ...TM }, panes: R.panes.map((p) => p && p.verts.length), lamps: R.lampCl.map((c) => ({ id: c.id, c: c.c.map(q3), r: q3(c.r) })), mirrors: R.mirrors.length, wings: R.wings.map((w) => w.name), defs: R.defs.length, verts: R.defs.reduce((a, d) => a + d.n, 0), inst: R.inst.length, glass: glassL.map((g) => ({ ...g })), xsplit: U.uDM.value.x, S: { hw: R.S.hw, lampF: R.S.lampF, lampR: R.S.lampR, gY: R.S.gY },
        fx: { debris: fx.debris.map((b) => ({ sleep: b.sleep, v: q3(Math.hypot(b.s[7], b.s[8], b.s[9])), w: q3(Math.hypot(b.s[10], b.s[11], b.s[12])), rest: q3(b.s[20]), age: q3(b.s[21]), y: q3(b.s[1] - b.s[22]), name: b.obj.children[0] && b.obj.children[0].name })), smoke: fx.smoke ? fx.smoke.n : 0, shards: fx.shards ? fx.shards.active : 0 } }; },
    };
    return api;
  }

  // ================= 輕量車（carlod.js）=================
  const LOD_CLS = { glass: 1, lamp: 4, lens: 5, amber: 7, red: 8, rev: 9, black: 11, trim: 2 };
  function damageLod(lod, state, opts = {}) {
    const bodyMesh = lod.meshes.body, glassMesh = lod.meshes.glass, key = lod.key || '', mid = !!MID[key];
    const spec = opts.spec || (lod.spec) || { wheels: {} };
    const cache = new WeakMap(); // 共用網格 → 分類結果
    let src = null, G = null, alive = true, hits = [], wear = 0, health = 1, glassL = [], lastMs = 0;
    const H = newH(), OUT = new Float64Array(3), debris = [];
    let parts = []; // { tris: [[kind, t]], gone }
    function classify(op, gl) {
      let c = cache.get(op);
      if (c) return c;
      const P = op.attributes.position.array, N = op.attributes.normal.array, C = op.attributes.lodCls.array, n = P.length / 3;
      const I = op.index.array, J = gl.index.array;
      // 連通的零件（union-find）：最大的幾塊是車身，小的是後照鏡、尾翼⋯
      const par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i;
      const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
      const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
      for (const X of [I, J]) for (let t = 0; t < X.length; t += 3) { uni(X[t], X[t + 1]); uni(X[t], X[t + 2]); }
      const comp = new Map();
      for (let i = 0; i < n; i++) { const r = find(i); let e = comp.get(r); if (!e) comp.set(r, (e = { n: 0, b: new THREE.Box3() })); e.n++; e.b.expandByPoint(_v.fromArray(P, i * 3)); }
      const main = new Set([...comp.entries()].filter(([, e]) => e.n > n * 0.12).map(([r]) => r));
      const inMain = new Uint8Array(n); for (let i = 0; i < n; i++) inMain[i] = main.has(find(i)) ? 1 : 0;
      const mainPts = []; for (let i = 0; i < n; i++) if (inMain[i]) mainPts.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      // 玻璃分片
      const gv = new Uint8Array(n); for (let t = 0; t < J.length; t++) gv[J[t]] = 1;
      let gy = 9; for (let i = 0; i < n; i++) if (gv[i] && Math.abs(N[i * 3 + 2]) > 0.45 && P[i * 3 + 1] < gy) gy = P[i * 3 + 1];
      const Sh = shapeOf([Float32Array.from(mainPts)], spec, { gY: gy < 9 ? gy : 0.95 });
      const pane = new Uint8Array(n), top = [];
      for (let i = 0; i < n; i++) if (gv[i]) { if (Math.abs(N[i * 3 + 2]) > 0.45) pane[i] = P[i * 3 + 2] < 0 ? 1 : 2; else { pane[i] = 3; top.push(P[i * 3]); } }
      const xs = splitX(top), lists = [[], [], [], [], []];
      for (let i = 0; i < n; i++) if (pane[i]) { if (pane[i] === 3 && P[i * 3] <= xs) pane[i] = 4; lists[pane[i]].push(i); }
      const panes = [null];
      for (let p = 1; p <= 4; p++) {
        const L = lists[p];
        if (L.length < 6) { for (const i of L) pane[i] = 0; panes.push(null); continue; }
        let x0 = 9, x1 = -9, y0 = 9, z0 = 9, z1 = -9;
        for (const i of L) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
        panes.push({ id: p, verts: Int32Array.from(L), x0, x1, y0, z0, z1 });
      }
      // 燈：類別是燈、燈罩、方向燈、尾燈、倒車燈的頂點
      const LC = new Set([LOD_CLS.lamp, LOD_CLS.lens, LOD_CLS.amber, LOD_CLS.red, LOD_CLS.rev]), lamp = new Uint8Array(n), cl = [[], [], [], [], []];
      for (let i = 0; i < n; i++) if (inMain[i] && LC.has(C[i])) { const x = P[i * 3]; if (Math.abs(x) < 1) continue; const k = (x > 0 ? 1 : 3) + (P[i * 3 + 2] < 0 ? 0 : 1); lamp[i] = k; cl[k].push(i); }
      const lampCl = [];
      for (let k = 1; k <= 4; k++) if (cl[k].length >= 4) lampCl.push({ id: k, ...cluster(cl[k], P), verts: Int32Array.from(cl[k]) });
      const fy = lampCl.filter((c) => c.id <= 2).map((c) => c.y0), ry = lampCl.filter((c) => c.id > 2).map((c) => c.y0);
      if (fy.length) Sh.lampF = Math.min(...fy) - 0.03;
      if (ry.length) Sh.lampR = Math.min(...ry) - 0.03;
      // 零件：後照鏡（探針的外框）、尾翼（車尾上面、比車身高的小塊）
      const mBoxes = [];
      if (spec.mirror) for (const s of [-1, 1]) { const b = probeBox(() => spec.mirror(DUMMY.mat || dummyMats().x, dummyMats(), s)); if (b) mBoxes.push({ s, b: b.expandByScalar(0.04) }); }
      const partsC = [];
      for (const [r, e] of comp) {
        if (main.has(r)) continue;
        const ctr = e.b.getCenter(new THREE.Vector3()), sz = e.b.getSize(new THREE.Vector3());
        const mb = mBoxes.find((m) => m.b.containsPoint(ctr) && sz.x < 0.5 && sz.y < 0.5 && sz.z < 0.5);
        const wing = !mb && ctr.x < Sh.xr + 0.3 && e.b.min.y > 0.7 && ctr.y > bil(Sh.Hm, MNX, MNZ, MX0, MZ0, ctr.x, ctr.z) + 0.02;
        if (mb) partsC.push({ root: r, kind: 'mirror', s: mb.s, box: e.b, ctr });
        else if (wing) partsC.push({ root: r, kind: 'wing', box: e.b, ctr });
      }
      // 尾翼的幾塊（翼片＋支架）算同一個
      const groups = [];
      for (const p of partsC) {
        if (p.kind === 'wing') { let g = groups.find((x) => x.kind === 'wing'); if (!g) groups.push((g = { kind: 'wing', roots: new Set(), box: new THREE.Box3() })); g.roots.add(p.root); g.box.union(p.box); }
        else groups.push({ kind: 'mirror', s: p.s, roots: new Set([p.root]), box: p.box.clone() });
      }
      const compOf = new Int32Array(n).fill(-1);
      groups.forEach((g, gi) => { for (let i = 0; i < n; i++) if (g.roots.has(find(i))) compOf[i] = gi; });
      for (const g of groups) { const b = g.box; g.mount = g.kind === 'mirror' ? [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, g.s < 0 ? b.max.z : b.min.z] : [(b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2]; }
      c = { Sh, panes, pane, lamp, lampCl, groups, compOf, inMain, xs };
      cache.set(op, c);
      return c;
    }
    let CL = null, D = null;
    // 第一次壞：複製一份網格（位置、法線、類別、兩組索引），共用的留著修好時換回去
    function own() {
      if (G) return;
      const op = src.opaque, gl = src.glass, pa = op.attributes.position, na = op.attributes.normal, ca = op.attributes.lodCls;
      const P = new Float32Array(pa.array), N = new Float32Array(na.array), C = new Uint8Array(ca.array);
      const A = { p: new THREE.BufferAttribute(P, 3), n: new THREE.BufferAttribute(N, 3), c: new THREE.BufferAttribute(C, 1) };
      const mk = (g0) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', A.p); g.setAttribute('normal', A.n); g.setAttribute('lodCls', A.c); g.setIndex(new THREE.BufferAttribute(g0.index.array.slice(), 1)); g.boundingSphere = g0.boundingSphere ? g0.boundingSphere.clone() : null; g.boundingBox = g0.boundingBox ? g0.boundingBox.clone() : null; return g; };
      G = { opaque: mk(op), glass: mk(gl), P, N, C, A };
      bodyMesh.geometry = G.opaque; glassMesh.geometry = G.glass;
      // 變形用：一整塊（不透明＋玻璃的三角形都算鄰接）
      const I1 = G.opaque.index.array, I2 = G.glass.index.array, I = new (I1.constructor === Uint16Array && I2.constructor === Uint16Array ? Uint16Array : Uint32Array)(I1.length + I2.length);
      I.set(I1); I.set(I2, I1.length);
      D = defObj();
      Object.assign(D, { meshes: [bodyMesh], mesh: bodyMesh, geo0: op, geo: G.opaque, n: P.length / 3, inPlace: true, masked: false, prim: true, keepVis: null, P, N, P0: pa.array, N0: na.array, B: pa.array, M: null, Li: null, idx: I,
        adjO: CL.adjO || null, adj: CL.adj || null, A0: CL.A0 || null, a0: !!CL.A0, mk: new Uint8Array(P.length / 3), mv: new Int32Array(P.length / 3), primed: true, r0: op.boundingSphere ? op.boundingSphere.radius : 3, maxD: 0, pane: CL.pane, lamp: CL.lamp, st: CL.st || null, bb: CL.bb || null, sc: 1 });
      if (!G.opaque.boundingSphere) G.opaque.computeBoundingSphere();
    }
    function release() { // 換回共用的網格
      if (!G) return;
      if (bodyMesh.geometry === G.opaque) bodyMesh.geometry = src.opaque;
      if (glassMesh.geometry === G.glass) glassMesh.geometry = src.glass;
      G.opaque.dispose(); G.glass.dispose(); G = null; D = null;
    }
    function sync() { // lod.setLook 換了網格：重新分類、重播
      const cur = bodyMesh.geometry;
      if (G && cur === G.opaque) return false;
      if (src && cur === src.opaque && !G) return false;
      if (G) { G.opaque.dispose(); G.glass.dispose(); G = null; D = null; }
      src = { opaque: bodyMesh.geometry, glass: glassMesh.geometry };
      CL = classify(src.opaque, src.glass);
      parts = CL.groups.map((g) => ({ ...g, gone: false, mt: { b: g.mount, c: g.mount.slice() } }));
      return true;
    }
    function lodFirst(H) {
      const P = G ? G.P : src.opaque.attributes.position.array, n = P.length / 3, M = CL.inMain;
      let best = Infinity;
      for (let i = 0; i < n; i++) {
        if (!M[i]) continue;
        const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
        if (y < 0.05 || y > H.h || (H.py >= 0 && Math.abs(y - H.py) > 0.5)) continue;
        const dx = x - H.px, dz = z - H.pz;
        if (!H.wall && Math.abs(dx * H.tx + dz * H.tz - H.uc) > H.r + 0.04) continue;
        const s = dx * H.nx + dz * H.nz; if (s < best) best = s;
      }
      return best === Infinity ? -0.04 : clamp(best, -0.6, 0.4);
    }
    // 拿掉三角形（變成退化的：三個索引一樣）
    function killTris(geo, pred) {
      const X = geo.index.array;
      let k = 0;
      for (let t = 0; t < X.length; t += 3) if (X[t] !== X[t + 1] && pred(t)) { X[t + 1] = X[t]; X[t + 2] = X[t]; k++; }
      if (k) geo.index.needsUpdate = true;
      return k;
    }
    const sc = { idx: null, dsp: null, out: new Float64Array(3), C: new Float64Array(13) }, stats = { pane: new Float64Array(5), lamp: new Float64Array(5) };
    function lodHit(a, idx, live) {
      prepHit(H, a, idx, CL.Sh);
      if (!(a[8] === a[8])) { a[8] = q3(lodFirst(H)); H.s0 = a[8]; }
      own();
      if (!sc.idx || sc.idx.length < D.n) { sc.idx = new Int32Array(D.n); sc.dsp = new Float32Array(D.n * 3); }
      stats.pane.fill(0); stats.lamp.fill(0);
      const k = scanDef(D, H, CL.Sh, sc);
      if (k) writeDef(D, k, sc, stats);
      const out = { dent: q3(H.D), glass: 0, lamps: 0, parts: 0, health: 0 };
      // 零件：後照鏡、尾翼 → 斷掉（拿掉三角形；有 scene 的話做一個掉下去）
      parts.forEach((p, gi) => {
        if (p.gone) { H.rn(); return; }
        fieldAt(H, CL.Sh, p.mt.c[0], p.mt.c[1], p.mt.c[2], p.mt.b[0], p.mt.b[1], p.mt.b[2], OUT) && (p.mt.c[0] += OUT[0], p.mt.c[1] += OUT[1], p.mt.c[2] += OUT[2]);
        const acc = Math.hypot(p.mt.c[0] - p.mt.b[0], p.mt.c[1] - p.mt.b[1], p.mt.c[2] - p.mt.b[2]), rr = H.rn();
        const near = p.kind === 'mirror' && Math.sign(H.pz) === p.s && Math.abs(H.px - p.mt.b[0]) < 0.7 && Math.abs(H.pz) > 0.5 * CL.Sh.hw;
        const brk = p.kind === 'mirror' ? acc > 0.03 || (near && H.v > 6.5) : acc > 0.05 || (H.nx > 0.55 && H.v > 12);
        if (!brk) return;
        p.gone = true; out.parts++;
        const sceneL = live ? opts.scene || sceneOf(lod.car) : null;
        if (sceneL) lodDebris(gi, sceneL, rr);
        const co = CL.compOf, Xo = G.opaque.index.array, Xg = G.glass.index.array;
        killTris(G.opaque, (t) => co[Xo[t]] === gi); killTris(G.glass, (t) => co[Xg[t]] === gi);
      });
      // 玻璃：破洞＝拿掉洞裡的玻璃三角形（鋸齒邊照角度抽亂數）
      const before = glassL.length, holes0 = glassL.map((g) => g.hole);
      out.glass = glassRules(H, CL.Sh, CL.panes.slice(1), stats, G.P, D.P0, glassL, H.rn);
      glassL.forEach((g, i) => {
        if (!(g.hole > 0) || (i < before && holes0[i] >= g.hole)) return;
        const P = D.P0, Xg = G.glass.index.array, pn = CL.pane, rj = rng(Math.floor(g.seed * 1000) + 1), jag = Array.from({ length: 11 }, () => 0.7 + 0.3 * rj());
        killTris(G.glass, (t) => {
          const v = Xg[t]; if (pn[v] !== g.pane) return false;
          let cx = 0, cy = 0, cz = 0; for (let c = 0; c < 3; c++) { const i3 = Xg[t + c] * 3; cx += P[i3]; cy += P[i3 + 1]; cz += P[i3 + 2]; }
          const dx = cx / 3 - g.c[0], dy = cy / 3 - g.c[1], dz = cz / 3 - g.c[2], q0 = g.pane <= 2 ? dx : dz, q1 = g.pane <= 2 ? dy : Math.sign(dx) * Math.hypot(dx, dy);
          const ang = Math.atan2(q1, q0), f = ((ang / TAU + 0.5) * 11) % 11, i0 = Math.floor(f), j = jag[i0] + (jag[(i0 + 1) % 11] - jag[i0]) * (f - i0);
          return Math.hypot(q0, q1) < g.hole * j;
        });
      });
      // 燈：變成黑的
      for (const c of CL.lampCl) {
        if (G.C[c.verts[0]] === LOD_CLS.black) continue;
        if (stats.lamp[c.id] > 0.008 || (Math.hypot(c.c[0] - H.px, c.c[2] - H.pz) < 0.45 && H.v > 4.5)) { for (const i of c.verts) G.C[i] = LOD_CLS.black; G.A.c.needsUpdate = true; out.lamps++; }
      }
      return out;
    }
    function lodDebris(gi, scene, rr) {
      const P = G.P, N = G.N, co = CL.compOf, pos = [], nor = [], cls = [];
      for (const X of [G.opaque.index.array, G.glass.index.array]) for (let t = 0; t < X.length; t += 3) {
        if (co[X[t]] !== gi || X[t] === X[t + 1]) continue;
        for (let c = 0; c < 3; c++) { const i = X[t + c]; pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); nor.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); cls.push(G.C[i]); }
      }
      if (!pos.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('lodCls', new THREE.BufferAttribute(Uint8Array.from(cls), 1));
      const m = new THREE.Mesh(g, bodyMesh.material);
      lod.body.add(m);
      lod.car.updateMatrixWorld(true);
      const ground = (lod.car.updateWorldMatrix(true, false), _p.setFromMatrixPosition(lod.car.matrixWorld).y);
      const q = new THREE.Quaternion(); lod.car.getWorldQuaternion(q);
      const b = makeDebris(m, scene, new THREE.Vector3(), new THREE.Vector3((rr - 0.5) * 2, 1.4, (rr - 0.5) * 3).applyQuaternion(q), ground, rng(debris.length * 11 + 3));
      m.removeFromParent();
      if (b) { b.own = g; debris.push(b); while (debris.length > 8) { const o = debris.shift(); o.obj.removeFromParent(); o.own.dispose(); } }
    }
    function lodFinish() {
      if (D && D.mvN) fixNormals(D);
      if (D) { CL.adjO = D.adjO; CL.adj = D.adj; CL.A0 = D.a0 ? D.A0 : null; CL.st = D.st; CL.bb = D.bb; } // 下一次 own() 直接用（同一個共用網格）
      if (G && G.glass.boundingSphere && G.opaque.boundingSphere) G.glass.boundingSphere.radius = Math.max(G.glass.boundingSphere.radius, G.opaque.boundingSphere.radius);
      let loss = wear;
      for (const a of hits) loss += lossOf(a, CL.Sh, mid);
      health = clamp(1 - loss, 0, 1);
    }
    function lodApply(st) {
      const t0 = now();
      sync();
      release();
      hits = []; wear = 0; glassL = [];
      for (const p of parts) { p.gone = false; p.mt.c = p.mt.b.slice(); }
      if (st && Array.isArray(st.h)) {
        for (const a0 of st.h) { if (hits.length >= MAX_HITS) break; if (!okRec(a0)) continue; const a = normRec(a0); lodHit(a, hits.length, false); hits.push(a); }
        wear = clamp(fin(+st.x, 0), 0, 1);
      }
      lodFinish();
      lastMs = now() - t0;
    }
    function lodHitLive(e) {
      if (!alive || !e || !(fin(+e.speed, 0) >= V_MIN)) return null;
      const t0 = now();
      if (sync() && hits.length) lodApply({ h: hits.map((a) => a.slice()), x: wear });
      const a = toRec(e);
      if (!a) return null;
      onCar(a, CL.Sh);
      let out;
      if (hits.length >= MAX_HITS) { wear = Math.min(1, wear + 0.5 * lossOf(a, CL.Sh, mid)); out = { dent: 0, glass: 0, lamps: 0, parts: 0, health: 0 }; }
      else { out = lodHit(a, hits.length, true); hits.push(a); }
      lodFinish();
      out.health = health;
      lastMs = now() - t0;
      return out;
    }
    sync();
    if (state) lodApply(Array.isArray(state) ? { h: state } : state);
    return {
      hit: lodHitLive,
      apply: (st) => { if (alive) lodApply(st); },
      repair: () => { if (!alive) return; lodApply(null); for (const b of debris) { b.obj.removeFromParent(); b.own.dispose(); } debris.length = 0; },
      update(dt) {
        if (!alive) return;
        if (sync() && hits.length) lodApply({ h: hits.map((a) => a.slice()), x: wear }); // setLook 換了網格
        if (debris.length) { FR[0] = clamp(fin(+dt, 0), 0, 0.1); stepDebris(debris, FR); }
      },
      get state() {
        if (!hits.length && !wear) return null;
        return { v: 1, h: hits.map((a) => a.map((x) => (x === x ? x : -1))), x: q3(wear), hp: q3(health), gl: glassCount(glassL), lp: CL ? CL.lampCl.filter((c) => G && G.C[c.verts[0]] === LOD_CLS.black).length : 0, pt: parts.filter((p) => p.gone).length };
      },
      get health() { return health; },
      get perf() { return perfOf(health, 0); },
      get lastMs() { return lastMs; },
      get debug() { return CL && { panes: CL.panes.map((p) => p && p.verts.length), lamps: CL.lampCl.map((c) => c.verts.length), parts: CL.groups.map((g) => g.kind), xs: CL.xs }; },
      dispose() {
        if (!alive) return;
        release();
        for (const b of debris) { b.obj.removeFromParent(); b.own.dispose(); }
        debris.length = 0; alive = false;
      },
    };
  }

  const DAMAGE = {
    V_MIN, MAX_HITS,
    cost,
    health: (state) => (state && Array.isArray(state.h) ? clamp(fin(+state.hp, 1), 0, 1) : 1),
    crush,
  };
  return { createDamage, damageLod, DAMAGE };
})();
