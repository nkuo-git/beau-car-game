// ---- 警察（第 3 批）：開車撞人、自己揍人、開槍會被警察追；被抓到關進警察局的拘留室 ----
// Nick 2026-09-28 07:16：「開車撞人或自己揍人會被警察追」；之前：「還要可以揍人會被警察抓撞人也會被警察抓」、開車撞人會被抓去關
// Nick 2026-09-28 07:19：「有店可以買槍 子彈」→ 開槍也算犯罪。警察不會開槍：只會追、會抓；被撞到、被打到的人倒下去再爬起來（沒有血）
// 世界座標跟 village.js、drive.js 一樣：x 往東、y 往上、z 往南；heading＝rotation.y（0 朝 +x、π/2 朝北 −z）；車子本地 +x 朝前、+z 朝右
// 【API】
//   const police = createPolice({
//     scene,                    警車、警察（角色）加在這裡
//     world: V,                 buildVillage() 回傳的（roads、highway、colliders、buildings、surfaceAt、places.police）
//     colliders,                另外要擋的東西（stripColliders()：賽道的護欄⋯），跟 drive.js 一樣
//     obstacles,                (x, z, r) → [box]：會動的東西（路上的車 traffic.colliders），警車會撞到、會閃（可省略）
//     sound: { ctx, out, muted, gain },   警笛（Web Audio）：ctx＝AudioContext 或回傳它的函式（() => engineAudio.context）；
//                               out＝接到哪個節點（預設 ctx.destination）；muted()＝現在靜音嗎；gain＝音量（預設 0.22）
//     hudParent: stage,         星星（通緝中）、快被抓的提示、被抓到、拘留室倒數放在這裡（要 position: relative）
//     makePoliceCar,            () → { group, setLights(on), update(dt) }（police.js 的；沒給用 placeholderPoliceCar）
//                               group：車的中心在原點、車頭朝 +x、輪子踩在 y = 0（跟 carlod.js 一樣）
//     makeOfficer,              () → 角色（buildCharacter(POLICE_LOOK)；沒給用 placeholderOfficer）：group、radius、update(dt, { speed, state })
//     jail,                     拘留室（世界座標）：{ cell: { x, z, heading }（關在這裡）, door: { x, z, heading }（放出來站在警察局門口，朝外）,
//                               yard: { x, z, heading }（你的車停這裡）, spawn: { x, z, heading }（警車從這裡開出來）, setCellDoor(open) }
//                               沒給就用 V.places.police 的 cell／door／yard／spawn；都沒有：放在被抓的地方、警車從 200–400 公尺外的路上來
//     getPlayer: (out) => out,  每一幀叫（把 out 填好回傳它，不用每幀新建物件）：
//                               { mode: 'drive' | 'walk' | 'off', x, z, heading, v（m/s，倒車負的）,
//                                 car: { hx, hz, cx }（開車時車身長方形：半長、半寬、中心在車子原點前面幾公尺；drive.carInfo 算）,
//                                 safe（躲在自己車庫、鐵捲門關了 → 星星清掉）, hidden（在房子裡面：警察看不到） }
//                               'off'＝在改車廠、車店、比賽⋯（警察停著等、不會抓）
//     onCaught(info),           被抓到的那一下（{ stars, fine, seconds, mode }）：頁面把開車／走路停住（drv.setInput 煞車、walker.pause()）
//     onArrest(info),           畫面全黑的時候：{ cell, door, yard, fine, seconds, stars }：人放進拘留室（walker.teleport(cell)）、車停到 yard
//     onRelease(info),          畫面全黑的時候：{ door, yard, paid }：人放到警察局門口（walker.teleport(door)、resume）；回傳 false＝車子沒拖來（不說「你的車停在⋯」）
//     toast(text, ms, red),     第 3 批（b3-int，可省略）：頁面自己說提示（回傳 true＝說了，這裡就不用自己的）；red＝被抓到那一下（大的紅色）
//     money: { get(), spend(n) },   錢包（萬）：get() 回傳現在多少；spend(n) 扣錢成功回傳 true（GAME.money、save、renderWallet）
//     tune: { … },              改預設值（見下面 TUNE）
//   });
//   police.update(dt)            每一幀（開車、走路更新完以後、render 之前）
//   police.crime(type, { x, z }) 犯罪（任何模組都可以叫）：
//       'punch' 揍人 +1★、'hit' 開車撞人 +2★、'cop' 撞警車／揍警察 +1★、'crush' 怪獸卡車輾扁別人的車／路邊的東西 +1★（第 7 批；越野車場裡面呼叫的人不要報）、
//       'shoot' 開槍打到人 → 直接 3★、'shootCop' 開槍打到警車／警察 +1★、'gunfire' 開槍沒打到人：60 公尺內有警察才 +1★
//       同一種 1.5 秒內只算一次（撞一個人好幾幀都碰到、連發）；最多 3★；回傳現在幾顆星
//   police.punch(me, people, knock)   揍人的判斷（走路按「揍」：walker.play('punch') 以後叫）：me＝{ x, z, heading }；
//       前面 1.2 公尺、左右 ±60° 以內最近的一個人（people：[{ x, z, down }]、npc.js 的 peds.people 也可以（mode 是 fall／lie／getup 的不算），或警察）
//       → knock(person, dx, dz) 讓他倒下去（npc.js：(p, dx, dz) => peds.knock(p, dx, dz, 4)）；報 'punch'／'cop'
//   police.carHit(people, knock)      開車撞人的判斷（每一幀，開車的時候）：車身碰到 people 裡的人、車速 > 2 m/s → knock、報 'hit'
//       （行人模組自己會判斷撞到就不用這兩個，直接叫 crime）；警察（下車跑的）一定是這裡判斷：撞到／揍到警察 → 倒下去、報 'cop'
//   police.shot(hit)           開槍打到警察（guns.js）：hit＝{ x, z, dx, dz }（打到的點、子彈的方向）→ 那個警察倒下去再爬起來；不報犯罪（guns.js 自己報 'shootCop'）
//   police.carObject(i)        警車 i（police.movers 的第 i 個長方形）的 Object3D（彈孔貼在上面）；police.shotCar(i, hit) 警車被打到（只記下來，照樣追）
//   police.colliders(x, z, r) → [box]  現在的警車（給 drive.js：drv.removeColliders('police'); drv.addColliders(police.colliders(t.x, t.z, 60), 'police')）
//   police.movers              固定的陣列（前 3 個是警車的長方形、後 3 個是下車的警察的圓；沒用到的大小是 0）：walker.setMovers(police.movers)（一次就好，每幀自己更新）
//   police.npcCars             固定的陣列（3 台警車，npc.js 的車的格式 { x, z, heading, v, hx, hz, ai: true, police: true }；沒出來的放在很遠）：
//                              traffic.update 的 obstacles、peds.update 的 cars 放進去（路上的車會讓警車、居民會閃開；警車不會撞飛人）
//   police.markers             小地圖的點：[{ x, z, fill, ring, r, on }]（同一個陣列，每幀換內容：紅藍閃、回警察局的灰色）
//                              → drv.setMarkers(police.markers)、walker.setMarkers(police.markers)（drive.js／walk.js 加的小功能，一次就好）
//   police.wanted              現在幾顆星（0–3）；police.state：'free' | 'wanted' | 'caught' | 'jail' | 'release'
//   police.clear()             星星清掉、警車馬上收掉（重新開始、回車庫頁）；police.setEnabled(on)（比賽、車庫頁：false＝警察全部收起來、HUD 藏起來，星星留著）
//   police.surrender()         第 3 批（b3-int）：通緝中自己走進警察局＝自首（跟被抓到一樣：關起來、可以繳罰款）
//   police.payFine()           繳罰款（拘留室的按鈕就是叫這個）；police.telemetry() → 見最下面；police.dispose()
//   police.preload(renderer?, camera?)   把 3 台警車、3 個警察先做好（載入畫面的時候叫；不叫也會在沒有星星的時候每 0.25 秒偷偷做一個）；給 renderer＋camera 順便編譯 shader
// 規則（TUNE 可以改）：
//   看到你＝警車／警察 180 公尺以內、中間沒有房子擋住（30 公尺以內轉角也算）；25 秒沒被看到掉一顆星，之後每 10 秒再掉一顆
//   第 3 批（b3-int）：甩開的計時從警察第一次看到你才開始（警察還在路上不算）；躲在房子裡、或 45 秒（hunt）都沒被找到就照算
//   小孩永遠打不到（揍、開車撞：punch／carHit 跳過 age: 'kid' 的）
//   開進自己的車庫、關上鐵捲門（getPlayer().safe）→ 星星清掉；星星沒了警車關警笛、開回警察局（看不到了就收掉）
//   警車：1★ 一台、2★ 兩台、3★ 三台；從警察局開出來（600 公尺以內），不然從 200–400 公尺外、你看不到的路上來；沿著路開過來，近了直接追
//         追的時候：第一台咬著你、第二台想繞到你前面、第三台從旁邊夾；你慢下來就前後左右圍住
//         開法：沿著路線（路的右邊、轉角切圓弧、照彎道減速）；看得到你、中間沒有東西擋（照真的會開的圓弧檢查）才直接衝過去
//         卡住、要去的地方在後面：先在原地試幾種開法（前進／倒車 × 左打／右打），挑不會撞到的那個 → 慢慢倒車、轉頭（三點迴轉），轉過來再開
//         卡住 8 秒你又沒看到它（20 秒就不管了）、落後 520 公尺以上：收起來，從 200–400 公尺外、你看不到的路上重新開過來
//   警察下車：你走路的時候警車開到附近就下車用跑的追（格子 A*：繞過房子、牆、警車；遠的走路線）；你離太遠（60 公尺）或上車了就跑回車上
//   開車被抓：速度 5 km/h 以下、7 公尺內有警車 2.5 秒（兩台以上貼著你 1.5 秒）；走路被抓：警察跑到 1.2 公尺以內（警察跑 5 m/s，比你快一點）
//   被抓到：「被警察抓到了！」→ 畫面變黑 → 關在拘留室 30 秒（可以繳罰款：每顆星 2 萬）→ 放出來站在警察局門口，車停在警察局的停車場；星星清掉
// 效能：每一幀不新增物件（路線、碰撞、找點都用事先開好的陣列）；路線 1 秒重算一次（錯開）、看不看得到 0.25 秒算一次；物理每步最多走 0.6 公尺
import * as THREE from 'three';

// 打包（build-art.mjs、build-app.mjs）會拿掉 import、把 export 變成一般宣告、所有檔接在同一個 script 裡：只露出下面幾個名字
export const { createPolice, placeholderPoliceCar, placeholderOfficer, OFFICER_LOOK, policeNavGraph } = (() => {
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapA = (a) => { a = (a + Math.PI) % TAU; return a < 0 ? a + Math.PI : a - Math.PI; };
const tnow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif', COND = '"Barlow Condensed", "Arial Narrow", sans-serif';

// ---- 預設值 ----
const TUNE = {
  add: { punch: 1, hit: 2, cop: 1, shoot: 3, shootCop: 1, gunfire: 1, crush: 1, crushCop: 2 }, // crushCop＝第 9 批：越野車輾扁警車 +2★（警察先下車跑掉，不會受傷） // 幾顆星（shoot：直接變 3★）；crush＝第 7 批：怪獸卡車輾扁別人的車、路邊的東西（＋1★，跟撞車一樣）
  gunfireR: 60, cool: 1.5, // 開槍沒打到人：警察在幾公尺內才算；同一種犯罪幾秒內只算一次
  seeR: 180, nearR: 30, lose: 25, loseNext: 10, hunt: 45, // 看得到的距離、轉角也算看到的距離、幾秒沒被看到掉一顆星、之後每幾秒再掉一顆
  catchR: 7, catchV: 5 / 3.6, catchT: 2.5, boxT: 1.5, boxR: 6.2, // 開車被抓：幾公尺內、比多慢、幾秒；兩台以上夾著：幾秒、幾公尺
  footR: 1.2, runV: 5.0, // 走路被抓：警察多近；警察跑多快（你跑 4.5）
  jailS: 30, fine: 2, // 關幾秒、罰款每顆星幾萬
  spawnMin: 200, spawnMax: 400, stationR: 600, stagger: 2.5, // 警車從哪裡來、第二台以後隔幾秒
  vmax: 205 / 3.6, vfar: 250 / 3.6, acc: 6.2, brake: 10, comf: 5.5, alat: 9.2, // 警車：極速（離很遠、看不到的時候快一點追上來）、加速、煞車、過彎
  stanK: 3.5, stanPre: 0.25, manIn: 2.4, manOut: 1.0, // 沿著路線開（Stanley 的力道、看前面幾秒的方向）；要去的地方偏幾度（弧度）以上就慢慢倒車、轉頭，轉到幾度以內再照平常開
};
const MAXC = 3; // 最多幾台（3★）

// ---- 碰撞：有方向的長方形（車）碰到長方形／圓／車 ----
// 車：中心 (x, z)、朝向 f＝(cos th, −sin th)、右邊 r＝(sin th, cos th)、半長 hl、半寬 hw
// 回傳 true＝碰到了：OUT[0..1]＝把車推出去的量、OUT[2..3]＝法線（從東西指向車）
const OUT = new Float64Array(4);
function boxPush(x, z, fx, fz, hl, hw, c) { // c：{ x, z, hx, hz, ux, uz, wx, wz }
  const rx = -fz, rz = fx, dx = x - c.x, dz = z - c.z;
  let best = Infinity, nx = 0, nz = 0;
  for (let k = 0; k < 4; k++) {
    const ax = k === 0 ? fx : k === 1 ? rx : k === 2 ? c.ux : c.wx, az = k === 0 ? fz : k === 1 ? rz : k === 2 ? c.uz : c.wz;
    const d = dx * ax + dz * az;
    const o = hl * Math.abs(fx * ax + fz * az) + hw * Math.abs(rx * ax + rz * az) + c.hx * Math.abs(c.ux * ax + c.uz * az) + c.hz * Math.abs(c.wx * ax + c.wz * az) - Math.abs(d);
    if (o <= 0) return false;
    if (o < best) { best = o; const s = d < 0 ? -1 : 1; nx = ax * s; nz = az * s; }
  }
  OUT[0] = nx * best; OUT[1] = nz * best; OUT[2] = nx; OUT[3] = nz;
  return true;
}
function circlePush(x, z, fx, fz, hl, hw, cx, cz, r) { // 圓 (cx, cz, r)
  const rx = -fz, rz = fx, dx = cx - x, dz = cz - z, lx = dx * fx + dz * fz, lz = dx * rx + dz * rz;
  const ex = lx - clamp(lx, -hl, hl), ez = lz - clamp(lz, -hw, hw), d2 = ex * ex + ez * ez;
  if (d2 >= r * r) return false;
  let nx, nz, pen;
  if (d2 > 1e-10) { const d = Math.sqrt(d2); nx = ex / d; nz = ez / d; pen = r - d; }
  else if (hl - Math.abs(lx) < hw - Math.abs(lz)) { nx = Math.sign(lx) || 1; nz = 0; pen = hl - Math.abs(lx) + r; }
  else { nx = 0; nz = Math.sign(lz) || 1; pen = hw - Math.abs(lz) + r; }
  const wx = fx * nx + rx * nz, wz = fz * nx + rz * nz; // 車子往圓的方向 → 車要往反方向推
  OUT[0] = -wx * pen; OUT[1] = -wz * pen; OUT[2] = -wx; OUT[3] = -wz;
  return true;
}
// 圓（人）碰到長方形／圓：OUT[0..1]＝把人推出去的量
function circleVsBox(px, pz, r, c) {
  const dx = px - c.x, dz = pz - c.z, lu = dx * c.ux + dz * c.uz, lw = dx * c.wx + dz * c.wz;
  const eu = lu - clamp(lu, -c.hx, c.hx), ew = lw - clamp(lw, -c.hz, c.hz), d2 = eu * eu + ew * ew;
  if (d2 >= r * r) return false;
  if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; OUT[0] = (eu * c.ux + ew * c.wx) * k; OUT[1] = (eu * c.uz + ew * c.wz) * k; return true; }
  const pu = c.hx - Math.abs(lu), pw = c.hz - Math.abs(lw); // 圓心在裡面：從最近的邊推出去
  if (pu < pw) { const s = lu < 0 ? -1 : 1; OUT[0] = c.ux * s * (pu + r); OUT[1] = c.uz * s * (pu + r); } else { const s = lw < 0 ? -1 : 1; OUT[0] = c.wx * s * (pw + r); OUT[1] = c.wz * s * (pw + r); }
  return true;
}

// ---- 碰撞物的格子（8 公尺一格）：每個碰撞物放進它碰到的格子（多放 pad 公尺：線段只要走過中線經過的格子就找得到）----
// 大的（邊長 > 120 公尺：快速道路的長護欄、村子的圍牆）另外放一個清單；near() 回傳同一個陣列（下一次會蓋掉）
function makeGrid(list, pad, keep) {
  const CELL = 8, grid = new Map(), big = [], found = [], key = (i, j) => i * 100003 + j;
  let stamp = 0;
  for (const c0 of list || []) {
    if (!c0 || !isFinite(c0.x) || !isFinite(c0.z) || (keep && !keep(c0))) continue;
    const box = c0.t === 'box'; if (box ? !(c0.hx > 0 && c0.hz > 0) : !(c0.r > 0)) continue;
    const rot = c0.rot || 0, c = { box, x: c0.x, z: c0.z, hx: box ? c0.hx : 0, hz: box ? c0.hz : 0, r: box ? 0 : c0.r, h: c0.h ?? 9, ux: Math.cos(rot), uz: -Math.sin(rot), wx: Math.sin(rot), wz: Math.cos(rot), s: 0 };
    const ex = box ? Math.abs(c.ux) * c.hx + Math.abs(c.wx) * c.hz : c.r, ez = box ? Math.abs(c.uz) * c.hx + Math.abs(c.wz) * c.hz : c.r;
    c.ex = ex; c.ez = ez;
    if (ex > 60 || ez > 60) { big.push(c); continue; }
    for (let i = Math.floor((c.x - ex - pad) / CELL); i <= Math.floor((c.x + ex + pad) / CELL); i++) for (let j = Math.floor((c.z - ez - pad) / CELL); j <= Math.floor((c.z + ez + pad) / CELL); j++) {
      if (box) { // 斜的長方形只放真的碰到的格子
        const dx = (i + 0.5) * CELL - c.x, dz = (j + 0.5) * CELL - c.z, hc = CELL / 2 + pad;
        if (Math.abs(dx * c.ux + dz * c.uz) > c.hx + hc * (Math.abs(c.ux) + Math.abs(c.uz)) || Math.abs(dx * c.wx + dz * c.wz) > c.hz + hc * (Math.abs(c.wx) + Math.abs(c.wz))) continue;
      }
      const k = key(i, j); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(c);
    }
  }
  const G = {
    CELL, big,
    near(x0, z0, x1, z1) {
      stamp++; found.length = 0;
      for (let b = 0; b < big.length; b++) { const c = big[b]; if (c.x + c.ex >= x0 && c.x - c.ex <= x1 && c.z + c.ez >= z0 && c.z - c.ez <= z1) found.push(c); }
      for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
        const a = grid.get(key(i, j)); if (!a) continue;
        for (let q = 0; q < a.length; q++) { const c = a[q]; if (c.s !== stamp) { c.s = stamp; found.push(c); } }
      }
      return found;
    },
    // 線段 (x0, z0) → (x1, z1) 胖 r 公尺（r ≤ pad）有沒有碰到東西：走過中線經過的格子（Amanatides–Woo）
    blocked(x0, z0, x1, z1, r) {
      stamp++;
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
      for (let b = 0; b < big.length; b++) if (segHits(big[b], x0, z0, dx, dz, r)) return true;
      let i = Math.floor(x0 / CELL), j = Math.floor(z0 / CELL); const i1 = Math.floor(x1 / CELL), j1 = Math.floor(z1 / CELL);
      const si = dx > 0 ? 1 : -1, sj = dz > 0 ? 1 : -1;
      const tdx = Math.abs(dx) > 1e-9 ? CELL / Math.abs(dx) : Infinity, tdz = Math.abs(dz) > 1e-9 ? CELL / Math.abs(dz) : Infinity;
      let tx = Math.abs(dx) > 1e-9 ? ((si > 0 ? (i + 1) * CELL - x0 : x0 - i * CELL) / Math.abs(dx)) : Infinity;
      let tz = Math.abs(dz) > 1e-9 ? ((sj > 0 ? (j + 1) * CELL - z0 : z0 - j * CELL) / Math.abs(dz)) : Infinity;
      for (let guard = 0; guard < 4 + (L / CELL) * 2 + 4; guard++) {
        const a = grid.get(key(i, j));
        if (a) for (let q = 0; q < a.length; q++) { const c = a[q]; if (c.s === stamp) continue; c.s = stamp; if (segHits(c, x0, z0, dx, dz, r)) return true; }
        if (i === i1 && j === j1) break;
        if (tx < tz) { if (tx > 1) break; tx += tdx; i += si; } else { if (tz > 1) break; tz += tdz; j += sj; }
      }
      return false;
    },
  };
  return G;
}
// 線段（起點 x0, z0、方向 dx, dz）胖 r 碰不碰得到 c（長方形：本地座標的平板測試，邊長加 r；圓：點到線段的距離）
function segHits(c, x0, z0, dx, dz, r) {
  if (!c.box) {
    const L2 = dx * dx + dz * dz, t = L2 > 1e-12 ? clamp(((c.x - x0) * dx + (c.z - z0) * dz) / L2, 0, 1) : 0, ex = x0 + dx * t - c.x, ez = z0 + dz * t - c.z, rr = c.r + r;
    return ex * ex + ez * ez < rr * rr;
  }
  const ox = x0 - c.x, oz = z0 - c.z, pu = ox * c.ux + oz * c.uz, pw = ox * c.wx + oz * c.wz, du = dx * c.ux + dz * c.uz, dw = dx * c.wx + dz * c.wz;
  const eu = c.hx + r, ew = c.hz + r;
  let t0 = 0, t1 = 1;
  if (Math.abs(du) < 1e-9) { if (Math.abs(pu) > eu) return false; } else { let a = (-eu - pu) / du, b = (eu - pu) / du; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) return false; }
  if (Math.abs(dw) < 1e-9) { if (Math.abs(pw) > ew) return false; } else { let a = (-ew - pw) / dw, b = (ew - pw) / dw; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) return false; }
  return true;
}

// ---- 路網（警車開的）：V.roads 的路（雙向）＋快速道路外圈、內圈（單向，照開的方向）＋快速道路路口的連接 ----
// 節點＝折線上的每一點（0.6 公尺內併成一個）；丁字路口（端點在別條路中間）切開；每一段線＝一條邊（雙向的兩個方向都有）
const NAVS = new WeakMap();
function policeNavGraph(V) {
  let G = NAVS.get(V); if (G) return G;
  const px = [], pz = [], ph = [], nodeHash = new Map(), hk = (x, z) => Math.floor(x / 1.2) * 100003 + Math.floor(z / 1.2);
  const nodeAt = (x, z, own) => { // own：快速道路的點不要跟村子的點併在一起
    const i0 = Math.floor(x / 1.2), j0 = Math.floor(z / 1.2);
    if (!own) for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) { const a = nodeHash.get(i * 100003 + j); if (a) for (const n of a) if (Math.hypot(px[n] - x, pz[n] - z) < 0.6) return n; }
    const n = px.length; px.push(x); pz.push(z); ph.push(own ? 1 : 0);
    if (!own) { const k = hk(x, z); let a = nodeHash.get(k); if (!a) nodeHash.set(k, (a = [])); a.push(n); }
    return n;
  };
  const dedupe = (pts) => { const out = []; for (const p of pts) if (!out.length || Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) > 0.3) out.push([p[0], p[1]]); return out; };
  const lines = [];
  for (const r of V.roads || []) if (r.kind !== 'highway' && r.pts && r.pts.length > 1) lines.push({ pts: dedupe(r.pts), w: r.w || 7, two: true, hwy: false });
  // 丁字路口：端點在另一條路的中間 → 那條路在那裡多一個點
  for (const A of lines) for (const e of [A.pts[0], A.pts[A.pts.length - 1]]) for (const B of lines) {
    if (B === A) continue;
    for (let i = 0; i < B.pts.length - 1; i++) {
      const a = B.pts[i], b = B.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; if (L2 < 1e-6) continue;
      const t = ((e[0] - a[0]) * dx + (e[1] - a[1]) * dz) / L2; if (t <= 0.02 || t >= 0.98) continue;
      if (Math.hypot(a[0] + dx * t - e[0], a[1] + dz * t - e[1]) < 0.6) { B.pts.splice(i + 1, 0, [e[0], e[1]]); break; }
    }
  }
  const H = V.highway;
  const loopPts = (pts, step) => { // 快速道路一圈：大約每 step 公尺一點（頭尾是路口，同一點）
    const out = [pts[0]]; let acc = 0;
    for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc >= step || i === pts.length - 1) { out.push(pts[i]); acc = 0; } }
    return dedupe(out);
  };
  if (H && H.out && H.in && H.out.length > 3) { lines.push({ pts: loopPts(H.out, 12), w: 7.5, two: false, hwy: true }); lines.push({ pts: loopPts(H.in, 12), w: 7.5, two: false, hwy: true }); }
  // 邊（每一段線一條；雙向的兩個方向）
  const segA = [], segB = [], segTwo = [], segW = [], segHwy = [];
  for (const L of lines) {
    const ids = []; let first = -1;
    for (let i = 0; i < L.pts.length; i++) {
      const p = L.pts[i];
      if (L.hwy && i === L.pts.length - 1 && first >= 0 && Math.hypot(p[0] - px[first], p[1] - pz[first]) < 1) { ids.push(first); continue; } // 一圈接回自己
      const n = nodeAt(p[0], p[1], L.hwy); if (i === 0) first = n; ids.push(n);
    }
    L.ids = ids;
    for (let i = 0; i < ids.length - 1; i++) if (ids[i] !== ids[i + 1]) { segA.push(ids[i]); segB.push(ids[i + 1]); segTwo.push(L.two ? 1 : 0); segW.push(L.w); segHwy.push(L.hwy ? 1 : 0); }
  }
  // 快速道路的路口：村子的路的死路端點離快速道路的點 20 公尺以內 → 兩邊都接（右轉上外圈、左轉穿過中間護欄開口上內圈，下來也一樣）
  const deg = new Int32Array(px.length); for (let s = 0; s < segA.length; s++) if (!segHwy[s]) { deg[segA[s]]++; deg[segB[s]]++; }
  const hwyLines = lines.filter((l) => l.hwy);
  for (let n = 0; n < px.length; n++) {
    if (deg[n] !== 1) continue;
    for (const L of hwyLines) {
      let best = -1, bd = 20;
      for (const m of L.ids) { const d = Math.hypot(px[m] - px[n], pz[m] - pz[n]); if (d < bd) { bd = d; best = m; } }
      if (best >= 0) { segA.push(n); segB.push(best); segTwo.push(1); segW.push(8); segHwy.push(2); } // 2＝上下快速道路的連接（在快速道路上也找得到）
    }
  }
  const N = px.length, M = segA.length;
  const nx = Float64Array.from(px), nz = Float64Array.from(pz);
  const sA = Int32Array.from(segA), sB = Int32Array.from(segB), sTwo = Uint8Array.from(segTwo), sW = Float32Array.from(segW), sHwy = Uint8Array.from(segHwy), sLen = new Float64Array(M);
  for (let s = 0; s < M; s++) sLen[s] = Math.hypot(nx[sB[s]] - nx[sA[s]], nz[sB[s]] - nz[sA[s]]);
  // 有方向的邊（CSR）：正的（從哪裡出去）、反的（從哪裡進來）
  const outDeg = new Int32Array(N + 1), inDeg = new Int32Array(N + 1);
  for (let s = 0; s < M; s++) { outDeg[sA[s]]++; inDeg[sB[s]]++; if (sTwo[s]) { outDeg[sB[s]]++; inDeg[sA[s]]++; } }
  const oStart = new Int32Array(N + 1), iStart = new Int32Array(N + 1);
  for (let n = 0; n < N; n++) { oStart[n + 1] = oStart[n] + outDeg[n]; iStart[n + 1] = iStart[n] + inDeg[n]; }
  const E = oStart[N], oTo = new Int32Array(E), oSeg = new Int32Array(E), iFrom = new Int32Array(E), iSeg = new Int32Array(E), oFill = oStart.slice(0, N), iFill = iStart.slice(0, N);
  const addE = (a, b, s) => { oTo[oFill[a]] = b; oSeg[oFill[a]++] = s; iFrom[iFill[b]] = a; iSeg[iFill[b]++] = s; };
  for (let s = 0; s < M; s++) { addE(sA[s], sB[s], s); if (sTwo[s]) addE(sB[s], sA[s], s); }
  // 找最近的一段：20 公尺一格，每一段放進它經過的格子（多放 6 公尺）
  const EC = 20, egrid = new Map(), ekey = (i, j) => i * 100003 + j;
  for (let s = 0; s < M; s++) {
    const ax = nx[sA[s]], az = nz[sA[s]], bx = nx[sB[s]], bz = nz[sB[s]];
    for (let i = Math.floor((Math.min(ax, bx) - 6) / EC); i <= Math.floor((Math.max(ax, bx) + 6) / EC); i++) for (let j = Math.floor((Math.min(az, bz) - 6) / EC); j <= Math.floor((Math.max(az, bz) + 6) / EC); j++) {
      const k = ekey(i, j); let a = egrid.get(k); if (!a) egrid.set(k, (a = [])); a.push(s);
    }
  }
  G = { N, M, nx, nz, nHwy: Uint8Array.from(ph), sA, sB, sTwo, sW, sHwy, sLen, oStart, oTo, oSeg, iStart, iFrom, iSeg, EC, egrid, ekey, segStamp: new Int32Array(M), stamp: 0 };
  NAVS.set(V, G);
  return G;
}

// ---- 路線（重複用的陣列）：點、累積長度、每一點的速限（彎道、煞得住）、從哪一段來（雙向的路才靠右）----
function mkPath(cap) { return { n: 0, cap, x: new Float64Array(cap), z: new Float64Array(cap), cum: new Float64Array(cap), vl: new Float64Array(cap), i: 0, len: 0, tx: 0, tz: 0, ok: false }; }
function pathAdd(P, x, z) {
  if (P.n >= P.cap) return;
  if (P.n > 0) { const dx = x - P.x[P.n - 1], dz = z - P.z[P.n - 1]; if (dx * dx + dz * dz < 0.04) return; }
  P.x[P.n] = x; P.z[P.n] = z; P.n++;
}
function pathFinish(P, amax, dec, vcap) { // 累積長度＋速限：三點的曲率 → √(a/κ)；再往回推：前面要慢，後面就要先煞車
  const n = P.n; P.cum[0] = 0;
  for (let i = 1; i < n; i++) P.cum[i] = P.cum[i - 1] + Math.hypot(P.x[i] - P.x[i - 1], P.z[i] - P.z[i - 1]);
  P.len = n ? P.cum[n - 1] : 0;
  for (let i = 0; i < n; i++) {
    let v = vcap;
    if (i > 0 && i < n - 1) {
      const ax = P.x[i] - P.x[i - 1], az = P.z[i] - P.z[i - 1], bx = P.x[i + 1] - P.x[i], bz = P.z[i + 1] - P.z[i], cx = P.x[i + 1] - P.x[i - 1], cz = P.z[i + 1] - P.z[i - 1];
      const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz), lc = Math.hypot(cx, cz);
      if (la > 1e-6 && lb > 1e-6 && lc > 1e-6) { const k = (2 * Math.abs(ax * bz - az * bx)) / (la * lb * lc); if (k > 1e-6) v = Math.min(v, Math.sqrt(amax / k)); }
    }
    P.vl[i] = Math.max(4.5, v);
  }
  for (let i = n - 2; i >= 0; i--) P.vl[i] = Math.min(P.vl[i], Math.sqrt(P.vl[i + 1] * P.vl[i + 1] + 2 * dec * (P.cum[i + 1] - P.cum[i])));
  P.i = 0; P.ok = n > 1;
}

// ---- 路線規劃（Dijkstra；陣列都是事先開好的）----
function makeRouter(G) {
  const N = G.N, dist = new Float64Array(N), prev = new Int32Array(N), seen = new Int32Array(N), done = new Int32Array(N);
  const hN = new Int32Array(G.oTo.length + N + 8), hK = new Float64Array(G.oTo.length + N + 8); let hs = 0, st = 0;
  const chain = new Int32Array(N + 4), RX = new Float64Array(N + 16), RZ = new Float64Array(N + 16), RL = new Uint8Array(N + 16), RW = new Float32Array(N + 16), OX = new Float64Array(N + 16), OZ = new Float64Array(N + 16);
  const laneOf = (w) => clamp((w - 6) * 0.8, 0, 1); // 路多寬 → 靠右幾成（6 公尺的小路走中間：路邊的樹、電線桿才不會撞到）
  const cand = { s: new Int32Array(8), d: new Float64Array(8), t: new Float64Array(8), qx: new Float64Array(8), qz: new Float64Array(8), n: 0 };
  const push = (n, k) => { let i = hs++; while (i > 0) { const p = (i - 1) >> 1; if (hK[p] <= k) break; hN[i] = hN[p]; hK[i] = hK[p]; i = p; } hN[i] = n; hK[i] = k; };
  const pop = () => { const top = hN[0]; hs--; if (hs > 0) { const n = hN[hs], k = hK[hs]; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= hs) break; if (c + 1 < hs && hK[c + 1] < hK[c]) c++; if (hK[c] >= k) break; hN[i] = hN[c]; hK[i] = hK[c]; i = c; } hN[i] = n; hK[i] = k; } return top; };
  const relax = (n, d, p) => { if (seen[n] !== st || d < dist[n]) { seen[n] = st; dist[n] = d; prev[n] = p; push(n, d); } };
  // 離 (x, z) 最近的幾段（最多 8 段、R 公尺以內），照距離排好放在 cand
  function nearest(x, z, R, hwyOnly) {
    cand.n = 0; G.stamp++;
    const EC = G.EC, i0 = Math.floor(x / EC), j0 = Math.floor(z / EC), rr = Math.ceil(R / EC);
    for (let ring = 0; ring <= rr; ring++) {
      for (let i = i0 - ring; i <= i0 + ring; i++) for (let j = j0 - ring; j <= j0 + ring; j++) {
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== ring) continue;
        const a = G.egrid.get(G.ekey(i, j)); if (!a) continue;
        for (let q = 0; q < a.length; q++) {
          const s = a[q]; if (G.segStamp[s] === G.stamp) continue; G.segStamp[s] = G.stamp;
          if (hwyOnly === 1 && G.sHwy[s] === 0) continue; if (hwyOnly === 0 && G.sHwy[s] === 1) continue; // 在快速道路上：只找快速道路（＋下交流道的連接）
          const ax = G.nx[G.sA[s]], az = G.nz[G.sA[s]], dx = G.nx[G.sB[s]] - ax, dz = G.nz[G.sB[s]] - az, L2 = dx * dx + dz * dz;
          const t = L2 > 1e-9 ? clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1) : 0, qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(x - qx, z - qz);
          if (d > R) continue;
          if (cand.n === 8 && d >= cand.d[7]) continue; // 滿了：比最遠的還遠就不要
          let k = cand.n < 8 ? cand.n++ : 7;
          while (k > 0 && cand.d[k - 1] > d) { cand.s[k] = cand.s[k - 1]; cand.d[k] = cand.d[k - 1]; cand.t[k] = cand.t[k - 1]; cand.qx[k] = cand.qx[k - 1]; cand.qz[k] = cand.qz[k - 1]; k--; }
          cand.s[k] = s; cand.d[k] = d; cand.t[k] = t; cand.qx[k] = qx; cand.qz[k] = qz;
        }
      }
      if (cand.n >= 3 && (ring + 1) * EC > cand.d[cand.n - 1] + EC) break; // 夠近的都找到了
    }
    return cand.n;
  }
  // 選一段：最近而且直直走得到的（線段胖 r 沒碰到東西）；都擋住就最近的
  //   th（可省略）：車頭（或你開車）的方向 → 跟它垂直的路多算 8 公尺（大路上經過路口，不會投影到旁邊的小路上：路線才不會在路口折來折去、一直慢下來）
  const pick = { s: -1, t: 0, qx: 0, qz: 0, d: 0, clear: false };
  const cost = new Float64Array(8);
  function project(x, z, R, hwyOnly, solid, r, th) {
    pick.s = -1;
    const n = nearest(x, z, R, hwyOnly); if (!n) return false;
    const useTh = th != null && isFinite(th), hx = useTh ? Math.cos(th) : 0, hz = useTh ? -Math.sin(th) : 0;
    let m = 0;
    for (let k = 0; k < n; k++) {
      if (k > 0 && cand.d[k] > cand.d[0] + 25) break;
      let cs = cand.d[k];
      if (useTh) { const sg = cand.s[k], dx = G.nx[G.sB[sg]] - G.nx[G.sA[sg]], dz = G.nz[G.sB[sg]] - G.nz[G.sA[sg]], L = Math.hypot(dx, dz); if (L > 1e-6) cs += 8 * (1 - Math.abs((dx * hx + dz * hz) / L)); }
      cost[k] = cs; m = k + 1;
    }
    let done = 0, first = -1;
    for (let it = 0; it < m; it++) { // 照 cost 由小到大試：第一個直直走得到的
      let k = -1; for (let j = 0; j < m; j++) if (!(done & (1 << j)) && (k < 0 || cost[j] < cost[k])) k = j;
      done |= 1 << k; if (first < 0) first = k;
      if (!solid || cand.d[k] < 0.5 || !solid.blocked(x, z, cand.qx[k], cand.qz[k], r)) { pick.s = cand.s[k]; pick.t = cand.t[k]; pick.qx = cand.qx[k]; pick.qz = cand.qz[k]; pick.d = cand.d[k]; pick.clear = true; return true; }
    }
    pick.s = cand.s[first]; pick.t = cand.t[first]; pick.qx = cand.qx[first]; pick.qz = cand.qz[first]; pick.d = cand.d[first]; pick.clear = false;
    return true;
  }
  // 從 (sx, sz)（車頭朝 sth）沿著路開到 (tx, tz)，寫進 P。o：{ solid, onHwy, tHwy, lane（雙向的路靠右幾公尺）, uturn（掉頭多算幾公尺）, toTarget（最後直直開到 (tx, tz)）,
  //   tth（可省略：目標的方向，你開車的方向）, far（目標離路最遠幾公尺，預設 160）}
  // 回傳 true＝找到路
  function route(P, sx, sz, sth, tx, tz, o) {
    P.n = 0; P.ok = false;
    if (!project(sx, sz, 60, o.onHwy ? 1 : -1, o.solid, 0.9, sth)) return false;
    const s0 = pick.s, t0 = pick.t, q0x = pick.qx, q0z = pick.qz;
    if (!project(tx, tz, o.far || 160, o.tHwy ? 1 : -1, o.solid, 0.9, o.tth)) return false;
    const s1 = pick.s, t1 = pick.t, q1x = pick.qx, q1z = pick.qz, clear1 = pick.clear;
    const fx = Math.cos(sth), fz = -Math.sin(sth);
    st++; hs = 0;
    const a0 = G.sA[s0], b0 = G.sB[s0], L0 = G.sLen[s0];
    const dab = L0 > 1e-6 ? ((G.nx[b0] - G.nx[a0]) * fx + (G.nz[b0] - G.nz[a0]) * fz) / L0 : 0; // 往 b 走跟車頭同方向嗎
    const back = o.uturn ?? 30;
    relax(b0, L0 * (1 - t0) + (dab < -0.3 ? back : 0), -1);
    if (G.sTwo[s0]) relax(a0, L0 * t0 + (dab > 0.3 ? back : 0), -1);
    const a1 = G.sA[s1], b1 = G.sB[s1], two1 = G.sTwo[s1];
    // 同一段：直接沿著這段走（單行道要往前）
    let direct = false;
    if (s0 === s1) direct = two1 ? (t1 >= t0 ? dab > -0.3 : dab < 0.3) : t1 >= t0;
    let endVia = -1, best = Infinity;
    if (!direct) {
      while (hs > 0) {
        const u = pop(); if (done[u] === st) continue; done[u] = st;
        const du = dist[u];
        if (du > best) break;
        if (u === a1) { const c = du + Math.hypot(G.nx[a1] - q1x, G.nz[a1] - q1z); if (c < best) { best = c; endVia = u; } }
        if (u === b1 && two1) { const c = du + Math.hypot(G.nx[b1] - q1x, G.nz[b1] - q1z); if (c < best) { best = c; endVia = u; } }
        for (let e = G.oStart[u]; e < G.oStart[u + 1]; e++) relax(G.oTo[e], du + G.sLen[G.oSeg[e]], u);
      }
      if (endVia < 0) return false;
    }
    // 點：起點 → 投影點 → 節點⋯ → 投影點 → 終點（看得到才直直開過去）；RL＝雙向的村子的路（要靠右）
    let m = 0; const lane = o.lane || 0;
    const put = (x, z, ln, w) => { if (m < RX.length) { RX[m] = x; RZ[m] = z; RL[m] = ln; RW[m] = w; m++; } };
    const segW = (a, b) => { for (let e = G.oStart[a]; e < G.oStart[a + 1]; e++) if (G.oTo[e] === b) return G.sW[G.oSeg[e]]; return 7; }; // a → b 那條路多寬
    put(sx, sz, 0, 0); put(q0x, q0z, G.sTwo[s0] && !G.sHwy[s0] ? 1 : 0, laneOf(G.sW[s0]));
    if (!direct) {
      let k = 0; for (let u = endVia; u >= 0 && k < chain.length; u = prev[u]) chain[k++] = u;
      for (let j = k - 1; j >= 0; j--) {
        const u = chain[j], wi = j < k - 1 ? segW(chain[j + 1], u) : G.sW[s0], wo = j > 0 ? segW(u, chain[j - 1]) : G.sW[s1];
        put(G.nx[u], G.nz[u], G.nHwy[u] ? 0 : 1, laneOf(Math.min(wi, wo)));
      }
    }
    put(q1x, q1z, two1 && !G.sHwy[s1] ? 1 : 0, laneOf(G.sW[s1]));
    const tgt = clear1 && o.toTarget !== false; if (tgt) put(tx, tz, 0);
    // 靠右：前後（也是要靠右的）點的方向 → 往右手邊（−dz, dx）移 lane 公尺（轉角照角平分線放大）
    for (let i = 0; i < m; i++) {
      let x = RX[i], z = RZ[i];
      if (lane > 0 && RL[i]) {
        const hp = i > 0 && RL[i - 1] === 1, hn = i < m - 1 && RL[i + 1] === 1;
        let ax = 0, az = 0, bx = 0, bz = 0;
        if (hp) { ax = x - RX[i - 1]; az = z - RZ[i - 1]; const l = Math.hypot(ax, az); if (l > 1e-6) { ax /= l; az /= l; } else { ax = 0; az = 0; } }
        if (hn) { bx = RX[i + 1] - x; bz = RZ[i + 1] - z; const l = Math.hypot(bx, bz); if (l > 1e-6) { bx /= l; bz /= l; } else { bx = 0; bz = 0; } }
        let tx2 = ax + bx, tz2 = az + bz; const tl = Math.hypot(tx2, tz2);
        const ln = lane * RW[i];
        if (tl > 0.3 && ln > 0.01) { tx2 /= tl; tz2 /= tl; const cs = hp && hn ? Math.max(0.5, ax * tx2 + az * tz2) : 1; x += (-tz2 * ln) / cs; z += (tx2 * ln) / cs; }
      }
      OX[i] = x; OZ[i] = z;
    }
    if (tgt && m >= 3 && Math.hypot(OX[m - 1] - OX[m - 2], OZ[m - 1] - OZ[m - 2]) < 3) { OX[m - 2] = OX[m - 1]; OZ[m - 2] = OZ[m - 1]; m--; } // 最後那個路上的點離終點很近：拿掉（不然路線尾巴折一下，追的時候一直慢下來）
    // 轉角修圓（20° 以上）：二次貝茲曲線
    for (let i = 0; i < m; i++) {
      if (i === 0 || i === m - 1) { pathAdd(P, OX[i], OZ[i]); continue; }
      const ax = OX[i] - OX[i - 1], az = OZ[i] - OZ[i - 1], bx = OX[i + 1] - OX[i], bz = OZ[i + 1] - OZ[i], la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
      const cs = la > 1e-6 && lb > 1e-6 ? (ax * bx + az * bz) / (la * lb) : 1;
      if (cs > 0.94 || la < 1 || lb < 1) { pathAdd(P, OX[i], OZ[i]); continue; }
      const rr = Math.min(8, la * 0.45, lb * 0.45), p0x = OX[i] - (ax / la) * rr, p0z = OZ[i] - (az / la) * rr, p2x = OX[i] + (bx / lb) * rr, p2z = OZ[i] + (bz / lb) * rr;
      for (let k = 0; k <= 4; k++) { const t = k / 4, u = 1 - t; pathAdd(P, u * u * p0x + 2 * u * t * OX[i] + t * t * p2x, u * u * p0z + 2 * u * t * OZ[i] + t * t * p2z); }
    }
    P.tx = tx; P.tz = tz;
    return P.n > 1;
  }
  // 每個節點到 (tx, tz) 要開多遠（反方向的 Dijkstra；dist、prev＝下一個節點）→ 找生警車的地方用
  function toTarget(tx, tz, tHwy, solid, maxD) {
    st++; hs = 0;
    if (!project(tx, tz, 160, tHwy ? 1 : -1, solid, 0.9)) return false;
    const s1 = pick.s, a1 = G.sA[s1], b1 = G.sB[s1];
    relax(a1, Math.hypot(G.nx[a1] - pick.qx, G.nz[a1] - pick.qz) + pick.d, -1);
    if (G.sTwo[s1]) relax(b1, Math.hypot(G.nx[b1] - pick.qx, G.nz[b1] - pick.qz) + pick.d, -1);
    while (hs > 0) {
      const u = pop(); if (done[u] === st) continue; done[u] = st;
      if (dist[u] > maxD) break;
      for (let e = G.iStart[u]; e < G.iStart[u + 1]; e++) relax(G.iFrom[e], dist[u] + G.sLen[G.iSeg[e]], u);
    }
    return true;
  }
  const distOf = (n) => (seen[n] === st ? dist[n] : Infinity), nextOf = (n) => (seen[n] === st ? prev[n] : -1);
  return { route, project, pick, toTarget, distOf, nextOf };
}

// ---- 替身警車（police.js 的 makePoliceCar 還沒好之前用）：白色車身、藍色腰線寫「警察 POLICE」、車頂紅藍警示燈 ----
// 一台 3 個 draw call：車身（含車窗、輪子、字，頂點色＋一張小貼圖）、燈罩（頂點色，閃的時候改顏色）、光暈（加法混色）
let PC_SHARED = null;
function pcShared() {
  if (PC_SHARED) return PC_SHARED;
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let tex = null, glowTex = null;
  if (c) {
    c.width = 512; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#1f4fb4'; g.fillRect(0, 0, 512, 64); // 上半：藍色腰線＋白字
    g.fillStyle = '#ffffff'; g.font = `900 44px ${SANS}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText('警察', 70, 34);
    g.font = `700 36px ${COND}`; g.fillText('POLICE', 190, 35);
    g.fillStyle = '#ffffff'; g.fillRect(0, 60, 512, 4);
    tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const c2 = document.createElement('canvas'); c2.width = c2.height = 64; const g2 = c2.getContext('2d');
    const gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c2); glowTex.colorSpace = THREE.SRGBColorSpace;
  }
  // 車身：頂點色 × 貼圖（大部分的面貼圖取白色那一點，腰線取上半的字）
  const P = [], N = [], C = [], U = [];
  const WHITE_UV = [0.5, 0.2];
  const col = (h) => { const k = new THREE.Color(h); return [k.r, k.g, k.b]; };
  // quadRaw：a→b→c→d 從外面看是逆時針（法線＝(b−a)×(d−a) 朝外）
  const quadRaw = (a, b, c2, d, k, uv) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const uvs = uv || [WHITE_UV, WHITE_UV, WHITE_UV, WHITE_UV];
    for (const [p, t] of [[a, uvs[0]], [b, uvs[1]], [c2, uvs[2]], [a, uvs[0]], [c2, uvs[2]], [d, uvs[3]]]) { P.push(p[0], p[1], p[2]); N.push(nx, ny, nz); C.push(k[0], k[1], k[2]); U.push(t[0], t[1]); }
  };
  const quad = (a, b, c2, d, k) => quadRaw(a, d, c2, b, k); // 六面體、方塊的點是順時針排的：反過來
  // 六面體：8 個角（x0 後、x1 前；每個 x 各自的 y0 y1 z 半寬）→ 可以做斜的引擎蓋、車窗
  const hexa = (x0, x1, y00, y01, w0b, w0t, y10, y11, w1b, w1t, k, sides) => {
    const A = [x0, y00, -w0b], B = [x0, y00, w0b], Cc = [x0, y01, w0t], D = [x0, y01, -w0t], E2 = [x1, y10, -w1b], F = [x1, y10, w1b], G2 = [x1, y11, w1t], Hh = [x1, y11, -w1t];
    const s = sides || {};
    quad(E2, F, G2, Hh, s.front || k); quad(B, A, D, Cc, s.back || k); // 前、後
    quad(F, B, Cc, G2, s.right || k); quad(A, E2, Hh, D, s.left || k); // 右（+z）、左（−z）
    quad(Hh, G2, Cc, D, s.top || k); quad(A, B, F, E2, s.bottom || k);
  };
  const block = (x0, y0, z0, x1, y1, z1, k) => { // 方方正正的一塊（z0 < z1）
    const A = [x0, y0, z0], B = [x0, y0, z1], Cc = [x0, y1, z1], D = [x0, y1, z0], E2 = [x1, y0, z0], F = [x1, y0, z1], G2 = [x1, y1, z1], Hh = [x1, y1, z0];
    quad(E2, F, G2, Hh, k); quad(B, A, D, Cc, k); quad(F, B, Cc, G2, k); quad(A, E2, Hh, D, k); quad(Hh, G2, Cc, D, k); quad(A, B, F, E2, k);
  };
  const white = col('#f4f5f6'), glass = col('#1b2430'), dark = col('#26282c'), black = col('#141517'), head = col('#f2f4f8'), tail = col('#b0161b'), tyre = col('#151618'), rim = col('#9aa0a7');
  const L2 = 2.34, W2 = 0.9;
  hexa(-L2, L2, 0.3, 0.84, W2, W2 - 0.02, 0.32, 0.74, W2 - 0.06, W2 - 0.1, white); // 下半車身（車頭低一點）
  hexa(-L2 + 0.02, -1.25, 0.84, 0.98, W2 - 0.03, W2 - 0.06, 0.84, 0.98, W2 - 0.03, W2 - 0.06, white); // 行李箱
  hexa(0.95, L2 - 0.02, 0.74, 0.86, W2 - 0.1, W2 - 0.12, 0.74, 0.8, W2 - 0.1, W2 - 0.14, white); // 引擎蓋
  hexa(-1.3, 1.0, 0.84, 1.42, 0.84, 0.7, 0.84, 1.42, 0.84, 0.7, glass, { top: white }); // 車窗（上面是白色車頂）
  hexa(-0.95, 0.42, 1.42, 1.46, 0.72, 0.7, 1.42, 1.46, 0.72, 0.7, white); // 車頂
  hexa(-0.18, 0.2, 0.84, 1.43, 0.845, 0.705, 0.84, 1.43, 0.845, 0.705, white); // B 柱
  // 腰線：兩邊一條藍色，前門那一段貼「警察 POLICE」（從哪一邊看字都是正的：右邊車頭在右、左邊車頭在左）
  for (const s of [1, -1]) {
    const z = s * (W2 + 0.006), y0 = 0.5, y1 = 0.66;
    const band = (xa, xb, ua, ub) => { // xa < xb；ua、ub：xa、xb 那一頭的 u
      const A = [xa, y0, z], B = [xb, y0, z], Cq = [xb, y1, z], D = [xa, y1, z], uv = [[ua, 0.52], [ub, 0.52], [ub, 0.98], [ua, 0.98]];
      if (s > 0) quadRaw(A, B, Cq, D, [1, 1, 1], uv); else quadRaw(B, A, D, Cq, [1, 1, 1], [uv[1], uv[0], uv[3], uv[2]]);
    };
    band(-L2 + 0.05, -0.9, 0.02, 0.03); band(1.1, L2 - 0.1, 0.02, 0.03); // 藍色（字的左邊那一塊）
    if (s > 0) band(-0.9, 1.1, 0.1, 0.8); else band(-0.9, 1.1, 0.8, 0.1);
  }
  // 前後保險桿、燈
  hexa(L2 - 0.02, L2 + 0.08, 0.28, 0.5, W2 - 0.05, W2 - 0.08, 0.28, 0.5, W2 - 0.1, W2 - 0.12, dark);
  hexa(-L2 - 0.08, -L2 + 0.02, 0.28, 0.52, W2 - 0.08, W2 - 0.08, 0.28, 0.52, W2 - 0.05, W2 - 0.05, dark);
  for (const s of [1, -1]) {
    block(L2 - 0.1, 0.6, s > 0 ? 0.48 : -0.82, L2 + 0.012, 0.72, s > 0 ? 0.82 : -0.48, head); // 大燈
    block(-L2 - 0.012, 0.66, s > 0 ? 0.5 : -0.84, -L2 + 0.08, 0.8, s > 0 ? 0.84 : -0.5, tail); // 尾燈
    block(-0.2 + 0.9, 0.9, s > 0 ? 0.84 : -0.98, 0.9 - 0.02, 0.98, s > 0 ? 0.98 : -0.84, black); // 後照鏡
  }
  block(L2 - 0.03, 0.36, -0.55, L2 + 0.09, 0.48, 0.55, black); // 水箱罩
  block(-0.16, 1.46, -0.64, 0.16, 1.52, 0.64, black); // 警示燈座
  // 輪子：10 邊的圓柱（胎面朝外、兩邊的圓面、輪框）
  const wheel = (x, zc, s) => {
    const R = 0.33, Wd = 0.23, n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, b = ((i + 1) / n) * TAU, p = (t, zz) => [x + Math.cos(t) * R, R + Math.sin(t) * R, zz];
      quadRaw(p(a, zc - Wd / 2), p(b, zc - Wd / 2), p(b, zc + Wd / 2), p(a, zc + Wd / 2), tyre); // 胎面
      const cz = zc + (s * Wd) / 2, q = (t) => [x + Math.cos(t) * R * 0.62, R + Math.sin(t) * R * 0.62, cz + s * 0.002];
      if (s > 0) quadRaw(p(a, cz), p(b, cz), q(b), q(a), tyre); else quadRaw(p(b, cz), p(a, cz), q(a), q(b), tyre); // 外側的胎壁
      if (s > 0) quadRaw([x, R, cz + 0.004], q(a), q(b), q(b), rim); else quadRaw([x, R, cz - 0.004], q(b), q(a), q(a), rim); // 輪框
    }
  };
  for (const x of [1.42, -1.38]) for (const s of [1, -1]) wheel(x, s * 0.79, s);
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); bodyGeo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); bodyGeo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  bodyGeo.computeBoundingSphere();
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.38, metalness: 0.05 });
  PC_SHARED = { bodyGeo, bodyMat, glowTex, tex };
  return PC_SHARED;
}
function placeholderPoliceCar() {
  const S = pcShared(), group = new THREE.Group(); group.name = 'police-car';
  const body = new THREE.Mesh(S.bodyGeo, S.bodyMat); body.name = 'police-body'; group.add(body);
  // 燈罩：左紅右藍（左＝本地 −z）；閃的時候改頂點色
  const LP = [], LC = [], LN = [];
  const lensBox = (z0, z1, k) => {
    const x0 = -0.13, x1 = 0.13, y0 = 1.52, y1 = 1.63, v = [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]];
    const faces = [[4, 5, 6, 7, [1, 0, 0]], [1, 0, 3, 2, [-1, 0, 0]], [5, 1, 2, 6, [0, 0, 1]], [0, 4, 7, 3, [0, 0, -1]], [7, 6, 2, 3, [0, 1, 0]]];
    for (const [a, b, c, d, n] of faces) for (const i of [a, c, b, a, d, c]) { LP.push(...v[i]); LN.push(...n); LC.push(k, k, k); } // 點是順時針排的：反過來
  };
  lensBox(-0.62, -0.03, 0); lensBox(0.03, 0.62, 0);
  const lensGeo = new THREE.BufferGeometry(); lensGeo.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3)); lensGeo.setAttribute('normal', new THREE.Float32BufferAttribute(LN, 3));
  const lcol = new THREE.Float32BufferAttribute(new Float32Array(LC.length), 3); lensGeo.setAttribute('color', lcol); lensGeo.computeBoundingSphere();
  const lens = new THREE.Mesh(lensGeo, new THREE.MeshBasicMaterial({ vertexColors: true })); lens.name = 'police-lens'; group.add(lens);
  // 光暈：每個燈兩片交叉的方塊（從哪個角度看都有）＋一片平的；加法混色，關掉＝黑色（看不到）
  const GP = [], GU = [];
  const glowAt = (zc) => {
    const s = 0.95, y = 1.58;
    for (const [ax, az] of [[1, 0], [0, 1]]) { const a = [-ax * s, y - s, -az * s + zc], b = [ax * s, y - s, az * s + zc], c = [ax * s, y + s, az * s + zc], d = [-ax * s, y + s, -az * s + zc]; for (const [p, t] of [[a, [0, 0]], [b, [1, 0]], [c, [1, 1]], [a, [0, 0]], [c, [1, 1]], [d, [0, 1]]]) { GP.push(...p); GU.push(...t); } }
    const a = [-s, y, zc - s], b = [s, y, zc - s], c = [s, y, zc + s], d = [-s, y, zc + s]; for (const [p, t] of [[a, [0, 0]], [b, [1, 0]], [c, [1, 1]], [a, [0, 0]], [c, [1, 1]], [d, [0, 1]]]) { GP.push(...p); GU.push(...t); }
  };
  glowAt(-0.33); glowAt(0.33);
  const glowGeo = new THREE.BufferGeometry(); glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(GP, 3)); glowGeo.setAttribute('uv', new THREE.Float32BufferAttribute(GU, 2));
  const gcol = new THREE.Float32BufferAttribute(new Float32Array(GP.length), 3); glowGeo.setAttribute('color', gcol); glowGeo.computeBoundingSphere();
  const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ map: S.glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  glow.name = 'police-glow'; glow.renderOrder = 5; group.add(glow);
  const nL = LC.length / 6, nG = GP.length / 6; // 每個燈幾個頂點×3
  let on = false, t = 0, last = -1;
  const paint = (r, b) => { // r、b：紅、藍現在多亮（0–1）
    const la = lcol.array, ga = gcol.array;
    for (let i = 0; i < nL; i += 3) { la[i] = 0.25 + 0.75 * r; la[i + 1] = 0.02 + 0.1 * r; la[i + 2] = 0.03 + 0.08 * r; }
    for (let i = nL; i < la.length; i += 3) { la[i] = 0.02 + 0.2 * b; la[i + 1] = 0.05 + 0.4 * b; la[i + 2] = 0.3 + 0.7 * b; }
    for (let i = 0; i < nG; i += 3) { ga[i] = 1.0 * r; ga[i + 1] = 0.12 * r; ga[i + 2] = 0.1 * r; }
    for (let i = nG; i < ga.length; i += 3) { ga[i] = 0.12 * b; ga[i + 1] = 0.35 * b; ga[i + 2] = 1.0 * b; }
    lcol.needsUpdate = true; gcol.needsUpdate = true;
  };
  paint(0, 0); glow.visible = false;
  // 閃法（一輪 0.8 秒）：紅閃兩下、藍閃兩下
  const phase = (x) => (x < 0.09 ? 1 : x < 0.14 ? 2 : x < 0.23 ? 1 : x < 0.4 ? 0 : x < 0.49 ? 3 : x < 0.54 ? 0 : x < 0.63 ? 3 : 0);
  return {
    group,
    setLights(v) { on = !!v; glow.visible = on; if (!on) { paint(0, 0); last = -1; } },
    update(dt) {
      if (!on) return;
      t = (t + dt) % 0.8; const p = phase(t);
      if (p === last) return; last = p;
      paint(p === 1 ? 1 : 0.08, p === 3 ? 1 : 0.08);
    },
    dispose() { lensGeo.dispose(); lens.material.dispose(); glowGeo.dispose(); glow.material.dispose(); group.removeFromParent(); },
  };
}

// ---- 替身警察（character.js 還沒接上之前用）：深藍制服、帽子；API 跟 buildCharacter 一樣（group、radius、height、update(dt, { speed, state })）----
const OFFICER_LOOK = { body: 'm', age: 'adult', height: 1.76, build: 'mid', skin: '#d9a77f', hair: 'short', hairColor: '#141110', top: 'uniform', topColor: '#22375e', bottom: 'slacks', bottomColor: '#1a2436',
  shoes: 'leather', shoesColor: '#121212', hat: 'cap', hatColor: '#22375e', glasses: 'none', mask: false };
function placeholderOfficer() {
  const g = new THREE.Group(), mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 });
  const mTop = mat('#22375e'), mBot = mat('#1a2436'), mSkin = mat('#d9a77f'), mVest = mat('#c9f23a'), mShoe = mat('#111111');
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const root = new THREE.Group(); g.add(root);
  const torso = box(0.27, 0.56, 0.42, mTop); torso.position.y = 1.22; root.add(torso);
  const vest = box(0.285, 0.3, 0.44, mVest); vest.position.y = 1.28; root.add(vest); // 反光背心
  const head = box(0.22, 0.24, 0.2, mSkin); head.position.y = 1.62; root.add(head);
  const cap = box(0.25, 0.08, 0.23, mTop); cap.position.y = 1.77; root.add(cap);
  const brim = box(0.12, 0.02, 0.2, mTop); brim.position.set(0.15, 1.74, 0); root.add(brim);
  const limb = (z, y, len, m, foot) => { const p = new THREE.Group(); p.position.set(0, y, z); const b = box(0.13, len, 0.13, m); b.position.y = -len / 2; p.add(b); if (foot) { const f = box(0.26, 0.08, 0.13, mShoe); f.position.set(0.05, -len + 0.04, 0); p.add(f); } root.add(p); return p; };
  const legL = limb(-0.1, 0.94, 0.9, mBot, true), legR = limb(0.1, 0.94, 0.9, mBot, true), armL = limb(-0.28, 1.47, 0.66, mTop), armR = limb(0.28, 1.47, 0.66, mTop);
  let phase = 0, t = 0; const ONCE = { getup: 1.2, punch: 0.45, wave: 1.5 };
  const C = { group: g, height: 1.8, radius: 0.3, look: OFFICER_LOOK, state: 'idle',
    setLook() {},
    update(dt, a = {}) {
      const want = a.state || 'idle', speed = a.speed || 0;
      if (want !== C.state && !(ONCE[C.state] && t < ONCE[C.state] && want !== 'fall')) { C.state = want; t = 0; }
      t += dt; if (ONCE[C.state] && t >= ONCE[C.state]) { C.state = 'idle'; t = 0; }
      const st = C.state; phase += (speed / (st === 'run' ? 1.6 : 1.1)) * TAU * dt;
      const sw = st === 'walk' || st === 'run' ? Math.sin(phase) * (st === 'run' ? 0.95 : 0.5) : 0;
      legL.rotation.z = sw; legR.rotation.z = -sw; armL.rotation.z = -sw; armR.rotation.z = sw;
      root.rotation.z = st === 'fall' ? -Math.PI / 2 * Math.min(1, t / 0.35) : st === 'getup' ? -Math.PI / 2 * Math.max(0, 1 - t / ONCE.getup) : st === 'run' ? -0.18 : 0; // 往後倒、跑的時候身體往前傾
      root.position.y = st === 'fall' ? 0.15 * Math.min(1, t / 0.35) : 0;
      if (st === 'punch') armR.rotation.z = (Math.PI / 2) * Math.sin(Math.min(1, t / ONCE.punch) * Math.PI);
      if (st === 'wave') armL.rotation.x = -2.6 + Math.sin(t * 10) * 0.3; else armL.rotation.x = 0;
    },
    dispose() { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); [mTop, mBot, mSkin, mVest, mShoe].forEach((m) => m.dispose()); g.removeFromParent(); },
  };
  return C;
}

// ---- 警笛：台灣警車的兩段音（高、低交替、中間滑過去）；每台一個聲音，照距離變大聲、變悶、左右、都卜勒 ----
// 振盪器（鋸齒波＋方波高八度）→ 帶通 → 音量 → 低通（遠的悶）→ 左右 → 輸出；兩段音＝方波的 LFO 過低通（滑音）× 深度 → 振盪器的頻率
function makeSiren(ctx, out, seed) {
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(), osc2 = ctx.createOscillator(), lfo = ctx.createOscillator(), lfoLp = ctx.createBiquadFilter(), depth = ctx.createGain(), depth2 = ctx.createGain();
    const mix2 = ctx.createGain(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    let pan = null; try { pan = ctx.createStereoPanner(); } catch { pan = null; }
    const base = 760 + seed * 25; // 每台差一點點（三台一起叫會一前一後）
    osc.type = 'sawtooth'; osc.frequency.value = base; osc2.type = 'square'; osc2.frequency.value = base * 2;
    lfo.type = 'square'; lfo.frequency.value = 0.78 + seed * 0.06; // 一高一低一輪約 1.3 秒
    lfoLp.type = 'lowpass'; lfoLp.frequency.value = 5; lfoLp.Q.value = 0.5; // 滑過去（不是跳過去）
    depth.gain.value = 170; depth2.gain.value = 340;
    lfo.connect(lfoLp); lfoLp.connect(depth); lfoLp.connect(depth2); depth.connect(osc.frequency); depth2.connect(osc2.frequency);
    mix2.gain.value = 0.18;
    bp.type = 'bandpass'; bp.frequency.value = 1150; bp.Q.value = 0.9;
    lp.type = 'lowpass'; lp.frequency.value = 2000; lp.Q.value = 0.3;
    g.gain.value = 0;
    osc.connect(bp); osc2.connect(mix2); mix2.connect(bp); bp.connect(g); g.connect(lp);
    if (pan) { lp.connect(pan); pan.connect(out); } else lp.connect(out);
    osc.start(t); osc2.start(t); lfo.start(t);
    let dead = false;
    return {
      set(gain, cutoff, p, detune) {
        if (dead) return; const n = ctx.currentTime;
        g.gain.setTargetAtTime(gain, n, 0.08); lp.frequency.setTargetAtTime(cutoff, n, 0.1);
        if (pan) pan.pan.setTargetAtTime(p, n, 0.08);
        osc.detune.setTargetAtTime(detune, n, 0.08); osc2.detune.setTargetAtTime(detune, n, 0.08);
      },
      stop() {
        if (dead) return; dead = true;
        try { const n = ctx.currentTime; g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0, n, 0.15); osc.stop(n + 0.9); osc2.stop(n + 0.9); lfo.stop(n + 0.9); } catch { /* 算了 */ }
        setTimeout(() => { for (const nd of [osc, osc2, lfo, lfoLp, depth, depth2, mix2, bp, g, lp, pan]) try { nd && nd.disconnect(); } catch { /* 算了 */ } }, 1200);
      },
      get dead() { return dead; },
    };
  } catch { return null; }
}

// ---- HUD：上面中間的星星（通緝中）、快被抓的提示、被抓到、變黑、拘留室倒數 ----
const CSS = `
.pw{position:absolute;inset:0;pointer-events:none;color:#F2F3F5;font-family:${SANS};-webkit-user-select:none;user-select:none;z-index:5;overflow:hidden}
.pw[hidden],.pw [hidden]{display:none!important}
.pw>*{position:absolute}
.pw-want{top:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;height:38px;padding:0 15px 0 11px;border-radius:999px;background:rgba(14,15,18,0.8);white-space:nowrap;box-shadow:0 0 0 2px #FF3B30,0 0 16px rgba(255,59,48,.55);transition:box-shadow .12s}
.pw-want.b{box-shadow:0 0 0 2px #2F7BFF,0 0 16px rgba(47,123,255,.6)}
.pw-want .st{display:flex;gap:1px;font-size:24px;line-height:1;color:#FFD23F;text-shadow:0 1px 0 rgba(0,0,0,.5)}
.pw-want .st i{font-style:normal;color:rgba(242,243,245,.22);text-shadow:none}
.pw-want b{font-size:17px;font-weight:700;letter-spacing:.06em}
.pw-want.lost .st{animation:pw-blink 1s steps(2,start) infinite}
.pw-want.lost{box-shadow:0 0 0 2px rgba(242,243,245,.5)}
.pw-want.up{animation:pw-up .45s ease-out}
@keyframes pw-up{0%{transform:translateX(-50%) scale(1.3)}100%{transform:translateX(-50%) scale(1)}}
.pw-esc{position:absolute;left:14px;right:14px;bottom:3px;height:3px;border-radius:2px;background:rgba(242,243,245,.18);overflow:hidden}
.pw-esc i{display:block;height:100%;width:0;background:#3DDC84;border-radius:2px}
@keyframes pw-blink{50%{opacity:.25}}
.pw-catch{top:54px;left:50%;transform:translateX(-50%);min-width:190px;padding:7px 14px 9px;border-radius:14px;background:rgba(214,31,38,.92);text-align:center;font-size:16px;font-weight:700;letter-spacing:.04em;white-space:nowrap}
.pw-catch div{margin-top:5px;height:6px;border-radius:3px;background:rgba(255,255,255,.3);overflow:hidden}
.pw-catch div i{display:block;height:100%;width:0;background:#fff;border-radius:3px}
.pw-toast{top:calc(34% + 66px);left:50%;width:max-content;max-width:calc(100% - 32px);box-sizing:border-box;padding:12px 22px;border-radius:20px;background:rgba(14,15,18,.84);font-size:21px;font-weight:700;line-height:1.3;text-align:center;opacity:0;transform:translate(-50%,-50%) scale(.9);transition:opacity .15s,transform .15s}
.pw-toast.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.pw-toast.red{background:#D61F26;font-size:27px;padding:16px 26px;box-shadow:0 0 0 3px #fff,0 10px 30px rgba(0,0,0,.45)}
.pw-fade{inset:0;background:#000;opacity:0;transition:opacity .6s linear}
.pw-jail{top:max(18%,min(196px,calc(100% - 300px)));left:50%;transform:translateX(-50%);width:min(88%,330px);box-sizing:border-box;padding:16px 18px 18px;border-radius:22px;background:rgba(14,15,18,.9);text-align:center;pointer-events:auto;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.pw-jail small{display:block;font-size:14px;color:#C6CAD1;letter-spacing:.08em}
.pw-jail .cnt{display:block;margin:4px 0 8px;font-size:34px;font-weight:900;letter-spacing:.04em}
.pw-jail .cnt em{font:700 44px/1 ${COND};font-style:normal;color:#FFD23F;margin:0 4px;font-variant-numeric:tabular-nums}
.pw-jbar{height:8px;border-radius:4px;background:rgba(242,243,245,.16);overflow:hidden;margin:0 4px 14px}
.pw-jbar i{display:block;height:100%;width:100%;background:#FFD23F;border-radius:4px}
.pw-pay{display:block;width:100%;min-height:52px;border:0;border-radius:999px;background:#FF6A1F;color:#1A0F07;font:700 18px/1.2 ${SANS};letter-spacing:.03em;box-shadow:0 5px 0 #9E4213;cursor:pointer;touch-action:manipulation}
.pw-pay:active{transform:translateY(4px);box-shadow:0 1px 0 #9E4213}
.pw-pay:disabled{background:#3A3D44;color:#9AA1AC;box-shadow:0 5px 0 #23262D;cursor:default}
.pw-pay:focus-visible{outline:3px solid #F2F3F5;outline-offset:3px}
.pw-jail p{margin:10px 0 0;font-size:14px;line-height:1.5;color:#C6CAD1}
.pw-host .dv-chip,.pw-host .dv-act,.pw-host .dv-map,.pw-host .dv-cam,.pw-host .wk-chip,.pw-host .wk-act,.pw-host .wk-map,.pw-host .wk-cam{transition:margin-top .2s}
.pw-host.pw-on .dv-chip,.pw-host.pw-on .dv-act,.pw-host.pw-on .dv-map,.pw-host.pw-on .dv-cam,.pw-host.pw-on .wk-chip,.pw-host.pw-on .wk-act,.pw-host.pw-on .wk-map,.pw-host.pw-on .wk-cam{margin-top:46px}
@media (prefers-reduced-motion:reduce){.pw-want.lost .st,.pw-want.up{animation:none}.pw-toast{transition:none}.pw-fade{transition:opacity .2s linear}}
`;

// ---- 路面種類（village.js 的 surfaceAt）：2 公尺一格，第一次問到才算（之後查表，不再叫 surfaceAt）----
function makeSurf(V) {
  const f = typeof V.surfaceAt === 'function' ? V.surfaceAt : null;
  if (!f) return () => 0;
  const b = V.bounds || { x0: -1100, x1: 20, z0: -540, z1: 540 }, CS = 2, x0 = b.x0 - 40, z0 = b.z0 - 40;
  const nx = Math.ceil((b.x1 - b.x0 + 80) / CS), nz = Math.ceil((b.z1 - b.z0 + 80) / CS), A = new Uint8Array(nx * nz).fill(255);
  return (x, z) => {
    const i = Math.floor((x - x0) / CS), j = Math.floor((z - z0) / CS);
    if (i < 0 || j < 0 || i >= nx || j >= nz) return f(x, z);
    const k = j * nx + i; let v = A[k];
    if (v === 255) v = A[k] = f(x0 + (i + 0.5) * CS, z0 + (j + 0.5) * CS);
    return v;
  };
}

// ==== 警察 ====
function createPolice(o = {}) {
  const V = o.world || {}, scene = o.scene || null, T = { ...TUNE, ...(o.tune || {}), add: { ...TUNE.add, ...((o.tune && o.tune.add) || {}) } };
  const hasDoc = typeof document !== 'undefined' && !!o.hudParent && typeof o.hudParent.append === 'function';
  const G = policeNavGraph(V), R = makeRouter(G);
  const allCols = (V.colliders || []).concat(o.colliders || []);
  const solid = makeGrid(allCols, 1.6); // 車、人撞的（線段測試胖 1.6 公尺以內都找得到）
  const tall = makeGrid(allCols, 0, (c) => (c.h ?? 9) >= 2.4 && (c.t === 'box' || c.r >= 0.6)); // 擋住視線的（房子、牆、大樹）
  const surf = makeSurf(V);
  const gy = typeof V.heightAt === 'function' && typeof V.terrainAt === 'function' ? (x, z) => (V.terrainAt(x, z) ? V.heightAt(x, z) : 0) : () => 0; // 山（mountain.js）、越野車場：地面多高
  const places = V.places || {};
  let rs = (o.seed >>> 0) || 0x9e3779b9; const rnd = () => { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return ((rs >>> 0) % 100000) / 100000; };

  // ---- 警察局：拘留室、門口、停車場、警車從哪裡出來（police.js 放在 V.places.police；頁面也可以用 jail 給）----
  const PP = places.police || {};
  const pose = (p) => (p && isFinite(p.x) && isFinite(p.z) ? { x: +p.x, z: +p.z, heading: +(p.heading ?? p.ry ?? 0) } : null);
  const J = o.jail || {};
  const station = {
    cell: pose(J.cell) || pose(PP.cell),
    door: pose(J.door) || pose(PP.door) || pose(PP.spawn),
    yard: pose(J.yard) || pose(PP.yard) || pose(PP.park) || pose(PP.spawn),
    spawn: pose(J.spawn) || pose(PP.carSpawn) || pose(PP.exit) || pose(PP.spawn),
    setCellDoor: typeof J.setCellDoor === 'function' ? J.setCellDoor : typeof PP.setCellDoor === 'function' ? PP.setCellDoor : null,
  };

  // ---- 玩家（每一幀讀一次）：躲起來（hidden）、在店裡（off）的時候位置不動＝警察只知道你最後在哪裡 ----
  const PL_IN = { mode: 'off', x: 0, z: 0, heading: 0, v: 0, car: null, safe: false, hidden: false };
  const P = { mode: 'off', x: 0, z: 0, th: 0, v: 0, fx: 1, fz: 0, rx: 0, rz: 1, vx: 0, vz: 0, spd: 0, cx: 0, cz: 0, hl: 2.2, hw: 0.9, carCx: 0, safe: false, hidden: false, hwy: false, ok: false, px: 0, pz: 0 };
  function readPlayer(dt) {
    let p = null; try { p = o.getPlayer ? o.getPlayer(PL_IN) : null; } catch { p = null; }
    if (!p || !isFinite(p.x) || !isFinite(p.z)) { P.ok = false; return; }
    P.mode = p.mode === 'walk' || p.mode === 'off' ? p.mode : 'drive';
    P.safe = !!p.safe; P.hidden = !!p.hidden;
    if ((P.hidden || P.mode === 'off') && P.ok) { P.vx = 0; P.vz = 0; P.v = 0; P.spd = 0; return; }
    const first = !P.ok; P.ok = true;
    P.th = +p.heading || 0; P.fx = Math.cos(P.th); P.fz = -Math.sin(P.th); P.rx = -P.fz; P.rz = P.fx;
    const car = P.mode === 'drive' ? p.car || null : null;
    P.hl = car ? +car.hx || 2.2 : 0.3; P.hw = car ? +car.hz || 0.9 : 0.3; P.carCx = car ? +car.cx || 0 : 0;
    P.x = +p.x; P.z = +p.z; P.cx = P.x + P.fx * P.carCx; P.cz = P.z + P.fz * P.carCx; // 車身中心
    if (!first && dt > 0) { const vx = (P.cx - P.px) / dt, vz = (P.cz - P.pz) / dt, k = 1 - Math.exp(-dt * 8); if (vx * vx + vz * vz < 150 * 150) { P.vx += (vx - P.vx) * k; P.vz += (vz - P.vz) * k; } }
    else { P.vx = 0; P.vz = 0; }
    P.px = P.cx; P.pz = P.cz;
    P.v = isFinite(p.v) ? +p.v : Math.hypot(P.vx, P.vz); P.spd = Math.abs(P.v);
    P.hwy = surf(P.cx, P.cz) === 4;
  }

  // ---- 腳印（你走過、開過的地方；警察看不到你就照這個追）：每 1.2 公尺一點，最多 256 點 ----
  const CR = 256, crX = new Float64Array(CR), crZ = new Float64Array(CR); let crN = 0, crH = 0;
  function crumb() {
    const last = (crH - 1 + CR) % CR;
    if (crN && Math.hypot(P.cx - crX[last], P.cz - crZ[last]) < 1.2) return;
    crX[crH] = P.cx; crZ[crH] = P.cz; crH = (crH + 1) % CR; if (crN < CR) crN++;
  }

  // ---- 狀態 ----
  let everSeen = false, huntT = 0; // 第 3 批（b3-int）：這次通緝警察看到過你沒有、還沒看到過的秒數（甩開的計時從被看到才開始）
  let enabled = true, alive = true, state = 'free', wanted = 0, heat = 0, seenNow = false, lastX = 0, lastZ = 0, catchP = 0, T0 = 0, spawnT = 0, safeT = 0;
  let phaseT = 0, jailLeft = 0, jailFine = 0, jailStars = 0, paid = false, hudFaded = false, relDone = false, slotT = 0, sndT = 0, yardT = 0, dropped = false;
  const lastCrime = {}, crimes = []; let arrests = 0, escapes = 0;
  const perf = { n: 0, sum: 0, max: 0, last: 0 };

  // 警車（固定 MAXC 台，重複用）；police.js 的車（或替身）第一次用到才做
  const cars = [];
  for (let i = 0; i < MAXC; i++) cars.push({
    id: i, on: false, model: null, group: null, hl: 2.35, hw: 0.92, L: 2.8,
    x: 0, z: 0, th: 0, v: 0, steer: 0, pitch: 0, roll: 0,
    mode: 'go', path: mkPath(900), rt: 0, losT: 0, seen: false, clear: false, d: 999, role: -1, slot: -1, slotDone: false,
    stuck: 0, exitCool: 0, offT: 0, offOk: true, manOn: false, manT: 0, manN: 0, manD: 0, manS: 0, manB: 0, manCool: 0, ancX: 0, ancZ: 0, ancT: 0, wantV: 0, waitT: 0, touch: 0, pathOff: 0,
    officer: null, siren: null, lights: false, hitCool: 0, homeT: 0, age: 0, dist: 0, wreckT: 0, wreckA: 0, // wreckT：第 9 批（被越野車輾扁）還留幾秒
    stats: { stuckMax: 0, relocs: 0, bumps: 0, recov: 0, stuckSec: 0, manSec: 0, shots: 0 },
  });
  const offs = []; // 警察（一台一個）
  for (let i = 0; i < MAXC; i++) offs.push({ id: i, car: cars[i], ch: null, pose: { speed: 0, state: 'idle' }, on: false, st: 'in', x: 0, z: 0, th: 0, v: 0, thinkT: 0, tx: 0, tz: 0, seen: false, direct: false, final: false, downT: 0, backT: 0, wp: mkPath(400), wn: 0, wi: 0, planT: 0, gx: 0, gz: 0 });
  for (let i = 0; i < MAXC; i++) cars[i].officer = offs[i];
  // 給 drive.js／walk.js 的碰撞、小地圖的點（固定的物件，每幀改值）
  const colOut = [], colPool = [];
  const movers = []; for (let i = 0; i < MAXC; i++) movers.push({ t: 'box', x: 0, z: 0, hx: 0, hz: 0, rot: 0, h: 1.6, police: true });
  for (let i = 0; i < MAXC; i++) movers.push({ t: 'circle', x: 0, z: 0, r: 0, h: 1.8, police: true });
  const npcCars = []; for (let i = 0; i < MAXC; i++) npcCars.push({ id: 'police' + i, x: 1e6, z: 1e6, heading: 0, v: 0, hx: 2.3, hz: 0.9, ai: true, police: true }); // npc.js 的車的格式（沒出來的放很遠）
  const markers = []; for (let i = 0; i < MAXC; i++) markers.push({ x: 0, z: 0, fill: '#FF3B30', ring: '#FFFFFF', r: 5, on: false });
  const markerList = []; // 現在有的（drive.setMarkers／walker.setMarkers 讀這個陣列）

  // ---- 犯罪 ----
  const CRIME_MSG = { punch: '你揍人了！警察來了', hit: '你撞到人了！警察來了', cop: '你惹到警察了！', shoot: '你開槍打人了！警察全部出動', shootCop: '你開槍打警察了！', gunfire: '你開槍了！警察來了',
    crush: '你把別人的東西輾扁了！警察來了', crushCop: '你把警車輾扁了！' }; // crushCop：第 9 批 // 第 7 批：怪獸卡車輾東西（越野車場裡面不算：呼叫的人不報）
  function nearestPolice(x, z) {
    let best = Infinity;
    for (const c of cars) if (c.on) { const d = Math.hypot(c.x - x, c.z - z); if (d < best) best = d; }
    for (const f of offs) if (f.on) { const d = Math.hypot(f.x - x, f.z - z); if (d < best) best = d; }
    return best;
  }
  function crime(type, pos) {
    if (!alive || !enabled || state === 'caught' || state === 'jail' || state === 'release') return wanted; // 第 3 批（b3-int）：關掉的時候（比賽中）沒人管
    const add = T.add[type]; if (add == null) return wanted;
    const x = pos && isFinite(pos.x) ? +pos.x : P.cx, z = pos && isFinite(pos.z) ? +pos.z : P.cz;
    if (type === 'gunfire' && !(nearestPolice(x, z) <= T.gunfireR)) return wanted; // 附近沒有警察：沒人管
    if (lastCrime[type] != null && T0 - lastCrime[type] < T.cool) return wanted; // 同一件事好幾幀、連發：算一次
    lastCrime[type] = T0;
    const before = wanted;
    wanted = type === 'shoot' ? 3 : Math.min(3, wanted + add);
    crimes.push({ t: +T0.toFixed(2), type, x: +x.toFixed(1), z: +z.toFixed(1), stars: wanted }); if (crimes.length > 40) crimes.shift();
    lastX = x; lastZ = z; heat = 0; dropped = false;
    if (state === 'free') { state = 'wanted'; spawnT = 0.3; everSeen = false; huntT = 0; }
    if (wanted > before) { hud.flash(); toast(CRIME_MSG[type] || '警察來了！', 2200); }
    return wanted;
  }

  // ---- 警車：做、放、收 ----
  function ensureModel(c) {
    if (c.model) return;
    let m = null; try { m = o.makePoliceCar ? o.makePoliceCar() : null; } catch (e) { console.warn('police: makePoliceCar', e); m = null; }
    if (!m || !m.group) m = placeholderPoliceCar();
    c.model = m; c.group = m.group; c.group.rotation.order = 'YXZ';
    c.group.position.set(0, 0, 0); c.group.rotation.set(0, 0, 0); c.group.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(c.group); // 車子大小：放在原點量
    if (isFinite(b.min.x) && b.max.x - b.min.x > 2) { c.hl = (b.max.x - b.min.x) / 2; c.hw = Math.min(1.2, Math.max(0.7, (b.max.z - b.min.z) / 2)); }
    c.L = c.hl * 1.2;
    c.group.visible = false;
    if (scene) scene.add(c.group);
  }
  function footprintFree(x, z, th, hl, hw, self) {
    const fx = Math.cos(th), fz = -Math.sin(th), r = Math.hypot(hl, hw) + 0.3;
    const list = solid.near(x - r, z - r, x + r, z + r);
    for (let i = 0; i < list.length; i++) { const c = list[i]; if (c.box ? boxPush(x, z, fx, fz, hl + 0.2, hw + 0.2, c) : circlePush(x, z, fx, fz, hl + 0.2, hw + 0.2, c.x, c.z, c.r)) return false; }
    for (const c of cars) if (c.on && c !== self && Math.hypot(c.x - x, c.z - z) < hl + c.hl + 1.5) return false;
    if (P.ok && Math.hypot(P.cx - x, P.cz - z) < hl + P.hl + 2) return false;
    return true;
  }
  function placeCar(c, x, z, th, v) {
    ensureModel(c);
    c.on = true; c.x = x; c.z = z; c.th = th; c.v = v; c.steer = 0; c.mode = 'go'; c.rt = 0; c.losT = rnd() * 0.25; c.stuck = 0; c.manOn = false; c.manT = 0; c.manN = 0; c.slot = -1; c.age = 0; c.homeT = 0;
    c.ancX = x; c.ancZ = z; c.ancT = 0; c.wantV = 0; c.waitT = 0; c.pathOff = 0; c.seen = false; c.clear = false; c.d = Math.hypot(P.cx - x, P.cz - z);
    c.path.n = 0; c.path.ok = false; c.lights = true; if (c.model.setLights) c.model.setLights(true);
    c.group.visible = enabled; poseCar(c);
    hideOfficer(c.officer);
  }
  function removeCar(c) {
    c.on = false; if (c.group) { c.group.visible = false; c.group.scale.set(1, 1, 1); } c.wreckT = 0; c.wreckA = 0; // 第 9 批：輾扁的變回原狀（下次出來是好的）
    if (c.model && c.model.setLights) c.model.setLights(false); c.lights = false;
    if (c.siren) { c.siren.stop(); c.siren = null; }
    hideOfficer(c.officer);
  }
  // 生一台：警察局 600 公尺內就從警察局開出來；不然找 200–400 公尺外（照路開）、你看不到的路
  function spawnCar() {
    CNT.spawn++;
    let c = null; for (const k of cars) if (!k.on) { c = k; break; }
    if (!c || !P.ok) return false;
    ensureModel(c);
    const sp = station.spawn;
    if (sp && Math.hypot(sp.x - P.cx, sp.z - P.cz) < T.stationR && footprintFree(sp.x, sp.z, sp.heading, c.hl, c.hw, c)) { placeCar(c, sp.x, sp.z, sp.heading, 4); return true; }
    if (!R.toTarget(P.cx, P.cz, P.hwy, solid, T.spawnMax + 250)) return false;
    let best = -1, bs = Infinity;
    for (let n = 0; n < G.N; n++) {
      const d = R.distOf(n); if (!(d >= 120 && d <= T.spawnMax + 200)) continue;
      const x = G.nx[n], z = G.nz[n], sd = Math.hypot(x - P.cx, z - P.cz);
      let s = Math.abs(d - (T.spawnMin + T.spawnMax) / 2) * (d < T.spawnMin || d > T.spawnMax ? 3 : 1);
      if (sd < 110) s += 400; // 太近（路繞很遠、直線很近）
      if (sd < T.seeR && !tall.blocked(P.cx, P.cz, x, z, 0)) { const a = Math.abs(wrapA(Math.atan2(-(z - P.cz), x - P.cx) - P.th)); s += a < 1.6 ? 300 : 60; } // 你看得到（前面最明顯）
      for (const k of cars) if (k.on && Math.hypot(k.x - x, k.z - z) < 40) s += 250;
      s += rnd() * 40;
      if (s < bs) { const nx = R.nextOf(n); if (nx < 0) continue; const th = Math.atan2(-(G.nz[nx] - z), G.nx[nx] - x); if (!footprintFree(x, z, th, c.hl, c.hw, c)) continue; bs = s; best = n; }
    }
    if (best < 0) return false;
    const nx = R.nextOf(best), th = Math.atan2(-(G.nz[nx] - G.nz[best]), G.nx[nx] - G.nx[best]);
    placeCar(c, G.nx[best], G.nz[best], th, 14);
    if (replan(c, P.cx, P.cz, P.hwy, true)) { const Pp = c.path; let v = 14; for (let k = 0; k < Pp.n && Pp.cum[k] < 30; k++) if (Pp.vl[k] < v) v = Pp.vl[k]; c.v = v; } // 前面有彎：一出來就慢一點
    return true;
  }
  function relocate(c) { // 卡住很久、太遠：換到 200–400 公尺外的路上重新來（找不到地方就放回原地）
    if (!c.on) return;
    const x = c.x, z = c.z, th = c.th;
    removeCar(c);
    if (!spawnCar()) placeCar(c, x, z, th, 0);
    c.stats.relocs++;
  }

  // ---- 開車（每一步 h 秒）：目標方向盤、目標速度 → 動、碰撞 ----
  function drivePhys(c, h, steerT, vT) {
    const vab = Math.abs(c.v), maxS = 0.55, rate = 3.2 - 2 * clamp(vab / 45, 0, 1);
    const kmax = vab > 1 ? T.alat / (vab * vab) : Infinity, sLim = Math.min(maxS, Math.atan(kmax * c.L)); // 側向加速度不超過 alat
    const sT = clamp(steerT, -sLim, sLim); c.steer += clamp(sT - c.steer, -rate * h, rate * h);
    const sf = surf(c.x, c.z), cap = sf === 1 ? 50 / 3.6 : sf === 2 ? 16 / 3.6 : Infinity, vt = Math.min(vT, cap); // 草地、稻田開不快
    let a;
    if (c.v >= -0.1 && vt >= 0) a = vt > c.v ? Math.min(T.acc * (1 - Math.pow(clamp(c.v / (T.vfar * 1.05), 0, 1), 2)), (vt - c.v) * 3) : -Math.min(T.brake, (c.v - vt) * 4 + 1);
    else if (vt < 0) a = vt < c.v ? -Math.min(4, (c.v - vt) * 3) : Math.min(T.brake, (vt - c.v) * 3 + 0.5); // 倒車
    else a = Math.min(T.brake, -c.v * 3 + 0.5);
    const v0 = c.v; c.v += a * h; if (v0 > 0 && c.v < 0 && vt >= 0) c.v = 0; if (v0 < 0 && c.v > 0 && vt <= 0) c.v = 0;
    c.pitch += (clamp(-a * 0.004, -0.035, 0.03) - c.pitch) * Math.min(1, h * 8);
    const k = Math.tan(c.steer) / c.L; c.th = wrapA(c.th - c.v * k * h); // 腳踏車模型：右轉 steer > 0 → heading 變小
    c.roll += (clamp(c.v * c.v * k * 0.004, -0.05, 0.05) - c.roll) * Math.min(1, h * 6);
    c.x += Math.cos(c.th) * c.v * h; c.z -= Math.sin(c.th) * c.v * h;
    c.dist += Math.abs(c.v) * h;
    collideCar(c);
  }
  function hitResp(c, nx, nz, vf = 0) { // 撞進去的速度吃掉、車頭往沿著牆的方向轉一點；vf：撞到的東西（你的車、別的警車）沿著這台車頭方向在走多快
    const fx = Math.cos(c.th), fz = -Math.sin(c.th), fn = fx * nx + fz * nz;
    const vb = fn < 0 && c.v > 0 ? clamp(vf, 0, c.v) : 0, vr = c.v - vb; // 追撞前面同方向在走的車：只吃掉比它快的那一點（不會一撞就停住）；對撞、被後面的車撞：照舊停下來（不會被推著走、還是擋在你前面）
    if (vr * fn < 0) {
      const w = Math.abs(vr * fn); c.v = vb + vr * Math.max(0, 1 - Math.abs(fn) * 1.05); if (w > 3 && T0 - (c.bumpT || 0) > 0.4) { c.bumpT = T0; c.stats.bumps++; }
      const tx = -nz, tz = nx, ft = fx * tx + fz * tz;
      if (Math.abs(ft) > 0.2) { const want = Math.atan2(-(tz * Math.sign(ft)), tx * Math.sign(ft)); c.th = wrapA(c.th + clamp(wrapA(want - c.th), -0.04, 0.04)); }
    }
  }
  const TMPB = { box: true, x: 0, z: 0, hx: 1, hz: 1, ux: 1, uz: 0, wx: 0, wz: 1 };
  function setBox(b, x, z, th, hl, hw) { b.x = x; b.z = z; b.hx = hl; b.hz = hw; b.ux = Math.cos(th); b.uz = -Math.sin(th); b.wx = Math.sin(th); b.wz = Math.cos(th); return b; }
  function collideCar(c) {
    for (let it = 0; it < 3; it++) {
      const fx = Math.cos(c.th), fz = -Math.sin(c.th); let moved = false;
      const list = solid.near(c.x - 3.5, c.z - 3.5, c.x + 3.5, c.z + 3.5);
      for (let i = 0; i < list.length; i++) {
        const q = list[i];
        if (!(q.box ? boxPush(c.x, c.z, fx, fz, c.hl, c.hw, q) : circlePush(c.x, c.z, fx, fz, c.hl, c.hw, q.x, q.z, q.r))) continue;
        c.x += OUT[0]; c.z += OUT[1]; moved = true; c.touch = 0.25; hitResp(c, OUT[2], OUT[3]);
      }
      for (const k of cars) { // 別的警車（各推一半）
        if (k === c || !k.on || Math.abs(k.x - c.x) > 7 || Math.abs(k.z - c.z) > 7) continue;
        setBox(TMPB, k.x, k.z, k.th, k.hl, k.hw);
        if (!boxPush(c.x, c.z, fx, fz, c.hl, c.hw, TMPB)) continue;
        c.x += OUT[0] * 0.5; c.z += OUT[1] * 0.5; k.x -= OUT[0] * 0.5; k.z -= OUT[1] * 0.5; moved = true; hitResp(c, OUT[2], OUT[3], k.v * (Math.cos(k.th) * fx - Math.sin(k.th) * fz));
      }
      if (P.ok && P.mode === 'drive' && Math.abs(P.cx - c.x) < 8 && Math.abs(P.cz - c.z) < 8) { // 你的車（你不會被推：推警車）
        setBox(TMPB, P.cx, P.cz, P.th, P.hl, P.hw);
        if (boxPush(c.x, c.z, fx, fz, c.hl, c.hw, TMPB)) { c.x += OUT[0]; c.z += OUT[1]; moved = true; hitResp(c, OUT[2], OUT[3], P.vx * fx + P.vz * fz); }
      } else if (P.ok && P.mode === 'walk' && !P.hidden && Math.abs(P.cx - c.x) < 6 && Math.abs(P.cz - c.z) < 6) { // 走路的你：停下來、不壓過去
        if (circlePush(c.x, c.z, fx, fz, c.hl, c.hw, P.cx, P.cz, 0.4)) { c.x += OUT[0]; c.z += OUT[1]; c.v = 0; moved = true; }
      }
      if (o.obstacles) { // 路上的車（traffic）
        let ob = null; try { ob = o.obstacles(c.x, c.z, 8); } catch { ob = null; }
        if (ob) for (let i = 0; i < ob.length; i++) { const b = ob[i]; if (!b || !(b.hx > 0) || b.police) continue; setBox(TMPB, b.x, b.z, b.rot || 0, b.hx, b.hz); if (boxPush(c.x, c.z, fx, fz, c.hl, c.hw, TMPB)) { c.x += OUT[0]; c.z += OUT[1]; moved = true; hitResp(c, OUT[2], OUT[3]); } }
      }
      if (!moved) break;
    }
  }

  // ---- 追：沿著路線（pure pursuit）→ 目標方向盤、速度 ----
  const FO = { gx: 0, gz: 0, v: 0, s: 0, t: 0, off: 0, left: 0, ld: 6 };
  function followPath(c, out) {
    const Pp = c.path; if (!Pp.ok) return false;
    let bi = Pp.i, bd = Infinity; out.t = 0;
    for (let i = Pp.i; i < Pp.n - 1 && i < Pp.i + 30; i++) { // 現在在路線上的哪裡（往前找）
      const ax = Pp.x[i], az = Pp.z[i], dx = Pp.x[i + 1] - ax, dz = Pp.z[i + 1] - az, L2 = dx * dx + dz * dz, t = L2 > 1e-9 ? clamp(((c.x - ax) * dx + (c.z - az) * dz) / L2, 0, 1) : 0;
      const ex = ax + dx * t - c.x, ez = az + dz * t - c.z, d = ex * ex + ez * ez;
      if (d < bd) { bd = d; bi = i; out.t = t; }
    }
    Pp.i = bi; const s = Pp.cum[bi] + (Pp.cum[bi + 1] - Pp.cum[bi]) * out.t;
    out.off = Math.sqrt(bd);
    const Ld = clamp(4.5 + 0.42 * Math.abs(c.v), 6, 30); out.ld = Ld; // 往前看多遠
    let j = bi; const sl = s + Ld; while (j < Pp.n - 2 && Pp.cum[j + 1] < sl) j++;
    const sl2 = Math.min(sl, Pp.len), seg = Pp.cum[j + 1] - Pp.cum[j], tt = seg > 1e-6 ? clamp((sl2 - Pp.cum[j]) / seg, 0, 1) : 1;
    out.gx = Pp.x[j] + (Pp.x[j + 1] - Pp.x[j]) * tt; out.gz = Pp.z[j] + (Pp.z[j + 1] - Pp.z[j]) * tt;
    let v = Pp.vl[bi] + (Pp.vl[bi + 1] - Pp.vl[bi]) * out.t; // 速限：這一點＋前面 0.45 秒會開到的（煞車慢半拍）
    const sv = s + Math.max(2, Math.abs(c.v) * 0.45); for (let k = bi + 1; k < Pp.n && Pp.cum[k] <= sv; k++) if (Pp.vl[k] < v) v = Pp.vl[k];
    out.v = v; out.s = s; out.left = Pp.len - s;
    c.pathOff = out.off;
    return true;
  }
  // 路線上 s 公尺那一點（PT.x、PT.z）和方向（PT.tx、PT.tz）
  const PT = { x: 0, z: 0, tx: 1, tz: 0 };
  function pathAt(Pp, s) {
    let j = 0; if (s > 0) { j = Pp.i; while (j > 0 && Pp.cum[j] > s) j--; while (j < Pp.n - 2 && Pp.cum[j + 1] < s) j++; }
    const L = Pp.cum[j + 1] - Pp.cum[j], t = L > 1e-6 ? clamp((s - Pp.cum[j]) / L, 0, 1) : 1;
    PT.x = Pp.x[j] + (Pp.x[j + 1] - Pp.x[j]) * t; PT.z = Pp.z[j] + (Pp.z[j + 1] - Pp.z[j]) * t;
    PT.tx = L > 1e-6 ? (Pp.x[j + 1] - Pp.x[j]) / L : 1; PT.tz = L > 1e-6 ? (Pp.z[j + 1] - Pp.z[j]) / L : 0;
    return PT;
  }
  // 往前看的點開不過去：路線上有東西（樹、柱子）→ 在那裡往旁邊閃；路線沒被擋，只是轉角切太多 → 看近一點
  const DODGE = [1.8, -1.8, 3.0, -3.0];
  function clearGoal(c) {
    const r = c.hw + 0.3, Pp = c.path; // 車角轉彎會掃出去：胖一點
    if (!solid.blocked(c.x, c.z, FO.gx, FO.gz, r)) return 0;
    let sObs = -1; // 路線上被擋住的地方（沿著路線幾公尺）
    pathAt(Pp, FO.s); let ax = PT.x, az = PT.z, sa = FO.s;
    const sEnd = FO.s + FO.ld + 4;
    for (let k = Pp.i + 1; k < Pp.n && sa < sEnd && sObs < 0; k++) {
      const bx = Pp.x[k], bz = Pp.z[k], L = Math.hypot(bx - ax, bz - az);
      if (L > 1e-6 && solid.blocked(ax, az, bx, bz, r)) { // 這一段被擋住：2 公尺一小段找到在哪裡
        for (let t = 0; t < L; t += 2) { const t1 = Math.min(L, t + 2); if (solid.blocked(ax + ((bx - ax) * t) / L, az + ((bz - az) * t) / L, ax + ((bx - ax) * t1) / L, az + ((bz - az) * t1) / L, r)) { sObs = sa + t + 1; break; } }
        if (sObs < 0) sObs = sa + L * 0.5;
      }
      ax = bx; az = bz; sa = Pp.cum[k];
    }
    if (sObs < 0) { for (let q = 0; q < 2; q++) { pathAt(Pp, FO.s + Math.max(4, FO.ld * (q === 0 ? 0.55 : 0.3))); if (!solid.blocked(c.x, c.z, PT.x, PT.z, r)) { FO.gx = PT.x; FO.gz = PT.z; return 1; } } return 1; }
    pathAt(Pp, Math.max(sObs, FO.s + 3) + 2.5);
    const x = PT.x, z = PT.z, tx = PT.tx, tz = PT.tz;
    for (let q = 0; q < DODGE.length; q++) { const gx = x - tz * DODGE[q], gz = z + tx * DODGE[q]; if (!solid.blocked(c.x, c.z, gx, gz, r)) { FO.gx = gx; FO.gz = gz; FO.v = Math.min(FO.v, 9); return 2; } }
    return 1;
  }
  // 沿著路線開的方向盤：Stanley（前輪到路線的距離＋跟路線方向差多少：轉角不會切太多）；路線上有東西要閃：往閃的那一點開
  function pathSteer(c) {
    const k = clearGoal(c);
    if (k === 2) return steerTo(c, FO.gx, FO.gz);
    const Pp = c.path, fx = Math.cos(c.th), fz = -Math.sin(c.th), lf = c.L * 0.5, ax0 = c.x + fx * lf, az0 = c.z + fz * lf;
    let bi = Pp.i, bd = Infinity, bt = 0;
    for (let i = Pp.i; i < Pp.n - 1 && i < Pp.i + 14; i++) {
      const ax = Pp.x[i], az = Pp.z[i], dx = Pp.x[i + 1] - ax, dz = Pp.z[i + 1] - az, L2 = dx * dx + dz * dz, t = L2 > 1e-9 ? clamp(((ax0 - ax) * dx + (az0 - az) * dz) / L2, 0, 1) : 0;
      const ex = ax + dx * t - ax0, ez = az + dz * t - az0, d = ex * ex + ez * ez;
      if (d < bd) { bd = d; bi = i; bt = t; }
    }
    const px = Pp.x[bi] + (Pp.x[bi + 1] - Pp.x[bi]) * bt, pz = Pp.z[bi] + (Pp.z[bi + 1] - Pp.z[bi]) * bt, s = Pp.cum[bi] + (Pp.cum[bi + 1] - Pp.cum[bi]) * bt;
    pathAt(Pp, s + Math.abs(c.v) * T.stanPre); // 方向盤轉得慢：看前面一點點的方向
    const er = (px - ax0) * -fz + (pz - az0) * fx; // 路線在前輪右邊幾公尺
    return wrapA(c.th - Math.atan2(-PT.tz, PT.tx)) + Math.atan2(T.stanK * er, Math.abs(c.v) + 1.5);
  }
  function steerTo(c, gx, gz) { // pure pursuit：往 (gx, gz) 的方向盤角度（右正）
    const fx = Math.cos(c.th), fz = -Math.sin(c.th), dx = gx - c.x, dz = gz - c.z, fwd = dx * fx + dz * fz, lat = dx * -fz + dz * fx, L2 = dx * dx + dz * dz;
    if (L2 < 1e-4) return 0;
    if (fwd < 0 && c.v >= 0) return lat >= 0 ? 0.55 : -0.55; // 在後面：打滿轉過去
    return Math.atan((2 * c.L * lat) / Math.max(L2, 4));
  }
  function pathGoal(c, vT) { // 路線前面 8 公尺那一點放在 PT（轉頭用）；往前看的點在側邊、後面：先慢下來（再倒車、轉頭）
    if (Math.abs(wrapA(Math.atan2(-(FO.gz - c.z), FO.gx - c.x) - c.th)) > T.manIn) vT = Math.min(vT, 2);
    pathAt(c.path, FO.s + 8);
    return vT;
  }
  function curvTo(c, gx, gz) { // 開到 (gx, gz) 要轉多急（1/公尺）；在後面 → 很急
    const fx = Math.cos(c.th), fz = -Math.sin(c.th), dx = gx - c.x, dz = gz - c.z, L2 = dx * dx + dz * dz;
    if (L2 < 1) return 0;
    if (dx * fx + dz * fz < 0) return 1 / 5;
    return (2 * Math.abs(dx * -fz + dz * fx)) / L2;
  }

  // ---- 圍住的位置（你開車慢下來）：前、後、左、右 ----
  const SLOT = new Float64Array(8), USED = new Uint8Array(4), OKS = new Uint8Array(4);
  function slotsFor() {
    const gF = P.hl + 2.35 + 0.9, gS = P.hw + 0.92 + 0.8;
    SLOT[0] = P.cx + P.fx * gF; SLOT[1] = P.cz + P.fz * gF; // 前
    SLOT[2] = P.cx - P.fx * gF; SLOT[3] = P.cz - P.fz * gF; // 後
    SLOT[4] = P.cx - P.rx * gS; SLOT[5] = P.cz - P.rz * gS; // 左
    SLOT[6] = P.cx + P.rx * gS; SLOT[7] = P.cz + P.rz * gS; // 右
  }
  function footprintFreeStatic(x, z, th, hl, hw) {
    const fx = Math.cos(th), fz = -Math.sin(th), r = Math.hypot(hl, hw) + 0.3, list = solid.near(x - r, z - r, x + r, z + r);
    for (let i = 0; i < list.length; i++) { const c = list[i]; if (c.box ? boxPush(x, z, fx, fz, hl, hw, c) : circlePush(x, z, fx, fz, hl, hw, c.x, c.z, c.r)) return false; }
    return surf(x, z) !== 2;
  }
  function assignSlots() { // 每台找最近的空位置（近的先挑；前後比左右好）
    for (let k = 0; k < 4; k++) { USED[k] = 0; OKS[k] = footprintFreeStatic(SLOT[k * 2], SLOT[k * 2 + 1], P.th, 2.2, 0.85) ? 1 : 0; }
    for (let pass = 0; pass < MAXC; pass++) {
      let c = null; for (const k of cars) if (k.on && k.mode !== 'home' && !k.slotDone && (!c || k.d < c.d)) c = k;
      if (!c) break; c.slotDone = true;
      let best = -1, bd = Infinity;
      for (let k = 0; k < 4; k++) { if (USED[k] || !OKS[k]) continue; const d = Math.hypot(SLOT[k * 2] - c.x, SLOT[k * 2 + 1] - c.z) + (k === c.slot ? -4 : 0) + (k >= 2 ? 3 : 0); if (d < bd) { bd = d; best = k; } }
      c.slot = best; if (best >= 0) USED[best] = 1;
    }
    for (const k of cars) k.slotDone = false;
  }
  // 線段 (x0, z0) → (x1, z1) 會不會穿過你的車（胖 m 公尺）
  function crossesPlayer(x0, z0, x1, z1, m) { setBox(TMPB, P.cx, P.cz, P.th, P.hl, P.hw); return segHits(TMPB, x0, z0, x1 - x0, z1 - z0, m); }

  // ---- 每台車想一下（看不看得到你、直直開不開得到：0.25 秒一次）----
  function thinkCar(c, dt) {
    c.d = Math.hypot(P.cx - c.x, P.cz - c.z);
    c.losT -= dt; if (c.losT > 0) return;
    c.losT = 0.25;
    const look = P.ok && !P.hidden && P.mode !== 'off';
    c.seen = look && (c.d < T.nearR || (c.d < T.seeR && !tall.blocked(c.x, c.z, P.cx, P.cz, 0)));
    c.clear = look && c.d < 90 && arcFree(c, P.cx, P.cz) && ARC.bad <= (c.d < 25 ? 2 : 0); // 開過去的弧線上沒東西、沒有稻田（草地一點點可以）
  }
  // 從車子現在的位置、方向，方向盤固定轉到 (gx, gz) 的那條圓弧（慢的時候：直線）有沒有撞到東西；ARC.bad：弧線上的草地、稻田
  // 開很快、你在側邊：弧線很大、會切過路邊的柱子、房子 → 不直直追（照路線開，路線會先減速）
  const ARC = { bad: 0 };
  function arcFree(c, gx, gz) {
    ARC.bad = 0;
    const fx = Math.cos(c.th), fz = -Math.sin(c.th), rx = -fz, rz = fx, dx = gx - c.x, dz = gz - c.z;
    const fwd = dx * fx + dz * fz, lat = dx * rx + dz * rz, L2 = dx * dx + dz * dz, L = Math.sqrt(L2), slow = Math.abs(c.v) < 4;
    if (L < 1) return true;
    if (fwd <= 0 && !slow) return false; // 在後面、開很快：掉頭不能直直來
    const al = Math.abs(lat), k = (2 * al) / L2, ang = 2 * Math.atan2(al, fwd), sg = lat >= 0 ? 1 : -1, straight = slow || k < 1e-4;
    const n = Math.max(2, Math.min(18, Math.ceil((straight ? L : ang / k) / 5))), pOff = surf(P.cx, P.cz);
    let px = c.x, pz = c.z;
    for (let i = 1; i <= n; i++) {
      let x, z;
      if (straight) { x = c.x + (dx * i) / n; z = c.z + (dz * i) / n; }
      else { const a = (ang * i) / n, lf = Math.sin(a) / k, ll = ((1 - Math.cos(a)) / k) * sg; x = c.x + fx * lf + rx * ll; z = c.z + fz * lf + rz * ll; }
      if (solid.blocked(px, pz, x, z, 1.0)) return false;
      if (i < n) { const s = surf(x, z); if (s === 2 && pOff !== 2) ARC.bad += 2; else if (s === 1 && pOff !== 1 && pOff !== 2) ARC.bad++; }
      px = x; pz = z;
    }
    return true;
  }
  // ---- 卡住了：倒車怎麼倒（方向盤左、右、正，模擬一下：倒得出去、之後往前開得到目標方向的那個）----
  function poseFree(c, x, z, th) { // 車子放在這裡會不會撞到東西（房子、樹、別的警車、你的車）
    const fx = Math.cos(th), fz = -Math.sin(th), hl = c.hl - 0.05, hw = c.hw - 0.05, r = Math.hypot(hl, hw) + 0.3;
    const list = solid.near(x - r, z - r, x + r, z + r);
    for (let i = 0; i < list.length; i++) { const q = list[i]; if (q.box ? boxPush(x, z, fx, fz, hl, hw, q) : circlePush(x, z, fx, fz, hl, hw, q.x, q.z, q.r)) return false; }
    for (const k of cars) { if (k === c || !k.on || Math.abs(k.x - x) > 6 || Math.abs(k.z - z) > 6) continue; setBox(TMPB, k.x, k.z, k.th, k.hl, k.hw); if (boxPush(x, z, fx, fz, hl, hw, TMPB)) return false; }
    if (P.ok && P.mode === 'drive' && Math.abs(P.cx - x) < 7 && Math.abs(P.cz - z) < 7) { setBox(TMPB, P.cx, P.cz, P.th, P.hl, P.hw); if (boxPush(x, z, fx, fz, hl, hw, TMPB)) return false; }
    return true;
  }
  // 慢慢開一小段（dir +1 往前、−1 倒車；方向盤固定 sT，pp＝往 (gx, gz) 轉）→ RP：撞到之前停在哪裡、走了多遠、幾秒、有沒有撞到
  const RP = { x: 0, z: 0, th: 0, st: 0, d: 0, t: 0, hit: false };
  function simDrive(c, x, z, th, st, sT, dir, tMax, gx, gz, pp) {
    let v = 0, d = 0, t = 0; const hs = 0.1; RP.hit = false;
    for (; t < tMax - 1e-6; t += hs) {
      let want = sT;
      if (pp) { const fx = Math.cos(th), fz = -Math.sin(th), ex = gx - x, ez = gz - z, fw = ex * fx + ez * fz, lt = ex * -fz + ez * fx, l2 = ex * ex + ez * ez; want = fw < 0 ? (lt >= 0 ? 0.55 : -0.55) : clamp(Math.atan((2 * c.L * lt) / Math.max(l2, 4)), -0.55, 0.55); }
      st += clamp(want - st, -0.32, 0.32); v = dir * Math.min(3.2, Math.abs(v) + 0.4);
      const nth = wrapA(th - v * (Math.tan(st) / c.L) * hs), nx = x + Math.cos(nth) * v * hs, nz = z - Math.sin(nth) * v * hs;
      if (!poseFree(c, nx, nz, nth)) { RP.hit = true; break; }
      x = nx; z = nz; th = nth; d += Math.abs(v) * hs;
    }
    RP.x = x; RP.z = z; RP.th = th; RP.st = st; RP.d = d; RP.t = t;
  }
  // ---- 慢慢倒車、轉頭（三點掉頭）：要去的地方在旁邊、後面，或卡住了 ----
  // 每一小段：往前／倒車 × 方向盤左、右、正（往前多一個：往目標轉）模擬 1.3 秒，挑轉完最對準目標、離目標近、沒撞到的
  const MAN_S = [0.55, -0.55, 0, 9];
  function planManeuver(c, gx, gz) {
    CNT.plan++;
    let bs = -Infinity, bd = 0, bS = 0, bt = 0;
    for (let dir = 1; dir >= -1; dir -= 2) for (let q = 0; q < 4; q++) {
      const pp = MAN_S[q] === 9; if (pp && dir < 0) continue;
      simDrive(c, c.x, c.z, c.th, c.steer, pp ? 0 : MAN_S[q], dir, 1.3, gx, gz, pp);
      if (RP.d < 0.3) continue;
      const e = Math.abs(wrapA(Math.atan2(-(gz - RP.z), gx - RP.x) - RP.th)), dist = Math.hypot(gx - RP.x, gz - RP.z);
      const sc = -1.6 * e - 0.12 * dist + (dir > 0 ? 0.25 : 0) + 0.1 * RP.d - (RP.hit ? 0.3 : 0);
      if (sc > bs) { bs = sc; bd = dir; bS = pp ? 9 : MAN_S[q]; bt = RP.t; }
    }
    c.manN++;
    if (bs === -Infinity) { c.manT = 0; return false; }
    c.manD = bd; c.manS = bS; c.manT = Math.max(0.3, bt * 0.92); c.manB = 0;
    return true;
  }
  function maneuver(c, h, gx, gz) { // true＝這一步在倒車、轉頭（已經開了）
    if (c.manT > 0) {
      c.manT -= h;
      c.manB = Math.abs(c.v) < 0.3 ? c.manB + h : 0; // 被擋住了：換下一段
      if (c.manB > 0.35) c.manT = 0;
      else { drivePhys(c, h, c.manS === 9 ? steerTo(c, gx, gz) : c.manS, c.manD * 3); return true; }
    }
    const err = Math.abs(wrapA(Math.atan2(-(gz - c.z), gx - c.x) - c.th));
    if ((err < T.manOut && c.manN > 0) || c.manN > 10) { c.manOn = false; c.manN = 0; c.rt = 0; return false; } // 轉好了（或試太多次）：照平常開
    if (!planManeuver(c, gx, gz)) { c.manCool = 0.6; c.manOn = false; c.manN = 0; return false; }
    drivePhys(c, h, c.manS === 9 ? steerTo(c, gx, gz) : c.manS, c.manD * 3);
    return true;
  }
  const TMPP = mkPath(900), MX = new Float64Array(900), MZ = new Float64Array(900), RO = { solid: null, onHwy: false, tHwy: false, lane: 0, uturn: 0, toTarget: true }; // 重算路線用（大家輪流用）
  function replan(c, tx, tz, tHwy, toTarget) {
    CNT.replan++;
    const Pp = c.path; let keep = false, sx = c.x, sz = c.z, sth = c.th, m = 0;
    if (Pp.ok && Math.abs(c.v) > 1 && followPath(c, FO) && FO.off < 3) { // 還在路線上：前面這一段照舊（轉彎轉到一半不會換路）
      const ahead = clamp(Math.abs(c.v) * 0.9, 6, 30), s0 = FO.s + ahead;
      if (FO.left > ahead + 4) {
        MX[m] = c.x; MZ[m] = c.z; m++;
        let k = Pp.i + 1; for (; k < Pp.n && Pp.cum[k] < s0 && m < 400; k++) { MX[m] = Pp.x[k]; MZ[m] = Pp.z[k]; m++; }
        const L = Pp.cum[k] - Pp.cum[k - 1], t = L > 1e-6 ? clamp((s0 - Pp.cum[k - 1]) / L, 0, 1) : 1;
        sx = Pp.x[k - 1] + (Pp.x[k] - Pp.x[k - 1]) * t; sz = Pp.z[k - 1] + (Pp.z[k] - Pp.z[k - 1]) * t; sth = Math.atan2(-(Pp.z[k] - Pp.z[k - 1]), Pp.x[k] - Pp.x[k - 1]);
        keep = true;
      }
    }
    const onHwy = surf(sx, sz) === 4, opt = RO; opt.solid = solid; opt.onHwy = onHwy; opt.tHwy = tHwy; opt.lane = onHwy ? 0 : 1.6; opt.uturn = Math.abs(c.v) > 8 ? 60 : 12; opt.toTarget = toTarget;
    opt.tth = P.ok && P.mode === 'drive' && P.spd > 2 && Math.hypot(tx - P.cx, tz - P.cz) < 30 ? P.th : NaN; opt.far = 300; // 追開車的你：投影到你開的那條路上
    let ok = false;
    if (keep && R.route(TMPP, sx, sz, sth, tx, tz, opt)) { // 舊的前面那一段＋新的
      Pp.n = 0; for (let i = 0; i < m; i++) pathAdd(Pp, MX[i], MZ[i]);
      for (let i = 0; i < TMPP.n; i++) pathAdd(Pp, TMPP.x[i], TMPP.z[i]);
      Pp.tx = tx; Pp.tz = tz; ok = Pp.n > 1;
    } else { opt.onHwy = surf(c.x, c.z) === 4; opt.lane = opt.onHwy ? 0 : 1.6; ok = R.route(Pp, c.x, c.z, c.th, tx, tz, opt); }
    const endFar = ok && toTarget && Math.hypot(Pp.x[Pp.n - 1] - tx, Pp.z[Pp.n - 1] - tz) > 8; // 路線到不了你旁邊（最後一段被擋住）
    if ((!ok || endFar) && toTarget && Math.hypot(tx - c.x, tz - c.z) < 400 && !solid.blocked(c.x, c.z, tx, tz, c.hw + 0.2)) { // 你在路網外面（田裡、賽道上），直直開得到：直直開過去
      Pp.n = 0; pathAdd(Pp, c.x, c.z); pathAdd(Pp, tx, tz); Pp.tx = tx; Pp.tz = tz; ok = true;
    }
    if (ok) pathFinish(Pp, T.alat * 0.8, T.comf, T.vfar); else { Pp.n = 0; Pp.ok = false; }
    c.rt = 2.5 + rnd() * 0.6;
    return ok;
  }
  const CNT = { spawn: 0, replan: 0, plan: 0 }; // 測試用：做了幾次比較貴的事
  function homeRoute(c) { // 回警察局；沒有警察局：開去離你 250–480 公尺的路上（看不到了就收掉）
    c.rt = 3;
    const hp = station.spawn;
    if (hp) { replan(c, hp.x, hp.z, false, true); return; }
    if (!P.ok || !R.toTarget(P.cx, P.cz, P.hwy, solid, 480)) return;
    let best = -1, bs = Infinity;
    for (let n = 0; n < G.N; n++) { const d = R.distOf(n); if (!(d >= 250 && d <= 480)) continue; const s = Math.hypot(G.nx[n] - c.x, G.nz[n] - c.z) + rnd() * 30; if (s < bs) { bs = s; best = n; } }
    if (best >= 0) replan(c, G.nx[best], G.nz[best], G.nHwy[best] === 1, false);
  }

  function stepCar(c, h) {
    const f = c.officer;
    let sT = 0, vT = 0, mg = false, mgx = 0, mgz = 0; // mg：要去的地方（慢慢倒車、轉頭的時候用）
    const vcap = !c.seen && c.d > 220 ? T.vfar : T.vmax; // 離很遠、看不到你：快一點追上來
    c.touch -= h; c.manCool -= h;
    if (c.mode === 'home') {
      if (followPath(c, FO)) { sT = pathSteer(c); vT = Math.min(FO.v, 16, Math.sqrt(2 * T.comf * Math.max(0, FO.left - 3))); vT = pathGoal(c, vT); mg = true; mgx = PT.x; mgz = PT.z; }
    } else if (!P.ok || P.mode === 'off' || state !== 'wanted' || f.on) {
      vT = 0; // 你在店裡、被抓了、警察下車了：車停著
    } else if (P.mode === 'walk' || P.hidden) { // 走路的你（或躲起來了：開到最後看到的地方）：停在 9 公尺外
      if (c.clear && c.d < 60) { sT = steerTo(c, P.cx, P.cz); vT = c.d < 9.5 ? 0 : Math.min(vcap, Math.sqrt(2 * T.comf * (c.d - 9))); mg = true; mgx = P.cx; mgz = P.cz; }
      else if (followPath(c, FO)) { sT = pathSteer(c); vT = Math.min(FO.v, vcap, Math.sqrt(2 * T.comf * Math.max(0, FO.left - 10))); vT = pathGoal(c, vT); mg = true; mgx = PT.x; mgz = PT.z; }
    } else if (c.clear && c.d < 70) { // 開車的你，近了、直直開得到
      if (P.spd < 4 && c.slot >= 0) { // 你慢下來了：開到自己的位置，前後左右圍住
        let gx = SLOT[c.slot * 2], gz = SLOT[c.slot * 2 + 1];
        const ds = Math.hypot(gx - c.x, gz - c.z);
        if (ds < 1.2) { sT = steerTo(c, gx + P.fx * 3, gz + P.fz * 3); vT = 0; }
        else {
          if (crossesPlayer(c.x, c.z, gx, gz, c.hw + 0.5)) { // 位置在你的車的另一邊：先開到旁邊
            const sd = (c.x - P.cx) * P.rx + (c.z - P.cz) * P.rz >= 0 ? 1 : -1, lon = clamp((gx - P.cx) * P.fx + (gz - P.cz) * P.fz, -P.hl, P.hl) * 0.6, w = P.hw + c.hw + 1.4;
            gx = P.cx + P.rx * sd * w + P.fx * lon; gz = P.cz + P.rz * sd * w + P.fz * lon;
          }
          sT = steerTo(c, gx, gz); vT = Math.min(vcap, 1.2 + Math.sqrt(2 * T.comf * Math.max(0, ds - 0.6)));
          if (c.d < c.hl + P.hl + 0.6) vT = Math.min(vT, 2.5);
          mg = true; mgx = gx; mgz = gz;
        }
      } else {
        const role = c.role, lead = clamp(c.d / Math.max(6, Math.abs(c.v) + 2), 0, 1.3);
        let gx = P.cx + P.vx * lead, gz = P.cz + P.vz * lead;
        const ahead = (c.x - P.cx) * P.fx + (c.z - P.cz) * P.fz, sd = (c.x - P.cx) * P.rx + (c.z - P.cz) * P.rz >= 0 ? 1 : -1; // ahead 負的＝在你後面
        const close = Math.max(0, c.d - (c.hl + P.hl + 1.2));
        vT = Math.min(vcap, Math.max(0, P.spd + Math.min(close * 1.2, Math.sqrt(12 * close), 30))); // 追上來：離越近越接近你的速度（煞得住，不會一直撞上去）
        const px = gx, pz = gz, v0 = vT;
        if (role === 1 && P.spd > 3) { // 第二台：從旁邊超過去、切到你前面
          if (ahead < P.hl + c.hl + 5) { const w = P.hw + c.hw + 1.3; gx += P.rx * sd * w + P.fx * (8 + 0.5 * P.spd); gz += P.rz * sd * w + P.fz * (8 + 0.5 * P.spd); vT = Math.min(vcap, P.spd + 7); }
          else { gx += P.fx * (6 + 0.4 * P.spd); gz += P.fz * (6 + 0.4 * P.spd); vT = Math.max(0, P.spd - 1.5); } // 在你前面了：慢一點擋住你
        } else if (role === 2) { gx += P.rx * sd * 3.2; gz += P.rz * sd * 3.2; } // 第三台：從旁邊夾
        else if (c.d < 14 && ahead < 0) vT = Math.min(vT, P.spd + 2.5); // 第一台：貼在後面，不要用力撞
        if (role >= 1 && (gx !== px || gz !== pz)) { // 旁邊、前面那一點直直開過去會撞到東西（柱子、路燈）：先跟在你後面
          c.offT -= h; if (c.offT <= 0) { c.offT = 0.12; c.offOk = !solid.blocked(c.x, c.z, gx, gz, c.hw + 0.15); }
          if (!c.offOk) { gx = px; gz = pz; vT = v0; }
        }
        sT = steerTo(c, gx, gz); mg = true; mgx = gx; mgz = gz;
        const kk = curvTo(c, gx, gz); if (kk > 1e-4) vT = Math.min(vT, Math.max(4, Math.sqrt((T.alat * 0.85) / kk))); // 要轉的彎太急：先減速
      }
    } else if (followPath(c, FO)) { // 沿著路開過來
      sT = pathSteer(c); vT = Math.min(FO.v, vcap);
      if (FO.left < 30) vT = Math.min(vT, P.spd + Math.sqrt(2 * T.comf * Math.max(0, FO.left - 4)));
      vT = pathGoal(c, vT); mg = true; mgx = PT.x; mgz = PT.z;
    }
    // 慢、要去的地方在側邊或後面（或卡住了）：一小段一小段倒車、轉頭
    if (mg && vT > 1) {
      if (!c.manOn && c.manCool <= 0 && Math.abs(c.v) < 2.5 && Math.abs(wrapA(Math.atan2(-(mgz - c.z), mgx - c.x) - c.th)) > T.manIn) { c.manOn = true; c.manT = 0; c.manN = 0; }
      if (c.manOn && maneuver(c, h, mgx, mgz)) { c.wantV = 2; return; }
    } else if (c.manOn) { c.manOn = false; c.manN = 0; c.manT = 0; }
    const fx = Math.cos(c.th), fz = -Math.sin(c.th);
    for (const k of cars) { // 前面有別的警車：跟車
      if (k === c || !k.on) continue;
      const dx = k.x - c.x, dz = k.z - c.z, ah = dx * fx + dz * fz, lat = Math.abs(dx * -fz + dz * fx);
      if (ah > 0 && ah < 16 && lat < 2.4) vT = Math.min(vT, Math.max(0, Math.max(0, k.v * Math.cos(k.th - c.th)) + (ah - c.hl - k.hl - 2) * 0.8));
    }
    if (o.obstacles && vT > 2) { // 路上的車：從左邊超過去（左邊擋住換右邊；都擋住就跟在後面）
      const la = 7 + Math.abs(c.v) * 0.9;
      let ob = null; try { ob = o.obstacles(c.x + fx * la * 0.5, c.z + fz * la * 0.5, la * 0.5 + 3); } catch { ob = null; }
      let bA = Infinity, bx = 0, bz = 0, bw = 0, bg = 0;
      if (ob) for (let i = 0; i < ob.length; i++) {
        const b = ob[i]; if (!b || !(b.hx > 0) || b.police) continue;
        const dx = b.x - c.x, dz = b.z - c.z, ah = dx * fx + dz * fz, lat = dx * -fz + dz * fx, rel = (b.rot || 0) - c.th, cr = Math.abs(Math.cos(rel)), sr = Math.abs(Math.sin(rel));
        const wl = b.hx * sr + b.hz * cr, hlg = b.hx * cr + b.hz * sr;
        if (ah <= 0 || ah - hlg - c.hl > la || Math.abs(lat) > c.hw + wl + 0.4) continue;
        if (ah < bA) { bA = ah; bx = b.x; bz = b.z; bw = wl; bg = ah - hlg - c.hl; }
      }
      if (bA < Infinity) {
        const w = c.hw + bw + 0.9; let ok = false;
        for (let q = 0; q < 2 && !ok; q++) {
          const sd = q === 0 ? -1 : 1, gx = bx - fz * sd * w, gz = bz + fx * sd * w;
          if (!solid.blocked(c.x, c.z, gx, gz, c.hw + 0.1)) { sT = steerTo(c, gx + fx * 4, gz + fz * 4); ok = true; }
        }
        if (!ok) vT = Math.min(vT, Math.max(0, bg - 2) * 0.9);
      }
    }
    c.wantV = vT;
    drivePhys(c, h, sT, vT);
  }

  // ---- 警察（下車跑）----
  function ensureOfficer(f) {
    if (f.ch) return;
    let ch = null; try { ch = o.makeOfficer ? o.makeOfficer() : null; } catch (e) { console.warn('police: makeOfficer', e); ch = null; }
    if (!ch || !ch.group) ch = placeholderOfficer();
    f.ch = ch; f.ch.group.visible = false; if (scene) scene.add(ch.group);
  }
  function hideOfficer(f) { f.on = false; f.st = 'in'; f.v = 0; if (f.ch) f.ch.group.visible = false; }
  // 先把 3 台警車、3 個警察做好：沒事的時候（沒有星星）每 0.25 秒做一個；或載入的時候叫 police.preload() 一次做完 → 第一次犯罪那一幀不會卡一下
  let warmI = 0, warmT = 1.5;
  function warmOne() { if (warmI >= MAXC * 2) return false; const k = warmI++; if (k < MAXC) ensureModel(cars[k]); else ensureOfficer(offs[k - MAXC]); return true; }
  function preload(renderer, camera) { // renderer, camera（可省略）：順便編譯 shader（先暫時打開、compile、再藏起來）
    while (warmOne()) { /* 全部做好 */ }
    if (!renderer || !renderer.compile || !scene || !camera) return;
    const vis = [];
    for (const c of cars) if (c.group && !c.group.visible) { c.group.visible = true; if (c.model.setLights) c.model.setLights(true); vis.push(c); }
    for (const f of offs) if (f.ch && !f.ch.group.visible) { f.ch.group.visible = true; vis.push(f); }
    try { renderer.compile(scene, camera); } catch (e) { console.warn('police: compile', e); }
    for (const q of vis) { if (q.group) { q.group.visible = false; if (q.model.setLights) q.model.setLights(false); } else q.ch.group.visible = false; }
  }
  function personFree(x, z, r) {
    const list = solid.near(x - r, z - r, x + r, z + r);
    for (let i = 0; i < list.length; i++) { const c = list[i]; if (c.box ? circleVsBox(x, z, r, c) : Math.hypot(x - c.x, z - c.z) < r + c.r) return false; }
    return true;
  }
  function officerOut(f) { // 駕駛座那邊（左）下車；擋住就右邊
    ensureOfficer(f);
    const c = f.car, fx = Math.cos(c.th), fz = -Math.sin(c.th), rx = -fz, rz = fx;
    let x = c.x - rx * (c.hw + 0.55) + fx * 0.3, z = c.z - rz * (c.hw + 0.55) + fz * 0.3;
    if (!personFree(x, z, 0.3)) { x = c.x + rx * (c.hw + 0.55) + fx * 0.3; z = c.z + rz * (c.hw + 0.55) + fz * 0.3; }
    f.on = true; f.st = 'out'; f.x = x; f.z = z; f.th = Math.atan2(-(P.cz - z), P.cx - x); f.v = 0; f.thinkT = 0; f.tx = P.cx; f.tz = P.cz; f.backT = 0; f.seen = true;
    f.ch.group.visible = enabled;
  }
  function collidePerson(f, r) {
    for (let it = 0; it < 3; it++) {
      let moved = false;
      const list = solid.near(f.x - r - 0.1, f.z - r - 0.1, f.x + r + 0.1, f.z + r + 0.1);
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c.box) { if (circleVsBox(f.x, f.z, r, c)) { f.x += OUT[0]; f.z += OUT[1]; moved = true; } }
        else { const dx = f.x - c.x, dz = f.z - c.z, d = Math.hypot(dx, dz), rr = r + c.r; if (d < rr && d > 1e-6) { f.x += (dx / d) * (rr - d); f.z += (dz / d) * (rr - d); moved = true; } }
      }
      for (const k of cars) { if (!k.on || Math.abs(k.x - f.x) > 4 || Math.abs(k.z - f.z) > 4) continue; setBox(TMPB, k.x, k.z, k.th, k.hl, k.hw); if (circleVsBox(f.x, f.z, r, TMPB)) { f.x += OUT[0]; f.z += OUT[1]; moved = true; } }
      for (const g of offs) { if (g === f || !g.on || g.st === 'in') continue; const dx = f.x - g.x, dz = f.z - g.z, d = Math.hypot(dx, dz); if (d < 2 * r && d > 1e-6) { f.x += (dx / d) * (2 * r - d) * 0.5; f.z += (dz / d) * (2 * r - d) * 0.5; } }
      if (P.ok && P.mode === 'drive' && Math.abs(P.cx - f.x) < 5 && Math.abs(P.cz - f.z) < 5) { setBox(TMPB, P.cx, P.cz, P.th, P.hl, P.hw); if (circleVsBox(f.x, f.z, r, TMPB)) { f.x += OUT[0]; f.z += OUT[1]; moved = true; } }
      if (!moved) break;
    }
  }
  // ---- 警察跑步的路線：牆擋住、你的腳印也都擋住 → 身邊 38 公尺的格子（0.6 公尺一格）找路（A*）----
  const GN = 64, GC = 0.6, GR = 0.36, GNN = GN * GN;
  const gOcc = new Uint8Array(GNN), gG = new Float32Array(GNN), gPrev = new Int32Array(GNN), gSeen = new Int32Array(GNN), gDone = new Int32Array(GNN);
  const gHN = new Int32Array(GNN * 4), gHK = new Float32Array(GNN * 4), gPath = new Int32Array(GNN); let gSt = 0, gHs = 0;
  const gPush = (n, k) => { if (gHs >= gHN.length) return; let i = gHs++; while (i > 0) { const p = (i - 1) >> 1; if (gHK[p] <= k) break; gHN[i] = gHN[p]; gHK[i] = gHK[p]; i = p; } gHN[i] = n; gHK[i] = k; };
  const gPop = () => { const top = gHN[0]; gHs--; if (gHs > 0) { const n = gHN[gHs], k = gHK[gHs]; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= gHs) break; if (c + 1 < gHs && gHK[c + 1] < gHK[c]) c++; if (gHK[c] >= k) break; gHN[i] = gHN[c]; gHK[i] = gHK[c]; i = c; } gHN[i] = n; gHK[i] = k; } return top; };
  function gMark(x0, z0, q) { // 碰撞物（胖 GR）蓋到的格子
    const ex = q.ex + GR, ez = q.ez + GR;
    const i0 = Math.max(0, Math.floor((q.x - ex - x0) / GC)), i1 = Math.min(GN - 1, Math.floor((q.x + ex - x0) / GC)), j0 = Math.max(0, Math.floor((q.z - ez - z0) / GC)), j1 = Math.min(GN - 1, Math.floor((q.z + ez - z0) / GC));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = x0 + (i + 0.5) * GC - q.x, cz = z0 + (j + 0.5) * GC - q.z;
      if (q.box ? Math.abs(cx * q.ux + cz * q.uz) <= q.hx + GR && Math.abs(cx * q.wx + cz * q.wz) <= q.hz + GR : cx * cx + cz * cz <= (q.r + GR) * (q.r + GR)) gOcc[j * GN + i] = 1;
    }
  }
  function pedBlocked(x0, z0, x1, z1) { // 人直直跑過去會不會撞到東西（房子、牆、警車）
    if (solid.blocked(x0, z0, x1, z1, 0.25)) return true;
    const dx = x1 - x0, dz = z1 - z0;
    for (const k of cars) { if (!k.on) continue; setBox(TMPB, k.x, k.z, k.th, k.hl, k.hw); if (segHits(TMPB, x0, z0, dx, dz, 0.3)) return true; }
    return false;
  }
  function footPath(f, tx, tz) { // 找到路：f.wp 放路上的轉彎點（拉直過的），回傳 true
    f.wn = 0; f.wi = 0;
    if (Math.abs(tx - f.x) > GN * GC - 3 || Math.abs(tz - f.z) > GN * GC - 3) return false; // 太遠：格子放不下
    const x0 = (f.x + tx) / 2 - (GN * GC) / 2, z0 = (f.z + tz) / 2 - (GN * GC) / 2;
    gOcc.fill(0);
    const list = solid.near(x0, z0, x0 + GN * GC, z0 + GN * GC);
    for (let i = 0; i < list.length; i++) gMark(x0, z0, list[i]);
    for (const k of cars) if (k.on) { setBox(TMPB, k.x, k.z, k.th, k.hl, k.hw); TMPB.ex = Math.abs(TMPB.ux) * k.hl + Math.abs(TMPB.wx) * k.hw; TMPB.ez = Math.abs(TMPB.uz) * k.hl + Math.abs(TMPB.wz) * k.hw; gMark(x0, z0, TMPB); }
    const cell = (x, z) => clamp(Math.floor((x - x0) / GC), 0, GN - 1) + clamp(Math.floor((z - z0) / GC), 0, GN - 1) * GN;
    let s0 = cell(f.x, f.z); const s1 = cell(tx, tz);
    if (gOcc[s0]) { let best = -1, bd = Infinity; const si = s0 % GN, sj = (s0 / GN) | 0; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const i = si + di, j = sj + dj; if (i < 0 || j < 0 || i >= GN || j >= GN || gOcc[j * GN + i]) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = j * GN + i; } } if (best < 0) return false; s0 = best; }
    gOcc[s1] = 0; // 你站的那一格一定可以
    gSt++; gHs = 0; gG[s0] = 0; gSeen[s0] = gSt; gPrev[s0] = -1; gPush(s0, 0);
    const ti = s1 % GN, tj = (s1 / GN) | 0; let found = false;
    while (gHs > 0) {
      const u = gPop(); if (gDone[u] === gSt) continue; gDone[u] = gSt;
      if (u === s1) { found = true; break; }
      const ui = u % GN, uj = (u / GN) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const i = ui + di, j = uj + dj; if (i < 0 || j < 0 || i >= GN || j >= GN) continue;
        const v = j * GN + i; if (gOcc[v] || gDone[v] === gSt) continue;
        if (di && dj && (gOcc[uj * GN + i] || gOcc[j * GN + ui])) continue; // 斜的：不能切牆角
        const g = gG[u] + (di && dj ? 1.4142 : 1);
        if (gSeen[v] !== gSt || g < gG[v]) { gSeen[v] = gSt; gG[v] = g; gPrev[v] = u; const hx = Math.abs(i - ti), hz = Math.abs(j - tj); gPush(v, g + Math.max(hx, hz) + 0.4142 * Math.min(hx, hz)); }
      }
    }
    if (!found) return false;
    let n = 0; for (let u = s1; u >= 0 && n < GNN; u = gPrev[u]) gPath[n++] = u; // 倒著的
    // 拉直：從現在的點，能直直跑到的最遠那一格 → 下一個轉彎點
    let ax = f.x, az = f.z, k = n - 1;
    while (k > 0 && f.wn < 24) {
      let best = k - 1;
      for (let q = 0; q < k; q++) { const c = gPath[q], cx = q === 0 ? tx : x0 + ((c % GN) + 0.5) * GC, cz = q === 0 ? tz : z0 + (((c / GN) | 0) + 0.5) * GC; if (!pedBlocked(ax, az, cx, cz)) { best = q; break; } }
      const c = gPath[best]; ax = x0 + ((c % GN) + 0.5) * GC; az = z0 + (((c / GN) | 0) + 0.5) * GC;
      if (best === 0) { ax = tx; az = tz; }
      f.wp.x[f.wn] = ax; f.wp.z[f.wn] = az; f.wn++; k = best;
    }
    return f.wn > 0;
  }
  const WRO = { solid: null, onHwy: false, tHwy: false, lane: 0, uturn: 0, toTarget: true };
  function roadFootPath(f, tx, tz) { // 遠的：沿著路跑（跟警車一樣的路網，不靠右）
    WRO.solid = solid; f.wn = 0; f.wi = 0;
    if (!R.route(f.wp, f.x, f.z, f.th, tx, tz, WRO)) return false;
    f.wn = f.wp.n; return f.wn > 0;
  }
  function officerThink(f) { // 看得到你、直直跑得過去 → 一直跑向你（每一幀你在哪裡）；不然照你的腳印（最新的、跑得過去的那一點）；都擋住：找路繞過去
    f.thinkT = 0.2; f.direct = false; f.final = false; f.planT -= 0.2;
    let tx, tz;
    if (f.st === 'back') { const c = f.car, fx = Math.cos(c.th), fz = -Math.sin(c.th); tx = c.x + fz * (c.hw + 0.55); tz = c.z - fx * (c.hw + 0.55); f.seen = false; f.final = true; } // 回車上：駕駛座的門（左邊）
    else if (P.hidden || P.mode === 'off') { tx = P.cx; tz = P.cz; f.seen = false; f.final = true; } // 最後看到你的地方
    else {
      const d = Math.hypot(P.cx - f.x, P.cz - f.z);
      f.seen = d < T.nearR || (d < T.seeR && !tall.blocked(f.x, f.z, P.cx, P.cz, 0));
      if (!pedBlocked(f.x, f.z, P.cx, P.cz)) { f.tx = P.cx; f.tz = P.cz; f.direct = true; f.wn = 0; return; }
      // 你的腳印：警察在腳印旁邊（12 公尺內）→ 比他旁邊那個新的、跑得過去的最新那一個（不會往回跑到很舊的腳印）
      const nn = crN < 80 ? crN : 80; let kn = -1, dn = 12;
      for (let k = 0; k < nn; k++) { const i = (crH - 1 - k + CR * 2) % CR, dd = Math.hypot(crX[i] - f.x, crZ[i] - f.z); if (dd < dn) { dn = dd; kn = k; } }
      for (let k = 0; k < kn; k++) {
        const i = (crH - 1 - k + CR * 2) % CR;
        if (Math.hypot(crX[i] - P.cx, crZ[i] - P.cz) > 1.5 && Math.hypot(crX[i] - f.x, crZ[i] - f.z) > 1.5 && !pedBlocked(f.x, f.z, crX[i], crZ[i])) { f.tx = crX[i]; f.tz = crZ[i]; f.wn = 0; return; }
      }
      tx = P.cx; tz = P.cz;
    }
    if (!pedBlocked(f.x, f.z, tx, tz)) { f.tx = tx; f.tz = tz; f.wn = 0; return; }
    // 擋住了：找路（0.8 秒找一次；目標跑掉 2 公尺也重找）
    if (f.wn === 0 || f.planT <= 0 || Math.hypot(tx - f.gx, tz - f.gz) > 2) { // 0.8 秒找一次；目標跑掉 2 公尺也重找：近的用格子，遠的（或格子找不到）沿著路
      f.planT = 0.8; f.gx = tx; f.gz = tz;
      if (!footPath(f, tx, tz) && !roadFootPath(f, tx, tz)) { f.tx = tx; f.tz = tz; return; } // 都找不到：直直跑（沿著牆滑）
    }
    const W = f.wp;
    while (f.wi < f.wn - 1 && (Math.hypot(W.x[f.wi] - f.x, W.z[f.wi] - f.z) < 0.7 || !pedBlocked(f.x, f.z, W.x[f.wi + 1], W.z[f.wi + 1]))) f.wi++;
    f.tx = W.x[f.wi]; f.tz = W.z[f.wi]; f.final = f.final && f.wi === f.wn - 1;
  }
  function stepOfficer(f, dt) {
    const ps = f.pose;
    if (f.st === 'flee') { // 第 9 批：警車被輾扁：跑開一下再站著（不追、不抓）
      f.downT -= dt; const vT = f.downT > 0 ? 4.6 : 0;
      f.v += clamp(vT - f.v, -10 * dt, 9 * dt); f.x += Math.cos(f.th) * f.v * dt; f.z -= Math.sin(f.th) * f.v * dt; collidePerson(f, 0.3);
      ps.speed = f.v; ps.state = f.v > 2.6 ? 'run' : f.v > 0.2 ? 'walk' : 'idle';
      f.ch.group.position.set(f.x, gy(f.x, f.z), f.z); f.ch.group.rotation.set(0, f.th, 0); f.ch.update(dt, ps);
      return;
    }
    if (f.st === 'down' || f.st === 'getup') { // 被撞倒、被揍倒：躺一下再爬起來
      f.downT -= dt; ps.speed = 0; ps.state = f.st === 'down' ? 'fall' : 'getup';
      if (f.st === 'down' && f.downT <= 0) { f.st = 'getup'; f.downT = 1.2; }
      else if (f.st === 'getup' && f.downT <= 0) { f.st = P.mode === 'walk' && state === 'wanted' ? 'out' : 'back'; f.thinkT = 0; f.backT = 0; }
    } else {
      f.thinkT -= dt; if (f.thinkT <= 0) officerThink(f);
      if (f.direct) { f.tx = P.cx + P.vx * 0.25; f.tz = P.cz + P.vz * 0.25; } // 直直跑得到：追你現在的位置（多算一點點你往哪裡跑）
      const dx = f.tx - f.x, dz = f.tz - f.z, d = Math.hypot(dx, dz);
      const vmax = f.st === 'back' ? 4.2 : T.runV, vT = state === 'caught' || d < 0.3 ? 0 : f.final && d < 2 ? Math.min(vmax, d * 2.5) : vmax;
      f.v += clamp(vT - f.v, -12 * dt, 8 * dt);
      if (d > 1e-3) { const want = Math.atan2(-dz, dx); f.th = wrapA(f.th + clamp(wrapA(want - f.th), -8 * dt, 8 * dt)); }
      f.x += Math.cos(f.th) * f.v * dt; f.z -= Math.sin(f.th) * f.v * dt;
      collidePerson(f, 0.3);
      if (P.ok && P.mode !== 'drive' && !P.hidden) { // 不要跑進你身體裡：最近 0.75 公尺（抓到你以後站在你旁邊）
        const ex = f.x - P.cx, ez = f.z - P.cz, e = Math.hypot(ex, ez);
        if (e < 0.75) { if (e > 1e-4) { f.x = P.cx + (ex / e) * 0.75; f.z = P.cz + (ez / e) * 0.75; } f.v = Math.min(f.v, 1); }
      }
      ps.speed = f.v; ps.state = f.v > 2.6 ? 'run' : f.v > 0.2 ? 'walk' : 'idle';
      if (f.st === 'back') {
        f.backT += dt;
        if (Math.hypot(f.car.x - f.x, f.car.z - f.z) < f.car.hl + 1.2 || (f.backT > 25 && !f.seen)) { hideOfficer(f); f.car.rt = 0; return; } // 上車了
      }
    }
    f.ch.group.position.set(f.x, gy(f.x, f.z), f.z); f.ch.group.rotation.set(0, f.th, 0);
    f.ch.update(dt, ps);
  }
  function knockOfficer(f, dx, dz) { f.st = 'down'; f.downT = 2.4; f.v = 0; const l = Math.hypot(dx, dz); if (l > 1e-6) f.th = Math.atan2(dz / l, -dx / l); } // 臉朝撞過來的方向、往後倒

  // ---- 被抓、關、放出來 ----
  function caught(how) {
    if (state !== 'wanted') return;
    state = 'caught'; phaseT = 0; arrests++; catchP = 1;
    jailStars = wanted; jailFine = T.fine * Math.max(1, wanted); jailLeft = T.jailS; paid = false;
    toast(how === 'surrender' ? '自首：警察帶你去拘留室' : '被警察抓到了！', 2400, true); // 第 3 批（b3-int）：自己走進警察局＝自首
    if (o.onCaught) try { o.onCaught({ stars: jailStars, fine: jailFine, seconds: T.jailS, mode: P.mode, how }); } catch (e) { console.warn(e); }
  }
  function toJail() {
    state = 'jail'; wanted = 0; heat = 0; catchP = 0; phaseT = 0;
    for (const c of cars) removeCar(c);
    const door = station.door || (P.ok ? { x: P.cx, z: P.cz, heading: P.th } : null), cell = station.cell || door;
    if (station.setCellDoor) try { station.setCellDoor(false); } catch { /* 算了 */ }
    if (o.onArrest) try { o.onArrest({ cell, door, yard: station.yard, fine: jailFine, seconds: T.jailS, stars: jailStars }); } catch (e) { console.warn(e); }
    hud.jail(true);
  }
  function release() { state = 'release'; phaseT = 0; relDone = false; hud.fade(true); }
  function payFine() {
    if (state !== 'jail' || !o.money) return false;
    let ok = false; try { ok = (+o.money.get() || 0) >= jailFine && o.money.spend(jailFine) !== false; } catch { ok = false; }
    if (!ok) { hud.jailTick(true); return false; }
    paid = true; release(); return true;
  }

  // ---- HUD ----
  const hud = (() => {
    const nop = () => {};
    if (!hasDoc) return { flash: nop, tick: nop, jail: nop, jailTick: nop, fade: nop, toast: nop, show: nop, dispose: nop };
    if (!document.getElementById('pw-style')) { const s = document.createElement('style'); s.id = 'pw-style'; s.textContent = CSS; document.head.append(s); }
    const host = o.hudParent; host.classList.add('pw-host');
    const root = document.createElement('div'); root.className = 'pw';
    root.innerHTML = '<div class="pw-want" hidden role="status" aria-live="polite"><span class="st"></span><b>通緝中</b><span class="pw-esc" hidden><i></i></span></div>'
      + '<div class="pw-catch" hidden><span>快跑！警察要抓你了</span><div><i></i></div></div>'
      + '<div class="pw-toast" role="status"></div><div class="pw-fade" hidden></div>'
      + '<div class="pw-jail" hidden><small>警察局 · 拘留室</small><span class="cnt">關 <em>30</em> 秒</span><div class="pw-jbar"><i></i></div><button type="button" class="pw-pay"></button><p></p></div>';
    host.append(root);
    const q = (s) => root.querySelector(s);
    const H = { want: q('.pw-want'), st: q('.pw-want .st'), lab: q('.pw-want b'), esc: q('.pw-esc'), escI: q('.pw-esc i'), cat: q('.pw-catch'), catT: q('.pw-catch span'), catI: q('.pw-catch i'), toast: q('.pw-toast'), fade: q('.pw-fade'),
      jail: q('.pw-jail'), cnt: q('.pw-jail .cnt em'), jbar: q('.pw-jbar i'), pay: q('.pw-pay'), note: q('.pw-jail p'), last: {} };
    const onPay = (e) => { e.preventDefault(); payFine(); };
    H.pay.addEventListener('click', onPay);
    const set = (k, v, f) => { if (H.last[k] !== v) { H.last[k] = v; f(v); } };
    let tt = 0;
    return {
      flash() { H.want.classList.remove('up'); void H.want.offsetWidth; H.want.classList.add('up'); },
      toast(text, ms, red) { H.toast.textContent = text; H.toast.classList.toggle('red', !!red); H.toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => H.toast.classList.remove('show'), ms); },
      tick() {
        const show = enabled && wanted > 0 && state === 'wanted';
        set('show', show, (v) => { H.want.hidden = !v; host.classList.toggle('pw-on', v); });
        if (show) {
          const lost = !seenNow;
          set('stars', wanted, (n) => { H.st.innerHTML = '★'.repeat(n) + '<i>' + '★'.repeat(3 - n) + '</i>'; });
          set('lost', lost, (v) => { H.want.classList.toggle('lost', v); H.esc.hidden = !v; }); // 字一直是「通緝中」；看不到你的時候：星星慢慢閃、下面綠色的條＝甩開的進度
          set('aria', `${wanted}|${lost}`, () => H.want.setAttribute('aria-label', `通緝中，${wanted} 顆星${lost ? '，警察看不到你' : ''}`));
          if (lost) { const base = dropped ? T.lose - T.loseNext : 0, k = Math.round(clamp((heat - base) / (T.lose - base), 0, 1) * 100); set('esc', k, (v) => (H.escI.style.width = v + '%')); } // 甩開的進度（下一顆星）
          set('blue', !lost && Math.floor(T0 * 3) % 2 === 1, (v) => H.want.classList.toggle('b', v));
        }
        const cp = state === 'wanted' && catchP > 0.02 ? Math.round(catchP * 100) : 0;
        set('cat', cp > 0, (v) => (H.cat.hidden = !v));
        if (cp > 0) set('catp', cp, (v) => (H.catI.style.width = v + '%'));
      },
      fade(on) { H.fade.hidden = false; void H.fade.offsetWidth; H.fade.style.opacity = on ? '1' : '0'; },
      jail(on) { H.jail.hidden = !on; H.last.jl = null; H.last.can = null; if (on) this.jailTick(); },
      jailTick(nope) {
        const left = Math.max(0, Math.ceil(jailLeft));
        set('jl', left, (v) => { H.cnt.textContent = String(v); });
        set('jb', Math.round(clamp(jailLeft / T.jailS, 0, 1) * 200), (v) => (H.jbar.style.width = `${v / 2}%`));
        const m = o.money ? +o.money.get() || 0 : 0, can = !!o.money && m >= jailFine;
        set('can', `${can}|${jailFine}`, () => {
          H.pay.disabled = !can; H.pay.hidden = !o.money;
          H.pay.textContent = can ? `繳罰款 NT$ ${jailFine} 萬，馬上出去` : `罰款 NT$ ${jailFine} 萬（錢不夠）`;
          H.note.textContent = !o.money ? '等時間到就放你出去' : can ? `罰款：每顆星 ${T.fine} 萬。不繳也可以，時間到就放你出去` : '錢不夠：等時間到就放你出去';
        });
        if (nope) H.note.textContent = '錢不夠：等時間到就放你出去';
      },
      show(on) { root.hidden = !on; if (!on) host.classList.remove('pw-on'); H.last.show = null; },
      dispose() { clearTimeout(tt); H.pay.removeEventListener('click', onPay); root.remove(); host.classList.remove('pw-on', 'pw-host'); },
    };
  })();
  function toast(text, ms = 1800, red = false) {
    let done = false; if (o.toast) try { done = o.toast(text, ms, red) === true; } catch { done = false; } // 第 3 批（b3-int）：頁面自己說（跟走路、開車的提示同一個地方，不會兩個疊在一起）
    if (!done) hud.toast(text, ms, red); if (o.onToast) try { o.onToast(text, red); } catch { /* 算了 */ }
  }

  // ---- 警笛 ----
  const SND = o.sound || null;
  function audioCtx() { if (!SND) return null; try { const c = typeof SND.ctx === 'function' ? SND.ctx() : SND.ctx; return c && c.state === 'running' ? c : null; } catch { return null; } }
  function sirens() {
    const ctx = audioCtx(), muted = SND && typeof SND.muted === 'function' ? !!SND.muted() : false, base = SND ? SND.gain ?? 0.22 : 0;
    for (const c of cars) {
      const want = c.on && c.lights && c.mode !== 'home' && (state === 'wanted' || state === 'caught') && ctx && !muted && enabled;
      if (!want) { if (c.siren) { c.siren.stop(); c.siren = null; } continue; }
      if (!c.siren) c.siren = makeSiren(ctx, SND.out || ctx.destination, c.id);
      if (!c.siren) continue;
      const d = Math.hypot(c.x - P.cx, c.z - P.cz), near = clamp(1 - d / 320, 0, 1), gain = base * near * near * (state === 'caught' ? 0.6 : 1);
      const ang = Math.atan2(-(c.z - P.cz), c.x - P.cx) - P.th, pan = clamp(-Math.sin(ang) * 0.75, -0.8, 0.8);
      const ux = d > 1e-3 ? (c.x - P.cx) / d : 0, uz = d > 1e-3 ? (c.z - P.cz) / d : 0;
      const vr = (Math.cos(c.th) * c.v - P.vx) * ux + (-Math.sin(c.th) * c.v - P.vz) * uz; // 正的＝離你越來越遠
      c.siren.set(gain, 900 + 6500 * near, pan, clamp(-1200 * Math.log2(1 + vr / 343), -260, 260));
    }
  }

  // ---- 每一幀 ----
  function update(dt) {
    if (!alive || !(dt > 0)) return;
    const t0 = tnow();
    dt = Math.min(dt, 0.1); T0 += dt;
    readPlayer(dt);
    if (!enabled) { perfEnd(t0); return; }
    if (warmI < MAXC * 2 && state === 'free') { warmT -= dt; if (warmT <= 0) { warmT = 0.25; warmOne(); } }
    if (P.ok && !P.hidden && P.mode !== 'off') crumb();
    // 躲回自己的車庫、鐵捲門關了：星星清掉
    if (state === 'wanted' && P.safe) { safeT += dt; if (safeT > 0.6) clearStars('躲回車庫了，警察找不到你！'); } else safeT = 0;
    // 幾顆星幾台（隔 2.5 秒一台；回家路上的先叫回來）
    let active = 0, vtop = 20;
    for (const c of cars) { if (!c.on || c.wreckT > 0) continue; if (c.mode !== 'home') active++; const a = Math.abs(c.v); if (a > vtop) vtop = a; } // 第 9 批：輾扁的不算
    if (state === 'wanted' && P.ok) {
      const want = Math.min(MAXC, wanted);
      spawnT -= dt;
      if (active < want && spawnT <= 0 && P.mode !== 'off') {
        let home = null; for (const c of cars) if (c.on && !(c.wreckT > 0) && c.mode === 'home' && (!home || c.d < home.d)) home = c;
        if (home) goChase(home); else spawnCar();
        spawnT = T.stagger;
      } else if (active > want) { let far = null; for (const c of cars) if (c.on && !(c.wreckT > 0) && c.mode !== 'home' && (!far || c.d > far.d)) far = c; if (far) goHome(far); }
    }
    const n = Math.max(1, Math.ceil((dt * vtop) / 0.6)), h = dt / n; // 物理每步最多走 0.6 公尺
    seenNow = false;
    if (state === 'wanted' || state === 'free') {
      // 角色：最近的那台咬著（0），第二近繞到前面（1），第三近從旁邊夾（2）
      for (const c of cars) { c.role = -1; if (!c.on || c.mode === 'home' || c.wreckT > 0) continue; let r = 0; for (const k of cars) if (k !== c && k.on && k.mode !== 'home' && !(k.wreckT > 0) && (k.d < c.d || (k.d === c.d && k.id < c.id))) r++; c.role = r; }
      if (P.mode === 'drive' && P.ok) { slotsFor(); slotT -= dt; if (slotT <= 0) { slotT = 0.5; if (P.spd < 4) assignSlots(); else for (const c of cars) c.slot = -1; } }
      for (const c of cars) {
        if (!c.on) continue;
        if (c.wreckT > 0) { wreckTick(c, dt); continue; } // 第 9 批：輾扁的停著
        c.age += dt; c.hitCool -= dt;
        thinkCar(c, dt);
        if (c.seen && c.mode !== 'home') seenNow = true;
        c.rt -= dt;
        if (c.mode === 'home') { if (c.rt <= 0 && !c.path.ok) homeRoute(c); }
        else if (state === 'wanted' && P.ok && P.mode !== 'off' && (!c.clear || c.d >= 70)) { // 路線（沿著路開的時候）：你跑遠了（離路線的終點）、車子離路線太遠、或 2.5 秒一次
          const endD = c.path.ok ? Math.hypot(c.path.tx - P.cx, c.path.tz - P.cz) : Infinity;
          if (!c.path.ok || c.rt <= 0 || endD > 6 + c.d * 0.08 || c.pathOff > 5) replan(c, P.cx, P.cz, P.hwy, true);
        }
        // 卡住：想走卻一直不動 → 倒車 1.2 秒再重算
        if (c.manOn) c.stats.manSec += dt;
        if (c.wantV > 2.5 && Math.abs(c.v) < 0.8) { c.stuck += dt * (c.touch > 0 ? 2 : 1); c.stats.stuckSec += dt; } else c.stuck = Math.max(0, c.stuck - dt * 2); // 想走卻不動（頂著牆：快一點發現）
        if (c.stuck > 1.3 && !c.manOn) { // 卡住了：慢慢倒車、轉頭（stepCar → maneuver）
          c.manOn = true; c.manT = 0; c.manN = 0; c.stuck = 0; c.stats.recov++;
          if (DBG.onRecover) DBG.onRecover(c, { clear: c.clear, seen: c.seen, d: c.d, pathOk: c.path.ok, mode: c.mode, pmode: P.mode, slot: c.slot, role: c.role });
        }
        // 沒進度：想走（wantV > 1）卻一直在 5 公尺內打轉 → 8 秒（你看不到的時候）換個地方；20 秒一定換
        if (c.wantV < 1) { c.ancX = c.x; c.ancZ = c.z; c.ancT = 0; }
        else { c.ancT += dt; if (Math.hypot(c.x - c.ancX, c.z - c.ancZ) > 5) { c.ancX = c.x; c.ancZ = c.z; c.ancT = 0; } }
        if (c.ancT > c.stats.stuckMax) c.stats.stuckMax = c.ancT;
        if ((c.ancT > 8 && !c.seen) || c.ancT > 20) { if (c.mode === 'home') removeCar(c); else relocate(c); continue; }
        // 太遠、看不到：換到近一點的地方（追得上）
        if (state === 'wanted' && c.mode !== 'home' && !c.seen && c.d > 520 && c.age > 6) { relocate(c); continue; }
        // 回家：到了、或看不到又離你很遠 → 收掉
        if (c.mode === 'home') {
          c.homeT += dt;
          const arrived = c.path.ok && Math.hypot(c.x - c.path.tx, c.z - c.path.tz) < 8;
          if ((arrived || (!c.seen && c.d > 140) || c.homeT > 60) && !(c.seen && c.d < 60 && !arrived)) { removeCar(c); continue; }
        }
      }
      for (let k = 0; k < n; k++) for (const c of cars) if (c.on && !(c.wreckT > 0)) stepCar(c, h);
    }
    // 警察：走路的你 → 車停了、看得到你、近了（或車開不過去）→ 下車追；你上車了 → 跑回車上
    for (const f of offs) {
      const c = f.car;
      if (!c.on) { if (f.on) hideOfficer(f); continue; }
      if (c.wreckT > 0) { if (f.on) stepOfficer(f, dt); continue; } // 第 9 批：車子扁了：警察跑開、站著
      if (state === 'wanted' && !f.on && P.mode === 'walk' && !P.hidden && c.mode !== 'home' && c.seen && Math.abs(c.v) < 0.8) {
        c.waitT += dt; c.exitCool -= dt; if (c.d < 20 || (c.exitCool <= 0 && (c.d < 34 || (c.d < 90 && c.waitT > 1.2)))) officerOut(f);
      } else if (!f.on) c.waitT = 0;
      if (f.on && f.st === 'out' && (P.mode !== 'walk' || (state !== 'wanted' && state !== 'caught') || c.mode === 'home' || (state === 'wanted' && Math.hypot(P.cx - f.x, P.cz - f.z) > 60))) { f.st = 'back'; f.thinkT = 0; f.backT = 0; c.exitCool = 5; } // 你跑太遠了：回車上開車追
      if (f.on) { stepOfficer(f, dt); if (f.on && f.seen && f.st === 'out') seenNow = true; }
    }
    if (state === 'wanted') {
      // 看到你了 → 記住在哪裡；一直沒看到：25 秒掉一顆星，之後每 10 秒再掉一顆
      if (seenNow) { heat = 0; dropped = false; lastX = P.cx; lastZ = P.cz; everSeen = true; }
      else if (!everSeen && !P.hidden && P.mode !== 'off' && (huntT += dt) < T.hunt) { /* 第 3 批（b3-int）：警察還在路上、還沒看到過你：不算甩開（躲起來、或找了 45 秒還沒找到才開始算） */ }
      else {
        let any = false; for (const c of cars) if (c.on && c.mode !== 'home') any = true;
        heat += dt * (any || P.hidden || P.mode === 'off' ? 1 : 0.5);
        if (heat >= T.lose) { wanted--; heat = T.lose - T.loseNext; dropped = true; if (wanted <= 0) clearStars('甩掉警察了！'); else toast(`甩開了一點！剩 ${wanted} 顆星`, 1600); }
      }
      if (state === 'wanted') catchTick(dt);
    }
    if (state === 'wanted' || state === 'free') copHits();
    if (state === 'caught') {
      phaseT += dt;
      for (const c of cars) if (c.on) { c.v *= Math.exp(-dt * 3); c.x += Math.cos(c.th) * c.v * dt; c.z -= Math.sin(c.th) * c.v * dt; }
      if (phaseT > 1.7 && !hudFaded) { hudFaded = true; hud.fade(true); }
      if (phaseT > 2.4) { hudFaded = false; toJail(); hud.fade(false); }
    } else if (state === 'jail') {
      jailLeft -= dt; hud.jailTick();
      if (jailLeft <= 0) release();
    } else if (state === 'release') {
      phaseT += dt;
      if (phaseT > 0.7 && !relDone) {
        relDone = true; hud.jail(false);
        if (station.setCellDoor) try { station.setCellDoor(true); } catch { /* 算了 */ }
        let towed = true; // 第 3 批（b3-int）：onRelease 回傳 false＝車子沒拖到停車場（走路被抓）：不說「你的車停在⋯」
        if (o.onRelease) try { towed = o.onRelease({ door: station.door, yard: station.yard, paid }) !== false; } catch (e) { console.warn(e); }
        hud.fade(false);
        toast(paid ? `繳了 ${jailFine} 萬罰款，放你出去了` : '時間到，放你出去了！', 2600);
        if (station.yard && towed) yardT = 2.8;
      }
      if (phaseT > 1.3) { state = 'free'; wanted = 0; heat = 0; catchP = 0; }
    }
    if (yardT > 0) { yardT -= dt; if (yardT <= 0 && state === 'free') toast('你的車停在警察局的停車場', 2400); }
    // 畫面：車子擺好、燈、小地圖的點、碰撞給別人
    for (const c of cars) if (c.on) { poseCar(c); if (c.model.update) c.model.update(dt); }
    syncOut();
    sndT -= dt; if (sndT <= 0) { sndT = 0.1; sirens(); }
    hud.tick();
    perfEnd(t0);
  }
  function perfEnd(t0) { const ms = tnow() - t0; perf.n++; perf.sum += ms; if (ms > perf.max) perf.max = ms; perf.last = ms; }
  function catchTick(dt) {
    let rate = 0, near = 0;
    if (P.mode === 'drive' && !P.hidden) {
      for (const c of cars) { if (!c.on || c.mode === 'home' || c.wreckT > 0) continue; const g = Math.hypot(c.x - P.cx, c.z - P.cz); if (g < T.boxR) near++; if (g < T.catchR) rate = 1 / T.catchT; }
      if (near >= 2) rate = 1 / T.boxT;
      if (P.spd > T.catchV) rate = 0;
      catchP = rate > 0 ? catchP + rate * dt : Math.max(0, catchP - dt * 0.8);
      if (catchP >= 1) caught(near >= 2 ? 'box' : 'car');
    } else if (P.mode === 'walk' && !P.hidden) { // 走路：警察跑到 1.2 公尺以內；進度條＝警察多近
      let dm = Infinity; for (const f of offs) if (f.on && f.st === 'out') { const d = Math.hypot(f.x - P.cx, f.z - P.cz); if (d < dm) dm = d; }
      catchP = dm < Infinity ? clamp(1 - (dm - T.footR) / 8, 0, 0.99) : Math.max(0, catchP - dt);
      if (dm < T.footR) caught('foot');
    } else catchP = Math.max(0, catchP - dt);
  }
  function copHits() { // 你開車撞警車（你往它撞過去、撞得夠快）→ +1 顆星
    if (!P.ok || P.mode !== 'drive') return;
    setBox(TMPB, P.cx, P.cz, P.th, P.hl + 0.35, P.hw + 0.35);
    for (const c of cars) {
      if (!c.on || c.wreckT > 0 || c.hitCool > 0 || Math.abs(c.x - P.cx) > 8 || Math.abs(c.z - P.cz) > 8) continue;
      if (!boxPush(c.x, c.z, Math.cos(c.th), -Math.sin(c.th), c.hl, c.hw, TMPB)) continue;
      const dx = c.x - P.cx, dz = c.z - P.cz, d = Math.hypot(dx, dz) || 1, cvx = Math.cos(c.th) * c.v, cvz = -Math.sin(c.th) * c.v;
      const into = ((P.vx - cvx) * dx + (P.vz - cvz) * dz) / d, mine = (P.vx * dx + P.vz * dz) / d;
      if (into > 3 && mine > 2.5) { c.hitCool = 3; crime('cop', { x: c.x, z: c.z }); }
    }
  }
  function goChase(c) { c.mode = 'go'; c.rt = 0; c.path.ok = false; c.homeT = 0; c.ancT = 0; c.lights = true; if (c.model && c.model.setLights) c.model.setLights(true); }
  function goHome(c) {
    c.mode = 'home'; c.path.ok = false; c.rt = 0; c.slot = -1; c.lights = false; if (c.model && c.model.setLights) c.model.setLights(false);
    if (c.siren) { c.siren.stop(); c.siren = null; }
    const f = c.officer; if (f.on && f.st === 'out') { f.st = 'back'; f.thinkT = 0; f.backT = 0; }
  }
  function clearStars(msg) {
    wanted = 0; heat = 0; catchP = 0; state = 'free'; escapes++;
    for (const c of cars) if (c.on) goHome(c);
    if (msg) toast(msg, 2400);
  }
  function poseCar(c) { // 上坡下坡（山）：車子跟著地面的高度、前後的斜度
    const y = gy(c.x, c.z); let sl = 0;
    if (y !== 0 || V.terrainAt?.(c.x, c.z)) { const cx = Math.cos(c.th) * 1.4, sz = Math.sin(c.th) * 1.4; sl = Math.atan((gy(c.x + cx, c.z - sz) - gy(c.x - cx, c.z + sz)) / 2.8); }
    c.group.position.set(c.x, y, c.z); c.group.rotation.set(c.roll, c.th, c.pitch + sl);
  }
  function syncOut() {
    markerList.length = 0;
    for (let i = 0; i < MAXC; i++) {
      const c = cars[i], m = movers[i], mk = markers[i];
      const nc = npcCars[i]; if (c.on) { nc.x = c.x; nc.z = c.z; nc.heading = c.th; nc.v = c.v; nc.hx = c.hl; nc.hz = c.hw; } else { nc.x = 1e6; nc.z = 1e6; nc.v = 0; }
      if (c.on) { m.x = c.x; m.z = c.z; m.hx = c.hl; m.hz = c.hw; m.rot = c.th; mk.x = c.x; mk.z = c.z; mk.fill = c.mode === 'home' || c.wreckT > 0 ? '#8A9099' : Math.floor(T0 * 4 + i) % 2 ? '#2F7BFF' : '#FF3B30'; mk.on = true; markerList.push(mk); }
      else { m.hx = 0; m.hz = 0; mk.on = false; }
      const f = offs[i], mo = movers[MAXC + i];
      if (f.on && (f.st === 'out' || f.st === 'back' || f.st === 'flee')) { mo.x = f.x; mo.z = f.z; mo.r = 0.3; } else mo.r = 0;
    }
  }

  const DBG = { cars, offs, G, R, station, P, solid, tall, T, surf, spawnCar, relocate, onRecover: null, CNT }; // 測試用
  // ---- 給別的模組 ----
  // 第 9 批（路變大）：越野車輾扁警車 → 車子扁下去、燈關掉、警察從另一邊下車跑掉（不會受傷）；+2★；20 秒後收掉
  function wreck(i, fx, fz) {
    const c = cars[i]; if (!alive || !enabled || !c || !c.on || c.wreckT > 0) return null;
    c.wreckT = 20; c.wreckA = 0; c.v = 0; c.steer = 0; c.slot = -1; c.role = -1; c.lights = false; if (c.model && c.model.setLights) c.model.setLights(false);
    if (c.siren) { c.siren.stop(); c.siren = null; }
    const f = c.officer;
    if (!f.on || f.st === 'in') { // 從離越野車遠的那一邊下車
      ensureOfficer(f);
      const ffx = Math.cos(c.th), ffz = -Math.sin(c.th), rx = -ffz, rz = ffx, sd = (fx - c.x) * rx + (fz - c.z) * rz > 0 ? -1 : 1;
      let x = c.x + rx * sd * (c.hw + 0.7), z = c.z + rz * sd * (c.hw + 0.7);
      if (!personFree(x, z, 0.3)) { x = c.x - ffx * (c.hl + 0.8); z = c.z - ffz * (c.hl + 0.8); }
      f.on = true; f.x = x; f.z = z; f.ch.group.visible = enabled;
    }
    const dx = f.x - fx, dz = f.z - fz, l = Math.hypot(dx, dz) || 1;
    f.st = 'flee'; f.downT = 2.6; f.v = 1.5; f.th = Math.atan2(-dz / l, dx / l); f.seen = false;
    CNT.wreck = (CNT.wreck || 0) + 1;
    crime('crushCop', { x: c.x, z: c.z });
    return { x: c.x, z: c.z, th: c.th, hl: c.hl, hw: c.hw };
  }
  function wreckTick(c, dt) { // 扁下去（0.45 秒）、留著，時間到收掉
    c.wreckA = Math.min(1, c.wreckA + dt / 0.45); const e = c.wreckA * c.wreckA * (3 - 2 * c.wreckA);
    if (c.group) c.group.scale.set(1 + 0.07 * e, 1 - 0.6 * e, 1 + 0.07 * e);
    c.v = 0; c.wreckT -= dt; if (c.wreckT <= 0) removeCar(c);
  }
  function colliders(x, z, r) { // 現在的警車（長方形；陣列、物件都是重複用的）；會動的車（vx、vz、m）：撞到照動量算，被你推的（dvx、dvz）下一次加到它的速度
    for (let i = 0; i < colOut.length; i++) {
      const b = colOut[i]; if (!b.dvx && !b.dvz) continue;
      const c = cars[b.pi]; if (c && c.on && !(c.wreckT > 0)) c.v = Math.max(-8, Math.min(40, c.v + b.dvx * Math.cos(c.th) - b.dvz * Math.sin(c.th)));
      b.dvx = b.dvz = 0;
    }
    colOut.length = 0;
    for (const c of cars) {
      if (!c.on || c.wreckT > 0 || (x != null && Math.hypot(c.x - x, c.z - z) > r + c.hl)) continue; // 第 9 批：輾扁的不擋（crush.js 的墊子：開得上去）
      const b = colPool[colOut.length] || (colPool[colOut.length] = { t: 'box', x: 0, z: 0, hx: 1, hz: 1, rot: 0, h: 1.6, police: true, pi: 0, vx: 0, vz: 0, m: 1.2, dvx: 0, dvz: 0 });
      b.x = c.x; b.z = c.z; b.hx = c.hl; b.hz = c.hw; b.rot = c.th; b.pi = c.id; b.vx = Math.cos(c.th) * c.v; b.vz = -Math.sin(c.th) * c.v; b.dvx = b.dvz = 0; colOut.push(b); // pi：第幾台（第 9 批：越野車輾到 → wreck(pi)）
    }
    return colOut;
  }
  const isDown = (p) => p.down || p.mode === 'fall' || p.mode === 'lie' || p.mode === 'getup'; // 倒在地上的（npc.js 的居民用 mode）
  function punch(me, people, knock) { // 揍：前面 1.2 公尺、±60° 以內最近的那一個（警察也算）
    if (!me) me = { x: P.x, z: P.z, heading: P.th };
    const fx = Math.cos(me.heading || 0), fz = -Math.sin(me.heading || 0);
    let best = null, bd = T.footR + 0.05, isCop = false;
    for (const f of offs) {
      if (!f.on || f.st === 'down' || f.st === 'getup' || f.st === 'in') continue;
      const dx = f.x - me.x, dz = f.z - me.z, d = Math.hypot(dx, dz); if (d > bd || d < 1e-3) continue;
      if ((dx * fx + dz * fz) / d < 0.5) continue; best = f; bd = d; isCop = true;
    }
    if (people) for (let i = 0; i < people.length; i++) {
      const p = people[i]; if (!p || isDown(p) || p.age === 'kid') continue; // 小孩永遠打不到
      const dx = p.x - me.x, dz = p.z - me.z, d = Math.hypot(dx, dz); if (d > bd || d < 1e-3) continue;
      if ((dx * fx + dz * fz) / d < 0.5) continue; best = p; bd = d; isCop = false;
    }
    if (!best) return null;
    if (isCop) { knockOfficer(best, best.x - me.x, best.z - me.z); crime('cop', best); }
    else { if (knock) try { knock(best, best.x - me.x, best.z - me.z); } catch (e) { console.warn(e); } crime('punch', best); }
    return best;
  }
  function carHit(people, knock) { // 開車撞人：車身（胖 0.25）碰到人、車速 > 2 m/s
    if (!P.ok || P.mode !== 'drive' || P.spd < 2) return null;
    let hit = null;
    setBox(TMPB, P.cx, P.cz, P.th, P.hl + 0.25, P.hw + 0.25);
    for (const f of offs) {
      if (!f.on || f.st === 'down' || f.st === 'getup' || f.st === 'in') continue;
      if (Math.abs(f.x - P.cx) > 5 || Math.abs(f.z - P.cz) > 5 || !circleVsBox(f.x, f.z, 0.3, TMPB)) continue;
      knockOfficer(f, f.x - P.cx, f.z - P.cz); crime('cop', f); hit = f;
    }
    if (people) for (let i = 0; i < people.length; i++) {
      const p = people[i]; if (!p || isDown(p) || p.age === 'kid' || Math.abs(p.x - P.cx) > 5 || Math.abs(p.z - P.cz) > 5 || !circleVsBox(p.x, p.z, 0.3, TMPB)) continue;
      if (knock) try { knock(p, p.x - P.cx, p.z - P.cz); } catch (e) { console.warn(e); }
      crime('hit', p); hit = p;
    }
    return hit;
  }
  // 開槍打到警察（guns.js 的 gunTargets.police）：hit＝{ x, z（打到的點）, dx, dz（子彈的方向）}；打到的那個警察倒下去、再爬起來
  //   犯罪 guns.js 自己報（'shootCop'），這裡不報（不然會多一顆星）；回傳倒下去的那個警察（沒有＝null）
  function shot(hit) {
    if (!hit || !isFinite(hit.x) || !isFinite(hit.z)) return null;
    let best = null, bd = 0.9;
    for (const f of offs) {
      if (!f.on || f.st === 'down' || f.st === 'getup' || f.st === 'in') continue;
      const d = Math.hypot(f.x - hit.x, f.z - hit.z); if (d < bd) { bd = d; best = f; }
    }
    if (best) knockOfficer(best, hit.dx || best.x - P.cx, hit.dz || best.z - P.cz);
    return best;
  }
  const carObject = (i) => { const c = cars[i]; return c && c.on && c.group ? c.group : null; }; // 警車 i（police.movers 的第 i 個）的 Object3D：彈孔貼在上面
  function shotCar(i, hit) { const c = cars[i]; if (!c || !c.on) return false; c.stats.shots++; void hit; return true; } // 警車被打到：只記下來（警車照樣追；犯罪 guns.js 報）
  function clear() {
    wanted = 0; heat = 0; catchP = 0; state = 'free'; hudFaded = false; relDone = false; phaseT = 0;
    for (const c of cars) removeCar(c);
    hud.jail(false); hud.show(enabled);
    if (hasDoc) { const fd = o.hudParent.querySelector('.pw-fade'); if (fd) fd.style.opacity = '0'; }
  }
  function setEnabled(on) {
    enabled = !!on;
    for (const c of cars) { if (c.group) c.group.visible = enabled && c.on; const f = c.officer; if (f.ch) f.ch.group.visible = enabled && f.on; }
    if (!enabled) for (const c of cars) if (c.siren) { c.siren.stop(); c.siren = null; }
    hud.show(enabled);
  }
  function dispose() {
    if (!alive) return; alive = false;
    for (const c of cars) { removeCar(c); if (c.model && c.model.dispose) c.model.dispose(); else if (c.group) c.group.removeFromParent(); }
    for (const f of offs) if (f.ch) { if (f.ch.dispose) f.ch.dispose(); else f.ch.group.removeFromParent(); }
    hud.dispose();
  }
  function telemetry() { // 測試、除錯用（會新增物件，不要每一幀叫）
    return {
      wanted, state, seen: seenNow, everSeen, hunt: +huntT.toFixed(1), heat: +heat.toFixed(2), catch: +catchP.toFixed(3), last: { x: +lastX.toFixed(1), z: +lastZ.toFixed(1) }, enabled,
      player: { mode: P.mode, x: +P.cx.toFixed(1), z: +P.cz.toFixed(1), kmh: Math.round(P.spd * 3.6), hidden: P.hidden, safe: P.safe },
      cars: cars.filter((c) => c.on).map((c) => ({ id: c.id, mode: c.mode, x: +c.x.toFixed(1), z: +c.z.toFixed(1), th: +c.th.toFixed(2), kmh: Math.round(c.v * 3.6), d: +c.d.toFixed(1), seen: c.seen, clear: c.clear, role: c.role, slot: c.slot,
        stuck: +c.ancT.toFixed(2), stuckMax: +c.stats.stuckMax.toFixed(2), recov: c.stats.recov, relocs: c.stats.relocs, bumps: c.stats.bumps, path: c.path.ok ? c.path.n : 0, wreck: c.wreckT > 0, officer: c.officer.on ? c.officer.st : 'in', ox: +c.officer.x.toFixed(1), oz: +c.officer.z.toFixed(1), siren: !!c.siren })),
      jail: state === 'jail' || state === 'release' ? { left: +jailLeft.toFixed(1), fine: jailFine, paid } : null,
      arrests, escapes, crimes: crimes.slice(-8), ms: { avg: perf.n ? +(perf.sum / perf.n).toFixed(4) : 0, max: +perf.max.toFixed(3), last: +perf.last.toFixed(4), frames: perf.n },
      graph: { nodes: G.N, segs: G.M },
    };
  }
  return {
    update, crime, punch, carHit, shot, carObject, shotCar, colliders, wreck, movers, npcCars, markers: markerList, clear, setEnabled, dispose, telemetry, payFine, preload,
    surrender: () => { if (state !== 'wanted') return false; caught('surrender'); return true; }, // 第 3 批（b3-int）：通緝中自己走進警察局＝自首（一樣關、一樣罰）
    get wanted() { return wanted; }, get state() { return state; }, get enabled() { return enabled; },
    resetPerf() { perf.n = 0; perf.sum = 0; perf.max = 0; },
    _dbg: DBG,
  };
}

return { createPolice, placeholderPoliceCar, placeholderOfficer, OFFICER_LOOK, policeNavGraph };
})();
