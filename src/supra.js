// 組一台 3D 車：車身（三層：車漆、車內、玻璃）＋輪子＋尾翼＋後照鏡＋車內＋套件
// 每台車的不同都寫在 SPEC 裡（Supra、GT-R）
import * as THREE from 'three';
import { MAT, wheel, gtWing, mirror, interior, aeroKit, AERO_SUPRA, lip, r34Wing, mirrorR34, exhaust, wideKit, WIDE_PUSH, mk4Wing, rimFace, RIM_POLISH, neonPad } from './parts.js';
import { makeMaskTextures, patchPaint, patchGlass, patchInside, SUPRA_LOOK, PAINT_NIGHT } from './masks.js';
import { GTR_LOOK } from './gtr-look.js';

export const SUPRA_SPEC = {
  look: SUPRA_LOOK, paint: '#ff7414', metal: 0.12,
  wheels: { xf: 1.2125, xr: -1.3375, R: 0.325, rim: 0.254, trackF: 0.76, trackR: 0.765, wF: 0.235, wR: 0.265, style: 'five' },
  mirror: (paint, mats, s) => { const m = mirror(paint, mats, s); m.position.set(0.60, 0.975, s * 0.745); m.scale.setScalar(1.3); return m; },
  wings: { stock: (paint) => mk4Wing(paint), gt: (paint, mats) => gtWing({ mats }) }, wing: 'gt',
  interior: {},
  build(body, paint, mats) { // 套件：原廠（原廠保桿）、bomex（玩命關頭那台）、track（Bomex＋碳纖維空力件）
    const aero = aeroKit(mats, AERO_SUPRA); aero.visible = false; body.add(aero);
    body.add(exhaust(mats, -2.21, 0.266, -0.572, 1, 0.95)); // 排氣管在左後（照車尾照片）
    return (kit, ctx) => { ctx.setNose(kit === 'stock' ? 'stock' : 'bomex'); aero.visible = kit === 'track'; };
  },
  kit: 'bomex',
};
export const AERO_GTR = {
  front: [[2.335, 0], [2.325, 0.30], [2.285, 0.50], [2.21, 0.65], [2.10, 0.76], [1.98, 0.815]], back: 1.95, y: 0.118, rods: [2.26, 0.165],
  canard: { S: [2.175, 0.69], t: [-0.57, 0.82], ys: [0.28, 0.20] },
  skirt: { y: 0.125, x0: -0.95, x1: 0.80, z0: 0.86, z1: 0.95 },
  diff: { x0: -1.85, x1: -2.10, x2: -2.285, y0: 0.128, y1: 0.146, y2: 0.19, w: 0.62, fin0: -1.95 },
};
export const GTR_SPEC = {
  look: GTR_LOOK, paint: '#1d4fc9', metal: 0.32, seat: 0x2a2b2f,
  wheels: { xf: 1.29, xr: -1.375, R: 0.327, rim: 0.2286, trackF: 0.74, trackR: 0.745, wF: 0.245, wR: 0.245, style: 'multi' },
  mirror: (paint, mats, s) => { const m = mirrorR34(paint, mats, s); m.position.set(0.46, 0.975, s * 0.77); return m; },
  wings: {
    stock: (paint, mats) => r34Wing(paint, mats),
    gt: (paint, mats) => gtWing({ mats, x: -1.90, y: 1.25, deck: 0.962, span: 1.62, chord: 0.30 }), // 支架插進行李箱一點（原本浮 1.7 公分）
  },
  wing: 'stock',
  interior: { dx: 0.06, cage: false, wheelZ: 0.36, dashX: 0.55, dashY: 0.87, bench: { x: -0.98, shelfX: -1.43, shelfY: 0.975 } },
  build(body, paint, mats) { // 套件：原廠（什麼都不加）、玩命關頭（照片那台的碳纖維前下巴）、賽道（大下巴＋風刀＋側裙刀片＋擴散器）
    body.add(exhaust(mats, -2.27, 0.28, -0.437, 1.2, 0.85)); // 排氣管在左後（照 Nick 的 R34 車尾照片）
    const amber = new THREE.MeshStandardMaterial({ color: 0xff7a14, roughness: 0.2, emissive: 0x5a2200, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const s of [1, -1]) { // 內側圓尾燈中間的橘色方向燈
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.038, 28), amber); d.rotation.y = -Math.PI / 2; d.position.set(-2.289, 0.787, s * 0.45); body.add(d);
    }
    const lp = lip(mats, [[2.29, 0], [2.28, 0.30], [2.245, 0.49], [2.175, 0.635], [2.07, 0.745], [1.97, 0.80]], 2.0, 0.138);
    const aero = aeroKit(mats, AERO_GTR);
    lp.visible = false; aero.visible = false; body.add(lp, aero);
    return (kit) => { lp.visible = kit === 'bomex'; aero.visible = kit === 'track'; };
  },
  kit: 'bomex',
};

// geos：{ body, noses: { 名字: 車頭網格 } }（Supra 的車頭依套件換；GT-R 沒有分開的車頭）
export function buildCar(spec, geos, opt = {}) {
  const car = new THREE.Group();
  const tex = makeMaskTextures(spec.look), BK = geos.baked || null; // BK：烘焙好的車身（第 49 批，gc8-bake.mjs）：玻璃、燈、黑飾條都是自己的網格，投影遮罩只留拉花
  if (BK) bakedMasks(tex);
  const paint = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(opt.paint || spec.paint), metalness: spec.metal, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 });
  if (BK) { const pm = BK.find((b) => b.slot === 'paint').src; paint.map = pm.map; paint.normalMap = pm.normalMap; paint.normalScale.set(1, 1); for (const t of [pm.map, pm.normalMap]) if (t) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; t.needsUpdate = true; } } // 門縫（白底、縫是暗的＋法線貼圖）
  patchPaint(paint, tex);
  const finU = { uFlake: { value: 0 } };
  { // 漆面的 shader 補丁（包在 patchPaint 外面）：珍珠（iridescence）、金屬漆的亮片只上在車漆（黑飾條、燈、網子、消光的地方不要）
    const pb = paint.onBeforeCompile; // masks.js 會改，所以只用 shader 裡找得到的遮罩變數
    paint.onBeforeCompile = (sh, r) => {
      pb(sh, r);
      const fs = sh.fragmentShader, ms = ['blackG', 'matte', 'lamp', 'lens', 'wire', 'amber', 'red', 'rev'].filter((n) => new RegExp(`\\b${n}\\s*=`).test(fs));
      const w = `(1.0 - ${ms.reduce((a, n) => `max(${a}, ${n})`, '0.0')})`;
      Object.assign(sh.uniforms, finU);
      sh.fragmentShader = 'uniform float uFlake;\n' + fs.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
#ifdef USE_IRIDESCENCE
  material.iridescence *= ${w};
#endif`);
      // 亮片：3 mm 一格，每格法線亂偏一點；格子比一個像素小（遠看）就淡掉，不然是雜訊、自動轉的時候一直閃（白色、銀色在暗攝影棚最明顯）
      if (/varying vec3 vP;/.test(fs)) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (uFlake > 0.0) { vec3 fp = vP * 320.0, fc = floor(fp);
    normal = normalize(normal + uFlake * ${w} * smoothstep(2.0, 0.7, length(fwidth(fp))) * (fract(sin(vec3(dot(fc, vec3(12.99, 78.23, 37.72)), dot(fc, vec3(39.35, 11.14, 83.16)), dot(fc, vec3(73.16, 52.48, 19.73)))) * 43758.55) - 0.5)); }`);
    };
    paint.customProgramCacheKey = () => 'paint+';
  }
  const inside = new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.9, metalness: 0, side: THREE.BackSide });
  if (!BK) patchInside(inside, tex);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b0d10, roughness: 0.04, metalness: 0, transparent: true, opacity: opt.tint ?? 0.34, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.8 });
  if (BK) bakedClear(glass); else patchGlass(glass, tex); // 烘焙的車窗是自己的網格：不用遮罩挖

  const body = new THREE.Group(); body.name = 'body';
  if (!BK) {
    const shell = new THREE.Mesh(geos.body, paint); shell.name = 'paint';
    const inner = new THREE.Mesh(geos.body, inside); inner.name = 'inside';
    const glz = new THREE.Mesh(geos.body, glass); glz.name = 'glass'; glz.renderOrder = 2;
    body.add(shell, inner, glz);
  }
  const noses = {};
  for (const [k, g] of Object.entries(geos.noses || {})) {
    const m = new THREE.Mesh(g, paint); m.name = 'nose-' + k;
    body.add(m); noses[k] = m;
  }

  const mats = {
    rubber: MAT.rubber(), chrome: MAT.chrome(), alu: MAT.alu(), disc: MAT.disc(), caliper: MAT.caliper(), black: MAT.black(), gloss: MAT.gloss(),
    barrelIn: new THREE.MeshPhysicalMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 1 }),
    mirrorGlass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 1 }),
    seat: new THREE.MeshStandardMaterial({ color: spec.seat ?? 0x1b3f8f, roughness: 0.8 }),
    cage: new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.45, metalness: 0.2 }),
    carbon: MAT.carbon(), polish: MAT.polish(),
  };
  const cab = interior(mats, spec.interior); cab.name = 'interior'; body.add(cab);
  if (spec.mirror) for (const s of [-1, 1]) body.add(spec.mirror(paint, mats, s)); // 烘焙的車：後照鏡在車身裡
  const bw = BK ? bakedBody(BK, body, { paint, glass, inside, mats }) : null; // 烘焙的尾翼（spec.wings 裡寫 'baked' 的那個）
  const wings = {};
  for (const [k, fn] of Object.entries(spec.wings)) { const w = fn === 'baked' ? bw : fn(paint, mats); w.name = 'wing-' + k; w.visible = k === spec.wing; body.add(w); wings[k] = w; }
  const setWing = (k) => { for (const [n, w] of Object.entries(wings)) w.visible = n === k; };
  const applyKit = spec.build(body, paint, mats);
  const setNose = BK ? () => {} : (k) => { for (const [n, m] of Object.entries(noses)) m.visible = n === k; tex.setNose(k); };
  const setKit = (kit) => applyKit(kit, { setNose });
  setKit(spec.kit);
  car.add(body);
  // 寬體（opt.wide＝WIDE[key]，沒有就不能選）：加寬的葉子板＋輪子往外推
  const wide = opt.wide ? wideKit(paint, opt.wide, mats) : null;
  if (wide) { wide.visible = false; body.add(wide); }
  const hubs = [];

  // 前後輪可以不同大小（RF／RR、rimF／rimR，沒寫就用 R、rim）
  const W = spec.wheels, wheels = [], rims = [];
  for (const [x, track, w, R, rim] of [[W.xf, W.trackF, W.wF, W.RF ?? W.R, W.rimF ?? W.rim], [W.xr, W.trackR, W.wR, W.RR ?? W.R, W.rimR ?? W.rim]]) {
    for (const s of [-1, 1]) {
      const { wheel: wh, brake } = wheel({ R, width: w, rim, mats, style: W.style });
      rims.push({ wh, rim, w, s });
      const hub = new THREE.Group();
      hub.position.set(x, R, s * track);
      if (s < 0) { hub.rotation.y = Math.PI; brake.scale.x = -1; } // 左邊的卡鉗也要在碟盤後面
      hub.add(wh, brake);
      car.add(hub);
      wheels.push(wh); hubs.push({ hub, s, track, ax: x > 0 ? 'f' : 'r' });
    }
  }
  let wideOn = false;
  const setWide = (on) => {
    if (!wide) return;
    wide.visible = wideOn = on;
    for (const h of hubs) h.hub.position.z = h.s * (h.track + (on ? WIDE_PUSH[h.ax] : 0));
    fitGlow();
  };

  // 輪框樣式：'stock'（這台車自己的）、'five'、'multi'、'mesh'、'six'、'fan'、'dish'；只換輪框面（輻條＋中心蓋＋螺帽），輪胎、輪框筒、煞車不動
  // 顏色一樣從 mats.chrome 來（車庫換輪框色改的是它）；mesh、dish 的輪框筒外緣換成拋光輪唇（mats.polish）
  let rimNow = 'stock';
  const setRim = (k = 'stock') => {
    const style = k === 'stock' ? W.style : k;
    if (k === rimNow) return;
    rimNow = k;
    for (const r of rims) {
      const old = r.wh.getObjectByName('rimface');
      if (old) { r.wh.remove(old); old.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
      r.wh.add(rimFace(style, r.rim, r.w, mats, r.s));
      r.wh.getObjectByName('barrel').material = RIM_POLISH[style] ? mats.polish : mats.chrome;
    }
    if (!RIM_POLISH[style]) mats.polish.dispose(); // 沒用到拋光輪唇就放掉（車庫 disposeCar 只放得到場景裡的材質；之後再用會自己重建）
  };

  // 底盤霓虹燈：地上一片柔柔的光，掛在 car 底下（跟著車子跑，不跟車身高度）；'none'＝關
  const bb = new THREE.Box3();
  for (const g of BK ? BK.filter((b) => b.part === 'body').map((b) => b.geo) : [geos.body, ...Object.values(geos.noses || {})]) { if (!g.boundingBox) g.computeBoundingBox(); bb.union(g.boundingBox); }
  let glow = null;
  const halfW = Math.max(bb.max.z, -bb.min.z);
  function fitGlow() { if (glow) glow.scale.y = wideOn ? 1 + Math.max(WIDE_PUSH.f, WIDE_PUSH.r) / (halfW + 0.5) : 1; } // 寬體：光也寬一點
  const setGlow = (c) => {
    if (!c || c === 'none') { if (glow) glow.visible = false; return; }
    if (!glow) { glow = neonPad(bb.min.x, bb.max.x, halfW); car.add(glow); fitGlow(); }
    glow.setColor(c); glow.visible = true;
  };

  // 漆面：'stock'（原本的；918 是照顏色自動消光／亮面）、'gloss' 亮面、'metal' 金屬漆、'matte' 消光、'pearl' 珍珠（iridescence）
  // [粗糙度, 金屬感, 清漆, 清漆粗糙度, 珍珠, 亮片]；清漆不能是 0（patchPaint 的 shader 要用到），消光用 0.001
  const FIN = { gloss: [0.16, 0.02, 1, 0.012, 0, 0], metal: [0.3, 0.6, 1, 0.03, 0, 0.14], matte: [0.62, 0.12, 0.001, 0.6, 0, 0], pearl: [0.22, 0.3, 1, 0.02, 1, 0] };
  const stockFin = [paint.roughness, paint.metalness, paint.clearcoat, paint.clearcoatRoughness, 0, 0];
  const setFinish = (k = 'stock') => {
    const f = FIN[k] || stockFin;
    paint.userData.finish = FIN[k] ? k : 'stock'; // 918 的 P918_sync 看這個：不是 stock 就不照顏色改漆面
    [paint.roughness, paint.metalness, paint.clearcoat, paint.clearcoatRoughness, paint.iridescence, finU.uFlake.value] = f;
    paint.iridescenceIOR = 2; paint.iridescenceThicknessRange = [100, 380]; // 沒有厚度貼圖時膜厚＝最大值 380nm：白車偏淡紫、彩色車有粉色光澤
  };
  if (BK) { // 用車漆、可是沒有 uv 的零件（寬體葉子板、套件⋯）：給一個沒有門縫的 uv（不然看貼圖的哪裡不一定）
    const cl = BK.find((b) => b.slot === 'paint').clean || [0.5, 0.5];
    car.traverse((o) => { if (o.isMesh && !o.geometry.attributes.uv && [].concat(o.material).includes(paint)) { const n = o.geometry.attributes.position.count, U = new Float32Array(n * 2); for (let i = 0; i < n; i++) { U[i * 2] = cl[0]; U[i * 2 + 1] = cl[1]; } o.geometry.setAttribute('uv', new THREE.BufferAttribute(U, 2)); } });
  }
  return { car, body, paint, glass, wheels, wings, setWing, noses, setKit, setWide, setRim, setGlow, setFinish, mats, tex, spec };
}

// ---- 第 49 批：烘焙好的車身（gc8-bake.mjs → body-<key>-q.glb）：每個材質（slot）一組網格，不用投影遮罩 ----
// 投影遮罩只剩拉花：玻璃、燈、黑邊、輪拱都是空的（車漆的 shader 照舊，只是遮罩什麼都沒有）
const BAKED_BLANK = new THREE.DataTexture(new Uint8Array(4), 1, 1); BAKED_BLANK.needsUpdate = true;
function bakedMasks(tex) {
  const U = tex.U;
  for (const k of ['tSide', 'tFront', 'tRear', 'tTop']) U[k].value = BAKED_BLANK;
  U.uWell.value.set(0, -1, -1); U.uWellR.value.set(0, -1, -1);
  U.uUnderY.value = 0.2; // 只有底盤（0.15–0.19）黑；保桿下緣的圓弧（0.22 以上）留車身色：法線一格一格算，0.3 的時候邊是鋸齒狀的
}
// 燈：晚上（PAINT_NIGHT）自己發光；how：'all' 整片、'red' 只有紅色的地方（尾燈：倒車燈不要紅）
function bakedNight(m, rgb, how = 'all') {
  const k = how === 'red' ? 'clamp((diffuseColor.r - max(diffuseColor.g, diffuseColor.b)) * 2.5, 0.0, 1.0)' : '1.0';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = PAINT_NIGHT;
    sh.fragmentShader = 'uniform float uNight;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += uNight * vec3(${rgb.map((v) => v.toFixed(3)).join(', ')}) * ${k};`);
  };
  m.customProgramCacheKey = () => `bkN${rgb.join()}${how}`;
  return m;
}
// 假玻璃（大燈罩）：跟車窗一樣，反光越亮越不透明（透明度＋反光；不用 transmission，手機才畫得動）
function bakedClear(m, back = 0.3) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
  float refl = max(max(outgoingLight.r, outgoingLight.g), outgoingLight.b);
  if (!gl_FrontFacing) { gl_FragColor.rgb *= ${back.toFixed(2)}; refl *= 0.2; }
  gl_FragColor.a = clamp(diffuseColor.a + refl * 0.9, 0.0, 1.0);`);
  };
  m.customProgramCacheKey = () => 'bkClear' + back;
  return m;
}
// 載入的 glb → 每一組：{ slot, part, side, geo（車子座標、Float32；照後鏡是對 at 的座標）, src（glb 的材質：拿貼圖）, clean（車漆沒有縫的 uv）, at }
function bakedGeos(gltfScene) {
  gltfScene.updateMatrixWorld(true);
  const out = [], v = new THREE.Vector3(), nm = new THREE.Matrix3();
  gltfScene.traverse((o) => {
    if (!o.isMesh || !o.userData.slot) return;
    const g0 = o.geometry, M = o.matrixWorld, p = g0.attributes.position, q = g0.attributes.normal, uv = g0.attributes.uv, n = p.count, ex = o.userData;
    nm.getNormalMatrix(M);
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(M); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
      v.fromBufferAttribute(q, i).applyMatrix3(nm).normalize(); N[i * 3] = v.x; N[i * 3 + 1] = v.y; N[i * 3 + 2] = v.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    if (uv && ex.uv) { const [u0, v0, du, dv] = ex.uv, U = new Float32Array(n * 2); for (let i = 0; i < n; i++) { U[i * 2] = u0 + du * uv.getX(i); U[i * 2 + 1] = v0 + dv * uv.getY(i); } geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); }
    if (g0.attributes.color) geo.setAttribute('color', g0.attributes.color);
    geo.setIndex(g0.index);
    let at = null; // 照後鏡：網格搬到鏡子中間（town.src.js mirrorSet 照位置分左右）
    if (ex.slot === 'mirror') { geo.computeBoundingBox(); at = geo.boundingBox.getCenter(new THREE.Vector3()); geo.translate(-at.x, -at.y, -at.z); }
    out.push({ slot: ex.slot, part: ex.part, side: ex.side || '', geo, src: o.material, clean: ex.clean, at });
  });
  return out;
}
// 烘焙的車身放進 body；回傳烘焙的尾翼（Group，沒有就是空的）
function bakedBody(BK, body, { paint, glass, inside, mats }) {
  const S = THREE.DoubleSide, own = {};
  const mat = (b) => { // 每一組的材質（同一個 slot、同一張貼圖共用）
    const s = b.src, key = `${b.slot}|${s.map?.uuid}|${b.part}`, vc = !!b.geo.attributes.color;
    if (b.slot === 'paint') return paint;
    if (b.slot === 'glass') return glass;
    if (b.slot === 'inside') return inside;
    if (b.slot === 'mirror') return mats.mirrorGlass;
    if (own[key]) return own[key];
    const base = { color: vc ? 0xffffff : s.color.getHex(), vertexColors: vc, side: s.side };
    let m;
    switch (b.slot) {
      case 'trim': m = new THREE.MeshStandardMaterial({ ...base, roughness: 0.5, metalness: 0.1 }); break;
      case 'dark': m = new THREE.MeshStandardMaterial({ ...base, roughness: 0.95, metalness: 0 }); break;
      case 'bright': m = new THREE.MeshStandardMaterial({ ...base, roughness: 0.1, metalness: 1 }); break;
      case 'reflector': m = bakedNight(new THREE.MeshStandardMaterial({ ...base, map: s.map, normalMap: s.normalMap, emissive: 0xffffff, emissiveMap: s.emissiveMap, emissiveIntensity: 0.14, roughness: 0.1, metalness: 1 }), [1.6, 1.55, 1.35]); break;
      case 'frost': m = bakedNight(new THREE.MeshStandardMaterial({ ...base, normalMap: s.normalMap, emissive: 0xffffff, emissiveIntensity: 0.1, roughness: 0.3, metalness: 0.35 }), [1.2, 1.15, 1.0]); break;
      case 'bulb': m = bakedNight(new THREE.MeshStandardMaterial({ ...base, emissive: 0xfff2d0, emissiveIntensity: 0.6, roughness: 0.3 }), [3.0, 2.9, 2.5]); break;
      case 'lens': m = bakedClear(new THREE.MeshStandardMaterial({ color: 0x0d0f11, side: s.side, transparent: true, opacity: 0.05, roughness: 0.03, metalness: 0, depthWrite: false })); break; // 大燈罩：顏色要暗（只有反光讓它不透明；白色的話整片白，看不到裡面的反光碗）
      case 'amber': m = bakedClear(new THREE.MeshStandardMaterial({ ...base, transparent: true, opacity: 0.78, roughness: 0.08, metalness: 0, depthWrite: false }), 0.6); break;
      case 'tail': m = bakedNight(new THREE.MeshPhysicalMaterial({ ...base, map: s.map, normalMap: s.normalMap, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }), [1.3, 0.04, 0.02], 'red'); break;
      case 'net': case 'netF': m = new THREE.MeshStandardMaterial({ ...base, map: s.map, alphaTest: 0.5, roughness: 0.5, metalness: b.slot === 'net' ? 0.6 : 0.3 }); break;
      default: m = new THREE.MeshStandardMaterial({ ...base, roughness: 0.5 });
    }
    if (m.normalMap) m.normalScale.set(1, 1);
    return (own[key] = m);
  };
  const wing = new THREE.Group();
  for (const b of BK) {
    const m = new THREE.Mesh(b.geo, mat(b));
    if (b.at) m.position.copy(b.at);
    m.name = b.slot === 'paint' && b.part === 'body' ? 'paint' : b.slot === 'inside' || b.slot === 'glass' ? b.slot : b.slot === 'mirror' ? 'mirrorGlass' : `bk:${b.part}:${b.slot}`; // 車身的車漆叫 'paint'（look.js：不投影子，車內那一層投）
    if (b.slot === 'glass' || b.slot === 'lens' || b.slot === 'amber') m.renderOrder = 2;
    (b.part === 'wing' ? wing : body).add(m);
  }
  return wing;
}
export const buildSupra = (geos, opt = {}) => buildCar(SUPRA_SPEC, geos, opt);

// 載入右半邊的車身，還原成公尺並鏡射成整台
export function fullBody(gltfScene, name) {
  gltfScene.updateMatrixWorld(true);
  let src = null; gltfScene.traverse((o) => { if (o.isMesh && !src && (!name || o.name === name)) src = o; });
  if (!src) throw new Error('no mesh ' + name);
  const g0 = src.geometry, m = src.matrixWorld, nm = new THREE.Matrix3().getNormalMatrix(m);
  const p = g0.attributes.position, n = g0.attributes.normal, c = p.count;
  const P = new Float32Array(c * 6), N = new Float32Array(c * 6), v = new THREE.Vector3();
  for (let i = 0; i < c; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(m);
    P.set([v.x, v.y, v.z], i * 3); P.set([v.x, v.y, -v.z], (i + c) * 3);
    v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
    N.set([v.x, v.y, v.z], i * 3); N.set([v.x, v.y, -v.z], (i + c) * 3);
  }
  const I0 = g0.index.array, I = new Uint32Array(I0.length * 2);
  I.set(I0);
  for (let t = 0; t < I0.length; t += 3) { I[I0.length + t] = I0[t] + c; I[I0.length + t + 1] = I0[t + 2] + c; I[I0.length + t + 2] = I0[t + 1] + c; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setIndex(new THREE.BufferAttribute(I, 1));
  return geo;
}
// 載入的 glb（Body、Nose_bomex、Nose_stock）→ buildSupra 要的 geos
export function carGeos(gltfScene) {
  let baked = false; gltfScene.traverse((o) => { if (o.userData?.slot) baked = true; });
  if (baked) return { baked: bakedGeos(gltfScene) }; // 第 49 批：烘焙好的車身
  const names = []; gltfScene.traverse((o) => { if (o.isMesh && o.name.startsWith('Nose_')) names.push(o.name.slice(5)); });
  return { body: fullBody(gltfScene, 'Body'), noses: Object.fromEntries(names.map((k) => [k, fullBody(gltfScene, 'Nose_' + k)])) };
}
