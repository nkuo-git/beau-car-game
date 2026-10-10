# 大便龍的改車遊戲 — 給 Claude 的說明（每次開工先讀）

## 這是什麼
- 一個 3D 改車開放世界遊戲（three.js 0.186.1，沒有框架），玩家是 Nick，在 Android 手機上玩。
- 白色大理石車庫：換車色、輪框、套件、寬體、尾翼、引擎零件、輪胎；下車走路、自訂角色；開車出門到小村莊（台灣小鎮）。
- 地點：阿輝改車廠（零件、修車）、阿財車行（買車）、大便龍賽車場（繞圈賽、AI 對手）、400 公尺直線加速、快速道路、越野車場（粉紅怪獸卡車、越野車行、泥巴賽）、越野車車庫、內湖（OpenStreetMap 1:1，七個真的地標）、山（之字形山路、山頂涼亭、爬山計時賽）、警察局（通緝星星、追捕、拘留室）、槍店＋靶場、可以進去的透天厝、路上的車和行人、甩尾、怪獸卡車輾扁東西。
- 以前是「大便龍的萬能軟體」（repo nkuo-git/carid-pwa）裡「汽車 → 改車」那一頁（tune.html）。2026-10-09 搬出來變成自己的網站＋自己的 APK：
  - 網站（GitHub Pages，main 的 `docs/`）：https://nkuo-git.github.io/beau-car-game/
  - APK：GitHub Releases（tag `apk-N`，檔名 `beau-car-game-N.apk`）
- 萬能軟體（內容 39，2026-10-09）已經**不能玩**遊戲了：它的「改車」變成搬家頁（下載這個 App、把進度搬過來）。那個 repo 不是這個專案的，這裡不要改它。

## Nick 和工作規則（一定要照做）
- Nick 是小孩，用繁體中文寫；**回答也用繁體中文**，字要簡單、白話、短。帳號是家長的。
- **任何畫面（UI）的改動：先做 mock 給 Nick 看，他說好才做。** mock 放在設計畫布 https://claude.ai/artifact/DEgxSAezMVGGMp9CuZjQev（或做一個新的 mock artifact）。
- **遊戲的改動先放試做頁**（下面「試做頁」），Nick 玩過、說「上線」（或類似的話）才放到網站／手機。手機上的版本永遠是正常的錢（不是試做頁那種用不完的錢）。
- **不會自己更新**：新版只跳一條「有新版本，要更新嗎／更新」，按了才換；App 有新版本跳「App 有新版本／下載安裝」。不要改成自動更新。
- **用量**：Nick 2026-10-04 的規定「以後如果當周token limit已超過70% 請先停下所有工作 讓我決定是否要繼續」。Claude 看不到用量表，所以**只要看到任何用量／速率限制的提示，就先停下來問 Nick**。
- 看起來像一長串「cccccb…」的訊息是不小心按到 YubiKey，**不要理它、也不要重複那串字**。
- 秘密（密碼、金鑰、token）**永遠不要**放進 repo、記憶、聊天。
- Commit 訊息：繁體中文、短；最後兩行是這個 session 的系統提示給的 `Co-Authored-By: …` 和 `Claude-Session: …`（照抄，不要自己編）。除了那一行，程式、文件、commit 裡都不寫模型的名字。

## 內容規則（一定要守）
- 卡通暴力而已：**沒有血**、沒有血腥；被打、被撞的人倒下去會再站起來。
- **警察永遠不開槍**，只會追、抓人；被抓不會沒收槍和子彈。
- **小孩永遠不會被打到**（揍、車、槍都不會）。
- **人永遠不會被輾過、壓扁**。Nick 2026-10-09 問「人可以輾」，回答是不行：大車開過來，人會跳開（npc.js `dive()`，喊「哇！」），被壓扁的只有東西和車。
- **不能有真的品牌名字、logo、車標字、警察徽章**；店名、招牌都用自己編的。（注意：車庫頁的車名現在寫的是真的車款名字，例如「Subaru Impreza WRX STI」「豐田 GR」——這是以前就有的；要不要改先問 Nick／家長，不要自己改。）
- 內湖畫面上的「地圖資料 © OpenStreetMap 貢獻者」**一定要留著**（ODbL）。
- **不能用** Google 街景、Google 3D tiles 的圖。Nick 給的參考照片只能拿來看著做模型，**照片本身永遠不能放進遊戲**。

## Repo 結構
```
src/                 遊戲原始碼（平的一層，腳本都用自己的資料夾找檔案）
  garage.src.html    車庫頁（畫面＋主程式；<!--__GARAGE__--> 框起來的是畫面）、garage.css
  town.src.js race.src.js circuit.src.js neihu.src.js   接在頁面 module 裡的程式（出門、比賽、賽車場、內湖）
  *.js               模組（village street police npc walk drive terrain offroad circuit neihu mountain orbay crush police-ai guns gunshop character lookpanel room cabin damage carlod ghost …）
  bigmap.js          大地圖（點小地圖打開：拖、放大、點地方「去這裡」）；town.src.js 的 mapStep 接小地圖（比賽：看整個賽道、對手號碼點）
  ghost.src.js       鬼影車排行榜：錄爬山／賽車場一圈／400 公尺、發 'beau-run'、window.beauGame.setGhost（接在 neihu.src.js 後面）
  net.src.js         一起開車／一起比賽／參觀車庫的遊戲那一邊：朋友的車和人、名字牌、表情、地圖上的點、一起比賽、參觀車庫畫面（window.beauGame.net／visit；接在 ghost.src.js 後面）
  *-look.js *-spec.js 每台車的外觀／規格；body-*-q.glb（車庫用）、body-*-lod.glb（輕量車）＝車身檔
  build-art.mjs      試做頁 → src/art/garage.html（＋car-*.txt）；make-free.mjs → src/art/garage-free.html（錢用不完）
  build-site.mjs     網站 → docs/（用 build-app.mjs 的打包，再加 site/ 的東西）
  build-app.mjs      萬能軟體的改車頁（tune.html／tune.js／tune.css／tune/*.glb）；只有萬能軟體要更新遊戲時才用
  site/              網站才有的：index.src.html、site.js（版本號、更新條、搬進度）、cloud.js（登入、雲端存檔）、online.js（連線：名字、排行榜）、room.js（房間：開、加入、位置、一起比賽、參觀車庫、讚；Realtime Database）、site.css、sw.src.js、manifest、icons、make-icons.py
  app/               萬能軟體改車頁的外框（build-app.mjs 用）
  data/neihu3.osm.gz 內湖的 OSM 原始資料（neihu-conv.mjs 讀，產生 neihu-data.js）
  test-*.mjs …       測試（下面）；test-fixtures/trunk-0.8.35/ ＝ drift-test 比對用的舊 drive.js
  body.mjs *-body.mjs make*.mjs monster-*.mjs lod-*  車身產生器（SDF → glb；這次搬家沒有重跑驗證過）
  CARS-CONTRACT.md   做新車的規則
docs/                網站（產生出來的，有 commit：GitHub Pages 從 main 的 /docs 發佈）
android/             APK 的殼（WebView）；.github/workflows/android.yml 編 APK、發 Release
notes/               每一塊的工作記錄（英文，舊的；檔名對到 src/）
```

## 安裝
```
npm ci                      # 在 repo 最上層；three 0.186.1（遊戲、測試）＋ @gltf-transform、meshoptimizer（只有車身產生器用）
```
測試用的 Playwright 是機器上已經裝好的：`/opt/node22/lib/node_modules/playwright`（1.56.1），Chromium 在 `/opt/pw-browsers/chromium`。
**不要跑 `playwright install`**。

## Build
- 試做頁：`cd src && node build-art.mjs --yaris && node make-free.mjs` → `src/art/garage.html`、`garage-free.html`、`car-*.txt`（`src/art/` 不進 git）。
- 網站：`node src/build-site.mjs <內容版號>` → `docs/`（版號不能比 `docs/version.json` 小；每次上線 +1）。
- 新的模組要加到 build-art.mjs **和** build-app.mjs 兩個打包清單（同樣的順序）；build-site.mjs 用 build-app.mjs 的清單，不用改。
- 存檔：新的要存的東西加在 garage.src.html 的 `save()`，讀檔的時候要修好（舊存檔一定要讀得進來）。

## 版本號
- 標題旁：`0.<APK 版號>.<內容版號>`。APK 版號＝「編 APK」workflow 的 run number（Release `apk-N`），網頁版（不在 App 裡）是 0。內容版號＝`docs/version.json`。
- 內容 1 ＝ 跟萬能軟體 0.9.37／內容 38 一樣的遊戲（main 第一次）。
- 試做頁有自己的版本（v27 ＝ 內容 2；v28 ＝ 內容 4；v29 ＝ 內容 5）；下一個試做頁是 v32（v30 ＝ 撞前車不會整台停住；v31 ＝ 大地圖；v30＋v31 ＝ 內容 7）。

## 試做頁（artifact）
- https://claude.ai/artifact/29pHoiqGVBs34ERLnJ9T8s（Nick 的；新的專案第一次發佈前要先用 Artifact 的 `read` 讀它，才能更新同一個網址）。
- 發佈：`garage-free.html`（`TRIAL_FREE = true`：試做頁什麼都免費）當頁面，加上 16 個 `src/art/car-*.txt`（檔名不變，跟頁面放在同一層）。網站／手機永遠用正常的錢（`TRIAL_FREE = false`，不要改 garage.src.html 裡的值）。
- 發佈前：build、跑會碰到的測試。發佈後跟 Nick 說改了什麼（簡單的話）。

## 上線（Nick 說「上線」以後）
1. 試做頁的改動在 main 上（分支就 merge 進 main）。
2. `node src/build-site.mjs <上一版+1>`，跑測試（全部，或至少 test-b1、test-app-b1、site-test 和改到的那幾個）。
3. commit `src/` 和 `docs/`，push main → GitHub Pages 發佈。手機的 App 下次打開會跳「有新版本，要更新嗎」。
4. 改到 `android/` 才會編新的 APK（workflow 只看 android/** 和 workflow 檔）。

## 測試（`cd src`；很重：一次只跑一個，跑完才跑下一個，不要背景同時跑兩個瀏覽器測試）
`./run-tests.sh [名字…]` 會一個一個跑，記錄在 `out/logs/`。單獨跑：

| 指令（在 src/） | 測什麼 | main 上應該是 |
|---|---|---|
| `node test-b1.mjs ../out/b1/b1` | 整個開放世界：車庫、走路、升降停車格、開車、改車廠、車店、快速道路、賽車、警察局、房子、行人車流、全螢幕版面 | 149 ok，ALL CHECKS OK（約 8–13 分；含 400 公尺的鬼影車、全螢幕按鈕收起來／按鈕大小） |
| `node test-b4.mjs ../out/b4/b4` | 越野車場、怪獸卡車、越野車行、泥巴賽、越野車車庫 | 76 ok |
| `node test-b3.mjs ../out/b3/b3` | 警察（星星、追、抓、拘留、罰款）、槍店、靶場、槍 | 56 ok |
| `node neihu-test.mjs ../out/nh/nh` | 內湖：轉換程式重跑一樣、地標、開到港墘站、路牌、走路、內湖的車流和行人 | 35 ok |
| `node circuit-test.mjs ../out/ci/ci` | 賽車場、AI、名次、每一圈錄下來＋鬼影車；大地圖（走路、開車、拖、點地方、去這裡）、比賽的小地圖（對手號碼點、整個賽道）、撞到對手 | 37 ok，PASSED |
| `node drift-test.mjs ../out/drift/drift` | 甩尾（Node＋瀏覽器；沒甩的時候跟舊 drive.js 一模一樣） | 42 ok |
| `node bump-test.mjs` | 撞到會動的車（比賽的對手）：追撞掉到差不多前車的速度、前車被推快、撞牆照舊、擦到旁邊（Node，一秒） | 7 ok |
| `node crush-test.mjs ../out/crush/crush` | 怪獸卡車輾扁車、騎的機車和路邊的東西、人跳開、輾扁的東西長回來 | 57 ok |
| `node mountain-test.mjs ../out/mt/mt` | 山：去山頂、爬山計時賽、上山下山貼著路、山頂走路、越野車捷徑、輾扁山上的東西、警察追上山、爬山的鬼影車 | 42 ok |
| `node free-test.mjs` | 試做頁錢用不完、正常頁存檔的錢 | 2 ok（先跑 make-free.mjs） |
| `node test-app-b1.mjs ../docs ../out/app1/app` | 網站（docs/）整趟：跟 test-b1 一樣＋版本號、標題列、App 外殼的全螢幕 | 151 ok（試玩頁 docs/try 標題寫「試玩」，版本號那一項會不過） |
| `node test-app-b4.mjs ../docs ../out/app4/app` | 網站的越野車場 | 76 ok |
| `node site-test.mjs ../docs ../out/site/site` | 網站：打開、開車、有新版本那一條、App 有新版本、搬進度 | 22 ok |
| `node cloud-test.mjs ../docs ../out/cloud/cloud` | 登入＋雲端存檔（假的雲端、兩支手機、沒網路、App 外殼） | 20 ok |
| `node online-test.mjs ../docs ../out/online/online` | 連線：要先登入、取名字（擋髒話）、跑完自己上傳、排行榜、鬼影車按鈕（假的 Firestore） | 30 ok |
| `node room-test.mjs ../docs ../out/room/room` | 兩支假手機（兩個瀏覽器、假的即時資料庫）：開房間、加入、一起出門、表情、一起爬山／400 公尺、成績、回房間一起開、參觀車庫按讚、離開、斷線、滿了、關房間 | 49 ok，ALL CHECKS OK（約 4 分） |

- test-app-b1／b4 給萬能軟體的 repo（有 tune.html）也可以跑，就是測萬能軟體的改車頁。
- **不可以為了變綠燈把測試改鬆**；找出原因修好。新加或改的測試要真的有在測東西。
- 已知偶爾會不穩：test-b3 第 3 段找不到走路中的小孩（重跑會過）；機器人開車偶爾撞到人，測試會把星星清掉並記下次數（不算錯）。

## 效能（手機）
- 每個新東西都要看 draw calls 和三角形（`renderer.info`），報告幾個地方的數字。現在開車的畫面大約 150–320 calls、1.0–1.3M 三角形（自己的車就約 100 calls、0.9M）。
- 同材質的幾何合併、重複的用 InstancedMesh、遠的藏起來（分塊、距離剔除）。
- **每一幀不 new 東西**（向量、陣列都重用），粒子、胎痕、碎片都先配好（pool）；很重的工作分好幾幀做（time-slice）。
- 每幀的 JS 要小：模組的 update 平均都在 0.01–0.3 ms。

## 存檔，和從萬能軟體搬進度
遊戲存在 localStorage（這幾個 key，名字保留萬能軟體的 `carid.` 開頭）：

| key | 內容 |
|---|---|
| `carid.tune` | 存檔 JSON（garage.src.html `save()`）：`{v:2, cur, scene, money, owned[], parts{}, tyres{}, wins{}, park{}, dmg{}, look{}, guns{}, best{hill{<車>:秒}}, cars{<車>:{外觀}}}` |
| `carid.tune.full` | 全螢幕 `'on'`／`'off'` |
| `carid.sound` | 引擎聲 `'on'`／`'off'` |
| `carid.roomq` | 車庫畫質 `'high'`／`'low'` |
| `carid.btnsize` | 全螢幕按鈕大小 `'s'`／`'m'`／`'l'`（內容 8 起；搬家不帶） |
| `carid.theme`、`carid.accent` | 萬能軟體設定裡的亮暗、主色（網站的 head 會照它；這裡沒有設定頁） |

**搬家格式（萬能軟體那邊的「搬家」要照這個做）**：
- `base64url( UTF-8 的 JSON )`，`=` 可有可無：`{"v":1,"from":"carid-pwa","keys":{"carid.tune":"<localStorage 裡原封不動的字串>", "carid.sound":"off", …}}`
- 只認上面 6 個 key（其他的不管）；`carid.tune` 一定要有，而且要是有 `v`（數字）的 JSON 物件；每個值是字串、最多 512 KB。
- 送法：Android 的連結 `beaucargame://import?save=<base64url>`（新 App 的殼收到 → 網頁 `window.beauImport(save)`）；測試／瀏覽器：`https://nkuo-git.github.io/beau-car-game/#import=<base64url>`。
- 網頁先問「要把萬能軟體裡的進度搬過來嗎？（會蓋掉這裡的進度）」搬過來／不要。搬過來：這 6 個 key 先清掉，再寫進搬來的，重新載入。資料壞掉：「搬家的資料看不懂，沒有搬。」什麼都不改。
- 萬能軟體那邊的「搬家」頁 2026-10-09 已經上線（內容 39）：照上面的格式送 `beaucargame://import?save=…`（App 裡）或 `#import=`（瀏覽器）。沒裝新 App 時在萬能 App 裡按會出現 WebView 的錯誤頁（按返回就好）。
- 注意：一般瀏覽器裡，`nkuo-git.github.io/carid-pwa` 和 `/beau-car-game` 是同一個網域，localStorage 是共用的（兩邊看到同一份存檔）；兩個 APK 各自分開。萬能軟體的 sw.js 換版時會刪掉同網域上不是它自己的快取（改車遊戲的離線快取會被清掉，重新下載而已，不會壞）。

## App（APK）
- `android/`：WebView 殼，package `com.nkuo.beaucargame`，名字「大便龍的改車遊戲」（桌面上「改車遊戲」），開 START_URL＝網站。直的、橫的都可以。
- 網頁那邊叫 `window.BeauCarApp`：`setFullscreen(on)`、`ready()`、`googleSignIn()`（apk-4 起；結果回 `window.beauGoogleSignIn(idToken, 錯誤)`）。User-Agent 帶 `BeauCarApp/<版號>`。返回鍵先問網頁 `window.caridExitFullscreen()`（關自訂角色、離開這一趟的全螢幕），網頁回 false 才離開。
- 搬家連結 `beaucargame://import?save=…` → `window.beauImport(save)`。
- workflow 只有在 main 才發 Release；在別的分支手動跑（workflow_dispatch）只是試編（apk-3 就是這樣用掉的號碼）。
- 簽章：workflow 第一次跑用 repo secret **`BEAU_KEY_PASS`** 產生 `android/keystore/beaucargame.jks` 並 commit（之後都用同一把，新版才能直接蓋過去裝）。沒有那個 secret：用臨時的 debug 簽章，Release 發成「預先發行」（遊戲裡的「App 有新版本」不會指到它），裝正式版前要先移除（存檔會不見）。
- 這個機器的 GitHub 代理不給碰 Actions secrets 和 Pages 設定（403）：這兩個要 Nick（或家長）在 GitHub 網頁上設。
- 圖示：萬能軟體的橘色車＋右下角格子旗徽章（蓋掉保桿上的貼紙字），深色底（`src/site/make-icons.py`）。

## 現在的狀態（2026-10-10）
- **main** ＝ 手機上的 0.9.37 遊戲（萬能軟體內容 37／38 的 tune.js 跟 `build-app.mjs` 產生的一模一樣）＋這次的網站（內容 1）＋APK 殼。
  - 0.9.37 有：越野車車庫（4 格，越野車專屬）、怪獸卡車輾扁東西（車、路邊小東西；人跳開）、汽車半價、怪獸卡車 100 萬、拿掉撞爛（`CRASH_DAMAGE = false`）、內湖（七個地標、路牌、離村子近）、警察、槍店、甩尾、賽車場。
- **內容 2（2026-10-09 上線，試做頁 v25–v27）**：路變寬 1.5 倍（村子、內湖；快速道路、賽車場、直線加速沒變）；房子最多 2 層（村子、內湖；地標不變），越野車撞不倒房子，其他的（樹、電線桿、警車⋯）幾乎都輾得扁（不會輾的：人、小孩、房子、你家車庫、改車廠、車店、槍店、警察局、廟、捷運柱子⋯），輾扁的東西你離開 140 公尺 25 秒後會修好；越野車車庫搬到你的車庫前面左邊（門對著路，變大）；你的車庫變高（6 公尺、門 8×5）、裡面變寬（31.4 公尺）；路人不會再卡在門口。說明在 `notes/wide.md`、`notes/tall.md`。
- **內容 3（2026-10-09 上線）＝ 登入＋雲端存檔**：右上角「☁ 登入」，用 Google 帳號登入（Nick 的 Firebase `beau-car-game`），進度存在雲端 `saves/{uid}`（`src/site/cloud.js`，說明在 `notes/cloud.md`）。
  - App 要新版外殼（apk-4 起，`BeauCarApp.googleSignIn()`）才能登入，而且 Firebase 要有 Android 應用程式（`com.nkuo.beaucargame`＋SHA-1，見 notes/cloud.md）；舊 App 按登入會叫他先更新。
  - 試玩頁 `docs/try/`（`node src/build-site.mjs <版號> --try`）：要真的連網路才能試的東西（試做頁 artifact 連不到 Firebase）放這裡；跟正式網站同網域、用同一份存檔；不裝 Service Worker。
- **內容 4（2026-10-09 上線，試做頁 v28）**：越野車也輾得扁路上騎的機車（騎士先跳車跑掉，只有機車扁；`notes/crush.md` 第 13 批）。
- **內容 5（2026-10-10 上線，試做頁 v29）＝ 山**：村子北邊一座約 102 公尺高的山，約 1 公里的之字形山路（護欄、急彎牌、反光鏡）、山頂停車場＋紅色涼亭＋觀景台、越野車泥土捷徑、「去山頂」、爬山計時賽（每台車記最快的，存在 `best.hill`）。草稿 https://claude.ai/artifact/NhH4i6Gw2C8Yk2ZhEx6Poj （說 120 公尺、1.5 公里，做出來比較小）。說明在 `notes/mountain.md`。
- **接下來（Nick 選「做1236」，草稿和家長都同意了）**：連線 https://claude.ai/artifact/6BtzWH7D5uWYMCra2e7DJo ——照順序：鬼影排行榜（爬山計時賽也接上去）→ 一起開車 → 一起比賽 → 參觀車庫。每做好一個先放試做頁（要連網路的放試玩頁 docs/try/）。
  - **鬼影排行榜（2026-10-10 上線＝內容 6）**：右上角「👥 連線」→ 取名字 → 🏆 排行榜（400 公尺／賽車場一圈／爬山 × 大家／同一台車）→「👻 跟第 1 名的鬼影車跑」。說明在 `notes/online.md`。
    Firestore 規則（`notes/online.md` 裡那一段，也包含原本的 saves）家長 2026-10-10 已經貼到 Firebase 主控台。試做頁 artifact 連不到 Firebase：只有遊戲那一邊（錄下來、鬼影車），看不到排行榜。
- **內容 7（2026-10-10 上線，試做頁 v30＋v31）＝ 大地圖＋撞前車**：點右上角的小地圖（下面寫「🗺 大地圖」）→ 整張地圖（拖、兩指放大、點地方「去這裡」）；賽車場比賽時小地圖上的對手是有號碼的點（名次），點小地圖看整個賽道；比賽撞到前車照兩台車的動量算，不會整台停住（警車、路上的車還是像牆）。草稿 https://claude.ai/artifact/VF5wb2U1PpAnzBRyJsSSW6，說明在 `notes/bigmap.md`。一起開車時朋友也會畫在大地圖上（連線第 2 步）。
- **內容 8（2026-10-10 上線，apk 也重編）＝ 連線第 2–4 步：房間＋一起開車＋一起比賽＋參觀車庫**：「👥 連線」→ 開一個房間（4 個字的房間碼，最多 4 個人）／輸入房間碼加入；房主按「一起出門」「🏁 一起比賽」（賽車場 3 圈、400 公尺、爬山；泥巴賽「下次做」）；遊戲裡右邊「房間 CODE」＋💬 表情（只有 5 個固定的，不能打字）；參觀車庫只能看、按讚。用 Firebase 的 Realtime Database（家長 2026-10-10 開好、規則貼好）。說明、規則在 `notes/room.md`。
- **修 5–12（內容 8，2026-10-10 上線）**：越野車車庫的追車鏡頭不會跑到屋頂上面（drive.js `setCamCeil`）；停車格車頭朝外，直接開出去；在車庫裡選目的地鐵捲門自己開；輾扁的東西 20 秒以後、你離 15 公尺以上就 0.8 秒慢慢長回來；電線桿扁了電線一起垂下來（長回來一起拉回去）、內湖大路牌整支一起扁；內湖有車流和走人行道的人（neihu.js `V.npcRoads`：大路、一般的路、巷子，單行道一條車道；npc.js 路口切好的不再找丁字路口、走不出去的車道剪掉）；手機橫拿全螢幕「去哪裡」收成一顆「📍 去哪裡 ▾」、小畫面「下車」在左邊、手煞車一行；撞到警車、路上的車照動量算（不像牆）；App 的字固定大小（`setTextZoom(100)`，內容 8 上線時編的新 APK 才有）。
  - **按鈕收起來＋按鈕大小（內容 8；Nick 2026-10-10 說好，草稿 https://claude.ai/artifact/UKuAXoAiocDidxbjYY8EE9 ）**：全螢幕開車（直拿、橫拿都一樣）平常只有「📍 去哪裡 ▾」和「⋯」；按「⋯」才出現聲音、全螢幕、換視角、「Aa」；再按一次、選了地方、車子開起來（超過時速約 14 公里；車已經在動才打開的話 8 秒）就收起來（town.src.js `FOLD`、`foldStep`）。「Aa」→「按鈕大小 小／中／大」＝0.8／1／1.15 倍（CSS `--hudz`、`zoom`），每支手機自己記在 localStorage `carid.btnsize`（不在存檔裡）。
- **已知問題**
  - 內湖的路是平的（真的港墘一帶本來就很平）。
  - 內湖的車流、行人讓第一次出門的載入多約 0.4–0.7 秒（電腦上；npc.js 路網，`NPC.load.graphs`）。
  - 引擎、輪胎尖叫、警笛的音量都沒有真的聽過（測試是靜音的）。
- **暫停中**：更多越野車（吉普車、小型越野車、皮卡、沙灘車）——一台一台做，每台先給 Nick 看圖。
- **價錢（萬，新台幣）**：GC8 75（一開始就有）、YARIS 130、SUPRA 200、GT-R 400、918 3000、SP3 6000、JESKO 7500（阿財車行）；怪獸卡車 100（越野車行）。槍：手槍 3、衝鋒槍 12、霰彈槍 18、步槍 30；靶場第一次全中每把槍 2 萬。泥巴賽獎金 20／80／300。被抓罰款每顆星 2 萬。零件、輪胎的價錢在 garage.src.html 的 `PERF`。

## 筆記（notes/）
以前每一塊的工作記錄（英文）：walk（走路）、npc（車流行人）、houses（房子）、city-garage（村子、車庫、升降機）、crash（撞爛，現在關掉）、char（角色）、fullscreen、police、guns、park（越野車場）、monster（怪獸卡車）、int（警察＋槍接進遊戲、第 3 批整合）、circuit（賽車場）、drift（甩尾）、neihu（內湖 v1）、land（內湖地標、路牌）、orbay（越野車車庫）、crush（輾扁）、mountain（山）、online（鬼影排行榜）、room（房間、一起開車、一起比賽、參觀車庫）、bigmap（大地圖、撞前車）、fixes（已知問題 5–12 的修法：越野車車庫、輾扁長回來、電線、內湖車流行人、橫拿手機的按鈕）。裡面的 `old-scratch/…` 路徑是舊暫存資料夾，不在 repo。
