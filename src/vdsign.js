// vdsign.js — 第 92 批（Nick 2026-11-15「要交通號誌比如前有大灣或限速／有牌子橫過路中間寫到哪裡／原本最後面的那條交流道下去後要過一個ETC站」）
// 高架橋（viaduct.js）上的牌子，全部照台灣的樣子（自己畫的，沒有真的 logo）：
//   限速：圓的、紅邊白底黑字（圓環 60、平的那段 80、下去內湖那段 50、交流道 50、休息站 40）；立在護欄上，朝開過來的車
//   前有大彎：三角形、紅邊白底黑色彎的箭頭＋下面一塊「前有大彎 減速慢行」；照主線的彎（半徑 220 公尺以內、轉超過 25 度）自己算位置，兩個方向各一面，彎道前 160 公尺
//   門架（橫過路中間的指示牌）：綠底白字（往休息站的是藍底），一個方向兩線、每一線上面一塊（直走的 ↑、出口的 ↗＋黃色「出口」）；柱子立在兩邊的護欄上
//   ETC 門架：最後下去內湖那段，兩個方向的每一線上面一個感應器，牌子「ETC 電子收費」；town.src.js 開過去「嗶」＋「ETC 嗶！（免費）」
//   休息站的出口：「出口 往…」綠色的牌子（立在地上）
// 用法：const S = buildVdSigns({ roads, main, sH, sD, HW, qb, boxAt, lbar, inOther, barOn, concMat, COL, renderer }) → { group, tris, etc: [{ s }], list, cols }
//   roads[0]＝主線（VD_PATH，有 Y）；交流道有 def.id（A、B、WX、WE、EX、EE）
import * as THREE from 'three';

export const { VDS_TEXT, buildVdSigns } = (() => {
const VDS_TEXT = '限速前有大彎減速慢行內湖成功路環山路港墘站大便龍服務區內湖路二段市中心文德站超大停車場快速道路村子出口入口往電子收費公尺加油廁所超商ETC0123456789';
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
const AW = 2048, AH = 1024;

// ---- 貼圖（一張）：[x, y, w, h]（畫布的像素，左上角起）----
const REG = {
  gNeihu: [0, 0, 512, 256], gA: [512, 0, 512, 256], gRest: [1024, 0, 512, 256], gB: [1536, 0, 512, 256],
  gEnd: [0, 256, 512, 256], gLot: [512, 256, 512, 256], gEtc: [1024, 256, 512, 256], gVil: [1536, 256, 512, 256],
  s40: [0, 512, 256, 256], s50: [256, 512, 256, 256], s60: [512, 512, 256, 256], s80: [768, 512, 256, 256],
  curveR: [1024, 512, 256, 256], curveL: [1280, 512, 256, 256], plate: [1536, 512, 512, 128],
  exitE: [0, 768, 512, 256], exitW: [512, 768, 512, 256],
};
function atlas(renderer) {
  const c = document.createElement('canvas'); c.width = AW; c.height = AH; const g = c.getContext('2d');
  g.clearRect(0, 0, AW, AH);
  const txt = (s, x, y, px, col, wt = 800, al = 'center') => { g.font = `${wt} ${px}px ${SANS}`; g.fillStyle = col; g.textAlign = al; g.textBaseline = 'middle'; g.fillText(s, x, y); };
  const arrow = (cx, cy, ang, sz, col) => { g.save(); g.translate(cx, cy); g.rotate(ang); g.fillStyle = col; g.beginPath(); g.moveTo(0, -sz); g.lineTo(sz * 0.72, -sz * 0.2); g.lineTo(sz * 0.26, -sz * 0.2); g.lineTo(sz * 0.26, sz); g.lineTo(-sz * 0.26, sz); g.lineTo(-sz * 0.26, -sz * 0.2); g.lineTo(-sz * 0.72, -sz * 0.2); g.closePath(); g.fill(); g.restore(); };
  const panel = (k, lines, ang, opt = {}) => { // 門架的牌子：綠（藍）底、白邊、白字、右邊箭頭
    const [x0, y0, w, h] = REG[k], bg = opt.blue ? '#1c4f9c' : '#0d6b3a';
    g.fillStyle = bg; g.fillRect(x0, y0, w, h); g.strokeStyle = '#f4f4f4'; g.lineWidth = 7; g.strokeRect(x0 + 10, y0 + 10, w - 20, h - 20);
    const tx = x0 + (ang == null ? w / 2 : (w - 120) / 2 + 6);
    if (lines.length === 1) txt(lines[0], tx, y0 + h / 2 + 4, lines[0].length > 5 ? 58 : 72, '#fff');
    else { txt(lines[0], tx, y0 + h / 2 - 40, lines[0].length > 5 ? 56 : 66, '#fff'); txt(lines[1], tx, y0 + h / 2 + 48, lines[1].length > 5 ? 50 : 58, '#fff'); }
    if (ang != null) arrow(x0 + w - 70, y0 + h / 2 + 6, ang, 52, '#fff');
    if (opt.exit) { g.fillStyle = '#f2c230'; g.fillRect(x0 + 18, y0 + 18, 104, 44); txt('出口', x0 + 70, y0 + 41, 34, '#111', 900); }
  };
  panel('gNeihu', ['內湖', '成功路'], 0); panel('gA', ['環山路', '港墘站'], Math.PI / 4, { exit: true }); panel('gRest', ['大便龍服務區', '加油 · 廁所 · 超商'], Math.PI / 4, { blue: true, exit: true });
  panel('gB', ['內湖路二段', '市中心'], Math.PI / 4, { exit: true }); panel('gEnd', ['成功路', '文德站'], 0); panel('gLot', ['超大停車場', '快速道路'], 0); panel('gVil', ['快速道路', '村子'], 0);
  { const [x0, y0, w, h] = REG.gEtc; g.fillStyle = '#0d6b3a'; g.fillRect(x0, y0, w, h); g.strokeStyle = '#f4f4f4'; g.lineWidth = 7; g.strokeRect(x0 + 10, y0 + 10, w - 20, h - 20);
    g.fillStyle = '#ffffff'; g.fillRect(x0 + 40, y0 + 52, 190, 150); txt('ETC', x0 + 135, y0 + 128, 78, '#0d6b3a', 900); txt('電子', x0 + 360, y0 + 92, 64, '#fff'); txt('收費', x0 + 360, y0 + 170, 64, '#fff'); }
  const disc = (k, num) => { const [x0, y0, w] = REG[k], cx = x0 + w / 2, cy = y0 + w / 2; g.fillStyle = '#d4231d'; g.beginPath(); g.arc(cx, cy, w / 2 - 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, w / 2 - 34, 0, Math.PI * 2); g.fill(); txt(String(num), cx, cy + 6, 104, '#111', 900); };
  disc('s40', 40); disc('s50', 50); disc('s60', 60); disc('s80', 80);
  const tri = (k, dir) => { // 三角形（紅邊白底）、彎的箭頭（dir 1＝右彎）
    const [x0, y0, w] = REG[k], cx = x0 + w / 2, top = y0 + 12, bot = y0 + w - 22, half = (bot - top) / Math.sqrt(3);
    g.fillStyle = '#d4231d'; g.beginPath(); g.moveTo(cx, top); g.lineTo(cx + half, bot); g.lineTo(cx - half, bot); g.closePath(); g.fill();
    const t2 = top + 40, b2 = bot - 20, h2 = (b2 - t2) / Math.sqrt(3); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(cx, t2); g.lineTo(cx + h2, b2); g.lineTo(cx - h2, b2); g.closePath(); g.fill();
    g.save(); g.translate(cx, y0 + w * 0.6); g.scale(dir, 1); g.strokeStyle = '#111'; g.lineWidth = 16; g.lineCap = 'butt'; g.beginPath(); g.moveTo(-14, 52); g.lineTo(-14, 6); g.quadraticCurveTo(-14, -24, 18, -26); g.stroke();
    g.fillStyle = '#111'; g.beginPath(); g.moveTo(44, -26); g.lineTo(14, -48); g.lineTo(14, -4); g.closePath(); g.fill(); g.restore();
  };
  tri('curveR', 1); tri('curveL', -1);
  { const [x0, y0, w, h] = REG.plate; g.fillStyle = '#ffffff'; g.fillRect(x0, y0, w, h); g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(x0 + 6, y0 + 6, w - 12, h - 12); txt('前有大彎　減速慢行', x0 + w / 2, y0 + h / 2 + 3, 54, '#111', 900); }
  const side = (k, a, b, ang) => { const [x0, y0, w, h] = REG[k]; g.fillStyle = '#0d6b3a'; g.fillRect(x0, y0, w, h); g.strokeStyle = '#f4f4f4'; g.lineWidth = 7; g.strokeRect(x0 + 10, y0 + 10, w - 20, h - 20);
    g.fillStyle = '#f2c230'; g.fillRect(x0 + 26, y0 + 26, 132, 58); txt('出口', x0 + 92, y0 + 56, 44, '#111', 900); txt(a, x0 + 200, y0 + 56, 50, '#fff', 800, 'left'); txt(b, x0 + 40, y0 + 168, 62, '#fff', 800, 'left'); arrow(x0 + w - 70, y0 + 160, ang, 50, '#fff'); };
  side('exitE', '往', '內湖 成功路', Math.PI / 2); side('exitW', '往', '超大停車場', -Math.PI / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer?.capabilities?.getMaxAnisotropy ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4; t.generateMipmaps = true;
  return t;
}
const UV = (k) => { const [x, y, w, h] = REG[k], u0 = (x + 2) / AW, u1 = (x + w - 2) / AW, v1 = 1 - (y + 2) / AH, v0 = 1 - (y + h - 2) / AH; return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]; };

function buildVdSigns(o) {
  const { roads, main, sH, sD, HW, qb, boxAt, lbar, inOther, barOn, concMat, COL } = o;
  const { X, Z, TX, TZ, Y, n, L } = main;
  const face = qb(true), back = qb(false), list = [], etc = [], cols = [];
  const GREY = [0.46, 0.48, 0.5], DARK = [0.2, 0.21, 0.22], POLE = COL.pole;
  const idx = (r, s) => Math.max(0, Math.min(r.n - 1, Math.round((s / r.L) * (r.n - 1))));
  const at = (r, i, u, y) => [r.X[i] - r.TZ[i] * u, y, r.Z[i] + r.TX[i] * u];
  // 一塊牌子：中心 c（x、z）、往 d（開過來的車的方向，水平單位向量）→ 牌子朝 −d；寬 w、高 h、底 y0；後面灰色
  const plate = (cx, cz, d, w, h, y0, k) => {
    const rx = -d[1], rz = d[0], p = (u, y, e = 0) => [cx + rx * u - d[0] * e, y, cz + rz * u - d[1] * e], U = UV(k);
    face.quad(p(-w / 2, y0), p(w / 2, y0), p(w / 2, y0 + h), p(-w / 2, y0 + h), null, U, [-d[0], 0, -d[1]]);
    back.quad(p(w / 2, y0, -0.03), p(-w / 2, y0, -0.03), p(-w / 2, y0 + h, -0.03), p(w / 2, y0 + h, -0.03), GREY, null, [d[0], 0, d[1]]);
  };
  // ---- 立在護欄上的小牌子（限速、彎道）：side＝路的哪一邊（+1＝+u）；dir＝車往 +S（1）還是 −S（−1）----
  const sideSign = (r, s, sd, dir, kinds, why) => {
    const i = idx(r, s), u = sd * (r.road + 0.35), base = at(r, i, u, r.Y[i]);
    if (!barOn(r, i, sd) || inOther(r, base[0], base[2], r.Y[i], 1.2)) { list.push({ why, s: Math.round(s), skip: true }); return false; }
    const d = [r.TX[i] * dir, r.TZ[i] * dir], y1 = r.Y[i] + 1;
    let top = y1 + 1.3; for (const [k, w, h] of kinds) top += h + 0.05;
    boxAt(back, base[0], base[2], 0.05, y1, top, POLE);
    let y = y1 + 1.3; for (const [k, w, h] of kinds.slice().reverse()) { plate(base[0], base[2], d, w, h, y, k); y += h + 0.05; }
    list.push({ why, r: r.def.id, s: Math.round(s), x: +base[0].toFixed(1), z: +base[2].toFixed(1), y: +r.Y[i].toFixed(1) });
    return true;
  };
  const speed = (r, s, sd, dir, v) => sideSign(r, s, sd, dir, [[`s${v}`, 1.0, 1.0]], `限速 ${v}`);
  // ---- 1) 限速 ----
  const M = roads[0];
  speed(M, 50, 1, 1, 60); speed(M, sH + 40, 1, 1, 80); speed(M, sD - 20, 1, 1, 50);
  speed(M, L - 88, -1, -1, 80); speed(M, sH + 30, -1, -1, 60);
  for (const r of roads.slice(1)) {
    const id = r.def.id, rest = r.def.rest, s = id === 'WE' || id === 'EE' ? 40 : 125;
    if (r.def.exit) speed(r, Math.min(s, r.L - 30), 1, 1, rest ? 40 : 50);
    else speed(r, Math.max(30, Math.min(r.L * 0.3, r.L - 40)), 1, 1, 80);
  }
  // ---- 2) 前有大彎：主線的彎（半徑 220 以內）----
  const curves = [];
  { const K = new Float32Array(n), w = 6; const th = (i) => Math.atan2(TZ[i], TX[i]);
    for (let i = w; i < n - w; i++) { let a = th(i + w) - th(i - w); while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; K[i] = a / (main.S[i + w] - main.S[i - w]); }
    let a = -1, turn = 0;
    for (let i = 0; i <= n; i++) {
      const on = i < n && Math.abs(K[i]) > 1 / 220;
      if (on && a < 0) { a = i; turn = 0; }
      if (on) turn += K[i] * 2;
      if (!on && a >= 0) { const s0 = main.S[a], s1 = main.S[i - 1]; if (Math.abs(turn) > (25 * Math.PI) / 180 && s1 - s0 > 15) { const last = curves[curves.length - 1]; if (last && s0 - last.s1 < 40 && Math.sign(last.turn) === Math.sign(turn)) { last.s1 = s1; last.turn += turn; } else curves.push({ s0, s1, turn }); } a = -1; }
    }
    curves.forEach((c, ci) => {
      const rt = c.turn > 0 ? 1 : -1; // +S 往右彎＝1（x 東、z 南：角度變大＝順時針）
      // 牌子在彎前 160 公尺；前一個彎還沒過完（＋30 公尺）就往後挪，挪到離彎不到 40 公尺＝不放（剛轉完又一個彎）
      const prev = curves[ci - 1], next = curves[ci + 1];
      const sp = Math.max(c.s0 - 160, prev ? prev.s1 + 30 : -1e9), sn = Math.min(c.s1 + 160, next ? next.s0 - 30 : 1e9);
      if (sp > 60 && c.s0 > sH + 1 && sp < c.s0 - 40) sideSign(M, sp, 1, 1, [[rt > 0 ? 'curveR' : 'curveL', 1.1, 1.1], ['plate', 1.24, 0.31]], `前有大彎 +S ${Math.round(c.s0)}`);
      if (sn < L - 60 && sn > c.s1 + 40) sideSign(M, sn, -1, -1, [[rt > 0 ? 'curveL' : 'curveR', 1.1, 1.1], ['plate', 1.24, 0.31]], `前有大彎 −S ${Math.round(c.s1)}`);
    });
  }
  // ---- 3) 門架：柱子在兩邊的護欄上、上面兩條橫樑；pos＝往 +S 那邊兩線的牌子（裡面、外面），neg＝往 −S 那邊的 ----
  const gantry = (s, pos, neg, why, etcOn = false) => {
    let i = idx(M, s);
    const okAt = (j) => [1, -1].every((sd) => { const p = at(M, j, sd * (HW - 0.3), 0); return barOn(M, j, sd) && !inOther(M, p[0], p[2], Y[j], 1.5); });
    for (let k = 0; k < 40 && !okAt(i); k++) i += 2; // 交流道接在旁邊、另一層疊在上面：往前挪
    const y = Y[i], yb = y + 1, yt = y + 7.7, A = at(M, i, HW - 0.3, 0), B = at(M, i, -(HW - 0.3), 0), t = [TX[i], TZ[i]];
    for (const P of [A, B]) boxAt(back, P[0], P[2], 0.2, yb, yt + 0.3, POLE); // 柱子在護欄上（護欄已經擋了）
    for (const [y0, y1] of [[y + 6.9, y + 7.25], [y + 7.6, y + 7.95]]) lbar(back, A[0], A[2], B[0], B[2], y0, y1, 0.12, POLE);
    for (let u = -(HW - 0.8); u <= HW - 0.8 + 1e-6; u += 1.2) { const p = at(M, i, u, 0); boxAt(back, p[0], p[2], 0.04, y + 6.9, y + 7.95, POLE); } // 桁架的直條
    const put = (k, u, dir) => { if (!k) return; const c = at(M, i, u, 0), d = [t[0] * dir, t[1] * dir]; plate(c[0] - d[0] * 0.18, c[2] - d[1] * 0.18, d, 3.4, 1.7, y + 5.35, k); };
    if (pos) { put(pos[0], 1.85, 1); put(pos[1], 5.55, 1); }
    if (neg) { put(neg[0], -1.85, -1); put(neg[1], -5.55, -1); }
    if (etcOn) { // 感應器：每一線上面一個（灰色的盒子＋黑色的鏡頭）
      for (const u of [-5.55, -1.85, 1.85, 5.55]) { const c = at(M, i, u, 0); boxAt(back, c[0], c[2], 0.28, y + 6.25, y + 6.9, GREY); boxAt(back, c[0], c[2], 0.12, y + 6.0, y + 6.25, DARK); }
      etc.push({ s: +M.S[i].toFixed(1), i, y: +y.toFixed(2) });
    }
    list.push({ why, s: Math.round(M.S[i]), x: +A[0].toFixed(1), z: +A[2].toFixed(1), y: +y.toFixed(1) });
  };
  const sOf = (id) => roads.find((r) => r.def.id === id)?.def.s0;
  const sA = sOf('A') ?? 2150, sEX = sOf('EX') ?? 2330, sB = sOf('B') ?? 3578;
  gantry(sA - 300, ['gNeihu', 'gA'], ['gLot', 'gLot'], '門架：環山路 港墘站');
  gantry(sEX - 75, ['gNeihu', 'gRest'], null, '門架：大便龍服務區（往東）');
  gantry(sB - 280, ['gEnd', 'gB'], ['gLot', 'gRest'], '門架：內湖路二段 市中心／服務區（往西）');
  gantry(sD - 120, ['gEnd', 'gEnd'], ['gVil', 'gVil'], '門架：成功路 文德站');
  gantry(L - 65, ['gEtc', 'gEtc'], ['gEtc', 'gEtc'], 'ETC 門架', true); // 東南角的彎和最後那個小彎中間的直路
  // ---- 4) 休息站的出口（往東 EE、往西 WE 的起點旁邊；立在地上）----
  for (const [id, k] of [['EE', 'exitE'], ['WE', 'exitW']]) {
    const r = roads.find((q) => q.def.id === id); if (!r) continue;
    const i = idx(r, 14), sd = 1, p = at(r, i, sd * (r.road + 1.4), r.Y[i]), d = [r.TX[i], r.TZ[i]], y = r.Y[i];
    for (const e of [-1.2, 1.2]) { const q = [p[0] - d[1] * e, p[2] + d[0] * e]; boxAt(back, q[0], q[1], 0.07, y, y + 3.9, POLE); cols.push({ t: 'circle', x: q[0], z: q[1], r: 0.15, y0: y - 0.5, h: y + 4, vd: 'sign' }); }
    plate(p[0], p[2], d, 3.0, 1.5, y + 2.4, k); list.push({ why: `休息站出口 ${id}`, x: +p[0].toFixed(1), z: +p[2].toFixed(1), y: +y.toFixed(1) });
  }
  const mat = new THREE.MeshStandardMaterial({ map: atlas(o.renderer), emissive: 0xffffff, emissiveIntensity: 0.14, roughness: 0.55, metalness: 0, alphaTest: 0.5 }); mat.emissiveMap = mat.map; mat.name = 'vd-sign2';
  const group = new THREE.Group(); group.name = 'vd-signs';
  const fm = new THREE.Mesh(face.geo(), mat); fm.name = 'vd-sign2'; group.add(fm);
  const bm = new THREE.Mesh(back.geo(), concMat); bm.name = 'vd-sign2-back'; bm.castShadow = true; group.add(bm);
  return { group, tris: face.nt + back.nt, list, etc, cols, curves: curves.map((c) => ({ s0: Math.round(c.s0), s1: Math.round(c.s1), deg: Math.round((c.turn * 180) / Math.PI) })) };
}
return { VDS_TEXT, buildVdSigns };
})();
