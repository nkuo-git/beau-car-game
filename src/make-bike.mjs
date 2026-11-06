// 腳踏車的「車身檔」（第 67 批）：腳踏車整台都是 bike-spec.js 用程式做的（車架、輪子、把手⋯都是零件），沒有車殼。
// 車庫的組車流程（supra.js buildCar、masks.js、make-lod.mjs）一定要有一個車身 glb，所以這裡放一顆 1 公分的小方塊，藏在五通（曲柄的軸）裡面，看不到。
// node make-bike.mjs → body-mtb-q.glb、body-road-q.glb
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { BIKE } from './bike-spec.js';
const dir = path.dirname(new URL(import.meta.url).pathname);
for (const key of ['mtb', 'road']) {
  const [bx, by] = BIKE[key].bb, h = 0.005; // 五通的中間（半徑 0.024 的圓筒裡面）
  const P = [], N = [], I = [];
  const face = (n, a, b, c, d) => { const o = P.length / 3; for (const v of [a, b, c, d]) { P.push(bx + v[0] * h, by + v[1] * h, v[2] * h); N.push(...n); } I.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  face([1, 0, 0], [1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]); face([-1, 0, 0], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]);
  face([0, 1, 0], [-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]); face([0, -1, 0], [-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]);
  face([0, 0, 1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]); face([0, 0, -1], [1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]);
  const doc = new Document(), buf = doc.createBuffer(), scene = doc.createScene(), mat = doc.createMaterial('Paint');
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
  const prim = doc.createPrimitive().setAttribute('POSITION', acc('VEC3', new Float32Array(P))).setAttribute('NORMAL', acc('VEC3', new Float32Array(N))).setIndices(acc('SCALAR', new Uint16Array(I))).setMaterial(mat);
  scene.addChild(doc.createNode('Body').setMesh(doc.createMesh('Body').addPrimitive(prim)));
  const out = path.join(dir, `body-${key}-q.glb`);
  await new NodeIO().write(out, doc);
  console.log('wrote', path.basename(out), `${I.length / 3} tris`);
}
