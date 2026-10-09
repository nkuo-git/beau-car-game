// 怪獸卡車的輕量車（LOD）：node monster-lod.mjs [--rebake] [--half=8000] [--q=0.75]
// 輸出 body-monster-lod.glb（carlod.js 的格式，跟 make-lod.mjs 做的其他七台一樣；build-art.mjs 會轉成 art/car-monster-lod.txt）
// 步驟：
//  1. 烘焙（monster-lod.html，Chromium）：四張投影遮罩（masks.js makeMaskTextures(MONSTER_LOOK)）的像素 → monster3d/lod-bake.json（快取，--rebake 重做）
//  2. 車殼（monster3d/body-monster-hi.glb：細的右半邊，遮罩座標）每個頂點照 masks.js patchPaint 的規則分類 → 沿著分類的邊界切開 → 簡化到 --half 個三角形
//     （分類、切、簡化都照抄 make-lod.mjs；遮罩座標跟 shader 一樣，所以在遮罩座標做完再換成公尺）
//  3. 換成公尺（x＝xm/0.8＋0.1、y＝ym/0.8＋1.38、z＝zm/0.8，法線不變）→ node「body」（右半邊，carlod.js 鏡射）
//  4. 零件（monster-spec.js MONSTER_P.lodParts()，車身座標）：車架、防滾籠、引擎、排氣頭段、管保桿、油箱、內襯、車架那頭的球頭 → part_0（每種胎紋都有、不是尾翼）；
//     旗子（旗板、白星、旗桿）→ part_1（wing＝'flag'）；同一種顏色併成一個 primitive，照原本的法線焊接（圓管還是圓的、方塊還是利的）再簡化
//     顏色：carlod.js 角色固定的用角色（alu、polish、hub、rubber、black），跟原本差很多的用 custom（車架黑、防滾籠橘、旗子的白星）
//  輪子、beadlock 環、輪框筒、懸吊不在 glb 裡：carlod.js 照 MONSTER_SPEC.lod.wheels 在執行時做（胎紋、車身高度換了跟著換）
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { MeshoptSimplifier as MS } from 'meshoptimizer';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import { MONSTER_LOOK, MONSTER_M } from './monster-look.js';
import { MONSTER_P } from './monster-spec.js';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? +a.split('=')[1] : d; };
const HALF = arg('half', 8000); // 半邊車殼的目標三角形數
const Q = arg('q', 0.75); // 零件的段數（1＝完整的車）
const PART_ERR = arg('perr', 0.003); // 零件簡化誤差（公尺）
const BLUR = 0.005, MATTE_ERR = 0.012; // 遮罩模糊（公尺，σ）、車殼底下（消光）先簡化的誤差
const BAKE = path.join(DIR, 'monster3d/lod-bake.json');

// ---------- 1. 烘焙 ----------
if (process.argv.includes('--rebake') || !fs.existsSync(BAKE)) {
  const pw = (await import('/opt/node22/lib/node_modules/playwright/index.js')).default;
  const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html; charset=utf-8' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = u.startsWith('/three/') ? path.join(DIR, '../node_modules/three', u.slice(7)) : path.join(DIR, u);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/monster-lod.html`);
  await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const t0 = Date.now(), r = await p.evaluate(() => window.bake());
  fs.writeFileSync(BAKE, JSON.stringify(r));
  console.log(`bake: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await b.close(); srv.close();
}
await MS.ready;
const B = JSON.parse(fs.readFileSync(BAKE, 'utf8'));

// ---------- 小工具（照抄 make-lod.mjs）----------
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hex2lin = (h) => [1, 3, 5].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
function maskTex(t, span) { // 解開、模糊（BLUR）；雙線性取樣跟 GPU 的 texture2D 一樣
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

// ---------- 2. 分類（跟 make-lod.mjs 一樣：masks.js patchPaint 的規則，最後顏色裡佔最多的那一類）----------
const BODY_CLS = ['paint', 'glass', 'trim', 'matte', 'lamp', 'lens', 'wire', 'amber', 'red', 'rev', 'chrome'];
const GLASS = 1, LENS = 5, WIRE = 6, ORDER = [2, 3, 4, 5, 6, 7, 8, 9], LOW_LAMP = 0.48, WIRE_MIN = 0.08;
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
    if (wire > WIRE_MIN) wire = 1;
    w[2] = blackG; w[3] = matte; w[4] = lamp; w[5] = lens; w[6] = wire; w[7] = amber; w[8] = red; w[9] = rev;
    let keep = 1, bc = 0, bv = 0;
    for (let i = ORDER.length - 1; i >= 0; i--) { const c = ORDER[i], v = w[c] * keep; if (v > bv) { bv = v; bc = c; } keep *= 1 - w[c]; }
    const c = keep >= bv ? 0 : bc;
    return c === 4 && y < LOW_LAMP ? 10 : c;
  };
  cls.at = at;
  return cls;
}
function mixes(cut, cls, acc) { // 燈裡暗玻璃的比例、網子覆蓋率（面積加權平均）→ lens／wire 材質的 extras.mix
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
function cutByClass(P, N, I, cls) { // 兩端不同類的邊用二分法找交界點（每個分類各一個頂點＝seam）
  const nv = P.length / 3, C = new Int8Array(nv);
  for (let i = 0; i < nv; i++) C[i] = cls(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
  const op = Array.from(P), on = Array.from(N), oc = Array.from(C), oi = [];
  const lex = (a, b) => { for (let k = 0; k < 3; k++) { const d = P[a * 3 + k] - P[b * 3 + k]; if (d) return d < 0; } return a < b; };
  const cross = new Map(), inst = new Map();
  const at = (a, b, t, o) => {
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
  function vid(e, c) {
    const k = e.key * 16 + c; let v = inst.get(k);
    if (v === undefined) { v = oc.length; op.push(e.v[0], e.v[1], e.v[2]); on.push(e.v[3], e.v[4], e.v[5]); oc.push(c); inst.set(k, v); }
    return v;
  }
  let g3 = 0;
  for (let t = 0; t < I.length; t += 3) {
    let a = I[t], b = I[t + 1], c = I[t + 2];
    const ca = C[a], cb = C[b], cc = C[c];
    if (ca === cb && cb === cc) { oi.push(a, b, c); continue; }
    if (ca !== cb && cb !== cc && ca !== cc) {
      const ab = edge(a, b), bc = edge(b, c), ca_ = edge(c, a);
      const gp = [0, 1, 2].map((k) => (P[a * 3 + k] + P[b * 3 + k] + P[c * 3 + k]) / 3), gn = [0, 1, 2].map((k) => N[a * 3 + k] + N[b * 3 + k] + N[c * 3 + k]);
      const gl = Math.hypot(...gn) || 1, G = { key: -(++g3), v: [...gp, ...gn.map((v) => v / gl)] };
      for (const [v0, X0, X1, cl] of [[a, ab, ca_, ca], [b, bc, ab, cb], [c, ca_, bc, cc]]) { const p = vid(X0, cl), q = vid(G, cl), r = vid(X1, cl); oi.push(v0, p, q, v0, q, r); }
      continue;
    }
    if (ca === cc) [a, b, c] = [c, a, b]; else if (cb === cc) [a, b, c] = [b, c, a];
    const A = C[a], Cc = C[c], xbc = edge(b, c), xca = edge(c, a);
    oi.push(vid(xbc, Cc), c, vid(xca, Cc));
    const pb = vid(xbc, A), pa = vid(xca, A);
    oi.push(a, b, pb, a, pb, pa);
  }
  return { P: new Float32Array(op), N: new Float32Array(on), C: Int8Array.from(oc), I: new Uint32Array(oi) };
}
function compact(M) {
  const nv = M.P.length / 3, map = new Int32Array(nv).fill(-1), P = [], N = [], C = [], I = new Uint32Array(M.I.length);
  for (let t = 0; t < M.I.length; t++) {
    const v = M.I[t];
    if (map[v] < 0) { map[v] = C.length; P.push(M.P[v * 3], M.P[v * 3 + 1], M.P[v * 3 + 2]); N.push(M.N[v * 3], M.N[v * 3 + 1], M.N[v * 3 + 2]); C.push(M.C ? M.C[v] : 0); }
    I[t] = map[v];
  }
  return { P: new Float32Array(P), N: new Float32Array(N), C: Int8Array.from(C), I };
}
function simplify(M, target, { attrW = 0.4, pre = [] } = {}) { // pre：看不太到的分類先自己簡化（邊界鎖住）
  let I = M.I;
  for (const { cls, err } of pre) {
    const mine = [], rest = [];
    for (let t = 0; t < I.length; t += 3) (M.C[I[t]] === cls ? mine : rest).push(I[t], I[t + 1], I[t + 2]);
    if (!mine.length) continue;
    const [s] = MS.simplify(new Uint32Array(mine), M.P, 3, 0, err, ['LockBorder', 'Sparse', 'ErrorAbsolute']);
    I = new Uint32Array([...rest, ...s]);
  }
  const [idx, err] = MS.simplifyWithAttributes(I, M.P, 3, M.N, 3, [attrW, attrW, attrW], null, Math.min(I.length, target * 3), 0.08, []);
  return { ...compact({ ...M, I: idx }), err };
}
// 三角形湯 → 焊接：位置（0.01 mm）、法線（千分之一）都一樣的角併成一個頂點（圓管的法線本來就是平順的，方塊的邊本來就分開）
function weldExact(P, N) {
  const map = new Map(), op = [], on = [], J = [], n = P.length / 3, corner = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(P[i * 3] * 1e5)},${Math.round(P[i * 3 + 1] * 1e5)},${Math.round(P[i * 3 + 2] * 1e5)}|${Math.round(N[i * 3] * 1e3)},${Math.round(N[i * 3 + 1] * 1e3)},${Math.round(N[i * 3 + 2] * 1e3)}`;
    let v = map.get(key);
    if (v === undefined) { v = op.length / 3; map.set(key, v); op.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); on.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); }
    corner[i] = v;
  }
  for (let t = 0; t < n; t += 3) { const a = corner[t], b = corner[t + 1], c = corner[t + 2]; if (a !== b && b !== c && a !== c) J.push(a, b, c); }
  return { P: new Float32Array(op), N: new Float32Array(on), I: new Uint32Array(J) };
}
function writer() { // 跟 make-lod.mjs 一樣：KHR_mesh_quantization（位置 int16、法線 int8）；材質名字＝角色，custom 帶顏色
  const doc = new Document(), buf = doc.createBuffer(), scene = doc.createScene('lod');
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  const mats = new Map();
  const material = (role, m, more) => {
    const key = role === 'custom' ? role + JSON.stringify(m) : role;
    if (mats.has(key)) return mats.get(key);
    const x = doc.createMaterial(role).setExtras({ role, cc: m?.clearcoat ?? 0, ...(more || {}) });
    if (m) x.setBaseColorFactor([...hex2lin(m.color), 1]).setRoughnessFactor(m.roughness).setMetallicFactor(m.metalness).setEmissiveFactor(hex2lin(m.emissive).map((v) => v * (m.ei ?? 1)));
    mats.set(key, x); return x;
  };
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
  return { add, write: () => new NodeIO().registerExtensions([KHRMeshQuantization]).writeBinary(doc) };
}

// ---------- 車殼 ----------
const t0 = Date.now();
const src = await new NodeIO().read(path.join(DIR, 'monster3d/body-monster-hi.glb'));
const prim = src.getRoot().listMeshes()[0].listPrimitives()[0];
const P0 = Float32Array.from(prim.getAttribute('POSITION').getArray()), N0 = Float32Array.from(prim.getAttribute('NORMAL').getArray()), I0 = Uint32Array.from(prim.getIndices().getArray());
const M = { side: maskTex(B.masks.side, 4.7), top: maskTex(B.masks.top, 4.7), rear: maskTex(B.masks.rear, 2), front: maskTex(B.masks.front, 2) };
const cls = classifier(M, MONSTER_LOOK.U);
const cut = cutByClass(P0, N0, I0, cls);
const acc = { lens: [0, 0], wire: [0, 0] };
mixes(cut, cls, acc);
const mix = { lens: acc.lens[1] ? +(acc.lens[0] / acc.lens[1]).toFixed(3) : 1, wire: acc.wire[1] ? +(acc.wire[0] / acc.wire[1]).toFixed(3) : 0.45 };
const s = simplify(cut, HALF, { pre: [{ cls: 3, err: MATTE_ERR }] });
console.log(`body: ${I0.length / 3} → cut ${cut.I.length / 3} → ${s.I.length / 3} tris (half; err ${s.err.toExponential(2)}), mix ${JSON.stringify(mix)}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
// 遮罩座標 → 公尺
const { S: MSC, X0, Y0 } = MONSTER_M;
for (let i = 0; i < s.P.length; i += 3) { s.P[i] = s.P[i] / MSC + X0; s.P[i + 1] = s.P[i + 1] / MSC + Y0; s.P[i + 2] = s.P[i + 2] / MSC; }
const W = writer(), out = { body: s.I.length / 3, classes: {}, parts: {} };
{
  const lists = BODY_CLS.map((role) => ({ role, idx: [], x: role === 'lens' || role === 'wire' ? { mix: mix[role] } : null }));
  for (let t = 0; t < s.I.length; t += 3) lists[s.C[s.I[t]]].idx.push(s.I[t], s.I[t + 1], s.I[t + 2]);
  for (const L of lists) out.classes[L.role] = L.idx.length / 3;
  W.add('body', s.P, s.N, lists, { lod: 'body', half: true });
}

// ---------- 零件 ----------
// 調色盤名字 → carlod.js 的角色（custom：用自己的顏色）
const LP = MONSTER_P.lodParts(Q), PALC = Object.fromEntries(LP.PAL.map(([k, c, r, m]) => [k, [c, r, m]]));
const CUSTOM = (k) => { const [c, r, m] = PALC[k] || LP.CLOTH[k]; return { color: hex(c), roughness: r, metalness: m, emissive: '#000000', clearcoat: 0 }; };
const ROLE = { frame: 'custom:frame', engine: 'custom:frame', cage: 'custom:cage', steel: 'alu', alu: 'alu', chrome: 'polish', axle: 'hub', panel: 'hub', hub: 'hub', bolt: 'hub', liner: 'rubber', seat: 'seat', tire: 'rubber', flag: 'black', flagStar: 'custom:flagStar' };
function part(name, list, extras) {
  const by = new Map(); // 角色 → 三角形湯
  for (const [k, g0] of list) {
    const g = g0.index ? g0.toNonIndexed() : g0, r = ROLE[k] || 'hub';
    if (!by.has(r)) by.set(r, { P: [], N: [] });
    by.get(r).P.push(g.attributes.position.array); by.get(r).N.push(g.attributes.normal.array);
  }
  const P = [], N = [], lists = [];
  let nIn = 0, nOut = 0;
  const cat = (arrs) => { const o = new Float32Array(arrs.reduce((a, x) => a + x.length, 0)); let k = 0; for (const x of arrs) { o.set(x, k); k += x.length; } return o; };
  for (const [r, e] of by) {
    const wd = weldExact(cat(e.P), cat(e.N));
    nIn += wd.I.length / 3;
    const [idx] = MS.simplifyWithAttributes(wd.I, wd.P, 3, wd.N, 3, [0.05, 0.05, 0.05], null, 0, PART_ERR, ['ErrorAbsolute']);
    const c = compact({ P: wd.P, N: wd.N, I: idx }), o = P.length / 3;
    P.push(...c.P); N.push(...c.N);
    const [role, ck] = r.split(':');
    lists.push({ role, mat: ck ? CUSTOM(ck) : null, idx: Array.from(c.I, (v) => v + o) });
    nOut += c.I.length / 3;
  }
  W.add(name, new Float32Array(P), new Float32Array(N), lists, extras);
  out.parts[name] = nOut;
  console.log(`${name} ${extras.wing ? 'wing:' + extras.wing : 'base'}: ${nIn} → ${nOut} tris (${[...by.keys()].join(', ')})`);
}
part('part_0', LP.base, { lod: 'part', kits: ['*'], wing: null, wide: false });
part('part_1', LP.flag, { lod: 'part', kits: ['*'], wing: 'flag', wide: false });

const glb = await W.write();
fs.writeFileSync(path.join(DIR, 'body-monster-lod.glb'), glb);
out.bytes = glb.length; out.mix = mix; out.ms = Date.now() - t0;
fs.writeFileSync(path.join(DIR, 'monster3d/lod-report.json'), JSON.stringify(out, null, 1));
console.log(`body-monster-lod.glb ${(glb.length / 1024).toFixed(0)} KB (base64 ${(Math.ceil(glb.length / 3) * 4 / 1024).toFixed(0)} KB); body ${out.body * 2} tris full, parts ${Object.values(out.parts).reduce((a, b) => a + b, 0)}; classes ${JSON.stringify(out.classes)}`);
