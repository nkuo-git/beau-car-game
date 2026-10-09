// ---- 開車：在小村莊裡自己開（街機式）：從你的車庫開去改車廠、開去賽道、上快速道路開到極速 ----
// Nick 2026-09-28：「汽車他只有轉彎跟啟動才會有聲浪要一直都有聲浪還有在路上開車速度可以到極速可以很快」
// 世界座標跟 village.js、賽道一樣：x 往東、y 往上、z 往南（朝東開時車子的右邊）；heading＝car.rotation.y（0 朝 +x、π/2 朝北 −z）
// 【API】
//   const drive = createDrive({
//     car: S,                 buildCar() 回傳的車（S.car 會移動、轉向；S.body 會側傾、點頭；前輪會轉、四輪會滾）
//     scene, camera,          影子、目的地光柱加在 scene；鏡頭由開車控制（'none' 模式就不動它）；camera.far 呼叫的人設（世界幾公里大：2000 左右）
//     perf: PERF[key],        { hp, kg, awd, drive, red, vmax, cda }（跟 race.src.js 一樣算加速；hp 可以換成裝了零件的 hpOf(key)）
//     world: V,               buildVillage() 回傳的（places、colliders、surfaceAt、route、roads、bounds、areas）
//                             第 4 批：buildOffroad(V) 加的 heightAt、normalAt、terrainAt、mapDraw（越野車場）：有高度就用 terrain.js 的 createRide（懸吊、跳、落地、路面 5 泥土 6 泥巴 7 沙 8 石頭）
//                             村子是平的：一般的車沒開進越野車場，這裡的算法一步都不變；越野車（perf.offroad）一直用（四輪轉向、長行程懸吊）
//     colliders: stripColliders(),   另外要擋的東西（賽道的護欄、看台、路燈⋯）；會變的用 addColliders／removeColliders
//     hudParent: stage,       HUD 放在這個元素裡（要 position: relative）；沒給就沒有 HUD（測試用）
//     onZone(name, inside, place)   開進／開出任何一個 places.<name>.zone（這一幀算完才叫；開出去要離開範圍 2.5 公尺才算，在邊上晃不會一直叫）
//     onShift(gear), onBump(strength)   升檔（接引擎聲 voice.shift()）、撞到東西（撞進去的速度 m/s，可以拿來震動）
//     onLand(e)               第 4 批：落地（飛起來 0.25 秒以上再碰到地）e＝{ speed（往下撞地的速度 m/s）, air（飛了幾秒）, drop（最高離地幾公尺）, x, z, v（水平速度）, hard（超過這台車受得了的）}
//     halfW                   第 4 批：碰撞的半寬（可省略；輪胎比車身寬的車，怪獸卡車 1.905）；perf.gears：自己的六個齒比（可省略）
//     onImpact(e)             撞壞用（damage.js：onImpact: (e) => dmg.hit(e)）：這一幀最大的一下（撞進去 1.5 m/s 以上；0.2 秒內只叫一次，除非更大力）
//     crush                   第 7 批（怪獸卡車輾東西，crush.js）：{ heightAt(x, z), can(c), hit(c, speed) }（可省略＝完全照舊）：
//                             can(c) 是 true 的碰撞物不擋、不算撞到，叫 hit(c, 速度) 以後照 heightAt 多出來的高度開上去（輪子、懸吊、傾斜都是 terrain.js 算的）
//                             e＝{ speed（撞進去的速度 m/s）, px, pz（碰到的點）, nx, nz（法線，往車子裡面）, r（撞到的東西沿著切線的半寬；圓＝半徑）,
//                                  ox, oz（撞到的東西的中心）, h（它多高） }，全部是車子座標（+x 車頭、+z 右邊，原點＝車子原點）
//     eye: CABIN_VIEW[key],   駕駛座視角 { eye: [x, y, z], look: [x, y, z], fov }（車身座標）；沒給就用估的
//     maxKmh,                 限速（可省略：省略＝這台車的極速 perf.vmax）；草地 50、稻田 16 另外限
//     keyboard: true（方向鍵／WASD、空白鍵手煞車、C 換視角、E 按 HUD 的大按鈕）；camButton: true（HUD 上的換視角鈕）
//     mapLayer,               小地圖的底圖 { c, ms, x0, z0 }（可省略：自己畫一張，最多 16 MB）；走路（walk.js）的 walker.mapLayer 同一張，給了就不用再畫
//     audio,                  第 3 批（甩尾）：createEngineAudio() 回傳的（可省略）：輪胎叫 audio.skid(level, pitch, dirt)（跟引擎聲同一條總輸出：音量、靜音一樣）
//   });
//   每一幀 drive.update(dt 秒)，再 renderer.render(scene, camera)
//   drive.telemetry() → { x, z, heading, v（m/s，倒車是負的）, kmh, rpm（轉速÷紅線 0–1.02，怠速 0.13）, gear（1–6，倒車 −1）,
//                         throttle（引擎真的出力 0–1，換檔那一下 0）, load（給引擎聲的負載：踩著油門 0.65–1、放開 0、停著怠速 0）,
//                         brake, steer（−1 左～1 右）, surface（0 大路、1 草地、2 稻田、3 小路、4 快速道路）, cap（現在的限速 km/h）, reversing,
//                         bumps, shifts, zone, dest, destDist（沿著路線還有幾公尺，每一幀跟著車子算）, auto（自動停車中）, paused }
//                         第 4 批（有地形才有）：y, air, pitch, roll, wheels, belly, lands, land, pen, rideOn, cls（terrain.js 的 ride.tele()）
//                         第 3 批（甩尾）：slip（甩的角度，弧度：車頭在走的方向右邊＝正）, travel（走的方向，跟 heading 一樣的角度）, drift（0 抓地～1 甩尾）,
//                         drifting（正在甩：10° 以上）, drifts（甩了幾次）, loose（後輪多鬆 0–1）, skid（輪胎叫多大聲 0–1）, handbrake（0／1）, marks（地上幾段胎痕）, smoke（幾團煙還在飄）
//                         （v 是沿著走的方向的速度；甩尾的時候 heading（車頭）跟 travel 不一樣）
//     引擎聲（sound.js）：voice.set({ rpm: t.rpm, throttle: t.load, speed: Math.abs(t.v) })；onShift 裡 voice.shift()
//   drive.setDestination(name | null)   world.places 裡的任何一個（garage 回車庫、shop 去改車廠、track 去賽道、dealer 去車店、highway 去快速道路⋯）：
//                          左上角「去賽道 230 m」＋箭頭、小地圖的橘色路線、那裡一根光柱；world.route 不認得的地方就指直線
//   drive.setAction({ label, onClick, icon } | null)   HUD 上一顆大按鈕（目的地下面，例如「開鐵捲門」）；按下去或鍵盤 E 叫 onClick(drive)；
//                          icon：'door' | 'key' | 'hand'（預設）；null＝收掉；每一幀叫也沒關係（字一樣就不動畫面）；drive.action＝現在的字（沒有＝null）
//   drive.setAction2({ label, onClick, icon } | null)   第二顆（右邊、換視角鈕下面，深色的，例如「下車」）：跟大按鈕同時在，不會被「開鐵捲門」蓋掉；
//                          沒有大按鈕的時候鍵盤 E 按這顆；icon 預設 'walk'（走路的人）；drive.action2＝現在的字
//   drive.addColliders(list, tag) / drive.removeColliders(tag)   會變的碰撞物（鐵捲門關著才擋、停著的車），格式跟 world.colliders 一樣；
//                          同一個 tag 可以加很多次，removeColliders(tag) 一次全部拿掉；回傳加了／拿掉幾個
//   drive.setMarkers(list | null)   小地圖上多畫的點（警車⋯）：[{ x, z, fill, ring, r（半徑 px，預設 5）, on（false＝這幀不畫） }]；
//                          只記住陣列本身，每一幀照裡面現在的值畫（陣列可以一直改，不用再叫）；地圖外面的貼在邊上；null＝不畫
//   drive.setCameraMode('chase' | 'eye' | 'none', view?)   追車／駕駛座／不管鏡頭；drive.cameraMode 是現在的
//   drive.teleport({ x, z, heading }, { intro })   把車放到那裡停好（不叫 onZone）；intro：鏡頭從車前面繞到後面（出門的時候）
//   drive.parkAt(pose, onDone)   自己開到 pose（{ x, z, heading }，或 { noseX, z, heading }＝車頭對齊 noseX）停好再叫 onDone
//   drive.pause() / resume()     暫停（不吃按鍵、藏 HUD／影子／光柱、車身擺正、前輪回正）／繼續
//   drive.release()              把車交給別人（賽道、車庫）：pause＋車子放回原點、不轉、輪子歸零（race.src.js 的 carSize 用世界座標量車頭，一定要）
//   drive.setInput({ throttle, brake, steer, handbrake } | null)   程式開車（測試）；null＝回到手指、鍵盤
//   drive.setDamage({ power, top, maxKmh, steerPull } | null)   撞壞了（damage.js 的 dmg.perf）：出力 ×power、極速 ×top、最多 maxKmh、
//                          方向盤偏 steerPull（−1 左～1 右，最多偏 8%）；null＝恢復
//   drive.toast(text, ms)；drive.carInfo：{ nose, tail, len, halfW, wheelbase, vmax（km/h） }；drive.dispose()（拿掉 HUD、按鍵、影子、光柱，車子交回）
// 開法：油門、煞車（停住還按著煞車＝倒車，倒車時按油門＝煞車）；方向盤越慢轉越多；自排六速（轉速照 race.src.js 的齒比，極速剛好在紅線）
//   加速：照 race.src.js（馬力、扭力曲線、重量、四驅／後驅的起步抓地、傳動 0.88）；風阻 ×0.55（街機：1.2 公里左右的直線就到得了極速）
//   限速：柏油（大路、小路、快速道路）＝極速（或 maxKmh）；草地 50、稻田 16 km/h；快到限速油門自己收（定速），聲音照樣大聲（load）
//   自排：踩越多越晚升檔（全油門 0.98 紅線才升）、定速的時候轉速留在 0.45–0.7（聽得到）、放油門不升檔（引擎煞車聽得到）、大腳油門降檔
//   轉彎：方向盤打滿＝抓地的 1.35 倍（200 km/h 1.25 倍、320 km/h 0.95 倍：300 km/h 很穩）；超過抓地就推頭（輕微轉向不足），多的那份把速度吃掉
//         （抱著方向盤自己會慢下來，一直推頭超過 0.35 秒再多慢一點；250 公尺的彎 200 km/h 過得去）
//   撞到：每一步最多走 0.25 公尺（300 km/h 也不會穿過細柱子、護欄）；撞進去的速度吃掉（最多彈回 2 m/s），沿著牆的速度照摩擦掉一些，
//         車頭往沿著牆的方向轉一點（一次最多 20°，擦過去就貼著牆滑），正面撞照撞到的點轉一點點；頂住了還踩油門＋轉方向＝原地轉出來（不會卡住）
//   鏡頭：越快越往後拉、放低一點、視角變廣（有速度感，有上限）；200 km/h 以上、撞到東西會晃（減少動態效果的設定：晃小一點）
//   甩尾（第 3 批，Nick 2026-10-04「可以甩尾」）：快的時候（30 km/h 以上）轉彎拉「手煞車」、後驅大馬力油門到底＋方向打滿（30～100 km/h）、用力煞車馬上把方向打滿、
//         很快過彎（推頭）突然放油門 → 車尾甩出去：走的方向跟車頭分開（甩的角度 slip），車頭轉得比走的方向多
//         街機的幫忙（只有按鈕也甩得好）：往甩的方向按＝撐住（角度最大：後驅 35°～45°、四驅 23°～30°、越野車 17°；快的時候小一點）、放開方向＝慢慢抓回來、
//         反方向按＝很快拉直；超過最大的角度自動反打（不會打轉）；前輪自己朝走的方向（看得到反打）
//         踩著油門撐得住（後驅大馬力撐最久，四驅慢慢抓回來）；放開油門、方向擺正就抓回來（慢慢的，不會一下彈回去）；甩的時候速度掉一點；草地、稻田、泥土更好甩
//         慢的時候（22 km/h 以下）一點都不會甩：停車、車庫、改車廠、自動停車跟以前一模一樣；沒在甩的時候算法跟以前完全一樣
//         看得到聽得到：輪胎冒煙、地上的胎痕（慢慢淡掉）、輪胎叫（跟著滑多少）、鏡頭往走的方向轉一點、畫面上「甩尾 35°」
import * as THREE from 'three';
import { createRide } from './terrain.js'; // 第 4 批：地形（越野車場）

// 打包時全部接在同一個 script 裡：只露出 createDrive
export const { createDrive } = (() => {
const TAU = Math.PI * 2, GEARS = [3.3, 2.2, 1.62, 1.28, 1.05, 0.86];
const AERO = 0.55, STEP = 0.25, HZ = 120; // 風阻（街機）、一步最多走幾公尺（碰撞）、物理每秒最少幾步
const torqueAt = (x) => 0.8 + 0.4 * x - 0.4 * x * x;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapA = (a) => { a = (a + Math.PI) % TAU; return a < 0 ? a + Math.PI : a - Math.PI; };
const toward = (a, b, r) => (a < b ? Math.min(b, a + r) : Math.max(b, a - r));
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const smooth01 = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const inRect = (r, x, z, m = 0) => { const dx = x - r.x, dz = z - r.z, c = Math.cos(r.rot || 0), s = Math.sin(r.rot || 0); return Math.abs(dx * c - dz * s) <= r.hx + m && Math.abs(dx * s + dz * c) <= r.hz + m; };
// 路面（world.surfaceAt）：0 大路、1 草地、2 稻田、3 村子的小路、4 快速道路；cap＝限速 m/s、drag＝多的阻力 m/s²、over＝比限速快的時候怎麼慢下來 [每 m/s, 最多 m/s²]
const SURF = [{ cap: Infinity, drag: 0 }, { cap: 50 / 3.6, drag: 1, over: [1.6, 6] }, { cap: 16 / 3.6, drag: 2.2, over: [3, 9] }, { cap: Infinity, drag: 0 }, { cap: Infinity, drag: 0 }];
// 第 3 批（甩尾）：路面多好甩（0 大路…8 石頭：草地、稻田、泥土、泥巴、沙比較滑）；sat：軟軟的飽和（輪胎的側向力）
const SLIDE = [1, 1.5, 1.7, 1, 1, 1.4, 1.6, 1.5, 1.1], sat = (x) => x / Math.sqrt(1 + x * x);
const DEST = {
  garage: { label: '回車庫', icon: '家', bg: '#1d1f23', fg: '#FF6A1F' }, shop: { label: '去改車廠', icon: '改', bg: '#2F6FD6', fg: '#FFFFFF' },
  track: { label: '去賽道', icon: '賽', bg: '#FF6A1F', fg: '#1A0F07' }, dealer: { label: '去車店', icon: '車', bg: '#F2C230', fg: '#1A0F07' },
  highway: { label: '去快速道路', icon: '快', bg: '#1F8A4C', fg: '#FFFFFF' }, // 台灣國道、快速道路的綠牌子
  police: { label: '去警察局', icon: '警', bg: '#1F4FA8', fg: '#FFFFFF' }, gunshop: { label: '去槍店', icon: '槍', bg: '#26282C', fg: '#FF9A2E' }, // ==== 第 3 批：警察局、槍店 ====
  offroad: { label: '去越野車場', icon: '越', bg: '#8A5A2B', fg: '#FFF3E0' }, // ==== 第 4 批：越野車場 ====
  neihu: { label: '去內湖', icon: '內', bg: '#6E4BA8', fg: '#FFFFFF' }, // 內湖（neihu.js）：小地圖上一直看得到（貼在邊上＝往那邊開）
  mountain: { label: '去山頂', icon: '山', bg: '#2E7D4F', fg: '#FFFFFF' }, // 山（mountain.js）
};
const COND = '"Barlow Condensed", "Arial Narrow", sans-serif', SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
const CSS = `
.dv{position:absolute;inset:0;pointer-events:none;color:#F2F3F5;font-family:${SANS};-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;z-index:3;overflow:hidden}
.dv[hidden],.dv [hidden]{display:none!important}
.dv>*{position:absolute}
.dv-chip{top:10px;left:10px;max-width:calc(100% - 158px);display:flex;align-items:center;gap:7px;height:40px;padding:0 13px 0 5px;border-radius:999px;background:rgba(14,15,18,0.62);white-space:nowrap;overflow:hidden}
.dv-chip i{flex:none;width:30px;height:30px;border-radius:50%;background:#FF6A1F;display:grid;place-items:center}
.dv-chip svg{width:18px;height:18px;fill:#1A0F07;transition:transform .12s linear}
.dv-chip b{font-size:17px;font-weight:700;letter-spacing:.02em}
.dv-chip small{font:600 17px/1 ${COND};color:#C6CAD1;letter-spacing:.03em}
.dv-chip.here i{background:#3DDC84}
.dv-act{top:58px;left:10px;max-width:calc(100% - 158px);min-height:54px;box-sizing:border-box;display:flex;align-items:center;gap:9px;margin:0;padding:0 18px 0 8px;border:0;border-radius:999px;background:#FF6A1F;color:#1A0F07;font:700 19px/1.15 ${SANS};letter-spacing:.03em;box-shadow:0 5px 0 #9E4213;pointer-events:auto;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.dv-chip[hidden]~.dv-act{top:10px}
.dv-act i{flex:none;width:38px;height:38px;border-radius:50%;background:#1A0F07;display:grid;place-items:center}
.dv-act svg{width:22px;height:22px;fill:none;stroke:#FF6A1F;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.dv-act span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dv-act kbd{display:none;flex:none;min-width:22px;height:22px;border-radius:6px;background:rgba(26,15,7,.2);font:700 14px/22px ${COND};text-align:center}
.dv-act.on{transform:translateY(4px);box-shadow:0 1px 0 #9E4213}
.dv-act:focus-visible{outline:3px solid #F2F3F5;outline-offset:3px}
.dv-act::after{content:"";position:absolute;inset:-5px;border-radius:inherit;border:3px solid #FF6A1F;opacity:0;animation:dv-ring 1.6s ease-out infinite;pointer-events:none}
@keyframes dv-ring{0%{opacity:.8;transform:scale(1)}100%{opacity:0;transform:scale(1.1,1.35)}}
@media (hover:hover) and (pointer:fine){.dv-act kbd{display:block}}
.dv-map{top:10px;right:10px;width:124px;height:124px;border-radius:18px;background:rgba(14,15,18,0.62);overflow:hidden}
.dv-map canvas{display:block;width:100%;height:100%}
.dv-cam{top:142px;right:10px;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(14,15,18,0.62);pointer-events:auto;cursor:pointer;touch-action:manipulation}
.dv-cam svg{width:24px;height:24px;fill:none;stroke:#F2F3F5;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.dv-cam[aria-pressed="true"]{background:#FF6A1F}
.dv-cam[aria-pressed="true"] svg{stroke:#1A0F07}
.dv-act2{top:max(240px,calc(34% + 44px));right:10px;height:50px;box-sizing:border-box;display:flex;align-items:center;gap:8px;margin:0;padding:0 16px 0 6px;border:0;border-radius:999px;background:rgba(14,15,18,0.62);color:#F2F3F5;font:700 18px/1 ${SANS};letter-spacing:.04em;box-shadow:0 4px 0 rgba(0,0,0,0.35);pointer-events:auto;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.dv-act2 i{flex:none;width:38px;height:38px;border-radius:50%;background:#FF6A1F;display:grid;place-items:center}
.dv-act2 svg{width:22px;height:22px;fill:none;stroke:#1A0F07;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.dv-act2.on{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,0.35)}
.dv-act2:focus-visible{outline:3px solid #F2F3F5;outline-offset:3px}
.dv-spd{bottom:14px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;min-width:58px;padding:6px 8px 5px;border-radius:14px;background:rgba(14,15,18,0.62);font-family:${COND};font-variant-numeric:tabular-nums;line-height:1}
.dv-spd b{font-size:28px;font-weight:700}
.dv-spd span{font-size:11px;font-weight:600;letter-spacing:.06em;color:#C6CAD1;margin-top:2px}
.dv-spd em{position:absolute;top:-9px;right:-9px;width:22px;height:22px;border-radius:50%;background:#F2F3F5;color:#0E0F12;font:700 15px/22px ${COND};font-style:normal;text-align:center}
.dv-spd em.r{background:#FF3B30;color:#fff}
.dv-steer{bottom:12px;left:10px;display:flex;gap:8px;pointer-events:auto;touch-action:none}
.dv-steer b,.dv-ped b{display:grid;place-items:center;touch-action:none;cursor:pointer}
.dv-steer b{width:70px;height:74px;border-radius:18px;background:rgba(14,15,18,0.62);box-shadow:0 4px 0 rgba(0,0,0,0.35)}
.dv-steer svg{width:30px;height:30px;fill:#F2F3F5}
.dv-steer b.on{background:#FF6A1F;transform:translateY(3px);box-shadow:none}
.dv-steer b.on svg{fill:#1A0F07}
.dv-ped{bottom:12px;right:10px;display:flex;align-items:flex-end;gap:10px;pointer-events:auto;touch-action:none}
.dv-ped b{font-weight:700;border-radius:18px;letter-spacing:.04em}
.dv-gas{width:74px;height:100px;background:#FF6A1F;color:#1A0F07;font-size:21px;box-shadow:0 5px 0 #9E4213}
.dv-brk{width:62px;height:70px;background:#2B2E35;color:#F2F3F5;font-size:18px;box-shadow:0 5px 0 #111216}
.dv-brk.rev{background:#F2F3F5;color:#0E0F12;box-shadow:0 5px 0 #8F949B}
.dv-ped b.on{transform:translateY(4px);box-shadow:none}
/* 第 3 批（甩尾）：手煞車（油門上面；矮的畫面放煞車左邊；更矮的（沒全螢幕的手機橫拿）再往左，不壓到「下車」）、速度表上面的「甩尾 35°」 */
.dv{container-type:size}
.dv-hb{right:10px;bottom:124px;width:74px;height:46px;display:grid;place-items:center;border-radius:16px;background:#2B2E35;color:#FF6A1F;font-size:17px;font-weight:700;letter-spacing:.04em;box-shadow:0 5px 0 #111216;pointer-events:auto;touch-action:none;cursor:pointer}
.dv-hb.on{background:#FF6A1F;color:#1A0F07;transform:translateY(4px);box-shadow:none}
@media (max-height:560px){.dv-hb{right:166px;bottom:12px;width:62px;height:70px;border-radius:18px}}
@container (max-height:290px){.dv-hb{right:288px}}
/* 第 3 批（b3-int）：App 沒全螢幕、螢幕又高又寬（平板、電腦）：畫面只是中間一小塊（426×320），手煞車（油門上面）會壓到換視角、全螢幕鈕 → 放到全螢幕鈕左邊（同一排）；通緝中跟著往下推 */
@media (min-height:561px){@container (max-height:409px){.dv-hb{top:142px;right:114px;bottom:auto;height:44px}.pw-host.pw-on .dv-hb{margin-top:46px}}}
.dv-spd i{position:absolute;bottom:calc(100% + 24px);left:50%;transform:translateX(-50%);padding:5px 13px;border-radius:999px;background:#FF6A1F;color:#1A0F07;font:700 17px/1 ${SANS};font-style:normal;letter-spacing:.04em;white-space:nowrap;box-shadow:0 3px 0 #9E4213}
.dv-spd i span{font:700 19px/1 ${COND};color:inherit;margin:0 0 0 5px;letter-spacing:0}
.dv-toast{top:34%;left:50%;width:max-content;max-width:calc(100% - 32px);box-sizing:border-box;padding:9px 20px;border-radius:22px;background:rgba(14,15,18,0.78);font-size:20px;font-weight:700;line-height:1.3;text-align:center;text-wrap:balance;opacity:0;transform:translate(-50%,-50%) scale(.92);transition:opacity .15s,transform .15s}
.dv-toast.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
@media (prefers-reduced-motion:reduce){.dv-toast,.dv-chip svg{transition:none}.dv-act::after{animation:none}}
`;
const ICON = {
  up: '<svg viewBox="0 0 24 24"><path d="M12 2.5l7.5 9.5h-4.6v9.5H9.1V12H4.5z"/></svg>',
  L: '<svg viewBox="0 0 24 24"><path d="M3 12l11-8v16z"/><rect x="15.5" y="8.5" width="5" height="7" rx="1"/></svg>',
  R: '<svg viewBox="0 0 24 24"><path d="M21 12L10 4v16z"/><rect x="3.5" y="8.5" width="5" height="7" rx="1"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M4 16.5a8 8 0 0 1 16 0"/><circle cx="12" cy="16.5" r="2.3"/><path d="M12 14.2V9.5M7.2 17.8l-2.6 1.4M16.8 17.8l2.6 1.4"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M5 21V3.5h13l-2.5 4.5L18 12.5H7V21z"/></svg>',
  // HUD 大按鈕的圖：鐵捲門（往上拉）、鑰匙、手指點一下
  door: '<svg viewBox="0 0 24 24"><path d="M3.5 20.5v-16h17v16"/><path d="M3.5 8.5h17M3.5 12h17"/><path d="M12 20.5v-5.8M9.2 17.2l2.8-2.8 2.8 2.8"/></svg>',
  key: '<svg viewBox="0 0 24 24"><circle cx="8" cy="15.5" r="4.2"/><path d="M11 12.5l8.5-8.5M16.2 7.3l2.6 2.6M13.8 9.7l2 2"/></svg>',
  hand: '<svg viewBox="0 0 24 24"><path d="M10.2 21l-3.6-4.6a1.5 1.5 0 0 1 2.3-1.9l1.3 1.5V9.2a1.6 1.6 0 0 1 3.2 0v4.6l3.8.8a1.9 1.9 0 0 1 1.5 2.1l-.6 4.3"/><path d="M7.6 6.6a5 5 0 0 1 8.3 0"/></svg>',
  // 第二顆按鈕（下車）：走路的人
  walk: '<svg viewBox="0 0 24 24"><circle cx="13.4" cy="4.3" r="2"/><path d="M11.6 8.5l-3 1.6-1.3 3.2M11.6 8.5l2.4 2 2.9.6M11.6 8.5l-1 5.3 3 2.5.9 4.3M10.6 13.8l-1.9 3.4-3 1.3"/></svg>',
};

// ---- 碰撞物的格子（8 公尺一格）：加、照 tag 拿掉、找附近的（之後的交通、警察、走路也用得到）----
// 碰撞物：{ t: 'box', x, z, hx, hz, rot, h } | { t: 'circle', x, z, r, h }（xz 平面；h＝高度，鏡頭避開房子用）
function colGrid() {
  const CELL = 8, grid = new Map(), tags = new Map(), found = []; let stamp = 0;
  const key = (gx, gz) => gx * 65536 + gz;
  function add(list, tag = null) {
    let n = 0;
    for (const c of list || []) {
      if (!c || !isFinite(c.x) || !isFinite(c.z) || !(c.t === 'box' ? c.hx > 0 && c.hz > 0 : c.r > 0)) continue;
      const q = c.t === 'box' ? { ...c, src: c, u: [Math.cos(c.rot || 0), -Math.sin(c.rot || 0)], w: [Math.sin(c.rot || 0), Math.cos(c.rot || 0)] } : { ...c, src: c, t: 'circle' }; // src：原來那個（第 9 批：壓扁的房子長回來，原來那個 crushed 改回 false 就又擋了）
      const ex = q.t === 'box' ? Math.abs(q.u[0]) * q.hx + Math.abs(q.w[0]) * q.hz : q.r, ez = q.t === 'box' ? Math.abs(q.u[1]) * q.hx + Math.abs(q.w[1]) * q.hz : q.r;
      q.tag = tag; q.cells = []; q._s = 0;
      for (let gx = Math.floor((q.x - ex) / CELL); gx <= Math.floor((q.x + ex) / CELL); gx++) for (let gz = Math.floor((q.z - ez) / CELL); gz <= Math.floor((q.z + ez) / CELL); gz++) {
        if (q.t === 'box') { // 斜的長方形（斜的護欄）只放真的碰到的格子
          const dx = (gx + 0.5) * CELL - q.x, dz = (gz + 0.5) * CELL - q.z, hc = CELL / 2;
          if (Math.abs(dx * q.u[0] + dz * q.u[1]) > q.hx + hc * (Math.abs(q.u[0]) + Math.abs(q.u[1])) || Math.abs(dx * q.w[0] + dz * q.w[1]) > q.hz + hc * (Math.abs(q.w[0]) + Math.abs(q.w[1]))) continue;
        }
        const k = key(gx, gz); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(q); q.cells.push(k);
      }
      if (tag != null) { let t = tags.get(tag); if (!t) tags.set(tag, (t = [])); t.push(q); }
      n++;
    }
    return n;
  }
  function remove(tag) {
    const t = tag != null && tags.get(tag); if (!t) return 0;
    for (const q of t) for (const k of q.cells) { const a = grid.get(k); if (!a) continue; const i = a.indexOf(q); if (i >= 0) a.splice(i, 1); if (!a.length) grid.delete(k); }
    tags.delete(tag); return t.length;
  }
  const near = (x0, z0, x1, z1, test) => { // 這個範圍裡的碰撞物（放在 found，下一次呼叫會蓋掉）
    stamp++; found.length = 0;
    for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++) for (let gz = Math.floor(z0 / CELL); gz <= Math.floor(z1 / CELL); gz++) {
      const a = grid.get(key(gx, gz)); if (!a) continue;
      for (const c of a) if (c._s !== stamp) { c._s = stamp; if (!test || test(c)) found.push(c); }
    }
    return found;
  };
  return { add, remove, near, clear: () => { for (const t of [...tags.keys()]) remove(t); } };
}

// ---- 第 3 批（甩尾）：地上的胎痕、輪胎的煙：同一個場景共用一套（換車、下車再上車，地上的胎痕還在）；全部先配好，每幀不 new 東西 ----
// 胎痕：640 段（一段＝一個四邊形），環狀：滿了蓋掉最舊的；慢慢淡掉（shader 照「畫上去的時間」算，不用每幀改）；這一幀寫的那幾段才上傳
// 煙：96 團（一個 draw call：instanced 的四邊形永遠面向鏡頭），自己往上飄、變大、淡掉（shader 算）；沒有胎痕、沒有煙的時候整個藏起來（0 個 draw call）
const SKID = { NS: 640, NP: 96, life: 18, kind: [0, 1, 2, 0, 0, 2, 2, 3, 0], // 路面 → 樣子
  look: [ // 胎痕的顏色（線性 rgb＋不透明度）、煙的顏色、煙多大
    { m: [0.03, 0.03, 0.034, 0.55], s: [0.8, 0.8, 0.84, 0.34], z: 1 }, // 柏油：黑黑的胎痕、白煙
    { m: [0.05, 0.08, 0.02, 0.5], s: [0.42, 0.38, 0.26, 0.24], z: 0.85 }, // 草地：深綠的痕、一點點土
    { m: [0.12, 0.075, 0.03, 0.55], s: [0.46, 0.33, 0.2, 0.4], z: 1.15 }, // 稻田、泥土、泥巴：咖啡色的痕、黃土煙
    { m: [0.3, 0.22, 0.12, 0.42], s: [0.66, 0.55, 0.38, 0.38], z: 1.25 }, // 沙
  ] };
const SKID_FX = new WeakMap();
function skidFx(scene) {
  let F = SKID_FX.get(scene); if (F) return F;
  const { NS, NP } = SKID, U = { now: { value: 0 }, life: { value: SKID.life } };
  const dyn = (a) => a.setUsage(THREE.DynamicDrawUsage), tex = (n, f) => { const d = new Uint8Array(n * n * 4); for (let i = 0; i < n * n; i++) d.fill(f(i % n, (i / n) | 0), i * 4, i * 4 + 4); const t = new THREE.DataTexture(d, n, n); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  // 胎痕：一段 4 個點（起點左右、終點左右）；aT＝畫上去的時間；uv.x 橫過去（邊軟軟的、有一點點胎紋）
  const mg = new THREE.BufferGeometry(), mp = new Float32Array(NS * 12), mc = new Float32Array(NS * 16), mt = new Float32Array(NS * 4).fill(-1e4), muv = new Float32Array(NS * 8), mi = new Uint16Array(NS * 6);
  for (let i = 0; i < NS; i++) { const v = i * 4, j = i * 6; muv[i * 8 + 2] = muv[i * 8 + 6] = muv[i * 8 + 5] = muv[i * 8 + 7] = 1; mi[j] = v; mi[j + 1] = mi[j + 4] = v + 2; mi[j + 2] = mi[j + 3] = v + 1; mi[j + 5] = v + 3; }
  mg.setAttribute('position', dyn(new THREE.BufferAttribute(mp, 3))); mg.setAttribute('color', dyn(new THREE.BufferAttribute(mc, 4))); mg.setAttribute('aT', dyn(new THREE.BufferAttribute(mt, 1)));
  mg.setAttribute('uv', new THREE.BufferAttribute(muv, 2)); mg.setIndex(new THREE.BufferAttribute(mi, 1)); mg.setDrawRange(0, 0);
  const mm = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -5,
    alphaMap: tex(32, (x) => Math.round(255 * clamp((1 - Math.abs((x / 31) * 2 - 1)) / 0.4, 0, 1) * (0.82 + 0.18 * Math.cos(x * 2.2)))) });
  mm.onBeforeCompile = (sh) => {
    sh.uniforms.uNow = U.now; sh.uniforms.uLife = U.life;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aT;\nuniform float uNow, uLife;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.a *= 1.0 - smoothstep(uLife * 0.35, uLife, uNow - aT);');
  };
  const marks = new THREE.Mesh(mg, mm); marks.name = 'drive-skidmarks'; marks.frustumCulled = false; marks.renderOrder = 0.5; marks.matrixAutoUpdate = false; marks.visible = false;
  // 煙：aP＝出生的位置＋時間、aV＝飄的速度＋活多久、aS＝一開始多大、長多大、轉的角度、轉多快、color＝顏色＋不透明度
  const sg = new THREE.InstancedBufferGeometry(), ia = (n) => dyn(new THREE.InstancedBufferAttribute(new Float32Array(NP * n), n));
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0]), 3));
  sg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2)); sg.setIndex([0, 1, 2, 2, 1, 3]);
  const sP = ia(4), sV = ia(4), sS = ia(4), sC = ia(4); for (let i = 0; i < NP; i++) { sP.array[i * 4 + 3] = -1e4; sV.array[i * 4 + 3] = 1; }
  sg.setAttribute('aP', sP); sg.setAttribute('aV', sV); sg.setAttribute('aS', sS); sg.setAttribute('color', sC); sg.instanceCount = NP;
  const sm = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false,
    map: tex(32, (x, y) => { const r = Math.hypot(x - 15.5, y - 15.5) / 15.5, a = clamp(1 - r, 0, 1); return Math.round(255 * a * a * (0.85 + 0.15 * Math.sin(x * 1.3 + y * 0.7))); }) });
  sm.map.colorSpace = THREE.NoColorSpace;
  sm.onBeforeCompile = (sh) => { // 貼圖只用 alpha（DataTexture 四個通道一樣：rgb 也是那個值 → 換成 1，顏色照 color）
    sh.uniforms.uNow = U.now;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aP, aV, aS;\nuniform float uNow;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nfloat age = uNow - aP.w, k = clamp(age / aV.w, 0.0, 1.0);\nvColor.a *= smoothstep(0.0, 0.12, age) * (1.0 - k) * (1.0 - k);')
      .replace('#include <project_vertex>', 'float sz = (aS.x + aS.y * sqrt(k)) * step(0.0, age) * step(age, aV.w), an = aS.z + aS.w * age;\n'
        + 'vec4 mvPosition = viewMatrix * vec4(aP.xyz + aV.xyz * (1.0 - exp(-1.8 * age)) / 1.8 + vec3(0.0, 0.45 * age, 0.0), 1.0);\n'
        + 'mvPosition.xy += mat2(cos(an), sin(an), -sin(an), cos(an)) * position.xy * sz;\ngl_Position = projectionMatrix * mvPosition;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = vec3(1.0);');
  };
  const smoke = new THREE.Mesh(sg, sm); smoke.name = 'drive-smoke'; smoke.frustumCulled = false; smoke.renderOrder = 5; smoke.matrixAutoUpdate = false; smoke.visible = false;
  const rg = () => ({ start: 0, count: 0 });
  F = { U, marks, smoke, mp, mc, mt, sP, sV, sS, sC, n: 0, np: 0, d0: -1, dn: 0, pd: false, lastM: -1e9, lastP: -1e9, warm: 2, cT: -1, cm: 0, cp: 0, rg: [rg(), rg(), rg()],
    seg(ax, az, ay, bx, bz, by, cx, cz, cy, dx, dz, dy, a0, a1, col) { // 一段胎痕：a＝起點左、b＝起點右、c＝終點左、d＝終點右
      const i = F.n % NS, p = i * 12, c = i * 16, t = i * 4, now = U.now.value; F.n++;
      mp[p] = ax; mp[p + 1] = ay; mp[p + 2] = az; mp[p + 3] = bx; mp[p + 4] = by; mp[p + 5] = bz; mp[p + 6] = cx; mp[p + 7] = cy; mp[p + 8] = cz; mp[p + 9] = dx; mp[p + 10] = dy; mp[p + 11] = dz;
      for (let k = 0; k < 4; k++) { mc[c + k * 4] = col[0]; mc[c + k * 4 + 1] = col[1]; mc[c + k * 4 + 2] = col[2]; mc[c + k * 4 + 3] = col[3] * (k < 2 ? a0 : a1); mt[t + k] = now; }
      if (F.d0 < 0) F.d0 = i; F.dn++; F.lastM = now;
    },
    puff(x, y, z, vx, vy, vz, life, s0, grow, col, a) { // 一團煙
      const i = (F.np++ % NP) * 4, now = U.now.value;
      sP.array[i] = x; sP.array[i + 1] = y; sP.array[i + 2] = z; sP.array[i + 3] = now;
      sV.array[i] = vx; sV.array[i + 1] = vy; sV.array[i + 2] = vz; sV.array[i + 3] = life;
      sS.array[i] = s0; sS.array[i + 1] = grow; sS.array[i + 2] = Math.random() * TAU; sS.array[i + 3] = (Math.random() - 0.5) * 1.4;
      sC.array[i] = col[0]; sC.array[i + 1] = col[1]; sC.array[i + 2] = col[2]; sC.array[i + 3] = a;
      F.pd = true; F.lastP = now;
    },
    flush() { // 這一幀寫的上傳（胎痕只傳寫到的那幾段；繞回頭的那一次全部傳）、要不要畫
      if (F.dn > 0) {
        const one = F.d0 + F.dn <= NS, s = one ? F.d0 : 0, n = one ? F.dn : NS, A = mg.attributes;
        F.rg[0].start = s * 12; F.rg[0].count = n * 12; A.position.updateRanges.length = 0; A.position.updateRanges.push(F.rg[0]); A.position.needsUpdate = true;
        F.rg[1].start = s * 16; F.rg[1].count = n * 16; A.color.updateRanges.length = 0; A.color.updateRanges.push(F.rg[1]); A.color.needsUpdate = true;
        F.rg[2].start = s * 4; F.rg[2].count = n * 4; A.aT.updateRanges.length = 0; A.aT.updateRanges.push(F.rg[2]); A.aT.needsUpdate = true;
        mg.setDrawRange(0, Math.min(F.n, NS) * 6); F.d0 = -1; F.dn = 0;
      }
      if (F.pd) { sP.needsUpdate = sV.needsUpdate = sS.needsUpdate = sC.needsUpdate = true; F.pd = false; }
      const now = U.now.value, w = F.warm > 0; if (w) F.warm--; // 一開始畫兩幀（先把 shader 編好，第一次甩的時候不會卡一下）
      marks.visible = w || (F.n > 0 && now - F.lastM < SKID.life + 0.5); smoke.visible = w || now - F.lastP < 3.6;
    },
    count() { F.cnt(); return F.cm; }, alive() { F.cnt(); return F.cp; }, // telemetry 用：還看得到幾段胎痕、幾團煙（一幀只數一次）
    cnt() {
      const now = U.now.value; if (F.cT === now) return; F.cT = now; F.cm = F.cp = 0;
      for (let i = 0, e = Math.min(F.n, NS); i < e; i++) if (now - mt[i * 4] < SKID.life) F.cm++;
      for (let i = 0; i < NP; i++) { const a = now - sP.array[i * 4 + 3]; if (a >= 0 && a < sV.array[i * 4 + 3]) F.cp++; }
    },
  };
  scene.add(marks, smoke); SKID_FX.set(scene, F);
  return F;
}

function createDrive(o) {
  const S = o.car, car = S.car, body = S.body, W = S.spec.wheels, P = o.perf || { hp: 250, kg: 1300, red: 7500, vmax: 240, cda: 0.65 };
  const world = o.world || {}, places = world.places || {}, scene = o.scene, camera = o.camera;
  const vmx = P.vmax / 3.6, vtop = Math.min(vmx, +o.maxKmh > 0 ? o.maxKmh / 3.6 : Infinity), hasDoc = typeof document !== 'undefined' && !!o.hudParent;
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; // 減少動態效果：鏡頭晃小一點

  // 車子的大小（車身座標）：先放回原點量（Box3 量的是世界座標），量完放回去
  const info = (() => {
    const p = car.position.clone(), q = car.quaternion.clone(), bx = body.position.x, bz = body.position.z, br = body.rotation.clone();
    car.position.set(0, 0, 0); car.quaternion.identity(); body.position.x = 0; body.position.z = 0; body.rotation.set(0, 0, 0); car.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(body);
    car.position.copy(p); car.quaternion.copy(q); body.position.x = bx; body.position.z = bz; body.rotation.copy(br); car.updateMatrixWorld(true);
    return { nose: b.max.x, tail: b.min.x, len: b.max.x - b.min.x, halfW: Math.max(b.max.z, -b.min.z), wheelbase: W.xf - W.xr, xr: W.xr };
  })();
  const HL = info.len / 2 - 0.04, HW = Math.max(info.halfW, +o.halfW || 0) - 0.04, CX = (info.nose + info.tail) / 2, L = info.wheelbase;
  const hubs = S.wheels.map((w) => w.parent), hub0 = hubs.map((h) => h.rotation.y), RF = W.RF ?? W.R, RR = W.RR ?? W.R;
  const base = { bx: body.position.x, bz: body.position.z };
  // 引擎、齒比、起步抓地：跟 race.src.js 的 racer() 一樣；尾速長一點點（六檔紅線＝極速 ×1.012）：跑極速的時候轉速 0.99，不會一直撞斷油
  const m = P.kg + 75, wr = (P.red * TAU) / 60, vrl = vmx * 1.012;
  const GR = Array.isArray(P.gears) && P.gears.length === 6 ? P.gears : GEARS; // 第 4 批：自己的齒比（怪獸卡車）
  const fd = (wr * RR) / (GR[5] * vrl), Tpk = (P.hp * 745.7) / (wr * 0.95 * torqueAt(0.95)), tract = 1.35 * m * 9.81 * (P.awd ? 0.9 : P.drive ?? 0.74);
  const xOf = (u, g) => (Math.abs(u) * GR[g]) / (GR[5] * vrl), kGeo0 = Math.tan(0.6) / L; let kGeo = kGeo0; // 第 4 批：kGeo 四輪轉向會變 // 轉速÷紅線；方向盤打死的曲率
  // ---- 第 3 批（甩尾）：這台車的個性：後驅大馬力最好甩（角度大、踩油門撐得久）、四驅穩一點（角度小、自己慢慢抓回來）、越野車最穩（只有手煞車甩得動）----
  // amax＝最大的角度（弧度）、sus＝踩油門撐住多少、pow＝油門甩得出來嗎、dec＝放開以後多快抓回來、bias＝後輪出力的比例、cg＝甩的時候繞哪裡轉（重心附近，車子座標 x）
  const pwk = (P.hp || 250) / (P.kg || 1300), rwd = !P.awd, ofr = !!P.offroad;
  const DR = { rwd, ofr, bias: rwd ? 1 : 0.42, amax: ofr ? 0.3 : rwd ? clamp(0.6 + 0.3 * (pwk - 0.3), 0.6, 0.78) : clamp(0.4 + 0.25 * (pwk - 0.2), 0.4, 0.52),
    sus: ofr ? 0.06 : rwd ? clamp(0.5 + (pwk - 0.3), 0.5, 1) : clamp(0.3 + 0.5 * (pwk - 0.2), 0.25, 0.5), pow: ofr ? 0 : rwd ? 1 : 0.4, dec: rwd ? 1.15 : 1.5, cg: W.xr + 0.47 * (W.xf - W.xr) };

  const st = { x: car.position.x, z: car.position.z, th: car.rotation.y, v: 0, steer: 0, thr: 0, brk: 0, hb: 0, thrEff: 0, load: 0, cutLoad: 0, gear: 0, rev: false, hold: 0, cut: 0, rpm: 0.13, spin: 0,
    surf: 0, cap: vtop, bumps: 0, shifts: 0, touch: 0, blocked: 0, roll: 0, rollV: 0, pitch: 0, pitchV: 0, alat: 0, along: 0, kap: 0, scrub: 0, push: 0, jit: 0, jitT: 0, hitW: 0, hitT: -9, impT: -9, impW: 0 };
  // 第 3 批（甩尾）：slip＝甩的角度（走的方向＝th＋slip）、slipV＝它變多快、loose＝後輪多鬆（0–1）、dm＝甩了多少（0 抓地～1 甩）、skid＝輪胎叫、skidM＝胎痕／煙
  Object.assign(st, { slip: 0, slipV: 0, loose: 0, dm: 0, skid: 0, skidM: 0, flick: 0, sPrev: 0, thrMem: 0, pwT: 0, kick: 0, kickT: 0, dT: 0, drifts: 0, dShow: 0 });
  const dmgP = { power: 1, top: 1, maxKmh: Infinity, steerPull: 0 }; // 撞壞了（setDamage）
  let imp = null; // 這一幀最大的一下（onImpact）
  const human = { thr: 0, brk: 0, steer: 0, hb: 0, kb: {} };
  let forced = null, paused = false, auto = null, alive = true, dest = null, mode = 'chase', view = null, intro = null, now = 0, action = null, action2 = null;
  let marks = null; // 第 3 批（b3-int）別的模組給的小地圖點（setMarkers）：[{ x, z, fill, ring, r, on }]
  const zoneIn = {}, events = []; let zoneNow = null, routeData = null, routeT = 0, routeS = 0;
  // ==== 第 4 批：地形（越野車場）：world 有高度才有；一般的車沒開進越野車場 ride.on＝false（照舊）；越野車（perf.offroad）一直開著 ====
  const CRU = o.crush || null; // 第 7 批（輾扁）：怪獸卡車才有（crush.js）：{ heightAt（墊子的高度）, can(c)（輾得過去嗎）, hit(c, speed)（輾到了，這個碰撞物不擋了）}
  const ride = typeof createRide === 'function' && (world.heightAt || P.offroad) ? createRide({ S, st, info: { ...info, CX }, perf: P, world, events, extraH: CRU ? CRU.heightAt : null }) : null;

  // ---- 碰撞：車子＝有方向的長方形（OBB），碰到長方形（SAT）、圓（最近點）就推出去 ----
  const cw = colGrid(); cw.add(world.colliders); cw.add(o.colliders);
  const hitBox = (cx, cz, f, r, c) => { // 回傳 [推 x, 推 z, 法線 x, 法線 z, 碰到的點 x, z（相對車子中心）]（把車推出去）或 null
    const dx = cx - c.x, dz = cz - c.z; let best = Infinity, nx = 0, nz = 0, ax = 0, k = 0;
    for (const a of [f, r, c.u, c.w]) {
      const d = dx * a[0] + dz * a[1];
      const o1 = HL * Math.abs(f[0] * a[0] + f[1] * a[1]) + HW * Math.abs(r[0] * a[0] + r[1] * a[1]) + c.hx * Math.abs(c.u[0] * a[0] + c.u[1] * a[1]) + c.hz * Math.abs(c.w[0] * a[0] + c.w[1] * a[1]) - Math.abs(d);
      if (o1 <= 0) return null;
      if (o1 < best) { best = o1; const s = d < 0 ? -1 : 1; nx = a[0] * s; nz = a[1] * s; ax = k; }
      k++;
    }
    // 碰到的點（相對車子中心）：軸是碰撞物的＝車子最深的角；軸是車子的＝碰撞物最深的角（夾在車子裡面）
    let px = 0, pz = 0, n = 0;
    if (ax >= 2) { let lo = Infinity; for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const qx = f[0] * sx * HL + r[0] * sz * HW, qz = f[1] * sx * HL + r[1] * sz * HW, d = qx * nx + qz * nz; if (d < lo - 0.03) { lo = d; px = qx; pz = qz; n = 1; } else if (d < lo + 0.03) { px += qx; pz += qz; n++; } } }
    else {
      let hi = -Infinity;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const qx = c.x - cx + c.u[0] * sx * c.hx + c.w[0] * sz * c.hz, qz = c.z - cz + c.u[1] * sx * c.hx + c.w[1] * sz * c.hz, d = qx * nx + qz * nz; if (d > hi + 0.03) { hi = d; px = qx; pz = qz; n = 1; } else if (d > hi - 0.03) { px += qx; pz += qz; n++; } }
      px /= n; pz /= n; n = 1; const lx = clamp(px * f[0] + pz * f[1], -HL, HL), lz = clamp(px * r[0] + pz * r[1], -HW, HW); px = f[0] * lx + r[0] * lz; pz = f[1] * lx + r[1] * lz;
    }
    return [nx * best, nz * best, nx, nz, px / n, pz / n];
  };
  const hitCircle = (cx, cz, f, r, c) => {
    const dx = c.x - cx, dz = c.z - cz, lx = dx * f[0] + dz * f[1], lz = dx * r[0] + dz * r[1];
    const ex = lx - clamp(lx, -HL, HL), ez = lz - clamp(lz, -HW, HW), d2 = ex * ex + ez * ez;
    if (d2 >= c.r * c.r) return null;
    let nx, nz, pen;
    if (d2 > 1e-10) { const d = Math.sqrt(d2); nx = ex / d; nz = ez / d; pen = c.r - d; }
    // 圓心跑進車子裡了（細柱子、很快）：從車頭（倒車＝車尾）那面進來的就從那面推回去，不然找最近的一面
    else if (HL - Math.abs(lx) < HW - Math.abs(lz) || (Math.abs(st.v) > 2 && lx * st.v > 0 && Math.abs(lx) > HL * 0.5)) { nx = Math.sign(lx) || 1; nz = 0; pen = HL - Math.abs(lx) + c.r; }
    else { nx = 0; nz = Math.sign(lz) || 1; pen = HW - Math.abs(lz) + c.r; }
    const wx = f[0] * nx + r[0] * nz, wz = f[1] * nx + r[1] * nz, qx = clamp(lx, -HL, HL), qz = clamp(lz, -HW, HW); // 車子往圓的方向；車要往反方向推
    return [-wx * pen, -wz * pen, -wx, -wz, f[0] * qx + r[0] * qz, f[1] * qx + r[1] * qz];
  };
  // 撞進去（w＝撞進去的速度 m/s）：法向吃掉、彈回一點；沿著牆的速度照摩擦（0.35）掉一些；車頭往沿著牆的方向轉一點
  function impact(w, fn, nx, nz, px, pz, f, c) {
    const e = Math.min(0.25 * w, 2), ft2 = Math.max(0, 1 - fn * fn), vt = Math.abs(st.v) * Math.sqrt(ft2), mu = vt > 1e-3 ? Math.min(1, (0.35 * (w + e)) / vt) : 1;
    st.v = st.v * ft2 * (1 - mu) + e * fn;
    const tx = -nz, tz = nx, ft = f[0] * tx + f[1] * tz;
    // 擦到：轉成沿著牆；正面：照撞到的點（力矩），慢慢頂著（10 km/h 以下）就不轉（方向盤轉得出來）；一次最多轉 20°（不會打轉）
    const dth = Math.abs(ft) > 0.2 ? wrapA(Math.atan2(-tz * Math.sign(ft), tx * Math.sign(ft)) - st.th) : clamp(pz * nx - px * nz, -1, 1) * 0.2 * clamp((w - 0.3) / 2, 0, 1);
    st.th = wrapA(st.th + Math.sign(dth) * Math.min(Math.abs(dth), 0.05 + 0.01 * w, 0.35));
    // 車身抖一下（撞到那邊）、記下最大的一下（這一幀算完才叫 onBump）
    const nr = -f[1] * nx + f[0] * nz; // 法線在車子右邊的分量（r＝(−f.z, f.x)）
    st.pitchV = clamp(st.pitchV + fn * w * 0.012, -0.9, 0.9); st.rollV = clamp(st.rollV - nr * w * 0.012, -0.9, 0.9);
    st.hitW = Math.max(st.hitW, w);
    // 撞壞（onImpact）：換成車子座標記下來（碰到的點、法線、撞到的東西多寬多高）
    if (o.onImpact && w > 1.5 && (!imp || w > imp.speed)) {
      const r = [-f[1], f[0]], tx = -nz, tz = nx;
      const rr = !c ? 9 : c.t === 'circle' ? c.r : c.hx * Math.abs(c.u[0] * tx + c.u[1] * tz) + c.hz * Math.abs(c.w[0] * tx + c.w[1] * tz);
      const dx = c ? c.x - st.x : 0, dz = c ? c.z - st.z : 0, lx = px * f[0] + pz * f[1] + CX, lz = px * r[0] + pz * r[1];
      imp = { speed: w, px: lx, pz: lz, nx: nx * f[0] + nz * f[1], nz: nx * r[0] + nz * r[1], r: rr, ox: c ? dx * f[0] + dz * f[1] : lx, oz: c ? dx * r[0] + dz * r[1] : lz, h: c ? c.h ?? 9 : 3 };
    }
  }
  // 第 3 批：甩尾撞到東西：用力撞到就不甩了（角度剩一點點、慢慢抓回來），擦到鬆一點
  const hitSlide = (w) => { if (w > 1.5) { st.loose = 0; st.slip *= 0.3; st.slipV = 0; } else { st.loose *= 0.8; st.slipV *= 0.5; } };
  function collide() {
    let hit = 0;
    for (let it = 0; it < 3; it++) {
      const f = [Math.cos(st.th), -Math.sin(st.th)], r = [Math.sin(st.th), Math.cos(st.th)];
      let cx = st.x + f[0] * CX, cz = st.z + f[1] * CX, moved = false;
      const list = cw.near(cx - 3, cz - 3, cx + 3, cz + 3).slice();
      for (const c of list) {
        if (c.crushed === true || c.src.crushed === true) continue; // 第 7 批（輾扁）：已經扁掉的東西誰都開得過去（不擋了）；第 9 批：看原來那個（會長回來）
        const p = c.t === 'box' ? hitBox(cx, cz, f, r, c) : hitCircle(cx, cz, f, r, c);
        if (!p) continue;
        if (CRU && CRU.can(c)) { if (CRU.hit(c, Math.abs(st.v)) === false) c.crushed = true; continue; } // 第 7 批：怪獸卡車輾過去（不擋、不彈開、不算撞到；車子照 crush.js 的墊子爬上去）
        st.x += p[0]; st.z += p[1]; cx += p[0]; cz += p[1]; moved = true; hit++; st.touch = 0.2;
        const fn = st.slip !== 0 ? Math.cos(st.th + st.slip) * p[2] - Math.sin(st.th + st.slip) * p[3] : f[0] * p[2] + f[1] * p[3], w = -st.v * fn; // 第 3 批：甩尾的時候照「走的方向」算撞進去多快
        if (w > 0.05) { impact(w, fn, p[2], p[3], p[4], p[5], f, c); if (st.slip !== 0) hitSlide(w); }
        else { const pen = Math.hypot(p[0], p[1]), cr = p[5] * p[2] - p[4] * p[3]; st.th = wrapA(st.th + clamp((2 * cr * pen) / (p[4] * p[4] + p[5] * p[5] + 0.5), -0.04, 0.04)); } // 慢慢頂著：照碰到的點轉一點（滑開）
      }
      if (!moved) break;
    }
    return hit;
  }
  // 鏡頭到車子中間有沒有被房子擋住：回傳 0–1（1＝沒擋到）
  const tall = (c) => (c.h ?? 9) >= 2.4 && (c.t === 'box' || c.r >= 0.6);
  const camBlock = (c) => c.crushed !== true && c.src.crushed !== true && (c.police === true || tall(c)); // 第 9 批：壓扁的房子不擋鏡頭 // 第 3 批（b3-int）：緊跟在後面的警車也擋鏡頭（拉近到它前面，不要從它的警示燈上面看）
  function rayHit(x0, z0, x1, z1) {
    let best = 1; const dx = x1 - x0, dz = z1 - z0;
    for (const c of cw.near(Math.min(x0, x1) - 1, Math.min(z0, z1) - 1, Math.max(x0, x1) + 1, Math.max(z0, z1) + 1, camBlock)) {
      let t;
      if (c.t === 'box') {
        const ox = x0 - c.x, oz = z0 - c.z, pp = [ox * c.u[0] + oz * c.u[1], ox * c.w[0] + oz * c.w[1]], dd = [dx * c.u[0] + dz * c.u[1], dx * c.w[0] + dz * c.w[1]], ee = [c.hx, c.hz];
        let t0 = 0, t1 = 1, ok = true;
        for (let k = 0; k < 2 && ok; k++) {
          if (Math.abs(dd[k]) < 1e-9) { if (Math.abs(pp[k]) > ee[k]) ok = false; continue; }
          let ta = (-ee[k] - pp[k]) / dd[k], tb = (ee[k] - pp[k]) / dd[k]; if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) ok = false;
        }
        if (!ok) continue; t = t0;
      } else {
        const ox = x0 - c.x, oz = z0 - c.z, A = dx * dx + dz * dz, B2 = ox * dx + oz * dz, C2 = ox * ox + oz * oz - c.r * c.r, disc = B2 * B2 - A * C2;
        if (disc < 0 || A < 1e-9) continue; t = (-B2 - Math.sqrt(disc)) / A; if (t < 0) { if (C2 < 0) t = 0; else continue; } if (t > 1) continue;
      }
      if (t < best) best = t;
    }
    return best;
  }

  // ---- 物理（每步 h 秒）----
  function physics(h, inp) {
    const R = ride && ride.on ? ride : null; kGeo = R ? kGeo0 * R.k.ws : kGeo0; // 第 4 批：在地形上（村子裡 null：照舊）；四輪轉向
    // 停住了還按著煞車＝換倒車；倒車停住了按油門＝換前進
    const go0 = st.rev ? inp.brk : inp.thr, stop0 = st.rev ? inp.thr : inp.brk, u0 = st.v * (st.rev ? -1 : 1);
    if (stop0 > 0.5 && go0 < 0.05 && u0 < 0.3 && !inp.hb) { st.hold += h; if (st.hold > 0.25) { st.rev = !st.rev; st.hold = 0; st.gear = 0; st.thr = st.brk = 0; } } else st.hold = 0;
    // 方向盤：放開回正快、轉過去慢一點，越快越慢（300 km/h 點一下只換一點點車道）；油門慢慢踩下去
    const vab0 = Math.abs(st.v), back = Math.abs(inp.steer) < Math.abs(st.steer) || inp.steer * st.steer < 0;
    st.steer = toward(st.steer, inp.steer, h * (back ? 6 : 4 - 2 * Math.min(1, vab0 / 70)));
    st.thr = toward(st.thr, inp.thr, h * (inp.thr > st.thr ? 3.2 : 8)); st.brk = toward(st.brk, inp.brk, h * (inp.brk > st.brk ? 7 : 10)); st.hb = inp.hb || 0;
    const sg = st.rev ? -1 : 1, go = st.rev ? st.brk : st.thr, stop = Math.max(st.rev ? st.thr : st.brk, st.hb * (1 - 0.65 * clamp((vab0 - 6) / 6, 0, 1))), u = st.v * sg, v0 = st.v; // 第 3 批：手煞車快的時候只煞三分之一（後輪鎖住、甩出去）
    const vdm = Math.min(vtop * dmgP.top, dmgP.maxKmh / 3.6), sf = (R && R.sf(st.surf)) || SURF[st.surf] || SURF[0], capS = st.rev ? 4.5 : Math.min(vdm, sf.cap), soft = !st.rev && sf.cap < vdm; st.cap = capS; // 撞壞了極速變低
    // 轉彎：方向盤→想要的曲率（低速＝打死 tan 0.6，快的時候＝打滿要側向 aF）；快到抓地 aG 就推頭：實際轉得少一點、多的那份（scrub）把速度吃掉
    // aF：100 km/h 以下＝抓地 ×1.35、200 km/h ×1.25、320 km/h ×0.95（很穩）；推頭吃掉速度的比例 kS：100 km/h 以下 1.3（村子的彎抱著方向盤自己慢下來）、
    //     200 km/h 以上 0.8（快速道路按住鍵過彎不會掉太多速）
    const v2 = Math.max(vab0 * vab0, 1e-4), aG = (13 + 2 * clamp((vab0 - 20) / 50, 0, 1)) * (R ? R.k.lat : 1), aF = aG * (1.35 - 0.1 * clamp((vab0 - 28) / 28, 0, 1) - 0.3 * clamp((vab0 - 56) / 33, 0, 1));
    // 一直按著推頭（過彎太快、抱著方向盤）超過 0.35 秒：像腳鬆開油門，慢得更多（點一點方向過得去的彎不會掉速）
    const sEff = dmgP.steerPull ? clamp(st.steer + dmgP.steerPull * 0.08 * clamp(vab0 / 5, 0, 1), -1, 1) : st.steer; // 輪子撞歪了：方向盤會偏
    const kc = sEff * Math.min(kGeo, aF / v2), ac = Math.abs(kc) * v2, aa = ac / Math.pow(1 + Math.pow(ac / aG, 6), 1 / 6);
    st.push = ac - aa > 1.2 ? Math.min(2, st.push + h) : Math.max(0, st.push - 2 * h);
    const pk = clamp((st.push - 0.35) / 0.8, 0, 1), kS = 1.3 - 0.5 * clamp((vab0 - 28) / 28, 0, 1) + 0.8 * pk;
    st.kap = ac > 1e-9 ? kc * (aa / ac) : kc; st.scrub = (ac - aa) * kS;
    if (R && R.air) { st.kap = 0; st.scrub = 0; st.push = 0; } // 第 4 批：飛在空中轉不了彎
    if (st.dm > 0) st.scrub *= 1 - st.dm; // 第 3 批：甩尾的時候不算推頭（速度另外掉）
    // 引擎：快到限速油門自己收（定速）；推頭的時候也收（像循跡控制）；load＝給引擎聲的（踩著就大聲）
    const gov = clamp((capS + (capS >= vmx ? 0.3 : 0) - u) / 0.5, 0, 1), lim = gov * (1 - Math.min(0.95, st.scrub / 7 + 0.7 * pk * (1 - st.dm))); // 定速在限速上（極速多 0.3 m/s：錶上看得到 250）
    st.thrEff = go * lim;
    let a = 0;
    if (st.rev) a = 2.8 * st.thrEff * Math.max(0.6, dmgP.power);
    else if (st.cut <= 0) { const x = xOf(u, st.gear); if (x < 1) a = (Math.min(R ? tract * R.k.trac : tract, (st.thrEff * Tpk * torqueAt(clamp(x, st.gear === 0 ? 0.6 : 0.2, 1)) * GR[st.gear] * fd * 0.88) / RR) / m) * dmgP.power; } // 撞到紅線斷油；撞壞了出力變小
    const D = slide(h, inp, R, u, go, gov, a, aG, ac); if (st.dm > 0) { a *= 1 + (D.fwd - 1) * st.dm; a += (Math.min(a, D.cap) - a) * st.dm; } // 第 3 批：甩尾（後輪空轉：往前推的少一點；抓地大部分拿去側滑了）
    const ov = u - capS - 0.5, over = ov > 0 ? (soft ? Math.min(sf.over[1], ov * sf.over[0]) : Math.min(8, ov * 2.5)) : 0; // 比限速快（開進草地、限速變低）：慢下來
    const res = stop * (9.5 + 2.5 * Math.min(1, (u * u) / 4900)) + (go < 0.05 ? (st.rev ? 1.2 : 1.4) : 0) + sf.drag + 0.147 + (AERO * 0.6 * P.cda * u * u) / m + over + (st.rev ? 0 : Math.min(9, st.scrub)) + D.bleed;
    let un;
    if (u > 1e-4) { un = u + (a - res) * h; if (un < 0) un = 0; }
    else if (u < -1e-4) { un = u + (a + res) * h; if (un > 0) un = a > 0 ? Math.min(un, a * h) : 0; }
    else un = Math.max(0, (a - res) * h);
    if (R) un = R.speed(un, u, h, sg, stop, go, (AERO * 0.6 * P.cda) / m); // 第 4 批：飛在空中只有風阻、上下坡、底盤磨地
    st.v = un * sg;
    // 自排：踩越多越晚升檔（全油門 0.98 才升），定速轉速留在 0.45–0.7；放油門、正在慢下來（煞車、推頭、開進草地）不升檔（除非撞紅線）；大腳油門降檔
    if (!st.rev) {
      st.cut = Math.max(0, st.cut - h);
      const x = xOf(un, st.gear), dem = go * gov, pedal = inp.thr > 0.05 && (un - u) / h > -1.5; // dem：腳踩多少（循跡收掉的不算：彎裡面檔位留低、轉速高）
      if (st.cut <= 0 && st.gear < 5 && x > (pedal ? 0.64 + 0.34 * dem : 0.98)) {
        st.gear++; st.cut = 0.08 + 0.1 * dem; st.cutLoad = st.load > 0.9 ? 0 : st.load * 0.35; st.shifts++; events.push(['shift', st.gear + 1]); // 全油門換檔：油門放掉一下（洩壓、放炮，跟賽道一樣）
      } else if (st.gear > 0 && (x < (go > 0.05 ? 0.36 : 0.4) || (dem > 0.9 && xOf(un, st.gear - 1) < 0.8))) st.gear--;
    } else st.cut = 0;
    const xr = st.rev ? 0.14 + Math.min(1, Math.abs(un) / 4.5) * 0.3 : Math.max(0.13, xOf(un, st.gear));
    const slip = st.rev ? 0.1 * go : st.gear === 0 ? 0.34 * go * clamp(1 - xr / 0.5, 0, 1) : 0; // 起步半離合：一踩轉速就起來（聲音馬上出來）
    st.rpm += (Math.min(1.02, xr + slip + D.rev) - st.rpm) * (1 - Math.exp(-h * 12));
    st.load = st.cut > 0 ? st.cutLoad : go > 0.02 ? go * (0.65 + 0.35 * lim) : 0;
    // 走：後軸沿著車頭方向走、繞後軸轉（腳踏車模型）
    const vab = Math.abs(st.v);
    // 頂住東西了還踩油門：方向盤照「想走的速度」轉（原地轉出來，不會一直卡著）
    st.touch = Math.max(0, st.touch - h); // 最近 0.2 秒碰過東西（頂著牆的時候不是每一步都碰到）
    st.blocked = st.touch > 0 && vab < 1 && go > 0.3 ? Math.min(1, st.blocked + h) : Math.max(0, st.blocked - 2 * h);
    const vT = st.blocked > 0.3 ? sg * Math.max(vab, 1.5 * go) : st.v, kT = st.blocked > 0.3 ? st.steer * kGeo : st.kap;
    const f0x = Math.cos(st.th), f0z = -Math.sin(st.th), pvx = R ? R.k.pivot : info.xr, rx = st.x + f0x * pvx + f0x * st.v * h, rz = st.z + f0z * pvx + f0z * st.v * h;
    if (st.slip !== 0 || st.slipV !== 0) { // 第 3 批：甩尾：沿著「走的方向」（th＋slip）走、車頭自己轉（slipV）；繞的點從後軸慢慢移到重心
      const dm = st.dm, pv = pvx + (DR.cg - pvx) * dm, ph = st.th + st.slip, wv = -vT * kT * (1 - dm) + D.wD * dm;
      const qx = st.x + f0x * pv + Math.cos(ph) * st.v * h, qz = st.z + f0z * pv - Math.sin(ph) * st.v * h;
      st.th = wrapA(st.th + (wv - st.slipV) * h);
      st.x = qx - Math.cos(st.th) * pv; st.z = qz + Math.sin(st.th) * pv; st.alat = -st.v * wv;
    } else {
      st.th = wrapA(st.th - vT * kT * h);
      st.x = rx - Math.cos(st.th) * pvx; st.z = rz + Math.sin(st.th) * pvx; st.alat = st.v * st.v * st.kap;
    }
    st.spin += st.v * h; st.along = (st.v - v0) / h;
    // 第 3 批：輪胎叫、胎痕、煙：照甩的角度；手煞車鎖住後輪也會；推頭只有一點點叫聲（不畫胎痕）
    const sqM = R && R.air ? 0 : Math.max(smooth01((Math.abs(st.slip) - 0.07) / 0.3) * clamp(u / 9, 0, 1), st.hb * 0.8 * clamp((u - 3) / 7, 0, 1));
    st.skidM += (sqM - st.skidM) * (1 - Math.exp(-h * (sqM > st.skidM ? 18 : 6)));
    const sqA = Math.max(st.skidM, R && R.air ? 0 : Math.min(0.3, st.scrub * 0.06) * clamp(u / 10, 0, 1));
    st.skid += (sqA - st.skid) * (1 - Math.exp(-h * (sqA > st.skid ? 18 : 6)));
  }
  // ---- 第 3 批：甩尾（每一步 physics 叫）：L＝後輪多鬆（手煞車、油門、煞車甩一下、放油門）→ 想要的角度 → 角度像彈簧追過去 ----
  // 回傳給 physics 的（同一個物件，不 new）：wD＝走的方向轉多快（後輪、前輪的側向力、油門的側向分量）、bleed＝甩的時候多掉的速度、fwd＝往前推剩多少、cap＝往前推最多多少、rev＝空轉的轉速
  const DRO = { wD: 0, bleed: 0, fwd: 1, rev: 0, cap: 99 };
  function slide(h, inp, R, u, go, gov, a, aG, ac) {
    DRO.wD = 0; DRO.bleed = 0; DRO.fwd = 1; DRO.rev = 0; DRO.cap = 99;
    if (st.rev || u < 1.5 || st.blocked > 0.3) { st.slip = st.slipV = st.loose = st.dm = 0; st.flick = st.thrMem = st.kickT = st.pwT = 0; return DRO; } // 倒車、停下來、頂著東西：不甩
    const sfc = SLIDE[st.surf] || 1, vg = smooth01((u - 6.2) / 4), air = !!(R && R.air), sA = Math.abs(st.steer); // vg：22 km/h 以下 0（一點都不甩）、36 km/h 以上 1
    let Lt = 0;
    if (!air) {
      if (st.hb > 0) Lt = vg; // 1) 手煞車
      st.pwT = go > 0.85 && sA > 0.7 ? st.pwT + h : 0; // 2) 油門到底＋方向打滿（按住 0.25 秒以上，點一下不算）：輪子出力比抓地大（後驅：一半的抓地；四驅要很大的馬力）
      if (DR.pow > 0 && st.pwT > 0.25) {
        const aE = ((go * gov * Tpk * torqueAt(clamp(xOf(u, st.gear), 0.2, 1)) * GR[st.gear] * fd * 0.88) / RR / m) * dmgP.power, lat = ac / aG;
        const e = DR.rwd ? ((aE * sfc) / (0.5 * aG) - 0.85) * 1.5 + (lat - 1) * 0.8 : ((aE * sfc) / aG - 0.75) * 1.5 + (lat - 1.1) * 0.5;
        if (e > 0) Lt = Math.max(Lt, Math.min(1, e) * DR.pow * vg);
      }
      if (!DR.ofr) {
        st.flick = inp.brk > 0.8 && u > 13 ? 0.6 : Math.max(0, st.flick - h); // 3) 用力煞車（或剛放開）馬上把方向打滿：甩一下
        if (st.flick > 0 && sA > 0.85 && st.sPrev <= 0.85 && u > 12) { st.kick = (DR.rwd ? 0.75 : 0.6) * Math.min(1.3, sfc) * vg; st.kickT = 0.35; st.flick = 0; }
        st.thrMem = inp.thr > 0.75 ? 0.3 : Math.max(0, st.thrMem - h); // 4) 很快過彎（推頭）突然放油門：後輪變輕
        if (st.thrMem > 0 && inp.thr < 0.1 && inp.brk < 0.1 && u > 22 && st.push > 0.2 && sA > 0.7) { st.kick = (DR.rwd ? 0.6 : 0.42) * Math.min(1.3, sfc); st.kickT = 0.35; st.thrMem = 0; }
      }
      st.sPrev = sA;
      if (st.kickT > 0) { Lt = Math.max(Lt, st.kick); st.kickT -= h; } // 甩一下、放油門：鬆 0.35 秒
    }
    // 方向：已經在甩＝甩的那邊；還沒＝方向盤那邊；s：往甩的方向按（1，撐住）、放開（0，慢慢抓回來）、反方向（−1，很快拉直）
    const d0 = st.slip > 0.05 ? 1 : st.slip < -0.05 ? -1 : 0, d = d0 || (sA > 0.15 ? Math.sign(st.steer) : 0), s = st.steer * d;
    let L = st.loose;
    if (!air) {
      const Ls = d0 ? go * DR.sus * Math.min(1.4, sfc) * clamp(s, 0, 1) * vg : 0, tg = Math.max(Ls, Lt); // 踩著油門撐住
      if (Lt > L) L = toward(L, Lt, h * (st.hb > 0 || st.kickT > 0 ? 9 : 2.5));
      else if (L > tg) L = toward(L, tg, ((h * DR.dec) / Math.sqrt(sfc)) * (s < -0.3 ? 2 : 1) * (1 + 3 * (1 - vg)));
      st.loose = L;
    }
    // 想要的角度：最大的角度（滑的路面大一點、很快的時候小一點、拉著手煞車大一點）× 多鬆 × 方向盤
    const am = DR.amax * (1 + 0.3 * (Math.min(1.7, sfc) - 1)) * (1 - 0.45 * clamp((u - 22) / 30, 0, 1)) * (1 + 0.4 * st.hb * vg);
    const bT = d * Math.min(am, am * L * (s >= 0 ? 0.3 + 0.7 * s : 0.3 * (1 + s)) * (DR.rwd ? 0.8 + 0.25 * go : 0.92 + 0.08 * go));
    if (air) st.slipV = 0; // 飛在空中：角度不變
    else {
      const wn = 6.5 - 2.8 * L + (s < -0.3 ? 2 : 0), ze = 0.9 - 0.35 * L, ex = Math.abs(st.slip) - am;
      st.slipV += (wn * wn * (bT - st.slip) - 2 * ze * wn * st.slipV) * h;
      if (ex > 0 && st.slip * st.slipV > 0) st.slipV *= Math.exp(-h * (12 + 120 * ex)); // 超過最大的角度：自動反打（不會打轉）
      st.slip += st.slipV * h;
      if (Math.abs(st.slip) > am + 0.45) { st.slip = Math.sign(st.slip) * (am + 0.45); st.slipV = 0; }
      if (L === 0 && Math.abs(st.slip) < 0.004 && Math.abs(st.slipV) < 0.02) st.slip = st.slipV = 0; // 抓回來了：完全回到原本的算法
    }
    const dm = (st.dm = smooth01(Math.abs(st.slip) / 0.14));
    if (dm > 0 && !air) {
      const fr = 0.5 * aG * (1 - 0.35 * L) * sat(st.slip / 0.1), dR = st.steer * 0.32, ff = 0.5 * aG * sat(dR / 0.15), aD = a * (1 - 0.3 * L * DR.bias);
      DRO.wD = -(fr + ff + aD * Math.sin(st.slip)) / Math.max(3, u);
      DRO.bleed = 0.55 * (Math.abs(fr * Math.sin(st.slip)) + Math.abs(ff * Math.sin(dR))) * dm; DRO.cap = (DR.rwd ? 0.32 : 0.26) * aG * Math.cos(st.slip);
      DRO.fwd = Math.cos(st.slip) * (1 - 0.3 * L * DR.bias); DRO.rev = 0.12 * go * L * DR.bias;
    }
    return DRO;
  }
  function springs(h) { // 車身：轉彎往外傾、加速抬頭、煞車點頭（彈簧）；草地、稻田抖一抖
    st.jitT -= h; if (st.jitT <= 0) { st.jitT = 0.09 + Math.random() * 0.06; st.jit = st.surf === 1 || st.surf === 2 ? (Math.random() - 0.5) * 0.014 * Math.min(1, Math.abs(st.v) / 3) : 0; }
    const rT = clamp(-0.0053 * st.alat, -0.06, 0.06) + st.jit * 0.6, pT = clamp(0.0042 * st.along, -0.045, 0.035) + st.jit;
    st.rollV += (90 * (rT - st.roll) - 11 * st.rollV) * h; st.roll += st.rollV * h;
    st.pitchV += (90 * (pT - st.pitch) - 11 * st.pitchV) * h; st.pitch += st.pitchV * h;
  }

  // ---- 自動停車（到了起跑線、改車廠）：沿著一條平滑的曲線開過去 ----
  function stepAuto(dt) {
    const A = auto; A.t = Math.min(A.T, A.t + dt); const s = ease(A.t / A.T);
    let x, z, th;
    if (A.curve) {
      const s2 = s * s, s3 = s2 * s, h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
      const d00 = 6 * s2 - 6 * s, d10 = 3 * s2 - 4 * s + 1, d01 = -6 * s2 + 6 * s, d11 = 3 * s2 - 2 * s;
      x = h00 * A.x0 + h10 * A.k * A.f0[0] + h01 * A.x1 + h11 * A.k * A.f1[0]; z = h00 * A.z0 + h10 * A.k * A.f0[1] + h01 * A.z1 + h11 * A.k * A.f1[1];
      const tx = d00 * A.x0 + d10 * A.k * A.f0[0] + d01 * A.x1 + d11 * A.k * A.f1[0], tz = d00 * A.z0 + d10 * A.k * A.f0[1] + d01 * A.z1 + d11 * A.k * A.f1[1];
      th = s >= 1 ? A.th1 : Math.hypot(tx, tz) > 1e-6 ? Math.atan2(-tz, tx) : A.th1;
    } else { x = A.x0 + (A.x1 - A.x0) * s; z = A.z0 + (A.z1 - A.z0) * s; th = A.th0 + wrapA(A.th1 - A.th0) * s; }
    const mx = x - st.x, mz = z - st.z, ds = Math.hypot(mx, mz) * (mx * Math.cos(th) - mz * Math.sin(th) >= 0 ? 1 : -1);
    const dth = wrapA(th - st.th);
    st.kap = Math.abs(ds) > 1e-4 ? clamp(-dth / ds, -0.3, 0.3) : 0; st.steer = clamp(st.kap * 3, -1, 1);
    st.v = ds / dt; st.spin += ds; st.x = x; st.z = z; st.th = wrapA(th); st.rev = false; st.gear = 0; st.thrEff = 0.25; st.load = 0.3;
    st.rpm += (0.13 + Math.min(0.2, Math.abs(st.v) * 0.04) - st.rpm) * 0.2; st.alat = st.v * st.v * st.kap; st.along = 0;
    for (let i = 0, n = Math.ceil(dt * HZ); i < n; i++) springs(dt / n);
    if (A.t >= A.T) { st.v = 0; st.kap = 0; st.steer = 0; st.thrEff = 0; st.load = 0; auto = null; if (A.onDone) events.push(['done', A.onDone]); }
  }

  // ---- 車子擺到畫面上 ----
  function pose() {
    car.position.set(st.x, 0, st.z); car.rotation.set(0, st.th, 0);
    S.wheels.forEach((wh, i) => { wh.rotation.z = (i % 2 === 0 ? 1 : -1) * (st.spin / (i < 2 ? RF : RR)); });
    const d = Math.atan(st.kap * L), vis = (st.steer < 0 ? -1 : 1) * Math.max(Math.abs(d), Math.abs(st.steer) * (0.2 - 0.12 * Math.min(1, Math.abs(st.v) / 60))); // 右轉（steer > 0）前輪朝 +z；快的時候看起來轉少一點
    const vd = st.dm > 0 ? vis + (clamp(st.steer * 0.32 - st.slip, -0.62, 0.62) - vis) * st.dm : vis; // 第 3 批：甩尾的時候前輪朝走的方向（看得到反打）
    hubs[0].rotation.y = hub0[0] - vd; hubs[1].rotation.y = hub0[1] - vd;
    body.rotation.x = st.roll; body.rotation.z = st.pitch;
    body.position.z = base.bz - 0.45 * Math.sin(st.roll); body.position.x = base.bx + 0.45 * Math.sin(st.pitch); // 繞離地 0.45 公尺那點轉（不動 y：y 是車高）
    const cx = st.x + Math.cos(st.th) * CX, cz = st.z - Math.sin(st.th) * CX;
    fx.shadow.position.set(cx, 0.06, cz); fx.shadow.rotation.y = st.th;
    if (ride && ride.on) ride.pose(vd, fx.shadow, cx, cz); // 第 4 批：高度、傾斜、懸吊、四輪轉向、影子貼地
  }
  function zones(silent) { // 每一步都算（300 km/h 一幀走 1.4 公尺，窄的範圍也不會跳過去）
    const cx = st.x + Math.cos(st.th) * CX, cz = st.z - Math.sin(st.th) * CX; let cur = null;
    for (const k in places) {
      const p = places[k]; if (!p || !p.zone) continue;
      const inside = inRect(p.zone, cx, cz, zoneIn[k] ? 2.5 : 0); if (inside && !cur) cur = k; // 出去要多出 2.5 公尺才算（在邊上晃不會一直進進出出）
      if (inside !== !!zoneIn[k]) { zoneIn[k] = inside; if (!silent) events.push(['zone', k, inside]); }
    }
    zoneNow = cur;
  }
  const placeAt = (p) => (p.zone ? [p.zone.x, p.zone.z] : p.pos ? [p.pos[0], p.pos[1]] : p.spawn ? [p.spawn.x, p.spawn.z] : null);
  function routeTick(dt, force) {
    routeT -= dt;
    const p = dest && places[dest];
    if (!p) { routeData = null; routeS = 0; return; }
    const cx = st.x + Math.cos(st.th) * CX, cz = st.z - Math.sin(st.th) * CX;
    if (routeT > 0 && !force) { if (routeData) routeS = walked(routeData.pts, cx, cz); return; }
    routeT = clamp(8 / Math.max(1, Math.abs(st.v)), 0.08, 0.3); // 快的時候常算（一次最多走 8 公尺）
    let r = null;
    try { r = world.route ? world.route(cx, cz, dest) : null; } catch { r = null; }
    if (!r || !Array.isArray(r.pts) || r.pts.length < 2 || !(r.len >= 0)) { // 路線不認得這個地方：直直指過去
      const q = placeAt(p); r = q ? { pts: [[cx, cz], q], len: Math.hypot(q[0] - cx, q[1] - cz), straight: true } : null;
    }
    routeData = r; routeS = 0;
  }
  // 路線是剛剛從那時候的位置算的：車子現在走到路線上的哪裡（公尺；只找前面 40 公尺，繞回來的路線不會跳過去）
  const walked = (pts, x, z) => {
    let best = Infinity, s = 0, acc = 0;
    for (let i = 1; i < pts.length && acc < 40; i++) {
      const ax = pts[i - 1][0], az = pts[i - 1][1], dx = pts[i][0] - ax, dz = pts[i][1] - az, l2 = dx * dx + dz * dz, l = Math.sqrt(l2);
      const t = l2 > 0 ? clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) : 0, ex = ax + dx * t - x, ez = az + dz * t - z;
      if (ex * ex + ez * ez < best) { best = ex * ex + ez * ez; s = acc + l * t; }
      acc += l;
    }
    return s;
  };
  const along = (pts, d) => { // 路線上往前 d 公尺的點
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d <= l && l > 0) return [pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * d) / l, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * d) / l]; d -= l; }
    return pts[pts.length - 1];
  };
  const destStyle = (k) => DEST[k] || (places[k] ? { label: '去' + (places[k].name || k), icon: String(places[k].name || k).slice(0, 1), bg: '#3A3D44', fg: '#F2F3F5' } : null); // 沒寫的地方：「去＋名字」

  // ---- 影子、目的地光柱 ----
  const fx = (() => {
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    const [c1, g1] = mk(128, 64); g1.shadowColor = 'rgba(0,0,0,0.9)'; g1.shadowBlur = 12; g1.shadowOffsetX = 400; g1.fillStyle = '#000'; g1.beginPath(); g1.roundRect ? g1.roundRect(18 - 400, 13, 92, 38, 16) : g1.rect(18 - 400, 13, 92, 38); g1.fill();
    const t1 = new THREE.CanvasTexture(c1); t1.colorSpace = THREE.SRGBColorSpace;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(info.len + 0.8, info.halfW * 2 + 0.8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t1, transparent: true, depthWrite: false, opacity: 0.62 }));
    shadow.renderOrder = 1; shadow.name = 'drive-shadow';
    const [c2, g2] = mk(4, 128), gr = g2.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0.95)');
    g2.fillStyle = gr; g2.fillRect(0, 0, 4, 128);
    const t2 = new THREE.CanvasTexture(c2); t2.colorSpace = THREE.SRGBColorSpace;
    const add = (map) => new THREE.MeshBasicMaterial({ map, color: 0xff7a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false }); // 加法混色：正反面一次畫完（少一個 draw call）
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 34, 24, 1, true).translate(0, 17, 0), add(t2));
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.3, 3.0, 48).rotateX(-Math.PI / 2), add(null)); ring.position.y = 0.08;
    pillar.renderOrder = ring.renderOrder = 4;
    const beacon = new THREE.Group(); beacon.name = 'drive-beacon'; beacon.add(pillar, ring); beacon.visible = false;
    if (scene) scene.add(shadow, beacon);
    return { shadow, beacon, ring, pillar, texs: [t1, t2] };
  })();
  function beaconTick() {
    const p = dest && places[dest], q = p && placeAt(p), show = !!q && !paused && zoneNow !== dest;
    fx.beacon.visible = show; if (!show) return;
    fx.beacon.position.set(q[0], world.heightAt ? world.heightAt(q[0], q[1]) : 0, q[1]);
    const k = (now * 0.7) % 1; fx.ring.scale.setScalar(1 + k * 0.7); fx.ring.material.opacity = 1 - k; fx.pillar.material.opacity = 0.75 + 0.25 * Math.sin(now * 3);
  }

  // ---- 鏡頭 ----
  // 追車：越快越往後拉、放低一點、看遠一點、視角變廣（速度感，最多 +12°）；位置跟著車子「相對」平滑（不然 300 km/h 鏡頭會落後 8 公尺）
  // 晃：撞到（shake，照撞的力道）＋200 km/h 以上路面的小震動（幾個不同頻率的正弦，不是每幀亂跳）
  const isCop = (c) => c.police === true && c.t === 'box'; // 第 3 批（b3-int）：警車的碰撞物（鏡頭抬高用）
  const cam = { yaw: st.th, ox: 0, oy: 0, oz: 0, d: 6.5, ok: false, shake: 0, spd: 0, acc: 0, t: 0, cop: 0 }, V1 = new THREE.Vector3(), V2 = new THREE.Vector3();
  const defEye = { eye: [CX - 0.3, 1.12, S.spec.interior?.wheelZ ?? 0.37], look: [CX + 9, 0.95, S.spec.interior?.wheelZ ?? 0.37], fov: 72 };
  const wob = (t, a) => Math.sin(t * 71 + a) * 0.5 + Math.sin(t * 113 + 2 * a + 1.7) * 0.3 + Math.sin(t * 163 + 3 * a + 4.1) * 0.2;
  const setFov = (f) => { if (Math.abs(f - camera.fov) > 0.05) { camera.fov = f; camera.updateProjectionMatrix(); } };
  function camTick(dt) {
    if (!camera || mode === 'none') return;
    const sp = Math.abs(st.v);
    cam.spd += (sp - cam.spd) * (1 - Math.exp(-dt * 1.6)); cam.acc += (clamp(st.along, -12, 12) - cam.acc) * (1 - Math.exp(-dt * 3)); cam.t += dt;
    const q = smooth01((cam.spd - 8) / 72); // 0（30 km/h 以下）→ 1（290 km/h）
    cam.shake *= Math.exp(-dt * 7);
    const shA = (cam.shake + 0.035 * clamp((cam.spd * 3.6 - 200) / 140, 0, 1)) * (calm ? 0.3 : 1), sx = shA * wob(cam.t, 0), sy = shA * wob(cam.t, 2.1), sz = shA * wob(cam.t, 4.3);
    if (mode === 'eye') {
      const v = view || o.eye || defEye; car.updateMatrixWorld(true); // 車子這一幀的位置（不是上一次畫的：300 km/h 一幀差 1.4 公尺）
      camera.position.copy(V1.fromArray(v.eye).applyMatrix4(body.matrixWorld)); camera.lookAt(V2.fromArray(v.look).applyMatrix4(body.matrixWorld));
      camera.position.x += sx * 0.25; camera.position.y += sy * 0.25; camera.position.z += sz * 0.25; // 車裡晃小一點
      setFov((v.fov || 72) + 7 * q);
      return;
    }
    cam.yaw += wrapA(st.th + st.slip * 0.6 - cam.yaw) * (1 - Math.exp(-dt * (2.4 + sp * 0.1))); // 第 3 批：甩尾的時候往走的方向轉一點
    let D = 6.4 + 1.8 * q + clamp(cam.acc * 0.05, -0.3, 0.45), H = 2.35 - 0.4 * q, yaw = cam.yaw; // 用力加速鏡頭落後一點、煞車靠近一點
    const rc = ride && ride.on ? ride.cam(dt) : null; if (rc) { D *= rc.d; H += rc.dh; } // 第 4 批：大車拉遠拉高
    if (intro) { // 出門：鏡頭從車前面繞到後面
      intro.t += dt; if (Math.abs(st.v) > 1.5) intro.t += dt * 2; // 開始開了就快一點繞完
      const k = ease(Math.min(1, intro.t / intro.T)); yaw += intro.a0 * (1 - k); D += (intro.d0 - D) * (1 - k); H += (intro.h0 - H) * (1 - k);
      if (intro.t >= intro.T) intro = null;
    }
    const fx2 = Math.cos(yaw), fz2 = -Math.sin(yaw), px = st.x + Math.cos(st.th) * CX, pz = st.z - Math.sin(st.th) * CX;
    const t = rayHit(px, pz, px - fx2 * D, pz - fz2 * D), d = t < 1 ? Math.max(2.4, D * t - 0.45) : D; // 被房子擋到就拉近一點、抬高一點
    cam.d += (d - cam.d) * (1 - Math.exp(-dt * (d < cam.d ? 14 : 2.5)));
    const ox = -fx2 * cam.d, oz = -fz2 * cam.d, oy = H + (D - cam.d) * 0.35;
    if (!cam.ok) { cam.ox = ox; cam.oy = oy; cam.oz = oz; cam.ok = true; }
    const k2 = 1 - Math.exp(-dt * 10); cam.ox += (ox - cam.ox) * k2; cam.oy += (oy - cam.oy) * k2; cam.oz += (oz - cam.oz) * k2;
    camera.position.set(px + cam.ox + sx, cam.oy + sy * 0.7, pz + cam.oz + sz);
    { // 第 3 批（b3-int）：鏡頭在警車（police: true 的碰撞物）上面或旁邊就抬高（慢慢的），不要穿過車頂的警示燈
      const X = camera.position.x, Z = camera.position.z; let want = 0;
      for (const c of cw.near(X - 1.5, Z - 1.5, X + 1.5, Z + 1.5, isCop)) { const ox = X - c.x, oz = Z - c.z; if (Math.abs(ox * c.u[0] + oz * c.u[1]) < c.hx + 1.1 && Math.abs(ox * c.w[0] + oz * c.w[1]) < c.hz + 1.1) want = Math.max(want, (c.h || 1.6) + 0.9); }
      cam.cop += (want - cam.cop) * (1 - Math.exp(-dt * (want > cam.cop ? 12 : 3))); if (cam.cop > camera.position.y) camera.position.y = cam.cop;
    }
    const la = 3 + 5 * q; camera.lookAt(px + fx2 * la, 1.0 - 0.1 * q, pz + fz2 * la);
    if (rc) { camera.position.y = Math.max(camera.position.y + rc.y, rc.floor(camera.position.x, camera.position.z)); camera.lookAt(px + fx2 * la, 1.0 - 0.1 * q + rc.look + rc.y, pz + fz2 * la); } // 第 4 批：跟著車子的高度、不鑽到地底下
    // 直的長畫面（手機全螢幕，寬÷高 0.6 以下）：上下多看一點（412×915 大約 86°），車子才不會大到擋住路、左右也看得到；0.6 以上照舊
    const tall = 93 * clamp(0.6 - (camera.aspect || 1), 0, 0.2), base = clamp((2 * Math.atan(Math.tan((56 * Math.PI) / 360) / (camera.aspect || 1)) * 180) / Math.PI, 50, 72 + tall);
    setFov(Math.min(86 + tall, base + 12 * q));
  }
  function setCameraMode(m, v) {
    mode = m; if (v) view = v;
    if (camera && m !== 'none') {
      camera.near = m === 'eye' ? 0.05 : 0.2; // 追車的鏡頭離車子至少 2.4 公尺：near 大一點，遠的路面比較不會閃（world 幾公里大）
      if (m === 'eye') camera.fov = (view || o.eye || defEye).fov || 72;
      camera.updateProjectionMatrix(); cam.ok = false; cam.yaw = st.th; cam.d = 6.5;
    }
    if (hud) hud.cam.setAttribute('aria-pressed', String(m === 'eye'));
  }

  // ---- HUD：左上目的地（下面一顆大按鈕）、右上小地圖、下面方向鍵、速度、油門煞車 ----
  const hud = hasDoc ? buildHud() : null;
  function buildHud() {
    if (!document.getElementById('dv-style')) { const s = document.createElement('style'); s.id = 'dv-style'; s.textContent = CSS; document.head.append(s); }
    const root = document.createElement('div'); root.className = 'dv';
    root.innerHTML = `<div class="dv-chip" hidden><i>${ICON.up}</i><b></b><small></small></div><button type="button" class="dv-act" hidden><i></i><span></span><kbd>E</kbd></button><div class="dv-map"><canvas></canvas></div>`
      + `<b class="dv-cam" role="button" aria-label="換視角" aria-pressed="false">${ICON.cam}</b><button type="button" class="dv-act2" hidden><i></i><span></span></button><div class="dv-spd"><b>0</b><span>KM/H</span><em>1</em><i hidden>甩尾<span></span></i></div>`
      + `<div class="dv-steer"><b role="button" aria-label="左轉">${ICON.L}</b><b role="button" aria-label="右轉">${ICON.R}</b></div>`
      + `<div class="dv-ped"><b class="dv-brk" role="button" aria-label="煞車">煞車</b><b class="dv-gas" role="button" aria-label="油門">油門</b></div><div class="dv-toast" role="status"></div>`
      + `<b class="dv-hb" role="button" aria-label="手煞車">手煞車</b>`; // 第 3 批（甩尾）
    o.hudParent.append(root);
    const q = (s) => root.querySelector(s), H = { root, chip: q('.dv-chip'), arrow: q('.dv-chip svg'), name: q('.dv-chip b'), dist: q('.dv-chip small'), map: q('.dv-map canvas'), cam: q('.dv-cam'),
      act: q('.dv-act'), actIcon: q('.dv-act i'), actText: q('.dv-act span'), act2: q('.dv-act2'), act2Icon: q('.dv-act2 i'), act2Text: q('.dv-act2 span'),
      spd: q('.dv-spd b'), gear: q('.dv-spd em'), steer: q('.dv-steer'), steerB: [...root.querySelectorAll('.dv-steer b')], gas: q('.dv-gas'), brk: q('.dv-brk'), toast: q('.dv-toast'), off: [] };
    if (o.camButton === false) H.cam.hidden = true;
    H.hb = q('.dv-hb'); H.drift = q('.dv-spd i'); H.driftA = q('.dv-spd i span'); // 第 3 批
    const on = (el, t, f, opt) => { el.addEventListener(t, f, opt); H.off.push(() => el.removeEventListener(t, f, opt)); };
    on(root, 'contextmenu', (e) => e.preventDefault());
    // 按住：手指按下去就抓住（滑出去也算按著），放開才放
    const hold = (el, down, up) => {
      on(el, 'pointerdown', (e) => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch { /* 沒有就算了 */ } down(e); });
      on(el, 'pointermove', (e) => { if (el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) down(e, true); });
      for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) on(el, t, (e) => up(e));
    };
    hold(H.gas, () => { human.thr = 1; H.gas.classList.add('on'); }, () => { human.thr = 0; H.gas.classList.remove('on'); });
    hold(H.brk, () => { human.brk = 1; H.brk.classList.add('on'); }, () => { human.brk = 0; H.brk.classList.remove('on'); });
    hold(H.hb, () => { human.hb = 1; H.hb.classList.add('on'); }, () => { human.hb = 0; H.hb.classList.remove('on'); }); // 第 3 批：手煞車（另一隻手指按著油門、方向也按得到）
    const fingers = new Map(), steerNow = () => { let s = 0; for (const v of fingers.values()) s = v; human.steer = s; H.steerB[0].classList.toggle('on', s < 0); H.steerB[1].classList.toggle('on', s > 0); };
    hold(H.steer, (e) => { const r = H.steer.getBoundingClientRect(); fingers.delete(e.pointerId); fingers.set(e.pointerId, e.clientX < r.left + r.width / 2 ? -1 : 1); steerNow(); }, (e) => { fingers.delete(e.pointerId); steerNow(); });
    on(H.cam, 'click', () => setCameraMode(mode === 'eye' ? 'chase' : 'eye'));
    // 大按鈕：按下去縮一下，放開（click）才做；另一隻手指按著油門也按得到
    on(H.act, 'pointerdown', () => H.act.classList.add('on'));
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) on(H.act, t, () => H.act.classList.remove('on'));
    on(H.act, 'click', (e) => { e.preventDefault(); doAction(); });
    on(H.act2, 'pointerdown', () => H.act2.classList.add('on'));
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) on(H.act2, t, () => H.act2.classList.remove('on'));
    on(H.act2, 'click', (e) => { e.preventDefault(); doAction2(); });
    // 小地圖：路、稻田、房子先畫在一張大圖上，每幀轉一下貼上去；越快看越遠（150 → 450 公尺）
    const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1), px = Math.round(124 * dpr);
    H.map.width = H.map.height = px; H.mapPx = px; H.dpr = dpr; H.mctx = H.map.getContext('2d'); H.layer = o.mapLayer || mapLayer(); H.mapT = 0; H.span = 150; H.last = {};
    return H;
  }
  function mapLayer() { // 世界幾公里大：一公尺最多 2 個像素、邊長最多 4096、全部最多 400 萬像素（16 MB：手機的記憶體、canvas 有上限）
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
    if (world.mapDraw) world.mapDraw(g); // 第 4 批：越野車場（泥土路、泥巴、石頭、沙）
    g.fillStyle = '#f2f3f5'; g.fillRect(-0.6, -6, 1.2, 12); // 起跑線
    return { c, ms, x0, z0 };
  }
  function drawMap(dt) {
    const H = hud, g = H.mctx, s = H.mapPx, cx = st.x + Math.cos(st.th) * CX, cz = st.z - Math.sin(st.th) * CX, oy = s * 0.13, rot = st.th - Math.PI / 2;
    H.span += (150 + 300 * smooth01((Math.abs(st.v) * 3.6 - 60) / 190) - H.span) * (1 - Math.exp(-dt * 1.5));
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
    // 地方（字是正的；地圖外面的就貼在邊上）：有自己顏色的都畫，其他的只畫目的地
    const cs = Math.cos(rot), sn = Math.sin(rot), R = s / 2 - 13 * H.dpr, ic = [];
    for (const key in places) {
      const p = places[key], d = DEST[key] || (key === dest ? destStyle(key) : null), q = d && placeAt(p); if (!q) continue;
      const wx = q[0] - cx, wz = q[1] - cz;
      let sx = (wx * cs - wz * sn) * k, sy = (wx * sn + wz * cs) * k + oy; const l = Math.max(Math.abs(sx), Math.abs(sy));
      if (l > R) { sx *= R / l; sy *= R / l; }
      ic.push({ key, d, sx, sy, r: (key === dest ? 11 : 9) * H.dpr });
    }
    ic.sort((a, b) => (a.key === dest) - (b.key === dest)); // 目的地最後畫（在最上面）
    for (let i = 0; i < ic.length; i++) for (let j = i + 1; j < ic.length; j++) { // 兩個貼在同一個地方：先畫的那個沿著邊挪開
      const a = ic[i], b = ic[j], need = a.r + b.r + 2 * H.dpr; if (Math.hypot(a.sx - b.sx, a.sy - b.sy) >= need) continue;
      const ax = Math.abs(a.sx) >= Math.abs(a.sy) ? 'sy' : 'sx', sg = Math.sign(a[ax] - b[ax]) || 1;
      a[ax] = b[ax] + sg * need; if (Math.abs(a[ax]) > R) a[ax] = b[ax] - sg * need;
    }
    for (const { key, d, sx, sy, r } of ic) {
      g.beginPath(); g.arc(s / 2 + sx, s / 2 + sy, r, 0, TAU); g.fillStyle = d.bg; g.fill(); g.lineWidth = 2 * H.dpr; g.strokeStyle = key === dest ? '#FF6A1F' : 'rgba(242,243,245,0.85)'; g.stroke();
      g.fillStyle = d.fg; g.font = `700 ${Math.round(r * 1.15)}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d.icon, s / 2 + sx, s / 2 + sy + 0.5 * H.dpr);
    }
    // 第 3 批（b3-int）：別的模組給的點（警車⋯）：小圓點；地圖外面的貼在邊上；on: false 的不畫
    if (marks) for (let i = 0; i < marks.length; i++) {
      const m = marks[i]; if (!m || m.on === false) continue;
      const wx = m.x - cx, wz = m.z - cz; let sx = (wx * cs - wz * sn) * k, sy = (wx * sn + wz * cs) * k + oy; const l = Math.max(Math.abs(sx), Math.abs(sy));
      if (l > R) { sx *= R / l; sy *= R / l; }
      g.beginPath(); g.arc(s / 2 + sx, s / 2 + sy, (m.r || 5) * H.dpr, 0, TAU); g.fillStyle = m.fill || '#FF3B30'; g.fill();
      if (m.ring) { g.lineWidth = 1.5 * H.dpr; g.strokeStyle = m.ring; g.stroke(); }
    }
    // 你：中間偏下的箭頭（永遠朝上）
    const u = H.dpr; g.translate(s / 2, s / 2 + oy); g.beginPath(); g.moveTo(0, -9 * u); g.lineTo(7 * u, 7 * u); g.lineTo(0, 3.5 * u); g.lineTo(-7 * u, 7 * u); g.closePath();
    g.fillStyle = '#F2F3F5'; g.fill(); g.lineWidth = 2 * u; g.strokeStyle = '#FF6A1F'; g.stroke(); g.setTransform(1, 0, 0, 1, 0, 0);
  }
  function hudTick(dt) {
    const H = hud; if (!H) return;
    const kmh = Math.round(Math.abs(st.v) * 3.6), gear = st.rev ? 'R' : String(st.gear + 1), set = (k, v, f) => { if (H.last[k] !== v) { H.last[k] = v; f(v); } };
    set('spd', kmh, (v) => (H.spd.textContent = v)); set('gear', gear, (v) => { H.gear.textContent = v; H.gear.classList.toggle('r', v === 'R'); });
    set('rev', st.rev, (v) => { H.brk.textContent = v ? '倒車' : '煞車'; H.brk.classList.toggle('rev', v); });
    const dd = dest && destStyle(dest); set('dest', dest, () => { H.chip.hidden = !dd; if (dd) H.name.textContent = dd.label; });
    if (dd && routeData) {
      const here = zoneNow === dest; set('here', here, (v) => { H.chip.classList.toggle('here', v); H.arrow.innerHTML = v ? '<path d="M5 12.5l4.5 4.5L19.5 7" fill="none" stroke="#0E0F12" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>' : ICON.up.replace(/<\/?svg[^>]*>/g, ''); });
      const cx = st.x + Math.cos(st.th) * CX, cz = st.z - Math.sin(st.th) * CX, la = along(routeData.pts, routeS + 14), rel = wrapA(Math.atan2(-(la[1] - cz), la[0] - cx) - st.th), left = Math.max(0, routeData.len - routeS);
      H.arrow.style.transform = here ? '' : `rotate(${Math.round((-rel * 180) / Math.PI)}deg)`;
      set('dist', here ? '到了！' : left < 25 ? '就在前面' : left >= 995 ? `${(left / 1000).toFixed(1)} km` : `${Math.round(left / 10) * 10} m`, (v) => (H.dist.textContent = v));
    }
    H.mapT -= dt; if (H.mapT <= 0) { drawMap(1 / 30 - H.mapT); H.mapT = 1 / 30; }
    // 第 3 批：「甩尾 35°」：甩超過 0.25 秒才出來、抓回來 0.6 秒以後才收（角度一秒最多換 10 次、5° 一格）
    if (st.dT >= 0.25) st.dShow = 0.6; else st.dShow = Math.max(0, st.dShow - dt);
    set('drift', st.dShow > 0, (v) => (H.drift.hidden = !v));
    if (st.dT >= 0.25) { H.dA = (H.dA || 0) - dt; if (H.dA <= 0) { H.dA = 0.1; set('dA', Math.max(10, Math.round((Math.abs(st.slip) * 180) / Math.PI / 5) * 5), (v) => (H.driftA.textContent = v + '°')); } }
  }
  let toastT = 0;
  function toast(text, ms = 1600) { if (!hud) return; hud.toast.textContent = text; hud.toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => hud && hud.toast.classList.remove('show'), ms); }
  // HUD 的大按鈕（開鐵捲門⋯）：字、圖一樣就不動畫面，onClick 永遠換成最新的
  function setAction(a) {
    const next = a && a.label ? { label: String(a.label), onClick: a.onClick, icon: ICON[a.icon] ? a.icon : 'hand' } : null;
    const same = !!action && !!next && action.label === next.label && action.icon === next.icon;
    action = next;
    if (!hud || same) return;
    hud.act.hidden = !next; hud.act.classList.remove('on');
    if (next) { hud.actText.textContent = next.label; hud.actIcon.innerHTML = ICON[next.icon]; hud.act.setAttribute('aria-label', next.label); }
  }
  function doAction() {
    if (!action || paused || !alive) return;
    const f = action.onClick; if (typeof f === 'function') f(api);
  }
  // 第二顆（右邊的深色按鈕，例如「下車」）：跟大按鈕一樣，字、圖一樣就不動畫面
  function setAction2(a) {
    const next = a && a.label ? { label: String(a.label), onClick: a.onClick, icon: ICON[a.icon] ? a.icon : 'walk' } : null;
    const same = !!action2 && !!next && action2.label === next.label && action2.icon === next.icon;
    action2 = next;
    if (!hud || same) return;
    hud.act2.hidden = !next; hud.act2.classList.remove('on');
    if (next) { hud.act2Text.textContent = next.label; hud.act2Icon.innerHTML = ICON[next.icon]; hud.act2.setAttribute('aria-label', next.label); }
  }
  function doAction2() {
    if (!action2 || paused || !alive) return;
    const f = action2.onClick; if (typeof f === 'function') f(api);
  }

  // ---- 鍵盤 ----
  const KEYS = { ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D', ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', Space: 'B' };
  const onKey = (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = KEYS[e.code], down = e.type === 'keydown';
    if (k) { if (!paused) e.preventDefault(); human.kb[k] = down; }
    else if (down && e.code === 'KeyC' && !e.repeat && !paused) setCameraMode(mode === 'eye' ? 'chase' : 'eye');
    else if (down && e.code === 'KeyE' && !e.repeat && !paused && (action || action2)) { e.preventDefault(); if (action) doAction(); else doAction2(); } // 沒有大按鈕：按第二顆（下車）
  };
  const onBlur = () => { human.kb = {}; };
  const useKeys = o.keyboard !== false && typeof window !== 'undefined' && window.addEventListener;
  if (useKeys) { window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('blur', onBlur); }
  const input = () => {
    if (forced) return forced;
    const k = human.kb; return { thr: Math.max(k.U ? 1 : 0, human.thr), brk: Math.max(k.D ? 1 : 0, human.brk), hb: Math.max(k.B ? 1 : 0, human.hb), steer: clamp((k.R ? 1 : 0) - (k.L ? 1 : 0) + human.steer, -1, 1) };
  };

  // ---- 第 3 批（甩尾）：胎痕、輪胎的煙（場景共用的 skidFx）、輪胎叫（audio.skid）：每幀 ----
  // 四個輪子：在地上的位置一直跟著，夠鬆就每 0.35 公尺畫一段（後輪；甩很大前輪也畫）；後輪冒煙；輪胎叫一秒最多送 20 次、有變才送
  const SK = scene ? skidFx(scene) : null, SKW = [[W.xf, W.trackF, W.wF], [W.xf, -W.trackF, W.wF], [W.xr, W.trackR, W.wR], [W.xr, -W.trackR, W.wR]]
    .map(([x, z, w]) => ({ x, z: z || 0.75 * Math.sign(z || 1), hw: (w || 0.24) * 0.45, on: false, e: false, px: 0, pz: 0, lx: 0, lz: 0, ly: 0, rx: 0, rz: 0, ry: 0, a: 0, acc: 0 }));
  const sndK = { t: 0, l: 0, p: 0 }, gy = (x, z) => (ride && ride.on ? ride.ground(x, z) + 0.04 : 0.04); // 胎痕的高度：村子的路面上面一點點（地上的標線、油漬再上面）；地形照地面
  // 第 3 批（b3-int）：0.045 → 0.04：賽車場的柏油 0.03、白線／路肩 0.045（circuit.js 的 Y），胎痕夾在中間（跟白線同高會閃）
  function fxTick(dt) {
    if (SK) {
      const F = SK; F.U.now.value += dt; if (F.marks.parent !== scene) scene.add(F.marks, F.smoke);
      const lv = paused ? 0 : st.skidM, c = Math.cos(st.th), s = Math.sin(st.th), look = SKID.look[SKID.kind[st.surf] || 0], big = smooth01((Math.abs(st.slip) - 0.3) / 0.3);
      const ph = st.th + st.slip, vx = Math.cos(ph) * st.v, vz = -Math.sin(ph) * st.v;
      for (let i = 0; i < 4; i++) {
        const w = SKW[i], k = i < 2 ? lv * big * 0.8 : lv, x = st.x + c * w.x + s * w.z, z = st.z - s * w.x + c * w.z;
        if (k < 0.08) { w.on = false; w.acc = 0; continue; }
        if (!w.on) { w.on = true; w.e = false; w.px = x; w.pz = z; continue; }
        const dx = x - w.px, dz = z - w.pz, d2 = dx * dx + dz * dz;
        if (d2 > 4) { w.e = false; w.px = x; w.pz = z; continue; } // 一下跳很遠（傳送）：重新開始
        if (d2 >= 0.1225) {
          const dl = Math.sqrt(d2), nx = (-dz / dl) * w.hw, nz = (dx / dl) * w.hw, lx = x + nx, lz = z + nz, rx = x - nx, rz = z - nz;
          if (!w.e) { w.lx = w.px + nx; w.lz = w.pz + nz; w.rx = w.px - nx; w.rz = w.pz - nz; w.ly = gy(w.lx, w.lz); w.ry = gy(w.rx, w.rz); w.a = 0; }
          const ly = gy(lx, lz), ry = gy(rx, rz);
          F.seg(w.lx, w.lz, w.ly, w.rx, w.rz, w.ry, lx, lz, ly, rx, rz, ry, w.a, k, look.m);
          w.lx = lx; w.lz = lz; w.ly = ly; w.rx = rx; w.rz = rz; w.ry = ry; w.e = true; w.a = k; w.px = x; w.pz = z;
        }
        if (i >= 2 && k > 0.2 && Math.abs(st.v) > 2) { // 煙：後輪
          w.acc += dt * 24 * k * look.z;
          while (w.acc >= 1) {
            w.acc -= 1; const r1 = Math.random();
            F.puff(x + (Math.random() - 0.5) * 0.3, gy(x, z) + 0.2, z + (Math.random() - 0.5) * 0.3, vx * 0.25 + (Math.random() - 0.5) * 1.2, 0.15 + 0.3 * r1, vz * 0.25 + (Math.random() - 0.5) * 1.2,
              (1.5 + 0.9 * Math.random()) * (0.8 + 0.4 * k), 0.5 * look.z, (1.4 + 1.4 * k) * look.z, look.s, look.s[3] * (0.55 + 0.45 * k));
          }
        }
      }
      F.flush();
    }
    const au = o.audio;
    if (au && typeof au.skid === 'function') {
      sndK.t -= dt; const lv = paused ? 0 : Math.round(st.skid * 20) / 20, pi = clamp(Math.abs(st.slip) / 0.8 + Math.abs(st.v) / 90, 0, 1);
      if (sndK.t <= 0 && (Math.abs(lv - sndK.l) > 0.04 || (lv > 0 && Math.abs(pi - sndK.p) > 0.08) || (lv === 0 && sndK.l !== 0))) { sndK.t = 0.05; sndK.l = lv; sndK.p = pi; try { au.skid(lv, pi, SKID.kind[st.surf] > 0); } catch { /* 算了 */ } }
    }
  }
  function fxOff() { // 停下來（下車、暫停）：煙藏起來、輪胎不叫（胎痕留在地上）
    if (SK) SK.smoke.visible = false; for (const w of SKW) { w.on = false; w.acc = 0; }
    if (sndK.l !== 0 && o.audio && typeof o.audio.skid === 'function') { try { o.audio.skid(0); } catch { /* 算了 */ } } sndK.l = 0;
  }

  // ---- 每一幀 ----
  function update(dt) {
    if (!alive || paused) return;
    dt = Math.min(0.1, Math.max(0, +dt || 0)); if (!dt) return;
    now += dt;
    if (auto) { stepAuto(dt); if (ride) ride.follow(dt); zones(false); }
    else {
      st.surf = world.surfaceAt ? world.surfaceAt(st.x + Math.cos(st.th) * CX, st.z - Math.sin(st.th) * CX) : 0;
      // 每步最少 1/120 秒、最多走 STEP 公尺（碰撞不會穿過去）
      const inp = input(), n = Math.max(1, Math.ceil(dt * HZ - 1e-6), Math.ceil(((Math.abs(st.v) + 15 * dt) * dt) / STEP)), h = dt / n;
      for (let i = 0; i < n; i++) { physics(h, inp); collide(); springs(h); if (ride) ride.step(h); zones(false); }
    }
    if (Math.abs(st.slip) > 0.175) { if (st.dT < 0.25 && st.dT + dt >= 0.25) st.drifts++; st.dT += dt; } else st.dT = 0; // 第 3 批：甩 10° 以上超過 0.25 秒＝甩了一次
    // 撞到：這一幀最大的一下（0.25 秒內只算一次）→ 鏡頭晃、onBump
    if (st.hitW > 1.2 && now - st.hitT > 0.25) { st.bumps++; st.hitT = now; cam.shake = Math.max(cam.shake, Math.min(0.32, st.hitW * 0.012)); events.push(['bump', st.hitW]); }
    st.hitW = 0;
    if (imp) { if (now - st.impT > 0.2 || imp.speed > st.impW * 1.5 + 1) { st.impT = now; st.impW = imp.speed; events.push(['impact', imp]); } imp = null; }
    pose(); routeTick(dt); beaconTick(); camTick(dt); hudTick(dt);
    fxTick(dt); // 第 3 批：胎痕、煙、輪胎叫
    // 事件最後才叫（叫的時候車子、鏡頭都已經是這一幀的樣子）
    const ev = events.splice(0);
    for (const e of ev) {
      if (e[0] === 'zone' && o.onZone) o.onZone(e[1], e[2], places[e[1]]);
      else if (e[0] === 'shift' && o.onShift) o.onShift(e[1]);
      else if (e[0] === 'bump' && o.onBump) o.onBump(e[1]);
      else if (e[0] === 'land') { cam.shake = Math.max(cam.shake, Math.min(0.3, e[1].speed * 0.025)); if (o.onLand) o.onLand(e[1]); } // 第 4 批：落地
      else if (e[0] === 'impact' && o.onImpact) o.onImpact(e[1]);
      else if (e[0] === 'done') e[1]();
    }
  }
  function neutral() {
    st.slip = st.slipV = st.loose = st.dm = st.skid = st.skidM = st.flick = st.thrMem = st.kickT = st.pwT = st.dT = st.dShow = st.hb = 0; // 第 3 批：不甩
    st.roll = st.rollV = st.pitch = st.pitchV = st.kap = st.steer = st.v = st.scrub = st.push = 0; st.thr = st.brk = st.thrEff = st.load = 0; st.rpm = 0.13; st.hitW = st.touch = st.blocked = 0;
    body.rotation.x = 0; body.rotation.z = 0; body.position.x = base.bx; body.position.z = base.bz; hubs.forEach((hb, i) => (hb.rotation.y = hub0[i]));
  }
  function setHidden(h) { if (hud) hud.root.hidden = h; fx.shadow.visible = !h; if (h) fx.beacon.visible = false; }
  function teleport(p, op = {}) {
    auto = null; events.length = 0;
    st.x = p.x; st.z = p.z; st.th = p.heading ?? 0; st.gear = 0; st.rev = false; st.hold = 0; st.cut = 0; neutral();
    if (ride) ride.reset(); // 第 4 批
    pose(); zones(true); routeTick(0, true); cam.ok = false; cam.yaw = st.th; cam.d = 6.5; cam.spd = 0; cam.acc = 0; cam.shake = 0;
    intro = op.intro ? { t: 0, T: 3.4, a0: 2.8, d0: 8.5, h0: 1.45 } : null;
    if (camera && mode !== 'none') camTick(1 / 60);
  }
  function parkAt(p, onDone) {
    const th1 = p.heading ?? 0, f1 = [Math.cos(th1), -Math.sin(th1)], f0 = [Math.cos(st.th), -Math.sin(st.th)];
    const x1 = p.noseX != null ? p.noseX - f1[0] * info.nose : p.x, z1 = p.noseX != null ? p.z - f1[1] * info.nose : p.z;
    const dx = x1 - st.x, dz = z1 - st.z, dist = Math.hypot(dx, dz);
    auto = { t: 0, T: clamp(dist / 4.5 + 0.5, 0.6, 3.2), x0: st.x, z0: st.z, th0: st.th, x1, z1, th1, k: dist, f0, f1, onDone, curve: dist > 0.5 && dx * f0[0] + dz * f0[1] > 0 && f0[0] * f1[0] + f0[1] * f1[1] > 0.3 };
    st.rev = false; st.gear = 0; st.hold = 0;
    st.slip = st.slipV = st.loose = st.dm = 0; // 第 3 批：自動停車不甩
  }
  function pause() { paused = true; auto = null; events.length = 0; neutral(); setHidden(true); human.thr = human.brk = human.steer = human.hb = 0; human.kb = {}; fxOff(); if (hud) hud.hb.classList.remove('on'); /* 第 3 批 */ if (hud) { hud.act.classList.remove('on'); hud.act2.classList.remove('on'); } }
  function resume() { if (!alive) return; paused = false; setHidden(false); cam.ok = false; }
  function release() { pause(); if (ride) ride.release(); st.spin = 0; car.position.set(0, 0, 0); car.rotation.set(0, 0, 0); S.wheels.forEach((w) => (w.rotation.z = 0)); car.updateMatrixWorld(true); }
  function setDestination(name) { dest = name && places[name] ? name : null; routeT = 0; routeTick(0, true); if (hud) hud.last.here = undefined; }
  function dispose() {
    if (!alive) return;
    release(); alive = false; action = null; action2 = null; cw.clear();
    if (useKeys) { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('blur', onBlur); }
    if (hud) { hud.off.forEach((f) => f()); hud.root.remove(); }
    clearTimeout(toastT);
    for (const ms of [fx.shadow, fx.pillar, fx.ring]) { ms.removeFromParent(); ms.geometry.dispose(); ms.material.dispose(); }
    fx.beacon.removeFromParent(); fx.texs.forEach((t) => t.dispose());
  }
  const telemetry = () => ({ x: st.x, z: st.z, heading: st.th, v: st.v, kmh: Math.abs(st.v) * 3.6, rpm: st.rpm, gear: st.rev ? -1 : st.gear + 1, throttle: st.cut > 0 ? 0 : st.thrEff, load: paused ? 0 : st.load,
    brake: Math.max(st.rev ? st.thr : st.brk, st.hb), steer: st.steer, surface: st.surf, cap: Math.min(999, Math.round(st.cap * 36) / 10), reversing: st.rev, bumps: st.bumps, shifts: st.shifts, zone: zoneNow, dest, destDist: routeData ? Math.max(0, routeData.len - routeS) : null, auto: !!auto, paused,
    slip: st.slip, travel: wrapA(st.th + st.slip), drift: st.dm, drifting: Math.abs(st.slip) > 0.175, drifts: st.drifts, loose: st.loose, skid: st.skid, handbrake: st.hb > 0 ? 1 : 0, // 第 3 批（甩尾）
    marks: SK ? SK.count() : 0, smoke: SK ? SK.alive() : 0, ...(ride ? ride.tele() : null) });

  const api = {
    update, telemetry, setDestination, setCameraMode, teleport, parkAt, pause, resume, release, dispose, toast, setAction, setAction2,
    addColliders: (list, tag) => cw.add(Array.isArray(list) ? list : [list], tag ?? null),
    removeColliders: (tag) => cw.remove(tag),
    setMarkers: (list) => { marks = Array.isArray(list) ? list : null; }, // 第 3 批（b3-int）
    setDamage: (p) => { dmgP.power = p && p.power > 0 ? Math.min(1, p.power) : 1; dmgP.top = p && p.top > 0 ? Math.min(1, p.top) : 1; dmgP.maxKmh = p && p.maxKmh > 0 ? p.maxKmh : Infinity; dmgP.steerPull = p ? clamp(+p.steerPull || 0, -1, 1) : 0; },
    setInput: (i) => { forced = i ? { thr: +i.throttle || 0, brk: +i.brake || 0, hb: +i.handbrake || 0, steer: clamp(+i.steer || 0, -1, 1) } : null; },
    get cameraMode() { return mode; }, get route() { return routeData; }, get action() { return action ? action.label : null; }, get action2() { return action2 ? action2.label : null; },
    carInfo: { nose: info.nose, tail: info.tail, len: info.len, halfW: Math.max(info.halfW, +o.halfW || 0), wheelbase: L, vmax: P.vmax }, hud: hud && hud.root, // halfW：碰撞的半寬（怪獸卡車：輪胎比車身寬）
  };
  teleport({ x: st.x, z: st.z, heading: st.th });
  setCameraMode('chase');
  return api;
}
return { createDrive };
})();
