// 第 92 批：遠的車（停車場、休息站停著的車）一台約 300～350 個三角形的簡單樣子：照輕量車（body-<車>-lod.glb）簡化
// Nick 2026-11-15「車子不要靠近才變出來」：以前遠的車是一個方塊（每台一樣的形狀，靠近 26 公尺才換成真的輕量車＝看起來是突然變出來）；
//   現在遠的就是那台車自己的樣子（車頭、擋風玻璃、車頂、尾巴、輪子），走近換成輕量車幾乎看不出來
// 用法：node make-far.mjs [gc8,supra,...]   → farcars.js（自動產生，不要手改）
// 步驟：右半邊車身（node「body」，執行時鏡射的那一半）＋一直都有的零件（kits ['*']、不是尾翼、不是寬體）→ 鏡射成整台、每個三角形照材質分類
//   → 點照位置焊在一起、meshoptimizer 簡化到約 TARGET 個三角形（誤差最多 ERR 公尺）→ 每個三角形的分類＝中心最近的原本那個三角形的 → 加四個輪子（6 邊的圓柱＋朝外的輪框圓盤，照 spec.wheels）
// 輸出：FAR_CARS[k] = { p: base64 Int16（公釐，x 往前、y 往上、z 往右；地面 y=0）, c: base64 Uint8（每個點的分類）, i: base64 Uint16（三角形）, n: 三角形數 }
// 分類（FAR_COL）：0 車漆（執行時乘上那台車的顏色）、1 玻璃、2 黑飾條、3 燈、4 尾燈、5 輪胎、6 輪框
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptSimplifier as MS } from 'meshoptimizer';
import { LOD_CARS } from './carlod.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ALL = ['supra', 'gtr', 'gc8', 'yaris', 'p918', 'sp3', 'jesko', 'rx7', 'evo', 'civic', 'laferrari', 'huayra', 'senna', 'altis', 'aventador', 'ae86', 'chiron', 'jp4', 'k2', 'p8'];
const KEYS = (process.argv.slice(2).find((s) => !s.startsWith('--')) || ALL.join(',')).split(',');
const TARGET = 260, ERR = 0.12, WSEG = 6, WELD0 = 0.0005;
const CLS = { paint: 0, glass: 1, trim: 2, matte: 2, wire: 2, black: 2, lens: 2, custom: 2, mirrorGlass: 1, lamp: 3, chrome: 3, rev: 3, red: 4, amber: 4 };

await MeshoptDecoder.ready; await MS.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const b64 = (ta) => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');

const out = {};
for (const k of KEYS) {
  const spec = LOD_CARS[k]?.spec; if (!spec) { console.log('沒有', k); continue; }
  const doc = await io.read(path.join(DIR, `body-${k}-lod.glb`)), root = doc.getRoot();
  // 1) 收三角形（點只照位置焊在一起：分類不管，簡化的時候才不會被分類的交界卡住）；每個三角形記中心、分類
  const WELD = WELD0, P = [], I = [], TC = [], TK = [], key = new Map();
  const vid = (x, y, z) => { const s = `${Math.round(x / WELD)},${Math.round(y / WELD)},${Math.round(z / WELD)}`; let i = key.get(s); if (i === undefined) { i = P.length / 3; key.set(s, i); P.push(x, y, z); } return i; };
  const tri = (a, b, d, c) => { I.push(vid(...a), vid(...b), vid(...d)); TC.push((a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3, (a[2] + b[2] + d[2]) / 3); TK.push(c); };
  let nIn = 0;
  for (const node of root.listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const ex = node.getExtras() || {};
    if (ex.lod === 'part' && !(Array.isArray(ex.kits) && ex.kits.includes('*') && !ex.wing && !ex.wide)) continue;
    if (ex.lod !== 'body' && ex.lod !== 'part') continue;
    const T = node.getTranslation(), S = node.getScale(), half = !!ex.half;
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial()?.getName() || 'custom', c = CLS[mat] ?? 2;
      const pos = prim.getAttribute('POSITION'), idx = prim.getIndices(), v = [0, 0, 0];
      const W = (i) => { pos.getElement(i, v); return [T[0] + S[0] * v[0], T[1] + S[1] * v[1], T[2] + S[2] * v[2]]; };
      const n = idx ? idx.getCount() : pos.getCount();
      for (let t = 0; t < n; t += 3) {
        const a = W(idx ? idx.getScalar(t) : t), b = W(idx ? idx.getScalar(t + 1) : t + 1), d = W(idx ? idx.getScalar(t + 2) : t + 2);
        tri(a, b, d, c); nIn++;
        if (half) tri([a[0], a[1], -a[2]], [d[0], d[1], -d[2]], [b[0], b[1], -b[2]], c); // 鏡射（反過來繞）
      }
    }
  }
  // 2) 簡化
  const Pf = new Float32Array(P), If = new Uint32Array(I);
  let [sI, err] = MS.simplify(If, Pf, 3, TARGET * 3, ERR, ['ErrorAbsolute', 'Prune']), how = '';
  if (sI.length > TARGET * 3 * 1.6) { // 烘焙的車身（GC8、GT-R）一片一片的（邊都是開的，一般的簡化收不動）：先照細格子收一次（同一格的點變成同一點＝片和片連起來），再一般的簡化
    const PRE = 1500;
    const [pI] = MS.simplifySloppy(If, Pf, 3, null, PRE * 3, ERR);
    [sI, err] = MS.simplify(pI, Pf, 3, TARGET * 3, ERR, ['ErrorAbsolute', 'Prune']); how = `（先格子收到 ${pI.length / 3}）`;
    if (sI.length > TARGET * 3 * 1.6) { [sI, err] = MS.simplifySloppy(If, Pf, 3, null, TARGET * 3, ERR); how = '（sloppy）'; }
  }
  // 3) 每個簡化後的三角形的分類＝中心最近的原本那個三角形（4 公分一格找）；分類不同的點分開（顏色才是一塊一塊的）
  const G = new Map(), gk = (x, y, z) => `${Math.floor(x / 0.04)},${Math.floor(y / 0.04)},${Math.floor(z / 0.04)}`;
  for (let t = 0; t < TK.length; t++) { const s = gk(TC[t * 3], TC[t * 3 + 1], TC[t * 3 + 2]); let L = G.get(s); if (!L) G.set(s, (L = [])); L.push(t); }
  const near = (x, y, z) => { for (let r = 0; r < 12; r++) { let best = -1, bd = Infinity; const cx = Math.floor(x / 0.04), cy = Math.floor(y / 0.04), cz = Math.floor(z / 0.04);
    for (let a = cx - r; a <= cx + r; a++) for (let b = cy - r; b <= cy + r; b++) for (let c = cz - r; c <= cz + r; c++) { if (Math.max(Math.abs(a - cx), Math.abs(b - cy), Math.abs(c - cz)) !== r) continue; const L = G.get(`${a},${b},${c}`); if (!L) continue; for (const t of L) { const d = (TC[t * 3] - x) ** 2 + (TC[t * 3 + 1] - y) ** 2 + (TC[t * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = t; } } }
    if (best >= 0) return TK[best]; } return 0; };
  const used = new Map(), P2 = [], C2 = [], I2 = [];
  for (let t = 0; t < sI.length; t += 3) {
    const v3 = [sI[t], sI[t + 1], sI[t + 2]], c = near((Pf[v3[0] * 3] + Pf[v3[1] * 3] + Pf[v3[2] * 3]) / 3, (Pf[v3[0] * 3 + 1] + Pf[v3[1] * 3 + 1] + Pf[v3[2] * 3 + 1]) / 3, (Pf[v3[0] * 3 + 2] + Pf[v3[1] * 3 + 2] + Pf[v3[2] * 3 + 2]) / 3);
    for (const i of v3) { const s = i * 8 + c; let j = used.get(s); if (j === undefined) { j = P2.length / 3; used.set(s, j); P2.push(Pf[i * 3], Pf[i * 3 + 1], Pf[i * 3 + 2]); C2.push(c); } I2.push(j); }
  }
  const nBody = I2.length / 3;
  // 4) 輪子：8 邊的圓柱（輪胎）＋外面的圓盤（輪框）
  const W = spec.wheels;
  for (const [x, track, w, R, rim] of [[W.xf, W.trackF, W.wF, W.RF ?? W.R, W.rimF ?? W.rim], [W.xr, W.trackR, W.wR, W.RR ?? W.R, W.rimR ?? W.rim]]) {
    for (const sd of [-1, 1]) {
      const zi = sd * (track - w / 2), zo = sd * (track + w / 2), base = P2.length / 3;
      for (let s = 0; s < WSEG; s++) { const a = ((s + 0.5) / WSEG) * Math.PI * 2, cx = x + Math.cos(a) * R, cy = R + Math.sin(a) * R; P2.push(cx, cy, zi, cx, cy, zo); C2.push(5, 5); }
      for (let s = 0; s < WSEG; s++) { const s1 = (s + 1) % WSEG, a0 = base + s * 2, a1 = base + s1 * 2; if (sd > 0) I2.push(a0, a1, a0 + 1, a1, a1 + 1, a0 + 1); else I2.push(a0, a0 + 1, a1, a1, a0 + 1, a1 + 1); }
      const rb = P2.length / 3, rr = (rim || R * 0.7) * 0.95, zf = zo + sd * 0.004; P2.push(x, R, zf); C2.push(6);
      for (let s = 0; s < WSEG; s++) { const a = ((s + 0.5) / WSEG) * Math.PI * 2; P2.push(x + Math.cos(a) * rr, R + Math.sin(a) * rr, zf); C2.push(6); }
      for (let s = 0; s < WSEG; s++) { const s1 = (s + 1) % WSEG; if (sd > 0) I2.push(rb, rb + 1 + s, rb + 1 + s1); else I2.push(rb, rb + 1 + s1, rb + 1 + s); } // 輪框朝外
    }
  }
  const Pq = new Int16Array(P2.length); for (let i = 0; i < P2.length; i++) Pq[i] = Math.max(-32767, Math.min(32767, Math.round(P2[i] * 1000)));
  out[k] = { p: b64(Pq), c: b64(Uint8Array.from(C2)), i: b64(Uint16Array.from(I2)), n: I2.length / 3 };
  console.log(k.padEnd(10), '輕量車', nIn * 2, '→ 車身', nBody, '＋輪子', I2.length / 3 - nBody, '＝', I2.length / 3, '個三角形', '點', P2.length / 3, '誤差', (err * 100).toFixed(1), '公分', how);
}
const prev = (() => { try { const s = fs.readFileSync(path.join(DIR, 'farcars.js'), 'utf8'); const m = s.match(/FAR_CARS = (\{.*\});/s); return m ? JSON.parse(m[1]) : {}; } catch { return {}; } })();
const all = { ...prev, ...out };
const src = `// ---- 遠的車（自動產生：node make-far.mjs；不要手改）----\n// 第 92 批：停車場、休息站停著的車遠遠看的樣子（照輕量車簡化，一台約 300～350 個三角形）；格式見 make-far.mjs\nexport const FAR_CARS = ${JSON.stringify(all)};\n`;
fs.writeFileSync(path.join(DIR, 'farcars.js'), src);
console.log('farcars.js', (src.length / 1024).toFixed(0), 'KB');
