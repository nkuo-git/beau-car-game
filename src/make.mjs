// 產生車身網格 → body.glb，裡面三個網格（都只存右半邊 z ≥ 0，載入時再鏡射成整台）：
//   Body         整台車身（車頭 NOSE_X 以前）
//   Nose_bomex   車頭：玩命關頭那台的 Bomex 保桿
//   Nose_stock   車頭：原廠保桿
// 兩個車頭在切口附近的形狀完全一樣，所以跟車身接得起來。
import { Document, NodeIO } from '@gltf-transform/core';
import { makeSDF, mesh, NOSE_X } from './body.mjs';

const h = +(process.argv[2] || 0.016);
const BOX = [-2.34, 0.06, -0.98, 2.34, 1.36, 0.98];
// 車頭那段只切 x ≥ 1.40 的方塊（格點跟整台對齊，切口的點才會一模一樣）
const NOSE_BOX = [BOX[0] + Math.round((1.40 - BOX[0]) / h) * h, ...BOX.slice(1)];

// 用一個平面切網格，只留一邊；切到的三角形沿平面切齊（新的點直接落在平面上）
function clip(m, axis, value, keepAbove) {
  const P = m.positions, N = m.normals, I = m.indices;
  const pos = [], nor = [], idx = [], map = new Map(), cut = new Map();
  const side = (i) => (keepAbove ? P[i * 3 + axis] >= value - 1e-6 : P[i * 3 + axis] <= value + 1e-6);
  const keep = (i) => {
    if (!map.has(i)) { map.set(i, pos.length / 3); pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); nor.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); }
    return map.get(i);
  };
  const mid = (a, b) => {
    const key = a < b ? a + ',' + b : b + ',' + a;
    if (cut.has(key)) return cut.get(key);
    const va = P[a * 3 + axis], vb = P[b * 3 + axis], t = (va - value) / (va - vb);
    const k = pos.length / 3;
    for (let c = 0; c < 3; c++) pos.push(c === axis ? value : P[a * 3 + c] + (P[b * 3 + c] - P[a * 3 + c]) * t);
    const n = [0, 1, 2].map((c) => N[a * 3 + c] + (N[b * 3 + c] - N[a * 3 + c]) * t);
    if (axis === 2 && value === 0) n[2] = 0; // 左右對稱的中線：法線不能朝側面
    const l = Math.hypot(...n) || 1; nor.push(n[0] / l, n[1] / l, n[2] / l);
    cut.set(key, k); return k;
  };
  for (let t = 0; t < I.length; t += 3) {
    const v = [I[t], I[t + 1], I[t + 2]], s = v.map(side);
    const n = s.filter(Boolean).length;
    if (n === 3) { idx.push(keep(v[0]), keep(v[1]), keep(v[2])); continue; }
    if (n === 0) continue;
    let r = 0; for (let i = 0; i < 3; i++) if (s[i] !== s[(i + 1) % 3] && s[i] !== s[(i + 2) % 3]) r = i; // v[r] 是落單的那個
    const a = v[r], b = v[(r + 1) % 3], c = v[(r + 2) % 3];
    const ab = mid(a, b), ac = mid(a, c);
    if (s[r]) idx.push(keep(a), ab, ac);
    else idx.push(ab, keep(b), keep(c), ab, keep(c), ac);
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nor), indices: new Uint32Array(idx) };
}

const doc = new Document();
const buf = doc.createBuffer();
const scene = doc.createScene();
const mat = doc.createMaterial('Paint');
function add(name, m) {
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
  const nv = m.positions.length / 3;
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', m.positions))
    .setAttribute('NORMAL', acc('VEC3', m.normals))
    .setIndices(acc('SCALAR', nv < 65536 ? new Uint16Array(m.indices) : m.indices))
    .setMaterial(mat);
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
  console.log(`${name}: verts ${nv}, tris ${m.indices.length / 3}`);
}

const car = process.argv[3] || 'supra';
let t0 = Date.now();
if (car === 'gtr') { // GT-R：只有一種車頭，套件都是外掛零件
  const G = await import('./gtr-body.mjs');
  const m = mesh(G.makeSDF(), [-2.36, 0.06, -0.98, 2.36, 1.42, 0.98], h);
  console.log(`gtr mesh ${Date.now() - t0} ms`);
  add('Body', clip(m, 2, 0, true));
  await new NodeIO().write(new URL('./body-gtr.glb', import.meta.url).pathname, doc);
  console.log('wrote body-gtr.glb');
  process.exit(0);
}
const body = mesh(makeSDF({ kit: 'bomex' }), BOX, h);
console.log(`body mesh ${Date.now() - t0} ms`);
add('Body', clip(clip(body, 2, 0, true), 0, NOSE_X, false));
for (const kit of ['bomex', 'stock']) {
  t0 = Date.now();
  const m = mesh(makeSDF({ kit }), NOSE_BOX, h, BOX);
  console.log(`nose ${kit} ${Date.now() - t0} ms`);
  add('Nose_' + kit, clip(clip(m, 2, 0, true), 0, NOSE_X, true));
}
await new NodeIO().write(new URL('./body.glb', import.meta.url).pathname, doc);
console.log('wrote body.glb');
