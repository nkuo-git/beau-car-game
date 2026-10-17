// 跳燈（Nick 2026-10-17 說好的草稿 https://claude.ai/artifact/NjStMe4AhSWuk9dBUELzde）：86（ae86）、R7（rx7）的掀式大燈
// 車身（body-<key>-q.glb、輕量車 body-<key>-lod.glb）本來就是燈蓋關著的樣子（縫、黑色前緣是貼圖）。這裡另外做兩個燈座：
//   燈座＝一個盒子：背面是燈蓋（車漆色）、頂面也是車漆色、前面黑色＋一塊燈（開燈會亮）、兩邊和底是黑的；以燈蓋後緣為軸轉上來（關著的時候燈在底下、藏在車身裡）
//   燈座立起來以後，原本燈蓋的地方是一個黑色的洞（貼著引擎蓋的表面，跟著車身量出來的高度）
// 一台車一個網格、一個 draw call（兩個燈座＋兩個洞）；燈蓋收好（關燈）的時候整個藏起來＝0 個 draw call
// 轉動在 vertex shader 裡算（uniform：軸的位置、cos、sin；aPop.x＝1 的頂點才轉）：動的時候只改 uniform，不用算矩陣、不產生新物件；不動的時候 step() 什麼都不做
// 燈蓋的顏色＝車漆（直接用車子的那個 THREE.Color：車庫換顏色、朋友的輕量車換顏色都跟著變）
// 【API】
//   POP_LAMPS[key]：有跳燈的車（ae86、rx7）
//   const pop = popLamps(key, paintColor, bodyGeo)   bodyGeo＝車身網格（量引擎蓋的高度：燈座的軸、洞貼著表面；沒給就用估的）
//     → { mesh（名字 'popup'，加到車身 body 底下；mesh.userData.pop＝pop）, set(on, T)（T 秒轉過去，0＝馬上）, step(dt) → 還在動嗎,
//         on（要開還是關）, t（0 收好～1 立起來）, glow（燈多亮 0～1）, dispose() }
// 座標跟車身一樣：x 往前（車頭 +x）、y 往上、z 往右；兩邊對稱
// 打包（build-art.mjs／build-app.mjs 拿掉 import／export）：最上層只有 POP_LAMPS、popLamps，其他都在 IIFE 裡
import * as THREE from 'three';

export const { POP_LAMPS, popLamps } = (() => {
  // 每台車（右邊；左邊鏡射）：x0＝軸（燈蓋後緣）、x1＝燈蓋前緣、z0／z1＝燈座內側／外側、
  //   up＝立起來的時候燈蓋（燈座背面）跟水平差幾度、d＝燈座多深（立起來＝頂面多長）、sink＝立起來的時候燈座底比軸低多少（陷在洞裡）、
  //   lamp＝前面的燈 [左右留邊, 上面留邊, 高]、round＝燈的圓角（0 方的～0.5 兩頭圓）、y0／y1＝量不到車身的時候用的引擎蓋高度（軸、前緣）
  //   hole＝洞比燈座多出來的邊 [前, 兩邊]
  const CARS = {
    // 86：燈蓋 x 1.76～1.985、|z| 0.36～0.715（ae86-look.js 上面的縫），引擎蓋往前低 8～9 度；燈是長方形的
    ae86: { x0: 1.768, x1: 1.972, z0: 0.372, z1: 0.703, up: 88, d: 0.15, sink: 0.05, lamp: [0.032, 0.036, 0.118], round: 0.18, y0: 0.771, y1: 0.741, hole: [0.0, 0.004] },
    // R7：燈蓋是葉子板上一個斜的橢圓（rx7-body.mjs 的 LID：x 1.534～1.923、|z| 0.525～0.795），引擎蓋往前低快 20 度；燈座取橢圓裡面的長方形，燈是兩頭圓的
    //   燈座矮矮寬寬的（跟草稿一樣）：軸放在橢圓中間、只用前面那一段當燈蓋；洞＝這個長方形跟橢圓重疊的地方（oval＝rx7-body.mjs 的 LID）
    rx7: { x0: 1.70, x1: 1.835, z0: 0.56, z1: 0.78, up: 86, d: 0.115, sink: 0.06, lamp: [0.024, 0.03, 0.068], round: 0.5, y0: 0.712, y1: 0.66, hole: [0.0, 0.006],
      oval: [[1.923, 0.617], [1.876, 0.699], [1.782, 0.761], [1.66, 0.795], [1.567, 0.769], [1.534, 0.71], [1.57, 0.64], [1.64, 0.55], [1.75, 0.525], [1.86, 0.565]] },
  };
  const LAMP_E = new THREE.Color(1.0, 0.93, 0.74); // 燈亮的顏色（暖白）
  const GLOW = 2.6; // 亮的強度（emissive，ACES 之後接近白）

  // ---- 量引擎蓋的高度：車身網格裡這一塊朝上的三角形，從上面往下找（一台車的網格只量一次）----
  const SURF = new WeakMap();
  function sampler(geo, R) {
    if (!geo || !geo.attributes || !geo.attributes.position) return null;
    let byKey = SURF.get(geo); if (!byKey) SURF.set(geo, (byKey = new Map()));
    const k = `${R.x0},${R.x1},${R.z0},${R.z1}`;
    if (byKey.has(k)) return byKey.get(k);
    const P = geo.attributes.position, I = geo.index ? geo.index.array : null, n = I ? I.length : P.count;
    const x0 = R.x0 - 0.04, x1 = R.x1 + 0.04, z0 = R.z0 - 0.04, z1 = R.z1 + 0.04, T = [];
    for (let t = 0; t < n; t += 3) {
      const a = I ? I[t] : t, b = I ? I[t + 1] : t + 1, c = I ? I[t + 2] : t + 2;
      const ax = P.getX(a), bx = P.getX(b), cx = P.getX(c);
      if ((ax < x0 && bx < x0 && cx < x0) || (ax > x1 && bx > x1 && cx > x1)) continue;
      const az = P.getZ(a), bz = P.getZ(b), cz = P.getZ(c);
      if ((az < z0 && bz < z0 && cz < z0) || (az > z1 && bz > z1 && cz > z1)) continue;
      const ay = P.getY(a), by = P.getY(b), cy = P.getY(c);
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az); // 法線的 y（朝上才算；兩種繞法都收）
      if (Math.abs(ny) < 1e-9) continue;
      T.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    }
    const f = T.length ? (x, z) => { // 這一點正上方最高的表面（沒有＝NaN）
      let best = NaN;
      for (let i = 0; i < T.length; i += 9) {
        const ax = T[i], az = T[i + 2], bx = T[i + 3], bz = T[i + 5], cx = T[i + 6], cz = T[i + 8];
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-12) continue;
        const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w = 1 - u - v;
        if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
        const y = u * T[i + 1] + v * T[i + 4] + w * T[i + 7];
        if (!(y <= best)) best = y;
      }
      return best;
    } : null;
    byKey.set(k, f);
    return f;
  }

  // ---- 材質：一個 MeshPhysicalMaterial，頂點的 aPop.y 分三種：0 車漆（color＝車漆）、1 黑（燈殼、洞）、2 燈（開燈會亮）----
  function material(paintColor) {
    const m = new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 });
    m.color = paintColor; // 同一個 Color：車漆換了這裡也換
    const U = { uPop: { value: new THREE.Vector4(0, 0, 1, 0) }, uPopE: { value: new THREE.Color(0, 0, 0) } };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'attribute vec2 aPop;\nuniform vec4 uPop;\nvarying float vPopK;\n' + sh.vertexShader
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
  if (aPop.x > 0.5) objectNormal.xy = vec2(objectNormal.x * uPop.z - objectNormal.y * uPop.w, objectNormal.x * uPop.w + objectNormal.y * uPop.z);`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
  vPopK = aPop.y;
  if (aPop.x > 0.5) { vec2 pd = transformed.xy - uPop.xy; transformed.xy = uPop.xy + vec2(pd.x * uPop.z - pd.y * uPop.w, pd.x * uPop.w + pd.y * uPop.z); }`);
      sh.fragmentShader = 'uniform vec3 uPopE;\nvarying float vPopK;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
  if (vPopK > 1.5) diffuseColor.rgb = vec3(0.78, 0.8, 0.82); else if (vPopK > 0.5) diffuseColor.rgb = vec3(0.012);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  if (vPopK > 1.5) roughnessFactor = 0.12; else if (vPopK > 0.5) roughnessFactor = 0.5;`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  if (vPopK > 0.5) metalnessFactor = 0.0;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  if (vPopK > 1.5) totalEmissiveRadiance += uPopE;`)
        .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
  #ifdef USE_CLEARCOAT
  if (vPopK > 0.5 && vPopK < 1.5) material.clearcoat = 0.0; // 黑色的塑膠沒有亮光漆
  #endif`);
    };
    m.customProgramCacheKey = () => 'popup';
    m.userData.u = U;
    return m;
  }

  // ---- 洞的左右範圍：沒有 oval＝[z0, z1]；有＝跟橢圓（俯視的多邊形）在這個 x 的那一段重疊 ----
  function clip(poly, x, z0, z1) {
    if (!poly) return [z0, z1];
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
      if ((ax - x) * (bx - x) > 0 || ax === bx) continue;
      const z = az + ((bz - az) * (x - ax)) / (bx - ax); lo = Math.min(lo, z); hi = Math.max(hi, z);
    }
    const a = Math.max(z0, lo), b = Math.min(z1, hi);
    return a < b ? [a, b] : [(z0 + z1) / 2, (z0 + z1) / 2];
  }

  // ---- 網格：燈座畫在「立起來」的樣子（軸＝原點），關著＝整個繞軸轉 −θ ----
  function geometry(C, f) {
    const pos = [], nor = [], pop = [], idx = [];
    const surfY = (x, z) => { const y = f ? f(x, z) : NaN; return Number.isFinite(y) ? y : C.y0 + ((C.y1 - C.y0) * (x - C.x0)) / (C.x1 - C.x0); };
    const zm = (C.z0 + C.z1) / 2, hy = surfY(C.x0, zm) + 0.002, fy = surfY(C.x1, zm) + 0.002; // 軸、燈蓋前緣（中間那條線）
    const phi = Math.atan2(hy - fy, C.x1 - C.x0), L = Math.hypot(C.x1 - C.x0, hy - fy), al = (C.up * Math.PI) / 180, theta = al + phi;
    const ca = Math.cos(al), sa = Math.sin(al), u = [ca, sa], n = [sa, -ca]; // u：燈蓋往上的方向；n：燈座往前（燈照的方向）
    const pt = (s, t) => [C.x0 + u[0] * s + n[0] * t, hy + u[1] * s + n[1] * t]; // s 沿著燈蓋、t 往前
    const O = pt(0, 0), A = pt(L, 0), B = pt(L, C.d), Cc = pt(-C.sink, C.d), E = pt(-C.sink, 0);
    // 一個面（共平面、凸的）：pts＝[[x, y, z]…]（從外面看逆時針），k＝種類，rot＝會不會轉；法線用 Newell（圓角的點靠很近也準）
    const face = (pts, k, rot) => {
      const b = pos.length / 3; let nx = 0, ny = 0, nz = 0;
      for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; nx += (p[1] - q[1]) * (p[2] + q[2]); ny += (p[2] - q[2]) * (p[0] + q[0]); nz += (p[0] - q[0]) * (p[1] + q[1]); }
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      for (const p of pts) { pos.push(p[0], p[1], p[2]); nor.push(nx, ny, nz); pop.push(rot ? 1 : 0, k); }
      for (let i = 1; i < pts.length - 1; i++) idx.push(b, b + i, b + i + 1);
    };
    for (const s of [1, -1]) { // 右邊、左邊（鏡射：z 反過來、繞法反過來）
      const zi = s * C.z0, zo = s * C.z1, F = (pts, k, rot) => face(s > 0 ? pts : pts.slice().reverse(), k, rot);
      const P3 = (p, z) => [p[0], p[1], z];
      // 燈座（右邊的點、從外面看逆時針；斷面 A 頂後 → E 底後 → C 底前 → B 頂前 是逆時針）
      F([P3(A, zi), P3(E, zi), P3(E, zo), P3(A, zo)], 0, true); // 背面＝燈蓋（車漆）
      F([P3(B, zi), P3(A, zi), P3(A, zo), P3(B, zo)], 0, true); // 頂面（車漆，跟草稿一樣）
      F([P3(Cc, zi), P3(B, zi), P3(B, zo), P3(Cc, zo)], 1, true); // 前面（黑）
      F([P3(E, zi), P3(Cc, zi), P3(Cc, zo), P3(E, zo)], 1, true); // 底
      F([P3(A, zo), P3(E, zo), P3(Cc, zo), P3(B, zo)], 1, true); // 外側
      F([P3(B, zi), P3(Cc, zi), P3(E, zi), P3(A, zi)], 1, true); // 內側
      // 燈：前面上半部，往前凸 2 公釐；圓角的長方形（round 0.5＝兩頭半圓）
      const [mx, mt, lh] = C.lamp, w = C.z1 - C.z0 - 2 * mx, r = Math.min(lh, w) * C.round, cz = s * zm, seg = 6, ring = [];
      const lt = mt, lb = mt + lh; // 從頂面往下量（沿著 −u）
      const corner = (cs, ct, a0) => { for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * (Math.PI / 2); ring.push([cs + Math.cos(a) * r, ct + Math.sin(a) * r]); } };
      // 燈面的 2D：e＝沿著寬（z，往外 +），g＝往上（u 方向，0＝頂面那條線）
      corner(w / 2 - r, -lt - r, 0); corner(-w / 2 + r, -lt - r, Math.PI / 2); corner(-w / 2 + r, -lb + r, Math.PI); corner(w / 2 - r, -lb + r, 1.5 * Math.PI);
      const lamp = ring.map(([e, g]) => { const p = pt(L + g, C.d + 0.002); return [p[0], p[1], cz + s * e]; });
      F(lamp.reverse(), 2, true); // ring 在 (寬, 高) 是逆時針＝從前面看順時針 → 反過來
      // 洞：原本燈蓋的地方（貼著引擎蓋表面上面 4 公釐、不會轉）；格子跟著表面
      const hx0 = C.x0 - 0.004, hx1 = C.x1 + C.hole[0], hz0 = C.z0 - C.hole[1], hz1 = C.z1 + C.hole[1], NX = 6, NZ = 4, b = pos.length / 3;
      for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
        const x = hx0 + ((hx1 - hx0) * i) / NX, [za, zb] = clip(C.oval, x, hz0, hz1), z = za + ((zb - za) * j) / NZ, y = surfY(x, z) + 0.004;
        const dx = 0.01, sx = (surfY(x + dx, z) - surfY(x - dx, z)) / (2 * dx), sz = (surfY(x, z + dx) - surfY(x, z - dx)) / (2 * dx), nl = Math.hypot(sx, 1, sz);
        pos.push(x, y, s * z); nor.push(-sx / nl, 1 / nl, (-sz * s) / nl); pop.push(0, 1);
      }
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        const a = b + j * (NX + 1) + i, c = a + NX + 1;
        if (s > 0) idx.push(a, c, a + 1, a + 1, c, c + 1); else idx.push(a, a + 1, c, a + 1, c + 1, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('aPop', new THREE.Float32BufferAttribute(pop, 2));
    g.setIndex(idx);
    // 外框：立起來＋收好兩種樣子都包進去（不然轉到一半被視錐剔掉）
    const box = new THREE.Box3(), v = new THREE.Vector3(), c = Math.cos(-theta), sn = Math.sin(-theta);
    for (let i = 0; i < pos.length; i += 3) {
      v.set(pos[i], pos[i + 1], pos[i + 2]); box.expandByPoint(v);
      if (pop[(i / 3) * 2]) { const dx = pos[i] - C.x0, dy = pos[i + 1] - hy; v.set(C.x0 + dx * c - dy * sn, hy + dx * sn + dy * c, pos[i + 2]); box.expandByPoint(v); }
    }
    g.boundingBox = box; g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    return { g, hinge: [C.x0, hy], theta, L, phi };
  }

  const ease = (x) => x * x * (3 - 2 * x);
  function popLamps(key, paintColor, bodyGeo) {
    const C = CARS[key]; if (!C) return null;
    const G = geometry(C, sampler(bodyGeo, C)), mat = material(paintColor || new THREE.Color(0xffffff));
    const mesh = new THREE.Mesh(G.g, mat); mesh.name = 'popup'; mesh.visible = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 1;
    const U = mat.userData.u;
    const P = {
      mesh, on: false, t: 0, glow: 0, T: 0.3, info: { hinge: G.hinge, theta: G.theta, L: G.L, phi: G.phi },
      set(on, T = 0.3) { P.on = !!on; P.T = Math.max(0, +T || 0); if (!(P.T > 0)) { P.t = P.on ? 1 : 0; apply(); } },
      step(dt) { // 每一幀：沒在動就馬上回去
        const want = P.on ? 1 : 0; if (P.t === want) return false;
        P.t = P.on ? Math.min(1, P.t + dt / P.T) : Math.max(0, P.t - dt / P.T); apply(); return true;
      },
      dispose() { mesh.removeFromParent(); G.g.dispose(); mat.dispose(); },
    };
    function apply() { // 角度：t 0＝收好（−θ）、1＝立起來；燈：轉到最後那一段才亮（關的時候先暗）
      const a = -G.theta * (1 - ease(P.t)); U.uPop.value.set(G.hinge[0], G.hinge[1], Math.cos(a), Math.sin(a));
      P.glow = ease(Math.max(0, Math.min(1, (P.t - 0.55) / 0.45)));
      U.uPopE.value.copy(LAMP_E).multiplyScalar(GLOW * P.glow);
      mesh.visible = P.t > 0;
    }
    apply();
    mesh.userData.pop = P;
    return P;
  }
  return { POP_LAMPS: CARS, popLamps };
})();
