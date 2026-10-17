// 四層圓環車庫（Nick 2026-10-17「四層圓環車庫」；草稿 https://claude.ai/artifact/8wfsexFQSJDZGAab2h12Ra，Nick 選：中間的自動電梯（A）、後牆 6 台升降機留著（A））
// 大理石車庫（room.js）後牆的左邊（本地 −z 那頭）開一個門（z −14.75 … −11.45、高 2.38），走過一小段大理石走道，就是一棟圓圓的玻璃塔：
//   中心 (TX, TZ)＝(−23.2, −13.1)（後牆裡面 x −12.7 再往後 10.5 公尺），外面玻璃半徑 9.2、4 層樓（一層 3.2 公尺）、白色樓板、黑色直條、金色收邊
//   每層 8 格車位圍著中間的圓形電梯井（半徑 3.2）：車位方向＝i × 45 度（i＝0 朝走道），一樓 i＝0 那格是開出去的車道 → 一樓 7 格＋二到四樓 8 格＝31 格
//   車頭朝外停（從外面看得到車頭）；電梯＝一個會轉的圓台（半徑 2.9）：升到那層、轉過去對著車位、把車拉進來（或推出去）、轉回來車頭朝走道、降到一樓
// 為什麼門在左後角：後牆中間是 6 台升降機（坑一路排到 z ±10.77）；右後角（+z）那邊車庫街南排 1 號（x −370）的塔會壓到 x −345 那條路，左後角每一間都放得下
// 本地座標跟 room.js 一樣：x 往鐵捲門（+x 出去）、y 上、z＝車頭朝門時車子的右邊；地板 y 0；這個 group 掛在 room.group 底下（車庫頁在原點、村子裡跟著你家搬）
// buildRingGarage(renderer, { exterior, marble }) → {
//   group（掛到 room.group）, floors[4]（每層的車位 Group：cull 照鏡頭開關）, bays（31 格，跟 RING_BAYS 一樣）, platform（電梯的圓台 Group）, doorPanel（門關著的樣子：房間裡面不畫的時候蓋住門洞）
//   cars[31]、put(i, obj, name)、take(i)：跟 room.js 升降機的 put／take 一樣（obj＝車，原點＝車底中間、車頭朝 +x；掛上去位置、轉角歸零＝車頭朝外）
//   lift：{ busy, y, rot, car（圓台上的車）, phase }；load(obj, pose)：車放到圓台上（pose＝本地 { x, z, heading }，留在原地）；unload() → 圓台上的車拿下來（還在原地）
//   fetch(i, onDone)：電梯去拿第 i 格的車 → 圓台在一樓、車頭朝走道（onDone(obj)，車還掛在圓台上：頁面 unload 再擺）；store(i, onDone)：圓台上的車停到第 i 格（onDone()）
//   update(dt)（在動就 true）、onLift(what)（頁面設：'start'／'stop'）
//   colliders()：本地的碰撞（玻璃牆一圈 23 段、走道兩邊的牆、操作台、電梯不在一樓或在動的時候整個井）；ceilingAt(x, z)：頭上多高（一樓 2.9、走道 2.38，外面 Infinity）
//   inside(x, z, m)：在塔裡面（或走道）；zones：{ panel（站在這裡 →「叫車」）, pad（圓台：車停在這裡下車 → 電梯停上去）}；spots：{ deliver（一樓圓台上，車頭朝走道）}
//   cull(camera)：照鏡頭開關每一層的車（在大廳裡：門洞看得到才畫一樓；在塔裡：那一層；外面：被車庫擋住的那幾層不畫；150 公尺外都不畫）→ 回傳 vis[4]
//   parts：別人那幾間的外殼（village 的車庫街，InstancedMesh）要的 [{ geometry, material, name }]（多一片關著的門）
//   dispose()
// }
// 效能：外殼 4 個 draw call（白色樓板＋走道＋操作台＋黑色直條一個網格、金色、玻璃、燈）＋電梯圓台 1 個；車是輕量車（一台 4 個 draw call）只畫看得到的那幾層
//   幾何、材質、貼圖：一個網格合併好（每一格不 new 東西：cull、update 都重用向量）
// 打包（build-art.mjs／build-app.mjs 拿掉 import／export）：最上層只有 RING_SIZE、RING_BAYS、buildRingGarage、ringFoot
import * as THREE from 'three';

export const RING_SIZE = { TX: -23.2, TZ: -13.1, RO: 9.2, RI: 3.2, RP: 2.9, FH: 3.2, NF: 4, SLAB: 0.3, RB: 6.15, DZ0: -14.75, DZ1: -11.45, DH: 2.38, VX0: -14.3, VX1: -13.0, VW: 0.2, PANEL_A: 0.42 };
// 31 格（停車的順序＝id：一樓先（從大廳的門看得到），再往上）：{ id, f（第幾層，0＝一樓）, i（方向 i × 45 度）, a（角度）, x, y, z（車子中心，本地）, heading（車頭朝外）}
export const RING_BAYS = (() => {
  const { TX, TZ, RB, FH, NF } = RING_SIZE, out = [];
  for (let f = 0; f < NF; f++) for (let i = 0; i < 8; i++) {
    if (f === 0 && i === 0) continue; // 一樓朝走道那格是車道
    const a = (i * Math.PI) / 4;
    out.push({ id: out.length, f, i, a, x: +(TX + RB * Math.cos(a)).toFixed(4), y: f * FH, z: +(TZ + RB * Math.sin(a)).toFixed(4), heading: -a });
  }
  return out;
})();
// 塔在世界上佔哪裡（village.js 用：每一間車庫後面的空地）：lot＝{ x, z, heading }（room 的原點、本地 +x 朝鐵捲門外）→ { x, z, r（玻璃外面一點）, vest（走道的長方形）}
export function ringFoot(lot) {
  const { TX, TZ, RO, VX0, VX1, DZ0, DZ1, VW } = RING_SIZE, c = Math.cos(lot.heading), s = Math.sin(lot.heading);
  const w = (lx, lz) => [lot.x + lx * c + lz * s, lot.z - lx * s + lz * c], p = w(TX, TZ), v = w((VX0 + VX1) / 2, (DZ0 + DZ1) / 2);
  return { x: p[0], z: p[1], r: RO + 0.35, vest: { x: v[0], z: v[1], hx: (VX1 - VX0) / 2 + 0.1, hz: (DZ1 - DZ0) / 2 + VW + 0.05, rot: lot.heading } };
}

export const { buildRingGarage } = (() => {
  const { TX, TZ, RO, RI, RP, FH, NF, SLAB, RB, DZ0, DZ1, DH, VX0, VX1, VW, PANEL_A } = RING_SIZE;
  const TOPY = NF * FH, ZC = (DZ0 + DZ1) / 2, ZH = (DZ1 - DZ0) / 2;
  const GAP = Math.asin((ZH + VW) / RO); // 一樓玻璃留給走道的缺口（半個角度）
  // 合併網格：位置、法線、貼圖座標（大理石：一張 3.2 公尺）、頂點色
  function mesher() {
    const P = [], N = [], UV = [], C = [], I = [];
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    const m = {
      // 四邊形 a b c d（從正面看逆時針）；uv＝四個角的貼圖座標（不給：照 world 尺寸自己算）
      quad(a, b, c, d, col, uv) {
        const k = P.length / 3;
        n.subVectors(c, a).cross(v.subVectors(d, b)).normalize(); // 對角線：退化成三角形（圓心那一圈）也對
        const us = uv || (Math.abs(n.y) > 0.7 ? [a, b, c, d].map((p) => [p.x / 3.2, p.z / 3.2]) : (() => { const w = b.distanceTo(a), h = d.distanceTo(a), u0 = (a.x + a.z) / 3.2; return [[u0, a.y / 3.2], [u0 + w / 3.2, b.y / 3.2], [u0 + w / 3.2, (b.y + h) / 3.2], [u0, (a.y + h) / 3.2]]; })());
        [a, b, c, d].forEach((p, i) => { P.push(p.x, p.y, p.z); N.push(n.x, n.y, n.z); UV.push(us[i][0], us[i][1]); C.push(col[0], col[1], col[2]); });
        I.push(k, k + 1, k + 2, k, k + 2, k + 3);
      },
      // 任何 BufferGeometry（套 M、顏色 col、貼圖座標 uvScale 倍；uvFix＝固定的一點：不要大理石紋）
      geo(g, M, col, uvFix) {
        if (g.index) g = g.toNonIndexed();
        const k = P.length / 3, p = g.attributes.position, nn = g.attributes.normal, uv = g.attributes.uv, nm = new THREE.Matrix3().getNormalMatrix(M);
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(M); P.push(v.x, v.y, v.z);
          n.fromBufferAttribute(nn, i).applyMatrix3(nm).normalize(); N.push(n.x, n.y, n.z);
          if (uvFix) UV.push(uvFix[0], uvFix[1]); else UV.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
          C.push(col[0], col[1], col[2]); I.push(k + i);
        }
        g.dispose();
      },
      // 長方體（軸對齊再套 M）：s＝[寬 x, 高 y, 深 z]
      box(M, s, col, uvFix = FLAT) { m.geo(new THREE.BoxGeometry(s[0], s[1], s[2]), M, col, uvFix); },
      // 水平的圓環（r0 … r1，角度 t0 … t1；up＝面朝上）
      annulus(y, r0, r1, col, { t0 = 0, t1 = Math.PI * 2, seg = 64, up = true, cx = TX, cz = TZ } = {}) {
        const ns = Math.max(3, Math.round((seg * (t1 - t0)) / (Math.PI * 2)));
        for (let s = 0; s < ns; s++) {
          const a0 = t0 + ((t1 - t0) * s) / ns, a1 = t0 + ((t1 - t0) * (s + 1)) / ns;
          const p = (r, a) => new THREE.Vector3(cx + r * Math.cos(a), y, cz + r * Math.sin(a));
          const A = p(r0, a0), B = p(r1, a0), Cc = p(r1, a1), D = p(r0, a1);
          if (up) m.quad(A, D, Cc, B, col); else m.quad(A, B, Cc, D, col); // 角度往 +z 轉：從上面看 x→z 是順時針（three 的 y 朝上）
        }
      },
      // 直的圓筒面（半徑 r、y0 … y1、角度 t0 … t1；out＝面朝外）
      band(r, y0, y1, col, { t0 = 0, t1 = Math.PI * 2, seg = 64, out = true, cx = TX, cz = TZ } = {}) {
        const ns = Math.max(2, Math.round((seg * (t1 - t0)) / (Math.PI * 2)));
        for (let s = 0; s < ns; s++) {
          const a0 = t0 + ((t1 - t0) * s) / ns, a1 = t0 + ((t1 - t0) * (s + 1)) / ns;
          const A = new THREE.Vector3(cx + r * Math.cos(a0), y0, cz + r * Math.sin(a0)), B = new THREE.Vector3(cx + r * Math.cos(a1), y0, cz + r * Math.sin(a1));
          const u0 = (a0 * r) / 3.2, u1 = (a1 * r) / 3.2, uv = [[u0, y0 / 3.2], [u1, y0 / 3.2], [u1, y1 / 3.2], [u0, y1 / 3.2]];
          const A1 = A.clone().setY(y1), B1 = B.clone().setY(y1);
          if (out) m.quad(B, A, A1, B1, col, [uv[1], uv[0], uv[3], uv[2]]); else m.quad(A, B, B1, A1, col, uv);
        }
      },
      get empty() { return !I.length; },
      build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
        g.setIndex(I); g.computeBoundingSphere(); return g;
      },
    };
    return m;
  }
  const FLAT = [0.031, 0.047]; // 貼圖上沒有紋路的一點（純色的東西：黑框、白漆）
  const T4 = (x, y, z, ry = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
  // 顏色（線性）
  const WHITE = [0.86, 0.86, 0.85], SLABC = [0.8, 0.8, 0.79], UNDER = [0.72, 0.72, 0.71], BLACK = [0.012, 0.012, 0.014], NERO = [0.05, 0.05, 0.055], LINE = [0.95, 0.72, 0.2];
  const PIT = [0.05, 0.05, 0.055], HAZ = [0.85, 0.62, 0.05];
  const GEO = {}; // 外殼的幾何（兩個 buildRingGarage 共用：車庫頁、村子各一棟）
  function shellGeos() {
    if (GEO.shell) return GEO;
    const S = mesher(), G = mesher(), GL = mesher(), L = mesher(), K = mesher();
    // ---- 一樓地板（白大理石）＋電梯井（一樓：淺坑，圓台在一樓的時候蓋住）----
    S.annulus(0.006, RP + 0.12, RO + 0.3, SLABC, { seg: 96 });
    S.annulus(-0.22, 0, RP + 0.12, PIT, { seg: 48 });
    S.band(RP + 0.12, -0.22, 0.006, [0.18, 0.18, 0.19], { out: false, seg: 48 });
    S.annulus(0.009, RP + 0.12, RP + 0.24, HAZ, { seg: 48 }); // 坑口一圈黃色
    // 一樓外面一圈黑色牆腳
    S.band(RO + 0.3, 0, 0.35, NERO, { seg: 96, t0: GAP, t1: Math.PI * 2 - GAP });
    S.annulus(0.35, RO - 0.02, RO + 0.3, NERO, { seg: 96, t0: GAP, t1: Math.PI * 2 - GAP }); // 牆腳上面的蓋
    // ---- 二到四樓的樓板（中間挖電梯井）、屋頂 ----
    for (let f = 1; f <= NF; f++) {
      const y = f * FH, top = f === NF;
      S.annulus(y + (top ? SLAB : 0), top ? 0 : RI, RO + 0.3, top ? [0.62, 0.62, 0.61] : SLABC, { seg: 96 }); // 樓板上面（屋頂：灰色防水）
      S.annulus(y - SLAB, top ? 0 : RI, RO + 0.3, UNDER, { seg: 96, up: false }); // 底下（天花板）
      S.band(RO + 0.3, y - SLAB, y + (top ? SLAB : 0), WHITE, { seg: 96 }); // 外緣
      if (!top) S.band(RI, y - SLAB, y, WHITE, { seg: 48, out: false }); // 電梯井的邊（朝井裡）
      G.band(RO + 0.31, y - 0.06 + (top ? SLAB : 0), y + (top ? SLAB : 0), [1, 1, 1], { seg: 96 }); // 金色收邊
      // 天花板一圈燈（車位上面）、電梯井邊一圈燈
      L.annulus(y - SLAB - 0.004, 7.25, 7.34, [5.2, 4.5, 3.6], { seg: 96, up: false });
      if (!top) L.annulus(y - SLAB - 0.004, RI + 0.18, RI + 0.24, [4.2, 3.8, 3.2], { seg: 48, up: false });
    }
    // 屋頂：金色的冠（女兒牆）
    G.band(RO + 0.36, TOPY + SLAB, TOPY + SLAB + 0.42, [1, 1, 1], { seg: 96 });
    G.band(RO + 0.06, TOPY + SLAB, TOPY + SLAB + 0.42, [1, 1, 1], { seg: 96, out: false });
    G.annulus(TOPY + SLAB + 0.42, RO + 0.06, RO + 0.36, [1, 1, 1], { seg: 96 });
    // ---- 車位的線（每層，金黃色）：兩格中間一條（從電梯井邊到玻璃）----
    for (let f = 0; f < NF; f++) {
      const y = f * FH + (f ? 0.004 : 0.01);
      for (let k = 0; k < 8; k++) {
        const a = Math.PI / 8 + (k * Math.PI) / 4, r0 = (f ? RI : RP + 0.24) + 0.3, r1 = RO - 0.4, w = 0.045;
        const cs = Math.cos(a), sn = Math.sin(a), px = -sn * w, pz = cs * w;
        const A = new THREE.Vector3(TX + cs * r0 - px, y, TZ + sn * r0 - pz), B = new THREE.Vector3(TX + cs * r1 - px, y, TZ + sn * r1 - pz);
        const Cc = new THREE.Vector3(TX + cs * r1 + px, y, TZ + sn * r1 + pz), D = new THREE.Vector3(TX + cs * r0 + px, y, TZ + sn * r0 + pz);
        S.quad(A, D, Cc, B, LINE, [FLAT, FLAT, FLAT, FLAT]);
      }
    }
    // ---- 玻璃：一樓留走道的缺口，二樓以上一整圈；黑色直條（每 15 度一根，一樓缺口那兩根沒有）----
    GL.band(RO, 0.35, FH - SLAB, [1, 1, 1], { seg: 96, t0: GAP, t1: Math.PI * 2 - GAP });
    for (let f = 1; f < NF; f++) GL.band(RO, f * FH, (f + 1) * FH - SLAB, [1, 1, 1], { seg: 96 });
    for (let k = 0; k < 24; k++) {
      const a = (k + 0.5) * (Math.PI / 12), y0 = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < GAP + 0.05 ? FH - SLAB : 0, h = TOPY - y0;
      S.box(T4(TX + (RO + 0.05) * Math.cos(a), y0 + h / 2, TZ + (RO + 0.05) * Math.sin(a), -a), [0.16, h, 0.1], BLACK);
    }
    // ---- 電梯井的柱子（二樓以上：一樓沒有，車子直直開出去不會撞到）：8 根金色細柱（在兩格中間）----
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 8 + (k * Math.PI) / 4, r = RI - 0.12;
      G.geo(new THREE.CylinderGeometry(0.06, 0.06, TOPY - (FH - SLAB), 8), T4(TX + r * Math.cos(a), (TOPY + FH - SLAB) / 2, TZ + r * Math.sin(a)), [1, 1, 1], FLAT);
    }
    // ---- 走道（後牆外面 x −13 … −14.3）：大理石地板、兩邊牆、天花板（門高 2.38）、上面的屋頂；黑框＋金線（塔那邊的口）----
    {
      const x0 = VX0, x1 = VX1, za = DZ0 - VW, zb = DZ1 + VW, H2 = DH + 0.32;
      S.quad(new THREE.Vector3(x0, 0.006, zb), new THREE.Vector3(x1, 0.006, zb), new THREE.Vector3(x1, 0.006, za), new THREE.Vector3(x0, 0.006, za), SLABC);
      for (const [z0, z1, inner] of [[za, DZ0, DZ0], [DZ1, zb, DZ1]]) {
        S.box(T4((x0 + x1) / 2, H2 / 2, (z0 + z1) / 2), [x1 - x0, H2, z1 - z0], WHITE, null);
        S.box(T4((x0 + x1) / 2, 0.06, inner + (inner === DZ0 ? 0.004 : -0.004)), [x1 - x0, 0.12, 0.012], NERO); // 牆腳
      }
      S.box(T4((x0 + x1) / 2, DH + 0.16, ZC), [x1 - x0, 0.32, zb - za], WHITE, null); // 天花板＋屋頂
      L.quad(new THREE.Vector3(x0 + 0.2, DH - 0.004, ZC - 0.05), new THREE.Vector3(x1 - 0.2, DH - 0.004, ZC - 0.05), new THREE.Vector3(x1 - 0.2, DH - 0.004, ZC + 0.05), new THREE.Vector3(x0 + 0.2, DH - 0.004, ZC + 0.05), [4.6, 4, 3.2]); // 天花板的燈（朝下）
      for (const z of [DZ0 - 0.06, DZ1 + 0.06]) S.box(T4(x0 - 0.03, DH / 2, z), [0.08, DH + 0.12, 0.12], BLACK); // 塔那邊的黑框
      S.box(T4(x0 - 0.03, DH + 0.06, ZC), [0.08, 0.12, zb - za], BLACK);
      G.box(T4(x0 - 0.075, DH + 0.15, ZC), [0.02, 0.04, zb - za], [1, 1, 1]); // 金線
    }
    // ---- 操作台（一樓，走道進來右手邊：跟升降機的操作柱一樣的白柱、黃銅環、斜面操作盒、綠燈）----
    {
      const r = 7.6, a = PANEL_A, px = TX + r * Math.cos(a), pz = TZ + r * Math.sin(a), ry = -a + Math.PI; // 操作盒面向塔中間（站的人從裡面看）
      S.box(T4(px, 0.015, pz), [0.2, 0.03, 0.2], BLACK);
      S.box(T4(px, 0.52, pz), [0.12, 1.0, 0.12], [0.84, 0.84, 0.83]);
      G.box(T4(px, 0.94, pz), [0.135, 0.015, 0.135], [1, 1, 1]);
      const M = T4(px, 1.07, pz, ry).multiply(new THREE.Matrix4().makeRotationZ(-0.6));
      S.box(M, [0.15, 0.22, 0.26], [0.84, 0.84, 0.83]);
      const sM = M.clone().multiply(new THREE.Matrix4().makeTranslation(0.076, 0, 0));
      L.geo(new THREE.PlaneGeometry(0.2, 0.15).rotateY(Math.PI / 2), sM, [0.6, 1.4, 2.2], FLAT); // 螢幕（藍）
      L.geo(new THREE.SphereGeometry(0.02, 10, 6), M.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.11, 0.08)), [0.25, 2.6, 0.9], FLAT); // 綠燈
    }
    // ---- 關著的門（別人那幾間、你家大廳不畫的時候）：後牆門洞外面一片深色玻璃 ----
    K.quad(new THREE.Vector3(VX1 - 0.02, 0, DZ1), new THREE.Vector3(VX1 - 0.02, 0, DZ0), new THREE.Vector3(VX1 - 0.02, DH, DZ0), new THREE.Vector3(VX1 - 0.02, DH, DZ1), [0.02, 0.025, 0.03], [FLAT, FLAT, FLAT, FLAT]);
    K.quad(new THREE.Vector3(VX1 - 0.02, 0, DZ0), new THREE.Vector3(VX1 - 0.02, 0, DZ1), new THREE.Vector3(VX1 - 0.02, DH, DZ1), new THREE.Vector3(VX1 - 0.02, DH, DZ0), [0.02, 0.025, 0.03], [FLAT, FLAT, FLAT, FLAT]);
    Object.assign(GEO, { shell: S.build(), gold: G.build(), glass: GL.build(), lights: L.build(), door: K.build() });
    // 電梯的圓台：深色大理石面、金色邊、一個白色箭頭（車頭朝哪裡）
    const Pm = mesher();
    Pm.annulus(0, 0, RP, NERO, { seg: 48, cx: 0, cz: 0 });
    Pm.band(RP, -0.2, 0, [0.5, 0.36, 0.12], { seg: 48, cx: 0, cz: 0 });
    Pm.annulus(0.003, RP - 0.12, RP - 0.04, [0.9, 0.66, 0.22], { seg: 48, cx: 0, cz: 0 });
    for (const [x0, x1, w0, w1] of [[1.5, 2.1, 0.18, 0.18], [2.1, 2.55, 0.42, 0]]) Pm.quad(new THREE.Vector3(x0, 0.004, -w0), new THREE.Vector3(x0, 0.004, w0), new THREE.Vector3(x1, 0.004, w1), new THREE.Vector3(x1, 0.004, -w1 - 0.0001), [0.8, 0.8, 0.78], [FLAT, FLAT, FLAT, FLAT]);
    GEO.plat = Pm.build();
    { // 別人那幾間（InstancedMesh）：外殼＋停在一樓的圓台合成一個網格（少一個 draw call）
      const A = GEO.shell, B = GEO.plat.clone().translate(TX, 0, TZ), g = new THREE.BufferGeometry(), n = A.attributes.position.count;
      for (const k of ['position', 'normal', 'uv', 'color']) { const a = A.attributes[k], b = B.attributes[k], arr = new Float32Array(a.array.length + b.array.length); arr.set(a.array); arr.set(b.array, a.array.length); g.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize)); }
      g.setIndex([...A.index.array, ...[...B.index.array].map((i) => i + n)]); g.computeBoundingSphere(); B.dispose(); GEO.shellPlat = g;
    }
    return GEO;
  }
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _f = new THREE.Frustum(), _pt = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); return a < 0 ? a + Math.PI : a - Math.PI; };

  function buildRingGarage(renderer, { exterior = false, marble = null } = {}) {
    const G0 = shellGeos(), trash = [];
    const group = new THREE.Group(); group.name = 'ringGarage';
    let tex = null;
    if (marble) { tex = new THREE.CanvasTexture(marble); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); trash.push(tex); }
    const shellMat = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.32, metalness: 0 });
    const goldMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.78, 0.55, 0.2), roughness: 0.38, metalness: exterior ? 0.35 : 0.85 }); // 村子沒有環境貼圖：金屬感低一點（不然黑黑的）
    const glassMat = exterior
      ? new THREE.MeshStandardMaterial({ color: 0x9cc7e0, transparent: true, opacity: 0.26, roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: 0xdfe8ee, emissive: 0xb9c9d6, emissiveIntensity: 0.9, transparent: true, opacity: 0.92, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false }); // 車庫頁：外面是黑的，玻璃做成亮亮的霧面（白天的光）
    const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const doorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0 });
    trash.push(shellMat, goldMat, glassMat, lightMat, doorMat);
    const shell = new THREE.Mesh(G0.shell, shellMat), gold = new THREE.Mesh(G0.gold, goldMat), glass = new THREE.Mesh(G0.glass, glassMat), lights = new THREE.Mesh(G0.lights, lightMat);
    shell.name = 'ringShell'; gold.name = 'ringGold'; glass.name = 'ringGlass'; lights.name = 'ringLights'; glass.renderOrder = 3;
    const doorPanel = new THREE.Mesh(G0.door, doorMat); doorPanel.name = 'ringDoor'; doorPanel.visible = false;
    group.add(shell, gold, glass, lights, doorPanel);
    // 每一層的車位：Group（cull 開關）；每格一個 Group（車子掛上去＝車頭朝外）
    const floors = [], bayG = [];
    for (let f = 0; f < NF; f++) { const g = new THREE.Group(); g.name = 'ringFloor' + (f + 1); floors.push(g); group.add(g); }
    for (const b of RING_BAYS) { const g = new THREE.Group(); g.name = 'ringBay' + (b.id + 1); g.position.set(b.x, b.y, b.z); g.rotation.y = b.heading; floors[b.f].add(g); bayG.push(g); }
    const cars = Array(RING_BAYS.length).fill(null), names = Array(RING_BAYS.length).fill(null);
    // 電梯的圓台
    const platform = new THREE.Group(); platform.name = 'ringLift'; platform.position.set(TX, 0, TZ); group.add(platform);
    const platMesh = new THREE.Mesh(G0.plat, shellMat); platMesh.name = 'ringLiftDeck'; platform.add(platMesh);
    const lift = { busy: false, y: 0, rot: 0, car: null, phase: '', floor: 0 };
    const A = { t: 0, T: 1, y0: 0, y1: 0, r0: 0, r1: 0, x0: 0, x1: 0, h0: 0, h1: 0, bay: null, mode: '', onDone: null, q: [] };
    const place = () => { platform.position.y = lift.y; platform.rotation.y = lift.rot; };
    const api = { group, floors, bays: RING_BAYS, platform, doorPanel, cars, lift, onLift: null, size: RING_SIZE };
    api.put = (i, obj, name) => {
      const old = cars[i];
      if (typeof obj === 'string') { name = obj; obj = null; }
      if (obj?.isObject3D) { if (old?.isObject3D && old !== obj && old.parent === bayG[i]) old.removeFromParent(); bayG[i].add(obj); obj.position.set(0, 0, 0); obj.rotation.set(0, 0, 0); }
      cars[i] = obj || old || true; names[i] = name != null ? String(name) : obj?.name || ''; return api;
    };
    api.take = (i) => { const o = cars[i]; if (o?.isObject3D && o.parent === bayG[i]) o.removeFromParent(); cars[i] = null; names[i] = null; return o?.isObject3D ? o : null; };
    // 車放到圓台上（pose＝本地 { x, z, heading }：留在原地，store 的時候才拉到中間）
    api.load = (obj, pose) => {
      if (!obj?.isObject3D) return false;
      platform.add(obj);
      const c = Math.cos(-lift.rot), s = Math.sin(-lift.rot), dx = pose.x - TX, dz = pose.z - TZ;
      obj.position.set(dx * c + dz * s, 0, -dx * s + dz * c); obj.rotation.set(0, wrap((pose.heading || 0) - lift.rot), 0);
      lift.car = obj; return true;
    };
    api.unload = () => { const o = lift.car; lift.car = null; if (o?.parent === platform) o.removeFromParent(); return o; };
    // 一段一段的動作：['move', 秒, y, rot]、['slide', 秒, x0, x1]（圓台上的車沿著圓台的 x 滑）、['center', 秒]（車拉到中間、轉正）、['call', fn]
    const run = (steps, onDone) => { A.q = steps; A.onDone = onDone || null; lift.busy = true; next(); api.onLift?.('start'); };
    function next() {
      const s = A.q.shift();
      if (!s) { lift.busy = false; lift.phase = ''; const f = A.onDone; A.onDone = null; api.onLift?.('stop'); f?.(lift.car); return; }
      A.t = 0; lift.phase = s[0];
      if (s[0] === 'move') { A.T = s[1]; A.y0 = lift.y; A.y1 = s[2]; A.r0 = lift.rot; A.r1 = lift.rot + wrap(s[3] - lift.rot); }
      else if (s[0] === 'slide' || s[0] === 'center') { A.T = s[1]; const o = lift.car; A.x0 = o ? o.position.x : 0; A.z0 = o ? o.position.z : 0; A.h0 = o ? o.rotation.y : 0; A.x1 = s[0] === 'slide' ? s[3] : 0; if (s[0] === 'slide' && o) o.position.x = A.x0 = s[2]; A.h1 = s[0] === 'center' ? (Math.abs(wrap(A.h0)) < Math.PI / 2 ? 0 : Math.PI) : A.h0; if (s[0] === 'center') A.h1 = A.h0 + wrap(A.h1 - A.h0); }
      else if (s[0] === 'call') { s[1](); next(); }
    }
    const moveT = (y0, y1, dr) => Math.max(1.0, Math.abs(y1 - y0) / 2.4 + 0.5, Math.abs(dr) / 1.4);
    // 去拿第 i 格的車：上去（轉過去對著那格）→ 拉進來 → 下來（車頭朝走道）
    api.fetch = (i, onDone) => {
      const b = RING_BAYS[i]; if (!b || lift.busy || lift.car) return false;
      const o = cars[i];
      run([['move', moveT(lift.y, b.y, wrap(-b.a - lift.rot)), b.y, -b.a],
        ['call', () => { const obj = api.take(i) || new THREE.Group(); platform.add(obj); obj.position.set(RB, 0, 0); obj.rotation.set(0, 0, 0); lift.car = obj; }],
        ['slide', 1.6, RB, 0],
        ['move', moveT(b.y, 0, b.a), 0, 0]], (obj) => onDone?.(o?.isObject3D ? obj : null));
      return true;
    };
    // 圓台上的車停到第 i 格：拉到中間轉正 → 上去（車頭對著那格）→ 推出去 → 下來（空的）
    api.store = (i, onDone) => {
      const b = RING_BAYS[i], o = lift.car; if (!b || lift.busy || !o || cars[i]) return false;
      let hc = 0;
      run([['center', 0.8], ['call', () => { hc = Math.abs(wrap(o.rotation.y)) < Math.PI / 2 ? 0 : Math.PI; o.rotation.y = hc; A.q[0][3] = -b.a - hc; A.q[0][1] = moveT(lift.y, b.y, wrap(-b.a - hc - lift.rot)); }],
        ['move', 1, b.y, -b.a],
        ['call', () => { A.q[0][3] = hc ? -RB : RB; }],
        ['slide', 1.6, 0, RB],
        ['call', () => { lift.car = null; o.removeFromParent(); api.put(i, o, names[i]); }],
        ['move', moveT(b.y, 0, b.a), 0, 0]], () => onDone?.());
      return true;
    };
    api.update = (dt) => {
      if (!lift.busy) return false;
      dt = Math.max(0, Math.min(0.1, +dt || 0)); A.t += dt;
      const k = ease(A.t / A.T), o = lift.car;
      if (lift.phase === 'move') { lift.y = A.y0 + (A.y1 - A.y0) * k; lift.rot = A.r0 + (A.r1 - A.r0) * k; place(); }
      else if (lift.phase === 'slide' && o) o.position.x = A.x0 + (A.x1 - A.x0) * k;
      else if (lift.phase === 'center' && o) { o.position.x = A.x0 * (1 - k); o.position.z = A.z0 * (1 - k); o.rotation.y = A.h0 + (A.h1 - A.h0) * k; }
      if (A.t >= A.T) { if (lift.phase === 'move') { lift.rot = wrap(lift.rot); place(); } next(); }
      lift.floor = Math.round(lift.y / FH);
      return lift.busy;
    };
    // 直接放好（不動畫）：車庫頁、出門前
    api.snap = () => { A.q = []; A.onDone = null; lift.busy = false; lift.phase = ''; lift.y = 0; lift.rot = 0; place(); };
    // ---- 碰撞（本地）：玻璃牆一圈（23 段，走道那邊留口）、走道兩邊的牆、操作台；電梯不在一樓（或在動）：整個井擋起來 ----
    const WALL = [];
    { const n = 23, t0 = GAP, t1 = Math.PI * 2 - GAP, da = (t1 - t0) / n;
      for (let k = 0; k < n; k++) { const a = t0 + (k + 0.5) * da, r = RO + 0.1; WALL.push({ t: 'box', x: TX + r * Math.cos(a), z: TZ + r * Math.sin(a), hx: r * Math.tan(da / 2) + 0.12, hz: 0.18, rot: -a - Math.PI / 2, h: TOPY + 0.7 }); }
      for (const [z0, z1] of [[DZ0 - VW, DZ0], [DZ1, DZ1 + VW]]) WALL.push({ t: 'box', x: (VX0 - 0.2 + VX1) / 2, z: (z0 + z1) / 2, hx: (VX1 - VX0 + 0.2) / 2, hz: (z1 - z0) / 2, rot: 0, h: DH + 0.32 });
      WALL.push({ t: 'circle', x: TX + 7.6 * Math.cos(PANEL_A), z: TZ + 7.6 * Math.sin(PANEL_A), r: 0.16, h: 1.2 }); }
    const SHAFT = { t: 'circle', x: TX, z: TZ, r: RP + 0.15, h: TOPY };
    api.liftDown = () => !lift.busy && lift.y === 0;
    api.colliders = () => { const out = WALL.map((c) => ({ ...c })); if (!api.liftDown()) out.push({ ...SHAFT }); return out; };
    api.inside = (x, z, m = 0) => Math.hypot(x - TX, z - TZ) < RO - m || (x > VX0 - 0.3 && x < VX1 + 0.3 && Math.abs(z - ZC) < ZH - m); // 走道＋後牆的厚度（到 x −12.7）
    api.ceilingAt = (x, z) => (Math.hypot(x - TX, z - TZ) < RO + 0.3 ? FH - SLAB : x > VX0 - 0.3 && x < VX1 + 0.3 && Math.abs(z - ZC) < ZH + VW ? DH : Infinity);
    const sr = 6.55;
    api.zones = { panel: { x: TX + sr * Math.cos(PANEL_A), z: TZ + sr * Math.sin(PANEL_A), hx: 0.55, hz: 0.55, rot: 0 }, pad: { x: TX, z: TZ, r: 1.1 }, tower: { x: TX, z: TZ, r: RO } };
    api.spots = { deliver: { x: TX, z: TZ, heading: 0 }, stand: { x: TX + sr * Math.cos(PANEL_A), z: TZ + sr * Math.sin(PANEL_A), heading: -PANEL_A + Math.PI } };
    // ---- 照鏡頭開關每一層的車 ----
    const vis = [true, true, true, true], DOOR = [[-12.7, 0.1, DZ0], [-12.7, 0.1, DZ1], [-12.7, DH, DZ0], [-12.7, DH, DZ1]];
    const RX0 = -13, RX1 = 5.3, RZ = 16, RTOP = 7.2; // room.js 的外牆（擋住後面的塔）
    const blocked = (cx, cy, cz, px, py, pz) => { // 鏡頭 → 塔裡的點，中間有沒有被大理石車庫擋住（只看後牆那一面：鏡頭在車庫前面）
      if (cx <= RX0) return false;
      const t = (RX0 - cx) / (px - cx); if (t <= 0 || t >= 1) return false;
      return Math.abs(cz + (pz - cz) * t) < RZ && cy + (py - cy) * t < RTOP;
    };
    api.cull = (camera) => {
      const par = group.parent; if (!par) return vis;
      par.updateMatrixWorld(); _v.setFromMatrixPosition(camera.matrixWorld); _w.copy(_v); par.worldToLocal(_v);
      const cx = _v.x, cy = _v.y, cz = _v.z, d = Math.hypot(cx - TX, cz - TZ);
      const inHall = cx > -12.7 && cx < 5 && Math.abs(cz) < 15.7 && cy < 6;
      if (d < RO + 0.2 && cy < TOPY) { const f = Math.max(0, Math.min(NF - 1, Math.floor(cy / FH))); for (let k = 0; k < NF; k++) vis[k] = k === f || (f > 0 && Math.abs(k - f) === 1); }
      else if (inHall || (cx > VX0 - 0.4 && cx < 5 && Math.abs(cz) < 16 && cy < RTOP)) { // 大廳（或走道）：門洞在畫面裡才畫一樓
        camera.updateMatrixWorld(); _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _f.setFromProjectionMatrix(_m);
        let see = cx < -12.4; for (let k = 0; k < 4 && !see; k++) { _pt[k].set(...DOOR[k]).applyMatrix4(par.matrixWorld); see = _f.containsPoint(_pt[k]); }
        vis[0] = see; vis[1] = vis[2] = vis[3] = false;
      } else if (d > 150) vis[0] = vis[1] = vis[2] = vis[3] = false;
      else for (let f = 0; f < NF; f++) { const py = f * FH + 1; vis[f] = !(blocked(cx, cy, cz, TX, py, TZ) && blocked(cx, cy, cz, TX, py, TZ - 6.5) && blocked(cx, cy, cz, TX, py, TZ + 6.5) && blocked(cx, cy, cz, TX + 6.5, py, TZ)); }
      for (let f = 0; f < NF; f++) if (floors[f].visible !== vis[f]) floors[f].visible = vis[f];
      return vis;
    };
    api.parts = [{ geometry: G0.shellPlat, material: shellMat, name: 'shell' }, { geometry: G0.gold, material: goldMat, name: 'gold' }, { geometry: G0.glass, material: glassMat, name: 'glass' }, { geometry: G0.lights, material: lightMat, name: 'lights' }, { geometry: G0.door, material: doorMat, name: 'door' }];
    api.dispose = () => { group.removeFromParent(); for (const o of trash) o.dispose(); };
    return api;
  }
  return { buildRingGarage };
})();
