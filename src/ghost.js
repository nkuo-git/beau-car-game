// 鬼影車（連線第 1 步：排行榜，Nick 2026-10-10「開始做吧」，草稿 https://claude.ai/artifact/6BtzWH7D5uWYMCra2e7DJo 第 7、8 張）
// 錄下一趟（每秒 10 個位置）→ 打包成一小段字串（網站把最好的一趟傳到雲端）→ 照著錄下來的樣子開一台半透明的車（撞不到：不加進任何碰撞）
// 錄：const rec = ghostRecorder(3); rec.reset(); 每一格 rec.add(開始後幾秒, x, z, heading)；到了 rec.end(…)（多補一個，過終點線）；rec.pack() → { hz, c, n, s, d }
//   c＝一組幾個數字：3（x、z、heading：開車的世界，heading 跟 drive.js 一樣）或 1（直線加速：車頭離起跑線幾公尺）
//   n＝幾組；s＝第一組（整數：位置 ×10、方向 ×100）；d＝後面每一組跟前一組的差（Int16、little endian）的 base64
//   方向先接成連續的（不會從 π 跳到 −π），差才會小
// 播：const G = ghostUnpack(包)（看不懂的回 null）；ghostAt(G, 秒, out) 把那一刻的 [x, z, heading] 寫進 out，播完了回 false（停在最後一個）
// 車：ghostCar(LOD_CARS[key] 載好的, key, { label }) → { car, nose, tail, place(x, y, z, heading, pitch), dispose() }
//   淡藍色、半透明、不寫深度；頭上一塊「👻 名字 秒數」；每一格只改位置（不 new 東西）
// 打包（build-art.mjs／build-app.mjs）：接在 carlod.js 後面（用 buildLodCar）
import * as THREE from 'three';
import { buildLodCar } from './carlod.js';

export const { ghostRecorder, ghostPack, ghostUnpack, ghostAt, ghostCar, GHOST_HZ } = (() => {
  const HZ = 10, MAX = 12000, Q = [10, 10, 100]; // 最多 20 分鐘
  const PI2 = Math.PI * 2;

  function ghostRecorder(c, max = MAX) {
    const buf = new Float32Array(max * c);
    let n = 0, pt = -1, px = 0, pz = 0, ph = 0;
    const put = (k, x, z, h) => { const o = n * c; buf[o] = px + (x - px) * k; if (c === 3) { buf[o + 1] = pz + (z - pz) * k; buf[o + 2] = ph + (h - ph) * k; } n++; };
    return {
      reset() { n = 0; pt = -1; },
      add(t, x, z = 0, h = 0) { // 這一格和上一格中間經過的整數格（每 0.1 秒）都補上（線性內插）
        if (pt < 0) { pt = t; px = x; pz = z; ph = h; }
        if (c === 3) { while (h - ph > Math.PI) h -= PI2; while (h - ph < -Math.PI) h += PI2; }
        while (n < max && n / HZ <= t + 1e-6) { const k = t > pt ? (n / HZ - pt) / (t - pt) : 1; put(k < 0 ? 0 : k > 1 ? 1 : k, x, z, h); }
        pt = t; px = x; pz = z; ph = h;
      },
      end(t, x, z = 0, h = 0) { // 最後一格：照最後的速度再往前補一個，播的時候才會開過終點線（不會停在前面一點點）
        this.add(t, x, z, h);
        const tn = n / HZ, tl = (n - 1) / HZ;
        if (n < 1 || n >= max || tn <= t + 1e-6) return;
        const o = (n - 1) * c, dt = t - tl, k = dt > 0.02 ? (tn - t) / dt : 0;
        const ex = px + (px - buf[o]) * k, ez = c === 3 ? pz + (pz - buf[o + 1]) * k : 0, eh = c === 3 ? ph + (ph - buf[o + 2]) * k : 0;
        put(1, ex, ez, eh); // put 從 px 內插到 ex，k＝1 就是 ex
      },
      get n() { return n; },
      pack() { return n ? ghostPack(buf, n, c) : null; },
    };
  }

  function b64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function ghostPack(buf, n, c) {
    const s = [];
    for (let j = 0; j < c; j++) s.push(Math.round(buf[j] * Q[j]));
    const prev = s.slice(), dv = new DataView(new ArrayBuffer(Math.max(0, n - 1) * c * 2));
    for (let i = 1; i < n; i++) for (let j = 0; j < c; j++) {
      let d = Math.round(buf[i * c + j] * Q[j]) - prev[j];
      d = d > 32767 ? 32767 : d < -32767 ? -32767 : d;
      dv.setInt16(((i - 1) * c + j) * 2, d, true); prev[j] += d;
    }
    return { hz: HZ, c, n, s, d: b64(new Uint8Array(dv.buffer)) };
  }
  function ghostUnpack(p) {
    try {
      if (!p || p.hz !== HZ || (p.c !== 1 && p.c !== 3) || !Number.isInteger(p.n) || p.n < 2 || p.n > MAX) return null;
      const c = p.c, n = p.n;
      if (!Array.isArray(p.s) || p.s.length !== c || !p.s.every(Number.isFinite) || typeof p.d !== 'string') return null;
      const bin = atob(p.d);
      if (bin.length !== (n - 1) * c * 2) return null;
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const dv = new DataView(u8.buffer), v = new Float32Array(n * c), cur = p.s.slice();
      for (let j = 0; j < c; j++) v[j] = cur[j] / Q[j];
      for (let i = 1; i < n; i++) for (let j = 0; j < c; j++) { cur[j] += dv.getInt16(((i - 1) * c + j) * 2, true); v[i * c + j] = cur[j] / Q[j]; }
      return { hz: HZ, c, n, v, dur: (n - 1) / HZ };
    } catch { return null; }
  }
  function ghostAt(G, t, out) {
    const f = Math.max(0, t) * G.hz, i = Math.floor(f), c = G.c, v = G.v;
    if (i >= G.n - 1) { const o = (G.n - 1) * c; for (let j = 0; j < c; j++) out[j] = v[o + j]; return false; }
    const k = f - i, o = i * c;
    for (let j = 0; j < c; j++) out[j] = v[o + j] + (v[o + c + j] - v[o + j]) * k;
    return true;
  }

  // ---- 鬼影車：輕量車換成淡藍色、半透明 ----
  const BOX = new THREE.Box3();
  function tagTexture(text) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    const g = cv.getContext('2d');
    g.font = '700 46px "Noto Sans TC","PingFang TC",sans-serif';
    const w = Math.min(500, g.measureText(text).width + 44);
    g.fillStyle = 'rgba(10,10,12,0.75)';
    const x0 = (512 - w) / 2, r = 18;
    g.beginPath(); g.moveTo(x0 + r, 8); g.arcTo(x0 + w, 8, x0 + w, 88, r); g.arcTo(x0 + w, 88, x0, 88, r); g.arcTo(x0, 88, x0, 8, r); g.arcTo(x0, 8, x0 + w, 8, r); g.closePath(); g.fill();
    g.fillStyle = '#eaf4ff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 50, 470);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  }
  function ghostCar(sc, key, o = {}) {
    const lod = buildLodCar(key, sc, { paint: '#cfe6ff', finish: 'gloss', glow: 'none', livery: 'none', tint: 'light', wing: o.wing });
    const { body, glass, rims } = lod.meshes, bm = body.material, gm = glass.material, rm = rims.material;
    Object.assign(bm, { transparent: true, opacity: 0.42, depthWrite: false, side: THREE.FrontSide }); bm.needsUpdate = true; // 車身和輪胎同一個材質
    Object.assign(rm, { transparent: true, opacity: 0.42, depthWrite: false }); rm.needsUpdate = true;
    gm.opacity = 0.16;
    lod.car.traverse((m) => { if (m.isMesh) { m.renderOrder = 5; m.frustumCulled = true; } });
    glass.renderOrder = 6;
    lod.car.position.set(0, 0, 0); lod.car.rotation.set(0, 0, 0); lod.car.updateMatrixWorld(true);
    BOX.setFromObject(lod.car);
    const nose = BOX.max.x, tail = BOX.min.x, top = BOX.max.y;
    lod.car.rotation.order = 'YXZ'; // 先轉方向（y），再抬頭（z：車頭朝 +x）
    let tag = null;
    if (o.label) {
      const mat = new THREE.SpriteMaterial({ map: tagTexture(o.label), transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }); // 遠近都一樣大（畫面高的 4.5%）
      tag = new THREE.Sprite(mat); tag.scale.set(0.24, 0.045, 1); tag.position.set((nose + tail) / 2, top + 0.75, 0); tag.renderOrder = 7;
      lod.car.add(tag);
    }
    lod.car.name = 'ghost-' + key;
    return {
      car: lod.car, nose, tail, key,
      place(x, y, z, h, pitch = 0) { lod.car.position.set(x, y, z); lod.car.rotation.set(0, h, pitch); },
      roll(dist) { lod.setRoll(dist); },
      dispose() {
        if (tag) { tag.material.map.dispose(); tag.material.dispose(); tag.removeFromParent(); }
        lod.dispose();
      },
    };
  }
  return { ghostRecorder, ghostPack, ghostUnpack, ghostAt, ghostCar, GHOST_HZ: HZ };
})();
