// 輕量車（LOD）：車庫六個車位停的車、車行展示的車、之後路上別人開的車用的「輕的整台車」
// 一台約 2～2.5 萬個三角形、4 個 draw call（車身＋零件、玻璃、輪胎＋煞車、輪框），沒有車內（深色玻璃擋住，看進去是暗的車殼）
// 車身檔 body-<key>-lod.glb（node make-lod.mjs 從完整的車做的；試做頁用 base64 的 car-<key>-lod.txt，App 用 tune/<key>-lod.glb）：
//   node「body」＝右半邊車身（extras.lod＝'body'、half），每個分類一個 primitive（車漆、玻璃、黑飾條、消光、燈、燈裡的暗玻璃、網子、方向燈、尾燈、倒車燈），材質名字＝角色
//   node「nose_<名字>」＝Supra 的車頭（lod＝'nose'、half、kits＝哪些套件用它）；node「part_<n>」＝零件（整台，lod＝'part'），extras＝{ kits, wing, wide } 看得到的條件
//   材質 extras＝{ role, cc }：角色固定的（paint、trim、rim⋯）顏色在這裡決定，custom 用 glb 裡的顏色／粗糙度／金屬感
// 輪子（輪胎、輪框筒內側、碟盤、卡鉗）這裡照 spec.wheels 做低面數的；輪框是一片圓盤＋外圈輪唇，貼「輪框圖」：
//   parts.js 的 wheel()（輪框面＋輪框筒，跟完整的車同一個樣式）從正面光柵化成 128×128 的顏色／透明度＋法線貼圖（第一次用到那個樣式時做，之後共用）
// 用法：
//   const scene = await LOD_CARS.gc8.load();                          // 下載＋解析一次（同一台之後組幾台都共用）
//   const lod = buildLodCar('gc8', scene, CARS.gc8.state); world.add(lod.car);
//   lod.setLook({ paint: '#c8141e', finish: 'matte', rim: 'gold', wing: 'gt' });   // 只給要改的
//   lod.setRoll(公尺)（輪框轉：開了多遠）、lod.dispose()（網格、輪框圖大家共用，放掉自己的那份）
//   lod.setSquash(0–1)（第 7 批：被怪獸卡車輾扁，車頂壓下來、玻璃破掉；0＝原狀）
//   外觀（跟車庫 CARS[key].state 一樣的鍵）：paint、finish（stock|gloss|metal|matte|pearl）、rim（chrome|gunmetal|black|gold|white 或 #hex）、rimStyle（stock|five|six|multi|mesh|dish|fan）、
//     caliper、tint（light|dark）、wing、kit、wide（on|off）、height、glow（none|#hex）、livery（只有 Jesko 的點綴色：red|green|none；其他台不畫拉花）；另外 lights（大燈尾燈亮）、brake（煞車燈）
// 擺法跟 buildCar 的 car 一樣：車的中心在原點、車頭朝 +x、輪子踩在 y=0，軸距、輪距、輪子大小、車高照 spec（跟完整的車換來換去不會跳）
// 怪獸卡車（第 4 批）：spec.lod 自己給輪子＋懸吊（lod.wheels：胎紋照 kit、懸吊照車身高度拉長；輪框筒是 rim 類，不用輪框圖、輪框不轉）、拉花（lod.livery：左右兩張貼圖，
//   從側面投影到車漆類，uv＝車子座標乘加 lod.liv，y＜lod.livY0 不畫）、多的類別（lod.cls：輪胎的顏色，接在 glb 的 custom 後面）、底盤燈範圍（lod.glow）
// 打包（build-art.mjs／build-app.mjs 拿掉 import／export，接在每台車的 spec 後面）：最上層只有 buildLodCar、LOD_CARS，其他都在 IIFE 裡
//   檔名要照字面寫（build-app.mjs 把 'car-<key>-lod.txt' 換成 'tune/<key>-lod.glb?h=<雜湊>'），下面 SIZES 的大小由 build 填（那個記號整個檔只能出現一次，註解裡也不能寫）
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SUPRA_SPEC, GTR_SPEC } from './supra.js';
import { wheel, neonPad, WIDE_PUSH, RIM_POLISH } from './parts.js';
import { GC8_SPEC, GC8_GARAGE } from './gc8-spec.js';
import { YARIS_SPEC, YARIS_GARAGE } from './yaris-spec.js';
import { P918_SPEC, P918_GARAGE, P918_FINISH } from './p918-spec.js';
import { SP3_SPEC, SP3_GARAGE } from './sp3-spec.js';
import { JESKO_SPEC, JESKO_GARAGE } from './jesko-spec.js';
import { MONSTER_SPEC, MONSTER_GARAGE } from './monster-spec.js'; // 第 4 批：怪獸卡車

export const { buildLodCar, LOD_CARS } = (() => {
  // spec、預設外觀用 switch 拿（只算到用到的那一個）：沒打包 Yaris 的版本（build-art.mjs 沒加 --yaris）拿 YARIS_SPEC 會丟 ReferenceError → 那台就不列在 LOD_CARS
  // 打包時這個檔要接在每台車的 spec 後面（build-art.mjs／build-app.mjs 是這樣接的）
  const SPEC = (k) => { switch (k) { case 'supra': return SUPRA_SPEC; case 'gtr': return GTR_SPEC; case 'gc8': return GC8_SPEC; case 'yaris': return YARIS_SPEC; case 'p918': return P918_SPEC; case 'sp3': return SP3_SPEC; case 'jesko': return JESKO_SPEC; case 'monster': return MONSTER_SPEC; } return null; };
  const KEYS = ['supra', 'gtr', 'gc8', 'yaris', 'p918', 'sp3', 'jesko', 'monster'].filter((k) => { try { return !!SPEC(k); } catch { return false; } });
  const DEF = (k) => { switch (k) { // Supra、GT-R 的預設寫在車庫頁（garage.src.html CARS），這裡抄一份；其他台用 <KEY>_GARAGE.state
    case 'supra': return { paint: '#ff7414', rim: 'chrome', caliper: '#9da1a6', wing: 'gt', kit: 'bomex', height: '0', livery: 'ff', tint: 'light' };
    case 'gtr': return { paint: '#1d4fc9', rim: 'gunmetal', caliper: '#c8141e', wing: 'stock', kit: 'bomex', height: '-0.03', livery: 'none', tint: 'light' };
    case 'gc8': return GC8_GARAGE.state; case 'yaris': return YARIS_GARAGE.state; case 'p918': return P918_GARAGE.state; case 'sp3': return SP3_GARAGE.state; case 'jesko': return JESKO_GARAGE.state; case 'monster': return MONSTER_GARAGE.state;
  } return {}; };
  const BASE = { wide: 'off', finish: 'stock', rimStyle: 'stock', glow: 'none', lights: false, brake: false };
  const FILES = { supra: 'car-supra-lod.txt', gtr: 'car-gtr-lod.txt', gc8: 'car-gc8-lod.txt', yaris: 'car-yaris-lod.txt', p918: 'car-p918-lod.txt', sp3: 'car-sp3-lod.txt', jesko: 'car-jesko-lod.txt', monster: 'car-monster-lod.txt' };
  const SIZES = {/*__LOD_SIZES__*/};
  const LOADED = new Map(); // key → Promise<gltf.scene>
  function load(k) { // 下載（.txt＝base64、.glb 直接用）＋解析；失敗了下次再試
    if (!LOADED.has(k)) {
      LOADED.set(k, (async () => {
        const res = await fetch(FILES[k]);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        let buf = await res.arrayBuffer();
        if (/\.txt(\?|$)/.test(FILES[k])) {
          const s = atob(new TextDecoder().decode(buf).trim()), u = new Uint8Array(s.length);
          for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
          buf = u.buffer;
        }
        return (await new GLTFLoader().parseAsync(buf, '')).scene;
      })().catch((e) => { LOADED.delete(k); throw e; }));
    }
    return LOADED.get(k);
  }
  const LOD_CARS = Object.fromEntries(KEYS.map((k) => [k, {
    key: k, file: FILES[k], size: SIZES[k] || 0, load: () => load(k),
    get spec() { return SPEC(k); }, get look() { return { ...BASE, ...DEF(k) }; },
  }]));

  // ---- 材質角色 → 類別編號（頂點帶 lodCls，shader 查表拿顏色、粗糙度、金屬感、清漆、發光）----
  const ROLES = ['paint', 'glass', 'trim', 'matte', 'lamp', 'lens', 'wire', 'amber', 'red', 'rev', 'chrome', 'black', 'gloss', 'carbon', 'alu', 'rim', 'polish',
    'barrelIn', 'mirrorGlass', 'accent', 'rubber', 'disc', 'caliper', 'seat', 'cage', 'hub'];
  const ALIAS = { jeskoAcc: 'accent' }; // mats 裡叫別的名字的（chrome 在烘焙時就改叫 rim 了；這裡的 chrome＝車身上低的鍍鉻）
  const NC = 32, CUSTOM0 = ROLES.length; // 後面幾格給每台車自己的材質（custom）
  const R = Object.fromEntries(ROLES.map((r, i) => [r, i]));
  const lin = (h) => new THREE.Color(h); // sRGB hex → 線性
  const grey = (v) => new THREE.Color(v, v, v);
  // [顏色, 粗糙度, 金屬感, 清漆]：車身遮罩那幾類照 masks.js patchPaint 的值（線性色），零件照 parts.js MAT
  const FIXED = {
    trim: [grey(0.012), 0.2, 0, 0.2], matte: [grey(0.02), 0.8, 0, 0], lamp: [new THREE.Color(0.86, 0.88, 0.9), 0.14, 1, 1], chrome: [new THREE.Color(0.86, 0.88, 0.9), 0.14, 1, 1],
    amber: [new THREE.Color(1, 0.45, 0.05), 0.12, 0, 1], red: [new THREE.Color(0.38, 0, 0.01), 0.12, 0.1, 1], rev: [grey(0.85), 0.2, 0, 1], hub: [lin(0x34363a), 0.6, 0.3, 0],
    black: [lin(0x0a0a0b), 0.5, 0, 0], gloss: [lin(0x050506), 0.15, 0, 1], carbon: [lin(0x17181b), 0.3, 0.1, 1], alu: [lin(0xc9ccd0), 0.28, 1, 0],
    polish: [lin(0xdadde2), 0.1, 1, 0], barrelIn: [lin(0x9aa0a6), 0.35, 1, 0], mirrorGlass: [lin(0xffffff), 0.02, 1, 0], rubber: [lin(0x0c0c0d), 0.82, 0, 0],
    disc: [lin(0x6d6f72), 0.45, 0.9, 0], seat: [lin(0x1c1d20), 0.8, 0, 0], cage: [lin(0xd8dadc), 0.45, 0.2, 0],
  };
  const RIM_LOOK = { chrome: [0xe8eaec, 1, 0.07], gunmetal: [0x4b4f55, 1, 0.3], black: [0x16171a, 0.5, 0.35], gold: [0xd2a646, 1, 0.18], white: [0xf0f0f0, 0, 0.3] }; // 跟車庫一樣
  // 漆面 [粗糙度, 金屬感, 清漆, 清漆粗糙度, 珍珠]（跟 supra.js buildCar 的 FIN 一樣，少了亮片）
  const FIN = { gloss: [0.16, 0.02, 1, 0.012, 0], metal: [0.3, 0.6, 1, 0.03, 0], matte: [0.62, 0.12, 0.001, 0.6, 0], pearl: [0.22, 0.3, 1, 0.02, 1] };
  const ACCENT = { red: '#d3142a', green: '#5fd12a' }; // Jesko 的點綴色（jesko-look.js），none＝碳纖維黑
  // lens、wire 照這台車的比例混（make-lod.mjs 算好放在材質 extras.mix）：燈裡暗玻璃蓋在鍍鉻上、網子（金屬線）蓋在黑底上，跟 patchPaint 的 mix 一樣
  const LENS = (m) => [new THREE.Color(0.86, 0.88, 0.9).lerp(new THREE.Color(0.1, 0.11, 0.13), m), 0.14 + (0.05 - 0.14) * m, (1 - m) * (1 - m), 1];
  const WIRE = (c) => [grey(0.012).lerp(new THREE.Color(0.22, 0.23, 0.24), c), 0.2 + 0.2 * c, 0.8 * c, 1 - Math.max(c, 0.8 * (1 - c))];
  const INSIDE = lin(0x2c2e33); // 車殼背面＝從玻璃看進去的車內（沒有座椅、儀表，用中間偏暗的灰代替）

  // ---- 讀 glb（同一個 gltf.scene 只讀一次，組很多台共用）----
  const PREP = new WeakMap();
  function prep(root) {
    let d = PREP.get(root);
    if (d) return d;
    root.updateMatrixWorld(true);
    const nodes = new Map(), customs = [], mix = { lens: 1, wire: 0.45 };
    const toCar = (attr, m, normal) => { // 量化的 glb 頂點 → 車身座標（公尺）
      const n = attr.count, o = new Float32Array(n * 3), v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m);
      for (let i = 0; i < n; i++) { v.fromBufferAttribute(attr, i); if (normal) v.applyMatrix3(nm).normalize(); else v.applyMatrix4(m); o[i * 3] = v.x; o[i * 3 + 1] = v.y; o[i * 3 + 2] = v.z; }
      return o;
    };
    root.traverse((o) => {
      if (!o.isMesh) return;
      let nd = o; while (nd && !nd.userData.lod) nd = nd.parent;
      if (!nd) return;
      const mat = o.material, role = mat.userData.role || mat.name;
      if ((role === 'lens' || role === 'wire') && mat.userData.mix !== undefined) mix[role] = mat.userData.mix;
      let cls = R[ALIAS[role] || role];
      if (cls === undefined) { // 這台車自己的材質（最多 6 種，再多的用第一種）
        let j = customs.findIndex((c) => c.mat === mat);
        if (j < 0 && customs.length < NC - CUSTOM0) {
          const c = mat.color;
          j = customs.length;
          customs.push({ mat, col: c.clone(), rough: mat.roughness, metal: mat.metalness, cc: mat.userData.cc || 0, emi: mat.emissive.clone(), red: c.r > 0.05 && c.g < 0.1 * c.r && c.b < 0.1 * c.r }); // 紅的（尾燈）：開燈、踩煞車會亮
        }
        cls = CUSTOM0 + Math.max(0, j);
      }
      if (!nodes.has(nd)) nodes.set(nd, { ud: nd.userData, P: toCar(o.geometry.attributes.position, o.matrixWorld, false), N: toCar(o.geometry.attributes.normal, o.matrixWorld, true), prims: [] });
      nodes.get(nd).prims.push({ cls, idx: o.geometry.index.array }); // 同一個 node 的 primitive 共用頂點
    });
    const pieces = [];
    for (const nd of nodes.values()) {
      let P = nd.P, N = nd.N, prims = nd.prims;
      const n = P.length / 3;
      if (nd.ud.half) { // 半邊 → 整台（z 鏡射，三角形反過來繞）
        const P2 = new Float32Array(n * 6), N2 = new Float32Array(n * 6);
        P2.set(P); N2.set(N);
        for (let i = 0; i < n; i++) { P2[(n + i) * 3] = P[i * 3]; P2[(n + i) * 3 + 1] = P[i * 3 + 1]; P2[(n + i) * 3 + 2] = -P[i * 3 + 2]; N2[(n + i) * 3] = N[i * 3]; N2[(n + i) * 3 + 1] = N[i * 3 + 1]; N2[(n + i) * 3 + 2] = -N[i * 3 + 2]; }
        prims = prims.map(({ cls, idx }) => { const I = new Uint32Array(idx.length * 2); I.set(idx); for (let t = 0; t < idx.length; t += 3) { I[idx.length + t] = idx[t] + n; I[idx.length + t + 1] = idx[t + 2] + n; I[idx.length + t + 2] = idx[t + 1] + n; } return { cls, idx: I }; });
        P = P2; N = N2;
      }
      const C = new Uint8Array(P.length / 3), op = [], gl = [];
      for (const { cls, idx } of prims) { for (let t = 0; t < idx.length; t++) C[idx[t]] = cls; (cls === R.glass ? gl : op).push(idx); }
      const cat = (L) => { const o = new Uint32Array(L.reduce((a, x) => a + x.length, 0)); let k = 0; for (const x of L) { o.set(x, k); k += x.length; } return o; };
      pieces.push({ lod: nd.ud.lod, kits: nd.ud.kits || ['*'], wing: nd.ud.wing ?? null, wide: !!nd.ud.wide, P, N, C, I: cat(op), G: cat(gl) });
    }
    const bb = new THREE.Box3(), v = new THREE.Vector3(); // 車身＋車頭的外框（底盤燈用）
    for (const p of pieces) if (p.lod !== 'part') for (let i = 0; i < p.P.length; i += 3) bb.expandByPoint(v.fromArray(p.P, i));
    d = { pieces, customs, mix, bb, geos: new Map() };
    PREP.set(root, d);
    return d;
  }
  // 這組外觀（套件、尾翼、寬體）要的車身網格：不透明的＋玻璃（共用頂點）；同一台車同樣組合的共用（算引用數）
  function bodyGeo(d, kit, wing, wide) {
    const vk = `${kit}|${wing}|${wide}`;
    let e = d.geos.get(vk);
    if (e) { e.refs++; return e; }
    const use = d.pieces.filter((p) => (p.kits.includes('*') || p.kits.includes(kit)) && (p.wing === null || p.wing === wing) && (!p.wide || wide));
    const nv = use.reduce((a, p) => a + p.P.length / 3, 0), P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Uint8Array(nv);
    const I = new Uint32Array(use.reduce((a, p) => a + p.I.length, 0)), G = new Uint32Array(use.reduce((a, p) => a + p.G.length, 0));
    let o = 0, oi = 0, og = 0;
    for (const p of use) {
      P.set(p.P, o * 3); N.set(p.N, o * 3); C.set(p.C, o);
      for (let t = 0; t < p.I.length; t++) I[oi + t] = p.I[t] + o;
      for (let t = 0; t < p.G.length; t++) G[og + t] = p.G[t] + o;
      o += p.P.length / 3; oi += p.I.length; og += p.G.length;
    }
    const pa = new THREE.BufferAttribute(P, 3), na = new THREE.BufferAttribute(N, 3), ca = new THREE.BufferAttribute(C, 1);
    const mk = (idx) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', pa); g.setAttribute('normal', na); g.setAttribute('lodCls', ca); g.setIndex(new THREE.BufferAttribute(nv < 65536 ? new Uint16Array(idx) : idx, 1)); g.computeBoundingSphere(); g.computeBoundingBox(); return g; };
    e = { opaque: mk(I), glass: mk(G), refs: 1, key: vk };
    d.geos.set(vk, e);
    return e;
  }
  function releaseGeo(d, e) {
    if (--e.refs > 0) return;
    e.opaque.dispose(); e.glass.dispose(); d.geos.delete(e.key);
  }

  // ---- 輪子（低面數）：輪胎、輪框筒內側、碟盤＋帽、卡鉗 → 跟車身同一個材質（類別表）；輪框：輪唇＋輪框面（貼輪框圖）----
  // 右輪外側朝 +z；左輪是右輪對 z 鏡射（跟完整的車一樣：卡鉗都在碟盤後上方）
  function axles(spec, wide) {
    const W = spec.wheels;
    return [[W.xf, W.trackF, W.wF, W.RF ?? W.R, W.rimF ?? W.rim, 'f'], [W.xr, W.trackR, W.wR, W.RR ?? W.R, W.rimR ?? W.rim, 'r']]
      .map(([x, track, w, Rr, rim, ax]) => ({ x, z: track + (wide ? WIDE_PUSH[ax] : 0), w, R: Rr, rim, ax }));
  }
  function builder() {
    const P = [], N = [], C = [], U = [], K = [], I = [];
    return {
      P, N, C, U, K, I,
      // 一圈旋轉面：prof＝[[r, 軸向 z], ...]（右輪座標），seg 段；s＝±1（左輪鏡射）；cls 類別；uvR：有的話給貼圖座標（輪框用），k：輪框轉的倍數（1／半徑）
      // 面朝「角度方向 × 剖面方向」那邊（＝算出來的法線那邊）
      lathe(prof, seg, c, s, cls, { uvR = 0, k = 0, a0 = 0, a1 = Math.PI * 2 } = {}) {
        const o = P.length / 3, full = a1 - a0 >= Math.PI * 2 - 1e-6, cols = full ? seg : seg + 1;
        const tn = prof.map((p, i) => { const a = prof[Math.max(0, i - 1)], b = prof[Math.min(prof.length - 1, i + 1)]; const dr = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dr, dz) || 1; return [dz / l, -dr / l]; }); // 剖面法線
        for (let i = 0; i < prof.length; i++) for (let j = 0; j < cols; j++) {
          const a = a0 + ((a1 - a0) * j) / seg, ca = Math.cos(a), sa = Math.sin(a), [r, z] = prof[i], [nr, nz] = tn[i];
          P.push(c.x + ca * r, c.y + sa * r, c.z + s * z); N.push(ca * nr, sa * nr, s * nz); C.push(cls);
          U.push(0.5 + (ca * r) / (2 * (uvR || 1)), 0.5 + (sa * r) / (2 * (uvR || 1))); K.push(k);
        }
        for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < seg; j++) {
          const a = o + i * cols + j, b = o + i * cols + ((j + 1) % cols), cc = a + cols, dd = b + cols;
          if (s > 0) I.push(a, b, cc, b, dd, cc); else I.push(a, cc, b, b, cc, dd);
        }
      },
      // 平的面（多邊形，右輪座標的 [x, y]，逆時針；法線 +z，back＝朝 −z）
      cap(pts, z, c, s, cls, back = false) {
        const o = P.length / 3;
        for (const [x, y] of pts) { P.push(c.x + x, c.y + y, c.z + s * z); N.push(0, 0, s * (back ? -1 : 1)); C.push(cls); U.push(0, 0); K.push(0); }
        for (let i = 1; i < pts.length - 1; i++) { if ((s > 0) !== back) I.push(o, o + i, o + i + 1); else I.push(o, o + i + 1, o + i); }
      },
      geo(uv) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        if (uv) { g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('aRimK', new THREE.Float32BufferAttribute(K, 1)); } else g.setAttribute('lodCls', new THREE.Float32BufferAttribute(C, 1));
        g.setIndex(I); g.computeBoundingSphere(); return g;
      },
    };
  }
  const WGEO = new Map(); // 輪子網格：同一台車、同樣寬體共用（怪獸卡車：還要同樣胎紋、車身高度）
  function wheelGeo(key, spec, wide, own = '', rr = R) { // own：spec.lod.wheels 的「胎紋|車身高度」；rr：角色 → 類別（多了 spec.lod.cls）
    const k = `${key}|${wide}|${own}`;
    let e = WGEO.get(k);
    if (e) { e.refs++; return e; }
    const B = builder();
    if (spec.lod?.wheels) { const [kit, lift] = own.split('|'); spec.lod.wheels(B, rr, kit, axles(spec, wide), +lift || 0); } // 怪獸卡車：自己的輪子、懸吊
    else for (const A of axles(spec, wide)) for (const s of [1, -1]) {
      const c = { x: A.x, y: A.R, z: s * A.z }, w = A.w, Rr = A.R, rim = A.rim;
      // 輪胎剖面（跟 parts.js wheel() 一樣，少幾個點）：內側胎唇 → 胎壁 → 胎面 → 外側胎壁 → 外側胎唇
      B.lathe([[rim + 0.004, -w / 2 + 0.012], [Rr - 0.045, -w / 2], [Rr - 0.006, -w / 2 + 0.024], [Rr, -w / 2 + 0.05], [Rr, w / 2 - 0.05], [Rr - 0.006, w / 2 - 0.024],
        [Rr - 0.03, w / 2 - 0.004], [Rr - 0.055, w / 2], [rim + 0.02, w / 2 - 0.002], [rim + 0.004, w / 2 - 0.012]], 32, c, s, R.rubber);
      // 輪框筒內側（從輪框的縫、斜斜的看進去；完整的車從外面看進去是背面、畫不出來，看到的是後面暗暗的輪胎內側、煞車，所以用暗灰）
      B.lathe([[rim - 0.012, w / 2 - 0.004], [rim - 0.018, w / 2 - 0.03], [rim - 0.018, -w / 2 + 0.03]], 24, c, s, R.hub);
      // 碟盤（正面）＋碟盤帽
      const disc = [], hat = [];
      for (let j = 0; j < 24; j++) { const a = (j / 24) * Math.PI * 2; disc.push([Math.cos(a) * 0.17, Math.sin(a) * 0.17]); hat.push([Math.cos(a) * 0.085, Math.sin(a) * 0.085]); }
      B.cap(disc, w / 2 - 0.096, c, s, R.disc);
      B.lathe([[0.085, w / 2 - 0.096], [0.085, w / 2 - 0.06]], 16, c, s, R.disc);
      B.cap(hat, w / 2 - 0.06, c, s, R.disc);
      // 卡鉗：r 0.118–0.198 的一段弧，在碟盤後上方（轉 0.64π）
      const a0 = Math.PI * 0.64 - 0.31, a1 = Math.PI * 0.64 + 0.31, zf = w / 2 - 0.073, zb = w / 2 - 0.147, arc = [];
      for (let j = 0; j <= 6; j++) arc.push(a0 + ((a1 - a0) * j) / 6);
      B.cap([...arc.map((a) => [Math.cos(a) * 0.198, Math.sin(a) * 0.198]), ...arc.slice().reverse().map((a) => [Math.cos(a) * 0.118, Math.sin(a) * 0.118])], zf, c, s, R.caliper);
      B.lathe([[0.198, zb], [0.198, zf]], 6, c, s, R.caliper, { a0, a1 });
      B.lathe([[0.118, zf], [0.118, zb]], 6, c, s, R.caliper, { a0, a1 });
      for (const a of [a0, a1]) { // 兩端（法線朝弧的外面）
        const e0 = [Math.cos(a), Math.sin(a)], o = B.P.length / 3, sgn = a === a0 ? -1 : 1, nx = -Math.sin(a) * sgn, ny = Math.cos(a) * sgn;
        for (const [r, z] of [[0.118, zb], [0.198, zb], [0.198, zf], [0.118, zf]]) { B.P.push(c.x + e0[0] * r, c.y + e0[1] * r, c.z + s * z); B.N.push(nx, ny, 0); B.C.push(R.caliper); B.U.push(0, 0); B.K.push(0); }
        if ((sgn > 0) === (s > 0)) B.I.push(o, o + 2, o + 1, o, o + 3, o + 2); else B.I.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
    }
    e = { geo: B.geo(false), refs: 1, key: k };
    WGEO.set(k, e);
    return e;
  }
  function releaseWheel(e) {
    if (--e.refs > 0) return;
    e.geo.dispose(); WGEO.delete(e.key);
  }
  // 輪框：每個輪子一片輪唇（輪框筒外緣，r rim±0.013，貼在胎唇前面）＋一片輪框面（r＜rim−0.013，在輻條的平均深度）
  function rimGeo(spec, wide, zFace) {
    const B = builder();
    for (const A of axles(spec, wide)) {
      const Rt = A.rim + 0.015, z = zFace + (A.w - spec.wheels.wF) / 2; // 輪框面的深度跟外緣走（後輪比較寬就往外）
      for (const s of [1, -1]) {
        const c = { x: A.x, y: A.R, z: s * A.z };
        B.lathe([[A.rim + 0.013, A.w / 2 + 0.001], [A.rim - 0.013, A.w / 2 + 0.001]], 32, c, s, 0, { uvR: Rt, k: 1 / A.R });
        B.lathe([[A.rim - 0.013, z], [0.0001, z]], 32, c, s, 0, { uvR: Rt, k: 1 / A.R });
      }
    }
    return B.geo(true);
  }

  // ---- 輪框圖：把完整的車那個樣式的輪框（parts.js wheel()，不含輪胎）從正面光柵化 ----
  // 顏色貼圖 RGBA：rgb＝自己的顏色（跟輪框同色的部分是白的）、a＝有沒有東西（alphaTest）
  // 法線貼圖 RGBA：rgb＝法線（切線空間 x→u、y→v）、a＝材質：1＝輪框色（mats.chrome）、0.5＝自己顏色的金屬（拋光輪唇、鋁）、0＝自己顏色的不是金屬（黑、碳纖維⋯）
  // 縮圖（mipmap）的透明度會照原本的覆蓋率放大，遠看輻條才不會變細不見
  // 前後輪框大小不一樣的（918、SP3、Jesko）用前輪的圖（樣式一樣，貼圖座標照各自的大小，只差一點比例）
  const RIMTEX = new Map();
  function rimTex(styleKey, style, Rr, w, rim) {
    const key = `${styleKey}|${rim.toFixed(4)}|${w.toFixed(3)}`;
    if (RIMTEX.has(key)) return RIMTEX.get(key);
    const tag = (code, c = 0xffffff) => { const m = new THREE.MeshBasicMaterial({ color: c }); m.userData.lodRim = code; return m; };
    const mats = { chrome: tag(1), polish: tag(0.5, 0xdadde2), alu: tag(0.5, 0xc9ccd0), black: tag(0, 0x0a0a0b), gloss: tag(0, 0x050506), carbon: tag(0, 0x17181b), rubber: tag(0, 0x0c0c0d),
      disc: tag(0.5, 0x6d6f72), caliper: tag(0, 0x9da1a6), barrelIn: tag(0.5, 0x9aa0a6), mirrorGlass: tag(0.5), seat: tag(0, 0x1c1d20), cage: tag(0, 0xd8dadc) };
    const { wheel: g } = wheel({ R: Rr, width: w, rim, mats, style });
    if (typeof style === 'string' && RIM_POLISH[style]) g.getObjectByName('barrel').material = mats.polish; // 跟 buildCar setRim 一樣：這些樣式的輪唇是拋光的
    g.updateMatrixWorld(true);
    const S = 256, H = 128, Rt = rim + 0.015;
    const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    const D4 = [1, 0, -1, 0, 0, 1, 0, -1]; // 上下左右（迴圈裡不要一直做新的陣列：手機上 GC 很貴）
    // 從正面光柵化（N×N），留最前面的那一面；zb：深度、nb：法線、cb：rgb＋材質碼
    const raster = (N) => {
      const k = N / (2 * Rt), zb = new Float32Array(N * N).fill(-1e9), nb = new Float32Array(N * N * 3), cb = new Float32Array(N * N * 4);
      g.traverse((o) => {
        if (!o.isMesh || o.name === 'tire') return;
        const geo = o.geometry, pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index, m = o.material, n = pos.count;
        const code = m.userData.lodRim ?? 0, own = code < 1, col = m.color || new THREE.Color(1, 1, 1), cr = own ? col.r : 1, cg = own ? col.g : 1, cbv = own ? col.b : 1;
        nm.getNormalMatrix(o.matrixWorld);
        // 頂點先轉好（x、y 換成像素，z 留公尺）、法線轉到輪子座標；沒有法線的用面法線
        const X = new Float32Array(n * 3), NN = nor ? new Float32Array(n * 3) : null;
        for (let i = 0; i < n; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); X[i * 3] = (v.x + Rt) * k; X[i * 3 + 1] = (v.y + Rt) * k; X[i * 3 + 2] = v.z;
          if (nor) { v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); NN[i * 3] = v.x; NN[i * 3 + 1] = v.y; NN[i * 3 + 2] = v.z; }
        }
        const ia = idx ? idx.array : null, nt = (idx ? idx.count : n) / 3;
        for (let t = 0; t < nt; t++) {
          const i0 = (ia ? ia[t * 3] : t * 3) * 3, i1 = (ia ? ia[t * 3 + 1] : t * 3 + 1) * 3, i2 = (ia ? ia[t * 3 + 2] : t * 3 + 2) * 3;
          const ax = X[i0], ay = X[i0 + 1], az = X[i0 + 2], bx = X[i1], by = X[i1 + 1], bz = X[i1 + 2], cx = X[i2], cy = X[i2 + 1], cz = X[i2 + 2];
          const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
          if (area <= 1e-9) continue; // 背面、側面（跟視線平行）不畫
          let fx = 0, fy = 0, fz = 1;
          if (!nor) { const ux = (bx - ax) / k, uy = (by - ay) / k, uz = bz - az, wx = (cx - ax) / k, wy = (cy - ay) / k, wz = cz - az; fx = uy * wz - uz * wy; fy = uz * wx - ux * wz; fz = ux * wy - uy * wx; const l = Math.hypot(fx, fy, fz) || 1; fx /= l; fy /= l; fz /= l; }
          const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(N - 1, Math.ceil(Math.max(ax, bx, cx))), y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(N - 1, Math.ceil(Math.max(ay, by, cy)));
          for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
            const PX = px + 0.5, PY = py + 0.5;
            const w0 = ((bx - PX) * (cy - PY) - (by - PY) * (cx - PX)) / area, w1 = ((cx - PX) * (ay - PY) - (cy - PY) * (ax - PX)) / area, w2 = 1 - w0 - w1;
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;
            const z = w0 * az + w1 * bz + w2 * cz, p = py * N + px;
            if (z <= zb[p]) continue;
            zb[p] = z;
            let nx = fx, ny = fy, nz = fz;
            if (nor) { nx = w0 * NN[i0] + w1 * NN[i1] + w2 * NN[i2]; ny = w0 * NN[i0 + 1] + w1 * NN[i1 + 1] + w2 * NN[i2 + 1]; nz = w0 * NN[i0 + 2] + w1 * NN[i1 + 2] + w2 * NN[i2 + 2]; }
            if (nz < 0.05) nz = 0.05; const l = Math.hypot(nx, ny, nz); nb[p * 3] = nx / l; nb[p * 3 + 1] = ny / l; nb[p * 3 + 2] = nz / l;
            cb[p * 4] = cr; cb[p * 4 + 1] = cg; cb[p * 4 + 2] = cbv; cb[p * 4 + 3] = code;
          }
        }
      });
      return { zb, nb, cb };
    };
    const { zb, nb, cb } = raster(S), k = S / (2 * Rt);
    // 256 → 128（2×2 平均）；輪框面的平均深度（r 0.3～0.85 輪框）
    const col = new Float32Array(H * H * 4), nrm = new Float32Array(H * H * 4), zAt = new Float32Array(H * H);
    let zs = 0, zn = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < H; x++) {
      let a = 0, c0 = 0, c1 = 0, c2 = 0, c3 = 0, n0 = 0, n1 = 0, n2 = 0, zz = 0;
      for (let s = 0; s < 4; s++) {
        const dx = s & 1, dy = s >> 1, p = (y * 2 + dy) * S + x * 2 + dx;
        if (zb[p] < -1e8) continue;
        a++; c0 += cb[p * 4]; c1 += cb[p * 4 + 1]; c2 += cb[p * 4 + 2]; c3 += cb[p * 4 + 3]; n0 += nb[p * 3]; n1 += nb[p * 3 + 1]; n2 += nb[p * 3 + 2]; zz += zb[p];
        const r = Math.hypot((x * 2 + dx + 0.5) / k - Rt, (y * 2 + dy + 0.5) / k - Rt);
        if (r > 0.3 * rim && r < 0.85 * rim) { zs += zb[p]; zn++; }
      }
      const q = (y * H + x) * 4;
      if (a) { col[q] = c0 / a; col[q + 1] = c1 / a; col[q + 2] = c2 / a; nrm[q + 3] = c3 / a; const l = Math.hypot(n0, n1, n2) || 1; nrm[q] = n0 / l; nrm[q + 1] = n1 / l; nrm[q + 2] = n2 / l; zAt[y * H + x] = zz / a; } else { nrm[q + 2] = 1; }
      col[q + 3] = a / 4;
    }
    const zFace = zn ? zs / zn : w / 2 - 0.03;
    // 斜斜的看（上下左右 15°）：輻條有深度，斜看會比正面粗（看得到側面）→ 每個有東西的像素照它離輪框面的深度往四個方向「拖」一段
    //（拖過的地方算有，顏色、法線、材質用拖它的那個像素）；完整的車停在車位上多半是斜斜的看
    const T = Math.tan((15 * Math.PI) / 180), kH = H / (2 * Rt), src = col.slice(), srcN = nrm.slice();
    for (let p = 0; p < H * H; p++) {
      if (src[p * 4 + 3] < 0.5) continue;
      const len = Math.abs(zAt[p] - zFace) * T * kH, x = p % H, y = (p / H) | 0;
      if (len < 0.5) continue;
      for (let d = 0; d < 8; d += 2) for (let st = 0.5; st <= len; st += 0.5) {
        const X = Math.round(x + D4[d] * st), Y = Math.round(y + D4[d + 1] * st);
        if (X < 0 || Y < 0 || X >= H || Y >= H) break;
        const q = (Y * H + X) * 4;
        if (col[q + 3] >= 0.5) continue;
        for (let j = 0; j < 3; j++) { col[q + j] = src[p * 4 + j]; nrm[q + j] = srcN[p * 4 + j]; }
        nrm[q + 3] = srcN[p * 4 + 3]; col[q + 3] = 0.75;
      }
    }
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    // 沒東西的像素：顏色、法線抄旁邊有東西的（邊緣內插才不會變黑）
    for (let pass = 0; pass < 2; pass++) for (let y = 0; y < H; y++) for (let x = 0; x < H; x++) {
      const q = (y * H + x) * 4; if (col[q + 3] > 0) continue;
      for (let d = 0; d < 8; d += 2) { const X = x + D4[d], Y = y + D4[d + 1]; if (X < 0 || Y < 0 || X >= H || Y >= H) continue; const r = (Y * H + X) * 4; if (col[r + 3] > 0) { for (let j = 0; j < 3; j++) { col[q + j] = col[r + j]; nrm[q + j] = nrm[r + j]; } nrm[q + 3] = nrm[r + 3]; break; } }
    }
    for (let i = 0; i < nrm.length; i += 4) for (let j = 0; j < 3; j++) nrm[i + j] = nrm[i + j] * 0.5 + 0.5;
    const tex = (arr, isCol) => { // 自己做 mipmap：顏色圖的透明度照覆蓋率放大；法線圖重新正規化
      const levels = []; let W = H, cur = arr;
      let cov0 = 0; for (let i = 3; i < arr.length; i += 4) if (arr[i] >= 0.5) cov0++; cov0 /= arr.length / 4;
      for (;;) {
        const u8 = new Uint8ClampedArray(W * W * 4); // 自己會夾在 0～255、四捨五入
        for (let i = 0; i < cur.length; i++) u8[i] = cur[i] * 255;
        levels.push({ data: new Uint8Array(u8.buffer), width: W, height: W });
        if (W === 1) break;
        const w2 = W / 2, nx = new Float32Array(w2 * w2 * 4);
        for (let y = 0; y < w2; y++) for (let x = 0; x < w2; x++) for (let j = 0; j < 4; j++) {
          nx[(y * w2 + x) * 4 + j] = (cur[((y * 2) * W + x * 2) * 4 + j] + cur[((y * 2) * W + x * 2 + 1) * 4 + j] + cur[((y * 2 + 1) * W + x * 2) * 4 + j] + cur[((y * 2 + 1) * W + x * 2 + 1) * 4 + j]) / 4;
        }
        if (isCol) {
          let lo = 1, hi = 8;
          for (let it = 0; it < 12; it++) { const m = (lo + hi) / 2; let c = 0; for (let i = 3; i < nx.length; i += 4) if (nx[i] * m >= 0.5) c++; if (c / (w2 * w2) < cov0) lo = m; else hi = m; }
          for (let i = 3; i < nx.length; i += 4) nx[i] = Math.min(1, nx[i] * hi);
        } else for (let i = 0; i < nx.length; i += 4) { const l = Math.hypot(nx[i] * 2 - 1, nx[i + 1] * 2 - 1, nx[i + 2] * 2 - 1) || 1; for (let j = 0; j < 3; j++) nx[i + j] = ((nx[i + j] * 2 - 1) / l) * 0.5 + 0.5; }
        cur = nx; W = w2;
      }
      const t = new THREE.DataTexture(levels[0].data, H, H, THREE.RGBAFormat);
      t.mipmaps = levels; t.generateMipmaps = false; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; t.needsUpdate = true;
      return t;
    };
    const out = { map: tex(col, true), nmap: tex(nrm, false), z: zFace };
    RIMTEX.set(key, out);
    return out;
  }

  // ---- 材質 ----
  // 車身（也給輪胎＋煞車用）：MeshPhysical＋類別表；背面＝車內（暗的）；珍珠只上在車漆
  function bodyMaterial(tab) {
    const m = new THREE.MeshPhysicalMaterial({ roughness: 0.5, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, tab.U);
      sh.vertexShader = `#define LOD_N ${NC}\nattribute float lodCls; uniform vec4 uLodC[LOD_N]; uniform vec4 uLodM[LOD_N]; uniform vec3 uLodE[LOD_N];\nvarying vec3 vLodC; varying vec4 vLodM; varying vec3 vLodE;\n`
        + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  { int ci = int(lodCls + 0.5); vLodC = uLodC[ci].rgb; vLodM = vec4(uLodM[ci].xyz, uLodC[ci].a); vLodE = uLodE[ci]; }`);
      sh.fragmentShader = 'uniform vec3 uLodIn;\nvarying vec3 vLodC; varying vec4 vLodM; varying vec3 vLodE;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = gl_FrontFacing ? vLodC : uLodIn;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = gl_FrontFacing ? vLodM.x : 0.9;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = gl_FrontFacing ? vLodM.y : 0.0;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  if (gl_FrontFacing) totalEmissiveRadiance += vLodE;')
        .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
  material.clearcoat *= gl_FrontFacing ? vLodM.z : 0.0;
#endif
#ifdef USE_IRIDESCENCE
  material.iridescence *= vLodM.w;
#endif`);
      if (tab.liv) { // 拉花（怪獸卡車）：左右兩張貼圖從側面投影（uv＝車子座標乘加 uLivA），只上在車漆類、y＞uLivY.x 的地方；看側面的比例跟 masks.js patchPaint 一樣
        sh.vertexShader = 'varying vec4 vLivP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLivP = vec4(position, normal.z);');
        sh.fragmentShader = 'uniform sampler2D tLivR, tLivL; uniform vec4 uLivA; uniform vec2 uLivY; varying vec4 vLivP;\n' + sh.fragmentShader.replace('diffuseColor.rgb = gl_FrontFacing ? vLodC : uLodIn;', `diffuseColor.rgb = gl_FrontFacing ? vLodC : uLodIn;
  if (gl_FrontFacing && uLivY.y > 0.5 && vLodM.w > 0.5 && vLivP.y > uLivY.x) {
    vec2 uvL = vec2(vLivP.x * uLivA.x + uLivA.y, vLivP.y * uLivA.z + uLivA.w);
    vec4 LV = vLivP.z > 0.0 ? texture2D(tLivR, uvL) : texture2D(tLivL, uvL);
    diffuseColor.rgb = mix(diffuseColor.rgb, LV.rgb, LV.a * smoothstep(0.2, 0.45, abs(vLivP.w)));
  }`);
      }
    };
    m.customProgramCacheKey = () => (tab.liv ? 'lodcar+liv' : 'lodcar');
    return m;
  }
  function glassMaterial() { // 跟 masks.js patchGlass 一樣：反光越亮越不透明；只畫正面（雙面透明要畫兩次；對面的窗從裡面看不到也沒關係，看過去是車殼裡面或外面的景）
    const m = new THREE.MeshPhysicalMaterial({ color: 0x0b0d10, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.55, side: THREE.FrontSide, depthWrite: false, envMapIntensity: 1.8 });
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
  gl_FragColor.a = clamp(diffuseColor.a + max(max(outgoingLight.r, outgoingLight.g), outgoingLight.b) * 0.9, 0.0, 1.0);`);
    };
    m.customProgramCacheKey = () => 'lodglass';
    return m;
  }
  function rimMaterial() { // 輪框：顏色貼圖＋法線貼圖（a＝跟輪框同色）；uRoll 轉輪框（貼圖座標繞中心轉 開的距離／半徑）
    const u = { uRoll: { value: 0 }, uRimCol: { value: new THREE.Color(1, 1, 1) } };
    const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, metalness: 1, alphaTest: 0.5, side: THREE.FrontSide });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'attribute float aRimK; uniform float uRoll;\n' + sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
  { float ra = uRoll * aRimK; mat2 rr = mat2(cos(ra), sin(ra), -sin(ra), cos(ra));
#ifdef USE_MAP
  vMapUv = rr * (vMapUv - 0.5) + 0.5;
#endif
#ifdef USE_NORMALMAP
  vNormalMapUv = rr * (vNormalMapUv - 0.5) + 0.5;
#endif
  }`);
      sh.fragmentShader = 'uniform vec3 uRimCol;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
  float rimCode = 1.0;
#ifdef USE_NORMALMAP
  rimCode = texture2D(normalMap, vNormalMapUv).a;
#endif
  float rimW = clamp(rimCode * 2.0 - 1.0, 0.0, 1.0), metW = clamp(rimCode * 2.0, 0.0, 1.0);
  diffuseColor.rgb *= mix(vec3(1.0), uRimCol, rimW);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(mix(0.45, 0.12, metW), roughnessFactor, rimW);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = mix(mix(0.1, 1.0, metW), metalnessFactor, rimW);');
    };
    m.customProgramCacheKey = () => 'lodrim';
    m.userData.u = u;
    return m;
  }

  // ---- 組一台 ----
  function buildLodCar(key, gltfScene, look = {}) {
    const spec = KEYS.includes(key) ? SPEC(key) : null;
    if (!spec) throw new Error('沒有這台車：' + key);
    const d = prep(gltfScene);
    const cur = { ...BASE, ...DEF(key), ...look };
    const car = new THREE.Group(); car.name = 'lodcar-' + key;
    const body = new THREE.Group(); body.name = 'body'; car.add(body);
    // 類別表（這台車自己的，換外觀只改數字）
    const tab = { C: new Float32Array(NC * 4), M: new Float32Array(NC * 4), E: new Float32Array(NC * 3) };
    tab.U = { uLodC: { value: tab.C }, uLodM: { value: tab.M }, uLodE: { value: tab.E }, uLodIn: { value: INSIDE } };
    if (spec.lod?.livery) { tab.liv = true; Object.assign(tab.U, { tLivR: { value: null }, tLivL: { value: null }, uLivA: { value: new THREE.Vector4(...spec.lod.liv) }, uLivY: { value: new THREE.Vector2(spec.lod.livY0 ?? -1e9, 0) } }); } // 怪獸卡車的拉花
    const setCls = (i, col, rough, metal, cc, paintW = 0) => { tab.C.set([col.r, col.g, col.b, paintW], i * 4); tab.M.set([rough, metal, cc, 0], i * 4); };
    for (const [r, v] of Object.entries(FIXED)) setCls(R[r], ...v);
    setCls(R.lens, ...LENS(d.mix.lens)); setCls(R.wire, ...WIRE(d.mix.wire));
    d.customs.forEach((c, j) => setCls(CUSTOM0 + j, c.col, c.rough, c.metal, c.cc));
    const RR = { ...R }; // 車子自己多的類別（spec.lod.cls：怪獸卡車的輪胎）接在 glb 的 custom 後面
    Object.entries(spec.lod?.cls || {}).forEach(([n, [h, r, m, cc = 0]], j) => { const i = Math.min(NC - 1, CUSTOM0 + d.customs.length + j); RR[n] = i; setCls(i, lin(h), r, m, cc); });
    const bm = bodyMaterial(tab), gm = glassMaterial(), rm = rimMaterial();
    const bodyMesh = new THREE.Mesh(undefined, bm), glassMesh = new THREE.Mesh(undefined, gm), wheelMesh = new THREE.Mesh(undefined, bm), rimMesh = new THREE.Mesh(undefined, rm);
    bodyMesh.name = 'lod-body'; glassMesh.name = 'lod-glass'; glassMesh.renderOrder = 2; wheelMesh.name = 'lod-wheels'; rimMesh.name = 'lod-rims';
    body.add(bodyMesh, glassMesh); car.add(wheelMesh, rimMesh);
    let geo = null, wgeo = null, glow = null;
    const applied = {};

    const paintCol = new THREE.Color();
    function paint() {
      paintCol.set(cur.paint || spec.paint);
      let f = FIN[cur.finish];
      if (!f) { // 原廠漆面：918 照顏色（P918_FINISH），其他台跟 buildCar 一樣
        const p = key === 'p918' ? P918_FINISH[paintCol.getHexString()] || [0.3, 0.12, 1] : null;
        f = p ? [p[0], p[1], p[2], p[2] < 0.5 ? 0.6 : 0.03, 0] : [0.3, spec.metal ?? 0.2, 1, 0.03, 0];
      }
      setCls(R.paint, paintCol, f[0], f[1], f[2], 1);
      bm.clearcoatRoughness = f[3];
      bm.iridescence = f[4]; bm.iridescenceIOR = 2; bm.iridescenceThicknessRange = [100, 380];
      tab.M[R.trim * 4 + 2] = 0.2 * f[2]; // 黑飾條的清漆跟著車漆（patchPaint：×0.2）
    }
    function lights() {
      tab.E.fill(0);
      for (const [i, c] of d.customs.entries()) tab.E.set([c.emi.r, c.emi.g, c.emi.b], (CUSTOM0 + i) * 3);
      if (cur.lights) { tab.E.set([2.2, 2.1, 1.9], R.lamp * 3); tab.E.set([1.6, 1.55, 1.45], R.lens * 3); } // 低的鍍鉻（chrome）不亮
      const red = cur.brake ? 3.2 : cur.lights ? 1.2 : 0;
      if (red) { tab.E.set([red, red * 0.03, red * 0.02], R.red * 3); d.customs.forEach((c, j) => { if (c.red) tab.E.set([red * 0.8, red * 0.02, red * 0.01], (CUSTOM0 + j) * 3); }); }
    }
    function rimLook() {
      const rv = cur.rim || 'chrome', l = RIM_LOOK[rv] || [rv, 1, 0.15];
      const c = new THREE.Color(l[0]);
      rm.userData.u.uRimCol.value.copy(c); rm.metalness = l[1]; rm.roughness = l[2];
      setCls(R.rim, c, l[2], l[1], 0);
    }
    function rimStyle() { // 輪框樣式（貼圖）、寬體（輪框位置）有變才重做
      if (spec.lod?.wheels) { rimMesh.visible = false; return; } // 怪獸卡車：輪框筒在輪子網格裡（rim 類），不用輪框圖
      const k = cur.rimStyle && cur.rimStyle !== 'stock' ? cur.rimStyle : 'stock';
      if (applied.rimStyle === k && applied.rimWide === applied.wideOn) return;
      const A = axles(spec, false)[0], f = rimTex(k === 'stock' ? key + ':stock' : k, k === 'stock' ? spec.wheels.style : k, A.R, A.w, A.rim);
      rm.map = f.map; rm.normalMap = f.nmap; rm.needsUpdate = true;
      if (rimMesh.geometry) rimMesh.geometry.dispose();
      rimMesh.geometry = rimGeo(spec, applied.wideOn, f.z);
      applied.rimStyle = k; applied.rimWide = applied.wideOn;
    }
    function shape() { // 套件、尾翼、寬體 → 車身網格；寬體 → 輪子往外
      const wide = cur.wide === 'on' && d.pieces.some((p) => p.wide);
      const wing = cur.wing || spec.wing, kit = cur.kit || spec.kit;
      if (!geo || applied.kit !== kit || applied.wing !== wing || applied.wideOn !== wide) {
        const g = bodyGeo(d, kit, wing, wide);
        if (geo) releaseGeo(d, geo);
        geo = g; bodyMesh.geometry = g.opaque; glassMesh.geometry = g.glass;
      }
      const own = spec.lod?.wheels ? `${kit}|${+cur.height || 0}` : ''; // 怪獸卡車：胎紋、車身高度（懸吊拉長）換了，輪子網格重做
      if (!wgeo || applied.wideOn !== wide || applied.own !== own) {
        const w = wheelGeo(key, spec, wide, own, RR);
        if (wgeo) releaseWheel(wgeo);
        wgeo = w; wheelMesh.geometry = w.geo;
      }
      applied.kit = kit; applied.wing = wing; applied.wideOn = wide; applied.own = own;
    }
    function setLook(l = {}) {
      Object.assign(cur, l);
      paint(); lights();
      setCls(R.caliper, new THREE.Color(cur.caliper || '#9da1a6'), 0.3, 0.3, 0.8);
      const acc = key === 'jesko' && cur.livery !== 'none' ? ACCENT[cur.livery] || ACCENT.red : '#17181b';
      setCls(R.accent, new THREE.Color(acc), 0.3, 0.1, 1);
      if (tab.liv) { const L = spec.lod.livery(cur.livery); tab.U.uLivY.value.y = L ? 1 : 0; if (L) { tab.U.tLivR.value = L.R; tab.U.tLivL.value = L.L; } } // 怪獸卡車的拉花（'none' → 關掉）
      rimLook();
      shape();
      rimStyle();
      gm.opacity = cur.tint === 'dark' ? 0.74 : 0.46; // 沒有車內：比完整的車（0.34／0.66）深一點
      body.position.y = +cur.height || 0;
      if (cur.glow && cur.glow !== 'none') {
        if (!glow) { const bb = d.bb; glow = neonPad(...(spec.lod?.glow || [bb.min.x, bb.max.x, Math.max(bb.max.z, -bb.min.z)])); car.add(glow); }
        glow.setColor(cur.glow); glow.visible = true;
      } else if (glow) glow.visible = false;
      if (glow) glow.scale.y = applied.wideOn ? 1 + Math.max(WIDE_PUSH.f, WIDE_PUSH.r) / (Math.max(d.bb.max.z, -d.bb.min.z) + 0.5) : 1; // 寬體：光也寬一點
      api.tris = [bodyMesh, glassMesh, wheelMesh, rimMesh].reduce((a, m) => a + (m.visible && m.geometry.index ? m.geometry.index.count / 3 : 0), 0) + (glow && glow.visible ? 2 : 0);
      return api;
    }
    const api = {
      car, body, key, tris: 0, look: cur, meshes: { body: bodyMesh, glass: glassMesh, wheels: wheelMesh, rims: rimMesh },
      setLook,
      setRoll(dist) { rm.userData.u.uRoll.value = dist; }, // 開了多遠（公尺）：輪框轉 dist／半徑
      setSquash(t) { // 第 7 批（怪獸卡車輾過去）：車頂壓扁（車身整個往下壓、稍微往外擠、玻璃破掉）；0＝原狀
        const k = t > 1 ? 1 : t > 0 ? +t : 0;
        body.scale.set(1 + 0.055 * k, 1 - 0.6 * k, 1 + 0.1 * k);
        glassMesh.visible = k <= 0.3; // 玻璃碎掉了（沒有車內：看進去是暗的車殼）
      },
      get draws() { return (rimMesh.visible ? 4 : 3) + (glow && glow.visible ? 1 : 0); },
      dispose() {
        car.removeFromParent();
        if (geo) releaseGeo(d, geo); geo = null;
        if (wgeo) releaseWheel(wgeo); wgeo = null;
        if (rimMesh.geometry) rimMesh.geometry.dispose();
        if (glow) { glow.geometry.dispose(); glow.material.dispose(); }
        bm.dispose(); gm.dispose(); rm.dispose(); // 輪框圖是大家共用的（不放掉：7 台 × 7 種樣式也才幾 MB）
      },
    };
    setLook();
    return api;
  }
  return { buildLodCar, LOD_CARS };
})();
