// 怪獸卡車的車殼網格（手機版）：node monster-mesh.mjs [--paint=0.0008]
// 輸入：monster3d/body-monster-hi.glb（細的半邊車殼：node make-car.mjs monster 0.016 做出來的 body-monster.glb 改名）
// 輸出：body-monster.glb、body-monster-q.glb（量化，車庫頁、遊戲用這個），兩個 node（都是右半邊，遮罩座標，supra.js carGeos 會鏡射）：
//   Body         車漆那層：meshoptimizer 簡化（誤差 --paint，遮罩座標；×1.25＝公尺），頂點都是原本的頂點（法線不變）；車內那層（車殼背面）也用這個網格
//                （試過車內那層用更粗的網格：從駕駛座看，擋風玻璃下緣會漏一條亮線（粗細兩層在玻璃邊上對不齊）→ 不要）
//   Nose_glass   玻璃那層：只留 Body 在側窗、前擋附近的三角形（多留 4 公分；shader 本來就會把不是玻璃的地方挖掉）
//   （名字用 Nose_：carGeos 會把 Nose_* 讀成 geos.noses；monster-spec.js build() 把它拿走，不會畫成車漆）
// 原本三層都畫整個車殼（19.8 萬三角形 × 3，玻璃雙面透明再畫兩次 ≈ 80 萬）→ 現在 車漆＋車內＋玻璃×2 大約 3.8 萬
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Document, NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier as MS } from 'meshoptimizer';
import { MONSTER_LOOK, MONSTER_M } from './monster-look.js';

const dir = path.dirname(new URL(import.meta.url).pathname);
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? +a.split('=')[1] : d; };
const ERR_PAINT = arg('paint', 0.0008);
await MS.ready;

// ---- 讀細的半邊車殼 ----
const src = await new NodeIO().read(path.join(dir, 'monster3d/body-monster-hi.glb'));
const prim = src.getRoot().listMeshes()[0].listPrimitives()[0];
const P0 = Float32Array.from(prim.getAttribute('POSITION').getArray()), N0 = Float32Array.from(prim.getAttribute('NORMAL').getArray()), I0 = Uint32Array.from(prim.getIndices().getArray());
console.log(`hi: ${P0.length / 3} verts, ${I0.length / 3} tris (half)`);

// 只留用到的頂點
function compact(P, N, I) {
  const map = new Int32Array(P.length / 3).fill(-1), p = [], n = [], J = new Uint32Array(I.length);
  for (let t = 0; t < I.length; t++) {
    const v = I[t];
    if (map[v] < 0) { map[v] = p.length / 3; p.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); n.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); }
    J[t] = map[v];
  }
  return { P: new Float32Array(p), N: new Float32Array(n), I: J };
}
// 簡化：法線也算誤差（光影才不會變）；邊界（中線 z=0、車殼下緣、輪拱）只沿著邊收，中線兩邊鏡射後還是接得起來
function simplify(P, N, I, err, w = 0.5) {
  const [idx, e] = MS.simplifyWithAttributes(I, P, 3, N, 3, [w, w, w], null, 0, err, ['ErrorAbsolute']);
  return { ...compact(P, N, idx), err: e };
}
const paint = simplify(P0, N0, I0, ERR_PAINT);
console.log(`Body ${paint.I.length / 3} tris (err ${paint.err.toExponential(2)})`);

// ---- 玻璃附近的三角形（公尺；遮罩座標 → 公尺：x＝xm/0.8＋0.1、y＝ym/0.8＋1.38、z＝zm/0.8）----
const { S: MSC, X0, Y0 } = MONSTER_M, { DLO, WS } = MONSTER_LOOK.shape, GY = MONSTER_LOOK.U.uGlassY / MSC + Y0;
const WS2 = [...WS, ...WS.slice().reverse().map(([x, z]) => [x, -z])];
function inPoly(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function distPoly(poly, x, y) { // 到多邊形邊的距離
  let d = 1e9;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    d = Math.min(d, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return d;
}
const near = (poly, x, y, m) => inPoly(poly, x, y) || distPoly(poly, x, y) < m;
const MARGIN = 0.04;
function isGlassV(P, N, v) {
  const x = P[v * 3] / MSC + X0, y = P[v * 3 + 1] / MSC + Y0, z = P[v * 3 + 2] / MSC, nz = N[v * 3 + 2];
  if (Math.abs(nz) > 0.2 && near(DLO, x, y, MARGIN)) return true; // 側窗
  return y >= GY - MARGIN && near(WS2, x, z, MARGIN); // 前擋（俯視）
}
const gl = [];
{
  const g = new Uint8Array(paint.P.length / 3);
  for (let v = 0; v < g.length; v++) g[v] = isGlassV(paint.P, paint.N, v) ? 1 : 0;
  for (let t = 0; t < paint.I.length; t += 3) if (g[paint.I[t]] || g[paint.I[t + 1]] || g[paint.I[t + 2]]) gl.push(paint.I[t], paint.I[t + 1], paint.I[t + 2]);
}
const glass = compact(paint.P, paint.N, Uint32Array.from(gl));
console.log(`Nose_glass ${glass.I.length / 3} tris`);

// ---- 寫 glb ----
const doc = new Document(), buf = doc.createBuffer(), scene = doc.createScene(), mat = doc.createMaterial('Paint');
const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
for (const [name, m] of [['Body', paint], ['Nose_glass', glass]]) {
  const pr = doc.createPrimitive().setAttribute('POSITION', acc('VEC3', m.P)).setAttribute('NORMAL', acc('VEC3', m.N))
    .setIndices(acc('SCALAR', m.P.length / 3 < 65536 ? new Uint16Array(m.I) : m.I)).setMaterial(mat);
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(pr)));
}
const out = path.join(dir, 'body-monster.glb'), outQ = path.join(dir, 'body-monster-q.glb');
await new NodeIO().write(out, doc);
execFileSync(path.join(dir, '../node_modules/.bin/gltf-transform'), ['quantize', out, outQ, '--quantize-position', '14', '--quantize-normal', '12', '--quantization-volume', 'scene'], { stdio: 'inherit' });
const full = (m) => (m.I.length / 3) * 2;
console.log(`wrote body-monster.glb ${(fs.statSync(out).size / 1e6).toFixed(2)} MB, body-monster-q.glb ${(fs.statSync(outQ).size / 1e6).toFixed(2)} MB; full car: paint ${full(paint)}, inside ${full(paint)} (same mesh), glass ${full(glass)} (×2 passes) → ${2 * full(paint) + 2 * full(glass)} tris drawn (was ${(I0.length / 3) * 2 * 4})`);
