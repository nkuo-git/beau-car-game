// ---- 出門：人在你家的白色大理石車庫裡，走去坐上車、開鐵捲門開出去，在村子裡自己開：改車廠、車店都自己開進去，賽道比賽，快速道路開到極速；停下來可以下車走來走去 ----
// Nick 2026-09-27：「有小村莊有改車廠要比賽要自己開去小村莊裡的賽道」
// Nick 2026-09-28：「車庫要真的可以停車然後要可以開鐵捲門自己開出去⋯買車要的話是要開去車店然後就放那些還沒買到車他買完自己開回去然後打開鐵捲門然後就可以把它開進去自己的車庫⋯
//   修車廠那些的話是真的要自己開進去不是按按鈕然後直接傳送進去」
// Nick 2026-09-28 05:34：「那個車庫是我要人可以下來走是要走上車開出去不是停在那邊轉來轉去」
// Nick 2026-09-28 05:36：「還有人走到哪時候可以下車要可以進去房子」；05:38：「自己可以下車走來走去可以自訂角色有居民可以走來走去」
// Nick 2026-09-28 05:37：「我要有在車庫裡面有一個房子小房子可以睡覺的地方」；06:28：「車庫是有升降停車格」
// 村子、賽道、你家在同一個場景（TR.scene，世界座標一樣）；村子和你家（tower.js 另外蓋一棟低畫質的，擺在 places.garage.lot）第一次出門才蓋，蓋好就留著
// 第 21 批（Nick 2026-10-17「把原本正方形的車庫直接弄掉」「可以自行決定要停在哪一層可以自己搭電梯上去」；草稿 https://claude.ai/artifact/GZcpBA7kY8HVfa7zYk3Si4，「弄好直接弄上手機」）：
//   你家＝圓圓的玻璃塔（tower.js）：一樓大廳（鐵捲門、中間的圓電梯、小房子、獎盃）、二到六樓停車（每層 8 格、車頭朝外，一共 40 格）
// 出門：人站在一樓大廳（走路 walk.js），現在這台停在電梯圓台上（車頭朝鐵捲門），你其他的車停在樓上的格子（輕量車 carlod.js）
//   → 走到車子旁邊按「上車」→ 按「開鐵捲門」→ 自己開出去；停住了按右邊的「下車」就下來走（車子停在原地，走回去按「上車」接著開）
//   開的那台（還有剛下來停著的那台）是完整的車（tripS）；別台都是輕量車，走過去上車才換成完整的（載入的時候「發動中⋯」）
//   這一趟車子停在哪裡都記著（tripPose）；「直接回車庫」回到車庫頁：最後開的那台停電梯圓台，停在格子裡的照停，停在外面的回到空的格子
// 停車（GAME.park，存在手機裡；下一趟出門、重新整理都還在）：
//   開（走）到電梯圓台上 → 面板按幾樓（每一樓寫還有幾格空的）→ 電梯載著你和車上去、自己轉到最近的空格子（◀ ▶ 再轉）→ 往前開進去停好、下車 → 走回電梯按 1F
//   拿車：走進電梯按那一樓 → 上車、倒車回到電梯上 → 按 1F：電梯下樓，自己轉到車頭對著鐵捲門；電梯不在你這層：電梯井旁邊按「叫電梯」
// 小房子「大便龍的家」（一樓北邊）：從門走進去，站到床邊按「睡覺」→ 躺到床上、畫面黑掉 →「睡飽了！」站在床邊；在小房子裡鏡頭不會穿過天花板（ceilingAt）
// 改車廠、車店：自己開進去，停在「改車區／買車區」→ 下面打開改車廠（引擎零件、輪胎）／車店（還沒買的車擺在店裡）→「開走」自己開出去
//   車店買了車：新車停到店門口，開它回家；原本那台車行幫你送回車庫（停在樓上空的格子）
// 回家：開到鐵捲門前面按「開鐵捲門」→ 開進去停好 →「下車」走下來；要回車庫頁（改外觀）按下面的「直接回車庫」
// 賽道：開進起跑區（慢一點）自己停到起跑線 → race.src.js 的 enterRace()；比完「開回村子」接著開，「直接回車庫」一下回到車庫
// 引擎聲：開車一個聲音（dvoice；踩著油門就一直有聲浪：drive.js 的 load）；下車熄火、上車再發動；比賽有自己的兩個，交給賽道前先收掉；電梯的馬達聲（sound.js 的 lift）
// 撞爛（damage.js）：出門就把現在這台（完整的車）接上 createDamage（garage.src.html 的 dmgOf）；drive.js 的 onImpact → crashed → dmg.hit（凹、玻璃、燈、零件、撞車聲）
//   → drv.setDamage（變慢、方向盤偏）、存進 GAME.dmg；煙、掉下來的零件每一格 dmg.update（走路的時候也冒煙）；停著的輕量車照存檔也是凹的（damageLod）；到改車廠付錢修
// 路上的人和車（npc.js）：第一次出門「出門中⋯」先做好（輕量車＋駕駛、機車＋騎士、居民放在池子裡）；每一格 npcStep：開車的時候你的車是障礙物（AI 車停、讓、按喇叭，撞到人 onHit），
//   走路的時候你是走路的人（AI 車停下來等你）；碰撞：AI 車給 drv.addColliders（撞到會凹）、走路的 walker.setMovers（車、人都擋）；板凳 addColliders 一次
// 走進房子（interiors.js）：走到門口往裡面推（walker 的 onDoor → atDoor）→ 畫面黑掉 → 蓋好這棟的裡面（自己的場景、自己的燈；村子不畫）、換碰撞和門 → 亮起來
//   裡面的大門、樓梯口也是門（走進去就回到外面門口、換樓層）；阿財車行的展示間自動門開著（人走得進去，車開不進去）
// 第 3 批（b3-int）：警察（police-ai.js）、槍（guns.js）、槍店（gunshop.js）、警察局裡面（police.js 的 buildPoliceInterior）接在這裡（見下面「警察、槍」那一段）
//   走路按圓的「揍」、開車撞人、開槍 → 星星（通緝）→ 警車從警察局開出來追（警笛、紅藍燈、小地圖的點）、包圍你、警察下車用跑的追
//   被抓到 →「被警察抓到了！」→ 關進警察局的拘留室 10 分鐘（可以繳罰款早點出來）→ 放出來站在警察局門口，車停在警察局的停車場
//   甩開：警察看不到你（躲在房子裡面也算）、開回自己的車庫關上鐵捲門＝星星清掉；通緝中自己走進警察局＝自首
//   槍店：走進去，櫃台買槍、子彈，後面的靶場練習（每把槍第一次全部打倒拿 2 萬）；拿槍走出去：瞄準、開槍、換彈匣、換槍
//   規矩：卡通、沒有血（人倒下去再爬起來）；警察永遠不開槍；小孩永遠打不到（揍、撞、開槍都一樣）；被抓不會沒收槍、子彈；開車不能用槍
// build-art.mjs 把這個檔案接在 race.src.js 後面（用得到 TR、buildTrack、enterRace、exitRace、S、GAME、engineAudio、room、built、fitD⋯；walk.js 的 createWalker、charstub.js 的 buildCharacter）
const DRIVE = { on: false, frame: driveFrame };
const SHOP_NAME = '阿輝改車廠';
const driveBar = $('drivebar'), shopEl = $('shop'), dealerEl = $('dealer'), driveOutBtn = $('driveOut'), destBtns = [...document.querySelectorAll('#dests button')];
let VIL = null, GAR = null, drv = null, dcam = null, dvoice = null, trip = false, tripS = null, lastD = 0;
let OB = null; // 第 6 批：越野車車庫（orbay.js；跟村子一起蓋，蓋好就留著）
let home = null; // 這一趟：{ open（門的碰撞現在是開的還是關的）, hw（說過快速道路了）, slow（說過開慢一點了） }
let dEye = null; // 駕駛座視角（給 drive.js 的，每一格都讀）：畫面大小變了（全螢幕、轉手機）視角跟著重算
let walker = null; // 走路（walk.js）：第一次出門做，做好就留著（回車庫頁收起來）
let tripPose = null; // 這一趟每台車停在哪裡（世界座標 { x, z, heading }；停在圓塔格子裡的多一個 tw＝第幾格，塔裡別的地方多一個 f＝第幾層）；回車庫頁就忘掉
let tripFull = null; // 村子裡用完整模型（tripS）的那台（開的、剛下車停著的、出門停在中間的、停上升降機的）；別台都是輕量車
let tripBox = null; // 完整模型的車身長方形（沒在開的時候給走路的）
const PFULL = {}; // 第 4 批：大車（怪獸卡車）換開別台以後，停在原地用完整的車（輕量車只會平平放在 y 0：越野車場的地形上不對）：key → { S（完整的車）, box（fullBox）, sd（影子）}；回車庫頁收掉
let tripDest = null; // 現在的目的地（換車、換開車的都照這個）
let parkShadow = null; // 出門停在中間那台（還沒開過，沒有開車的影子）底下的影子
let boarding = null; // 換車中（完整模型載入中）：回車庫頁了就不換
let TWR = null; // 第 21 批：這一趟 TWR[i]＝圓塔第 i 格停哪台（40 格，TOWER_BAYS 的順序：二樓先）
// 第 23 批：開進朋友的車庫（net.src.js gvStart／gvEnd）：塔（GAR）搬到他家、格子裡換成他的車（輕量車、他的樣子）；你家變成外殼、你的車照停（TWR、存檔都不動）
//   on、uid、n（名字）、slot（他家的號碼）、want[40]（他的格子）、looks（他每台車的外觀）、objs（key → { lod, cx, cz, hx, hz }）、q（還沒做的車）、tr（他的獎盃）、lift0（你家的電梯原本在哪）、in（你在他家裡面）
const GV = { on: false, uid: '', n: '', slot: -1, want: null, looks: {}, objs: {}, q: [], tr: 0, lift0: null, in: false, job: 0 };
const twrNow = () => (GV.on ? GV.want : TWR); // 塔的格子現在擺誰的車
const EL = { ride: null, keys: new Set(), panel: null }; // 第 21 批：電梯（ride＝坐電梯中、keys＝掛在圓台上一起坐的車、panel＝按樓層的面板）
let PW = null; // 第 21 批：開車、走路用的世界（VIL 包一層：塔裡面的地板高度＝現在那一層）
let tripNo = 0; // 第幾趟（升降機停好的時候說話：已經是下一趟就不說）
let sleep = null, fadeEl = null; // 睡覺中 { t, woke }、黑掉的那一層（睡覺、走進門口共用）
let indoor = null; // 在房子裡面（interiors.js）：{ b（村子的那一棟）, I（buildInterior）, scene（只有房子裡面＋你＋裡面的人）, t（換完幾秒：0.4 秒內不理門口）, dist0（外面的鏡頭距離）, folks（這一層的人） }
let doorFade = null; // 門口的淡出淡入：{ t, T, phase（0 黑掉、1 黑著等蓋好、2 亮起來）, act（全黑的時候做的事）, wait（還在蓋、編譯）, say（亮的時候說的話） }
const gcam = { maxY: Infinity, house: false, auto: false }; // 走路的鏡頭：頭上多高有東西（ceilingAt）；在小房子裡（自動換第一人稱）
let panelCam = 'chase', camGo = null; // 進改車廠、車店前的視角；鏡頭慢慢移過去（看車店的車）
const camAt = new THREE.Vector3(); // 鏡頭現在看的點（camGo 從這裡移）
let BORROW_K = null, LENT_K = null; // 第 19 批（借車，net.src.js）：正在開借來的哪台；借給朋友的是哪台（藏起來、不能上）
const snooze = {}; // 剛比完：離開起跑區 30 公尺以前開回去不會又去比賽
const bayLock = {}; // 改車區、買車區：開走以後要先開出去，下次停進來才會再打開
const liftSnd = {}; // 電梯的馬達聲（sound.js 的 lift）
const SPAWN = { x: 3.6, z: -5.4, heading: Math.atan2(-5.4, -3.6) }; // 出門的時候人站哪裡（塔的本地：大廳、小房子旁邊，看著電梯上的車）
let meChar = null; // 你自己（character.js）：第一次出門在「出門中⋯」的時候先做好（第一個人會先畫大家共用的貼圖，手機 0.1～0.5 秒）；樣子＝GAME.look（自訂角色）
let NPC = null; // 路上的人和車（npc.js）：第一次出門做好就留著（回車庫頁藏起來、停住）；做不出來就沒有（不擋出門）
let crushFx = null, junkVer = -1; // 第 7 批（輾扁，crush.js）：怪獸卡車開上去把東西壓扁；junkVer＝表演場的垃圾車碰撞換過幾次
let police = null, gunner = null; // 第 3 批（b3-int）：警察（police-ai.js：第一次出門的載入畫面做好就留著）、槍（guns.js：做走路的時候一起做）
let PI = null, PSC = null; // 警察局一樓裡面（police.js 的 buildPoliceInterior，載入畫面蓋好一直留著：拘留室的鐵門跟著警察開關）、它自己的場景
let GS = null, GSC = null, gsDesk = null, gsFov = 60; // 槍店裡面（gunshop.js：第一次走進去才蓋，蓋好留著）、它自己的場景、櫃台的買槍畫面、打開前的視角
let townWorld = null, townTargets = null, shopWorld = null; // 槍：村子裡（子彈打得到的牆、人、車、警察）／槍店裡（只有靶場的靶）
let impounded = false; // 這次被抓：車子有沒有拖到警察局的停車場（放出來才說「你的車停在⋯」）
const OPEN_ACT = { label: '開鐵捲門', icon: 'door', onClick: () => openDoor() };
const CLOSE_ACT = { label: '關鐵捲門', icon: 'doorDown', onClick: () => closeDoor() }; // 第 3 批（b3-int）：通緝中躲回車庫（門關了＝警察找不到你）
const OUT_ACT = { label: '下車', icon: 'walk', onClick: () => leaveCar() }; // 開車 HUD 的第二顆（右邊、換視角下面）：不會被「開鐵捲門」蓋掉
const SLEEP_ACT = { label: '睡覺', icon: 'bed', onClick: () => goSleep() };
const DRESS_ACT = { label: '換衣服', icon: 'shirt', onClick: () => openLook('cabin') }; // 小房子的衣櫃前面：自訂角色（garage.src.html）
const LIFT_BUSY = { label: '電梯動作中⋯', icon: 'lift', onClick: () => {} }; // 電梯在動的時候站在電梯井旁邊：按了不會怎樣
const CABIN_EYE = true; // 走進小房子自動換第一人稱（房間 5 × 4.2 公尺、斜天花板：第三人稱鏡頭一直被牆推到貼著頭）；走出來換回去
$('shopName').textContent = SHOP_NAME;
const inBox = (r, x, z, m = 0) => { const dx = x - r.x, dz = z - r.z, c = Math.cos(r.rot || 0), s = Math.sin(r.rot || 0); return Math.abs(dx * c - dz * s) <= r.hx + m && Math.abs(dx * s + dz * c) <= r.hz + m; };
const wrapPi = (a) => { a = (a + Math.PI) % (Math.PI * 2); return a < 0 ? a + Math.PI : a - Math.PI; };
let dealerAt = 'dealer'; // ==== 第 4 批：現在在哪一家：dealer（阿財車行：一般的車）／odealer（越野車場的越野車行：越野車）====
const saleOf = (at) => byPrice(Object.keys(CARS).filter((k) => !GAME.owned.has(k) && !!PERF[k].offroad === (at === 'odealer'))); // 那一家擺的：還沒買的車（便宜的在前面）
const forSale = () => saleOf(dealerAt); // 車店擺的：還沒買的車（便宜的在前面）
const canBuy = () => saleOf('dealer').some((k) => GAME.money >= PERF[k].price);
const dealerName = () => VIL?.places[dealerAt]?.name || '阿財車行';

// ---- 圓塔的停車格：存檔、擺車 ----
// GAME.park（存檔）＝{ mid（電梯圓台上那台＝現在這台 cur）, tower: [40]（TOWER_BAYS 的順序：二樓先；key 或 null）}
// 整理存檔的停車位：只留你的車、一台一格；現在這台 cur 停電梯圓台（它原本的格子換給原本停圓台那台）；
// 舊存檔（升降機 decks 12 格、後面的圓環車庫 ring 31 格）照順序搬進來，一台都不會不見；沒有格子的（剛買的）照價錢停空的格子（二樓先）
//   第 4 批：大車（PERF.big：怪獸卡車）、沒有輕量車的不停圓塔：車庫頁選它才看得到（停電梯圓台）；出門的時候不是開它：停在越野車車庫（第 6 批：baySpot）
const liftOK = (k) => !!LOD_CARS[k] && !PERF[k]?.big; // 停得上升降機的車（有輕量車可以掛、不會壓到隔壁那格）
const twFree = (t) => t.findIndex((k, i) => !k && !TOWER_BAYS[i]?.road); // 第 24 批：第一個空的格子（二樓先；斜坡的口對著那一格是路，不能停）
// ==== 第 6 批：越野車車庫（orbay.js）：車庫西邊自己一棟，四個停車格（4.6 × 7.5 公尺、裡面 5 公尺高），有自己的鐵捲門 ====
// Nick 2026-10-07：「越野車專屬位」；本來停在鐵捲門前面的水泥地（大車位，只有兩格、沒有遮雨）＝拿掉了
function baySpot(k) { // 那台越野車在家停哪一格（照價錢排：同一台每次停同一格）→ 世界座標；格子不夠（第五台以後）＝null
  const i = byPrice([...GAME.owned].filter((q) => !liftOK(q) && LOD_CARS[q])).indexOf(k);
  return OB && i >= 0 && i < OB.bays.length ? { ...OB.bays[i], bay: i } : null;
}
// 這一格有沒有別台停著（停進來的時候看；照 tripPose 算）
function bayTaken(i, skip) {
  const r = OB.zones.bays[i];
  for (const k of GAME.owned) { const p = tripPose?.[k]; if (!p || k === skip || p.tw != null) continue; if (inBox(r, p.x, p.z)) return k; }
  return null;
}
const carH = (k) => (PERF[k]?.big ? 3 : undefined); // 第 4 批：車子多高（走路的鏡頭從上面看過去的高度；一般的車 walk.js 當 1.4 公尺，怪獸卡車 3 公尺：鏡頭不會跑進車身裡）
function normPark() {
  const P0 = GAME.park || {}, n = TOWER_BAYS.length, t = Array(n).fill(null), seen = new Set();
  const ok = (k) => typeof k === 'string' && GAME.owned.has(k) && liftOK(k) && !seen.has(k);
  const put = (i, k) => { t[i] = k; seen.add(k); };
  if (Array.isArray(P0.tower)) P0.tower.forEach((k, i) => { if (i < n && !TOWER_BAYS[i].road && ok(k)) put(i, k); }); // 第 24 批：停在變成路的那一格（內容 17 以前的存檔）：下面照價錢換到空的格子
  for (const k of [...(Array.isArray(P0.decks) ? P0.decks : []), ...(Array.isArray(P0.ring) ? P0.ring : [])]) if (ok(k)) { const f = twFree(t); if (f >= 0) put(f, k); } // 舊存檔
  const ci = t.indexOf(cur), mid = P0.mid;
  if (ci >= 0) { t[ci] = null; seen.delete(cur); if (mid !== cur && ok(mid)) put(ci, mid); } // 開格子裡的車：原本停圓台那台換上去停它那格
  seen.add(cur);
  for (const k of byPrice([...GAME.owned])) if (ok(k)) { const f = twFree(t); if (f >= 0) put(f, k); }
  return (GAME.park = { mid: cur, tower: t });
}
// 圓塔的格子照 want 擺（R＝車庫頁的 room 或村子的 GAR）：want[i]＝第 i 格停哪台；objOf(k)＝要掛上去的 Object3D（還在載入＝null：先記名字）
// R.tk＝我們掛了什麼；同一台換格子也可以（Object3D 只會有一個 parent）
function syncTower(R, want, objOf) {
  const tk = R.tk || (R.tk = Array(TOWER_BAYS.length).fill(null));
  for (let i = 0; i < TOWER_BAYS.length; i++) {
    const k = want?.[i] || null, have = R.cars[i];
    if (!k) { if (have || tk[i]) R.take(i); tk[i] = null; continue; }
    const o = objOf(k);
    if (o) { if (have !== o || o.parent?.name !== 'towerBay' + (i + 1) || tk[i] !== k) R.put(i, o, CARS[k].btn[0]); }
    else if (tk[i] !== k || have?.isObject3D) { R.take(i); R.put(i, CARS[k].btn[0]); }
    tk[i] = k;
  }
}
// 第 i 格停的車（世界座標，車子原點＝格子中間、車頭朝外）
function towerPose(i) { const w = garWorld(TOWER_BAYS[i]); return { x: w.x, z: w.z, heading: w.heading, tw: i }; }
// 停在第幾層（格子裡的照格子；塔裡別的地方記著 f；外面＝0）
const poseF = (p) => (!p ? 0 : p.tw != null ? TOWER_BAYS[p.tw].f : p.f || 0);
const inTower = (x, z, m = 0) => { const q = garLocal(x, z); return GAR.isInside(q.x, q.z, m); };
const floorAt = (x, z) => (inTower(x, z, -0.4) ? GAR.floor : 0); // 下車、停車的那一點在第幾層
// 停在電梯圓台上的車（第 f 層；不是 skip 那台；車子中心離圓台中心 r 公尺以內）
function padCars(f, skip, r = 1.6) {
  const out = [];
  for (const k of GAME.owned) {
    const p = tripPose?.[k]; if (!p || p.tw != null || k === skip || k === LENT_K || EL.keys.has(k) || poseF(p) !== f) continue;
    const q = garLocal(p.x, p.z); if (Math.hypot(q.x, q.z) < r) out.push(k);
  }
  return out;
}
// 這一趟停在格子裡的記進存檔（重新整理也還在；回車庫頁再整理一次：normPark）
function keepPark() { if (!TWR || GV.on) return; GAME.park = { mid: padCars(0, null)[0] || null, tower: TWR.slice() }; save(); }

// ---- 停著的車（輕量車 carlod.js）：你的其他車停在車庫的升降停車格（出門的時候停在哪就在哪），還沒買的擺在車店 ----
// 一台車一份（LODS[key]），看現在在哪裡就搬過去：車庫頁的車庫（room，原點）、出門時村子裡你家（GAR）或停在村子裡的地方、車店的展示台
const LODS = {};
function lodFor(k) { // 有了就給；沒有就開始載入（載好了再排一次）
  if (!LOD_CARS[k]) return null; // 沒有輕量車的（第 4 批的怪獸卡車後來也有了：body-monster-lod.glb）
  if (LODS[k]) return LODS[k].lod;
  LODS[k] = { lod: null };
  LOD_CARS[k].load().then((sc) => {
    if (!LODS[k] || LODS[k].lod) return;
    const lod = buildLodCar(k, sc, CARS[k].state), box = new THREE.Box3().setFromObject(lod.car);
    LODS[k] = { lod, sig: JSON.stringify(CARS[k].state), cx: (box.min.x + box.max.x) / 2, cz: (box.min.z + box.max.z) / 2, hx: (box.max.x - box.min.x) / 2, hz: (box.max.z - box.min.z) / 2 };
    const sd = sh.clone(); // 停在升降機以外的影子（平台上的影子車庫自己畫）：跟頁面那片同一個網格、材質，照車身大小放大
    sd.position.set(LODS[k].cx, 0.004, LODS[k].cz); sd.scale.set(LODS[k].hx / 2.2, LODS[k].hz / 0.97, 1); sd.visible = false;
    lod.car.add(sd); LODS[k].shadow = sd;
    arrangeCars();
  }).catch((e) => { console.error(e); delete LODS[k]; }); // 沒載到：下次排的時候再試
  return null;
}
// 車身長方形（碰撞）：p＝車子原點的位置（世界）
const carBox = (B, p) => { const c = Math.cos(p.heading || 0), s = Math.sin(p.heading || 0); return { t: 'box', x: p.x + B.cx * c + B.cz * s, z: p.z - B.cx * s + B.cz * c, hx: B.hx, hz: B.hz, rot: p.heading || 0, h: 1.3 }; };
// 停在村子裡的位置 → [放在哪個 Group, 那個 Group 裡的位置]：塔裡面放進塔（一樓：大廳；樓上：那一層的 Group，cull 照鏡頭開關）；外面照地面高度（山上、越野車場）
function parkedAt(p) {
  const q = garLocal(p.x, p.z), LH = garLot().heading;
  if (GAR.isInside(q.x, q.z)) { const f = poseF(p); return [f ? GAR.floors[f] : GAR.interior, { x: q.x, y: GAR.fy(f), z: q.z, heading: (p.heading || 0) - LH }]; }
  return [VIL.group, { x: p.x, y: VIL.heightAt ? VIL.heightAt(p.x, p.z) || 0 : 0, z: p.z, heading: p.heading }];
}
let padOff = 0; // 車行轉盤擺第幾台開始（車比轉盤多：按到後面的車，轉盤換一批：lookAtCar）
function arrangeCars() {
  const inTown = !!(trip && GAR && tripPose && TWR), R = inTown ? GAR : room; // 車庫頁是攝影棚（不是豪華車庫）就沒有圓塔（room 還沒蓋）
  const shows = inTown ? VIL.places.dealer?.display || [] : [], sale = saleOf('dealer').filter((k) => LOD_CARS[k]);
  if (padOff >= sale.length) padOff = Math.max(0, Math.floor((sale.length - 1) / (shows.length || 1)) * (shows.length || 1));
  const pads = sale.slice(padOff, padOff + shows.length);
  const at = new Map(); // key → [Group, 位置, 自己的影子要不要開, 世界的位置]（格子裡的另外掛：syncTower）
  let want = null;
  if (inTown) {
    want = twrNow(); // 完整模型那台（停進格子的）也在裡面：掛的是 tripS.car；第 23 批：在朋友家＝他的車
    for (const k of GAME.owned) {
      const p = tripPose[k]; if (!p || k === tripFull || p.tw != null || k === LENT_K || EL.keys.has(k)) continue; // 完整模型那台（開的、下車停著的）不用輕量車；第 19 批：借給朋友的那台不畫；第 21 批：坐電梯中的掛在圓台上
      if (PFULL[k]) { pfullShow(k); continue; } // 第 4 批：大車換開別台：完整的車停在原地
      const [g, q] = parkedAt(p); at.set(k, [g, q, true, p]);
    }
  } else if (R) want = normPark().tower;
  pads.forEach((k, i) => at.set(k, [VIL.group, shows[i], true, shows[i]]));
  const onDeck = new Set([...(inTown && GV.on ? [] : want || []), ...(inTown ? EL.keys : [])].filter((k) => k && !(inTown && k === tripFull))); // 格子裡的、坐電梯中的也不收（第 23 批：在朋友家，你格子裡的車收起來）
  for (const k of Object.keys(CARS)) {
    const w = at.get(k);
    if (!w && !onDeck.has(k)) { LODS[k]?.lod?.car.removeFromParent(); continue; }
    const lod = lodFor(k); if (!lod) continue;
    const sig = JSON.stringify(CARS[k].state);
    if (LODS[k].sig !== sig) { lod.setLook(CARS[k].state); LODS[k].sig = sig; LODS[k].dl?.update(0.016); } // 在車庫頁改過外觀（撞壞的照新的網格重播）
    const st = GAME.owned.has(k) ? GAME.dmg[k] || null : null, dsig = st ? JSON.stringify(st.h) : ''; // 撞壞的車停在升降機上、村子裡也是凹的（damage.js 的 damageLod）
    if ((LODS[k].dsig || '') !== dsig) { if (!LODS[k].dl) LODS[k].dl = damageLod(lod, null, { spec: LOD_CARS[k].spec }); LODS[k].dl.apply(st); LODS[k].dsig = dsig; }
    if (!w) { LODS[k].shadow.visible = false; continue; } // 格子裡：下面 syncTower 掛上去
    w[0].add(lod.car); lod.car.position.set(w[1].x, w[1].y || 0, w[1].z); lod.car.rotation.set(0, w[1].heading || 0, 0); // 車店的轉盤比地面高一點（y）
    LODS[k].shadow.visible = w[2];
  }
  if (R && want) syncTower(R, want, inTown && GV.on ? (k) => GV.objs[k]?.lod.car || null : (k) => (inTown && k === tripFull ? tripS.car : LODS[k]?.lod ? LODS[k].lod.car : null));
  if (inTown) { // 停著的車：開過去會撞到、走過去會擋到（第 21 批：跟你同一層的才擋：樓上的格子、你在樓上的時候外面的都不擋）
    const cols = [], padCols = [], fl = GAR.floor;
    for (const [k, w] of at) { const L = LODS[k], own = GAME.owned.has(k); if (L?.lod && w[3] && (!own || poseF(w[3]) === fl)) (own ? cols : padCols).push(carBox(L, w[3])); }
    const TW = twrNow();
    for (let i = 0; i < TW.length; i++) { const k = TW[i], L = GV.on ? GV.objs[k] : k !== tripFull && LODS[k]; if (k && TOWER_BAYS[i].f === fl && L?.lod) cols.push(carBox(L, towerPose(i))); } // 第 23 批：朋友家的格子＝他的車
    for (const k in PFULL) { const p = tripPose[k]; if (p && k !== tripFull && poseF(p) === fl) cols.push(carBox(PFULL[k].box, p)); } // 第 4 批：停著的完整的車（大車換開別台）
    if (drv) { drv.removeColliders('parked'); drv.addColliders([...cols, ...padCols], 'parked'); }
    if (walker) { walker.removeColliders('pads'); walker.addColliders(padCols, 'pads'); walker.setCars(walkCars()); } // 你的車：走路那邊自己加碰撞（setCars）
  }
  if (inTown) oShow(); // 第 4 批：越野車行展示台上的車（買走了收掉、開車的是新的再放碰撞）
}
onCars = arrangeCars; // 車庫頁換車、買車、重新開始、車庫重蓋的時候叫（garage.src.html）
arrangeCars();
// 走路可以上的車：你的車（停在哪就在哪；第 21 批：跟你同一層的才上得去）；開著的、剛下車停著的那台 walk.js 自己記著
function walkCars() {
  const list = [];
  if (!tripPose || !TWR) return list;
  for (const k of GAME.owned) {
    const p = tripPose[k]; if (!p || k === LENT_K || EL.keys.has(k)) continue; // 第 19 批：借給朋友了；第 21 批：坐電梯中
    if (poseF(p) !== GAR.floor) continue; // 第 21 批：別層的（樓上的格子；你在樓上的時候外面的）走不到
    const name = CARS[k].btn[0];
    if (k === tripFull) { if (!drv && tripS && tripBox) list.push({ key: k, name, x: p.x, z: p.z, heading: p.heading, ...tripBox, h: carH(k), object: tripS.car }); continue; } // 出門停在電梯圓台上、停進格子（還沒開、沒在開）
    if (PFULL[k]) { list.push({ key: k, name, x: p.x, z: p.z, heading: p.heading, ...PFULL[k].box, h: carH(k), object: PFULL[k].S.car }); continue; } // 第 4 批：大車換開別台（完整的車停著）
    const L = LODS[k]; if (!L?.lod) continue; // 還在載入：載好了會再排一次
    list.push({ key: k, name, x: p.x, z: p.z, heading: p.heading, hx: L.hx, hz: L.hz, cx: L.cx, cz: L.cz, h: carH(k), object: L.lod.car }); // h：大車（怪獸卡車）3 公尺高
  }
  return list;
}

// ---- 你家（村子裡那棟圓塔）：塔的座標 ↔ 世界座標（原點＝塔的中心、x 往門外、z＝車頭朝門時車子的右邊；只管 x、z）----
const garLot = () => HOME.lot || VIL.places.garage.lot; // 第 23 批：塔現在蓋在哪（平常＝你家；去朋友家＝他家）
function garWorld(p) {
  const L = garLot(), c = Math.cos(L.heading), s = Math.sin(L.heading);
  return { x: L.x + p.x * c + p.z * s, z: L.z - p.x * s + p.z * c, heading: (p.heading || 0) + L.heading };
}
function garLocal(x, z) {
  const L = garLot(), c = Math.cos(L.heading), s = Math.sin(L.heading), dx = x - L.x, dz = z - L.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}
const garCols = (open) => GAR.colliders(open, true, true); // 現在這一層的碰撞（世界座標；電梯不在這層＝井擋起來）；第 24 批：開車的（樓上的玻璃留斜坡的口）
// 第 21 批：開車、走路用的世界（VIL 包一層）：塔裡面（樓板蓋得到的地方）地板＝塔的一樓多高（山頂那間 ≈ 103）＋現在這一層；平的、柏油；外面完全照舊
//   第 24 批：外面的斜坡（rampRef 那一圈：開在斜坡上、在樓上）＝斜坡的路面高；一樓、外面＝地面
function proxyWorld() {
  const W = Object.create(VIL), R2 = TOWER.RW * TOWER.RW, UP = [0, 1, 0], RR2 = (TOWER_RAMP.R1 + 1.5) ** 2;
  const inT = (x, z) => { const L = garLot(), dx = x - L.x, dz = z - L.z; return dx * dx + dz * dz < R2; };
  const base = () => GAR.group.position.y + towerFy(GAR.floor);
  const rampH = (x, z) => { // 不配置記憶體（輪子每一步都問）
    const ref = rampRef(); if (ref == null) return null;
    const L = garLot(), dx = x - L.x, dz = z - L.z; if (dx * dx + dz * dz >= RR2) return null;
    const c = Math.cos(L.heading), s = Math.sin(L.heading), lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (!TRAMP.on && Math.abs(wrapPi(Math.atan2(lz, lx) - TOWER_RAMP.A0 - ref)) > TOWER_RAMP.GW + 0.2) return null; // 在樓上：只有這一層的口那邊接斜坡（外面別的地方＝地面：停在外面的車不會浮起來）
    const y = rampAtY(lx, lz, ref);
    return y == null ? null : GAR.group.position.y + y;
  };
  W.heightAt = (x, z) => { if (inT(x, z)) return base(); const h = rampH(x, z); return h != null ? h : VIL.heightAt ? VIL.heightAt(x, z) : 0; };
  W.terrainAt = (x, z) => (inT(x, z) ? base() !== 0 : rampH(x, z) != null || (VIL.terrainAt ? VIL.terrainAt(x, z) : false));
  W.normalAt = (x, z) => (inT(x, z) || rampH(x, z) != null ? UP : VIL.normalAt ? VIL.normalAt(x, z) : UP);
  W.surfaceAt = (x, z) => (inT(x, z) || rampH(x, z) != null ? 0 : VIL.surfaceAt(x, z));
  return W;
}

// ---- 出門：村子、你家第一次要蓋（等招牌的字型、蓋一下子），蓋好再出門 ----
async function enterDrive() {
  if (DRIVE.on || RACE.on || trip || enterDrive.busy) return;
  if (!S) { gtoast('車子還在開進車庫，等一下'); return; }
  if (!GAME.owned.has(cur)) return;
  stopRev(); getOut(); engineAudio.resume(); // 在點擊裡、await 之前；坐在車裡（車庫頁的「車內」）就先下車
  trip = true; HOME.in = true; controls.enabled = false; // 第 17 批：出門一定是從車庫裡面開始（載入中名單也寫「在車庫」，不會先跳「在路上」）
  document.body.classList.add('driving'); // 車庫的東西先收起來（換車、選項），畫面變高
  if (!VIL) {
    enterDrive.busy = true;
    status.hidden = false; msg.textContent = '出門中⋯'; prog.parentElement.hidden = true;
    await Promise.race([Promise.all([document.fonts.load('700 58px "Noto Sans TC"', '終點').catch(() => {}), villageFonts(), offroadFonts(), circuitFonts(), neihuFonts(), mountainFonts(), orbayFonts()]), new Promise((r) => setTimeout(r, 1600))]);
    await new Promise((r) => setTimeout(r, 30)); // 讓「出門中」先畫出來（蓋村子要一下子，這時候畫面不會動）
    try {
      if (!TR) TR = buildTrack();
      VIL = buildVillage({ renderer }); buildOffroad(VIL, { renderer }); buildCircuit(VIL, { renderer }); buildNeihu(VIL, { renderer }); buildMountain(VIL, { renderer }); VIL.wrapHome(); TR.scene.add(VIL.group); // 第 4 批：越野車場（加進 VIL：地形高度、路、地方、碰撞、小地圖）
      const L = VIL.places.garage.lot;
      GAR = buildRoom(renderer, { quality: 'low', exterior: true }); // 第 21 批：圓塔（tower.js）；村子裡看得到玻璃、名牌；地板不反射（省）
      GAR.group.position.set(L.x, VIL.places.garage.y || 0, L.z); GAR.group.rotation.y = L.heading; TR.scene.add(GAR.group);
      GAR.onLift = onLift; // 電梯開始動、停好：馬達聲、碰撞、走得到的車
      PW = proxyWorld();
      OB = buildOrbay(VIL, { renderer }); // 第 6 批：越野車車庫（車庫西邊那棟：牆、停車格、鐵捲門的碰撞都加進 VIL 了）
      $('dealerName').textContent = dealerName();
      if (!meChar) meChar = buildCharacter(meLook());
    } catch (e) {
      console.error(e); enterDrive.busy = false; msg.textContent = '村子沒蓋好，重新整理再試一次';
      if (VIL && !GAR) { VIL.group.removeFromParent(); VIL = null; } // 下次整個重蓋
      trip = false; controls.enabled = true; document.body.classList.remove('driving');
      return;
    }
    // 路上的人和車：車的模型載好、車（含駕駛）、機車、居民先做好放在池子裡（沒做的話第一格頓快 1 秒）；最多等 12 秒，做不出來就沒有
    msg.textContent = '村子的人、車準備中⋯';
    await new Promise((r) => setTimeout(r, 30));
    if (!dcam) dcam = new THREE.PerspectiveCamera(60, 1, 0.1, 2500); // 車流、居民用鏡頭看哪裡不生、不收
    try { NPC = await makeNpc(); } catch (e) { console.error(e); NPC = null; }
    try { crushFx = makeCrush(); } catch (e) { console.error(e); crushFx = null; } // 第 7 批（輾扁）：怪獸卡車的墊子、表演場的垃圾車（垃圾車到了越野車場才做）
    // 走進房子：共用的貼圖、反射（PMREM）、材質先做好，蓋一棟編譯一次 shader（第一次進門不會頓）
    msg.textContent = '房子準備中⋯';
    await new Promise((r) => setTimeout(r, 30));
    try { await warmHouses(); } catch (e) { console.error(e); }
    // 第 3 批（b3-int）：警察（3 台警車、3 個警察先做好、編譯 shader）、警察局裡面（蓋好、編譯）、槍店招牌的字型；做不出來就沒有警察（不擋出門）
    msg.textContent = '警察局、槍店準備中⋯';
    await new Promise((r) => setTimeout(r, 30));
    try { await warmPolice(); } catch (e) { console.error(e); }
    enterDrive.busy = false; status.hidden = true;
  }
  startDrive();
}
// 村子比較大：霧推遠一點、鏡頭看遠一點（賽道比賽用原本的）
let FOG0 = null;
function townFog(on) {
  const f = TR.scene.fog; if (!f) return;
  if (!FOG0) FOG0 = [f.near, f.far];
  [f.near, f.far] = on ? [150, 1500] : FOG0;
}
// 走路的（walk.js）：第一次出門做（村子、你家蓋好以後），之後一直用同一個
function makeWalker() {
  walker = createWalker({ scene: TR.scene, camera: dcam, world: PW, colliders: stripColliders(), character: meChar || buildCharacter(meLook()), hudParent: stage, keyboard: true, onDoor: atDoor, onGetIn });
  walker.setGarage(GAR); // 鐵捲門：碰撞跟著門、門口給「開鐵捲門」
  if (NPC) { walker.addColliders(NPC.peds.props.colliders, 'npc-props'); walker.setMovers(NPC.MOV); } // 板凳、椅子；路上的車、居民（npcStep 每一格換）
  makeGuns(); // 第 3 批（b3-int）：槍、「揍」的按鈕、警車和警察擋人、小地圖上的警車
}
function startDrive() {
  tripS = S; tripNo++;
  dmgOf(tripS, cur); // 撞爛（damage.js）：出門就接上（分類網格＋暖身，一台 0.1–0.4 秒：卡在出門這一下，不要卡在上車那一下）
  DRIVE.on = true; controls.enabled = false;
  document.body.classList.add('driving'); driveBar.hidden = false;
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!dcam) dcam = new THREE.PerspectiveCamera(60, 1, 0.1, 2500);
  dcam.aspect = w / h; dcam.updateProjectionMatrix(); dcam.userData.w = w; dcam.userData.h = h;
  for (const s of TR.shadows) s.visible = false;
  for (const f of TR.flames) f.visible = false;
  townFog(true);
  for (const k of Object.keys(snooze)) delete snooze[k];
  for (const k of Object.keys(bayLock)) delete bayLock[k];
  GAR.door.t = 0; GAR.setTrophies(trophyCount()); elEnd(); stopLiftSnd(); GAR.liftSnap(0, 0); GAR.setFloor(0); rampReset(); homePlace(); // 第 17 批：你家搬到你那間（下面的停車位置都照新的 lot 算）；第 21 批：電梯在一樓、你在一樓
  if (OB) { OB.door.t = 0; obDoor.drv = null; obDoor.walk = null; } // 第 6 批：越野車車庫的鐵捲門關著
  home = { open: null, hw: false, slow: false }; hurtSaid = false;
  if (!walker) makeWalker();
  npcShow(true);
  police?.setEnabled(true); // 第 3 批（b3-int）
  if (gcam.auto && walker.cameraMode === 'eye') walker.setCamera({ mode: 'follow' }); // 上一趟在小房子裡自動換的第一人稱：換回來
  endSleep(); gcam.maxY = Infinity; gcam.house = false; gcam.auto = false; walker.setCamera({ maxY: null });
  // 這一趟：現在這台停在電梯圓台上（車頭朝鐵捲門；車庫頁選了樓上的車＝電梯已經把它送下來了），你其他的車照存檔停在樓上的格子
  const P = normPark(); TWR = P.tower.slice();
  tripPose = { [cur]: { ...VIL.places.garage.spawn, f: 0 } };
  for (let i = 0; i < TWR.length; i++) if (TWR[i]) tripPose[TWR[i]] = towerPose(i);
  for (const k of GAME.owned) if (k !== cur && !liftOK(k)) { const p = baySpot(k); if (p) tripPose[k] = p; } // 第 6 批：越野車停越野車車庫自己的格子（輕量車）
  if (GAR.tk) GAR.tk.fill(null); // 上一趟掛的東西可能被車庫頁拿走了（Object3D 只有一個 parent）：全部重掛
  parkFull();
  walker.setCars([], { keepParked: false }); // 新的一趟：上次下車停著的那台忘掉
  liftChanged(); // 輕量車掛到村子這棟的格子上、還沒買的擺到車店；碰撞（塔、只擋鏡頭的天花板）、走路可以上的車
  setDest(canShop() ? 'shop' : canBuy() ? 'dealer' : 'circuit'); // 買得起東西就先帶你去買（不然去賽車場比賽）
  walker.teleport(garWorld(SPAWN)); walker.resume();
  // 教怎麼開始：第一次出門 walk.js 先教怎麼走（3.2 秒），接著才說走去上車；已經走到車子旁邊（有「上車」）就不說
  const hint = () => { if (DRIVE.on && trip && walker.mode === 'walk' && !walker.action) walker.toast('走到車子旁邊，按「上車」', 2400); };
  if (startDrive.n++) hint(); else setTimeout(hint, 3400);
  lastD = performance.now();
  stage.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
}
startDrive.n = 0;
// 出門停在中間那台（完整模型）：還沒上車，先停好、給它一片影子
function parkFull() {
  const Sx = tripS, p = tripPose[cur];
  TR.scene.add(Sx.car); Sx.car.visible = true; Sx.body.position.y = +CARS[cur].state.height;
  const gy = PW ? PW.heightAt(p.x, p.z) || 0 : 0; // 第 21 批：塔的一樓（山頂那間 ≈ 103）
  Sx.car.position.set(p.x, gy, p.z); Sx.car.rotation.set(0, p.heading, 0); Sx.car.updateMatrixWorld(true);
  Sx.cabin?.userData.setGauges(0, 0); Sx.cabin?.userData.setSteer?.(0);
  tripFull = cur; tripBox = fullBox(Sx);
  if (!parkShadow) { parkShadow = sh.clone(); parkShadow.name = 'park-shadow'; }
  const c = Math.cos(p.heading), s = Math.sin(p.heading);
  TR.scene.add(parkShadow); parkShadow.visible = true;
  parkShadow.position.set(p.x + tripBox.cx * c, gy + 0.006, p.z - tripBox.cx * s); parkShadow.rotation.set(-Math.PI / 2, 0, p.heading); parkShadow.scale.set(tripBox.hx / 2.2, tripBox.hz / 0.97, 1);
}
// 完整模型的車身長方形（跟 drive.js 量的一樣：放回原點量車身）
function fullBox(Sx, k = cur) {
  const p = Sx.car.position.clone(), r = Sx.car.rotation.clone();
  Sx.car.position.set(0, 0, 0); Sx.car.rotation.set(0, 0, 0); Sx.car.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(Sx.body);
  Sx.car.position.copy(p); Sx.car.rotation.copy(r); Sx.car.updateMatrixWorld(true);
  return { hx: (b.max.x - b.min.x) / 2, hz: Math.max(b.max.z, -b.min.z, PERF[k]?.halfW || 0), cx: (b.max.x + b.min.x) / 2, cz: 0 }; // 第 4 批：halfW＝輪胎比車身寬的（怪獸卡車 1.905）
}
// 第 4 批：大車換開別台以後停在原地（完整的車、自己的影子）；上車、回車庫頁的時候收掉
function pfullShow(k) {
  const F = PFULL[k]; if (!F) return;
  if (F.S.car.parent !== TR.scene) TR.scene.add(F.S.car);
  F.S.car.visible = true;
  if (!F.sd) { F.sd = sh.clone(); F.sd.position.set(F.box.cx, 0.004, 0); F.sd.scale.set(F.box.hx / 2.2, F.box.hz / 0.97, 1); F.S.car.add(F.sd); }
  F.sd.visible = true;
}
function pfullOff(k, stow) { const F = PFULL[k]; if (!F) return; F.sd?.removeFromParent(); delete PFULL[k]; if (stow) stowFull(F.S); }
// 手機記憶體：完整的車最多留 3 台（k＝現在要開的；村子裡停著的大車（PFULL）不收）
function keepRecent(k) {
  const ri = recent.indexOf(k); if (ri >= 0) recent.splice(ri, 1); recent.push(k);
  while (recent.length > 3) { const i = recent.findIndex((q) => q !== k && !PFULL[q]); if (i < 0) break; dispose(recent.splice(i, 1)[0]); }
}
// 完整模型收回車庫頁（原點、不轉、輪子歸零、藏起來；還在 built 裡：車庫頁切回來不用再載）
function stowFull(Sx) {
  if (!Sx) return;
  if (MIR.S === Sx) mirrorSet(false); // 第 25 批：照後鏡換回原本的
  scene.add(Sx.car); Sx.car.position.set(0, 0, 0); Sx.car.rotation.set(0, 0, 0); Sx.car.visible = false;
  Sx.wheels.forEach((w) => (w.rotation.z = 0)); Sx.cabin?.userData.setGauges(0.13, 0); Sx.cabin?.userData.setSteer?.(0);
}
// 開車的（drive.js）：上車、改車廠開走（裝了零件馬力變了）、車店換新車、比完賽都重新做一個
function makeDrv(pose) {
  const Sx = tripS;
  TR.scene.add(Sx.car); Sx.car.visible = true; Sx.body.position.y = +CARS[cur].state.height;
  // 駕駛座視角：車內（cabin.js）的眼睛；手機直拿畫面窄，視角放大一點（跟車庫的「車內」一樣）
  const eye = CABIN_VIEW[cur] ? { ...CABIN_VIEW[cur], fov: cabinFov(cur, dcam.aspect) } : undefined;
  dEye = eye;
  const dmg = dmgOf(Sx, cur); // 撞爛（damage.js）：換開別台、車店買的新車第一次開才接上
  drv = createDrive({ car: Sx, scene: TR.scene, camera: dcam, perf: { ...PERF[cur], hp: hpOf(cur) }, world: PW, colliders: stripColliders(), hudParent: stage,
    onZone: arrive, onShift: () => dvoice?.shift(), onBump: bump, onLand: orLand, halfW: PERF[cur].halfW /* 第 4 批 */, onImpact: crashed, eye, keyboard: true, camButton: true, mapLayer: walker?.mapLayer, audio: engineAudio /* 第 3 批：輪胎叫 */,
    crush: crushFx && offK(cur) ? CRUSH_DRV : null }); // 第 7 批：只有怪獸卡車輾得過去（別的車完全照舊）；第 9 批：越野車（PERF.offroad） // 小地圖的底圖跟走路共用一張
  if (dmg) drv.setDamage(dmg.perf); // 撞壞的車開起來比較慢、方向盤偏
  if (tiltK === 'tilt') drv.setTilt(true, tiltFail); // 轉手機開車
  if (NPC) drv.addColliders(NPC.peds.props.colliders, 'npc-props'); // 板凳、椅子（路上的車 npcStep 每一格換）
  drv.addColliders(DEALER_DOOR, 'dealer-door'); // 車行的自動門開著：人走得進去，車子擋住
  drv.setCamCeil((x, z) => { if (OB?.inside(x, z, 0.6)) return OB.size.ceil - 0.75; if (TRAMP.on) return rampCeil(x, z); const c = GAR.ceilingAt(x, z, true); return c < 50 ? GAR.group.position.y + c - 0.75 : Infinity; }); // 第 24 批：開在斜坡上＝上面那一圈的底下 // 第 21 批：圓塔現在這一層的天花板（一樓 4.2、樓上 2.9 公尺） // 修 5：越野車車庫裡面追車鏡頭壓在天花板下面（以前鏡頭穿出去、屋頂不畫＝看到天空）
  if (police) drv.setMarkers(police.markers); // 第 3 批（b3-int）：小地圖上的警車
  drv.teleport(pose);
  tripFull = cur; tripPose[cur] = { x: pose.x, z: pose.z, heading: pose.heading, f: floorAt(pose.x, pose.z) }; if (parkShadow) parkShadow.visible = false;
  home.open = null; obDoor.drv = null; // 門的碰撞下一格放（照門現在開著還是關著；第 6 批：越野車車庫的門一樣）
  arrangeCars(); // 停著的車：放碰撞（開車的是新的）、走路的清單
  drv.setDestination(tripDest);
  dvoice?.dispose(); dvoice = engineAudio.voice(cur, { parts: partsOf(cur) });
  popDrv(); // 跳燈（86、R7）
}
// 改車廠有沒有買得起的（還沒裝的引擎零件、還沒買的輪胎）
function canShop() {
  const P = PERF[cur], T = tyresOf(cur), fix = DAMAGE.cost(GAME.dmg[cur], P.price);
  return (fix > 0 && GAME.money >= fix) || P.parts.some((p) => !partsOf(cur).includes(p[0]) && GAME.money >= p[4]) || [1, 2].some((n) => !T.own.includes(n) && GAME.money >= P.tyres[n - 1]);
}
function setDest(d) {
  tripDest = d || null;
  drv?.setDestination(d); walker?.setDestination(d); // 開車、走路都跟著這個目的地（左上角、小地圖的路線、光柱）
  if (d && OB && drv && walker?.mode === 'off') { const t = drv.telemetry(); if (OB.inside(t.x, t.z)) openOrbay(); } // 修 7：在越野車車庫裡面按「去哪裡」：鐵捲門自己打開（不然路線穿過關著的門，開過去就卡住）
  destBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.d === d)));
  destOpen(false);
}
destBtns.forEach((b) => b.addEventListener('click', () => { if (DRIVE.on) setDest(b.dataset.d); }));
// 修 11：手機橫拿全螢幕開車的時候「去哪裡」收成一顆（garage.css .dtog）：按了打開，選了、開走了就收起來
// Nick 2026-10-10「按鈕不用總是全部顯示 可以效法目的地選單那樣 點了再列出來 再點一次就收起來」：去哪裡、⋯（聲音、全螢幕、換視角）
//   平常收起來（garage.css）；停著打開的，開走了（超過 4 m/s）就收；開著的時候打開的，8 秒後收（FOLD：−1 開走就收、> 0 還有幾秒）
const FOLD = { destsopen: -1, moreopen: -1 };
const foldStart = () => { const t = drv && DRIVE.on ? drv.telemetry() : null; return t && Math.abs(t.v) > 4 ? 8 : -1; };
function destOpen(on) { if (bodyFlags.destsopen === on) return; bodyFlag('destsopen', on); $('destTog').setAttribute('aria-expanded', String(on)); if (on) FOLD.destsopen = foldStart(); }
function moreOpen(on) { if (!on) { sizeOpen(false); tiltOpen(false); } if (bodyFlags.moreopen === on) return; bodyFlag('moreopen', on); const b = $('moreTog'); b.setAttribute('aria-expanded', String(on)); b.textContent = on ? '✕' : '⋯'; if (on) FOLD.moreopen = foldStart(); }
// 按鈕大小（Nick 2026-10-10）：小 0.8、中 1（原本的）、大 1.15；每支手機自己記（carid.btnsize，不用搬家、不上雲端）
const BTN_Z = { s: 0.8, m: 1, l: 1.15 }, BTN_KEY = 'carid.btnsize';
// 「大」只放大到排得下：直拿看寬（390 寬剛好排滿＝1 倍）、橫拿看高（340 高＝1 倍）；小螢幕（或手機「顯示大小」調大）上「大」＝「中」
let btnK = 'm';
function btnZoom() { const z = BTN_Z[btnK]; if (z <= 1) return z; const W = innerWidth, H = innerHeight, cap = H <= 560 ? H / 340 : W / 390; return +Math.max(1, Math.min(z, cap)).toFixed(2); }
function btnApply() { const z = String(btnZoom()); if (document.documentElement.style.getPropertyValue('--hudz') !== z) document.documentElement.style.setProperty('--hudz', z); }
addEventListener('resize', btnApply);
function btnSize(k, keep) {
  if (!BTN_Z[k]) k = 'm';
  btnK = k; btnApply();
  for (const b of document.querySelectorAll('#sizePop button')) b.setAttribute('aria-pressed', String(b.dataset.z === k));
  if (keep) try { localStorage.setItem(BTN_KEY, k); } catch {}
}
function sizeOpen(on) { if (on) tiltOpen(false); if (bodyFlags.sizeopen === on) return; bodyFlag('sizeopen', on); $('sizeTog').setAttribute('aria-expanded', String(on)); if (on) FOLD.moreopen = foldStart(); }
try { btnSize(localStorage.getItem(BTN_KEY)); } catch { btnSize('m'); }
$('sizeTog').addEventListener('click', () => sizeOpen(true));
for (const b of document.querySelectorAll('#sizePop button')) b.addEventListener('click', () => { btnSize(b.dataset.z, true); sizeOpen(false); });
// 轉手機開車（Nick 2026-10-17「把手機本身改成可以方向盤的模式」）：「⋯」那一排多一顆「🎮」→「方向盤 按鈕 ⬅➡／轉手機 📱」；
//   一開始是按鈕；每支手機自己記（carid.tilt，跟按鈕大小一樣不用搬家、不上雲端）；這支手機沒有感應器（drive.js 1.5 秒沒資料）就變回按鈕
const TILT_KEY = 'carid.tilt';
let tiltK = 'btn';
const tiltFail = () => tiltMode('btn', true);
function tiltMode(k, keep) {
  tiltK = k === 'tilt' ? 'tilt' : 'btn';
  for (const b of document.querySelectorAll('#tiltPop button')) b.setAttribute('aria-pressed', String(b.dataset.t === tiltK));
  if (keep) try { localStorage.setItem(TILT_KEY, tiltK); } catch {}
  if (drv) drv.setTilt(tiltK === 'tilt', tiltFail);
}
function tiltOpen(on) { if (on) sizeOpen(false); if (bodyFlags.tiltopen === on) return; bodyFlag('tiltopen', on); $('tiltTog').setAttribute('aria-expanded', String(on)); if (on) FOLD.moreopen = foldStart(); }
try { tiltMode(localStorage.getItem(TILT_KEY)); } catch { tiltMode('btn'); }
$('tiltTog').addEventListener('click', () => tiltOpen(true));
for (const b of document.querySelectorAll('#tiltPop button')) b.addEventListener('click', () => {
  const k = b.dataset.t, ask = k === 'tilt' && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function'; // iPhone：要先問可不可以用
  tiltOpen(false);
  if (ask) DeviceMotionEvent.requestPermission().then((r) => tiltMode(r === 'granted' ? 'tilt' : 'btn', true), tiltFail); else tiltMode(k, true);
});
// 跳燈（Nick 2026-10-17，草稿 https://claude.ai/artifact/NjStMe4AhSWuk9dBUELzde；popup.js）：86、R7 開車的時候「手煞車」旁邊多一顆「跳燈」（drive.js setPop）
//   按一下燈蓋立起來、燈亮；再按一下收回去。每台車記在存檔 GAME.pop（{車: 1}）；借來的車不記（下次借又是關著的）。朋友看得到（netState 的 pl）
const POP = { P: null }; // 現在開的這台的燈座（makeDrv 換）
const popT = () => (calm ? 0.12 : 0.3);
function popDrv() { // makeDrv 最後叫：放到存檔的樣子（不用轉）、按鈕出現（沒有跳燈的車＝藏起來）
  const P = tripS?.body.getObjectByName('popup')?.userData.pop || null;
  POP.P = P;
  if (P && !BORROW_K) P.set(!!GAME.pop?.[cur], 0);
  drv.setPop(P ? P.on : null, popToggle);
}
function popToggle() {
  const P = POP.P; if (!P || !drv) return;
  const on = !P.on; P.set(on, popT()); drv.setPop(on, popToggle);
  if (!BORROW_K) { GAME.pop = GAME.pop || {}; if (on) GAME.pop[cur] = 1; else delete GAME.pop[cur]; save(); }
}
const popStep = (dt) => { if (POP.P) POP.P.step(dt); }; // 只有在轉的時候才改東西
const popSend = () => (POP.P && POP.P.on && POP.P.mesh.parent && POP.P.mesh.parent === tripS?.body ? 1 : 0); // 送給朋友：燈開著嗎
function foldStep(dt, v) { // 每一格（開車）
  if (bodyFlags.destsopen && (FOLD.destsopen < 0 ? Math.abs(v) > 4 : (FOLD.destsopen -= dt) <= 0)) destOpen(false);
  if (bodyFlags.moreopen && (FOLD.moreopen < 0 ? Math.abs(v) > 4 : (FOLD.moreopen -= dt) <= 0)) moreOpen(false);
}
$('destTog').addEventListener('click', () => destOpen(!bodyFlags.destsopen));
$('moreTog').addEventListener('click', () => moreOpen(!bodyFlags.moreopen));

// 撞到東西：手機震一下（按過畫面才可以震）
function bump(s) {
  if (s > 3 && navigator.vibrate && navigator.userActivation?.hasBeenActive) try { navigator.vibrate(Math.min(60, s * 8)); } catch { /* 不能震就算了 */ }
}
// 撞到東西（drive.js 的 onImpact）→ 車子凹、玻璃破、燈破、零件掉、冒煙（damage.js，撞車聲也是它叫）；開起來變慢；存起來，到改車廠修好以前一直是壞的
let hurtSaid = false; // 這一趟說過「去改車廠修」了
function crashed(e) {
  if (!CRASH_DAMAGE) { if (e.speed > 3) try { engineAudio.crash({ strength: Math.min(1, Math.max(0.05, (e.speed - 2) / 24)), glass: 0, pan: 0 }); } catch { /* 沒聲音也沒關係 */ } return; } // 撞爛關掉：只有撞車聲
  const dmg = tripS?.dmg;
  if (!dmg || !drv) return;
  const r = dmg.hit(e);
  if (!r) return;
  drv.setDamage(dmg.perf);
  GAME.dmg[cur] = dmg.state; save();
  if (dmg.health < 0.5 && !hurtSaid) { hurtSaid = true; drv.toast(`車子撞壞了：開去${SHOP_NAME}修`, 2600); }
}
// 開進哪裡（drive.js 的 onZone）：上快速道路說一聲可以開多快
function arrive(name, inside) {
  if (!inside || !DRIVE.on || !home) return;
  if (name === 'orbay' && !home.ob && !liftOK(cur)) { home.ob = true; drv.toast('越野車車庫：開進去停在黃線的格子裡', 2800); } // 第 6 批
  if (name === 'offroad' && !home.or) { home.or = true; drv.toast('到越野車場了！越野車行買越野車，起跑區比越野賽', 2800); } // 第 4 批
  if (name === 'neihu' && !home.nhs) { home.nhs = true; drv.toast('到港墘站了！上面是捷運文湖線，可以下車走走', 2800); } // 內湖（neihu.js）
  if (name === 'mountain' && !home.mt && VIL.homeSites?.[HOME.slot]?.via !== 'mountain') { home.mt = true; drv.toast(`到山頂了！海拔 ${Math.round(VIL.mountain?.top || 100)} 公尺，下車去涼亭看風景`, 2800); } // 山（mountain.js）；第 21 批：你家就在山頂不用說
  if (name === 'highway' && !home.hw) { home.hw = true; drv.toast(`上快速道路了：油門踩到底，看 ${CARS[cur].btn[0]} 開得到幾 km/h！`, 2800); }
}

// ---- 爬山計時賽（mountain.js）：往上開過山腳的起點門開始計時，開過山頂的終點門（或開進山頂）停；每台車記最快的（GAME.best.hill）----
const HILL = { on: false, t: 0, doneT: 0, prev: -1, drv: null, el: null, tm: null, bs: null, shown: '', pr: { s: 0, d: 0, h: 0, i: 0, t: 0, side: 0 } };
const hillFmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
function hillHud(on) {
  if (on && !HILL.el) {
    const st = document.createElement('style'); st.textContent = '.hill-t{position:absolute;top:58px;left:10px;z-index:4;min-width:120px;padding:7px 13px 8px;border-radius:16px;background:rgba(14,15,18,0.66);color:#F2F3F5;font-family:"Noto Sans TC","PingFang TC",sans-serif;line-height:1.2;pointer-events:none;-webkit-user-select:none;user-select:none}.hill-t small{display:block;font-size:13px;font-weight:600;color:#9FE0B5}.hill-t b{display:block;font:700 30px/1.1 "Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:.02em;font-variant-numeric:tabular-nums}.hill-t span{display:block;font-size:13px;font-weight:600;color:#C6CAD1}body:not(.driving) .hill-t{display:none}';
    document.head.appendChild(st);
    const el = document.createElement('div'); el.className = 'hill-t'; el.hidden = true;
    const lb = document.createElement('small'); lb.textContent = '爬山計時賽'; HILL.tm = document.createElement('b'); HILL.bs = document.createElement('span');
    el.append(lb, HILL.tm, HILL.bs); stage.appendChild(el); HILL.el = el;
  }
  if (HILL.el) HILL.el.hidden = !on;
}
function hillStop(why) {
  if (!HILL.on) return;
  HILL.on = false; hillHud(false); ghHillStop(); // 鬼影車（ghost.src.js）也收掉
  if (why && drv) drv.toast(why, 2200);
}
function hillStep(t, dt) {
  const M = VIL?.mountain; if (!M || !drv) return;
  if (HILL.drv !== drv) { HILL.drv = drv; HILL.prev = -1; hillStop(); ghHillStop(); } // 換了一台、重新出門、比賽回來
  if (t.paused || t.auto || jailed() || (walker && walker.mode === 'walk') || ciRace || orRace) { HILL.prev = -1; hillStop(HILL.on ? '爬山計時賽取消了' : null); if (HILL.doneT > 0) { HILL.doneT = 0; hillHud(false); } return; } // 下車：結果也收起來
  const tr = M.trial, onM = M.inMountain(t.x, t.z) || M.onRoad(t.x, t.z);
  const p = onM ? M.road.project(t.x, t.z, 12, HILL.pr) : null, s = p && p.i >= 0 ? p.s : -1;
  if (!HILL.on) {
    if (s >= 0 && HILL.prev >= 0 && HILL.prev < tr.s0 && s >= tr.s0 && p.d < 6 && t.v > 0.5) { // 往上開過起點
      HILL.on = true; HILL.t = 0; HILL.shown = ''; hillHud(true);
      const b = GAME.best.hill[cur]; HILL.bs.textContent = b ? `最快 ${hillFmt(b)}` : '開到山頂！';
      drv.toast(GH.arm?.board === 'hill' ? `爬山計時賽開始！追 👻 ${GH.arm.name}` : '爬山計時賽開始！開到山頂', 1800);
      ghHillStart(t); // 錄這一趟、鬼影車出發
    }
  } else {
    HILL.t += dt; ghHillRec(t);
    const fin = (s >= tr.s1 && p.d < 8) || (t.x > M.summit.x0 && t.x < M.summit.x1 && t.z > M.summit.z0 && t.z < M.summit.z1); // 越野車走捷徑上來也算
    if (fin) {
      const tt = Math.round(HILL.t * 100) / 100, old = GAME.best.hill[cur], rec = !old || tt < old;
      if (rec) { GAME.best.hill[cur] = tt; save(); }
      const vs = ghVs('hill', tt); ghHillEnd(t, tt); netHill(tt); // 交給網站的排行榜；一起比賽（net.src.js）
      HILL.on = false; HILL.tm.textContent = hillFmt(tt); HILL.bs.textContent = rec ? '新紀錄！' : `最快 ${hillFmt(old)}`;
      drv.toast((rec ? `到山頂了！${hillFmt(tt)}　新紀錄！` : `到山頂了！${hillFmt(tt)}（最快 ${hillFmt(old)}）`) + vs, 3200);
      HILL.doneT = 4; // 結果留 4 秒
    } else if (HILL.t > 600 || !onM || (s >= 0 && s < tr.s0 - 40)) { HILL.prev = s; hillStop('爬山計時賽取消了'); return; }
    else { const txt = hillFmt(HILL.t); if (txt !== HILL.shown) { HILL.shown = txt; HILL.tm.textContent = txt; } }
  }
  if (!HILL.on && HILL.doneT > 0) { HILL.doneT -= dt; if (HILL.doneT <= 0) hillHud(false); }
  HILL.prev = s;
}

// ---- 下車、上車（walk.js）：停住了按「下車」，車子停在原地；走到哪一台旁邊按「上車」就開那台 ----
// 第 21 批：停在圓塔樓上的空格子裡（差一點點：自己開正再下車，車頭朝外）＝停進去（車子掛到格子上）；一樓沒有格子：停在哪就在哪
function parkSpot(t) {
  const ob = orbaySpot(t); if (ob) return ob; // 第 6 批：越野車停進越野車車庫的格子
  if (!TWR || GV.on || !GAR.floor || !liftOK(cur)) return null; // 第 23 批：朋友家的格子不能停
  const q = garLocal(t.x, t.z), h = wrapPi(t.heading - garLot().heading);
  for (const b of TOWER_BAYS) {
    if (b.f !== GAR.floor || b.road || TWR[b.id] || Math.abs(wrapPi(h - b.heading)) > 0.6) continue; // 歪太多（橫著停、倒車停進去）不算；第 24 批：斜坡的路不能停
    const ca = Math.cos(b.a), sa = Math.sin(b.a), u = q.x * ca + q.z * sa - TOWER.RB, v = q.z * ca - q.x * sa; // 格子的本地：u 往外、v 往旁邊
    if (u < -2.4 || u > 2.6 || Math.abs(v) > 1.5) continue; // 開到底（車頭碰到玻璃）、還在電梯口都算，parkAt 會擺正
    const w = garWorld(b);
    return { x: w.x, z: w.z, heading: t.heading + wrapPi(w.heading - t.heading), tw: b.id };
  }
  return null;
}
function leaveCar() {
  if (!drv || !walker || !DRIVE.on || !tripPose || jailed()) return; // 第 3 批：被抓到了不能下車
  const t = drv.telemetry(); if (t.paused || t.auto) return;
  if (TRAMP.on || (GAR?.floor >= 1 && !inTower(t.x, t.z, 1.2))) { drv.toast('在斜坡上不能下車', 1800); return; } // 第 24 批
  const spot = Math.abs(t.v) < 1 && !BORROW_K ? parkSpot(t) : null; // 第 19 批：借來的車不停進你的格子
  if (spot && (Math.hypot(spot.x - t.x, spot.z - t.z) > 0.02 || Math.abs(wrapPi(spot.heading - t.heading)) > 0.01)) { // 開正（0.6–1 秒）再下車
    const d = drv; drv.parkAt(spot, () => { if (drv === d && DRIVE.on && trip) outAt(spot); }); return;
  }
  outAt(spot);
}
function outAt(spot) {
  const car = walker.getOut(drv, tripS, { key: cur, name: CARS[cur].btn[0], h: carH(cur) }); // 開太快、四邊都沒地方站就不下（walk.js 會說）
  if (!car) return;
  tripPose[cur] = { x: car.x, z: car.z, heading: car.heading, f: floorAt(car.x, car.z) };
  dvoice?.dispose(); dvoice = null; // 熄火（上車再發動）
  tripS?.cabin?.userData.setGauges(0, 0); tripS?.cabin?.userData.setSteer?.(0);
  if (spot?.tw != null && liftOK(cur) && !TWR[spot.tw]) { // 停進格子：車子掛到格子上；開車的收掉（上車再做一個：車子要從格子拿下來）
    dropDrv(); TWR[spot.tw] = cur; tripPose[cur] = towerPose(spot.tw);
    const b = TOWER_BAYS[spot.tw];
    walker.toast(`${CARS[cur].btn[0]} 停好了：${b.f + 1} 樓 ${b.i + 1} 號`, 2200);
  } else if (spot?.bay != null) walker.toast(`${CARS[cur].btn[0]} 停好了：越野車車庫 ${spot.bay + 1} 號格`, 2200); // 第 6 批
  arrangeCars(); keepPark();
}
// 剛下來那台的開車（停著、還沒熄掉的 drv）收掉；walk.js 記的「剛下來那台」也忘掉：上車再做一個（停進格子、走路坐電梯的時候）
function dropDrv() { drv.dispose(); drv = null; home.open = null; obDoor.drv = null; walker.setCars([], { keepParked: false }); }
// 開走停在格子裡的那台：從格子拿下來（完整模型交給 makeDrv 放回村子的場景；輕量車交給 arrangeCars 收掉），那格空出來
function offTower(k) {
  const p = tripPose?.[k]; if (!p || p.tw == null) return null;
  const i = p.tw, pose = { x: p.x, z: p.z, heading: p.heading, f: TOWER_BAYS[i].f };
  TWR[i] = null; tripPose[k] = pose;
  if (GAR.cars[i]) GAR.take(i);
  if (GAR.tk) GAR.tk[i] = null;
  keepPark();
  return pose;
}
// 坐進車裡了（walk.js 的 onGetIn）：剛下來那台＝接著開；出門停在電梯圓台上那台、停進格子那台（完整模型）＝開始開；別台（輕量車）＝換成完整的車開
function onGetIn(car) {
  if (!trip || !DRIVE.on || !tripPose) return;
  gunner?.holster(); // 第 3 批（b3-int）：上車把槍收起來（開車不能用槍）
  if (car.borrow) { netBorrowBoard(car); return; } // 第 19 批：打對密碼，坐進朋友的車
  if (car.drive) { // 剛下來那台：walk.js 已經 drv.resume() 了，引擎再發動
    dvoice?.dispose(); dvoice = engineAudio.voice(cur, { parts: partsOf(cur) });
    arrangeCars(); return;
  }
  if (car.key === tripFull && !drv) {
    const pose = offTower(car.key) || tripPose[car.key];
    makeDrv(pose); towerHint(pose);
    return;
  }
  if (GAME.owned.has(car.key)) switchCar(car.key); else walker.resume();
}
// 換開別台：原本那台停在原地（換成輕量車；停在格子裡的照停），這台載入完整的車（第一次要一下子：「發動中⋯」），從停的地方開
async function switchCar(k) {
  const tok = (boarding = { k });
  const old = tripS;
  const keep = old && !liftOK(cur) && tripPose[cur] ? { p: old.car.position.clone(), r: old.car.rotation.clone() } : null; // 第 4 批：大車（怪獸卡車：有輕量車，可是輕量車只會平平放在 y 0，在越野車場的地形上會陷下去／浮起來）停在原地：擺的樣子（地形上的高度、斜度）先記下來
  if (drv) { drv.dispose(); drv = null; } // dispose 會把車子放回原點：車庫頁收起來，村子裡換輕量車停在 tripPose
  dvoice?.dispose(); dvoice = null;
  old?.dmg?.clearDebris(); // 舊車掉在村子裡的零件、煙收掉（停著的換成輕量車：照存檔也是凹的）
  if (keep) { old.car.position.copy(keep.p); old.car.rotation.copy(keep.r); old.car.updateMatrixWorld(true); PFULL[cur] = { S: old, box: tripBox || fullBox(old) }; } // 完整的車照剛剛的樣子停著（輪子照停好的高度）
  else stowFull(old);
  if (parkShadow) parkShadow.visible = false;
  tripFull = null; arrangeCars();
  let car = built[k] || null;
  if (!car) {
    gtoast(`${CARS[k].btn[0]} 發動中⋯`, 2600);
    try { car = await loadCar(k); } catch (e) { console.error(e); car = null; }
  }
  if (boarding !== tok || !trip || !DRIVE.on || !tripPose) { if (car && built[k] !== car) disposeCar(car); return; } // 等的時候回車庫頁了
  boarding = null;
  if (!car) { walker.resume(); walker.toast('車子發動不了，再按一次「上車」', 2200); return; }
  if (built[k] !== car) { if (built[k]) dispose(k); built[k] = car; scene.add(car.car); }
  if (PFULL[k]) pfullOff(k); // 第 4 批：停著的完整的車（大車換開別台停的）：就開它
  keepRecent(k);
  cur = k; S = car; tripS = car; save();
  const pose = offTower(k) || tripPose[k]; // 停在格子裡的：從格子開出來
  tripBox = fullBox(car);
  makeDrv(pose); towerHint(pose);
  renderWallet(); refreshCarBtns();
}
// 第 21 批：在圓塔裡上車：樓上＝說怎麼下去；一樓門關著＝說開鐵捲門
function towerHint(pose) {
  if (GAR.floor && inTower(pose.x, pose.z)) drv.toast(GAR.liftHere(GAR.floor) ? '倒車回到電梯上，按 1F（或轉到黃線，開斜坡下去）' : '開到電梯旁邊，按「叫電梯」（或開斜坡下去）', 2800); // 第 24 批：樓上也可以走斜坡
  else if (GAR.door.t === 0 && inTower(pose.x, pose.z)) drv.toast('按「開鐵捲門」，開出去！', 2600);
}
// ---- 走進房子（interiors.js，第 2 批）：透天厝（每一層）、一樓的店、超商、福德宮、三合院 ----
// 走到門口往裡面推（walk.js 的 onDoor）→ 慢慢黑掉 → 全黑的時候蓋好這棟的裡面（同一棟每次都一樣，蓋一次幾十毫秒）、第一次進門順便編譯 shader → 慢慢亮
// 裡面是自己的場景（自己的燈；每一層的地板都在 y 0，跟村子的地面重疊：在裡面的時候村子不畫）；人、鏡頭照樣用世界座標
// 碰撞：村子的（walk.js 標 'world'，蓋住房子的地板）拿掉、換這一層的 'interior'；門：換成這一層的出口（大門回到外面門口、樓梯口換樓層）
// 警察局（police.js 的 buildPoliceInterior）、槍店（gunshop.js）：第 3 批（b3-int）開門了（蓋一次留著，不是每次重蓋：indoor.keep）；
// 阿財車行的展示間、阿輝改車廠、你的車庫本來就走得進去（不是門）
const CLOSED = {};
// 阿財車行正面玻璃的自動門（village.js：展示間 frame(−450, 0, −26)，門 x 11.25…13.95 開著）：只給開車的，車子開不進展示間
const DEALER_DOOR = [{ t: 'box', x: -437.4, z: -26.125, hx: 1.45, hz: 0.18, rot: 0, h: 3 }];
function atDoor(d) {
  if (!walker || walker.mode !== 'walk' || doorFade || sleep || !DRIVE.on) return;
  if (indoor) { // 裡面的出口（setDoors 給的是 I.exits 的 door）：大門、樓梯口
    if (indoor.t < 0.4 || indoor.jail) return; // 剛換過來（站在樓梯口旁邊）；關在拘留室裡（門給的是空的，保險）
    const e = (indoor.exits || indoor.I.exits).find((x) => x.door === d); if (!e) return;
    goDoor(() => (e.to === 'outside' ? leaveHouse(e) : houseFloor(e)));
    return;
  }
  if (d.kind === 'police') { // 第 3 批（b3-int）：警察局：通緝中走進去＝自首（一樣關、一樣罰）；平常走進去看看（拘留室的門開著）
    if (police && police.state === 'wanted') { police.surrender(); return; }
    if (police && police.state !== 'free') return;
    goDoor(() => enterStation(false, d)); return;
  }
  if (d.kind === 'gunshop') { goDoor(() => enterGunShop(d)); return; } // 第 3 批（b3-int）：槍店
  if (d.crushed) { walker.toast('房子被壓扁了，等一下才會修好', 1800); return; } // 第 9 批：越野車輾扁的房子（離開一陣子就長回來）
  const info = CLOSED[d.kind] ? null : interiorFor(d);
  if (!info) { walker.toast(CLOSED[d.kind] || `${d.name ? d.name + '：' : ''}門鎖著`, 1800); return; }
  goDoor(() => enterHouse(d));
}
// 門口：走路停住（HUD 收起來，人還在門口）、慢慢黑掉；全黑的時候 act()（回傳 { wait: 蓋好、編譯好的 Promise, say: 亮的時候說的話 }）
function goDoor(act) {
  walker.pause();
  doorFade = { t: 0, T: calm ? 0.12 : 0.3, phase: 0, act, wait: false, say: null };
  fader('').style.opacity = '0';
}
function fadeStep(dt) {
  const g = doorFade; g.t += dt;
  if (g.phase === 0) {
    fadeEl.style.opacity = Math.min(1, g.t / g.T).toFixed(3);
    if (g.t < g.T) return;
    g.phase = 1; g.t = 0; g.wait = true;
    let r = null;
    try { r = g.act(); } catch (e) { console.error(e); }
    g.say = r?.say || null;
    Promise.race([Promise.resolve(r?.wait), new Promise((ok) => setTimeout(ok, 4000))]).catch((e) => console.error(e)).then(() => { g.wait = false; });
    if (DRIVE.on && walker) walker.resume(); // 黑著的時候就接著走（鏡頭先放好；HUD 在黑幕下面）
    return;
  }
  if (g.phase === 1) {
    if (g.wait || g.t < 0.08) return;
    g.phase = 2; g.t = 0;
    if (g.say && walker) walker.toast(g.say, 2000);
  }
  fadeEl.style.opacity = Math.max(0, 1 - g.t / g.T).toFixed(3);
  if (g.t >= g.T) { doorFade = null; fadeEl.style.display = 'none'; }
}
// 黑掉的那一層（睡覺、門口共用）：text＝中間的字
function fader(text) {
  if (!fadeEl) {
    fadeEl = document.createElement('div'); fadeEl.className = 'sleep-fade';
    fadeEl.style.cssText = 'position:absolute;inset:0;z-index:40;background:#050506;opacity:0;pointer-events:none;display:none;place-items:center;color:#9AA1AC;font:700 30px/1 "Noto Sans TC",sans-serif;letter-spacing:.25em';
  }
  fadeEl.textContent = text;
  stage.append(fadeEl); fadeEl.style.display = 'grid';
  return fadeEl;
}
function enterHouse(b) {
  let I = null;
  try { I = buildInterior(b, { renderer, quality: roomQ }); } catch (e) { console.error(e); I = null; }
  if (!I) return { say: `${b.name ? b.name + '：' : ''}門鎖著` };
  const sc = new THREE.Scene(); sc.name = 'indoor'; sc.background = I.background; sc.add(I.group);
  indoor = { b, I, scene: sc, t: 0, dist0: walker.cameraDist, folks: [], kind: 'house' };
  sc.add(walker.character.group); // 你搬進房子的場景（出去再搬回村子）
  walker.removeColliders('world'); walker.setCarReach(false); // 村子的碰撞（蓋住房子的地板）拿掉；車停在外面（隔著牆）不給「上車」
  houseSet(I.spawn);
  return { wait: renderer.compileAsync ? renderer.compileAsync(sc, dcam) : null, say: I.name };
}
// 這一層：碰撞、出口（門）、鏡頭（房間放得下多遠、天花板多高）、人站到哪裡
function houseSet(spawn) {
  const I = indoor.I;
  walker.removeColliders('interior'); walker.addColliders(I.colliders, 'interior');
  if (indoor.kind === 'police') stationFolks(); else if (indoor.kind === 'house') houseFolks(); // 槍店的店員 gunshop.js 自己有
  walker.setDoors(indoor.jail ? [] : (indoor.exits || I.exits).map((e) => e.door)); // 關在拘留室：沒有門
  walker.setCamera({ maxY: I.camera.ceiling, dist: Math.min(indoor.dist0, I.camera.maxDist) });
  walker.teleport(spawn); indoor.t = 0;
}
function houseFloor(e) {
  const f = indoor.I.setFloor(e.to);
  houseSet(e.spawn);
  const rooms = [...new Set(f.rooms.map((r) => r.name).filter((n) => n && !/走道|樓梯/.test(n)))].slice(0, 3);
  return { say: rooms.length ? `${f.label} · ${rooms.join('、')}` : f.label };
}
// 走出大門（e＝那個出口：人站到門外 e.spawn）；e＝null：直接回車庫、換趟（人不用放）
function leaveHouse(e) {
  const H = indoor; if (!H) return null;
  indoor = null;
  walker.removeColliders('interior'); walker.addColliders(VIL.colliders, 'world');
  walker.setDoors('village'); walker.setCarReach(true);
  walker.setCamera({ maxY: null, dist: H.dist0 });
  TR.scene.add(walker.character.group);
  for (const f of H.folks) f.C.dispose();
  if (H.kind === 'gunshop') gsLeave(); // 第 3 批（b3-int）：櫃台關掉、靶場停、槍換回村子
  if (!H.keep) H.I.dispose(); // 警察局、槍店蓋一次留著
  if (e) walker.teleport(e.spawn);
  walker.toast('', 1); // 裡面說的話（幾樓、哪一間）還掛著的話收掉
  return null;
}
// 房子裡的人（interiors.js 的 spots）：店裡櫃台後面的老闆、拜拜的人、沙發／椅子上坐一個（這一層最多兩個；同一棟、同一層每次都是同樣的人）
//   站著的擋人（圓 0.3 公尺，跟這一層的碰撞一起：'interior'）；坐著的在家具上（家具本來就擋）
const FOLK_POSE = { speed: 0 };
function houseFolks() {
  const H = indoor, I = H.I, sp = I.spots, kind = I.info?.kind || H.b.kind;
  for (const f of H.folks) f.C.dispose();
  H.folks.length = 0;
  let q = (Math.imul(Math.round(H.b.x * 10), 73856093) ^ Math.imul(Math.round(H.b.z * 10), 19349663) ^ Math.imul(I.floor + 1, 83492791)) >>> 0;
  const rnd = () => { q = (q + 0x6d2b79f5) >>> 0; let t = q; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[(rnd() * a.length) | 0], want = [];
  if (sp.counter?.length) want.push([sp.counter[0], 'idle', true]); // 老闆（大人）
  if (sp.pray?.length && rnd() < 0.6) want.push([pick(sp.pray), 'idle']);
  if (want.length < 2 && sp.sit?.length && rnd() < 0.6) want.push([pick(sp.sit), 'sit']);
  const cols = [];
  for (const [p, st, adult] of want.slice(0, 2)) {
    let C = null, L = randomLook(rnd);
    for (let k = 0; adult && L.age === 'kid' && k < 8; k++) L = randomLook(rnd);
    try { C = buildCharacter(L, { state: st }); } catch (e) { console.error(e); continue; }
    const back = kind === 'temple' && st === 'idle' && p !== sp.counter?.[0] ? 0.45 : 0; // 廟裡拜拜：站在拜墊後面（沒有跪的動作，站在墊子上腳會陷進去）
    const px = p.x - Math.cos(p.heading) * back, pz = p.z + Math.sin(p.heading) * back;
    C.group.position.set(px, st === 'sit' ? Math.max(0, (p.y ?? 0.45) - 0.45) : 0, pz); C.group.rotation.set(0, p.heading, 0);
    C.update(0, { speed: 0, state: st }); C.update(0.05, FOLK_POSE);
    H.scene.add(C.group); H.folks.push({ C, st });
    if (st !== 'sit') cols.push({ t: 'circle', x: px, z: pz, r: 0.3, h: 1.7 });
  }
  if (cols.length) walker.addColliders(cols, 'interior');
}
// 載入畫面：字型、共用的貼圖／PMREM／材質；再蓋一棟透天厝和你一起編譯（所有房子共用同一組材質、同一組燈：之後每一棟都不用再編譯）
let HOUSE_WARM = null;
async function warmHouses() {
  const T0 = performance.now();
  await interiorFonts();
  buildInterior(null, { renderer, quality: roomQ });
  const T1 = performance.now();
  const b = VIL.buildings.find((x) => interiorFor(x)?.kind === 'house'), I = b ? buildInterior(b, { renderer, quality: roomQ }) : null;
  if (I) {
    const sc = new THREE.Scene(); sc.add(I.group);
    const me = meChar && !meChar.group.parent ? meChar.group : null; if (me) sc.add(me);
    try { if (renderer.compileAsync) await renderer.compileAsync(sc, dcam); else renderer.compile(sc, dcam); } finally { me?.removeFromParent(); I.dispose(); }
  }
  HOUSE_WARM = { shared: +(T1 - T0).toFixed(0), compile: +(performance.now() - T1).toFixed(0) };
}

// ==== 第 21 批：圓塔的電梯（tower.js；Nick 2026-10-17「可以自行決定要停在哪一層可以自己搭電梯上去」，草稿 https://claude.ai/artifact/GZcpBA7kY8HVfa7zYk3Si4）====
//   開（走）到電梯圓台上停住 → 面板（直拿在左上、橫拿在上面中間）按幾樓（2F–6F 寫還有幾格空的）→ 電梯載著你（和車、圓台上停著的車）上去
//   開車上樓：電梯自己轉到最近的空格子（車頭朝它）；◀ ▶ 一次轉 45 度；回 1 樓：自己轉到車頭對著鐵捲門
//   坐電梯的時候：開車的、走路的停住（drive.js／walk.js 的 pause），車子、人、鏡頭用 attach 掛到圓台上跟著動；第三人稱的鏡頭放在電梯井裡（在你後面上面，不會穿過樓板）
//   電梯不在你這層：電梯井旁邊按「叫電梯」（圓台上停著的車一起下來）
const EL_R = 1.4; // 車子中心離圓台中心多近才算開上電梯（按了樓層：差一點點自己開到正中間）
const EL_CALL = { label: '叫電梯', icon: 'lift', onClick: () => elCall() };
const elFree = (f) => { let n = 0; for (const b of TOWER_BAYS) if (b.f === f && !b.road && !TWR?.[b.id]) n++; return n; }; // 第 f 層還有幾格空的（第 24 批：每層 7 格，口那一格是路）
const elGuest = (f) => { let n = 0; for (const b of TOWER_BAYS) if (b.f === f && GV.want?.[b.id]) n++; return n; }; // 第 23 批：朋友家第 f 層停了幾台
// 現在可以按樓層嗎：0 不行；1 開車停在圓台上；2 開車停在圓台上、可是這台不能坐電梯（大車、借來的）；3 走路站在圓台上
function elWho() {
  if (!trip || !DRIVE.on || !GAR || !TWR || EL.ride || indoor || sleep || doorFade || boarding || jailed() || !GAR.liftHere(GAR.floor)) return 0;
  if (drv && walker?.mode === 'off') {
    const t = drv.telemetry(); if (t.paused || t.auto || Math.abs(t.v) > 1) return 0;
    const q = garLocal(t.x, t.z); if (Math.hypot(q.x, q.z) > EL_R) return 0;
    return liftOK(cur) && !BORROW_K && !GV.on ? 1 : 2; // 第 23 批：朋友家：你的車只能停一樓
  }
  if (walker?.mode === 'walk') { const t = walker.telemetry(), q = garLocal(t.x, t.z); return Math.hypot(q.x, q.z) < TOWER.RP - 0.35 ? 3 : 0; }
  return 0;
}
// 面板（garage.css .elpanel）：3 × 2 的樓層（4F 5F 6F／1F 2F 3F），樓上開車的時候多一排 ◀ ▶
function elPanel() {
  if (EL.panel) return EL.panel;
  const el = document.createElement('div'); el.className = 'elpanel'; el.hidden = true;
  el.innerHTML = '<div class="elg"></div><div class="elr"><button type="button" data-r="1" aria-label="往左轉">◀</button><button type="button" data-r="-1" aria-label="往右轉">▶</button></div>';
  const g = el.querySelector('.elg'), btn = [];
  for (const f of [3, 4, 5, 0, 1, 2]) { const b = document.createElement('button'); b.type = 'button'; b.dataset.f = f; b.innerHTML = `${f + 1}F${f ? '<small></small>' : ''}`; g.appendChild(b); btn[f] = b; }
  el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.f != null) elGo(+b.dataset.f, null); else elGo(GAR.floor, (+b.dataset.r * Math.PI) / 4); });
  for (const ev of ['pointerdown', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); // 按面板不要變成拖鏡頭
  stage.appendChild(el);
  return (EL.panel = { el, btn, row: el.querySelector('.elr'), sig: NaN });
}
// 每一格：面板開關、每一樓還有幾格（有變才改字）
function elPanelStep() {
  const w = elWho(); if (!w && !EL.panel) return;
  const P = elPanel(); if (P.el.hidden === !!w) { P.el.hidden = !w; stage.classList.toggle('el-on', !!w); } // 面板出來：提示字往下一點（不要蓋在面板上）
  if (!w) return;
  const TW = twrNow(); let sig = GAR.floor * 4 + w + (GV.on ? 7 : 0); for (let i = 0; i < TW.length; i++) sig = (sig * 3 + (TW[i] ? 1 : 0)) % 1000000007;
  if (sig === P.sig) return; P.sig = sig;
  for (let f = 0; f < TOWER.NF; f++) { P.btn[f].classList.toggle('on', f === GAR.floor); if (f) P.btn[f].querySelector('small').textContent = GV.on ? `${elGuest(f)} 台` : `空 ${elFree(f)}`; } // 第 23 批：朋友家寫他每一層有幾台
  P.row.hidden = !(GAR.floor > 0 && w === 1);
}
// 按了樓層（F）或 ◀ ▶（turn＝轉多少；F＝這一層）
function elGo(F, turn) {
  const w = elWho(); if (!w) return;
  if (w === 2) { drv.toast(GV.on ? '你的車只能停在一樓：下車走路，坐電梯去看他的車' : BORROW_K ? '借來的車不能停在你家' : '這台太大了，不能坐電梯', 2600); return; }
  if (GV.on && padCars(GAR.floor, null).length) { walker.toast('你的車停在電梯上：先開下來（你的車只能停一樓）', 2600); return; } // 第 23 批
  if (F === GAR.floor && turn == null) { (w === 3 ? walker : drv).toast(F ? `這裡就是 ${F + 1} 樓` : '這裡就是 1 樓', 1600); return; }
  const big = padCars(GAR.floor, w === 1 ? cur : null).find((k) => !liftOK(k)); // 越野車停在圓台上：電梯載不動（不然會被載上樓）
  if (big) { (w === 3 ? walker : drv).toast(`${CARS[big].btn[0]}太大了，電梯載不動：先開走`, 2400); return; }
  if (w === 1) { // 開車：差一點點先開到正中間（方向不變）
    const t = drv.telemetry(), c = garWorld({ x: 0, z: 0 }), d = drv;
    if (Math.hypot(t.x - c.x, t.z - c.z) > 0.02) { drv.parkAt({ x: c.x, z: c.z, heading: t.heading }, () => { if (drv === d && DRIVE.on && trip && !EL.ride) elRide(F, turn, true); }); return; }
  }
  elRide(F, turn, true);
}
// 電梯去第 F 層：me＝你坐上去（開車或走路）；圓台上停著的車一起；turn＝轉多少（null：開車上樓轉到最近的空格子、回 1 樓轉到車頭朝鐵捲門）
function elRide(F, turn, me) {
  if (EL.ride || GAR.lift.busy) return;
  const LH = garLot().heading, P = GAR.platform, rot0 = GAR.lift.rot;
  const driving = me && !!drv && walker.mode === 'off';
  let dr = turn ?? 0;
  if (driving && turn == null) {
    const hl = wrapPi(drv.telemetry().heading - LH); // 車頭（塔的本地）
    if (F > 0) { let best = null; for (const b of TOWER_BAYS) if (b.f === F && !b.road && !TWR[b.id]) { const d = wrapPi(b.heading - hl); if (best === null || Math.abs(d) < Math.abs(best)) best = d; } dr = best ?? 0; }
    else dr = wrapPi(-hl);
  }
  if (me && !driving && drv && !BORROW_K) { dropDrv(); parkFull(); arrangeCars(); } // 下了車走去坐電梯：剛下來那台照停好的樣子停著（到別層 walk.js 不會再當它在旁邊；在圓台上就一起坐）
  const from = me ? GAR.floor : GAR.lift.floor, pads = padCars(from, drv && walker.mode === 'off' ? cur : null); // 第 24 批：正在開的那台不算（從斜坡上樓叫電梯：它的 tripPose 還是一樓圓台上）
  const R = { F, n: tripNo, me, drive: driving, turn: turn != null, riders: [], cam: false };
  if (!GAR.liftTo(F, rot0 + dr, () => elArrive(R))) return;
  EL.ride = R;
  const add = (o, k, hw) => { if (!o) return; R.riders.push({ o, k, hl: wrapPi(hw - LH - rot0) }); P.attach(o); if (k) EL.keys.add(k); };
  if (driving) { drv.pause(); add(tripS.car, cur, drv.telemetry().heading); }
  else if (me) { const t = walker.telemetry(); walker.pause(); add(walker.character.group, null, t.heading); }
  for (const k of pads) { const p = tripPose[k]; add(k === tripFull ? tripS.car : PFULL[k] ? PFULL[k].S.car : LODS[k]?.lod?.car, k, p.heading); }
  if (pads.includes(tripFull) && parkShadow) parkShadow.visible = false;
  if (me) { // 鏡頭：第一人稱跟著掛上去；第三人稱放在電梯井裡（你後面 2.9 公尺、高一點，看著圓台中間）
    R.cam = true;
    if ((driving ? drv.cameraMode : walker.cameraMode) === 'eye') P.attach(dcam);
    else {
      const h = R.riders[0]?.hl || 0, v = new THREE.Vector3();
      P.add(dcam); dcam.position.set(-Math.cos(h) * 2.9, driving ? 2.6 : 2.3, Math.sin(h) * 2.9); dcam.quaternion.identity();
      P.updateMatrixWorld(true); dcam.lookAt(P.localToWorld(v.set(0, 0.8, 0)));
    }
    (driving ? drv : walker).toast(R.turn ? '電梯轉一下⋯' : `電梯去 ${F + 1} 樓⋯`, 1400); // 全螢幕的提示（跟到了那一句同一個地方）
  }
}
// 電梯停好了：掛在圓台上的放回村子的場景（世界的位置、方向照圓台轉的算），開車的、走路的接著動
function elArrive(R) {
  if (EL.ride !== R) return;
  EL.ride = null;
  const LH = garLot().heading, rot = GAR.lift.rot, F = R.F, v = new THREE.Vector3();
  if (R.me) GAR.setFloor(F);
  let me = null;
  for (const r of R.riders) {
    r.o.getWorldPosition(v); TR.scene.attach(r.o);
    const pose = { x: v.x, z: v.z, heading: LH + rot + r.hl };
    if (!r.k) me = pose; // 走路的你
    else if (R.drive && r.k === cur) { me = pose; tripPose[cur] = { ...pose, f: F }; }
    else tripPose[r.k] = { ...pose, f: F };
  }
  EL.keys.clear();
  if (R.cam && dcam.parent === GAR.platform) dcam.removeFromParent();
  if (me && R.drive && drv) { drv.teleport(me); drv.resume(); }
  else if (me && walker) { walker.teleport(me, { keepCamera: false }); walker.resume(); }
  if (tripFull && tripPose[tripFull] && !(R.drive && tripFull === cur) && R.riders.some((r) => r.k === tripFull)) parkFull(); // 圓台上停著的完整的車：照新的位置放好、影子
  liftChanged(); keepPark();
  if (!R.me || R.turn) return;
  if (!R.drive) walker.toast(F ? (GV.on ? `${F + 1} 樓：${GV.n}的車 ${elGuest(F)} 台（只能看）` : `${F + 1} 樓`) : '1 樓', GV.on && F ? 2400 : 1600);
  else if (F) drv.toast(elFree(F) ? `${F + 1} 樓：往前開進空的格子，停好再下車` : `${F + 1} 樓停滿了（轉到黃線，可以開斜坡下去）`, 2600);
  else drv.toast(GAR.door.t === 0 ? '1 樓：按「開鐵捲門」開出去' : '1 樓', 2200);
}
// 叫電梯：電梯不在你這層（沒在動）、你在電梯井旁邊（離中間 RI＋2.6 公尺以內）
function elCallAct(x, z) {
  if (!GAR || !TWR || EL.ride?.me) return null; // 叫來的電梯在動：「電梯動作中⋯」
  const q = garLocal(x, z); if (!GAR.isInside(q.x, q.z) || Math.hypot(q.x, q.z) > TOWER.RI + 2.6) return null;
  if (GAR.lift.busy) return LIFT_BUSY;
  return GAR.liftHere(GAR.floor) ? null : EL_CALL;
}
function elCall(pre = '') { // pre：第 24 批，從斜坡開進樓上（「3 樓：電梯上來了⋯」）
  if (!GAR || GAR.lift.busy || EL.ride || GAR.liftHere(GAR.floor)) return;
  const big = padCars(GAR.lift.floor, drv && walker.mode === 'off' ? cur : null).find((k) => !liftOK(k));
  if (big) { (drv && walker.mode === 'off' ? drv : walker).toast(`${CARS[big].btn[0]}太大了，電梯載不動`, 2400); return; }
  const dn = GAR.lift.floor > GAR.floor; elRide(GAR.floor, 0, false);
  (drv && walker.mode === 'off' ? drv : walker).toast(pre + (dn ? '電梯下來了⋯' : '電梯上來了⋯'), pre ? 2200 : 1600);
}
// 不坐了（回車庫頁、重新出門、被抓）：掛在圓台上的放回場景、鏡頭拿下來、面板收起來（電梯自己動完）
function elEnd() {
  const R = EL.ride; EL.ride = null; EL.keys.clear();
  if (R) for (const r of R.riders) if (r.o.parent === GAR.platform) TR.scene.attach(r.o);
  if (dcam?.parent === GAR?.platform) dcam.removeFromParent();
  if (EL.panel) { EL.panel.el.hidden = true; stage.classList.remove('el-on'); }
}
function stopLiftSnd() { for (const k of Object.keys(liftSnd)) { liftSnd[k]?.stop(); delete liftSnd[k]; } }
// tower.js 的 onLift：開始動（馬達聲）、停好（聲音停）；兩個時候碰撞（電梯井）、走得到的車都換
function onLift(what) {
  stopLiftSnd();
  if (what === 'start') liftSnd.tower = engineAudio.lift();
  liftChanged();
}
function liftChanged() {
  if (!trip || !tripPose || !GAR) return;
  if (home) home.open = null; // 開車的 'garage' 碰撞下一格重給（這一層、電梯在不在這層）
  if (walker) { walker.setGarage(GAR); walker.removeColliders('garcam'); walker.addColliders(garCamCols(), 'garcam'); obDoor.walk = null; } // 只擋鏡頭的（天花板、小房子的屋頂）只給走路的
  arrangeCars(); // 停著的車的碰撞（同一層的才擋）、走路可以上的車
}
// 只擋鏡頭的盒子（世界座標、世界的高度；drive.js 不看 y0，不要給開車的）：tower.js 的（這一層的天花板；一樓：小房子的屋頂、門楣）＋小房子門洞上面那塊牆
//   （第三人稱在小房子裡面，鏡頭不會從門洞穿出去、被門楣擋掉半個畫面）
function garCamCols() {
  const cols = GAR.cameraColliders(true);
  if (GAR.floor) return cols;
  const D = GAR.zones.houseDoor, w = garWorld({ x: D.x, z: D.z }), by = GAR.group.position.y;
  cols.push({ t: 'box', x: w.x, z: w.z, hx: D.hx, hz: D.hz + 0.02, rot: garLot().heading, y0: by + D.h, h: by + GAR.zones.house.ridge });
  return cols;
}

// ---- 小房子：床邊按「睡覺」→ 躺到床上、畫面黑掉 →「睡飽了！」站在床邊 ----
function goSleep() {
  if (sleep || !walker || walker.mode !== 'walk' || !DRIVE.on || !GAR) return;
  walker.pause(); // HUD 收起來、不吃按鍵（角色還在）：躺到床上
  const B = GAR.spots.bed, w = garWorld({ x: B.feet.x, z: B.feet.z, heading: B.heading }), ch = walker.character, by = GAR.group.position.y; // by：塔的一樓多高（山頂那間）
  ch.group.visible = true; ch.group.position.set(w.x, by + B.y, w.z); ch.group.rotation.set(0, w.heading, 0); ch.update(1 / 60, { speed: 0, state: 'fall' });
  // 鏡頭（走路的停住了不會動）：站在床尾、靠門那邊高一點，斜斜看著躺在床上的你（第一人稱的時候眼睛前面是牆）
  const hx = B.feet.x - B.head.x, hz = B.feet.z - B.head.z, l = Math.hypot(hx, hz) || 1, ux = hx / l, uz = hz / l;
  const cv = garWorld({ x: B.feet.x + ux * 1.25 - uz * 1.2, z: B.feet.z + uz * 1.25 + ux * 1.2 }), cl = garWorld({ x: (B.x + B.head.x) / 2, z: (B.z + B.head.z) / 2 });
  dcam.position.set(cv.x, by + 1.75, cv.z); dcam.lookAt(cl.x, by + B.y + 0.15, cl.z);
  fader('Zzz⋯').style.opacity = '0';
  sleep = { t: 0, woke: false };
}
function sleepStep(dt) {
  const s = sleep, T1 = calm ? 0.4 : 1.2, T2 = T1 + 1.3, T3 = T2 + (calm ? 0.3 : 0.9); // 慢慢黑掉、黑著、慢慢亮
  s.t += dt;
  if (!s.woke) walker.character.update(dt, { speed: 0, state: 'fall' });
  fadeEl.style.opacity = (s.t < T1 ? s.t / T1 : s.t < T2 ? 1 : Math.max(0, 1 - (s.t - T2) / (T3 - T2))).toFixed(3);
  if (!s.woke && s.t >= T2) { s.woke = true; walker.teleport(garWorld(GAR.spots.wake)); walker.resume(); walker.toast('睡飽了！', 2400); }
  if (s.t >= T3) { sleep = null; fadeEl.style.display = 'none'; }
}
function endSleep() { sleep = null; if (fadeEl) fadeEl.style.display = 'none'; }
// 走路在你家裡面：床邊（睡覺）、衣櫃前面（換衣服）、電梯井旁邊（叫電梯）的大按鈕；頭上多高有東西（鏡頭別穿過天花板）；小房子裡面自動第一人稱
function homeWalk() {
  const t = walker.telemetry(), q = garLocal(t.x, t.z), Z = GAR.zones, inT = GAR.isInside(q.x, q.z);
  let act = null;
  if (inT && !GAR.floor && !GV.on) { if (inBox(Z.bedSide, q.x, q.z)) act = SLEEP_ACT; else if (inBox(Z.dress, q.x, q.z)) act = DRESS_ACT; } // 第 23 批：朋友家的床、衣櫃不能用
  if (!act && inT) act = elCallAct(t.x, t.z); // 第 21 批：電梯不在這層
  if (!act && !t.near) act = orbayAct(t); // 第 6 批：站在越野車車庫門口（旁邊沒有車可以上）：「開鐵捲門」
  if (!act) act = hideAct(t.x, t.z, 0.3); // 第 3 批（b3-int）：通緝中躲回車庫：「關鐵捲門」
  walker.setAction(act);
  const c = OB && OB.inside(t.x, t.z, -0.35) ? OB.size.ceil - 0.25 : GAR.group.position.y + GAR.ceilingAt(q.x, q.z); // 第 6 批：在越野車車庫裡面，鏡頭不要穿過天花板；第 21 批：塔的這一層
  if (c !== gcam.maxY) { gcam.maxY = c; walker.setCamera({ maxY: isFinite(c) ? c : null }); }
  const inHouse = !GAR.floor && inBox(Z.house, q.x, q.z, -0.05);
  if (CABIN_EYE && inHouse !== gcam.house) {
    gcam.house = inHouse;
    if (inHouse && walker.cameraMode === 'follow') { gcam.auto = true; walker.setCamera({ mode: 'eye' }); }
    else if (!inHouse && gcam.auto) { gcam.auto = false; if (walker.cameraMode === 'eye') walker.setCamera({ mode: 'follow' }); }
  }
}

// ---- 你家：鐵捲門（碰撞跟著門開關）、HUD 的大按鈕（開鐵捲門）、走遠了門自己關 ----
function homeAct(t) {
  const p = garLocal(t.x, t.z), Z = GAR.zones, D = Z.door.x; // 門在 x = D
  const inside = GAR.isInside(p.x, p.z) && !GAR.floor, front = p.x > D && p.x < D + 16 && Math.abs(p.z) < 9; // 一樓、門前面那塊
  if ((inside || front) && GAR.door.t === 0 && !GAR.door.moving) return OPEN_ACT;
  return drv ? hideAct(t.x, t.z, Math.max(drv.carInfo.nose, -drv.carInfo.tail)) : null; // 第 3 批（b3-int）：通緝中開進車庫：「關鐵捲門」
}
function openDoor() {
  if (!GAR || GAR.door.t > 0 || GAR.door.moving) return;
  GAR.door.open(calm ? 1.2 : 2.2); drv?.setAction(null);
}
// 每一格（走路的時候也要）：開車的碰撞跟著門、電梯（開到 0.9 才不擋車；走路的 walk.js 自己跟）；人或車離門 30 公尺以上、門下面沒有停車 → 遙控器關門
function doorStep() {
  const open = GAR.door.t >= 0.9;
  if (drv && open !== home.open) { drv.removeColliders('garage'); drv.addColliders(garCols(open), 'garage'); home.open = open; }
  if (GAR.door.t !== 1 || GAR.door.moving || !tripPose) return;
  const onFoot = !!walker && walker.mode !== 'off', t = onFoot ? walker.telemetry() : drv ? drv.telemetry() : null; if (!t) return; // 換車中（載入）先不管
  const D = GAR.zones.door.x, p = garLocal(t.x, t.z); if (Math.hypot(p.x - D, p.z) <= 30 || GAR.isInside(p.x, p.z)) return; // 在塔裡面（樓上）也不關
  for (const k of GAME.owned) {
    const q = tripPose[k]; if (!q || (k === tripFull && !onFoot)) continue; // 開著的那台就是你
    const c = garLocal(q.x, q.z); if (c.x > D - 3.2 && c.x < D + 3.6 && Math.abs(c.z) < 5.5) return; // 車停在門下面：不關
  }
  GAR.door.close(calm ? 1 : 1.8);
}

// ==== 第 24 批：外面繞圈的斜坡（tower.js TOWER_RAMP；Nick 2026-10-20「車庫外圍的那個外面那一圈的路可以弄了」，草稿 https://claude.ai/artifact/Xbe4taBBqkM6gL9VDyV3xb，Nick 選「照草稿」）====
//   開出鐵捲門右轉，從塔的右前方（45 度）開上去，往上開塔在右手邊，半圈上一層；每一層的口開進去就是那一層（電梯不在這層：自己叫上來）；從樓上的口開出來就是斜坡
//   TRAMP.on＝開在斜坡上（u＝從起點轉了多少：車子的高度、上面那一圈的天花板都照它）；在斜坡上 GAR.floor＝最近的那一層（口那邊的地板、碰撞、停著的車才接得上）
//   碰撞：開在斜坡上、在樓上＝'ramp'（矮牆、護欄；這一層的口開著）；地上看（village.js）：低的那半圈實心（rcol）、起點橫的一道（mcol：不能開上去的時候擋）：開在斜坡上、在樓上的時候 off（塔蓋在這裡的那座）
//   不能開上去：怪獸卡車（電梯也不能坐）、借來的車、在朋友家；走路也不行；在斜坡上不能下車
const TRAMP = { on: false, u: 0, lu: 1, cols: -2, cd: null, cg: -1, call: -1, warnT: 0 };
const rampOK = () => liftOK(cur) && !BORROW_K && !GV.on;
const rampRef = () => (TRAMP.on ? TRAMP.u : GAR && GAR.floor >= 1 ? GAR.floor * Math.PI : null); // 斜坡上的點照哪一圈算：開在斜坡上＝那一圈；在樓上＝那一層的口；一樓、外面＝null（地面）
// 塔本地的點（lx, lz）在斜坡上多高（本地 y；ref 那一圈；起點前面＝null）
function rampAtY(lx, lz, ref) { const u = ref + wrapPi(Math.atan2(lz, lx) - TOWER_RAMP.A0 - ref); return u < -0.02 ? null : towerRampY(Math.min(u, TOWER_RAMP.UEND)); }
// 開在斜坡上的天花板（追車鏡頭）：上面那一圈的底下；塔裡面、外面、上面沒有了＝Infinity
function rampCeil(x, z) {
  const R = TOWER_RAMP, L = garLot(), c = Math.cos(L.heading), s = Math.sin(L.heading), dx = x - L.x, dz = z - L.z, lx = dx * c - dz * s, lz = dx * s + dz * c, r = Math.hypot(lx, lz);
  if (r < R.R0 - 0.6 || r > R.R1 + 0.6) return Infinity;
  const u = TRAMP.u + wrapPi(Math.atan2(lz, lx) - R.A0 - TRAMP.u) + 2 * Math.PI;
  return u > R.UEND + 0.3 ? Infinity : GAR.group.position.y + towerRampY(u) - R.RT - 0.45;
}
function rampReset() { TRAMP.on = false; TRAMP.u = 0; TRAMP.lu = 1; TRAMP.cols = -2; TRAMP.cd = null; TRAMP.cg = -1; TRAMP.call = -1; }
// 開在斜坡上離地多高（警察、警車的碰撞：高過 2.5 公尺就碰不到地上的）
const rampHigh = () => TRAMP.on && towerRampY(TRAMP.u) > 2.5;
function rampStep() {
  if (!GAR || !TWR || !VIL || !trip) return;
  const R = TOWER_RAMP, driving = !!drv && walker?.mode === 'off' && !EL.ride;
  let r = 0, a = 0, v = 0;
  if (driving) { const t = drv.telemetry(), L = garLot(), c = Math.cos(L.heading), s = Math.sin(L.heading), dx = t.x - L.x, dz = t.z - L.z, lx = dx * c - dz * s, lz = dx * s + dz * c; r = Math.hypot(lx, lz); a = Math.atan2(lz, lx); v = t.v; }
  if (TRAMP.on) {
    const u = TRAMP.u + wrapPi(a - R.A0 - TRAMP.u);
    if (!driving || r > R.R1 + 2.5 || u < -0.05) { TRAMP.on = false; TRAMP.lu = 1; if (GAR.floor) { GAR.setFloor(0); liftChanged(); } } // 開下來到地上（被傳送走、上了別台也是）
    else if (r < TOWER.RO - 0.4) { // 從口開進塔裡（只有那一層的口開著）
      const F = Math.max(1, Math.min(R.NE, Math.round(u / Math.PI)));
      TRAMP.on = false; if (GAR.floor !== F) { GAR.setFloor(F); liftChanged(); }
      TRAMP.call = F; drv.toast(`${F + 1} 樓`, 1400);
    } else { TRAMP.u = u; const F = Math.max(0, Math.min(R.NE, Math.round(u / Math.PI))); if (F !== GAR.floor) { GAR.setFloor(F); liftChanged(); } }
  } else if (driving && GAR.floor >= 1) {
    if (r > TOWER.RO + 0.1 && r < R.R1 + 1) { TRAMP.on = true; TRAMP.u = GAR.floor * Math.PI + wrapPi(a - R.ent(GAR.floor)); } // 從樓上的口開出去
  } else if (driving) {
    const lu = wrapPi(a - R.A0), ring = r > TOWER.RO && r < R.R1 + 0.8;
    if (ring && TRAMP.lu < 0 && lu >= 0 && lu < 0.6 && rampOK()) { TRAMP.on = true; TRAMP.u = lu; } // 從起點開上去
    else if (ring && lu < 0 && Math.abs(v) > 0.3 && !rampOK() && performance.now() > TRAMP.warnT) { // 不能開上去：車頭快碰到起點那一道就說（大車的車頭離中心很遠）
      const t = drv.telemetry(), L = garLot(), c = Math.cos(L.heading), s = Math.sin(L.heading), nx = t.x + Math.cos(t.heading) * drv.carInfo.nose - L.x, nz = t.z - Math.sin(t.heading) * drv.carInfo.nose - L.z, ln = wrapPi(Math.atan2(nx * s + nz * c, nx * c - nz * s) - R.A0);
      if (ln > -0.12 && ln < 0.08) { TRAMP.warnT = performance.now() + 4000; drv.toast(GV.on ? '朋友家的斜坡不能開上去' : BORROW_K ? '借來的車不能開上斜坡' : '這台太大了，不能開上斜坡', 2200); }
    }
    TRAMP.lu = ring ? lu : 1;
  }
  // 從斜坡開進樓上，電梯不在這層：叫上來
  if (TRAMP.call >= 1) { if (!driving || TRAMP.on || GAR.floor !== TRAMP.call || GAR.liftHere(GAR.floor)) TRAMP.call = -1; else if (!GAR.lift.busy && !EL.ride) { elCall(`${TRAMP.call + 1} 樓：`); TRAMP.call = -1; } }
  // 碰撞：開在斜坡上、在樓上＝斜坡的矮牆、護欄（那一層的口開著）；塔蓋在這裡的那座：實心的半圈、起點那一道
  const want = driving && (TRAMP.on || GAR.floor >= 1) ? GAR.floor : -1;
  if (drv && (want !== TRAMP.cols || drv !== TRAMP.cd || HOME.gs !== TRAMP.cg)) { drv.removeColliders('ramp'); if (want >= 0) drv.addColliders(GAR.rampColliders(want, true), 'ramp'); TRAMP.cols = want; TRAMP.cd = drv; TRAMP.cg = HOME.gs; }
  const q = VIL.places.garst?.slots[HOME.gs];
  if (q?.rcol) { const up = TRAMP.on || GAR.floor >= 1, open = up || (driving && rampOK()); if (q.mcol.off !== open) q.mcol.off = open; if (q.rcol[0].off !== up) for (const c of q.rcol) c.off = up; }
}

// ==== 你的家 ====
// 第 16 批（內容 12，Nick 2026-10-11「每個人要從自己的車庫出來」）、第 17 批（Nick 2026-10-13「所有人都在車庫街有個固定位置 不管有沒有連線」）：
//   你那間＝homeSlot()：在大家的世界裡＝世界的號碼；沒連線＝存檔的 GAME.home（第一次進入世界拿到的號碼，net.src.js；還沒進過＝1 號）
// 第 21 批（Nick 2026-10-17「每個車庫分散各處」，草稿 https://claude.ai/artifact/EaTT7dijRcjfStUoV1SU4x，Nick「可以」）：
//   6 個家分散在地圖上（village.js HOME_SITES：1 車庫街、2 山頂、3 賽車場門口、4 越野車場旁邊、5 內湖入口、6 快速道路裡面）；你家＝圓塔（GAR）蓋在你那個號碼的地方
//   換號碼（出門的時候進入世界、拿到別間）：整棟搬過去，裡面的車、在裡面的人一起搬；外面的不動
//   別人那 5 間：同一個外殼（GAR.parts＋關著的門），InstancedMesh 7 個 draw call；碰撞是 village.js 的圓＋門洞（tcol、pcol；你那間 off＝不算，裡面是 GAR 自己的碰撞）
//   HOME.in：人（車）在你家裡面（net.src.js：朋友看不到，名單寫「在車庫」）
const HOME = { in: false, slot: -1, gs: -1, lot: null, ext: null }; // 第 23 批：gs＝塔（GAR）現在蓋在第幾號（平常＝slot；去朋友家＝他家）、lot＝那裡的位置
function homeSlot() { const SL = VIL?.places?.garst?.slots, n = NET.on && NET.slot >= 0 ? NET.slot : Number.isInteger(GAME.home) ? GAME.home : 0; return SL && n >= 0 && n < SL.length ? n : 0; }
const garIn = (p) => { const q = garLocal(p.x, p.z); return GAR.isInside(q.x, q.z); };
// 你那間（換號碼才做）：places.garage 換成那間、整棟搬過去（山頂那間：整棟抬高）、別人那幾間的外殼和碰撞重排
// 第 23 批：去朋友家（GV.on）＝塔搬到他家（places.garage 還是你家：回家照舊）；回來＝搬回你家；這兩次你的東西不搬（你的車本來就停在你家）
//   在朋友家的時候你換了號碼：回來再搬（先回原本那間，下一格照換號碼搬）
function homePlace() {
  if (!GAR || !VIL?.places?.garst || !VIL.homeAt) return;
  const n = (GV.on || HOME.gs !== HOME.slot) && HOME.slot >= 0 ? HOME.slot : homeSlot(), g = GV.on ? GV.slot : n;
  if (n === HOME.slot && g === HOME.gs) return;
  const P = VIL.places.garage, L0 = { ...garLot() }, swap = g !== HOME.gs && (GV.on || HOME.gs !== HOME.slot);
  if (n !== HOME.slot) { HOME.slot = n; VIL.homeAt(n, P); }
  const q = VIL.places.garst.slots[g] || VIL.places.garst.slots[n], L = q.lot;
  HOME.gs = g; HOME.lot = { x: L.x, z: L.z, heading: L.heading };
  GAR.group.position.set(L.x, q.y || 0, L.z); GAR.group.rotation.y = L.heading; GAR.group.updateMatrixWorld(true);
  homeExt();
  if (trip && tripPose) { if (swap) liftChanged(); else homeMove(L0); }
  if (drv && tripDest === 'garage') drv.setDestination('garage'); else if (walker && tripDest === 'garage') walker.setDestination('garage');
}
// 別人那幾間：GAR.parts（大理石、霧面、金色、玻璃、透明、燈）＋關著的門（門片合成一個網格），6 個位置（各自的高度），你那間縮成 0
function homeExt() {
  const SL = VIL.places.garst.slots;
  if (!HOME.ext) {
    const parts = GAR.parts.map((P) => { const m = new THREE.InstancedMesh(P.geometry, P.material, SL.length); m.renderOrder = P.name === 'glass' ? 3 : P.name === 'clear' ? 2 : 0; return m; });
    const slats = GAR.interior.getObjectByName('roomDoor'); if (slats) parts.push(new THREE.InstancedMesh(bakeSlats(slats), slats.material, SL.length));
    parts.forEach((m, i) => { m.name = 'garst-ext-' + i; m.matrixAutoUpdate = false; TR.scene.add(m); });
    HOME.ext = parts;
  }
  const M = new THREE.Matrix4(), Z = new THREE.Matrix4().makeScale(0, 0, 0);
  SL.forEach((q, i) => {
    const L = q.lot, me = i === HOME.gs; // 第 23 批：塔蓋在哪（去朋友家＝他家；你家變外殼）
    if (q.tcol) q.tcol.off = me; if (q.pcol) q.pcol.off = me; // 開車、走路、子彈、輾扁都看 off（你那間不擋，用 GAR 的玻璃、門）
    if (q.rcol) { for (const c of q.rcol) c.off = false; q.mcol.off = false; } // 第 24 批：斜坡（實心的半圈、起點那一道）先都擋；塔蓋在這裡的那座 rampStep 每一格照你在哪開關
    if (me) { for (const m of HOME.ext) m.setMatrixAt(i, Z); return; }
    M.makeRotationY(L.heading).setPosition(L.x, q.y || 0, L.z); for (const m of HOME.ext) m.setMatrixAt(i, M);
  });
  for (const m of HOME.ext) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
}
// 關著的鐵捲門（tower.js 的門片 InstancedMesh，每片的位置、顏色）合成一個網格
function bakeSlats(im) {
  const g = im.geometry, n = im.count, M = new THREE.Matrix4(), C = new THREE.Color(), names = Object.keys(g.attributes), out = {}, idx = [];
  const nv = g.attributes.position.count, gi = g.index ? g.index.array : null;
  for (const k of names) out[k] = [];
  for (let i = 0; i < n; i++) {
    im.getMatrixAt(i, M); if (im.instanceColor) im.getColorAt(i, C); else C.setRGB(1, 1, 1);
    const pg = g.clone().applyMatrix4(M);
    for (const k of names) { const a = pg.attributes[k]; for (let j = 0; j < a.count * a.itemSize; j++) out[k].push(k === 'color' ? a.array[j] * [C.r, C.g, C.b][j % 3] : a.array[j]); }
    if (gi) for (const v of gi) idx.push(v + i * nv); else for (let v = 0; v < nv; v++) idx.push(v + i * nv);
    pg.dispose();
  }
  const b = new THREE.BufferGeometry();
  for (const k of names) b.setAttribute(k, new THREE.Float32BufferAttribute(out[k], g.attributes[k].itemSize));
  b.setIndex(idx); b.computeBoundingSphere();
  return b;
}
// 換號碼的時候已經出門了：塔裡面的（舊的 lot 的本地座標）搬到新的 lot；格子裡的照新的算（格子跟著塔搬了）
function homeMove(L0) {
  const c0 = Math.cos(L0.heading), s0 = Math.sin(L0.heading);
  const old = (x, z) => { const dx = x - L0.x, dz = z - L0.z; return { x: dx * c0 - dz * s0, z: dx * s0 + dz * c0 }; };
  const moved = (p, f) => { const q = old(p.x, p.z); if (!GAR.isInside(q.x, q.z, -1)) return null; const w = garWorld({ x: q.x, z: q.z, heading: (p.heading || 0) - L0.heading }); return { x: w.x, z: w.z, heading: w.heading, f }; };
  for (const k of Object.keys(tripPose)) {
    const p = tripPose[k]; if (!p) continue;
    if (p.tw != null) { tripPose[k] = towerPose(p.tw); continue; }
    const w = moved(p, p.f || 0); if (w) tripPose[k] = w;
  }
  const onFoot = !!walker && walker.mode !== 'off', t = onFoot ? walker.telemetry() : drv ? drv.telemetry() : null, me = t && moved(t, GAR.floor);
  if (me) { if (onFoot) walker.teleport(me, { keepCamera: false }); else { drv.teleport(me); if (tripPose[cur] && tripPose[cur].tw == null) tripPose[cur] = { ...me }; } }
  const gy = (p) => (inTower(p.x, p.z) ? GAR.group.position.y + towerFy(poseF(p)) : VIL.heightAt ? VIL.heightAt(p.x, p.z) || 0 : 0);
  if (tripS?.car && tripS.car.parent === TR.scene && tripFull && tripPose[tripFull] && (!drv || cur !== tripFull)) { const p = tripPose[tripFull], y = gy(p); tripS.car.position.set(p.x, y, p.z); tripS.car.rotation.set(0, p.heading, 0); tripS.car.updateMatrixWorld(true); if (parkShadow?.parent && tripBox) { const c = Math.cos(p.heading), s = Math.sin(p.heading); parkShadow.position.set(p.x + tripBox.cx * c, y + 0.006, p.z - tripBox.cx * s); parkShadow.rotation.set(-Math.PI / 2, 0, p.heading); } }
  for (const k in PFULL) { const p = tripPose[k]; if (p && k !== cur) { const o = PFULL[k].S.car; o.position.set(p.x, gy(p), p.z); o.rotation.set(0, p.heading, 0); o.updateMatrixWorld(true); } }
  CRUSH_SAFE = null;
  liftChanged(); // 開車、走路的碰撞（塔、停著的車）跟著新的位置重給
}
// 每一格（driveStep 最前面）：換號碼、你在不在家裡面
function homeTick() {
  if (!GAR || !tripPose || !VIL) return;
  homePlace();
  const onFoot = !!walker && walker.mode !== 'off', t = onFoot ? walker.telemetry() : drv ? drv.telemetry() : null;
  const inT = !!t && !indoor && garIn(t);
  HOME.in = inT && !GV.on; GV.in = inT && GV.on; // 第 23 批：在朋友家裡面（朋友看得到你、名單寫「在他家」）
  if (t && GAR.floor && !EL.ride && !TRAMP.on && !inTower(t.x, t.z, -1.2)) { GAR.setFloor(0); liftChanged(); } // 第 21 批：不在塔裡面了（被抓、傳送）＝回到一樓；第 24 批：開在斜坡上、正從口開出去的不算
}

// ---- 第 6 批：越野車車庫（orbay.js，車庫西邊那棟）：門口的大按鈕、停進黃線的格子、碰撞跟著門 ----
// Nick 2026-10-07：「越野車專屬位」；每台越野車（沒有輕量車的大車）有自己的一格，照價錢排（baySpot）
const obDoor = { drv: null, walk: null }; // 門的碰撞現在是開的還是關的（開車的、走路的各一套；null＝下一格重給）
const OB_OPEN = { label: '開鐵捲門', icon: 'door', onClick: () => openOrbay() };
function openOrbay() {
  if (!OB || OB.door.t > 0 || OB.door.moving) return;
  OB.door.open(calm ? 1.2 : 2.2); drv?.setAction(null);
}
// 開到（或走到）越野車車庫門口（裡外各 3.4 公尺）、門關著：「開鐵捲門」
function orbayAct(t) {
  if (!OB || OB.door.t > 0 || OB.door.moving) return null;
  return inBox(OB.zones.door, t.x, t.z) ? OB_OPEN : null;
}
// 停進黃線的格子（只有越野車：有輕量車的一般車停車庫的升降機，不佔這裡）：在格子裡面、車身正、那一格還空著 → 差一點點會自己開正再下車
function orbaySpot(t) {
  if (!OB || liftOK(cur)) return null;
  for (let i = 0; i < OB.bays.length; i++) {
    const b = OB.bays[i];
    const dx = t.x - b.x, dz = t.z - b.z, ch = Math.cos(b.heading), sh = Math.sin(b.heading); // 第 10 批：越野車車庫轉過去了：照那一格的方向算
    if (Math.abs(dx * ch - dz * sh) > 2.4 || Math.abs(dx * sh + dz * ch) > 1.3) continue; // 往裡面 ±2.4、左右 ±1.3 公尺
    const h = wrapPi(t.heading - b.heading), rev = Math.abs(h) > Math.PI / 2; // 車頭朝裡面、朝門口都可以
    if (Math.abs(wrapPi(h - (rev ? Math.PI : 0))) > 0.5) continue; // 歪太多（橫著停）不算
    if (bayTaken(i, cur)) continue; // 那一格已經有別台了
    return { x: b.x, z: b.z, heading: t.heading + wrapPi(b.heading + (rev ? Math.PI : 0) - t.heading), rev, bay: i };
  }
  return null;
}
// 每一格（走路的時候也要）：門的碰撞跟著門（開車開到 0.9 才不擋車、走路 0.55 就過得去）；人或車離門 30 公尺以上、門下面沒停車 → 遙控器關門
function orbayStep() {
  if (!OB) return;
  const dOpen = OB.door.t >= 0.9;
  if (drv && dOpen !== obDoor.drv) { drv.removeColliders('orbay'); drv.addColliders(OB.doorCols(dOpen), 'orbay'); obDoor.drv = dOpen; }
  const wOpen = indoor ? null : OB.door.t >= 0.55; // 在房子裡面（interiors.js）：這道門先拿掉
  if (walker && wOpen !== obDoor.walk) { walker.removeColliders('orbay'); if (wOpen !== null) walker.addColliders(OB.doorCols(wOpen), 'orbay'); obDoor.walk = wOpen; }
  if (OB.door.t !== 1 || OB.door.moving || !tripPose) return;
  const onFoot = !!walker && walker.mode !== 'off', t = onFoot ? walker.telemetry() : drv ? drv.telemetry() : null; if (!t) return; // 換車中（載入）先不管
  const D = OB.zones.door; if (Math.hypot(t.x - D.x, t.z - D.z) <= 30) return;
  for (const k of GAME.owned) {
    const q = tripPose[k]; if (!q || (k === tripFull && !onFoot)) continue; // 開著的那台就是你
    if (inBox(D, q.x, q.z, 2.6)) return; // 車停在門下面：不關
  }
  OB.door.close(calm ? 1 : 1.8);
}

// ---- 改車廠、車店：自己開進去，停在「改車區／買車區」就打開（開慢一點經過不會開）----
function bayAct(t) {
  if (orRace) return null; // 第 4 批：越野賽比賽中不進車行
  for (const name of ['shop', 'dealer', 'odealer']) { // 第 4 批：越野車行（越野車場）
    const P = VIL.places[name]; if (!P?.bay) continue;
    if (bayLock[name]) { if (!inBox(P.bay, t.x, t.z, 2)) bayLock[name] = false; continue; }
    if (!inBox(P.bay, t.x, t.z)) continue;
    if (BORROW_K) { bayLock[name] = true; drv.toast('借來的車不能改裝，也不能在這裡買車', 2400); continue; } // 第 19 批
    const go = name === 'shop' ? intoShop : () => intoDealer(name);
    if (Math.abs(t.v) < 1.2) { go(); return null; }
    return { label: name === 'shop' ? '停在這裡改車' : '停在這裡看車', icon: 'hand', onClick: go };
  }
  return null;
}
function panelOpen(el) {
  dvoice?.dispose(); dvoice = null; // 停好熄火（開走的時候再發動：剛裝的排氣、渦輪聽得到）
  document.body.classList.add('shopping'); driveBar.hidden = true; el.hidden = false;
  panelCam = drv.cameraMode; drv.setCameraMode('none'); // 畫面變矮變寬：鏡頭自己擺（開車暫停了不會跟著改視角）
  dcam.near = 0.1; dcam.fov = 50; dcam.updateProjectionMatrix();
  requestAnimationFrame(() => stage.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' })); // 畫面變矮了：畫面、下面的東西一起看得到
}
function panelClose() { document.body.classList.remove('shopping'); shopEl.hidden = true; dealerEl.hidden = true; camGo = null; }
// 鏡頭擺到 to、看 look（T 秒慢慢移過去；0＝直接跳過去）
function camTo(to, look, T) {
  if (!T || calm) { camGo = null; dcam.position.copy(to); camAt.copy(look); dcam.lookAt(camAt); return; }
  camGo = { p0: dcam.position.clone(), p1: to, a0: camAt.clone(), a1: look, t: 0, T };
}
// 從停好的地方看過去：前面偏右（f 往前、r 往右幾公尺），看車子中間
function viewCar(p, f, r, y, T) {
  const c = Math.cos(p.heading || 0), s = Math.sin(p.heading || 0);
  camTo(new THREE.Vector3(p.x + f * c + r * s, y, p.z - f * s + r * c), new THREE.Vector3(p.x, 0.62, p.z), T);
}
// 村子給的鏡頭（改車廠、車店展示間）：{ pos, look, fov }
function viewPlace(v, T) { dcam.fov = v.fov || 50; dcam.updateProjectionMatrix(); camTo(new THREE.Vector3(...v.pos), new THREE.Vector3(...v.look), T); }
// 開走：停在哪裡就從哪裡自己開出去（不會傳送）；裝了零件馬力變了，開車的重新做一個
function driveOff(lock, dest) {
  if (!DRIVE.on) return;
  engineAudio.resume(); panelClose(); driveBar.hidden = false;
  const t = drv.telemetry();
  drv.dispose(); makeDrv({ x: t.x, z: t.z, heading: t.heading });
  drv.setCameraMode(panelCam === 'eye' ? 'eye' : 'chase');
  bayLock[lock] = true; setDest(dest);
  stage.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
}

// 改車廠：停進改車區 → 下面打開改車廠（引擎零件、輪胎）→「開走」從出口開出去
function intoShop() {
  bayLock.shop = true; drv.setAction(null);
  drv.parkAt(VIL.places.shop.park, () => { if (!DRIVE.on) return; drv.pause(); openShop(); });
}
function openShop() {
  panelOpen(shopEl);
  if (VIL.places.shop.view) viewPlace(VIL.places.shop.view); else viewCar(VIL.places.shop.park, 5.2, 3.4, 1.8); // 改車區旁邊看車子，改車廠的裡面在後面
  say(true, GAME.money > 0 ? '想裝什麼？按一下看價錢，再按一次就裝上去' : '你現在沒有錢：先開去賽車場比賽贏獎金，再回來買');
  renderWallet(); shopItems();
}
$('shopGo').addEventListener('click', () => { if (!shopEl.hidden) driveOff('shop', canBuy() ? 'dealer' : 'track'); });

// 車店：停進買車區 → 下面是還沒買的車（按一下鏡頭移過去看那台）→ 買了新車停到店門口，開它回家
let dealerSel = null, buying = false;
function intoDealer(at = 'dealer') {
  dealerAt = at; bayLock[at] = true; drv.setAction(null); // 第 4 批：阿財車行／越野車行
  drv.parkAt(VIL.places[at].park, () => { if (!DRIVE.on) return; drv.pause(); openDealer(); });
}
function openDealer() {
  panelOpen(dealerEl); $('dealerName').textContent = dealerName(); // 第 4 批：阿財車行／越野車行
  const list = forSale();
  dealerSel = list.includes(dealerSel) ? dealerSel : list.find((k) => GAME.money >= PERF[k].price) || list[0] || null;
  $('dealerMsg').textContent = !list.length ? '車都買齊了！你的車都停在車庫' : GAME.money < PERF[list[0]].price ? '錢還不夠：先開去賽車場比賽贏獎金' : '按一下看那台車，買了自己開回家';
  renderWallet(); renderDealer();
  dcam.fov = 60; dcam.updateProjectionMatrix(); lookAtCar(dealerSel, 0); // 先看選好的那台（畫面變寬變矮了，整間看車子太小），按了別台再移過去
}
function lookAtCar(k, T = 0.8) {
  const D = VIL.places[dealerAt], n = D.display.length; let i = forSale().indexOf(k);
  if (dealerAt === 'dealer' && i >= 0) { const o = Math.floor(i / n) * n; if (o !== padOff) { padOff = o; arrangeCars(); } i -= padOff; } // 2026-10-17：車比 6 個轉盤多
  const pad = D.display[i];
  if (!pad) { viewCar(D.park, 5.2, 3.4, 1.8, T); return; }
  // 從那台車往展示間的鏡頭那邊（門口）退 5.5 公尺、高 1.6 公尺看過去：鏡頭一定在展示間裡面、中間沒有別台車
  const v = D.view?.pos || [pad.x + 5, 0, pad.z + 5], dx = v[0] - pad.x, dz = v[2] - pad.z, l = Math.hypot(dx, dz) || 1;
  const big = !!PERF[k]?.big, r = big ? 9.5 : 5.5, y0 = big ? pad.y || 0 : 0; // 第 4 批：大車（怪獸卡車）退 9.5 公尺、高 3.2 公尺（越野車行的大圓台比較高）
  camTo(new THREE.Vector3(pad.x + (dx / l) * r, y0 + (big ? 3.2 : 1.6), pad.z + (dz / l) * r), new THREE.Vector3(pad.x, y0 + (big ? 1.5 : 0.55), pad.z), T);
}
function renderDealer() {
  const el = $('dealerCars'), list = forSale();
  el.replaceChildren();
  for (const k of list) {
    const P = PERF[k], b = document.createElement('button');
    b.type = 'button'; b.className = 'part ' + (k === dealerSel ? 'sel ' : '') + (GAME.money >= P.price ? 'can' : 'cant'); b.setAttribute('aria-pressed', String(k === dealerSel));
    const t = document.createElement('b'), d = document.createElement('span'), h = document.createElement('span'), p = document.createElement('span');
    t.textContent = CARS[k].btn[0]; h.className = 'hp'; h.textContent = `${P.hp.toLocaleString('en-US')} 匹`;
    d.className = 'd'; d.textContent = `${CARS[k].name} · 極速 ${P.vmax} km/h`; p.className = 'p'; p.textContent = money(P.price);
    b.append(t, h, d, p);
    b.addEventListener('click', () => { if (buying) return; dealerSel = k; renderDealer(); lookAtCar(k); });
    el.append(b);
  }
  buyCtaD();
}
const dBuy = $('dealerBuy'), dBuyHead = $('dealerBuyHead'), dBuyNote = $('dealerBuyNote');
function buyCtaD() {
  clearTimeout(buyCtaD.t); dBuy.classList.remove('armed');
  dBuy.hidden = !dealerSel; if (!dealerSel) return;
  const P = PERF[dealerSel], lack = P.price - GAME.money;
  dBuy.disabled = lack > 0 || buying;
  dBuyHead.textContent = lack > 0 ? `還差 ${money(lack)}` : `買 ${CARS[dealerSel].btn[0]} · NT$ ${money(P.price)}`;
  dBuyNote.textContent = lack > 0 ? `這台要 NT$ ${money(P.price)}，去賽車場比賽贏錢` : `買了還剩 NT$ ${money(GAME.money - P.price)}，自己開回家`;
}
dBuy.addEventListener('click', async () => {
  const k = dealerSel;
  if (!k || buying || GAME.owned.has(k) || GAME.money < PERF[k].price || dealerEl.hidden) return;
  if (!dBuy.classList.contains('armed')) { // 按兩次才買（免得按錯）
    dBuy.classList.add('armed'); dBuyHead.textContent = `確定要買 ${CARS[k].btn[0]}？再按一次`;
    clearTimeout(buyCtaD.t); buyCtaD.t = setTimeout(buyCtaD, 3500); return;
  }
  clearTimeout(buyCtaD.t); buying = true; buyCtaD();
  dBuyHead.textContent = '車子開出來中⋯'; $('dealerMsg').textContent = `${CARS[k].btn[0]} 開到店門口中⋯`;
  let car = null;
  try { car = await loadCar(k); } catch (e) { console.error(e); }
  buying = false;
  if (!car) { $('dealerMsg').textContent = '車子沒開出來，再按一次試試'; buyCtaD(); return; }
  if (!DRIVE.on || dealerEl.hidden || GAME.owned.has(k) || GAME.money < PERF[k].price) { disposeCar(car); buyCtaD(); return; } // 等的時候離開了
  GAME.money -= PERF[k].price; GAME.owned.add(k); save(true);
  swapTripCar(k, car);
});
// 換開新車：舊的那台車行幫你送回車庫（停在圓塔樓上空的格子，輕量車），新車停在店門口，開它回家
function swapTripCar(k, car) {
  const old = tripS, oldKey = cur, oldName = CARS[cur].btn[0];
  panelClose(); driveBar.hidden = false;
  drv.dispose(); drv = null; dvoice?.dispose(); dvoice = null;
  old?.dmg?.clearDebris(); // 掉在村子裡的零件、煙收掉
  stowFull(old); tripFull = null; // 車庫頁那邊留著（還在 built 裡：車庫頁切回來不用再載）；送回去的是輕量車
  const where = deliver(oldKey, oldName);
  if (built[k]) dispose(k);
  built[k] = car; scene.add(car.car);
  keepRecent(k);
  cur = k; S = car; tripS = car; save(true);
  tripBox = fullBox(car);
  makeDrv(VIL.places[dealerAt].exit); // 第 4 批：阿財車行／越野車行門口
  drv.setCameraMode(panelCam === 'eye' ? 'eye' : 'chase');
  bayLock[dealerAt] = true; setDest(dealerAt === 'odealer' ? 'orace' : 'garage'); // 第 4 批：越野車行買的越野車：先帶你去起跑區比越野賽
  engineAudio.resume(); renderWallet(); refreshCarBtns();
  const d = drv; d.toast(dealerAt === 'odealer' ? `買到 ${CARS[k].btn[0]} 了！開去起跑區比越野賽` : `買到 ${CARS[k].btn[0]} 了！開回家停進車庫`, 3000); // 第 4 批
  setTimeout(() => { if (drv === d) d.toast(where, 3000); }, 3200);
  stage.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
}
// 車行把舊的那台送回車庫：停到樓上空的格子（二樓先；你在車店看不到）；40 格都滿了停一樓大廳；回傳要說的話
function deliver(k, name) {
  if (!liftOK(k)) { // 第 6 批：越野車不停圓塔：送回越野車車庫自己的格子（格子不夠、沒有輕量車的：車庫頁選它才看得到）
    const p = baySpot(k); if (p) tripPose[k] = p; else delete tripPose[k];
    liftChanged(); keepPark();
    return p ? `${name} 車行幫你開回家了：停在越野車車庫` : `${name} 車行幫你開回車庫了（車庫頁選它就看得到）`;
  }
  const i = TWR.indexOf(k) >= 0 ? TWR.indexOf(k) : twFree(TWR);
  if (i >= 0) { TWR[i] = k; tripPose[k] = towerPose(i); liftChanged(); keepPark(); return `${name} 車行幫你送回車庫了：停在 ${TOWER_BAYS[i].f + 1} 樓 ${TOWER_BAYS[i].i + 1} 號`; }
  tripPose[k] = { ...garWorld({ x: -6.5, z: 4, heading: Math.PI / 2 }), f: 0 }; liftChanged(); keepPark();
  return `車庫滿了：${name} 先停在一樓大廳`;
}
$('dealerGo').addEventListener('click', () => { if (!dealerEl.hidden && !buying) driveOff(dealerAt, dealerAt === 'odealer' ? 'orace' : 'circuit'); }); // 第 4 批：越野車行開走 → 起跑區

// ---- 賽道：開進起跑區（慢一點）自己停到起跑線，交給比賽（race.src.js）；比完開回村子 ----
function trackStep(t) {
  if (snooze.track || t.auto || !inBox(VIL.places.track.zone, t.x, t.z)) { home.slow = false; return; }
  if (BORROW_K) { snooze.track = true; drv.toast('借來的車不能比直線加速', 2400); return; } // 第 19 批
  if (Math.abs(t.v) > 22) { if (!home.slow) { home.slow = true; drv.toast('開慢一點，才停得進起跑線'); } return; }
  drv.toast('直線加速：自己停到起跑線'); snooze.track = true;
  drv.parkAt(VIL.places.track.start, toRace);
}
function toRace() {
  if (!DRIVE.on) return;
  dvoice?.dispose(); dvoice = null; // 比賽有自己的兩個聲音
  stopLiftSnd();
  tripS?.dmg?.clearDebris(); // 掉在村子裡的零件、煙、嘶嘶聲收掉（車子還是凹的）
  drv.release(); // 車子放回原點、不轉、輪子歸零（carSize、putCar 要）
  DRIVE.on = false; document.body.classList.remove('driving'); bodyWalking(false); driveBar.hidden = true;
  townFog(false); npcShow(false); police?.setEnabled(false); bodyFlag('wanted', false); // 第 3 批：比賽的時候警察藏起來（星星留著）
  enterRace(); // 賽道已經蓋好了：不用等，這一行就進去了
  if (!RACE.on) resumeDrive(VIL.places.track.spawn, 'garage'); // 進不去（不會發生）：接著開
}
function resumeDrive(pose, dest) {
  DRIVE.on = true; controls.enabled = false;
  document.body.classList.add('driving'); driveBar.hidden = false;
  townFog(true); npcShow(true); police?.setEnabled(true);
  // 比賽可能贏了錢：開車的重新做（馬力照現在的零件），車子停在起跑區外面
  drv.dispose(); makeDrv(pose); setDest(dest);
  lastD = performance.now();
  stage.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
}
function backToVillage() {
  if (!RACE.on) return;
  if (!trip || !drv) { exitRace(); return; }
  engineAudio.resume();
  exitRace(true); // 比賽收掉（對手的車、兩個聲音），車子留在賽道的場景
  snooze.track = true; // 剛從起跑區出來：離開 30 公尺以前開回去不會又去比賽
  resumeDrive(VIL.places.track.spawn, canShop() ? 'shop' : canBuy() ? 'dealer' : 'garage');
}
$('raceBack').addEventListener('click', backToVillage);

// ==== 第 4 批：越野車場（offroad.js）：賽道南邊，自己開過去 ====
// Nick 2026-09-28 05:37「還有越野車場可以買越野車去開比賽」、07:34「越野車很多台一樣可以買回車庫可自訂外觀 改引擎」
//   越野車行：停進買車區 → 跟阿財車行同一個面板（dealerAt＝'odealer'：只擺越野車）→ 買了停在車行門口，開它回家（原本那台車行幫你送回車庫）
//   展示台上還沒買的越野車：有輕量車就擺輕量車（跟阿財車行一樣：載得快、畫得少；怪獸卡車有了），沒有才擺完整的車；開到越野車場附近（260 公尺）才載、離遠了不畫；買走了收掉
//   越野賽：開進起跑區（慢一點）自己停到起跑位置 → 倒數 → 跑完 → 贏了拿獎金（GAME.money）、記在 GAME.wins['or:<比賽 id>']（不算車庫的獎盃）
//     開進起跑區就是還沒贏過的第一場（三場都贏了就一直是冠軍賽）；「再比一次」同一場；比賽中開出越野車場、「放棄比賽」、「直接回車庫」都會收掉
let orRace = null, oDisp = null, oLoading = false; // 越野賽（createOffroadRace）；展示台上的車 { k, S, box }；載入中
const orLevel = () => { const i = OFFROAD_RACES.findIndex((r) => !(GAME.wins['or:' + r.id] > 0)); return i < 0 ? OFFROAD_RACES.length - 1 : i; };
// 落地（drive.js 的 onLand）：飛久了說一聲；落地太用力手機震一下
function orLand(e) {
  if (!drv || !e || e.air < 0.6) return;
  drv.toast(e.hard ? `落地太用力了！（${e.speed.toFixed(1)} m/s）` : `飛了 ${e.air.toFixed(1)} 秒！`, 1400);
  if (e.hard) bump(8);
}
// 每一格（driveStep）：展示台的車、起跑區
function orStep(t) {
  oTick(t);
  const P = VIL.places.orace; if (!P?.zone) return;
  if (snooze.orace && !inBox(P.zone, t.x, t.z, 15)) snooze.orace = false; // 開出起跑區 15 公尺才會再比
  if (orRace || snooze.orace || t.auto || !inBox(P.zone, t.x, t.z)) { home.oslow = false; return; }
  if (Math.abs(t.v) > 12) { if (!home.oslow) { home.oslow = true; drv.toast('開慢一點，才停得進起跑位置'); } return; }
  snooze.orace = true;
  const lv = orLevel();
  drv.toast(`${OFFROAD_RACES[lv].name}：自己停到起跑位置`, 1800);
  orPark(lv);
}
function orPark(lv) { // 自己停到第一個起跑位置 → 開始比賽
  const g = VIL.offroad.grid[0];
  drv.setAction(null);
  drv.parkAt({ x: g.x, z: g.z, heading: 0 }, () => orStart(lv));
}
function orStart(lv) {
  if (!DRIVE.on || !drv || orRace) return;
  const d = drv;
  d.toast('', 0); // 倒數的大數字跟提示在同一個地方：「自己停到起跑位置」先收掉
  orRace = createOffroadRace({ world: VIL, scene: TR.scene, drive: d, level: lv, hudParent: stage, createRide, calm,
    onFinish: (r) => {
      if (r.won) { GAME.money += r.prize; GAME.wins['or:' + r.id] = (GAME.wins['or:' + r.id] || 0) + 1; save(true); renderWallet(); }
      const nx = OFFROAD_RACES[r.level + 1];
      return { lines: r.won ? [`獎金 +${money(r.prize)}`, nx ? `下一場：${nx.name}（獎金 ${money(nx.prize)}）` : '三場越野賽都贏了！'] : ['再練練看！越野車在泥巴、石頭上快很多'] };
    },
    onDone: ({ again }) => {
      orEnd();
      if (drv !== d || !DRIVE.on) return;
      if (again) orPark(lv);
      else setDest(saleOf('odealer').some((k) => GAME.money >= PERF[k].price) ? 'odealer' : 'garage');
    },
    onAbort: (why) => { if (drv === d) d.toast(why === 'left' ? '開出越野車場了：比賽取消' : '比賽取消了', 2000); setTimeout(orEnd, 0); },
  });
  document.body.classList.add('orracing'); // 比賽中「去哪裡」那一排收起來（跟著檢查點開；garage.css）
  polRace(true); // 第 3 批（b3-int）：比賽的時候警察藏起來、不算犯罪（星星留著）
}
function orEnd() { document.body.classList.remove('orracing'); if (orRace) { orRace.dispose(); orRace = null; polRace(false); } }
// 越野車行的展示台（門口的大圓台）：還沒買的第一台越野車；開到附近才載（輕量車；沒有輕量車的才載完整的車），遠了不畫
const oFree = (S2) => { if (S2.lod) { S2.car.removeFromParent(); S2.lod.dispose(); } else disposeCar(S2); }; // 收掉展示台的車（輕量車／完整的車）
function oTick(t) {
  const pad = VIL.places.odealer?.display?.[0]; if (!pad) return;
  const k = saleOf('odealer')[0] || null, near = Math.hypot(t.x - pad.x, t.z - pad.z) < 260;
  if (oDisp && oDisp.k !== k) oShow();
  if (!oDisp && k && near && !oLoading) {
    oLoading = true;
    (LOD_CARS[k] ? LOD_CARS[k].load().then((sc) => { const l = buildLodCar(k, sc, CARS[k].state); return { car: l.car, lod: l }; }) : loadCar(k)).then((S2) => {
      oLoading = false;
      if (!trip || !VIL || oDisp || saleOf('odealer')[0] !== k) { oFree(S2); return; }
      const b = new THREE.Box3().setFromObject(S2.car); // 車子在原點、沒轉的時候量（碰撞用）
      S2.car.position.set(pad.x, pad.y || 0, pad.z); S2.car.rotation.set(0, pad.heading || 0, 0);
      if (S2.spec?.susp) S2.spec.susp(S2, [0, 0, 0, 0], 0, 0); // 怪獸卡車：懸吊擺好（輪子踩在台子上）
      VIL.group.add(S2.car);
      oDisp = { k, S: S2, box: { cx: (b.min.x + b.max.x) / 2, cz: (b.min.z + b.max.z) / 2, hx: (b.max.x - b.min.x) / 2, hz: (b.max.z - b.min.z) / 2 } };
      oShow();
    }).catch((e) => { oLoading = false; console.error(e); });
  }
  if (oDisp) oDisp.S.car.visible = near;
}
// 展示台的車：買走了就收掉；還在就放碰撞（開車的重新做了也要再放：arrangeCars 叫）
function oShow() {
  if (!oDisp) return;
  if (!trip || !VIL || saleOf('odealer')[0] !== oDisp.k) { oFree(oDisp.S); oDisp = null; drv?.removeColliders('odisp'); walker?.removeColliders('odisp'); return; }
  const pad = VIL.places.odealer.display[0], B = oDisp.box, c = Math.cos(pad.heading || 0), s = Math.sin(pad.heading || 0);
  const box = [{ t: 'box', x: pad.x + B.cx * c + B.cz * s, z: pad.z - B.cx * s + B.cz * c, hx: B.hx, hz: B.hz, rot: pad.heading || 0, h: 3 }];
  if (drv) { drv.removeColliders('odisp'); drv.addColliders(box, 'odisp'); }
  if (walker) { walker.removeColliders('odisp'); walker.addColliders(box, 'odisp'); } // 第 2 批的走路：展示台上的車也擋人
}
// 回車庫頁：越野賽、展示台的車收掉（下一趟再載）
function oLeave() { orEnd(); if (oDisp) { oFree(oDisp.S); oDisp = null; } walker?.removeColliders('odisp'); }

// ---- 回車庫頁：「直接回車庫」（不用開，一下就回去；開車、走路、睡覺、比賽、改車廠、車店都可以按）----
function goHome() {
  if (!trip || enterDrive.busy || buying) return;
  if (RACE.on) exitRace(); // 比賽收掉、車子放回車庫
  leaveDrive();
}
// 離開村子：開車的收掉（HUD、按鍵、影子、光柱、聲音）、走路的收起來，車子放回車庫頁的原點、不轉，車庫的鏡頭、場景回來
// 停在格子裡的記進存檔（下一趟還在）；最後開的那台（cur）到電梯圓台（它停的格子給原本停圓台那台）；停在外面的回到空的格子（normPark）
function leaveDrive() {
  if (!trip) return;
  netBorrowEnd('home'); netLendHome(); // 第 19 批：開借來的車回車庫頁＝還車；借給朋友的拿回來
  gvEnd('home'); // 第 23 批：在朋友家：塔搬回你家
  const P = tripPose && TWR ? { mid: padCars(0, null)[0] || null, tower: TWR.slice() } : null; // 第 21 批：坐電梯中的那幾台不在裡面（normPark 再找一格）
  trip = false; DRIVE.on = false; boarding = null;
  panelClose(); driveBar.hidden = true;
  document.body.classList.remove('driving'); bodyWalking(false);
  dvoice?.dispose(); dvoice = null;
  stopLiftSnd(); endSleep(); elEnd();
  if (doorFade) { doorFade = null; fadeEl.style.display = 'none'; }
  if (indoor) leaveHouse(null); // 在房子裡面按「直接回車庫」：碰撞、門、鏡頭換回村子的，你搬回村子的場景
  crushFx?.reset(); junkVer = -1; // 第 7 批（輾扁）：墊子清掉、輾扁的車收回車流的池子、表演場的垃圾車擺回來
  oLeave(); // 第 4 批：越野賽、越野車行展示台的車收掉
  ciLeave(); // 賽車場的比賽、選對手收掉
  nhLeave(); // 內湖：「地圖資料 © OpenStreetMap 貢獻者」收起來
  police?.clear(); police?.setEnabled(false); bodyFlag('wanted', false); bodyFlag('jailed', false); // 第 3 批（b3-int）：星星、警車、拘留室都清掉（回車庫頁）
  netRaceEnd(); netHideAll(); // 一起開車：朋友的車、人收起來（回車庫頁）
  drv?.dispose(); drv = null; home = null;
  walker?.pause({ hide: true });
  npcShow(false);
  if (parkShadow) parkShadow.visible = false;
  for (const k of Object.keys(PFULL)) pfullOff(k, true); // 第 4 批：停在村子裡的完整的車（大車換開別台停的）收回車庫頁
  tripPose = null; tripFull = null; tripBox = null; TWR = null;
  if (P) GAME.park = P;
  if (GAR) GAR.door.t = 0;
  if (OB) OB.door.t = 0; // 第 6 批
  if (TR) townFog(false);
  const Sx = tripS; tripS = null;
  Sx?.dmg?.clearDebris(); // 掉在村子裡的零件、煙、嘶嘶聲收掉（車子還是凹的，改車廠修好才會好）
  if (Sx && Object.values(built).includes(Sx)) {
    scene.add(Sx.car); Sx.car.position.set(0, 0, 0); Sx.car.rotation.set(0, 0, 0); Sx.car.visible = Sx === S;
    Sx.wheels.forEach((w) => (w.rotation.z = 0)); Sx.cabin?.userData.setGauges(0.13, 0); Sx.cabin?.userData.setSteer?.(0);
  }
  controls.enabled = true; controls.update();
  showCar(cur); // 在車店買了新車、走去開了別台：車庫頁換成那台（名字、選項），其他的車停回格子（onCars → normPark 整理好再存）
  renderWallet(); refreshCarBtns();
  window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
}
for (const id of ['driveHome', 'raceHome', 'shopHome', 'dealerHome']) $(id).addEventListener('click', goHome);
driveOutBtn.addEventListener('click', enterDrive);

// ---- 路上的人和車（npc.js，第 2 批）：別人開的車（駕駛座坐著人）、騎機車的、村子裡走來走去的居民 ----
// 同時最多幾台車、幾個人（手機）：量的（桌機 Chromium，走路＋開車繞村子）update 一幀 車流＋居民平均約 0.2 毫秒（開車 0.13、走路 0.2；12 台 24 人也差不多），手機慢 3～5 倍；
//   貴的是畫：8 台 14 人畫面上多 10–60 個 draw call，12 台 24 人多到 90 個左右（路上也塞：開車的要一直等）→ 手機先用 8 台、14 人；
//   載入畫面先做好：車 0.35 秒（16 台：最多 8 台＋3 台備用＋機車）、人 0.08 秒（18 個）
//   車一台＝輕量車 4 個 draw call、2 萬多個三角形＋駕駛 1 個；人一個 2 個（身體＋腳下的影子）、約 4 千個三角形
//   visible：多遠以外的人不畫；animNear／animMid：多遠以內每一格動、隔一格動（再遠 4 格一次）
const NPC_MAX = { cars: 8, people: 14, visible: 110, animNear: 35, animMid: 70 };
const NPC_SND = { ctx: () => engineAudio.context, get out() { return engineAudio.input; }, gain: 0.16, muted: () => engineAudio.muted }; // 喇叭：跟引擎聲同一條總輸出（音量、靜音）
const NPC_SIT = { speed: 0, state: 'sit' };
const npcRnd = ((s) => () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; })(20260929); // 駕駛的樣子（固定的亂數）
// 路上的車：駕駛座坐一個大人（手放方向盤；深色玻璃看進去看得到人）。眼睛對齊 cabin.js 的駕駛眼睛（車身座標：左駕、右駕照那台車）；只坐好一次，之後不用動
function withDriver(k, l) {
  const v = CABIN_VIEW[k]; if (!v || !l.body) return l;
  let L = randomLook(npcRnd); while (L.age === 'kid') L = randomLook(npcRnd);
  const C = buildCharacter(L, { shadow: false, state: 'sit' });
  C.update(0, { speed: 0, state: 'sit', hands: 'wheel' }); C.update(0.1, NPC_SIT);
  C.group.updateMatrixWorld(true);
  const e = C.eyes.getWorldPosition(new THREE.Vector3());
  C.group.position.set(v.eye[0] - e.x, v.eye[1] - e.y, v.eye[2] - e.z); l.body.add(C.group);
  const d0 = l.dispose; l.dispose = () => { C.group.removeFromParent(); C.dispose(); d0(); };
  l.driver = C;
  return l;
}
// 第一次出門（載入畫面）：路線圖、車流、居民；先做好放在池子裡（車的模型要下載：最多等 12 秒，沒好的之後一格做一台）
//   騎機車的人 npc.js 自己叫 buildCharacter(look, { shadow: false, state: 'sit' })、手握把手（hands 'bars'）；開車的人 withDriver（hands 'wheel'）
async function makeNpc() {
  const T0 = performance.now(), g = new THREE.Group(); g.name = 'npc'; g.visible = false; TR.scene.add(g);
  npcGraphs(VIL);
  const T1 = performance.now();
  const lod = { keys: Object.keys(LOD_CARS), load: (k) => LOD_CARS[k].load(), build: (k, sc, look) => withDriver(k, buildLodCar(k, sc, look)) };
  const traffic = createTraffic({ world: VIL, scene: g, lod, camera: dcam, max: NPC_MAX.cars, makeCharacter: buildCharacter, randomLook, sound: NPC_SND, onCarHit: npcCarHit, onCrush: npcCrush });
  const peds = createPedestrians({ world: VIL, scene: g, camera: dcam, max: NPC_MAX.people, visible: NPC_MAX.visible, animNear: NPC_MAX.animNear, animMid: NPC_MAX.animMid,
    makeCharacter: buildCharacter, randomLook, onHit: npcHit });
  const warm = await Promise.race([traffic.prewarm(NPC_MAX.cars + 3), new Promise((r) => setTimeout(() => r(-1), 12000))]); // 多做 3 台（npc.js 最多做 max＋3 台）：之後開車不用再做車（一台 10～25 毫秒，手機會頓一下）
  const T2 = performance.now(), nPeds = peds.prewarm(), T3 = performance.now();
  // 每一格重複用的物件（不要每格 new）：me＝你（開車：車身中心；走路：0.3 公尺的人）、pk＝你停著的車、wme＝走路的你（居民讓開）
  const me = { x: 0, z: 0, heading: 0, v: 0, hx: 2.2, hz: 0.9, ai: false, crush: false }, pk = { x: 1e6, z: 1e6, heading: 0, v: 0, hx: 2.2, hz: 0.9, ai: false }, wme = { x: 0, z: 0, r: 0.3 };
  return { g, traffic, peds, me, pk, wme, focus: { x: 0, z: 0, heading: 0 }, OBS: [me], OBSW: [me, pk], PCARS: [me, traffic.cars], PCARSW: [pk, traffic.cars], WALK: [wme], MOV: [], NONE: [],
    hits: 0, carHits: 0, ms: 0, avg: 0, max: 0, n: 0,
    load: { graphs: Math.round(T1 - T0), cars: Math.round(T2 - T1), people: Math.round(T3 - T2), warmCars: warm, warmPeople: nPeds } };
}
function npcShow(on) { if (NPC) NPC.g.visible = on; if (NPC && !on) NPC.MOV.length = 0; }
// 你現在那台（完整模型）停在哪裡：走路的時候給 AI 車當停著的車、居民繞過去（停在塔的樓上、還沒有就放很遠）
function parkedBox(q) {
  const p = tripFull && tripPose?.[tripFull], B = tripBox;
  if (!p || !B || poseF(p) > 0) { q.x = 1e6; q.z = 1e6; return; }
  const c = Math.cos(p.heading), s = Math.sin(p.heading);
  q.x = p.x + B.cx * c; q.z = p.z - B.cx * s; q.heading = p.heading; q.hx = B.hx; q.hz = B.hz; q.v = 0;
}
// 每一格：開車（坐在車裡）→ 你的車是障礙物、AI 車的碰撞給 drv；走路（下車、睡覺、上車下車中）→ 你是走路的人、車和人給 walker 擋
function npcStep(dt) {
  const N = NPC; if (!N || !walker) return;
  const t0 = performance.now(), me = N.me, f = N.focus;
  if (drv && walker.mode === 'off' && !sleep) {
    const t = drv.telemetry(), ci = drv.carInfo, CX = (ci.nose + ci.tail) / 2;
    me.x = t.x + Math.cos(t.heading) * CX; me.z = t.z - Math.sin(t.heading) * CX; me.heading = t.heading; me.v = t.v; me.hx = ci.len / 2; me.hz = ci.halfW;
    me.crush = !!(crushFx && offK(cur) && !t.paused); // 第 7 批：怪獸卡車：碰到路上的車就輾過去（npc.js 把那台拿出車流）；第 9 批：越野車（路上的人看到會撲開）
    f.x = t.x; f.z = t.z; f.heading = t.heading;
    N.traffic.update(dt, f, N.OBS, N.peds.people);
    N.peds.update(dt, f, N.PCARS, N.NONE);
    drv.removeColliders('traffic'); drv.addColliders(N.traffic.colliders(t.x, t.z, 30), 'traffic');
    N.MOV.length = 0;
  } else {
    const w = walker.telemetry(), out = !indoor; // 在房子裡面：外面的車、人照樣走（出來的時候村子是活的），你不擋他們、他們不擋你
    me.x = out ? w.x : 1e6; me.z = w.z; me.heading = w.heading; me.v = 0; me.hx = 0.3; me.hz = 0.3;
    f.x = w.x; f.z = w.z; f.heading = w.heading; N.wme.x = me.x; N.wme.z = w.z;
    parkedBox(N.pk);
    N.traffic.update(dt, f, N.OBSW, N.peds.people);
    N.peds.update(dt, f, N.PCARSW, N.WALK);
    if (drv) drv.removeColliders('traffic'); // 停著的車：上車那一格再放
    const M = N.MOV; M.length = 0;
    if (out) {
      const tc = N.traffic.colliders(w.x, w.z, 12); for (let i = 0; i < tc.length; i++) M.push(tc[i]);
      const pc = N.peds.colliders(w.x, w.z, 4); for (let i = 0; i < pc.length; i++) M.push(pc[i]);
      if (police) { const pm = police.movers; for (let i = 0; i < pm.length; i++) M.push(pm[i]); } // 第 3 批（b3-int）：警車、下車的警察（沒出來的大小是 0，walk.js 不理）
    }
  }
  const ms = performance.now() - t0; N.ms = ms; N.n++; N.avg += (ms - N.avg) / Math.min(N.n, 300); if (N.n > 30 && ms > N.max) N.max = ms; // 量：一幀花多久（前 30 格在生車、生人不算最大）
}
// 開車撞到人（倒地→躺→爬起來→生氣；卡通的，沒有血）：旁邊的人嚇跑；第 3 批在這裡接「被警察抓」
function npcHit(p, speed, car) {
  if (!NPC || !car || car.ai === true) return; // 路上的 AI 車不會撞人（會停）
  NPC.hits++;
  NPC.peds.scare(p.x, p.z, 14);
  engineAudio.crash({ strength: Math.min(0.3, 0.06 + speed / 40), glass: 0 });
  if (drv && DRIVE.on) drv.toast(speed > 6 ? '撞到人了！開慢一點' : '小心，有人！', 1800);
  police?.crime('hit', p); // 第 3 批（b3-int）：開車撞人 +2★（小孩 npc.js 不會撞到）
}
// 撞到路上的車（凹、撞車聲是 drive.js 的碰撞 → damage.js）：旁邊的人嚇跑
function npcCarHit(car) { if (!NPC) return; NPC.carHits++; NPC.peds.scare(car.x, car.z, 12); }

// ==== 第 7 批（輾扁，crush.js）：怪獸卡車開上別人的車、路邊的東西（垃圾桶、燈箱、機車、板凳⋯）把它壓扁 ====
// Nick 2026-10-07：「可以輾別人」、「怪獸卡車啥都可輾」；人永遠不會被輾（車上的人先跳車跑掉、路上的人照舊被撞倒再爬起來）
// 開車的（drive.js）只有怪獸卡車帶 crush（CRUSH_DRV）：輾得過去的碰撞物不擋，照 crush.js 的墊子（臨時地形）爬上去
// 自己車庫裡面的東西不輾（工具車、輪胎、鐵捲門⋯都是自己的；garLocal 的不配置記憶體版本）
function inGarage(x, z) {
  if (OB && OB.inside(x, z)) return true; // 越野車車庫裡面（輪擋、工具⋯也是自己的）
  if (!GAR) return false;
  const L = garLot(), c = Math.cos(L.heading), s = Math.sin(L.heading), dx = x - L.x, dz = z - L.z;
  return GAR.isInside(dx * c - dz * s, dx * s + dz * c);
}
// 第 9 批（路變大）Nick 2026-10-09「越車可碾任何東西」：越野車（PERF.offroad；以後的越野車自己就有）什麼都輾（房子、樹、路燈、牆、警車⋯）；一般的車照舊
const offK = (k) => !!(PERF[k] && PERF[k].offroad);
// 輾不到的地方（世界座標的長方形 [x0, z0, x1, z1]，第一次用到才算）：你的車庫（小房子）、車庫街的車庫、越野車車庫、改車廠、車店、槍店、警察局、越野車行、福德宮
let CRUSH_SAFE = null;
function crushSafe(x, z) {
  if (!CRUSH_SAFE) {
    const S = (CRUSH_SAFE = []), P = VIL.places;
    const add = (o, m = 1.5) => { if (!o || !isFinite(o.x)) return; const c = Math.abs(Math.cos(o.rot || 0)), s = Math.abs(Math.sin(o.rot || 0)), ex = c * o.hx + s * o.hz + m, ez = s * o.hx + c * o.hz + m; S.push([o.x - ex, o.z - ez, o.x + ex, o.z + ez]); };
    for (const k of ['orbay', 'shop', 'dealer', 'odealer']) { add(P[k]?.zone); add(P[k]?.inside); } // 你的車庫：車庫街 6 間都是 kind 'garage'（下面 buildings）
    add(P.gunshop?.building); add(P.police?.building);
    if (P.police?.lot) { const L = P.police.lot; S.push([L.x0 - 1, L.z0 - 1, L.x1 + 1, L.z1 + 1]); }
    if (P.odealer?.pos) { const [x0, z0] = P.odealer.pos; S.push([x0 - 21, z0 - 10, x0 + 21, z0 + 10]); } // 越野車行的鐵皮車棚（offroad.js：x ±18、z 78…94）
    for (const b of VIL.buildings || []) if (/^(garage|garst|dealer|police|gunshop|temple)$/.test(b.kind) || (b.kind === 'shop' && b.name === P.shop?.name)) add(b);
  }
  for (const r of CRUSH_SAFE) if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return true;
  return false;
}
const CRUSH_DRV = { heightAt: (x, z) => (crushFx ? crushFx.heightAt(x, z) : 0), can: (c) => !!crushFx && crushFx.can(c) && !inGarage(c.x, c.z), hit: (c, v) => crushFx && crushFx.hit(c, v) };
const CRUSH_POS = { x: 0, z: 0 }; // 報警用（每格不配置記憶體）
const JUNK_LOOK = [{ paint: '#8d8f86', finish: 'matte', rim: 'gunmetal', tint: 'dark' }, { paint: '#7b6a52', finish: 'matte', rim: 'black', tint: 'dark' },
  { paint: '#5f6a72', finish: 'matte', rim: 'gunmetal', tint: 'dark' }, { paint: '#9a6b5c', finish: 'matte', rim: 'black', tint: 'dark' }, { paint: '#6f7a66', finish: 'matte', rim: 'gunmetal', tint: 'dark' }];
function npcCrush(car) { if (crushFx) crushFx.hitTraffic(car); } // npc.js：路上的車被怪獸卡車輾到（已經從車流裡拿出來了）
function makeCrush() {
  return createCrush({
    world: VIL,
    getCar: (q) => { // 現在開的車（車身中心）；走路、睡覺、停住的時候不算
      if (!drv || !DRIVE.on || !walker || walker.mode !== 'off' || sleep) return false;
      const t = drv.telemetry(); if (t.paused) return false;
      const ci = drv.carInfo, CX = (ci.nose + ci.tail) / 2;
      q.x = t.x + Math.cos(t.heading) * CX; q.z = t.z - Math.sin(t.heading) * CX;
      q.heading = t.heading; q.v = t.v; q.hx = ci.len / 2; q.hz = ci.halfW; q.big = offK(cur); // 第 9 批：越野車
      return true;
    },
    makeJunk: async (i) => { // 表演場的舊車：輕量車（一次做一台）
      const keys = Object.keys(LOD_CARS).filter((k) => !PERF[k]?.big);
      const k = keys[i % keys.length]; if (!k || !TR) return null;
      const l = buildLodCar(k, await LOD_CARS[k].load(), JUNK_LOOK[i % JUNK_LOOK.length]);
      TR.scene.add(l.car);
      return l;
    },
    recycle: (car) => NPC?.traffic.recycle(car),
    bail: (x, z, dx, dz) => (NPC ? NPC.peds.bail(x, z, dx, dz) : 0),
    sound: (kind, x, z, k) => engineAudio.crash(kind === 'glass' ? { strength: 0.12, glass: 1 } : { strength: k, glass: 0 }),
    toast: (text) => { if (drv && DRIVE.on) drv.toast(text, 2000); },
    crime: (x, z) => { CRUSH_POS.x = x; CRUSH_POS.z = z; police?.crime('crush', CRUSH_POS); }, // 村子裡輾東西＝1★（越野車場裡面 crush.js 不叫）
    any: () => offK(cur), protect: crushSafe, // 第 9 批：越野車什麼都輾；輾不到的地方
    copWreck: (i, x, z) => (police && police.wreck ? police.wreck(i, x, z) : null), // 第 9 批：警車扁掉、警察下車跑掉、+2★（police-ai.js）
  });
}
// 每一格（npcStep 後面）：墊子、壓扁、輾扁的車留 20 秒再收回去、表演場的垃圾車；垃圾車的碰撞只有「不是怪獸卡車」的時候要（換了才重放）
function crushStep(dt) {
  if (!crushFx) return;
  crushFx.update(dt);
  if (drv && crushFx.colVer !== junkVer) { junkVer = crushFx.colVer; drv.removeColliders('junk'); drv.addColliders(crushFx.colliders(), 'junk'); }
}

// ==== 第 3 批（b3-int）：警察（police-ai.js）、槍（guns.js）、槍店（gunshop.js）、警察局裡面（police.js）====
// Nick 2026-10-04：「警察追人抓人、槍店買槍射擊繼續做」（2026-09-28 做好的模組接進整個遊戲）
// 警察：第一次出門的載入畫面做（3 台警車、3 個警察先做好、編譯 shader；警察局裡面也先蓋好），之後一直留著；回車庫頁 clear()＋藏起來，比賽的時候藏起來（星星留著）
//   每一格（driveStep 最後，開車、走路都更新完）：開車的時候警車給 drv 當碰撞、開車撞到下車的警察（carHit）；police.update；槍 gunner.update
//   撞到居民（npc.js 的 onHit → npcHit）報 'hit'（+2★）；按「揍」報 'punch'（+1★，揍到警察 'cop'）；槍自己報（打到人 'shoot'＝3★、打到警察 'shootCop' +1★、附近有警察的時候開槍 'gunfire'）
//   被抓到（onCaught）：開車的拉手煞車停住、走路的停住，槍收起來 → 畫面全黑（onArrest）：開的車（或剛下車停著的）拖到警察局的停車場，人關進拘留室
//   → 10 分鐘或繳罰款（onRelease）：人站在警察局門口，車在停車場
// 槍：做走路的時候一起做（makeGuns），走路才用得到（開車、上車下車中自己收起來）；房子裡、警察局裡、拘留室、槍店櫃台不能用（setEnabled(false)）
const PUNCH_BTN = [{ id: 'punch', label: '揍', key: 'KeyF', onClick: () => doPunch() }]; // 走路右下角的圓按鈕（電腦 F）；拿槍的時候收起來（開槍鈕在同一個地方，F 也是開槍）
const PUNCH_ME = { x: 0, z: 0, heading: 0 }, PL_CAR = { hx: 2.2, hz: 0.9, cx: 0 }; // 每一格重複用的
const GS_DESK = { label: '買槍、子彈', icon: 'hand', onClick: () => openDesk() }, GS_RANGE = { label: '開始練習', icon: 'hand', onClick: () => startRange() };
const jailed = () => !!police && (police.state === 'caught' || police.state === 'jail' || police.state === 'release'); // 被抓到、關著、放出來那一下：不能上車下車、開門、用槍
async function warmPolice() {
  try { await Promise.race([gunShopFonts(VIL.places.gunshop?.name), new Promise((r) => setTimeout(r, 1600))]); } catch (e) { console.error(e); } // 槍店招牌、貼圖上的字
  police = createPolice({ scene: TR.scene, world: VIL, colliders: stripColliders(), hudParent: stage,
    obstacles: NPC ? (x, z, r) => NPC.traffic.colliders(x, z, r) : null, // 路上的車：警車會閃、會撞到
    sound: { ctx: () => engineAudio.context, get out() { return engineAudio.input; }, muted: () => engineAudio.muted, gain: 0.2 }, // 警笛：跟引擎聲同一條總輸出（音量、靜音）
    makePoliceCar, makeOfficer: () => buildCharacter(POLICE_LOOK),
    jail: { setCellDoor: (open) => PI?.setCellDoor(open) },
    getPlayer: polPlayer,
    money: { get: () => GAME.money, spend: (n) => { if (GAME.money < n) return false; GAME.money -= n; save(true); renderWallet(); return true; } },
    onCaught, onArrest, onRelease,
    toast: (text, ms, red) => { if (red) return false; const w = walker && walker.mode !== 'off' ? walker : drv; if (!w || !DRIVE.on) return false; w.toast(text, ms); return true; } }); // 警察的話：跟走路／開車的提示同一個地方（被抓到那一下的大紅字還是警察自己的）
  if (NPC) { NPC.OBS.push(...police.npcCars); NPC.OBSW.push(...police.npcCars); NPC.PCARS.push(police.npcCars); NPC.PCARSW.push(police.npcCars); } // 路上的車讓警車、居民閃警車（警車撞不飛人）
  police.preload(renderer, dcam);
  stationBuild();
  if (renderer.compileAsync) await renderer.compileAsync(PSC, dcam); else renderer.compile(PSC, dcam);
}
// 給警察看的你（每一格）：開車／走路／'off'（改車廠、車店、槍店櫃台、睡覺、換車中：警察停著等）；在房子、槍店裡面＝看不到（hidden）；在自己車庫裡、鐵捲門關著＝safe（星星清掉）
function polPlayer(o) {
  o.car = null; o.safe = false; o.hidden = !!indoor && !indoor.jail;
  if (!walker) { o.mode = 'off'; o.x = 0; o.z = 0; o.heading = 0; o.v = 0; return o; }
  const driving = !!drv && walker.mode === 'off' && !sleep, t = driving ? drv.telemetry() : walker.telemetry();
  o.x = t.x; o.z = t.z; o.heading = t.heading; o.v = driving ? t.v : t.speed;
  o.mode = !DRIVE.on || sleep || gsDesk || boarding || document.body.classList.contains('shopping') || (!driving && walker.mode === 'off') ? 'off' : driving ? 'drive' : 'walk';
  if (driving) { const ci = drv.carInfo; PL_CAR.hx = ci.len / 2; PL_CAR.hz = ci.halfW; PL_CAR.cx = (ci.nose + ci.tail) / 2; o.car = PL_CAR; }
  if (GAR && !indoor) { const q = garLocal(t.x, t.z); o.safe = !GV.on && GAR.isInside(q.x, q.z) && GAR.door.t === 0 && !GAR.door.moving; } // 第 23 批：朋友家不能躲
  if (driving && rampHigh()) o.hidden = true; // 第 24 批：開在斜坡上面（高過 2.5 公尺）：地上的警車抓不到（在下面等你）
  return o;
}
function onCaught() {
  gunner?.holster(); closeDesk(true);
  if (drv && walker?.mode === 'off') { drv.setInput({ throttle: 0, brake: 0, steer: 0, handbrake: 1 }); drv.setAction(null); drv.setAction2(null); } // 手煞車（按著煞車＝倒車）
  else walker?.pause();
}
function onArrest(i) { // 畫面全黑：車拖到警察局的停車場、人關進拘留室
  if (!DRIVE.on || !walker || !trip) return;
  if (doorFade) { doorFade = null; fadeEl.style.display = 'none'; }
  endSleep(); elEnd(); // 第 21 批：坐電梯中被抓
  if (indoor) leaveHouse(null);
  impounded = false;
  if (drv) { // 開的那台（或剛下車停著的那台）：開車的收掉，完整的車停到停車場
    drv.setInput(null); drv.dispose(); drv = null; dvoice?.dispose(); dvoice = null; if (home) home.open = null; obDoor.drv = null;
    tripS?.dmg?.clearDebris();
    if (tripFull === cur && i.yard && tripS) { tripPose[cur] = { x: i.yard.x, z: i.yard.z, heading: i.yard.heading }; parkFull(); impounded = true; }
    walker.setCars([], { keepParked: false }); arrangeCars();
  }
  enterStation(true);
  walker.resume();
}
function onRelease(i) { // 畫面全黑：放出來站在警察局門口（朝外）
  if (!DRIVE.on || !walker) return false;
  if (indoor) leaveHouse({ spawn: i.door }); else walker.teleport(i.door);
  walker.resume();
  return impounded; // false：車子沒拖來，警察就不說「你的車停在警察局的停車場」
}
// 警察局一樓裡面：蓋一次留著（自己的場景）；出口（大門）給 walk.js 的門；拘留室的鐵門平常開著（被抓的時候 police-ai.js 關上）
function stationBuild() {
  if (PI) return;
  PI = buildPoliceInterior({ renderer });
  PSC = new THREE.Scene(); PSC.name = 'police-in'; PSC.background = PI.background; PSC.add(PI.group);
  const ex = PI.exitDoor, lz = ex.hz - 0.35; // 大門：出口長方形靠外面那一邊往裡面 0.35 公尺（跟 interiors.js 一樣）；ry 朝裡面（往外推＝走出去）
  PI.exitsW = [{ ...ex, door: { x: ex.x + lz * Math.sin(ex.rot), z: ex.z + lz * Math.cos(ex.rot), ry: ex.rot + Math.PI, w: ex.hx } }];
  PI.setCellDoor(true); PI.update(5);
}
function enterStation(jail, b) {
  stationBuild();
  indoor = { b: b || VIL.buildings.find((x) => x.kind === 'police'), I: PI, scene: PSC, t: 0, dist0: walker.cameraDist, folks: [], kind: 'police', keep: true, jail, exits: PI.exitsW };
  PSC.add(walker.character.group);
  walker.removeColliders('world'); walker.setCarReach(false);
  houseSet(jail ? PI.cell : PI.spawn); // 碰撞（拘留室的鐵門照現在關著還是開著）、門、鏡頭、警察
  return { say: jail ? null : '警察局：拘留室在後面' };
}
// 警察局裡的警察：櫃台後面站一個、辦公桌坐一個（POLICE_LOOK；跟房子裡的人一樣，出去就收掉）
function stationFolks() {
  const H = indoor, sp = PI.spots, cols = [];
  for (const f of H.folks) f.C.dispose();
  H.folks.length = 0;
  for (const [p, st] of [[sp.counter[1], 'idle'], [sp.sit[0], 'sit']]) {
    if (!p) continue;
    let C = null; try { C = buildCharacter(POLICE_LOOK, { state: st }); } catch (e) { console.error(e); continue; }
    C.group.position.set(p.x, st === 'sit' ? Math.max(0, (p.y ?? 0.45) - 0.45) : 0, p.z); C.group.rotation.set(0, p.heading, 0);
    C.update(0, { speed: 0, state: st }); C.update(0.05, FOLK_POSE);
    H.scene.add(C.group); H.folks.push({ C, st });
    if (st !== 'sit') cols.push({ t: 'circle', x: p.x, z: p.z, r: 0.3, h: 1.7 });
  }
  if (cols.length) walker.addColliders(cols, 'interior');
}
// 槍：走路的 walker 做好以後做；「揍」的按鈕；警車、下車的警察擋人（npcStep 放進 NPC.MOV）；小地圖的警車
function makeGuns() {
  if (police) { walker.setMarkers(police.markers); if (!NPC) walker.setMovers(police.movers); }
  try {
    townWorld = { scene: TR.scene, colliders: [...VIL.colliders, ...stripColliders(), ...garCols(true)], crime: true, name: 'village' };
    townTargets = [NPC && gunTargets.pedestrians(NPC.peds), NPC && gunTargets.traffic(NPC.traffic), police && gunTargets.police(police), gunTargets.boxes(gunParked, { kind: 'parked' })].filter(Boolean);
    gunner = createGunner({ scene: TR.scene, camera: dcam, renderer, walker, character: walker.character, GAME, hudParent: stage, keyboard: true, world: townWorld, targets: townTargets,
      audio: { muted: () => engineAudio.muted },
      onChange: () => save(), onEquip: (id) => walker.setButtons(id ? null : PUNCH_BTN), // 拿槍：開槍鈕放在「揍」的地方（F 也變開槍）
      onCrime: (kind, info) => police?.crime(kind, info) });
  } catch (e) { console.error(e); gunner = null; }
  walker.setButtons(PUNCH_BTN);
}
// 子彈打得到的停著的車（你的車：停在哪就在哪；剛下車停著的那台也算）：一格算一次（有開槍才問）
const GP = []; let gpN = 0, gpAt = -1;
function gunParked() {
  if (gpAt === gpN) return GP;
  gpAt = gpN; GP.length = 0;
  if (!trip || !tripPose) return GP;
  for (const c of walkCars()) { const b = carBox(c, c); b.h = c.h || 1.35; b.obj = c.object; GP.push(b); }
  if (drv && walker && walker.mode !== 'off' && tripS && tripBox && tripPose[cur]) { const b = carBox(tripBox, tripPose[cur]); b.obj = tripS.car; GP.push(b); }
  return GP;
}
// 槍什麼時候可以用：被抓到、關著、在房子／警察局裡、槍店櫃台打開的時候不行（槍店裡面可以：只有靶場打得出去）
function gunSync() {
  const on = !jailed() && !gsDesk && !(indoor && indoor.kind !== 'gunshop');
  if (on !== gunSync.on) { gunSync.on = on; gunner.setEnabled(on); }
}
// 揍：揮一拳；前面 1.2 公尺以內的人（小孩不會被打到）倒下去再爬起來（police-ai.js 判斷、報 'punch'）
const punchKnock = (p, dx, dz) => NPC?.peds.knock(p, dx, dz, 4);
function doPunch() {
  if (!walker || walker.mode !== 'walk' || !DRIVE.on) return;
  walker.play('punch');
  if (!police || jailed()) return;
  const t = walker.telemetry(); PUNCH_ME.x = t.x; PUNCH_ME.z = t.z; PUNCH_ME.heading = t.heading;
  const hit = police.punch(PUNCH_ME, NPC && !indoor ? NPC.peds.people : null, punchKnock);
  if (hit && NPC && !indoor) NPC.peds.scare(hit.x, hit.z, 10); // 旁邊的人嚇跑
}
// 槍店：第一次走進去才蓋（字型載入畫面等過了），之後留著；裡面是自己的場景（店員、靶 gunshop.js 自己有）
function enterGunShop(b) {
  let first = false;
  if (!GS) {
    try { GS = buildGunShopInterior({ door: b.door, name: VIL.places.gunshop?.name || b.name, renderer, makeCharacter: buildCharacter, quality: roomQ, GAME, onRangeEnd: gsRangeEnd }); } catch (e) { console.error(e); GS = null; }
    if (!GS) return { say: '槍店今天沒開' };
    GSC = new THREE.Scene(); GSC.name = 'gunshop'; GSC.background = GS.background; GSC.environment = GS.environment; GSC.add(GS.group);
    shopWorld = { scene: GSC, colliders: GS.colliders, ceiling: GS.camera.ceiling, raycast: GS.raycast, rule: GS.fireRule, crime: false, name: 'gunshop' };
    GS.exitsW = [{ ...GS.exitDoor, door: GS.doors[0] }];
    first = true;
  }
  indoor = { b, I: GS, scene: GSC, t: 0, dist0: walker.cameraDist, folks: [], kind: 'gunshop', keep: true, exits: GS.exitsW };
  GSC.add(walker.character.group);
  walker.removeColliders('world'); walker.setCarReach(false);
  houseSet(GS.spawn); GS.range.stop();
  if (gunner) { gunner.setWorld(shopWorld); gunner.setTargets([]); } // 店裡：子彈只打得到牆、靶（不算犯罪；店裡面不能開槍，後面的靶場可以）
  return { wait: first && renderer.compileAsync ? renderer.compileAsync(GSC, dcam) : null, say: `${VIL.places.gunshop?.name || '槍店'}：櫃台買槍，後面是靶場` };
}
function gsLeave() { closeDesk(true); GS?.range.stop(); if (gunner) { gunner.setWorld(townWorld); gunner.setTargets(townTargets); } }
function gsStep(dt) {
  const t = walker.telemetry(); GS.update(dt, t);
  if (gsDesk || walker.mode !== 'walk') return;
  const z = GS.zoneAt(t.x, t.z);
  walker.setAction(z === 'counter' ? GS_DESK : z === 'range' && (GS.range.state === 'idle' || GS.range.state === 'done') ? GS_RANGE : null);
}
// 櫃台：走路停住、畫面變矮（跟改車廠一樣）、鏡頭擺到櫃台、下面打開買槍畫面；「離開櫃台」接著走
function openDesk() {
  if (gsDesk || !GS || indoor?.kind !== 'gunshop' || walker.mode !== 'walk') return;
  const v = GS.views.counter, z = GS.zones.counter;
  walker.teleport({ x: z.x, z: z.z, heading: Math.atan2(-(v.look[2] - z.z), v.look[0] - z.x) }, { keepCamera: true });
  walker.setAction(null); walker.pause(); GS.setClerk('talk');
  document.body.classList.add('shopping'); driveBar.hidden = true;
  gsFov = dcam.fov; dcam.position.set(...v.pos); dcam.lookAt(...v.look); dcam.fov = v.fov || 50; dcam.near = 0.1; dcam.updateProjectionMatrix();
  gsDesk = openGunShop(dealerEl.parentElement, GAME, (kind, id) => { save(true); renderWallet(); gunner?.refresh(); if (kind === 'gun' && gunner && !gunner.telemetry().drawn) gunner.draw(id); },
    { name: VIL.places.gunshop?.name, onClose: () => closeDesk() });
  if (gsDesk.el) dealerEl.after(gsDesk.el);
  requestAnimationFrame(() => stage.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' })); // 畫面變矮了：畫面、下面的東西一起看得到
}
function closeDesk(quiet) {
  if (!gsDesk) return;
  gsDesk.close(); gsDesk = null; GS?.setClerk('idle');
  document.body.classList.remove('shopping');
  dcam.fov = gsFov; dcam.updateProjectionMatrix();
  if (quiet) return;
  driveBar.hidden = false; walker.resume({ blend: 0.5 }); gunner?.refresh();
  stage.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
}
// 靶場：站到射擊台後面按「開始練習」（沒拿槍先拿；沒有槍先去櫃台買）→ 倒數、計時；打完 onRangeEnd：紀錄、第一次全部打倒的獎金
function startRange() {
  if (!gunner || !GS) return;
  const g = gunner.telemetry();
  if (!g.drawn) { if (!(GAME.guns?.owned?.length)) { walker.toast('還沒有槍：先去櫃台買', 2000); return; } gunner.draw(); }
  GS.range.start(gunner.telemetry().cur);
}
function gsRangeEnd(res) {
  const r = gunShop.rangeResult(GAME, res.weapon, res);
  save(true); renderWallet(); GS?.range.say(r.msg); walker?.toast(r.msg, 3200);
}
function closeDoor() { if (GAR && GAR.door.t === 1 && !GAR.door.moving) GAR.door.close(calm ? 1 : 1.8); }
// 通緝中、人或車在自己車庫裡面（不在門下面）、門開著：給「關鐵捲門」（關好了＝躲起來，星星清掉）
function hideAct(x, z, hl) {
  if (!police || police.state !== 'wanted' || !GAR || GV.on || GAR.door.t !== 1 || GAR.door.moving) return null; // 第 23 批：朋友家不能躲
  const q = garLocal(x, z), D = GAR.zones.door.x;
  return GAR.isInside(q.x, q.z) && q.x + hl < D - 0.3 ? CLOSE_ACT : null;
}
// 每一格（driveStep 最後）：警車的碰撞給開車的、開車撞到下車的警察、警察、槍
function polStep(dt) {
  gpN++;
  if (police) {
    if (drv) drv.removeColliders('police');
    if (drv && walker.mode === 'off' && !sleep && !rampHigh()) { const t = drv.telemetry(); drv.addColliders(police.colliders(t.x, t.z, 60), 'police'); if (!t.paused) police.carHit(null, null); } // 第 24 批：開在斜坡上面：地上的警車撞不到
    police.update(dt);
    bodyFlag('wanted', !polRace.on && stage.classList.contains('pw-on')); bodyFlag('jailed', jailed()); // garage.css：通緝中全螢幕鈕、聲音往下推；被抓到、關著去哪裡那一排藏起來
    if (bodyFlags.jailed !== polStep.jl) { polStep.jl = bodyFlags.jailed; walker.setButtons(polStep.jl || gunner?.arms.cur ? null : PUNCH_BTN); } // 關著的時候「揍」收起來
  }
  if (gunner) { gunSync(); gunner.update(dt); }
}
// 比賽（賽車場、越野賽）的時候：警察藏起來、不算犯罪（police-ai.js crime() 關掉的時候不算）；比完照舊（星星留著）
function polRace(on) { polRace.on = !!on; if (!police) return; police.setEnabled(!on && DRIVE.on); if (on) bodyFlag('wanted', false); }
const bodyFlags = {};
function bodyFlag(k, on) { if (bodyFlags[k] !== on) { bodyFlags[k] = on; document.body.classList.toggle(k, on); } }
// 重新開始（garage.src.html）：星星清掉、槍收起來
function townReset() { police?.clear(); gunner?.holster(); gunner?.refresh(); }

// ---- 每一幀：門、升降機 → 開車 → 走路（走路一定在開車後面：上車那一下鏡頭從走路接到開車）----
function driveStep(dt) {
  GAR.update(dt); // 門、升降機在動（開、關、升、降）每一格都要跟著（停好的時候 onLift 換碰撞）
  OB?.update(dt); // 第 6 批：越野車車庫的鐵捲門
  homeTick(); doorStep(); rampStep(); orbayStep(); elPanelStep(); // 第 17 批：換號碼就把你家搬過去；別人那幾間的外殼、碰撞；第 21 批：電梯的面板
  if (drv) {
    drv.update(dt); // 開進賽道、快速道路的事（arrive）在這裡面叫
    if (drv && DRIVE.on) orRace?.update(dt); // 第 4 批：越野賽（drive.update 之後）
    if (drv && DRIVE.on) ciTick(dt); // 賽車場的比賽（circuit.src.js）
    if (drv && DRIVE.on) {
      const t = drv.telemetry();
      dvoice?.set({ rpm: t.rpm, throttle: t.load, speed: Math.abs(t.v) });
      tripS?.cabin?.userData.setGauges(t.rpm, t.kmh); tripS?.cabin?.userData.setSteer?.(t.steer); // 駕駛座視角看得到轉速表、速度表、方向盤跟著轉
      popStep(dt); // 跳燈：燈蓋在轉
      foldStep(dt, t.v); // 修 11＋Nick：開走了「去哪裡」「⋯」收起來
      if (jailed()) { drv.setAction(null); drv.setAction2(null); } // 第 3 批（b3-int）：被抓到了（手煞車停住）：沒有按鈕
      else if (!t.paused) {
        drv.setAction(elCallAct(t.x, t.z) || homeAct(t) || orbayAct(t) || bayAct(t)); // HUD 的大按鈕：叫電梯、開鐵捲門（車庫、越野車車庫）、停在這裡改車／看車
        const t2 = drv.telemetry(); // 停進改車區（parkAt）、開正停上升降機的時候就不能下車
        drv.setAction2(!t2.paused && !t2.auto && Math.abs(t2.v) < 1 ? OUT_ACT : null); // 停住了：右邊多一顆「下車」
        if (!drv.telemetry().paused) trackStep(t);
        if (drv && !drv.telemetry().paused) orStep(t); // 第 4 批：越野車場（展示台的車、起跑區）
        if (drv && !drv.telemetry().paused) ciStep(t); // 賽車場：報名處、比賽中沒有「下車」
      }
      if (drv && DRIVE.on) { hillStep(drv.telemetry(), dt); ghHillTick(dt); } // 爬山計時賽（mountain.js）、鬼影車（ghost.src.js）
      if (snooze.track && Math.hypot(t.x - VIL.places.track.zone.x, t.z - VIL.places.track.zone.z) > 30) snooze.track = false;
    }
  }
  if (DRIVE.on) tripS?.dmg?.update(dt); // 撞壞的：冒煙、掉下來的零件、碎玻璃（下車走路的時候也冒煙）
  if (sleep) sleepStep(dt); // 睡覺：躺著的時候走路的停住了（mode off）；醒來（慢慢亮的時候）就可以走了
  if (doorFade) fadeStep(dt); // 走進門口：黑掉 → 換成房子裡面（樓上、外面）→ 亮起來
  if (indoor) { indoor.t += dt; for (const f of indoor.folks) f.C.update(dt, FOLK_POSE); } // 裡面的人：站著、坐著會動一動
  if (indoor?.kind === 'police') PI.update(dt); else if (indoor?.kind === 'gunshop' && walker) gsStep(dt); // 第 3 批：拘留室的鐵門；槍店的靶、店員、櫃台／靶場的按鈕
  if (walker && walker.mode === 'walk' && DRIVE.on && !indoor) { homeWalk(); oTick(walker.telemetry()); } // 升降機、睡覺的按鈕；鏡頭頭上多高；越野車行展示台的車（走路也看得到、擋人）
  if (DRIVE.on) npcStep(dt); // 路上的車、居民（走路的碰撞要在 walker.update 前面放好）
  if (DRIVE.on) crushStep(dt); // 第 7 批（輾扁）：怪獸卡車壓扁的東西（墊子、壓扁、表演場的垃圾車）
  walker?.update(dt); // 走路（開車的時候只有上車那一下鏡頭接過去）
  if (DRIVE.on) nhTick(); // 內湖（neihu.src.js）：遠的格子收起來、地圖資料的出處、第一次到說一聲
  if (DRIVE.on && walker) polStep(dt); // 第 3 批（b3-int）：警察、槍（開車、走路都更新完以後；槍在 walker 後面）
  netStep(dt); // 一起開車（net.src.js）：朋友的車、人、名字、表情、一起比賽
  mapStep(); // 大地圖：小地圖點了做什麼（大地圖／比賽看整個賽道）、比賽的對手點
  bodyWalking(DRIVE.on && (walker?.mode === 'walk' || !!doorFade)); // 門口黑掉的那一下走路停住了：版面照走路的（去哪裡那一排不要跳）
}
// ==== 大地圖（bigmap.js；Nick 2026-10-10「可以瀏覽完整地圖」「大地圖OK」，草稿 https://claude.ai/artifact/VF5wb2U1PpAnzBRyJsSSW6）====
// 開車、走路：點右上角的小地圖（下面寫「🗺 大地圖」）→ 大地圖（車子自己慢慢停、走路的人站著）；點地方 →「去這裡」＝目的地（setDest）
// 賽車場比賽：點小地圖＝小地圖變成整個賽道（比賽不會停）、再點一下回來；小地圖上的對手是有號碼的點（號碼＝名次：前面紅、後面灰）
// 越野賽、400 公尺、被抓、在房子裡面、自動開車的時候：小地圖不能點
let BIGMAP = null;
const MAPT = { drv: null, wk: null, d: null, w: null, whole: false, box: null, marks: [], race: null };
const MAP_BIG = { label: '🗺 大地圖', onClick: () => bigOpen() }, MAP_LAP = { label: '看整個賽道', onClick: () => lapView(true) }, MAP_BACK = { label: '回來', onClick: () => lapView(false) };
const mapWalking = () => !!walker && walker.mode === 'walk';
function bigMake() {
  if (BIGMAP || !VIL) return BIGMAP;
  BIGMAP = createBigMap({ parent: stage, world: VIL, layer: () => MAPT.layer || (MAPT.layer = walker?.mapLayer), // 小地圖同一張底圖
    me: () => { if (mapWalking()) { const t = walker.telemetry(); return { x: t.x, z: t.z, h: t.heading }; } const t = drv?.telemetry(); return t ? { x: t.x, z: t.z, h: t.heading } : null; },
    route: () => (mapWalking() ? walker.route : drv?.route),
    dots: () => [police?.markers, MAPT.race ? MAPT.marks : null, NET.on ? NET_GST.dots : null, NET.on ? NET.marks : null], // 朋友的家（第 21 批）、一起開車的朋友（名字寫在點旁邊）
    dest: () => tripDest,
    onGo: (k, name) => { setDest(k); (mapWalking() ? walker : drv)?.toast(`去${name}：跟著左上角的箭頭`, 2200); },
    onOpen: () => { document.body.classList.add('bigmap'); if (mapWalking()) walker.setInput({ x: 0, y: 0 }); else drv?.setInput({ throttle: 0, brake: 0.5, steer: 0 }); }, // 車子自己慢慢停
    onClose: () => { document.body.classList.remove('bigmap'); walker?.setInput(null); if (!ciRace && !orRace) drv?.setInput(null); },
  });
  return BIGMAP;
}
function bigOpen() { if (mapMode() === MAP_BIG) bigMake()?.open(); }
function lapView(on) { // 賽車場：小地圖看整個賽道
  MAPT.whole = !!on;
  if (on && !MAPT.box) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; const r = (VIL.roads || []).filter((r) => r.kind === 'circuit').sort((a, b) => b.pts.length - a.pts.length)[0]; for (const [x, z] of r ? r.pts : []) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } MAPT.box = r ? { x0: x0 - 20, x1: x1 + 20, z0: z0 - 20, z1: z1 + 20 } : null; }
  drv?.setMapView(on ? MAPT.box : null); MAPT.d = null; // 字下一格換
}
// 現在點小地圖做什麼：MAP_BIG（大地圖）、MAP_LAP／MAP_BACK（賽車場）、null（不能點）
function mapMode() {
  if (!DRIVE.on || indoor || jailed() || doorFade) return null;
  if (mapWalking()) return MAP_BIG;
  if (!drv || walker?.mode && walker.mode !== 'off') return null;
  if (ciRace) return MAPT.whole ? MAP_BACK : MAP_LAP;
  if (orRace || (race && race.phase && race.phase !== 'idle')) return null;
  const t = drv.telemetry(); if (t.auto || t.paused) return null;
  return MAP_BIG;
}
function mapStep() {
  if (BIGMAP?.isOpen && (!DRIVE.on || mapMode() !== MAP_BIG)) BIGMAP.close(); // 回車庫、被抓、上下車了：關掉
  if (MAPT.drv !== drv) { MAPT.drv = drv; MAPT.d = null; MAPT.whole = false; MAPT.race = null; }
  if (MAPT.wk !== walker) { MAPT.wk = walker; MAPT.w = null; }
  const m = mapMode(), md = m && !mapWalking() ? m : null, mw = m && mapWalking() ? m : null;
  if (drv && MAPT.d !== md) { MAPT.d = md; drv.setMapTap(md); }
  if (walker && MAPT.w !== mw) { MAPT.w = mw; walker.setMapTap(mw); }
  // 賽車場的對手點（每一格只改數字，不 new）
  const R = ciRace;
  if (R !== MAPT.race) {
    if (MAPT.whole && !R) lapView(false);
    MAPT.race = R; if (drv) drv.setMarkers(R ? MAPT.marks : null, 'race');
    if (R) { MAPT.marks.length = R.ais.length; for (let i = 0; i < R.ais.length; i++) MAPT.marks[i] = MAPT.marks[i] || { x: 0, z: 0, fill: '#e5484d', ring: '#ffffff', r: 6.5, label: 1, on: true }; }
  }
  if (R) {
    const me = R.me, ahead = (c) => (c.fin != null ? -1e9 + c.fin : -c.p); // 跑完的照時間，沒跑完的照跑多遠（小的在前面）
    for (let i = 0; i < R.ais.length; i++) {
      const a = R.ais[i], m = MAPT.marks[i], ka = ahead(a); let n = 1;
      if (ahead(me) < ka) n++;
      for (let j = 0; j < R.ais.length; j++) if (j !== i && ahead(R.ais[j]) < ka) n++;
      m.x = a.x; m.z = a.z; m.label = n; m.fill = ka < ahead(me) ? '#e5484d' : '#6b7280';
    }
  }
}
// 走路的時候 body.walking（garage.css：全螢幕的時候去哪裡那一排放到搖桿上面，不要蓋到搖桿）
function bodyWalking(on) { if (on !== bodyWalking.on) { bodyWalking.on = on; document.body.classList.toggle('walking', on); } }
// ---- 第 25 批：駕駛座的後照鏡照出後面真的東西（Nick 2026-10-21「第一人稱駕駛的時候 後照鏡要真的顯示後方景色 有車子也要顯示出來 且會跟著開車方向移動」）----
// 一台往後看的相機（駕駛眼睛的高度、車子正中間；畫的時候自己的車藏起來）畫到一張 512×170 的圖；車內後照鏡、左右兩面照後鏡各拿這張圖的一塊（左右相反＝鏡子）
// 只有駕駛座視角才畫、三格畫一次（每次約 90–110 calls、0.45M 三角形）；照後鏡（S.mats.mirrorGlass 那幾片）換成這張圖，離開駕駛座視角就換回原本的
const MIR_TH = Math.tan((32 * Math.PI) / 180), MIR_W = 512, MIR_H = 170, MIR_TV = (MIR_TH * MIR_H) / MIR_W; // 相機左右各 32 度
const MIR_EYE = [0, 1.1, 0], MIR = { on: false, S: null, rt: null, cam: null, mat: null, list: [], n: 0, calls: 0, tris: 0, v: new THREE.Vector3(), w: new THREE.Vector3(), m: new THREE.Matrix4() };
// o（車身底下的 mesh）：照它在車身上的範圍（z 左右、y 上下）算 uv＝這面鏡子看得到圖的哪一塊；t0～t1＝往左幾度的 tan（左＝正）、s＝往上（中間往下一點）
function mirUV(S, o, t0, t1, s0) {
  const g = o.geometry, p = g.attributes.position, n = p.count;
  MIR.m.copy(S.body.matrixWorld).invert().multiply(o.matrixWorld);
  let z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const zy = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { const v = MIR.v.fromBufferAttribute(p, i).applyMatrix4(MIR.m); zy[i * 2] = v.z; zy[i * 2 + 1] = v.y; z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const zw = Math.max(1e-4, z1 - z0), yw = Math.max(1e-4, y1 - y0), sh = ((t1 - t0) * yw) / zw, uv = new Float32Array(n * 2); // 上下看多少照鏡子的長寬比
  for (let i = 0; i < n; i++) { // 往後看的相機：圖的右邊＝車子的左邊；鏡子左右相反：鏡子左邊（z 小）看左邊（t 大）
    const t = t1 - ((zy[i * 2] - z0) / zw) * (t1 - t0), q = s0 + ((zy[i * 2 + 1] - y0) / yw - 0.5) * sh;
    uv[i * 2] = 0.5 + t / (2 * MIR_TH); uv[i * 2 + 1] = 0.5 + q / (2 * MIR_TV);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
function mirrorSet(on) {
  for (const e of MIR.list) { e.o.material = e.mat; if (e.cab) e.o.visible = false; } // 換回原本的
  MIR.list.length = 0; MIR.on = false; MIR.S = null;
  const S = tripS; if (!on || !S?.body) return;
  if (!MIR.rt) {
    MIR.rt = new THREE.WebGLRenderTarget(MIR_W, MIR_H, { depthBuffer: true });
    MIR.cam = new THREE.PerspectiveCamera((2 * Math.atan(MIR_TV) * 180) / Math.PI, MIR_W / MIR_H, 0.3, 200);
    MIR.mat = new THREE.MeshBasicMaterial({ map: MIR.rt.texture, side: THREE.DoubleSide, fog: false });
  }
  S.body.updateMatrixWorld(true);
  const cm = S.cabin?.userData.mirror;
  if (cm) { mirUV(S, cm, -0.3, 0.3, -0.035); MIR.list.push({ o: cm, mat: cm.material, cab: true }); cm.material = MIR.mat; cm.visible = true; } // 車內：正後面左右各 17 度
  const gl = S.mats?.mirrorGlass;
  if (gl) S.body.traverse((o) => {
    if (!o.isMesh || o.material !== gl || !o.geometry.attributes.position) return;
    o.getWorldPosition(MIR.w); S.body.worldToLocal(MIR.w);
    if (MIR.w.z < 0) mirUV(S, o, 0.1, 0.52, -0.04); else mirUV(S, o, -0.52, -0.1, -0.04); // 左邊那面看左後方（6～27 度），右邊看右後方
    MIR.list.push({ o, mat: gl }); o.material = MIR.mat;
  });
  MIR.on = true; MIR.S = S; MIR.n = 0;
}
function mirrorStep() {
  const want = !!(drv && DRIVE.on && drv.cameraMode === 'eye' && tripS?.car?.visible);
  if (want !== MIR.on || (want && MIR.S !== tripS)) mirrorSet(want);
  if (!MIR.on || MIR.n++ % 3) return; // 三格畫一次
  const S = MIR.S, e = dEye?.eye || MIR_EYE;
  S.body.updateMatrixWorld(true);
  MIR.cam.position.set(e[0], e[1], 0).applyMatrix4(S.body.matrixWorld);
  MIR.v.set(e[0] - 10, e[1], 0).applyMatrix4(S.body.matrixWorld); MIR.cam.up.set(0, 1, 0); MIR.cam.lookAt(MIR.v);
  S.car.visible = false; // 自己的車不畫（不然看到的是自己的車尾）
  renderer.setRenderTarget(MIR.rt); renderer.render(TR.scene, MIR.cam); renderer.setRenderTarget(null);
  S.car.visible = true;
  MIR.calls = renderer.info.render.calls; MIR.tris = renderer.info.render.triangles;
}
function driveFrame(now) {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (dcam.userData.w !== w || dcam.userData.h !== h) { dcam.aspect = w / h; dcam.updateProjectionMatrix(); dcam.userData.w = w; dcam.userData.h = h; if (dEye) dEye.fov = cabinFov(cur, dcam.aspect); }
  const dt = Math.min(0.1, (now - lastD) / 1000 || 0); lastD = now;
  driveStep(dt);
  if (!DRIVE.on) return; // 交給賽道、回車庫了這一格就不畫（車子已經放回原點）
  if (camGo) { // 車店：鏡頭慢慢移去看選的那台車
    camGo.t = Math.min(camGo.T, camGo.t + dt); const s = camGo.t / camGo.T, e = s * s * (3 - 2 * s);
    dcam.position.lerpVectors(camGo.p0, camGo.p1, e); camAt.lerpVectors(camGo.a0, camGo.a1, e); dcam.lookAt(camAt);
    if (camGo.t >= camGo.T) camGo = null;
  }
  if (indoor) { renderer.render(indoor.scene, dcam); return; } // 在房子裡面：只畫房子裡面（自己的燈；村子的地面跟地板重疊，不畫）
  GAR.cull(dcam); // 第 21 批：每一層的車只畫看得到的（在塔裡面＝只畫那一層）
  OB?.cull(dcam); // 第 6 批：鏡頭跑到越野車車庫的屋頂上面就不畫屋頂（才看得到裡面的車）
  mirrorStep(); // 第 25 批：駕駛座的後照鏡
  renderer.render(TR.scene, dcam);
}
