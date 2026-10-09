// 輕量車（LOD）：7 台車各做一個「整台 1.5～2.5 萬個三角形」的車身檔 body-<key>-lod.glb（＋ art/car-<key>-lod.txt，base64 給試做頁）
// 給車庫的六個車位、車行展示、之後路上的車用；執行時用 carlod.js 的 buildLodCar(key, gltf.scene, look) 組起來
// 用法：node make-lod.mjs [supra,gtr,...] [--rebake] [--half=9000]
// 步驟：
//  1. 烘焙（lod-bake.html，Chromium）：照車庫的組法（buildCar＋extraWings＋WIDE）把整台車組起來，拿出右半邊車身（Supra 還有兩個車頭）、
//     四張投影遮罩的像素、車身上的零件（後照鏡、排氣管、套件、每種尾翼、寬體）→ lod3d/bake-<key>.json（快取，--rebake 重做）
//  2. 車身每個頂點照 masks.js patchPaint 的規則分類：車漆、玻璃、黑飾條、消光（輪拱、車底）、燈（鍍鉻反射罩）、燈裡的暗玻璃、網子、方向燈、尾燈、倒車燈、
//     低的鍍鉻（chrome：y＜0.48 的 lamp，霧燈框、中冷器、下巴亮條，開大燈不亮）；燈裡暗玻璃的比例、網子覆蓋率每台車取平均 → lens／wire 材質的 extras.mix
//     遮罩先模糊 5 公釐（比 1.2 公分細的線：門縫、描邊，簡化後本來就看不到），再沿著分類的邊界把三角形切開（二分法找交界），邊界才會平順
//  3. meshoptimizer 簡化（simplifyWithAttributes：法線也算誤差；分類交界是 seam，不會混色；對稱面 z=0 的邊只沿著邊收；Supra 車頭／車身接縫鎖住）
//  4. 零件照「在哪些套件、哪個尾翼、寬體」分組，同一種材質併成一個、焊接頂點再簡化（誤差 2 公釐，寬體葉子板 4 公釐）；太小的（寬體鉚釘、SP3 葉子板盾牌、918 車蓋條紋＝拉花）不要
//  5. 寫 glb（KHR_mesh_quantization：位置 int16、法線 int8，索引 uint16）：
//     node「body」＝右半邊車身（執行時鏡射），extras＝{ lod: 'body', half: true }；每個分類一個 primitive（共用頂點），材質名字＝角色（paint、glass、trim、lamp⋯）
//     node「nose_<車頭>」＝Supra 的車頭（半邊），extras＝{ lod: 'nose', half: true, kits：哪些套件用它 }
//     node「part_<n>」＝零件（整台，不鏡射），extras＝{ lod: 'part', kits, wing, wide }：套件在 kits 裡（['*']＝都有）、尾翼是 wing（null＝不是尾翼）、寬體要開（wide）才看得到
//     （名字不用「.」：GLTFLoader 會把點拿掉；carlod.js 認 extras.lod，不認名字）
//     材質：角色固定的（paint、trim、rim⋯）顏色由 carlod.js 決定；custom 用 glb 裡的顏色、粗糙度、金屬感（extras.cc＝清漆、extras.role）
import fs from 'node:fs';
import path from 'node:path';
import { MeshoptSimplifier as MS } from 'meshoptimizer';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import { serve, browser, DIR } from './lod-serve.mjs';

const ALL = ['supra', 'gtr', 'gc8', 'yaris', 'p918', 'sp3', 'jesko'];
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const KEYS = (process.argv.slice(2).find((s) => !s.startsWith('--')) || ALL.join(',')).split(',');
const HALF = +arg('half', 9000); // 半邊車身（含車頭）目標三角形數
const PART_ERR = +arg('perr', 0.002); // 零件簡化誤差（公尺）
const WIDE_ERR = +arg('werr', 0.004); // 寬體葉子板（大片、平順）
const BLUR = 0.005; // 遮罩模糊（公尺，高斯 σ）
const MATTE_ERR = +arg('merr', 0.012); // 輪拱內、車底先簡化的誤差（公尺）
const CACHE = path.join(DIR, 'lod3d');
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(path.join(DIR, 'art'), { recursive: true });

// ---------- 1. 烘焙 ----------
const need = KEYS.filter((k) => process.argv.includes('--rebake') || !fs.existsSync(path.join(CACHE, `bake-${k}.json`)));
if (need.length) {
  const srv = await serve(), b = await browser(), p = await b.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto(srv.url + '/lod-bake.html');
  await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  for (const k of need) {
    const t0 = Date.now();
    const r = await p.evaluate((key) => window.bake(key), k);
    fs.writeFileSync(path.join(CACHE, `bake-${k}.json`), JSON.stringify(r));
    console.log(`bake ${k}: ${((Date.now() - t0) / 1000).toFixed(1)} s, ${r.parts.length} parts`);
  }
  await b.close(); srv.close();
}
await MS.ready;

// ---------- 小工具 ----------
const f32 = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
const u32 = (s) => { const b = Buffer.from(s, 'base64'); return new Uint32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hex2lin = (h) => [1, 3, 5].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

// ---------- 2. 遮罩：解開、模糊、雙線性取樣（跟 GPU 的 texture2D 一樣：v=0 在第 0 列、邊緣 clamp）----------
function maskTex(t, span) {
  const raw = Buffer.from(t.data, 'base64'), w = t.w, h = t.h, n = w * h;
  const sig = BLUR / (span / w), R = Math.ceil(sig * 3), K = [];
  for (let i = -R; i <= R; i++) K.push(Math.exp((-i * i) / (2 * sig * sig)));
  const ks = K.reduce((a, b) => a + b, 0); for (let i = 0; i < K.length; i++) K[i] /= ks;
  const ch = [0, 1, 2, 3].map((c) => {
    const a = new Float32Array(n), tmp = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = raw[i * 4 + c] / 255;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -R; k <= R; k++) s += K[k + R] * a[y * w + Math.min(w - 1, Math.max(0, x + k))]; tmp[y * w + x] = s; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -R; k <= R; k++) s += K[k + R] * tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x]; a[y * w + x] = s; }
    return a;
  });
  return { w, h, ch };
}
function samp(T, u, v, o) {
  const x = u * T.w - 0.5, y = v * T.h - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const X0 = Math.min(T.w - 1, Math.max(0, x0)), X1 = Math.min(T.w - 1, Math.max(0, x0 + 1)), Y0 = Math.min(T.h - 1, Math.max(0, y0)), Y1 = Math.min(T.h - 1, Math.max(0, y0 + 1));
  for (let c = 0; c < 4; c++) {
    const a = T.ch[c];
    o[c] = (a[Y0 * T.w + X0] * (1 - fx) + a[Y0 * T.w + X1] * fx) * (1 - fy) + (a[Y1 * T.w + X0] * (1 - fx) + a[Y1 * T.w + X1] * fx) * fy;
  }
  return o;
}

// ---------- 分類（照 masks.js patchPaint；漆面以外的東西依序蓋上去，取「最後顏色裡佔最多」的那一個）----------
// chrome＝低的鍍鉻（y＜LOW_LAMP：霧燈框、中冷器、下巴的亮條）：跟 lamp 一樣的材質，只是開大燈的時候不亮
export const BODY_CLS = ['paint', 'glass', 'trim', 'matte', 'lamp', 'lens', 'wire', 'amber', 'red', 'rev', 'chrome'];
const GLASS = 1, LAMP = 4, LENS = 5, WIRE = 6, CHROME = 10, ORDER = [2, 3, 4, 5, 6, 7, 8, 9]; // trim, matte, lamp, lens, wire, amber, red, rev（跟 shader 的 mix 順序一樣）
const LOW_LAMP = 0.48, WIRE_MIN = 0.08;
// cls(x, y, z, nx, ny, nz) → 分類；cls.at＝最後一次的細節：a＝前面投影圖的 alpha（燈裡暗玻璃的比例）、wire＝模糊後網子的覆蓋率
function classifier(M, U) {
  const S = [0, 0, 0, 0], Tp = [0, 0, 0, 0], F = [0, 0, 0, 0], Rr = [0, 0, 0, 0], w = new Float32Array(10), at = { a: 0, wire: 0 };
  const wr = U.uWellR ?? U.uWell, wf = U.uWell;
  const cls = (x, y, z, nx, ny, nz) => {
    at.a = 0; at.wire = 0;
    const sf = ss(0.35, 0.55, Math.abs(nz));
    samp(M.side, (x + 2.35) / 4.7, y / 1.4, S); samp(M.top, (x + 2.35) / 4.7, (z + 1) / 2, Tp);
    const hi = y >= U.uGlassY ? 1 : 0;
    const glass = Math.max(S[0] * sf, Tp[3] * (1 - sf) * hi), blk = Math.max(S[1] * sf, Tp[1] * (1 - sf) * hi);
    if (glass > 0.5 && blk < 0.5) return GLASS;
    let blackG = S[1] * sf, lamp = 0, lens = 0, wire = 0, amber = 0, red = 0, rev = 0, matte = 0;
    const fW = ss(U.uFx[0], U.uFx[1], x) * ss(-0.35, 0.1, nx) * (1 - ss(0.82, 0.95, ny));
    if (fW > 0) {
      samp(M.front, (1 - z) / 2, y / 1.3, F);
      lamp = F[0] * fW; lens = F[3] * F[0] * fW; wire = F[3] * (1 - F[0]) * fW * ss(0.3, 0.7, nx); amber = F[2] * fW; blackG = Math.max(blackG, F[1] * fW * (1 - F[0]));
      at.a = F[3]; at.wire = F[3] * (1 - F[0]);
    }
    const rW = (1 - ss(U.uRx[1], U.uRx[0], x)) * (1 - ss(-0.1, 0.35, nx));
    if (rW > 0) { samp(M.rear, (z + 1) / 2, y / 1.3, Rr); red = Rr[0] * rW * (1 - Rr[1]); rev = Rr[2] * rW; blackG = Math.max(blackG, Rr[1] * rW); }
    const tW = ss(0.25, 0.5, ny);
    matte = Math.max(matte, Tp[0] * tW); blackG = Math.max(blackG, Tp[1] * tW * (1 - sf));
    let well = Math.max((Math.hypot(x - U.uXr, y - wr[0]) <= wr[1] && Math.abs(z) <= wr[2]) ? 1 : 0, (Math.hypot(x - U.uXf, y - wf[0]) <= wf[1] && Math.abs(z) <= wf[2]) ? 1 : 0);
    if (ny > 0.35) well = 0;
    const under = ny <= -0.6 && y <= 0.3 ? 1 : 0;
    matte = Math.max(matte, well, under);
    if (wire > WIRE_MIN) wire = 1; // 網子是很細的格子：模糊後只剩 1～5 成，當成整片「網子」（顏色用這台車網子的平均覆蓋率，見 mixes）
    w[2] = blackG; w[3] = matte; w[4] = lamp; w[5] = lens; w[6] = wire; w[7] = amber; w[8] = red; w[9] = rev;
    let keep = 1, bc = 0, bv = 0; // 從最後蓋上去的往前算：這一層佔 w×（後面每一層的 1−w），車漆佔剩下的
    for (let i = ORDER.length - 1; i >= 0; i--) { const c = ORDER[i], v = w[c] * keep; if (v > bv) { bv = v; bc = c; } keep *= 1 - w[c]; }
    const c = keep >= bv ? 0 : bc;
    return c === LAMP && y < LOW_LAMP ? CHROME : c;
  };
  cls.at = at;
  return cls;
}
// 燈裡暗玻璃的比例、網子覆蓋率：切好的網格上 lens／wire 那些三角形（面積加權）的平均 → glb 材質 extras.mix（carlod.js 照它混顏色）
function mixes(cut, cls, acc) {
  const P = cut.P, N = cut.N;
  for (let t = 0; t < cut.I.length; t += 3) {
    const c = cut.C[cut.I[t]];
    if (c !== LENS && c !== WIRE) continue;
    const a = cut.I[t] * 3, b = cut.I[t + 1] * 3, d = cut.I[t + 2] * 3, g = [0, 1, 2].map((k) => (P[a + k] + P[b + k] + P[d + k]) / 3), n = [0, 1, 2].map((k) => N[a + k] + N[b + k] + N[d + k]);
    const e1 = [0, 1, 2].map((k) => P[b + k] - P[a + k]), e2 = [0, 1, 2].map((k) => P[d + k] - P[a + k]);
    const area = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2, nl = Math.hypot(...n) || 1;
    cls(g[0], g[1], g[2], n[0] / nl, n[1] / nl, n[2] / nl);
    const A = acc[c === LENS ? 'lens' : 'wire'];
    A[0] += area * (c === LENS ? cls.at.a : cls.at.wire); A[1] += area;
  }
}

// ---------- 沿著分類的邊界切三角形 ----------
// 每條「兩端不同類」的邊用二分法找交界點（方向照位置排序，兩個網格共用的邊會切在同一點）；交界點每個分類各一個頂點（seam）
function cutByClass(P, N, I, cls) {
  const nv = P.length / 3;
  const C = new Int8Array(nv);
  for (let i = 0; i < nv; i++) C[i] = cls(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
  const op = Array.from(P), on = Array.from(N), oc = Array.from(C), oi = [];
  const lex = (a, b) => { for (let k = 0; k < 3; k++) { const d = P[a * 3 + k] - P[b * 3 + k]; if (d) return d < 0; } return a < b; };
  const cross = new Map(), inst = new Map();
  const at = (a, b, t, o) => { // 邊上 t 的位置、法線
    for (let k = 0; k < 3; k++) o[k] = P[a * 3 + k] + (P[b * 3 + k] - P[a * 3 + k]) * t;
    let l = 0; for (let k = 0; k < 3; k++) { o[3 + k] = N[a * 3 + k] + (N[b * 3 + k] - N[a * 3 + k]) * t; l += o[3 + k] ** 2; }
    l = Math.sqrt(l) || 1; for (let k = 3; k < 6; k++) o[k] /= l; return o;
  };
  const tmp = new Float64Array(6);
  function edge(a, b) {
    const key = a < b ? a * nv + b : b * nv + a;
    let e = cross.get(key); if (e) return e;
    const [s, t] = lex(a, b) ? [a, b] : [b, a], cs = C[s];
    let lo = 0, hi = 1;
    for (let it = 0; it < 10; it++) { const m = (lo + hi) / 2; at(s, t, m, tmp); if (cls(tmp[0], tmp[1], tmp[2], tmp[3], tmp[4], tmp[5]) === cs) lo = m; else hi = m; }
    e = { key, v: Array.from(at(s, t, (lo + hi) / 2, new Float64Array(6))) };
    cross.set(key, e); return e;
  }
  function vid(e, c) { // 交界點在分類 c 那邊的頂點
    const k = e.key * 16 + c; let v = inst.get(k);
    if (v === undefined) { v = oc.length; op.push(e.v[0], e.v[1], e.v[2]); on.push(e.v[3], e.v[4], e.v[5]); oc.push(c); inst.set(k, v); }
    return v;
  }
  let g3 = 0;
  for (let t = 0; t < I.length; t += 3) {
    let a = I[t], b = I[t + 1], c = I[t + 2];
    const ca = C[a], cb = C[b], cc = C[c];
    if (ca === cb && cb === cc) { oi.push(a, b, c); continue; }
    if (ca !== cb && cb !== cc && ca !== cc) { // 三個都不一樣：三條邊的交界點＋中心點，切成三個四邊形
      const ab = edge(a, b), bc = edge(b, c), ca_ = edge(c, a);
      const gp = [0, 1, 2].map((k) => (P[a * 3 + k] + P[b * 3 + k] + P[c * 3 + k]) / 3), gn = [0, 1, 2].map((k) => N[a * 3 + k] + N[b * 3 + k] + N[c * 3 + k]);
      const gl = Math.hypot(...gn) || 1, G = { key: -(++g3), v: [...gp, ...gn.map((v) => v / gl)] };
      for (const [v0, X0, X1, cl] of [[a, ab, ca_, ca], [b, bc, ab, cb], [c, ca_, bc, cc]]) {
        const p = vid(X0, cl), q = vid(G, cl), r = vid(X1, cl);
        oi.push(v0, p, q, v0, q, r);
      }
      continue;
    }
    // 兩個一樣：轉到 (a, b) 一樣、c 不一樣
    if (ca === cc) [a, b, c] = [c, a, b]; else if (cb === cc) [a, b, c] = [b, c, a];
    const A = C[a], Cc = C[c], xbc = edge(b, c), xca = edge(c, a);
    oi.push(vid(xbc, Cc), c, vid(xca, Cc)); // c 那一角
    const pb = vid(xbc, A), pa = vid(xca, A);
    oi.push(a, b, pb, a, pb, pa); // a、b 那一塊
  }
  return { P: new Float32Array(op), N: new Float32Array(on), C: Int8Array.from(oc), I: new Uint32Array(oi) };
}

// ---------- 簡化＋整理 ----------
// pre：先把看不太到的分類（輪拱內、車底＝消光）自己簡化一次（邊界鎖住），整台再一起簡化到 target
function simplify(M, target, lockFn, { attrW = 0.4, pre = [] } = {}) {
  const nv = M.P.length / 3;
  let I = M.I;
  for (const { cls, err } of pre) {
    const mine = [], rest = [];
    for (let t = 0; t < I.length; t += 3) (M.C[I[t]] === cls ? mine : rest).push(I[t], I[t + 1], I[t + 2]);
    if (!mine.length) continue;
    const [s] = MS.simplify(new Uint32Array(mine), M.P, 3, 0, err, ['LockBorder', 'Sparse', 'ErrorAbsolute']);
    I = new Uint32Array([...rest, ...s]);
  }
  const lock = new Uint8Array(nv);
  if (lockFn) for (let i = 0; i < nv; i++) lock[i] = lockFn(M.P[i * 3], M.P[i * 3 + 1], M.P[i * 3 + 2]) ? 1 : 0;
  const [idx, err] = MS.simplifyWithAttributes(I, M.P, 3, M.N, 3, [attrW, attrW, attrW], lockFn ? lock : null, Math.min(I.length, target * 3), 0.08, []);
  return { ...compact({ ...M, I: idx }), err };
}
function compact(M) { // 只留用到的頂點
  const nv = M.P.length / 3, map = new Int32Array(nv).fill(-1);
  const P = [], N = [], C = [], I = new Uint32Array(M.I.length);
  for (let t = 0; t < M.I.length; t++) {
    const v = M.I[t];
    if (map[v] < 0) { map[v] = C.length; P.push(M.P[v * 3], M.P[v * 3 + 1], M.P[v * 3 + 2]); N.push(M.N[v * 3], M.N[v * 3 + 1], M.N[v * 3 + 2]); C.push(M.C ? M.C[v] : 0); }
    I[t] = map[v];
  }
  return { P: new Float32Array(P), N: new Float32Array(N), C: Int8Array.from(C), I };
}
// 三角形湯 → 焊接：同一個位置（0.01 mm）的角，面法線夾角小於 ang 的併成一個頂點（法線＝面積加權平均），稜角兩邊分開（變成 seam，簡化時保持利的）
// （ExtrudeGeometry 這些都是每個面各自的頂點；照原本的法線焊幾乎焊不起來）
function weld(P, N, ang = 40) {
  const nt = P.length / 9, cosA = Math.cos((ang * Math.PI) / 180);
  const fn = new Float32Array(nt * 3), ok = new Uint8Array(nt);
  for (let t = 0; t < nt; t++) {
    const o = t * 9, ax = P[o + 3] - P[o], ay = P[o + 4] - P[o + 1], az = P[o + 5] - P[o + 2], bx = P[o + 6] - P[o], by = P[o + 7] - P[o + 1], bz = P[o + 8] - P[o + 2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx, l = Math.hypot(cx, cy, cz);
    if (l < 1e-12) continue;
    ok[t] = 1; fn[t * 3] = cx; fn[t * 3 + 1] = cy; fn[t * 3 + 2] = cz; // 長度＝兩倍面積（加權用）
  }
  const groups = new Map(), corner = new Int32Array(nt * 3).fill(-1), vs = []; // vs：{ p, n（加總）, u（單位） }
  for (let t = 0; t < nt; t++) {
    if (!ok[t]) continue;
    const l = Math.hypot(fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]), ux = fn[t * 3] / l, uy = fn[t * 3 + 1] / l, uz = fn[t * 3 + 2] / l;
    for (let k = 0; k < 3; k++) {
      const i = t * 3 + k, key = Math.round(P[i * 3] * 1e5) + ',' + Math.round(P[i * 3 + 1] * 1e5) + ',' + Math.round(P[i * 3 + 2] * 1e5);
      let g = groups.get(key); if (!g) groups.set(key, (g = []));
      let v = g.find((j) => { const q = vs[j]; return q.ux * ux + q.uy * uy + q.uz * uz > cosA; });
      if (v === undefined) { v = vs.length; vs.push({ x: P[i * 3], y: P[i * 3 + 1], z: P[i * 3 + 2], nx: 0, ny: 0, nz: 0, ux, uy, uz }); g.push(v); }
      const q = vs[v]; q.nx += fn[t * 3]; q.ny += fn[t * 3 + 1]; q.nz += fn[t * 3 + 2];
      corner[i] = v;
    }
  }
  const op = new Float32Array(vs.length * 3), on = new Float32Array(vs.length * 3);
  vs.forEach((q, i) => { const l = Math.hypot(q.nx, q.ny, q.nz) || 1; op.set([q.x, q.y, q.z], i * 3); on.set([q.nx / l, q.ny / l, q.nz / l], i * 3); });
  const J = [];
  for (let t = 0; t < nt; t++) { const a = corner[t * 3], b = corner[t * 3 + 1], c = corner[t * 3 + 2]; if (a >= 0 && a !== b && b !== c && a !== c) J.push(a, b, c); }
  return { P: op, N: on, I: new Uint32Array(J) };
}

// ---------- glb ----------
function writer() {
  const doc = new Document(), buf = doc.createBuffer(), scene = doc.createScene('lod');
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  const mats = new Map();
  const material = (role, m, more) => { // more：多的 extras（lens、wire 的 mix）
    const key = role === 'custom' ? role + JSON.stringify(m) : role;
    if (mats.has(key)) return mats.get(key);
    const x = doc.createMaterial(role).setExtras({ role, cc: m?.clearcoat ?? 0, ...(more || {}) });
    if (m) x.setBaseColorFactor([...hex2lin(m.color), 1]).setRoughnessFactor(m.roughness).setMetallicFactor(m.metalness).setEmissiveFactor(hex2lin(m.emissive).map((v) => v * (m.ei ?? 1)));
    if (m && role === 'custom' && m.opacity < 1) x.setAlpha(m.opacity);
    mats.set(key, x); return x;
  };
  // 一個 node：共用頂點（量化成 int16／int8），每個 list 一個 primitive
  const add = (name, P, N, lists, extras) => {
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); }
    const c = lo.map((v, k) => (v + hi[k]) / 2), h = Math.max(...lo.map((v, k) => (hi[k] - v) / 2), 1e-4);
    const qp = new Int16Array(P.length), qn = new Int8Array(N.length);
    for (let i = 0; i < P.length; i++) { qp[i] = Math.round(((P[i] - c[i % 3]) / h) * 32767); qn[i] = Math.round(Math.max(-1, Math.min(1, N[i])) * 127); }
    const pa = doc.createAccessor().setType('VEC3').setArray(qp).setNormalized(true).setBuffer(buf);
    const na = doc.createAccessor().setType('VEC3').setArray(qn).setNormalized(true).setBuffer(buf);
    const mesh = doc.createMesh(name);
    for (const L of lists) {
      if (!L.idx.length) continue;
      const ia = doc.createAccessor().setType('SCALAR').setArray(P.length / 3 < 65536 ? new Uint16Array(L.idx) : new Uint32Array(L.idx)).setBuffer(buf);
      mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION', pa).setAttribute('NORMAL', na).setIndices(ia).setMaterial(material(L.role, L.mat, L.x)));
    }
    const node = doc.createNode(name).setMesh(mesh).setTranslation(c).setScale([h, h, h]);
    if (extras) node.setExtras(extras);
    scene.addChild(node);
  };
  return { doc, add, write: () => new NodeIO().registerExtensions([KHRMeshQuantization]).writeBinary(doc) };
}

// ---------- 每台車 ----------
const report = (() => { try { return JSON.parse(fs.readFileSync(path.join(CACHE, 'report.json'), 'utf8')); } catch { return {}; } })(); // 只做幾台的時候，其他台的數字留著
for (const key of KEYS) {
  const t0 = Date.now();
  const B = JSON.parse(fs.readFileSync(path.join(CACHE, `bake-${key}.json`), 'utf8'));
  const M = { side: maskTex(B.masks.side, 4.7), top: maskTex(B.masks.top, 4.7), rear: maskTex(B.masks.rear, 2) };
  const fronts = Object.fromEntries(Object.entries(B.masks.fronts).map(([k, t]) => [k, maskTex(t, 2)]));
  const W = writer();
  const out = { body: 0, noses: {}, parts: {} };
  // 車身（和車頭）：分類 → 切 → 簡化
  const pieces = [['body', B.body, fronts[B.noseOfKit[B.kit]] || fronts.base || Object.values(fronts)[0]]];
  for (const [k, g] of Object.entries(B.noses)) pieces.push(['nose_' + k, g, fronts[k]]);
  const seam = Object.keys(B.noses).length ? (x) => Math.abs(x - 1.5) < 2e-4 : null; // Supra 車頭和車身的接縫
  const totalIn = u32(B.body.idx).length / 3 + Math.max(0, ...Object.values(B.noses).map((g) => u32(g.idx).length / 3)); // 看得到的＝車身＋一個車頭
  const acc = { lens: [0, 0], wire: [0, 0] }, done = [];
  for (const [name, g, front] of pieces) {
    const cls = classifier({ ...M, front }, B.U);
    const cut = cutByClass(f32(g.pos), f32(g.nor), u32(g.idx), cls);
    mixes(cut, cls, acc);
    const share = u32(g.idx).length / 3 / totalIn; // 目標三角形照原本的比例分（Supra：車身＋任一個車頭 ≈ HALF）
    const s = simplify(cut, Math.round(HALF * share), seam ? (x) => seam(x) : null, { pre: [{ cls: 3, err: MATTE_ERR }] });
    done.push({ name, g, cut, s });
  }
  out.mix = { lens: acc.lens[1] ? +(acc.lens[0] / acc.lens[1]).toFixed(3) : 1, wire: acc.wire[1] ? +(acc.wire[0] / acc.wire[1]).toFixed(3) : 0.45 };
  for (const { name, g, cut, s } of done) {
    const lists = BODY_CLS.map((role) => ({ role, idx: [], x: role === 'lens' || role === 'wire' ? { mix: out.mix[role] } : null }));
    for (let t = 0; t < s.I.length; t += 3) lists[s.C[s.I[t]]].idx.push(s.I[t], s.I[t + 1], s.I[t + 2]);
    const extras = name === 'body' ? { lod: 'body', half: true } : { lod: 'nose', half: true, kits: Object.entries(B.noseOfKit).filter(([, n]) => 'nose_' + n === name).map(([k]) => k) };
    W.add(name, s.P, s.N, lists, extras);
    const n = s.I.length / 3;
    if (name === 'body') out.body = n; else out.noses[name.slice(5)] = n;
    out.classes = Object.fromEntries(lists.map((L) => [L.role, (out.classes?.[L.role] || 0) + L.idx.length / 3]));
    console.log(`  ${key} ${name}: ${u32(g.idx).length / 3} → cut ${cut.I.length / 3} → ${n} tris (err ${s.err.toExponential(2)})`);
  }
  // 零件：照可見條件分組 → 同材質合併 → 焊接 → 簡化
  const groups = new Map();
  for (const p of B.parts) {
    const gk = JSON.stringify({ kits: [...p.kits].sort(), wing: p.wing, wide: !!p.wide });
    if (!groups.has(gk)) groups.set(gk, new Map());
    const mk = p.role === 'custom' ? 'custom' + JSON.stringify(p.mat) : p.role;
    const G = groups.get(gk);
    if (!G.has(mk)) G.set(mk, { role: p.role, mat: p.mat, P: [], N: [] });
    const e = G.get(mk); e.P.push(f32(p.pos)); e.N.push(f32(p.nor));
  }
  let gi = 0;
  for (const [gk, G] of groups) {
    const cond = JSON.parse(gk), allKits = cond.kits.length === B.kits.length;
    const P = [], N = [], lists = [];
    let nIn = 0, nOut = 0;
    for (const e of G.values()) {
      const cat = (arrs) => { const n = arrs.reduce((a, x) => a + x.length, 0), o = new Float32Array(n); let k = 0; for (const x of arrs) { o.set(x, k); k += x.length; } return o; };
      const wd = weld(cat(e.P), cat(e.N));
      nIn += wd.I.length / 3;
      const [idx] = MS.simplifyWithAttributes(wd.I, wd.P, 3, wd.N, 3, [0.05, 0.05, 0.05], null, 0, cond.wide ? WIDE_ERR : PART_ERR, ['ErrorAbsolute', 'Prune']);
      const c = compact({ P: wd.P, N: wd.N, I: idx });
      const o = P.length / 3;
      P.push(...c.P); N.push(...c.N);
      lists.push({ role: e.role, mat: e.role === 'custom' || e.role === 'pipe' ? e.mat : null, idx: Array.from(c.I, (v) => v + o) });
      nOut += c.I.length / 3;
    }
    const name = `part_${gi++}`;
    W.add(name, new Float32Array(P), new Float32Array(N), lists.map((L) => (L.role === 'pipe' ? { ...L, role: 'custom' } : L)), { lod: 'part', kits: allKits ? ['*'] : cond.kits, wing: cond.wing, wide: cond.wide });
    const label = cond.wing ? 'wing:' + cond.wing + (allKits ? '' : '@' + cond.kits) : cond.wide ? 'wide' : allKits ? 'base' : 'kit:' + cond.kits;
    out.parts[label] = (out.parts[label] || 0) + nOut;
    console.log(`  ${key} ${name} ${label}: ${nIn} → ${nOut} tris (${[...G.values()].map((e) => e.role).join(',')})`);
  }
  const glb = await W.write();
  fs.writeFileSync(path.join(DIR, `body-${key}-lod.glb`), glb);
  fs.writeFileSync(path.join(DIR, 'art', `car-${key}-lod.txt`), Buffer.from(glb).toString('base64'));
  out.bytes = glb.length; out.b64 = Math.ceil(glb.length / 3) * 4; out.ms = Date.now() - t0;
  report[key] = out;
  console.log(`${key}: body-${key}-lod.glb ${(glb.length / 1024).toFixed(0)} KB (base64 ${(out.b64 / 1024).toFixed(0)} KB), body ${out.body * 2} tris full, mix ${JSON.stringify(out.mix)}, ${(out.ms / 1000).toFixed(1)} s`);
}
fs.writeFileSync(path.join(CACHE, 'report.json'), JSON.stringify(report, null, 1));
