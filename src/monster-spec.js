// 3D 怪獸卡車的設定（照 Nick 2026-09-28 傳的粉紅色怪獸卡車照片做的）
// 車殼：monster-body.mjs（玻璃纖維車殼，2000 年代美國全尺寸皮卡的樣子）；網格存成「遮罩座標」，build 的時候放大、抬高回公尺
// 底下整台機械都是零件：66×43 吋輪胎（V 字胎紋／沙地槳胎／越野塊狀胎）、beadlock 深框、每個角四支氮氣避震器、管架車架、前後四連桿、
//   前後實心橋＋差速器、轉向節＋轉向拉桿、傳動軸、機械增壓 V8＋排氣頭段、變速箱、前後管保桿、車內（中間一張賽車椅、防滾籠）、黑色內襯、車尾旗子
// 懸吊、四輪轉向：MONSTER_SUSP(S, [左前, 右前, 左後, 右後], 前輪轉向, 後輪轉向)
//   S＝buildCar 回傳的車；每個輪子從靜止位置往上（＋，壓縮）／往下（−，伸長）幾公尺（車子座標，限制在 −0.40～＋0.35）
//   轉向是弧度（＋＝輪子前緣往車的右邊，跟 drive.js 一樣，限制 ±0.6）；後輪跟前輪反向＝小迴轉，同向＝螃蟹走
//   同一根橋兩個輪子高度不一樣時，輪子跟著橋一起斜（外傾）
//   避震器、連桿、橋、轉向拉桿、傳動軸每一幀照輪子（hub）和車身（body）現在的位置重算，所以 drive.js 只轉前輪、改車身高度、車身側傾也都會跟著動
// 手機版（第 4 批之後）：整台約 9 萬個三角形、11 個 draw call（原本 86 萬、49 個）
//   車殼：車漆、車內兩層用同一個簡化過的網格（body-monster*.glb 的 Body），玻璃那層只用玻璃附近的三角形（Nose_glass）；monster-mesh.mjs 做的
//   零件不再一個材質一個網格：顏色、粗糙度、金屬感放在一張「調色盤」小貼圖，頂點的 uv 指到自己那一格 →
//     車架＋防滾籠＋引擎＋排氣＋保桿＋內襯＋車內 合成一個靜止的網格；橋、轉向節、避震器、連桿、傳動軸、轉向拉桿合成一個 SkinnedMesh（每個零件一根骨頭，每幀算骨頭）；
//     四個輪胎（連 beadlock 螺絲、輪轂）左右各一個 InstancedMesh；beadlock 環（跟車身同色）、輪框筒（mats.chrome，車庫換輪框色）各一個 InstancedMesh
//   幾何是大家共用的（整個頁面同一份，組很多台也不會多）；parts.js 的輪胎、輪框、煞車第一幀就關掉、放掉
//   會跟著輪子動的（輪胎、橋、避震器⋯，monster-unsprung）第一幀搬到車子底下、不在 body 裡（跟 parts.js 的輪子一樣）：
//     drive.js、race.src.js 用 Box3 量 body（碰撞盒、地上的影子、起跑位置）量到的跟改之前一樣（車頭 2.816、車尾 −2.9、半寬 1.26：monster-size）
// 輕量車（carlod.js）：MONSTER_SPEC.lod 給 carlod.js 做低面數的有胎紋輪胎、懸吊（lod.wheels）和拉花貼圖（lod.livery）；車身檔 body-monster-lod.glb（monster-lod.mjs）
import * as THREE from 'three';
import { MONSTER_LOOK, MONSTER_M } from './monster-look.js';
import { withGenericLivery } from './masks.js';

export const MONSTER_P = (() => {
  const { S: MS, X0, Y0 } = MONSTER_M;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const UP = V(0, 1, 0);
  const KITS = ['chevron', 'paddle', 'block'];
  const WH = { xf: 1.90, xr: -1.90, R: 0.84, rim: 0.3175, track: 1.36, w: 1.09 }; // 輪子（MONSTER_SPEC.wheels 也用這組）

  // ---- 調色盤：零件的顏色、粗糙度、金屬感放在一張 16×1 的貼圖（map＝顏色、roughnessMap／metalnessMap＝G／B），頂點的 uv 指到自己那一格 ----
  const PAL = [ // [名字, 顏色, 粗糙度, 金屬感]（跟原本每個零件自己的材質一樣）
    ['tire', 0x25221f, 0.93, 0], // 輪胎（有點沾到土）
    ['bolt', 0x3b3e43, 0.4, 0.8], ['hub', 0x5b5f66, 0.35, 0.85], // beadlock 螺絲、行星齒輪輪轂
    ['chrome', 0xeef0f2, 0.06, 1], // 避震器、排氣頭段（鍍鉻）
    ['frame', 0x141518, 0.45, 0.35], // 車架（黑色粉體烤漆）
    ['cage', 0xe0561b, 0.45, 0.2], // 防滾籠、前面的管子（橘，照片裡車艙前面看得到）
    ['steel', 0x9ba1a9, 0.3, 0.8], // 連桿、管保桿、轉向拉桿（鉻鉬鋼）
    ['axle', 0x2b2d32, 0.5, 0.6], // 橋、差速器、傳動軸、球頭
    ['engine', 0x1c1d21, 0.55, 0.5], ['alu', 0xc6cad0, 0.25, 1],
    ['liner', 0x0b0b0d, 0.92, 0], // 黑色內襯（輪拱、前面開口）
    ['panel', 0x2e3136, 0.6, 0.3], ['seat', 0x151619, 0.8, 0],
  ];
  const PW = 16, PI = Object.fromEntries(PAL.map((p, i) => [p[0], i]));
  function palMaterial() {
    const c = new Uint8Array(PW * 4), rm = new Uint8Array(PW * 4);
    PAL.forEach(([, h, r, m], i) => { c.set([(h >> 16) & 255, (h >> 8) & 255, h & 255, 255], i * 4); rm.set([0, Math.round(r * 255), Math.round(m * 255), 255], i * 4); });
    const tex = (d, srgb) => {
      const t = new THREE.DataTexture(d, PW, 1, THREE.RGBAFormat);
      t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
      return t;
    };
    const t = tex(rm, false);
    return new THREE.MeshStandardMaterial({ map: tex(c, true), roughnessMap: t, metalnessMap: t, roughness: 1, metalness: 1 });
  }

  const CTX = new WeakMap(); // mats → 這台車自己的材質、懸吊（buildCar 每台車一組 mats）
  function ctxOf(mats) {
    let c = CTX.get(mats);
    if (c) return c;
    c = {
      mats, paint: null, body: null, kit: 'chevron',
      pal: palMaterial(),
      ring: new THREE.MeshPhysicalMaterial({ color: 0xc2186b, roughness: 0.3, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }), // beadlock 環：跟車身同色（每幀同步）
    };
    CTX.set(mats, c);
    return c;
  }

  // ---- 幾何小工具（輸出都是沒有 index 的三角形；零件用 tint 標上調色盤那一格、會動的再標骨頭）----
  function soup(g) { // 只留 position、normal
    const n = g.index ? g.toNonIndexed() : g;
    if (!n.attributes.normal) n.computeVertexNormals();
    const o = new THREE.BufferGeometry();
    o.setAttribute('position', n.attributes.position); o.setAttribute('normal', n.attributes.normal);
    return o;
  }
  function tint(g, key, bone) { // 調色盤那一格（uv）；bone：SkinnedMesh 的第幾根骨頭
    g = soup(g);
    const n = g.attributes.position.count, uv = new Float32Array(n * 2).fill(0.5), u = (PI[key] + 0.5) / PW;
    for (let i = 0; i < n; i++) uv[i * 2] = u;
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (bone !== undefined) {
      const si = new Uint8Array(n * 4), sw = new Uint8Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bone; sw[i * 4] = 255; }
      g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4, true));
    }
    return g;
  }
  function merge(list) { // 合成一個（屬性照第一個）
    const gs = list.map((g) => (g.index ? g.toNonIndexed() : g)), out = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(gs[0].attributes)) {
      const arr = new a.array.constructor(gs.reduce((s, g) => s + g.attributes[name].array.length, 0));
      let o = 0; for (const g of gs) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
      out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
    }
    return out;
  }
  function flipTris(g) { // 每個三角形第 2、3 個頂點對調（鏡射以後繞的方向反了）
    for (const a of Object.values(g.attributes)) {
      const A = a.array, k = a.itemSize;
      for (let t = 0; t < a.count; t += 3) for (let j = 0; j < k; j++) { const i1 = (t + 1) * k + j, i2 = (t + 2) * k + j, v = A[i1]; A[i1] = A[i2]; A[i2] = v; }
    }
    return g;
  }
  function mirrorX(g) { // x 反過來（左邊的輪胎：胎紋方向）
    const o = merge([g]), p = o.attributes.position.array, n = o.attributes.normal.array;
    for (let i = 0; i < p.length; i += 3) { p[i] = -p[i]; n[i] = -n[i]; }
    return flipTris(o);
  }
  const twoSided = (g) => merge([g, flipTris(merge([g]))].map((x, i) => { if (i) { const n = x.attributes.normal.array; for (let j = 0; j < n.length; j++) n[j] = -n[j]; } return x; })); // 兩面（內襯）
  let OPEN = false; // 輕量車的零件（lodParts）：圓管不要兩頭的蓋子（都接在別的管子、箱子上，看不到）
  const cyl = (r, seg = 10, r2 = r) => new THREE.CylinderGeometry(r2, r, 1, seg, 1, OPEN).translate(0, 0.5, 0); // 沿 +y、長 1
  const ball = (r, p) => new THREE.SphereGeometry(r, 8, 6).translate(p.x, p.y, p.z); // 球頭
  function between(g, a, b) { // 沿 y、長 1 的幾何放到 a→b
    const d = b.clone().sub(a), L = d.length();
    return g.clone().applyMatrix4(new THREE.Matrix4().compose(a, new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), V(1, L, 1)));
  }
  const tubes = (list, r, seg = 8) => { const u = cyl(r, seg); return merge(list.map(([a, b]) => soup(between(u, a, b)))); };
  const box = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.BoxGeometry(w, h, d).applyMatrix4(new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(1, 1, 1)));
  const L3 = (list) => list.map(([a, b]) => [V(...a), V(...b)]);
  const mz = (list) => [...list, ...list.map(([a, b]) => [V(a.x, a.y, -a.z), V(b.x, b.y, -b.z)])]; // 左右鏡射（線段）
  const path = (pts) => { const P = []; for (let i = 1; i < pts.length; i++) P.push([pts[i - 1], pts[i]]); return P; }; // 折線 → 線段
  const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([r, a]) => new THREE.Vector2(r, a)), seg).rotateX(Math.PI / 2); // 剖面 [r, a]，a 沿著輪軸 z
  function quad(pos, p0, p1, p2, p3, ref) { // 四邊形兩個三角形，法線朝 ref 那邊
    const n = p1.clone().sub(p0).cross(p2.clone().sub(p0));
    for (const p of n.dot(ref) >= 0 ? [p0, p1, p2, p0, p2, p3] : [p0, p2, p1, p0, p3, p2]) pos.push(p.x, p.y, p.z);
  }
  const center = (pts) => pts.reduce((a, p) => a.add(p), V()).multiplyScalar(1 / pts.length);
  const posGeo = (pos) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
  function hexBolts(list, r, h) { // 六角螺絲頭：六個側面＋上面（底下藏在環裡，不用做）；list：[x, y, z(底)]
    const pos = [];
    for (const [x, y, z] of list) {
      const P = (k, zz) => V(x + Math.cos((k * Math.PI) / 3) * r, y + Math.sin((k * Math.PI) / 3) * r, zz), c = V(x, y, z + h / 2);
      for (let k = 0; k < 6; k++) { const a0 = P(k, z), a1 = P(k + 1, z), b1 = P(k + 1, z + h), b0 = P(k, z + h); quad(pos, a0, a1, b1, b0, center([a0, a1, b1, b0]).sub(c)); }
      const t = [0, 1, 2, 3, 4, 5].map((k) => P(k, z + h));
      quad(pos, t[0], t[1], t[2], t[3], V(0, 0, 1)); quad(pos, t[0], t[3], t[4], t[5], V(0, 0, 1));
    }
    return posGeo(pos);
  }

  // ---- 輪胎：66×43 吋（半徑 0.84、寬 1.09、25 吋框）＝胎體（車床）＋胎紋塊 ----
  // 胎體剖面（r, a）：胎面中間 → 胎肩 → 胎壁鼓出來（最寬 ±0.543）→ 胎唇（壓在 beadlock 環底下）
  const CAR = [[0.785, 0], [0.785, 0.18], [0.783, 0.33], [0.776, 0.42], [0.763, 0.475], [0.74, 0.513], [0.70, 0.536], [0.645, 0.543],
    [0.58, 0.528], [0.50, 0.493], [0.44, 0.45], [0.39, 0.40], [0.372, 0.36], [0.37, 0.335]];
  const ARC = [0]; for (let i = 1; i < CAR.length; i++) ARC.push(ARC[i - 1] + Math.hypot(CAR[i][0] - CAR[i - 1][0], CAR[i][1] - CAR[i - 1][1]));
  const NRM = CAR.map((p, i) => { const a = CAR[Math.max(0, i - 1)], b = CAR[Math.min(CAR.length - 1, i + 1)], dr = b[0] - a[0], da = b[1] - a[1], l = Math.hypot(dr, da); return [da / l, -dr / l]; });
  function prof(s) { // 從胎面中間量的弧長 s → [r, a, 外法線 nr, na]
    s = Math.max(0, Math.min(ARC[ARC.length - 1], s)); let i = 1; while (i < ARC.length - 1 && ARC[i] < s) i++;
    const t = (s - ARC[i - 1]) / (ARC[i] - ARC[i - 1]), p = CAR[i - 1], q = CAR[i], m = NRM[i - 1], n = NRM[i];
    const nr = m[0] + (n[0] - m[0]) * t, na = m[1] + (n[1] - m[1]) * t, l = Math.hypot(nr, na);
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, nr / l, na / l];
  }
  // 一塊胎紋：沿著剖面從 s0 到 s1（sg＝1 外側那半、−1 內側那半），中心角 th(s)、半寬 hw(s)（公尺）、高 h(s)；n＝沿剖面分幾段
  function lug(pos, s0, s1, th, hw, h, sg, n) {
    const rows = [];
    for (let j = 0; j <= n; j++) {
      const s = s0 + ((s1 - s0) * j) / n, [r, a, nr, na] = prof(s), t = th(s), w = hw(s) / r, H = h(s), row = [];
      for (const e of [-1, 1]) {
        const c = Math.cos(t + e * w), sn = Math.sin(t + e * w);
        row.push(V(r * c, r * sn, a * sg), V((r + H * nr) * c, (r + H * nr) * sn, (a + H * na) * sg));
      }
      rows.push(row); // [一邊底, 一邊頂, 另一邊底, 另一邊頂]
    }
    for (let j = 0; j < n; j++) {
      const A = rows[j], B = rows[j + 1], m = center([...A, ...B]), f = (p0, p1, p2, p3) => quad(pos, p0, p1, p2, p3, center([p0, p1, p2, p3]).sub(m));
      f(A[1], B[1], B[3], A[3]); f(A[0], B[0], B[1], A[1]); f(A[2], B[2], B[3], A[3]);
    }
    for (const [R0, R1] of [[rows[0], rows[1]], [rows[n], rows[n - 1]]]) quad(pos, R0[0], R0[1], R0[3], R0[2], center(R0).sub(center([...R0, ...R1])));
  }
  // 胎紋（q＝細緻度：1＝完整的車；輕量車用小的）：每塊 [s0, s1, 角度(s), 半寬(s), 高(s), 內外, 段數]
  function lugs(kind, q = 1) {
    const L = [], seg = (n) => Math.max(1, Math.round(n * q));
    if (kind === 'paddle') { // 沙地槳胎：14 片橫的高槳片，整個胎面寬
      for (let k = 0; k < 14; k++) { const t0 = (k * 2 * Math.PI) / 14; for (const sg of [1, -1]) L.push([0, 0.60, () => t0, () => 0.03, (s) => 0.09 - 0.12 * Math.max(0, s - 0.40), sg, seg(6)]); }
    } else if (kind === 'block') { // 越野塊狀胎：每邊兩排小方塊＋胎肩一排，交錯
      const N = 26;
      for (let k = 0; k < N; k++) for (const sg of [1, -1]) {
        const t0 = (k * 2 * Math.PI) / N + (sg < 0 ? Math.PI / N : 0);
        L.push([0.015, 0.19, (s) => t0 + 0.25 * s, () => 0.062, () => 0.045, sg, seg(2)], [0.23, 0.40, (s) => t0 + Math.PI / N + 0.25 * s, () => 0.056, () => 0.045, sg, seg(2)],
          [0.44, 0.61, () => t0 + 0.1, () => 0.05, (s) => 0.04 - 0.05 * (s - 0.44), sg, seg(3)]);
      }
    } else { // V 字胎紋（照片那種曳引機胎）：每邊 20 條斜的胎紋塊，兩邊錯開半格，從中間斜斜往後包過胎肩
      const N = 20;
      for (let k = 0; k < N; k++) for (const sg of [1, -1]) {
        const t0 = (k * 2 * Math.PI) / N + (sg < 0 ? Math.PI / N : 0);
        L.push([0, 0.62, (s) => t0 + 0.85 * s - 0.25 * Math.max(0, s - 0.40), (s) => 0.058 - 0.015 * s, (s) => (s < 0.45 ? 0.055 : 0.055 - 0.08 * (s - 0.45)), sg, seg(8)]);
      }
    }
    return L;
  }
  const FULL = [...CAR.slice().reverse().map(([r, a]) => [r, -a]), ...CAR.slice(1)]; // 胎體剖面：內側胎唇 → 胎面 → 外側胎唇

  // ---- 輪框：beadlock 深框（輪子座標，外側朝 +z）----
  // 外面一圈車身色的 beadlock 環（24 顆螺絲），裡面很深的輪框筒（mats.chrome，車庫換輪框色會跟著變），深處是輪框中心盤＋行星齒輪輪轂
  const G = { tire: {} }; // 共用的幾何（整個頁面一份）
  const ringGeo = () => (G.ring ||= soup(merge([soup(lathe([[0.392, 0.30], [0.392, 0.352]])), soup(lathe([[0.392, 0.352], [0.305, 0.352]])), soup(lathe([[0.305, 0.352], [0.305, 0.30]]))])));
  const barrelGeo = () => (G.barrel ||= merge([soup(lathe([[0.300, 0.30], [0.300, -0.33]], 64)), soup(lathe([[0.300, -0.33], [0.34, -0.33]], 40)), // 筒內、內側唇
    soup(lathe([[0.300, -0.02], [0.25, -0.02], [0.25, 0.0], [0.215, 0.0], [0.215, -0.02], [0.14, -0.02]], 64)), soup(lathe([[0.14, -0.06], [0.300, -0.06]], 40))])); // 中心盤（外面一圈凸起）
  function wheelGeo(kind, hand) { // 輪胎＋beadlock 螺絲＋輪轂（調色盤）；hand：1 右輪、−1 左輪（胎紋鏡射）
    const k = kind + hand;
    if (G.tire[k]) return G.tire[k];
    const pos = [];
    for (const l of lugs(kind)) lug(pos, ...l);
    const around = (n, r, z, a0 = 0) => Array.from({ length: n }, (_, j) => [Math.cos(a0 + (j * 2 * Math.PI) / n) * r, Math.sin(a0 + (j * 2 * Math.PI) / n) * r, z]);
    const g = merge([tint(lathe(FULL, 72), 'tire'), tint(posGeo(pos), 'tire'),
      tint(hexBolts(around(24, 0.349, 0.351), 0.012, 0.022), 'bolt'), tint(hexBolts(around(10, 0.18, -0.02), 0.019, 0.04), 'bolt'), tint(hexBolts(around(8, 0.085, 0.121, 0.2), 0.012, 0.022), 'bolt'),
      tint(lathe([[0.135, -0.06], [0.135, 0.10]], 32), 'hub'), tint(lathe([[0.135, 0.10], [0.11, 0.125], [0.0, 0.125]], 32), 'hub')]);
    return (G.tire[k] = hand < 0 ? mirrorX(g) : g);
  }
  // 車自己的輪框樣式（parts.js 會放進每個輪子）：完整的車的輪框都在 rig 裡面畫（實例化），這裡給空的
  function rimFace() { const g = new THREE.Group(); g.name = 'monster-rim'; return g; }
  rimFace.capInset = 0.6; // parts.js 的中心蓋、螺帽藏進輪轂裡（第一幀也會關掉）

  // ---- 懸吊（右邊的點；左邊 z 變號）----
  // 避震器：上面固定在車架（車身座標 x, y），下面在橋上（橋座標：dx 往前、dy 往上）；照片裡前面四支在前軸前面、後面四支往前斜
  const SH = {
    f: { top: [[1.86, 2.30], [2.00, 2.28], [2.14, 2.25], [2.28, 2.21]], bot: [-0.10, 0.0, 0.10, 0.20] },
    r: { top: [[-1.36, 2.20], [-1.50, 2.23], [-1.64, 2.26], [-1.78, 2.28]], bot: [0.20, 0.10, 0.0, -0.10] },
    dy: 0.13, z: 0.72, len: 0.62, rod: 1.05, // 筒身長、活塞桿長
  };
  // 四連桿（每根橋每邊下、上兩根）：車架那頭（車身座標）、橋那頭（dx, dy, z）；後面的 x 反過來
  const LINKS = [[[0.45, 1.05, 0.46], [-0.10, -0.15, 0.56]], [[0.85, 1.42, 0.26], [0.02, 0.20, 0.30]]];
  // 傳動軸：分動箱那頭（車身座標）→ 差速器（橋座標 dx，z＝−0.15，差速器偏左一點）
  const SHAFTS = [[[0.45, 1.00, -0.15], -0.32], [[0.19, 0.98, -0.15], 0.32]];
  const ARM = 0.28, ARMZ = -0.30; // 轉向臂：轉向節往後（後橋往前）0.28、往內 0.30
  // 每根會動的桿子、它兩頭的點（車身座標那頭的球頭是靜止的，放在車架網格；橋那頭的放在橋的骨頭上）
  const SHOCKS = []; // { a（第幾根橋）, s, top: [x, y, z]（車身）, bot: [dx, dy, dz]（橋） }
  ['f', 'r'].forEach((key, a) => { for (const s of [-1, 1]) for (let j = 0; j < 4; j++) SHOCKS.push({ a, top: [...SH[key].top[j], s * SH.z], bot: [SH[key].bot[j], SH.dy, s * SH.z] }); });
  const LINK_P = []; // { a, p0（車身）, p1（橋） }
  [1, -1].forEach((fx, a) => { for (const s of [-1, 1]) for (const [cp, ap] of LINKS) LINK_P.push({ a, p0: [cp[0] * fx, cp[1], cp[2] * s], p1: [ap[0] * fx, ap[1], ap[2] * s] }); });
  const armEnd = (i) => { const fx = i < 2 ? 1 : -1, hand = i % 2 === 0 ? -1 : 1; return [-ARM * fx * hand, -0.02, ARMZ]; }; // 轉向臂尾端（輪子座標；左邊的 hub 轉了 180°，本地 x 反過來）
  // 骨頭編號
  const B_AXLE = 0, B_KNUCKLE = 2, B_SHOCK = 6, B_ROD = 22, B_LINK = 38, B_SHAFT = 46, B_TIE = 48, NB = 50;

  // ---- 車架、引擎、管保桿、內襯、車內（車身座標，靜止的）→ 一個調色盤網格 ----
  function staticParts(q = 1) { // [[調色盤名字, 幾何], ...]；q＜1：輕量車用的（段數少）
    const out = [], put = (key, g) => out.push([key, g]), sg = (n) => Math.max(4, Math.round(n * q));
    const z = 0.44;
    const rails = mz(L3([
      ...path([[2.50, 1.52, z], [1.55, 1.52, z], [0.55, 1.52, z], [-0.25, 1.52, z], [-1.45, 1.52, z], [-2.40, 1.52, z]]), // 上縱樑
      ...path([[1.55, 1.52, z], [1.25, 1.14, z], [0.55, 1.14, z], [-0.25, 1.14, z], [-1.15, 1.14, z], [-1.45, 1.52, z]]), // 下縱樑（兩頭往上翹，讓橋跳上來）
      [[0.55, 1.14, z], [0.55, 1.52, z]], [[-0.25, 1.14, z], [-0.25, 1.52, z]], [[1.25, 1.14, z], [0.55, 1.52, z]], [[-0.25, 1.14, z], [-1.15, 1.52, z]],
      // 前避震器塔：上面一根橫樑（在引擎蓋裡），往下撐到車架
      [[1.80, 2.31, 0.72], [2.36, 2.24, 0.72]], [[1.80, 2.31, 0.72], [1.55, 1.52, z]], [[2.36, 2.24, 0.72], [2.50, 1.52, z]], [[2.08, 2.28, 0.72], [2.05, 1.52, z]],
      // 後避震器塔
      [[-1.30, 2.24, 0.72], [-1.86, 2.33, 0.72]], [[-1.30, 2.24, 0.72], [-1.45, 1.52, z]], [[-1.86, 2.33, 0.72], [-2.40, 1.52, z]], [[-1.58, 2.28, 0.72], [-1.95, 1.52, z]],
    ]));
    const cross = L3([[2.50, 1.52], [1.55, 1.52], [0.55, 1.14], [-0.25, 1.14], [-1.45, 1.52], [-2.40, 1.52], [2.08, 2.29], [-1.58, 2.29]].map(([x, y], i) => [[x, y, i > 5 ? -0.72 : -z], [x, y, i > 5 ? 0.72 : z]]));
    put('frame', tubes([...rails, ...cross], 0.038, sg(8)));
    // 防滾籠（橘）：座椅後面的主環、A 柱、車頂兩根，車艙前面往前伸到避震器塔（照片裡從前面開口看得到）
    const hoop = (x, y0, y1, w, wt) => new THREE.CatmullRomCurve3([V(x, y0, w), V(x, y1 - 0.12, w), V(x, y1, wt), V(x, y1 + 0.02, 0), V(x, y1, -wt), V(x, y1 - 0.12, -w), V(x, y0, -w)]);
    const cageL = mz(L3([[[0.93, 2.36, 0.74], [0.50, 2.80, 0.62]], [[0.50, 2.80, 0.62], [-0.35, 2.80, 0.62]], [[-0.35, 1.62, 0.72], [0.93, 1.62, 0.74]],
      [[0.98, 2.05, 0.74], [1.84, 2.04, 0.74]], [[0.98, 1.62, 0.74], [1.80, 2.04, 0.74]], [[0.98, 1.62, 0.74], [1.55, 1.52, z]], [[0.98, 1.62, 0.74], [0.98, 2.05, 0.74]]]));
    put('cage', merge([soup(new THREE.TubeGeometry(hoop(-0.35, 1.55, 2.80, 0.72, 0.55), sg(32), 0.03, sg(8))), soup(new THREE.TubeGeometry(hoop(0.93, 1.55, 2.36, 0.74, 0.60), sg(32), 0.03, sg(8))), tubes(cageL, 0.03, sg(8))]));
    // 前後管保桿（照片裡是黑的管子，在車殼保桿底下）
    const bump = (x0, x1, sgn) => [...L3([[[x0, 1.78, 0.60], [x0, 1.78, -0.60]], [[x1, 1.56, 0.60], [x1, 1.56, -0.60]]]),
      ...mz(L3([[[x0, 1.78, 0.60], [x1, 1.56, 0.60]], [[x0, 1.78, 0.20], [x1, 1.56, 0.20]], [[x0, 1.78, 0.60], [x0 - sgn * 0.42, 1.87, 0.55]], [[x1, 1.56, 0.60], [x1 - sgn * 0.30, 1.52, z]]]))];
    put('frame', tubes([...bump(2.74, 2.78, 1), ...bump(-2.62, -2.66, -1)], 0.036, sg(8)));
    // 引擎：機械增壓大排氣量 V8（甲醇），在車艙後面、貨斗底下；增壓器和進氣帽藏在貨斗蓋裡面（引擎前面、皮帶那頭朝車尾，變速箱在前面）
    put('engine', merge([box(0.74, 0.44, 0.50, -0.95, 1.30, 0), box(0.62, 0.14, 0.36, -0.95, 1.03, 0), box(0.72, 0.14, 0.26, -0.95, 1.58, 0.25, 0.7), box(0.72, 0.14, 0.26, -0.95, 1.58, -0.25, -0.7),
      box(0.10, 0.40, 0.40, -1.37, 1.30, 0), box(0.10, 0.16, 0.30, -0.95, 2.02, 0)].map(soup)));
    put('alu', merge([box(0.74, 0.06, 0.16, -0.95, 1.68, 0.33, 0.7), box(0.74, 0.06, 0.16, -0.95, 1.68, -0.33, -0.7), box(0.56, 0.22, 0.32, -0.95, 1.84, 0),
      between(cyl(0.19, sg(24), 0.13), V(-0.57, 1.28, 0), V(-0.25, 1.28, 0)), between(cyl(0.13, sg(20)), V(-0.25, 1.28, 0), V(0.22, 1.28, 0)), // 鐘形罩、變速箱
      box(0.24, 0.46, 0.34, 0.32, 1.10, -0.08)].map(soup))); // 分動箱
    // 排氣頭段（鍍鉻）：每邊四根，從汽缸頭往外、往下彎，到後輪前面併成一根往後
    const hdr = [];
    for (const s of [1, -1]) {
      [-1.22, -1.04, -0.86, -0.68].forEach((x, i) => {
        const cv = new THREE.CatmullRomCurve3([V(x, 1.50, 0.36 * s), V(x + 0.03, 1.47, 0.58 * s), V(x + 0.02, 1.30, 0.70 * s), V(x - 0.06 - 0.02 * i, 1.10, 0.70 * s), V(-1.12 - 0.01 * i, 0.99, 0.69 * s)]);
        hdr.push(soup(new THREE.TubeGeometry(cv, sg(22), 0.033, sg(8))));
      });
      hdr.push(soup(between(cyl(0.075, sg(16), 0.09), V(-1.10, 0.99, 0.70 * s), V(-1.56, 0.90, 0.72 * s))));
    }
    put('chrome', merge(hdr));
    // 油箱（兩根後輪中間）、車艙底下兩片側板（照片裡車身下面那片深灰色的）
    put('panel', merge([box(0.46, 0.32, 0.60, -1.75, 1.40, 0), box(1.20, 0.44, 0.012, 0.30, 1.30, 0.64), box(1.20, 0.44, 0.012, 0.30, 1.30, -0.64)].map(soup)));
    // 黑色內襯（兩面）：前面開口（車艙前面那片、葉子板底下、保桿後面）、後輪拱（從車殼表面往開口裡退 1 公分，node monster3d/liner.mjs 量的）
    const F0 = [[1.179, 1.609], [1.216, 1.734], [1.249, 1.843], [1.278, 1.948], [1.306, 2.061], [1.322, 2.123], [1.351, 2.182], [1.494, 2.184], [1.607, 2.181], [1.705, 2.17],
      [1.794, 2.158], [1.881, 2.145], [1.975, 2.131], [2.091, 2.118], [2.157, 2.105], [2.22, 2.079], [2.263, 2.033], [2.296, 1.979], [2.325, 1.922]];
    const F9 = [[1.193, 1.612], [1.228, 1.735], [1.258, 1.842], [1.287, 1.944], [1.316, 2.054], [1.331, 2.116], [1.387, 2.142], [1.518, 2.143], [1.622, 2.137], [1.71, 2.128],
      [1.789, 2.116], [1.867, 2.103], [1.95, 2.089], [2.053, 2.077], [2.115, 2.068], [2.179, 2.051], [2.237, 2.019], [2.274, 1.97], [2.304, 1.916]];
    const ARCH = [[-0.654, 1.49], [-0.754, 1.621], [-0.844, 1.744], [-0.95, 1.85], [-1.067, 1.94], [-1.193, 2.015], [-1.327, 2.081], [-1.472, 2.143], [-1.633, 2.202],
      [-1.82, 2.258], [-1.923, 2.274], [-2.024, 2.267], [-2.116, 2.23], [-2.176, 2.145], [-2.207, 2.033], [-2.22, 1.92], [-2.228, 1.725]];
    const sheet = (rows) => { // rows：每一排同樣多的點（沿著路徑），排和排之間接成面
      const pos = [];
      for (let r = 1; r < rows.length; r++) for (let i = 1; i < rows[r].length; i++) { const a = rows[r - 1][i - 1], b = rows[r - 1][i], d = rows[r][i - 1], e = rows[r][i]; pos.push(...a, ...b, ...e, ...a, ...e, ...d); }
      return posGeo(pos);
    };
    const front = [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9].map((zz) => { const k = (zz / 0.9) ** 2; return F0.map(([x, y], i) => [x + (F9[i][0] - x) * k, y + (F9[i][1] - y) * k, zz]); });
    const arch = (s) => [0.575, 0.96].map((zz) => ARCH.map(([x, y]) => [x, y, zz * s]));
    put('liner', twoSided(merge([sheet(front), sheet(arch(1)), sheet(arch(-1))])));
    return out;
  }
  // 車內：中間一張賽車椅（怪獸卡車駕駛坐正中間）、方向盤、儀表板、地板、防火牆（從車窗看得到）
  function cockpit() {
    return [['seat', merge([box(0.46, 0.08, 0.46, 0.18, 2.02, 0), box(0.08, 0.70, 0.48, -0.08, 2.38, 0, 0, 0, -0.2), box(0.12, 0.18, 0.08, -0.13, 2.62, 0.2, 0, 0, -0.2), box(0.12, 0.18, 0.08, -0.13, 2.62, -0.2, 0, 0, -0.2),
      box(0.20, 0.14, 1.70, 0.92, 2.42, 0, 0, 0, 0.35), box(1.60, 0.04, 1.80, 0.20, 1.64, 0), box(0.04, 1.2, 1.80, -0.55, 2.20, 0)].map(soup))],
    ['axle', merge([soup(new THREE.TorusGeometry(0.16, 0.018, 6, 24).rotateY(Math.PI / 2).rotateZ(0.5).translate(0.55, 2.50, 0)), soup(between(cyl(0.02, 6), V(0.56, 2.50, 0), V(0.85, 2.36, 0)))])]];
  }
  // 車身那頭的球頭（避震器上端、連桿、傳動軸）：跟車架一起不動
  function bodyJoints() {
    const g = [];
    for (const k of SHOCKS) g.push(ball(0.05, V(...k.top)));
    for (const k of LINK_P) g.push(ball(0.058, V(...k.p0)));
    for (const [cp] of SHAFTS) g.push(ball(0.07, V(...cp)));
    return [['axle', merge(g.map(soup))]];
  }
  const staticGeo = () => (G.static ||= merge([...staticParts(), ...cockpit(), ...bodyJoints()].map(([k, g]) => tint(g, k))));

  // ---- 會動的零件（SkinnedMesh）：每個零件在自己骨頭的座標裡 ----
  function axleParts(fx) { // 橋座標（x 往前、z 沿著橋）：軸管、兩頭轉向節的球、差速器、避震器座、連桿座；fx＝1 前橋、−1 後橋
    const parts = [between(cyl(0.095, 12), V(0, 0, -0.96), V(0, 0, 0.96)), new THREE.SphereGeometry(0.17, 12, 8).translate(0, 0, 0.96), new THREE.SphereGeometry(0.17, 12, 8).translate(0, 0, -0.96),
      new THREE.SphereGeometry(0.25, 14, 10).scale(1, 0.95, 0.85).translate(-0.06 * fx, 0, -0.15), between(cyl(0.19, 16), V(0.10 * fx, 0, -0.15), V(0.16 * fx, 0, -0.15)),
      between(cyl(0.08, 10), V(-0.20 * fx, 0, -0.15), V(-0.30 * fx, 0, -0.15))];
    for (const s of [1, -1]) parts.push(box(0.42, 0.05, 0.10, 0.05, SH.dy - 0.02, SH.z * s), box(0.08, 0.26, 0.10, 0.05, 0.02, SH.z * s), box(0.12, 0.20, 0.06, -0.10 * fx, -0.10, 0.56 * s), box(0.10, 0.12, 0.06, 0.02 * fx, 0.14, 0.30 * s));
    const a = fx > 0 ? 0 : 1, jo = []; // 橋那頭的球頭：避震器下端、連桿、傳動軸
    for (const k of SHOCKS) if (k.a === a) jo.push(ball(0.05, V(...k.bot)));
    for (const k of LINK_P) if (k.a === a) jo.push(ball(0.058, V(...k.p1)));
    jo.push(ball(0.07, V(SHAFTS[a][1], 0, -0.15)));
    return merge([...parts, ...jo].map(soup));
  }
  function knuckleParts(i) { // 轉向節（輪子座標，+z＝外面）：從橋頭的球到輪框中心＋轉向臂（前橋往後、後橋往前）＋轉向拉桿的球頭
    const e = armEnd(i);
    return merge([between(cyl(0.15, 14), V(0, 0, -0.40), V(0, 0, -0.10)), between(cyl(0.035, 8), V(0, -0.02, ARMZ), V(e[0], -0.02, ARMZ)), ball(0.05, V(...e))].map(soup));
  }
  function unsprungGeo() {
    if (G.uns) return G.uns;
    const L = [];
    [1, -1].forEach((fx, a) => L.push(tint(axleParts(fx), 'axle', B_AXLE + a)));
    for (let i = 0; i < 4; i++) L.push(tint(knuckleParts(i), 'axle', B_KNUCKLE + i));
    for (let n = 0; n < 16; n++) { // 避震器：筒身（鍍鉻）從上端往下、底下一圈（鋁）；活塞桿從下端往上
      L.push(tint(cyl(0.058, 14).scale(1, SH.len, 1), 'chrome', B_SHOCK + n), tint(cyl(0.07, 14).scale(1, 0.06, 1).translate(0, SH.len - 0.02, 0), 'alu', B_SHOCK + n));
      L.push(tint(cyl(0.024, 8).scale(1, SH.rod, 1), 'chrome', B_ROD + n));
    }
    for (let n = 0; n < 8; n++) L.push(tint(cyl(0.038, 10), 'steel', B_LINK + n)); // 長 1，骨頭拉長
    for (let a = 0; a < 2; a++) L.push(tint(cyl(0.045, 10), 'axle', B_SHAFT + a), tint(cyl(0.032, 8), 'steel', B_TIE + a));
    return (G.uns = merge(L));
  }

  // ---- 車尾的旗子：一根旗桿（右後角車頂上）＋一片往後飄的黑旗板（自己畫的白星＋條紋）；一個網格（旗桿的 uv 指到貼圖底下那條灰的）----
  const FLAG_Z = 0.72, FA = [-2.04, 2.97], FB = [-2.09, 3.44], FC = [-2.90, 3.50], FD = [-2.88, 3.13]; // 旗板四個角（照片量的）：前緣 2.97～3.44、後緣 3.13～3.50
  function flagGeo() {
    if (G.flag) return G.flag;
    const nu = 10, nv = 3, pos = [], uv = [], idx = [], V0 = 12 / 268; // 貼圖 512×268：上面 256 是旗子，底下 12 是旗桿的灰
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv, lo = [FA[0] + (FD[0] - FA[0]) * u, FA[1] + (FD[1] - FA[1]) * u], hi = [FB[0] + (FC[0] - FB[0]) * u, FB[1] + (FC[1] - FB[1]) * u];
      pos.push(lo[0] + (hi[0] - lo[0]) * v, lo[1] + (hi[1] - lo[1]) * v, FLAG_Z + 0.05 * Math.sin(Math.PI * u) * (1 - 0.3 * v)); uv.push(u, V0 + (1 - V0) * v);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, d = a + nu + 1, e = d + 1; idx.push(a, b, e, a, e, d); }
    const cloth = new THREE.BufferGeometry(); cloth.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cloth.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); cloth.setIndex(idx); cloth.computeVertexNormals(); // 平順的法線（再拆成三角形）
    const pole = soup(between(cyl(0.02, 10), V(-1.99, 2.88, FLAG_Z), V(-2.09, 3.54, FLAG_Z)));
    pole.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pole.attributes.position.count * 2).fill(V0 / 2).map((v, i) => (i % 2 ? v : 0.5)), 2));
    return (G.flag = merge([soup2(cloth), pole]));
  }
  function soup2(g) { const n = g.index ? g.toNonIndexed() : g, o = soup(n); o.setAttribute('uv', n.attributes.uv); return o; } // 留 uv
  function flag(mats) {
    const g = new THREE.Group();
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 268; const x = cv.getContext('2d');
    x.fillStyle = '#9fa4ab'; x.fillRect(0, 256, 512, 12); // 旗桿
    x.fillStyle = '#101114'; x.fillRect(0, 0, 512, 256);
    x.fillStyle = '#f4f5f7'; for (const [y, w] of [[150, 300], [182, 250], [214, 200]]) { x.beginPath(); x.moveTo(512 - w - 40, y); x.lineTo(512 - 24, y); x.lineTo(512 - 40, y + 20); x.lineTo(512 - w - 24, y + 20); x.closePath(); x.fill(); }
    x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 34 : 86; x.lineTo(110 + Math.cos(a) * r, 104 + Math.sin(a) * r); } x.closePath(); x.fill();
    x.strokeStyle = '#2f63e8'; x.lineWidth = 8; x.stroke();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = new THREE.Mesh(flagGeo(), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide })); m.name = 'monster-flag';
    g.add(m);
    return g;
  }

  // ---- 每一幀：輪子（實例）、橋、轉向節、避震器、連桿、傳動軸、轉向拉桿（骨頭）----
  const _q = new THREE.Quaternion(), _d = V(), _b = new THREE.Matrix4(), _w = new THREE.Matrix4(), _s = V(), _p = V();
  function strut(m, a, b, len) { // 沿 y 的零件從 a 往 b 放，長 len（沒給＝拉長到 b）
    _d.subVectors(b, a); const L = _d.length() || 1e-6;
    m.compose(a, _q.setFromUnitVectors(UP, _d.multiplyScalar(1 / L)), _s.set(1, len ?? L, 1));
  }
  const EMPTY = new THREE.BufferGeometry();
  // 橋、避震器那個 SkinnedMesh 的盒子（車子座標；只給 Box3.setFromObject 用，畫面裁切看下面的球）：靜止時的範圍，在輪胎、車殼量到的範圍裡面（量整台車不會變大）
  const UNS_BOX = new THREE.Box3(V(WH.xr - 0.5, 0.2, -1.6), V(WH.xf + 0.5, 2.7, 1.6)); // 量過：靜止 x −2.09～2.34、y 0.43～2.30、z ±1.27；車身升高 0.3＋懸吊、轉向到底 y 到 2.60、z ±1.37
  // 會動的那些（輪胎、beadlock 環、輪框筒、橋）畫面裁切用的球（車子座標）：懸吊、轉向到底、車身升高都包得住（輪胎最遠 x ±3.05、y −0.65～2.9、z ±2.55）；
  //   不在畫面裡就不畫（跟一般的網格一樣；改之前的實例化零件是一直畫）
  const UNS_SPHERE = new THREE.Sphere(V(0, 1.1, 0), 4.4);
  function init(c, car) { // 第一幀：找四個輪子，關掉、放掉 parts.js 的輪胎／輪框筒／煞車／中心蓋（輪子都在 rig 裡畫）
    const hubs = car.children.filter((o) => o.children[0] && o.children[0].getObjectByName && o.children[0].getObjectByName('rimface'));
    if (hubs.length !== 4) return false;
    c.hubs = hubs;
    for (const hub of hubs) {
      const [wh, brake] = hub.children;
      for (const o of [...wh.children, brake]) if (o) o.traverse((k) => { k.visible = k === o ? false : k.visible; if (k.geometry && k.geometry !== EMPTY) { k.geometry.dispose(); k.geometry = EMPTY; } });
    }
    // 會跟著輪子動的（輪胎、橋、避震器⋯）搬到車子底下（跟 parts.js 的輪子一樣不在 body 裡）：drive.js、race.src.js 用 Box3 量 body（碰撞盒、地上的影子、起跑位置），
    //   量到的要跟改之前一樣（見 rig 的 monster-size）；整台車（S.car）量得到輪胎（車庫鏡頭、展示台碰撞）
    car.add(c.uns); c.uns.matrix.identity(); c.uns.updateMatrixWorld(true); // 這一幀 car 的子物件已經在跑了（新加的輪不到），自己更新一次
    for (const o of [c.tireL, c.tireR, c.rings, c.barrels]) o.boundingBox = null; // 輪子的盒子：有人量的時候照現在的位置算（update 每幀清掉）
    c.sk.boundingBox.copy(UNS_BOX);
    return true;
  }
  function update(c) {
    const body = c.body, car = body && body.parent;
    if (!car || (!c.hubs && !init(c, car))) return;
    c.uns.visible = true;
    const p = c.paint; c.ring.color.copy(p.color); c.ring.roughness = p.roughness; c.ring.metalness = p.metalness;
    // 底盤燈（supra.js setGlow 第一次開才做，大小照遮罩座標的車身算＝太小）：改成蓋住四個輪子中間（半長 2.4、半寬 1.5）
    const glow = car.getObjectByName('glow');
    if (glow && !glow.userData.monster && glow.material.uniforms) {
      glow.userData.monster = true; glow.geometry.dispose(); glow.geometry = new THREE.PlaneGeometry(2 * (2.4 + 0.75), 2 * (1.5 + 0.75));
      glow.material.uniforms.uBox.value.set(2.4 - 0.1, 1.5 - 0.08, 0.45, 0.75); glow.position.x = 0.1;
    }
    body.updateMatrix(); const Bm = body.matrix; // monster-unsprung 在車子底下（init 搬的）＝車子座標；車身那頭的點用 body 的矩陣換過去
    const Bp = (a) => _p.set(a[0], a[1], a[2]).applyMatrix4(Bm).clone();
    // 輪子：hub（轉向、外傾、上下）× 輪子（滾動）
    c.hubs.forEach((h, i) => {
      h.updateMatrix(); const wh = h.children[0]; wh.updateMatrix();
      _w.multiplyMatrices(h.matrix, wh.matrix);
      (i % 2 ? c.tireR : c.tireL).setMatrixAt(i >> 1, _w); c.rings.setMatrixAt(i, _w); c.barrels.setMatrixAt(i, _w);
      c.bones[B_KNUCKLE + i].copy(h.matrix);
    });
    for (const im of [c.tireL, c.tireR, c.rings, c.barrels]) { im.instanceMatrix.needsUpdate = true; im.boundingBox = null; }
    const ax = [0, 1].map((k) => { // 橋：兩個輪子中間，z 軸從左輪指向右輪
      const L = c.hubs[k * 2].position, R = c.hubs[k * 2 + 1].position, C = L.clone().add(R).multiplyScalar(0.5);
      const Z = R.clone().sub(L).normalize(), X = V(1, 0, 0).addScaledVector(Z, -Z.x).normalize(), Y = Z.clone().cross(X);
      c.bones[B_AXLE + k].makeBasis(X, Y, Z).setPosition(C);
      return (d) => C.clone().addScaledVector(X, d[0]).addScaledVector(Y, d[1]).addScaledVector(Z, d[2]);
    });
    SHOCKS.forEach((k, n) => { const top = Bp(k.top), bot = ax[k.a](k.bot); strut(c.bones[B_SHOCK + n], top, bot, 1); strut(c.bones[B_ROD + n], bot, top, 1); }); // 筒身、活塞桿的長度在幾何裡（骨頭不拉長）
    LINK_P.forEach((k, n) => strut(c.bones[B_LINK + n], Bp(k.p0), ax[k.a](k.p1)));
    SHAFTS.forEach(([cp, dx], a) => strut(c.bones[B_SHAFT + a], Bp(cp), ax[a]([dx, 0, -0.15])));
    [0, 1].forEach((a) => { const e = (i) => V(...armEnd(i)).applyMatrix4(c.hubs[i].matrix); strut(c.bones[B_TIE + a], e(a * 2), e(a * 2 + 1)); });
  }
  function rig(c) {
    const g = new THREE.Group(); g.name = 'monster-rig';
    const st = new THREE.Mesh(staticGeo(), c.pal); st.name = 'monster-chassis'; g.add(st);
    const uns = new THREE.Group(); uns.name = 'monster-unsprung'; uns.matrixAutoUpdate = false; uns.visible = false; c.uns = uns; g.add(uns); // 找到輪子以前先藏起來
    // 骨頭：不放進場景，每幀直接寫 matrixWorld（＝在 monster-unsprung 裡的位置；綁定矩陣是單位矩陣）
    const bones = Array.from({ length: NB }, () => new THREE.Bone());
    c.bones = bones.map((b) => b.matrixWorld);
    // 找到輪子（init）以前還掛在 body 底下（車庫 disposeCar 才放得到），盒子先是空的：這時候量 body、量整台車都不算它們（跟改之前 parts.js 的輪子在 hub 上一樣）
    const sk = new THREE.SkinnedMesh(unsprungGeo(), c.pal); sk.name = 'monster-axles'; c.sk = sk;
    sk.bindMode = THREE.DetachedBindMode; sk.bind(new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4())), new THREE.Matrix4());
    sk.boundingBox = new THREE.Box3(); sk.boundingSphere = UNS_SPHERE.clone(); // 盒子 init 以後換成 UNS_BOX
    uns.add(sk);
    // 輪子（實例）：先擺在靜止的位置
    const im = (geo, mat, n, name) => { const o = new THREE.InstancedMesh(geo, mat, n); o.name = name; o.instanceMatrix.setUsage(THREE.DynamicDrawUsage); o.boundingBox = new THREE.Box3(); o.boundingSphere = UNS_SPHERE.clone(); uns.add(o); return o; };
    c.tireL = im(wheelGeo(c.kit, -1), c.pal, 2, 'monster-tires-l'); c.tireR = im(wheelGeo(c.kit, 1), c.pal, 2, 'monster-tires-r');
    c.rings = im(ringGeo(), c.ring, 4, 'monster-rings'); c.barrels = im(barrelGeo(), c.mats.chrome, 4, 'monster-barrels');
    [[WH.xf, -1], [WH.xf, 1], [WH.xr, -1], [WH.xr, 1]].forEach(([x, s], i) => {
      _w.makeRotationY(s < 0 ? Math.PI : 0).setPosition(x, WH.R, s * WH.track);
      (i % 2 ? c.tireR : c.tireL).setMatrixAt(i >> 1, _w); c.rings.setMatrixAt(i, _w); c.barrels.setMatrixAt(i, _w);
    });
    // drive.js、race.src.js 量 body 的盒子（Box3.setFromObject(body)）：改之前轉向節在 body 裡，量到半寬 1.26（地上影子的寬度、碰撞盒；碰撞盒還有 PERF.halfW 1.905 墊著）
    //   → 放一個看不到的盒子（空的網格、只有 boundingBox），量起來一樣；車頭、車尾還是車殼、旗子量到的（2.816、−2.9，跟改之前一樣）
    const size = new THREE.Mesh(new THREE.BufferGeometry(), c.pal); size.name = 'monster-size'; size.visible = false;
    size.geometry.boundingBox = new THREE.Box3(V(-1, 0.9, -1.26), V(1, 1.5, 1.26)); g.add(size);
    const base = g.updateMatrixWorld;
    g.updateMatrixWorld = function (force) { update(c); base.call(this, force); };
    return g;
  }
  function tread(c) { c.tireL.geometry = wheelGeo(c.kit, -1); c.tireR.geometry = wheelGeo(c.kit, 1); }

  // 懸吊、四輪轉向（說明在檔案最上面）
  function susp(S, cs = [0, 0, 0, 0], steerF = 0, steerR = 0) {
    const hubs = S.wheels.map((w) => w.parent), W = S.spec.wheels, cl = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
    hubs.forEach((h, i) => { h.position.y = (i < 2 ? W.RF ?? W.R : W.RR ?? W.R) + cl(cs[i], -0.40, 0.35); });
    for (const k of [0, 1]) {
      const L = hubs[k * 2], R = hubs[k * 2 + 1], roll = -Math.atan2(R.position.y - L.position.y, R.position.z - L.position.z), st = cl(k ? steerR : steerF, -0.6, 0.6);
      L.rotation.set(roll, Math.PI - st, 0); R.rotation.set(roll, -st, 0);
    }
  }

  // build：把車殼網格放大回公尺、換上自己的車內那層和玻璃那層、裝上所有零件；回傳換胎紋的函式（車庫的「套件」）
  function build(body, paint, mats) {
    const c = ctxOf(mats); c.paint = paint; c.body = body;
    // body-monster*.glb 的 Nose_glass（carGeos 當成車頭讀進來）：拿去換 glass 的網格（只有側窗、前擋附近的三角形；沒有的話玻璃那層畫整個車殼，一樣看得到，只是比較重）
    //   車內那層（inside）跟車漆用同一個網格：用比較粗的網格，從駕駛座看擋風玻璃下緣會漏一條亮線（舊的 glb 裡的 Nose_inside 就不用，拿掉）
    for (const k of ['nose-glass', 'nose-inside']) {
      const sub = body.getObjectByName(k), m = k === 'nose-glass' && body.getObjectByName('glass');
      if (sub) { if (m) m.geometry = sub.geometry; body.remove(sub); } // 網格是頁面共用的（carGeos 快取），拿掉不放掉
    }
    for (const n of ['paint', 'inside', 'glass']) { const m = body.getObjectByName(n); if (m) { m.scale.setScalar(1 / MS); m.position.set(X0, Y0, 0); } }
    const cab = body.getObjectByName('interior'); // parts.js 的車內不要（怪獸卡車的車內在車架網格裡）
    if (cab) { cab.traverse((o) => o.geometry && o.geometry.dispose()); cab.clear(); }
    body.add(rig(c));
    return (kit) => { c.kit = KITS.includes(kit) ? kit : 'chevron'; tread(c); };
  }

  // ---- 輕量車（carlod.js）----
  // lodWheels(B, R, kit, axles, lift)：輪子網格（跟車身同一個材質＝類別表）：低面數的胎體＋胎紋（tire：MONSTER_SPEC.lod.cls 的顏色）、beadlock 環（paint：跟車身同色）、
  //   輪框筒（rim：輪框色）、中心，還有靜止姿勢的橋、轉向節、避震器、連桿、傳動軸、轉向拉桿（放在輪子網格，留在輪子這邊；車身那頭的點照 lift＝車身升高幾公尺算，
  //   跟完整的車一樣：避震器筒身跟著車身上去、活塞桿留在橋上，連桿、傳動軸拉長）；B＝carlod.js 的 builder()，R＝角色 → 類別
  function lodWheels(B, R, kit, axles, lift = 0) {
    const add = (g, cls, m) => { // 三角形湯 → B（m：變換矩陣；先複製，共用的幾何不能改到）
      g = merge([soup(g)]); if (m) g.applyMatrix4(m);
      const p = g.attributes.position.array, n = g.attributes.normal.array, o = B.P.length / 3;
      for (let i = 0; i < p.length; i += 3) { B.P.push(p[i], p[i + 1], p[i + 2]); B.N.push(n[i], n[i + 1], n[i + 2]); B.C.push(cls); B.U.push(0, 0); B.K.push(0); }
      for (let i = 0; i < p.length / 3; i++) B.I.push(o + i);
    };
    const T = [];
    for (const l of lugs(KITS.includes(kit) ? kit : 'chevron', 0.3)) lug(T, ...l);
    const LP = [[0.78, 0], [0.776, 0.42], [0.74, 0.513], [0.645, 0.543], [0.50, 0.493], [0.39, 0.40], [0.37, 0.335]];
    const tire = merge([soup(lathe([...LP.slice().reverse().map(([r, a]) => [r, -a]), ...LP.slice(1)], 28)), soup(posGeo(T))]);
    const tireL = mirrorX(tire);
    const ring = soup(merge([soup(lathe([[0.392, 0.352], [0.305, 0.352]], 24)), soup(lathe([[0.392, 0.30], [0.392, 0.352]], 24))]));
    const barrel = soup(merge([soup(lathe([[0.300, 0.30], [0.300, -0.02]], 20)), soup(lathe([[0.300, -0.02], [0.14, -0.02]], 20))]));
    const hub = soup(lathe([[0.135, 0.10], [0.0, 0.125]], 12));
    const M = new THREE.Matrix4(), hubs = [];
    axles.forEach((A, k) => [-1, 1].forEach((s) => {
      M.makeRotationY(s < 0 ? Math.PI : 0).setPosition(A.x, A.R, s * A.z); hubs[k * 2 + (s > 0 ? 1 : 0)] = M.clone();
      add(s < 0 ? tireL : tire, R.tire ?? R.rubber, M); add(ring, R.paint, M); add(barrel, R.rim, M); add(hub, R.hub, M);
    }));
    // 懸吊（靜止的姿勢：跟完整的車第一幀一樣算）
    const bone = Array.from({ length: NB }, () => new THREE.Matrix4()), P0 = (a) => V(a[0], a[1] + lift, a[2]); // 車身那頭（車身升高）
    hubs.forEach((h, i) => bone[B_KNUCKLE + i].copy(h));
    const ax = [0, 1].map((k) => { const C = V().setFromMatrixPosition(hubs[k * 2]).add(V().setFromMatrixPosition(hubs[k * 2 + 1])).multiplyScalar(0.5); bone[B_AXLE + k].makeTranslation(C.x, C.y, C.z); return (d) => C.clone().add(V(...d)); });
    SHOCKS.forEach((k, n) => { const top = P0(k.top), bot = ax[k.a](k.bot); strut(bone[B_SHOCK + n], top, bot, 1); strut(bone[B_ROD + n], bot, top, 1); });
    LINK_P.forEach((k, n) => strut(bone[B_LINK + n], P0(k.p0), ax[k.a](k.p1)));
    SHAFTS.forEach(([cp, dx], a) => strut(bone[B_SHAFT + a], P0(cp), ax[a]([dx, 0, -0.15])));
    [0, 1].forEach((a) => { const e = (i) => V(...armEnd(i)).applyMatrix4(hubs[i]); strut(bone[B_TIE + a], e(a * 2), e(a * 2 + 1)); });
    const low = (r, sg) => new THREE.CylinderGeometry(r, r, 1, sg, 1, true).translate(0, 0.5, 0);
    [1, -1].forEach((fx, a) => add(merge([between(low(0.095, 8), V(0, 0, -0.96), V(0, 0, 0.96)), new THREE.SphereGeometry(0.24, 8, 5).translate(-0.06 * fx, 0, -0.15)].map(soup)), R.hub, bone[B_AXLE + a]));
    for (let i = 0; i < 4; i++) add(between(low(0.15, 8), V(0, 0, -0.40), V(0, 0, -0.10)), R.hub, bone[B_KNUCKLE + i]);
    for (let n = 0; n < 16; n++) { add(low(0.058, 6).scale(1, SH.len, 1), R.chrome, bone[B_SHOCK + n]); add(low(0.024, 4).scale(1, SH.rod, 1), R.chrome, bone[B_ROD + n]); }
    for (let n = 0; n < 8; n++) add(low(0.038, 5), R.alu, bone[B_LINK + n]);
    for (let a = 0; a < 2; a++) { add(low(0.045, 5), R.hub, bone[B_SHAFT + a]); add(low(0.032, 4), R.alu, bone[B_TIE + a]); }
  }
  // lodParts(q)：輕量車的靜止零件（車身座標的三角形湯，做 body-monster-lod.glb 的時候用：monster-lod.mjs；q＝段數比例）→ { base: [[調色盤名字, 幾何]], flag: [[名字, 幾何]], PAL, CLOTH }
  function lodParts(q = 0.75) {
    OPEN = true; const st = staticParts(q); OPEN = false;
    const jo = []; // 車身那頭的球頭：只留連桿、傳動軸的（避震器上端藏在葉子板、引擎蓋裡），段數少
    for (const k of LINK_P) jo.push(soup(new THREE.SphereGeometry(0.058, 6, 4).translate(...k.p0)));
    for (const [cp] of SHAFTS) jo.push(soup(new THREE.SphereGeometry(0.07, 6, 4).translate(...cp)));
    // 旗子：旗板（8 段，跟完整的車那片一樣彎）＋兩面的白星、三條白條紋（照 flag() 貼圖的位置，離旗板 4 公釐）
    const FZ = (u, v) => FLAG_Z + 0.05 * Math.sin(Math.PI * u) * (1 - 0.3 * v);
    const P = (u, v, dz = 0) => { const lo = [FA[0] + (FD[0] - FA[0]) * u, FA[1] + (FD[1] - FA[1]) * u], hi = [FB[0] + (FC[0] - FB[0]) * u, FB[1] + (FC[1] - FB[1]) * u]; return [lo[0] + (hi[0] - lo[0]) * v, lo[1] + (hi[1] - lo[1]) * v, FZ(u, v) + dz]; };
    const cloth = [], deco = [];
    for (let i = 0; i < 8; i++) for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) cloth.push(...P((i + a) / 8, b));
    const px = (x, y, sd) => P(x / 512, (256 - y) / 256, sd * 0.004); // 貼圖的像素（旗子那塊 512×256，y 往下）→ 旗板上的點
    const tri = (a, b, c, sd) => { const z = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); deco.push(...a, ...((z > 0) === (sd > 0) ? [...b, ...c] : [...c, ...b])); }; // 正面朝外
    for (const sd of [1, -1]) {
      const pt = (k) => { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 34 : 86; return px(110 + Math.cos(a) * r, 104 + Math.sin(a) * r, sd); };
      for (let i = 0; i < 10; i++) tri(px(110, 104, sd), pt(i), pt(i + 1), sd); // 白星
      for (const [y, w] of [[150, 300], [182, 250], [214, 200]]) for (let k = 0; k < 8; k++) { // 斜切的白條紋（沿著長邊切 8 段，貼著旗板的彎）
        const T = (t, bot) => px(bot ? 488 - w + (w - 16) * t : 472 - w + (w + 16) * t, bot ? y + 20 : y, sd);
        tri(T(k / 8, 0), T((k + 1) / 8, 0), T((k + 1) / 8, 1), sd); tri(T(k / 8, 0), T((k + 1) / 8, 1), T(k / 8, 1), sd);
      }
    }
    const clothGeo = new THREE.BufferGeometry(); clothGeo.setAttribute('position', new THREE.Float32BufferAttribute(cloth, 3)); clothGeo.computeVertexNormals();
    return {
      base: [...st, ['axle', merge(jo)]],
      flag: [['flag', twoSided(soup(clothGeo))], ['flagStar', posGeo(deco)], ['alu', soup(between(cyl(0.02, 6), V(-1.99, 2.88, FLAG_Z), V(-2.09, 3.54, FLAG_Z)))]],
      PAL, CLOTH: { flag: [0x101114, 0.55, 0.1], flagStar: [0xf4f5f7, 0.55, 0.1] },
    };
  }
  // lodLivery(style)：輕量車的拉花貼圖（左右兩張，512 寬；'none' → null）；跟 masks.js 一樣投影到車身側面
  //   通用拉花（火焰、賽車條紋、大便龍車隊：masks.js withGenericLivery）要側面投影圖找位置：畫的時候才做，畫完就丟（手機記憶體）
  const LIV = new Map(), GEN = ['flames', 'stripes', 'team'];
  function lodLivery(style) {
    if (!style || style === 'none') return null;
    if (LIV.has(style)) return LIV.get(style);
    const gen = GEN.includes(String(style).replace(/^gen:/, '')) ? withGenericLivery(MONSTER_LOOK, MONSTER_LOOK.side()) : null;
    const tex = (sd) => {
      const src = gen ? gen.livery(sd, style) : MONSTER_LOOK.livery(sd, style), c = document.createElement('canvas'); c.width = 512; c.height = Math.round((512 * src.height) / src.width);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    };
    const L = { R: tex(1), L: tex(-1) };
    LIV.set(style, L);
    return L;
  }
  return { rimFace, flag, build, susp, WH, lodWheels, lodParts, lodLivery };
})();

export const MONSTER_SUSP = MONSTER_P.susp;
export const MONSTER_SPEC = {
  look: MONSTER_LOOK, paint: '#c2186b', metal: 0.25, seat: 0x151619,
  // 66×43 吋輪胎、25 吋 beadlock 框；軸距 3.80（照片量的）、輪距 2.72（外寬 3.81 公尺）
  wheels: { xf: MONSTER_P.WH.xf, xr: MONSTER_P.WH.xr, R: MONSTER_P.WH.R, rim: MONSTER_P.WH.rim, trackF: MONSTER_P.WH.track, trackR: MONSTER_P.WH.track, wF: MONSTER_P.WH.w, wR: MONSTER_P.WH.w, style: MONSTER_P.rimFace },
  mirror: () => new THREE.Group(), // 照片那台沒有後照鏡
  wings: { flag: (paint, mats) => MONSTER_P.flag(mats) }, wing: 'flag',
  interior: {},
  build: MONSTER_P.build,
  kit: 'chevron',
  susp: MONSTER_SUSP,
  // 輕量車（carlod.js）：自己的輪子＋懸吊（wheels）、拉花貼圖（livery；uv＝車子座標 x、y 乘加＝遮罩座標的側面投影，y 低於 livY0 的地方不畫：輪子那邊的 beadlock 環也是車漆類）、
  //   多的類別（cls：[顏色, 粗糙度, 金屬感]，接在 glb 的 custom 後面；輪胎有點沾到土，比 carlod.js 的 rubber 亮）、底盤燈的範圍（glow：x0, x1, 半寬，蓋住四個輪子中間）
  lod: {
    wheels: MONSTER_P.lodWheels, livery: MONSTER_P.lodLivery,
    liv: [0.8 / 4.7, (2.35 - 0.1 * 0.8) / 4.7, 0.8 / 1.4, (-1.38 * 0.8) / 1.4], livY0: 1.40,
    cls: { tire: [0x25221f, 0.93, 0] }, glow: [-2.3, 2.5, 1.5],
  },
};

// 照片相機（照片那一刻車在空中、四個輪子往下垂 pose；cview.html 會用 MONSTER_SUSP 擺出來）＋這台大車自己的標準視角
export const MONSTER_CAMS = {
  photo1: { a: -50.3433, d: 65.7729, h: -12.0492, tx: 0.0667, ty: 1.0644, fov: 4.8814, rl: -12.676, pose: [-0.0783, -0.1884, -0.1891, -0.1443] },
  front34: { a: -38, d: 13.5, h: 2.6, tx: 0.2, ty: 1.45, fov: 26 }, rear34: { a: 145, d: 14, h: 2.8, tx: -0.1, ty: 1.45, fov: 26 },
  side: { a: 90, d: 56, h: 1.6, tx: 0.1, ty: 1.6, fov: 7.5 }, front: { a: 0, d: 60, h: 1.6, tx: 0, ty: 1.6, fov: 5 }, rear: { a: 180, d: 60, h: 1.6, tx: 0, ty: 1.6, fov: 5 },
  low: { a: 25, d: 11.5, h: 0.7, tx: 0.2, ty: 1.45, fov: 26 },
};

export const MONSTER_GARAGE = {
  name: '怪獸卡車', sub: '照 Nick 的照片做 · 3D 試做版',
  paints: [['#c2186b', '怪獸桃紅'], ['#1d4fd8', '寶藍'], ['#e0251b', '賽車紅'], ['#f3c316', '校車黃'], ['#2f9e44', '怪獸綠'], ['#ff6a13', '亮橘'], ['#1a1b1f', '亮黑'], ['#b9bec6', '銀'], ['#6b2fc0', '葡萄紫']],
  opts: {
    wing: [['flag', '尾旗'], ['none', '不要']],
    kit: [['chevron', 'V 字胎紋'], ['paddle', '沙地槳胎'], ['block', '越野塊狀胎']],
    height: [['0', '原廠'], ['0.15', '升高'], ['0.3', '超高']],
    livery: [['twotone', '照片雙色'], ['stars', '星條'], ['fire', '怪獸火焰'], ['number', '大便龍 66'], ['none', '不要']],
    rimStyle: [['stock', '原廠 beadlock']],
    wide: [['off', '原廠']],
  },
  state: { paint: '#c2186b', rim: 'chrome', caliper: '#17181b', wing: 'flag', kit: 'chevron', height: '0', livery: 'twotone', tint: 'dark' },
};
