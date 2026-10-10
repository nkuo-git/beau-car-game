// ---- 走路（第 2 批）：下車走來走去、走到車旁邊上車、走進房子的門；跟 drive.js（開車）交接 ----
// Nick 2026-09-28：「⋯那些房子都要可以走進去然後人要可以下車走來走去⋯」
// Nick 2026-09-28 05:34：「那個車庫是我要人可以下來走是要走上車開出去不是停在那邊轉來轉去」
// 世界座標跟 village.js、drive.js 一樣：x 往東、y 往上、z 往南；heading＝rotation.y（0 朝 +x、π/2 朝北 −z）；台灣靠右開，駕駛座在左邊（車子本地 −z）
// 【API】
//   const walker = createWalker({
//     scene, camera,              角色、目的地光柱加在 scene；走路的時候鏡頭歸走路管（開車的時候不動它，只有交接那 0.6 秒）
//     world: V,                   buildVillage() 回傳的（colliders、buildings、places、route、roads、bounds、areas）
//     colliders: stripColliders(),   另外要擋的東西（跟 drive.js 一樣）；會變的用 addColliders／removeColliders
//     character,                  buildCharacter(look)（character.js；charstub.js 是替身）：group 腳底 y 0、臉朝本地 +x；radius、height；update(dt, { speed, state })
//     hudParent: stage,           HUD 放在這裡（要 position: relative）；沒給就沒有 HUD（測試用）
//     onDoor(door, zone),         走進一個門（走到門口、往門裡面推 0.12 秒）叫一次；door＝V.buildings 那一棟（或 setDoors 給的那個物件），
//                                 zone＝{ x, z, ry, ax, az }（門、真的走得到的觸發點）；走開再回來才會再叫；叫了以後照樣在走（要不要進去、怎麼進去是頁面的事）
//     onGetIn(car),               坐進車裡了（角色藏起來、走路暫停、HUD 收起來）；car＝setCars 給的那個（頁面要自己準備開那台）或 getOut 留下來的那台
//                                 （car.drive＝true：walker 已經 drv.resume() 了，頁面只要把引擎聲接回去）
//     keyboard: true,             WASD／方向鍵走（跟著鏡頭的方向）、Shift 跑、E 按大按鈕、C 換視角（第一人稱）、F／G⋯ setButtons 的鍵；滑鼠拖畫面轉頭、滾輪拉近拉遠
//     doors: 'village',           要偵測的門：'village'＝V.buildings 關著的門（房子、店面、廟、超商、三合院、車行玻璃門；改車廠開著的大門、你的車庫是真的走進去，不算）
//                                 ；也可以直接給 [門]（跟 setDoors 一樣）或 null
//     mapLayer,                   小地圖的底圖 { c, ms, x0, z0 }（可省略：自己畫一張，同一個 world 的 walker 共用；walker.mapLayer 拿得到）
//                                 drive.js 現在自己另外畫一張（最多 16 MB）：要共用的話 drive.js 的 HUD 改成 H.layer = o.mapLayer || mapLayer()，createDrive({ mapLayer: walker.mapLayer })
//     bounds,                     走得到的範圍 { x0, x1, z0, z1 }（可省略：地面的範圍）
//   });
//   一開始是暫停的（開車中）：walker.resume() 開始走，或 walker.getOut(drv, S) 從車上下來
//   每一幀：drv.update(dt) 之後叫 walker.update(dt)（開車的時候也要叫：上車那一下鏡頭從走路慢慢接到開車，叫了只做這個），再 renderer.render
//   walker.telemetry() → { x, z, heading, speed（真的走多快 m/s）, vx, vz, state（動作 idle|walk|run⋯）, mode（off 開車中／out 下車中／walk／in 走去車門／seat 坐進去中）,
//                          running, paused, near（伸手可及的車 key，沒有＝null）, action（大按鈕的字）, camMode（follow|eye）, camYaw, camPitch, camDist（現在離角色多遠）,
//                          camWant（沒被擋的話想要多遠）, hidden（角色藏起來了：開車中、第一人稱、鏡頭貼著頭）, zone（在哪個 places 的 zone 裡）, dest, destDist }
//   walker.teleport({ x, z, heading }, { keepCamera })   把人放到那裡（鏡頭跳到後面；站在門口的門要先走開才會再觸發）
//   walker.setAction({ label, onClick, icon } | null)   HUD 的大按鈕（跟 drive.js 同一個樣子、同一個位置；E 鍵）；icon：car | door | doorDown | key | hand | lift | bed；
//                          頁面給的優先，沒給才輪到車庫門（開鐵捲門）、車（上車）；每一幀叫也沒關係；walker.action＝現在的字
//   walker.addColliders(list, tag) / removeColliders(tag)   跟 drive.js 一樣（{ t: 'box', x, z, hx, hz, rot, h, y0? } | { t: 'circle', x, z, r, h, y0? }）
//                          world.colliders（村子的）的 tag 是 'world'：走進房子（interiors.js）removeColliders('world')，出來 addColliders(V.colliders, 'world')
//                          y0（多的）：碰撞物的底有多高（天花板、捲起來一半的門）：比頭高的不擋人、只擋鏡頭（drive.js 不看 y0：這種不要給開車的）
//   walker.setMovers(array | null)   會動的東西（路上的車、居民）：陣列、裡面的物件頁面每一格自己改（x、z、rot⋯），走路每一格照現在的值擋人、擋鏡頭（不用再叫）
//   walker.setMapTap({ label, onClick } | null)   點小地圖做什麼（大地圖）；label＝小地圖下面那一條字；walker.mapTap＝現在的字
//   walker.setMarkers(array | null, tag?)   小地圖上多畫的點（警車⋯）：[{ x, z, fill, ring, r（半徑 px，預設 5）, on（false＝不畫）, label（點上的字）, fg }]；跟 drive.setMarkers 一樣（只記住陣列，每一幀照現在的值畫）；tag＝另外一組（一起開車的朋友 'net'）
//   walker.setCars(list)       可以上的車（車庫車位的車、路邊的車⋯）：[{ key, name?, x, z, heading, hx, hz, cx?, cz?, h?, door?, object?, solid? }]
//                          x, z, heading＝車子原點（跟 spots、drv.teleport 一樣）；hx, hz＝車身長方形的半長、半寬；cx, cz＝長方形中心在車子本地的位置（LODS[k].cx、cz）；
//                          door＝駕駛座車門在車身長方形中間往前幾公尺（預設 0）；solid: false＝不要幫它加碰撞（預設會加，頁面不用再 addColliders）
//                          離車身 1.6 公尺以內（車門那邊大概 2.5 公尺）HUD 給「上車」（有 name 就「上車 · 名字」），最近的那台
//                          你剛下來的那台（getOut 留下來的）一直都在，清單裡同一台（object 一樣）的舊位置不算；
//                          setCars(list, { keepParked: false })：連那台也忘掉（新的一趟出門、頁面把那台收走或搬走了）
//   walker.getOut(drv, S, { key, name, h })   下車：|v| < 1 m/s 才可以（不行回傳 null）。drv.pause()（車子停在原地、影子留著），這台變成可以上的車（car.drive＝true），
//                          人從駕駛座那邊（左）走出來 0.42 秒（左邊擋住→右邊→後面→前面），鏡頭從開車的慢慢接過來；回傳那台 car
//   walker.getIn(car?)         上車（「上車」按鈕就是叫這個）：走到車門（站在哪一邊就走哪一邊；前後就先繞過車角）、轉身坐進去 → onGetIn(car)；推搖桿可以取消
//   walker.setGarage(GAR | null, { close, doorAction })   你家（room.js，擺在村子裡；group 擺好位置以後再叫，搬了要再叫一次）：碰撞跟著鐵捲門（門開到人過得去 0.55 就不擋人；天花板、門楣、捲一半的門擋鏡頭），
//                          走到門口（裡面、外面都可以）門關著給「開鐵捲門」；close: true 門開著多給「關鐵捲門」；doorAction: false＝門的按鈕頁面自己給（碰撞照樣跟著門）
//   walker.setDoors(list | 'village' | null)   換要偵測的門：[{ x, z, ry, w? }]，ry＝門朝外的方向（跟 V.buildings 的 door 一樣：往 −(sin ry, cos ry) 走＝走進去），
//                          w＝門的半寬（預設 0.9）；房子裡面的出口也用這個（ry 朝房間裡面）；門點在牆裡面的會自己往外找站得到的地方
//   walker.setDestination(name | null)   跟 drive.js 一樣：左上角「去改車廠 230 m」＋箭頭、小地圖的橘色路線、光柱
//   walker.setCamera({ mode: 'follow' | 'eye', yaw, pitch, dist, maxY })   鏡頭：跟在後面／第一人稱；maxY＝鏡頭最高（房子裡面的天花板）；walker.cameraDist＝現在設的 dist
//   walker.setCarReach(on)     false＝不給「上車」（人在房子裡面，車停在外面、隔著牆）；true 恢復
//   walker.setInput({ x, y, run } | null)   程式走路（測試）：x 往右、y 往前（跟著鏡頭）、−1…1；run 沒給＝推到 0.92 以上就跑
//   walker.play(state)         播一次動作（'punch' 揍、'wave' 揮手⋯ character.js 的 state）→ 第 3 批「揍人」用
//   walker.setButtons([{ id, label, onClick, key }] | null)   右下角的圓按鈕（第 3 批：揍）；key＝鍵盤的 code（'KeyF'）；onClick(walker, id)
//   walker.setCharacter(character)   換角色（自訂角色做好了；舊的從場景拿掉，不 dispose）
//   walker.pause({ hide }) / resume({ blend })   暫停（HUD 收起來、不吃按鍵；hide＝角色也藏起來）／開始走（blend：鏡頭從現在的位置慢慢接過來幾秒）
//   walker.toast(text, ms)；walker.dispose()（HUD、按鍵、光柱拿掉；角色從場景拿掉但不 dispose）
//   walker.character、walker.cars（現在可以上的車）、walker.doors（門的觸發點）、walker.hud、walker.mapLayer（小地圖的底圖）
// 走法：左下角整塊都可以按（按下去搖桿就跑到手指下面），推一點慢慢走、推到一半 1.4 m/s、推到底（外圈變橘色）跑 4.5 m/s；右邊滑動轉頭（鏡頭）
//   鏡頭：肩膀後上方（第三人稱）；走路的時候慢慢轉回角色後面（轉過頭 1.3 秒後才開始回）；被牆、房子、車子擋住就馬上拉近（照碰撞物的高度算：矮的東西從上面看過去），
//         沒擋了再慢慢拉回去；拉到貼著頭就把角色藏起來（變第一人稱）
//   碰撞：角色是半徑 radius 的圓（碰到長方形、圓就推出去，沿著牆滑）；每一小步最多走 0.12 公尺
// 效能：每一格不新增物件（碰撞格子 8 公尺一格、找到的放同一個陣列；角色的 update 參數重複用）；小地圖一秒畫 30 次
import * as THREE from 'three';

// 打包時全部接在同一個 script 裡：只露出 createWalker
export const { createWalker } = (() => {
const TAU = Math.PI * 2;
const WALK = 1.4, RUN = 4.5, BRISK = 2.1; // 走、跑、自己走去車門（公尺/秒）
const ACC = 9, DEC = 12; // 起步、停下來（m/s²）
const REACH = 1.6; // 離車身幾公尺以內給「上車」
const CAM_M = 0.22; // 鏡頭離牆、離東西至少幾公尺（near 0.1 的畫面四個角也碰不到）
const AY_MAX = 1.78; // 鏡頭繞著轉的那一點（頭上面一點）最高幾公尺：高的人在車庫升降機升起來的平台（只擋鏡頭的盒子底 2.02）底下，離平台還有 CAM_M
const CAM_D = 3.8, PITCH0 = 0.2, PMIN = -0.25, PMAX = 0.95; // 鏡頭離角色、往下看幾度（弧度）
const OPEN_T = 0.55; // 鐵捲門開到多少人走得過去（門底 0.55 × 3.8 ＝ 2.1 公尺）
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapA = (a) => { a = (a + Math.PI) % TAU; return a < 0 ? a + Math.PI : a - Math.PI; };
const smooth01 = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const inRect = (r, x, z, m = 0) => { const dx = x - r.x, dz = z - r.z, c = Math.cos(r.rot || 0), s = Math.sin(r.rot || 0); return Math.abs(dx * c - dz * s) <= r.hx + m && Math.abs(dx * s + dz * c) <= r.hz + m; };
// 目的地（跟 drive.js 一樣）
const DEST = {
  garage: { label: '回車庫', icon: '家', bg: '#1d1f23', fg: '#FF6A1F' }, shop: { label: '去改車廠', icon: '改', bg: '#2F6FD6', fg: '#FFFFFF' },
  track: { label: '去賽道', icon: '賽', bg: '#FF6A1F', fg: '#1A0F07' }, dealer: { label: '去車店', icon: '車', bg: '#F2C230', fg: '#1A0F07' },
  highway: { label: '去快速道路', icon: '快', bg: '#1F8A4C', fg: '#FFFFFF' },
  police: { label: '去警察局', icon: '警', bg: '#1F4FA8', fg: '#FFFFFF' }, gunshop: { label: '去槍店', icon: '槍', bg: '#26282C', fg: '#FF9A2E' }, // 第 3 批（b3-int）：跟 drive.js 一樣
  offroad: { label: '去越野車場', icon: '越', bg: '#8A5A2B', fg: '#FFF3E0' },
  neihu: { label: '去內湖', icon: '內', bg: '#6E4BA8', fg: '#FFFFFF' }, // 內湖（neihu.js）
};
const COND = '"Barlow Condensed", "Arial Narrow", sans-serif', SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
// 上面（目的地、大按鈕、小地圖、換視角、提示）跟 drive.js 的 .dv 一模一樣（兩個 HUD 換來換去看起來是同一個遊戲）；下面換成搖桿
const CSS = `
.wk{position:absolute;inset:0;pointer-events:none;color:#F2F3F5;font-family:${SANS};-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;z-index:3;overflow:hidden}
.wk[hidden],.wk [hidden]{display:none!important}
.wk>*{position:absolute}
.wk-look{inset:0;pointer-events:auto;touch-action:none;cursor:grab}
.wk-look.on{cursor:grabbing}
.wk-pad{left:0;bottom:0;width:58%;height:46%;pointer-events:auto;touch-action:none}
.wk-stick{left:0;top:0;width:128px;height:128px;margin:-64px 0 0 -64px;border-radius:50%;background:rgba(14,15,18,0.34);box-shadow:inset 0 0 0 2px rgba(242,243,245,0.55);pointer-events:none;transition:opacity .15s,background-color .12s}
.wk-stick.rest{opacity:.6}
.wk-stick svg{position:absolute;inset:0;width:100%;height:100%;fill:rgba(242,243,245,0.7)}
.wk-knob{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:#F2F3F5;box-shadow:0 3px 0 rgba(0,0,0,0.35);display:grid;place-items:center;font:700 18px/1 ${SANS};color:#1A0F07}
.wk-stick.run{background:rgba(255,106,31,0.24);box-shadow:inset 0 0 0 3px #FF6A1F}
.wk-stick.run .wk-knob{background:#FF6A1F}
.wk-chip{top:10px;left:10px;max-width:calc(100% - 158px);display:flex;align-items:center;gap:7px;height:40px;padding:0 13px 0 5px;border-radius:999px;background:rgba(14,15,18,0.62);white-space:nowrap;overflow:hidden}
.wk-chip i{flex:none;width:30px;height:30px;border-radius:50%;background:#FF6A1F;display:grid;place-items:center}
.wk-chip svg{width:18px;height:18px;fill:#1A0F07;transition:transform .12s linear}
.wk-chip b{font-size:17px;font-weight:700;letter-spacing:.02em}
.wk-chip small{font:600 17px/1 ${COND};color:#C6CAD1;letter-spacing:.03em}
.wk-chip.here i{background:#3DDC84}
.wk-act{top:58px;left:10px;max-width:calc(100% - 158px);min-height:54px;box-sizing:border-box;display:flex;align-items:center;gap:9px;margin:0;padding:0 18px 0 8px;border:0;border-radius:999px;background:#FF6A1F;color:#1A0F07;font:700 19px/1.15 ${SANS};letter-spacing:.03em;box-shadow:0 5px 0 #9E4213;pointer-events:auto;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.wk-chip[hidden]~.wk-act{top:10px}
.wk-act i{flex:none;width:38px;height:38px;border-radius:50%;background:#1A0F07;display:grid;place-items:center}
.wk-act svg{width:22px;height:22px;fill:none;stroke:#FF6A1F;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.wk-act span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wk-act kbd{display:none;flex:none;min-width:22px;height:22px;border-radius:6px;background:rgba(26,15,7,.2);font:700 14px/22px ${COND};text-align:center}
.wk-act.on{transform:translateY(4px);box-shadow:0 1px 0 #9E4213}
.wk-act:focus-visible{outline:3px solid #F2F3F5;outline-offset:3px}
.wk-act::after{content:"";position:absolute;inset:-5px;border-radius:inherit;border:3px solid #FF6A1F;opacity:0;animation:wk-ring 1.6s ease-out infinite;pointer-events:none}
@keyframes wk-ring{0%{opacity:.8;transform:scale(1)}100%{opacity:0;transform:scale(1.1,1.35)}}
@media (hover:hover) and (pointer:fine){.wk-act kbd{display:block}}
.wk-map{top:10px;right:10px;width:124px;height:124px;border-radius:18px;background:rgba(14,15,18,0.62);overflow:hidden}
.wk-map canvas{display:block;width:100%;height:100%}
.wk-map.tap{pointer-events:auto;cursor:pointer;touch-action:manipulation;box-shadow:inset 0 0 0 1.5px rgba(255,106,31,0.8)}
.wk-mapb{position:absolute;left:0;right:0;bottom:0;padding:4px 0 5px;background:rgba(14,15,18,0.8);font:700 11px/1 ${SANS};text-align:center;letter-spacing:.02em;white-space:nowrap}
.wk-cam{top:142px;right:10px;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(14,15,18,0.62);pointer-events:auto;cursor:pointer;touch-action:manipulation}
.wk-cam svg{width:24px;height:24px;fill:none;stroke:#F2F3F5;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.wk-cam[aria-pressed="true"]{background:#FF6A1F}
.wk-cam[aria-pressed="true"] svg{stroke:#1A0F07}
.wk-btns{right:12px;bottom:22px;display:flex;flex-direction:column;align-items:flex-end;gap:12px;pointer-events:auto}
.wk-btns b{width:68px;height:68px;border-radius:50%;display:grid;place-items:center;background:rgba(14,15,18,0.62);font-size:21px;font-weight:700;box-shadow:0 4px 0 rgba(0,0,0,0.35);cursor:pointer;touch-action:manipulation}
.wk-btns b.on{transform:translateY(3px);box-shadow:none;background:#FF6A1F;color:#1A0F07}
.wk-toast{top:34%;left:50%;width:max-content;max-width:calc(100% - 32px);box-sizing:border-box;padding:9px 20px;border-radius:22px;background:rgba(14,15,18,0.78);font-size:20px;font-weight:700;line-height:1.3;text-align:center;text-wrap:balance;opacity:0;transform:translate(-50%,-50%) scale(.92);transition:opacity .15s,transform .15s}
.wk-toast.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
@media (prefers-reduced-motion:reduce){.wk-toast,.wk-chip svg,.wk-stick{transition:none}.wk-act::after{animation:none}}
`;
const ICON = {
  up: '<svg viewBox="0 0 24 24"><path d="M12 2.5l7.5 9.5h-4.6v9.5H9.1V12H4.5z"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6.2 9.5-6.2 9.5 6.2 9.5 6.2-3.5 6.2-9.5 6.2S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
  // 大按鈕的圖：上車（汽車）、鐵捲門往上／往下、鑰匙、手（跟 drive.js 一樣的線條）
  car: '<svg viewBox="0 0 24 24"><path d="M3.5 16.5v-3.2l1.8-4.4a1.6 1.6 0 0 1 1.5-1h10.4a1.6 1.6 0 0 1 1.5 1l1.8 4.4v3.2z"/><path d="M3.5 13.3h17"/><circle cx="7.6" cy="18.2" r="1.7"/><circle cx="16.4" cy="18.2" r="1.7"/></svg>',
  door: '<svg viewBox="0 0 24 24"><path d="M3.5 20.5v-16h17v16"/><path d="M3.5 8.5h17M3.5 12h17"/><path d="M12 20.5v-5.8M9.2 17.2l2.8-2.8 2.8 2.8"/></svg>',
  doorDown: '<svg viewBox="0 0 24 24"><path d="M3.5 20.5v-16h17v16"/><path d="M3.5 8.5h17M3.5 12h17"/><path d="M12 14.4v5.8M9.2 17.4l2.8 2.8 2.8-2.8"/></svg>',
  key: '<svg viewBox="0 0 24 24"><circle cx="8" cy="15.5" r="4.2"/><path d="M11 12.5l8.5-8.5M16.2 7.3l2.6 2.6M13.8 9.7l2 2"/></svg>',
  hand: '<svg viewBox="0 0 24 24"><path d="M10.2 21l-3.6-4.6a1.5 1.5 0 0 1 2.3-1.9l1.3 1.5V9.2a1.6 1.6 0 0 1 3.2 0v4.6l3.8.8a1.9 1.9 0 0 1 1.5 2.1l-.6 4.3"/><path d="M7.6 6.6a5 5 0 0 1 8.3 0"/></svg>',
  // 第 2 批（車庫）：升降機（柱子、平台、上下箭頭）、床（睡覺）
  lift: '<svg viewBox="0 0 24 24"><path d="M3.5 20.5h17M19.5 20.5V3.5M3.5 12h16"/><path d="M6.6 7.4l2.4-2.4 2.4 2.4M9 5v4.6M12.6 15.6l2.4 2.4 2.4-2.4M15 18v-4.6"/></svg>',
  bed: '<svg viewBox="0 0 24 24"><path d="M3 19V6.5M3 15h18v4M21 15v-2.3a2.2 2.2 0 0 0-2.2-2.2H11V15"/><circle cx="7" cy="12.2" r="1.9"/><path d="M14.5 3.5h3l-3 3.2h3"/></svg>',
  // 自訂角色（小房子的衣櫃前面：換衣服）：T 恤
  shirt: '<svg viewBox="0 0 24 24"><path d="M9 3.5L3.5 6.6l2.2 4.1 2.1-1.1v10.9h8.4V9.6l2.1 1.1 2.2-4.1L15 3.5a3 3 0 0 1-6 0z"/></svg>',
  // 搖桿外圈：上下左右四個小三角
  ring: '<svg viewBox="0 0 128 128"><path d="M64 9l7 9H57zM64 119l7-9H57zM9 64l9-7v14zM119 64l-9-7v14z"/></svg>',
};

// ---- 碰撞物的格子（8 公尺一格；跟 drive.js 的 colGrid 一樣，多了 y0：碰撞物的底有多高）----
function colGrid() {
  const CELL = 8, grid = new Map(), tags = new Map(), found = []; let stamp = 0;
  const key = (gx, gz) => gx * 65536 + gz;
  function add(list, tag = null) {
    const out = [];
    for (const c of list || []) {
      if (!c || !isFinite(c.x) || !isFinite(c.z)) continue;
      const box = c.t === 'box'; if (box ? !(c.hx > 0 && c.hz > 0) : !(c.r > 0)) continue;
      const rot = c.rot || 0, q = { t: box ? 'box' : 'circle', x: c.x, z: c.z, hx: box ? c.hx : 0, hz: box ? c.hz : 0, r: box ? 0 : c.r, h: c.h ?? 9, y0: c.y0 || 0,
        u0: Math.cos(rot), u1: -Math.sin(rot), w0: Math.sin(rot), w1: Math.cos(rot), tag, src: c, cells: [], _s: 0 }; // src＝原來那個（第 7 批：被怪獸卡車輾扁的 crushed 就不擋了）
      const ex = box ? Math.abs(q.u0) * q.hx + Math.abs(q.w0) * q.hz : q.r, ez = box ? Math.abs(q.u1) * q.hx + Math.abs(q.w1) * q.hz : q.r;
      for (let gx = Math.floor((q.x - ex) / CELL); gx <= Math.floor((q.x + ex) / CELL); gx++) for (let gz = Math.floor((q.z - ez) / CELL); gz <= Math.floor((q.z + ez) / CELL); gz++) {
        if (box) { // 斜的長方形只放真的碰到的格子
          const dx = (gx + 0.5) * CELL - q.x, dz = (gz + 0.5) * CELL - q.z, hc = CELL / 2;
          if (Math.abs(dx * q.u0 + dz * q.u1) > q.hx + hc * (Math.abs(q.u0) + Math.abs(q.u1)) || Math.abs(dx * q.w0 + dz * q.w1) > q.hz + hc * (Math.abs(q.w0) + Math.abs(q.w1))) continue;
        }
        const k = key(gx, gz); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(q); q.cells.push(k);
      }
      if (tag != null) { let t = tags.get(tag); if (!t) tags.set(tag, (t = [])); t.push(q); }
      out.push(q);
    }
    return out;
  }
  function remove(tag) {
    const t = tag != null && tags.get(tag); if (!t) return 0;
    for (const q of t) for (const k of q.cells) { const a = grid.get(k); if (!a) continue; const i = a.indexOf(q); if (i >= 0) a.splice(i, 1); if (!a.length) grid.delete(k); }
    tags.delete(tag); return t.length;
  }
  const near = (x0, z0, x1, z1) => { // 這個範圍裡的碰撞物（放在 found，下一次呼叫會蓋掉）
    stamp++; found.length = 0;
    for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++) for (let gz = Math.floor(z0 / CELL); gz <= Math.floor(z1 / CELL); gz++) {
      const a = grid.get(key(gx, gz)); if (!a) continue;
      for (let i = 0; i < a.length; i++) { const c = a[i]; if (c._s !== stamp) { c._s = stamp; found.push(c); } }
    }
    return found;
  };
  return { add, remove, near, clear: () => { for (const t of [...tags.keys()]) remove(t); } };
}
// 圓（角色，圓心 px, pz、半徑 r）碰到 c：推出去的量放在 PUSH；沒碰到回傳 false
const PUSH = [0, 0];
function pushOut(px, pz, r, c) {
  if (c.src && c.src.crushed === true) return false; // 第 7 批（輾扁）：扁掉的東西（垃圾桶、板凳⋯）走過去、鏡頭都不擋
  if (c.t === 'box') {
    const dx = px - c.x, dz = pz - c.z, lu = dx * c.u0 + dz * c.u1, lw = dx * c.w0 + dz * c.w1;
    const eu = lu - clamp(lu, -c.hx, c.hx), ew = lw - clamp(lw, -c.hz, c.hz), d2 = eu * eu + ew * ew;
    if (d2 >= r * r) return false;
    let pu, pw;
    if (d2 > 1e-12) { const d = Math.sqrt(d2), k = (r - d) / d; pu = eu * k; pw = ew * k; }
    else { const au = c.hx - Math.abs(lu), aw = c.hz - Math.abs(lw); if (au < aw) { pu = (lu < 0 ? -1 : 1) * (au + r); pw = 0; } else { pu = 0; pw = (lw < 0 ? -1 : 1) * (aw + r); } } // 圓心在裡面：從最近的那面推出去
    PUSH[0] = pu * c.u0 + pw * c.w0; PUSH[1] = pu * c.u1 + pw * c.w1;
    return true;
  }
  const dx = px - c.x, dz = pz - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
  if (d2 >= rr * rr) return false;
  if (d2 > 1e-12) { const d = Math.sqrt(d2), k = (rr - d) / d; PUSH[0] = dx * k; PUSH[1] = dz * k; } else { PUSH[0] = rr; PUSH[1] = 0; }
  return true;
}
// 一條線（3D：從 (ax, ay, az) 走 (dx, dy, dz)）第一次碰到 c（xz 往外多 m、高度 y0−m … h+m）是在哪裡：0–1；沒碰到（或比 best 遠）回傳 best
function segHit(c, ax, ay, az, dx, dy, dz, m, best) {
  let t0 = 0, t1 = best;
  const ox = ax - c.x, oz = az - c.z;
  if (c.t === 'box') {
    for (let k = 0; k < 2; k++) {
      const a0 = k ? c.w0 : c.u0, a1 = k ? c.w1 : c.u1, e = (k ? c.hz : c.hx) + m, p = ox * a0 + oz * a1, d = dx * a0 + dz * a1;
      if (d > -1e-9 && d < 1e-9) { if (p > e || p < -e) return best; continue; }
      let ta = (-e - p) / d, tb = (e - p) / d; if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return best;
    }
  } else {
    const rr = c.r + m, A = dx * dx + dz * dz, B = ox * dx + oz * dz, Cc = ox * ox + oz * oz - rr * rr;
    if (A < 1e-12) { if (Cc > 0) return best; }
    else { const disc = B * B - A * Cc; if (disc < 0) return best; const sq = Math.sqrt(disc), ta = (-B - sq) / A, tb = (-B + sq) / A; if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return best; }
  }
  const lo = c.y0 - m, hi = c.h + m; // 高度：矮的東西（車子、花台）鏡頭從上面看過去不算
  if (dy > -1e-9 && dy < 1e-9) return ay >= lo && ay <= hi ? t0 : best;
  let ya = (lo - ay) / dy, yb = (hi - ay) / dy; if (ya > yb) { const s = ya; ya = yb; yb = s; }
  if (ya > t0) t0 = ya; if (yb < t1) t1 = yb;
  return t0 <= t1 ? t0 : best;
}
// 碰撞物（原本的格式）→ 算好的（move 用：會動的東西每格照原本的值更新）
function syncQ(q, c) {
  const box = c.t === 'box', rot = c.rot || 0;
  q.t = box ? 'box' : 'circle'; q.x = +c.x || 0; q.z = +c.z || 0; q.hx = box ? c.hx : 0; q.hz = box ? c.hz : 0; q.r = box ? 0 : c.r || 0; q.h = c.h ?? 9; q.y0 = c.y0 || 0;
  if (q.rot !== rot) { q.rot = rot; q.u0 = Math.cos(rot); q.u1 = -Math.sin(rot); q.w0 = Math.sin(rot); q.w1 = Math.cos(rot); }
  q.ok = box ? c.hx > 0 && c.hz > 0 : c.r > 0;
}

// 透天厝、店面正面凸出來的東西（雨遮、陽台、招牌、鐵捲門的盒子：離地 2.7 公尺以上、牆外 1.1 公尺以內；village.js 的碰撞只到牆）：只擋鏡頭（y0），不擋人
function fronts(world) {
  const out = [];
  for (const b of world.buildings || []) {
    if (!(b.floors >= 2) || (b.kind !== 'house' && b.kind !== 'shop') || !(b.hx > 0 && b.hz > 0)) continue;
    const ry = b.rot || 0, k = b.hz + 0.56;
    out.push({ t: 'box', x: b.x + Math.sin(ry) * k, z: b.z + Math.cos(ry) * k, hx: b.hx, hz: 0.56, rot: ry, y0: 2.7, h: b.h });
  }
  return out;
}

// ---- 小地圖的底圖（跟 drive.js 一樣畫；同一個 world 只畫一張，大家共用）----
const LAYERS = new WeakMap();
function mapLayer(world) {
  let L = LAYERS.get(world); if (L) return L;
  const b = world.mapBounds || world.bounds || { x0: -400, x1: 20, z0: -120, z1: 100 }, pad = 50, x0 = b.x0 - pad, z0 = b.z0 - pad, x1 = b.x1 + 150, z1 = b.z1 + pad;
  const ms = Math.min(2, 4096 / Math.max(x1 - x0, z1 - z0), Math.sqrt(4e6 / ((x1 - x0) * (z1 - z0))));
  const c = document.createElement('canvas'); c.width = Math.ceil((x1 - x0) * ms); c.height = Math.ceil((z1 - z0) * ms);
  const g = c.getContext('2d'); g.scale(ms, ms); g.translate(-x0, -z0);
  const rect = (r) => { g.save(); g.translate(r.x, r.z); g.rotate(-(r.rot || 0)); g.fillRect(-r.hx, -r.hz, r.hx * 2, r.hz * 2); g.restore(); };
  g.fillStyle = 'rgba(122,178,96,0.4)'; for (const p of world.areas?.paddy || []) rect(p);
  g.fillStyle = 'rgba(206,210,218,0.26)'; for (const c2 of world.colliders || []) if (c2.t === 'box' && (c2.h ?? 0) >= 4 && c2.hx < 30 && c2.hz < 30) rect(c2);
  g.fillStyle = 'rgba(233,235,238,0.5)'; g.fillRect(-60, -6, 820, 12); // 賽道
  const col = { main: '#e9ebee', strip: '#e9ebee', highway: '#f4f5f7', street: '#c9cdd4', drive: '#c9cdd4', farm: '#b5b9ac' };
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const r of world.roads || []) { g.strokeStyle = col[r.kind] || '#c9cdd4'; g.lineWidth = Math.max(5, r.w * 0.95); g.beginPath(); r.pts.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.stroke(); }
  g.fillStyle = '#f2f3f5'; g.fillRect(-0.6, -6, 1.2, 12); // 起跑線
  L = { c, ms, x0, z0 }; LAYERS.set(world, L);
  return L;
}

function createWalker(o) {
  const scene = o.scene, camera = o.camera, world = o.world || {}, places = world.places || {};
  const hasDoc = typeof document !== 'undefined' && !!o.hudParent;
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wb = o.bounds || (() => { const b = world.bounds || { x0: -1320, x1: 12, z0: -1000, z1: 1000 }; return { x0: b.x0 - 150, x1: Math.max(b.x1, 760) + 480, z0: b.z0 - 120, z1: b.z1 + 120 }; })(); // 地面鋪到哪裡
  const cw = colGrid(); cw.add(world.colliders, 'world'); cw.add(o.colliders); cw.add(fronts(world)); // 村子的碰撞標 'world'：走進房子（interiors.js）頁面先拿掉（房子的地板被村子的盒子蓋住），出來再放回去
  let movers = null; const mq = []; let mqN = 0; // 會動的（頁面的陣列）→ 算好的
  let marks = null; // 別的模組給的小地圖點（setMarkers）：[{ x, z, fill, ring, r, on }]
  const marksT = {}; // setMarkers(list, tag)：另外一組（一起開車的朋友），label＝點上面的字
  let mapTap = null; // setMapTap：點小地圖做什麼（大地圖），下面一條字

  // ---- 狀態 ----
  let ch = null, R = 0.28, BH = 1.72, alive = true, active = false, now = 0, lockT = 0;
  const st = { x: 0, z: 0, th: 0, vx: 0, vz: 0, speed: 0, anim: 'idle', play: null, mode: 'off', running: false, close: false, ix: 0, iz: 0, im: 0, near: null };
  const pose0 = { speed: 0, state: 'idle' }; // character.update 的參數（重複用）
  let scr = null; // 下車、坐進去的小動畫 { kind, t, T, x0, z0, x1, z1, h0, h1, ax, az, rec }
  let tgt = null; // 走去車門 { rec, pts, n, i, t, cancel, side }
  const events = []; // 這一格最後才叫的（門、上車）
  const pad = { id: null, x: 0, y: 0, m: 0, run: false, cx: 0, cy: 0 }; // 左下角的搖桿（x 右、y 前）
  const kb = {}; let forced = null;
  const inp = { x: 0, y: 0, m: 0, run: false };
  const cam = { yaw: 0, pitch: PITCH0, dist: CAM_D, cd: CAM_D, want: CAM_D, so: 0.32, mode: 'follow', hold: 0, maxY: Infinity, near0: null, look: null };
  const blend = { on: false, t: 0, T: 0.6, p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 60 }; // 走路接過鏡頭：從原本的位置慢慢移過來
  const hand = { on: false, go: false, t: 0, T: 0.55, p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 60, last: new THREE.Vector3() }; // 上車以後：等開車的接手鏡頭，再慢慢移過去
  const V1 = new THREE.Vector3(), Q1 = new THREE.Quaternion();

  function setCharacter(c) {
    if (ch && ch !== c) ch.group.removeFromParent();
    ch = c || null; R = ch?.radius || 0.28; BH = ch?.height || 1.72;
    if (ch && scene && ch.group.parent !== scene) scene.add(ch.group);
    if (ch) { ch.group.visible = active && st.mode !== 'off'; place(); }
  }
  // 地面高度：村子是平的（0）；越野車場（第 4 批 offroad.js 的 buildOffroad）有 world.heightAt：人站在地形上、鏡頭跟著高低
  const groundY = (x, z) => (typeof world.heightAt === 'function' ? world.heightAt(x, z) || 0 : 0);
  function place() { if (ch) { ch.group.position.set(st.x, groundY(st.x, st.z), st.z); ch.group.rotation.set(0, st.th, 0); } }

  // ---- 碰撞 ----
  function syncMovers() {
    mqN = 0; if (!movers) return;
    for (let i = 0; i < movers.length; i++) { const c = movers[i]; if (!c) continue; if (!mq[mqN]) mq[mqN] = { rot: NaN }; syncQ(mq[mqN], c); if (mq[mqN].ok) mqN++; }
  }
  const blocksBody = (c) => c.y0 < BH + 0.05; // 天花板、捲起來的門（底比頭高）不擋人
  function collide() { // 推出去（最多 6 輪）；還卡著（夾在兩個東西中間，例如牆跟機車之間的縫）回傳 false
    const r2 = R - 0.004;
    for (let it = 0; it < 6; it++) {
      let moved = false;
      const list = cw.near(st.x - R - 0.05, st.z - R - 0.05, st.x + R + 0.05, st.z + R + 0.05);
      for (let i = 0; i < list.length; i++) { const c = list[i]; if (blocksBody(c) && pushOut(st.x, st.z, R, c)) { slide(); moved = true; } }
      for (let i = 0; i < mqN; i++) { const c = mq[i]; if (blocksBody(c) && pushOut(st.x, st.z, R, c)) { slide(); moved = true; } }
      if (!moved) return true;
    }
    return freeAt(st.x, st.z, r2, true);
  }
  function slide() { // 推出去、撞進去的速度拿掉（沿著牆滑）
    st.x += PUSH[0]; st.z += PUSH[1];
    const l = Math.hypot(PUSH[0], PUSH[1]); if (l < 1e-9) return;
    const nx = PUSH[0] / l, nz = PUSH[1] / l, vn = st.vx * nx + st.vz * nz;
    if (vn < 0) { st.vx -= nx * vn; st.vz -= nz * vn; }
  }
  function freeAt(x, z, r, anywhere) { // 這裡站得下（不碰到任何擋人的東西、在範圍裡）
    if (!anywhere && (x < wb.x0 || x > wb.x1 || z < wb.z0 || z > wb.z1)) return false;
    const list = cw.near(x - r, z - r, x + r, z + r);
    for (let i = 0; i < list.length; i++) if (blocksBody(list[i]) && pushOut(x, z, r, list[i])) return false;
    for (let i = 0; i < mqN; i++) if (blocksBody(mq[i]) && pushOut(x, z, r, mq[i])) return false;
    return true;
  }
  function segBlocked(ax, az, bx, bz) { // 兩點之間（人的高度）有沒有擋人的東西
    const list = cw.near(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz));
    for (let i = 0; i < list.length; i++) if (blocksBody(list[i]) && segHit(list[i], ax, 1, az, bx - ax, 0, bz - az, 0, 1) < 1) return true;
    return false;
  }
  // 鏡頭的線（3D）第一次碰到東西是在哪裡：0–1（1＝沒碰到）；離牆留 CAM_M
  function rayT(ax, ay, az, bx, by, bz) {
    const m = CAM_M, dx = bx - ax, dy = by - ay, dz = bz - az;
    let best = 1;
    const list = cw.near(Math.min(ax, bx) - m, Math.min(az, bz) - m, Math.max(ax, bx) + m, Math.max(az, bz) + m);
    for (let i = 0; i < list.length; i++) best = segHit(list[i], ax, ay, az, dx, dy, dz, m, best);
    for (let i = 0; i < mqN; i++) best = segHit(mq[i], ax, ay, az, dx, dy, dz, m, best);
    return best;
  }

  // ---- 走 ----
  function readInput() {
    if (forced) { inp.x = forced.x; inp.y = forced.y; inp.m = Math.min(1, Math.hypot(forced.x, forced.y)); inp.run = forced.run ?? inp.m >= 0.92; return; }
    const kx = (kb.R ? 1 : 0) - (kb.L ? 1 : 0), ky = (kb.U ? 1 : 0) - (kb.D ? 1 : 0);
    if (kx || ky) { const l = Math.hypot(kx, ky); inp.x = kx / l; inp.y = ky / l; inp.m = 1; inp.run = !!kb.S; return; }
    inp.x = pad.x; inp.y = pad.y; inp.m = pad.m; inp.run = pad.run;
  }
  function move(dt) { // 照速度走（小步、每步都推出去；推不出去就退回這一小步前面）；speed＝真的走了多快（頂著牆＝0，腳不會在原地踏）
    const x0 = st.x, z0 = st.z, sp = Math.hypot(st.vx, st.vz), n = Math.max(1, Math.ceil((sp * dt) / 0.12)), h = dt / n;
    for (let i = 0; i < n; i++) {
      const px = st.x, pz = st.z; st.x += st.vx * h; st.z += st.vz * h;
      if (!collide() && freeAt(px, pz, R - 0.004, true)) { st.x = px; st.z = pz; st.vx *= 0.5; st.vz *= 0.5; break; }
    }
    st.x = clamp(st.x, wb.x0, wb.x1); st.z = clamp(st.z, wb.z0, wb.z1);
    st.speed = Math.hypot(st.x - x0, st.z - z0) / dt;
  }
  function turnToward(a, dt, k) { st.th = wrapA(st.th + wrapA(a - st.th) * (1 - Math.exp(-dt * k))); }
  function walkStep(dt) {
    const fx = Math.cos(cam.yaw), fz = -Math.sin(cam.yaw), rx = -fz, rz = fx; // 鏡頭的前面、右邊
    let wx = fx * inp.y + rx * inp.x, wz = fz * inp.y + rz * inp.x; const wl = Math.hypot(wx, wz);
    if (wl > 1e-6) { wx /= wl; wz /= wl; }
    const m = inp.m, run = inp.run && m > 0.3, vt = m < 0.12 ? 0 : run ? RUN : WALK * (0.4 + 0.6 * smooth01((m - 0.12) / 0.5)); // 推一點慢慢走、推到一半 1.4、推到底跑
    st.ix = wx; st.iz = wz; st.im = m < 0.12 ? 0 : m;
    const tvx = wx * vt, tvz = wz * vt, ddx = tvx - st.vx, ddz = tvz - st.vz, dl = Math.hypot(ddx, ddz), a = (vt > Math.hypot(st.vx, st.vz) ? ACC : DEC) * dt;
    if (dl <= a) { st.vx = tvx; st.vz = tvz; } else { st.vx += (ddx / dl) * a; st.vz += (ddz / dl) * a; }
    move(dt);
    if (cam.mode === 'eye') { if (vt > 0.05 || st.speed > 0.1) st.th = cam.yaw; } // 第一人稱：身體跟著頭
    else if (vt > 0.05) turnToward(Math.atan2(-wz, wx), dt, run ? 11 : 9); // 臉慢慢轉向走的方向
    st.running = run && vt > 0;
  }
  function scriptStep(dt) { // 下車（從車門走出來）、坐進去（從車門走進去）
    const S = scr; S.t += dt;
    const k = Math.min(1, S.t / S.T), e = 1 - (1 - k) * (1 - k), px = st.x, pz = st.z;
    st.x = S.x0 + (S.x1 - S.x0) * e; st.z = S.z0 + (S.z1 - S.z0) * e; st.vx = st.vz = 0;
    st.speed = Math.hypot(st.x - px, st.z - pz) / dt;
    st.th = wrapA(S.h0 + wrapA(S.h1 - S.h0) * (S.kind === 'out' ? smooth01((k - 0.45) / 0.55) : smooth01(k / 0.4)));
    if (k >= 1) { if (S.kind === 'out') { scr = null; st.mode = 'walk'; st.speed = 0; } else finishIn(S.rec); }
  }
  function autoStep(dt) { // 自己走去車門（推搖桿就取消；卡住了：很近就直接坐進去，不然取消）
    const T = tgt; T.t += dt;
    if (inp.m > 0.5) { T.cancel += dt; if (T.cancel > 0.2) { tgt = null; st.mode = 'walk'; walkStep(dt); return; } } else T.cancel = 0;
    let px = T.pts[T.i * 2], pz = T.pts[T.i * 2 + 1], dx = px - st.x, dz = pz - st.z, d = Math.hypot(dx, dz);
    if (d < 0.12) {
      if (T.i < T.n - 1) { T.i++; px = T.pts[T.i * 2]; pz = T.pts[T.i * 2 + 1]; dx = px - st.x; dz = pz - st.z; d = Math.hypot(dx, dz); }
      else { startSeat(T.rec, T.side); return; }
    }
    if (T.stuck > 0.5 || T.t > 5) { // 走不過去（中間有牆、別的車）
      const L = T.n - 1, ex = T.pts[L * 2], ez = T.pts[L * 2 + 1];
      if (Math.hypot(ex - st.x, ez - st.z) < 0.7 && !segBlocked(st.x, st.z, ex, ez)) { st.x = ex; st.z = ez; startSeat(T.rec, T.side); return; }
      tgt = null; st.mode = 'walk'; st.vx = st.vz = 0; toast('過不去：走到車門旁邊再按一次'); return;
    }
    const v = Math.min(BRISK, d / dt); st.vx = (dx / d) * v; st.vz = (dz / d) * v;
    move(dt); turnToward(Math.atan2(-dz, dx), dt, 12);
    T.stuck = st.speed < 0.25 * Math.min(v, 1) ? T.stuck + dt : 0;
    st.ix = st.iz = st.im = 0;
  }

  // ---- 門：走到門口、往門裡面推 → onDoor ----
  let doorSrc = o.doors === undefined ? 'village' : o.doors, doorList = [];
  function buildDoors(src) {
    const out = [];
    const list = src === 'village' ? (world.buildings || []).filter((b) => b.door && b.kind !== 'garage').map((b) => [b, b.door, 0.8, true]) : Array.isArray(src) ? src.filter(Boolean).map((d) => [d, d, d.w ?? 0.9, false]) : [];
    for (const [ref, d, w, village] of list) {
      const ry = d.ry || 0, nx = -Math.sin(ry), nz = -Math.cos(ry), tx = Math.cos(ry), tz = -Math.sin(ry); // n＝往裡面、t＝沿著門
      if (village && !segBlocked(d.x, d.z, d.x + nx * 1.6, d.z + nz * 1.6)) continue; // 門開著（改車廠的大門）：自己走進去，不用觸發
      let ax = d.x, az = d.z; // 門點在牆裡面（廟的台階）：往外找站得下的地方
      for (let k = 0; k <= 60 && !freeAt(ax, az, R + 0.06); k++) { ax = d.x - nx * 0.1 * k; az = d.z - nz * 0.1 * k; }
      out.push({ ref, x: d.x, z: d.z, ry, w, ax, az, nx, nz, tx, tz, armed: true, push: 0, zone: { x: d.x, z: d.z, ry, ax, az } });
    }
    return out;
  }
  function inDoorZone(d, x, z) { const dx = x - d.ax, dz = z - d.az, lat = dx * d.tx + dz * d.tz, dep = dx * d.nx + dz * d.nz; return Math.abs(lat) < d.w && dep > -0.65 && dep < 2.5; }
  function armDoors() { for (const d of doorList) { d.armed = !inDoorZone(d, st.x, st.z); d.push = 0; } }
  function doorTick(dt) {
    for (let i = 0; i < doorList.length; i++) {
      const d = doorList[i], dx = st.x - d.ax, dz = st.z - d.az;
      if (dx * dx + dz * dz > 12) { d.armed = true; d.push = 0; continue; }
      const lat = dx * d.tx + dz * d.tz, dep = dx * d.nx + dz * d.nz;
      if (!(Math.abs(lat) < d.w && dep > -0.65 && dep < 2.5)) { if (Math.abs(lat) > d.w + 0.35 || dep < -1.1) d.armed = true; d.push = 0; continue; }
      if (!d.armed) continue;
      const toward = st.im > 0.3 && st.ix * d.nx + st.iz * d.nz > 0.55; // 往門裡面推（被牆擋住也算：看的是想走的方向）
      d.push = toward ? d.push + dt : 0;
      if (d.push >= 0.12) { d.armed = false; d.push = 0; events.push(d); }
    }
  }

  // ---- 車：可以上的車（setCars 給的＋你剛下來的那台）----
  let leadCars = [], parked = null; const recs = [];
  function mkRec(car) {
    const h = car.heading || 0, c = Math.cos(h), s = Math.sin(h), cx = car.cx || 0, cz = car.cz || 0;
    const rec = { car, h, c, s, hx: +car.hx || 2.2, hz: +car.hz || 0.9, bx: car.x + cx * c + cz * s, bz: car.z - cx * s + cz * c, door: +car.door || 0 };
    rec.act = { label: car.name ? `上車 · ${car.name}` : '上車', icon: 'car', onClick: () => getIn(car) };
    return rec;
  }
  function rebuildCars(noParkedCol) {
    cw.remove('__cars'); recs.length = 0;
    const cols = [], seen = new Set();
    for (const car of parked ? [parked, ...leadCars] : leadCars) {
      if (!car || !isFinite(car.x) || !isFinite(car.z)) continue;
      const id = car.object || car; if (seen.has(id)) continue; seen.add(id); // 同一台給兩次（頁面的清單也有剛下來那台）只算一次
      const r = mkRec(car); recs.push(r);
      if (car.solid !== false && !(noParkedCol && car === parked)) cols.push({ t: 'box', x: r.bx, z: r.bz, hx: r.hx, hz: r.hz, rot: r.h, h: car.h ?? 1.4 });
    }
    cw.add(cols, '__cars');
  }
  const toWorldU = (r, lu, lw, out) => { out[0] = r.bx + lu * r.c + lw * r.s; out[1] = r.bz - lu * r.s + lw * r.c; return out; }; // 車身長方形本地 → 世界
  const PT = [0, 0];
  let reach = true; // setCarReach(false)：人在房子裡面（車停在外面、隔著牆）不給「上車」
  function nearestCar() {
    if (!reach) return null;
    let best = null, bd = REACH;
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i], dx = st.x - r.bx, dz = st.z - r.bz, eu = Math.abs(dx * r.c - dz * r.s) - r.hx, ew = Math.abs(dx * r.s + dz * r.c) - r.hz;
      const d = Math.hypot(eu > 0 ? eu : 0, ew > 0 ? ew : 0); if (d < bd) { bd = d; best = r; }
    }
    return best;
  }
  // 下車：人站哪裡（左邊駕駛座→右邊→後面→前面→再遠一點）；回傳 [起點 x, z, 終點 x, z, 臉朝]
  function exitSpot(r) {
    const side = R + 0.14, u = r.door;
    const C = [[u, -(r.hz + side), u, -(r.hz - 0.28), Math.PI / 2], [u, r.hz + side, u, r.hz - 0.28, -Math.PI / 2], [-(r.hx + side + 0.1), 0, -(r.hx - 0.3), 0, Math.PI], [r.hx + side + 0.1, 0, r.hx - 0.3, 0, 0],
      [u, -(r.hz + side + 0.5), u, -(r.hz - 0.28), Math.PI / 2], [u, r.hz + side + 0.5, u, r.hz - 0.28, -Math.PI / 2], [u - 1.2, -(r.hz + side), u - 1.2, -(r.hz - 0.28), Math.PI / 2], [u + 1.2, -(r.hz + side), u + 1.2, -(r.hz - 0.28), Math.PI / 2]];
    const IN = [0, 0];
    for (const c of C) { // 站得下、從車門走出去中間沒有牆（車子自己的碰撞這時候還沒放）
      toWorldU(r, c[0], c[1], PT); toWorldU(r, c[2], c[3], IN);
      if (freeAt(PT[0], PT[1], R + 0.03) && !segBlocked(IN[0], IN[1], PT[0], PT[1])) return [IN[0], IN[1], PT[0], PT[1], wrapA(r.h + c[4])];
    }
    return null;
  }
  function getOut(drv, S, op = {}) {
    if (!alive || !drv || st.mode !== 'off') return null;
    const t = drv.telemetry(); if (t.paused || Math.abs(t.v) >= 1) return null;
    const ci = drv.carInfo;
    const car = { key: op.key ?? null, name: op.name ?? null, x: t.x, z: t.z, heading: t.heading, hx: ci.len / 2, hz: ci.halfW, cx: (ci.nose + ci.tail) / 2, cz: 0, h: op.h ?? 1.4, door: op.door ?? 0, object: S ? S.car : null, drive: true, drv, S };
    const prev = parked; parked = car; rebuildCars(true); // 同一台在清單裡的舊位置拿掉；自己的碰撞先不放
    const spot = exitSpot(recs[0]);
    if (!spot) { parked = prev; rebuildCars(); if (drv.toast) drv.toast('這裡太擠了，下不了車', 1800); return null; } // 四邊都沒地方站：不下車
    drv.pause(); // 停在原地、熄火（HUD 收起來）
    const sh = scene && scene.getObjectByName('drive-shadow'); if (sh) sh.visible = true; // 車子底下的影子留著（drive.pause 會藏起來）
    rebuildCars();
    const r = recs[0], [x0, z0, x1, z1, face] = spot;
    st.x = x0; st.z = z0; st.th = face; st.vx = st.vz = 0; st.speed = 0; st.play = null;
    scr = { kind: 'out', t: 0, T: calm ? 0.2 : 0.42, x0, z0, x1, z1, h0: face, h1: wrapA(face + wrapA(r.h - face) * 0.5), ax: x1, az: z1, rec: r }; // 走出來、轉一半朝車頭那邊
    cam.yaw = t.heading; cam.pitch = PITCH0; cam.hold = 0; cam.cd = cam.want = cam.dist;
    activate({ blend: calm ? 0.2 : 0.6 });
    st.mode = 'out'; place();
    return car;
  }
  function getIn(car) {
    if (!alive || !active || st.mode !== 'walk' || now < lockT) return false;
    let r = null; for (const x of recs) if (x.car === car) r = x;
    if (!r) r = nearestCar(); if (!r) return false;
    const dx = st.x - r.bx, dz = st.z - r.bz, lu = dx * r.c - dz * r.s, lw = dx * r.s + dz * r.c;
    const spot = (sd) => toWorldU(r, r.door, sd * (r.hz + R + 0.12), [0, 0]);
    let side = lw > 0.2 ? 1 : -1; // 站在哪一邊就走哪一邊（中間、前後＝駕駛座）
    if (!freeAt(...spot(side), R + 0.02) && freeAt(...spot(-side), R + 0.02)) side = -side;
    const pts = [], add = (u, w) => { const p = toWorldU(r, u, w, [0, 0]); pts.push(p[0], p[1]); };
    const cu = r.hx + R + 0.25, cwd = r.hz + R + 0.25;
    if (lw * side < r.hz + R * 0.5) { // 不在那一邊（在車頭、車尾前面，或另一邊）：先走到車角
      const su = lu >= 0 ? 1 : -1;
      if (lw * side < -(r.hz)) add(su * cu, -side * cwd); // 另一邊：先繞到前（後）面
      add(su * cu, side * cwd);
    }
    const d = spot(side); pts.push(d[0], d[1]);
    tgt = { rec: r, pts, n: pts.length / 2, i: 0, t: 0, cancel: 0, stuck: 0, side };
    st.mode = 'in'; setEff(null);
    return true;
  }
  function startSeat(r, side) {
    const [x1, z1] = toWorldU(r, r.door, side * (r.hz - 0.3), [0, 0]);
    scr = { kind: 'seat', t: 0, T: calm ? 0.15 : 0.32, x0: st.x, z0: st.z, x1, z1, h0: st.th, h1: wrapA(r.h - side * Math.PI / 2), ax: st.x, az: st.z, rec: r };
    tgt = null; st.mode = 'seat';
  }
  function finishIn(r) { // 坐進去了：角色藏起來、走路暫停；是剛下來那台就直接接回開車
    const car = r.car;
    scr = null; tgt = null;
    handOff();
    parked = null; rebuildCars();
    if (car.drive && car.drv) { car.drv.resume(); if (car.drv.cameraMode) car.drv.setCameraMode(car.drv.cameraMode); }
    events.push(car);
  }
  function handOff() { // 走路收起來（HUD、角色），鏡頭等開車的接手
    if (ch) ch.group.visible = false;
    if (camera) { hand.on = true; hand.go = false; hand.t = 0; hand.p.copy(camera.position); hand.q.copy(camera.quaternion); hand.fov = camera.fov; hand.last.copy(camera.position); }
    deactivate(false);
  }
  function handTick(dt) { // 開車的動了鏡頭（跟我們最後擺的位置不一樣）→ 從走路的位置慢慢移過去
    if (!hand.on || !camera) return;
    if (!hand.go) { if (camera.position.distanceToSquared(hand.last) < 1e-8) return; hand.go = true; }
    hand.t += dt; const e = smooth01(hand.t / (calm ? 0.2 : hand.T));
    V1.copy(camera.position); Q1.copy(camera.quaternion); const f1 = camera.fov;
    camera.position.lerpVectors(hand.p, V1, e); camera.quaternion.slerpQuaternions(hand.q, Q1, e);
    const f = hand.fov + (f1 - hand.fov) * e; if (Math.abs(f - camera.fov) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); }
    hand.last.copy(camera.position);
    if (e >= 1) hand.on = false;
  }

  // ---- 你家（room.js）：碰撞跟著鐵捲門、門口的大按鈕 ----
  let gar = null;
  const ACT_OPEN = { label: '開鐵捲門', icon: 'door', onClick: () => { if (gar && gar.G.door.t === 0 && !gar.G.door.moving) gar.G.door.open(calm ? 1.2 : 2.2); } };
  const ACT_CLOSE = { label: '關鐵捲門', icon: 'doorDown', onClick: () => { if (gar && gar.G.door.t === 1 && !gar.G.door.moving) gar.G.door.close(calm ? 1 : 1.8); } };
  function setGarage(G, op = {}) {
    cw.remove('__garage');
    gar = G ? { G, open: null, doorCam: null, close: !!op.close, act: op.doorAction !== false, ox: 0, oz: 0, c: 1, s: 0 } : null;
    if (gar) { const w = G.toWorld({ x: 0, z: 0, heading: 0 }); gar.ox = w.x; gar.oz = w.z; gar.c = Math.cos(w.heading); gar.s = Math.sin(w.heading); } // 世界 → 車庫本地（每一格用，不要每次問 room.js）
  }
  function garageTick() {
    if (!gar) return null;
    const G = gar.G, Z = G.size || { X: 5, XB: -12.7, Z: 12.7, H: 4.5, T: 0.3, TOP: 5.7, DZ: 3, DH: 3.8 }, t = G.door.t, open = t >= OPEN_T;
    if (open !== gar.open) { // 門開到人過得去（或關到過不去）：碰撞換一套
      cw.remove('__garage');
      const cols = G.colliders(open, true), w = (x, z) => G.toWorld({ x, z, heading: 0 }), ry = w(0, 0).heading;
      const lin = w(Z.X + Z.T / 2, 0), ceil = w((Z.XB + Z.X) / 2, 0);
      cols.push({ t: 'box', x: lin.x, z: lin.z, hx: Z.T / 2 + 0.02, hz: Z.DZ, rot: ry, y0: Z.DH, h: Z.TOP }); // 門楣（門上面的牆）：擋鏡頭
      cols.push({ t: 'box', x: ceil.x, z: ceil.z, hx: (Z.X - Z.XB) / 2, hz: Z.Z, rot: ry, y0: Z.H - 0.02, h: Z.TOP }); // 天花板：擋鏡頭
      let door = null;
      if (open) { const d = G.colliders(false, true).pop(); door = { ...d, y0: t * Z.DH }; cols.push(door); } // 捲一半的門：底在 t × 門高（人從下面過、鏡頭不穿過去）
      const added = cw.add(cols, '__garage');
      gar.doorCam = door ? added[added.length - 1] : null; gar.open = open;
    }
    if (gar.doorCam) gar.doorCam.y0 = t * Z.DH;
    if (!gar.act || st.mode !== 'walk') return null;
    const dx = st.x - gar.ox, dz = st.z - gar.oz, px = dx * gar.c - dz * gar.s, pz = dx * gar.s + dz * gar.c; // 車庫本地
    if (!(px > Z.X - 2.6 && px < Z.X + Z.T + 2.8 && Math.abs(pz) < Z.DZ + 0.7)) return null; // 門口（裡面、外面）
    if (G.door.moving) return null;
    if (t === 0) return ACT_OPEN;
    if (gar.close && t === 1 && Math.abs(px - (Z.X + Z.T / 2)) > 0.8) return ACT_CLOSE;
    return null;
  }

  // ---- 大按鈕（頁面給的 > 車庫門 > 上車）----
  let leadAct = null, eff = null;
  function setAction(a) { leadAct = a && a.label ? a : null; }
  function setEff(a) {
    const next = a && a.label ? a : null, icon = next && ICON[next.icon] ? next.icon : 'hand';
    const same = !!eff && !!next && eff.label === String(next.label) && eff.icon === icon;
    eff = next ? { label: String(next.label), icon, onClick: next.onClick } : null;
    if (!hud || same) return;
    hud.act.hidden = !eff; hud.act.classList.remove('on');
    if (eff) { hud.actText.textContent = eff.label; hud.actIcon.innerHTML = ICON[eff.icon]; hud.act.setAttribute('aria-label', eff.label); }
  }
  function doAction() {
    if (!eff || !active || st.mode !== 'walk' || now < lockT || !alive) return;
    const f = eff.onClick; if (typeof f === 'function') f(api);
  }

  // ---- 鏡頭 ----
  const baseFov = () => clamp((2 * Math.atan(Math.tan((56 * Math.PI) / 360) / (camera.aspect || 1)) * 180) / Math.PI, 50, 70);
  function recenter(dt) {
    if (cam.hold > 0) { cam.hold -= dt; return; }
    if (cam.mode !== 'follow' || st.mode !== 'walk' || st.speed < 0.4) return;
    const d = wrapA(st.th - cam.yaw), w = clamp(st.speed / RUN, 0, 1), k = (0.9 + 2.2 * w) * (Math.abs(d) < 2.3 ? 1 : 0.15); // 往鏡頭走過來就不硬轉
    cam.yaw = wrapA(cam.yaw + d * (1 - Math.exp(-dt * k)));
    cam.pitch += (PITCH0 - cam.pitch) * (1 - Math.exp(-dt * 0.7));
  }
  function camTick(dt) {
    if (!camera) return;
    const ax = scr ? scr.ax : st.x, az = scr ? scr.az : st.z, g0 = groundY(st.x, st.z), ay = g0 + Math.min(BH * 0.9 + 0.2, AY_MAX); // 看著頭上面一點（下車、坐進去的時候看站的地方）；高的人最高 AY_MAX；g0＝腳下的地面（越野車場）
    const fx = Math.cos(cam.yaw), fz = -Math.sin(cam.yaw);
    let sp = Math.sin(cam.pitch), cp = Math.cos(cam.pitch), px, py, pz;
    if (cam.mode === 'eye') { // 第一人稱：眼睛
      px = st.x + fx * 0.12; py = g0 + BH * 0.93; pz = st.z + fz * 0.12; st.close = true;
    } else {
      const D = cam.dist;
      if (ay + D * sp > cam.maxY - 0.15) { sp = clamp((cam.maxY - 0.15 - ay) / D, -0.4, sp); cp = Math.sqrt(1 - sp * sp); } // 天花板：鏡頭放低
      const Lx = cp * fx, Ly = -sp, Lz = cp * fz, rx = -fz, rz = fx;
      const so = cam.so * clamp((cam.cd - 0.6) / 0.9, 0, 1), ts = so > 0.01 ? rayT(ax, ay, az, ax + rx * so, ay, az + rz * so) : 1, sx = ax + rx * so * ts, sz = az + rz * so * ts; // 肩膀（被牆擋到就少一點）
      const tc = rayT(sx, ay, sz, sx - Lx * D, ay - Ly * D, sz - Lz * D);
      cam.want = D * tc;
      cam.cd = cam.want < cam.cd ? cam.want : cam.cd + (cam.want - cam.cd) * (1 - Math.exp(-dt * 2.5)); // 被擋到馬上拉近、沒擋了慢慢拉回去
      px = sx - Lx * cam.cd; py = Math.max(0.3, ay - Ly * cam.cd); pz = sz - Lz * cam.cd;
      if (g0 !== 0 || py < 0.35) py = Math.max(py, groundY(px, pz) + 0.3); // 越野車場：鏡頭不鑽進後面的坡
      st.close = st.close ? cam.cd < 0.75 : cam.cd < 0.55; // 貼著頭：角色藏起來
    }
    camera.position.set(px, py, pz);
    camera.lookAt(px + cp * fx * 5, py - sp * 5, pz + cp * fz * 5);
    const fov = baseFov() + 5 * smooth01((st.speed - 2) / 2.5); // 跑的時候廣一點
    if (blend.on) { // 從原本的鏡頭（開車的）慢慢移過來
      blend.t += dt; const e = smooth01(blend.t / blend.T);
      V1.copy(camera.position); Q1.copy(camera.quaternion);
      camera.position.lerpVectors(blend.p, V1, e); camera.quaternion.slerpQuaternions(blend.q, Q1, e);
      setFov(blend.fov + (fov - blend.fov) * e);
      if (e >= 1) blend.on = false;
    } else setFov(fov);
  }
  const setFov = (f) => { if (Math.abs(f - camera.fov) > 0.05) { camera.fov = f; camera.updateProjectionMatrix(); } };
  function setCamera(c = {}) {
    if (c.mode === 'follow' || c.mode === 'eye') { cam.mode = c.mode; if (c.mode === 'eye') cam.pitch = clamp(cam.pitch, -1.1, 1.2); else cam.pitch = clamp(cam.pitch, PMIN, PMAX); if (hud) hud.cam.setAttribute('aria-pressed', String(cam.mode === 'eye')); }
    if (isFinite(c.yaw)) cam.yaw = wrapA(+c.yaw);
    if (isFinite(c.pitch)) cam.pitch = cam.mode === 'eye' ? clamp(+c.pitch, -1.1, 1.2) : clamp(+c.pitch, PMIN, PMAX);
    if (isFinite(c.dist)) { cam.dist = clamp(+c.dist, 1.5, 8); cam.cd = Math.min(cam.cd, cam.dist); }
    if (c.maxY !== undefined) cam.maxY = c.maxY == null ? Infinity : +c.maxY;
    if (isFinite(c.yaw) || isFinite(c.pitch)) cam.hold = c.hold ?? 1.3;
  }
  function look(dx, dy) { // 手指、滑鼠拖：往右拖＝往右看、往上拖＝往上看
    cam.yaw = wrapA(cam.yaw - dx * 0.0068);
    cam.pitch = cam.mode === 'eye' ? clamp(cam.pitch + dy * 0.0052, -1.1, 1.2) : clamp(cam.pitch + dy * 0.0052, PMIN, PMAX);
    cam.hold = 1.3;
  }

  // ---- 目的地：路線、光柱、左上角 ----
  let dest = null, routeData = null, routeT = 0, routeS = 0, zoneNow = null;
  const placeAt = (p) => (p.zone ? [p.zone.x, p.zone.z] : p.pos ? [p.pos[0], p.pos[1]] : p.spawn ? [p.spawn.x, p.spawn.z] : null);
  const destStyle = (k) => DEST[k] || (places[k] ? { label: '去' + (places[k].name || k), icon: String(places[k].name || k).slice(0, 1), bg: '#3A3D44', fg: '#F2F3F5' } : null);
  function zoneTick() { zoneNow = null; for (const k in places) { const p = places[k]; if (p && p.zone && inRect(p.zone, st.x, st.z)) { zoneNow = k; break; } } }
  function routeTick(dt, force) {
    routeT -= dt;
    const p = dest && places[dest];
    if (!p) { routeData = null; routeS = 0; return; }
    if (routeT > 0 && !force) { if (routeData) routeS = walked(routeData.pts, st.x, st.z); return; }
    routeT = 0.4;
    let r = null;
    try { r = world.route ? world.route(st.x, st.z, dest) : null; } catch { r = null; }
    if (!r || !Array.isArray(r.pts) || r.pts.length < 2 || !(r.len >= 0)) { const q = placeAt(p); r = q ? { pts: [[st.x, st.z], q], len: Math.hypot(q[0] - st.x, q[1] - st.z), straight: true } : null; }
    routeData = r; routeS = 0;
  }
  const walked = (pts, x, z) => { // 走到路線上的哪裡（只找前面 40 公尺）
    let best = Infinity, s = 0, acc = 0;
    for (let i = 1; i < pts.length && acc < 40; i++) {
      const ax = pts[i - 1][0], az = pts[i - 1][1], dx = pts[i][0] - ax, dz = pts[i][1] - az, l2 = dx * dx + dz * dz, l = Math.sqrt(l2);
      const t = l2 > 0 ? clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) : 0, ex = ax + dx * t - x, ez = az + dz * t - z;
      if (ex * ex + ez * ez < best) { best = ex * ex + ez * ez; s = acc + l * t; }
      acc += l;
    }
    return s;
  };
  const along = (pts, d) => { for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d <= l && l > 0) return [pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * d) / l, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * d) / l]; d -= l; } return pts[pts.length - 1]; };
  let fx = null; // 光柱（跟 drive.js 一樣的樣子；有目的地才做）
  function makeBeacon() {
    const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0.95)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const add = (map) => new THREE.MeshBasicMaterial({ map, color: 0xff7a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 34, 24, 1, true).translate(0, 17, 0), add(tex));
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.3, 3.0, 48).rotateX(-Math.PI / 2), add(null)); ring.position.y = 0.08;
    pillar.renderOrder = ring.renderOrder = 4;
    const beacon = new THREE.Group(); beacon.name = 'walk-beacon'; beacon.add(pillar, ring); beacon.visible = false;
    if (scene) scene.add(beacon);
    return { beacon, pillar, ring, tex };
  }
  function beaconTick() {
    const p = dest && places[dest], q = p && placeAt(p), show = !!q && active && zoneNow !== dest;
    if (!fx) { if (!show || !scene) return; fx = makeBeacon(); }
    fx.beacon.visible = show; if (!show) return;
    fx.beacon.position.set(q[0], 0, q[1]);
    const k = (now * 0.7) % 1; fx.ring.scale.setScalar(1 + k * 0.7); fx.ring.material.opacity = 1 - k; fx.pillar.material.opacity = 0.75 + 0.25 * Math.sin(now * 3);
  }
  function setDestination(name) { dest = name && places[name] ? name : null; routeT = 0; routeTick(0, true); if (hud) hud.last.here = undefined; }

  // ---- HUD：左上目的地（下面大按鈕）、右上小地圖（下面換視角）、左下搖桿、右邊滑動轉頭、右下圓按鈕 ----
  const hud = hasDoc ? buildHud() : null;
  function buildHud() {
    if (!document.getElementById('wk-style')) { const s = document.createElement('style'); s.id = 'wk-style'; s.textContent = CSS; document.head.append(s); }
    const root = document.createElement('div'); root.className = 'wk'; root.hidden = true;
    root.innerHTML = `<div class="wk-look"></div><div class="wk-pad"></div><div class="wk-stick rest">${ICON.ring}<div class="wk-knob"></div></div>`
      + `<div class="wk-chip" hidden><i>${ICON.up}</i><b></b><small></small></div><button type="button" class="wk-act" hidden><i></i><span></span><kbd>E</kbd></button><div class="wk-map"><canvas></canvas><b class="wk-mapb" hidden></b></div>`
      + `<b class="wk-cam" role="button" aria-label="換視角（第一人稱）" aria-pressed="false">${ICON.eye}</b><div class="wk-btns" hidden></div><div class="wk-toast" role="status"></div>`;
    o.hudParent.append(root);
    const q = (s) => root.querySelector(s), H = { root, look: q('.wk-look'), pad: q('.wk-pad'), stick: q('.wk-stick'), knob: q('.wk-knob'), chip: q('.wk-chip'), arrow: q('.wk-chip svg'), name: q('.wk-chip b'), dist: q('.wk-chip small'),
      act: q('.wk-act'), actIcon: q('.wk-act i'), actText: q('.wk-act span'), map: q('.wk-map canvas'), cam: q('.wk-cam'), btns: q('.wk-btns'), toast: q('.wk-toast'), off: [], last: {}, mapT: 0, span: 80 };
    const on = (el, t, f, opt) => { el.addEventListener(t, f, opt); H.off.push(() => el.removeEventListener(t, f, opt)); };
    on(root, 'contextmenu', (e) => e.preventDefault());
    // 搖桿：左下角按下去，搖桿跑到手指下面（外圈整個看得到）；推到外圈 92% 以上跑（放鬆到 80% 以下才變回走）
    const RAD = 56;
    const stickAt = (cx, cy) => { pad.cx = cx; pad.cy = cy; H.stick.style.transform = `translate(${cx}px,${cy}px)`; };
    const rest = () => { const r = root.getBoundingClientRect(); stickAt(84, Math.max(80, r.height - 96)); H.knob.style.transform = ''; H.stick.classList.add('rest'); H.stick.classList.remove('run'); H.knob.textContent = ''; };
    H.rest = rest;
    // 畫面大小變了（全螢幕開關、轉手機）：沒在推的時候搖桿回到左下角（不然會停在舊的高度，跑到畫面中間或外面）
    if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(() => { if (pad.id == null) rest(); }); ro.observe(root); H.off.push(() => ro.disconnect()); }
    const padDown = (e) => {
      if (e.pointerType === 'mouse') { lookDown(e); return; } // 電腦：滑鼠拖＝轉頭（走路用鍵盤）
      if (pad.id != null) return;
      e.preventDefault(); pad.id = e.pointerId; try { H.pad.setPointerCapture(e.pointerId); } catch { /* 沒有就算了 */ }
      const r = root.getBoundingClientRect();
      stickAt(clamp(e.clientX - r.left, 68, r.width - 68), clamp(e.clientY - r.top, 68, r.height - 68)); H.stick.classList.remove('rest');
      padMove(e);
    };
    const padMove = (e) => {
      if (e.pointerId !== pad.id) { if (e.pointerId === lk.id) lookMove(e); return; }
      const r = root.getBoundingClientRect(); let dx = e.clientX - r.left - pad.cx, dy = e.clientY - r.top - pad.cy; const l = Math.hypot(dx, dy);
      if (l > RAD) { dx *= RAD / l; dy *= RAD / l; }
      const m = Math.min(1, l / RAD); pad.x = dx / RAD; pad.y = -dy / RAD; pad.m = m;
      const run = pad.run ? m >= 0.8 : m >= 0.92;
      if (run !== pad.run) { pad.run = run; H.stick.classList.toggle('run', run); H.knob.textContent = run ? '跑' : ''; }
      H.knob.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
    };
    const padUp = (e) => { if (e.pointerId === lk.id) { lookUp(e); return; } if (e.pointerId !== pad.id) return; releasePad(); };
    on(H.pad, 'pointerdown', padDown); on(H.pad, 'pointermove', padMove);
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) on(H.pad, t, padUp);
    // 轉頭：右邊（搖桿以外）按住拖
    const lk = { id: null, x: 0, y: 0 }; H.lk = lk;
    function lookDown(e) { if (lk.id != null) return; e.preventDefault(); lk.id = e.pointerId; lk.x = e.clientX; lk.y = e.clientY; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 沒有就算了 */ } H.look.classList.add('on'); }
    function lookMove(e) { if (e.pointerId !== lk.id) return; const dx = e.clientX - lk.x, dy = e.clientY - lk.y; lk.x = e.clientX; lk.y = e.clientY; if (active) look(dx, dy); }
    function lookUp(e) { if (e.pointerId !== lk.id) return; lk.id = null; H.look.classList.remove('on'); }
    on(H.look, 'pointerdown', lookDown); on(H.look, 'pointermove', lookMove);
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) on(H.look, t, lookUp);
    on(H.look, 'wheel', (e) => { if (!active || cam.mode !== 'follow') return; e.preventDefault(); cam.dist = clamp(cam.dist * (1 + clamp(e.deltaY, -120, 120) * 0.0012), 2.2, 6.5); }, { passive: false });
    on(H.cam, 'click', () => { if (active) setCamera({ mode: cam.mode === 'eye' ? 'follow' : 'eye' }); });
    H.mapBox = q('.wk-map'); H.mapB = q('.wk-mapb'); on(H.mapBox, 'pointerdown', (e) => e.stopPropagation()); on(H.mapBox, 'click', (e) => { if (mapTap && active) { e.preventDefault(); mapTap.onClick(); } }); // 點小地圖（setMapTap）：大地圖
    on(H.act, 'pointerdown', () => H.act.classList.add('on'));
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) on(H.act, t, () => H.act.classList.remove('on'));
    on(H.act, 'click', (e) => { e.preventDefault(); doAction(); });
    const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1), px = Math.round(124 * dpr);
    H.map.width = H.map.height = px; H.mapPx = px; H.dpr = dpr; H.mctx = H.map.getContext('2d'); H.layer = null;
    return H;
  }
  function releasePad() {
    pad.id = null; pad.x = pad.y = pad.m = 0; pad.run = false;
    if (hud) hud.rest();
  }
  function drawMap(dt) {
    const H = hud, g = H.mctx, s = H.mapPx, cx = st.x, cz = st.z, oy = s * 0.13, yaw = cam.yaw, rot = yaw - Math.PI / 2; // 鏡頭的前面朝上（搖桿往上推＝地圖往上走）
    if (!H.layer) H.layer = o.mapLayer || mapLayer(world);
    H.span += (80 + 60 * smooth01((st.speed - 1.5) / 3) - H.span) * (1 - Math.exp(-dt * 1.5));
    const k = s / H.span;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, s, s);
    g.save(); g.translate(s / 2, s / 2 + oy); g.rotate(rot); g.scale(k, k); g.translate(-cx, -cz);
    g.drawImage(H.layer.c, H.layer.x0, H.layer.z0, H.layer.c.width / H.layer.ms, H.layer.c.height / H.layer.ms);
    if (world.mapLive) world.mapLive(g, cx, cz, H.span); // 內湖（neihu.js）：附近的路、房子、公園自己畫（底圖只畫原本的範圍）
    if (routeData && routeData.pts.length > 1) {
      g.strokeStyle = '#FF6A1F'; g.lineWidth = (3.4 * H.dpr) / k; g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash(routeData.straight ? [(6 * H.dpr) / k, (5 * H.dpr) / k] : []); g.beginPath();
      routeData.pts.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.stroke(); g.setLineDash([]);
    }
    g.restore();
    const cs = Math.cos(rot), sn = Math.sin(rot), Rr = s / 2 - 13 * H.dpr, ic = H.ic || (H.ic = []); let n = 0;
    for (const key in places) {
      const p = places[key], d = DEST[key] || (key === dest ? destStyle(key) : null), q = d && placeAt(p); if (!q) continue;
      const wx = q[0] - cx, wz = q[1] - cz;
      let sx = (wx * cs - wz * sn) * k, sy = (wx * sn + wz * cs) * k + oy; const l = Math.max(Math.abs(sx), Math.abs(sy));
      if (l > Rr) { sx *= Rr / l; sy *= Rr / l; }
      const it = ic[n] || (ic[n] = {}); it.key = key; it.d = d; it.sx = sx; it.sy = sy; it.r = (key === dest ? 11 : 9) * H.dpr; n++;
    }
    ic.length = n;
    ic.sort((a, b) => (a.key === dest) - (b.key === dest));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = ic[i], b = ic[j], need = a.r + b.r + 2 * H.dpr; if (Math.hypot(a.sx - b.sx, a.sy - b.sy) >= need) continue;
      const ax = Math.abs(a.sx) >= Math.abs(a.sy) ? 'sy' : 'sx', sg = Math.sign(a[ax] - b[ax]) || 1;
      a[ax] = b[ax] + sg * need; if (Math.abs(a[ax]) > Rr) a[ax] = b[ax] - sg * need;
    }
    for (let i = 0; i < n; i++) {
      const { key, d, sx, sy, r } = ic[i];
      g.beginPath(); g.arc(s / 2 + sx, s / 2 + sy, r, 0, TAU); g.fillStyle = d.bg; g.fill(); g.lineWidth = 2 * H.dpr; g.strokeStyle = key === dest ? '#FF6A1F' : 'rgba(242,243,245,0.85)'; g.stroke();
      g.fillStyle = d.fg; g.font = `700 ${Math.round(r * 1.15)}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d.icon, s / 2 + sx, s / 2 + sy + 0.5 * H.dpr);
    }
    // 別的模組給的點（警車⋯）：小圓點；地圖外面的貼在邊上；on: false 的不畫
    const drawMarks = (list) => { for (let i = 0; i < list.length; i++) {
      const m = list[i]; if (!m || m.on === false) continue;
      const wx = m.x - cx, wz = m.z - cz; let sx = (wx * cs - wz * sn) * k, sy = (wx * sn + wz * cs) * k + oy; const l = Math.max(Math.abs(sx), Math.abs(sy));
      if (l > Rr) { sx *= Rr / l; sy *= Rr / l; }
      const rr = (m.r || 5) * H.dpr;
      g.beginPath(); g.arc(s / 2 + sx, s / 2 + sy, rr, 0, TAU); g.fillStyle = m.fill || '#FF3B30'; g.fill();
      if (m.ring) { g.lineWidth = 1.5 * H.dpr; g.strokeStyle = m.ring; g.stroke(); }
      if (m.label != null) { g.fillStyle = m.fg || '#FFFFFF'; g.font = `700 ${Math.round(rr * 1.25)}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(m.label), s / 2 + sx, s / 2 + sy + 0.5 * H.dpr); }
    } };
    if (marks) drawMarks(marks);
    for (const t in marksT) drawMarks(marksT[t]);
    // 你：中間偏下的箭頭（照臉朝的方向轉；地圖是照鏡頭轉的）
    const u = H.dpr; g.translate(s / 2, s / 2 + oy); g.rotate(-wrapA(st.th - yaw)); g.beginPath(); g.moveTo(0, -9 * u); g.lineTo(7 * u, 7 * u); g.lineTo(0, 3.5 * u); g.lineTo(-7 * u, 7 * u); g.closePath();
    g.fillStyle = '#F2F3F5'; g.fill(); g.lineWidth = 2 * u; g.strokeStyle = '#FF6A1F'; g.stroke(); g.setTransform(1, 0, 0, 1, 0, 0);
  }
  const changed = (k, v) => { if (hud.last[k] === v) return false; hud.last[k] = v; return true; }; // HUD 的字、角度變了才改畫面
  const CHECK = '<path d="M5 12.5l4.5 4.5L19.5 7" fill="none" stroke="#0E0F12" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>', UP = ICON.up.replace(/<\/?svg[^>]*>/g, '');
  function hudTick(dt) {
    const H = hud; if (!H) return;
    if (H.reRest && pad.id == null) { H.reRest = false; H.rest(); } // 剛出門：版面放好了才放搖桿
    const dd = dest && destStyle(dest);
    if (changed('dest', dest)) { H.chip.hidden = !dd; if (dd) H.name.textContent = dd.label; }
    if (dd && routeData) {
      const here = zoneNow === dest;
      if (changed('here', here)) { H.chip.classList.toggle('here', here); H.arrow.innerHTML = here ? CHECK : UP; }
      const la = along(routeData.pts, routeS + 10), rel = wrapA(Math.atan2(-(la[1] - st.z), la[0] - st.x) - cam.yaw), left = Math.max(0, routeData.len - routeS);
      const deg = here ? 999 : Math.round((-rel * 180) / Math.PI); if (changed('rot', deg)) H.arrow.style.transform = here ? '' : `rotate(${deg}deg)`;
      const dk = here ? -1 : left < 25 ? -2 : left >= 995 ? Math.round(left / 100) * 100 + 0.5 : Math.round(left / 10) * 10; // 數字變了才組字串
      if (changed('dist', dk)) H.dist.textContent = here ? '到了！' : left < 25 ? '就在前面' : left >= 995 ? `${(left / 1000).toFixed(1)} km` : `${dk} m`;
    }
    H.mapT -= dt; if (H.mapT <= 0) { drawMap(1 / 30 - H.mapT); H.mapT = 1 / 30; }
  }
  let toastT = 0;
  function toast(text, ms = 1600) { if (!hud) return; hud.toast.textContent = text; hud.toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => hud && hud.toast.classList.remove('show'), ms); }
  // 右下角的圓按鈕（第 3 批：揍）
  let btns = [];
  function setButtons(list) {
    btns = (list || []).filter((b) => b && b.label);
    if (!hud) return;
    hud.btns.replaceChildren(); hud.btns.hidden = !btns.length;
    for (const b of btns) {
      const el = document.createElement('b'); el.setAttribute('role', 'button'); el.setAttribute('aria-label', b.label); el.textContent = b.label;
      const up = () => el.classList.remove('on');
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('on'); pressBtn(b); });
      for (const t of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(t, up);
      hud.btns.append(el);
    }
  }
  function pressBtn(b) { if (active && st.mode === 'walk' && alive && typeof b.onClick === 'function') b.onClick(api, b.id); }

  // ---- 鍵盤 ----
  const KEYS = { ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D', ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ShiftLeft: 'S', ShiftRight: 'S' };
  const onKey = (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = KEYS[e.code], down = e.type === 'keydown';
    if (k) { kb[k] = down; if (active && k !== 'S') e.preventDefault(); return; } // 按著的鍵開車的時候也記著（下車的時候還按著 W 就接著走）
    if (!down || e.repeat || !active) return;
    if (e.code === 'KeyE') { if (eff) { e.preventDefault(); doAction(); } }
    else if (e.code === 'KeyC') setCamera({ mode: cam.mode === 'eye' ? 'follow' : 'eye' });
    else for (const b of btns) if (b.key === e.code) { e.preventDefault(); pressBtn(b); }
  };
  const onBlur = () => { for (const k in kb) kb[k] = false; };
  const useKeys = o.keyboard !== false && typeof window !== 'undefined' && window.addEventListener;
  if (useKeys) { window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('blur', onBlur); }

  // ---- 開始／暫停 ----
  let hinted = false;
  function activate(op = {}) {
    active = true; hand.on = false; lockT = now + 0.35; // 剛下車：同一下按鍵、點擊不會又上車
    if (camera) {
      if (cam.near0 == null) cam.near0 = camera.near;
      camera.near = 0.1; camera.updateProjectionMatrix();
      if (op.blend) { blend.on = true; blend.t = 0; blend.T = op.blend === true ? 0.6 : Math.max(0.05, +op.blend); blend.p.copy(camera.position); blend.q.copy(camera.quaternion); blend.fov = camera.fov; } else blend.on = false;
    }
    if (hud) { hud.root.hidden = false; hud.rest(); hud.last = {}; hud.mapT = 0; setEff(null); if (hud.act) hud.act.hidden = true; }
    // 出門那一下頁面的版面還會變（全螢幕是 body 的 class 變了以後才換的）：下一格（hudTick）再放一次搖桿
    //   （ResizeObserver 不一定會叫：藏起來再打開、大小跟上次一樣就不叫）
    if (hud) hud.reRest = true;
    if (!hinted && hud) { hinted = true; toast('左下角推著走，推到底用跑的；右邊滑動看四周', 3200); }
    armDoors(); routeTick(0, true);
  }
  function deactivate(hide) {
    active = false; st.mode = 'off'; releasePad(); if (hud && hud.lk) hud.lk.id = null;
    if (hud) hud.root.hidden = true;
    if (hide && ch) ch.group.visible = false;
    if (camera && cam.near0 != null) { camera.near = cam.near0; camera.updateProjectionMatrix(); cam.near0 = null; }
    if (fx) fx.beacon.visible = false;
    eff = null;
  }
  function resume(op = {}) {
    if (!alive) return;
    scr = null; tgt = null;
    activate(op); st.mode = 'walk';
    if (ch) ch.group.visible = true;
    if (!op.blend && camera) { cam.cd = cam.want = cam.dist; camTick(1 / 60); }
  }
  function pause(op = {}) { if (!alive) return; scr = null; tgt = null; deactivate(!!op.hide); st.speed = 0; }
  function teleport(p, op = {}) {
    st.x = +p.x || 0; st.z = +p.z || 0; if (p.heading != null) st.th = wrapA(+p.heading); st.vx = st.vz = st.speed = 0; scr = null; tgt = null;
    if (st.mode === 'in' || st.mode === 'seat' || st.mode === 'out') st.mode = active ? 'walk' : 'off';
    if (!op.keepCamera) { cam.yaw = st.th; cam.pitch = PITCH0; cam.hold = 0; }
    cam.cd = cam.want = cam.dist; blend.on = false;
    armDoors(); place(); routeTick(0, true);
    if (active && camera) camTick(1 / 60);
  }

  // ---- 每一幀 ----
  function update(dt) {
    if (!alive) return;
    dt = Math.min(0.1, Math.max(0, +dt || 0)); if (!dt) return;
    now += dt;
    if (!active) { handTick(dt); return; } // 開車中：只有上車那一下鏡頭接過去
    syncMovers();
    const gAct = garageTick();
    readInput();
    if (st.mode === 'walk') walkStep(dt); else if (st.mode === 'in') autoStep(dt); else if (scr) scriptStep(dt);
    st.anim = st.speed < 0.15 ? 'idle' : st.speed > 2.6 ? 'run' : 'walk';
    if (!active) { flush(); return; } // 坐進車裡了（finishIn）
    place();
    if (ch) {
      pose0.speed = st.speed; pose0.state = st.play || st.anim; st.play = null;
      ch.update(dt, pose0);
    }
    if (st.mode === 'walk') doorTick(dt);
    st.near = st.mode === 'walk' ? nearestCar() : null;
    setEff(st.mode === 'walk' ? leadAct || gAct || (st.near && st.near.act) : null);
    recenter(dt); camTick(dt);
    if (ch) ch.group.visible = !st.close; // 第一人稱、鏡頭貼著頭：看不到自己
    zoneTick(); routeTick(dt); beaconTick(); hudTick(dt);
    flush();
  }
  function flush() { // 事件最後才叫（叫的時候人、鏡頭都是這一格的樣子）
    if (!events.length) return;
    const ev = events.splice(0);
    for (const e of ev) {
      if (e.ref !== undefined && e.zone) { if (o.onDoor) o.onDoor(e.ref, e.zone); }
      else if (o.onGetIn) o.onGetIn(e);
    }
  }

  function dispose() {
    if (!alive) return;
    deactivate(true); alive = false; hand.on = false; cw.clear();
    if (useKeys) { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('blur', onBlur); }
    if (hud) { hud.off.forEach((f) => f()); hud.root.remove(); }
    clearTimeout(toastT);
    if (fx) { fx.beacon.removeFromParent(); for (const m of [fx.pillar, fx.ring]) { m.geometry.dispose(); m.material.dispose(); } fx.tex.dispose(); fx = null; }
    if (ch) ch.group.removeFromParent();
  }
  const telemetry = () => ({ x: st.x, z: st.z, heading: st.th, speed: st.speed, vx: st.vx, vz: st.vz, state: st.anim, mode: st.mode, running: st.running, paused: !active,
    near: st.near ? st.near.car.key ?? true : null, action: eff ? eff.label : null, camMode: cam.mode, camYaw: cam.yaw, camPitch: cam.pitch, camDist: cam.cd, camWant: cam.want,
    hidden: !ch || !ch.group.visible, zone: zoneNow, dest, destDist: routeData ? Math.max(0, routeData.len - routeS) : null });

  const api = {
    update, telemetry, teleport, setAction, setCars: (list, op = {}) => { leadCars = Array.isArray(list) ? list.slice() : []; if (op.keepParked === false && st.mode !== 'in' && st.mode !== 'seat') parked = null; rebuildCars(); },
    getOut, getIn, setGarage, setDestination, setCamera, setCharacter, setButtons, pause, resume, dispose, toast,
    setDoors: (src) => { doorSrc = src; doorList = buildDoors(src); armDoors(); },
    setInput: (i) => { forced = i ? { x: clamp(+i.x || 0, -1, 1), y: clamp(+i.y || 0, -1, 1), run: i.run } : null; },
    setMovers: (list) => { movers = Array.isArray(list) ? list : null; },
    setMarkers: (list, tag) => { const L = Array.isArray(list) ? list : null; if (tag == null) marks = L; else if (L) marksT[tag] = L; else delete marksT[tag]; },
    setMapTap: (t) => { mapTap = t && typeof t.onClick === 'function' ? { label: String(t.label || ''), onClick: t.onClick } : null; if (hud) { hud.mapBox.classList.toggle('tap', !!mapTap); hud.mapB.hidden = !mapTap || !mapTap.label; if (mapTap) hud.mapB.textContent = mapTap.label; } },
    get mapTap() { return mapTap ? mapTap.label : null; }, get route() { return routeData; },
    setCarReach: (on) => { reach = !!on; },
    play: (state) => { if (state) st.play = String(state); },
    addColliders: (list, tag) => cw.add(Array.isArray(list) ? list : [list], tag ?? null).length,
    removeColliders: (tag) => cw.remove(tag),
    get action() { return eff ? eff.label : null; }, get character() { return ch; }, get cars() { return recs.map((r) => r.car); }, get parked() { return parked; },
    get doors() { return doorList.map((d) => ({ ref: d.ref, ...d.zone, w: d.w })); }, get cameraMode() { return cam.mode; }, get cameraDist() { return cam.dist; }, get mode() { return st.mode; }, hud: hud && hud.root,
    get mapLayer() { return (hud && hud.layer) || o.mapLayer || mapLayer(world); },
  };
  setCharacter(o.character);
  doorList = buildDoors(doorSrc);
  return api;
}
return { createWalker };
})();
