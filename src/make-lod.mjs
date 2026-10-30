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
//     第 49 批：烘焙的車身（gc8-bake.mjs → body-<key>-q.glb，每個材質一組）不用遮罩：直接從 glb 讀，每一組就是分類（bakedHalf：沿著 z=0 切、焊接），
//     整台一起簡化（太小的碎片拿掉）；只有一邊的東西（排氣管）當零件
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

const ALL = ['supra', 'gtr', 'gc8', 'yaris', 'p918', 'sp3', 'jesko', 'rx7', 'evo', 'civic', 'laferrari', 'huayra', 'senna', 'altis', 'aventador', 'ae86', 'chiron', 'jp4', 'k2', 'p8', 'z2']; // 第 48 批：吉普車（車身是遮罩座標，B.mask）；第 51 批：K2 小越野車（也是遮罩座標）；第 53 批：P8 皮卡（也是）；第 56 批：Z2 沙灘車（公尺座標，零件很多很細）
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const KEYS = (process.argv.slice(2).find((s) => !s.startsWith('--')) || ALL.join(',')).split(',');
const HALF = +arg('half', 9000); // 半邊車身（含車頭）目標三角形數
const PART_ERR = +arg('perr', 0.002); // 零件簡化誤差（公尺）
const PART_ERR_CAR = { jp4: 0.004, k2: 0.004, p8: 0.004, z2: 0.003 }; // 第 48 批：吉普車的零件又多又大（輪弧、保桿、備胎、車底），誤差 4 公釐（沒給 --perr 的時候）
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
function classifier(M, U, low = LOW_LAMP) { // low：低的鍍鉻從多高以下（吉普車沒有：-Infinity）
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
    return c === LAMP && y < low ? CHROME : c;
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
// lockFn：(x, y, z) → 要不要鎖住，或直接給每個頂點的 Uint8Array（烘焙的車身）；flags：多的選項（烘焙的車身用 Prune：太小的碎片拿掉）
function simplify(M, target, lockFn, { attrW = 0.4, pre = [], flags = [] } = {}) {
  const nv = M.P.length / 3;
  let I = M.I;
  for (const { cls, err } of pre) {
    const mine = [], rest = [];
    for (let t = 0; t < I.length; t += 3) (M.C[I[t]] === cls ? mine : rest).push(I[t], I[t + 1], I[t + 2]);
    if (!mine.length) continue;
    const [s] = MS.simplify(new Uint32Array(mine), M.P, 3, 0, err, ['LockBorder', 'Sparse', 'ErrorAbsolute']);
    I = new Uint32Array([...rest, ...s]);
  }
  let lock = lockFn instanceof Uint8Array ? lockFn : null;
  if (lockFn && !lock) { lock = new Uint8Array(nv); for (let i = 0; i < nv; i++) lock[i] = lockFn(M.P[i * 3], M.P[i * 3 + 1], M.P[i * 3 + 2]) ? 1 : 0; }
  const [idx, err] = MS.simplifyWithAttributes(I, M.P, 3, M.N, 3, [attrW, attrW, attrW], lock, Math.min(I.length, target * 3), 0.08, flags);
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

// ---------- 第 49 批：烘焙的車身（gc8-bake.mjs → body-<key>-q.glb）：每一組（slot）自己就是分類，不用遮罩 ----------
// 車漆、玻璃、黑飾條（淺色的＝車牌，自己一個材質）、網子（黑的，當黑飾條）、消光（輪拱裡、車底）、燈（反光碗、燈泡、霧面）、方向燈、尾燈（貼圖上面灰的＝倒車燈）、亮的（不鏽鋼＝低的鍍鉻）
// 大燈罩（透明）、車內（inside）不要（輕量車沒有車內）；只有一邊的（排氣管在左後）拿出來當零件（整台、不鏡射）
// 右半邊：沿著 z=0 切（交界點左右共用、法線 z 歸零）→ 焊接（同分類、同位置、法線差不到 2° 的併起來；稜角、分類交界留著當 seam）→ 整台一起簡化
const BK_CLS = { paint: 0, glass: 1, trim: 2, net: 2, netF: 2, dark: 3, reflector: 4, bulb: 4, frost: 4, amber: 7, bright: 10 }; // tail 照貼圖分 red／rev
const BK_PLATE = BODY_CLS.length; // 車牌：custom 材質（顏色跟車庫的黑飾條頂點色一樣）
const BK_PLATE_MAT = { color: '#e8e6df', roughness: 0.5, metalness: 0.1, clearcoat: 0, emissive: '#000000', ei: 1, opacity: 1 };
const BK_ASYM = { gc8: [{ slots: ['bright', 'dark'], box: [-2.26, -1.97, 0.2, 0.31, -0.47, -0.33] }] }; // 只有一邊的東西（哪幾組、[x0, x1, y0, y1, z0, z1]）：排氣管（左後：亮的管子、裡面黑的）
const BK_TAIL_V = 0.43; // 尾燈貼圖：v＜0.43 是倒車燈（灰），以下紅（中間一條暗線）
async function bakedBuckets(file) { // glb 裡車身（part body）的每一組 → { slot, P, N, I, V（貼圖 v）, L（頂點色亮度）, Wm（頂點色紅減藍：橘色的導風口百葉，第 55 批）}（車子座標、公尺）
  const doc = await new NodeIO().registerExtensions([KHRMeshQuantization]).read(file), out = [], e = [];
  for (const nd of doc.getRoot().listNodes()) {
    const ex = nd.getExtras() || {}, mesh = nd.getMesh();
    if (!mesh || !ex.slot || ex.part !== 'body') continue;
    const m = nd.getWorldMatrix();
    for (const pr of mesh.listPrimitives()) {
      const pa = pr.getAttribute('POSITION'), na = pr.getAttribute('NORMAL'), ua = pr.getAttribute('TEXCOORD_0'), ca = pr.getAttribute('COLOR_0'), n = pa.getCount();
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), V = ua && ex.uv ? new Float32Array(n) : null, L = ca ? new Float32Array(n) : null, Wm = ca ? new Float32Array(n) : null;
      for (let i = 0; i < n; i++) {
        pa.getElement(i, e);
        for (let k = 0; k < 3; k++) P[i * 3 + k] = m[k] * e[0] + m[4 + k] * e[1] + m[8 + k] * e[2] + m[12 + k];
        na.getElement(i, e);
        const nx = m[0] * e[0] + m[4] * e[1] + m[8] * e[2], ny = m[1] * e[0] + m[5] * e[1] + m[9] * e[2], nz = m[2] * e[0] + m[6] * e[1] + m[10] * e[2], l = Math.hypot(nx, ny, nz) || 1;
        N[i * 3] = nx / l; N[i * 3 + 1] = ny / l; N[i * 3 + 2] = nz / l;
        if (V) { ua.getElement(i, e); V[i] = ex.uv[1] + ex.uv[3] * e[1]; }
        if (L) { ca.getElement(i, e); L[i] = (e[0] + e[1] + e[2]) / 3; Wm[i] = e[0] - e[2]; }
      }
      out.push({ slot: ex.slot, P, N, I: Uint32Array.from(pr.getIndices().getArray()), V, L, Wm });
    }
  }
  return out;
}
// 照每個頂點的值 F 切三角形（F＝0 那條線）：交界點照邊內插（兩個三角形共用的邊切在同一點），每一邊各一個頂點
// 回傳新的 P、N、I、F（交界點 F＝0）、C（每個頂點的分類：交界點跟那條邊一樣）和每個三角形在哪一邊 S（1：F≥0，0：F＜0）；keep：只要那一邊（null＝兩邊都要）
function splitBy(P, N, I, F, keep = null, C = null) {
  const op = Array.from(P), on = Array.from(N), of = Array.from(F), oc = C ? Array.from(C) : null, oi = [], os = [], pts = new Map(), ids = new Map();
  const vid = (a, b, s) => { // 邊 a–b 上 F＝0 的點，s 那一邊的頂點
    const [p, q] = a < b ? [a, b] : [b, a], key = p * 2 ** 21 + q;
    let id = ids.get(key * 2 + s);
    if (id !== undefined) return id;
    let pt = pts.get(key);
    if (!pt) {
      const t = F[p] / (F[p] - F[q]), n = [0, 1, 2].map((k) => N[p * 3 + k] + (N[q * 3 + k] - N[p * 3 + k]) * t), l = Math.hypot(...n) || 1;
      pts.set(key, (pt = [...[0, 1, 2].map((k) => P[p * 3 + k] + (P[q * 3 + k] - P[p * 3 + k]) * t), ...n.map((v) => v / l)]));
    }
    id = of.length; op.push(pt[0], pt[1], pt[2]); on.push(pt[3], pt[4], pt[5]); of.push(0); if (oc) oc.push(C[p]); ids.set(key * 2 + s, id);
    return id;
  };
  const put = (s, a, b, c) => { if (keep === null || keep === s) { oi.push(a, b, c); os.push(s); } };
  for (let t = 0; t < I.length; t += 3) {
    const v = [I[t], I[t + 1], I[t + 2]], s = v.map((i) => (F[i] >= 0 ? 1 : 0));
    if (s[0] === s[1] && s[1] === s[2]) { put(s[0], v[0], v[1], v[2]); continue; }
    const j = s[0] !== s[1] && s[0] !== s[2] ? 0 : s[1] !== s[0] && s[1] !== s[2] ? 1 : 2; // 自己一邊的那個角
    const a = v[j], b = v[(j + 1) % 3], c = v[(j + 2) % 3], sa = s[j], sb = 1 - sa;
    put(sa, a, vid(a, b, sa), vid(c, a, sa));
    const pb = vid(a, b, sb), pc = vid(c, a, sb);
    put(sb, pb, b, c); put(sb, pb, c, pc);
  }
  return { P: new Float32Array(op), N: new Float32Array(on), F: Float32Array.from(of), C: oc ? Int8Array.from(oc) : null, I: new Uint32Array(oi), S: Uint8Array.from(os) };
}
// 有索引的網格焊接：同分類、同位置（0.01 mm）、法線差不到 ang 度的頂點併成一個（貼圖接縫拆開的頂點；稜角留著）
function weldIdx(P, N, C, I, ang = 2) {
  const nv = C.length, cosA = Math.cos((ang * Math.PI) / 180), map = new Int32Array(nv), groups = new Map(), keepV = [];
  for (let i = 0; i < nv; i++) {
    const key = C[i] + ':' + Math.round(P[i * 3] * 1e5) + ',' + Math.round(P[i * 3 + 1] * 1e5) + ',' + Math.round(P[i * 3 + 2] * 1e5);
    let g = groups.get(key); if (!g) groups.set(key, (g = []));
    const j = g.find((k) => N[k * 3] * N[i * 3] + N[k * 3 + 1] * N[i * 3 + 1] + N[k * 3 + 2] * N[i * 3 + 2] > cosA);
    if (j === undefined) { g.push(i); map[i] = i; keepV.push(i); } else map[i] = j;
  }
  const J = [];
  for (let t = 0; t < I.length; t += 3) { const a = map[I[t]], b = map[I[t + 1]], c = map[I[t + 2]]; if (a !== b && b !== c && a !== c) J.push(a, b, c); }
  return compact({ P, N, C, I: new Uint32Array(J) });
}
// 燈罩（車庫是雙面的材質，有的做反了：尾燈朝車裡面）：每一塊（照位置連起來的）跟最近的車漆比，大部分朝裡面就整塊翻過來（輕量車的背面是車內的暗灰）
const BK_FLIP = ['tail', 'amber', 'reflector', 'frost'];
function bakedFlip(b, paint) {
  const n = b.N.length / 3, key = (i) => Math.round(b.P[i * 3] * 1e5) + ',' + Math.round(b.P[i * 3 + 1] * 1e5) + ',' + Math.round(b.P[i * 3 + 2] * 1e5);
  const par = new Int32Array(n).map((_, i) => i), first = new Map(), f = (x) => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  for (let i = 0; i < n; i++) { const k = key(i); if (first.has(k)) par[f(i)] = f(first.get(k)); else first.set(k, i); }
  for (let t = 0; t < b.I.length; t += 3) { const a = f(b.I[t]); par[f(b.I[t + 1])] = a; par[f(b.I[t + 2])] = f(a); }
  const vote = new Map(); // 那一塊 → [跟車漆同一邊的, 全部]
  for (let t = 0; t < b.I.length; t += 3) {
    const [a, c, d] = [b.I[t], b.I[t + 1], b.I[t + 2]], g = [0, 1, 2].map((k) => (b.P[a * 3 + k] + b.P[c * 3 + k] + b.P[d * 3 + k]) / 3);
    const u = [0, 1, 2].map((k) => b.P[c * 3 + k] - b.P[a * 3 + k]), w = [0, 1, 2].map((k) => b.P[d * 3 + k] - b.P[a * 3 + k]);
    const fn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], pn = paint(g);
    const r = f(a), v = vote.get(r) || [0, 0]; if (pn && fn[0] * pn[0] + fn[1] * pn[1] + fn[2] * pn[2] > 0) v[0]++; v[1]++; vote.set(r, v);
  }
  const flip = new Set([...vote].filter(([, v]) => v[0] < 0.3 * v[1]).map(([r]) => r));
  if (!flip.size) return b;
  const I = Uint32Array.from(b.I), N = Float32Array.from(b.N);
  for (let t = 0; t < I.length; t += 3) if (flip.has(f(I[t]))) { const x = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = x; }
  for (let i = 0; i < n; i++) if (flip.has(f(i))) for (let k = 0; k < 3; k++) N[i * 3 + k] = -N[i * 3 + k];
  return { ...b, I, N };
}
// 最近的車漆頂點的法線（5 公分一格，找旁邊 ±2 格）
function paintNear(buckets) {
  const G = new Map(), C = 0.05, ck = (x, y, z) => x * 1e6 + y * 1e3 + z;
  for (const b of buckets) if (b.slot === 'paint') for (let i = 0; i < b.N.length / 3; i++) {
    const k = ck(...[0, 1, 2].map((j) => Math.floor(b.P[i * 3 + j] / C) + 100)); let L = G.get(k); if (!L) G.set(k, (L = [])); L.push(b, i);
  }
  return (p) => {
    const c = p.map((v) => Math.floor(v / C) + 100); let best = null, bd = 1e9;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
      const L = G.get(ck(c[0] + dx, c[1] + dy, c[2] + dz)); if (!L) continue;
      for (let j = 0; j < L.length; j += 2) { const b = L[j], i = L[j + 1], d = (b.P[i * 3] - p[0]) ** 2 + (b.P[i * 3 + 1] - p[1]) ** 2 + (b.P[i * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = [b.N[i * 3], b.N[i * 3 + 1], b.N[i * 3 + 2]]; } }
    }
    return best;
  };
}
// 右半邊車身 → { M（P、N、C、I，已焊接）, lock（z=0 上要鎖住的頂點）, asym（只有一邊的三角形：{ cls, P（湯）, N } 的陣列）}
function bakedHalf(buckets, key) {
  const P = [], N = [], C = [], I = [], asym = [], boxes = BK_ASYM[key] || [], paint = paintNear(buckets);
  const inBox = (slot, x, y, z) => boxes.some(({ slots, box: [x0, x1, y0, y1, z0, z1] }) => slots.includes(slot) && x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1);
  for (let b of buckets) {
    if (BK_FLIP.includes(b.slot)) b = bakedFlip(b, paint);
    let TC; // 每個三角形的分類
    if (b.slot === 'tail') { // 尾燈：照貼圖的 v 切成倒車燈、紅的
      const s = splitBy(b.P, b.N, b.I, b.V.map((v) => v - BK_TAIL_V));
      b = { ...b, P: s.P, N: s.N, I: s.I }; TC = Array.from(s.S, (x) => (x ? 8 : 9));
    } else if (b.slot === 'plate') TC = Array.from({ length: b.I.length / 3 }, () => BK_PLATE); // 第 54 批：車牌自己一組（有號碼的貼圖；輕量車還是淺色的板子）
    else if (BK_CLS[b.slot] === undefined) continue; // 大燈罩、車內、車底、除霧線（第 54 批）
    else TC = Array.from({ length: b.I.length / 3 }, (_, t) => { const avg = (A) => (A[b.I[t * 3]] + A[b.I[t * 3 + 1]] + A[b.I[t * 3 + 2]]) / 3; return b.slot === 'trim' && b.L ? (avg(b.Wm) > 0.2 ? BK_CLS.amber : avg(b.L) > 0.3 ? BK_PLATE : BK_CLS.trim) : BK_CLS[b.slot]; }); // 以前的車牌在飾條裡（淺色）；第 55 批：橘色的（導風口的百葉）算方向燈那一類
    const map = new Map(); // (頂點, 分類) → 新的頂點：一個頂點只能有一個分類（交界的頂點分開，簡化的時候是 seam）
    const vid = (i, c) => { const k = i * 16 + c; let v = map.get(k); if (v === undefined) { v = C.length; map.set(k, v); P.push(b.P[i * 3], b.P[i * 3 + 1], b.P[i * 3 + 2]); N.push(b.N[i * 3], b.N[i * 3 + 1], b.N[i * 3 + 2]); C.push(c); } return v; };
    for (let t = 0; t < b.I.length; t += 3) {
      const c = TC[t / 3], v = [b.I[t], b.I[t + 1], b.I[t + 2]], g = [0, 1, 2].map((k) => (b.P[v[0] * 3 + k] + b.P[v[1] * 3 + k] + b.P[v[2] * 3 + k]) / 3);
      if (inBox(b.slot, g[0], g[1], g[2])) { asym.push({ cls: c, P: v.flatMap((i) => [b.P[i * 3], b.P[i * 3 + 1], b.P[i * 3 + 2]]), N: v.flatMap((i) => [b.N[i * 3], b.N[i * 3 + 1], b.N[i * 3 + 2]]) }); continue; }
      I.push(vid(v[0], c), vid(v[1], c), vid(v[2], c));
    }
  }
  // 沿著 z=0 切，留右邊（z≥0）；切出來的頂點 z 剛好 0、法線沒有 z（左右鏡射接起來是平順的；本來就很斜的不動：中間的稜線）
  const Z = new Float32Array(C.length);
  for (let i = 0; i < C.length; i++) Z[i] = P[i * 3 + 2];
  const sp = splitBy(new Float32Array(P), new Float32Array(N), new Uint32Array(I), Z, 1, Int8Array.from(C));
  for (let i = 0; i < sp.F.length; i++) if (Math.abs(sp.P[i * 3 + 2]) < 1e-6) {
    sp.P[i * 3 + 2] = 0;
    if (Math.abs(sp.N[i * 3 + 2]) < 0.35) { sp.N[i * 3 + 2] = 0; const l = Math.hypot(sp.N[i * 3], sp.N[i * 3 + 1]) || 1; sp.N[i * 3] /= l; sp.N[i * 3 + 1] /= l; }
  }
  const M = weldIdx(sp.P, sp.N, sp.C, sp.I);
  // 要鎖住的：z=0 上、有一條開放的邊接到不在 z=0 的頂點（邊界在這裡轉彎離開中線），或同一個位置還有別的頂點（分類交界、稜角跨過中線）
  const nv = M.C.length, lock = new Uint8Array(nv), ec = new Map(), at = new Map();
  for (let t = 0; t < M.I.length; t += 3) for (let k = 0; k < 3; k++) { const a = M.I[t + k], b = M.I[t + (k + 1) % 3], key = a < b ? a * nv + b : b * nv + a; ec.set(key, (ec.get(key) || 0) + 1); }
  const on = (i) => M.P[i * 3 + 2] === 0;
  for (const [key, n] of ec) { if (n !== 1) continue; const a = Math.floor(key / nv), b = key % nv; if (on(a) && !on(b)) lock[a] = 1; if (on(b) && !on(a)) lock[b] = 1; }
  for (let i = 0; i < nv; i++) if (on(i)) { const k = Math.round(M.P[i * 3] * 1e5) + ',' + Math.round(M.P[i * 3 + 1] * 1e5); at.set(k, (at.get(k) || 0) + 1); }
  for (let i = 0; i < nv; i++) if (on(i) && at.get(Math.round(M.P[i * 3] * 1e5) + ',' + Math.round(M.P[i * 3 + 1] * 1e5)) > 1) lock[i] = 1;
  return { M, lock, asym };
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
  const W = writer();
  const out = { body: 0, noses: {}, parts: {} };
  if (B.baked) { // 第 49 批：烘焙的車身（gc8-bake.mjs）：每一組就是分類 → 右半邊 → 整台一起簡化（太小的碎片拿掉）
    const { M: H, lock, asym } = bakedHalf(await bakedBuckets(path.join(DIR, B.glb)), key);
    const s = simplify(H, HALF, lock, { pre: [{ cls: 3, err: MATTE_ERR }], flags: ['Prune'] });
    out.mix = { lens: 1, wire: 0.45 }; // 沒有燈裡的暗玻璃、網子（網子是黑的，當黑飾條）
    const lists = [...BODY_CLS.map((role) => ({ role, idx: [], x: role === 'lens' || role === 'wire' ? { mix: out.mix[role] } : null })), { role: 'custom', mat: BK_PLATE_MAT, idx: [] }];
    for (let t = 0; t < s.I.length; t += 3) lists[s.C[s.I[t]]].idx.push(s.I[t], s.I[t + 1], s.I[t + 2]);
    W.add('body', s.P, s.N, lists, { lod: 'body', half: true });
    out.body = s.I.length / 3;
    out.classes = Object.fromEntries(lists.map((L) => [L.role === 'custom' ? 'plate' : L.role, L.idx.length / 3]));
    console.log(`  ${key} body（烘焙）: 右半邊 ${H.I.length / 3}（鎖住 ${lock.reduce((a, v) => a + v, 0)} 個頂點）→ ${out.body} tris (err ${s.err.toExponential(2)})`);
    const by = new Map(); // 只有一邊的（排氣管）：照分類併起來，當整台都有的零件
    for (const a of asym) { if (!by.has(a.cls)) by.set(a.cls, { P: [], N: [] }); by.get(a.cls).P.push(...a.P); by.get(a.cls).N.push(...a.N); }
    const b64f = (a) => Buffer.from(new Float32Array(a).buffer).toString('base64');
    for (const [c, e] of by) B.parts.push({ role: c === BK_PLATE ? 'custom' : BODY_CLS[c], mat: c === BK_PLATE ? BK_PLATE_MAT : null, kits: B.kits, wing: null, wide: false, name: 'asym', pos: b64f(e.P), nor: b64f(e.N) });
  } else {
    const M = { side: maskTex(B.masks.side, 4.7), top: maskTex(B.masks.top, 4.7), rear: maskTex(B.masks.rear, 2) };
    const fronts = Object.fromEntries(Object.entries(B.masks.fronts).map(([k, t]) => [k, maskTex(t, 2)]));
    // 車身（和車頭）：分類 → 切 → 簡化
    const pieces = [['body', B.body, fronts[B.noseOfKit[B.kit]] || fronts.base || Object.values(fronts)[0]]];
    for (const [k, g] of Object.entries(B.noses)) pieces.push(['nose_' + k, g, fronts[k]]);
    const seam = Object.keys(B.noses).length ? (x) => Math.abs(x - 1.5) < 2e-4 : null; // Supra 車頭和車身的接縫
    const totalIn = u32(B.body.idx).length / 3 + Math.max(0, ...Object.values(B.noses).map((g) => u32(g.idx).length / 3)); // 看得到的＝車身＋一個車頭
    const acc = { lens: [0, 0], wire: [0, 0] }, done = [];
    for (const [name, g, front] of pieces) {
      const cls = classifier({ ...M, front }, B.U, B.mask ? -Infinity : LOW_LAMP); // 吉普車：大燈的下半圈在遮罩座標 0.48 以下，不能當成低的鍍鉻（晚上會不亮）
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
      if (B.mask) { // 第 48 批：吉普車的車身是遮罩座標（xm＝(x−X0)·S、ym＝(y−Y0)·S、zm＝z·S；jp4-look.js JP4_M）：分類、切、簡化都做完了，換成公尺（法線不變）
        const { S: k, X0, Y0 } = B.mask, P = s.P;
        for (let i = 0; i < P.length; i += 3) { P[i] = P[i] / k + X0; P[i + 1] = P[i + 1] / k + Y0; P[i + 2] = P[i + 2] / k; }
      }
      const extras = name === 'body' ? { lod: 'body', half: true } : { lod: 'nose', half: true, kits: Object.entries(B.noseOfKit).filter(([, n]) => 'nose_' + n === name).map(([k]) => k) };
      W.add(name, s.P, s.N, lists, extras);
      const n = s.I.length / 3;
      if (name === 'body') out.body = n; else out.noses[name.slice(5)] = n;
      out.classes = Object.fromEntries(lists.map((L) => [L.role, (out.classes?.[L.role] || 0) + L.idx.length / 3]));
      console.log(`  ${key} ${name}: ${u32(g.idx).length / 3} → cut ${cut.I.length / 3} → ${n} tris (err ${s.err.toExponential(2)})`);
    }
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
      const [idx] = MS.simplifyWithAttributes(wd.I, wd.P, 3, wd.N, 3, [0.05, 0.05, 0.05], null, 0, cond.wide ? WIDE_ERR : (arg('perr') ? PART_ERR : PART_ERR_CAR[key] ?? PART_ERR), ['ErrorAbsolute', 'Prune']);
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
