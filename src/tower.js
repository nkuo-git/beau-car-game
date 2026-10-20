// 圓環車庫＝你的家（Nick 2026-10-17「把原本正方形的車庫直接弄掉」、卡片選「大理石車庫」；「可以自行決定要停在哪一層可以自己搭電梯上去」；
//   草稿 https://claude.ai/artifact/GZcpBA7kY8HVfa7zYk3Si4，Nick「弄好直接弄上手機」）
// 取代 room.js（白色大理石車庫）＋ringgar.js（後面的四層圓環車庫）：整個家就是一棟圓圓的玻璃塔
//   一樓＝大廳（挑高 4.5 公尺）：鐵捲門（朝本地 +x）、門上面的名牌、中間的圓電梯（也是車庫頁改車的轉盤）、小房子（床、衣櫃、書桌）、獎盃櫃、沙發、盆栽
//   二到六樓＝停車：每層 8 格圍著中間的電梯井（車頭朝外停），一共 40 格
//   電梯＝一個會升降、會轉的圓台（半徑 3.3）：開車（或走路）站上去，自己選幾樓（頁面的按鈕）；上去以後轉到空的那一格、往前開進去停好
// 本地座標：原點＝塔的中心（電梯的中間）、x 往鐵捲門（+x 出去）、y 上、z＝車頭朝門時車子的右邊；一樓地板 y 0
//   車庫頁：放在原點（車子停在電梯圓台上給你看）；村子：group 擺到 lot（town.src.js；lot＝塔的中心、heading＝本地 +x 朝外）
// buildRoom(renderer, { quality = 'high', exterior = false }) → {   ← 名字跟 room.js 一樣（頁面不用改太多）
//   group, env, setTrophies(n), setSign(上, 下)（名牌、小房子的字；不給＝大便龍的車庫／大便龍的家）, resize(w, h), dispose(), ready, size（walk.js 的鐵捲門：round＝圓的，門楣、天花板的鏡頭盒子這裡自己給）
//   door：鐵捲門 { t（0 關 … 1 開，可以直接設）, open(sec), close(sec), update(dt), moving }（16 片門片往上收進門楣）
//   spots：{ main（電梯圓台中間、車頭朝門）, outside, bed, wake, houseIn, houseOut }；zones：{ inside（大概的方塊：舊的用法）, door, apron, house, bedSide, houseDoor, dress, pad }
//   house：{ door, zone, bedSide, bed, wake, ceil, ridge, beam }（跟 room.js 一樣：小房子是平頂，ceil＝ridge）
//   isInside(x, z, m)：本地的點在塔裡面（玻璃裡面或門洞）；colliders(doorOpen, world, car)：現在這一層（api.floor）的碰撞（鐵捲門一定最後一個；car＝開車：樓上留斜坡的口）；cameraColliders(world)：只擋鏡頭的（y0）
//   rampColliders(F, world)：第 24 批，開在外面的斜坡上（或在樓上）的矮牆、護欄（towerRampCols）
//   ceilingAt(x, z, world)：現在這一層頭上多高（本地 y；一樓 4.2、樓上每層 2.9 公尺淨高）；heightAt(x, z)：塔裡面 → 現在這一層的地板高（本地 y），外面 null
//   floor：人（車）現在在第幾層（0＝一樓 … 5＝六樓；頁面設：setFloor(f)，碰撞、天花板、地板高都照這個）
//   bays（40 格，跟 TOWER_BAYS 一樣）、floors[6]（每層的車位 Group：0＝一樓沒有車位，cull 照鏡頭開關）、cars[40]、put(i, obj, name)、take(i)（跟 ringgar.js 一樣：車頭朝外）
//   platform：電梯的圓台 Group（車庫頁的車、坐電梯的人和車用 attach 掛上去就跟著動）；lift：{ y, rot, floor, busy }；liftHere(f)：電梯停在第 f 層（沒在動）
//   liftTo(f, rot, onDone)：電梯去第 f 層、轉到 rot（圓台的 rotation.y）；liftSnap(f, rot)：直接放好；onLift(what)：頁面設（'start'／'stop'）
//   update(dt)：鐵捲門＋電梯（有東西在動就 true）；cull(camera) → { inside, house, ceil, floor }（每一層的車只畫看得到的）
//   toWorld({ x, z, heading })、toLocal(x, z)；interior（一樓大廳）、exterior（門外的名牌）；parts（別人那幾間的外殼：InstancedMesh 用 [{ geometry, material, name }]）
//   camClamp(p, t)：車庫頁的鏡頭（p，本地＝世界）留在大廳裡面（玻璃裡、天花板下、不鑽進小房子、櫃子）：從 t（看的點）往 p 那條線上縮
// }
// 效能：外殼一次 10 個 draw call（地板、大理石／白漆、霧面（布、木頭）、金色、玻璃、燈、獎盃、門片、名牌、電梯圓台）；車是輕量車，只畫看得到的那幾層
//   幾何、材質一個網格合併好（兩個 buildRoom 共用幾何：車庫頁、村子各一棟）；每一格不 new 東西
// 打包（build-art.mjs／build-app.mjs 拿掉 import／export）：最上層只有 TOWER、towerFy、TOWER_RAMP、towerRampY、TOWER_BAYS、towerRampCols、towerRampGround、towerColsAt、towerFoot、buildRoom
// 第 24 批：外面繞圈的斜坡（TOWER_RAMP）：村子裡那棟、別人家的外殼才畫（車庫頁不畫）；外殼的 draw call 數不變（合進大理石、金色、燈那三個網格）
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// RO 玻璃半徑、RW 樓板外緣、RI 電梯井（樓上的洞）、RP 電梯圓台、H1 一樓（地板到二樓地板）、FH 樓上每層、NF 層數（一樓＋五層）、RB 車位中心離中間多遠
// 門洞：x DX0（裡面）… DX1（外面），z ±DZ、高 DH；門洞兩邊的牆到 ±PZ；TOP＝屋頂
export const TOWER = { RO: 12, RW: 12.3, RI: 3.6, RP: 3.3, H1: 4.5, FH: 3.2, NF: 6, SLAB: 0.3, RB: 7.6, DX0: 11.95, DX1: 12.6, DZ: 4, DH: 3.6, PZ: 4.6, XP: 11, TOP: 20.5 };
export const towerFy = (f) => (f <= 0 ? 0 : TOWER.H1 + (f - 1) * TOWER.FH); // 第 f 層的地板高（0＝一樓）
// ==== 第 24 批：外面繞圈的斜坡（Nick 2026-10-20「車庫外圍的那個外面那一圈的路可以弄了」；草稿 https://claude.ai/artifact/Xbe4taBBqkM6gL9VDyV3xb，Nick 選「照草稿」）====
//   從鐵捲門右手邊（本地角度 A0＝45 度）的地上開始，往角度變大的方向繞（往上開，塔在右手邊），半圈上一層：
//   第 f 層（1＝2F … 5＝6F）的口在角度 ent(f)＝A0 + f × 180 度（2F 後面、3F 前面、4F 後面、5F 前面、6F 後面）；口對著的那一格變成路（TOWER_BAYS 的 road）＝35 格
//   路面 R0 … R1（4.6 公尺寬）、厚 RT；外面護欄高 PH、裡面矮牆高 CURB；口的玻璃開 ±GW；UEND＝斜坡到哪裡（6F 的口再過去一點）
//   towerRampY(u)：u＝從起點轉了多少（弧度）→ 路面多高（本地 y）；每半圈 smoothstep（口那邊是平的，中間最陡：一樓到二樓 14%、上面 10%）
export const TOWER_RAMP = { A0: Math.PI / 4, R0: 12.6, R1: 17.2, RM: 14.9, RT: 0.4, PH: 1.05, CURB: 0.25, GW: Math.PI / 12, NE: 5, UEND: 5 * Math.PI + 0.32, ent: (f) => Math.PI / 4 + f * Math.PI };
export const towerRampY = (u) => {
  if (!(u > 0)) return 0;
  const k = Math.floor(u / Math.PI);
  if (k >= TOWER_RAMP.NE) return towerFy(TOWER_RAMP.NE);
  const t = u / Math.PI - k;
  return towerFy(k) + (towerFy(k + 1) - towerFy(k)) * t * t * (3 - 2 * t);
};
// 40 格（停車的順序＝id：二樓先）：{ id, f（1＝二樓 … 5＝六樓）, i（方向 i × 45 度，0＝朝門那邊）, a, x, y, z（車子中心，本地）, heading（車頭朝外）, road（第 24 批：斜坡的口對著＝路，不能停）}
export const TOWER_BAYS = (() => {
  const out = [];
  for (let f = 1; f < TOWER.NF; f++) for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    out.push({ id: out.length, f, i, a, x: +(TOWER.RB * Math.cos(a)).toFixed(4), y: towerFy(f), z: +(TOWER.RB * Math.sin(a)).toFixed(4), heading: -a, road: i === (1 + 4 * f) % 8 });
  }
  return out;
})();
// 第 24 批：斜坡的碰撞（本地座標、平的；頁面照現在在哪換）
//   towerRampCols(F)：開在斜坡上（或在樓上）：裡面的矮牆一整圈（F 那一層的口開著；F 0＝都沒開）、外面的護欄一整圈、最上面的端牆（F＝最上面那一層才有）
//   towerRampGround()：從地上看：第一個半圈（u 0 … π，低的那段）是實心的：外面一圈弧＋π 那邊的端牆；mouth＝斜坡的起點橫著一道（不能開上去的時候擋）
//   towerColsAt(list, lot)：本地 → 世界（lot＝塔的中心、heading）
export const { towerRampCols, towerRampGround, towerColsAt } = (() => {
  const R = TOWER_RAMP, RO = TOWER.RO;
  // 一段弧：半徑 r（盒子中心）、厚 2 × hz、角度 t0 … t1 分 n 個盒子（盒子的 x 軸沿著弧）
  const arc = (r, hz, t0, t1, n, h) => { const out = [], da = (t1 - t0) / n; for (let k = 0; k < n; k++) { const a = t0 + (k + 0.5) * da; out.push({ t: 'box', x: r * Math.cos(a), z: r * Math.sin(a), hx: r * Math.tan(da / 2) + 0.1, hz, rot: -a - Math.PI / 2, h }); } return out; };
  const radial = (a, r0, r1, h) => ({ t: 'box', x: ((r0 + r1) / 2) * Math.cos(a), z: ((r0 + r1) / 2) * Math.sin(a), hx: (r1 - r0) / 2, hz: 0.15, rot: -a, h }); // 橫跨的牆（x 軸朝外）
  const HC = 1.1; // 矮一點：鏡頭的線不會被護欄擋（drive.js：2.4 公尺以上才擋鏡頭）
  const RAMP_COLS = [];
  for (let F = 0; F <= R.NE; F++) {
    const inner = F ? arc(R.R0 + 0.05, 0.25, R.ent(F) + R.GW, R.ent(F) + 2 * Math.PI - R.GW, 44, HC) : arc(R.R0 + 0.05, 0.25, 0, 2 * Math.PI, 48, HC);
    RAMP_COLS.push([...inner, ...arc(R.R1 - 0.12, 0.15, 0, 2 * Math.PI, 56, HC), ...(F === R.NE ? [radial(R.A0 + R.UEND + 0.02, R.R0 - 0.3, R.R1 + 0.2, HC)] : [])]); // 端牆只在最上面那一圈（碰撞是平的：別圈經過同一個角度不能擋）
  }
  const GROUND = { wedge: [...arc(R.R1 - 0.05, 0.3, R.A0, R.A0 + Math.PI, 24, 4), radial(R.A0 + Math.PI + 0.01, RO - 0.3, R.R1 + 0.25, 4)], mouth: radial(R.A0 - 0.012, RO - 0.3, R.R1 + 0.4, 2) };
  const towerRampCols = (F) => RAMP_COLS[Math.max(0, Math.min(R.NE, F | 0))].map((c) => ({ ...c }));
  const towerRampGround = () => ({ wedge: GROUND.wedge.map((c) => ({ ...c })), mouth: { ...GROUND.mouth } });
  const towerColsAt = (list, lot) => { const c = Math.cos(lot.heading), s = Math.sin(lot.heading); for (const q of list) { const x = q.x, z = q.z; q.x = lot.x + x * c + z * s; q.z = lot.z - x * s + z * c; if (q.t === 'box') q.rot = (q.rot || 0) + lot.heading; } return list; };
  return { towerRampCols, towerRampGround, towerColsAt };
})();
// 塔在世界上佔哪裡（village.js 用）：lot＝{ x, z, heading }（塔的中心、本地 +x 朝門外）→ { x, z, r（樓板外面一點）, portal（門洞那一塊的長方形）, door（門外面 2 公尺）}
export function towerFoot(lot) {
  const { RW, DX1, PZ, XP } = TOWER, c = Math.cos(lot.heading), s = Math.sin(lot.heading);
  const w = (lx, lz = 0) => [lot.x + lx * c + lz * s, lot.z - lx * s + lz * c], pc = w((XP + DX1) / 2), dr = w(DX1 + 2);
  return { x: lot.x, z: lot.z, r: RW + 0.3, portal: { x: pc[0], z: pc[1], hx: (DX1 - XP) / 2 + 0.05, hz: PZ + 0.05, rot: lot.heading }, door: { x: dr[0], z: dr[1] } };
}

export const { buildRoom } = (() => {
  const { RO, RW, RI, RP, H1, FH, NF, SLAB, RB, DX0, DX1, DZ, DH, PZ, XP, TOP } = TOWER;
  const fy = towerFy, ceilY = (f) => fy(f + 1) - SLAB; // 第 f 層的天花板（樓板底）
  const GAP = Math.asin(PZ / RO); // 一樓玻璃留給門洞的缺口（半個角度）
  const XS = (DX0 + DX1) / 2 + 0.03; // 門片在哪（x）
  const NS = 16, SH = DH / NS; // 門片：16 片
  // 小房子（一樓北邊、貼著玻璃）：外面 x HX0 … HX1、z HZ0 … HZ1；牆厚 HT、牆高 HW、裡面天花板 HC；門洞（南牆，朝中間）x HD0 … HD1、高 HDH；窗 x WX0 … WX1、y WY0 … WY1
  const HX0 = -3.6, HX1 = 1.8, HZ0 = -10.6, HZ1 = -6.4, HT = 0.12, HW = 2.9, HC = 2.75, HD0 = 0.35, HD1 = 1.35, HDH = 2.1, WX0 = -3.0, WX1 = -0.4, WY0 = 0.9, WY1 = 2.2;
  const IX0 = HX0 + HT, IX1 = HX1 - HT, IZ0 = HZ0 + HT, IZ1 = HZ1 - HT;
  const BED = { x0: -3.3, x1: -1.7, z0: -10.45, z1: -8.35, top: 0.56 }; // 雙人床（床頭靠北牆）
  const WARD = { x0: IX1 - 0.6, x1: IX1, z0: -10.4, z1: -9.1, h: 2.2 }; // 衣櫃（東牆）
  const DESK = { x0: IX0, x1: IX0 + 0.55, z0: -7.9, z1: -6.75, top: 0.74 }; // 書桌＋電視（西牆）
  const CAB = { x0: -10.7, x1: -9.95, z0: -3, z1: 3, h: 2.3 }; // 獎盃櫃（西邊，玻璃那邊）
  const SOFA = { x0: -2.6, x1: 1.6, z0: 9.3, z1: 10.25 }, TABLE = { x: -0.5, z: 8.0, hx: 0.65, hz: 0.33 }, LAMP = { x: 2.35, z: 9.85 }; // 沙發區（南邊）
  const PLANTS = [[7.4, -7.9], [7.4, 7.9], [-8, -7.2], [-8, 7.2]];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const T4 = (x, y, z, ry = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
  const FLAT = [0.031, 0.047]; // 大理石貼圖上沒什麼紋路的一點（純色的東西）
  // 顏色（線性；燈超過 1）
  const WHITE = [0.86, 0.86, 0.85], SLABC = [0.8, 0.8, 0.79], UNDER = [0.74, 0.74, 0.73], BLACK = [0.012, 0.012, 0.014], NERO = [0.05, 0.05, 0.055], LINE = [0.95, 0.72, 0.2];
  const HAZ = [0.85, 0.62, 0.05], PIT = [0.05, 0.05, 0.055], LACQ = [0.84, 0.84, 0.83], STEEL = [0.55, 0.56, 0.58], GRAPH = [0.07, 0.07, 0.075], WARM = [0.83, 0.8, 0.74];
  const WALNUT = [0.16, 0.085, 0.045], OAK = [0.42, 0.28, 0.15], LINEN = [0.8, 0.79, 0.75], PILLOW = [0.88, 0.87, 0.84], ORANGE = [0.85, 0.28, 0.05], FABRIC = [0.2, 0.2, 0.22];
  const LEATHER = [0.035, 0.03, 0.027], RUG = [0.28, 0.27, 0.25], LEAF = [0.1, 0.3, 0.07], LEAF2 = [0.14, 0.4, 0.09];
  const LED = [5.2, 4.5, 3.6], LED2 = [4.2, 3.8, 3.2], LAMPC = [4.5, 3.2, 1.6], SCREEN = [0.5, 1.6, 2.4];

  // ---- 合併網格：位置、法線、貼圖座標（大理石：一張 3.2 公尺）、頂點色 ----
  function mesher() {
    const P = [], N = [], UV = [], C = [], I = [];
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    const m = {
      // 四邊形 a b c d（從正面看逆時針）；uv 不給：照尺寸自己算（平的照 xz、直的照長度和高度）
      quad(a, b, c, d, col, uv) {
        const k = P.length / 3;
        n.subVectors(c, a).cross(v.subVectors(d, b)).normalize();
        const us = uv || (Math.abs(n.y) > 0.7 ? [a, b, c, d].map((p) => [p.x / 3.2, p.z / 3.2]) : (() => { const w = b.distanceTo(a), h = d.distanceTo(a), u0 = (a.x + a.z) / 3.2; return [[u0, a.y / 3.2], [u0 + w / 3.2, b.y / 3.2], [u0 + w / 3.2, (b.y + h) / 3.2], [u0, (a.y + h) / 3.2]]; })());
        [a, b, c, d].forEach((p, i) => { P.push(p.x, p.y, p.z); N.push(n.x, n.y, n.z); UV.push(us[i][0], us[i][1]); C.push(col[0], col[1], col[2]); });
        I.push(k, k + 1, k + 2, k, k + 2, k + 3);
      },
      // 任何 BufferGeometry（套 M、顏色 col；uvFix＝固定的一點：不要大理石紋）
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
      box(M, s, col, uvFix = FLAT) { m.geo(new THREE.BoxGeometry(s[0], s[1], s[2]), M, col, uvFix); },
      bx(x0, x1, y0, y1, z0, z1, col, uvFix = FLAT) { m.box(T4((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), [x1 - x0, y1 - y0, z1 - z0], col, uvFix); }, // 兩個角的盒子
      cyl(x, y0, y1, z, r0, r1, col, seg = 16, uvFix = FLAT) { m.geo(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), T4(x, (y0 + y1) / 2, z), col, uvFix); }, // 直的圓柱（r0 底、r1 頂）
      // 水平的圓環（r0 … r1，角度 t0 … t1；up＝面朝上）
      annulus(y, r0, r1, col, { t0 = 0, t1 = Math.PI * 2, seg = 64, up = true, cx = 0, cz = 0, uv } = {}) {
        const ns = Math.max(3, Math.round((seg * (t1 - t0)) / (Math.PI * 2)));
        for (let s = 0; s < ns; s++) {
          const a0 = t0 + ((t1 - t0) * s) / ns, a1 = t0 + ((t1 - t0) * (s + 1)) / ns;
          const p = (r, a) => V(cx + r * Math.cos(a), y, cz + r * Math.sin(a));
          const A = p(r0, a0), B = p(r1, a0), Cc = p(r1, a1), D = p(r0, a1);
          if (up) m.quad(A, D, Cc, B, col, uv); else m.quad(A, B, Cc, D, col, uv); // 角度往 +z 轉：從上面看是順時針
        }
      },
      // 直的圓筒面（半徑 r、y0 … y1、角度 t0 … t1；out＝面朝外）
      band(r, y0, y1, col, { t0 = 0, t1 = Math.PI * 2, seg = 64, out = true, cx = 0, cz = 0, flat = false } = {}) {
        const ns = Math.max(2, Math.round((seg * (t1 - t0)) / (Math.PI * 2)));
        for (let s = 0; s < ns; s++) {
          const a0 = t0 + ((t1 - t0) * s) / ns, a1 = t0 + ((t1 - t0) * (s + 1)) / ns;
          const A = V(cx + r * Math.cos(a0), y0, cz + r * Math.sin(a0)), B = V(cx + r * Math.cos(a1), y0, cz + r * Math.sin(a1));
          const u0 = (a0 * r) / 3.2, u1 = (a1 * r) / 3.2, uv = flat ? [FLAT, FLAT, FLAT, FLAT] : [[u0, y0 / 3.2], [u1, y0 / 3.2], [u1, y1 / 3.2], [u0, y1 / 3.2]];
          const A1 = A.clone().setY(y1), B1 = B.clone().setY(y1);
          if (out) m.quad(B, A, A1, B1, col, [uv[1], uv[0], uv[3], uv[2]]); else m.quad(A, B, B1, A1, col, uv);
        }
      },
      get count() { return P.length / 3; },
      build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
        g.setIndex(I); g.computeBoundingSphere(); return g;
      },
    };
    return m;
  }
  // 四邊形，照想要朝的方向（dx, dy, dz）自己排順序（第 24 批：斜坡、箭頭這些斜的、彎的面）
  const _fn = new THREE.Vector3(), _fe = new THREE.Vector3();
  const face4 = (m, A, B, C, D, col, uv, dx, dy, dz) => {
    _fn.subVectors(C, A).cross(_fe.subVectors(D, B));
    if (_fn.x * dx + _fn.y * dy + _fn.z * dz < 0) m.quad(A, D, C, B, col, uv && [uv[0], uv[3], uv[2], uv[1]]); else m.quad(A, B, C, D, col, uv);
  };
  const merge = (list) => { // 幾個網格（同樣的屬性）合成一個
    const g = new THREE.BufferGeometry(), keys = ['position', 'normal', 'uv', 'color'];
    for (const k of keys) { const n = list.reduce((s, a) => s + a.attributes[k].array.length, 0), arr = new Float32Array(n); let o = 0; for (const a of list) { arr.set(a.attributes[k].array, o); o += a.attributes[k].array.length; } g.setAttribute(k, new THREE.BufferAttribute(arr, k === 'uv' ? 2 : 3)); }
    const idx = []; let base = 0; for (const a of list) { for (const i of a.index.array) idx.push(i + base); base += a.attributes.position.count; }
    g.setIndex(idx); g.computeBoundingSphere(); return g;
  };

  // ---- 大理石（卡拉拉白；跟 room.js 一樣的算法，兩個畫質共用，存在 buildRoom 身上）----
  function marbleCanvas(MS) {
    const cache = buildRoom.marbleCache || (buildRoom.marbleCache = {});
    if (cache[MS]) return cache[MS];
    const cv = document.createElement('canvas'); cv.width = cv.height = MS;
    const g = cv.getContext('2d');
    if (cache[MS * 2]) { g.imageSmoothingQuality = 'high'; g.drawImage(cache[MS * 2], 0, 0, MS, MS); return (cache[MS] = cv); }
    const GN = 256, NZ = new Float32Array(GN * GN);
    let s0 = 777; const r0 = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647;
    for (let cells = 4, amp = 1; cells <= 128; cells *= 2, amp *= 0.52) {
      const gr = new Float32Array(cells * cells), cm = cells - 1, st = GN / cells; for (let i = 0; i < gr.length; i++) gr[i] = r0() * 2 - 1;
      const SX = new Float32Array(GN), XA = new Int32Array(GN), XB = new Int32Array(GN);
      for (let x = 0; x < GN; x++) { const fx = x / st, ix = fx | 0, tx = fx - ix; SX[x] = tx * tx * (3 - 2 * tx); XA[x] = ix & cm; XB[x] = (ix + 1) & cm; }
      for (let y = 0; y < GN; y++) {
        const fyy = y / st, iy = fyy | 0, ty = fyy - iy, sy = ty * ty * (3 - 2 * ty), ra = (iy & cm) * cells, rb = ((iy + 1) & cm) * cells;
        for (let x = 0, o = y * GN; x < GN; x++, o++) {
          const sx = SX[x], xa = XA[x], xb = XB[x], ga = gr[ra + xa], gb = gr[rb + xa], a = ga + (gr[ra + xb] - ga) * sx, b = gb + (gr[rb + xb] - gb) * sx;
          NZ[o] += amp * (a + (b - a) * sy);
        }
      }
    }
    const nz = (u, v) => {
      let fx = u * GN, fyy = v * GN; fx -= Math.floor(fx / GN) * GN; fyy -= Math.floor(fyy / GN) * GN;
      const ix = fx | 0, iy = fyy | 0, tx = fx - ix, ty = fyy - iy, x1 = (ix + 1) & (GN - 1), y1 = (iy + 1) & (GN - 1);
      const a = NZ[iy * GN + ix], b = NZ[iy * GN + x1], c = NZ[y1 * GN + ix], d = NZ[y1 * GN + x1];
      return a + (b - a) * tx + (c - a + (a - b - c + d) * tx) * ty;
    };
    const LR = MS / 4 + 1, NFd = 6, F = new Float32Array(LR * LR * NFd), ca = Math.cos(0.6), sa = Math.sin(0.6);
    for (let j = 0; j < LR; j++) for (let i = 0; i < LR; i++) {
      const u = (i * 4) / MS, v = (j * 4) / MS, o = (j * LR + i) * NFd;
      F[o] = nz(u * 0.7 + 0.13, v * 0.7 + 0.71); F[o + 1] = nz(u * 1.5 + 0.52, v * 1.5 + 0.29); F[o + 2] = nz(u * 0.55 + 0.37, v * 0.55 + 0.83);
      F[o + 3] = nz(u * 0.8 + 0.61, v * 0.8 + 0.07); F[o + 4] = nz(u * 1.2 + 0.91, v * 1.2 + 0.44); F[o + 5] = nz(u * 2.6 + 0.23, v * 2.6 + 0.66);
    }
    const TN = 2048, T1 = new Float32Array(TN + 1), T2 = new Float32Array(TN + 1), T3 = new Float32Array(TN + 1);
    for (let i = 0; i <= TN; i++) { const x = i / TN; T1[i] = Math.exp(-x * 30) * 0.7 + Math.exp(-x * 5) * 0.22; T2[i] = Math.exp(-x * 55) * 0.45; T3[i] = Math.exp(-x * 90) * 0.18; }
    const img = g.createImageData(MS, MS), d = img.data, RWF = new Float32Array(LR * NFd);
    for (let y = 0, o = 0; y < MS; y++) {
      const jy = y >> 2, ty = (y & 3) / 4, v = y / MS;
      for (let i = 0, a = jy * LR * NFd, c = a + LR * NFd; i < LR * NFd; i++) RWF[i] = F[a + i] + (F[c + i] - F[a + i]) * ty;
      for (let x = 0; x < MS; x++, o += 4) {
        const i0 = (x >> 2) * NFd, tx = (x & 3) / 4, u = x / MS, p = u * ca + v * sa, q = v * ca - u * sa;
        const f0 = RWF[i0] + (RWF[i0 + NFd] - RWF[i0]) * tx, f1 = RWF[i0 + 1] + (RWF[i0 + NFd + 1] - RWF[i0 + 1]) * tx, f2 = RWF[i0 + 2] + (RWF[i0 + NFd + 2] - RWF[i0 + 2]) * tx;
        const f3 = RWF[i0 + 3] + (RWF[i0 + NFd + 3] - RWF[i0 + 3]) * tx, f4 = RWF[i0 + 4] + (RWF[i0 + NFd + 4] - RWF[i0 + 4]) * tx, f5 = RWF[i0 + 5] + (RWF[i0 + NFd + 5] - RWF[i0 + 5]) * tx;
        const fine = nz(u * 4.7 + 0.4, v * 4.7 + 0.9);
        let t = q * 2.2 + f0 * 0.35 + fine * 0.04; t -= Math.floor(t); let h = t * (1 - t); const s1 = (16 * h) / (5 - 4 * h);
        t = q * 4.6 - p * 0.6 + f1 * 0.6 + fine * 0.08; t -= Math.floor(t); h = t * (1 - t); const s2 = (16 * h) / (5 - 4 * h);
        t = q * 9 + p * 1.3 + f5 * 1.2 + fine * 0.16; t -= Math.floor(t); h = t * (1 - t); const s3 = (16 * h) / (5 - 4 * h);
        let m1 = f3 * 1.2 + 0.55, m2 = f4 * 1.5 + 0.2, m3 = 0.1 - f4 * 1.4;
        m1 = m1 < 0 ? 0 : m1 > 1 ? 1 : m1; m2 = m2 < 0 ? 0 : m2 > 1 ? 1 : m2; m3 = m3 < 0 ? 0 : m3 > 1 ? 1 : m3;
        let vein = T1[(s1 * TN) | 0] * m1 + T2[(s2 * TN) | 0] * m2 + T3[(s3 * TN) | 0] * m3; if (vein > 1) vein = 1;
        const c1 = f2 + 0.2, L = 247 - (c1 > 0 ? c1 * 13 : 0) - (fine > 0 ? fine * 2.5 : 0);
        d[o] = L - vein * 105; d[o + 1] = L - 1 - vein * 100; d[o + 2] = L - 3 - vein * 90; d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return (cache[MS] = cv);
  }

  // ---- 外殼的幾何（兩個 buildRoom 共用：車庫頁、村子各一棟）----
  const GEO = {};
  function shellGeos() {
    if (GEO.shell) return GEO;
    const S = mesher(), M = mesher(), G = mesher(), GL = mesher(), CG = mesher(), L = mesher(), F = mesher(), K = mesher(); // CG：透明的玻璃（小房子的窗、獎盃櫃）
    // ---- 一樓地板（白大理石，另外一個網格：車庫頁的鏡面地板）＋門洞的地板；電梯的坑（圓台不在一樓的時候看得到）----
    F.annulus(0, RP + 0.24, RW, SLABC, { seg: 112 });
    F.quad(V(XP - 0.4, 0, DZ), V(DX1, 0, DZ), V(DX1, 0, -DZ), V(XP - 0.4, 0, -DZ), SLABC);
    const PM = mesher(); PM.annulus(0.002, 0, RP + 0.13, PIT, { seg: 48, uv: [FLAT, FLAT, FLAT, FLAT] }); // 電梯的坑：一片深色的圓（另外一個網格：圓台不在一樓才畫；不挖地面）
    for (let k = 0; k < 24; k++) S.annulus(0.004, RP + 0.12, RP + 0.24, k & 1 ? BLACK : HAZ, { t0: (k * Math.PI) / 12, t1: ((k + 1) * Math.PI) / 12, seg: 48, uv: [FLAT, FLAT, FLAT, FLAT] }); // 坑口一圈黃黑斜紋
    S.bx(DX0 - 0.05, DX0 + 0.15, 0, 0.012, -DZ, DZ, STEEL); // 門檻（不鏽鋼）
    // 一樓外面一圈黑色牆腳（門洞那邊沒有）
    S.band(RO + 0.3, 0, 0.35, NERO, { seg: 96, t0: GAP, t1: Math.PI * 2 - GAP });
    S.annulus(0.35, RO - 0.02, RO + 0.3, NERO, { seg: 96, t0: GAP, t1: Math.PI * 2 - GAP });
    // ---- 二到六樓的樓板（中間挖電梯井）、屋頂 ----
    for (let f = 1; f <= NF; f++) {
      const y = fy(f), roof = f === NF;
      S.annulus(y, roof ? 0 : RI, RW, roof ? [0.6, 0.6, 0.59] : SLABC, { seg: 112 }); // 地板（屋頂：灰色防水）
      S.annulus(y - SLAB, roof ? 0 : RI, RW, UNDER, { seg: 112, up: false }); // 天花板
      S.band(RW, y - SLAB, y, WHITE, { seg: 112 }); // 外緣
      if (!roof) S.band(RI, y - SLAB, y, WHITE, { seg: 48, out: false }); // 電梯井的邊（朝井裡）
      G.band(RW + 0.01, y - 0.07, y, [1, 1, 1], { seg: 112, flat: true }); // 金色收邊
      L.annulus(y - SLAB - 0.004, 7.25, 7.34, LED, { seg: 112, up: false }); // 天花板一圈燈（車位上面）
      if (!roof) L.annulus(y - SLAB - 0.004, RI + 0.2, RI + 0.26, LED2, { seg: 48, up: false }); // 電梯井邊一圈燈
      if (!roof) { // 這一層：車位的線（兩格中間，金黃色）、電梯井邊的黃黑斜紋
        for (let k = 0; k < 8; k++) {
          const a = Math.PI / 8 + (k * Math.PI) / 4, r0 = RI + 0.45, r1 = RO - 0.45, w = 0.05, cs = Math.cos(a), sn = Math.sin(a), px = -sn * w, pz = cs * w;
          S.quad(V(cs * r0 - px, y + 0.004, sn * r0 - pz), V(cs * r0 + px, y + 0.004, sn * r0 + pz), V(cs * r1 + px, y + 0.004, sn * r1 + pz), V(cs * r1 - px, y + 0.004, sn * r1 - pz), LINE, [FLAT, FLAT, FLAT, FLAT]);
        }
        for (let k = 0; k < 32; k++) S.annulus(y + 0.004, RI, RI + 0.2, k & 1 ? BLACK : HAZ, { t0: (k * Math.PI) / 16, t1: ((k + 1) * Math.PI) / 16, seg: 64, uv: [FLAT, FLAT, FLAT, FLAT] });
      }
    }
    // 屋頂：金色的冠（女兒牆）
    G.band(RW + 0.06, TOP, TOP + 0.45, [1, 1, 1], { seg: 112, flat: true });
    G.band(RW - 0.24, TOP, TOP + 0.45, [1, 1, 1], { seg: 112, out: false, flat: true });
    G.annulus(TOP + 0.45, RW - 0.24, RW + 0.06, [1, 1, 1], { seg: 112, uv: [FLAT, FLAT, FLAT, FLAT] });
    // ---- 玻璃：一樓留門洞的缺口；黑色直條（每 15 度一根；門洞那幾根從二樓開始）；第 24 批：樓上每一層留斜坡的口（±GW，那幾根直條在口那一層斷開）----
    const RA = TOWER_RAMP, angD = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    GL.band(RO, 0.35, ceilY(0), [1, 1, 1], { seg: 112, t0: GAP, t1: Math.PI * 2 - GAP });
    for (let f = 1; f < NF; f++) GL.band(RO, fy(f), ceilY(f), [1, 1, 1], { seg: 112, t0: RA.ent(f) + RA.GW, t1: RA.ent(f) + Math.PI * 2 - RA.GW });
    for (let k = 0; k < 24; k++) {
      const a = (k + 0.5) * (Math.PI / 12), y0 = angD(a, 0) < GAP + 0.04 ? ceilY(0) : 0;
      let y = y0;
      const seg = (ya, yb) => { if (yb - ya > 0.01) S.box(T4((RO + 0.05) * Math.cos(a), (ya + yb) / 2, (RO + 0.05) * Math.sin(a), -a), [0.16, yb - ya, 0.1], BLACK); };
      for (let f = 1; f <= RA.NE; f++) if (angD(a, RA.ent(f)) < RA.GW) { seg(y, fy(f)); y = ceilY(f); }
      seg(y, TOP);
    }
    // 樓上的路（斜坡的口到電梯）：兩邊黃線、兩個往外的箭頭
    const chevron = (m, cx, cz, ux, uz, yAt, col, len = 0.55, wid = 0.85, w = 0.16) => { // 地上的箭頭（尖朝 u 方向）；yAt(往前幾公尺)＝那裡多高
      const vx = -uz, vz = ux;
      for (const s of [-1, 1]) {
        const p = (fw, sd) => V(cx + ux * fw + vx * sd, yAt(fw), cz + uz * fw + vz * sd);
        const A = p(-len, s * wid), B = p(-len + w * 1.4, s * wid), C = p(w * 0.7, 0), D = p(0, 0);
        face4(m, A, B, C, D, col, [FLAT, FLAT, FLAT, FLAT], 0, 1, 0);
      }
    };
    for (let f = 1; f <= RA.NE; f++) {
      const e = RA.ent(f), y = fy(f) + 0.004, ux = Math.cos(e), uz = Math.sin(e);
      for (const s of [-1, 1]) { const ox = -uz * s * 1.75, oz = ux * s * 1.75, r0 = RI + 0.55, r1 = RO - 0.25, w = 0.06; face4(S, V(ox + ux * r0 - uz * w, y, oz + uz * r0 + ux * w), V(ox + ux * r1 - uz * w, y, oz + uz * r1 + ux * w), V(ox + ux * r1 + uz * w, y, oz + uz * r1 - ux * w), V(ox + ux * r0 + uz * w, y, oz + uz * r0 - ux * w), LINE, [FLAT, FLAT, FLAT, FLAT], 0, 1, 0); }
      for (const r of [7.2, 9.6]) chevron(S, ux * r, uz * r, ux, uz, () => y + 0.002, LINE);
    }
    // 電梯井沒有柱子（車子從格子倒車回電梯，斜一點也不會卡住）：井邊一圈黃黑斜紋＋燈
    // ---- 門洞（一樓 +x）：兩邊的牆（白大理石）、門楣、黑框、金線、鐵捲門的導軌 ----
    for (const sz of [-1, 1]) {
      const z0 = sz < 0 ? -PZ : DZ, z1 = sz < 0 ? -DZ : PZ;
      S.bx(XP, DX1, 0, H1, z0, z1, WHITE, null);
      S.bx(XS - 0.12, XS + 0.12, 0, DH, sz * (DZ + 0.035) - 0.035, sz * (DZ + 0.035) + 0.035, BLACK); // 導軌
      S.bx(DX1, DX1 + 0.05, 0, DH + 0.08, sz * DZ - 0.05, sz * DZ + 0.05, BLACK); // 外面的黑框
    }
    S.bx(XP, DX1, DH, H1, -PZ, PZ, WHITE, null); // 門楣
    S.bx(DX1, DX1 + 0.05, DH, DH + 0.08, -DZ - 0.05, DZ + 0.05, BLACK);
    G.bx(DX1 + 0.02, DX1 + 0.06, H1 - 0.12, H1 - 0.08, -PZ, PZ, [1, 1, 1]); // 門楣上緣一條金線
    S.bx(XP, DX0, DH - 0.004, DH, -DZ, DZ, UNDER); // 門洞的天花板（門楣底）
    L.quad(V(XP + 0.2, DH - 0.006, 0.05), V(DX0 - 0.2, DH - 0.006, 0.05), V(DX0 - 0.2, DH - 0.006, -0.05), V(XP + 0.2, DH - 0.006, -0.05), LED); // 門洞的燈
    for (const sz of [-1, 1]) L.bx(DX1 + 0.03, DX1 + 0.07, 0.5, 2.6, sz * (PZ - 0.25) - 0.04, sz * (PZ - 0.25) + 0.04, LED); // 門兩邊直的壁燈
    // 關著的門（別人那幾間）：一片深灰（跟門片一樣的位置）
    K.bx(XS - 0.03, XS + 0.03, 0, DH, -DZ, DZ, [0.42, 0.43, 0.45]);
    for (let k = 1; k < NS; k++) K.bx(XS + 0.03, XS + 0.04, k * SH - 0.01, k * SH + 0.01, -DZ, DZ, [0.2, 0.2, 0.21]); // 門片的縫
    // ---- 小房子（一樓北邊）：白牆、黑屋頂、橡木地板、門洞、窗；裡面雙人床、床頭櫃＋燈、衣櫃、書桌＋電視、椅子、地毯 ----
    S.bx(HX0, HX1, 0, HW, HZ0, IZ0, WARM); S.bx(HX0, IX0, 0, HW, IZ0, IZ1, WARM); S.bx(IX1, HX1, 0, HW, IZ0, IZ1, WARM); // 北、西、東牆
    S.bx(HX0, WX0, 0, HW, IZ1, HZ1, WARM); S.bx(WX1, HD0, 0, HW, IZ1, HZ1, WARM); S.bx(HD1, HX1, 0, HW, IZ1, HZ1, WARM); // 南牆（門、窗之外）
    S.bx(WX0, WX1, 0, WY0, IZ1, HZ1, WARM); S.bx(WX0, WX1, WY1, HW, IZ1, HZ1, WARM); S.bx(HD0, HD1, HDH, HW, IZ1, HZ1, WARM); // 窗下、窗上、門上
    S.bx(HX0 - 0.15, HX1 + 0.15, HW, HW + 0.15, HZ0 - 0.15, HZ1 + 0.15, GRAPH); // 屋頂（平頂，深灰）
    S.bx(HX0 - 0.01, HX1 + 0.01, 0, 0.12, HZ1, HZ1 + 0.012, BLACK); // 牆腳
    for (const [x0, x1, y0, y1] of [[WX0, WX1, WY0 - 0.04, WY0], [WX0, WX1, WY1, WY1 + 0.04], [WX0 - 0.04, WX0, WY0, WY1], [WX1, WX1 + 0.04, WY0, WY1], [(WX0 + WX1) / 2 - 0.02, (WX0 + WX1) / 2 + 0.02, WY0, WY1]]) S.bx(x0, x1, y0, y1, HZ1 - 0.07, HZ1 + 0.01, BLACK); // 窗框
    CG.quad(V(WX0, WY0, HZ1 - 0.04), V(WX1, WY0, HZ1 - 0.04), V(WX1, WY1, HZ1 - 0.04), V(WX0, WY1, HZ1 - 0.04), [1, 1, 1], [FLAT, FLAT, FLAT, FLAT]);
    M.quad(V(IX0, 0.008, IZ1), V(IX1, 0.008, IZ1), V(IX1, 0.008, IZ0), V(IX0, 0.008, IZ0), OAK, [FLAT, FLAT, FLAT, FLAT]); // 橡木地板
    M.quad(V(IX0, HC, IZ0), V(IX1, HC, IZ0), V(IX1, HC, IZ1), V(IX0, HC, IZ1), [0.55, 0.4, 0.25], [FLAT, FLAT, FLAT, FLAT]); // 天花板（淺橡木，朝下）
    S.bx(IX0, IX1, HC, HW, IZ0, IZ1, WARM); // 天花板上面（屋頂底）
    L.cyl(-0.9, HC - 0.03, HC - 0.005, -8.5, 0.32, 0.32, [3.6, 3.1, 2.4], 24); // 吸頂燈
    M.box(T4(HD1 - 0.02, HDH / 2, IZ1 - 0.5, 0), [0.04, HDH, 0.98], WALNUT); // 門（往裡面開著，靠東邊）
    // 床：胡桃木床架、灰布床頭板、白亞麻被、兩個枕頭、橘色床尾毯
    M.bx(BED.x0, BED.x1, 0.12, 0.34, BED.z0, BED.z1, WALNUT); M.bx(BED.x0 + 0.05, BED.x1 - 0.05, 0, 0.12, BED.z0 + 0.05, BED.z1 - 0.05, BLACK);
    M.bx(BED.x0 + 0.03, BED.x1 - 0.03, 0.34, BED.top, BED.z0 + 0.08, BED.z1 - 0.03, LINEN);
    M.bx(BED.x0 - 0.04, BED.x1 + 0.04, 0, 1.15, BED.z0 - 0.03, BED.z0 + 0.06, FABRIC);
    for (const x of [BED.x0 + 0.42, BED.x1 - 0.42]) M.box(T4(x, BED.top + 0.08, BED.z0 + 0.32, 0).multiply(new THREE.Matrix4().makeRotationX(-0.25)), [0.62, 0.16, 0.38], PILLOW);
    M.bx(BED.x0 + 0.01, BED.x1 - 0.01, BED.top - 0.02, BED.top + 0.03, BED.z1 - 0.55, BED.z1 - 0.02, ORANGE);
    // 床頭櫃（兩邊）＋燈
    { const x0 = BED.x1 + 0.05; // 床頭櫃（床的東邊；西邊貼著牆放不下）
      M.bx(x0, x0 + 0.37, 0.18, 0.55, BED.z0 + 0.02, BED.z0 + 0.42, WALNUT);
      G.cyl(x0 + 0.18, 0.55, 0.85, BED.z0 + 0.22, 0.012, 0.012, [1, 1, 1], 8);
      L.cyl(x0 + 0.18, 0.82, 1.0, BED.z0 + 0.22, 0.13, 0.09, LAMPC, 16);
    }
    // 衣櫃：白色烤漆、金色把手
    S.bx(WARD.x0, WARD.x1, 0, WARD.h, WARD.z0, WARD.z1, LACQ); S.bx(WARD.x0 - 0.004, WARD.x0, 0.05, WARD.h - 0.05, (WARD.z0 + WARD.z1) / 2 - 0.004, (WARD.z0 + WARD.z1) / 2 + 0.004, BLACK);
    for (const s of [-1, 1]) G.bx(WARD.x0 - 0.03, WARD.x0 - 0.01, 0.9, 1.3, (WARD.z0 + WARD.z1) / 2 + s * 0.08 - 0.01, (WARD.z0 + WARD.z1) / 2 + s * 0.08 + 0.01, [1, 1, 1]);
    // 書桌＋電視（在玩賽車）＋椅子
    M.bx(DESK.x0, DESK.x1, DESK.top - 0.04, DESK.top, DESK.z0, DESK.z1, WALNUT);
    for (const z of [DESK.z0 + 0.04, DESK.z1 - 0.04]) M.bx(DESK.x0 + 0.04, DESK.x1 - 0.04, 0, DESK.top - 0.04, z - 0.025, z + 0.025, BLACK);
    S.bx(IX0, IX0 + 0.05, 1.0, 1.62, DESK.z0 + 0.12, DESK.z1 - 0.12, BLACK);
    L.quad(V(IX0 + 0.052, 1.03, DESK.z1 - 0.15), V(IX0 + 0.052, 1.03, DESK.z0 + 0.15), V(IX0 + 0.052, 1.59, DESK.z0 + 0.15), V(IX0 + 0.052, 1.59, DESK.z1 - 0.15), SCREEN, [FLAT, FLAT, FLAT, FLAT]);
    M.bx(-2.75, -2.35, 0.42, 0.48, -7.55, -7.15, BLACK); M.bx(-2.42, -2.35, 0.48, 0.95, -7.55, -7.15, BLACK); M.cyl(-2.55, 0, 0.42, -7.35, 0.18, 0.025, BLACK, 10);
    M.bx(-1.7, -0.1, 0.009, 0.014, -9.0, -7.2, RUG); // 地毯
    // ---- 獎盃櫃（西邊）：白色烤漆的底、黑框玻璃櫃、兩層、金邊 ----
    S.bx(CAB.x0, CAB.x1, 0, 0.9, CAB.z0, CAB.z1, LACQ);
    S.bx(CAB.x0, CAB.x0 + 0.05, 0.9, CAB.h, CAB.z0, CAB.z1, [0.5, 0.4, 0.25]); // 背板（香檳金）
    for (const z of [CAB.z0, CAB.z1, 0]) S.bx(CAB.x0, CAB.x1, 0.9, CAB.h, z - 0.025, z + 0.025, BLACK);
    S.bx(CAB.x0, CAB.x1, CAB.h - 0.05, CAB.h, CAB.z0, CAB.z1, BLACK); S.bx(CAB.x0 + 0.05, CAB.x1, 1.58, 1.6, CAB.z0, CAB.z1, [0.7, 0.7, 0.7]);
    G.bx(CAB.x1 - 0.005, CAB.x1 + 0.005, 0.88, 0.9, CAB.z0, CAB.z1, [1, 1, 1]);
    L.bx(CAB.x0 + 0.06, CAB.x0 + 0.1, CAB.h - 0.09, CAB.h - 0.06, CAB.z0 + 0.05, CAB.z1 - 0.05, LED2);
    CG.quad(V(CAB.x1, 0.9, CAB.z1), V(CAB.x1, 0.9, CAB.z0), V(CAB.x1, CAB.h - 0.05, CAB.z0), V(CAB.x1, CAB.h - 0.05, CAB.z1), [1, 1, 1], [FLAT, FLAT, FLAT, FLAT]);
    // ---- 沙發區（南邊）：黑皮沙發、大理石茶几（金腳）、落地燈、地毯 ----
    M.annulus(0.009, 0, 2.4, RUG, { cx: -0.5, cz: 8.4, seg: 40, uv: [FLAT, FLAT, FLAT, FLAT] });
    M.bx(SOFA.x0, SOFA.x1, 0.1, 0.44, SOFA.z0, SOFA.z1, LEATHER); M.bx(SOFA.x0, SOFA.x1, 0.1, 0.88, SOFA.z1 - 0.25, SOFA.z1, LEATHER);
    for (const x of [SOFA.x0, SOFA.x1 - 0.2]) M.bx(x, x + 0.2, 0.1, 0.62, SOFA.z0, SOFA.z1, LEATHER);
    for (let k = 0; k < 3; k++) { const x = SOFA.x0 + 0.25 + (k + 0.5) * ((SOFA.x1 - SOFA.x0 - 0.5) / 3); M.box(T4(x, 0.5, SOFA.z0 + 0.35), [1.18, 0.12, 0.62], [0.05, 0.045, 0.04]); }
    M.box(T4(SOFA.x0 + 0.6, 0.62, SOFA.z1 - 0.38, 0.2), [0.42, 0.36, 0.14], ORANGE);
    S.bx(TABLE.x - TABLE.hx, TABLE.x + TABLE.hx, 0.38, 0.42, TABLE.z - TABLE.hz, TABLE.z + TABLE.hz, WHITE, null);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.cyl(TABLE.x + sx * (TABLE.hx - 0.08), 0, 0.38, TABLE.z + sz * (TABLE.hz - 0.06), 0.015, 0.015, [1, 1, 1], 6);
    G.cyl(LAMP.x, 0, 0.03, LAMP.z, 0.2, 0.2, [1, 1, 1], 16); G.cyl(LAMP.x, 0.03, 1.5, LAMP.z, 0.015, 0.015, [1, 1, 1], 6); L.cyl(LAMP.x, 1.45, 1.75, LAMP.z, 0.24, 0.18, LAMPC, 16);
    // ---- 盆栽（門的兩邊、西邊兩個）：白色大理石盆、一叢葉子 ----
    for (const [x, z] of PLANTS) {
      S.cyl(x, 0, 0.7, z, 0.34, 0.42, WHITE, 18, null);
      M.cyl(x, 0.66, 0.7, z, 0.38, 0.38, [0.06, 0.04, 0.03], 18);
      for (let k = 0; k < 7; k++) { const a = k * 0.9, r = k ? 0.22 : 0; M.geo(new THREE.IcosahedronGeometry(0.34 - k * 0.01, 0), T4(x + Math.cos(a) * r, 1.05 + (k % 3) * 0.28 + (k ? 0 : 0.5), z + Math.sin(a) * r, a), k & 1 ? LEAF : LEAF2, FLAT); }
    }
    // ---- 第 24 批：外面繞圈的斜坡（只有村子裡那棟、別人家的外殼才有：車庫頁看不到外面，不畫）：X 大理石／柏油、XG 金色、XL 亮的 ----
    const X = mesher(), XG = mesher(), XL = mesher(), Y = towerRampY, UE = RA.UEND, FU = [FLAT, FLAT, FLAT, FLAT];
    const ASPH = [0.07, 0.07, 0.075], LINEW = [0.85, 0.85, 0.83], ORG = [0.53, 0.06, 0.012], CONC = [0.6, 0.6, 0.58];
    const P3 = (r, a, y) => V(r * Math.cos(a), y, r * Math.sin(a));
    // 一條帶子（u0 … u1，每 3.75 度一段）：'up'／'down'＝平的（半徑 r0 … r1、高 f0(u)）；'out'／'in'＝直的（半徑 r0、高 f0(u) … f1(u)）
    const rib = (m, r0, r1, f0, f1, col, u0, u1, kind, uv) => {
      const n = Math.max(1, Math.ceil((u1 - u0) / (Math.PI / 48)));
      for (let s = 0; s < n; s++) {
        const ua = u0 + ((u1 - u0) * s) / n, ub = u0 + ((u1 - u0) * (s + 1)) / n, aa = RA.A0 + ua, ab = RA.A0 + ub, am = (aa + ab) / 2;
        if (kind === 'up' || kind === 'down') face4(m, P3(r0, aa, f0(ua)), P3(r1, aa, f0(ua)), P3(r1, ab, f0(ub)), P3(r0, ab, f0(ub)), col, uv, 0, kind === 'up' ? 1 : -1, 0);
        else { const sg = kind === 'out' ? 1 : -1; face4(m, P3(r0, aa, f0(ua)), P3(r0, ab, f0(ub)), P3(r0, ab, f1(ub)), P3(r0, aa, f1(ua)), col, uv, sg * Math.cos(am), 0, sg * Math.sin(am)); }
      }
    };
    const yd = (u) => Y(u) + 0.012, yb = (u) => Y(u) - RA.RT, yp = (u) => Y(u) + RA.PH, yc = (u) => Y(u) + RA.CURB, yl = (u) => Y(u) + 0.022, yg = () => -0.4;
    rib(X, RA.R0, RA.R1, yd, null, ASPH, 0, UE, 'up', FU); // 路面（柏油）
    rib(X, RA.R0, RA.R1, yb, null, UNDER, Math.PI, UE, 'down', FU); // 底下（第一個半圈是實心的，看不到）
    rib(X, RA.R1, 0, yb, yp, WHITE, 0, UE, 'out'); // 外面：路面的邊＋護欄（白大理石）
    rib(X, RA.R1 - 0.25, 0, yd, yp, WHITE, 0, UE, 'in'); // 護欄裡面
    rib(XG, RA.R1 - 0.27, RA.R1 + 0.02, yp, null, [1, 1, 1], 0, UE, 'up', FU); // 護欄上面：金色
    rib(X, RA.R0, 0, yb, yc, WHITE, 0, UE, 'in'); // 裡面的矮牆（朝塔）
    rib(X, RA.R0, RA.R0 + 0.3, yc, null, WHITE, 0, UE, 'up');
    rib(X, RA.R0 + 0.3, 0, yd, yc, WHITE, 0, UE, 'out');
    rib(X, RA.R0 + 0.5, RA.R0 + 0.62, yl, null, LINEW, 0.05, UE - 0.05, 'up', FU); // 白邊線
    rib(X, RA.R1 - 0.62, RA.R1 - 0.5, yl, null, LINEW, 0.05, UE - 0.05, 'up', FU);
    { const du = 2.4 / RA.RM; for (let u = 0.9; u + du < UE - 0.25; u += 2 * du) rib(X, RA.RM - 0.06, RA.RM + 0.06, yl, null, LINE, u, u + du, 'up', FU); } // 中間的黃虛線
    rib(X, RA.R1, 0, yg, yb, WHITE, 0, Math.PI, 'out'); rib(X, RA.R0, 0, yg, yb, WHITE, 0, Math.PI, 'in'); // 第一個半圈（低的）：下面是實心的牆
    { const a = RA.A0 + Math.PI, y1 = yb(Math.PI); face4(X, P3(RA.R0, a, -0.4), P3(RA.R1, a, -0.4), P3(RA.R1, a, y1), P3(RA.R0, a, y1), WHITE, undefined, -Math.sin(a), 0, Math.cos(a)); } // π 那邊的端牆（後面車子開得到下面）
    { const a = RA.A0; face4(X, P3(RA.R1 - 0.25, a, -0.4), P3(RA.R1, a, -0.4), P3(RA.R1, a, RA.PH), P3(RA.R1 - 0.25, a, RA.PH), WHITE, undefined, Math.sin(a), 0, -Math.cos(a)); // 起點：護欄、矮牆的頭
      face4(X, P3(RA.R0, a, -0.4), P3(RA.R0 + 0.3, a, -0.4), P3(RA.R0 + 0.3, a, RA.CURB), P3(RA.R0, a, RA.CURB), WHITE, undefined, Math.sin(a), 0, -Math.cos(a)); }
    { const a = RA.A0 + UE, y = Y(UE), rc = (RA.R0 + RA.R1) / 2; X.box(T4(rc * Math.cos(a), y + (RA.PH - RA.RT) / 2, rc * Math.sin(a), -a), [RA.R1 - RA.R0, RA.PH + RA.RT, 0.25], WHITE); XG.box(T4(rc * Math.cos(a), y + RA.PH + 0.01, rc * Math.sin(a), -a), [RA.R1 - RA.R0, 0.02, 0.27], [1, 1, 1]); } // 最上面的端牆
    for (const u of [0.18, 0.4]) { const a = RA.A0 + u, c = P3(RA.RM, a, 0), tx = -Math.sin(a), tz = Math.cos(a); chevron(X, c.x, c.z, tx, tz, (fw) => Y(u + fw / RA.RM) + 0.03, LINEW, 0.75, 1.3, 0.22); } // 起點的白箭頭（往上）
    X.annulus(0.008, RO + 0.32, RA.R1 + 0.3, CONC, { t0: -0.12, t1: RA.A0, seg: 96, uv: FU }); // 門口到斜坡起點的水泥地
    // 每一層的口：樓板伸出去接斜坡、橘色的框、牌子（2F … 6F，亮的字，朝外）
    const GLY = { 2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'], 6: ['111', '100', '111', '101', '111'], F: ['111', '100', '110', '100', '100'] };
    for (let f = 1; f <= RA.NE; f++) {
      const e = RA.ent(f), y0 = fy(f), y1 = ceilY(f), cs = Math.cos(e), sn = Math.sin(e);
      X.annulus(y0, RW - 0.05, RA.R0 + 0.05, SLABC, { t0: e - RA.GW, t1: e + RA.GW, seg: 112 });
      X.annulus(y0 - SLAB, RW - 0.05, RA.R0 + 0.05, UNDER, { t0: e - RA.GW, t1: e + RA.GW, seg: 112, up: false });
      for (const s of [-1, 1]) { const a = e + s * RA.GW; X.box(T4((RO + 0.12) * Math.cos(a), (y0 + y1) / 2, (RO + 0.12) * Math.sin(a), -a), [0.3, y1 - y0, 0.3], ORG); }
      const rc = (RO + 0.12) * Math.cos(RA.GW), pc = rc + 0.2, py = y1 - 0.62;
      X.box(T4(rc * cs, y1 - 0.15, rc * sn, -e), [0.3, 0.3, 2 * (RO + 0.12) * Math.sin(RA.GW) + 0.3], ORG); // 上面的橫樑
      X.box(T4(pc * cs, py, pc * sn, -e), [0.08, 0.66, 1.3], ORG); // 牌子
      const txt = [GLY[f + 1], null, GLY.F], px = 0.09, rr = pc + 0.046;
      txt.forEach((g, gi) => { if (g) g.forEach((row, ri) => [...row].forEach((on, ci) => { if (on !== '1') return; const col = gi * 2 + ci, tz = (3 - col) * px, yy = py + (2 - ri) * px; XL.box(T4(rr * cs - sn * tz, yy, rr * sn + cs * tz, -e), [0.012, px * 0.88, px * 0.88], LED); })); }); // 從外面看左到右＝往 −切線
    }
    Object.assign(GEO, { shell: S.build(), matte: M.build(), gold: G.build(), glass: GL.build(), clear: CG.build(), lights: L.build(), floor: F.build(), door: K.build(), pit: PM.build() });
    { const xs = X.build(), xg = XG.build(), xl = XL.build(); GEO.shellX = merge([GEO.shell, xs]); GEO.goldX = merge([GEO.gold, xg]); GEO.lightsX = merge([GEO.lights, xl]); for (const g of [xs, xg, xl]) g.dispose(); } // 村子那棟：外殼＋斜坡（一樣的 draw call 數）
    GEO.floorXY = GEO.floor.clone().rotateX(Math.PI / 2); // Reflector 要躺在 xy 平面、法線朝 +z（擺的時候再轉回來）
    // 電梯的圓台：深色大理石面、金色邊、白色箭頭（前面）
    const Pm = mesher();
    Pm.annulus(0, 0, RP, NERO, { seg: 56 });
    Pm.band(RP, -0.25, 0, [0.5, 0.36, 0.12], { seg: 56, flat: true });
    Pm.annulus(0.003, RP - 0.14, RP - 0.05, [0.9, 0.66, 0.22], { seg: 56, uv: [FLAT, FLAT, FLAT, FLAT] });
    for (const [x0, x1, w0, w1] of [[1.7, 2.3, 0.2, 0.2], [2.3, 2.8, 0.46, 0]]) Pm.quad(V(x0, 0.004, -w0), V(x0, 0.004, w0), V(x1, 0.004, w1), V(x1, 0.004, -w1 - 0.0001), [0.8, 0.8, 0.78], [FLAT, FLAT, FLAT, FLAT]);
    GEO.plat = Pm.build();
    GEO.ext = merge([GEO.shellX, GEO.floor, GEO.plat, GEO.door]); // 別人那幾間：外殼（第 24 批：連斜坡）＋地板＋停在一樓的圓台＋關著的門＝一個網格
    // 獎盃（9 個，越後面越大越華麗；按順序合進一個網格，setTrophies 用 drawRange 只畫前 n 個）：銅、銀、金
    const T = mesher(), ends = [0], spots = [];
    for (let k = 0; k < 5; k++) spots.push([CAB.x0 + 0.38, 0.9, CAB.z0 + 0.6 + k * 1.2]);
    for (let k = 0; k < 4; k++) spots.push([CAB.x0 + 0.38, 1.6, CAB.z0 + 1.2 + k * 1.2]);
    for (let k = 0; k < 9; k++) {
      const [x, y, z] = spots[k], s = 0.75 + k * 0.05, col = k < 3 ? [0.75, 0.42, 0.22] : k < 6 ? [0.9, 0.9, 0.92] : [1, 0.76, 0.34];
      T.box(T4(x, y + 0.04 * s, z), [0.16 * s, 0.08 * s, 0.16 * s], [0.02, 0.02, 0.022]);
      T.cyl(x, y + 0.08 * s, y + 0.2 * s, z, 0.03 * s, 0.018 * s, col, 10);
      T.geo(new THREE.LatheGeometry([[0.001, 0], [0.04, 0.01], [0.07, 0.05], [0.09, 0.12], [0.1, 0.19]].map(([r, h]) => new THREE.Vector2(r * s, h * s)), 18), T4(x, y + 0.2 * s, z), col, FLAT);
      for (const sz of [-1, 1]) T.geo(new THREE.TorusGeometry(0.04 * s, 0.008 * s, 6, 12, Math.PI), T4(x, y + 0.33 * s, z + sz * 0.095 * s).multiply(new THREE.Matrix4().makeRotationX(sz * Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2)), col, FLAT);
      if (k >= 6) { const st = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = (i & 1 ? 0.025 : 0.06) * s, t = Math.PI / 2 + (i * Math.PI) / 5; st[i ? 'lineTo' : 'moveTo'](Math.cos(t) * r, Math.sin(t) * r); } T.geo(new THREE.ExtrudeGeometry(st, { depth: 0.015 * s, bevelEnabled: false }), T4(x, y + 0.48 * s, z, Math.PI / 2), col, FLAT); }
      ends.push(T.count);
    }
    GEO.trophy = T.build(); GEO.trophyEnds = ends;
    return GEO;
  }

  // ---- 名牌（門上面）＋小房子的字：canvas 一張 1024 × 256（上半「大便龍的車庫」、下半「大便龍的家」）----
  const SIGN_FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
  function drawSign(cv, top = '大便龍的車庫', bottom = '大便龍的家') { // 第 23 批：去朋友家（town.src.js 把塔搬過去）寫他的名字
    const g = cv.getContext('2d'), W = cv.width, H = cv.height / 2;
    g.clearRect(0, 0, W, H * 2);
    const gold = (y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); for (const [t, c] of [[0, '#fff3cf'], [0.2, '#e9c77d'], [0.55, '#b98a3c'], [0.8, '#d9b366'], [1, '#8a6427']]) gr.addColorStop(t, c); return gr; };
    const plate = (y, txt, px) => {
      g.fillStyle = '#121316'; g.fillRect(0, y, W, H);
      g.strokeStyle = '#b98a3c'; g.lineWidth = 6; g.strokeRect(8, y + 8, W - 16, H - 16);
      g.font = `700 ${px}px ${SIGN_FONT}`; const tw = g.measureText(txt).width; if (tw > W - 90) { px = Math.floor((px * (W - 90)) / tw); g.font = `700 ${px}px ${SIGN_FONT}`; }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(255,180,100,0.7)'; g.shadowBlur = 18; g.fillStyle = gold(y + H / 2 - px / 2, y + H / 2 + px / 2); g.fillText(txt, W / 2, y + H / 2 + 4); g.shadowBlur = 0;
    };
    plate(0, top, 92); plate(H, bottom, 92);
  }

  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); return a < 0 ? a + Math.PI : a - Math.PI; };

  function buildRoom(renderer, { quality = 'high', exterior = false } = {}) {
    const hi = quality !== 'low' && !exterior, G0 = shellGeos(), trash = [], keep = (o) => (trash.push(o), o);
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    let dead = false;
    const group = new THREE.Group(); group.name = 'room';
    const inner = new THREE.Group(); inner.name = 'roomInterior';
    const outer = new THREE.Group(); outer.name = 'roomExterior';
    group.add(inner, outer);
    // ---- 材質 ----
    const marbleTex = keep(new THREE.CanvasTexture(marbleCanvas(hi ? 1024 : 512))); marbleTex.colorSpace = THREE.SRGBColorSpace; marbleTex.wrapS = marbleTex.wrapT = THREE.RepeatWrapping; marbleTex.anisotropy = aniso;
    const shellMat = keep(new THREE.MeshStandardMaterial({ map: marbleTex, vertexColors: true, roughness: 0.3, metalness: 0 }));
    const matteMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }));
    const goldMat = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.78, 0.55, 0.2), roughness: 0.35, metalness: exterior ? 0.35 : 0.9 })); // 村子沒有房間的環境貼圖：金屬感低一點（不然黑黑的）
    const glassMat = keep(exterior
      ? new THREE.MeshStandardMaterial({ color: 0x9cc7e0, transparent: true, opacity: 0.24, roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: 0xdfe8ee, emissive: 0xc4d3df, emissiveIntensity: 1.05, transparent: true, opacity: 0.93, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false })); // 車庫頁：外面是黑的，玻璃做成亮亮的霧面（白天的光）
    const lightMat = keep(new THREE.MeshBasicMaterial({ vertexColors: true }));
    const clearMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.04, metalness: 0, side: THREE.DoubleSide, depthWrite: false })); // 小房子的窗、獎盃櫃的玻璃（看得到裡面）
    const trophyMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: exterior ? 0.5 : 1 }));
    const floorMat = keep(new THREE.MeshStandardMaterial({ map: marbleTex, vertexColors: true, roughness: exterior ? 0.25 : 0.1, metalness: 0 }));
    const slatMat = keep(new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.38, metalness: 0.55 }));
    if (exterior) for (const m of [shellMat, floorMat]) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -4; } // 村子：塔的地板、圓台跟地面（草地、山）一樣高：往鏡頭推一點點（地面不用挖洞）
    const signCv = document.createElement('canvas'); signCv.width = 1024; signCv.height = 256; drawSign(signCv);
    const signTex = keep(new THREE.CanvasTexture(signCv)); signTex.colorSpace = THREE.SRGBColorSpace; signTex.anisotropy = aniso;
    const signMat = keep(new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }));
    // ---- 網格 ----
    const shell = new THREE.Mesh(exterior ? G0.shellX : G0.shell, shellMat), matte = new THREE.Mesh(G0.matte, matteMat), gold = new THREE.Mesh(exterior ? G0.goldX : G0.gold, goldMat), glass = new THREE.Mesh(G0.glass, glassMat), lights = new THREE.Mesh(exterior ? G0.lightsX : G0.lights, lightMat); // 第 24 批：村子那棟有斜坡
    const clear = new THREE.Mesh(G0.clear, clearMat);
    shell.name = 'roomShell'; matte.name = 'roomMatte'; gold.name = 'roomGold'; glass.name = 'roomGlass'; lights.name = 'roomLights'; clear.name = 'roomClear'; glass.renderOrder = 3; clear.renderOrder = 2;
    const tro = new THREE.Mesh(G0.trophy, trophyMat); tro.name = 'roomTrophies';
    // 地板：高畫質（車庫頁）＝Reflector（畫布一半的解析度，真的映出車）；其他＝亮面
    let floor, refl = null;
    if (hi) {
      const rs = renderer.getDrawingBufferSize(new THREE.Vector2());
      refl = new Reflector(G0.floorXY, { textureWidth: Math.max(2, Math.round(rs.x / 2)), textureHeight: Math.max(2, Math.round(rs.y / 2)), clipBias: 0.002, multisample: 0,
        shader: { name: 'TowerFloorStub', uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } }, vertexShader: 'void main() { gl_Position = vec4(0.0); }', fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }' } });
      const stub = refl.material;
      floorMat.userData.refl = { tRefl: { value: refl.getRenderTarget().texture }, uReflM: { value: stub.uniforms.textureMatrix.value }, uTexel: { value: new THREE.Vector2(2 / rs.x, 2 / rs.y) } };
      stub.dispose(); refl.material = floorMat;
      const ob = refl.onBeforeRender; // 反射只畫 layer 0（車內那些放別的 layer 的不反射）
      refl.onBeforeRender = function (r, s, cam) { refl.getReflectionCamera(cam).layers.set(0); ob.call(this, r, s, cam); };
      floorMat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, floorMat.userData.refl);
        sh.vertexShader = 'uniform mat4 uReflM; varying vec4 vReflUv;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vReflUv = uReflM * vec4(transformed, 1.0);');
        sh.fragmentShader = 'uniform sampler2D tRefl; uniform vec2 uTexel; varying vec4 vReflUv;\nvec3 rTap(vec2 uv) { return clamp(texture2D(tRefl, uv).rgb, 0.0, 40.0); }\n' + sh.fragmentShader
          .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
  { vec2 uv = vReflUv.xy / vReflUv.w, o = uTexel * 0.9;
    vec3 rc = rTap(uv) * 0.36 + (rTap(uv + o) + rTap(uv - o) + rTap(uv + vec2(o.x, -o.y)) + rTap(uv + vec2(-o.x, o.y))) * 0.16;
    radiance = rc / (1.0 + 0.1 * max(rc.r, max(rc.g, rc.b))) * 1.6; }`);
      };
      floorMat.customProgramCacheKey = () => 'tower-floor-hi';
      floor = refl; floor.rotation.x = -Math.PI / 2;
    } else floor = new THREE.Mesh(G0.floor, floorMat);
    floor.name = 'roomFloor';
    // 名牌（門楣外面）、小房子的字（南牆外面）
    const signGeo = (() => {
      const P = [], UV = [], I = [], q = (pts, v0, v1) => { const b = P.length / 3; pts.forEach((p, i) => { P.push(...p); UV.push(i === 1 || i === 2 ? 1 : 0, i < 2 ? v0 : v1); }); I.push(b, b + 1, b + 2, b, b + 2, b + 3); };
      const yc = (DH + H1) / 2 + 0.02, w = 3.2, h = 0.31, x = DX1 + 0.055;
      q([[x, yc - h, w], [x, yc - h, -w], [x, yc + h, -w], [x, yc + h, w]], 0.5, 1); // 朝 +x：寬往 −z（從外面看左到右＝z 從大到小）
      const hx = -0.9, hy = 2.5, hw = 1.1, hh = 0.27, hz = HZ1 + 0.008;
      q([[hx - hw, hy - hh, hz], [hx + hw, hy - hh, hz], [hx + hw, hy + hh, hz], [hx - hw, hy + hh, hz]], 0, 0.5); // 朝 +z
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeBoundingSphere(); return g;
    })();
    const sign = new THREE.Mesh(keep(signGeo), signMat); sign.name = 'roomSign';
    // 鐵捲門：16 片門片（InstancedMesh），開的時候一片一片往上收進門楣
    const slatGeo = keep(new THREE.BoxGeometry(0.05, SH - 0.012, 2 * DZ));
    const slats = new THREE.InstancedMesh(slatGeo, slatMat, NS); slats.name = 'roomDoor'; slats.frustumCulled = false;
    { const c = new THREE.Color(); for (let k = 0; k < NS; k++) slats.setColorAt(k, c.setScalar(k === 0 ? 0.25 : k & 1 ? 1 : 0.9)); }
    inner.add(floor, shell, matte, gold, glass, clear, lights, tro, slats);
    outer.add(sign);
    // ---- 每層的車位：Group（cull 開關）；每格一個 Group（車子掛上去＝車頭朝外）----
    const floors = [], bayG = [];
    for (let f = 0; f < NF; f++) { const g = new THREE.Group(); g.name = 'towerFloor' + (f + 1); floors.push(g); group.add(g); }
    for (const b of TOWER_BAYS) { const g = new THREE.Group(); g.name = 'towerBay' + (b.id + 1); g.position.set(b.x, b.y, b.z); g.rotation.y = b.heading; floors[b.f].add(g); bayG.push(g); }
    const cars = Array(TOWER_BAYS.length).fill(null), names = Array(TOWER_BAYS.length).fill(null);
    // ---- 電梯的圓台 ----
    const platform = new THREE.Group(); platform.name = 'towerLift'; group.add(platform);
    const platMesh = new THREE.Mesh(G0.plat, shellMat); platMesh.name = 'towerLiftDeck'; platform.add(platMesh);
    const pit = new THREE.Mesh(G0.pit, shellMat); pit.name = 'towerPit'; pit.visible = false; inner.add(pit); // 圓台離開一樓才看得到坑
    const lift = { y: 0, rot: 0, floor: 0, busy: false };
    const A = { t: 0, T: 1, y0: 0, y1: 0, r0: 0, r1: 0, f: 0, onDone: null };
    const place = () => { platform.position.y = lift.y; platform.rotation.y = lift.rot; pit.visible = lift.y > 0.02; };
    // ---- 鐵捲門 ----
    const DS = { t: 0, target: 0, speed: 1 };
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _z = new THREE.Vector3(0, 0, 0);
    const layoutDoor = () => { // 最下面那片的底在 t × 門高；超過門高的收進門楣（不畫）
      const lift0 = DS.t * DH;
      for (let k = 0; k < NS; k++) { const y = (k + 0.5) * SH + lift0, show = y < DH - SH * 0.3; _p.set(XS, y, 0); _m.compose(_p, _q, show ? _s : _z); slats.setMatrixAt(k, _m); }
      slats.instanceMatrix.needsUpdate = true;
    };
    layoutDoor();
    const door = {
      get t() { return DS.t; }, set t(v) { DS.t = DS.target = Math.max(0, Math.min(1, +v || 0)); layoutDoor(); },
      get moving() { return DS.t !== DS.target; },
      open(sec = 2.2) { DS.target = 1; DS.speed = 1 / Math.max(0.05, sec); },
      close(sec = 1.8) { DS.target = 0; DS.speed = 1 / Math.max(0.05, sec); },
      update(dt) {
        if (DS.t === DS.target) return false;
        dt = Math.max(0, Math.min(0.1, +dt || 0));
        const st = DS.speed * dt;
        DS.t = DS.t < DS.target ? Math.min(DS.target, DS.t + st) : Math.max(DS.target, DS.t - st);
        layoutDoor();
        return DS.t !== DS.target;
      },
    };
    // ---- 停車位、區域 ----
    const spots = {
      main: { x: 0, z: 0, heading: 0 }, outside: { x: DX1 + 4.2, z: 0, heading: 0 },
      bed: { x: -2.1, y: BED.top, z: -9.4, heading: -Math.PI / 2, head: { x: -2.1, z: -10.15 }, feet: { x: -2.1, z: -8.6 } }, // 躺在床上：角色的 group 放 feet（高 y）、rotation.y＝heading、state 'fall' → 頭朝 head
      wake: { x: -1.2, z: -9.3, heading: -Math.PI / 2 }, // 起床：站在床邊、面向門（+z）
      houseIn: { x: (HD0 + HD1) / 2, z: IZ1 - 0.9, heading: Math.PI / 2 }, houseOut: { x: (HD0 + HD1) / 2, z: HZ1 + 0.8, heading: -Math.PI / 2 },
    };
    const zones = {
      inside: { x: 0, z: 0, hx: RO, hz: RO }, door: { x: DX0, z0: -DZ, z1: DZ, x1: DX1, h: DH }, apron: { x: DX1 + 3, z: 0, hx: 3, hz: DZ + 1 },
      house: { x: (IX0 + IX1) / 2, z: (IZ0 + IZ1) / 2, hx: (IX1 - IX0) / 2, hz: (IZ1 - IZ0) / 2, ceil: HC, ridge: HC },
      bedSide: { x: -1.2, z: -9.4, hx: 0.35, hz: 0.5 }, // 站在這裡 →「睡覺」
      dress: { x: WARD.x0 - 0.42, z: (WARD.z0 + WARD.z1) / 2, hx: 0.33, hz: 0.45 }, // 衣櫃前面 →「換衣服」
      houseDoor: { x: (HD0 + HD1) / 2, z: (IZ1 + HZ1) / 2, hx: (HD1 - HD0) / 2, hz: HT / 2, h: HDH },
      pad: { x: 0, z: 0, r: RP }, // 電梯圓台
    };
    const house = { door: { x: (HD0 + HD1) / 2, z: HZ1 + 0.3, ry: 0, w: HD1 - HD0, h: HDH }, zone: zones.house, bedSide: zones.bedSide, bed: spots.bed, wake: spots.wake, ceil: HC, ridge: HC, beam: HC };
    // ---- 碰撞（本地）：一樓＝玻璃一圈（門洞留口）、門洞兩邊的牆、家具；樓上＝玻璃一整圈、井邊的柱子；電梯不在這層（或在動）＝井擋起來；門關著＝最後一個 ----
    const ring = (n, t0, t1, h) => { const out = [], da = (t1 - t0) / n; for (let k = 0; k < n; k++) { const a = t0 + (k + 0.5) * da, r = RO + 0.1; out.push({ t: 'box', x: r * Math.cos(a), z: r * Math.sin(a), hx: r * Math.tan(da / 2) + 0.12, hz: 0.18, rot: -a - Math.PI / 2, h }); } return out; };
    const bxc = (x0, x1, z0, z1, h) => ({ t: 'box', x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, rot: 0, h });
    const COL0 = [...ring(28, GAP, Math.PI * 2 - GAP, TOP + 0.7),
      bxc(XP - 0.2, DX1, -PZ, -DZ, H1), bxc(XP - 0.2, DX1, DZ, PZ, H1), // 門洞兩邊的牆
      bxc(HX0, HX1, HZ0, IZ0, HW), bxc(HX0, IX0, IZ0, IZ1, HW), bxc(IX1, HX1, IZ0, IZ1, HW), bxc(HX0, HD0, IZ1, HZ1, HW), bxc(HD1, HX1, IZ1, HZ1, HW), // 小房子的牆（門洞留著）
      bxc(BED.x0 - 0.04, BED.x1 + 0.04, BED.z0 - 0.03, BED.z1, 0.62), bxc(WARD.x0, WARD.x1, WARD.z0, WARD.z1, WARD.h), bxc(DESK.x0, DESK.x1, DESK.z0, DESK.z1, DESK.top),
      bxc(BED.x1 + 0.05, BED.x1 + 0.42, BED.z0 + 0.02, BED.z0 + 0.42, 0.6), { t: 'circle', x: -2.55, z: -7.35, r: 0.24, h: 0.95 }, bxc(HD1 - 0.05, HD1 + 0.01, IZ1 - 1.0, IZ1, HDH), // 床頭櫃、椅子、開著的門
      bxc(CAB.x0, CAB.x1, CAB.z0, CAB.z1, CAB.h), bxc(SOFA.x0, SOFA.x1, SOFA.z0, SOFA.z1, 0.88), bxc(TABLE.x - TABLE.hx, TABLE.x + TABLE.hx, TABLE.z - TABLE.hz, TABLE.z + TABLE.hz, 0.42),
      { t: 'circle', x: LAMP.x, z: LAMP.z, r: 0.22, h: 1.75 }, ...PLANTS.map(([x, z]) => ({ t: 'circle', x, z, r: 0.45, h: 1.9 }))];
    const COLU = [...ring(30, 0, Math.PI * 2, TOP + 0.7)];
    const COLR = [null]; for (let f = 1; f < NF; f++) { const e = TOWER_RAMP.ent(f), g = TOWER_RAMP.GW; COLR.push(ring(28, e + g, e + Math.PI * 2 - g, TOP + 0.7)); } // 第 24 批：開車的時候樓上的玻璃留斜坡的口（走路的照舊一整圈）
    const PIT0 = { t: 'circle', x: 0, z: 0, r: RP + 0.16, h: 0.3 }, HOLE = { t: 'circle', x: 0, z: 0, r: RI + 0.02, h: TOP }; // 一樓的坑（低）、樓上的洞
    const DOOR_COL = { t: 'box', x: XS, z: 0, hx: 0.25, hz: DZ, rot: 0, h: DH };
    const liftHere = (f) => !lift.busy && lift.floor === f && Math.abs(lift.y - fy(f)) < 1e-3;
    const isInside = (x, z, m = 0) => x * x + z * z < (RO - m) * (RO - m) || (x > XP - 0.5 && x < DX0 + 0.2 && Math.abs(z) < DZ - m);
    const groupRY = () => { group.updateMatrixWorld(); const e = group.matrixWorld.elements; return Math.atan2(e[8], e[10]); };
    const toWorld = (p) => { const ry = groupRY(); _w.set(p.x, 0, p.z).applyMatrix4(group.matrixWorld); return { x: _w.x, y: _w.y, z: _w.z, heading: (p.heading || 0) + ry }; }; // y＝塔的一樓地板在世界多高（山頂那間 ≈ 103）
    const toLocal = (x, z) => { group.updateMatrixWorld(); _w.set(x, group.matrixWorld.elements[13], z); group.worldToLocal(_w); return { x: _w.x, z: _w.z }; };
    function toWorldCols(out, yOff = false) { const ry = groupRY(), by = yOff ? group.matrixWorld.elements[13] : 0; for (const c of out) { _w.set(c.x, 0, c.z).applyMatrix4(group.matrixWorld); c.x = _w.x; c.z = _w.z; if (c.t === 'box') c.rot = (c.rot || 0) + ry; if (by) { c.h = (c.h ?? 9) + by; c.y0 = (c.y0 || 0) + by; } } return out; } // yOff：高度也換成世界的（只擋鏡頭的那些）
    const api = { group, size: { X: DX0, T: DX1 - DX0, DZ, DH, XB: -RO, Z: RO, H: ceilY(0), TOP: H1, round: true }, door, spots, zones, house, interior: inner, exterior: outer,
      bays: TOWER_BAYS, floors, cars, platform, lift, onLift: null, floor: 0, colVer: 0, isInside, toWorld, toLocal, liftHere, fy, envRotation: new THREE.Euler() };
    const colliders = (doorOpen = DS.t >= 0.9, world = false, car = false) => { // 鐵捲門那個盒子一定放最後一個（walk.js 靠這個認門）；car：第 24 批，開車（樓上留斜坡的口）
      const f = api.floor, out = (f ? (car ? COLR[f] : COLU) : COL0).map((c) => ({ ...c }));
      if (!liftHere(f)) out.push({ ...(f ? HOLE : PIT0) });
      if (!doorOpen) out.push({ ...DOOR_COL });
      return world ? toWorldCols(out) : out;
    };
    // 只擋鏡頭的（y0＝底；給 walk.js 的 addColliders，不要給 drive.js）：這一層的天花板（圓的）；一樓多：小房子的屋頂、門楣
    const cameraColliders = (world = false) => {
      const f = api.floor, out = [{ t: 'circle', x: 0, z: 0, r: RW + 0.3, y0: ceilY(f), h: TOP + 1 }];
      if (!f) out.push({ t: 'box', x: (HX0 + HX1) / 2, z: (HZ0 + HZ1) / 2, hx: (HX1 - HX0) / 2 + 0.15, hz: (HZ1 - HZ0) / 2 + 0.15, rot: 0, y0: HC - 0.02, h: HW + 0.15 },
        { t: 'box', x: (XP + DX1) / 2, z: 0, hx: (DX1 - XP) / 2, hz: PZ, rot: 0, y0: DH, h: H1 });
      return world ? toWorldCols(out, true) : out;
    };
    // ceilingAt(x, z, world)：現在這一層、這一點頭上多高（本地 y；第三人稱鏡頭別穿過去）；塔外面 Infinity
    const ceilingAt = (x, z, world = false) => {
      if (world) ({ x, z } = toLocal(x, z));
      const f = api.floor, r2 = x * x + z * z;
      if (!f) {
        if (x > HX0 - 0.15 && x < HX1 + 0.15 && z > HZ0 - 0.15 && z < HZ1 + 0.15) return x > IX0 && x < IX1 && z > IZ0 && z < IZ1 ? HC : HW;
        if (x > XP - 0.2 && x < DX1 + 0.05 && Math.abs(z) < PZ) return DH;
        return r2 < RW * RW ? ceilY(0) : Infinity;
      }
      return r2 < RW * RW ? ceilY(f) : Infinity;
    };
    // heightAt(x, z)：塔裡面（樓板蓋得到的地方）→ 現在這一層的地板（本地 y）；外面 null
    const heightAt = (x, z) => (x * x + z * z < RW * RW ? fy(api.floor) : null);
    const setFloor = (f) => { f = Math.max(0, Math.min(NF - 1, f | 0)); if (f !== api.floor) { api.floor = f; api.colVer++; } };
    // ---- 電梯：liftTo(f, rot, onDone)：去第 f 層、轉到 rot（同時動）；moveT：越遠越久 ----
    const moveT = (dy, dr) => Math.max(0.8, Math.abs(dy) / 3.6 + 0.7, Math.abs(dr) / 1.5 + 0.3);
    const liftTo = (f, rot = lift.rot, onDone) => {
      if (lift.busy) return false;
      f = Math.max(0, Math.min(NF - 1, f | 0));
      const dr = wrap(rot - lift.rot);
      Object.assign(A, { t: 0, y0: lift.y, y1: fy(f), r0: lift.rot, r1: lift.rot + dr, f, onDone: onDone || null, T: moveT(fy(f) - lift.y, dr) });
      lift.busy = true; api.colVer++; api.onLift?.('start');
      return true;
    };
    const liftSnap = (f = 0, rot = 0) => { lift.busy = false; A.onDone = null; lift.floor = Math.max(0, Math.min(NF - 1, f | 0)); lift.y = fy(lift.floor); lift.rot = wrap(rot); place(); api.colVer++; };
    const liftStep = (dt) => {
      if (!lift.busy) return false;
      A.t += Math.max(0, Math.min(0.1, +dt || 0));
      const k = ease(A.t / A.T);
      lift.y = A.y0 + (A.y1 - A.y0) * k; lift.rot = A.r0 + (A.r1 - A.r0) * k; place();
      if (A.t >= A.T) { lift.busy = false; lift.floor = A.f; lift.y = A.y1; lift.rot = wrap(A.r1); place(); api.colVer++; const f = A.onDone; A.onDone = null; api.onLift?.('stop'); f?.(); }
      return lift.busy;
    };
    // ---- 停車格：put／take（跟 ringgar.js 一樣）----
    const put = (i, obj, name) => {
      const old = cars[i];
      if (typeof obj === 'string') { name = obj; obj = null; }
      if (obj?.isObject3D) { if (old?.isObject3D && old !== obj && old.parent === bayG[i]) old.removeFromParent(); bayG[i].add(obj); obj.position.set(0, 0, 0); obj.rotation.set(0, 0, 0); }
      cars[i] = obj || old || true; names[i] = name != null ? String(name) : obj?.name || ''; return api;
    };
    const take = (i) => { const o = cars[i]; if (o?.isObject3D && o.parent === bayG[i]) o.removeFromParent(); cars[i] = null; names[i] = null; return o?.isObject3D ? o : null; };
    // ---- 照鏡頭開關每一層的車：在塔裡面＝只畫那一層（電梯在動：電梯那層也畫）；外面＝90 公尺內都畫 ----
    const cullOut = { inside: false, house: false, ceil: Infinity, floor: 0 }, vis = Array(NF).fill(true);
    const cull = (camera) => {
      group.updateMatrixWorld(); _v.setFromMatrixPosition(camera.matrixWorld); group.worldToLocal(_v);
      const cx = _v.x, cy = _v.y, cz = _v.z, d = Math.hypot(cx, cz), inside = d < RO + 0.2 && cy < TOP && cy > -1;
      let cf = 0; for (let f = 1; f < NF; f++) if (cy >= fy(f) - 0.05) cf = f;
      for (let f = 1; f < NF; f++) vis[f] = inside ? f === cf || (lift.busy && Math.abs(lift.y - fy(f)) < FH) : exterior && d < 90;
      for (let f = 1; f < NF; f++) if (floors[f].visible !== vis[f]) floors[f].visible = vis[f];
      cullOut.inside = inside; cullOut.floor = cf; cullOut.house = inside && !cf && cx > IX0 && cx < IX1 && cz > IZ0 && cz < IZ1 && cy < HC; cullOut.ceil = ceilingAt(cx, cz);
      return cullOut;
    };
    // ---- 車庫頁的鏡頭：留在大廳裡面（玻璃裡、天花板下、不鑽進小房子、獎盃櫃、沙發、盆栽）：p 從 t 往外那條線上縮回來 ----
    const KEEP = [[HX0 - 0.35, HX1 + 0.35, HZ0 - 1, HZ1 + 0.35], [CAB.x0 - 1, CAB.x1 + 0.35, CAB.z0 - 0.35, CAB.z1 + 0.35], [SOFA.x0 - 0.35, SOFA.x1 + 0.35, SOFA.z0 - 0.35, SOFA.z1 + 1], ...PLANTS.map(([x, z]) => [x - 0.8, x + 0.8, z - 0.8, z + 0.8])];
    const camOK = (x, y, z) => x * x + z * z < 10.6 * 10.6 && y < ceilY(0) - 0.35 && !KEEP.some((b) => x > b[0] && x < b[1] && z > b[2] && z < b[3]);
    const camClamp = (p, t) => {
      if (camOK(p.x, p.y, p.z)) return false;
      let lo = 0, hi2 = 1;
      for (let i = 0; i < 14; i++) { const m = (lo + hi2) / 2; if (camOK(t.x + (p.x - t.x) * m, t.y + (p.y - t.y) * m, t.z + (p.z - t.z) * m)) lo = m; else hi2 = m; }
      p.set(t.x + (p.x - t.x) * lo, t.y + (p.y - t.y) * lo, t.z + (p.z - t.z) * lo); return true;
    };
    // ---- 環境貼圖（車庫頁：車漆映出白色大理石地板、亮亮的玻璃、天花板的燈圈）：不打光的材質畫一個簡單的大廳，從圓台上面拍 ----
    let envRT = null;
    if (!exterior) {
      const E = mesher();
      E.annulus(0, 0, RO, [0.62, 0.61, 0.59], { seg: 48 });
      E.band(RO, 0, 0.35, [0.02, 0.02, 0.025], { out: false, seg: 48 });
      E.band(RO, 0.35, ceilY(0), [1.35, 1.45, 1.55], { out: false, seg: 48 });
      for (let k = 0; k < 24; k++) { const a = (k + 0.5) * (Math.PI / 12); E.box(T4((RO - 0.05) * Math.cos(a), ceilY(0) / 2, (RO - 0.05) * Math.sin(a), -a), [0.16, ceilY(0), 0.12], [0.02, 0.02, 0.022]); }
      E.annulus(ceilY(0), RI, RO, [0.66, 0.66, 0.65], { seg: 48, up: false });
      E.annulus(ceilY(0) - 0.01, 7.15, 7.45, [9, 7.8, 6.2], { seg: 64, up: false });
      E.annulus(ceilY(0) - 0.01, RI + 0.15, RI + 0.3, [6, 5.4, 4.5], { seg: 48, up: false });
      E.annulus(ceilY(0) + 2.5, 0, RI, [0.3, 0.3, 0.3], { seg: 24, up: false });
      E.band(RI, ceilY(0), ceilY(0) + 2.5, [0.5, 0.5, 0.5], { out: false, seg: 24 });
      E.bx(HX0, HX1, 0, HW, HZ0, HZ1, [0.7, 0.68, 0.64]);
      E.bx(SOFA.x0, SOFA.x1, 0, 0.9, SOFA.z0, SOFA.z1, [0.03, 0.03, 0.03]);
      const envScene = new THREE.Scene(); envScene.background = new THREE.Color(0.3, 0.3, 0.3);
      const eg = E.build(), em = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
      envScene.add(new THREE.Mesh(eg, em));
      const pmrem = new THREE.PMREMGenerator(renderer);
      envRT = pmrem.fromScene(envScene, 0.02, 0.05, 60, { size: 256, position: V(0, 1.1, 0) });
      pmrem.dispose(); eg.dispose(); em.dispose();
    }
    if (envRT) for (const m of [shellMat, matteMat, goldMat, trophyMat, floorMat, slatMat, clearMat]) { m.envMap = envRT.texture; m.envMapIntensity = 1; }
    let signTxt = []; // 名牌現在寫什麼（空的＝大便龍的車庫／大便龍的家）；字型還沒載好就先記著
    const setSign = (top, bottom) => { signTxt = top ? [String(top), String(bottom || top)] : []; drawSign(signCv, ...signTxt); signTex.needsUpdate = true; };
    const setTrophies = (n) => { n = Math.max(0, Math.min(9, Math.floor(+n || 0))); tro.geometry.setDrawRange(0, G0.trophyEnds[n]); tro.visible = n > 0; };
    setTrophies(0);
    const ready = Promise.race([document.fonts?.load ? document.fonts.load(`700 92px ${SIGN_FONT}`, '大便龍的車庫家') : Promise.resolve(), new Promise((r) => setTimeout(r, 1500))])
      .catch(() => {}).then(() => { if (!dead) { drawSign(signCv, ...signTxt); signTex.needsUpdate = true; } });
    const resize = (w, h) => {
      if (!refl) return;
      if (!w || !h) { const v = renderer.getDrawingBufferSize(new THREE.Vector2()); w = v.x; h = v.y; }
      const rw = Math.max(2, Math.round(w / 2)), rh = Math.max(2, Math.round(h / 2));
      refl.getRenderTarget().setSize(rw, rh); floorMat.userData.refl.uTexel.value.set(1 / rw, 1 / rh);
    };
    const update = (dt) => { const a = door.update(dt), b = liftStep(dt); return a || b; };
    const dispose = () => { dead = true; group.removeFromParent(); for (const o of trash) o.dispose(); if (refl) refl.getRenderTarget().dispose(); envRT?.dispose(); };
    api.parts = [{ geometry: G0.ext, material: shellMat, name: 'shell' }, { geometry: G0.matte, material: matteMat, name: 'matte' }, { geometry: G0.goldX, material: goldMat, name: 'gold' }, { geometry: G0.glass, material: glassMat, name: 'glass' }, { geometry: G0.clear, material: clearMat, name: 'clear' }, { geometry: G0.lightsX, material: lightMat, name: 'lights' }];
    const rampColliders = (F, world = false) => (world ? toWorldCols(towerRampCols(F)) : towerRampCols(F)); // 第 24 批：開在斜坡上（樓上）的矮牆、護欄（F 那一層的口開著）
    Object.assign(api, { env: envRT ? envRT.texture : null, setTrophies, setSign, resize, dispose, ready, colliders, cameraColliders, rampColliders, ceilingAt, heightAt, setFloor, liftTo, liftSnap, put, take, cull, camClamp, update,
      setExterior: () => {}, setCutaway: () => {} });
    return api;
  }
  return { buildRoom };
})();
