// 手機版 GC8（第 49 批）：把 gc8-model.js 的高細節車（一台約 9 秒、825 塊）先在 Chromium 組好，同材質的零件併成一組，簡化、量化，存成 body-gc8-q.glb
// 用法：node gc8-bake.mjs [--inv] [--rebake] [--write]
//   --inv：只印出每一塊零件是什麼；--rebake：重新在 Chromium 組（不然用 ../out/gc8b/bake.json）；--write：量好的 FIT／WINGS_DECK／WIDE 寫進 cabin.js、wings.js、wide.js
//   1. Chromium：__CAR2.build(THREE, { bake: true })；每個網格照材質的 userData.slot 分組（尾翼、兩面照後鏡的玻璃自己一組；smoke 併進 trim）；
//      頂點換到車子座標、貼圖的 repeat 算進 uv、同一組顏色不一樣的放進頂點色；貼圖存成 PNG（flipY 的上下翻過來，uv 不動：法線貼圖的方向才對）
//   2. Node：每組焊接頂點、meshoptimizer 簡化（邊界鎖住：組跟組接的地方不會裂開）
//   3. 寫 glb：每組一個 node（extras：slot、part＝body／wing／mirror、side＝R／L、uv＝[u0, v0, du, dv]），位置 int16（node 的 scale／translation 還原）、
//      法線 int16、uv uint16（執行時照 extras.uv 還原）、頂點色 uint8；材質名字＝slot，貼圖跟著材質（map、normalMap、emissiveMap）
//   4. 量車身（沿著 x／y／z 軸的射線打烘焙好的車身）→ cabin.js 的 FIT.gc8、wings.js 的 WINGS_DECK.gc8、wide.js 的 WIDE.gc8
//   輕量車（body-gc8-lod.glb）是 make-lod.mjs 再從 body-gc8-q.glb 做的：node make-lod.mjs gc8 --rebake
import fs from 'node:fs';
import path from 'node:path';
import { MeshoptSimplifier as MS } from 'meshoptimizer';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import { serve, browser, DIR } from './lod-serve.mjs';

const INV = process.argv.includes('--inv'), WRITE = process.argv.includes('--write'), RAWG = process.argv.includes('--raw'); // --raw：不簡化，寫到 ../out/gc8b/body-gc8-raw.glb（比對用）
const OUT = path.join(DIR, '../out/gc8b'), CACHE = path.join(OUT, 'bake.json');
fs.mkdirSync(OUT, { recursive: true });

// ---------- 1. Chromium 組車、分組 ----------
if (INV || process.argv.includes('--rebake') || !fs.existsSync(CACHE)) {
  const srv = await serve(), b = await browser(), p = await b.newPage();
  p.setDefaultTimeout(600000);
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('console', m.text().slice(0, 300)); else if (m.type() === 'warning' || m.type() === 'log') console.log('page', m.text().slice(0, 300)); });
  await p.route('**/__bake.html', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script><body></body>' }));
  await p.goto(`${srv.url}/__bake.html`);
  const R = await p.evaluate(async ({ INV }) => {
    const THREE = await import('three');
    const BGU = await import('three/addons/utils/BufferGeometryUtils.js');
    window.__THREE = THREE; window.__BGU = BGU;
    for (const f of ['/gc8-model.js', '/gc8-ao.js']) await new Promise((ok) => { const s = document.createElement('script'); s.src = f; s.onload = ok; document.head.appendChild(s); });
    const t0 = performance.now(), car = window.__CAR2.build(THREE, { bake: true, color: 0xffffff }), ms = performance.now() - t0;
    const g = car.group; g.updateMatrixWorld(true);
    // 第 54 批：車子自己的暗影（gc8-ao.js）：車漆 → aoMap（512×256），其他不透明的零件 → 每個頂點（乘進頂點色）；輪胎照 gc8-model.js 的位置放圓柱
    const C2 = window.__CAR2, WH = [];
    for (const x of [C2.XF, C2.XR]) for (const s of [1, -1]) WH.push({ x, y: C2.RW, r: C2.RW, z0: s * C2.TRACK - C2.TW / 2, z1: s * C2.TRACK + C2.TW / 2 });
    const AOS = INV ? null : window.__AO.bake(THREE, g, { N: 48, D: 0.35, W: 512, H: 256, wheels: WH, paintMat: car.mats.paint, body: g.getObjectByName('car2-body'), nose: 'noseCap' });
    const AOK = 0.8; // 頂點的暗影：乘進顏色的強度（1＝全部）
    const WING = new Set(['wing', 'wingLeg', 'wingFoot', 'wingBase', 'stopBox', 'stopLamp']);
    const KEEPUV = new Set(['car2-body', 'noseCap', 'lip']); // 車漆：這幾塊的 uv 就是車身貼圖（門縫）的 uv；其他的車漆零件給一個沒有縫的地方
    const MERGE = { smoke: 'trim' }; // 太小的組併到顏色差不多的
    const b64 = (a) => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
    const texId = new Map(), texOut = []; // 貼圖（照圖片）→ 編號；PNG（flipY 的上下翻）
    const texOf = (t) => {
      if (!t) return -1;
      const key = t.source.uuid + (t.flipY ? 'F' : '');
      if (texId.has(key)) return texId.get(key);
      const img = t.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); if (t.flipY) { x.translate(0, c.height); x.scale(1, -1); } x.drawImage(img, 0, 0);
      texOut.push({ png: c.toDataURL('image/png'), w: c.width, h: c.height, srgb: t.colorSpace === THREE.SRGBColorSpace, wrap: t.wrapS === THREE.RepeatWrapping });
      texId.set(key, texOut.length - 1); return texOut.length - 1;
    };
    const B = new Map(), inv = [];
    const v = new THREE.Vector3(), nm = new THREE.Matrix3(), tm = new THREE.Matrix3(), cent = new THREE.Vector3();
    g.traverse((o) => {
      if (!o.isMesh) return;
      const geo = o.geometry, pos = geo.attributes.position, nrm = geo.attributes.normal, uv = geo.attributes.uv, I = geo.index;
      const total = I ? I.count : pos.count;
      const ranges = Array.isArray(o.material) ? (geo.groups.length ? geo.groups : [{ start: 0, count: total, materialIndex: 0 }]).map((r) => ({ ...r, m: o.material[r.materialIndex] })) : [{ start: 0, count: total, m: o.material }];
      if (!nrm) geo.computeVertexNormals();
      const N = geo.attributes.normal, M = o.matrixWorld, flip = M.determinant() < 0;
      nm.getNormalMatrix(M);
      for (const r of ranges) {
        const m = r.m, cnt = Math.min(r.count, total - r.start); if (!m || cnt <= 0) continue;
        let slot = m.userData.slot;
        if (!slot) { console.warn('沒有 slot', o.name, m.type, m.color?.getHexString()); continue; }
        if (slot === 'interior') continue;
        slot = MERGE[slot] || slot;
        const part = WING.has(o.name) ? 'wing' : o.name === 'mirrorGlass' ? 'mirror' : 'body';
        let side = '';
        if (part === 'mirror') { geo.computeBoundingBox(); geo.boundingBox.getCenter(cent).applyMatrix4(M); side = cent.z > 0 ? 'R' : 'L'; }
        const tex = slot === 'paint' ? null : { map: texOf(m.map), normalMap: texOf(m.normalMap), emissiveMap: texOf(m.emissiveMap) };
        const key = `${part}|${slot}|${side}|${tex ? `${tex.map},${tex.normalMap},${tex.emissiveMap}` : ''}`;
        let bk = B.get(key);
        if (!bk) B.set(key, (bk = { part, slot, side, tex, P: [], N: [], U: [], C: [], I: [], cols: new Set(), mats: [], dbl: false, names: new Set() }));
        if (slot === 'paint' && m.map && !bk.tex) bk.tex = { map: texOf(m.map), normalMap: texOf(m.normalMap), emissiveMap: -1, aoMap: texOf(m.aoMap) };
        const AOV = slot === 'paint' || window.__AO.NOVERT.has(slot) ? null : geo.userData.ao; // 第 54 批：這個零件每個頂點的暗影（車身網格的玻璃跟飾條共用頂點：玻璃不要）
        const col = m.color.clone(); bk.cols.add(col.getHexString()); bk.names.add(o.name || '?');
        let fl = flip;
        if (slot === 'paint' && m.side === THREE.DoubleSide) { // 車漆是單面的：兩面都畫的零件（霧燈蓋）照「往車子外面」把三角形轉對方向
          let s = 0; const a = new THREE.Vector3(), b3 = new THREE.Vector3(), c3 = new THREE.Vector3(), n3 = new THREE.Vector3();
          for (let t = r.start; t + 2 < r.start + cnt; t += 3) {
            a.fromBufferAttribute(pos, I ? I.getX(t) : t).applyMatrix4(M); b3.fromBufferAttribute(pos, I ? I.getX(t + 1) : t + 1).applyMatrix4(M); c3.fromBufferAttribute(pos, I ? I.getX(t + 2) : t + 2).applyMatrix4(M);
            n3.subVectors(b3, a).cross(c3.clone().sub(a)); const cx = (a.x + b3.x + c3.x) / 3, cy = (a.y + b3.y + c3.y) / 3 - 0.55, cz = (a.z + b3.z + c3.z) / 3;
            s += n3.x * cx + n3.y * cy + n3.z * cz;
          }
          if (s < 0) fl = !flip;
        } else bk.dbl ||= m.side === THREE.DoubleSide;
        bk.mats.push({ name: o.name, type: m.type, color: '#' + m.color.getHexString(), r: m.roughness, mt: m.metalness, cc: m.clearcoat || 0, em: m.emissive ? [m.emissive.r, m.emissive.g, m.emissive.b, m.emissiveIntensity] : null, op: m.transparent ? m.opacity : 1, tr: m.transmission || 0, at: m.alphaTest });
        // uv：有貼圖的照那張貼圖的 matrix（repeat、offset）算好；車漆的其他零件全部放在一個沒有縫的點
        const tx = slot === 'paint' ? (KEEPUV.has(o.name) && uv ? m.map : null) : (m.map || m.normalMap || m.emissiveMap);
        if (tx) { tx.updateMatrix(); tm.copy(tx.matrix); }
        const base = bk.P.length / 3, map = new Map();
        const vert = (i) => {
          let k = map.get(i); if (k !== undefined) return k;
          k = base + map.size; map.set(i, k);
          v.fromBufferAttribute(pos, i).applyMatrix4(M); bk.P.push(v.x, v.y, v.z);
          v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); if (fl !== flip) v.negate(); bk.N.push(v.x, v.y, v.z);
          if (tx && uv) { v.set(uv.getX(i), uv.getY(i), 1).applyMatrix3(tm); bk.U.push(v.x, v.y); } else bk.U.push(0.5, 0.5);
          const a = AOV ? 1 - AOK * (1 - AOV[i]) : 1; if (a < 0.995) bk.ao = true;
          bk.C.push(col.r * a, col.g * a, col.b * a);
          return k;
        };
        for (let t = r.start; t + 2 < r.start + cnt; t += 3) {
          const a = vert(I ? I.getX(t) : t), b2 = vert(I ? I.getX(t + 1) : t + 1), c2 = vert(I ? I.getX(t + 2) : t + 2);
          if (fl) bk.I.push(a, c2, b2); else bk.I.push(a, b2, c2);
        }
        inv.push({ part, slot, side, name: o.name, tris: Math.floor(cnt / 3), col: '#' + m.color.getHexString(), tex: tex ? `${tex.map},${tex.normalMap},${tex.emissiveMap}` : '', uv: !!uv, keepUV: !!tx });
      }
    });
    // 車漆沒有縫的點：車頂中間（x≈−0.5、剖面的最上面）→ uv 是 (i/(nx−1), j/(M−1))，直接找 car2-body 車頂那一點的 uv
    const body = g.getObjectByName('car2-body'), bp = body.geometry.attributes.position, bu = body.geometry.attributes.uv;
    let best = -1, bd = 1e9; for (let i = 0; i < bp.count; i++) { const d = Math.hypot(bp.getX(i) + 0.5, bp.getY(i) - 2, bp.getZ(i)); if (d < bd) { bd = d; best = i; } }
    const clean = [bu.getX(best), bu.getY(best)];
    const out = [];
    for (const bk of B.values()) {
      if (bk.slot === 'paint') for (let i = 0; i < bk.U.length; i += 2) if (bk.U[i] === 0.5 && bk.U[i + 1] === 0.5) { bk.U[i] = clean[0]; bk.U[i + 1] = clean[1]; }
      out.push({ part: bk.part, slot: bk.slot, side: bk.side, tex: bk.tex, cols: [...bk.cols], ao: !!bk.ao, dbl: bk.dbl, names: [...bk.names], mats: bk.mats,
        P: b64(new Float32Array(bk.P)), N: b64(new Float32Array(bk.N)), U: b64(new Float32Array(bk.U)), C: b64(new Float32Array(bk.C)), I: b64(new Uint32Array(bk.I)) });
    }
    return { ms, inv, buckets: out, tex: texOut, clean, aos: AOS };
  }, { INV });
  await b.close(); srv.close();
  console.log('build', Math.round(R.ms), 'ms;', R.buckets.length, 'groups;', R.tex.length, 'textures; clean uv', R.clean.map((v) => v.toFixed(4)).join(','));
  if (R.aos) console.log('暗影：三角形', R.aos.tris, '節點', R.aos.nodes, '頂點', R.aos.verts, '（不一樣的', R.aos.uniq, '）車漆格子', R.aos.samples, '射線', R.aos.rays, '時間（BVH／頂點／車漆）', R.aos.ms.join('／'), 'ms');
  if (INV) {
    const rows = {};
    for (const r of R.inv) { const k = `${r.part}|${r.slot}${r.side}|${r.name}|${r.col}|${r.tex}|uv${+r.uv}${r.keepUV ? 'K' : ''}`; (rows[k] ??= { n: 0, tris: 0 }).n++; rows[k].tris += r.tris; }
    for (const [k, v] of Object.entries(rows).sort()) console.log(String(v.n).padStart(3), String(v.tris).padStart(7), k);
    process.exit(0);
  }
  fs.writeFileSync(CACHE, JSON.stringify(R));
}

// ---------- 2. 焊接、簡化 ----------
await MS.ready;
const R = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
const dec = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const ERR = { paint: 0.0004, glass: 0.0004, trim: 0.0003, dark: 0.0008, reflector: 0.0004, under: 0.002 }; // 簡化誤差（公尺）；沒寫的 0.0003（第 54 批：車底 2 公釐，看不太到）
const NW = { paint: 1, glass: 1 }; // 法線算多重（沒寫的 0.3）：車漆、玻璃會反光，法線差一點點就看得出波浪（車漆 0.02 的時候大燈下面、保桿上緣一片皺皺的）
const paintTex = R.buckets.find((b) => b.slot === 'paint' && b.tex)?.tex;
// 焊接：位置、法線（、uv、顏色）都一樣（四捨五入）才是同一點；posOnly：只看位置（車內那一層）
function weld(P0, N0, U0, C0, I0, hasT, hasC, posOnly = false) {
  const n0 = P0.length / 3, remap = new Uint32Array(n0), seen = new Map(), keep = [];
  for (let i = 0; i < n0; i++) {
    let k = `${Math.round(P0[i * 3] * 1e5)},${Math.round(P0[i * 3 + 1] * 1e5)},${Math.round(P0[i * 3 + 2] * 1e5)}`;
    if (!posOnly) k += `|${Math.round(N0[i * 3] * 500)},${Math.round(N0[i * 3 + 1] * 500)},${Math.round(N0[i * 3 + 2] * 500)}`;
    if (hasT && !posOnly) k += `|${Math.round(U0[i * 2] * 2e4)},${Math.round(U0[i * 2 + 1] * 2e4)}`;
    if (hasC && !posOnly) k += `|${Math.round(C0[i * 3] * 255)},${Math.round(C0[i * 3 + 1] * 255)},${Math.round(C0[i * 3 + 2] * 255)}`;
    let j = seen.get(k); if (j === undefined) { j = keep.length; seen.set(k, j); keep.push(i); }
    remap[i] = j;
  }
  const nv = keep.length, P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), C = new Float32Array(nv * 3);
  keep.forEach((i, j) => { P.set(P0.subarray(i * 3, i * 3 + 3), j * 3); N.set(N0.subarray(i * 3, i * 3 + 3), j * 3); if (U0) U.set(U0.subarray(i * 2, i * 2 + 2), j * 2); if (C0) C.set(C0.subarray(i * 3, i * 3 + 3), j * 3); });
  const J = []; for (let t = 0; t < I0.length; t += 3) { const a = remap[I0[t]], b = remap[I0[t + 1]], c = remap[I0[t + 2]]; if (a !== b && b !== c && a !== c) J.push(a, b, c); } // 焊完變成一條線的三角形丟掉
  return { P, N, U, C, I: new Uint32Array(J) };
}
// 簡化：法線（＋uv＋顏色）也算誤差；邊界鎖住（組跟組接的地方不動）；用到的頂點重新編號
function simp(w, hasT, hasC, err, attrs = true, nw = 0.3) {
  const nv = w.P.length / 3, st = attrs ? 3 + (hasT ? 2 : 0) + (hasC ? 3 : 0) : 0, A = new Float32Array(Math.max(1, nv * st)), W = [];
  if (attrs) { W.push(nw, nw, nw); if (hasT) W.push(0.05, 0.05); if (hasC) W.push(0.05, 0.05, 0.05);
    for (let j = 0; j < nv; j++) { let o = j * st; A[o++] = w.N[j * 3]; A[o++] = w.N[j * 3 + 1]; A[o++] = w.N[j * 3 + 2]; if (hasT) { A[o++] = w.U[j * 2]; A[o++] = w.U[j * 2 + 1]; } if (hasC) { A[o++] = w.C[j * 3]; A[o++] = w.C[j * 3 + 1]; A[o++] = w.C[j * 3 + 2]; } } }
  const [S] = attrs ? MS.simplifyWithAttributes(w.I, w.P, 3, A, st, W, null, 0, err, ['LockBorder', 'ErrorAbsolute']) : MS.simplify(w.I, w.P, 3, 0, err, ['LockBorder', 'ErrorAbsolute']);
  const used = new Int32Array(nv).fill(-1), order = []; for (const i of S) if (used[i] < 0) { used[i] = order.length; order.push(i); }
  const m = order.length, P = new Float32Array(m * 3), N = new Float32Array(m * 3), U = new Float32Array(m * 2), C = new Float32Array(m * 3);
  order.forEach((i, j) => { P.set(w.P.subarray(i * 3, i * 3 + 3), j * 3); N.set(w.N.subarray(i * 3, i * 3 + 3), j * 3); U.set(w.U.subarray(i * 2, i * 2 + 2), j * 2); C.set(w.C.subarray(i * 3, i * 3 + 3), j * 3); });
  const I = new Uint32Array(S.length); for (let t = 0; t < S.length; t++) I[t] = used[S[t]];
  return { P, N, U, C, I };
}
const RAW = {}; // 焊好、還沒簡化的（車內那一層、量車身用）
const G = R.buckets.map((bk) => {
  const P0 = dec(bk.P, Float32Array), N0 = dec(bk.N, Float32Array), U0 = dec(bk.U, Float32Array), C0 = dec(bk.C, Float32Array), I0 = dec(bk.I, Uint32Array);
  const tex = bk.slot === 'paint' ? paintTex : bk.tex, hasT = bk.slot === 'paint' || (!!tex && (tex.map >= 0 || tex.normalMap >= 0 || tex.emissiveMap >= 0)), hasC = bk.cols.length > 1 || !!bk.ao; // 第 54 批：有暗影的組也要頂點色
  const w = weld(P0, N0, U0, C0, I0, hasT, hasC), before = w.I.length / 3;
  RAW[`${bk.part}|${bk.slot}${bk.side}`] ??= []; RAW[`${bk.part}|${bk.slot}${bk.side}`].push(w);
  const s = RAWG ? { ...w } : simp(w, hasT, hasC, ERR[bk.slot] ?? 0.0003, true, NW[bk.slot] ?? 0.3);
  return { ...bk, tex, ...s, U: hasT ? s.U : null, C: hasC ? s.C : null, hasT, hasC, before, tris: s.I.length / 3 };
});
// 車內那一層：車身的車漆＋飾條（只看位置焊起來，簡化 2 公釐；車窗的洞是邊界，不會被蓋住）；畫背面，暗灰色
{
  const L = [...RAW['body|paint'], ...RAW['body|trim']]; let n = 0; const P = [], I = [];
  for (const w of L) { for (const v of w.P) P.push(v); for (const i of w.I) I.push(i + n); n += w.P.length / 3; }
  const w = weld(new Float32Array(P), new Float32Array(P.length), null, null, new Uint32Array(I), false, false, true);
  const s = simp(w, false, false, 0.002, false);
  // 法線：照三角形面積平均（朝外；畫背面的時候 three.js 自己翻過來）
  const N = new Float32Array(s.P.length);
  for (let t = 0; t < s.I.length; t += 3) { const a = s.I[t] * 3, b = s.I[t + 1] * 3, c = s.I[t + 2] * 3, ux = s.P[b] - s.P[a], uy = s.P[b + 1] - s.P[a + 1], uz = s.P[b + 2] - s.P[a + 2], vx = s.P[c] - s.P[a], vy = s.P[c + 1] - s.P[a + 1], vz = s.P[c + 2] - s.P[a + 2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const k of [a, b, c]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; } }
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
  G.push({ part: 'body', slot: 'inside', side: '', tex: null, cols: ['2c2e33'], dbl: false, P: s.P, N, U: null, C: null, I: s.I, hasT: false, hasC: false, before: w.I.length / 3, tris: s.I.length / 3 });
}
let tot0 = 0, tot = 0;
for (const g of G) { tot0 += g.before; tot += g.tris; console.log(`${g.part}|${g.slot}${g.side}`.padEnd(18), String(g.before).padStart(7), '→', String(g.tris).padStart(6), `v ${g.P.length / 3}`, g.hasT ? `tex ${JSON.stringify(g.tex)}` : '', g.hasC ? `cols ${g.cols.join(',')}` : `col ${g.cols[0]}`, g.dbl ? 'double' : ''); }
console.log('total', tot0, '→', tot);

// ---------- 3. 寫 glb ----------
const doc = new Document(), buf = doc.createBuffer(), scene = doc.createScene('gc8');
doc.createExtension(KHRMeshQuantization).setRequired(true);
const TEX = R.tex.map((t, i) => doc.createTexture(`t${i}`).setImage(Buffer.from(t.png.split(',')[1], 'base64')).setMimeType('image/png'));
const lin = (h) => [1, 3, 5].map((i) => { const c = parseInt(h.slice(i - 1, i + 1), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
// 整台車用同一個量化格子（位置）：組跟組接的地方量化完還是同一點
let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
for (const g of G) for (let i = 0; i < g.P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], g.P[i + k]); hi[k] = Math.max(hi[k], g.P[i + k]); }
const QC = lo.map((v, k) => (v + hi[k]) / 2), QH = Math.max(...lo.map((v, k) => (hi[k] - v) / 2));
const names = new Set(), mats = new Map();
for (const g of G) {
  const m0 = g.mats?.[0];
  const mk = g.slot === 'paint' ? 'paint' : `${g.part}|${g.slot}${g.side}|${JSON.stringify(g.tex)}`;
  let mat = mats.get(mk);
  if (!mat) {
    mat = doc.createMaterial(g.slot).setDoubleSided(!!g.dbl).setBaseColorFactor([...(g.hasC ? [1, 1, 1] : lin(g.cols[0])), 1]);
    if (m0) { mat.setRoughnessFactor(m0.r ?? 0.5).setMetallicFactor(m0.mt ?? 0); if (m0.em) mat.setEmissiveFactor([m0.em[0] * m0.em[3], m0.em[1] * m0.em[3], m0.em[2] * m0.em[3]]); }
    if (g.tex?.map >= 0) mat.setBaseColorTexture(TEX[g.tex.map]);
    if (g.tex?.normalMap >= 0) mat.setNormalTexture(TEX[g.tex.normalMap]);
    if (g.tex?.emissiveMap >= 0) mat.setEmissiveTexture(TEX[g.tex.emissiveMap]);
    if (g.tex?.aoMap >= 0) mat.setOcclusionTexture(TEX[g.tex.aoMap]); // 第 54 批：車漆的暗影（遊戲裡 aoMap）
    mat.setExtras({ slot: g.slot, cc: m0?.cc ?? 0, at: m0?.at ?? 0 });
    mats.set(mk, mat);
  }
  const nv = g.P.length / 3, qp = new Int16Array(nv * 3), qn = new Int16Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) { qp[i] = Math.round(((g.P[i] - QC[i % 3]) / QH) * 32767); qn[i] = Math.round(Math.max(-1, Math.min(1, g.N[i])) * 32767); }
  const prim = doc.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(qp).setNormalized(true).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(qn).setNormalized(true).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(nv < 65536 ? new Uint16Array(g.I) : g.I).setBuffer(buf));
  const ex = { slot: g.slot, part: g.part, side: g.side };
  if (g.slot === 'paint') ex.clean = R.clean.map((v) => +v.toFixed(6)); // 車漆沒有門縫的 uv（執行時給沒有 uv 的車漆零件）
  if (g.hasT) { // uv：uint16，執行時 u＝u0＋du·q
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9; for (let i = 0; i < nv; i++) { u0 = Math.min(u0, g.U[i * 2]); u1 = Math.max(u1, g.U[i * 2]); v0 = Math.min(v0, g.U[i * 2 + 1]); v1 = Math.max(v1, g.U[i * 2 + 1]); }
    const du = Math.max(u1 - u0, 1e-6), dv = Math.max(v1 - v0, 1e-6), qu = new Uint16Array(nv * 2);
    for (let i = 0; i < nv; i++) { qu[i * 2] = Math.round(((g.U[i * 2] - u0) / du) * 65535); qu[i * 2 + 1] = Math.round(((g.U[i * 2 + 1] - v0) / dv) * 65535); }
    prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(qu).setNormalized(true).setBuffer(buf));
    ex.uv = [u0, v0, du, dv].map((v) => +v.toPrecision(8));
  }
  if (g.hasC) { const qc = new Uint8Array(nv * 3); for (let i = 0; i < nv * 3; i++) qc[i] = Math.round(Math.max(0, Math.min(1, g.C[i])) * 255); prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(qc).setNormalized(true).setBuffer(buf)); }
  let name = `${g.part}_${g.slot}${g.side}`; for (let k = 2; names.has(name); k++) name = `${g.part}_${g.slot}${g.side}${k}`; names.add(name);
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)).setTranslation(QC).setScale([QH, QH, QH]).setExtras(ex));
}
const glb = await new NodeIO().registerExtensions([KHRMeshQuantization]).writeBinary(doc);
fs.writeFileSync(RAWG ? path.join(OUT, 'body-gc8-raw.glb') : path.join(DIR, 'body-gc8-q.glb'), glb);
console.log('body-gc8-q.glb', (glb.length / 1e6).toFixed(2), 'MB; textures', R.tex.map((t, i) => `t${i} ${t.w}x${t.h} ${(t.png.length * 0.75 / 1e3).toFixed(0)}KB`).join(', '));

// ---------- 4. 量車身：沿著軸的射線打烘焙好的車身 → cabin.js 的 FIT.gc8、wings.js 的 WINGS_DECK.gc8、wide.js／wide.json 的 WIDE.gc8 ----------
// 車身＝part body 的每一組（車內那一層不算）；後照鏡殼（車漆、中心 |z|＞0.835、y＞0.85）、車頂通風口（飾條／黑色、三點都 y＞1.38）不算：以前量的 SDF 車身也沒有這些
// 意思跟 cabin-fit.mjs、make-wide.mjs 量 SDF 的一樣（那兩個不再量 gc8）：S＝中線往外第一個碰到的面；T＝從上面往下第一個面；車窗＝從外面看第一個面是玻璃
const TP = [], TS = [], TN = []; // 每個三角形：9 個座標、組名、單位法線
for (const g of G) {
  if (g.part !== 'body' || g.slot === 'inside' || g.slot === 'under' || g.slot === 'defrost') continue; // 第 54 批：車底的零件（消音器、油箱⋯）、除霧線不算（以前量的車身沒有）
  for (let t = 0; t < g.I.length; t += 3) {
    const v = [g.I[t], g.I[t + 1], g.I[t + 2]].map((i) => [g.P[i * 3], g.P[i * 3 + 1], g.P[i * 3 + 2]]);
    if (g.slot === 'paint' && Math.abs(v[0][2] + v[1][2] + v[2][2]) / 3 > 0.835 && (v[0][1] + v[1][1] + v[2][1]) / 3 > 0.85) continue;
    if ((g.slot === 'trim' || g.slot === 'dark') && Math.min(v[0][1], v[1][1], v[2][1]) > 1.38) continue;
    const u = [0, 1, 2].map((k) => v[1][k] - v[0][k]), w = [0, 1, 2].map((k) => v[2][k] - v[0][k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(...n) || 1;
    TP.push(...v.flat()); TS.push(g.slot); TN.push(n[0] / l, n[1] / l, n[2] / l);
  }
}
// 每個軸一張 2 公分的格子（另外兩軸）：射線只看那一格裡的三角形
const CELL = 0.02, ck = (a, b) => (Math.floor(a / CELL) + 4096) * 8192 + Math.floor(b / CELL) + 4096;
const GRID = [0, 1, 2].map((d) => {
  const [ia, ib] = [0, 1, 2].filter((k) => k !== d), M = new Map();
  for (let n = 0; n < TS.length; n++) {
    const o = n * 9, as = [TP[o + ia], TP[o + 3 + ia], TP[o + 6 + ia]], bs = [TP[o + ib], TP[o + 3 + ib], TP[o + 6 + ib]];
    for (let a = Math.floor(Math.min(...as) / CELL); a <= Math.floor(Math.max(...as) / CELL); a++) for (let b = Math.floor(Math.min(...bs) / CELL); b <= Math.floor(Math.max(...bs) / CELL); b++) {
      const k = (a + 4096) * 8192 + b + 4096; let L = M.get(k); if (!L) M.set(k, (L = [])); L.push(n);
    }
  }
  return { d, ia, ib, M };
});
// 沿著軸 d 穿過 (a, b)（另外兩軸，照 x、y、z 的順序）的直線：全部的交點，照深度 t 排好 [{ t, slot, n }]
function hits(d, a, b) {
  const g = GRID[d], out = [];
  for (const n of g.M.get(ck(a, b)) || []) {
    const o = n * 9, x1 = TP[o + g.ia], y1 = TP[o + g.ib], x2 = TP[o + 3 + g.ia], y2 = TP[o + 3 + g.ib], x3 = TP[o + 6 + g.ia], y3 = TP[o + 6 + g.ib];
    const den = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3); if (Math.abs(den) < 1e-14) continue; // 側著看的三角形
    const l1 = ((y2 - y3) * (a - x3) + (x3 - x2) * (b - y3)) / den, l2 = ((y3 - y1) * (a - x3) + (x1 - x3) * (b - y3)) / den, l3 = 1 - l1 - l2;
    if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
    out.push({ t: l1 * TP[o + d] + l2 * TP[o + 3 + d] + l3 * TP[o + 6 + d], slot: TS[n], n: [TN[n * 3], TN[n * 3 + 1], TN[n * 3 + 2]] });
  }
  return out.sort((p, q) => p.t - q.t);
}
const Xr = (y, z) => hits(0, y, z), Yr = (x, z) => hits(1, x, z), Zr = (x, y) => hits(2, x, y), mm = (v) => Math.round(v * 1000);
// 從上面往下第一個面（黑色的凹槽、網子不算；飾條底下 3 公分內有玻璃就算玻璃：雨刷、玻璃邊條）
const topHit = (x, z) => {
  const H = Yr(x, z);
  for (let i = H.length - 1; i >= 0; i--) { const h = H[i]; if (h.slot === 'dark') continue; if (h.slot === 'trim' && H.some((q) => q.slot === 'glass' && q.t < h.t && q.t > h.t - 0.03)) continue; return h; }
  return null;
};
const WHL = (await import('./gc8-spec.js')).GC8_SPEC.wheels, X0 = -1.9, NX = 32, Y0 = 0.2, NY = 12, NZ = 11;
// ---- cabin.js 的 FIT.gc8（格子、單位跟 cabin-fit.mjs 一樣）----
const FIT = {};
{
  const S = [], T = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = X0 + i * 0.1, y = Y0 + j * 0.1, V = Yr(x, 0); // 中線上這一點在車身裡面＝上下都有面
    const z = V.length > 1 && V[0].t < y && y < V[V.length - 1].t ? Zr(x, y).find((h) => h.t > 0.001)?.t ?? 0 : 0;
    S.push(mm(z));
  }
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) T.push(mm(topHit(X0 + i * 0.1, k * 0.1)?.t ?? 0));
  let bs = 0, bn = 0;
  for (let i = 0; i <= 16; i++) for (let k = 0; k <= 6; k++) { const h = Yr(-1 + i * 0.1, k * 0.1)[0]; if (h && h.t < 1) { bs += h.t; bn++; } }
  // 輪拱（z＝0.7）：輪心高度從輪心往車艙走到第一個面（走 0.8 公尺都沒有：高 20 公分再走），輪心往上第一個面
  const arch = (xc, R, dir) => {
    const walk = (y) => { const H = Xr(y, 0.7).filter((h) => (h.t - xc) * dir > 0 && Math.abs(h.t - xc) < 0.8); return H.length ? (dir > 0 ? H[0].t : H[H.length - 1].t) : null; };
    const x = walk(R) ?? walk(R + 0.2) ?? xc + dir * 0.8, y = Yr(xc, 0.7).find((h) => h.t > R && h.t < R + 0.8)?.t ?? R + 0.8;
    return `${mm(x)} ${mm(y)}`;
  };
  // 側窗：每個 x 從外面看（z 最大的面）是側面的玻璃（|法線 z|＞0.5）的最低、最高 y（每 4 公釐）
  // B 柱（v65）：前後 3 公分都是玻璃的黑條算玻璃（不然 x＝−0.5 那一格的下緣跳到柱子上面，車內的門板線會凸一塊）
  const belt = [], st = [];
  const sideG = (x, y) => { const H = Zr(x, y), h = H[H.length - 1]; return !!h && h.slot === 'glass' && Math.abs(h.n[2]) > 0.5; };
  for (let i = 0; i < NX; i++) {
    let lo = 0, hi = 0;
    for (let q = 0; q <= 350; q++) { const x = X0 + i * 0.1, y = q * 0.004, H = Zr(x, y), h = H[H.length - 1]; if (h && ((h.slot === 'glass' && Math.abs(h.n[2]) > 0.5) || ((h.slot === 'trim' || h.slot === 'dark') && sideG(x - 0.03, y) && sideG(x + 0.03, y)))) { if (!lo) lo = mm(y) || 1; hi = mm(y); } }
    belt.push(lo); st.push(hi);
  }
  // 前擋、後擋：每個 |z| 從車頭往後（每 5 公釐）從上面看第一個面：前後的玻璃（|法線 x|＞0.3）＝看得到的玻璃，飾條／黑色＝黑邊；連在一起的一段要有 2 公分以上看得到的玻璃
  const ws = [], wf = [], wt = [], rg = [], rt = [];
  const overGlass = (H) => { const h = H[H.length - 1]; if (h && (h.slot === 'dark' || h.slot === 'trim')) for (let i = H.length - 2; i >= 0 && H[i].t > h.t - 0.03; i--) if (H[i].slot !== 'dark' && H[i].slot !== 'trim') return H[i]; return h; }; // 雨刷（躺在玻璃、前圍上面的黑條）不算：下面 3 公分內有玻璃或車漆就看那一面
  for (let k = 0; k < NZ; k++) {
    const z = k * 0.1, runs = []; let cur = null;
    for (let q = 470; q >= -470; q--) {
      const x = q * 0.005, H = Yr(x, z), h = overGlass(H), vis = !!h && h.slot === 'glass' && Math.abs(h.n[0]) > 0.3, a = vis || (!!h && (h.slot === 'trim' || h.slot === 'dark'));
      if (a) { if (!cur) runs.push((cur = { f: x, vmax: null, vmin: null })); if (vis) { if (cur.vmax == null) cur.vmax = x; cur.vmin = x; } } else cur = null;
    }
    const RR = runs.filter((r) => r.vmax != null && r.vmax - r.vmin > 0.015), w = RR[0], rr = RR.length > 1 ? RR[RR.length - 1] : null; // 玻璃不到 2 公分的（車窗角落）不算
    ws.push(w ? mm(w.vmax) : 0); wf.push(w ? mm(w.f) : 0); wt.push(w ? mm(w.vmin) : 0); rg.push(rr ? mm(rr.vmin) : 0); rt.push(rr ? mm(rr.f) : 0);
  }
  const j = (a) => a.join(' ');
  Object.assign(FIT, { S: j(S), T: j(T), belt: j(belt), st: j(st), ws: j(ws), wf: j(wf), wt: j(wt), rg: j(rg), rt: j(rt), fa: arch(WHL.xf, WHL.R, -1), ra: arch(WHL.xr, WHL.R, 1), bot: Math.round((bs / bn) * 1000) / 1000 });
}
// ---- wings.js 的 WINGS_DECK.gc8：x0 往後每 2 公分 × z 每 5 公分，從上面往下第一個面的高度（公釐）；0＝那裡沒有車身 ----
const DECK_X0 = -1.54, DECK = [];
for (let k = 0; k <= 16; k++) { const row = []; for (let i = 0; i <= 30; i++) row.push(mm(topHit(DECK_X0 - i * 0.02, k * 0.05)?.t ?? 0)); DECK.push(row); }
// ---- wide.js 的 WIDE.gc8（跟 make-wide.mjs 的 axle() 一樣，車身側面 zs 用射線：從外面看第一個面，黑色的不算）----
const zs = (x, y) => { const H = Zr(x, y).filter((h) => h.slot !== 'dark'), h = H[H.length - 1]; return h && h.t > 0.2 ? h.t : null; };
function axle(x, R, track, w, NK = 9, DR = 0.02) {
  const med = (a) => [...a].sort((p, q) => p - q)[a.length >> 1], mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  const win = (v, fn, n) => v.map((_, i) => fn(v.slice(Math.max(0, i - n), i + n + 1)));
  const zt = track + w / 2, th = [], r0s = [];
  for (let deg = -30; deg <= 210; deg += 6) {
    const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    let r0 = null;
    for (let r = R + 0.005; r < R + 0.3; r += 0.005) { const y = R + s * r; if (y < 0.1) break; const q = zs(x + c * r, y); if (q != null && q > zt - 0.1) { r0 = r; break; } }
    if (r0 == null) continue;
    th.push(deg); r0s.push(r0);
  }
  const ra = win(win(r0s, med, 2), mean, 2).map((v) => +v.toFixed(4));
  const yCut = +Math.max(0.1, Math.min(...th.map((d, i) => R + Math.sin((d * Math.PI) / 180) * ra[i]))).toFixed(4);
  const raw = th.map((d, i) => { const t = (d * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), row = []; for (let k = 0; k < NK; k++) { const r = ra[i] + k * DR; row.push(zs(x + c * r, Math.max(yCut, R + s * r))); } return row; });
  for (let i = raw.length - 1; i >= 0; i--) if (raw[i][0] == null) { raw.splice(i, 1); th.splice(i, 1); ra.splice(i, 1); }
  const kn = raw.map((r) => { const k = r.findIndex((v) => v == null); return k < 0 ? NK : k; }), z = raw.map((r) => [...r]);
  for (let k = 0; k < NK; k++) {
    const ok = (i) => i >= 0 && i < raw.length && k < kn[i], pick = (i, fn) => { const a = []; for (let j = i - 1; j <= i + 1; j++) if (ok(j)) a.push(fn(j)); return a; };
    const mx = raw.map((r, i) => (ok(i) ? Math.max(...pick(i, (j) => raw[j][k])) : null));
    raw.forEach((r, i) => { if (ok(i)) z[i][k] = mean(pick(i, (j) => mx[j])); });
  }
  z.forEach((r, i) => { for (let k = 0; k < NK; k++) r[k] = k < kn[i] ? +r[k].toFixed(4) : r[kn[i] - 1]; });
  return { x, y: R, th, ra, z, kn, yCut, zt: +zt.toFixed(4) };
}
const WIDE_GC8 = { f: axle(WHL.xf, WHL.RF ?? WHL.R, WHL.trackF, WHL.wF), r: axle(WHL.xr, WHL.RR ?? WHL.R, WHL.trackR, WHL.wR), dr: 0.02 };
// ---- 跟現在檔案裡的比 ----
const CJ = path.join(DIR, 'cabin.js'), WJ = path.join(DIR, 'wings.js'), DJ = path.join(DIR, 'wide.js'), DN = path.join(DIR, 'wide.json');
const csrc = fs.readFileSync(CJ, 'utf8'), wsrc = fs.readFileSync(WJ, 'utf8');
const oldF = (() => { const m = csrc.match(/^ {4}gc8: (\{S: .*\}),$/m); return m ? Function(`return ${m[1]}`)() : null; })();
const cmp = (a, b, name) => {
  if (a == null) return `${name}: 新的`;
  const A = String(a).split(' ').map(Number), B = String(b).split(' ').map(Number); let n = 0, s = 0, mx = 0, z = 0;
  A.forEach((v, i) => { const w = B[i]; if (!v !== !w) { z++; return; } if (!v) return; n++; s += Math.abs(v - w); mx = Math.max(mx, Math.abs(v - w)); });
  return `${name} ${n ? (s / n).toFixed(1) : '-'}/${mx}${z ? ` 0≠${z}` : ''}`;
};
console.log('FIT.gc8（平均差/最多差 公釐）', Object.keys(FIT).map((k) => (k === 'bot' || k === 'fa' || k === 'ra' ? `${k} ${oldF?.[k]}→${FIT[k]}` : cmp(oldF?.[k], FIT[k], k))).join(' | '));
const deckOld = (() => { const m = wsrc.match(/^gc8: \[(-?[\d.]+), [\d.]+, (\[[\s\S]*?\]\])\],\n/m); return m ? JSON.parse(m[2]) : null; })();
console.log('WINGS_DECK.gc8 z=0：', DECK[0].join(' '));
if (deckOld) console.log('              舊的：', deckOld[0].join(' '));
const wideOld = JSON.parse(fs.readFileSync(DN, 'utf8')).gc8;
for (const a of ['f', 'r']) console.log(`WIDE.gc8 ${a}：角度 ${WIDE_GC8[a].th.length}（${WIDE_GC8[a].th[0]}～${WIDE_GC8[a].th.at(-1)}）切 ${WIDE_GC8[a].yCut} 輪胎 ${WIDE_GC8[a].zt} ra ${Math.min(...WIDE_GC8[a].ra).toFixed(3)}～${Math.max(...WIDE_GC8[a].ra).toFixed(3)} z0 ${Math.min(...WIDE_GC8[a].z.map((r) => r[0])).toFixed(3)}～${Math.max(...WIDE_GC8[a].z.map((r) => r[0])).toFixed(3)}`
  + (wideOld ? ` ｜舊的：角度 ${wideOld[a].th.length} 切 ${wideOld[a].yCut} 輪胎 ${wideOld[a].zt} ra ${Math.min(...wideOld[a].ra).toFixed(3)}～${Math.max(...wideOld[a].ra).toFixed(3)}` : ''));
if (WRITE) {
  const line = `    gc8: {${Object.entries(FIT).map(([k, v]) => (k === 'bot' ? `bot: ${v}` : `${k}: '${v}'`)).join(', ')}},`;
  if (!/^ {4}gc8: \{S: .*\},$/m.test(csrc)) throw new Error('cabin.js 找不到 FIT.gc8 那一行');
  fs.writeFileSync(CJ, csrc.replace(/^ {4}gc8: \{S: .*\},$/m, () => line));
  const deck = `gc8: [${DECK_X0.toFixed(2)}, 0.05, [\n${DECK.map((r) => `  [${r.join(',')}]`).join(',\n')}]],\n`;
  if (!/^gc8: \[[\s\S]*?\]\]\],\n/m.test(wsrc)) throw new Error('wings.js 找不到 WINGS_DECK.gc8');
  fs.writeFileSync(WJ, wsrc.replace(/^gc8: \[[\s\S]*?\]\]\],\n/m, () => deck));
  const all = JSON.parse(fs.readFileSync(DN, 'utf8')); all.gc8 = WIDE_GC8;
  fs.writeFileSync(DN, JSON.stringify(all));
  const head = fs.readFileSync(DJ, 'utf8').split('\n')[0];
  fs.writeFileSync(DJ, head + '\nexport const WIDE = ' + JSON.stringify(all) + ';\n');
  console.log('寫進 cabin.js（FIT.gc8）、wings.js（WINGS_DECK.gc8）、wide.js＋wide.json（WIDE.gc8）');
}
