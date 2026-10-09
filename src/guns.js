// ---- 槍（第 3 批）：槍店買的槍、子彈；下車走路的時候拿槍、瞄準、開槍、換彈匣 ----
// Nick 2026-09-28 07:19：「有店可以買槍   子彈」
// 規矩（整個遊戲一樣）：卡通、不血腥：沒有血；打到人只會跌倒，過幾秒自己爬起來；警察不開槍（只會追、抓）
//   槍都是虛構的（沒有真的牌子、商標、型號）：名字就叫手槍、衝鋒槍、霰彈槍、步槍
// 世界座標跟 village.js、walk.js 一樣：x 往東、y 往上、z 往南；heading＝rotation.y（0 朝 +x、π/2 朝北 −z）
//
// 【API】
//   GUNS[id]：槍的資料；GUN_IDS：店裡的順序（便宜的在前面）＝['pistol' 手槍, 'smg' 衝鋒槍, 'shotgun' 霰彈槍, 'rifle' 步槍]
//     { id, name, tag（半自動／全自動／泵動式）, desc, hold: 'one'｜'two', auto（按住一直射）, interval（兩發之間幾秒）, mag（彈匣幾發）,
//       reload（換彈匣幾秒；霰彈槍一顆一顆裝：shellStart＋shell 秒一顆）, knock（打到人一發推多少，累積到 1 就跌倒）, carDmg, pellets（一次幾顆：霰彈槍 8）,
//       spread／aimSpread（散布角，度：沒瞄準／瞄準）, range（公尺）, zoom（瞄準時放大幾倍：步槍有瞄準鏡）, recoil（鏡頭往上跳幾弧度）,
//       price（萬）, ammo: { price（一盒幾萬）, count（一盒幾發）, max（身上最多帶幾發備用） }, stats: { power, rate, range, aim }（店裡的 1–5 格） }
//   存檔：GAME.guns（整個物件直接放進存檔 JSON；garage.src.html 的 save() 多存一個 guns: GAME.guns）
//     { owned: ['pistol', …]（買了哪幾把，照 GUN_IDS 的順序）, ammo: { pistol: 48 }（備用子彈，不含彈匣裡的）, mag: { pistol: 12 }（彈匣裡現在幾發）,
//       cur: 'pistol' | null（上次拿的那把：下次「拿槍」拿這把；null＝還沒有槍）,
//       range: { best: { pistol: 6 }（靶場一輪最多打倒幾個）, time: { pistol: 9.8 }（完美一輪最快幾秒）, paid: { pistol: 1 }（完美獎金領過了） } }
//     gunSave.fresh() → 空的；gunSave.load(存檔的 guns) → 檢查過的（舊存檔沒有 guns → 空的；不認識的槍、負的、太多的子彈、超過彈匣的都修好）
//   gunShop（純邏輯：槍店畫面、測試都用這個；錢是 GAME.money，單位「萬」、整數）
//     gunShop.buyGun(GAME, id) → { ok, cost, msg, need }   錢夠、還沒買 → 扣錢、送一個裝滿的彈匣；還沒有槍的話 cur 變這把
//     gunShop.buyAmmo(GAME, id, boxes = 1) → { ok, cost, added, msg }   要先有這把槍；帶滿了買不了（帶不下一整盒：裝到滿為止）
//     gunShop.ammoRoom(G, id)（還能帶幾發）、gunShop.total(G, id)（彈匣＋備用）
//     gunShop.rangeResult(GAME, id, { hits, total, time }) → { best（新紀錄）, reward（萬，完美一輪第一次：RANGE_REWARD）, msg }
//   buildGunModel(id, { flash }) → THREE.Group：原點＝右手握的地方、槍管朝 +x、上面 +y、右邊 +z（公尺，真實大小）；兩個網格（金屬、塑膠／木頭）
//     userData：{ id, muzzle, eject, grip2（左手扶的地方）, butt（槍托底：雙手槍靠肩膀）, eye（瞄準的眼睛位置）, length, flash（槍口火光的 group，開槍時亮）}
//   createGunAudio({ context, muted: () => bool, volume = 0.8 }) → { resume(), play(key, { gain, pan, rate }), shot(id), dry(), step(id, 'out'|'in'|'rack'|'shell'|'pump'),
//                         ding(pan), glass(pan), thud(pan), clank(pan), pow(pan), tink(), hold(on), dispose() }
//     Web Audio 當場合成（沒有錄音檔，第一次用到才算好放著）；跟引擎聲共用同一個 AudioContext（sound.js 的共用紀錄）
//   const gunner = createGunner({
//     scene, camera, renderer,      效果（火光、彈道、火花、彈孔、彈殼）加在 scene；renderer 算粒子大小（可省略）
//     walker,                       walk.js 的 createWalker()：鏡頭方向、人在哪裡、走路中嗎；setCamera 拉近鏡頭（瞄準）
//     character,                    角色（character.js／charstub.js）：有 character.hand（右手的掛點）就把槍放在手上、update 收到 state 'aim'、aimPitch、
//                                   weapon（'pistol'｜'long'）、support（長槍左手在握把前面幾公尺）；開槍叫 character.recoil()；
//                                   沒有的話：自己算手的位置（替身 charstub 的手臂會被擺成拿槍的樣子）
//     GAME,                         GAME.guns 在這裡（沒有就建一個空的）
//     hudParent: stage,             準星、子彈、開槍／瞄準／換彈匣按鈕放在這裡（要 position: relative；跟 walk.js 的 HUD 疊在一起、在它上面）
//     onChange(kind),               子彈、換槍有變（'ammo'｜'equip'｜'range'）：頁面存檔 save()
//     onEquip(id | null),           拿槍／收起來（頁面：拿槍的時候把「揍」的按鈕收掉，收起來再放回去）
//     onCrime(kind, info),          'gunfire' 在外面開槍｜'shoot' 打到人／路上的車｜'shootCop' 打到警察／警車；info＝{ x, z }（直接接 police.crime）
//     world: { scene, colliders, ceiling, raycast, rule, crime, name },   現在在哪裡（村子／槍店）：見 setWorld
//     targets: { peds: [人的來源], cars: [車的來源] } 或 [來源…],   打得到的人、車（gunTargets 幫你接 npc.js、police-ai.js、停著的車）
//     damage,                       damage.js（有的話）：damage.shoot(carObject, { x, y, z, nx, ny, nz, dx, dy, dz, power, glass }) → true＝它畫了（彈孔、玻璃），這裡就不畫
//     keyboard: true,               F 開槍（按住連發）、右鍵 瞄準（按著時左鍵開槍）、V 瞄準（切換）、R 換彈匣、Q 換下一把、1–4 選槍、X 收起來
//     aimAssist: true,              沒瞄準（直接按開槍）的時候：準星附近 7° 以內的人自動對準
//   });
//   每一幀：walker.update(dt) 之後叫 gunner.update(dt)，再 render（鏡頭、角色是 walker 這一格放好的）
//   gunner.setWorld({ scene, colliders, ceiling, raycast(ox, oy, oz, dx, dy, dz, maxT, out) → t, rule(x, z) → null | '不能開槍的原因', crime: true, name })
//       換地方（走進槍店、走出來）：效果搬到那個 scene、彈孔清掉；colliders＝子彈會打到的牆（跟 walk.js 同一種格式，h＝高度）
//       raycast：另外打得到的東西（靶場的靶）：打到回傳距離 t，填 out.nx/ny/nz、out.ref、out.kind（'target'…）、out.onHit(hit)；rule：這裡可不可以開槍
//   gunner.setTargets({ peds, cars } 或 [來源…])（有 box 的來源算車、其他算人：gunTargets.police(police) 回傳的兩個直接放進去）、setWalker(walker)、setCharacter(ch)
//   gunner.draw(id?)（拿槍：沒給＝上次那把）、holster()（收起來）、next()（換下一把）、reload()、setAim(on)、setTrigger(on)（程式按開槍，測試用）
//   gunner.refresh()（槍店買了東西：HUD 重畫）、setEnabled(on)（開車、看商店的時候 false）、toast(text)
//   gunner.telemetry() → { drawn, cur, mag, reserve, reloading, reload（0–1）, aiming, zoom, shots, hits, knocks, last: { kind, x, y, z }, crimes, aimKind, fx }
//   gunner.probe(ox, oy, oz, dx, dy, dz, { maxT, precise }) → { kind, t, x, y, z, nx, ny, nz, glass, ref }（測試用：子彈會打到哪裡）
//   gunner.fx（效果：spark(x, y, z, …)、dust、decal、stuck(obj)＝貼在那台車上的彈孔幾個；測試用）、gunner.dispose()
//   gunTargets：接別人的模組（都是「來源」物件，打到的時候叫它們）
//     gunTargets.pedestrians(peds)   npc.js createPedestrians()：people 裡的人（小孩打不到）；打倒＝peds.knock(p, dx, dz, 力道)；開槍＝peds.scare(x, z, r)（附近的人跑掉）
//     gunTargets.traffic(traffic)    npc.js createTraffic()：cars 裡的車（機車也算）；打到＝traffic.shot(c, hit)，沒有這個函式就 c.stun（停下來按喇叭）
//     gunTargets.police(police)      police-ai.js createPolice()：police.movers 的警車（長方形）、下車的警察（圓）；打到報 'shootCop'；
//                                   打倒警察＝police.shot(hit)、警車的彈孔貼在 police.carObject(i)、police.shotCar(i, hit)（b3-police 17:56 的 police-ai.js 已經有了）；
//                                   舊版沒有 shot 的話借 police.punch（站在子彈來的方向「揍」他：一樣倒下去、爬起來，police-ai.js 自己報 'cop'）
//     gunTargets.boxes(() => list, { kind })   停著的車（車庫車位、車店展示）：[{ x, z, hx, hz, rot, h, obj }]（obj＝那台車的 Object3D，彈孔貼在上面）
//     車的來源都有 obj(c)（那台車的 Object3D）：開槍打到長方形以後對它的網格再打一次（名字有 glass 的網格＝玻璃：carlod.js 的 lod-glass）；fine(c) 回傳 false＝只用長方形
//       （網格加起來超過 3 萬個三角形＝開車的那台完整的車：只用長方形，玻璃照位置猜；那台最好交給 damage.shoot）
// 效能：子彈用算的（長方形、圓柱跟射線直接算）；只有真的打到車的長方形，才對那台車的網格打一次（彈孔貼在真的車殼上、分得出玻璃；
//       網格先做成 BVH：準星對到車就開始做，每一格最多 1.5 毫秒，做好以前照長方形）；牆放在 8 公尺的格子裡；效果都是事先開好的池子
//       （彈道 1 個 draw call、火花 1、煙塵 1、彈孔 2、彈殼 1、火光 1）；每一幀不新增物件（音效的節點除外：Web Audio 的節點本來就是一次性的）
//
// 【接到遊戲裡：別的檔要加的東西】（guns-test.html 就是照這樣接的，可以直接抄）
//   打包：build-art.mjs、build-app.mjs 的清單把 guns.js、gunshop.js 接在 character.js、npc.js、police-ai.js 後面（gunshop.js 用 guns.js 的名字：guns.js 在前）
//   存檔（garage.src.html）：save() 多存 guns: GAME.guns；讀檔 GAME.guns = gunSave.load(存檔.guns)（舊存檔沒有 → 空的）；重新開始 → gunSave.fresh()
//   town.src.js：
//     makeWalker() 後面：gunner = createGunner({ scene: TR.scene, camera: dcam, renderer, walker, character: 走路的那個角色, GAME, hudParent: stage, keyboard: true,
//       world: { scene: TR.scene, colliders: [...VIL.colliders, ...stripColliders()], crime: true }, targets: [gunTargets.pedestrians(peds), gunTargets.traffic(traffic), gunTargets.police(police)],
//       onChange: () => save(), onEquip: (id) => 拿槍的時候「揍」的按鈕收掉、收起來放回去, onCrime: (kind, info) => police.crime(kind, info) })
//     每一格（driveStep 裡）：walker.update(dt) 後面 gunner.update(dt)；下車 leaveCar() → gunner.setEnabled(true)
//     上車、交給賽道、打開改車廠／車店（panelOpen）、回車庫頁 → gunner.setEnabled(false)（槍自己收起來、HUD 藏起來）
//     atDoor(b)：槍店那棟（VIL.places.gunshop）→ 走進槍店（gunshop.js 的【接到遊戲裡】）；在店裡：gunner.setWalker(店裡的 walker)、setWorld(店裡)、setTargets([])
//     警察抓到你（onCaught）→ gunner.holster()；錢包（renderWallet）在槍店買東西、靶場獎金之後重畫
//   walk.js：瞄準的時候人要面向準星（現在 guns.js 在 character.update 前面自己轉身體、放開瞄準再 teleport 對齊）
//     → 建議加 walker.setFacing(yaw | null)：人朝 yaw、搖桿變成橫著走（不轉身）；null＝回到正常。有了就不用 teleport
//   character.js：已經有 hand、handL、recoil()、update 的 state 'aim'｜'shoot'、aimPitch、weapon 'long'｜'pistol'、support
//     長槍：手放在眼睛前面 0.14 公尺，槍托（butt）比 0.26 公尺長會穿過頭 → 現在 guns.js 自己把槍往前推（STOCK_REACH）；建議 update 收 p.stock（槍托多長）自己把手放前面
//   npc.js：traffic.shot(c, hit)（路上的車被打到：停下來、司機跑掉⋯）；沒有的話用 c.stun。peds.knock、peds.scare 已經有了
//   damage.js：damage.shoot(carObject, hit) → true（它自己畫彈孔、玻璃裂開）；沒有的話 guns.js 自己貼彈孔、裂痕（貼在車上，跟著車動）
//   police-ai.js：police.shot(hit)（打倒警察：跟裡面的 knockOfficer 一樣）、police.carObject(i)（警車的 Object3D）、police.shotCar(i, hit)（警車被打到）
//     → b3-police 17:56 的版本已經有了（guns-test.html?pol=latest 試過：打倒警察、+1★、彈孔跟著警車走）
//     舊版沒有的話：借 police.punch（站在子彈來的方向揍他）、police._dbg.cars[i].group；'shoot'／'shootCop'／'gunfire' 三種犯罪 police-ai.js 已經有了
import * as THREE from 'three';

// 打包（build-art.mjs、build-app.mjs）會拿掉 import、把 export 變成一般宣告、所有檔接在同一個 script 裡：這個檔全部包在一個函式裡，只露出下面幾個名字
export const { GUNS, GUN_IDS, gunSave, gunShop, buildGunModel, createGunAudio, createGunner, gunTargets, GUN_ICONS, createGunArms, GUN_RANGE_REWARD } = (() => {
const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapA = (a) => { a = (a + Math.PI) % TAU; return a < 0 ? a + Math.PI : a - Math.PI; };
const smooth01 = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const toInt = (v, a, b) => { const n = Math.floor(+v); return Number.isFinite(n) ? clamp(n, a, b) : a; };
const hasDoc = () => typeof document !== 'undefined' && !!document.createElement;
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif', COND = '"Barlow Condensed", "Arial Narrow", sans-serif';

// ---- 槍的資料（價錢跟比賽獎金比：第一個對手贏一次 5 萬，買得起手槍；贏到「送貨小哥」25 萬，買得起霰彈槍）----
const GUNS = {
  pistol: { id: 'pistol', name: '手槍', tag: '半自動', desc: '輕、準，一發就能把人打倒', hold: 'one', auto: false, interval: 0.2, mag: 12, reload: 1.35,
    knock: 1, carDmg: 1, pellets: 1, spread: 1.6, aimSpread: 0.45, range: 60, zoom: 1.2, recoil: 0.028, kick: 1,
    price: 3, ammo: { price: 1, count: 48, max: 240 }, stats: { power: 3, rate: 2, range: 3, aim: 4 } },
  smg: { id: 'smg', name: '衝鋒槍', tag: '全自動', desc: '按住一直射，射得快但比較散', hold: 'two', auto: true, interval: 0.075, mag: 30, reload: 1.9,
    knock: 0.5, carDmg: 0.6, pellets: 1, spread: 3.4, aimSpread: 1.7, range: 45, zoom: 1.2, recoil: 0.009, kick: 0.55,
    price: 12, ammo: { price: 1, count: 90, max: 450 }, stats: { power: 2, rate: 5, range: 2, aim: 2 } },
  shotgun: { id: 'shotgun', name: '霰彈槍', tag: '泵動式', desc: '一次射出 8 顆小彈丸，近的時候最強', hold: 'two', auto: false, interval: 0.85, mag: 6, reload: 0, shellStart: 0.3, shell: 0.45,
    knock: 0.36, carDmg: 0.45, pellets: 8, spread: 6.5, aimSpread: 4.6, range: 28, zoom: 1.12, recoil: 0.06, kick: 1.7,
    price: 18, ammo: { price: 1, count: 24, max: 120 }, stats: { power: 5, rate: 1, range: 1, aim: 1 } },
  rifle: { id: 'rifle', name: '步槍', tag: '全自動', desc: '射得最遠最準，上面有瞄準鏡', hold: 'two', auto: true, interval: 0.105, mag: 30, reload: 2.2,
    knock: 1, carDmg: 1.4, pellets: 1, spread: 1.8, aimSpread: 0.2, range: 150, zoom: 1.9, recoil: 0.013, kick: 0.8,
    price: 30, ammo: { price: 2, count: 90, max: 360 }, stats: { power: 4, rate: 4, range: 5, aim: 5 } },
};
const GUN_IDS = ['pistol', 'smg', 'shotgun', 'rifle'];
const RANGE_REWARD = 2; // 靶場完美一輪（全部打倒）：每把槍第一次給幾萬

// 槍的側面剪影（HUD、槍店用；viewBox 0 0 64 24，fill currentColor）
const GUN_ICONS = {
  pistol: '<svg viewBox="0 0 64 24" aria-hidden="true"><path d="M15 4.5h36.5l1.5 1.6V11H34.5v1.2c0 2.9-1.9 4.6-4.6 4.6h-2.6L26 22.5h-9.6l3.1-11.3-4.5-.7z"/><path d="M28.2 12.2h2.6c0 1.6-.8 2.5-2.2 2.5z" fill="none"/></svg>',
  smg: '<svg viewBox="0 0 64 24" aria-hidden="true"><path d="M3 7.3h6.2l1-1.1h32.3V4.8h3.2v1.4h5.8v2.2H62v2.2h-10.5v2.2H43.9l.4 1.6-2.8 1v5.8h-4.8v-6.9l-4.2.1c-.4 1.9-1.8 3-3.8 3h-1.2L26 22.5h-5.6l2.1-9.1H11.4l-4.9 2.3H3z"/></svg>',
  shotgun: '<svg viewBox="0 0 64 24" aria-hidden="true"><path d="M1.5 12.6 13.3 8.3h11.9V6.4h37.3v2.8h-24v1.6h13.7v2.5H38.8c-1.2 0-1.4 1.2-2.6 1.2H26.9c-.3 1.7-1.6 2.5-3.3 2.5h-1.4l-.9-2.6h-5.9L3 18.4z"/></svg>',
  rifle: '<svg viewBox="0 0 64 24" aria-hidden="true"><path d="M1.5 10.8 11 7.7h9.4V6.2h4.2V3.4h13.2v2.8h3.7V8h8.7v-.9H56V8h7v2.1h-7v1H43.6v2.4H33.4l2.7 8.3h-4.7l-2.4-8.4h-2.6c-.1 1.7-1.4 2.7-3.1 2.7h-1.8l-2.2 4.9h-4.9l2.2-5.5-2.9-1.5-10.4 3.2z"/></svg>',
  none: '<svg viewBox="0 0 64 24" aria-hidden="true"><path d="M26 6.5c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5V11h1V5.2c0-1.4 1.1-2.5 2.5-2.5S37 3.8 37 5.2V11h1V6.6c0-1.4 1.1-2.5 2.5-2.5S43 5.2 43 6.6V15c0 4.4-3.6 8-8 8h-2.6c-2.6 0-5-1.2-6.5-3.3l-5.4-7.4c-.8-1.1-.5-2.6.6-3.4 1-.7 2.4-.5 3.2.4L26 11.6z"/></svg>',
};

// ---- 存檔 ----
const gunSave = {
  fresh() { return { owned: [], ammo: {}, mag: {}, cur: null, range: { best: {}, time: {}, paid: {} } }; },
  load(raw) {
    const G = gunSave.fresh();
    if (!raw || typeof raw !== 'object') return G;
    const own = Array.isArray(raw.owned) ? raw.owned : [];
    for (const id of GUN_IDS) if (own.includes(id)) G.owned.push(id);
    for (const id of G.owned) {
      const g = GUNS[id];
      G.ammo[id] = toInt(raw.ammo && raw.ammo[id], 0, g.ammo.max);
      G.mag[id] = toInt(raw.mag && raw.mag[id], 0, g.mag);
    }
    G.cur = G.owned.includes(raw.cur) ? raw.cur : G.owned[0] || null;
    const r = raw.range && typeof raw.range === 'object' ? raw.range : {};
    for (const id of GUN_IDS) {
      const b = toInt(r.best && r.best[id], 0, 99); if (b > 0) G.range.best[id] = b;
      const t = +(r.time && r.time[id]); if (Number.isFinite(t) && t > 0 && t < 600) G.range.time[id] = Math.round(t * 10) / 10;
      if (r.paid && r.paid[id]) G.range.paid[id] = 1;
    }
    return G;
  },
};
const gunsOf = (GAME) => (GAME.guns && Array.isArray(GAME.guns.owned) ? GAME.guns : (GAME.guns = gunSave.fresh()));

// ---- 買槍、買子彈（純邏輯）----
const gunShop = {
  total: (G, id) => (G.mag[id] || 0) + (G.ammo[id] || 0),
  ammoRoom: (G, id) => Math.max(0, GUNS[id].ammo.max - (G.ammo[id] || 0)),
  buyGun(GAME, id) {
    const g = GUNS[id]; if (!g) return { ok: false, cost: 0, msg: '沒有這種槍' };
    const G = gunsOf(GAME);
    if (G.owned.includes(id)) return { ok: false, cost: 0, msg: `${g.name}已經買過了` };
    const money = Math.floor(+GAME.money || 0);
    if (money < g.price) return { ok: false, cost: g.price, need: g.price - money, msg: `${g.name}要 ${g.price} 萬，還差 ${g.price - money} 萬` };
    GAME.money = money - g.price;
    G.owned.push(id); G.owned.sort((a, b) => GUN_IDS.indexOf(a) - GUN_IDS.indexOf(b));
    G.mag[id] = g.mag; G.ammo[id] = G.ammo[id] || 0;
    if (!G.cur) G.cur = id;
    return { ok: true, cost: g.price, msg: `買到${g.name}了！送你一個裝滿的彈匣（${g.mag} 發）` };
  },
  buyAmmo(GAME, id, boxes = 1) {
    const g = GUNS[id]; if (!g) return { ok: false, cost: 0, added: 0, msg: '沒有這種子彈' };
    const G = gunsOf(GAME);
    if (!G.owned.includes(id)) return { ok: false, cost: 0, added: 0, msg: `要先買${g.name}才能買它的子彈` };
    boxes = Math.max(1, Math.floor(+boxes || 1));
    const room = gunShop.ammoRoom(G, id);
    if (room <= 0) return { ok: false, cost: 0, added: 0, msg: `${g.name}的子彈帶滿了（最多 ${g.ammo.max} 發）` };
    const n = Math.min(boxes, Math.ceil(room / g.ammo.count)), cost = n * g.ammo.price, money = Math.floor(+GAME.money || 0);
    if (money < cost) return { ok: false, cost, added: 0, need: cost - money, msg: `一盒要 ${g.ammo.price} 萬，還差 ${cost - money} 萬` };
    const added = Math.min(room, n * g.ammo.count);
    GAME.money = money - cost; G.ammo[id] = (G.ammo[id] || 0) + added;
    return { ok: true, cost, added, msg: added < n * g.ammo.count ? `只帶得下 ${added} 發，裝滿了` : `買了 ${added} 發${g.name}子彈` };
  },
  rangeResult(GAME, id, res) {
    const G = gunsOf(GAME), g = GUNS[id], out = { best: false, reward: 0, perfect: false, msg: '' };
    if (!g || !res) return out;
    const hits = toInt(res.hits, 0, 99), total = toInt(res.total, 1, 99), time = +res.time || 0;
    if (hits > (G.range.best[id] || 0)) { G.range.best[id] = hits; out.best = true; }
    out.perfect = hits >= total;
    if (out.perfect) {
      const t = Math.round(time * 10) / 10;
      if (!G.range.time[id] || t < G.range.time[id]) { G.range.time[id] = t; out.best = true; }
      if (!G.range.paid[id]) { G.range.paid[id] = 1; out.reward = RANGE_REWARD; GAME.money = Math.floor(+GAME.money || 0) + RANGE_REWARD; }
    }
    out.msg = out.perfect ? (out.reward ? `全部打倒！${g.name}第一次完美，獎金 ${out.reward} 萬` : `全部打倒！${time.toFixed(1)} 秒`) : `打倒 ${hits} / ${total} 個`;
    return out;
  },
};

// ---- 手上的槍：子彈、換彈匣、射速（純邏輯：不管畫面，開槍的時候叫 ev.shot）----
// ev：shot(id)、dry(id)、reloadStart(id)、step(id, 'out'|'in'|'rack'|'shell'|'pump')、reloadEnd(id)、change()
function createArms(getG, ev = {}) {
  const R = { drawn: false, trig: false, want: false, wantT: 0, cd: 0, reloading: false, rT: 0, rDur: 0, steps: 0, drawT: 0, emptyT: -1, dryLatch: false, shots: 0 };
  const call = (k, ...a) => { if (ev[k]) ev[k](...a); };
  const G = () => getG();
  const cur = () => (R.drawn ? G().cur : null);
  function cancelReload() { if (R.reloading) { R.reloading = false; R.rT = 0; } }
  function draw(id) {
    const g = G(); id = id || g.cur;
    if (!id || !g.owned.includes(id)) return false;
    if (R.drawn && g.cur === id) return true;
    cancelReload(); g.cur = id; R.drawn = true; R.drawT = 0.35; R.cd = 0; R.want = false; R.emptyT = -1; R.dryLatch = false;
    call('change'); return true;
  }
  function holster() { if (!R.drawn) return; cancelReload(); R.drawn = false; R.trig = false; R.want = false; call('change'); }
  function next(dir = 1) { // 空手 → 第一把 → … → 最後一把 → 空手
    const g = G(), list = [null, ...g.owned], i = list.indexOf(cur());
    const n = list[(i + dir + list.length) % list.length];
    if (n) draw(n); else holster();
    return n;
  }
  function startReload() {
    const id = cur(); if (!id || R.reloading || R.drawT > 0) return false;
    const g = G(), W = GUNS[id];
    if ((g.mag[id] || 0) >= W.mag || !(g.ammo[id] > 0)) return false;
    R.reloading = true; R.rT = 0; R.steps = 0; R.rDur = W.shell ? W.shellStart : W.reload; R.want = false;
    call('reloadStart', id); return true;
  }
  function setTrigger(on) {
    on = !!on;
    if (on && !R.trig) { R.want = true; R.wantT = 0.4; R.dryLatch = false; } // 按一下記 0.4 秒（還在拿出來、人還在轉身：等一下就射；太早按的泵動式不會晚半秒才射）
    R.trig = on;
  }
  // 一格：回傳這一格射了幾發（ready＝人轉過去了、可以射）
  function update(dt, ready = true) {
    const n = step(dt, ready);
    if (R.want && (R.wantT -= dt) <= 0) R.want = false;
    if (R.cd < 0) R.cd = 0; // 沒在射的時候不累積（不然停一下再按會一次射兩發、半自動可以按得比射速快）
    return n;
  }
  function step(dt, ready) {
    const id = cur(); let shots = 0;
    if (!id) return 0;
    const g = G(), W = GUNS[id];
    if (R.drawT > 0) R.drawT = Math.max(0, R.drawT - dt);
    R.cd -= dt; // 連發的時候留著零頭（射速跟每秒幾格無關）
    // 換彈匣
    if (R.reloading) {
      if (!W.shell) R.want = false; // 換彈匣的時候按開槍不算（霰彈槍：按了就停下來射）
      if (W.shell) { // 霰彈槍：一顆一顆塞；中間按開槍（裡面有子彈）就停下來射
        if ((R.trig || R.want) && (g.mag[id] || 0) > 0) { R.reloading = false; call('step', id, 'pump'); }
        else {
          R.rT += dt;
          while (R.reloading && R.rT >= R.rDur) {
            R.rT -= R.rDur; R.rDur = W.shell;
            if ((g.mag[id] || 0) < W.mag && g.ammo[id] > 0) { g.mag[id] = (g.mag[id] || 0) + 1; g.ammo[id]--; call('step', id, 'shell'); call('ammo'); }
            if ((g.mag[id] || 0) >= W.mag || !(g.ammo[id] > 0)) { R.reloading = false; call('step', id, 'pump'); call('reloadEnd', id); }
          }
        }
      } else {
        R.rT += dt; const k = R.rT / R.rDur;
        const marks = id === 'pistol' ? [[0.12, 'out'], [0.55, 'in'], [0.82, 'rack']] : [[0.1, 'out'], [0.58, 'in'], [0.86, 'rack']];
        while (R.steps < marks.length && k >= marks[R.steps][0]) { call('step', id, marks[R.steps][1]); R.steps++; }
        if (R.rT >= R.rDur) {
          const n = Math.min(W.mag - (g.mag[id] || 0), g.ammo[id] || 0);
          g.mag[id] = (g.mag[id] || 0) + n; g.ammo[id] = (g.ammo[id] || 0) - n; R.reloading = false; R.rT = 0;
          call('reloadEnd', id); call('ammo');
        }
      }
      if (R.reloading) return 0;
    }
    // 彈匣空了：有備用就自己換（等最後一發的聲音 0.3 秒）
    if (!(g.mag[id] > 0)) {
      if (g.ammo[id] > 0) {
        if (R.emptyT < 0) R.emptyT = 0.3;
        R.emptyT -= dt; if (R.emptyT <= 0) { R.emptyT = -1; startReload(); }
      } else if ((R.want || R.trig) && !R.dryLatch) { R.dryLatch = true; R.want = false; call('dry', id); }
      return 0;
    }
    R.emptyT = -1;
    if (R.drawT > 0 || !ready) return 0;
    const pull = W.auto ? R.trig || R.want : R.want;
    if (R.want && R.cd < 0) R.cd = 0; // 剛按下去：從這一格開始算
    while (pull && R.cd <= 0 && g.mag[id] > 0 && shots < 3) {
      g.mag[id]--; R.cd += W.interval; shots++; R.shots++; R.want = false;
      call('shot', id);
      if (!W.auto) break;
      if (!R.trig) break;
    }
    if (shots) call('ammo');
    return shots;
  }
  return {
    draw, holster, next, reload: startReload, setTrigger, update, cancelReload,
    get cur() { return cur(); }, get drawn() { return R.drawn; }, get reloading() { return R.reloading; }, get trig() { return R.trig; },
    get reloadK() { const id = cur(); if (!R.reloading || !id) return 0; const W = GUNS[id], g = G(); return W.shell ? clamp(((g.mag[id] || 0) + R.rT / R.rDur) / W.mag, 0, 1) : clamp(R.rT / R.rDur, 0, 1); },
    get drawing() { return R.drawT > 0; }, get shots() { return R.shots; }, R,
  };
}

// ---- 槍的模型（程式做的：側面輪廓擠出來＋圓柱，照材質併成兩個網格）----
const MODEL_MATS = {};
function modelMats() {
  if (!MODEL_MATS.metal) {
    MODEL_MATS.metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.78, envMapIntensity: 1.1 });
    MODEL_MATS.matte = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.06 });
    MODEL_MATS.metal.name = 'gun-metal'; MODEL_MATS.matte.name = 'gun-matte';
  }
  return MODEL_MATS;
}
const COL = {};
const col = (hex) => COL[hex] || (COL[hex] = new THREE.Color(hex));
function outline(pts, holes) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
  for (const h of holes || []) { const p = new THREE.Path(); p.moveTo(h[0][0], h[0][1]); for (let i = 1; i < h.length; i++) p.lineTo(h[i][0], h[i][1]); p.closePath(); s.holes.push(p); }
  return s;
}
function extrude(pts, w, bev = 0.0015, holes) {
  const b = Math.min(bev, w * 0.3), g = new THREE.ExtrudeGeometry(outline(pts, holes), { depth: Math.max(0.0004, w - b * 2), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.8, bevelSegments: 1, curveSegments: 4, steps: 1 });
  g.translate(0, 0, -(w - b * 2) / 2); return g;
}
const boxG = (sx, sy, sz, x, y, z) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
function cylX(r, x0, x1, y, z = 0, seg = 12, r1) { // 沿著 x 的圓柱（x0 → x1）
  const g = new THREE.CylinderGeometry(r1 ?? r, r, Math.abs(x1 - x0), seg, 1); g.rotateZ(-Math.PI / 2); g.translate((x0 + x1) / 2, y, z); return g;
}
function cylY(r, y0, y1, x, z = 0, seg = 10) { const g = new THREE.CylinderGeometry(r, r, Math.abs(y1 - y0), seg, 1); g.translate(x, (y0 + y1) / 2, z); return g; }
// 併起來（每個零件一個顏色）：[{ g, c }] → 一個不帶索引的網格（位置、法線、頂點顏色）
function mergeParts(parts) {
  let n = 0; const gs = parts.map((p) => { const g = p.g.index ? p.g.toNonIndexed() : p.g; n += g.attributes.position.count; return g; });
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
  let o = 0;
  gs.forEach((g, i) => {
    const c = parts[i].c, pa = g.attributes.position.array, na = g.attributes.normal.array, k = g.attributes.position.count;
    P.set(pa.subarray(0, k * 3), o * 3); N.set(na.subarray(0, k * 3), o * 3);
    for (let j = 0; j < k; j++) { C[(o + j) * 3] = c.r; C[(o + j) * 3 + 1] = c.g; C[(o + j) * 3 + 2] = c.b; }
    o += k; if (g !== parts[i].g) g.dispose(); parts[i].g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  out.computeBoundingSphere();
  return out;
}
// 扳機護弓：U 形（前面圓一點），x0…x1、上面 y0、下面 y1
const guard = (x0, x1, y0, y1, w, t = 0.004) => extrude([[x0, y0], [x1, y0], [x1 + 0.004, y0 - 0.006], [x1, y1 + 0.004], [x1 - 0.008, y1], [x0 + 0.006, y1], [x0 - 0.002, y1 + 0.006]], w, 0.0012,
  [[[x0 + t, y0 - 0.001], [x1 - t * 0.6, y0 - 0.001], [x1 - t * 0.2, y0 - 0.006], [x1 - t, y1 + t + 0.003], [x1 - 0.008 - t * 0.4, y1 + t], [x0 + 0.006, y1 + t], [x0 + t, y1 + t + 0.005]]]);

const MODEL_CACHE = {};
function gunParts(id) { // → { metal: [{g, c}], matte: [{g, c}], ud }
  const M = [], T = [], m = (g, c) => M.push({ g, c: col(c) }), t = (g, c) => T.push({ g, c: col(c) });
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  let ud = null;
  if (id === 'pistol') {
    const F = '#1c1d20', S = '#454a52', D = '#0d0e10';
    t(extrude([[0.150, -0.005], [0.150, 0.018], [-0.036, 0.018], [-0.050, 0.012], [-0.056, 0.0], [-0.071, -0.088], [-0.067, -0.100], [-0.021, -0.100], [-0.017, -0.090], [-0.004, -0.024], [0.004, -0.008], [0.064, -0.008], [0.070, -0.005]], 0.026, 0.002), F); // 槍身＋握把
    t(guard(0.002, 0.062, -0.006, -0.038, 0.012), F);
    t(extrude([[0.021, -0.009], [0.028, -0.009], [0.027, -0.022], [0.021, -0.030], [0.018, -0.028], [0.022, -0.020]], 0.006, 0.0008), D); // 扳機
    t(boxG(0.050, 0.007, 0.030, -0.044, -0.1025, 0), D); // 彈匣底
    for (let i = 0; i < 6; i++) t(boxG(0.003, 0.05, 0.0275, -0.030 - i * 0.0055 + (i % 2) * 0.0003, -0.05 - i * 0.004, 0).rotateZ(0.16), '#26282c'); // 握把防滑紋
    m(extrude([[-0.052, 0.0175], [0.160, 0.0175], [0.165, 0.024], [0.165, 0.045], [0.157, 0.052], [-0.046, 0.052], [-0.052, 0.046]], 0.0255, 0.0018), S); // 滑套
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) m(boxG(0.0016, 0.026, 0.001, -0.043 + i * 0.0042, 0.035, s * 0.0131), '#2b2e33'); // 滑套後面的防滑溝
    m(boxG(0.040, 0.013, 0.001, 0.040, 0.041, 0.0132), D); // 退殼口
    m(cylX(0.0068, 0.160, 0.1665, 0.0345), '#2f3237'); m(cylX(0.0042, 0.166, 0.1672, 0.0345, 0, 10), '#050506'); // 槍口
    m(boxG(0.004, 0.006, 0.004, 0.154, 0.055, 0), D); m(boxG(0.006, 0.007, 0.007, -0.040, 0.055, -0.0065), D); m(boxG(0.006, 0.007, 0.007, -0.040, 0.055, 0.0065), D); // 準星、照門
    ud = { muzzle: V(0.168, 0.0345), eject: V(0.040, 0.047, 0.014), grip2: V(-0.02, -0.04, -0.03), butt: null, eye: V(-0.25, 0.058), length: 0.24 };
  } else if (id === 'smg') {
    const B = '#26282c', P = '#1b1c1f', G2 = '#3a3e45', D = '#0b0c0d';
    m(extrude([[-0.120, 0.0], [0.190, 0.0], [0.190, 0.074], [-0.100, 0.074], [-0.120, 0.060]], 0.048, 0.003), B); // 機匣
    m(boxG(0.25, 0.008, 0.024, 0.045, 0.080, 0), G2); for (let i = 0; i < 10; i++) m(boxG(0.012, 0.004, 0.026, -0.065 + i * 0.024, 0.086, 0), G2); // 上面的滑軌
    m(cylX(0.021, 0.19, 0.30, 0.040, 0, 12), B); for (let i = 0; i < 4; i++) for (const s of [-1, 1]) m(boxG(0.014, 0.006, 0.004, 0.215 + i * 0.022, 0.040, s * 0.020), D); // 槍管外罩（散熱孔）
    m(cylX(0.0095, 0.30, 0.334, 0.040), '#303338'); m(cylX(0.005, 0.333, 0.335, 0.040, 0, 10), '#050506');
    m(boxG(0.005, 0.02, 0.005, 0.285, 0.068, 0), D); m(boxG(0.01, 0.014, 0.022, -0.085, 0.086, 0), D); // 準星、照門
    m(boxG(0.052, 0.016, 0.002, 0.060, 0.050, 0.0245), D); // 退殼口
    t(extrude([[-0.033, 0.002], [0.012, 0.002], [0.002, -0.098], [-0.020, -0.106], [-0.047, -0.100]], 0.032, 0.003), P); // 握把
    t(guard(0.014, 0.075, 0.0, -0.034, 0.014), P);
    t(extrude([[0.036, -0.003], [0.042, -0.003], [0.041, -0.018], [0.035, -0.024], [0.032, -0.022], [0.036, -0.015]], 0.006, 0.0008), D);
    t(extrude([[0.082, 0.002], [0.122, 0.002], [0.138, -0.185], [0.098, -0.190]], 0.026, 0.002), '#222326'); // 彈匣
    t(cylY(0.0145, -0.085, 0.0, 0.245, 0, 10), P); t(boxG(0.034, 0.012, 0.03, 0.245, -0.004, 0), P); // 前握把
    for (const s of [-1, 1]) m(boxG(0.25, 0.008, 0.008, -0.245, 0.046, s * 0.019).rotateZ(0), G2); // 折疊槍托：兩根
    m(boxG(0.014, 0.10, 0.046, -0.372, 0.003, 0), G2); t(boxG(0.018, 0.105, 0.048, -0.381, 0.003, 0), P); // 托板
    ud = { muzzle: V(0.336, 0.040), eject: V(0.06, 0.06, 0.025), grip2: V(0.245, -0.045, 0), butt: V(-0.39, 0.0), eye: V(-0.36, 0.088), length: 0.73 };
  } else if (id === 'shotgun') {
    const B = '#222427', W = '#6e4424', W2 = '#5a371d', D = '#0b0c0d';
    m(extrude([[0.020, -0.004], [0.245, -0.004], [0.245, 0.070], [0.050, 0.070], [0.020, 0.058]], 0.046, 0.003), B); // 機匣
    m(cylX(0.0118, 0.245, 0.795, 0.053, 0, 14), '#26292d'); m(cylX(0.0072, 0.794, 0.797, 0.053, 0, 12), '#050506'); // 槍管
    m(cylX(0.0112, 0.245, 0.690, 0.022, 0, 12), '#2c2f33'); m(cylX(0.0122, 0.686, 0.700, 0.022, 0, 12), B); // 下面的彈倉管
    m(boxG(0.02, 0.012, 0.010, 0.690, 0.037, 0), B); // 管箍
    m(new THREE.SphereGeometry(0.0035, 8, 6).translate(0.785, 0.067, 0), '#d8d4c8'); // 準星珠
    m(boxG(0.070, 0.022, 0.002, 0.150, 0.045, 0.0235), D); // 退殼口
    m(guard(0.028, 0.098, -0.002, -0.040, 0.014), B);
    m(extrude([[0.052, -0.006], [0.058, -0.006], [0.057, -0.020], [0.051, -0.026], [0.048, -0.024], [0.052, -0.017]], 0.006, 0.0008), D);
    t(cylX(0.0245, 0.335, 0.525, 0.022, 0, 12), W); for (let i = 0; i < 7; i++) t(cylX(0.0262, 0.35 + i * 0.024, 0.358 + i * 0.024, 0.022, 0, 12), W2); // 泵動護木（有溝）
    t(extrude([[0.022, 0.064], [-0.020, 0.058], [-0.405, 0.048], [-0.405, -0.078], [-0.365, -0.082], [-0.120, -0.036], [-0.040, -0.030], [0.022, -0.004]], 0.040, 0.004), W); // 槍托
    t(boxG(0.016, 0.132, 0.044, -0.412, -0.015, 0), '#141416'); // 托底板（橡膠）
    ud = { muzzle: V(0.800, 0.053), eject: V(0.15, 0.05, 0.024), grip2: V(0.43, 0.02, 0), butt: V(-0.42, -0.012), eye: V(-0.26, 0.07), length: 1.22 };
  } else if (id === 'rifle') {
    const B = '#2a2c30', B2 = '#33363b', TN = '#8a7a58', D = '#0b0c0d';
    m(extrude([[-0.070, 0.012], [0.190, 0.012], [0.190, 0.066], [0.172, 0.076], [-0.070, 0.076]], 0.036, 0.0025), B); // 上機匣
    m(extrude([[-0.050, 0.013], [0.130, 0.013], [0.130, -0.010], [0.104, -0.030], [-0.028, -0.030], [-0.050, -0.012]], 0.034, 0.0025), B2); // 下機匣
    m(boxG(0.40, 0.008, 0.022, 0.125, 0.080, 0), B); for (let i = 0; i < 16; i++) m(boxG(0.010, 0.004, 0.024, -0.065 + i * 0.025, 0.086, 0), B); // 上面的滑軌
    t(cylX(0.027, 0.19, 0.47, 0.045, 0, 8), TN); for (let i = 0; i < 4; i++) for (const s of [-1, 1]) t(boxG(0.030, 0.008, 0.004, 0.23 + i * 0.058, 0.045, s * 0.0255), '#5e5340'); // 護木（有孔）
    m(cylX(0.0086, 0.47, 0.62, 0.045, 0, 10), '#303338'); m(cylX(0.0122, 0.605, 0.665, 0.045, 0, 10), B); m(cylX(0.0065, 0.664, 0.666, 0.045, 0, 10), '#050506'); // 槍管、槍口制退器
    for (const s of [-1, 1]) m(boxG(0.022, 0.004, 0.003, 0.635, 0.045, s * 0.012), D);
    m(extrude([[0.455, 0.070], [0.475, 0.070], [0.472, 0.100], [0.462, 0.100]], 0.006, 0.001), B); // 準星
    m(boxG(0.060, 0.016, 0.002, 0.080, 0.050, 0.0185), D); // 退殼口
    t(extrude([[0.078, -0.022], [0.088, -0.120], [0.119, -0.214], [0.080, -0.228], [0.050, -0.124], [0.037, -0.022]], 0.026, 0.002), '#2b2c2f'); // 彎彈匣
    t(extrude([[-0.030, -0.026], [0.006, -0.026], [-0.018, -0.124], [-0.042, -0.128], [-0.060, -0.120]], 0.030, 0.003), TN); // 握把
    t(guard(0.008, 0.070, -0.026, -0.052, 0.014), B2);
    t(extrude([[0.030, -0.028], [0.036, -0.028], [0.035, -0.040], [0.029, -0.046], [0.026, -0.044], [0.030, -0.037]], 0.006, 0.0008), D);
    m(cylX(0.0145, -0.25, -0.07, 0.046, 0, 10), B); // 緩衝管
    t(extrude([[-0.135, 0.068], [-0.330, 0.068], [-0.342, 0.058], [-0.342, -0.070], [-0.300, -0.076], [-0.220, -0.018], [-0.140, 0.022]], 0.036, 0.004), TN); // 槍托
    t(boxG(0.012, 0.136, 0.038, -0.347, -0.004, 0), '#141416');
    // 瞄準鏡
    m(cylX(0.0142, -0.030, 0.150, 0.114, 0, 14), '#1d1f22'); m(cylX(0.0205, 0.150, 0.200, 0.114, 0, 14, 0.0145), '#1d1f22'); m(cylX(0.0205, 0.200, 0.214, 0.114, 0, 14), '#1d1f22');
    m(cylX(0.0175, -0.068, -0.030, 0.114, 0, 14, 0.0142), '#1d1f22');
    m(cylY(0.0075, 0.114, 0.134, 0.06, 0, 8), '#1d1f22'); m(new THREE.CylinderGeometry(0.0075, 0.0075, 0.02, 8).rotateX(Math.PI / 2).translate(0.06, 0.114, 0.018), '#1d1f22'); // 旋鈕
    for (const x of [0.02, 0.12]) m(boxG(0.018, 0.022, 0.03, x, 0.094, 0), B);
    t(cylX(0.0188, 0.2135, 0.2145, 0.114, 0, 14), '#6fa4c8'); t(cylX(0.0165, -0.0695, -0.0685, 0.114, 0, 14), '#4d7fa6'); // 鏡片
    m(boxG(0.018, 0.012, 0.03, -0.075, 0.074, 0), B); // 拉柄
    ud = { muzzle: V(0.668, 0.045), eject: V(0.08, 0.05, 0.02), grip2: V(0.33, 0.02, 0), butt: V(-0.353, -0.004), eye: V(-0.14, 0.114), length: 1.02 };
  }
  return { metal: M, matte: T, ud };
}
// 槍口火光的貼圖（星形）
let FLASH_TEX = null, FLASH_MAT = null;
function flashMat() {
  if (FLASH_MAT) return FLASH_MAT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.18, 'rgba(255,236,170,0.95)'); gr.addColorStop(0.45, 'rgba(255,160,60,0.45)'); gr.addColorStop(1, 'rgba(255,100,20,0)');
  g.fillStyle = gr; g.beginPath();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r = i % 2 ? 22 : 62 - (i % 4 === 0 ? 0 : 14); g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
  g.closePath(); g.fill();
  const g2 = g.createRadialGradient(64, 64, 0, 64, 64, 30); g2.addColorStop(0, 'rgba(255,255,255,1)'); g2.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = g2; g.fillRect(0, 0, 128, 128);
  FLASH_TEX = new THREE.CanvasTexture(c); FLASH_TEX.colorSpace = THREE.SRGBColorSpace;
  FLASH_MAT = new THREE.MeshBasicMaterial({ map: FLASH_TEX, color: 0xffe2b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
  return FLASH_MAT;
}
function buildGunModel(id, o = {}) {
  if (!GUNS[id]) throw new Error('沒有這種槍：' + id);
  let geo = MODEL_CACHE[id];
  if (!geo) { const p = gunParts(id); geo = MODEL_CACHE[id] = { metal: mergeParts(p.metal), matte: mergeParts(p.matte), ud: p.ud }; }
  const M = modelMats(), grp = new THREE.Group(); grp.name = 'gun-' + id;
  const a = new THREE.Mesh(geo.metal, M.metal), b = new THREE.Mesh(geo.matte, M.matte); a.name = 'gun-metal'; b.name = 'gun-matte';
  grp.add(a, b);
  const ud = geo.ud;
  grp.userData = { id, muzzle: ud.muzzle.clone(), eject: ud.eject.clone(), grip2: ud.grip2.clone(), butt: ud.butt ? ud.butt.clone() : null, eye: ud.eye.clone(), length: ud.length, flash: null };
  if (o.flash && hasDoc()) { // 火光：兩片交叉（側面看得到火舌）＋一片朝前的
    const f = new THREE.Group(), k = { pistol: 0.75, smg: 0.8, shotgun: 1.35, rifle: 1.05 }[id], mat = flashMat();
    for (let i = 0; i < 2; i++) { const q = new THREE.Mesh(new THREE.PlaneGeometry(0.30 * k, 0.15 * k), mat); q.position.x = 0.12 * k; q.rotation.x = i * Math.PI / 2; f.add(q); }
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.17 * k, 0.17 * k), mat); d.rotation.y = Math.PI / 2; d.position.x = 0.015; f.add(d);
    f.position.copy(ud.muzzle); f.visible = false; f.name = 'gun-flash'; f.renderOrder = 5;
    f.traverse((q) => { q.frustumCulled = false; });
    grp.add(f); grp.userData.flash = f;
  }
  return grp;
}

// ---- 聲音：Web Audio 合成（沒有錄音檔）----
// 樣本第一次用到才算（一個一個 Float32Array），之後每一聲只是一個 AudioBufferSourceNode
function rngF(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; }; }
const lpK = (hz, sr) => 1 - Math.exp((-TAU * hz) / sr);
// 槍聲：爆裂的沙沙聲（濾過的雜訊、很快衰減）＋低沉的「碰」（掃頻的正弦）＋尾巴（低通雜訊慢慢消失）＋回音；機械聲（滑套、泵動）
const SHOT_P = {
  pistol: { len: 0.75, crack: 0.018, crackLP: 7000, crackAmp: 1.0, body: 170, bodyEnd: 62, bodyDecay: 0.05, bodyAmp: 0.65, tail: 0.13, tailLP: 1700, tailAmp: 0.34, echo: [[0.085, 0.24], [0.2, 0.12]], clicks: [0.035], seed: 11 },
  smg: { len: 0.5, crack: 0.012, crackLP: 8000, crackAmp: 0.9, body: 200, bodyEnd: 75, bodyDecay: 0.035, bodyAmp: 0.5, tail: 0.07, tailLP: 2100, tailAmp: 0.28, echo: [[0.07, 0.18]], clicks: [0.022], seed: 23 },
  shotgun: { len: 1.2, crack: 0.035, crackLP: 5000, crackAmp: 1.0, body: 125, bodyEnd: 42, bodyDecay: 0.11, bodyAmp: 0.95, tail: 0.24, tailLP: 1100, tailAmp: 0.45, echo: [[0.11, 0.3], [0.26, 0.16]], clicks: [0.42, 0.56], clickAmp: 0.32, seed: 37 },
  rifle: { len: 0.95, crack: 0.02, crackLP: 9500, crackAmp: 1.1, body: 150, bodyEnd: 55, bodyDecay: 0.06, bodyAmp: 0.7, tail: 0.19, tailLP: 2400, tailAmp: 0.4, echo: [[0.1, 0.28], [0.24, 0.15]], clicks: [0.03], seed: 51 },
};
function synthShot(sr, P) {
  const n = Math.ceil(P.len * sr), out = new Float32Array(n), R = rngF(P.seed * 7919);
  const a1 = lpK(P.crackLP, sr), ah = lpK(160, sr), a2 = lpK(P.tailLP, sr);
  let lp = 0, hp = 0, tl = 0, ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = R();
    lp += (w - lp) * a1; hp += (lp - hp) * ah;
    const crack = (lp - hp) * Math.exp(-t / P.crack) * (t < 0.0005 ? t / 0.0005 : 1) * P.crackAmp * 2.2;
    const f = P.bodyEnd + (P.body - P.bodyEnd) * Math.exp(-t / 0.025); ph += (TAU * f) / sr;
    const body = Math.sin(ph) * Math.exp(-t / P.bodyDecay) * P.bodyAmp * (t < 0.001 ? t / 0.001 : 1);
    tl += (w - tl) * a2;
    const tail = tl * Math.exp(-t / P.tail) * P.tailAmp * 3 * Math.min(1, t / 0.006);
    out[i] = crack + body + tail;
  }
  // 回音：延遲、比較暗的複本
  const src = out.slice(0);
  for (const [d, g] of P.echo) {
    const k = Math.floor(d * sr); let e = 0; const ae = lpK(1200, sr);
    for (let i = k; i < n; i++) { e += (src[i - k] - e) * ae; out[i] += e * g; }
  }
  for (const ct of P.clicks || []) addClick(out, sr, ct, P.clickAmp || 0.16, 2600 + (P.seed % 5) * 300, R);
  finish(out, 0.92);
  return out;
}
function addClick(out, sr, t0, amp, ring, R) { // 金屬「喀」：一小段高頻雜訊＋共鳴
  const i0 = Math.floor(t0 * sr), n = Math.min(out.length - i0, Math.floor(0.05 * sr));
  let hp = 0, ph = 0; const ah = lpK(2500, sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = R(); hp += (w - hp) * ah;
    ph += (TAU * ring) / sr;
    out[i0 + i] += ((w - hp) * Math.exp(-t / 0.0025) * 0.9 + Math.sin(ph) * Math.exp(-t / 0.012) * 0.35) * amp;
  }
}
function finish(out, peak) { // 軟削波＋正規化
  let m = 0; for (let i = 0; i < out.length; i++) { out[i] = Math.tanh(out[i] * 1.4); m = Math.max(m, Math.abs(out[i])); }
  if (m > 0) { const k = peak / m; for (let i = 0; i < out.length; i++) out[i] *= k; }
  const f = Math.min(out.length, 64); for (let i = 0; i < f; i++) out[out.length - 1 - i] *= i / f; // 尾巴收乾淨
}
function synthFx(sr, key) {
  const R = rngF(key.length * 131 + key.charCodeAt(0));
  const mk = (len) => new Float32Array(Math.ceil(len * sr));
  if (key === 'dry') { const o = mk(0.08); addClick(o, sr, 0.002, 0.8, 3400, R); finish(o, 0.5); return o; }
  if (key === 'out' || key === 'in' || key === 'rack' || key === 'shell' || key === 'pump') {
    const o = mk(0.35), slide = (t0, len, hz, amp) => { const i0 = Math.floor(t0 * sr), n = Math.floor(len * sr); let b1 = 0, b2 = 0; const a = lpK(hz, sr), b = lpK(hz * 0.5, sr); for (let i = 0; i < n && i0 + i < o.length; i++) { const w = R(); b1 += (w - b1) * a; b2 += (b1 - b2) * b; o[i0 + i] += (b1 - b2) * amp * Math.sin((Math.PI * i) / n); } };
    if (key === 'out') { addClick(o, sr, 0.004, 0.7, 2900, R); slide(0.01, 0.07, 1800, 1.2); }
    if (key === 'in') { addClick(o, sr, 0.004, 0.9, 2300, R); addClick(o, sr, 0.018, 1.0, 1900, R); slide(0.0, 0.03, 900, 1.5); }
    if (key === 'rack') { addClick(o, sr, 0.004, 0.8, 3100, R); slide(0.008, 0.06, 2200, 1.0); addClick(o, sr, 0.12, 1.0, 2600, R); }
    if (key === 'shell') { addClick(o, sr, 0.01, 0.5, 2000, R); slide(0.0, 0.08, 1300, 0.9); }
    if (key === 'pump') { slide(0.0, 0.05, 1100, 1.8); addClick(o, sr, 0.05, 0.9, 1700, R); slide(0.13, 0.05, 1300, 1.6); addClick(o, sr, 0.18, 1.0, 2100, R); }
    finish(o, 0.55); return o;
  }
  if (key === 'ding') { // 鋼靶「噹」
    const o = mk(0.9), parts = [[1320, 0.5, 0.55], [2290, 0.28, 0.3], [3510, 0.18, 0.18], [4870, 0.1, 0.1]];
    for (let i = 0; i < o.length; i++) { const t = i / sr; let v = 0; for (const [f, d, a] of parts) v += Math.sin(TAU * f * t) * Math.exp(-t / d) * a; o[i] = v * (t < 0.001 ? t / 0.001 : 1); }
    addClick(o, sr, 0, 0.6, 3000, R); finish(o, 0.6); return o;
  }
  if (key === 'glass') { // 玻璃裂開：好幾個高音的「叮」＋碎碎的雜訊
    const o = mk(0.45);
    for (let k = 0; k < 7; k++) { const f = 3000 + Math.abs(R()) * 4500, t0 = Math.abs(R()) * 0.12, i0 = Math.floor(t0 * sr), d = 0.03 + Math.abs(R()) * 0.07; for (let i = 0; i + i0 < o.length; i++) { const t = i / sr; o[i0 + i] += Math.sin(TAU * f * t) * Math.exp(-t / d) * 0.25; } }
    let hp = 0; const ah = lpK(4000, sr); for (let i = 0; i < Math.floor(0.15 * sr); i++) { const w = R(); hp += (w - hp) * ah; o[i] += (w - hp) * Math.exp(-i / sr / 0.04) * 0.8; }
    finish(o, 0.5); return o;
  }
  if (key === 'thud') { const o = mk(0.12); let lp = 0; const a = lpK(500, sr); for (let i = 0; i < o.length; i++) { const w = R(); lp += (w - lp) * a; o[i] = lp * Math.exp(-i / sr / 0.02) * 3; } addClick(o, sr, 0, 0.25, 1500, R); finish(o, 0.45); return o; }
  if (key === 'clank') { const o = mk(0.3); for (let i = 0; i < o.length; i++) { const t = i / sr; o[i] = (Math.sin(TAU * 1650 * t) * 0.5 + Math.sin(TAU * 2830 * t) * 0.3 + Math.sin(TAU * 4100 * t) * 0.15) * Math.exp(-t / 0.05); } addClick(o, sr, 0, 0.7, 2600, R); finish(o, 0.5); return o; }
  if (key === 'pow') { const o = mk(0.2); let ph = 0; for (let i = 0; i < o.length; i++) { const t = i / sr, f = 110 + 260 * Math.exp(-t / 0.03); ph += (TAU * f) / sr; o[i] = Math.sin(ph) * Math.exp(-t / 0.06) * (t < 0.002 ? t / 0.002 : 1); } finish(o, 0.55); return o; }
  if (key === 'tink') { const o = mk(0.12); const f = 5200 + Math.abs(R()) * 1500; for (let i = 0; i < o.length; i++) { const t = i / sr; o[i] = (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * f * 1.51 * t)) * Math.exp(-t / 0.025); } finish(o, 0.3); return o; }
  return mk(0.01);
}
function createGunAudio(o = {}) {
  const REC = Symbol.for('carid.engineAudio.shared');
  const S = { ctx: null, out: null, buf: {}, vol: o.volume ?? 0.8, held: false, gone: false };
  const muted = typeof o.muted === 'function' ? o.muted : () => !!o.muted;
  function ctx() {
    if (S.ctx || S.gone) return S.ctx;
    const g = globalThis;
    let c = o.context || null;
    if (!c) { // 跟引擎聲共用（sound.js 的 createEngineAudio 也會找這個）
      const rec = g[REC] || (g[REC] = { ctx: null, hid: false, n: 0 });
      if (rec.ctx && rec.ctx.state !== 'closed') c = rec.ctx;
      else { const AC = g.AudioContext || g.webkitAudioContext; if (!AC) return null; try { c = new AC({ latencyHint: 'interactive' }); } catch { c = new AC(); } rec.ctx = c; rec.n = rec.n || 0; }
    }
    try {
      const gain = c.createGain(), comp = c.createDynamicsCompressor();
      gain.gain.value = S.vol; comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.16;
      gain.connect(comp); comp.connect(o.output || c.destination);
      S.ctx = c; S.out = gain;
    } catch { S.ctx = null; }
    return S.ctx;
  }
  function buffer(key) {
    const c = ctx(); if (!c) return null;
    let b = S.buf[key]; if (b) return b;
    const sr = c.sampleRate, data = SHOT_P[key] ? synthShot(sr, SHOT_P[key]) : synthFx(sr, key);
    try { b = c.createBuffer(1, data.length, sr); b.copyToChannel ? b.copyToChannel(data, 0) : b.getChannelData(0).set(data); } catch { return null; }
    S.buf[key] = b; return b;
  }
  function play(key, p = {}) {
    try {
      if (S.gone || muted()) return;
      const c = ctx(); if (!c || c.state === 'closed') return;
      const b = buffer(key); if (!b) return;
      const src = c.createBufferSource(); src.buffer = b; src.playbackRate.value = (p.rate || 1) * (1 + (Math.random() - 0.5) * 0.06);
      const g = c.createGain(); g.gain.value = p.gain ?? 1;
      let last = g;
      if (p.pan && c.createStereoPanner) { const pn = c.createStereoPanner(); pn.pan.value = clamp(p.pan, -1, 1); g.connect(pn); last = pn; }
      src.connect(g); last.connect(S.out); src.start();
    } catch { /* 沒有聲音就算了 */ }
  }
  return {
    resume() { try { const c = ctx(); if (c && c.state === 'suspended') c.resume(); } catch { /* 算了 */ } },
    // 拿著槍的時候算一個「在用的聲音」：sound.js 就不會讓 AudioContext 睡覺（它只在沒有聲音在用的時候睡）
    hold(on) { const rec = globalThis[REC]; if (!rec || o.context || S.held === !!on) return; S.held = !!on; rec.n = Math.max(0, (rec.n || 0) + (on ? 1 : -1)); },
    play, prewarm(keys) { for (const k of keys) buffer(k); },
    shot: (id) => play(id, { gain: 1 }), dry: () => play('dry', { gain: 0.8 }), step: (id, k) => play(k, { gain: k === 'pump' ? 0.9 : 0.75 }),
    ding: (pan) => play('ding', { gain: 0.55, pan }), glass: (pan) => play('glass', { gain: 0.6, pan }), thud: (pan) => play('thud', { gain: 0.35, pan }),
    clank: (pan) => play('clank', { gain: 0.45, pan }), pow: (pan) => play('pow', { gain: 0.5, pan }), tink: () => play('tink', { gain: 0.12, rate: 0.9 + Math.random() * 0.3 }),
    get context() { return S.ctx; },
    dispose() { this.hold(false); S.gone = true; try { S.out && S.out.disconnect(); } catch { /* 算了 */ } },
  };
}

// ---- 效果：彈道、火花、煙塵、彈孔、彈殼（全部是事先開好的池子）----
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const PT_VS = 'uniform float uScale; attribute float size; attribute vec4 rgba; varying vec4 vC; void main() { vC = rgba; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uScale / max(0.05, -mv.z); }';
const PT_FS = 'varying vec4 vC; void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q); if (r > 1.0 || vC.a <= 0.0) discard; gl_FragColor = vec4(vC.rgb, vC.a * (1.0 - r) * (1.0 - r * 0.5)); \n#include <colorspace_fragment>\n }';
function createFx(o = {}) {
  const root = new THREE.Group(); root.name = 'guns-fx';
  const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), M1 = new THREE.Matrix4(), Q1 = new THREE.Quaternion(), S1 = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
  // 彈道：一條一條會往前跑的亮線（N 條四邊形，一個網格）
  const NT = 16, tr = [], tPos = new Float32Array(NT * 12), tCol = new Float32Array(NT * 12), tUv = new Float32Array(NT * 8), tIdx = new Uint16Array(NT * 6);
  for (let i = 0; i < NT; i++) {
    tr.push({ on: false, ax: 0, ay: 0, az: 0, dx: 0, dy: 0, dz: 0, len: 0, age: 0, speed: 420, w: 0.022, streak: 5 });
    tUv.set([0, 0, 0, 1, 1, 1, 1, 0], i * 8); tIdx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3).setUsage(THREE.DynamicDrawUsage)); tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3).setUsage(THREE.DynamicDrawUsage));
  tGeo.setAttribute('uv', new THREE.BufferAttribute(tUv, 2)); tGeo.setIndex(new THREE.BufferAttribute(tIdx, 1));
  const tTex = canvasTex(64, 16, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const tMesh = new THREE.Mesh(tGeo, new THREE.MeshBasicMaterial({ map: tTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }));
  tMesh.frustumCulled = false; tMesh.renderOrder = 6; tMesh.name = 'fx-tracers'; root.add(tMesh);
  // 粒子：火花（加亮）、煙塵（一般）；同一種寫法
  function pointPool(N, additive) {
    const pos = new Float32Array(N * 3), rgba = new Float32Array(N * 4), size = new Float32Array(N), P = [];
    for (let i = 0; i < N; i++) P.push({ on: false, vx: 0, vy: 0, vz: 0, age: 0, life: 1, s0: 0.05, s1: 0.05, a0: 1, g: 0, drag: 0, r: 1, gg: 1, b: 1, floor: -99 });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('rgba', new THREE.BufferAttribute(rgba, 4).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 400 } }, vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = additive ? 7 : 5; root.add(pts);
    return { N, pos, rgba, size, P, geo, mat, pts, next: 0, hi: 0, live: 0 };
  }
  const SP = pointPool(200, true), DU = pointPool(110, false);
  function emit(pool, x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a0, grav, drag, floor = -99) {
    const i = pool.next; pool.next = (i + 1) % pool.N;
    const p = pool.P[i]; p.on = true; p.age = 0; p.life = life; p.vx = vx; p.vy = vy; p.vz = vz; p.s0 = s0; p.s1 = s1; p.r = r; p.gg = g; p.b = b; p.a0 = a0; p.g = grav; p.drag = drag; p.floor = floor;
    pool.pos[i * 3] = x; pool.pos[i * 3 + 1] = y; pool.pos[i * 3 + 2] = z;
    if (i + 1 > pool.hi) pool.hi = i + 1;
  }
  const rnd = Math.random, rs = () => rnd() * 2 - 1;
  // 火花：從打到的點沿著法線彈出去（金屬亮、牆上少一點）
  function sparks(x, y, z, nx, ny, nz, n = 8, speed = 6, hot = 1) {
    for (let k = 0; k < n; k++) {
      const vx = nx * speed * (0.4 + rnd()) + rs() * speed * 0.6, vy = ny * speed * (0.4 + rnd()) + rs() * speed * 0.6 + 1.2, vz = nz * speed * (0.4 + rnd()) + rs() * speed * 0.6;
      emit(SP, x + nx * 0.01, y + ny * 0.01, z + nz * 0.01, vx, vy, vz, 0.12 + rnd() * 0.22, 0.035 * hot, 0.01, 1, 0.78 + rnd() * 0.2, 0.35 + rnd() * 0.3, 1, -9.8, 1.5, 0);
    }
  }
  function flashPt(x, y, z, size = 0.35, life = 0.06, r = 1, g = 0.85, b = 0.55) { emit(SP, x, y, z, 0, 0, 0, life, size, size * 1.4, r, g, b, 0.9, 0, 0); }
  // 煙塵：從牆上噴出來、慢慢變大變淡（顏色照打到什麼）
  function dust(x, y, z, nx, ny, nz, n = 5, c = 0.62, spread = 1) {
    for (let k = 0; k < n; k++) {
      const sp = (0.6 + rnd() * 1.6) * spread;
      emit(DU, x + nx * 0.03, y + ny * 0.03, z + nz * 0.03, nx * sp + rs() * 0.5, ny * sp + rs() * 0.5 + 0.35, nz * sp + rs() * 0.5, 0.5 + rnd() * 0.6, 0.07 + rnd() * 0.05, 0.3 + rnd() * 0.25, c, c * 0.97, c * 0.92, 0.55, 0.2, 2.2);
    }
  }
  // 玻璃碎片：亮亮的小點掉下去
  function shards(x, y, z, nx, ny, nz, n = 14) {
    for (let k = 0; k < n; k++) emit(SP, x, y, z, nx * (1 + rnd() * 2) + rs() * 1.6, ny * 1.5 + rnd() * 1.5, nz * (1 + rnd() * 2) + rs() * 1.6, 0.5 + rnd() * 0.5, 0.022, 0.018, 0.75, 0.9, 1, 0.9, -9.8, 0.5, 0.02);
  }
  // 打到人：卡通的「碰」：一團白色的星星＋幾顆黃色的小火花＋一點灰（沒有血）
  function pow(x, y, z, nx, ny, nz) {
    flashPt(x, y, z, 0.45, 0.1, 1, 1, 0.9);
    for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; emit(SP, x, y, z, Math.cos(a) * 2.6 + nx, Math.sin(a) * 2.6 + 0.6, rs() * 2 + nz, 0.22, 0.06, 0.02, 1, 0.9, 0.3, 1, -3, 2); }
    dust(x, y, z, nx, ny, nz, 3, 0.85, 0.6);
  }
  // 彈孔、玻璃裂痕：貼片（InstancedMesh），可以貼在會動的東西上（車）：記住在那個東西本地的矩陣，每一格跟著動
  const holeTex = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(8,8,9,1)'); gr.addColorStop(0.22, 'rgba(18,18,20,0.95)'); gr.addColorStop(0.34, 'rgba(70,66,60,0.75)'); gr.addColorStop(0.55, 'rgba(120,112,100,0.35)'); gr.addColorStop(1, 'rgba(120,112,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  const crackTex = canvasTex(128, 128, (g) => {
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.6; g.lineCap = 'round';
    const R = rngF(77);
    for (let k = 0; k < 11; k++) { let a = (k / 11) * TAU + R() * 0.3, x = 64, y = 64; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 4; s++) { a += R() * 0.35; const l = 10 + Math.abs(R()) * 10; x += Math.cos(a) * l; y += Math.sin(a) * l; g.lineTo(x, y); } g.stroke(); }
    g.lineWidth = 1; for (const r of [14, 26, 40]) { g.beginPath(); for (let k = 0; k <= 12; k++) { const a = (k / 12) * TAU, rr = r + R() * 4; g[k ? 'lineTo' : 'moveTo'](64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr); } g.globalAlpha = 0.55; g.stroke(); g.globalAlpha = 1; }
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 9); gr.addColorStop(0, 'rgba(20,24,28,1)'); gr.addColorStop(1, 'rgba(230,240,245,0.4)'); g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 9, 0, TAU); g.fill();
  });
  function decalPool(N, tex, blend) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, blending: blend || THREE.NormalBlending, toneMapped: true, fog: true });
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, N); mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 3;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(mesh);
    const D = []; for (let i = 0; i < N; i++) D.push({ on: false, obj: null, owner: null, gen: 0, local: new THREE.Matrix4(), world: new THREE.Matrix4(), t: 0 });
    return { N, mesh, D, next: 0 };
  }
  const HO = decalPool(90, holeTex), CR = decalPool(28, crackTex);
  function decal(pool, x, y, z, nx, ny, nz, size, obj = null, owner = null) {
    const i = pool.next; pool.next = (i + 1) % pool.N;
    const d = pool.D[i]; d.on = true; d.t = 0; d.obj = obj; d.owner = owner; d.gen = owner && owner.frames != null ? owner.frames : 0;
    V1.set(nx, ny, nz).normalize(); Q1.setFromUnitVectors(Z, V1);
    V2.set(0, 0, rnd() * TAU); M1.makeRotationZ(V2.z); // 隨便轉一下（每個孔不一樣）
    S1.set(size, size, size);
    d.world.compose(V3.set(x + V1.x * 0.004, y + V1.y * 0.004, z + V1.z * 0.004), Q1, S1).multiply(M1);
    if (obj) { obj.updateMatrixWorld(); d.local.copy(obj.matrixWorld).invert().multiply(d.world); }
    pool.mesh.setMatrixAt(i, d.world); if (i + 1 > pool.mesh.count) pool.mesh.count = i + 1; pool.mesh.instanceMatrix.needsUpdate = true;
  }
  const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
  function decalTick(pool) {
    let dirty = false;
    for (let i = 0; i < pool.mesh.count; i++) {
      const d = pool.D[i]; if (!d.on || !d.obj) continue;
      const o = d.obj, gone = !o.parent || o.visible === false || (d.owner && (d.owner.active === false || d.owner.gone || (d.owner.frames != null && d.owner.frames < d.gen)));
      if (gone) { d.on = false; d.obj = null; pool.mesh.setMatrixAt(i, HIDE); dirty = true; continue; }
      d.world.multiplyMatrices(o.matrixWorld, d.local); pool.mesh.setMatrixAt(i, d.world); dirty = true;
    }
    if (dirty) pool.mesh.instanceMatrix.needsUpdate = true;
  }
  function clearDecals() { for (const p of [HO, CR]) { for (const d of p.D) { d.on = false; d.obj = null; } p.mesh.count = 0; p.next = 0; } }
  // 彈殼：黃銅（霰彈是紅色塑膠）小圓柱，彈出去、掉在地上彈一下、躺幾秒
  const NS = 30, SH = [], shMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 7, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.85, roughness: 0.32 }), NS);
  shMesh.count = 0; shMesh.frustumCulled = false; shMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); shMesh.name = 'fx-shells'; root.add(shMesh);
  const BRASS = new THREE.Color(0xc9a24a), RED = new THREE.Color(0xb3261e);
  for (let i = 0; i < NS; i++) { SH.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0, wx: 0, wz: 0, age: 0, r: 0.0045, l: 0.02, floor: 0, rest: false, bounced: 0 }); shMesh.setColorAt(i, BRASS); }
  let shNext = 0;
  function shell(x, y, z, vx, vy, vz, kind, floor = 0) {
    const s = SH[shNext], i = shNext; shNext = (shNext + 1) % NS;
    Object.assign(s, { on: true, x, y, z, vx, vy, vz, rx: rnd() * TAU, rz: rnd() * TAU, wx: rs() * 30, wz: rs() * 30, age: 0, floor, rest: false, bounced: 0 });
    if (kind === 'shotgun') { s.r = 0.0105; s.l = 0.06; shMesh.setColorAt(i, RED); } else if (kind === 'rifle') { s.r = 0.0055; s.l = 0.045; shMesh.setColorAt(i, BRASS); } else { s.r = 0.0048; s.l = 0.02; shMesh.setColorAt(i, BRASS); }
    if (shMesh.instanceColor) shMesh.instanceColor.needsUpdate = true;
    if (i + 1 > shMesh.count) shMesh.count = i + 1;
  }
  const E1 = new THREE.Euler();
  let onTink = null;
  function update(dt, camera, pxScale) {
    // 彈道
    let any = false;
    if (camera) V3.setFromMatrixPosition(camera.matrixWorld);
    for (let i = 0; i < NT; i++) {
      const t = tr[i], o3 = i * 12;
      if (!t.on) { if (tPos[o3] !== 0 || tPos[o3 + 3] !== 0) { tPos.fill(0, o3, o3 + 12); any = true; } continue; }
      t.age += dt; const run = t.speed * t.age, head = Math.min(t.len, run), tail = Math.max(0, run - t.streak); // 頭到了打到的點就停，尾巴繼續跑到那一點＝消失
      if (tail >= t.len - 1e-3) { t.on = false; tPos.fill(0, o3, o3 + 12); any = true; continue; }
      const ax = t.ax + t.dx * tail, ay = t.ay + t.dy * tail, az = t.az + t.dz * tail, bx = t.ax + t.dx * head, by = t.ay + t.dy * head, bz = t.az + t.dz * head;
      // 側邊＝彈道方向 × 看過來的方向
      const mx = (ax + bx) / 2 - V3.x, my = (ay + by) / 2 - V3.y, mz = (az + bz) / 2 - V3.z;
      let sx = t.dy * mz - t.dz * my, sy = t.dz * mx - t.dx * mz, sz = t.dx * my - t.dy * mx; const sl = Math.hypot(sx, sy, sz) || 1, w = t.w * (0.6 + 0.4 * Math.min(1, Math.hypot(mx, my, mz) / 6));
      sx *= w / sl; sy *= w / sl; sz *= w / sl;
      tPos[o3] = ax - sx; tPos[o3 + 1] = ay - sy; tPos[o3 + 2] = az - sz; tPos[o3 + 3] = ax + sx; tPos[o3 + 4] = ay + sy; tPos[o3 + 5] = az + sz;
      tPos[o3 + 6] = bx + sx; tPos[o3 + 7] = by + sy; tPos[o3 + 8] = bz + sz; tPos[o3 + 9] = bx - sx; tPos[o3 + 10] = by - sy; tPos[o3 + 11] = bz - sz;
      const f = 1 - smooth01(tail / Math.max(0.01, t.len) - 0.6) * 0.5, c0 = 0.12 * f, c1 = 1.0 * f;
      tCol[o3] = c0; tCol[o3 + 1] = c0 * 0.8; tCol[o3 + 2] = c0 * 0.5; tCol[o3 + 3] = c0; tCol[o3 + 4] = c0 * 0.8; tCol[o3 + 5] = c0 * 0.5;
      tCol[o3 + 6] = c1; tCol[o3 + 7] = c1 * 0.86; tCol[o3 + 8] = c1 * 0.55; tCol[o3 + 9] = c1; tCol[o3 + 10] = c1 * 0.86; tCol[o3 + 11] = c1 * 0.55;
      any = true;
    }
    if (any) { tGeo.attributes.position.needsUpdate = true; tGeo.attributes.color.needsUpdate = true; }
    // 粒子
    for (const pool of [SP, DU]) {
      pool.mat.uniforms.uScale.value = pxScale || 400;
      let hi = 0, live = 0;
      for (let i = 0; i < pool.hi; i++) {
        const p = pool.P[i], i3 = i * 3, i4 = i * 4;
        if (!p.on) { pool.size[i] = 0; pool.rgba[i4 + 3] = 0; continue; }
        p.age += dt; if (p.age >= p.life) { p.on = false; pool.size[i] = 0; pool.rgba[i4 + 3] = 0; continue; }
        const k = p.age / p.life, dr = Math.exp(-p.drag * dt);
        p.vy += p.g * dt; p.vx *= dr; p.vy *= dr; p.vz *= dr;
        pool.pos[i3] += p.vx * dt; pool.pos[i3 + 1] += p.vy * dt; pool.pos[i3 + 2] += p.vz * dt;
        if (pool.pos[i3 + 1] < p.floor) { pool.pos[i3 + 1] = p.floor; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
        pool.size[i] = p.s0 + (p.s1 - p.s0) * k; pool.rgba[i4] = p.r; pool.rgba[i4 + 1] = p.gg; pool.rgba[i4 + 2] = p.b; pool.rgba[i4 + 3] = p.a0 * (1 - k) * (1 - k * 0.3);
        hi = i + 1; live++;
      }
      pool.hi = hi; pool.live = live; pool.geo.setDrawRange(0, hi); pool.pts.visible = hi > 0;
      if (hi) { pool.geo.attributes.position.needsUpdate = true; pool.geo.attributes.rgba.needsUpdate = true; pool.geo.attributes.size.needsUpdate = true; }
    }
    // 彈殼
    let sd = false;
    for (let i = 0; i < shMesh.count; i++) {
      const s = SH[i]; if (!s.on) continue;
      s.age += dt;
      if (!s.rest) {
        s.vy -= 9.8 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.rx += s.wx * dt; s.rz += s.wz * dt;
        if (s.y < s.floor + s.r) {
          s.y = s.floor + s.r;
          if (s.bounced < 2 && Math.abs(s.vy) > 0.6) { s.vy = -s.vy * 0.35; s.vx *= 0.5; s.vz *= 0.5; s.wx *= 0.5; s.wz *= 0.5; s.bounced++; if (onTink && s.bounced === 1) onTink(); }
          else { s.rest = true; s.rx = Math.PI / 2; s.wx = s.wz = 0; }
        }
      }
      const fade = s.age > 6 ? Math.max(0, 1 - (s.age - 6) / 0.6) : 1;
      if (fade <= 0) { s.on = false; shMesh.setMatrixAt(i, HIDE); sd = true; continue; }
      E1.set(s.rx, 0, s.rz); Q1.setFromEuler(E1); S1.set(s.r * fade, s.l * fade, s.r * fade);
      M1.compose(V1.set(s.x, s.y, s.z), Q1, S1); shMesh.setMatrixAt(i, M1); sd = true;
    }
    if (sd) shMesh.instanceMatrix.needsUpdate = true;
    decalTick(HO); decalTick(CR);
  }
  function tracer(ax, ay, az, bx, by, bz, o2 = {}) {
    let best = null, age = -1;
    for (const t of tr) { if (!t.on) { best = t; break; } if (t.age > age) { age = t.age; best = t; } }
    const dx = bx - ax, dy = by - ay, dz = bz - az, l = Math.hypot(dx, dy, dz) || 1;
    Object.assign(best, { on: true, ax, ay, az, dx: dx / l, dy: dy / l, dz: dz / l, len: l, age: 0, speed: o2.speed || 380, w: o2.w || 0.02, streak: Math.min(l, o2.streak || 6) });
  }
  return {
    root, tracer, sparks, dust, shards, pow, flashPt, shell, clearDecals,
    hole: (x, y, z, nx, ny, nz, size = 0.07, obj, owner) => decal(HO, x, y, z, nx, ny, nz, size, obj, owner),
    crack: (x, y, z, nx, ny, nz, size = 0.34, obj, owner) => decal(CR, x, y, z, nx, ny, nz, size, obj, owner),
    update, set onTink(f) { onTink = f; },
    stuck: (obj) => { let n = 0; for (const p of [HO, CR]) for (const d of p.D) if (d.on && d.obj === obj) n++; return n; }, // 貼在這台車上、還在的彈孔＋裂痕（測試用）
    get stats() { return { tracers: tr.filter((t) => t.on).length, sparks: SP.live, dust: DU.live, holes: HO.mesh.count, cracks: CR.mesh.count, shells: SH.filter((s) => s.on).length }; },
    dispose() { root.removeFromParent(); root.traverse((q) => { if (q.geometry) q.geometry.dispose(); if (q.material) { if (q.material.map) q.material.map.dispose(); q.material.dispose(); } }); },
  };
}

// ---- 子彈打到什麼：牆（長方形、圓柱，放在 8 公尺的格子）、地面、天花板 ----
function rayGrid(list) {
  const CELL = 8, grid = new Map(), all = [];
  const key = (gx, gz) => (gx + 32768) * 65536 + (gz + 32768);
  for (const c of list || []) {
    if (!c || !isFinite(c.x) || !isFinite(c.z)) continue;
    const box = c.t === 'box'; if (box ? !(c.hx > 0 && c.hz > 0) : !(c.r > 0)) continue;
    const rot = c.rot || 0, q = { box, x: c.x, z: c.z, hx: box ? c.hx : 0, hz: box ? c.hz : 0, r: box ? 0 : c.r, y0: c.y0 || 0, h: c.h ?? 9, u0: Math.cos(rot), u1: -Math.sin(rot), w0: Math.sin(rot), w1: Math.cos(rot), src: c, _s: 0 };
    const ex = box ? Math.abs(q.u0) * q.hx + Math.abs(q.w0) * q.hz : q.r, ez = box ? Math.abs(q.u1) * q.hx + Math.abs(q.w1) * q.hz : q.r;
    for (let gx = Math.floor((q.x - ex) / CELL); gx <= Math.floor((q.x + ex) / CELL); gx++) for (let gz = Math.floor((q.z - ez) / CELL); gz <= Math.floor((q.z + ez) / CELL); gz++) {
      const k = key(gx, gz); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(q);
    }
    all.push(q);
  }
  let stamp = 0;
  // 沿著射線走過的格子（2D DDA），每格的東西都算一次，找最近的
  function cast(ox, oy, oz, dx, dy, dz, maxT, out) {
    stamp++; let best = maxT;
    let gx = Math.floor(ox / CELL), gz = Math.floor(oz / CELL);
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) > 1e-9 ? CELL / Math.abs(dx) : Infinity, tdz = Math.abs(dz) > 1e-9 ? CELL / Math.abs(dz) : Infinity;
    let tx = Math.abs(dx) > 1e-9 ? ((dx > 0 ? (gx + 1) * CELL - ox : ox - gx * CELL) / Math.abs(dx)) : Infinity;
    let tz = Math.abs(dz) > 1e-9 ? ((dz > 0 ? (gz + 1) * CELL - oz : oz - gz * CELL) / Math.abs(dz)) : Infinity;
    let tc = 0;
    for (let it = 0; it < 256 && tc <= best; it++) {
      const a = grid.get(key(gx, gz));
      if (a) for (let i = 0; i < a.length; i++) { const q = a[i]; if (q._s === stamp) continue; q._s = stamp; const t = hitShape(q, ox, oy, oz, dx, dy, dz, best, out); if (t < best) best = t; }
      if (tx < tz) { tc = tx; tx += tdx; gx += sx; } else { tc = tz; tz += tdz; gz += sz; }
    }
    return best;
  }
  return { cast, count: all.length };
}
// 一個形狀（長方形：本地座標的三個方向各一組平面；圓柱：側面＋上下蓋）：打到回傳 t（比 best 近才填 out 的法線）
function hitShape(q, ox, oy, oz, dx, dy, dz, best, out) {
  const px = ox - q.x, pz = oz - q.z;
  let t0 = -Infinity, t1 = best, nAx = 0, nS = 0;
  if (q.box) {
    const lu = px * q.u0 + pz * q.u1, lw = px * q.w0 + pz * q.w1, du = dx * q.u0 + dz * q.u1, dw = dx * q.w0 + dz * q.w1;
    for (let k = 0; k < 2; k++) {
      const p = k ? lw : lu, d = k ? dw : du, e = k ? q.hz : q.hx;
      if (Math.abs(d) < 1e-12) { if (p > e || p < -e) return Infinity; continue; }
      let ta = (-e - p) / d, tb = (e - p) / d, s = -1; if (ta > tb) { const x = ta; ta = tb; tb = x; s = 1; }
      if (ta > t0) { t0 = ta; nAx = k; nS = s; } if (tb < t1) t1 = tb; if (t0 > t1) return Infinity;
    }
  } else {
    const A = dx * dx + dz * dz, B = px * dx + pz * dz, C = px * px + pz * pz - q.r * q.r;
    if (A < 1e-12) { if (C > 0) return Infinity; }
    else { const disc = B * B - A * C; if (disc < 0) return Infinity; const sq = Math.sqrt(disc), ta = (-B - sq) / A, tb = (-B + sq) / A; if (ta > t0) { t0 = ta; nAx = 3; } if (tb < t1) t1 = tb; if (t0 > t1) return Infinity; }
  }
  if (Math.abs(dy) < 1e-12) { if (oy < q.y0 || oy > q.h) return Infinity; }
  else { let ya = (q.y0 - oy) / dy, yb = (q.h - oy) / dy, s = -1; if (ya > yb) { const x = ya; ya = yb; yb = x; s = 1; } if (ya > t0) { t0 = ya; nAx = 2; nS = s; } if (yb < t1) t1 = yb; if (t0 > t1) return Infinity; }
  if (t1 < 0) return Infinity;
  const t = Math.max(0, t0); if (t >= best) return Infinity;
  if (out) {
    if (t0 < 0) { out.nx = -dx; out.ny = -dy; out.nz = -dz; } // 起點就在裡面
    else if (nAx === 0) { out.nx = q.u0 * nS; out.ny = 0; out.nz = q.u1 * nS; }
    else if (nAx === 1) { out.nx = q.w0 * nS; out.ny = 0; out.nz = q.w1 * nS; }
    else if (nAx === 2) { out.nx = 0; out.ny = nS; out.nz = 0; }
    else { const hx = px + dx * t, hz = pz + dz * t, l = Math.hypot(hx, hz) || 1; out.nx = hx / l; out.ny = 0; out.nz = hz / l; }
    out.ref = q.src;
  }
  return t;
}
const TMPQ = { box: true, x: 0, z: 0, hx: 0, hz: 0, r: 0, y0: 0, h: 0, u0: 1, u1: 0, w0: 0, w1: 1, src: null };
function setBoxQ(q, x, z, hx, hz, rot, y0, h, src) { q.box = true; q.x = x; q.z = z; q.hx = hx; q.hz = hz; q.y0 = y0; q.h = h; q.u0 = Math.cos(rot); q.u1 = -Math.sin(rot); q.w0 = Math.sin(rot); q.w1 = Math.cos(rot); q.src = src; return q; }
function setCylQ(q, x, z, r, y0, h, src) { q.box = false; q.x = x; q.z = z; q.r = r; q.y0 = y0; q.h = h; q.src = src; return q; }
// 車：長方形打到了、有模型的話再對模型的三角形打一次（只有真的開槍才做；準星每一格只用長方形）
//   彈孔、玻璃裂痕貼在真的車殼上；從引擎蓋上面、車頂上面飛過去的不算打到
//   玻璃＝網格或材質的名字有 glass（carlod.js 的 lod-glass、完整的車的 glass）；這台沒有分出玻璃的網格（警車：玻璃畫在貼圖上）→ glass＝null，照長方形猜
//   回傳 t（out 填法線、glass）；Infinity＝模型沒打到；−1＝沒有可以打的網格、或網格太大（開車的那台完整的車）：照長方形算
//   BVH（三角形分成一層一層的盒子，放在 WeakMap：同一種車共用）：準星對到車、或第一次打到那種車才開始做，每一格做一點（1.5 毫秒，不會卡）
//   做好以前那台車照長方形算；做好了一顆子彈只看幾十個三角形，不新增物件
const RC_MAX_TRIS = 30000; // 一台車的網格加起來超過這麼多三角形（開車的那台完整的車）：不做 BVH，照長方形算
const GLASS_RE = /glass|window|windshield|windscreen/i;
const matOf = (m, i) => (Array.isArray(m.material) ? m.material[i || 0] || m.material[0] : m.material);
const rcOk = (m) => m.isMesh && !m.isSkinnedMesh && !m.isInstancedMesh && !!m.geometry && !!m.material && !!m.geometry.attributes.position // 人（有骨頭的）、一大堆一樣的東西：不算
  && !m.geometry.morphAttributes.position && matOf(m, 0).blending !== THREE.AdditiveBlending; // 發光的貼片（霓虹燈、警示燈的光）
const BVH = new WeakMap(), BV_PENDING = new Set(), BV_LEAF = 6, BV_STACK = new Int32Array(256);
const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
const bvhReady = (g) => { const S = BVH.get(g), I = g.index; return S && S.done && S.ver === g.attributes.position.version && S.iver === (I ? I.version : 0) ? S : null; };
// 做 ms 毫秒（Infinity＝一次做完）；回傳做好了沒（沒做完的下次接著做）
function bvhWork(g, ms) {
  const P = g.attributes.position, I = g.index, iv = I ? I.version : 0;
  let S = BVH.get(g);
  if (!S || S.ver !== P.version || S.iver !== iv) { S = { done: false, ver: P.version, iver: iv, stage: 0, i: 0, n: Math.floor((I ? I.count : P.count) / 3) }; BVH.set(g, S); }
  if (S.done) return true;
  const t0 = nowMs(), n = S.n, late = () => nowMs() - t0 > ms;
  if (S.stage === 0) { S.tri = new Float32Array(n * 9); S.cen = new Float32Array(n * 3); S.ord = new Uint32Array(n); S.stage = 1; S.i = 0; }
  if (S.stage === 1) { // 三角形抄出來（網格自己的座標）、中心點
    const tri = S.tri, cen = S.cen, ord = S.ord, pa = !P.isInterleavedBufferAttribute && P.itemSize === 3 && !P.normalized ? P.array : null, ia = I ? I.array : null;
    let i = S.i;
    while (i < n) {
      for (const e = Math.min(n, i + 2048); i < e; i++) {
        const o = i * 9;
        for (let k = 0; k < 3; k++) {
          const v = ia ? ia[i * 3 + k] : i * 3 + k, q = o + k * 3;
          if (pa) { tri[q] = pa[v * 3]; tri[q + 1] = pa[v * 3 + 1]; tri[q + 2] = pa[v * 3 + 2]; } else { tri[q] = P.getX(v); tri[q + 1] = P.getY(v); tri[q + 2] = P.getZ(v); }
        }
        cen[i * 3] = (tri[o] + tri[o + 3] + tri[o + 6]) / 3; cen[i * 3 + 1] = (tri[o + 1] + tri[o + 4] + tri[o + 7]) / 3; cen[i * 3 + 2] = (tri[o + 2] + tri[o + 5] + tri[o + 8]) / 3;
        ord[i] = i;
      }
      if (i < n && late()) { S.i = i; return false; }
    }
    const maxN = 2 * n + 1; S.bb = new Float32Array(maxN * 6); S.nd = new Int32Array(maxN * 2); S.ax = new Uint8Array(maxN); S.task = [0, 0, n]; S.used = 1; S.stage = 2;
  }
  if (S.stage === 2) { // 一層一層切開：從最長那一邊的中間切（全部在同一邊：對半分），六個以下是葉子
    const tri = S.tri, cen = S.cen, ord = S.ord, bb = S.bb, nd = S.nd, axs = S.ax, task = S.task;
    let used = S.used, work = 0;
    while (task.length) {
      const e = task.pop(), st = task.pop(), node = task.pop();
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity;
      for (let j = st; j < e; j++) {
        const t = ord[j] * 9, c = ord[j] * 3;
        for (let k = t, ke = t + 9; k < ke; k += 3) { const x = tri[k], y = tri[k + 1], z = tri[k + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
        const cx = cen[c], cy = cen[c + 1], cz = cen[c + 2]; if (cx < cx0) cx0 = cx; if (cx > cx1) cx1 = cx; if (cy < cy0) cy0 = cy; if (cy > cy1) cy1 = cy; if (cz < cz0) cz0 = cz; if (cz > cz1) cz1 = cz;
      }
      const b = node * 6; bb[b] = x0; bb[b + 1] = y0; bb[b + 2] = z0; bb[b + 3] = x1; bb[b + 4] = y1; bb[b + 5] = z1;
      work += e - st;
      if (e - st <= BV_LEAF) { nd[node * 2] = st; nd[node * 2 + 1] = e - st; }
      else {
        let ax = 0, ext = cx1 - cx0; if (cy1 - cy0 > ext) { ax = 1; ext = cy1 - cy0; } if (cz1 - cz0 > ext) { ax = 2; ext = cz1 - cz0; }
        let mid = (st + e) >> 1;
        if (ext > 1e-9) {
          const sp = ax === 0 ? (cx0 + cx1) / 2 : ax === 1 ? (cy0 + cy1) / 2 : (cz0 + cz1) / 2;
          let i = st, j = e - 1;
          while (i <= j) { if (cen[ord[i] * 3 + ax] < sp) i++; else { const x = ord[i]; ord[i] = ord[j]; ord[j] = x; j--; } }
          if (i > st && i < e) mid = i;
        }
        const L = used; used += 2;
        nd[node * 2] = L; nd[node * 2 + 1] = 0; axs[node] = ax;
        task.push(L, st, mid, L + 1, mid, e);
      }
      if (work > 8192) { work = 0; if (task.length && late()) { S.used = used; return false; } }
    }
    S.used = used; S.stage = 3; S.i = 0; S.T = new Float32Array(n * 9);
  }
  if (S.stage === 3) { // 照葉子的順序重新放（一個葉子的三角形連在一起）
    const T = S.T, tri = S.tri, ord = S.ord;
    let j = S.i;
    while (j < n) {
      for (const e = Math.min(n, j + 4096); j < e; j++) { const a = ord[j] * 9, o = j * 9; for (let k = 0; k < 9; k++) T[o + k] = tri[a + k]; }
      if (j < n && late()) { S.i = j; return false; }
    }
    S.bb = S.bb.slice(0, S.used * 6); S.nd = S.nd.slice(0, S.used * 2); S.ax = S.ax.slice(0, S.used);
    S.tri = T; S.orig = ord; S.T = null; S.cen = null; S.ord = null; S.task = null; S.stage = 4; S.done = true;
  }
  return true;
}
// 每一格：排隊的網格做一點（ms 毫秒）
function bvhPump(ms) {
  const t0 = nowMs();
  for (const g of BV_PENDING) { const left = ms - (nowMs() - t0); if (left <= 0) break; if (bvhWork(g, left)) BV_PENDING.delete(g); else break; }
}
function triHit(T, o, ox, oy, oz, dx, dy, dz) { // Möller–Trumbore（兩面都算）
  const ax = T[o], ay = T[o + 1], az = T[o + 2], e1x = T[o + 3] - ax, e1y = T[o + 4] - ay, e1z = T[o + 5] - az, e2x = T[o + 6] - ax, e2y = T[o + 7] - ay, e2z = T[o + 8] - az;
  const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
  if (det > -1e-14 && det < 1e-14) return Infinity;
  const inv = 1 / det, sx = ox - ax, sy = oy - ay, sz = oz - az, u = (sx * px + sy * py + sz * pz) * inv; if (u < 0 || u > 1) return Infinity;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) * inv; if (v < 0 || u + v > 1) return Infinity;
  return (e2x * qx + e2y * qy + e2z * qz) * inv;
}
function bvhCast(B, ox, oy, oz, dx, dy, dz, near, far, out) { // 網格自己的座標；回傳 t（跟世界座標的 t 一樣：方向沒有正規化），out.i＝第幾個三角形
  const bb = B.bb, nd = B.nd, T = B.tri, ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
  let sp = 0, best = far, hi = -1;
  BV_STACK[sp++] = 0;
  while (sp) {
    const i = BV_STACK[--sp], b = i * 6;
    let t0 = near, t1 = best, ta = (bb[b] - ox) * ix, tb = (bb[b + 3] - ox) * ix, x;
    if (ta > tb) { x = ta; ta = tb; tb = x; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) continue;
    ta = (bb[b + 1] - oy) * iy; tb = (bb[b + 4] - oy) * iy; if (ta > tb) { x = ta; ta = tb; tb = x; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) continue;
    ta = (bb[b + 2] - oz) * iz; tb = (bb[b + 5] - oz) * iz; if (ta > tb) { x = ta; ta = tb; tb = x; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) continue;
    const cnt = nd[i * 2 + 1];
    if (cnt) { for (let k = nd[i * 2], e = k + cnt; k < e; k++) { const t = triHit(T, k * 9, ox, oy, oz, dx, dy, dz); if (t >= near && t < best) { best = t; hi = k; } } }
    else if (sp < BV_STACK.length - 2) { // 近的那一邊先看（找到了，遠的那一邊多半就不用看了）
      const L = nd[i * 2], a = B.ax[i], d = a === 0 ? dx : a === 1 ? dy : dz;
      if (d > 0) { BV_STACK[sp++] = L + 1; BV_STACK[sp++] = L; } else { BV_STACK[sp++] = L; BV_STACK[sp++] = L + 1; }
    }
  }
  out.i = hi; return hi >= 0 ? best : Infinity;
}
const RC_ST = { n: 0, tris: 0, pending: 0, glassMesh: false, sync: false, t: Infinity, mesh: null, B: null, i: -1, ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0, near: 0, far: 0 }, RC_OUT = { i: -1 };
const RC_INV = new THREE.Matrix4(), RC_M3 = new THREE.Matrix3(), RC_O = new THREE.Vector3(), RC_D = new THREE.Vector3(), RC_N = new THREE.Vector3();
function isGlass(m) {
  if (GLASS_RE.test(m.name)) return true;
  const M = m.material; if (!Array.isArray(M)) return GLASS_RE.test(M.name || '');
  for (let i = 0; i < M.length; i++) if (M[i] && GLASS_RE.test(M[i].name || '')) return true;
  return false;
}
const rcCount = (m) => { if (!rcOk(m)) return; const g = m.geometry; RC_ST.n++; RC_ST.tris += (g.index ? g.index.count : g.attributes.position.count) / 3; if (!bvhReady(g)) RC_ST.pending++; if (!RC_ST.glassMesh && isGlass(m)) RC_ST.glassMesh = true; };
const rcQueue = (m) => { if (rcOk(m) && !bvhReady(m.geometry)) BV_PENDING.add(m.geometry); };
const rcBuild = (m) => { if (rcOk(m)) bvhWork(m.geometry, Infinity); };
// 準星對到車：先把那台車的 BVH 排進去做（等一下開槍就好了）
function warmCar(obj) {
  for (let o = obj; o; o = o.parent) if (!o.visible) return;
  RC_ST.n = 0; RC_ST.tris = 0; RC_ST.pending = 0; RC_ST.glassMesh = false;
  obj.traverseVisible(rcCount);
  if (RC_ST.pending && RC_ST.tris <= RC_MAX_TRIS) obj.traverseVisible(rcQueue);
}
const rcVisit = (m) => {
  if (!rcOk(m)) return;
  const B = bvhReady(m.geometry); if (!B || !B.n) return;
  RC_INV.copy(m.matrixWorld).invert(); RC_M3.setFromMatrix4(RC_INV);
  RC_O.set(RC_ST.ox, RC_ST.oy, RC_ST.oz).applyMatrix4(RC_INV); RC_D.set(RC_ST.dx, RC_ST.dy, RC_ST.dz).applyMatrix3(RC_M3);
  const t = bvhCast(B, RC_O.x, RC_O.y, RC_O.z, RC_D.x, RC_D.y, RC_D.z, RC_ST.near, Math.min(RC_ST.far, RC_ST.t), RC_OUT);
  if (t < RC_ST.t && RC_ST.oy + RC_ST.dy * t > 0.08) { RC_ST.t = t; RC_ST.mesh = m; RC_ST.B = B; RC_ST.i = RC_OUT.i; } // 地上的影子不算
};
function refineCar(obj, ox, oy, oz, dx, dy, dz, t0, far, out) {
  RC_ST.n = 0; RC_ST.tris = 0; RC_ST.pending = 0; RC_ST.glassMesh = false;
  for (let o = obj; o; o = o.parent) if (!o.visible) return Infinity; // 藏起來的車（還沒載好、太遠）：打不到
  obj.traverseVisible(rcCount); // 藏起來的零件不算
  if (!RC_ST.n || RC_ST.tris > RC_MAX_TRIS) return -1;
  if (RC_ST.pending) { // BVH 還沒做好：排進去，這一顆照長方形（測試的 probe：當場做完）
    if (!RC_ST.sync) { obj.traverseVisible(rcQueue); return -1; }
    obj.traverseVisible(rcBuild);
  }
  RC_ST.t = Infinity; RC_ST.mesh = null; RC_ST.B = null; RC_ST.i = -1;
  RC_ST.ox = ox; RC_ST.oy = oy; RC_ST.oz = oz; RC_ST.dx = dx; RC_ST.dy = dy; RC_ST.dz = dz; RC_ST.near = Math.max(0, t0 - 0.05); RC_ST.far = far;
  obj.updateMatrixWorld(true);
  obj.traverseVisible(rcVisit);
  const m = RC_ST.mesh; if (!m) return Infinity;
  const T = RC_ST.B.tri, o = RC_ST.i * 9, e1x = T[o + 3] - T[o], e1y = T[o + 4] - T[o + 1], e1z = T[o + 5] - T[o + 2], e2x = T[o + 6] - T[o], e2y = T[o + 7] - T[o + 1], e2z = T[o + 8] - T[o + 2];
  RC_N.set(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x).applyMatrix3(RC_M3.getNormalMatrix(m.matrixWorld)).normalize();
  if (RC_N.x * dx + RC_N.y * dy + RC_N.z * dz > 0) RC_N.negate();
  out.nx = RC_N.x; out.ny = RC_N.y; out.nz = RC_N.z;
  let mat = m.material;
  if (Array.isArray(mat)) { const f = RC_ST.B.orig[RC_ST.i] * 3; let mi = 0; for (const gr of m.geometry.groups) if (f >= gr.start && f < gr.start + gr.count) { mi = gr.materialIndex || 0; break; } mat = matOf(m, mi); }
  out.glass = RC_ST.glassMesh ? GLASS_RE.test(m.name) || GLASS_RE.test((mat && mat.name) || '') : null;
  RC_ST.mesh = null; RC_ST.B = null;
  return RC_ST.t;
}
// 沒有模型（或沒分玻璃）：照長方形猜是不是玻璃：車身上半部的車窗那一圈（前擋往後斜、後擋往前斜；引擎蓋、行李箱不算）
function boxGlass(b, hx, hz, hy) {
  const s = (hy / b.h - 0.64) / 0.32; if (s < 0 || s > 1) return false;
  const lu = hx * Math.cos(b.rot) - hz * Math.sin(b.rot); // 往車頭是正的
  return lu < b.hx * (0.42 - 0.3 * s) && lu > -b.hx * (0.62 - 0.24 * s);
}

// ---- 接別人的模組：人、車的「來源」 ----
const BOX = { x: 0, z: 0, hx: 0, hz: 0, rot: 0, h: 1.4 };
const gunTargets = {
  // npc.js createPedestrians()：people 裡的人（倒在地上的不算：不會一直打倒在地上的人；小孩打不到：子彈從旁邊過去、自動瞄準也不會對到小孩）
  pedestrians(peds) {
    const DOWN = { fall: 1, lie: 1, getup: 1, enter: 1, sit: 0 };
    return {
      kind: 'ped', list: () => (peds && peds.people) || [],
      skip: (p) => !p || p.gone || p.active === false || p.age === 'kid' || DOWN[p.mode] === 1 || (p.ch && p.ch.group && p.ch.group.visible === false),
      r: (p) => Math.max(0.28, p.r || 0.3), h: (p) => (p.mode === 'sit' ? 1.3 : p.age === 'kid' ? 1.3 : p.ch && p.ch.height ? p.ch.height : 1.7),
      knock: (p, hit) => { if (peds && peds.knock) peds.knock(p, hit.dx, hit.dz, 3.5 + hit.power * 3, null); },
      scare: (x, z, r) => { if (peds && peds.scare) peds.scare(x, z, r); },
    };
  },
  // npc.js createTraffic()：路上的車、機車
  traffic(traffic) {
    return {
      kind: 'traffic', list: () => (traffic && traffic.cars) || [],
      box: (c, o) => { if (!c || c.active === false) return null; o.x = c.x; o.z = c.z; o.hx = c.hx; o.hz = c.hz; o.rot = c.heading; o.h = c.kind === 'scooter' ? 1.25 : 1.45; return o; },
      obj: (c) => c.obj || null, fine: (c) => c.kind !== 'scooter', // 機車：騎士是有骨頭的人（模型打不到）→ 照長方形
      shot: (c, hit) => { if (traffic && traffic.shot) traffic.shot(c, hit); else { c.stun = Math.max(c.stun || 0, 2.5 + Math.random()); c.hitCool = Math.max(c.hitCool || 0, 1); } },
    };
  },
  // police-ai.js createPolice()：警車、下車的警察（police.movers：前 3 個是警車的長方形、後 3 個是下車的警察的圓）
  //   打倒警察：police.shot(hit)（hit＝{ x, z, dx, dz }；它不報犯罪 → 這裡報 'shootCop'）；舊版沒有的話借 police.punch：站在子彈來的方向 0.75 公尺「揍」他
  //   （一樣倒下去、爬起來；police-ai.js 自己報 'cop' +1★ → knock 回傳 true，這裡就不再報 'shootCop'）
  //   警車的彈孔貼在車上：police.carObject(i) → 那台的 Object3D；舊版沒有就用 police._dbg.cars[i].group（測試用的後門，有就用）
  police(police) {
    const MX = () => (police && police.movers) || [], ME = { x: 0, z: 0, heading: 0 }, NO = [];
    const carObj = (m) => {
      const i = MX().indexOf(m); if (i < 0) return null;
      if (police.carObject) return police.carObject(i) || null;
      const c = police._dbg && police._dbg.cars && police._dbg.cars[i];
      return (c && c.group) || null;
    };
    return [
      { kind: 'police', cop: true, list: MX, skip: (m) => m.t !== 'circle' || !(m.r > 0), r: () => 0.32, h: () => 1.8,
        knock: (m, hit) => {
          if (police.shot) { police.shot(hit); return false; }
          if (!police.punch) return false;
          const l = Math.hypot(hit.dx, hit.dz) || 1, ux = hit.dx / l, uz = hit.dz / l;
          ME.x = m.x - ux * 0.75; ME.z = m.z - uz * 0.75; ME.heading = Math.atan2(-uz, ux);
          return !!police.punch(ME, NO, null);
        } },
      { kind: 'police', cop: true, list: MX, box: (m, o) => { if (m.t !== 'box' || !(m.hx > 0)) return null; o.x = m.x; o.z = m.z; o.hx = m.hx; o.hz = m.hz; o.rot = m.rot; o.h = m.h || 1.6; return o; },
        obj: carObj, shot: (m, hit) => { if (police.shotCar) police.shotCar(MX().indexOf(m), hit); } },
    ];
  },
  // 停著的車：list() → [{ x, z, hx, hz, rot, h, obj }]
  boxes(list, o = {}) {
    return { kind: o.kind || 'parked', cop: !!o.cop, list, box: (c, b) => { b.x = c.x; b.z = c.z; b.hx = c.hx; b.hz = c.hz; b.rot = c.rot || 0; b.h = c.h || 1.35; return b; }, obj: (c) => c.obj || null, shot: o.shot || null };
  },
};

// ---- HUD（跟 walk.js 的 .wk 同一個樣子：深色半透明、橘色）----
const CSS = `
.gn{position:absolute;inset:0;pointer-events:none;z-index:4;color:#F2F3F5;font-family:${SANS};-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;overflow:hidden}
.gn[hidden],.gn [hidden]{display:none!important}
.gn>*{position:absolute}
.gn-x{left:50%;top:50%;width:0;height:0;--g:9px;transition:opacity .1s}
.gn-x i{position:absolute;display:block;background:#F2F3F5;border-radius:1px;box-shadow:0 0 0 1px rgba(14,15,18,.6)}
.gn-x i:nth-child(1){width:2px;height:9px;left:-1px;bottom:var(--g)}
.gn-x i:nth-child(2){width:2px;height:9px;left:-1px;top:var(--g)}
.gn-x i:nth-child(3){width:9px;height:2px;top:-1px;right:var(--g)}
.gn-x i:nth-child(4){width:9px;height:2px;top:-1px;left:var(--g)}
.gn-x b{position:absolute;left:-2px;top:-2px;width:4px;height:4px;border-radius:50%;background:#F2F3F5;box-shadow:0 0 0 1px rgba(14,15,18,.6)}
.gn-x.hot i,.gn-x.hot b{background:#FF6A1F}
.gn-x.scope::before{content:"";position:absolute;left:-46px;top:-46px;width:88px;height:88px;border-radius:50%;box-shadow:0 0 0 2px rgba(242,243,245,.7),0 0 0 3px rgba(14,15,18,.35)}
.gn-hit{left:50%;top:50%;width:0;height:0;opacity:0;transition:opacity .16s}
.gn-hit.on{opacity:1;transition:none}
.gn-hit i{position:absolute;left:-1px;top:-1px;width:2.5px;height:10px;background:#F2F3F5;box-shadow:0 0 0 1px rgba(14,15,18,.5);transform-origin:1px 1px}
.gn-hit i:nth-child(1){transform:rotate(45deg) translateY(7px)}.gn-hit i:nth-child(2){transform:rotate(135deg) translateY(7px)}
.gn-hit i:nth-child(3){transform:rotate(225deg) translateY(7px)}.gn-hit i:nth-child(4){transform:rotate(315deg) translateY(7px)}
.gn-hit.ko i{background:#FF6A1F}
.gn-pill{top:196px;right:10px;display:flex;align-items:center;gap:7px;height:46px;box-sizing:border-box;padding:0 12px 0 10px;border:0;border-radius:999px;background:rgba(14,15,18,.62);color:#F2F3F5;pointer-events:auto;cursor:pointer;touch-action:manipulation;overflow:hidden}
.gn-pill svg{flex:none;width:44px;height:17px;fill:currentColor}
.gn-pill .n{font:700 13px/1.1 ${SANS};white-space:nowrap}
.gn-pill .a{font:700 23px/1 ${COND};letter-spacing:.02em;font-variant-numeric:tabular-nums;white-space:nowrap}
.gn-pill .a small{font:600 16px/1 ${COND};color:#C6CAD1;margin-left:1px}
.gn-pill.low .a b{color:#FF6A1F}
.gn-pill.out .a b{color:#FF5A4F}
.gn-pill .bar{position:absolute;left:12px;right:12px;bottom:5px;height:3px;border-radius:2px;background:rgba(242,243,245,.22);overflow:hidden}
.gn-pill .bar i{display:block;height:100%;width:0;background:#FF6A1F}
.gn-pill.bare .a{display:none}
.gn-pill.bare{padding-right:14px}
.gn-wheel{top:250px;right:10px;display:flex;flex-direction:column;align-items:stretch;gap:6px;pointer-events:auto;max-height:calc(100% - 262px);overflow-y:auto;scrollbar-width:none}
/* 被通緝（police-ai.js 在 hudParent 加 pw-on）：上面多一條星星，walk.js 右上角的小地圖、鏡頭按鈕往下推 46px；子彈的膠囊、換槍的清單也一起往下 */
.pw-host .gn-pill,.pw-host .gn-wheel{transition:margin-top .2s}
.pw-host.pw-on .gn-pill,.pw-host.pw-on .gn-wheel{margin-top:46px}
.pw-host.pw-on .gn-wheel{max-height:calc(100% - 308px)}
.gn.wheel .gn-b{display:none}
.gn-wheel button{display:flex;align-items:center;gap:9px;height:44px;min-width:168px;padding:0 12px 0 10px;border:0;border-radius:14px;background:rgba(14,15,18,.82);color:#F2F3F5;font:700 15px ${SANS};cursor:pointer;touch-action:manipulation;text-align:left}
.gn-wheel button svg{flex:none;width:40px;height:15px;fill:currentColor}
.gn-wheel button small{margin-left:auto;font:600 16px ${COND};color:#C6CAD1;font-variant-numeric:tabular-nums}
.gn-wheel button[aria-pressed="true"]{background:#FF6A1F;color:#1A0F07}
.gn-wheel button[aria-pressed="true"] small{color:#1A0F07}
.gn-b{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;border-radius:50%;background:rgba(14,15,18,.62);box-shadow:0 4px 0 rgba(0,0,0,.35);pointer-events:auto;touch-action:none;cursor:pointer;color:#F2F3F5}
.gn-b svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.gn-b span{font:700 13px/1 ${SANS}}
.gn-fire{right:16px;bottom:26px;width:90px;height:90px;background:#FF6A1F;color:#1A0F07;box-shadow:0 5px 0 #9E4213}
.gn-fire svg{width:34px;height:34px}
.gn-fire span{font-size:15px}
.gn-fire.on{transform:translateY(4px);box-shadow:0 1px 0 #9E4213}
.gn-fire.empty{background:#6b6e75;box-shadow:0 5px 0 #3b3d42}
.gn-aim{right:116px;bottom:84px;width:66px;height:66px}
.gn-aim.on,.gn-aim[aria-pressed="true"]{background:#F2F3F5;color:#1A0F07}
.gn-rel{right:24px;bottom:132px;width:52px;height:52px}
.gn-rel svg{width:22px;height:22px}
.gn-rel span{font-size:11px}
.gn-rel.on{background:#FF6A1F;color:#1A0F07}
.gn kbd{display:none}
@media (hover:hover) and (pointer:fine){.gn kbd{display:block;position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;border-radius:6px;background:#F2F3F5;color:#1A0F07;font:700 13px/20px ${COND};text-align:center}}
@media (prefers-reduced-motion:reduce){.gn-x,.gn-hit{transition:none}}
`;
const ICON = {
  fire: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5"/><path d="M12 1.8v5M12 17.2v5M1.8 12h5M17.2 12h5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>',
  aim: '<svg viewBox="0 0 24 24"><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><circle cx="12" cy="12" r="3.2"/></svg>',
  rel: '<svg viewBox="0 0 24 24"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 3.6v4.6h-4.6"/></svg>',
};

// ---- 走路拿槍：createGunner ----
function createGunner(o = {}) {
  let walker = o.walker || null, ch = o.character || null, scene = o.scene || null;
  const camera = o.camera, renderer = o.renderer || null, GAME = o.GAME || { money: 0 };
  const G = () => gunsOf(GAME);
  const doc = hasDoc() && !!o.hudParent;
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const audio = o.audio && o.audio.play ? o.audio : doc ? createGunAudio(o.audio || {}) : null;
  const fx = doc ? createFx() : null;
  if (fx) { fx.onTink = () => { if (audio) audio.tink(); }; if (scene) scene.add(fx.root); }
  let world = null, grid = null, targets = { peds: [], cars: [] };
  let alive = true, enabled = true, now = 0, lastT = null;
  const stat = { shots: 0, hits: 0, knocks: 0, crimes: [], last: null };
  // 瞄準、開槍的狀態
  const A = { held: 0, latched: false, mouse: false, key: false, aiming: false, zoom: 1, hipT: 0, faceYaw: 0, facing: false, prevDist: null, trig: { btn: false, key: false, mouse: false, prog: false }, kick: 0, bloom: 0, recoil: 0, aimKind: 'none', aimRef: null, posed: false, warm: null };
  const arms = createArms(G, {
    shot: (id) => onShot(id),
    dry: () => { if (audio) audio.dry(); toast(G().owned.length ? `${GUNS[arms.cur || G().cur].name}沒子彈了：去槍店買` : ''); },
    step: (id, k) => { if (audio) audio.step(id, k); },
    reloadStart: () => { hudDirty = true; },
    reloadEnd: () => { hudDirty = true; },
    ammo: () => { hudDirty = true; ammoDirty = true; },
    change: () => { hudDirty = true; equipChanged(); },
  });
  let hudDirty = true, ammoDirty = false, ammoT = 0;
  // ---- 暫存（每一幀重複用）----
  const CP = new THREE.Vector3(), CD = new THREE.Vector3(), AP = new THREE.Vector3(), MZ = new THREE.Vector3(), V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3();
  const E1 = new THREE.Euler(0, 0, 0, 'YZX'), Q1 = new THREE.Quaternion(), M1 = new THREE.Matrix4(), DOWN = new THREE.Vector3(0, -1, 0);
  const Q_CARRY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.95); // 手垂著拿手槍：槍管從朝下轉到朝前下方
  const HIT = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, kind: 'none', ref: null, prov: null, glass: false, onHit: null };
  const TMP = { nx: 0, ny: 0, nz: 0, ref: null, kind: null, onHit: null }, TMP2 = { nx: 0, ny: 0, nz: 0, glass: null };
  const INFO = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, dx: 0, dy: 0, dz: 0, power: 1, weapon: 'pistol', glass: false, kind: '' };
  const CRIME = { x: 0, z: 0 };
  let tel = null; // 這一格的 walker.telemetry()
  const knockAcc = new WeakMap();
  const crimeT = { gunfire: -9, shoot: -9, shootCop: -9 };
  let shotCrime = false; // 這一槍打到人／車、報過犯罪了

  // ---- 槍的模型：每把一個（第一次拿才做），放在場景裡（每一格照手的位置擺）----
  const models = {};
  let gun = null;
  function modelOf(id) { if (!models[id]) { models[id] = buildGunModel(id, { flash: doc }); models[id].visible = false; } return models[id]; }
  function equipChanged() {
    const id = arms.cur;
    if (gun) gun.visible = false;
    gun = id ? modelOf(id) : null;
    if (gun && scene && gun.parent !== scene) scene.add(gun);
    if (audio) audio.hold(!!id);
    if (o.onEquip) o.onEquip(id);
    if (o.onChange) o.onChange('equip');
    if (!id) { A.latched = false; A.held = 0; }
    closeWheel();
  }

  // ---- 地方（村子／槍店）----
  function setWorld(w = {}) {
    world = { crime: true, ceiling: null, ...w };
    grid = rayGrid(world.colliders || []);
    const sc = world.scene || scene;
    if (sc && sc !== scene) setScene(sc);
    if (fx) fx.clearDecals();
  }
  function setScene(sc) {
    scene = sc;
    if (fx && scene) scene.add(fx.root);
    for (const k in models) if (scene) scene.add(models[k]);
  }
  function setTargets(t = {}) { // 有 box 的來源＝車，其他＝人（gunTargets.police 回傳警察＋警車兩個：放哪一邊都可以）
    const all = Array.isArray(t) ? t.flat(3) : [t.peds, t.cars].flat(3), peds = [], cars = [];
    for (const pv of all) if (pv && pv.list) (pv.box ? cars : peds).push(pv);
    targets = { peds, cars };
  }
  setTargets(o.targets || {});
  setWorld(o.world || {});

  // ---- 開一槍 ----
  const BX = { x: 0, z: 0, hx: 0, hz: 0, rot: 0, h: 1.4 };
  function castAll(ox, oy, oz, dx, dy, dz, maxT, out, skipPeds, precise) { // precise：真的開槍（車再對模型打一次）；準星每一格只用長方形
    out.kind = 'none'; out.ref = null; out.prov = null; out.onHit = null; out.glass = false;
    let best = maxT;
    // 地面、天花板
    if (dy < -1e-6) { const t = -oy / dy; if (t > 0 && t < best) { best = t; out.kind = 'ground'; out.nx = 0; out.ny = 1; out.nz = 0; } }
    if (world.ceiling != null && dy > 1e-6) { const t = (world.ceiling - oy) / dy; if (t > 0 && t < best) { best = t; out.kind = 'ceiling'; out.nx = 0; out.ny = -1; out.nz = 0; } }
    // 牆、房子
    const tw = grid.cast(ox, oy, oz, dx, dy, dz, best, TMP);
    if (tw < best) { best = tw; out.kind = 'world'; out.nx = TMP.nx; out.ny = TMP.ny; out.nz = TMP.nz; out.ref = TMP.ref; }
    // 另外的（靶場的靶）
    if (world.raycast) { TMP.kind = null; TMP.onHit = null; const t = world.raycast(ox, oy, oz, dx, dy, dz, best, TMP); if (t < best) { best = t; out.kind = TMP.kind || 'target'; out.nx = TMP.nx; out.ny = TMP.ny; out.nz = TMP.nz; out.ref = TMP.ref; out.onHit = TMP.onHit; } }
    // 車
    for (const pv of targets.cars) {
      const list = pv.list(); if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const c = list[i], b = pv.box(c, BX); if (!b) continue;
        if (Math.abs(b.x - ox) > best + b.hx + 3 || Math.abs(b.z - oz) > best + b.hx + 3) continue; // 太遠（射線走不到）
        let t = hitShape(setBoxQ(TMPQ, b.x, b.z, b.hx, b.hz, b.rot, 0.12, b.h, c), ox, oy, oz, dx, dy, dz, best, TMP);
        if (t >= best) continue;
        TMP2.glass = null;
        if (precise && pv.obj && (!pv.fine || pv.fine(c))) { // 開槍：再對模型打一次
          const obj = pv.obj(c), tr = obj ? refineCar(obj, ox, oy, oz, dx, dy, dz, t, best, TMP2) : -1;
          if (tr === Infinity) continue; // 從車子旁邊、上面飛過去
          if (tr >= 0) { t = tr; TMP.nx = TMP2.nx; TMP.ny = TMP2.ny; TMP.nz = TMP2.nz; }
        }
        best = t; out.kind = 'car'; out.nx = TMP.nx; out.ny = TMP.ny; out.nz = TMP.nz; out.ref = c; out.prov = pv;
        out.glass = TMP2.glass !== null ? TMP2.glass : boxGlass(b, ox + dx * t - b.x, oz + dz * t - b.z, oy + dy * t);
      }
    }
    // 人
    if (!skipPeds) for (const pv of targets.peds) {
      const list = pv.list(); if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const p = list[i]; if (pv.skip && pv.skip(p)) continue;
        if (Math.abs(p.x - ox) > best + 1 || Math.abs(p.z - oz) > best + 1) continue;
        const t = hitShape(setCylQ(TMPQ, p.x, p.z, pv.r ? pv.r(p) : 0.3, 0, pv.h ? pv.h(p) : 1.7, p), ox, oy, oz, dx, dy, dz, best, TMP);
        if (t < best) { best = t; out.kind = 'ped'; out.nx = TMP.nx; out.ny = TMP.ny; out.nz = TMP.nz; out.ref = p; out.prov = pv; }
      }
    }
    out.t = best; out.x = ox + dx * best; out.y = oy + dy * best; out.z = oz + dz * best;
    return best;
  }
  // 鏡頭中間（準星）看到的點：從人的前面開始算（鏡頭跟人中間的東西不算）
  function aimPoint(range) {
    camera.updateMatrixWorld();
    CP.setFromMatrixPosition(camera.matrixWorld); CD.set(0, 0, -1).transformDirection(camera.matrixWorld);
    const t0 = tel ? Math.max(0.2, (tel.x - CP.x) * CD.x + (1.3 - CP.y) * CD.y + (tel.z - CP.z) * CD.z + 0.35) : 0.5;
    const t = castAll(CP.x + CD.x * t0, CP.y + CD.y * t0, CP.z + CD.z * t0, CD.x, CD.y, CD.z, range, HIT);
    AP.set(HIT.x, HIT.y, HIT.z);
    A.aimKind = HIT.kind; A.aimRef = HIT.ref;
    if (HIT.kind === 'car' && HIT.prov && HIT.prov.obj && (!HIT.prov.fine || HIT.prov.fine(HIT.ref))) { const obj = HIT.prov.obj(HIT.ref); if (obj && obj !== A.warm) { A.warm = obj; warmCar(obj); } } // 準星對到車：先做那台的 BVH
    return t;
  }
  // 沒瞄準（直接按開槍）：準星附近的人自動對準（手機比較好打）
  function assist(id) {
    if (o.aimAssist === false || A.aiming) return false;
    const W = GUNS[id], lim = Math.cos(7 * D2R);
    let best = null, bd = lim, bx = 0, by = 0, bz = 0;
    for (const pv of targets.peds) {
      const list = pv.list(); if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const p = list[i]; if (pv.skip && pv.skip(p)) continue;
        const h = (pv.h ? pv.h(p) : 1.7) * 0.68, dx = p.x - CP.x, dy = h - CP.y, dz = p.z - CP.z, d = Math.hypot(dx, dy, dz);
        if (d > W.range || d < 0.5) continue;
        const c = (dx * CD.x + dy * CD.y + dz * CD.z) / d; if (c <= bd) continue;
        best = p; bd = c; bx = p.x; by = h; bz = p.z;
      }
    }
    if (!best) return false;
    // 中間被牆擋住就不算
    const dx = bx - CP.x, dy = by - CP.y, dz = bz - CP.z, d = Math.hypot(dx, dy, dz);
    if (grid.cast(CP.x, CP.y, CP.z, dx / d, dy / d, dz / d, d - 0.4, TMP) < d - 0.4) return false;
    AP.set(bx, by, bz); return true;
  }
  function onShot(id) {
    const W = GUNS[id], t = tel; if (!t) return;
    stat.shots++;
    const rule = world.rule ? world.rule(t.x, t.z) : null;
    if (audio) audio.shot(id);
    A.kick = 1; A.hipT = 0.9; A.bloom = Math.min(1, A.bloom + (W.auto ? 0.16 : 0.35));
    if (ch && ch.recoil) ch.recoil(); // character.js：手往上跳一下
    // 從胸口往準星的點射（槍口在人前面 0.5 公尺，近的時候會穿牆：用胸口算、從槍口畫）
    const s = ch ? ch.height / 1.72 : 1, ox = t.x, oy = 1.36 * s, oz = t.z;
    let dx = AP.x - ox, dy = AP.y - oy, dz = AP.z - oz; const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
    const muzzle = gun && gun.visible ? gun.localToWorld(MZ.copy(gun.userData.muzzle)) : MZ.set(ox + dx * 0.5, oy + dy * 0.5 - 0.08, oz + dz * 0.5); // 看不到槍（第一人稱）：從胸前
    // 散布：瞄準比較準、走路跑步比較散、連發越來越散
    const moving = clamp((t.speed || 0) / 2.5, 0, 1), sp = (A.aiming ? W.aimSpread : W.spread) * (1 + 0.6 * moving + (W.auto ? 0.8 : 0.3) * A.bloom) * D2R;
    // 垂直於彈道的兩個方向
    let ux = -dz, uz = dx; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    const vx = dy * uz, vy = dz * ux - dx * uz, vz = -dy * ux;
    let hitPed = false, hitAny = false; shotCrime = false;
    for (let k = 0; k < W.pellets; k++) {
      const r = sp * Math.sqrt(Math.random()), a = Math.random() * TAU, cr = Math.cos(r), sr = Math.sin(r), ca = Math.cos(a) * sr, sa = Math.sin(a) * sr;
      const ex = dx * cr + ux * ca + vx * sa, ey = dy * cr + vy * sa, ez = dz * cr + uz * ca + vz * sa;
      castAll(ox, oy, oz, ex, ey, ez, W.range, HIT, false, true);
      // 彈道（霰彈槍只畫幾條）
      if (fx && (k < 3 || W.pellets === 1)) {
        const tl = HIT.kind === 'none' ? W.range : HIT.t;
        fx.tracer(muzzle.x, muzzle.y, muzzle.z, ox + ex * tl, oy + ey * tl, oz + ez * tl, { w: W.pellets > 1 ? 0.012 : 0.02, streak: W.pellets > 1 ? 3 : 6 });
      }
      if (HIT.kind !== 'none') { hitAny = true; if (react(W, ex, ey, ez)) hitPed = true; }
    }
    // 火光、彈殼
    if (gun && gun.userData.flash) { const f = gun.userData.flash; f.visible = true; f.rotation.x = Math.random() * TAU; f.scale.setScalar(0.8 + Math.random() * 0.5); flashT = 0.045; }
    if (fx) {
      fx.flashPt(muzzle.x, muzzle.y, muzzle.z, W.pellets > 1 ? 0.7 : 0.45, 0.05, 1, 0.8, 0.45);
      if (id !== 'shotgun') ejectShell(id, 0); else pendingShell = 0.42;
    }
    // 犯罪：在外面開槍（附近的人跑掉）
    if (world.crime && !rule) {
      for (const pv of targets.peds) if (pv.scare) pv.scare(t.x, t.z, 16);
      if (!shotCrime) crime('gunfire', t.x, t.z, 3); // 打到人、車已經報過了（比較重）：不用再報「開槍」
    }
    if (hitAny) { hitMark(hitPed); stat.hits++; }
    // 後座力：鏡頭往上跳一點（之後慢慢回來：update 裡的 A.recoil）
    if (walker && W.recoil) { const k = W.recoil * (A.aiming ? 0.7 : 1) * (0.8 + Math.random() * 0.4); A.recoil -= nudgeCam(-k, (Math.random() - 0.5) * W.recoil * 0.5); }
  }
  // 鏡頭上下（左右）動一點：回傳上下真的動了多少（到頂了就少一點）
  function nudgeCam(dp, dyaw = 0) {
    const eye = tel.camMode === 'eye', p0 = tel.camPitch, p1 = clamp(p0 + dp, eye ? -1.1 : -0.25, eye ? 1.2 : 0.95);
    tel.camPitch = p1; if (dyaw) tel.camYaw = wrapA(tel.camYaw + dyaw);
    walker.setCamera({ pitch: p1, yaw: tel.camYaw, hold: 1.2 });
    return p1 - p0;
  }
  let flashT = 0, pendingShell = -1;
  function ejectShell(id) {
    if (!gun || !fx) return;
    const e = gun.localToWorld(V1.copy(gun.userData.eject));
    V2.set(0.4, 1.6, 2.2 + Math.random()).applyQuaternion(gun.quaternion); // 往右上方彈出去
    fx.shell(e.x, e.y, e.z, V2.x + (Math.random() - 0.5) * 0.6, V2.y + Math.random() * 0.8, V2.z + (Math.random() - 0.5) * 0.6, id, world.floor || 0);
  }
  // 打到了：看是什麼
  function react(W, dx, dy, dz) {
    const h = HIT, pan = panOf(h.x, h.z);
    INFO.x = h.x; INFO.y = h.y; INFO.z = h.z; INFO.nx = h.nx; INFO.ny = h.ny; INFO.nz = h.nz; INFO.dx = dx; INFO.dy = dy; INFO.dz = dz; INFO.weapon = W.id; INFO.glass = h.glass; INFO.kind = h.kind;
    stat.last = { kind: h.kind, x: +h.x.toFixed(2), y: +h.y.toFixed(2), z: +h.z.toFixed(2) };
    if (h.kind === 'ped') {
      const p = h.ref, pv = h.prov; let acc = (knockAcc.get(p) || 0) + W.knock;
      INFO.power = W.knock;
      if (fx) fx.pow(h.x, h.y, h.z, -dx, 0.2, -dz);
      if (audio) audio.pow(pan);
      let told = false; // knock 回傳 true＝那個模組自己報過犯罪了
      if (acc >= 0.999) { acc = 0; stat.knocks++; if (pv.knock) told = pv.knock(p, INFO) === true; }
      knockAcc.set(p, acc);
      if (world.crime) { shotCrime = true; if (!told) crime(pv.cop ? 'shootCop' : 'shoot', h.x, h.z, 0.5); }
      return true;
    }
    if (h.kind === 'car') {
      const c = h.ref, pv = h.prov, obj = pv.obj ? pv.obj(c) : null;
      INFO.power = W.carDmg;
      const done = o.damage && o.damage.shoot && obj ? o.damage.shoot(obj, INFO) : false;
      if (fx && !done) {
        if (h.glass) { fx.crack(h.x, h.y, h.z, h.nx, h.ny, h.nz, 0.3 + Math.random() * 0.12, obj, c); fx.shards(h.x, h.y, h.z, h.nx, h.ny, h.nz, 12); }
        else fx.hole(h.x, h.y, h.z, h.nx, h.ny, h.nz, 0.05, obj, c);
      }
      if (fx) fx.sparks(h.x, h.y, h.z, h.nx, h.ny, h.nz, h.glass ? 3 : 7, 5, 0.9);
      if (audio) (h.glass ? audio.glass(pan) : audio.clank(pan));
      if (pv.shot) pv.shot(c, INFO);
      if (world.crime && (pv.cop || pv.kind === 'traffic')) { shotCrime = true; crime(pv.cop ? 'shootCop' : 'shoot', h.x, h.z, 0.5); }
      return false;
    }
    if (h.kind === 'target') { if (h.onHit) h.onHit(INFO); if (fx) fx.sparks(h.x, h.y, h.z, h.nx, h.ny, h.nz, 10, 6, 1.1); if (audio) audio.ding(pan); return false; }
    if (!fx) return false;
    // 牆、地面、天花板：彈孔＋煙塵＋一點火花
    if (h.kind === 'world' || h.kind === 'ceiling') { fx.hole(h.x, h.y, h.z, h.nx, h.ny, h.nz, W.pellets > 1 ? 0.035 : 0.06); fx.dust(h.x, h.y, h.z, h.nx, h.ny, h.nz, 4, 0.66); fx.sparks(h.x, h.y, h.z, h.nx, h.ny, h.nz, 3, 4, 0.8); }
    else if (h.kind === 'ground') { fx.hole(h.x, h.y + 0.02, h.z, 0, 1, 0, W.pellets > 1 ? 0.03 : 0.05); fx.dust(h.x, h.y + 0.02, h.z, 0, 1, 0, 4, 0.58); }
    if (audio && h.t < 30 && Math.random() < 0.5) audio.thud(pan);
    return false;
  }
  function panOf(x, z) { // 左右聲道：打到的點在畫面的哪一邊
    if (!camera) return 0;
    const rx = Math.cos(tel ? tel.camYaw - Math.PI / 2 : 0), rz = -Math.sin(tel ? tel.camYaw - Math.PI / 2 : 0), dx = x - CP.x, dz = z - CP.z, d = Math.hypot(dx, dz) || 1;
    return clamp(((dx * rx + dz * rz) / d) * 0.8, -0.8, 0.8);
  }
  function crime(kind, x, z, cool) {
    if (now - crimeT[kind] < cool) return;
    crimeT[kind] = now; CRIME.x = x; CRIME.z = z;
    stat.crimes.push(kind); if (stat.crimes.length > 12) stat.crimes.shift();
    if (o.onCrime) try { o.onCrime(kind, { x, z }); } catch (e) { console.warn(e); }
  }

  // ---- 瞄準：鏡頭拉近到肩膀後面、準星、人跟著準星轉 ----
  const AIM_DIST = 1.7;
  function aimWanted() { return !!arms.cur && (A.held > 0 || A.latched || A.mouse || A.key); }
  function beginAim() {
    A.aiming = true;
    if (walker) {
      A.prevDist = tel && tel.camWant > 2 && tel.camWant >= tel.camDist - 0.05 ? tel.camWant : 3.8;
      const p = tel ? clamp(tel.camPitch, -0.2, 0.16) : 0.08;
      walker.setCamera({ dist: AIM_DIST, pitch: p, hold: 1 });
    }
    hudDirty = true;
  }
  function endAim(t) {
    A.aiming = false;
    if (walker) walker.setCamera({ dist: A.prevDist || 3.8 });
    // 站著不動：把 walker 的方向改成人現在面對的方向（不然放開瞄準人會轉回去）
    if (walker && t && (t.speed || 0) < 0.3 && ch) walker.teleport({ x: t.x, z: t.z, heading: A.faceYaw }, { keepCamera: true });
    hudDirty = true;
  }
  function lookBy(dx, dy) { // 按著開槍、瞄準的手指拖動：轉鏡頭（瞄準的時候慢一點）
    if (!walker || !tel || !active()) return;
    const k = 0.0062 / Math.max(1, A.zoom), eye = tel.camMode === 'eye';
    tel.camYaw = wrapA(tel.camYaw - dx * k); tel.camPitch = clamp(tel.camPitch + dy * k * 0.85, eye ? -1.1 : -0.25, eye ? 1.2 : 0.95);
    walker.setCamera({ yaw: tel.camYaw, pitch: tel.camPitch, hold: 1.2 });
  }
  const active = () => enabled && alive && !!tel && !tel.paused && tel.mode === 'walk';
  function trigger(src, on) {
    A.trig[src] = !!on;
    const any = A.trig.btn || A.trig.key || A.trig.mouse || A.trig.prog;
    if (on && audio) audio.resume();
    if (on && !arms.cur) return;
    arms.setTrigger(any);
  }

  // ---- 每一幀 ----
  function update(dt) {
    if (!alive) return;
    dt = Math.min(0.1, Math.max(0, +dt || 0)); now += dt;
    if (BV_PENDING.size) bvhPump(1.5); // 車的 BVH：每一格做一點
    tel = walker ? walker.telemetry() : null;
    const on = active();
    showHud(on && G().owned.length > 0);
    if (!on) {
      if (A.aiming) endAim(null);
      if (arms.trig) arms.setTrigger(false);
      for (const k in A.trig) A.trig[k] = false;
      A.held = 0; A.mouse = false; A.key = false; A.hipT = 0; A.recoil = 0;
      if (gun) gun.visible = false;
      if (ch) restArms();
      if (fx) fx.update(dt, camera, pxScale());
      lastT = tel; return;
    }
    const id = arms.cur, W = id ? GUNS[id] : null;
    // 瞄準（按著、點一下鎖住、滑鼠右鍵、V）
    const want = aimWanted();
    if (want && !A.aiming) beginAim(); else if (!want && A.aiming) endAim(tel);
    const zt = A.aiming && W ? W.zoom : 1; A.zoom += (zt - A.zoom) * (1 - Math.exp(-dt * (calm ? 60 : 14)));
    if (A.zoom > 1.001 && camera) { camera.fov = camera.fov / A.zoom; camera.updateProjectionMatrix(); camera.updateMatrixWorld(); }
    if (A.recoil > 1e-4) { const r = A.recoil * (1 - Math.exp(-dt * 5)); nudgeCam(r); A.recoil -= r; } else A.recoil = 0; // 後座力慢慢回來
    if (A.aiming || A.hipT > 0) walker.setCamera({ yaw: tel.camYaw, hold: 0.6 }); // 瞄準的時候鏡頭不要自己轉回人的後面
    A.hipT = Math.max(0, A.hipT - dt); A.bloom = Math.max(0, A.bloom - dt * (W && W.auto ? 1.6 : 2.2)); A.kick = Math.max(0, A.kick - dt * 9);
    // 準星看到的點、人轉過去面對它
    if (W) { aimPoint(W.range); if (arms.trig && !A.aiming) assist(id); }
    const face = !!W && (A.aiming || A.hipT > 0 || arms.trig || A.trig.btn);
    let ready = true;
    if (face && ch) {
      const ty = Math.atan2(-(AP.z - tel.z), AP.x - tel.x);
      if (!A.facing) { A.faceYaw = tel.heading; A.facing = true; }
      const d = wrapA(ty - A.faceYaw); A.faceYaw = wrapA(A.faceYaw + d * (1 - Math.exp(-dt * 18)));
      ch.group.rotation.y = A.faceYaw; ch.group.updateMatrixWorld();
      ready = Math.abs(wrapA(ty - A.faceYaw)) < 0.35;
    } else if (A.facing) { // 不瞄了：站著＝walker 的方向改成現在面對的方向；走著＝慢慢轉回走的方向（不會一下子轉過去）
      if ((tel.speed || 0) < 0.3 || !ch) { if (ch && walker) walker.teleport({ x: tel.x, z: tel.z, heading: A.faceYaw }, { keepCamera: true }); A.facing = false; }
      else { const d = wrapA(tel.heading - A.faceYaw); A.faceYaw = wrapA(A.faceYaw + d * (1 - Math.exp(-dt * 12))); if (Math.abs(d) < 0.05) A.facing = false; else { ch.group.rotation.y = A.faceYaw; ch.group.updateMatrixWorld(); } }
    }
    // 手上的槍：擺好（開槍的時候從槍口出來）
    poseGun(dt, W);
    // 子彈、換彈匣、射擊
    const rule = world.rule ? world.rule(tel.x, tel.z) : null;
    if (rule && (arms.trig || arms.R.want)) { arms.setTrigger(false); arms.R.want = false; for (const k in A.trig) A.trig[k] = false; toast(rule); }
    arms.update(dt, ready && !rule);
    if (pendingShell >= 0) { pendingShell -= dt; if (pendingShell < 0 && arms.cur === 'shotgun') ejectShell('shotgun'); }
    if (flashT > 0) { flashT -= dt; if (flashT <= 0 && gun && gun.userData.flash) gun.userData.flash.visible = false; }
    // 角色的動作（有支援 aim 的角色：character.js）：瞄準／剛開過槍＝aim（槍口朝準星）；長槍沒瞄準＝aim 但槍口朝前下方（兩手拿著，不會一隻手甩來甩去）
    const aimNow = !!W && (A.aiming || A.hipT > 0 || arms.trig), lowReady = !!W && !aimNow && W.hold === 'two' && !!(ch && ch.hand);
    pose.state = aimNow ? (A.kick > 0.5 && !(ch && ch.recoil) ? 'shoot' : 'aim') : lowReady ? 'aim' : null;
    pose.pitch = lowReady ? LOW_READY : Math.asin(clamp((AP.y - 1.4) / (Math.hypot(AP.x - tel.x, AP.y - 1.4, AP.z - tel.z) || 1), -1, 1));
    pose.hold = W ? W.hold : null;
    pose.support = W && gun ? Math.max(0.2, gun.userData.grip2.x + stockShift(gun)) : 0.32;
    if (fx) fx.update(dt, camera, pxScale());
    hudTick(dt);
    lastT = tel;
  }
  const pose = { state: null, pitch: 0, hold: null, support: 0.32 };
  const LOW_READY = -0.35; // 長槍沒瞄準：槍口往下幾弧度
  // character.js 的長槍瞄準：右手（握把）在眼睛前面 0.14 公尺；槍托底離握把超過 STOCK_REACH 的槍往前推，槍托剛好靠在臉頰（不會穿過頭）
  const STOCK_REACH = 0.26;
  const stockShift = (g) => (ch && ch.hand && g && g.userData.butt ? Math.max(0, -g.userData.butt.x - STOCK_REACH) : 0);
  // 角色：character.update 包一層，把 state 'aim'／'shoot'、aimPitch、weapon 塞進去（walk.js 叫 update 的時候就帶著）
  function hookCharacter(c) {
    if (!c || c.__gunHook) return;
    const orig = c.update, can = !!c.hand || (Array.isArray(c.states) && c.states.includes('aim'));
    c.__gunHook = orig;
    c.update = function (dt, p) {
      if (A.facing && this.group) this.group.rotation.y = A.faceYaw; // 轉向準星：在角色 update 之前轉（character.js 踩著的腳才會跟著轉對）
      if (can && pose.state && p && !(p.state === 'fall' || p.state === 'getup' || p.state === 'sit')) { // character.js：weapon 'long'｜'pistol'、aimPitch 往上正、support＝左手在握把前面幾公尺
        p.state = pose.state; p.aimPitch = pose.pitch; p.weapon = pose.hold === 'two' ? 'long' : 'pistol'; p.support = pose.support; p.aimYaw = A.faceYaw;
      }
      return orig.call(this, dt, p);
    };
  }
  function unhook(c) { if (c && c.__gunHook) { c.update = c.__gunHook; delete c.__gunHook; } }
  hookCharacter(ch);
  // 替身（charstub.js）的手臂：root 底下第 6、7 個（armL、armR）；肩膀在 y 1.45、z ±0.27
  function stubArms(c) {
    if (!c || c.hand) return null;
    if (c.__gunArms !== undefined) return c.__gunArms;
    const r = c.group.children[0], ok = r && r.children.length === 7 && r.children[5].isGroup && r.children[6].isGroup && r.children[6].children[0] && r.children[6].children[0].isMesh;
    c.__gunArms = ok ? { root: r, L: r.children[5], R: r.children[6] } : null;
    return c.__gunArms;
  }
  function aimArm(arm, wx, wy, wz) { // 手臂（肩膀的 group，本來往下垂）指向世界座標的一點
    V3.set(wx, wy, wz); arm.parent.worldToLocal(V3); V3.sub(arm.position);
    const l = V3.length(); if (l < 1e-4) return; V3.divideScalar(l);
    arm.quaternion.setFromUnitVectors(DOWN, V3);
  }
  function restArms() { // 替身的手臂放回去（收槍、上車、第一人稱）
    if (!A.posed) return; A.posed = false;
    const a = stubArms(ch); if (a) { a.L.rotation.set(0, 0, 0); a.R.rotation.set(0, 0, 0); }
  }
  function poseGun(dt, W) {
    const show = !!gun && !!W && !!ch && !tel.hidden && tel.camMode !== 'eye';
    if (gun) gun.visible = show;
    if (!show) { restArms(); return; }
    const s = ch.height / 1.72, g = ch.group, two = W.hold === 'two', aimed = A.aiming || A.hipT > 0 || arms.trig;
    const yaw = aimed && A.facing ? A.faceYaw : g.rotation.y;
    g.updateMatrixWorld();
    const cy = Math.cos(yaw), sy = Math.sin(yaw), fwd = V4.set(cy, 0, -sy); // 人的前面（世界）
    const rgt = V2.set(sy, 0, cy); // 右邊（本地 +z）
    let dx, dy, dz;
    if (aimed) { dx = AP.x - tel.x; dy = AP.y - 1.38 * s; dz = AP.z - tel.z; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l; }
    else { const pd = two ? -0.62 : -0.95, cp = Math.cos(pd); dx = fwd.x * cp; dy = Math.sin(pd); dz = fwd.z * cp; } // 沒瞄準：槍口朝前下方
    // character.js：槍直接跟著右手的掛點（+x 順著手指＝槍管、+y 大拇指＝槍的上面）；手垂著的時候（手槍沒瞄準）手腕往前彎一點
    if (ch.hand) {
      ch.hand.updateWorldMatrix(true, false); ch.hand.matrixWorld.decompose(V1, Q1, V3);
      gun.position.copy(V1); gun.quaternion.copy(Q1);
      if (!aimed && !two) gun.quaternion.multiply(Q_CARRY);
      else if (two) gun.translateX(stockShift(gun));
      gun.updateMatrixWorld(); A.posed = false;
      return;
    }
    // 握把（右手）的位置
    let gx, gy, gz;
    if (aimed && !two) { const sx = tel.x + rgt.x * 0.2 * s, sz = tel.z + rgt.z * 0.2 * s, shy = 1.43 * s; gx = sx + dx * 0.56 * s - rgt.x * 0.1 * s; gy = shy + dy * 0.56 * s - 0.03; gz = sz + dz * 0.56 * s - rgt.z * 0.1 * s; }
    else if (aimed) { // 長槍：槍托頂在右肩前面
      const bx = tel.x + rgt.x * 0.13 * s + fwd.x * 0.06, by = 1.39 * s, bz = tel.z + rgt.z * 0.13 * s + fwd.z * 0.06, back = -gun.userData.butt.x;
      gx = bx + dx * back; gy = by + dy * back - 0.035; gz = bz + dz * back;
    } else if (two) { gx = tel.x + rgt.x * 0.16 * s + fwd.x * 0.2 * s; gy = 1.04 * s; gz = tel.z + rgt.z * 0.16 * s + fwd.z * 0.2 * s; }
    else { gx = tel.x + rgt.x * 0.26 * s + fwd.x * 0.14 * s; gy = 0.86 * s; gz = tel.z + rgt.z * 0.26 * s + fwd.z * 0.14 * s; }
    // 後座力：往後、槍口往上
    const k = A.kick * A.kick * (W.kick || 1);
    gx -= dx * 0.045 * k; gy -= dy * 0.045 * k; gz -= dz * 0.045 * k;
    gun.position.set(gx, gy, gz);
    E1.set(0, Math.atan2(-dz, dx), Math.asin(clamp(dy, -1, 1)) + k * (two ? 0.07 : 0.16), 'YZX'); gun.quaternion.setFromEuler(E1);
    gun.updateMatrixWorld();
    // 替身的手臂擺好（右手握把、長槍左手扶前面）
    const arm = stubArms(ch);
    if (arm) {
      A.posed = true;
      aimArm(arm.R, gx, gy - 0.02, gz);
      if (two) { gun.localToWorld(V1.copy(gun.userData.grip2)); aimArm(arm.L, V1.x, V1.y, V1.z); }
    }
  }

  // ---- HUD ----
  let H = null;
  function buildHud() {
    if (!document.getElementById('gn-style')) { const st = document.createElement('style'); st.id = 'gn-style'; st.textContent = CSS; document.head.append(st); }
    const root = document.createElement('div'); root.className = 'gn'; root.hidden = true;
    root.innerHTML = '<div class="gn-x" hidden><i></i><i></i><i></i><i></i><b></b></div><div class="gn-hit"><i></i><i></i><i></i><i></i></div>'
      + '<button type="button" class="gn-pill" aria-label="換槍"><span class="ic"></span><span class="n"></span><span class="a"><b></b><small></small></span><span class="bar" hidden><i></i></span></button>'
      + '<div class="gn-wheel" hidden role="group" aria-label="選槍"></div>'
      + `<div class="gn-b gn-rel" role="button" aria-label="換彈匣" hidden>${ICON.rel}<span>換彈匣</span><kbd>R</kbd></div>`
      + `<div class="gn-b gn-aim" role="button" aria-label="瞄準" aria-pressed="false" hidden>${ICON.aim}<span>瞄準</span><kbd>V</kbd></div>`
      + `<div class="gn-b gn-fire" role="button" aria-label="開槍" hidden>${ICON.fire}<span>開槍</span><kbd>F</kbd></div>`;
    o.hudParent.append(root);
    const q = (s) => root.querySelector(s);
    const h = { root, x: q('.gn-x'), hit: q('.gn-hit'), pill: q('.gn-pill'), ic: q('.gn-pill .ic'), n: q('.gn-pill .n'), a: q('.gn-pill .a b'), a2: q('.gn-pill .a small'), bar: q('.gn-pill .bar'), barI: q('.gn-pill .bar i'),
      wheel: q('.gn-wheel'), rel: q('.gn-rel'), aim: q('.gn-aim'), fire: q('.gn-fire'), off: [], last: {}, hitT: 0 };
    const on = (el, t, f, op) => { el.addEventListener(t, f, op); h.off.push(() => el.removeEventListener(t, f, op)); };
    on(root, 'contextmenu', (e) => e.preventDefault());
    // 按著的按鈕：按下去、拖（轉鏡頭）、放開
    const hold = (el, down, up) => {
      let pid = null, lx = 0, ly = 0;
      on(el, 'pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (pid != null) return; pid = e.pointerId; lx = e.clientX; ly = e.clientY; try { el.setPointerCapture(pid); } catch { /* 算了 */ } el.classList.add('on'); down(e); });
      on(el, 'pointermove', (e) => { if (e.pointerId !== pid) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; lookBy(dx, dy); });
      const u = (e) => { if (e.pointerId !== pid) return; pid = null; el.classList.remove('on'); up(e); };
      for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) on(el, t, u);
    };
    hold(h.fire, () => { trigger('btn', true); }, () => trigger('btn', false));
    // 瞄準：按著＝瞄準、放開就不瞄；很快點一下（0.25 秒內）＝鎖住，再點一下才放開
    let aimDown = 0, wasLatched = false;
    hold(h.aim, () => { aimDown = now; wasLatched = A.latched; A.latched = false; A.held++; if (audio) audio.resume(); }, () => { A.held = Math.max(0, A.held - 1); if (now - aimDown < 0.25 && !wasLatched) A.latched = true; hudDirty = true; });
    on(h.rel, 'pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); h.rel.classList.add('on'); reload(); });
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) on(h.rel, t, () => h.rel.classList.remove('on'));
    on(h.pill, 'click', (e) => { e.preventDefault(); toggleWheel(); });
    // 電腦：右鍵按著＝瞄準、按著右鍵時左鍵＝開槍（walk.js 拖畫面轉頭，按鍵的狀態看 pointer 事件的 buttons）
    const mouse = (e) => {
      if (e.pointerType !== 'mouse') return;
      const b = e.type === 'pointerup' || e.type === 'pointercancel' ? e.buttons || 0 : e.buttons;
      const r = !!(b & 2), l = !!(b & 1);
      if (r !== A.mouse) { A.mouse = r && !!arms.cur; if (r && audio) audio.resume(); }
      if (l !== H.ml) { H.ml = l; if (l && A.mouse) trigger('mouse', true); else if (!l && A.trig.mouse) trigger('mouse', false); }
      if (!r && A.trig.mouse) trigger('mouse', false);
    };
    on(o.hudParent, 'pointerdown', mouse, true); on(o.hudParent, 'pointermove', mouse, true);
    if (typeof window !== 'undefined') { on(window, 'pointerup', mouse, true); on(window, 'pointercancel', mouse, true); }
    return h;
  }
  if (doc) H = buildHud();
  function showHud(v) { if (H && H.root.hidden === v) { H.root.hidden = !v; if (!v) closeWheel(); hudDirty = true; } }
  function toggleWheel() {
    if (!H) return;
    if (!H.wheel.hidden) { closeWheel(); return; }
    const g = G(); if (!g.owned.length) { toast('還沒有槍：去槍店買'); return; }
    H.wheel.replaceChildren();
    for (const id of [...g.owned, null]) {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(arms.cur === id));
      b.innerHTML = GUN_ICONS[id || 'none']; const n = document.createElement('span'); n.textContent = id ? GUNS[id].name : '收起來（空手）'; b.append(n);
      if (id) { const sm = document.createElement('small'); sm.textContent = `${g.mag[id] || 0} / ${g.ammo[id] || 0}`; b.append(sm); }
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (id) draw(id); else holster(); closeWheel(); });
      H.wheel.append(b);
    }
    H.wheel.hidden = false; H.root.classList.add('wheel');
  }
  function closeWheel() { if (H && !H.wheel.hidden) { H.wheel.hidden = true; H.root.classList.remove('wheel'); } }
  function hitMark(ko) { if (!H) return; H.hit.classList.add('on'); H.hit.classList.toggle('ko', !!ko); H.hitT = 0.12; }
  function hudTick(dt) {
    if (!H) return;
    if (H.hitT > 0) { H.hitT -= dt; if (H.hitT <= 0) H.hit.classList.remove('on'); }
    const id = arms.cur, g = G(), W = id ? GUNS[id] : null;
    // 準星：瞄準、剛開過槍的時候；大小＝散布；對到人、車變橘色
    const showX = !!W && (A.aiming || A.hipT > 0 || arms.trig);
    if (H.x.hidden === showX) H.x.hidden = !showX;
    if (showX && camera) {
      const moving = clamp((tel.speed || 0) / 2.5, 0, 1), sp = (A.aiming ? W.aimSpread : W.spread) * (1 + 0.6 * moving + (W.auto ? 0.8 : 0.3) * A.bloom);
      const px = Math.round(3 + (Math.tan(sp * D2R) / Math.tan((camera.fov * D2R) / 2)) * (o.hudParent.clientHeight / 2));
      if (H.last.gap !== px) { H.last.gap = px; H.x.style.setProperty('--g', px + 'px'); }
      const hot = A.aimKind === 'ped' || A.aimKind === 'car' || A.aimKind === 'target';
      if (H.last.hot !== hot) { H.last.hot = hot; H.x.classList.toggle('hot', hot); }
      const sc = A.aiming && id === 'rifle' && A.zoom > 1.4;
      if (H.last.sc !== sc) { H.last.sc = sc; H.x.classList.toggle('scope', sc); }
    }
    // 子彈（換彈匣的時候每一格；不然有變才重畫）
    const rk = arms.reloading ? arms.reloadK : -1;
    if (!hudDirty && rk < 0 && H.last.rk < 0) return;
    hudDirty = false;
    const key = (id || '-') + '|' + (id ? `${g.mag[id] || 0}/${g.ammo[id] || 0}` : '') + '|' + (arms.reloading ? 'R' : '') + '|' + A.aiming + '|' + A.latched;
    if (H.last.rk !== rk) { H.last.rk = rk; H.bar.hidden = rk < 0; if (rk >= 0) H.barI.style.width = (rk * 100).toFixed(1) + '%'; }
    if (H.last.key === key) return; H.last.key = key;
    H.ic.innerHTML = GUN_ICONS[id || 'none'];
    H.pill.classList.toggle('bare', !id);
    H.n.textContent = id ? (arms.reloading ? '換彈匣' : W.name) : '拿槍';
    if (id) {
      const m = g.mag[id] || 0, r = g.ammo[id] || 0;
      H.a.textContent = String(m); H.a2.textContent = ` / ${r}`;
      H.pill.classList.toggle('low', m <= Math.ceil(W.mag / 4) && m > 0); H.pill.classList.toggle('out', m === 0 && r === 0);
      H.pill.setAttribute('aria-label', `${W.name}，彈匣 ${m} 發，備用 ${r} 發（按一下換槍）`);
      H.fire.classList.toggle('empty', m === 0 && r === 0);
    } else { H.pill.classList.remove('low', 'out'); H.pill.setAttribute('aria-label', '空手（按一下拿槍）'); }
    H.fire.hidden = H.aim.hidden = H.rel.hidden = !id;
    H.aim.setAttribute('aria-pressed', String(A.aiming)); H.aim.classList.toggle('on', A.latched);
  }
  function toast(t) { if (t && walker && walker.toast) walker.toast(t, 1800); }
  function pxScale() {
    if (!camera) return 400;
    const h = renderer ? renderer.getDrawingBufferSize(V3).y : (o.hudParent ? o.hudParent.clientHeight : 600);
    return h / (2 * Math.tan((camera.fov * D2R) / 2));
  }

  // ---- 鍵盤 ----
  const onKey = (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const down = e.type === 'keydown';
    if (e.code === 'KeyF') { if (!down) { trigger('key', false); return; } if (e.repeat || !active()) return; e.preventDefault(); trigger('key', true); return; }
    if (!down || e.repeat || !active() || !G().owned.length) return;
    if (e.code === 'KeyR') { e.preventDefault(); reload(); }
    else if (e.code === 'KeyQ') { e.preventDefault(); next(); }
    else if (e.code === 'KeyV') { e.preventDefault(); if (arms.cur) { A.key = !A.key; if (audio) audio.resume(); } }
    else if (e.code === 'KeyX' || e.code === 'Digit0') { e.preventDefault(); holster(); }
    else { const m = /^Digit([1-4])$/.exec(e.code); if (m) { const id = GUN_IDS[+m[1] - 1]; if (G().owned.includes(id)) { e.preventDefault(); draw(id); } } }
  };
  const onBlur = () => { for (const k in A.trig) A.trig[k] = false; arms.setTrigger(false); A.mouse = false; };
  const useKeys = o.keyboard !== false && typeof window !== 'undefined' && window.addEventListener;
  if (useKeys) { window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('blur', onBlur); }

  // ---- 對外 ----
  function draw(id) { const ok = arms.draw(id); if (ok && audio) { audio.resume(); audio.step(arms.cur, 'rack'); } return ok; }
  function holster() { if (A.aiming) endAim(tel); A.latched = false; A.key = false; arms.holster(); }
  function next() { const n = arms.next(); if (n && audio) { audio.resume(); audio.step(n, 'rack'); } if (!n && A.aiming) endAim(tel); return n; }
  function reload() { if (arms.reload()) { hudDirty = true; return true; } const id = arms.cur; if (id && !(G().ammo[id] > 0) && (G().mag[id] || 0) < GUNS[id].mag) toast('沒有備用子彈了：去槍店買'); return false; }
  // 存檔：子彈變了 0.5 秒後存一次（連發不要每一發都寫 localStorage）
  const saveTimer = setInterval(() => { if (ammoDirty && alive && o.onChange) { ammoDirty = false; o.onChange('ammo'); } }, 500);
  return {
    update, setWorld, setTargets, setScene,
    setWalker(w) { if (A.aiming) endAim(tel); walker = w || null; },
    setCharacter(c) { if (ch && ch !== c) { restArms(); unhook(ch); } A.posed = false; ch = c || null; hookCharacter(ch); },
    draw, holster, next, reload,
    setAim(v) { A.key = !!v && !!arms.cur; },
    setTrigger(v) { trigger('prog', v); },
    refresh() { hudDirty = true; if (H) H.last.key = null; const g = G(); if (arms.cur && !g.owned.includes(arms.cur)) arms.holster(); },
    setEnabled(v) { enabled = !!v; if (!enabled) { showHud(false); if (gun) gun.visible = false; } },
    toast,
    telemetry() {
      const id = arms.cur, g = G();
      return { drawn: !!id, cur: id, sel: g.cur, owned: g.owned.slice(), mag: id ? g.mag[id] || 0 : 0, reserve: id ? g.ammo[id] || 0 : 0, reloading: arms.reloading, reload: +arms.reloadK.toFixed(2),
        aiming: A.aiming, latched: A.latched, zoom: +A.zoom.toFixed(3), shots: stat.shots, hits: stat.hits, knocks: stat.knocks, last: stat.last, crimes: stat.crimes.slice(), aimKind: A.aimKind || null,
        aimPoint: { x: +AP.x.toFixed(2), y: +AP.y.toFixed(2), z: +AP.z.toFixed(2) }, faceYaw: +A.faceYaw.toFixed(3), hud: !!H && !H.root.hidden, fx: fx ? fx.stats : null, world: world.name || null };
    },
    // 測試用：從 (ox, oy, oz) 往 (dx, dy, dz)（長度 1）的子彈會打到什麼（precise＝開槍那樣：車再對模型打一次；sync＝車的 BVH 還沒做好就當場做完）
    probe(ox, oy, oz, dx, dy, dz, { maxT = 150, precise = true, sync = true } = {}) {
      const P = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, kind: 'none', ref: null, prov: null, glass: false, onHit: null };
      RC_ST.sync = !!sync; castAll(ox, oy, oz, dx, dy, dz, maxT, P, false, precise); RC_ST.sync = false;
      return { kind: P.kind, t: P.t, x: P.x, y: P.y, z: P.z, nx: P.nx, ny: P.ny, nz: P.nz, glass: P.glass, ref: P.ref };
    },
    get fx() { return fx; }, get audio() { return audio; }, get arms() { return arms; }, get gun() { return gun; }, hud: H && H.root,
    dispose() {
      if (!alive) return; alive = false; clearInterval(saveTimer);
      if (ammoDirty && o.onChange) { ammoDirty = false; o.onChange('ammo'); }
      if (useKeys) { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('blur', onBlur); }
      if (H) { H.off.forEach((f) => f()); H.root.remove(); }
      unhook(ch);
      for (const k in models) models[k].removeFromParent();
      if (fx) fx.dispose(); if (audio && !o.audio) audio.dispose(); else if (audio) audio.hold(false);
    },
  };
}

return { GUNS, GUN_IDS, gunSave, gunShop, buildGunModel, createGunAudio, createGunner, gunTargets, GUN_ICONS, createGunArms: createArms, GUN_RANGE_REWARD: RANGE_REWARD };
})();
