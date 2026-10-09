// 白色大理石車庫（Nick 2026-09-28：「車庫要真的可以停車然後要可以開鐵捲門自己開出去 車庫要是白色大理石的色系⋯買完自己開回去然後打開鐵捲門然後就可以把它開進去自己的車庫」）
// 第 2 批：小房子（Nick：「我要有在車庫裡面有一個房子小房子可以睡覺的地方」）、升降停車格（Nick：「車庫是有升降停車格」）、走路（「⋯人可以下來走是要走上車開出去」）
// 同一棟房子兩個地方用：車庫頁（軌道鏡頭繞著停在原點的車，exterior 關）、村子裡你家那棟（exterior 開，放在世界座標的某個位置，鐵捲門真的會開）
// buildRoom(renderer, { quality = 'high', exterior = false }) → {
//   group, env, setTrophies(n), resize(w, h), dispose(), ready, size      ← 車庫頁原本就在用的（用法一樣）
//   door, spots, colliders(doorOpen, world), zones, setExterior(on), update(dt)   ← 村子要的
//   setBays(list), cull(camera), toWorld(p), toLocal(x, z), interior, exterior, envRotation   ← 多給的（可以不用）
//   lifts, parkSlots, freeSlot(), liftColliders(world), cameraColliders(world), onLift, house, ceilingAt(x, z, world), setCutaway(on)   ← 第 2 批：升降機、小房子、走路
// }
//   group：整棟（村子裡設 group.position、group.rotation.y 放到空地上；車庫頁放原點不要動）
//   env：房間的 PMREM（從主車位中間拍的），車庫頁給 scene.environment：車漆映出白色大理石、線燈、圓環燈
//   quality 'high'：地板是 Reflector（畫布一半的解析度，真的映出車），大理石紋疊在上面；'low'：地板只吃環境貼圖的亮面（村子、慢的手機）
//   setTrophies(n)：獎盃櫃擺前 n 個（0–9，贏過幾個不同的對手；越後面越大越華麗，第 9 個金色最大）
//   resize(w, h)：畫布的像素大小（drawing buffer）變了要叫（不給就自己問 renderer）；ready：Promise，招牌等到字型（最多 1.5 秒）重畫好
//   door：鐵捲門 { t（0 關 … 1 開，可以直接設）, open(sec = 2.2), close(sec = 1.8), update(dt) → 還在動就 true, moving }
//     一片一片的鋁門片沿著兩邊的導軌捲進門上面的捲筒（盒子裡）；在動的時候門邊的黃色警示燈會閃
//   update(dt)：每一格叫一次＝鐵捲門＋六台升降機（有東西在動就 true）；舊的頁面只叫 door.update(dt) 也可以（升降機就不會動）
//   spots：{ main: { x: 0, z: 0, heading: 0 }, bays: [6 個 { x, z, heading }], outside, bed, wake, houseIn, houseOut }
//     本地座標、車子原點（跟 buildCar 一樣：車子中心、地板上，車頭朝本地 +x）；heading＝rotation.y
//     main＝你開的那台停的地方（門前面、車頭朝外，在轉盤上）；bays[i]＝第 i 台升降機跟地板平的那一格（y 0；照車庫頁一開始的鏡頭看得到的順序排）
//     outside＝門外面車道上（車頭朝外），開出去的時候可以從這裡開始
//     bed＝躺在床上（左半邊）：{ x, y（床墊上面）, z, heading, head, feet }：角色 group 放 feet（高 y）、rotation.y＝heading、state 'fall' → 頭朝 head
//     wake＝起床站的地方（床邊、面向門）；houseIn／houseOut＝進門（面向房間裡）、出門（門外面、面向車庫）站的地方
//   colliders(doorOpen = door.t >= 0.9, world = false)：[{ t: 'box', x, z, hx, hz, rot, h } | { t: 'circle', x, z, r, h }]（盆栽是圓的，跟 village.js 一樣）
//     牆、壁柱、家具、小房子（牆留 1 公尺的門洞、開著的門、床、衣櫃、書桌⋯）、升降機（照現在的狀態：升起來＝四根柱子、在動＝整個坑、降下去＝沒有）、操作柱
//     門沒全開就多一塊門（x 4.85 … 5.3、z −DZ … DZ、h DH），一定是最後一個（walk.js 靠這個）；停著的車自己加；world＝true 直接給世界座標（rot 加上整棟轉的角度）
//     升降機一動（onLift）碰撞就變了：要重給（drive.js 的 'garage'、walk.js 再叫一次 setGarage）
//   zones：{ inside, door: { x, z0, z1, x1, h }, apron, house, bedSide, houseDoor, lifts: [6] }（apron＝門外面等開門的那一塊）
//     house＝小房子裡面的地板 { x, z, hx, hz, ceil（牆邊天花板高）, ridge（屋脊）}；bedSide＝站在這裡 →「睡覺」；houseDoor＝門洞；lifts[i]＝站在這裡 → 操作第 i 台升降機
//   house：{ door: { x, z, ry, w, h }（門外面一點；ry＝正面朝的方向，0＝本地 +z，跟 village.js buildings 的 door 一樣）, zone, bedSide, bed, wake, ceil, ridge, beam（屋脊樑底）}
//   ceilingAt(x, z, world)：這一點頭上多高有東西（第三人稱鏡頭的 maxY）：小房子（斜天花板、屋脊樑、屋簷底）、升起來的上層平台底、捲筒盒、車庫天花板；車庫外面 Infinity
//   setExterior(on)：外殼（外牆、屋頂、女兒牆、門面招牌、門外面那面鐵捲門、車道燈）開／關；開的時候不做「鏡頭在牆外就把牆丟掉」
//   setCutaway(on)：「鏡頭在牆外就把牆丟掉」開關（車庫頁預設開、村子關）：車庫頁裡面走路的時候關掉
//   setBays(list)：名牌＋平台上車底的影子（車子自己由頁面擺；put／take 會自己改）：list[k]＝parkSlots[k] 停的車（字串、{ name }、null＝空的）
//     舊的用法給 6 個＝只改六台的上層（平常跟地板平的那層），下層不動；給 7–12 個＝12 格都照 list
//   cull(camera) → { inside, house, ceil }（鏡頭在車庫裡、在小房子裡、頭上多高；同一個物件重複用）：村子可以每一格叫：門關著、鏡頭在外面就不畫裡面；鏡頭在裡面就不畫外殼
//   toWorld({ x, z, heading })：本地 → 世界（照 group 現在的位置、轉角）；toLocal(x, z)：世界 → 本地（判斷在不在 zones 裡）
//   interior／exterior：裡面、外殼兩個 Group；envRotation：環境貼圖要轉幾度（村子裡整棟轉了，停在裡面的車要映房間就用這個）
// 升降機（後牆六個車位都是地坑式兩層：上下各一台 → 12 台＋主車位）：lifts[i]＝{
//   id, x, z, heading（0：車頭朝門）, level（0＝框升起來：下層跟地板平、上層在 2.1 公尺；1＝框降下去：上層跟地板平、下層連車在坑裡；一開始 1）, pos（框現在在哪：0 … 1）, busy,
//   floorDeck（現在跟地板平的那層：0 下、1 上；在動 −1）, platforms: [下層, 上層]（Group，原點＝平台上緣中間：車子掛上去就跟著動）, cars: [下層, 上層]（put 放的；空的 null）,
//   slots（[下層, 上層] 現在的 { x, y, z, heading }，本地）, panel（操作柱 { x, z }）, stand（站著操作的地方 { x, z, heading }）, zone, pit, deck（{ x, z, hx, hz }）,
//   setLevel(level, onDone) → true（開始動；已經在那層：馬上叫 onDone）／false（在動：不理）：開鎖 0.6 秒＋走 6 秒＋落鎖 0.4 秒＝7 秒（柱子上的琥珀燈、操作柱的燈閃）；toggle(onDone)
//   update(dt)（room.update 會叫）, put(deck, obj, name)：車（Object3D，原點＝車底中間、車頭朝 +x）掛到那層平台（位置、轉角歸零）＋名牌（name 不給用 obj.name；也可以只給名字）
//   take(deck) → 拿下來的 Object3D（沒有 null）, colliders(world) }
//   onLift(lift, 'start' | 'stop')：頁面設的 hook：開始動（放馬達聲、換碰撞）、停好（停馬達聲、再換碰撞）
//   parkSlots：12 格的建議停車順序：0–5＝六台的上層（平常跟地板平：直接開上去）、6–11＝六台的下層（要先把框升起來）
//   freeSlot()：新買的車停哪一格 → { id, lift, deck, level（要先 setLevel 到的那層＝deck）, move（要不要先動升降機）}；先挑現在就跟地板平的空平台；12 格全滿 → null
//   liftColliders(world)：只有升降機的（colliders 裡也有）；cameraColliders(world)：只擋鏡頭的盒子（y0＝盒子的底）：小房子的屋頂、升起來（在動）的上層平台＋上面的車
//     → 給 walk.js 的 addColliders（人從底下走過去、鏡頭不穿過去）；不要給 drive.js（它不看 y0，會當成牆）
//   走路走得到（walk.js setCars 要給的）：每台只有 floorDeck 那層的車（level 1＝上層那台、level 0＝下層那台）；升起來那層在頭上、降下去那層在坑裡、在動的時候都走不到
//   開車：車子從門開到跟地板平的那層（車頭朝門倒車進去，停好 put 到 platforms[floorDeck]）；有車、有人在上面別動升降機（頁面管）
// 本地座標：x 往門（+x 出去）、y 上、z＝車頭朝門的時候車子的右邊；地板 y = 0
//   裡面 x −12.7 … 5、z −15.7 … 15.7（第 11 批：本來 ±12.7）、天花板 6（第 10 批：本來 4.5；四周燈槽到 H＋0.14）；牆厚 0.3：外面 x −13 … 5.3、z −16 … 16、女兒牆頂 7.2
//   第 11 批：靠兩邊牆的東西（小房子、休息區、盆栽、角落的燈）跟著牆往外搬 ZW＝3 公尺；後牆的六個車位、門那面牆的櫃子、天花板中間的燈不動
//   鐵捲門：x = 5 那面牆的中間，門洞 z −4 … 4、高 5（第 10 批：本來 ±3、3.8）；門片在牆裡面 7 公分（x = 4.93），捲筒盒在門洞上面（x 4.52 … 5、y DH＋0.06 … H）
//   小房子：左前角 x 0 … 5、z −15.7 … −11.5（貼著門那面牆、z −15.7 那面牆；第 11 批：本來 −12.7 … −8.5），屋簷 2.75、屋脊 3.97；門洞 x 0.35 … 1.35（朝 +z，門往裡面開著）；床頭靠 z −15.7
//   升降機：車位中心 x −9.8、z ±1.85、±5.55、±9.25；坑口 5.44 × 3.04、深 2.35；操作柱在兩台中間的分隔線上（x −7.3）
// 燈光：房間自己的東西不吃場景的燈（村子的太陽照不進來）：牆、家具的亮度＝照「上／水平／下」算的環境光＋角落暗一點＋燈槽洗牆，
//   反射吃自己的環境貼圖；燈都是自己發光的面（沒有即時光源、沒有即時陰影）；外殼吃場景的燈（跟村子其他房子一樣）
//   小房子裡面換一套（暖白：床頭燈、屋脊樑 LED、床底燈、電視），反射弱一點；坑裡越深越暗
// 車庫頁的鏡頭會繞到門那面牆外面（x > 5）、天花板上面：牆只有朝內那面（背面剔除），靠那面牆的東西在 shader 裡丟掉（小房子不丟）；天花板用抖動淡掉
// 效能：房間本身一次 8 個 draw call（地板、房子（小房子也合在裡面）、燈、獎盃、玻璃、招牌、門片、升降機的框（六台一個 InstancedMesh））；車庫頁的鏡面地板再畫一次、少地板 → 15 個（原本 7／13）
//   村子外殼 +4（門關著、鏡頭在外面只畫外殼 4 個）；下層平台關在坑裡的時候不畫（上面的車也不畫）
//   同材質合成一個網格（輪胎輪框也合進去）、門片用 InstancedMesh；三角形：房間 ~32k（車庫頁連反射 ~64k）；canvas 貼圖最大 1024；沒有後製、沒有即時陰影、沒有即時光源
// 內嵌進車庫頁時（build-art.mjs 會拿掉 import）：頁面要自己 import Reflector；這個檔頂層只有 ROOM_SIZE、buildRoom 兩個名字
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export const ROOM_SIZE = { X: 5, XB: -12.7, Z: 15.7, H: 6, T: 0.3, TOP: 7.2, DZ: 4, DH: 5 }; // 第 10 批（Nick「所有車庫變高變寬」）：天花板 4.5 → 6、門 6 × 3.8 → 8 × 5 公尺；第 11 批（Nick「要變寬」）：寬 25.4 → 31.4（z ±12.7 → ±15.7）

export function buildRoom(renderer, { quality = 'high', exterior = false } = {}) {
  const { X: XD, XB, Z: ZS, H, T: WT, TOP, DZ, DH } = ROOM_SIZE, hi = quality !== 'low';
  const XO = XD + WT, XBO = XB - WT, ZO = ZS + WT, HC = H + 0.14; // 外牆面、燈槽頂
  const group = new THREE.Group(); group.name = 'room';
  const inner = new THREE.Group(); inner.name = 'roomInterior';
  const outer = new THREE.Group(); outer.name = 'roomExterior';
  group.add(inner, outer);
  const trash = [], keep = (o) => (trash.push(o), o);
  const V = (x, y, z) => new THREE.Vector3(x, y, z), M4 = () => new THREE.Matrix4(), f3 = (v) => v.toFixed(3);
  let seed = 20260928; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; // 固定亂數：每次長得一樣
  let hSeed = 51150; const hr = () => (hSeed = (hSeed * 16807) % 2147483647) / 2147483647; // 小房子、升降機另外一組（原本的東西長得跟以前一樣）
  let dead = false;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // ---- 顏色（線性）：燈超過 1（HDR），色調對應之後才會白亮 ----
  const W1 = [1, 1, 1], BLK = [0.011, 0.011, 0.012], CEIL = [0.84, 0.83, 0.8], LACQ = [0.84, 0.84, 0.83], BRASS = [0.8, 0.56, 0.26], ALU = [0.8, 0.81, 0.83];
  const STEEL = [0.6, 0.61, 0.63], LEATHER = [0.022, 0.02, 0.019], RUBBER = [0.02, 0.02, 0.021], GUN = [0.05, 0.05, 0.055];
  const LED = [3.4, 2.5, 1.62], LINE = [6.2, 5.3, 4.2], SPOT = [9, 7.6, 6], AMBER = [2.8, 1.0, 0.07];
  // 每個頂點的材質：[粗糙度, 金屬度, 大理石（0 用貼圖集、1 白大理石、2 黑大理石）, 燈槽洗牆（0–1）]；燈的網格第一個數＝會閃（警示燈）
  const MM = {
    marble: [0.13, 0, 1, 1], honed: [0.34, 0, 1, 1], nero: [0.1, 0, 2, 1], paint: [0.92, 0, 0, 1], lacq: [0.2, 0, 0, 1], brass: [0.26, 1, 0, 0.4], alu: [0.3, 1, 0, 0.4],
    chrome: [0.05, 1, 0, 0.3], gloss: [0.07, 0, 0, 0.5], satin: [0.42, 0.5, 0, 0.5], leather: [0.48, 0, 0, 0.2], fabric: [0.96, 0, 0, 0], rubber: [0.82, 0, 0, 0], lamp: [0, 0, 0, 0], blink: [1, 0, 0, 0],
  };

  // ---- 大理石（卡拉拉白）：canvas 一個像素一個像素算，一張＝3.2 公尺見方；兩個畫質、兩個房子（車庫頁、村子）共用（存在 buildRoom 身上）----
  //   紋路＝斜 35 度的正弦帶子被 fbm 扭過（|sin| 接近 0 的地方就是一條紋）：主紋少、粗、有灰色的暈；次紋細；最細的髮絲紋；底色有淡淡的灰雲
  //   快：雜訊表 256²（六層值雜訊、可以接起來），低頻的場（扭曲、雲、遮罩）每 4 像素算一次再內插；sin 用 Bhaskara 近似、exp 查表（1024² 桌機 ~130 毫秒）
  const MS = hi ? 1024 : 512, MT = 3.2;
  const marbleC = (() => {
    const cache = buildRoom.marbleCache || (buildRoom.marbleCache = {});
    if (cache[MS]) return cache[MS];
    const cv = document.createElement('canvas'); cv.width = cv.height = MS;
    const g = cv.getContext('2d');
    if (cache[MS * 2]) { g.imageSmoothingQuality = 'high'; g.drawImage(cache[MS * 2], 0, 0, MS, MS); return (cache[MS] = cv); } // 已經有大張的：縮小就好
    const GN = 256, NZ = new Float32Array(GN * GN);
    let s0 = 777; const r0 = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647;
    for (let cells = 4, amp = 1; cells <= 128; cells *= 2, amp *= 0.52) { // 六層，格子 4 → 128
      const gr = new Float32Array(cells * cells), cm = cells - 1, st = GN / cells; for (let i = 0; i < gr.length; i++) gr[i] = r0() * 2 - 1;
      const SX = new Float32Array(GN), XA = new Int32Array(GN), XB = new Int32Array(GN);
      for (let x = 0; x < GN; x++) { const fx = x / st, ix = fx | 0, tx = fx - ix; SX[x] = tx * tx * (3 - 2 * tx); XA[x] = ix & cm; XB[x] = (ix + 1) & cm; }
      for (let y = 0; y < GN; y++) {
        const fy = y / st, iy = fy | 0, ty = fy - iy, sy = ty * ty * (3 - 2 * ty), ra = (iy & cm) * cells, rb = ((iy + 1) & cm) * cells;
        for (let x = 0, o = y * GN; x < GN; x++, o++) {
          const sx = SX[x], xa = XA[x], xb = XB[x], ga = gr[ra + xa], gb = gr[rb + xa], a = ga + (gr[ra + xb] - ga) * sx, b = gb + (gr[rb + xb] - gb) * sx;
          NZ[o] += amp * (a + (b - a) * sy);
        }
      }
    }
    const nz = (u, v) => { // 雙線性取樣（繞回來）
      let fx = u * GN, fy = v * GN; fx -= Math.floor(fx / GN) * GN; fy -= Math.floor(fy / GN) * GN;
      const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, x1 = (ix + 1) & (GN - 1), y1 = (iy + 1) & (GN - 1);
      const a = NZ[iy * GN + ix], b = NZ[iy * GN + x1], c = NZ[y1 * GN + ix], d = NZ[y1 * GN + x1];
      return a + (b - a) * tx + (c - a + (a - b - c + d) * tx) * ty;
    };
    const LR = MS / 4 + 1, NF = 6, F = new Float32Array(LR * LR * NF), ca = Math.cos(0.6), sa = Math.sin(0.6);
    for (let j = 0; j < LR; j++) for (let i = 0; i < LR; i++) { // 低頻的場：主紋扭曲、次紋扭曲、雲、主紋遮罩、次紋／髮絲紋遮罩、髮絲紋扭曲
      const u = (i * 4) / MS, v = (j * 4) / MS, o = (j * LR + i) * NF;
      F[o] = nz(u * 0.7 + 0.13, v * 0.7 + 0.71); F[o + 1] = nz(u * 1.5 + 0.52, v * 1.5 + 0.29); F[o + 2] = nz(u * 0.55 + 0.37, v * 0.55 + 0.83);
      F[o + 3] = nz(u * 0.8 + 0.61, v * 0.8 + 0.07); F[o + 4] = nz(u * 1.2 + 0.91, v * 1.2 + 0.44); F[o + 5] = nz(u * 2.6 + 0.23, v * 2.6 + 0.66);
    }
    const TN = 2048, T1 = new Float32Array(TN + 1), T2 = new Float32Array(TN + 1), T3 = new Float32Array(TN + 1); // 紋路的剖面（離紋多遠 → 多深）：主紋有一層寬的暈
    for (let i = 0; i <= TN; i++) { const x = i / TN; T1[i] = Math.exp(-x * 30) * 0.7 + Math.exp(-x * 5) * 0.22; T2[i] = Math.exp(-x * 55) * 0.45; T3[i] = Math.exp(-x * 90) * 0.18; }
    const img = g.createImageData(MS, MS), d = img.data, RWF = new Float32Array(LR * NF);
    for (let y = 0, o = 0; y < MS; y++) {
      const jy = y >> 2, ty = (y & 3) / 4, v = y / MS;
      for (let i = 0, a = jy * LR * NF, c = a + LR * NF; i < LR * NF; i++) RWF[i] = F[a + i] + (F[c + i] - F[a + i]) * ty; // 這一列：先沿 y 內插
      for (let x = 0; x < MS; x++, o += 4) {
        const i0 = (x >> 2) * NF, tx = (x & 3) / 4, u = x / MS, p = u * ca + v * sa, q = v * ca - u * sa;
        const f0 = RWF[i0] + (RWF[i0 + NF] - RWF[i0]) * tx, f1 = RWF[i0 + 1] + (RWF[i0 + NF + 1] - RWF[i0 + 1]) * tx, f2 = RWF[i0 + 2] + (RWF[i0 + NF + 2] - RWF[i0 + 2]) * tx;
        const f3 = RWF[i0 + 3] + (RWF[i0 + NF + 3] - RWF[i0 + 3]) * tx, f4 = RWF[i0 + 4] + (RWF[i0 + NF + 4] - RWF[i0 + 4]) * tx, f5 = RWF[i0 + 5] + (RWF[i0 + NF + 5] - RWF[i0 + 5]) * tx;
        const fine = nz(u * 4.7 + 0.4, v * 4.7 + 0.9);
        let t = q * 2.2 + f0 * 0.35 + fine * 0.04; t -= Math.floor(t); let h = t * (1 - t); const s1 = (16 * h) / (5 - 4 * h); // |sin(πt)|
        t = q * 4.6 - p * 0.6 + f1 * 0.6 + fine * 0.08; t -= Math.floor(t); h = t * (1 - t); const s2 = (16 * h) / (5 - 4 * h);
        t = q * 9 + p * 1.3 + f5 * 1.2 + fine * 0.16; t -= Math.floor(t); h = t * (1 - t); const s3 = (16 * h) / (5 - 4 * h);
        let m1 = f3 * 1.2 + 0.55, m2 = f4 * 1.5 + 0.2, m3 = 0.1 - f4 * 1.4;
        m1 = m1 < 0 ? 0 : m1 > 1 ? 1 : m1; m2 = m2 < 0 ? 0 : m2 > 1 ? 1 : m2; m3 = m3 < 0 ? 0 : m3 > 1 ? 1 : m3;
        let vein = T1[(s1 * TN) | 0] * m1 + T2[(s2 * TN) | 0] * m2 + T3[(s3 * TN) | 0] * m3; if (vein > 1) vein = 1;
        const c1 = f2 + 0.2, L = 247 - (c1 > 0 ? c1 * 13 : 0) - (fine > 0 ? fine * 2.5 : 0);
        d[o] = L - vein * 105; d[o + 1] = L - 1 - vein * 100; d[o + 2] = L - 3 - vein * 90; d[o + 3] = 255; // 紋路偏一點點冷灰
      }
    }
    g.putImageData(img, 0, 0);
    return (cache[MS] = cv);
  })();
  const marbleTex = keep(new THREE.CanvasTexture(marbleC)); marbleTex.colorSpace = THREE.SRGBColorSpace; marbleTex.anisotropy = aniso;

  // ---- 貼圖集（1024²）：一張底色、一張自己發光的（燈照在工具牆、畫、獎盃櫃背板上的光）；同一個材質的東西共用 ----
  const AT = 1024, atlas = document.createElement('canvas'), glowC = document.createElement('canvas');
  atlas.width = atlas.height = glowC.width = glowC.height = AT;
  const A = atlas.getContext('2d'), G = glowC.getContext('2d');
  A.fillStyle = '#fff'; A.fillRect(0, 0, AT, AT); G.fillStyle = '#000'; G.fillRect(0, 0, AT, AT);
  const reg = (x, y, w, h, p = 3) => [(x + p) / AT, 1 - (y + h - p) / AT, (x + w - p) / AT, 1 - (y + p) / AT]; // [u0, v0, u1, v1]
  const R = { W: reg(960, 960, 64, 64, 20), TOOLS: reg(0, 0, 640, 192), CHEST: reg(0, 192, 512, 96), CTRL: reg(512, 192, 64, 96), KEYP: reg(576, 192, 64, 96),
    RUG: reg(0, 288, 384, 272), ART: reg(384, 288, 384, 224), TBACK: reg(768, 288, 256, 96), BRUSH: reg(0, 576, 512, 32, 1), MODELS: reg(640, 0, 384, 192),
    // 小房子、升降機：橡木地板（左右上下接得起來，不留邊）、房間地毯、電視畫面、小掛畫、腳踏墊、橡木（橫紋、直紋）、黃黑斜紋、升降機操作盒、亞麻、床頭板
    FLOOR: reg(0, 608, 512, 256, 0), HRUG: reg(512, 608, 256, 192), TV: reg(768, 608, 256, 144), BART: reg(768, 752, 128, 128), MAT: reg(512, 800, 256, 96),
    OAKH: reg(384, 512, 384, 64), OAKV: reg(768, 384, 256, 192), HAZ: reg(640, 192, 256, 24, 1), LCTRL: reg(896, 192, 64, 96), LINEN: reg(640, 216, 256, 72), HEADB: reg(0, 864, 384, 96) };
  const RW = R.W;
  const inR = (x, y, w, h, fn) => { for (const c of [A, G]) { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); } fn(); A.restore(); G.restore(); };
  const lin = (c, x0, y0, x1, y1, stops) => { const gr = c.createLinearGradient(x0, y0, x1, y1); for (const [t, s] of stops) gr.addColorStop(t, s); return gr; };
  inR(0, 0, 640, 192, () => { // 工具牆：白色烤漆洞洞板，工具是鍍鉻、黑、金（上面燈條照下來）
    A.fillStyle = '#ecebe7'; A.fillRect(0, 0, 640, 192);
    A.fillStyle = '#c9c8c4'; for (let y = 6; y < 192; y += 9) for (let x = 5; x < 640; x += 9) A.fillRect(x, y, 2, 2);
    for (let i = 0; i < 11; i++) { // 一排梅花扳手（由小到大）
      const x = 20 + i * 16, L = 58 + i * 6, y = 22;
      A.fillStyle = '#b9bdc3'; A.fillRect(x - 2.5, y + 8, 5, L - 16);
      A.beginPath(); A.arc(x, y + 6, 7, 0, Math.PI * 2); A.fill(); A.beginPath(); A.arc(x, y + L - 6, 6, 0, Math.PI * 2); A.fill();
      A.fillStyle = 'rgba(255,255,255,0.7)'; A.fillRect(x - 2.5, y + 8, 1.5, L - 16);
      A.fillStyle = '#ecebe7'; A.fillRect(x - 2.5, y - 3, 5, 8); A.beginPath(); A.arc(x, y + L - 6, 3, 0, Math.PI * 2); A.fill();
    }
    ['#141416', '#c9a24f', '#141416', '#c9a24f', '#141416', '#c9a24f', '#141416'].forEach((c, i) => { // 起子：黑、金握把
      const x = 212 + i * 14; A.fillStyle = '#b5b9bf'; A.fillRect(x - 1.5, 62, 3, 56); A.fillStyle = c; A.beginPath(); A.roundRect(x - 5, 24, 10, 40, 4); A.fill();
    });
    A.fillStyle = '#141416'; A.fillRect(328, 40, 8, 104); A.fillStyle = '#9aa0a8'; A.fillRect(310, 26, 44, 18); // 鎚子
    A.strokeStyle = '#141416'; A.lineWidth = 7; A.lineCap = 'round'; A.beginPath(); A.moveTo(382, 56); A.lineTo(370, 138); A.moveTo(392, 56); A.lineTo(406, 138); A.stroke(); // 鉗子
    A.fillStyle = '#9aa0a8'; A.beginPath(); A.ellipse(387, 42, 8, 17, 0, 0, Math.PI * 2); A.fill();
    A.fillStyle = '#16171a'; A.fillRect(428, 150, 120, 8); for (let i = 0; i < 11; i++) { A.fillStyle = '#c3c8cf'; A.fillRect(430 + i * 10.5, 128 - i * 2, 8, 22 + i * 2); } // 套筒
    A.fillStyle = '#b9bdc3'; A.fillRect(560, 24, 10, 120); A.fillStyle = '#141416'; A.fillRect(559, 100, 12, 44); A.fillStyle = '#c9a24f'; A.fillRect(559, 96, 12, 5); // 扭力扳手
    A.fillStyle = '#c9a24f'; A.fillRect(592, 30, 26, 70); A.fillStyle = '#141416'; A.fillRect(594, 100, 22, 22); // 金色的量規盒
    G.fillStyle = lin(G, 0, 0, 0, 192, [[0, 'rgba(255,214,168,0.55)'], [0.35, 'rgba(255,214,168,0.2)'], [1, 'rgba(255,214,168,0.02)']]); G.fillRect(0, 0, 640, 192);
  });
  inR(0, 192, 512, 96, () => { // 工具櫃正面：白色烤漆抽屜、黃銅把手（兩欄四層）
    A.fillStyle = lin(A, 0, 192, 0, 288, [[0, '#f1f0ec'], [1, '#dcdad5']]); A.fillRect(0, 192, 512, 96);
    for (const [x0, x1] of [[4, 254], [258, 508]]) {
      let y = 196;
      for (const h of [16, 18, 24, 32]) {
        A.fillStyle = '#b8b6b1'; A.fillRect(x0, y + h - 1.5, x1 - x0, 1.5);
        A.fillStyle = '#b08a3e'; A.fillRect(x0 + 30, y + 4, x1 - x0 - 60, 3.5); A.fillStyle = 'rgba(255,240,200,0.8)'; A.fillRect(x0 + 30, y + 4, x1 - x0 - 60, 1);
        y += h;
      }
    }
    A.fillStyle = '#b8b6b1'; A.fillRect(255, 192, 2, 96);
  });
  inR(512, 192, 64, 96, () => { // 門邊的開關盒（拉絲鋁、上／下兩顆鍵、鑰匙孔）
    A.fillStyle = lin(A, 512, 192, 576, 288, [[0, '#d7d9dc'], [1, '#aeb1b6']]); A.fillRect(512, 192, 64, 96);
    for (const [y, c] of [[222, '#1c6b3a'], [252, '#7b1d1d']]) { A.fillStyle = '#2a2c30'; A.beginPath(); A.arc(544, y, 11, 0, Math.PI * 2); A.fill(); A.fillStyle = c; A.beginPath(); A.arc(544, y, 8, 0, Math.PI * 2); A.fill(); }
    A.fillStyle = '#141416'; A.beginPath(); A.arc(544, 276, 5, 0, Math.PI * 2); A.fill();
    for (const [y, c] of [[222, 'rgba(60,255,140,0.9)'], [252, 'rgba(255,80,60,0.8)']]) { G.strokeStyle = c; G.lineWidth = 2; G.beginPath(); G.arc(544, y, 9.5, 0, Math.PI * 2); G.stroke(); }
    G.fillStyle = 'rgba(80,170,255,1)'; G.fillRect(541, 200, 6, 3);
  });
  inR(576, 192, 64, 96, () => { // 門外面的密碼盤（黑玻璃、發光的數字鍵）
    A.fillStyle = '#0c0d0f'; A.fillRect(576, 192, 64, 96);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { A.fillStyle = '#1d1f23'; A.fillRect(584 + c * 17, 214 + r * 17, 13, 13); G.fillStyle = 'rgba(255,196,120,0.55)'; G.fillRect(588 + c * 17, 218 + r * 17, 5, 5); }
    G.fillStyle = 'rgba(80,220,140,0.9)'; G.fillRect(600, 200, 16, 3);
  });
  inR(0, 288, 384, 272, () => { // 地毯：炭灰、細細的混紡雜點、內圈一條淺灰線一條金線
    A.fillStyle = '#34353a'; A.fillRect(0, 288, 384, 272);
    for (let i = 0; i < 9000; i++) { const k = 30 + rnd() * 40; A.fillStyle = `rgba(${k},${k},${k + 4},0.5)`; A.fillRect(rnd() * 384, 288 + rnd() * 272, 1.5, 1.5); }
    A.strokeStyle = '#8b8d92'; A.lineWidth = 2; A.strokeRect(16, 304, 352, 240); A.strokeStyle = '#a88a4a'; A.lineWidth = 1.5; A.strokeRect(24, 312, 336, 224);
  });
  inR(384, 288, 384, 224, () => { // 掛畫：米白畫布、一筆很大的黑色筆刷、金箔碎片（抽象畫）
    A.fillStyle = lin(A, 384, 288, 768, 512, [[0, '#efe9df'], [1, '#e2d9ca']]); A.fillRect(384, 288, 384, 224);
    for (let i = 0; i < 900; i++) { A.fillStyle = `rgba(120,100,80,${f3(rnd() * 0.05)})`; A.fillRect(384 + rnd() * 384, 288 + rnd() * 224, 2, 2); }
    A.strokeStyle = '#141416'; A.lineCap = 'round';
    for (let k = 0; k < 14; k++) { A.lineWidth = 3 + rnd() * 5; A.globalAlpha = 0.5 + rnd() * 0.5; A.beginPath(); A.moveTo(420 + rnd() * 14, 470 + rnd() * 16 + k); A.bezierCurveTo(500, 280 + k * 3, 640, 520 - k * 2, 740 + rnd() * 10, 330 + k * 3); A.stroke(); }
    A.globalAlpha = 1;
    for (let i = 0; i < 22; i++) { A.fillStyle = rnd() < 0.5 ? '#c9a14e' : '#dcbd72'; A.save(); A.translate(560 + (rnd() - 0.5) * 220, 400 + (rnd() - 0.5) * 120); A.rotate(rnd() * 3); A.fillRect(-6 - rnd() * 8, -4 - rnd() * 6, 10 + rnd() * 16, 6 + rnd() * 10); A.restore(); }
    G.fillStyle = lin(G, 0, 288, 0, 512, [[0, 'rgba(255,220,180,0.45)'], [0.4, 'rgba(255,220,180,0.12)'], [1, 'rgba(0,0,0,0)']]); G.fillRect(384, 288, 384, 224);
  });
  inR(768, 288, 256, 96, () => { // 獎盃櫃的背板：香檳金直紋，後面藏燈（上面比較亮）
    A.fillStyle = '#c9b48c'; A.fillRect(768, 288, 256, 96);
    for (let x = 768; x < 1024; x += 6) { A.fillStyle = 'rgba(255,248,230,0.35)'; A.fillRect(x, 288, 2, 96); A.fillStyle = 'rgba(60,40,10,0.25)'; A.fillRect(x + 4, 288, 1.5, 96); }
    G.fillStyle = lin(G, 0, 288, 0, 384, [[0, 'rgba(255,200,130,0.95)'], [0.5, 'rgba(255,190,120,0.55)'], [1, 'rgba(255,180,110,0.3)']]); G.fillRect(768, 288, 256, 96);
  });
  inR(0, 576, 512, 32, () => { // 拉絲金屬：一條一條橫的細紋（鐵捲門片、捲筒盒）
    A.fillStyle = '#c4c7cb'; A.fillRect(0, 576, 512, 32);
    for (let i = 0; i < 700; i++) { A.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${f3(0.05 + rnd() * 0.12)})` : `rgba(0,0,0,${f3(0.03 + rnd() * 0.08)})`; A.fillRect(rnd() * 512 - 40, 576 + rnd() * 32, 40 + rnd() * 160, 1); }
  });
  inR(640, 0, 384, 192, () => { // 模型車展示櫃的背板：黑色、每層上面一條暖燈照下來
    A.fillStyle = '#16171a'; A.fillRect(640, 0, 384, 192);
    for (let r = 0; r < 3; r++) G.fillStyle = lin(G, 0, r * 64, 0, r * 64 + 64, [[0, 'rgba(255,205,150,0.5)'], [0.6, 'rgba(255,205,150,0.08)'], [1, 'rgba(0,0,0,0)']]), G.fillRect(640, r * 64, 384, 64);
  });
  // ---- 小房子、升降機的貼圖（亂數用 hr：上面原本的東西長得跟以前一樣）----
  const woodLines = (x, y, w, h, n, horiz, rg = hr) => { // 木紋：一條一條淡淡的深、淺細線（順著木頭），微微彎
    for (let i = 0; i < n; i++) {
      const t = rg(), a = 0.03 + rg() * 0.14, dark = rg() < 0.72, ph = rg() * 40;
      A.strokeStyle = dark ? `rgba(92,58,28,${f3(a)})` : `rgba(255,236,205,${f3(a * 0.7)})`; A.lineWidth = 0.6 + rg() * 1.6;
      A.beginPath();
      for (let k = 0; k <= 12; k++) {
        const s = k / 12, wob = Math.sin(s * 6.3 + ph) * 1.3 + (rg() - 0.5) * 0.7;
        if (horiz) A[k ? 'lineTo' : 'moveTo'](x + s * w, y + t * h + wob); else A[k ? 'lineTo' : 'moveTo'](x + t * w + wob, y + s * h);
      }
      A.stroke();
    }
  };
  inR(0, 608, 512, 256, () => { // 橡木地板：一格＝1.2（u，沿 z）× 0.6 公尺（v，沿 x），四排木板、接縫錯開；跨過左右邊的那片兩邊都畫（接得起來）
    A.fillStyle = '#5e4128'; A.fillRect(0, 608, 512, 256);
    for (let r = 0; r < 4; r++) {
      const y0 = 608 + r * 64; let x = hr() * 512; const end = x + 512;
      while (x < end - 1) {
        const Lp = Math.min(end - x, 170 + hr() * 300), s0 = 1 + Math.floor(hr() * 2147483000), tone = hr() - 0.5;
        for (const dx of [0, -512]) {
          let s = s0; const pr = () => (s = (s * 16807) % 2147483647) / 2147483647, X = x + dx;
          A.fillStyle = `rgb(${Math.round(190 + tone * 26)},${Math.round(146 + tone * 22)},${Math.round(100 + tone * 18)})`; A.fillRect(X + 1, y0 + 1, Lp - 2, 62);
          A.save(); A.beginPath(); A.rect(X + 1, y0 + 1, Lp - 2, 62); A.clip(); woodLines(X, y0, Lp, 64, 16, true, pr); A.restore();
        }
        x += Lp;
      }
    }
  });
  inR(512, 608, 256, 192, () => { // 房間的地毯：米白羊毛、細雜點、內圈一條陶土色細線
    A.fillStyle = '#d8cdbb'; A.fillRect(512, 608, 256, 192);
    for (let i = 0; i < 5000; i++) { const k = 190 + hr() * 50; A.fillStyle = `rgba(${Math.round(k)},${Math.round(k - 10)},${Math.round(k - 26)},0.45)`; A.fillRect(512 + hr() * 256, 608 + hr() * 192, 1.5, 1.5); }
    A.strokeStyle = '#b5703f'; A.lineWidth = 2; A.strokeRect(526, 622, 228, 164); A.strokeStyle = 'rgba(120,100,80,0.5)'; A.lineWidth = 1; A.strokeRect(532, 628, 216, 152);
  });
  inR(768, 608, 256, 144, () => { // 電視：在玩賽車（黃昏的賽道、前面一台紅車、速度表）；畫面是發光的（底色黑）
    A.fillStyle = '#060607'; A.fillRect(768, 608, 256, 144);
    G.fillStyle = lin(G, 0, 608, 0, 680, [[0, '#23336a'], [0.62, '#d9794a'], [1, '#f2b872']]); G.fillRect(768, 608, 256, 72);
    G.fillStyle = '#2d2a3e'; G.beginPath(); G.moveTo(768, 680); for (let k = 0; k <= 8; k++) G.lineTo(768 + k * 32, 668 + (k % 2 ? -6 : 4) + (k === 4 ? -8 : 0)); G.lineTo(1024, 680); G.closePath(); G.fill(); // 遠山
    G.fillStyle = '#34452f'; G.fillRect(768, 680, 256, 72);
    G.fillStyle = '#44464c'; G.beginPath(); G.moveTo(884, 680); G.lineTo(908, 680); G.lineTo(1012, 752); G.lineTo(780, 752); G.closePath(); G.fill(); // 路
    G.fillStyle = '#e8e8e8'; for (let k = 0; k < 5; k++) { const t0 = k / 5, t1 = t0 + 0.09, y0 = 680 + t0 * t0 * 72, y1 = 680 + t1 * t1 * 72, w0 = 0.6 + t0 * 2.4, w1 = 0.6 + t1 * 2.4; G.beginPath(); G.moveTo(896 - w0, y0); G.lineTo(896 + w0, y0); G.lineTo(896 + w1, y1); G.lineTo(896 - w1, y1); G.closePath(); G.fill(); }
    G.fillStyle = '#b81c26'; G.beginPath(); G.roundRect(870, 708, 54, 25, 5); G.fill(); G.fillStyle = '#121418'; G.fillRect(878, 700, 38, 11); G.fillStyle = '#ff4a3a'; G.fillRect(872, 716, 10, 4); G.fillRect(912, 716, 10, 4); // 前面那台（後面看）
    G.fillStyle = '#111'; G.fillRect(874, 732, 10, 5); G.fillRect(910, 732, 10, 5);
    G.fillStyle = 'rgba(0,0,0,0.5)'; G.fillRect(962, 722, 56, 24); G.fillStyle = '#ffffff'; G.font = '700 17px sans-serif'; G.textBaseline = 'middle'; G.fillText('238', 968, 735); G.font = '600 8px sans-serif'; G.fillText('km/h', 998, 739);
    G.strokeStyle = 'rgba(255,255,255,0.7)'; G.lineWidth = 1.5; G.beginPath(); G.arc(790, 728, 14, 0, Math.PI * 2); G.stroke(); G.fillStyle = '#ffcc33'; G.fillRect(788, 726, 4, 4); // 小地圖
  });
  inR(768, 752, 128, 128, () => { // 小掛畫：米白紙、橘色大太陽、黑色的山、金箔
    A.fillStyle = '#efe8dc'; A.fillRect(768, 752, 128, 128);
    A.fillStyle = '#d9773f'; A.beginPath(); A.arc(836, 800, 28, 0, Math.PI * 2); A.fill();
    A.strokeStyle = '#1a1a1c'; A.lineWidth = 3; A.lineJoin = 'round'; A.beginPath(); A.moveTo(774, 858); A.lineTo(800, 826); A.lineTo(822, 846); A.lineTo(854, 810); A.lineTo(890, 858); A.stroke();
    A.fillStyle = '#c9a14e'; for (let i = 0; i < 7; i++) A.fillRect(786 + hr() * 76, 768 + hr() * 24, 3 + hr() * 5, 2 + hr() * 3);
  });
  inR(512, 800, 256, 96, () => { // 腳踏墊：椰棕（直的短毛）＋黑色橡膠邊
    A.fillStyle = '#1c1b1a'; A.fillRect(512, 800, 256, 96); A.fillStyle = '#8c6a45'; A.fillRect(522, 810, 236, 76);
    for (let i = 0; i < 2600; i++) { A.fillStyle = hr() < 0.5 ? `rgba(60,40,20,${f3(0.2 + hr() * 0.3)})` : `rgba(205,165,115,${f3(0.15 + hr() * 0.25)})`; A.fillRect(522 + hr() * 236, 810 + hr() * 76, 1, 2 + hr() * 3); }
  });
  inR(384, 512, 384, 64, () => { A.fillStyle = '#c0915f'; A.fillRect(384, 512, 384, 64); woodLines(384, 512, 384, 64, 44, true); }); // 橡木（橫紋）
  inR(768, 384, 256, 192, () => { A.fillStyle = '#c0915f'; A.fillRect(768, 384, 256, 192); woodLines(768, 384, 256, 192, 80, false); }); // 橡木（直紋）
  inR(640, 192, 256, 24, () => { // 黃黑斜紋（警示）
    A.fillStyle = '#e8b31a'; A.fillRect(640, 192, 256, 24); A.fillStyle = '#141416';
    for (let x = 616; x < 900; x += 24) { A.beginPath(); A.moveTo(x, 216); A.lineTo(x + 12, 216); A.lineTo(x + 36, 192); A.lineTo(x + 24, 192); A.closePath(); A.fill(); }
  });
  inR(640, 216, 256, 72, () => { // 亞麻（床單、枕頭、窗簾）：白底、細細的橫直紗線
    A.fillStyle = '#f3efe8'; A.fillRect(640, 216, 256, 72);
    for (let i = 0; i < 260; i++) { A.fillStyle = `rgba(150,135,115,${f3(0.04 + hr() * 0.07)})`; A.fillRect(640, 216 + hr() * 72, 256, 0.8); }
    for (let i = 0; i < 300; i++) { A.fillStyle = `rgba(150,135,115,${f3(0.03 + hr() * 0.05)})`; A.fillRect(640 + hr() * 256, 216, 0.8, 72); }
  });
  inR(896, 192, 64, 96, () => { // 升降機操作盒：拉絲鋁面板、小螢幕、上（綠）下（琥珀）兩顆鍵、急停、鑰匙孔
    A.fillStyle = lin(A, 896, 192, 960, 288, [[0, '#dcdee1'], [1, '#b3b6bb']]); A.fillRect(896, 192, 64, 96);
    A.fillStyle = '#141416'; A.fillRect(902, 198, 52, 14);
    for (const [y, c, up] of [[230, '#1f7a44', 1], [256, '#9a6a12', 0]]) {
      A.fillStyle = '#2a2c30'; A.beginPath(); A.arc(928, y, 10, 0, Math.PI * 2); A.fill(); A.fillStyle = c; A.beginPath(); A.arc(928, y, 7.5, 0, Math.PI * 2); A.fill();
      A.fillStyle = '#f4f4f4'; A.beginPath(); if (up) { A.moveTo(928, y - 4); A.lineTo(932, y + 3); A.lineTo(924, y + 3); } else { A.moveTo(928, y + 4); A.lineTo(932, y - 3); A.lineTo(924, y - 3); } A.closePath(); A.fill();
    }
    A.fillStyle = '#b3261e'; A.beginPath(); A.arc(912, 277, 5, 0, Math.PI * 2); A.fill(); A.fillStyle = '#141416'; A.beginPath(); A.arc(944, 277, 4, 0, Math.PI * 2); A.fill();
    G.fillStyle = 'rgba(90,220,150,0.9)'; G.fillRect(906, 203, 20, 4); G.fillStyle = 'rgba(255,190,90,0.7)'; G.fillRect(930, 203, 18, 4);
    for (const [y, c] of [[230, 'rgba(60,255,140,0.8)'], [256, 'rgba(255,180,60,0.7)']]) { G.strokeStyle = c; G.lineWidth = 2; G.beginPath(); G.arc(928, y, 9, 0, Math.PI * 2); G.stroke(); }
  });
  inR(0, 864, 384, 96, () => { // 床頭板：直的車縫凹槽（絨布：每條中間亮、兩邊暗）
    const n = 12, w = 384 / n;
    for (let i = 0; i < n; i++) { const x = i * w; A.fillStyle = lin(A, x, 0, x + w, 0, [[0, '#6c6054'], [0.2, '#a09080'], [0.5, '#b2a290'], [0.8, '#a09080'], [1, '#6c6054']]); A.fillRect(x, 864, w, 96); }
    for (let i = 0; i < 1200; i++) { A.fillStyle = `rgba(255,245,230,${f3(hr() * 0.05)})`; A.fillRect(hr() * 384, 864 + hr() * 96, 1, 1); }
  });
  const atlasTex = keep(new THREE.CanvasTexture(atlas)), glowTex = keep(new THREE.CanvasTexture(glowC));
  for (const t of [atlasTex, glowTex]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; }

  // ---- 招牌、名牌（1024×512，預先乘好 alpha：字＝不透明的金色，光暈＝alpha 0 的光，一次畫完）----
  const SIGN_TEXT = '大便龍的車庫', HOUSE_TEXT = '大便龍的家', SIGN_FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif', COND = '"Barlow Condensed", "Arial Narrow", sans-serif';
  const SW = 1024, SH = 512, signData = new Uint8Array(SW * SH * 4);
  const SR = { TEXT: [0, 0, 1024, 224], EMB: [0, 232, 224, 224], PLQ: (i) => [240 + (i % 3) * 260, 240 + Math.floor(i / 3) * 76, 256, 72], HOUSE: [240, 400, 624, 112] }; // HOUSE：小房子山牆上的字
  const sreg = ([x, y, w, h]) => [x / SW, 1 - (y + h) / SH, (x + w) / SW, 1 - y / SH];
  const deckNames = Array(12).fill(null); // 升降機每一層停的車（名牌用）：2i＝第 i 台的下層、2i + 1＝上層；null＝空的
  let signL = null, signG = null; // 兩張畫布留著（名牌常常換）；willReadFrequently：要讀回來的畫布放 CPU（GPU 的 getImageData 在手機、SwiftShader 上一次好幾百毫秒）
  const drawSign = (only) => { // 字：金色（上亮下暗、上緣一條亮線、底下一層深色當厚度），光暈：暖白模糊
    if (!signL) { const mk = () => { const c = document.createElement('canvas'); c.width = SW; c.height = SH; return c.getContext('2d', { willReadFrequently: true }); }; signL = mk(); signG = mk(); }
    const L = signL, Gl = signG;
    if (!only) { L.clearRect(0, 0, SW, SH); Gl.fillStyle = '#000'; Gl.fillRect(0, 0, SW, SH); }
    const gold = (c, y0, y1) => lin(c, 0, y0, 0, y1, [[0, '#fff3cf'], [0.18, '#e9c77d'], [0.55, '#b98a3c'], [0.8, '#d9b366'], [1, '#8a6427']]);
    const letters = (txt, font, cx, cy, h, glow = 1) => {
      for (const c of [L, Gl]) { c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle'; }
      Gl.globalCompositeOperation = 'lighter'; Gl.fillStyle = `rgba(255,190,120,${f3(0.5 * glow)})`; Gl.shadowColor = 'rgba(255,180,100,1)';
      for (const b of [30, 12]) { Gl.shadowBlur = b; Gl.fillText(txt, cx, cy); }
      Gl.shadowBlur = 0; Gl.globalCompositeOperation = 'source-over';
      L.fillStyle = '#5a3f14'; L.fillText(txt, cx + h * 0.012, cy + h * 0.02);
      L.fillStyle = gold(L, cy - h / 2, cy + h / 2); L.fillText(txt, cx, cy);
      L.save(); L.globalCompositeOperation = 'source-atop'; L.fillStyle = 'rgba(255,250,235,0.55)'; L.fillRect(0, cy - h * 0.5, SW, h * 0.06); L.restore();
    };
    if (!only) {
      { const [x, y, w, h] = SR.TEXT; let px = 150; L.font = `700 ${px}px ${SIGN_FONT}`; const tw = L.measureText(SIGN_TEXT).width; if (tw > w - 70) px = Math.floor((px * (w - 70)) / tw);
        letters(SIGN_TEXT, `700 ${px}px ${SIGN_FONT}`, x + w / 2, y + h / 2 + 4, px); }
      { const [x, y, w, h] = SR.EMB, cx = x + w / 2, cy = y + h / 2; // 圓形徽章：金圈＋「龍」
        Gl.globalCompositeOperation = 'lighter'; Gl.strokeStyle = 'rgba(255,190,120,0.5)'; Gl.shadowColor = 'rgba(255,180,100,1)'; Gl.shadowBlur = 24; Gl.lineWidth = 10; Gl.beginPath(); Gl.arc(cx, cy, 96, 0, Math.PI * 2); Gl.stroke(); Gl.shadowBlur = 0; Gl.globalCompositeOperation = 'source-over';
        L.strokeStyle = gold(L, cy - 100, cy + 100); L.lineWidth = 9; L.beginPath(); L.arc(cx, cy, 96, 0, Math.PI * 2); L.stroke(); L.lineWidth = 2.5; L.beginPath(); L.arc(cx, cy, 84, 0, Math.PI * 2); L.stroke();
        letters('龍', `700 118px ${SIGN_FONT}`, cx, cy + 4, 118, 0.8); }
      { const [x, y, w, h] = SR.HOUSE; let px = 76; L.font = `700 ${px}px ${SIGN_FONT}`; const tw = L.measureText(HOUSE_TEXT).width; if (tw > w - 70) px = Math.floor((px * (w - 70)) / tw);
        letters(HOUSE_TEXT, `700 ${px}px ${SIGN_FONT}`, x + w / 2, y + h / 2 + 8, px, 0.7); } // 光暈不會超過 y 388（名牌重畫會清掉的那幾塊）
    }
    for (let i = 0; i < 6; i++) { // 名牌：黑玻璃上的字（上層、下層停的車的名字；沒有就只有車位號碼）；右上角兩個小三角形＝上層、下層有沒有車（實心＝有）
      const [x, y, w, h] = SR.PLQ(i), up = deckNames[i * 2 + 1], lo = deckNames[i * 2], names = [up, lo].filter((v) => v != null);
      L.clearRect(x, y, w, h); Gl.fillStyle = '#000'; Gl.fillRect(x, y, w, h);
      if (names.length < 2) { L.fillStyle = '#d9b366'; L.fillRect(x + 12, y + h - 13, w - 24, 1.5); }
      L.font = `600 15px ${COND}`; L.textAlign = 'left'; L.textBaseline = 'middle'; L.fillStyle = '#c9a458'; L.fillText(`No. 0${i + 1}`, x + 14, y + 16);
      [up, lo].forEach((nm, k) => {
        const cx = x + w - 34 + k * 16, cy = y + 16, s = k ? -1 : 1;
        L.beginPath(); L.moveTo(cx, cy - 5 * s); L.lineTo(cx + 5, cy + 4 * s); L.lineTo(cx - 5, cy + 4 * s); L.closePath();
        if (nm != null) { L.fillStyle = '#d9b366'; L.fill(); } else { L.strokeStyle = 'rgba(201,164,88,0.55)'; L.lineWidth = 1.2; L.stroke(); }
      });
      const line = (nm, cy, px) => {
        if (!nm) return;
        L.font = `700 ${px}px ${COND}, ${SIGN_FONT}`; const tw = L.measureText(nm).width; if (tw > w - 30) { px = Math.floor((px * (w - 30)) / tw); L.font = `700 ${px}px ${COND}, ${SIGN_FONT}`; }
        L.textAlign = 'center'; L.fillStyle = '#f6efe2'; L.fillText(nm, x + w / 2, cy);
        Gl.font = L.font; Gl.textAlign = 'center'; Gl.textBaseline = 'middle'; Gl.fillStyle = 'rgba(255,230,190,0.35)'; Gl.shadowColor = 'rgba(255,220,170,1)'; Gl.shadowBlur = 8; Gl.fillText(nm, x + w / 2, cy); Gl.shadowBlur = 0;
      };
      if (names.length === 2) { line(up, y + 36, 19); line(lo, y + 57, 19); } else line(names[0], y + h / 2 + 5, 34);
    }
    // 合起來：rgb＝字 × α＋光暈 ×（1−α），α＝字（預先乘好 alpha，混色用 ONE, ONE_MINUS_SRC_ALPHA）
    const [x0, y0, x1, y1] = only === 'plaques' ? [240, 240, SW, 240 + 2 * 76] : [0, 0, SW, SH], RW = x1 - x0; // 只換名牌那一塊（旁邊的徽章不能蓋掉）
    const ld = L.getImageData(x0, y0, RW, y1 - y0).data, gd = Gl.getImageData(x0, y0, RW, y1 - y0).data;
    for (let y = y0; y < y1; y++) {
      for (let x = x0, o = (y - y0) * RW * 4; x < x1; x++, o += 4) {
        const a = ld[o + 3] / 255, k = 1 - a, oy = (SH - 1 - y) * SW * 4 + x * 4; // DataTexture 第一列在最下面
        signData[oy] = ld[o] * a + gd[o] * k; signData[oy + 1] = ld[o + 1] * a + gd[o + 1] * k; signData[oy + 2] = ld[o + 2] * a + gd[o + 2] * k; signData[oy + 3] = ld[o + 3];
      }
    }
  };
  drawSign();
  const signTex = keep(new THREE.DataTexture(signData, SW, SH, THREE.RGBAFormat));
  signTex.colorSpace = THREE.SRGBColorSpace; signTex.generateMipmaps = true; signTex.minFilter = THREE.LinearMipmapLinearFilter; signTex.magFilter = THREE.LinearFilter; signTex.anisotropy = aniso; signTex.needsUpdate = true;
  const ready = Promise.race([document.fonts?.load ? Promise.all([document.fonts.load(`700 150px ${SIGN_FONT}`, SIGN_TEXT + '龍家'), document.fonts.load(`700 34px ${COND}`, 'GC8 SUPRA No. 0123456789')]) : Promise.resolve(), new Promise((r) => setTimeout(r, 1500))])
    .catch(() => {}).then(() => { if (!dead) { drawSign(); signTex.needsUpdate = true; } });

  // ---- 共用的 uniform、shader 片段 ----
  const U = {
    uW2L: { value: new THREE.Matrix4() }, // 世界 → 房間本地（鏡頭的本地座標，切牆用）
    uCut: { value: exterior ? 0 : 1 }, uApron: { value: exterior ? XO : 14 }, uBlink: { value: 0 }, uMarble: { value: marbleTex },
    uDeckOcc: { value: Array(12).fill(0) }, uLiftBlink: { value: Array(6).fill(0) }, // 升降機：每一層平台有沒有車（車底的影子）、每一台的警示燈（動的時候閃）
  };
  const ZW = ZS - 12.7; // 第 11 批：車庫變寬，靠兩邊牆的東西往外搬多少（本來照 ZS 12.7 擺的）
  const BX = XB + 2.9, BAYZ = [1.85, 5.55, -1.85, 9.25, -5.55, -9.25], RT = 2.85; // 車位中心 x、車位 z（照車庫頁一開始的鏡頭看得到的順序）、轉盤半徑
  // 小房子（臥室）：車庫左前角 x 0 … 5、z −12.7 … −8.5；人字屋頂屋脊沿 z（在 x 2.5），簷 2.75、脊 3.97；東、南兩面貼著車庫的牆（只有一層內牆板）
  const HX0 = 0, HX1 = XD, HZ0 = -ZS, HZ1 = -8.5 - ZW, HWT = 0.14, HE = 2.75, HP = 0.488, HRT = 0.16, HRX = (HX0 + HX1) / 2, HOV = 0.3, HOVN = 0.15; // 外框、牆厚、簷高、坡度（26°）、屋頂厚、屋脊、西邊／北邊出簷
  const IX0 = HX0 + HWT, IX1 = HX1 - 0.03, IZ0 = HZ0 + 0.03, IZ1 = HZ1 - HWT, HFY = 0.012; // 裡面的牆面、地板高
  const hTop = (x) => HE + (HRX - HX0 - Math.abs(x - HRX)) * HP, hIn = (x) => hTop(x) - HRT; // 屋頂上面、屋頂底（裡面的天花板、屋簷底）
  const BEAMY = hIn(HRX) - 0.2, HD0 = 0.35, HD1 = 1.35, HDH = 2.15; // 屋脊樑底、門洞（正面 x 0.35 … 1.35、高 2.15）
  const HLAMP = [[1.28, 0.885, -12.43 - ZW], [3.72, 0.885, -12.43 - ZW]], SCONCE = [0.16, 1.95, HZ1 + 0.07]; // 兩盞床頭檯燈（燈罩中心）、門邊壁燈
  const HAO = [[2.5, -11.54, 0.92, 1.1], [4.67, -11.87, 0.32, 0.77], [0.41, -12.38, 0.27, 0.28], [4.7, -10.25, 0.3, 0.67]].map(([x, z, hx, hz]) => [x, z - ZW, hx, hz]); // 房子地板上家具底下暗：床、衣櫃、冰箱、書桌
  // 升降機（後牆六個車位都是地坑式兩層）：平台上緣間距 PD、坑深、平台半長（x）半寬（z）厚、坑口半長半寬、柱子（相對平台中心）、操作柱
  const PD = 2.1, PIT = 2.35, DKX = 2.7, DKZ = 1.5, DKT = 0.16, PXH = 2.72, PZH = 1.52, POSTX = DKX - 0.07, POSTZ = DKZ - 0.07, POSTW = 0.07, PANX = BX + 2.5;
  const PANZ = BAYZ.map((c) => c + Math.sign(c) * 1.85); // 操作柱在車位外側那條分隔線上（中間 z = 0 那條空著：車庫頁的鏡頭從後面看車不會被擋）
  const LAMP = [XD - 0.49, DH + 0.4, DZ + 0.1]; // 裡面的警示燈（捲筒盒正面右邊）
  const FB0 = 2.4, FB1 = 3.2; // 後牆黑大理石橫帶（招牌）上下：車庫頁一開始的鏡頭（手機）招牌要在上面那排按鈕下面
  const v3 = (a) => `vec3(${a.map(f3).join(', ')})`;
  const G_DEF = `#define R_XD ${f3(XD)}
#define R_XB ${f3(XB)}
#define R_ZS ${f3(ZS)}
#define R_H ${f3(H)}
#define R_DZ ${f3(DZ)}
float rHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sdb(vec2 p, vec2 c, vec2 h) { vec2 d = abs(p - c) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float hCeil(float x) { return ${f3(HE - HRT)} + (${f3(HRX - HX0)} - abs(x - ${f3(HRX)})) * ${f3(HP)}; } // 小房子的天花板高
float houseK(vec3 p) { return p.x > ${f3(IX0 - 0.02)} && p.x < ${f3(IX1 + 0.02)} && p.z > ${f3(IZ0 - 0.02)} && p.z < ${f3(IZ1 + 0.02)} && p.y < hCeil(p.x) + 0.02 ? 1.0 : 0.0; } // 1＝小房子裡面
float roomPitD(vec2 q) { float c = 1.85 + 3.7 * clamp(floor((q.y - 1.85) / 3.7 + 0.5), -3.0, 2.0); return max(abs(q.x - ${f3(BX)}) - ${f3(PXH)}, abs(q.y - c) - ${f3(PZH)}); } // 離升降機坑口的邊多遠（裡面＜0）
bool roomPitXZ(vec2 q) { return roomPitD(q) < 0.0; } // 升降機的坑口
`;
  // 環境光：朝上（天花板、燈）＞水平（牆）＞朝下（地板反上來）；牆腳、天花板邊、牆角暗一點
  const G_AMB = `uniform float uBlink;
// 小房子裡面：暖、暗一點（車庫的燈照不進來）；靠窗（北）那邊亮一點；牆腳、牆角、天花板角暗，地板上家具底下暗
vec3 houseAmb(vec3 n, vec3 p) {
  vec3 e = n.y >= 0.0 ? mix(${v3([0.5, 0.42, 0.33])}, ${v3([0.6, 0.5, 0.39])}, n.y) : mix(${v3([0.5, 0.42, 0.33])}, ${v3([0.34, 0.28, 0.21])}, -n.y);
  e += ${v3([0.2, 0.2, 0.21])} * (exp(-max(${f3(IZ1)} - p.z, 0.0) / 1.1) * (0.45 + 0.55 * max(n.z, 0.0)));
  float dx = min(p.x - ${f3(IX0)}, ${f3(IX1)} - p.x), dz = min(p.z - ${f3(IZ0)}, ${f3(IZ1)} - p.z), dw = min(dx, dz), dw2 = max(dx, dz), v = 1.0 - abs(n.y);
  float ao = 1.0 - v * 0.28 * exp(-max(p.y, 0.0) / 0.25);
  ao *= 1.0 - 0.3 * exp(-max(dw2, 0.0) / 0.35) * exp(-max(dw, 0.0) / 0.2);
  ao *= 1.0 - 0.22 * exp(-max(hCeil(p.x) - p.y, 0.0) / 0.25);
  if (n.y > 0.5 && p.y < 0.05) {
${HAO.map(([x, z, hx, hz]) => `    ao *= 1.0 - 0.5 * exp(-max(sdb(p.xz, vec2(${f3(x)}, ${f3(z)}), vec2(${f3(hx)}, ${f3(hz)})), 0.0) / 0.1);`).join('\n')}
  }
  return e * ao;
}
// 小房子裡的燈：兩盞床頭檯燈（暖）、屋脊樑兩邊往上打的 LED、床底 LED 照地板、電視的光
vec3 houseWash(vec3 n, vec3 p, float k) {
  vec3 w = vec3(0.0);
${HLAMP.map(([x, y, z]) => `  { vec3 d = ${v3([x, y, z])} - p; float r = max(length(d), 0.05); w += ${v3([1.7, 1.12, 0.55])} * ((0.3 + 0.7 * max(dot(n, d / r), 0.0)) * exp(-r / 0.8) / (1.0 + 1.6 * r * r)); }`).join('\n')}
  float dr = length(vec2(p.x - ${f3(HRX)}, (p.y - ${f3(BEAMY + 0.03)}) * 1.3)); w += ${v3([0.75, 0.52, 0.3])} * (exp(-dr / 0.6) * max(-n.y, 0.3));
  float db = sdb(p.xz, vec2(2.5, ${f3(-11.54 - ZW)}), vec2(0.78, 0.94)); w += ${v3([1.1, 0.62, 0.28])} * (exp(-max(db, 0.0) / 0.1) * exp(-max(p.y - ${f3(HFY)}, 0.0) / 0.05) * step(-0.04, db));
  { vec3 d = vec3(4.9, 1.46, ${f3(-10.25 - ZW)}) - p; float r = max(length(d), 0.05); w += ${v3([0.1, 0.12, 0.18])} * (max(dot(n, d / r), 0.0) * exp(-r / 1.4)); }
  return w * (0.7 + 0.3 * k);
}
// 反射（環境貼圖是車庫大廳，很亮）：小房子裡面、坑裡面暗很多
float roomSpec(vec3 n, vec3 p) { float s = houseK(p + n * 0.06) > 0.5 ? 0.35 : 1.0; if (p.y < -0.02) s *= 0.12 + 0.88 * exp(p.y / 0.5); return s; }
vec3 roomAmb(vec3 n, vec3 p) {
  if (houseK(p + n * 0.06) > 0.5) return houseAmb(n, p);
  vec3 e = n.y >= 0.0 ? mix(${v3([0.76, 0.735, 0.7])}, ${v3([1.05, 0.99, 0.91])}, n.y) : mix(${v3([0.76, 0.735, 0.7])}, ${v3([0.62, 0.6, 0.57])}, -n.y);
  float dx = min(p.x - R_XB, R_XD - p.x), dz = R_ZS - abs(p.z), dw = min(dx, dz), dw2 = max(dx, dz), v = 1.0 - abs(n.y);
  float ao = 1.0 - v * 0.3 * exp(-max(p.y, 0.0) / 0.32);
  ao *= 1.0 - v * 0.1 * exp(-max(R_H - p.y, 0.0) / 0.2);
  ao *= 1.0 - 0.28 * exp(-max(dw2, 0.0) / 0.5) * exp(-max(dw, 0.0) / 0.3);
  ao *= 1.0 - max(-n.y, 0.0) * 0.18 * exp(-max(dw, 0.0) / 0.7);
  if (p.y < -0.02) ao *= 0.16 + 0.84 * exp(p.y / 0.7); // 升降機的坑裡：越深越暗
  return e * ao;
}
// 燈打在表面上的光（乘上顏色）：四周燈槽往下洗牆、後牆橫帶下面的燈、警示燈（閃）
vec3 roomWash(vec3 n, vec3 p, float k) {
  if (houseK(p + n * 0.06) > 0.5) return houseWash(n, p, k);
  float dx = min(p.x - R_XB, R_XD - p.x), dz = R_ZS - abs(p.z), dw = min(dx, dz), v = 1.0 - abs(n.y);
  vec3 w = ${v3([1.0, 0.74, 0.5])} * (v * k * 1.1 * exp(-max(${f3(HC)} - p.y, 0.0) / 0.62) * exp(-max(dw, 0.0) / 0.3));
  if (p.x < R_XB + 0.35 && p.y < ${f3(FB0)}) w += ${v3([0.9, 0.66, 0.44])} * (v * k * 0.9 * exp(-(${f3(FB0)} - p.y) / 0.5));
  w += ${v3([2.2, 0.8, 0.06])} * (uBlink * exp(-distance(p, ${v3(LAMP)}) / 0.32));
  w += ${v3([1.3, 0.92, 0.55])} * exp(-distance(p, ${v3(SCONCE)}) / 0.3); // 小房子門邊的壁燈
  if (p.y < 0.02 && roomPitD(p.xz) < 0.03) w += ${v3([0.9, 0.72, 0.5])} * exp(-abs(p.y + 0.3) / 0.35); // 坑口下面一圈 LED（坑壁剛好在邊上：多 3 公分，不然一點亮一點不亮）
  return w;
}
`;
  const G_CUT = `uniform float uCut;
void roomCut(vec3 c, vec3 q) { // 鏡頭跑到牆外（或天花板上面）：靠那面牆的東西丟掉、天花板抖動淡掉
  if (uCut < 0.5) return;
  if (!(q.x > -0.4 && q.z < ${f3(-8.2 - ZW)} && q.y < 4.1) && ((c.x > R_XD - 0.9 && q.x > R_XD - 1.3) || (c.x < R_XB + 0.9 && q.x < R_XB + 1.3) || (c.z > R_ZS - 0.9 && q.z > R_ZS - 1.3) || (c.z < 0.9 - R_ZS && q.z < 1.3 - R_ZS))) discard; // 小房子不切（鏡頭不會進去；靠牆那兩面只有內牆板）
  float k = smoothstep(R_H - 0.3, R_H + 0.4, c.y) * step(R_H - 0.16, q.y);
  if (k > 0.0 && k >= fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;
}
`;
  // 地板：1.2 公尺的大理石大塊磚（每塊從大理石貼圖挑一塊、轉個方向）、灰色細縫；轉盤＝一整塊黑大理石＋不鏽鋼圈＋暖白 LED；
  // 車位＝黃銅嵌線＋投射燈的光；牆腳藏的 LED；家具底下、有車的車位底下暗一點；門口不鏽鋼門檻＋鐵捲門的黑膠條
  const AO_BOX = [];
  const G_FLOOR = `uniform sampler2D uMarble;
float gTile; // 這一點是不是一塊一塊的磚（反射每塊歪一點點；轉盤、門檻是一整塊，不歪）
vec3 marbleAt(vec2 q, out float seam) {
  vec2 tp = q / 1.2, ti = floor(tp), f = tp - ti;
  float h1 = rHash(ti), h2 = rHash(ti + 19.19), h3 = rHash(ti + 7.77);
  vec2 g = h3 > 0.5 ? f.yx : f;
  if (fract(h3 * 13.0) > 0.5) g.x = 1.0 - g.x;
  vec2 uv = vec2(h1, h2) * 0.62 + g * 0.375, gx = dFdx(tp) * 0.375, gy = dFdy(tp) * 0.375;
  vec3 c = textureGrad(uMarble, uv, gx, gy).rgb * (0.975 + 0.04 * h2);
  vec2 e2 = min(f, 1.0 - f) * 1.2; float e = min(e2.x, e2.y);
  seam = 1.0 - smoothstep(0.0014, 0.0014 + fwidth(e) * 1.3, e);
  return c;
}
void roomFloor(vec2 q, out vec3 alb, out float rough, out float metal, out vec3 emit, out float ao) {
  float seam; alb = marbleAt(q, seam); rough = 0.08; metal = 0.0; emit = vec3(0.0); ao = 1.0; gTile = 1.0;
  vec3 light = vec3(0.0);
  float r = length(q), fr = fwidth(r);
  if (r < ${f3(RT)}) { alb = (vec3(1.0) - texture2D(uMarble, q / ${f3(2 * RT)} * 0.95 + 0.5).rgb) * 0.11 + 0.007; rough = 0.04; seam = 0.0; gTile = 0.0; }
  else if (r < ${f3(RT + 0.05)}) { alb = ${v3(STEEL)}; metal = 1.0; rough = 0.26; seam = 0.0; gTile = 0.0; }
  alb *= 1.0 - 0.42 * seam; rough = mix(rough, 0.45, seam);
  float dl = abs(r - ${f3(RT + 0.075)});
  emit += ${v3(LED)} * (0.8 * (1.0 - smoothstep(0.007, 0.007 + fr * 1.5, dl)));
  light += ${v3([1.0, 0.74, 0.48])} * (0.3 * exp(-dl / 0.1));
  // 車位（升降機）：黃銅線（後牆到走道、車位中間）＋前緣一條橫線；坑口在 main() 裡丟掉（平台自己畫）
  float lz = clamp(floor(q.y / 3.7 + 0.5), -3.0, 3.0) * 3.7, bl = (q.x < ${f3(BX + 2.75)} && q.x > R_XB) ? abs(q.y - lz) : 1e3;
  if (abs(q.y) < 11.11) bl = min(bl, abs(q.x - ${f3(BX + 2.75)}));
  float fb = fwidth(q.x) + fwidth(q.y), brass = 1.0 - smoothstep(0.011, 0.011 + fb, bl);
  alb = mix(alb, ${v3(BRASS)}, brass); metal = mix(metal, 1.0, brass); rough = mix(rough, 0.24, brass);
  float kb = clamp(floor((q.y - 1.85) / 3.7 + 0.5), -3.0, 2.0), bz = 1.85 + 3.7 * kb;
  vec2 db = vec2((q.x - ${f3(BX)}) / 2.1, (q.y - bz) / 1.35);
  light += ${v3([1.0, 0.86, 0.7])} * (0.42 * exp(-dot(db, db)));
  light += ${v3([1.0, 0.9, 0.78])} * (0.1 * exp(-r * r / 10.0));
  light += ${v3([1.0, 0.7, 0.42])} * (0.3 * exp(-max(sdb(q, vec2(2.45, ${f3(HZ1 + 0.2)}), vec2(2.15, 0.05)), 0.0) / 0.5) * step(${f3(HZ1)}, q.y)); // 小房子門、窗透出來的暖光
  // 牆腳：踢腳板縫裡的 LED 照地板（門那一段沒有）
  float dx = min(q.x - R_XB, R_XD - q.x), dzw = R_ZS - abs(q.y), dw = min(dx, dzw);
  float gap = (R_XD - q.x < 0.6 && abs(q.y) < R_DZ + 0.4) || q.x > R_XD ? 0.0 : 1.0; // 門口、門外（車庫頁地板鋪到門外）沒有
  light += ${v3([1.0, 0.72, 0.45])} * (0.55 * gap * exp(-max(dw, 0.0) / 0.1));
  ao *= 1.0 - 0.3 * step(q.x, R_XD) * exp(-max(dw, 0.0) / 0.4);
  __AO__
  // 門口：不鏽鋼門檻、鐵捲門落下的地方一條黑膠條
  if (q.x > R_XD - 0.1 && q.x < R_XD + 0.3 && abs(q.y) < R_DZ) { alb = ${v3(STEEL)}; metal = 1.0; rough = 0.34; gTile = 0.0; }
  if (abs(q.x - (R_XD - 0.07)) < 0.014 && abs(q.y) < R_DZ) { alb = vec3(0.012); metal = 0.0; rough = 0.8; }
  emit += alb * light * (1.0 - metal);
}
`;

  // ---- 材質補丁：本地座標、切牆、自己的環境光（不吃場景的燈）、大理石／貼圖集二選一、每個頂點的粗糙度金屬度、石板縫 ----
  const VH = 'uniform mat4 uW2L; varying vec3 vLoc; varying vec3 vLocN; varying vec3 vCam;\n';
  const VA = 'attribute vec4 aMat; attribute vec4 aSeam; varying vec4 vMat; varying vec4 vSeam;\n';
  const vBody = (n, a) => `{ vec4 lp = vec4(transformed, 1.0);${n ? ' vec3 ln = objectNormal;' : ''}
#ifdef USE_INSTANCING
  lp = instanceMatrix * lp;${n ? ' ln = mat3(instanceMatrix) * ln;' : ''}
#endif
  vLoc = lp.xyz; vLocN = ${n ? 'normalize(ln)' : 'vec3(0.0, 1.0, 0.0)'}; vCam = (uW2L * vec4(cameraPosition, 1.0)).xyz;${a ? ' vMat = aMat; vSeam = aSeam;' : ''} }`;
  const FH = 'varying vec3 vLoc; varying vec3 vLocN; varying vec3 vCam;\n', FA = 'varying vec4 vMat; varying vec4 vSeam;\n';
  const G_LIFT = `uniform float uDeckOcc[12]; uniform float uLiftBlink[6];
float deckOcc(int i) { float v = 0.0; for (int k = 0; k < 12; k++) if (k == i) v = uDeckOcc[k]; return v; }
float liftBlink(int i) { float v = 0.0; for (int k = 0; k < 6; k++) if (k == i) v = uLiftBlink[k]; return v; }
`;
  // lit：'room'＝房間裡面的光、'world'＝吃場景的燈（外殼）、'none'＝不打光（燈、招牌）；amat：幾何有每個頂點的材質；cut：切牆；more(sh)：再改
  function patch(m, key, { lit = 'room', amat = false, cut = true, wash = true, more } = {}) {
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      const std = lit !== 'none';
      sh.vertexShader = VH + (amat ? VA : '') + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n${vBody(std, amat)}`);
      let f = G_DEF + FH + (amat ? FA : '') + G_AMB + G_CUT + G_LIFT + 'uniform sampler2D uMarble;\n' + sh.fragmentShader;
      if (cut) f = f.replace('void main() {', 'void main() {\n  roomCut(vCam, vLoc);');
      // 先插洗牆、後插「大理石不吃發光貼圖」：插在同一行後面，後插的在前面 → include、step、wash
      if (lit === 'room') {
        f = f.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * roomWash(vLocN, vLoc, ${amat ? 'vMat.w' : wash ? '1.0' : '0.0'}) * (1.0 - metalnessFactor);`)
          .replace('#include <lights_fragment_begin>', '#undef RE_Direct\n#undef RE_Direct_RectArea\n#include <lights_fragment_begin>\n  irradiance = vec3(0.0);')
          .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n  iblIrradiance = PI * roomAmb(vLocN, vLoc); radiance *= roomSpec(vLocN, vLoc);');
      }
      if (amat && std) {
        f = f.replace('#include <map_fragment>', `#ifdef USE_MAP
  { vec3 at = texture2D(map, vMapUv).rgb, mb = texture2D(uMarble, vMapUv).rgb;
    diffuseColor.rgb *= vMat.z < 0.5 ? at : vMat.z < 1.5 ? mb : (vec3(1.0) - mb) * 0.12 + 0.008; }
#endif
  { float se = min(min(vSeam.x, vSeam.z - vSeam.x), min(vSeam.y, vSeam.w - vSeam.y)); // 石板的縫
    diffuseColor.rgb *= 1.0 - 0.5 * (1.0 - smoothstep(0.0012, 0.0012 + fwidth(se) * 1.3, se)); }`)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = vMat.x;')
          .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = vMat.y;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= step(vMat.z, 0.5);');
      }
      f = f.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = clamp(diffuseColor.rgb, 0.0, 12.0); // 很細的面：MSAA 外插的頂點色可能是負的');
      if (lit === 'none' && amat) f = f.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= mix(1.0, 0.03 + 0.97 * uBlink, vMat.x) * (vMat.y > 0.5 ? 0.03 + 0.97 * liftBlink(int(vMat.y - 0.5)) : 1.0); // 閃：x＝鐵捲門、y＝第幾台升降機（+1）');
      sh.fragmentShader = f;
      if (more) more(sh);
    };
    m.customProgramCacheKey = () => `room3-${key}`;
    return keep(m);
  }

  // ---- 合併網格：同一個材質的東西全部塞進一個 BufferGeometry（位置、法線、貼圖座標、頂點色、每個頂點的材質、石板縫座標） ----
  const FACES = { px: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], nx: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], py: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
    ny: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], pz: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], nz: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] };
  const mwin = (w, h, flip, rg = rnd) => { const sw = Math.min(1, w / MT), sh = Math.min(1, h / MT), u0 = rg() * (1 - sw), v0 = rg() * (1 - sh); return flip ? [u0 + sw, v0, u0, v0 + sh] : [u0, v0, u0 + sw, v0 + sh]; };
  const NOSEAM = [1e4, 1e4, 2e4, 2e4];
  function batch() {
    const P = [], N = [], Uv = [], C = [], Ma = [], Se = [], I = [], t = new THREE.Vector3(), nm = new THREE.Matrix3();
    const b = {
      oz: 0, // 第 11 批：整塊往 z 挪多少（小房子照本來的座標蓋，再跟著牆搬）
      get count() { return I.length; },
      // 四邊形 a b c d：從正面看逆時針（左下、右下、右上、左上）；r＝貼圖範圍（'M'＝隨便挑一塊大理石）；col＝一個顏色或四個角各一個；mat＝MM 的一個；seam＝畫石板縫
      quad(a, bb, c, d, r = RW, col = W1, mat = MM.paint, seam = false) {
        const k = P.length / 3, ab = bb.clone().sub(a), ad = d.clone().sub(a), n = ab.clone().cross(ad).normalize(), w = ab.length(), h = ad.length();
        if (r === 'M') r = mwin(w, h, rnd() < 0.5);
        const cs = Array.isArray(col[0]) ? col : [col, col, col, col], sm = [[0, 0], [w, 0], [w, h], [0, h]];
        [[a, r[0], r[1]], [bb, r[2], r[1]], [c, r[2], r[3]], [d, r[0], r[3]]].forEach(([p, u, v], i) => {
          P.push(p.x, p.y, p.z + b.oz); N.push(n.x, n.y, n.z); Uv.push(u, v); C.push(...cs[i]); Ma.push(...mat); Se.push(...(seam ? [sm[i][0], sm[i][1], w, h] : NOSEAM));
        });
        I.push(k, k + 1, k + 2, k, k + 2, k + 3);
      },
      // 盒子：m＝位置方向，s＝[寬, 高, 深]，f＝{ px: [r, col, mat, seam], ..., all: [...], skip: 'nz ny' }（沒有的面不畫）
      box(m, s, f) {
        for (const [k, cs] of Object.entries(FACES)) {
          const o = f[k] || (f.all && !(f.skip || '').includes(k) ? f.all : null); if (!o) continue;
          const q = cs.map(([x, y, z]) => V((x * s[0]) / 2, (y * s[1]) / 2, (z * s[2]) / 2).applyMatrix4(m));
          b.quad(q[0], q[1], q[2], q[3], o[0], o[1], o[2], o[3]);
        }
      },
      // 任何 BufferGeometry（旋轉體、圓柱⋯）：套 m、貼圖座標壓進 r、顏色 col（null＝用它自己的頂點色）
      geo(g, m, r = RW, col = W1, mat = MM.paint) {
        const k = P.length / 3, p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, c = g.attributes.color;
        nm.getNormalMatrix(m);
        for (let i = 0; i < p.count; i++) {
          t.fromBufferAttribute(p, i).applyMatrix4(m); P.push(t.x, t.y, t.z + b.oz);
          t.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); N.push(t.x, t.y, t.z);
          const u = uv ? uv.getX(i) : 0.5, v = uv ? uv.getY(i) : 0.5; Uv.push(r[0] + u * (r[2] - r[0]), r[1] + v * (r[3] - r[1]));
          if (col) C.push(...col); else C.push(c.getX(i), c.getY(i), c.getZ(i));
          Ma.push(...mat); Se.push(...NOSEAM);
        }
        if (g.index) for (let i = 0; i < g.index.count; i++) I.push(k + g.index.getX(i)); else for (let i = 0; i < p.count; i++) I.push(k + i);
        g.dispose();
      },
      build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(Uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
        g.setAttribute('aMat', new THREE.Float32BufferAttribute(Ma, 4)); g.setAttribute('aSeam', new THREE.Float32BufferAttribute(Se, 4));
        g.setIndex(I); g.computeBoundingSphere();
        return keep(g);
      },
    };
    return b;
  }
  const S = batch(), L = batch(), T = batch(), E = batch(), EL = batch(), GL = batch(); // 房子＋家具（大理石＋貼圖集）、燈、獎盃、外殼、外面的燈、玻璃

  // 四面牆的座標系（裡面）：u 往右（從房間裡面看）、y 往上、n 往房間裡面
  const WALL = {
    A: M4().makeBasis(V(0, 0, -1), V(0, 1, 0), V(1, 0, 0)).setPosition(XB, 0, 0), B: M4().makeBasis(V(0, 0, 1), V(0, 1, 0), V(-1, 0, 0)).setPosition(XD, 0, 0),
    C: M4().makeBasis(V(-1, 0, 0), V(0, 1, 0), V(0, 0, -1)).setPosition(0, 0, ZS), D: M4().makeBasis(V(1, 0, 0), V(0, 1, 0), V(0, 0, 1)).setPosition(0, 0, -ZS),
    // 外牆（n 往外）
    EA: M4().makeBasis(V(0, 0, 1), V(0, 1, 0), V(-1, 0, 0)).setPosition(XBO, 0, 0), EB: M4().makeBasis(V(0, 0, -1), V(0, 1, 0), V(1, 0, 0)).setPosition(XO, 0, 0),
    EC: M4().makeBasis(V(1, 0, 0), V(0, 1, 0), V(0, 0, 1)).setPosition(0, 0, ZO), ED: M4().makeBasis(V(-1, 0, 0), V(0, 1, 0), V(0, 0, -1)).setPosition(0, 0, -ZO),
  };
  const at = (w, u, y, n, ry = 0, rx = 0) => WALL[w].clone().multiply(M4().makeRotationFromEuler(new THREE.Euler(rx, ry, 0)).setPosition(u, y, n));
  const wq = (bt, w, u0, u1, y0, y1, n, r, col, mat, seam) => { const m = WALL[w]; bt.quad(V(u0, y0, n).applyMatrix4(m), V(u1, y0, n).applyMatrix4(m), V(u1, y1, n).applyMatrix4(m), V(u0, y1, n).applyMatrix4(m), r, col, mat, seam); };
  const wqDown = (bt, w, u0, u1, y, n0, n1, r, col, mat) => { const m = WALL[w]; bt.quad(V(u0, y, n0).applyMatrix4(m), V(u1, y, n0).applyMatrix4(m), V(u1, y, n1).applyMatrix4(m), V(u0, y, n1).applyMatrix4(m), r, col, mat); }; // 朝下
  const wqUp = (bt, w, u0, u1, y, n0, n1, r, col, mat) => { const m = WALL[w]; bt.quad(V(u0, y, n1).applyMatrix4(m), V(u1, y, n1).applyMatrix4(m), V(u1, y, n0).applyMatrix4(m), V(u0, y, n0).applyMatrix4(m), r, col, mat); }; // 朝上
  const wb = (bt, w, u0, u1, y0, y1, n0, n1, f) => bt.box(at(w, (u0 + u1) / 2, (y0 + y1) / 2, (n0 + n1) / 2), [u1 - u0, y1 - y0, n1 - n0], f);
  const COLS = []; // 家具的碰撞盒（本地）
  const colW = (w, u0, u1, n0, n1, h) => { // 牆座標的長方形 → 本地的碰撞盒
    const a = V(u0, 0, n0).applyMatrix4(WALL[w]), b = V(u1, 0, n1).applyMatrix4(WALL[w]);
    COLS.push({ t: 'box', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, hx: Math.abs(a.x - b.x) / 2, hz: Math.abs(a.z - b.z) / 2, rot: 0, h });
    AO_BOX.push([(a.x + b.x) / 2, (a.z + b.z) / 2, Math.abs(a.x - b.x) / 2, Math.abs(a.z - b.z) / 2]);
  };

  // ---- 大理石板：一格一格（寬 ~1.6 公尺、兩排），左右兩塊一對（書本對花），每對從大理石貼圖裡挑一塊 ----
  const ROWS = [0.12, 2.36, HC];
  function slabs(w, u0, u1, rows = ROWS, { cw = 1.6, n = 0, mat = MM.marble, col = W1, bt = S } = {}) {
    const nc = Math.max(1, Math.round((u1 - u0) / cw)), sw = (u1 - u0) / nc;
    for (let r = 0; r < rows.length - 1; r++) {
      let win = null;
      for (let i = 0; i < nc; i++) {
        if (i % 2 === 0) win = mwin(sw, rows[r + 1] - rows[r], false);
        wq(bt, w, u0 + i * sw, u0 + (i + 1) * sw, rows[r], rows[r + 1], n, i % 2 ? [win[2], win[1], win[0], win[3]] : win, col, mat, true);
      }
    }
  }
  // 踢腳：黑大理石往牆裡縮 2 公分（下面藏 LED，照亮地板：地板 shader 的 light）
  const skirt = (w, u0, u1) => { wq(S, w, u0, u1, 0, ROWS[0], -0.02, 'M', W1, MM.nero, true); wqDown(S, w, u0, u1, ROWS[0], -0.02, 0, RW, BLK, MM.satin); };

  // ---- 天花板：白色、四周退 0.22 公尺是燈槽（暖白燈往下洗牆），中間主車位上面一圈圓環燈，走道四條長線燈，每個車位一顆投射燈 ----
  const CV = 0.22;
  S.quad(V(XB + CV, H, -ZS + CV), V(XD - CV, H, -ZS + CV), V(XD - CV, H, ZS - CV), V(XB + CV, H, ZS - CV), RW, CEIL, MM.paint); // 朝下
  for (const [w, u0, u1] of [['A', -ZS, ZS], ['B', -ZS, ZS], ['C', -XD, -XB], ['D', XB, XD]]) {
    const m = WALL[w];
    const a = V(u0, HC, 0).applyMatrix4(m), b = V(u1, HC, 0).applyMatrix4(m), c = V(u1, HC, CV).applyMatrix4(m), d = V(u0, HC, CV).applyMatrix4(m);
    L.quad(a, b, c, d, RW, [[2.2, 1.6, 1.05], [2.2, 1.6, 1.05], [0.9, 0.62, 0.38], [0.9, 0.62, 0.38]], MM.lamp); // 燈槽頂（朝下）：靠牆亮
    wqDown(S, w, u0 + CV, u1 - CV, H, CV, CV + 0.012, RW, CEIL, MM.paint);
  }
  { // 圓環燈（主車位上面，平的嵌在天花板）
    const ring = new THREE.RingGeometry(2.3, 2.38, 96, 1).rotateX(Math.PI / 2).translate(0, H - 0.004, 0);
    L.geo(ring, M4(), RW, [5.4, 4.6, 3.6], MM.lamp);
    S.geo(new THREE.RingGeometry(2.25, 2.43, 96, 1).rotateX(Math.PI / 2).translate(0, H - 0.002, 0), M4(), RW, [0.5, 0.5, 0.5], MM.satin);
  }
  for (const z of [-7.1, -3.5, 3.5, 7.1]) { // 走道的長線燈（沿著 x）
    S.quad(V(-6.4, H - 0.002, z - 0.05), V(3.9, H - 0.002, z - 0.05), V(3.9, H - 0.002, z + 0.05), V(-6.4, H - 0.002, z + 0.05), RW, [0.4, 0.4, 0.4], MM.satin);
    L.quad(V(-6.35, H - 0.004, z - 0.028), V(3.85, H - 0.004, z - 0.028), V(3.85, H - 0.004, z + 0.028), V(-6.35, H - 0.004, z + 0.028), RW, LINE, MM.lamp);
  }
  { // 車位前面一條橫的線燈（照車頭）
    const x = BX + 2.3;
    S.quad(V(x - 0.05, H - 0.002, -11.1), V(x + 0.05, H - 0.002, -11.1), V(x + 0.05, H - 0.002, 11.1), V(x - 0.05, H - 0.002, 11.1), RW, [0.4, 0.4, 0.4], MM.satin);
    L.quad(V(x - 0.028, H - 0.004, -11.05), V(x + 0.028, H - 0.004, -11.05), V(x + 0.028, H - 0.004, 11.05), V(x - 0.028, H - 0.004, 11.05), RW, LINE, MM.lamp);
  }
  const downlight = (x, z, r = 0.075, c = SPOT) => { // 嵌燈：黑框＋亮的圓
    S.geo(new THREE.CircleGeometry(r + 0.035, 20).rotateX(Math.PI / 2).translate(x, H - 0.002, z), M4(), RW, [0.02, 0.02, 0.022], MM.satin);
    L.geo(new THREE.CircleGeometry(r, 20).rotateX(Math.PI / 2).translate(x, H - 0.004, z), M4(), RW, c, MM.lamp);
  };
  for (const z of BAYZ) { downlight(BX - 0.9, z); downlight(BX + 0.9, z); }
  for (const [x, z] of [[-5.1, -11.0 - ZW], [-2.9, -11.0 - ZW], [-6.0, 11.4 + ZW], [-4.0, 11.4 + ZW], [4.1, 6.2], [4.1, 9.0], [4.1, -6.25], [0.85, -7.75 - ZW], [-11.4, 11.6 + ZW], [-11.4, -11.6 - ZW]]) downlight(x, z, 0.06); // (0.85, −7.75)：小房子門口

  // ---- 牆 A（x = XB，後牆）：六個展示車位；白大理石＋壁柱（兩邊黃銅條）、上面黑大理石橫帶（招牌、徽章），每個車位一塊黑玻璃名牌 ----
  const PIL = [-11.1, -7.4, -3.7, 0, 3.7, 7.4, 11.1]; // 壁柱（u）
  slabs('A', -ZS, ZS, [0.12, FB0 + 0.02]); slabs('A', -ZS, ZS, [FB1 - 0.02, HC]); skirt('A', -ZS, ZS);
  for (const u of PIL) {
    wb(S, 'A', u - 0.23, u + 0.23, 0, FB0, 0, 0.13, { pz: ['M', W1, MM.marble, true], px: ['M', W1, MM.marble, true], nx: ['M', W1, MM.marble, true] });
    for (const s of [-1, 1]) wb(S, 'A', u + s * 0.23 - 0.012, u + s * 0.23 + 0.012, 0.12, FB0, 0.13, 0.142, { all: [RW, BRASS, MM.brass], skip: 'nz ny py' });
    wb(S, 'A', u - 0.24, u + 0.24, 0, 0.12, 0.13, 0.135, { pz: [RW, BLK, MM.gloss] });
    colW('A', u - 0.23, u + 0.23, 0, 0.14, FB0);
  }
  wb(S, 'A', -ZS, ZS, FB0, FB1, 0, 0.2, { py: [RW, BLK, MM.gloss], ny: [RW, BLK, MM.gloss] }); slabs('A', -ZS, ZS, [FB0, FB1], { cw: 2.1, n: 0.2, mat: MM.nero }); // 黑大理石橫帶
  for (const y of [FB0 + 0.01, FB1 - 0.01]) wb(S, 'A', -ZS, ZS, y - 0.012, y + 0.012, 0.2, 0.207, { pz: [RW, BRASS, MM.brass], py: [RW, BRASS, MM.brass], ny: [RW, BRASS, MM.brass] });
  wqDown(L, 'A', -ZS, ZS, FB0 - 0.001, 0.13, 0.18, RW, [3.2, 2.3, 1.45], MM.lamp); // 橫帶下緣的燈
  for (const z of BAYZ) { // 名牌：黑玻璃＋黃銅框
    const u = -z;
    wb(S, 'A', u - 0.48, u + 0.48, 1.56, 1.86, 0, 0.025, { pz: [RW, [0.008, 0.008, 0.009], MM.gloss], px: [RW, BRASS, MM.brass], nx: [RW, BRASS, MM.brass], py: [RW, BRASS, MM.brass], ny: [RW, BRASS, MM.brass] });
  }

  // ---- 牆 B（x = XD，門那面）：鐵捲門（兩邊黑色導軌、上面白色捲筒盒＋警示燈、門邊開關盒）；右邊輪胎架、左邊模型車展示櫃 ----
  const RL = 0.13, BOXN = 0.48, BOXY = DH + 0.06; // 導軌深、捲筒盒深、盒底
  slabs('B', -ZS, -DZ - 0.36); slabs('B', DZ + 0.36, ZS); skirt('B', -ZS, -DZ - 0.36); skirt('B', DZ + 0.36, ZS);
  wq(S, 'B', -DZ - 0.36, DZ + 0.36, DH, HC, 0, RW, CEIL, MM.paint); // 門洞上面（被盒子擋住）
  S.quad(V(XD, 0, -DZ), V(XO, 0, -DZ), V(XO, DH, -DZ), V(XD, DH, -DZ), RW, [0.02, 0.02, 0.022], MM.satin); // 門洞的內側（牆的厚度）：兩邊、上面，黑色
  S.quad(V(XO, 0, DZ), V(XD, 0, DZ), V(XD, DH, DZ), V(XO, DH, DZ), RW, [0.02, 0.02, 0.022], MM.satin);
  S.quad(V(XD, DH, -DZ), V(XO, DH, -DZ), V(XO, DH, DZ), V(XD, DH, DZ), RW, [0.02, 0.02, 0.022], MM.satin);
  { const e = 0.003; // 外殼也放一份（村子裡門關著、鏡頭在外面的時候裡面整組不畫，斜斜看會看穿），往門洞裡面挪 3 公釐不會打架
    E.quad(V(XD - 0.08, 0, -DZ + e), V(XO, 0, -DZ + e), V(XO, DH - e, -DZ + e), V(XD - 0.08, DH - e, -DZ + e), RW, [0.02, 0.02, 0.022], MM.satin);
    E.quad(V(XO, 0, DZ - e), V(XD - 0.08, 0, DZ - e), V(XD - 0.08, DH - e, DZ - e), V(XO, DH - e, DZ - e), RW, [0.02, 0.02, 0.022], MM.satin);
    E.quad(V(XD - 0.08, DH - e, -DZ), V(XO, DH - e, -DZ), V(XO, DH - e, DZ), V(XD - 0.08, DH - e, DZ), RW, [0.02, 0.02, 0.022], MM.satin); }
  for (const s of [-1, 1]) {
    wb(S, 'B', s > 0 ? DZ : -DZ - 0.36, s > 0 ? DZ + 0.36 : -DZ, 0, BOXY, 0, 0.012, { pz: [RW, [0.02, 0.02, 0.022], MM.satin] }); // 門框（黑）
    const u0 = s > 0 ? DZ - 0.02 : -DZ - 0.12, u1 = s > 0 ? DZ + 0.12 : -DZ + 0.02;
    wb(S, 'B', u0, u1, 0, BOXY, 0.012, RL, { all: [RW, GUN, MM.satin], skip: 'nz ny py' }); // 導軌（U 型槽，黑色陽極）
    wb(S, 'B', s > 0 ? DZ - 0.02 : -DZ + 0.005, s > 0 ? DZ - 0.005 : -DZ + 0.02, 0, BOXY, 0.03, RL - 0.02, { [s > 0 ? 'nx' : 'px']: [RW, [0.005, 0.005, 0.005], MM.rubber] });
    COLS.push({ t: 'box', x: XD - RL / 2, z: s * (DZ + 0.05), hx: RL / 2, hz: 0.07, rot: 0, h: BOXY });
  }
  // 捲筒盒：白色烤漆，下面有一條縫讓門片進去，正面下緣一條黃銅線
  wb(S, 'B', -DZ - 0.36, DZ + 0.36, BOXY, H, 0.0, BOXN, { pz: [RW, LACQ, MM.lacq], px: [RW, LACQ, MM.lacq], nx: [RW, LACQ, MM.lacq] });
  wqDown(S, 'B', -DZ - 0.36, DZ + 0.36, BOXY, 0.1, BOXN, RW, [0.7, 0.7, 0.69], MM.lacq);
  wqDown(S, 'B', -DZ - 0.36, DZ + 0.36, BOXY, 0, 0.04, RW, [0.7, 0.7, 0.69], MM.lacq);
  wqDown(S, 'B', -DZ, DZ, BOXY + 0.12, 0.04, 0.1, RW, [0.02, 0.02, 0.02], MM.satin); // 縫裡面（暗）
  wb(S, 'B', -DZ - 0.36, DZ + 0.36, BOXY, BOXY + 0.02, BOXN, BOXN + 0.006, { pz: [RW, BRASS, MM.brass], ny: [RW, BRASS, MM.brass] });
  { // 警示燈（黃色，門在動的時候閃）＋黑底座
    const u = LAMP[2], y = LAMP[1];
    wb(S, 'B', u - 0.075, u + 0.075, y - 0.06, y + 0.06, BOXN, BOXN + 0.02, { all: [RW, GUN, MM.satin], skip: 'nz' });
    L.geo(new THREE.SphereGeometry(0.045, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.8), at('B', u, y, BOXN + 0.02), RW, AMBER, MM.blink);
  }
  wb(S, 'B', DZ + 0.62, DZ + 0.78, 1.18, 1.42, 0, 0.035, { pz: [R.CTRL, W1, MM.alu], all: [RW, ALU, MM.alu], skip: 'nz' }); // 開關盒
  { // 輪胎架（黑鐵＋黃銅頂蓋，兩層、每層四顆，輪胎側面朝房間斜一點）
    const u0 = 5.05, u1 = 10.15, lv = [0.32, 1.22];
    for (const u of [u0, (u0 + u1) / 2, u1]) for (const n of [0.08, 0.52]) {
      wb(S, 'B', u - 0.022, u + 0.022, 0, 2.1, n - 0.022, n + 0.022, { all: [RW, GUN, MM.satin], skip: 'ny' });
      wb(S, 'B', u - 0.03, u + 0.03, 2.1, 2.13, n - 0.03, n + 0.03, { all: [RW, BRASS, MM.brass], skip: 'ny' });
    }
    for (const y of [...lv, 2.1]) for (const n of [0.08, 0.52]) wb(S, 'B', u0, u1, y - 0.035, y, n - 0.02, n + 0.02, { all: [RW, GUN, MM.satin] });
    colW('B', u0 - 0.03, u1 + 0.03, 0, 0.56, 2.15);
  }
  { // 模型車展示櫃（黑色、三層玻璃層板、每層一條燈；1:18 的小車）：小房子蓋在這面牆的角落，櫃子縮短（一層四台）
    const u0 = -8.15, u1 = -4.35, y0 = 0.9, y1 = 2.5;
    wb(S, 'B', u0, u1, 0.0, y0, 0, 0.42, { pz: [RW, LACQ, MM.lacq], py: ['M', W1, MM.marble, true], px: [RW, LACQ, MM.lacq], nx: [RW, LACQ, MM.lacq] });
    wb(S, 'B', u0 + 0.02, u1 - 0.02, 0, 0.08, 0.38, 0.4, { pz: [RW, BLK, MM.satin] });
    wq(S, 'B', u0, u1, y0, y1, 0.005, R.MODELS, W1, MM.gloss);
    for (const s of [u0, u1 - 0.04]) wb(S, 'B', s, s + 0.04, y0, y1 + 0.04, 0, 0.36, { all: [RW, BLK, MM.satin], skip: 'nz ny' });
    wb(S, 'B', u0, u1, y1, y1 + 0.04, 0, 0.36, { all: [RW, BLK, MM.satin], skip: 'nz' });
    const cols = [[0.9, 0.09, 0.02], [0.02, 0.1, 0.5], [0.85, 0.85, 0.86], [0.02, 0.02, 0.022], [0.9, 0.5, 0.02], [0.7, 0.55, 0.05], [0.06, 0.3, 0.12], [0.5, 0.52, 0.55]];
    for (let r = 0; r < 3; r++) {
      const y = y0 + 0.02 + r * 0.53;
      if (r) GL.box(at('B', (u0 + u1) / 2, y - 0.01, 0.19), [u1 - u0 - 0.08, 0.012, 0.34], { all: [RW, W1, MM.gloss] });
      wqDown(L, 'B', u0 + 0.05, u1 - 0.05, y + 0.5, 0.25, 0.27, RW, [2.6, 2.0, 1.4], MM.lamp);
      for (let i = 0; i < 4; i++) { // 小車：車身＋車頂＋四個輪子（很小，形狀大概就好）
        const u = u0 + 0.61 + i * 0.86, c = cols[(r * 6 + i * 5) % cols.length], m = at('B', u, y, 0.2, (rnd() - 0.5) * 0.5);
        S.box(m.clone().multiply(M4().makeTranslation(0, 0.045, 0)), [0.26, 0.05, 0.11], { all: [RW, c, MM.gloss], skip: 'ny' });
        S.box(m.clone().multiply(M4().makeTranslation(-0.015, 0.085, 0)), [0.13, 0.035, 0.095], { all: [RW, [0.02, 0.02, 0.025], MM.gloss], skip: 'ny' });
        for (const [dx, dz] of [[-0.08, -0.052], [0.08, -0.052], [-0.08, 0.052], [0.08, 0.052]]) S.box(m.clone().multiply(M4().makeTranslation(dx, 0.022, dz)), [0.045, 0.045, 0.02], { all: [RW, RUBBER, MM.rubber], skip: 'ny' });
      }
    }
    colW('B', u0, u1, 0, 0.42, y1);
  }

  // ---- 牆 C（z = ZS，車的右邊）：獎盃櫃（白色烤漆矮櫃＋黑框玻璃展示櫃，背板香檳金、藏燈）、工具牆＋工具櫃（白、金、黑）----
  const TC0 = 3.0, TC1 = 7.0, TCY = 1.3, TCY1 = 2.7, TCN = 0.46; // 獎盃櫃（u = −x）
  const TOOL0 = -2.8, TOOL1 = 2.4;
  slabs('C', -XD, TOOL0 - 0.1); slabs('C', TC1 + 0.1, -XB); slabs('C', TOOL1 + 0.1, TC0 - 0.1);
  slabs('C', TOOL0 - 0.1, TOOL1 + 0.1, [0.12, 1.05]); slabs('C', TOOL0 - 0.1, TOOL1 + 0.1, [2.75, HC]); slabs('C', TC0 - 0.1, TC1 + 0.1, [TCY1 + 0.05, HC]);
  skirt('C', -XD, TOOL0); skirt('C', TC1, -XB); skirt('C', TOOL1, TC0);
  { // 獎盃櫃
    wb(S, 'C', TC0, TC1, 0.08, TCY, 0, 0.5, { pz: [RW, LACQ, MM.lacq], px: [RW, LACQ, MM.lacq], nx: [RW, LACQ, MM.lacq], py: ['M', W1, MM.marble, true] });
    for (let i = 1; i < 4; i++) wq(S, 'C', TC0 + i * 1.0 - 0.003, TC0 + i * 1.0 + 0.003, 0.1, TCY - 0.02, 0.501, RW, [0.5, 0.5, 0.5], MM.lacq);
    for (let i = 0; i < 4; i++) wb(S, 'C', TC0 + i + 0.35, TC0 + i + 0.65, TCY - 0.14, TCY - 0.125, 0.5, 0.515, { all: [RW, BRASS, MM.brass], skip: 'nz' });
    wb(S, 'C', TC0 + 0.02, TC1 - 0.02, 0, 0.08, 0, 0.46, { pz: [RW, BLK, MM.satin] });
    wq(S, 'C', TC0 + 0.05, TC1 - 0.05, TCY, TCY1, 0.02, R.TBACK, W1, MM.satin);
    for (const u of [TC0 + 0.02, TC1 - 0.02]) wb(S, 'C', u - 0.025, u + 0.025, TCY, TCY1, 0, TCN, { all: [RW, BLK, MM.satin], skip: 'nz ny py' });
    wb(S, 'C', TC0 - 0.005, TC1 + 0.005, TCY1, TCY1 + 0.05, 0, TCN, { all: [RW, BLK, MM.satin], skip: 'nz' });
    wqDown(L, 'C', TC0 + 0.1, TC1 - 0.1, TCY1 - 0.002, 0.3, 0.33, RW, [3.6, 2.8, 1.9], MM.lamp);
    GL.quad(V(-TC0 + 0.0, TCY, ZS - TCN).clone(), V(-TC1, TCY, ZS - TCN), V(-TC1, TCY1, ZS - TCN), V(-TC0, TCY1, ZS - TCN), RW, W1, MM.gloss); // 玻璃（朝外 −z）
    colW('C', TC0, TC1, 0, 0.5, TCY1 + 0.05);
  }
  { // 工具牆（白色洞洞板＋工具）、上面黑色燈條、下面白色工具櫃（黑色不鏽鋼檯面、黃銅把手）
    wb(S, 'C', TOOL0, TOOL1, 1.12, 2.55, 0, 0.03, { pz: [R.TOOLS, W1, MM.lacq], px: [RW, LACQ, MM.lacq], nx: [RW, LACQ, MM.lacq], py: [RW, LACQ, MM.lacq], ny: [RW, LACQ, MM.lacq] });
    wb(S, 'C', TOOL0 - 0.05, TOOL1 + 0.05, 2.62, 2.7, 0, 0.2, { all: [RW, [0.02, 0.02, 0.022], MM.satin], skip: 'nz' });
    wqDown(L, 'C', TOOL0, TOOL1, 2.619, 0.12, 0.16, RW, [3.8, 3.2, 2.5], MM.lamp);
    wb(S, 'C', TOOL0 + 0.1, TOOL1 - 0.1, 0.1, 0.95, 0, 0.55, { pz: [R.CHEST, W1, MM.lacq], px: [RW, LACQ, MM.lacq], nx: [RW, LACQ, MM.lacq] });
    wb(S, 'C', TOOL0 + 0.08, TOOL1 - 0.08, 0.95, 0.99, 0, 0.57, { all: [RW, [0.1, 0.1, 0.105], MM.satin], skip: 'nz' });
    wb(S, 'C', TOOL0 + 0.15, TOOL1 - 0.15, 0, 0.1, 0, 0.5, { pz: [RW, BLK, MM.satin] });
    colW('C', TOOL0 + 0.08, TOOL1 - 0.08, 0, 0.57, 1.0);
  }

  // ---- 牆 D（z = −ZS，車的左邊）：休息區（地毯、黑皮沙發、細長的大理石茶几黃銅腳、落地燈、掛畫＋畫燈）；兩張單人椅拿掉了（讓出走道：最後一台升降機開出來、走去小房子）----
  const LX0 = -7.0, LX1 = -1.0; // 沙發那段（u = x）
  slabs('D', XB, LX0); slabs('D', LX1, XD); slabs('D', LX0, LX1, [0.12, 1.25]); slabs('D', LX0, LX1, [2.95, HC]);
  skirt('D', XB, XD);
  { // 掛畫那一段：牆面板（白大理石）＋畫＋黃銅畫框＋畫燈
    slabs('D', LX0, LX1, [1.25, 2.95], { cw: 3 });
    wb(S, 'D', -5.25, -2.75, 1.4, 2.8, 0, 0.04, { pz: [R.ART, W1, MM.satin], all: [RW, BRASS, MM.brass], skip: 'nz' });
    wb(S, 'D', -4.4, -3.6, 2.92, 2.96, 0, 0.16, { all: [RW, BRASS, MM.brass], skip: 'nz' });
    wqDown(L, 'D', -4.35, -3.65, 2.919, 0.1, 0.14, RW, [3, 2.3, 1.5], MM.lamp);
  }
  { // 地毯（地板上一片）
    const x0 = -6.3, x1 = -1.7, z0 = -12.45 - ZW, z1 = -10.8 - ZW, y = 0.008;
    S.quad(V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0), R.RUG, W1, MM.fabric);
    for (const [a, b] of [[V(x0, 0, z1), V(x1, 0, z1)], [V(x1, 0, z0), V(x0, 0, z0)]]) S.quad(a, b, b.clone().setY(y), a.clone().setY(y), RW, [0.05, 0.05, 0.055], MM.fabric);
  }
  const lf = { all: [RW, LEATHER, MM.leather], skip: 'ny' };
  { // 沙發（靠牆、面向車子）
    const x0 = -5.5, x1 = -2.5, zb = -ZS + 0.05, zf = -ZS + 0.98;
    const bx = (a, b, y0, y1, c, d, f = lf) => S.box(M4().makeTranslation((a + b) / 2, (y0 + y1) / 2, (c + d) / 2), [b - a, y1 - y0, d - c], f);
    bx(x0 + 0.2, x1 - 0.2, 0.1, 0.44, zb + 0.2, zf, lf); bx(x0, x1, 0.1, 0.82, zb, zb + 0.22, lf); bx(x0, x0 + 0.2, 0.1, 0.62, zb, zf, lf); bx(x1 - 0.2, x1, 0.1, 0.62, zb, zf, lf);
    for (const x of [x0 + 0.2 + 0.87, x0 + 0.2 + 1.73]) S.quad(V(x - 0.004, 0.441, zf), V(x + 0.004, 0.441, zf), V(x + 0.004, 0.441, zb + 0.22), V(x - 0.004, 0.441, zb + 0.22), RW, [0.005, 0.005, 0.005], MM.leather);
    bx(x0 + 0.05, x1 - 0.05, 0.0, 0.1, zb + 0.05, zf - 0.05, { all: [RW, BRASS, MM.brass], skip: 'ny' });
  }
  { // 茶几：白大理石檯面＋黃銅框（細長，靠沙發）
    const cx = -4.0, cz = -11.15 - ZW;
    S.box(M4().makeTranslation(cx, 0.4, cz), [1.2, 0.04, 0.4], { py: ['M', W1, MM.marble, true], all: [RW, [0.8, 0.8, 0.79], MM.marble], skip: 'py' });
    for (const [x, z] of [[-0.55, -0.16], [0.55, -0.16], [-0.55, 0.16], [0.55, 0.16]]) S.box(M4().makeTranslation(cx + x, 0.19, cz + z), [0.03, 0.38, 0.03], { all: [RW, BRASS, MM.brass], skip: 'ny' });
    for (const z of [-0.16, 0.16]) S.box(M4().makeTranslation(cx, 0.05, cz + z), [1.13, 0.02, 0.02], { all: [RW, BRASS, MM.brass] });
  }
  { // 落地燈：黃銅桿、白色燈罩（裡面亮）
    const x = -6.75, z = -12.15 - ZW;
    S.geo(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 24).translate(x, 0.015, z), M4(), RW, BRASS, MM.brass);
    S.geo(new THREE.CylinderGeometry(0.014, 0.014, 1.5, 8).translate(x, 0.78, z), M4(), RW, BRASS, MM.brass);
    S.geo(new THREE.CylinderGeometry(0.2, 0.26, 0.32, 24, 1, true).translate(x, 1.62, z), M4(), RW, [1.7, 1.45, 1.15], MM.fabric);
    L.geo(new THREE.CircleGeometry(0.25, 24).rotateX(Math.PI / 2).translate(x, 1.465, z), M4(), RW, [4, 3.1, 2.1], MM.lamp);
    COLS.push({ t: 'circle', x, z, r: 0.24, h: 1.8 });
  }
  { // 盆栽（黑色高盆＋一叢長葉子）
    for (const [x, z] of [[-0.55, -12.1 - ZW], [-11.9, 11.9 + ZW], [-11.9, -11.9 - ZW]]) {
      S.geo(new THREE.CylinderGeometry(0.26, 0.2, 0.62, 20).translate(x, 0.31, z), M4(), RW, [0.015, 0.015, 0.016], MM.gloss);
      for (let i = 0; i < 26; i++) {
        const a = rnd() * Math.PI * 2, tilt = 0.12 + rnd() * 0.42, len = 0.7 + rnd() * 0.75, g = new THREE.PlaneGeometry(0.075, len, 1, 3);
        const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const t = (p.getY(k) + len / 2) / len; p.setX(k, p.getX(k) * (1 - t * 0.85)); p.setZ(k, t * t * 0.18); }
        g.translate(0, len / 2, 0); g.computeVertexNormals();
        const m = M4().makeTranslation(x, 0.6, z).multiply(M4().makeRotationY(a)).multiply(M4().makeRotationX(tilt));
        const gc = 0.5 + rnd() * 0.5; S.geo(g, m, RW, [0.03 * gc, 0.1 * gc, 0.035 * gc], MM.leather);
        const g2 = g.clone(); g2.index && g2.setIndex([...g2.index.array].reverse()); // 背面也要（葉子兩面都看得到）
        const nn = g2.attributes.normal; for (let k = 0; k < nn.count; k++) nn.setXYZ(k, -nn.getX(k), -nn.getY(k), -nn.getZ(k));
        S.geo(g2, m, RW, [0.025 * gc, 0.08 * gc, 0.03 * gc], MM.leather);
      }
      COLS.push({ t: 'circle', x, z, r: 0.35, h: 1.4 });
    }
  }
  COLS.push({ t: 'box', x: -4.0, z: -11.8 - ZW, hx: 1.6, hz: 0.9, rot: 0, h: 0.9 }); // 休息區（沙發＋茶几）
  AO_BOX.push([-4.0, -12.2 - ZW, 1.55, 0.5], [-4.0, -11.15 - ZW, 0.6, 0.2]);

  // ---- 幾何小幫手：qN＝四個點（照順序繞一圈），法線朝 hint 那邊（不對就左右翻）；qX／qY／qZ＝x／y／z 定值的四邊形；qZs＝上緣順著屋頂斜的（山牆）；hbx＝盒子（兩個角）----
  const DPX = V(1, 0, 0), DNX = V(-1, 0, 0), DPY = V(0, 1, 0), DNY = V(0, -1, 0), DPZ = V(0, 0, 1), DNZ = V(0, 0, -1);
  const qN = (bt, a, b, c, d, hint, r = RW, col = W1, mat = MM.paint) => { if (b.clone().sub(a).cross(d.clone().sub(a)).dot(hint) >= 0) bt.quad(a, b, c, d, r, col, mat); else bt.quad(b, a, d, c, r, col, mat); };
  const qX = (bt, x, z0, z1, y0, y1, hint, r, col, mat) => qN(bt, V(x, y0, z0), V(x, y0, z1), V(x, y1, z1), V(x, y1, z0), hint, r, col, mat);
  const qY = (bt, y, x0, x1, z0, z1, hint, r, col, mat) => qN(bt, V(x0, y, z0), V(x1, y, z0), V(x1, y, z1), V(x0, y, z1), hint, r, col, mat);
  const qZ = (bt, z, x0, x1, y0, y1, hint, r, col, mat) => qN(bt, V(x0, y0, z), V(x1, y0, z), V(x1, y1, z), V(x0, y1, z), hint, r, col, mat);
  const qZs = (bt, z, x0, x1, y0, yf, hint, r, col, mat) => qN(bt, V(x0, y0, z), V(x1, y0, z), V(x1, yf(x1), z), V(x0, yf(x0), z), hint, r, col, mat);
  const hbx = (bt, x0, x1, y0, y1, z0, z1, f) => bt.box(M4().makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), [x1 - x0, y1 - y0, z1 - z0], f);
  const hM = (w, h) => mwin(w, h, hr() < 0.5, hr); // 大理石的一塊（用 hr）
  const oak = (w, h, R0 = R.OAKV, W = 0.6, Hh = 1.8) => { // 橡木貼圖的一塊：R0 代表 W × Hh 公尺（直紋 0.6 × 1.8、橫紋 2.9 × 0.5），超過就拉長
    const sw = Math.min(1, w / W), sh = Math.min(1, h / Hh), u0 = hr() * (1 - sw), v0 = hr() * (1 - sh), du = R0[2] - R0[0], dv = R0[3] - R0[1];
    return [R0[0] + du * u0, R0[1] + dv * v0, R0[0] + du * (u0 + sw), R0[1] + dv * (v0 + sh)];
  };
  const oakH = (w, h) => oak(w, h, R.OAKH, 2.9, 0.5);
  const softBox = (w, h, d, e = 0.25, ws = 20, hs = 10) => { // 軟軟的盒子（枕頭、被子）：球變成超橢球，法線照公式算（沒有接縫）
    const g = new THREE.SphereGeometry(1, ws, hs), p = g.attributes.position, n = g.attributes.normal;
    const f = (v) => Math.sign(v) * Math.pow(Math.abs(v), e), fn = (v) => Math.sign(v) * Math.pow(Math.abs(v), 2 - e);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = fn(x) / w, ny = fn(y) / h, nz = fn(z) / d, l = Math.hypot(nx, ny, nz) || 1;
      p.setXYZ(i, (f(x) * w) / 2, (f(y) * h) / 2, (f(z) * d) / 2); n.setXYZ(i, nx / l, ny / l, nz / l);
    }
    return g;
  };
  const leafy = (x, y, z, n, l0, l1, tint = 1) => { // 一叢長葉子（兩面）
    for (let i = 0; i < n; i++) {
      const a = hr() * Math.PI * 2, tilt = 0.12 + hr() * 0.45, len = l0 + hr() * (l1 - l0), g = new THREE.PlaneGeometry(0.07, len, 1, 3);
      const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const t = (p.getY(k) + len / 2) / len; p.setX(k, p.getX(k) * (1 - t * 0.85)); p.setZ(k, t * t * 0.16); }
      g.translate(0, len / 2, 0); g.computeVertexNormals();
      const m = M4().makeTranslation(x, y, z).multiply(M4().makeRotationY(a)).multiply(M4().makeRotationX(tilt)), gc = (0.5 + hr() * 0.5) * tint;
      const g2 = g.clone(); g2.setIndex([...g2.index.array].reverse()); const nn = g2.attributes.normal; for (let k = 0; k < nn.count; k++) nn.setXYZ(k, -nn.getX(k), -nn.getY(k), -nn.getZ(k));
      S.geo(g, m, RW, [0.03 * gc, 0.1 * gc, 0.035 * gc], MM.leather); S.geo(g2, m, RW, [0.025 * gc, 0.08 * gc, 0.03 * gc], MM.leather);
    }
  };
  const hcol = (x0, x1, z0, z1, h) => COLS.push({ t: 'box', x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, rot: 0, h });

  // ---- 小房子（Nick：「我要有在車庫裡面有一個房子小房子可以睡覺的地方」）：車庫左前角（門那面牆和 z −12.7 那面牆的角）一間小木屋臥室 ----
  //   外面：白牆＋黑牆腳、黑色腰帶，正面山牆上半橡木直條板；深灰金屬屋頂（立邊縫、屋脊蓋）、黑封簷板、橡木屋簷底；門邊壁燈、腳踏墊、山牆上黑底金字「大便龍的家」
  //   裡面：橡木地板、橡木天花板（順著斜屋頂）＋屋脊樑（兩邊藏 LED 往上打）；床頭那面橡木直條牆；雙人床（布床頭板、白亞麻被、兩個枕頭、腰枕、床尾毯、床底 LED）
  //     兩邊懸空床頭櫃＋黃銅檯燈；白色衣櫃、書桌＋電視（在玩賽車）＋椅子；小冰箱＋咖啡機；盆栽、地毯、窗簾、小掛畫
  //   門洞 1.0 公尺寬（x 0.35 … 1.35，門一直開著，往裡面開、靠西邊）；正面大窗 x 1.75 … 4.7：躺在床上往腳那邊（+z）看是主車位、鐵捲門；西牆一扇低窗台的窗：躺著轉頭（−x）看得到後牆升降機上的車
  {
    // 第 11 批：車庫變寬，小房子整間跟著 z −ZS 那面牆往外搬 ZW。這一塊照本來的座標（z −12.7 … −8.5）蓋：z 的常數在這裡蓋掉，batch 的 oz、碰撞、AO 最後一起挪
    const HZ0 = -12.7, HZ1 = -8.5, IZ0 = HZ0 + 0.03, IZ1 = HZ1 - HWT, HLAMP = [[1.28, 0.885, -12.43], [3.72, 0.885, -12.43]], SCONCE = [0.16, 1.95, HZ1 + 0.07];
    const BATS = [S, L, T, E, EL, GL], c0 = COLS.length, a0 = AO_BOX.length; for (const bt of BATS) bt.oz = -ZW;
    const HW0 = 1.75, HW1 = 4.7, HWY0 = 0.45, HWY1 = 2.5, BAND = 2.5; // 正面大窗、腰帶
    const WW0 = -11.5, WW1 = -9.3, WWY0 = 0.62, WWY1 = 2.35; // 西牆的窗（z）：窗台 0.62（床墊 0.56）：躺著看得到整台車
    const PLAS = [0.86, 0.85, 0.82], TRIM = [0.018, 0.018, 0.02], ROOF = [0.05, 0.052, 0.056], OAKC = W1, CURT = [0.8, 0.74, 0.64], SHEET = [0.95, 0.94, 0.92];
    const HMM = { oak: [0.42, 0, 0, 0.6], floor: [0.3, 0, 0, 0.6], plaster: [0.9, 0, 0, 1], lin: [0.95, 0, 0, 0.8], roof: [0.48, 0.55, 0, 0.3] }; // 橡木、地板（亮光漆）、白牆、布、屋頂金屬
    const trim = { all: [RW, TRIM, MM.satin] }, RX0 = HX0 - HOV, RZ1 = HZ1 + HOVN, eave = hIn(HX0);

    // 地板：橡木（一格 1.2 × 0.6 公尺，u 沿 z）；門口黃銅門檻
    const F = R.FLOOR;
    for (let x = IX0; x < IX1 - 1e-4; x += 0.6) for (let z = IZ0; z < IZ1 - 1e-4; z += 1.2) {
      const x1 = Math.min(x + 0.6, IX1), z1 = Math.min(z + 1.2, IZ1), fu = (z1 - z) / 1.2, fv = (x1 - x) / 0.6;
      S.quad(V(x, HFY, z), V(x, HFY, z1), V(x1, HFY, z1), V(x1, HFY, z), [F[0], F[1], F[0] + (F[2] - F[0]) * fu, F[1] + (F[3] - F[1]) * fv], OAKC, HMM.floor);
    }
    hbx(S, HD0, HD1, 0, 0.016, IZ1, HZ1, { py: [RW, BRASS, MM.brass], pz: [RW, BRASS, MM.brass] });

    // 西牆（x 0 … 0.14）：外面白牆＋黑牆腳＋腰帶，窗（z −11.5 … −9.3）；裡面白牆
    hbx(S, HX0 - 0.012, HX0, 0, 0.08, HZ0, HZ1 + 0.012, { nx: [RW, TRIM, MM.satin], py: [RW, TRIM, MM.satin], pz: [RW, TRIM, MM.satin] });
    for (const [z0, z1, y0, y1] of [[HZ0, HZ1, 0.08, WWY0], [HZ0, HZ1, WWY1, BAND], [HZ0, WW0, WWY0, WWY1], [WW1, HZ1, WWY0, WWY1]]) qX(S, HX0, z0, z1, y0, y1, DNX, RW, PLAS, HMM.plaster);
    hbx(S, HX0 - 0.015, HX0, BAND, eave, HZ0, HZ1 + 0.015, { nx: [RW, TRIM, MM.satin], ny: [RW, TRIM, MM.satin], pz: [RW, TRIM, MM.satin] });
    for (const [z0, z1, y0, y1] of [[IZ0, IZ1, 0, WWY0], [IZ0, IZ1, WWY1, hIn(IX0)], [IZ0, WW0, WWY0, WWY1], [WW1, IZ1, WWY0, WWY1]]) qX(S, IX0, z0, z1, y0, y1, DPX, RW, PLAS, HMM.plaster);
    qZ(S, WW0, HX0, IX0, WWY0, WWY1, DPZ, RW, PLAS, HMM.plaster); qZ(S, WW1, HX0, IX0, WWY0, WWY1, DNZ, RW, PLAS, HMM.plaster); qY(S, WWY1, HX0, IX0, WW0, WW1, DNY, RW, PLAS, HMM.plaster);
    hbx(S, HX0 - 0.03, IX0 + 0.05, WWY0 - 0.03, WWY0, WW0 - 0.04, WW1 + 0.04, { all: [oakH(2.3, 0.2), OAKC, HMM.oak], skip: 'ny' }); // 窗台（橡木，裡外都凸出一點）
    for (const [z0, z1, y0, y1] of [[WW0, WW1, WWY0, WWY0 + 0.05], [WW0, WW1, WWY1 - 0.05, WWY1], [WW0, WW0 + 0.05, WWY0, WWY1], [WW1 - 0.05, WW1, WWY0, WWY1], [(WW0 + WW1) / 2 - 0.02, (WW0 + WW1) / 2 + 0.02, WWY0, WWY1]]) hbx(S, 0.05, 0.09, y0, y1, z0, z1, trim);
    qX(GL, 0.07, WW0, WW1, WWY0, WWY1, DNX, RW, W1, MM.gloss);

    // 正面（z −8.5，朝車庫中間）：白牆到 2.5、黑色腰帶、上面山牆橡木直條板（深色底）；門洞、大窗（三格，黑框）
    for (const [x0, x1, y0, y1] of [[HX0, HD0, 0.08, BAND], [HD0, HD1, HDH, BAND], [HD1, HW0, 0.08, BAND], [HW0, HW1, 0.08, HWY0], [HW1, HX1, 0.08, BAND]]) qZ(S, HZ1, x0, x1, y0, y1, DPZ, RW, PLAS, HMM.plaster);
    for (const [x0, x1] of [[HX0 - 0.012, HD0 - 0.04], [HD1 + 0.04, HX1]]) hbx(S, x0, x1, 0, 0.08, HZ1, HZ1 + 0.012, { pz: [RW, TRIM, MM.satin], py: [RW, TRIM, MM.satin], px: [RW, TRIM, MM.satin], nx: [RW, TRIM, MM.satin] });
    hbx(S, HX0 - 0.015, HX1, BAND, eave, HZ1, HZ1 + 0.015, { pz: [RW, TRIM, MM.satin], py: [RW, TRIM, MM.satin], ny: [RW, TRIM, MM.satin] });
    for (const [x0, x1] of [[HX0, HRX], [HRX, HX1]]) qZs(S, HZ1, x0, x1, eave, hIn, DPZ, RW, [0.03, 0.022, 0.015], MM.satin); // 條板後面的深色底
    for (const s of [-1, 1]) for (let i = 0; ; i++) { // 橡木直條板（0.092 寬、1 公分縫；屋脊剛好是一條縫）
      const xa = HRX + s * (0.005 + i * 0.102), xb = xa + s * 0.092; if (Math.abs(xb - HRX) > HRX - HX0) break;
      qZs(S, HZ1 + 0.012, Math.min(xa, xb), Math.max(xa, xb), eave, hIn, DPZ, oak(0.092, 1.3), OAKC, HMM.oak);
    }
    const dfr = { pz: [RW, TRIM, MM.satin], px: [RW, TRIM, MM.satin], nx: [RW, TRIM, MM.satin], ny: [RW, TRIM, MM.satin], py: [RW, TRIM, MM.satin] };
    hbx(S, HD0 - 0.04, HD0, 0, HDH + 0.04, HZ1, HZ1 + 0.012, dfr); hbx(S, HD1, HD1 + 0.04, 0, HDH + 0.04, HZ1, HZ1 + 0.012, dfr); hbx(S, HD0, HD1, HDH, HDH + 0.04, HZ1, HZ1 + 0.012, dfr); // 門框
    qX(S, HD0, IZ1, HZ1, 0, HDH, DPX, oak(0.14, 2.15), OAKC, HMM.oak); qX(S, HD1, IZ1, HZ1, 0, HDH, DNX, oak(0.14, 2.15), OAKC, HMM.oak); qY(S, HDH, HD0, HD1, IZ1, HZ1, DNY, oakH(1, 0.14), OAKC, HMM.oak); // 門洞的牆厚（橡木）
    for (const [x0, x1, y0] of [[IX0, HD0, 0], [HD0, HD1, HDH], [HD1, HW0, 0], [HW0, HRX, HWY1], [HRX, HW1, HWY1], [HW1, IX1, 0]]) qZs(S, IZ1, x0, x1, y0, hIn, DNZ, RW, PLAS, HMM.plaster); // 正面裡面（山牆）
    qZ(S, IZ1, HW0, HW1, 0, HWY0, DNZ, RW, PLAS, HMM.plaster);
    qX(S, HW0, IZ1, HZ1, HWY0, HWY1, DPX, RW, PLAS, HMM.plaster); qX(S, HW1, IZ1, HZ1, HWY0, HWY1, DNX, RW, PLAS, HMM.plaster); qY(S, HWY1, HW0, HW1, IZ1, HZ1, DNY, RW, PLAS, HMM.plaster); qY(S, HWY0, HW0, HW1, IZ1, HZ1, DPY, RW, PLAS, HMM.plaster);
    { const z0 = HZ1 - 0.08, z1 = HZ1 - 0.04, m1 = HW0 + (HW1 - HW0) / 3, m2 = HW0 + (2 * (HW1 - HW0)) / 3; // 窗框、兩根直框（黑）＋玻璃
      for (const [x0, x1, y0, y1] of [[HW0, HW1, HWY0, HWY0 + 0.05], [HW0, HW1, HWY1 - 0.05, HWY1], [HW0, HW0 + 0.05, HWY0, HWY1], [HW1 - 0.05, HW1, HWY0, HWY1], [m1 - 0.02, m1 + 0.02, HWY0, HWY1], [m2 - 0.02, m2 + 0.02, HWY0, HWY1]]) hbx(S, x0, x1, y0, y1, z0, z1, trim);
      qZ(GL, (z0 + z1) / 2, HW0, HW1, HWY0, HWY1, DPZ, RW, W1, MM.gloss); }
    hbx(S, HW0 - 0.04, HW1 + 0.04, HWY0 - 0.025, HWY0, IZ1 - 0.07, IZ1, { all: [oakH(3, 0.07), OAKC, HMM.oak], skip: 'ny pz' }); // 裡面的窗台
    // 門（橡木，開著：往裡面轉 90 度靠西邊）＋黑把手
    hbx(S, HD0 + 0.005, HD0 + 0.045, HFY, HDH - 0.015, IZ1 - 0.975, IZ1 - 0.01, { all: [oak(0.96, 2.1), OAKC, HMM.oak] });
    hbx(S, HD0 + 0.045, HD0 + 0.07, 0.97, 1.01, IZ1 - 0.95, IZ1 - 0.8, trim); hbx(S, HD0 - 0.02, HD0 + 0.005, 0.97, 1.01, IZ1 - 0.95, IZ1 - 0.8, trim);
    // 門邊的壁燈（黑色小盒子、正面一條暖白燈）、腳踏墊
    hbx(S, SCONCE[0] - 0.04, SCONCE[0] + 0.04, SCONCE[1] - 0.11, SCONCE[1] + 0.11, HZ1, HZ1 + 0.06, { all: [RW, TRIM, MM.satin], skip: 'nz' });
    qZ(L, HZ1 + 0.061, SCONCE[0] - 0.022, SCONCE[0] + 0.022, SCONCE[1] - 0.09, SCONCE[1] + 0.09, DPZ, RW, [4.2, 3.1, 1.9], MM.lamp);
    qY(L, SCONCE[1] - 0.111, SCONCE[0] - 0.03, SCONCE[0] + 0.03, HZ1 + 0.01, HZ1 + 0.05, DNY, RW, [3.2, 2.4, 1.5], MM.lamp);
    qY(S, 0.006, 0.4, 1.3, HZ1 + 0.01, HZ1 + 0.56, DPY, R.MAT, W1, MM.fabric);
    // 山牆上的名牌：黑大理石底（字在招牌的網格）
    hbx(S, 1.85, 3.15, 2.9, 3.2, HZ1 + 0.012, HZ1 + 0.03, { pz: [hM(1.3, 0.3), W1, MM.nero], px: [RW, BLK, MM.gloss], nx: [RW, BLK, MM.gloss], py: [RW, BLK, MM.gloss], ny: [RW, BLK, MM.gloss] });

    // 東、南兩面內牆板（貼著車庫的牆）；南牆（床頭）一片橡木直條（深色底、條子凸出 2 公分）；白色踢腳板
    qX(S, IX1, IZ0, IZ1, 0, hIn(IX1), DNX, RW, PLAS, HMM.plaster);
    for (const [x0, x1] of [[IX0, HRX], [HRX, IX1]]) qZs(S, IZ0, x0, x1, 0, hIn, DPZ, RW, PLAS, HMM.plaster);
    qZ(S, IZ0 + 0.004, 0.95, 4.05, 0.08, 2.46, DPZ, RW, [0.035, 0.026, 0.018], MM.satin);
    for (let x = 0.965; x + 0.04 <= 4.051; x += 0.07) { const r0 = oak(0.04, 2.38); hbx(S, x, x + 0.04, 0.08, 2.46, IZ0 + 0.004, IZ0 + 0.026, { pz: [r0, OAKC, HMM.oak], px: [r0, OAKC, HMM.oak], nx: [r0, OAKC, HMM.oak], py: [r0, OAKC, HMM.oak] }); }
    const bb = { all: [RW, [0.9, 0.89, 0.87], MM.lacq], skip: 'ny' };
    hbx(S, IX0, IX0 + 0.012, HFY, 0.08, IZ0, IZ1, bb); hbx(S, IX1 - 0.012, IX1, HFY, 0.08, IZ0, IZ1, bb);
    hbx(S, IX0 + 0.012, HD0, HFY, 0.08, IZ1 - 0.012, IZ1, bb); hbx(S, HD1, IX1 - 0.012, HFY, 0.08, IZ1 - 0.012, IZ1, bb);
    hbx(S, IX0 + 0.012, 0.95, HFY, 0.08, IZ0, IZ0 + 0.012, bb); hbx(S, 4.05, IX1 - 0.012, HFY, 0.08, IZ0, IZ0 + 0.012, bb);

    // 屋頂：兩片斜的深灰金屬（立邊縫每 0.45 公尺一條）、屋脊蓋；西邊出簷 0.3、北邊（正面）出簷 0.15；黑封簷板、橡木屋簷底
    const nW = V(-HP, 1, 0).normalize(), nE = V(HP, 1, 0).normalize();
    qN(S, V(RX0, hTop(RX0), HZ0), V(RX0, hTop(RX0), RZ1), V(HRX, hTop(HRX), RZ1), V(HRX, hTop(HRX), HZ0), nW, RW, ROOF, HMM.roof);
    qN(S, V(HX1, hTop(HX1), RZ1), V(HX1, hTop(HX1), HZ0), V(HRX, hTop(HRX), HZ0), V(HRX, hTop(HRX), RZ1), nE, RW, ROOF, HMM.roof);
    const rib = (x0, x1, z, nn) => { // 一條立邊縫（兩邊＋上面）
      const o = nn.clone().multiplyScalar(0.028), a0 = V(x0, hTop(x0), z), a1 = V(x1, hTop(x1), z);
      for (const s of [-1, 1]) { const dz = V(0, 0, s * 0.01); qN(S, a0.clone().add(dz), a1.clone().add(dz), a1.clone().add(dz).add(o), a0.clone().add(dz).add(o), V(0, 0, s), RW, ROOF, HMM.roof); }
      qN(S, a0.clone().add(o).setZ(z - 0.01), a1.clone().add(o).setZ(z - 0.01), a1.clone().add(o).setZ(z + 0.01), a0.clone().add(o).setZ(z + 0.01), nn, RW, [0.07, 0.072, 0.078], HMM.roof);
    };
    for (let z = HZ0 + 0.3; z < RZ1 - 0.1; z += 0.45) { rib(RX0, HRX - 0.09, z, nW); rib(HX1, HRX + 0.09, z, nE); }
    hbx(S, HRX - 0.11, HRX + 0.11, hTop(HRX) - 0.06, hTop(HRX) + 0.04, HZ0, RZ1 + 0.02, { py: [RW, ROOF, HMM.roof], px: [RW, ROOF, HMM.roof], nx: [RW, ROOF, HMM.roof], pz: [RW, ROOF, HMM.roof] }); // 屋脊蓋
    qX(S, RX0, HZ0, RZ1, hIn(RX0) - 0.03, hTop(RX0) + 0.01, DNX, RW, TRIM, MM.satin); // 西邊封簷板
    for (const [x0, x1] of [[RX0, HRX], [HRX, HX1]]) qN(S, V(x0, hIn(x0) - 0.03, RZ1), V(x1, hIn(x1) - 0.03, RZ1), V(x1, hTop(x1) + 0.01, RZ1), V(x0, hTop(x0) + 0.01, RZ1), DPZ, RW, TRIM, MM.satin); // 正面封簷板（沿著斜線）
    qN(S, V(RX0, hIn(RX0), HZ0), V(HX0, hIn(HX0), HZ0), V(HX0, hIn(HX0), HZ1), V(RX0, hIn(RX0), HZ1), V(HP, -1, 0), oakH(4.2, 0.3), OAKC, HMM.oak); // 屋簷底（西）
    for (const [x0, x1] of [[RX0, HRX], [HRX, HX1]]) qN(S, V(x0, hIn(x0), HZ1), V(x1, hIn(x1), HZ1), V(x1, hIn(x1), RZ1), V(x0, hIn(x0), RZ1), DNY, oakH(2.8, 0.15), OAKC, HMM.oak); // 屋簷底（北）
    // 天花板（裡面）：黑底＋橡木板順著斜屋頂（0.19 寬、1 公分縫）；屋脊樑（橡木）兩邊下緣一條 LED（往上打）
    for (const [x0, nn] of [[IX0, V(HP, -1, 0)], [IX1, V(-HP, -1, 0)]]) {
      qN(S, V(x0, hIn(x0) + 0.006, IZ0), V(HRX, hIn(HRX) + 0.006, IZ0), V(HRX, hIn(HRX) + 0.006, IZ1), V(x0, hIn(x0) + 0.006, IZ1), nn, RW, [0.03, 0.022, 0.015], MM.satin);
      for (let z = IZ0; z < IZ1 - 0.02; z += 0.2) { const z1 = Math.min(z + 0.19, IZ1); qN(S, V(x0, hIn(x0), z), V(HRX, hIn(HRX), z), V(HRX, hIn(HRX), z1), V(x0, hIn(x0), z1), nn, oakH(2.6, 0.19), OAKC, HMM.oak); }
    }
    hbx(S, HRX - 0.08, HRX + 0.08, BEAMY, hIn(HRX) - 0.01, IZ0, IZ1, { ny: [oak(0.16, 4), OAKC, HMM.oak], px: [oakH(4, 0.2), OAKC, HMM.oak], nx: [oakH(4, 0.2), OAKC, HMM.oak] });
    for (const s of [-1, 1]) qX(L, HRX + s * 0.0805, IZ0 + 0.05, IZ1 - 0.05, BEAMY + 0.012, BEAMY + 0.03, s > 0 ? DPX : DNX, RW, [3.4, 2.5, 1.5], MM.lamp);

    // 床（床頭靠南牆）：黑色縮進去的底座＋床底 LED、橡木床框、床墊、被子、摺起來的被緣、兩個枕頭、腰枕、床尾毯；布的床頭板
    const B0 = 1.6, B1 = 3.4, BZ0 = -12.6, BZ1 = -10.47;
    hbx(S, B0 + 0.12, B1 - 0.12, HFY, 0.1, BZ0 + 0.1, BZ1 - 0.15, { all: [RW, [0.02, 0.02, 0.022], MM.satin], skip: 'ny py nz' });
    hbx(S, B0, B1, 0.1, 0.3, BZ0, BZ1, { px: [oakH(2.13, 0.2), OAKC, HMM.oak], nx: [oakH(2.13, 0.2), OAKC, HMM.oak], pz: [oakH(1.8, 0.2), OAKC, HMM.oak], ny: [RW, [0.1, 0.08, 0.06], HMM.oak] });
    const ug = [2.8, 1.8, 0.95]; // 床底 LED（床框下面朝下，三邊）
    qY(L, 0.099, B0 + 0.04, B1 - 0.04, BZ1 - 0.07, BZ1 - 0.04, DNY, RW, ug, MM.lamp); qY(L, 0.099, B0 + 0.04, B0 + 0.07, BZ0 + 0.1, BZ1 - 0.07, DNY, RW, ug, MM.lamp); qY(L, 0.099, B1 - 0.07, B1 - 0.04, BZ0 + 0.1, BZ1 - 0.07, DNY, RW, ug, MM.lamp);
    hbx(S, B0 + 0.04, B1 - 0.04, 0.3, 0.5, BZ0 + 0.04, BZ1 - 0.04, { all: [R.LINEN, SHEET, HMM.lin], skip: 'ny' });
    S.geo(softBox(1.84, 0.255, 1.54, 0.14, 24, 12), M4().makeTranslation(2.5, 0.4575, -11.21), R.LINEN, SHEET, HMM.lin); // 被子
    S.geo(new THREE.CylinderGeometry(0.06, 0.06, 1.86, 16).rotateZ(Math.PI / 2).translate(2.5, 0.545, -11.94), M4(), R.LINEN, SHEET, HMM.lin); // 被緣摺起來
    for (const x of [2.08, 2.92]) S.geo(softBox(0.7, 0.17, 0.42, 0.34), M4().makeTranslation(x, 0.6, -12.3).multiply(M4().makeRotationX(-0.32)), R.LINEN, [0.97, 0.96, 0.94], HMM.lin); // 枕頭
    S.geo(softBox(0.86, 0.26, 0.13, 0.3), M4().makeTranslation(2.5, 0.66, -12.05).multiply(M4().makeRotationX(-0.22)), R.LINEN, [0.58, 0.23, 0.1], HMM.lin); // 腰枕（陶土色）
    S.geo(softBox(1.9, 0.24, 0.42, 0.14, 24, 8), M4().makeTranslation(2.5, 0.487, -10.83), R.LINEN, [0.1, 0.1, 0.11], HMM.lin); // 床尾毯（炭灰）
    hbx(S, 1.52, 3.48, 0.3, 1.15, IZ0 + 0.026, IZ0 + 0.11, { pz: [R.HEADB, W1, HMM.lin], px: [RW, [0.4, 0.36, 0.31], HMM.lin], nx: [RW, [0.4, 0.36, 0.31], HMM.lin], py: [RW, [0.45, 0.4, 0.35], HMM.lin] });
    // 床頭櫃（懸空、橡木、一條抽屜縫）＋黃銅檯燈（燈罩是亮的布，下面、上面開口亮）
    for (const [x0, x1] of [[1.07, 1.49], [3.51, 3.93]]) {
      hbx(S, x0, x1, 0.36, 0.54, IZ0 + 0.026, -12.22, { all: [oakH(0.42, 0.18), OAKC, HMM.oak], skip: 'nz' });
      qZ(S, -12.219, x0 + 0.02, x1 - 0.02, 0.447, 0.452, DPZ, RW, [0.03, 0.02, 0.012], HMM.oak);
    }
    for (const [x, y, z] of HLAMP) {
      S.geo(new THREE.CylinderGeometry(0.055, 0.065, 0.02, 20).translate(x, 0.55, z), M4(), RW, BRASS, MM.brass);
      S.geo(new THREE.CylinderGeometry(0.007, 0.007, 0.24, 8).translate(x, 0.68, z), M4(), RW, BRASS, MM.brass);
      S.geo(new THREE.CylinderGeometry(0.1, 0.125, 0.19, 24, 1, true).translate(x, y, z), M4(), R.LINEN, [1.9, 1.55, 1.12], HMM.lin);
      L.geo(new THREE.CircleGeometry(0.122, 24).rotateX(Math.PI / 2).translate(x, y - 0.094, z), M4(), RW, [4.4, 3.3, 2.1], MM.lamp);
      L.geo(new THREE.CircleGeometry(0.098, 24).rotateX(-Math.PI / 2).translate(x, y + 0.094, z), M4(), RW, [2.2, 1.7, 1.1], MM.lamp);
    }
    // 衣櫃（東牆、白烤漆兩扇門、黃銅把手、黑色踢腳縮進去）
    const WX0 = 4.37, WZ0 = -12.62, WZ1 = -11.12, WH = 2.3, wm = (WZ0 + WZ1) / 2;
    hbx(S, WX0, IX1, 0.08, WH, WZ0, WZ1, { nx: [RW, LACQ, MM.lacq], pz: [RW, LACQ, MM.lacq], py: [RW, LACQ, MM.lacq] });
    hbx(S, WX0 + 0.05, IX1, HFY, 0.08, WZ0 + 0.02, WZ1 - 0.03, { nx: [RW, TRIM, MM.satin], pz: [RW, TRIM, MM.satin] });
    qX(S, WX0 - 0.001, wm - 0.002, wm + 0.002, 0.09, WH - 0.01, DNX, RW, [0.2, 0.2, 0.2], MM.lacq);
    for (const s of [-1, 1]) hbx(S, WX0 - 0.03, WX0 - 0.012, 0.95, 1.45, wm + s * 0.05 - 0.008, wm + s * 0.05 + 0.008, { all: [RW, BRASS, MM.brass], skip: 'px' });
    // 書桌（橡木桌面、黑色細腳，靠牆）＋筆電、杯子；牆上電視（在玩賽車）；椅子
    const DZ0 = -10.9, DZ1 = -9.6;
    hbx(S, 4.42, IX1, 0.72, 0.76, DZ0, DZ1, { py: [oak(0.55, 1.3), OAKC, HMM.oak], nx: [oakH(1.3, 0.04), OAKC, HMM.oak], pz: [RW, [0.5, 0.36, 0.22], HMM.oak], nz: [RW, [0.5, 0.36, 0.22], HMM.oak], ny: [RW, [0.3, 0.22, 0.14], HMM.oak] });
    for (const z of [DZ0 + 0.03, DZ1 - 0.03]) hbx(S, 4.45, 4.475, HFY, 0.72, z - 0.0125, z + 0.0125, trim);
    hbx(S, 4.52, 4.84, 0.76, 0.775, -10.62, -10.2, { all: [RW, [0.55, 0.56, 0.58], MM.alu], skip: 'ny' });
    S.geo(new THREE.CylinderGeometry(0.04, 0.036, 0.095, 14).translate(4.66, 0.808, -9.86), M4(), RW, [0.92, 0.91, 0.89], MM.lacq);
    hbx(S, IX1 - 0.035, IX1, 1.12, 1.795, -10.85, -9.65, { nx: [RW, [0.01, 0.01, 0.011], MM.gloss], pz: [RW, TRIM, MM.satin], nz: [RW, TRIM, MM.satin], py: [RW, TRIM, MM.satin], ny: [RW, TRIM, MM.satin] });
    qX(S, IX1 - 0.036, -10.83, -9.67, 1.14, 1.775, DNX, R.TV, W1, MM.gloss);
    { const cx = 3.95, cz = -10.25; // 椅子（面向書桌 +x）：灰色布座墊、橡木椅背、黑腳
      hbx(S, cx - 0.22, cx + 0.22, 0.42, 0.47, cz - 0.22, cz + 0.22, { all: [R.LINEN, [0.36, 0.34, 0.31], HMM.lin] });
      hbx(S, cx - 0.25, cx - 0.21, 0.47, 0.88, cz - 0.21, cz + 0.21, { all: [oak(0.42, 0.41), OAKC, HMM.oak] });
      for (const [dx, dz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) hbx(S, cx + dx - 0.012, cx + dx + 0.012, HFY, 0.42, cz + dz - 0.012, cz + dz + 0.012, trim);
      COLS.push({ t: 'circle', x: cx, z: cz, r: 0.3, h: 0.9 }); }
    // 小冰箱（白、門朝 +x、不鏽鋼把手）＋咖啡機（黑）＋杯子
    hbx(S, 0.16, 0.66, HFY, 0.86, -12.64, -12.12, { px: [RW, [0.9, 0.9, 0.89], MM.lacq], pz: [RW, [0.86, 0.86, 0.85], MM.lacq], py: [RW, [0.86, 0.86, 0.85], MM.lacq] });
    qX(S, 0.661, -12.64, -12.12, 0.83, 0.834, DPX, RW, [0.3, 0.3, 0.3], MM.lacq);
    hbx(S, 0.665, 0.685, 0.45, 0.78, -12.19, -12.17, { all: [RW, STEEL, MM.alu], skip: 'nx' });
    hbx(S, 0.22, 0.46, 0.86, 1.16, -12.55, -12.25, { all: [RW, [0.02, 0.02, 0.022], MM.gloss], skip: 'ny' });
    hbx(S, 0.46, 0.5, 0.97, 1.0, -12.42, -12.38, { all: [RW, STEEL, MM.chrome], skip: 'nx' });
    S.geo(new THREE.CylinderGeometry(0.034, 0.03, 0.07, 12).translate(0.49, 0.895, -12.4), M4(), RW, [0.92, 0.91, 0.89], MM.lacq);
    // 盆栽（白陶盆、東北角）、地毯、小掛畫（西牆、冰箱上面）
    S.geo(new THREE.CylinderGeometry(0.16, 0.13, 0.34, 20).translate(4.62, HFY + 0.17, -9.2), M4(), RW, [0.88, 0.87, 0.85], MM.lacq);
    leafy(4.62, 0.33, -9.2, 20, 0.35, 0.7);
    qY(S, 0.02, 0.95, 4.05, -11.95, -9.5, DPY, R.HRUG, W1, MM.fabric);
    hbx(S, IX0, IX0 + 0.025, 1.25, 1.9, -12.42, -11.77, { px: [RW, TRIM, MM.satin], pz: [RW, TRIM, MM.satin], nz: [RW, TRIM, MM.satin], py: [RW, TRIM, MM.satin], ny: [RW, TRIM, MM.satin] });
    qX(S, IX0 + 0.026, -12.39, -11.8, 1.28, 1.87, DPX, R.BART, W1, MM.satin);
    // 窗簾（大窗兩邊收起來，兩面都畫）＋黑色窗簾桿
    const curtain = (x0, x1) => {
      const n = 12, zc = IZ1 - 0.1;
      for (let k = 0; k < n; k++) {
        const xa = x0 + ((x1 - x0) * k) / n, xb = x0 + ((x1 - x0) * (k + 1)) / n, za = zc + (k % 2 ? 0.035 : -0.035), zb = zc + (k % 2 ? -0.035 : 0.035);
        const a = V(xa, 0.06, za), b = V(xb, 0.06, zb), c = V(xb, 2.46, zb), d = V(xa, 2.46, za);
        S.quad(a, b, c, d, R.LINEN, CURT, HMM.lin); S.quad(b, a, d, c, R.LINEN, CURT, HMM.lin);
      }
    };
    curtain(1.6, 1.98); curtain(4.47, 4.85);
    S.geo(new THREE.CylinderGeometry(0.012, 0.012, 3.35, 8).rotateZ(Math.PI / 2).translate(3.225, 2.52, IZ1 - 0.1), M4(), RW, TRIM, MM.satin);

    // 碰撞：牆（門洞留著）、開著的門、家具（東、南兩面靠車庫的牆）
    hcol(HX0, IX0, HZ0, HZ1, HE); hcol(HX0, HD0, IZ1, HZ1, HE); hcol(HD1, HX1, IZ1, HZ1, HE); // 牆高到屋簷（山牆上面那塊三角形、屋頂：cameraColliders 的屋頂盒子）
    hcol(HD0, HD0 + 0.05, IZ1 - 0.975, IZ1, HDH);
    hcol(B0, B1, HZ0, BZ1, 0.6); hcol(1.07, 1.49, HZ0, -12.22, 0.54); hcol(3.51, 3.93, HZ0, -12.22, 0.54);
    hcol(WX0, HX1, HZ0, WZ1, WH); hcol(4.42, HX1, DZ0, DZ1, 0.76); hcol(0.16, 0.69, HZ0, -12.12, 1.16);
    COLS.push({ t: 'circle', x: 4.62, z: -9.2, r: 0.24, h: 1.1 });
    hcol(1.6, 1.98, IZ1 - 0.16, IZ1, 2.46); hcol(4.47, 4.85, IZ1 - 0.16, IZ1, 2.46);
    AO_BOX.push([(HX0 + HX1) / 2, (HZ0 + HZ1) / 2, (HX1 - HX0) / 2, (HZ1 - HZ0) / 2]); // 車庫地板：小房子牆腳暗一點
    for (const bt of BATS) bt.oz = 0;
    for (let i = c0; i < COLS.length; i++) COLS[i].z -= ZW;
    for (let i = a0; i < AO_BOX.length; i++) AO_BOX[i][1] -= ZW;
  }

  // ---- 升降停車格（Nick：「車庫是有升降停車格」）：後牆六個車位都是地坑式兩層升降機（上下兩層各停一台 → 12 台＋主車位）----
  //   一台＝一個框（兩層平台、四根柱子一起動）；level 0＝框升起來（下層平台跟地板平、上層在 2.1 公尺）、level 1＝框降下去（上層跟地板平、下層連車在坑裡）
  //   坑（地板在 shader 裡挖掉）：白牆（越深越暗）、上緣黃黑斜紋、地上一圈不鏽鋼收邊、兩長邊一條 LED、柱子後面深色導軌、深灰坑底
  //   平台：黑大理石面＋不鏽鋼邊、正面黃黑斜紋、底下深灰；柱子白烤漆＋黃銅蓋；前面兩根柱子琥珀色警示燈（動的時候閃）；上層前緣底下一條暖白燈
  //   操作柱（每台一根，車位外側的分隔線上）：白柱＋黃銅環、斜面操作盒（上／下鍵、鑰匙、急停）、綠燈（一直亮）＋琥珀燈（動的時候閃）
  const haz = (bt, p0, p1, y0, y1, hint) => { // 黃黑斜紋一條（p0 → p1 的水平線，y0 … y1），每 ~0.8 公尺一段（貼圖不要拉太長）
    const n = Math.max(1, Math.round(p0.distanceTo(p1) / 0.8));
    for (let k = 0; k < n; k++) { const a = p0.clone().lerp(p1, k / n), b = p0.clone().lerp(p1, (k + 1) / n); qN(bt, V(a.x, y0, a.z), V(b.x, y0, b.z), V(b.x, y1, b.z), V(a.x, y1, a.z), hint, R.HAZ, W1, MM.paint); }
  };
  BAYZ.forEach((c, i) => {
    const x0 = BX - PXH, x1 = BX + PXH, z0 = c - PZH, z1 = c + PZH, deep = [0.26, 0.26, 0.27], top = [0.84, 0.84, 0.83], pw = [deep, deep, top, top], PM = [0.7, 0, 0, 1];
    qX(S, x0, z0, z1, -PIT, -0.12, DPX, RW, pw, PM); qX(S, x1, z0, z1, -PIT, -0.12, DNX, RW, pw, PM); qZ(S, z0, x0, x1, -PIT, -0.12, DPZ, RW, pw, PM); qZ(S, z1, x0, x1, -PIT, -0.12, DNZ, RW, pw, PM);
    haz(S, V(x0, 0, z0), V(x0, 0, z1), -0.12, 0, DPX); haz(S, V(x1, 0, z0), V(x1, 0, z1), -0.12, 0, DNX); haz(S, V(x0, 0, z0), V(x1, 0, z0), -0.12, 0, DPZ); haz(S, V(x0, 0, z1), V(x1, 0, z1), -0.12, 0, DNZ);
    qY(S, -PIT, x0, x1, z0, z1, DPY, RW, [0.1, 0.1, 0.105], MM.satin);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) qZ(S, c + sz * (PZH - 0.002), BX + sx * POSTX - 0.1, BX + sx * POSTX + 0.1, -PIT, -0.12, sz > 0 ? DNZ : DPZ, RW, GUN, MM.satin); // 導軌
    const e = 0.04, ye = 0.003; // 坑口不鏽鋼收邊
    qY(S, ye, x0 - e, x1 + e, z0 - e, z0, DPY, RW, STEEL, MM.alu); qY(S, ye, x0 - e, x1 + e, z1, z1 + e, DPY, RW, STEEL, MM.alu);
    qY(S, ye, x0 - e, x0, z0, z1, DPY, RW, STEEL, MM.alu); qY(S, ye, x1, x1 + e, z0, z1, DPY, RW, STEEL, MM.alu);
    qZ(L, z0 + 0.003, x0 + 0.1, x1 - 0.1, -0.26, -0.235, DPZ, RW, [2.4, 1.9, 1.3], MM.lamp); qZ(L, z1 - 0.003, x0 + 0.1, x1 - 0.1, -0.26, -0.235, DNZ, RW, [2.4, 1.9, 1.3], MM.lamp);
    // 操作柱
    const px = PANX, pz = PANZ[i], m = M4().makeTranslation(px + 0.015, 1.05, pz).multiply(M4().makeRotationZ(0.6));
    hbx(S, px - 0.09, px + 0.09, 0, 0.03, pz - 0.08, pz + 0.08, { all: [RW, BLK, MM.gloss], skip: 'ny' });
    hbx(S, px - 0.06, px + 0.06, 0.03, 1.0, pz - 0.05, pz + 0.05, { all: [RW, LACQ, MM.lacq], skip: 'ny py' });
    hbx(S, px - 0.066, px + 0.066, 0.93, 0.945, pz - 0.056, pz + 0.056, { all: [RW, BRASS, MM.brass] });
    S.box(m, [0.13, 0.2, 0.15], { px: [R.LCTRL, W1, MM.alu], nx: [RW, LACQ, MM.lacq], py: [RW, LACQ, MM.lacq], ny: [RW, LACQ, MM.lacq], pz: [RW, LACQ, MM.lacq], nz: [RW, LACQ, MM.lacq] });
    const top1 = V(-0.02, 0.1, 0).applyMatrix4(m); // 盒子上緣：綠燈、琥珀燈
    L.geo(new THREE.SphereGeometry(0.016, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(top1.x, top1.y, pz - 0.035), M4(), RW, [0.25, 2.6, 0.9], MM.lamp);
    L.geo(new THREE.SphereGeometry(0.016, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(top1.x, top1.y, pz + 0.035), M4(), RW, AMBER, [0, i + 1, 0, 0]);
    COLS.push({ t: 'box', x: px, z: pz, hx: 0.1, hz: 0.09, rot: 0, h: 1.15 }); AO_BOX.push([px, pz, 0.09, 0.08]);
  });
  // 動的那一框（兩層平台＋四根柱子）：本地座標原點＝平台中心、下層平台上緣；六台用同一個 InstancedMesh（一個 draw call）；燈的頂點 aMat.z = 3（y＝1 一直亮、0 動的時候閃）
  const K = batch();
  for (const y of [0, PD]) {
    K.box(M4().makeTranslation(0, y - DKT / 2, 0), [2 * DKX, DKT, 2 * DKZ], { py: [hM(2 * DKX, 2 * DKZ), W1, MM.nero], pz: [RW, LACQ, MM.lacq], nz: [RW, LACQ, MM.lacq], nx: [RW, LACQ, MM.lacq], ny: [RW, GUN, MM.satin] });
    haz(K, V(DKX, 0, DKZ), V(DKX, 0, -DKZ), y - DKT, y, DPX);
    const e = 0.035, ye = y + 0.0015; // 上面一圈不鏽鋼邊
    qY(K, ye, -DKX, DKX, -DKZ, -DKZ + e, DPY, RW, STEEL, MM.alu); qY(K, ye, -DKX, DKX, DKZ - e, DKZ, DPY, RW, STEEL, MM.alu);
    qY(K, ye, -DKX, -DKX + e, -DKZ + e, DKZ - e, DPY, RW, STEEL, MM.alu); qY(K, ye, DKX - e, DKX, -DKZ + e, DKZ - e, DPY, RW, STEEL, MM.alu);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    K.box(M4().makeTranslation(sx * POSTX, (PD - DKT + 0.004) / 2, sz * POSTZ), [2 * POSTW, PD + DKT + 0.004, 2 * POSTW], { all: [RW, LACQ, MM.lacq], skip: 'ny py' });
    K.box(M4().makeTranslation(sx * POSTX, PD + 0.007, sz * POSTZ), [2 * POSTW + 0.01, 0.006, 2 * POSTW + 0.01], { all: [RW, BRASS, MM.brass], skip: 'ny' });
    K.box(M4().makeTranslation(sx * POSTX, PD - 0.62, sz * POSTZ), [2 * POSTW + 0.008, 0.02, 2 * POSTW + 0.008], { all: [RW, BRASS, MM.brass] });
  }
  for (const sz of [-1, 1]) qX(K, POSTX + POSTW + 0.001, sz * POSTZ - 0.03, sz * POSTZ + 0.03, PD - 0.42, PD - 0.3, DPX, RW, AMBER, [0, 0, 3, 0]);
  qY(K, PD - DKT - 0.001, DKX - 0.07, DKX - 0.04, -DKZ + 0.2, DKZ - 0.2, DNY, RW, [2.6, 2.1, 1.4], [0, 1, 3, 0]);

  // ---- 獎盃（九個，越後面越大越華麗；按順序合進一個網格，setTrophies 用 drawRange 只畫前 n 個；第一個在最看得到的那頭）----
  const BRONZE = [0.78, 0.44, 0.2], SILVER = [0.9, 0.91, 0.93], GOLD = [1.0, 0.72, 0.26], BASE = [0.02, 0.02, 0.022];
  const TROPHY_U = Array.from({ length: 9 }, (_, k) => TC1 - 0.38 - k * 0.405);
  const ends = [0];
  const star = (r0, r1, dd) => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i & 1 ? r1 : r0, t = Math.PI / 2 + (i * Math.PI) / 5; s[i ? 'lineTo' : 'moveTo'](Math.cos(t) * r, Math.sin(t) * r); } return new THREE.ExtrudeGeometry(s, { depth: dd, bevelEnabled: false }).translate(0, 0, -dd / 2); };
  TROPHY_U.forEach((u, k) => {
    const s = [0.96, 1.03, 1.1, 1.2, 1.27, 1.34, 1.44, 1.56, 1.8][k], mc = k < 3 ? BRONZE : k < 6 ? SILVER : GOLD, big = k === 8;
    const m0 = at('C', u, TCY, 0.25), P = (x, y, z, rz = 0) => m0.clone().multiply(M4().makeRotationZ(rz).setPosition(x, y, z));
    let y = 0;
    const bw = 0.11 * s, bh = 0.045 * s;
    T.box(P(0, bh / 2, 0), [bw, bh, bw], { all: [RW, BASE], skip: 'ny' }); y = bh;
    if (k >= 4) { T.box(P(0, y + 0.018 * s, 0), [bw * 0.72, 0.036 * s, bw * 0.72], { all: [RW, BASE], skip: 'ny' }); y += 0.036 * s; }
    if (k >= 6) T.box(P(0, bh * 0.55, 0), [bw + 0.006, 0.012 * s, bw + 0.006], { all: [RW, mc], skip: 'ny py' }); // 金色腰帶
    const hs = (k === 2 || k === 5 ? 0.1 : 0.055) * s;
    T.geo(new THREE.CylinderGeometry(0.009 * s, 0.017 * s, hs, 10), P(0, y + hs / 2, 0), RW, mc); y += hs;
    if (k === 2 || k === 5) { T.geo(star(0.075 * s, 0.032 * s, 0.018 * s), P(0, y + 0.07 * s, 0), RW, mc); ends.push(T.count); return; } // 星星獎盃
    const cup = [[0.012, 0], [0.024, 0.006], [0.036, 0.022], [0.05, 0.055], [0.06, 0.095], [0.066, 0.135], [0.07, 0.165], [0.074, 0.172], [0.066, 0.172], [0.058, 0.14]].map(([r, h]) => new THREE.Vector2(r * s, h * s));
    T.geo(new THREE.LatheGeometry(cup, 20), P(0, y, 0), RW, mc);
    if (k === 1 || k >= 4) for (const sd of [-1, 1]) T.geo(new THREE.TorusGeometry((big ? 0.045 : 0.034) * s, 0.0065 * s, 6, 14, Math.PI), P(sd * 0.066 * s, y + 0.105 * s, 0, -sd * Math.PI / 2), RW, mc);
    if (big) { // 第 9 個：蓋子＋星星
      T.geo(new THREE.CylinderGeometry(0.02 * s, 0.07 * s, 0.03 * s, 20), P(0, y + 0.187 * s, 0), RW, mc);
      T.geo(new THREE.SphereGeometry(0.014 * s, 10, 8), P(0, y + 0.21 * s, 0), RW, mc);
      T.geo(star(0.045 * s, 0.02 * s, 0.012 * s), P(0, y + 0.255 * s, 0), RW, mc);
    }
    ends.push(T.count);
  });

  // ---- 輪胎＋輪框（八組，輪胎架上）：不會動，直接合進房子的網格（省兩個 draw call）；斜著擺（看得到胎面才像輪胎）、胎壁一圈細金字條；五輻輪框、每組顏色不一樣 ----
  {
    const pr = [[0.236, -0.1], [0.236, -0.112], [0.26, -0.121], [0.3, -0.121], [0.32, -0.11], [0.33, -0.085], [0.333, -0.04], [0.333, 0.04], [0.33, 0.085], [0.32, 0.11], [0.3, 0.121],
      [0.2945, 0.1212], [0.294, 0.1212], [0.285, 0.1213], [0.2845, 0.1212], [0.26, 0.121], [0.236, 0.112], [0.236, 0.1]].map(([r, y]) => new THREE.Vector2(r, y));
    const lip = [[0.237, 0.098], [0.229, 0.104], [0.214, 0.1], [0.21, 0.09]].map(([r, y]) => new THREE.Vector2(r, y));
    const tyreG = () => { // 輪胎：黑橡膠，外側胎壁一圈金色細字條（頂點色）
      const g = new THREE.LatheGeometry(pr, 40), c = [], p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getZ(i)), y = p.getY(i); c.push(...(y > 0.119 && r > 0.2843 && r < 0.2947 ? [0.75, 0.55, 0.12] : [0.026, 0.026, 0.028])); }
      g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g;
    };
    const TYRE = [0.78, 0, 0, 0.2], RIM = [0.2, 1, 0, 0.3];
    const RIMC = [[0.92, 0.92, 0.94], [0.08, 0.08, 0.09], [0.9, 0.64, 0.26], [0.42, 0.43, 0.46], [0.92, 0.92, 0.94], [0.62, 0.36, 0.18], [0.08, 0.08, 0.09], [0.9, 0.64, 0.26]];
    RIMC.forEach((rc, i) => {
      const lv = [0.32, 1.22][Math.floor(i / 4)], u = 5.7 + (i % 4) * 1.25;
      const m = at('B', u, lv + 0.335, 0.3).multiply(M4().makeRotationY(-0.45)).multiply(M4().makeRotationX(Math.PI / 2)), mm = (t) => m.clone().multiply(t);
      S.geo(tyreG(), m, RW, null, TYRE);
      S.geo(new THREE.LatheGeometry(lip, 40), m, RW, rc, RIM); // 輪框外緣
      S.geo(new THREE.CircleGeometry(0.215, 32).rotateX(-Math.PI / 2).translate(0, 0.03, 0), m, RW, rc.map((v) => v * 0.08), RIM); // 輪框裡面（暗）
      for (let k = 0; k < 5; k++) S.box(mm(M4().makeRotationY((k * 2 * Math.PI) / 5).multiply(M4().makeTranslation(0.135, 0.075, 0))), [0.17, 0.03, 0.062], { all: [RW, rc, RIM], skip: 'ny' }); // 五根輻條
      S.geo(new THREE.CylinderGeometry(0.058, 0.062, 0.03, 20), mm(M4().makeTranslation(0, 0.08, 0)), RW, rc, RIM); // 中心蓋
    });
  }

  // ---- 鐵捲門：41 片鋁門片（最下面那片是底條），InstancedMesh；裡面那面拉絲鋁、外面那面白色烤漆 ----
  const SLAT = 0.1, YT = DH + 0.32, NS = Math.round(YT / SLAT), XC = XD - 0.07, R0 = 0.14; // 片高、片數、門片平面、捲筒切點高、捲筒外半徑
  const slatGeo = (side) => { // 本地：x＝往外（門外）、y＝沿著門往上、z＝沿著門片；side −1＝裡面那面、+1＝外面那面
    const b = batch(), prof = [[0.004, -0.05, 0.3], [0.004, -0.044, 0.3], [0.008, -0.042, 0.8], [0.011, -0.02, 1], [0.012, 0, 1], [0.011, 0.024, 1], [0.008, 0.043, 0.85], [0.004, 0.045, 0.35], [0.004, 0.05, 0.35]];
    const z0 = -DZ - 0.06, z1 = DZ + 0.06;
    for (let i = 0; i < prof.length - 1; i++) {
      const [x0, y0, c0] = prof[i], [x1, y1, c1] = prof[i + 1], a = V(side * x0, y0, z0), bb = V(side * x0, y0, z1), c = V(side * x1, y1, z1), d = V(side * x1, y1, z0);
      const r = [R.BRUSH[0], R.BRUSH[1] + (R.BRUSH[3] - R.BRUSH[1]) * (i / prof.length), R.BRUSH[2], R.BRUSH[1] + (R.BRUSH[3] - R.BRUSH[1]) * ((i + 1) / prof.length)];
      const k = (c0 + c1) / 2, cc = [k, k, k]; // 每一條一個顏色（很細的面顏色有漸層的話，MSAA 在三角形外面取樣會外插出負的顏色 → 反射裡一顆一顆的亮點）
      const mt = [k, 0, 0, 0]; // 裡面那面的材質用 aMat.x 當溝的深淺（反射的時候換成平均值）；外面那面用頂點色
      if (side > 0) b.quad(bb, a, d, c, [r[2], r[1], r[0], r[3]], cc, mt); else b.quad(a, bb, c, d, r, cc, mt); // 裡面那面朝 −x、外面那面朝 +x
    }
    return b.build();
  };
  // 裡面那面：鏡面地板的反射那一次（鏡頭在地板下面）門片畫成平的（溝用平均的亮度、法線朝房間）：半解析度的反射畫一條一條的溝會變成摩爾紋
  const doorInMat = patch(new THREE.MeshStandardMaterial({ map: atlasTex, color: new THREE.Color(...ALU), metalness: 0.85, roughness: 0.34 }), 'doorIn', { wash: true, more: (sh) => {
    sh.vertexShader = 'attribute vec4 aMat; varying float vGroove; varying vec3 vFlatN;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vGroove = aMat.x; vFlatN = (viewMatrix * modelMatrix * vec4(-1.0, 0.0, 0.0, 0.0)).xyz;');
    sh.fragmentShader = 'varying float vGroove; varying vec3 vFlatN;\n' + sh.fragmentShader
      .replace('void main() {', 'void main() {\n  vec3 dN = vCam.y < 0.0 ? vec3(-1.0, 0.0, 0.0) : normalize(vLocN);')
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= vCam.y < 0.0 ? 0.7 : vGroove;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  if (vCam.y < 0.0) normal = normalize(vFlatN);')
      .replaceAll('roomAmb(vLocN, vLoc)', 'roomAmb(dN, vLoc)').replaceAll('roomWash(vLocN, vLoc,', 'roomWash(dN, vLoc,');
  } });
  const doorOutMat = keep(new THREE.MeshStandardMaterial({ map: atlasTex, vertexColors: true, color: 0xf1f1ee, metalness: 0.15, roughness: 0.42 }));
  const slatsIn = keep(new THREE.InstancedMesh(slatGeo(-1), doorInMat, NS)), slatsOut = keep(new THREE.InstancedMesh(slatGeo(1), doorOutMat, NS));
  slatsIn.frustumCulled = slatsOut.frustumCulled = false;
  slatsIn.name = 'roomDoor'; slatsOut.name = 'roomDoorOut';
  { const c = new THREE.Color(0.55, 0.56, 0.58); slatsIn.setColorAt(0, c); slatsOut.setColorAt(0, c); for (let i = 1; i < NS; i++) { slatsIn.setColorAt(i, new THREE.Color(1, 1, 1)); slatsOut.setColorAt(i, new THREE.Color(1, 1, 1)); } }
  const DS = { t: 0, target: 0, speed: 1, clock: 0 };
  const _m = M4(), _q = new THREE.Quaternion(), _p = V(0, 0, 0), _s = V(1, 1, 1), ZAX = V(0, 0, 1);
  function layoutDoor() { // 最下面那片的底在 t × 門高；掛著的直直沿導軌，超過切點的捲在捲筒上（往裡面一圈比一圈小）
    const yb = DS.t * DH, Lh = YT - yb;
    for (let i = 0; i < NS; i++) {
      const u = (i + 0.5) * SLAT;
      if (u <= Lh) { _p.set(XC, yb + u, 0); _q.identity(); }
      else { const w = u - Lh, r = Math.max(0.07, R0 - (0.016 * w) / (2 * Math.PI * R0)), ph = w / r; _p.set(XC - R0 + r * Math.cos(ph), YT + r * Math.sin(ph), 0); _q.setFromAxisAngle(ZAX, ph); }
      _m.compose(_p, _q, i === 0 ? _s.set(1.25, 1, 1) : _s.set(1, 1, 1));
      slatsIn.setMatrixAt(i, _m); slatsOut.setMatrixAt(i, _m);
    }
    slatsIn.instanceMatrix.needsUpdate = slatsOut.instanceMatrix.needsUpdate = true;
  }
  layoutDoor();

  // ---- 外殼（村子才有）：外牆白大理石板＋黑大理石牆腳、女兒牆、屋頂；門面：黑色門框、招牌、兩邊直的壁燈、牆腳的車道燈、警示燈、密碼盤 ----
  const PAR = TOP - 0.45, EROWS = [0.4, 2.0, 3.6, 5.2, PAR]; // 第 10 批：車庫變高，多一排 // 外牆石板的排（牆腳黑的到 0.4）
  const EFY0 = DH + 0.5, EFY1 = PAR - 0.1, EFU = DZ + 1.45; // 門上面的黑大理石橫帶（招牌）
  const eslabs = (w, u0, u1, rows = EROWS) => slabs(w, u0, u1, rows, { cw: 1.5, mat: MM.honed, bt: E });
  const eplinth = (w, u0, u1) => { wq(E, w, u0, u1, 0, EROWS[0], 0.02, 'M', W1, MM.nero, true); wqUp(E, w, u0, u1, EROWS[0], 0, 0.02, RW, BLK, MM.gloss); };
  const ecap = (w, u0, u1) => { // 女兒牆頂：白石＋一條古銅線＋金屬蓋
    slabs(w, u0, u1, [PAR, TOP - 0.06], { cw: 1.5, n: 0.03, mat: MM.honed, bt: E });
    wqDown(E, w, u0, u1, PAR, 0, 0.03, RW, [0.3, 0.29, 0.28], MM.satin);
    wb(E, w, u0, u1, PAR + 0.03, PAR + 0.05, 0.03, 0.036, { pz: [RW, [0.45, 0.33, 0.18], MM.brass] });
    wb(E, w, u0 - 0.04, u1 + 0.04, TOP - 0.06, TOP, -WT - 0.02, 0.06, { py: [RW, [0.62, 0.62, 0.6], MM.alu], pz: [RW, [0.62, 0.62, 0.6], MM.alu], ny: [RW, [0.3, 0.3, 0.3], MM.alu] });
  };
  for (const [w, u0, u1] of [['EA', -ZO, ZO], ['EC', XBO, XO], ['ED', -XO, -XBO]]) { eslabs(w, u0, u1); eplinth(w, u0, u1); ecap(w, u0, u1); }
  { // 門面（EB：u = −z）：門洞四周一圈黑色門框（凸出 6 公分）；上面一條黑大理石橫帶（上下黃銅線）放金色招牌；兩邊直條壁燈、牆腳車道燈、警示燈、密碼盤
    const P0 = DZ + 0.34, PY = DH + 0.34;
    eslabs('EB', -ZO, -P0); eslabs('EB', P0, ZO); eplinth('EB', -ZO, -P0); eplinth('EB', P0, ZO); ecap('EB', -ZO, ZO);
    eslabs('EB', -P0, P0, [PY, PAR]);
    const pf = { pz: [RW, [0.012, 0.012, 0.013], MM.satin], px: [RW, BLK, MM.satin], nx: [RW, BLK, MM.satin], py: [RW, BLK, MM.satin], ny: [RW, BLK, MM.satin] };
    wb(E, 'EB', -P0, -DZ, 0, PY, 0, 0.06, pf); wb(E, 'EB', DZ, P0, 0, PY, 0, 0.06, pf); wb(E, 'EB', -DZ, DZ, DH, PY, 0, 0.06, pf);
    wb(E, 'EB', -EFU, EFU, EFY0, EFY1, 0, 0.05, { px: [RW, BLK, MM.gloss], nx: [RW, BLK, MM.gloss], py: [RW, BLK, MM.gloss], ny: [RW, BLK, MM.gloss] });
    slabs('EB', -EFU, EFU, [EFY0, EFY1], { cw: 2.2, n: 0.05, mat: MM.nero, bt: E });
    for (const y of [EFY0 + 0.035, EFY1 - 0.035]) wb(E, 'EB', -EFU + 0.06, EFU - 0.06, y - 0.008, y + 0.008, 0.05, 0.055, { pz: [RW, BRASS, MM.brass], py: [RW, BRASS, MM.brass], ny: [RW, BRASS, MM.brass] });
    for (const s of [-1, 1]) { // 壁燈：黑色直條、中間一條暖白燈
      const u = s * (P0 + 0.45);
      wb(E, 'EB', u - 0.06, u + 0.06, 0.9, 3.4, 0, 0.05, { all: [RW, [0.015, 0.015, 0.016], MM.satin], skip: 'nz' });
      wq(EL, 'EB', u - 0.02, u + 0.02, 0.95, 3.35, 0.052, RW, [4.2, 3.2, 2.1], MM.lamp);
    }
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const u = s * (P0 + 1.2 + k * 2.3); wq(EL, 'EB', u - 0.14, u + 0.14, 0.14, 0.2, 0.021, RW, [3.6, 2.7, 1.8], MM.lamp); } // 牆腳的車道燈
    wb(E, 'EB', P0 + 0.1, P0 + 0.26, 1.15, 1.4, 0, 0.02, { pz: [R.KEYP, W1, MM.gloss], all: [RW, BLK, MM.satin], skip: 'nz' }); // 密碼盤（從外面看門的右邊）
    { const u = P0 - 0.17, y = DH + 0.17; wb(E, 'EB', u - 0.07, u + 0.07, y - 0.06, y + 0.06, 0.06, 0.08, { all: [RW, GUN, MM.satin], skip: 'nz' }); // 警示燈（門框右上角）
      EL.geo(new THREE.SphereGeometry(0.042, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.8), at('EB', u, y, 0.08), RW, AMBER, MM.blink); }
  }
  { // 屋頂＋女兒牆內側
    const y = 5.1;
    E.quad(V(XBO + WT, y, ZO - WT), V(XO - WT, y, ZO - WT), V(XO - WT, y, -ZO + WT), V(XBO + WT, y, -ZO + WT), RW, [0.42, 0.42, 0.41], MM.paint);
    const pin = (a, b) => E.quad(a, b, b.clone().setY(TOP - 0.06), a.clone().setY(TOP - 0.06), RW, [0.5, 0.5, 0.49], MM.paint);
    const x0 = XBO + WT, x1 = XO - WT, z0 = -ZO + WT, z1 = ZO - WT;
    pin(V(x0, y, z0), V(x1, y, z0)); pin(V(x1, y, z0), V(x1, y, z1)); pin(V(x1, y, z1), V(x0, y, z1)); pin(V(x0, y, z1), V(x0, y, z0));
    for (const z of [-8.9, -7.3]) { // 冷氣室外機（淺灰、上面黑色風扇），最高 5.9（整棟不超過 6 公尺）
      E.box(M4().makeTranslation(-10.2, y + 0.4, z), [1.2, 0.8, 1.0], { all: [RW, [0.62, 0.63, 0.64], MM.satin], skip: 'ny' });
      E.geo(new THREE.CircleGeometry(0.34, 20).rotateX(-Math.PI / 2).translate(-10.2, y + 0.803, z), M4(), RW, [0.03, 0.03, 0.035], MM.satin);
    }
    E.box(M4().makeTranslation(-3.5, y + 0.3, 9.6), [1.1, 0.6, 1.1], { all: [RW, [0.55, 0.55, 0.56], MM.satin], skip: 'ny' }); // 屋頂出入口
  }

  // ---- 地板：Reflector（高畫質）或亮面（低畫質），大理石、轉盤、車位、門檻全部在 shader 裡算 ----
  const G_AOF = AO_BOX.map(([x, z, hx, hz]) => `  ao *= 1.0 - 0.42 * exp(-max(sdb(q, vec2(${f3(x)}, ${f3(z)}), vec2(${f3(hx)}, ${f3(hz)})), 0.0) / 0.13);`).join('\n');
  const FLOOR_GLSL = G_FLOOR.replace('__AO__', G_AOF);
  const FLOOR_REF = 1.7, FLOOR_DIF = 0.86; // 地板：反射加強（拋光石材比 F0 0.04 亮）、漫射暗一點（看得到車的倒影）
  const FW = 14 - XB, FD = 2 * ZS; // 車庫頁：地板鋪到門外 x = 14（鏡頭會繞到門外）；村子：牆外面就收起來（uApron）
  const floorGeo = keep(new THREE.PlaneGeometry(FW, FD).translate((14 + XB) / 2, 0, 0));
  let floor, refl = null;
  const floorMat = keep(new THREE.MeshStandardMaterial({ roughness: 0.08, metalness: 0 }));
  if (hi) {
    const rs = renderer.getDrawingBufferSize(new THREE.Vector2());
    refl = new Reflector(floorGeo, { textureWidth: Math.max(2, Math.round(rs.x / 2)), textureHeight: Math.max(2, Math.round(rs.y / 2)), clipBias: 0.002, multisample: 0,
      shader: { name: 'RoomFloorStub', uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } }, vertexShader: 'void main() { gl_Position = vec4(0.0); }', fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }' } });
    const stub = refl.material;
    floorMat.userData.refl = { tRefl: { value: refl.getRenderTarget().texture }, uReflM: { value: stub.uniforms.textureMatrix.value }, uTexel: { value: new THREE.Vector2(2 / rs.x, 2 / rs.y) } };
    stub.dispose(); refl.material = floorMat;
    const ob = refl.onBeforeRender; // 反射只畫 layer 0：頁面想省的東西（例如車內）放到別的 layer 就不會被反射
    refl.onBeforeRender = function (r, s, cam) { refl.getReflectionCamera(cam).layers.set(0); ob.call(this, r, s, cam); };
    floor = refl;
  } else floor = new THREE.Mesh(floorGeo, floorMat);
  floorMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, floorMat.userData.refl || {});
    sh.vertexShader = VH + 'uniform float uApron;\n' + (hi ? 'uniform mat4 uReflM; varying vec4 vReflUv;\n' : '') + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed.x = min(transformed.x, uApron);')
      .replace('#include <project_vertex>', `#include <project_vertex>\n  vLoc = vec3(transformed.x, 0.0, -transformed.y); vLocN = vec3(0.0, 1.0, 0.0); vCam = (uW2L * vec4(cameraPosition, 1.0)).xyz;${hi ? '\n  vReflUv = uReflM * vec4(transformed, 1.0);' : ''}`);
    sh.fragmentShader = G_DEF + FH + G_AMB + FLOOR_GLSL + (hi ? 'uniform sampler2D tRefl; uniform vec2 uTexel; varying vec4 vReflUv;\nvec3 rTap(vec2 uv) { return clamp(texture2D(tRefl, uv).rgb, 0.0, 40.0); }\n' : '') + sh.fragmentShader
      .replace('void main() {', 'void main() {\n  if (roomPitXZ(vLoc.xz)) discard; // 升降機的坑口（平台自己畫）\n  vec3 fAlb, fEmit; float fRough, fMetal, fAo;\n  roomFloor(vLoc.xz, fAlb, fRough, fMetal, fEmit, fAo);')
      .replace('#include <map_fragment>', '  diffuseColor.rgb = fAlb;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = fRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = fMetal;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += fEmit;')
      .replace('#include <lights_fragment_begin>', '#undef RE_Direct\n#undef RE_Direct_RectArea\n#include <lights_fragment_begin>\n  irradiance = vec3(0.0);')
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
  iblIrradiance = PI * roomAmb(vec3(0.0, 1.0, 0.0), vLoc) * fAo * ${f3(FLOOR_DIF)};${hi ? `
  { // 反射（半解析度）：模糊一點（九點），每塊磚歪一點點（真的石頭地板不會完全平）
    vec2 tI = floor(vLoc.xz / 1.2), uv = vReflUv.xy / vReflUv.w + (vec2(rHash(tI + 3.1), rHash(tI + 5.3)) - 0.5) * 0.0012 * gTile;
    vec2 o = uTexel * 0.9, e = uTexel * 1.8;
    vec3 rc = rTap(uv) * 0.2 + (rTap(uv + o) + rTap(uv - o) + rTap(uv + vec2(o.x, -o.y)) + rTap(uv + vec2(-o.x, o.y))) * 0.12
      + (rTap(uv + vec2(e.x, 0.0)) + rTap(uv - vec2(e.x, 0.0)) + rTap(uv + vec2(0.0, e.y)) + rTap(uv - vec2(0.0, e.y))) * 0.08;
    radiance = rc / (1.0 + 0.1 * max(rc.r, max(rc.g, rc.b))) * mix(0.55, 1.0, fAo) * ${f3(FLOOR_REF)};
  }` : `\n  radiance *= mix(0.55, 1.0, fAo) * (gTile > 0.5 ? ${f3(FLOOR_REF)} : 0.75); // 沒有即時反射：轉盤（黑）反射環境少一點，才不會整片灰白`}`);
  };
  floorMat.customProgramCacheKey = () => `room3-floor-${hi ? 'hi' : 'lo'}`;
  floor.rotation.x = -Math.PI / 2; floor.name = 'roomFloor';

  // ---- 組起來 ----
  const shellMat = patch(new THREE.MeshStandardMaterial({ map: atlasTex, emissiveMap: glowTex, emissive: 0xffffff, vertexColors: true, roughness: 0.5, metalness: 0 }), 'shell', { amat: true });
  const lightMat = patch(new THREE.MeshBasicMaterial({ vertexColors: true }), 'light', { lit: 'none', amat: true });
  const trophyMat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 1 }), 'trophy', { more: (sh) => { // 金屬獎盃多一點假的頂燈反光（櫃子上面的燈）
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  { vec3 vW = normalize(vCam - vLoc), rW = reflect(-vW, normalize(vLocN));
    totalEmissiveRadiance += diffuseColor.rgb * (0.08 + 0.2 * max(vLocN.y, 0.0) + 1.3 * pow(max(dot(rW, vec3(0.0, 0.95, -0.3)), 0.0), 12.0)); }`);
  } });
  const glassMat = patch(new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.04, metalness: 0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true }), 'glass', { wash: false }); // 加色混合跟順序無關：雙面一次畫完
  const signMat = patch(new THREE.MeshBasicMaterial({ map: signTex, color: new THREE.Color(1.45, 1.45, 1.45), transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }), 'sign', { lit: 'none' });
  const extMat = patch(new THREE.MeshStandardMaterial({ map: atlasTex, vertexColors: true, roughness: 0.5, metalness: 0 }), 'ext', { lit: 'world', amat: true, cut: false });
  // 升降機的框（InstancedMesh，一台一個）：平台上有車就暗（車底的影子，每一層各自）；燈的頂點（aMat.z = 3）自己發光，警示燈照那一台閃
  const liftMat = patch(new THREE.MeshStandardMaterial({ map: atlasTex, emissiveMap: glowTex, emissive: 0xffffff, vertexColors: true, roughness: 0.5, metalness: 0 }), 'lift', { amat: true, more: (sh) => {
    sh.vertexShader = 'varying vec3 vCarr; varying float vLiftI;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vCarr = transformed; vLiftI = float(gl_InstanceID);');
    sh.fragmentShader = 'varying vec3 vCarr; varying float vLiftI;\n' + sh.fragmentShader.replace('#include <lights_physical_fragment>', `float liftSh = 0.0;
  { int li = int(vLiftI + 0.5);
    if (vMat.z > 2.5) { totalEmissiveRadiance = vColor.rgb * (vMat.y > 0.5 ? 1.0 : 0.03 + 0.97 * liftBlink(li)); diffuseColor.rgb = vec3(0.0); metalnessFactor = 0.0; roughnessFactor = 1.0; }
    else if (vLocN.y > 0.9) {
      float d = abs(vCarr.y) < 0.02 ? 0.0 : abs(vCarr.y - ${f3(PD)}) < 0.02 ? 1.0 : -1.0;
      if (d > -0.5) { liftSh = deckOcc(li * 2 + int(d)) * (1.0 - smoothstep(-0.35, 0.3, sdb(vCarr.xz, vec2(0.0), vec2(2.05, 0.78)))); diffuseColor.rgb *= 1.0 - 0.6 * liftSh; }
    }
  }
#include <lights_physical_fragment>`).replace('#include <lights_fragment_end>', '  radiance *= 1.0 - 0.85 * liftSh;\n#include <lights_fragment_end>');
  } });
  const signGeo = (() => { // 裡面：後牆橫帶上的招牌＋徽章、六塊名牌的字
    const b = batch(), [, , w, h] = SR.TEXT, sh = (FB1 - FB0) * 0.86, sw = (sh * w) / h, zc = 5.55, er = (FB1 - FB0) * 0.44;
    wq(b, 'A', -zc - sw / 2, -zc + sw / 2, FB0 + (FB1 - FB0 - sh) / 2, FB0 + (FB1 - FB0 + sh) / 2, 0.206, sreg(SR.TEXT));
    wq(b, 'A', zc - er, zc + er, (FB0 + FB1) / 2 - er, (FB0 + FB1) / 2 + er, 0.206, sreg(SR.EMB));
    BAYZ.forEach((z, i) => { const [, , pw, ph] = SR.PLQ(i), H2 = 0.26, W2 = (H2 * pw) / ph; wq(b, 'A', -z - W2 / 2, -z + W2 / 2, 1.71 - H2 / 2, 1.71 + H2 / 2, 0.027, sreg(SR.PLQ(i))); });
    { const [, , hw, hh] = SR.HOUSE, H2 = 0.26, W2 = (H2 * hw) / hh; qZ(b, HZ1 + 0.031, HRX - W2 / 2, HRX + W2 / 2, 3.05 - H2 / 2, 3.05 + H2 / 2, DPZ, sreg(SR.HOUSE)); } // 小房子山牆上的「大便龍的家」
    return b.build();
  })();
  const extSignGeo = (() => { const b = batch(), [, , w, h] = SR.TEXT, sh = 0.74, sw = (sh * w) / h, yc = (EFY0 + EFY1) / 2; wq(b, 'EB', -sw / 2, sw / 2, yc - sh / 2, yc + sh / 2, 0.056, sreg(SR.TEXT)); return b.build(); })();
  const shellGeo = S.build(), lightGeo = L.build();
  const liftCarriage = keep(new THREE.InstancedMesh(K.build(), liftMat, BAYZ.length)); liftCarriage.name = 'roomLifts'; liftCarriage.frustumCulled = false;
  const shell = new THREE.Mesh(shellGeo, shellMat), lights = new THREE.Mesh(lightGeo, lightMat), tro = new THREE.Mesh(T.build(), trophyMat), glass = new THREE.Mesh(GL.build(), glassMat);
  const sign = new THREE.Mesh(signGeo, signMat), extShell = new THREE.Mesh(E.build(), extMat), extLights = new THREE.Mesh(EL.build(), lightMat), extSign = new THREE.Mesh(extSignGeo, signMat);
  shell.name = 'roomShell'; lights.name = 'roomLights'; tro.name = 'roomTrophies'; glass.name = 'roomGlass'; sign.name = 'roomSign'; extShell.name = 'roomExtShell'; extLights.name = 'roomExtLights'; extSign.name = 'roomExtSign';
  sign.renderOrder = 2; extSign.renderOrder = 2; glass.renderOrder = 3;
  inner.add(floor, shell, lights, tro, glass, sign, slatsIn, liftCarriage);
  outer.add(extShell, extLights, extSign, slatsOut);
  outer.visible = !!exterior;
  const setTrophies = (n) => { n = Math.max(0, Math.min(9, Math.floor(+n || 0))); tro.geometry.setDrawRange(0, ends[n]); tro.visible = n > 0; };
  setTrophies(0);
  // 每一格：世界 → 本地（切牆用）、環境貼圖跟著整棟轉（村子裡轉了角度，反射的方向要轉回房間的座標）
  const envRotation = new THREE.Euler();
  const ROOM_MATS = [shellMat, trophyMat, glassMat, doorInMat, floorMat, liftMat];
  const syncRY = () => { const e = group.matrixWorld.elements, ry = Math.atan2(e[8], e[10]); if (ry !== envRotation.y) { envRotation.y = ry; for (const m of ROOM_MATS) m.envMapRotation.y = ry; } };
  shell.onBeforeRender = liftCarriage.onBeforeRender = () => { U.uW2L.value.copy(group.matrixWorld).invert(); syncRY(); };
  floor.onBeforeRender = ((ob) => function (r, s, cam, ...rest) { U.uW2L.value.copy(group.matrixWorld).invert(); if (ob) ob.call(this, r, s, cam, ...rest); })(floor.onBeforeRender);

  // ---- 環境貼圖：同一個房間用不打光的材質畫（顏色＝底色 ×（環境光＋洗牆）＋發光），從主車位中間拍一個 PMREM ----
  const envScene = new THREE.Scene(); envScene.background = new THREE.Color(0.3, 0.29, 0.28);
  const envShellMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: atlasTex }, glow: { value: glowTex }, uMarble: { value: marbleTex }, uBlink: { value: 0 } }, vertexColors: true,
    vertexShader: 'attribute vec4 aMat; varying vec4 vMat; varying vec3 vLoc; varying vec3 vLocN; varying vec2 vUv2; varying vec3 vC;\nvoid main() { vUv2 = uv; vC = color; vMat = aMat; vLoc = position; vLocN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `${G_DEF}${G_AMB}uniform sampler2D map, glow, uMarble; varying vec4 vMat; varying vec3 vLoc; varying vec3 vLocN; varying vec2 vUv2; varying vec3 vC;
void main() {
  vec3 mb = texture2D(uMarble, vUv2).rgb, alb = (vMat.z < 0.5 ? texture2D(map, vUv2).rgb : vMat.z < 1.5 ? mb : (vec3(1.0) - mb) * 0.12 + 0.008) * vC;
  vec3 c = alb * (roomAmb(vLocN, vLoc) * (1.0 - 0.55 * vMat.y) + roomWash(vLocN, vLoc, vMat.w)) + texture2D(glow, vUv2).rgb * step(vMat.z, 0.5);
  gl_FragColor = vec4(c, 1.0);
}`,
  });
  const envFloorMat = new THREE.ShaderMaterial({
    uniforms: { uMarble: { value: marbleTex }, uBlink: { value: 0 } },
    vertexShader: 'varying vec3 vLoc;\nvoid main() { vLoc = vec3(position.x, 0.0, -position.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `${G_DEF}${G_AMB}${FLOOR_GLSL}varying vec3 vLoc;
void main() { if (roomPitXZ(vLoc.xz)) discard; vec3 a, e; float r, m, ao; roomFloor(vLoc.xz, a, r, m, e, ao); gl_FragColor = vec4(a * roomAmb(vec3(0.0, 1.0, 0.0), vLoc) * ao * (1.0 - 0.6 * m) + e, 1.0); }`,
  });
  const envLightMat = new THREE.ShaderMaterial({ vertexColors: true, // 燈：頂點色；會閃的（警示燈）在環境貼圖裡是關的
    vertexShader: 'attribute vec4 aMat; varying vec3 vC;\nvoid main() { vC = color * (1.0 - 0.97 * max(aMat.x, step(0.5, aMat.y))); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vC;\nvoid main() { gl_FragColor = vec4(vC, 1.0); }' });
  const envFloor = new THREE.Mesh(new THREE.PlaneGeometry(XD - XB, 2 * ZS).translate((XD + XB) / 2, 0, 0), envFloorMat); envFloor.rotation.x = -Math.PI / 2;
  const envDoorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.51, 0.52), vertexColors: true });
  const envDoor = new THREE.InstancedMesh(slatsIn.geometry, envDoorMat, NS); envDoor.instanceMatrix.copy(slatsIn.instanceMatrix); envDoor.frustumCulled = false;
  const envDecks = (() => { const b = batch(); for (const c of BAYZ) qY(b, 0.0005, BX - DKX, BX + DKX, c - DKZ, c + DKZ, DPY, hM(2 * DKX, 2 * DKZ), W1, MM.nero); return b.build(); })(); // 升降機的上層平台（平常跟地板平）
  envScene.add(new THREE.Mesh(shellGeo, envShellMat), new THREE.Mesh(lightGeo, envLightMat), new THREE.Mesh(signGeo, signMat), envFloor, envDoor, new THREE.Mesh(envDecks, envShellMat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(envScene, 0.01, 0.05, 50, { size: 256, position: V(0, 1.0, 0) });
  for (const m of ROOM_MATS) if (m !== floorMat || !hi) { m.envMap = envRT.texture; m.envMapIntensity = 1; }
  pmrem.dispose(); envShellMat.dispose(); envFloorMat.dispose(); envLightMat.dispose(); envDoorMat.dispose(); envFloor.geometry.dispose(); envDoor.dispose(); envDecks.dispose();

  // ---- 鐵捲門 ----
  const door = {
    get t() { return DS.t; }, set t(v) { DS.t = DS.target = Math.max(0, Math.min(1, +v || 0)); U.uBlink.value = 0; layoutDoor(); },
    get moving() { return DS.t !== DS.target; },
    open(sec = 2.2) { DS.target = 1; DS.speed = 1 / Math.max(0.05, sec); },
    close(sec = 1.8) { DS.target = 0; DS.speed = 1 / Math.max(0.05, sec); },
    update(dt) {
      if (DS.t === DS.target) { if (U.uBlink.value) U.uBlink.value = 0; return false; }
      dt = Math.max(0, Math.min(0.1, +dt || 0)); DS.clock += dt;
      const st = DS.speed * dt;
      DS.t = DS.t < DS.target ? Math.min(DS.target, DS.t + st) : Math.max(DS.target, DS.t - st);
      const moving = DS.t !== DS.target;
      U.uBlink.value = moving && (DS.clock * 1.7) % 1 < 0.55 ? 1 : 0;
      layoutDoor();
      return moving;
    },
  };

  // ---- 升降機：狀態、動畫、放車 ----
  //   pos：框的位置 0（升起來）… 1（降下去），動的時候照時間走（擺的時候 smoothstep）；level＝要去的（或已經在的）那一層
  const LT = { latch: 0.6, travel: 6.0, settle: 0.4 }; // 開鎖、走、落鎖：一趟 7 秒
  const ease = (t) => t * t * (3 - 2 * t);
  let decksDirty = false;
  const markDecks = () => { for (let k = 0; k < 12; k++) U.uDeckOcc.value[k] = deckNames[k] == null ? 0 : 1; decksDirty = true; };
  const flushDecks = () => { markDecks(); drawSign('plaques'); signTex.needsUpdate = true; decksDirty = false; };
  sign.onBeforeRender = () => { if (decksDirty) flushDecks(); }; // put／take 一次很多台：畫之前才重畫一次名牌
  const _lm = M4();
  const placeLift = (lf) => {
    const y = -PD * ease(lf.pos); _lm.makeTranslation(BX, y, lf.z); liftCarriage.setMatrixAt(lf.id, _lm); liftCarriage.instanceMatrix.needsUpdate = true;
    lf.platforms[0].position.set(BX, y, lf.z); lf.platforms[1].position.set(BX, y + PD, lf.z);
    lf.platforms[0].visible = lf.busy || lf.pos < 0.999; // 下層關在坑裡（上層平台蓋住）就不畫（停在上面的車也不畫：省 draw call）
  };
  const liftCols = (lf) => {
    if (lf.busy) return [{ t: 'box', x: BX, z: lf.z, hx: PXH + 0.05, hz: PZH + 0.05, rot: 0, h: 2.6 }]; // 在動：整個坑擋起來（人、車都不能進去）
    if (lf.level === 0) return [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ t: 'box', x: BX + sx * POSTX, z: lf.z + sz * POSTZ, hx: POSTW, hz: POSTW, rot: 0, h: PD }))); // 升起來：只有四根柱子（上層在頭上）
    return []; // 降下去：跟地板平
  };
  const lifts = BAYZ.map((c, i) => {
    const pl = [0, 1].map((d) => { const g = new THREE.Group(); g.name = `roomLift${i + 1}${d ? 'Upper' : 'Lower'}`; inner.add(g); return g; });
    const ls = { phase: '', clock: 0, blink: 0, from: 1, onDone: null };
    const lf = {
      id: i, x: BX, z: c, heading: 0, level: 1, pos: 1, busy: false, platforms: pl, cars: [null, null],
      panel: { x: PANX, z: PANZ[i] }, stand: { x: PANX + 0.55, z: PANZ[i], heading: Math.PI },
      zone: { x: PANX + 0.55, z: PANZ[i], hx: 0.45, hz: 0.45 }, pit: { x: BX, z: c, hx: PXH, hz: PZH }, deck: { x: BX, z: c, hx: DKX, hz: DKZ },
      get floorDeck() { return lf.busy ? -1 : lf.level; }, // 現在跟地板平的那層（0 下、1 上；在動 −1）：level 0 → 下層、1 → 上層
      get slots() { const y = -PD * ease(lf.pos); return [{ x: BX, y, z: c, heading: 0 }, { x: BX, y: y + PD, z: c, heading: 0 }]; }, // 下層、上層現在的車位（本地）
      setLevel(level, onDone) { // 0＝升起來、1＝降下去；在動就不理（回 false）；已經在那層：馬上叫 onDone
        level = level ? 1 : 0;
        if (lf.busy) return false;
        if (level === lf.level) { onDone?.(lf); return true; }
        lf.level = level; lf.busy = true; Object.assign(ls, { phase: 'latch', clock: 0, blink: 0, from: lf.pos, onDone: onDone || null });
        placeLift(lf); api.onLift?.(lf, 'start'); return true;
      },
      toggle(onDone) { return lf.setLevel(lf.level ? 0 : 1, onDone); },
      update(dt) { // 在動就 true
        if (!lf.busy) return false;
        dt = Math.max(0, Math.min(0.1, +dt || 0)); ls.clock += dt; ls.blink += dt;
        if (ls.phase === 'latch' && ls.clock >= LT.latch) { ls.phase = 'travel'; ls.clock -= LT.latch; }
        if (ls.phase === 'travel') { const k = Math.min(1, ls.clock / LT.travel); lf.pos = ls.from + (lf.level - ls.from) * k; if (k >= 1) { ls.phase = 'settle'; ls.clock -= LT.travel; } }
        if (ls.phase === 'settle' && ls.clock >= LT.settle) { lf.busy = false; ls.phase = ''; lf.pos = lf.level; }
        U.uLiftBlink.value[i] = lf.busy && (ls.blink * 1.7) % 1 < 0.55 ? 1 : 0;
        placeLift(lf);
        if (!lf.busy) { const f = ls.onDone; ls.onDone = null; api.onLift?.(lf, 'stop'); f?.(lf); }
        return lf.busy;
      },
      put(deck, obj, name) { // 停一台到這層：obj（Object3D）掛到 platforms[deck] 的原點、車頭朝 +x；name＝名牌上的字（不給用 obj.name）；也可以只給名字：put(1, 'SUPRA')（已經有車：只改名字）
        deck = deck ? 1 : 0;
        if (typeof obj === 'string') { name = obj; obj = null; }
        const old = lf.cars[deck];
        if (obj?.isObject3D) { if (old?.isObject3D && old !== obj && old.parent === pl[deck]) old.removeFromParent(); pl[deck].add(obj); obj.position.set(0, 0, 0); obj.rotation.set(0, 0, 0); } // 換一台：原本那台拿下來
        lf.cars[deck] = obj || old || true; deckNames[i * 2 + deck] = name != null ? String(name) : obj ? obj.name || '' : old?.isObject3D ? old.name || '' : ''; markDecks(); return lf;
      },
      take(deck) { // 開走／拿下來：回傳原本掛上去的 Object3D（沒有就 null）
        deck = deck ? 1 : 0; const o = lf.cars[deck];
        if (o?.isObject3D && o.parent === pl[deck]) o.removeFromParent();
        lf.cars[deck] = null; deckNames[i * 2 + deck] = null; markDecks(); return o?.isObject3D ? o : null;
      },
      colliders(world = false) { const out = liftCols(lf); return world ? toWorldCols(out) : out; },
    };
    placeLift(lf);
    return lf;
  });
  // 12 個停車格（建議的停車順序）：0–5＝六台的上層（平常跟地板平，直接開上去）、6–11＝六台的下層（要先把框升起來）
  const parkSlots = [...BAYZ.map((_, i) => ({ id: i, lift: i, deck: 1 })), ...BAYZ.map((_, i) => ({ id: 6 + i, lift: i, deck: 0 }))];
  const freeSlot = () => { // 新買的車停哪裡：先找現在就跟地板平的空平台（不用動升降機），再找要動的（level＝要先 setLevel 到哪層）；12 格全滿回 null
    const free = parkSlots.filter((s) => deckNames[s.lift * 2 + s.deck] == null);
    const now = free.find((s) => lifts[s.lift].floorDeck === s.deck);
    const s = now || free.find((q) => !lifts[q.lift].busy) || free[0];
    return s ? { ...s, level: s.deck, move: !now } : null;
  };

  // ---- 停車位、碰撞、區域 ----
  const spots = {
    main: { x: 0, z: 0, heading: 0 }, bays: BAYZ.map((z) => ({ x: BX, z, heading: 0 })), outside: { x: XO + 4.2, z: 0, heading: 0 },
    bed: { x: 2.08, y: 0.56, z: -11.41 - ZW, heading: -Math.PI / 2, head: { x: 2.08, z: -12.27 - ZW }, feet: { x: 2.08, z: -10.55 - ZW } }, // 躺在床上（左半邊）：角色的 group 放 feet（高 y）、rotation.y＝heading、state 'fall' → 頭朝 head
    wake: { x: 0.93, z: -11.0 - ZW, heading: -Math.PI / 2 }, // 起床：站在床邊、面向門（+z）
    houseIn: { x: HD0 / 2 + HD1 / 2, z: -9.35 - ZW, heading: Math.PI / 2 }, houseOut: { x: HD0 / 2 + HD1 / 2, z: -7.75 - ZW, heading: -Math.PI / 2 }, // 進門（面向房間裡 −z）、出門（面向車庫 +z）
  };
  const WALLS = [
    { t: 'box', x: XD + WT / 2, z: -(ZO + DZ) / 2, hx: WT / 2, hz: (ZO - DZ) / 2, rot: 0, h: TOP },
    { t: 'box', x: XD + WT / 2, z: (ZO + DZ) / 2, hx: WT / 2, hz: (ZO - DZ) / 2, rot: 0, h: TOP },
    { t: 'box', x: XB - WT / 2, z: 0, hx: WT / 2, hz: ZO, rot: 0, h: TOP },
    { t: 'box', x: (XBO + XO) / 2, z: ZS + WT / 2, hx: (XO - XBO) / 2, hz: WT / 2, rot: 0, h: TOP },
    { t: 'box', x: (XBO + XO) / 2, z: -ZS - WT / 2, hx: (XO - XBO) / 2, hz: WT / 2, rot: 0, h: TOP },
  ];
  const DOOR_COL = { t: 'box', x: (XC - 0.08 + XO) / 2, z: 0, hx: (XO - XC + 0.08) / 2, hz: DZ, rot: 0, h: DH };
  // 本地 ↔ 世界（照 group 現在的位置、rotation.y）：toWorld({ x, z, heading }) → { x, z, heading }；toLocal(x, z) → { x, z }（判斷在不在 zones 裡用）
  const _w = V(0, 0, 0);
  const groupRY = () => { group.updateMatrixWorld(); const e = group.matrixWorld.elements; return Math.atan2(e[8], e[10]); };
  const toWorld = (p) => { const ry = groupRY(); _w.set(p.x, 0, p.z).applyMatrix4(group.matrixWorld); return { x: _w.x, z: _w.z, heading: (p.heading || 0) + ry }; };
  const toLocal = (x, z) => { group.updateMatrixWorld(); _w.set(x, group.matrixWorld.elements[13], z); group.worldToLocal(_w); return { x: _w.x, z: _w.z }; };
  // colliders(doorOpen, world)：world＝true 直接給世界座標（盒子的 rot 加上整棟轉的角度；跟 drive.js 一樣 rot＝rotation.y 的方向）；升降機的照它現在的狀態（liftColliders 只給升降機的）
  function toWorldCols(out) { const ry = groupRY(); for (const c of out) { _w.set(c.x, 0, c.z).applyMatrix4(group.matrixWorld); c.x = _w.x; c.z = _w.z; if (c.t === 'box') c.rot = (c.rot || 0) + ry; } return out; }
  const liftColliders = (world = false) => { const out = lifts.flatMap(liftCols); return world ? toWorldCols(out) : out; };
  // cameraColliders(world)：只擋鏡頭的盒子（y0＝盒子的底；給 walk.js 的 addColliders，不要給 drive.js：它不看 y0）：
  //   小房子的屋頂（天花板以上到屋脊）、升起來（或在動）的上層平台＋停在上面的車（底 1.94 公尺：人從下面走過去，鏡頭不穿過去）
  const cameraColliders = (world = false) => {
    const out = [{ t: 'box', x: (HX0 - HOV + HX1) / 2, z: (HZ0 + HZ1 + HOVN) / 2, hx: (HX1 - HX0 + HOV) / 2, hz: (HZ1 + HOVN - HZ0) / 2, rot: 0, y0: +(hIn(IX0) - 0.02).toFixed(3), h: +(hTop(HRX) + 0.12).toFixed(3) }];
    for (const lf of lifts) if (lf.busy || lf.level === 0) out.push({ t: 'box', x: BX, z: lf.z, hx: DKX, hz: DKZ, rot: 0, y0: PD - DKT, h: PD + (lf.cars[1] ? 1.5 : 0.06) });
    return world ? toWorldCols(out) : out;
  };
  const colliders = (doorOpen = DS.t >= 0.9, world = false) => { // 鐵捲門那個盒子一定放最後一個（walk.js 靠這個認門）
    const out = [...WALLS, ...COLS, ...lifts.flatMap(liftCols), ...(doorOpen ? [] : [DOOR_COL])].map((c) => ({ ...c }));
    return world ? toWorldCols(out) : out;
  };
  const zones = {
    inside: { x: (XB + XD) / 2, z: 0, hx: (XD - XB) / 2, hz: ZS }, door: { x: XD, z0: -DZ, z1: DZ, x1: XO, h: DH }, apron: { x: XO + 3, z: 0, hx: 3, hz: DZ + 1 },
    house: { x: (IX0 + IX1) / 2, z: (IZ0 + IZ1) / 2, hx: (IX1 - IX0) / 2, hz: (IZ1 - IZ0) / 2, ceil: +hIn(IX0).toFixed(3), ridge: +hIn(HRX).toFixed(3) }, // 小房子的地板（裡面）；天花板最低（牆邊）、最高（屋脊）
    bedSide: { x: 0.925, z: -11.2 - ZW, hx: 0.375, hz: 0.55 }, // 站在這裡 →「睡覺」
    houseDoor: { x: (HD0 + HD1) / 2, z: (IZ1 + HZ1) / 2, hx: (HD1 - HD0) / 2, hz: (HZ1 - IZ1) / 2, h: HDH }, // 門洞（牆的厚度那一段）
    lifts: lifts.map((lf) => lf.zone), // 站在這裡 → 操作那一台升降機（lifts[i].stand＝站的位置、面向操作柱）
  };
  const house = { // 小房子：door＝門外面一點（ry＝正面朝的方向：0＝本地 +z，跟 village.js buildings 的 door 一樣）；天花板：牆邊 ceil、屋脊 ridge、屋脊樑底 beam
    door: { x: (HD0 + HD1) / 2, z: HZ1 + 0.3, ry: 0, w: HD1 - HD0, h: HDH }, zone: zones.house, bedSide: zones.bedSide, bed: spots.bed, wake: spots.wake,
    ceil: zones.house.ceil, ridge: zones.house.ridge, beam: +BEAMY.toFixed(3),
  };
  // ceilingAt(x, z, world)：這一點頭上多高有東西（第三人稱鏡頭別穿過去）：小房子（斜天花板、屋脊樑、屋簷底）、升起來的上層平台底下、捲筒盒底下、車庫天花板；車庫外面 Infinity
  const ceilingAt = (x, z, world = false) => {
    if (world) ({ x, z } = toLocal(x, z));
    if (x > HX0 - HOV && x < HX1 && z > HZ0 && z < HZ1 + HOVN) return x > IX0 && z < IZ1 && Math.abs(x - HRX) < 0.08 ? BEAMY : hIn(x);
    for (const lf of lifts) if (lf.pos < 0.999 && Math.abs(x - BX) < DKX && Math.abs(z - lf.z) < DKZ) return PD * (1 - ease(lf.pos)) - DKT;
    if (x > XB && x < XD && Math.abs(z) < ZS) return x > XD - BOXN - 0.05 && Math.abs(z) < DZ + 0.4 ? BOXY : H;
    if (x >= XD && x <= XO && Math.abs(z) < DZ) return DH;
    return Infinity;
  };

  let extOn = !!exterior;
  const setExterior = (on) => { extOn = !!on; outer.visible = extOn; U.uCut.value = extOn ? 0 : 1; U.uApron.value = extOn ? XO : 14; };
  setExterior(exterior);
  const setCutaway = (on) => { U.uCut.value = on ? 1 : 0; }; // 車庫頁「鏡頭在牆外就把那面牆切掉」：車庫頁預設開、村子關；在車庫頁走路的時候可以關掉
  const setBays = (list = []) => { // 名牌、平台上車底的影子（車子自己由頁面擺；put／take 會自己改）：list[k]＝parkSlots[k] 停的車（字串、{ name }、null＝空的）
    //   舊的用法給 6 個（或更少）＝只改六台的上層（平常跟地板平），下層不動；給 7–12 個＝12 格都照 list（沒給的＝空的）
    const n = list.length > BAYZ.length ? parkSlots.length : BAYZ.length;
    for (let k = 0; k < n; k++) { const v = list[k], s = parkSlots[k]; deckNames[s.lift * 2 + s.deck] = v == null || v === false ? null : typeof v === 'string' ? v : v.name || ''; }
    flushDecks();
  };
  const update = (dt) => { let m = door.update(dt); for (const lf of lifts) m = lf.update(dt) || m; return m; }; // 每一格叫一次：鐵捲門＋六台升降機；有東西在動就 true
  const _c = V(0, 0, 0), cullOut = { inside: false, house: false, ceil: H };
  const cull = (camera) => { // 每一格可以叫：外殼開著（村子）→ 門關著、鏡頭在外面就不畫裡面，鏡頭在裡面就不畫外殼；回傳 { inside, house, ceil }（在車庫裡、在小房子裡、頭上多高）
    group.updateMatrixWorld(); syncRY(); _c.setFromMatrixPosition(camera.matrixWorld); group.worldToLocal(_c); // envRotation 在畫之前就對（停在裡面的車要用）
    const inside = _c.x > XB && _c.x < XD && Math.abs(_c.z) < ZS && _c.y < H;
    const out = _c.x > XO || _c.x < XBO || Math.abs(_c.z) > ZO || _c.y > TOP;
    if (extOn) { inner.visible = !(out && DS.t === 0 && !door.moving); outer.visible = !inside; }
    cullOut.inside = inside; cullOut.house = _c.x > IX0 && _c.x < IX1 && _c.z > IZ0 && _c.z < IZ1 && _c.y < hIn(_c.x); cullOut.ceil = ceilingAt(_c.x, _c.z);
    return cullOut;
  };

  const resize = (w, h) => {
    if (!refl) return;
    if (!w || !h) { const v = renderer.getDrawingBufferSize(new THREE.Vector2()); w = v.x; h = v.y; }
    const rw = Math.max(2, Math.round(w / 2)), rh = Math.max(2, Math.round(h / 2));
    refl.getRenderTarget().setSize(rw, rh); floorMat.userData.refl.uTexel.value.set(1 / rw, 1 / rh);
  };
  const dispose = () => {
    dead = true; group.removeFromParent();
    for (const o of trash) o.dispose();
    if (refl) refl.getRenderTarget().dispose();
    envRT.dispose(); signL = signG = null;
  };
  const api = { group, env: envRT.texture, setTrophies, resize, dispose, ready, size: ROOM_SIZE, door, spots, colliders, zones, setExterior, setBays, cull, toWorld, toLocal, interior: inner, exterior: outer, envRotation,
    update, lifts, parkSlots, freeSlot, liftColliders, cameraColliders, onLift: null, house, ceilingAt, setCutaway };
  return api;
}
