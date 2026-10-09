
// ==== 內湖（neihu.js：真的地圖，OpenStreetMap）：每一幀收遠的格子、在內湖的時候寫「地圖資料 © OpenStreetMap 貢獻者」、第一次開進去說一聲 ====
// build-art.mjs／build-app.mjs 把這個檔接在 circuit.src.js 後面（用得到 VIL、drv、walker、dcam、DRIVE、stage、home、indoor）
// 怎麼去：直線加速賽道一直往東開（盡頭的柵欄拿掉了），接聯外道路（綠色的「內湖」指示牌）→ 內湖路一段（西湖站那邊）
let nhCredit = null, nhIn = false, nhRoad = null, nhRoadNm = '', nhRoadT = 0;
function nhRoadTick(N, inN) { // 現在在哪一條路上（Nick 2026-10-05「可以掛路牌讓我看得出我在什麼路上嗎?」）：藍底白字，跟路名牌一樣
  const t = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (!inN) { if (nhRoad && !nhRoad.hidden) { nhRoad.hidden = true; nhRoadNm = ''; } return; }
  if (t - nhRoadT < 250) return; // 最多 0.25 秒問一次（路網的格子，沒有 new）
  nhRoadT = t;
  const who = walker && walker.mode === 'walk' ? walker : drv, q = who && who.telemetry ? who.telemetry() : null;
  const nm = q ? N.roadName(q.x, q.z) : '';
  if (nm === nhRoadNm) return;
  nhRoadNm = nm;
  if (!nhRoad) { // 左上角：地方的膠囊（.dv-chip 10…50）、按鈕（.dv-act 58…112）下面
    const st = document.createElement('style'); // 矮的畫面（手機橫拿）：左邊 118 那裡是「直接回車庫」、「去哪裡」（garage.css 的 body.fs #drivebar）：往右挪到它們旁邊
    // z-index 2：在 HUD（.dv／.wk 是 3）下面，說一句話的泡泡（.dv-toast 在畫面 34% 的高度）蓋得過它
    st.textContent = '#stage .nh-road{position:absolute;top:118px;left:10px;max-width:calc(100% - 158px);z-index:2;pointer-events:none;box-sizing:border-box;height:30px;display:flex;align-items:center;padding:0 12px;border:2px solid rgba(255,255,255,.92);border-radius:8px;background:#1F4F9C;color:#fff;font:700 16px/1 "Noto Sans TC","PingFang TC",sans-serif;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.pw-host.pw-on .nh-road{margin-top:46px;transition:margin-top .2s}' // 通緝中：膠囊、按鈕往下 46px（police-ai.js），路名牌跟著
      + '@media (max-height:560px){#stage .nh-road{top:122px;left:115px;max-width:calc(100% - 440px)}#stage.pw-on .nh-road{margin-top:0}}';
    document.head.appendChild(st);
    nhRoad = document.createElement('div'); nhRoad.className = 'nh-road';
    stage.appendChild(nhRoad);
  }
  nhRoad.textContent = nm; nhRoad.hidden = !nm;
}
function nhTick() {
  const N = VIL?.neihu; if (!N || !dcam) return;
  N.update(dcam); // 遠的格子不畫（照鏡頭的位置，走 8 公尺才重算一次）
  const p = dcam.position, inN = DRIVE.on && !indoor && N.inside(p.x, p.z);
  nhRoadTick(N, inN);
  if (inN !== nhIn) {
    nhIn = inN;
    if (inN && !nhCredit) { // 地圖資料的出處（ODbL 要寫）：右上角下面一點、小小的字，不擋按鈕
      nhCredit = document.createElement('div'); nhCredit.className = 'nh-credit'; nhCredit.textContent = '地圖資料 © OpenStreetMap 貢獻者';
      nhCredit.style.cssText = 'position:absolute;right:8px;bottom:calc(6px + env(safe-area-inset-bottom,0px));z-index:4;pointer-events:none;font:600 10px/1.2 "Noto Sans TC","PingFang TC",sans-serif;color:rgba(255,255,255,.88);background:rgba(14,15,18,.45);padding:2px 6px;border-radius:6px;white-space:nowrap';
      stage.appendChild(nhCredit);
    }
    if (nhCredit) nhCredit.hidden = !inN;
    if (inN && home && !home.nh) { // 第一次開（走）進去
      home.nh = true; const w = walker && walker.mode === 'walk';
      (w ? walker : drv)?.toast('到內湖了！這裡的路、房子、捷運都照真的地圖做的', 3000);
    }
  }
}
function nhLeave() { nhIn = false; if (nhCredit) nhCredit.hidden = true; if (nhRoad) { nhRoad.hidden = true; nhRoadNm = ''; } VIL?.neihu?.uncull(); } // 藏起來的小村莊（在內湖的時候）放回去
