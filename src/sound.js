// ---- 引擎聲音：七台車各自的引擎聲，用 Web Audio 即時合成（沒有錄音檔）----
//
// 【API】
//   const audio = createEngineAudio({ volume: 0.9, muted: false });
//     建好也不會出聲：AudioContext 要等 resume() 才建（瀏覽器規定要有使用者手勢）
//   audio.resume()        在點擊／觸控的處理函式裡、任何 await 之前叫（例如「開始比賽」按鈕）：建立或喚醒 AudioContext、
//                         載入合成器。可以叫很多次，回傳 Promise<boolean>（true＝有聲音）
//   audio.setMuted(bool)  靜音；audio.muted 讀現在的狀態；audio.setVolume(0–1) 總音量；audio.mode：'worklet'｜'script'｜'off'
//   const v = audio.voice(key, { gain: 1, pan: 0, parts: [] })
//                         一台車一個聲音。key：gc8 yaris supra gtr p918 sp3 jesko（其他的用 supra）
//                         parts：裝了哪些引擎零件（車庫的 partsOf(key)）：exhaust、intake／filter、turbo、ecu、cams、
//                         header（GC8 等長頭段）、sc（SP3 機械增壓）、motorF／motorR／battery（918）會改變聲音
//                         同時最多兩個（你＋對手），第三個會把最舊的收掉；resume() 之前建也可以（有聲音以後才開始響）
//   v.set({ rpm, throttle, speed, limit })   每一幀叫（沒變的不用管，只送有變的）
//       rpm      轉速÷紅線 0–1.05（怠速約 0.1–0.14）
//       throttle 油門 0–1（放掉＝引擎煞車：渦輪車洩壓、會放炮的車啪啪響）
//       speed    車速 m/s（可省略；918 前輪電動馬達的聲音跟車速走）
//       limit    斷油轉速÷紅線（預設 1；起跑線上兩段式起步控制給 0.6，轉速頂在那裡「啪啪啪」）
//   v.shift()             升檔那一下：斷油、洩壓閥（渦輪車）、GT-R 的渦輪回流「嘟嘟嘟」、放炮、雙離合的「啵」
//   v.setGain(0–1)  v.setPan(−1–1)  v.dispose()（0.1 秒淡出）  v.alive
//   audio.crash({ strength, glass, pan })   撞車的聲音（damage.js 撞的時候叫）：strength 0–1（多大力：0.1 輕輕擦到、1 高速撞牆），
//                         glass 0–1（有沒有玻璃、燈碎掉：叮叮噹噹）、pan −1–1；金屬擠壓＋悶響、玻璃是合成的（resume() 之後在背景先算好，4 種大小＋玻璃）
//   audio.hiss(level)     水箱漏水的嘶嘶聲（0＝關、1 最大；車況很差的時候 damage.js 叫）
//   audio.skid(level, pitch, dirt)   第 3 批（甩尾）：輪胎叫（drive.js 照甩多少叫：level 0＝淡掉、1 最大；pitch 0–1 高一點低一點；dirt＝泥土、草地：沙沙聲）
//                         雜訊 → 兩個很窄的帶通「吱——」＋一點點顫動；只有一組節點，有變才送（drive.js 一秒最多 20 次）；跟引擎聲同一條總輸出（音量、靜音一樣）
//   audio.dispose()       全部收掉
//   audio.context、audio.input   第 2 批：AudioContext、總輸出的入口（別的聲音接到這裡就跟著音量、靜音；resume() 以前是 null）
//   const h = audio.lift({ gain: 1, max: 20 })   第 2 批：車庫升降機的馬達聲。「喀」開鎖 → 低低的電動馬達嗡嗡聲（一直響到 stop）
//                         h.stop(when)：「喀」落鎖、馬達聲淡掉（when＝AudioContext 的時間，不給＝現在）；h.alive；max 秒還沒 stop 就自己停
//                         跟引擎聲走同一條總輸出（音量、靜音一樣）；不算在「同時最多兩個」裡面
//   沒有聲音可用（舊瀏覽器、被擋、沒權限）時每個函式照樣能叫，只是不出聲；不會丟錯誤。
//
// 【接到賽道（race.src.js）】
//   最上面建一次：const engineAudio = createEngineAudio(); let snd = null;
//   startRace() 的第一行（點擊裡、await 之前）：engineAudio.resume();
//   startRace() 設好 race.me、race.opp 之後：
//     snd?.me.dispose(); snd?.op.dispose();
//     snd = { me: engineAudio.voice(race.me.key, { parts: partsOf(race.me.key) }),
//             op: engineAudio.voice(race.opp.key, { gain: 0.55, pan: -0.25 }) };
//   raceFrame() 裡 stepRacer 算完之後：
//     const feed = (v, c) => v.set({ rpm: c.rpm, speed: c.v, limit: c.go == null ? 0.6 : 1,                   // 起步控制
//       throttle: c.go == null ? (R.phase === 'stage' || R.phase === 'run' ? 1 : 0) : c.fin != null || c.shiftT > 0 ? 0 : 1 });
//     if (snd) { feed(snd.me, me); if (op) feed(snd.op, op); }
//   換檔：shift(c) 回傳不是 null 才是真的換了 → pressGo 裡 if (q) snd?.me.shift()；對手那行改成 if (shift(op)) snd?.op.shift()
//   exitRace()：snd?.me.dispose(); snd?.op.dispose(); snd = null;
//   靜音按鈕：engineAudio.setMuted(!engineAudio.muted)
//   打包：build-app.mjs、build-art.mjs 的檔案清單加上 'sound.js'（只有 export const／export function，其他名字都是 SND_ 開頭）
//
// 【怎麼做的】每一缸照點火順序、在正確的曲軸角度噴一個排氣脈衝（水平對臥四缸不等長頭段兩邊慢一點、聲音不一樣，
// 所以會「咕嚕咕嚕」；直三、直六、平面曲軸 V8、V12 各自的間隔），每次燃燒大小有一點隨機，
// 再經過頭段、排氣管（固定長度的管子＝固定的共鳴，轉速掃過去音色會變）、消音器、管口；
// 加上進氣聲、燃燒的沙沙聲、渦輪（增壓跟著油門和轉速慢慢建立，有遲滯）的哨音和進氣聲、洩壓閥、放炮、918 的馬達聲。
// 合成器在 AudioWorklet 裡跑（用 Blob 網址載入）；不能用的話改用 ScriptProcessor 跑同一份程式。
// 總輸出經過高通、壓縮器、軟削波，不會爆音。

// ---- 合成器本體：一台車一個（這個函式整個被轉成字串放進 AudioWorklet，裡面不能用到外面的東西）----
function SND_core(P, sr, seed) {
  const TAU = 6.283185307179586, K = 32, dtc = K / sr, isr = 1 / sr, OUT = 0.25;
  let rs = seed >>> 0 || 0x2545f491;
  const nz = () => { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return (rs | 0) * 4.656612873077393e-10; }; // −1..1（控制率用）
  const rnd = () => 0.5 + 0.5 * nz();
  const gs = () => nz() + nz() + nz(); // 約常態，標準差 1
  const cl = (x, a, b) => (x < a ? a : x > b ? b : x);
  const kc = (tau) => 1 - Math.exp(-dtc / tau); // 控制率（每 32 個取樣）的平滑係數
  const op = (hz) => 1 - Math.exp((-TAU * Math.min(hz, sr * 0.45)) / sr); // 一階低通係數
  // 二階濾波器：t＝0 低通、1 高通、2 帶通、3 峰值
  function sbq(o, t, f, q, db) {
    const w = (TAU * Math.min(f, sr * 0.45)) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2, a0 = 1 + al, a2 = 1 - al;
    const a1 = -2 * cs;
    if (t === 0) { b1 = 1 - cs; b0 = b2 = b1 / 2; }
    else if (t === 1) { b1 = -1 - cs; b0 = b2 = -b1 / 2; }
    else if (t === 2) { b0 = al; b1 = 0; b2 = -al; }
    else { const A = Math.pow(10, db / 40); b0 = 1 + al * A; b1 = a1; b2 = 1 - al * A; a0 = 1 + al / A; a2 = 1 - al / A; }
    o.b0 = b0 / a0; o.b1 = b1 / a0; o.b2 = b2 / a0; o.a1 = a1 / a0; o.a2 = a2 / a0;
    return o;
  }
  const bq = (t, f, q, db) => sbq({ b0: 1, b1: 0, b2: 0, a1: 0, a2: 0, z1: 0, z2: 0 }, t, f, q, db);
  // 管子：延遲 ms、回授（開口端反射是負的）、回授裡的低通（管壁吸掉高頻）
  const cb = (g) => { const D = Math.max(2, Math.round((g.ms * sr) / 1000)); return { b: new Float32Array(D), i: 0, D, fb: g.fb, c: op(g.lp), s: 0 }; };
  const dly = (ms) => ({ b: new Float32Array(Math.max(1, Math.round((ms * sr) / 1000))), i: 0 });

  // ---- 每一缸（照點火順序）----
  const N = P.fire.length, W = P.width, iW = 1 / W;
  const fire = new Float64Array(N), st = new Float64Array(N), amp = new Float64Array(N), rr = new Float64Array(N);
  const rI = new Float64Array(N), dI = new Float64Array(N), sh = new Float64Array(N), ca = new Float64Array(N);
  const bank = new Uint8Array(N), on = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    bank[i] = P.bank[i] ? 1 : 0; fire[i] = P.fire[i] + (bank[i] ? P.uel || 0 : 0); st[i] = fire[i];
    ca[i] = (P.cylAmp && P.cylAmp[i]) || 1; rr[i] = 0.3; rI[i] = 1 / 0.3; dI[i] = 1 / 0.7;
  }
  // ---- 排氣：頭段（一邊或兩邊）→ 集合 → 排氣管兩段 → 渦輪 → 消音器 → 管口 ----
  const G = P.grp, H0 = cb(G[0]), H1 = G[1] ? cb(G[1]) : null, D1 = G[1] && G[1].pre > 0 ? dly(G[1].pre) : null;
  const g0 = G[0].gain, uHi = P.uelHi ?? P.uel ?? 0, g1Lo = G[1] ? G[1].gain : 0, g1Hi = G[1] ? G[1].gainHi ?? G[1].gain : 0;
  let g1 = g1Lo;
  const P1 = cb(P.pipe[0]), P2 = P.pipe[1] ? cb(P.pipe[1]) : null;
  const mLP = bq(0, P.lp, 0.75), eq = (P.eq || []).map((e) => bq(3, e[0], e[1], e[2]));
  const Q0 = eq[0] || null, Q1 = eq[1] || null, Q2 = eq[2] || null;
  const hpC = op(P.hp), rHP = bq(1, P.raspHz, 0.7), drive = P.drive, exh = P.exh;
  const fhC = op(220), flC = op(P.flowLP); // 排氣流動噪音：高通＋低通
  // 進氣
  const I = P.intake, iBP1 = bq(2, I.f, I.q), iBP2 = bq(2, I.f2, I.q2), ihC = op(2500), iPh = N / 720, iTone = I.tone, iMix = I.mix2;
  // 渦輪、洩壓閥、回流（flutter）
  const T = P.turbo, tw = !!(T && T.n > 1), bvHiss = T ? T.hiss : 0;
  const wBP = bq(2, 3000, 5), whBP = bq(2, 1200, 0.7), bvBP = bq(2, 2500, 1.2), flBP = bq(2, 1100, 1.3), flLP = bq(0, 500, 0.8);
  // 放炮、馬達、機械增壓
  const PP = P.pops, pHP = bq(1, 1500, 0.7), M = P.motor, SC = P.sc;
  const MX = P.mix || {}, mxE = MX.exh ?? 1, mxI = MX.intake ?? 1, mxT = MX.turbo ?? 1, mxB = MX.bov ?? 1, mxM = MX.motor ?? 1, mxP = MX.pops ?? 1;
  const crackL = PP.crack * mxP;

  // ---- 每個取樣都會改的狀態放在 Float64Array：閉包裡的小數每寫一次就要配置記憶體（V8），慢十倍 ----
  const Z = new Float64Array(32), NB = new Float32Array(K * 8);
  const PH = 0, DP = 1, IP = 2, RH = 3, CX = 4, CY = 5, DX = 6, DY = 7, TD = 8, IH = 9, BS = 10, WC = 11, WS = 12, WC2 = 13, WS2 = 14;
  const MC = 15, MS = 16, RC = 17, RS = 18, SCC = 19, SCS = 20, PE = 21, BT = 22, BE = 23, FP = 24, FE = 25, FL = 26, FH = 27;
  Z[WC] = Z[WC2] = Z[MC] = Z[RC] = Z[SCC] = 1; Z[DP] = (6 * P.idle * P.red) / sr;
  let rq = (seed ^ 0x5bd1e995) | 0 || 1;
  // ---- 控制率的狀態 ----
  let tR = P.idle, tT = 0, tS = -1, tL = 1, tG = 1, dead = false, t = 0, ctlN = 0;
  let r1 = P.idle, r2 = P.idle, rn = P.idle, thr = 0, spd = 0, gE = 0, wn = 0, aw = 0, ddph = 0, ld = 0, fuelCut = false, cutT = 0, limOn = false, limP = 0;
  let aF = 0, aM = 0, vr = 0, rF = 0.3, sF = 0.3, jit = 0, raspA = 0, flowA = 0, iA = 0, hsA = 0, gI = 1;
  let sp = 0, bst = 0, wA = 0, wNz = 0, whA = 0, tdC = 1, wcw = 1, wsw = 0, wcw2 = 1, wsw2 = 0;
  let bvA = 0, bvK = 0, bvAt = -9, flA = 0, flT = 0, flK = 0, flInc = 0, pK = 0;
  let popSeq = 0, popRate = 0, thrPk = 0, liftArm = false, pqN = 0;
  const pq = new Float64Array(3 * 12); // 排好的放炮：[幾秒後, 大小, 長度]
  let mcw = 1, msw = 0, mA = 0, mrcw = 1, mrsw = 0, mrA = 0, sccw = 1, scsw = 0, scA = 0;
  const sm = P.smooth || 0.01, kR = kc(sm), kTu = kc(0.025), kTd = kc(0.04), kSp = kc(0.06), kG = kc(0.012), kWn = kc(0.3), kAw = kc(0.15);
  const kBu = kc(0.12), kBd = kc(0.045);

  function qpop(dt, lvl, dur) {
    if (pqN >= 12) return;
    pq[pqN * 3] = dt; pq[pqN * 3 + 1] = lvl; pq[pqN * 3 + 2] = dur; pqN++;
  }
  function pop(lvl, dur) { // 碰：一小段雜訊灌進排氣管，讓管子的共鳴決定聲音
    const a = lvl * 2 * (0.5 + 0.5 * Math.min(rn, 1));
    if (a > Z[PE]) { Z[PE] = a; pK = Math.exp(-isr / dur); }
  }
  function blow(b) { // 放油門：洩壓閥（大氣式「噗嘶」、回流式「呼」）或渦輪回流「嘟嘟嘟」
    if (!T || b < 0.06 || t - bvAt < 0.3) return;
    bvAt = t;
    if (T.bov === 'flutter') { flA = 1; Z[FE] = b * T.bovLvl; flT = 0; Z[FP] = 0; flK = Math.exp(-isr / T.bovDur); flInc = 20 * isr; }
    else { bvA = b * T.bovLvl; Z[BT] = 0; Z[BE] = 0; bvK = Math.exp(-isr / T.bovDur); sbq(bvBP, 2, T.bovF[0], T.bovQ); }
  }
  function doShift() {
    cutT = P.cut;
    blow(bst);
    if (PP.shift > 0 && rn > 0.45 && rnd() < PP.shift) {
      let n = 1 + ((rnd() * 2.2 * PP.shift) | 0);
      while (n-- > 0) qpop(0.008 + rnd() * (P.cut + 0.05), PP.lvl * (0.6 + 0.5 * rnd()), 0.0025);
    }
    if (P.dct && rn > 0.4) qpop(0.006, PP.burp, 0.009); // 雙離合升檔的「啵」
  }
  // 一缸開始排氣：這次有沒有燒、燒多大
  function ev(i) {
    let f = !(cutT > 0 || fuelCut);
    if (f && limOn && rnd() < limP) {
      f = false;
      if (PP.als > 0 && rnd() < PP.als * 0.3) qpop(0.004 + 0.012 * rnd(), PP.lvl * 0.7 * (0.5 + 0.5 * rnd()), 0.0025);
    }
    if (f) { amp[i] = aF * ca[i] * (1 + vr * gs()); rr[i] = rF; sh[i] = sF; }
    else {
      amp[i] = aM * ca[i] * (1 + 0.2 * gs()); rr[i] = 0.4; sh[i] = 0;
      if (cutT > 0 && PP.shift > 0 && rnd() < 0.1 * PP.shift) qpop(0.003 + 0.01 * rnd(), PP.lvl * 0.45 * (0.5 + rnd()), 0.002);
    }
    if (amp[i] < 0) amp[i] = 0;
    rI[i] = 1 / rr[i]; dI[i] = 1 / (1 - rr[i]);
  }
  // 控制率（每 32 個取樣）：平滑、負載、渦輪、放炮、濾波器
  function ctl() {
    t += dtc;
    gE += (tG - gE) * kG;
    if (tG < 0.5 && gE < 1e-4) dead = true;
    r1 += (tR - r1) * kR; r2 += (r1 - r2) * kR;
    thr += (tT - thr) * (tT > thr ? kTu : kTd);
    if (tS >= 0) spd += (tS - spd) * kSp;
    const idl = cl((0.26 - r2) * 10, 0, 1); // 1＝怠速附近
    wn += (1.7 * nz() - wn) * kWn;
    aw += (1.7 * nz() - aw) * kAw;
    rn = r2 * (1 + P.wob * idl * (0.6 * Math.sin(TAU * 0.83 * t) + 0.4 * wn)); // 怠速會游動一點
    ddph = ((6 * rn * P.red) / sr - Z[DP]) / K; // 每個取樣走幾度曲軸
    ld = Math.max(thr, 0.3 * cl((0.24 - rn) * 10, 0, 1)); // 怠速也要一點油
    if (uHi !== (P.uel || 0) || g1Hi !== g1Lo) { // 不等長頭段：怠速「咕嚕」最明顯，高轉重負載兩邊比較接近
      const k = cl((rn - 0.18) * 2, 0, 1) * (0.4 + 0.6 * ld), u = (P.uel || 0) + (uHi - (P.uel || 0)) * k;
      g1 = g1Lo + (g1Hi - g1Lo) * k;
      for (let i = 0; i < N; i++) if (bank[i]) fire[i] = P.fire[i] + u;
    }
    fuelCut = tT < 0.04 && thr < 0.08 && rn > 0.22; // 引擎煞車：斷油
    if (cutT > 0) cutT -= dtc;
    limOn = tT > 0.5 && rn >= tL - 0.004;
    limP = 0.15 + 0.75 * cl((rn - tL + 0.004) * 50, 0, 1);
    const aR = 0.28 + 0.72 * Math.min(rn, 1.05);
    aF = aR * (0.18 + 0.82 * Math.pow(ld, 0.7)) * (1 + P.wander * aw); aM = aR * 0.09;
    const shp = Math.max(ld, 0.6 * idl); // 怠速的排氣脈衝也滿尖的（汽缸裡還有壓力），聽得到「噗噗」
    rF = 0.32 + (P.rise - 0.32) * shp; sF = 0.1 + (P.decay - 0.1) * shp;
    gI = 1 + (P.idleGain - 1) * idl;
    vr = P.vari * (1 + 1.2 * idl); jit = P.jit * (1 + idl);
    raspA = P.rasp * (0.2 + 0.8 * ld) * (fuelCut ? 0.35 : 1);
    flowA = P.flow * (0.12 + 0.88 * ld) * (0.15 + 0.85 * Math.min(rn, 1)) * (fuelCut ? 0.5 : 1);
    iA = I.lvl * (0.12 + 0.88 * thr) * (0.25 + 0.75 * rn) * (fuelCut ? 0.6 : 1);
    hsA = I.hiss * (0.1 + 0.9 * thr) * rn;
    // 放油門
    thrPk = Math.max(thrPk - dtc * 2.5, tT);
    if (tT > 0.5) liftArm = true;
    else if (liftArm && tT < 0.15) {
      liftArm = false;
      if (thrPk > 0.45) { blow(bst); if (PP.lift > 0 && rn > 0.4) { popSeq = PP.dur; popRate = PP.rate * PP.lift; } }
    }
    if (popSeq > 0) {
      popSeq -= dtc;
      if (tT < 0.15 && rn > 0.3 && rnd() < popRate * dtc * Math.min(1, (2 * popSeq) / PP.dur)) pop(PP.lvl * (0.35 + 0.75 * rnd()), 0.0015 + 0.003 * rnd());
    }
    for (let q = 0; q < pqN;) {
      if ((pq[q * 3] -= dtc) <= 0) {
        pop(pq[q * 3 + 1], pq[q * 3 + 2]); pqN--;
        pq[q * 3] = pq[pqN * 3]; pq[q * 3 + 1] = pq[pqN * 3 + 1]; pq[q * 3 + 2] = pq[pqN * 3 + 2];
      } else q++;
    }
    // 渦輪：增壓跟著油門、轉速慢慢上來（遲滯），放油門慢慢轉慢；哨音高低跟著渦輪轉速（增壓×流量）
    if (T) {
      const u = cl((rn - T.on[0]) / (T.on[1] - T.on[0]), 0, 1), tg = tT > 0.1 ? u * u * (3 - 2 * u) * (0.2 + 0.8 * thr) : 0.03 * rn;
      sp += (tg - sp) * (tg > sp ? dtc / T.up : dtc / T.down);
      const pb = thr > 0.3 ? sp : 0;
      bst += (pb - bst) * (pb > bst ? kBu : kBd);
      const fw = T.w[0] + (T.w[1] - T.w[0]) * sp * (0.45 + 0.55 * Math.min(rn, 1)), w = (TAU * fw) / sr;
      wcw = Math.cos(w); wsw = Math.sin(w);
      let m = 1.5 - 0.5 * (Z[WC] * Z[WC] + Z[WS] * Z[WS]); Z[WC] *= m; Z[WS] *= m;
      if (tw) { wcw2 = Math.cos(w * 1.0065); wsw2 = Math.sin(w * 1.0065); m = 1.5 - 0.5 * (Z[WC2] * Z[WC2] + Z[WS2] * Z[WS2]); Z[WC2] *= m; Z[WS2] *= m; }
      const lv = sp * Math.sqrt(sp) * (0.25 + 0.75 * thr) * T.whistle;
      wA = 0.16 * lv; wNz = 1.1 * lv;
      sbq(wBP, 2, fw, 6);
      whA = T.whoosh * 0.9 * sp * (0.15 + 0.85 * thr) * (0.3 + 0.7 * rn);
      sbq(whBP, 2, 600 + 1700 * sp, 0.7);
      tdC = op(9000 * (1 - T.damp * (0.3 + 0.7 * bst)));
      if (bvA > 0) sbq(bvBP, 2, T.bovF[1] + (T.bovF[0] - T.bovF[1]) * Math.exp(-Z[BT] / 0.12), T.bovQ);
      if (flA > 0) { flT += dtc; flInc = (9 + 11 * Math.exp(-flT / 0.25)) * isr; }
    }
    if (M) { // 918：前馬達跟車速、後馬達（接在引擎上）跟轉速
      const v = tS >= 0 ? spd : 0, w = (TAU * (M.f0 + M.k * v)) / sr, w2 = (TAU * rn * P.red * M.order) / 60 / sr;
      mcw = Math.cos(w); msw = Math.sin(w);
      let m = 1.5 - 0.5 * (Z[MC] * Z[MC] + Z[MS] * Z[MS]); Z[MC] *= m; Z[MS] *= m;
      mA = M.lvl * cl(v / 3, 0, 1) * (thr > 0.1 ? 0.35 + 0.65 * thr : 0.3);
      mrcw = Math.cos(w2); mrsw = Math.sin(w2);
      m = 1.5 - 0.5 * (Z[RC] * Z[RC] + Z[RS] * Z[RS]); Z[RC] *= m; Z[RS] *= m;
      mrA = M.lvlR * thr * cl(rn * 3, 0, 1);
    }
    if (SC) { // 機械增壓器的齒輪聲
      const w = (TAU * rn * P.red * SC.order) / 60 / sr;
      sccw = Math.cos(w); scsw = Math.sin(w);
      const m = 1.5 - 0.5 * (Z[SCC] * Z[SCC] + Z[SCS] * Z[SCS]); Z[SCC] *= m; Z[SCS] *= m;
      scA = SC.lvl * rn * (0.3 + 0.7 * thr);
    }
  }

  // ---- 一段一段算（每段最多 32 個取樣）：每一級是一個緊湊的迴圈，狀態放區域變數，不在每個取樣呼叫函式 ----
  const A0 = new Float64Array(K), A1 = new Float64Array(K), E0 = new Float64Array(K), E1 = new Float64Array(K), PS = new Float64Array(K);
  const DPS = new Float64Array(K), C = new Float64Array(K), Y = new Float64Array(K), U = new Float64Array(K), V = new Float64Array(K);
  function bqb(o, x, y, m) { // 二階濾波器，一整段
    const b0 = o.b0, b1 = o.b1, b2 = o.b2, a1 = o.a1, a2 = o.a2;
    let z1 = o.z1, z2 = o.z2;
    for (let j = 0; j < m; j++) { const v = x[j], w = b0 * v + z1; z1 = b1 * v - a1 * w + z2; z2 = b2 * v - a2 * w; y[j] = w; }
    o.z1 = z1; o.z2 = z2;
  }
  function cbb(o, x, m) { // 管子（梳狀），一整段，就地
    const b = o.b, D = o.D, fb = o.fb, c = o.c;
    let i = o.i, s = o.s;
    for (let j = 0; j < m; j++) { s += c * (b[i] - s); const v = x[j] + fb * s; b[i] = v; x[j] = v; if (++i >= D) i = 0; }
    o.i = i; o.s = s;
  }
  function dlb(o, x, m) { // 純延遲，就地
    const b = o.b, D = b.length;
    let i = o.i;
    for (let j = 0; j < m; j++) { const v = b[i]; b[i] = x[j]; x[j] = v; if (++i >= D) i = 0; }
    o.i = i;
  }
  const clr = (o) => { o.z1 = o.z2 = 0; };
  function render(out, n) {
    let s = 0;
    while (s < n) {
      if (ctlN <= 0) { ctl(); ctlN = K; }
      const m = Math.min(ctlN, n - s);
      // 雜訊（xorshift），這一段先算好
      let q = rq;
      for (let j = 0, e = m * 8; j < e; j++) { q ^= q << 13; q ^= q >>> 17; q ^= q << 5; NB[j] = q * 4.656612873077393e-10; }
      rq = q;
      // 1. 排氣脈衝：每一缸在自己的點火角度開始，寬度照曲軸角度（轉越快越短）
      {
        let ph = Z[PH], dp = Z[DP];
        const dd = ddph, jt = jit;
        for (let j = 0; j < m; j++) {
          dp += dd; ph += dp; if (ph >= 720) ph -= 720;
          let a0 = 0, a1 = 0, e0 = 0, e1 = 0;
          for (let i = 0; i < N; i++) {
            let a = ph - st[i]; if (a < 0) a += 720;
            if (a < W) {
              if (on[i] === 0) { if (a > 45) continue; on[i] = 1; ev(i); }
              const x = a * iW, r = rr[i];
              let y;
              if (x < r) { const u = x * rI[i]; y = u * u * (3 - 2 * u); }
              else { const d = 1 - (x - r) * dI[i], d2 = d * d; y = d2 * (1 - sh[i] + sh[i] * d2); }
              const v = amp[i] * y;
              if (bank[i] === 0) { a0 += v; e0 += v * y; } else { a1 += v; e1 += v * y; }
            } else if (on[i] === 1) { on[i] = 0; st[i] = fire[i] + jt * NB[j * 8 + 7]; }
          }
          A0[j] = a0; A1[j] = a1; E0[j] = e0; E1[j] = e1; PS[j] = a0 + a1; DPS[j] = dp;
        }
        Z[PH] = ph; Z[DP] = dp;
      }
      // 2. 燃燒的沙沙聲（高通雜訊，跟著脈衝）
      for (let j = 0; j < m; j++) U[j] = NB[j * 8];
      bqb(rHP, U, U, m);
      { const ra = raspA; for (let j = 0; j < m; j++) { const r = U[j] * ra; A0[j] += r * E0[j]; A1[j] += r * E1[j]; } }
      // 3. 頭段
      cbb(H0, A0, m);
      if (H1) { if (D1) dlb(D1, A1, m); cbb(H1, A1, m); }
      // 4. 集合：兩邊加起來＋排氣流動的噪音＋放炮，去直流
      let pop1 = false;
      {
        let fh = Z[FH], fl = Z[FL], pe = Z[PE], cx = Z[CX], cy = Z[CY];
        const fa = flowA, pk = pK;
        for (let j = 0; j < m; j++) {
          let c = A0[j] * g0 + A1[j] * g1;
          const fx = NB[j * 8 + 1] * (0.25 + PS[j]) * fa;
          fh += fhC * (fx - fh); fl += flC * (fx - fh - fl); c += fl;
          if (pe > 1e-5) { const x = pe * (0.55 * NB[j * 8 + 2] + 0.45); pe *= pk; c += x * mxP; V[j] = x; pop1 = true; } else V[j] = 0;
          cy = c - cx + 0.997 * cy; cx = c; C[j] = cy;
        }
        Z[FH] = fh; Z[FL] = fl; Z[PE] = pe; Z[CX] = cx; Z[CY] = cy;
      }
      if (pop1) { bqb(pHP, V, V, m); for (let j = 0; j < m; j++) Y[j] = V[j] * crackL; }
      else { clr(pHP); for (let j = 0; j < m; j++) Y[j] = 0; }
      // 5. 排氣管、渦輪、消音器、共鳴、管口（高通）、失真
      cbb(P1, C, m); if (P2) cbb(P2, C, m);
      if (T) { let td = Z[TD]; const k = tdC; for (let j = 0; j < m; j++) { td += k * (C[j] - td); C[j] = td; } Z[TD] = td; }
      bqb(mLP, C, C, m);
      if (Q0) bqb(Q0, C, C, m);
      if (Q1) bqb(Q1, C, C, m);
      if (Q2) bqb(Q2, C, C, m);
      {
        let rh = Z[RH];
        for (let j = 0; j < m; j++) {
          const c = C[j]; rh += hpC * (c - rh);
          let x = (c - rh) * drive;
          x = x < -3 ? -1 : x > 3 ? 1 : (x * (27 + x * x)) / (27 + 9 * x * x);
          Y[j] += x * exh * mxE;
        }
        Z[RH] = rh;
      }
      // 6. 進氣：跟著每一缸吸氣起伏的雜訊＋一點點音調；嘶嘶聲
      {
        let ip = Z[IP];
        const ia = iA;
        for (let j = 0; j < m; j++) {
          ip += DPS[j] * iPh; if (ip >= 1) ip -= 1;
          const e = 4 * ip * (1 - ip), e2 = e * e, n2 = NB[j * 8 + 3];
          U[j] = n2 * (0.3 + 0.7 * e2) + iTone * (e - 0.667); V[j] = n2 * e2;
        }
        Z[IP] = ip;
        if (ia > 1e-5) {
          bqb(iBP1, U, U, m); bqb(iBP2, V, V, m);
          for (let j = 0; j < m; j++) Y[j] += (U[j] + iMix * V[j]) * ia * mxI;
        }
        if (hsA > 1e-5) {
          let ih = Z[IH];
          const ha = hsA;
          for (let j = 0; j < m; j++) { const n3 = NB[j * 8 + 4]; ih += ihC * (n3 - ih); Y[j] += (n3 - ih) * ha * mxI; }
          Z[IH] = ih;
        }
      }
      // 7. 渦輪：哨音（兩顆的話差一點點頻率）、進氣的呼呼聲、洩壓閥、回流
      if (T) {
        let wc = Z[WC], ws = Z[WS], wc2 = Z[WC2], ws2 = Z[WS2];
        const a = wcw, b = wsw, a2 = wcw2, b2 = wsw2, wa = wA * mxT;
        for (let j = 0; j < m; j++) {
          let x = wc * a - ws * b; ws = ws * a + wc * b; wc = x;
          let wv = ws;
          if (tw) { x = wc2 * a2 - ws2 * b2; ws2 = ws2 * a2 + wc2 * b2; wc2 = x; wv = 0.6 * (ws + 0.8 * ws2); }
          Y[j] += wv * wa;
          U[j] = NB[j * 8 + 5]; V[j] = NB[j * 8 + 6];
        }
        Z[WC] = wc; Z[WS] = ws; Z[WC2] = wc2; Z[WS2] = ws2;
        bqb(wBP, U, U, m); bqb(whBP, V, V, m);
        { const wz = wNz * mxT, wh = whA * mxT; for (let j = 0; j < m; j++) Y[j] += U[j] * wz + V[j] * wh; }
        if (bvA > 0) {
          for (let j = 0; j < m; j++) U[j] = NB[j * 8 + 7];
          bqb(bvBP, U, U, m);
          let bt = Z[BT], be = Z[BE], bs = Z[BS];
          const ba = bvA * mxB, k = bvK;
          for (let j = 0; j < m; j++) {
            bt += isr;
            if (bt < 0.005) be = ba * bt * 200; else be *= k;
            const n4 = NB[j * 8 + 7]; bs += 0.3 * (n4 - bs);
            Y[j] += (U[j] + bvHiss * (n4 - bs)) * be;
          }
          Z[BT] = bt; Z[BE] = be; Z[BS] = bs;
          if (bt > 0.005 && be < 1e-4) { bvA = 0; clr(bvBP); }
        }
        if (flA > 0) {
          for (let j = 0; j < m; j++) U[j] = NB[j * 8 + 4];
          bqb(flBP, U, V, m); bqb(flLP, U, U, m);
          let fp = Z[FP], fe = Z[FE];
          const inc = flInc, k = flK;
          for (let j = 0; j < m; j++) {
            fp += inc; if (fp >= 1) fp -= 1;
            let e = 0;
            if (fp < 0.06) e = fp / 0.06; else if (fp < 0.5) { e = 1 - (fp - 0.06) / 0.44; e *= e; }
            fe *= k;
            Y[j] += (V[j] + 0.9 * U[j]) * e * fe * mxB * 5;
          }
          Z[FP] = fp; Z[FE] = fe;
          if (fe < 1e-4) { flA = 0; clr(flBP); clr(flLP); }
        }
      }
      // 8. 918 的馬達、機械增壓
      if (mA > 1e-5) {
        let c = Z[MC], d = Z[MS];
        const a = mcw, b = msw, h2 = M.h2 * 2, h3 = M.h3, g = mA * mxM;
        for (let j = 0; j < m; j++) { const x = c * a - d * b; d = d * a + c * b; c = x; Y[j] += (d + h2 * d * c + h3 * d * (3 - 4 * d * d)) * g; }
        Z[MC] = c; Z[MS] = d;
      }
      if (mrA > 1e-5) {
        let c = Z[RC], d = Z[RS];
        const a = mrcw, b = mrsw, g = mrA * mxM;
        for (let j = 0; j < m; j++) { const x = c * a - d * b; d = d * a + c * b; c = x; Y[j] += d * g; }
        Z[RC] = c; Z[RS] = d;
      }
      if (scA > 1e-5) {
        let c = Z[SCC], d = Z[SCS];
        const a = sccw, b = scsw, g = scA * mxM;
        for (let j = 0; j < m; j++) { const x = c * a - d * b; d = d * a + c * b; c = x; Y[j] += (d + 0.6 * d * c) * g; }
        Z[SCC] = c; Z[SCS] = d;
      }
      // 9. 音量、去直流、輸出
      {
        let dx = Z[DX], dy = Z[DY];
        const g = gE * gI * P.gain * OUT;
        for (let j = 0; j < m; j++) { const y = Y[j] * g; dy = y - dx + 0.9985 * dy; dx = y; out[s + j] = dy; }
        Z[DX] = dx; Z[DY] = dy;
      }
      s += m; ctlN -= m;
    }
  }
  return {
    set(r, th, s, l, g) {
      if (r === r && r != null) tR = cl(r, 0, 1.2);
      if (th === th && th != null) tT = cl(th, 0, 1);
      if (s === s && s != null) tS = s < 0 ? -1 : Math.min(s, 150);
      if (l === l && l != null) tL = cl(l || 1, 0.2, 1.2);
      if (g === g && g != null) tG = g > 0.5 ? 1 : 0;
    },
    shift: doShift,
    render,
    dead: () => dead,
    info: () => ({ rpm: rn, throttle: thr, load: ld, spool: sp, boost: bst, cut: cutT > 0, pops: pqN }),
  };
}

// ---- 七台車 ----
// fire：點火角度（720 度一個循環，照點火順序）；bank：那一缸排到哪一邊的頭段；uel：不等長頭段那一邊晚幾度
// width：排氣脈衝多寬（曲軸角度）；rise／decay：全油門時脈衝多尖；vari：每次燃燒大小的隨機；jit：時間的隨機（度）
// grp：頭段（ms＝來回的延遲、fb＝反射、lp＝管壁吸掉的高頻、gain、pre＝多繞的管子晚到幾 ms）；pipe：排氣管兩段
// lp／eq／hp：消音器低通、共鳴峰 [Hz, Q, dB]、管口高通；drive：失真（顆粒感）；rasp：燃燒沙沙聲
// turbo：on＝增壓從幾轉開始到幾轉滿（轉速÷紅線）、up／down＝渦輪轉起來／轉慢的秒數、w＝哨音頻率範圍、bov＝洩壓閥種類
// pops：lift＝放油門放炮、shift＝換檔放炮、als＝撞斷油的時候放炮（起步控制「啪啪啪」）、burp＝雙離合升檔的「啵」
// gain：音量校正（七台車用 K 加權響度對齊，見 sound-analyze.mjs）
const SND_BASE = {
  idle: 0.12, width: 120, rise: 0.08, decay: 0.8, vari: 0.05, jit: 0.8, wob: 0.012, uel: 0, cylAmp: null,
  rasp: 0.3, raspHz: 2500, flow: 0.45, flowLP: 3500, wander: 0.05, drive: 1.4, exh: 1, gain: 1, idleGain: 1, hp: 110, lp: 4000, eq: [], cut: 0.1, dct: false, smooth: 0.01,
  intake: { lvl: 0.1, f: 450, q: 1.5, f2: 1500, q2: 2, mix2: 0.5, tone: 0.3, hiss: 0.04 },
  pops: { lift: 0, shift: 0, lvl: 0.8, rate: 10, dur: 1.0, als: 0, crack: 0.25, burp: 0.6 },
  turbo: null, motor: null, sc: null,
};
const SND_I6 = [0, 120, 240, 360, 480, 600], SND_V8 = [0, 90, 180, 270, 360, 450, 540, 630];
const SND_CARS = {
  gc8: {
    name: 'EJ20 水平對臥四缸渦輪', red: 8000, idle: 0.11, gain: 0.94, idleGain: 2.7,
    fire: [0, 180, 360, 540], bank: [0, 0, 1, 1], cylAmp: [1, 0.96, 1.02, 0.97], uel: 14, uelHi: 5,
    width: 165, rise: 0.09, decay: 0.75, vari: 0.07, jit: 1.2, wob: 0.016,
    grp: [{ ms: 1.3, fb: -0.45, lp: 4200, gain: 1, pre: 0 }, { ms: 2.5, fb: -0.5, lp: 2800, gain: 0.78, gainHi: 0.94, pre: 0.45 }],
    pipe: [{ ms: 10.2, fb: -0.35, lp: 2200 }, { ms: 6.0, fb: -0.25, lp: 3000 }],
    lp: 3000, eq: [[160, 1.1, 4], [640, 1.4, 3], [1700, 2, 2]], hp: 100, drive: 1.6, rasp: 0.28, raspHz: 2200,
    intake: { lvl: 0.1, f: 420, q: 1.6, f2: 1300 },
    turbo: { n: 1, on: [0.33, 0.6], up: 0.45, down: 1.2, w: [2100, 5600], whistle: 0.35, whoosh: 0.4, damp: 0.35, bov: 'atmo', bovLvl: 0.9, bovDur: 0.13, bovF: [3400, 1900], bovQ: 1.3, hiss: 0.5 },
    pops: { lift: 0.6, shift: 0.5, lvl: 0.9, rate: 9, dur: 0.9, als: 0.6, crack: 0.3 },
    cut: 0.12,
  },
  yaris: {
    name: 'G16E 1.6 直列三缸渦輪', red: 7000, idle: 0.13, gain: 1.26, idleGain: 3.05,
    fire: [0, 240, 480], bank: [0, 0, 0], cylAmp: [1, 0.93, 0.97],
    width: 175, rise: 0.08, decay: 0.8, vari: 0.07, jit: 1.2, wob: 0.015,
    grp: [{ ms: 1.1, fb: -0.42, lp: 4000, gain: 1 }],
    pipe: [{ ms: 11.4, fb: -0.35, lp: 2200 }, { ms: 7.1, fb: -0.28, lp: 3000 }],
    lp: 3400, eq: [[230, 1.2, 3], [900, 1.5, 3.5], [2300, 2, 2]], hp: 110, drive: 1.7, rasp: 0.32, raspHz: 2400,
    intake: { lvl: 0.1, f: 480, q: 1.5, f2: 1500 },
    turbo: { n: 1, on: [0.28, 0.5], up: 0.35, down: 1.0, w: [2600, 6800], whistle: 0.25, whoosh: 0.45, damp: 0.3, bov: 'recirc', bovLvl: 0.45, bovDur: 0.12, bovF: [1900, 1100], bovQ: 0.9, hiss: 0.2 },
    pops: { lift: 0.55, shift: 0.35, lvl: 0.7, rate: 16, dur: 0.9, crack: 0.35 },
    cut: 0.12,
  },
  supra: {
    name: '2JZ 直列六缸單顆大渦輪', red: 7200, idle: 0.12, gain: 0.92, idleGain: 1.75,
    fire: SND_I6, bank: [0, 1, 0, 1, 0, 1], cylAmp: [1, 0.99, 1, 0.985, 0.995, 1],
    width: 135, rise: 0.1, decay: 0.7, vari: 0.045, jit: 0.7, wob: 0.01,
    grp: [{ ms: 2.0, fb: -0.4, lp: 3500, gain: 1 }, { ms: 2.15, fb: -0.4, lp: 3300, gain: 0.96 }],
    pipe: [{ ms: 13.2, fb: -0.42, lp: 1600 }, { ms: 8.3, fb: -0.3, lp: 2200 }],
    lp: 2400, eq: [[120, 1, 5], [480, 1.3, 3], [1400, 2, 1.5]], hp: 80, drive: 1.3, rasp: 0.18, raspHz: 2000,
    intake: { lvl: 0.08 },
    turbo: { n: 1, on: [0.45, 0.78], up: 0.85, down: 1.8, w: [1400, 4200], whistle: 0.9, whoosh: 0.55, damp: 0.3, bov: 'atmo', bovLvl: 1.3, bovDur: 0.2, bovF: [2600, 1300], bovQ: 1.1, hiss: 0.6 },
    pops: { lift: 0.2, shift: 0.1, lvl: 0.6, rate: 5 },
    cut: 0.14,
  },
  gtr: {
    name: 'RB26 直列六缸雙渦輪', red: 8000, idle: 0.12, gain: 0.98, idleGain: 2.1,
    fire: SND_I6, bank: [0, 1, 0, 1, 0, 1], cylAmp: [1, 0.985, 1, 0.99, 0.99, 1],
    width: 118, rise: 0.07, decay: 0.85, vari: 0.05, jit: 0.7, wob: 0.01,
    grp: [{ ms: 1.6, fb: -0.42, lp: 4500, gain: 1 }, { ms: 1.75, fb: -0.42, lp: 4300, gain: 0.9 }],
    pipe: [{ ms: 11.0, fb: -0.33, lp: 2600 }, { ms: 5.4, fb: -0.25, lp: 3500 }],
    lp: 4200, eq: [[260, 1.2, 2], [1500, 1.6, 4], [3200, 2, 2]], hp: 110, drive: 1.5, rasp: 0.35, raspHz: 2800,
    intake: { lvl: 0.09 },
    turbo: { n: 2, on: [0.36, 0.62], up: 0.5, down: 1.3, w: [2300, 6200], whistle: 0.4, whoosh: 0.4, damp: 0.3, bov: 'flutter', bovLvl: 1.0, bovDur: 0.3, hiss: 0.3 },
    pops: { lift: 0.25, shift: 0.2, lvl: 0.6, rate: 7 },
    cut: 0.12,
  },
  p918: {
    name: '4.6 V8 平面曲軸＋兩顆電動馬達', red: 9150, idle: 0.11, gain: 1.17, idleGain: 1.16,
    fire: SND_V8, bank: [0, 1, 0, 1, 0, 1, 0, 1],
    width: 92, rise: 0.06, decay: 0.9, vari: 0.04, jit: 0.5, wob: 0.008,
    grp: [{ ms: 1.7, fb: -0.45, lp: 5500, gain: 1 }, { ms: 1.82, fb: -0.45, lp: 5300, gain: 0.93 }],
    pipe: [{ ms: 3.4, fb: -0.3, lp: 5000 }, { ms: 2.3, fb: -0.25, lp: 6000 }],
    lp: 7500, eq: [[700, 1.2, 2], [1900, 1.5, 4], [4200, 2, 3]], hp: 140, drive: 1.4, rasp: 0.5, raspHz: 3000,
    intake: { lvl: 0.35, f: 520, q: 1.4, f2: 2100, mix2: 0.6, tone: 0.4, hiss: 0.12 },
    motor: { f0: 40, k: 55, lvl: 0.12, h2: 0.35, h3: 0.15, order: 12, lvlR: 0.05 },
    pops: { lift: 0.35, shift: 0.3, lvl: 0.6, rate: 20, dur: 0.8, crack: 0.35, burp: 0.55 },
    cut: 0.06, dct: true,
  },
  sp3: {
    name: '6.5 V12 自然進氣', red: 9500, idle: 0.1, gain: 1.08, idleGain: 1.43,
    fire: [0, 62.5, 120, 182.5, 240, 302.5, 360, 422.5, 480, 542.5, 600, 662.5], bank: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    width: 86, rise: 0.07, decay: 0.85, vari: 0.035, jit: 0.4, wob: 0.006,
    grp: [{ ms: 2.3, fb: -0.4, lp: 6000, gain: 1 }, { ms: 2.42, fb: -0.4, lp: 5800, gain: 0.95 }],
    pipe: [{ ms: 8.8, fb: -0.3, lp: 4000 }, { ms: 4.7, fb: -0.22, lp: 5000 }],
    lp: 8000, eq: [[850, 1.2, 2], [2400, 1.4, 5], [5200, 2, 2]], hp: 150, drive: 1.3, rasp: 0.3, raspHz: 3500,
    intake: { lvl: 0.45, f: 600, q: 1.3, f2: 2400, mix2: 0.6, tone: 0.5, hiss: 0.15 },
    pops: { lift: 0.4, shift: 0.3, lvl: 0.55, rate: 24, dur: 0.9, crack: 0.4, burp: 0.5 },
    cut: 0.05, dct: true,
  },
  jesko: {
    name: '5.0 V8 平面曲軸雙渦輪', red: 8500, idle: 0.11, gain: 0.99, idleGain: 1,
    fire: SND_V8, bank: [0, 1, 0, 1, 0, 1, 0, 1],
    width: 98, rise: 0.06, decay: 0.9, vari: 0.05, jit: 0.6, wob: 0.01,
    grp: [{ ms: 2.0, fb: -0.45, lp: 4500, gain: 1 }, { ms: 2.15, fb: -0.45, lp: 4300, gain: 0.88 }],
    pipe: [{ ms: 8.2, fb: -0.35, lp: 2500 }, { ms: 5.0, fb: -0.28, lp: 3200 }],
    lp: 4800, eq: [[200, 1.1, 3], [1100, 1.4, 4], [2600, 1.8, 3]], hp: 100, drive: 1.8, rasp: 0.55, raspHz: 2400,
    intake: { lvl: 0.12 },
    turbo: { n: 2, on: [0.35, 0.6], up: 0.55, down: 1.5, w: [1800, 5200], whistle: 0.35, whoosh: 0.8, damp: 0.35, bov: 'recirc', bovLvl: 1.0, bovDur: 0.16, bovF: [1800, 900], bovQ: 0.8, hiss: 0.35 },
    pops: { lift: 0.5, shift: 0.8, lvl: 1.1, rate: 8, dur: 0.8, als: 0.3, crack: 0.3, burp: 0.9 },
    cut: 0.06, dct: true,
  },
};
// 車庫的引擎零件會改變聲音
function SND_profile(key, parts) {
  const B = SND_CARS[key] || SND_CARS.supra;
  const P = JSON.parse(JSON.stringify({ ...SND_BASE, ...B, intake: { ...SND_BASE.intake, ...B.intake }, pops: { ...SND_BASE.pops, ...B.pops } }));
  const has = (id) => Array.isArray(parts) && parts.includes(id);
  if (has('exhaust')) { P.lp *= 1.3; P.gain *= 1.19; P.rasp *= 1.25; P.drive *= 1.1; P.pops.lift += 0.2; } // 大口徑排氣：大聲、亮
  if (has('intake') || has('filter')) { P.intake.lvl *= 1.6; P.intake.hiss *= 1.5; if (P.turbo) { P.turbo.whoosh *= 1.3; P.turbo.whistle *= 1.15; } }
  if (has('ecu')) { P.pops.lift += 0.3; P.pops.shift += 0.3; P.pops.als += 0.3; } // 調過的電腦：放炮
  if (has('cams')) { P.vari *= 1.4; P.wob *= 2; P.rasp *= 1.1; } // 高角度凸輪軸：怠速抖
  if (has('header') && P.uel) { P.uel = 0; P.uelHi = 0; P.grp[1] = { ...P.grp[0] }; P.cylAmp = null; } // 等長頭段：咕嚕聲變順
  if (has('turbo')) {
    if (P.turbo) { // 大渦輪：哨音低一點、大聲、比較晚才來
      const T = P.turbo;
      T.w = T.w.map((f) => f * 0.82); T.whistle *= 1.35; T.whoosh *= 1.3; T.up *= 1.35; T.on = T.on.map((x) => Math.min(0.9, x + 0.05)); T.bovLvl *= 1.25; T.bovDur *= 1.2;
    } else P.turbo = { n: 2, on: [0.4, 0.66], up: 0.6, down: 1.4, w: [2000, 5600], whistle: 0.5, whoosh: 0.55, damp: 0.3, bov: 'atmo', bovLvl: 0.8, bovDur: 0.14, bovF: [3000, 1600], bovQ: 1.2, hiss: 0.4 };
  }
  if (has('sc')) P.sc = { order: 16, lvl: 0.12 }; // SP3 加機械增壓
  if (P.motor) P.motor.lvl *= 1 + 0.25 * ['motorF', 'motorR', 'battery'].filter(has).length;
  return P;
}

// ---- AudioWorklet（用 Blob 網址載入；同一個 AudioContext 只載一次，名字帶雜湊，不同版本不會打架）----
const SND_PARAMS = [['rpm', 0.12, 0, 1.2], ['throttle', 0, 0, 1], ['speed', -1, -1, 200], ['limit', 1, 0.2, 1.2], ['shift', 0, 0, 1e9], ['gate', 1, 0, 1]];
let SND_src = null, SND_name = '';
function SND_worklet() {
  if (SND_src) return SND_src;
  const desc = SND_PARAMS.map(([name, defaultValue, minValue, maxValue]) => ({ name, defaultValue, minValue, maxValue, automationRate: 'k-rate' }));
  const body = `const SND_core = ${SND_core.toString()};
class SND_Proc extends AudioWorkletProcessor {
  static get parameterDescriptors() { return ${JSON.stringify(desc)}; }
  constructor(o) { super(); const q = (o && o.processorOptions) || {}; this.c = SND_core(q.P, sampleRate, q.seed); this.n = 0; }
  process(inputs, outputs, p) {
    const c = this.c, o = outputs[0];
    try {
      c.set(p.rpm[0], p.throttle[0], p.speed[0], p.limit[0], p.gate[0]);
      const s = p.shift[0]; if (s !== this.n) { this.n = s; c.shift(); }
      if (o && o[0]) { c.render(o[0], o[0].length); for (let k = 1; k < o.length; k++) o[k].set(o[0]); }
    } catch (e) { return false; }
    return !c.dead();
  }
}`;
  let h = 5381;
  for (let i = 0; i < body.length; i++) h = ((h * 33) ^ body.charCodeAt(i)) >>> 0;
  SND_name = 'carid-engine-' + h.toString(36);
  SND_src = `${body}\ntry { registerProcessor('${SND_name}', SND_Proc); } catch (e) { /* 已經登記過 */ }\n`;
  return SND_src;
}
function SND_load(ctx) {
  const src = SND_worklet(), k = Symbol.for('carid.engine.' + SND_name);
  if (!ctx[k]) {
    ctx[k] = new Promise((res, rej) => {
      let url = null;
      const to = setTimeout(() => rej(new Error('worklet timeout')), 5000);
      const done = (e) => { clearTimeout(to); try { if (url) URL.revokeObjectURL(url); } catch { /* 算了 */ } if (e) rej(e); else res(); };
      try {
        url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        ctx.audioWorklet.addModule(url).then(() => done(), (e) => done(e || new Error('addModule')));
      } catch (e) { done(e); }
    });
  }
  return ctx[k];
}
// 軟削波：|x|≤0.8 完全不動，再上去慢慢壓到 0.98（前面先 ×0.5，所以 ±2 都還是軟的）
function SND_curve() {
  const n = 4096, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = ((i / (n - 1)) * 2 - 1) * 2, a = Math.abs(v);
    c[i] = Math.sign(v) * (a <= 0.8 ? a : 0.8 + 0.18 * Math.tanh((a - 0.8) / 0.18));
  }
  return c;
}

// ---- 給頁面用的 ----
// ---- 撞車聲：悶響（低頻、音高往下掉）＋金屬擠壓（雜訊＋一串喀啦喀啦，經過幾個金屬共振）＋玻璃（很多短短的高音叮＋碎裂的沙沙聲）----
// 回傳 Float32Array（單聲道、峰值 0.9 以內）；seed 固定就一樣；parts：1＝悶響＋金屬、2＝玻璃、3＝全部
// 全部用遞迴（衰減乘上去、共振器兩個乘法），一秒的聲音算幾毫秒
function SND_crash(sr, strength, glass, seed, parts = 3) {
  const k = Math.max(0.05, Math.min(1, strength)), gl = parts & 2 ? Math.max(0, Math.min(1, glass)) : 0, metal = !!(parts & 1);
  const len = Math.floor(sr * ((metal ? 0.45 + 0.9 * k : 0.2) + 0.35 * gl)), out = new Float32Array(len);
  let rs = seed >>> 0 || 0x9e3779b9;
  const rnd = () => { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return (rs >>> 0) / 4294967296; };
  const TAU = 6.283185307179586;
  if (metal) {
    // 悶響：55–90 Hz，音高往下掉
    const f0 = 55 + 35 * (1 - k) + 10 * rnd(), td = 0.12 + 0.13 * k, n0 = Math.min(len, Math.floor(sr * 0.7)), dk = Math.exp(-1 / (sr * td)), dp = Math.exp(-1 / (sr * 0.03)), amp = 0.55 + 0.45 * k;
    let ph = 0, env = 1, pe = 0.8;
    for (let i = 0; i < n0; i++) { ph += (TAU * f0 * (1 + pe)) / sr; pe *= dp; out[i] += Math.sin(ph) * env * amp * Math.min(1, i / (sr * 0.002)); env *= dk; }
    // 金屬：激發（開頭一陣雜訊＋越來越稀的喀啦）→ 幾個共振（二階帶通）＋一點直接的雜訊
    const ex = new Float32Array(len), T = 0.12 + 0.35 * k, n1 = Math.min(len, Math.floor(sr * 0.012));
    for (let i = 0; i < n1; i++) ex[i] += (rnd() * 2 - 1) * (1 - i / n1);
    for (let t = 0.004; t < T; t += 0.004 + 0.03 * rnd() * (t / T + 0.2)) {
      const i0 = Math.floor(t * sr), a = (0.3 + 0.7 * rnd()) * (1 - t / T), n = Math.floor(sr * (0.0008 + 0.002 * rnd()));
      for (let j = 0; j < n && i0 + j < len; j++) ex[i0 + j] += (rnd() * 2 - 1) * a * (1 - j / n);
    }
    const modes = 4 + Math.round(3 * k), mix = new Float32Array(len);
    for (let m = 0; m < modes; m++) {
      const f = 180 * Math.pow(2, 4.2 * rnd()), q = 8 + 20 * rnd(), w = (TAU * f) / sr, al = Math.sin(w) / (2 * q), cs = Math.cos(w), a0 = 1 + al;
      const b0 = al / a0, b2 = -al / a0, a1 = (-2 * cs) / a0, a2 = (1 - al) / a0, g = ((0.5 + rnd()) / modes) * 6;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < len; i++) { const x = ex[i], y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; mix[i] += y * g; }
    }
    let lp = 0;
    const mk = 0.35 + 0.65 * k;
    for (let i = 0; i < len; i++) { lp += 0.35 * (ex[i] - lp); out[i] += (mix[i] + lp * 0.5) * mk; }
  }
  // 玻璃：碎裂的沙沙（高通雜訊）＋一顆一顆的叮（2.5–7.5 kHz，15–80 ms 就沒了；有的是掉在地上的）
  if (gl > 0) {
    let hp = 0, pv = 0;
    const ns = Math.min(len, Math.floor(sr * (0.05 + 0.1 * gl)));
    for (let i = 0; i < ns; i++) { const x = rnd() * 2 - 1; hp = 0.7 * (hp + x - pv); pv = x; out[i] += hp * 0.5 * gl * (1 - i / ns); }
    const pings = Math.round(20 + 50 * gl);
    for (let p = 0; p < pings; p++) {
      const t0 = 0.01 + Math.pow(rnd(), 1.6) * (0.25 + 0.5 * gl), i0 = Math.floor(t0 * sr), f = 2500 + 5000 * rnd(), dcy = 0.015 + 0.065 * rnd(), a = (0.05 + 0.16 * rnd()) * gl, n = Math.floor(sr * dcy * 4);
      const r = Math.exp(-1 / (sr * dcy)), w = (TAU * f) / sr, c2 = 2 * r * Math.cos(w), r2 = r * r; // 衰減的共振器：y[n]＝2r·cos(w)·y[n−1]−r²·y[n−2]
      let y1 = a * r * Math.sin(w), y2 = 0;
      if (i0 + 1 < len) out[i0 + 1] += y1;
      for (let j = 2; j < n && i0 + j < len; j++) { const y = c2 * y1 - r2 * y2; y2 = y1; y1 = y; out[i0 + j] += y; }
    }
  }
  let pk = 0;
  for (let i = 0; i < len; i++) { const v = out[i] < 0 ? -out[i] : out[i]; if (v > pk) pk = v; }
  const g = pk > 0 ? (0.9 * (metal ? 0.45 + 0.55 * k : 0.7)) / pk : 0, fade = Math.floor(sr * 0.03);
  for (let i = 0; i < len; i++) out[i] *= g * (i > len - fade ? (len - i) / fade : 1);
  return out;
}

export const ENGINE_CARS = Object.fromEntries(Object.entries(SND_CARS).map(([k, c]) => [k, { name: c.name, red: c.red, cyl: c.fire.length, idle: c.idle, turbo: !!c.turbo }]));

export function createEngineAudio(opt = {}) {
  const num = (x, d) => (typeof x === 'number' && isFinite(x) ? x : d);
  const S = { ctx: null, rec: null, inp: null, nodes: [], mode: 'off', vol: num(opt.volume, 0.9), muted: !!opt.muted, voices: [], ready: null, gone: false, warned: false, idleT: 0 };
  const maxV = Math.max(1, num(opt.maxVoices, 2));
  const warn = (e) => { if (!S.warned) { S.warned = true; try { console.warn('[engine audio]', (e && e.message) || e); } catch { /* 算了 */ } } };
  const REC = Symbol.for('carid.engineAudio.shared');

  function ensureCtx() {
    if (S.ctx || S.gone) return S.ctx;
    let ctx = opt.context || null;
    if (!ctx) {
      // 同一頁載入好幾次（或好幾個 createEngineAudio）也只用一個 AudioContext；rec.n＝全部還在響的聲音數
      const g = globalThis, rec = g[REC] || (g[REC] = { ctx: null, hid: false, n: 0 });
      if (typeof rec.n !== 'number') rec.n = 0;
      S.rec = rec;
      if (rec.ctx && rec.ctx.state !== 'closed') ctx = rec.ctx;
      else {
        const AC = g.AudioContext || g.webkitAudioContext;
        if (!AC) return null;
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
        rec.ctx = ctx; rec.n = 0;
        // 切到背景就暫停，回來再繼續（手機省電，也不會在背景一直響）
        try {
          document.addEventListener('visibilitychange', () => {
            try {
              if (document.hidden) { if (rec.ctx.state === 'running') { rec.hid = true; rec.ctx.suspend(); } }
              else if (rec.hid) { rec.hid = false; rec.ctx.resume(); }
            } catch { /* 算了 */ }
          });
        } catch { /* 沒有 document */ }
      }
    }
    // 總輸出：音量／靜音 → 高通 → 壓縮器 → 軟削波
    const inp = ctx.createGain(), hp = ctx.createBiquadFilter(), comp = ctx.createDynamicsCompressor(), pre = ctx.createGain(), ws = ctx.createWaveShaper();
    inp.gain.value = S.muted ? 0 : S.vol;
    hp.type = 'highpass'; hp.frequency.value = 28; hp.Q.value = 0.6;
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.2;
    pre.gain.value = 0.5; ws.curve = SND_curve(); ws.oversample = 'none';
    inp.connect(hp); hp.connect(comp); comp.connect(pre); pre.connect(ws); ws.connect(opt.output || ctx.destination);
    S.ctx = ctx; S.inp = inp; S.nodes = [inp, hp, comp, pre, ws];
    if (S.rec) for (const v of S.voices) if (!v.live) { v.live = true; S.rec.n++; } // resume() 之前就建好的聲音
    return ctx;
  }
  async function init() {
    const ctx = S.ctx;
    let mode = 'off';
    if (opt.worklet !== false && ctx.audioWorklet && typeof AudioWorkletNode === 'function') {
      try { await SND_load(ctx); mode = 'worklet'; } catch (e) { warn(e); }
    }
    if (mode === 'off' && opt.script !== false && typeof ctx.createScriptProcessor === 'function') mode = 'script';
    S.mode = mode;
    for (const v of S.voices) if (!v.src) build(v);
    return mode !== 'off';
  }
  function build(v) {
    if (S.gone || v.dead || v.src || !S.ctx) return;
    const ctx = S.ctx;
    try {
      let src = null;
      const seed = (Math.random() * 4294967296) >>> 0;
      if (S.mode === 'worklet') {
        try {
          src = new AudioWorkletNode(ctx, SND_name, { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { P: v.P, seed } });
          v.prm = {};
          for (const [n] of SND_PARAMS) v.prm[n] = src.parameters.get(n);
          src.onprocessorerror = () => warn('processor error');
        } catch (e) { warn(e); src = null; v.prm = null; if (opt.script !== false && typeof ctx.createScriptProcessor === 'function') S.mode = 'script'; }
      }
      if (!src && S.mode === 'script') {
        const core = SND_core({ ...v.P, smooth: 0.035 }, ctx.sampleRate, seed);
        src = ctx.createScriptProcessor(4096, 1, 1);
        src.onaudioprocess = (e) => {
          const b = e.outputBuffer, d = b.getChannelData(0);
          try { core.render(d, d.length); } catch { d.fill(0); }
          for (let k = 1; k < b.numberOfChannels; k++) b.getChannelData(k).set(d);
        };
        v.core = core;
      }
      if (!src) return;
      v.src = src; v.g = ctx.createGain(); v.g.gain.value = v.gain;
      try { v.pn = ctx.createStereoPanner(); v.pn.pan.value = v.pan; } catch { v.pn = null; }
      src.connect(v.g);
      if (v.pn) { v.g.connect(v.pn); v.pn.connect(S.inp); } else v.g.connect(S.inp);
      v.sent = {}; push(v);
    } catch (e) { warn(e); }
  }
  // 把最新的狀態送給合成器
  function push(v) {
    const s = v.st;
    if (v.prm) {
      for (const n of ['rpm', 'throttle', 'speed', 'limit']) if (v.sent[n] !== s[n]) { v.sent[n] = s[n]; v.prm[n].value = s[n]; }
    } else if (v.core) v.core.set(s.rpm, s.throttle, s.speed, s.limit, 1);
  }
  // 收掉一個聲音：先淡出（合成器自己 0.1 秒內收到 0），再拔線
  function kill(v) {
    if (v.dead) return;
    v.dead = true;
    S.voices = S.voices.filter((x) => x !== v);
    if (S.rec && v.live) { v.live = false; S.rec.n = Math.max(0, S.rec.n - 1); }
    try {
      if (v.prm) v.prm.gate.value = 0; else if (v.core) v.core.set(NaN, NaN, NaN, NaN, 0);
      const src = v.src, nodes = [v.src, v.g, v.pn].filter(Boolean);
      const off = () => { try { if (v.core && src) src.onaudioprocess = null; } catch { /* 算了 */ } nodes.forEach((n) => { try { n.disconnect(); } catch { /* 算了 */ } }); };
      if (!src) off(); else setTimeout(off, v.core ? 450 : 200); // ScriptProcessor 有兩格（約 0.2 秒）的延遲
    } catch (e) { warn(e); }
    idleCheck();
  }
  // 沒有聲音在用就讓 AudioContext 睡覺（共用的那個才管；同一頁別的 createEngineAudio 還在響就不睡）
  function idleCheck() {
    clearTimeout(S.idleT);
    const rec = S.rec;
    if (opt.context || !S.ctx || !rec || rec.n > 0) return;
    S.idleT = setTimeout(() => { try { if (rec.n <= 0 && rec.ctx === S.ctx && S.ctx.state === 'running') S.ctx.suspend(); } catch { /* 算了 */ } }, 2500);
  }
  function wake() {
    try { if (!opt.context && S.ctx && S.ctx.state === 'suspended' && !(typeof document !== 'undefined' && document.hidden)) S.ctx.resume().catch(() => {}); } catch { /* 算了 */ }
  }
  function resume() {
    try {
      if (S.gone) return Promise.resolve(false);
      const ctx = ensureCtx();
      if (!ctx) return Promise.resolve(false);
      crashPrerender(); // 撞車聲先在背景算好
      let r = Promise.resolve();
      const offline = typeof OfflineAudioContext === 'function' && ctx instanceof OfflineAudioContext;
      if (!offline && ctx.state !== 'running') {
        try { // iOS：在手勢裡放一小段靜音才解鎖
          const b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource();
          s.buffer = b; s.connect(ctx.destination); s.start(0);
        } catch { /* 算了 */ }
        try { r = ctx.resume() || r; } catch (e) { warn(e); }
      }
      if (!S.ready) S.ready = init().catch((e) => { warn(e); return false; });
      return Promise.all([Promise.resolve(r).catch(() => {}), S.ready]).then(([, ok]) => !!ok && (offline || ctx.state === 'running'), () => false);
    } catch (e) { warn(e); return Promise.resolve(false); }
  }
  function voice(key, o = {}) {
    let P;
    try { P = SND_profile(key, o && o.parts); } catch (e) { warn(e); P = SND_profile('supra', []); }
    const v = { key, P, gain: num(o && o.gain, 1), pan: num(o && o.pan, 0), st: null, src: null, g: null, pn: null, prm: null, core: null, dead: false, live: false, sh: 0 };
    v.st = { rpm: v.P.idle, throttle: 0, speed: -1, limit: 1 };
    const api = {
      key,
      set(s) {
        try {
          if (v.dead || !s) return;
          const st = v.st;
          if (typeof s.rpm === 'number' && isFinite(s.rpm)) st.rpm = Math.max(0, Math.min(1.2, s.rpm));
          if (typeof s.throttle === 'number' && isFinite(s.throttle)) st.throttle = Math.max(0, Math.min(1, s.throttle));
          if (typeof s.speed === 'number' && isFinite(s.speed)) st.speed = Math.max(-1, Math.min(200, s.speed));
          if (typeof s.limit === 'number' && isFinite(s.limit)) st.limit = Math.max(0.2, Math.min(1.2, s.limit));
          if (v.src) push(v);
        } catch (e) { warn(e); }
      },
      shift() {
        try {
          if (v.dead) return;
          v.sh++;
          if (v.prm) v.prm.shift.value = v.sh; else if (v.core) v.core.shift();
        } catch (e) { warn(e); }
      },
      setGain(g) {
        try {
          v.gain = Math.max(0, num(g, v.gain));
          if (v.g) { const t = S.ctx.currentTime; v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(v.gain, t, 0.03); }
        } catch (e) { warn(e); }
      },
      setPan(p) {
        try {
          v.pan = Math.max(-1, Math.min(1, num(p, v.pan)));
          if (v.pn) { const t = S.ctx.currentTime; v.pn.pan.cancelScheduledValues(t); v.pn.pan.setTargetAtTime(v.pan, t, 0.03); }
        } catch (e) { warn(e); }
      },
      dispose() { kill(v); },
      get alive() { return !v.dead; },
    };
    try {
      if (S.gone) { v.dead = true; return api; }
      while (S.voices.length >= maxV) kill(S.voices[0]); // 同時最多兩個
      S.voices.push(v);
      if (S.rec) { v.live = true; S.rec.n++; }
      clearTimeout(S.idleT);
      if (S.mode === 'worklet' || S.mode === 'script') { build(v); wake(); }
    } catch (e) { warn(e); }
    return api;
  }
  // ---- 升降機的馬達（第 2 批）：開鎖／落鎖「喀」（低頻的碰＋金屬的咔＋一點點共鳴）、馬達（鋸齒波低通＋低八度＋小小的電機哨音＋液壓的沙沙聲，11 Hz 的脈動）----
  function noiseBuf(ctx) {
    if (S.noise && S.noise.sampleRate === ctx.sampleRate) return S.noise;
    const n = Math.round(ctx.sampleRate), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let r = 0x9e3779b9; for (let i = 0; i < n; i++) { r ^= r << 13; r ^= r >>> 17; r ^= r << 5; d[i] = (r | 0) * 4.656612873077393e-10; }
    return (S.noise = b);
  }
  function clunk(ctx, dst, t, lvl, keep) {
    const env = (g, a, T) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + T); };
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(125, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
    env(og, 0.95 * lvl, 0.24); o.connect(og); og.connect(dst); o.start(t); o.stop(t + 0.26);
    const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = noiseBuf(ctx); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1.2;
    env(ng, 0.8 * lvl, 0.07); n.connect(f); f.connect(ng); ng.connect(dst); n.start(t, 0.1 + 0.6 * Math.random()); n.stop(t + 0.09);
    keep.push(o, og, n, f, ng);
    for (const [hz, a] of [[690, 0.07], [1170, 0.045]]) { const r = ctx.createOscillator(), rg = ctx.createGain(); r.frequency.value = hz; env(rg, a * lvl, 0.32); r.connect(rg); rg.connect(dst); r.start(t); r.stop(t + 0.34); keep.push(r, rg); }
  }
  function lift(o = {}) {
    const h = { alive: false, stop() {} };
    try {
      if (S.gone) return h;
      const ctx = ensureCtx(); if (!ctx) return h;
      wake(); clearTimeout(S.idleT);
      const t0 = Math.max(ctx.currentTime, num(o.at, 0)) + 0.01, keep = [];
      const out = ctx.createGain(); out.gain.value = Math.max(0, num(o.gain, 1)); out.connect(S.inp); keep.push(out);
      const hum = ctx.createGain(), rip = ctx.createGain(); hum.gain.setValueAtTime(0, t0); hum.gain.setValueAtTime(0, t0 + 0.5); hum.gain.linearRampToValueAtTime(1, t0 + 0.9);
      rip.gain.value = 0.88; rip.connect(hum); hum.connect(out); keep.push(hum, rip);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 11; lg.gain.value = 0.12; lfo.connect(lg); lg.connect(rip.gain); keep.push(lfo, lg); // 馬達的脈動
      const saw = ctx.createOscillator(), lp = ctx.createBiquadFilter(), sg = ctx.createGain(); saw.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 480; lp.Q.value = 0.9; sg.gain.value = 0.2;
      saw.frequency.setValueAtTime(58, t0); saw.frequency.setValueAtTime(58, t0 + 0.5); saw.frequency.linearRampToValueAtTime(98, t0 + 1.15);
      saw.connect(lp); lp.connect(sg); sg.connect(rip); keep.push(saw, lp, sg);
      const sub = ctx.createOscillator(), bg = ctx.createGain(); sub.frequency.setValueAtTime(29, t0); sub.frequency.setValueAtTime(29, t0 + 0.5); sub.frequency.linearRampToValueAtTime(49, t0 + 1.15); bg.gain.value = 0.24;
      sub.connect(bg); bg.connect(rip); keep.push(sub, bg);
      const wh = ctx.createOscillator(), wg = ctx.createGain(); wh.frequency.setValueAtTime(360, t0); wh.frequency.setValueAtTime(360, t0 + 0.5); wh.frequency.linearRampToValueAtTime(590, t0 + 1.25); wg.gain.value = 0.018;
      wh.connect(wg); wg.connect(rip); keep.push(wh, wg);
      const ns = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), nsg = ctx.createGain(); ns.buffer = noiseBuf(ctx); ns.loop = true; bp.type = 'bandpass'; bp.frequency.value = 820; bp.Q.value = 0.7; nsg.gain.value = 0.05;
      ns.connect(bp); bp.connect(nsg); nsg.connect(rip); keep.push(ns, bp, nsg);
      for (const x of [lfo, saw, sub, wh, ns]) x.start(t0);
      clunk(ctx, out, t0, 1, keep); clunk(ctx, out, t0 + 0.52, 0.4, keep); // 開鎖、框開始動
      if (S.rec) S.rec.n++;
      let done = false;
      const T = setTimeout(() => h.stop(), Math.max(1, num(o.max, 20)) * 1000);
      h.alive = true;
      h.stop = (when) => {
        try {
          if (done) return; done = true; h.alive = false; clearTimeout(T);
          const t1 = Math.max(ctx.currentTime, num(when, 0)) + 0.01;
          for (const [p, v] of [[hum.gain, 0], [saw.frequency, 50], [sub.frequency, 25], [wh.frequency, 300]]) {
            if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t1); else { p.cancelScheduledValues(t1); p.setValueAtTime(p.value, t1); }
            p.linearRampToValueAtTime(v, t1 + 0.32);
          }
          clunk(ctx, out, t1 + 0.3, 0.9, keep); // 落鎖
          for (const x of [lfo, saw, sub, wh, ns]) x.stop(t1 + 0.7);
          setTimeout(() => {
            for (const x of keep) try { x.disconnect(); } catch { /* 算了 */ }
            if (S.rec) { S.rec.n = Math.max(0, S.rec.n - 1); idleCheck(); }
          }, Math.max(0, (t1 + 0.8 - ctx.currentTime) * 1000) + 100);
        } catch (e) { warn(e); }
      };
    } catch (e) { warn(e); }
    return h;
  }
  // 撞車聲：金屬（4 種大小）＋玻璃（一種，音量看碎了多少）各算一次存起來（全部不到 1 MB）；同時最多 4 個
  //   第一次 resume() 之後在背景慢慢先算好（每 60 ms 算一個），撞的那一下就不用算
  const crashBuf = new Map(), crashes = [];
  const CRASH_KEYS = ['m0', 'm1', 'm2', 'm3', 'g'];
  function crashBuffer(key) {
    let buf = crashBuf.get(key);
    if (!buf && S.ctx) {
      const ctx = S.ctx, lv = +key[1] || 0;
      const d = key === 'g' ? SND_crash(ctx.sampleRate, 0.5, 1, 4321, 2) : SND_crash(ctx.sampleRate, (lv + 0.6) / 4, 0, 1234 + lv * 97, 1);
      buf = ctx.createBuffer(1, d.length, ctx.sampleRate); buf.getChannelData(0).set(d); crashBuf.set(key, buf);
    }
    return buf;
  }
  let crashPre = 0;
  function crashPrerender() { // 背景先算
    if (crashPre || S.gone) return;
    crashPre = 1;
    const next = (i) => { if (S.gone || i >= CRASH_KEYS.length) return; try { crashBuffer(CRASH_KEYS[i]); } catch (e) { warn(e); return; } setTimeout(() => next(i + 1), 60); };
    setTimeout(() => next(0), 400);
  }
  function crashPlay(buf, gain, pan, rate) {
    const ctx = S.ctx, src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; src.playbackRate.value = rate; g.gain.value = gain;
    src.connect(g);
    let pn = null;
    try { pn = ctx.createStereoPanner(); pn.pan.value = pan; g.connect(pn); pn.connect(S.inp); } catch { g.connect(S.inp); }
    if (S.rec) S.rec.n++;
    src.onended = () => { const i = crashes.indexOf(src); if (i >= 0) crashes.splice(i, 1); try { src.disconnect(); g.disconnect(); if (pn) pn.disconnect(); } catch { /* 算了 */ } if (S.rec) { S.rec.n = Math.max(0, S.rec.n - 1); idleCheck(); } };
    while (crashes.length >= 4) { const c = crashes.shift(); try { c.stop(); } catch { /* 算了 */ } }
    crashes.push(src); src.start();
  }
  function crash(o = {}) {
    try {
      if (S.gone || !S.ctx || !S.inp) return;
      const k = Math.max(0, Math.min(1, num(o.strength, 0.5))), gl = Math.max(0, Math.min(1, num(o.glass, 0))), lv = Math.min(3, Math.floor(k * 4)), pan = Math.max(-1, Math.min(1, num(o.pan, 0)));
      wake();
      crashPlay(crashBuffer('m' + lv), 0.35 + 0.65 * k, pan, 0.93 + Math.random() * 0.14);
      if (gl > 0.05) crashPlay(crashBuffer('g'), 0.3 + 0.6 * gl, pan, 0.9 + Math.random() * 0.2);
    } catch (e) { warn(e); }
  }
  // 嘶嘶聲（一直循環的雜訊 → 帶通 2.8 kHz → 高通）；level 0 就淡出、1 秒後拔掉
  const hs = { src: null, g: null, off: 0, live: false };
  function hiss(level) {
    try {
      if (S.gone || !S.ctx || !S.inp) return;
      const ctx = S.ctx, lv = Math.max(0, Math.min(1, num(level, 0))), t = ctx.currentTime;
      clearTimeout(hs.off);
      if (lv <= 0) {
        if (hs.g) { hs.g.gain.setTargetAtTime(0, t, 0.15); hs.off = setTimeout(() => { try { hs.src.stop(); hs.src.disconnect(); hs.g.disconnect(); } catch { /* 算了 */ } hs.src = hs.g = null; if (hs.live && S.rec) { hs.live = false; S.rec.n = Math.max(0, S.rec.n - 1); idleCheck(); } }, 1000); }
        return;
      }
      if (!hs.src) {
        const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
        let r = 0x1234567;
        for (let i = 0; i < n; i++) { r ^= r << 13; r ^= r >>> 17; r ^= r << 5; d[i] = ((r >>> 0) / 4294967296) * 2 - 1; }
        const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = b; src.loop = true; bp.type = 'bandpass'; bp.frequency.value = 2800; bp.Q.value = 0.8; hp.type = 'highpass'; hp.frequency.value = 900; g.gain.value = 0;
        src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(S.inp); src.start();
        hs.src = src; hs.g = g;
        if (S.rec && !hs.live) { hs.live = true; S.rec.n++; }
        wake();
      }
      hs.g.gain.setTargetAtTime(lv * 0.22, t, 0.2);
    } catch (e) { warn(e); }
  }
  // ---- 第 3 批（甩尾）：輪胎叫（雜訊 → 兩個很窄的帶通＋半個音高的鋸齒波（9 Hz 顫一顫：FM＋音量）；泥土：低通的沙沙）；level 0 就淡出、1 秒後拔掉 ----
  const sk = { n: null, off: 0, live: false };
  function skid(level, pitch, dirt) {
    try {
      if (S.gone || !S.ctx || !S.inp) return;
      const ctx = S.ctx, lv = Math.max(0, Math.min(1, num(level, 0))), p = Math.max(0, Math.min(1, num(pitch, 0.5))), t = ctx.currentTime;
      clearTimeout(sk.off);
      if (lv <= 0) {
        if (sk.n) {
          const N = sk.n; N.g.gain.setTargetAtTime(0, t, 0.08);
          sk.off = setTimeout(() => { try { for (const x of N.src) x.stop(); for (const x of N.all) x.disconnect(); } catch { /* 算了 */ } if (sk.n === N) sk.n = null; if (sk.live && S.rec) { sk.live = false; S.rec.n = Math.max(0, S.rec.n - 1); idleCheck(); } }, 1000);
        }
        return;
      }
      if (!sk.n) {
        const src = ctx.createBufferSource(), b1 = ctx.createBiquadFilter(), b2 = ctx.createBiquadFilter(), g1 = ctx.createGain(), g2 = ctx.createGain(), sq = ctx.createGain(), trem = ctx.createGain(), g = ctx.createGain();
        const osc = ctx.createOscillator(), ob = ctx.createBiquadFilter(), og = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), tl = ctx.createGain(), dl = ctx.createBiquadFilter(), dg = ctx.createGain();
        src.buffer = noiseBuf(ctx); src.loop = true; b1.type = b2.type = ob.type = 'bandpass'; b1.Q.value = 18; b2.Q.value = 12; ob.Q.value = 4; g1.gain.value = 3; g2.gain.value = 1.5; og.gain.value = 0.035;
        osc.type = 'sawtooth'; lfo.frequency.value = 9; lg.gain.value = 22; tl.gain.value = 0.15; trem.gain.value = 0.85; dl.type = 'lowpass'; dl.frequency.value = 700; dg.gain.value = 0; g.gain.value = 0;
        lfo.connect(lg); lg.connect(osc.frequency); lfo.connect(tl); tl.connect(trem.gain);
        src.connect(b1); src.connect(b2); b1.connect(g1); b2.connect(g2); g1.connect(sq); g2.connect(sq); osc.connect(ob); ob.connect(og); og.connect(sq);
        sq.connect(trem); trem.connect(g); src.connect(dl); dl.connect(dg); dg.connect(g); g.connect(S.inp);
        src.start(); osc.start(); lfo.start();
        sk.n = { g, b1, b2, osc, ob, sq, dg, src: [src, osc, lfo], all: [src, b1, b2, g1, g2, osc, ob, og, lfo, lg, tl, trem, dl, dg, sq, g] };
        if (S.rec && !sk.live) { sk.live = true; S.rec.n++; }
        wake();
      }
      const N = sk.n, f = 950 + 450 * p;
      N.b1.frequency.setTargetAtTime(f, t, 0.05); N.b2.frequency.setTargetAtTime(f * 1.87, t, 0.05); N.osc.frequency.setTargetAtTime(f * 0.5, t, 0.05); N.ob.frequency.setTargetAtTime(f, t, 0.05);
      N.sq.gain.setTargetAtTime(dirt ? 0.15 : 1, t, 0.1); N.dg.gain.setTargetAtTime(dirt ? 0.5 : 0, t, 0.1);
      N.g.gain.setTargetAtTime(0.32 * lv * (0.4 + 0.6 * lv), t, 0.04);
    } catch (e) { warn(e); }
  }
  function setMuted(m) {
    try {
      S.muted = !!m;
      if (S.inp) { const t = S.ctx.currentTime; S.inp.gain.cancelScheduledValues(t); S.inp.gain.setTargetAtTime(S.muted ? 0 : S.vol, t, 0.04); }
      if (!S.muted) wake();
    } catch (e) { warn(e); }
  }
  function setVolume(x) {
    try {
      S.vol = Math.max(0, Math.min(1, num(x, S.vol)));
      if (S.inp && !S.muted) { const t = S.ctx.currentTime; S.inp.gain.cancelScheduledValues(t); S.inp.gain.setTargetAtTime(S.vol, t, 0.04); }
    } catch (e) { warn(e); }
  }
  function dispose() {
    try {
      if (S.gone) return;
      for (const v of [...S.voices]) kill(v);
      hiss(0); skid(0); for (const c of crashes.splice(0)) { try { c.stop(); } catch { /* 算了 */ } }
      S.gone = true;
      const nodes = S.nodes;
      S.nodes = [];
      setTimeout(() => { for (const n of nodes) try { n.disconnect(); } catch { /* 算了 */ } }, 500); // 等聲音淡出
    } catch (e) { warn(e); }
  }
  return {
    resume, voice, lift, crash, hiss, skid, setMuted, setVolume, dispose, // skid：第 3 批
    get muted() { return S.muted; },
    get volume() { return S.vol; },
    get mode() { return S.mode; }, // 'worklet'｜'script'｜'off'
    get context() { return S.ctx; },
    get input() { return S.inp; }, // 第 2 批：總輸出的入口（路上的車按喇叭接這裡：音量、靜音跟引擎聲一樣）；resume() 以前是 null
  };
}
// 測試用（離線渲染、分析）
createEngineAudio.core = SND_core;
createEngineAudio.profile = SND_profile;
createEngineAudio.cars = SND_CARS;
createEngineAudio.crashSynth = SND_crash;
