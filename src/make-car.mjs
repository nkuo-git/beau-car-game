// 通用車身網格：node make-car.mjs <key> [h=0.016]
// 讀 ./<key>-body.mjs 的 makeSDF() 和 BOUNDS=[x0,y0,x1,y1,zmax]，只存右半邊 (z ≥ 0) → body-<key>.glb，再量化成 body-<key>-q.glb
import { Document, NodeIO } from '@gltf-transform/core';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { mesh } from './body.mjs';
const dir = path.dirname(new URL(import.meta.url).pathname);
const key = process.argv[2], h = +(process.argv[3] || 0.016);
if (!key) { console.log('usage: node make-car.mjs <key> [h]'); process.exit(1); }
const M = await import(`./${key}-body.mjs`);
const [x0, y0, x1, y1, zm] = M.BOUNDS;
function clipZ(m) { // 只留 z ≥ 0，切到的三角形切齊 z=0（中線上的法線不能朝側面）
  const P = m.positions, N = m.normals, I = m.indices, pos = [], nor = [], idx = [], map = new Map(), cut = new Map();
  const side = (i) => P[i * 3 + 2] >= -1e-6;
  const keep = (i) => { if (!map.has(i)) { map.set(i, pos.length / 3); pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); nor.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); } return map.get(i); };
  const mid = (a, b) => {
    const key = a < b ? a + ',' + b : b + ',' + a; if (cut.has(key)) return cut.get(key);
    const va = P[a * 3 + 2], vb = P[b * 3 + 2], t = va / (va - vb), k = pos.length / 3;
    for (let c = 0; c < 3; c++) pos.push(c === 2 ? 0 : P[a * 3 + c] + (P[b * 3 + c] - P[a * 3 + c]) * t);
    const n = [0, 1, 2].map((c) => N[a * 3 + c] + (N[b * 3 + c] - N[a * 3 + c]) * t); n[2] = 0;
    const l = Math.hypot(...n) || 1; nor.push(n[0] / l, n[1] / l, n[2] / l); cut.set(key, k); return k;
  };
  for (let t = 0; t < I.length; t += 3) {
    const v = [I[t], I[t + 1], I[t + 2]], s = v.map(side), n = s.filter(Boolean).length;
    if (n === 3) { idx.push(keep(v[0]), keep(v[1]), keep(v[2])); continue; }
    if (n === 0) continue;
    let r = 0; for (let i = 0; i < 3; i++) if (s[i] !== s[(i + 1) % 3] && s[i] !== s[(i + 2) % 3]) r = i;
    const a = v[r], b = v[(r + 1) % 3], c = v[(r + 2) % 3], ab = mid(a, b), ac = mid(a, c);
    if (s[r]) idx.push(keep(a), ab, ac); else idx.push(ab, keep(b), keep(c), ab, keep(c), ac);
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nor), indices: new Uint32Array(idx) };
}
const t0 = Date.now();
const m = clipZ(mesh(M.makeSDF(), [x0, y0, -zm, x1, y1, zm], h));
console.log(`${key}: verts ${m.positions.length / 3}, tris ${m.indices.length / 3}, ${Date.now() - t0} ms`);
const doc = new Document(), buf = doc.createBuffer(), scene = doc.createScene(), mat = doc.createMaterial('Paint');
const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
const prim = doc.createPrimitive().setAttribute('POSITION', acc('VEC3', m.positions)).setAttribute('NORMAL', acc('VEC3', m.normals))
  .setIndices(acc('SCALAR', m.positions.length / 3 < 65536 ? new Uint16Array(m.indices) : m.indices)).setMaterial(mat);
scene.addChild(doc.createNode('Body').setMesh(doc.createMesh('Body').addPrimitive(prim)));
const out = path.join(dir, `body-${key}.glb`), outQ = path.join(dir, `body-${key}-q.glb`);
await new NodeIO().write(out, doc);
execFileSync(path.join(dir, '../node_modules/.bin/gltf-transform'), ['quantize', out, outQ, '--quantize-position', '14', '--quantize-normal', '12', '--quantization-volume', 'scene'], { stdio: 'inherit' });
console.log('wrote', path.basename(out), path.basename(outQ));
