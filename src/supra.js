// 組一台 3D 車：車身（三層：車漆、車內、玻璃）＋輪子＋尾翼＋後照鏡＋車內＋套件
// 每台車的不同都寫在 SPEC 裡（Supra、GT-R）
import * as THREE from 'three';
import { MAT, wheel, gtWing, mirror, interior, aeroKit, AERO_SUPRA, lip, r34Wing, mirrorR34, exhaust, wideKit, WIDE_PUSH, mk4Wing, rimFace, RIM_POLISH, neonPad } from './parts.js';
import { makeMaskTextures, patchPaint, patchGlass, patchInside, SUPRA_LOOK } from './masks.js';
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
  const tex = makeMaskTextures(spec.look);
  const paint = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(opt.paint || spec.paint), metalness: spec.metal, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 });
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
  patchInside(inside, tex);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b0d10, roughness: 0.04, metalness: 0, transparent: true, opacity: opt.tint ?? 0.34, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.8 });
  patchGlass(glass, tex);

  const body = new THREE.Group(); body.name = 'body';
  const shell = new THREE.Mesh(geos.body, paint); shell.name = 'paint';
  const inner = new THREE.Mesh(geos.body, inside); inner.name = 'inside';
  const glz = new THREE.Mesh(geos.body, glass); glz.name = 'glass'; glz.renderOrder = 2;
  body.add(shell, inner, glz);
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
  for (const s of [-1, 1]) body.add(spec.mirror(paint, mats, s));
  const wings = {};
  for (const [k, fn] of Object.entries(spec.wings)) { const w = fn(paint, mats); w.name = 'wing-' + k; w.visible = k === spec.wing; body.add(w); wings[k] = w; }
  const setWing = (k) => { for (const [n, w] of Object.entries(wings)) w.visible = n === k; };
  const applyKit = spec.build(body, paint, mats);
  const setNose = (k) => { for (const [n, m] of Object.entries(noses)) m.visible = n === k; tex.setNose(k); };
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
  for (const g of [geos.body, ...Object.values(geos.noses || {})]) { if (!g.boundingBox) g.computeBoundingBox(); bb.union(g.boundingBox); }
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
  return { car, body, paint, glass, wheels, wings, setWing, noses, setKit, setWide, setRim, setGlow, setFinish, mats, tex, spec };
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
  const names = []; gltfScene.traverse((o) => { if (o.isMesh && o.name.startsWith('Nose_')) names.push(o.name.slice(5)); });
  return { body: fullBody(gltfScene, 'Body'), noses: Object.fromEntries(names.map((k) => [k, fullBody(gltfScene, 'Nose_' + k)])) };
}
