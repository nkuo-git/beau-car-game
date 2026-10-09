// ==== 賽車場（circuit.js）：直線加速賽道北邊的長賽道，自己開過去，一圈一圈跟對手比（race.src.js 的對手名單搬到這裡）====
// Nick 2026-10-04「賽道要很長不要只是直線」
// build-art.mjs／build-app.mjs 把這個檔接在 town.src.js 後面（用得到 VIL、drv、DRIVE、TR、stage、tripS、home、snooze、inBox、setDest、canShop、canBuy、GAR；
//   race.src.js 的 OPPS、oppLook、unlocked、calm；車庫頁的 GAME、PERF、CARS、DEFAULT_LOOK、save、renderWallet、money、trophyCount；carlod.js 的 LOD_CARS、buildLodCar）
// 怎麼玩：開進維修區的報名處（慢一點）→ 自己停好 → 選對手（贏過前一個，下一個才會出現：GAME.wins[對手 id]，跟以前的直線加速同一個，舊存檔照算）
//   → 開始比賽：放到最後一個起跑格、五顆紅燈一顆一顆亮、全部熄掉就出發 → 2 圈（後面三關 3 圈）→ 第 1 名拿獎金、記一次贏（車庫的獎盃）→「再比一次」「開走」
//   一場三台對手：這一關的對手（最快、排第一格）＋前面兩關的（第一、二關用練習的車手補）；對手開輕量車（carlod.js）
//   比賽中撞壞了不會變慢（比完才照撞壞的開；凹痕照樣有）；「放棄比賽」、開出賽車場、「直接回車庫」都會收掉
// 直線加速（race.src.js）還在原來的起跑區：同一群對手、贏了一樣有獎金，但是不會開新的對手（記在 GAME.wins['dr:<id>']，不算獎盃）
let ciRace = null, ciMenuEl = null, ciBusy = false, ciSel = null, ciCars = [], ciDmgOff = false, ciLv = 0;
const CI_PACE = [0.55, 0.62, 0.68, 0.73, 0.77, 0.8, 0.83, 0.86, 0.89]; // 每一關對手的功力（過彎抓地：開得最好的你＝1）：越後面越快
const ciLaps = (i) => (i < 6 ? 2 : 3);
const CI_FILL = [{ id: 'ci-f1', name: '賽車學校學生', key: 'gc8', hp: 230, look: { paint: '#2a7de1', livery: 'none' } }, { id: 'ci-f2', name: '週末車手', key: 'supra', hp: 330, look: { paint: '#f2c230', livery: 'none' } }];
function ciField(i) { // 這一關的對手＋前面兩關的（不夠用練習的車手補）
  const f = [{ o: OPPS[i], pace: CI_PACE[i] }];
  for (let k = i - 1; k >= 0 && f.length < 3; k--) f.push({ o: OPPS[k], pace: CI_PACE[k] });
  for (const o of CI_FILL) if (f.length < 3) f.push({ o, pace: 0.5 });
  return f;
}
// 每一格（driveStep：drive.update、越野賽之後）：比賽
function ciTick(dt) {
  if (ciRace) {
    if (ciRace.drive !== drv) { ciEnd(); return; } // 開車的換了（不會發生）
    ciRace.update(dt);
    if (ciRace && tripS?.dmg) { drv.setDamage(null); ciDmgOff = true; } // 比賽中撞壞了不變慢
  }
  if (ciMenuEl && (!drv || drv.telemetry().paused)) ciMenuClose();
}
// 每一格（沒暫停的時候、越野車場之後）：開進報名處、比賽中沒有「下車」
function ciStep(t) {
  const P = VIL.places.circuit; if (!P?.zone || !home) return;
  if (ciMenuEl && !ciRace && !inBox(P.zone, t.x, t.z, 6)) ciMenuClose(); // 選對手的時候車子被開走了（不會發生）：收起來
  if (ciRace || ciMenuEl) { drv.setAction(null); drv.setAction2(null); return; }
  if (!home.ci && VIL.circuit?.inside(t.x, t.z) && !t.auto) { home.ci = true; drv.toast('到賽車場了！開進維修區的報名處比賽', 2600); }
  if (snooze.circuit && !inBox(P.zone, t.x, t.z, 15)) snooze.circuit = false; // 開出報名處 15 公尺才會再問
  if (snooze.circuit || t.auto || !inBox(P.zone, t.x, t.z)) { home.cslow = home.cwant = false; return; }
  if (police?.wanted) { if (!home.cwant) { home.cwant = true; drv.toast('警察在追你：先甩掉警察才能報名', 2400); } return; } // 第 3 批（b3-int）：通緝中不能報名（比賽中沒有警察）
  home.cwant = false;
  if (Math.abs(t.v) > 12) { if (!home.cslow) { home.cslow = true; drv.toast('開慢一點，停進報名處'); } return; }
  snooze.circuit = true;
  const d = drv;
  drv.setAction(null);
  drv.parkAt(P.park, () => { if (drv === d && DRIVE.on) ciMenuOpen(); });
}
// 選對手（疊在畫面下面）：鎖住的是「？？？」；贏過的打勾
function ciMenuOpen() {
  if (!DRIVE.on || !drv || ciRace || ciMenuEl) return;
  circuitCSS();
  drv.setInput({ throttle: 0, brake: 1, steer: 0, handbrake: 1 });
  document.body.classList.add('ciracing', 'cimenu'); drv.toast('', 0); // 「直接回車庫」那一排先收起來（按「離開」才回來）
  if (ciSel == null || !unlocked(ciSel)) { const i = OPPS.findIndex((o, k) => unlocked(k) && !GAME.wins[o.id]); ciSel = i >= 0 ? i : OPPS.length - 1; }
  const el = document.createElement('div'); el.className = 'cir-m';
  const h = document.createElement('h3'); h.textContent = '大便龍賽車場';
  const p = document.createElement('p'); p.textContent = '選一個對手比賽。第 1 名才有獎金；贏過了，下一個對手才會出現。';
  const list = document.createElement('div'); list.className = 'list';
  const row = document.createElement('div'); row.className = 'row';
  const go = document.createElement('button'), out = document.createElement('button');
  go.type = out.type = 'button'; go.className = 'a'; out.className = 'b'; go.textContent = '開始比賽'; out.textContent = '離開';
  OPPS.forEach((o, i) => {
    const open = unlocked(i), b = document.createElement('button'), t = document.createElement('b'), s2 = document.createElement('span'), s3 = document.createElement('small');
    b.type = 'button'; b.disabled = !open; b.setAttribute('aria-pressed', String(i === ciSel)); if (GAME.wins[o.id]) b.classList.add('beaten');
    if (open) { t.textContent = o.name; s2.textContent = `${CARS[o.key].btn[0]} · ${o.hp.toLocaleString('en-US')} 匹`; s3.textContent = `獎金 ${money(o.prize)} · ${ciLaps(i)} 圈`; }
    else { t.textContent = '？？？'; s2.textContent = unlocked(i - 1) ? `先贏${OPPS[i - 1].name}` : '還沒出現'; }
    b.append(t, s2, s3);
    b.addEventListener('click', () => { if (ciBusy) return; ciSel = i; list.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
    list.append(b);
    if (i === ciSel) requestAnimationFrame(() => b.scrollIntoView?.({ block: 'nearest' }));
  });
  go.addEventListener('click', () => ciStart(ciSel));
  out.addEventListener('click', () => ciMenuClose());
  row.append(go, out); el.append(h, p, list, row); stage.appendChild(el);
  ciMenuEl = el; ciMenuEl.goBtn = go;
}
function ciMenuClose(keep) {
  if (ciMenuEl) { ciMenuEl.remove(); ciMenuEl = null; }
  document.body.classList.remove('cimenu');
  if (!ciRace) document.body.classList.remove('ciracing');
  if (!keep && drv && !ciRace) drv.setInput(null);
}
// 開始：對手的車（輕量車）載好 → 放到起跑格 → 紅燈
async function ciStart(i) {
  if (ciBusy || !DRIVE.on || !drv || ciRace || !unlocked(i)) return;
  ciBusy = true; ciLv = i;
  if (ciMenuEl) { ciMenuEl.goBtn.disabled = true; ciMenuEl.goBtn.textContent = '準備中⋯'; }
  const d = drv, field = ciField(i);
  let cars;
  try {
    cars = await Promise.all(field.map(async (f) => {
      const k = LOD_CARS[f.o.key] ? f.o.key : LOD_CARS.gc8 ? 'gc8' : Object.keys(LOD_CARS)[0]; // 沒有這台的輕量車（試做頁沒打包 Yaris）：換一台、顏色照舊
      const sc = await LOD_CARS[k].load(), look = k === f.o.key ? oppLook(f.o) : { ...DEFAULT_LOOK[k], paint: oppLook(f.o).paint || DEFAULT_LOOK[k].paint };
      return { f, k, lod: buildLodCar(k, sc, look) };
    }));
  } catch (e) { console.error(e); cars = null; }
  ciBusy = false;
  if (!cars || drv !== d || !DRIVE.on || ciRace) {
    if (cars) for (const c of cars) c.lod.dispose();
    if (ciMenuEl) { ciMenuEl.goBtn.disabled = false; ciMenuEl.goBtn.textContent = '開始比賽'; }
    if (!cars && drv) drv.toast('對手的車沒載好，再按一次', 2000);
    return;
  }
  ciMenuClose(true);
  ciCars = cars;
  const o = OPPS[i];
  d.toast('', 0);
  ciRace = createCircuitRace({ world: VIL, scene: TR.scene, drive: d, laps: ciLaps(i), hudParent: stage, title: o.name, calm,
    opps: cars.map((c) => ({ name: c.f.o.name, obj: c.lod, perf: { ...PERF[c.k], hp: c.f.o.hp }, skill: { lat: c.f.pace, brk: c.f.pace + 0.08, react: 0.95 - c.f.pace * 0.75 } })),
    onFinish: (r) => {
      if (!r.won) return { lines: [`${o.name}贏了。轉彎前早一點煞車，或是去改車廠裝零件再來！`] };
      const first = !GAME.wins[o.id];
      GAME.money += o.prize; GAME.wins[o.id] = (GAME.wins[o.id] || 0) + 1; save(true); renderWallet(); GAR?.setTrophies(trophyCount());
      const nx = OPPS[i + 1];
      return { lines: [`獎金 +${money(o.prize)}`, first ? (nx ? `新對手出現了：${nx.name}（獎金 ${money(nx.prize)}）` : '你打敗大魔王了！所有對手都贏過了。') : `你現在有 NT$ ${money(GAME.money)}`] };
    },
    onDone: ({ again }) => {
      ciEnd();
      if (drv !== d || !DRIVE.on) return;
      if (again) ciStart(i);
      else setDest(canShop() ? 'shop' : canBuy() ? 'dealer' : 'garage');
    },
    onAbort: (why) => { if (drv === d) d.toast(why === 'left' ? '開出賽車場了：比賽取消' : '比賽取消了', 2000); setTimeout(ciEnd, 0); },
  });
  for (const c of cars) c.lod.car.visible = true;
  polRace(true); // 第 3 批（b3-int）：比賽中警察藏起來、不算犯罪
  document.body.classList.add('ciracing'); // 比賽中「去哪裡」那一排收起來（circuit.js 的樣式）
}
function ciEnd() {
  document.body.classList.remove('ciracing');
  if (ciRace) { ciRace.dispose(); ciRace = null; polRace(false); } // 第 3 批（b3-int）：警察回來
  for (const c of ciCars) { c.lod.car.removeFromParent(); c.lod.dispose(); }
  ciCars = [];
  if (ciDmgOff && drv && tripS?.dmg) drv.setDamage(tripS.dmg.perf); // 比完：撞壞的照撞壞的開
  ciDmgOff = false;
}
// 回車庫頁：比賽、選對手收掉
function ciLeave() { ciMenuClose(true); ciEnd(); }
